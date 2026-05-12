// 2026-05-12 — TASK-039 (T2.12): Codex screen smoke tests.
//
// Spec: docs/design/mechanics/identity-layer.md §4 (Codex screen).
// Coverage strategy: Vite-served `/` boots the new src/main.js shell
// (including the Codex route + recording hooks in identity-fx.js), then
// dynamically imports the codex module to drive its public API. Asserts
// that:
//   1. Vite shell boots without pageerrors (regression contract).
//   2. The codex module exports the public API surface (state + recorders).
//   3. localStorage persistence roundtrip works through a page reload.
//   4. Race triggers move state Locked → Encountered → Mastered (25).
//   5. Moments tab appends entries when fxPhoenixAshenReign fires.
//   6. Cross-mechanic regression: triggering codex recording from
//      identity-fx (via dynamic import) never throws.

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
    } catch (_e) { /* private mode — caller will see selector timeout */ }
  });
}

test('Codex: Vite shell boots with src/ui/codex.js + screenCodex scaffold', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  // Verify codex screen scaffold mounted (additive change to index.html).
  const codexExists = await page.evaluate(() => !!document.getElementById('screenCodex'));
  expect(codexExists).toBe(true);

  // Verify the codex module is importable + exposes the expected surface.
  const surface = await page.evaluate(async () => {
    const mod = await import('/src/ui/codex.js');
    return {
      getCodexState:        typeof mod.getCodexState,
      saveCodexState:       typeof mod.saveCodexState,
      recordRaceTrigger:    typeof mod.recordRaceTrigger,
      recordBossEncounter:  typeof mod.recordBossEncounter,
      recordBossDefeat:     typeof mod.recordBossDefeat,
      recordMomentTrigger:  typeof mod.recordMomentTrigger,
      getRaceState:         typeof mod.getRaceState,
      getBossState:         typeof mod.getBossState,
      renderCodex:          typeof mod.renderCodex,
    };
  });

  expect(surface.getCodexState).toBe('function');
  expect(surface.saveCodexState).toBe('function');
  expect(surface.recordRaceTrigger).toBe('function');
  expect(surface.recordBossEncounter).toBe('function');
  expect(surface.recordBossDefeat).toBe('function');
  expect(surface.recordMomentTrigger).toBe('function');
  expect(surface.getRaceState).toBe('function');
  expect(surface.getBossState).toBe('function');
  expect(surface.renderCodex).toBe('function');

  expect(errors).toEqual([]);
});

test('Codex: race state moves Locked → Encountered → Mastered (25 triggers)', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    const codex = await import('/src/ui/codex.js');
    codex.__codexTestables.reset();
    // Wipe any stale codex key so initial state is clean.
    try { localStorage.removeItem('blocksworn_codex_state'); } catch (_e) { /* private mode */ }
    codex.__codexTestables.reset();

    const initial = codex.getRaceState('pirate');
    codex.recordRaceTrigger('pirate');
    const afterOne = codex.getRaceState('pirate');
    for (let i = 0; i < 24; i++) codex.recordRaceTrigger('pirate');
    const afterTwentyFive = codex.getRaceState('pirate');

    return { initial, afterOne, afterTwentyFive };
  });

  expect(result.initial).toBe('locked');
  expect(result.afterOne).toBe('encountered');
  expect(result.afterTwentyFive).toBe('mastered');
  expect(errors).toEqual([]);
});

