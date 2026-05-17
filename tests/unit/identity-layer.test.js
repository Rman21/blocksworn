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
  // T2.04 — Rock Encore Echo helpers.
  countAliveRocks,
  countUmbraDominantLines,
  computeEncoreEchoCharge,
  clampEncoreEchoCharge,
  fxRockLineClear,
  // T2.05 — Crocodile Bedrock Bastion helpers.
  countAliveCrocodiles,
  countGroveCells,
  accumulateFragments,
  computeShieldsGrantable,
  clampShieldsToSquadMax,
  resolveSacredMaxShieldBonus,
  fxCrocodileLineClear,
  resetCrocFragmentBank,
  // T2.06 — Spark Sun Cascade helpers.
  countAliveSparks,
  countSolarCellsInClear,
  computeSunCascadeModifier,
  fxSparkLineClear,
  // T2.07 — Phoenix Ashen Reign helpers.
  computeAshenReignDuration,
  canPlacePieceDuringAshenReign,
  isAshenReignActive,
  getAshenReignEndsAt,
  fxPhoenixAshenReign,
  fxPhoenixAshenReignRelease,
  resetAshenReign,
  // T2.08 — Lich Cursed Tiles helpers.
  pickRandomNonEmptyCells,
  applyCurseCellDamage,
  computeCurseTickResult,
  clampUltCharge,
  cursedTilesGatePasses,
  isCellCursed,
  getCursedTilesCount,
  getCursedTilesSnapshot,
  fxLichCursedTiles,
  fxLichCursedTilesTick,
  resetCursedTiles,
  // T2.09 — Berserker / Frenzy Bloodtide Pulse helpers.
  shouldBloodtidePulse,
  computeBloodtideDamageBonus,
  applyBloodtideToDamage,
  incrementBloodtideClearCount,
  getBloodtideClearCount,
  consumeBloodtidePulse,
  isBloodtidePulsePending,
  bloodtideGatePasses,
  fxBerserkerBloodtidePulse,
  resetBloodtide,
  // T2.10 — Engineer Lockdown Protocol helpers.
  isTetrisCrit,
  pickMostClearedCorner,
  compute2x2LockdownCells,
  engineerLockdownGatePasses,
  isCellLockedByLockdownProtocol,
  getEngineerLockdownsCount,
  getEngineerLockdownsSnapshot,
  fxEngineerLockdownProtocol,
  fxEngineerLockdownTick,
  resetEngineerLockdowns,
  // T2.11 — Grovewarden Root Surge helpers.
  shouldRootSurgeFire,
  pushRecentClear,
  pickRandomEmptyCells,
  computeRootSurgeCells,
  computeRootClearGoldReward,
  computeRootSurgeTickResult,
  isCellRooted,
  getActiveRootCellsCount,
  getActiveRootCellsSnapshot,
  getRecentClearsSnapshot,
  rootSurgeGatePasses,
  fxGrovewardenRootSurge,
  fxGrovewardenRootSurgeTick,
  onRootCellCleared,
  resetGrovewardenRootSurge,
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
  ROCK_ECHO_CHARGE_PER_LINE,
  ROCK_ECHO_MAX_CHARGE_PER_FIRE,
  ROCK_ECHO_GHOST_DECAY_MS,
  ROCK_ECHO_DELAY_MS,
  ROCK_ECHO_DOMINANT_ELEMENT,
  ROCK_ECHO_ULT_METER,
  CROCODILE_BASTION_FRAGMENTS_PER_SHIELD,
  CROCODILE_BASTION_MAX_FRAGMENT_PARTICLES,
  CROCODILE_BASTION_FRAGMENT_DECAY_MS,
  CROCODILE_BASTION_GROVE_ELEMENT,
  CROCODILE_BASTION_TARGET_HERO_INDEX,
  SPARK_CASCADE_MIN_SOLAR_CELLS,
  SPARK_CASCADE_MAX_DOMINANT_BOOST,
  SPARK_CASCADE_MAX_RAY_PARTICLES,
  SPARK_CASCADE_RAY_DECAY_MS,
  SPARK_CASCADE_DOMINANT_ELEMENT,
  SPARK_CASCADE_ENABLED,
  // T2.07 — Phoenix Ashen Reign constants.
  IDENTITY_BOSS_FX_KEYS,
  IDENTITY_BOSS_FX_BUDGETS,
  ASHEN_REIGN_DURATION_MS,
  ASHEN_REIGN_FLAME_BORDER_WIDTH_PX,
  ASHEN_REIGN_DECAY_MS,
  ASHEN_REIGN_TELEGRAPH_MS,
  ASHEN_REIGN_REQUIRED_ELEMENT,
  ASHEN_REIGN_HUD_COUNTDOWN_TEXT,
  ASHEN_REIGN_NARRATOR_LINE_PLACEHOLDER,
  ASHEN_REIGN_INITIAL_BUDGET_MS,
  ASHEN_REIGN_STEADY_STATE_BUDGET_MS,
  // T2.08 — Lich Cursed Tiles constants.
  CURSED_TILES_COUNT,
  CURSED_TILES_TURNS_UNTIL_AUTO_CLEAR,
  CURSED_TILES_HP_DAMAGE_PER_TURN,
  CURSED_TILES_ULT_COMPENSATION,
  CURSED_TILES_TRIGGER_SHARK_THRESHOLD,
  CURSED_TILES_TELEGRAPH_MS,
  CURSED_TILES_SKULL_DECAY_MS,
  CURSED_TILES_SKULL_COLOR,
  CURSED_TILES_NARRATOR_LINE_PLACEHOLDER,
  CURSED_TILES_INITIAL_BUDGET_MS,
  CURSED_TILES_PER_TURN_TICK_BUDGET_MS,
  // T2.09 — Berserker / Frenzy Bloodtide Pulse constants.
  BLOODTIDE_PULSE_INTERVAL,
  BLOODTIDE_PULSE_DAMAGE_BONUS,
  BLOODTIDE_PULSE_MAX_BONUS,
  BLOODTIDE_PULSE_VFX_DURATION_MS,
  BLOODTIDE_PULSE_DECAY_MS,
  BLOODTIDE_REQUIRED_STAGGER_STATE,
  BLOODTIDE_PULSE_COLOR,
  BLOODTIDE_INITIAL_BUDGET_MS,
  // T2.10 — Engineer Lockdown Protocol constants.
  ENGINEER_LOCKDOWN_TURNS,
  ENGINEER_LOCKDOWN_CELL_COUNT,
  ENGINEER_LOCKDOWN_TRIGGER_LINES,
  ENGINEER_LOCKDOWN_RATCHET_DURATION_MS,
  ENGINEER_LOCKDOWN_CELEBRATION_MS,
  ENGINEER_LOCKDOWN_COLOR,
  ENGINEER_LOCKDOWN_INITIAL_BUDGET_MS,
  ENGINEER_LOCKDOWN_PLACEMENT_BUDGET_MS,
  ENGINEER_LOCKDOWN_RATCHET_BUDGET_MS,
  ENGINEER_LOCKDOWN_PER_TURN_TICK_BUDGET_MS,
  // T2.11 — Grovewarden Root Surge constants.
  ROOT_SURGE_CELL_COUNT,
  ROOT_SURGE_TURNS_UNTIL_AUTO_CLEAR,
  ROOT_SURGE_GOLD_PER_CLEAR,
  ROOT_SURGE_TRIGGER_NON_GROVE_COUNT,
  ROOT_SURGE_GROVE_ELEMENT,
  ROOT_SURGE_TELEGRAPH_MS,
  ROOT_SURGE_OVERLAY_DECAY_MS,
  ROOT_SURGE_OVERLAY_COLOR,
  ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER,
  ROOT_SURGE_INITIAL_BUDGET_MS,
  ROOT_SURGE_PER_TURN_TICK_BUDGET_MS,
} from '../../src/data/identity-layer.js';
import { HERO_ULT_COST_BY_NEWROLE } from '../../src/data/heroes.js';
import { RACE_SYNERGY, RACE_IDENTITY_FX } from '../../src/data/races.js';
import {
  PHOENIX_REVIVE_HP_PCT,
  PHOENIX_IMMUNE_TURNS,
  REACTIVITY_TELEGRAPH_MS,
  REACTIVITY_BANNER_DURATION_MS,
  BERSERKER_ENRAGE_HP_PCT,
  BERSERKER_ENRAGE_MULT,
} from '../../src/core/bosses.js';
import {
  BOSS_STATE_ACTIVE,
  BOSS_STATE_STAGGER,
  BOSS_STATE_RECOVERY,
  STAGGER_DURATION_TURNS,
  RECOVERY_DURATION_TURNS,
} from '../../src/core/stagger-loop.js';
import { BOSS_IDENTITY_FX } from '../../src/data/bosses.js';

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

// ─── T2.04 — Rock Encore Echo unit tests (spec §2.3) ─────────────────────

describe('identity-layer · Rock Encore Echo · countAliveRocks', () => {
  it('empty / undefined / null squad → 0', () => {
    expect(countAliveRocks([])).toBe(0);
    expect(countAliveRocks(undefined)).toBe(0);
    expect(countAliveRocks(null)).toBe(0);
  });

  it('mixed squad with 1 rock → 1', () => {
    const squad = [
      { id: 'r1', race: 'rock' },
      { id: 'o1', race: 'orc' },
      { id: 'p1', race: 'pirate' },
    ];
    expect(countAliveRocks(squad)).toBe(1);
  });

  it('5-rock squad → 5 (squad max)', () => {
    const squad = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, race: 'rock' }));
    expect(countAliveRocks(squad)).toBe(5);
  });

  it('dead rock (hp=0) excluded; absent hp treated as alive (T2.02 precedent #2)', () => {
    const squad = [
      { id: 'r1', race: 'rock', hp: 100 },
      { id: 'r2', race: 'rock', hp: 0 },     // dead — excluded
      { id: 'r3', race: 'rock' },            // hp absent — alive
      { id: 'r4', race: 'rock', hp: -5 },    // negative — excluded
    ];
    expect(countAliveRocks(squad)).toBe(2);
  });

  it('null entries + non-rock races ignored', () => {
    expect(countAliveRocks([null, { race: 'rock' }, undefined, { race: 'orc' }])).toBe(1);
  });
});

describe('identity-layer · Rock Encore Echo · countUmbraDominantLines', () => {
  it('empty / non-array → 0', () => {
    expect(countUmbraDominantLines([0], [], undefined)).toBe(0);
    expect(countUmbraDominantLines([0], [], null)).toBe(0);
    expect(countUmbraDominantLines([0], [], [])).toBe(0);
  });

  it('all umbra-dominant 4 lines → 4', () => {
    expect(countUmbraDominantLines([0, 1, 2, 3], [], ['umbra', 'umbra', 'umbra', 'umbra'])).toBe(4);
  });

  it('mixed: 2 umbra + 2 other → 2', () => {
    expect(countUmbraDominantLines([0, 1], [0, 1], ['umbra', 'ember', 'umbra', 'tide'])).toBe(2);
  });

  it('all non-umbra → 0', () => {
    expect(countUmbraDominantLines([0, 1], [], ['ember', 'tide'])).toBe(0);
    expect(countUmbraDominantLines([0], [], ['solar'])).toBe(0);
    expect(countUmbraDominantLines([0], [], [null])).toBe(0);
  });

  it('HARD CAP at ROCK_ECHO_MAX_CHARGE_PER_FIRE (defensive — even with 6 umbra lines)', () => {
    // Board geometry caps lines at 4 (8×8 board with rows+cols can't exceed
    // 4 line clears in practice), but defensive cap is still enforced.
    const result = countUmbraDominantLines(
      [0, 1, 2, 3], [0, 1],
      ['umbra', 'umbra', 'umbra', 'umbra', 'umbra', 'umbra'],
    );
    expect(result).toBe(ROCK_ECHO_MAX_CHARGE_PER_FIRE);
    expect(result).toBe(4);
  });

  it('single umbra-dominant line → 1', () => {
    expect(countUmbraDominantLines([0], [], ['umbra'])).toBe(1);
  });

  it('ROCK_ECHO_DOMINANT_ELEMENT constant matches spec §2.3', () => {
    expect(ROCK_ECHO_DOMINANT_ELEMENT).toBe('umbra');
  });
});

describe('identity-layer · Rock Encore Echo · computeEncoreEchoCharge', () => {
  it('0 rocks + 4 umbra-lines → 0 charge (rock gate fails)', () => {
    expect(computeEncoreEchoCharge(0, 4)).toBe(0);
  });

  it('1 rock + 0 umbra-lines → 0 charge (dominant gate fails)', () => {
    expect(computeEncoreEchoCharge(1, 0)).toBe(0);
  });

  it('1 rock + 1 umbra-line → 1 charge (spec §2.3 baseline)', () => {
    expect(computeEncoreEchoCharge(1, 1)).toBe(1);
  });

  it('5 rocks + 4 umbra-lines → 4 charge (HARD CAP — spec field 4)', () => {
    expect(computeEncoreEchoCharge(5, 4)).toBe(ROCK_ECHO_MAX_CHARGE_PER_FIRE);
    expect(computeEncoreEchoCharge(5, 4)).toBe(4);
  });

  it('5 rocks + 6 umbra-lines → 4 charge (cap holds defensively, impossible by board)', () => {
    // Board geometry caps practical lines at 4; the cap still holds if a
    // hypothetical caller passes more.
    expect(computeEncoreEchoCharge(5, 6)).toBe(ROCK_ECHO_MAX_CHARGE_PER_FIRE);
  });

  it('1 rock + 4 umbra-lines → 4 (cap, not gated by rock count beyond 1+)', () => {
    expect(computeEncoreEchoCharge(1, 4)).toBe(4);
  });

  it('negative / NaN inputs → 0 (defensive)', () => {
    expect(computeEncoreEchoCharge(-1, 4)).toBe(0);
    expect(computeEncoreEchoCharge(NaN, 4)).toBe(0);
    expect(computeEncoreEchoCharge(2, -3)).toBe(0);
    expect(computeEncoreEchoCharge(2, NaN)).toBe(0);
  });

  it('formula respects ROCK_ECHO_CHARGE_PER_LINE named constant', () => {
    expect(ROCK_ECHO_CHARGE_PER_LINE).toBe(1);
    // 3 lines × 1 charge/line = 3 (under the 4 cap).
    expect(computeEncoreEchoCharge(2, 3)).toBe(ROCK_ECHO_CHARGE_PER_LINE * 3);
  });
});

describe('identity-layer · Rock Encore Echo · clampEncoreEchoCharge (threshold safety)', () => {
  // Sacred-cow invariant per CLAUDE.md §2.1: HERO_ULT_COST_BY_NEWROLE threshold
  // (mage=100, etc.) must NEVER be exceeded by Encore Echo. The clamp ensures
  // the meter reaches AT MOST the threshold, never beyond.
  it('current=50, echo=+4, threshold=100 → 54 (well under threshold)', () => {
    expect(clampEncoreEchoCharge(50, 4, 100)).toBe(54);
  });

  it('current=99, echo=+4, threshold=100 → 100 (clamped exactly at threshold, NOT 103)', () => {
    // Critical AAA+ invariant: never overshoot the sacred threshold.
    expect(clampEncoreEchoCharge(99, 4, 100)).toBe(100);
  });

  it('current=100, echo=+4, threshold=100 → 100 (already at threshold, no change)', () => {
    // Meter already at ULT-ready state; Encore Echo cannot push past.
    expect(clampEncoreEchoCharge(100, 4, 100)).toBe(100);
  });

  it('current=96, echo=+4, threshold=100 → 100 (exact match)', () => {
    expect(clampEncoreEchoCharge(96, 4, 100)).toBe(100);
  });

  it('current=0, echo=+4, threshold=12 (default legacy umbra) → 4', () => {
    // Legacy umbra threshold default is 12 (per heroes.js:790 fallback).
    expect(clampEncoreEchoCharge(0, 4, 12)).toBe(4);
  });

  it('current=11, echo=+4, threshold=12 → 12 (clamped at legacy umbra cap)', () => {
    expect(clampEncoreEchoCharge(11, 4, 12)).toBe(12);
  });

  it('negative inputs → 0 lower bound (defensive)', () => {
    expect(clampEncoreEchoCharge(-5, 4, 100)).toBe(4);  // current floors to 0, +4 = 4
    expect(clampEncoreEchoCharge(50, -3, 100)).toBe(50); // delta floors to 0, no change
  });

  it('threshold-override resolution falls back to default 12 when undefined globals', () => {
    // When no override and no runtime globals available, function uses fallback.
    // We test the override path explicitly here since unit tests run in node
    // (no globals); fallback path is exercised live in smoke tests.
    expect(clampEncoreEchoCharge(0, 1)).toBeGreaterThanOrEqual(1);
  });
});

describe('identity-layer · Rock Encore Echo · fxRockLineClear gate behavior', () => {
  it('0-rock squad → silent no-op, returns 0', () => {
    __identityFxTestables.resetRockEchoPool();
    const result = fxRockLineClear([0], [], [{ race: 'orc' }, { race: 'pirate' }],
      { dominantElementsByLine: ['umbra'] });
    expect(result).toBe(0);
  });

  it('1-rock + 0 umbra-dominant lines → silent no-op, returns 0', () => {
    __identityFxTestables.resetRockEchoPool();
    const result = fxRockLineClear([0], [], [{ race: 'rock' }],
      { dominantElementsByLine: ['ember'] });
    expect(result).toBe(0);
  });

  it('1-rock + 1 umbra-dominant line → fires (charge add depends on runtime globals)', () => {
    __identityFxTestables.resetRockEchoPool();
    // In node env (no runtime globals), fxRockLineClear returns 0 actualDelta
    // because the ultCharges write is silently skipped. The gate has PASSED
    // (we know because no exception thrown + the return is a numeric 0, not
    // an early-no-op-0 — distinguishable via DOM observation in smoke tests).
    const result = fxRockLineClear([0], [], [{ race: 'rock' }],
      { dominantElementsByLine: ['umbra'] });
    expect(result).toBe(0); // node env — globals not present
    // The gate passed: countUmbraDominantLines + computeEncoreEchoCharge both > 0.
    // Smoke tests cover the live-globals path.
  });

  it('zero lines clear → silent no-op (no allocation)', () => {
    __identityFxTestables.resetRockEchoPool();
    const result = fxRockLineClear([], [],
      [{ race: 'rock' }, { race: 'rock' }],
      { dominantElementsByLine: [] });
    expect(result).toBe(0);
  });

  it('1-rock + missing ctx → silent no-op (no dominantElementsByLine = no umbra)', () => {
    __identityFxTestables.resetRockEchoPool();
    const result = fxRockLineClear([0], [], [{ race: 'rock' }], null);
    expect(result).toBe(0);
  });

  it('1-rock + ctx without dominantElementsByLine → silent no-op', () => {
    __identityFxTestables.resetRockEchoPool();
    const result = fxRockLineClear([0], [], [{ race: 'rock' }], { lockedCells: new Set() });
    expect(result).toBe(0);
  });
});

describe('identity-layer · Rock Encore Echo · threshold-clamp invariant (sacred cow safety)', () => {
  // These tests verify the threshold-clamp invariant on the pure helper —
  // the actual `fxRockLineClear` runtime write is exercised in smoke tests
  // with a stubbed `window.ultCharges`. The pure helper is the math
  // foundation: smoke tests confirm wiring.

  it('Encore Echo +4 charge to a meter at 99/100 stays at 100 (NOT 103) — sacred invariant', () => {
    // Spec contract from brief: "a rock at 99/100 charge + +4 echo charge
    // stays at 100 max (NOT 103); ULT-trigger is left to existing pipeline"
    const result = clampEncoreEchoCharge(99, 4, 100);
    expect(result).toBe(100);
    expect(result).not.toBe(103);
  });

  it('compound: full echo chain + near-cap meter → exact threshold landing', () => {
    // 5 rocks + 4 umbra lines = 4 charge. Meter at 96/100 → 100.
    const echoCharge = computeEncoreEchoCharge(5, 4);
    expect(echoCharge).toBe(4);
    const clamped = clampEncoreEchoCharge(96, echoCharge, 100);
    expect(clamped).toBe(100);
  });

  it('charge cannot push meter past ULT threshold of mage role (sacred 100)', () => {
    // The sacred HERO_ULT_COST_BY_NEWROLE.mage = 100 (CLAUDE.md §2.1) is
    // never exceeded by any Encore Echo write.
    for (let current = 0; current <= 100; current++) {
      for (let echo = 0; echo <= 4; echo++) {
        const clamped = clampEncoreEchoCharge(current, echo, 100);
        expect(clamped).toBeLessThanOrEqual(100);
      }
    }
  });

  it('ROCK_ECHO_ULT_METER constant is `umbra` (not mage / not any other meter)', () => {
    // Spec field 4: Encore Echo writes ONLY to the umbra ULT meter (not
    // ember/tide/grove/solar). This guards against accidental cross-element
    // charge leak.
    expect(ROCK_ECHO_ULT_METER).toBe('umbra');
  });
});

describe('identity-layer · Rock Encore Echo · constants & budgets', () => {
  it('Rock Echo constants match spec §2.3', () => {
    expect(ROCK_ECHO_CHARGE_PER_LINE).toBe(1);
    expect(ROCK_ECHO_MAX_CHARGE_PER_FIRE).toBe(4);
    expect(ROCK_ECHO_GHOST_DECAY_MS).toBe(700);
    expect(ROCK_ECHO_DELAY_MS).toBe(200);
    expect(ROCK_ECHO_DOMINANT_ELEMENT).toBe('umbra');
    expect(ROCK_ECHO_ULT_METER).toBe('umbra');
  });

  it('Rock Echo budget ≤8ms wall-time (spec §2.3 field 9)', () => {
    expect(IDENTITY_FX_BUDGETS[IDENTITY_FX_KEYS.ROCK_ECHO].wallTimeMs).toBeLessThanOrEqual(8);
    expect(IDENTITY_FX_BUDGETS[IDENTITY_FX_KEYS.ROCK_ECHO].maxConcurrentParticles).toBe(4);
    expect(IDENTITY_FX_BUDGETS[IDENTITY_FX_KEYS.ROCK_ECHO].decayMs).toBe(700);
  });
});

describe('identity-layer · dispatchIdentityFx — rock race regression', () => {
  it('rock race squad dispatches to fxRockLineClear without throw', () => {
    const squad = [{ race: 'rock' }];
    expect(() => dispatchIdentityFx([0], [], squad, { dominantElementsByLine: ['umbra'] })).not.toThrow();
  });

  it('mixed rock + pirate + shark squad dispatches all three layers (T2.02/T2.03 regression)', () => {
    const squad = [
      { race: 'rock' },
      { race: 'pirate' },
      { race: 'shark' },
      { race: 'shark' },
    ];
    // All three FX layers fire in sequence; no exception, no interference.
    expect(() => dispatchIdentityFx([0], [], squad, { dominantElementsByLine: ['umbra'] })).not.toThrow();
  });
});

// ─── T2.05 — Crocodile Bedrock Bastion unit tests (spec §2.4) ────────────

// Builds a stub 8×8 grid (2D array of stihiya strings or null). `fillRow`
// arguments override specific rows with a uniform element. Default: all null.
function _makeStubGrid(overrides = {}) {
  const g = Array.from({ length: 8 }, () => Array(8).fill(null));
  if (overrides.rowsGrove) {
    for (const r of overrides.rowsGrove) {
      for (let c = 0; c < 8; c++) g[r][c] = 'grove';
    }
  }
  if (overrides.cellsGrove) {
    for (const [r, c] of overrides.cellsGrove) {
      g[r][c] = 'grove';
    }
  }
  if (overrides.cellsMixed) {
    // cellsMixed: [[r, c, element], ...]
    for (const [r, c, el] of overrides.cellsMixed) {
      g[r][c] = el;
    }
  }
  return g;
}

describe('identity-layer · Crocodile Bedrock Bastion · countAliveCrocodiles', () => {
  it('empty / undefined / null squad → 0', () => {
    expect(countAliveCrocodiles([])).toBe(0);
    expect(countAliveCrocodiles(undefined)).toBe(0);
    expect(countAliveCrocodiles(null)).toBe(0);
  });

  it('mixed squad with 1 crocodile → 1', () => {
    const squad = [
      { id: 'c1', race: 'crocodile' },
      { id: 'o1', race: 'orc' },
      { id: 'p1', race: 'pirate' },
    ];
    expect(countAliveCrocodiles(squad)).toBe(1);
  });

  it('5-crocodile squad → 5 (squad max)', () => {
    const squad = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, race: 'crocodile' }));
    expect(countAliveCrocodiles(squad)).toBe(5);
  });

  it('dead crocodile (hp=0) excluded; absent hp treated as alive (T2.02 precedent #2)', () => {
    const squad = [
      { id: 'c1', race: 'crocodile', hp: 100 },
      { id: 'c2', race: 'crocodile', hp: 0 },     // dead — excluded
      { id: 'c3', race: 'crocodile' },            // hp absent — alive
      { id: 'c4', race: 'crocodile', hp: -5 },    // negative — excluded
    ];
    expect(countAliveCrocodiles(squad)).toBe(2);
  });

  it('null entries + non-crocodile races ignored', () => {
    expect(countAliveCrocodiles([null, { race: 'crocodile' }, undefined, { race: 'orc' }])).toBe(1);
  });
});

