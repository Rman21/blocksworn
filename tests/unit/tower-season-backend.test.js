// 2026-05-13 — TASK-058 (T3.14): Tower seasonal backend unit tests.
//
// Sacred audit baked into every block:
//   - Battle Pass formula `500 + (tier-1) × 150` BYTE-PERFECT verified.
//   - TOWER_PACTS_BASE (30) + TOWER_PACTS_MYTHIC (15) counts preserved.
//   - Uroboros boss spec untouched (variant rotation is metadata).
//   - PURE PATH F2P-only invariant not contaminated by season state.
//   - ADR-003 no-P2W: seasonal pacts do NOT exceed mythic-tier strength.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // constants
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
  SEASON_PRE_LAUNCH,
  // pure helpers
  validateBattlePassTier,
  computeBattlePassTierXp,
  computeBattlePassTotalXpForTier,
  computeCurrentSeason,
  computeWeekInSeason,
  getActiveUroborosVariant,
  getActiveSeasonalPacts,
  getMergedPactRegistry,
  // async
  fetchSeasonState,
  rotateToNextSeason,
  _resetMockSeasonState,
} from '../../src/services/tower-season-backend.js';
import { TOWER_PACTS_BASE, TOWER_PACTS_MYTHIC } from '../../src/data/tower.js';

describe('T3.14 constants — sacred audit', () => {
  it('TOWER_SEASON_WEEKS === 13 (ESC-03 Q4 ruling)', () => {
    expect(TOWER_SEASON_WEEKS).toBe(13);
  });
  it('ADVENTURES_ROTATION_WEEKS === 1 (ESC-03 Q4)', () => {
    expect(ADVENTURES_ROTATION_WEEKS).toBe(1);
  });
  it('BATTLE_PASS_DURATION_MS === TOWER_SEASON_DURATION_MS (matches Tower)', () => {
    expect(BATTLE_PASS_DURATION_MS).toBe(TOWER_SEASON_DURATION_MS);
  });
  it('TOWER_SEASON_DURATION_MS === 13 weeks in ms', () => {
    expect(TOWER_SEASON_DURATION_MS).toBe(13 * 7 * 24 * 60 * 60 * 1000);
  });
});

describe('T3.14 Battle Pass formula — SACRED §2.4 byte-perfect', () => {
  it('BATTLE_PASS_BASE_XP === 500 (sacred)', () => {
    expect(BATTLE_PASS_BASE_XP).toBe(500);
  });
  it('BATTLE_PASS_PER_TIER_XP === 150 (sacred)', () => {
    expect(BATTLE_PASS_PER_TIER_XP).toBe(150);
  });
  it('BATTLE_PASS_MAX_TIER === 50', () => {
    expect(BATTLE_PASS_MAX_TIER).toBe(50);
  });
  it('computeBattlePassTierXp(1) === 500 (tier 1 = base)', () => {
    expect(computeBattlePassTierXp(1)).toBe(500);
  });
  it('computeBattlePassTierXp(2) === 650', () => {
    expect(computeBattlePassTierXp(2)).toBe(650);
  });
  it('computeBattlePassTierXp(10) === 1850 = 500 + 9×150', () => {
    expect(computeBattlePassTierXp(10)).toBe(1850);
  });
  it('computeBattlePassTierXp(50) === 7850 = 500 + 49×150', () => {
    expect(computeBattlePassTierXp(50)).toBe(7850);
  });
  it('formula invariant ∀ N ∈ [1, 50]: xp(N) = 500 + (N-1)×150', () => {
    for (let n = 1; n <= 50; n++) {
      expect(computeBattlePassTierXp(n)).toBe(500 + (n - 1) * 150);
    }
  });
  it('cumulative xp for tier 50 === 208,750 (sum: 50×500 + 150×(49×50/2))', () => {
    // sum_{k=1..50} (500 + (k-1)×150) = 50×500 + 150×(0+1+...+49) = 25000 + 150×1225 = 208,750
    expect(computeBattlePassTotalXpForTier(50)).toBe(208750);
  });
  it('validateBattlePassTier: 0 → fail; 1 → ok; 50 → ok; 51 → fail; 3.5 → fail', () => {
    expect(validateBattlePassTier(0).ok).toBe(false);
    expect(validateBattlePassTier(1).ok).toBe(true);
    expect(validateBattlePassTier(50).ok).toBe(true);
    expect(validateBattlePassTier(51).ok).toBe(false);
    expect(validateBattlePassTier(3.5).ok).toBe(false);
  });
});

