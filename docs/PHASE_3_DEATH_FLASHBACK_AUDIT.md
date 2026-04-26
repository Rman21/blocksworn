# PHASE 3 BLOCK 3 — DEATH FLASHBACK + Phase 3 Sign-off

**Branch:** `phase-2-grammar` (Phase 3 work continues here; tag `v0.3.0-phase-3-done` on this commit)
**Spec:** [HERO_GRAMMAR.md](HERO_GRAMMAR.md) §1.1 The Moment · MASTER_PLAN_V3 §7 (Phase 3 — The Moment Mechanics)
**Predecessors:** Block 1 (Signature Combos `281a5c1`) · Block 2 (Clutch Slow-Mo `dce7a9d`)
**Date:** 2026-04-26

---

## A. Spec recap

Per master plan §7 — Phase 3 has 3 mechanics:
1. ✅ Signature Combos (Block 1)
2. ✅ Clutch Slow-Mo (Block 2)
3. ✅ **Death Flashback** (this commit)

Death Flashback shows on player defeat — a recap of the battle's key moments helps the player understand what happened, what worked, what didn't. The "highlight reel" cinematic before the defeat modal.

---

## B. Implementation

### B.1 Battle event log

```js
let battleEventLog = [];                 // { type, time, label, sub, color }[]
function logBattleEvent(type, label, sub, color) { ... }  // capped at 30 entries
```

Reset on `startBossBattle` adjacent to clutch + signature combo cinema flags.

### B.2 Trigger sites — 6 event types

| Type | Where logged | Label format | Color |
|---|---|---|---|
| `ult` | `ultRoleDispatch` after mission tracking | `HERO_NAME · ULT_ABILITY` | hero stihiya color |
| `crit` | `dealDamage` after `floatDamage` (gated: `critMult ≥ 2.0` OR `actualDmg ≥ 600`) | `HERO_NAME · CRIT ×N.N` or `· BIG HIT` | gold `#FFD53D` |
| `signature` | `showSignatureComboCinematic` end | combo name (e.g. `THE GOLDEN HOARD`) | combo color |
| `clutch` | `showClutchMoment` end | `CLUTCH MOMENT` | red `#FF4D4D` |
| `enrage` | `maybeEnrageBerserker` after enrage commits | `BOSS ENRAGED` | red `#E85D4A` |
| `phoenix` | `maybePhoenixRevive` after revive commits | `PHOENIX REVIVES` | orange `#FF6600` |

All wrapped in `try/catch` so log failures never break combat. Skipped when `gameEnded === true` (post-end fluff).

### B.3 Cinematic overlay (`#deathFlashback`)

Full-screen overlay (z-index 9999), shown by `showDeathFlashback(onDismiss)`:
- Dark radial backdrop with red center tint (`dfBgFade` 0.6s)
- Centered card with 2px red border + glow (`dfContentEntry` 0.55s scale-in)
- Title: `FLASHBACK` (28px bright red, dual text-shadow)
- Subtitle: `YOUR LAST FIGHT` (11px small caps)
- Event list: top **5** events from log, **deduplicated by type** (1 per type, most recent kept), in chronological order
- Each event card: 1px border in event color + drop-shadow halo, label + optional sub-line
- Stagger-in: each card fades+slides from left, 0.30s apart
- `CONTINUE` button — fire button styled, dismisses overlay + invokes `onDismiss` callback

Empty-log fallback: shows `A valiant effort. The grid was unforgiving.` placeholder so the modal doesn't render blank.

### B.4 Hook into defeat flow

`showDefeatModal` body extracted into `_showDefeatModalBody()`. Outer wrapper:
1. Set `gameEnded = true`
2. Award post-battle XP
3. **Show flashback** (with `_showDefeatModalBody` as `onDismiss`) — flashback fires for non-FTUE / non-Tower battles
4. Player taps `CONTINUE` → flashback hides → defeat modal shows

Robust fallback: if `showDeathFlashback` throws or doesn't exist, modal proceeds immediately. FTUE-only Pyredrake + Tower battles bypass flashback entirely (matches voice-line + signature-cinematic gating).

### B.5 Reduced-motion compliance

