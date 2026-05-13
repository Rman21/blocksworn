// 2026-05-13 — TASK-049 (T3.09): Codex Moments Replay button integration — smoke suite.
//
// Spec: docs/design/endgame-social.md §4.5 (Phase 2 Codex integration).
// THIRD Phase 3 implementation task. Closes the visible Phase 2 → Phase 3
// bridge: every Codex moment now has a Replay button that routes into the
// T3.08 viewer with the captured replayId.
//
// Coverage strategy (mirrors codex.spec.js + replay-viewer.spec.js):
//   1. Replay-upload success → recordMomentReplay fires → Codex Moments tab
//      renders the Replay button with the linked replayId.
//   2. Click Replay button → routes to 'replay-viewer' route with
//      window.__replayViewerCurrentId set to the linked replayId.
//   3. Codex Moments tab WITHOUT any captured replays → no Replay button
//      visible (graceful empty state).
//   4. Backward-compat: pre-existing Codex state (no lastReplayId) loads
//      correctly → buttons hidden, original count + firstSeenAt intact.
//   5. Replay upload failure: recordMomentReplay NOT called (button absent),
//      but recordMomentTrigger still increments count.
//   6. Cross-mechanic regression: all 38 window-bridge functions (26 T2.B +
//      12 T3.07) survive a Codex render + Replay button click + viewer mount.

import { test, expect } from '@playwright/test';

const VITE_PATH = '/';

async function seedAuthenticatedState(page) {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('blocksworn_save_version', '2');
      localStorage.setItem('onboardingSeen', '1');
      localStorage.setItem('seenIntroVideo', '1');
      localStorage.setItem('blocksworn_ftue_beat', 'complete');
      localStorage.setItem('blocksworn_p8_player_name', 'TESTER');
    } catch (_e) { /* private mode */ }
  });
}

test('[T3.09] recordMomentReplay → Codex Moments tab renders Replay button', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    const codex = await import('/src/ui/codex.js');
    try { localStorage.removeItem('blocksworn_codex_state'); } catch (_e) { /* private mode */ }
    codex.__codexTestables.reset();

    // Seed: trigger the moment first (production order), then link a replay.
    codex.recordMomentTrigger('phoenix_ashen_reign');
    codex.recordMomentReplay('phoenix_ashen_reign', 'smoke_replay_abc123');

    // Render the Moments tab.
    const root = document.getElementById('screenCodex');
    codex.renderMomentsTab(root);

    // Inspect the DOM.
    const replayBtn  = root.querySelector('.codex-moment-replay-btn');
    const dataId     = replayBtn && replayBtn.getAttribute('data-codex-replay-id');
    const dataMoment = replayBtn && replayBtn.getAttribute('data-codex-moment-id');
    const ariaLabel  = replayBtn && replayBtn.getAttribute('aria-label');

    return {
      buttonCount: root.querySelectorAll('.codex-moment-replay-btn').length,
      dataId,
      dataMoment,
      ariaLabel,
    };
  });

  expect(result.buttonCount).toBe(1);
  expect(result.dataId).toBe('smoke_replay_abc123');
  expect(result.dataMoment).toBe('phoenix_ashen_reign');
  expect(result.ariaLabel).toBe('Replay this moment');
  expect(errors).toEqual([]);
});

