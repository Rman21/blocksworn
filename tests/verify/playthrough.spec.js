// 2026-05-12 — TASK-019 (T1.13 main verify): on-demand comprehensive
// playthrough probe against the new shell at `/`. NOT part of npm
// run test:smoke; kept as a manual verification tool. Run via:
//
//   npx playwright test tests/verify/playthrough.spec.js \
//       --project=chromium --reporter=list
//
// Probes:
//   A.1 Cold-boot — empty localStorage. Watches for pageerrors, classifies
//       caught try/catch warnings emitted via log.warn (forwarded to
//       console), confirms [boot] main complete, captures initial screen.
//   A.2 FTUE flow — fresh install routes through chronicle → pyredrake →
//       grunt → menu in legacy; probe observes how far the new shell
//       advances and where it stalls.
//   A.3 Post-FTUE menu — seeds onboardingSeen so routing skips FTUE and
//       lands on menu; verifies #screenMenu renders with content.
//   A.4 Battle entry — best-effort battle screen entry from authenticated
//       state; just verifies entry doesn't throw.
//   A.5 Other screens — shop / tower / season / profile / select /
//       dailies / battle one at a time; each should render without
//       throwing.
//
// Spec output: each test logs a probe summary block via console.log. The
// runner's stdout is the deliverable. No assertions about content shape —
// these are observational probes, not gate tests.

import { test, expect } from '@playwright/test';

const SHELL = '/';
const BOOT_COMPLETE_MARKER = '[boot] main complete';

/**
 * Returns a console+pageerror collector attached to a Playwright page.
 * Stops collecting if `until` is called.
 */
function attachCollectors(page) {
  const pageErrors = [];
  const warns = [];
  const errors = [];
  const infos = [];
  const all = [];

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
    all.push({ type: 'pageerror', text: err.message });
  });
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    all.push({ type, text });
    if (type === 'warning' || type === 'warn') warns.push(text);
    else if (type === 'error') errors.push(text);
    else if (type === 'info' || type === 'log') infos.push(text);
  });

  return { pageErrors, warns, errors, infos, all };
}

/** Seeds localStorage BEFORE main.js runs. Empty seed = cold boot. */
async function seedLocalStorage(page, entries) {
  await page.addInitScript((payload) => {
    try {
      localStorage.clear();
      for (const [k, v] of payload) localStorage.setItem(k, v);
    } catch (_e) { /* private mode */ }
  }, entries);
}

/** Waits up to `ms` for predicate; resolves with last result regardless. */
async function waitForCondition(page, predicateFn, ms = 5000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const v = await page.evaluate(predicateFn);
      if (v) return v;
    } catch (_e) { /* continue polling */ }
    await page.waitForTimeout(150);
  }
  return null;
}

/** Snapshot of current screen visibility + DOM content size. */
async function snapshotScreens(page) {
  return page.evaluate(() => {
    const screens = ['screenMenu', 'screenProfile', 'screenSelect', 'screenBattle',
                     'screenShop', 'screenDailies', 'screenTower', 'screenSeason'];
    const out = {};
    for (const id of screens) {
      const el = document.getElementById(id);
      if (!el) { out[id] = { exists: false }; continue; }
      out[id] = {
        exists: true,
        active: el.classList.contains('active'),
        innerHTMLLength: el.innerHTML.length,
        children: el.children.length,
      };
    }
    // Overlays
    const dialog = document.getElementById('dialogOverlay');
    const intro  = document.getElementById('introVideoOverlay');
    out.dialogOverlay = dialog ? {
      hidden: dialog.classList.contains('hidden'),
      textLength: (document.getElementById('dialogText')?.innerHTML || '').length,
    } : { exists: false };
    out.introVideoOverlay = intro ? { hidden: intro.classList.contains('hidden') } : { exists: false };
    return out;
  });
}

/** Returns a short label for the currently-visible screen, or 'none'. */
async function currentScreen(page) {
  return page.evaluate(() => {
    const ids = ['screenMenu', 'screenProfile', 'screenSelect', 'screenBattle',
                 'screenShop', 'screenDailies', 'screenTower', 'screenSeason'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && el.classList.contains('active')) return id.replace(/^screen/, '').toLowerCase();
    }
    return 'none';
  });
}

/** Tries to print/extract migration result from console logs. */
function extractMigrationResult(all) {
  const hit = all.find((m) => /storage migration/.test(m.text));
  return hit ? hit.text : null;
}

function summarize(name, data) {
  console.log(`\n══════ PROBE ${name} ══════\n${JSON.stringify(data, null, 2)}\n══════ end ${name} ══════\n`);
}

