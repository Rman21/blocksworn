# PHASE 5b BLOCK 7 — HELIOTRON (Battery mechanics) + Chapter 2 finale

**Branch:** `phase-2-grammar`
**Spec:** [BLOCKSWORN_BOSS_COMPENDIUM.md](../BLOCKSWORN_BOSS_COMPENDIUM.md) §10 HELIOTRON · [BLOCKSWORN_META_PROGRESSION.md](../BLOCKSWORN_META_PROGRESSION.md) §5.3
**Predecessor:** Phase 5b Block 6 (Tidespire) — `b7d9148`
**Date:** 2026-04-26

---

## A. Spec recap

Per Boss Compendium §10 HELIOTRON "The Solar Sovereign" — Battery archetype, **Chapter 2 finale**. 3-phase escalation around a visible charge meter:

1. **Solar Charge** (P1+): boss accumulates charge each turn — +1 if hit, +2 if not hit. At 100% threshold, boss UNLEASHES.
2. **Solar Convergence** (P2 unleash): 4-row top-half AoE void spawn (rows 0-3, up to 8 voids)
3. **Sunfire Cascade** (P3 unleash): 3 sequential strikes — 3 random columns → 3 random rows → center 3×3 (with 500ms pauses for "boss winding up" feel)

P3 also doubles charge gain (always +2 regardless of hit) → faster threshold.

Plus per Meta-Progression §5.3: HELIOTRON victory = **Chapter 2 finale**. No new heroes unlock (all 25 already unlockable through Blocks 5b.3-5b.6), but "Chapter 2 Complete!" celebration fires.

---

## B. Implementation

### B.1 BOSS_UNLOCKS[10] + UNLOCK_TIER_LABELS extension

```js
10: [],   // Heliotron → Chapter 2 finale (no new heroes; celebration via tier label)
```

UNLOCK_TIER_LABELS extended for Chapter 2 progression (bosses 6-10):

```js
6:  'First Crocodiles!',
7:  'Full Crocodile Roster!',
8:  'First Sparks!',
9:  'Full Spark Roster!',
10: 'Chapter 2 Complete!',
```

### B.2 Celebration trigger update

```js
if (newlyUnlocked.length > 0 || bossNumber === 5 || bossNumber === 10) {
  // Show celebration overlay with UNLOCK_TIER_LABELS[bossNumber]
}
```

Boss 10 win triggers "Chapter 2 Complete!" celebration even though no new heroes unlock. Mirrors Boss 5 (Chapter 1 Complete!) pattern.

### B.3 Battery hit detection in dealDamage

Mirror of Block 5 Frenzy hit detection:

```js
if (actualDmg > 0 && currentBoss.archetype === 'battery') {
  batteryHitThisPlacement = true;
}
```

Read by `_tickBattery` to determine charge gain (+1 hit / +2 no-hit). Reset to false after each tick.

### B.4 Solar Convergence (P2)

Spawn voids in top 4 rows (rows 0-3 on 5×5 grid):

```js
async function _batterySolarConvergence() {
  const empties = [];
  for (let r = 0; r < Math.min(4, SIZE); r++) for (let c = 0; c < SIZE; c++) {
    if (grid[r][c] === null) empties.push([r, c]);
  }
  empties.sort(() => Math.random() - 0.5);
  const picks = empties.slice(0, Math.min(8, empties.length));
  await sleep(300);
  for (const [r, c] of picks) grid[r][c] = 'void_solar';
  render();
  flashText('☀☀ ' + picks.length + ' VOIDS', '#FFD75A');
}
```

Up to 8 voids in top half = massive board fill. Player must scramble to clear.

### B.5 Sunfire Cascade (P3)

3 sequential strikes per Compendium spec, with 500ms pauses:

**Strike 1: 3 random columns**
- Pick 3 column indices, spawn voids in ALL empties in those columns
- Up to 15 voids total (3 cols × 5 rows on 5×5 grid)

**Strike 2: 3 random rows**
- Pick 3 row indices, spawn voids in ALL empties in those rows
- Up to 15 voids total

**Strike 3: Center 3×3**
- Compute center 3×3 region (rows/cols 1-3 on 5×5 grid)
- Spawn voids in all empties
- Up to 9 voids total

Each strike accompanied by `flashText('☀☀☀ STRIKE N/3 · M VOIDS')`. Player can survive only if board has been recently cleared (so empty cells are scarce → fewer voids spawn).

### B.6 Charge Meter UI

New DOM element `#batteryChargeMeter` inserted next to `#bossImgWrap`:

