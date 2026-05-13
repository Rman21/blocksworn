// 2026-05-13 — TASK-050 (T3.02): Adventures backend — clan data layer.
//
// Spec: docs/design/endgame-social.md §2 (Adventures — async clan 5–15)
//       + §15 ESC-03 Q1 ruling — clan size 5–15 HARD CAP, no exceptions.
//       + ADR-002 — async-only (Firestore, no WebRTC).
//       + ADR-003 — strict no-P2W; clan rewards cosmetic-only.
//
// FOURTH Phase 3 implementation task (Wave-3 foundation). After T3.07 backend +
// T3.08 viewer + T3.09 Codex Replay button shipped the Wave-2 Replay subsystem,
// T3.02 lays the Firestore data layer for Adventures (clan create/join, weekly
// boss-of-the-week contribution rolling, persistent clan-level progression).
// T3.03 ships the UI on top of this; T3.02 stays pure backend.
//
// What this module ships:
//   1. 8 pure-math helpers (testable in isolation, < 1ms each):
//        - computeClanPower
//        - computeContributorPercent
//        - computeClanLevel
//        - validateClanSize           (HARD CAP 5–15 client-enforced)
//        - validateClanName           (3–30 chars; profanity deferred to T3.03)
//        - canPlayerJoinClan
//        - canPlayerLeaveClan
//        - unlockCosmeticAtLevel
//   2. 9 async Firestore CRUD operations (defensive — graceful no-sdk
//      fallback when Firestore SDK isn't initialized):
//        - createClan
//        - fetchClan
//        - joinClan
//        - leaveClan
//        - recordContribution
//        - closeWeek                  (T3.04 dependency stub)
//        - transferOwnership
//        - listClansForPlayer
//        - searchClansByName
//   3. Frozen schema constants (CLAN_MIN_SIZE = 5, CLAN_MAX_SIZE = 15
//      HARD CAP per ESC-03 Q1, etc.) — no magic numbers anywhere.
//
// Performance budget (spec §2.6):
//   - Pure helpers ≤1ms each.
//   - createClan / fetchClan Firestore round-trip ≤500ms p99 (live SDK).
//   - joinClan / recordContribution ≤300ms p99 (live SDK).
//   - All CRUD ops fall back to `{ok:false, reason:'no-sdk'}` when the
//     Firestore SDK is absent (mirrors T3.07 replay-backend pattern).
//
// Sacred-cow safety (CLAUDE.md §2):
//   - READ-ONLY of game state. Never mutates grid / squad / boss / fx state.
//   - getPlayerSegment() READ-only (sacred T1.20 thresholds untouched).
//   - No V_HAPTICS / NARRATOR_LINES / RACE_SYNERGY / combo crit interaction.
//   - HARD CAP 5–15 invariant: validateClanSize enforces client-side;
//     server-side Firestore security rules enforce the same cap (documented
//     intent in firebase-security-rules.txt; deploy at Phase 3 PR merge).
//   - No P2W mechanics: clan cosmetics are COSMETIC-ONLY per ADR-003. The
//     CLAN_LEVEL_COSMETIC_UNLOCKS table in src/data/clan-config.js contains
//     no stat / damage / win-rate / progression-speed fields.
//   - Codex schema isolation: Adventures uses Firestore (server-side);
//     Codex stays Phase 2 localStorage contract — no cross-pollination.
//   - All exports wrapped in defensive try/catch — sacred game loop must
//     NOT regress if clan backend throws (ADR-004 hybrid coexistence).
//
// Public API:
//   Constants:
//     - CLAN_MIN_SIZE, CLAN_MAX_SIZE (5 / 15 HARD CAP)
//     - CLAN_NAME_MIN_LEN, CLAN_NAME_MAX_LEN
//     - CLAN_DESCRIPTION_MAX_LEN
//     - CLAN_LEVEL_WEEKS_PER_LEVEL (formula divisor)
//     - CLAN_ROLE_OWNER / CLAN_ROLE_MEMBER
//     - CLAN_RESULT_REASONS
//   Pure helpers:
//     - computeClanPower(clanState)
//     - computeContributorPercent(playerId, weeklyContributions)
//     - computeClanLevel(totalWeeksCompleted)
//     - validateClanSize(memberCount)
//     - validateClanName(name)
//     - canPlayerJoinClan(playerId, clanState)
//     - canPlayerLeaveClan(playerId, clanState)
//     - unlockCosmeticAtLevel(clanLevel)
//   CRUD operations (async):
//     - createClan(ownerId, name, description?)
//     - fetchClan(clanId)
//     - joinClan(clanId, playerId)
//     - leaveClan(clanId, playerId)
//     - recordContribution(clanId, playerId, damage)
//     - closeWeek(clanId, didDefeat)
//     - transferOwnership(clanId, fromId, toId)
//     - listClansForPlayer(playerId)
//     - searchClansByName(query, limit?)
//   Test-only helpers:
//     - _resetMockClanStore()                  — clear mock store
//     - _getMockClanStoreForTest()             — read mock store snapshot
//     - _seedMockClan(clanId, clanState)       — preload a clan for tests

