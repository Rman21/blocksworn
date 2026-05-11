// Smoke + visual-regression helpers. T1.10 populates the FTUE/battle stubs.
// 2026-05-11 — TASK-003 (T1.03): stub helpers, real impl deferred to T1.10+.
// 2026-05-11 — TASK-004 (T1.04): added setupState() for visual baseline capture.
//
// localStorage keys used by setupState() — discovered via:
//   grep -oE "localStorage\.(getItem|setItem|removeItem)\(['\"][^'\"]+['\"]" \
//     docs/_legacy/_archive_v1/blocksworn_index_fixed.html | sort -u
//
//   blocksworn_ftue_beat              FTUE FSM state (one of FTUE_BEATS, see legacy ~24064)
//   onboardingSeen = '1'              skip prologue/FTUE forever (legacy ~24411)
//   seenIntroVideo = '1'              skip first-launch intro video (legacy ~24355)
//   blocksworn_progress (JSON)        essences/heroUpgrades/bossesDefeated/chapterProgress
//   blocksworn_chapter_1_complete='true'  Ch1 finished — unlocks Tower (legacy ~57579)
//   blocksworn_squad (JSON array)     persisted active squad of hero ids
//   blocksworn_heroes_unlocked (JSON) unlocked hero ids
//   blocksworn_gold (string int)      gold balance
//
// FTUE beats (legacy ~24064):
//   not_started → chronicle_fight → chronicle_won → intro →
//   pyredrake_fight → pyredrake_won → hero_reveals → leader_choice →
//   grunt_fight → grunt_won → complete
//
// Strategy: we only seed the *minimum* keys required to reach a screen selector.
// We do NOT try to replay full gameplay. Battle screens that depend on live
// runtime state (chronicle / pyredrake mid-fight) are entered by setting
// ftueBeat to the *_fight beat and letting the legacy code's routeByFtue() do
// the rest on cold reload. Pure menu screens (shop / tower / season / etc.)
// are reached by seeding completion flags and calling the global navigation
// functions via page.evaluate() AFTER load.

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

export async function playOptimalBattle(page, _opts = {}) {
  // T1.10+ will implement a boss-aware optimal-play heuristic.
  throw new Error('playOptimalBattle stub — implement in T1.10');
}

// 2026-05-11 — TASK-004 (T1.04): seed legacy localStorage for visual baseline.
// Each state seeds the MINIMUM set of keys required to reach the target screen
// selector on first paint. Returns nothing — caller waits on selector after.
//
// IMPORTANT: legacy code has a save-version gate IIFE at ~line 18504 that runs
// on script-eval and calls `_wipeAllBlocksworn()` (removes every `blocksworn_*`
// key) if `blocksworn_save_version` is missing or < 2. To preserve our seeded
// keys across reload we MUST also stamp `blocksworn_save_version='2'`.
// SAVE_VERSION constant: legacy ~18481; gate IIFE: legacy ~18504.
//
// States supported:
//   'fresh'           — wipe localStorage, cold start (lands on FTUE chronicle)
//   'authenticated'   — onboardingSeen=1 + ftue=complete → menu after load
//   'in-battle'       — authenticated + click START on menu to enter battle
//   'ch1-complete'    — authenticated + chapter_1_complete=true → Tower unlocked
//   'ftue-chronicle'  — ftueBeat=chronicle_fight, cold start → battle screen vs CHRONICLE
//   'ftue-pyredrake'  — ftueBeat=pyredrake_fight, cold start → battle vs PYREDRAKE
export async function setupState(page, stateName) {
  // Build seed payload for the target state.
  const seed = buildSeed(stateName);
  // Use addInitScript so localStorage is primed BEFORE any legacy script runs
  // on the next navigation/reload. Without this, the legacy save-version gate
  // wipes any post-load setItem'd keys.
  await page.addInitScript((payload) => {
    try {
      // Clear FIRST, then write — guarantees clean slate per setup call.
      localStorage.clear();
      for (const [k, v] of payload) localStorage.setItem(k, v);
    } catch (_e) { /* private mode / quota — caller will see selector timeout */ }
  }, seed);
  await page.goto(LEGACY_PATH);
}

function buildSeed(stateName) {
  const SAVE_VERSION = '2'; // must match legacy SAVE_VERSION (~18481)
  // Every authenticated state pins the save-version flag so the IIFE gate
  // (~18504) doesn't wipe our seed.
  const base = [['blocksworn_save_version', SAVE_VERSION]];
  switch (stateName) {
    case 'fresh':
      return []; // pristine — let the save-version IIFE re-stamp from null
    case 'authenticated':
      return [
        ...base,
        ['onboardingSeen', '1'],
        ['seenIntroVideo', '1'],
        ['blocksworn_ftue_beat', 'complete'],
        // COMBAT v2.1 P8 First Contact name modal — pre-set so it doesn't
        // pop on first menu render (legacy ~48107 showFirstContactSequence).
        ['blocksworn_p8_player_name', 'TESTER'],
      ];
    case 'in-battle':
      return [
        ...base,
        ['onboardingSeen', '1'],
        ['seenIntroVideo', '1'],
        ['blocksworn_ftue_beat', 'complete'],
        ['blocksworn_p8_player_name', 'TESTER'],
      ];
    case 'ch1-complete':
      return [
        ...base,
        ['onboardingSeen', '1'],
        ['seenIntroVideo', '1'],
        ['blocksworn_ftue_beat', 'complete'],
        ['blocksworn_chapter_1_complete', 'true'],
        ['blocksworn_p8_player_name', 'TESTER'],
      ];
    case 'ftue-chronicle':
      // Cold-start FTUE at chronicle_fight beat. routeByFtue → onFtueBeatChanged
      // → startChronicleFtueBattle.
      return [
        ...base,
        ['seenIntroVideo', '1'],
        ['blocksworn_ftue_beat', 'chronicle_fight'],
      ];
    case 'ftue-pyredrake':
      return [
        ...base,
        ['seenIntroVideo', '1'],
        ['blocksworn_ftue_beat', 'pyredrake_fight'],
      ];
    default:
      throw new Error(`setupState: unknown state '${stateName}'`);
  }
}