// ---------------------------------------------------------------------------
// A.1 + A.2 — Cold-boot + FTUE observation
// ---------------------------------------------------------------------------
test('A.1+A.2 cold-boot + FTUE flow observation', async ({ page }) => {
  test.setTimeout(120_000);
  const collectors = attachCollectors(page);

  await seedLocalStorage(page, []); // empty localStorage = cold boot
  await page.goto(SHELL, { waitUntil: 'load' });

  // Wait up to 8s for [boot] main complete OR any visible state.
  await waitForCondition(page, () => {
    return window.__bootMarkerSeen ||
      Array.from(document.querySelectorAll('.screen')).some(s => s.classList.contains('active')) ||
      !document.getElementById('dialogOverlay')?.classList.contains('hidden') ||
      !document.getElementById('introVideoOverlay')?.classList.contains('hidden');
  }, 8000);

  // Give per-render error handlers a tick to flush.
  await page.waitForTimeout(1500);

  const bootCompleteSeen = collectors.all.some((m) => m.text.includes(BOOT_COMPLETE_MARKER));
  const migrationLog     = extractMigrationResult(collectors.all);
  const screen0          = await currentScreen(page);
  const snapshot0        = await snapshotScreens(page);

  // A.2 — try to advance through any visible dialog overlay a few times,
  // observing whether FTUE state mutates. We click the overlay (cold-boot
  // FTUE intro normally taps-to-advance) up to 12 times with short waits.
  const ftueTrace = [];
  ftueTrace.push({ stage: 'after_boot', screen: screen0,
                   ftueBeat: await page.evaluate(() => {
                     try { return localStorage.getItem('blocksworn_ftue_beat'); }
                     catch (_e) { return null; }
                   }) });

  for (let i = 0; i < 12; i++) {
    const dialogVisible = await page.evaluate(() => {
      const ov = document.getElementById('dialogOverlay');
      return ov && !ov.classList.contains('hidden');
    });
    const introVisible = await page.evaluate(() => {
      const ov = document.getElementById('introVideoOverlay');
      return ov && !ov.classList.contains('hidden');
    });
    if (dialogVisible) {
      // try tap-to-continue
      try { await page.click('#dialogOverlay', { timeout: 1000 }); }
      catch (_e) { /* not clickable */ }
    } else if (introVisible) {
      try { await page.click('#introVideoOverlay', { timeout: 1000 }); }
      catch (_e) { /* */ }
    } else {
      break;
    }
    await page.waitForTimeout(400);
    ftueTrace.push({ stage: `tap_${i + 1}`,
                     screen: await currentScreen(page),
                     ftueBeat: await page.evaluate(() => {
                       try { return localStorage.getItem('blocksworn_ftue_beat'); }
                       catch (_e) { return null; }
                     }) });
  }

  const finalScreen   = await currentScreen(page);
  const finalSnapshot = await snapshotScreens(page);

  summarize('A.1+A.2 cold-boot + FTUE', {
    pageErrors: collectors.pageErrors,
    consoleErrors: collectors.errors.slice(0, 20),
    consoleWarnings: collectors.warns.slice(0, 30),
    bootCompleteSeen,
    migrationLog,
    initialScreen: screen0,
    initialSnapshot: snapshot0,
    ftueTrace,
    finalScreen,
    finalSnapshot,
  });

  // Hard assert: bootstrap chain must not surface any pageerror.
  expect(collectors.pageErrors, 'cold-boot pageerrors').toEqual([]);
});

// ---------------------------------------------------------------------------
// A.3 — Post-FTUE menu (skip onboarding, expect direct menu route)
// ---------------------------------------------------------------------------
test('A.3 post-FTUE menu render', async ({ page }) => {
  test.setTimeout(60_000);
  const collectors = attachCollectors(page);

  await seedLocalStorage(page, [
    ['onboardingSeen', '1'],
    ['seenIntroVideo', '1'],
    ['blocksworn_ftue_beat', 'complete'],
    ['blocksworn_save_version', '2'],
    ['blocksworn_p8_player_name', 'TESTER'],
  ]);
  await page.goto(SHELL, { waitUntil: 'load' });

  // Wait for menu to activate.
  const menuActive = await waitForCondition(page, () => {
    const el = document.getElementById('screenMenu');
    return el && el.classList.contains('active');
  }, 8000);

  await page.waitForTimeout(1000); // render settle

  const snap = await snapshotScreens(page);
  const menuInner = await page.evaluate(() => {
    const el = document.getElementById('screenMenu');
    return el ? {
      innerHTMLLength: el.innerHTML.length,
      directChildren: el.children.length,
      hasGold: /\bgold\b/i.test(el.innerHTML),
      hasEssence: /essenc/i.test(el.innerHTML),
      hasHeroPortrait: /portrait|hero-portrait|<img/i.test(el.innerHTML),
      firstChildTag: el.firstElementChild?.tagName || null,
    } : { exists: false };
  });

  summarize('A.3 post-FTUE menu', {
    pageErrors: collectors.pageErrors,
    consoleErrors: collectors.errors.slice(0, 20),
    consoleWarnings: collectors.warns.slice(0, 30),
    menuActive: !!menuActive,
    snapshot: snap,
    menuInner,
  });

  expect(collectors.pageErrors, 'menu render pageerrors').toEqual([]);
});

