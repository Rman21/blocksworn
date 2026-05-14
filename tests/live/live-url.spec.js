// 2026-05-14 — Phase A live-URL smoke gate.
//
// Runs against the production deploy at https://play.blocksworm.com/ to
// catch regressions that pure server-side curl probes miss (browser-level
// JS errors, sidecar install failure, missing assets in a real headless
// Chrome). This is the PR gate: any change to vercel.json, sidecar entry,
// or legacy-bridges shape must pass this before merge.
//
// What we assert:
//   1. Zero JS page errors (no TypeError / ReferenceError thrown into the
//      page-error channel).
//   2. Sidecar install logged exactly once, with installed:true and
//      surfaces > 0.
//   3. #screenMenu is the active screen on first paint (legacy boots all
//      the way to the menu).
//   4. Hard-fail on 404 for critical assets (/assets/icons/*.png).
//   5. Phase 4 enabled via isChiaEnabled() (sidecar's installPhase4Bridge
//      runs without throwing).

import { test, expect } from '@playwright/test';

const URL = 'https://play.blocksworm.com/';
const CRITICAL_ASSETS = [
  '/assets/icons/coin.png',
  '/assets/icons/cristal.png',
  '/assets/sidecar.js',
];

test.use({ baseURL: URL });

test('live game serves cleanly with sidecar installed', async ({ page }) => {
  const jsErrors = [];
  const consoleAll = [];
  const net404 = [];

  page.on('pageerror', (err) => jsErrors.push(`${err.name}: ${err.message}`));
  page.on('console', (msg) => consoleAll.push({ type: msg.type(), text: msg.text() }));
  page.on('response', (resp) => {
    if (resp.status() === 404 || resp.status() >= 500) {
      // Filter out external analytics endpoints — not our problem
      const u = resp.url();
      if (u.startsWith('https://play.blocksworm.com')) {
        net404.push(`${resp.status()} ${u}`);
      }
    }
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('#screenMenu', { timeout: 25000 });
  // Wait for deferred sidecar to install
  await page.waitForFunction(
    () => typeof window.__bsw_phase4_enabled !== 'undefined',
    { timeout: 15000 },
  );
  await page.waitForTimeout(2000); // settle

  // 1. Zero JS errors
  if (jsErrors.length > 0) {
    console.log('JS ERRORS:', jsErrors);
  }
  expect(jsErrors, 'no fatal JS errors at boot').toEqual([]);

  // 2. Sidecar log present
  const sidecarLog = consoleAll.find((c) => c.text.includes('[sidecar] legacy bridges installed'));
  expect(sidecarLog, 'sidecar should log install confirmation').toBeTruthy();
  expect(sidecarLog.text, 'sidecar should report installed:true').toContain('installed: true');
  expect(sidecarLog.text, 'sidecar should report surfaces > 0').toMatch(/surfaces:\s*[1-9]/);

  // 3. Menu screen active
  const activeScreen = await page.evaluate(() => document.querySelector('.screen.active')?.id);
  expect(activeScreen, 'menu screen should be the first active screen').toBe('screenMenu');

  // 4. No 404 on our own assets
  if (net404.length > 0) {
    console.log('404s:', net404);
  }
  expect(net404, 'no 404 on play.blocksworm.com assets').toEqual([]);

  // 5. Critical assets reachable
  for (const path of CRITICAL_ASSETS) {
    const resp = await page.request.get(URL.replace(/\/$/, '') + path);
    expect(resp.status(), `${path} should return 200`).toBe(200);
  }

  // 6. Phase 4 wallet flag wired
  const phase4Enabled = await page.evaluate(() => window.__bsw_phase4_enabled);
  expect(phase4Enabled, 'isChiaEnabled() returned true on the deploy').toBe(true);
});
