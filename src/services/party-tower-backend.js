// 2026-05-13 — TASK-055 (T3.10): Party Tower async architecture — backend.
//
// Spec: docs/design/endgame-social.md §3 (Party Tower — 2–5 player async coop)
//       + §15 ESC-03 Q3 ruling — 24h Standard default; 4h Competitive +
//         7-day Casual selectable per-party at creation.
//       + ADR-002 — async-only (Firestore + push notif, NO WebRTC).
//       + ADR-003 — strict no-P2W; party progression COSMETIC-ONLY; no
//         whale-tier perks; no paid party-size expansion.
//
// LARGEST single backend task in Phase 3. Establishes the async turn-based
// architecture per ADR-002 that T3.11 (shared resources), T3.12 (per-turn
// Identity Layer), and T3.13 (timeout + social hooks) all build on. T3.10
// ships PURE SCHEMA + state machine + turn rotation — it never writes to
// sacred TOWER_LEADERBOARDS / TOWER_PACTS / Tower retry ladder. Those wires
// land in T3.11 (shared pools) + T3.12 (per-turn Identity dispatch).
//
// What this module ships:
//   1. 10 pure-math helpers (testable in isolation, <1ms each):
//        - computeNextTurnPlayerId(party)
//        - validatePartySize(memberCount)              [HARD CAP 2–5]
//        - validatePartyName(name)                     [3–30 chars]
//        - canPlayerJoinParty(playerId, partyState)
//        - canPlayerStartParty(playerId, partyState)
//        - computeTurnTimeoutMs(mode)                  [4h/24h/7d]
//        - computeTurnHasExpired(partyState, now?)
//        - pickNextTurnPlayer(party)                   [round-robin + skip inactive]
//        - canPlayerEndTurn(playerId, partyState)
//        - computePartyProgress(party)                 [floor + last action]
//   2. 10 async ops (defensive — mock-store fallback when Firestore absent):
//        - createParty(ownerId, mode?)
//        - fetchParty(partyId)
//        - joinParty(partyId, playerId)
//        - leaveParty(partyId, playerId)
//        - startParty(partyId, ownerId)
//        - endTurn(partyId, playerId, turnDeltas?)
//        - transferOwnership(partyId, fromId, toId)
//        - listPartiesForPlayer(playerId)
//        - notifyTurnHandoff(partyId, fromPlayerId, toPlayerId)   [FCM stub]
//        - maybeAutoSkipExpiredTurn(partyId)                       [client fallback]
//
// Performance budget (spec §3.6):
//   - Pure helpers ≤1ms each.
//   - createParty / fetchParty round-trip ≤500ms p99 (live SDK).
//   - joinParty / endTurn ≤300ms p99 (live SDK).
//   - All async ops fall back to `{ok:false, reason:'no-sdk'}` when the
//     Firestore SDK is absent (mirrors T3.02 + T3.07 backend precedent).
//
// Sacred-cow safety (CLAUDE.md §2):
//   - READ-ONLY of game state. Never mutates grid / squad / boss / fx state.
//   - getPlayerSegment() never called — segment-agnostic per ADR-003.
//   - No V_HAPTICS / NARRATOR_LINES / RACE_SYNERGY / combo crit interaction.
//   - HARD CAP 2-5 invariant: validatePartySize enforces client-side;
//     server-side Firestore security rules mirror the cap.
//   - No P2W mechanics: every state field is segment-agnostic per ADR-003.
//   - TOWER_LEADERBOARDS / TOWER_PACTS / Tower retry ladder [100, 200, 400]
//     untouched. T3.10 sets up the schema (sharedState.towerPacts/towerHearts
//     slots exist, but T3.10 never WRITES values). T3.11 wires the shared pool.
//   - Codex schema isolation: parties live in Firestore (server-side); Codex
//     stays Phase 2 localStorage contract — no cross-pollination.
//   - Per ADR-002: NO WebRTC, NO peer connections, NO presence channels.
//   - All exports wrapped in defensive try/catch — sacred game loop must NOT
//     regress if party backend throws (ADR-004 hybrid coexistence).
//
// Public API:
//   Constants:
//     - PARTY_MIN_SIZE, PARTY_MAX_SIZE (2 / 5 HARD CAP per ADR-003)
//     - PARTY_NAME_MIN_LEN, PARTY_NAME_MAX_LEN
//     - PARTY_TIMEOUT_MS_COMPETITIVE / STANDARD / CASUAL (4h / 24h / 7d)
//     - PARTY_DEFAULT_TIMEOUT_MODE ('standard' per ESC-03 Q3)
//     - PARTY_STATES, PARTY_ROLES
//     - PARTY_RESULT_REASONS
//     - PARTY_COLLECTION
//   Pure helpers (see list above).
//   Async ops (see list above).
//   Test-only helpers:
//     - _resetMockPartyStore()
//     - _getMockPartyStoreForTest()
//     - _seedMockParty(partyId, partyState)

import { getDb } from './firebase.js';
import { log } from './logger.js';
import {
  PARTY_MIN_SIZE,
  PARTY_MAX_SIZE,
  PARTY_NAME_MIN_LEN,
  PARTY_NAME_MAX_LEN,
  PARTY_TIMEOUT_MS_COMPETITIVE,
  PARTY_TIMEOUT_MS_STANDARD,
  PARTY_TIMEOUT_MS_CASUAL,
  PARTY_DEFAULT_TIMEOUT_MODE,
  PARTY_TIMEOUT_MS,
  PARTY_STATES,
  PARTY_ROLES,
  PARTY_COLLECTION,
} from '../data/party-config.js';