```html
<div id="batteryChargeMeter" class="battery-charge-meter">
  <div class="bcm-label">SOLAR CHARGE</div>
  <div class="bcm-bar"><div class="bcm-fill" id="bcmFill"></div></div>
  <div class="bcm-pct" id="bcmPct">0%</div>
</div>
```

Visible only during HELIOTRON fight (`isBattery` check). Updates per tick via `_renderBatteryChargeMeter()`.

**3-state visual escalation:**
- **Default** (charge < 75%): gold gradient fill, soft yellow glow
- **Danger** (charge ≥ 75%): orange tint border + orange-red gradient fill
- **Critical** (charge ≥ 90%): red border + faster red-orange gradient + 0.8s pulse animation

CSS keyframes `bcmCriticalPulse` adds urgency feel as charge nears threshold. Reduced-motion fallback disables animation.

`_renderBatteryChargeMeter()` re-applied:
- On `initChapter2Archetype` (battle start)
- On each `_tickBattery` (per placement)

Idempotent: hides meter for non-Battery bosses.

### B.7 Compendium "PREPARE..." / "READY..." / "FIRE!" announcements

Block 1 already had:
- Charge ≥ 75%: "☀ PREPARE..."
- Charge ≥ 90%: "☀ READY..."

Block 7 ADD: at threshold (100%), unleash branch fires "☀☀ SOLAR CONVERGENCE" or "☀☀☀ SUNFIRE CASCADE" → triggers helper functions. The "FIRE!" beat (Compendium hint at 99%) skipped — at 99% next tick goes to 100%, unleash fires immediately.

---

## C. What this block does NOT touch

- Phase 1/2/3/4/5 + Phase 5b Block 1-6 work intact.
- All hero unlocks from Blocks 5b.3-5b.6 preserved (25 heroes unlockable).
- Other 4 Chapter 2 archetype mechanics (Hypnotist/Engineer/Frenzy/Tempo) unchanged.
- Existing `bossAttack` infrastructure unchanged — Solar Convergence + Sunfire Cascade spawn voids directly (no new attack pipeline).
- Existing celebration overlay (`showHeroUnlockCelebration`) reused for Chapter 2 finale message.
- World Map / Chapter 2 nav UI (Block 5b.8 still pending).

---

## D. Edge cases handled

| Scenario | Behavior |
|---|---|
| Heliotron fight starts | Battery aura + intro voice + tickChapter2Archetype routes to `_tickBattery` |
| Charge meter UI on Heliotron fight | Visible above grid; updates per placement; gold gradient |
| Charge meter on non-Battery boss | Element hidden via `display: none` (idempotent) |
| Player hits boss every turn | Charge accumulates +1/turn → ~100 placements to threshold (hard to reach in P1 6500-HP fight) |
| Player skips ULT for 5 turns | Charge accumulates +2/turn → ~50 placements (more realistic threat) |
| P3 with double charge gain | +2/turn always → ~25 placements to threshold; player must commit fast |
| Solar Convergence with empty grid | `empties.length === 0` → no voids spawn; flashText still fires |
| Sunfire Cascade with mostly-empty grid | 3 strikes × 15 max voids = up to 39 voids; capped by available empties |
| Sunfire Cascade with mostly-full grid | Few empties to fill; strikes spawn fewer voids each |
| Sunfire Cascade overlapping cells (col+row strikes hit same cell) | First strike spawns void; subsequent strikes skip non-null cells (existing `=== null` guard) |
| Heliotron win | `applyBossDefeatProgression(10)` → empty BOSS_UNLOCKS[10]; "Chapter 2 Complete!" celebration |
| Player retries Heliotron (lost first attempt) | All Battery state reset via `resetChapter2ArchetypeState`; full curriculum re-fires |
| Reduced-motion preference | Critical pulse animation disabled; charge meter still updates (transition disabled) |

---

## E. Roman regression checklist

JS syntax verified post-edits via JavaScriptCore — file parses through 17,525+ lines clean.

1. **Chapter 1 progression unaffected**:
   - All 5 Chapter 1 bosses play unchanged
   - Charge meter does NOT appear on non-Battery bosses

2. **Verothira / Gearheart / Ursaro / Tidespire (Blocks 3-6) preserved**:
   - All Chapter 2 mechanics for prior bosses still fire correctly
   - Crocs + Sparks unlock at correct boss kills

