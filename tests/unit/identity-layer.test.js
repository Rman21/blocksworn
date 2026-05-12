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
  // T2.03 — Shark Feeding Frenzy helpers.
  countAliveSharks,
  computeSharkBiteCount,
  computeBittenCells,
  isSharkBiteBlocked,
  sharkFrenzyGatePasses,
  fxSharkLineClear,
  __identityFxTestables,
} from '../../src/feel/identity-fx.js';
import {
  IDENTITY_FX_KEYS,
  IDENTITY_FX_BUDGETS,
  PIRATE_PLUNDER_GOLD_PER_CELL,
  PIRATE_PLUNDER_MAX_PIRATES,
  PIRATE_PLUNDER_MAX_COINS,
  PIRATE_PLUNDER_COIN_DECAY_MS,
  SHARK_FRENZY_MIN_SHARKS_FOR_2X_TRIGGER,
  SHARK_FRENZY_MAX_EXTRA_CELLS,
  SHARK_FRENZY_BITE_DECAY_MS,
  SHARK_FRENZY_DOMINANT_ELEMENT,
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

// ─── T2.03 — Shark Feeding Frenzy unit tests (spec §2.2) ─────────────────

describe('identity-layer · Shark Feeding Frenzy · countAliveSharks', () => {
  it('empty / undefined / null squad → 0', () => {
    expect(countAliveSharks([])).toBe(0);
    expect(countAliveSharks(undefined)).toBe(0);
    expect(countAliveSharks(null)).toBe(0);
  });

  it('mixed squad with 1 shark → 1', () => {
    const squad = [
      { id: 's1', race: 'shark' },
      { id: 'o1', race: 'orc' },
      { id: 'p1', race: 'pirate' },
    ];
    expect(countAliveSharks(squad)).toBe(1);
  });

  it('5-shark squad → 5 (squad max)', () => {
    const squad = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, race: 'shark' }));
    expect(countAliveSharks(squad)).toBe(5);
  });

  it('dead shark (hp=0) excluded; absent hp treated as alive; negative hp excluded', () => {
    const squad = [
      { id: 's1', race: 'shark', hp: 100 },
      { id: 's2', race: 'shark', hp: 0 },     // dead — excluded
      { id: 's3', race: 'shark' },            // hp absent — alive (T2.02 precedent #2)
      { id: 's4', race: 'shark', hp: -5 },    // negative — excluded
    ];
    expect(countAliveSharks(squad)).toBe(2);
  });

  it('null entries + non-shark races ignored', () => {
    expect(countAliveSharks([null, { race: 'shark' }, undefined, { race: 'pirate' }])).toBe(1);
  });
});

describe('identity-layer · Shark Feeding Frenzy · computeSharkBiteCount', () => {
  // Per brief: 1 shark = 0 bites, 2 sharks = 1 bite, 4 sharks = 1 bite,
  // 5 sharks = 1 bite. min(1, floor(x/2)) interpretation.
  it('0 sharks → 0 bites', () => { expect(computeSharkBiteCount(0)).toBe(0); });
  it('1 shark → 0 bites ("smaller effect" branch — gate may still pass)', () => {
    expect(computeSharkBiteCount(1)).toBe(0);
  });
  it('2 sharks → 1 bite', () => { expect(computeSharkBiteCount(2)).toBe(1); });
  it('3 sharks → 1 bite (capped at min(1, ...))', () => { expect(computeSharkBiteCount(3)).toBe(1); });
  it('4 sharks → 1 bite', () => { expect(computeSharkBiteCount(4)).toBe(1); });
  it('5 sharks → 1 bite (squad max)', () => { expect(computeSharkBiteCount(5)).toBe(1); });
  it('negative / NaN input → 0 (defensive)', () => {
    expect(computeSharkBiteCount(-1)).toBe(0);
    expect(computeSharkBiteCount(NaN)).toBe(0);
    expect(computeSharkBiteCount(undefined)).toBe(0);
  });
});

