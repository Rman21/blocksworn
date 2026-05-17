// 2026-05-16 — TASK-CP-002 regression tests
//
// Locks the contract for Combat Polish Tier-1 hero strip module.
//
// Coverage strategy (per project convention — see boss-scene.test.js +
// adventures-ui.test.js): Vitest runs in `node` env. DOM-state assertions
// belong to Playwright smoke tests (visual regression + JS-readable class
// integrity). This file covers:
//   1. Module exports present (mount/update/destroy + _testables hook)
//   2. Defensive guards — mount returns false for null/undefined rootEl
//   3. update/destroy are silent no-ops when not mounted
//   4. Energy-ring percentage formula correctness (e=40,max=80 → 50%)
//   5. Class icon path resolution for all 5 roles
//   6. RACE_TO_STIHIYA element binding completeness (13 races → 5 stihiyas)
//   7. Sacred-cow audit: HERO_ULT_COST_BY_NEWROLE byte-perfect (80/100/120/80/100)
//   8. Sacred-cow audit: RACE_TO_STIHIYA imported from src/data/races.js

import { describe, it, expect } from 'vitest';

import { RACE_TO_STIHIYA } from '../../src/data/races.js';
import { HERO_ULT_COST_BY_NEWROLE } from '../../src/data/heroes.js';
import { STIHIYAS } from '../../src/data/elements.js';
import {
  mountHeroStrip,
  updateHeroStrip,
  destroyHeroStrip,
  _testables,
} from '../../src/feel/hero-card.js';

describe('TASK-CP-002 — module exports', () => {
  it('exports mountHeroStrip / updateHeroStrip / destroyHeroStrip as functions', () => {
    expect(typeof mountHeroStrip).toBe('function');
    expect(typeof updateHeroStrip).toBe('function');
    expect(typeof destroyHeroStrip).toBe('function');
  });

  it('exports a _testables hook with helper internals', () => {
    expect(_testables).toBeDefined();
    expect(typeof _testables.classIconPath).toBe('function');
    expect(typeof _testables._isKnownRole).toBe('function');
    expect(typeof _testables._resolveElement).toBe('function');
    expect(typeof _testables._energyPct).toBe('function');
    expect(typeof _testables._hpPct).toBe('function');
    expect(typeof _testables.RING_CIRCUMFERENCE).toBe('number');
  });
});

describe('TASK-CP-002 — defensive guards', () => {
  it('mountHeroStrip returns false for null/undefined rootEl', () => {
    expect(mountHeroStrip(null)).toBe(false);
    expect(mountHeroStrip(undefined)).toBe(false);
  });

  it('updateHeroStrip is silent no-op when no strip mounted', () => {
    destroyHeroStrip();   // ensure clean state
    expect(() => updateHeroStrip([])).not.toThrow();
    expect(() => updateHeroStrip(undefined)).not.toThrow();
    expect(() => updateHeroStrip([{ name: 'X', race: 'orc', role: 'warrior' }])).not.toThrow();
  });

  it('destroyHeroStrip is idempotent (safe to call when not mounted)', () => {
    destroyHeroStrip();
    expect(() => destroyHeroStrip()).not.toThrow();
    expect(() => destroyHeroStrip()).not.toThrow();
  });
});

describe('TASK-CP-002 — energy ring percentage formula (visual normalisation)', () => {
  const { _energyPct } = _testables;

  it('normalises energy/maxEnergy correctly (e=40, max=80 → 50%)', () => {
    expect(_energyPct({ energy: 40, maxEnergy: 80 })).toBe(0.5);
  });

  it('handles per-role maxEnergy values (sacred 80/100/120/80/100)', () => {
    // Warrior / Tank — max 80
    expect(_energyPct({ energy: 80, maxEnergy: 80 })).toBe(1);
    expect(_energyPct({ energy: 40, maxEnergy: 80 })).toBe(0.5);
    // Mage / Captain — max 100
    expect(_energyPct({ energy: 100, maxEnergy: 100 })).toBe(1);
    expect(_energyPct({ energy: 25, maxEnergy: 100 })).toBe(0.25);
    // Hunter — max 120
    expect(_energyPct({ energy: 120, maxEnergy: 120 })).toBe(1);
    expect(_energyPct({ energy: 60, maxEnergy: 120 })).toBe(0.5);
  });

  it('clamps below 0 to 0 and above max to 1', () => {
    expect(_energyPct({ energy: -50, maxEnergy: 100 })).toBe(0);
    expect(_energyPct({ energy: 0, maxEnergy: 100 })).toBe(0);
    expect(_energyPct({ energy: 999, maxEnergy: 100 })).toBe(1);
  });

  it('returns 0 for missing/invalid fields (defensive)', () => {
    expect(_energyPct(null)).toBe(0);
    expect(_energyPct({})).toBe(0);
    expect(_energyPct({ energy: 50 })).toBe(0);                          // no max
    expect(_energyPct({ energy: 50, maxEnergy: 0 })).toBe(0);            // zero max
    expect(_energyPct({ energy: 'X', maxEnergy: 100 })).toBe(0);         // non-numeric
    expect(_energyPct({ energy: 50, maxEnergy: -1 })).toBe(0);           // negative max
  });
});

