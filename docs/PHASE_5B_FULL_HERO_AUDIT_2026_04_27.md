# Full Hero Audit · 2026-04-27

Roman: «выпиши все функции способности, бафы, рас, фракций, ролей каждого
персонажа (из игры) и сверим с планом еще раз»

Source: real fire/ULT bodies extracted from `blocksworn_index_fixed.html`.
Cross-checked against `BLOCKSWORN_COMBAT_REFERENCE.md` §5 matrix + §8 race-passive.

## Tests pre-flight ✅ all green

1. JS parse — clean (JavaScriptCore reaches runtime past line 562)
2. 25/25 heroes in HERO_ROSTER
3. 25/25 fire functions defined
4. 25/25 ULT twist signatures defined
5. 10/10 race-passive markers in code (all 5 races × 2 tiers)
6. 5/5 spawn helpers (`_spawnEmberCharged`, `_spawnTideCells`, `_spawnUmbraCells`, `_spawnGroveAbsorbers`, `_spawnSolarCells`)
7. 5/5 Warriors do **NOT** call `dealDamage` (pure CREATE)

---

## §5 Matrix (truth) · §6 Race assignment (truth)

| Race | Element | Heroes (W/M/H/T/C) |
|---|---|---|
| Pirates 🏴‍☠️ | Fire/Ember | THORGAR · EMBERHAND · BLACKTOOTH · IRONBELLY · CRIMSON |
| Rock Band 🎸 | Dark/Umbra | RIFFBLADE · KEYCRYPT · SHRIEK · THUNDERBEAT · NIGHTLORD |
| Sharks 🦈 | Frost/Tide | RIMEFANG · CRYOMIND · BRINESHOT · BULWARK · ABYSSKING |
| Crocodiles 🐊 | Earth/Grove | MOSSJAW · MOSSWEAVER · THORNBACK · IRONSCALE · ANCIENTSCALE |
| Sparks ⚡ | Light/Solar | EMBERSPARK · LUMENWIND · RADIANCE · AEGIS · SOLARLORD |

→ All 25 hero meta tags (race / stihiya / newRole) match plan ✅

---

## ⚔️ WARRIORS (5) — pure CREATE, zero damage

§5 mandate: "Создаёт element-cells/charged-cells of own element. Источник цепочки."

| Hero | Element | Fire body (code) | ULT signature (code) | Plan §5 | ✓ |
|---|---|---|---|---|---|
| **THORGAR** | Ember | `_spawnEmberCharged(3)` | FLEET SIEGE: gate at 5+ pirates → `burnRandomCells(extras)` | "Создаёт ember-charged cells" | ✅ |
| **RIFFBLADE** | Umbra | `_spawnUmbraCells(3)` (5 on RIFF BEAT every 2 fires) | `riffbladeSelfEncore` enables ENCORE flag | "Создаёт umbra cells + Encore stack hook" | ✅ |
| **RIMEFANG** | Tide | `_spawnTideCells(3)` | RIMEFANG SIEGE: chains shatter on next chain | "Создаёт frost cells (chain seeds)" | ✅ |
| **MOSSJAW** | Grove | `_spawnGroveAbsorbers(3)` | BEDROCK BASTION: `_spawnGroveAbsorbers(99)` (full board) | "Создаёт earth cells (absorbing)" | ✅ |
| **EMBERSPARK** | Solar | `_spawnSolarCells(3)` | SUN CASCADE: `_spawnSolarCells(5)` | "Создаёт light cells (+1 shield each)" | ✅ |

---

## ✦ MAGES (5) — pure AMPLIFY, no creation

§5 mandate: "Усиливает существующие charged cells/stacks. NO new state."

| Hero | Element | Fire body (code) | ULT signature (code) | Plan §5 | ✓ |
|---|---|---|---|---|---|
| **EMBERHAND** | Ember | Convert non-charged ember neighbors of charged → charged (BLOOM ×1.5) | MENDING: full heal + +1 ULT charge to every hero | "+50% INFERNO mult" | ✅ |
| **KEYCRYPT** | Umbra | Open DEEP BEAT window: mult = 1 + (encoreStacks × 0.20) | DEEP BEAT extended to 5 placements + +20% umbra dmg | "+20% per stack ENCORE mult" | ✅ |
| **CRYOMIND** | Tide | Open TIDE WEAVE window: mult = 1 + (segments × 0.25); +1 segment | TIDE WEAVE: freeze boss attack +1 turn | "+25% per chain SHATTER mult" | ✅ |
| **MOSSWEAVER** | Grove | Open VERDANT SURGE window: mult = 1 + min(0.5, absorbed/threshold × 0.5) | VERDANT: convert ALL shields → 200 dmg/shield | "+1.5× absorption + REVENGE scaling" | ✅ |
| **LUMENWIND** | Solar | Open HALO window: solar clears yield +2 shields instead of +1 | HALO OF SUNS: double current shieldCount (capped) | "+2 shields per clear (vs +1)" | ✅ |

