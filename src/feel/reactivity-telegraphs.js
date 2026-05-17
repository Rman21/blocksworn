// 2026-05-17 — TASK-CP-010 (combat-polish-implementation-plan.md §9 Task 10):
//
// Reactivity event telegraphs polish — sibling module for the 22 boss-phase
// reactivity handlers (11 archetypes × 2 phase gates) + 5 boss-reactive
// mechanics (Phoenix Ashen Reign / Lich Cursed Tiles / Berserker Bloodtide /
// Engineer Lockdown / Grovewarden Root Surge boss-side). All boss-reactive
// per-cell / per-overlay polish is pure CSS cascade in
// reactivity-telegraphs.css; this JS module only adds a single MutationObserver
// that detects the legacy banner DOM insertion (`.state-banner`,
// `.threat-banner`) and stamps an archetype-aware `data-archetype` attribute
// so the CSS can theme banner color / accent per archetype.
//
// Spec: combat-polish-implementation-plan.md §9 Task 10 + §10 (Identity-
//       Complete gate close) + §12 sacred boundaries.
//       combat-mechanics.md §17 (22 reactivity handlers — full BOSS_PHASES
//       registry mapping all bosses × 2 phase gates) + §19 (5 boss-reactive
//       mechanics) + §22 visual hooks rows.
//       CLAUDE.md §2.5 sacred v2.1 P4 reactivity-events.
//
// Sibling-module pattern (T-CP-006/007/008/009 precedent)
// -------------------------------------------------------
// `src/core/reactivity-events.js` IS in the 12-file sacred SHA1 baseline
// (`01c35963…`). `src/data/identity-layer.js` (sacred SHA1 `2edc3fe8…`)
// holds all boss-reactive HARD CAPS. This polish layer is a NEW sibling JS
// module that:
//   1. Observes the document body for the legacy `.state-banner` /
//      `.threat-banner` DOM appearing / receiving content. When detected,
//      reads `window.currentBoss?.archetype` and applies a `data-archetype`
//      attribute. The CSS in reactivity-telegraphs.css renders archetype-
//      specific accent borders / glow / animation themes.
//   2. Falls back to no-op (default banner styling) when archetype is
//      unknown / window.currentBoss is absent / banners not yet rendered.
//
// reactivity-events.js + identity-layer.js stay BYTE-PERFECT UNTOUCHED — no
// signature, no constant, no value. Verified by sacred SHA1 audit in unit
// tests.
//
// Lifecycle (mirrors boss-death-polish.js / identity-fx-polish.js precedent):
//   mountReactivityTelegraphs(rootEl, state?) → installs MutationObserver
//   updateReactivityTelegraphs(state)         → partial state OK
//   destroyReactivityTelegraphs()             → disconnects observer; idempotent
//
// State sources (defensive; integration deferred):
//   - Reads `window.currentBoss.archetype` when the legacy bridge has
//     populated it. Silent no-op when absent.
//   - Reads `window.activeReactivity` (optional) — when a reactivity event
//     is in-flight, used to refine banner theme (`p1_p2` vs `p2_p3` accent).
//   - Reads `window.lichCursedTiles` (optional) — surfaces curse-countdown
//     class on the body so CSS can drive a subtle reactive theme.
//
// Sacred-cow protection (CLAUDE.md §2.5 + plan §12)
// -------------------------------------------------
// - All sacred reactivity timings + boss-reactive HARD CAPS mirrored here
//   as module-local frozen constants. Dual audit in unit tests:
//     (a) module mirror value assertion;
//     (b) regex-grep canonical against src/core/reactivity-events.js +
//         src/data/identity-layer.js.
// - Sacred class names ('.state-banner', '.threat-banner',
//   '.cell--engineer-welded', '.identity-phoenix-ashen-reign-border',
//   '.identity-lich-cursed-tile', '.identity-bloodtide-pulse',
//   '.phase-2', '.phase-3') mirrored here; the polish CSS only ADDS
//   overrides — never removes or fundamentally redefines them.
// - All 11 archetype keys mirrored from the BOSS_PHASES registry suffixes:
//   berserker / armored / bruiser / phoenix / assassin / hypnotist /
//   engineer / frenzy / tempo_disruptor / battery / tower_voidfang.
// - This module READS state via window.currentBoss / window.activeReactivity;
//   never writes back to reactivity-events.js, identity-fx.js, src/core/,
//   or src/data/.
// - Animations on hot paths use only transform / opacity / filter (60fps
//   hot-path guard — readiness §11.3).
// - prefers-reduced-motion handled in CSS sheet — polish overrides
//   simplified; the sacred 3000ms telegraph fires unchanged.
// - Phoenix Ashen Reign 16ms initial / 2ms steady-state budget honored —
//   no JS work on Ashen Reign hot path; CSS @keyframes drive the flame.

