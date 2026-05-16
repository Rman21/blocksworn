// 2026-05-17 — TASK-CP-009 (combat-polish-implementation-plan.md §9 Task 9):
//
// 5-beat boss death cinematic polish — lifecycle module for the optional
// JS-driven themed-color flash on Beat 2. All other beat polish (Beat 0
// shake amplitude curve / Beat 1 hit-pause desaturation / Beat 4 zoom
// origin tuning) is pure CSS cascade in boss-death-polish.css.
//
// Spec: combat-polish-implementation-plan.md §9 Task 9 + §12 sacred
//       boundaries.
//       combat-mechanics.md §20 (5-beat boss death cinematic — full
//       sacred timing per beat: Beat 0 shake 440ms / Beat 1 hit-pause
//       300ms / Beat 2 white flash 260+220ms / Beat 4 slow zoom 420ms).
//       CLAUDE.md §2.2 sacred Feel layer.
//
// Sibling-module pattern (T-CP-006 / T-CP-007 / T-CP-008 precedent)
// -----------------------------------------------------------------
// `src/feel/animations.js` IS in the 12-file sacred SHA1 baseline (
// `41fd7ec0…`). This polish layer is a NEW sibling JS module that:
//   1. Observes the body for the legacy `.p-boss-death-flash` element
//      appearing (it's dynamically created by vPlayBossDieFx at t=260ms).
//   2. When the flash appears, reads the current boss element via
//      `window.currentBoss?.element` and applies a `data-boss-element`
//      attribute. The CSS in boss-death-polish.css then renders a
//      themed-color radial gradient instead of the default warm-white.
//   3. Falls back to no-op (pure-white flash) when boss element is
//      unknown / window.currentBoss is absent.
//
// animations.js stays BYTE-PERFECT UNTOUCHED — no signature, no constant,
// no value. Verified by sacred SHA1 audit in unit tests.
//
// Lifecycle (mirrors stagger-fx.js / identity-fx-polish.js precedent):
//   mountBossDeathPolish(rootEl)    → installs MutationObserver on body
//   destroyBossDeathPolish()        → disconnects observer, idempotent
//
// State sources (defensive; integration deferred):
//   - Reads `window.currentBoss.element` when the legacy bridge has
//     populated it. Silent no-op (pure-white flash) when absent.
//
// Sacred-cow protection (CLAUDE.md §2.2 + plan §12)
// ------------------------------------------------
// - All sacred 5-beat timings mirrored here as module-local frozen
//   constants. Dual audit in unit tests: (a) module mirror value
//   assertion; (b) regex-grep canonical against src/feel/animations.js.
// - Sacred class names ('.v-fx-shake', '.boss-death-pause',
//   '.p-boss-death-flash', '.boss-dissolve', '.boss-death-zoom') mirrored
//   here; the polish CSS only ADDS overrides — never removes or
//   fundamentally redefines them.
// - Sacred element-color hexes mirrored from src/data/elements.js
//   (#FF4D1F ember / #1FA3FF tide / #3DD66E grove / #FFD53D solar /
//   #8C3BFF umbra).
// - This module READS state via window.currentBoss; never writes back
//   to animations.js, src/core/, or src/data/.
// - Animations on hot paths use only transform / opacity / filter (60fps
//   hot-path guard — readiness §11.3).
// - prefers-reduced-motion handled in CSS sheet — polish overrides
//   simplified; the sacred 5-beat structure fires unchanged.
// - Never overrides .stagger-slow-mo, .v-fx-crit-flash,
//   .cell--engineer-welded, .phase-2, .phase-3.

/* global MutationObserver */

// ─── module state ──────────────────────────────────────────────────────────

let _bossDeathPolish = null;

const FLASH_CLASS_NAME           = 'p-boss-death-flash';
const BOSS_ELEMENT_ATTR          = 'data-boss-element';

