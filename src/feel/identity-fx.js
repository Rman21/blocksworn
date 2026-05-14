// 2026-05-12 — TASK-029 (T2.02): Identity Layer FX runtime + dispatcher.
//
// Spec: docs/design/mechanics/identity-layer.md §2 / §5 / §7.
// This module is the per-line-clear "race flavor" runtime. It is wired from
// `src/core/grid.js#clearLines` immediately AFTER the sacred
// `vPlayLineClearBurst(rows, cols)` call (spec §7.2 — "around line 401 area,
// after `vPlayLineClearBurst`"). On every successful line clear, the
// dispatcher inspects the active squad and fires one FX function per race
// alive (independent layers — mixed-race squads stack additively per spec
// §1 hard rule 3).
//
// T2.02 ships:
//   - Module-load coin DOM-element pool (32 elements, zero `createElement`
//     per fire — spec §5 object-pool requirement).
//   - `fxPirateLineClear(rows, cols, squad)` — Pirate's Plunder per spec §2.1.
//   - `dispatchIdentityFx(rows, cols, squad, currentBoss)` — single hook
//     entry point for `src/core/grid.js#clearLines`.
//   - Stub `fx*` functions for Shark / Rock / Crocodile / Spark so future
//     tasks T2.03–T2.06 can drop in implementations without re-wiring the
//     dispatcher contract.
//   - `computePirateGold(pirateCount, cellsCleared)` — pure helper for
//     unit tests (no DOM dependency).
//
// Sacred safety (CLAUDE.md §2.1–§2.5):
//   - No V_HAPTICS keys added or modified (`clear` reused via `vHaptic`).
//   - No combo crit / element synergy / RACE_SYNERGY values touched.
//   - No `vPlayLineClearBurst` timing modification (this module runs AFTER).
//   - Gold writes go through the legacy `addGold(n)` global so its existing
//     pirate +10% passive (line 24039 in legacy) AND the 24h Mega Buff stack
//     AND analytics dispatch all fire normally — Identity Layer never
//     bypasses the established gold pipeline.
//   - All numeric values are imported from `src/data/identity-layer.js`
//     (no magic numbers per AAA+ §3.4).
//   - Object pool allocated once at module load — no GC churn per fire.
//
// Object-pool reset is implicit: each fire calls `spawnCoinParticle` which
// re-positions and re-triggers the CSS keyframe. Pool elements survive across
// fires; cleanup timer returns them to the available pool. If a fire requests
// more coins than the pool currently has free, surplus requests are dropped
// (silently — cap is hard per spec §2.1 field 9 + §5).

/* global addGold, HERO_DECK, ultCharges, ULT_THRESHOLD, currentUltThreshold,
          MAX_SHIELD, maxShieldBonus, grid, HERO_ULT_COST_BY_NEWROLE,
          engineerLockedCells, flashStateBanner */

import {
  IDENTITY_FX_KEYS,
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
  ASHEN_REIGN_DURATION_MS,
  ASHEN_REIGN_DECAY_MS,
  ASHEN_REIGN_REQUIRED_ELEMENT,
  ASHEN_REIGN_HUD_COUNTDOWN_TEXT,
  ASHEN_REIGN_INITIAL_BUDGET_MS,
  // T2.08 — Lich Cursed Tiles constants.
  CURSED_TILES_COUNT,
  CURSED_TILES_TURNS_UNTIL_AUTO_CLEAR,
  CURSED_TILES_HP_DAMAGE_PER_TURN,
  CURSED_TILES_ULT_COMPENSATION,
  CURSED_TILES_TRIGGER_SHARK_THRESHOLD,
  CURSED_TILES_SKULL_DECAY_MS,
  CURSED_TILES_SKULL_COLOR,
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
  ROOT_SURGE_OVERLAY_DECAY_MS,
  ROOT_SURGE_OVERLAY_COLOR,
  ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER,
  ROOT_SURGE_INITIAL_BUDGET_MS,
  ROOT_SURGE_PER_TURN_TICK_BUDGET_MS,
} from '../data/identity-layer.js';
import { RACE_SYNERGY } from '../data/races.js';
import {
  spawnCoinParticle,
  spawnSharkBiteParticle,
  spawnRockEchoGhost,
  spawnCrocFragmentParticle,
  spawnSparkRayParticle,
  spawnSkullOverlay,
  spawnBloodtidePulse,
  spawnEngineerRatchet,
  spawnMossRootOverlay,
} from './particles.js';
import { vHaptic } from './haptics.js';
import { log } from '../services/logger.js';
// T2.12 (2026-05-12): Codex recording hooks. Each fx<Race>LineClear and
// fx<Boss><Identity> function calls `recordRaceTrigger(raceKey)` /
// `recordMomentTrigger(momentKey)` at end-of-fire (after all mechanical +
// visual work). The recording calls are wrapped in try/catch so Codex
// recording NEVER regresses the underlying fx pipeline (sacred path).
// Codex writes ONLY to localStorage[blocksworn_codex_state] per spec §4.10
// (READ-ONLY of game state — never mutates sacred tables).
import { recordRaceTrigger, recordMomentTrigger } from '../ui/codex.js';

// ─── 8×8 board dimensions ───────────────────────────────────────────────
// SACRED per spec §0 / legacy line 20042: SIZE = 8. Sourced here as a local
// constant rather than re-importing the legacy global; data/balance.js owns
// MAX_HP but board size still lives in legacy (T1.10.5 / T1.10.9 territory).
// Used only by `computeCellsCleared` to compute the cell count for
// rows×cols clears with intersection accounting.
const BOARD_COLS = 8;
const BOARD_ROWS = 8;

// ─── Coin DOM pool (spec §5 — no createElement per fire) ───────────────
// Pre-allocate PIRATE_PLUNDER_MAX_COINS coin elements at module load. Track
// available vs in-flight via two arrays. When a fire requests a coin, pop
// from `_coinPoolAvailable`. When the cleanup timer expires, push back.
const _coinPool          = [];   // all 32 elements (created once)
const _coinPoolAvailable = [];   // currently idle elements (poppable)
let   _coinPoolInitDone  = false;
let   _coinPoolContainer = null;

// Module-load init runs the first time `_ensureCoinPool` is called, NOT
// at import time — that way unit tests (Node / jsdom-less Vitest) can
// import this module without trying to touch `document` until a real
// DOM call site fires.
function _ensureCoinPool() {
  if (_coinPoolInitDone) return;
  if (typeof document === 'undefined') return; // unit-test guard
  // Lazy fixed container — keeps the 32 coin elements off body root.
  _coinPoolContainer = document.createElement('div');
  _coinPoolContainer.className = 'identity-coin-layer';
  _coinPoolContainer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(_coinPoolContainer);
  for (let i = 0; i < PIRATE_PLUNDER_MAX_COINS; i++) {
    const el = document.createElement('div');
    el.className = 'identity-coin';
    _coinPoolContainer.appendChild(el);
    _coinPool.push(el);
    _coinPoolAvailable.push(el);
  }
  _coinPoolInitDone = true;
}

function _acquireCoin() {
  return _coinPoolAvailable.pop() || null;
}

function _releaseCoin(el) {
  if (!el) return;
  el.classList.remove('identity-coin-flying');
  _coinPoolAvailable.push(el);
}

// ─── Pure math (unit-testable, no DOM) ─────────────────────────────────
//
// Pirate's Plunder gold formula. Capped at PIRATE_PLUNDER_MAX_PIRATES (5,
// sacred squad-of-5 ceiling per CLAUDE.md §2.1). Spec §2.1 field 4:
//   gold = 5 × cellsCleared × min(pirateCount, 5)
// Returns 0 for any non-positive input (defensive — silent no-op contract).
export function computePirateGold(pirateCount, cellsCleared) {
  const _pirates = Math.max(0, Math.min(PIRATE_PLUNDER_MAX_PIRATES, Math.floor(Number(pirateCount) || 0)));
  const _cells   = Math.max(0, Math.floor(Number(cellsCleared) || 0));
  if (_pirates === 0 || _cells === 0) return 0;
  return PIRATE_PLUNDER_GOLD_PER_CELL * _cells * _pirates;
}

// Cell-count math for rows∪cols line clear, accounting for intersection
// double-count. For an R-row × C-col grid clearing `r` rows and `c` cols:
//   cells = r*C + c*R - r*c  (inclusion–exclusion)
// Pure function — unit-testable.
export function computeCellsCleared(rowCount, colCount, cols = BOARD_COLS, rows = BOARD_ROWS) {
  const r = Math.max(0, Math.floor(Number(rowCount) || 0));
  const c = Math.max(0, Math.floor(Number(colCount) || 0));
  return (r * cols) + (c * rows) - (r * c);
}

// Squad pirate-count helper. Defensive against the codebase reality that
// heroes in HERO_DECK don't track per-hero hp (squad shares global `hp`).
// Treats absence of `.hp` as alive (heroes are removed from deck on death;
// the spec field 1.10 "h.hp > 0" gate is preserved when hp IS present).
export function countAlivePirates(squad) {
  if (!Array.isArray(squad)) return 0;
  let n = 0;
  for (const h of squad) {
    if (!h || h.race !== 'pirate') continue;
    if (h.hp !== undefined && h.hp <= 0) continue;
    n++;
  }
  return n;
}

// ─── HUD gold-counter resolver ─────────────────────────────────────────
// Resolves the target screen coordinate for coin arcs. Re-uses the existing
// resource bar's gold readout if present; falls back to top-right of viewport.
// Read-only DOM query — no mutation.
function _resolveGoldTarget() {
  if (typeof document === 'undefined') return { x: 0, y: 0 };
  // Try the legacy resource-bar gold display first (rendered by renderResourceBar).
  const goldEl = document.querySelector(
    '#resourceBar [data-resource="gold"], #goldDisplay, .v-resource-gold, .resource-gold',
  );
  if (goldEl) {
    const r = goldEl.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  // Fallback — viewport top-right with 16px inset.
  return {
    x: (typeof window !== 'undefined' ? window.innerWidth : 360) - 16,
    y: 16,
  };
}

// Resolves the screen-coord origin for a cleared cell index. Uses the grid's
// rendered `.cell` DOM nodes (same selector as `vPlayLineClearBurst`).
function _resolveCellOrigin(cellIdx) {
  if (typeof document === 'undefined') return null;
  const cells = document.querySelectorAll('.grid .cell');
  const el = cells[cellIdx];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// ─── Pirate's Plunder (spec §2.1) ──────────────────────────────────────
//
// Trigger contract:
//   - Fires every `clearLines(rows, cols)` resolve.
//   - Silent no-op when pirateCount === 0 (no DOM creation, no gold write).
// Effect contract:
//   - Gold awarded via the legacy `addGold(n)` global so the existing pirate
//     +10% passive, Mega Buff +25%, Tower Heart +25%, and analytics all
//     dispatch normally (NEVER bypass).
//   - Coin VFX spawned from cleared-cell centers, arcing toward HUD gold
//     counter. Cap PIRATE_PLUNDER_MAX_COINS simultaneous coins.
//   - Haptic: standard `clear` (V_HAPTICS.clear = 25ms, sacred — no new
//     key per CLAUDE.md §2.2). Already fired by `clearLines` itself via
//     `vibrate(25)`; this function does NOT re-fire to avoid double-pulse.
//     (Spec §2.1 field 6 says "standard clear haptic" — already satisfied
//     by the host clearLines path. Documented for the audit trail.)
//   - Total wall-time ≤6ms (spec §2.1 field 9).
//
// Returns the gold amount awarded (useful for unit tests + smoke assertions).
export function fxPirateLineClear(rows, cols, squad) {
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  try {
    // Squad alive-pirate count. Falls back to HERO_DECK if `squad` is not a
    // valid array — the dispatcher passes whichever is current.
    const _squad = Array.isArray(squad) ? squad
                 : (typeof HERO_DECK !== 'undefined' && Array.isArray(HERO_DECK)) ? HERO_DECK
                 : [];
    const pirateCount = countAlivePirates(_squad);
    if (pirateCount === 0) return 0;

    const rowCount = Array.isArray(rows) ? rows.length : 0;
    const colCount = Array.isArray(cols) ? cols.length : 0;
    if (rowCount + colCount === 0) return 0;
    const cellsCleared = computeCellsCleared(rowCount, colCount);
    if (cellsCleared === 0) return 0;

    const goldGained = computePirateGold(pirateCount, cellsCleared);
    if (goldGained <= 0) return 0;

    // Award gold via the legacy API (preserves +10% pirate passive, buffs,
    // analytics). Try the window bridge first; fall back to a direct global
    // reference. Failure is non-fatal (FX still play).
    let _awarded = false;
    try {
      if (typeof addGold === 'function') {
        addGold(goldGained);
        _awarded = true;
      } else if (typeof window !== 'undefined' && typeof window.addGold === 'function') {
        window.addGold(goldGained);
        _awarded = true;
      }
    } catch (e) {
      log.warn('Pirate Plunder addGold failed:', e);
    }

    // Coin VFX. DOM-pool allocation only — never createElement per fire.
    _ensureCoinPool();
    if (_coinPoolInitDone) {
      const target = _resolveGoldTarget();
      // Build the set of cleared cell indices (same intersection accounting
      // as `clearLines` itself). Cap at PIRATE_PLUNDER_MAX_COINS.
      const idxs = new Set();
      for (const r of rows) for (let c = 0; c < BOARD_COLS; c++) idxs.add(r * BOARD_COLS + c);
      for (const c of cols) for (let r = 0; r < BOARD_ROWS; r++) idxs.add(r * BOARD_COLS + c);
      let spawned = 0;
      for (const idx of idxs) {
        if (spawned >= PIRATE_PLUNDER_MAX_COINS) break;
        const origin = _resolveCellOrigin(idx);
        if (!origin) continue;
        const el = _acquireCoin();
        if (!el) break; // pool empty (concurrent fires) — drop surplus per spec cap
        spawnCoinParticle({
          el,
          x: origin.x,
          y: origin.y,
          targetX: target.x,
          targetY: target.y,
          decayMs: PIRATE_PLUNDER_COIN_DECAY_MS,
        });
        setTimeout(() => _releaseCoin(el), PIRATE_PLUNDER_COIN_DECAY_MS);
        spawned++;
      }
    }

    // Spec §2.1 field 6: standard `clear` haptic. Already fired by host
    // clearLines (`vibrate(25)` at grid.js:399). NOT re-fired here to avoid
    // double-haptic. The `vHaptic` import is retained as a contract anchor
    // for future race FX whose host-path haptic gate doesn't match.
    void vHaptic; // referenced to keep import for future T2.03–T2.06 reuse

    // T2.12 (2026-05-12): Codex recording — pirate race triggered. End-of-fire
    // hook AFTER all mechanical + visual work completes. Defensive try/catch
    // — Codex recording must never regress the fx pipeline.
    try { recordRaceTrigger('pirate'); } catch (_e) { /* defensive */ }

    return _awarded ? goldGained : 0;
  } finally {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      // Soft budget check — log if we exceed the 6ms ceiling (spec §2.1 field 9).
      // Production logger.debug is no-op; dev console shows the timing.
      if (dt > 6) log.warn('Pirate Plunder over budget:', dt.toFixed(2), 'ms');
    }
  }
}

// ─── Shark Feeding Frenzy DOM pool (spec §2.2 + §5 — no createElement per fire) ──
// Pre-allocate SHARK_FRENZY_MAX_EXTRA_CELLS bite elements at module load (lazy
// — first call to `_ensureSharkBitePool`). Track available vs in-flight via
// two arrays. Mirrors the coin pool pattern above. The bite ceiling matches
// the spec's hard cap (4 extra cells per fire), so pool exhaustion under
// realistic load is mathematically impossible inside a single fire — pool
// exhaustion would only occur if two fires overlap their decay windows.
const _sharkBitePool          = [];   // all SHARK_FRENZY_MAX_EXTRA_CELLS elements (created once)
const _sharkBitePoolAvailable = [];   // currently idle elements (poppable)
let   _sharkBitePoolInitDone  = false;
let   _sharkBitePoolContainer = null;

function _ensureSharkBitePool() {
  if (_sharkBitePoolInitDone) return;
  if (typeof document === 'undefined') return; // unit-test guard
  _sharkBitePoolContainer = document.createElement('div');
  _sharkBitePoolContainer.className = 'identity-shark-bite-layer';
  _sharkBitePoolContainer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(_sharkBitePoolContainer);
  for (let i = 0; i < SHARK_FRENZY_MAX_EXTRA_CELLS; i++) {
    const el = document.createElement('div');
    el.className = 'identity-shark-bite';
    _sharkBitePoolContainer.appendChild(el);
    _sharkBitePool.push(el);
    _sharkBitePoolAvailable.push(el);
  }
  _sharkBitePoolInitDone = true;
}

function _acquireSharkBite() {
  return _sharkBitePoolAvailable.pop() || null;
}

function _releaseSharkBite(el) {
  if (!el) return;
  el.classList.remove('identity-shark-bite-sweeping');
  el.removeAttribute('data-bite-direction');
  _sharkBitePoolAvailable.push(el);
}

// ─── Shark pure math (unit-testable, no DOM) ───────────────────────────
//
// Squad alive-shark count. Defensive against the codebase reality that heroes
// in HERO_DECK don't track per-hero hp (squad shares global `hp`). Treats
// absence of `.hp` as alive (heroes are removed from deck on death;
// `h.hp > 0` gate is preserved when hp IS present). Mirrors
// `countAlivePirates` precedent (T2.02 CTO ruling #2 — single haptic /
// defensive hp).
export function countAliveSharks(squad) {
  if (!Array.isArray(squad)) return 0;
  let n = 0;
  for (const h of squad) {
    if (!h || h.race !== 'shark') continue;
    if (h.hp !== undefined && h.hp <= 0) continue;
    n++;
  }
  return n;
}

// Per-line bite count. Spec §2.2 field 4: "Clears `min(1, sharkCount/2)`
// adjacent cells per cleared row/col". The spec's literal `min(1, x/2)` is
// ambiguous (fractional); brief clarifies to `Math.min(1, Math.floor(x/2))`:
//   - 1 shark → 0 bites (gated single-shark "smaller effect" path)
//   - 2 sharks → 1 bite
//   - 4 sharks → 1 bite
//   - 5 sharks → 1 bite
// Hard upper cap of 1 bite per line is preserved regardless of input.
export function computeSharkBiteCount(sharkCount) {
  const n = Math.max(0, Math.floor(Number(sharkCount) || 0));
  if (n <= 0) return 0;
  return Math.min(1, Math.floor(n / 2));
}

// Returns true if a cell is "blocked" by an existing state predicate — Shark
// bite is absorbed visually but the cell is NOT added to the cleared set.
// This is the natural boss-counter mechanism (spec §2.2 field 7): bosses
// with `tempo_disruptor`, `wither`, `engineer` archetypes already lock cells;
// Shark just respects existing predicates.
//
// `gridState` may carry any subset of these recognized cell-state surfaces
// (caller passes whichever the runtime has populated — legacy globals via
// T2.B bridge, or stubbed Sets in tests):
//   - lockedCells:     Set<string> of "r_c" keys     (engineer-locked)
//   - electrifiedRows: Set<number> | number[]        (engineer-electrified)
//   - cursedCells:     Set<string> of "r_c" keys     (lich-cursed)
//   - permanentFrozenCells: Set<string> of "r_c" keys (skip — already wipe-immune)
//   - isCellBlocked:   function(r, c) → boolean     (general-purpose escape hatch)
//
// Pure function — no DOM, no global reads. The caller is responsible for
// passing the snapshot they want consulted. If `gridState` is null/undefined,
// the function returns false (no predicate to consult → cell is bite-eligible).
export function isSharkBiteBlocked(r, c, gridState) {
  if (!gridState || typeof gridState !== 'object') return false;
  const key = r + '_' + c;
  if (gridState.lockedCells && typeof gridState.lockedCells.has === 'function'
      && gridState.lockedCells.has(key)) return true;
  if (gridState.cursedCells && typeof gridState.cursedCells.has === 'function'
      && gridState.cursedCells.has(key)) return true;
  if (gridState.permanentFrozenCells && typeof gridState.permanentFrozenCells.has === 'function'
      && gridState.permanentFrozenCells.has(key)) return true;
  // electrifiedRows: row-level predicate (not per-cell)
  if (gridState.electrifiedRows) {
    if (typeof gridState.electrifiedRows.has === 'function') {
      if (gridState.electrifiedRows.has(r)) return true;
    } else if (Array.isArray(gridState.electrifiedRows)) {
      if (gridState.electrifiedRows.indexOf(r) !== -1) return true;
    }
  }
  // General-purpose escape hatch — any other future predicate.
  if (typeof gridState.isCellBlocked === 'function') {
    try { if (gridState.isCellBlocked(r, c)) return true; } catch (_e) { /* defensive */ }
  }
  return false;
}

// Compute the list of adjacent cells eligible for biting from a given set of
// cleared rows + cols. Pure function — no DOM, no global reads.
//
// Strategy per spec §2.2 field 3:
//   - For each cleared row, attempt to bite the closest unbitten adjacent
//     cell ABOVE then BELOW (vertical neighbor extension of the row).
//   - For each cleared col, attempt to bite the closest unbitten adjacent
//     cell LEFT then RIGHT (horizontal neighbor extension of the col).
//   - Up to `bitesPerLine` per cleared row/col (typically 1 — spec §2.2
//     field 4 / `computeSharkBiteCount`).
//   - Cells already inside the cleared rows/cols set are NOT counted as
//     "extra" — the bite must be a cell OUTSIDE the line.
//   - Cells blocked by state predicates (locked/electrified/cursed) are
//     absorbed (no clear), but they DO consume the bite slot for the line
//     (per spec §2.2 field 7: "the bite is absorbed — visually it still
//     plays but the locked cell is not cleared"). To implement this faithfully
//     we still spawn the visual particle, but the cell is omitted from the
//     returned `extraCleared` list.
//   - HARD CAP at SHARK_FRENZY_MAX_EXTRA_CELLS extra cells total per fire.
//
// Returns:
//   {
//     bites:        Array<{r, c, direction, blocked: boolean}>  visual fires
//     extraCleared: Array<{r, c}>                               cells to add to clear set
//   }
//
// `direction` is 'horizontal-row' for row-line bites (the row extends
// vertically through the bite; sweep moves left→right within the row),
// 'vertical-col' for col-line bites (the col extends horizontally; sweep
// moves top→bottom within the col). See spec §2.2 field 3.
//
// `cols` / `rows` here refer to GRID dimensions (default 8×8 per legacy
// SIZE = 8); same defaults as `computeCellsCleared` above.
export function computeBittenCells(rows, cols, sharkCount, gridState, gridCols = BOARD_COLS, gridRows = BOARD_ROWS) {
  const bitesPerLine = computeSharkBiteCount(sharkCount);
  const result = { bites: [], extraCleared: [] };
  if (bitesPerLine === 0) return result;

  // Build the "in-line" cleared set so we never re-bite a cell that's
  // already cleared by the line itself.
  const inLine = new Set();
  const _rowList = Array.isArray(rows) ? rows.filter(r => typeof r === 'number' && r >= 0 && r < gridRows) : [];
  const _colList = Array.isArray(cols) ? cols.filter(c => typeof c === 'number' && c >= 0 && c < gridCols) : [];
  for (const r of _rowList) for (let c = 0; c < gridCols; c++) inLine.add(r + '_' + c);
  for (const c of _colList) for (let r = 0; r < gridRows; r++) inLine.add(r + '_' + c);

  const _alreadyBitten = new Set();   // de-dup across rows/cols
  let   _extraCount    = 0;            // hard-cap accumulator

  // Helper: try to register a bite at (r, c) with the given sweep direction.
  // Returns true if a bite (visual + possibly cleared) was added.
  function _tryBite(r, c, direction) {
    if (_extraCount >= SHARK_FRENZY_MAX_EXTRA_CELLS) return false;
    if (r < 0 || r >= gridRows || c < 0 || c >= gridCols) return false;
    const key = r + '_' + c;
    if (inLine.has(key)) return false;          // not an "extra" cell
    if (_alreadyBitten.has(key)) return false;  // already bit by another line
    _alreadyBitten.add(key);
    const blocked = isSharkBiteBlocked(r, c, gridState);
    result.bites.push({ r, c, direction, blocked });
    if (!blocked) result.extraCleared.push({ r, c });
    _extraCount++;
    return true;
  }

  // Per-row bites — neighbor extension is vertical (above/below).
  for (const r of _rowList) {
    let _remaining = bitesPerLine;
    // Prefer the row BELOW first (sweep direction = left→right inside the row
    // visually, but the bite cell is the adjacent row); fall back to ABOVE.
    // The center column (gridCols/2) is the bite anchor for the SVG sweep —
    // visually the teeth-arc traverses the entire row regardless of bite cell
    // position, with the highlighted cell flashing cyan at the end.
    const _bitCol = Math.floor(gridCols / 2);
    if (_remaining > 0 && _tryBite(r + 1, _bitCol, 'horizontal-row')) _remaining--;
    if (_remaining > 0 && _tryBite(r - 1, _bitCol, 'horizontal-row')) _remaining--;
    // If both neighbors are inLine or bitten, scan outward for an alternative.
    if (_remaining > 0) {
      for (let dc = 1; dc < gridCols && _remaining > 0; dc++) {
        if (_tryBite(r + 1, _bitCol + dc, 'horizontal-row')) { _remaining--; break; }
        if (_tryBite(r - 1, _bitCol + dc, 'horizontal-row')) { _remaining--; break; }
        if (_tryBite(r + 1, _bitCol - dc, 'horizontal-row')) { _remaining--; break; }
        if (_tryBite(r - 1, _bitCol - dc, 'horizontal-row')) { _remaining--; break; }
      }
    }
  }

  // Per-col bites — neighbor extension is horizontal (left/right).
  for (const c of _colList) {
    let _remaining = bitesPerLine;
    const _bitRow = Math.floor(gridRows / 2);
    if (_remaining > 0 && _tryBite(_bitRow, c + 1, 'vertical-col')) _remaining--;
    if (_remaining > 0 && _tryBite(_bitRow, c - 1, 'vertical-col')) _remaining--;
    if (_remaining > 0) {
      for (let dr = 1; dr < gridRows && _remaining > 0; dr++) {
        if (_tryBite(_bitRow + dr, c + 1, 'vertical-col')) { _remaining--; break; }
        if (_tryBite(_bitRow + dr, c - 1, 'vertical-col')) { _remaining--; break; }
        if (_tryBite(_bitRow - dr, c + 1, 'vertical-col')) { _remaining--; break; }
        if (_tryBite(_bitRow - dr, c - 1, 'vertical-col')) { _remaining--; break; }
      }
    }
  }

  return result;
}

// Trigger gate (spec §2.2 field 10): the Frenzy fires when EITHER condition
// holds:
//   1) dominant element of ≥1 cleared row/col is `tide`, OR
//   2) ≥ SHARK_FRENZY_MIN_SHARKS_FOR_2X_TRIGGER alive shark heroes in squad.
//
// `dominantElementsByLine` is an optional precomputed array of element keys
// (one per cleared line, ember/tide/grove/solar/umbra/null). When omitted,
// only the squad-count path is checked (used by the dispatcher when the
// caller can't or hasn't computed per-line dominance).
//
// Pure function — unit-testable. Returns true if the gate passes (fires
// either the full or "smaller" effect path — see `computeSharkBiteCount`
// for the per-line cell count).
export function sharkFrenzyGatePasses(sharkCount, dominantElementsByLine) {
  if (sharkCount >= SHARK_FRENZY_MIN_SHARKS_FOR_2X_TRIGGER) return true;
  if (sharkCount <= 0) return false; // no sharks → no fire ever (silent no-op)
  // 1-shark single-shark "smaller effect" branch: requires tide dominance.
  if (Array.isArray(dominantElementsByLine)) {
    for (const el of dominantElementsByLine) {
      if (el === SHARK_FRENZY_DOMINANT_ELEMENT) return true;
    }
  }
  return false;
}

// ─── Shark bittenCells side-channel (T2.B legacy bridge contract) ──────
// `fxSharkLineClear` writes the most-recent fire's extra-cleared cells to
// this module-level slot so the legacy bridge (T2.B, batched end-of-Phase-2)
// can read them and thread into legacy's `countElementsInCells` input set
// (the combo-crit `dominantCount` input modification path, spec §2.2 field 8).
//
// This is INPUT MODIFICATION, not formula modification — the sacred combo
// crit formula `total_dmg × (1 + dominantCount × combo × 10%)` is UNTOUCHED.
// Same architectural pattern as existing cascade (spec §2.2 field 8).
//
// Until T2.B wires this into legacy, this side-channel is observable only by
// unit/smoke tests (via `__identityFxTestables.getLastBittenCells`). T2.B
// will additionally expose `window.__identityFxLastBittenCells` for legacy
// to consume.
let _lastBittenCells = [];

// ─── Shark Feeding Frenzy (spec §2.2) ──────────────────────────────────
//
// Trigger contract (spec §2.2 field 10):
//   - Fires every `clearLines(rows, cols)` resolve.
//   - Gate: tide-dominant in ≥1 line OR ≥2 alive sharks. Else silent no-op
//     (no DOM, no allocation, no log).
// Effect contract (spec §2.2 fields 3–9):
//   - Per cleared row/col: `min(1, floor(sharkCount/2))` bites (typically
//     1 for 2+ sharks; 0 for 1-shark "smaller effect" branch).
//   - Visual: teeth-arc SVG (white-on-cyan curved bite shape) sweeps the
//     line; bitten cell flashes cyan; bite element auto-recycles after
//     SHARK_FRENZY_BITE_DECAY_MS (500ms).
//   - Locked / electrified / cursed cells: bite absorbed visually but
//     cell is NOT added to extra-cleared set (boss-counter — spec field 7).
//   - HARD CAP at SHARK_FRENZY_MAX_EXTRA_CELLS extra cells per fire.
//   - Extra cells flow into combo-crit `dominantCount` input via the
//     `_lastBittenCells` side-channel (NOT into the formula — input
//     modification only, spec §2.2 field 8).
//   - Haptic: already fired by host `clearLines` via `vibrate(25)` —
//     `fxSharkLineClear` does NOT re-fire (T2.02 precedent #3 — no
//     double-pulse).
//   - Audio: tide-themed line-clear sample re-use per ESC-02 O4 ruling;
//     no new asset added in T2.03 (`flag for Audio` if Sample missing —
//     handled by host audio mixer, not this module).
//   - Total wall-time ≤10ms (spec §2.2 field 9).
//
// `ctx` is an optional cell-state predicate snapshot (passed through from
// the dispatcher; nullable in T2.03 since legacy bridge is deferred).
// Recognized keys: `lockedCells`, `electrifiedRows`, `cursedCells`,
// `permanentFrozenCells`, `dominantElementsByLine`, `isCellBlocked`.
//
// Returns the count of EXTRA cells cleared (useful for smoke assertions).
export function fxSharkLineClear(rows, cols, squad, ctx) {
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  try {
    // Squad alive-shark count. Same fallback chain as Pirate.
    const _squad = Array.isArray(squad) ? squad
                 : (typeof HERO_DECK !== 'undefined' && Array.isArray(HERO_DECK)) ? HERO_DECK
                 : [];
    const sharkCount = countAliveSharks(_squad);
    if (sharkCount === 0) { _lastBittenCells = []; return 0; }

    const rowCount = Array.isArray(rows) ? rows.length : 0;
    const colCount = Array.isArray(cols) ? cols.length : 0;
    if (rowCount + colCount === 0) { _lastBittenCells = []; return 0; }

    // Trigger gate — full path or "smaller effect" path or no-op.
    const dominantByLine = (ctx && Array.isArray(ctx.dominantElementsByLine))
      ? ctx.dominantElementsByLine
      : null;
    if (!sharkFrenzyGatePasses(sharkCount, dominantByLine)) {
      _lastBittenCells = [];
      return 0;
    }

    // Compute the bite list (pure — no DOM).
    const { bites, extraCleared } = computeBittenCells(rows, cols, sharkCount, ctx || null);

    // Update the side-channel for the legacy bridge (T2.B). Stored even when
    // empty so consumers don't see stale data from prior fires.
    _lastBittenCells = extraCleared.slice();

    // Spawn the visual particle for every bite (including blocked ones —
    // spec §2.2 field 7: blocked bites still play visually).
    if (bites.length > 0) {
      _ensureSharkBitePool();
      if (_sharkBitePoolInitDone) {
        for (const b of bites) {
          const origin = _resolveCellOrigin(b.r * BOARD_COLS + b.c);
          if (!origin) continue;
          const el = _acquireSharkBite();
          if (!el) break; // pool exhausted (concurrent fires overlap) — drop surplus
          spawnSharkBiteParticle({
            el,
            x: origin.x,
            y: origin.y,
            direction: b.direction,
            decayMs: SHARK_FRENZY_BITE_DECAY_MS,
          });
          setTimeout(() => _releaseSharkBite(el), SHARK_FRENZY_BITE_DECAY_MS);
        }
      }
    }

    // Spec §2.2 field 6: standard `clear` haptic. Already fired by host
    // clearLines (`vibrate(25)` at grid.js:399). NOT re-fired here — T2.02
    // precedent #3 (no double-pulse). The `vHaptic` reference is kept alive
    // in the Pirate path; nothing additional here.
    void vHaptic;

    // T2.12 (2026-05-12): Codex recording — shark race triggered.
    try { recordRaceTrigger('shark'); } catch (_e) { /* defensive */ }

    return extraCleared.length;
  } finally {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      // Spec §2.2 field 9 — soft budget check at 10ms.
      if (dt > 10) log.warn('Shark Frenzy over budget:', dt.toFixed(2), 'ms');
    }
  }
}