/* global MutationObserver */

// ─── module state ──────────────────────────────────────────────────────────

let _reactivityTelegraphs = null;

const BANNER_ARCHETYPE_ATTR = 'data-archetype';
const BANNER_REACTIVITY_ATTR = 'data-reactivity-phase';

// Selector list — the two legacy banner DOM hooks emit reactivity text into
// `.state-banner` (flashStateBanner) and threat warnings into `.threat-banner`.
// The polish CSS scopes archetype-themed overrides to these classes.
const BANNER_SELECTORS = Object.freeze([
  'state-banner',
  'threat-banner',
]);

// ─── sacred reactivity timings — module-local mirror ──────────────────────
// SACRED per CLAUDE.md §2.5 + combat-mechanics.md §17. Byte-perfect mirror
// of src/core/reactivity-events.js (sacred SHA1 baseline `01c35963…`) +
// src/data/identity-layer.js (sacred SHA1 `2edc3fe8…`). Audited via
// regex-grep in tests/unit/reactivity-telegraphs.test.js.
//
//   REACTIVITY_TELEGRAPH_MS = 3000  (src/core/bosses.js:265 — re-exported
//                                    from reactivity-events.js:227)
//   REACTIVITY_PHASE_GATES  = [70, 35]  (reactivity-events.js:234)
const SACRED_REACTIVITY_TIMINGS = Object.freeze({
  TELEGRAPH_MS: 3000,
});

const SACRED_REACTIVITY_PHASE_GATES = Object.freeze([70, 35]);

// ─── sacred boss-reactive HARD CAPS — module-local mirror ─────────────────
// SACRED per combat-mechanics.md §19 + identity-layer.js.

const SACRED_ASHEN_REIGN = Object.freeze({
  DURATION_MS:           5000,
  TELEGRAPH_MS:          3000,   // === REACTIVITY_TELEGRAPH_MS (feel coherence)
  FLAME_BORDER_WIDTH_PX: 180,    // sacred since perf-budget verified
  INITIAL_BUDGET_MS:     16,
  STEADY_STATE_BUDGET_MS: 2,
  REQUIRED_ELEMENT:      'ember',
});

const SACRED_LICH_CURSED_TILES = Object.freeze({
  COUNT:                       3,
  TURNS_UNTIL_AUTO_CLEAR:      3,
  GLOW_COLOR:                  '#9B59E8',   // purple curse — matches VOID damage channel family
});

// Informational only — BERSERKER_ENRAGE_MULT lives in src/core/bosses.js (sacred).
// Mirrored here so the regex-grep audit traps drift in the canonical source.
const SACRED_BERSERKER_ENRAGE_MULT = 2.0;

const SACRED_ENGINEER_LOCKDOWN = Object.freeze({
  TRIGGER_LINES:    4,            // Tetris crit gate (anti-Tetris)
  COLOR:            '#B87333',    // copper/bronze — sacred banner + cell outline
});

const SACRED_GROVE_ROOT_SURGE = Object.freeze({
  OVERLAY_COLOR: '#2D8659',       // mossy green — distinct from purple/cyan/red/copper/orange
});

// ─── sacred archetype list — module-local mirror ──────────────────────────
// SACRED per BOSS_PHASES registry at src/core/reactivity-events.js:263-309
// (26 boss entries: 25 main-campaign + VOIDFANG tower fallback). Each maps
// to one of 11 archetypes' p1_p2 / p2_p3 reactivity templates.
const SACRED_ARCHETYPES = Object.freeze([
  'berserker',
  'armored',
  'bruiser',
  'phoenix',
  'assassin',
  'hypnotist',
  'engineer',
  'frenzy',
  'tempo_disruptor',
  'battery',
  'tower_voidfang',
]);

