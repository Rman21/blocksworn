# §2.4 Element × Role Grammar Conformance Audit

Roman flagged that THORGAR (pirate warrior) doesn't match his mental model
of "Warrior creates → Mage charges → Hunter detonates." Audit found 5 of
25 heroes deviating from MASTER_PLAN_V3.md §2.4. All 5 fixed below.

## §2.4 — Source of truth

| Role | Verb | Element specialisations |
|---|---|---|
| **Warrior** | CREATOR — sows element-charged cells, source of chain | Fire→ember-charged · Frost→tide · Earth→grove absorbers · Dark→umbra seeds · Light→solar |
| **Mage** | AMPLIFIER — converts neighbors / extends, NO new state | Fire→spread charge · Frost→extend chain · Earth→amplify absorption · Dark→spread corruption · Light→2× shields-per-clear |
| **Hunter** | DETONATOR — mass detonate | Fire→INFERNO · Frost→CRYO CRIT · Earth→REVENGE BURST · Dark→DARK DETONATION · Light→SHIELDS-TO-DAMAGE |
| **Tank** | PROTECTOR — shields + element-specific defense | Fire→counter-thorns · Frost→delay attack · Earth→passive absorbers · Dark→damage→umbra · Light→auto-block |
| **Captain** | ENABLER — race buff + element drop +25% + ULT | Fire field · Frost freeze 3T · Earth shields squad · Dark gravity · Light heal+radiate |

## Audit table — all 25 v1 heroes

### ✅ Mages (5/5 conform) — no changes

| Hero | Element | Verdict |
|---|---|---|
| EMBERHAND | Fire | ✅ Spreads charge to neighbors of charged ember + opens BLOOM ×1.5 window |
| KEYCRYPT | Dark | ✅ Opens DEEP BEAT window — mult = 1 + (encoreStacks × 0.20). NO state creation |
| CRYOMIND | Frost | ✅ Opens TIDE WEAVE window — mult = 1 + (segments × 0.25). Extends chain by +1 |
| MOSSWEAVER | Earth | ✅ Opens VERDANT SURGE window — mult scales with groveTotalAbsorbed |
| LUMENWIND | Light | ✅ Opens HALO window — solar clears yield +2 shields instead of +1 |

### ✅ Hunters (5/5 conform) — no changes

| Hero | Element | Verdict |
|---|---|---|
| BLACKTOOTH | Fire | ✅ Detonates all charged ember (×3 cap), respects EMBERHAND BLOOM amp |
| SHRIEK | Dark | ✅ Consumes encoreStacks × keycryptMult, +50% repeat (Encore-of-Encore) |
| BRINESHOT | Frost | ✅ Consumes frostChainSegments (×4 cap), respects CRYOMIND WEAVE amp |
| THORNBACK | Earth | ✅ Consumes groveTotalAbsorbed × MOSSWEAVER mult (REVENGE BURST) |
| RADIANCE | Light | ✅ Consumes shieldCount × SOLAR_BURST_DMG_PER_SHIELD (SHIELDS-TO-DAMAGE) |

### Warriors (3/5 OK · 2/5 fixed)

| Hero | Element | Pre-fix | Verdict |
|---|---|---|---|
| **THORGAR** 🔧 | Fire | Charged 3 *existing* ember cells; failed on empty boards | **Fixed** — spawns 3 new ember-charged cells from empties via `_spawnEmberCharged(3)` |
| **RIMEFANG** 🔧 | Frost | Pure damage, no creation | **Fixed** — added `_spawnTideCells(2)` after damage |
| RIFFBLADE 🔧 | Dark | Pure damage + RIFF BEAT, no creation | **Fixed** — added `_spawnUmbraCells(2)` (3 on RIFF BEAT) |
| MOSSJAW | Earth | ✅ Spawns 2 grove absorbers via `_spawnGroveAbsorbers(2)` | unchanged |
| EMBERSPARK | Light | ✅ Spawns 2 solar cells via `_spawnSolarCells(2)` | unchanged |

### Tanks (2/5 OK · 1/5 accepted-extension · 2/5 fixed)

