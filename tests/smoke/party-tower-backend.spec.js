// 2026-05-13 — TASK-055 (T3.10): Party Tower async architecture — smoke suite.
//
// Spec: docs/design/endgame-social.md §3 (Party Tower — async 2-5 coop)
//       + §15 ESC-03 Q3 ruling — 24h Standard default; 4h Competitive +
//         7-day Casual selectable per-party at creation.
//       + ADR-002 — async turn-based via Firestore, NOT WebRTC.
//       + ADR-003 — strict no-P2W; no whale-tier party expansion.
//
// Coverage strategy (ADR-004 hybrid coexistence):
//   - Vite-served `/` boots the new src/main.js shell. Party Tower backend
//     consumes via direct-import per T3.02/T3.06 precedent (no per-CRUD-op
//     window-bridge bloat).
//   - Legacy page loads without pageerrors (sacred regression contract).
//   - PARTY_MAX_SIZE = 5 HARD CAP verified end-to-end (6th join fails).
//   - Turn state machine verified: round-robin advance, owner-start gate,
//     end-turn order enforcement.
//   - Cross-mechanic regression: all prior Phase 2 + Wave 2/3/4 subsystems
//     continue to function after Party Tower backend wired.

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

test('[T3.10 LIVE] legacy single HTML still loads without pageerrors (Party Tower no-regression)', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(LEGACY_PATH);
  await page.waitForSelector('#screenMenu', { timeout: 30000 });
  expect(errors).toEqual([]);
});

test('[T3.10 LIVE] Vite shell boots; no party-backend bridge bloat (direct-import only)', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });
  // T3.10 should NOT add a window-bridge per CRUD op — direct-import
  // precedent (T3.02/T3.03/T3.05/T3.06). At most +1 minimal entry
  // documented in commit message if needed.
  const ops = await page.evaluate(() => ({
    createParty:    typeof window.__createParty,
    joinParty:      typeof window.__joinParty,
    startParty:     typeof window.__startParty,
    endTurn:        typeof window.__endTurn,
  }));
  expect(ops.createParty).toBe('undefined');
  expect(ops.joinParty).toBe('undefined');
  expect(ops.startParty).toBe('undefined');
  expect(ops.endTurn).toBe('undefined');
  expect(errors).toEqual([]);
});

test('[T3.10 LIVE] createParty + joinParty + startParty round-trip (mock-mode)', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/party-tower-backend.js');
    mod._resetMockPartyStore();
    const created = await mod.createParty('alice', 'standard');
    if (!created.ok) return { stage: 'create', result: created };
    const partyId = created.partyId;
    const j1 = await mod.joinParty(partyId, 'bob');
    if (!j1.ok) return { stage: 'join-bob', result: j1 };
    const started = await mod.startParty(partyId, 'alice');
    if (!started.ok) return { stage: 'start', result: started };
    const fetched = await mod.fetchParty(partyId);
    return {
      stage: 'ok',
      memberCount: fetched.party?.members?.length,
      state:       fetched.party?.state,
      turnIndex:   fetched.party?.turnIndex,
      timeoutMode: fetched.party?.turnTimeoutMode,
    };
  });

  expect(result.stage).toBe('ok');
  expect(result.memberCount).toBe(2);
  expect(result.state).toBe('active');
  expect(result.turnIndex).toBe(0);
  expect(result.timeoutMode).toBe('standard');
});

test('[T3.10 LIVE] PARTY_MAX_SIZE = 5 HARD CAP — 6th join fails with reason mentioning 5', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/party-tower-backend.js');
    mod._resetMockPartyStore();
    const c = await mod.createParty('alice', 'standard');
    const partyId = c.partyId;
    // Join 4 more (size 5; cap reached)
    await mod.joinParty(partyId, 'bob');
    await mod.joinParty(partyId, 'carol');
    await mod.joinParty(partyId, 'dave');
    await mod.joinParty(partyId, 'eve');
    // 6th join should fail
    const sixth = await mod.joinParty(partyId, 'frank');
    const fetched = await mod.fetchParty(partyId);
    return {
      sixthOk:     sixth.ok,
      sixthReason: sixth.reason,
      finalSize:   fetched.party?.members?.length,
    };
  });

  expect(result.sixthOk).toBe(false);
  expect(result.finalSize).toBe(5); // hard cap held
  // Reason should mention the cap value '5' or a synonym
  expect(String(result.sixthReason || '').toLowerCase()).toMatch(/full|cap|5|max/);
});

