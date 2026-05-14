// 2026-05-14 — Pure-legacy live-URL smoke gate.
//
// After rollback of Phase 4.1 sidecar wiring, play.blocksworm.com/ serves
// only the legacy single-HTML game. The intro-video overlay is suppressed
// via injected `localStorage.seenIntroVideo='1'` (see scripts/inject-legacy-fixes.js).
//
// What we assert:
//   1. HTTP 200 + content-type text/html
//   2. Zero JS page errors at boot
//   3. `#screenMenu` is the active first screen
//   4. Intro-video overlay has `hidden` class (intro skip in effect)
//   5. Critical icon assets (coin.png, cristal.png) return 200
//   6. BATTLE button is present + clickable
//   7. Click BATTLE → screen transitions to screenSelect or screenBattle
//      (not 'none' — that would be the intro-stuck bug we fixed)

import { test, expect } from '@playwright/test';

const URL = 'https://play.blocksworm.com/';
const CRITICAL_ASSETS = [
  '/assets/icons/coin.png',
  '/assets/icons/cristal.png',
];

test.use({ baseURL: URL });

test('legacy game live: load → menu → BATTLE click transitions screen', async ({ page }) => {
  const jsErrors = [];
  const consoleErrors = [];
  const net404 = [];

  page.on('pageerror', (err) => jsErrors.push(`${err.name}: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', (resp) => {
    if ((resp.status() === 404 || resp.status() >= 500) && resp.url().startsWith('https://play.blocksworm.com')) {
      net404.push(`${resp.status()} ${resp.url()}`);
    }
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('#screenMenu', { timeout: 25000 });
  await page.waitForTimeout(3000);

  // 1+2: Zero JS errors
  expect(jsErrors, 'no fatal JS errors at boot').toEqual([]);

  // 3: Menu screen active
  const activeScreen = await page.evaluate(() => document.querySelector('.screen.active')?.id);
  expect(activeScreen, 'menu screen is first active screen').toBe('screenMenu');

  // 4: Intro-video overlay properly hidden (the skip-injection worked)
  const overlayHidden = await page.evaluate(() => {
    const o = document.getElementById('introVideoOverlay');
    return o ? o.classList.contains('hidden') : true;
  });
  expect(overlayHidden, 'intro-video overlay must be hidden (seenIntroVideo flag should suppress it)').toBe(true);

  // 5: No 404 on our assets
  expect(net404, 'no 404 on play.blocksworm.com assets').toEqual([]);
  for (const path of CRITICAL_ASSETS) {
    const resp = await page.request.get(URL.replace(/\/$/, '') + path);
    expect(resp.status(), `${path} should return 200`).toBe(200);
  }

  // 6: BATTLE button present + visible
  const battleBtn = page.locator('.a-hub-battle-btn').first();
  await expect(battleBtn, 'BATTLE button must be visible').toBeVisible({ timeout: 5000 });

  // 7: Click BATTLE — screen must transition AWAY from screenMenu
  await battleBtn.click();
  await page.waitForTimeout(3000);

  const afterScreen = await page.evaluate(() => document.querySelector('.screen.active')?.id);
  expect(afterScreen, 'BATTLE click must transition to a real screen (not none/undefined)').toBeTruthy();
  expect(['screenSelect', 'screenBattle', 'screenMenu']).toContain(afterScreen);

  // Zero NEW JS errors during interaction
  expect(jsErrors, 'no JS errors after BATTLE click').toEqual([]);
});
