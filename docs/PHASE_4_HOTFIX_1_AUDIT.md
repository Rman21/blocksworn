# PHASE 4 HOTFIX #1 — Chronograph 2-phase split + overlay bleed fix

**Branch:** `phase-2-grammar`
**Spec:** Roman screenshot feedback — CHRONOGRAPH CHARGE overlay overlapping CAPTAIN PICK modal; structural request to split tutorial into "before captain pick" / "after captain pick" for AAA+ pacing
**Predecessor:** Phase 4 sign-off `v0.4.0-phase-4-done` (`2d044bd`)
**Date:** 2026-04-26

---

## A. Bug + design issue

### A.1 Visual bug
Roman's screenshot showed CHRONOGRAPH · STEP 2 / 6 · CHARGE overlay rendering on top of the CHOOSE YOUR WARCHIEF captain-pick modal. Spotlight pulse was positioned over the modal's title area (stale tray rect).

### A.2 Root cause
1. Player matched cells late in Pyredrake fight → `distributeChargeOnElementClear` queued a `setTimeout(220ms)` for the CHARGE chronograph beat targeting `.hero-card` rect.
2. Cascade resolved → boss died → victory modal shown.
3. setTimeout fired → `maybeChronoBeat('charge')` saw `ftueIs('pyredrake_fight') === true` (transition hadn't happened yet) → overlay shown on top of victory modal.
4. Player tapped victory modal CONTINUE (which is below z-index 9100, but somehow the click propagated — likely via the modal's own dismiss button being just outside the chrono-card's pointer-block area, or because the chrono-overlay had been queued but hadn't fully rendered yet).
5. `advanceFtue('pyredrake_won')` → hero reveals → `advanceFtue('leader_choice')` → captain pick modal.
6. Chronograph CHARGE overlay never received CONTINUE tap → stayed visible through all 3 transitions.

### A.3 Design issue (Roman's structural feedback)
The 6-beat chronograph was structurally bunched into a single FTUE state (`pyredrake_fight`), but:
- **Pyredrake fight squad** = 3 mixed-race prologue heroes (Grommar pirate-warrior + Blacktooth pirate-hunter + Frostweaver rock-mage) — no 3+ same-race, no captain.
- **RACE BUFF beat** can only fire when synergy bar emits a race pill (needs 3+ same race) → mechanically impossible during Pyredrake fight.
- **CAPTAIN DROP beat** can only fire from `applyCaptainUlt` → no captain in Pyredrake squad → impossible.

So 2/6 beats were dead code in Pyredrake. The proper structural fix is to split the chronograph into two narrative phases bracketing the captain-pick decision:

**PHASE A · BASICS** (Pyredrake fight, 4 beats):
- 1/4 MATCH — drag piece, line 3+
- 2/4 CHARGE — matches charge ULT
- 3/4 ULT — tap portrait to fire
- 4/4 BOSS TELEGRAPH — boss windup, plan ahead

**PHASE B · ADVANCED** (Grunt fight, 2 beats — squad now full faction with captain):
- 1/2 RACE BUFF — 3+ same-race → passive bonus
- 2/2 CAPTAIN DROP — captain ULT drops element-charged cells

This pacing maps to the player's narrative experience: basics → captain pick narrative beat → advanced lessons in second fight.

---

## B. Implementation

### B.1 Beat data structure (CHRONO_BEATS)

Added per-beat `phase`, `total`, `tier` fields:

```js
const CHRONO_BEATS = {
  match:     { phase: 'A', idx: 1, total: 4, tier: 'BASICS',   name: 'MATCH', body: '…' },
  charge:    { phase: 'A', idx: 2, total: 4, tier: 'BASICS',   name: 'CHARGE', body: '…' },
  ult:       { phase: 'A', idx: 3, total: 4, tier: 'BASICS',   name: 'ULT', body: '…' },
  telegraph: { phase: 'A', idx: 4, total: 4, tier: 'BASICS',   name: 'BOSS TELEGRAPH', body: '…' },
  race:      { phase: 'B', idx: 1, total: 2, tier: 'ADVANCED', name: 'RACE BUFF', body: '…' },
  captain:   { phase: 'B', idx: 2, total: 2, tier: 'ADVANCED', name: 'CAPTAIN DROP', body: '…' },
};
const CHRONO_PHASE_FTUE = { A: 'pyredrake_fight', B: 'grunt_fight' };
```

### B.2 Per-beat phase gate

`maybeChronoBeat()` now reads each beat's phase and gates on the matching FTUE state:

```js
const beat = CHRONO_BEATS[beatId];
const requiredFtue = CHRONO_PHASE_FTUE[beat.phase];
if (!ftueIs(requiredFtue)) return false;
```

PHASE A beats (match/charge/ult/telegraph) only fire during `pyredrake_fight`.
PHASE B beats (race/captain) only fire during `grunt_fight`.

### B.3 Force-dismiss in advanceFtue (the overlay-bleed fix)

```js
ftueBeat = nextBeat;
saveFtueToStorage();
// HOTFIX #1: dismiss any active chrono on FSM transition so a beat queued
// via setTimeout during the previous beat can't bleed into the next scene.
try {
  if (_chronoActive && typeof _hideChronoBeat === 'function') {
    _hideChronoBeat();
  }
} catch (e) {}
```

This is defense in depth: even if a chrono beat fired right before the FSM transition (race condition between cascade resolution and FSM advance), the overlay is force-cleared. The 380ms hide transition matches the CSS opacity transition so it fades cleanly rather than snapping.

### B.4 Reset gate widened

Reset now runs on entry to either `pyredrake_fight` or `grunt_fight`:

```js
if (ftueIs(['pyredrake_fight', 'grunt_fight'])) {
  resetChronoForFtueAttempt();
}
```

This resets all 6 seen-flags on each fight retry. Per-phase gates ensure only relevant beats can re-fire.

### B.5 Tip card UI update

Tier line now renders as `CHRONOGRAPH · BASICS · STEP 2 / 4` (or `· ADVANCED · STEP 1 / 2`). Phase label gets a slightly brighter shade (`#FFE899` vs base `#FFD53D`) and tighter letter-spacing for visual hierarchy:

```css
.chrono-tip-phase {
  color: #FFE899; font-weight: 800; letter-spacing: 0.22em;
}
```

Rebuilt via `innerHTML` in `_showChronoBeat` so the BASICS/ADVANCED label and N/total count stay in sync with the beat's phase data.

---

## C. Edge cases handled

| Scenario | Behavior |
|---|---|
| Last cascade kills Pyredrake while a chrono beat is queued | `advanceFtue('pyredrake_won')` force-dismisses any active overlay → captain pick modal appears clean |
| setTimeout fires after FSM transition | Per-phase gate (`ftueIs('pyredrake_fight')`) returns false → beat silently skipped |
| Player retries Pyredrake (lose first attempt) | All 6 seen-flags reset on `startBossBattle` entry to `pyredrake_fight` → BASICS beats re-fire fresh |
| Player retries Grunt (lose first attempt) | Same reset on `startBossBattle` entry to `grunt_fight` → ADVANCED beats re-fire fresh |
| Pyredrake won in <14 placements (TELEGRAPH never reaches countdown ≤ 2) | TELEGRAPH beat skipped → BASICS curriculum ends at 3 beats. Acceptable graceful fallback. |
| Player never fires captain ULT during Grunt fight | CAPTAIN beat never shows → ADVANCED curriculum ends at 1 beat. Acceptable. |
| Reduced motion | Pulse animation disabled, card entry linear 0.3s (no change to existing CSS) |

---

## D. Roman regression checklist

JS syntax verified post-edits via JavaScriptCore — file parses through 15,575+ lines clean.

1. **Fresh install + win Pyredrake → captain pick → win Grunt**:
   - PHASE A beats fire during Pyredrake (MATCH 1/4, CHARGE 2/4, ULT 3/4, TELEGRAPH 4/4 once countdown ≤ 2)
   - On Pyredrake win: CHRONOGRAPH overlay auto-dismisses if still up (force-hide on advanceFtue)
   - Captain pick modal appears CLEAN (no overlay residue)
   - On captain pick: 4 same-faction heroes unlock, advanceFtue('grunt_fight')
   - PHASE B beats fire during Grunt fight (RACE 1/2 when synergy pill renders, CAPTAIN 2/2 after captain ULT)

2. **Lose Pyredrake → retry**:
   - PHASE A beats reset → re-fire on second attempt

3. **Lose Grunt → retry** (if reachable):
   - PHASE B beats reset → re-fire on second attempt
   - PHASE A beats also reset but can't fire (gated to `pyredrake_fight`)

4. **DevTools console**:
   - `__ftueDebug()` shows `chronoBeatsSeen` map and `chronoActive` boolean
   - `__chronoState()` per-phase view
   - During Pyredrake: `__chronoFire('race')` → returns false (phase mismatch)
   - During Grunt: `__chronoFire('match')` → returns false (already seen OR phase mismatch)

5. **Visual**: tier line reads `CHRONOGRAPH · BASICS · STEP 2 / 4` during Pyredrake, `CHRONOGRAPH · ADVANCED · STEP 1 / 2` during Grunt. BASICS/ADVANCED label slightly brighter than the rest of the tier line.

6. **No console errors** through full FTUE.

---

## E. What this hotfix does NOT touch

- FTUE FSM (advanceFtue, FTUE_TRANSITIONS, ftueIs) — only added one defensive force-dismiss
- DEBT-014 changes from Phase 4 Block 2 — preserved
- BACKLOG-001 splash polish, BACKLOG-002 captain pick — untouched
- All Phase 1/2/3 work — untouched
- Coachmark CSS animations + reduced-motion compliance — preserved

---

## F. Git status

Single hotfix commit on `phase-2-grammar`. Auto-merged to `main`. Tag `v0.4.1-hotfix-1` placed on the merge commit.