test('[T3.10 LIVE] PARTY_MIN_SIZE = 2 — cannot startParty with single member', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/party-tower-backend.js');
    mod._resetMockPartyStore();
    const c = await mod.createParty('alice', 'standard');
    const started = await mod.startParty(c.partyId, 'alice');
    const fetched = await mod.fetchParty(c.partyId);
    return {
      startedOk: started.ok,
      state:     fetched.party?.state,
    };
  });

  expect(result.startedOk).toBe(false);
  expect(result.state).toBe('pending'); // did NOT transition to active
});

test('[T3.10 LIVE] endTurn advances turnIndex round-robin; out-of-order endTurn rejected', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/party-tower-backend.js');
    mod._resetMockPartyStore();
    const c = await mod.createParty('alice', 'standard');
    await mod.joinParty(c.partyId, 'bob');
    await mod.joinParty(c.partyId, 'carol');
    await mod.startParty(c.partyId, 'alice');
    // turnIndex 0 = alice
    const wrongPlayer = await mod.endTurn(c.partyId, 'bob', {});
    const aliceEnd    = await mod.endTurn(c.partyId, 'alice', {});
    const after1 = await mod.fetchParty(c.partyId);
    const bobEnd      = await mod.endTurn(c.partyId, 'bob', {});
    const after2 = await mod.fetchParty(c.partyId);
    return {
      wrongPlayerOk: wrongPlayer.ok,
      aliceEndOk:    aliceEnd.ok,
      idxAfter1:     after1.party?.turnIndex,
      bobEndOk:      bobEnd.ok,
      idxAfter2:     after2.party?.turnIndex,
    };
  });

  expect(result.wrongPlayerOk).toBe(false);  // bob can't end on alice's turn
  expect(result.aliceEndOk).toBe(true);
  expect(result.idxAfter1).toBe(1);          // advanced to bob
  expect(result.bobEndOk).toBe(true);
  expect(result.idxAfter2).toBe(2);          // advanced to carol
});

test('[T3.10 LIVE] turn timeout modes: competitive/standard/casual yield 4h/24h/7d', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/party-tower-backend.js');
    return {
      competitive: mod.computeTurnTimeoutMs('competitive'),
      standard:    mod.computeTurnTimeoutMs('standard'),
      casual:      mod.computeTurnTimeoutMs('casual'),
    };
  });

  expect(result.competitive).toBe(4 * 60 * 60 * 1000);          // 4h
  expect(result.standard).toBe(24 * 60 * 60 * 1000);            // 24h (ESC-03 Q3 default)
  expect(result.casual).toBe(7 * 24 * 60 * 60 * 1000);          // 7 days
});

test('[T3.11 LIVE] sacred Tower retry ladder [100, 200, 400] BYTE-PERFECT via getTowerRetryLadder()', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/party-tower-backend.js');
    return {
      ladder:    mod.getTowerRetryLadder(),
      tier0Cost: mod.computeHeartsDrainCost(0),
      tier1Cost: mod.computeHeartsDrainCost(1),
      tier2Cost: mod.computeHeartsDrainCost(2),
      tier99:    mod.computeHeartsDrainCost(99),  // clamp
    };
  });

  expect(result.ladder).toEqual([100, 200, 400]);  // sacred §2.4 BYTE-PERFECT
  expect(result.tier0Cost).toBe(100);
  expect(result.tier1Cost).toBe(200);
  expect(result.tier2Cost).toBe(400);
  expect(result.tier99).toBe(400);  // clamp at last sacred entry
});

test('[T3.11 LIVE] sacred TOWER_PACTS registry — 30 base + 15 mythic = 45 total, all frozen', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/party-tower-backend.js');
    const towerMod = await import('/src/data/tower.js');
    const reg = mod.getTowerPactRegistry();
    return {
      baseCount:    Object.keys(towerMod.TOWER_PACTS_BASE).length,
      mythicCount:  Object.keys(towerMod.TOWER_PACTS_MYTHIC).length,
      mergedCount:  Object.keys(reg).length,
      baseFrozen:   Object.isFrozen(towerMod.TOWER_PACTS_BASE),
      mythicFrozen: Object.isFrozen(towerMod.TOWER_PACTS_MYTHIC),
      mergedFrozen: Object.isFrozen(reg),
    };
  });

  expect(result.baseCount).toBe(30);   // sacred §2.5
  expect(result.mythicCount).toBe(15); // sacred §2.5
  expect(result.mergedCount).toBe(45);
  expect(result.baseFrozen).toBe(true);
  expect(result.mythicFrozen).toBe(true);
  expect(result.mergedFrozen).toBe(true);
});

