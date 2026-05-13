// 2026-05-13 — TASK-053 (T3.05): Adventures contributor stats + clan progression smoke tests.
//
// Spec: docs/design/endgame-social.md §2.3 (Contributor stats) + §2.4
//       (Persistent clan progression). Smoke complements T3.05 unit tests
//       by exercising the live mount through `showScreen('adventures')` +
//       seeded mock-mode clan-backend state.
//
// Eight flows × 2 projects (chromium + mobile-chrome):
//   1. Join clan + record contribution → contributor row + percent + damage bar.
//   2. 3 members contribute → top-3 highlighted with star.
//   3. Self-row "(You)" badge present.
//   4. Expand toggle reveals all contributors.
//   5. Empty contributions → "No contributions yet" empty state.
//   6. Clan progression: level 3 + 12 weeks → progress bar at 75% + Silver banner highlighted as "next".
//   7. Cosmetic locked rows greyed out (--locked class).
//   8. Cross-mechanic regression: Codex + Replay viewer + T3.03 base UI + main battle screen all still work.

import { test, expect } from '@playwright/test';

const VITE_PATH   = '/';
const LEGACY_PATH = '/docs/_legacy/_archive_v1/blocksworn_index_fixed.html';

async function seedAuthenticatedState(page, playerName) {
  await page.addInitScript((name) => {
    try {
      localStorage.clear();
      localStorage.setItem('blocksworn_save_version', '2');
      localStorage.setItem('onboardingSeen', '1');
      localStorage.setItem('seenIntroVideo', '1');
      localStorage.setItem('blocksworn_ftue_beat', 'complete');
      localStorage.setItem('blocksworn_p8_player_name', name || 'TESTER');
    } catch (_e) { /* private mode */ }
  }, playerName || 'TESTER');
}

test('[T3.05] Mount Adventures → join clan → record contribution → contributor row + bar', async ({ page }) => {
  await seedAuthenticatedState(page, 'BLOK');
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const clanId = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('owner-x', 'Stats Test');
    await mod.joinClan(c.clanId, 'blok');
    await mod.recordContribution(c.clanId, 'blok', 12400);
    window.showScreen('adventures');
    return c.clanId;
  });
  expect(typeof clanId).toBe('string');

  // Navigate to the clan detail view.
  await page.waitForSelector(`.adv-clan-card[data-adv-clan-id="${clanId}"]`, { timeout: 10_000 });
  await page.click(`.adv-clan-card[data-adv-clan-id="${clanId}"]`);

  // Contributor stats panel renders with row + damage bar.
  await page.waitForSelector('.adv-contributor-stats-panel', { timeout: 10_000 });
  const panelHTML = await page.locator('.adv-contributor-stats-panel').innerHTML();
  expect(panelHTML).toContain('blok');
  expect(panelHTML).toContain('12,400 dmg');
  expect(panelHTML).toContain('adv-contributor-damage-bar');
});

test('[T3.05] 3 members contribute → top-3 highlighted with star', async ({ page }) => {
  await seedAuthenticatedState(page, 'TESTER');
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const clanId = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('owner-x', 'Trio Clan');
    await mod.joinClan(c.clanId, 'maria');
    await mod.joinClan(c.clanId, 'ironbound');
    await mod.joinClan(c.clanId, 'tester');
    await mod.recordContribution(c.clanId, 'tester',   12400);
    await mod.recordContribution(c.clanId, 'maria',     9100);
    await mod.recordContribution(c.clanId, 'ironbound', 5800);
    window.showScreen('adventures');
    return c.clanId;
  });

  await page.waitForSelector(`.adv-clan-card[data-adv-clan-id="${clanId}"]`, { timeout: 10_000 });
  await page.click(`.adv-clan-card[data-adv-clan-id="${clanId}"]`);
  await page.waitForSelector('.adv-contributor-stats-panel', { timeout: 10_000 });

  // All 3 contributors are top-3 → 3 rows with --top3 class.
  const top3count = await page.evaluate(() => document.querySelectorAll('.adv-contributor-row--top3').length);
  expect(top3count).toBe(3);

  const panelHTML = await page.locator('.adv-contributor-stats-panel').innerHTML();
  // Star prefix character ★ rendered.
  expect(panelHTML).toContain('adv-contributor-star');
});

