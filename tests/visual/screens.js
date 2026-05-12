// 2026-05-11 — TASK-005 (T1.05): shared SCREENS array + nav helper.
// Extracted from capture-baseline.spec.js so capture-baseline AND regression
// specs use the same screen inventory + setup keys (DRY).
//
// Each entry: { name, setup, after?, waitFor, settleMs? }.
//   - `setup`    — string passed to setupState() (see tests/helpers/game-state.js)
//   - `after`    — optional async fn(page) run after cold-boot lands on menu,
//                  used to navigate to non-default screens via legacy globals
//   - `waitFor`  — final selector to wait on before capture
//   - `settleMs` — extra wait after fonts/animations frozen; default 800
//
// Adding a new screen here automatically makes it part of BOTH:
//   - test:visual:baseline (captures PNG into tests/visual/baseline/)
//   - test:visual          (diffs current screenshot vs baseline)
//
// FTUE caveat: chronicle_fight and pyredrake_fight beats route through
// onFtueBeatChanged which calls playDialogScript() BEFORE starting the battle.
// Cold-boot at those beats lands on dialog overlay covering the menu — capture
// the dialog state as the baseline. T1.10+ can extend.

// Navigate to a top-level screen by calling the legacy global helper after
// authenticated state is seeded. Shop bypasses goToShop() gates and seeds via
// showScreen('shop') + renderShopPacks() for a stable visual baseline.
export async function nav(page, screenKey) {
  await page.evaluate((key) => {
    const map = {
      menu:    () => (typeof goToMenu === 'function')    ? goToMenu()    : showScreen('menu'),
      shop:    () => {
        showScreen('shop');
        try { if (typeof renderShopPacks === 'function') renderShopPacks(); } catch (_e) { /* shop render is best-effort */ }
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

export const SCREENS = [
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
  { name: 'ftue-chronicle', setup: 'ftue-chronicle', waitFor: '#dialogOverlay:not(.hidden), #screenBattle.active', settleMs: 1500 },
  { name: 'ftue-pyredrake', setup: 'ftue-pyredrake', waitFor: '#screenBattle.active, #dialogOverlay:not(.hidden)', settleMs: 1500 },
  // ── Post-Ch1 hub (Tower unlocked, menu re-rendered with unlock visible) ──
  { name: 'menu-ch1-complete', setup: 'ch1-complete', waitFor: '#screenMenu.active', after: (p) => nav(p, 'menu') },
];
