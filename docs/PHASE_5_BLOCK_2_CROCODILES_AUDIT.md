# PHASE 5 BLOCK 2 — Crocodiles (Earth/Grove race)

**Branch:** `phase-2-grammar`
**Spec:** [BLOCKSWORN_COMBAT_REFERENCE.md](../BLOCKSWORN_COMBAT_REFERENCE.md) §5 Element × Role Matrix · §6 Crocodiles · §7 Captain System · §8 Race-passive · §17.1 Signature Combos
**Predecessor:** Phase 5 Block 1 (Earth/Grove Infrastructure) — `2994f0a`
**Date:** 2026-04-26

---

## A. Spec recap

5 Crocodile heroes filling the Earth × {W/M/H/T/C} row of the §5 matrix. Wires into Phase 5 Block 1 infrastructure (`groveAbsorbedByCell`, `absorbBossDamage`, `consumeEarthCells`, REVENGE BURST cap). Adds 2 race-passives + Tier 3 signature combo + ANCIENTSCALE captain dual (auto-works via universal §6).

---

## B. Implementation

### B.1 ASSETS — 5 portraits inlined

Source: `/Users/rm/Downloads/game/races/earth croc/{role}.png` (1086×1448 PNG each).
Converted via `sips`: 280×373 JPEG q80 → base64. Inserted into `ASSETS` map after `hero_shark_captain`.

| Asset key | Source PNG | base64 size |
|---|---|---|
| `hero_crocodile_warrior` | earth croc warrior.png | 45,735 bytes |
| `hero_crocodile_mage`    | earth croc mage.png    | 61,299 bytes |
| `hero_crocodile_hunter`  | earth croc hunter.png  | 46,467 bytes |
| `hero_crocodile_tank`    | earth croc tank.png    | 62,455 bytes |
| `hero_crocodile_captain` | earth croc captain.png | 65,083 bytes |

Total payload: **281KB** (file grew 4.78MB → 5.08MB).

### B.2 HERO_ROSTER — 5 entries

Inserted after Sharks block, before Clockwork placeholders. Standard hero record:

```js
{ id:'crocodile_warrior', name:'MOSSJAW',      race:'crocodile', role:'striker', newRole:'warrior', stihiya:'grove', img:'hero_crocodile_warrior', roleIcon:'⚔', minCombo:2, ... }
{ id:'crocodile_hunter',  name:'THORNBACK',    race:'crocodile', role:'striker', newRole:'hunter',  stihiya:'grove', ..., minCombo:2, ... }
{ id:'crocodile_mage',    name:'MOSSWEAVER',   race:'crocodile', role:'weaver',  newRole:'mage',    stihiya:'grove', ..., period:12, ... }
{ id:'crocodile_tank',    name:'IRONSCALE',    race:'crocodile', role:'guard',   newRole:'tank',    stihiya:'grove', ..., }
{ id:'crocodile_captain', name:'ANCIENTSCALE', race:'crocodile', role:'weaver',  newRole:'captain', stihiya:'grove', ..., period:10, ... }
```

All 5 default to **unlocked** (no `locked: true` flag) — Block 5 will adjust progression timeline if needed.

### B.3 5 fire functions + 5 ULT twists

| Hero | Role | Fire | ULT twist |
|---|---|---|---|
| **MOSSJAW** | Warrior CREATE | direct dmg 180 + spawn 2 grove absorbers | **BEDROCK BASTION** — convert ALL empty cells → grove absorbers |
| **MOSSWEAVER** | Mage AMPLIFY | open 3-placement window, mult 1.0 + min(0.5, total/1000 × 0.5) — up to +50% at REVENGE threshold (NO state creation per Mage rule) | **VERDANT SURGE** — consume all shields → 200 dmg per shield burst |
| **THORNBACK** | Hunter DETONATE | `consumeEarthCells()` × surge mult × (REVENGE_FIRED ? 1.5 : 1) — primer-shot 180 fallback | **VENGEANCE QUAKE** — `consumeEarthCells()` × 3 |
| **IRONSCALE** | Tank PROTECT | small dmg 160 + +1 shield + spawn 1 grove absorber | **WALL OF ROOTS** — full center row → grove absorbers |
| **ANCIENTSCALE** | Captain ENABLE | DOMINION pattern — convert N non-grove cells → grove absorbers (mirrors ABYSSKING/CRIMSON) | **ETERNAL BASTION** — squad +3 shields + 5 additional grove absorbers |

