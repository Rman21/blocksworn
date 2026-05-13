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

// 2026-05-13 — TASK-047 (T3.07): Replay capture backend bridge.
// First Phase 3 task. Read-only of game state. See
// src/services/replay-backend.js for the full contract + spec §4.1 / §15.
import {
  startReplayCapture,
  stopReplayCapture,
  resetReplayBuffer,
  onBossDefeatedTrigger,
  onTetrisCritTrigger,
  onIdentityFxTrigger,
  onIdentityBossReactivityTrigger,
  onBigComboTrigger,
  onStaggerEntryTrigger,
  onTowerMilestoneTrigger,
  onAdventureWeeklyDefeatTrigger,
  onPartyTowerRunClearTrigger,
} from './services/replay-backend.js';

// 2026-05-13 — TASK-050 (T3.02): Adventures backend bridge (MINIMAL — +1 entry).
// Wave-3 Phase 3 task. Backend-only — see src/services/clan-backend.js for
// the full contract + spec §2 / §15. T3.03 UI consumes the 8 pure helpers +
// 9 CRUD ops via DIRECT-IMPORT (mirrors T3.08/T3.09 precedent — keeps the
// window-bridge surface at 38 + 1 = 39 total, NOT 38 + 9 CRUD). The single
// minimal entry below lets the legacy menu badge surface "is player in any
// clan?" without dragging the full clan-backend module into legacy.
import {
  listClansForPlayer as _listClansForPlayer_t302,
} from './services/clan-backend.js';

// 2026-05-13 — TASK-055 (T3.10): Party Tower backend bridge (MINIMAL — +1 entry).
// Wave-5 Phase 3 task. Backend-only — see src/services/party-tower-backend.js
// for the full contract + spec §3 / §15 ESC-03 Q3 (24h Standard default).
// T3.11+ UI consumes the 10 pure helpers + 10 async CRUD ops via DIRECT-IMPORT
// (mirrors T3.02/T3.06 precedent — keeps the window-bridge surface at 39 + 1
// = 40 total, NOT 39 + 10 CRUD). The single minimal entry below lets the
// legacy menu badge surface "is player in any Party Tower run?" without
// dragging the full party-tower-backend module into legacy.
import {
  listPartiesForPlayer as _listPartiesForPlayer_t310,
} from './services/party-tower-backend.js';

// T4.13 (2026-05-13): Phase 4 Chia integration Legacy Bridge. Wires all
// Phase 4 src/ modules (feature-flags, wallet-connect, nft-backend,
// tower-leaderboard-chain, anti-p2w-audit) onto window under the
// `__bsw_phase4_*` namespace for legacy modal consumption. When chia is
// disabled (mobile build via VITE_CHIA_ENABLED=false), bridges are no-op
// stubs — legacy surface is byte-identical to pre-Phase-4. Sacred 50-row
// audit (design spec §8) verified inside sacredCowAudit() at boot.
import { installPhase4Bridge } from './services/phase4-bridge.js';

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

  // 2026-05-13 — TASK-047 (T3.07): Replay capture backend bridge surface.
  // Phase 3 FIRST task. Read-only of game state — never mutates sacred
  // tables. All bridge call sites in legacy are wrapped in try/catch so the
  // sacred boss/clear/stagger pipelines never regress if replay throws.
  // Additive — leaves the 26 T2.B bridges above untouched.
  // ── Lifecycle (called from legacy startBossBattle + battle-end hooks) ──
  window.__startReplayCapture               = startReplayCapture;
  window.__stopReplayCapture                = stopReplayCapture;
  window.__resetReplayBuffer                = resetReplayBuffer;
  // ── 9 trigger predicates (7 live + 2 deferred stubs for T3.04 / T3.13) ──
  window.__onBossDefeatedTrigger            = onBossDefeatedTrigger;
  window.__onTetrisCritTrigger              = onTetrisCritTrigger;
  window.__onIdentityFxTrigger              = onIdentityFxTrigger;
  window.__onIdentityBossReactivityTrigger  = onIdentityBossReactivityTrigger;
  window.__onBigComboTrigger                = onBigComboTrigger;
  window.__onStaggerEntryTrigger            = onStaggerEntryTrigger;
  window.__onTowerMilestoneTrigger          = onTowerMilestoneTrigger;
  window.__onAdventureWeeklyDefeatTrigger   = onAdventureWeeklyDefeatTrigger;
  window.__onPartyTowerRunClearTrigger      = onPartyTowerRunClearTrigger;

  // 2026-05-13 — TASK-050 (T3.02): Adventures backend — MINIMAL bridge.
  // ONE function exposed: legacy menu badge ("is player in any Adventure?")
  // needs cheap async lookup without importing the full clan-backend module.
  // All 9 CRUD operations + 8 pure helpers stay direct-import (T3.03 UI
  // mirrors T3.08/T3.09 precedent). Bridge count: 38 → 39 (1 minimal entry).
  // ── Player-clan membership probe (called from legacy menu badge) ────────
  window.__getPlayerClanCount               = async function _getPlayerClanCountBridge(playerId) {
    try {
      const result = await _listClansForPlayer_t302(playerId);
      if (result && result.ok && Array.isArray(result.clans)) return result.clans.length;
    } catch (_e) { /* swallow — badge defaults to 0 on any failure */ }
    return 0;
  };

  // 2026-05-13 — TASK-055 (T3.10): Party Tower backend — MINIMAL bridge.
  // ONE function exposed: legacy menu badge ("is player in any Party Tower
  // run?") needs cheap async lookup without importing the full
  // party-tower-backend module. All 10 CRUD operations + 10 pure helpers
  // stay direct-import (T3.11+ UI mirrors T3.02/T3.06 precedent).
  // Bridge count: 39 → 40 (1 minimal entry).
  // Per ADR-002: async-only; no presence channel. Per ADR-003: badge is
  // segment-agnostic — never reads spend / segment / paid tier.
  // ── Player-party membership probe (called from legacy menu badge) ───────
  window.__getPlayerPartyCount              = async function _getPlayerPartyCountBridge(playerId) {
    try {
      const result = await _listPartiesForPlayer_t310(playerId);
      if (result && result.ok && Array.isArray(result.parties)) return result.parties.length;
    } catch (_e) { /* swallow — badge defaults to 0 on any failure */ }
    return 0;
  };
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

    // 9. T4.13 — Phase 4 Legacy Bridge. Installs wallet/NFT/PURE PATH CHAIN/
    //    anti-P2W audit surfaces on window under `__bsw_phase4_*`. When
    //    chia is disabled (mobile build), bridges are no-op stubs and the
    //    surface count is unchanged from Phase 3. Defensive: bridge install
    //    NEVER throws into the main bootstrap chain.
    try {
      const r = installPhase4Bridge();
      log.info('[boot] phase4-bridge:', r);
    } catch (err) {
      log.warn('[boot] installPhase4Bridge:', err);
    }

    log.info('[boot] main complete');
  } catch (err) {
    log.error('[boot] failed:', err);
    captureException(err);
  }
}

main();