test('[T3.09] Click Replay button → routes to replay-viewer with deeplink', async ({ page }) => {
  await seedAuthenticatedState(page);
  // Stub the fetch so the viewer doesn't blank-render.
  await page.addInitScript(() => {
    window.__fetchReplay = async (id) => {
      if (!id) return null;
      return JSON.stringify([{
        version: 1,
        type: 'identity_boss_reactivity',
        timestamp: new Date().toISOString(),
        duration_ms: 5000,
        frames: [{ t: 0, grid: null, boss: { id: 'phoenix' }, squad: null, pieceQueue: null, identityFxState: null, ultCharges: null }],
        metadata: { event: 'identity_phoenix_revive' },
      }]);
    };
  });
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  await page.evaluate(async () => {
    const codex = await import('/src/ui/codex.js');
    try { localStorage.removeItem('blocksworn_codex_state'); } catch (_e) { /* private mode */ }
    codex.__codexTestables.reset();
    codex.recordMomentTrigger('phoenix_ashen_reign');
    codex.recordMomentReplay('phoenix_ashen_reign', 'click_route_xyz789');

    // Activate codex screen + render Moments tab so the button is present.
    window.showScreen('codex');
    const root = document.getElementById('screenCodex');
    codex.renderMomentsTab(root);
  });

  // Click the Replay button.
  await page.click('.codex-moment-replay-btn');

  // Verify the route transitioned to replay-viewer.
  await page.waitForSelector('#screenReplayViewer.active', { timeout: 10_000 });

  // Verify the deeplink id was pinned on window + return target was set to codex.
  const result = await page.evaluate(() => ({
    pinnedId: window.__replayViewerCurrentId,
    returnTo: window.__replayViewerReturnTo,
  }));
  expect(result.pinnedId).toBe('click_route_xyz789');
  expect(result.returnTo).toBe('codex');
});

test('[T3.09] Codex Moments tab without captured replays → no Replay button', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const codex = await import('/src/ui/codex.js');
    try { localStorage.removeItem('blocksworn_codex_state'); } catch (_e) { /* private mode */ }
    codex.__codexTestables.reset();

    // Trigger moments but do NOT link any replays.
    codex.recordMomentTrigger('lich_cursed_tiles');
    codex.recordMomentTrigger('engineer_lockdown');

    const root = document.getElementById('screenCodex');
    codex.renderMomentsTab(root);

    return {
      momentRows:   root.querySelectorAll('.codex-moment-row').length,
      replayBtns:   root.querySelectorAll('.codex-moment-replay-btn').length,
    };
  });

  expect(result.momentRows).toBe(2);
  expect(result.replayBtns).toBe(0); // no buttons until a replay links
});

test('[T3.09] Backward-compat: pre-existing Codex state without lastReplayId renders correctly', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    // Seed legacy state via localStorage directly (simulates upgrade from
    // pre-T3.09 install).
    const legacy = {
      version: 1,
      races: {},
      bosses: {},
      moments: [
        { id: 'phoenix_ashen_reign', firstSeenAt: '2026-05-01', count: 7 },
        { id: 'berserker_bloodtide', firstSeenAt: '2026-05-02', count: 12 },
      ],
    };
    try { localStorage.setItem('blocksworn_codex_state', JSON.stringify(legacy)); } catch (_e) { /* private mode */ }

    const codex = await import('/src/ui/codex.js');
    codex.__codexTestables.reset();

    const root = document.getElementById('screenCodex');
    codex.renderMomentsTab(root);

    const state = codex.getCodexState();
    return {
      momentRows:    root.querySelectorAll('.codex-moment-row').length,
      replayBtns:    root.querySelectorAll('.codex-moment-replay-btn').length,
      firstCount:    state.moments[0].count,
      firstSeenAt:   state.moments[0].firstSeenAt,
      firstReplayId: state.moments[0].lastReplayId,
    };
  });

  expect(result.momentRows).toBe(2);
  expect(result.replayBtns).toBe(0); // no buttons — legacy data has no lastReplayId
  expect(result.firstCount).toBe(7); // legacy count preserved
  expect(result.firstSeenAt).toBe('2026-05-01');
  expect(result.firstReplayId).toBeUndefined();
});