**Helper:** `_spawnGroveAbsorbers(maxCount)` — places grove cells in random empties + registers each in `groveAbsorbedByCell`. Used by 4 of 5 heroes (Mage doesn't create state per role rule).

**MOSSWEAVER amp window state:**
```js
let mossweaverSurgeActive    = false;
let mossweaverSurgeMult      = 1.0;
let mossweaverSurgeDuration  = 0;
const MOSSWEAVER_SURGE_TURNS = 3;
```

Per-placement decrement in main loop (alongside KEYCRYPT/CRYOMIND amp windows): "SURGE FADES" message on natural expiry.

### B.4 Race-passives

#### B.4.1 Death Roll (2-of-race)

> First time damage would lethally drop player HP, restore HP=1 instead.

State: `let crocDeathRollUsed = false;` — per-battle one-shot, reset in `startBossBattle`.

Hook: in `bossAttack` damage flow, AFTER earth-cell absorption (so absorption catches damage first), BEFORE shield/HP fallback:

```js
if (newDead > 0 && !crocDeathRollUsed) {
  const crocCount = HERO_DECK.filter(h => h && h.race === 'crocodile').length;
  const totalAbsorbable = shieldCount + hp;
  if (crocCount >= 2 && newDead >= totalAbsorbable) {
    crocDeathRollUsed = true;
    shieldCount = 0;
    hp = 1;
    newDead = 0;
    flashText('DEATH ROLL · HP = 1', STIHIYA_COLORS.grove);
    vibrate([100, 50, 100, 50, 200]);
  }
}
```

Triggers only on **lethal** hits (damage exceeds shields + HP combined). Smaller hits absorbed normally.

#### B.4.2 Iron Hide (3+-of-race)

> Squad gains +1 shield each turn.

Hook: in per-placement post-tick (alongside amp window decrements):

```js
const crocCount = HERO_DECK.filter(h => h && h.race === 'crocodile').length;
if (crocCount >= 3 && shieldCount < cap) {
  shieldCount++;
  flashText('IRON HIDE +1🛡', STIHIYA_COLORS.grove);
}
```

Capped by `MAX_SHIELD + 2 + maxShieldBonus`. Stacks naturally with other shield mechanics.

### B.5 Captain dual buff (universal §6)

`ANCIENTSCALE` captain auto-works through universal `calcSynergyState` system:
- `_RACE_PLURAL.crocodile = 'CROCODILES'` ✅ already in map (added Phase 5 prep)
- `captainDual_race = 'crocodile'` set when ANCIENTSCALE in squad
- `captainDual_stihiya = 'grove'` adds +25% grove drop weight
- Race buff scaling: 1 croc = +5%, 2 = +15%, 3+ = +30%

**No race-hardcoded captain checks anywhere in code** — verified via grep. System is fully race-agnostic.

### B.6 Signature combo — THE EMERALD WARDEN

```js
'crocodile_grove': { name: 'THE EMERALD WARDEN', race: 'crocodile', stihiya: 'grove', tier: 3, mult: 1.30, color: '#5DCA79' },
```

Tier 3 (3+ Crocodiles AND 3+ grove squad). Cinematic + synergy bar pill auto-detect via existing `detectSignatureCombo` logic. Color: green grove tone. Multiplier ×1.30 (matches THE GOLDEN HOARD / DARK ENCORE / FROST DEEP for race parity).

### B.7 Per-battle resets

In `startBossBattle` reset block, adjacent to grove infrastructure:

```js
mossweaverSurgeActive    = false;
mossweaverSurgeMult      = 1.0;
mossweaverSurgeDuration  = 0;
crocDeathRollUsed        = false;
```

---

## C. What this block does NOT touch

- All Phase 1/2/3/4 work intact.
- Phase 5 Block 1 grove infrastructure preserved verbatim (Crocodiles wire INTO it).
- Hero unlock progression timeline — Block 5 will integrate Crocodile unlocks into Boss progression.
- Sparks (Phase 5 Block 4) — separate block.
- Existing race-passives (Pirates / Rock Band / Sharks) untouched.

---

## D. Edge cases handled

| Scenario | Behavior |
|---|---|
| Squad has 0 Crocodiles | Heroes don't fire, race-passives don't trigger, captain dual not active |
| Squad has 1 Crocodile (only ANCIENTSCALE) | Captain race buff = +5% (1-of-race); Death Roll/Iron Hide NOT active |
| Squad has 2 Crocodiles | Death Roll active; Iron Hide NOT active; race buff +15% |
| Squad has 3+ Crocodiles | Both race-passives active; race buff +30% |
| Squad has 3+ Crocodiles + ANCIENTSCALE captain | THE EMERALD WARDEN signature combo triggers (Tier 3, ×1.30) — banner cinematic + synergy pill |
| Death Roll triggered, then HP drops again | Second drop kills normally (Death Roll is per-battle one-shot) |
| Iron Hide at shield cap | `if (shieldCount < cap)` guards — no over-cap, no flash |
| THORNBACK fires with 0 absorbed | Primer-shot 180 dmg + "NO ABSORPTION" flash (Hunter rule per Combat Ref §4) |
| MOSSWEAVER ULT with 0 shields | "NO SHIELDS" flash, no damage (no fallback — shields are the resource) |
| IRONSCALE Wall of Roots over existing cells | Replaces grid contents in center row (charged ember cells / void cells overwritten). Edge case to monitor in playtest. |
| MOSSJAW/IRONSCALE/ANCIENTSCALE spawn calls with 0 empties | Returns 0, no flash, vibrate fallback |
| Boss attack lethal but `crocDeathRollUsed === true` | Falls through to shield/HP normally |
| Boss attack lethal AND no Crocs in squad | Death Roll skipped, Death Flashback fires normally on game over |

---

## E. Roman regression checklist

JS syntax verified via JavaScriptCore (~5.08MB parses through 15,995+ lines clean).

1. **Solo Crocodile (only ANCIENTSCALE in squad, 2 other races)**:
   - Captain pill: `👑 CROCODILES: +5% crocodile_dmg · +25% grove_drops` (1-of-race scaling)
   - Death Roll NOT active (need 2+)
   - Iron Hide NOT active (need 3+)

2. **2 Crocs in squad (e.g. MOSSJAW + ANCIENTSCALE)**:
   - Captain pill: `+15% crocodile_dmg`
   - Death Roll arms; on lethal hit → "DEATH ROLL · HP = 1" flash, HP restored
   - Second lethal hit kills normally

3. **3 Crocs + ANCIENTSCALE captain (race-pure full)**:
   - THE EMERALD WARDEN signature combo cinematic at battle start (green emblem)
   - Synergy bar `🌟 THE EMERALD WARDEN +30%` premium gold pill
   - `_signatureComboContext = 1.30` injected into damage stack
   - Iron Hide active: `IRON HIDE +1🛡` flash each placement (capped)
   - Death Roll active

4. **MOSSJAW fire** with combo ≥ 2:
   - 180 direct damage
   - 2 random empties become grove cells, registered as absorbers
   - `__debugGrove().cellCount` increments by 2

5. **MOSSJAW ULT (Bedrock Bastion)**:
   - All empty cells → grove absorbers
   - `BEDROCK BASTION · N` flash with placed count

6. **MOSSWEAVER fire**:
   - "VERDANT SURGE +X%" flash (X scales with current absorbed total, max 50%)
   - 3-placement window opens; "SURGE FADES" on natural expiry

7. **MOSSWEAVER ULT (Verdant Surge)**:
   - With 5 shields: shieldCount → 0, dealDamage(1000), "VERDANT SURGE · 5🛡 → 1000 dmg"
   - With 0 shields: "NO SHIELDS" flash, no damage

8. **THORNBACK fire** with 600 absorbed + MOSSWEAVER amp +30%:
   - Damage = 600 × 1.30 = 780; multStack clamped FIRE_MULT_CAP = 3.0
   - `__debugGrove().totalAbsorbed` resets to 0 after consume

9. **THORNBACK ULT (Vengeance Quake)** with 1200 absorbed:
   - `consumeEarthCells()` returns 1200; dmg = 3600; flash "VENGEANCE QUAKE ×3 · 3600"
   - REVENGE BURST banner already fired (1200 ≥ 1000 threshold)

10. **IRONSCALE fire**: +1 shield + 1 grove absorber spawned + 160 dmg

11. **IRONSCALE ULT (Wall of Roots)**: full center row → grove absorbers, "WALL OF ROOTS · N EARTH"

12. **ANCIENTSCALE fire** (captain): N grove conversions registered as absorbers (captainConversionBoost-aware)

13. **ANCIENTSCALE ULT (Eternal Bastion)**: shieldCount += 3 (capped) + 5 additional grove absorbers

14. **No console errors** through full Crocodile playtest.

---

## F. Spec adherence

| Spec point (Combat Ref §6 + §7 + §8 + §17) | Implementation | Status |
|---|---|---|
| 5 Crocodile heroes (W/M/H/T/C) | All 5 in HERO_ROSTER with proper race='crocodile', stihiya='grove' | ✅ |
| Race-passive: Death Roll (2-of) | Per-battle one-shot HP rescue at lethal threshold | ✅ |
| Race-passive: Iron Hide (3+) | +1 shield per placement, capped | ✅ |
| Captain ANCIENTSCALE dual buff | Auto-works via universal §6 (race='crocodile', stihiya='grove') | ✅ |
| Tier 3 Signature: THE EMERALD WARDEN | Added to SIGNATURE_COMBOS map (×1.30, color #5DCA79) | ✅ |
| MOSSJAW Bedrock Bastion ULT | Convert all empty cells → grove absorbers | ✅ |
| MOSSWEAVER Verdant Surge | Open amp window + ULT shields → damage | ✅ |
| THORNBACK Vengeance Quake | Consume earth-cells × 3 mult | ✅ |
| IRONSCALE Wall of Roots | Full row earth-cells | ✅ |
| ANCIENTSCALE Eternal Bastion | Squad +3 shields + 5 earth cells | ✅ |
| Mage CRITICAL RULE (NEVER creates state) | MOSSWEAVER fire opens window only — no cell spawn | ✅ |
| Hunter primer-shot fallback | THORNBACK 180 dmg flat with "NO ABSORPTION" flash | ✅ |
| Captain ONE max per squad | Universal Pillar 20 enforced | ✅ |

---

## G. Phase 5 progress

- ✅ Block 1 — Earth/Grove infrastructure (`2994f0a`)
- ✅ **Block 2 — Crocodile heroes** (this commit)
- ⏳ Block 3 — Light/Solar infrastructure (mirror Block 1)
- ⏳ Block 4 — Spark heroes (mirror Block 2)
- ⏳ Block 5 — Hero unlock progression update (25 heroes total)
- ⏳ Block 6 — Phase 5 sign-off + tag `v0.5.0-phase-5-done`

---

## H. Git status

Single Block 2 commit on `phase-2-grammar`. Auto-merged to `main`.
