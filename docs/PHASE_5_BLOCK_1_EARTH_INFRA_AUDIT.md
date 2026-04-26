# PHASE 5 BLOCK 1 — Earth/Grove Infrastructure

**Branch:** `phase-2-grammar` (Phase 5 work continues here)
**Spec:** [BLOCKSWORN_COMBAT_REFERENCE.md](../BLOCKSWORN_COMBAT_REFERENCE.md) §3.3 Earth/Grove · §11 Universal Infrastructure · §15 Damage Pipeline step 2 · MASTER_PLAN_V3 §7 row 5 (Phase 5 — Earth + Light Race)
**Predecessor:** Combat Reference v2.0 doc-sync (`6cad86f`)
**Date:** 2026-04-26

---

## A. Spec recap

Per Combat Reference §3.3 — EARTH (in-world: GROVE):

> **Core mechanic:** Earth-cells absorb boss damage instead of player HP. Hunter detonates accumulated absorbed damage as burst.
> **Side-system state:** `earthCells` array, each tracks accumulated absorbed damage.
> **Cap:** REVENGE BURST 4-row line при absorbed damage ≥ threshold (1000 candidate).
> **Universal hooks:** `onGroveCellsCleared(n)`, `consumeEarthCells()`, `absorbBossDamage(amount)`.
> **Identity:** "Терпеть и наказать. Tank-and-spank."

This block ships the **infrastructure layer**: state model, universal hooks, defensive-pipeline absorb integration, Hunter consume helper, REVENGE BURST cap banner. **Hero-level abilities ship in Phase 5 Block 2** (Crocodiles).

---

## B. Implementation

### B.1 State model

```js
let groveAbsorbedByCell       = new Map();    // 'r_c' → absorbed damage amount
let groveTotalAbsorbed        = 0;             // running sum
const GROVE_REVENGE_THRESHOLD = 1000;          // → REVENGE BURST banner
const GROVE_REVENGE_LINE_CAP  = 4;             // Hunter detonate line-width cap
let groveRevengeFired         = false;         // per-battle one-shot banner
```

**Per-cell granularity (Map, not array)** — keys are grid cell positions (`'r_c'`), values are accumulated absorbed damage on that specific cell. Preserved for future tier mechanics:
- IRONSCALE Phase 5 Block 2: "Auto-convert hits to earth-cells" — incoming hit creates a NEW earth-cell at impact site
- Per-cell caps for difficulty curves (post Phase 5)

### B.2 `onGroveCellsCleared(n)` universal hook

Mirrors `onTideCellsCleared` / `onUmbraCellsCleared` pattern. Wired into `clearLines` processing alongside the other 2 element hooks:

```js
onGroveCellsCleared(counts.grove || 0);
```

Block 1 status: **plumbed but no-op past gate validation**. Earth-cells are CREATED by Earth Warrior placement (MOSSJAW Bedrock Bastion in Phase 5 Block 2), not by passive grove clears. Hook reserved so Block 2 hero abilities (e.g. MOSSWEAVER Verdant Surge per-clear amp counter) wire without further infrastructure changes.

### B.3 `absorbBossDamage(amount)` defensive pipeline

Inserted in player-damage flow at Combat Ref §15 defensive pipeline step 2 (after Berserker amplifier + SANCTUARY, before shield/HP):

```js
if (newDead > 0) {
  const _absorbed = newDead;
  newDead = absorbBossDamage(newDead);
  if (newDead === 0 && _absorbed > 0) {
    flashText('EARTH ABSORBED · ' + _absorbed, STIHIYA_COLORS.grove);
    vibrate([60, 40, 60]);
  }
}
if (newDead > 0) { /* shield/HP fallback unchanged */ }
```

**Behavior:**
- Returns the original `amount` if no earth-cells exist (squad has no Earth Warrior yet, OR none placed)
- If earth-cells exist: distribute `amount` evenly across cells (per-cell `+= amount / cellCount`), accumulate `groveTotalAbsorbed += amount`, return `0` (full absorption — Block 1 has no per-cell cap)
- Triggers `maybeFireRevengeBurst()` for cap detection
- Gated by `MOTIFS_ENABLED.grove` so non-grove battles short-circuit

