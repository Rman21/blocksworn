// 2026-05-11 — TASK-014 (T1.12): THE switchover. src/main.js becomes the
// primary render path at `/`. Legacy 21MB single HTML remains servable at
// /docs/_legacy/_archive_v1/blocksworn_index_fixed.html via the
// serveLegacyHtmlRaw plugin (T1.03) for smoke + visual baselines and as
// a manual reference URL during T1.13 parity verification.
//
// Bootstrap order (per docs/plan/00_EXECUTION_PLAN.md §13 T1.12):
//
//   1. initSentry()            — first, so every subsequent error routes to Sentry.
//   2. migrateBareStringKeys() — one-shot localStorage shim (T1.10.9). MUST run
//                                before any storage.getItem call, else the 9
//                                legacy bare-string keys deserialize incorrectly
//                                and existing players silently reset to defaults.
//   3. initFirebase()          — sync; binds window.* references the legacy CDN
//                                init dispatches. Safe no-op when CDN absent.
//   4. initRevenueCat()        — async; waits for Firebase UID per legacy
//                                ordering. Safe no-op when SDK absent.
//   5. initProgression()       — loads first-clears + boss-stars + dungeon
//                                progress + hero levels + unlocked heroes +
//                                top-level progress (calls loadProgress inside).
//   6. initFtueState()         — loads FTUE beat cursor from storage.
//   7. setupRouting()          — wires nav listeners (no-op in T1.12 shell).
//   8. Initial screen:
//        - isFtueActive()  → routeByFtue() (FTUE-aware entry).
//        - else            → showScreen('menu').
//
// The bootstrap chain itself must NOT throw. Once the chain completes the
// scaffold is mounted and any per-render error (e.g. legacy /* global */
// vRender* helpers undefined in the new shell) is contained inside try/catch
// in the render functions themselves. T1.13 manual playthrough validates the
// actual UI parity.

import './styles/index.css';

// Services (init order matters: Sentry first → migration → Firebase → RC).
import { initSentry, captureException } from './services/sentry.js';
import { initFirebase } from './services/firebase.js';
import { initRevenueCat } from './services/revenuecat.js';
import { migrateBareStringKeys, migrateRemoveArtifacts, migrateRemoveCosmicMemorial } from './services/migrate.js';
import { log } from './services/logger.js';
import { setSegmentState, getPlayerSegment, setUserProperty } from './services/analytics.js';

// Core state.
import { initProgression } from './core/progression.js';
import { initFtueState, isFtueActive, routeByFtue } from './core/ftue-state.js';

// UI router.
import { setupRouting, showScreen } from './ui/router.js';

// T2.12 (2026-05-12): Codex state hydration. Pure additive — hydrates on boot
// so the in-memory cache is warm before the first dispatch fires. The Codex
// writes ONLY to localStorage[blocksworn_codex_state] per spec §4.10 (READ-
// ONLY of game state, never mutates sacred tables).
import { getCodexState } from './ui/codex.js';

// 2026-05-14 — Phase 4.1: window-bridge install centralized in
// ./legacy-bridges.js so this modular shell entry AND the sidecar entry
// (src/sidecar.js, injected into the legacy single-HTML at build time)
// share a single 47-surface installer. See ADR-004 hybrid coexistence.
// Imports the 7 module families (identity-fx, reactivity-events, codex,
// replay-backend, clan-backend, party-tower-backend, phase4-bridge) and
// owns the `window.__*` assignments + `installPhase4Bridge()` call.
import { installLegacyBridges } from './legacy-bridges.js';

// T2.B / T3.02 / T3.07 / T3.10 / T4.13: install all 47 window-bridges that
// the legacy single-HTML runtime calls via `window.__*`. Centralized in
// ./legacy-bridges.js so the modular shell AND the sidecar entry share an
// identical bridge surface. Idempotent — safe at module top-level.
installLegacyBridges();

// T1.20 — Read lifetime USD spend from the canonical legacy key
// (`blocksworn_p5_spending`, written by legacy `trackSpending(usdAmount)`
// at docs/_legacy/_archive_v1/blocksworn_index_fixed.html:29942). Returns
// 0 when missing or unparseable so the segment computation defaults to F2P.
function _readTotalSpentUSD() {
  try {
    if (typeof localStorage === 'undefined') return 0;
    const raw = localStorage.getItem('blocksworn_p5_spending');
    if (!raw) return 0;
    const n = parseFloat(raw);
    return (typeof n === 'number' && isFinite(n) && n > 0) ? n : 0;
  } catch (_e) { return 0; }
}

