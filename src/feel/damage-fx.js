// 2026-05-16 — TASK-CP-006 (combat-polish-implementation-plan.md §9 Task 6):
//
// damage-fx.js — sibling module to animations.js, lands the new
// `vPlayDamageNumber()` floating-damage-number FX helper for the 4-channel
// damage system (DEAD_ZONE / VOID / SIGNATURE / GRID_SATURATION).
//
// Why a NEW module instead of extending animations.js
// ---------------------------------------------------
// animations.js carries the sacred byte-perfect SHA1 baseline `41fd7ec…`
// (see CLAUDE.md §2.2 sacred-cow audit). Adding a new export there would
// invalidate the baseline. Per combat-polish-implementation-plan.md §8.2
// "files modified (additive only)" the intent is "extend existing FX, do
// not remove" — but the sacred-cow audit hashes the file byte-perfect. The
// pragmatic resolution (documented in TASK-CP-006 brief): land the new
// vPlay* helper in this sibling module. animations.js stays byte-perfect;
// the new floating-number FX still lives next to its peers (vPlayCritFlash,
// vPlayLineClearBurst, vPlayBossDieFx) for discoverability.
//
// Scope (per plan §9 Task 6 + §6.3 + combat-mechanics.md §9):
//   - vPlayDamageNumber(channel, amount, isCrit, opts) — spawns a floating
//     damage number anchored at the supplied coordinates (or a sensible
//     fallback inside the battle root). Number color = channel color per
//     plan §6.3 element-appearance table.
//
// Sacred protection
//   - Channel string identifiers ('deadzone' / 'void_tick' / 'signature' /
//     'saturation') byte-perfect; never invented locally — sourced from
//     `resolveChannelColor()` lookup table in damage-channel-fx.js.
//   - Sacred color hex codes #FF4D1F (deadzone) + #9B59E8 (void) verified
//     in tests/unit/damage-channel-fx.test.js (dual audit: module mirror +
//     regex-grep against src/core/damage-channels.js).
//   - Animations use only transform/opacity hot paths (60fps). The number
//     element lives in a fire-and-forget pool — auto-removed after its
//     animation completes (≈900ms).
//   - prefers-reduced-motion path: the number still appears (informational)
//     but skips the float; pure brief flash + fade. CSS owns the toggle.
//
// Does NOT own
//   - The FX overlay layer at the damage origin (channel flash burst):
//     that's the responsibility of damage-channel-fx.js triggerChannelFx().
//   - The mount/destroy lifecycle: handled by damage-channel-fx.js
//     mountDamageChannelFx() / destroyDamageChannelFx().
//   - Game-state integration: the dispatcher in src/core/damage-channels.js
//     is sacred and untouched; wiring vPlayDamageNumber() into the
//     channel-FX pipeline is a follow-up integration task — for TASK-CP-006
//     the deliverable is the FX API itself.

import { resolveChannelColor, formatDamageText } from './damage-channel-fx.js';

// Single floating-number layer per app (created lazily on first call).
// Lives at the battle-root level so coordinates resolve relative to it.
const NUMBER_LAYER_CLASS = 'bw-dmg-number-layer';
const NUMBER_CLASS       = 'bw-dmg-number';
const NUMBER_CRIT_CLASS  = 'bw-dmg-number--crit';

// Animation lifetime — number floats up and fades out. Same order of
// magnitude as the existing line-clear burst (1000ms) so multiple numbers
// don't queue forever on a heavy turn.
const NUMBER_LIFETIME_MS = 900;

/**
 * vPlayDamageNumber(channel, amount, isCrit, opts)
 *
 * Spawns a floating damage number, color-coded per channel. Auto-removes
 * after the float animation completes. Idempotent — safe to call rapidly;
 * each call spawns its own short-lived DOM node.
 *
 * channel: 'deadzone' | 'void_tick' | 'signature' | 'saturation'
 * amount:  numeric damage (positive integer); 0 is allowed but rendered as "0"
 * isCrit:  boolean — bumps font-size + glow when true
 * opts: {
 *   x, y       — coordinates inside the layer; if missing, centered
 *   sourceCell — Element|null — fallback anchor; reads its bounding rect
 *   bossElement — 'ember'|'tide'|'grove'|'solar'|'umbra' — used when
 *                 channel === 'signature' (signature inherits boss color)
 *   layerHost  — Element to mount the layer into; defaults to .bw-battle-root
 *                or .a-battle, or body if neither exists
 * }
 *
 * Returns the spawned DOM element (or null if no host could be found).
 * Never throws.
 */
