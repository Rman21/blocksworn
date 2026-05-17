// 2026-05-16 — TASK-CP-006 (combat-polish-implementation-plan.md §9 Task 6):
//
// Damage channel color coding — makes the 4 damage channels visually
// distinguishable at a glance when boss attacks land on player HP.
//
// Spec: combat-polish-implementation-plan.md §9 Task 6 + §6.3 element
//       appearance table + §12 sacred boundaries.
//       combat-mechanics.md §9 (Damage flow: boss → player — 4-channel
//       system with FULL sacred values + colors) + §22 visual hooks rows
//       for player HP damage.
//       CLAUDE.md §2.5 sacred v2.1 P1 4-channel system.
//
// Lifecycle (mirrors synergy-bar / pressure-meter / top-hud / hero-card —
// plan §8.5):
//   mountDamageChannelFx(rootEl, state?)        → builds floating-number
//                                                 layer + channel FX overlay
//   updateDamageChannelFx(state)                → refresh MITIGATED chip
//                                                 (deferred — see footer note)
//   spawnDamageNumber(channel, amount,
//                     isCrit, opts?)            → fire a single floating
//                                                 damage number (delegates
//                                                 to vPlayDamageNumber)
//   triggerChannelFx(channel, opts?)            → fire a brief visual cue
//                                                 at the moment damage lands
//   destroyDamageChannelFx()                    → tears down DOM, idempotent
//
// The 4 damage channels and their per-channel visual identity (plan §6.3 +
// combat-mechanics.md §9):
//
//   ┌──────────────────┬─────────────┬────────────┬───────────────────┐
//   │ Channel          │ String key  │ Color      │ Haptic vibrate    │
//   ├──────────────────┼─────────────┼────────────┼───────────────────┤
//   │ DEAD_ZONE        │ 'deadzone'  │ #FF4D1F    │ [30]              │
//   │ VOID             │ 'void_tick' │ #9B59E8    │ [40, 30, 40]      │
//   │ SIGNATURE        │ 'signature' │ boss color │ [120, 50, 120]    │
//   │ GRID_SATURATION  │ 'saturation'│ #FFC04A    │ [50, 30, 50, 30,  │
//   │                  │             │  (amber)   │  50]              │
//   └──────────────────┴─────────────┴────────────┴───────────────────┘
//
// Notes
//   - DEAD_ZONE sacred color `#FF4D1F` ember-orange — per plan §6.3
//     "Damage channel DEAD_ZONE | #FF4D1F (always ember-orange, sacred)".
//   - VOID sacred color `#9B59E8` umbra-violet — per plan §6.3 + the
//     legacy `showChannelFX` styles map at src/core/damage-channels.js:223.
//   - SIGNATURE color derives from the boss's element via STIHIYA_COLORS
//     (read-only) — per plan §6.3 "Damage channel SIGNATURE | Boss's
//     element color". Defaults to umbra when boss element is missing.
//   - GRID_SATURATION color `#FFC04A` amber-warning — Designer choice per
//     plan §6.3 "Damage channel GRID_SATURATION | Amber warning
//     (designer-defined, non-element)". Distinct from solar `--a-solar`
//     so it doesn't read as a hero/element cue.
//
// Sacred-cow protection (CLAUDE.md §2.5 + plan §12):
//   - Channel string identifiers ('deadzone' / 'void_tick' / 'signature' /
//     'saturation') byte-perfect — module-local mirror + dual audit in
//     tests/unit/damage-channel-fx.test.js: (a) module mirror value
//     assertion, (b) regex-grep audit on src/core/damage-channels.js.
//   - All CHANNEL_* values, MITIGATION_CAP, signature tier map all unread
//     by this module — they live in src/core/damage-channels.js and stay
//     sacred. The visual layer NEVER computes damage; it only renders the
//     channel that the dispatcher already produced.
//   - This module READS damage events via spawnDamageNumber() /
//     triggerChannelFx() called BY the integration layer — it never writes
//     back into damage state.
//   - Animations: floating numbers and channel-FX overlays use
//     transform/opacity/filter only on hot paths (60fps).
//   - prefers-reduced-motion → floating numbers still appear (informational)
//     but skip the float animation (just brief flash+fade); channel FX
//     overlays simplified. CSS owns the toggle.
//
// Architectural notes
//   - src/feel/* NEVER imports from src/core/* (mirrors synergy-bar pattern).
//     The channel-color table is module-local; cross-validated against the
//     legacy `showChannelFX` styles map at src/core/damage-channels.js:223
//     via regex-grep audit in unit tests.
//   - animations.js (SHA1 baseline 41fd7ec…) stays byte-perfect; the new
//     `vPlayDamageNumber` helper lives in sibling `damage-fx.js` and is
//     imported here.

