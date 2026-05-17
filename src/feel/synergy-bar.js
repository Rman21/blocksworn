// 2026-05-16 — TASK-CP-005 (combat-polish-implementation-plan.md §9 Task 5):
//
// Synergy bar — 5 hex emblems indicating element-synergy tier (2x / 3x / 5x).
//
// Spec: combat-polish-implementation-plan.md §9 Task 5 + §6 Element visual
//       system + §7.4 hero/element binding + §12 sacred boundaries.
//       combat-mechanics.md §4 (5 elements + dominant-per-line) + §6 (Element
//       synergy 2x/3x/5x — sacred ULT reductions + damage bonuses).
//       CLAUDE.md §2.1 — sacred 2x/3x/5x table.
//
// Lifecycle (mirrors pressure-meter.js / top-hud.js / hero-card.js — plan §8.5):
//   mountSynergyBar(rootEl, state?)   → builds 5 emblem DOM into bar slot
//   updateSynergyBar(state)           → refreshes per-element tier (partial OK)
//   destroySynergyBar()               → tears down DOM, idempotent
//
// Visual composition (plan §9 Task 5 + §6.3):
//
//   ┌──────────────────────────────────────────────────────────────────┐
//   │   [ember] [tide] [grove] [solar] [umbra]                          │
//   │     ▼       ▼      ★       ▼       ▼                              │
//   │  idle    idle    3x     idle    idle                              │
//   └──────────────────────────────────────────────────────────────────┘
//
// Per plan §9 Task 5 + §6.3 + combat-mechanics.md §6:
//   - 5 hex emblems, one per stihiya (ember/tide/grove/solar/umbra) — order
//     locked to STIHIYAS array (sacred element list per src/data/elements.js).
//   - Idle state: emblem grayscale + low opacity (~30%), no glow
//   - 2x tier:   emblem full color, subtle glow (element-colored)
//   - 3x tier:   emblem full color, stronger glow + faint pulse (60fps)
//   - 5x tier:   emblem full color, ceremonial glow + heavier pulse + halo
//                expanding outward (Marvel-Snap snap-moment style)
//
// Placement decision (rationale documented in commit + synergy-bar.css):
//   Bar is rendered as an AUXILIARY STRIP BELOW THE BOSS SCENE, positioned
//   absolutely at the bottom of .bw-zone-boss (overlapping the Z4 overlay
//   gradient by ~6-8px to feel like part of the boss frame). Rationale:
//
//     (a) Adding a 7th grid row to battle-layout.css would push the grid
//         arena overflow risk back into the 759px iPhone-16 budget
//         (plan §5.1 vertical math already at 774px overflow-into-padding).
//     (b) The bar's MEANING is squad-vs-boss elemental alignment — visually
//         anchoring it to the boss scene reinforces the "this is your
//         squad bearing on the boss's domain" reading (plan §6 + §7.4).
//     (c) Z-order: bar lives at z-index 5 inside .bw-zone-boss (above the
//         Z4 overlay gradient that owns 0-4), so emblem state escalation
//         reads cleanly against the boss frame without competing with HUD.
//
// Sacred-cow protection (CLAUDE.md §2.1 + plan §12):
//   - Element synergy 2x = −2 ULT threshold (CLAUDE.md §2.1 row 1)
//   - Element synergy 3x = −4 ULT threshold + 20% passive damage (CLAUDE.md §2.1 row 2)
//   - Element synergy 5x = −6 ULT threshold + 50% damage + 30% start charge
//     (CLAUDE.md §2.1 row 3)
//   - This module READS synergy state via window.synergyState or callers;
//     it never writes back into game logic. dominantCount computation in
//     src/core/battle.js is sacred and UNTOUCHED.
//   - Module-local sacred mirror (per top-hud.js / pressure-meter.js
//     precedent) — direct import from src/core/battle.js bootstraps heavy
//     legacy state that throws in headless unit env. Dual audit in
//     tests/unit/synergy-bar.test.js: (a) module mirror value assertion,
//     (b) regex-grep audit on CLAUDE.md canonical source.
//   - --a-{element} tokens are the color authority; tier glows use element
//     CSS vars so saturated tier visuals stay inside the sacred palette.
//   - Animations use only transform/opacity/filter on hot paths (60fps).
//   - Never overrides .v-fx-crit-flash / .v-fx-shake / .stagger-slow-mo /
//     .boss-death-pause / .phase-2 / .phase-3 (JS-readable contract).
//   - ELEMENT_ASSETS in src/feel/element-assets.js is read-only — emblem
//     paths reused from TASK-CP-001's existing constant; no duplication.
//
// Graceful degradation:
//   - mount() returns false when rootEl is null/undefined (no-op).
//   - update() / destroy() on unmounted bar are silent no-ops.
//   - Empty activeElements → all 5 emblems render idle (cold-start safe).
//   - Unknown element keys in state silently ignored.
//   - Invalid tiers (not 2/3/5) silently fall back to idle.
//
// Import discipline (plan §8.3):
//   - src/feel/* NEVER imports from src/core/* — that side bootstraps heavy
//     legacy state (HERO_ROSTER, save, battle, stagger-loop side effects)
//     and would blow up in headless test environments. Sacred 2x/3x/5x
//     synergy values are mirrored here as module-local frozen constants
//     for documentation only (the bar drives VISUAL TIER, not mechanical
//     thresholds — those live in src/core/battle.js). The audit confirms
//     CLAUDE.md §2.1 row literals match the module's documented mirrors.

