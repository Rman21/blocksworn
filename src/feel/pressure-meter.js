// 2026-05-16 — TASK-CP-004 (combat-polish-implementation-plan.md §9 Task 4):
//
// Pressure meter — Sekiro-style horizontal gauge.
//
// Spec: combat-polish-implementation-plan.md §7.3 (Pressure meter 32px)
//       combat-mechanics.md §13 (Pressure meter — sacred values)
//       combat-mechanics.md §12 (Stagger Loop lifecycle)
//
// Lifecycle (mirrors boss-scene.js + hero-card.js + top-hud.js — plan §8.5):
//   mountPressureMeter(rootEl, state?)  → builds gauge DOM into .bw-zone-pressure
//   updatePressureMeter(state)          → refreshes fill + numeric (partial OK)
//   destroyPressureMeter()              → tears down DOM, idempotent
//
// Visual composition (plan §7.3):
//
//   ⚡ ▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░  STAGGER →  62/100
//
// Per plan §7.3:
//   - Fill direction: left to right
//   - Threshold marker at 100% with "STAGGER →" label (right-aligned next to fill end)
//   - Gold gradient (#FFD53D → #FF9F1C) — saturates as approaching 100%
//   - ⚡ icon left of bar (placeholder emoji; Task 5 swap to element emblem)
//   - Numeric value right of bar (e.g. 62/100)
//
// Surge animation:
//   - Fires ONLY on recentEvent === 'line_quad' (+45 pressure — biggest single delta
//     per sacred PRESSURE_GAIN.line_quad = 45). Other 8 events do NOT surge.
//   - Surge = brief scale/glow pulse on the just-filled segment (CSS keyframes).
//   - prefers-reduced-motion users → surge animation disabled (CSS guard).
//
// Sacred-cow protection (CLAUDE.md §2 + plan §12):
//   - PRESSURE_MAX = 100 (sacred ceiling — combat-mechanics.md §13.1, byte-perfect).
//   - PRESSURE_GAIN 9 values (sacred — combat-mechanics.md §13.2):
//       line_single:5, line_double:12, line_triple:25, line_quad:45,
//       inferno_proc:20, detonate_proc:20, hero_ult:15,
//       signature_combo:30, cascade_per_cell:8
//   - This module READS via game state; it never writes back. Stagger trigger
//     logic in src/core/stagger-loop.js is untouched.
//   - Module-local sacred mirror (per top-hud.js precedent) — direct import from
//     src/core/stagger-loop.js bootstraps heavy legacy state that throws in
//     headless unit env. Dual audit in tests/unit/pressure-meter.test.js:
//     (a) module mirror value assertion, (b) regex-grep audit on canonical source.
//   - --a-* tokens are the colour authority; we lean on --a-solar + --a-gold-300
//     for the gradient endpoints (close enough to plan #FFD53D / #FF9F1C without
//     adding new tokens — see commit message).
//   - Gauge animations use only transform/opacity (60fps hot-path guard).
//   - Never overrides .stagger-slow-mo / .boss-death-pause / .v-fx-shake /
//     .v-fx-crit-flash classes — stagger entry FX remain owned by animations.js.
//
// Graceful degradation:
//   - mount() returns false when rootEl is null/undefined (no-op).
//   - update() / destroy() on unmounted meter are silent no-ops.
//   - Missing state fields render placeholder (--/--) until state arrives.
//
// Import discipline (mirrors hero-card.js / boss-scene.js / top-hud.js — plan §8.3):
//   - src/feel/* NEVER imports from src/core/* — that side of the codebase
//     bootstraps heavy legacy state (HERO_ROSTER, save progress, stagger-loop
//     side effects) and would blow up in headless test environments. Sacred
//     PRESSURE_MAX (100) and PRESSURE_GAIN 9 values are mirrored here as
//     module-local frozen constants with runtime parity checks against the
//     canonical window bridge when the legacy runtime is loaded. Identical
//     pattern to top-hud.js _testables.MAX_HP / FIRE_MULT_ACTIVE_RATIO audit.

// ─── module state ───────────────────────────────────────────────────────────
// Single instance per app lifetime. mount() guards double-mount; destroy() clears.
let _meter = null;

const METER_ZONE_ID = 'bw-zone-pressure';      // grid-row 3 per battle-layout.css
const METER_CONTAINER_CLASS = 'bw-pressure-meter';
const SURGE_CLASS = 'bw-pressure-meter--surge';
const SURGE_DURATION_MS = 520;                  // total CSS animation duration