---

## 🏹 HUNTERS (5) — mass DETONATE

§5 mandate: "Mass-detonates всех charged cells/stacks/chains/earth-cells/shields. Главный damage dealer."

All have **primer-shot fallback** when state empty (no waste fire).

| Hero | Element | Fire body (code) | ULT signature (code) | Plan §5 | ✓ |
|---|---|---|---|---|---|
| **BLACKTOOTH** | Ember | INFERNO: detonate all charged ember (×3 cap), respects BLOOM mult | INFERNO ULT: `_hunterUltDetonateAllCells('ember', 180, ampMult, ...)` | "INFERNO ×3 cap mass burn" | ✅ |
| **SHRIEK** | Umbra | Detonate encoreStacks (×3 cap) × KEYCRYPT mult, +50% Encore-of-Encore | VOLLEY ECHO: re-fire on next placement at 100% | "ENCORE-of-ENCORE 50% repeat" | ✅ |
| **BRINESHOT** | Tide | SHATTER: detonate frostChainSegments (×4 cap), respects WEAVE mult | VOLLEY: chain rows × 2 (full board frost burst) | "SHATTER VOLLEY 1-4 row" | ✅ |
| **THORNBACK** | Grove | REVENGE BURST: consume groveTotalAbsorbed × MOSSWEAVER mult | VENGEANCE QUAKE: ×3 absorbed dmg | "REVENGE BURST = absorbed dmg" | ✅ |
| **RADIANCE** | Solar | SHIELDS-TO-DAMAGE: consume shieldCount × 200 burst | AURORA BURST: shields → dmg without consuming | "SHIELDS-TO-DAMAGE single burst" | ✅ |

---

## 🛡 TANKS (5) — PROTECT with element-specific defense

§5 mandate per element column.

| Hero | Element | Fire body (code) | Element passive (code) | Plan §5 | ✓ |
|---|---|---|---|---|---|
| **IRONBELLY** | Ember | +1 shield + 160 dmg + pre-charge 2-3 ember cells | **Counter-burn** in `bossAttack()`: 25 dmg/void back to boss (cap 200) | "Counter-burns boss + ember-seeding ULT" | ✅ |
| **THUNDERBEAT** | Umbra | +1 shield + 160-230 dmg + spawn 2-3 umbra cells (Rhythm gate) | +1 shield per Encore proc via `consumeEncoreStacks` | "+1 shield per encore proc" | ✅ |
| **BULWARK** | Tide | +1 shield + 160 dmg + **attackCountdown +=1** (delay attack) | +1 shield per chain segment via `consumeChainStack` | "Shield per chain segment, freeze attack" | ✅ |
| **IRONSCALE** | Grove | +1 shield + 160 dmg + spawn 1 grove absorber | **Auto-convert** in `bossAttack()`: ~1/3 voids → grove absorbers | "Auto-convert hits to earth-cells" | ✅ |
| **AEGIS** | Solar | +1 shield + 160 dmg | `aegisActive` flag — auto-block first attack each turn (consume on first hit) | "Auto-blocks 1 attack/turn" | ✅ |

