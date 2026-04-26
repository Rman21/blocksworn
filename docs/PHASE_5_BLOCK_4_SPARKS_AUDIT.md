# PHASE 5 BLOCK 4 — Sparks (Light/Solar race)

**Branch:** `phase-2-grammar`
**Spec:** [BLOCKSWORN_COMBAT_REFERENCE.md](../BLOCKSWORN_COMBAT_REFERENCE.md) §5 Element × Role Matrix · §6 Sparks · §7 Captain System · §8 Race-passive · §17.1 Signature Combos
**Predecessor:** Phase 5 Block 3 (Light/Solar Infrastructure) — `ab491fa`
**Date:** 2026-04-26

---

## A. Spec recap

5 Spark heroes filling the Light × {W/M/H/T/C} row of the §5 matrix. Wires into Phase 5 Block 3 infrastructure (`onSolarCellsCleared`, `consumeShieldsForBurst`, SHIELDS-TO-DAMAGE cap). Adds 2 race-passives + Tier 3 signature combo + SOLARLORD captain dual (auto-works via universal §6).

---

## B. Implementation

### B.1 ASSETS — 5 portraits inlined

Source: `/Users/rm/Downloads/game/races/light spark/{role}.png` (1086×1448 PNG each).
Resampled via `sips`: 280×373 JPEG q80 → base64. Inserted in ASSETS map after `hero_crocodile_captain`.

Total payload: **310,567 bytes** (file grew 5.08MB → 5.39MB).

### B.2 HERO_ROSTER — 5 entries

Inserted after Crocodiles, before Clockwork placeholders:

```js
{ id:'spark_warrior', name:'EMBERSPARK', race:'spark', role:'striker', newRole:'warrior', stihiya:'solar', img:'hero_spark_warrior', roleIcon:'⚔', minCombo:2, ... }
{ id:'spark_hunter',  name:'RADIANCE',   race:'spark', role:'striker', newRole:'hunter',  stihiya:'solar', ..., minCombo:2, ... }
{ id:'spark_mage',    name:'LUMENWIND',  race:'spark', role:'weaver',  newRole:'mage',    stihiya:'solar', ..., period:12, ... }
{ id:'spark_tank',    name:'AEGIS',      race:'spark', role:'guard',   newRole:'tank',    stihiya:'solar', ..., }
{ id:'spark_captain', name:'SOLARLORD',  race:'spark', role:'weaver',  newRole:'captain', stihiya:'solar', ..., period:10, ... }
```

> Note: Hero name "AEGIS" coexists with existing `aegisActive` flag (Golem race feature). No collision — flag is a separate state var, hero name is just a string label. Verified via grep.

### B.3 5 fire functions + 5 ULT twists + helpers

| Hero | Role | Fire | ULT twist |
|---|---|---|---|
| **EMBERSPARK** | Warrior CREATE | direct dmg 180 + spawn 2 solar cells | **SUN CASCADE** — convert 5 random cells → solar |
| **LUMENWIND** | Mage AMPLIFY | open 3-placement HALO WINDOW (×2 shields/clear) — NO state creation per Mage rule | **HALO OF SUNS** — instant double current shieldCount (capped) |
| **RADIANCE** | Hunter DETONATE | `consumeShieldsForBurst()` × 200 dmg/shield — primer-shot 180 fallback | **AURORA BURST** — shields × 200 WITHOUT consuming (per spec) |
| **AEGIS** | Tank PROTECT | small dmg 160 + +1 shield (existing tank pattern) | **EQUILIBRIUM** — +5 shields + skip next boss attack (interval-bump immunity) |
| **SOLARLORD** | Captain ENABLE | DOMINION pattern — convert N non-solar cells → solar | **ETERNAL DAWN** — heal +25% maxHP + 2 shields + 4 solar cells |