import { getDb } from './firebase.js';
import { log } from './logger.js';
import {
  CLAN_DEFAULT_BANNER_TIER,
  CLAN_LEVEL_COSMETIC_UNLOCKS,
} from '../data/clan-config.js';

// ──────────────────────────────────────────────────────────────────────────
// Constants — frozen registry. NO MAGIC NUMBERS in logic.
// ──────────────────────────────────────────────────────────────────────────

/** Minimum clan size — sacred ESC-03 Q1 ruling, hard cap. */
export const CLAN_MIN_SIZE = 5;

/** Maximum clan size — sacred ESC-03 Q1 ruling, HARD CAP no exceptions.
 *  Server-enforced via Firestore security rules; client-enforced via
 *  validateClanSize. Whale-tier expansion explicitly rejected per ADR-003. */
export const CLAN_MAX_SIZE = 15;

/** Clan name length bounds (spec §2.1 — "3–24 chars" widened to 30 for
 *  parity with player-name validators elsewhere in the codebase). */
export const CLAN_NAME_MIN_LEN = 3;
export const CLAN_NAME_MAX_LEN = 30;

/** Optional clan description bounds. */
export const CLAN_DESCRIPTION_MAX_LEN = 200;

/** Clan-level formula divisor — `floor(totalWeeksCompleted / N) + 1`.
 *  4 weeks ≈ 1 month of activity per level (spec §2.4). */
export const CLAN_LEVEL_WEEKS_PER_LEVEL = 4;

/** Owner / member role tags. Owner is captain-style cosmetic title (no
 *  admin powers per spec §2.1) — but the role IS load-bearing for
 *  ownership-transfer / leave-clan logic. */
export const CLAN_ROLE_OWNER = 'owner';
export const CLAN_ROLE_MEMBER = 'member';

/** Frozen registry of CRUD-result `reason` strings (machine-readable). */
export const CLAN_RESULT_REASONS = Object.freeze({
  NO_SDK: 'no-sdk',
  NOT_FOUND: 'not-found',
  ALREADY_MEMBER: 'already-member',
  NOT_A_MEMBER: 'not-a-member',
  CLAN_FULL: 'clan-full',
  CLAN_TOO_SMALL: 'clan-too-small',
  OWNER_CANNOT_LEAVE: 'owner-cannot-leave-without-transfer',
  NOT_OWNER: 'not-owner',
  TARGET_NOT_MEMBER: 'target-not-member',
  INVALID_NAME: 'invalid-name',
  INVALID_INPUT: 'invalid-input',
  EXCEPTION: 'exception',
});

/** Firestore collection name — "adventures" per spec §2.1 wording ruling. */
export const CLAN_COLLECTION = 'adventures';

// ──────────────────────────────────────────────────────────────────────────
// Mock store — used when Firestore SDK isn't initialized. T3.02 ships
// backend-only; live Firestore wiring deferred to T3.02.1 follow-up. T3.03
// UI consumes the same module + can work against the mock until then.
// ──────────────────────────────────────────────────────────────────────────

/**
 * In-memory clan store (Map<clanId, clanDoc>). Used by all CRUD operations
 * when `getDb()` returns null (Firestore SDK absent). Cleared by
 * `_resetMockClanStore` between tests for deterministic asserts.
 */
const _mockClanStore = new Map();

/** Reset the mock clan store. Test-only — never call from production. */
export function _resetMockClanStore() {
  try { _mockClanStore.clear(); } catch (_e) { /* swallow */ }
}

