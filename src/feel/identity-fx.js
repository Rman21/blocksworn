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
          MAX_SHIELD, maxShieldBonus, grid */

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
} from '../data/identity-layer.js';
import { RACE_SYNERGY } from '../data/races.js';
import {
  spawnCoinParticle,
  spawnSharkBiteParticle,
  spawnRockEchoGhost,
  spawnCrocFragmentParticle,
  spawnSparkRayParticle,
} from './particles.js';
import { vHaptic } from './haptics.js';
import { log } from '../services/logger.js';

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
  IDENTITY_FX_KEYS,
});
