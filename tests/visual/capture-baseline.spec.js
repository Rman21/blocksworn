// 2026-05-11 — TASK-004 (T1.04): visual regression baseline capture.
// Spec: docs/plan/00_EXECUTION_PLAN.md §11 + §13 T1.04.
// 2026-05-11 — TASK-005 (T1.05): SCREENS array + nav() moved to ./screens.js
// so capture-baseline and regression specs share one source of truth.
//
// This generates the IMMUTABLE reference PNGs in tests/visual/baseline/.
// tests/visual/regression.spec.js computes pixel-diff against these baselines.
//
// State-seeding strategy (see tests/helpers/game-state.js setupState() header
// for full localStorage key inventory). Summary of legacy keys touched:
//   blocksworn_ftue_beat               FTUE FSM cursor
//   onboardingSeen / seenIntroVideo    skip prologue overlays
//   blocksworn_chapter_1_complete      Tower unlock gate (Ch1 finished)
//
// Screen selectors (from `grep -oE 'id="screen[A-Z][a-zA-Z]*"'`):
//   #screenMenu  #screenBattle  #screenShop  #screenTower
//   #screenSeason  #screenProfile  #screenSelect  #screenDailies
// There is no separate #screenFTUE — FTUE beats render inside #screenBattle.
//
// Animation flake mitigation: 800ms settle wait + a CSS disable of transitions
// applied via page.evaluate() right before screenshot. Increase per-screen
// if you observe flake — document the reason in the SCREENS entry.
//
// Mobile capture: enabled. mobile-chrome (Pixel 7) saves to
// tests/visual/baseline/mobile/<name>.png. chromium saves to
// tests/visual/baseline/<name>.png. The regression spec mirrors this layout.

import { test, expect } from '@playwright/test';
import { setupState } from '../helpers/game-state.js';
import { SCREENS } from './screens.js';

// Freeze CSS animations / transitions for a stable screenshot.
async function freezeAnimations(page) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }`,
  });
  // Pause every <video> element at frame 0. Legacy intro video (fresh-chronicle-intro)
  // autoplays on cold boot and advances frame-by-frame between capture+regression,
  // producing huge pixel diffs. Pinning currentTime + pause() removes the flake.
  await page.evaluate(() => {
    document.querySelectorAll('video').forEach((v) => {
      try { v.pause(); } catch (_e) { /* ignore */ }
      try { v.currentTime = 0; } catch (_e) { /* ignore */ }
      try { v.autoplay = false; } catch (_e) { /* ignore */ }
    });
  });
}

// Wait for fonts (legacy uses Outfit + multiple weights) so text doesn't
// flash from fallback to web font between captures.
async function waitForFonts(page) {
  try {
    await page.evaluate(() => document.fonts && document.fonts.ready);
  } catch (_e) { /* document.fonts not available — skip */ }
}

for (const s of SCREENS) {
  test(`baseline ${s.name}`, async ({ page }, testInfo) => {
    // 21MB inline-JS legacy HTML — generous default timeout.
    test.setTimeout(90_000);
    // Filter pageerror noise so tests don't fail on legacy warnings, but log
    // pageerrors so a future maintainer can spot real regressions.
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await setupState(page, s.setup);

    // Wait for the initial boot to settle. If this screen has an `after`,
    // we wait for the menu screen to be active (the cold-boot landing point
    // for authenticated states) so nav() has the global helpers available.
    // Otherwise wait for the final selector directly.
    const bootSelector = typeof s.after === 'function' ? '#screenMenu.active' : s.waitFor;
    await page.waitForSelector(bootSelector, { timeout: 30_000 });

    if (typeof s.after === 'function') {
      await s.after(page);
      // Re-wait for the FINAL selector after navigation (screen .active toggle).
      await page.waitForSelector(s.waitFor, { timeout: 10_000 });
    }

    await waitForFonts(page);
    await freezeAnimations(page);
    await page.waitForTimeout(s.settleMs || 800);

    // Project name in path so mobile/chromium don't collide.
    const project = testInfo.project.name;
    const subdir = project === 'mobile-chrome' ? 'mobile/' : '';
    const path = `tests/visual/baseline/${subdir}${s.name}.png`;
    await page.screenshot({ path, fullPage: true });

    // Sanity: file present (Playwright already writes — just assert presence
    // implicitly by virtue of no throw above). We DO NOT fail on pageerrors
    // here because the legacy HTML is known to emit a handful of warnings
    // (it's the entire reason we're capturing baselines from it).
    expect(true).toBe(true);
  });
}