`@media (prefers-reduced-motion: reduce)`:
- All animations duration → 0.3s linear (no scale-in, no slide-from-left)

### B.6 Tactile cue

`vibrate([200, 100, 200])` — somber long-pulse on flashback open. Distinct from clutch's quick heartbeat-skip pattern.

---

## C. Edge cases handled

| Scenario | Behavior |
|---|---|
| FTUE Pyredrake defeat | Flashback skipped (FTUE has its own flow) |
| Tower battle defeat | Flashback skipped |
| Empty log (instant defeat, e.g. boss attack on first placement) | Shows "A valiant effort..." placeholder, then CONTINUE → modal |
| Multiple ULTs from same hero | Only most recent ULT entry kept (dedup by type) |
| Multiple crits | Only most recent crit entry kept |
| Signature combo + clutch + enrage + ULT + crit + phoenix | All 6 types appear in flashback (max 5 entries shown — earliest-of-type dropped if > 5) |
| Reduced-motion preference | Animations linear 0.3s, no scale/slide |
| `showDeathFlashback` throws | Modal proceeds anyway (try/catch) |

---

## D. Roman regression checklist

JS syntax verified post-edits via JavaScriptCore (~4.46MB parses clean).

1. **Pirate squad vs PYREDRAKE — lose to boss attack at 1 HP**:
   - Flashback overlay shows BEFORE defeat modal
   - Title: `FLASHBACK`, subtitle: `YOUR LAST FIGHT`
   - Event list shows last hero ULT + crit + signature combo (if active) + clutch (if triggered) + boss enrage (PYREDRAKE-specific)
   - CONTINUE button → flashback hides → defeat modal appears with `TRY AGAIN`

2. **Squad vs SOLAR PHOENIX — lose after boss revives**:
   - Flashback shows `PHOENIX REVIVES` event in recap

3. **Quick defeat (turn 1, 2 placements)**:
   - Empty event log → shows `A valiant effort. The grid was unforgiving.` placeholder
   - CONTINUE → defeat modal

4. **FTUE Pyredrake defeat**:
   - No flashback (FTUE skipped) → defeat modal directly

5. **Tower battle defeat**:
   - No flashback → defeat modal directly

6. **Reduced-motion enabled** (system preference):
   - Flashback shows but with linear 0.3s animations (no scale/slide)

7. **DevTools console** during fight: `console.log(battleEventLog)` shows growing array of event entries. Reset to `[]` on next `startBossBattle`.

8. **No console errors** through any defeat scenario.

---

## E. Phase 3 sign-off

All 3 Phase 3 blocks complete:

| Block | Commit | Status |
|---|---|---|
| 1 — Signature Combos (THE GOLDEN HOARD / DARK ENCORE / FROST DEEP) | `281a5c1` | ✅ DONE |
| 2 — Clutch Slow-Mo (1 HP + boss attack incoming → "2 seconds of silence") | `dce7a9d` | ✅ DONE |
| 3 — Death Flashback (event log → cinematic recap on defeat) | `(this commit)` | ✅ DONE |

**Tag**: `v0.3.0-phase-3-done` on the merge commit on `main`.

The Moment Mechanics shipped — Phase 3 closes. The Last Line cinematic loop is now feature-complete:
- **Build-up** — Signature Combo cinematic at battle start announces the high-power squad identity
- **Crisis** — Clutch Slow-Mo at 1 HP gives the player the "2 seconds of silence" decision moment
- **Aftermath** — Death Flashback recaps the highlight reel on defeat (or implied on victory by lack-of-flashback)

---

## F. Phase 4 next (per master plan §7)

**Phase 4 — Onboarding Rebuild** (2 weeks per plan):
- 7-min FTUE design teaching the combo grammar
- Branching captain choice (✅ already shipped via BACKLOG-002)
- DEBT-014 FTUE FSM rework

Most of Phase 4 backlog is already done from prior polish passes (BACKLOG-001 splash polish + BACKLOG-002 branching captain). Remaining Phase 4 work is the **7-minute FTUE chronograph** + **DEBT-014 dialog FSM rework**.

---

## G. Git status

Single Block 3 commit on `phase-2-grammar`. Auto-merged to `main`. Tag `v0.3.0-phase-3-done` placed on the merge commit.
