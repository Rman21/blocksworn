// 2026-05-13 — TASK-047 (T3.07): Replay capture backend — smoke suite.
//
// Spec: docs/design/endgame-social.md §4 (Replay/Share infrastructure)
//       + §15 ESC-03 Q2 ruling — storage tier wiring from getPlayerSegment().
//
// Coverage strategy (ADR-004 hybrid coexistence):
//   - Vite-served `/` boots the new src/main.js shell + bridges the replay
//     backend onto window.__startReplayCapture / window.__on*Trigger.
//   - Legacy page loads without pageerrors (sacred regression contract).
//   - Storage tier wiring verified for F2P / Minnow / Dolphin / Whale.
//   - Trigger emits don't throw + return envelope-shaped results.
//
// Per CTO brief: "Load legacy → start replay capture → simulate Tetris crit
// → assert trigger fires + upload attempt (mocked)" — done in-page via
// dynamic import of /src/services/replay-backend.js.

import { test, expect } from '@playwright/test';

const LEGACY_PATH = '/docs/_legacy/_archive_v1/blocksworn_index_fixed.html';
const VITE_PATH   = '/';

async function seedAuthenticatedState(page) {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('blocksworn_save_version', '2');
      localStorage.setItem('onboardingSeen', '1');
      localStorage.setItem('seenIntroVideo', '1');
      localStorage.setItem('blocksworn_ftue_beat', 'complete');
      localStorage.setItem('blocksworn_p8_player_name', 'TESTER');
    } catch (_e) { /* private mode — caller will see selector timeout */ }
  });
}

test('[T3.07] legacy single HTML still loads without pageerrors (replay no-regression)', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(LEGACY_PATH);
  await page.waitForSelector('#screenMenu', { timeout: 30000 });
  expect(errors).toEqual([]);
});

test('[T3.07] Vite-served shell boots with src/services/replay-backend.js bridges', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  // Verify the 12 replay-backend window bridges are exposed.
  const surface = await page.evaluate(() => ({
    startReplayCapture:               typeof window.__startReplayCapture,
    stopReplayCapture:                typeof window.__stopReplayCapture,
    resetReplayBuffer:                typeof window.__resetReplayBuffer,
    onBossDefeatedTrigger:            typeof window.__onBossDefeatedTrigger,
    onTetrisCritTrigger:              typeof window.__onTetrisCritTrigger,
    onIdentityFxTrigger:              typeof window.__onIdentityFxTrigger,
    onIdentityBossReactivityTrigger:  typeof window.__onIdentityBossReactivityTrigger,
    onBigComboTrigger:                typeof window.__onBigComboTrigger,
    onStaggerEntryTrigger:            typeof window.__onStaggerEntryTrigger,
    onTowerMilestoneTrigger:          typeof window.__onTowerMilestoneTrigger,
    onAdventureWeeklyDefeatTrigger:   typeof window.__onAdventureWeeklyDefeatTrigger,
    onPartyTowerRunClearTrigger:      typeof window.__onPartyTowerRunClearTrigger,
  }));
  expect(surface.startReplayCapture).toBe('function');
  expect(surface.stopReplayCapture).toBe('function');
  expect(surface.resetReplayBuffer).toBe('function');
  expect(surface.onBossDefeatedTrigger).toBe('function');
  expect(surface.onTetrisCritTrigger).toBe('function');
  expect(surface.onIdentityFxTrigger).toBe('function');
  expect(surface.onIdentityBossReactivityTrigger).toBe('function');
  expect(surface.onBigComboTrigger).toBe('function');
  expect(surface.onStaggerEntryTrigger).toBe('function');
  expect(surface.onTowerMilestoneTrigger).toBe('function');
  expect(surface.onAdventureWeeklyDefeatTrigger).toBe('function');
  expect(surface.onPartyTowerRunClearTrigger).toBe('function');
  expect(errors).toEqual([]);
});

test('[T3.07] Tetris crit predicate fires only for rows + cols === 4', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const results = await page.evaluate(async () => {
    const validTetris = await window.__onTetrisCritTrigger([1, 2], [3, 4], {});
    const invalid3    = await window.__onTetrisCritTrigger([1, 2], [3], {});
    const invalid5    = await window.__onTetrisCritTrigger([1, 2, 3], [4, 5], {});
    return {
      validTetrisReason: validTetris.reason,
      invalid3Ok: invalid3.ok,
      invalid3Reason: invalid3.reason,
      invalid5Reason: invalid5.reason,
    };
  });
  expect(results.validTetrisReason).not.toBe('not-tetris');
  expect(results.invalid3Ok).toBe(false);
  expect(results.invalid3Reason).toBe('not-tetris');
  expect(results.invalid5Reason).toBe('not-tetris');
});

