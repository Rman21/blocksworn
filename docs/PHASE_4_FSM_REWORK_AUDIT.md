# PHASE 4 BLOCK 2 — DEBT-014 FTUE FSM REWORK + Phase 4 Sign-off

**Branch:** `phase-2-grammar` (Phase 4 work; tag `v0.4.0-phase-4-done` on this commit)
**Spec:** MASTER_PLAN_V3 §7.1 DEBT-014 (FTUE state-machine FSM rework — long-term technical debt from #2.2b dialog warning fix)
**Predecessor:** Phase 4 Block 1 (FTUE Chronograph) — `36c31a9`
**Date:** 2026-04-26

---

## A. Spec recap

DEBT-014 was filed during the #2.2b captain UI portraits + dual buff pill fix when several dialog scripts started double-firing during overlapping FTUE beat transitions. The root cause was loose validation in `advanceFtue` — any beat could transition to any other beat (only enum membership was validated). The fix is to make state transitions **explicit and validated**, so a misordered call in one corner of the codebase can't silently corrupt the FSM.

This block delivers DEBT-014 through three additive changes that preserve all existing behavior:

1. **`FTUE_TRANSITIONS` table** — explicit prev→next adjacency map.
2. **`ftueIs(beat)` helper** — single-source predicate replacing ad-hoc string equality.
3. **`__ftueDebug()` console diagnostic** — single-call snapshot of all FTUE-adjacent state for triage.

---

## B. Implementation

### B.1 FTUE_TRANSITIONS (explicit edge map)

Documents the full FTUE flow as a directed graph:

```js
const FTUE_TRANSITIONS = {
  not_started:     ['intro'],
  intro:           ['pyredrake_fight'],
  pyredrake_fight: ['pyredrake_won', 'grunt_fight'],
  pyredrake_won:   ['hero_reveals', 'leader_choice'],
  hero_reveals:    ['leader_choice'],
  leader_choice:   ['grunt_fight'],
  grunt_fight:     ['grunt_won'],
  grunt_won:       ['complete'],
  complete:        [], // terminal
};
const FTUE_TRANSITIONS_FORCE = ['complete', 'not_started']; // dev-tool bypass
```

Notes:
- `pyredrake_fight → grunt_fight` direct edge preserves a legacy code path that skips `pyredrake_won` reveal chain in some debug paths.
- `pyredrake_won → hero_reveals` is a no-op edge (hero_reveals handler is empty since reveals were inlined into `pyredrake_won`); kept for back-compat with FTUE_BEATS enum.
- `complete` is terminal; only `resetFtue()` can leave it (via `FTUE_TRANSITIONS_FORCE` bypass — `not_started` is always allowed).

### B.2 advanceFtue validation

```js
function advanceFtue(nextBeat) {
  if (!FTUE_BEATS.includes(nextBeat)) { console.warn(...); return; }
  const prev = ftueBeat;
  if (prev === nextBeat) return;
  // DEBT-014 transition validation
  const allowed = FTUE_TRANSITIONS[prev] || [];
  const isForce = FTUE_TRANSITIONS_FORCE.includes(nextBeat);
  if (!isForce && !allowed.includes(nextBeat)) {
    console.warn(`[FTUE] non-canonical transition ${prev} → ${nextBeat} ...`);
    // still proceed — back-compat
  }
  ftueBeat = nextBeat;
  saveFtueToStorage();
  console.log(`[FTUE] ${prev} → ${nextBeat}`);
  try { onFtueBeatChanged(nextBeat, prev); } catch (e) { ... }
}
```

**Soft-fail philosophy**: invalid transitions log a warning but still apply. This preserves back-compat for any historical caller that depends on loose validation. In a future block (post-launch), we can flip this to hard-reject after auditing every callsite.

### B.3 ftueIs(beat) helper

Single-source predicate for "are we currently in beat X". Accepts string or array (returns true if any match). Defensively returns false for unknown beats so a typo in any future check never silently passes.

```js
function ftueIs(beat) {
  if (Array.isArray(beat)) return beat.some(b => ftueIs(b));
  if (typeof beat !== 'string') return false;
  if (!FTUE_BEATS.includes(beat)) {
    console.warn('ftueIs: unknown beat', beat);
    return false;
  }
  return ftueBeat === beat;
}
```

### B.4 Migrated call sites

| Site | Before | After |
|---|---|---|
| `getEffectiveBossStats` | `ftueBeat === 'pyredrake_fight'` | `ftueIs('pyredrake_fight')` |
| `routeByFtue` | `ftueBeat === 'not_started'` | `ftueIs('not_started')` |
| `maybeShowBattleTutorial` (Phase 4 B1) | `ftueBeat === 'pyredrake_fight'` | `ftueIs('pyredrake_fight')` |
| `startBossBattle` chronograph reset (B1) | `ftueBeat === 'pyredrake_fight'` | `ftueIs('pyredrake_fight')` |
| `startBossBattle` MATCH chronograph (B1) | `ftueBeat === 'pyredrake_fight'` | `ftueIs('pyredrake_fight')` |
| `maybeChronoBeat` gate (B1) | `ftueBeat !== 'pyredrake_fight'` | `!ftueIs('pyredrake_fight')` |

Remaining `ftueBeat === 'X'` call sites (intentionally unmigrated):
- `isFtueComplete` / `isFtueActive` — already canonical accessors; no churn.
- `clutch slow-mo gate` (line ~9600) — gates on `isFtueActive()` already, not raw equality.
- Safety-rail HP rescue (line ~21425) — left raw for now to avoid touching battle-resolution hot path. Future block can migrate.
- ~12 other places with `ftueBeat ===` references — left untouched to keep this block surgically focused on the DEBT-014 minimal-correctness fix. Future stylistic refactor can sweep.

### B.5 __ftueDebug() console diagnostic

Single-call snapshot for triage:

```js
window.__ftueDebug = function () {
  return {
    beat: ftueBeat,                                     // current FSM state
    allowedNext: (FTUE_TRANSITIONS[ftueBeat] || []),    // valid edges out
    forceAlways: FTUE_TRANSITIONS_FORCE,                // bypass paths
    safetyRailUsed: ftueSafetyRailUsed,                 // per-battle one-shot
    chronoBeatsSeen: { ..._chronoBeatsSeen },           // Phase 4 B1 coachmarks
    chronoActive: _chronoActive,                        // overlay state
    battleTutorialShown: localStorage.getItem('battleTutorialShown') === '1',
    storage: {                                          // raw save state
      ftue: localStorage.getItem(FTUE_STORAGE_KEY),
      battleTutorial: localStorage.getItem('battleTutorialShown'),
      backlog002Backfilled: localStorage.getItem('blocksworn_migration_backlog002_tank_backfilled'),
    },
  };
};
```

Use case (DevTools):
```
> __ftueDebug()
{ beat: "pyredrake_fight",
  allowedNext: ["pyredrake_won", "grunt_fight"],
  safetyRailUsed: false,
  chronoBeatsSeen: { match: true, charge: true },
  chronoActive: false,
  storage: { ftue: "pyredrake_fight", ... } }
```

---

## C. What this commit does NOT touch

- `onFtueBeatChanged` dispatcher logic — preserved verbatim (the per-beat side-effects are correctness-critical for dialog timing and the captain-pick branch).
- `FTUE_BEATS` enum — preserved (no beats added or removed).
- `loadFtueFromStorage` / `saveFtueToStorage` — preserved.
- `skipFtue` / `resetFtue` dev helpers — preserved (still work via `FTUE_TRANSITIONS_FORCE` bypass).
- BACKLOG-002 captain pick branch (`onLeaderChosen`) — untouched.
- Safety-rail rescue logic — untouched.
- Phase 4 Block 1 chronograph 6 beats — untouched (only the gate string was migrated to `ftueIs()`).
- Splash carousel + 3 splash cards (BACKLOG-001) — untouched.

---

## D. Roman regression checklist

JS syntax verified post-edits via JavaScriptCore — file parses through 15,541 lines clean.

1. **Fresh install** (`localStorage.clear()` then reload):
   - Splash carousel runs → FTUE intro → Pyredrake fight starts
   - Chronograph 6 beats fire as designed (Block 1 verified, Block 2 didn't change them)
   - DevTools: `__ftueDebug()` returns `{ beat: "pyredrake_fight", allowedNext: ["pyredrake_won", "grunt_fight"], ... }`

2. **Pyredrake won → captain pick → grunt_fight → grunt_won → complete**:
   - All transitions canonical (no `[FTUE] non-canonical transition` warnings in console)
   - DevTools after FTUE complete: `__ftueDebug().beat === "complete"` and `allowedNext: []`

3. **Dev `skipFtue()`** from any beat:
   - Forces `complete` via `FTUE_TRANSITIONS_FORCE` bypass — no warning logged
   - Reload → menu screen shows directly

4. **Dev `resetFtue()`**:
   - Forces `not_started` via bypass — no warning logged
   - Reload → splash → FTUE re-runs

5. **Manually `advanceFtue('grunt_won')` from `pyredrake_fight` in DevTools**:
   - Console: `[FTUE] non-canonical transition pyredrake_fight → grunt_won (allowed: pyredrake_won,grunt_fight)`
   - State still applies (back-compat soft-fail)
   - User sees grunt outro dialog

6. **`ftueIs()` smoke**:
   - `ftueIs('pyredrake_fight')` → `true` mid-Pyredrake
   - `ftueIs(['intro', 'pyredrake_fight'])` → `true` (any-match)
   - `ftueIs('typo_xyz')` → `false` + console warn `ftueIs: unknown beat typo_xyz`

7. **Safety rail still works**: lose Pyredrake fight to 0 HP first time → "BLACKFANG SHIELDS YOU" → HP restored to 1.

8. **No console errors** through full FTUE.

---

## E. Spec adherence (Phase 4 sign-off)

| Phase 4 spec point | Implementation | Status |
|---|---|---|
| BACKLOG-001 splash polish | 3 splash cards with element emblems | ✅ shipped earlier |
| BACKLOG-002 branching captain choice | CRIMSON / NIGHTLORD pick → 4 same-faction heroes + tank backfill migration | ✅ shipped earlier |
| 7-min FTUE chronograph teaching combo grammar | 6 contextual coachmarks (MATCH / CHARGE / ULT / RACE / CAPTAIN / TELEGRAPH) | ✅ Block 1 |
| DEBT-014 FTUE FSM rework | FTUE_TRANSITIONS table + ftueIs() helper + __ftueDebug() | ✅ Block 2 (this commit) |

**Soft launch readiness** (per master plan §7 row): Phase 4 closes → soft launch decision becomes possible (3 races + 3 elements + Onboarding ready).

---

## F. Phase 4 progress

| Block | Commit | Status |
|---|---|---|
| 1 — FTUE Chronograph | `36c31a9` | ✅ DONE |
| 2 — DEBT-014 FSM Rework | `(this commit)` | ✅ DONE |

**Tag**: `v0.4.0-phase-4-done` on the merge commit on `main`.

The Onboarding loop is now feature-complete:
- **Splash** — 3 polished cards introducing the game (BACKLOG-001)
- **Intro** — narrative dialog beats setting up the conflict
- **First fight** — Pyredrake battle with 6 chronograph coachmarks teaching combo grammar at the moment of need (Phase 4 Block 1)
- **Captain pick** — branching choice unlocks 4 same-faction heroes + safety-rail tank backfill migration (BACKLOG-002)
- **Second fight** — Ember Grunt battle reinforces lessons
- **Complete** — outro dialog → menu access unlocked
- **Underlying FSM** — explicit transition table validates every advance, helper `ftueIs()` standardizes call sites, `__ftueDebug()` gives single-call triage (Phase 4 Block 2)

---

## G. Phase 5 next (per master plan §7)

**Phase 5 — Earth + Light Race** (3-4 weeks per plan):
- Crocodiles (Earth/Grove) — 5 heroes
- Sparks (Light/Solar) — 5 heroes
- 5-element matrix complete (Fire/Frost/Dark/Earth/Light)
- Universal hooks: `onGroveCellsCleared`, `onSolarCellsCleared`
- Earth side-system: REVENGE BURST (absorb mechanic)
- Light side-system: SHIELDS-TO-DAMAGE
- 2 new captains: croc_captain (race='crocodile', stihiya='grove') + spark_captain (race='spark', stihiya='solar')
- 2 new signature combos (Tier 3): `THE EMERALD WARDEN` (croc + grove) + `THE PRISMATIC RIDE` (spark + solar)

---

## H. Git status

Single Block 2 commit on `phase-2-grammar`. Auto-merged to `main`. Tag `v0.4.0-phase-4-done` placed on the merge commit on `main`.