export function vPlayDamageNumber(channel, amount, isCrit, opts) {
  opts = opts || {};
  try {
    const host = _resolveHost(opts.layerHost);
    if (!host) return null;

    const layer = _ensureLayer(host);
    if (!layer) return null;

    const node = document.createElement('div');
    node.className = NUMBER_CLASS;
    if (isCrit) node.classList.add(NUMBER_CRIT_CLASS);
    node.setAttribute('data-channel', String(channel || 'unknown'));
    node.setAttribute('aria-hidden', 'true');

    // Color resolution — signature inherits boss element; everyone else
    // routes through the sacred channel-color table.
    const color = resolveChannelColor(channel, opts.bossElement);
    node.style.color = color;
    node.style.setProperty('--bw-dmg-color', color);

    // Text content — pure helper keeps the formatting contract stable
    // for unit tests (no implicit "CRIT" tag — caller-passed isCrit drives
    // an unambiguous bang suffix per formatDamageText).
    node.textContent = formatDamageText(amount, !!isCrit);

    // Position — coordinates inside the layer. We prefer explicit (x, y),
    // fall back to the sourceCell midpoint, and finally to layer center.
    const pos = _resolvePosition(opts, layer);
    node.style.left = `${pos.x}px`;
    node.style.top  = `${pos.y}px`;

    layer.appendChild(node);

    // Auto-clean — the CSS animation handles the visual fade; we just
    // detach the node once the animation has run.
    setTimeout(() => {
      try { node.remove(); } catch (_e) { /* node already detached */ }
    }, NUMBER_LIFETIME_MS);

    return node;
  } catch (_err) {
    // Defensive: feel-layer FX never crashes the battle loop. Same posture
    // as vPlayCritFlash / vPlayLineClearBurst inside animations.js (their
    // try/catch surrounds the haptic call; here we wrap the whole spawn).
    return null;
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function _resolveHost(explicitHost) {
  if (explicitHost && typeof explicitHost.appendChild === 'function') {
    return explicitHost;
  }
  try {
    if (typeof document === 'undefined') return null;
    return document.querySelector('.bw-battle-root')
        || document.querySelector('.a-battle')
        || document.querySelector('.game.v-battle')
        || document.body
        || null;
  } catch (_e) {
    return null;
  }
}

function _ensureLayer(host) {
  if (!host || typeof host.appendChild !== 'function') return null;
  let layer = host.querySelector(`.${NUMBER_LAYER_CLASS}`);
  if (!layer) {
    layer = document.createElement('div');
    layer.className = NUMBER_LAYER_CLASS;
    layer.setAttribute('aria-hidden', 'true');
    // The layer is presentational only — tap-through to underlying canvas.
    layer.style.pointerEvents = 'none';
    host.appendChild(layer);
  }
  return layer;
}

function _resolvePosition(opts, layer) {
  if (typeof opts.x === 'number' && typeof opts.y === 'number') {
    return { x: opts.x, y: opts.y };
  }
  if (opts.sourceCell && typeof opts.sourceCell.getBoundingClientRect === 'function') {
    try {
      const cr = opts.sourceCell.getBoundingClientRect();
      const lr = layer.getBoundingClientRect();
      return {
        x: (cr.left + cr.width  / 2) - lr.left,
        y: (cr.top  + cr.height / 2) - lr.top,
      };
    } catch (_e) { /* fall through to center */ }
  }
  try {
    const lr = layer.getBoundingClientRect();
    return { x: lr.width / 2, y: lr.height / 2 };
  } catch (_e) {
    return { x: 0, y: 0 };
  }
}

// ─── test hooks — exported only for unit tests ──────────────────────────────

export const _dmgFxTestables = Object.freeze({
  NUMBER_LAYER_CLASS,
  NUMBER_CLASS,
  NUMBER_CRIT_CLASS,
  NUMBER_LIFETIME_MS,
});