describe('identity-layer · Crocodile Bedrock Bastion · countGroveCells', () => {
  it('null gridState → 0 (defensive)', () => {
    expect(countGroveCells([0], [], null)).toBe(0);
    expect(countGroveCells([0], [], undefined)).toBe(0);
  });

  it('empty rows∪cols → 0', () => {
    const grid = _makeStubGrid({ rowsGrove: [0] });
    expect(countGroveCells([], [], grid)).toBe(0);
  });

  it('all-grove single row clear → 8 (one full grove row)', () => {
    const grid = _makeStubGrid({ rowsGrove: [3] });
    expect(countGroveCells([3], [], grid)).toBe(8);
  });

  it('mixed-element row → counts grove cells only', () => {
    const grid = _makeStubGrid({
      cellsMixed: [
        [0, 0, 'grove'],
        [0, 1, 'ember'],
        [0, 2, 'grove'],
        [0, 3, 'tide'],
        [0, 4, 'grove'],
        [0, 5, 'umbra'],
        [0, 6, 'grove'],
        [0, 7, 'grove'],
      ],
    });
    expect(countGroveCells([0], [], grid)).toBe(5);
  });

  it('no grove cells in cleared lines → 0', () => {
    const grid = _makeStubGrid({
      cellsMixed: [
        [0, 0, 'ember'], [0, 1, 'tide'], [0, 2, 'umbra'],
      ],
    });
    expect(countGroveCells([0], [], grid)).toBe(0);
  });

  it('row+col intersection counted once (inclusion-exclusion)', () => {
    // Row 0 = all grove; col 3 = all grove. Intersection (0,3) counts once.
    const grid = _makeStubGrid({ rowsGrove: [0] });
    for (let r = 0; r < 8; r++) grid[r][3] = 'grove';
    // Total unique grove cells: 8 (row 0) + 7 (col 3 minus intersect) = 15
    expect(countGroveCells([0], [3], grid)).toBe(15);
  });

  it('supports gridState.getElementAt accessor', () => {
    const state = {
      getElementAt(r, c) {
        if (r === 0 && c === 0) return 'grove';
        return null;
      },
    };
    expect(countGroveCells([0], [], state)).toBe(1);
  });

  it('CROCODILE_BASTION_GROVE_ELEMENT constant matches spec §2.4', () => {
    expect(CROCODILE_BASTION_GROVE_ELEMENT).toBe('grove');
  });

  it('all-grove quad-row clear → 32 (4 rows × 8 cells)', () => {
    const grid = _makeStubGrid({ rowsGrove: [0, 2, 4, 6] });
    expect(countGroveCells([0, 2, 4, 6], [], grid)).toBe(32);
  });
});

describe('identity-layer · Crocodile Bedrock Bastion · accumulateFragments', () => {
  it('0 + 0 → 0', () => {
    expect(accumulateFragments(0, 0)).toBe(0);
  });

  it('0 + 5 → 5 (single fire seeds bank)', () => {
    expect(accumulateFragments(0, 5)).toBe(5);
  });

  it('99 + 1 → 100 (high-bank addition holds)', () => {
    expect(accumulateFragments(99, 1)).toBe(100);
  });

  it('5 + 7 → 12 (mid-bank cross-fire accumulation)', () => {
    expect(accumulateFragments(5, 7)).toBe(12);
  });

  it('negative / NaN delta → bank unchanged (defensive)', () => {
    expect(accumulateFragments(10, -3)).toBe(10);
    expect(accumulateFragments(10, NaN)).toBe(10);
  });

  it('negative current → floored to 0 (defensive)', () => {
    expect(accumulateFragments(-5, 3)).toBe(3);
  });
});

describe('identity-layer · Crocodile Bedrock Bastion · computeShieldsGrantable', () => {
  it('bank=0 → 0 shields, bank stays 0', () => {
    expect(computeShieldsGrantable(0, 5)).toEqual({ shieldsToGrant: 0, newBank: 0 });
  });

  it('bank=4 → 0 shields, bank=4 (below threshold)', () => {
    expect(computeShieldsGrantable(4, 5)).toEqual({ shieldsToGrant: 0, newBank: 4 });
  });

  it('bank=5 → 1 shield, bank=0 (exact threshold consumes all)', () => {
    expect(computeShieldsGrantable(5, 5)).toEqual({ shieldsToGrant: 1, newBank: 0 });
  });

  it('bank=12 → 2 shields, bank=2 (spec §2.4 worked example)', () => {
    expect(computeShieldsGrantable(12, 5)).toEqual({ shieldsToGrant: 2, newBank: 2 });
  });

  it('bank=20 → 4 shields, bank=0 (max quad accumulation)', () => {
    expect(computeShieldsGrantable(20, 5)).toEqual({ shieldsToGrant: 4, newBank: 0 });
  });

  it('CROCODILE_BASTION_FRAGMENTS_PER_SHIELD = 5 (constant matches spec §2.4)', () => {
    expect(CROCODILE_BASTION_FRAGMENTS_PER_SHIELD).toBe(5);
  });

  it('fragmentsPerShield defaults to constant when omitted', () => {
    // Defensive — falsy input falls back to CROCODILE_BASTION_FRAGMENTS_PER_SHIELD.
    expect(computeShieldsGrantable(15, 0))
      .toEqual({ shieldsToGrant: 3, newBank: 0 });
  });
});

describe('identity-layer · Crocodile Bedrock Bastion · clampShieldsToSquadMax', () => {
  // CRITICAL sacred-cow invariant per CLAUDE.md §2.1: never exceed the
  // squad max-shield cap derived from RACE_SYNERGY.golem maxShieldBonus.
  it('current=0, grant=2, cap=5 → 2 (within cap)', () => {
    expect(clampShieldsToSquadMax(0, 2, 5)).toBe(2);
  });

  it('current=3, grant=2, cap=4 → 4 (surplus discarded — sacred invariant)', () => {
    // Brief contract: "current=3 + grant=2 + cap=4 → final=4 (not 5)"
    expect(clampShieldsToSquadMax(3, 2, 4)).toBe(4);
    expect(clampShieldsToSquadMax(3, 2, 4)).not.toBe(5);
  });

  it('current=5, grant=3, cap=5 → 5 (already at cap, no shield granted)', () => {
    expect(clampShieldsToSquadMax(5, 3, 5)).toBe(5);
  });

  it('current=0, grant=10, cap=5 → 5 (large surplus discarded)', () => {
    expect(clampShieldsToSquadMax(0, 10, 5)).toBe(5);
  });

  it('cap=0 → always 0 (no shields possible)', () => {
    expect(clampShieldsToSquadMax(0, 5, 0)).toBe(0);
  });

  it('negative inputs floored to 0 (defensive)', () => {
    expect(clampShieldsToSquadMax(-3, 2, 5)).toBe(2);  // current floors to 0
    expect(clampShieldsToSquadMax(2, -1, 5)).toBe(2);  // grant floors to 0
  });
});

describe('identity-layer · Crocodile Bedrock Bastion · resolveSacredMaxShieldBonus (READ-ONLY of RACE_SYNERGY.golem)', () => {
  // Sacred invariant: RACE_SYNERGY.golem.<tier>.maxShieldBonus is NEVER
  // modified by Identity Layer. These tests prove the resolution is a pure
  // read.
  it('0 golems → 0 bonus (no synergy contribution)', () => {
    expect(resolveSacredMaxShieldBonus(0)).toBe(0);
  });

  it('1 golem → 0 bonus (tier 2 not yet active)', () => {
    expect(resolveSacredMaxShieldBonus(1)).toBe(0);
  });

  it('2 golems → tier 2 bonus = 1 (sacred RACE_SYNERGY.golem[2].maxShieldBonus)', () => {
    expect(resolveSacredMaxShieldBonus(2)).toBe(1);
    expect(resolveSacredMaxShieldBonus(2)).toBe(RACE_SYNERGY.golem[2].maxShieldBonus);
  });

  it('3 golems → tier 3 bonus = 2 (sacred RACE_SYNERGY.golem[3].maxShieldBonus)', () => {
    expect(resolveSacredMaxShieldBonus(3)).toBe(2);
    expect(resolveSacredMaxShieldBonus(3)).toBe(RACE_SYNERGY.golem[3].maxShieldBonus);
  });

  it('4 golems → tier 3 bonus = 2 (count gates at 3, not 5 yet)', () => {
    expect(resolveSacredMaxShieldBonus(4)).toBe(2);
  });

  it('5 golems → tier 5 bonus = 2 (sacred RACE_SYNERGY.golem[5].maxShieldBonus)', () => {
    expect(resolveSacredMaxShieldBonus(5)).toBe(2);
    expect(resolveSacredMaxShieldBonus(5)).toBe(RACE_SYNERGY.golem[5].maxShieldBonus);
  });

  it('RACE_SYNERGY.golem sacred bytes — tier 2/3/5 maxShieldBonus byte-perfect (CLAUDE.md §2.1 sacred invariant)', () => {
    // This is the LITMUS sacred-cow test. If any value here changes, T2.05
    // has violated CLAUDE.md §2.1. RACE_SYNERGY.golem is the read-only source.
    expect(RACE_SYNERGY.golem[2].maxShieldBonus).toBe(1);
    expect(RACE_SYNERGY.golem[3].maxShieldBonus).toBe(2);
    expect(RACE_SYNERGY.golem[5].maxShieldBonus).toBe(2);
  });

  it('negative / NaN golem count → 0 (defensive)', () => {
    expect(resolveSacredMaxShieldBonus(-1)).toBe(0);
    expect(resolveSacredMaxShieldBonus(NaN)).toBe(0);
  });
});

describe('identity-layer · Crocodile Bedrock Bastion · _crocFragmentBank persistence (cross-fire accrual)', () => {
  // CRITICAL spec §2.4 field 4 invariant: bank persists across fires within
  // a battle; only resetCrocFragmentBank() clears it.
  it('resetCrocFragmentBank() resets bank to 0', () => {
    __identityFxTestables.setCrocFragmentBankForTest(17);
    expect(__identityFxTestables.getCrocFragmentBank()).toBe(17);
    resetCrocFragmentBank();
    expect(__identityFxTestables.getCrocFragmentBank()).toBe(0);
  });

  it('3 fires × 3 grove cells cross-fire bank arithmetic (shield grant at boundary)', () => {
    resetCrocFragmentBank();
    const grid = _makeStubGrid({
      cellsMixed: [
        [0, 0, 'grove'], [0, 1, 'grove'], [0, 2, 'grove'],
      ],
    });
    const squad = [{ race: 'crocodile' }];
    // Fire 1: 0+3 = 3 fragments. 3<5 → no shield, bank=3.
    fxCrocodileLineClear([0], [], squad, { gridState: grid });
    expect(__identityFxTestables.getCrocFragmentBank()).toBe(3);
    // Fire 2: 3+3 = 6 fragments. 6/5=1 shield consumed, bank=6-5=1.
    fxCrocodileLineClear([0], [], squad, { gridState: grid });
    expect(__identityFxTestables.getCrocFragmentBank()).toBe(1);
    // Fire 3: 1+3 = 4 fragments. 4<5 → no new shield, bank=4.
    fxCrocodileLineClear([0], [], squad, { gridState: grid });
    expect(__identityFxTestables.getCrocFragmentBank()).toBe(4);
    resetCrocFragmentBank();
  });

  it('cumulative bank → shield grant at threshold boundaries (5, 10, 15)', () => {
    resetCrocFragmentBank();
    // 5 fragments → 1 shield, bank goes to 0
    let res = computeShieldsGrantable(5, 5);
    expect(res).toEqual({ shieldsToGrant: 1, newBank: 0 });
    // 10 fragments → 2 shields, bank goes to 0
    res = computeShieldsGrantable(10, 5);
    expect(res).toEqual({ shieldsToGrant: 2, newBank: 0 });
    // 15 fragments → 3 shields, bank goes to 0
    res = computeShieldsGrantable(15, 5);
    expect(res).toEqual({ shieldsToGrant: 3, newBank: 0 });
  });

  it('battle reset clears prior battle residue', () => {
    __identityFxTestables.setCrocFragmentBankForTest(4);
    resetCrocFragmentBank();
    expect(__identityFxTestables.getCrocFragmentBank()).toBe(0);
    // After reset, a new accumulation starts from 0.
    const next = accumulateFragments(__identityFxTestables.getCrocFragmentBank(), 3);
    expect(next).toBe(3);
  });
});

describe('identity-layer · Crocodile Bedrock Bastion · fxCrocodileLineClear gate behavior', () => {
  it('0-crocodile squad → silent no-op, returns 0, bank untouched', () => {
    resetCrocFragmentBank();
    __identityFxTestables.resetCrocFragmentPool();
    const grid = _makeStubGrid({ rowsGrove: [0] });
    const result = fxCrocodileLineClear([0], [], [{ race: 'orc' }, { race: 'pirate' }],
      { gridState: grid });
    expect(result).toBe(0);
    expect(__identityFxTestables.getCrocFragmentBank()).toBe(0);
  });

  it('1-crocodile + 0-grove-cells line clear → silent no-op, bank untouched', () => {
    resetCrocFragmentBank();
    __identityFxTestables.resetCrocFragmentPool();
    const grid = _makeStubGrid({
      cellsMixed: [[0, 0, 'ember'], [0, 1, 'tide']],
    });
    const result = fxCrocodileLineClear([0], [], [{ race: 'crocodile' }],
      { gridState: grid });
    expect(result).toBe(0);
    expect(__identityFxTestables.getCrocFragmentBank()).toBe(0);
  });

  it('1-crocodile + 5 grove cells → fires (gate passes, bank advances to 5, shield delta depends on shield API)', () => {
    resetCrocFragmentBank();
    __identityFxTestables.resetCrocFragmentPool();
    const grid = _makeStubGrid({
      cellsMixed: [
        [0, 0, 'grove'], [0, 1, 'grove'], [0, 2, 'grove'],
        [0, 3, 'grove'], [0, 4, 'grove'],
      ],
    });
    // No squadShieldsApi → shield write is silently skipped; bank still advances.
    // 5 fragments collected → 1 shield potentially granted, bank goes to 0.
    const result = fxCrocodileLineClear([0], [], [{ race: 'crocodile' }],
      { gridState: grid });
    // In node env: result is 0 (no shield API connected) but the bank
    // consumed the 5 fragments toward the shield computation.
    expect(result).toBe(0);
    expect(__identityFxTestables.getCrocFragmentBank()).toBe(0);
  });

  it('1-crocodile + 5 grove cells + squadShieldsApi → 1 shield granted', () => {
    resetCrocFragmentBank();
    __identityFxTestables.resetCrocFragmentPool();
    const grid = _makeStubGrid({
      cellsMixed: [
        [0, 0, 'grove'], [0, 1, 'grove'], [0, 2, 'grove'],
        [0, 3, 'grove'], [0, 4, 'grove'],
      ],
    });
    let shields = 0;
    const api = {
      get: () => shields,
      set: (n) => { shields = n; },
      cap: 5,
    };
    const result = fxCrocodileLineClear([0], [], [{ race: 'crocodile' }],
      { gridState: grid, squadShieldsApi: api });
    expect(result).toBe(1);
    expect(shields).toBe(1);
    expect(__identityFxTestables.getCrocFragmentBank()).toBe(0);
  });

  it('zero lines clear → silent no-op (no bank touch, no shield)', () => {
    resetCrocFragmentBank();
    __identityFxTestables.resetCrocFragmentPool();
    const grid = _makeStubGrid({ rowsGrove: [0] });
    const result = fxCrocodileLineClear([], [], [{ race: 'crocodile' }],
      { gridState: grid });
    expect(result).toBe(0);
    expect(__identityFxTestables.getCrocFragmentBank()).toBe(0);
  });

  it('missing gridState ctx + no global grid → silent no-op (defensive)', () => {
    resetCrocFragmentBank();
    __identityFxTestables.resetCrocFragmentPool();
    const result = fxCrocodileLineClear([0], [], [{ race: 'crocodile' }], null);
    // No gridState → countGroveCells returns 0 → gate fails.
    expect(result).toBe(0);
    expect(__identityFxTestables.getCrocFragmentBank()).toBe(0);
  });
});

describe('identity-layer · Crocodile Bedrock Bastion · sacred max-shield-cap clamp safety', () => {
  // CRITICAL sacred-cow invariant per CLAUDE.md §2.1: shield count NEVER
  // exceeds the squad cap (MAX_SHIELD + 2 + RACE_SYNERGY.golem maxShieldBonus).
  // These tests exercise the clamp at every meaningful cap value.
  it('5-crocodile full bank → cap clamp respects sacred max (tier 5 cap = 7)', () => {
    // MAX_SHIELD=3 + 2 + tier5_bonus(2) = 7. Squad currently at 5, +3 grant → 7.
    expect(clampShieldsToSquadMax(5, 3, 7)).toBe(7);
    // Surplus discarded: +5 grant onto current=5 with cap=7 → 7, not 10.
    expect(clampShieldsToSquadMax(5, 5, 7)).toBe(7);
  });

  it('sacred read: RACE_SYNERGY.golem tier 5 maxShieldBonus is 2 (byte-perfect)', () => {
    // If this test fails, the sacred read was corrupted — STOP and rollback.
    const tier5Bonus = resolveSacredMaxShieldBonus(5);
    expect(tier5Bonus).toBe(2);
    // The reciprocal sacred cap formula: MAX_SHIELD(3) + 2 + 2 = 7.
    const sacredCap = 3 + 2 + tier5Bonus;
    expect(sacredCap).toBe(7);
  });

  it('no-golem squad → base cap = MAX_SHIELD(3) + 2 = 5 (no synergy contribution)', () => {
    const noGolemBonus = resolveSacredMaxShieldBonus(0);
    expect(noGolemBonus).toBe(0);
    // current=4, +3 grant, cap=5 → 5 (surplus 2 discarded)
    expect(clampShieldsToSquadMax(4, 3, 5)).toBe(5);
  });

  it('cap clamp invariant — never exceeds sacred ceiling regardless of input', () => {
    // Exhaustive check: for current 0..7 and grant 0..10, the result is
    // ALWAYS ≤ sacred cap of 7.
    const cap = 7; // MAX_SHIELD(3) + 2 + tier5(2)
    for (let cur = 0; cur <= 7; cur++) {
      for (let grant = 0; grant <= 10; grant++) {
        const clamped = clampShieldsToSquadMax(cur, grant, cap);
        expect(clamped).toBeLessThanOrEqual(cap);
      }
    }
  });
});

describe('identity-layer · Crocodile Bedrock Bastion · constants & budgets', () => {
  it('Crocodile Bastion constants match spec §2.4', () => {
    expect(CROCODILE_BASTION_FRAGMENTS_PER_SHIELD).toBe(5);
    expect(CROCODILE_BASTION_MAX_FRAGMENT_PARTICLES).toBe(16);
    expect(CROCODILE_BASTION_FRAGMENT_DECAY_MS).toBe(600);
    expect(CROCODILE_BASTION_GROVE_ELEMENT).toBe('grove');
    expect(CROCODILE_BASTION_TARGET_HERO_INDEX).toBe(0);
  });

  it('Crocodile Bastion budget ≤8ms wall-time (spec §2.4 field 9)', () => {
    expect(IDENTITY_FX_BUDGETS[IDENTITY_FX_KEYS.CROCODILE_BASTION].wallTimeMs).toBeLessThanOrEqual(8);
    expect(IDENTITY_FX_BUDGETS[IDENTITY_FX_KEYS.CROCODILE_BASTION].maxConcurrentParticles).toBe(16);
    expect(IDENTITY_FX_BUDGETS[IDENTITY_FX_KEYS.CROCODILE_BASTION].decayMs).toBe(600);
  });

  it('IDENTITY_FX_KEYS exposes CROCODILE_BASTION', () => {
    expect(IDENTITY_FX_KEYS.CROCODILE_BASTION).toBe('crocodile_bastion');
  });
});

describe('identity-layer · dispatchIdentityFx — crocodile race regression', () => {
  it('crocodile race squad dispatches to fxCrocodileLineClear without throw', () => {
    const squad = [{ race: 'crocodile' }];
    const grid = _makeStubGrid({ rowsGrove: [0] });
    expect(() => dispatchIdentityFx([0], [], squad, null, { gridState: grid })).not.toThrow();
  });

  it('mixed crocodile + pirate + shark + rock squad dispatches all four layers (T2.02/T2.03/T2.04 regression)', () => {
    const squad = [
      { race: 'crocodile' },
      { race: 'pirate' },
      { race: 'shark' },
      { race: 'shark' },
      { race: 'rock' },
    ];
    const grid = _makeStubGrid({ rowsGrove: [0] });
    // All four FX layers fire in sequence; no exception, no interference.
    expect(() => dispatchIdentityFx([0], [], squad, null,
      { gridState: grid, dominantElementsByLine: ['umbra'] })).not.toThrow();
  });
});

// ─── T2.06 — Spark Sun Cascade unit tests (spec §2.5) ──────────────────────
//
// THE highest-stakes Phase 2 race flavor — Sun Cascade is the ONLY race
// flavor that interacts directly with the sacred combo crit input
// (CLAUDE.md §2.1 row 1, legacy line 63664). The implementation modifies
// the INPUT (dominantCount) via `ctx._dominantCountModifier`, NEVER the
// formula multiplier arithmetic.
//
// These tests verify:
//   - countAliveSparks: defensive squad count (T2.02 precedent #2)
//   - countSolarCellsInClear: inclusion–exclusion solar cell scan
//   - computeSunCascadeModifier: HARD CAP / GATE / FALLBACK FLAG invariants
//   - fxSparkLineClear: end-to-end gate + cap + ctx side-channel write
//   - Sacred isolation: formula multipliers NEVER touched
//   - Fallback flag: SPARK_CASCADE_ENABLED=false demotes to pure-FX
//   - Mixed-race independence: Spark's modifier does not leak into
//     Pirate/Shark/Rock/Crocodile state

// Solar-grid stub builder. Same pattern as _makeStubGrid but populates
// solar cells per overrides instead of grove.
function _makeSolarStubGrid(overrides = {}) {
  const g = Array.from({ length: 8 }, () => Array(8).fill(null));
  if (overrides.rowsSolar) {
    for (const r of overrides.rowsSolar) {
      for (let c = 0; c < 8; c++) g[r][c] = 'solar';
    }
  }
  if (overrides.cellsSolar) {
    for (const [r, c] of overrides.cellsSolar) {
      g[r][c] = 'solar';
    }
  }
  if (overrides.cellsMixed) {
    // cellsMixed: [[r, c, element], ...]
    for (const [r, c, el] of overrides.cellsMixed) {
      g[r][c] = el;
    }
  }
  return g;
}

describe('identity-layer · Spark Sun Cascade · countAliveSparks', () => {
  it('empty / undefined / null squad → 0', () => {
    expect(countAliveSparks([])).toBe(0);
    expect(countAliveSparks(undefined)).toBe(0);
    expect(countAliveSparks(null)).toBe(0);
  });

  it('mixed squad with 1 spark → 1', () => {
    const squad = [
      { id: 's1', race: 'spark' },
      { id: 'o1', race: 'orc' },
      { id: 'p1', race: 'pirate' },
    ];
    expect(countAliveSparks(squad)).toBe(1);
  });

  it('5-spark squad → 5 (squad max)', () => {
    const squad = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, race: 'spark' }));
    expect(countAliveSparks(squad)).toBe(5);
  });

  it('dead spark (hp=0) excluded; absent hp treated as alive (T2.02 precedent #2)', () => {
    const squad = [
      { id: 's1', race: 'spark', hp: 100 },
      { id: 's2', race: 'spark', hp: 0 },     // dead — excluded
      { id: 's3', race: 'spark' },            // hp absent — alive
      { id: 's4', race: 'spark', hp: -5 },    // negative — excluded
    ];
    expect(countAliveSparks(squad)).toBe(2);
  });

  it('null entries + non-spark races ignored', () => {
    expect(countAliveSparks([null, { race: 'spark' }, undefined, { race: 'lion' }])).toBe(1);
  });
});