import { STIHIYAS } from '../data/elements.js';
import { ELEMENT_ASSETS } from './element-assets.js';

// ─── module state ───────────────────────────────────────────────────────────
// Single instance per app lifetime. mount() guards double-mount; destroy() clears.
let _bar = null;

const BAR_SLOT_ID = 'bw-zone-synergy';            // auxiliary slot inside .bw-zone-boss
const BAR_CONTAINER_CLASS = 'bw-synergy-bar';
const EMBLEM_CLASS = 'bw-synergy-emblem';

// Tier CSS class suffixes — emblem state escalation.
const TIER_CLASS_IDLE = 'bw-synergy-tier-idle';
const TIER_CLASS_2X   = 'bw-synergy-tier-2';
const TIER_CLASS_3X   = 'bw-synergy-tier-3';
const TIER_CLASS_5X   = 'bw-synergy-tier-5';

// Valid synergy tiers — sacred per CLAUDE.md §2.1 + combat-mechanics.md §6.
// These are the VISUAL TIERS only; the mechanical thresholds (−2 / −4 / −6
// ULT, +20% / +50% dmg, 30% start charge) live in src/core/battle.js and
// are NEVER read or modified here. This module renders the visual
// representation of the tier already computed upstream.
const VALID_TIERS = Object.freeze([2, 3, 5]);

// Sacred element synergy table — module-local mirror for documentation +
// regex-grep audit against CLAUDE.md §2.1. The visual layer never reads
// these as numbers — they're locked here so a parity drift between the
// rendered tier escalation and the sacred mechanical effects surfaces
// loudly in unit tests.
//
// Source of truth: CLAUDE.md §2.1 rows "Element synergy 2x|3x|5x".
// Mirrored verbatim from combat-mechanics.md §6 + §15.3.
const SACRED_SYNERGY = Object.freeze({
  tier_2x: Object.freeze({
    ult_threshold_delta: -2,                          // sacred: −2 ULT threshold
    passive_dmg_bonus_pct: 0,                         // 2x grants no passive dmg
    start_charge_pct: 0,                              // 2x grants no start charge
  }),
  tier_3x: Object.freeze({
    ult_threshold_delta: -4,                          // sacred: −4 ULT threshold
    passive_dmg_bonus_pct: 20,                        // sacred: +20% passive damage
    start_charge_pct: 0,                              // 3x grants no start charge
  }),
  tier_5x: Object.freeze({
    ult_threshold_delta: -6,                          // sacred: −6 ULT threshold
    damage_bonus_pct: 50,                             // sacred: +50% damage
    start_charge_pct: 30,                             // sacred: 30% start charge
  }),
});

// Runtime cross-check vs legacy globals when available. We don't throw here
// (legacy bridge may not be loaded under unit tests) — but if a mismatch
// surfaces in dev, the console will surface it loudly.
try {
  if (typeof window !== 'undefined') {
    // Legacy ELEMENT_SYNERGY_TIERS surfaces from src/core/battle.js bridge
    // when the legacy runtime is loaded. Best-effort parity check.
    if (window.ELEMENT_SYNERGY_TIERS && typeof window.ELEMENT_SYNERGY_TIERS === 'object') {
      const t = window.ELEMENT_SYNERGY_TIERS;
      // Check tier_5x.start_charge_pct since that's the most distinctive sacred value.
      if (t.tier_5x && typeof t.tier_5x.start_charge_pct === 'number'
          && t.tier_5x.start_charge_pct !== SACRED_SYNERGY.tier_5x.start_charge_pct) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(
            `[synergy-bar] tier_5x.start_charge_pct parity drift: ` +
            `module=${SACRED_SYNERGY.tier_5x.start_charge_pct}, window=${t.tier_5x.start_charge_pct}`
          );
        }
      }
    }
  }
} catch (_e) { /* defensive — no-op */ }

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * mountSynergyBar(rootEl, state?)
 *
 * rootEl: the .bw-battle-root container (set up by battle-screen orchestrator).
 *         If null/undefined, returns false (no-op). Idempotent on repeat calls.
 * state:  optional { activeElements?: Array<{element, tier}> } seed.
 *         Missing → all 5 emblems render idle. Real synergy state lands via
 *         updateSynergyBar() once renderSynergyBar() legacy hook pipes through.
 *
 * Returns true on successful mount, false on no-op skip.
 */
