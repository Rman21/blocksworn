# PHASE 3 BLOCK 2 — CLUTCH SLOW-MO

**Branch:** `phase-2-grammar` (Phase 3 work continues here pending Phase 3 sign-off tag)
**Spec:** [HERO_GRAMMAR.md](HERO_GRAMMAR.md) §1.1 The Moment · MASTER_PLAN_V3 §7 (Phase 3 — The Moment Mechanics)
**Predecessor:** Phase 3 Block 1 — Signature Combos (commit `281a5c1`)
**Date:** 2026-04-26

---

## A. Spec recap

Per master plan §1.1 — The Last Line:

> *"Ты на 1 HP. Босс на 8% HP. Следующий его удар — смерть. В tray падает Z-фигура. **2 секунды тишины.** Ты видишь: B3 → горизонталь из 4 ember-charged клеток → INFERNO multiplier × ULT BLACKTOOTH → cascade × CRIMSON race buff → boss dies с -2 HP в последний ход перед своей атакой."*

Clutch Slow-Mo IS those "2 seconds of silence" — a cinematic overlay that fires when the player is at 1 HP and the boss attack will land on the next placement. Gives the player decision space to read the board and find the saving move.

---

## B. Implementation

### B.1 Trigger condition

In `maybeBossAttack` (called from per-placement post-hook), AFTER `attackCountdown--` AND telegraph block:
```js
maybeFireClutchSlowMo();
```

`maybeFireClutchSlowMo()` gates:
- `_clutchSlowMoFired === false` (single fire per battle)
- `gameEnded === false`
- `hp === 1` (exactly 1 HP — not 0, not 2+)
- `attackCountdown <= 1` (boss attack imminent on next placement)
- FTUE safety-rail guard: skip if FTUE active AND safety rail not yet consumed (rail handles its own cinematic moment)

If all gates pass: set flag + `showClutchMoment()`.

### B.2 Cinematic overlay (`#clutchOverlay`)

Three-layer visual stack:
1. **Vignette** (`.clutch-vignette`) — radial gradient, edges deep black, center clear. Focus narrows.
2. **Cool-blue tint** (`.clutch-tint`) — radial blue overlay (tide stihiya color rgba). "Time slows" perception.
3. **Card** (`.clutch-card`) — centered banner with red border + red glow:
   - **Tier label**: `⚠ THE LAST LINE` (12px, letter-spaced)
   - **Name**: `CLUTCH MOMENT` (36px, bright red, dual text-shadow + pulse animation)
   - **Subtitle**: `ONE LIFE LEFT · ONE SHOT` (13px)

### B.3 Animation sequence

2.2s total over 3 phases (matches `clutchVignette` / `clutchTint` / `clutchCardEntry` keyframes):
- 0% → 18%: card scale-bounce in (0.55 → 1.10), vignette + tint fade in
- 18% → 78%: hold (card at 1.0 scale, name pulses red glow at 0.85s loop)
- 78% → 100%: fade out (card to 1.05 scale, all opacity → 0)

Setup `_clutchSlowMoFired = true` → `showClutchMoment` shows overlay → 2300ms `setTimeout` adds `.hidden` class back.

### B.4 Reduced-motion compliance

`@media (prefers-reduced-motion: reduce)`:
- All animation durations → 1.6s linear (no scale bounce)
- `.clutch-name` pulse animation disabled (static red glow)

### B.5 Tactile cue

`vibrate([100, 60, 140])` — strong → pause → stronger pulse pattern. Mimics heartbeat-skipping moment.

---

## C. State + lifecycle

| Variable | Where | Lifecycle |
|---|---|---|
| `_clutchSlowMoFired` (let, false) | Declared near `_signatureComboCinemaShown` | Reset in `startBossBattle` per-battle init block adjacent to signature combo cinema reset |

Per-battle one-shot — fires at most ONCE per battle, even if player drops to 1 HP, heals, then drops to 1 HP again. Future polish: could re-arm flag if player heals back above 1 HP (deferred).

---

## D. Edge cases handled

| Scenario | Behavior |
|---|---|
| Player at 1 HP, attackCountdown > 1 | No fire (condition unmet) |
| Player at 1 HP, attackCountdown ≤ 1 | Fire once |
| Player heals from 1 HP → 2 HP, drops to 1 HP again | No re-fire (single-shot flag) |
| Boss at 0 HP (just defeated) on same placement | `gameEnded` guard prevents fire |
| Phoenix immunity active when player at 1 HP | Cinematic still fires (immunity is boss-side, doesn't change player vulnerability) |
| FTUE safety-rail beat (first time player would die) | Skipped — rail's own cinematic handles the moment |
| Tower battles | Cinematic fires (no Tower-specific gate; treated as universal mechanic) |
| Reduced-motion preference | Animations linear 1.6s, no pulse |

---

## E. Roman regression checklist

JS syntax verified post-edits via JavaScriptCore (~4.45MB parses clean).

1. **Squad: 3 Pirates vs PYREDRAKE**, take damage to 1 HP → `attackCountdown` shows 1 → next placement triggers cinematic:
   - Full-screen vignette + cool-blue tint + red CLUTCH MOMENT banner appears.
   - `⚠ THE LAST LINE` small caps top, `CLUTCH MOMENT` huge red middle, `ONE LIFE LEFT · ONE SHOT` subtitle.
   - Auto-dismiss in ~2.3s.
   - Vibration if device supports it.

2. **Same scenario, second time** in same battle (unlikely — would require healing back to 2+ then dropping again):
   - No re-fire (single-shot per battle).

3. **Different boss (e.g. ABYSSAL TYRANT)**: same trigger when 1 HP + attackCountdown ≤ 1.

4. **Game ended on same placement** (player kills boss while at 1 HP with attack incoming):
   - No cinematic (gameEnded gate).

5. **Reduced-motion enabled** (system preference):
   - Cinematic plays without scale bounce or red name pulse.
   - Linear 1.6s fade.

6. **DevTools console**: `_clutchSlowMoFired` is `false` at battle start, `true` after firing, false again on next battle start.

7. **No console errors** through full Chapter 1 with various squads.

---

## F. Phase 3 progress

- ✅ Block 1 — Signature Combos (`281a5c1`)
- ✅ **Block 2 — Clutch Slow-Mo** (this commit)
- ❌ Block 3 — Death Flashback (defeat → recap of key moments)

After Block 3 → tag `v0.3.0-phase-3-done`.

---

## G. Git status

Single commit on `phase-2-grammar`. Auto-merged to `main` per Roman standing instruction.