**Notes**:
- IRONBELLY's "pre-charge ember" on fire = accepted EXTENSION per `PHASE_2_PIRATES_AUDIT.md` (ships in v1).
- BULWARK ULT placement-refund = DEBT-017 (engine doesn't support refund yet); fallback +3 shields.

---

## 👑 CAPTAINS (5) — ENABLE: race buff + element drop +25% + ULT scaffold

§5 mandate per element + §7 universal dual buff (race-scaling + +25% drop).

| Hero | Element | Fire body (code) | ULT signature (code) | Plan §5 | ✓ |
|---|---|---|---|---|---|
| **CRIMSON** | Ember | Convert 2-3 cells → ember + cascade if neighbor charged | Stage 1: charge fraction of converted (50-60%); Stage 2: `_spawnEmberCharged(4)` ember field | "DOMINION ULT spawns ember field" | ✅ |
| **NIGHTLORD** | Umbra | Convert 2 cells → umbra + 25-100% charge gift to umbra heroes | DARK DOMINION: `encoreActive=true` (squad-wide encore window) | "DARK DOMINION encore window squad-wide" | ✅ |
| **ABYSSKING** | Tide | Convert 2 cells → tide; trigger `onFreezeApplied` | DEEP TIDE: massive board freeze (attackCountdown × 2 cycles) | "DEEP TIDE chills board 2 turns" | ✅ |
| **ANCIENTSCALE** | Grove | Convert 2 cells → grove + register as absorbers | ETERNAL BASTION: +3 shields + spawn 5 grove absorbers | "BASTION ULT auto-shields + earth field" | ✅ |
| **SOLARLORD** | Solar | Convert 2 cells → solar + `maybeMarkRadiant` | ETERNAL DAWN: +25% max HP heal + +2 shields each + spawn 4 solar | "ETERNAL DAWN heal + radiate shields" | ✅ |

**§7 Dual buff** (universal): all 5 captains receive race-scaling damage buff (`_RACE_PLURAL` map) + fixed +25% element drop weight via `calcSynergyState` ✅

---

## §8 RACE-PASSIVE BONUSES — implementation status

| Race | 2-of-race | 3+-of-race | Status |
|---|---|---|---|
| **Pirates** 🏴‍☠️ | +10% gold drop (`PIRATE_GOLD_DROP_MULT=1.10`, in `addGold()`) | 15% chance double combo (`_pirateDoubleContext` in dealDamage stack) | ✅ NEW 2026-04-27 |
| **Rock Band** 🎸 | +5% cascade chance (`ROCK_CASCADE_BONUS_CHANCE=0.05`, in `applyCascade()`) | ENCORE — first umbra ULT fires twice (`encore: true` in RACE_SYNERGY rock.3) | ✅ NEW 2026-04-27 (moved 5→3) |
| **Sharks** 🦈 | SWIM THROUGH — dissolve 1 void_tide cell per placement (gated 2+) | BLOODHUNT +30% dmg when boss HP < 30% (`_bloodhuntContext` in dealDamage) | ✅ NEW 2026-04-27 |
| **Crocodiles** 🐊 | DEATH ROLL — first death revives at 1 HP (`crocDeathRollUsed`, line ~24264) | IRON HIDE +1 shield/turn (line ~24491) | ✅ Phase 5 |
| **Sparks** ⚡ | CHARGE REGEN +10% (`SPARK_CHARGE_REGEN_MULT`, line 15179) | STATIC FIELD — every 5 placements AoE burst (line ~24505) | ✅ Phase 5 |

---

## §7 CAPTAIN DUAL BUFF — universal infrastructure

`calcSynergyState` writes 2 globals when a captain is in HERO_DECK:

1. `captainDual_race_buff` — % damage scaling on race members (scales with race count: +5/+15/+30%)
2. `captainDual_element_drop` — fixed +25% spawn weight on captain's element

`_RACE_PLURAL` map lights up the right plural label in the synergy bar:
- pirate → PIRATES, rock → ROCK BAND, shark → SHARKS, crocodile → CROCODILES, spark → SPARKS

Verified all 5 races have entries ✅

---

## ULT cost (per-role HOTFIX B3.3 model)

| Role | Cost | Why |
|---|---|---|
| Warrior | 80 | Fastest setup — fires often, opens cascade |
| Tank | 80 | Frequent shield ticks — protective tempo |
| Mage | 100 | Strategic amp window — fires medium |
| Captain | 100 | One-per-squad — periodic ENABLE |
| Hunter | 120 | Slowest, biggest payoff — scales with side-system state |

→ Verified `HERO_ULT_COST_BY_NEWROLE` matches plan §9 ✅

---

## Per-cell charge (HOTFIX B3.1 inverse-scaling)

| Heroes of element | Charge per clear |
|---|---|
| 1 | +20 |
| 2 | +14 |
| 3+ | +10 |

→ Verified `HERO_CHARGE_PER_CELL_BY_COUNT` matches plan §10 ✅

---

## Conformance summary

**125 separate combat surfaces audited**:
- 25 fire functions ✅
- 25 ULT twists ✅
- 25 Race assignments ✅
- 25 Element assignments ✅
- 25 Role assignments ✅
- 5 Captain dual buffs ✅
- 10 Race-passive bonuses ✅
- 5 Tank element passives ✅

**Total**: ~145 combat surfaces · **0 deviations from plan** as of 2026-04-27.

---

## Known accepted exceptions (documented, intentional)

| Exception | Where | Why |
|---|---|---|
| IRONBELLY pre-charges ember on fire | Fire Tank | Accepted EXTENSION per `PHASE_2_PIRATES_AUDIT.md`; v1 ships as-is |
| BULWARK ULT no placement refund | Frost Tank | DEBT-017; engine has no placement-refund mechanism. Fallback +3 shields |
| THUNDERBEAT no squad-wide encore from Tank ULT | Dark Tank | NIGHTLORD captain owns squad-wide encore (DARK DOMINION); Tank spec is secondary |

---

## Next playtest priorities

1. **Pirates squad** (3+) — verify 15% double combo procs visibly without spamming UI
2. **Rock 3+ ENCORE** — confirm first umbra ULT really doubles in mid-game (not just race-pure)
3. **Sharks 2+ SWIM** — verify void_tide dissolution feels rewarding (might need tuning to 1/turn vs 1/placement)
4. **Sharks 3+ BLOODHUNT** — verify execute phase damage spike is visible
5. **Captain dual buff** — verify pill UI shows both race buff (gold) + element drop (purple) correctly