// Re-export config constants so callers can `import { PARTY_MAX_SIZE } from
// '.../party-tower-backend.js'` without a second import (mirrors clan-backend
// re-export pattern). All values are frozen at the data/ layer.
export {
  PARTY_MIN_SIZE,
  PARTY_MAX_SIZE,
  PARTY_NAME_MIN_LEN,
  PARTY_NAME_MAX_LEN,
  PARTY_TIMEOUT_MS_COMPETITIVE,
  PARTY_TIMEOUT_MS_STANDARD,
  PARTY_TIMEOUT_MS_CASUAL,
  PARTY_DEFAULT_TIMEOUT_MODE,
  PARTY_TIMEOUT_MS,
  PARTY_STATES,
  PARTY_ROLES,
  PARTY_COLLECTION,
};

/** Owner / member role tags — string literals matching PARTY_ROLES enum. */
export const PARTY_ROLE_OWNER = 'owner';
export const PARTY_ROLE_MEMBER = 'member';

/** State string literals matching PARTY_STATES enum. */
export const PARTY_STATE_PENDING = 'pending';
export const PARTY_STATE_ACTIVE = 'active';
export const PARTY_STATE_COMPLETED = 'completed';
export const PARTY_STATE_ABANDONED = 'abandoned';

/** Frozen registry of CRUD-result `reason` strings (machine-readable). */
export const PARTY_RESULT_REASONS = Object.freeze({
  NO_SDK: 'no-sdk',
  NOT_FOUND: 'not-found',
  ALREADY_MEMBER: 'already-member',
  NOT_A_MEMBER: 'not-a-member',
  PARTY_FULL: 'party-full',
  PARTY_TOO_SMALL: 'party-too-small',
  OWNER_CANNOT_LEAVE: 'owner-cannot-leave-without-transfer',
  NOT_OWNER: 'not-owner',
  TARGET_NOT_MEMBER: 'target-not-member',
  INVALID_NAME: 'invalid-name',
  INVALID_INPUT: 'invalid-input',
  INVALID_MODE: 'invalid-mode',
  INVALID_STATE: 'invalid-state',
  NOT_CURRENT_TURN: 'not-current-turn',
  TURN_NOT_EXPIRED: 'turn-not-expired',
  ALREADY_STARTED: 'already-started',
  EXCEPTION: 'exception',
});

// ──────────────────────────────────────────────────────────────────────────
// Mock store — used when Firestore SDK isn't initialized. Mirrors the
// T3.02 / T3.07 backend pattern: tests + offline-fallback both work against
// the same in-memory state. Live Firestore wiring deferred to T3.10.1.
// ──────────────────────────────────────────────────────────────────────────

/**
 * In-memory party store (Map<partyId, partyDoc>). Used by all CRUD operations
 * when `getDb()` returns null (Firestore SDK absent). Cleared by
 * `_resetMockPartyStore` between tests for deterministic asserts.
 */
const _mockPartyStore = new Map();

/** Reset the mock party store. Test-only — never call from production. */
export function _resetMockPartyStore() {
  try { _mockPartyStore.clear(); } catch (_e) { /* swallow */ }
}

/** Snapshot of the mock store keyed by partyId (for test asserts). */
export function _getMockPartyStoreForTest() {
  const out = {};
  try {
    for (const [k, v] of _mockPartyStore.entries()) {
      // deep-clone the doc so tests can't mutate internal state
      out[k] = JSON.parse(JSON.stringify(v));
    }
  } catch (_e) { /* swallow */ }
  return out;
}

/** Pre-seed a party into the mock store (test fixtures). */
export function _seedMockParty(partyId, partyState) {
  if (!partyId || !partyState || typeof partyState !== 'object') return;
  try {
    _mockPartyStore.set(partyId, JSON.parse(JSON.stringify(partyState)));
  } catch (_e) { /* swallow */ }
}

/** Returns true when Firestore SDK is available; mock-mode otherwise. */
function _firestoreAvailable() {
  try { return !!getDb(); } catch (_e) { return false; }
}

// ──────────────────────────────────────────────────────────────────────────
// Pure-math helpers — unit-tested in isolation, <1ms each.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Validate party size against the hard cap 2–5. Server-enforced via Firestore
 * security rules; this is the client-side mirror. ADR-003 HARD CAP.
 *
 * @param {number} memberCount
 * @returns {{ok: boolean, reason?: string}}
 */
export function validatePartySize(memberCount) {
  if (typeof memberCount !== 'number' || !isFinite(memberCount) || memberCount < 0) {
    return { ok: false, reason: PARTY_RESULT_REASONS.INVALID_INPUT };
  }
  const n = Math.floor(memberCount);
  if (n < PARTY_MIN_SIZE) {
    return { ok: false, reason: PARTY_RESULT_REASONS.PARTY_TOO_SMALL };
  }
  if (n > PARTY_MAX_SIZE) {
    return { ok: false, reason: PARTY_RESULT_REASONS.PARTY_FULL };
  }
  return { ok: true };
}