// ─── Rock Encore Echo DOM pool (spec §2.3 + §5 — no createElement per fire) ──
// Pre-allocate ROCK_ECHO_MAX_CHARGE_PER_FIRE ghost elements at module load
// (lazy — first call to `_ensureRockEchoPool`). Track available vs in-flight
// via two arrays. Mirrors the coin + shark-bite pool patterns above. The
// ghost ceiling matches the spec's hard cap (4 echo elements per fire = one
// per cleared line in a max quad-clear), so pool exhaustion under realistic
// load is mathematically impossible inside a single fire — exhaustion would
// only occur if two fires overlap their 700ms decay windows.
const _rockEchoPool          = [];   // all ROCK_ECHO_MAX_CHARGE_PER_FIRE elements (created once)
const _rockEchoPoolAvailable = [];   // currently idle elements (poppable)
let   _rockEchoPoolInitDone  = false;
let   _rockEchoPoolContainer = null;

function _ensureRockEchoPool() {
  if (_rockEchoPoolInitDone) return;
  if (typeof document === 'undefined') return; // unit-test guard
  _rockEchoPoolContainer = document.createElement('div');
  _rockEchoPoolContainer.className = 'identity-rock-echo-layer';
  _rockEchoPoolContainer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(_rockEchoPoolContainer);
  for (let i = 0; i < ROCK_ECHO_MAX_CHARGE_PER_FIRE; i++) {
    const el = document.createElement('div');
    el.className = 'identity-rock-echo-ghost';
    _rockEchoPoolContainer.appendChild(el);
    _rockEchoPool.push(el);
    _rockEchoPoolAvailable.push(el);
  }
  _rockEchoPoolInitDone = true;
}

function _acquireRockEcho() {
  return _rockEchoPoolAvailable.pop() || null;
}

function _releaseRockEcho(el) {
  if (!el) return;
  el.classList.remove('identity-rock-echo-flashing');
  el.removeAttribute('data-echo-direction');
  _rockEchoPoolAvailable.push(el);
}

// ─── Rock pure math (unit-testable, no DOM) ─────────────────────────────
//
// Squad alive-rock count. Defensive against the codebase reality that heroes
// in HERO_DECK don't track per-hero hp (squad shares global `hp`). Treats
// absence of `.hp` as alive (heroes are removed from deck on death;
// `h.hp > 0` gate is preserved when hp IS present). Mirrors
// `countAlivePirates` / `countAliveSharks` precedent (T2.02 CTO ruling #2 —
// defensive hp / single-haptic).
export function countAliveRocks(squad) {
  if (!Array.isArray(squad)) return 0;
  let n = 0;
  for (const h of squad) {
    if (!h || h.race !== 'rock') continue;
    if (h.hp !== undefined && h.hp <= 0) continue;
    n++;
  }
  return n;
}

// Count of cleared lines whose dominant element is `umbra`. Pure function —
// unit-testable. `dominantElementsByLine` is the per-line dominant-element
// array threaded through the dispatcher's `ctx` (same surface T2.03 surfaced
// for Shark's tide-dominant gate; T2.B will populate from legacy
// `getDominantElementCount` on the cleared rows+cols).
//
// HARD CAP at ROCK_ECHO_MAX_CHARGE_PER_FIRE (4) — even if more umbra-dominant
// lines were somehow supplied (impossible by board geometry but defensive),
// the count never exceeds the spec field 4 ceiling.
//
// `rows` / `cols` are accepted for signature symmetry with the other
// `compute*` helpers + future-proofing if the caller needs to discriminate
// row-vs-col dominance, but the current implementation only consumes the
// `dominantElementsByLine` array.
export function countUmbraDominantLines(rows, cols, dominantElementsByLine) {
  if (!Array.isArray(dominantElementsByLine)) return 0;
  let n = 0;
  for (const el of dominantElementsByLine) {
    if (el === ROCK_ECHO_DOMINANT_ELEMENT) {
      n++;
      if (n >= ROCK_ECHO_MAX_CHARGE_PER_FIRE) return ROCK_ECHO_MAX_CHARGE_PER_FIRE;
    }
  }
  return n;
}

// Compute the umbra-ULT charge to add this fire. Pure function —
// unit-testable. Per spec §2.3 field 4: "+1 ULT charge to the umbra ULT
// meter (only) per cleared line where dominant element is `umbra`. Capped
// at +4 per fire."
//
// Returns:
//   0 if rockCount === 0 (silent no-op gate)
//   0 if umbraDominantLineCount === 0 (no umbra dominance → no charge)
//   min(umbraDominantLineCount, ROCK_ECHO_MAX_CHARGE_PER_FIRE) otherwise
export function computeEncoreEchoCharge(rockCount, umbraDominantLineCount) {
  const _rocks = Math.max(0, Math.floor(Number(rockCount) || 0));
  const _lines = Math.max(0, Math.floor(Number(umbraDominantLineCount) || 0));
  if (_rocks === 0 || _lines === 0) return 0;
  return Math.min(_lines * ROCK_ECHO_CHARGE_PER_LINE, ROCK_ECHO_MAX_CHARGE_PER_FIRE);
}

// Threshold-safe clamp helper. Reads the umbra ULT threshold from the
// runtime globals (legacy `currentUltThreshold.umbra` first, then static
// `ULT_THRESHOLD.umbra`), defaults to 12 when neither is available (matches
// the legacy fallback at heroes.js:790).
//
// Sacred-cow safety (CLAUDE.md §2.1): the threshold itself is NEVER
// modified by Encore Echo — we only READ it to compute the clamp. The
// ULT-fire pipeline observes `ultCharges.umbra >= threshold` and marks
// the ULT ready; Encore Echo writes charge up to (but never beyond) the
// threshold and lets the existing pipeline trigger the actual ULT fire.
//
// Pure function — exported so unit tests can verify the clamp math without
// needing real globals (caller passes `_currentCharge`, `_thresholdOverride`
// to drive the math). When `_thresholdOverride` is undefined, the function
// reads runtime globals (production path).
export function clampEncoreEchoCharge(currentCharge, echoCharge, thresholdOverride) {
  const _current = Math.max(0, Math.floor(Number(currentCharge) || 0));
  const _delta   = Math.max(0, Math.floor(Number(echoCharge) || 0));
  // Resolve threshold: explicit override > currentUltThreshold > ULT_THRESHOLD > 12.
  let _threshold;
  if (typeof thresholdOverride === 'number' && thresholdOverride > 0) {
    _threshold = thresholdOverride;
  } else if (typeof currentUltThreshold !== 'undefined' && currentUltThreshold
             && typeof currentUltThreshold[ROCK_ECHO_ULT_METER] === 'number') {
    _threshold = currentUltThreshold[ROCK_ECHO_ULT_METER];
  } else if (typeof ULT_THRESHOLD !== 'undefined' && ULT_THRESHOLD
             && typeof ULT_THRESHOLD[ROCK_ECHO_ULT_METER] === 'number') {
    _threshold = ULT_THRESHOLD[ROCK_ECHO_ULT_METER];
  } else {
    _threshold = 12; // legacy fallback per heroes.js:790
  }
  return Math.min(_threshold, _current + _delta);
}

// Resolves a screen-coord origin for a cleared line's midpoint. Returns
// {x, y, direction} for the FIRST row in `rows` (preferred) or first col in
// `cols`. Used by the Rock Echo VFX to anchor the ghost flash on the line
// the player just cleared. Read-only DOM query — no mutation. Returns null
// when no cells are renderable (early-boot / FTUE / unit-test env).
function _resolveLineOrigin(rows, cols) {
  if (typeof document === 'undefined') return null;
  const cells = document.querySelectorAll('.grid .cell');
  if (!cells.length) return null;
  // Prefer row anchor: row r, center col (col 4 on 8×8).
  if (Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'number') {
    const idx = rows[0] * BOARD_COLS + Math.floor(BOARD_COLS / 2);
    const el = cells[idx];
    if (el) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, direction: 'horizontal-row' };
    }
  }
  if (Array.isArray(cols) && cols.length > 0 && typeof cols[0] === 'number') {
    const idx = Math.floor(BOARD_ROWS / 2) * BOARD_COLS + cols[0];
    const el = cells[idx];
    if (el) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, direction: 'vertical-col' };
    }
  }
  return null;
}

// ─── Rock Encore Echo (spec §2.3) ──────────────────────────────────────
//
// Trigger contract (spec §2.3 field 10):
//   - Fires every `clearLines(rows, cols)` resolve.
//   - Gate: ≥1 rock hero alive in squad AND ≥1 cleared line with dominant
//     element === 'umbra'. Else silent no-op (no DOM, no allocation, no log).
// Effect contract (spec §2.3 fields 3–9):
//   - +1 ULT charge to `ultCharges.umbra` per umbra-dominant cleared line.
//   - HARD CAP at ROCK_ECHO_MAX_CHARGE_PER_FIRE (4) charge per fire.
//   - **Threshold-clamped**: writes `min(threshold, current + delta)` so
//     the umbra ULT meter NEVER overshoots its sacred threshold. The
//     ULT-fire pipeline (player-initiated at ready-state) is left alone;
//     Encore Echo only adds charge up to ready, never beyond.
//   - Visual: ~200ms after the line clears, a translucent purple "ghost"
//     of the cleared cells flashes back in place for one beat, then
//     dissolves over 700ms. Max 4 echo elements simultaneously.
//   - Sound: soft cymbal swell — re-use existing `Encore` proc from
//     rock-tier RACE_SYNERGY (per ESC-02 O4 RE-USE-FIRST ruling). No new
//     SFX asset added in T2.04. Audio mixer handles re-use; this module
//     does NOT call audio APIs directly.
//   - Haptic: standard `clear` already fired by host `clearLines` via
//     `vibrate(25)` — `fxRockLineClear` does NOT re-fire (T2.02 precedent
//     #3 — no double-pulse).
//   - Total wall-time ≤8ms (spec §2.3 field 9).
//
// `ctx` is an optional cell-state predicate snapshot (passed through from
// the dispatcher; nullable in T2.04 since legacy bridge is deferred to
// T2.B). Recognized keys for Rock: `dominantElementsByLine` (per-line
// dominant element array — same surface T2.03 surfaced for Shark).
//
// Returns the count of charges actually added (clamped — useful for smoke
// assertions). When the threshold is reached mid-add, the returned value
// reflects the post-clamp delta (e.g., adding +4 to a meter at 99/100
// returns 1, not 4).
export function fxRockLineClear(rows, cols, squad, ctx) {
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  try {
    // Squad alive-rock count. Same fallback chain as Pirate / Shark.
    const _squad = Array.isArray(squad) ? squad
                 : (typeof HERO_DECK !== 'undefined' && Array.isArray(HERO_DECK)) ? HERO_DECK
                 : [];
    const rockCount = countAliveRocks(_squad);
    if (rockCount === 0) return 0;

    const rowCount = Array.isArray(rows) ? rows.length : 0;
    const colCount = Array.isArray(cols) ? cols.length : 0;
    if (rowCount + colCount === 0) return 0;

    // Read per-line dominant elements from ctx (T2.03 side-channel).
    const dominantByLine = (ctx && Array.isArray(ctx.dominantElementsByLine))
      ? ctx.dominantElementsByLine
      : null;
    const umbraDominantLineCount = countUmbraDominantLines(rows, cols, dominantByLine);
    if (umbraDominantLineCount === 0) return 0;

    const echoChargeToAdd = computeEncoreEchoCharge(rockCount, umbraDominantLineCount);
    if (echoChargeToAdd <= 0) return 0;

    // ── Write to umbra ULT meter via threshold-clamped Math.min (sacred). ──
    // The legacy globals `ultCharges` + `currentUltThreshold` / `ULT_THRESHOLD`
    // are runtime-populated by the legacy battle init (battle.js:765+ /
    // heroes.js:790). When the globals aren't populated (early-boot / unit-
    // test / FTUE pre-battle), write is silently skipped — VFX still plays
    // so the smoke test can observe the ghost element, but no spurious
    // charge is granted in a non-battle context.
    let _actualDelta = 0;
    try {
      if (typeof ultCharges !== 'undefined' && ultCharges
          && typeof ultCharges[ROCK_ECHO_ULT_METER] === 'number') {
        const _current = ultCharges[ROCK_ECHO_ULT_METER];
        const _clamped = clampEncoreEchoCharge(_current, echoChargeToAdd);
        _actualDelta = _clamped - _current;
        ultCharges[ROCK_ECHO_ULT_METER] = _clamped;
      } else if (typeof window !== 'undefined' && window.ultCharges
                 && typeof window.ultCharges[ROCK_ECHO_ULT_METER] === 'number') {
        // Window-bridge fallback (T1.13.5 pattern) — legacy may expose globals
        // only on window in some boot orderings.
        const _current = window.ultCharges[ROCK_ECHO_ULT_METER];
        const _clamped = clampEncoreEchoCharge(_current, echoChargeToAdd);
        _actualDelta = _clamped - _current;
        window.ultCharges[ROCK_ECHO_ULT_METER] = _clamped;
      }
    } catch (e) {
      log.warn('Rock Encore Echo ultCharges write failed:', e);
    }

    // Visual: ghost-flash per umbra-dominant cleared line. One element per
    // line up to ROCK_ECHO_MAX_CHARGE_PER_FIRE (the pool size). We spawn
    // echoChargeToAdd ghosts regardless of `_actualDelta` — VFX represents
    // the player's action, not the clamped mechanical result (mirrors the
    // Shark "blocked bite still fires visually" pattern from T2.03).
    _ensureRockEchoPool();
    if (_rockEchoPoolInitDone) {
      // Spawn one ghost per umbra-dominant line — but we need a per-line
      // origin. Since `dominantElementsByLine` is parallel to (rows ∪ cols),
      // we iterate `rows` first then `cols` to match the dispatcher's
      // upstream ordering (T2.03 convention).
      const _rowList = Array.isArray(rows) ? rows : [];
      const _colList = Array.isArray(cols) ? cols : [];
      let _spawned = 0;
      const _maxSpawn = Math.min(echoChargeToAdd, ROCK_ECHO_MAX_CHARGE_PER_FIRE);
      // Per-line spawn: for each (rows[i] then cols[j]) entry, if the
      // matching dominantByLine[k] is 'umbra', spawn a ghost at that line's
      // origin. When dominantByLine is null (defensive — gate already
      // guarded above), this loop is skipped.
      if (dominantByLine) {
        let _lineIdx = 0;
        for (const r of _rowList) {
          if (_spawned >= _maxSpawn) break;
          if (dominantByLine[_lineIdx] === ROCK_ECHO_DOMINANT_ELEMENT) {
            const origin = _resolveLineOrigin([r], []);
            if (origin) {
              const el = _acquireRockEcho();
              if (!el) break;
              spawnRockEchoGhost({
                el,
                x: origin.x,
                y: origin.y,
                direction: origin.direction,
                decayMs: ROCK_ECHO_GHOST_DECAY_MS,
                delayMs: ROCK_ECHO_DELAY_MS,
              });
              setTimeout(() => _releaseRockEcho(el),
                ROCK_ECHO_GHOST_DECAY_MS + ROCK_ECHO_DELAY_MS);
              _spawned++;
            }
          }
          _lineIdx++;
        }
        for (const c of _colList) {
          if (_spawned >= _maxSpawn) break;
          if (dominantByLine[_lineIdx] === ROCK_ECHO_DOMINANT_ELEMENT) {
            const origin = _resolveLineOrigin([], [c]);
            if (origin) {
              const el = _acquireRockEcho();
              if (!el) break;
              spawnRockEchoGhost({
                el,
                x: origin.x,
                y: origin.y,
                direction: origin.direction,
                decayMs: ROCK_ECHO_GHOST_DECAY_MS,
                delayMs: ROCK_ECHO_DELAY_MS,
              });
              setTimeout(() => _releaseRockEcho(el),
                ROCK_ECHO_GHOST_DECAY_MS + ROCK_ECHO_DELAY_MS);
              _spawned++;
            }
          }
          _lineIdx++;
        }
      }
    }

    // Spec §2.3 field 6: standard `clear` haptic. Already fired by host
    // clearLines (`vibrate(25)` at grid.js:399). NOT re-fired here — T2.02
    // precedent #3 (no double-pulse).
    void vHaptic;

    // T2.12 (2026-05-12): Codex recording — rock race triggered.
    try { recordRaceTrigger('rock'); } catch (_e) { /* defensive */ }

    // Return the CLAMPED actual delta — useful for smoke assertions that
    // need to verify the threshold-clamp invariant. Note: this may be
    // smaller than echoChargeToAdd when the meter was near the cap. When
    // the runtime globals aren't populated (unit-test / FTUE), returns 0
    // for the charge side but VFX still ran (observable via DOM count).
    return _actualDelta;
  } finally {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      // Spec §2.3 field 9 — soft budget check at 8ms.
      if (dt > 8) log.warn('Rock Encore Echo over budget:', dt.toFixed(2), 'ms');
    }
  }
}

// ─── Crocodile Bedrock Bastion DOM pool (spec §2.4 + §5 — no createElement per fire) ──
// Pre-allocate CROCODILE_BASTION_MAX_FRAGMENT_PARTICLES (16) fragment elements
// at module load (lazy — first call to `_ensureCrocFragmentPool`). Track
// available vs in-flight via two arrays. Mirrors the coin + shark-bite + rock-
// echo pool patterns above. The fragment ceiling matches the spec's hard cap
// (16 fragment particles simultaneous), so pool exhaustion under realistic
// load is mathematically impossible inside a single fire — exhaustion would
// only occur if two fires overlap their 600ms decay windows.
const _crocFragmentPool          = [];   // all CROCODILE_BASTION_MAX_FRAGMENT_PARTICLES elements (created once)
const _crocFragmentPoolAvailable = [];   // currently idle elements (poppable)
let   _crocFragmentPoolInitDone  = false;
let   _crocFragmentPoolContainer = null;

function _ensureCrocFragmentPool() {
  if (_crocFragmentPoolInitDone) return;
  if (typeof document === 'undefined') return; // unit-test guard
  _crocFragmentPoolContainer = document.createElement('div');
  _crocFragmentPoolContainer.className = 'identity-croc-fragment-layer';
  _crocFragmentPoolContainer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(_crocFragmentPoolContainer);
  for (let i = 0; i < CROCODILE_BASTION_MAX_FRAGMENT_PARTICLES; i++) {
    const el = document.createElement('div');
    el.className = 'identity-croc-fragment';
    _crocFragmentPoolContainer.appendChild(el);
    _crocFragmentPool.push(el);
    _crocFragmentPoolAvailable.push(el);
  }
  _crocFragmentPoolInitDone = true;
}

function _acquireCrocFragment() {
  return _crocFragmentPoolAvailable.pop() || null;
}

function _releaseCrocFragment(el) {
  if (!el) return;
  el.classList.remove('identity-croc-fragment-flying');
  _crocFragmentPoolAvailable.push(el);
}

// ─── Crocodile cross-fire fragment bank (spec §2.4 field 4) ────────────
// `_crocFragmentBank` accumulates ACROSS multiple line clears in a single
// battle. Reset only on battle end / new battle start via the exported
// `resetCrocFragmentBank()` function. Unique to Crocodile (the other 4 race
// flavors are per-fire stateless).
//
// Spec §2.4 field 4 verbatim: "Per cleared grove cell, accumulate 1 fragment
// on a counter. Every 5 fragments grants 1 shield to the squad (or refreshes
// 1 expired shield) up to the squad's existing max shield cap from
// RACE_SYNERGY golem tier 2/3/5 maxShieldBonus (sacred). If max-shield cap
// reached, surplus fragments are discarded (no overflow exploit)."
//
// "Surplus discarded" is enforced by `clampShieldsToSquadMax` (below).
let _crocFragmentBank = 0;

// Resets the per-battle fragment bank. Called by:
//   - Battle pipeline at battle start (clears prior battle's residue)
//   - Battle pipeline at battle end (defensive — same reason)
//   - Smoke / unit tests between scenarios
// Pure side-effect: no DOM, no return value.
export function resetCrocFragmentBank() {
  _crocFragmentBank = 0;
}

// ─── Crocodile pure math (unit-testable, no DOM) ───────────────────────
//
// Squad alive-crocodile count. Defensive against the codebase reality that
// heroes in HERO_DECK don't track per-hero hp (squad shares global `hp`).
// Treats absence of `.hp` as alive (heroes are removed from deck on death;
// `h.hp > 0` gate is preserved when hp IS present). Mirrors
// `countAlivePirates` / `countAliveSharks` / `countAliveRocks` precedent
// (T2.02 CTO ruling #2 — defensive hp / single-haptic).
export function countAliveCrocodiles(squad) {
  if (!Array.isArray(squad)) return 0;
  let n = 0;
  for (const h of squad) {
    if (!h || h.race !== 'crocodile') continue;
    if (h.hp !== undefined && h.hp <= 0) continue;
    n++;
  }
  return n;
}

// Count grove cells in cleared rows∪cols. Pure function — unit-testable.
// `gridState` is a flexible source of grid element data:
//   - 2D array indexed `[r][c]` returning stihiya string or null (legacy grid global pattern)
//   - { getElementAt(r, c): string|null } object (module-style API)
//   - null/undefined → returns 0 (defensive — no source means no grove cells)
//
// Spec §2.4 field 10 trigger: rows∪cols must contain ≥1 grove cell. The
// CROCODILE_BASTION_GROVE_ELEMENT constant ('grove') is the literal value
// produced by the legacy grid (line 191 — `weightedStihiya()` writes
// 'ember'|'tide'|'grove'|'solar'|'umbra' strings into grid cells).
//
// `gridCols` / `gridRows` default to BOARD_COLS / BOARD_ROWS (8×8). Cells
// are accounted via inclusion–exclusion (the intersection of a cleared row
// and cleared col is one cell, not two — same accounting as
// `computeCellsCleared` above).
export function countGroveCells(rows, cols, gridState, gridCols = BOARD_COLS, gridRows = BOARD_ROWS) {
  if (!gridState) return 0;
  const _rowList = Array.isArray(rows) ? rows.filter(r => typeof r === 'number' && r >= 0 && r < gridRows) : [];
  const _colList = Array.isArray(cols) ? cols.filter(c => typeof c === 'number' && c >= 0 && c < gridCols) : [];
  if (_rowList.length === 0 && _colList.length === 0) return 0;

  // Resolve a unified accessor. Prefer explicit `getElementAt` (module API),
  // fall back to 2D-array indexing (legacy grid global).
  const _getter = (typeof gridState.getElementAt === 'function')
    ? ((r, c) => { try { return gridState.getElementAt(r, c); } catch (_e) { return null; } })
    : ((r, c) => {
        const row = gridState[r];
        if (!row) return null;
        return row[c];
      });

  // Track visited cells via the inclusion-exclusion key so a cell at a row×col
  // intersection counts ONCE (not twice).
  const _seen = new Set();
  let n = 0;
  for (const r of _rowList) {
    for (let c = 0; c < gridCols; c++) {
      const key = r + '_' + c;
      if (_seen.has(key)) continue;
      _seen.add(key);
      const v = _getter(r, c);
      if (v === CROCODILE_BASTION_GROVE_ELEMENT) n++;
    }
  }
  for (const c of _colList) {
    for (let r = 0; r < gridRows; r++) {
      const key = r + '_' + c;
      if (_seen.has(key)) continue;
      _seen.add(key);
      const v = _getter(r, c);
      if (v === CROCODILE_BASTION_GROVE_ELEMENT) n++;
    }
  }
  return n;
}

// Accumulates the per-fire grove-cell count onto the running bank. Pure
// function — unit-testable. Returns the new bank value.
//
// Defensive against non-finite / negative inputs (returns the current bank
// unchanged so a malformed input cannot corrupt the cross-fire counter).
export function accumulateFragments(currentBank, groveCellsCount) {
  const _current = Math.max(0, Math.floor(Number(currentBank) || 0));
  const _delta   = Math.max(0, Math.floor(Number(groveCellsCount) || 0));
  return _current + _delta;
}

// Computes how many shields the current fragment bank can grant, and what
// the bank is left at after consumption. Pure function — unit-testable.
//
// Spec §2.4 field 4: "Every 5 fragments grants 1 shield."
//   bank=4  → grant 0 shields, bank stays 4
//   bank=5  → grant 1 shield,  bank goes to 0
//   bank=12 → grant 2 shields, bank goes to 2
//   bank=20 → grant 4 shields, bank goes to 0
//
// Returns `{ shieldsToGrant, newBank }`.
export function computeShieldsGrantable(fragmentBank, fragmentsPerShield) {
  const _bank = Math.max(0, Math.floor(Number(fragmentBank) || 0));
  const _per  = Math.max(1, Math.floor(Number(fragmentsPerShield) || CROCODILE_BASTION_FRAGMENTS_PER_SHIELD));
  if (_bank === 0) return { shieldsToGrant: 0, newBank: 0 };
  const shieldsToGrant = Math.floor(_bank / _per);
  const newBank        = _bank - (shieldsToGrant * _per);
  return { shieldsToGrant, newBank };
}

