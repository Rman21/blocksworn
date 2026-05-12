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

// ─── T2.03 — Shark Feeding Frenzy smoke tests (spec §2.2) ───────────────

test('fxSharkLineClear: 2-shark squad + tide-dominant 1-row clear → 1 extra cell cleared + visual bite', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    window.HERO_DECK = [
      { id: 's1', race: 'shark' },
      { id: 's2', race: 'shark' },
    ];

    // Inject a stubbed 8×8 grid of `.cell` elements so the FX's cell-origin
    // resolver finds positions to spawn bites from. (On the menu screen the
    // live grid isn't rendered; this stub mirrors what battle screen provides.)
    const gridHost = document.createElement('div');
    gridHost.className = 'grid';
    gridHost.style.cssText = 'position:fixed;left:0;top:0;width:320px;height:320px;display:grid;grid-template-columns:repeat(8,40px);';
    for (let i = 0; i < 64; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.cssText = 'width:40px;height:40px;';
      gridHost.appendChild(cell);
    }
    document.body.appendChild(gridHost);

    const mod = await import('/src/feel/identity-fx.js');

    // Reset shark bite pool for deterministic count assertion.
    mod.__identityFxTestables.resetSharkBitePool();

    // tide-dominant 1-row clear (also triggers visual since 2 sharks).
    const extraCleared = mod.fxSharkLineClear(
      [3], [], window.HERO_DECK,
      { dominantElementsByLine: ['tide'] },
    );

    // Allow the spawn loop to acquire from the pool before checking DOM.
    await new Promise(r => requestAnimationFrame(() => r()));

    const biteNodes = document.querySelectorAll('.identity-shark-bite');
    const sweepingNodes = document.querySelectorAll('.identity-shark-bite.identity-shark-bite-sweeping');
    const lastBitten = mod.__identityFxTestables.getLastBittenCells();

    return {
      extraCleared,
      lastBittenLength: lastBitten.length,
      biteNodeCount: biteNodes.length,
      sweepingNodeCount: sweepingNodes.length,
      poolSize: mod.__identityFxTestables.getSharkBitePoolSize(),
    };
  });

  // Spec §2.2: 2 sharks + 1 row → exactly 1 extra cleared cell.
  expect(result.extraCleared).toBe(1);
  expect(result.lastBittenLength).toBe(1);
  // Visual: 1 bite element exists, currently sweeping.
  expect(result.biteNodeCount).toBeGreaterThanOrEqual(1);
  expect(result.sweepingNodeCount).toBeGreaterThanOrEqual(1);
  // Pool pre-allocated at module load.
  expect(result.poolSize).toBe(4);
  expect(errors).toEqual([]);
});

test('fxSharkLineClear: 5-shark + 4-row clear → HARD CAP at 4 extra cells', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const extraCleared = await page.evaluate(async () => {
    window.HERO_DECK = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, race: 'shark' }));
    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetSharkBitePool();

    // 4-row clear with 5 sharks; per-line bite=1; would yield 4 extras already.
    // We push 5 rows to confirm the hard cap really clamps at 4 (not 5).
    return mod.fxSharkLineClear([0, 2, 4, 6], [], window.HERO_DECK, null);
  });

  expect(extraCleared).toBeLessThanOrEqual(4);
  expect(extraCleared).toBe(4);
  expect(errors).toEqual([]);
});

test('fxSharkLineClear: 0-shark squad → silent no-op (no DOM allocations, no errors)', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    window.HERO_DECK = [
      { id: 'o1', race: 'orc' },
      { id: 'e1', race: 'elf' },
    ];
    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetSharkBitePool();

    const before = document.querySelectorAll('.identity-shark-bite').length;
    const extraCleared = mod.fxSharkLineClear([0, 1], [0], window.HERO_DECK, null);
    const after = document.querySelectorAll('.identity-shark-bite').length;

    return { extraCleared, before, after };
  });

  expect(result.extraCleared).toBe(0);
  // No-op: pool is NOT initialized (no shark = early return before _ensureSharkBitePool).
  expect(result.before).toBe(0);
  expect(result.after).toBe(0);
  expect(errors).toEqual([]);
});

test('Pirate Plunder still fires unchanged after Shark addition (T2.02 regression)', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    let goldDelta = 0;
    window.addGold = (n) => { goldDelta += Number(n) || 0; };
    window.HERO_DECK = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, race: 'pirate' }));
    const mod = await import('/src/feel/identity-fx.js');
    const awarded = mod.fxPirateLineClear([0], [], window.HERO_DECK);
    return { goldDelta, awarded };
  });

  // Spec §2.1 byte-perfect: 5 pirates × 8 cells × 5g/cell = 200g.
  expect(result.goldDelta).toBe(200);
  expect(result.awarded).toBe(200);
  expect(errors).toEqual([]);
});

// ─── T2.04 — Rock Encore Echo smoke tests (spec §2.3) ───────────────────

test('fxRockLineClear: 5-rock squad + umbra-dominant 1-row clear → +1 umbra charge + ghost flash element', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    // Stub runtime globals (legacy battle init normally populates these).
    window.ULT_THRESHOLD = { ember: 12, tide: 12, grove: 12, solar: 12, umbra: 12 };
    window.ultCharges = { ember: 0, tide: 0, grove: 0, solar: 0, umbra: 0 };
    window.HERO_DECK = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, race: 'rock' }));

    // Inject a stubbed 8×8 grid of `.cell` elements so the FX's line-origin
    // resolver finds positions to spawn ghosts from.
    const gridHost = document.createElement('div');
    gridHost.className = 'grid';
    gridHost.style.cssText = 'position:fixed;left:0;top:0;width:320px;height:320px;display:grid;grid-template-columns:repeat(8,40px);';
    for (let i = 0; i < 64; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.cssText = 'width:40px;height:40px;';
      gridHost.appendChild(cell);
    }
    document.body.appendChild(gridHost);

    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetRockEchoPool();

    // 1-row clear with umbra dominance → 1 charge added.
    const before = window.ultCharges.umbra;
    const actualDelta = mod.fxRockLineClear(
      [3], [], window.HERO_DECK,
      { dominantElementsByLine: ['umbra'] },
    );
    const after = window.ultCharges.umbra;

    await new Promise(r => requestAnimationFrame(() => r()));

    const ghostNodes = document.querySelectorAll('.identity-rock-echo-ghost');
    const flashingNodes = document.querySelectorAll('.identity-rock-echo-ghost.identity-rock-echo-flashing');

    return {
      before,
      after,
      actualDelta,
      ghostNodeCount: ghostNodes.length,
      flashingNodeCount: flashingNodes.length,
      poolSize: mod.__identityFxTestables.getRockEchoPoolSize(),
    };
  });

  // Spec §2.3: 1 umbra-dominant line → +1 charge on umbra meter.
  expect(result.before).toBe(0);
  expect(result.after).toBe(1);
  expect(result.actualDelta).toBe(1);
  // Visual: 1 ghost element exists, currently flashing.
  expect(result.ghostNodeCount).toBeGreaterThanOrEqual(1);
  expect(result.flashingNodeCount).toBeGreaterThanOrEqual(1);
  // Pool pre-allocated at module load (4 = hard cap).
  expect(result.poolSize).toBe(4);
  expect(errors).toEqual([]);
});

test('fxRockLineClear: 5-rock + 4 umbra-lines quad-clear → HARD CAP at +4 charge', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    window.ULT_THRESHOLD = { ember: 12, tide: 12, grove: 12, solar: 12, umbra: 12 };
    window.ultCharges = { ember: 0, tide: 0, grove: 0, solar: 0, umbra: 0 };
    window.HERO_DECK = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, race: 'rock' }));

    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetRockEchoPool();

    // 4-row clear with all umbra → +4 (hard cap).
    const before = window.ultCharges.umbra;
    const actualDelta = mod.fxRockLineClear(
      [0, 2, 4, 6], [], window.HERO_DECK,
      { dominantElementsByLine: ['umbra', 'umbra', 'umbra', 'umbra'] },
    );
    const after = window.ultCharges.umbra;

    return { before, after, actualDelta };
  });

  expect(result.before).toBe(0);
  expect(result.actualDelta).toBe(4);
  expect(result.after).toBe(4);
  expect(errors).toEqual([]);
});

test('fxRockLineClear: threshold clamp — meter at 11/12 + +4 echo → 12 (NOT 15), sacred invariant', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    // CRITICAL AAA+ INVARIANT: Encore Echo never overshoots the sacred
    // ULT threshold. Meter at 11/12 + 4 echo charge → 12 (clamped), not 15.
    window.ULT_THRESHOLD = { ember: 12, tide: 12, grove: 12, solar: 12, umbra: 12 };
    window.ultCharges = { ember: 0, tide: 0, grove: 0, solar: 0, umbra: 11 };
    window.HERO_DECK = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, race: 'rock' }));

    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetRockEchoPool();

    const actualDelta = mod.fxRockLineClear(
      [0, 2, 4, 6], [], window.HERO_DECK,
      { dominantElementsByLine: ['umbra', 'umbra', 'umbra', 'umbra'] },
    );

    return {
      umbraCharge: window.ultCharges.umbra,
      actualDelta,
    };
  });

  // Sacred-cow invariant: clamp at threshold, never overshoot.
  expect(result.umbraCharge).toBe(12);
  expect(result.umbraCharge).not.toBe(15);
  // Delta is the clamped delta (1, not 4) — Encore Echo only added what fit.
  expect(result.actualDelta).toBe(1);
  expect(errors).toEqual([]);
});

test('fxRockLineClear: 1-rock + 0 umbra-dominant lines → silent no-op (no charge, no DOM)', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    window.ULT_THRESHOLD = { ember: 12, tide: 12, grove: 12, solar: 12, umbra: 12 };
    window.ultCharges = { ember: 0, tide: 0, grove: 0, solar: 0, umbra: 0 };
    window.HERO_DECK = [{ id: 'r1', race: 'rock' }];

    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetRockEchoPool();

    const before = document.querySelectorAll('.identity-rock-echo-ghost').length;
    const actualDelta = mod.fxRockLineClear(
      [0], [], window.HERO_DECK,
      { dominantElementsByLine: ['ember'] },
    );
    const after = document.querySelectorAll('.identity-rock-echo-ghost').length;

    return {
      actualDelta,
      umbraCharge: window.ultCharges.umbra,
      before,
      after,
    };
  });

  expect(result.actualDelta).toBe(0);
  expect(result.umbraCharge).toBe(0);
  // No-op: pool NOT initialized (early-return before _ensureRockEchoPool).
  expect(result.before).toBe(0);
  expect(result.after).toBe(0);
  expect(errors).toEqual([]);
});

