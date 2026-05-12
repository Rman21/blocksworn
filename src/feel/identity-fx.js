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

/* global addGold, HERO_DECK */

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
} from '../data/identity-layer.js';
import { spawnCoinParticle, spawnSharkBiteParticle } from './particles.js';
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

// ─── Stubs for T2.04–T2.06 (export contract only) ──────────────────────
// These exist so `dispatchIdentityFx` can route to them today without
// throwing. Each is a no-op pass-through; T2.04 / T2.05 / T2.06 will replace
// the body. Signatures must NOT change without spec revision.
export function fxRockLineClear(_rows, _cols, _squad) {
  // T2.04 — Encore Echo (spec §2.3). Stub.
  return 0;
}
export function fxCrocodileLineClear(_rows, _cols, _squad) {
  // T2.05 — Bedrock Bastion (spec §2.4). Stub.
  return 0;
}
export function fxSparkLineClear(_rows, _cols, _squad) {
  // T2.06 — Sun Cascade (spec §2.5). Stub.
  return 0;
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
    if (races.has('rock'))      fxRockLineClear(rows, cols, squad);
  } catch (e) { log.warn('Rock FX threw:', e); }
  try {
    if (races.has('crocodile')) fxCrocodileLineClear(rows, cols, squad);
  } catch (e) { log.warn('Crocodile FX threw:', e); }
  try {
    if (races.has('spark'))     fxSparkLineClear(rows, cols, squad);
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
  IDENTITY_FX_KEYS,
});
