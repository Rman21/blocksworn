// 2026-05-17 — TASK-CP-008 (combat-polish-implementation-plan.md §9 Task 8):
//
// Race FX visual polish — lifecycle module for 6 races (Pirate, Shark,
// Rock, Crocodile, Spark, Grove) + OPTIONAL cross-race combo banner.
//
// Spec: combat-polish-implementation-plan.md §9 Task 8 + §12 sacred
//       boundaries.
//       combat-mechanics.md §18 (race line-clear flavors — ALL sacred values
//       per race) + §22 visual hooks rows for race FX.
//       CLAUDE.md §2.1 sacred — race FX mechanics byte-perfect.
//
// Sibling-module pattern (T-CP-006 damage-fx, T-CP-007 stagger-fx)
// ----------------------------------------------------------------
// `src/feel/identity-fx.js` is NOT in the 12-file sacred SHA1 baseline but
// holds 80+ exported sacred handlers. This polish layer is a NEW sibling
// JS module that:
//   1. Mounts ONE additional DOM element (cross-race combo banner) inside
//      the battle root. All other polish features are pure CSS cascade
//      over existing identity-fx.js DOM (.identity-coin, .identity-shark-
//      bite, etc) — see src/feel/identity-fx-polish.css.
//   2. Provides the window-bridge entry point (window.__triggerCrossRaceCombo)
//      so a follow-up wiring task can call this without needing to refactor
//      computeCrossRaceSynergy() in src/services/party-tower-backend.js.
//   3. Provides the "FROM SOIL" label spawn API for Grove Root Surge gold
//      drops (called optionally — defaults to no-op if the bridge isn't
//      wired). Sacred addGold flow in identity-fx.js stays UNTOUCHED.
//
// identity-fx.js is byte-perfect untouched by this task — no signature,
// no constant, no value. Verified by signature parity check in
// tests/unit/race-fx-polish.test.js.
//
// Lifecycle (mirrors damage-channel-fx.js / pressure-meter.js / stagger-fx.js
// — plan §8.5):
//   mountRaceFxPolish(rootEl, state?)   → builds cross-race banner DOM
//   updateRaceFxPolish(state)           → toggles banner via state flag
//   destroyRaceFxPolish()               → tears down DOM, idempotent
//
// State sources (defensive; integration deferred):
//   - Reads { hasCrossRaceCombo: boolean } from state seed/update.
//   - Pure window-bridge hook `window.__triggerCrossRaceCombo()` provided
//     for follow-up Phase 3 T3.12 integration when the cross-race compute
//     in src/services/party-tower-backend.js wants to surface UX.
//
// Sacred-cow protection (CLAUDE.md §2.1 + plan §12 + readiness §2.4)
// ------------------------------------------------------------------
// - All race sacred constants mirrored as module-local frozen objects.
//   Dual audit in unit tests: (a) module mirror value assertion;
//   (b) regex-grep canonical against src/data/identity-layer.js.
// - HARD CAPs (32 / 4 / 4 / 16 / 16 particles + 5 max pirates) referenced
//   only as informational mirrors — never re-imposed at runtime by this
//   module (identity-fx.js owns enforcement).
// - Decay timings (1000 / 500 / 700 + 200 delay / 600 / 400 ms) mirrored;
//   this module never enforces or duplicates them — CSS reads existing
//   `--coin-decay-ms` / `--bite-decay-ms` / `--echo-decay-ms` /
//   `--frag-decay-ms` / `--ray-decay-ms` vars that identity-fx.js writes
//   per-fire. Single source of truth preserved.
// - Sacred ROOT_SURGE_OVERLAY_COLOR = '#2D8659' mirrored as module-local
//   constant + present in the CSS sheet.
// - This module READS state; never writes back to identity-fx.js or
//   anywhere in src/core/ / src/data/.
// - Animations on hot paths use only transform / opacity / filter (60fps
//   hot-path guard).
// - prefers-reduced-motion handled in CSS sheet — banner still appears
//   but with simplified animation.
// - Never overrides legacy sacred classes (.stagger-slow-mo, .boss-death-
//   pause, .v-fx-shake, .v-fx-crit-flash, .cell--engineer-welded,
//   .phase-2, .phase-3).

// ─── module state ───────────────────────────────────────────────────────────

let _raceFxPolish = null;

const ROOT_SLOT_ID                       = 'bw-race-fx-polish';
const ROOT_CONTAINER_CLASS               = 'bw-race-fx-polish';
const CROSS_RACE_BANNER_CLASS            = 'identity-cross-race-combo-banner';
const CROSS_RACE_BANNER_VISIBLE_CLASS    = 'identity-cross-race-combo-banner--visible';
const FROM_SOIL_LABEL_CLASS              = 'identity-grove-from-soil-label';
const FROM_SOIL_LABEL_RISING_CLASS       = 'identity-grove-from-soil-label--rising';