// Sacred PRESSURE_MAX — fixed at 100 per CLAUDE.md §2.5 (v2.1 P2 Stagger Loop)
// + combat-mechanics.md §13.1 + src/core/stagger-loop.js:215. Mirrored here as
// a module-local constant; runtime parity check below catches drift against
// window.PRESSURE_MAX when the legacy bridge is loaded.
const PRESSURE_MAX = 100;

// Sacred PRESSURE_GAIN table — 9 values per combat-mechanics.md §13.2 +
// src/core/stagger-loop.js:219-229. Frozen to prevent accidental mutation.
// Unit test asserts byte-perfect parity against canonical source via regex.
const PRESSURE_GAIN = Object.freeze({
  line_single:      5,    // 1-line clear
  line_double:     12,    // 2-line clear (cross / double row)
  line_triple:     25,    // 3-line clear
  line_quad:       45,    // 4-line clear (mastery moment → surge animation)
  inferno_proc:    20,    // EMBER inferno trigger
  detonate_proc:   20,    // SOLAR detonate trigger
  hero_ult:        15,    // Any hero ULT fired
  signature_combo: 30,    // Squad-wide signature combo (P3+ scaffold)
  cascade_per_cell: 8,    // Cascade chain — per cleared cell
});

// Surge event — the single event that triggers the mastery-moment animation.
// Per plan §7.3 + combat-mechanics.md §13.3: line_quad is the biggest single
// delta (+45 pressure) and should "feel like a mastery moment (reinforced
// visually)". Other 8 events build pressure without animated surge.
const SURGE_EVENT = 'line_quad';

// Runtime cross-check vs legacy globals when available. We don't throw here
// (legacy bridge may not be loaded under unit tests) — but if a mismatch
// surfaces in dev, the console will surface it loudly via dev tools.
try {
  if (typeof window !== 'undefined') {
    if (typeof window.PRESSURE_MAX === 'number' && window.PRESSURE_MAX !== PRESSURE_MAX) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          `[pressure-meter] PRESSURE_MAX parity drift: module=${PRESSURE_MAX}, window=${window.PRESSURE_MAX}`
        );
      }
    }
    if (window.PRESSURE_GAIN && typeof window.PRESSURE_GAIN === 'object') {
      for (const key of Object.keys(PRESSURE_GAIN)) {
        if (typeof window.PRESSURE_GAIN[key] === 'number'
            && window.PRESSURE_GAIN[key] !== PRESSURE_GAIN[key]) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn(
              `[pressure-meter] PRESSURE_GAIN.${key} parity drift: ` +
              `module=${PRESSURE_GAIN[key]}, window=${window.PRESSURE_GAIN[key]}`
            );
          }
        }
      }
    }
  }
} catch (_e) { /* defensive — no-op */ }

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * mountPressureMeter(rootEl, state?)
 *
 * rootEl: the .bw-battle-root container (set up by battle-screen orchestrator).
 *         If null/undefined, returns false (no-op). Idempotent on repeat calls.
 * state:  optional { pressure?, pressureMax?, recentEvent? } seed.
 *         Missing fields render placeholder. Real state lands via
 *         updatePressureMeter() once the battle loop pipes through.
 *
 * Returns true on successful mount, false on no-op skip.
 */
