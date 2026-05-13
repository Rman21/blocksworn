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
import {
  getCodexState,
  recordRaceTrigger,
  recordBossEncounter,
  recordBossDefeat,
  recordMomentTrigger,
} from './ui/codex.js';

// 2026-05-13 — TASK-045 (Phase 2.5 FTUE polish): First-time tutorial overlay
// component. Powers F-01 (Sun Cascade) / F-02 (Cursed Tiles) / F-04
// (Bloodtide Pulse) per docs/design/phase2-5-ftue-polish.md. Exposed on
// window so feel/identity-fx.js can call it without a direct module
// dependency (matches the legacy bridge pattern below — UI surface
// indirected via window-bridge so fx module stays UI-decoupled).
import {
  showFirstTimeTutorialOverlay,
  hideFirstTimeTutorialOverlay,
} from './ui/identity-fx-tutorial.js';

// T2.B (2026-05-12): Legacy Bridge — Identity Layer integration moment.
// Expose all 10 mechanics' dispatcher + predicates + reset hooks onto window
// under the `__` prefix (matching the existing `__dispatchIdentityFx` /
// `__pushRecentClear` naming convention seeded by T2.07-T2.11 reports). The
// legacy single-HTML primary runtime (per ADR-004 hybrid coexistence) reads
// these via `window.__*` and calls them defensively (try/catch) from
// `clearLines`, `canPlace`, `maybePhoenixRevive`, `bossAttack`, and
// `startBossBattle`. Module-side fx + identity-bridge contract was verified
// by T2.02-T2.12 (581 unit + 140 smoke green). Now LIVE in legacy gameplay.
//
// Sacred-cow safety: every bridge function below is a PURE EXPORT from
// `src/feel/identity-fx.js` or `src/core/reactivity-events.js` — exposing
// them on window is additive (no sacred numeric / formula / handler change).
// Legacy bridge call sites are wrapped in try/catch so the sacred line-clear
// pipeline NEVER regresses if an identity bridge throws.
import {
  dispatchIdentityFx,
  canPlacePieceDuringAshenReign,
  isAshenReignActive,
  isCellCursed,
  isCellLockedByLockdownProtocol,
  isCellRooted,
  onRootCellCleared,
  incrementBloodtideClearCount,
  consumeBloodtidePulse,
  pushRecentClear,
  resetAshenReign,
  resetCursedTiles,
  resetBloodtide,
  resetEngineerLockdowns,
  resetGrovewardenRootSurge,
  resetCrocFragmentBank,
  fxLichCursedTilesTick,
  fxEngineerLockdownTick,
  fxGrovewardenRootSurgeTick,
  shouldRootSurgeFire,
  getRecentClearsSnapshot,
} from './feel/identity-fx.js';
import {
  triggerIdentityBossEvent,
  resetIdentityBossState,
} from './core/reactivity-events.js';

// T1.13.5 (2026-05-12): bridge `showScreen` onto window so legacy inline
// onclick="showScreen('menu')" handlers (still present in any scaffold the
// new shell mounts) resolve. Cosmetic — required for compatibility with the
// legacy-style call sites that survived the T1.12 switchover.
if (typeof window !== 'undefined') {
  window.showScreen = showScreen;

  // T2.B (2026-05-12): Identity Layer legacy bridge surface. All hooks are
  // namespaced with the `__` prefix so they cannot collide with legacy
  // identifiers (every search of legacy returned 0 hits for the names below
  // before this commit). Per ADR-004 hybrid coexistence: legacy is primary
  // runtime; src/ exports the truth; bridges below let legacy call src/
  // without legacy importing src/ directly (which it cannot — single-HTML
  // has no module system).
  //
  // CRITICAL — sacred safety:
  //   1. NONE of these exports modify sacred values. They wrap a pure src/
  //      function or pure read accessor.
  //   2. Legacy bridge call sites are DEFENSIVE (try/catch around every
  //      bridge call) so an identity-layer bug NEVER regresses the sacred
  //      line-clear / placement / boss-attack pipelines.
  //   3. The Spark combo-crit `_dominantCountModifier` input modification
  //      at legacy line 63659 is a 1-line domCount EXTENSION (sacred
  //      formula at line 63664 stays byte-perfect). Per ESC-02 O3 ruling
  //      ("WITHIN BOUNDARY") this is the established input-mutation
  //      precedent (same architectural pattern as legacy cascade).
  //
  // ── Dispatcher entrypoints (called from legacy clearLines + reactivity) ──
  window.__dispatchIdentityFx               = dispatchIdentityFx;
  window.__dispatchIdentityBossEvent        = triggerIdentityBossEvent;
  // ── Placement gates (called from legacy canPlace) ───────────────────────
  window.__canPlacePieceDuringAshenReign    = canPlacePieceDuringAshenReign;
  window.__isAshenReignActive               = isAshenReignActive;
  window.__isCellCursed                     = isCellCursed;
  window.__isCellLockedByLockdownProtocol   = isCellLockedByLockdownProtocol;
  window.__isCellRooted                     = isCellRooted;
  // ── Cross-layer accumulators (Bloodtide pulse + Grove root reward) ──────
  window.__onRootCellCleared                = onRootCellCleared;
  window.__incrementBloodtideClearCount     = incrementBloodtideClearCount;
  window.__consumeBloodtidePulse            = consumeBloodtidePulse;
  window.__pushRecentClear                  = pushRecentClear;
  window.__shouldRootSurgeFire              = shouldRootSurgeFire;
  window.__getRecentClearsSnapshot          = getRecentClearsSnapshot;
  // ── Per-turn tick hooks (called from legacy turn dispatcher) ────────────
  window.__fxLichCursedTilesTick            = fxLichCursedTilesTick;
  window.__fxEngineerLockdownTick           = fxEngineerLockdownTick;
  window.__fxGrovewardenRootSurgeTick       = fxGrovewardenRootSurgeTick;
  // ── Battle-pipeline reset hooks (called from legacy startBossBattle) ────
  window.__resetAshenReign                  = resetAshenReign;
  window.__resetCursedTiles                 = resetCursedTiles;
  window.__resetBloodtide                   = resetBloodtide;
  window.__resetEngineerLockdowns           = resetEngineerLockdowns;
  window.__resetGrovewardenRootSurge        = resetGrovewardenRootSurge;
  window.__resetCrocFragmentBank            = resetCrocFragmentBank;
  window.__resetIdentityBossState           = resetIdentityBossState;
  // ── Codex aggregation (called from legacy fx end-of-fire + battle hooks) ──
  window.__recordRaceTrigger                = recordRaceTrigger;
  window.__recordBossEncounter              = recordBossEncounter;
  window.__recordBossDefeat                 = recordBossDefeat;
  window.__recordMomentTrigger              = recordMomentTrigger;

  // ── Phase 2.5 FTUE polish — first-time tutorial overlay (TASK-045) ──
  // The fx module calls window.showFirstTimeTutorialOverlay({...}) at the
  // F-01/F-02/F-04 trigger sites. Window-bridge keeps fx UI-decoupled.
  window.showFirstTimeTutorialOverlay       = showFirstTimeTutorialOverlay;
  window.hideFirstTimeTutorialOverlay       = hideFirstTimeTutorialOverlay;
}

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