// T1.20 — Refresh the cached segment state used by logEvent enrichment +
// push the matching user property to Firebase Analytics. Idempotent; cheap
// enough to call on boot and after each successful IAP. Exposed on window
// so legacy IAP completion handlers can refresh post-purchase without
// re-routing through ES modules.
function _refreshPlayerSegment() {
  const state = { iap: { totalSpentUSD: _readTotalSpentUSD() } };
  try { setSegmentState(state); } catch (_e) { /* swallow */ }
  try { setUserProperty('segment', getPlayerSegment(state)); } catch (_e) { /* swallow */ }
}
if (typeof window !== 'undefined') {
  // Expose for legacy IAP completion handlers (post-purchase refresh).
  window.refreshPlayerSegment = _refreshPlayerSegment;
  // Cross-tab + same-tab fallback: legacy `trackSpending()` writes
  // `blocksworn_p5_spending` synchronously. Listening on the storage event
  // captures cross-tab purchases; same-tab purchases should call
  // window.refreshPlayerSegment directly (legacy may dispatch a custom event
  // in a future task). This listener is cheap and idempotent.
  try {
    window.addEventListener('storage', function (e) {
      if (e && e.key === 'blocksworn_p5_spending') _refreshPlayerSegment();
    });
  } catch (_e) { /* swallow */ }
}

// T3.08 (2026-05-13): Read `?replay=<id>` query parameter for the deeplink
// handler. Pure read of window.location.search — never mutates anything.
// Returns empty string when no query, no match, or in non-browser context.
function _readReplayDeeplinkId() {
  try {
    if (typeof window === 'undefined' || !window.location || !window.location.search) return '';
    const m = /[?&]replay=([^&]+)/.exec(window.location.search);
    if (!m || !m[1]) return '';
    return decodeURIComponent(m[1]);
  } catch (_e) {
    return '';
  }
}

// T3.06 (2026-05-13): Read `?invite=<token>` query parameter for the friend
// invite deeplink handler. Pure read — never mutates. Returns empty when
// no query, no match, or in non-browser context. Additive to T3.08
// replay deeplink (does NOT modify _readReplayDeeplinkId).
function _readInviteDeeplinkToken() {
  try {
    if (typeof window === 'undefined' || !window.location || !window.location.search) return '';
    const m = /[?&]invite=([^&]+)/.exec(window.location.search);
    if (!m || !m[1]) return '';
    return decodeURIComponent(m[1]);
  } catch (_e) {
    return '';
  }
}