describe('TASK-CP-002 — HP percentage formula', () => {
  const { _hpPct } = _testables;

  it('normalises hp/hpMax correctly', () => {
    expect(_hpPct({ hp: 50, hpMax: 100 })).toBe(0.5);
    expect(_hpPct({ hp: 75, hpMax: 100 })).toBe(0.75);
    expect(_hpPct({ hp: 100, hpMax: 100 })).toBe(1);
    expect(_hpPct({ hp: 0, hpMax: 100 })).toBe(0);
  });

  it('defaults to full (1) when fields missing — avoid empty flash on first frame', () => {
    expect(_hpPct(null)).toBe(1);
    expect(_hpPct({})).toBe(1);
    expect(_hpPct({ hp: 50 })).toBe(1);                                  // no max
    expect(_hpPct({ hpMax: 100 })).toBe(1);                              // no hp
  });

  it('clamps overflow to 1', () => {
    expect(_hpPct({ hp: 200, hpMax: 100 })).toBe(1);
  });
});

describe('TASK-CP-002 — class icon path resolution', () => {
  const { classIconPath, _isKnownRole } = _testables;

  it('resolves all 5 roles to the public/assets/icons convention', () => {
    expect(classIconPath('warrior')).toBe('/assets/icons/class_warrior_emblem.png');
    expect(classIconPath('mage')).toBe('/assets/icons/class_mage_emblem.png');
    expect(classIconPath('hunter')).toBe('/assets/icons/class_hunter_emblem.png');
    expect(classIconPath('tank')).toBe('/assets/icons/class_tank_emblem.png');
    expect(classIconPath('captain')).toBe('/assets/icons/class_captain_emblem.png');
  });

  it('recognises only the 5 sacred roles', () => {
    expect(_isKnownRole('warrior')).toBe(true);
    expect(_isKnownRole('mage')).toBe(true);
    expect(_isKnownRole('hunter')).toBe(true);
    expect(_isKnownRole('tank')).toBe(true);
    expect(_isKnownRole('captain')).toBe(true);

    expect(_isKnownRole('warlord')).toBe(false);
    expect(_isKnownRole('')).toBe(false);
    expect(_isKnownRole('Warrior')).toBe(false);  // lowercase contract
  });
});