test('[T3.11 LIVE] recordHeartsDrain → drain history grows; pool exhaustion advances retryCount', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/party-tower-backend.js');
    mod._resetMockPartyStore();
    const c = await mod.createParty('alice');
    // 1-heart drain
    const r1 = await mod.recordHeartsDrain(c.partyId, 'alice', 1, 100);
    // Full exhaustion (current = 99 → drain 99 → exhaust → tier 1)
    const r2 = await mod.recordHeartsDrain(c.partyId, 'alice', 99, 100);
    const f = await mod.fetchParty(c.partyId);
    return {
      r1Ok:           r1.ok,
      r1Current:      r1.newCurrent,
      r2Ok:           r2.ok,
      r2RetryCount:   r2.newRetryCount,
      r2Current:      r2.newCurrent,
      historyLen:     f.party.sharedState.towerHearts.drainHistory.length,
    };
  });

  expect(result.r1Ok).toBe(true);
  expect(result.r1Current).toBe(99);
  expect(result.r2Ok).toBe(true);
  expect(result.r2RetryCount).toBe(1);   // advanced to tier 1
  expect(result.r2Current).toBe(200);    // tier 1 max
  expect(result.historyLen).toBe(2);
});

test('[T3.11 LIVE] captain-pick mode: only owner can startPactPick + submitPactVote', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/party-tower-backend.js');
    mod._resetMockPartyStore();
    const c = await mod.createParty('alice');
    await mod.joinParty(c.partyId, 'bob');
    await mod.startParty(c.partyId, 'alice');

    // Bob tries to start — should fail
    const bobStart = await mod.startPactPick(c.partyId, 'bob', 0, 999);
    // Alice (owner) starts — should succeed
    const aliceStart = await mod.startPactPick(c.partyId, 'alice', 0, 999);
    const pactId = aliceStart.activePick.candidates[0];
    // Alice submits — applies immediately
    const submit = await mod.submitPactVote(c.partyId, 'alice', pactId);
    const f = await mod.fetchParty(c.partyId);

    return {
      bobStartOk:    bobStart.ok,
      bobStartReason: bobStart.reason,
      aliceStartOk:  aliceStart.ok,
      candidateCount: aliceStart.activePick.candidates.length,
      submitOk:      submit.ok,
      submitApplied: submit.applied,
      submitSource:  submit.decisionSource,
      selectedLen:   f.party.sharedState.towerPacts.selected.length,
      activePickCleared: f.party.sharedState.towerPacts.activePick === null,
    };
  });

  expect(result.bobStartOk).toBe(false);
  expect(result.bobStartReason).toBe('not-authorized');
  expect(result.aliceStartOk).toBe(true);
  expect(result.candidateCount).toBe(3);   // PARTY_PACT_CANDIDATES_PER_PICK
  expect(result.submitOk).toBe(true);
  expect(result.submitApplied).toBe(true);
  expect(result.submitSource).toBe('captain');
  expect(result.selectedLen).toBe(1);
  expect(result.activePickCleared).toBe(true);
});

test('[T3.11 LIVE] replenishHearts at checkpoint resets to tier-0 max', async ({ page }) => {
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/services/party-tower-backend.js');
    mod._resetMockPartyStore();
    const c = await mod.createParty('alice');
    await mod.recordHeartsDrain(c.partyId, 'alice', 50, 50);
    const replen = await mod.replenishHearts(c.partyId);
    return { ok: replen.ok, current: replen.newCurrent, max: replen.newMax };
  });

  expect(result.ok).toBe(true);
  expect(result.current).toBe(100);
  expect(result.max).toBe(100);
});

test('[T3.10 LIVE] cross-mechanic regression — prior Phase 3 deliverables intact', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await seedAuthenticatedState(page);
  await page.goto(VITE_PATH);
  await page.waitForSelector('#screenMenu.active', { timeout: 30_000 });

  const bridgeShape = await page.evaluate(() => ({
    // Wave 2 Replay subsystem bridges
    startReplayCapture:           typeof window.__startReplayCapture,
    onBossDefeatedTrigger:        typeof window.__onBossDefeatedTrigger,
    // Wave 3/4 minimal bridges
    getPlayerClanCount:           typeof window.__getPlayerClanCount,
    // Wave 2 dispatchers (T2.B integration)
    dispatchIdentityFx:           typeof window.__dispatchIdentityFx,
    dispatchIdentityBossEvent:    typeof window.__dispatchIdentityBossEvent,
  }));

  expect(bridgeShape.startReplayCapture).toBe('function');
  expect(bridgeShape.onBossDefeatedTrigger).toBe('function');
  expect(bridgeShape.getPlayerClanCount).toBe('function');
  expect(bridgeShape.dispatchIdentityFx).toBe('function');
  expect(bridgeShape.dispatchIdentityBossEvent).toBe('function');
  expect(errors).toEqual([]);
});