async function main() {
  // 1. Sentry first — every subsequent error goes to Sentry.
  try { initSentry(); } catch (err) { log.error('[boot] initSentry failed:', err); }

  try {
    // 2. Migration shim BEFORE any storage read. Idempotent via sentinel.
    const migrationResult = migrateBareStringKeys();
    log.info('[boot] storage migration:', migrationResult);

    // 2b. T1.14 — DELETE artifact subsystem migration. Idempotent via its own
    //     sentinel (`blocksworn_artifacts_removed_v1`). Removes well-known
    //     artifact localStorage keys + strips `artifactsOwned` / `equippedArtifacts`
    //     / `artDropPityCounter` from the aggregated progress save. Must run
    //     BEFORE initProgression() reads `blocksworn_progress`.
    try {
      const artifactsResult = migrateRemoveArtifacts();
      log.info('[boot] artifact removal migration:', artifactsResult);
    } catch (err) {
      log.warn('[boot] migrateRemoveArtifacts:', err);
    }

    // 2c. T1.15 — DELETE Cosmic Memorial migration. Idempotent via its own
    //     sentinel (`blocksworn_cosmic_memorial_removed_v1`). Removes the
    //     hypothetical legacy cosmic-memorial localStorage keys + strips
    //     `cosmicMemorial` / `cosmicMemorialEntries` / `memorialDefeats`
    //     from the aggregated progress save. Must run BEFORE initProgression()
    //     reads `blocksworn_progress` (mirrors T1.14 ordering).
    try {
      const memorialResult = migrateRemoveCosmicMemorial();
      log.info('[boot] cosmic memorial removal migration:', memorialResult);
    } catch (err) {
      log.warn('[boot] migrateRemoveCosmicMemorial:', err);
    }

    // 3. Firebase (sync — binds from legacy window.* dispatch when present).
    initFirebase();

    // 4. RevenueCat (async). Defaults to placeholder API key; no-op if SDK absent.
    try { await initRevenueCat(); } catch (err) { log.warn('[boot] initRevenueCat:', err); }

    // 5. Progression — first-clears + boss-stars + dungeon + hero-levels +
    //    unlocked-heroes + top-level progress (loadProgress runs inside).
    try { initProgression(); } catch (err) { log.warn('[boot] initProgression:', err); }

    // 5b. T1.20 — Player segment from lifetime USD spend (sacred thresholds
    //     per CLAUDE.md §9). Caches the state for logEvent auto-enrichment +
    //     pushes 'segment' user property to Firebase Analytics. Re-runs from
    //     legacy IAP completion handlers via window.refreshPlayerSegment.
    try { _refreshPlayerSegment(); } catch (err) { log.warn('[boot] refreshPlayerSegment:', err); }

    // 6. FTUE beat cursor.
    try { initFtueState(); } catch (err) { log.warn('[boot] initFtueState:', err); }

    // 6b. T2.12 — Codex state hydration. Loads `blocksworn_codex_state` into
    // the in-memory cache so the first render is immediate. Defensive — Codex
    // never mutates game state; pure load from its own localStorage key.
    try { getCodexState(); } catch (err) { log.warn('[boot] getCodexState:', err); }

    // 7. Router (no-op in the T1.12 shell — listener wiring lands in T1.13+).
    try { setupRouting(); } catch (err) { log.warn('[boot] setupRouting:', err); }

    // 8. FTUE-aware initial screen. Per-render errors are contained so the
    //    bootstrap chain completes cleanly even when legacy /* global */
    //    render helpers (vRenderTopbar, etc.) are undefined in the new shell.
    //
    // T3.08 (2026-05-13): `?replay=<id>` deeplink handler. When present, the
    // initial screen becomes the Replay viewer with the captured replay
    // pre-loaded. Mirrors the server-side `/r/<id>` URL rewrite (production
    // deploy rewrites `/r/<id>` → `/?replay=<id>`). FTUE-blocking takes
    // precedence so a fresh install still goes through the tutorial.
    try {
      const replayDeeplinkId = _readReplayDeeplinkId();
      const inviteDeeplinkToken = _readInviteDeeplinkToken();
      if (replayDeeplinkId && !isFtueActive()) {
        try {
          window.__replayViewerCurrentId = replayDeeplinkId;
          // Default return target — back-button returns to menu (Codex flow
          // wires its own __replayViewerReturnTo in T3.09).
          window.__replayViewerReturnTo = 'menu';
        } catch (_e) { /* swallow */ }
        showScreen('replay-viewer');
      } else if (isFtueActive()) {
        routeByFtue();
      } else {
        showScreen('menu');
      }
      // T3.06 (2026-05-13): `?invite=<token>` friend-invite deeplink handler.
      // Runs AFTER the initial screen is set (so the toast lands on top of
      // the menu, not a transient first-render frame). FTUE-blocking takes
      // precedence — fresh installs still go through tutorial; the invite
      // is consumed silently when FTUE is active so the token isn't lost.
      if (inviteDeeplinkToken && !isFtueActive()) {
        import('./services/friend-graph-backend.js').then(mod => {
          try {
            mod.parseAndConsumeInvite(inviteDeeplinkToken).then(result => {
              try {
                if (result && result.ok) {
                  import('./ui/friend-leaderboard.js').then(ui => {
                    try { ui.showFriendToast('Friend added!'); } catch (_e) { /* swallow */ }
                  }).catch(() => { /* swallow — dynamic import failure non-fatal */ });
                }
              } catch (_e) { /* swallow */ }
            }).catch(() => { /* swallow — invite consumption failure non-fatal */ });
          } catch (_e) { /* swallow */ }
        }).catch(() => { /* swallow — dynamic import failure non-fatal */ });
      }
    } catch (err) {
      log.warn('[boot] initial screen render:', err);
    }

    log.info('[boot] main complete');
  } catch (err) {
    log.error('[boot] failed:', err);
    captureException(err);
  }
}

main();