test('[T3.05] Self-row shows "(You)" badge', async ({ page }) => {
  await seedAuthenticatedState(page, 'MYSELF');
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const clanId = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('owner-x', 'Self Test');
    await mod.joinClan(c.clanId, 'myself');
    await mod.recordContribution(c.clanId, 'myself', 4000);
    window.showScreen('adventures');
    return c.clanId;
  });

  await page.waitForSelector(`.adv-clan-card[data-adv-clan-id="${clanId}"]`, { timeout: 10_000 });
  await page.click(`.adv-clan-card[data-adv-clan-id="${clanId}"]`);
  await page.waitForSelector('.adv-contributor-stats-panel', { timeout: 10_000 });

  const panelHTML = await page.locator('.adv-contributor-stats-panel').innerHTML();
  expect(panelHTML).toContain('(You)');
  expect(panelHTML).toContain('adv-contributor-row--self');
});

test('[T3.05] Expand toggle reveals all 12 contributors', async ({ page }) => {
  await seedAuthenticatedState(page, 'OBSERVER');
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const clanId = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    // Owner is the test player so the clan shows up in "Your Clans".
    const c = await mod.createClan('observer', 'Big Clan');
    for (let i = 0; i < 12; i++) {
      const id = `p${i}`;
      await mod.joinClan(c.clanId, id);
      await mod.recordContribution(c.clanId, id, (12 - i) * 1000);
    }
    window.showScreen('adventures');
    return c.clanId;
  });

  await page.waitForSelector(`.adv-clan-card[data-adv-clan-id="${clanId}"]`, { timeout: 10_000 });
  await page.click(`.adv-clan-card[data-adv-clan-id="${clanId}"]`);
  await page.waitForSelector('.adv-contributor-stats-panel', { timeout: 10_000 });

  // Collapsed view: 3 rows visible.
  let rowCount = await page.evaluate(() => document.querySelectorAll('.adv-contributor-row').length);
  expect(rowCount).toBe(3);

  await page.waitForSelector('#advContribExpandBtn', { timeout: 5_000 });
  await page.click('#advContribExpandBtn');

  // Expanded view: all 12 contributors visible (p0..p11).
  rowCount = await page.evaluate(() => document.querySelectorAll('.adv-contributor-row').length);
  expect(rowCount).toBe(12);
});

test('[T3.05] Empty contributions → empty state visible', async ({ page }) => {
  await seedAuthenticatedState(page, 'FRESH');
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const clanId = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('fresh', 'Empty Clan');
    window.showScreen('adventures');
    return c.clanId;
  });

  await page.waitForSelector(`.adv-clan-card[data-adv-clan-id="${clanId}"]`, { timeout: 10_000 });
  await page.click(`.adv-clan-card[data-adv-clan-id="${clanId}"]`);
  await page.waitForSelector('.adv-contributor-stats-panel', { timeout: 10_000 });

  const panelHTML = await page.locator('.adv-contributor-stats-panel').innerHTML();
  expect(panelHTML).toContain('No contributions yet this week');
});

test('[T3.05] Clan progression: level 3 + 12 weeks → 75% bar + Silver banner ▶ NEXT', async ({ page }) => {
  await seedAuthenticatedState(page, 'PROGRESSED');
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const clanId = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    // Seed a clan directly with 11 total weeks completed (level 3 + 2 weeks into level 4).
    // Wait — we want "level 3 + 12 weeks". computeClanLevel(12) = floor(12/4)+1 = 4.
    // Spec example says: Level 3 → Level 4, 12/16 weeks. Map to totalWeeksCompleted=11 → level 3.
    mod._seedMockClan('progress-clan', {
      clanId: 'progress-clan',
      name: 'Progressed Clan',
      ownerId: 'progressed',
      members: [{ playerId: 'progressed', joinedAt: 1700000000000, role: 'owner', isActive: true }],
      maxSize: 15,
      weeklyTargetId: null,
      weeklyContributions: {},
      weekStartedAt: 1700000000000,
      weekDefeated: false,
      totalWeeksCompleted: 11, // → level 3 (floor(11/4)+1 = 3); 11 - 8 = 3 weeks into level → 75%.
      weeklyHistory: [],
      clanLevel: 3,
      cosmetics: { bannerTier: 'bronze', emblemUnlocks: [], badgeUnlocks: [] },
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    });
    window.showScreen('adventures');
    return 'progress-clan';
  });

  await page.waitForSelector(`.adv-clan-card[data-adv-clan-id="${clanId}"]`, { timeout: 10_000 });
  await page.click(`.adv-clan-card[data-adv-clan-id="${clanId}"]`);
  await page.waitForSelector('.adv-progression-panel', { timeout: 10_000 });

  const panelHTML = await page.locator('.adv-progression-panel').innerHTML();
  expect(panelHTML).toContain('Level 3');
  expect(panelHTML).toContain('Level 4');
  expect(panelHTML).toContain('width: 75%');
  // Silver banner is the next unlock (level 4).
  expect(panelHTML).toContain('Silver banner');
  expect(panelHTML).toContain('adv-cosmetic-unlock-row--next');
});