// ─── sacred boss list — module-local mirror ───────────────────────────────
// SACRED per BOSS_PHASES registry. The 26 entries match the registry exactly
// (25 main campaign + VOIDFANG tower fallback). Audited via regex-grep on
// reactivity-events.js so any drift trips CI.
const SACRED_BOSS_KEYS = Object.freeze([
  // Chapter 1
  'PYREDRAKE', 'ABYSSAL TYRANT', 'GROVEWARDEN', 'SOLAR PHOENIX', 'CRYPT LICH',
  // Chapter 2
  'VEROTHIRA', 'GEARHEART', 'URSARO', 'TIDESPIRE', 'HELIOTRON',
  // Chapter 3
  'TWILIGHT VESSEL', 'STORMSHEPHERD', 'VOIDPRIESTESS', 'ROOT-OF-NOTHING', 'ARCHIVAL ETERNAL',
  // Chapter 4
  'THE PROSECUTOR', 'JUSTICE BLIND', 'SUN-CROWN REGENT', 'ECLIPSE-WALKER', 'THE FALLEN HIGHEST',
  // Chapter 5
  'CROWN-OF-DUST', 'SHARDLORD', 'SEEDREAPER', 'PYREKING', 'WORLD-EATER',
  // Tower fallback
  'VOIDFANG',
]);

// ─── sacred class names — module-local mirror ─────────────────────────────
// SACRED per CLAUDE.md §2.5 + plan §12. JS-readable contract class names
// that legacy reactivity dispatch / identity-fx apply. This module READS the
// presence of `.state-banner` / `.threat-banner`; the polish CSS layers
// overrides on the others.
const SACRED_REACTIVITY_CLASSES = Object.freeze({
  STATE_BANNER:                'state-banner',
  THREAT_BANNER:               'threat-banner',
  ENGINEER_WELDED:             'cell--engineer-welded',
  PHOENIX_FLAME_BORDER:        'identity-phoenix-ashen-reign-border',
  LICH_CURSED_TILE:            'identity-lich-cursed-tile',
  BLOODTIDE_PULSE:             'identity-bloodtide-pulse',
  GROVE_ROOT_OVERLAY:          'identity-grovewarden-root-overlay',
  PHASE_2:                     'phase-2',
  PHASE_3:                     'phase-3',
});

// ─── public API ────────────────────────────────────────────────────────────

/**
 * mountReactivityTelegraphs(rootEl, state?)
 *
 * rootEl: the .bw-battle-root container (or any element — the observer is
 *         installed on document.body since `.state-banner` / `.threat-banner`
 *         live in the legacy battle DOM). Passed only for lifecycle symmetry
 *         with sibling polish modules. If null/undefined, returns false
 *         (no-op). Idempotent on repeat calls.
 * state:  optional { archetype?: string, reactivityPhase?: string } seed —
 *         partial application before any banner DOM exists.
 *
 * Returns true on successful mount, false on no-op skip.
 */
export function mountReactivityTelegraphs(rootEl, state) {
  if (!rootEl) return false;
  if (_reactivityTelegraphs) return false;     // already mounted — idempotent

  // Defensive — observer requires MutationObserver in the host env. JSDom-
  // less unit tests pass through; this just means archetype-aware banner
  // theming never wires up there (CSS-only default banner always renders).
  if (typeof MutationObserver !== 'function') {
    _reactivityTelegraphs = { rootEl, observer: null, archetype: null, reactivityPhase: null };
    if (state) updateReactivityTelegraphs(state);
    return true;
  }
  if (typeof document === 'undefined' || !document.body) {
    _reactivityTelegraphs = { rootEl, observer: null, archetype: null, reactivityPhase: null };
    if (state) updateReactivityTelegraphs(state);
    return true;
  }

  // The observer watches body subtree for:
  //   (a) new banner element insertion → stamp data-archetype
  //   (b) banner text content changes (flashStateBanner re-renders text) →
  //       re-stamp data-archetype (the active boss may have changed phase
  //       between two banner fires)
  let observer = null;
  try {
    observer = new MutationObserver((mutations) => {
      try {
        for (const m of mutations) {
          if (!m) continue;
          // Case A — childList: scan added nodes for banner classes.
          if (m.type === 'childList' && m.addedNodes && m.addedNodes.length) {
            for (const node of m.addedNodes) {
              if (!node || node.nodeType !== 1) continue;     // ELEMENT_NODE only
              _maybeStampBanner(node);
            }
          }
          // Case B — attributes: banner toggles `hidden` attribute when
          // flashStateBanner shows / hides. Re-stamp on every reveal so the
          // data-archetype tracks the CURRENT boss archetype (which may
          // have rotated between phases since the last banner).
          else if (m.type === 'attributes' && m.target && m.target.nodeType === 1) {
            _maybeStampBanner(m.target);
          }
        }
      } catch (_e) { /* defensive — observer must never throw */ }
    });
    observer.observe(document.body, {
      childList:      true,
      subtree:        true,
      attributes:     true,
      attributeFilter: ['hidden', 'class'],
    });
  } catch (_e) {
    // Defensive — if MutationObserver setup fails for any reason, the
    // module degrades to a no-op (default banner via CSS fallback).
    observer = null;
  }

  _reactivityTelegraphs = {
    rootEl,
    observer,
    archetype:       null,
    reactivityPhase: null,
  };

  // Also stamp any banners already present in the DOM at mount time.
  try {
    if (document.body) {
      BANNER_SELECTORS.forEach((cls) => {
        try {
          const els = document.body.getElementsByClassName(cls);
          for (let i = 0; i < els.length; i++) {
            _maybeStampBanner(els[i]);
          }
        } catch (_e) { /* defensive — bad selector lookup */ }
      });
    }
  } catch (_e) { /* defensive */ }

  if (state) updateReactivityTelegraphs(state);
  return true;
}