// Cross-race banner visible duration (matches the CSS animation duration).
// This module schedules class removal so the banner can re-trigger cleanly
// on subsequent cross-race combos within a single battle.
const CROSS_RACE_BANNER_VISIBLE_MS = 1600;

// FROM SOIL label visible duration (matches the CSS rise animation).
const FROM_SOIL_LABEL_VISIBLE_MS = 1000;

// Default banner copy — kept short (matches existing CTA copy register).
const CROSS_RACE_BANNER_DEFAULT_TEXT = 'CROSS-RACE COMBO';

// ─── sacred race FX constants — module-local mirror ────────────────────────
// SACRED per CLAUDE.md §2.1 + combat-mechanics.md §18 + plan §12. Byte-perfect
// mirrors of src/data/identity-layer.js. Audited via regex-grep in
// tests/unit/race-fx-polish.test.js.

const SACRED_PIRATE = Object.freeze({
  GOLD_PER_CELL: 5,
  MAX_PIRATES:   5,
  MAX_COINS:     32,    // DOM-pool HARD CAP
  COIN_DECAY_MS: 1000,
});

const SACRED_SHARK = Object.freeze({
  MIN_SHARKS_FOR_2X_TRIGGER: 2,
  MAX_EXTRA_CELLS:           4,   // HARD CAP
  BITE_DECAY_MS:             500,
  BITE_SVG_PER_LINE:         1,
  DOMINANT_ELEMENT:          'tide',
});

const SACRED_ROCK = Object.freeze({
  CHARGE_PER_LINE:     1,
  MAX_CHARGE_PER_FIRE: 4,         // HARD CAP
  GHOST_DECAY_MS:      700,
  DELAY_MS:            200,
  DOMINANT_ELEMENT:    'umbra',
  ULT_METER:           'umbra',
});

const SACRED_CROCODILE = Object.freeze({
  FRAGMENTS_PER_SHIELD:   5,
  MAX_FRAGMENT_PARTICLES: 16,     // HARD CAP
  FRAGMENT_DECAY_MS:      600,
  GROVE_ELEMENT:          'grove',
  TARGET_HERO_INDEX:      0,
});

const SACRED_SPARK = Object.freeze({
  MIN_SOLAR_CELLS:     2,         // HARD gate
  MAX_DOMINANT_BOOST:  1,         // HARD CAP — NOT stacking
  MAX_RAY_PARTICLES:   16,        // DOM-pool HARD CAP
  RAY_DECAY_MS:        400,
  DOMINANT_ELEMENT:    'solar',
  ENABLED:             true,
});

const SACRED_GROVE = Object.freeze({
  GROVE_ELEMENT:       'grove',
  OVERLAY_COLOR:       '#2D8659',
  // gold-drop reward etc. lives in identity-fx.js; mirrored here as info
  GOLD_PER_CLEAR:      10,
  TRIGGER_NON_GROVE:   3,
  TURNS_AUTO_CLEAR:    5,
});

// Informational only — Berserker enrage mult lives in src/core/bosses.js,
// referenced for cross-race awareness (no polish on Berserker in this task —
// covered by Task 10). NOT modified at runtime.
const SACRED_BERSERKER_ENRAGE_MULT = 2.0;

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * mountRaceFxPolish(rootEl, state?)
 *
 * rootEl: the .bw-battle-root container (set up by battle-screen orchestrator).
 *         If null/undefined, returns false (no-op). Idempotent on repeat calls.
 * state:  optional { hasCrossRaceCombo?: boolean } seed.
 *
 * Returns true on successful mount, false on no-op skip.
 */