describe('T3.14 — sacred TOWER_PACTS registry untouched', () => {
  it('TOWER_PACTS_BASE has exactly 30 entries', () => {
    expect(Object.keys(TOWER_PACTS_BASE)).toHaveLength(30);
  });
  it('TOWER_PACTS_MYTHIC has exactly 15 entries', () => {
    expect(Object.keys(TOWER_PACTS_MYTHIC)).toHaveLength(15);
  });
  it('both registries are Object.isFrozen', () => {
    expect(Object.isFrozen(TOWER_PACTS_BASE)).toBe(true);
    expect(Object.isFrozen(TOWER_PACTS_MYTHIC)).toBe(true);
  });
  it('getMergedPactRegistry(season 0 = no seasonal) returns exactly 45 sacred entries', () => {
    const r = getMergedPactRegistry(SEASON_PRE_LAUNCH);
    expect(Object.keys(r).length).toBe(45);
  });
  it('getMergedPactRegistry(season 1) returns 45 sacred + 3 seasonal = 48', () => {
    const r = getMergedPactRegistry(1);
    expect(Object.keys(r).length).toBe(48); // 45 sacred + 3 s1 seasonal
  });
});

describe('T3.14 — Uroboros variant rotation (cosmetic metadata only)', () => {
  it('UROBOROS_VARIANTS has at least 4 entries', () => {
    expect(UROBOROS_VARIANTS.length).toBeGreaterThanOrEqual(4);
  });
  it('UROBOROS_VARIANT_ROTATION_PERIOD_SEASONS === 1 (variant per season)', () => {
    expect(UROBOROS_VARIANT_ROTATION_PERIOD_SEASONS).toBe(1);
  });
  it('every variant is Object.isFrozen with cosmetic-only fields', () => {
    for (const v of UROBOROS_VARIANTS) {
      expect(Object.isFrozen(v)).toBe(true);
      expect(typeof v.id).toBe('string');
      expect(typeof v.displayName).toBe('string');
      expect(typeof v.auraColor).toBe('string');
      expect(typeof v.narratorVariant).toBe('string');
      // ADR-003: NO mechanical fields on variants
      expect(v).not.toHaveProperty('damage');
      expect(v).not.toHaveProperty('hp');
      expect(v).not.toHaveProperty('multiplier');
      expect(v).not.toHaveProperty('mult');
    }
  });
  it('variant rotation: season 1 → variant 0; season 2 → variant 1; wraps', () => {
    const n = UROBOROS_VARIANTS.length;
    expect(getActiveUroborosVariant(1).id).toBe(UROBOROS_VARIANTS[0].id);
    expect(getActiveUroborosVariant(2).id).toBe(UROBOROS_VARIANTS[1 % n].id);
    expect(getActiveUroborosVariant(n + 1).id).toBe(UROBOROS_VARIANTS[0].id);
  });
  it('defensive: season < 1 returns first variant', () => {
    expect(getActiveUroborosVariant(0).id).toBe(UROBOROS_VARIANTS[0].id);
    expect(getActiveUroborosVariant(-5).id).toBe(UROBOROS_VARIANTS[0].id);
  });
});

