# PHASE 5 — Earth + Light Race · SIGN-OFF

**Branch:** `phase-2-grammar`
**Spec:** [BLOCKSWORN_MASTER_PLAN_V3.md](../BLOCKSWORN_MASTER_PLAN_V3.md) §7 row 5 (Phase 5 — Earth + Light Race · 3-4 weeks)
**Predecessor:** Phase 4 sign-off `v0.4.0-phase-4-done` + hotfixes 4.1 + 4.2
**Date:** 2026-04-26
**Tag:** `v0.5.0-phase-5-done`

---

## A. Phase 5 deliverables

Per master plan §7 row 5: "Crocodiles + Sparks (10 героев) + 5-element matrix complete". Shipped across 6 blocks.

### A.1 Block-by-block summary

| # | Block | Commit | Doc |
|---|---|---|---|
| 1 | Earth/Grove infrastructure | `2994f0a` | [PHASE_5_BLOCK_1_EARTH_INFRA_AUDIT.md](PHASE_5_BLOCK_1_EARTH_INFRA_AUDIT.md) |
| 2 | Crocodile heroes (5 + race-passives + EMERALD WARDEN) | `a3557ce` | [PHASE_5_BLOCK_2_CROCODILES_AUDIT.md](PHASE_5_BLOCK_2_CROCODILES_AUDIT.md) |
| 3 | Light/Solar infrastructure | `ab491fa` | [PHASE_5_BLOCK_3_LIGHT_INFRA_AUDIT.md](PHASE_5_BLOCK_3_LIGHT_INFRA_AUDIT.md) |
| 4 | Spark heroes (5 + race-passives + PRISMATIC RIDE) | `7386916` | [PHASE_5_BLOCK_4_SPARKS_AUDIT.md](PHASE_5_BLOCK_4_SPARKS_AUDIT.md) |
| 5 | Hero unlock progression (lock Crocs/Sparks behind Chapter 2) | `8280154` | [PHASE_5_BLOCK_5_UNLOCK_PROGRESSION_AUDIT.md](PHASE_5_BLOCK_5_UNLOCK_PROGRESSION_AUDIT.md) |
| 6 | Sign-off + tag | (this commit) | this doc |

### A.2 What's in the game now

**5×5 element × role matrix complete**. All 25 v1 heroes implemented:

| | 🔥 Pirates | 🌑 Rock Band | ❄️ Sharks | 🌍 Crocodiles | ☀️ Sparks |
|---|---|---|---|---|---|
| ⚔ Warrior | THORGAR | RIFFBLADE | RIMEFANG | **MOSSJAW** | **EMBERSPARK** |
| ✦ Mage | EMBERHAND | KEYCRYPT | CRYOMIND | **MOSSWEAVER** | **LUMENWIND** |
| 🏹 Hunter | BLACKTOOTH | SHRIEK | BRINESHOT | **THORNBACK** | **RADIANCE** |
| 🛡 Tank | IRONBELLY | THUNDERBEAT | BULWARK | **IRONSCALE** | **AEGIS** |
| 👑 Captain | CRIMSON | NIGHTLORD | ABYSSKING | **ANCIENTSCALE** | **SOLARLORD** |

15 unlockable in Chapter 1; 10 (Crocs + Sparks) **locked behind Chapter 2** per Meta-Progression spec §7.

**5/5 Tier 3 signature combos** (race × element pairings):

| Race × Element | Name | Multiplier | Color |
|---|---|---|---|
| Pirates × Ember | THE GOLDEN HOARD | ×1.30 | #FFB84A |
| Rock Band × Umbra | THE DARK ENCORE | ×1.30 | #9B59D6 |
| Sharks × Tide | THE FROST DEEP | ×1.30 | #3B8BD4 |
| **Crocodiles × Grove** | **THE EMERALD WARDEN** | ×1.30 | #5DCA79 |
| **Sparks × Solar** | **THE PRISMATIC RIDE** | ×1.30 | #E8B84A |

---

## B. Element infrastructure complete (5/5 elements)

Per Combat Reference §11 universal hooks — all 5 elements have universal infrastructure:

| Element | Hook | Consume | Cap banner | Status |
|---|---|---|---|---|
| Fire/Ember | (per-cell `chargedCellAge` + `distributeChargeOnElementClear`) | (handled by INFERNO direct) | INFERNO! | ✅ functional (non-unified by design) |
| Frost/Tide | `onTideCellsCleared(n)` | `consumeChainStack()` | SHATTER VOLLEY! | ✅ Phase 2 B2 |
| Earth/Grove | `onGroveCellsCleared(n)` | `consumeEarthCells()` | REVENGE BURST! | ✅ **Phase 5 B1** |
| Dark/Umbra | `onUmbraCellsCleared(n)` | `consumeEncoreStacks()` | ENCORE-OF-ENCORE! | ✅ Phase 2 B1 |
| Light/Solar | `onSolarCellsCleared(n)` | `consumeShieldsForBurst()` | SHIELDS-TO-DAMAGE! | ✅ **Phase 5 B3** |

---

## C. Race-passives complete (5/5 races)

| Race | 2-of-race | 3+-of-race |
|---|---|---|
| Pirates | +10% gold drop | 15% chance double combo multiplier |
| Rock Band | +5% cascade chance | ENCORE: ULTs fire дважды подряд |
| Sharks | Swim-through icebound cells | BLOODHUNT: +30% damage when boss < 30% HP |
| **Crocodiles** | **Death Roll: first lethal hit per battle restores HP=1** | **Iron Hide: squad +1 shield each placement** |
| **Sparks** | **Charge Regen: ULT charges +10% faster (squad-wide)** | **Static Field: every 5 placements → AoE light burst** |

---

## D. Captain dual buff (5/5 captains via universal §6)

`_RACE_PLURAL` map fully populated:
```js
const _RACE_PLURAL = {
  pirate: 'PIRATES', rock: 'ROCK BAND', shark: 'SHARKS',
  crocodile: 'CROCODILES', spark: 'SPARKS'
};
```

All 5 captains auto-work via universal `calcSynergyState`:
- CRIMSON (race='pirate', stihiya='ember')
- NIGHTLORD (race='rock', stihiya='umbra')
- ABYSSKING (race='shark', stihiya='tide')
- **ANCIENTSCALE** (race='crocodile', stihiya='grove')
- **SOLARLORD** (race='spark', stihiya='solar')

No race-hardcoded checks anywhere in code (verified Phase 5 Block 2 + reaffirmed Block 5).

---

## E. Damage pipeline updated (10 multipliers)

Per Combat Reference §15 + Phase 5 work:

```
currentDmgMult × _passiveDmgContext × _ultDmgContext
  × _warbandStrikeContext × _hunterMarkContext × _grommarRallyContext
  × _packMarkContext × _helioRoarContext × _captainDualContext
  × _signatureComboContext
```

Subject to `FIRE_MULT_CAP = 3.0` (universal stack clamp).

---

## F. Defensive pipeline updated (Combat Ref §15)

```
Boss attack → newDead damage
  ↓
1. Berserker amplifier (×2 if boss < 50% HP)
2. SANCTUARY (LUMIA T3 boss dmg /2)
3. Earth-cell absorption (NEW Phase 5 B1) — distributes across grove cells
4. Crocodile DEATH ROLL race-passive (NEW Phase 5 B2) — lethal hit → HP=1 once/battle
5. FTUE safety rail (Pyredrake-only)
6. Shields (existing)
7. Hero HP (existing)
```

---

## G. Console diagnostics (5 helpers)

Triage helpers for dev/playtest:

```js
__debugHeroes()   // unlocked + squad + storage + roster (Phase 0)
__debugCharges()  // per-hero charge state (Phase 2 B3.1)
__ftueDebug()     // FTUE FSM + chronograph state (Phase 4 B2)
__chronoState()   // chronograph beat tracking (Phase 4 B1)
__debugGrove()    // earth-cell absorption state (Phase 5 B1)
__debugSolar()    // light/solar shield-to-damage state (Phase 5 B3)
```

---

## H. Phase 5 final smoke — code-state verification

JS syntax verified via JavaScriptCore (`5,112,088 byte` extracted JS, parses through 16,456+ lines clean — no SyntaxError; runtime TypeError is expected `window.addEventListener` shim absence in headless `jsc`).

Counts verified via `grep`:
- 25 hero entries in HERO_ROSTER
- 5 Crocodile entries with `locked: true`
- 5 Spark entries with `locked: true`
- 5 entries in SIGNATURE_COMBOS map
- 5 entries in `_RACE_PLURAL` map
- 4 universal element-clear hooks (tide/umbra/grove/solar)
- 4 consume helpers (chain/encore/earth/shields)
- 3 migrations (B3 / BACKLOG002 / PHASE5_chapter2_lock)
- 5 console diagnostic helpers

---

## I. Roman regression — full Chapter 1 pass