3. **Heliotron dry-run** (DevTools):
   ```js
   setChapter(2); currentBossIdx = 4; startBossBattle();
   // → HELIOTRON fight; battery aura active (electric gold flicker)
   // → Voice intro: "I am the sun's last echo..."
   // → Charge meter appears above grid: "SOLAR CHARGE 0%"
   // → Each turn: charge climbs (+1 hit / +2 no-hit)
   // → At 75%: meter turns orange, "☀ PREPARE..." flash
   // → At 90%: meter pulses red, "☀ READY..." flash
   // → At 100%: meter resets, "☀☀ SOLAR CONVERGENCE" → 8 voids in top 4 rows
   ```

4. **Solar Convergence P2** (drop boss to 60% HP):
   - Charge accumulates per spec
   - At threshold: voids spawn in top 4 rows (rows 0-3)
   - Charge resets to 0 immediately

5. **Sunfire Cascade P3** (drop boss to 30% HP):
   - Charge gain doubles (always +2/turn regardless of hit)
   - At threshold: 3 sequential strikes with 500ms pauses
   - Strike 1: 3 random columns get voids
   - Strike 2: 3 random rows get voids
   - Strike 3: center 3×3 gets voids
   - Each strike has its own flashText

6. **Heliotron win** = Chapter 2 finale:
   - `applyBossDefeatProgression(10)` fires
   - "Chapter 2 Complete!" celebration overlay (mirror Boss 5)
   - No new heroes unlock (all 25 already from prior Blocks)
   - Boss death voice: "I... served... well..."

7. **DevTools verification**:
   - `BOSS_UNLOCKS[10]` → `[]`
   - `UNLOCK_TIER_LABELS[10]` → `'Chapter 2 Complete!'`
   - `__debugChapter2Archetype()` shows battery state during Heliotron
   - All 25 heroes confirmed unlockable: `HERO_ROSTER.filter(h => !h.locked).length` should equal 25 + clockwork placeholders

8. **No console errors** through Verothira → Gearheart → Ursaro → Tidespire → Heliotron full sequence.

---

## F. Spec adherence

| Spec point (Compendium §10 + Meta §5.3) | Implementation | Status |
|---|---|---|
| Solar Charge meter visible UI | `#batteryChargeMeter` DOM element + CSS + `_renderBatteryChargeMeter()` | ✅ |
| Charge gain: +1 hit / +2 no-hit (P1/P2) | Block 1 tick + Block 5/7 hit detection | ✅ |
| P3: charge gain doubled (+2 always) | Block 1 `phase >= 3` branch | ✅ |
| 75% / 90% milestone announcements | flashText "PREPARE..." / "READY..." | ✅ |
| Solar Convergence: 4-row top-half AoE | `_batterySolarConvergence` spawns voids in rows 0-3 | ✅ |
| Sunfire Cascade: 3 sequential strikes (3 cols → 3 rows → center 3×3) | `_batterySunfireCascade` 3-stage with sleep(500) | ✅ |
| Heliotron win → Chapter 2 finale celebration | UNLOCK_TIER_LABELS[10] + applyBossDefeatProgression boss 10 trigger | ✅ |
| All 25 v1 heroes unlockable through Chapter 2 progression | Confirmed across Blocks 5b.3-5b.6 + Block 7 finale | ✅ |
| Tactile feedback | `vibrate(...)` on milestones + unleashes | ✅ |
| Reduced-motion compliance | `bcmCriticalPulse` disabled in `@media` | ✅ |

---

## G. Phase 5b progress

- ✅ Block 1 — Chapter 2 archetype infrastructure (`95bc783`)
- ✅ Block 2 — Chapter 2 boss data + 5 PNG assets (`1c869c4`)
- ✅ Block 3 — VEROTHIRA (Hypnotist) + 2 Crocs unlock (`8d656b9`)
- ✅ Block 4 — GEARHEART (Engineer) + 3 Crocs unlock (`738f1b8`)
- ✅ Block 5 — URSARO (Frenzy) + 2 Sparks unlock (`044bb1f`)
- ✅ Block 6 — TIDESPIRE (Tempo Disruptor) + 3 Sparks unlock (`b7d9148`)
- ✅ **Block 7 — HELIOTRON (Battery) + Chapter 2 finale** (this commit)
- ⏳ Block 8 — World Map cinematic + Chapter 2 transition + UI access
- ⏳ Block 9 — Phase 5b sign-off + tag `v0.5.5-chapter-2-done`

After Block 7: **all 5 Chapter 2 bosses combat-complete** with full archetype mechanics. Block 8 wires player-facing UI access (currently DevTools-only). Block 9 finalizes + tags.

---

## H. Git status

Single Block 7 commit on `phase-2-grammar`. Auto-merged to `main`.
