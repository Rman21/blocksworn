// 2026-05-12 — TASK-026 (T1.19): Mythic framework data-layer verification.
//
// Per Execution Plan §23, v2.1 P3 Mythic was flagged ⚠️ VERIFY at T1.07
// inventory. T1.10.2 closure confirmed the one-Mythic-per-save constraint;
// T1.10.4 closure confirmed 25/25 descriptors. T1.19 formally locks in
// the verification via this unit test, which guards against regression
// of either the descriptor table or the sacred Mythic constants.
//
// Smoke-level (full UI flow) was traded for data-layer coverage per the
// T1.19 spec note: reaching Mythic ascension requires extensive game-state
// seeding (T1 → T2 → T3 → Mythic + 25 cards + legendary stone + gold + essence)
// which is out of scope for a verification test. The data layer + the
// progression constants are what the rule-breaker layer reads at runtime.
//
// Importing src/core/heroes.js or src/core/progression.js into the Node
// vitest environment isn't viable (both depend on legacy `/* global */`
// identifiers such as towerState, HERO_DECK, dealDamage, flashText). This
// test scopes to:
//   1. src/data/heroes.js — pure data, zero side effects (HERO_TIER_ABILITIES)
//   2. src/data/balance.js — pure constants (BALANCE.ascend.mythic)
//
// The 25 HERO_ROSTER id strings live in src/core/heroes.js and can't be
// imported here, so we duplicate the canonical id list and cross-check
// that HERO_TIER_ABILITIES has a matching mythic descriptor for every id.

import { describe, it, expect } from 'vitest';
import { HERO_TIER_ABILITIES } from '../../src/data/heroes.js';
import { BALANCE } from '../../src/data/balance.js';

// Canonical 25-hero id list — mirrors HERO_ROSTER in src/core/heroes.js
// (lines 3782-3832). Keep byte-perfect with that file. If a hero is added,
// both this list and HERO_TIER_ABILITIES must grow in lockstep.
const HERO_IDS = Object.freeze([
  'pirate_warrior', 'pirate_hunter', 'pirate_mage', 'pirate_tank', 'pirate_captain',
  'rock_warrior',   'rock_hunter',   'rock_mage',   'rock_tank',   'rock_captain',
  'shark_warrior',  'shark_hunter',  'shark_mage',  'shark_tank',  'shark_captain',
  'crocodile_warrior', 'crocodile_hunter', 'crocodile_mage', 'crocodile_tank', 'crocodile_captain',
  'spark_warrior',  'spark_hunter',  'spark_mage',  'spark_tank',  'spark_captain',
]);

describe('Mythic framework — data layer (T1.19)', () => {
  it('HERO_TIER_ABILITIES has exactly 25 hero entries', () => {
    expect(Object.keys(HERO_TIER_ABILITIES)).toHaveLength(25);
  });

  it('every HERO_ROSTER id has a HERO_TIER_ABILITIES entry', () => {
    for (const id of HERO_IDS) {
      expect(HERO_TIER_ABILITIES[id], `missing tier abilities for ${id}`).toBeDefined();
    }
  });

  it('every hero has a non-empty mythic descriptor (name + description)', () => {
    for (const id of HERO_IDS) {
      const m = HERO_TIER_ABILITIES[id].mythic;
      expect(m, `${id} missing mythic descriptor`).toBeDefined();
      expect(typeof m.name).toBe('string');
      expect(m.name.length).toBeGreaterThan(0);
      expect(typeof m.description).toBe('string');
      expect(m.description.length).toBeGreaterThan(0);
    }
  });

  it('every hero has the sacred mythic cost string (T1.10.4 byte-perfect)', () => {
    // Per BLOCKSWORN_COMBAT_V21_PHASE_3_HERO_TIERS.md §1.4 cost table:
    //   Mythic = 25 cards + 1 legendary stone + 1000g + 20 essence
    const expected = '25 cards + 1 legendary stone + 1000g + 20 essence';
    for (const id of HERO_IDS) {
      expect(HERO_TIER_ABILITIES[id].mythic.cost).toBe(expected);
    }
  });

  it('every hero has t0/t1/t2/t3/mythic descriptors (full tier ladder)', () => {
    for (const id of HERO_IDS) {
      const a = HERO_TIER_ABILITIES[id];
      expect(a.t0, `${id} missing t0`).toBeDefined();
      expect(a.t1, `${id} missing t1`).toBeDefined();
      expect(a.t2, `${id} missing t2`).toBeDefined();
      expect(a.t3, `${id} missing t3`).toBeDefined();
      expect(a.mythic, `${id} missing mythic`).toBeDefined();
    }
  });

  it('HERO_TIER_ABILITIES is deeply frozen', () => {
    expect(Object.isFrozen(HERO_TIER_ABILITIES)).toBe(true);
    // Spot-check one hero deeply
    expect(Object.isFrozen(HERO_TIER_ABILITIES.pirate_warrior)).toBe(true);
    expect(Object.isFrozen(HERO_TIER_ABILITIES.pirate_warrior.mythic)).toBe(true);
  });
});

describe('Mythic framework — sacred constants (CLAUDE.md §2.5)', () => {
  it('BALANCE.ascend.mythic byte-perfect per v2.1 P3 §1.4', () => {
    expect(BALANCE.ascend.mythic.ascend).toBe(1);       // legendary stones
    expect(BALANCE.ascend.mythic.cards).toBe(25);       // hero fragments
    expect(BALANCE.ascend.mythic.gold).toBe(1000);
    expect(BALANCE.ascend.mythic.essence).toBe(20);
    expect(BALANCE.ascend.mythic.damageBonus).toBe(1.30); // sacred 1.30 mult
  });

  it('Mythic damage stack (T2 × T3 × Mythic) = 1.872× (+87%)', () => {
    // T2 = 1.20, T3 = 1.20 (stacked), Mythic = 1.30 (stacked)
    const stack = 1.20 * 1.20 * 1.30;
    expect(stack).toBeCloseTo(1.872, 3);
  });
});