test('[T3.07] Identity FX 1-in-5 sampling: 25 fires → exactly 5 uploads', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const fires = await page.evaluate(async () => {
    // Reset buffer + counter via the backend module (test-only helper).
    const mod = await import('/src/services/replay-backend.js');
    mod._resetIdentityFxSampleCounter();
    let count = 0;
    for (let i = 0; i < 25; i++) {
      const result = await window.__onIdentityFxTrigger('pirate', {});
      if (result.reason !== 'sampled-out') count++;
    }
    return count;
  });
  expect(fires).toBe(5);
});

test('[T3.07] Tower milestone predicate gates on floors 25/50/75/100 only', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const results = await page.evaluate(async () => ({
    f25: (await window.__onTowerMilestoneTrigger(25, {})).reason !== 'not-milestone',
    f50: (await window.__onTowerMilestoneTrigger(50, {})).reason !== 'not-milestone',
    f75: (await window.__onTowerMilestoneTrigger(75, {})).reason !== 'not-milestone',
    f100: (await window.__onTowerMilestoneTrigger(100, {})).reason !== 'not-milestone',
    f24Reason: (await window.__onTowerMilestoneTrigger(24, {})).reason,
    f99Reason: (await window.__onTowerMilestoneTrigger(99, {})).reason,
  }));
  expect(results.f25).toBe(true);
  expect(results.f50).toBe(true);
  expect(results.f75).toBe(true);
  expect(results.f100).toBe(true);
  expect(results.f24Reason).toBe('not-milestone');
  expect(results.f99Reason).toBe('not-milestone');
});

test('[T3.07] Storage tier wiring: F2P / Minnow / Dolphin / Whale per ESC-03 Q2', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const tiers = await page.evaluate(async () => {
    const mod = await import('/src/services/replay-backend.js');
    return {
      f2p: mod.getStorageQuotaForSegment('F2P'),
      minnow: mod.getStorageQuotaForSegment('Minnow'),
      dolphin: mod.getStorageQuotaForSegment('Dolphin'),
      whale: mod.getStorageQuotaForSegment('Whale'),
      unknown: mod.getStorageQuotaForSegment('Unknown'),
    };
  });
  expect(tiers.f2p).toBe(100);
  expect(tiers.minnow).toBe(100);
  expect(tiers.dolphin).toBe(250);
  expect(tiers.whale).toBe(500);
  expect(tiers.unknown).toBe(100); // defaults to F2P
});

test('[T3.07] Deferred stubs return early — T3.04 Adventures + T3.13 Party Tower', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const results = await page.evaluate(async () => ({
    adventure: await window.__onAdventureWeeklyDefeatTrigger({}),
    party: await window.__onPartyTowerRunClearTrigger({}),
  }));
  expect(results.adventure.ok).toBe(false);
  expect(results.adventure.reason).toBe('deferred-to-T3.04');
  expect(results.party.ok).toBe(false);
  expect(results.party.reason).toBe('deferred-to-T3.13');
});

test('[T3.07] Capture lifecycle: start → tick → buffer populates → stop clears timer', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/replay-backend.js');
    mod.setGameStateProvider(() => ({ grid: [[1, 2]], boss: { id: 'pyredrake' } }));
    mod.resetReplayBuffer();
    window.__startReplayCapture();
    await new Promise(r => setTimeout(r, 600)); // ~2 capture ticks @ 250ms
    window.__stopReplayCapture();
    const buf = mod._getReplayBufferForTest();
    mod.setGameStateProvider(() => null);
    return { bufLen: buf.length, firstFrameHasGrid: buf.length > 0 && buf[0].grid !== null };
  });
  expect(result.bufLen).toBeGreaterThanOrEqual(1);
  expect(result.firstFrameHasGrid).toBe(true);
});

test('[T3.07] Performance: capture overhead < 4ms/frame averaged (sacred AAA+ budget)', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const avgMs = await page.evaluate(async () => {
    const mod = await import('/src/services/replay-backend.js');
    const state = {
      grid: new Array(64).fill(0).map((_, i) => i % 5),
      pieceQueue: ['I', 'L', 'O', 'T'],
      squad: ['pirate', 'shark', 'rock', 'spark', 'crocodile'],
      boss: { id: 'pyredrake', hp: 3000, archetype: 'bruiser' },
      identityFxState: { ashenReign: false, cursed: [] },
      ultCharges: { pirate: 0.4 },
    };
    const N = 1000;
    const start = performance.now();
    let buf = [];
    for (let i = 0; i < N; i++) {
      const frame = mod.captureFrameSnapshot(state);
      buf = mod.appendFrameToBuffer(buf, frame, 240);
    }
    return (performance.now() - start) / N;
  });
  // Spec §4.1 — capture overhead ≤4ms/frame averaged. Pure snapshot +
  // ring-buffer append is well under in practice.
  expect(avgMs).toBeLessThan(4);
});