// ─── sacred 5-beat durations — module-local mirror ────────────────────────
// SACRED per CLAUDE.md §2.2 + combat-mechanics.md §20. Byte-perfect mirror
// of src/feel/animations.js (sacred SHA1 baseline `41fd7ec0…`). Audited
// via regex-grep in tests/unit/boss-death-polish.test.js.
//
//   Beat 0 (shake):     440ms — animations.js:99,116
//   Beat 1 (hit-pause): 300ms — animations.js:122
//   Beat 2 (flash):     260ms delay + 220ms hold — animations.js:130,131
//   Beat 3 (dissolve):  380ms delay — animations.js:140
//   Beat 4 (slow zoom): 420ms delay — animations.js:147
const SACRED_BOSS_DEATH_BEATS = Object.freeze({
  SHAKE_MS:         440,
  HIT_PAUSE_MS:     300,
  FLASH_DELAY_MS:   260,
  FLASH_HOLD_MS:    220,
  DISSOLVE_DELAY_MS: 380,
  ZOOM_DELAY_MS:    420,
});

// vPlayCritFlash shake is the OTHER 440ms call-site in animations.js (line
// 99). Mirrored here for the dual audit so any drift in either call-site
// trips the regex regression test.
const SACRED_CRIT_FLASH_SHAKE_MS = 440;

// vPlayCritFlash white-flash itself (180ms — distinct from the boss-death
// flash). Mirrored for cross-reference; this module does NOT touch the
// crit flash visuals.
const SACRED_CRIT_FLASH_HOLD_MS = 180;

// ─── sacred class names — module-local mirror ─────────────────────────────
// SACRED per CLAUDE.md §2 + combat-polish-implementation-plan.md §12.
// These are the JS-readable contract class names that animations.js
// applies. This module READS the presence of `.p-boss-death-flash`; the
// polish CSS layers overrides on the others.
const SACRED_BOSS_DEATH_CLASSES = Object.freeze({
  SHAKE:        'v-fx-shake',
  HIT_PAUSE:    'boss-death-pause',
  FLASH:        'p-boss-death-flash',
  DISSOLVE:     'boss-dissolve',
  ZOOM:         'boss-death-zoom',
});

// ─── sacred element list — module-local mirror ────────────────────────────
// SACRED per CLAUDE.md §2.2 + src/data/elements.js (sacred SHA1 baseline
// `edf0ab7…`). The five stihiyas drive the themed-flash tint. Audited
// via regex-grep in unit tests.
const SACRED_STIHIYAS = Object.freeze(['ember', 'tide', 'grove', 'solar', 'umbra']);

// Sacred element color hexes — mirror of STIHIYA_COLORS in
// src/data/elements.js. Not USED at runtime (CSS owns the rendering) but
// surfaced here for the regex-grep audit so any drift in the canonical
// source trips a unit test.
const SACRED_STIHIYA_COLORS = Object.freeze({
  ember: '#FF4D1F',
  tide:  '#1FA3FF',
  grove: '#3DD66E',
  solar: '#FFD53D',
  umbra: '#8C3BFF',
});

// ─── public API ────────────────────────────────────────────────────────────

/**
 * mountBossDeathPolish(rootEl)
 *
 * rootEl: the .bw-battle-root container (or any element — the observer is
 *         installed on document.body since `.p-boss-death-flash` is a
 *         fixed-position child of body, not the battle root). Passed
 *         only for lifecycle symmetry with sibling polish modules. If
 *         null/undefined, returns false (no-op). Idempotent on repeat
 *         calls.
 *
 * Returns true on successful mount, false on no-op skip.
 */
export function mountBossDeathPolish(rootEl) {
  if (!rootEl) return false;
  if (_bossDeathPolish) return false;       // already mounted — idempotent

  // Defensive — observer requires MutationObserver in the host env. JSDom-
  // less unit tests pass through; this just means the themed-flash never
  // wires up there (CSS-only fallback always renders pure white).
  if (typeof MutationObserver !== 'function') {
    _bossDeathPolish = { rootEl, observer: null };
    return true;
  }
  if (typeof document === 'undefined' || !document.body) {
    _bossDeathPolish = { rootEl, observer: null };
    return true;
  }

  // The observer watches body for direct-child additions. When a node
  // with class `.p-boss-death-flash` appears, we apply data-boss-element.
  // Observer scope is intentionally narrow (childList on body only) so the
  // perf overhead is negligible (~zero except during the actual death FX).
  let observer = null;
  try {
    observer = new MutationObserver((mutations) => {
      try {
        for (const m of mutations) {
          if (!m || m.type !== 'childList') continue;
          if (!m.addedNodes || m.addedNodes.length === 0) continue;
          for (const node of m.addedNodes) {
            if (!node || node.nodeType !== 1) continue;     // ELEMENT_NODE only
            if (node.classList && node.classList.contains(FLASH_CLASS_NAME)) {
              _applyBossElementAttr(node);
            }
          }
        }
      } catch (_e) { /* defensive — observer must never throw */ }
    });
    observer.observe(document.body, { childList: true, subtree: false });
  } catch (_e) {
    // Defensive — if MutationObserver setup fails for any reason, the
    // module degrades to a no-op (pure-white flash via CSS fallback).
    observer = null;
  }

  _bossDeathPolish = { rootEl, observer };
  return true;
}

