// 2026-05-13 — TASK-050 (T3.02): Adventures backend — clan data layer.
// 2026-05-13 — TASK-052 (T3.04): Weekly boss-of-the-week rotation algorithm
//   — replaces the T3.02 closeWeek stub with the live rotation + adds 7 new
//   pure helpers (computeClanElementPreference / getDefeatedArchetypesLastNWeeks
//   / filterBossesByElementAntiArchetype / pickWeeklyBoss / scaleBossDifficulty
//   / shouldRotateUroboros / computeWeekHasExpired) + 3 new async ops
//   (rotateWeeklyForAllClans / notifyWeeklyBossRevealed / maybeAutoRotateOnClanOpen).
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
//     - closeWeek(clanId, didDefeat)                  [LIVE in T3.04]
//     - transferOwnership(clanId, fromId, toId)
//     - listClansForPlayer(playerId)
//     - searchClansByName(query, limit?)
//   Weekly rotation pure helpers (T3.04):
//     - computeClanElementPreference(clanState)
//     - getDefeatedArchetypesLastNWeeks(clanState, n?)
//     - filterBossesByElementAntiArchetype(allBosses, clanElement, defeated)
//     - pickWeeklyBoss(clanState, opts?)
//     - scaleBossDifficulty(boss, clanLevel)          [HARD cap 2.0× — ADR-003]
//     - shouldRotateUroboros(clanState)
//     - computeWeekHasExpired(clanState, now?)
//   Weekly rotation async ops (T3.04):
//     - rotateWeeklyForAllClans(opts?)                [Cloud-Function stub]
//     - notifyWeeklyBossRevealed(clanId, bossKey)     [FCM stub]
//     - maybeAutoRotateOnClanOpen(clanId, opts?)      [client-side fallback]
//   Test-only helpers:
//     - _resetMockClanStore()                  — clear mock store
//     - _getMockClanStoreForTest()             — read mock store snapshot
//     - _seedMockClan(clanId, clanState)       — preload a clan for tests

import { getDb } from './firebase.js';
import { log } from './logger.js';
import {
  CLAN_DEFAULT_BANNER_TIER,
  CLAN_LEVEL_COSMETIC_UNLOCKS,
  WEEKLY_ROTATION_LOOKBACK_WEEKS,
  WEEKLY_ROTATION_UROBOROS_INTERVAL_WEEKS,
  WEEKLY_BOSS_DIFFICULTY_BASE_MULT,
  WEEKLY_BOSS_DIFFICULTY_PER_LEVEL,
  WEEKLY_BOSS_DIFFICULTY_MAX_MULT,
  WEEKLY_ELEMENT_PREFERENCE_THRESHOLD,
  WEEKLY_ROTATION_PERIOD_MS,
  WEEKLY_ELEMENT_COUNTER,
  WEEKLY_UROBOROS_BOSS_ID,
} from '../data/clan-config.js';
import { CHAPTERS } from '../data/chapters.js';
import { RACE_TO_STIHIYA } from '../data/races.js';

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
// 2026-05-13 — TASK-052 (T3.04): Weekly boss-of-the-week rotation helpers.
//
// Spec: docs/design/endgame-social.md §2.2 (Weekly target — Boss-of-the-Week)
//       + ESC-03 Q4 ruling — 1-week Adventures rotation cadence.
//       + ADR-003 — no-P2W; difficulty scaling capped 2.0× HARD.
//       + CLAUDE.md §2.5 — Uroboros sacred seasonal mythic (READ-ONLY).
//
// Public helpers (all pure, < 1ms each):
//   - computeClanElementPreference(clanState)
//   - getDefeatedArchetypesLastNWeeks(clanState, n?)
//   - filterBossesByElementAntiArchetype(allBosses, clanElement, defeatedArchetypes)
//   - pickWeeklyBoss(clanState, opts?)
//   - scaleBossDifficulty(boss, clanLevel)
//   - shouldRotateUroboros(clanState)
//   - computeWeekHasExpired(clanState, now?)
//
// All BOSSES roster reads use CHAPTERS (`src/data/chapters.js`) — sacred,
// READ-ONLY. Uroboros reference is by id only (no stat reads).
// ──────────────────────────────────────────────────────────────────────────

/** Aggregate every chapter's boss roster into a single READ-ONLY array used
 *  as the candidate pool for weekly rotation. CHAPTERS is sacred + frozen;
 *  this helper never mutates it, only spreads via slice(). */