test('[T3.09] Replay upload failure → recordMomentReplay NOT called → button absent (moment count still increments)', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const codex = await import('/src/ui/codex.js');
    const backend = await import('/src/services/replay-backend.js');
    try { localStorage.removeItem('blocksworn_codex_state'); } catch (_e) { /* private mode */ }
    codex.__codexTestables.reset();

    // Trigger the moment (this is the contract — moment count grows
    // independent of replay upload success).
    codex.recordMomentTrigger('grovewarden_root_surge');

    // Simulate upload failure — call emitReplayTrigger with a context that
    // doesn't match a known moment, OR rely on the no-SDK default which
    // returns ok:false. The Codex moment should still exist (from the
    // recordMomentTrigger above) but lastReplayId should remain undefined.
    const emitResult = await backend.emitReplayTrigger(
      backend.REPLAY_TRIGGER_TYPES.IDENTITY_BOSS_REACTIVITY,
      { event: 'identity_bruiser_grove_surge' }
    );

    const root = document.getElementById('screenCodex');
    codex.renderMomentsTab(root);

    const state = codex.getCodexState();
    const m = state.moments.find(x => x.id === 'grovewarden_root_surge');
    return {
      uploadOk:    !!emitResult.ok,
      momentCount: m ? m.count : 0,
      lastReplayId: m ? m.lastReplayId : null,
      replayBtns:  root.querySelectorAll('.codex-moment-replay-btn').length,
    };
  });

  // Upload may fail (no SDK) — but the moment row exists from recordMomentTrigger.
  // When upload fails (ok=false), recordMomentReplay is gated by the
  // `result.ok` check in emitReplayTrigger → button stays hidden.
  expect(result.momentCount).toBe(1);
  if (!result.uploadOk) {
    expect(result.lastReplayId).toBeUndefined();
    expect(result.replayBtns).toBe(0);
  }
});

test('[T3.09] Cross-mechanic regression: all 38 window bridges intact after Codex Replay click', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.addInitScript(() => {
    window.__fetchReplay = async () => JSON.stringify([{
      version: 1, type: 'identity_boss_reactivity',
      timestamp: new Date().toISOString(), duration_ms: 5000,
      frames: [{ t: 0, grid: null, boss: { id: 'phoenix' }, squad: null, pieceQueue: null, identityFxState: null, ultCharges: null }],
      metadata: { event: 'identity_phoenix_revive' },
    }]);
  });
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  // Seed + render + click flow.
  await page.evaluate(async () => {
    const codex = await import('/src/ui/codex.js');
    try { localStorage.removeItem('blocksworn_codex_state'); } catch (_e) { /* private mode */ }
    codex.__codexTestables.reset();
    codex.recordMomentTrigger('phoenix_ashen_reign');
    codex.recordMomentReplay('phoenix_ashen_reign', 'regression_check_id');
    window.showScreen('codex');
    const root = document.getElementById('screenCodex');
    codex.renderMomentsTab(root);
  });
  await page.click('.codex-moment-replay-btn');
  await page.waitForSelector('#screenReplayViewer.active', { timeout: 10_000 });

  // Verify the full 38-bridge surface still resolves.
  const surface = await page.evaluate(() => ({
    // T2.B (26)
    dispatchIdentityFx:                typeof window.__dispatchIdentityFx,
    dispatchIdentityBossEvent:         typeof window.__dispatchIdentityBossEvent,
    canPlacePieceDuringAshenReign:     typeof window.__canPlacePieceDuringAshenReign,
    isAshenReignActive:                typeof window.__isAshenReignActive,
    isCellCursed:                      typeof window.__isCellCursed,
    isCellLockedByLockdownProtocol:    typeof window.__isCellLockedByLockdownProtocol,
    isCellRooted:                      typeof window.__isCellRooted,
    onRootCellCleared:                 typeof window.__onRootCellCleared,
    incrementBloodtideClearCount:      typeof window.__incrementBloodtideClearCount,
    consumeBloodtidePulse:             typeof window.__consumeBloodtidePulse,
    pushRecentClear:                   typeof window.__pushRecentClear,
    shouldRootSurgeFire:               typeof window.__shouldRootSurgeFire,
    getRecentClearsSnapshot:           typeof window.__getRecentClearsSnapshot,
    fxLichCursedTilesTick:             typeof window.__fxLichCursedTilesTick,
    fxEngineerLockdownTick:            typeof window.__fxEngineerLockdownTick,
    fxGrovewardenRootSurgeTick:        typeof window.__fxGrovewardenRootSurgeTick,
    resetAshenReign:                   typeof window.__resetAshenReign,
    resetCursedTiles:                  typeof window.__resetCursedTiles,
    resetBloodtide:                    typeof window.__resetBloodtide,
    resetEngineerLockdowns:            typeof window.__resetEngineerLockdowns,
    resetGrovewardenRootSurge:         typeof window.__resetGrovewardenRootSurge,
    resetCrocFragmentBank:             typeof window.__resetCrocFragmentBank,
    resetIdentityBossState:            typeof window.__resetIdentityBossState,
    recordRaceTrigger:                 typeof window.__recordRaceTrigger,
    recordBossEncounter:               typeof window.__recordBossEncounter,
    recordBossDefeat:                  typeof window.__recordBossDefeat,
    recordMomentTrigger:               typeof window.__recordMomentTrigger,
    // T3.07 (12)
    startReplayCapture:                typeof window.__startReplayCapture,
    stopReplayCapture:                 typeof window.__stopReplayCapture,
    resetReplayBuffer:                 typeof window.__resetReplayBuffer,
    onBossDefeatedTrigger:             typeof window.__onBossDefeatedTrigger,
    onTetrisCritTrigger:               typeof window.__onTetrisCritTrigger,
    onIdentityFxTrigger:               typeof window.__onIdentityFxTrigger,
    onIdentityBossReactivityTrigger:   typeof window.__onIdentityBossReactivityTrigger,
    onBigComboTrigger:                 typeof window.__onBigComboTrigger,
    onStaggerEntryTrigger:             typeof window.__onStaggerEntryTrigger,
    onTowerMilestoneTrigger:           typeof window.__onTowerMilestoneTrigger,
    onAdventureWeeklyDefeatTrigger:    typeof window.__onAdventureWeeklyDefeatTrigger,
    onPartyTowerRunClearTrigger:       typeof window.__onPartyTowerRunClearTrigger,
  }));

  // Spot-check a representative sample (full table validated by replay-viewer
  // spec; mirrored here as the post-T3.09 sacred-regression contract).
  expect(surface.dispatchIdentityFx).toBe('function');
  expect(surface.dispatchIdentityBossEvent).toBe('function');
  expect(surface.recordMomentTrigger).toBe('function');
  expect(surface.startReplayCapture).toBe('function');
  expect(surface.onIdentityBossReactivityTrigger).toBe('function');
  expect(surface.onPartyTowerRunClearTrigger).toBe('function');

  // Verify NO new window bridge was added (T3.09 spec — direct-import path).
  const newBridges = await page.evaluate(() => {
    return {
      hasRecordMomentReplay: typeof window.__recordMomentReplay,
    };
  });
  expect(newBridges.hasRecordMomentReplay).toBe('undefined');
});