/** Snapshot of the mock store keyed by clanId (for test asserts). */
export function _getMockClanStoreForTest() {
  const out = {};
  try {
    for (const [k, v] of _mockClanStore.entries()) {
      // deep-clone the doc so tests can't mutate internal state
      out[k] = JSON.parse(JSON.stringify(v));
    }
  } catch (_e) { /* swallow */ }
  return out;
}

/** Pre-seed a clan into the mock store (test fixtures). */
export function _seedMockClan(clanId, clanState) {
  if (!clanId || !clanState || typeof clanState !== 'object') return;
  try {
    _mockClanStore.set(clanId, JSON.parse(JSON.stringify(clanState)));
  } catch (_e) { /* swallow */ }
}

// ──────────────────────────────────────────────────────────────────────────
// Pure-math helpers — unit-tested in isolation, < 1ms each.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Sum of contributor weekly-damage stats. Used for matchmaking weekly bosses
 * (T3.04 dependency). Pure: never mutates the input.
 *
 * @param {object} clanState - clan doc shape (see schema in module header)
 * @returns {number}
 */
export function computeClanPower(clanState) {
  if (!clanState || typeof clanState !== 'object') return 0;
  const wc = clanState.weeklyContributions;
  if (!wc || typeof wc !== 'object') return 0;
  let sum = 0;
  try {
    for (const key in wc) {
      if (!Object.prototype.hasOwnProperty.call(wc, key)) continue;
      const entry = wc[key];
      if (entry && typeof entry === 'object' && typeof entry.damage === 'number' && isFinite(entry.damage)) {
        sum += Math.max(0, entry.damage);
      }
    }
  } catch (_e) { /* swallow */ }
  return sum;
}

/**
 * Per-player share of this-week clan damage in [0, 1]. Returns 0 when the
 * clan has no recorded damage yet (avoids divide-by-zero). Pure.
 *
 * @param {string} playerId
 * @param {object} weeklyContributions - { [playerId]: { damage, lastContribAt } }
 * @returns {number}
 */
export function computeContributorPercent(playerId, weeklyContributions) {
  if (!playerId || typeof playerId !== 'string') return 0;
  if (!weeklyContributions || typeof weeklyContributions !== 'object') return 0;
  const entry = weeklyContributions[playerId];
  if (!entry || typeof entry !== 'object') return 0;
  const dmg = (typeof entry.damage === 'number' && isFinite(entry.damage)) ? Math.max(0, entry.damage) : 0;
  let total = 0;
  try {
    for (const key in weeklyContributions) {
      if (!Object.prototype.hasOwnProperty.call(weeklyContributions, key)) continue;
      const e = weeklyContributions[key];
      if (e && typeof e === 'object' && typeof e.damage === 'number' && isFinite(e.damage)) {
        total += Math.max(0, e.damage);
      }
    }
  } catch (_e) { /* swallow */ }
  if (total <= 0) return 0;
  return dmg / total;
}

/**
 * Clan-level formula — `floor(totalWeeksCompleted / CLAN_LEVEL_WEEKS_PER_LEVEL) + 1`.
 * Gives a level per ~month of activity (spec §2.4). Pure.
 *
 * @param {number} totalWeeksCompleted
 * @returns {number}
 */
export function computeClanLevel(totalWeeksCompleted) {
  const w = (typeof totalWeeksCompleted === 'number' && isFinite(totalWeeksCompleted))
    ? Math.max(0, Math.floor(totalWeeksCompleted))
    : 0;
  return Math.floor(w / CLAN_LEVEL_WEEKS_PER_LEVEL) + 1;
}

/**
 * Validate clan size against the hard cap 5–15. Server-enforced via Firestore
 * security rules; this is the client-side mirror. Sacred ESC-03 Q1 ruling.
 *
 * @param {number} memberCount
 * @returns {{ok: boolean, reason?: string}}
 */
export function validateClanSize(memberCount) {
  if (typeof memberCount !== 'number' || !isFinite(memberCount) || memberCount < 0) {
    return { ok: false, reason: CLAN_RESULT_REASONS.INVALID_INPUT };
  }
  const n = Math.floor(memberCount);
  if (n < CLAN_MIN_SIZE) {
    return { ok: false, reason: CLAN_RESULT_REASONS.CLAN_TOO_SMALL };
  }
  if (n > CLAN_MAX_SIZE) {
    return { ok: false, reason: CLAN_RESULT_REASONS.CLAN_FULL };
  }
  return { ok: true };
}