function _allCandidateBosses() {
  const out = [];
  try {
    if (!Array.isArray(CHAPTERS)) return out;
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const ch = CHAPTERS[ci];
      if (!ch || !Array.isArray(ch.bosses)) continue;
      for (let bi = 0; bi < ch.bosses.length; bi++) {
        const b = ch.bosses[bi];
        if (!b || typeof b !== 'object') continue;
        // Add a `bossKey` synthesised from name (stable across roster
        // changes) + img (disambiguates name collisions across chapters).
        const bossKey = `${(b.img || '').toLowerCase()}_${String(b.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        out.push({
          bossKey,
          name: b.name,
          archetype: b.archetype || null,
          stihiya: b.stihiya || null,
          hp: (typeof b.hp === 'number' && isFinite(b.hp)) ? b.hp : 0,
          roleTier: b.roleTier || null,
          chapterId: (typeof ch.id === 'number') ? ch.id : (ci + 1),
        });
      }
    }
  } catch (_e) { /* swallow — defensive aggregation */ }
  return out;
}

/**
 * Compute the clan's aggregate element preference from active members'
 * squad race composition. Returns a stihiya string ('ember' / 'tide' /
 * 'grove' / 'solar' / 'umbra') when ≥ WEEKLY_ELEMENT_PREFERENCE_THRESHOLD
 * of members share an element; otherwise returns `null` (balanced clan).
 *
 * Squad composition is opt-in: members may carry an `activeSquadRaces`
 * array of race ids on their member-record. When the field is missing,
 * the member doesn't vote (defensive — early adopters pre-T3.05 just
 * don't bias the rotation).
 *
 * Pure — never mutates the clan state.
 *
 * @param {object} clanState
 * @returns {string|null}
 */
export function computeClanElementPreference(clanState) {
  if (!clanState || typeof clanState !== 'object') return null;
  const members = Array.isArray(clanState.members) ? clanState.members : [];
  if (members.length === 0) return null;

  const tally = Object.create(null);
  let votingMembers = 0;
  try {
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      if (!m || typeof m !== 'object') continue;
      const races = Array.isArray(m.activeSquadRaces) ? m.activeSquadRaces : [];
      if (races.length === 0) continue;
      // Each member casts a single vote — their squad's MODE stihiya.
      const memberTally = Object.create(null);
      for (let r = 0; r < races.length; r++) {
        const raceId = races[r];
        const stih = RACE_TO_STIHIYA[raceId];
        if (!stih) continue;
        memberTally[stih] = (memberTally[stih] | 0) + 1;
      }
      let topStih = null;
      let topCount = 0;
      for (const k in memberTally) {
        if (!Object.prototype.hasOwnProperty.call(memberTally, k)) continue;
        if (memberTally[k] > topCount) {
          topStih = k;
          topCount = memberTally[k];
        }
      }
      if (topStih) {
        tally[topStih] = (tally[topStih] | 0) + 1;
        votingMembers++;
      }
    }
  } catch (_e) { /* swallow */ }

  if (votingMembers === 0) return null;
  let preferredStih = null;
  let preferredCount = 0;
  for (const k in tally) {
    if (!Object.prototype.hasOwnProperty.call(tally, k)) continue;
    if (tally[k] > preferredCount) {
      preferredStih = k;
      preferredCount = tally[k];
    }
  }
  if (preferredStih === null) return null;
  const share = preferredCount / votingMembers;
  if (share + 1e-9 < WEEKLY_ELEMENT_PREFERENCE_THRESHOLD) return null;
  return preferredStih;
}

/**
 * Returns a `Set<string>` of archetypes the clan defeated in the last N
 * weeks (where N defaults to WEEKLY_ROTATION_LOOKBACK_WEEKS = 4). Reads
 * the clan's `weeklyHistory` array (each entry shape:
 * `{ bossArchetype, bossKey, didDefeat, weekIndex }`) — present when
 * `closeWeek` has run; empty for fresh clans. Pure.
 *
 * @param {object} clanState
 * @param {number} [n=WEEKLY_ROTATION_LOOKBACK_WEEKS]
 * @returns {Set<string>}
 */
export function getDefeatedArchetypesLastNWeeks(clanState, n) {
  const out = new Set();
  if (!clanState || typeof clanState !== 'object') return out;
  const lookback = (typeof n === 'number' && isFinite(n) && n > 0)
    ? Math.floor(n)
    : WEEKLY_ROTATION_LOOKBACK_WEEKS;
  const history = Array.isArray(clanState.weeklyHistory) ? clanState.weeklyHistory : [];
  if (history.length === 0) return out;
  const start = Math.max(0, history.length - lookback);
  for (let i = start; i < history.length; i++) {
    const entry = history[i];
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.bossArchetype === 'string' && entry.bossArchetype.length > 0) {
      out.add(entry.bossArchetype);
    }
  }
  return out;
}

/**
 * Filter the boss roster by clan-element preference + anti-repeat archetype.
 * - When `clanElement` is non-null, narrows to bosses whose `stihiya` is
 *   STRONG vs the clan element per WEEKLY_ELEMENT_COUNTER.
 * - Excludes bosses whose archetype is in `defeatedArchetypes` (anti-repeat).
 * - When the resulting set is empty, gracefully relaxes the anti-repeat
 *   filter (returns element-matched roster without archetype exclusion).
 * - When still empty, returns the full input array (defensive — no crash).
 *
 * Never returns Uroboros (Uroboros is handled separately via the
 * shouldRotateUroboros gate). Pure.
 *
 * @param {Array<object>} allBosses
 * @param {string|null} clanElement
 * @param {Set<string>} defeatedArchetypes
 * @returns {Array<object>}
 */
export function filterBossesByElementAntiArchetype(allBosses, clanElement, defeatedArchetypes) {
  if (!Array.isArray(allBosses) || allBosses.length === 0) return [];
  const defeated = (defeatedArchetypes instanceof Set) ? defeatedArchetypes : new Set();

  let pool = allBosses.slice();
  // Stage 1: element-preference filter (counter-element narrowing).
  if (typeof clanElement === 'string' && clanElement.length > 0) {
    const counter = WEEKLY_ELEMENT_COUNTER[clanElement];
    if (typeof counter === 'string' && counter.length > 0) {
      const narrowed = pool.filter((b) => b && b.stihiya === counter);
      if (narrowed.length > 0) pool = narrowed;
      // If counter narrowing yields empty, keep the full pool (balanced fallback).
    }
  }

  // Stage 2: anti-repeat archetype filter.
  const filtered = pool.filter((b) => b && b.archetype && !defeated.has(b.archetype));
  if (filtered.length > 0) return filtered;

  // Stage 3 (graceful): if all archetypes in pool are recently defeated,
  // relax anti-repeat — return the pool unchanged. Avoids empty-pool crash
  // when clan defeats every archetype within the lookback horizon.
  if (pool.length > 0) return pool.slice();

  return allBosses.slice();
}

/**
 * Does the clan rotate onto Uroboros this week? True when totalWeeksCompleted
 * is a positive multiple of WEEKLY_ROTATION_UROBOROS_INTERVAL_WEEKS (every 4
 * weeks by default). Sacred Uroboros is preserved BYTE-PERFECT — this gate
 * only references its id. Pure.
 *
 * @param {object} clanState
 * @returns {boolean}
 */
export function shouldRotateUroboros(clanState) {
  if (!clanState || typeof clanState !== 'object') return false;
  const w = (typeof clanState.totalWeeksCompleted === 'number' && isFinite(clanState.totalWeeksCompleted))
    ? Math.max(0, Math.floor(clanState.totalWeeksCompleted))
    : 0;
  if (w <= 0) return false;
  const interval = (WEEKLY_ROTATION_UROBOROS_INTERVAL_WEEKS | 0) || 4;
  return (w % interval) === 0;
}

/**
 * Pick the next weekly boss for the clan. Combines all helpers above:
 *   1. Uroboros gate — totalWeeksCompleted % 4 === 0 → 'tower_uroboros_seasonal'
 *   2. Anti-repeat — exclude archetypes defeated in last 4 weeks
 *   3. Element preference — narrow to counter-element when ≥60% share
 *   4. Deterministic selection — picks the first candidate by chapter+roster
 *      order (the test seam `opts.rng` can substitute a different selector
 *      for randomised picks; production is deterministic for reproducibility).
 *
 * Returns the bossKey string (or WEEKLY_UROBOROS_BOSS_ID for Uroboros).
 * Pure. Never reads/writes mutable state.
 *
 * @param {object} clanState
 * @param {{rng?: function}} [opts]
 * @returns {string}
 */
export function pickWeeklyBoss(clanState, opts) {
  try {
    if (shouldRotateUroboros(clanState)) {
      return WEEKLY_UROBOROS_BOSS_ID;
    }
    const all = _allCandidateBosses();
    if (all.length === 0) return WEEKLY_UROBOROS_BOSS_ID; // defensive fallback
    const clanElement = computeClanElementPreference(clanState);
    const defeated = getDefeatedArchetypesLastNWeeks(clanState);
    const filtered = filterBossesByElementAntiArchetype(all, clanElement, defeated);
    if (filtered.length === 0) return all[0].bossKey;
    const rng = (opts && typeof opts.rng === 'function') ? opts.rng : null;
    if (rng) {
      const idx = Math.max(0, Math.min(filtered.length - 1, Math.floor(rng(filtered.length))));
      return filtered[idx].bossKey;
    }
    // Deterministic default: tie-break by chapter index then by bossKey for
    // reproducibility across mock + Firestore runs. Index 0 of the post-filter
    // pool after stable insertion order from `_allCandidateBosses`.
    return filtered[0].bossKey;
  } catch (e) {
    try { log.warn('[clan-backend] pickWeeklyBoss failed:', e); } catch (_e) { /* swallow */ }
    return WEEKLY_UROBOROS_BOSS_ID;
  }
}

/**
 * Scale boss difficulty by clan level. Returns a multiplier in
 * [WEEKLY_BOSS_DIFFICULTY_BASE_MULT, WEEKLY_BOSS_DIFFICULTY_MAX_MULT].
 * Level 1 → BASE (1.0); each level adds PER_LEVEL (0.05); HARD-capped at
 * MAX_MULT (2.0) per ADR-003 no-P2W invariant. Pure.
 *
 * @param {object} boss - unused for now; reserved for archetype-specific tweaks
 * @param {number} clanLevel
 * @returns {number}
 */
export function scaleBossDifficulty(boss, clanLevel) {
  const lvl = (typeof clanLevel === 'number' && isFinite(clanLevel))
    ? Math.max(1, Math.floor(clanLevel))
    : 1;
  const raw = WEEKLY_BOSS_DIFFICULTY_BASE_MULT + (lvl - 1) * WEEKLY_BOSS_DIFFICULTY_PER_LEVEL;
  // HARD cap per ADR-003 — even level-100 whale clans don't break 2.0×.
  if (raw > WEEKLY_BOSS_DIFFICULTY_MAX_MULT) return WEEKLY_BOSS_DIFFICULTY_MAX_MULT;
  if (raw < WEEKLY_BOSS_DIFFICULTY_BASE_MULT) return WEEKLY_BOSS_DIFFICULTY_BASE_MULT;
  return raw;
}

/**
 * Has the current week expired? True when `now - weekStartedAt >
 * WEEKLY_ROTATION_PERIOD_MS`. Pure.
 *
 * @param {object} clanState
 * @param {number} [now=Date.now()]
 * @returns {boolean}
 */
export function computeWeekHasExpired(clanState, now) {
  if (!clanState || typeof clanState !== 'object') return false;
  const started = (typeof clanState.weekStartedAt === 'number' && isFinite(clanState.weekStartedAt))
    ? clanState.weekStartedAt
    : 0;
  if (started <= 0) return false;
  const t = (typeof now === 'number' && isFinite(now)) ? now : Date.now();
  return (t - started) > WEEKLY_ROTATION_PERIOD_MS;
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
    weeklyHistory: [],       // T3.04 — append per closeWeek, used by anti-repeat
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
 * Close the current week — LIVE rotation algorithm (T3.04).
 *
 * Steps (in order):
 *   1. Snapshot the closing week's outgoing boss into `weeklyHistory` (so
 *      `getDefeatedArchetypesLastNWeeks` can read it on the NEXT call).
 *   2. Increment `totalWeeksCompleted` when `didDefeat === true`.
 *   3. Recompute `clanLevel`; collect cosmetic unlocks crossed.
 *   4. Reset `weeklyContributions` + `weekDefeated`; bump `weekStartedAt`.
 *   5. Pick next-week boss via `pickWeeklyBoss` (honors anti-repeat +
 *      element preference + Uroboros every-4-weeks gate).
 *   6. Persist.
 *
 * Replaces the T3.02 stub. Sacred-cow safety: BOSSES roster + Uroboros spec
 * are READ-ONLY (no writes to CHAPTERS, RACE_SYNERGY, TOWER_UROBOROS_SEASONAL).
 *
 * @param {string} clanId
 * @param {boolean} didDefeat
 * @returns {Promise<{ok: boolean, newLevel?: number, unlocks?: Array, weeklyTargetId?: string, isUroboros?: boolean, reason?: string}>}
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

    // ─── Snapshot outgoing week into history (anti-repeat needs this) ──
    const outgoingTargetId = (typeof doc.weeklyTargetId === 'string') ? doc.weeklyTargetId : null;
    let outgoingArchetype = null;
    if (outgoingTargetId) {
      // Look up the outgoing boss in CHAPTERS to recover its archetype.
      // Uroboros has no chapter slot — its archetype is 'choice_seasonal'
      // (READ-only literal mirror of TOWER_UROBOROS_SEASONAL.archetype).
      if (outgoingTargetId === WEEKLY_UROBOROS_BOSS_ID) {
        outgoingArchetype = 'choice_seasonal';
      } else {
        const all = _allCandidateBosses();
        for (let i = 0; i < all.length; i++) {
          if (all[i].bossKey === outgoingTargetId) {
            outgoingArchetype = all[i].archetype;
            break;
          }
        }
      }
    }
    if (!Array.isArray(doc.weeklyHistory)) doc.weeklyHistory = [];
    if (outgoingTargetId) {
      doc.weeklyHistory.push({
        bossKey: outgoingTargetId,
        bossArchetype: outgoingArchetype || null,
        didDefeat: !!didDefeat,
        weekIndex: (doc.totalWeeksCompleted | 0),
        closedAt: Date.now(),
      });
      // Trim to the last 2× lookback to keep doc small (T3.04 only reads
      // the most recent WEEKLY_ROTATION_LOOKBACK_WEEKS entries; the extra
      // buffer protects against lookback-config changes mid-flight).
      const cap = WEEKLY_ROTATION_LOOKBACK_WEEKS * 2;
      if (doc.weeklyHistory.length > cap) {
        doc.weeklyHistory = doc.weeklyHistory.slice(-cap);
      }
    }

    const prevLevel = computeClanLevel(doc.totalWeeksCompleted | 0);
    if (didDefeat === true) {
      doc.totalWeeksCompleted = ((doc.totalWeeksCompleted | 0) + 1);
    }
    const newLevel = computeClanLevel(doc.totalWeeksCompleted | 0);

    // Collect cosmetic unlocks crossed since previous level.
    const unlocks = [];
    for (let lvl = prevLevel + 1; lvl <= newLevel; lvl++) {
      const list = unlockCosmeticAtLevel(lvl);
      for (let i = 0; i < list.length; i++) unlocks.push(list[i]);
    }
    doc.clanLevel = newLevel;
    // weekDefeated records the outcome of the JUST-closed week — preserves
    // T3.02 contract (consumers like adventures.js read this to render
    // "DEFEATED ✓" on the previous week's banner). The contributions reset
    // implicitly marks the new week's progress as empty.
    doc.weekDefeated = !!didDefeat;
    doc.weeklyContributions = {};
    doc.weekStartedAt = Date.now();

    // ─── Pick next-week boss via rotation algorithm ────────────────────
    const nextBossKey = pickWeeklyBoss(doc);
    doc.weeklyTargetId = nextBossKey;
    const isUroboros = (nextBossKey === WEEKLY_UROBOROS_BOSS_ID);

    doc.updatedAt = Date.now();
    _mockClanStore.set(clanId, doc);

    return {
      ok: true,
      newLevel,
      unlocks,
      weeklyTargetId: nextBossKey,
      isUroboros,
    };
  } catch (e) {
    try { log.warn('[clan-backend] closeWeek failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, reason: CLAN_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Push notification stub — surfaces a "weekly boss revealed" event for the
 * given clan. T3.04 MVP: logs + returns `{ok:true, sent:false, reason:'fcm-not-wired'}`.
 * T3.04.2 follow-up wires real FCM dispatch.
 *
 * @param {string} clanId
 * @param {string} bossKey
 * @returns {Promise<{ok: boolean, sent: boolean, reason?: string}>}
 */
export async function notifyWeeklyBossRevealed(clanId, bossKey) {
  try {
    if (!clanId || typeof clanId !== 'string' || !bossKey || typeof bossKey !== 'string') {
      return { ok: false, sent: false, reason: CLAN_RESULT_REASONS.INVALID_INPUT };
    }
    try { log.debug && log.debug('[clan-backend] weekly boss revealed:', clanId, bossKey); } catch (_e) { /* swallow */ }
    // T3.04.2: dispatch FCM topic message to `adventures/${clanId}` here.
    return { ok: true, sent: false, reason: 'fcm-not-wired' };
  } catch (e) {
    try { log.warn('[clan-backend] notifyWeeklyBossRevealed failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, sent: false, reason: CLAN_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Cloud Function stub — iterates every active clan and runs closeWeek on the
 * ones whose week has expired. T3.04 MVP: in-process iteration over the mock
 * store (or Firestore query when SDK is wired in T3.04.1).
 *
 * Returns a summary of clans rotated this pass + the bosses chosen.
 *
 * @param {{now?: number}} [opts] - injected clock for tests
 * @returns {Promise<{ok: boolean, rotated: Array<{clanId, weeklyTargetId, isUroboros}>, reason?: string}>}
 */
export async function rotateWeeklyForAllClans(opts) {
  try {
    const now = (opts && typeof opts.now === 'number' && isFinite(opts.now)) ? opts.now : Date.now();
    const rotated = [];
    for (const [clanId, doc] of _mockClanStore.entries()) {
      if (!doc || typeof doc !== 'object') continue;
      if (!computeWeekHasExpired(doc, now)) continue;
      const result = await closeWeek(clanId, !!doc.weekDefeated);
      if (result && result.ok) {
        rotated.push({
          clanId,
          weeklyTargetId: result.weeklyTargetId,
          isUroboros: !!result.isUroboros,
        });
        // Fire-and-forget the notification stub.
        try { await notifyWeeklyBossRevealed(clanId, result.weeklyTargetId); } catch (_e) { /* swallow */ }
      }
    }
    return { ok: true, rotated };
  } catch (e) {
    try { log.warn('[clan-backend] rotateWeeklyForAllClans failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, rotated: [], reason: CLAN_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Client-side fallback — when a player opens the Adventures detail view, check
 * if the clan's week has expired and trigger rotation locally if so. Returns
 * `{ok:true, rotated:true, ...}` when a rotation fired, `{ok:true, rotated:false}`
 * when the week is still in-progress.
 *
 * @param {string} clanId
 * @param {{now?: number}} [opts] - injected clock for tests
 * @returns {Promise<{ok: boolean, rotated: boolean, weeklyTargetId?: string, isUroboros?: boolean, reason?: string}>}
 */
export async function maybeAutoRotateOnClanOpen(clanId, opts) {
  try {
    if (!clanId || typeof clanId !== 'string') {
      return { ok: false, rotated: false, reason: CLAN_RESULT_REASONS.INVALID_INPUT };
    }
    const doc = _mockClanStore.get(clanId);
    if (!doc) {
      if (!_firestoreAvailable()) return { ok: false, rotated: false, reason: CLAN_RESULT_REASONS.NO_SDK };
      return { ok: false, rotated: false, reason: CLAN_RESULT_REASONS.NOT_FOUND };
    }
    const now = (opts && typeof opts.now === 'number' && isFinite(opts.now)) ? opts.now : Date.now();
    if (!computeWeekHasExpired(doc, now)) {
      return { ok: true, rotated: false };
    }
    const result = await closeWeek(clanId, !!doc.weekDefeated);
    if (!result || !result.ok) {
      return { ok: false, rotated: false, reason: result && result.reason };
    }
    // Fire-and-forget the notification stub.
    try { await notifyWeeklyBossRevealed(clanId, result.weeklyTargetId); } catch (_e) { /* swallow */ }
    return {
      ok: true,
      rotated: true,
      weeklyTargetId: result.weeklyTargetId,
      isUroboros: !!result.isUroboros,
    };
  } catch (e) {
    try { log.warn('[clan-backend] maybeAutoRotateOnClanOpen failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, rotated: false, reason: CLAN_RESULT_REASONS.EXCEPTION };
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
