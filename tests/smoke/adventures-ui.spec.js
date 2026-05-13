// 2026-05-13 — TASK-051 (T3.03): Adventures UI smoke tests.
//
// Spec: docs/design/endgame-social.md §2 (Adventures — async clan 5–15)
//       + §15 ESC-03 Q1 hard-cap 5–15
//       + Q5 navigator.share OS-native only.
//
// Coverage strategy (ADR-004 hybrid coexistence): Vite-served `/` boots the
// new src/main.js shell. We drive Adventures UI via showScreen('adventures')
// + direct module imports for state seeding. The mock-mode T3.02 backend
// stays in-memory so tests are deterministic without a Firebase SDK.
//
// Per CTO brief — eight smoke flows:
//   1. Vite shell mounts the adventures route + screen scaffold present.
//   2. Empty state — no clans → "Create new clan" CTA + modal opens on click.
//   3. Create flow — submit a valid name → clan appears in Your Clans tab.
//   4. Browse flow — search-by-name → matching clans appear → Join works.
//   5. Detail flow — click clan card → detail view with members + weekly stub.
//   6. Hard-cap — Join button disabled / errors when clan is at 15 members.
//   7. Leave flow — non-owner clicks Leave → returns to Your Clans.
//   8. Owner-leave block — owner clicks Leave → blocked with transfer hint.
//   9. Cross-mechanic regression: 39 window-bridges intact after Adventures.

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
    } catch (_e) { /* private mode — caller will see selector timeout */ }
  }, playerName || 'TESTER');
}

test('[T3.03] Vite shell mounts Adventures route + screen scaffold present', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const scaffoldOk = await page.evaluate(() => !!document.getElementById('screenAdventures'));
  expect(scaffoldOk).toBe(true);

  // Surface check — public API present.
  const surface = await page.evaluate(async () => {
    const mod = await import('/src/ui/adventures.js');
    return {
      renderAdventures:       typeof mod.renderAdventures,
      renderYourClansTab:     typeof mod.renderYourClansTab,
      renderBrowseTab:        typeof mod.renderBrowseTab,
      renderClanDetail:       typeof mod.renderClanDetail,
      renderCreateClanModal:  typeof mod.renderCreateClanModal,
      validateCreateForm:     typeof mod.validateCreateForm,
      resolveCurrentPlayerId: typeof mod.resolveCurrentPlayerId,
    };
  });
  expect(surface.renderAdventures).toBe('function');
  expect(surface.renderYourClansTab).toBe('function');
  expect(surface.renderBrowseTab).toBe('function');
  expect(surface.renderClanDetail).toBe('function');
  expect(surface.renderCreateClanModal).toBe('function');
  expect(surface.validateCreateForm).toBe('function');
  expect(surface.resolveCurrentPlayerId).toBe('function');
  expect(errors).toEqual([]);
});

test('[T3.03] Empty state shows Create CTA + opens modal on click', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  // Reset backend store + navigate.
  await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    window.showScreen('adventures');
  });
  await page.waitForSelector('#screenAdventures.active', { timeout: 10_000 });
  // Tabs + empty-state body render.
  await page.waitForSelector('.adv-tab.active', { timeout: 10_000 });
  await page.waitForSelector('#advCreateBtn', { timeout: 10_000 });

  // Click the create button → modal mounts.
  await page.click('#advCreateBtn');
  await page.waitForSelector('#advCreateModal', { timeout: 5_000 });
  await page.waitForSelector('#advCreateName', { timeout: 5_000 });
});

test('[T3.03] Create flow — valid name yields a new clan in Your Clans tab', async ({ page }) => {
  await seedAuthenticatedState(page, 'CREATOR');
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    window.showScreen('adventures');
  });
  await page.waitForSelector('#advCreateBtn', { timeout: 10_000 });
  await page.click('#advCreateBtn');
  await page.waitForSelector('#advCreateName', { timeout: 5_000 });

  // Type a valid clan name + description, submit.
  await page.fill('#advCreateName', 'Brass Sparrows');
  await page.fill('#advCreateDesc', 'A small but proud band.');
  await page.click('#advCreateSubmit');

  // Navigates to the new clan detail page.
  await page.waitForSelector('.adv-detail-name', { timeout: 10_000 });
  const name = await page.locator('.adv-detail-name').textContent();
  expect((name || '').toUpperCase()).toContain('BRASS SPARROWS');
});