**Helper:** `_spawnSolarCells(maxCount)` — places solar cells in random empties. Mirrors `_spawnGroveAbsorbers` from Block 2 but no per-cell state (Light's "side-system" IS shieldCount). Cells produce shields when cleared via Phase 5 Block 3's `onSolarCellsCleared` hook. Used by EMBERSPARK + SOLARLORD.

**LUMENWIND amp window state:**
```js
let lumenwindHaloActive       = false;
let lumenwindHaloShieldsBonus = 1;             // +1 extra shield per solar clear during window
let lumenwindHaloDuration     = 0;
const LUMENWIND_HALO_TURNS    = 3;
```

`onSolarCellsCleared` reads `lumenwindHaloActive` — if active, each clear gives `1 + lumenwindHaloShieldsBonus` shields (default 2 instead of 1). "HALO LIGHT" flash replaces "LIGHT WARD" flash during window. Per-placement decrement in main loop ("HALO FADES" on natural expiry).

### B.4 Race-passives

#### B.4.1 Charge Regen (2-of-race)

> ULT charges +10% faster.

Implementation: hook into `addChargeToHero` — multiply `amount` by `SPARK_CHARGE_REGEN_MULT` (1.10) if 2+ Sparks in squad. Stateless — read squad composition at fire time. Fires for ALL heroes regardless of race (Sparks "amp the team's energy", not just themselves).

```js
const sparkCount = HERO_DECK.filter(h => h && h.race === 'spark').length;
if (sparkCount >= 2) {
  amount = amount * SPARK_CHARGE_REGEN_MULT;
}
```

#### B.4.2 Static Field (3+-of-race)

> Every 5 placements triggers AoE light burst.

State: `let staticFieldCounter = 0;` (per-battle reset). Hook in placement-tick:

```js
const sparkCount = HERO_DECK.filter(h => h && h.race === 'spark').length;
if (sparkCount >= 3) {
  staticFieldCounter++;
  if (staticFieldCounter >= STATIC_FIELD_INTERVAL) {  // 5
    staticFieldCounter = 0;
    const dmg = sparkCount * STATIC_FIELD_BASE_DMG;   // 80 per Spark
    dealDamage(dmg, false, 0);
    flashText('STATIC FIELD · ' + dmg, STIHIYA_COLORS.solar);
    vibrate([40, 30, 40, 30, 60]);
  }
} else {
  staticFieldCounter = 0;  // reset if squad drops below 3 mid-battle
}
```

Damage scales with squad Spark count: 3 Sparks = 240 dmg every 5 placements; 4 Sparks = 320; 5 Sparks = 400 (rare full-Spark squad scenario after SQUAD_MAX → 5).

### B.5 Captain dual buff

`SOLARLORD` captain auto-works through universal `calcSynergyState` system:
- `_RACE_PLURAL.spark = 'SPARKS'` ✅ already in map (Phase 5 prep)
- `captainDual_race = 'spark'` set when SOLARLORD in squad
- `captainDual_stihiya = 'solar'` adds +25% solar drop weight
- Race buff scaling: 1 spark = +5%, 2 = +15%, 3+ = +30%

No race-hardcoded captain checks anywhere in code (verified Phase 5 Block 2). System fully race-agnostic.

### B.6 Signature combo — THE PRISMATIC RIDE

```js
'spark_solar': { name: 'THE PRISMATIC RIDE', race: 'spark', stihiya: 'solar', tier: 3, mult: 1.30, color: '#E8B84A' },
```

Tier 3 (3+ Sparks AND 3+ solar squad). Cinematic + synergy bar pill auto-detect via existing `detectSignatureCombo` logic. Color: gold solar tone. Multiplier ×1.30 (matches all 4 other v1 + Phase 5 Tier 3 combos for race parity).

### B.7 Per-battle resets

In `startBossBattle` reset block:

```js
lumenwindHaloActive       = false;
lumenwindHaloShieldsBonus = 1;
lumenwindHaloDuration     = 0;
staticFieldCounter        = 0;
```

---

## C. What this block does NOT touch

- All Phase 1/2/3/4 work intact.
- Phase 5 Block 1/2/3 work preserved verbatim (Block 4 wires INTO Block 3 infrastructure).
- Existing solar mechanics (radiantCells, huntPack, roar, valeriusRadiantWard, halo chain) untouched.
- Existing `aegisActive` Golem flag untouched (Spark hero AEGIS uses different state path).
- Hero unlock progression timeline — Block 5 will integrate Spark unlocks.
- Existing `addChargeToHero` ULT-ready transition flash + vibrate behavior untouched (Charge Regen multiplier added BEFORE per-hero state update).

---

## D. Edge cases handled

| Scenario | Behavior |
|---|---|
| Squad has 0 Sparks | Heroes don't fire, race-passives don't trigger, captain dual not active |
| Squad has 1 Spark (only SOLARLORD) | Captain race buff = +5% (1-of-race); Charge Regen/Static Field NOT active |
| Squad has 2 Sparks | Charge Regen active (×1.10 charge gain ALL heroes); Static Field NOT active |
| Squad has 3+ Sparks | Both race-passives active; race buff +30% |
| Squad has 3+ Sparks + SOLARLORD | THE PRISMATIC RIDE signature combo triggers (Tier 3, ×1.30) — banner cinematic + synergy pill |
| Static Field fires during phoenix immunity | Damage gated by `dealDamage` immunity check (existing behavior) |
| Squad drops Spark count from 3 to 2 mid-battle | Static Field counter resets on next placement (no stale buildup) |
| LUMENWIND fire while window already active | Refreshes window to LUMENWIND_HALO_TURNS (3) — replaces existing |
| LUMENWIND ULT (Halo of Suns) at 0 shields | flashText shows "HALO OF SUNS · 0🛡", no error |
| RADIANCE fire with 0 shields | Primer-shot 180 dmg + "NO SHIELDS" flash (Hunter rule per Combat Ref §4) |
| RADIANCE ULT (Aurora Burst) with 0 shields | "NO SHIELDS" flash, no damage; shields persistence semantic preserved |
| AEGIS ULT immunity stacks with CRYOMIND/ABYSSKING freeze | All bump attackCountdown — natural stacking |
| EMBERSPARK/SOLARLORD spawn calls with 0 empties | Returns 0, no flash, vibrate fallback |
| SOLARLORD ULT heals at full HP | hp clamped to currentMaxHP — no overflow |
| Full 25-hero roster with mixed races | All race-passives correctly gated by `HERO_DECK.filter(...)` count |

---

## E. Roman regression checklist

JS syntax verified post-edits via JavaScriptCore (~5.41MB parses through 16,370+ lines clean).

1. **Solo Spark (only SOLARLORD)**:
   - Captain pill: `👑 SPARKS: +5% spark_dmg · +25% solar_drops`
   - Charge Regen NOT active (need 2+)
   - Static Field NOT active (need 3+)

2. **2 Sparks (e.g. EMBERSPARK + SOLARLORD)**:
   - Captain pill: `+15% spark_dmg`
   - Charge Regen active: ALL hero charge gains × 1.10 (verifiable via `__debugCharges()` after a few clears)

3. **3 Sparks + SOLARLORD captain (race-pure full)**:
   - THE PRISMATIC RIDE signature combo cinematic at battle start (gold emblem)
   - Synergy bar `🌟 THE PRISMATIC RIDE +30%` premium gold pill
   - `_signatureComboContext = 1.30` injected into damage stack
   - Static Field active: every 5 placements → "STATIC FIELD · 240" flash + 240 dmg
   - Charge Regen active

4. **EMBERSPARK fire** with combo ≥ 2:
   - 180 direct damage
   - 2 random empties become solar cells (auto-radiant via maybeMarkRadiant)

5. **EMBERSPARK ULT (Sun Cascade)**:
   - 5 random cells → solar; "SUN CASCADE · 5" flash

6. **LUMENWIND fire**:
   - "HALO WINDOW ×2🛡/clear" flash; window opens for 3 placements
   - During window, each `onSolarCellsCleared` clear gives +2 shields (vs default +1)
   - "HALO FADES" on natural expiry

7. **LUMENWIND ULT (Halo of Suns)** with shields=4:
   - shieldCount → 8 (cap-clamped); "HALO OF SUNS · 4 → 8🛡"

8. **RADIANCE fire** with shields=6:
   - "AURORA · 6🛡 → 1200" flash, 1200 dmg, shields → 0

9. **RADIANCE ULT (Aurora Burst)** with shields=8:
   - "AURORA BURST · 1600 (kept 8🛡)"; 1600 dmg, shields STAY at 8 (per spec)

10. **AEGIS fire**: +1 shield + 160 dmg

11. **AEGIS ULT (Equilibrium)**: shieldCount += 5 (capped); attackCountdown bumped by interval (skip next swing)

12. **SOLARLORD fire** (captain): N solar conversions (captainConversionBoost-aware); maybeMarkRadiant on each

13. **SOLARLORD ULT (Eternal Dawn)**: hp += currentMaxHP × 0.25; shieldCount += 2; 4 solar cells spawned; flash shows all 3 effects

14. **No console errors** through full Spark playtest.

---

## F. Spec adherence

| Spec point (Combat Ref §6 + §7 + §8 + §17) | Implementation | Status |
|---|---|---|
| 5 Spark heroes (W/M/H/T/C) | All 5 in HERO_ROSTER with proper race='spark', stihiya='solar' | ✅ |
| Race-passive: Charge Regen (2-of) | ×1.10 multiplier in `addChargeToHero`, all heroes benefit | ✅ |
| Race-passive: Static Field (3+) | Counter-based AoE every 5 placements, scales with Spark count | ✅ |
| Captain SOLARLORD dual buff | Auto-works via universal §6 (race='spark', stihiya='solar') | ✅ |
| Tier 3 Signature: THE PRISMATIC RIDE | Added to SIGNATURE_COMBOS map (×1.30, color #E8B84A) | ✅ |
| EMBERSPARK Sun Cascade ULT | Convert 5 cells → solar | ✅ |
| LUMENWIND Halo of Suns ULT | Double current shields | ✅ |
| RADIANCE Aurora Burst ULT | Shields-to-damage WITHOUT consuming | ✅ |
| AEGIS Equilibrium ULT | +5 shields + 1-turn attack immunity | ✅ |
| SOLARLORD Eternal Dawn ULT | Heal squad +25% HP + 2 shields + 4 solar cells | ✅ |
| Mage CRITICAL RULE (NEVER creates state) | LUMENWIND fire opens window only — no cell spawn (shield is separate pool) | ✅ |
| Hunter primer-shot fallback | RADIANCE 180 dmg flat with "NO SHIELDS" flash | ✅ |
| Captain ONE max per squad | Universal Pillar 20 enforced | ✅ |
| LUMENWIND amp window integrates with Block 3 hook | `onSolarCellsCleared` reads `lumenwindHaloActive` flag | ✅ |
| Reduced-motion compliance | No new animations (banners use existing flashText) | ✅ |

---

## G. Phase 5 progress

- ✅ Block 1 — Earth/Grove infrastructure (`2994f0a`)
- ✅ Block 2 — Crocodile heroes (`a3557ce`)
- ✅ Block 3 — Light/Solar infrastructure (`ab491fa`)
- ✅ **Block 4 — Spark heroes** (this commit)
- ⏳ Block 5 — Hero unlock progression update (25 heroes total + SQUAD_MAX adjust)
- ⏳ Block 6 — Phase 5 sign-off + tag `v0.5.0-phase-5-done`

After Block 4, all 25 heroes (5 races × 5 roles) are in HERO_ROSTER with full mechanics. Block 5 integrates them into the unlock timeline; Block 6 handles balance pass + tag.

---

## H. Git status

Single Block 4 commit on `phase-2-grammar`. Auto-merged to `main`.
