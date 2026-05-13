/* eslint-disable no-empty */
// 2026-05-13 — TASK-045 (Phase 2.5 FTUE polish wire): First-time tutorial
// overlay component. Powers F-01 (Sun Cascade) / F-02 (Cursed Tiles) /
// F-04 (Bloodtide Pulse) per docs/design/phase2-5-ftue-polish.md §5.1.
//
// Architecture (Option C per Designer §2.2):
//   - Rich parchment-card overlay (2-line Chronicler-voice tutorial copy).
//   - Single shared DOM node, pre-allocated at module load — one tutorial
//     at a time (subsequent calls while one is active are silent no-ops).
//   - localStorage gate ensures EXACTLY ONE fire per player per overlay.
//   - Click-to-dismiss / Escape-to-dismiss / auto-dismiss timer.
//   - prefers-reduced-motion fallback (instant fade vs slide).
//
// Sacred safety (CLAUDE.md §2 + Designer §1.3 + §7):
//   - NARRATOR_LINES table UNTOUCHED — tutorial copy lives in isolated
//     placeholder constants in src/data/identity-layer.js.
//   - V_HAPTICS UNTOUCHED — no new haptic keys.
//   - All 10 identity fx mechanical contracts UNTOUCHED — tutorial fires
//     AT END of fx routine wrapped in try/catch.
//   - Codex localStorage schema UNTOUCHED — tutorial keys are SEPARATE
//     localStorage entries (blocksworn_sun_cascade_seen, _cursed_tiles_seen,
//     _bloodtide_seen) — never write to blocksworn_codex_state.
//   - Performance: ≤2ms first-fire DOM activation; ≤0.5ms steady-state
//     gate check (spec §2.3 + acceptance criteria).
//
// Public surface (consumed by src/feel/identity-fx.js + window-bridge):
//   - showFirstTimeTutorialOverlay({ emblem, title, line1, line2, accentColor,
//                                    dismissMs, persistenceKey }) → boolean
//   - hideFirstTimeTutorialOverlay() — programmatic dismiss (tests + edges)
//   - __identityFxTutorialTestables — test-only escape hatch (reset state)

import {
  IDENTITY_FX_TUTORIAL_AUTO_DISMISS_MS,
} from '../data/identity-layer.js';
import { log } from '../services/logger.js';

// ─── Module state ──────────────────────────────────────────────────────
// Single pre-allocated overlay DOM node + supporting state. One-at-a-time
// contract — if a second tutorial fires while one is active, the second
// is silently dropped (the boss-line layer from PR #160 still fires per
// Designer §4.4 choreography, so the lesson is not lost).
let _overlayEl = null;          // the shared DOM node (created lazily on first fire)
let _overlayActive = false;     // true while an overlay is visible
let _dismissTimer = null;       // active auto-dismiss setTimeout handle
let _onClickHandler = null;     // bound click listener (for clean removal)
let _onKeyHandler = null;       // bound Escape listener (for clean removal)

// CSS class names (matches src/styles/components/identity-fx-tutorial.css).
const _CLS_OVERLAY  = 'identity-fx-tutorial';
const _CLS_VISIBLE  = 'identity-fx-tutorial--visible';
const _CLS_EXITING  = 'identity-fx-tutorial--exiting';
const _CLS_EMBLEM   = 'identity-fx-tutorial__emblem';
const _CLS_BODY     = 'identity-fx-tutorial__body';
const _CLS_TITLE    = 'identity-fx-tutorial__title';
const _CLS_LINE_1   = 'identity-fx-tutorial__line identity-fx-tutorial__line-1';
const _CLS_LINE_2   = 'identity-fx-tutorial__line identity-fx-tutorial__line-2';