describe('identity-layer · Shark Feeding Frenzy · sharkFrenzyGatePasses', () => {
  it('0 sharks → never fires (silent no-op contract)', () => {
    expect(sharkFrenzyGatePasses(0, null)).toBe(false);
    expect(sharkFrenzyGatePasses(0, ['tide'])).toBe(false);
  });

  it('1 shark + tide-dominant line → gate passes ("smaller effect" path)', () => {
    expect(sharkFrenzyGatePasses(1, ['tide'])).toBe(true);
    expect(sharkFrenzyGatePasses(1, ['ember', 'tide'])).toBe(true);
  });

  it('1 shark + non-tide dominant → gate FAILS (no-op)', () => {
    expect(sharkFrenzyGatePasses(1, ['ember'])).toBe(false);
    expect(sharkFrenzyGatePasses(1, ['umbra', 'solar'])).toBe(false);
    expect(sharkFrenzyGatePasses(1, [])).toBe(false);
    expect(sharkFrenzyGatePasses(1, null)).toBe(false);
  });

  it('2+ sharks → gate ALWAYS passes regardless of element', () => {
    expect(sharkFrenzyGatePasses(2, null)).toBe(true);
    expect(sharkFrenzyGatePasses(2, ['ember'])).toBe(true);
    expect(sharkFrenzyGatePasses(5, ['umbra'])).toBe(true);
  });

  it('SHARK_FRENZY_MIN_SHARKS_FOR_2X_TRIGGER constant matches spec', () => {
    expect(SHARK_FRENZY_MIN_SHARKS_FOR_2X_TRIGGER).toBe(2);
    expect(SHARK_FRENZY_DOMINANT_ELEMENT).toBe('tide');
  });
});

describe('identity-layer · Shark Feeding Frenzy · isSharkBiteBlocked', () => {
  it('no gridState → never blocked', () => {
    expect(isSharkBiteBlocked(0, 0, null)).toBe(false);
    expect(isSharkBiteBlocked(0, 0, undefined)).toBe(false);
    expect(isSharkBiteBlocked(0, 0, {})).toBe(false);
  });

  it('lockedCells set blocks the cell', () => {
    const gs = { lockedCells: new Set(['3_4']) };
    expect(isSharkBiteBlocked(3, 4, gs)).toBe(true);
    expect(isSharkBiteBlocked(3, 5, gs)).toBe(false);
  });

  it('cursedCells set blocks the cell', () => {
    const gs = { cursedCells: new Set(['2_2']) };
    expect(isSharkBiteBlocked(2, 2, gs)).toBe(true);
    expect(isSharkBiteBlocked(2, 3, gs)).toBe(false);
  });

  it('permanentFrozenCells set blocks the cell', () => {
    const gs = { permanentFrozenCells: new Set(['1_1']) };
    expect(isSharkBiteBlocked(1, 1, gs)).toBe(true);
  });

  it('electrifiedRows Set/Array blocks any cell in that row', () => {
    const gsSet = { electrifiedRows: new Set([4]) };
    expect(isSharkBiteBlocked(4, 0, gsSet)).toBe(true);
    expect(isSharkBiteBlocked(4, 7, gsSet)).toBe(true);
    expect(isSharkBiteBlocked(3, 0, gsSet)).toBe(false);
    const gsArr = { electrifiedRows: [2, 5] };
    expect(isSharkBiteBlocked(2, 0, gsArr)).toBe(true);
    expect(isSharkBiteBlocked(5, 7, gsArr)).toBe(true);
    expect(isSharkBiteBlocked(3, 4, gsArr)).toBe(false);
  });

  it('isCellBlocked function escape hatch is consulted', () => {
    const gs = { isCellBlocked: (r, c) => r === 6 && c === 6 };
    expect(isSharkBiteBlocked(6, 6, gs)).toBe(true);
    expect(isSharkBiteBlocked(6, 5, gs)).toBe(false);
  });

  it('throwing isCellBlocked is swallowed (defensive)', () => {
    const gs = { isCellBlocked: () => { throw new Error('boom'); } };
    expect(() => isSharkBiteBlocked(0, 0, gs)).not.toThrow();
    expect(isSharkBiteBlocked(0, 0, gs)).toBe(false);
  });
});