export function mountRaceFxPolish(rootEl, state) {
  if (!rootEl) return false;
  if (_raceFxPolish) return false;          // already mounted — idempotent

  // Locate or create the polish slot inside the battle root. The slot is
  // an absolute-positioned anchor that hosts the cross-race combo banner.
  // Pirate / Shark / Rock / Crocodile / Spark / Grove polish is pure CSS
  // cascade over existing identity-fx.js DOM — no slot needed for them.
  let slot = rootEl.querySelector(`#${ROOT_SLOT_ID}`)
          || rootEl.querySelector(`.${ROOT_CONTAINER_CLASS}`);
  if (!slot) {
    slot = document.createElement('div');
    slot.id = ROOT_SLOT_ID;
    slot.className = ROOT_CONTAINER_CLASS;
    rootEl.appendChild(slot);
  }

  // Cross-race combo banner — hidden by default. Surfaces only when
  // updateRaceFxPolish({ hasCrossRaceCombo: true }) is called.
  const banner = document.createElement('div');
  banner.className = CROSS_RACE_BANNER_CLASS;
  banner.setAttribute('aria-hidden', 'true');
  banner.setAttribute('role', 'status');
  banner.textContent = CROSS_RACE_BANNER_DEFAULT_TEXT;

  slot.innerHTML = '';
  slot.appendChild(banner);

  _raceFxPolish = {
    rootEl,
    slot,
    banner,
    bannerTimerId: null,
    fromSoilLabelTimers: [],
  };

  // Install window-bridge entry point — Phase 3 T3.12 cross-race compute
  // can call window.__triggerCrossRaceCombo() to surface UX. Defensive:
  // never throws when window is missing (Vitest jsdom-less env).
  try {
    if (typeof window !== 'undefined') {
      window.__triggerCrossRaceCombo = () => {
        try {
          updateRaceFxPolish({ hasCrossRaceCombo: true });
        } catch (_e) { /* defensive — never throws */ }
      };
      // Optional: window-bridge entry for Grove "FROM SOIL" label spawn.
      // Future integration in fxGrovewardenRootSurgeTick → onRootCellCleared
      // can call window.__spawnGroveFromSoilLabel(x, y, goldAmount).
      window.__spawnGroveFromSoilLabel = (x, y, gold) => {
        try {
          spawnFromSoilLabel(x, y, gold);
        } catch (_e) { /* defensive — never throws */ }
      };
    }
  } catch (_e) { /* defensive — no window, fine */ }

  if (state) updateRaceFxPolish(state);
  return true;
}

/**
 * updateRaceFxPolish(state)
 *
 * Partial state OK: { hasCrossRaceCombo?: boolean }
 *
 *   - hasCrossRaceCombo === true  → flash the cross-race combo banner;
 *                                   class auto-removes after the CSS
 *                                   animation completes so a subsequent
 *                                   combo within the same battle re-triggers.
 *   - hasCrossRaceCombo === false → no-op (banner stays hidden / completes
 *                                   any in-flight animation).
 *
 * Never throws. Unknown fields → quiet no-op.
 */
export function updateRaceFxPolish(state) {
  if (!_raceFxPolish) return;
  if (!state || typeof state !== 'object') return;

  if (state.hasCrossRaceCombo === true) {
    _triggerCrossRaceBanner();
  }
}

/**
 * destroyRaceFxPolish()
 *
 * Tears down the polish slot + clears any pending banner timers + any
 * outstanding FROM SOIL label timers. Idempotent — safe to call when
 * nothing is mounted. Called by cleanupBattleScreen().
 */
export function destroyRaceFxPolish() {
  if (!_raceFxPolish) return;
  try {
    if (_raceFxPolish.bannerTimerId) {
      try { clearTimeout(_raceFxPolish.bannerTimerId); } catch (_e) { /* defensive */ }
    }
    if (Array.isArray(_raceFxPolish.fromSoilLabelTimers)) {
      _raceFxPolish.fromSoilLabelTimers.forEach((tid) => {
        try { clearTimeout(tid); } catch (_e) { /* defensive */ }
      });
    }
    if (_raceFxPolish.slot) {
      _raceFxPolish.slot.innerHTML = '';
      if (_raceFxPolish.slot.parentNode) {
        _raceFxPolish.slot.parentNode.removeChild(_raceFxPolish.slot);
      }
    }
    // Tear down window-bridge entry points so a fresh mount can re-install.
    try {
      if (typeof window !== 'undefined') {
        if (window.__triggerCrossRaceCombo) {
          delete window.__triggerCrossRaceCombo;
        }
        if (window.__spawnGroveFromSoilLabel) {
          delete window.__spawnGroveFromSoilLabel;
        }
      }
    } catch (_e) { /* defensive — never throws */ }
  } catch (_e) { /* defensive — idempotent */ }
  _raceFxPolish = null;
}

/**
 * spawnFromSoilLabel(x, y, goldAmount)
 *
 * Spawn a "+10 FROM SOIL" label at the given viewport coordinates. Used
 * by Grove Root Surge to label gold drops with their origin. Pure
 * cosmetic — the actual addGold flow in identity-fx.js stays untouched.
 *
 * x, y: viewport coords (fixed positioning).
 * goldAmount: number to prefix the label with ("+10 FROM SOIL"). Defaults
 *             to SACRED_GROVE.GOLD_PER_CLEAR (10).
 *
 * Returns true on success, false on no-op (not mounted / invalid coords).
 */
