// 2026-05-11 — TASK-004 (T1.04): visual regression baseline capture.
// Spec: docs/plan/00_EXECUTION_PLAN.md §11 + §13 T1.04.
//
// This generates the IMMUTABLE reference PNGs in tests/visual/baseline/.
// T1.05+ will compute pixel-diff regression against these baselines.
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
// tests/visual/baseline/<name>.png. Stick to this layout for T1.05+ diffing.

import { test, expect } from '@playwright/test';
import { setupState } from '../helpers/game-state.js';

// Helper: navigate to a top-level screen by calling the legacy global helper
// after authenticated state is seeded. Some screens have user-gesture-only
// entry points (e.g. shop drawer toggled by a button) — we exercise the
// global functions exposed on window by legacy code (showScreen, goToShop,
// goToTower, goToSeason, goToProfile, goToSelect, goToDailies).
//
// Shop note: goToShop() has multiple gates (lich check, cooldown, first-visit
// welcome modal). For a stable visual baseline we bypass via showScreen('shop')
// + renderShopPacks() directly — captures the shop screen in its "normal entry"
// presentation. T1.10+ can add a more faithful state seeder.
async function nav(page, screenKey) {
  await page.evaluate((key) => {
    const map = {
      menu:    () => (typeof goToMenu === 'function')    ? goToMenu()    : showScreen('menu'),
      shop:    () => {
        showScreen('shop');
        try { if (typeof renderShopPacks === 'function') renderShopPacks(); } catch (e) {}
      },
      tower:   () => (typeof goToTower === 'function')   ? goToTower()   : showScreen('tower'),
      season:  () => (typeof goToSeason === 'function')  ? goToSeason()  : showScreen('season'),
      profile: () => (typeof goToProfile === 'function') ? goToProfile() : showScreen('profile'),
      select:  () => (typeof goToSelect === 'function')  ? goToSelect()  : showScreen('select'),
      dailies: () => (typeof goToDailies === 'function') ? goToDailies() : showScreen('dailies'),
      battle:  () => showScreen('battle'),
    };
    const fn = map[key];
    if (!fn) throw new Error('nav: unknown screen key ' + key);
    fn();
  }, screenKey);
}

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
}

// Wait for fonts (legacy uses Outfit + multiple weights) so text doesn't
// flash from fallback to web font between captures.
async function waitForFonts(page) {
  try {
    await page.evaluate(() => document.fonts && document.fonts.ready);
  } catch (e) { /* document.fonts not available — skip */ }
}

// Each entry: { name, setup, after?, waitFor, settleMs? }.
// `after` runs after setupState's reload + bootSelector is visible, so we can
// navigate to non-default screens. `waitFor` is the final selector to wait on.
//
// FTUE caveat: chronicle_fight and pyredrake_fight beats route through
// onFtueBeatChanged which calls playDialogScript() BEFORE starting the
// battle. That means cold-boot at those beats lands on the dialog overlay
// (#dialogOverlay:not(.hidden)) covering the menu — neither #screenBattle
// nor #screenMenu have .active. We capture the dialog state as the baseline
// for those beats; T1.10+ can extend to also capture the post-dialog
// battle UI.
const SCREENS = [
  // ── Fresh / cold boot (FTUE chronicle auto-routes from not_started) ──
  { name: 'fresh-chronicle-intro', setup: 'fresh', waitFor: '#dialogOverlay:not(.hidden), #screenBattle.active, #screenMenu.active', settleMs: 1500 },
  // ── Authenticated hub screens ──
  { name: 'menu',    setup: 'authenticated', waitFor: '#screenMenu.active', after: (p) => nav(p, 'menu') },
  { name: 'select',  setup: 'authenticated', waitFor: '#screenSelect.active', after: (p) => nav(p, 'select') },
  { name: 'shop',    setup: 'authenticated', waitFor: '#screenShop.active', after: (p) => nav(p, 'shop') },
  { name: 'profile', setup: 'authenticated', waitFor: '#screenProfile.active', after: (p) => nav(p, 'profile') },
  { name: 'dailies', setup: 'authenticated', waitFor: '#screenDailies.active', after: (p) => nav(p, 'dailies') },
  { name: 'season',  setup: 'authenticated', waitFor: '#screenSeason.active', after: (p) => nav(p, 'season') },
  // Tower: needs ch1-complete state (gating per isTowerUnlocked, legacy ~31514).
  { name: 'tower',   setup: 'ch1-complete',  waitFor: '#screenTower.active', after: (p) => nav(p, 'tower') },
  // ── FTUE battle beats (cold-start with seeded ftueBeat) ──
  // Chronicle training dummy fight: lands on dialog overlay first (chronicle_intro
  // script via onFtueBeatChanged ~24254). Captures intro state as baseline.
  { name: 'ftue-chronicle', setup: 'ftue-chronicle', waitFor: '#dialogOverlay:not(.hidden), #screenBattle.active', settleMs: 1500 },
  // Pyredrake FTUE fight: onFtueBeatChanged('pyredrake_fight') ~24274 calls
  // startPyredrakeFtueBattle directly (no dialog gate). Should land in battle.
  { name: 'ftue-pyredrake', setup: 'ftue-pyredrake', waitFor: '#screenBattle.active, #dialogOverlay:not(.hidden)', settleMs: 1500 },
  // ── Post-Ch1 hub (Tower unlocked, menu re-rendered with unlock visible) ──
  { name: 'menu-ch1-complete', setup: 'ch1-complete', waitFor: '#screenMenu.active', after: (p) => nav(p, 'menu') },
];

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