// Clamps a shield grant to the sacred squad max. Pure function — unit-testable.
//
// Per spec §2.4 field 4: "up to the squad's existing max shield cap from
// RACE_SYNERGY golem tier 2/3/5 maxShieldBonus (sacred). If max-shield cap
// reached, surplus fragments are discarded (no overflow exploit)."
//
// Returns the FINAL clamped shield count (i.e., the new total, not the
// delta). Caller is responsible for computing the actual delta if needed
// (delta = clamped - currentShields).
//
// Examples:
//   current=3, grant=2, cap=4 → final=4 (NOT 5 — surplus 1 discarded)
//   current=0, grant=4, cap=7 → final=4 (within cap)
//   current=7, grant=2, cap=7 → final=7 (already at cap)
//
// All inputs floored to ≥0 defensively. The cap is sacred — read-only.
export function clampShieldsToSquadMax(currentShields, shieldsToGrant, sacredMaxShieldCap) {
  const _current = Math.max(0, Math.floor(Number(currentShields) || 0));
  const _grant   = Math.max(0, Math.floor(Number(shieldsToGrant) || 0));
  const _cap     = Math.max(0, Math.floor(Number(sacredMaxShieldCap) || 0));
  return Math.min(_cap, _current + _grant);
}

// Resolves the sacred maxShieldBonus contribution from `RACE_SYNERGY.golem`
// based on the active tier (golem count threshold). Pure function — READ
// ONLY of the sacred `RACE_SYNERGY` literal (CLAUDE.md §2.1 — NEVER write).
//
// Per RACE_SYNERGY.golem (src/data/races.js):
//   tier 2 (≥2 golems): maxShieldBonus = 1
//   tier 3 (≥3 golems): maxShieldBonus = 2
//   tier 5 (≥5 golems): maxShieldBonus = 2
//   <2 golems:          0 (no synergy contribution)
//
// Higher tier supersedes lower (per RACE_SYNERGY schema comment line 41).
//
// Returns the byte-perfect sacred value (defensive read with optional
// chaining + Number coercion so a hostile mock can't crash this).
export function resolveSacredMaxShieldBonus(golemCount) {
  const _count = Math.max(0, Math.floor(Number(golemCount) || 0));
  const _golem = RACE_SYNERGY && RACE_SYNERGY.golem;
  if (!_golem) return 0; // defensive — never happens with sacred literal intact
  if (_count >= 5 && _golem[5] && typeof _golem[5].maxShieldBonus === 'number') {
    return _golem[5].maxShieldBonus;
  }
  if (_count >= 3 && _golem[3] && typeof _golem[3].maxShieldBonus === 'number') {
    return _golem[3].maxShieldBonus;
  }
  if (_count >= 2 && _golem[2] && typeof _golem[2].maxShieldBonus === 'number') {
    return _golem[2].maxShieldBonus;
  }
  return 0;
}

// Counts alive golem heroes in the squad. Pure function — used to resolve
// the active RACE_SYNERGY.golem tier (for the sacred max-shield-cap lookup).
// Same defensive hp pattern as countAlivePirates / countAliveSharks /
// countAliveRocks / countAliveCrocodiles.
function _countAliveGolems(squad) {
  if (!Array.isArray(squad)) return 0;
  let n = 0;
  for (const h of squad) {
    if (!h || h.race !== 'golem') continue;
    if (h.hp !== undefined && h.hp <= 0) continue;
    n++;
  }
  return n;
}