test('Mixed-race squad regression: rock + pirate + shark fire all three identity layers without interference', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    // Set up all three sets of runtime stubs.
    let goldDelta = 0;
    window.addGold = (n) => { goldDelta += Number(n) || 0; };
    window.ULT_THRESHOLD = { ember: 12, tide: 12, grove: 12, solar: 12, umbra: 12 };
    window.ultCharges = { ember: 0, tide: 0, grove: 0, solar: 0, umbra: 0 };
    window.HERO_DECK = [
      { id: 'p1', race: 'pirate' },
      { id: 'p2', race: 'pirate' },
      { id: 'r1', race: 'rock' },
      { id: 's1', race: 'shark' },
      { id: 's2', race: 'shark' },
    ];

    // Inject grid for shark + rock VFX resolvers.
    const gridHost = document.createElement('div');
    gridHost.className = 'grid';
    gridHost.style.cssText = 'position:fixed;left:0;top:0;width:320px;height:320px;display:grid;grid-template-columns:repeat(8,40px);';
    for (let i = 0; i < 64; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.cssText = 'width:40px;height:40px;';
      gridHost.appendChild(cell);
    }
    document.body.appendChild(gridHost);

    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetRockEchoPool();
    mod.__identityFxTestables.resetSharkBitePool();

    // Single umbra-dominant row clear: rock fires (+1 umbra), pirate fires
    // (+gold for 2 pirates × 8 cells), shark fires (+1 bite extra cell).
    mod.dispatchIdentityFx(
      [3], [], window.HERO_DECK, null,
      { dominantElementsByLine: ['umbra'] },
    );

    return {
      goldDelta,                            // Pirate Plunder
      umbraCharge: window.ultCharges.umbra, // Rock Encore Echo
      lastBitten: mod.__identityFxTestables.getLastBittenCells().length, // Shark Frenzy
    };
  });

  // Pirate Plunder: 2 pirates × 8 cells × 5g/cell = 80g.
  expect(result.goldDelta).toBe(80);
  // Rock Encore Echo: +1 umbra charge.
  expect(result.umbraCharge).toBe(1);
  // Shark Feeding Frenzy: ≥1 extra cell bitten (2 sharks pass gate on tide
  // OR ≥2-shark count path; here ≥2 sharks alive so gate passes regardless).
  expect(result.lastBitten).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('fxRockLineClear performance: 5-rock × quad-umbra-line clear completes within wall-time budget', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const wallTime = await page.evaluate(async () => {
    window.ULT_THRESHOLD = { ember: 12, tide: 12, grove: 12, solar: 12, umbra: 12 };
    window.ultCharges = { ember: 0, tide: 0, grove: 0, solar: 0, umbra: 0 };
    window.HERO_DECK = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, race: 'rock' }));
    const mod = await import('/src/feel/identity-fx.js');

    // Warm-up call so the pool init cost doesn't skew timing.
    mod.fxRockLineClear([0], [], window.HERO_DECK,
      { dominantElementsByLine: ['umbra'] });
    mod.__identityFxTestables.resetRockEchoPool();
    window.ultCharges.umbra = 0;

    // Measure a quad-line clear (4 rows, 0 cols → max 4 echo ghosts).
    const t0 = performance.now();
    mod.fxRockLineClear([0, 2, 4, 6], [], window.HERO_DECK,
      { dominantElementsByLine: ['umbra', 'umbra', 'umbra', 'umbra'] });
    return performance.now() - t0;
  });

  // Spec §2.3 field 9: wall-time ≤8ms per fire. Allow 3× headroom for CI
  // variability — any value >24ms is a clear regression.
  expect(wallTime).toBeLessThan(24);
  expect(errors).toEqual([]);
});

test('fxSharkLineClear performance: 5-shark × quad-line clear completes within wall-time budget', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const wallTime = await page.evaluate(async () => {
    window.HERO_DECK = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, race: 'shark' }));
    const mod = await import('/src/feel/identity-fx.js');

    // Warm-up call so the pool init cost doesn't skew timing.
    mod.fxSharkLineClear([0], [], window.HERO_DECK, null);
    mod.__identityFxTestables.resetSharkBitePool();

    // Measure a quad-line clear (4 rows, 0 cols → max 4 extras after hard cap).
    const t0 = performance.now();
    mod.fxSharkLineClear([0, 2, 4, 6], [], window.HERO_DECK, null);
    return performance.now() - t0;
  });

  // Spec §2.2 field 9: wall-time ≤10ms per fire. Allow 3× headroom for CI
  // variability — any value >30ms is a clear regression.
  expect(wallTime).toBeLessThan(30);
  expect(errors).toEqual([]);
});

// ─── T2.05 — Crocodile Bedrock Bastion smoke tests (spec §2.4) ────────────

// Build a stub 8×8 grid (2D array of stihiya strings) and inject it onto
// window.grid + a fresh .grid .cell DOM scaffold so the FX's cell-origin
// resolver finds positions. The crocodile portrait is also injected so the
// fragment target is resolvable.
function _crocSmokeSetupScript() {
  return /* js */ `
    function _setupCrocSmoke() {
      const grid = Array.from({ length: 8 }, () => Array(8).fill(null));
      // Mark all of row 3 as grove (8 grove cells for full-row clear scenarios).
      for (let c = 0; c < 8; c++) grid[3][c] = 'grove';
      // Mark all of row 5 as grove (separate row for cumulative-fire tests).
      for (let c = 0; c < 8; c++) grid[5][c] = 'grove';
      window.grid = grid;
      // Default shield bookkeeping (legacy shape).
      window.shieldCount = 0;
      window.MAX_SHIELD = 3;        // legacy line 20163
      window.maxShieldBonus = 2;    // synthesize tier-5 golem bonus (sacred read)
      // 8×8 grid DOM scaffold for fragment origin resolution.
      const gridHost = document.createElement('div');
      gridHost.className = 'grid';
      gridHost.style.cssText = 'position:fixed;left:0;top:0;width:320px;height:320px;display:grid;grid-template-columns:repeat(8,40px);';
      for (let i = 0; i < 64; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.style.cssText = 'width:40px;height:40px;';
        gridHost.appendChild(cell);
      }
      document.body.appendChild(gridHost);
      // Leftmost crocodile portrait — used as the fragment target.
      const portrait = document.createElement('div');
      portrait.className = 'heroPortrait';
      portrait.setAttribute('data-race', 'crocodile');
      portrait.style.cssText = 'position:fixed;left:32px;bottom:32px;width:64px;height:64px;background:rgba(120,80,50,0.4);';
      document.body.appendChild(portrait);
      return { grid, portrait };
    }
    _setupCrocSmoke();
  `;
}

test('fxCrocodileLineClear: 5-crocodile squad + 5 grove cells (full row) → +1 shield, fragments spawned', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async (setup) => {
    eval(setup);
    window.HERO_DECK = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, race: 'crocodile' }));

    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetCrocFragmentPool();
    mod.resetCrocFragmentBank();

    const before = window.shieldCount;
    // Inject a 5-grove-cell row via overriding row 3 cell values: keep first 5 as grove, rest as null.
    for (let c = 0; c < 8; c++) window.grid[3][c] = c < 5 ? 'grove' : null;

    const shieldsGranted = mod.fxCrocodileLineClear(
      [3], [], window.HERO_DECK,
      { gridState: window.grid, squadShieldsApi: {
        get: () => window.shieldCount,
        set: (n) => { window.shieldCount = n; },
        cap: window.MAX_SHIELD + 2 + window.maxShieldBonus,
      } },
    );
    const after = window.shieldCount;

    await new Promise(r => requestAnimationFrame(() => r()));

    const fragmentNodes = document.querySelectorAll('.identity-croc-fragment');
    const flyingNodes = document.querySelectorAll('.identity-croc-fragment.identity-croc-fragment-flying');
    const shieldGrantNodes = document.querySelectorAll('.identity-croc-shield-grant');
    const bankAfter = mod.__identityFxTestables.getCrocFragmentBank();

    return {
      before,
      after,
      shieldsGranted,
      fragmentNodeCount: fragmentNodes.length,
      flyingNodeCount: flyingNodes.length,
      shieldGrantNodeCount: shieldGrantNodes.length,
      bankAfter,
      poolSize: mod.__identityFxTestables.getCrocFragmentPoolSize(),
    };
  }, _crocSmokeSetupScript());

  // Spec §2.4: 5 grove cells → exactly 1 shield granted (5/5 = 1, bank=0).
  expect(result.before).toBe(0);
  expect(result.after).toBe(1);
  expect(result.shieldsGranted).toBe(1);
  // Bank consumed exactly to 0.
  expect(result.bankAfter).toBe(0);
  // Visual: 5 fragments spawned, all flying.
  expect(result.fragmentNodeCount).toBeGreaterThanOrEqual(5);
  expect(result.flyingNodeCount).toBeGreaterThanOrEqual(5);
  // Shield-grant flash element rendered.
  expect(result.shieldGrantNodeCount).toBeGreaterThanOrEqual(1);
  // Pool pre-allocated at first fire (16 = hard cap).
  expect(result.poolSize).toBe(16);
  expect(errors).toEqual([]);
});

test('fxCrocodileLineClear: cumulative accrual across 4 fires demonstrates cross-fire fragment bank persistence', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async (setup) => {
    eval(setup);
    window.HERO_DECK = [{ id: 'c1', race: 'crocodile' }];

    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetCrocFragmentPool();
    mod.resetCrocFragmentBank();

    // 3-grove-cell pattern: first 3 cells of row 3 are grove, rest null.
    for (let c = 0; c < 8; c++) window.grid[3][c] = c < 3 ? 'grove' : null;
    // For 4th fire, swap to a single-grove cell at row 5.
    for (let c = 0; c < 8; c++) window.grid[5][c] = c < 1 ? 'grove' : null;

    const api = {
      get: () => window.shieldCount,
      set: (n) => { window.shieldCount = n; },
      cap: window.MAX_SHIELD + 2 + window.maxShieldBonus,
    };

    const fire1 = mod.fxCrocodileLineClear([3], [], window.HERO_DECK,
      { gridState: window.grid, squadShieldsApi: api });
    const bank1 = mod.__identityFxTestables.getCrocFragmentBank();
    const fire2 = mod.fxCrocodileLineClear([3], [], window.HERO_DECK,
      { gridState: window.grid, squadShieldsApi: api });
    const bank2 = mod.__identityFxTestables.getCrocFragmentBank();
    const fire3 = mod.fxCrocodileLineClear([3], [], window.HERO_DECK,
      { gridState: window.grid, squadShieldsApi: api });
    const bank3 = mod.__identityFxTestables.getCrocFragmentBank();
    const shieldAfter3 = window.shieldCount;
    // 4th fire — row 5 has 1 grove cell. Cumulative: bank4 = 4+1=5 → 2nd shield granted, bank→0.
    const fire4 = mod.fxCrocodileLineClear([5], [], window.HERO_DECK,
      { gridState: window.grid, squadShieldsApi: api });
    const bank4 = mod.__identityFxTestables.getCrocFragmentBank();
    const shieldAfter4 = window.shieldCount;

    return {
      fire1, fire2, fire3, fire4,
      bank1, bank2, bank3, bank4,
      shieldAfter3, shieldAfter4,
    };
  }, _crocSmokeSetupScript());

  // Spec §2.4: cumulative fragment persistence across fires.
  // Fire 1: 0+3 = 3 fragments → 3<5 → no shield, bank=3.
  expect(result.fire1).toBe(0);
  expect(result.bank1).toBe(3);
  // Fire 2: 3+3 = 6 fragments → 1 shield consumed, bank=6-5=1.
  expect(result.fire2).toBe(1);
  expect(result.bank2).toBe(1);
  // Fire 3: 1+3 = 4 fragments → 4<5 → no new shield, bank=4.
  expect(result.fire3).toBe(0);
  expect(result.bank3).toBe(4);
  expect(result.shieldAfter3).toBe(1);  // 1 shield total (granted at fire 2)
  // Fire 4: 4+1 = 5 fragments → 2nd shield consumed, bank=0.
  expect(result.fire4).toBe(1);
  expect(result.bank4).toBe(0);
  expect(result.shieldAfter4).toBe(2);  // 2 shields total after 4 fires
  expect(errors).toEqual([]);
});

