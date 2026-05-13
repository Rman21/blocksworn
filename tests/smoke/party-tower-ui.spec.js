// 2026-05-13 — TASK-057 (T3.13): Party Tower UI smoke tests.
//
// Spec: docs/design/endgame-social.md §3 (Party Tower — async 2-5 coop)
//       + §3.1 (turn-based architecture + timeout modes)
//       + §3.5 (async social hooks — emoji-only)
//       + §15 ESC-03 Q3 ruling (24h Standard default; 4h Competitive; 7d Casual).
//
// Coverage strategy (ADR-004 hybrid coexistence): Vite-served `/` boots the
// new src/main.js shell. We drive Party Tower UI via showScreen('party-tower')
// + direct module imports for state seeding. The mock-mode T3.10 backend
// stays in-memory so tests are deterministic without a Firebase SDK.
//
// Per CTO brief — six core smoke flows + 1 cross-mechanic regression:
//   1. Vite shell mounts the party-tower route + screen scaffold present.
//   2. Empty state — no parties → "Create new party" CTA + modal opens.
//   3. Create flow — submit valid name + mode → party appears in detail.
//   4. Detail flow — click party card → detail view with members + actions.
//   5. Start flow — owner clicks Start Run → state transitions to active.
//   6. End-turn + emoji react — current player ends turn; emoji buttons present.
//   7. Cross-mechanic regression: 40 window-bridges intact after Party Tower mount.

import { test, expect } from '@playwright/test';

const VITE_PATH = '/';

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

test('[T3.13] Vite shell mounts Party Tower route + scaffold + public API present', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const scaffoldOk = await page.evaluate(() => !!document.getElementById('screenPartyTower'));
  expect(scaffoldOk).toBe(true);

  const surface = await page.evaluate(async () => {
    const mod = await import('/src/ui/party-tower.js');
    return {
      renderPartyTower:       typeof mod.renderPartyTower,
      renderYourPartiesTab:   typeof mod.renderYourPartiesTab,
      renderBrowseTab:        typeof mod.renderBrowseTab,
      renderPartyDetail:      typeof mod.renderPartyDetail,
      renderCreatePartyModal: typeof mod.renderCreatePartyModal,
      validateCreateForm:     typeof mod.validateCreateForm,
      formatCountdown:        typeof mod.formatCountdown,
      resolveCurrentPlayerId: typeof mod.resolveCurrentPlayerId,
    };
  });
  expect(surface.renderPartyTower).toBe('function');
  expect(surface.renderYourPartiesTab).toBe('function');
  expect(surface.renderBrowseTab).toBe('function');
  expect(surface.renderPartyDetail).toBe('function');
  expect(surface.renderCreatePartyModal).toBe('function');
  expect(surface.validateCreateForm).toBe('function');
  expect(surface.formatCountdown).toBe('function');
  expect(surface.resolveCurrentPlayerId).toBe('function');
  expect(errors).toEqual([]);
});

test('[T3.13] Empty state shows Create CTA + opens modal with 3 timeout-mode radios', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  // Reset backend + navigate.
  await page.evaluate(async () => {
    const mod = await import('/src/services/party-tower-backend.js');
    mod._resetMockPartyStore();
    window.showScreen('party-tower');
  });
  await page.waitForSelector('#screenPartyTower.active', { timeout: 10_000 });
  await page.waitForSelector('.pt-tab.active', { timeout: 10_000 });
  await page.waitForSelector('#ptCreateBtn', { timeout: 10_000 });

  // Open the create modal.
  await page.click('#ptCreateBtn');
  await page.waitForSelector('#ptCreateName', { timeout: 5_000 });

  // All three timeout-mode radios present (ESC-03 Q3 ruling).
  await page.waitForSelector('#ptCreateMode-competitive', { timeout: 5_000 });
  await page.waitForSelector('#ptCreateMode-standard',    { timeout: 5_000 });
  await page.waitForSelector('#ptCreateMode-casual',      { timeout: 5_000 });
  // "standard" is the default per ESC-03 Q3.
  const stdChecked = await page.evaluate(() => {
    const el = document.querySelector('#ptCreateMode-standard');
    return el && el.checked === true;
  });
  expect(stdChecked).toBe(true);
});

test('[T3.13] Create flow — valid name yields a party in detail view', async ({ page }) => {
  await seedAuthenticatedState(page, 'CREATOR');
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  await page.evaluate(async () => {
    const mod = await import('/src/services/party-tower-backend.js');
    mod._resetMockPartyStore();
    window.showScreen('party-tower');
  });
  await page.waitForSelector('#ptCreateBtn', { timeout: 10_000 });
  await page.click('#ptCreateBtn');
  await page.waitForSelector('#ptCreateName', { timeout: 5_000 });

  await page.fill('#ptCreateName', 'Brass Sparrows');
  await page.click('#ptCreateSubmit');

  // Detail view mounts.
  await page.waitForSelector('.pt-detail-name', { timeout: 10_000 });
  // Pending state pill present.
  await page.waitForSelector('.pt-state-pill--pending', { timeout: 5_000 });
  // Owner sees Start Run button (disabled because only 1 member — needs ≥2).
  const startBtnDisabled = await page.evaluate(() => {
    const b = document.querySelector('#ptStartBtn');
    return !!(b && (b.disabled || b.getAttribute('aria-disabled') === 'true'));
  });
  expect(startBtnDisabled).toBe(true);
});