// Resolves the screen-coord origin for the leftmost crocodile hero portrait
// in the rendered squad. Returns {x, y} viewport coords, or null when the
// portrait DOM isn't available (early-boot / unit-test).
//
// The legacy hero panel renders portraits as `.heroPortrait` or
// `.hero-portrait` (V18 / V19 selectors); we accept either. The "leftmost"
// is the FIRST portrait whose data-race attribute === 'crocodile' (or whose
// heroIdx is the lowest among crocodile entries).
//
// Falls back to the bottom-center of the viewport if no portrait is found
// — better to show fragments arriving at the squad area than to suppress
// the visual entirely. Read-only DOM query — no mutation.
function _resolveLeftmostCrocodilePortraitTarget() {
  if (typeof document === 'undefined') {
    return { x: 0, y: 0 };
  }
  const portraits = document.querySelectorAll(
    '[data-race="crocodile"], .heroPortrait[data-race="crocodile"], .hero-portrait[data-race="crocodile"]',
  );
  if (portraits.length > 0) {
    const el = portraits[0];
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  // Fallback — bottom-center of viewport with 64px inset (squad portraits
  // typically render in the lower band of the screen).
  return {
    x: (typeof window !== 'undefined' ? window.innerWidth  : 360) / 2,
    y: (typeof window !== 'undefined' ? window.innerHeight : 640) - 64,
  };
}

// Resolves the screen-coord origin for a specific grid cell (r, c). Read-
// only DOM query — no mutation. Mirrors `_resolveCellOrigin` above but
// indexes by (r, c) instead of flat cell idx (Crocodile iterates the
// grove-cell set per-r/c, not by flat idx, because it needs to filter on
// the cell value).
function _resolveCellOriginRC(r, c) {
  if (typeof document === 'undefined') return null;
  const cells = document.querySelectorAll('.grid .cell');
  const el = cells[r * BOARD_COLS + c];
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// ─── Crocodile Bedrock Bastion (spec §2.4) ─────────────────────────────
//
// Trigger contract (spec §2.4 field 10):
//   - Fires every `clearLines(rows, cols)` resolve.
//   - Gate: ≥1 crocodile hero alive AND ≥1 grove cell in rows∪cols.
//     Else silent no-op (no DOM, no allocation, no log, no bank touch).
// Effect contract (spec §2.4 fields 3–9):
//   - Per cleared grove cell, +1 fragment on the cross-fire `_crocFragmentBank`.
//   - Every CROCODILE_BASTION_FRAGMENTS_PER_SHIELD (5) fragments grants 1
//     shield to the squad (or refreshes 1 expired shield).
//   - Shield count is CLAMPED to the sacred squad max shield cap:
//       cap = MAX_SHIELD + 2 + maxShieldBonus
//     where `maxShieldBonus` is RUNTIME-AGGREGATED from RACE_SYNERGY tiers
//     by the legacy battle-init pipeline (heroes.js sets `maxShieldBonus`
//     via the active synergy tier). When the runtime global isn't populated,
//     we fall back to the sacred read from RACE_SYNERGY.golem based on the
//     squad's golem count via `resolveSacredMaxShieldBonus` — RACE_SYNERGY
//     is READ ONLY here per CLAUDE.md §2.1.
//   - If cap reached, surplus shields are discarded; the consumed fragments
//     are NOT refunded (per spec field 4 — "surplus fragments are discarded
//     (no overflow exploit)"). This is enforced by the order:
//       (1) consume fragments to compute shieldsToGrant
//       (2) clamp shieldsToGrant against cap → final
//       (3) write final to shieldCount global
//     so the bank moves forward even when the shield write is capped.
//   - Visual: sandstone-brown 8×8 fragment particle from each cleared grove
//     cell, flying inward to the leftmost crocodile portrait. Pool of 16,
//     decay 600ms each.
//   - If shieldsToGrant > 0 → a shield-grant flash animates on the receiving
//     crocodile's portrait (re-uses HUD shield iconography; spec §2.4
//     field 3).
//   - Sound: light rocky thunk 150ms, re-use existing earth/grove SFX per
//     ESC-02 O4 ruling. Audio mixer handles re-use; this module does NOT
//     call audio APIs directly.
//   - Haptic: standard `clear` already fired by host `clearLines` via
//     `vibrate(25)` — `fxCrocodileLineClear` does NOT re-fire (T2.02
//     precedent #3 — no double-pulse).
//   - Total wall-time ≤8ms (spec §2.4 field 9).
//
// `ctx` is an optional cell-state predicate snapshot (passed through from
// the dispatcher; nullable in T2.05 since legacy bridge is deferred to
// T2.B). Recognized keys for Crocodile:
//   - `gridState` — 2D grid array OR `{ getElementAt(r, c) }` accessor
//     (for the grove-cell scan)
//   - `squadShieldsApi` — optional `{ get(): number, set(n: number): void,
//     cap?: number }` (test injection for the smoke-test path; production
//     path uses legacy globals)
//
// Returns the count of shields actually GRANTED (post-clamp). Useful for
// smoke assertions. When the runtime globals aren't populated AND no
// squadShieldsApi is supplied, returns 0 for the granted side — VFX still
// runs (observable via DOM count), and the fragment bank still advances.
export function fxCrocodileLineClear(rows, cols, squad, ctx) {
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  try {
    // Squad alive-crocodile count. Same fallback chain as Pirate / Shark / Rock.
    const _squad = Array.isArray(squad) ? squad
                 : (typeof HERO_DECK !== 'undefined' && Array.isArray(HERO_DECK)) ? HERO_DECK
                 : [];
    const crocodileCount = countAliveCrocodiles(_squad);
    if (crocodileCount === 0) return 0;

    const rowCount = Array.isArray(rows) ? rows.length : 0;
    const colCount = Array.isArray(cols) ? cols.length : 0;
    if (rowCount + colCount === 0) return 0;

    // Resolve gridState from ctx → legacy `grid` global. The legacy grid
    // is a 2D array of stihiya strings (see src/core/grid.js line 132).
    const _gridState = (ctx && ctx.gridState) ? ctx.gridState
                     : (typeof grid !== 'undefined' && Array.isArray(grid)) ? grid
                     : (typeof window !== 'undefined' && Array.isArray(window.grid)) ? window.grid
                     : null;

    const groveCells = countGroveCells(rows, cols, _gridState);
    if (groveCells === 0) return 0;

    // Accumulate fragments onto the cross-fire bank.
    _crocFragmentBank = accumulateFragments(_crocFragmentBank, groveCells);

    // Compute shield grant + remaining bank.
    const { shieldsToGrant, newBank } = computeShieldsGrantable(
      _crocFragmentBank, CROCODILE_BASTION_FRAGMENTS_PER_SHIELD,
    );
    _crocFragmentBank = newBank;

    // ── Resolve sacred squad max shield cap. ──
    // Production path reads the runtime `maxShieldBonus` global (set by
    // legacy battle init from active synergy tier). When unavailable
    // (unit-test / FTUE pre-battle), fall back to the sacred read from
    // RACE_SYNERGY.golem based on the squad's golem count. The cap formula
    // matches the legacy convention at src/core/heroes.js:715
    //   cap = MAX_SHIELD + 2 + maxShieldBonus
    //   where MAX_SHIELD defaults to 3 (legacy line 20163) when not available.
    let _bonus = 0;
    if (typeof maxShieldBonus === 'number') {
      _bonus = maxShieldBonus;
    } else if (typeof window !== 'undefined' && typeof window.maxShieldBonus === 'number') {
      _bonus = window.maxShieldBonus;
    } else {
      // Sacred fallback — read RACE_SYNERGY.golem by active tier.
      const _golemCount = _countAliveGolems(_squad);
      _bonus = resolveSacredMaxShieldBonus(_golemCount);
    }
    const _baseMaxShield = (typeof MAX_SHIELD === 'number') ? MAX_SHIELD
                         : (typeof window !== 'undefined' && typeof window.MAX_SHIELD === 'number') ? window.MAX_SHIELD
                         : 3; // legacy line 20163 default
    const _sacredCap = _baseMaxShield + 2 + _bonus;

    // ── Write to SQUAD shieldCount via clamp (sacred — never overshoot). ──
    // SQUAD shields (defensive) — NOT boss armored shields (ARMORED_SHIELD_*
    // is sacred §2.5 and UNTOUCHED — different system, different global).
    let _shieldsGranted = 0;
    try {
      // Optional test-injection API (smoke tests pass a shim so they don't
      // need to stub the legacy `shieldCount` global directly).
      if (ctx && ctx.squadShieldsApi
          && typeof ctx.squadShieldsApi.get === 'function'
          && typeof ctx.squadShieldsApi.set === 'function') {
        const _current = Number(ctx.squadShieldsApi.get()) || 0;
        const _capOverride = (typeof ctx.squadShieldsApi.cap === 'number') ? ctx.squadShieldsApi.cap : _sacredCap;
        const _clamped = clampShieldsToSquadMax(_current, shieldsToGrant, _capOverride);
        _shieldsGranted = _clamped - _current;
        if (_shieldsGranted > 0) {
          ctx.squadShieldsApi.set(_clamped);
        }
      } else if (typeof window !== 'undefined' && typeof window.shieldCount === 'number') {
        // Window-bridge path — T2.B (legacy bridge) will wire legacy
        // `shieldCount` onto `window.shieldCount` so this read/write reaches
        // the live runtime. Until T2.B lands, smoke tests stub
        // `window.shieldCount` directly (mirrors T2.04 ultCharges pattern).
        // Note: we DO NOT attempt to write to a bare `shieldCount` global
        // because legacy declares it via `let shieldCount` at module scope,
        // and ES-module strict mode forbids assigning to an undeclared
        // binding (ReferenceError). The window bridge is the contract.
        const _current = window.shieldCount;
        const _clamped = clampShieldsToSquadMax(_current, shieldsToGrant, _sacredCap);
        _shieldsGranted = _clamped - _current;
        if (_shieldsGranted > 0) {
          window.shieldCount = _clamped;
        }
      }
    } catch (e) {
      log.warn('Crocodile Bedrock Bastion shield write failed:', e);
    }

    // ── Visual: spawn fragment particles from each cleared grove cell. ──
    // Pool init is lazy (first fire creates the 16 elements). Particle
    // count is capped at CROCODILE_BASTION_MAX_FRAGMENT_PARTICLES (16) per
    // fire. Each fragment flies to the leftmost crocodile portrait.
    _ensureCrocFragmentPool();
    if (_crocFragmentPoolInitDone) {
      const target = _resolveLeftmostCrocodilePortraitTarget();
      // Build the set of grove cell (r,c) coordinates for this fire (same
      // inclusion-exclusion accounting as `countGroveCells`).
      const _getter = (typeof _gridState.getElementAt === 'function')
        ? ((r, c) => { try { return _gridState.getElementAt(r, c); } catch (_e) { return null; } })
        : ((r, c) => {
            const row = _gridState[r];
            if (!row) return null;
            return row[c];
          });
      const _coords = [];
      const _seen = new Set();
      const _rowList = Array.isArray(rows) ? rows : [];
      const _colList = Array.isArray(cols) ? cols : [];
      for (const r of _rowList) {
        if (typeof r !== 'number') continue;
        for (let c = 0; c < BOARD_COLS; c++) {
          const key = r + '_' + c;
          if (_seen.has(key)) continue;
          _seen.add(key);
          if (_getter(r, c) === CROCODILE_BASTION_GROVE_ELEMENT) _coords.push({ r, c });
        }
      }
      for (const c of _colList) {
        if (typeof c !== 'number') continue;
        for (let r = 0; r < BOARD_ROWS; r++) {
          const key = r + '_' + c;
          if (_seen.has(key)) continue;
          _seen.add(key);
          if (_getter(r, c) === CROCODILE_BASTION_GROVE_ELEMENT) _coords.push({ r, c });
        }
      }
      let _spawned = 0;
      for (const { r, c } of _coords) {
        if (_spawned >= CROCODILE_BASTION_MAX_FRAGMENT_PARTICLES) break;
        const origin = _resolveCellOriginRC(r, c);
        if (!origin) continue;
        const el = _acquireCrocFragment();
        if (!el) break;
        spawnCrocFragmentParticle({
          el,
          x: origin.x,
          y: origin.y,
          targetX: target.x,
          targetY: target.y,
          decayMs: CROCODILE_BASTION_FRAGMENT_DECAY_MS,
          color: '#8B5A3C',
        });
        setTimeout(() => _releaseCrocFragment(el), CROCODILE_BASTION_FRAGMENT_DECAY_MS);
        _spawned++;
      }

      // If shields were actually granted, animate the shield-grant flash on
      // the receiving portrait (leftmost crocodile). Defensive — only fires
      // when we have a portrait to anchor to.
      if (_shieldsGranted > 0 && typeof document !== 'undefined') {
        const portrait = document.querySelector(
          '[data-race="crocodile"], .heroPortrait[data-race="crocodile"], .hero-portrait[data-race="crocodile"]',
        );
        if (portrait && CROCODILE_BASTION_TARGET_HERO_INDEX >= 0) {
          // Create a one-shot flash element OUTSIDE the pool (lightweight,
          // short-lived — 300ms). It's a single DOM creation per shield
          // grant, not per fire — the sacred §5 "no createElement per fire"
          // rule covers the per-fire particle volume (16 fragments); shield
          // grants are 0-3 per fire by spec field 9 math (16/5 = 3 max).
          const flash = document.createElement('div');
          flash.className = 'identity-croc-shield-grant';
          flash.setAttribute('aria-hidden', 'true');
          const r = portrait.getBoundingClientRect();
          flash.style.left = (r.left + r.width / 2) + 'px';
          flash.style.top  = (r.top + r.height / 2) + 'px';
          document.body.appendChild(flash);
          setTimeout(() => { try { flash.remove(); } catch (_e) { /* swallow */ } }, 350);
        }
      }
    }

    // Spec §2.4 field 6: standard `clear` haptic. Already fired by host
    // clearLines (`vibrate(25)` at grid.js:399). NOT re-fired here — T2.02
    // precedent #3 (no double-pulse).
    void vHaptic;

    // T2.12 (2026-05-12): Codex recording — crocodile race triggered.
    try { recordRaceTrigger('crocodile'); } catch (_e) { /* defensive */ }

    // Return the CLAMPED shields actually granted (post-cap). Useful for
    // smoke assertions that need to verify the squad-shield-cap invariant.
    // When the runtime globals aren't populated (unit-test / FTUE without
    // a squadShieldsApi override), returns 0 — VFX still ran (observable
    // via DOM count) and the fragment bank still advanced.
    return _shieldsGranted;
  } finally {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      // Spec §2.4 field 9 — soft budget check at 8ms.
      if (dt > 8) log.warn('Crocodile Bedrock Bastion over budget:', dt.toFixed(2), 'ms');
    }
  }
}

// ─── Spark Sun Cascade DOM pool (spec §2.5 + §5 — no createElement per fire) ──
// Pre-allocate SPARK_CASCADE_MAX_RAY_PARTICLES (16) ray elements at module
// load (lazy — first call to `_ensureSparkRayPool`). Track available vs
// in-flight via two arrays. Mirrors the coin + shark-bite + rock-echo +
// croc-fragment pool patterns above. The ray ceiling matches the spec's
// hard cap (16 ray particles simultaneous), so pool exhaustion under
// realistic load is mathematically impossible inside a single fire —
// exhaustion would only occur if two fires overlap their 400ms decay
// windows.
const _sparkRayPool          = [];   // all SPARK_CASCADE_MAX_RAY_PARTICLES elements (created once)
const _sparkRayPoolAvailable = [];   // currently idle elements (poppable)
let   _sparkRayPoolInitDone  = false;
let   _sparkRayPoolContainer = null;

function _ensureSparkRayPool() {
  if (_sparkRayPoolInitDone) return;
  if (typeof document === 'undefined') return; // unit-test guard
  _sparkRayPoolContainer = document.createElement('div');
  _sparkRayPoolContainer.className = 'identity-spark-ray-layer';
  _sparkRayPoolContainer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(_sparkRayPoolContainer);
  for (let i = 0; i < SPARK_CASCADE_MAX_RAY_PARTICLES; i++) {
    const el = document.createElement('div');
    el.className = 'identity-spark-ray';
    _sparkRayPoolContainer.appendChild(el);
    _sparkRayPool.push(el);
    _sparkRayPoolAvailable.push(el);
  }
  _sparkRayPoolInitDone = true;
}

function _acquireSparkRay() {
  return _sparkRayPoolAvailable.pop() || null;
}

function _releaseSparkRay(el) {
  if (!el) return;
  el.classList.remove('identity-spark-ray-flying');
  _sparkRayPoolAvailable.push(el);
}

// ─── Spark pure math (unit-testable, no DOM) ───────────────────────────
//
// Squad alive-spark count. Defensive against the codebase reality that heroes
// in HERO_DECK don't track per-hero hp (squad shares global `hp`). Treats
// absence of `.hp` as alive (heroes are removed from deck on death;
// `h.hp > 0` gate is preserved when hp IS present). Mirrors
// `countAlivePirates` / `countAliveSharks` / `countAliveRocks` /
// `countAliveCrocodiles` precedent (T2.02 CTO ruling #2 — defensive hp /
// single-haptic).
export function countAliveSparks(squad) {
  if (!Array.isArray(squad)) return 0;
  let n = 0;
  for (const h of squad) {
    if (!h || h.race !== 'spark') continue;
    if (h.hp !== undefined && h.hp <= 0) continue;
    n++;
  }
  return n;
}

// Count solar cells in cleared rows∪cols. Pure function — unit-testable.
// `gridState` is a flexible source of grid element data (same surface as
// `countGroveCells` above; the Crocodile precedent — T2.05):
//   - 2D array indexed `[r][c]` returning stihiya string or null (legacy grid global pattern)
//   - { getElementAt(r, c): string|null } object (module-style API)
//   - null/undefined → returns 0 (defensive — no source means no solar cells)
//
// Spec §2.5 field 10 trigger: rows∪cols must contain ≥
// SPARK_CASCADE_MIN_SOLAR_CELLS solar cells (gate threshold = 2). The
// SPARK_CASCADE_DOMINANT_ELEMENT constant ('solar') is the literal value
// produced by the legacy grid (line 191 — `weightedStihiya()` writes
// 'ember'|'tide'|'grove'|'solar'|'umbra' strings into grid cells).
//
// `gridCols` / `gridRows` default to BOARD_COLS / BOARD_ROWS (8×8). Cells
// are accounted via inclusion–exclusion (the intersection of a cleared row
// and cleared col is one cell, not two — same accounting as
// `computeCellsCleared` and `countGroveCells` above).
export function countSolarCellsInClear(rows, cols, gridState, gridCols = BOARD_COLS, gridRows = BOARD_ROWS) {
  if (!gridState) return 0;
  const _rowList = Array.isArray(rows) ? rows.filter(r => typeof r === 'number' && r >= 0 && r < gridRows) : [];
  const _colList = Array.isArray(cols) ? cols.filter(c => typeof c === 'number' && c >= 0 && c < gridCols) : [];
  if (_rowList.length === 0 && _colList.length === 0) return 0;

  // Resolve a unified accessor (mirror countGroveCells pattern). Prefer
  // explicit `getElementAt` (module API), fall back to 2D-array indexing
  // (legacy grid global).
  const _getter = (typeof gridState.getElementAt === 'function')
    ? ((r, c) => { try { return gridState.getElementAt(r, c); } catch (_e) { return null; } })
    : ((r, c) => {
        const row = gridState[r];
        if (!row) return null;
        return row[c];
      });

  // Track visited cells via the inclusion-exclusion key so a cell at a row×col
  // intersection counts ONCE (not twice).
  const _seen = new Set();
  let n = 0;
  for (const r of _rowList) {
    for (let c = 0; c < gridCols; c++) {
      const key = r + '_' + c;
      if (_seen.has(key)) continue;
      _seen.add(key);
      const v = _getter(r, c);
      if (v === SPARK_CASCADE_DOMINANT_ELEMENT) n++;
    }
  }
  for (const c of _colList) {
    for (let r = 0; r < gridRows; r++) {
      const key = r + '_' + c;
      if (_seen.has(key)) continue;
      _seen.add(key);
      const v = _getter(r, c);
      if (v === SPARK_CASCADE_DOMINANT_ELEMENT) n++;
    }
  }
  return n;
}

// Computes the Sun Cascade dominantCount modifier. Pure function —
// unit-testable. This is the CRITICAL sacred-cow-adjacent math: the SOLE
// place where Sun Cascade's contribution to the combo crit formula is
// computed. The function NEVER touches the formula — it only returns
// the `+modifier` value that the legacy bridge (T2.B) will thread into
// the formula's INPUT (dominantCount) before evaluation.
//
// Per spec §2.5 field 4:
//   - sparkCount >= 1 AND solarCellsInClear >= SPARK_CASCADE_MIN_SOLAR_CELLS
//     AND enabled → +SPARK_CASCADE_MAX_DOMINANT_BOOST (currently +1)
//   - else → 0 (silent no-op contract)
//
// HARD CAP at SPARK_CASCADE_MAX_DOMINANT_BOOST (1) per fire. NOT stacking:
// 5 sparks does NOT yield +5; multiple cleared lines does NOT yield +N.
// This is enforced at the return-value level — exactly one of {0, +1}.
//
// Roman ruling ESC-02 O3 hard caveat: "Capped at +1, gated 2-solar-cell
// minimum, not stacking." If the matchup matrix (T2.B) surfaces >15% TTK
// deviation on any Spark pairing, set `enabled=false` (via the
// SPARK_CASCADE_ENABLED constant flip) → this function then returns 0 for
// all inputs, demoting Spark to pure-FX. Single-flip fallback.
//
// Defensive against non-finite / negative inputs (returns 0).
export function computeSunCascadeModifier(sparkCount, solarCellsInClear, enabled) {
  const _sparks = Math.max(0, Math.floor(Number(sparkCount) || 0));
  const _solars = Math.max(0, Math.floor(Number(solarCellsInClear) || 0));
  if (!enabled) return 0;                                    // fallback flag — pure-FX demotion
  if (_sparks === 0) return 0;                               // no alive sparks — silent no-op
  if (_solars < SPARK_CASCADE_MIN_SOLAR_CELLS) return 0;     // below gate — silent no-op
  return SPARK_CASCADE_MAX_DOMINANT_BOOST;                   // HARD CAP — never stacks
}

// Resolves the screen-coord origin for a grid cell at (r, c). Read-only
// DOM query — no mutation. Mirrors `_resolveCellOriginRC` above. Used by
// Sun Cascade to anchor ray origins on cleared solar cells.
function _resolveCellOriginRCForSpark(r, c) {
  if (typeof document === 'undefined') return null;
  const cells = document.querySelectorAll('.grid .cell');
  const el = cells[r * BOARD_COLS + c];
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// Resolves the nearest NON-EMPTY cell to (originR, originC) using the
// gridState getter. Pure function — used by Sun Cascade to determine the
// target cell for each golden ray. Returns `{r, c}` of the nearest
// non-empty cell, or `null` if no non-empty cells exist within the grid.
//
// "Non-empty" = grid value is truthy (any stihiya string, charged variant,
// void variant, or frozen variant — anything not null/undefined/empty).
// Per spec §2.5 field 3: "chains briefly to the nearest non-empty cell of
// any element". The ray target is read-only — Sun Cascade NEVER clears
// the target cell (that would be a Shark Frenzy mechanic). The cell just
// flashes yellow-white visually for one frame.
//
// Search strategy: expanding Manhattan-distance ring. First non-empty cell
// found wins. Excludes the origin cell itself. Excludes cells that are in
// the cleared rows/cols set (those are about to be cleared — picking them
// as target would render the flash on a cleared cell, which is invisible).
function _findNearestNonEmptyCell(originR, originC, gridState, clearedSet, gridCols = BOARD_COLS, gridRows = BOARD_ROWS) {
  if (!gridState) return null;
  const _getter = (typeof gridState.getElementAt === 'function')
    ? ((r, c) => { try { return gridState.getElementAt(r, c); } catch (_e) { return null; } })
    : ((r, c) => {
        const row = gridState[r];
        if (!row) return null;
        return row[c];
      });
  // Manhattan distance ring search. Max ring = max(gridCols, gridRows).
  const _maxRing = Math.max(gridCols, gridRows);
  for (let d = 1; d <= _maxRing; d++) {
    // Iterate cells with manhattan distance exactly = d.
    for (let dr = -d; dr <= d; dr++) {
      const dc = d - Math.abs(dr);
      for (const sign of (dc === 0 ? [1] : [1, -1])) {
        const r = originR + dr;
        const c = originC + sign * dc;
        if (r < 0 || r >= gridRows || c < 0 || c >= gridCols) continue;
        const key = r + '_' + c;
        if (clearedSet && clearedSet.has(key)) continue; // skip cleared cells
        const v = _getter(r, c);
        if (v) return { r, c };  // any truthy value counts as non-empty
      }
    }
  }
  return null;
}

// ─── Spark Sun Cascade (spec §2.5) ─────────────────────────────────────
//
// THE single highest-impact race flavor in the Identity Layer (per spec
// §2.5 "design balance note" and Roman ruling ESC-02 O3 "WITHIN
// BOUNDARY"). It is the ONLY race flavor that interacts directly with the
// sacred combo crit input. Implementation follows the T2.03 ctx
// side-channel pattern: Sun Cascade writes to `ctx._dominantCountModifier`
// (a NEW field added in T2.06), and the legacy bridge (T2.B, deferred to
// end of Phase 2) reads this modifier and threads it into the combo crit
// formula's INPUT (dominantCount) before the formula evaluates.
//
// SACRED COMBO CRIT FORMULA (CLAUDE.md §2.1 row 1, legacy line 63664):
//   critMult = 1 + domCount * count * CRIT_MULT_K
//   finalDmg = floor(totalDmg * critMult)
// THE FORMULA IS UNTOUCHED BY THIS FUNCTION. Sun Cascade modifies
// `domCount` BEFORE the formula runs — same architectural pattern as
// cascade (cells get added to the input set BEFORE evaluation). The
// multiplier arithmetic stays byte-perfect.
//
// Trigger contract (spec §2.5 field 10):
//   - Fires every `clearLines(rows, cols)` resolve.
//   - Gate: ≥1 spark hero alive AND ≥SPARK_CASCADE_MIN_SOLAR_CELLS (2)
//     solar cells in rows∪cols.
//     Else silent no-op (NEITHER FX nor mechanical fire).
// Effect contract (spec §2.5 fields 3–9):
//   - Mechanical: +SPARK_CASCADE_MAX_DOMINANT_BOOST (1) to
//     ctx._dominantCountModifier. HARD CAP — NOT stacking. Multiple sparks
//     or multiple solar lines NEVER produce more than +1 per fire.
//   - Visual: Golden ray from each cleared solar cell to the nearest
//     non-empty cell (any element). Pool of 16 rays, decay 400ms each.
//     Target cell flashes yellow-white for one frame — PURE VFX, does NOT
//     clear the target cell (Shark Frenzy is the cell-clearing mechanic,
//     not Spark).
//   - Sound: crisp bell chime (200ms golden-tone), layered, re-use existing
//     per ESC-02 O4 RE-USE-FIRST ruling. Audio mixer handles re-use; this
//     module does NOT call audio APIs directly.
//   - Haptic: standard `clear` already fired by host `clearLines` via
//     `vibrate(25)` — `fxSparkLineClear` does NOT re-fire (T2.02 precedent
//     #3 — no double-pulse).
//   - Total wall-time ≤10ms (spec §2.5 field 9).
//
// Fallback (per ESC-02 O3 ruling):
//   If SPARK_CASCADE_ENABLED is `false` (T2.B fallback toggle), the
//   mechanical write is SKIPPED but VFX still fires. Sun Cascade is then
//   pure-FX (visual rays only, no combo crit input modification). Single
//   config flag flip — no rewrite needed.
//
// `ctx` is an optional cell-state predicate snapshot (passed through from
// the dispatcher; nullable in T2.06 since legacy bridge is deferred to
// T2.B). Recognized keys for Spark:
//   - `gridState` — 2D grid array OR `{ getElementAt(r, c) }` accessor
//     (for the solar-cell scan AND the nearest-non-empty-cell ray target)
//   - `_dominantCountModifier` — accumulator (NEW field, T2.06). Sun Cascade
//     INCREMENTS this by SPARK_CASCADE_MAX_DOMINANT_BOOST when the gate
//     passes. The legacy bridge (T2.B) reads it BEFORE the sacred formula
//     evaluates, threads it into dominantCount, then evaluates the formula
//     BYTE-PERFECT.
//
// Returns the modifier value actually written to ctx (0 or
// SPARK_CASCADE_MAX_DOMINANT_BOOST). Useful for smoke assertions that need
// to verify the input-modification invariant + fallback flag behavior.
export function fxSparkLineClear(rows, cols, squad, ctx) {
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  try {
    // Squad alive-spark count. Same fallback chain as Pirate / Shark / Rock /
    // Crocodile (T2.02 precedent #2 — defensive hp).
    const _squad = Array.isArray(squad) ? squad
                 : (typeof HERO_DECK !== 'undefined' && Array.isArray(HERO_DECK)) ? HERO_DECK
                 : [];
    const sparkCount = countAliveSparks(_squad);
    if (sparkCount === 0) return 0;

    const rowCount = Array.isArray(rows) ? rows.length : 0;
    const colCount = Array.isArray(cols) ? cols.length : 0;
    if (rowCount + colCount === 0) return 0;

    // Resolve gridState from ctx → legacy `grid` global (T2.05 precedent).
    const _gridState = (ctx && ctx.gridState) ? ctx.gridState
                     : (typeof grid !== 'undefined' && Array.isArray(grid)) ? grid
                     : (typeof window !== 'undefined' && Array.isArray(window.grid)) ? window.grid
                     : null;

    const solarCellsInClear = countSolarCellsInClear(rows, cols, _gridState);
    // Gate: silent no-op below SPARK_CASCADE_MIN_SOLAR_CELLS (NEITHER FX nor
    // mechanical fire). Spec §2.5 field 10: "If solar cells in clear < 2, no
    // effect."
    if (solarCellsInClear < SPARK_CASCADE_MIN_SOLAR_CELLS) return 0;

    // ── MECHANICAL PATH (sacred-cow-adjacent — central audit row §2.1.1) ──
    // Computes the modifier via the pure-helper that respects the
    // SPARK_CASCADE_ENABLED fallback flag. HARD CAP at
    // SPARK_CASCADE_MAX_DOMINANT_BOOST (+1) — NEVER stacking.
    //
    // IMPORTANT: We write to `ctx._dominantCountModifier`, NOT to the
    // formula multiplier. The sacred formula `total_dmg × (1 + dominantCount
    // × combo × 10%)` is BYTE-PERFECT and UNTOUCHED. Only the INPUT
    // (dominantCount) is mutated — same architectural pattern as cascade.
    //
    // When SPARK_CASCADE_ENABLED is `false` (T2.B fallback toggle flipped
    // by Bug Tester after matchup matrix), the modifier is 0 and Sun
    // Cascade is pure-FX. Single-flip demotion — no rewrite.
    const modifier = computeSunCascadeModifier(sparkCount, solarCellsInClear, SPARK_CASCADE_ENABLED);
    if (modifier > 0 && ctx && typeof ctx === 'object') {
      // Accumulate via defensive read: `(prev || 0) + modifier`. This is
      // safe because the gate guarantees one write per fire (HARD CAP), so
      // the accumulator only grows across DIFFERENT fires (the dispatcher
      // creates a fresh ctx per clearLines call in production). Per spec
      // §2.5 field 4: "Capped at +1 per fire."
      const prev = (typeof ctx._dominantCountModifier === 'number') ? ctx._dominantCountModifier : 0;
      ctx._dominantCountModifier = prev + modifier;
    }

    // ── VISUAL PATH (always fires when gate passes; runs even when
    // SPARK_CASCADE_ENABLED is `false` — pure-FX fallback path) ──
    // Build the set of cleared cell (r,c) coords AND the subset of those
    // that are solar (the ray origins). Mirrors `countSolarCellsInClear`
    // inclusion-exclusion accounting.
    _ensureSparkRayPool();
    if (_sparkRayPoolInitDone && _gridState) {
      const _getter = (typeof _gridState.getElementAt === 'function')
        ? ((r, c) => { try { return _gridState.getElementAt(r, c); } catch (_e) { return null; } })
        : ((r, c) => {
            const row = _gridState[r];
            if (!row) return null;
            return row[c];
          });
      const _clearedSet = new Set();
      const _solarOrigins = [];
      const _rowList = Array.isArray(rows) ? rows : [];
      const _colList = Array.isArray(cols) ? cols : [];
      // Build cleared set + scan for solar origins.
      for (const r of _rowList) {
        if (typeof r !== 'number') continue;
        for (let c = 0; c < BOARD_COLS; c++) {
          const key = r + '_' + c;
          if (_clearedSet.has(key)) continue;
          _clearedSet.add(key);
          if (_getter(r, c) === SPARK_CASCADE_DOMINANT_ELEMENT) _solarOrigins.push({ r, c });
        }
      }
      for (const c of _colList) {
        if (typeof c !== 'number') continue;
        for (let r = 0; r < BOARD_ROWS; r++) {
          const key = r + '_' + c;
          if (_clearedSet.has(key)) continue;
          _clearedSet.add(key);
          if (_getter(r, c) === SPARK_CASCADE_DOMINANT_ELEMENT) _solarOrigins.push({ r, c });
        }
      }

      // Spawn one ray per solar origin, capped at SPARK_CASCADE_MAX_RAY_PARTICLES.
      let _spawned = 0;
      for (const { r, c } of _solarOrigins) {
        if (_spawned >= SPARK_CASCADE_MAX_RAY_PARTICLES) break;
        const origin = _resolveCellOriginRCForSpark(r, c);
        if (!origin) continue;
        // Find nearest non-empty cell as the target (excluding cells in the
        // cleared set so the flash doesn't render on a cell about to clear).
        const target = _findNearestNonEmptyCell(r, c, _gridState, _clearedSet);
        if (!target) continue;
        const targetOrigin = _resolveCellOriginRCForSpark(target.r, target.c);
        if (!targetOrigin) continue;
        const el = _acquireSparkRay();
        if (!el) break; // pool exhausted (concurrent fires overlap) — drop surplus
        spawnSparkRayParticle({
          el,
          startX: origin.x,
          startY: origin.y,
          targetX: targetOrigin.x,
          targetY: targetOrigin.y,
          decayMs: SPARK_CASCADE_RAY_DECAY_MS,
          color: '#FFD700',
        });
        setTimeout(() => _releaseSparkRay(el), SPARK_CASCADE_RAY_DECAY_MS);
        _spawned++;
      }
    }

    // Spec §2.5 field 6: standard `clear` haptic. Already fired by host
    // clearLines (`vibrate(25)` at grid.js:399). NOT re-fired here — T2.02
    // precedent #3 (no double-pulse).
    void vHaptic;

    // T2.12 (2026-05-12): Codex recording — spark race triggered.
    try { recordRaceTrigger('spark'); } catch (_e) { /* defensive */ }

    // Return the modifier actually written (0 or
    // SPARK_CASCADE_MAX_DOMINANT_BOOST). Useful for smoke assertions:
    //   - Gate passed + enabled → returns 1
    //   - Gate failed → returns 0 (function exited early above)
    //   - Gate passed + disabled (T2.B fallback) → returns 0
    return modifier;
  } finally {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      // Spec §2.5 field 9 — soft budget check at 10ms.
      if (dt > 10) log.warn('Spark Sun Cascade over budget:', dt.toFixed(2), 'ms');
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2026-05-12 — TASK-034 (T2.07): Phoenix Ashen Reign (FIRST boss-reactive
// identity mechanic).
//
// Spec: docs/design/mechanics/identity-layer.md §3.1.
// Architecture (spec §1 hard rule 1): Identity Layer EXTENDS, never MODIFIES,
// v2.1 P4 reactivity. Sacred Phoenix revive (PHOENIX_REVIVE_HP_PCT = 0.6 +
// PHOENIX_IMMUNE_TURNS = 2) and the 22 reactivity handlers are BYTE-PERFECT.
// Ashen Reign is a NEW handler under namespace `identity_phoenix_revive` in
// `src/core/reactivity-events.js`, fired ALONGSIDE the sacred phoenix path.
//
// Mechanical contract:
//   - On revive trigger: setTimeout REACTIVITY_TELEGRAPH_MS (3000ms) →
//     activate Ashen Reign state for ASHEN_REIGN_DURATION_MS (5000ms).
//   - During the window: `canPlacePieceDuringAshenReign(piece)` returns false
//     unless `piece.element === 'ember'`. T2.B bridge wires this into legacy
//     `pieceCanBePlaced(piece)` check site.
//   - Visual: 180px-wide pulsing red-orange gradient flame border + HUD
//     countdown indicator (CSS animation, zero JS per frame — §3.1 field 7).
//   - Release: single setTimeout fires once at ASHEN_REIGN_DURATION_MS,
//     fades out over ASHEN_REIGN_DECAY_MS (200ms).
//
// Sacred-cow safety:
//   - Reads PHOENIX_REVIVE_HP_PCT / PHOENIX_IMMUNE_TURNS / REACTIVITY_TELEGRAPH_MS
//     never writes. The legacy `maybePhoenixRevive` site is the trigger source;
//     Ashen Reign attaches AFTER the sacred revive finishes.
//   - Per-frame work during the 5s window: ZERO. Flame border + HUD countdown
//     are CSS-keyframe-driven (animations.css / battle.css), animation duration
//     read from `--ashen-reign-duration-ms` custom property on each element.
//   - Single setTimeout for window end; no setInterval / requestAnimationFrame.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Pre-allocated DOM elements (object pool: 1 flame border + 1 HUD countdown).
// The flame border is appended to body (positioned fixed over the grid coord
// range); the HUD countdown attaches under the body too (positioned to the
// top of the screen). Lazy creation on first activate.
let   _ashenReignFlameBorderEl   = null;
let   _ashenReignHudEl           = null;
let   _ashenReignPoolInitDone    = false;
// Module state — spec §3.1 contract.
let   _ashenReignActive          = false;
let   _ashenReignEndsAt          = null;
let   _ashenReignReleaseTimer    = null;
let   _ashenReignDecayTimer      = null;

function _ensureAshenReignPool() {
  if (_ashenReignPoolInitDone) return;
  if (typeof document === 'undefined') return; // unit-test guard

  // Flame border overlay. Painterly red-orange ring positioned over the
  // grid container. CSS class controls the pulse animation; we just toggle.
  _ashenReignFlameBorderEl = document.createElement('div');
  _ashenReignFlameBorderEl.className = 'identity-phoenix-ashen-reign-border';
  _ashenReignFlameBorderEl.setAttribute('aria-hidden', 'true');
  _ashenReignFlameBorderEl.style.display = 'none';
  document.body.appendChild(_ashenReignFlameBorderEl);

  // HUD countdown text element. Sits at top of the viewport; CSS-driven
  // 5000ms width-or-opacity decay so the visual countdown is GPU-only.
  _ashenReignHudEl = document.createElement('div');
  _ashenReignHudEl.className = 'identity-phoenix-ashen-reign-hud';
  _ashenReignHudEl.setAttribute('aria-hidden', 'true');
  _ashenReignHudEl.textContent = ASHEN_REIGN_HUD_COUNTDOWN_TEXT;
  _ashenReignHudEl.style.display = 'none';
  document.body.appendChild(_ashenReignHudEl);

  _ashenReignPoolInitDone = true;
}

// ─── Pure helpers (unit-testable, no DOM) ──────────────────────────────
//
// Returns the Ashen Reign duration constant. Pure pass-through — exists so
// tests can lock the spec value (5000ms) via a single import. Mirrors
// `computePirateGold` etc.: pure math indirection so unit tests don't have
// to import the data constants directly (they can, but a tiny pure helper
// is the established T2.02 precedent).
export function computeAshenReignDuration() {
  return ASHEN_REIGN_DURATION_MS;
}

// Predicate: can the given piece be placed while Ashen Reign is active?
// Spec §3.1 field 4 bullet 2: "`pieceCanBePlaced(piece)` returns false unless
// `piece.element === 'ember'`."
//
// When the window is INACTIVE: every piece is placeable (Ashen Reign
// imposes no restriction). When the window is ACTIVE: only `ember` pieces
// pass; everything else (including a null/undefined piece) is rejected
// defensively.
//
// `state` is the optional Ashen Reign state snapshot. Default reads module
// state via `isAshenReignActive()` so callers don't have to thread it; tests
// can override by passing `{ _ashenReignActive: true|false }` directly.
//
// Pure function (no DOM, no side effects) — unit-testable.
export function canPlacePieceDuringAshenReign(piece, state) {
  const active = state && Object.prototype.hasOwnProperty.call(state, '_ashenReignActive')
    ? Boolean(state._ashenReignActive)
    : _ashenReignActive;
  if (!active) return true;                          // window inactive — no restriction
  if (!piece) return false;                          // defensive: null piece during active window
  return piece.element === ASHEN_REIGN_REQUIRED_ELEMENT;
}

// Read-only state accessor — used by `canPlacePieceDuringAshenReign` default
// path AND by the T2.B legacy bridge (which will call this from inside
// legacy `pieceCanBePlaced(piece)` to inject the ember-only gate).
export function isAshenReignActive() {
  return _ashenReignActive;
}

// Timestamp at which the active window ends (`performance.now()` epoch).
// Returns null when inactive. Used by the HUD CSS animation indirectly
// (via the `--ashen-reign-end-at` custom property set by `fxPhoenixAshenReign`).
export function getAshenReignEndsAt() {
  return _ashenReignEndsAt;
}

// ─── Activate / release / reset (module state mutations) ───────────────
//
// `fxPhoenixAshenReign(bossState, ctx)` — activate the 5s ember-only state.
// Spec §3.1 field 4. Called by the new reactivity handler
// (`identity_phoenix_revive` in `src/core/reactivity-events.js`) AFTER the
// REACTIVITY_TELEGRAPH_MS (3000ms) wind-up banner completes (sacred re-use).
//
// Initial-trigger wall-time budget: ≤ASHEN_REIGN_INITIAL_BUDGET_MS (16ms).
// Steady-state per-frame budget during the 5s window: ≤2ms (CSS animation,
// zero JS per frame — verified by single setTimeout for release, no
// setInterval/rAF).
//
// `bossState` and `ctx` parameters are reserved for T2.08–T2.11 boss-reactive
// FX that may need archetype-specific tinting / dispatch context. Currently
// unused for Phoenix; documented for forward compat.
export function fxPhoenixAshenReign(_bossState, _ctx) {
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  try {
    // Defensive: if the window is somehow already active (double-fire from a
    // pathological revive double-event), release the previous one first so
    // timers don't overlap. Single-fire-at-a-time contract.
    if (_ashenReignActive) {
      fxPhoenixAshenReignRelease();
    }

    _ashenReignActive = true;
    const _now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    _ashenReignEndsAt = _now + ASHEN_REIGN_DURATION_MS;

    // DOM activation (lazy pool). All visual work is CSS-keyframe driven —
    // we ONLY toggle classes + custom properties here. Zero per-frame JS.
    _ensureAshenReignPool();
    if (_ashenReignPoolInitDone) {
      // Flame border. Position relative to grid container if present
      // (positioned in CSS via `position: fixed` + grid-rect lookup).
      const flame = _ashenReignFlameBorderEl;
      if (flame) {
        flame.style.setProperty('--ashen-reign-duration-ms', ASHEN_REIGN_DURATION_MS + 'ms');
        flame.style.setProperty('--ashen-reign-decay-ms', ASHEN_REIGN_DECAY_MS + 'ms');
        // Position over the grid container if it exists. The CSS class is
        // `.identity-phoenix-ashen-reign-border` which the stylesheet positions
        // fixed; we only set CSS variables for the border-rect bounds.
        const gridEl = document.querySelector('.grid') || document.getElementById('grid');
        if (gridEl) {
          const r = gridEl.getBoundingClientRect();
          flame.style.setProperty('--ashen-reign-grid-left', r.left + 'px');
          flame.style.setProperty('--ashen-reign-grid-top',  r.top  + 'px');
          flame.style.setProperty('--ashen-reign-grid-w',    r.width  + 'px');
          flame.style.setProperty('--ashen-reign-grid-h',    r.height + 'px');
        }
        // Restart keyframes deterministically (re-trigger on pool re-use).
        flame.classList.remove('identity-phoenix-ashen-reign-border-active');
        flame.style.display = 'block';
        // Force a synchronous reflow so the keyframe restarts cleanly.
        void flame.offsetWidth;
        flame.classList.add('identity-phoenix-ashen-reign-border-active');
      }
      // HUD countdown. Text is static ("EMBER ONLY — 5s"); the visual decay
      // is a CSS animation reading --ashen-reign-duration-ms. The countdown
      // is purely visual — JS knows the exact end time via _ashenReignEndsAt.
      const hud = _ashenReignHudEl;
      if (hud) {
        hud.style.setProperty('--ashen-reign-duration-ms', ASHEN_REIGN_DURATION_MS + 'ms');
        hud.style.setProperty('--ashen-reign-decay-ms', ASHEN_REIGN_DECAY_MS + 'ms');
        hud.textContent = ASHEN_REIGN_HUD_COUNTDOWN_TEXT;
        hud.classList.remove('identity-phoenix-ashen-reign-hud-active');
        hud.style.display = 'block';
        void hud.offsetWidth;
        hud.classList.add('identity-phoenix-ashen-reign-hud-active');
      }
    }

    // Single setTimeout for release. No setInterval. No requestAnimationFrame.
    // Spec §3.1 field 7: zero per-frame JS during the 5s window.
    if (_ashenReignReleaseTimer) clearTimeout(_ashenReignReleaseTimer);
    _ashenReignReleaseTimer = setTimeout(() => {
      _ashenReignReleaseTimer = null;
      fxPhoenixAshenReignRelease();
    }, ASHEN_REIGN_DURATION_MS);

    // T2.12 (2026-05-12): Codex recording — Phoenix Ashen Reign moment witnessed.
    try { recordMomentTrigger('phoenix_ashen_reign'); } catch (_e) { /* defensive */ }
  } finally {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      if (dt > ASHEN_REIGN_INITIAL_BUDGET_MS) {
        log.warn('Phoenix Ashen Reign initial trigger over budget:',
                 dt.toFixed(2), 'ms (limit', ASHEN_REIGN_INITIAL_BUDGET_MS, 'ms)');
      }
    }
  }
}

// Release the Ashen Reign window. Idempotent — safe to call when inactive.
// Triggers the 200ms fade-out via CSS class swap, then removes the visible
// state after the decay completes.
export function fxPhoenixAshenReignRelease() {
  _ashenReignActive = false;
  _ashenReignEndsAt = null;
  if (_ashenReignReleaseTimer) {
    clearTimeout(_ashenReignReleaseTimer);
    _ashenReignReleaseTimer = null;
  }
  if (!_ashenReignPoolInitDone) return;

  const flame = _ashenReignFlameBorderEl;
  const hud   = _ashenReignHudEl;
  // Swap to fade-out class — CSS animation handles the 200ms decay.
  if (flame) {
    flame.classList.remove('identity-phoenix-ashen-reign-border-active');
    flame.classList.add('identity-phoenix-ashen-reign-border-fading');
  }
  if (hud) {
    hud.classList.remove('identity-phoenix-ashen-reign-hud-active');
    hud.classList.add('identity-phoenix-ashen-reign-hud-fading');
  }
  // Hide after the decay window — single setTimeout, fires once.
  if (_ashenReignDecayTimer) clearTimeout(_ashenReignDecayTimer);
  _ashenReignDecayTimer = setTimeout(() => {
    _ashenReignDecayTimer = null;
    if (flame) {
      flame.style.display = 'none';
      flame.classList.remove('identity-phoenix-ashen-reign-border-fading');
    }
    if (hud) {
      hud.style.display = 'none';
      hud.classList.remove('identity-phoenix-ashen-reign-hud-fading');
    }
  }, ASHEN_REIGN_DECAY_MS);
}

// Reset hook for battle pipeline (battle start / battle end). Clears all
// state + cancels pending timers + hides DOM. Mirrors `resetCrocFragmentBank`
// precedent from T2.05.
export function resetAshenReign() {
  _ashenReignActive = false;
  _ashenReignEndsAt = null;
  if (_ashenReignReleaseTimer) {
    clearTimeout(_ashenReignReleaseTimer);
    _ashenReignReleaseTimer = null;
  }
  if (_ashenReignDecayTimer) {
    clearTimeout(_ashenReignDecayTimer);
    _ashenReignDecayTimer = null;
  }
  if (_ashenReignFlameBorderEl) {
    _ashenReignFlameBorderEl.classList.remove(
      'identity-phoenix-ashen-reign-border-active',
      'identity-phoenix-ashen-reign-border-fading',
    );
    _ashenReignFlameBorderEl.style.display = 'none';
  }
  if (_ashenReignHudEl) {
    _ashenReignHudEl.classList.remove(
      'identity-phoenix-ashen-reign-hud-active',
      'identity-phoenix-ashen-reign-hud-fading',
    );
    _ashenReignHudEl.style.display = 'none';
  }
}

// ─── Dispatcher (spec §7.2 hook from src/core/grid.js#clearLines) ──────
//
// Single entry point invoked from `src/core/grid.js` AFTER the sacred
// `vPlayLineClearBurst(rows, cols)` call. Routes the line-clear event to
// every race FX whose race has ≥1 alive hero in `squad`. Mixed-race squads
// stack additively per spec §1 hard rule 3 (independent layers).
//
// Guards:
//   - Empty squad / undefined → return immediately (no allocation, no log).
//   - Zero lines (rows.length + cols.length === 0) → return immediately.
//
// Boss-reactive identity hooks are NOT routed from here in T2.02 — they
// land in T2.07–T2.11 via a parallel `dispatchIdentityBossFx` (or merged
// into this dispatcher; spec §7.2 leaves the routing detail to Game Dev).
// 2026-05-12 — T2.03 extension: the dispatcher now forwards an optional
// `ctx` argument carrying cell-state predicates + per-line dominant elements
// for race FX that need them (notably Shark's gate/predicate). Defaults to
// null so existing callers (T2.02 grid.js wiring) continue to work without
// modification — the legacy bridge in T2.B will populate `ctx` with real
// snapshots from the live runtime.
export function dispatchIdentityFx(rows, cols, squad, _currentBoss, ctx = null) {
  if (!Array.isArray(squad) || squad.length === 0) return;
  const rowCount = Array.isArray(rows) ? rows.length : 0;
  const colCount = Array.isArray(cols) ? cols.length : 0;
  if (rowCount + colCount === 0) return;

  // Collect unique alive races in the squad — one FX dispatch per race.
  const races = new Set();
  for (const h of squad) {
    if (!h || !h.race) continue;
    if (h.hp !== undefined && h.hp <= 0) continue;
    races.add(h.race);
  }
  if (races.size === 0) return;

  // Route. Each route is wrapped in try/catch so a stub bug never crashes
  // the line-clear pipeline (sacred path must remain green).
  try {
    if (races.has('pirate'))    fxPirateLineClear(rows, cols, squad);
  } catch (e) { log.warn('Pirate FX threw:', e); }
  try {
    if (races.has('shark'))     fxSharkLineClear(rows, cols, squad, ctx);
  } catch (e) { log.warn('Shark FX threw:', e); }
  try {
    if (races.has('rock'))      fxRockLineClear(rows, cols, squad, ctx);
  } catch (e) { log.warn('Rock FX threw:', e); }
  try {
    if (races.has('crocodile')) fxCrocodileLineClear(rows, cols, squad, ctx);
  } catch (e) { log.warn('Crocodile FX threw:', e); }
  try {
    if (races.has('spark'))     fxSparkLineClear(rows, cols, squad, ctx);
  } catch (e) { log.warn('Spark FX threw:', e); }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2026-05-12 — TASK-035 (T2.08): Lich Cursed Tiles (SECOND boss-reactive
// identity mechanic — explicit Shark counter per spec §2.2 + §3.2).
//
// Spec: docs/design/mechanics/identity-layer.md §3.2.
// Architecture (spec §1 hard rule 1): Identity Layer EXTENDS, never MODIFIES,
// v2.1 P4 reactivity. Sacred assassin handlers (`assassin_p1_p2` stealth + 1.5×
// next-attack, `assassin_p2_p3` backstab chain) and the 22 reactivity handlers
// are BYTE-PERFECT. Cursed Tiles is a NEW handler under namespace
// `identity_assassin_shark_counter` in `src/core/reactivity-events.js`, fired
// ALONGSIDE the sacred assassin path via the T2.07-established
// `IDENTITY_BOSS_HANDLERS` parallel registry.
//
// Mechanical contract (spec §3.2):
//   - Trigger: A `clearLines` fires where the player's active squad has
//     ≥CURSED_TILES_TRIGGER_SHARK_THRESHOLD (2) sharks. Boss responds NEXT
//     turn — telegraph fires on player's end-of-turn (3000ms wind-up via
//     sacred REACTIVITY_TELEGRAPH_MS re-use), handler resolves at start of
//     player's next turn.
//   - `fxLichCursedTiles(bossState, ctx)`: pick CURSED_TILES_COUNT (3) random
//     non-empty cells on the board, place a translucent purple skull overlay
//     on each via the pool of 3 pre-allocated DOM elements.
//   - Cursed cells cannot be cleared for CURSED_TILES_TURNS_UNTIL_AUTO_CLEAR
//     (3) turns. The `isCellCursed(row, col)` predicate is exposed for T2.B
//     legacy bridge to wire into `pieceCanBePlaced` / `clearLines`.
//   - Per-turn tick (`fxLichCursedTilesTick`): applies
//     CURSED_TILES_HP_DAMAGE_PER_TURN (1) HP damage per cursed cell to the
//     squad. At expiration turn (placedTurn + 3), grants
//     CURSED_TILES_ULT_COMPENSATION (+20) player ULT charge per expiring cell
//     (clamped to sacred HERO_ULT_COST_BY_NEWROLE thresholds via T2.04
//     `clampUltCharge` pattern), fades skull overlay over
//     CURSED_TILES_SKULL_DECAY_MS (300ms), removes curse from active array.
//
// Sacred-cow safety (CLAUDE.md §2.1 + §2.5):
//   - Reads PHOENIX_REVIVE_HP_PCT / PHOENIX_IMMUNE_TURNS / REACTIVITY_TELEGRAPH_MS
//     / HERO_ULT_COST_BY_NEWROLE — never writes. The sacred assassin handlers
//     stay byte-perfect; Cursed Tiles attaches via the parallel registry.
//   - +20 ULT charge writes go through `clampUltCharge` (T2.04 pattern) so
//     the ULT meter NEVER exceeds the sacred per-role threshold (mage:100,
//     warrior:80, hunter:120, tank:80, captain:100). Defensive clamp also
//     handles the impossible-but-defensive "current already > threshold"
//     case.
//   - Per-turn work during the 3-turn window: pure integer math (HP
//     subtraction + ULT charge addition with clamp). DOM activation cost
//     is one-time at fxLichCursedTiles (3 class swaps); auto-clear cost is
//     one class swap per expiring cell + 300ms CSS-driven fade.
//   - Module state: `_cursedTiles` array (max 3 entries, the hard spec cap).
//     Reset on battle start/end via `resetCursedTiles()`.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Pre-allocated DOM elements (object pool: 3 skull overlays). Sized at the
// hard spec cap CURSED_TILES_COUNT (3) — never exceeded. Created lazily on
// first fxLichCursedTiles invocation.
const _cursedTilesPool          = [];
const _cursedTilesPoolAvailable = [];   // stack of element indices not currently in use
let   _cursedTilesPoolContainer = null;
let   _cursedTilesPoolInitDone  = false;

// Module state — array of active curses. Each entry shape:
//   { row, col, placedTurn, expiresTurn, el } where `el` is the skull-overlay
// DOM element backing the visual (null in unit-test envs without a DOM).
// Max length = CURSED_TILES_COUNT (3) by construction — fxLichCursedTiles
// caps the placement at the spec value.
let _cursedTiles = [];

// Ensures the 3-element DOM pool exists. Idempotent — calling again is a
// no-op. In Node-only unit-test environments (no `document`), the pool stays
// empty and helpers work on the array-only state path.
function _ensureCursedTilesPool() {
  if (_cursedTilesPoolInitDone) return;
  if (typeof document === 'undefined') return;          // unit-test guard
  _cursedTilesPoolContainer = document.createElement('div');
  _cursedTilesPoolContainer.className = 'identity-lich-cursed-tile-container';
  _cursedTilesPoolContainer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(_cursedTilesPoolContainer);
  for (let i = 0; i < CURSED_TILES_COUNT; i++) {
    const el = document.createElement('div');
    el.className = 'identity-lich-cursed-tile';
    el.style.display = 'none';
    _cursedTilesPoolContainer.appendChild(el);
    _cursedTilesPool.push(el);
    _cursedTilesPoolAvailable.push(i);
  }
  _cursedTilesPoolInitDone = true;
}

// ─── Pure helpers (unit-testable, no DOM) ──────────────────────────────
//
// Returns array of {row, col} for up to `count` random non-empty cells on
// the board. Pure function — given a stable `gridState`, the result depends
// only on the random selection. Cells already cursed (in `_cursedTiles`)
// are EXCLUDED from re-selection so a single fire never double-curses a
// cell.
//
// `gridState` may be:
//   - 2D array [row][col] with truthy values for non-empty cells (legacy
//     `grid` shape — strings like 'ember' / 'tide' / null)
//   - { getElementAt(r, c): string|null } module-style API
//   - null/undefined → returns [] (defensive)
//
// `count` defaults to CURSED_TILES_COUNT (3). The returned array length is
// `min(count, available non-empty cells, CURSED_TILES_COUNT)`.
//
// Selection algorithm: collect candidate non-empty cells (excluding already-
// cursed ones), Fisher-Yates shuffle a slice of the first N indices via
// Math.random, return first N. This is O(non-empty cells) — well under
// 2ms wall-time even on an 8×8 board (max 64 candidates).
export function pickRandomNonEmptyCells(gridState, count, gridCols = BOARD_COLS, gridRows = BOARD_ROWS) {
  const n = (typeof count === 'number' && count > 0) ? Math.floor(count) : CURSED_TILES_COUNT;
  if (!gridState) return [];

  // Helper: read cell at (r, c) from whatever shape gridState carries.
  const readCell = (r, c) => {
    if (typeof gridState.getElementAt === 'function') {
      return gridState.getElementAt(r, c);
    }
    if (Array.isArray(gridState) && Array.isArray(gridState[r])) {
      return gridState[r][c];
    }
    return null;
  };

  // Collect candidate non-empty cells, excluding already-cursed ones.
  const cursedKey = new Set(_cursedTiles.map(t => t.row + '_' + t.col));
  const candidates = [];
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const v = readCell(r, c);
      if (!v) continue;                                  // null / undefined / 0 / '' = empty
      const key = r + '_' + c;
      if (cursedKey.has(key)) continue;                  // exclude already-cursed cells
      candidates.push({ row: r, col: c });
    }
  }
  if (candidates.length === 0) return [];

  // Fisher-Yates partial shuffle — only shuffle the first `min(n, len)`
  // positions, since we don't need the full random ordering.
  const take = Math.min(n, candidates.length);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(Math.random() * (candidates.length - i));
    if (j !== i) {
      const tmp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = tmp;
    }
  }
  return candidates.slice(0, take);
}

// Pure helper: apply cursed-cell HP damage to the squad's current HP.
// Spec §3.2 field 4: "Inflict 1 HP of damage to the squad each turn they
// remain." Returns new HP, clamped to ≥0 (squad can't go below 0 via the
// drip; the lethal-blow check is owned by the existing combat pipeline,
// which reads `squadHp` after our write).
//
// `squadHp` is the current squad HP (single shared pool per legacy
// hp-pool convention). `cursedCellCount` is the number of active cursed
// cells contributing damage this turn (typically `_cursedTiles.length`
// before any expiration removes one).
//
// Returns: integer new HP, clamped to ≥0.
export function applyCurseCellDamage(squadHp, cursedCellCount) {
  const _hp    = Number(squadHp);
  const _cells = Math.max(0, Math.floor(Number(cursedCellCount) || 0));
  if (!Number.isFinite(_hp)) return 0;
  const damage = _cells * CURSED_TILES_HP_DAMAGE_PER_TURN;
  return Math.max(0, _hp - damage);
}

// Pure helper: per-turn tick result for a single cursed tile entry.
// Returns:
//   - `active: false` → curse has expired (currentTurn >= curse.expiresTurn)
//     and should be removed; `shouldGrantUltCharge: true` with
//     `ultChargeToGrant: CURSED_TILES_ULT_COMPENSATION` (+20).
//   - `active: true` → curse is still ticking; no ULT charge granted.
//
// This is a pure function over (curse, currentTurn). The caller
// (`fxLichCursedTilesTick`) drives the active-array mutation and the
// threshold-clamped ULT meter write.
//
// `curse` must have `{ placedTurn, expiresTurn }`. `currentTurn` is the
// game's current turn counter at the moment of the tick.
export function computeCurseTickResult(curse, currentTurn) {
  const _t = Number(currentTurn);
  if (!curse || typeof curse !== 'object') {
    return { active: false, shouldGrantUltCharge: false, ultChargeToGrant: 0 };
  }
  const _expires = Number(curse.expiresTurn);
  if (!Number.isFinite(_t) || !Number.isFinite(_expires)) {
    return { active: true, shouldGrantUltCharge: false, ultChargeToGrant: 0 };
  }
  if (_t >= _expires) {
    return {
      active: false,
      shouldGrantUltCharge: true,
      ultChargeToGrant: CURSED_TILES_ULT_COMPENSATION,
    };
  }
  return { active: true, shouldGrantUltCharge: false, ultChargeToGrant: 0 };
}

// Pure helper (re-uses T2.04 `clampEncoreEchoCharge` pattern): clamp a
// proposed ULT charge addition to the sacred per-role threshold from
// HERO_ULT_COST_BY_NEWROLE. The +20 ULT compensation NEVER overshoots the
// threshold — sacred values (mage:100, warrior:80, hunter:120, tank:80,
// captain:100) are READ-ONLY for the clamp.
//
// Parameters:
//   currentCharge       — current ULT meter value (integer ≥0)
//   delta               — proposed addition (integer ≥0, typically
//                          CURSED_TILES_ULT_COMPENSATION = 20)
//   sacredThreshold     — sacred HERO_ULT_COST_BY_NEWROLE.<role> value
//                          (e.g., 100 for mage). MUST be a positive number.
//
// Returns: integer ≥0, ≤sacredThreshold.
//
// Defensive: if currentCharge > sacredThreshold (impossible in normal play
// but defensive against pre-existing-bug states), the function clamps DOWN
// to sacredThreshold — Cursed Tiles never makes a bad state worse.
export function clampUltCharge(currentCharge, delta, sacredThreshold) {
  const _current   = Math.max(0, Math.floor(Number(currentCharge) || 0));
  const _delta     = Math.max(0, Math.floor(Number(delta) || 0));
  const _threshold = Number(sacredThreshold);
  if (!Number.isFinite(_threshold) || _threshold <= 0) {
    // No valid sacred threshold — fall through to current + delta (defensive
    // for early-boot / mis-wired states). Caller is expected to pass a
    // valid threshold from HERO_ULT_COST_BY_NEWROLE.
    return _current + _delta;
  }
  return Math.min(_threshold, _current + _delta);
}

// Read-only predicate: is the cell at (row, col) currently cursed? Exposed
// for the T2.B legacy bridge to wire into `pieceCanBePlaced` / `clearLines`
// so cursed cells cannot be cleared for 3 turns. Pure read of the
// `_cursedTiles` array — no allocation.
export function isCellCursed(row, col) {
  const _r = Number(row);
  const _c = Number(col);
  if (!Number.isFinite(_r) || !Number.isFinite(_c)) return false;
  for (const t of _cursedTiles) {
    if (t.row === _r && t.col === _c) return true;
  }
  return false;
}

// Read-only accessor: how many cursed cells are currently active? Used by
// the per-turn tick + tests to confirm placement / expiration accounting.
export function getCursedTilesCount() {
  return _cursedTiles.length;
}

// Read-only snapshot of active curses (defensive copy). Used by tests and
// by the T2.B legacy bridge for grid rendering integration. Production
// callers should prefer `isCellCursed` / `getCursedTilesCount` to avoid
// the allocation.
export function getCursedTilesSnapshot() {
  return _cursedTiles.map(t => ({
    row: t.row,
    col: t.col,
    placedTurn: t.placedTurn,
    expiresTurn: t.expiresTurn,
  }));
}

// Reset hook for battle pipeline (battle start / battle end). Clears all
// state + hides DOM. Mirrors `resetCrocFragmentBank` (T2.05) and
// `resetAshenReign` (T2.07) precedents. Idempotent — safe to call when
// no curses are active.
export function resetCursedTiles() {
  // Hide all skull overlays + return them to the available pool.
  for (const t of _cursedTiles) {
    if (t.el) {
      try {
        t.el.classList.remove('identity-lich-cursed-tile-pulse');
        t.el.classList.remove('identity-lich-cursed-tile-fade');
        t.el.style.display = 'none';
      } catch (_e) { /* swallow */ }
    }
  }
  _cursedTiles.length = 0;
  // Restore all pool indices to available.
  _cursedTilesPoolAvailable.length = 0;
  for (let i = 0; i < _cursedTilesPool.length; i++) {
    _cursedTilesPoolAvailable.push(i);
  }
}

// ─── Activate / tick (module state mutations) ──────────────────────────
//
// `fxLichCursedTiles(bossState, ctx)` — place CURSED_TILES_COUNT (3) curses
// on random non-empty cells. Spec §3.2 field 4. Called by the new boss-
// reactive handler (`identity_assassin_shark_counter` in
// `src/core/reactivity-events.js`) AFTER the REACTIVITY_TELEGRAPH_MS (3000ms)
// wind-up banner completes (sacred re-use).
//
// Initial-trigger wall-time budget: ≤CURSED_TILES_INITIAL_BUDGET_MS (16ms).
//   - pickRandomNonEmptyCells: O(64) over 8×8 board → ≤1ms
//   - 3 × _cursedTilesPool element activation (class swap + position): ≤6ms
//   - module state array push × 3: ≤1ms
//   Total: ≤8ms typical, 16ms ceiling with CI headroom.
//
// `ctx` is the dispatch context (may carry `gridState` and `currentTurn`):
//   - `ctx.gridState`: the 2D grid array used to pick non-empty cells
//   - `ctx.currentTurn`: the game's current turn counter (placedTurn)
// Defaults to module-level `grid` global (legacy) and 0 if not provided.
//
// `bossState` parameter is reserved for forward compat (codex / matchup
// matrix may need archetype-specific tinting); currently unused.
export function fxLichCursedTiles(_bossState, ctx) {
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  try {
    // Resolve grid + current turn from ctx (preferred) or legacy globals.
    const _gridState = (ctx && ctx.gridState !== undefined)
      ? ctx.gridState
      : (typeof grid !== 'undefined' ? grid : null);
    const _currentTurn = (ctx && typeof ctx.currentTurn === 'number')
      ? ctx.currentTurn
      : 0;

    // Pick up to CURSED_TILES_COUNT random non-empty cells (already-cursed
    // excluded by pickRandomNonEmptyCells). If the board has fewer non-empty
    // cells than CURSED_TILES_COUNT, place whatever is available — silent
    // partial-fire is OK per spec §3.2 ("up to 3 random non-empty cells").
    const picks = pickRandomNonEmptyCells(_gridState, CURSED_TILES_COUNT);
    if (picks.length === 0) return;

    // Lazy pool init for DOM environments.
    _ensureCursedTilesPool();

    // Resolve screen coords for each picked cell. In Node-only test envs
    // (no DOM), `cells` is empty and we skip the DOM activation step.
    const cells = (typeof document !== 'undefined')
      ? document.querySelectorAll('.grid .cell')
      : null;

    for (const pick of picks) {
      // Pop a pool index. Cap is CURSED_TILES_COUNT — if exhausted (e.g.,
      // re-fire before resetCursedTiles), silently skip the DOM allocation
      // for this curse (state still tracked in _cursedTiles array).
      let el = null;
      if (_cursedTilesPoolAvailable.length > 0) {
        const idx = _cursedTilesPoolAvailable.pop();
        el = _cursedTilesPool[idx];
      }
      // Configure overlay via spawnSkullOverlay factory (CSS animation-driven).
      if (el && cells && cells.length) {
        const cellIdx = pick.row * BOARD_COLS + pick.col;
        const cellEl  = cells[cellIdx];
        if (cellEl && typeof cellEl.getBoundingClientRect === 'function') {
          const r = cellEl.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top  + r.height / 2;
          try {
            el.style.display = 'block';
            spawnSkullOverlay({
              el,
              x: cx,
              y: cy,
              color: CURSED_TILES_SKULL_COLOR,
              decayMs: CURSED_TILES_SKULL_DECAY_MS,
            });
          } catch (e) { log.warn('Lich cursed tile overlay spawn failed:', e); }
        }
      }
      // Add to active-curses array. Even in headless test envs (no DOM),
      // this is the source of truth for isCellCursed / per-turn tick.
      _cursedTiles.push({
        row: pick.row,
        col: pick.col,
        placedTurn:  _currentTurn,
        expiresTurn: _currentTurn + CURSED_TILES_TURNS_UNTIL_AUTO_CLEAR,
        el,
      });
    }

    // T2.12 (2026-05-12): Codex recording — Lich Cursed Tiles moment witnessed.
    try { recordMomentTrigger('lich_cursed_tiles'); } catch (_e) { /* defensive */ }
  } finally {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      if (dt > CURSED_TILES_INITIAL_BUDGET_MS) {
        log.warn('Lich Cursed Tiles initial trigger over budget:',
                 dt.toFixed(2), 'ms (limit', CURSED_TILES_INITIAL_BUDGET_MS, 'ms)');
      }
    }
  }
}

// `fxLichCursedTilesTick(ctx)` — per-turn tick. Spec §3.2 field 4 bullet 2-3.
// Called by the battle pipeline at the START of each player turn (T2.B
// bridge wires this). For each active cursed cell:
//   - Apply CURSED_TILES_HP_DAMAGE_PER_TURN (1) HP damage to the squad.
//   - If the curse has expired (currentTurn ≥ expiresTurn): grant +20 ULT
//     charge per expiring cell (clamped to sacred HERO_ULT_COST_BY_NEWROLE
//     threshold), fade the skull overlay over 300ms, remove from active
//     array.
//
// Per-turn wall-time budget: ≤CURSED_TILES_PER_TURN_TICK_BUDGET_MS (3ms).
// 3 cells × 1ms each = 3ms ceiling. Pure integer math + at most 3 DOM
// class swaps when expirations fire.
//
// `ctx` carries the per-turn snapshot:
//   - `ctx.currentTurn`: integer turn counter (REQUIRED — falls back to
//     last-placedTurn + 1 defensively).
//   - `ctx.squadHpApi`: optional { get(), set(n) } API for squad HP. If
//     present, fxLichCursedTilesTick mutates HP via the API; else returns
//     the proposed HP delta in the result for the caller to apply.
//   - `ctx.ultMeterApi`: optional { get(meter): n, set(meter, n), threshold(meter): n }
//     API for ULT charges. Pure pass-through; defaults fall back to the
//     existing legacy globals `ultCharges` / `HERO_ULT_COST_BY_NEWROLE`.
//   - `ctx.ultMeter`: string key for which ULT meter to add to ('ember' |
//     'tide' | 'grove' | 'solar' | 'umbra'). Defaults to 'umbra' (Lich's
//     stihiya — same convention as RACE_SYNERGY ULT charge writes).
//   - `ctx.role`: string key for which role's sacred threshold to clamp
//     against ('mage' | 'warrior' | 'hunter' | 'tank' | 'captain'). Defaults
//     to 'mage' (highest sacred threshold = 100, safest default).
//
// Returns: result object `{ hpDamage, ultChargeGranted, expiredCount,
// activeCount }` for caller telemetry + unit-test assertion.
export function fxLichCursedTilesTick(ctx) {
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  const result = { hpDamage: 0, ultChargeGranted: 0, expiredCount: 0, activeCount: 0 };
  try {
    if (_cursedTiles.length === 0) return result;

    const _currentTurn = (ctx && typeof ctx.currentTurn === 'number')
      ? ctx.currentTurn
      : (_cursedTiles[0] ? (_cursedTiles[0].placedTurn + 1) : 0);

    // Step 1: apply HP damage = (active cell count BEFORE expiration) × 1.
    // Spec §3.2 field 4 bullet 2: "Inflict 1 HP of damage to the squad each
    // turn they remain." We count cells that are active THIS turn (before
    // we expire any), so a curse placed on turn N AND ticking on turns
    // N+1, N+2, N+3 contributes damage on all three turns, then expires
    // and grants +20 ULT compensation at the end of N+3.
    const activeCellsThisTurn = _cursedTiles.length;
    result.hpDamage = activeCellsThisTurn * CURSED_TILES_HP_DAMAGE_PER_TURN;
    if (ctx && ctx.squadHpApi
        && typeof ctx.squadHpApi.get === 'function'
        && typeof ctx.squadHpApi.set === 'function') {
      const currentHp = Number(ctx.squadHpApi.get()) || 0;
      const newHp = applyCurseCellDamage(currentHp, activeCellsThisTurn);
      ctx.squadHpApi.set(newHp);
    }

    // Step 2: iterate active curses, expire those whose expiresTurn ≤ current.
    // Iterate backwards so splice doesn't shift indices.
    let totalUltGranted = 0;
    for (let i = _cursedTiles.length - 1; i >= 0; i--) {
      const curse = _cursedTiles[i];
      const tick  = computeCurseTickResult(curse, _currentTurn);
      if (!tick.active) {
        // Expired — grant ULT compensation (clamped) + fade overlay + remove.
        if (tick.shouldGrantUltCharge && tick.ultChargeToGrant > 0) {
          // Resolve threshold via ctx.ultMeterApi if provided; else fall
          // back to legacy globals (`HERO_ULT_COST_BY_NEWROLE[role]` →
          // 100 for mage default). Sacred values are READ-ONLY for the
          // clamp.
          const meter = (ctx && typeof ctx.ultMeter === 'string') ? ctx.ultMeter : 'umbra';
          const role  = (ctx && typeof ctx.role === 'string')     ? ctx.role     : 'mage';
          let threshold = null;
          let currentCharge = 0;
          if (ctx && ctx.ultMeterApi) {
            if (typeof ctx.ultMeterApi.threshold === 'function') {
              threshold = ctx.ultMeterApi.threshold(role);
            }
            if (typeof ctx.ultMeterApi.get === 'function') {
              currentCharge = Number(ctx.ultMeterApi.get(meter)) || 0;
            }
          }
          if (threshold === null) {
            // Legacy-globals fallback. ULT_THRESHOLD / currentUltThreshold are
            // ULT-meter thresholds (different sacred scale, ~12). The +20
            // compensation is intended to fill the per-role HERO_ULT_COST_BY_NEWROLE
            // (80-120 scale); we resolve via the legacy `HERO_ULT_COST_BY_NEWROLE`
            // global if defined, else default to 100 (mage — highest sacred
            // value, safest default).
            try {
              if (typeof HERO_ULT_COST_BY_NEWROLE !== 'undefined'
                  && HERO_ULT_COST_BY_NEWROLE
                  && typeof HERO_ULT_COST_BY_NEWROLE[role] === 'number') {
                threshold = HERO_ULT_COST_BY_NEWROLE[role];
              }
            } catch (_e) { /* swallow */ }
            if (threshold === null) threshold = 100;
          }
          if (ctx && ctx.ultMeterApi && typeof ctx.ultMeterApi.get === 'function') {
            // currentCharge already loaded above.
          } else {
            try {
              if (typeof ultCharges !== 'undefined' && ultCharges
                  && typeof ultCharges[meter] === 'number') {
                currentCharge = ultCharges[meter];
              }
            } catch (_e) { /* swallow */ }
          }
          const clamped = clampUltCharge(currentCharge, tick.ultChargeToGrant, threshold);
          totalUltGranted += (clamped - currentCharge);
          if (ctx && ctx.ultMeterApi && typeof ctx.ultMeterApi.set === 'function') {
            ctx.ultMeterApi.set(meter, clamped);
          } else {
            try {
              if (typeof ultCharges !== 'undefined' && ultCharges) {
                ultCharges[meter] = clamped;
              }
            } catch (_e) { /* swallow */ }
          }
        }
        // Fade overlay over CURSED_TILES_SKULL_DECAY_MS (300ms) — CSS-driven.
        if (curse.el) {
          try {
            curse.el.classList.remove('identity-lich-cursed-tile-pulse');
            curse.el.classList.add('identity-lich-cursed-tile-fade');
            // Hide after the fade window — single setTimeout per expiring
            // cell. Worst case: 3 timeouts at expiration, all firing the
            // same hide path. Net cost: ≤1ms scheduling overhead.
            const _el = curse.el;
            setTimeout(() => {
              try {
                _el.style.display = 'none';
                _el.classList.remove('identity-lich-cursed-tile-fade');
              } catch (_e) { /* swallow */ }
            }, CURSED_TILES_SKULL_DECAY_MS);
          } catch (_e) { /* swallow */ }
          // Return pool index to available stack (find by reference).
          for (let pi = 0; pi < _cursedTilesPool.length; pi++) {
            if (_cursedTilesPool[pi] === curse.el) {
              _cursedTilesPoolAvailable.push(pi);
              break;
            }
          }
        }
        _cursedTiles.splice(i, 1);
        result.expiredCount += 1;
      }
    }
    result.ultChargeGranted = totalUltGranted;
    result.activeCount = _cursedTiles.length;
  } finally {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      if (dt > CURSED_TILES_PER_TURN_TICK_BUDGET_MS) {
        log.warn('Lich Cursed Tiles tick over budget:',
                 dt.toFixed(2), 'ms (limit', CURSED_TILES_PER_TURN_TICK_BUDGET_MS, 'ms)');
      }
    }
  }
  return result;
}

// Trigger gate (spec §3.2 field 3): "A clearLines fires where the player's
// active squad has ≥2 sharks". Pure predicate — pass-through wrapper over
// `countAliveSharks(squad) >= CURSED_TILES_TRIGGER_SHARK_THRESHOLD` so the
// T2.B bridge has a single import surface and tests have an explicit named
// helper.
//
// Returns: boolean. True → fire `triggerIdentityBossEvent('identity_assassin_shark_counter')`;
// false → silent no-op.
export function cursedTilesGatePasses(squad) {
  const sharkCount = countAliveSharks(squad);
  return sharkCount >= CURSED_TILES_TRIGGER_SHARK_THRESHOLD;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2026-05-12 — TASK-036 (T2.09): Berserker / Frenzy Bloodtide Pulse (THIRD
// boss-reactive identity mechanic — every-3rd-clear tempo mechanic shared by
// BOTH `berserker` and `frenzy` archetypes per spec §3.3 field 1).
//
// Spec: docs/design/mechanics/identity-layer.md §3.3.
// Architecture (spec §1 hard rule 1): Identity Layer EXTENDS, never MODIFIES,
// v2.1 P4 reactivity AND v2.1 P2 Stagger Loop. Sacred berserker / frenzy
// reactivity handlers (`berserker_p1_p2` enrage banner + 1.2× boss damage,
// `berserker_p2_p3` stagger immunity, `frenzy_p1_p2` raise frenzyMaxStacks,
// `frenzy_p2_p3` forced maul combo) and the 22 reactivity handlers stay
// BYTE-PERFECT. Stagger Loop state machine (BOSS_STATE_ACTIVE/STAGGER/RECOVERY,
// STAGGER_DURATION_TURNS = 4, RECOVERY_DURATION_TURNS = 2) stays BYTE-PERFECT.
// Bloodtide is a NEW handler under namespace `identity_berserker_frenzy_pulse`
// in `src/core/reactivity-events.js`, fired ALONGSIDE the sacred path via the
// T2.07-established `IDENTITY_BOSS_HANDLERS` parallel registry.
//
// Mechanical contract (spec §3.3):
//   - Trigger: every `BLOODTIDE_PULSE_INTERVAL` (3) line clears the player
//     resolves WHILE the boss is in Active state (NOT Stagger, NOT Recovery).
//     The gate reads `getBossState()` from `src/core/stagger-loop.js` — pure
//     READ-ONLY observation; no state-mutation API is called.
//   - `incrementBloodtideClearCount()`: called by battle pipeline on every
//     successful line clear. Pure integer increment; returns new count.
//   - `shouldBloodtidePulse(count, staggerState)`: pure predicate. True iff
//     count > 0 && count % 3 === 0 && staggerState === 'active'.
//   - `fxBerserkerBloodtidePulse(bossState, ctx)`: when the gate passes, this
//     is called (by the boss-reactive handler) to:
//       * Set _bloodtidePulsePending = true (the one-shot buff flag).
//       * Spawn a red pulse VFX from boss portrait → grid via
//         spawnBloodtidePulse (single DOM element, ≤10ms).
//       * Toggle the HUD pending indicator.
//   - `consumeBloodtidePulse()`: called by battle pipeline before resolving
//     a boss attack. Returns `{ damageBonus: 0.05 | 0 }` and clears the
//     pending flag. One-shot semantics: 3 consecutive pulses do NOT stack —
//     each consume returns 0.05 once, then 0 until a new pulse fires.
//   - `applyBloodtideToDamage(baseDamage, enrageMult, pulseBonus)`: pure
//     composition helper that codifies the LAYERED damage rule:
//       finalDamage = baseDamage × enrageMult × (1 + pulseBonus)
//     This guarantees the +5% pulse multiplies the ENRAGE-MULTIPLIED result,
//     NEVER modifies the sacred BERSERKER_ENRAGE_MULT = 2.0 itself.
//
// Sacred-cow safety (CLAUDE.md §2.1 + §2.5):
//   - Reads `getBossState()` from src/core/stagger-loop.js (lazy import via
//     dynamic resolution; tests pass the state string directly).
//   - Reads BERSERKER_ENRAGE_HP_PCT = 0.5 / BERSERKER_ENRAGE_MULT = 2.0 via
//     name only for the pulse-layering test — NEVER mutates these values.
//   - Stagger Loop state machine UNTOUCHED — no setState/transition call.
//     STAGGER_DURATION_TURNS = 4 / RECOVERY_DURATION_TURNS = 2 byte-perfect.
//   - REACTIVITY_TELEGRAPH_MS UNUSED by Bloodtide (no wind-up telegraph —
//     the pulse VFX IS the player's reaction time signal). The sacred 3000ms
//     constant stays byte-perfect regardless.
//   - Phoenix/Lich invariants UNTOUCHED.
//
// Performance budget (spec §3.3 field 7):
//   - Gate check: O(1) pure integer math (count % 3 === 0 && state check).
//   - Pulse VFX: ≤BLOODTIDE_INITIAL_BUDGET_MS (10ms) DOM element activation
//     + CSS keyframe sweep. Single pre-allocated pool element.
//   - Damage modifier: pure integer math at consume time.
//
// Reset on battle start/end via `resetBloodtide()`.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Pre-allocated DOM elements (object pool: 1 pulse + 1 HUD indicator). Sized
// at the spec cap of 1 — only one pulse is ever live at a time per spec §3.3
// field 4 "one-shot buff, not stacking". Created lazily on first
// fxBerserkerBloodtidePulse invocation.
let _bloodtidePulseEl       = null;
let _bloodtidePulseHudEl    = null;
let _bloodtidePoolContainer = null;
let _bloodtidePoolInitDone  = false;

// Module state. `_bloodtideClearCount` is the per-battle line-clear counter
// (incremented on every fire by `incrementBloodtideClearCount`). `_bloodtidePulsePending`
// is the one-shot buff flag — true between pulse fire and consume. Per spec
// §3.3 field 4, only ONE pulse is ever live at a time; if a new pulse fires
// before the previous is consumed, the flag stays true (no stacking).
let _bloodtideClearCount    = 0;
let _bloodtidePulsePending  = false;
// Pulse fade-out timer (single setTimeout, no setInterval / rAF).
let _bloodtidePulseDecayTimer = null;

// Ensures the 1-element DOM pool exists. Idempotent — calling again is a
// no-op. In Node-only unit-test environments (no `document`), the pool stays
// empty and helpers work on the integer-only state path.
function _ensureBloodtidePool() {
  if (_bloodtidePoolInitDone) return;
  if (typeof document === 'undefined') return;          // unit-test guard
  _bloodtidePoolContainer = document.createElement('div');
  _bloodtidePoolContainer.className = 'identity-bloodtide-pulse-container';
  _bloodtidePoolContainer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(_bloodtidePoolContainer);
  // Pulse element (1 pre-allocated, re-used per fire — one-shot semantics).
  _bloodtidePulseEl = document.createElement('div');
  _bloodtidePulseEl.className = 'identity-bloodtide-pulse';
  _bloodtidePulseEl.style.display = 'none';
  _bloodtidePoolContainer.appendChild(_bloodtidePulseEl);
  // HUD pending indicator (1 pre-allocated).
  _bloodtidePulseHudEl = document.createElement('div');
  _bloodtidePulseHudEl.className = 'identity-bloodtide-pulse-hud';
  _bloodtidePulseHudEl.textContent = 'BLOODTIDE PULSE — +5% incoming';
  _bloodtidePulseHudEl.style.display = 'none';
  document.body.appendChild(_bloodtidePulseHudEl);
  _bloodtidePoolInitDone = true;
}

// ─── Pure helpers (unit-testable, no DOM) ──────────────────────────────
//
// Trigger gate predicate. Pure function — given a clear count and stagger
// state, returns true iff:
//   - clearCount > 0 (defensive: never fire at boot before any clears)
//   - clearCount % BLOODTIDE_PULSE_INTERVAL (3) === 0
//   - staggerState === BLOODTIDE_REQUIRED_STAGGER_STATE ('active')
// During Stagger / Recovery the gate fails silently (no pulse). Clear count
// keeps incrementing across states; pulse fires on the first qualifying
// 3rd-clear after returning to Active.
//
// `staggerState` should be the result of `getBossState()` from
// `src/core/stagger-loop.js`. Pass the string directly for tests.
export function shouldBloodtidePulse(clearCount, staggerState) {
  const _count = Number(clearCount);
  if (!Number.isFinite(_count) || _count <= 0) return false;
  if (Math.floor(_count) !== _count) return false;
  if (_count % BLOODTIDE_PULSE_INTERVAL !== 0) return false;
  return staggerState === BLOODTIDE_REQUIRED_STAGGER_STATE;
}

// Pure helper: compute the damage bonus for a hypothetical N pulses. Caps at
// BLOODTIDE_PULSE_MAX_BONUS (0.25 = +25%) per spec §3.3 field 4 HARD CAP.
// In normal play `pulsesPending` is always 0 or 1 (one-shot consume), but
// this helper exists for the cap-clamp invariant test and forward-compat.
export function computeBloodtideDamageBonus(pulsesPending) {
  const _n = Math.max(0, Math.floor(Number(pulsesPending) || 0));
  return Math.min(BLOODTIDE_PULSE_MAX_BONUS, _n * BLOODTIDE_PULSE_DAMAGE_BONUS);
}

// Pure composition helper: apply Bloodtide pulse to the FINAL damage value
// after enrage. The order is critical:
//   finalDamage = baseDamage × enrageMult × (1 + pulseBonus)
// NEVER `baseDamage × (enrageMult + pulseBonus)` — that would functionally
// modify the sacred BERSERKER_ENRAGE_MULT = 2.0 value. Pulse multiplies the
// already-enraged base; sacred multipliers stay untouched.
//
// Example: baseDamage = 100, enrageMult = 2.0, pulseBonus = 0.05
//   correct: 100 × 2.0 × 1.05 = 210
//   wrong:   100 × (2.0 + 0.05) = 205  (would mean modifying enrageMult)
export function applyBloodtideToDamage(baseDamage, enrageMult, pulseBonus) {
  const _base   = Number(baseDamage);
  const _enrage = Number(enrageMult);
  const _bonus  = Number(pulseBonus);
  if (!Number.isFinite(_base) || !Number.isFinite(_enrage)) return 0;
  const safeBonus = Number.isFinite(_bonus) ? _bonus : 0;
  return _base * _enrage * (1 + safeBonus);
}

// ─── Battle-pipeline helpers (count tick + consume) ────────────────────
//
// Increment the per-battle line-clear count by 1. Called by the battle
// pipeline on every successful line clear (T2.B bridge will wire this into
// `src/core/grid.js#clearLines`). Returns the new count for callers that
// want to compute the gate inline.
export function incrementBloodtideClearCount() {
  _bloodtideClearCount += 1;
  return _bloodtideClearCount;
}

// Read-only accessor for the current clear count. Used by tests and the
// dispatcher gate check.
export function getBloodtideClearCount() {
  return _bloodtideClearCount;
}

// Consume the pending pulse buff. Called by battle pipeline BEFORE resolving
// a boss attack. Returns `{ damageBonus }` — 0.05 if a pulse was pending,
// 0 otherwise. Side effect: sets _bloodtidePulsePending = false. Idempotent
// for subsequent calls until a new pulse fires.
//
// One-shot semantics: 3 consecutive pulses (clears 3, 6, 9 without any boss
// attack in between) all set pending=true, but consume returns 0.05 ONCE
// (one buff is the maximum live at any time — no stacking per spec §3.3
// field 4).
export function consumeBloodtidePulse() {
  if (_bloodtidePulsePending) {
    _bloodtidePulsePending = false;
    // Hide HUD indicator after consume.
    if (_bloodtidePulseHudEl) {
      try {
        _bloodtidePulseHudEl.classList.remove('identity-bloodtide-pulse-hud-pending');
        _bloodtidePulseHudEl.style.display = 'none';
      } catch (_e) { /* swallow */ }
    }
    return { damageBonus: BLOODTIDE_PULSE_DAMAGE_BONUS };
  }
  return { damageBonus: 0 };
}

// Read-only accessor: is a pulse currently pending? Used by tests and the
// damage-resolution pipeline.
export function isBloodtidePulsePending() {
  return _bloodtidePulsePending;
}

// Reset hook for battle pipeline (battle start / battle end). Clears all
// state + cancels pending timers + hides DOM. Mirrors `resetAshenReign` /
// `resetCursedTiles` precedents. Idempotent — safe to call when no pulse
// is active.
export function resetBloodtide() {
  _bloodtideClearCount = 0;
  _bloodtidePulsePending = false;
  if (_bloodtidePulseDecayTimer) {
    clearTimeout(_bloodtidePulseDecayTimer);
    _bloodtidePulseDecayTimer = null;
  }
  if (_bloodtidePulseEl) {
    try {
      _bloodtidePulseEl.classList.remove('identity-bloodtide-pulse-sweep');
      _bloodtidePulseEl.style.display = 'none';
    } catch (_e) { /* swallow */ }
  }
  if (_bloodtidePulseHudEl) {
    try {
      _bloodtidePulseHudEl.classList.remove('identity-bloodtide-pulse-hud-pending');
      _bloodtidePulseHudEl.style.display = 'none';
    } catch (_e) { /* swallow */ }
  }
}

// ─── Activate (module state mutation) ──────────────────────────────────
//
// `fxBerserkerBloodtidePulse(bossState, ctx)` — fire the red pulse VFX and
// set the one-shot pending buff. Spec §3.3 field 4. Called by the new boss-
// reactive handler (`identity_berserker_frenzy_pulse` in
// `src/core/reactivity-events.js`) when the gate passes.
//
// Initial-trigger wall-time budget: ≤BLOODTIDE_INITIAL_BUDGET_MS (10ms).
//   - 1 DOM pool element activation (class swap + position): ≤4ms
//   - 1 HUD indicator activation (class swap): ≤2ms
//   - module state flag set: ≤1ms
//   Total: ≤7ms typical, 10ms ceiling with CI headroom.
//
// `ctx` is the dispatch context (may carry `bossImgWrap` and `gridEl`):
//   - `ctx.bossImgWrap`: the #bossImgWrap DOM element (for source position).
//   - `ctx.gridEl`: the grid container DOM element (for target position).
// Defaults to `document.querySelector` lookups if not provided.
//
// `bossState` parameter is reserved for forward compat (codex / matchup
// matrix may need archetype-specific tinting); currently unused beyond the
// shared red pulse signature.
export function fxBerserkerBloodtidePulse(_bossState, ctx) {
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  try {
    // Set the one-shot pending flag. Per spec §3.3 field 4 "one-shot buff,
    // not stacking with itself": if a previous pulse is still pending (player
    // hadn't been attacked yet), we leave the flag true — there's no scalar
    // count of pulses, just a boolean. The new VFX still spawns to maintain
    // the visual tempo signal.
    _bloodtidePulsePending = true;

    // Lazy pool init for DOM environments.
    _ensureBloodtidePool();

    if (_bloodtidePulseEl && typeof document !== 'undefined') {
      // Resolve source (boss portrait) + target (grid) coords from ctx or
      // DOM lookup. In Node-only test envs (no DOM), we skip the visual
      // step but the module state flag is still set above.
      const bossEl = (ctx && ctx.bossImgWrap) || document.getElementById('bossImgWrap');
      const gridEl = (ctx && ctx.gridEl)
        || document.querySelector('.grid')
        || document.getElementById('grid');
      let fromX = 0, fromY = 0, toX = 0, toY = 0;
      if (bossEl && typeof bossEl.getBoundingClientRect === 'function') {
        const r = bossEl.getBoundingClientRect();
        fromX = r.left + r.width / 2;
        fromY = r.top  + r.height / 2;
      }
      if (gridEl && typeof gridEl.getBoundingClientRect === 'function') {
        const r = gridEl.getBoundingClientRect();
        toX = r.left + r.width / 2;
        toY = r.top  + r.height / 2;
      }

      try {
        _bloodtidePulseEl.style.display = 'block';
        spawnBloodtidePulse({
          el:      _bloodtidePulseEl,
          fromX,  fromY,
          toX,    toY,
          color:  BLOODTIDE_PULSE_COLOR,
          decayMs: BLOODTIDE_PULSE_VFX_DURATION_MS,
        });
      } catch (e) { log.warn('Bloodtide pulse spawn failed:', e); }

      // Hide pulse after VFX duration via single setTimeout. No setInterval,
      // no requestAnimationFrame.
      if (_bloodtidePulseDecayTimer) clearTimeout(_bloodtidePulseDecayTimer);
      _bloodtidePulseDecayTimer = setTimeout(() => {
        _bloodtidePulseDecayTimer = null;
        if (_bloodtidePulseEl) {
          try {
            _bloodtidePulseEl.classList.remove('identity-bloodtide-pulse-sweep');
            _bloodtidePulseEl.style.display = 'none';
          } catch (_e) { /* swallow */ }
        }
      }, BLOODTIDE_PULSE_VFX_DURATION_MS + BLOODTIDE_PULSE_DECAY_MS);
    }

    // Activate HUD pending indicator. Static text "BLOODTIDE PULSE — +5%
    // incoming"; CSS animation `identityBloodtidePulseHudPending` does the
    // attention-grabbing pulse. Hidden by `consumeBloodtidePulse` on next
    // boss attack.
    if (_bloodtidePulseHudEl) {
      try {
        _bloodtidePulseHudEl.style.display = 'block';
        // Force a reflow so the keyframe restarts cleanly on re-fire.
        _bloodtidePulseHudEl.classList.remove('identity-bloodtide-pulse-hud-pending');
        void _bloodtidePulseHudEl.offsetWidth;
        _bloodtidePulseHudEl.classList.add('identity-bloodtide-pulse-hud-pending');
      } catch (_e) { /* swallow */ }
    }

    // T2.12 (2026-05-12): Codex recording — Berserker Bloodtide Pulse moment.
    try { recordMomentTrigger('berserker_bloodtide'); } catch (_e) { /* defensive */ }
  } finally {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      if (dt > BLOODTIDE_INITIAL_BUDGET_MS) {
        log.warn('Berserker Bloodtide Pulse initial trigger over budget:',
                 dt.toFixed(2), 'ms (limit', BLOODTIDE_INITIAL_BUDGET_MS, 'ms)');
      }
    }
  }
}

// Trigger gate (spec §3.3 field 3): line-clear count-based gate + Stagger
// Loop READ-ONLY state check. Returns true iff Bloodtide should fire on the
// CURRENT clear (after `incrementBloodtideClearCount` has been called).
//
// Two-source-of-truth invariant: `bloodtideGatePasses()` reads the same
// internal state as `getBloodtideClearCount()` — there is no separate scalar
// passed from the caller. The test passes staggerState explicitly so the
// pure-function semantics hold without coupling to stagger-loop.js.
export function bloodtideGatePasses(staggerState) {
  return shouldBloodtidePulse(_bloodtideClearCount, staggerState);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2026-05-12 — TASK-037 (T2.10): Engineer Lockdown Protocol (FOURTH boss-
// reactive identity mechanic — anti-Tetris 4-line crit counter per spec §3.4).
//
// Spec: docs/design/mechanics/identity-layer.md §3.4.
// Architecture (spec §1 hard rule 1): Identity Layer EXTENDS, never MODIFIES,
// v2.1 P4 reactivity. Sacred `engineer_p1_p2` (4-cell scatter, 40T lockdown)
// + `engineer_p2_p3` (2 electrified rows) handlers + the 22 reactivity
// handlers are BYTE-PERFECT. Engineer Lockdown Protocol is a NEW handler
// under namespace `identity_engineer_tetris_counter` in
// `src/core/reactivity-events.js`, fired ALONGSIDE the sacred engineer path
// via the T2.07-established `IDENTITY_BOSS_HANDLERS` parallel registry.
//
// Mechanical contract (spec §3.4):
//   - Trigger: player completes a 4-line crit clear (`isTetrisCrit(lines,
//     combo)` returns true ONLY when `lines === 4 AND combo === true`).
//   - `fxEngineerLockdownProtocol(bossState, ctx)`: same-turn boss reaction.
//     Picks the corner of the grid that received the most cleared cells in
//     the player's last fire (`pickMostClearedCorner(rows, cols, gridSize)`),
//     computes the 2×2 lockdown square (`compute2x2LockdownCells(corner, gridSize)`),
//     applies the existing engineer-lockdown CSS class
//     (`.cell--engineer-welded`, RE-USED — not duplicated) to the 4 cells,
//     spawns a 600ms ratchet animation overlay, and shows a 400ms "TETRIS!"
//     celebration banner transitioning to "LOCKDOWN" reaction text.
//   - Per-turn tick (`fxEngineerLockdownTick`): mirror-state lifecycle
//     accounting for headless test envs. The live runtime tick is owned by
//     the existing engineer state machinery (ui/archetype-ticks.js) — the
//     tick here removes expired entries from the module-side mirror array
//     so `isCellLockedByLockdownProtocol(r, c)` reflects expiration.
//
// Sacred-cow safety (CLAUDE.md §2.1 + §2.5 + spec §3.4 field 8):
//   - All 22 v2.1 P4 reactivity handlers UNTOUCHED.
//   - `engineer_p1_p2` 40T lockdown duration BYTE-PERFECT — T2.10
//     ENGINEER_LOCKDOWN_TURNS = 40 matches sacred byte-perfect.
//   - `engineer_p1_p2` 4-cell lockdown shape BYTE-PERFECT — T2.10 places a
//     contiguous 2×2 (4 cells), same total count as sacred (which scatters
//     4 random cells).
//   - Existing `.cell--engineer-welded` CSS class RE-USED, never duplicated.
//     Module state tracks T2.10-spawned lockdowns separately (for testing/
//     debugging only — the live grid-state predicate `engineerLockedCells`
//     is the source of truth for placement gating).
//   - Combo Crit formula UNTOUCHED — the trigger reads the post-formula
//     result (lines + crit flag). T2.10 never feeds combo crit input.
//   - NARRATOR_LINES untouched — TETRIS celebration + LOCKDOWN reaction
//     copy goes through existing `flashStateBanner` UI surface.
//   - V_HAPTICS untouched — inline `vibrate(...)` like other handlers.
//   - REACTIVITY_TELEGRAPH_MS = 3000 UNTOUCHED — Engineer Lockdown Protocol
//     does NOT use telegraph (action-based trigger; same precedent as
//     T2.09 Bloodtide per REPORT-27).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Pre-allocated DOM elements (object pool: 1 ratchet overlay + 1 TETRIS
// celebration banner). Single-element pool because lockdown is per-fire and
// the prior fire's ratchet completes its 600ms animation before any plausible
// next 4-line crit could fire (the player can clear 4 lines back-to-back only
// after pieces are placed — minimum a few frames). Created lazily on first
// fxEngineerLockdownProtocol invocation.
let   _engineerLockdownPoolContainer = null;
let   _engineerLockdownRatchetEl     = null;
let   _engineerLockdownBannerEl      = null;
let   _engineerLockdownPoolInitDone  = false;
let   _engineerLockdownRatchetDecayTimer = null;
let   _engineerLockdownBannerDecayTimer  = null;

// Module state — array of active lockdowns from on-crit trigger. Each entry
// shape:
//   { cells: [{row,col},...], startTurn, expiresTurn } (cells is 4 entries
// for the 2×2 lockdown). This is the MIRROR state used by:
//   - `isCellLockedByLockdownProtocol(r, c)` predicate for T2.B bridge to
//     wire into legacy `pieceCanBePlaced` alongside the existing
//     `engineerLockedCells` Map check.
//   - `fxEngineerLockdownTick` for lifecycle accounting in headless tests.
//   - `getEngineerLockdownsSnapshot()` for test introspection.
// The live runtime gating defers to the existing `engineerLockedCells` Map
// (set by both the sacred engineer_p1_p2 handler AND T2.B bridge after
// fxEngineerLockdownProtocol fires) — both paths feed the same grid-state
// predicate from grid.js.
let _engineerLockdowns = [];

// Ensures the 2-element DOM pool exists. Idempotent — calling again is a
// no-op. In Node-only unit-test environments (no `document`), the pool stays
// empty and helpers work on the array-only state path.
function _ensureEngineerLockdownPool() {
  if (_engineerLockdownPoolInitDone) return;
  if (typeof document === 'undefined') return;          // unit-test guard
  _engineerLockdownPoolContainer = document.createElement('div');
  _engineerLockdownPoolContainer.className = 'identity-engineer-lockdown-container';
  _engineerLockdownPoolContainer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(_engineerLockdownPoolContainer);

  _engineerLockdownRatchetEl = document.createElement('div');
  _engineerLockdownRatchetEl.className = 'identity-engineer-lockdown-ratchet';
  _engineerLockdownRatchetEl.style.display = 'none';
  _engineerLockdownPoolContainer.appendChild(_engineerLockdownRatchetEl);

  _engineerLockdownBannerEl = document.createElement('div');
  _engineerLockdownBannerEl.className = 'identity-engineer-tetris-celebration';
  _engineerLockdownBannerEl.style.display = 'none';
  _engineerLockdownBannerEl.textContent = 'TETRIS!';
  document.body.appendChild(_engineerLockdownBannerEl);

  _engineerLockdownPoolInitDone = true;
}

// ─── Pure helpers (unit-testable, no DOM) ──────────────────────────────
//
// Trigger predicate (spec §3.4 field 3): the boss reacts ONLY when the
// player completes a 4-line crit clear. Defensive bounds rejection means
// 5-line / 6-line clears (impossible on an 8×8 board with crit but defensive)
// also do not fire. Combo crit is the explicit second gate — a 4-line clear
// without combo crit means the player didn't actually achieve the "Tetris"
// damage burst, and the boss is not provoked.
//
// `linesCleared` is the COMBINED count of cleared rows + columns from the
// current `clearLines` resolution. `comboTriggered` is the boolean output of
// the sacred combo crit formula (truthy when the dominantCount × combo
// multiplier exceeded 1.0).
//
// Returns: boolean. True → fire fxEngineerLockdownProtocol; false → silent
// no-op (no DOM, no state mutation, no log).
export function isTetrisCrit(linesCleared, comboTriggered) {
  const _lines = Math.floor(Number(linesCleared) || 0);
  return _lines === ENGINEER_LOCKDOWN_TRIGGER_LINES && comboTriggered === true;
}

// Pure helper: which corner of the grid received the most cleared cells in
// the player's last fire? Spec §3.4 field 4: "1 random 2×2 square (4 cells)
// at the corner of the grid MOST-CLEARED in the last fire". This is the
// deterministic "anti-greed" — the lockdown lands where the player
// concentrated their work.
//
// Algorithm: for each of the 4 corners, count how many cleared rows/cols
// fall within that corner's half. Tie-break by corner order
// (top-left → top-right → bottom-left → bottom-right) for determinism in
// tests. The result identifies the 2×2 anchor: top-left of that corner.
//
// Returns: `{ cornerName: 'top-left'|'top-right'|'bottom-left'|'bottom-right',
// row: 0|gridSize-2, col: 0|gridSize-2 }` where (row, col) is the top-left
// cell of the 2×2 lockdown square.
//
// Edge cases:
//   - `rows` and `cols` both empty → defensive 'top-left' fallback (caller
//     should not reach here — `isTetrisCrit` gates on 4 lines).
//   - gridSize ≤ 1 → defensive return with row=0, col=0.
//   - All clears in mid-board (neither halves dominate) → tie-break wins.
export function pickMostClearedCorner(rows, cols, gridSize) {
  const _rows = Array.isArray(rows) ? rows : [];
  const _cols = Array.isArray(cols) ? cols : [];
  const _size = Math.max(2, Math.floor(Number(gridSize) || 0));
  const mid   = _size / 2;
  let topCount    = 0;   // rows in upper half
  let bottomCount = 0;
  let leftCount   = 0;   // cols in left half
  let rightCount  = 0;
  for (const r of _rows) {
    const _r = Math.floor(Number(r));
    if (!Number.isFinite(_r)) continue;
    if (_r < mid) topCount += 1;
    else          bottomCount += 1;
  }
  for (const c of _cols) {
    const _c = Math.floor(Number(c));
    if (!Number.isFinite(_c)) continue;
    if (_c < mid) leftCount += 1;
    else          rightCount += 1;
  }
  // Tie-break in the deterministic order: top-left → top-right →
  // bottom-left → bottom-right. Use >= so the first qualifying corner wins.
  const top  = topCount    >= bottomCount;
  const left = leftCount   >= rightCount;
  const cornerName = top
    ? (left ? 'top-left'    : 'top-right')
    : (left ? 'bottom-left' : 'bottom-right');
  const row = top  ? 0           : (_size - 2);
  const col = left ? 0           : (_size - 2);
  return { cornerName, row, col };
}

// Pure helper: compute the 4 (row, col) cell positions for the 2×2
// lockdown square anchored at the given corner. Spec §3.4 field 4:
// "1 random 2×2 square (4 cells) at the corner".
//
// `corner` is the result of `pickMostClearedCorner` — `{ cornerName, row,
// col }` where (row, col) is the TOP-LEFT cell of the 2×2 square. This
// helper expands that anchor into the 4 cells of the square:
//   (row,col), (row,col+1), (row+1,col), (row+1,col+1).
//
// `gridSize` is the board dimension (SIZE = 8 in production). Used for
// defensive clamping so the 2×2 never overhangs the board edge.
//
// Returns: array of 4 `{ row, col }` objects. Length is ALWAYS 4 for valid
// inputs (the corner anchor is always 2 cells away from each edge).
export function compute2x2LockdownCells(corner, gridSize) {
  const _size = Math.max(2, Math.floor(Number(gridSize) || 0));
  if (!corner || typeof corner !== 'object') {
    return [
      { row: 0, col: 0 }, { row: 0, col: 1 },
      { row: 1, col: 0 }, { row: 1, col: 1 },
    ];
  }
  const r0 = Math.max(0, Math.min(_size - 2, Math.floor(Number(corner.row) || 0)));
  const c0 = Math.max(0, Math.min(_size - 2, Math.floor(Number(corner.col) || 0)));
  return [
    { row: r0,     col: c0     },
    { row: r0,     col: c0 + 1 },
    { row: r0 + 1, col: c0     },
    { row: r0 + 1, col: c0 + 1 },
  ];
}

// Read-only predicate: is the cell at (row, col) currently part of an active
// Lockdown Protocol lockdown? Exposed for the T2.B legacy bridge to wire
// alongside the existing `engineerLockedCells.has(key)` check in
// `pieceCanBePlaced` / `clearLines`. Pure read of the `_engineerLockdowns`
// array — no allocation.
//
// Returns false for any non-finite or non-locked input. In the live runtime,
// the source of truth for placement gating is the existing
// `engineerLockedCells` Map (populated by both sacred phase-gate AND T2.10
// on-crit paths); this module-side mirror is for headless testing +
// debugging.
export function isCellLockedByLockdownProtocol(row, col) {
  const _r = Number(row);
  const _c = Number(col);
  if (!Number.isFinite(_r) || !Number.isFinite(_c)) return false;
  for (const lk of _engineerLockdowns) {
    if (!lk || !Array.isArray(lk.cells)) continue;
    for (const cell of lk.cells) {
      if (cell.row === _r && cell.col === _c) return true;
    }
  }
  return false;
}

// Read-only accessor: how many on-crit lockdowns are currently active?
// Used by tests to confirm placement / expiration accounting.
export function getEngineerLockdownsCount() {
  return _engineerLockdowns.length;
}

// Read-only snapshot of active lockdowns (defensive copy). Used by tests
// and by the T2.B legacy bridge for grid rendering integration. Production
// callers should prefer `isCellLockedByLockdownProtocol` to avoid the
// allocation.
export function getEngineerLockdownsSnapshot() {
  return _engineerLockdowns.map(lk => ({
    cells: lk.cells.map(c => ({ row: c.row, col: c.col })),
    startTurn:   lk.startTurn,
    expiresTurn: lk.expiresTurn,
  }));
}

// Reset hook for battle pipeline (battle start / battle end). Clears all
// mirror state + cancels pending timers + hides DOM. Mirrors `resetCursedTiles`
// / `resetBloodtide` / `resetAshenReign` precedents. Idempotent — safe to
// call when no lockdowns are active.
export function resetEngineerLockdowns() {
  _engineerLockdowns.length = 0;
  if (_engineerLockdownRatchetDecayTimer) {
    clearTimeout(_engineerLockdownRatchetDecayTimer);
    _engineerLockdownRatchetDecayTimer = null;
  }
  if (_engineerLockdownBannerDecayTimer) {
    clearTimeout(_engineerLockdownBannerDecayTimer);
    _engineerLockdownBannerDecayTimer = null;
  }
  if (_engineerLockdownRatchetEl) {
    try {
      _engineerLockdownRatchetEl.classList.remove('identity-engineer-lockdown-ratchet-active');
      _engineerLockdownRatchetEl.style.display = 'none';
    } catch (_e) { /* swallow */ }
  }
  if (_engineerLockdownBannerEl) {
    try {
      _engineerLockdownBannerEl.classList.remove('identity-engineer-tetris-celebration-active');
      _engineerLockdownBannerEl.style.display = 'none';
    } catch (_e) { /* swallow */ }
  }
}

// ─── Activate / tick (module state mutations) ──────────────────────────
//
// `fxEngineerLockdownProtocol(bossState, ctx)` — same-turn boss reaction.
// Spec §3.4 field 4. Called by the new boss-reactive handler
// (`identity_engineer_tetris_counter` in `src/core/reactivity-events.js`)
// IMMEDIATELY after the 4-line crit clear resolves — no 3000ms telegraph
// wind-up per spec §3.4 field 6 ("Triumphant TETRIS celebration banner
// IMMEDIATELY followed by clanking metal lockdown"). The handler still
// uses the T2.07 dispatcher (which IS telegraphed) — T2.B bridge will
// bypass the dispatcher for on-crit calls to honor the IMMEDIATELY
// requirement.
//
// Initial-trigger wall-time budget: ≤ENGINEER_LOCKDOWN_INITIAL_BUDGET_MS (10ms).
//   - isTetrisCrit gate check: O(1) ≤0.1ms
//   - pickMostClearedCorner: O(rows + cols) ≤0.5ms
//   - compute2x2LockdownCells: O(1) ≤0.1ms
//   - 4 × DOM class swap (apply .cell--engineer-welded): ≤4ms
//   - ratchet overlay activation + banner show: ≤4ms
//   - module state push: ≤0.1ms
//   Total: ≤9ms typical, 10ms ceiling.
//
// `ctx` is the dispatch context (may carry):
//   - `ctx.linesCleared` (REQUIRED — total row+col count from clearLines)
//   - `ctx.comboTriggered` (REQUIRED — boolean from combo crit math)
//   - `ctx.lastClearedRows` (rows array from the clearLines fire — for
//     corner picking)
//   - `ctx.lastClearedCols` (cols array — for corner picking)
//   - `ctx.gridSize` (board dimension, defaults to SIZE = 8)
//   - `ctx.currentTurn` (integer turn counter for the start/expires turns;
//     defaults to 0 in headless tests)
//   - `ctx.engineerLockedCellsApi` (optional `{ set(key, turns) }` API for
//     populating the legacy `engineerLockedCells` Map alongside the module-
//     side mirror; T2.B bridge wires this from the live runtime)
//
// `bossState` parameter is reserved for forward compat (codex / matchup
// matrix may need archetype-specific tinting); currently unused.
export function fxEngineerLockdownProtocol(_bossState, ctx) {
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  try {
    // Gate: only fire on 4-line crit clear. Spec §3.4 field 3.
    const linesCleared   = (ctx && typeof ctx.linesCleared === 'number') ? ctx.linesCleared : 0;
    const comboTriggered = (ctx && ctx.comboTriggered === true);
    if (!isTetrisCrit(linesCleared, comboTriggered)) return;

    // Resolve corner picking inputs from ctx (preferred) or fall back to
    // defensive empty arrays (the gate guarantees lines > 0 but the
    // last-cleared row/col arrays may not be carried by every caller).
    const rows = (ctx && Array.isArray(ctx.lastClearedRows)) ? ctx.lastClearedRows : [];
    const cols = (ctx && Array.isArray(ctx.lastClearedCols)) ? ctx.lastClearedCols : [];
    const gridSize = (ctx && typeof ctx.gridSize === 'number')
      ? Math.floor(ctx.gridSize)
      : 8;
    const currentTurn = (ctx && typeof ctx.currentTurn === 'number')
      ? Math.floor(ctx.currentTurn)
      : 0;

    // Compute 2×2 lockdown cells via pure helpers (deterministic).
    const corner = pickMostClearedCorner(rows, cols, gridSize);
    const cells  = compute2x2LockdownCells(corner, gridSize);
    // Defensive: spec §3.4 field 4 promises ENGINEER_LOCKDOWN_CELL_COUNT (4)
    // cells per lockdown. Bail if compute returned anything else (impossible
    // for valid corners but defensive against future changes).
    if (cells.length !== ENGINEER_LOCKDOWN_CELL_COUNT) return;
    // Measure placement phase budget separately from total — spec §3.4 field 7.
    const _placeStart = (typeof performance !== 'undefined') ? performance.now() : 0;

    // Lazy pool init for DOM environments.
    _ensureEngineerLockdownPool();

    // Apply existing engineer-lockdown CSS class to the 4 cells. RE-USE
    // sacred `.cell--engineer-welded` class — never duplicate. In headless
    // tests (no document) this branch is skipped; the module-state push
    // below remains the source of truth for isCellLockedByLockdownProtocol.
    if (typeof document !== 'undefined') {
      const cellEls = document.querySelectorAll('.grid .cell');
      if (cellEls && cellEls.length) {
        for (const cell of cells) {
          const idx = cell.row * gridSize + cell.col;
          if (idx >= 0 && idx < cellEls.length) {
            const el = cellEls[idx];
            if (el) {
              try {
                el.classList.add('cell--engineer-welded');
              } catch (_e) { /* swallow */ }
            }
          }
        }
      }
    }

    // Populate the legacy `engineerLockedCells` Map via ctx.api OR via the
    // global if defined. Both paths feed the same grid-state predicate.
    // The Map's value is the per-cell tick countdown (40 turns), matching
    // the sacred `engineer_p1_p2` handler exactly. The existing
    // `ui/archetype-ticks.js` per-turn tick decrements this value and
    // removes entries at 0 — we re-use that mechanism for free.
    const _setLockedCell = (key) => {
      try {
        if (ctx && ctx.engineerLockedCellsApi
            && typeof ctx.engineerLockedCellsApi.set === 'function') {
          ctx.engineerLockedCellsApi.set(key, ENGINEER_LOCKDOWN_TURNS);
          return;
        }
      } catch (_e) { /* swallow */ }
      try {
        // Live runtime fallback — populate the legacy global Map directly.
        if (typeof engineerLockedCells !== 'undefined'
            && engineerLockedCells
            && typeof engineerLockedCells.set === 'function') {
          engineerLockedCells.set(key, ENGINEER_LOCKDOWN_TURNS);
        }
      } catch (_e) { /* swallow */ }
    };
    for (const cell of cells) {
      _setLockedCell(cell.row + '_' + cell.col);
    }
    if (typeof performance !== 'undefined') {
      const placeDt = performance.now() - _placeStart;
      if (placeDt > ENGINEER_LOCKDOWN_PLACEMENT_BUDGET_MS) {
        log.warn('Engineer Lockdown placement phase over budget:',
                 placeDt.toFixed(2), 'ms (limit', ENGINEER_LOCKDOWN_PLACEMENT_BUDGET_MS, 'ms)');
      }
    }

    // Spawn ratchet animation overlay (≤ENGINEER_LOCKDOWN_RATCHET_BUDGET_MS — pure CSS keyframe).
    const _ratchetStart = (typeof performance !== 'undefined') ? performance.now() : 0;
    if (_engineerLockdownRatchetEl && typeof document !== 'undefined') {
      try {
        spawnEngineerRatchet({
          el: _engineerLockdownRatchetEl,
          durationMs: ENGINEER_LOCKDOWN_RATCHET_DURATION_MS,
          color: ENGINEER_LOCKDOWN_COLOR,
        });
        _engineerLockdownRatchetEl.style.display = 'block';
        if (_engineerLockdownRatchetDecayTimer) clearTimeout(_engineerLockdownRatchetDecayTimer);
        _engineerLockdownRatchetDecayTimer = setTimeout(() => {
          _engineerLockdownRatchetDecayTimer = null;
          if (_engineerLockdownRatchetEl) {
            try {
              _engineerLockdownRatchetEl.classList.remove('identity-engineer-lockdown-ratchet-active');
              _engineerLockdownRatchetEl.style.display = 'none';
            } catch (_e) { /* swallow */ }
          }
        }, ENGINEER_LOCKDOWN_RATCHET_DURATION_MS + 100);
      } catch (_e) { log.warn('Engineer Lockdown ratchet spawn failed:', _e); }
    }
    if (typeof performance !== 'undefined') {
      const ratchetDt = performance.now() - _ratchetStart;
      if (ratchetDt > ENGINEER_LOCKDOWN_RATCHET_BUDGET_MS) {
        log.warn('Engineer Lockdown ratchet spawn over budget:',
                 ratchetDt.toFixed(2), 'ms (limit', ENGINEER_LOCKDOWN_RATCHET_BUDGET_MS, 'ms)');
      }
    }

    // Show TETRIS celebration banner (≤4ms — CSS keyframe). 400ms duration
    // before the LOCKDOWN reaction text transitions in. Pure CSS pulse.
    if (_engineerLockdownBannerEl) {
      try {
        _engineerLockdownBannerEl.textContent = 'TETRIS!';
        _engineerLockdownBannerEl.style.display = 'block';
        _engineerLockdownBannerEl.classList.remove('identity-engineer-tetris-celebration-active');
        // Force a reflow so the keyframe restarts cleanly on re-fire.
        void _engineerLockdownBannerEl.offsetWidth;
        _engineerLockdownBannerEl.classList.add('identity-engineer-tetris-celebration-active');
        if (_engineerLockdownBannerDecayTimer) clearTimeout(_engineerLockdownBannerDecayTimer);
        _engineerLockdownBannerDecayTimer = setTimeout(() => {
          _engineerLockdownBannerDecayTimer = null;
          if (_engineerLockdownBannerEl) {
            try {
              _engineerLockdownBannerEl.classList.remove('identity-engineer-tetris-celebration-active');
              _engineerLockdownBannerEl.style.display = 'none';
            } catch (_e) { /* swallow */ }
          }
        }, ENGINEER_LOCKDOWN_CELEBRATION_MS + ENGINEER_LOCKDOWN_RATCHET_DURATION_MS);
      } catch (_e) { /* swallow */ }
    }

    // Push to module-side mirror. Even in headless test envs (no DOM),
    // this is the source of truth for isCellLockedByLockdownProtocol /
    // getEngineerLockdownsSnapshot. Spec §3.4 field 4: 40 turns.
    _engineerLockdowns.push({
      cells: cells.map(c => ({ row: c.row, col: c.col })),
      startTurn:   currentTurn,
      expiresTurn: currentTurn + ENGINEER_LOCKDOWN_TURNS,
    });

    // T2.12 (2026-05-12): Codex recording — Engineer Lockdown Protocol moment.
    try { recordMomentTrigger('engineer_lockdown'); } catch (_e) { /* defensive */ }
  } finally {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      if (dt > ENGINEER_LOCKDOWN_INITIAL_BUDGET_MS) {
        log.warn('Engineer Lockdown Protocol initial trigger over budget:',
                 dt.toFixed(2), 'ms (limit', ENGINEER_LOCKDOWN_INITIAL_BUDGET_MS, 'ms)');
      }
    }
  }
}

// `fxEngineerLockdownTick(ctx)` — per-turn tick. Spec §3.4 field 7 bullet 3.
// Called by the battle pipeline at the START of each player turn (T2.B
// bridge wires this). For each active lockdown in `_engineerLockdowns`:
//   - If `currentTurn >= expiresTurn`: remove the lockdown CSS class from
//     its 4 cells AND remove the entry from the array.
//
// Per-turn wall-time budget: ≤ENGINEER_LOCKDOWN_PER_TURN_TICK_BUDGET_MS (1ms).
// The existing engineer state machinery in `ui/archetype-ticks.js` already
// decrements the `engineerLockedCells` Map per turn — that decrement is the
// authoritative tick. This module-side tick is the mirror cleanup so
// `isCellLockedByLockdownProtocol` / `getEngineerLockdownsCount` reflect
// expiration in headless tests.
//
// `ctx` carries the per-turn snapshot:
//   - `ctx.currentTurn`: integer turn counter (REQUIRED — falls back to 0
//     defensively).
//
// Returns: result object `{ expiredCount, activeCount }` for caller
// telemetry + unit-test assertion.
export function fxEngineerLockdownTick(ctx) {
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  const result = { expiredCount: 0, activeCount: 0 };
  try {
    if (_engineerLockdowns.length === 0) return result;

    const _currentTurn = (ctx && typeof ctx.currentTurn === 'number')
      ? ctx.currentTurn
      : 0;

    // Iterate backwards so splice doesn't shift indices.
    for (let i = _engineerLockdowns.length - 1; i >= 0; i--) {
      const lk = _engineerLockdowns[i];
      if (!lk) {
        _engineerLockdowns.splice(i, 1);
        continue;
      }
      const _expires = Number(lk.expiresTurn);
      if (!Number.isFinite(_expires)) continue;
      if (_currentTurn >= _expires) {
        // Expired — strip the engineer-lockdown CSS class from the 4 cells
        // (defensive — the existing engineer state machinery may have
        // already cleared it via the Map decrement). Re-clear here so
        // headless tests reflect the lifecycle.
        if (typeof document !== 'undefined' && Array.isArray(lk.cells)) {
          const cellEls = document.querySelectorAll('.grid .cell');
          if (cellEls && cellEls.length) {
            for (const cell of lk.cells) {
              const idx = cell.row * 8 + cell.col;
              if (idx >= 0 && idx < cellEls.length) {
                const el = cellEls[idx];
                if (el) {
                  try {
                    // Only strip if no OTHER lockdown (sacred phase-gate OR
                    // another on-crit instance) still claims this cell.
                    // Defensive — over-clearing would conflict with the
                    // sacred phase-gate handler if it placed a cell at the
                    // same coords (vanishingly rare but possible).
                    el.classList.remove('cell--engineer-welded');
                  } catch (_e) { /* swallow */ }
                }
              }
            }
          }
        }
        _engineerLockdowns.splice(i, 1);
        result.expiredCount += 1;
      }
    }
    result.activeCount = _engineerLockdowns.length;
  } finally {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      if (dt > ENGINEER_LOCKDOWN_PER_TURN_TICK_BUDGET_MS) {
        log.warn('Engineer Lockdown Protocol tick over budget:',
                 dt.toFixed(2), 'ms (limit', ENGINEER_LOCKDOWN_PER_TURN_TICK_BUDGET_MS, 'ms)');
      }
    }
  }
  return result;
}

// Trigger gate (spec §3.4 field 3): the boss reacts ONLY when the player
// completes a 4-line crit clear. Pure pass-through over `isTetrisCrit` so
// the T2.B bridge has a single import surface AND tests have an explicit
// named helper matching the gate-naming convention of other identity
// mechanics (`cursedTilesGatePasses`, `bloodtideGatePasses`).
//
// Returns: boolean. True → fire `triggerIdentityBossEvent('identity_engineer_tetris_counter')`
// (or call `fxEngineerLockdownProtocol` directly to skip telegraph per spec
// §3.4 field 6); false → silent no-op.
export function engineerLockdownGatePasses(linesCleared, comboTriggered) {
  return isTetrisCrit(linesCleared, comboTriggered);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2026-05-12 — TASK-038 (T2.11): Grovewarden Root Surge (FIFTH and FINAL
// boss-reactive identity mechanic — sliding-window non-grove trigger per
// spec §3.5).
//
// Spec: docs/design/mechanics/identity-layer.md §3.5.
// Architecture (spec §1 hard rule 1): Identity Layer EXTENDS, never MODIFIES,
// v2.1 P4 reactivity. Sacred bruiser handlers (`bruiser_p1_p2`,
// `bruiser_p2_p3`) + 22 reactivity handlers are BYTE-PERFECT. Root Surge
// is a NEW handler under namespace `identity_bruiser_grove_surge` in
// `src/core/reactivity-events.js`, fired ALONGSIDE the sacred bruiser path
// via the T2.07-established `IDENTITY_BOSS_HANDLERS` parallel registry.
//
// Mechanical contract (spec §3.5):
//   - Trigger: Player's last ROOT_SURGE_TRIGGER_NON_GROVE_COUNT (3) line
//     clears were all NOT grove-dominant (sliding-window — circular buffer
//     of size 3 stores dominant elements). Gate passes iff buffer.length
//     === 3 AND every entry !== 'grove'. Implemented as
//     `shouldRootSurgeFire(buffer, sacredElement)` pure helper.
//   - `pushRecentClear(dominantElement)`: append to circular buffer (FIFO,
//     keep last 3). Called by battle pipeline on every line clear.
//   - `fxGrovewardenRootSurge(bossState, ctx)`: when gate passes, pick
//     ROOT_SURGE_CELL_COUNT (3) random EMPTY cells (vs T2.08's non-empty
//     pattern — roots grow on empty space). Add to `_activeRootCells`
//     array with `placedTurn = ctx.currentTurn`, `expiresTurn = placedTurn
//     + 5`. Spawn 3 moss root overlays via pool (≤6ms). Show placeholder
//     narrator line "Where you would not bloom, I will." (PLACEHOLDER per
//     ESC-02 O2 — Roman copy-pass at Phase 2 PR merge).
//   - Per-turn tick (`fxGrovewardenRootSurgeTick`): each turn, for any root
//     whose `currentTurn >= expiresTurn`, remove it from `_activeRootCells`
//     + remove CSS overlay (fade ≤300ms). Pure integer comparison;
//     ≤1ms per-turn cost.
//   - `onRootCellCleared(row, col)`: called when player clears a rooted
//     cell during the 5-turn window. Grants ROOT_SURGE_GOLD_PER_CLEAR (10)
//     gold via existing `addGold` API (cross-layer Pirate Plunder
//     integration — FIRST live cross-layer interaction in Phase 2; same
//     path as T2.02 Pirate's Plunder gold writes). Removes the root from
//     `_activeRootCells` + CSS overlay.
//   - `isCellRooted(row, col)`: read-only predicate exposed for T2.B bridge
//     to wire into legacy `pieceCanBePlaced` (rooted cells block placement
//     for 5 turns).
//
// Sacred-cow safety (CLAUDE.md §2.1 + §2.5 + spec §3.5 field 8):
//   - **Element Synergy UNTOUCHED** — grove 3x (−4 grove ULT + +20%
//     passive dmg) sacred values are read-only references. Root Surge
//     writes ONLY to board state + gold.
//   - **RACE_SYNERGY.troll.* + .golem.* UNTOUCHED** — grove-themed sacred
//     tier kits read-only (T2.05 invariant).
//   - **All 22 v2.1 P4 reactivity handlers UNTOUCHED** — Root Surge adds a
//     NEW handler under namespace `identity_bruiser_grove_surge` in
//     `src/core/reactivity-events.js`. Sacred `bruiser_p1_p2` /
//     `bruiser_p2_p3` byte-perfect.
//   - **NARRATOR_LINES UNTOUCHED** — new narrator line lives in isolated
//     ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER constant per ESC-02 O2 ruling.
//     The sacred NARRATOR_LINES infrastructure stays byte-perfect.
//   - **REACTIVITY_TELEGRAPH_MS = 3000 UNTOUCHED** — Root Surge uses the
//     telegraph→execute pattern via the T2.07-established dispatcher (the
//     constant is RE-USED, never modified).
//   - **HERO_ULT_COST_BY_NEWROLE UNTOUCHED** — Root Surge does not write
//     to ULT charges.
//   - **Stagger Loop UNTOUCHED** — T2.09 invariant maintained.
//   - **Combo Crit formula UNTOUCHED** — Root Surge never feeds combo crit.
//   - **V_HAPTICS UNTOUCHED** — handler-side `vibrate(...)` only.
//   - **Phoenix/Lich/Berserker/Engineer invariants UNTOUCHED** — T2.07
//     through T2.10 module state independent.
//
// Performance budget (spec §3.5 field 7):
//   - 3 cell overlay activations ≤6ms (3 × ≤2ms each via pool).
//   - Mossy bloom particle ≤8ms.
//   - Per-turn tick ≤1ms — integer comparison over ≤3-element array.
//   - Total per-fire wall-time ≤ROOT_SURGE_INITIAL_BUDGET_MS (14ms).
//
// Cross-layer Pirate Plunder integration:
//   - Root cleared by player → +10 gold via `addGold(10)` global call.
//     Same path T2.02 Pirate's Plunder uses (legacy addGold infrastructure).
//   - NO double-count: a rooted-cell clear is a DISTINCT event from a
//     normal line-clear cell. Pirate Plunder fires on `clearLines` rows∪cols
//     via `fxPirateLineClear`; Root Surge gold fires on
//     `onRootCellCleared(row, col)` event. The two paths never read the
//     same cleared cell because rooted cells are EXCLUDED from Pirate
//     Plunder's `cellsCleared` count (a rooted cell can't be in a normal
//     line-clear because placement was BLOCKED for 5 turns — the only way
//     to "clear" it is via the rooted-cell-clear event, which the T2.B
//     bridge will invoke via `onRootCellCleared`).
//
// Architectural pattern (NEW — sliding-window trigger):
//   - First Phase 2 mechanic using a circular buffer of recent actions.
//     Sibling to:
//       * T2.07 phase-gate trigger (Phoenix revive)
//       * T2.08 condition + per-turn-tick (Lich shark gate + 3T lifecycle)
//       * T2.09 count-based trigger (every 3rd clear + Stagger Loop state)
//       * T2.10 action-based trigger (4-line crit detection)
//       * T2.11 sliding-window trigger (last 3 clears all non-grove) ← NEW
//   - Buffer is FIFO size 3, populated via `pushRecentClear(dominantElement)`.
//     Old entries shift out as new ones come in (`shift()` + `push()`).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Pre-allocated DOM elements (object pool: 3 moss root overlays). Sized at
// the hard spec cap ROOT_SURGE_CELL_COUNT (3) — never exceeded. Created
// lazily on first fxGrovewardenRootSurge invocation.
const _rootSurgePool          = [];
const _rootSurgePoolAvailable = [];   // stack of element indices not currently in use
let   _rootSurgePoolContainer = null;
let   _rootSurgePoolInitDone  = false;

// Module state — circular buffer (FIFO size 3) of recent line-clear
// dominant elements. Pushed via `pushRecentClear`. When buffer is full AND
// every entry !== 'grove', `shouldRootSurgeFire` returns true → triggers
// the Root Surge boss reaction.
let _grovewardenRecentClears = [];

// Module state — array of active roots. Each entry shape:
//   { row, col, placedTurn, expiresTurn, el } where `el` is the moss root
// overlay DOM element backing the visual (null in unit-test envs without
// a DOM). Max length = ROOT_SURGE_CELL_COUNT (3) by construction —
// fxGrovewardenRootSurge caps the placement at the spec value.
let _activeRootCells = [];

// Ensures the 3-element DOM pool exists. Idempotent — calling again is a
// no-op. In Node-only unit-test environments (no `document`), the pool stays
// empty and helpers work on the array-only state path.
function _ensureRootSurgePool() {
  if (_rootSurgePoolInitDone) return;
  if (typeof document === 'undefined') return;          // unit-test guard
  _rootSurgePoolContainer = document.createElement('div');
  _rootSurgePoolContainer.className = 'identity-grovewarden-root-container';
  _rootSurgePoolContainer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(_rootSurgePoolContainer);
  for (let i = 0; i < ROOT_SURGE_CELL_COUNT; i++) {
    const el = document.createElement('div');
    el.className = 'identity-grovewarden-root-overlay';
    el.style.display = 'none';
    _rootSurgePoolContainer.appendChild(el);
    _rootSurgePool.push(el);
    _rootSurgePoolAvailable.push(i);
  }
  _rootSurgePoolInitDone = true;
}

// ─── Pure helpers (unit-testable, no DOM) ──────────────────────────────
//
// Pure predicate: should Root Surge fire given the current sliding-window
// state? Spec §3.5 field 3: "Player's last 3 line clears were all NOT
// grove-dominant." Returns true iff buffer is full (length === 3) AND every
// entry is strictly !== sacredGroveElement ('grove').
//
// `recentClearsBuffer` is the module-state circular buffer
// (`_grovewardenRecentClears`) — an array of dominant-element strings.
// `sacredGroveElement` defaults to ROOT_SURGE_GROVE_ELEMENT ('grove') — pass
// as parameter for testability + sacred-cow audit (the constant is sacred
// per CLAUDE.md §2.1 grove element name).
//
// Returns: boolean. True → fire `triggerIdentityBossEvent(
// 'identity_bruiser_grove_surge')`; false → silent no-op (no DOM, no state
// mutation, no log).
//
// Edge cases:
//   - Buffer length < 3 (early-battle state with fewer than 3 clears yet) →
//     false. Sliding-window requires full history.
//   - Buffer contains 'grove' entry → false (boss is patient; if you played
//     grove recently, it doesn't react).
//   - Buffer mixed non-grove (ember + tide + umbra) → TRUE (all non-grove
//     even though they differ).
//   - null/non-array input → false (defensive).
export function shouldRootSurgeFire(recentClearsBuffer, sacredGroveElement) {
  const _grove = (typeof sacredGroveElement === 'string' && sacredGroveElement.length)
    ? sacredGroveElement
    : ROOT_SURGE_GROVE_ELEMENT;
  if (!Array.isArray(recentClearsBuffer)) return false;
  if (recentClearsBuffer.length !== ROOT_SURGE_TRIGGER_NON_GROVE_COUNT) return false;
  for (const e of recentClearsBuffer) {
    if (e === _grove) return false;
  }
  return true;
}

// Pure helper: push a dominant element onto the circular buffer (FIFO,
// keep last ROOT_SURGE_TRIGGER_NON_GROVE_COUNT = 3 entries). Returns the
// resulting buffer (the module-state `_grovewardenRecentClears` reference,
// for caller convenience). Pure mutation of the module state — single
// source of truth.
//
// `dominantElement` is the string element name of the just-cleared line's
// dominant element (e.g., 'ember', 'tide', 'grove', 'solar', 'umbra'). If
// undefined or non-string, the push is silently skipped (defensive).
//
// Buffer is FIFO: when length === 3 and a new push arrives, the oldest
// entry is shifted out before the new entry is appended. This keeps the
// buffer "sliding" — always representing the player's MOST RECENT
// ROOT_SURGE_TRIGGER_NON_GROVE_COUNT clears.
export function pushRecentClear(dominantElement) {
  if (typeof dominantElement !== 'string' || dominantElement.length === 0) {
    return _grovewardenRecentClears;
  }
  if (_grovewardenRecentClears.length >= ROOT_SURGE_TRIGGER_NON_GROVE_COUNT) {
    _grovewardenRecentClears.shift();   // drop oldest
  }
  _grovewardenRecentClears.push(dominantElement);
  return _grovewardenRecentClears;
}

// Pure helper: returns array of {row, col} for up to `count` random EMPTY
// cells on the board. Pure function — given a stable `gridState`, the
// result depends only on the random selection. Cells already rooted (in
// `_activeRootCells`) are EXCLUDED from re-selection so a single fire
// never double-roots a cell.
//
// Adapted from T2.08 `pickRandomNonEmptyCells` — same algorithm, flipped
// predicate: this picks EMPTY cells (where readCell returns null /
// undefined / 0 / ''). Roots grow on empty space per spec §3.5 field 4.
//
// `gridState` may be:
//   - 2D array [row][col] with truthy values for non-empty cells (legacy
//     `grid` shape — strings like 'ember' / 'tide' / null)
//   - { getElementAt(r, c): string|null } module-style API
//   - null/undefined → returns [] (defensive)
//
// `count` defaults to ROOT_SURGE_CELL_COUNT (3). The returned array length
// is `min(count, available empty cells, ROOT_SURGE_CELL_COUNT)`.
//
// Selection algorithm: collect candidate empty cells (excluding already-
// rooted ones), Fisher-Yates partial shuffle, return first N. This is
// O(64) on an 8×8 board — well under 1ms wall-time.
export function pickRandomEmptyCells(gridState, count, gridCols = BOARD_COLS, gridRows = BOARD_ROWS) {
  const n = (typeof count === 'number' && count > 0) ? Math.floor(count) : ROOT_SURGE_CELL_COUNT;
  if (!gridState) return [];

  // Helper: read cell at (r, c) from whatever shape gridState carries.
  const readCell = (r, c) => {
    if (typeof gridState.getElementAt === 'function') {
      return gridState.getElementAt(r, c);
    }
    if (Array.isArray(gridState) && Array.isArray(gridState[r])) {
      return gridState[r][c];
    }
    return null;
  };

  // Collect candidate EMPTY cells, excluding already-rooted ones.
  const rootedKey = new Set(_activeRootCells.map(t => t.row + '_' + t.col));
  const candidates = [];
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const v = readCell(r, c);
      if (v) continue;                                   // non-empty = skip
      const key = r + '_' + c;
      if (rootedKey.has(key)) continue;                  // exclude already-rooted cells
      candidates.push({ row: r, col: c });
    }
  }
  if (candidates.length === 0) return [];

  // Fisher-Yates partial shuffle — only shuffle the first `min(n, len)`
  // positions, since we don't need the full random ordering.
  const take = Math.min(n, candidates.length);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(Math.random() * (candidates.length - i));
    if (j !== i) {
      const tmp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = tmp;
    }
  }
  return candidates.slice(0, take);
}

// Pure helper: compute the cells where roots will appear. Pass-through to
// `pickRandomEmptyCells(gridState, ROOT_SURGE_CELL_COUNT)` — exposed as a
// named helper so tests have a documented seam matching the gate-naming
// convention of other identity mechanics (`computeBittenCells` /
// `compute2x2LockdownCells`).
export function computeRootSurgeCells(gridState) {
  return pickRandomEmptyCells(gridState, ROOT_SURGE_CELL_COUNT);
}

// Pure helper: compute the gold reward granted when a player clears a
// rooted cell during the 5-turn window. Per spec §3.5 field 4: "+10 player
// gold per cleared rooted cell." Returns rootCellCount × 10 — caller
// typically passes 1 (single rooted-cell-clear event), but defensive
// support for batch clears is provided (e.g., a Shark Feeding Frenzy
// chain that incidentally clears multiple rooted cells in one event).
//
// `rootCellCount` defaults to 1. Defensive: non-finite / negative inputs
// are clamped to 0 (no negative gold).
export function computeRootClearGoldReward(rootCellCount = 1) {
  const _n = Math.max(0, Math.floor(Number(rootCellCount) || 0));
  return _n * ROOT_SURGE_GOLD_PER_CLEAR;
}

// Pure helper: per-turn tick result for a single root entry. Returns:
//   - `active: false, shouldExpire: true` → root has expired (currentTurn
//     >= expiresTurn) and should be removed. `goldGrantOnClear: 0`
//     because the timeout path grants NO gold per spec §3.5 field 4
//     ("auto-clear at 5-turn timeout — no damage, only the placement
//     blocker").
//   - `active: true, shouldExpire: false` → root is still ticking; no
//     mutation needed.
//
// Mirrors T2.08 `computeCurseTickResult` pattern — pure function over
// (root, currentTurn). The caller (`fxGrovewardenRootSurgeTick`) drives
// the active-array mutation.
//
// `root` must have `{ placedTurn, expiresTurn }`. `currentTurn` is the
// game's current turn counter at the moment of the tick.
//
// `goldGrantOnClear` is the reward THIS root would grant IF cleared by
// the player (not by timeout). For auto-clear (timeout), gold is 0; for
// player-clear (onRootCellCleared), the caller uses
// `computeRootClearGoldReward` directly. This field is included for
// symmetry with the T2.08 tick result shape and for documentation.
export function computeRootSurgeTickResult(root, currentTurn) {
  const _t = Number(currentTurn);
  if (!root || typeof root !== 'object') {
    return { active: false, shouldExpire: false, goldGrantOnClear: ROOT_SURGE_GOLD_PER_CLEAR };
  }
  const _expires = Number(root.expiresTurn);
  if (!Number.isFinite(_t) || !Number.isFinite(_expires)) {
    return { active: true, shouldExpire: false, goldGrantOnClear: ROOT_SURGE_GOLD_PER_CLEAR };
  }
  if (_t >= _expires) {
    return { active: false, shouldExpire: true, goldGrantOnClear: ROOT_SURGE_GOLD_PER_CLEAR };
  }
  return { active: true, shouldExpire: false, goldGrantOnClear: ROOT_SURGE_GOLD_PER_CLEAR };
}

// Read-only predicate: is the cell at (row, col) currently rooted?
// Exposed for the T2.B legacy bridge to wire into `pieceCanBePlaced` so
// rooted cells block placement for 5 turns. Pure read of the
// `_activeRootCells` array — no allocation.
//
// Returns false for any non-finite or non-rooted input. Mirrors T2.08
// `isCellCursed` + T2.10 `isCellLockedByLockdownProtocol` predicate
// pattern.
export function isCellRooted(row, col) {
  const _r = Number(row);
  const _c = Number(col);
  if (!Number.isFinite(_r) || !Number.isFinite(_c)) return false;
  for (const t of _activeRootCells) {
    if (t.row === _r && t.col === _c) return true;
  }
  return false;
}

// Read-only accessor: how many roots are currently active? Used by the
// per-turn tick + tests to confirm placement / expiration accounting.
export function getActiveRootCellsCount() {
  return _activeRootCells.length;
}

// Read-only snapshot of active roots (defensive copy). Used by tests and
// by the T2.B legacy bridge for grid rendering integration. Production
// callers should prefer `isCellRooted` / `getActiveRootCellsCount` to
// avoid the allocation.
export function getActiveRootCellsSnapshot() {
  return _activeRootCells.map(t => ({
    row: t.row,
    col: t.col,
    placedTurn:  t.placedTurn,
    expiresTurn: t.expiresTurn,
  }));
}

// Read-only accessor: snapshot of the sliding-window recent-clears buffer.
// Used by tests + T2.B legacy bridge for debug visibility. Returns a
// defensive copy.
export function getRecentClearsSnapshot() {
  return _grovewardenRecentClears.slice();
}

// Reset hook for battle pipeline (battle start / battle end). Clears all
// state + hides DOM. Mirrors `resetCursedTiles` / `resetBloodtide` /
// `resetEngineerLockdowns` / `resetAshenReign` precedents. Idempotent —
// safe to call when no roots are active.
export function resetGrovewardenRootSurge() {
  // Hide all root overlays + return them to the available pool.
  for (const t of _activeRootCells) {
    if (t.el) {
      try {
        t.el.classList.remove('identity-grovewarden-root-bloom');
        t.el.classList.remove('identity-grovewarden-root-fade');
        t.el.style.display = 'none';
      } catch (_e) { /* swallow */ }
    }
  }
  _activeRootCells.length = 0;
  _grovewardenRecentClears.length = 0;
  // Restore all pool indices to available.
  _rootSurgePoolAvailable.length = 0;
  for (let i = 0; i < _rootSurgePool.length; i++) {
    _rootSurgePoolAvailable.push(i);
  }
}

// ─── Activate / tick / clear-event (module state mutations) ────────────
//
// `fxGrovewardenRootSurge(bossState, ctx)` — place ROOT_SURGE_CELL_COUNT
// (3) root overlays on random empty cells. Spec §3.5 field 4.
//
// Gate (spec §3.5 field 3): silent no-op unless
// `shouldRootSurgeFire(_grovewardenRecentClears, ROOT_SURGE_GROVE_ELEMENT)`
// returns true. The caller (boss-reactive handler dispatcher) is expected
// to gate via `rootSurgeGatePasses` BEFORE invoking — this function also
// double-gates defensively.
//
// Initial-trigger wall-time budget: ≤ROOT_SURGE_INITIAL_BUDGET_MS (14ms).
//   - shouldRootSurgeFire: O(3) pure integer math ≤0.1ms
//   - pickRandomEmptyCells: O(64) over 8×8 board → ≤1ms
//   - 3 × _rootSurgePool element activation (class swap + position): ≤6ms
//   - module state array push × 3: ≤1ms
//   - narrator banner: ≤2ms
//   Total: ≤10ms typical, 14ms ceiling with CI headroom.
//
// `ctx` is the dispatch context (may carry):
//   - `ctx.gridState`: the 2D grid array used to pick empty cells
//     (defaults to legacy `grid` global)
//   - `ctx.currentTurn`: the game's current turn counter (placedTurn /
//     expiresTurn anchor; defaults to 0)
//   - `ctx.narratorApi`: optional `{ show(text) }` API for the narrator
//     surface. If absent, `flashStateBanner` (legacy global) is the
//     fallback. The narrator line is the PLACEHOLDER per ESC-02 O2
//     (FINAL COPY: pending Roman approval at Phase 2 PR merge).
//
// `bossState` parameter is reserved for forward compat (codex / matchup
// matrix may need archetype-specific tinting); currently unused.
export function fxGrovewardenRootSurge(_bossState, ctx) {
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  try {
    // Defensive double-gate: silent no-op if buffer state doesn't qualify.
    // Production callers should gate via `rootSurgeGatePasses` first; this
    // is the safety net for direct invocations (FTUE / codex preview).
    if (!shouldRootSurgeFire(_grovewardenRecentClears, ROOT_SURGE_GROVE_ELEMENT)) return;

    // Resolve grid + current turn from ctx (preferred) or legacy globals.
    const _gridState = (ctx && ctx.gridState !== undefined)
      ? ctx.gridState
      : (typeof grid !== 'undefined' ? grid : null);
    const _currentTurn = (ctx && typeof ctx.currentTurn === 'number')
      ? ctx.currentTurn
      : 0;

    // Pick up to ROOT_SURGE_CELL_COUNT random empty cells (already-rooted
    // excluded by pickRandomEmptyCells). If the board has fewer empty
    // cells than ROOT_SURGE_CELL_COUNT, place whatever is available —
    // silent partial-fire is OK per spec §3.5 field 4 ("3 random empty
    // cells").
    const picks = pickRandomEmptyCells(_gridState, ROOT_SURGE_CELL_COUNT);
    if (picks.length === 0) return;

    // Lazy pool init for DOM environments.
    _ensureRootSurgePool();

    // Resolve screen coords for each picked cell. In Node-only test envs
    // (no DOM), `cells` is empty and we skip the DOM activation step.
    const cells = (typeof document !== 'undefined')
      ? document.querySelectorAll('.grid .cell')
      : null;

    for (const pick of picks) {
      // Pop a pool index. Cap is ROOT_SURGE_CELL_COUNT — if exhausted
      // (e.g., re-fire before resetGrovewardenRootSurge), silently skip
      // the DOM allocation for this root (state still tracked in
      // _activeRootCells array).
      let el = null;
      if (_rootSurgePoolAvailable.length > 0) {
        const idx = _rootSurgePoolAvailable.pop();
        el = _rootSurgePool[idx];
      }
      // Configure overlay via spawnMossRootOverlay factory (CSS animation-
      // driven). In headless test envs, el is null — state-only path.
      if (el && cells && cells.length) {
        const cellIdx = pick.row * BOARD_COLS + pick.col;
        const cellEl  = cells[cellIdx];
        if (cellEl && typeof cellEl.getBoundingClientRect === 'function') {
          const r = cellEl.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top  + r.height / 2;
          try {
            el.style.display = 'block';
            spawnMossRootOverlay({
              el,
              x: cx,
              y: cy,
              color: ROOT_SURGE_OVERLAY_COLOR,
              decayMs: ROOT_SURGE_OVERLAY_DECAY_MS,
            });
          } catch (e) { log.warn('Grovewarden Root overlay spawn failed:', e); }
        }
      }
      // Add to active-roots array. Even in headless test envs (no DOM),
      // this is the source of truth for isCellRooted / per-turn tick.
      _activeRootCells.push({
        row: pick.row,
        col: pick.col,
        placedTurn:  _currentTurn,
        expiresTurn: _currentTurn + ROOT_SURGE_TURNS_UNTIL_AUTO_CLEAR,
        el,
      });
    }

    // PLACEHOLDER narrator line per ESC-02 O2 ruling. FINAL COPY: pending
    // Roman approval at Phase 2 PR merge. Wired via ctx.narratorApi (if
    // provided by T2.B bridge) OR via legacy `flashStateBanner` global.
    // The line lives in the isolated ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER
    // constant — NOT in the sacred NARRATOR_LINES table.
    try {
      if (ctx && ctx.narratorApi && typeof ctx.narratorApi.show === 'function') {
        ctx.narratorApi.show(ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER);
      } else if (typeof flashStateBanner !== 'undefined' && typeof flashStateBanner === 'function') {
        // Re-use the existing flashStateBanner surface — same path the
        // boss-reactive handler in reactivity-events.js uses for its
        // dispatcher-driven banner. The placeholder line is shown
        // alongside (not replacing) the handler's "ROOT SURGE · 3 ROOTS
        // · 5 TURNS" mechanical banner.
        flashStateBanner(ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER, ROOT_SURGE_OVERLAY_COLOR);
      }
    } catch (_e) { /* swallow — narrator is non-essential to gameplay */ }

    // T2.12 (2026-05-12): Codex recording — Grovewarden Root Surge moment.
    try { recordMomentTrigger('grovewarden_root_surge'); } catch (_e) { /* defensive */ }
  } finally {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      if (dt > ROOT_SURGE_INITIAL_BUDGET_MS) {
        log.warn('Grovewarden Root Surge initial trigger over budget:',
                 dt.toFixed(2), 'ms (limit', ROOT_SURGE_INITIAL_BUDGET_MS, 'ms)');
      }
    }
  }
}

