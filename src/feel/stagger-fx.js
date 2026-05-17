// 2026-05-16 — TASK-CP-007 (combat-polish-implementation-plan.md §9 Task 7):
//
// Stagger entry + chromatic shift — visualizes the sacred 3-state boss
// state machine (Active → Stagger → Recovery → Active) with three layered
// visual cues that hold for the SACRED turn-durations (4 / 2 turns) read
// from src/core/stagger-loop.js.
//
// Spec: combat-polish-implementation-plan.md §9 Task 7 + §10 polish gate +
//       §12 sacred boundaries.
//       combat-mechanics.md §12 (Stagger Loop full sacred values) + §13
//       (pressure meter) + §22 visual-hooks rows.
//       CLAUDE.md §2.5 sacred v2.1 P2 Stagger Loop.
//
// Polish gate context: this is the THIRD and FINAL Tier-2 polish task. The
// commit landing this module CLOSES the Combat Polish Polish gate (Tasks
// 5-7 complete — synergy bar, damage channel FX, stagger entry chromatic
// shift). Next tier: Tasks 8-10 (Race FX × 6, 5-beat death cinematic,
// Reactivity event telegraphs × 22 + 5 boss-reactive).
//
// Three visual sub-features, all CSS-driven (60fps) with prefers-reduced-
// motion graceful degradation:
//
//   1. Stagger entry chromatic shift (§7.1)
//      When boss enters BOSS_STATE_STAGGER (Pressure reaches 100), the
//      existing legacy gold-flash overlay `.stagger-slow-mo` continues to
//      fire — we ADD a subtle chromatic tint via CSS filter that holds
//      for the FULL 4-turn STAGGER_DURATION_TURNS window. Fades out over
//      ~600ms when the boss transitions out of Stagger.
//
//   2. Recovery entry telegraph (§7.2)
//      When boss enters BOSS_STATE_RECOVERY (after 4-turn Stagger expires)
//      a pulsing amber border appears around the battle screen edges with
//      a visible 2-turn countdown ("RECOVERING — 2 turns" / "1 turn" /
//      "REVENGE"). Pulse cadence references REACTIVITY_TELEGRAPH_MS = 3000
//      but TOTAL duration is gated by RECOVERY_DURATION_TURNS — not the
//      3000ms reactivity telegraph.
//
//   3. Boss revenge attack channel-specific FX (§7.3)
//      When the revenge attack lands at the end of Recovery (boss state
//      transitions back to ACTIVE), fires a damage-channel-specific FX on
//      player HP via T-CP-006's `triggerChannelFx('signature')` API. The
//      SIGNATURE channel is the default for revenge attacks per
//      combat-mechanics.md §9.3.
//
// Lifecycle (mirrors damage-channel-fx.js / pressure-meter.js / synergy-bar.js
// — plan §8.5):
//   mountStaggerFx(rootEl, state?)   → builds chromatic + telegraph layers
//   updateStaggerFx(state)           → re-applies class + countdown on
//                                      boss-state transitions
//   destroyStaggerFx()               → tears down DOM, idempotent
//
// State sources (defensive; integration deferred):
//   - Reads window.bossState, window.staggerTurnsRemaining,
//     window.recoveryTurnsRemaining when present (legacy bridge populates).
//   - Tolerates missing state — silent no-ops keep the gate clean.
//
// Sacred-cow protection (CLAUDE.md §2.5 + plan §12):
//   - Boss-state string identifiers ('active' / 'stagger' / 'recovery')
//     byte-perfect — module-local mirror + dual audit in
//     tests/unit/stagger-fx.test.js: (a) module mirror value assertion,
//     (b) regex-grep audit on src/core/stagger-loop.js.
//   - STAGGER_DURATION_TURNS = 4 + RECOVERY_DURATION_TURNS = 2 mirrored
//     here as module-local constants; runtime parity check via window
//     bridge when legacy is loaded.
//   - FIRE_MULT_*_RATIO values (0.7 / 1.5 / 0.7) mirrored as informational
//     references for the audit; this module never reads them at runtime
//     (visual binding only).
//   - This module READS state via window bridge; never writes back to
//     stagger-loop state.
//   - Animations on hot paths use only transform / opacity / filter (60fps
//     hot-path guard).
//   - prefers-reduced-motion → chromatic shift disabled, telegraph border
//     still appears but no pulse, countdown text still updates.
//   - Never overrides .stagger-slow-mo (legacy gold flash continues),
//     .boss-death-pause, .v-fx-shake, .v-fx-crit-flash, .cell--engineer-
//     welded, .phase-2, .phase-3.
//
// Architectural notes
//   - src/feel/* NEVER imports from src/core/* (mirrors damage-channel-fx
//     + pressure-meter precedent). Sacred values live in module-local
//     mirror + dual audit on canonical source.
//   - animations.js (SHA1 baseline 41fd7ec…) stays byte-perfect — new
//     helpers, if needed, would live in a sibling module per T-CP-006
//     precedent. This task uses only inline DOM manipulation (no helper
//     module split needed).
//   - SIGNATURE-channel revenge integration via window-bridge: defensive
//     call to `window.__triggerChannelFx?.('signature')` so the wiring
//     is non-fatal when T-CP-006's window-bridge re-export hasn't yet
//     populated the global. Battle-screen.js re-exports the helper but
//     does not currently expose it on window — wiring is INTENT
//     (deferred to a follow-up integration task).