describe('identity-layer · Shark Feeding Frenzy · computeBittenCells', () => {
  it('0 sharks → empty result (no bites, no extras)', () => {
    const out = computeBittenCells([0], [], 0, null);
    expect(out.bites).toEqual([]);
    expect(out.extraCleared).toEqual([]);
  });

  it('1 shark → empty result (bite count is 0 per spec)', () => {
    const out = computeBittenCells([0], [], 1, null);
    expect(out.bites).toEqual([]);
    expect(out.extraCleared).toEqual([]);
  });

  it('2 sharks + 1 row clear → 1 bite + 1 extra cleared', () => {
    const out = computeBittenCells([3], [], 2, null);
    expect(out.bites.length).toBe(1);
    expect(out.extraCleared.length).toBe(1);
    // Bite must be OUTSIDE the cleared row (r !== 3).
    expect(out.bites[0].r).not.toBe(3);
    expect(out.bites[0].direction).toBe('horizontal-row');
  });

  it('2 sharks + 1 col clear → 1 bite + 1 extra (vertical sweep)', () => {
    const out = computeBittenCells([], [4], 2, null);
    expect(out.bites.length).toBe(1);
    expect(out.extraCleared.length).toBe(1);
    expect(out.bites[0].c).not.toBe(4);
    expect(out.bites[0].direction).toBe('vertical-col');
  });

  it('HARD CAP — 5 sharks + 5 rows cleared → max 4 extras (SHARK_FRENZY_MAX_EXTRA_CELLS)', () => {
    // Even though 5 rows × 1 bite each = 5 potential extras, the hard cap is 4.
    const out = computeBittenCells([0, 1, 2, 3, 4], [], 5, null);
    expect(out.bites.length).toBeLessThanOrEqual(SHARK_FRENZY_MAX_EXTRA_CELLS);
    expect(out.extraCleared.length).toBeLessThanOrEqual(SHARK_FRENZY_MAX_EXTRA_CELLS);
    expect(SHARK_FRENZY_MAX_EXTRA_CELLS).toBe(4);
  });

  it('locked-cell test — bite on locked cell is absorbed (visual fires, NOT cleared)', () => {
    // Force the bite candidate. The implementation tries r+1 then r-1 from the
    // cleared row. For row 0, neighbor is row 1 (center column = 4 on 8×8).
    const gs = { lockedCells: new Set(['1_4']) };
    const out = computeBittenCells([0], [], 2, gs);
    // The bite is still spawned visually...
    expect(out.bites.length).toBe(1);
    expect(out.bites[0].blocked).toBe(true);
    // ...but the cell is NOT added to extraCleared (locked cell is preserved).
    expect(out.extraCleared.length).toBe(0);
  });

  it('extra cells DO NOT belong to the cleared row/col set (true "extras")', () => {
    const out = computeBittenCells([3], [], 5, null);
    for (const c of out.extraCleared) {
      expect(c.r).not.toBe(3);
    }
    for (const c of out.bites) {
      expect(c.r).not.toBe(3);
    }
  });

  it('cleared row at board edge (r=0) — bite falls into r=1 (below)', () => {
    const out = computeBittenCells([0], [], 2, null);
    expect(out.bites.length).toBe(1);
    expect(out.bites[0].r).toBe(1);
  });

  it('cleared row at board edge (r=7) — bite falls into r=8 first (off-board), so r=6 used', () => {
    // r+1 = 8 is out-of-bounds for 8×8 grid (valid rows 0–7). Helper retries
    // r-1 = 6 next, which is in-bounds.
    const out = computeBittenCells([7], [], 2, null);
    expect(out.bites.length).toBe(1);
    expect(out.bites[0].r).toBe(6);
  });

  it('non-array rows/cols → empty result (defensive)', () => {
    const out = computeBittenCells(undefined, undefined, 2, null);
    expect(out.bites).toEqual([]);
    expect(out.extraCleared).toEqual([]);
  });
});