import { STIHIYAS, STIHIYA_COLORS } from '../data/elements.js';
import { vPlayDamageNumber } from './damage-fx.js';

// ─── module state ───────────────────────────────────────────────────────────

let _channelFx = null;

const ROOT_SLOT_ID            = 'bw-dmg-channel-fx';
const OVERLAY_CLASS            = 'bw-dmg-channel-overlay';
const OVERLAY_LAYER_CLASS      = 'bw-dmg-channel-overlay-layer';
const MITIGATION_CHIP_CLASS    = 'bw-dmg-mitigation-chip';

// ─── sacred channel string identifiers ──────────────────────────────────────
// SACRED per CLAUDE.md §2.5 + combat-mechanics.md §9.5. Byte-perfect mirror
// of src/core/damage-channels.js:157-160. Many call sites key off these
// exact strings (showChannelFX style map, FTUE dialog gate, mitigation
// matrix consumer, Sentry breadcrumbs) — they MUST match the canonical
// source. Audited via regex-grep in tests/unit/damage-channel-fx.test.js.
const SACRED_CHANNEL_KEYS = Object.freeze({
  DEAD_ZONE:        'deadzone',
  VOID:             'void_tick',
  SIGNATURE:        'signature',
  GRID_SATURATION:  'saturation',
});

// ─── per-channel color table ────────────────────────────────────────────────
// Plan §6.3 element-appearance table — sacred color identifiers per channel.
// DEAD_ZONE #FF4D1F + VOID #9B59E8 are sacred per plan §6.3 + cross-verified
// against combat-mechanics.md §9.1 / §9.2 + against the legacy showChannelFX
// styles map at src/core/damage-channels.js:223. Audited byte-perfect in
// tests/unit/damage-channel-fx.test.js.
//
// SIGNATURE intentionally has no static color — it inherits the boss's
// element color at render time (plan §6.3). GRID_SATURATION uses
// designer-defined amber-warning (#FFC04A), distinct from solar element
// color so it reads as "warning", not "hero".
const CHANNEL_COLORS = Object.freeze({
  deadzone:   '#FF4D1F',                           // sacred — plan §6.3
  void_tick:  '#9B59E8',                           // sacred — plan §6.3 + damage-channels.js:223
  signature:  null,                                // resolved from boss element
  saturation: '#FFC04A',                           // amber-warning — designer choice
});

// Fallback color when nothing else resolves — same warm-amber tone as
// GRID_SATURATION so a misrouted channel never shows up as a stark
// out-of-palette color.
const FALLBACK_COLOR = '#FFC04A';

// Default SIGNATURE color when boss element isn't supplied. Umbra-violet
// keeps a visually distinct read against the other 3 channels.
const SIGNATURE_DEFAULT_ELEMENT = 'umbra';

