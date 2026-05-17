// 2026-05-16 — TASK-CP-005 regression tests
//
// Locks the contract for Combat Polish Tier-2 synergy-bar module (the first
// polish task on top of the MVP gate closed at TASK-CP-004).
//
// Coverage strategy (per project convention — see pressure-meter.test.js +
// top-hud.test.js): Vitest runs in `node` env. DOM-state assertions belong
// to Playwright smoke tests (visual regression + tier-escalation pixel diff).
// This file covers:
//   1. Module exports present (mount/update/destroy + pure helpers + _testables)
//   2. Defensive guards — mount returns false for null/undefined rootEl
//   3. update/destroy are silent no-ops when not mounted
//   4. resolveTierClassName: 2/3/5 → correct CSS class; invalid → idle class
//   5. computeBarState: filters/normalizes input → render-ready model
//      (handles unknown elements, invalid tiers, missing fields, malformed shape)
//   6. STIHIYAS import parity — bar reads from src/data/elements.js
//      (all 5 keys present + correct order)
//   7. Sacred-cow audit: SACRED_SYNERGY 2x/3x/5x values mirror CLAUDE.md §2.1
//      (module mirror value assertion)
//   8. Sacred-cow audit: canonical CLAUDE.md regex-grep parity
//      (Element synergy 2x/3x/5x row literals byte-perfect)
//
// Performance / 60fps assertion is OUT OF SCOPE for unit tests (smoke tests
// at the Playwright tier handle frame timeline + CSS layout-thrash audit).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Sacred audit reads CLAUDE.md TEXTUALLY — the module mirrors sacred
// synergy values verbatim from CLAUDE.md §2.1 + combat-mechanics.md §6.
// Reading the spec doc by text avoids any bootstrap and locks the visual
// tier escalation to the canonical sacred row literals.
const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_MD_PATH = resolve(__dirname, '../../CLAUDE.md');

import {
  mountSynergyBar,
  updateSynergyBar,
  destroySynergyBar,
  resolveTierClassName,
  computeBarState,
  _testables,
} from '../../src/feel/synergy-bar.js';
import { STIHIYAS } from '../../src/data/elements.js';

describe('TASK-CP-005 — module exports', () => {
  it('exports mountSynergyBar / updateSynergyBar / destroySynergyBar as functions', () => {
    expect(typeof mountSynergyBar).toBe('function');
    expect(typeof updateSynergyBar).toBe('function');
    expect(typeof destroySynergyBar).toBe('function');
  });

  it('exports pure helper functions', () => {
    expect(typeof resolveTierClassName).toBe('function');
    expect(typeof computeBarState).toBe('function');
  });

  it('exports a _testables hook with sacred constant mirrors', () => {
    expect(_testables).toBeDefined();
    expect(typeof _testables.SACRED_SYNERGY).toBe('object');
    expect(Array.isArray(_testables.VALID_TIERS)).toBe(true);
    expect(typeof _testables.TIER_CLASS_IDLE).toBe('string');
    expect(typeof _testables.TIER_CLASS_2X).toBe('string');
    expect(typeof _testables.TIER_CLASS_3X).toBe('string');
    expect(typeof _testables.TIER_CLASS_5X).toBe('string');
    expect(typeof _testables._getCurrentBar).toBe('function');
  });
});

describe('TASK-CP-005 — defensive guards', () => {
  it('mountSynergyBar returns false for null/undefined rootEl', () => {
    expect(mountSynergyBar(null)).toBe(false);
    expect(mountSynergyBar(undefined)).toBe(false);
  });

  it('updateSynergyBar is a silent no-op when no bar mounted', () => {
    destroySynergyBar();   // ensure clean state
    expect(() => updateSynergyBar({})).not.toThrow();
    expect(() => updateSynergyBar(undefined)).not.toThrow();
    expect(() => updateSynergyBar(null)).not.toThrow();
    expect(() => updateSynergyBar({ activeElements: [] })).not.toThrow();
    expect(() => updateSynergyBar({
      activeElements: [{ element: 'ember', tier: 5 }],
    })).not.toThrow();
  });

  it('destroySynergyBar is idempotent (safe to call when not mounted)', () => {
    destroySynergyBar();
    expect(() => destroySynergyBar()).not.toThrow();
    expect(() => destroySynergyBar()).not.toThrow();
  });

  it('updateSynergyBar never throws on non-object input', () => {
    expect(() => updateSynergyBar(42)).not.toThrow();
    expect(() => updateSynergyBar('hello')).not.toThrow();
    expect(() => updateSynergyBar(true)).not.toThrow();
  });
});

