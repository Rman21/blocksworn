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
} from '../data/identity-layer.js';
import { spawnCoinParticle } from './particles.js';
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

// ─── Stubs for T2.03–T2.06 (export contract only) ──────────────────────
// These exist so `dispatchIdentityFx` can route to them today without
// throwing. Each is a no-op pass-through; T2.03 / T2.04 / T2.05 / T2.06
// will replace the body. Signatures must NOT change without spec revision.
//
// Per CTO instruction: "DO NOT implement T2.03+ functions — leave as stubs."
export function fxSharkLineClear(_rows, _cols, _squad) {
  // T2.03 — Feeding Frenzy (spec §2.2). Stub.
  return 0;
}
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
export function dispatchIdentityFx(rows, cols, squad, _currentBoss) {
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
    if (races.has('shark'))     fxSharkLineClear(rows, cols, squad);
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
  IDENTITY_FX_KEYS,
});
