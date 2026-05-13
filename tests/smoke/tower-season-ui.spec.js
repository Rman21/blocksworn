// 2026-05-13 — TASK-059 (T3.15): Tower seasonal UI smoke tests.
//
// Spec: docs/design/endgame-social.md §6 (Tower seasonal infrastructure)
//       + §6.1 (Uroboros variant rotation banner)
//       + §6.2 (Seasonal pacts list — additive surface)
//       + §6.3 (PURE PATH F2P-only leaderboard reset hint)
//       + §6.4 (Battle Pass tier widget — sacred §2.4 formula READ-only)
//       + ESC-03 Q4 ruling (13-week Tower + Battle Pass cadence).
//
// Coverage strategy (ADR-004 hybrid coexistence): Vite-served `/` boots
// the new src/main.js shell. We drive Tower seasonal UI via
// showScreen('tower-season') + direct module imports for state seeding.
// The mock-mode T3.14 backend stays in-memory so tests are deterministic
// without a Firebase SDK.
//
// Per CTO brief — five core smoke flows + 1 cross-mechanic regression:
//   1. Vite shell mounts the tower-season route + screen scaffold present.
//   2. Hero block renders — season banner + Uroboros variant card.
//   3. Seasonal pacts list — surfaces SEASONAL_PACTS for season 1.
//   4. Battle Pass widget — sacred §2.4 formula READ-only (tier 1 at xp=0).
//   5. Leaderboard hint — PURE PATH F2P-only invariant copy preserved.
//   6. Cross-mechanic regression: 40 window-bridges intact + no new
//      tower-season-ui bridges created.

import { test, expect } from '@playwright/test';

const VITE_PATH = '/';

async function seedAuthenticatedState(page, opts) {
  await page.addInitScript((o) => {
    try {
      localStorage.clear();
      localStorage.setItem('blocksworn_save_version', '2');
      localStorage.setItem('onboardingSeen', '1');
      localStorage.setItem('seenIntroVideo', '1');
      localStorage.setItem('blocksworn_ftue_beat', 'complete');
      localStorage.setItem('blocksworn_p8_player_name', (o && o.playerName) || 'TESTER');
      if (o && typeof o.bpXp === 'number') {
        localStorage.setItem('blocksworn_bp_xp_earned', String(o.bpXp));
      }
    } catch (_e) { /* private mode — caller will see selector timeout */ }
  }, opts || {});
}

test('[T3.15] Vite shell mounts Tower seasonal route + scaffold + public API present', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const scaffoldOk = await page.evaluate(() => !!document.getElementById('screenTowerSeason'));
  expect(scaffoldOk).toBe(true);

  const surface = await page.evaluate(async () => {
    const mod = await import('/src/ui/tower-season.js');
    return {
      renderTowerSeason:              typeof mod.renderTowerSeason,
      renderHeroBlock:                typeof mod.renderHeroBlock,
      renderSeasonalPactsPanel:       typeof mod.renderSeasonalPactsPanel,
      renderBattlePassWidget:         typeof mod.renderBattlePassWidget,
      renderLeaderboardHint:          typeof mod.renderLeaderboardHint,
      computeBattlePassDisplayState:  typeof mod.computeBattlePassDisplayState,
      formatSeasonCountdown:          typeof mod.formatSeasonCountdown,
      resolveBattlePassXpEarned:      typeof mod.resolveBattlePassXpEarned,
    };
  });
  expect(surface.renderTowerSeason).toBe('function');
  expect(surface.renderHeroBlock).toBe('function');
  expect(surface.renderSeasonalPactsPanel).toBe('function');
  expect(surface.renderBattlePassWidget).toBe('function');
  expect(surface.renderLeaderboardHint).toBe('function');
  expect(surface.computeBattlePassDisplayState).toBe('function');
  expect(surface.formatSeasonCountdown).toBe('function');
  expect(surface.resolveBattlePassXpEarned).toBe('function');
  expect(errors).toEqual([]);
});

test('[T3.15] Hero block renders Season banner + Uroboros variant card on activation', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  await page.evaluate(async () => {
    const mod = await import('/src/services/tower-season-backend.js');
    mod._resetMockSeasonState();
    window.showScreen('tower-season');
  });
  await page.waitForSelector('#screenTowerSeason.active', { timeout: 10_000 });

  // Hero block — season banner + Uroboros card.
  await page.waitForSelector('.ts-banner', { timeout: 10_000 });
  await page.waitForSelector('.ts-uroboros', { timeout: 5_000 });
  await page.waitForSelector('#tsCountdown', { timeout: 5_000 });

  const bannerTxt = await page.locator('.ts-banner').textContent();
  expect(bannerTxt).toContain('Season 1');
  expect((bannerTxt || '').toLowerCase()).toContain('week');

  const uroTxt = await page.locator('.ts-uroboros').textContent();
  // Season 1 → variant index 0 → "Cosmic Eye"
  expect(uroTxt).toContain('Cosmic Eye');
});

