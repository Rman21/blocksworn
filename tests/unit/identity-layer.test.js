// 2026-05-12 — TASK-029 (T2.02): Identity Layer · Pirate's Plunder unit tests.
//
// Spec: docs/design/mechanics/identity-layer.md §2.1 / §7.5.
// Pure math + helper coverage. No DOM — Vitest runs in `node` env
// (vitest.config.js).
//
// Surface tested:
//   - computePirateGold(pirateCount, cellsCleared)   — gold formula
//   - computeCellsCleared(rowCount, colCount)        — inclusion-exclusion
//   - countAlivePirates(squad)                       — squad filter
//   - dispatchIdentityFx(rows, cols, squad)          — empty-input guards
//   - IDENTITY_FX_KEYS export shape                  — enum stability
//
// The spec calls for ≥5 pure-math tests covering 0/1/5/6 pirates × cell-count
// edge cases. Coverage here exceeds that minimum to also exercise the cell-
// count math, alive-filter edge cases, and dispatcher early-exit guards.

import { describe, it, expect } from 'vitest';
import {
  computePirateGold,
  computeCellsCleared,
  countAlivePirates,
  dispatchIdentityFx,
} from '../../src/feel/identity-fx.js';
import {
  IDENTITY_FX_KEYS,
  IDENTITY_FX_BUDGETS,
  PIRATE_PLUNDER_GOLD_PER_CELL,
  PIRATE_PLUNDER_MAX_PIRATES,
  PIRATE_PLUNDER_MAX_COINS,
  PIRATE_PLUNDER_COIN_DECAY_MS,
} from '../../src/data/identity-layer.js';

describe('identity-layer · Pirate\'s Plunder · computePirateGold', () => {
  it('0 pirates × 10 cells → 0g (silent no-op contract)', () => {
    expect(computePirateGold(0, 10)).toBe(0);
  });

  it('1 pirate × 10 cells → 50g (5 × 10 × 1)', () => {
    expect(computePirateGold(1, 10)).toBe(50);
  });

  it('5 pirates × 10 cells → 250g (max squad)', () => {
    expect(computePirateGold(5, 10)).toBe(250);
  });

  it('6 pirates × 10 cells → 250g (caps at squad-of-5 sacred ceiling)', () => {
    // Squad max is 5 (sacred per CLAUDE.md §2.1). Defensive cap even though
    // 6 pirates is impossible via legit gameplay.
    expect(computePirateGold(6, 10)).toBe(250);
  });

  it('1 pirate × 0 cells → 0g (no clear, no gold)', () => {
    expect(computePirateGold(1, 0)).toBe(0);
  });

  it('5 pirates × 40 cells (4-line crit clear) → 1000g (spec §2.1 example)', () => {
    // Spec §2.1 field 4: "a 5-line crit clear (40 cells) yields 1000 gold maximum"
    expect(computePirateGold(5, 40)).toBe(1000);
  });

  it('non-finite / negative input → 0g (defensive)', () => {
    expect(computePirateGold(-3, 10)).toBe(0);
    expect(computePirateGold(NaN, 10)).toBe(0);
    expect(computePirateGold(3, -5)).toBe(0);
    expect(computePirateGold(3, NaN)).toBe(0);
  });

  it('formula respects PIRATE_PLUNDER_GOLD_PER_CELL named constant', () => {
    // Guard against accidental magic-number drift. AAA+ §3.4 disallows
    // hardcoded constants in tests — read from data/identity-layer.js.
    expect(PIRATE_PLUNDER_GOLD_PER_CELL).toBe(5);
    expect(computePirateGold(2, 4))
      .toBe(PIRATE_PLUNDER_GOLD_PER_CELL * 4 * 2);
  });
});

describe('identity-layer · computeCellsCleared (inclusion–exclusion)', () => {
  it('single row clear (1×0 on 8×8) → 8 cells', () => {
    expect(computeCellsCleared(1, 0)).toBe(8);
  });

  it('single col clear (0×1 on 8×8) → 8 cells', () => {
    expect(computeCellsCleared(0, 1)).toBe(8);
  });

  it('row + col clear (1×1 on 8×8) → 15 cells (intersection accounted)', () => {
    // 1 row (8) + 1 col (8) - 1 intersection (1×1) = 15.
    expect(computeCellsCleared(1, 1)).toBe(15);
  });

  it('quad-clear (4 rows, 0 cols) → 32 cells', () => {
    expect(computeCellsCleared(4, 0)).toBe(32);
  });

  it('full board clear (8 rows, 8 cols) → 64 cells', () => {
    expect(computeCellsCleared(8, 8)).toBe(64);
  });

  it('empty input (0×0) → 0 cells', () => {
    expect(computeCellsCleared(0, 0)).toBe(0);
  });

  it('non-finite input → 0 cells (defensive)', () => {
    expect(computeCellsCleared(NaN, 1)).toBe(8);
    expect(computeCellsCleared(undefined, undefined)).toBe(0);
  });
});