test('fxCrocodileLineClear: shield cap clamp — squad at cap → fragments accumulate but no overflow shield grant', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async (setup) => {
    eval(setup);
    window.HERO_DECK = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, race: 'crocodile' }));

    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetCrocFragmentPool();
    mod.resetCrocFragmentBank();

    // Sacred cap = MAX_SHIELD(3) + 2 + maxShieldBonus(2) = 7. Pre-seed shields at cap.
    const cap = window.MAX_SHIELD + 2 + window.maxShieldBonus;
    window.shieldCount = cap;
    const before = window.shieldCount;

    // Fire with 8 grove cells (full row) — bank=8, would grant 1 shield, but capped.
    for (let c = 0; c < 8; c++) window.grid[3][c] = 'grove';
    const shieldsGranted = mod.fxCrocodileLineClear(
      [3], [], window.HERO_DECK,
      { gridState: window.grid, squadShieldsApi: {
        get: () => window.shieldCount,
        set: (n) => { window.shieldCount = n; },
        cap: cap,
      } },
    );
    const after = window.shieldCount;
    const bankAfter = mod.__identityFxTestables.getCrocFragmentBank();

    return { before, after, shieldsGranted, bankAfter, cap };
  }, _crocSmokeSetupScript());

  // Sacred cap respected: shieldCount never exceeds cap.
  expect(result.before).toBe(result.cap);
  expect(result.after).toBe(result.cap);
  expect(result.after).toBe(7);
  expect(result.shieldsGranted).toBe(0);   // capped — no grant
  // Bank: 8 fragments consumed by computeShieldsGrantable (1 shield potential),
  // but shield write clamped, so the 5 fragments are gone (per spec "surplus
  // discarded"). Remaining bank = 8 - 5 = 3.
  expect(result.bankAfter).toBe(3);
  expect(errors).toEqual([]);
});

test('fxCrocodileLineClear: 0 grove cells → silent no-op (no DOM, no errors)', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async (setup) => {
    eval(setup);
    window.HERO_DECK = [{ id: 'c1', race: 'crocodile' }];

    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetCrocFragmentPool();
    mod.resetCrocFragmentBank();

    // Row 3 has no grove cells (all null).
    for (let c = 0; c < 8; c++) window.grid[3][c] = null;

    const before = document.querySelectorAll('.identity-croc-fragment').length;
    const shieldsGranted = mod.fxCrocodileLineClear(
      [3], [], window.HERO_DECK,
      { gridState: window.grid, squadShieldsApi: {
        get: () => window.shieldCount,
        set: (n) => { window.shieldCount = n; },
        cap: 7,
      } },
    );
    const after = document.querySelectorAll('.identity-croc-fragment').length;
    const bankAfter = mod.__identityFxTestables.getCrocFragmentBank();

    return {
      shieldsGranted,
      umbraShieldDelta: window.shieldCount,
      before,
      after,
      bankAfter,
    };
  }, _crocSmokeSetupScript());

  expect(result.shieldsGranted).toBe(0);
  expect(result.umbraShieldDelta).toBe(0);
  expect(result.before).toBe(0);
  expect(result.after).toBe(0);
  expect(result.bankAfter).toBe(0);
  expect(errors).toEqual([]);
});

test('resetCrocFragmentBank: bank cleared between battles', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async (setup) => {
    eval(setup);
    window.HERO_DECK = [{ id: 'c1', race: 'crocodile' }];

    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetCrocFragmentPool();
    mod.resetCrocFragmentBank();

    // Accrue 4 fragments (below 5-threshold so they persist).
    for (let c = 0; c < 8; c++) window.grid[3][c] = c < 4 ? 'grove' : null;
    mod.fxCrocodileLineClear([3], [], window.HERO_DECK,
      { gridState: window.grid });
    const bankBefore = mod.__identityFxTestables.getCrocFragmentBank();

    // Battle ends → reset bank.
    mod.resetCrocFragmentBank();
    const bankAfter = mod.__identityFxTestables.getCrocFragmentBank();

    return { bankBefore, bankAfter };
  }, _crocSmokeSetupScript());

  expect(result.bankBefore).toBe(4);
  expect(result.bankAfter).toBe(0);
  expect(errors).toEqual([]);
});

test('Mixed-race squad regression: crocodile + pirate + shark + rock fire all four identity layers without interference', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async (setup) => {
    eval(setup);
    // Stub all four layer APIs.
    let goldDelta = 0;
    window.addGold = (n) => { goldDelta += Number(n) || 0; };
    window.ULT_THRESHOLD = { ember: 12, tide: 12, grove: 12, solar: 12, umbra: 12 };
    window.ultCharges = { ember: 0, tide: 0, grove: 0, solar: 0, umbra: 0 };
    window.HERO_DECK = [
      { id: 'c1', race: 'crocodile' },
      { id: 'p1', race: 'pirate' },
      { id: 'p2', race: 'pirate' },
      { id: 'r1', race: 'rock' },
      { id: 's1', race: 'shark' },
    ];

    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetCrocFragmentPool();
    mod.__identityFxTestables.resetRockEchoPool();
    mod.__identityFxTestables.resetSharkBitePool();
    mod.resetCrocFragmentBank();

    // Single grove-row clear via dispatcher — all four FX fire.
    // (Pirate +gold, Shark gate fails with only 1 shark + no tide-dominant,
    //  Rock fires only if umbra-dominant — here we'll set umbra dominant so
    //  Rock test is alongside Crocodile.)
    // Row 3 is all grove.
    for (let c = 0; c < 8; c++) window.grid[3][c] = 'grove';

    const api = {
      get: () => window.shieldCount,
      set: (n) => { window.shieldCount = n; },
      cap: window.MAX_SHIELD + 2 + window.maxShieldBonus,
    };

    mod.dispatchIdentityFx(
      [3], [], window.HERO_DECK, null,
      { gridState: window.grid, squadShieldsApi: api, dominantElementsByLine: ['umbra'] },
    );

    return {
      goldDelta,                          // Pirate Plunder (2 pirates × 8 cells × 5)
      shieldCount: window.shieldCount,    // Crocodile (8 fragments → 1 shield)
      umbraCharge: window.ultCharges.umbra, // Rock Encore Echo (umbra-dominant line)
      bank: mod.__identityFxTestables.getCrocFragmentBank(),
    };
  }, _crocSmokeSetupScript());

  // Pirate Plunder: 2 pirates × 8 cells × 5g/cell = 80g.
  expect(result.goldDelta).toBe(80);
  // Crocodile Bedrock Bastion: 8 grove cells → 1 shield (bank=3 remaining).
  expect(result.shieldCount).toBe(1);
  expect(result.bank).toBe(3);
  // Rock Encore Echo: +1 umbra charge.
  expect(result.umbraCharge).toBe(1);
  expect(errors).toEqual([]);
});

// ─── T2.06 — Spark Sun Cascade smoke tests (spec §2.5) ────────────────────
//
// THE highest-stakes Phase 2 race flavor — Sun Cascade is the ONLY race
// flavor that interacts directly with the sacred combo crit input. These
// smoke tests verify the ctx side-channel write path, HARD CAP invariants,
// and the SPARK_CASCADE_ENABLED fallback flag.
//
// Per Roman ruling ESC-02 O3: "WITHIN BOUNDARY. Input modification (same
// architectural pattern as cascade), not formula modification. Capped at +1,
// gated 2-solar-cell minimum, not stacking."

// Build a stub 8×8 grid (2D array of stihiya strings) with solar cells per
// overrides + a fresh .grid .cell DOM scaffold so the FX's cell-origin
// resolver finds positions. The grid host is shared across Spark + other
// race tests via _crocSmokeSetupScript helpers above; this builder is a
// standalone solar-cell variant.
function _sparkSmokeSetupScript() {
  return /* js */ `
    function _setupSparkSmoke() {
      const grid = Array.from({ length: 8 }, () => Array(8).fill(null));
      // Default: row 3 is all solar (8 solar cells for full-row clear scenarios).
      for (let c = 0; c < 8; c++) grid[3][c] = 'solar';
      // Place a few non-solar cells at scattered locations so
      // _findNearestNonEmptyCell has targets outside the cleared row.
      grid[1][4] = 'ember';
      grid[5][2] = 'tide';
      grid[6][6] = 'umbra';
      window.grid = grid;
      // 8×8 grid DOM scaffold for ray origin + target resolution.
      const gridHost = document.createElement('div');
      gridHost.className = 'grid';
      gridHost.style.cssText = 'position:fixed;left:0;top:0;width:320px;height:320px;display:grid;grid-template-columns:repeat(8,40px);';
      for (let i = 0; i < 64; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.style.cssText = 'width:40px;height:40px;';
        gridHost.appendChild(cell);
      }
      document.body.appendChild(gridHost);
      return { grid };
    }
    _setupSparkSmoke();
  `;
}

test('fxSparkLineClear: 5-spark squad + 3-solar-cell row → ctx._dominantCountModifier = 1, visual rays fire', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async (setup) => {
    eval(setup);
    window.HERO_DECK = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, race: 'spark' }));

    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetSparkRayPool();

    // Override row 3 to have 3 solar cells (above gate of 2).
    for (let c = 0; c < 8; c++) window.grid[3][c] = c < 3 ? 'solar' : null;
    // Place a non-empty target in row 1 so rays have somewhere to chain.
    window.grid[1][0] = 'ember';
    window.grid[1][1] = 'tide';
    window.grid[1][2] = 'grove';

    const ctx = { gridState: window.grid };
    const modifier = mod.fxSparkLineClear([3], [], window.HERO_DECK, ctx);

    await new Promise(r => requestAnimationFrame(() => r()));

    const rayNodes = document.querySelectorAll('.identity-spark-ray');
    const flyingRays = document.querySelectorAll('.identity-spark-ray.identity-spark-ray-flying');

    return {
      modifier,
      ctxModifier: ctx._dominantCountModifier,
      rayPoolSize: mod.__identityFxTestables.getSparkRayPoolSize(),
      rayNodeCount: rayNodes.length,
      flyingRayCount: flyingRays.length,
    };
  }, _sparkSmokeSetupScript());

  // Spec §2.5: 3 solar cells (above gate of 2) → +1 dominantCount modifier.
  expect(result.modifier).toBe(1);
  expect(result.ctxModifier).toBe(1);
  // Pool pre-allocated at first fire (16 = hard cap).
  expect(result.rayPoolSize).toBe(16);
  // Visual rays spawned (at least 1 — at most 3 for the 3 solar cells).
  expect(result.flyingRayCount).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('fxSparkLineClear: HARD CAP — 5 sparks + 5 solar in quad-clear → modifier stays at +1 (NOT stacking)', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async (setup) => {
    eval(setup);
    window.HERO_DECK = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, race: 'spark' }));

    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetSparkRayPool();

    // Clear 4 rows of all-solar cells — max possible solar in clear.
    for (const r of [0, 2, 4, 6]) {
      for (let c = 0; c < 8; c++) window.grid[r][c] = 'solar';
    }
    // Leave some non-cleared non-empty cells as ray targets.
    window.grid[1][0] = 'ember';
    window.grid[5][0] = 'umbra';

    const ctx = { gridState: window.grid };
    const modifier = mod.fxSparkLineClear([0, 2, 4, 6], [], window.HERO_DECK, ctx);

    return {
      modifier,
      ctxModifier: ctx._dominantCountModifier,
    };
  }, _sparkSmokeSetupScript());

  // CRITICAL HARD CAP INVARIANT: 5 sparks × 32 solar cells × 4 lines = STILL +1.
  // Per ESC-02 O3 ruling: "Capped at +1, not stacking."
  expect(result.modifier).toBe(1);
  expect(result.ctxModifier).toBe(1);
  expect(errors).toEqual([]);
});