**Block 2 may add per-cell caps** for difficulty curve (e.g. each cell absorbs max 250 dmg before overflow to shield/HP).

### B.4 `consumeEarthCells()` Hunter helper

Single-shot drain consumed by THORNBACK Vengeance Quake (Phase 5 Block 2):

```js
function consumeEarthCells() {
  const total = groveTotalAbsorbed;
  groveAbsorbedByCell.clear();
  groveTotalAbsorbed = 0;
  return total;
}
```

Returns sum for Hunter ULT damage payload (subject to FIRE_MULT_CAP in `dealDamage` stack). `groveRevengeFired` NOT reset on consume — per-battle one-shot banner flag, only resets in `startBossBattle`.

### B.5 `maybeFireRevengeBurst()` cap banner

Once per battle when `groveTotalAbsorbed ≥ GROVE_REVENGE_THRESHOLD` (1000):

```js
function maybeFireRevengeBurst() {
  if (groveRevengeFired) return;
  if (groveTotalAbsorbed < GROVE_REVENGE_THRESHOLD) return;
  groveRevengeFired = true;
  flashText('REVENGE BURST!', STIHIYA_COLORS.grove);
  vibrate([60, 40, 60, 40, 120]);
}
```

Visual consistency with INFERNO! / SHATTER VOLLEY! / ENCORE-OF-ENCORE! cap banners — same `flashText` API, element-color tint. Vibrate triple-pulse distinct from clutch's heartbeat-skip.

### B.6 Per-battle reset

Added in `startBossBattle` adjacent to cryomindWeave reset block:

```js
if (groveAbsorbedByCell && typeof groveAbsorbedByCell.clear === 'function') {
  groveAbsorbedByCell.clear();
} else {
  groveAbsorbedByCell = new Map();
}
groveTotalAbsorbed = 0;
groveRevengeFired  = false;
```

Defensive Map re-init handles edge case if anyone overwrote the Map ref elsewhere.

### B.7 Console diagnostic

`window.__debugGrove()` — single-call snapshot for triage:

```js
{
  enabled: true,
  cellCount: 3,
  perCellAbsorbed: [['2_4', 250], ['3_4', 250], ['4_4', 250]],
  totalAbsorbed: 750,
  revengeThreshold: 1000,
  revengeFired: false,
  revengeProgress: '75%'
}
```

---

## C. What this block does NOT touch

- All Phase 1/2/3/4 work intact.
- Existing grove mechanics (groveDefense, bloomTokens, stonemason) untouched — those are separate "grove damage REDUCTION" path (subtracts cells from boss attack `n`). New absorption path is "grove damage REDIRECTION" (full damage absorbed by cells, not subtracted upfront).
- No Crocodile heroes yet (Phase 5 Block 2).
- No new hero ULT — Hunter detonate side will be wired in Block 2 via THORNBACK.
- No cells CREATED in Block 1 — earth-cells are created by Earth Warrior placement (Block 2).

---

## D. Edge cases handled

| Scenario | Behavior |
|---|---|
| No earth-cells exist (no Earth Warrior in squad) | `absorbBossDamage` returns input unchanged → falls through to shield/HP path |
| `MOTIFS_ENABLED.grove === false` | All hooks short-circuit; safe to ship before Phase 5 Block 2 |
| `groveAbsorbedByCell.clear` not available (somehow Map overwritten) | Defensive re-init in `startBossBattle` |
| Multiple absorptions in one battle reach threshold | REVENGE BURST banner fires ONCE (per-battle flag), subsequent absorptions silent |
| Player retries battle | All grove state resets in `startBossBattle` reset block |
| Hunter consumes empty earth-cells (0 total) | Returns 0 — Hunter ULT falls back to flat damage primer-shot pattern (per Combat Ref §4 Hunter rule) |
| Cells cleared from grid but absorbed damage still tracked | NOT a concern — Map keys are grid positions; if cell cleared, absorbed dmg stays in Map, sums into next consume. Future polish (Phase 5 Block 2) may reconcile. |