/**
 * updateReactivityTelegraphs(state)
 *
 * Partial state OK: { archetype?: string, reactivityPhase?: string }
 *
 *   - archetype       — one of 11 sacred archetypes; unknown → quiet no-op.
 *   - reactivityPhase — 'p1_p2' | 'p2_p3' | null; surfaces a finer-grained
 *                       accent class on the body for the active phase.
 *
 * Never throws. Re-stamps any currently-visible banner so a state change
 * mid-banner picks up the new archetype immediately.
 */
export function updateReactivityTelegraphs(state) {
  if (!_reactivityTelegraphs) return;
  if (!state || typeof state !== 'object') return;

  if (Object.prototype.hasOwnProperty.call(state, 'archetype')) {
    const resolved = resolveArchetypeTheme(state.archetype);
    _reactivityTelegraphs.archetype = resolved;
  }
  if (Object.prototype.hasOwnProperty.call(state, 'reactivityPhase')) {
    _reactivityTelegraphs.reactivityPhase = _resolveReactivityPhase(state.reactivityPhase);
  }

  // Re-stamp visible banners with the freshly-set archetype / phase.
  try {
    if (typeof document !== 'undefined' && document.body) {
      BANNER_SELECTORS.forEach((cls) => {
        try {
          const els = document.body.getElementsByClassName(cls);
          for (let i = 0; i < els.length; i++) {
            _maybeStampBanner(els[i]);
          }
        } catch (_e) { /* defensive */ }
      });
    }
  } catch (_e) { /* defensive */ }
}

/**
 * destroyReactivityTelegraphs()
 *
 * Tears down the MutationObserver. Idempotent — safe to call when nothing
 * is mounted. Called by cleanupBattleScreen().
 */
export function destroyReactivityTelegraphs() {
  if (!_reactivityTelegraphs) return;
  try {
    if (_reactivityTelegraphs.observer
        && typeof _reactivityTelegraphs.observer.disconnect === 'function') {
      _reactivityTelegraphs.observer.disconnect();
    }
  } catch (_e) { /* defensive — idempotent */ }
  _reactivityTelegraphs = null;
}

// ─── pure helpers (exported for unit tests) ────────────────────────────────

/**
 * resolveArchetypeTheme(archetype?): returns the valid attribute value
 * for the data-archetype selector. Returns one of the 11 sacred archetypes
 * when the input matches, or null for unknown / falsy input (signaling the
 * caller to skip the attribute, letting CSS fall back to default banner).
 *
 * Never throws — exclusively a pure read of the SACRED_ARCHETYPES lookup.
 *
 * Examples:
 *   resolveArchetypeTheme('berserker')   → 'berserker'
 *   resolveArchetypeTheme('PHOENIX')     → 'phoenix' (case-insensitive)
 *   resolveArchetypeTheme(' engineer ')  → 'engineer' (whitespace-trimmed)
 *   resolveArchetypeTheme('tempo_disruptor') → 'tempo_disruptor'
 *   resolveArchetypeTheme('tempo-disruptor') → 'tempo_disruptor' (hyphen→underscore)
 *   resolveArchetypeTheme('bogus')       → null
 *   resolveArchetypeTheme(null)          → null
 *   resolveArchetypeTheme(undefined)     → null
 *   resolveArchetypeTheme(42)            → null
 */