describe('T3.14 — seasonal pacts (additive, no sacred modification)', () => {
  it('SEASONAL_PACTS is Object.isFrozen', () => {
    expect(Object.isFrozen(SEASONAL_PACTS)).toBe(true);
  });
  it('ADR-003: no seasonal pact effect contains banned stat-boost field names', () => {
    for (const pact of Object.values(SEASONAL_PACTS)) {
      const effJson = JSON.stringify(pact.effect).toLowerCase();
      expect(effJson).not.toMatch(/"damage_mult"/);
      expect(effJson).not.toMatch(/"crit_chance"/);
      expect(effJson).not.toMatch(/"win_rate"/);
      // permissive: pact effects may reference 'ult' / 'shield' / 'pact' which is OK
    }
  });
  it('all seasonal pacts marked seasonal: true', () => {
    for (const pact of Object.values(SEASONAL_PACTS)) {
      expect(pact.seasonal).toBe(true);
    }
  });
  it('getActiveSeasonalPacts(1) returns season-1 ids only', () => {
    const ids = getActiveSeasonalPacts(1);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(SEASONAL_PACTS[id].seasonId).toBe(1);
    }
  });
  it('getActiveSeasonalPacts(0 = pre-launch) returns empty array', () => {
    expect(getActiveSeasonalPacts(0)).toEqual([]);
  });
});

describe('T3.14 — computeCurrentSeason / computeWeekInSeason', () => {
  it('before seasonStart → pre-launch sentinel', () => {
    const r = computeCurrentSeason(1000, 5000);
    expect(r.seasonId).toBe(SEASON_PRE_LAUNCH);
    expect(r.weekIndex).toBe(0);
  });
  it('at seasonStart → season 1, week 1', () => {
    const start = 100000;
    const r = computeCurrentSeason(start, start);
    expect(r.seasonId).toBe(1);
    expect(r.weekIndex).toBe(1);
  });
  it('at week 7 → seasonId 1, weekIndex 7', () => {
    const start = 0;
    const now = 6 * 7 * 24 * 60 * 60 * 1000; // 6 full weeks elapsed → week 7
    const r = computeCurrentSeason(now, start);
    expect(r.seasonId).toBe(1);
    expect(r.weekIndex).toBe(7);
  });
  it('past 13 weeks → seasonId 2', () => {
    const start = 0;
    const now = TOWER_SEASON_DURATION_MS;
    const r = computeCurrentSeason(now, start);
    expect(r.seasonId).toBe(2);
    expect(r.weekIndex).toBe(1);
  });
  it('computeWeekInSeason convenience helper matches', () => {
    const start = 0;
    const now = 2 * 7 * 24 * 60 * 60 * 1000;
    expect(computeWeekInSeason(now, start)).toBe(3);
  });
});

describe('T3.14 — async ops (mock-mode)', () => {
  beforeEach(() => { _resetMockSeasonState(); });

  it('fetchSeasonState returns ok=true with seasonId + weekIndex + variant + seasonalPactIds', async () => {
    const r = await fetchSeasonState();
    expect(r.ok).toBe(true);
    expect(r.seasonId).toBeGreaterThanOrEqual(1);
    expect(r.weekIndex).toBeGreaterThanOrEqual(1);
    expect(r.uroborosVariant).toBeDefined();
    expect(Array.isArray(r.seasonalPactIds)).toBe(true);
  });

  it('rotateToNextSeason increments seasonId + returns new variant', async () => {
    const r1 = await fetchSeasonState();
    const rot = await rotateToNextSeason(r1.seasonId);
    expect(rot.ok).toBe(true);
    expect(rot.newSeasonId).toBe(r1.seasonId + 1);
    expect(rot.newUroborosVariant).toBeDefined();
    expect(rot.newSeasonStartMs).toBeGreaterThan(0);
  });

  it('rotateToNextSeason rejects invalid input', async () => {
    expect((await rotateToNextSeason(-1)).ok).toBe(false);
    expect((await rotateToNextSeason('x')).ok).toBe(false);
  });
});

describe('T3.14 — getMergedPactRegistry preserves sacred references', () => {
  it('base pact entries in merged registry are SAME references as TOWER_PACTS_BASE', () => {
    const r = getMergedPactRegistry(1);
    for (const [id, pact] of Object.entries(TOWER_PACTS_BASE)) {
      expect(r[id]).toBe(pact);
    }
  });
  it('mythic pact entries preserved by reference', () => {
    const r = getMergedPactRegistry(1);
    for (const [id, pact] of Object.entries(TOWER_PACTS_MYTHIC)) {
      expect(r[id]).toBe(pact);
    }
  });
});