test('[T3.03] Browse flow — search "iron" returns matching clan', async ({ page }) => {
  await seedAuthenticatedState(page, 'BROWSER');
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  // Seed two clans in the mock store before navigating.
  await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    await mod.createClan('ownerA', 'Ironbound');
    await mod.createClan('ownerB', 'Solar Knights');
    window.showScreen('adventures');
  });

  // Click the Browse tab.
  await page.waitForSelector('[data-adv-tab="browse"]', { timeout: 10_000 });
  await page.click('[data-adv-tab="browse"]');
  await page.waitForSelector('#advSearchInput', { timeout: 5_000 });

  // Type 'iron' — debounced 150ms, so wait for the async refresh.
  await page.fill('#advSearchInput', 'iron');
  await page.waitForTimeout(400);
  await page.waitForSelector('.adv-clan-name', { timeout: 5_000 });

  const names = await page.evaluate(() => Array.from(document.querySelectorAll('.adv-clan-name')).map(n => n.textContent));
  expect(names.some(n => (n || '').toUpperCase().includes('IRONBOUND'))).toBe(true);
  // Solar Knights should NOT match the "iron" prefix.
  expect(names.some(n => (n || '').toUpperCase().includes('SOLAR'))).toBe(false);
});

test('[T3.03] Detail flow — clicking a clan card opens the detail view', async ({ page }) => {
  await seedAuthenticatedState(page, 'VIEWER');
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  // Seed a clan with the viewer as owner so the detail page has full data.
  const clanId = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('viewer', 'The Watchers');
    window.showScreen('adventures');
    return c.clanId;
  });
  expect(typeof clanId).toBe('string');

  // Your Clans tab is default; wait for the clan card.
  await page.waitForSelector(`.adv-clan-card[data-adv-clan-id="${clanId}"]`, { timeout: 10_000 });
  await page.click(`.adv-clan-card[data-adv-clan-id="${clanId}"]`);

  // Detail page renders with members + weekly stub.
  await page.waitForSelector('.adv-detail-name', { timeout: 10_000 });
  await page.waitForSelector('.adv-detail-members', { timeout: 5_000 });
  const detailBody = await page.locator('.adv-detail-body').textContent();
  expect((detailBody || '').toUpperCase()).toContain('THE WATCHERS');
  expect((detailBody || '')).toContain('MEMBERS');
});

test('[T3.03] Hard cap — clan at CLAN_MAX_SIZE shows FULL badge + disabled Join button', async ({ page }) => {
  await seedAuthenticatedState(page, 'JOINER');
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  // Seed a clan + push it to 15 members (the HARD CAP).
  await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('cap-owner', 'Capped Clan');
    // Fill to 15 members: owner + 14 joiners (5 to 15 hard cap).
    for (let i = 1; i < 15; i++) {
      await mod.joinClan(c.clanId, `joiner-${i}`);
    }
    window.showScreen('adventures');
  });

  await page.click('[data-adv-tab="browse"]');
  await page.waitForSelector('.adv-clan-card', { timeout: 10_000 });

  // Full clan's card uses 'Full' text + disabled attribute on the button.
  const cardInfo = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.adv-clan-card'));
    const full = cards.find(c => (c.textContent || '').toUpperCase().includes('CAPPED CLAN'));
    return {
      found: !!full,
      disabled: full && full.hasAttribute('disabled'),
      ariaDisabled: full && full.getAttribute('aria-disabled') === 'true',
      hasFullText: full && (full.textContent || '').toUpperCase().includes('FULL'),
    };
  });
  expect(cardInfo.found).toBe(true);
  expect(cardInfo.disabled).toBe(true);
  expect(cardInfo.ariaDisabled).toBe(true);
  expect(cardInfo.hasFullText).toBe(true);
});