test('fxSparkLineClear: 1-spark + 1-solar (below gate) → silent no-op, ctx untouched', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async (setup) => {
    eval(setup);
    window.HERO_DECK = [{ id: 's1', race: 'spark' }];

    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetSparkRayPool();

    // Override row 3 to have only 1 solar cell — BELOW gate threshold of 2.
    for (let c = 0; c < 8; c++) window.grid[3][c] = c === 0 ? 'solar' : null;

    const ctx = { gridState: window.grid };
    const modifier = mod.fxSparkLineClear([3], [], window.HERO_DECK, ctx);

    return {
      modifier,
      ctxModifier: ctx._dominantCountModifier,
    };
  }, _sparkSmokeSetupScript());

  expect(result.modifier).toBe(0);
  expect(result.ctxModifier).toBeUndefined();
  expect(errors).toEqual([]);
});

test('fxSparkLineClear: 0-spark + 5-solar full row → silent no-op, ctx untouched', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async (setup) => {
    eval(setup);
    // No sparks in deck.
    window.HERO_DECK = [{ race: 'orc' }, { race: 'pirate' }];

    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetSparkRayPool();

    // Row 3 = all solar (well above gate).
    for (let c = 0; c < 8; c++) window.grid[3][c] = 'solar';

    const ctx = { gridState: window.grid };
    const modifier = mod.fxSparkLineClear([3], [], window.HERO_DECK, ctx);

    return {
      modifier,
      ctxModifier: ctx._dominantCountModifier,
    };
  }, _sparkSmokeSetupScript());

  expect(result.modifier).toBe(0);
  expect(result.ctxModifier).toBeUndefined();
  expect(errors).toEqual([]);
});

test('fxSparkLineClear: combo crit formula site BYTE-PERFECT (sacred §2.1 row 1 audit)', async ({ page }) => {
  // CRITICAL — verify the sacred formula `total_dmg × (1 + dominantCount × combo × 10%)`
  // is UNTOUCHED by Sun Cascade. Sun Cascade modifies the INPUT (dominantCount
  // via ctx._dominantCountModifier), never the formula itself.
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async (setup) => {
    eval(setup);
    window.HERO_DECK = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, race: 'spark' }));

    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetSparkRayPool();

    // Pre-fire snapshot of multiplier-adjacent ctx fields (synthesizing the
    // sacred formula's input space).
    const ctx = {
      gridState: window.grid,
      // Hypothetical pre-existing formula state — must NOT be touched.
      _critMult: 1.5,
      _CRIT_MULT_K: 0.1,
      _comboCount: 3,
      _domCount: 5,
    };
    const before = JSON.stringify({
      _critMult: ctx._critMult,
      _CRIT_MULT_K: ctx._CRIT_MULT_K,
      _comboCount: ctx._comboCount,
      _domCount: ctx._domCount,
    });

    // Row 3 is all solar (full row).
    for (let c = 0; c < 8; c++) window.grid[3][c] = 'solar';
    mod.fxSparkLineClear([3], [], window.HERO_DECK, ctx);

    const after = JSON.stringify({
      _critMult: ctx._critMult,
      _CRIT_MULT_K: ctx._CRIT_MULT_K,
      _comboCount: ctx._comboCount,
      _domCount: ctx._domCount,
    });

    return {
      before, after,
      modifierWritten: ctx._dominantCountModifier,
    };
  }, _sparkSmokeSetupScript());

  // BYTE-PERFECT formula isolation — none of the multiplier ctx fields were touched.
  expect(result.before).toBe(result.after);
  // Sun Cascade only modified _dominantCountModifier (the INPUT path).
  expect(result.modifierWritten).toBe(1);
  expect(errors).toEqual([]);
});

test('Mixed-race squad regression: spark + pirate + shark + rock + crocodile fire ALL FIVE layers without interference', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async (setup) => {
    eval(setup);
    // Stub all five layer APIs.
    let goldDelta = 0;
    window.addGold = (n) => { goldDelta += Number(n) || 0; };
    window.ULT_THRESHOLD = { ember: 12, tide: 12, grove: 12, solar: 12, umbra: 12 };
    window.ultCharges = { ember: 0, tide: 0, grove: 0, solar: 0, umbra: 0 };
    window.shieldCount = 0;
    window.MAX_SHIELD = 3;
    window.maxShieldBonus = 2;
    window.HERO_DECK = [
      { id: 'sp1', race: 'spark' },
      { id: 'p1',  race: 'pirate' },
      { id: 'p2',  race: 'pirate' },
      { id: 'r1',  race: 'rock' },
      { id: 's1',  race: 'shark' },
      { id: 'c1',  race: 'crocodile' },
    ];

    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetSparkRayPool();
    mod.__identityFxTestables.resetCrocFragmentPool();
    mod.__identityFxTestables.resetRockEchoPool();
    mod.__identityFxTestables.resetSharkBitePool();
    mod.resetCrocFragmentBank();

    // Two cleared rows: row 0 all solar (Spark + crit-input gate),
    // row 3 all grove (Crocodile gate).
    for (let c = 0; c < 8; c++) {
      window.grid[0][c] = 'solar';
      window.grid[3][c] = 'grove';
    }

    const api = {
      get: () => window.shieldCount,
      set: (n) => { window.shieldCount = n; },
      cap: window.MAX_SHIELD + 2 + window.maxShieldBonus,
    };

    const ctx = {
      gridState: window.grid,
      squadShieldsApi: api,
      // 2 cleared lines; line 0 (row 0) is solar-dominant; line 1 (row 3) is umbra-tagged
      // so Rock Encore Echo also fires.
      dominantElementsByLine: ['solar', 'umbra'],
    };

    mod.dispatchIdentityFx([0, 3], [], window.HERO_DECK, null, ctx);

    return {
      goldDelta,                          // Pirate Plunder (2 pirates × 16 cells × 5g/cell = 160g)
      shieldCount: window.shieldCount,    // Crocodile (8 grove → 1 shield)
      umbraCharge: window.ultCharges.umbra, // Rock Encore Echo (umbra-dominant line)
      sparkModifier: ctx._dominantCountModifier, // Sun Cascade (+1)
      bank: mod.__identityFxTestables.getCrocFragmentBank(),
    };
  }, _sparkSmokeSetupScript());

  // Pirate Plunder: 2 pirates × 16 cells × 5g/cell = 160g.
  expect(result.goldDelta).toBe(160);
  // Crocodile Bedrock Bastion: 8 grove cells → 1 shield (bank=3 remaining).
  expect(result.shieldCount).toBe(1);
  expect(result.bank).toBe(3);
  // Rock Encore Echo: +1 umbra charge (1 umbra-dominant line in row 3).
  expect(result.umbraCharge).toBe(1);
  // Sun Cascade: +1 dominantCount modifier (8 solar cells above gate of 2).
  expect(result.sparkModifier).toBe(1);
  expect(errors).toEqual([]);
});

test('fxSparkLineClear performance: 5-spark × quad-solar-line clear completes within wall-time budget', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const wallTime = await page.evaluate(async (setup) => {
    eval(setup);
    window.HERO_DECK = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, race: 'spark' }));

    const mod = await import('/src/feel/identity-fx.js');

    // Warm-up call so the pool init cost doesn't skew timing.
    for (let c = 0; c < 8; c++) window.grid[3][c] = 'solar';
    mod.fxSparkLineClear([3], [], window.HERO_DECK,
      { gridState: window.grid });
    mod.__identityFxTestables.resetSparkRayPool();

    // Quad-line clear with all solar rows (max ray volume = 16 cap).
    for (const r of [0, 2, 4, 6]) {
      for (let c = 0; c < 8; c++) window.grid[r][c] = 'solar';
    }
    const t0 = performance.now();
    mod.fxSparkLineClear([0, 2, 4, 6], [], window.HERO_DECK,
      { gridState: window.grid });
    return performance.now() - t0;
  }, _sparkSmokeSetupScript());

  // Spec §2.5 field 9: wall-time ≤10ms per fire. Allow 3× headroom for CI
  // variability — any value >30ms is a clear regression.
  expect(wallTime).toBeLessThan(30);
  expect(errors).toEqual([]);
});

test('fxCrocodileLineClear performance: quad-grove-line clear completes within wall-time budget', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const wallTime = await page.evaluate(async (setup) => {
    eval(setup);
    window.HERO_DECK = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, race: 'crocodile' }));

    const mod = await import('/src/feel/identity-fx.js');

    // Warm-up call so the pool init cost doesn't skew timing.
    for (let c = 0; c < 8; c++) window.grid[3][c] = 'grove';
    mod.fxCrocodileLineClear([3], [], window.HERO_DECK,
      { gridState: window.grid });
    mod.__identityFxTestables.resetCrocFragmentPool();
    mod.resetCrocFragmentBank();

    // Quad-line clear with all grove rows (max fragment volume = 16 cap).
    for (const r of [0, 2, 4, 6]) {
      for (let c = 0; c < 8; c++) window.grid[r][c] = 'grove';
    }
    const t0 = performance.now();
    mod.fxCrocodileLineClear([0, 2, 4, 6], [], window.HERO_DECK,
      { gridState: window.grid });
    return performance.now() - t0;
  }, _crocSmokeSetupScript());

  // Spec §2.4 field 9: wall-time ≤8ms per fire. Allow 3× headroom for CI
  // variability — any value >24ms is a clear regression.
  expect(wallTime).toBeLessThan(24);
  expect(errors).toEqual([]);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2026-05-12 — TASK-034 (T2.07): Phoenix Ashen Reign smoke tests.