/**
 * Validate party name — length 3–30, no leading/trailing whitespace, no
 * embedded newlines/tabs. Mirrors the clan-backend validation precedent.
 *
 * @param {string} name
 * @returns {{ok: boolean, reason?: string}}
 */
export function validatePartyName(name) {
  if (typeof name !== 'string') {
    return { ok: false, reason: PARTY_RESULT_REASONS.INVALID_NAME };
  }
  const trimmed = name.trim();
  if (trimmed.length !== name.length) {
    return { ok: false, reason: PARTY_RESULT_REASONS.INVALID_NAME };
  }
  if (trimmed.length < PARTY_NAME_MIN_LEN || trimmed.length > PARTY_NAME_MAX_LEN) {
    return { ok: false, reason: PARTY_RESULT_REASONS.INVALID_NAME };
  }
  if (/[\r\n\t]/.test(trimmed)) {
    return { ok: false, reason: PARTY_RESULT_REASONS.INVALID_NAME };
  }
  return { ok: true };
}

/**
 * Compute the timeout (ms) for the given mode. ESC-03 Q3: 4h / 24h / 7d.
 * Unknown mode → standard default (24h). Pure.
 *
 * @param {string} mode - 'competitive'|'standard'|'casual'
 * @returns {number}
 */
export function computeTurnTimeoutMs(mode) {
  if (typeof mode !== 'string') return PARTY_TIMEOUT_MS_STANDARD;
  const ms = PARTY_TIMEOUT_MS[mode];
  if (typeof ms === 'number' && isFinite(ms) && ms > 0) return ms;
  return PARTY_TIMEOUT_MS_STANDARD;
}

/**
 * Check whether the current turn deadline has expired. Returns false when
 * the party has no `currentTurnDeadline` (e.g. pending state).
 *
 * @param {object} partyState
 * @param {number} [now] - injected clock (defaults to Date.now())
 * @returns {boolean}
 */
export function computeTurnHasExpired(partyState, now) {
  if (!partyState || typeof partyState !== 'object') return false;
  const deadline = partyState.currentTurnDeadline;
  if (typeof deadline !== 'number' || !isFinite(deadline) || deadline <= 0) return false;
  const t = (typeof now === 'number' && isFinite(now)) ? now : Date.now();
  return t > deadline;
}

/**
 * Pick the playerId for the NEXT turn after `currentTurnIndex`. Round-robin
 * advancement that skips members where `isActive === false`. Returns the
 * playerId string, OR null when no active members exist (defensive — caller
 * should treat this as a terminal state).
 *
 * Edge cases:
 *   - Single active member → returns that member's id (turn loops back).
 *   - All members inactive → returns null.
 *   - Members list empty → returns null.
 *
 * @param {object} party
 * @returns {string|null}
 */
export function pickNextTurnPlayer(party) {
  if (!party || typeof party !== 'object') return null;
  const members = Array.isArray(party.members) ? party.members : [];
  if (members.length === 0) return null;
  const startIdx = (typeof party.turnIndex === 'number' && isFinite(party.turnIndex))
    ? Math.max(0, Math.floor(party.turnIndex)) % members.length
    : 0;
  // Walk forward up to N slots looking for the first active member.
  for (let i = 1; i <= members.length; i++) {
    const idx = (startIdx + i) % members.length;
    const m = members[idx];
    if (m && typeof m.playerId === 'string' && m.playerId.length > 0 && m.isActive !== false) {
      return m.playerId;
    }
  }
  return null;
}

/**
 * Convenience wrapper — returns the playerId of the next turn after the
 * current one. Alias for pickNextTurnPlayer with explicit semantics for
 * UI consumers (T3.11+) that prefer this naming.
 *
 * @param {object} party
 * @returns {string|null}
 */
export function computeNextTurnPlayerId(party) {
  return pickNextTurnPlayer(party);
}

/**
 * Can the given player join the given party? Checks not-already-member +
 * party-not-full (hard cap 5) + party in 'pending' state.
 * Pure.
 *
 * @param {string} playerId
 * @param {object} partyState
 * @returns {boolean}
 */
export function canPlayerJoinParty(playerId, partyState) {
  if (!playerId || typeof playerId !== 'string') return false;
  if (!partyState || typeof partyState !== 'object') return false;
  if (partyState.state !== PARTY_STATE_PENDING) return false;
  const members = Array.isArray(partyState.members) ? partyState.members : [];
  if (members.length >= PARTY_MAX_SIZE) return false;
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    if (m && m.playerId === playerId) return false;
  }
  return true;
}

/**
 * Can the given player start the run? Owner only + minSize 2 met + state is
 * 'pending'. Pure.
 *
 * @param {string} playerId
 * @param {object} partyState
 * @returns {boolean}
 */
export function canPlayerStartParty(playerId, partyState) {
  if (!playerId || typeof playerId !== 'string') return false;
  if (!partyState || typeof partyState !== 'object') return false;
  if (partyState.state !== PARTY_STATE_PENDING) return false;
  const members = Array.isArray(partyState.members) ? partyState.members : [];
  if (members.length < PARTY_MIN_SIZE) return false;
  // Player must be the owner. ownerId is the source of truth.
  if (partyState.ownerId !== playerId) return false;
  // And present as a member with role 'owner' (defensive — ownerId field
  // and members[].role must agree).
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    if (m && m.playerId === playerId && m.role === PARTY_ROLE_OWNER) return true;
  }
  return false;
}