// Per-channel haptic vibrate patterns (mirrors the legacy showChannelFX
// styles map at src/core/damage-channels.js:222-225 byte-perfect for the
// channels that have static patterns). DEAD_ZONE uses [30] which aligns
// with V_HAPTICS.hit (30ms) — see CLAUDE.md §2.2.
const CHANNEL_HAPTICS = Object.freeze({
  deadzone:   Object.freeze([30]),                 // V_HAPTICS.hit aligned
  void_tick:  Object.freeze([40, 30, 40]),         // sacred — damage-channels.js:223
  signature:  Object.freeze([120, 50, 120]),       // damage-channels.js:224
  saturation: Object.freeze([50, 30, 50, 30, 50]), // damage-channels.js:225
});

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * mountDamageChannelFx(rootEl, state?)
 *
 * rootEl: the .bw-battle-root container (set up by battle-screen orchestrator).
 *         If null/undefined, returns false (no-op). Idempotent on repeat calls.
 * state:  optional seed for the MITIGATED chip (deferred — see footer note).
 *
 * Returns true on successful mount, false on no-op skip.
 */
export function mountDamageChannelFx(rootEl, state) {
  if (!rootEl) return false;
  if (_channelFx) return false;             // already mounted — idempotent

  // Find or create the channel-FX slot. Sits at the battle-root level so
  // both the floating-number spawner (in damage-fx.js) and the overlay
  // layer here can resolve coordinates inside the same coordinate space.
  let slot = rootEl.querySelector(`#${ROOT_SLOT_ID}`)
          || rootEl.querySelector('.bw-dmg-channel-fx');
  if (!slot) {
    slot = document.createElement('div');
    slot.id = ROOT_SLOT_ID;
    slot.className = 'bw-dmg-channel-fx';
    rootEl.appendChild(slot);
  }

  // Brief channel-FX overlay layer — a fixed layer the channel cue mounts
  // into (e.g. orange ember flash for DEAD_ZONE). Each cue is a fire-and-
  // forget child element that auto-removes after its animation completes.
  const overlay = document.createElement('div');
  overlay.className = OVERLAY_CLASS;
  overlay.setAttribute('aria-hidden', 'true');

  slot.innerHTML = '';
  slot.appendChild(overlay);

  _channelFx = {
    rootEl,
    slot,
    overlay,
    mitigationChip: null,                          // chip is created on demand
  };

  if (state) updateDamageChannelFx(state);
  return true;
}

/**
 * spawnDamageNumber(channel, amount, isCrit, opts?)
 *
 * Convenience facade onto vPlayDamageNumber that ensures the floating-
 * number layer mounts inside the same battle root as the channel-FX
 * overlay. Safe to call even when no bar is mounted — the call delegates
 * to the underlying helper which is itself defensive.
 *
 * channel: 'deadzone' | 'void_tick' | 'signature' | 'saturation'
 * amount:  numeric damage
 * isCrit:  bumps font-size + glow
 * opts:    { x?, y?, sourceCell?, bossElement?, layerHost? }
 */
export function spawnDamageNumber(channel, amount, isCrit, opts) {
  opts = opts || {};
  // Defensive: if mounted, prefer our slot's parent as the layer host so
  // coordinates resolve relative to the same root. Otherwise let
  // vPlayDamageNumber fall back to its own resolution.
  if (_channelFx && _channelFx.rootEl && !opts.layerHost) {
    opts = { ...opts, layerHost: _channelFx.rootEl };
  }
  return vPlayDamageNumber(channel, amount, !!isCrit, opts);
}

/**
 * triggerChannelFx(channel, opts?)
 *
 * Fires a brief visual cue at the moment damage lands. Each channel has a
 * distinct cue type:
 *   - DEAD_ZONE: orange flash + fade
 *   - VOID: purple particles tick
 *   - SIGNATURE: full element-colored burst
 *   - GRID_SATURATION: amber bar pulse across the grid
 *
 * For TASK-CP-006 scope we render a single channel-tinted flash overlay
 * with the channel color and per-channel CSS class hooks. Deeper per-
 * channel choreography lives in CSS (damage-channel-fx.css) and is
 * styled out from these class hooks.
 *
 * Idempotent — safe to call rapidly; each call spawns its own short-lived
 * DOM node.
 */
