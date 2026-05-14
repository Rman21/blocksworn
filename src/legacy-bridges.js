// 2026-05-14 — Phase 4.1 sidecar wiring.
//
// Single source of truth for installing Phase 2/3/4 window-bridges onto the
// legacy single-HTML runtime. Both src/main.js (the new modular shell at
// /shell) AND src/sidecar.js (injected into legacy at play.blocksworm.com/)
// import and invoke `installLegacyBridges()` so the bridge surface is
// guaranteed identical regardless of which entrypoint loads the modules.
//
// Sacred-cow safety:
//   - Every bridge is a thin wrapper around a PURE src/ export. No bridge
//     modifies a sacred value.
//   - All `window.__*` keys are namespaced (zero collision with legacy
//     identifiers — verified by `grep` at the time of T2.B / T3.16 / T4.13).
//   - Legacy call sites are wrapped in try/catch (sacred line-clear /
//     placement / boss-attack pipelines never regress if a bridge throws).
//   - Idempotent: calling `installLegacyBridges()` more than once is safe;
//     subsequent calls overwrite the same window keys with identical refs.
//
// Per ADR-004 hybrid coexistence: legacy is the primary runtime; src/
// exports the truth; bridges below let legacy call src/ without legacy
// importing src/ directly (single-HTML has no module system).

// ─── Phase 2 Identity Layer (T2.02–T2.12 + T2.B) ────────────────────────────
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

// ─── T2.12 Codex aggregation ───────────────────────────────────────────────
import {
  recordRaceTrigger,
  recordBossEncounter,
  recordBossDefeat,
  recordMomentTrigger,
} from './ui/codex.js';

// ─── T3.07 Replay capture ──────────────────────────────────────────────────
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

// ─── T3.02 Adventures (minimal probe bridge) ───────────────────────────────
import {
  listClansForPlayer as _listClansForPlayer_t302,
} from './services/clan-backend.js';

// ─── T3.10 Party Tower (minimal probe bridge) ──────────────────────────────
import {
  listPartiesForPlayer as _listPartiesForPlayer_t310,
} from './services/party-tower-backend.js';

// ─── T4.13 Phase 4 Chia Bridge (wallet + NFT + DAO + audit) ────────────────
import { installPhase4Bridge } from './services/phase4-bridge.js';

// ─── Router showScreen (T1.13.5 legacy onclick compatibility) ──────────────
import { showScreen } from './ui/router.js';

/**
 * Install all Phase 2/3/4 legacy-bridge surfaces onto window.
 *
 * Safe to call:
 *   - From the modular shell entry (src/main.js → /shell.html on Vercel)
 *   - From the legacy sidecar entry (src/sidecar.js → injected into
 *     dist/blocksworn_index_fixed.html post-build)
 *   - In both environments simultaneously (idempotent — same refs assigned)
 *
 * Returns an object describing what was installed (useful for boot logs).
 *
 * @returns {{installed: boolean, surfaces: number}}
 */
export function installLegacyBridges() {
  if (typeof window === 'undefined') {
    return { installed: false, surfaces: 0 };
  }

  // T1.13.5: legacy onclick="showScreen('menu')" compat shim.
  window.showScreen = showScreen;

  // ── T2.B Identity Layer dispatcher entrypoints ─────────────────────────
  window.__dispatchIdentityFx               = dispatchIdentityFx;
  window.__dispatchIdentityBossEvent        = triggerIdentityBossEvent;
  // ── Placement gates (called from legacy canPlace) ──────────────────────
  window.__canPlacePieceDuringAshenReign    = canPlacePieceDuringAshenReign;
  window.__isAshenReignActive               = isAshenReignActive;
  window.__isCellCursed                     = isCellCursed;
  window.__isCellLockedByLockdownProtocol   = isCellLockedByLockdownProtocol;
  window.__isCellRooted                     = isCellRooted;
  // ── Cross-layer accumulators (Bloodtide pulse + Grove root reward) ─────
  window.__onRootCellCleared                = onRootCellCleared;
  window.__incrementBloodtideClearCount     = incrementBloodtideClearCount;
  window.__consumeBloodtidePulse            = consumeBloodtidePulse;
  window.__pushRecentClear                  = pushRecentClear;
  window.__shouldRootSurgeFire              = shouldRootSurgeFire;
  window.__getRecentClearsSnapshot          = getRecentClearsSnapshot;
  // ── Per-turn tick hooks (called from legacy turn dispatcher) ───────────
  window.__fxLichCursedTilesTick            = fxLichCursedTilesTick;
  window.__fxEngineerLockdownTick           = fxEngineerLockdownTick;
  window.__fxGrovewardenRootSurgeTick       = fxGrovewardenRootSurgeTick;
  // ── Battle-pipeline reset hooks (called from legacy startBossBattle) ───
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

  // ── T3.07 Replay lifecycle ─────────────────────────────────────────────
  window.__startReplayCapture               = startReplayCapture;
  window.__stopReplayCapture                = stopReplayCapture;
  window.__resetReplayBuffer                = resetReplayBuffer;
  // ── T3.07 Replay 9 trigger predicates ──────────────────────────────────
  window.__onBossDefeatedTrigger            = onBossDefeatedTrigger;
  window.__onTetrisCritTrigger              = onTetrisCritTrigger;
  window.__onIdentityFxTrigger              = onIdentityFxTrigger;
  window.__onIdentityBossReactivityTrigger  = onIdentityBossReactivityTrigger;
  window.__onBigComboTrigger                = onBigComboTrigger;
  window.__onStaggerEntryTrigger            = onStaggerEntryTrigger;
  window.__onTowerMilestoneTrigger          = onTowerMilestoneTrigger;
  window.__onAdventureWeeklyDefeatTrigger   = onAdventureWeeklyDefeatTrigger;
  window.__onPartyTowerRunClearTrigger      = onPartyTowerRunClearTrigger;

  // ── T3.02 Adventures probe (player-clan count for menu badge) ──────────
  window.__getPlayerClanCount               = async function _getPlayerClanCountBridge(playerId) {
    try {
      const result = await _listClansForPlayer_t302(playerId);
      if (result && result.ok && Array.isArray(result.clans)) return result.clans.length;
    } catch (_e) { /* swallow — badge defaults to 0 on any failure */ }
    return 0;
  };

  // ── T3.10 Party Tower probe (player-party count for menu badge) ────────
  window.__getPlayerPartyCount              = async function _getPlayerPartyCountBridge(playerId) {
    try {
      const result = await _listPartiesForPlayer_t310(playerId);
      if (result && result.ok && Array.isArray(result.parties)) return result.parties.length;
    } catch (_e) { /* swallow — badge defaults to 0 on any failure */ }
    return 0;
  };

  // ── T4.13 Phase 4 bridge surfaces (wallet + NFT + DAO + audit) ─────────
  try { installPhase4Bridge(); } catch (_e) { /* defensive */ }

  return { installed: true, surfaces: 47 };
}