test('Codex: moment trigger appends to moments[] (fxPhoenixAshenReign integration)', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    const codex = await import('/src/ui/codex.js');
    try { localStorage.removeItem('blocksworn_codex_state'); } catch (_e) { /* private mode */ }
    codex.__codexTestables.reset();

    // Fire the actual fxPhoenixAshenReign (recording hook lives at end).
    const fx = await import('/src/feel/identity-fx.js');
    fx.fxPhoenixAshenReign(null, null);
    fx.fxPhoenixAshenReignRelease(); // cleanup
    fx.fxPhoenixAshenReign(null, null);
    fx.fxPhoenixAshenReignRelease();

    const state = codex.getCodexState();
    return {
      momentCount: state.moments.length,
      firstMoment: state.moments[0] && state.moments[0].id,
      firstMomentCount: state.moments[0] && state.moments[0].count,
    };
  });

  expect(result.momentCount).toBe(1);
  expect(result.firstMoment).toBe('phoenix_ashen_reign');
  expect(result.firstMomentCount).toBe(2);
  expect(errors).toEqual([]);
});

test('Codex: localStorage persistence survives page reload', async ({ page }) => {
  // NOTE: do NOT call seedAuthenticatedState here — its init-script runs
  // localStorage.clear() on EVERY page load (including page.reload()), which
  // would wipe the codex data we wrote in phase 1. Instead, set up minimal
  // auth state via addInitScript without the clear() call.
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

  // Phase 1: write codex state.
  await page.evaluate(async () => {
    const codex = await import('/src/ui/codex.js');
    try { localStorage.removeItem('blocksworn_codex_state'); } catch (_e) { /* private mode */ }
    codex.__codexTestables.reset();
    codex.recordRaceTrigger('shark');
    codex.recordRaceTrigger('shark');
    codex.recordRaceTrigger('shark');
    codex.recordBossEncounter('phoenix');
    codex.recordMomentTrigger('lich_cursed_tiles');
  });

  // Phase 2: reload and verify state survived.
  await page.reload();
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const after = await page.evaluate(async () => {
    const codex = await import('/src/ui/codex.js');
    codex.__codexTestables.reset(); // force re-hydrate from localStorage
    const state = codex.getCodexState();
    return {
      sharkTriggers: state.races.shark && state.races.shark.triggerCount,
      phoenixEncountered: state.bosses.phoenix && state.bosses.phoenix.encountered,
      moments: state.moments.length,
      firstMomentId: state.moments[0] && state.moments[0].id,
    };
  });

  expect(after.sharkTriggers).toBe(3);
  expect(after.phoenixEncountered).toBe(true);
  expect(after.moments).toBe(1);
  expect(after.firstMomentId).toBe('lich_cursed_tiles');
});

test('Codex: renderCodex renders 3 tabs + initial races grid', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    const codex = await import('/src/ui/codex.js');
    try { localStorage.removeItem('blocksworn_codex_state'); } catch (_e) { /* private mode */ }
    codex.__codexTestables.reset();

    // Activate the codex screen + render.
    const root = document.getElementById('screenCodex');
    codex.renderCodex(root);

    // Read back DOM structure.
    const tabs = root.querySelectorAll('.codex-tab').length;
    const cards = root.querySelectorAll('.codex-card').length;
    const progressChips = root.querySelectorAll('.codex-progress-chip').length;
    const lockedCards = root.querySelectorAll('.codex-card--locked').length;

    return { tabs, cards, progressChips, lockedCards };
  });

  expect(result.tabs).toBe(3); // races / bosses / moments
  expect(result.progressChips).toBe(3); // 3 chips in header
  expect(result.cards).toBeGreaterThanOrEqual(13); // 13 race entries
  // All race cards are initially Locked (no triggers fired yet).
  expect(result.lockedCards).toBeGreaterThanOrEqual(13);
  expect(errors).toEqual([]);
});

test('Codex: render FCP under 300ms budget (spec §4.9)', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const timing = await page.evaluate(async () => {
    const codex = await import('/src/ui/codex.js');
    try { localStorage.removeItem('blocksworn_codex_state'); } catch (_e) { /* private mode */ }
    codex.__codexTestables.reset();
    const root = document.getElementById('screenCodex');

    const t0 = performance.now();
    codex.renderCodex(root);
    return performance.now() - t0;
  });

  // Spec §4.9 — page render budget ≤300ms. Reasonable headroom for CI noise.
  expect(timing).toBeLessThan(300);
});