export function triggerChannelFx(channel, opts) {
  opts = opts || {};
  if (!_channelFx || !_channelFx.overlay) return null;

  try {
    const color = resolveChannelColor(channel, opts.bossElement);
    const cue = document.createElement('div');
    cue.className = `${OVERLAY_LAYER_CLASS} ${OVERLAY_LAYER_CLASS}--${_safeChannelClass(channel)}`;
    cue.setAttribute('aria-hidden', 'true');
    cue.style.setProperty('--bw-dmg-channel-color', color);

    _channelFx.overlay.appendChild(cue);

    // Auto-clean — CSS animation duration is ≈420ms for the channel
    // flash; we wait a touch longer to ensure the fade has fully ended
    // even after `prefers-reduced-motion` shortening.
    setTimeout(() => {
      try { cue.remove(); } catch (_e) { /* node already detached */ }
    }, 500);

    return cue;
  } catch (_err) {
    return null;
  }
}

/**
 * updateDamageChannelFx(state)
 *
 * Refreshes the "MITIGATED N" chip when mitigation is non-trivial.
 *
 * MITIGATED chip status: DEFERRED for TASK-CP-006 — the chip rendering is
 * implemented here but unwired into the legacy damage-handler pipeline.
 * The chip surfaces when callers pass `{ mitigated: N }`; for TASK-CP-006
 * scope the API is the deliverable.
 *
 * state: { mitigated?: number, mitigationPct?: number }
 *   - mitigated:     absolute HP saved by mitigation (e.g. 4)
 *   - mitigationPct: percentage of raw damage absorbed (0..1)
 *
 * The chip surfaces only when mitigation is "non-trivial" (≥10% per the
 * task brief). Lower amounts are visually invisible to avoid clutter on
 * every minor mitigation.
 */
export function updateDamageChannelFx(state) {
  if (!_channelFx) return;
  if (state !== undefined && state !== null && typeof state !== 'object') return;
  if (!state) return;

  const mitigated     = (typeof state.mitigated     === 'number') ? state.mitigated     : 0;
  const mitigationPct = (typeof state.mitigationPct === 'number') ? state.mitigationPct : 0;

  // Non-trivial threshold — per task brief "show a chip when mitigation
  // is non-trivial (≥10% reduction)".
  const showChip = mitigated > 0 && mitigationPct >= 0.10;
  if (!showChip) {
    // Remove any existing chip when the threshold drops below the floor.
    _removeMitigationChip();
    return;
  }

  // Mount-on-demand — chip lives inside the overlay (same coordinate space).
  if (!_channelFx.mitigationChip) {
    const chip = document.createElement('div');
    chip.className = MITIGATION_CHIP_CLASS;
    chip.setAttribute('aria-hidden', 'true');
    _channelFx.overlay.appendChild(chip);
    _channelFx.mitigationChip = chip;
  }
  _channelFx.mitigationChip.textContent = `MITIGATED ${Math.max(0, Math.round(mitigated))}`;
}

/**
 * destroyDamageChannelFx()
 *
 * Tears down the channel-FX overlay + clears module state. Idempotent —
 * safe to call when nothing is mounted. Called by cleanupBattleScreen().
 */
export function destroyDamageChannelFx() {
  if (!_channelFx) return;
  try {
    if (_channelFx.slot) {
      _channelFx.slot.innerHTML = '';
      if (_channelFx.slot.parentNode) {
        _channelFx.slot.parentNode.removeChild(_channelFx.slot);
      }
    }
  } catch (_e) { /* defensive — idempotent */ }
  _channelFx = null;
}

// ─── pure helpers (exported for unit tests) ─────────────────────────────────

/**
 * resolveChannelColor(channel, bossElement?): returns the hex color for a
 * given channel. SIGNATURE inherits from the boss's element (or 'umbra' if
 * unspecified). Unknown channels return the fallback amber color.
 *
 * Never throws — exclusively a pure read of the CHANNEL_COLORS lookup.
 *
 * Examples:
 *   resolveChannelColor('deadzone')                  → '#FF4D1F'
 *   resolveChannelColor('void_tick')                 → '#9B59E8'
 *   resolveChannelColor('signature', 'ember')        → STIHIYA_COLORS.ember
 *   resolveChannelColor('signature')                 → STIHIYA_COLORS.umbra
 *   resolveChannelColor('saturation')                → '#FFC04A'
 *   resolveChannelColor(null)                        → '#FFC04A' (fallback)
 *   resolveChannelColor('bogus')                     → '#FFC04A' (fallback)
 */
