// 2026-05-13 — TASK-058 (T3.14): Tower seasonal backend.
//
// Spec: docs/design/endgame-social.md §6 (Tower seasonal infrastructure)
//       + §15 ESC-03 Q4 ruling — 13-week Tower + Battle Pass cadence.
//       + ADR-003 no-P2W — Battle Pass tier rewards cosmetic-only;
//         seasonal pacts additive (do not exceed mythic-tier strength).
//
// Sacred-cow safety (CLAUDE.md §2):
//   - Battle Pass formula `500 + (tier-1) × 150` BYTE-PERFECT — READ-only.
//   - TOWER_PACTS_BASE (30) + TOWER_PACTS_MYTHIC (15) BYTE-PERFECT —
//     READ-only via direct-import; seasonal pacts merge ADDITIVELY at
//     run-start without mutating the sacred registries.
//   - Uroboros boss stats / TTK / phase mechanics UNCHANGED — variant
//     rotation is cosmetic metadata layer (auraColor / narratorVariant /
//     displayName); core boss spec untouched.
//   - PURE PATH F2P-only leaderboard sacred — season wipes preserve the
//     F2P-only invariant; F2P players' ranks rotate within their own
//     leaderboard, never mixed with paying-tier ranks.
//   - GEM_PACKS ladder, First Purchase Bonus, Tower retry untouched.
//
// Public API:
//   Pure helpers:
//     - computeBattlePassTierXp(tier) — sacred formula READ-only
//     - computeBattlePassTotalXpForTier(tier) — cumulative XP for tier
//     - computeCurrentSeason(now, seasonStartMs) — returns { seasonId, weekIndex }
//     - computeWeekInSeason(now, seasonStartMs) — 1..13
//     - getActiveUroborosVariant(seasonId) — variant from rotation
//     - getActiveSeasonalPacts(seasonId) — returns [pactIds]
//     - getMergedPactRegistry(seasonId) — base + mythic + seasonal
//     - validateBattlePassTier(tier) — bounds check 1..50
//   Async ops (mock-mode + graceful no-sdk fallback):
//     - fetchSeasonState() — current season + week
//     - rotateToNextSeason(prevSeasonId) — increment season id
//
// Sibling to clan-backend.js + friend-graph-backend.js + party-tower-backend.js
// per established Phase 3 pattern.

import { log } from './logger.js';
import { TOWER_PACTS_BASE, TOWER_PACTS_MYTHIC } from '../data/tower.js';
import {
  TOWER_SEASON_WEEKS,
  TOWER_SEASON_DURATION_MS,
  ADVENTURES_ROTATION_WEEKS,
  BATTLE_PASS_DURATION_MS,
  BATTLE_PASS_BASE_XP,
  BATTLE_PASS_PER_TIER_XP,
  BATTLE_PASS_MAX_TIER,
  UROBOROS_VARIANTS,
  UROBOROS_VARIANT_ROTATION_PERIOD_SEASONS,
  SEASONAL_PACTS,
  SEASON_INITIAL_ID,
  SEASON_PRE_LAUNCH,
} from '../data/season-config.js';

// Re-export config so callers can single-import.
export {
  TOWER_SEASON_WEEKS,
  TOWER_SEASON_DURATION_MS,
  ADVENTURES_ROTATION_WEEKS,
  BATTLE_PASS_DURATION_MS,
  BATTLE_PASS_BASE_XP,
  BATTLE_PASS_PER_TIER_XP,
  BATTLE_PASS_MAX_TIER,
  UROBOROS_VARIANTS,
  UROBOROS_VARIANT_ROTATION_PERIOD_SEASONS,
  SEASONAL_PACTS,
  SEASON_INITIAL_ID,
  SEASON_PRE_LAUNCH,
};

// ─── Pure helpers — Battle Pass (sacred formula READ-only) ────────────────

/** Validate Battle Pass tier bounds. Returns `{ ok, reason }`. */
export function validateBattlePassTier(tier) {
  if (typeof tier !== 'number' || !Number.isFinite(tier) || Math.floor(tier) !== tier) {
    return { ok: false, reason: 'tier-must-be-integer' };
  }
  if (tier < 1) return { ok: false, reason: 'tier-below-minimum' };
  if (tier > BATTLE_PASS_MAX_TIER) return { ok: false, reason: 'tier-above-maximum' };
  return { ok: true };
}

/** Sacred Battle Pass XP formula READ-only:
 *  `xp_for_tier(N) = BATTLE_PASS_BASE_XP + (N - 1) × BATTLE_PASS_PER_TIER_XP`
 *  = `500 + (N - 1) × 150` per CLAUDE.md §2.4 sacred.
 *  Returns XP required to ADVANCE from tier (N-1) to tier N. */
export function computeBattlePassTierXp(tier) {
  const v = validateBattlePassTier(tier);
  if (!v.ok) return 0;
  return BATTLE_PASS_BASE_XP + (tier - 1) * BATTLE_PASS_PER_TIER_XP;
}

/** Cumulative XP from tier 1 → tier N. Sum of arithmetic series. */
export function computeBattlePassTotalXpForTier(tier) {
  const v = validateBattlePassTier(tier);
  if (!v.ok) return 0;
  // Sum_{k=1..N} (BASE + (k-1) × PER_TIER) = N×BASE + PER_TIER × N×(N-1)/2
  return tier * BATTLE_PASS_BASE_XP + BATTLE_PASS_PER_TIER_XP * tier * (tier - 1) / 2;
}

// ─── Pure helpers — Season state ─────────────────────────────────────────

/** Computes current season id + week index given a now timestamp and
 *  global season start (when season 1 began). Returns
 *  { seasonId, weekIndex } where weekIndex is 1..TOWER_SEASON_WEEKS. */