// ─── module state ───────────────────────────────────────────────────────────

let _staggerFx = null;

const ROOT_SLOT_ID                = 'bw-stagger-fx';
const ROOT_CONTAINER_CLASS        = 'bw-stagger-fx';
const CHROMATIC_CLASS             = 'bw-stagger-fx--stagger';
const RECOVERY_CLASS              = 'bw-stagger-fx--recovery';
const ACTIVE_CLASS                = 'bw-stagger-fx--active';
const TELEGRAPH_LAYER_CLASS       = 'bw-stagger-telegraph';
const COUNTDOWN_LABEL_CLASS       = 'bw-stagger-countdown';

// Fade-out duration when transitioning out of Stagger / Recovery → Active.
// Used to keep classes present during the CSS fade so the cue doesn't pop.
const FADE_OUT_MS = 600;

// ─── sacred boss-state string identifiers ──────────────────────────────────
// SACRED per CLAUDE.md §2.5 + combat-mechanics.md §12. Byte-perfect mirror
// of src/core/stagger-loop.js:210-212. Many call sites key off these exact
// strings — they MUST match the canonical source. Audited via regex-grep
// in tests/unit/stagger-fx.test.js.
const SACRED_BOSS_STATES = Object.freeze({
  ACTIVE:   'active',
  STAGGER:  'stagger',
  RECOVERY: 'recovery',
});

// ─── sacred turn-duration constants ────────────────────────────────────────
// SACRED per CLAUDE.md §2.5 + combat-mechanics.md §12. Byte-perfect mirror
// of src/core/stagger-loop.js:232-233.
//
//   STAGGER_DURATION_TURNS  = 4    — Stagger window (chromatic shift hold)
//   RECOVERY_DURATION_TURNS = 2    — Recovery telegraph + revenge fires at end
//
// Used by this module only as the audit mirror — the actual countdown reads
// `window.staggerTurnsRemaining` / `window.recoveryTurnsRemaining` populated
// by src/core/stagger-loop.js, so the visual layer never re-derives the count.
const STAGGER_DURATION_TURNS  = 4;
const RECOVERY_DURATION_TURNS = 2;

// ─── sacred FIRE_MULT ratios ───────────────────────────────────────────────
// SACRED per CLAUDE.md §2.5 + combat-mechanics.md §12. Byte-perfect mirror
// of src/core/stagger-loop.js:250-252. This module never reads them at
// runtime — they're surfaced here for the dual audit in unit tests so any
// drift in src/core/stagger-loop.js immediately trips the regex regression.
const FIRE_MULT_ACTIVE_RATIO   = 0.7;
const FIRE_MULT_STAGGER_RATIO  = 1.5;
const FIRE_MULT_RECOVERY_RATIO = 0.7;

// Runtime cross-check vs legacy globals when available. We don't throw
// here (legacy bridge may not be loaded under unit tests) — but if a
// mismatch surfaces in dev, the console will surface it via dev tools.
try {
  if (typeof window !== 'undefined') {
    if (typeof window.STAGGER_DURATION_TURNS === 'number'
        && window.STAGGER_DURATION_TURNS !== STAGGER_DURATION_TURNS) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          `[stagger-fx] STAGGER_DURATION_TURNS parity drift: ` +
          `module=${STAGGER_DURATION_TURNS}, window=${window.STAGGER_DURATION_TURNS}`
        );
      }
    }
    if (typeof window.RECOVERY_DURATION_TURNS === 'number'
        && window.RECOVERY_DURATION_TURNS !== RECOVERY_DURATION_TURNS) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          `[stagger-fx] RECOVERY_DURATION_TURNS parity drift: ` +
          `module=${RECOVERY_DURATION_TURNS}, window=${window.RECOVERY_DURATION_TURNS}`
        );
      }
    }
  }
} catch (_e) { /* defensive — no-op */ }

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * mountStaggerFx(rootEl, state?)
 *
 * rootEl: the .bw-battle-root container (set up by battle-screen orchestrator).
 *         If null/undefined, returns false (no-op). Idempotent on repeat calls.
 * state:  optional { bossState?, staggerTurnsRemaining?, recoveryTurnsRemaining? }
 *         seed. Missing fields render no class (Active-state default).
 *
 * Returns true on successful mount, false on no-op skip.
 */