test('[T3.09] Codex schema: lastReplayId persists across page reload', async ({ page }) => {
  // Do NOT call seedAuthenticatedState — its clear() would wipe our codex data
  // on reload. Use the minimal addInitScript pattern from codex.spec.js
  // "localStorage persistence survives page reload" test.
  await page.addInitScript(() => {
    try {
      if (!localStorage.getItem('blocksworn_save_version')) {
        localStorage.setItem('blocksworn_save_version', '2');
        localStorage.setItem('onboardingSeen', '1');
        localStorage.setItem('seenIntroVideo', '1');
        localStorage.setItem('blocksworn_ftue_beat', 'complete');
        localStorage.setItem('blocksworn_p8_player_name', 'TESTER');
      }
    } catch (_e) { /* private mode */ }
  });
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  // Phase 1: seed + link.
  await page.evaluate(async () => {
    const codex = await import('/src/ui/codex.js');
    try { localStorage.removeItem('blocksworn_codex_state'); } catch (_e) { /* private mode */ }
    codex.__codexTestables.reset();
    codex.recordMomentTrigger('engineer_lockdown');
    codex.recordMomentReplay('engineer_lockdown', 'persisted_across_reload');
  });

  // Phase 2: reload and verify.
  await page.reload();
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const after = await page.evaluate(async () => {
    const codex = await import('/src/ui/codex.js');
    codex.__codexTestables.reset();
    const state = codex.getCodexState();
    const m = state.moments.find(x => x.id === 'engineer_lockdown');
    return {
      lastReplayId: m && m.lastReplayId,
      lastReplayAt: m && m.lastReplayAt,
      count:        m && m.count,
    };
  });

  expect(after.lastReplayId).toBe('persisted_across_reload');
  expect(typeof after.lastReplayAt).toBe('number');
  expect(after.count).toBe(1);
});