/**
 * Can the given player end the current turn? Must be the current-turn
 * player AND state must be 'active'. Pure.
 *
 * @param {string} playerId
 * @param {object} partyState
 * @returns {boolean}
 */
export function canPlayerEndTurn(playerId, partyState) {
  if (!playerId || typeof playerId !== 'string') return false;
  if (!partyState || typeof partyState !== 'object') return false;
  if (partyState.state !== PARTY_STATE_ACTIVE) return false;
  const members = Array.isArray(partyState.members) ? partyState.members : [];
  if (members.length === 0) return false;
  const idx = (typeof partyState.turnIndex === 'number' && isFinite(partyState.turnIndex))
    ? Math.max(0, Math.floor(partyState.turnIndex)) % members.length
    : 0;
  const current = members[idx];
  return !!(current && current.playerId === playerId && current.isActive !== false);
}

/**
 * Return a UI-friendly progress summary — current floor + last action blurb.
 * Reads `sharedState.floorIndex` (defaults 0) and the most recent
 * `turnHistory[]` entry. Pure, defensive against malformed input.
 *
 * @param {object} party
 * @returns {{floorIndex: number, lastAction: object|null, turnCount: number}}
 */
export function computePartyProgress(party) {
  if (!party || typeof party !== 'object') {
    return { floorIndex: 0, lastAction: null, turnCount: 0 };
  }
  const shared = (party.sharedState && typeof party.sharedState === 'object') ? party.sharedState : {};
  const floorIndex = (typeof shared.floorIndex === 'number' && isFinite(shared.floorIndex))
    ? Math.max(0, Math.floor(shared.floorIndex)) : 0;
  const history = Array.isArray(party.turnHistory) ? party.turnHistory : [];
  const turnCount = history.length;
  let lastAction = null;
  if (turnCount > 0) {
    const last = history[turnCount - 1];
    if (last && typeof last === 'object') {
      // Surface a compact slice for the UI — no nested grid state.
      lastAction = {
        playerId: typeof last.playerId === 'string' ? last.playerId : null,
        endedAt: (typeof last.endedAt === 'number' && isFinite(last.endedAt)) ? last.endedAt : null,
        actions: Array.isArray(last.actions) ? last.actions.slice(0, 8) : [],
        deltas: (last.deltas && typeof last.deltas === 'object') ? last.deltas : {},
      };
    }
  }
  return { floorIndex, lastAction, turnCount };
}

// ──────────────────────────────────────────────────────────────────────────
// Internal helpers — doc construction + id generation.
// ──────────────────────────────────────────────────────────────────────────

/** Generate a stable, opaque, ~30-char party id. Mirrors clan-backend's
 *  _generateClanId pattern (owner-prefix + timestamp + random). */
function _generatePartyId(ownerId) {
  const ts = Date.now().toString(36);
  const rnd = Math.floor(Math.random() * 0xfffff).toString(36);
  const owner = String(ownerId || '').slice(0, 6);
  return `party-${ts}-${rnd}-${owner}`.slice(0, 64);
}