export function computeCurrentSeason(now, seasonStartMs) {
  if (typeof now !== 'number' || typeof seasonStartMs !== 'number') {
    return { seasonId: SEASON_PRE_LAUNCH, weekIndex: 0 };
  }
  if (now < seasonStartMs) {
    return { seasonId: SEASON_PRE_LAUNCH, weekIndex: 0 };
  }
  const elapsed = now - seasonStartMs;
  const seasonOffset = Math.floor(elapsed / TOWER_SEASON_DURATION_MS);
  const seasonId = SEASON_INITIAL_ID + seasonOffset;
  const weekInSeason = Math.floor((elapsed % TOWER_SEASON_DURATION_MS) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return { seasonId, weekIndex: weekInSeason };
}

/** Returns 1..TOWER_SEASON_WEEKS — current week within active season. */
export function computeWeekInSeason(now, seasonStartMs) {
  return computeCurrentSeason(now, seasonStartMs).weekIndex;
}

/** Returns the Uroboros variant active for a given season id. Rotates
 *  through UROBOROS_VARIANTS in order; wraps when exhausted. */
export function getActiveUroborosVariant(seasonId) {
  if (typeof seasonId !== 'number' || seasonId < SEASON_INITIAL_ID) {
    return UROBOROS_VARIANTS[0];
  }
  // seasonId 1 → variant index 0; seasonId 2 → 1; ... wrap
  const seasonsSinceFirst = (seasonId - SEASON_INITIAL_ID);
  const variantIdx = Math.floor(seasonsSinceFirst / UROBOROS_VARIANT_ROTATION_PERIOD_SEASONS) % UROBOROS_VARIANTS.length;
  return UROBOROS_VARIANTS[variantIdx];
}

/** Returns array of seasonal pact IDs active for the given seasonId.
 *  Filters SEASONAL_PACTS by `seasonId` field. */
export function getActiveSeasonalPacts(seasonId) {
  if (typeof seasonId !== 'number' || seasonId < SEASON_INITIAL_ID) return [];
  return Object.entries(SEASONAL_PACTS)
    .filter(([_id, pact]) => pact && pact.seasonId === seasonId)
    .map(([id]) => id);
}

/** Returns merged pact registry: sacred base (30) + sacred mythic (15)
 *  + active seasonal pacts. Sacred registries are NOT modified — the
 *  merged object is a NEW frozen container with sacred entries
 *  byte-perfect (same references). */
export function getMergedPactRegistry(seasonId) {
  const seasonalIds = getActiveSeasonalPacts(seasonId);
  const seasonalMap = {};
  for (const id of seasonalIds) {
    seasonalMap[id] = SEASONAL_PACTS[id];
  }
  return Object.freeze({
    ...TOWER_PACTS_BASE,
    ...TOWER_PACTS_MYTHIC,
    ...seasonalMap,
  });
}

// ─── Async ops (mock-mode in MVP; live Firestore deferred to T3.14.1) ────

// In-memory mock store for season state. Tests + offline-fallback share it.
const _mockSeasonState = {
  seasonId:      SEASON_INITIAL_ID,
  seasonStartMs: 0,        // set by rotateToNextSeason on first call
  uroborosVariantId: null,
};

/** Test helper: reset mock season state. */
export function _resetMockSeasonState() {
  _mockSeasonState.seasonId = SEASON_INITIAL_ID;
  _mockSeasonState.seasonStartMs = 0;
  _mockSeasonState.uroborosVariantId = null;
}

/** Fetch current season state. Returns { ok, seasonId, weekIndex,
 *  uroborosVariant, seasonalPactIds, reason? }. Defensive: graceful no-sdk
 *  fallback returns mock state. */
export async function fetchSeasonState(nowOverride) {
  try {
    const now = typeof nowOverride === 'number' ? nowOverride : Date.now();
    // If no season has started yet, return pre-launch sentinel state.
    if (_mockSeasonState.seasonStartMs === 0) {
      // Start the first season "now" (lazy init).
      _mockSeasonState.seasonStartMs = now;
    }
    const { seasonId, weekIndex } = computeCurrentSeason(now, _mockSeasonState.seasonStartMs);
    const uroborosVariant = getActiveUroborosVariant(seasonId);
    const seasonalPactIds = getActiveSeasonalPacts(seasonId);
    return {
      ok:              true,
      seasonId,
      weekIndex,
      uroborosVariant,
      seasonalPactIds,
      seasonStartMs:   _mockSeasonState.seasonStartMs,
    };
  } catch (e) {
    try { log.warn('[tower-season-backend] fetchSeasonState failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, reason: 'exception' };
  }
}

/** Rotate to next season — increments season id + resets seasonStartMs.
 *  Returns { ok, newSeasonId, newUroborosVariant, reason? }. */
export async function rotateToNextSeason(prevSeasonId) {
  try {
    if (typeof prevSeasonId !== 'number' || prevSeasonId < 0) {
      return { ok: false, reason: 'invalid-input' };
    }
    const newSeasonId = prevSeasonId + 1;
    _mockSeasonState.seasonId = newSeasonId;
    _mockSeasonState.seasonStartMs = Date.now();
    _mockSeasonState.uroborosVariantId = getActiveUroborosVariant(newSeasonId).id;
    return {
      ok:                  true,
      newSeasonId,
      newUroborosVariant:  getActiveUroborosVariant(newSeasonId),
      newSeasonStartMs:    _mockSeasonState.seasonStartMs,
    };
  } catch (e) {
    try { log.warn('[tower-season-backend] rotateToNextSeason failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, reason: 'exception' };
  }
}
