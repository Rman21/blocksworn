// Smoke test helpers. T1.10 populates the FTUE/battle stubs.
// 2026-05-11 — TASK-003 (T1.03): stub helpers, real impl deferred to T1.10+.

const LEGACY_PATH = '/docs/_legacy/_archive_v1/blocksworn_index_fixed.html';

export async function loadAuthenticatedState(page) {
  // T1.10 will populate (localStorage seeding for authenticated profile).
  // Stub: just goto the legacy file so dependent tests can navigate.
  await page.goto(LEGACY_PATH);
}

export async function loadStateWithCompleteFTUE(page) {
  // T1.10 will populate (localStorage seeding so FTUE is marked complete).
  await loadAuthenticatedState(page);
}

export async function playOptimalBattle(page, opts = {}) {
  // T1.10+ will implement a boss-aware optimal-play heuristic.
  throw new Error('playOptimalBattle stub — implement in T1.10');
}