/** Build a fresh party document — pure, never reads/writes the mock store. */
function _buildFreshPartyDoc(partyId, ownerId, mode) {
  const now = Date.now();
  const resolvedMode = (typeof mode === 'string' && PARTY_TIMEOUT_MS[mode])
    ? mode : PARTY_DEFAULT_TIMEOUT_MODE;
  return {
    partyId,
    ownerId,
    members: [
      {
        playerId: ownerId,
        joinedAt: now,
        role: PARTY_ROLE_OWNER,
        isActive: true,
      },
    ],
    minSize: PARTY_MIN_SIZE,
    maxSize: PARTY_MAX_SIZE,
    state: PARTY_STATE_PENDING,
    turnIndex: 0,
    turnHistory: [],
    turnTimeoutMode: resolvedMode,
    turnTimeoutMs: computeTurnTimeoutMs(resolvedMode),
    currentTurnDeadline: 0,         // set on startParty
    sharedState: {
      // T3.11 wires actual values into these slots. T3.10 ships SCHEMA only —
      // sacred Tower-Hearts pool + TOWER_PACTS reads land in T3.11.
      towerHearts: 0,
      towerPacts: [],
      boardState: null,
      floorIndex: 0,
    },
    identityFxLog: [],              // T3.12 wires per-turn race FX entries
    createdAt: now,
    startedAt: null,
    completedAt: null,
    updatedAt: now,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// CRUD operations (async, defensive). Live SDK path deferred to T3.10.1;
// MVP uses the in-memory mock store + documents the Firestore shape that
// T3.10.1 will wire (see firebase-security-rules.txt + module header).
// ──────────────────────────────────────────────────────────────────────────

/**
 * Create a new party. The creator (`ownerId`) is auto-added as first member
 * with role 'owner'. Mode defaults to 'standard' per ESC-03 Q3.
 *
 * @param {string} ownerId
 * @param {string} [mode='standard']
 * @returns {Promise<{ok: boolean, partyId?: string, reason?: string}>}
 */
export async function createParty(ownerId, mode) {
  try {
    if (!ownerId || typeof ownerId !== 'string') {
      return { ok: false, reason: PARTY_RESULT_REASONS.INVALID_INPUT };
    }
    const resolvedMode = (typeof mode === 'string' && mode.length > 0) ? mode : PARTY_DEFAULT_TIMEOUT_MODE;
    if (!PARTY_TIMEOUT_MS[resolvedMode]) {
      return { ok: false, reason: PARTY_RESULT_REASONS.INVALID_MODE };
    }
    const partyId = _generatePartyId(ownerId);
    const doc = _buildFreshPartyDoc(partyId, ownerId, resolvedMode);

    if (_firestoreAvailable()) {
      // T3.10.1 — live Firestore wiring lands here. For T3.10 scope we mirror
      // the mock-store write so the API returns deterministic results while
      // the live SDK call catches up. Sacred game loop never reads from the
      // parties collection — pure additive surface.
      try { /* deferred — setDoc(getPartyDocRef(partyId), doc) lands in T3.10.1 */ }
      catch (_e) { /* swallow — fall through to mock */ }
    }

    _mockPartyStore.set(partyId, doc);
    return { ok: true, partyId };
  } catch (e) {
    try { log.warn('[party-tower-backend] createParty failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, reason: PARTY_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Read a party doc by id. Deep-clones so callers can't mutate the stored doc.
 *
 * @param {string} partyId
 * @returns {Promise<{ok: boolean, party?: object, reason?: string}>}
 */
export async function fetchParty(partyId) {
  try {
    if (!partyId || typeof partyId !== 'string') {
      return { ok: false, reason: PARTY_RESULT_REASONS.INVALID_INPUT };
    }
    if (_mockPartyStore.has(partyId)) {
      const doc = _mockPartyStore.get(partyId);
      return { ok: true, party: JSON.parse(JSON.stringify(doc)) };
    }
    if (!_firestoreAvailable()) {
      return { ok: false, reason: PARTY_RESULT_REASONS.NO_SDK };
    }
    return { ok: false, reason: PARTY_RESULT_REASONS.NOT_FOUND };
  } catch (e) {
    try { log.warn('[party-tower-backend] fetchParty failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, reason: PARTY_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Add a player to the party. Checks HARD CAP 5 first, then already-member,
 * then state === 'pending' (cannot join active/completed parties).
 *
 * @param {string} partyId
 * @param {string} playerId
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function joinParty(partyId, playerId) {
  try {
    if (!partyId || typeof partyId !== 'string' || !playerId || typeof playerId !== 'string') {
      return { ok: false, reason: PARTY_RESULT_REASONS.INVALID_INPUT };
    }
    const doc = _mockPartyStore.get(partyId);
    if (!doc) {
      if (!_firestoreAvailable()) return { ok: false, reason: PARTY_RESULT_REASONS.NO_SDK };
      return { ok: false, reason: PARTY_RESULT_REASONS.NOT_FOUND };
    }
    if (doc.state !== PARTY_STATE_PENDING) {
      return { ok: false, reason: PARTY_RESULT_REASONS.INVALID_STATE };
    }
    const members = Array.isArray(doc.members) ? doc.members : [];
    // Pre-check: party-full HARD CAP first (per ADR-003), then already-member.
    if (members.length >= PARTY_MAX_SIZE) {
      return { ok: false, reason: PARTY_RESULT_REASONS.PARTY_FULL };
    }
    for (let i = 0; i < members.length; i++) {
      if (members[i] && members[i].playerId === playerId) {
        return { ok: false, reason: PARTY_RESULT_REASONS.ALREADY_MEMBER };
      }
    }
    members.push({
      playerId,
      joinedAt: Date.now(),
      role: PARTY_ROLE_MEMBER,
      isActive: true,
    });
    doc.members = members;
    doc.updatedAt = Date.now();
    _mockPartyStore.set(partyId, doc);
    return { ok: true };
  } catch (e) {
    try { log.warn('[party-tower-backend] joinParty failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, reason: PARTY_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Remove a player from the party. Owner cannot leave without transferring
 * ownership first. When state is 'active' the leaving player is marked
 * `isActive: false` so the turn rotation skips them (mid-game leave) — they
 * are not spliced out (preserves turn history references).
 *
 * @param {string} partyId
 * @param {string} playerId
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function leaveParty(partyId, playerId) {
  try {
    if (!partyId || typeof partyId !== 'string' || !playerId || typeof playerId !== 'string') {
      return { ok: false, reason: PARTY_RESULT_REASONS.INVALID_INPUT };
    }
    const doc = _mockPartyStore.get(partyId);
    if (!doc) {
      if (!_firestoreAvailable()) return { ok: false, reason: PARTY_RESULT_REASONS.NO_SDK };
      return { ok: false, reason: PARTY_RESULT_REASONS.NOT_FOUND };
    }
    const members = Array.isArray(doc.members) ? doc.members : [];
    let foundIdx = -1;
    let foundRole = null;
    for (let i = 0; i < members.length; i++) {
      if (members[i] && members[i].playerId === playerId) {
        foundIdx = i;
        foundRole = members[i].role;
        break;
      }
    }
    if (foundIdx < 0) {
      return { ok: false, reason: PARTY_RESULT_REASONS.NOT_A_MEMBER };
    }
    if (foundRole === PARTY_ROLE_OWNER) {
      return { ok: false, reason: PARTY_RESULT_REASONS.OWNER_CANNOT_LEAVE };
    }
    if (doc.state === PARTY_STATE_PENDING) {
      // Pre-start: splice out cleanly.
      members.splice(foundIdx, 1);
    } else {
      // Mid-run: mark inactive — round-robin will skip. Preserves turnHistory
      // references that may point at this member by index.
      members[foundIdx].isActive = false;
      members[foundIdx].leftAt = Date.now();
    }
    doc.members = members;
    doc.updatedAt = Date.now();
    _mockPartyStore.set(partyId, doc);
    return { ok: true };
  } catch (e) {
    try { log.warn('[party-tower-backend] leaveParty failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, reason: PARTY_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Start the party run. Owner only + minSize 2 met + state === 'pending'.
 * Transitions: pending → active. Sets `turnIndex = 0`, `startedAt = now`,
 * and `currentTurnDeadline = now + turnTimeoutMs`.
 *
 * @param {string} partyId
 * @param {string} ownerId
 * @returns {Promise<{ok: boolean, reason?: string, currentTurnDeadline?: number, currentTurnPlayerId?: string}>}
 */
export async function startParty(partyId, ownerId) {
  try {
    if (!partyId || typeof partyId !== 'string' || !ownerId || typeof ownerId !== 'string') {
      return { ok: false, reason: PARTY_RESULT_REASONS.INVALID_INPUT };
    }
    const doc = _mockPartyStore.get(partyId);
    if (!doc) {
      if (!_firestoreAvailable()) return { ok: false, reason: PARTY_RESULT_REASONS.NO_SDK };
      return { ok: false, reason: PARTY_RESULT_REASONS.NOT_FOUND };
    }
    if (doc.state !== PARTY_STATE_PENDING) {
      return { ok: false, reason: PARTY_RESULT_REASONS.ALREADY_STARTED };
    }
    if (!canPlayerStartParty(ownerId, doc)) {
      // Disambiguate the reason — owner check vs minSize check vs state check.
      const members = Array.isArray(doc.members) ? doc.members : [];
      if (members.length < PARTY_MIN_SIZE) {
        return { ok: false, reason: PARTY_RESULT_REASONS.PARTY_TOO_SMALL };
      }
      return { ok: false, reason: PARTY_RESULT_REASONS.NOT_OWNER };
    }
    const now = Date.now();
    const timeoutMs = computeTurnTimeoutMs(doc.turnTimeoutMode || PARTY_DEFAULT_TIMEOUT_MODE);
    doc.state = PARTY_STATE_ACTIVE;
    doc.startedAt = now;
    doc.turnIndex = 0;
    doc.turnTimeoutMs = timeoutMs;
    doc.currentTurnDeadline = now + timeoutMs;
    doc.updatedAt = now;
    _mockPartyStore.set(partyId, doc);
    const members = Array.isArray(doc.members) ? doc.members : [];
    const firstPlayer = (members[0] && members[0].playerId) || null;
    return {
      ok: true,
      currentTurnDeadline: doc.currentTurnDeadline,
      currentTurnPlayerId: firstPlayer,
    };
  } catch (e) {
    try { log.warn('[party-tower-backend] startParty failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, reason: PARTY_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Current player ends their turn. Validates: state is 'active' + caller is
 * current-turn player. Records the turn to `turnHistory[]`, advances
 * `turnIndex` (round-robin, skipping inactive members), and resets
 * `currentTurnDeadline` to `now + turnTimeoutMs`.
 *
 * @param {string} partyId
 * @param {string} playerId
 * @param {object} [turnDeltas] - optional per-turn delta object (T3.11 wires shape)
 * @returns {Promise<{ok: boolean, reason?: string, nextTurnPlayerId?: string, currentTurnDeadline?: number}>}
 */
export async function endTurn(partyId, playerId, turnDeltas) {
  try {
    if (!partyId || typeof partyId !== 'string' || !playerId || typeof playerId !== 'string') {
      return { ok: false, reason: PARTY_RESULT_REASONS.INVALID_INPUT };
    }
    const doc = _mockPartyStore.get(partyId);
    if (!doc) {
      if (!_firestoreAvailable()) return { ok: false, reason: PARTY_RESULT_REASONS.NO_SDK };
      return { ok: false, reason: PARTY_RESULT_REASONS.NOT_FOUND };
    }
    if (doc.state !== PARTY_STATE_ACTIVE) {
      return { ok: false, reason: PARTY_RESULT_REASONS.INVALID_STATE };
    }
    if (!canPlayerEndTurn(playerId, doc)) {
      return { ok: false, reason: PARTY_RESULT_REASONS.NOT_CURRENT_TURN };
    }
    const now = Date.now();
    const history = Array.isArray(doc.turnHistory) ? doc.turnHistory : [];
    // Record turn (defensive — never let turnDeltas mutate sacred state).
    const safeDeltas = (turnDeltas && typeof turnDeltas === 'object') ? turnDeltas : {};
    history.push({
      playerId,
      startedAt: doc.currentTurnDeadline ? (doc.currentTurnDeadline - (doc.turnTimeoutMs || 0)) : now,
      endedAt: now,
      actions: Array.isArray(safeDeltas.actions) ? safeDeltas.actions.slice(0, 32) : [],
      deltas: (safeDeltas.deltas && typeof safeDeltas.deltas === 'object') ? safeDeltas.deltas : {},
    });
    doc.turnHistory = history;
    // Advance turnIndex round-robin to the next active member.
    const nextPlayerId = pickNextTurnPlayer(doc);
    if (nextPlayerId) {
      const members = Array.isArray(doc.members) ? doc.members : [];
      for (let i = 0; i < members.length; i++) {
        if (members[i] && members[i].playerId === nextPlayerId) {
          doc.turnIndex = i;
          break;
        }
      }
    }
    const timeoutMs = computeTurnTimeoutMs(doc.turnTimeoutMode || PARTY_DEFAULT_TIMEOUT_MODE);
    doc.turnTimeoutMs = timeoutMs;
    doc.currentTurnDeadline = now + timeoutMs;
    doc.updatedAt = now;
    _mockPartyStore.set(partyId, doc);
    return {
      ok: true,
      nextTurnPlayerId: nextPlayerId || null,
      currentTurnDeadline: doc.currentTurnDeadline,
    };
  } catch (e) {
    try { log.warn('[party-tower-backend] endTurn failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, reason: PARTY_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Transfer ownership from `fromId` to `toId`. Mirrors clan-backend pattern.
 * Both must be members; `fromId` must currently be owner. Demotes `fromId`
 * to member; promotes `toId`. Updates `ownerId` field.
 *
 * @param {string} partyId
 * @param {string} fromId
 * @param {string} toId
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function transferOwnership(partyId, fromId, toId) {
  try {
    if (!partyId || typeof partyId !== 'string'
        || !fromId || typeof fromId !== 'string'
        || !toId || typeof toId !== 'string') {
      return { ok: false, reason: PARTY_RESULT_REASONS.INVALID_INPUT };
    }
    if (fromId === toId) {
      return { ok: false, reason: PARTY_RESULT_REASONS.INVALID_INPUT };
    }
    const doc = _mockPartyStore.get(partyId);
    if (!doc) {
      if (!_firestoreAvailable()) return { ok: false, reason: PARTY_RESULT_REASONS.NO_SDK };
      return { ok: false, reason: PARTY_RESULT_REASONS.NOT_FOUND };
    }
    const members = Array.isArray(doc.members) ? doc.members : [];
    let fromIdx = -1, toIdx = -1;
    for (let i = 0; i < members.length; i++) {
      if (!members[i]) continue;
      if (members[i].playerId === fromId) fromIdx = i;
      if (members[i].playerId === toId) toIdx = i;
    }
    if (fromIdx < 0) {
      return { ok: false, reason: PARTY_RESULT_REASONS.NOT_A_MEMBER };
    }
    if (members[fromIdx].role !== PARTY_ROLE_OWNER) {
      return { ok: false, reason: PARTY_RESULT_REASONS.NOT_OWNER };
    }
    if (toIdx < 0) {
      return { ok: false, reason: PARTY_RESULT_REASONS.TARGET_NOT_MEMBER };
    }
    members[fromIdx].role = PARTY_ROLE_MEMBER;
    members[toIdx].role = PARTY_ROLE_OWNER;
    doc.members = members;
    doc.ownerId = toId;
    doc.updatedAt = Date.now();
    _mockPartyStore.set(partyId, doc);
    return { ok: true };
  } catch (e) {
    try { log.warn('[party-tower-backend] transferOwnership failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, reason: PARTY_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * List parties the given player is in. Sorted by `updatedAt` descending so
 * the most-recently-active party surfaces first (matches expected UI ordering).
 *
 * @param {string} playerId
 * @returns {Promise<{ok: boolean, parties?: Array<object>, reason?: string}>}
 */
export async function listPartiesForPlayer(playerId) {
  try {
    if (!playerId || typeof playerId !== 'string') {
      return { ok: false, reason: PARTY_RESULT_REASONS.INVALID_INPUT };
    }
    const parties = [];
    for (const [, doc] of _mockPartyStore.entries()) {
      if (!doc || !Array.isArray(doc.members)) continue;
      for (let i = 0; i < doc.members.length; i++) {
        if (doc.members[i] && doc.members[i].playerId === playerId) {
          parties.push(JSON.parse(JSON.stringify(doc)));
          break;
        }
      }
    }
    parties.sort((a, b) => (b.updatedAt | 0) - (a.updatedAt | 0));
    return { ok: true, parties };
  } catch (e) {
    try { log.warn('[party-tower-backend] listPartiesForPlayer failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, reason: PARTY_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Push notification stub — surfaces a "turn handoff" event from
 * `fromPlayerId` to `toPlayerId` for the given party. T3.10 MVP: logs +
 * returns `{ok:true, sent:false, reason:'fcm-not-wired'}`. T3.13 wires
 * real FCM dispatch (per spec §3.5 push-notif hook).
 *
 * @param {string} partyId
 * @param {string} fromPlayerId
 * @param {string} toPlayerId
 * @returns {Promise<{ok: boolean, sent: boolean, reason?: string}>}
 */
export async function notifyTurnHandoff(partyId, fromPlayerId, toPlayerId) {
  try {
    if (!partyId || typeof partyId !== 'string'
        || !fromPlayerId || typeof fromPlayerId !== 'string'
        || !toPlayerId || typeof toPlayerId !== 'string') {
      return { ok: false, sent: false, reason: PARTY_RESULT_REASONS.INVALID_INPUT };
    }
    try { log.debug && log.debug('[party-tower-backend] turn handoff:', partyId, fromPlayerId, '→', toPlayerId); }
    catch (_e) { /* swallow */ }
    // T3.13: dispatch FCM topic message to `parties/${partyId}/${toPlayerId}` here.
    return { ok: true, sent: false, reason: 'fcm-not-wired' };
  } catch (e) {
    try { log.warn('[party-tower-backend] notifyTurnHandoff failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, sent: false, reason: PARTY_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Client-side fallback — when a player opens a party that's mid-run, check
 * if the current turn deadline has expired. If so, mark the delinquent
 * player skipped (records a 'skipped' entry in turnHistory[]) and advance
 * `turnIndex` to the next active member. Returns `{ok:true, skipped:true,
 * ...}` when an auto-skip fired; `{ok:true, skipped:false}` when the turn
 * is still in-progress.
 *
 * Spec §3.1: client-side fallback so a long-absent current player doesn't
 * deadlock the party. T3.13 lands the Cloud Function server-side mirror.
 *
 * @param {string} partyId
 * @param {{now?: number}} [opts] - injected clock for tests
 * @returns {Promise<{ok: boolean, skipped: boolean, skippedPlayerId?: string, nextTurnPlayerId?: string, currentTurnDeadline?: number, reason?: string}>}
 */
export async function maybeAutoSkipExpiredTurn(partyId, opts) {
  try {
    if (!partyId || typeof partyId !== 'string') {
      return { ok: false, skipped: false, reason: PARTY_RESULT_REASONS.INVALID_INPUT };
    }
    const doc = _mockPartyStore.get(partyId);
    if (!doc) {
      if (!_firestoreAvailable()) return { ok: false, skipped: false, reason: PARTY_RESULT_REASONS.NO_SDK };
      return { ok: false, skipped: false, reason: PARTY_RESULT_REASONS.NOT_FOUND };
    }
    if (doc.state !== PARTY_STATE_ACTIVE) {
      return { ok: false, skipped: false, reason: PARTY_RESULT_REASONS.INVALID_STATE };
    }
    const now = (opts && typeof opts.now === 'number' && isFinite(opts.now)) ? opts.now : Date.now();
    if (!computeTurnHasExpired(doc, now)) {
      return { ok: true, skipped: false };
    }
    const members = Array.isArray(doc.members) ? doc.members : [];
    if (members.length === 0) {
      return { ok: false, skipped: false, reason: PARTY_RESULT_REASONS.NOT_FOUND };
    }
    const idx = (typeof doc.turnIndex === 'number' && isFinite(doc.turnIndex))
      ? Math.max(0, Math.floor(doc.turnIndex)) % members.length : 0;
    const skippedMember = members[idx];
    const skippedPlayerId = (skippedMember && typeof skippedMember.playerId === 'string')
      ? skippedMember.playerId : null;
    // Record a 'skipped' entry in turnHistory[].
    const history = Array.isArray(doc.turnHistory) ? doc.turnHistory : [];
    history.push({
      playerId: skippedPlayerId,
      startedAt: doc.currentTurnDeadline ? (doc.currentTurnDeadline - (doc.turnTimeoutMs || 0)) : now,
      endedAt: now,
      actions: [],
      deltas: {},
      skipped: true,
    });
    doc.turnHistory = history;
    // Advance turnIndex round-robin to the next active member.
    const nextPlayerId = pickNextTurnPlayer(doc);
    if (nextPlayerId) {
      for (let i = 0; i < members.length; i++) {
        if (members[i] && members[i].playerId === nextPlayerId) {
          doc.turnIndex = i;
          break;
        }
      }
    }
    const timeoutMs = computeTurnTimeoutMs(doc.turnTimeoutMode || PARTY_DEFAULT_TIMEOUT_MODE);
    doc.turnTimeoutMs = timeoutMs;
    doc.currentTurnDeadline = now + timeoutMs;
    doc.updatedAt = now;
    _mockPartyStore.set(partyId, doc);
    return {
      ok: true,
      skipped: true,
      skippedPlayerId,
      nextTurnPlayerId: nextPlayerId || null,
      currentTurnDeadline: doc.currentTurnDeadline,
    };
  } catch (e) {
    try { log.warn('[party-tower-backend] maybeAutoSkipExpiredTurn failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, skipped: false, reason: PARTY_RESULT_REASONS.EXCEPTION };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Note on Firestore live wiring (T3.10.1):
//
// When T3.10.1 lands the actual Firestore SDK calls, each CRUD op replaces
// its `_mockPartyStore.set(...)` line with a `setDoc(getPartyDocRef(partyId), doc)`
// call (or equivalent batch write for atomic operations). The mock store
// stays as the offline-fallback path. The `{ok, reason}` envelope is
// unchanged so callers (T3.11+ UI + this module's unit tests) don't change
// shape.
//
// Firebase security rule intent (firebase-security-rules.txt):
//   match /parties/{partyId} {
//     allow read:   if request.auth != null && isMember(request.auth.uid, resource.data);
//     allow create: if isAuthed() && validatePartyCreate(request.resource.data);
//     allow update: if isMember(request.auth.uid, resource.data) &&
//                      request.resource.data.members.size() <= 5 &&
//                      validatePartyUpdate(resource.data, request.resource.data);
//     allow delete: if false; // parties never deleted server-side
//   }
//
// Server-side enforcement of HARD CAP 2–5 (ADR-003) sits in
// `validatePartyCreate` + the `members.size() <= 5` predicate above.
// Turn-end requires `playerId === currentTurnPlayer(resource.data)`.
// ──────────────────────────────────────────────────────────────────────────