// ─── DOM construction (lazy — only on first fire in DOM env) ───────────
function _ensureOverlayElement() {
  if (_overlayEl) return _overlayEl;
  if (typeof document === 'undefined') return null;
  try {
    const root = document.createElement('div');
    root.className = _CLS_OVERLAY;
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    root.style.display = 'none';

    const emblem = document.createElement('img');
    emblem.className = _CLS_EMBLEM;
    emblem.setAttribute('alt', '');
    emblem.setAttribute('loading', 'lazy');
    emblem.setAttribute('decoding', 'async');
    emblem.onerror = function () { try { this.style.visibility = 'hidden'; } catch (_e) {} };

    const body = document.createElement('div');
    body.className = _CLS_BODY;

    const titleEl = document.createElement('div');
    titleEl.className = _CLS_TITLE;

    const line1 = document.createElement('p');
    line1.className = _CLS_LINE_1;

    const line2 = document.createElement('p');
    line2.className = _CLS_LINE_2;

    body.appendChild(titleEl);
    body.appendChild(line1);
    body.appendChild(line2);
    root.appendChild(emblem);
    root.appendChild(body);

    // Mount under body so it's above battle layer but below modals (CSS
    // z-index controls precise stacking; see identity-fx-tutorial.css).
    if (document.body) document.body.appendChild(root);

    _overlayEl = root;
  } catch (e) {
    try { log.warn('identity-fx-tutorial: overlay element create failed:', e); } catch (_e) {}
    _overlayEl = null;
  }
  return _overlayEl;
}

// ─── Resolution + dismissal ────────────────────────────────────────────
function _clearTimers() {
  if (_dismissTimer) {
    try { clearTimeout(_dismissTimer); } catch (_e) {}
    _dismissTimer = null;
  }
}

function _detachListeners() {
  if (!_overlayEl) return;
  try {
    if (_onClickHandler) _overlayEl.removeEventListener('click', _onClickHandler);
    if (_onKeyHandler && typeof document !== 'undefined') {
      document.removeEventListener('keydown', _onKeyHandler);
    }
  } catch (_e) {}
  _onClickHandler = null;
  _onKeyHandler = null;
}

export function hideFirstTimeTutorialOverlay() {
  if (!_overlayActive) return;
  _overlayActive = false;
  _clearTimers();
  _detachListeners();
  if (!_overlayEl) return;
  try {
    _overlayEl.classList.remove(_CLS_VISIBLE);
    _overlayEl.classList.add(_CLS_EXITING);
    // After CSS fade-out completes, hide entirely. Defensive — even if the
    // CSS animation duration is misaligned, the timeout fallback hides.
    setTimeout(() => {
      try {
        if (_overlayEl) {
          _overlayEl.classList.remove(_CLS_EXITING);
          _overlayEl.style.display = 'none';
        }
      } catch (_e) {}
    }, 220);
  } catch (_e) { /* swallow — hide must never throw */ }
}

