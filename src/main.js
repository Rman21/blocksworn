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
import { migrateBareStringKeys } from './services/migrate.js';
import { log } from './services/logger.js';

// Core state.
import { initProgression } from './core/progression.js';
import { initFtueState, isFtueActive, routeByFtue } from './core/ftue-state.js';

// UI router.
import { setupRouting, showScreen } from './ui/router.js';

async function main() {
  // 1. Sentry first — every subsequent error goes to Sentry.
  try { initSentry(); } catch (err) { log.error('[boot] initSentry failed:', err); }

  try {
    // 2. Migration shim BEFORE any storage read. Idempotent via sentinel.
    const migrationResult = migrateBareStringKeys();
    log.info('[boot] storage migration:', migrationResult);

    // 3. Firebase (sync — binds from legacy window.* dispatch when present).
    initFirebase();

    // 4. RevenueCat (async). Defaults to placeholder API key; no-op if SDK absent.
    try { await initRevenueCat(); } catch (err) { log.warn('[boot] initRevenueCat:', err); }

    // 5. Progression — first-clears + boss-stars + dungeon + hero-levels +
    //    unlocked-heroes + top-level progress (loadProgress runs inside).
    try { initProgression(); } catch (err) { log.warn('[boot] initProgression:', err); }

    // 6. FTUE beat cursor.
    try { initFtueState(); } catch (err) { log.warn('[boot] initFtueState:', err); }

    // 7. Router (no-op in the T1.12 shell — listener wiring lands in T1.13+).
    try { setupRouting(); } catch (err) { log.warn('[boot] setupRouting:', err); }

    // 8. FTUE-aware initial screen. Per-render errors are contained so the
    //    bootstrap chain completes cleanly even when legacy /* global */
    //    render helpers (vRenderTopbar, etc.) are undefined in the new shell.
    try {
      if (isFtueActive()) {
        routeByFtue();
      } else {
        showScreen('menu');
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
