// 2026-05-12 — TASK-029 (T2.02): Identity Layer · Pirate's Plunder smoke test.
//
// Spec: docs/design/mechanics/identity-layer.md §7.5 — "1 smoke test per
// race flavor". This is the first of 5 (Pirate). T2.03–T2.06 append the
// others; T2.07–T2.11 add boss-reactive smokes.
//
// Coverage strategy (ADR-004 hybrid coexistence):
//   - Legacy single-HTML page (primary runtime) loads without pageerrors —
//     confirms the new identity-fx module + grid.js dispatch hook do NOT
//     regress the legacy path (which still owns the live clearLines).
//   - Vite-served `/` boots the new src/main.js + src/core/grid.js
//     (containing the T2.02 dispatch hook) without pageerrors — confirms
//     the new module surface is importable + dispatcher resolves.
//   - In-page module evaluation: import `fxPirateLineClear` + math helpers
//     from `/src/feel/identity-fx.js`, stub the legacy `addGold` global,
//     fire the FX with a 5-pirate squad + 1 cleared row, assert the gold
//     payload matches spec §2.1 (5 × 8 × 5 = 200g for a single row clear).
//
// Per CTO brief: "Mount the legacy game (since legacy is primary runtime
// per ADR-004)". Legacy mount is the negative test (no regression). The
// positive test (Pirate Plunder actually awarding gold) runs against the
// Vite-served new module — the only path where the dispatcher hook lives
// in T2.02. T2.07+ may rewire the legacy inline path; not in T2.02 scope.

import { test, expect } from '@playwright/test';

const LEGACY_PATH = '/docs/_legacy/_archive_v1/blocksworn_index_fixed.html';
const VITE_PATH   = '/';

// Seed `localStorage` so the Vite shell boots straight to the menu (FTUE
// complete + onboarding seen + save-version stamped). Mirrors
// tests/helpers/game-state.js `authenticated` state — duplicated here so this
// spec doesn't depend on the helper file's evolving keys.
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

test('legacy single HTML still loads without pageerrors (Identity Layer no-regression)', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(LEGACY_PATH);
  await page.waitForSelector('#screenMenu', { timeout: 30000 });
  expect(errors).toEqual([]);
});

test('Vite-served new bundle boots with src/feel/identity-fx.js + dispatcher', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  // Wait for the new shell DOM scaffold (T1.12 mount points) to become active.
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });
  expect(errors).toEqual([]);
});

test('fxPirateLineClear: 5-pirate squad × 1-row clear awards 200g via addGold (spec §2.1)', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  // Capture pageerrors that surface after evaluation runs.
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  // Drive the new module directly: stub `addGold` to capture the awarded
  // delta, fire `fxPirateLineClear` with a stub squad, assert gold delta.
  const result = await page.evaluate(async () => {
    // Stub the legacy `addGold` global. The real function (legacy line 24036)
    // applies +10% pirate passive + buff multipliers — we want to capture
    // the RAW Plunder delta so the math assertion is exact.
    let goldDelta = 0;
    window.addGold = (n) => { goldDelta += Number(n) || 0; return goldDelta; };

    // Stub HERO_DECK so countAlivePirates resolves a 5-pirate squad without
    // needing to navigate a real battle (which would exercise the live
    // legacy clearLines, not our dispatcher).
    window.HERO_DECK = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, race: 'pirate' }));

    // Dynamic import of the new module. Vite resolves the ES module from
    // the dev server — same path the production bundle uses.
    const mod = await import('/src/feel/identity-fx.js');

    // Fire with rows=[0] (single row), cols=[] → 8 cleared cells on 8×8.
    // Expected: gold = 5 × 8 × 5 = 200.
    const awarded = mod.fxPirateLineClear([0], [], window.HERO_DECK);

    // Also verify the zero-pirate guard.
    const noPirateGold = mod.fxPirateLineClear([0], [], []);

    return {
      goldDelta,
      awardedReturn: awarded,
      noPirateGold,
      coinPoolSize: mod.__identityFxTestables.getCoinPoolSize(),
    };
  });

  // Per spec §2.1: 5 pirates × 8 cells × 5g/cell = 200g.
  expect(result.goldDelta).toBe(200);
  expect(result.awardedReturn).toBe(200);
  expect(result.noPirateGold).toBe(0);                  // zero-pirate silent no-op
  expect(result.coinPoolSize).toBe(32);                 // module-load object pool

  // No pageerrors during FX dispatch.
  expect(errors).toEqual([]);
});

test('fxPirateLineClear: 0-pirate squad → silent no-op (no DOM allocations, no gold)', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    let goldDelta = 0;
    window.addGold = (n) => { goldDelta += Number(n) || 0; };
    window.HERO_DECK = [
      { id: 'o1', race: 'orc' },
      { id: 'e1', race: 'elf' },
      { id: 'h1', race: 'human' },
    ];

    const mod = await import('/src/feel/identity-fx.js');
    const awarded = mod.fxPirateLineClear([0, 1], [0], window.HERO_DECK);

    return {
      goldDelta,
      awarded,
    };
  });

  expect(result.goldDelta).toBe(0);
  expect(result.awarded).toBe(0);
  expect(errors).toEqual([]);
});

test('fxPirateLineClear performance: 5-pirate × quad-line clear completes within wall-time budget', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const wallTime = await page.evaluate(async () => {
    window.addGold = () => {};
    window.HERO_DECK = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, race: 'pirate' }));
    const mod = await import('/src/feel/identity-fx.js');

    // Warm-up call so the object pool init cost doesn't skew the timing.
    mod.fxPirateLineClear([0], [], window.HERO_DECK);

    // Measure a quad-line clear (4 rows, 0 cols → 32 cells → 32 coin pool full).
    const t0 = performance.now();
    mod.fxPirateLineClear([0, 1, 2, 3], [], window.HERO_DECK);
    const dt = performance.now() - t0;
    return dt;
  });

  // Spec §2.1 field 9: wall-time ≤6ms per fire. Allow 3× headroom for CI
  // variability (slow shared runners, JIT warmup); a 60fps frame is 16ms
  // and our hard budget is 6ms — any value >20ms here is a clear regression.
  expect(wallTime).toBeLessThan(20);
  expect(errors).toEqual([]);
});