test('[T3.03] Leave flow — non-owner member leaves clan + returns to Your Clans', async ({ page }) => {
  await seedAuthenticatedState(page, 'MEMBER');
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  // Create clan owned by someone else, then join as the test player (member).
  const clanId = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('owner-x', 'Departing Crew');
    await mod.joinClan(c.clanId, 'member'); // lowercased TESTER name
    window.showScreen('adventures');
    return c.clanId;
  });

  // Open the clan detail page.
  await page.waitForSelector(`.adv-clan-card[data-adv-clan-id="${clanId}"]`, { timeout: 10_000 });
  await page.click(`.adv-clan-card[data-adv-clan-id="${clanId}"]`);
  await page.waitForSelector('#advLeaveBtn', { timeout: 5_000 });

  // Leave button is enabled for non-owners.
  const isDisabled = await page.evaluate(() => {
    const b = document.querySelector('#advLeaveBtn');
    return !!(b && (b.disabled || b.getAttribute('aria-disabled') === 'true'));
  });
  expect(isDisabled).toBe(false);

  await page.click('#advLeaveBtn');
  // After leave, the UI re-renders the Your Clans tab. The empty-state copy
  // appears because the player is no longer in any clan.
  await page.waitForSelector('.adv-empty-title', { timeout: 5_000 });
  const empty = await page.locator('.adv-empty-title').textContent();
  expect((empty || '').toLowerCase()).toContain('no adventures yet');
});

test('[T3.03] Owner-leave block — leave button disabled + transfer hint shown', async ({ page }) => {
  await seedAuthenticatedState(page, 'OWNER');
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  // Owner-only clan with extra member so the "make owner" transfer path is visible.
  const clanId = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('owner', 'Leadership Test'); // owner == 'OWNER' lowercased
    await mod.joinClan(c.clanId, 'lieutenant');
    window.showScreen('adventures');
    return c.clanId;
  });

  await page.waitForSelector(`.adv-clan-card[data-adv-clan-id="${clanId}"]`, { timeout: 10_000 });
  await page.click(`.adv-clan-card[data-adv-clan-id="${clanId}"]`);
  await page.waitForSelector('#advLeaveBtn', { timeout: 5_000 });

  // Owner cannot leave — button is disabled.
  const isDisabled = await page.evaluate(() => {
    const b = document.querySelector('#advLeaveBtn');
    return !!(b && (b.disabled || b.getAttribute('aria-disabled') === 'true'));
  });
  expect(isDisabled).toBe(true);

  // Transfer hint message is rendered.
  const hint = await page.locator('.adv-action-hint').textContent();
  expect((hint || '').toLowerCase()).toContain('transfer');

  // Transfer button(s) present on the non-owner member.
  const transferCount = await page.evaluate(() => document.querySelectorAll('[data-adv-transfer-to]').length);
  expect(transferCount).toBeGreaterThanOrEqual(1);
});

test('[T3.03] Cross-mechanic regression: 39 window-bridges intact after Adventures mount', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  // Open the Adventures route.
  await page.evaluate(() => window.showScreen('adventures'));
  await page.waitForSelector('#screenAdventures.active', { timeout: 5_000 });

  // Spot-check key window bridges (Identity Layer / Replay / Adventures count probe).
  const surface = await page.evaluate(() => ({
    // Identity Layer (T2.B sample)
    dispatchIdentityFx:            typeof window.__dispatchIdentityFx,
    canPlacePieceDuringAshenReign: typeof window.__canPlacePieceDuringAshenReign,
    pushRecentClear:               typeof window.__pushRecentClear,
    recordRaceTrigger:             typeof window.__recordRaceTrigger,
    recordBossDefeat:              typeof window.__recordBossDefeat,
    // Replay backend (T3.07 sample)
    startReplayCapture:            typeof window.__startReplayCapture,
    onBossDefeatedTrigger:         typeof window.__onBossDefeatedTrigger,
    onTetrisCritTrigger:           typeof window.__onTetrisCritTrigger,
    // Adventures (T3.02 +1 minimal)
    getPlayerClanCount:            typeof window.__getPlayerClanCount,
    // T3.03 must NOT have added any new window bridges for CRUD ops.
    joinClan:                      typeof window.__joinClan,
    createClan:                    typeof window.__createClan,
    leaveClan:                     typeof window.__leaveClan,
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
  // Forbidden bridges — T3.03 uses direct-import only.
  expect(surface.joinClan).toBe('undefined');
  expect(surface.createClan).toBe('undefined');
  expect(surface.leaveClan).toBe('undefined');
});

test('[T3.03] Legacy single HTML still loads without pageerrors (Adventures UI no-regression)', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(LEGACY_PATH);
  await page.waitForSelector('#screenMenu', { timeout: 30_000 });
  expect(errors).toEqual([]);
});