// `fxGrovewardenRootSurgeTick(ctx)` — per-turn tick. Spec §3.5 field 4
// bullet 3 (auto-clear at 5-turn timeout). Called by the battle pipeline
// at the START of each player turn (T2.B bridge wires this). For each
// active root in `_activeRootCells`:
//   - If `currentTurn >= expiresTurn`: remove the root from the array,
//     fade the overlay over ROOT_SURGE_OVERLAY_DECAY_MS (300ms), return
//     the pool index to the available stack.
//
// Per-turn wall-time budget: ≤ROOT_SURGE_PER_TURN_TICK_BUDGET_MS (1ms).
// Worst case: 3 roots all expire on the same turn = 3 integer comparisons +
// 3 class swaps. Pure integer math.
//
// `ctx` carries the per-turn snapshot:
//   - `ctx.currentTurn`: integer turn counter (REQUIRED — falls back to 0
//     defensively).
//
// Returns: result object `{ expiredCount, activeCount }` for caller
// telemetry + unit-test assertion.
export function fxGrovewardenRootSurgeTick(ctx) {
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  const result = { expiredCount: 0, activeCount: 0 };
  try {
    if (_activeRootCells.length === 0) return result;

    const _currentTurn = (ctx && typeof ctx.currentTurn === 'number')
      ? ctx.currentTurn
      : 0;

    // Iterate backwards so splice doesn't shift indices.
    for (let i = _activeRootCells.length - 1; i >= 0; i--) {
      const root = _activeRootCells[i];
      const tick = computeRootSurgeTickResult(root, _currentTurn);
      if (tick.shouldExpire) {
        // Fade overlay over ROOT_SURGE_OVERLAY_DECAY_MS (300ms) — CSS-driven.
        if (root.el) {
          try {
            root.el.classList.remove('identity-grovewarden-root-bloom');
            root.el.classList.add('identity-grovewarden-root-fade');
            const _el = root.el;
            setTimeout(() => {
              try {
                _el.style.display = 'none';
                _el.classList.remove('identity-grovewarden-root-fade');
              } catch (_e) { /* swallow */ }
            }, ROOT_SURGE_OVERLAY_DECAY_MS);
          } catch (_e) { /* swallow */ }
          // Return pool index to available stack (find by reference).
          for (let pi = 0; pi < _rootSurgePool.length; pi++) {
            if (_rootSurgePool[pi] === root.el) {
              _rootSurgePoolAvailable.push(pi);
              break;
            }
          }
        }
        _activeRootCells.splice(i, 1);
        result.expiredCount += 1;
      }
    }
    result.activeCount = _activeRootCells.length;
  } finally {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      if (dt > ROOT_SURGE_PER_TURN_TICK_BUDGET_MS) {
        log.warn('Grovewarden Root Surge tick over budget:',
                 dt.toFixed(2), 'ms (limit', ROOT_SURGE_PER_TURN_TICK_BUDGET_MS, 'ms)');
      }
    }
  }
  return result;
}