test('[T3.15] Seasonal pacts list surfaces 3 Season-1 pacts (additive registry, sacred §2.5)', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  await page.evaluate(async () => {
    const mod = await import('/src/services/tower-season-backend.js');
    mod._resetMockSeasonState();
    window.showScreen('tower-season');
  });
  await page.waitForSelector('.ts-pact-list', { timeout: 10_000 });

  // Three Season-1 seasonal pacts.
  await page.waitForSelector('[data-ts-pact-id="s1_cosmic_clarity"]', { timeout: 5_000 });
  await page.waitForSelector('[data-ts-pact-id="s1_eternal_recall"]', { timeout: 5_000 });
  await page.waitForSelector('[data-ts-pact-id="s1_serpent_blessing"]', { timeout: 5_000 });

  const text = await page.locator('.ts-pact-list').textContent();
  expect(text).toContain('COSMIC CLARITY');
  expect(text).toContain('ETERNAL RECALL');
  expect(text).toContain('SERPENT BLESSING');
});

test('[T3.15] Battle Pass widget — sacred §2.4 formula READ-only; tier 1 at xp=0', async ({ page }) => {
  await seedAuthenticatedState(page, { bpXp: 0 });
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  await page.evaluate(async () => {
    const mod = await import('/src/services/tower-season-backend.js');
    mod._resetMockSeasonState();
    window.showScreen('tower-season');
  });
  await page.waitForSelector('.ts-bp', { timeout: 10_000 });

  const bpText = await page.locator('.ts-bp').textContent();
  // Tier 1 default at xp=0.
  expect(bpText).toContain('Battle Pass');
  expect(bpText).toContain('1');
  expect(bpText).toContain('/ 50');
  // Sacred §2.4 — tier 1 = 500 XP base.
  expect(bpText).toContain('500 XP');
  // Next cosmetic reward at Tier 5 (cosmetic-only per §6.4 + ADR-003).
  expect(bpText).toContain('Tier 5');
  expect(bpText.toLowerCase()).toContain('clan emblem');
});

test('[T3.15] Leaderboard hint — PURE PATH F2P-only invariant preserved (sacred §2.5)', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  await page.evaluate(async () => {
    const mod = await import('/src/services/tower-season-backend.js');
    mod._resetMockSeasonState();
    window.showScreen('tower-season');
  });
  await page.waitForSelector('.ts-lb-hint', { timeout: 10_000 });

  const hintText = await page.locator('.ts-lb-hint').textContent();
  expect(hintText).toContain('PURE PATH');
  expect(hintText).toContain('F2P-only');
  expect(hintText.toLowerCase()).toContain('never wiped');
  // ADR-003 — no paid/whale shortcuts surfaced.
  expect(hintText.toLowerCase()).not.toContain('whale');
  expect(hintText.toLowerCase()).not.toContain('paid');
});

test('[T3.15] Cross-mechanic regression: 40 window-bridges intact; NO new tower-season bridges', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  await page.evaluate(() => window.showScreen('tower-season'));
  await page.waitForSelector('#screenTowerSeason.active', { timeout: 5_000 });

  // Spot-check key window bridges (Identity Layer / Replay / Adventures
  // / Party Tower probe).
  const surface = await page.evaluate(() => ({
    // Identity Layer (T2.B sample)
    dispatchIdentityFx:             typeof window.__dispatchIdentityFx,
    canPlacePieceDuringAshenReign:  typeof window.__canPlacePieceDuringAshenReign,
    pushRecentClear:                typeof window.__pushRecentClear,
    recordRaceTrigger:              typeof window.__recordRaceTrigger,
    recordBossDefeat:               typeof window.__recordBossDefeat,
    // Replay backend (T3.07 sample)
    startReplayCapture:             typeof window.__startReplayCapture,
    onBossDefeatedTrigger:          typeof window.__onBossDefeatedTrigger,
    onTetrisCritTrigger:            typeof window.__onTetrisCritTrigger,
    // Adventures (T3.02 +1 minimal)
    getPlayerClanCount:             typeof window.__getPlayerClanCount,
    // T3.15 must NOT have added any new window bridges for Tower seasonal.
    fetchSeasonState:               typeof window.__fetchSeasonState,
    rotateToNextSeason:             typeof window.__rotateToNextSeason,
    computeBattlePassTierXp:        typeof window.__computeBattlePassTierXp,
    getActiveUroborosVariant:       typeof window.__getActiveUroborosVariant,
    getActiveSeasonalPacts:         typeof window.__getActiveSeasonalPacts,
  }));
  // Required bridges.
  expect(surface.dispatchIdentityFx).toBe('function');
  expect(surface.canPlacePieceDuringAshenReign).toBe('function');
  expect(surface.pushRecentClear).toBe('function');
  expect(surface.recordRaceTrigger).toBe('function');
  expect(surface.recordBossDefeat).toBe('function');
  expect(surface.startReplayCapture).toBe('function');
  expect(surface.onBossDefeatedTrigger).toBe('function');
  expect(surface.onTetrisCritTrigger).toBe('function');
  expect(surface.getPlayerClanCount).toBe('function');
  // Forbidden bridges — T3.15 uses direct-import only.
  expect(surface.fetchSeasonState).toBe('undefined');
  expect(surface.rotateToNextSeason).toBe('undefined');
  expect(surface.computeBattlePassTierXp).toBe('undefined');
  expect(surface.getActiveUroborosVariant).toBe('undefined');
  expect(surface.getActiveSeasonalPacts).toBe('undefined');
});