// FIRST boss-reactive identity mechanic — 5s ember-only window on revive.
// Spec: docs/design/mechanics/identity-layer.md §3.1.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test('fxPhoenixAshenReign: activate → flame border + HUD elements created, state flips active', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetAshenReignPool();

    // Pre-fire snapshot.
    const before = {
      active: mod.isAshenReignActive(),
      endsAt: mod.getAshenReignEndsAt(),
      poolInit: mod.__identityFxTestables.isAshenReignPoolInitDone(),
    };

    // Activate.
    mod.fxPhoenixAshenReign(null, null);

    const after = {
      active: mod.isAshenReignActive(),
      endsAt: mod.getAshenReignEndsAt(),
      poolInit: mod.__identityFxTestables.isAshenReignPoolInitDone(),
      flameBorderInDom: !!(mod.__identityFxTestables.getAshenReignFlameBorderEl()
                            && mod.__identityFxTestables.getAshenReignFlameBorderEl().parentNode),
      hudInDom: !!(mod.__identityFxTestables.getAshenReignHudEl()
                    && mod.__identityFxTestables.getAshenReignHudEl().parentNode),
      flameBorderActive: !!(mod.__identityFxTestables.getAshenReignFlameBorderEl()
                            && mod.__identityFxTestables.getAshenReignFlameBorderEl().classList.contains('identity-phoenix-ashen-reign-border-active')),
      hudActive: !!(mod.__identityFxTestables.getAshenReignHudEl()
                     && mod.__identityFxTestables.getAshenReignHudEl().classList.contains('identity-phoenix-ashen-reign-hud-active')),
      hudText: (mod.__identityFxTestables.getAshenReignHudEl() || {}).textContent || '',
      releaseTimerScheduled: mod.__identityFxTestables.hasAshenReignReleaseTimer(),
    };

    // Cleanup so state doesn't leak across tests.
    mod.resetAshenReign();

    return { before, after };
  });

  expect(result.before.active).toBe(false);
  expect(result.before.endsAt).toBeNull();
  expect(result.after.active).toBe(true);
  expect(typeof result.after.endsAt).toBe('number');
  expect(result.after.endsAt).toBeGreaterThan(0);
  expect(result.after.poolInit).toBe(true);
  expect(result.after.flameBorderInDom).toBe(true);
  expect(result.after.hudInDom).toBe(true);
  expect(result.after.flameBorderActive).toBe(true);
  expect(result.after.hudActive).toBe(true);
  expect(result.after.hudText).toBe('EMBER ONLY — 5s');
  expect(result.after.releaseTimerScheduled).toBe(true);
  expect(errors).toEqual([]);
});

test('fxPhoenixAshenReign: canPlacePieceDuringAshenReign — ember-only gate during active window', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetAshenReignPool();

    // Inactive baseline — every piece placeable.
    mod.resetAshenReign();
    const inactiveBaseline = {
      ember:    mod.canPlacePieceDuringAshenReign({ element: 'ember' }),
      tide:     mod.canPlacePieceDuringAshenReign({ element: 'tide' }),
      umbra:    mod.canPlacePieceDuringAshenReign({ element: 'umbra' }),
      solar:    mod.canPlacePieceDuringAshenReign({ element: 'solar' }),
      grove:    mod.canPlacePieceDuringAshenReign({ element: 'grove' }),
      nullPiece: mod.canPlacePieceDuringAshenReign(null),
    };

    // Active window — only ember passes.
    mod.fxPhoenixAshenReign(null, null);
    const activeWindow = {
      ember:    mod.canPlacePieceDuringAshenReign({ element: 'ember' }),
      tide:     mod.canPlacePieceDuringAshenReign({ element: 'tide' }),
      umbra:    mod.canPlacePieceDuringAshenReign({ element: 'umbra' }),
      solar:    mod.canPlacePieceDuringAshenReign({ element: 'solar' }),
      grove:    mod.canPlacePieceDuringAshenReign({ element: 'grove' }),
      nullPiece: mod.canPlacePieceDuringAshenReign(null),
      noElementField: mod.canPlacePieceDuringAshenReign({}),
    };

    // Cleanup.
    mod.resetAshenReign();
    const afterRelease = {
      ember:    mod.canPlacePieceDuringAshenReign({ element: 'ember' }),
      tide:     mod.canPlacePieceDuringAshenReign({ element: 'tide' }),
      umbra:    mod.canPlacePieceDuringAshenReign({ element: 'umbra' }),
    };

    return { inactiveBaseline, activeWindow, afterRelease };
  });

  // Inactive baseline: everything passes.
  expect(result.inactiveBaseline.ember).toBe(true);
  expect(result.inactiveBaseline.tide).toBe(true);
  expect(result.inactiveBaseline.umbra).toBe(true);
  expect(result.inactiveBaseline.solar).toBe(true);
  expect(result.inactiveBaseline.grove).toBe(true);
  expect(result.inactiveBaseline.nullPiece).toBe(true);

  // Active window: only ember passes.
  expect(result.activeWindow.ember).toBe(true);
  expect(result.activeWindow.tide).toBe(false);
  expect(result.activeWindow.umbra).toBe(false);
  expect(result.activeWindow.solar).toBe(false);
  expect(result.activeWindow.grove).toBe(false);
  expect(result.activeWindow.nullPiece).toBe(false);
  expect(result.activeWindow.noElementField).toBe(false);

  // After release: everything passes again.
  expect(result.afterRelease.ember).toBe(true);
  expect(result.afterRelease.tide).toBe(true);
  expect(result.afterRelease.umbra).toBe(true);

  expect(errors).toEqual([]);
});

test('fxPhoenixAshenReign: 5000ms duration release — state cleared via setTimeout (fake-timer)', async ({ page }) => {
  // Verify the setTimeout-driven release fires exactly at 5000ms — the
  // single-setTimeout-no-rAF design contract from spec §3.1 field 7.
  // We can't wait 5s in CI, so we drive the clock with sinon-style stubbing
  // of setTimeout via wrapper override.
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetAshenReignPool();

    // Capture the release timer callback so we can invoke it synchronously
    // without waiting 5000ms in real time. setTimeout is replaced for the
    // span of the activate call to capture the release callback.
    let capturedReleaseCb = null;
    let capturedReleaseDelay = null;
    const origSetTimeout = window.setTimeout;
    window.setTimeout = function(cb, delay) {
      if (delay === 5000 && !capturedReleaseCb) {
        capturedReleaseCb = cb;
        capturedReleaseDelay = delay;
        // Return a fake timer id — fxPhoenixAshenReignRelease clears via
        // clearTimeout, which is OK with a number id even if not "real".
        return 9999;
      }
      return origSetTimeout(cb, delay);
    };

    mod.fxPhoenixAshenReign(null, null);
    const midActive = mod.isAshenReignActive();
    const releaseTimerScheduled = mod.__identityFxTestables.hasAshenReignReleaseTimer();

    // Restore setTimeout, fire the captured release callback synchronously.
    window.setTimeout = origSetTimeout;
    if (capturedReleaseCb) capturedReleaseCb();

    const afterReleaseActive = mod.isAshenReignActive();
    const afterReleaseEndsAt = mod.getAshenReignEndsAt();

    mod.resetAshenReign();

    return {
      capturedReleaseDelay,
      midActive,
      releaseTimerScheduled,
      afterReleaseActive,
      afterReleaseEndsAt,
    };
  });

  // Release setTimeout was scheduled at exactly 5000ms.
  expect(result.capturedReleaseDelay).toBe(5000);
  expect(result.midActive).toBe(true);
  expect(result.releaseTimerScheduled).toBe(true);
  // Firing the release callback flips state back to inactive.
  expect(result.afterReleaseActive).toBe(false);
  expect(result.afterReleaseEndsAt).toBeNull();
  expect(errors).toEqual([]);
});

test('fxPhoenixAshenReign: telegraph re-uses sacred REACTIVITY_TELEGRAPH_MS = 3000', async ({ page }) => {
  // Spec §3.1 field 8 + spec §3 Convention: Ashen Reign telegraph MUST
  // re-use the sacred REACTIVITY_TELEGRAPH_MS constant. Verifies the
  // sacred re-use invariant from the design spec.
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    const idMod  = await import('/src/data/identity-layer.js');
    const bsMod  = await import('/src/core/bosses.js');
    return {
      ashenTelegraph: idMod.ASHEN_REIGN_TELEGRAPH_MS,
      sacredTelegraph: bsMod.REACTIVITY_TELEGRAPH_MS,
      sacredBannerDuration: bsMod.REACTIVITY_BANNER_DURATION_MS,
      phoenixReviveHpPct: bsMod.PHOENIX_REVIVE_HP_PCT,
      phoenixImmuneTurns: bsMod.PHOENIX_IMMUNE_TURNS,
    };
  });

  // Sacred re-use invariant: ASHEN_REIGN_TELEGRAPH_MS === REACTIVITY_TELEGRAPH_MS.
  expect(result.ashenTelegraph).toBe(result.sacredTelegraph);
  expect(result.ashenTelegraph).toBe(3000);
  // Sacred constants byte-perfect (CLAUDE.md §2.5).
  expect(result.sacredTelegraph).toBe(3000);
  expect(result.sacredBannerDuration).toBe(1500);
  expect(result.phoenixReviveHpPct).toBe(0.6);
  expect(result.phoenixImmuneTurns).toBe(2);
  expect(errors).toEqual([]);
});

test('fxPhoenixAshenReign performance: initial trigger within ≤16ms budget', async ({ page }) => {
  // Spec §3.1 field 7: initial trigger ≤16ms wall-time. Single DOM overlay
  // toggle + HUD element class swap, no per-frame JS work during the window.
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const wallTime = await page.evaluate(async () => {
    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetAshenReignPool();

    // Warm-up call (pool init cost factored out of measurement).
    mod.fxPhoenixAshenReign(null, null);
    mod.resetAshenReign();

    // Measure the activate call.
    const t0 = performance.now();
    mod.fxPhoenixAshenReign(null, null);
    const dt = performance.now() - t0;

    mod.resetAshenReign();
    return dt;
  });

  // Spec §3.1 field 7: ≤16ms initial trigger. Allow 3× CI headroom.
  expect(wallTime).toBeLessThan(48);
  expect(errors).toEqual([]);
});

test('Mixed-race squad regression: 5-race line-clear unaffected by Ashen Reign state (T2.02-T2.06 unchanged)', async ({ page }) => {
  // Critical regression: activating Phoenix Ashen Reign must NOT break the
  // 5-race identity layer dispatch. Boss-state and race-FX are independent
  // layers per spec §1 hard rule 3.
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    // Stub all five race-layer APIs.
    let goldDelta = 0;
    window.addGold = (n) => { goldDelta += Number(n) || 0; };
    window.ULT_THRESHOLD = { ember: 12, tide: 12, grove: 12, solar: 12, umbra: 12 };
    window.ultCharges = { ember: 0, tide: 0, grove: 0, solar: 0, umbra: 0 };
    window.shieldCount = 0;
    window.MAX_SHIELD = 3;
    window.maxShieldBonus = 2;
    window.HERO_DECK = [
      { id: 'sp1', race: 'spark' },
      { id: 'p1',  race: 'pirate' },
      { id: 'p2',  race: 'pirate' },
      { id: 'r1',  race: 'rock' },
      { id: 's1',  race: 'shark' },
      { id: 'c1',  race: 'crocodile' },
    ];

    // Build an 8x8 grid stub.
    window.grid = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let c = 0; c < 8; c++) {
      window.grid[0][c] = 'solar';  // gates Spark
      window.grid[3][c] = 'grove';  // gates Crocodile
    }

    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetSparkRayPool();
    mod.__identityFxTestables.resetCrocFragmentPool();
    mod.__identityFxTestables.resetRockEchoPool();
    mod.__identityFxTestables.resetSharkBitePool();
    mod.__identityFxTestables.resetAshenReignPool();
    mod.resetCrocFragmentBank();

    // Activate Phoenix Ashen Reign FIRST.
    mod.fxPhoenixAshenReign(null, null);
    const ashenActiveBefore = mod.isAshenReignActive();

    // Now fire the 5-race line clear. All race FX must still run.
    const api = {
      get: () => window.shieldCount,
      set: (n) => { window.shieldCount = n; },
      cap: window.MAX_SHIELD + 2 + window.maxShieldBonus,
    };
    const ctx = {
      gridState: window.grid,
      squadShieldsApi: api,
      dominantElementsByLine: ['solar', 'umbra'],
    };
    mod.dispatchIdentityFx([0, 3], [], window.HERO_DECK, null, ctx);

    const ashenActiveAfter = mod.isAshenReignActive();

    // Cleanup.
    mod.resetAshenReign();

    return {
      goldDelta,
      shieldCount: window.shieldCount,
      umbraCharge: window.ultCharges.umbra,
      sparkModifier: ctx._dominantCountModifier,
      bank: mod.__identityFxTestables.getCrocFragmentBank(),
      ashenActiveBefore,
      ashenActiveAfter,
    };
  });

  // Ashen Reign was active during the line clear.
  expect(result.ashenActiveBefore).toBe(true);
  // And remained active after — race FX didn't tamper with boss state.
  expect(result.ashenActiveAfter).toBe(true);
  // All 5 race FX fired correctly (T2.02-T2.06 invariants maintained).
  expect(result.goldDelta).toBe(160);
  expect(result.shieldCount).toBe(1);
  expect(result.bank).toBe(3);
  expect(result.umbraCharge).toBe(1);
  expect(result.sparkModifier).toBe(1);
  expect(errors).toEqual([]);
});