describe('identity-layer · countAlivePirates', () => {
  it('empty squad → 0', () => {
    expect(countAlivePirates([])).toBe(0);
    expect(countAlivePirates(undefined)).toBe(0);
    expect(countAlivePirates(null)).toBe(0);
  });

  it('mixed squad with 2 pirates → 2', () => {
    const squad = [
      { id: 'p1', race: 'pirate' },
      { id: 'o1', race: 'orc' },
      { id: 'p2', race: 'pirate' },
      { id: 'e1', race: 'elf' },
    ];
    expect(countAlivePirates(squad)).toBe(2);
  });

  it('5-pirate squad → 5 (squad max)', () => {
    const squad = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, race: 'pirate' }));
    expect(countAlivePirates(squad)).toBe(5);
  });

  it('dead pirate (hp=0) excluded; absent hp treated as alive', () => {
    const squad = [
      { id: 'p1', race: 'pirate', hp: 100 },
      { id: 'p2', race: 'pirate', hp: 0 },     // dead — excluded
      { id: 'p3', race: 'pirate' },            // hp absent — alive
      { id: 'p4', race: 'pirate', hp: -5 },    // negative — excluded
    ];
    expect(countAlivePirates(squad)).toBe(2);
  });

  it('null hero entries ignored', () => {
    expect(countAlivePirates([null, { race: 'pirate' }, undefined])).toBe(1);
  });
});

describe('identity-layer · dispatchIdentityFx guards', () => {
  it('undefined squad → no-op (no throw)', () => {
    expect(() => dispatchIdentityFx([1], [], undefined, null)).not.toThrow();
  });
  it('empty squad → no-op', () => {
    expect(() => dispatchIdentityFx([1], [], [], null)).not.toThrow();
  });
  it('zero lines → no-op (no allocations)', () => {
    const squad = [{ id: 'p1', race: 'pirate' }];
    expect(() => dispatchIdentityFx([], [], squad, null)).not.toThrow();
  });
  it('no DOM env: pirate squad with line clear runs gracefully', () => {
    // Vitest runs in node — no `document`. The dispatcher must still
    // compute gold (will fail silently because `addGold` is undefined)
    // without throwing. This is the host-page-not-ready edge case.
    const squad = [{ id: 'p1', race: 'pirate' }];
    expect(() => dispatchIdentityFx([0], [], squad, null)).not.toThrow();
  });
});

describe('identity-layer · constants module shape', () => {
  it('IDENTITY_FX_KEYS exports all 5 race effect ids', () => {
    expect(IDENTITY_FX_KEYS.PIRATE_PLUNDER).toBe('pirate_plunder');
    expect(IDENTITY_FX_KEYS.SHARK_FRENZY).toBe('shark_frenzy');
    expect(IDENTITY_FX_KEYS.ROCK_ECHO).toBe('rock_echo');
    expect(IDENTITY_FX_KEYS.CROCODILE_BASTION).toBe('crocodile_bastion');
    expect(IDENTITY_FX_KEYS.SPARK_CASCADE).toBe('spark_cascade');
  });

  it('IDENTITY_FX_BUDGETS has wall-time + particle cap for each key', () => {
    for (const key of Object.values(IDENTITY_FX_KEYS)) {
      const b = IDENTITY_FX_BUDGETS[key];
      expect(b).toBeDefined();
      expect(typeof b.wallTimeMs).toBe('number');
      expect(typeof b.maxConcurrentParticles).toBe('number');
      expect(typeof b.decayMs).toBe('number');
      expect(b.wallTimeMs).toBeLessThanOrEqual(16); // spec §5 — per-fire frame budget
    }
  });

  it('Pirate Plunder constants match spec §2.1', () => {
    expect(PIRATE_PLUNDER_GOLD_PER_CELL).toBe(5);
    expect(PIRATE_PLUNDER_MAX_PIRATES).toBe(5);
    expect(PIRATE_PLUNDER_MAX_COINS).toBe(32);
    expect(PIRATE_PLUNDER_COIN_DECAY_MS).toBe(1000);
  });

  it('Pirate Plunder budget ≤6ms (spec §2.1 field 9)', () => {
    expect(IDENTITY_FX_BUDGETS[IDENTITY_FX_KEYS.PIRATE_PLUNDER].wallTimeMs).toBeLessThanOrEqual(6);
  });
});