// ---------------------------------------------------------------------------
// A.4 — Battle entry attempt (via authenticated state + showScreen call)
// ---------------------------------------------------------------------------
test('A.4 battle entry attempt', async ({ page }) => {
  test.setTimeout(60_000);
  const collectors = attachCollectors(page);

  await seedLocalStorage(page, [
    ['onboardingSeen', '1'],
    ['seenIntroVideo', '1'],
    ['blocksworn_ftue_beat', 'complete'],
    ['blocksworn_save_version', '2'],
    ['blocksworn_p8_player_name', 'TESTER'],
  ]);
  await page.goto(SHELL, { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // Try showScreen('battle') via window if exposed; else try via legacy
  // global router accessors.
  const navResult = await page.evaluate(() => {
    const tries = [];
    try {
      if (typeof window.showScreen === 'function') {
        window.showScreen('battle'); tries.push('showScreen(battle)');
      }
    } catch (e) { tries.push('showScreen-threw:' + (e.message || e)); }
    try {
      if (typeof window.startBossBattle === 'function') {
        // Best-effort startBossBattle with no boss arg; the function in legacy
        // accepts an index — skipping deliberate to avoid full battle launch.
      }
    } catch (_e) { /* */ }
    return { tries, battleActive: document.getElementById('screenBattle')?.classList.contains('active') || false };
  });

  await page.waitForTimeout(1500);
  const snap = await snapshotScreens(page);
  const battleInner = await page.evaluate(() => {
    const el = document.getElementById('screenBattle');
    if (!el) return { exists: false };
    return {
      active: el.classList.contains('active'),
      innerHTMLLength: el.innerHTML.length,
      directChildren: el.children.length,
      hasGrid: /grid|board|cell/i.test(el.innerHTML),
      hasHero: /hero|champion/i.test(el.innerHTML),
      hasBoss: /boss/i.test(el.innerHTML),
    };
  });

  summarize('A.4 battle entry', {
    pageErrors: collectors.pageErrors,
    consoleErrors: collectors.errors.slice(0, 20),
    consoleWarnings: collectors.warns.slice(0, 30),
    navResult,
    snapshot: snap,
    battleInner,
  });

  // Soft assertion: no pageerror just from navigating to battle.
  expect(collectors.pageErrors, 'battle-entry pageerrors').toEqual([]);
});

// ---------------------------------------------------------------------------
// A.5 — Other screens (shop / tower / season / profile / select / dailies)
// ---------------------------------------------------------------------------
const OTHER_SCREENS = ['shop', 'tower', 'season', 'profile', 'select', 'dailies'];

for (const name of OTHER_SCREENS) {
  test(`A.5 screen entry: ${name}`, async ({ page }) => {
    test.setTimeout(60_000);
    const collectors = attachCollectors(page);

    await seedLocalStorage(page, [
      ['onboardingSeen', '1'],
      ['seenIntroVideo', '1'],
      ['blocksworn_ftue_beat', 'complete'],
      ['blocksworn_save_version', '2'],
      ['blocksworn_p8_player_name', 'TESTER'],
      ['blocksworn_chapter_1_complete', 'true'],
    ]);
    await page.goto(SHELL, { waitUntil: 'load' });
    await page.waitForTimeout(1000);

    const navResult = await page.evaluate((screenKey) => {
      const out = { attempts: [] };
      try {
        if (typeof window.showScreen === 'function') {
          window.showScreen(screenKey);
          out.attempts.push('showScreen');
        }
      } catch (e) { out.attempts.push('showScreen-threw:' + (e.message || e)); }
      return out;
    }, name);

    await page.waitForTimeout(1200);
    const snap = await snapshotScreens(page);
    const screenInner = await page.evaluate((screenKey) => {
      const id = 'screen' + screenKey.charAt(0).toUpperCase() + screenKey.slice(1);
      const el = document.getElementById(id);
      if (!el) return { exists: false };
      return {
        active: el.classList.contains('active'),
        innerHTMLLength: el.innerHTML.length,
        directChildren: el.children.length,
      };
    }, name);

    summarize(`A.5 ${name}`, {
      pageErrors: collectors.pageErrors,
      consoleErrors: collectors.errors.slice(0, 10),
      consoleWarnings: collectors.warns.slice(0, 15),
      navResult,
      snapshot: { [name]: snap['screen' + name.charAt(0).toUpperCase() + name.slice(1)] },
      screenInner,
    });

    expect(collectors.pageErrors, `${name} pageerrors`).toEqual([]);
  });
}