export function mountSynergyBar(rootEl, state) {
  if (!rootEl) return false;
  if (_bar) return false;             // already mounted — idempotent

  // Find the boss-scene zone — synergy bar nests inside it as an auxiliary
  // strip (placement decision documented in header). If boss zone isn't
  // present (cold-start before scene mounts), defer slot creation onto the
  // root so the bar still renders somewhere visible.
  const bossZone =
       rootEl.querySelector('.bw-zone-boss')
    || rootEl.querySelector('#bw-zone-boss');
  const host = bossZone || rootEl;

  // Locate or create the synergy slot. We attach to bossZone when present
  // (anchored to the boss frame); otherwise root-level fallback so the bar
  // is never invisible.
  let slot = host.querySelector(`#${BAR_SLOT_ID}`)
          || host.querySelector('.bw-zone-synergy');
  if (!slot) {
    slot = document.createElement('div');
    slot.id = BAR_SLOT_ID;
    slot.className = 'bw-zone-synergy';
    host.appendChild(slot);
  }

  // Build the bar container — flex row of 5 hex emblems.
  const bar = document.createElement('div');
  bar.className = BAR_CONTAINER_CLASS;
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Element synergy bar');

  // Build 5 emblems in STIHIYAS order (sacred element list). Each emblem
  // is a hex-clipped img with element class + tier class. Default tier = idle.
  const emblems = {};
  for (const element of STIHIYAS) {
    const assets = ELEMENT_ASSETS[element];
    if (!assets) continue;            // defensive — should never happen per element-assets.js parity check

    const emblem = document.createElement('div');
    emblem.className = `${EMBLEM_CLASS} ${EMBLEM_CLASS}--${element} ${TIER_CLASS_IDLE}`;
    emblem.setAttribute('data-element', element);
    emblem.setAttribute('aria-hidden', 'true');

    // Inner image — hex-clip + tier glow CSS sits on the parent .bw-synergy-emblem.
    const img = document.createElement('img');
    img.src = assets.emblem;
    img.alt = '';
    img.className = `${EMBLEM_CLASS}-img`;
    // Defensive load failure — emblem container still renders its colored frame.
    img.onerror = () => { img.style.display = 'none'; };

    // Halo layer — separate element for the 5x ceremonial expanding halo
    // (transform/opacity animation only — no layout thrash).
    const halo = document.createElement('span');
    halo.className = `${EMBLEM_CLASS}-halo`;
    halo.setAttribute('aria-hidden', 'true');

    emblem.appendChild(halo);
    emblem.appendChild(img);
    bar.appendChild(emblem);
    emblems[element] = emblem;
  }

  // Clear slot before appending (ensures clean state if a previous destroy
  // was incomplete).
  slot.innerHTML = '';
  slot.appendChild(bar);

  _bar = {
    rootEl,
    host,
    slot,
    bar,
    emblems,                          // { ember, tide, grove, solar, umbra } → element nodes
  };

  // Apply initial state — defaults render all idle.
  if (state) updateSynergyBar(state);
  return true;
}

/**
 * updateSynergyBar(state)
 *
 * state: { activeElements?: Array<{element: string, tier: 2|3|5}> }
 *
 * - Empty / missing activeElements → all 5 emblems render idle.
 * - Per-element tier drives that element's visual state (idle → 2x → 3x → 5x).
 * - Unknown element keys silently ignored.
 * - Invalid tiers (not 2/3/5) fall back to idle for that element.
 *
 * Never throws on bad input.
 */
export function updateSynergyBar(state) {
  if (!_bar) return;
  // Defensive — accept undefined / null / non-object as "clear everything".
  if (state !== undefined && state !== null && typeof state !== 'object') return;

  const renderModel = computeBarState(state);

  // Apply per-element tier class — replace prior tier class atomically per emblem.
  for (const element of STIHIYAS) {
    const emblem = _bar.emblems[element];
    if (!emblem) continue;

    const tier = renderModel[element];      // 0 (idle) | 2 | 3 | 5
    const nextClass = resolveTierClassName(tier);

    // Remove any prior tier class and add the resolved one (idempotent
    // — DOMTokenList.add no-ops on duplicates).
    emblem.classList.remove(TIER_CLASS_IDLE, TIER_CLASS_2X, TIER_CLASS_3X, TIER_CLASS_5X);
    emblem.classList.add(nextClass);
  }
}