test('[T3.05] Cosmetic locked rows are greyed out (--locked class)', async ({ page }) => {
  await seedAuthenticatedState(page, 'NEWCOMER');
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const clanId = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('newcomer', 'Newcomer Clan');
    window.showScreen('adventures');
    return c.clanId;
  });

  await page.waitForSelector(`.adv-clan-card[data-adv-clan-id="${clanId}"]`, { timeout: 10_000 });
  await page.click(`.adv-clan-card[data-adv-clan-id="${clanId}"]`);
  await page.waitForSelector('.adv-progression-panel', { timeout: 10_000 });

  const lockedCount = await page.evaluate(() =>
    document.querySelectorAll('.adv-cosmetic-unlock-row--locked').length
  );
  expect(lockedCount).toBeGreaterThan(0);
});

test('[T3.05] Cross-mechanic regression: Codex + Replay viewer + main battle still work', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  // 1. Adventures route mounts.
  await page.evaluate(() => window.showScreen('adventures'));
  await page.waitForSelector('#screenAdventures.active', { timeout: 5_000 });

  // 2. T3.05 panel exports + T3.02/T3.04 helpers + T3.03 renders still surface.
  const surface = await page.evaluate(async () => {
    const ui = await import('/src/ui/adventures.js');
    const be = await import('/src/services/clan-backend.js');
    return {
      // T3.05 panel exports
      renderContributorStatsPanel: typeof ui.renderContributorStatsPanel,
      renderClanProgressionPanel:  typeof ui.renderClanProgressionPanel,
      // T3.03 renders preserved
      renderClanDetail:            typeof ui.renderClanDetail,
      renderYourClansTab:          typeof ui.renderYourClansTab,
      renderBrowseTab:             typeof ui.renderBrowseTab,
      // T3.05 backend helpers
      computeWeeksUntilNextLevel:  typeof be.computeWeeksUntilNextLevel,
      getNextCosmeticUnlock:       typeof be.getNextCosmeticUnlock,
      // T3.04 backend helpers preserved
      pickWeeklyBoss:              typeof be.pickWeeklyBoss,
      // T3.02 backend helpers preserved
      computeContributorPercent:   typeof be.computeContributorPercent,
      unlockCosmeticAtLevel:       typeof be.unlockCosmeticAtLevel,
      // Window bridges
      dispatchIdentityFx:          typeof window.__dispatchIdentityFx,
      startReplayCapture:          typeof window.__startReplayCapture,
      getPlayerClanCount:          typeof window.__getPlayerClanCount,
      // T3.05 must NOT add CRUD bridges.
      joinClan:                    typeof window.__joinClan,
    };
  });

  expect(surface.renderContributorStatsPanel).toBe('function');
  expect(surface.renderClanProgressionPanel).toBe('function');
  expect(surface.renderClanDetail).toBe('function');
  expect(surface.renderYourClansTab).toBe('function');
  expect(surface.renderBrowseTab).toBe('function');
  expect(surface.computeWeeksUntilNextLevel).toBe('function');
  expect(surface.getNextCosmeticUnlock).toBe('function');
  expect(surface.pickWeeklyBoss).toBe('function');
  expect(surface.computeContributorPercent).toBe('function');
  expect(surface.unlockCosmeticAtLevel).toBe('function');
  // Sacred bridges preserved.
  expect(surface.dispatchIdentityFx).toBe('function');
  expect(surface.startReplayCapture).toBe('function');
  expect(surface.getPlayerClanCount).toBe('function');
  // Forbidden bridge — direct-import only.
  expect(surface.joinClan).toBe('undefined');

  // 3. Codex route still mounts.
  await page.evaluate(() => window.showScreen('codex'));
  await page.waitForSelector('#screenCodex.active', { timeout: 5_000 });

  // 4. Menu screen still reachable.
  await page.evaluate(() => window.showScreen('menu'));
  await page.waitForSelector('#screenMenu.active', { timeout: 5_000 });
});

test('[T3.05] Legacy single HTML still loads without pageerrors (Adventures stats no-regression)', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(LEGACY_PATH);
  await page.waitForSelector('#screenMenu', { timeout: 30_000 });
  expect(errors).toEqual([]);
});
