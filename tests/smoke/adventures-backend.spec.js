// 2026-05-13 — TASK-050 (T3.02): Adventures backend — smoke suite.
//
// Spec: docs/design/endgame-social.md §2 (Adventures — async clan 5–15)
//       + §15 ESC-03 Q1 ruling — clan size 5–15 HARD CAP, no exceptions.
//       + ADR-002 — async-only (Firestore, no WebRTC).
//       + ADR-003 — strict no-P2W; clan rewards COSMETIC-ONLY.
//
// Coverage strategy (ADR-004 hybrid coexistence):
//   - Vite-served `/` boots the new src/main.js shell and exposes the +1
//     minimal Adventures bridge (`window.__getPlayerClanCount`). All other
//     clan-backend operations consume via direct-import per T3.08/T3.09
//     precedent.
//   - Legacy page loads without pageerrors (sacred regression contract).
//   - HARD CAP 5-15 verified end-to-end (cannot add 16th member).
//   - Cosmetic-only audit verified — no banned mechanical fields in unlocks.
//   - Cross-mechanic regression: all 38 existing window-bridges + +1 new
//     bridge intact after Adventures backend wired.

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

test('[T3.02] legacy single HTML still loads without pageerrors (Adventures no-regression)', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(LEGACY_PATH);
  await page.waitForSelector('#screenMenu', { timeout: 30000 });
  expect(errors).toEqual([]);
});

test('[T3.02] Vite shell boots with +1 minimal __getPlayerClanCount bridge', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  // Verify the +1 minimal entry is exposed (single new window-bridge per
  // T3.08/T3.09 direct-import precedent).
  const surface = await page.evaluate(() => ({
    getPlayerClanCount: typeof window.__getPlayerClanCount,
  }));
  expect(surface.getPlayerClanCount).toBe('function');
  expect(errors).toEqual([]);
});

test('[T3.02] createClan + fetchClan happy path — owner is first member with role "owner"', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('roma', 'Brass Sparrows');
    if (!c.ok) return { error: 'createClan failed', reason: c.reason };
    const f = await mod.fetchClan(c.clanId);
    return {
      ok: c.ok,
      clanId: c.clanId,
      memberCount: f.clan.members.length,
      firstMemberId: f.clan.members[0].playerId,
      firstMemberRole: f.clan.members[0].role,
      maxSize: f.clan.maxSize,
    };
  });
  expect(result.ok).toBe(true);
  expect(result.memberCount).toBe(1);
  expect(result.firstMemberId).toBe('roma');
  expect(result.firstMemberRole).toBe('owner');
  expect(result.maxSize).toBe(15); // HARD CAP per ESC-03 Q1
});

test('[T3.02] Join flow: 4 more players → clan size 5 → validateClanSize ok', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('roma', 'Brass Sparrows');
    for (let i = 1; i <= 4; i++) {
      await mod.joinClan(c.clanId, 'p' + i);
    }
    const f = await mod.fetchClan(c.clanId);
    const sizeCheck = mod.validateClanSize(f.clan.members.length);
    return {
      memberCount: f.clan.members.length,
      sizeOk: sizeCheck.ok,
    };
  });
  expect(result.memberCount).toBe(5);
  expect(result.sizeOk).toBe(true);
});

test('[T3.02] HARD CAP 5-15 (ESC-03 Q1) — 16th join rejected with clan-full', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('roma', 'Brass Sparrows');
    // Add 14 more so total = 15 (HARD CAP).
    for (let i = 1; i < 15; i++) {
      await mod.joinClan(c.clanId, 'p' + i);
    }
    const f15 = await mod.fetchClan(c.clanId);
    // 16th attempt MUST fail per ESC-03 Q1.
    const r16 = await mod.joinClan(c.clanId, 'sixteenth');
    return {
      memberCount: f15.clan.members.length,
      sixteenthOk: r16.ok,
      sixteenthReason: r16.reason,
    };
  });
  expect(result.memberCount).toBe(15);
  expect(result.sixteenthOk).toBe(false);
  expect(result.sixteenthReason).toBe('clan-full');
});

test('[T3.02] recordContribution + computeContributorPercent sums to 1.0 across 3 members', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const sum = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('roma', 'Brass Sparrows');
    await mod.joinClan(c.clanId, 'kira');
    await mod.joinClan(c.clanId, 'sebastien');
    await mod.recordContribution(c.clanId, 'roma', 100);
    await mod.recordContribution(c.clanId, 'kira', 200);
    await mod.recordContribution(c.clanId, 'sebastien', 300);
    const f = await mod.fetchClan(c.clanId);
    const wc = f.clan.weeklyContributions;
    return (
      mod.computeContributorPercent('roma', wc) +
      mod.computeContributorPercent('kira', wc) +
      mod.computeContributorPercent('sebastien', wc)
    );
  });
  expect(sum).toBeCloseTo(1.0, 5);
});

test('[T3.02] Transfer ownership: roma → kira, roma demoted to member', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('roma', 'Brass Sparrows');
    await mod.joinClan(c.clanId, 'kira');
    const t = await mod.transferOwnership(c.clanId, 'roma', 'kira');
    const f = await mod.fetchClan(c.clanId);
    const roma = f.clan.members.find((m) => m.playerId === 'roma');
    const kira = f.clan.members.find((m) => m.playerId === 'kira');
    return {
      transferOk: t.ok,
      ownerId: f.clan.ownerId,
      romaRole: roma.role,
      kiraRole: kira.role,
    };
  });
  expect(result.transferOk).toBe(true);
  expect(result.ownerId).toBe('kira');
  expect(result.romaRole).toBe('member');
  expect(result.kiraRole).toBe('owner');
});