/**
 * destroySynergyBar()
 *
 * Tears down the bar DOM + clears module state. Idempotent — safe to call
 * when no bar mounted. Called by cleanupBattleScreen.
 */
export function destroySynergyBar() {
  if (!_bar) return;
  if (_bar.slot) {
    try {
      _bar.slot.innerHTML = '';
      // Also detach the slot from its host (synergy bar lifecycle is fully
      // owned by this module — leaving an empty .bw-zone-synergy behind
      // would pollute boss-scene teardown).
      if (_bar.slot.parentNode) {
        _bar.slot.parentNode.removeChild(_bar.slot);
      }
    } catch (_e) { /* defensive */ }
  }
  _bar = null;
}

// ─── pure helpers (exported for unit tests) ─────────────────────────────────

/**
 * resolveTierClassName(tier): maps a tier value to its CSS class suffix.
 * Valid tiers per CLAUDE.md §2.1: 2 | 3 | 5. Anything else → idle.
 *
 * Examples:
 *   resolveTierClassName(2) → 'bw-synergy-tier-2'
 *   resolveTierClassName(3) → 'bw-synergy-tier-3'
 *   resolveTierClassName(5) → 'bw-synergy-tier-5'
 *   resolveTierClassName(0) → 'bw-synergy-tier-idle'
 *   resolveTierClassName(4) → 'bw-synergy-tier-idle'   (no such mechanical tier)
 *   resolveTierClassName(null) → 'bw-synergy-tier-idle'
 *   resolveTierClassName('X') → 'bw-synergy-tier-idle'
 */
export function resolveTierClassName(tier) {
  if (tier === 2) return TIER_CLASS_2X;
  if (tier === 3) return TIER_CLASS_3X;
  if (tier === 5) return TIER_CLASS_5X;
  return TIER_CLASS_IDLE;
}

/**
 * computeBarState(state): pure helper that normalizes incoming state into a
 * render-ready model { element: tier } for all 5 stihiyas.
 *
 * Filters out invalid entries (unknown elements, non-2/3/5 tiers, malformed
 * shape). Never throws. Out-of-list tiers downgrade to 0 (idle) for that
 * element — the visual layer never invents a tier the upstream sacred
 * computation didn't grant.
 *
 * Examples:
 *   computeBarState({})
 *     → { ember:0, tide:0, grove:0, solar:0, umbra:0 }
 *   computeBarState({ activeElements: [{element:'ember', tier:3}] })
 *     → { ember:3, tide:0, grove:0, solar:0, umbra:0 }
 *   computeBarState({ activeElements: [{element:'ember', tier:5}, {element:'tide', tier:2}] })
 *     → { ember:5, tide:2, grove:0, solar:0, umbra:0 }
 *   computeBarState({ activeElements: [{element:'made_up', tier:5}] })
 *     → { ember:0, tide:0, grove:0, solar:0, umbra:0 }
 *   computeBarState({ activeElements: [{element:'ember', tier:4}] })
 *     → { ember:0, tide:0, grove:0, solar:0, umbra:0 }   // 4 is not a valid sacred tier
 *   computeBarState(null) → all idle
 *   computeBarState(undefined) → all idle
 */
export function computeBarState(state) {
  const model = {};
  for (const element of STIHIYAS) model[element] = 0;

  if (!state || typeof state !== 'object') return model;
  const list = state.activeElements;
  if (!Array.isArray(list)) return model;

  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const element = entry.element;
    const tier = entry.tier;
    if (typeof element !== 'string') continue;
    if (!Object.prototype.hasOwnProperty.call(model, element)) continue;
    if (!VALID_TIERS.includes(tier)) continue;
    // If multiple entries reference the same element, the highest tier wins
    // — escalation is monotonic in the visual layer.
    if (tier > model[element]) model[element] = tier;
  }

  return model;
}

// ─── test hooks — exported only for unit tests ──────────────────────────────

export const _testables = Object.freeze({
  SACRED_SYNERGY,
  VALID_TIERS,
  TIER_CLASS_IDLE,
  TIER_CLASS_2X,
  TIER_CLASS_3X,
  TIER_CLASS_5X,
  _getCurrentBar: () => _bar,
});