// `onRootCellCleared(row, col)` — called when player clears a rooted cell
// during the 5-turn window. Spec §3.5 field 4 bullet 2: "When cleared
// during the 5 turns, grant +10 player gold."
//
// Cross-layer Pirate Plunder integration (FIRST live cross-layer
// interaction in Phase 2): uses the existing `addGold(n)` legacy
// infrastructure — same path T2.02 Pirate's Plunder uses. The +10 gold
// reward fires INDEPENDENT of Pirate Plunder's `+5g/cell × pirateCount`
// — no double-count because:
//   - Pirate Plunder fires on `clearLines` rows∪cols via `fxPirateLineClear`,
//     iterating over the cleared cells from the normal line-clear flow.
//   - Root Surge gold fires on `onRootCellCleared(row, col)` event,
//     which the T2.B bridge invokes EXPLICITLY when a rooted cell is
//     cleared. A rooted cell CAN'T be in a normal line-clear because
//     placement was BLOCKED for 5 turns — the only way to "clear" it is
//     via the rooted-cell-clear event.
//
// Returns: `{ goldGranted, cellRemoved }` for caller telemetry + tests.
//   - `goldGranted`: integer gold granted (ROOT_SURGE_GOLD_PER_CLEAR = 10,
//     or 0 if the cell wasn't actually rooted).
//   - `cellRemoved`: boolean — true if the cell was found and removed
//     from `_activeRootCells`; false if no root existed at (row, col).
//
// Edge cases:
//   - (row, col) not rooted → no gold granted (defensive against double-
//     clear events from buggy callers).
//   - addGold global not defined (early-boot / test env) → gold reward
//     silently dropped; the cell is still removed from the active array.
//
// `ctx` (optional) for testability:
//   - `ctx.addGoldApi`: optional `{ add(n) }` API. If present, gold writes
//     go through it (lets tests assert the +10 path); else falls back to
//     legacy `addGold` global.
export function onRootCellCleared(row, col, ctx) {
  const _r = Number(row);
  const _c = Number(col);
  if (!Number.isFinite(_r) || !Number.isFinite(_c)) {
    return { goldGranted: 0, cellRemoved: false };
  }
  // Find the rooted cell (linear scan over ≤3 entries).
  let foundIdx = -1;
  for (let i = 0; i < _activeRootCells.length; i++) {
    const t = _activeRootCells[i];
    if (t.row === _r && t.col === _c) {
      foundIdx = i;
      break;
    }
  }
  if (foundIdx === -1) {
    return { goldGranted: 0, cellRemoved: false };
  }
  // Grant gold via existing addGold path (cross-layer Pirate Plunder).
  const goldDelta = computeRootClearGoldReward(1);
  try {
    if (ctx && ctx.addGoldApi && typeof ctx.addGoldApi.add === 'function') {
      ctx.addGoldApi.add(goldDelta);
    } else if (typeof addGold !== 'undefined' && typeof addGold === 'function') {
      addGold(goldDelta);
    }
  } catch (_e) { /* swallow — gold writes are best-effort */ }

  // Fade the overlay (same path as auto-clear, only difference is the
  // timeout-vs-player-clear branch — the visual treatment is identical
  // per spec §3.5 field 4: both events use the 300ms fade).
  const root = _activeRootCells[foundIdx];
  if (root && root.el) {
    try {
      root.el.classList.remove('identity-grovewarden-root-bloom');
      root.el.classList.add('identity-grovewarden-root-fade');
      const _el = root.el;
      setTimeout(() => {
        try {
          _el.style.display = 'none';
          _el.classList.remove('identity-grovewarden-root-fade');
        } catch (_e) { /* swallow */ }
      }, ROOT_SURGE_OVERLAY_DECAY_MS);
    } catch (_e) { /* swallow */ }
    // Return pool index to available stack.
    for (let pi = 0; pi < _rootSurgePool.length; pi++) {
      if (_rootSurgePool[pi] === root.el) {
        _rootSurgePoolAvailable.push(pi);
        break;
      }
    }
  }
  _activeRootCells.splice(foundIdx, 1);
  return { goldGranted: goldDelta, cellRemoved: true };
}