---

## E. Roman regression checklist

JS syntax verified post-edits via JavaScriptCore — file parses through 15,720+ lines clean.

1. **Smoke test — fresh battle, no Earth heroes**:
   - Grove state initializes (`__debugGrove()` shows `cellCount: 0, totalAbsorbed: 0`)
   - Boss attacks normally → shield/HP path unchanged
   - No "EARTH ABSORBED" flash
   - No "REVENGE BURST!" banner

2. **Manual injection test (DevTools)**:
   ```js
   groveAbsorbedByCell.set('2_4', 0);  // simulate one earth-cell at row 2 col 4
   __debugGrove() // → { cellCount: 1, totalAbsorbed: 0, ... }
   ```
   - Take a boss hit → "EARTH ABSORBED · N" flash → no HP/shield loss
   - `__debugGrove().totalAbsorbed` increments
   - Multiple hits accumulate; at 1000 → "REVENGE BURST!" banner fires once
   - Subsequent hits keep accumulating but no re-fire of banner

3. **Manual consume test**:
   ```js
   consumeEarthCells()  // → returns groveTotalAbsorbed (e.g. 1500)
   __debugGrove()       // → { cellCount: 0, totalAbsorbed: 0, revengeFired: true }
   ```
   - Earth-cells map drained
   - `revengeFired` stays true (per-battle one-shot)

4. **Battle restart**:
   - All grove state resets to fresh (`cellCount: 0, totalAbsorbed: 0, revengeFired: false`)

5. **No console errors** through full Chapter 1 with non-Earth squad (no regression to existing combat).

6. **DevTools console**: `__debugGrove()` returns full snapshot.

---

## F. Spec adherence

| Spec point (Combat Ref §3.3 + §11 + §15) | Implementation | Status |
|---|---|---|
| Earth-cells absorb boss damage instead of HP | `absorbBossDamage()` returns 0 if cells exist | ✅ |
| Per-cell accumulation | `groveAbsorbedByCell` Map keyed by `'r_c'` | ✅ |
| `onGroveCellsCleared(n)` universal hook | Plumbed in `clearLines` dispatch | ✅ (no-op past gate; Block 2 wires) |
| `absorbBossDamage(amount)` | In `bossAttack` flow, defensive pipeline step 2 | ✅ |
| `consumeEarthCells()` Hunter helper | Returns sum, drains state | ✅ |
| REVENGE BURST cap at 1000 absorbed | `maybeFireRevengeBurst` + once-per-battle flag | ✅ |
| Cap banner visual consistency | `flashText('REVENGE BURST!', STIHIYA_COLORS.grove)` | ✅ |
| MOTIFS_ENABLED.grove gating | All hooks short-circuit if disabled | ✅ |
| Reduced-motion compliance | No animation added in Block 1 (banner is plain `flashText`, already reduced-motion-safe) | ✅ |
| Per-battle reset | `startBossBattle` adjacent to other element resets | ✅ |

---

## G. Phase 5 progress

- ✅ **Block 1 — Earth/Grove Infrastructure** (this commit)
- ⏳ Block 2 — Crocodile heroes (5 heroes + race-passives + ANCIENTSCALE captain dual + THE EMERALD WARDEN signature combo)
- ⏳ Block 3 — Light/Solar infrastructure (mirror of this block)
- ⏳ Block 4 — Spark heroes
- ⏳ Block 5 — Hero unlock progression update (25 heroes total)
- ⏳ Block 6 — Phase 5 sign-off + tag `v0.5.0-phase-5-done`

---

## H. Git status

Single Block 1 commit on `phase-2-grammar`. Auto-merged to `main` per Roman standing instruction.