export function mountPressureMeter(rootEl, state) {
  if (!rootEl) return false;
  if (_meter) return false;             // already mounted — idempotent

  // Locate or create the pressure-zone slot inside the battle root. In a
  // fully modular renderer rootEl already has the slot; in interim contexts
  // we create one defensively so the meter has somewhere to render.
  let slot = rootEl.querySelector(`#${METER_ZONE_ID}`)
          || rootEl.querySelector('.bw-zone-pressure');
  if (!slot) {
    slot = document.createElement('div');
    slot.id = METER_ZONE_ID;
    slot.className = 'bw-zone-pressure';
    rootEl.appendChild(slot);
  }

  // Build the meter container — horizontal gauge spanning content-width.
  const meter = document.createElement('div');
  meter.className = METER_CONTAINER_CLASS;
  meter.setAttribute('role', 'progressbar');
  meter.setAttribute('aria-label', 'Pressure — Stagger gauge');
  meter.setAttribute('aria-valuemin', '0');
  meter.setAttribute('aria-valuemax', String(PRESSURE_MAX));
  meter.setAttribute('aria-valuenow', '0');

  // Icon — ⚡ lightning glyph (placeholder; Task 5 will swap to proper
  // element-style emblem). Hidden from AT (gauge label carries the meaning).
  const iconEl = document.createElement('span');
  iconEl.className = 'bw-pressure-icon';
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.textContent = '⚡';

  // Bar track — the horizontal channel housing the fill.
  const trackEl = document.createElement('div');
  trackEl.className = 'bw-pressure-track';

  // Fill — the gold gradient bar that grows left→right with pressure.
  const fillEl = document.createElement('div');
  fillEl.className = 'bw-pressure-fill';
  fillEl.style.width = '0%';

  trackEl.appendChild(fillEl);

  // Threshold marker — "STAGGER →" label at 100% position. Visible cue that
  // hitting full bar triggers Stagger (sacred behaviour in stagger-loop.js).
  const thresholdEl = document.createElement('span');
  thresholdEl.className = 'bw-pressure-threshold';
  thresholdEl.setAttribute('aria-hidden', 'true');
  thresholdEl.textContent = 'STAGGER →';

  // Numeric value — "<pressure>/<max>" on the right of the bar.
  const valueEl = document.createElement('span');
  valueEl.className = 'bw-pressure-value';
  valueEl.textContent = `0/${PRESSURE_MAX}`;

  meter.appendChild(iconEl);
  meter.appendChild(trackEl);
  meter.appendChild(thresholdEl);
  meter.appendChild(valueEl);

  // Clear slot before appending (ensures clean state if a previous destroy
  // was incomplete).
  slot.innerHTML = '';
  slot.appendChild(meter);

  _meter = {
    rootEl,
    slot,
    meter,
    iconEl,
    trackEl,
    fillEl,
    thresholdEl,
    valueEl,
    surgeTimerId: null,
  };

  // Apply initial state — defaults render 0/PRESSURE_MAX placeholder.
  if (state) updatePressureMeter(state);
  return true;
}

/**
 * updatePressureMeter(state)
 *
 * state: { pressure?, pressureMax?, recentEvent? } — partial update;
 *        missing fields leave prior values untouched.
 *
 *        recentEvent: optional string. When === 'line_quad' (sacred biggest
 *        single delta per PRESSURE_GAIN.line_quad = 45), triggers a one-shot
 *        surge animation on the fill. Other PRESSURE_GAIN keys do not surge.
 *
 * Never throws on bad input. Unknown / non-numeric values are ignored.
 */
export function updatePressureMeter(state) {
  if (!_meter) return;
  if (!state || typeof state !== 'object') return;

  // Resolve pressureMax (defensive — sacred default 100).
  const max = (Object.prototype.hasOwnProperty.call(state, 'pressureMax')
               && Number.isFinite(state.pressureMax) && state.pressureMax > 0)
    ? state.pressureMax
    : PRESSURE_MAX;

  // Pressure — clamp [0, max].
  if (Object.prototype.hasOwnProperty.call(state, 'pressure')) {
    const pct = pressureFillPct(state.pressure, max);
    _meter.fillEl.style.width = `${pct}%`;
    _meter.valueEl.textContent = formatPressureLabel(state.pressure, max);
    _meter.meter.setAttribute('aria-valuenow', String(Math.max(0, Math.min(max, Math.floor(state.pressure)))));
    _meter.meter.setAttribute('aria-valuemax', String(max));

    // Saturation cue — toggle .bw-pressure-meter--near-max class once fill
    // crosses 80% so CSS can saturate the gradient near the threshold.
    if (pct >= 80) {
      _meter.meter.classList.add('bw-pressure-meter--near-max');
    } else {
      _meter.meter.classList.remove('bw-pressure-meter--near-max');
    }
  }

  // Surge — fires ONLY on line_quad event (mastery moment).
  if (Object.prototype.hasOwnProperty.call(state, 'recentEvent')) {
    if (shouldTriggerSurge(state.recentEvent)) {
      _triggerSurge();
    }
  }
}

/**
 * destroyPressureMeter()
 *
 * Tears down the meter DOM + clears module state. Idempotent — safe to call
 * when no meter mounted. Called by cleanupBattleScreen.
 */
export function destroyPressureMeter() {
  if (!_meter) return;
  if (_meter.surgeTimerId) {
    try { clearTimeout(_meter.surgeTimerId); } catch (_e) { /* defensive */ }
  }
  if (_meter.slot) _meter.slot.innerHTML = '';
  _meter = null;
}