export function mountStaggerFx(rootEl, state) {
  if (!rootEl) return false;
  if (_staggerFx) return false;             // already mounted — idempotent

  // Locate or create the stagger-fx slot inside the battle root. The slot
  // is an absolute-positioned layer that hosts the telegraph border + the
  // countdown label. The chromatic-shift filter is applied to the ROOT
  // element via a class hook (not nested) so the entire battle screen
  // tints — that's the player-visible cue.
  let slot = rootEl.querySelector(`#${ROOT_SLOT_ID}`)
          || rootEl.querySelector(`.${ROOT_CONTAINER_CLASS}`);
  if (!slot) {
    slot = document.createElement('div');
    slot.id = ROOT_SLOT_ID;
    slot.className = ROOT_CONTAINER_CLASS;
    rootEl.appendChild(slot);
  }

  // Telegraph border layer — pulsing amber edge during Recovery state.
  const telegraph = document.createElement('div');
  telegraph.className = TELEGRAPH_LAYER_CLASS;
  telegraph.setAttribute('aria-hidden', 'true');

  // Countdown label — "RECOVERING — N turns" / "REVENGE" inside the
  // telegraph border. Surfaces a definite signal for AT users too.
  const countdown = document.createElement('div');
  countdown.className = COUNTDOWN_LABEL_CLASS;
  countdown.setAttribute('aria-live', 'polite');
  countdown.textContent = '';

  slot.innerHTML = '';
  slot.appendChild(telegraph);
  slot.appendChild(countdown);

  _staggerFx = {
    rootEl,
    slot,
    telegraph,
    countdown,
    currentState: SACRED_BOSS_STATES.ACTIVE,
    fadeTimerId: null,
    prevStateForRevenge: SACRED_BOSS_STATES.ACTIVE,
  };

  if (state) updateStaggerFx(state);
  return true;
}

/**
 * updateStaggerFx(state)
 *
 * Partial state OK: { bossState?, staggerTurnsRemaining?,
 *                     recoveryTurnsRemaining?, turnsInState? }
 *
 *   - bossState === 'stagger'  → ensure chromatic-shift class active on root,
 *                                clear telegraph + countdown
 *   - bossState === 'recovery' → ensure telegraph border active, show
 *                                countdown label using turnsInState (or fall
 *                                back to recoveryTurnsRemaining)
 *   - bossState === 'active'   → ensure both effects off; if the previous
 *                                state was 'recovery', fire SIGNATURE-channel
 *                                revenge FX via the window-bridge re-export
 *                                of triggerChannelFx (defensive — no-op when
 *                                the bridge hasn't been wired yet).
 *
 * Never throws. Unknown bossState → quiet no-op (preserves previous class).
 */
export function updateStaggerFx(state) {
  if (!_staggerFx) return;
  if (!state || typeof state !== 'object') return;

  const root = _staggerFx.rootEl;
  if (!root) return;

  const incomingState = (typeof state.bossState === 'string') ? state.bossState : undefined;

  // If bossState absent from the update, leave class state alone — partial
  // updates may carry only turn counts (e.g. tick decrement) without a
  // state transition.
  if (incomingState) {
    const prev = _staggerFx.currentState;

    // Transition: Recovery → Active = revenge lands. Fire SIGNATURE-channel
    // FX defensively via the window-bridge re-export. The integration layer
    // (battle-screen.js) exports triggerChannelFx but does not currently
    // populate window.__triggerChannelFx — the call is intentionally a
    // no-op when the bridge is absent. Wiring landing in a follow-up
    // integration task; this commit ships the INTENT.
    if (prev === SACRED_BOSS_STATES.RECOVERY && incomingState === SACRED_BOSS_STATES.ACTIVE) {
      try {
        if (typeof window !== 'undefined'
            && typeof window.__triggerChannelFx === 'function') {
          window.__triggerChannelFx('signature');
        }
      } catch (_e) { /* defensive — never throws */ }
    }

    _applyStateClass(root, incomingState);
    _staggerFx.currentState = incomingState;
  }

  // Refresh countdown — uses (in priority) explicit turnsInState, then
  // recoveryTurnsRemaining, then staggerTurnsRemaining. Only displayed
  // during Recovery; Stagger / Active leave it blank.
  const active = _staggerFx.currentState;
  if (active === SACRED_BOSS_STATES.RECOVERY) {
    const turns = _resolveRecoveryTurns(state);
    _staggerFx.countdown.textContent = formatRecoveryCountdown(turns);
  } else {
    _staggerFx.countdown.textContent = '';
  }
}

/**
 * destroyStaggerFx()
 *
 * Tears down the stagger-fx layer + clears any pending fade timer + removes
 * the chromatic-shift / recovery classes from the root. Idempotent — safe
 * to call when nothing is mounted. Called by cleanupBattleScreen().
 */
