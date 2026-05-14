// 2026-05-14 — Pure-legacy live-URL smoke gate.
//
// After rollback of Phase 4.1 sidecar wiring (PR #178), play.blocksworm.com/
// serves only the legacy single-HTML game. Intro video overlay is suppressed
// via pre-seeded localStorage (see scripts/inject-legacy-fixes.js):
//   - `blocksworn_save_version='2'` — survives _saveVersionGate wipe
//   - `seenIntroVideo='1'` — _maybeShowIntroVideo exits early
//
// Two valid first-paint states for a brand-new visitor:
//   A) FTUE active → Chronicler dialog visible, NO active screen yet.
//      Player clicks `#dialogCtaBtn` (▶ BEGIN) → enters screenBattle.
//   B) FTUE complete (returning player) → screenMenu active. Player
//      clicks `.a-hub-battle-btn` → enters screenSelect or screenBattle.
//
// Both paths assert:
//   - HTTP 200, zero JS errors
//   - Intro-video overlay is hidden (suppression worked)
//   - Critical assets (coin/cristal) return 200
//   - Game reaches an actionable interactive state (battle or menu)
//   - One click on the primary CTA transitions to an active screen

import { test, expect } from '@playwright/test';

const URL = 'https://play.blocksworm.com/';
const CRITICAL_ASSETS = [
  '/assets/icons/coin.png',
  '/assets/icons/cristal.png',
  '/assets/audio/music/menu.mp3',
];

test.use({ baseURL: URL });

test('legacy game live: dialog or menu → first interactive screen', async ({ page }) => {
  const jsErrors = [];
  const net404 = [];

  page.on('pageerror', (err) => jsErrors.push(`${err.name}: ${err.message}`));
  page.on('response', (resp) => {
    if ((resp.status() === 404 || resp.status() >= 500) && resp.url().startsWith('https://play.blocksworm.com')) {
      net404.push(`${resp.status()} ${resp.url()}`);
    }
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  // Wait for body to be ready
  await page.waitForSelector('body.a-screen', { timeout: 25000 });
  await page.waitForTimeout(4000);

  // 1 + 2: Zero JS page errors at boot
  expect(jsErrors, 'no fatal JS errors at boot').toEqual([]);

  // 3: Intro-video overlay must be hidden (seenIntroVideo seed worked)
  const overlayHidden = await page.evaluate(() => {
    const o = document.getElementById('introVideoOverlay');
    return o ? o.classList.contains('hidden') : true;
  });
  expect(overlayHidden, 'intro-video overlay must be hidden').toBe(true);

  // 4: localStorage seeded correctly
  const seeded = await page.evaluate(() => ({
    saveVersion: localStorage.getItem('blocksworn_save_version'),
    seenIntro:   localStorage.getItem('seenIntroVideo'),
  }));
  expect(seeded.saveVersion, 'save_version pre-seeded to survive _saveVersionGate wipe').toBe('2');
  expect(seeded.seenIntro, 'seenIntroVideo pre-seeded to suppress intro overlay').toBe('1');

  // 5: No 404 on our own assets
  expect(net404, 'no 404 on play.blocksworm.com assets').toEqual([]);
  for (const path of CRITICAL_ASSETS) {
    const resp = await page.request.get(URL.replace(/\/$/, '') + path);
    expect(resp.status(), `${path} should return 200`).toBe(200);
  }

  // 6: Game is in an actionable state — either FTUE dialog visible OR menu active.
  const initial = await page.evaluate(() => ({
    screen: document.querySelector('.screen.active')?.id || null,
    dialogVisible: (() => {
      const o = document.getElementById('dialogOverlay');
      if (!o) return false;
      return window.getComputedStyle(o).display !== 'none' && !o.classList.contains('hidden');
    })(),
    ctaText: document.querySelector('#dialogCtaBtn')?.textContent?.trim(),
    menuBattleBtnVisible: !!document.querySelector('.a-hub-battle-btn'),
  }));

  const isFtueDialog = initial.dialogVisible && initial.ctaText && initial.ctaText.length > 0;
  const isMenu       = initial.screen === 'screenMenu' && initial.menuBattleBtnVisible;
  expect(isFtueDialog || isMenu, `game must be in dialog (FTUE) or menu state. got: ${JSON.stringify(initial)}`).toBe(true);

  // 7: Click primary CTA and verify transition to an active screen
  if (isFtueDialog) {
    // FTUE path — click the ▶ BEGIN CTA in Chronicle dialog
    await page.locator('#dialogCtaBtn').click({ timeout: 5000 });
    await page.waitForTimeout(3000);
    const afterScreen = await page.evaluate(() => document.querySelector('.screen.active')?.id);
    expect(afterScreen, 'FTUE BEGIN click should enter battle').toBe('screenBattle');
  } else {
    // Returning-player path — click .a-hub-battle-btn from menu
    await page.locator('.a-hub-battle-btn').first().click({ timeout: 5000 });
    await page.waitForTimeout(3000);
    const afterScreen = await page.evaluate(() => document.querySelector('.screen.active')?.id);
    expect(['screenSelect', 'screenBattle', 'screenMenu']).toContain(afterScreen);
  }

  // No new JS errors during interaction
  expect(jsErrors, 'no JS errors after primary CTA click').toEqual([]);
});