describe('TASK-CP-005 — resolveTierClassName (tier → CSS class mapper)', () => {
  it('maps tier 2 → tier-2 class', () => {
    expect(resolveTierClassName(2)).toBe(_testables.TIER_CLASS_2X);
  });

  it('maps tier 3 → tier-3 class', () => {
    expect(resolveTierClassName(3)).toBe(_testables.TIER_CLASS_3X);
  });

  it('maps tier 5 → tier-5 class', () => {
    expect(resolveTierClassName(5)).toBe(_testables.TIER_CLASS_5X);
  });

  it('maps tier 0 / invalid / unknown → idle class', () => {
    // Per CLAUDE.md §2.1, the only sacred tiers are 2 / 3 / 5. Any value
    // outside this set must fall back to idle — the visual layer never
    // invents a tier the sacred mechanical layer doesn't grant.
    expect(resolveTierClassName(0)).toBe(_testables.TIER_CLASS_IDLE);
    expect(resolveTierClassName(1)).toBe(_testables.TIER_CLASS_IDLE);
    expect(resolveTierClassName(4)).toBe(_testables.TIER_CLASS_IDLE);
    expect(resolveTierClassName(6)).toBe(_testables.TIER_CLASS_IDLE);
    expect(resolveTierClassName(-1)).toBe(_testables.TIER_CLASS_IDLE);
    expect(resolveTierClassName(null)).toBe(_testables.TIER_CLASS_IDLE);
    expect(resolveTierClassName(undefined)).toBe(_testables.TIER_CLASS_IDLE);
    expect(resolveTierClassName('X')).toBe(_testables.TIER_CLASS_IDLE);
    expect(resolveTierClassName(NaN)).toBe(_testables.TIER_CLASS_IDLE);
    expect(resolveTierClassName(true)).toBe(_testables.TIER_CLASS_IDLE);
  });
});

describe('TASK-CP-005 — computeBarState (input → render-ready model)', () => {
  it('renders all idle for empty / missing state', () => {
    const empty = { ember: 0, tide: 0, grove: 0, solar: 0, umbra: 0 };
    expect(computeBarState({})).toEqual(empty);
    expect(computeBarState({ activeElements: [] })).toEqual(empty);
    expect(computeBarState(null)).toEqual(empty);
    expect(computeBarState(undefined)).toEqual(empty);
    expect(computeBarState({ activeElements: null })).toEqual(empty);
  });

  it('renders per-element tier for valid input', () => {
    expect(computeBarState({
      activeElements: [{ element: 'ember', tier: 3 }],
    })).toEqual({ ember: 3, tide: 0, grove: 0, solar: 0, umbra: 0 });

    expect(computeBarState({
      activeElements: [
        { element: 'ember', tier: 5 },
        { element: 'tide',  tier: 2 },
        { element: 'umbra', tier: 3 },
      ],
    })).toEqual({ ember: 5, tide: 2, grove: 0, solar: 0, umbra: 3 });
  });

  it('handles all 5 sacred elements simultaneously', () => {
    const all5 = {
      activeElements: [
        { element: 'ember', tier: 2 },
        { element: 'tide',  tier: 3 },
        { element: 'grove', tier: 5 },
        { element: 'solar', tier: 2 },
        { element: 'umbra', tier: 3 },
      ],
    };
    expect(computeBarState(all5))
      .toEqual({ ember: 2, tide: 3, grove: 5, solar: 2, umbra: 3 });
  });

  it('silently ignores unknown element keys', () => {
    expect(computeBarState({
      activeElements: [
        { element: 'made_up',     tier: 5 },
        { element: 'metal',       tier: 3 },
        { element: 'lightning',   tier: 2 },
      ],
    })).toEqual({ ember: 0, tide: 0, grove: 0, solar: 0, umbra: 0 });
  });

  it('silently ignores invalid tiers (must be 2/3/5)', () => {
    // Per CLAUDE.md §2.1 only 2x / 3x / 5x are sacred — never invent tier 4.
    expect(computeBarState({
      activeElements: [
        { element: 'ember', tier: 1 },
        { element: 'tide',  tier: 4 },
        { element: 'grove', tier: 0 },
        { element: 'solar', tier: 6 },
        { element: 'umbra', tier: -1 },
      ],
    })).toEqual({ ember: 0, tide: 0, grove: 0, solar: 0, umbra: 0 });
  });

  it('silently ignores malformed entries', () => {
    expect(computeBarState({
      activeElements: [
        null,
        undefined,
        'ember',
        42,
        { element: 'ember' },                // missing tier
        { tier: 5 },                          // missing element
        { element: null, tier: 5 },           // non-string element
        { element: 'ember', tier: '5' },      // non-numeric tier (string '5' ≠ number 5)
      ],
    })).toEqual({ ember: 0, tide: 0, grove: 0, solar: 0, umbra: 0 });
  });

  it('keeps the highest tier when an element appears multiple times', () => {
    expect(computeBarState({
      activeElements: [
        { element: 'ember', tier: 2 },
        { element: 'ember', tier: 5 },
        { element: 'ember', tier: 3 },
      ],
    })).toEqual({ ember: 5, tide: 0, grove: 0, solar: 0, umbra: 0 });
  });

  it('handles non-array activeElements gracefully', () => {
    const empty = { ember: 0, tide: 0, grove: 0, solar: 0, umbra: 0 };
    expect(computeBarState({ activeElements: 'X' })).toEqual(empty);
    expect(computeBarState({ activeElements: 42 })).toEqual(empty);
    expect(computeBarState({ activeElements: {} })).toEqual(empty);
  });
});