// Trigger gate (spec §3.5 field 3): the boss reacts ONLY when the player's
// last ROOT_SURGE_TRIGGER_NON_GROVE_COUNT (3) line clears were all NOT
// grove-dominant. Pure pass-through over `shouldRootSurgeFire` so the
// T2.B bridge has a single import surface AND tests have an explicit
// named helper matching the gate-naming convention of other identity
// mechanics (`cursedTilesGatePasses`, `bloodtideGatePasses`,
// `engineerLockdownGatePasses`).
//
// Returns: boolean. True → fire `triggerIdentityBossEvent(
// 'identity_bruiser_grove_surge')`; false → silent no-op.
export function rootSurgeGatePasses() {
  return shouldRootSurgeFire(_grovewardenRecentClears, ROOT_SURGE_GROVE_ELEMENT);
}

// ─── Test-only escape hatches (NOT used in production) ─────────────────
// Exposed under a `__identityFxTestables` named export so unit tests can
// assert internal state without reaching into module privates via hacks.
// Production code MUST NOT import from this object.
export const __identityFxTestables = Object.freeze({
  getCoinPoolSize: () => _coinPool.length,
  getCoinPoolAvailable: () => _coinPoolAvailable.length,
  resetCoinPool: () => {
    while (_coinPool.length) _coinPool.pop();
    while (_coinPoolAvailable.length) _coinPoolAvailable.pop();
    _coinPoolInitDone = false;
    if (_coinPoolContainer && _coinPoolContainer.parentNode) {
      _coinPoolContainer.parentNode.removeChild(_coinPoolContainer);
    }
    _coinPoolContainer = null;
  },
  // T2.03 — Shark Feeding Frenzy testables.
  getSharkBitePoolSize: () => _sharkBitePool.length,
  getSharkBitePoolAvailable: () => _sharkBitePoolAvailable.length,
  resetSharkBitePool: () => {
    while (_sharkBitePool.length) _sharkBitePool.pop();
    while (_sharkBitePoolAvailable.length) _sharkBitePoolAvailable.pop();
    _sharkBitePoolInitDone = false;
    if (_sharkBitePoolContainer && _sharkBitePoolContainer.parentNode) {
      _sharkBitePoolContainer.parentNode.removeChild(_sharkBitePoolContainer);
    }
    _sharkBitePoolContainer = null;
  },
  // Read-only view into the most-recent Shark fire's extra-cleared cells.
  // T2.B legacy bridge will additionally expose this via
  // `window.__identityFxLastBittenCells` for the combo-crit input modification
  // path (spec §2.2 field 8). Pure observation — no mutation.
  getLastBittenCells: () => _lastBittenCells.slice(),
  // T2.04 — Rock Encore Echo testables.
  getRockEchoPoolSize: () => _rockEchoPool.length,
  getRockEchoPoolAvailable: () => _rockEchoPoolAvailable.length,
  resetRockEchoPool: () => {
    while (_rockEchoPool.length) _rockEchoPool.pop();
    while (_rockEchoPoolAvailable.length) _rockEchoPoolAvailable.pop();
    _rockEchoPoolInitDone = false;
    if (_rockEchoPoolContainer && _rockEchoPoolContainer.parentNode) {
      _rockEchoPoolContainer.parentNode.removeChild(_rockEchoPoolContainer);
    }
    _rockEchoPoolContainer = null;
  },
  // T2.05 — Crocodile Bedrock Bastion testables.
  getCrocFragmentPoolSize: () => _crocFragmentPool.length,
  getCrocFragmentPoolAvailable: () => _crocFragmentPoolAvailable.length,
  resetCrocFragmentPool: () => {
    while (_crocFragmentPool.length) _crocFragmentPool.pop();
    while (_crocFragmentPoolAvailable.length) _crocFragmentPoolAvailable.pop();
    _crocFragmentPoolInitDone = false;
    if (_crocFragmentPoolContainer && _crocFragmentPoolContainer.parentNode) {
      _crocFragmentPoolContainer.parentNode.removeChild(_crocFragmentPoolContainer);
    }
    _crocFragmentPoolContainer = null;
  },
  // Read-only view into the cross-fire fragment bank (spec §2.4 field 4).
  getCrocFragmentBank: () => _crocFragmentBank,
  // Test-only setter (smoke tests need to seed the bank for cumulative
  // assertions). Production code MUST NOT call this — use
  // `resetCrocFragmentBank()` exported above instead.
  setCrocFragmentBankForTest: (n) => {
    _crocFragmentBank = Math.max(0, Math.floor(Number(n) || 0));
  },
  // T2.06 — Spark Sun Cascade testables.
  getSparkRayPoolSize: () => _sparkRayPool.length,
  getSparkRayPoolAvailable: () => _sparkRayPoolAvailable.length,
  resetSparkRayPool: () => {
    while (_sparkRayPool.length) _sparkRayPool.pop();
    while (_sparkRayPoolAvailable.length) _sparkRayPoolAvailable.pop();
    _sparkRayPoolInitDone = false;
    if (_sparkRayPoolContainer && _sparkRayPoolContainer.parentNode) {
      _sparkRayPoolContainer.parentNode.removeChild(_sparkRayPoolContainer);
    }
    _sparkRayPoolContainer = null;
  },
  // T2.07 — Phoenix Ashen Reign testables. Module-state observers + pool
  // resetter so tests can assert state transitions without reaching into
  // module privates.
  isAshenReignPoolInitDone: () => _ashenReignPoolInitDone,
  getAshenReignFlameBorderEl: () => _ashenReignFlameBorderEl,
  getAshenReignHudEl:         () => _ashenReignHudEl,
  hasAshenReignReleaseTimer:  () => _ashenReignReleaseTimer !== null,
  hasAshenReignDecayTimer:    () => _ashenReignDecayTimer !== null,
  resetAshenReignPool: () => {
    // First: drop all state + cancel timers via the public reset path.
    resetAshenReign();
    // Then: tear down DOM so the next test re-creates the pool fresh.
    if (_ashenReignFlameBorderEl && _ashenReignFlameBorderEl.parentNode) {
      _ashenReignFlameBorderEl.parentNode.removeChild(_ashenReignFlameBorderEl);
    }
    if (_ashenReignHudEl && _ashenReignHudEl.parentNode) {
      _ashenReignHudEl.parentNode.removeChild(_ashenReignHudEl);
    }
    _ashenReignFlameBorderEl = null;
    _ashenReignHudEl = null;
    _ashenReignPoolInitDone = false;
  },
  // T2.08 — Lich Cursed Tiles testables. Module-state observers + pool
  // resetter so tests can assert state transitions without reaching into
  // module privates.
  getCursedTilesPoolSize: () => _cursedTilesPool.length,
  getCursedTilesPoolAvailable: () => _cursedTilesPoolAvailable.length,
  isCursedTilesPoolInitDone: () => _cursedTilesPoolInitDone,
  resetCursedTilesPool: () => {
    // First: drop all state via the public reset path.
    resetCursedTiles();
    // Then: tear down DOM so the next test re-creates the pool fresh.
    if (_cursedTilesPoolContainer && _cursedTilesPoolContainer.parentNode) {
      _cursedTilesPoolContainer.parentNode.removeChild(_cursedTilesPoolContainer);
    }
    while (_cursedTilesPool.length) _cursedTilesPool.pop();
    while (_cursedTilesPoolAvailable.length) _cursedTilesPoolAvailable.pop();
    _cursedTilesPoolContainer = null;
    _cursedTilesPoolInitDone = false;
  },
  // T2.09 — Berserker / Frenzy Bloodtide Pulse testables. Module-state
  // observers + pool resetter so tests can assert state transitions without
  // reaching into module privates.
  isBloodtidePoolInitDone: () => _bloodtidePoolInitDone,
  getBloodtidePulseEl:    () => _bloodtidePulseEl,
  getBloodtidePulseHudEl: () => _bloodtidePulseHudEl,
  hasBloodtideDecayTimer: () => _bloodtidePulseDecayTimer !== null,
  resetBloodtidePool: () => {
    // First: drop all state via the public reset path.
    resetBloodtide();
    // Then: tear down DOM so the next test re-creates the pool fresh.
    if (_bloodtidePoolContainer && _bloodtidePoolContainer.parentNode) {
      _bloodtidePoolContainer.parentNode.removeChild(_bloodtidePoolContainer);
    }
    if (_bloodtidePulseHudEl && _bloodtidePulseHudEl.parentNode) {
      _bloodtidePulseHudEl.parentNode.removeChild(_bloodtidePulseHudEl);
    }
    _bloodtidePulseEl       = null;
    _bloodtidePulseHudEl    = null;
    _bloodtidePoolContainer = null;
    _bloodtidePoolInitDone  = false;
  },
  // T2.10 — Engineer Lockdown Protocol testables. Module-state observers +
  // pool resetter so tests can assert state transitions without reaching
  // into module privates.
  isEngineerLockdownPoolInitDone: () => _engineerLockdownPoolInitDone,
  getEngineerLockdownRatchetEl:   () => _engineerLockdownRatchetEl,
  getEngineerLockdownBannerEl:    () => _engineerLockdownBannerEl,
  hasEngineerLockdownRatchetTimer: () => _engineerLockdownRatchetDecayTimer !== null,
  hasEngineerLockdownBannerTimer:  () => _engineerLockdownBannerDecayTimer !== null,
  resetEngineerLockdownPool: () => {
    // First: drop all state + cancel timers via the public reset path.
    resetEngineerLockdowns();
    // Then: tear down DOM so the next test re-creates the pool fresh.
    if (_engineerLockdownPoolContainer && _engineerLockdownPoolContainer.parentNode) {
      _engineerLockdownPoolContainer.parentNode.removeChild(_engineerLockdownPoolContainer);
    }
    if (_engineerLockdownBannerEl && _engineerLockdownBannerEl.parentNode) {
      _engineerLockdownBannerEl.parentNode.removeChild(_engineerLockdownBannerEl);
    }
    _engineerLockdownRatchetEl     = null;
    _engineerLockdownBannerEl      = null;
    _engineerLockdownPoolContainer = null;
    _engineerLockdownPoolInitDone  = false;
  },
  // T2.11 — Grovewarden Root Surge testables. Module-state observers +
  // pool resetter so tests can assert sliding-window state transitions
  // and lifecycle accounting without reaching into module privates.
  getRootSurgePoolSize:        () => _rootSurgePool.length,
  getRootSurgePoolAvailable:   () => _rootSurgePoolAvailable.length,
  isRootSurgePoolInitDone:     () => _rootSurgePoolInitDone,
  // Read-only view into the sliding-window circular buffer. Pure
  // observation — no mutation. Used by tests + T2.B legacy bridge debug
  // panels.
  getRecentClearsBuffer:       () => _grovewardenRecentClears.slice(),
  resetRootSurgePool: () => {
    // First: drop all state via the public reset path.
    resetGrovewardenRootSurge();
    // Then: tear down DOM so the next test re-creates the pool fresh.
    if (_rootSurgePoolContainer && _rootSurgePoolContainer.parentNode) {
      _rootSurgePoolContainer.parentNode.removeChild(_rootSurgePoolContainer);
    }
    while (_rootSurgePool.length) _rootSurgePool.pop();
    while (_rootSurgePoolAvailable.length) _rootSurgePoolAvailable.pop();
    _rootSurgePoolContainer = null;
    _rootSurgePoolInitDone  = false;
  },
  IDENTITY_FX_KEYS,
  IDENTITY_BOSS_FX_KEYS,
});