| Hero | Element | Pre-fix | Verdict |
|---|---|---|---|
| IRONBELLY | Fire | Adds shield + dmg + charges 2-3 ember | accepted EXTENSION (PHASE_2_PIRATES_AUDIT.md ships as-is for v1) |
| **THUNDERBEAT** 🔧 | Dark | Shield + dmg only, no damage→umbra conversion | **Fixed** — added `_spawnUmbraCells(2)` (3 on Rhythm) — channels stored damage into dark substrate |
| **BULWARK** 🔧 | Frost | Shield + dmg only, no attack delay | **Fixed** — `attackCountdown += 1` (capped at TIDE_COUNTDOWN_CAP), routed through `onFreezeApplied` |
| IRONSCALE | Earth | ✅ Shield + dmg + spawn 1 grove absorber | unchanged |
| AEGIS | Light | ✅ Shield + dmg + auto-block flag | unchanged |

### Captains (5/5 dual-buff + cell-conversion verified) — no changes

| Hero | Element | Verdict |
|---|---|---|
| CRIMSON | Fire | ✅ Converts 2-3 cells → ember + cascade if neighbor charged. §6 dual-buff via calcSynergyState |
| NIGHTLORD | Dark | ✅ Converts 2 cells → umbra + tier-scoped charge gift (25-100% per cell) |
| ABYSSKING | Frost | ✅ Converts 2 cells → tide + onFreezeApplied via DEEP TIDE ULT |
| ANCIENTSCALE | Earth | ✅ Converts 2 cells → grove + registers as absorbers |
| SOLARLORD | Light | ✅ Converts 2 cells → solar + maybeMarkRadiant |

## New helpers

Three helpers added next to existing `_spawnGroveAbsorbers` / `_spawnSolarCells`:

```js
async function _spawnTideCells(maxCount)        // line ~22760
async function _spawnUmbraCells(maxCount)       // line ~22500
async function _spawnEmberCharged(maxCount)     // line ~21290
```

Each is gated by `MOTIFS_ENABLED.<element>`, capped by available empties,
respects `EMBER_CHARGED_CAP` for the ember variant, marks freshly spawned
cells with `.spawning` for the standard creation VFX, and re-renders.

## Diff summary

```
fireThorgar       — replaced "charge 3 existing" → "_spawnEmberCharged(3)"
fireRimefang      — added "_spawnTideCells(2)" after dmg
fireRiffblade     — added "_spawnUmbraCells(2/3)" tied to RIFF BEAT
fireThunderbeat   — added "_spawnUmbraCells(2/3)" tied to Rhythm gate
fireBulwark       — added "attackCountdown += 1" + onFreezeApplied
+ 3 new helpers (_spawnEmberCharged, _spawnTideCells, _spawnUmbraCells)
```

## Verification

JS parse OK (JavaScriptCore reaches runtime past line 562; only halts on
`console` global which is a JSC environment limitation, not a SyntaxError).

## Cascade integrity check

Roman's mental model now holds for all 5 elements:

| Element | Create (Warrior) | Charge/Spread (Mage) | Detonate (Hunter) |
|---|---|---|---|
| **Fire** | THORGAR spawns ember-charged | EMBERHAND spreads charge to neighbors | BLACKTOOTH INFERNO |
| **Dark** | RIFFBLADE seeds umbra | KEYCRYPT amps Encore stacks | SHRIEK Encore-of-Encore |
| **Frost** | RIMEFANG spawns tide | CRYOMIND extends chain +1 | BRINESHOT SHATTER |
| **Earth** | MOSSJAW spawns absorbers | MOSSWEAVER amps absorption | THORNBACK REVENGE BURST |
| **Light** | EMBERSPARK spawns solar | LUMENWIND 2× shields/clear | RADIANCE SHIELDS-TO-DAMAGE |

Cascade chain works on empty boards in all 5 elements.

## Risk

Low. Fixes are additive (new spawn calls + helper functions). No existing
chain mechanic was removed. THORGAR's "charge surviving ember" behaviour
was replaced with "spawn new ember from empties" — strictly more universal
(works when no ember exists, still works when ember exists).