describe('TASK-CP-005 — STIHIYAS parity', () => {
  it('STIHIYAS still contains exactly the 5 sacred elements (CLAUDE.md §2.1)', () => {
    // The bar reads element keys from src/data/elements.js (sacred per
    // CLAUDE.md §2.1). If that list ever drifts, the bar's emblem set
    // and computeBarState's render model both need re-checking.
    expect(STIHIYAS).toEqual(['ember', 'tide', 'grove', 'solar', 'umbra']);
  });

  it('STIHIYAS is frozen — sacred immutability guard', () => {
    expect(Object.isFrozen(STIHIYAS)).toBe(true);
  });

  it('computeBarState model has exactly the STIHIYAS keys', () => {
    const model = computeBarState({});
    expect(Object.keys(model).sort()).toEqual([...STIHIYAS].sort());
  });
});

describe('TASK-CP-005 — sacred-cow audit (CLAUDE.md §2.1 + combat-mechanics.md §6)', () => {
  it('SACRED_SYNERGY.tier_2x = −2 ULT threshold — module mirror (CLAUDE.md §2.1)', () => {
    // The bar module mirrors the sacred 2x ULT reduction value verbatim.
    // The visual tier escalation never reads this number as a threshold —
    // it's locked here so a parity drift between the rendered tier and
    // the sacred mechanical effect surfaces loudly in unit tests.
    expect(_testables.SACRED_SYNERGY.tier_2x.ult_threshold_delta).toBe(-2);
  });

  it('SACRED_SYNERGY.tier_3x = −4 ULT + 20% passive dmg — module mirror', () => {
    expect(_testables.SACRED_SYNERGY.tier_3x.ult_threshold_delta).toBe(-4);
    expect(_testables.SACRED_SYNERGY.tier_3x.passive_dmg_bonus_pct).toBe(20);
  });

  it('SACRED_SYNERGY.tier_5x = −6 ULT + 50% dmg + 30% start charge — module mirror', () => {
    expect(_testables.SACRED_SYNERGY.tier_5x.ult_threshold_delta).toBe(-6);
    expect(_testables.SACRED_SYNERGY.tier_5x.damage_bonus_pct).toBe(50);
    expect(_testables.SACRED_SYNERGY.tier_5x.start_charge_pct).toBe(30);
  });

  it('SACRED_SYNERGY object is frozen (defensive immutability)', () => {
    expect(Object.isFrozen(_testables.SACRED_SYNERGY)).toBe(true);
    expect(Object.isFrozen(_testables.SACRED_SYNERGY.tier_2x)).toBe(true);
    expect(Object.isFrozen(_testables.SACRED_SYNERGY.tier_3x)).toBe(true);
    expect(Object.isFrozen(_testables.SACRED_SYNERGY.tier_5x)).toBe(true);
  });

  it('VALID_TIERS = [2, 3, 5] — locked sacred tier list (no 4)', () => {
    // Per CLAUDE.md §2.1 + combat-mechanics.md §6, the only sacred tiers
    // are 2x / 3x / 5x. There is no 4x — the table jumps from 3 to 5.
    expect(_testables.VALID_TIERS).toEqual([2, 3, 5]);
    expect(Object.isFrozen(_testables.VALID_TIERS)).toBe(true);
  });

  it('Element synergy 2x row byte-perfect — canonical CLAUDE.md regex-grep', () => {
    // Textual audit catches drift in the canonical sacred row literal.
    // Locks the row "Element synergy 2x | `-2 ULT threshold`" so any
    // edit to CLAUDE.md §2.1 surfaces here and the module mirror must
    // be re-synced.
    const src = readFileSync(CLAUDE_MD_PATH, 'utf8');
    const re2 = /\|\s*Element synergy 2x\s*\|\s*`(-2 ULT threshold)`\s*\|/;
    const m2 = src.match(re2);
    expect(m2, 'CLAUDE.md §2.1 Element synergy 2x row not found verbatim').not.toBeNull();
    expect(m2[1]).toBe('-2 ULT threshold');
  });

  it('Element synergy 3x row byte-perfect — canonical CLAUDE.md regex-grep', () => {
    const src = readFileSync(CLAUDE_MD_PATH, 'utf8');
    const re3 = /\|\s*Element synergy 3x\s*\|\s*`(-4 ULT, \+20% passive damage)`\s*\|/;
    const m3 = src.match(re3);
    expect(m3, 'CLAUDE.md §2.1 Element synergy 3x row not found verbatim').not.toBeNull();
    expect(m3[1]).toBe('-4 ULT, +20% passive damage');
  });

  it('Element synergy 5x row byte-perfect — canonical CLAUDE.md regex-grep', () => {
    const src = readFileSync(CLAUDE_MD_PATH, 'utf8');
    const re5 = /\|\s*Element synergy 5x\s*\|\s*`(-6 ULT, \+50% damage, 30% start charge)`\s*\|/;
    const m5 = src.match(re5);
    expect(m5, 'CLAUDE.md §2.1 Element synergy 5x row not found verbatim').not.toBeNull();
    expect(m5[1]).toBe('-6 ULT, +50% damage, 30% start charge');
  });

  it('SACRED_SYNERGY values align with CLAUDE.md §2.1 rows (cross-check)', () => {
    // Defensive cross-check: parse the magnitudes out of CLAUDE.md and
    // assert numeric parity with the module mirror. If anyone edits the
    // CLAUDE.md row to change a number, the module mirror needs to follow.
    const src = readFileSync(CLAUDE_MD_PATH, 'utf8');

    // 2x: "-2 ULT threshold"
    const ult2 = src.match(/Element synergy 2x\s*\|\s*`-(\d+) ULT threshold`/);
    expect(ult2).not.toBeNull();
    expect(-parseInt(ult2[1], 10)).toBe(_testables.SACRED_SYNERGY.tier_2x.ult_threshold_delta);

    // 3x: "-4 ULT, +20% passive damage"
    const m3 = src.match(/Element synergy 3x\s*\|\s*`-(\d+) ULT, \+(\d+)% passive damage`/);
    expect(m3).not.toBeNull();
    expect(-parseInt(m3[1], 10)).toBe(_testables.SACRED_SYNERGY.tier_3x.ult_threshold_delta);
    expect(parseInt(m3[2], 10)).toBe(_testables.SACRED_SYNERGY.tier_3x.passive_dmg_bonus_pct);

    // 5x: "-6 ULT, +50% damage, 30% start charge"
    const m5 = src.match(/Element synergy 5x\s*\|\s*`-(\d+) ULT, \+(\d+)% damage, (\d+)% start charge`/);
    expect(m5).not.toBeNull();
    expect(-parseInt(m5[1], 10)).toBe(_testables.SACRED_SYNERGY.tier_5x.ult_threshold_delta);
    expect(parseInt(m5[2], 10)).toBe(_testables.SACRED_SYNERGY.tier_5x.damage_bonus_pct);
    expect(parseInt(m5[3], 10)).toBe(_testables.SACRED_SYNERGY.tier_5x.start_charge_pct);
  });
});