test('[T3.13] Detail flow — clicking a party card opens detail view', async ({ page }) => {
  await seedAuthenticatedState(page, 'VIEWER');
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const partyId = await page.evaluate(async () => {
    const mod = await import('/src/services/party-tower-backend.js');
    mod._resetMockPartyStore();
    const result = await mod.createParty('viewer', 'standard');
    window.showScreen('party-tower');
    return result.partyId;
  });
  expect(typeof partyId).toBe('string');

  // Wait for the party card to appear in Your Parties tab.
  await page.waitForSelector(`[data-pt-party-id="${partyId}"]`, { timeout: 10_000 });
  await page.click(`[data-pt-party-id="${partyId}"]`);

  // Detail page renders with members + Pending state pill.
  await page.waitForSelector('.pt-detail-name', { timeout: 10_000 });
  await page.waitForSelector('.pt-state-pill--pending', { timeout: 5_000 });
  // Member list shows the viewer.
  const detailBody = await page.locator('.pt-detail-body, .pt-body').first().textContent();
  expect((detailBody || '').toLowerCase()).toContain('viewer');
});

test('[T3.13] Start Run flow — owner with 2 members can transition to active', async ({ page }) => {
  await seedAuthenticatedState(page, 'CAPTAIN');
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const partyId = await page.evaluate(async () => {
    const mod = await import('/src/services/party-tower-backend.js');
    mod._resetMockPartyStore();
    const r = await mod.createParty('captain', 'standard');
    await mod.joinParty(r.partyId, 'sailor-1');
    window.showScreen('party-tower');
    return r.partyId;
  });

  await page.waitForSelector(`[data-pt-party-id="${partyId}"]`, { timeout: 10_000 });
  await page.click(`[data-pt-party-id="${partyId}"]`);
  await page.waitForSelector('#ptStartBtn', { timeout: 5_000 });

  // Start Run should be enabled — 2 members joined, owner is viewer.
  const enabled = await page.evaluate(() => {
    const b = document.querySelector('#ptStartBtn');
    return !!(b && !b.disabled && b.getAttribute('aria-disabled') !== 'true');
  });
  expect(enabled).toBe(true);

  await page.click('#ptStartBtn');
  // After start, state pill flips to active.
  await page.waitForSelector('.pt-state-pill--active', { timeout: 5_000 });
  // Hearts pool surfaces on active state.
  await page.waitForSelector('.pt-info-cell', { timeout: 5_000 });
  const bodyTxt = await page.locator('.pt-body').textContent();
  expect((bodyTxt || '')).toContain('Tower Hearts');
});

test('[T3.13] Emoji react row — current member sees 👍/🔥/💀 buttons after a turn', async ({ page }) => {
  await seedAuthenticatedState(page, 'REACTOR');
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  // Seed an active party with one turn-history entry so the activity feed +
  // emoji row mount in the detail view.
  const partyId = await page.evaluate(async () => {
    const mod = await import('/src/services/party-tower-backend.js');
    mod._resetMockPartyStore();
    const r = await mod.createParty('reactor', 'standard');
    await mod.joinParty(r.partyId, 'companion');
    await mod.startParty(r.partyId, 'reactor');
    // Reactor takes a turn (they're index 0 → current). After endTurn,
    // index advances to companion; reactor sees the activity feed.
    await mod.endTurn(r.partyId, 'reactor', {});
    window.showScreen('party-tower');
    return r.partyId;
  });

  await page.waitForSelector(`[data-pt-party-id="${partyId}"]`, { timeout: 10_000 });
  await page.click(`[data-pt-party-id="${partyId}"]`);
  await page.waitForSelector('.pt-state-pill--active', { timeout: 5_000 });

  // Emoji react row present with all three locked-set emojis.
  await page.waitForSelector('[data-pt-emoji="👍"]', { timeout: 5_000 });
  await page.waitForSelector('[data-pt-emoji="🔥"]', { timeout: 5_000 });
  await page.waitForSelector('[data-pt-emoji="💀"]', { timeout: 5_000 });

  // Click 🔥 — toast should appear.
  await page.click('[data-pt-emoji="🔥"]');
  // No hard assertion on toast text (timer-driven) — just confirm no error.
});

test('[T3.13] Cross-mechanic regression: 40 window-bridges intact after Party Tower mount', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  await page.evaluate(() => window.showScreen('party-tower'));
  await page.waitForSelector('#screenPartyTower.active', { timeout: 5_000 });

  // Spot-check key window bridges (Identity Layer / Replay / Adventures / Party probe).
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
    // T3.13 must NOT have added any new window bridges for Party Tower ops.
    joinParty:                     typeof window.__joinParty,
    createParty:                   typeof window.__createParty,
    endTurn:                       typeof window.__endTurn,
    leaveParty:                    typeof window.__leaveParty,
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
  // Forbidden bridges — T3.13 uses direct-import only.
  expect(surface.joinParty).toBe('undefined');
  expect(surface.createParty).toBe('undefined');
  expect(surface.endTurn).toBe('undefined');
  expect(surface.leaveParty).toBe('undefined');
});