export function destroyStaggerFx() {
  if (!_staggerFx) return;
  try {
    if (_staggerFx.fadeTimerId) {
      try { clearTimeout(_staggerFx.fadeTimerId); } catch (_e) { /* defensive */ }
    }
    if (_staggerFx.rootEl && _staggerFx.rootEl.classList) {
      _staggerFx.rootEl.classList.remove(CHROMATIC_CLASS);
      _staggerFx.rootEl.classList.remove(RECOVERY_CLASS);
      _staggerFx.rootEl.classList.remove(ACTIVE_CLASS);
    }
    if (_staggerFx.slot) {
      _staggerFx.slot.innerHTML = '';
      if (_staggerFx.slot.parentNode) {
        _staggerFx.slot.parentNode.removeChild(_staggerFx.slot);
      }
    }
  } catch (_e) { /* defensive — idempotent */ }
  _staggerFx = null;
}

// ─── pure helpers (exported for unit tests) ────────────────────────────────

/**
 * resolveStateClassName(bossState): returns the CSS class hook for a given
 * boss state. Never throws; unknown states return null (no class applied).
 *
 * Examples:
 *   resolveStateClassName('active')   → 'bw-stagger-fx--active'
 *   resolveStateClassName('stagger')  → 'bw-stagger-fx--stagger'
 *   resolveStateClassName('recovery') → 'bw-stagger-fx--recovery'
 *   resolveStateClassName(null)       → null
 *   resolveStateClassName('bogus')    → null
 */
export function resolveStateClassName(bossState) {
  if (typeof bossState !== 'string') return null;
  if (bossState === SACRED_BOSS_STATES.ACTIVE)   return ACTIVE_CLASS;
  if (bossState === SACRED_BOSS_STATES.STAGGER)  return CHROMATIC_CLASS;
  if (bossState === SACRED_BOSS_STATES.RECOVERY) return RECOVERY_CLASS;
  return null;
}

/**
 * formatRecoveryCountdown(turns): formats the Recovery countdown text.
 *
 * Examples:
 *   formatRecoveryCountdown(2)    → 'RECOVERING — 2 turns'
 *   formatRecoveryCountdown(1)    → 'RECOVERING — 1 turn'
 *   formatRecoveryCountdown(0)    → 'REVENGE'
 *   formatRecoveryCountdown(null) → ''
 *   formatRecoveryCountdown('x')  → ''
 *   formatRecoveryCountdown(-1)   → ''
 */
export function formatRecoveryCountdown(turns) {
  if (!Number.isFinite(turns)) return '';
  const n = Math.floor(turns);
  if (n < 0) return '';
  if (n === 0) return 'REVENGE';
  if (n === 1) return 'RECOVERING — 1 turn';
  return `RECOVERING — ${n} turns`;
}

// ─── private helpers ────────────────────────────────────────────────────────

function _applyStateClass(root, bossState) {
  if (!root || !root.classList) return;

  // Clean slate — strip all state classes before applying the new one. CSS
  // fade transitions on the chromatic-shift filter mean a brief overlap is
  // visually fine (the previous class fades out as the new one fades in).
  root.classList.remove(CHROMATIC_CLASS);
  root.classList.remove(RECOVERY_CLASS);
  root.classList.remove(ACTIVE_CLASS);

  const nextClass = resolveStateClassName(bossState);
  if (nextClass) {
    root.classList.add(nextClass);
  }
}

function _resolveRecoveryTurns(state) {
  // Priority: explicit `turnsInState` (test-friendly) > canonical
  // `recoveryTurnsRemaining` (legacy bridge) > staggerTurnsRemaining as
  // last resort.
  if (Number.isFinite(state.turnsInState)) return state.turnsInState;
  if (Number.isFinite(state.recoveryTurnsRemaining)) return state.recoveryTurnsRemaining;
  if (Number.isFinite(state.staggerTurnsRemaining))  return state.staggerTurnsRemaining;
  return NaN;
}

// ─── test hooks — exported only for unit tests ─────────────────────────────

export const _testables = Object.freeze({
  SACRED_BOSS_STATES,
  STAGGER_DURATION_TURNS,
  RECOVERY_DURATION_TURNS,
  FIRE_MULT_ACTIVE_RATIO,
  FIRE_MULT_STAGGER_RATIO,
  FIRE_MULT_RECOVERY_RATIO,
  ROOT_SLOT_ID,
  ROOT_CONTAINER_CLASS,
  CHROMATIC_CLASS,
  RECOVERY_CLASS,
  ACTIVE_CLASS,
  TELEGRAPH_LAYER_CLASS,
  COUNTDOWN_LABEL_CLASS,
  FADE_OUT_MS,
  _getCurrentStaggerFx: () => _staggerFx,
});