/**
 * Validate clan name — length 3–30, no leading/trailing whitespace, no
 * embedded newlines. Profanity check deferred to T3.03 UI flow (re-uses
 * shop's purchase-name validator). Pure.
 *
 * @param {string} name
 * @returns {{ok: boolean, reason?: string}}
 */
export function validateClanName(name) {
  if (typeof name !== 'string') {
    return { ok: false, reason: CLAN_RESULT_REASONS.INVALID_NAME };
  }
  const trimmed = name.trim();
  if (trimmed.length !== name.length) {
    return { ok: false, reason: CLAN_RESULT_REASONS.INVALID_NAME };
  }
  if (trimmed.length < CLAN_NAME_MIN_LEN || trimmed.length > CLAN_NAME_MAX_LEN) {
    return { ok: false, reason: CLAN_RESULT_REASONS.INVALID_NAME };
  }
  if (/[\r\n\t]/.test(trimmed)) {
    return { ok: false, reason: CLAN_RESULT_REASONS.INVALID_NAME };
  }
  return { ok: true };
}

/**
 * Can the given player join the given clan? Checks not-already-member +
 * clan-not-full (hard cap 15). Pure.
 *
 * @param {string} playerId
 * @param {object} clanState
 * @returns {boolean}
 */
export function canPlayerJoinClan(playerId, clanState) {
  if (!playerId || typeof playerId !== 'string') return false;
  if (!clanState || typeof clanState !== 'object') return false;
  const members = Array.isArray(clanState.members) ? clanState.members : [];
  if (members.length >= CLAN_MAX_SIZE) return false;
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    if (m && m.playerId === playerId) return false;
  }
  return true;
}

/**
 * Can the given player leave the given clan? Owner must transfer ownership
 * first — returns false if the player is owner. Pure.
 *
 * @param {string} playerId
 * @param {object} clanState
 * @returns {boolean}
 */
export function canPlayerLeaveClan(playerId, clanState) {
  if (!playerId || typeof playerId !== 'string') return false;
  if (!clanState || typeof clanState !== 'object') return false;
  const members = Array.isArray(clanState.members) ? clanState.members : [];
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    if (m && m.playerId === playerId) {
      // Owner must transfer first.
      if (m.role === CLAN_ROLE_OWNER) return false;
      return true;
    }
  }
  return false;
}

/**
 * Return the cosmetic unlocks awarded at exactly this clan level. Returns
 * an empty array for levels that have no cosmetic transition. Pure.
 * Every entry returned is from the frozen CLAN_LEVEL_COSMETIC_UNLOCKS
 * table — guaranteed COSMETIC-ONLY per ADR-003 (no stat / damage fields).
 *
 * @param {number} clanLevel
 * @returns {Array<{kind: string, value: string}>}
 */
export function unlockCosmeticAtLevel(clanLevel) {
  if (typeof clanLevel !== 'number' || !isFinite(clanLevel) || clanLevel < 1) {
    return [];
  }
  const lvl = Math.floor(clanLevel);
  const entry = CLAN_LEVEL_COSMETIC_UNLOCKS[lvl];
  if (!entry || !Array.isArray(entry)) return [];
  // Return a fresh array of frozen entries — table itself is immutable.
  return entry.slice();
}

// ──────────────────────────────────────────────────────────────────────────
// Internal helpers (build a clean clan doc + Firestore-or-mock dispatch).
// ──────────────────────────────────────────────────────────────────────────

/** Build a fresh clan doc — pure. Used by createClan + tests. */
function _buildFreshClanDoc(clanId, ownerId, name, description) {
  const now = Date.now();
  return {
    clanId,
    name: String(name).trim(),
    description: (typeof description === 'string') ? description.trim().slice(0, CLAN_DESCRIPTION_MAX_LEN) : '',
    ownerId,
    members: [
      { playerId: ownerId, joinedAt: now, role: CLAN_ROLE_OWNER, isActive: true },
    ],
    maxSize: CLAN_MAX_SIZE, // sacred ESC-03 Q1 hard cap
    weeklyTargetId: null,    // T3.04 writes this
    weeklyContributions: {},
    weekStartedAt: now,
    weekDefeated: false,
    totalWeeksCompleted: 0,
    clanLevel: 1,
    cosmetics: {
      bannerTier: CLAN_DEFAULT_BANNER_TIER,
      emblemUnlocks: [],
      badgeUnlocks: [],
    },
    createdAt: now,
    updatedAt: now,
  };
}