1. **Fresh install** (`localStorage.clear()` + reload):
   - Splash carousel → FTUE intro → Pyredrake fight (HP 800)
   - Chronograph PHASE A · BASICS (4 beats: MATCH / CHARGE / ULT / INCOMING ATTACK)
   - Win Pyredrake → captain pick (CRIMSON / NIGHTLORD)
   - 5 same-faction heroes unlocked + squad rebuilt to 4
   - Grunt fight → PHASE B · ADVANCED (RACE + CAPTAIN beats)
   - FTUE complete → menu

2. **Chapter 1 progression** (5 bosses):
   - Boss 1 (Pyredrake, 1800 HP): branching captain pick already unlocked 5 same-faction
   - Boss 2 (Tyrant, 3800): unlock 5 OTHER faction + SQUAD_MAX→4
   - Boss 3 (Grovewarden, 6500): unlock 2 Sharks
   - Boss 4 (Phoenix, 7500): unlock 3 Sharks + SQUAD_MAX→5
   - Boss 5 (Crypt Lich, 11000): no new heroes; Chapter 1 complete placeholder

3. **Squad-select roster after Chapter 1 complete** (15 unlocked):
   - 5 Pirates (THORGAR/EMBERHAND/BLACKTOOTH/IRONBELLY/CRIMSON)
   - 5 Rock Band (RIFFBLADE/KEYCRYPT/SHRIEK/THUNDERBEAT/NIGHTLORD)
   - 5 Sharks (RIMEFANG/CRYOMIND/BRINESHOT/BULWARK/ABYSSKING)
   - **10 locked** (Crocs + Sparks): "Coming in Chapter 2 — defeat VEROTHIRA / URSARO"

4. **Race-pure squad cinematics** (3+ same-race + same-element):
   - 3+ Pirates → THE GOLDEN HOARD cinematic + 🌟 pill ×1.30
   - 3+ Rock Band → THE DARK ENCORE
   - 3+ Sharks → THE FROST DEEP
   - 3+ Crocodiles or Sparks → cinematic system ready BUT inaccessible (locked heroes)

5. **DevTools verification**:
   - `HERO_ROSTER.length` → 30 (25 v1 + 5 clockwork placeholders)
   - `HERO_ROSTER.filter(h => !h.locked).length` → 20 (15 v1 unlockable + 5 starter prologue heroes)
   - `HERO_ROSTER.filter(h => h.race === 'crocodile').every(h => h.locked)` → true
   - `HERO_ROSTER.filter(h => h.race === 'spark').every(h => h.locked)` → true
   - `unlockHero('crocodile_warrior')` → "locked behind Chapter 2 — skipped"
   - `__debugGrove()` → grove infrastructure ready
   - `__debugSolar()` → solar infrastructure ready

6. **Game files clean**:
   - File: `5,416,119 bytes / 25,332 lines`
   - JS extracts to `5,112,088 bytes`, parses cleanly
   - No console errors through full Chapter 1

---

## J. Soft launch readiness (per Meta-Progression §1 player journey)

| Soft launch criterion | Status |
|---|---|
| 5 elements implemented (Fire/Frost/Earth/Dark/Light) | ✅ |
| 5 races implemented (Pirates/Rock/Sharks/Crocs/Sparks) | ✅ |
| 25 v1 heroes implemented | ✅ |
| 5 archetypes (Berserker/Armored/Bruiser/Phoenix/Assassin) | ✅ Phase 2 |
| 5 Chapter 1 bosses with voice lines | ✅ Phase 2 |
| 5 Tier 3 signature combos | ✅ |
| FTUE chronograph (7-min curriculum) | ✅ Phase 4 |
| Branching captain pick (BACKLOG-002) | ✅ Phase 4 |
| Phase 3 cinematics (Signature / Clutch / Death Flashback) | ✅ Phase 3 |
| **Chapter 2 (5 new bosses + 5 archetypes + Crocs/Sparks unlock)** | 🔴 **Phase 5b pending** |
| World Map cinematic (Crypt Lich aftermath) | 🔴 Phase 5b |
| Star rating system (1-3 stars/boss) | 🔴 Phase 6+ |
| Hero upgrade system (levels 1-10) | 🔴 Phase 6 |
| Tower Mode | 🔴 Phase 7 |
| Daily quests | 🔴 Phase 7 |

**Soft launch is achievable post Phase 5b** (Chapter 2 ships) — Crocs/Sparks become accessible, full 25-hero roster playable.

---

## K. Phase 5 metrics