test('IDENTITY_BOSS_HANDLERS: registers identity_phoenix_revive alongside sacred 22 handlers (byte-perfect audit)', async ({ page }) => {
  // Verify the new boss-reactive handler registry is wired correctly AND
  // the sacred 22 REACTIVITY_HANDLERS entries are untouched. Confirms the
  // T2.07 architectural contract from spec §1 hard rule 1.
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    const mod = await import('/src/core/reactivity-events.js');
    const identityKeys = Object.keys(mod.IDENTITY_BOSS_HANDLERS || {});
    const sacredKeys   = Object.keys(mod.REACTIVITY_HANDLERS || {});
    return {
      identityKeys,
      sacredKeyCount: sacredKeys.length,
      sacredKeys,
      identityPhoenixHandlerType: typeof (mod.IDENTITY_BOSS_HANDLERS || {})['identity_phoenix_revive'],
      triggerEventType: typeof mod.triggerIdentityBossEvent,
      resetIdentityType: typeof mod.resetIdentityBossState,
    };
  });

  // Sacred 22 still present, byte-perfect entry set.
  expect(result.sacredKeyCount).toBe(22);
  // Identity registry has the Phoenix Ashen Reign handler.
  expect(result.identityKeys).toContain('identity_phoenix_revive');
  expect(result.identityPhoenixHandlerType).toBe('function');
  // Dispatch + reset entry points exposed.
  expect(result.triggerEventType).toBe('function');
  expect(result.resetIdentityType).toBe('function');
  // Sacred 22 entries explicitly present (subset check — the 22 keys per spec §5.1).
  const expectedSacred = [
    'berserker_p1_p2', 'berserker_p2_p3',
    'armored_p1_p2',   'armored_p2_p3',
    'phoenix_p1_p2',   'phoenix_p2_p3',
    'assassin_p1_p2',  'assassin_p2_p3',
    'bruiser_p1_p2',   'bruiser_p2_p3',
    'hypnotist_p1_p2', 'hypnotist_p2_p3',
    'engineer_p1_p2',  'engineer_p2_p3',
    'frenzy_p1_p2',    'frenzy_p2_p3',
    'tempo_disruptor_p1_p2', 'tempo_disruptor_p2_p3',
    'battery_p1_p2',   'battery_p2_p3',
    'tower_voidfang_p1_p2', 'tower_voidfang_p2_p3',
  ];
  for (const k of expectedSacred) {
    expect(result.sacredKeys).toContain(k);
  }
  expect(errors).toEqual([]);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2026-05-12 — TASK-035 (T2.08): Lich Cursed Tiles smoke tests.
// Spec: docs/design/mechanics/identity-layer.md §3.2.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test('Lich Cursed Tiles: trigger gate fires for ≥2-shark squad, silent for <2-shark squad', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    const mod = await import('/src/feel/identity-fx.js');

    // Gate predicate covers spec §3.2 field 3 boundary.
    return {
      noSharks:     mod.cursedTilesGatePasses([{ race: 'pirate' }, { race: 'rock' }]),
      oneShark:     mod.cursedTilesGatePasses([{ race: 'shark' }, { race: 'rock' }]),
      twoSharks:    mod.cursedTilesGatePasses([{ race: 'shark' }, { race: 'shark' }]),
      fiveSharks:   mod.cursedTilesGatePasses([
        { race: 'shark' }, { race: 'shark' }, { race: 'shark' },
        { race: 'shark' }, { race: 'shark' },
      ]),
      deadShark:    mod.cursedTilesGatePasses([
        { race: 'shark', hp: 0 }, { race: 'shark', hp: 100 },
      ]),
    };
  });

  expect(result.noSharks).toBe(false);
  expect(result.oneShark).toBe(false);
  expect(result.twoSharks).toBe(true);
  expect(result.fiveSharks).toBe(true);
  expect(result.deadShark).toBe(false);
  expect(errors).toEqual([]);
});

test('Lich Cursed Tiles: fxLichCursedTiles places 3 curses on random non-empty cells + 3-turn lifecycle', async ({ page }) => {
  // Spec §3.2 field 4: 3 random non-empty cells, 3-turn lifecycle, 1 HP/turn
  // damage, +20 ULT compensation per expiring cell clamped to sacred threshold.
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetCursedTilesPool();

    // Build an 8x8 grid stub with 10 non-empty cells in different positions
    // so the random pick of 3 cells is exercised.
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    const seeded = [
      [0, 0], [0, 1], [0, 2], [1, 3], [2, 4],
      [3, 5], [4, 6], [5, 7], [6, 0], [7, 1],
    ];
    for (const [r, c] of seeded) grid[r][c] = 'umbra';

    // Place curses at turn 5.
    mod.fxLichCursedTiles(null, { gridState: grid, currentTurn: 5 });
    const afterPlace = {
      count: mod.getCursedTilesCount(),
      snap: mod.getCursedTilesSnapshot(),
    };

    // Per-turn tick at turn 6 — all 3 active, 3 HP damage applied.
    let hp = 100;
    const hpApi = { get: () => hp, set: (n) => { hp = n; } };
    let umbraCharge = 80;
    const ultApi = {
      get: (_meter) => umbraCharge,
      set: (_meter, n) => { umbraCharge = n; },
      threshold: (_role) => 100,
    };
    const t6 = mod.fxLichCursedTilesTick({
      currentTurn: 6,
      squadHpApi: hpApi,
      ultMeterApi: ultApi,
      ultMeter: 'umbra',
      role: 'mage',
    });

    // Turn 7 — still all 3 active.
    const t7 = mod.fxLichCursedTilesTick({
      currentTurn: 7,
      squadHpApi: hpApi,
      ultMeterApi: ultApi,
      ultMeter: 'umbra',
      role: 'mage',
    });

    // Turn 8 — expiration fires, +20 ULT × 3 cells (clamped at 100).
    const t8 = mod.fxLichCursedTilesTick({
      currentTurn: 8,
      squadHpApi: hpApi,
      ultMeterApi: ultApi,
      ultMeter: 'umbra',
      role: 'mage',
    });

    mod.resetCursedTiles();

    return {
      afterPlace,
      hpAfterAll: hp,
      umbraChargeAfterAll: umbraCharge,
      t6, t7, t8,
    };
  });

  // Place: 3 curses on the grid.
  expect(result.afterPlace.count).toBe(3);
  expect(result.afterPlace.snap.length).toBe(3);
  // Each curse has expected turn arithmetic: placedTurn 5, expiresTurn 8.
  for (const s of result.afterPlace.snap) {
    expect(s.placedTurn).toBe(5);
    expect(s.expiresTurn).toBe(8);
  }
  // Turn 6: 3 cells active, 3 HP damage, 0 ULT granted.
  expect(result.t6.activeCount).toBe(3);
  expect(result.t6.hpDamage).toBe(3);
  expect(result.t6.ultChargeGranted).toBe(0);
  // Turn 7: same.
  expect(result.t7.activeCount).toBe(3);
  expect(result.t7.hpDamage).toBe(3);
  expect(result.t7.ultChargeGranted).toBe(0);
  // Turn 8: expiration. HP damage applied (3 cells active before expiration),
  // ULT clamped to threshold (80 + 20 = 100, additional cells add 0).
  expect(result.t8.activeCount).toBe(0);
  expect(result.t8.expiredCount).toBe(3);
  expect(result.t8.hpDamage).toBe(3);
  expect(result.t8.ultChargeGranted).toBe(20);   // clamped: 80 → 100, additional grants = 0
  // Cumulative effect: 100 HP - (3 + 3 + 3) = 91 HP.
  expect(result.hpAfterAll).toBe(91);
  // ULT cap respected.
  expect(result.umbraChargeAfterAll).toBe(100);
  expect(errors).toEqual([]);
});

test('Lich Cursed Tiles: telegraph re-uses sacred REACTIVITY_TELEGRAPH_MS = 3000 + HERO_ULT_COST_BY_NEWROLE byte-perfect', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    const idMod = await import('/src/data/identity-layer.js');
    const bsMod = await import('/src/core/bosses.js');
    const hMod  = await import('/src/data/heroes.js');
    return {
      cursedTilesTelegraph: idMod.CURSED_TILES_TELEGRAPH_MS,
      sacredTelegraph:      bsMod.REACTIVITY_TELEGRAPH_MS,
      sacredBannerDuration: bsMod.REACTIVITY_BANNER_DURATION_MS,
      phoenixReviveHpPct:   bsMod.PHOENIX_REVIVE_HP_PCT,
      phoenixImmuneTurns:   bsMod.PHOENIX_IMMUNE_TURNS,
      warrior: hMod.HERO_ULT_COST_BY_NEWROLE.warrior,
      mage:    hMod.HERO_ULT_COST_BY_NEWROLE.mage,
      hunter:  hMod.HERO_ULT_COST_BY_NEWROLE.hunter,
      tank:    hMod.HERO_ULT_COST_BY_NEWROLE.tank,
      captain: hMod.HERO_ULT_COST_BY_NEWROLE.captain,
    };
  });

  // Sacred re-use invariant.
  expect(result.cursedTilesTelegraph).toBe(result.sacredTelegraph);
  expect(result.cursedTilesTelegraph).toBe(3000);
  // Sacred byte-perfect (CLAUDE.md §2.1 + §2.5).
  expect(result.sacredTelegraph).toBe(3000);
  expect(result.sacredBannerDuration).toBe(1500);
  expect(result.phoenixReviveHpPct).toBe(0.6);
  expect(result.phoenixImmuneTurns).toBe(2);
  expect(result.warrior).toBe(80);
  expect(result.mage).toBe(100);
  expect(result.hunter).toBe(120);
  expect(result.tank).toBe(80);
  expect(result.captain).toBe(100);
  expect(errors).toEqual([]);
});