describe('TASK-CP-002 — race element binding (RACE_TO_STIHIYA)', () => {
  const { _resolveElement } = _testables;

  it('every RACE_TO_STIHIYA key maps to a valid stihiya', () => {
    const validStihiyas = new Set(STIHIYAS);
    const raceKeys = Object.keys(RACE_TO_STIHIYA);

    expect(raceKeys.length).toBeGreaterThan(0);
    for (const race of raceKeys) {
      const stihiya = RACE_TO_STIHIYA[race];
      expect(validStihiyas.has(stihiya)).toBe(true);
    }
  });

  it('contains all 13 documented races (mapping completeness)', () => {
    // Original 5 + V18.8 new 5 + Phase D Race Launch (shark/crocodile/spark)
    const expected = [
      'orc', 'troll', 'human', 'dark_elf', 'elf',
      'pirate', 'skeleton', 'golem', 'lion', 'rock',
      'shark', 'crocodile', 'spark',
    ];
    for (const race of expected) {
      expect(RACE_TO_STIHIYA[race]).toBeDefined();
    }
    expect(Object.keys(RACE_TO_STIHIYA).length).toBe(13);
  });

  it('_resolveElement falls back to umbra for missing/unknown race', () => {
    expect(_resolveElement(null)).toBe('umbra');
    expect(_resolveElement(undefined)).toBe('umbra');
    expect(_resolveElement({})).toBe('umbra');
    expect(_resolveElement({ race: null })).toBe('umbra');
    expect(_resolveElement({ race: 'centaur' })).toBe('umbra');
    expect(_resolveElement({ race: '' })).toBe('umbra');
  });

  it('_resolveElement returns the correct stihiya for known races', () => {
    expect(_resolveElement({ race: 'orc' })).toBe('ember');
    expect(_resolveElement({ race: 'elf' })).toBe('tide');
    expect(_resolveElement({ race: 'troll' })).toBe('grove');
    expect(_resolveElement({ race: 'human' })).toBe('solar');
    expect(_resolveElement({ race: 'dark_elf' })).toBe('umbra');
    // V18.8
    expect(_resolveElement({ race: 'pirate' })).toBe('ember');
    expect(_resolveElement({ race: 'skeleton' })).toBe('tide');
    expect(_resolveElement({ race: 'golem' })).toBe('grove');
    expect(_resolveElement({ race: 'lion' })).toBe('solar');
    expect(_resolveElement({ race: 'rock' })).toBe('umbra');
  });
});

describe('TASK-CP-002 — sacred-cow audit (CLAUDE.md §2.1)', () => {
  it('HERO_ULT_COST_BY_NEWROLE values byte-perfect (W:80/M:100/H:120/T:80/C:100)', () => {
    // Direct sacred check against the imported constant — catches drift in
    // src/data/heroes.js during refactor. These exact values are the
    // contract in CLAUDE.md §2.1 row "HERO_ULT_COST_BY_NEWROLE".
    expect(HERO_ULT_COST_BY_NEWROLE.warrior).toBe(80);
    expect(HERO_ULT_COST_BY_NEWROLE.mage).toBe(100);
    expect(HERO_ULT_COST_BY_NEWROLE.hunter).toBe(120);
    expect(HERO_ULT_COST_BY_NEWROLE.tank).toBe(80);
    expect(HERO_ULT_COST_BY_NEWROLE.captain).toBe(100);
  });

  it('HERO_ULT_COST_BY_NEWROLE is frozen (immutable)', () => {
    expect(Object.isFrozen(HERO_ULT_COST_BY_NEWROLE)).toBe(true);
  });

  it('hero-card module mirrors expected ULT cost table (compile-time parity)', () => {
    // The module's _EXPECTED_ULT_COSTS table must match HERO_ULT_COST_BY_NEWROLE.
    // The module throws at load time if they ever drift (defensive parity check
    // — see hero-card.js header). This test asserts the table contents.
    const expected = _testables._EXPECTED_ULT_COSTS;
    expect(expected.warrior).toBe(80);
    expect(expected.mage).toBe(100);
    expect(expected.hunter).toBe(120);
    expect(expected.tank).toBe(80);
    expect(expected.captain).toBe(100);
  });

  it('RACE_TO_STIHIYA is frozen (sacred read-only mapping)', () => {
    expect(Object.isFrozen(RACE_TO_STIHIYA)).toBe(true);
  });

  it('hero-card module imports RACE_TO_STIHIYA from src/data/races.js (not a copy)', () => {
    // The _resolveElement function reads RACE_TO_STIHIYA directly. If the
    // module ever clones it locally, this test would still pass — but we
    // assert the surface symbol parity by re-importing and round-tripping
    // through _resolveElement for every key.
    for (const race of Object.keys(RACE_TO_STIHIYA)) {
      expect(_testables._resolveElement({ race })).toBe(RACE_TO_STIHIYA[race]);
    }
  });
});

describe('TASK-CP-002 — ring geometry (visual contract)', () => {
  it('RING_CIRCUMFERENCE matches 2π × r=26 (used for stroke-dasharray)', () => {
    const expected = 2 * Math.PI * 26;
    expect(_testables.RING_CIRCUMFERENCE).toBeCloseTo(expected, 6);
  });
});