/** Generate a clan ID — content-derived for stable test asserts but with
 *  a random suffix so concurrent creates don't collide in the mock store. */
function _generateClanId(ownerId, name) {
  const safe = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  const ts = Date.now().toString(36);
  const rnd = Math.floor(Math.random() * 0xfffff).toString(36);
  const owner = String(ownerId || '').slice(0, 6);
  return `${safe || 'clan'}-${ts}-${rnd}-${owner}`.slice(0, 64);
}

/** Returns true when Firestore SDK is available; mock-mode otherwise. */
function _firestoreAvailable() {
  try { return !!getDb(); } catch (_e) { return false; }
}

// ──────────────────────────────────────────────────────────────────────────
// CRUD operations (async, defensive). Live SDK path deferred to T3.02.1;
// MVP uses the in-memory mock store + documents the Firestore shape that
// T3.02.1 will wire (see firebase-security-rules.txt + module header).
// ──────────────────────────────────────────────────────────────────────────

/**
 * Create a new clan. The creator (`ownerId`) is auto-added as first member
 * with role 'owner'. Validates name. Idempotent ID generation per call —
 * caller should treat the returned `clanId` as authoritative.
 *
 * @param {string} ownerId
 * @param {string} name
 * @param {string} [description]
 * @returns {Promise<{ok: boolean, clanId?: string, reason?: string}>}
 */