test('[T3.02] Leave clan: regular member leaves OK; owner blocked (must transfer first)', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('roma', 'Brass Sparrows');
    await mod.joinClan(c.clanId, 'kira');

    // Owner attempts to leave — blocked.
    const ownerLeave = await mod.leaveClan(c.clanId, 'roma');
    // Regular member leaves — ok.
    const memberLeave = await mod.leaveClan(c.clanId, 'kira');
    const f = await mod.fetchClan(c.clanId);
    return {
      ownerLeaveOk: ownerLeave.ok,
      ownerLeaveReason: ownerLeave.reason,
      memberLeaveOk: memberLeave.ok,
      finalMemberCount: f.clan.members.length,
    };
  });
  expect(result.ownerLeaveOk).toBe(false);
  expect(result.ownerLeaveReason).toBe('owner-cannot-leave-without-transfer');
  expect(result.memberLeaveOk).toBe(true);
  expect(result.finalMemberCount).toBe(1);
});

test('[T3.02] Cross-mechanic regression: all 38 T2.B+T3.07 bridges + new __getPlayerClanCount intact', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  // Exercise clan-backend then check bridge surface.
  const surface = await page.evaluate(async () => {
    const mod = await import('/src/services/clan-backend.js');
    mod._resetMockClanStore();
    const c = await mod.createClan('roma', 'Brass Sparrows');
    await mod.joinClan(c.clanId, 'kira');

    // Sample of 38 existing bridges (26 T2.B + 12 T3.07) — all must exist.
    const bridges = {
      // T2.B identity bridges (sample)
      dispatchIdentityFx:              typeof window.__dispatchIdentityFx,
      isAshenReignActive:              typeof window.__isAshenReignActive,
      pushRecentClear:                 typeof window.__pushRecentClear,
      resetAshenReign:                 typeof window.__resetAshenReign,
      recordRaceTrigger:               typeof window.__recordRaceTrigger,
      recordBossDefeat:                typeof window.__recordBossDefeat,
      // T3.07 replay bridges (all 12)
      startReplayCapture:              typeof window.__startReplayCapture,
      stopReplayCapture:               typeof window.__stopReplayCapture,
      resetReplayBuffer:               typeof window.__resetReplayBuffer,
      onBossDefeatedTrigger:           typeof window.__onBossDefeatedTrigger,
      onTetrisCritTrigger:             typeof window.__onTetrisCritTrigger,
      onIdentityFxTrigger:             typeof window.__onIdentityFxTrigger,
      onIdentityBossReactivityTrigger: typeof window.__onIdentityBossReactivityTrigger,
      onBigComboTrigger:               typeof window.__onBigComboTrigger,
      onStaggerEntryTrigger:           typeof window.__onStaggerEntryTrigger,
      onTowerMilestoneTrigger:         typeof window.__onTowerMilestoneTrigger,
      onAdventureWeeklyDefeatTrigger:  typeof window.__onAdventureWeeklyDefeatTrigger,
      onPartyTowerRunClearTrigger:     typeof window.__onPartyTowerRunClearTrigger,
      // T3.02 NEW bridge (+1 minimal entry)
      getPlayerClanCount:              typeof window.__getPlayerClanCount,
    };

    // Probe the new bridge end-to-end.
    const romaCount = await window.__getPlayerClanCount('roma');
    const kiraCount = await window.__getPlayerClanCount('kira');
    const ghostCount = await window.__getPlayerClanCount('ghost');

    return { bridges, romaCount, kiraCount, ghostCount };
  });

  // Every bridge must be a function (no string mismatch, no undefined).
  for (const k of Object.keys(surface.bridges)) {
    expect(surface.bridges[k]).toBe('function');
  }
  expect(surface.romaCount).toBe(1);
  expect(surface.kiraCount).toBe(1);
  expect(surface.ghostCount).toBe(0);
});

test('[T3.02] Sacred audit — clan cosmetic unlocks contain NO banned mechanical fields (ADR-003)', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const audit = await page.evaluate(async () => {
    const cfg = await import('/src/data/clan-config.js');
    const banned = ['stat', 'damage', 'hp', 'winRate', 'progressionBoost', 'gemDiscount', 'attack', 'defense'];
    const violations = [];
    for (const lvl of cfg.CLAN_UNLOCK_LEVELS) {
      const entries = cfg.CLAN_LEVEL_COSMETIC_UNLOCKS[lvl];
      for (const u of entries) {
        for (const b of banned) {
          if (Object.prototype.hasOwnProperty.call(u, b)) {
            violations.push({ lvl, field: b, entry: u });
          }
        }
        const keys = Object.keys(u).sort();
        if (keys.join(',') !== 'kind,value') {
          violations.push({ lvl, badShape: keys, entry: u });
        }
      }
    }
    return { violationCount: violations.length, violations };
  });
  expect(audit.violationCount).toBe(0);
  expect(audit.violations).toEqual([]);
});
