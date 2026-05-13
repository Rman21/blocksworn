// 2026-05-13 — TASK-052 (T3.04): Weekly boss rotation — smoke suite.
//
// Spec: docs/design/endgame-social.md §2.2 (Weekly target — Boss-of-the-Week)
//       + §15 ESC-03 Q4 ruling — 1-week Adventures rotation cadence.
//       + ADR-003 — no-P2W; difficulty cap 2.0× HARD.
//       + CLAUDE.md §2.5 — Uroboros sacred seasonal mythic (READ-only id ref).
//
// Coverage:
//   1. Vite shell boots without pageerrors after T3.04 (no regression).
//   2. closeWeek live: didDefeat=true increments totalWeeksCompleted.
//   3. closeWeek live: didDefeat=false leaves totalWeeksCompleted unchanged.
//   4. Anti-repeat 4-week window: phoenix recently defeated → next pick not phoenix.
//   5. Uroboros gate at totalWeeks=4 → Uroboros bossKey returned.
//   6. Element preference 6/10 ember → boss STRONG vs ember (tide-element).
//   7. Auto-rotate fallback: week expired (+8d) → maybeAutoRotateOnClanOpen rotates.
//   8. scaleBossDifficulty HARD cap 2.0 — ADR-003 no-P2W invariant.
//   9. Legacy page still loads (sacred regression contract).

import { test, expect } from '@playwright/test';

const LEGACY_PATH = '/docs/_legacy/_archive_v1/blocksworn_index_fixed.html';
const VITE_PATH   = '/';

async function seedAuthenticatedState(page) {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('blocksworn_save_version', '2');
      localStorage.setItem('onboardingSeen', '1');
      localStorage.setItem('seenIntroVideo', '1');
      localStorage.setItem('blocksworn_ftue_beat', 'complete');
      localStorage.setItem('blocksworn_p8_player_name', 'TESTER');
    } catch (_e) { /* private mode */ }
  });
}

test('[T3.04] legacy single HTML still loads without pageerrors (rotation no-regression)', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(LEGACY_PATH);
  await page.waitForSelector('#screenMenu', { timeout: 30000 });
  expect(errors).toEqual([]);
});

test('[T3.04] Vite shell boots — clan-backend rotation API surfaces are exported', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const surface = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    return {
      pickWeeklyBoss: typeof mod.pickWeeklyBoss,
      closeWeek: typeof mod.closeWeek,
      maybeAutoRotateOnClanOpen: typeof mod.maybeAutoRotateOnClanOpen,
      rotateWeeklyForAllClans: typeof mod.rotateWeeklyForAllClans,
      notifyWeeklyBossRevealed: typeof mod.notifyWeeklyBossRevealed,
      shouldRotateUroboros: typeof mod.shouldRotateUroboros,
      computeClanElementPreference: typeof mod.computeClanElementPreference,
      filterBossesByElementAntiArchetype: typeof mod.filterBossesByElementAntiArchetype,
      getDefeatedArchetypesLastNWeeks: typeof mod.getDefeatedArchetypesLastNWeeks,
      computeWeekHasExpired: typeof mod.computeWeekHasExpired,
      scaleBossDifficulty: typeof mod.scaleBossDifficulty,
    };
  });
  expect(surface.pickWeeklyBoss).toBe('function');
  expect(surface.closeWeek).toBe('function');
  expect(surface.maybeAutoRotateOnClanOpen).toBe('function');
  expect(surface.rotateWeeklyForAllClans).toBe('function');
  expect(surface.notifyWeeklyBossRevealed).toBe('function');
  expect(surface.shouldRotateUroboros).toBe('function');
  expect(surface.computeClanElementPreference).toBe('function');
  expect(surface.filterBossesByElementAntiArchetype).toBe('function');
  expect(surface.getDefeatedArchetypesLastNWeeks).toBe('function');
  expect(surface.computeWeekHasExpired).toBe('function');
  expect(surface.scaleBossDifficulty).toBe('function');
});

test('[T3.04] closeWeek live: didDefeat=true increments totalWeeksCompleted', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('roma', 'Brass Sparrows');
    const before = await mod.fetchClan(c.clanId);
    const r = await mod.closeWeek(c.clanId, true);
    const after = await mod.fetchClan(c.clanId);
    return {
      ok: r.ok,
      beforeTotal: before.clan.totalWeeksCompleted,
      afterTotal: after.clan.totalWeeksCompleted,
      weeklyTargetId: r.weeklyTargetId,
    };
  });
  expect(result.ok).toBe(true);
  expect(result.beforeTotal).toBe(0);
  expect(result.afterTotal).toBe(1);
  expect(typeof result.weeklyTargetId).toBe('string');
  expect(result.weeklyTargetId.length).toBeGreaterThan(0);
});

test('[T3.04] closeWeek live: didDefeat=false leaves totalWeeksCompleted unchanged', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('roma', 'Brass Sparrows');
    await mod.closeWeek(c.clanId, false);
    const after = await mod.fetchClan(c.clanId);
    return after.clan.totalWeeksCompleted;
  });
  expect(result).toBe(0);
});