// ─── Public entry: show overlay (gated by localStorage) ────────────────
//
// Returns:
//   true  — overlay was shown (first-fire path).
//   false — overlay was NOT shown (already-seen / unavailable / queued).
//
// All paths defensive: no exception ever escapes (caller wraps in
// try/catch as additional safety per CLAUDE.md §7.7).
export function showFirstTimeTutorialOverlay(content) {
  // Validate input shape defensively.
  if (!content || typeof content !== 'object') return false;
  const persistenceKey = (typeof content.persistenceKey === 'string') ? content.persistenceKey : '';
  if (!persistenceKey) return false;

  // localStorage gate — defensive try/catch around BOTH read and write.
  // If localStorage is unavailable (Node test env, private mode, quota),
  // silently no-op + return false (no crash, fx pipeline unaffected).
  let alreadySeen = false;
  try {
    if (typeof localStorage === 'undefined') return false;
    alreadySeen = (localStorage.getItem(persistenceKey) !== null);
  } catch (_e) {
    return false;
  }
  if (alreadySeen) return false;

  // DOM availability gate — Node test envs without DOM no-op gracefully.
  if (typeof document === 'undefined') return false;

  // One-at-a-time contract — if an overlay is already visible (e.g., F-01
  // and F-02 fire in the same frame), the second is silently dropped. The
  // gate localStorage key is NOT written (so the dropped tutorial fires
  // next time the mechanic activates).
  if (_overlayActive) return false;

  // ── First-fire path. ──
  // Persist the seen flag FIRST so rapid-fire double-clears (10 consecutive
  // promoting clears within a single frame) collapse to exactly 1 overlay
  // fire (Scenario D per Designer §3.1.10).
  try {
    localStorage.setItem(persistenceKey, '1');
  } catch (_e) {
    // localStorage write failed (quota). Overlay still shows once this
    // session; next session may re-show. Acceptable defensive contract.
  }

  const el = _ensureOverlayElement();
  if (!el) return false;

  try {
    // Resolve content with defensive defaults.
    const emblemKey   = (typeof content.emblem === 'string')      ? content.emblem      : '';
    const titleText   = (typeof content.title === 'string')       ? content.title       : '';
    const line1Text   = (typeof content.line1 === 'string')       ? content.line1       : '';
    const line2Text   = (typeof content.line2 === 'string')       ? content.line2       : '';
    const accentColor = (typeof content.accentColor === 'string') ? content.accentColor : '#FFD700';
    const dismissMs   = (typeof content.dismissMs === 'number' && content.dismissMs > 0)
                          ? content.dismissMs
                          : IDENTITY_FX_TUTORIAL_AUTO_DISMISS_MS;

    // Populate content. Use textContent (XSS-safe) — no innerHTML on
    // tutorial body (matches Codex emblem _thumbHTML safety pattern).
    const emblemEl = el.querySelector('.' + _CLS_EMBLEM.split(' ').join('.'));
    if (emblemEl && emblemKey) {
      // Re-use the same /images/emblems/<key>.png convention as Codex
      // _thumbHTML. Browser silently fails → onerror hides visibility.
      emblemEl.setAttribute('src', '/images/emblems/' + emblemKey + '.png');
      emblemEl.style.visibility = '';
    } else if (emblemEl) {
      emblemEl.style.visibility = 'hidden';
    }

    const titleEl = el.querySelector('.' + _CLS_TITLE);
    if (titleEl) titleEl.textContent = titleText;

    const line1El = el.querySelector('.identity-fx-tutorial__line-1');
    if (line1El) line1El.textContent = line1Text;

    const line2El = el.querySelector('.identity-fx-tutorial__line-2');
    if (line2El) line2El.textContent = line2Text;

    // Accent color via inline CSS custom property — CSS reads `--accent`
    // for border + title color (see identity-fx-tutorial.css).
    try { el.style.setProperty('--identity-fx-tutorial-accent', accentColor); } catch (_e) {}

    // Show. Two-phase reveal: display:block (allows layout) → next frame
    // adds .visible (triggers CSS slide-in). Defensive offsetWidth read
    // forces reflow so the class change always animates clean.
    el.style.display = 'block';
    el.classList.remove(_CLS_EXITING);
    void el.offsetWidth;
    el.classList.add(_CLS_VISIBLE);

    _overlayActive = true;

    // Wire dismissal — click + Escape + auto-dismiss timer.
    _onClickHandler = function () { hideFirstTimeTutorialOverlay(); };
    el.addEventListener('click', _onClickHandler);

    _onKeyHandler = function (e) {
      if (e && (e.key === 'Escape' || e.keyCode === 27)) {
        hideFirstTimeTutorialOverlay();
      }
    };
    try { document.addEventListener('keydown', _onKeyHandler); } catch (_e) {}

    _clearTimers();
    _dismissTimer = setTimeout(hideFirstTimeTutorialOverlay, dismissMs);

    return true;
  } catch (e) {
    // Any unexpected DOM error → recover gracefully, hide if visible.
    try { log.warn('identity-fx-tutorial: show failed:', e); } catch (_e) {}
    _overlayActive = false;
    _clearTimers();
    _detachListeners();
    try { if (el) el.style.display = 'none'; } catch (_e) {}
    return false;
  }
}

// ─── Test-only escape hatch ────────────────────────────────────────────
// Mirrors the `__codexTestables` / `__identityFxTestables` pattern. Lets
// unit tests reset module state + check internals without touching prod
// code paths.
export const __identityFxTutorialTestables = Object.freeze({
  reset() {
    _clearTimers();
    _detachListeners();
    _overlayActive = false;
    if (_overlayEl) {
      try {
        _overlayEl.classList.remove(_CLS_VISIBLE);
        _overlayEl.classList.remove(_CLS_EXITING);
        _overlayEl.style.display = 'none';
      } catch (_e) {}
    }
  },
  resetForTests() {
    // Hard reset — wipes DOM node reference too (next show recreates).
    this.reset();
    if (_overlayEl && _overlayEl.parentNode) {
      try { _overlayEl.parentNode.removeChild(_overlayEl); } catch (_e) {}
    }
    _overlayEl = null;
  },
  isActive() { return _overlayActive; },
  getOverlayEl() { return _overlayEl; },
});