export function resolveChannelColor(channel, bossElement) {
  if (typeof channel !== 'string') return FALLBACK_COLOR;

  if (channel === SACRED_CHANNEL_KEYS.SIGNATURE) {
    const el = (typeof bossElement === 'string' && STIHIYAS.includes(bossElement))
      ? bossElement
      : SIGNATURE_DEFAULT_ELEMENT;
    // STIHIYA_COLORS is read-only legacy import; never modified.
    const color = STIHIYA_COLORS && STIHIYA_COLORS[el];
    return (typeof color === 'string') ? color : FALLBACK_COLOR;
  }

  const direct = CHANNEL_COLORS[channel];
  if (typeof direct === 'string' && direct) return direct;
  return FALLBACK_COLOR;
}

/**
 * resolveChannelHaptic(channel): returns the per-channel vibrate pattern
 * (frozen array). Unknown channels return [] (no vibrate). Never throws.
 *
 * Examples:
 *   resolveChannelHaptic('deadzone')   → [30]
 *   resolveChannelHaptic('void_tick')  → [40, 30, 40]
 *   resolveChannelHaptic('signature')  → [120, 50, 120]
 *   resolveChannelHaptic('saturation') → [50, 30, 50, 30, 50]
 *   resolveChannelHaptic(null)         → []
 *   resolveChannelHaptic('bogus')      → []
 */
export function resolveChannelHaptic(channel) {
  if (typeof channel !== 'string') return [];
  const pattern = CHANNEL_HAPTICS[channel];
  if (!pattern) return [];
  // Return a defensive copy so callers can't mutate the frozen module-local.
  return Array.from(pattern);
}

/**
 * formatDamageText(amount, isCrit): formats a numeric damage value into the
 * canonical display string. Crit suffix is "!" (unambiguous, locale-free).
 *
 * Examples:
 *   formatDamageText(50, false) → '50'
 *   formatDamageText(50, true)  → '50!'
 *   formatDamageText(0, false)  → '0'
 *   formatDamageText(0, true)   → '0!'
 *   formatDamageText('x', false)→ '0'    (non-numeric coerces to 0)
 *   formatDamageText(null, true)→ '0!'
 */
export function formatDamageText(amount, isCrit) {
  const n = (typeof amount === 'number' && Number.isFinite(amount))
    ? Math.max(0, Math.round(amount))
    : 0;
  return isCrit ? `${n}!` : `${n}`;
}

// ─── private helpers ────────────────────────────────────────────────────────

function _safeChannelClass(channel) {
  // Defensive — only accept the 4 sacred channel keys for the class hook.
  // Unknown channels still render via the fallback color but get a
  // generic class so CSS doesn't end up with stale `--bogus` selectors.
  const valid = ['deadzone', 'void_tick', 'signature', 'saturation'];
  if (typeof channel === 'string' && valid.includes(channel)) {
    // CSS class is the channel key with '_' → '-' for valid CSS identifiers.
    return channel.replace(/_/g, '-');
  }
  return 'unknown';
}

function _removeMitigationChip() {
  if (!_channelFx || !_channelFx.mitigationChip) return;
  try {
    _channelFx.mitigationChip.remove();
  } catch (_e) { /* defensive */ }
  _channelFx.mitigationChip = null;
}

// ─── test hooks — exported only for unit tests ──────────────────────────────

export const _testables = Object.freeze({
  SACRED_CHANNEL_KEYS,
  CHANNEL_COLORS,
  CHANNEL_HAPTICS,
  FALLBACK_COLOR,
  SIGNATURE_DEFAULT_ELEMENT,
  ROOT_SLOT_ID,
  OVERLAY_CLASS,
  OVERLAY_LAYER_CLASS,
  MITIGATION_CHIP_CLASS,
  _getCurrentChannelFx: () => _channelFx,
});