/**
 * destroyBossDeathPolish()
 *
 * Tears down the MutationObserver. Idempotent — safe to call when nothing
 * is mounted. Called by cleanupBattleScreen().
 */
export function destroyBossDeathPolish() {
  if (!_bossDeathPolish) return;
  try {
    if (_bossDeathPolish.observer
        && typeof _bossDeathPolish.observer.disconnect === 'function') {
      _bossDeathPolish.observer.disconnect();
    }
  } catch (_e) { /* defensive — idempotent */ }
  _bossDeathPolish = null;
}

// ─── pure helpers (exported for unit tests) ────────────────────────────────

/**
 * resolveBossElementClass(bossElement?): returns the valid attribute value
 * for the data-boss-element selector. Returns one of the 5 sacred stihiyas
 * (ember / tide / grove / solar / umbra) when the input matches, or null
 * for unknown / falsy input (signaling the caller to skip the attribute,
 * letting CSS fall back to pure white).
 *
 * Never throws — exclusively a pure read of the SACRED_STIHIYAS lookup.
 *
 * Examples:
 *   resolveBossElementClass('ember')   → 'ember'
 *   resolveBossElementClass('SOLAR')   → 'solar'  (case-insensitive)
 *   resolveBossElementClass(' tide ')  → 'tide'   (whitespace-trimmed)
 *   resolveBossElementClass('bogus')   → null
 *   resolveBossElementClass(null)      → null
 *   resolveBossElementClass(undefined) → null
 *   resolveBossElementClass(42)        → null
 */
export function resolveBossElementClass(bossElement) {
  if (typeof bossElement !== 'string') return null;
  const normalized = bossElement.trim().toLowerCase();
  if (!normalized) return null;
  return SACRED_STIHIYAS.includes(normalized) ? normalized : null;
}

// ─── private helpers ───────────────────────────────────────────────────────

/**
 * _applyBossElementAttr(flashEl)
 *
 * Reads window.currentBoss.element defensively, resolves it through the
 * sacred element lookup, and sets data-boss-element on the flash element
 * when valid. Pure-white fallback when boss element is unknown / absent.
 */
function _applyBossElementAttr(flashEl) {
  if (!flashEl) return;
  let element = null;
  try {
    if (typeof window !== 'undefined' && window.currentBoss
        && typeof window.currentBoss === 'object') {
      element = window.currentBoss.element;
    }
  } catch (_e) { /* defensive — no window or boss data */ }

  const resolved = resolveBossElementClass(element);
  if (resolved) {
    try {
      flashEl.setAttribute(BOSS_ELEMENT_ATTR, resolved);
    } catch (_e) { /* defensive — flash el detached, fine */ }
  }
}

// ─── test hooks — exported only for unit tests ─────────────────────────────

export const _testables = Object.freeze({
  SACRED_BOSS_DEATH_BEATS,
  SACRED_CRIT_FLASH_SHAKE_MS,
  SACRED_CRIT_FLASH_HOLD_MS,
  SACRED_BOSS_DEATH_CLASSES,
  SACRED_STIHIYAS,
  SACRED_STIHIYA_COLORS,
  FLASH_CLASS_NAME,
  BOSS_ELEMENT_ATTR,
  _getCurrentBossDeathPolish: () => _bossDeathPolish,
  _applyBossElementAttr,
});