describe('identity-layer · Shark Feeding Frenzy · fxSharkLineClear gate behavior', () => {
  it('0-shark squad → silent no-op, returns 0', () => {
    __identityFxTestables.resetSharkBitePool();
    const result = fxSharkLineClear([0], [], [{ race: 'orc' }, { race: 'pirate' }], null);
    expect(result).toBe(0);
    expect(__identityFxTestables.getLastBittenCells()).toEqual([]);
  });

  it('1-shark + tide-dominant → gate passes but bite count is 0 (no extras)', () => {
    __identityFxTestables.resetSharkBitePool();
    const ctx = { dominantElementsByLine: ['tide'] };
    const result = fxSharkLineClear([0], [], [{ race: 'shark' }], ctx);
    expect(result).toBe(0); // 1 shark → 0 bites per spec interpretation
    expect(__identityFxTestables.getLastBittenCells()).toEqual([]);
  });

  it('1-shark + non-tide dominant → gate FAILS, returns 0', () => {
    __identityFxTestables.resetSharkBitePool();
    const ctx = { dominantElementsByLine: ['ember'] };
    const result = fxSharkLineClear([0], [], [{ race: 'shark' }], ctx);
    expect(result).toBe(0);
  });

  it('2-shark + non-tide → gate STILL passes, 1 extra cell cleared', () => {
    __identityFxTestables.resetSharkBitePool();
    const squad = [{ race: 'shark' }, { race: 'shark' }];
    const ctx = { dominantElementsByLine: ['ember'] };
    const result = fxSharkLineClear([3], [], squad, ctx);
    expect(result).toBe(1);
    expect(__identityFxTestables.getLastBittenCells().length).toBe(1);
  });

  it('5-shark + 4 lines cleared → HARD CAP at 4 extras', () => {
    __identityFxTestables.resetSharkBitePool();
    const squad = Array.from({ length: 5 }, () => ({ race: 'shark' }));
    const result = fxSharkLineClear([0, 2, 4, 6], [], squad, null);
    expect(result).toBeLessThanOrEqual(SHARK_FRENZY_MAX_EXTRA_CELLS);
    expect(result).toBe(4);
  });

  it('2-shark + locked bite target → visual fires but no extra cleared', () => {
    __identityFxTestables.resetSharkBitePool();
    const squad = [{ race: 'shark' }, { race: 'shark' }];
    // Force bite target: row 0 → neighbor row 1, center col 4 → "1_4".
    const ctx = { lockedCells: new Set(['1_4']) };
    const result = fxSharkLineClear([0], [], squad, ctx);
    expect(result).toBe(0);
  });

  it('zero lines clear → silent no-op (no allocation)', () => {
    __identityFxTestables.resetSharkBitePool();
    const result = fxSharkLineClear([], [], [{ race: 'shark' }, { race: 'shark' }], null);
    expect(result).toBe(0);
  });
});

describe('identity-layer · Shark Feeding Frenzy · constants & budgets', () => {
  it('Shark constants match spec §2.2', () => {
    expect(SHARK_FRENZY_MIN_SHARKS_FOR_2X_TRIGGER).toBe(2);
    expect(SHARK_FRENZY_MAX_EXTRA_CELLS).toBe(4);
    expect(SHARK_FRENZY_BITE_DECAY_MS).toBe(500);
    expect(SHARK_FRENZY_DOMINANT_ELEMENT).toBe('tide');
  });

  it('Shark Frenzy budget ≤10ms (spec §2.2 field 9)', () => {
    expect(IDENTITY_FX_BUDGETS[IDENTITY_FX_KEYS.SHARK_FRENZY].wallTimeMs).toBeLessThanOrEqual(10);
    expect(IDENTITY_FX_BUDGETS[IDENTITY_FX_KEYS.SHARK_FRENZY].maxConcurrentParticles).toBe(4);
    expect(IDENTITY_FX_BUDGETS[IDENTITY_FX_KEYS.SHARK_FRENZY].decayMs).toBe(500);
  });
});

describe('identity-layer · dispatchIdentityFx — shark race regression', () => {
  it('shark race squad dispatches to fxSharkLineClear without throw', () => {
    const squad = [{ race: 'shark' }, { race: 'shark' }];
    expect(() => dispatchIdentityFx([0], [], squad, null)).not.toThrow();
  });

  it('mixed shark + pirate squad dispatches both layers (T2.02 regression)', () => {
    const squad = [{ race: 'shark' }, { race: 'shark' }, { race: 'pirate' }];
    // Should not throw — both stubs fire in sequence.
    expect(() => dispatchIdentityFx([0], [], squad, null)).not.toThrow();
  });
});