// ─── internal — surge animation ─────────────────────────────────────────────

function _triggerSurge() {
  if (!_meter || !_meter.meter) return;
  // Toggle the surge class, then remove after animation duration. The CSS
  // keyframes handle the scale+glow pulse (transform/opacity only — 60fps
  // hot-path guard). Defensive clearTimeout for back-to-back surges.
  _meter.meter.classList.add(SURGE_CLASS);
  if (_meter.surgeTimerId) {
    try { clearTimeout(_meter.surgeTimerId); } catch (_e) { /* defensive */ }
  }
  _meter.surgeTimerId = setTimeout(() => {
    if (_meter && _meter.meter) _meter.meter.classList.remove(SURGE_CLASS);
    if (_meter) _meter.surgeTimerId = null;
  }, SURGE_DURATION_MS);
}

// ─── pure helpers (exported for unit tests) ─────────────────────────────────

/**
 * pressureFillPct(pressure, pressureMax): clamps pressure to [0..pressureMax]
 * and returns the percentage (0..100) to drive CSS width.
 *
 * Examples (sacred PRESSURE_MAX=100):
 *   pressureFillPct(62, 100) → 62
 *   pressureFillPct(100, 100) → 100
 *   pressureFillPct(0, 100) → 0
 *   pressureFillPct(-5, 100) → 0     (clamp negative)
 *   pressureFillPct(150, 100) → 100  (clamp over-max)
 *   pressureFillPct('X', 100) → 0    (non-numeric guard)
 *   pressureFillPct(45, 100) → 45    (PRESSURE_GAIN.line_quad — surge moment)
 */
export function pressureFillPct(pressure, pressureMax) {
  if (!Number.isFinite(pressure)) return 0;
  const max = (Number.isFinite(pressureMax) && pressureMax > 0) ? pressureMax : PRESSURE_MAX;
  const clamped = Math.max(0, Math.min(max, pressure));
  return Math.floor((clamped / max) * 100);
}

/**
 * formatPressureLabel(pressure, pressureMax): renders "<pressure>/<max>"
 * with integer floor + clamp. Renders "--/100" when pressure invalid.
 *
 * Examples:
 *   formatPressureLabel(62, 100) → "62/100"
 *   formatPressureLabel(100, 100) → "100/100"
 *   formatPressureLabel(0, 100) → "0/100"
 *   formatPressureLabel(45.7, 100) → "45/100"   (floor fractional)
 *   formatPressureLabel(-5, 100) → "0/100"      (clamp negative)
 *   formatPressureLabel(150, 100) → "100/100"   (clamp over-max)
 *   formatPressureLabel(null, 100) → "--/100"
 *   formatPressureLabel('X', 100) → "--/100"
 */
export function formatPressureLabel(pressure, pressureMax) {
  const max = (Number.isFinite(pressureMax) && pressureMax > 0) ? pressureMax : PRESSURE_MAX;
  const maxStr = String(Math.floor(max));
  if (!Number.isFinite(pressure)) return `--/${maxStr}`;
  const clamped = Math.max(0, Math.min(max, Math.floor(pressure)));
  return `${clamped}/${maxStr}`;
}

/**
 * shouldTriggerSurge(recentEvent): predicate for the surge animation. Returns
 * true only when the caller passes the sacred line_quad event identifier
 * (which awards PRESSURE_GAIN.line_quad = 45 — the biggest single delta).
 *
 * All other 8 PRESSURE_GAIN events return false (build pressure without surge):
 *   line_single, line_double, line_triple, inferno_proc, detonate_proc,
 *   hero_ult, signature_combo, cascade_per_cell.
 *
 * Examples:
 *   shouldTriggerSurge('line_quad') → true
 *   shouldTriggerSurge('line_triple') → false
 *   shouldTriggerSurge('inferno_proc') → false
 *   shouldTriggerSurge(null) → false
 *   shouldTriggerSurge('made_up_event') → false
 */
export function shouldTriggerSurge(recentEvent) {
  return recentEvent === SURGE_EVENT;
}

// ─── test hooks — exported only for unit tests ──────────────────────────────

export const _testables = Object.freeze({
  PRESSURE_MAX,
  PRESSURE_GAIN,
  SURGE_EVENT,
  SURGE_DURATION_MS,
  _getCurrentMeter: () => _meter,
});