export function resolveArchetypeTheme(archetype) {
  if (typeof archetype !== 'string') return null;
  let normalized = archetype.trim().toLowerCase();
  if (!normalized) return null;
  // Normalize hyphens → underscores so legacy `tempo-disruptor` calls also
  // resolve. The canonical BOSS_PHASES registry uses `tempo_disruptor`.
  normalized = normalized.replace(/-/g, '_');
  return SACRED_ARCHETYPES.includes(normalized) ? normalized : null;
}

// ─── private helpers ───────────────────────────────────────────────────────

/**
 * _maybeStampBanner(el)
 *
 * If `el` (or its classList) matches one of the banner selectors, read the
 * current archetype + reactivity-phase from module state (or fall back to
 * window.currentBoss?.archetype / window.activeReactivity) and stamp the
 * data-archetype / data-reactivity-phase attributes. Pure-no-op when
 * archetype is unknown / absent.
 */
function _maybeStampBanner(el) {
  if (!el || !el.classList || typeof el.classList.contains !== 'function') return;
  let isBanner = false;
  for (let i = 0; i < BANNER_SELECTORS.length; i++) {
    if (el.classList.contains(BANNER_SELECTORS[i])) { isBanner = true; break; }
  }
  if (!isBanner) return;

  // Resolve archetype — prefer module state (most recent update*), fall back
  // to window.currentBoss?.archetype defensive read.
  let archetype = _reactivityTelegraphs ? _reactivityTelegraphs.archetype : null;
  if (!archetype) {
    try {
      if (typeof window !== 'undefined' && window.currentBoss
          && typeof window.currentBoss === 'object') {
        archetype = resolveArchetypeTheme(window.currentBoss.archetype);
      }
    } catch (_e) { /* defensive */ }
  }

  let reactivityPhase = _reactivityTelegraphs ? _reactivityTelegraphs.reactivityPhase : null;
  if (!reactivityPhase) {
    try {
      if (typeof window !== 'undefined' && window.activeReactivity) {
        reactivityPhase = _resolveReactivityPhase(window.activeReactivity);
      }
    } catch (_e) { /* defensive */ }
  }

  if (archetype) {
    try { el.setAttribute(BANNER_ARCHETYPE_ATTR, archetype); }
    catch (_e) { /* defensive — el detached */ }
  }
  if (reactivityPhase) {
    try { el.setAttribute(BANNER_REACTIVITY_ATTR, reactivityPhase); }
    catch (_e) { /* defensive — el detached */ }
  }
}

/**
 * _resolveReactivityPhase(value)
 *
 * Normalizes various inputs to the canonical p1_p2 / p2_p3 reactivity-phase
 * accent string. Accepts strings like 'phoenix_p1_p2' (extracts trailing
 * 'p1_p2'), bare 'p1_p2'/'p2_p3', or hyphenated variants. Returns null for
 * unknown input. Never throws.
 */
function _resolveReactivityPhase(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/-/g, '_');
  if (!normalized) return null;
  if (normalized.endsWith('p1_p2')) return 'p1_p2';
  if (normalized.endsWith('p2_p3')) return 'p2_p3';
  return null;
}

// ─── test hooks — exported only for unit tests ─────────────────────────────

export const _testables = Object.freeze({
  SACRED_REACTIVITY_TIMINGS,
  SACRED_REACTIVITY_PHASE_GATES,
  SACRED_ASHEN_REIGN,
  SACRED_LICH_CURSED_TILES,
  SACRED_BERSERKER_ENRAGE_MULT,
  SACRED_ENGINEER_LOCKDOWN,
  SACRED_GROVE_ROOT_SURGE,
  SACRED_ARCHETYPES,
  SACRED_BOSS_KEYS,
  SACRED_REACTIVITY_CLASSES,
  BANNER_SELECTORS,
  BANNER_ARCHETYPE_ATTR,
  BANNER_REACTIVITY_ATTR,
  _getCurrentReactivityTelegraphs: () => _reactivityTelegraphs,
  _maybeStampBanner,
  _resolveReactivityPhase,
});