| Metric | Phase 4 end | Phase 5 end | Δ |
|---|---|---|---|
| File size | 4.77 MB | 5.42 MB | +650 KB |
| Line count | 24,314 | 25,332 | +1,018 lines |
| Hero count | 15 unlockable | 25 (15 unlockable + 10 locked Chapter 2) | +10 |
| Signature combos | 3 (v1) | 5 (Tier 3 all races) | +2 |
| Universal hooks | 2 (tide/umbra) | 4 (+ grove + solar) | +2 |
| Consume helpers | 2 (chain/encore) | 4 (+ earth + shields) | +2 |
| Race-passives | 6 (3 races × 2 passives) | 10 (5 races × 2 passives) | +4 |
| Console diagnostics | 4 | 5 (+ __debugSolar, __debugGrove, __chronoState updated) | +1 |
| Migrations | 2 | 3 (+ PHASE5_lock_chapter2) | +1 |

---

## L. Tag history

```
v0.1.0-phase-1-done          Phase 1 — Foundation
v0.2.0-phase-2-done          Phase 2 — Element × Role × Race Grammar
v0.3.0-phase-3-done          Phase 3 — The Moment Mechanics
v0.4.0-phase-4-done          Phase 4 — Onboarding Rebuild
v0.4.1-hotfix-1              Phase 4 chronograph 2-phase split + overlay-bleed fix
v0.4.2-hotfix-2              Phase 4 EN localization + AAA+ copy pass
v0.5.0-phase-5-done          ← THIS TAG (Earth + Light Race + 25-hero matrix)
```

---

## M. Phase 5b — Chapter 2 (decoupled, ~5-6 weeks)

Per **D3 + D6** decisions:

| 5b.X | Block | Content |
|---|---|---|
| 5b.1 | Chapter 2 archetype infrastructure | Hypnotist / Engineer / Frenzy / Tempo Disruptor / Battery (5 NEW archetypes) |
| 5b.2 | 5 boss data + assets | 10 PNGs at `/assets/Game bosses/` (1086×1448 → 280×373 JPEG q80, mirrored from Phase 5 Block 2 pattern) |
| 5b.3 | VEROTHIRA (Hypnotist) | + remove `locked: true` from crocodile_warrior + crocodile_hunter |
| 5b.4 | GEARHEART (Engineer) | + remove from rest of Crocs |
| 5b.5 | URSARO (Frenzy) | + remove from spark_warrior + spark_hunter |
| 5b.6 | TIDESPIRE (Tempo Disruptor) | + remove from rest of Sparks |
| 5b.7 | HELIOTRON (Battery) | Chapter 2 finale + tag `v0.5.5-chapter-2-done` |
| 5b.8 | World Map cinematic + transition | Crypt Lich aftermath → Chapter 2 portal + Tower hint |
| 5b.9 | Sign-off | Full 10-boss regression |

When Phase 5b 5b.3-5b.6 remove `locked: true` flags, BOSS_UNLOCKS map gains entries 6-10 and `unlockHero` succeeds naturally — no further infrastructure changes needed (verified Phase 5 Block 5 audit).

---

## N. Phase 6+ pipeline (per master plan §7)

After Phase 5 + 5b ship:

- **Phase 6 — Tier + Pack Economy** (~2-3 weeks): T2/T3 ascension, hero card duplicates, premium currency layer, pack purchases, **Hero levels 1-10 upgrade system**, **Star rating system**
- **Phase 7 — Launch Prep** (~2-3 weeks): Sound + analytics + store + full launch build, **Tower Mode**, **Daily quests**, **Login bonus**, **Race-Pure mode**
- **Phase 8+ — Post-Launch Expansions**: Clockwork, Steamworks, Skeletons, Bananas, Aliens, Trolls, element-variant races, seasonal events

---

## O. Soft launch decision point

Per master plan §7: "**Soft launch = после Phase 4** (3 races, 3 elements, Onboarding ready)".

**Reality check:** Phase 5 expanded scope to 5 races / 5 elements. Soft launch decision now happens after Phase 5b (Chapter 2 ships). Pre-Phase 5b "demo" build with 15 unlockable heroes + Chapter 1 + locked Chapter 2 placeholder is also viable as **pre-soft-launch playtest build**.

---

## P. Git status

Phase 5 sign-off commit on `phase-2-grammar`. Auto-merged to `main`. Tag `v0.5.0-phase-5-done` placed on the merge commit.

```
6 blocks · 6 commits · 6 audit docs · 1 tag
```