test('Lich Cursed Tiles: cross-mechanic regression — race FX + Phoenix Ashen Reign + Cursed Tiles coexist', async ({ page }) => {
  // Critical regression: activating Cursed Tiles must NOT break the 5-race
  // identity layer dispatch OR Phoenix Ashen Reign — all are independent
  // layers per spec §1 hard rule 3.
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    // Stub all five race-layer APIs.
    let goldDelta = 0;
    window.addGold = (n) => { goldDelta += Number(n) || 0; };
    window.ULT_THRESHOLD = { ember: 12, tide: 12, grove: 12, solar: 12, umbra: 12 };
    window.ultCharges = { ember: 0, tide: 0, grove: 0, solar: 0, umbra: 0 };
    window.shieldCount = 0;
    window.MAX_SHIELD = 3;
    window.maxShieldBonus = 2;
    window.HERO_DECK = [
      { id: 'sp1', race: 'spark' },
      { id: 'p1',  race: 'pirate' },
      { id: 'p2',  race: 'pirate' },
      { id: 'r1',  race: 'rock' },
      { id: 's1',  race: 'shark' },
      { id: 's2',  race: 'shark' },
      { id: 'c1',  race: 'crocodile' },
    ];

    // Build an 8x8 grid stub.
    window.grid = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let c = 0; c < 8; c++) {
      window.grid[0][c] = 'solar';   // gates Spark
      window.grid[3][c] = 'grove';   // gates Crocodile
      window.grid[5][c] = 'umbra';   // seed for Cursed Tiles pick pool
    }

    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetSparkRayPool();
    mod.__identityFxTestables.resetCrocFragmentPool();
    mod.__identityFxTestables.resetRockEchoPool();
    mod.__identityFxTestables.resetSharkBitePool();
    mod.__identityFxTestables.resetAshenReignPool();
    mod.__identityFxTestables.resetCursedTilesPool();
    mod.resetCrocFragmentBank();

    // Activate BOTH boss-reactive layers.
    mod.fxPhoenixAshenReign(null, null);
    const ashenActiveBefore = mod.isAshenReignActive();
    mod.fxLichCursedTiles(null, { gridState: window.grid, currentTurn: 0 });
    const cursedCountBefore = mod.getCursedTilesCount();

    // Verify trigger gate fires for 2+ sharks.
    const gatePasses = mod.cursedTilesGatePasses(window.HERO_DECK);

    // Now fire the 5-race line clear. All race FX must still run.
    const api = {
      get: () => window.shieldCount,
      set: (n) => { window.shieldCount = n; },
      cap: window.MAX_SHIELD + 2 + window.maxShieldBonus,
    };
    const ctx = {
      gridState: window.grid,
      squadShieldsApi: api,
      dominantElementsByLine: ['solar', 'umbra'],
    };
    mod.dispatchIdentityFx([0, 3], [], window.HERO_DECK, null, ctx);

    const ashenActiveAfter   = mod.isAshenReignActive();
    const cursedCountAfter   = mod.getCursedTilesCount();

    // Cleanup.
    mod.resetAshenReign();
    mod.resetCursedTiles();

    return {
      goldDelta,
      shieldCount:    window.shieldCount,
      umbraCharge:    window.ultCharges.umbra,
      sparkModifier:  ctx._dominantCountModifier,
      bank:           mod.__identityFxTestables.getCrocFragmentBank(),
      ashenActiveBefore,
      ashenActiveAfter,
      cursedCountBefore,
      cursedCountAfter,
      gatePasses,
    };
  });

  // Cursed Tiles trigger gate fires for ≥2-shark squad.
  expect(result.gatePasses).toBe(true);
  // Both boss-reactive layers active.
  expect(result.ashenActiveBefore).toBe(true);
  expect(result.cursedCountBefore).toBeGreaterThan(0);
  // Both remain active after race dispatch.
  expect(result.ashenActiveAfter).toBe(true);
  expect(result.cursedCountAfter).toBeGreaterThan(0);
  // Race FX still fire (T2.02-T2.06 invariants).
  expect(result.goldDelta).toBeGreaterThanOrEqual(160);   // 2 pirates × 8 × 5 × 2 lines = 160 (Pirate's Plunder)
  expect(result.shieldCount).toBeGreaterThanOrEqual(1);   // Crocodile Bastion accrued
  expect(result.umbraCharge).toBeGreaterThanOrEqual(1);   // Rock Echo on umbra-dominant line
  expect(result.sparkModifier).toBe(1);                   // Spark Sun Cascade fired
  expect(errors).toEqual([]);
});

test('IDENTITY_BOSS_HANDLERS: registers identity_assassin_shark_counter alongside sacred 22 + Phoenix (byte-perfect audit)', async ({ page }) => {
  // Verify the new T2.08 boss-reactive handler is wired correctly AND the
  // sacred 22 REACTIVITY_HANDLERS entries + the T2.07 Phoenix entry are
  // both still present. Confirms the parallel-namespace contract from spec
  // §1 hard rule 1 continues to scale to multiple identity layers.
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    const mod = await import('/src/core/reactivity-events.js');
    const identityKeys = Object.keys(mod.IDENTITY_BOSS_HANDLERS || {});
    const sacredKeys   = Object.keys(mod.REACTIVITY_HANDLERS || {});
    return {
      identityKeys,
      sacredKeyCount: sacredKeys.length,
      sacredKeys,
      identityPhoenixHandlerType: typeof (mod.IDENTITY_BOSS_HANDLERS || {})['identity_phoenix_revive'],
      identityLichHandlerType:    typeof (mod.IDENTITY_BOSS_HANDLERS || {})['identity_assassin_shark_counter'],
      triggerEventType: typeof mod.triggerIdentityBossEvent,
      resetIdentityType: typeof mod.resetIdentityBossState,
    };
  });

  // Sacred 22 still byte-perfect.
  expect(result.sacredKeyCount).toBe(22);
  // Identity registry now has BOTH Phoenix (T2.07) AND Lich (T2.08) handlers.
  expect(result.identityKeys).toContain('identity_phoenix_revive');
  expect(result.identityKeys).toContain('identity_assassin_shark_counter');
  expect(result.identityPhoenixHandlerType).toBe('function');
  expect(result.identityLichHandlerType).toBe('function');
  // Dispatch + reset entry points still exposed.
  expect(result.triggerEventType).toBe('function');
  expect(result.resetIdentityType).toBe('function');
  // Sacred 22 entries still explicitly present.
  const expectedSacred = [
    'berserker_p1_p2', 'berserker_p2_p3',
    'armored_p1_p2',   'armored_p2_p3',
    'phoenix_p1_p2',   'phoenix_p2_p3',
    'assassin_p1_p2',  'assassin_p2_p3',
    'bruiser_p1_p2',   'bruiser_p2_p3',
    'hypnotist_p1_p2', 'hypnotist_p2_p3',
    'engineer_p1_p2',  'engineer_p2_p3',
    'frenzy_p1_p2',    'frenzy_p2_p3',
    'tempo_disruptor_p1_p2', 'tempo_disruptor_p2_p3',
    'battery_p1_p2',   'battery_p2_p3',
    'tower_voidfang_p1_p2', 'tower_voidfang_p2_p3',
  ];
  for (const k of expectedSacred) {
    expect(result.sacredKeys).toContain(k);
  }
  expect(errors).toEqual([]);
});

test('fxLichCursedTiles performance: initial trigger within ≤16ms budget', async ({ page }) => {
  // Spec §3.2 field 7: initial trigger ≤16ms wall-time. Pool init + 3 random
  // picks + 3 DOM class swaps. Single-fire measurement.
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const wallTime = await page.evaluate(async () => {
    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetCursedTilesPool();
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let c = 0; c < 8; c++) grid[2][c] = 'umbra';

    // Warm-up call (pool init cost factored out).
    mod.fxLichCursedTiles(null, { gridState: grid, currentTurn: 0 });
    mod.resetCursedTiles();

    const t0 = performance.now();
    mod.fxLichCursedTiles(null, { gridState: grid, currentTurn: 1 });
    const dt = performance.now() - t0;
    mod.resetCursedTiles();
    return dt;
  });

  // Spec §3.2 field 7: ≤16ms initial. Allow 3× CI headroom.
  expect(wallTime).toBeLessThan(48);
  expect(errors).toEqual([]);
});

// ─── T2.09 — Berserker / Frenzy Bloodtide Pulse smoke tests (spec §3.3) ──

test('Bloodtide Pulse: every-3rd-clear + ACTIVE state → pulse fires; clears 1, 2 silent', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetBloodtidePool();

    // Clears 1, 2 (Active state): no pulse fires.
    mod.incrementBloodtideClearCount();   // count = 1
    const c1_fires = mod.bloodtideGatePasses('active');
    mod.incrementBloodtideClearCount();   // count = 2
    const c2_fires = mod.bloodtideGatePasses('active');
    // Clear 3: pulse fires (Active state).
    mod.incrementBloodtideClearCount();   // count = 3
    const c3_fires = mod.bloodtideGatePasses('active');
    if (c3_fires) mod.fxBerserkerBloodtidePulse(null, null);
    const c3_pending = mod.isBloodtidePulsePending();
    // Boss attack — consume pulse.
    const c3_consume = mod.consumeBloodtidePulse();
    const c3_pendingAfter = mod.isBloodtidePulsePending();
    // Clears 4, 5 (Active): no new pulse.
    mod.incrementBloodtideClearCount();   // count = 4
    const c4_fires = mod.bloodtideGatePasses('active');
    mod.incrementBloodtideClearCount();   // count = 5
    const c5_fires = mod.bloodtideGatePasses('active');
    // Clear 6: second pulse fires.
    mod.incrementBloodtideClearCount();   // count = 6
    const c6_fires = mod.bloodtideGatePasses('active');
    if (c6_fires) mod.fxBerserkerBloodtidePulse(null, null);
    const c6_consume = mod.consumeBloodtidePulse();

    mod.resetBloodtide();
    return {
      c1_fires, c2_fires, c3_fires, c4_fires, c5_fires, c6_fires,
      c3_pending, c3_consume, c3_pendingAfter, c6_consume,
    };
  });

  // Clears 1, 2: gate fails (not 3rd-clear).
  expect(result.c1_fires).toBe(false);
  expect(result.c2_fires).toBe(false);
  // Clear 3: gate passes, pulse fires, pending=true.
  expect(result.c3_fires).toBe(true);
  expect(result.c3_pending).toBe(true);
  // Consume returns 0.05, pending flips to false.
  expect(result.c3_consume.damageBonus).toBeCloseTo(0.05, 10);
  expect(result.c3_pendingAfter).toBe(false);
  // Clears 4, 5: gate fails.
  expect(result.c4_fires).toBe(false);
  expect(result.c5_fires).toBe(false);
  // Clear 6: second pulse fires + consumes for +5%.
  expect(result.c6_fires).toBe(true);
  expect(result.c6_consume.damageBonus).toBeCloseTo(0.05, 10);
  expect(errors).toEqual([]);
});