export function spawnFromSoilLabel(x, y, goldAmount) {
  if (!_raceFxPolish) return false;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

  const amount = Number.isFinite(goldAmount) ? goldAmount : SACRED_GROVE.GOLD_PER_CLEAR;

  let label;
  try {
    label = document.createElement('div');
    label.className = FROM_SOIL_LABEL_CLASS;
    label.style.left = `${x}px`;
    label.style.top  = `${y}px`;
    label.textContent = `+${amount} FROM SOIL`;
    document.body.appendChild(label);
    // Force reflow then add the rising animation class — single-frame
    // trigger pattern (mirrors identity-fx.js coin / fragment pools).
    void label.offsetWidth;
    label.classList.add(FROM_SOIL_LABEL_RISING_CLASS);
  } catch (_e) {
    return false;
  }

  // Auto-remove after the animation completes. Tracked so destroy() can
  // cancel pending removals.
  try {
    const tid = setTimeout(() => {
      try {
        if (label && label.parentNode) {
          label.parentNode.removeChild(label);
        }
      } catch (_e) { /* defensive */ }
    }, FROM_SOIL_LABEL_VISIBLE_MS + 60);
    if (_raceFxPolish && Array.isArray(_raceFxPolish.fromSoilLabelTimers)) {
      _raceFxPolish.fromSoilLabelTimers.push(tid);
    }
  } catch (_e) { /* defensive */ }

  return true;
}

// ─── pure helpers (exported for unit tests) ────────────────────────────────

/**
 * resolveBannerText(input?): returns the cross-race combo banner copy.
 * If input is a non-empty string, it's used as the banner text; otherwise
 * the default ('CROSS-RACE COMBO') is returned.
 *
 * Examples:
 *   resolveBannerText('PARTY POWER')   → 'PARTY POWER'
 *   resolveBannerText('')              → 'CROSS-RACE COMBO'
 *   resolveBannerText(null)            → 'CROSS-RACE COMBO'
 *   resolveBannerText()                → 'CROSS-RACE COMBO'
 */
export function resolveBannerText(input) {
  if (typeof input === 'string' && input.length > 0) return input;
  return CROSS_RACE_BANNER_DEFAULT_TEXT;
}

/**
 * formatFromSoilLabel(goldAmount): formats the "+N FROM SOIL" label text.
 *
 * Examples:
 *   formatFromSoilLabel(10)    → '+10 FROM SOIL'
 *   formatFromSoilLabel(5)     → '+5 FROM SOIL'
 *   formatFromSoilLabel(null)  → '+10 FROM SOIL'  (default = 10)
 *   formatFromSoilLabel('x')   → '+10 FROM SOIL'
 */
export function formatFromSoilLabel(goldAmount) {
  const amount = Number.isFinite(goldAmount) ? goldAmount : SACRED_GROVE.GOLD_PER_CLEAR;
  return `+${amount} FROM SOIL`;
}

// ─── private helpers ────────────────────────────────────────────────────────

function _triggerCrossRaceBanner() {
  if (!_raceFxPolish || !_raceFxPolish.banner) return;
  const banner = _raceFxPolish.banner;

  // Reset existing animation if it's mid-fire so a quick re-trigger plays
  // cleanly. Removing + re-adding the class in the next frame restarts
  // the keyframes (browser collapses transitions across frames).
  banner.classList.remove(CROSS_RACE_BANNER_VISIBLE_CLASS);
  void banner.offsetWidth;     // forces reflow so the next add restarts anim
  banner.classList.add(CROSS_RACE_BANNER_VISIBLE_CLASS);

  // Clear any prior pending removal then schedule a fresh removal.
  if (_raceFxPolish.bannerTimerId) {
    try { clearTimeout(_raceFxPolish.bannerTimerId); } catch (_e) { /* defensive */ }
  }
  try {
    _raceFxPolish.bannerTimerId = setTimeout(() => {
      try {
        if (_raceFxPolish && _raceFxPolish.banner) {
          _raceFxPolish.banner.classList.remove(CROSS_RACE_BANNER_VISIBLE_CLASS);
        }
      } catch (_e) { /* defensive */ }
      if (_raceFxPolish) {
        _raceFxPolish.bannerTimerId = null;
      }
    }, CROSS_RACE_BANNER_VISIBLE_MS + 60);
  } catch (_e) { /* defensive — never throws */ }
}

// ─── test hooks — exported only for unit tests ─────────────────────────────

export const _testables = Object.freeze({
  SACRED_PIRATE,
  SACRED_SHARK,
  SACRED_ROCK,
  SACRED_CROCODILE,
  SACRED_SPARK,
  SACRED_GROVE,
  SACRED_BERSERKER_ENRAGE_MULT,
  ROOT_SLOT_ID,
  ROOT_CONTAINER_CLASS,
  CROSS_RACE_BANNER_CLASS,
  CROSS_RACE_BANNER_VISIBLE_CLASS,
  FROM_SOIL_LABEL_CLASS,
  FROM_SOIL_LABEL_RISING_CLASS,
  CROSS_RACE_BANNER_VISIBLE_MS,
  FROM_SOIL_LABEL_VISIBLE_MS,
  CROSS_RACE_BANNER_DEFAULT_TEXT,
  _getCurrentRaceFxPolish: () => _raceFxPolish,
});