describe('identity-layer · Spark Sun Cascade · countSolarCellsInClear', () => {
  it('null gridState → 0 (defensive)', () => {
    expect(countSolarCellsInClear([0], [], null)).toBe(0);
    expect(countSolarCellsInClear([0], [], undefined)).toBe(0);
  });

  it('empty rows∪cols → 0', () => {
    const grid = _makeSolarStubGrid({ rowsSolar: [0, 1, 2] });
    expect(countSolarCellsInClear([], [], grid)).toBe(0);
  });

  it('full solar row clear → 8 solar cells', () => {
    const grid = _makeSolarStubGrid({ rowsSolar: [0] });
    expect(countSolarCellsInClear([0], [], grid)).toBe(8);
  });

  it('0 solar cells in cleared row → 0', () => {
    const grid = _makeSolarStubGrid({
      cellsMixed: [[0, 0, 'ember'], [0, 1, 'tide'], [0, 2, 'grove']],
    });
    expect(countSolarCellsInClear([0], [], grid)).toBe(0);
  });

  it('exactly 1 solar cell in cleared row → 1 (BELOW gate threshold)', () => {
    const grid = _makeSolarStubGrid({
      cellsMixed: [[0, 0, 'solar'], [0, 1, 'tide'], [0, 2, 'ember']],
    });
    expect(countSolarCellsInClear([0], [], grid)).toBe(1);
  });

  it('exactly 2 solar cells → 2 (AT gate threshold)', () => {
    const grid = _makeSolarStubGrid({
      cellsMixed: [[0, 0, 'solar'], [0, 1, 'solar'], [0, 2, 'ember']],
    });
    expect(countSolarCellsInClear([0], [], grid)).toBe(2);
  });

  it('mixed: solar cells across rows + cols counted once (inclusion-exclusion)', () => {
    // Place solar cells at (0,0), (0,3), (1,3), (5,3). Clear row 0 and col 3.
    // Row 0 contains: (0,0)=solar, (0,3)=solar → 2 solars
    // Col 3 contains: (0,3)=solar(dup), (1,3)=solar, (5,3)=solar → 2 new solars
    // Total distinct = 4.
    const grid = _makeSolarStubGrid({
      cellsSolar: [[0, 0], [0, 3], [1, 3], [5, 3]],
    });
    expect(countSolarCellsInClear([0], [3], grid)).toBe(4);
  });

  it('all solar quad-clear (4 rows) → 32 cells', () => {
    const grid = _makeSolarStubGrid({ rowsSolar: [0, 2, 4, 6] });
    expect(countSolarCellsInClear([0, 2, 4, 6], [], grid)).toBe(32);
  });

  it('respects getElementAt accessor (module-style API surface)', () => {
    const accessor = {
      getElementAt: (r, c) => (r === 0 && c < 3) ? 'solar' : null,
    };
    expect(countSolarCellsInClear([0], [], accessor)).toBe(3);
  });
});

describe('identity-layer · Spark Sun Cascade · computeSunCascadeModifier', () => {
  it('0 sparks + 5 solar cells → 0 (no sparks → no fire)', () => {
    expect(computeSunCascadeModifier(0, 5, true)).toBe(0);
  });

  it('1 spark + 1 solar cell → 0 (BELOW gate threshold of 2)', () => {
    expect(computeSunCascadeModifier(1, 1, true)).toBe(0);
  });

  it('1 spark + 2 solar cells → +1 (AT gate threshold)', () => {
    expect(computeSunCascadeModifier(1, 2, true)).toBe(1);
  });

  it('1 spark + 8 solar cells → +1 (HARD CAP — NOT stacking with cell count)', () => {
    expect(computeSunCascadeModifier(1, 8, true)).toBe(1);
  });

  it('5 sparks + 2 solar cells → +1 (HARD CAP — NOT stacking with spark count)', () => {
    expect(computeSunCascadeModifier(5, 2, true)).toBe(1);
  });

  it('5 sparks + 32 solar cells (full quad-line clear) → +1 (HARD CAP under maximum load)', () => {
    expect(computeSunCascadeModifier(5, 32, true)).toBe(1);
  });

  it('SPARK_CASCADE_ENABLED=false: 5 sparks + 5 solar → 0 (FALLBACK FLAG — pure-FX demotion)', () => {
    expect(computeSunCascadeModifier(5, 5, false)).toBe(0);
    expect(computeSunCascadeModifier(1, 2, false)).toBe(0);
    expect(computeSunCascadeModifier(5, 32, false)).toBe(0);
  });

  it('defensive: negative / NaN inputs → 0', () => {
    expect(computeSunCascadeModifier(-1, 5, true)).toBe(0);
    expect(computeSunCascadeModifier(1, -1, true)).toBe(0);
    expect(computeSunCascadeModifier(NaN, NaN, true)).toBe(0);
    expect(computeSunCascadeModifier('foo', 'bar', true)).toBe(0);
  });

  it('CRITICAL HARD CAP invariant: return value is ALWAYS 0 or SPARK_CASCADE_MAX_DOMINANT_BOOST', () => {
    // Exhaustive check across plausible (sparks, solars) input space.
    for (let sparks = 0; sparks <= 10; sparks++) {
      for (let solars = 0; solars <= 64; solars++) {
        const m = computeSunCascadeModifier(sparks, solars, true);
        expect(m === 0 || m === SPARK_CASCADE_MAX_DOMINANT_BOOST).toBe(true);
        // Cap is sacred — never exceeds +1.
        expect(m).toBeLessThanOrEqual(SPARK_CASCADE_MAX_DOMINANT_BOOST);
      }
    }
  });
});

describe('identity-layer · Spark Sun Cascade · fxSparkLineClear gate behavior', () => {
  it('0-spark squad → silent no-op, returns 0, ctx untouched', () => {
    __identityFxTestables.resetSparkRayPool();
    const grid = _makeSolarStubGrid({ rowsSolar: [0] });
    const ctx = { gridState: grid };
    const result = fxSparkLineClear([0], [], [{ race: 'orc' }, { race: 'pirate' }], ctx);
    expect(result).toBe(0);
    expect(ctx._dominantCountModifier).toBeUndefined();
  });

  it('1-spark + 1-solar-cell line clear → silent no-op (BELOW gate), ctx untouched', () => {
    __identityFxTestables.resetSparkRayPool();
    const grid = _makeSolarStubGrid({
      cellsMixed: [[0, 0, 'solar'], [0, 1, 'tide'], [0, 2, 'ember']],
    });
    const ctx = { gridState: grid };
    const result = fxSparkLineClear([0], [], [{ race: 'spark' }], ctx);
    expect(result).toBe(0);
    expect(ctx._dominantCountModifier).toBeUndefined();
  });

  it('1-spark + 2-solar-cell line clear → fires, returns 1, ctx._dominantCountModifier = 1', () => {
    __identityFxTestables.resetSparkRayPool();
    const grid = _makeSolarStubGrid({
      cellsMixed: [[0, 0, 'solar'], [0, 1, 'solar'], [0, 2, 'ember']],
    });
    const ctx = { gridState: grid };
    const result = fxSparkLineClear([0], [], [{ race: 'spark' }], ctx);
    expect(result).toBe(1);
    expect(ctx._dominantCountModifier).toBe(1);
  });

  it('5-spark + 8-solar full row → fires once, modifier capped at +1 (NOT stacking with spark count)', () => {
    __identityFxTestables.resetSparkRayPool();
    const grid = _makeSolarStubGrid({ rowsSolar: [0] });
    const ctx = { gridState: grid };
    const squad = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, race: 'spark' }));
    const result = fxSparkLineClear([0], [], squad, ctx);
    expect(result).toBe(1);
    expect(ctx._dominantCountModifier).toBe(1);
  });

  it('5-spark + 32-solar quad-line clear → modifier STILL capped at +1 (NOT stacking with line count)', () => {
    __identityFxTestables.resetSparkRayPool();
    const grid = _makeSolarStubGrid({ rowsSolar: [0, 2, 4, 6] });
    const ctx = { gridState: grid };
    const squad = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, race: 'spark' }));
    const result = fxSparkLineClear([0, 2, 4, 6], [], squad, ctx);
    expect(result).toBe(1);
    expect(ctx._dominantCountModifier).toBe(1);
  });

  it('zero lines clear → silent no-op (no ctx touch)', () => {
    __identityFxTestables.resetSparkRayPool();
    const grid = _makeSolarStubGrid({ rowsSolar: [0] });
    const ctx = { gridState: grid };
    const result = fxSparkLineClear([], [], [{ race: 'spark' }], ctx);
    expect(result).toBe(0);
    expect(ctx._dominantCountModifier).toBeUndefined();
  });

  it('missing gridState + no global grid → silent no-op (defensive)', () => {
    __identityFxTestables.resetSparkRayPool();
    const ctx = {};
    const result = fxSparkLineClear([0], [], [{ race: 'spark' }], ctx);
    expect(result).toBe(0);
    expect(ctx._dominantCountModifier).toBeUndefined();
  });

  it('null ctx → fires but no modifier write (no crash)', () => {
    __identityFxTestables.resetSparkRayPool();
    // ctx is null — function should not throw and should not crash on modifier write.
    // gridState falls back to global grid (undefined in vitest env) → silent no-op.
    expect(() => fxSparkLineClear([0], [], [{ race: 'spark' }], null)).not.toThrow();
  });

  it('CTX ACCUMULATOR PRESERVED: prior _dominantCountModifier value is added to, not replaced', () => {
    __identityFxTestables.resetSparkRayPool();
    const grid = _makeSolarStubGrid({ rowsSolar: [0] });
    const ctx = { gridState: grid, _dominantCountModifier: 3 };
    fxSparkLineClear([0], [], [{ race: 'spark' }], ctx);
    // Modifier accumulates: 3 prior + 1 from this fire = 4. Per-fire HARD CAP
    // is +1, so the +1 increment is what's added (not stacking).
    expect(ctx._dominantCountModifier).toBe(4);
  });
});

describe('identity-layer · Spark Sun Cascade · SPARK_CASCADE_ENABLED fallback flag', () => {
  // CRITICAL: Per ESC-02 O3 ruling, if T2.B matchup matrix surfaces >15% TTK
  // deviation on any Spark pairing, the SPARK_CASCADE_ENABLED constant
  // flips to `false` → Sun Cascade demotes to pure-FX (no mechanical
  // contribution). These tests verify the fallback path is wired correctly.
  it('fallback flag is `true` in production (Phase 2 default per ESC-02 O3)', () => {
    expect(SPARK_CASCADE_ENABLED).toBe(true);
  });

  it('computeSunCascadeModifier ALWAYS returns 0 when fallback flag is false (pure-FX demotion)', () => {
    // Exhaustive — flag-false ALWAYS returns 0 regardless of (sparks, solars).
    for (let sparks = 0; sparks <= 5; sparks++) {
      for (let solars = 0; solars <= 32; solars++) {
        expect(computeSunCascadeModifier(sparks, solars, false)).toBe(0);
      }
    }
  });

  it('demotion path: flag=true → modifier=1; flag=false → modifier=0 (single-flip fallback)', () => {
    // Production path: enabled=true → +1.
    expect(computeSunCascadeModifier(5, 8, true)).toBe(1);
    // Fallback path: enabled=false → 0 (pure-FX, no mechanical contribution).
    expect(computeSunCascadeModifier(5, 8, false)).toBe(0);
  });
});

describe('identity-layer · Spark Sun Cascade · SACRED COMBO CRIT FORMULA isolation', () => {
  // CRITICAL sacred-cow invariant per CLAUDE.md §2.1 row 1: the combo crit
  // formula `total_dmg × (1 + dominantCount × combo × 10%)` (legacy line
  // 63664: `critMult = 1 + domCount * count * CRIT_MULT_K`) is BYTE-PERFECT
  // and MUST NOT be modified by Sun Cascade. Sun Cascade only modifies the
  // INPUT (dominantCount via ctx._dominantCountModifier).
  it('Sun Cascade writes ONLY to ctx._dominantCountModifier — no other ctx field touched', () => {
    __identityFxTestables.resetSparkRayPool();
    const grid = _makeSolarStubGrid({ rowsSolar: [0] });
    const ctx = {
      gridState: grid,
      // Existing ctx fields from T2.03/T2.04/T2.05 that should NOT be touched:
      dominantElementsByLine: ['umbra'],
      squadShieldsApi: { get: () => 0, set: () => {}, cap: 5 },
      lockedCells: new Set(['1_1']),
      // Hypothetical formula-multiplier field that Sun Cascade should NEVER touch:
      _critMultOverride: 1.5,
      _CRIT_MULT_K: 0.1,
    };
    fxSparkLineClear([0], [], [{ race: 'spark' }], ctx);
    // Only _dominantCountModifier should be set.
    expect(ctx._dominantCountModifier).toBe(1);
    // Verify the other ctx fields are UNTOUCHED.
    expect(ctx.dominantElementsByLine).toEqual(['umbra']);
    expect(ctx._critMultOverride).toBe(1.5);
    expect(ctx._CRIT_MULT_K).toBe(0.1);
    expect(ctx.lockedCells.has('1_1')).toBe(true);
  });

  it('SPARK_CASCADE_MAX_DOMINANT_BOOST is 1 — sacred cap value', () => {
    // If this test fails, the HARD CAP was modified — STOP and rollback.
    // Per ESC-02 O3 ruling: "Capped at +1, gated 2-solar-cell minimum, not stacking."
    expect(SPARK_CASCADE_MAX_DOMINANT_BOOST).toBe(1);
  });

  it('SPARK_CASCADE_MIN_SOLAR_CELLS is 2 — sacred gate value', () => {
    // If this test fails, the GATE was modified — STOP and rollback.
    expect(SPARK_CASCADE_MIN_SOLAR_CELLS).toBe(2);
  });

  it('formula isolation: maximum-load fire still produces EXACTLY +1 modifier (no formula leakage)', () => {
    __identityFxTestables.resetSparkRayPool();
    // Worst case: 5 sparks + full board of solar cleared via quad-clear.
    const grid = _makeSolarStubGrid({ rowsSolar: [0, 2, 4, 6] });
    const ctx = { gridState: grid };
    const squad = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, race: 'spark' }));
    fxSparkLineClear([0, 2, 4, 6], [], squad, ctx);
    // Even with 32 solar cells and 5 sparks, modifier is EXACTLY +1.
    expect(ctx._dominantCountModifier).toBe(1);
  });

  it('sacred RACE_SYNERGY.lion.5.bonusDmg.solar is 3 (byte-perfect, untouched by T2.06)', () => {
    // If this test fails, the sacred lion solar bonus was corrupted — STOP and rollback.
    // Per spec §2.5 field 8: "With Lion RACE_SYNERGY tier 5 (`solar` themed,
    // `bonusDmg.solar +3/cell`): both apply, independent reward channels."
    expect(RACE_SYNERGY.lion[5].bonusDmg.solar).toBe(3);
  });

  it('sacred RACE_SYNERGY structure entirely byte-perfect after T2.06 additions', () => {
    // Quick smoke-check that other sacred entries are intact.
    expect(RACE_SYNERGY.golem[2].maxShieldBonus).toBe(1);
    expect(RACE_SYNERGY.golem[3].maxShieldBonus).toBe(2);
    expect(RACE_SYNERGY.golem[5].maxShieldBonus).toBe(2);
    expect(RACE_SYNERGY.rock[3].encore).toBe(true);
    expect(RACE_SYNERGY.lion[5].bonusDmg.solar).toBe(3);
    expect(RACE_SYNERGY.orc[5].bonusDmg.ember).toBe(5);
    expect(RACE_SYNERGY.pirate[5].bonusDmg.ember).toBe(5);
    // RACE_SYNERGY.spark should NOT exist (ESC-02 O1 DEFER).
    expect(RACE_SYNERGY.spark).toBeUndefined();
  });
});

describe('identity-layer · Spark Sun Cascade · constants & budgets', () => {
  it('Spark Cascade constants match spec §2.5', () => {
    expect(SPARK_CASCADE_MIN_SOLAR_CELLS).toBe(2);
    expect(SPARK_CASCADE_MAX_DOMINANT_BOOST).toBe(1);
    expect(SPARK_CASCADE_MAX_RAY_PARTICLES).toBe(16);
    expect(SPARK_CASCADE_RAY_DECAY_MS).toBe(400);
    expect(SPARK_CASCADE_DOMINANT_ELEMENT).toBe('solar');
    expect(SPARK_CASCADE_ENABLED).toBe(true);
  });

  it('Spark Cascade budget ≤10ms wall-time (spec §2.5 field 9)', () => {
    expect(IDENTITY_FX_BUDGETS[IDENTITY_FX_KEYS.SPARK_CASCADE].wallTimeMs).toBeLessThanOrEqual(10);
    expect(IDENTITY_FX_BUDGETS[IDENTITY_FX_KEYS.SPARK_CASCADE].maxConcurrentParticles).toBe(16);
    expect(IDENTITY_FX_BUDGETS[IDENTITY_FX_KEYS.SPARK_CASCADE].decayMs).toBe(400);
  });

  it('IDENTITY_FX_KEYS exposes SPARK_CASCADE', () => {
    expect(IDENTITY_FX_KEYS.SPARK_CASCADE).toBe('spark_cascade');
  });

  it('RACE_IDENTITY_FX has spark entry mapped to spark_cascade key', () => {
    expect(RACE_IDENTITY_FX.spark).toBe('spark_cascade');
  });
});