test('[T3.04] anti-repeat: 4 weeks of phoenix kills → 5th week picks non-phoenix archetype', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('roma', 'Brass Sparrows');
    const seed = (await mod.fetchClan(c.clanId)).clan;
    // Seed clan with 4 weeks of phoenix history.
    seed.weeklyHistory = [
      { bossArchetype: 'phoenix', didDefeat: true },
      { bossArchetype: 'phoenix', didDefeat: true },
      { bossArchetype: 'phoenix', didDefeat: true },
      { bossArchetype: 'phoenix', didDefeat: true },
    ];
    seed.totalWeeksCompleted = 5; // not Uroboros week (5 % 4 !== 0)
    mod._seedMockClan(c.clanId, seed);
    const pick = mod.pickWeeklyBoss(seed);
    return { pick };
  });
  expect(result.pick).not.toMatch(/solar_phoenix/i);
});

test('[T3.04] Uroboros gate: totalWeeks=4 → bossKey is sacred seasonal Uroboros', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('roma', 'Brass Sparrows');
    const seed = (await mod.fetchClan(c.clanId)).clan;
    seed.totalWeeksCompleted = 3;
    mod._seedMockClan(c.clanId, seed);
    const r = await mod.closeWeek(c.clanId, true); // 3 → 4 → Uroboros
    return {
      ok: r.ok,
      isUroboros: r.isUroboros,
      weeklyTargetId: r.weeklyTargetId,
    };
  });
  expect(result.ok).toBe(true);
  expect(result.isUroboros).toBe(true);
  expect(result.weeklyTargetId).toBe('tower_uroboros_seasonal');
});

test('[T3.04] element preference: 6/10 ember squads → boss STRONG vs ember (tide-element)', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    const racesMod = await import('/src/data/races.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('roma', 'Brass Sparrows');
    // Build a 10-member clan: 6 ember (pirate), 4 mixed.
    const members = [{ playerId: 'roma', joinedAt: 0, role: 'owner', isActive: true, activeSquadRaces: ['pirate', 'orc'] }];
    for (let i = 0; i < 5; i++) members.push({ playerId: 'ember' + i, joinedAt: 0, role: 'member', isActive: true, activeSquadRaces: ['pirate'] });
    for (let i = 0; i < 4; i++) members.push({ playerId: 'mixed' + i, joinedAt: 0, role: 'member', isActive: true, activeSquadRaces: ['elf'] });
    const seed = (await mod.fetchClan(c.clanId)).clan;
    seed.members = members;
    seed.totalWeeksCompleted = 1; // not Uroboros
    mod._seedMockClan(c.clanId, seed);
    const elementPref = mod.computeClanElementPreference(seed);
    const pick = mod.pickWeeklyBoss(seed);
    return { elementPref, pick, racesMap: racesMod.RACE_TO_STIHIYA };
  });
  expect(result.elementPref).toBe('ember');
  // The pick should be a tide-element boss (counter to ember). Verify by
  // bossKey containing a known tide boss name. Tide bosses in CHAPTERS:
  // ABYSSAL TYRANT (Ch1), TIDESPIRE (Ch2), STORMSHEPHERD (Ch3),
  // ECLIPSE-WALKER (Ch4), MOTHER DEPTHS (Ch5).
  expect(result.pick).toMatch(/abyssal|tidespire|stormshepherd|eclipse|mother_depths/i);
});

test('[T3.04] maybeAutoRotateOnClanOpen — expired week (>7d) triggers rotation', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('roma', 'Brass Sparrows');
    const seed = (await mod.fetchClan(c.clanId)).clan;
    seed.weekStartedAt = Date.now() - (8 * 24 * 60 * 60 * 1000);
    mod._seedMockClan(c.clanId, seed);
    const r = await mod.maybeAutoRotateOnClanOpen(c.clanId);
    const after = await mod.fetchClan(c.clanId);
    return {
      ok: r.ok,
      rotated: r.rotated,
      weeklyTargetId: r.weeklyTargetId,
      afterTargetId: after.clan.weeklyTargetId,
    };
  });
  expect(result.ok).toBe(true);
  expect(result.rotated).toBe(true);
  expect(typeof result.weeklyTargetId).toBe('string');
  expect(result.afterTargetId).toBe(result.weeklyTargetId);
});

test('[T3.04] scaleBossDifficulty HARD cap — level 100 → 2.0 (ADR-003 no-P2W)', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    return {
      lvl1:   mod.scaleBossDifficulty(null, 1),
      lvl10:  mod.scaleBossDifficulty(null, 10),
      lvl20:  mod.scaleBossDifficulty(null, 20),
      lvl21:  mod.scaleBossDifficulty(null, 21),
      lvl100: mod.scaleBossDifficulty(null, 100),
    };
  });
  expect(result.lvl1).toBe(1.0);
  expect(result.lvl10).toBeCloseTo(1.45, 6);
  expect(result.lvl20).toBeCloseTo(1.95, 6);
  expect(result.lvl21).toBe(2.0);
  expect(result.lvl100).toBe(2.0);
});

test('[T3.04] cross-mechanic regression: T3.02 base CRUD + T3.03 UI shell still work', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('roma', 'Brass Sparrows');
    await mod.joinClan(c.clanId, 'kira');
    await mod.recordContribution(c.clanId, 'kira', 500);
    const f = await mod.fetchClan(c.clanId);
    return {
      ok: c.ok,
      memberCount: f.clan.members.length,
      kiraContrib: f.clan.weeklyContributions.kira.damage,
    };
  });
  expect(result.ok).toBe(true);
  expect(result.memberCount).toBe(2);
  expect(result.kiraContrib).toBe(500);
  expect(errors).toEqual([]);
});