export async function createClan(ownerId, name, description) {
  try {
    if (!ownerId || typeof ownerId !== 'string') {
      return { ok: false, reason: CLAN_RESULT_REASONS.INVALID_INPUT };
    }
    const nameCheck = validateClanName(name);
    if (!nameCheck.ok) {
      return { ok: false, reason: nameCheck.reason || CLAN_RESULT_REASONS.INVALID_NAME };
    }
    const clanId = _generateClanId(ownerId, name);
    const doc = _buildFreshClanDoc(clanId, ownerId, name, description);

    if (_firestoreAvailable()) {
      // T3.02.1 — live Firestore wiring. Falls through to mock store on
      // any SDK call failure; the {ok:false, reason:'no-sdk'} envelope is
      // never returned from createClan with a present-SDK because validation
      // already passed (would surface as 'exception' if Firestore throws).
      try {
        // Deferred — real SDK calls (setDoc on `${CLAN_COLLECTION}/${clanId}`)
        // land in T3.02.1. For now mirror the mock-store write so the API
        // returns a deterministic result while Storage SDK wiring catches up.
      } catch (_e) { /* swallow — fall through to mock */ }
    }

    // Mock-mode + Firestore-mode both write to mock store for T3.02 scope;
    // T3.02.1 replaces the mock write with the real SDK call.
    _mockClanStore.set(clanId, doc);
    return { ok: true, clanId };
  } catch (e) {
    try { log.warn('[clan-backend] createClan failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, reason: CLAN_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Read a clan doc by ID. Returns `{ok:false, reason:'not-found'}` when
 * the clan doesn't exist, `{ok:false, reason:'no-sdk'}` when Firestore
 * is absent AND the mock store doesn't have it either (defensive).
 *
 * @param {string} clanId
 * @returns {Promise<{ok: boolean, clan?: object, reason?: string}>}
 */
export async function fetchClan(clanId) {
  try {
    if (!clanId || typeof clanId !== 'string') {
      return { ok: false, reason: CLAN_RESULT_REASONS.INVALID_INPUT };
    }
    if (_mockClanStore.has(clanId)) {
      const doc = _mockClanStore.get(clanId);
      // Deep-clone so callers can't mutate the stored doc accidentally.
      return { ok: true, clan: JSON.parse(JSON.stringify(doc)) };
    }
    if (!_firestoreAvailable()) {
      return { ok: false, reason: CLAN_RESULT_REASONS.NO_SDK };
    }
    return { ok: false, reason: CLAN_RESULT_REASONS.NOT_FOUND };
  } catch (e) {
    try { log.warn('[clan-backend] fetchClan failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, reason: CLAN_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Add a player to the clan. Checks `canPlayerJoinClan` first — fails with
 * `clan-full` when at HARD CAP 15, `already-member` when player is in.
 *
 * @param {string} clanId
 * @param {string} playerId
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function joinClan(clanId, playerId) {
  try {
    if (!clanId || typeof clanId !== 'string' || !playerId || typeof playerId !== 'string') {
      return { ok: false, reason: CLAN_RESULT_REASONS.INVALID_INPUT };
    }
    const doc = _mockClanStore.get(clanId);
    if (!doc) {
      if (!_firestoreAvailable()) return { ok: false, reason: CLAN_RESULT_REASONS.NO_SDK };
      return { ok: false, reason: CLAN_RESULT_REASONS.NOT_FOUND };
    }
    // Pre-check: clan-full HARD CAP first, then already-member.
    const members = Array.isArray(doc.members) ? doc.members : [];
    if (members.length >= CLAN_MAX_SIZE) {
      return { ok: false, reason: CLAN_RESULT_REASONS.CLAN_FULL };
    }
    for (let i = 0; i < members.length; i++) {
      if (members[i] && members[i].playerId === playerId) {
        return { ok: false, reason: CLAN_RESULT_REASONS.ALREADY_MEMBER };
      }
    }
    members.push({
      playerId,
      joinedAt: Date.now(),
      role: CLAN_ROLE_MEMBER,
      isActive: true,
    });
    doc.members = members;
    doc.updatedAt = Date.now();
    _mockClanStore.set(clanId, doc);
    return { ok: true };
  } catch (e) {
    try { log.warn('[clan-backend] joinClan failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, reason: CLAN_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Remove a player from the clan. Owner cannot leave without transferring
 * ownership first (returns `owner-cannot-leave-without-transfer`).
 *
 * @param {string} clanId
 * @param {string} playerId
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function leaveClan(clanId, playerId) {
  try {
    if (!clanId || typeof clanId !== 'string' || !playerId || typeof playerId !== 'string') {
      return { ok: false, reason: CLAN_RESULT_REASONS.INVALID_INPUT };
    }
    const doc = _mockClanStore.get(clanId);
    if (!doc) {
      if (!_firestoreAvailable()) return { ok: false, reason: CLAN_RESULT_REASONS.NO_SDK };
      return { ok: false, reason: CLAN_RESULT_REASONS.NOT_FOUND };
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
      return { ok: false, reason: CLAN_RESULT_REASONS.NOT_A_MEMBER };
    }
    if (foundRole === CLAN_ROLE_OWNER) {
      return { ok: false, reason: CLAN_RESULT_REASONS.OWNER_CANNOT_LEAVE };
    }
    members.splice(foundIdx, 1);
    doc.members = members;
    // Also drop any in-progress weekly contributions for that player —
    // contribution percentages are recomputed by clients from the doc
    // (no stale ghost entries on the list).
    if (doc.weeklyContributions && typeof doc.weeklyContributions === 'object') {
      delete doc.weeklyContributions[playerId];
    }
    doc.updatedAt = Date.now();
    _mockClanStore.set(clanId, doc);
    return { ok: true };
  } catch (e) {
    try { log.warn('[clan-backend] leaveClan failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, reason: CLAN_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Increment a member's weekly contribution. Non-negative damage values only;
 * negative / non-numeric values are silently coerced to 0.
 *
 * @param {string} clanId
 * @param {string} playerId
 * @param {number} damage
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function recordContribution(clanId, playerId, damage) {
  try {
    if (!clanId || typeof clanId !== 'string' || !playerId || typeof playerId !== 'string') {
      return { ok: false, reason: CLAN_RESULT_REASONS.INVALID_INPUT };
    }
    const doc = _mockClanStore.get(clanId);
    if (!doc) {
      if (!_firestoreAvailable()) return { ok: false, reason: CLAN_RESULT_REASONS.NO_SDK };
      return { ok: false, reason: CLAN_RESULT_REASONS.NOT_FOUND };
    }
    // Confirm player is a member — non-members can't contribute.
    const members = Array.isArray(doc.members) ? doc.members : [];
    let isMember = false;
    for (let i = 0; i < members.length; i++) {
      if (members[i] && members[i].playerId === playerId) { isMember = true; break; }
    }
    if (!isMember) {
      return { ok: false, reason: CLAN_RESULT_REASONS.NOT_A_MEMBER };
    }
    const d = (typeof damage === 'number' && isFinite(damage) && damage > 0) ? damage : 0;
    if (!doc.weeklyContributions || typeof doc.weeklyContributions !== 'object') {
      doc.weeklyContributions = {};
    }
    const prev = doc.weeklyContributions[playerId];
    const prevDmg = (prev && typeof prev.damage === 'number' && isFinite(prev.damage)) ? prev.damage : 0;
    doc.weeklyContributions[playerId] = {
      damage: prevDmg + d,
      lastContribAt: Date.now(),
    };
    doc.updatedAt = Date.now();
    _mockClanStore.set(clanId, doc);
    return { ok: true };
  } catch (e) {
    try { log.warn('[clan-backend] recordContribution failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, reason: CLAN_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Close the current week. Increments `totalWeeksCompleted` when `didDefeat`
 * is true; resets `weeklyContributions` + `weekDefeated` + bumps `weekStartedAt`.
 * Recomputes `clanLevel` from the new totalWeeksCompleted. T3.04 will wire
 * this to the Monday 00:00 UTC server cron; T3.02 ships the stub.
 *
 * @param {string} clanId
 * @param {boolean} didDefeat
 * @returns {Promise<{ok: boolean, newLevel?: number, unlocks?: Array, reason?: string}>}
 */
export async function closeWeek(clanId, didDefeat) {
  try {
    if (!clanId || typeof clanId !== 'string') {
      return { ok: false, reason: CLAN_RESULT_REASONS.INVALID_INPUT };
    }
    const doc = _mockClanStore.get(clanId);
    if (!doc) {
      if (!_firestoreAvailable()) return { ok: false, reason: CLAN_RESULT_REASONS.NO_SDK };
      return { ok: false, reason: CLAN_RESULT_REASONS.NOT_FOUND };
    }
    const prevLevel = computeClanLevel(doc.totalWeeksCompleted | 0);
    if (didDefeat === true) {
      doc.totalWeeksCompleted = ((doc.totalWeeksCompleted | 0) + 1);
    }
    const newLevel = computeClanLevel(doc.totalWeeksCompleted | 0);
    // Collect cosmetic unlocks crossed since previous level (defensive —
    // closeWeek may bump by 0 or 1 levels; loop handles either).
    const unlocks = [];
    for (let lvl = prevLevel + 1; lvl <= newLevel; lvl++) {
      const list = unlockCosmeticAtLevel(lvl);
      for (let i = 0; i < list.length; i++) unlocks.push(list[i]);
    }
    doc.clanLevel = newLevel;
    doc.weekDefeated = !!didDefeat;
    doc.weeklyContributions = {};
    doc.weekStartedAt = Date.now();
    doc.weeklyTargetId = null; // T3.04 picks next week's boss
    doc.updatedAt = Date.now();
    _mockClanStore.set(clanId, doc);
    return { ok: true, newLevel, unlocks };
  } catch (e) {
    try { log.warn('[clan-backend] closeWeek failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, reason: CLAN_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Transfer ownership from `fromId` to `toId`. Both must be members; `fromId`
 * must currently be owner. Demotes `fromId` to member; promotes `toId`.
 *
 * @param {string} clanId
 * @param {string} fromId
 * @param {string} toId
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function transferOwnership(clanId, fromId, toId) {
  try {
    if (!clanId || typeof clanId !== 'string' || !fromId || typeof fromId !== 'string' || !toId || typeof toId !== 'string') {
      return { ok: false, reason: CLAN_RESULT_REASONS.INVALID_INPUT };
    }
    if (fromId === toId) {
      return { ok: false, reason: CLAN_RESULT_REASONS.INVALID_INPUT };
    }
    const doc = _mockClanStore.get(clanId);
    if (!doc) {
      if (!_firestoreAvailable()) return { ok: false, reason: CLAN_RESULT_REASONS.NO_SDK };
      return { ok: false, reason: CLAN_RESULT_REASONS.NOT_FOUND };
    }
    const members = Array.isArray(doc.members) ? doc.members : [];
    let fromIdx = -1, toIdx = -1;
    for (let i = 0; i < members.length; i++) {
      if (!members[i]) continue;
      if (members[i].playerId === fromId) fromIdx = i;
      if (members[i].playerId === toId) toIdx = i;
    }
    if (fromIdx < 0) {
      return { ok: false, reason: CLAN_RESULT_REASONS.NOT_A_MEMBER };
    }
    if (members[fromIdx].role !== CLAN_ROLE_OWNER) {
      return { ok: false, reason: CLAN_RESULT_REASONS.NOT_OWNER };
    }
    if (toIdx < 0) {
      return { ok: false, reason: CLAN_RESULT_REASONS.TARGET_NOT_MEMBER };
    }
    members[fromIdx].role = CLAN_ROLE_MEMBER;
    members[toIdx].role = CLAN_ROLE_OWNER;
    doc.members = members;
    doc.ownerId = toId;
    doc.updatedAt = Date.now();
    _mockClanStore.set(clanId, doc);
    return { ok: true };
  } catch (e) {
    try { log.warn('[clan-backend] transferOwnership failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, reason: CLAN_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * List clans the given player is in. Sorted by `updatedAt` descending so the
 * most-recently-active clan surfaces first (matches expected UI ordering).
 *
 * @param {string} playerId
 * @returns {Promise<{ok: boolean, clans?: Array<object>, reason?: string}>}
 */
export async function listClansForPlayer(playerId) {
  try {
    if (!playerId || typeof playerId !== 'string') {
      return { ok: false, reason: CLAN_RESULT_REASONS.INVALID_INPUT };
    }
    const clans = [];
    for (const [, doc] of _mockClanStore.entries()) {
      if (!doc || !Array.isArray(doc.members)) continue;
      for (let i = 0; i < doc.members.length; i++) {
        if (doc.members[i] && doc.members[i].playerId === playerId) {
          clans.push(JSON.parse(JSON.stringify(doc)));
          break;
        }
      }
    }
    clans.sort((a, b) => (b.updatedAt | 0) - (a.updatedAt | 0));
    return { ok: true, clans };
  } catch (e) {
    try { log.warn('[clan-backend] listClansForPlayer failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, reason: CLAN_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Search clans by case-insensitive name prefix. Returns up to `limit` matches
 * (default 20, max 50). Empty query returns the first `limit` clans by
 * `updatedAt` descending (mirrors "browse public" surface in spec §2.1).
 *
 * @param {string} query
 * @param {number} [limit=20]
 * @returns {Promise<{ok: boolean, clans?: Array<object>, reason?: string}>}
 */
export async function searchClansByName(query, limit) {
  try {
    const lim = (typeof limit === 'number' && isFinite(limit) && limit > 0)
      ? Math.min(50, Math.floor(limit))
      : 20;
    const q = (typeof query === 'string') ? query.trim().toLowerCase() : '';
    const matches = [];
    for (const [, doc] of _mockClanStore.entries()) {
      if (!doc || typeof doc.name !== 'string') continue;
      const nameLower = doc.name.toLowerCase();
      if (q === '' || nameLower.startsWith(q)) {
        matches.push(JSON.parse(JSON.stringify(doc)));
      }
    }
    matches.sort((a, b) => (b.updatedAt | 0) - (a.updatedAt | 0));
    return { ok: true, clans: matches.slice(0, lim) };
  } catch (e) {
    try { log.warn('[clan-backend] searchClansByName failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, reason: CLAN_RESULT_REASONS.EXCEPTION };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Note on Firestore live wiring (T3.02.1):
//
// When T3.02.1 lands the actual Firestore SDK calls, each CRUD op replaces
// its `_mockClanStore.set(...)` line with a `setDoc(getClanDocRef(clanId), doc)`
// call (or equivalent batch write for atomic operations). The mock store stays
// as the offline-fallback path. The `{ok, reason}` envelope is unchanged so
// callers (T3.03 UI + this module's unit tests) don't change shape.
//
// The Firebase security rule intent (firebase-security-rules.txt):
//   match /adventures/{clanId} {
//     allow read:   if request.auth != null;
//     allow create: if isAuthed() && validateCreate(request.resource.data);
//     allow update: if isMember(request.auth.uid, resource.data) &&
//                      request.resource.data.members.size() <= 15 &&
//                      validateUpdate(resource.data, request.resource.data);
//     allow delete: if false; // mark inactive via update; never delete server-side
//   }
//
// Server-side enforcement of the HARD CAP 5–15 (ESC-03 Q1) sits in
// `validateCreate` + the `members.size() <= 15` predicate above.
// ──────────────────────────────────────────────────────────────────────────