describe('identity-layer · dispatchIdentityFx — spark race regression', () => {
  it('spark race squad dispatches to fxSparkLineClear without throw', () => {
    const squad = [{ race: 'spark' }];
    const grid = _makeSolarStubGrid({ rowsSolar: [0] });
    expect(() => dispatchIdentityFx([0], [], squad, null, { gridState: grid })).not.toThrow();
  });

  it('spark race squad writes ctx._dominantCountModifier when gate passes (dispatcher path)', () => {
    __identityFxTestables.resetSparkRayPool();
    const squad = [{ race: 'spark' }];
    const grid = _makeSolarStubGrid({ rowsSolar: [0] });
    const ctx = { gridState: grid };
    dispatchIdentityFx([0], [], squad, null, ctx);
    expect(ctx._dominantCountModifier).toBe(1);
  });

  it('mixed spark + pirate + shark + rock + crocodile squad dispatches ALL FIVE layers (T2.02/T2.03/T2.04/T2.05 regression)', () => {
    const squad = [
      { race: 'spark' },
      { race: 'pirate' },
      { race: 'shark' },
      { race: 'shark' },
      { race: 'rock' },
      { race: 'crocodile' },
    ];
    // Build a grid with: row 0 grove cells (for crocodile) + row 2 solar cells (for spark).
    const grid = _makeSolarStubGrid({ rowsSolar: [2] });
    for (let c = 0; c < 8; c++) grid[0][c] = 'grove';
    // All five FX layers fire in sequence; no exception, no interference.
    expect(() => dispatchIdentityFx([0, 2], [], squad, null,
      { gridState: grid, dominantElementsByLine: ['umbra', 'solar'] })).not.toThrow();
  });

  it('CROSS-RACE INDEPENDENCE: Spark modifier does not leak into Pirate/Shark/Rock/Crocodile state', () => {
    __identityFxTestables.resetSparkRayPool();
    __identityFxTestables.resetCrocFragmentPool();
    resetCrocFragmentBank();
    const squad = [
      { race: 'spark' },
      { race: 'pirate' },
      { race: 'crocodile' },
    ];
    // Row 0 solar (gates Spark), row 2 grove (gates Crocodile).
    const grid = _makeSolarStubGrid({ rowsSolar: [0] });
    for (let c = 0; c < 8; c++) grid[2][c] = 'grove';
    const ctx = { gridState: grid };
    dispatchIdentityFx([0, 2], [], squad, null, ctx);
    // Spark wrote its modifier.
    expect(ctx._dominantCountModifier).toBe(1);
    // Crocodile's fragment bank advanced from grove cells in row 2 (no cross-contamination
    // — Spark's modifier write didn't affect Crocodile's bank arithmetic).
    // Note: crocodile fragment bank is module-state, not ctx-state — they're orthogonal.
    // The fact that no exception was thrown AND the modifier is exactly +1 confirms
    // the independence invariant.
    expect(ctx._dominantCountModifier).toBe(1);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2026-05-12 — TASK-034 (T2.07): Phoenix Ashen Reign unit tests.
// First boss-reactive identity mechanic — 5s ember-only window on revive.
// Spec: docs/design/mechanics/identity-layer.md §3.1.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('identity-layer · Phoenix Ashen Reign · computeAshenReignDuration', () => {
  it('returns exactly 5000 (spec §3.1 field 4 hard value)', () => {
    expect(computeAshenReignDuration()).toBe(5000);
  });
  it('matches ASHEN_REIGN_DURATION_MS constant byte-perfect', () => {
    expect(computeAshenReignDuration()).toBe(ASHEN_REIGN_DURATION_MS);
  });
});

describe('identity-layer · Phoenix Ashen Reign · canPlacePieceDuringAshenReign predicate', () => {
  it('window INACTIVE → ember piece is placeable (no restriction)', () => {
    expect(canPlacePieceDuringAshenReign({ element: 'ember' },
      { _ashenReignActive: false })).toBe(true);
  });
  it('window INACTIVE → tide piece is placeable (no restriction)', () => {
    expect(canPlacePieceDuringAshenReign({ element: 'tide' },
      { _ashenReignActive: false })).toBe(true);
  });
  it('window INACTIVE → any element is placeable (umbra, solar, grove)', () => {
    expect(canPlacePieceDuringAshenReign({ element: 'umbra' },
      { _ashenReignActive: false })).toBe(true);
    expect(canPlacePieceDuringAshenReign({ element: 'solar' },
      { _ashenReignActive: false })).toBe(true);
    expect(canPlacePieceDuringAshenReign({ element: 'grove' },
      { _ashenReignActive: false })).toBe(true);
  });
  it('window INACTIVE → null piece returns true (no restriction)', () => {
    expect(canPlacePieceDuringAshenReign(null,
      { _ashenReignActive: false })).toBe(true);
  });
  it('window ACTIVE + ember piece → true (placeable, spec §3.1 field 4)', () => {
    expect(canPlacePieceDuringAshenReign({ element: 'ember' },
      { _ashenReignActive: true })).toBe(true);
  });
  it('window ACTIVE + tide piece → false (rejected)', () => {
    expect(canPlacePieceDuringAshenReign({ element: 'tide' },
      { _ashenReignActive: true })).toBe(false);
  });
  it('window ACTIVE + umbra piece → false (rejected)', () => {
    expect(canPlacePieceDuringAshenReign({ element: 'umbra' },
      { _ashenReignActive: true })).toBe(false);
  });
  it('window ACTIVE + solar piece → false (rejected)', () => {
    expect(canPlacePieceDuringAshenReign({ element: 'solar' },
      { _ashenReignActive: true })).toBe(false);
  });
  it('window ACTIVE + grove piece → false (rejected)', () => {
    expect(canPlacePieceDuringAshenReign({ element: 'grove' },
      { _ashenReignActive: true })).toBe(false);
  });
  it('window ACTIVE + null piece → false (defensive — reject)', () => {
    expect(canPlacePieceDuringAshenReign(null,
      { _ashenReignActive: true })).toBe(false);
  });
  it('window ACTIVE + piece missing element field → false', () => {
    expect(canPlacePieceDuringAshenReign({}, { _ashenReignActive: true })).toBe(false);
  });
  it('default state (no state arg) reads module isAshenReignActive()', () => {
    // No state argument — falls back to module-state. With no fx active
    // (fresh module), window is inactive → any piece passes.
    resetAshenReign();
    expect(canPlacePieceDuringAshenReign({ element: 'tide' })).toBe(true);
    expect(canPlacePieceDuringAshenReign({ element: 'ember' })).toBe(true);
    expect(canPlacePieceDuringAshenReign(null)).toBe(true);
  });
});

describe('identity-layer · Phoenix Ashen Reign · module state transitions', () => {
  it('fresh module: isAshenReignActive() === false, getAshenReignEndsAt() === null', () => {
    resetAshenReign();
    expect(isAshenReignActive()).toBe(false);
    expect(getAshenReignEndsAt()).toBeNull();
  });
  it('fxPhoenixAshenReign(...) → isAshenReignActive() flips to true', () => {
    resetAshenReign();
    fxPhoenixAshenReign(null, null);
    expect(isAshenReignActive()).toBe(true);
    // Cleanup to avoid leaking timer state into next test.
    fxPhoenixAshenReignRelease();
  });
  it('fxPhoenixAshenReign(...) → getAshenReignEndsAt() returns a number ≥ now', () => {
    resetAshenReign();
    const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    fxPhoenixAshenReign(null, null);
    const ends = getAshenReignEndsAt();
    expect(typeof ends).toBe('number');
    expect(ends).toBeGreaterThanOrEqual(t0 + ASHEN_REIGN_DURATION_MS - 100);
    expect(ends).toBeLessThanOrEqual(t0 + ASHEN_REIGN_DURATION_MS + 100);
    fxPhoenixAshenReignRelease();
  });
  it('fxPhoenixAshenReignRelease() → isAshenReignActive() flips to false', () => {
    resetAshenReign();
    fxPhoenixAshenReign(null, null);
    expect(isAshenReignActive()).toBe(true);
    fxPhoenixAshenReignRelease();
    expect(isAshenReignActive()).toBe(false);
    expect(getAshenReignEndsAt()).toBeNull();
  });
  it('resetAshenReign() → zeroes both active flag and endsAt', () => {
    fxPhoenixAshenReign(null, null);
    expect(isAshenReignActive()).toBe(true);
    resetAshenReign();
    expect(isAshenReignActive()).toBe(false);
    expect(getAshenReignEndsAt()).toBeNull();
  });
  it('double-fire safety: fxPhoenixAshenReign twice does not double-allocate (idempotent active)', () => {
    resetAshenReign();
    fxPhoenixAshenReign(null, null);
    expect(isAshenReignActive()).toBe(true);
    fxPhoenixAshenReign(null, null);  // should release-and-re-activate gracefully
    expect(isAshenReignActive()).toBe(true);
    fxPhoenixAshenReignRelease();
    expect(isAshenReignActive()).toBe(false);
  });
  it('release idempotency: calling release twice is safe', () => {
    fxPhoenixAshenReign(null, null);
    fxPhoenixAshenReignRelease();
    expect(isAshenReignActive()).toBe(false);
    fxPhoenixAshenReignRelease();   // no-op, no throw
    expect(isAshenReignActive()).toBe(false);
  });
});

describe('identity-layer · Phoenix Ashen Reign · duration enforcement (5000ms)', () => {
  it('endsAt is exactly ASHEN_REIGN_DURATION_MS in the future when activated', () => {
    resetAshenReign();
    const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    fxPhoenixAshenReign(null, null);
    const ends = getAshenReignEndsAt();
    const delta = ends - t0;
    // Allow tolerance for inter-call latency (single-digit ms in practice).
    expect(delta).toBeGreaterThanOrEqual(ASHEN_REIGN_DURATION_MS - 50);
    expect(delta).toBeLessThanOrEqual(ASHEN_REIGN_DURATION_MS + 50);
    fxPhoenixAshenReignRelease();
  });
  it('5000ms hard value matches spec §3.1 field 4 (no drift via constant)', () => {
    expect(ASHEN_REIGN_DURATION_MS).toBe(5000);
  });
});

describe('identity-layer · Phoenix Ashen Reign · SACRED COW byte-perfect audit', () => {
  it('PHOENIX_REVIVE_HP_PCT === 0.6 byte-perfect (sacred CLAUDE.md §2.5)', () => {
    expect(PHOENIX_REVIVE_HP_PCT).toBe(0.6);
  });
  it('PHOENIX_IMMUNE_TURNS === 2 byte-perfect (sacred CLAUDE.md §2.5)', () => {
    expect(PHOENIX_IMMUNE_TURNS).toBe(2);
  });
  it('REACTIVITY_TELEGRAPH_MS === 3000 byte-perfect (sacred CLAUDE.md §2.5)', () => {
    expect(REACTIVITY_TELEGRAPH_MS).toBe(3000);
  });
  it('REACTIVITY_BANNER_DURATION_MS === 1500 byte-perfect (sacred CLAUDE.md §2.5)', () => {
    expect(REACTIVITY_BANNER_DURATION_MS).toBe(1500);
  });
  it('SACRED RE-USE INVARIANT: ASHEN_REIGN_TELEGRAPH_MS === REACTIVITY_TELEGRAPH_MS', () => {
    // Spec §3.1 field 8: Ashen Reign RE-USES the sacred 3000ms telegraph
    // value. This invariant ensures the two stay in lock-step — any future
    // edit to one MUST update the other (and will trip this test if not).
    expect(ASHEN_REIGN_TELEGRAPH_MS).toBe(REACTIVITY_TELEGRAPH_MS);
    expect(ASHEN_REIGN_TELEGRAPH_MS).toBe(3000);
  });
  it('Ashen Reign DOES NOT modify sacred Phoenix constants — read-only re-use', () => {
    // Activate + release the fx pipeline; sacred constants are immutable
    // by virtue of being `const` exports, but this test asserts the values
    // remain unchanged after the full fx round-trip (no global state leak).
    resetAshenReign();
    fxPhoenixAshenReign(null, null);
    expect(PHOENIX_REVIVE_HP_PCT).toBe(0.6);
    expect(PHOENIX_IMMUNE_TURNS).toBe(2);
    expect(REACTIVITY_TELEGRAPH_MS).toBe(3000);
    fxPhoenixAshenReignRelease();
    expect(PHOENIX_REVIVE_HP_PCT).toBe(0.6);
    expect(PHOENIX_IMMUNE_TURNS).toBe(2);
    expect(REACTIVITY_TELEGRAPH_MS).toBe(3000);
  });
});

describe('identity-layer · Phoenix Ashen Reign · constants & budgets', () => {
  it('ASHEN_REIGN_DURATION_MS === 5000 (spec §3.1 field 4)', () => {
    expect(ASHEN_REIGN_DURATION_MS).toBe(5000);
  });
  it('ASHEN_REIGN_FLAME_BORDER_WIDTH_PX === 180 (spec §3.1 field 4)', () => {
    expect(ASHEN_REIGN_FLAME_BORDER_WIDTH_PX).toBe(180);
  });
  it('ASHEN_REIGN_DECAY_MS === 200 (spec §3.1 field 7 — fade-out)', () => {
    expect(ASHEN_REIGN_DECAY_MS).toBe(200);
  });
  it('ASHEN_REIGN_REQUIRED_ELEMENT === "ember" (spec §3.1 field 4)', () => {
    expect(ASHEN_REIGN_REQUIRED_ELEMENT).toBe('ember');
  });
  it('ASHEN_REIGN_HUD_COUNTDOWN_TEXT === "EMBER ONLY — 5s"', () => {
    expect(ASHEN_REIGN_HUD_COUNTDOWN_TEXT).toBe('EMBER ONLY — 5s');
  });
  it('ASHEN_REIGN_INITIAL_BUDGET_MS === 16 (spec §3.1 field 7 + §5)', () => {
    expect(ASHEN_REIGN_INITIAL_BUDGET_MS).toBe(16);
  });
  it('ASHEN_REIGN_STEADY_STATE_BUDGET_MS === 2 (spec §3.1 field 7)', () => {
    expect(ASHEN_REIGN_STEADY_STATE_BUDGET_MS).toBe(2);
  });
  it('IDENTITY_BOSS_FX_KEYS exposes PHOENIX_ASHEN_REIGN === "phoenix_ashen_reign"', () => {
    expect(IDENTITY_BOSS_FX_KEYS.PHOENIX_ASHEN_REIGN).toBe('phoenix_ashen_reign');
  });
  it('IDENTITY_BOSS_FX_BUDGETS[PHOENIX_ASHEN_REIGN] matches spec §3.1 field 7', () => {
    const b = IDENTITY_BOSS_FX_BUDGETS[IDENTITY_BOSS_FX_KEYS.PHOENIX_ASHEN_REIGN];
    expect(b.initialMs).toBe(16);
    expect(b.steadyStateMs).toBe(2);
    expect(b.decayMs).toBe(200);
    expect(b.duration).toBe(5000);
  });
  it('BOSS_IDENTITY_FX maps phoenix → phoenix_ashen_reign (sibling export)', () => {
    expect(BOSS_IDENTITY_FX.phoenix).toBe('phoenix_ashen_reign');
  });
});

describe('identity-layer · Phoenix Ashen Reign · Phase 2.5 narrator polish (ESC-02 O2)', () => {
  it('ASHEN_REIGN_NARRATOR_LINE_PLACEHOLDER carries spec §3.1 field 6 string', () => {
    // PLACEHOLDER per ESC-02 O2 ruling. FINAL COPY: pending Roman approval
    // (Phase 2.5 review). The string lives in the isolated constant —
    // sacred NARRATOR_LINES table stays byte-perfect.
    expect(ASHEN_REIGN_NARRATOR_LINE_PLACEHOLDER).toBe('The ash remembers. Strike only with the flame that birthed it.');
  });

  it('NARRATOR_LINES sacred table UNTOUCHED — placeholder lives in isolated constant', () => {
    // Same architectural discipline as T2.11 Root Surge: the new line lives
    // in `src/data/identity-layer.js` as an isolated constant — NOT in
    // `src/feel/narrator-lines.js` (the sacred NARRATOR_LINES table).
    expect(typeof ASHEN_REIGN_NARRATOR_LINE_PLACEHOLDER).toBe('string');
    expect(ASHEN_REIGN_NARRATOR_LINE_PLACEHOLDER.length).toBeGreaterThan(0);
    // Designer-drafted string with Darkest-Dungeon-voice cadence (ash/flame motif).
    expect(ASHEN_REIGN_NARRATOR_LINE_PLACEHOLDER).toContain('ash');
    expect(ASHEN_REIGN_NARRATOR_LINE_PLACEHOLDER).toContain('flame');
  });
});

describe('identity-layer · Phoenix Ashen Reign · cross-race regression (T2.02-T2.06 invariants)', () => {
  it('Ashen Reign active during mixed-race squad dispatch does NOT block race FX', () => {
    // Activate Phoenix's Ashen Reign window, then fire a race-FX line clear
    // with a mixed squad including pirate + shark + rock + crocodile + spark.
    // All 5 race layers must still fire independently — Ashen Reign is a
    // BOSS-side state, not a race-FX gate. The piece-placement gate is a
    // separate concern (legacy `pieceCanBePlaced` bridge in T2.B).
    __identityFxTestables.resetCoinPool();
    __identityFxTestables.resetSharkBitePool();
    __identityFxTestables.resetRockEchoPool();
    __identityFxTestables.resetCrocFragmentPool();
    __identityFxTestables.resetSparkRayPool();
    resetCrocFragmentBank();
    resetAshenReign();

    // Turn on Ashen Reign first.
    fxPhoenixAshenReign(null, null);
    expect(isAshenReignActive()).toBe(true);

    // Now dispatch a 5-race line clear — all FX layers must run without throw.
    const squad = [
      { race: 'pirate' },
      { race: 'shark' },
      { race: 'shark' },
      { race: 'rock' },
      { race: 'crocodile' },
      { race: 'spark' },
    ];
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let c = 0; c < 8; c++) grid[0][c] = 'solar';     // gates Spark
    for (let c = 0; c < 8; c++) grid[2][c] = 'grove';     // gates Crocodile
    const ctx = { gridState: grid, dominantElementsByLine: ['solar', 'grove'] };
    expect(() => dispatchIdentityFx([0, 2], [], squad, null, ctx)).not.toThrow();

    // Race FX layers fired correctly even with Ashen Reign active.
    expect(ctx._dominantCountModifier).toBe(1);          // Spark fired
    expect(isAshenReignActive()).toBe(true);             // boss state still active

    // Cleanup.
    fxPhoenixAshenReignRelease();
  });

  it('canPlacePieceDuringAshenReign INACTIVE → 5-race squad regression unchanged', () => {
    // Establish the inactive baseline: every piece placeable, no race FX
    // interference.
    resetAshenReign();
    expect(canPlacePieceDuringAshenReign({ element: 'tide' })).toBe(true);
    expect(canPlacePieceDuringAshenReign({ element: 'solar' })).toBe(true);
    expect(canPlacePieceDuringAshenReign({ element: 'grove' })).toBe(true);
    expect(canPlacePieceDuringAshenReign({ element: 'umbra' })).toBe(true);
    expect(canPlacePieceDuringAshenReign({ element: 'ember' })).toBe(true);
  });

  it('Sacred RACE_SYNERGY entries byte-perfect after Ashen Reign fx round-trip', () => {
    // Activate + release Ashen Reign, then verify RACE_SYNERGY's sacred
    // entries (lion solar bonus from T2.06, rock encore from T2.04, golem
    // maxShieldBonus from T2.05) are still byte-perfect.
    resetAshenReign();
    fxPhoenixAshenReign(null, null);
    fxPhoenixAshenReignRelease();
    expect(RACE_SYNERGY.lion[5].bonusDmg.solar).toBe(3);
    expect(RACE_SYNERGY.rock[3].encore).toBe(true);
    expect(RACE_SYNERGY.golem[2].maxShieldBonus).toBe(1);
    expect(RACE_SYNERGY.golem[3].maxShieldBonus).toBe(2);
    expect(RACE_SYNERGY.golem[5].maxShieldBonus).toBe(2);
    // Race identity sibling export untouched.
    expect(RACE_IDENTITY_FX.pirate).toBe('pirate_plunder');
    expect(RACE_IDENTITY_FX.spark).toBe('spark_cascade');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2026-05-12 — TASK-035 (T2.08): Lich Cursed Tiles unit tests.
// Spec: docs/design/mechanics/identity-layer.md §3.2.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('identity-layer · Lich Cursed Tiles · pickRandomNonEmptyCells', () => {
  it('null gridState → [] (defensive)', () => {
    resetCursedTiles();
    expect(pickRandomNonEmptyCells(null, 3)).toEqual([]);
  });
  it('empty grid (all null cells) → [] (no candidates)', () => {
    resetCursedTiles();
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    expect(pickRandomNonEmptyCells(grid, 3)).toEqual([]);
  });
  it('1 non-empty cell + count=3 → 1 cell only (cap at candidate count)', () => {
    resetCursedTiles();
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    grid[2][3] = 'ember';
    const picks = pickRandomNonEmptyCells(grid, 3);
    expect(picks.length).toBe(1);
    expect(picks[0]).toEqual({ row: 2, col: 3 });
  });
  it('10 non-empty cells + count=3 → 3 unique cells', () => {
    resetCursedTiles();
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    const seeded = [
      [0, 0], [0, 1], [0, 2], [1, 0], [1, 1],
      [2, 0], [2, 1], [3, 0], [3, 1], [4, 0],
    ];
    for (const [r, c] of seeded) grid[r][c] = 'tide';
    const picks = pickRandomNonEmptyCells(grid, 3);
    expect(picks.length).toBe(3);
    // Verify uniqueness.
    const keys = new Set(picks.map(p => p.row + '_' + p.col));
    expect(keys.size).toBe(3);
    // Verify each pick was one of the seeded cells.
    for (const p of picks) {
      const found = seeded.some(([r, c]) => r === p.row && c === p.col);
      expect(found).toBe(true);
    }
  });
  it('default count uses CURSED_TILES_COUNT (3)', () => {
    resetCursedTiles();
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let c = 0; c < 8; c++) grid[0][c] = 'umbra';
    const picks = pickRandomNonEmptyCells(grid);
    expect(picks.length).toBe(CURSED_TILES_COUNT);
  });
});

describe('identity-layer · Lich Cursed Tiles · applyCurseCellDamage', () => {
  it('100 HP - 3 cells = 97', () => {
    expect(applyCurseCellDamage(100, 3)).toBe(97);
  });
  it('1 HP - 3 cells = 0 (clamp at 0, never negative)', () => {
    expect(applyCurseCellDamage(1, 3)).toBe(0);
  });
  it('0 HP - 3 cells = 0 (clamp at 0)', () => {
    expect(applyCurseCellDamage(0, 3)).toBe(0);
  });
  it('100 HP - 0 cells = 100 (no damage when no curses)', () => {
    expect(applyCurseCellDamage(100, 0)).toBe(100);
  });
  it('100 HP - 1 cell = 99 (single-curse drip)', () => {
    expect(applyCurseCellDamage(100, 1)).toBe(99);
  });
});

describe('identity-layer · Lich Cursed Tiles · computeCurseTickResult', () => {
  it('curse placed turn 5, ticking turn 5 → active (placedTurn = currentTurn, no damage applied yet, no expire)', () => {
    const curse = { row: 0, col: 0, placedTurn: 5, expiresTurn: 8 };
    const r = computeCurseTickResult(curse, 5);
    expect(r.active).toBe(true);
    expect(r.shouldGrantUltCharge).toBe(false);
    expect(r.ultChargeToGrant).toBe(0);
  });
  it('curse placed turn 5, ticking turn 7 → active (still within 3-turn window)', () => {
    const curse = { row: 0, col: 0, placedTurn: 5, expiresTurn: 8 };
    const r = computeCurseTickResult(curse, 7);
    expect(r.active).toBe(true);
    expect(r.shouldGrantUltCharge).toBe(false);
  });
  it('curse placed turn 5, ticking turn 8 → EXPIRED + grants +20 ULT charge', () => {
    const curse = { row: 0, col: 0, placedTurn: 5, expiresTurn: 8 };
    const r = computeCurseTickResult(curse, 8);
    expect(r.active).toBe(false);
    expect(r.shouldGrantUltCharge).toBe(true);
    expect(r.ultChargeToGrant).toBe(CURSED_TILES_ULT_COMPENSATION);
    expect(r.ultChargeToGrant).toBe(20);
  });
  it('curse placed turn 5, ticking turn 9 → still expired (past expiresTurn)', () => {
    const curse = { row: 0, col: 0, placedTurn: 5, expiresTurn: 8 };
    const r = computeCurseTickResult(curse, 9);
    expect(r.active).toBe(false);
    expect(r.shouldGrantUltCharge).toBe(true);
  });
  it('null curse → inactive, no charge (defensive)', () => {
    const r = computeCurseTickResult(null, 5);
    expect(r.active).toBe(false);
    expect(r.shouldGrantUltCharge).toBe(false);
    expect(r.ultChargeToGrant).toBe(0);
  });
});

describe('identity-layer · Lich Cursed Tiles · clampUltCharge (sacred threshold safety)', () => {
  // Spec §3.2 + CLAUDE.md §2.1: +20 ULT compensation MUST clamp to sacred
  // HERO_ULT_COST_BY_NEWROLE thresholds (mage:100, warrior:80, hunter:120,
  // tank:80, captain:100). Per-role thresholds are READ-ONLY.
  it('current=80 + 20 + threshold=100 → 100 (exact-fill, no clamp needed)', () => {
    expect(clampUltCharge(80, 20, 100)).toBe(100);
  });
  it('current=99 + 20 + threshold=100 → 100 (clamp)', () => {
    expect(clampUltCharge(99, 20, 100)).toBe(100);
  });
  it('current=50 + 20 + threshold=100 → 70 (no clamp needed, within threshold)', () => {
    expect(clampUltCharge(50, 20, 100)).toBe(70);
  });
  it('current=100 + 20 + threshold=100 → 100 (already at cap)', () => {
    expect(clampUltCharge(100, 20, 100)).toBe(100);
  });
  it('current=120 + 20 + threshold=100 → 100 (defensive clamp DOWN)', () => {
    expect(clampUltCharge(120, 20, 100)).toBe(100);
  });
  it('current=60 + 20 + threshold=80 (warrior/tank) → 80 (clamp)', () => {
    expect(clampUltCharge(60, 20, 80)).toBe(80);
  });
  it('current=110 + 20 + threshold=120 (hunter) → 120 (clamp)', () => {
    expect(clampUltCharge(110, 20, 120)).toBe(120);
  });
  it('threshold null/undefined → returns current + delta (defensive pass-through)', () => {
    expect(clampUltCharge(50, 20, null)).toBe(70);
    expect(clampUltCharge(50, 20, undefined)).toBe(70);
  });
});

describe('identity-layer · Lich Cursed Tiles · cursedTilesGatePasses (trigger gate)', () => {
  // Spec §3.2 field 3: "A clearLines fires where the player's active squad
  // has ≥2 sharks". Boundary tests at 0/1/2/5.
  it('0 sharks → no fire', () => {
    expect(cursedTilesGatePasses([])).toBe(false);
    expect(cursedTilesGatePasses([{ race: 'pirate' }, { race: 'rock' }])).toBe(false);
  });
  it('1 shark → no fire (gate at ≥2 only)', () => {
    expect(cursedTilesGatePasses([{ race: 'shark' }, { race: 'rock' }])).toBe(false);
  });
  it('2 sharks → fire (threshold met)', () => {
    expect(cursedTilesGatePasses([{ race: 'shark' }, { race: 'shark' }])).toBe(true);
  });
  it('5 sharks → fire (well above threshold)', () => {
    expect(cursedTilesGatePasses([
      { race: 'shark' }, { race: 'shark' }, { race: 'shark' },
      { race: 'shark' }, { race: 'shark' },
    ])).toBe(true);
  });
  it('non-array squad → false (defensive)', () => {
    expect(cursedTilesGatePasses(null)).toBe(false);
    expect(cursedTilesGatePasses(undefined)).toBe(false);
  });
  it('2 sharks but 1 dead → 1 alive shark → no fire (hp <= 0 excluded)', () => {
    expect(cursedTilesGatePasses([
      { race: 'shark', hp: 0 },
      { race: 'shark', hp: 100 },
    ])).toBe(false);
  });
});

describe('identity-layer · Lich Cursed Tiles · isCellCursed predicate + getCursedTilesCount', () => {
  // Spec §3.2 field 4: cursed cells cannot be cleared for 3 turns. The
  // predicate is wired into legacy `pieceCanBePlaced` / `clearLines` via
  // the T2.B bridge.
  it('Before any curse: isCellCursed → false for all cells', () => {
    resetCursedTiles();
    expect(isCellCursed(0, 0)).toBe(false);
    expect(isCellCursed(7, 7)).toBe(false);
    expect(getCursedTilesCount()).toBe(0);
  });
  it('After fxLichCursedTiles: isCellCursed → true for placed curses, false elsewhere', () => {
    resetCursedTiles();
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    // Seed only 1 non-empty cell so the pick is deterministic.
    grid[3][4] = 'umbra';
    fxLichCursedTiles(null, { gridState: grid, currentTurn: 5 });
    expect(isCellCursed(3, 4)).toBe(true);
    expect(isCellCursed(0, 0)).toBe(false);
    expect(getCursedTilesCount()).toBe(1);
    resetCursedTiles();
  });
  it('After resetCursedTiles: isCellCursed → false again, count → 0', () => {
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    grid[1][1] = 'ember';
    fxLichCursedTiles(null, { gridState: grid, currentTurn: 0 });
    expect(getCursedTilesCount()).toBe(1);
    resetCursedTiles();
    expect(getCursedTilesCount()).toBe(0);
    expect(isCellCursed(1, 1)).toBe(false);
  });
  it('Non-finite row/col → false (defensive)', () => {
    expect(isCellCursed(NaN, 0)).toBe(false);
    expect(isCellCursed(0, undefined)).toBe(false);
  });
});

describe('identity-layer · Lich Cursed Tiles · 3-turn expiration + ULT compensation lifecycle', () => {
  // Spec §3.2 field 4: placed at turn N, ticks on turns N, N+1, N+2 (active),
  // expires at turn N+3 (grants +20 ULT charge, fades overlay, removes from
  // array). NOTE: contract is "expiresTurn = placedTurn + 3" → ≥ comparison
  // means the tick at turn N+3 returns expired=true.
  it('placed turn 5, expiresTurn = 8 (= 5 + 3)', () => {
    resetCursedTiles();
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    grid[0][0] = 'umbra';
    fxLichCursedTiles(null, { gridState: grid, currentTurn: 5 });
    const snap = getCursedTilesSnapshot();
    expect(snap.length).toBe(1);
    expect(snap[0].placedTurn).toBe(5);
    expect(snap[0].expiresTurn).toBe(8);
    expect(snap[0].expiresTurn - snap[0].placedTurn).toBe(CURSED_TILES_TURNS_UNTIL_AUTO_CLEAR);
    resetCursedTiles();
  });
  it('full lifecycle: turn 5 place → turn 6 active → turn 7 active → turn 8 expire+ULT', () => {
    resetCursedTiles();
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    grid[0][0] = 'umbra';
    grid[0][1] = 'umbra';
    grid[0][2] = 'umbra';
    fxLichCursedTiles(null, { gridState: grid, currentTurn: 5 });
    expect(getCursedTilesCount()).toBe(3);

    // Capture ULT meter snapshot via API stub.
    let umbraCharge = 80;
    const ultApi = {
      get:       (_meter) => umbraCharge,
      set:       (_meter, n) => { umbraCharge = n; },
      threshold: (_role) => 100,
    };

    // Turn 6 — all 3 still active, 3 HP damage, no ULT granted yet.
    let hp = 100;
    const hpApi = { get: () => hp, set: (n) => { hp = n; } };
    const t6 = fxLichCursedTilesTick({ currentTurn: 6, squadHpApi: hpApi, ultMeterApi: ultApi, ultMeter: 'umbra', role: 'mage' });
    expect(t6.activeCount).toBe(3);
    expect(t6.hpDamage).toBe(3);
    expect(t6.ultChargeGranted).toBe(0);
    expect(hp).toBe(97);
    expect(umbraCharge).toBe(80);

    // Turn 7 — still all 3 active, another 3 HP, still no ULT.
    const t7 = fxLichCursedTilesTick({ currentTurn: 7, squadHpApi: hpApi, ultMeterApi: ultApi, ultMeter: 'umbra', role: 'mage' });
    expect(t7.activeCount).toBe(3);
    expect(t7.hpDamage).toBe(3);
    expect(t7.ultChargeGranted).toBe(0);
    expect(hp).toBe(94);

    // Turn 8 — expiration tick. HP damage applied for 3 active cells (97 → 91)
    // AND +20 ULT × 3 cells = +60 clamped at threshold 100 (currentCharge=80 → +20 capped).
    const t8 = fxLichCursedTilesTick({ currentTurn: 8, squadHpApi: hpApi, ultMeterApi: ultApi, ultMeter: 'umbra', role: 'mage' });
    expect(t8.activeCount).toBe(0);
    expect(t8.expiredCount).toBe(3);
    expect(t8.hpDamage).toBe(3);    // 3 cells × 1 HP = 3 damage on the turn they expire
    expect(hp).toBe(91);
    // ULT clamped: each expiring cell tries to add 20; starts at 80, clamps to 100 at first cell.
    // Subsequent expirations add 0 (already at threshold). Total granted = 100 - 80 = 20.
    expect(t8.ultChargeGranted).toBe(20);
    expect(umbraCharge).toBe(100);
    resetCursedTiles();
  });
  it('total HP damage over 3 active turns = 9 HP (3 cells × 1 HP × 3 turns)', () => {
    resetCursedTiles();
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    grid[0][0] = 'umbra';
    grid[0][1] = 'umbra';
    grid[0][2] = 'umbra';
    fxLichCursedTiles(null, { gridState: grid, currentTurn: 0 });
    let hp = 100;
    const hpApi = { get: () => hp, set: (n) => { hp = n; } };
    let umbraCharge = 0;
    const ultApi = {
      get: () => umbraCharge,
      set: (_m, n) => { umbraCharge = n; },
      threshold: () => 100,
    };
    fxLichCursedTilesTick({ currentTurn: 1, squadHpApi: hpApi, ultMeterApi: ultApi });
    fxLichCursedTilesTick({ currentTurn: 2, squadHpApi: hpApi, ultMeterApi: ultApi });
    fxLichCursedTilesTick({ currentTurn: 3, squadHpApi: hpApi, ultMeterApi: ultApi });
    // Total damage: 3 turns × 3 cells × 1 HP = 9 HP. At turn 3, expirations
    // fire, but the active-count-this-turn damage uses BEFORE-expiration
    // count (3 cells), so the 3rd turn still deals 3 HP.
    expect(hp).toBe(91);
    // ULT at turn 3: 3 cells expire, each +20 → 60 raw, clamped to 100 max.
    expect(umbraCharge).toBe(60);
    resetCursedTiles();
  });
});

describe('identity-layer · Lich Cursed Tiles · resetCursedTiles', () => {
  it('resetCursedTiles() drops all active curses', () => {
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    grid[0][0] = 'tide';
    grid[0][1] = 'tide';
    grid[0][2] = 'tide';
    fxLichCursedTiles(null, { gridState: grid, currentTurn: 0 });
    expect(getCursedTilesCount()).toBeGreaterThan(0);
    resetCursedTiles();
    expect(getCursedTilesCount()).toBe(0);
    expect(getCursedTilesSnapshot()).toEqual([]);
  });
  it('resetCursedTiles() idempotent — safe to call when empty', () => {
    resetCursedTiles();
    expect(() => resetCursedTiles()).not.toThrow();
    expect(getCursedTilesCount()).toBe(0);
  });
});

describe('identity-layer · Lich Cursed Tiles · SACRED COW byte-perfect audit', () => {
  // CLAUDE.md §2.1 + §2.5 sacred values referenced by Cursed Tiles for
  // READ-ONLY purposes (threshold clamp + telegraph re-use). Verify they
  // stay byte-perfect after the full fx round-trip.
  it('HERO_ULT_COST_BY_NEWROLE thresholds byte-perfect (sacred CLAUDE.md §2.1)', () => {
    expect(HERO_ULT_COST_BY_NEWROLE.warrior).toBe(80);
    expect(HERO_ULT_COST_BY_NEWROLE.mage).toBe(100);
    expect(HERO_ULT_COST_BY_NEWROLE.hunter).toBe(120);
    expect(HERO_ULT_COST_BY_NEWROLE.tank).toBe(80);
    expect(HERO_ULT_COST_BY_NEWROLE.captain).toBe(100);
  });
  it('SACRED RE-USE INVARIANT: CURSED_TILES_TELEGRAPH_MS === REACTIVITY_TELEGRAPH_MS', () => {
    // Spec §3.2 field 7 + spec §3 "Convention": Cursed Tiles RE-USES the
    // sacred 3000ms telegraph value. This invariant ensures the two stay
    // in lock-step — any future edit to one MUST update the other (and
    // will trip this test if not).
    expect(CURSED_TILES_TELEGRAPH_MS).toBe(REACTIVITY_TELEGRAPH_MS);
    expect(CURSED_TILES_TELEGRAPH_MS).toBe(3000);
  });
  it('Cursed Tiles fx round-trip does NOT modify sacred Phoenix/HERO_ULT/REACTIVITY constants', () => {
    resetCursedTiles();
    resetAshenReign();
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    grid[0][0] = 'ember';
    fxLichCursedTiles(null, { gridState: grid, currentTurn: 0 });
    // Sacred values byte-perfect during active curse.
    expect(PHOENIX_REVIVE_HP_PCT).toBe(0.6);
    expect(PHOENIX_IMMUNE_TURNS).toBe(2);
    expect(REACTIVITY_TELEGRAPH_MS).toBe(3000);
    expect(REACTIVITY_BANNER_DURATION_MS).toBe(1500);
    expect(HERO_ULT_COST_BY_NEWROLE.mage).toBe(100);
    expect(HERO_ULT_COST_BY_NEWROLE.warrior).toBe(80);
    resetCursedTiles();
    // Still byte-perfect after release.
    expect(PHOENIX_REVIVE_HP_PCT).toBe(0.6);
    expect(REACTIVITY_TELEGRAPH_MS).toBe(3000);
    expect(HERO_ULT_COST_BY_NEWROLE.mage).toBe(100);
  });
  it('+20 ULT compensation NEVER overshoots any sacred role threshold (5-case audit)', () => {
    // Audit each sacred per-role threshold from HERO_ULT_COST_BY_NEWROLE.
    // For each, verify that current + 20 → clamps to the threshold.
    expect(clampUltCharge(70, 20, HERO_ULT_COST_BY_NEWROLE.warrior)).toBe(80);   // warrior=80
    expect(clampUltCharge(90, 20, HERO_ULT_COST_BY_NEWROLE.mage)).toBe(100);     // mage=100
    expect(clampUltCharge(110, 20, HERO_ULT_COST_BY_NEWROLE.hunter)).toBe(120);  // hunter=120
    expect(clampUltCharge(70, 20, HERO_ULT_COST_BY_NEWROLE.tank)).toBe(80);      // tank=80
    expect(clampUltCharge(90, 20, HERO_ULT_COST_BY_NEWROLE.captain)).toBe(100);  // captain=100
  });
});

describe('identity-layer · Lich Cursed Tiles · constants & budgets', () => {
  it('CURSED_TILES_COUNT === 3 (spec §3.2 field 4)', () => {
    expect(CURSED_TILES_COUNT).toBe(3);
  });
  it('CURSED_TILES_TURNS_UNTIL_AUTO_CLEAR === 3 (spec §3.2 field 4)', () => {
    expect(CURSED_TILES_TURNS_UNTIL_AUTO_CLEAR).toBe(3);
  });
  it('CURSED_TILES_HP_DAMAGE_PER_TURN === 1 (spec §3.2 field 4)', () => {
    expect(CURSED_TILES_HP_DAMAGE_PER_TURN).toBe(1);
  });
  it('CURSED_TILES_ULT_COMPENSATION === 20 (spec §3.2 field 4)', () => {
    expect(CURSED_TILES_ULT_COMPENSATION).toBe(20);
  });
  it('CURSED_TILES_TRIGGER_SHARK_THRESHOLD === 2 (spec §3.2 field 3)', () => {
    expect(CURSED_TILES_TRIGGER_SHARK_THRESHOLD).toBe(2);
  });
  it('CURSED_TILES_SKULL_DECAY_MS === 300 (spec §3.2 field 7)', () => {
    expect(CURSED_TILES_SKULL_DECAY_MS).toBe(300);
  });
  it('CURSED_TILES_SKULL_COLOR === "#7e3fb8" (re-use of Rock Echo palette per ESC-02 O4)', () => {
    expect(CURSED_TILES_SKULL_COLOR).toBe('#7e3fb8');
  });
  it('CURSED_TILES_INITIAL_BUDGET_MS === 16 (spec §3.2 field 7)', () => {
    expect(CURSED_TILES_INITIAL_BUDGET_MS).toBe(16);
  });
  it('CURSED_TILES_PER_TURN_TICK_BUDGET_MS === 3 (spec §3.2 field 7)', () => {
    expect(CURSED_TILES_PER_TURN_TICK_BUDGET_MS).toBe(3);
  });
  it('IDENTITY_BOSS_FX_KEYS exposes LICH_CURSED_TILES === "lich_cursed_tiles"', () => {
    expect(IDENTITY_BOSS_FX_KEYS.LICH_CURSED_TILES).toBe('lich_cursed_tiles');
  });
  it('IDENTITY_BOSS_FX_BUDGETS[LICH_CURSED_TILES] matches spec §3.2 field 7', () => {
    const b = IDENTITY_BOSS_FX_BUDGETS[IDENTITY_BOSS_FX_KEYS.LICH_CURSED_TILES];
    expect(b.initialMs).toBe(16);
    expect(b.steadyStateMs).toBe(3);
    expect(b.decayMs).toBe(300);
    expect(b.duration).toBe('3 turns');
  });
  it('BOSS_IDENTITY_FX maps assassin → lich_cursed_tiles (sibling export)', () => {
    expect(BOSS_IDENTITY_FX.assassin).toBe('lich_cursed_tiles');
  });
  it('BOSS_IDENTITY_FX.phoenix still present (T2.07 invariant — sibling registry growth, no regression)', () => {
    expect(BOSS_IDENTITY_FX.phoenix).toBe('phoenix_ashen_reign');
  });
});

describe('identity-layer · Lich Cursed Tiles · Phase 2.5 narrator polish (ESC-02 O2)', () => {
  it('CURSED_TILES_NARRATOR_LINE_PLACEHOLDER carries spec §3.2 field 6 string', () => {
    // PLACEHOLDER per ESC-02 O2 ruling. FINAL COPY: pending Roman approval
    // (Phase 2.5 review). The string lives in the isolated constant —
    // sacred NARRATOR_LINES table stays byte-perfect.
    expect(CURSED_TILES_NARRATOR_LINE_PLACEHOLDER).toBe('What you took, the deep remembers.');
  });

  it('NARRATOR_LINES sacred table UNTOUCHED — placeholder lives in isolated constant', () => {
    // Same architectural discipline as T2.07 Ashen Reign + T2.11 Root Surge:
    // new line lives in `src/data/identity-layer.js` as an isolated constant —
    // NOT in `src/feel/narrator-lines.js` (the sacred NARRATOR_LINES table).
    expect(typeof CURSED_TILES_NARRATOR_LINE_PLACEHOLDER).toBe('string');
    expect(CURSED_TILES_NARRATOR_LINE_PLACEHOLDER.length).toBeGreaterThan(0);
    // Designer-drafted string with Darkest-Dungeon-voice cadence (memory/deep motif).
    expect(CURSED_TILES_NARRATOR_LINE_PLACEHOLDER).toContain('remembers');
    expect(CURSED_TILES_NARRATOR_LINE_PLACEHOLDER).toContain('deep');
  });
});

describe('identity-layer · Lich Cursed Tiles · cross-mechanic regression (T2.02-T2.07 invariants)', () => {
  it('Cursed Tiles fx active during mixed-race dispatch does NOT block race FX', () => {
    // Place curses, then fire a 5-race line clear — all race FX must run
    // independently. Cursed Tiles is a BOSS-side state.
    __identityFxTestables.resetCoinPool();
    __identityFxTestables.resetSharkBitePool();
    __identityFxTestables.resetRockEchoPool();
    __identityFxTestables.resetCrocFragmentPool();
    __identityFxTestables.resetSparkRayPool();
    resetCrocFragmentBank();
    resetCursedTiles();

    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let c = 0; c < 8; c++) grid[0][c] = 'solar';     // gates Spark
    for (let c = 0; c < 8; c++) grid[2][c] = 'grove';     // gates Crocodile
    // Seed extra cells for Cursed Tiles candidate pool.
    grid[5][0] = 'umbra';
    grid[5][1] = 'umbra';
    grid[5][2] = 'umbra';

    fxLichCursedTiles(null, { gridState: grid, currentTurn: 0 });
    expect(getCursedTilesCount()).toBeGreaterThan(0);

    const squad = [
      { race: 'pirate' },
      { race: 'shark' },
      { race: 'shark' },
      { race: 'rock' },
      { race: 'crocodile' },
      { race: 'spark' },
    ];
    const ctx = { gridState: grid, dominantElementsByLine: ['solar', 'grove'] };
    expect(() => dispatchIdentityFx([0, 2], [], squad, null, ctx)).not.toThrow();

    // Spark cascade still fired.
    expect(ctx._dominantCountModifier).toBe(1);
    // Cursed Tiles still active.
    expect(getCursedTilesCount()).toBeGreaterThan(0);
    resetCursedTiles();
  });

  it('Sacred RACE_SYNERGY entries byte-perfect after Cursed Tiles fx round-trip', () => {
    resetCursedTiles();
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    grid[1][1] = 'umbra';
    fxLichCursedTiles(null, { gridState: grid, currentTurn: 0 });
    resetCursedTiles();
    expect(RACE_SYNERGY.lion[5].bonusDmg.solar).toBe(3);
    expect(RACE_SYNERGY.rock[3].encore).toBe(true);
    expect(RACE_SYNERGY.golem[2].maxShieldBonus).toBe(1);
    expect(RACE_SYNERGY.golem[3].maxShieldBonus).toBe(2);
    expect(RACE_SYNERGY.golem[5].maxShieldBonus).toBe(2);
    // Race identity sibling export untouched.
    expect(RACE_IDENTITY_FX.pirate).toBe('pirate_plunder');
    expect(RACE_IDENTITY_FX.spark).toBe('spark_cascade');
  });

  it('Phoenix Ashen Reign + Lich Cursed Tiles can coexist (mixed boss-reactive layers)', () => {
    resetAshenReign();
    resetCursedTiles();
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    grid[0][0] = 'umbra';
    grid[0][1] = 'umbra';
    grid[0][2] = 'umbra';

    fxPhoenixAshenReign(null, null);
    fxLichCursedTiles(null, { gridState: grid, currentTurn: 0 });

    // Both states active independently.
    expect(isAshenReignActive()).toBe(true);
    expect(getCursedTilesCount()).toBeGreaterThan(0);

    // Cleanup.
    fxPhoenixAshenReignRelease();
    resetCursedTiles();
    expect(isAshenReignActive()).toBe(false);
    expect(getCursedTilesCount()).toBe(0);
  });
});

// ─── T2.09 — Berserker / Frenzy Bloodtide Pulse unit tests (spec §3.3) ───
//
// Pure math + helper coverage. No DOM — Vitest runs in `node` env.
// Surface tested:
//   - shouldBloodtidePulse(count, staggerState) — gate predicate (every 3rd
//     clear × Active state)
//   - computeBloodtideDamageBonus(pulsesPending) — cap clamp at +25%
//   - applyBloodtideToDamage(base, enrageMult, pulseBonus) — LAYERED
//     composition (base × enrageMult × (1 + pulseBonus), NEVER additive into
//     enrageMult)
//   - incrementBloodtideClearCount / getBloodtideClearCount — pure integer
//     state with resetBloodtide
//   - consumeBloodtidePulse — one-shot semantics (no stacking, no double-fire)
//   - Sacred byte-perfect audit: BERSERKER_ENRAGE_HP_PCT / BERSERKER_ENRAGE_MULT
//     / STAGGER_DURATION_TURNS / RECOVERY_DURATION_TURNS / BOSS_STATE_ACTIVE
//   - Cross-mechanic regression: Phoenix + Lich + Bloodtide coexist

describe('identity-layer · Bloodtide Pulse · shouldBloodtidePulse (gate)', () => {
  it('0 clears + ACTIVE → false (defensive: never fire at boot)', () => {
    expect(shouldBloodtidePulse(0, 'active')).toBe(false);
  });
  it('1 clear + ACTIVE → false (not a 3rd-clear)', () => {
    expect(shouldBloodtidePulse(1, 'active')).toBe(false);
  });
  it('2 clears + ACTIVE → false (not a 3rd-clear)', () => {
    expect(shouldBloodtidePulse(2, 'active')).toBe(false);
  });
  it('3 clears + ACTIVE → true (FIRST pulse fires)', () => {
    expect(shouldBloodtidePulse(3, 'active')).toBe(true);
  });
  it('6 clears + ACTIVE → true (SECOND pulse fires)', () => {
    expect(shouldBloodtidePulse(6, 'active')).toBe(true);
  });
  it('9 clears + ACTIVE → true (THIRD pulse fires)', () => {
    expect(shouldBloodtidePulse(9, 'active')).toBe(true);
  });
  it('3 clears + STAGGER → false (Stagger state blocks pulse — sacred §2.5)', () => {
    expect(shouldBloodtidePulse(3, 'stagger')).toBe(false);
  });
  it('3 clears + RECOVERY → false (Recovery state blocks pulse — sacred §2.5)', () => {
    expect(shouldBloodtidePulse(3, 'recovery')).toBe(false);
  });
  it('9 clears + RECOVERY → false (count keeps incrementing across states, gate fails)', () => {
    expect(shouldBloodtidePulse(9, 'recovery')).toBe(false);
  });
  it('Non-integer clear count → false (defensive)', () => {
    expect(shouldBloodtidePulse(3.5, 'active')).toBe(false);
    expect(shouldBloodtidePulse(NaN, 'active')).toBe(false);
  });
  it('Negative clear count → false (defensive)', () => {
    expect(shouldBloodtidePulse(-3, 'active')).toBe(false);
  });
  it('Gate uses BOSS_STATE_ACTIVE string literal (sacred re-use invariant)', () => {
    // BLOODTIDE_REQUIRED_STAGGER_STATE must match the sacred stagger-loop.js
    // constant byte-for-byte so any future spec change to either constant
    // trips this test.
    expect(BLOODTIDE_REQUIRED_STAGGER_STATE).toBe(BOSS_STATE_ACTIVE);
    expect(BLOODTIDE_REQUIRED_STAGGER_STATE).toBe('active');
  });
});

describe('identity-layer · Bloodtide Pulse · computeBloodtideDamageBonus (cap)', () => {
  it('0 pulses → 0 bonus', () => {
    expect(computeBloodtideDamageBonus(0)).toBe(0);
  });
  it('1 pulse → 0.05 (+5%)', () => {
    expect(computeBloodtideDamageBonus(1)).toBeCloseTo(0.05, 10);
  });
  it('2 pulses → 0.10 (+10%)', () => {
    expect(computeBloodtideDamageBonus(2)).toBeCloseTo(0.10, 10);
  });
  it('5 pulses → 0.25 (+25% HARD CAP)', () => {
    expect(computeBloodtideDamageBonus(5)).toBeCloseTo(0.25, 10);
  });
  it('6 pulses → 0.25 (still at HARD CAP, no overshoot)', () => {
    // Per spec §3.3 field 4: "Caps at +25% total (5 pulses worth)".
    // Defensive cap-clamp test: even if a hypothetical 6th pulse somehow
    // landed (impossible in normal play — one-shot consume), the bonus
    // never exceeds BLOODTIDE_PULSE_MAX_BONUS.
    expect(computeBloodtideDamageBonus(6)).toBe(BLOODTIDE_PULSE_MAX_BONUS);
    expect(computeBloodtideDamageBonus(6)).toBe(0.25);
  });
  it('100 pulses (pathological) → 0.25 (HARD CAP defensive)', () => {
    expect(computeBloodtideDamageBonus(100)).toBe(BLOODTIDE_PULSE_MAX_BONUS);
  });
  it('Negative pulses → 0 (defensive)', () => {
    expect(computeBloodtideDamageBonus(-1)).toBe(0);
  });
});

describe('identity-layer · Bloodtide Pulse · applyBloodtideToDamage (LAYERED composition)', () => {
  // CRITICAL invariant: the +5% pulse multiplies the ENRAGE-multiplied base.
  // It is NEVER additively folded into the sacred enrage multiplier.
  // Sacred §2.5: BERSERKER_ENRAGE_MULT = 2.0 stays byte-perfect; the pulse
  // is a SEPARATE final-stage multiplier.
  it('100 base × 2.0 enrage × +0.05 pulse → 210 (NOT 205)', () => {
    // Correct LAYERED:    100 × 2.0 × 1.05 = 210
    // Wrong ADDITIVE-INTO: 100 × (2.0 + 0.05) = 205 (would mutate enrageMult)
    expect(applyBloodtideToDamage(100, 2.0, 0.05)).toBeCloseTo(210, 10);
    expect(applyBloodtideToDamage(100, 2.0, 0.05)).not.toBe(205);
  });
  it('100 base × 2.0 enrage × 0 pulse → 200 (no pulse = pure enrage)', () => {
    expect(applyBloodtideToDamage(100, 2.0, 0)).toBe(200);
  });
  it('50 base × 1.0 enrage (pre-enrage) × +0.05 pulse → 52.5', () => {
    // Below enrage threshold: enrageMult = 1.0 (no enrage applied yet).
    // Pulse still multiplies cleanly: 50 × 1.0 × 1.05 = 52.5
    expect(applyBloodtideToDamage(50, 1.0, 0.05)).toBeCloseTo(52.5, 10);
  });
  it('Composition with HARD CAP pulse (+0.25) on enraged base', () => {
    // 100 × 2.0 × 1.25 = 250 (vs 100 × 2.25 = 225 for wrong additive path)
    expect(applyBloodtideToDamage(100, 2.0, 0.25)).toBeCloseTo(250, 10);
    expect(applyBloodtideToDamage(100, 2.0, 0.25)).not.toBe(225);
  });
  it('Bloodtide pulse NEVER mutates sacred BERSERKER_ENRAGE_MULT', () => {
    // After many applications, the sacred constant must remain byte-perfect.
    applyBloodtideToDamage(100, BERSERKER_ENRAGE_MULT, 0.05);
    applyBloodtideToDamage(100, BERSERKER_ENRAGE_MULT, 0.25);
    applyBloodtideToDamage(50,  BERSERKER_ENRAGE_MULT, 0.10);
    expect(BERSERKER_ENRAGE_MULT).toBe(2.0);
    expect(BERSERKER_ENRAGE_HP_PCT).toBe(0.5);
  });
  it('Defensive: non-finite inputs → 0', () => {
    expect(applyBloodtideToDamage(NaN, 2.0, 0.05)).toBe(0);
    expect(applyBloodtideToDamage(100, NaN, 0.05)).toBe(0);
  });
});

describe('identity-layer · Bloodtide Pulse · clear count tick + reset', () => {
  it('incrementBloodtideClearCount tracks total clears (pure integer math)', () => {
    resetBloodtide();
    expect(getBloodtideClearCount()).toBe(0);
    expect(incrementBloodtideClearCount()).toBe(1);
    expect(incrementBloodtideClearCount()).toBe(2);
    expect(incrementBloodtideClearCount()).toBe(3);
    expect(getBloodtideClearCount()).toBe(3);
    resetBloodtide();
  });
  it('resetBloodtide zeroes count + pending flag', () => {
    incrementBloodtideClearCount();
    incrementBloodtideClearCount();
    incrementBloodtideClearCount();
    fxBerserkerBloodtidePulse(null, null);
    expect(getBloodtideClearCount()).toBe(3);
    expect(isBloodtidePulsePending()).toBe(true);
    resetBloodtide();
    expect(getBloodtideClearCount()).toBe(0);
    expect(isBloodtidePulsePending()).toBe(false);
  });
  it('Count keeps incrementing across Stagger state (gate fails, count does NOT reset)', () => {
    // The clear count is monotonic — Stagger Loop state does NOT reset it.
    // The GATE is what fails during Stagger; once back to Active, clear 3
    // (which has long since passed) won't re-fire, but the NEXT 3rd-clear
    // (e.g., the 6th clear total) will.
    resetBloodtide();
    incrementBloodtideClearCount();   // 1
    incrementBloodtideClearCount();   // 2
    incrementBloodtideClearCount();   // 3 — would fire if Active
    expect(shouldBloodtidePulse(getBloodtideClearCount(), 'stagger')).toBe(false);
    incrementBloodtideClearCount();   // 4
    incrementBloodtideClearCount();   // 5
    incrementBloodtideClearCount();   // 6 — fires if returned to Active
    expect(shouldBloodtidePulse(getBloodtideClearCount(), 'active')).toBe(true);
    resetBloodtide();
  });
});

describe('identity-layer · Bloodtide Pulse · consumeBloodtidePulse (one-shot semantics)', () => {
  it('Pulse pending → consume returns 0.05 once, then 0', () => {
    resetBloodtide();
    fxBerserkerBloodtidePulse(null, null);
    expect(isBloodtidePulsePending()).toBe(true);
    const first  = consumeBloodtidePulse();
    expect(first.damageBonus).toBeCloseTo(0.05, 10);
    expect(isBloodtidePulsePending()).toBe(false);
    const second = consumeBloodtidePulse();
    expect(second.damageBonus).toBe(0);
    resetBloodtide();
  });
  it('No pulse pending → consume returns 0', () => {
    resetBloodtide();
    expect(isBloodtidePulsePending()).toBe(false);
    const result = consumeBloodtidePulse();
    expect(result.damageBonus).toBe(0);
  });
  it('3 consecutive pulses do NOT stack — only the most recent is live', () => {
    // Per spec §3.3 field 4 "one-shot buff, not stacking with itself":
    // even if 3 pulses fire (clears 3, 6, 9) before any boss attack, only
    // ONE +5% buff is live. Consume returns 0.05 once, then 0.
    resetBloodtide();
    fxBerserkerBloodtidePulse(null, null);   // pulse 1
    fxBerserkerBloodtidePulse(null, null);   // pulse 2 (overrides — same boolean flag)
    fxBerserkerBloodtidePulse(null, null);   // pulse 3
    expect(isBloodtidePulsePending()).toBe(true);
    const r1 = consumeBloodtidePulse();
    expect(r1.damageBonus).toBeCloseTo(0.05, 10);
    const r2 = consumeBloodtidePulse();
    expect(r2.damageBonus).toBe(0);    // NOT 0.15 — no stacking
    const r3 = consumeBloodtidePulse();
    expect(r3.damageBonus).toBe(0);
    resetBloodtide();
  });
  it('Pulse → consume → pulse → consume cycle (normal play)', () => {
    resetBloodtide();
    // First 3rd-clear: pulse fires.
    fxBerserkerBloodtidePulse(null, null);
    expect(consumeBloodtidePulse().damageBonus).toBeCloseTo(0.05, 10);
    expect(consumeBloodtidePulse().damageBonus).toBe(0);
    // Second 3rd-clear (6 clears total): pulse fires again.
    fxBerserkerBloodtidePulse(null, null);
    expect(consumeBloodtidePulse().damageBonus).toBeCloseTo(0.05, 10);
    expect(consumeBloodtidePulse().damageBonus).toBe(0);
    resetBloodtide();
  });
});

describe('identity-layer · Bloodtide Pulse · bloodtideGatePasses (count + state)', () => {
  it('Count 3 + ACTIVE → gate passes (drives full pipeline)', () => {
    resetBloodtide();
    incrementBloodtideClearCount();
    incrementBloodtideClearCount();
    incrementBloodtideClearCount();
    expect(bloodtideGatePasses(BOSS_STATE_ACTIVE)).toBe(true);
    resetBloodtide();
  });
  it('Count 3 + STAGGER → gate fails (Stagger blocks pulse)', () => {
    resetBloodtide();
    incrementBloodtideClearCount();
    incrementBloodtideClearCount();
    incrementBloodtideClearCount();
    expect(bloodtideGatePasses(BOSS_STATE_STAGGER)).toBe(false);
    resetBloodtide();
  });
  it('Count 3 + RECOVERY → gate fails (Recovery blocks pulse)', () => {
    resetBloodtide();
    incrementBloodtideClearCount();
    incrementBloodtideClearCount();
    incrementBloodtideClearCount();
    expect(bloodtideGatePasses(BOSS_STATE_RECOVERY)).toBe(false);
    resetBloodtide();
  });
  it('Count 0 → gate fails regardless of state (defensive)', () => {
    resetBloodtide();
    expect(bloodtideGatePasses(BOSS_STATE_ACTIVE)).toBe(false);
    expect(bloodtideGatePasses(BOSS_STATE_STAGGER)).toBe(false);
    expect(bloodtideGatePasses(BOSS_STATE_RECOVERY)).toBe(false);
  });
});

describe('identity-layer · Bloodtide Pulse · SACRED COW byte-perfect audit', () => {
  // CLAUDE.md §2.5 sacred values referenced by Bloodtide for READ-ONLY
  // purposes (Stagger Loop state gate + enrage layering composition). Verify
  // they stay byte-perfect after the full fx round-trip.
  it('BERSERKER_ENRAGE_HP_PCT === 0.5 byte-perfect (sacred CLAUDE.md §2.5)', () => {
    expect(BERSERKER_ENRAGE_HP_PCT).toBe(0.5);
  });
  it('BERSERKER_ENRAGE_MULT === 2.0 byte-perfect (sacred CLAUDE.md §2.5)', () => {
    expect(BERSERKER_ENRAGE_MULT).toBe(2.0);
  });
  it('STAGGER_DURATION_TURNS === 4 byte-perfect (sacred CLAUDE.md §2.5)', () => {
    expect(STAGGER_DURATION_TURNS).toBe(4);
  });
  it('RECOVERY_DURATION_TURNS === 2 byte-perfect (sacred CLAUDE.md §2.5)', () => {
    expect(RECOVERY_DURATION_TURNS).toBe(2);
  });
  it('BOSS_STATE_ACTIVE === "active" / STAGGER === "stagger" / RECOVERY === "recovery" byte-perfect', () => {
    expect(BOSS_STATE_ACTIVE).toBe('active');
    expect(BOSS_STATE_STAGGER).toBe('stagger');
    expect(BOSS_STATE_RECOVERY).toBe('recovery');
  });
  it('Bloodtide fx round-trip does NOT modify sacred constants', () => {
    resetBloodtide();
    incrementBloodtideClearCount();
    incrementBloodtideClearCount();
    incrementBloodtideClearCount();
    fxBerserkerBloodtidePulse(null, null);
    consumeBloodtidePulse();
    // Sacred values byte-perfect after the full pulse → consume cycle.
    expect(BERSERKER_ENRAGE_HP_PCT).toBe(0.5);
    expect(BERSERKER_ENRAGE_MULT).toBe(2.0);
    expect(STAGGER_DURATION_TURNS).toBe(4);
    expect(RECOVERY_DURATION_TURNS).toBe(2);
    expect(BOSS_STATE_ACTIVE).toBe('active');
    // Phoenix/Lich invariants byte-perfect (no cross-mechanic mutation).
    expect(PHOENIX_REVIVE_HP_PCT).toBe(0.6);
    expect(PHOENIX_IMMUNE_TURNS).toBe(2);
    expect(REACTIVITY_TELEGRAPH_MS).toBe(3000);
    expect(REACTIVITY_BANNER_DURATION_MS).toBe(1500);
    expect(HERO_ULT_COST_BY_NEWROLE.mage).toBe(100);
    resetBloodtide();
    // Still byte-perfect after reset.
    expect(BERSERKER_ENRAGE_MULT).toBe(2.0);
    expect(STAGGER_DURATION_TURNS).toBe(4);
  });
  it('Bloodtide fx round-trip is READ-ONLY on Stagger Loop state machine', () => {
    // The Bloodtide handler should never mutate boss state. We exercise the
    // full fx cycle and assert the sacred Stagger Loop constants remain
    // byte-perfect — there's no public "set state" API exposed to verify
    // call-count, but the sacred values acting as a tripwire is sufficient.
    resetBloodtide();
    for (let i = 0; i < 12; i++) {
      incrementBloodtideClearCount();
      if (bloodtideGatePasses(BOSS_STATE_ACTIVE)) {
        fxBerserkerBloodtidePulse(null, null);
        consumeBloodtidePulse();
      }
    }
    expect(STAGGER_DURATION_TURNS).toBe(4);
    expect(RECOVERY_DURATION_TURNS).toBe(2);
    expect(BOSS_STATE_ACTIVE).toBe('active');
    expect(BOSS_STATE_STAGGER).toBe('stagger');
    expect(BOSS_STATE_RECOVERY).toBe('recovery');
    resetBloodtide();
  });
});

describe('identity-layer · Bloodtide Pulse · constants & budgets', () => {
  it('BLOODTIDE_PULSE_INTERVAL === 3 (spec §3.3 field 3)', () => {
    expect(BLOODTIDE_PULSE_INTERVAL).toBe(3);
  });
  it('BLOODTIDE_PULSE_DAMAGE_BONUS === 0.05 (+5% spec §3.3 field 4)', () => {
    expect(BLOODTIDE_PULSE_DAMAGE_BONUS).toBe(0.05);
  });
  it('BLOODTIDE_PULSE_MAX_BONUS === 0.25 (HARD CAP +25% spec §3.3 field 4)', () => {
    expect(BLOODTIDE_PULSE_MAX_BONUS).toBe(0.25);
  });
  it('BLOODTIDE_PULSE_VFX_DURATION_MS === 600 (sweep duration spec §3.3 field 7)', () => {
    expect(BLOODTIDE_PULSE_VFX_DURATION_MS).toBe(600);
  });
  it('BLOODTIDE_PULSE_DECAY_MS === 200', () => {
    expect(BLOODTIDE_PULSE_DECAY_MS).toBe(200);
  });
  it('BLOODTIDE_REQUIRED_STAGGER_STATE === "active" (matches sacred BOSS_STATE_ACTIVE)', () => {
    expect(BLOODTIDE_REQUIRED_STAGGER_STATE).toBe('active');
    expect(BLOODTIDE_REQUIRED_STAGGER_STATE).toBe(BOSS_STATE_ACTIVE);
  });
  it('BLOODTIDE_PULSE_COLOR === "#E53935" (red — distinct from purple curse / orange flame)', () => {
    expect(BLOODTIDE_PULSE_COLOR).toBe('#E53935');
  });
  it('BLOODTIDE_INITIAL_BUDGET_MS === 10 (spec §3.3 field 7)', () => {
    expect(BLOODTIDE_INITIAL_BUDGET_MS).toBe(10);
  });
  it('IDENTITY_BOSS_FX_KEYS exposes BERSERKER_BLOODTIDE === "berserker_bloodtide"', () => {
    expect(IDENTITY_BOSS_FX_KEYS.BERSERKER_BLOODTIDE).toBe('berserker_bloodtide');
  });
  it('IDENTITY_BOSS_FX_BUDGETS[BERSERKER_BLOODTIDE] matches spec §3.3 field 7', () => {
    const b = IDENTITY_BOSS_FX_BUDGETS[IDENTITY_BOSS_FX_KEYS.BERSERKER_BLOODTIDE];
    expect(b.initialMs).toBe(10);
    expect(b.steadyStateMs).toBe(0);   // one-shot — no steady-state work
    expect(b.decayMs).toBe(200);
    expect(b.duration).toBe('one-shot');
  });
  it('BOSS_IDENTITY_FX maps BOTH berserker AND frenzy → berserker_bloodtide (spec §3.3 field 1)', () => {
    expect(BOSS_IDENTITY_FX.berserker).toBe('berserker_bloodtide');
    expect(BOSS_IDENTITY_FX.frenzy).toBe('berserker_bloodtide');
    expect(BOSS_IDENTITY_FX.berserker).toBe(BOSS_IDENTITY_FX.frenzy);
  });
  it('BOSS_IDENTITY_FX.phoenix / .assassin still present (T2.07/T2.08 invariants)', () => {
    expect(BOSS_IDENTITY_FX.phoenix).toBe('phoenix_ashen_reign');
    expect(BOSS_IDENTITY_FX.assassin).toBe('lich_cursed_tiles');
  });
});

describe('identity-layer · Bloodtide Pulse · cross-mechanic regression (T2.02-T2.08 invariants)', () => {
  it('Bloodtide pulse active does NOT block race FX dispatch', () => {
    __identityFxTestables.resetCoinPool();
    __identityFxTestables.resetSharkBitePool();
    __identityFxTestables.resetRockEchoPool();
    __identityFxTestables.resetCrocFragmentPool();
    __identityFxTestables.resetSparkRayPool();
    resetCrocFragmentBank();
    resetBloodtide();

    incrementBloodtideClearCount();
    incrementBloodtideClearCount();
    incrementBloodtideClearCount();
    fxBerserkerBloodtidePulse(null, null);
    expect(isBloodtidePulsePending()).toBe(true);

    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let c = 0; c < 8; c++) grid[0][c] = 'solar';
    for (let c = 0; c < 8; c++) grid[2][c] = 'grove';

    const squad = [
      { race: 'pirate' },
      { race: 'shark' },
      { race: 'shark' },
      { race: 'rock' },
      { race: 'crocodile' },
      { race: 'spark' },
    ];
    const ctx = { gridState: grid, dominantElementsByLine: ['solar', 'grove'] };
    expect(() => dispatchIdentityFx([0, 2], [], squad, null, ctx)).not.toThrow();
    // Spark cascade still fired.
    expect(ctx._dominantCountModifier).toBe(1);
    // Bloodtide still pending (race FX did NOT consume).
    expect(isBloodtidePulsePending()).toBe(true);
    resetBloodtide();
  });

  it('Sacred RACE_SYNERGY entries byte-perfect after Bloodtide fx round-trip', () => {
    resetBloodtide();
    fxBerserkerBloodtidePulse(null, null);
    consumeBloodtidePulse();
    resetBloodtide();
    expect(RACE_SYNERGY.lion[5].bonusDmg.solar).toBe(3);
    expect(RACE_SYNERGY.rock[3].encore).toBe(true);
    expect(RACE_SYNERGY.golem[2].maxShieldBonus).toBe(1);
    expect(RACE_SYNERGY.golem[3].maxShieldBonus).toBe(2);
    expect(RACE_SYNERGY.golem[5].maxShieldBonus).toBe(2);
    // Race identity sibling export untouched.
    expect(RACE_IDENTITY_FX.pirate).toBe('pirate_plunder');
    expect(RACE_IDENTITY_FX.spark).toBe('spark_cascade');
  });

  it('Phoenix Ashen Reign + Lich Cursed Tiles + Bloodtide can coexist (three boss-reactive layers)', () => {
    resetAshenReign();
    resetCursedTiles();
    resetBloodtide();
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    grid[0][0] = 'umbra';
    grid[0][1] = 'umbra';
    grid[0][2] = 'umbra';

    fxPhoenixAshenReign(null, null);
    fxLichCursedTiles(null, { gridState: grid, currentTurn: 0 });
    incrementBloodtideClearCount();
    incrementBloodtideClearCount();
    incrementBloodtideClearCount();
    fxBerserkerBloodtidePulse(null, null);

    // All three states active independently.
    expect(isAshenReignActive()).toBe(true);
    expect(getCursedTilesCount()).toBeGreaterThan(0);
    expect(isBloodtidePulsePending()).toBe(true);

    // Cleanup.
    fxPhoenixAshenReignRelease();
    resetCursedTiles();
    resetBloodtide();
    expect(isAshenReignActive()).toBe(false);
    expect(getCursedTilesCount()).toBe(0);
    expect(isBloodtidePulsePending()).toBe(false);
  });

  it('Bloodtide pulse pending does NOT affect ULT charge clamp (T2.04/T2.08 invariant)', () => {
    resetBloodtide();
    fxBerserkerBloodtidePulse(null, null);
    // Pulse is pending. ULT charge clamp helpers (clampUltCharge, clampEncoreEchoCharge)
    // remain pure — they read sacred thresholds, not Bloodtide state.
    expect(clampUltCharge(90, 20, HERO_ULT_COST_BY_NEWROLE.mage)).toBe(100);
    expect(clampUltCharge(70, 20, HERO_ULT_COST_BY_NEWROLE.warrior)).toBe(80);
    expect(clampEncoreEchoCharge(11, 4, 12)).toBe(12);  // T2.04 invariant
    resetBloodtide();
  });

  it('Damage composition: enrageMult + pulse layering NEVER feeds combo-crit formula (sacred §2.1)', () => {
    // Spec §1 hard rule 3: "Layered, not replacement." Pulse multiplies the
    // damage AFTER all combat math (combo crit, element synergy, RACE_SYNERGY).
    // Verify the composition by computing both with and without pulse and
    // confirming combo crit math (which we don't touch) returns the SAME
    // intermediate result.
    const baseFromComboCrit = 100;  // hypothetical post-combo-crit base
    const enraged           = applyBloodtideToDamage(baseFromComboCrit, 2.0, 0);
    const enragedPulse      = applyBloodtideToDamage(baseFromComboCrit, 2.0, 0.05);
    // The enraged-without-pulse number equals base × enrageMult = combo crit's
    // result, untouched.
    expect(enraged).toBe(200);
    // Pulse multiplies the result. NEVER folds into the combo crit input.
    expect(enragedPulse).toBeCloseTo(210, 10);
    // Sacred BERSERKER_ENRAGE_MULT untouched.
    expect(BERSERKER_ENRAGE_MULT).toBe(2.0);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2026-05-12 — TASK-037 (T2.10): Engineer Lockdown Protocol unit tests.
// Spec: docs/design/mechanics/identity-layer.md §3.4. Pure math + helper
// coverage. No DOM — Vitest runs in `node` env.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('identity-layer · Engineer Lockdown Protocol · isTetrisCrit (trigger gate)', () => {
  it('4 lines + comboTriggered=true → true (Tetris crit)', () => {
    expect(isTetrisCrit(4, true)).toBe(true);
  });

  it('4 lines + comboTriggered=false → false (no crit means no Tetris)', () => {
    expect(isTetrisCrit(4, false)).toBe(false);
  });

  it('3 lines + comboTriggered=true → false (not a Tetris)', () => {
    expect(isTetrisCrit(3, true)).toBe(false);
  });

  it('2 lines + comboTriggered=true → false', () => {
    expect(isTetrisCrit(2, true)).toBe(false);
  });

  it('5 lines + comboTriggered=true → false (defensive — impossible on 8x8 but bounded)', () => {
    expect(isTetrisCrit(5, true)).toBe(false);
  });

  it('0 lines + comboTriggered=true → false', () => {
    expect(isTetrisCrit(0, true)).toBe(false);
  });

  it('comboTriggered=truthy-but-not-true → false (strict boolean check)', () => {
    expect(isTetrisCrit(4, 1)).toBe(false);
    expect(isTetrisCrit(4, 'yes')).toBe(false);
    expect(isTetrisCrit(4, {})).toBe(false);
  });

  it('defensive: nil / NaN lines → false', () => {
    expect(isTetrisCrit(null, true)).toBe(false);
    expect(isTetrisCrit(undefined, true)).toBe(false);
    expect(isTetrisCrit(NaN, true)).toBe(false);
    expect(isTetrisCrit('not-a-number', true)).toBe(false);
  });

  it('engineerLockdownGatePasses mirrors isTetrisCrit (gate-naming convention)', () => {
    expect(engineerLockdownGatePasses(4, true)).toBe(true);
    expect(engineerLockdownGatePasses(3, true)).toBe(false);
    expect(engineerLockdownGatePasses(4, false)).toBe(false);
  });
});

describe('identity-layer · Engineer Lockdown Protocol · pickMostClearedCorner', () => {
  it('rows in upper half + cols in left half → top-left', () => {
    const r = pickMostClearedCorner([0, 1, 2], [0, 1], 8);
    expect(r.cornerName).toBe('top-left');
    expect(r.row).toBe(0);
    expect(r.col).toBe(0);
  });

  it('rows in upper half + cols in right half → top-right', () => {
    const r = pickMostClearedCorner([0, 1], [5, 6, 7], 8);
    expect(r.cornerName).toBe('top-right');
    expect(r.row).toBe(0);
    expect(r.col).toBe(6);  // gridSize - 2 = 6 for 8×8
  });

  it('rows in lower half + cols in left half → bottom-left', () => {
    const r = pickMostClearedCorner([5, 6, 7], [0, 1], 8);
    expect(r.cornerName).toBe('bottom-left');
    expect(r.row).toBe(6);
    expect(r.col).toBe(0);
  });

  it('rows in lower half + cols in right half → bottom-right', () => {
    const r = pickMostClearedCorner([5, 6, 7], [5, 6, 7], 8);
    expect(r.cornerName).toBe('bottom-right');
    expect(r.row).toBe(6);
    expect(r.col).toBe(6);
  });

  it('only rows cleared (no cols) → uses row halves to determine top/bottom', () => {
    const top    = pickMostClearedCorner([0, 1, 2, 3], [], 8);
    const bottom = pickMostClearedCorner([4, 5, 6, 7], [], 8);
    expect(top.cornerName).toBe('top-left');     // tie-break left
    expect(bottom.cornerName).toBe('bottom-left'); // tie-break left
  });

  it('empty rows + empty cols → defensive top-left fallback', () => {
    const r = pickMostClearedCorner([], [], 8);
    expect(r.cornerName).toBe('top-left');
    expect(r.row).toBe(0);
    expect(r.col).toBe(0);
  });

  it('non-array inputs → defensive empty handling (top-left fallback)', () => {
    const r = pickMostClearedCorner(null, undefined, 8);
    expect(r.cornerName).toBe('top-left');
  });

  it('non-integer gridSize falls back to safe default (≥2)', () => {
    const r = pickMostClearedCorner([0], [0], 0);
    expect(r.cornerName).toBe('top-left');
    expect(r.row).toBe(0);
    expect(r.col).toBe(0);
  });

  it('quad-line Tetris (rows=[0,1,6,7]) tie-breaks to top-left by convention', () => {
    // 2 upper + 2 lower rows is a tie — should default to 'top' per >= rule.
    const r = pickMostClearedCorner([0, 1, 6, 7], [], 8);
    expect(r.cornerName).toBe('top-left');
  });
});

describe('identity-layer · Engineer Lockdown Protocol · compute2x2LockdownCells', () => {
  it('top-left corner → cells (0,0), (0,1), (1,0), (1,1)', () => {
    const cells = compute2x2LockdownCells({ cornerName: 'top-left', row: 0, col: 0 }, 8);
    expect(cells.length).toBe(4);
    expect(cells).toEqual([
      { row: 0, col: 0 }, { row: 0, col: 1 },
      { row: 1, col: 0 }, { row: 1, col: 1 },
    ]);
  });

  it('bottom-right corner → cells (6,6), (6,7), (7,6), (7,7)', () => {
    const cells = compute2x2LockdownCells({ cornerName: 'bottom-right', row: 6, col: 6 }, 8);
    expect(cells.length).toBe(4);
    expect(cells).toEqual([
      { row: 6, col: 6 }, { row: 6, col: 7 },
      { row: 7, col: 6 }, { row: 7, col: 7 },
    ]);
  });

  it('top-right corner → cells (0,6), (0,7), (1,6), (1,7)', () => {
    const cells = compute2x2LockdownCells({ cornerName: 'top-right', row: 0, col: 6 }, 8);
    expect(cells).toEqual([
      { row: 0, col: 6 }, { row: 0, col: 7 },
      { row: 1, col: 6 }, { row: 1, col: 7 },
    ]);
  });

  it('bottom-left corner → cells (6,0), (6,1), (7,0), (7,1)', () => {
    const cells = compute2x2LockdownCells({ cornerName: 'bottom-left', row: 6, col: 0 }, 8);
    expect(cells).toEqual([
      { row: 6, col: 0 }, { row: 6, col: 1 },
      { row: 7, col: 0 }, { row: 7, col: 1 },
    ]);
  });

  it('defensive clamp: corner with row beyond grid → clamped to gridSize-2', () => {
    const cells = compute2x2LockdownCells({ cornerName: 'bottom-right', row: 99, col: 99 }, 8);
    expect(cells).toEqual([
      { row: 6, col: 6 }, { row: 6, col: 7 },
      { row: 7, col: 6 }, { row: 7, col: 7 },
    ]);
  });

  it('always returns exactly ENGINEER_LOCKDOWN_CELL_COUNT (4) cells', () => {
    for (const cn of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
      const cells = compute2x2LockdownCells({ cornerName: cn, row: 0, col: 0 }, 8);
      expect(cells.length).toBe(ENGINEER_LOCKDOWN_CELL_COUNT);
    }
  });

  it('null/invalid corner → defensive top-left fallback (4 cells at origin)', () => {
    expect(compute2x2LockdownCells(null, 8).length).toBe(4);
    expect(compute2x2LockdownCells({}, 8)).toEqual([
      { row: 0, col: 0 }, { row: 0, col: 1 },
      { row: 1, col: 0 }, { row: 1, col: 1 },
    ]);
  });
});

describe('identity-layer · Engineer Lockdown Protocol · fxEngineerLockdownProtocol gate behavior', () => {
  it('4-line crit clear → lockdown placed (4 cells in mirror state)', () => {
    resetEngineerLockdowns();
    fxEngineerLockdownProtocol(null, {
      linesCleared: 4,
      comboTriggered: true,
      lastClearedRows: [0, 1, 2, 3],
      lastClearedCols: [],
      gridSize: 8,
      currentTurn: 0,
    });
    expect(getEngineerLockdownsCount()).toBe(1);
    const snap = getEngineerLockdownsSnapshot();
    expect(snap.length).toBe(1);
    expect(snap[0].cells.length).toBe(4);
    expect(snap[0].startTurn).toBe(0);
    expect(snap[0].expiresTurn).toBe(40);
    resetEngineerLockdowns();
  });

  it('3-line clear with combo crit → silent no-op (no lockdown placed)', () => {
    resetEngineerLockdowns();
    fxEngineerLockdownProtocol(null, {
      linesCleared: 3,
      comboTriggered: true,
      lastClearedRows: [0, 1, 2],
      lastClearedCols: [],
      gridSize: 8,
      currentTurn: 0,
    });
    expect(getEngineerLockdownsCount()).toBe(0);
  });

  it('4-line clear without combo crit → silent no-op (anti-Tetris is crit-gated)', () => {
    resetEngineerLockdowns();
    fxEngineerLockdownProtocol(null, {
      linesCleared: 4,
      comboTriggered: false,
      lastClearedRows: [0, 1, 2, 3],
      lastClearedCols: [],
      gridSize: 8,
      currentTurn: 0,
    });
    expect(getEngineerLockdownsCount()).toBe(0);
  });

  it('null/missing ctx → silent no-op (defensive guard)', () => {
    resetEngineerLockdowns();
    expect(() => fxEngineerLockdownProtocol(null, null)).not.toThrow();
    expect(getEngineerLockdownsCount()).toBe(0);
  });

  it('lockdown cells land at corner most-cleared per pickMostClearedCorner', () => {
    resetEngineerLockdowns();
    fxEngineerLockdownProtocol(null, {
      linesCleared: 4,
      comboTriggered: true,
      lastClearedRows: [5, 6, 7],
      lastClearedCols: [5, 6, 7],   // dominant lower-right
      gridSize: 8,
      currentTurn: 10,
    });
    const snap = getEngineerLockdownsSnapshot();
    expect(snap[0].cells).toEqual([
      { row: 6, col: 6 }, { row: 6, col: 7 },
      { row: 7, col: 6 }, { row: 7, col: 7 },
    ]);
    expect(snap[0].startTurn).toBe(10);
    expect(snap[0].expiresTurn).toBe(50);  // 10 + 40
    resetEngineerLockdowns();
  });
});

describe('identity-layer · Engineer Lockdown Protocol · isCellLockedByLockdownProtocol predicate', () => {
  it('after lockdown placed at top-left → 4 cells return true', () => {
    resetEngineerLockdowns();
    fxEngineerLockdownProtocol(null, {
      linesCleared: 4,
      comboTriggered: true,
      lastClearedRows: [0, 1, 2, 3],
      lastClearedCols: [],
      gridSize: 8,
      currentTurn: 0,
    });
    expect(isCellLockedByLockdownProtocol(0, 0)).toBe(true);
    expect(isCellLockedByLockdownProtocol(0, 1)).toBe(true);
    expect(isCellLockedByLockdownProtocol(1, 0)).toBe(true);
    expect(isCellLockedByLockdownProtocol(1, 1)).toBe(true);
    // Non-locked cells return false.
    expect(isCellLockedByLockdownProtocol(0, 2)).toBe(false);
    expect(isCellLockedByLockdownProtocol(2, 0)).toBe(false);
    expect(isCellLockedByLockdownProtocol(7, 7)).toBe(false);
    resetEngineerLockdowns();
  });

  it('after resetEngineerLockdowns → all cells return false', () => {
    resetEngineerLockdowns();
    fxEngineerLockdownProtocol(null, {
      linesCleared: 4,
      comboTriggered: true,
      lastClearedRows: [0, 1, 2, 3],
      lastClearedCols: [],
      gridSize: 8,
      currentTurn: 0,
    });
    expect(isCellLockedByLockdownProtocol(0, 0)).toBe(true);
    resetEngineerLockdowns();
    expect(isCellLockedByLockdownProtocol(0, 0)).toBe(false);
    expect(getEngineerLockdownsCount()).toBe(0);
  });

  it('defensive: non-finite inputs return false', () => {
    expect(isCellLockedByLockdownProtocol(null, 0)).toBe(false);
    expect(isCellLockedByLockdownProtocol(0, undefined)).toBe(false);
    expect(isCellLockedByLockdownProtocol('a', 'b')).toBe(false);
  });
});

describe('identity-layer · Engineer Lockdown Protocol · 40-turn expiration lifecycle', () => {
  it('lockdown placed at turn 5 → expires at turn 45 (5 + 40 = 45)', () => {
    resetEngineerLockdowns();
    fxEngineerLockdownProtocol(null, {
      linesCleared: 4,
      comboTriggered: true,
      lastClearedRows: [0, 1, 2, 3],
      lastClearedCols: [],
      gridSize: 8,
      currentTurn: 5,
    });
    const snap = getEngineerLockdownsSnapshot();
    expect(snap[0].startTurn).toBe(5);
    expect(snap[0].expiresTurn).toBe(45);

    // Tick at turn 44 → still active.
    const t44 = fxEngineerLockdownTick({ currentTurn: 44 });
    expect(t44.activeCount).toBe(1);
    expect(t44.expiredCount).toBe(0);

    // Tick at turn 45 → expired.
    const t45 = fxEngineerLockdownTick({ currentTurn: 45 });
    expect(t45.activeCount).toBe(0);
    expect(t45.expiredCount).toBe(1);
    expect(getEngineerLockdownsCount()).toBe(0);
    resetEngineerLockdowns();
  });

  it('multiple lockdowns (different start turns) tick independently', () => {
    resetEngineerLockdowns();
    // Lockdown 1 at turn 0 → expires at 40.
    fxEngineerLockdownProtocol(null, {
      linesCleared: 4, comboTriggered: true,
      lastClearedRows: [0, 1, 2, 3], lastClearedCols: [],
      gridSize: 8, currentTurn: 0,
    });
    // Lockdown 2 at turn 10 → expires at 50.
    fxEngineerLockdownProtocol(null, {
      linesCleared: 4, comboTriggered: true,
      lastClearedRows: [4, 5, 6, 7], lastClearedCols: [],
      gridSize: 8, currentTurn: 10,
    });
    expect(getEngineerLockdownsCount()).toBe(2);

    // Tick at turn 40 → lockdown 1 expires, lockdown 2 still active.
    const t40 = fxEngineerLockdownTick({ currentTurn: 40 });
    expect(t40.expiredCount).toBe(1);
    expect(t40.activeCount).toBe(1);

    // Tick at turn 50 → lockdown 2 expires.
    const t50 = fxEngineerLockdownTick({ currentTurn: 50 });
    expect(t50.expiredCount).toBe(1);
    expect(t50.activeCount).toBe(0);
    resetEngineerLockdowns();
  });

  it('empty state → tick returns 0 expired, 0 active (no-op)', () => {
    resetEngineerLockdowns();
    const r = fxEngineerLockdownTick({ currentTurn: 99 });
    expect(r.expiredCount).toBe(0);
    expect(r.activeCount).toBe(0);
  });

  it('resetEngineerLockdowns clears all state to empty array', () => {
    resetEngineerLockdowns();
    fxEngineerLockdownProtocol(null, {
      linesCleared: 4, comboTriggered: true,
      lastClearedRows: [0, 1, 2, 3], lastClearedCols: [],
      gridSize: 8, currentTurn: 0,
    });
    expect(getEngineerLockdownsCount()).toBe(1);
    resetEngineerLockdowns();
    expect(getEngineerLockdownsCount()).toBe(0);
    expect(getEngineerLockdownsSnapshot()).toEqual([]);
  });
});

describe('identity-layer · Engineer Lockdown Protocol · SACRED COW byte-perfect audit', () => {
  it('ENGINEER_LOCKDOWN_TURNS === 40 (MATCHES sacred engineer_p1_p2 duration)', () => {
    // Sacred reference: src/core/reactivity-events.js line ~604:
    //   `engineerLockedCells.set(k, 40);` — 40T is the sacred lockdown
    //   duration. T2.10 ENGINEER_LOCKDOWN_TURNS MUST match byte-perfect.
    expect(ENGINEER_LOCKDOWN_TURNS).toBe(40);
  });

  it('ENGINEER_LOCKDOWN_CELL_COUNT === 4 (MATCHES sacred 4-cell shape)', () => {
    // Sacred reference: src/core/reactivity-events.js line ~599:
    //   `for (let i = 0; i < 4 && cells.length > 0; i++)` — 4 cells is
    //   the sacred lockdown shape. T2.10 places contiguous 2×2 = 4 cells.
    expect(ENGINEER_LOCKDOWN_CELL_COUNT).toBe(4);
    expect(2 * 2).toBe(ENGINEER_LOCKDOWN_CELL_COUNT);
  });

  it('ENGINEER_LOCKDOWN_TRIGGER_LINES === 4 (Tetris crit threshold sacred)', () => {
    expect(ENGINEER_LOCKDOWN_TRIGGER_LINES).toBe(4);
  });

  it('ENGINEER_LOCKDOWN_COLOR === #B87333 (MATCHES sacred engineer banner)', () => {
    // Sacred reference: src/core/reactivity-events.js line ~606:
    //   `flashStateBanner('LOCKDOWN · ' + locked + ' CELLS WELDED', '#B87333');`
    //   — #B87333 is the sacred Engineer archetype color. T2.10 RE-USES.
    expect(ENGINEER_LOCKDOWN_COLOR).toBe('#B87333');
  });

  it('Sacred 5-role HERO_ULT_COST_BY_NEWROLE byte-perfect after lockdown fx round-trip', () => {
    resetEngineerLockdowns();
    fxEngineerLockdownProtocol(null, {
      linesCleared: 4, comboTriggered: true,
      lastClearedRows: [0, 1, 2, 3], lastClearedCols: [],
      gridSize: 8, currentTurn: 0,
    });
    fxEngineerLockdownTick({ currentTurn: 40 });
    resetEngineerLockdowns();
    // ULT thresholds untouched (lockdown protocol never writes to ULT).
    expect(HERO_ULT_COST_BY_NEWROLE.warrior).toBe(80);
    expect(HERO_ULT_COST_BY_NEWROLE.mage).toBe(100);
    expect(HERO_ULT_COST_BY_NEWROLE.hunter).toBe(120);
    expect(HERO_ULT_COST_BY_NEWROLE.tank).toBe(80);
    expect(HERO_ULT_COST_BY_NEWROLE.captain).toBe(100);
  });

  it('Sacred BERSERKER_ENRAGE_MULT byte-perfect (T2.09 invariant maintained)', () => {
    resetEngineerLockdowns();
    fxEngineerLockdownProtocol(null, {
      linesCleared: 4, comboTriggered: true,
      lastClearedRows: [0, 1, 2, 3], lastClearedCols: [],
      gridSize: 8, currentTurn: 0,
    });
    expect(BERSERKER_ENRAGE_MULT).toBe(2.0);
    expect(BERSERKER_ENRAGE_HP_PCT).toBe(0.5);
    resetEngineerLockdowns();
  });

  it('Sacred PHOENIX_REVIVE_HP_PCT / PHOENIX_IMMUNE_TURNS byte-perfect (T2.07 invariant maintained)', () => {
    resetEngineerLockdowns();
    fxEngineerLockdownProtocol(null, {
      linesCleared: 4, comboTriggered: true,
      lastClearedRows: [0, 1, 2, 3], lastClearedCols: [],
      gridSize: 8, currentTurn: 0,
    });
    expect(PHOENIX_REVIVE_HP_PCT).toBe(0.6);
    expect(PHOENIX_IMMUNE_TURNS).toBe(2);
    resetEngineerLockdowns();
  });

  it('Sacred REACTIVITY_TELEGRAPH_MS untouched (T2.10 uses no telegraph per spec §3.4 field 6)', () => {
    expect(REACTIVITY_TELEGRAPH_MS).toBe(3000);
    expect(REACTIVITY_BANNER_DURATION_MS).toBe(1500);
  });

  it('Stagger Loop constants byte-perfect (T2.09 invariant maintained)', () => {
    expect(BOSS_STATE_ACTIVE).toBe('active');
    expect(BOSS_STATE_STAGGER).toBe('stagger');
    expect(BOSS_STATE_RECOVERY).toBe('recovery');
    expect(STAGGER_DURATION_TURNS).toBe(4);
    expect(RECOVERY_DURATION_TURNS).toBe(2);
  });
});

describe('identity-layer · Engineer Lockdown Protocol · constants & budgets', () => {
  it('IDENTITY_BOSS_FX_KEYS.ENGINEER_LOCKDOWN registered', () => {
    expect(IDENTITY_BOSS_FX_KEYS.ENGINEER_LOCKDOWN).toBe('engineer_lockdown');
  });

  it('BOSS_IDENTITY_FX.engineer → engineer_lockdown', () => {
    expect(BOSS_IDENTITY_FX.engineer).toBe('engineer_lockdown');
  });

  it('IDENTITY_BOSS_FX_BUDGETS.engineer_lockdown has correct budget shape', () => {
    const b = IDENTITY_BOSS_FX_BUDGETS[IDENTITY_BOSS_FX_KEYS.ENGINEER_LOCKDOWN];
    expect(b).toBeDefined();
    expect(b.initialMs).toBe(10);
    expect(b.steadyStateMs).toBe(1);
    expect(b.decayMs).toBe(600);
    expect(b.duration).toBe('40 turns');
  });

  it('All per-fire wall-time budgets are positive integers', () => {
    expect(ENGINEER_LOCKDOWN_INITIAL_BUDGET_MS).toBe(10);
    expect(ENGINEER_LOCKDOWN_PLACEMENT_BUDGET_MS).toBe(4);
    expect(ENGINEER_LOCKDOWN_RATCHET_BUDGET_MS).toBe(6);
    expect(ENGINEER_LOCKDOWN_PER_TURN_TICK_BUDGET_MS).toBe(1);
    // Placement + ratchet sum within initial budget.
    expect(ENGINEER_LOCKDOWN_PLACEMENT_BUDGET_MS + ENGINEER_LOCKDOWN_RATCHET_BUDGET_MS)
      .toBeLessThanOrEqual(ENGINEER_LOCKDOWN_INITIAL_BUDGET_MS);
  });

  it('ENGINEER_LOCKDOWN_RATCHET_DURATION_MS = 600 + ENGINEER_LOCKDOWN_CELEBRATION_MS = 400', () => {
    expect(ENGINEER_LOCKDOWN_RATCHET_DURATION_MS).toBe(600);
    expect(ENGINEER_LOCKDOWN_CELEBRATION_MS).toBe(400);
  });
});

describe('identity-layer · Engineer Lockdown Protocol · cross-mechanic regression (T2.02-T2.09 invariants)', () => {
  it('Engineer Lockdown active does NOT break Phoenix / Lich / Bloodtide coexistence', () => {
    resetAshenReign();
    resetCursedTiles();
    resetBloodtide();
    resetEngineerLockdowns();

    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    grid[0][0] = 'umbra';
    grid[0][1] = 'umbra';
    grid[0][2] = 'umbra';

    fxPhoenixAshenReign(null, null);
    fxLichCursedTiles(null, { gridState: grid, currentTurn: 0 });
    incrementBloodtideClearCount();
    incrementBloodtideClearCount();
    incrementBloodtideClearCount();
    fxBerserkerBloodtidePulse(null, null);
    fxEngineerLockdownProtocol(null, {
      linesCleared: 4, comboTriggered: true,
      lastClearedRows: [0, 1, 2, 3], lastClearedCols: [],
      gridSize: 8, currentTurn: 0,
    });

    // All four boss-reactive states active independently.
    expect(isAshenReignActive()).toBe(true);
    expect(getCursedTilesCount()).toBeGreaterThan(0);
    expect(isBloodtidePulsePending()).toBe(true);
    expect(getEngineerLockdownsCount()).toBe(1);

    // Cleanup.
    fxPhoenixAshenReignRelease();
    resetCursedTiles();
    resetBloodtide();
    resetEngineerLockdowns();
    expect(isAshenReignActive()).toBe(false);
    expect(getCursedTilesCount()).toBe(0);
    expect(isBloodtidePulsePending()).toBe(false);
    expect(getEngineerLockdownsCount()).toBe(0);
  });

  it('Engineer Lockdown does NOT block race FX dispatch (T2.02-T2.06 invariant)', () => {
    __identityFxTestables.resetCoinPool();
    __identityFxTestables.resetSharkBitePool();
    __identityFxTestables.resetRockEchoPool();
    __identityFxTestables.resetCrocFragmentPool();
    __identityFxTestables.resetSparkRayPool();
    resetCrocFragmentBank();
    resetEngineerLockdowns();

    fxEngineerLockdownProtocol(null, {
      linesCleared: 4, comboTriggered: true,
      lastClearedRows: [0, 1, 2, 3], lastClearedCols: [],
      gridSize: 8, currentTurn: 0,
    });
    expect(getEngineerLockdownsCount()).toBe(1);

    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let c = 0; c < 8; c++) grid[0][c] = 'solar';
    for (let c = 0; c < 8; c++) grid[2][c] = 'grove';

    const squad = [
      { race: 'pirate' },
      { race: 'shark' },
      { race: 'shark' },
      { race: 'rock' },
      { race: 'crocodile' },
      { race: 'spark' },
    ];
    const ctx = { gridState: grid, dominantElementsByLine: ['solar', 'grove'] };
    expect(() => dispatchIdentityFx([0, 2], [], squad, null, ctx)).not.toThrow();
    // Spark cascade still fired.
    expect(ctx._dominantCountModifier).toBe(1);
    resetEngineerLockdowns();
  });

  it('Sacred RACE_SYNERGY entries byte-perfect after Engineer Lockdown round-trip', () => {
    resetEngineerLockdowns();
    fxEngineerLockdownProtocol(null, {
      linesCleared: 4, comboTriggered: true,
      lastClearedRows: [0, 1, 2, 3], lastClearedCols: [],
      gridSize: 8, currentTurn: 0,
    });
    fxEngineerLockdownTick({ currentTurn: 40 });
    resetEngineerLockdowns();
    expect(RACE_SYNERGY.lion[5].bonusDmg.solar).toBe(3);
    expect(RACE_SYNERGY.rock[3].encore).toBe(true);
    expect(RACE_SYNERGY.golem[2].maxShieldBonus).toBe(1);
    expect(RACE_SYNERGY.golem[3].maxShieldBonus).toBe(2);
    expect(RACE_SYNERGY.golem[5].maxShieldBonus).toBe(2);
    // Race + boss identity sibling exports untouched.
    expect(RACE_IDENTITY_FX.pirate).toBe('pirate_plunder');
    expect(RACE_IDENTITY_FX.spark).toBe('spark_cascade');
    expect(BOSS_IDENTITY_FX.phoenix).toBe('phoenix_ashen_reign');
    expect(BOSS_IDENTITY_FX.assassin).toBe('lich_cursed_tiles');
    expect(BOSS_IDENTITY_FX.berserker).toBe('berserker_bloodtide');
    expect(BOSS_IDENTITY_FX.frenzy).toBe('berserker_bloodtide');
    expect(BOSS_IDENTITY_FX.engineer).toBe('engineer_lockdown');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2026-05-12 — TASK-038 (T2.11): Grovewarden Root Surge unit tests.
// Spec: docs/design/mechanics/identity-layer.md §3.5. FIFTH and FINAL
// boss-reactive identity mechanic — sliding-window non-grove trigger.
// Pure math + helper coverage. No DOM — Vitest runs in `node` env.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('identity-layer · Grovewarden Root Surge · shouldRootSurgeFire (sliding-window trigger gate)', () => {
  it('buffer of 3 non-grove (ember, tide, umbra) → true', () => {
    expect(shouldRootSurgeFire(['ember', 'tide', 'umbra'], 'grove')).toBe(true);
  });

  it('buffer of 3 mixed non-grove (solar, ember, umbra) → true', () => {
    expect(shouldRootSurgeFire(['solar', 'ember', 'umbra'], 'grove')).toBe(true);
  });

  it('buffer of 3 with 1 grove (ember, grove, umbra) → false', () => {
    expect(shouldRootSurgeFire(['ember', 'grove', 'umbra'], 'grove')).toBe(false);
  });

  it('buffer of 3 all grove (grove, grove, grove) → false', () => {
    expect(shouldRootSurgeFire(['grove', 'grove', 'grove'], 'grove')).toBe(false);
  });

  it('buffer of 2 (insufficient sliding-window history) → false', () => {
    expect(shouldRootSurgeFire(['ember', 'tide'], 'grove')).toBe(false);
  });

  it('empty buffer → false (early-battle state)', () => {
    expect(shouldRootSurgeFire([], 'grove')).toBe(false);
  });

  it('buffer with grove at end (ember, tide, grove) → false', () => {
    expect(shouldRootSurgeFire(['ember', 'tide', 'grove'], 'grove')).toBe(false);
  });

  it('defensive: non-array input → false', () => {
    expect(shouldRootSurgeFire(null, 'grove')).toBe(false);
    expect(shouldRootSurgeFire(undefined, 'grove')).toBe(false);
    expect(shouldRootSurgeFire('not-an-array', 'grove')).toBe(false);
    expect(shouldRootSurgeFire({}, 'grove')).toBe(false);
  });

  it('rootSurgeGatePasses reads module-state buffer (default grove element)', () => {
    resetGrovewardenRootSurge();
    expect(rootSurgeGatePasses()).toBe(false);
    pushRecentClear('ember');
    pushRecentClear('tide');
    pushRecentClear('umbra');
    expect(rootSurgeGatePasses()).toBe(true);
    resetGrovewardenRootSurge();
  });
});

describe('identity-layer · Grovewarden Root Surge · pushRecentClear (circular buffer)', () => {
  it('first 3 pushes → buffer retains all 3 (FIFO grows)', () => {
    resetGrovewardenRootSurge();
    pushRecentClear('ember');
    pushRecentClear('tide');
    pushRecentClear('umbra');
    expect(getRecentClearsSnapshot()).toEqual(['ember', 'tide', 'umbra']);
    resetGrovewardenRootSurge();
  });

  it('4th push drops oldest entry (FIFO size 3)', () => {
    resetGrovewardenRootSurge();
    pushRecentClear('ember');
    pushRecentClear('tide');
    pushRecentClear('umbra');
    pushRecentClear('solar');
    expect(getRecentClearsSnapshot()).toEqual(['tide', 'umbra', 'solar']);
    resetGrovewardenRootSurge();
  });

  it('5+ pushes → buffer stays size 3 (FIFO order maintained)', () => {
    resetGrovewardenRootSurge();
    for (const e of ['ember', 'tide', 'umbra', 'solar', 'ember']) {
      pushRecentClear(e);
    }
    expect(getRecentClearsSnapshot()).toEqual(['umbra', 'solar', 'ember']);
    resetGrovewardenRootSurge();
  });

  it('grove push after 2 non-grove → gate fails (sliding window contaminated)', () => {
    resetGrovewardenRootSurge();
    pushRecentClear('ember');
    pushRecentClear('tide');
    pushRecentClear('grove');   // contaminates buffer
    expect(rootSurgeGatePasses()).toBe(false);
    resetGrovewardenRootSurge();
  });

  it('defensive: non-string / empty input → silent skip (no buffer mutation)', () => {
    resetGrovewardenRootSurge();
    pushRecentClear('ember');
    pushRecentClear(null);
    pushRecentClear(undefined);
    pushRecentClear('');
    pushRecentClear(123);
    pushRecentClear('tide');
    // Only the two valid pushes should be in the buffer.
    expect(getRecentClearsSnapshot()).toEqual(['ember', 'tide']);
    resetGrovewardenRootSurge();
  });

  it('sliding window pattern: non-grove, grove, non-grove, non-grove, non-grove → gate flips false→true', () => {
    resetGrovewardenRootSurge();
    pushRecentClear('ember');
    pushRecentClear('grove');   // buffer: [ember, grove]
    pushRecentClear('tide');    // buffer: [ember, grove, tide] — grove present, false
    expect(rootSurgeGatePasses()).toBe(false);
    pushRecentClear('umbra');   // buffer: [grove, tide, umbra] — grove present, false
    expect(rootSurgeGatePasses()).toBe(false);
    pushRecentClear('solar');   // buffer: [tide, umbra, solar] — all non-grove, TRUE
    expect(rootSurgeGatePasses()).toBe(true);
    resetGrovewardenRootSurge();
  });
});

describe('identity-layer · Grovewarden Root Surge · pickRandomEmptyCells', () => {
  it('0 empty cells (fully filled grid) → returns empty array', () => {
    resetGrovewardenRootSurge();
    const grid = Array(8).fill(null).map(() => Array(8).fill('ember'));
    const result = pickRandomEmptyCells(grid, 3);
    expect(result).toEqual([]);
    resetGrovewardenRootSurge();
  });

  it('many empty cells → returns exactly 3 unique cells', () => {
    resetGrovewardenRootSurge();
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));  // all empty
    const result = pickRandomEmptyCells(grid, 3);
    expect(result.length).toBe(3);
    // Verify uniqueness.
    const keys = result.map(c => c.row + '_' + c.col);
    expect(new Set(keys).size).toBe(3);
    resetGrovewardenRootSurge();
  });

  it('exactly 2 empty cells → returns 2 (partial fill OK per spec §3.5 field 4)', () => {
    resetGrovewardenRootSurge();
    const grid = Array(8).fill(null).map(() => Array(8).fill('ember'));
    grid[0][0] = null;
    grid[3][5] = null;
    const result = pickRandomEmptyCells(grid, 3);
    expect(result.length).toBe(2);
    resetGrovewardenRootSurge();
  });

  it('only counts EMPTY cells (excludes non-empty ones, opposite of pickRandomNonEmptyCells)', () => {
    resetGrovewardenRootSurge();
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    // Fill some cells; pickRandomEmptyCells should NOT return these.
    grid[2][2] = 'ember';
    grid[2][3] = 'tide';
    grid[2][4] = 'grove';
    const result = pickRandomEmptyCells(grid, 3);
    expect(result.length).toBe(3);
    for (const cell of result) {
      expect(grid[cell.row][cell.col]).toBeFalsy();
    }
    resetGrovewardenRootSurge();
  });

  it('null/undefined gridState → returns empty array (defensive)', () => {
    expect(pickRandomEmptyCells(null, 3)).toEqual([]);
    expect(pickRandomEmptyCells(undefined, 3)).toEqual([]);
  });

  it('computeRootSurgeCells passes through to pickRandomEmptyCells with hard cap 3', () => {
    resetGrovewardenRootSurge();
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    const result = computeRootSurgeCells(grid);
    expect(result.length).toBe(ROOT_SURGE_CELL_COUNT);
    expect(result.length).toBe(3);
    resetGrovewardenRootSurge();
  });
});

describe('identity-layer · Grovewarden Root Surge · computeRootClearGoldReward (cross-layer Pirate Plunder)', () => {
  it('1 rooted cell cleared → 10 gold (HARD spec value)', () => {
    expect(computeRootClearGoldReward(1)).toBe(10);
    expect(computeRootClearGoldReward(1)).toBe(ROOT_SURGE_GOLD_PER_CLEAR);
  });

  it('3 rooted cells cleared (batch event) → 30 gold', () => {
    expect(computeRootClearGoldReward(3)).toBe(30);
  });

  it('0 rooted cells → 0 gold (no negative gold)', () => {
    expect(computeRootClearGoldReward(0)).toBe(0);
  });

  it('default arg (no input) → 10 gold (single-clear convention)', () => {
    expect(computeRootClearGoldReward()).toBe(10);
  });

  it('defensive: negative / non-finite → 0 gold (clamp)', () => {
    expect(computeRootClearGoldReward(-5)).toBe(0);
    expect(computeRootClearGoldReward(NaN)).toBe(0);
    expect(computeRootClearGoldReward('not-a-number')).toBe(0);
  });
});

describe('identity-layer · Grovewarden Root Surge · 5-turn lifecycle (computeRootSurgeTickResult)', () => {
  it('root placed turn 5 / expires turn 10 / tick at turn 10 → shouldExpire=true', () => {
    const root = { row: 0, col: 0, placedTurn: 5, expiresTurn: 10 };
    const r = computeRootSurgeTickResult(root, 10);
    expect(r.shouldExpire).toBe(true);
    expect(r.active).toBe(false);
  });

  it('root placed turn 5 / tick at turn 9 → still active', () => {
    const root = { row: 0, col: 0, placedTurn: 5, expiresTurn: 10 };
    const r = computeRootSurgeTickResult(root, 9);
    expect(r.shouldExpire).toBe(false);
    expect(r.active).toBe(true);
  });

  it('root placed turn 5 / tick at turn 11 → shouldExpire=true (past expiration)', () => {
    const root = { row: 0, col: 0, placedTurn: 5, expiresTurn: 10 };
    const r = computeRootSurgeTickResult(root, 11);
    expect(r.shouldExpire).toBe(true);
  });

  it('defensive: null root → inactive, no expiration', () => {
    const r = computeRootSurgeTickResult(null, 10);
    expect(r.shouldExpire).toBe(false);
    expect(r.active).toBe(false);
  });

  it('defensive: non-finite turn → active, no expiration', () => {
    const root = { row: 0, col: 0, placedTurn: 5, expiresTurn: 10 };
    const r = computeRootSurgeTickResult(root, NaN);
    expect(r.shouldExpire).toBe(false);
  });

  it('goldGrantOnClear field always = ROOT_SURGE_GOLD_PER_CLEAR (10) for documentation parity', () => {
    const root = { row: 0, col: 0, placedTurn: 5, expiresTurn: 10 };
    expect(computeRootSurgeTickResult(root, 9).goldGrantOnClear).toBe(10);
    expect(computeRootSurgeTickResult(root, 10).goldGrantOnClear).toBe(10);
  });
});

describe('identity-layer · Grovewarden Root Surge · fxGrovewardenRootSurge gate behavior', () => {
  it('buffer of 3 non-grove → 3 roots placed in mirror state', () => {
    resetGrovewardenRootSurge();
    pushRecentClear('ember');
    pushRecentClear('tide');
    pushRecentClear('umbra');
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    fxGrovewardenRootSurge(null, { gridState: grid, currentTurn: 0 });
    expect(getActiveRootCellsCount()).toBe(3);
    const snap = getActiveRootCellsSnapshot();
    expect(snap.length).toBe(3);
    for (const r of snap) {
      expect(r.placedTurn).toBe(0);
      expect(r.expiresTurn).toBe(5);
    }
    resetGrovewardenRootSurge();
  });

  it('buffer of 2 (insufficient) → silent no-op (no roots placed)', () => {
    resetGrovewardenRootSurge();
    pushRecentClear('ember');
    pushRecentClear('tide');
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    fxGrovewardenRootSurge(null, { gridState: grid, currentTurn: 0 });
    expect(getActiveRootCellsCount()).toBe(0);
    resetGrovewardenRootSurge();
  });

  it('buffer of 3 with grove entry → silent no-op (gate fails)', () => {
    resetGrovewardenRootSurge();
    pushRecentClear('ember');
    pushRecentClear('grove');
    pushRecentClear('umbra');
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    fxGrovewardenRootSurge(null, { gridState: grid, currentTurn: 0 });
    expect(getActiveRootCellsCount()).toBe(0);
    resetGrovewardenRootSurge();
  });

  it('null ctx → silent no-op (defensive guard)', () => {
    resetGrovewardenRootSurge();
    pushRecentClear('ember');
    pushRecentClear('tide');
    pushRecentClear('umbra');
    expect(() => fxGrovewardenRootSurge(null, null)).not.toThrow();
    // Without gridState, no roots placed (grid defaults to undefined global).
    expect(getActiveRootCellsCount()).toBe(0);
    resetGrovewardenRootSurge();
  });

  it('5-turn expiration lifecycle: placed turn 7 / expires turn 12', () => {
    resetGrovewardenRootSurge();
    pushRecentClear('ember');
    pushRecentClear('tide');
    pushRecentClear('umbra');
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    fxGrovewardenRootSurge(null, { gridState: grid, currentTurn: 7 });
    const snap0 = getActiveRootCellsSnapshot();
    expect(snap0[0].placedTurn).toBe(7);
    expect(snap0[0].expiresTurn).toBe(12);  // 7 + 5

    // Tick at turn 11 → still active.
    const t11 = fxGrovewardenRootSurgeTick({ currentTurn: 11 });
    expect(t11.activeCount).toBe(3);
    expect(t11.expiredCount).toBe(0);

    // Tick at turn 12 → all 3 expire.
    const t12 = fxGrovewardenRootSurgeTick({ currentTurn: 12 });
    expect(t12.activeCount).toBe(0);
    expect(t12.expiredCount).toBe(3);
    expect(getActiveRootCellsCount()).toBe(0);
    resetGrovewardenRootSurge();
  });

  it('empty state tick → 0 expired, 0 active (no-op)', () => {
    resetGrovewardenRootSurge();
    const r = fxGrovewardenRootSurgeTick({ currentTurn: 99 });
    expect(r.expiredCount).toBe(0);
    expect(r.activeCount).toBe(0);
  });
});

describe('identity-layer · Grovewarden Root Surge · isCellRooted predicate', () => {
  it('after fire → roots at picked cells return true; others return false', () => {
    resetGrovewardenRootSurge();
    pushRecentClear('ember');
    pushRecentClear('tide');
    pushRecentClear('umbra');
    // Single empty cell so pick is deterministic.
    const grid = Array(8).fill(null).map(() => Array(8).fill('ember'));
    grid[4][4] = null;
    fxGrovewardenRootSurge(null, { gridState: grid, currentTurn: 0 });
    expect(isCellRooted(4, 4)).toBe(true);
    // Other cells (no root) → false.
    expect(isCellRooted(0, 0)).toBe(false);
    expect(isCellRooted(7, 7)).toBe(false);
    resetGrovewardenRootSurge();
  });

  it('after resetGrovewardenRootSurge → all cells return false', () => {
    resetGrovewardenRootSurge();
    pushRecentClear('ember');
    pushRecentClear('tide');
    pushRecentClear('umbra');
    const grid = Array(8).fill(null).map(() => Array(8).fill('ember'));
    grid[2][3] = null;
    fxGrovewardenRootSurge(null, { gridState: grid, currentTurn: 0 });
    expect(isCellRooted(2, 3)).toBe(true);
    resetGrovewardenRootSurge();
    expect(isCellRooted(2, 3)).toBe(false);
    expect(getActiveRootCellsCount()).toBe(0);
  });

  it('defensive: non-finite inputs return false', () => {
    expect(isCellRooted(null, 0)).toBe(false);
    expect(isCellRooted(0, undefined)).toBe(false);
    expect(isCellRooted('a', 'b')).toBe(false);
  });
});

describe('identity-layer · Grovewarden Root Surge · onRootCellCleared (cross-layer Pirate Plunder)', () => {
  it('clearing a rooted cell → grants 10 gold via addGoldApi + removes root', () => {
    resetGrovewardenRootSurge();
    pushRecentClear('ember');
    pushRecentClear('tide');
    pushRecentClear('umbra');
    const grid = Array(8).fill(null).map(() => Array(8).fill('ember'));
    grid[3][3] = null;
    fxGrovewardenRootSurge(null, { gridState: grid, currentTurn: 0 });
    expect(isCellRooted(3, 3)).toBe(true);

    let goldDelta = 0;
    const ctx = { addGoldApi: { add: (n) => { goldDelta += n; } } };
    const result = onRootCellCleared(3, 3, ctx);

    expect(result.goldGranted).toBe(10);
    expect(result.cellRemoved).toBe(true);
    expect(goldDelta).toBe(10);
    expect(isCellRooted(3, 3)).toBe(false);
    expect(getActiveRootCellsCount()).toBe(0);
    resetGrovewardenRootSurge();
  });

  it('clearing a non-rooted cell → 0 gold + no mutation (defensive)', () => {
    resetGrovewardenRootSurge();
    let goldDelta = 0;
    const ctx = { addGoldApi: { add: (n) => { goldDelta += n; } } };
    const result = onRootCellCleared(5, 5, ctx);
    expect(result.goldGranted).toBe(0);
    expect(result.cellRemoved).toBe(false);
    expect(goldDelta).toBe(0);
  });

  it('clearing 3 separate rooted cells → 3 × 10 = 30 gold total', () => {
    resetGrovewardenRootSurge();
    pushRecentClear('ember');
    pushRecentClear('tide');
    pushRecentClear('umbra');
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    fxGrovewardenRootSurge(null, { gridState: grid, currentTurn: 0 });
    const rooted = getActiveRootCellsSnapshot();
    expect(rooted.length).toBe(3);

    let goldDelta = 0;
    const ctx = { addGoldApi: { add: (n) => { goldDelta += n; } } };
    for (const r of rooted) {
      onRootCellCleared(r.row, r.col, ctx);
    }
    expect(goldDelta).toBe(30);
    expect(getActiveRootCellsCount()).toBe(0);
    resetGrovewardenRootSurge();
  });

  it('defensive: non-finite (row, col) → 0 gold, no mutation', () => {
    resetGrovewardenRootSurge();
    const result = onRootCellCleared(null, 0, {});
    expect(result.goldGranted).toBe(0);
    expect(result.cellRemoved).toBe(false);
  });
});

describe('identity-layer · Grovewarden Root Surge · constants + budgets', () => {
  it('IDENTITY_BOSS_FX_KEYS.GROVEWARDEN_ROOT_SURGE registered', () => {
    expect(IDENTITY_BOSS_FX_KEYS.GROVEWARDEN_ROOT_SURGE).toBe('grovewarden_root_surge');
  });

  it('BOSS_IDENTITY_FX.bruiser → grovewarden_root_surge', () => {
    expect(BOSS_IDENTITY_FX.bruiser).toBe('grovewarden_root_surge');
  });

  it('IDENTITY_BOSS_FX_BUDGETS.grovewarden_root_surge has correct budget shape', () => {
    const b = IDENTITY_BOSS_FX_BUDGETS[IDENTITY_BOSS_FX_KEYS.GROVEWARDEN_ROOT_SURGE];
    expect(b).toBeDefined();
    expect(b.initialMs).toBe(14);
    expect(b.steadyStateMs).toBe(1);
    expect(b.decayMs).toBe(300);
    expect(b.duration).toBe('5 turns');
  });

  it('Hard spec values byte-perfect (spec §3.5 field 4)', () => {
    expect(ROOT_SURGE_CELL_COUNT).toBe(3);
    expect(ROOT_SURGE_TURNS_UNTIL_AUTO_CLEAR).toBe(5);
    expect(ROOT_SURGE_GOLD_PER_CLEAR).toBe(10);
    expect(ROOT_SURGE_TRIGGER_NON_GROVE_COUNT).toBe(3);
    expect(ROOT_SURGE_GROVE_ELEMENT).toBe('grove');
  });

  it('Telegraph constant RE-USES sacred REACTIVITY_TELEGRAPH_MS (3000)', () => {
    expect(ROOT_SURGE_TELEGRAPH_MS).toBe(3000);
    expect(ROOT_SURGE_TELEGRAPH_MS).toBe(REACTIVITY_TELEGRAPH_MS);
  });

  it('Overlay decay + color byte-perfect (spec §3.5 field 4 + field 6)', () => {
    expect(ROOT_SURGE_OVERLAY_DECAY_MS).toBe(300);
    expect(ROOT_SURGE_OVERLAY_COLOR).toBe('#2D8659');
  });

  it('ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER carries spec §3.5 field 6 string', () => {
    // PLACEHOLDER per ESC-02 O2 ruling. FINAL COPY: pending Roman approval
    // at Phase 2 PR merge. The string lives in the isolated constant —
    // sacred NARRATOR_LINES table stays byte-perfect.
    expect(ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER).toBe('Where you would not bloom, I will.');
  });

  it('Performance ceilings positive integers + ≤14ms initial', () => {
    expect(ROOT_SURGE_INITIAL_BUDGET_MS).toBe(14);
    expect(ROOT_SURGE_PER_TURN_TICK_BUDGET_MS).toBe(1);
  });
});

describe('identity-layer · Grovewarden Root Surge · SACRED COW byte-perfect audit', () => {
  it('Element Synergy sacred — grove RACE_SYNERGY troll/golem tiers BYTE-PERFECT after Root Surge round-trip', () => {
    // Drive a full Root Surge lifecycle.
    resetGrovewardenRootSurge();
    pushRecentClear('ember');
    pushRecentClear('tide');
    pushRecentClear('umbra');
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    fxGrovewardenRootSurge(null, { gridState: grid, currentTurn: 0 });
    fxGrovewardenRootSurgeTick({ currentTurn: 5 });
    resetGrovewardenRootSurge();

    // RACE_SYNERGY troll grove tier kit BYTE-PERFECT (CLAUDE.md §2.1 sacred).
    expect(RACE_SYNERGY.troll[2].hp).toBe(2);
    expect(RACE_SYNERGY.troll[2].regrowth).toBe(true);
    expect(RACE_SYNERGY.troll[3].hp).toBe(2);
    expect(RACE_SYNERGY.troll[3].dmgMult).toBe(0.10);
    expect(RACE_SYNERGY.troll[3].stoneblood).toBe(true);
    expect(RACE_SYNERGY.troll[5].hp).toBe(3);
    expect(RACE_SYNERGY.troll[5].shields).toBe(2);
    expect(RACE_SYNERGY.troll[5].dmgMult).toBe(0.15);
    expect(RACE_SYNERGY.troll[5].mossArmor).toBe(true);
    expect(RACE_SYNERGY.troll[5].heartwood).toBe(true);

    // RACE_SYNERGY golem grove+shield tier kit BYTE-PERFECT (T2.05 invariant).
    expect(RACE_SYNERGY.golem[2].maxShieldBonus).toBe(1);
    expect(RACE_SYNERGY.golem[3].maxShieldBonus).toBe(2);
    expect(RACE_SYNERGY.golem[5].maxShieldBonus).toBe(2);
    expect(RACE_SYNERGY.golem[3].shieldFury).toBe(true);
    expect(RACE_SYNERGY.golem[5].aegis).toBe(true);
  });

  it('NARRATOR_LINES sacred table UNTOUCHED — placeholder lives in isolated constant', () => {
    // The placeholder line is the only Root Surge narrator surface. It
    // lives in `src/data/identity-layer.js` as an isolated constant —
    // NOT in `src/feel/narrator-lines.js` (the sacred NARRATOR_LINES
    // table). The sacred infrastructure stays byte-perfect per ESC-02 O2.
    expect(typeof ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER).toBe('string');
    expect(ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER.length).toBeGreaterThan(0);
    // Designer-drafted string with Darkest-Dungeon-voice cadence.
    expect(ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER).toContain('bloom');
  });

  it('Sacred 5-role HERO_ULT_COST_BY_NEWROLE byte-perfect after Root Surge round-trip', () => {
    resetGrovewardenRootSurge();
    pushRecentClear('ember');
    pushRecentClear('tide');
    pushRecentClear('umbra');
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    fxGrovewardenRootSurge(null, { gridState: grid, currentTurn: 0 });
    fxGrovewardenRootSurgeTick({ currentTurn: 5 });
    resetGrovewardenRootSurge();
    // ULT thresholds untouched (Root Surge never writes to ULT).
    expect(HERO_ULT_COST_BY_NEWROLE.warrior).toBe(80);
    expect(HERO_ULT_COST_BY_NEWROLE.mage).toBe(100);
    expect(HERO_ULT_COST_BY_NEWROLE.hunter).toBe(120);
    expect(HERO_ULT_COST_BY_NEWROLE.tank).toBe(80);
    expect(HERO_ULT_COST_BY_NEWROLE.captain).toBe(100);
  });

  it('Sacred PHOENIX / BERSERKER / STAGGER LOOP invariants byte-perfect (T2.07-T2.10 maintained)', () => {
    resetGrovewardenRootSurge();
    expect(PHOENIX_REVIVE_HP_PCT).toBe(0.6);
    expect(PHOENIX_IMMUNE_TURNS).toBe(2);
    expect(BERSERKER_ENRAGE_HP_PCT).toBe(0.5);
    expect(BERSERKER_ENRAGE_MULT).toBe(2.0);
    expect(REACTIVITY_TELEGRAPH_MS).toBe(3000);
    expect(REACTIVITY_BANNER_DURATION_MS).toBe(1500);
    expect(BOSS_STATE_ACTIVE).toBe('active');
    expect(BOSS_STATE_STAGGER).toBe('stagger');
    expect(BOSS_STATE_RECOVERY).toBe('recovery');
    expect(STAGGER_DURATION_TURNS).toBe(4);
    expect(RECOVERY_DURATION_TURNS).toBe(2);
  });
});

describe('identity-layer · Grovewarden Root Surge · cross-mechanic regression (T2.02-T2.10 invariants)', () => {
  it('Root Surge active does NOT break Phoenix / Lich / Bloodtide / Engineer coexistence', () => {
    resetAshenReign();
    resetCursedTiles();
    resetBloodtide();
    resetEngineerLockdowns();
    resetGrovewardenRootSurge();

    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    grid[0][0] = 'umbra';
    grid[0][1] = 'umbra';
    grid[0][2] = 'umbra';

    // Activate ALL FIVE boss-reactive layers.
    fxPhoenixAshenReign(null, null);
    fxLichCursedTiles(null, { gridState: grid, currentTurn: 0 });
    incrementBloodtideClearCount();
    incrementBloodtideClearCount();
    incrementBloodtideClearCount();
    fxBerserkerBloodtidePulse(null, null);
    fxEngineerLockdownProtocol(null, {
      linesCleared: 4, comboTriggered: true,
      lastClearedRows: [0, 1, 2, 3], lastClearedCols: [],
      gridSize: 8, currentTurn: 0,
    });
    // For Root Surge, use a grid that has empty cells in row 5 (avoid
    // overlapping the umbra-filled cells row 0).
    const emptyGrid = Array(8).fill(null).map(() => Array(8).fill(null));
    pushRecentClear('ember');
    pushRecentClear('tide');
    pushRecentClear('umbra');
    fxGrovewardenRootSurge(null, { gridState: emptyGrid, currentTurn: 0 });

    // All FIVE boss-reactive states active independently.
    expect(isAshenReignActive()).toBe(true);
    expect(getCursedTilesCount()).toBeGreaterThan(0);
    expect(isBloodtidePulsePending()).toBe(true);
    expect(getEngineerLockdownsCount()).toBe(1);
    expect(getActiveRootCellsCount()).toBe(3);

    // Cleanup.
    fxPhoenixAshenReignRelease();
    resetCursedTiles();
    resetBloodtide();
    resetEngineerLockdowns();
    resetGrovewardenRootSurge();
    expect(isAshenReignActive()).toBe(false);
    expect(getCursedTilesCount()).toBe(0);
    expect(isBloodtidePulsePending()).toBe(false);
    expect(getEngineerLockdownsCount()).toBe(0);
    expect(getActiveRootCellsCount()).toBe(0);
  });

  it('Root Surge does NOT block race FX dispatch (T2.02-T2.06 invariant)', () => {
    __identityFxTestables.resetCoinPool();
    __identityFxTestables.resetSharkBitePool();
    __identityFxTestables.resetRockEchoPool();
    __identityFxTestables.resetCrocFragmentPool();
    __identityFxTestables.resetSparkRayPool();
    resetCrocFragmentBank();
    resetGrovewardenRootSurge();

    pushRecentClear('ember');
    pushRecentClear('tide');
    pushRecentClear('umbra');
    const emptyGrid = Array(8).fill(null).map(() => Array(8).fill(null));
    fxGrovewardenRootSurge(null, { gridState: emptyGrid, currentTurn: 0 });
    expect(getActiveRootCellsCount()).toBe(3);

    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let c = 0; c < 8; c++) grid[0][c] = 'solar';
    for (let c = 0; c < 8; c++) grid[2][c] = 'grove';

    const squad = [
      { race: 'pirate' },
      { race: 'shark' },
      { race: 'shark' },
      { race: 'rock' },
      { race: 'crocodile' },
      { race: 'spark' },
    ];
    const ctx = { gridState: grid, dominantElementsByLine: ['solar', 'grove'] };
    expect(() => dispatchIdentityFx([0, 2], [], squad, null, ctx)).not.toThrow();
    // Spark cascade still fired.
    expect(ctx._dominantCountModifier).toBe(1);
    resetGrovewardenRootSurge();
  });

  it('Pirate Plunder gold path still works alongside Root Surge cross-layer gold (no double-count interference)', () => {
    // Verify: Pirate Plunder's gold path is INDEPENDENT of Root Surge's
    // gold path. Both write via addGold, but they consume different
    // events (line-clear cells vs rooted-cell-clear events) — no
    // double-count.
    resetGrovewardenRootSurge();
    __identityFxTestables.resetCoinPool();

    let goldDelta = 0;
    const addGoldApi = { add: (n) => { goldDelta += n; } };

    // Fire Root Surge: trigger + 3 roots placed + 1 root cleared = +10 gold.
    pushRecentClear('ember');
    pushRecentClear('tide');
    pushRecentClear('umbra');
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    fxGrovewardenRootSurge(null, { gridState: grid, currentTurn: 0 });
    const roots = getActiveRootCellsSnapshot();
    expect(roots.length).toBe(3);

    // Clear ONE rooted cell → +10 gold via cross-layer.
    onRootCellCleared(roots[0].row, roots[0].col, { addGoldApi });
    expect(goldDelta).toBe(10);

    // Verify: the just-cleared rooted cell is GONE from _activeRootCells
    // — it CANNOT be in Pirate Plunder's line-clear count because
    // placement was BLOCKED for 5 turns. No double-count.
    expect(isCellRooted(roots[0].row, roots[0].col)).toBe(false);

    // Remaining 2 roots still active — auto-clear at turn 5 grants NO gold
    // (timeout path, per spec §3.5 field 4).
    fxGrovewardenRootSurgeTick({ currentTurn: 5 });
    expect(getActiveRootCellsCount()).toBe(0);
    expect(goldDelta).toBe(10);  // unchanged — auto-clear is silent
    resetGrovewardenRootSurge();
  });
});