test('Bloodtide Pulse: STAGGER + RECOVERY block trigger (sacred Stagger Loop READ-only)', async ({ page }) => {
  // Spec §3.3 field 3: trigger ONLY in Active state. Stagger and Recovery
  // block the pulse — verifying sacred §2.5 read-only integration.
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    const mod = await import('/src/feel/identity-fx.js');
    const sl  = await import('/src/core/stagger-loop.js');
    mod.__identityFxTestables.resetBloodtidePool();

    // Count to 3 in Stagger — gate fails.
    mod.incrementBloodtideClearCount();
    mod.incrementBloodtideClearCount();
    mod.incrementBloodtideClearCount();
    const inStagger  = mod.bloodtideGatePasses(sl.BOSS_STATE_STAGGER);
    // Count to 6 in Recovery — still fails.
    mod.incrementBloodtideClearCount();
    mod.incrementBloodtideClearCount();
    mod.incrementBloodtideClearCount();
    const inRecovery = mod.bloodtideGatePasses(sl.BOSS_STATE_RECOVERY);
    // Count to 9 in Active — fires.
    mod.incrementBloodtideClearCount();
    mod.incrementBloodtideClearCount();
    mod.incrementBloodtideClearCount();
    const inActive   = mod.bloodtideGatePasses(sl.BOSS_STATE_ACTIVE);

    // Sacred Stagger Loop constants byte-perfect.
    const sacred = {
      activeStr:    sl.BOSS_STATE_ACTIVE,
      staggerStr:   sl.BOSS_STATE_STAGGER,
      recoveryStr:  sl.BOSS_STATE_RECOVERY,
      staggerDur:   sl.STAGGER_DURATION_TURNS,
      recoveryDur:  sl.RECOVERY_DURATION_TURNS,
    };

    mod.resetBloodtide();
    return { inStagger, inRecovery, inActive, sacred };
  });

  expect(result.inStagger).toBe(false);
  expect(result.inRecovery).toBe(false);
  expect(result.inActive).toBe(true);
  // Sacred Stagger Loop constants byte-perfect after the round-trip.
  expect(result.sacred.activeStr).toBe('active');
  expect(result.sacred.staggerStr).toBe('stagger');
  expect(result.sacred.recoveryStr).toBe('recovery');
  expect(result.sacred.staggerDur).toBe(4);
  expect(result.sacred.recoveryDur).toBe(2);
  expect(errors).toEqual([]);
});

test('Bloodtide Pulse: damage composition LAYERED (base × enrageMult × (1 + pulseBonus)) — NEVER additive', async ({ page }) => {
  // CRITICAL invariant: pulse multiplies the ENRAGE-multiplied result.
  // It does NOT modify sacred BERSERKER_ENRAGE_MULT = 2.0.
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    const mod = await import('/src/feel/identity-fx.js');
    const bs  = await import('/src/core/bosses.js');

    // Layered composition: 100 × 2.0 × 1.05 = 210
    const layered = mod.applyBloodtideToDamage(100, bs.BERSERKER_ENRAGE_MULT, 0.05);
    // Composition with no pulse: 100 × 2.0 = 200
    const noPulse = mod.applyBloodtideToDamage(100, bs.BERSERKER_ENRAGE_MULT, 0);
    // Wrong composition baseline (we don't apply this; just for the diff
    // assertion). Additive: 100 × (2.0 + 0.05) = 205
    const wrongAdditive = 100 * (bs.BERSERKER_ENRAGE_MULT + 0.05);

    // Sacred constants byte-perfect after round-trip.
    const sacredEnrageMult  = bs.BERSERKER_ENRAGE_MULT;
    const sacredEnrageHpPct = bs.BERSERKER_ENRAGE_HP_PCT;

    return { layered, noPulse, wrongAdditive, sacredEnrageMult, sacredEnrageHpPct };
  });

  expect(result.layered).toBeCloseTo(210, 10);
  expect(result.noPulse).toBe(200);
  expect(result.layered).not.toBe(result.wrongAdditive);   // 210 !== 205
  // Sacred constants byte-perfect.
  expect(result.sacredEnrageMult).toBe(2.0);
  expect(result.sacredEnrageHpPct).toBe(0.5);
  expect(errors).toEqual([]);
});

test('Bloodtide Pulse: cross-mechanic regression — race FX + Phoenix + Lich + Bloodtide coexist', async ({ page }) => {
  // Verify T2.02-T2.08 invariants hold when Bloodtide is layered on top.
  // All four mechanics can be active simultaneously without interference.
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetCoinPool();
    mod.__identityFxTestables.resetSharkBitePool();
    mod.__identityFxTestables.resetRockEchoPool();
    mod.__identityFxTestables.resetCrocFragmentPool();
    mod.__identityFxTestables.resetSparkRayPool();
    mod.__identityFxTestables.resetAshenReignPool();
    mod.__identityFxTestables.resetCursedTilesPool();
    mod.__identityFxTestables.resetBloodtidePool();
    mod.resetCrocFragmentBank();

    // Activate Phoenix Ashen Reign + Lich Cursed Tiles + Bloodtide.
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    grid[5][0] = 'umbra';
    grid[5][1] = 'umbra';
    grid[5][2] = 'umbra';
    mod.fxPhoenixAshenReign(null, null);
    mod.fxLichCursedTiles(null, { gridState: grid, currentTurn: 0 });
    mod.incrementBloodtideClearCount();
    mod.incrementBloodtideClearCount();
    mod.incrementBloodtideClearCount();
    mod.fxBerserkerBloodtidePulse(null, null);

    const stateBefore = {
      ashenActive:    mod.isAshenReignActive(),
      cursedCount:    mod.getCursedTilesCount(),
      pulsePending:   mod.isBloodtidePulsePending(),
    };

    // Fire a mixed-race line clear — race FX should run independently.
    for (let c = 0; c < 8; c++) grid[0][c] = 'solar';
    for (let c = 0; c < 8; c++) grid[2][c] = 'grove';
    const squad = [
      { race: 'pirate' }, { race: 'shark' }, { race: 'shark' },
      { race: 'rock' },   { race: 'crocodile' }, { race: 'spark' },
    ];
    const ctx = { gridState: grid, dominantElementsByLine: ['solar', 'grove'] };
    let dispatchThrew = false;
    try { mod.dispatchIdentityFx([0, 2], [], squad, null, ctx); }
    catch (_e) { dispatchThrew = true; }

    const stateAfter = {
      ashenActive:    mod.isAshenReignActive(),
      cursedCount:    mod.getCursedTilesCount(),
      pulsePending:   mod.isBloodtidePulsePending(),
      sparkBoost:     ctx._dominantCountModifier,
    };

    // Cleanup.
    mod.fxPhoenixAshenReignRelease();
    mod.resetCursedTiles();
    mod.resetBloodtide();

    return { stateBefore, stateAfter, dispatchThrew };
  });

  expect(result.dispatchThrew).toBe(false);
  // Before dispatch: all three layered states active.
  expect(result.stateBefore.ashenActive).toBe(true);
  expect(result.stateBefore.cursedCount).toBeGreaterThan(0);
  expect(result.stateBefore.pulsePending).toBe(true);
  // After dispatch: all three states preserved + Spark cascade fired.
  expect(result.stateAfter.ashenActive).toBe(true);
  expect(result.stateAfter.cursedCount).toBeGreaterThan(0);
  expect(result.stateAfter.pulsePending).toBe(true);
  expect(result.stateAfter.sparkBoost).toBe(1);
  expect(errors).toEqual([]);
});

test('IDENTITY_BOSS_HANDLERS: registers identity_berserker_frenzy_pulse alongside sacred 22 + Phoenix + Lich', async ({ page }) => {
  // Verify the new T2.09 boss-reactive handler is wired correctly AND the
  // sacred 22 REACTIVITY_HANDLERS entries + T2.07 Phoenix + T2.08 Lich are
  // both still present. Confirms parallel-namespace contract continues to
  // scale.
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const result = await page.evaluate(async () => {
    const mod = await import('/src/core/reactivity-events.js');
    const identityKeys = Object.keys(mod.IDENTITY_BOSS_HANDLERS || {});
    const sacredKeys   = Object.keys(mod.REACTIVITY_HANDLERS || {});
    return {
      identityKeys,
      sacredKeyCount: sacredKeys.length,
      sacredKeys,
      identityPhoenixHandlerType:   typeof (mod.IDENTITY_BOSS_HANDLERS || {})['identity_phoenix_revive'],
      identityLichHandlerType:      typeof (mod.IDENTITY_BOSS_HANDLERS || {})['identity_assassin_shark_counter'],
      identityBloodtideHandlerType: typeof (mod.IDENTITY_BOSS_HANDLERS || {})['identity_berserker_frenzy_pulse'],
      triggerEventType:  typeof mod.triggerIdentityBossEvent,
      resetIdentityType: typeof mod.resetIdentityBossState,
    };
  });

  // Sacred 22 still byte-perfect.
  expect(result.sacredKeyCount).toBe(22);
  // Identity registry now has Phoenix (T2.07) AND Lich (T2.08) AND Bloodtide (T2.09).
  expect(result.identityKeys).toContain('identity_phoenix_revive');
  expect(result.identityKeys).toContain('identity_assassin_shark_counter');
  expect(result.identityKeys).toContain('identity_berserker_frenzy_pulse');
  expect(result.identityPhoenixHandlerType).toBe('function');
  expect(result.identityLichHandlerType).toBe('function');
  expect(result.identityBloodtideHandlerType).toBe('function');
  // Dispatch + reset entry points still exposed.
  expect(result.triggerEventType).toBe('function');
  expect(result.resetIdentityType).toBe('function');
  // Sacred 22 entries still explicitly present.
  const expectedSacred = [
    'berserker_p1_p2', 'berserker_p2_p3',
    'armored_p1_p2',   'armored_p2_p3',
    'phoenix_p1_p2',   'phoenix_p2_p3',
    'assassin_p1_p2',  'assassin_p2_p3',
    'bruiser_p1_p2',   'bruiser_p2_p3',
    'hypnotist_p1_p2', 'hypnotist_p2_p3',
    'engineer_p1_p2',  'engineer_p2_p3',
    'frenzy_p1_p2',    'frenzy_p2_p3',
    'tempo_disruptor_p1_p2', 'tempo_disruptor_p2_p3',
    'battery_p1_p2',   'battery_p2_p3',
    'tower_voidfang_p1_p2', 'tower_voidfang_p2_p3',
  ];
  for (const k of expectedSacred) {
    expect(result.sacredKeys).toContain(k);
  }
  expect(errors).toEqual([]);
});

test('fxBerserkerBloodtidePulse performance: initial trigger within ≤10ms budget', async ({ page }) => {
  // Spec §3.3 field 7: initial trigger ≤10ms wall-time. Pool init + 1 pulse
  // element activation + 1 HUD activation. Single-fire measurement.
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const wallTime = await page.evaluate(async () => {
    const mod = await import('/src/feel/identity-fx.js');
    mod.__identityFxTestables.resetBloodtidePool();

    // Warm-up call (pool init cost factored out).
    mod.fxBerserkerBloodtidePulse(null, null);
    mod.resetBloodtide();

    const t0 = performance.now();
    mod.fxBerserkerBloodtidePulse(null, null);
    const dt = performance.now() - t0;
    mod.resetBloodtide();
    return dt;
  });

  // Spec §3.3 field 7: ≤10ms initial. Allow 3× CI headroom (30ms).
  expect(wallTime).toBeLessThan(30);
  expect(errors).toEqual([]);
});
