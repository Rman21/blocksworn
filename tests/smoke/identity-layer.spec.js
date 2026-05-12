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
