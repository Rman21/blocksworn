# BLOCKSWORN — COMBAT REFERENCE
## Races · Elements · Roles · Grammar · Buffs · Ultimates · Cinematics
## Single source of truth for all combat mechanics · April 2026

> **Этот документ — полная справочная по боевой системе Blocksworn.** Companion к MASTER_PLAN_V3.md (план/roadmap) и HERO_GRAMMAR.md (spec). Здесь — концентрат всех races, elements, roles, ротаций, ультимейтов, пассивок, бонусов, бафов, signature combo cinematics и FTUE chronograph в одном месте.
>
> Используй когда нужно быстро посмотреть "как работает X". Не нужно перелистывать 3 документа.

---

## ОГЛАВЛЕНИЕ

1. [Combat Architecture Overview](#1-combat-architecture-overview)
2. [The Combo Grammar (приклеить к стене)](#2-the-combo-grammar)
3. [5 Elements — детально](#3-5-elements)
4. [5 Roles — детально](#4-5-roles)
5. [Element × Role Matrix (25 архетипов)](#5-element--role-matrix)
6. [Races — все 5 v1 + post-launch](#6-races)
7. [Captain System — двойной баф](#7-captain-system)
8. [Race-passive Bonuses](#8-race-passive-bonuses)
9. [Ultimate Dispatch — как ULT работают](#9-ultimate-dispatch)
10. [Charge Mechanics — стоимость сил](#10-charge-mechanics)
11. [Universal Infrastructure (Hooks)](#11-universal-infrastructure)
12. [Squad Mechanics & Progression](#12-squad-mechanics)
13. [Boss Archetypes](#13-boss-archetypes)
14. [Combat Resolution Order](#14-combat-resolution-order)
15. [Damage Pipeline & Multipliers](#15-damage-pipeline)
16. [Quick Reference Cards](#16-quick-reference)
17. [Phase 3 — The Moment Mechanics](#17-phase-3-mechanics) ⭐ *added in doc-sync*
18. [Phase 4 — Onboarding & FTUE](#18-phase-4-mechanics) ⭐ *added in doc-sync*

---

## 1. COMBAT ARCHITECTURE OVERVIEW

Blocksworn boevoi system построен на трёх независимых осях:

```
┌─────────────────────────────────────────────────────────┐
│                     HERO IDENTITY                       │
│                                                         │
│   ELEMENT (mechanical) × ROLE (functional) × RACE (flavor) │
│      what spells          what verb           what skin │
│      ember/tide/grove/    create/amplify/     pirate/   │
│      umbra/solar          detonate/protect/   shark/    │
│                           enable              rock/etc. │
└─────────────────────────────────────────────────────────┘
```

**Mechanical identity = Element.** Fire hero plays differently from Frost hero — burst vs tempo control.

**Functional identity = Role.** Warrior creates, Hunter detonates, Mage amplifies. Same role across elements has same combo verb.

**Flavor + collection axis = Race.** Same Fire Warrior играется одинаково в Pirates и Sharks (если Sharks были бы Fire) — но выглядит/звучит/имеет race-passive по-разному.

**Critical:** Race ≤ 30% impact на damage. Element всегда доминирует.

---

## 2. THE COMBO GRAMMAR

Это сердце игры. **Без этой grammar нет The Moment.**

```
╔═══════════════════════════════════════════════════════════╗
║  Warrior CREATES → Mage AMPLIFIES → Hunter DETONATES      ║
║         = DAMAGE CASCADE                                  ║
║                                                           ║
║  Tank ABSORBS = team gets more turns                      ║
║  Captain ENABLES = cascade × multiplier + drops           ║
╚═══════════════════════════════════════════════════════════╝
```

Каждое размещение фигуры = ответ на вопрос:

> **"Я сейчас CREATE / AMPLIFY / DETONATE / PROTECT / ENABLE?"**

Это базис predictability. Игрок видит на 3 хода вперёд потому что grammar consistent across elements.

### Канонический cascade flow (Fire example)

```
Turn 1: THORGAR (Fire Warrior) places → CREATES ember-charged cells
Turn 2: EMBERHAND (Fire Mage) fires → AMPLIFIES (+50% INFERNO mult, 3 placements)
Turn 3: BLACKTOOTH (Fire Hunter) fires → DETONATES all charged cells
        → INFERNO ×3 cap × 1.5× amp = burst kill
```

Same flow для Dark, Frost, Earth, Light — same verbs, different visuals.

---

## 3. 5 ELEMENTS

### 🔥 FIRE (in-world: EMBER)
**Core mechanic:** Charged cells created by Warrior, amplified by Mage, detonated by Hunter (mass burst).
**Combat role:** Damage payoff. Fastest cascades.
**Side-system state:** charged ember cells на board.
**Cap:** INFERNO multiplier ×3 при 6+ charged cells.
**Universal hook:** `onEmberCellsCleared(n)` (planned — currently Pirates uses charge timers per cell).
**Identity:** "Burst и взрыв. Rage payoff."

### ❄️ FROST (in-world: TIDE)
**Core mechanic:** Frost cells require chain (3+ in line) to clear. Longer chains = more CRIT при детонации.
**Combat role:** Tempo control. Замораживает ходы босса. CRYOMIND extends, BRINESHOT detonates wider lines.
**Side-system state:** `frostChainSegments` (cap 8) + `activeChains` array.
**Cap:** SHATTER VOLLEY 4-row line при chain length ≥ 4.
**Universal hooks:** `onTideCellsCleared(n)`, `consumeChainStack()` (B2).
**Identity:** "Контроль времени. Slow burn power."

### 🌍 EARTH (in-world: GROVE)
**Core mechanic:** Earth-cells absorb boss damage instead of player HP. Hunter detonates accumulated absorbed damage as burst.
**Combat role:** Survival → Revenge. Чем больше absorbed → тем больше REVENGE BURST.
**Side-system state:** `earthCells` array, each tracks accumulated absorbed damage.
**Cap:** REVENGE BURST 4-row line при absorbed damage ≥ threshold (1000 candidate).
**Universal hooks:** `onGroveCellsCleared(n)`, `consumeEarthCells()`, `absorbBossDamage(amount)` (Phase 5 planned).
**Identity:** "Терпеть и наказать. Tank-and-spank."

### 🌑 DARK (in-world: UMBRA)
**Core mechanic:** Dark cells cleared = Encore stacks. Hunter detonates × всего stacks; line repeats once at 50% (Encore-of-Encore).
**Combat role:** Escalation. Больше играешь → сильнее становишься.
**Side-system state:** `encoreStacks` (cap 8).
**Cap:** ENCORE-OF-ENCORE banner при stacks ≥ 4.
**Universal hooks:** `onUmbraCellsCleared(n)`, `consumeEncoreStacks()` (B1).
**Identity:** "Накапливай и взрывай. Dark spiral."

### ☀️ LIGHT (in-world: SOLAR)
**Core mechanic:** Light cell clears → +1 shield per cell. Hunter конвертит ВСЕ shields в один burst attack.
**Combat role:** Sustain → Conversion. Накопил защиту → потратил на damage.
**Side-system state:** `lightCells` array + existing shieldPool.
**Cap:** SHIELDS-TO-DAMAGE banner при shields ≥ 8.
**Universal hooks:** `onSolarCellsCleared(n)`, `consumeShieldsForBurst()` (Phase 5 planned).
**Identity:** "Жди и наказывай. Defensive payoff."

---

## 4. 5 ROLES

Role = **combo verb**. Same verb across all elements.

### ⚔️ WARRIOR — CREATOR
**What it does:** Создаёт element-charged клетки на линии фигуры. Источник цепочки.
**Charge cost relative:** medium (combo ≥ 2 для fire)
**Common pattern:** Direct hit damage + spawn charged cells.
**v1 examples:** THORGAR (Fire), RIFFBLADE (Dark), RIMEFANG (Frost). MOSSJAW (Earth), EMBERSPARK (Light) — Phase 5.
**Combo position:** Step 1 — opens cascade.

### ✦ MAGE — AMPLIFIER
**What it does:** Усиливает существующие charged cells/stacks. **NO new state — only amplifies.**
**Charge cost relative:** medium-slow (period ≈ 12 placements)
**Common pattern:** Opens 3-placement amp window with multiplier based on current side-system state.
**v1 examples:** EMBERHAND BLOOM (+50% INFERNO), KEYCRYPT DEEP BEAT (+20% per stack), CRYOMIND TIDE WEAVE (+25% per chain).
**Combo position:** Step 2 — boost the cascade.

**CRITICAL RULE:** Mage NEVER creates new charged state. Если создаёт — это ROLE-VERB CONFLICT и должен быть escalated к MGD.

### 🏹 HUNTER — DETONATOR
**What it does:** Mass-detonates всех charged cells/stacks/chains/earth-cells/shields. Главный damage dealer.
**Charge cost relative:** fastest (combo ≥ 2)
**Common pattern:** Sum × multiplier × amplifier-mult (if active) → big burst. Banner when threshold hit.
**v1 examples:** BLACKTOOTH INFERNO (×3 cap), SHRIEK Encore-of-Encore, BRINESHOT SHATTER VOLLEY (4-row).
**Combo position:** Step 3 — payoff.

**Primer-shot fallback:** все Hunter fires должны иметь fallback flat damage когда side-system state = 0. "NO STACKS" / "NO CHAINS" flash. Никогда не wasted.

### 🛡️ TANK — PROTECTOR
**What it does:** Создаёт shields, absorbs attacks, element-specific defense. Keeps team alive.
**Charge cost relative:** slowest (no minCombo, no period — accumulate medieval)
**Common pattern:** Per-fire small damage + shields + element-specific passive hook.
**v1 examples:** IRONBELLY counter-burns + ULT seeds ember, THUNDERBEAT shield-on-encore-proc, BULWARK shield-per-chain-broken.
**Combo position:** Tempo — generates turns.

### 👑 CAPTAIN — ENABLER
**What it does:** Один на squad. Двойной buff: race scaling + element drop rate. ULT triggers squad-wide window.
**Charge cost relative:** medium (period ≈ 10 placements)
**Common pattern:** Small board impact (convert cells to element) + universal captain dual through §6 system.
**v1 examples:** CRIMSON DOMINION, NIGHTLORD, ABYSSKING DEEP TIDE.
**Combo position:** Multiplier — caps the cascade.

**ONE captain max per squad** (auto-swap Pillar 20 from Phase 4 archive).

---

## 5. ELEMENT × ROLE MATRIX

5 elements × 5 roles = **25 unique hero archetypes**. Каждая клетка = unique mechanical identity.

| | 🔥 FIRE/EMBER | ❄️ FROST/TIDE | 🌍 EARTH/GROVE | 🌑 DARK/UMBRA | ☀️ LIGHT/SOLAR |
|---|---|---|---|---|---|
| **⚔️ WARRIOR** *(CREATE)* | Создаёт ember-charged cells | Создаёт frost cells (chain seeds) | Создаёт earth cells (absorbing) | Создаёт umbra cells + Encore stack creation hook | Создаёт light cells (+1 shield each) |
| **✦ MAGE** *(AMPLIFY)* | +50% INFERNO mult | +25% per chain SHATTER mult | +1.5× absorption + REVENGE scaling | +20% per stack ENCORE mult | Light clears = +2 shields (vs +1) |
| **🏹 HUNTER** *(DETONATE)* | INFERNO ×3 cap mass burn | SHATTER VOLLEY (1-4 row by chain) | REVENGE BURST = absorbed dmg | ENCORE-of-ENCORE 50% repeat | SHIELDS-TO-DAMAGE single burst |
| **🛡️ TANK** *(PROTECT)* | Counter-burns, ember-seeding ULT | Shield per chain segment, refund placement ULT | Auto-convert hits to earth-cells | +1 shield per encore proc, encore window ULT | Auto-block 1 attack/turn, shield distribution ULT |
| **👑 CAPTAIN** *(ENABLE)* | DOMINION ULT spawns ember field | DEEP TIDE chills entire board 2 turns | BASTION ULT auto-shields + earth field | DARK DOMINION encore window squad-wide | ETERNAL DAWN heal + radiate shields |

---

## 6. RACES

### v1 RACES (3 — soft launch ready)

#### 🏴‍☠️ PIRATES — Fire / Ember
**Status:** ✅ Implemented (Block B0)
**Heroes:** THORGAR (W) / EMBERHAND (M) / BLACKTOOTH (H) / IRONBELLY (T) / CRIMSON (C)
**Race-passive:**
- 2-of-race: +10% gold drop
- 3+-of-race: 15% chance double combo multiplier
**Visual:** Skull-and-crossbones aesthetic, ember-fire weaponry, pirate ship vibes
**Combat identity:** Burst rage. Fastest cascades.

#### 🎸 ROCK BAND — Dark / Umbra
**Status:** ✅ Implemented (Block B1)
**Heroes:** RIFFBLADE (W) / KEYCRYPT (M) / SHRIEK (H) / THUNDERBEAT (T) / NIGHTLORD (C)
**Race-passive:**
- 2-of-race: +5% cascade chance
- 3+-of-race: ENCORE — ULTs fire дважды подряд
**Visual:** Heavy metal stage aesthetic, instruments as weapons, gothic/dark
**Combat identity:** Escalation. Stacks build, then explode.

#### 🦈 SHARKS — Frost / Tide
**Status:** ✅ Implemented (Block B2)
**Heroes:** RIMEFANG (W) / CRYOMIND (M) / BRINESHOT (H) / BULWARK (T) / ABYSSKING (C)
**Race-passive:**
- 2-of-race: Swim-through icebound cells
- 3+-of-race: BLOODHUNT — +30% damage когда boss < 30% HP
**Visual:** Deep-sea predator aesthetic, ice-blue scales, bone weaponry
**Combat identity:** Tempo control. Chains build the storm.

### Phase 5 RACES (2 — pre-full-launch)

#### 🐊 CROCODILES — Earth / Grove
**Status:** 🔴 Phase 5 backlog (RACE_BACKLOG_PHASE_5.md)
**Heroes (proposed):** MOSSJAW (W) / MOSSWEAVER (M) / THORNBACK (H) / IRONSCALE (T) / ANCIENTSCALE (C)
**Race-passive:**
- 2-of-race: **Death Roll** — first hero death is denied; revives at 1 HP (per battle)
- 3+-of-race: **Iron Hide** — squad gains +1 shield each turn
**Visual:** Mossy stone-armored crocs, emerald crystal weaponry, earth/vine accents
**Combat identity:** Survival → revenge. Tank-and-spank.

#### ⚡ SPARKS — Light / Solar
**Status:** 🔴 Phase 5 backlog (RACE_BACKLOG_PHASE_5.md)
**Heroes (proposed):** EMBERSPARK (W) / LUMENWIND (M) / RADIANCE (H) / AEGIS (T) / SOLARLORD (C)
**Race-passive:**
- 2-of-race: **Charge Regen** — ULT charges +10% faster
- 3+-of-race: **Static Field** — every 5 placements triggers AoE light burst
**Visual:** Living flame spirits, golden crystalline armor, radiant aura
**Combat identity:** Sustain → conversion. Shields = ammunition.

### Post-launch RACE EXPANSIONS (Phase 8+)

| # | Race | Element | Когда | Identity |
|---|---|---|---|---|
| 1 | **Clockwork** | Frost (alt) | +2-3 mo | Mechanical precision, gear-based combos |
| 2 | **Steamworks** | Mixed (Fire/Dark) | +5-6 mo | Industrial revolution mech-heroes |
| 3 | **Skeletons/Knights** | Frost (alt) | +8 mo | Necromancy + chivalry hybrids |
| 4 | **Bananas** | Light | +10 mo | Comedy faction — kinetic absurdism |
| 5 | **Aliens** | Dark | +12 mo | Reality-bending invaders |
| 6 | **Trolls/Gnomes** | Earth (alt) | +14 mo | Underground earth specialists |

Plus **element variants** of existing races (Fire Sharks, Dark Crocodiles) as mini-expansions.

### Race rules (non-negotiable)

1. Race ≠ mechanical identity — only flavor + collection + race-passive
2. Race-passive ≤ 30% impact on damage — element dominates
3. Race-passive activates at 2-of-race (small) and 3+-of-race (strong)
4. One element per hero in v1 (no dual-element until expansions)
5. Same role × same element across two races = mechanically identical, visually different

---

## 7. CAPTAIN SYSTEM

The most leverage decision in squad-building.

### Двойной баф

**ONE Captain per squad.** Provides TWO independent bonuses:

#### A) Race buff (scaling с количеством своей расы в squad)
- 1 of race (only captain) = **+5%** damage to race-mates
- 2 of race = **+15%** damage
- 3+ of race = **+30%** damage

#### B) Element drop buff (FIXED, not scaling)
- Captain Fire = **+25%** ember piece drop weight
- Captain Frost = **+25%** tide piece drop weight
- Captain Dark = **+25%** umbra piece drop weight
- Captain Earth = **+25%** grove piece drop weight
- Captain Light = **+25%** solar piece drop weight

### How it works (universal §6 system)

```
calcSynergyState() detects captain → captainHero = squad.find(h => h.newRole === 'captain')

If captain present:
  captainDual_active = true
  captainDual_race = captain.race          // 'pirate', 'shark', 'rock', etc.
  captainDual_stihiya = captain.stihiya    // 'ember', 'tide', 'umbra', etc.
  captainDual_raceMult = scaling formula based on sameRaceCount
  captainDual_dropBonus = 0.25 (fixed) added to spawnWeights[stihiya]
```

**Universal — no race-specific code needed.** Adding new captain hero (e.g., Crocodiles ANCIENTSCALE) auto-works through the system as long as `_RACE_PLURAL[race]` includes plural form.

### Captain ULT pattern

Каждый Captain ULT = **squad-wide enable window** (3 placements typical):
- CRIMSON DOMINION: spawns ember field на board
- NIGHTLORD: encoreWindowActive=true (squad-wide encore)
- ABYSSKING DEEP TIDE: chill entire board 2 turns
- ANCIENTSCALE Eternal Bastion (Phase 5): each hero +3 shields + earth field
- SOLARLORD Eternal Dawn (Phase 5): heal squad + radiate shields

### Captain UI (synergy bar)

Pill rendering:
- **Gold gradient** (CSS class `.syn-pill.captain`)
- Format: `👑 [RACE PLURAL]: +X% race_dmg · +25% [stihiya]_drops`
- Examples:
  - `👑 PIRATES: +30% pirate_dmg · +25% ember_drops`
  - `👑 ROCK BAND: +30% rock_dmg · +25% umbra_drops`
  - `👑 SHARKS: +30% shark_dmg · +25% tide_drops`

---

## 8. RACE-PASSIVE BONUSES

| Race | Element | 2-of-race passive | 3+-of-race passive |
|---|---|---|---|
| **Pirates** | Fire | +10% gold drop | 15% chance double combo multiplier |
| **Rock Band** | Dark | +5% cascade chance | ENCORE: ULTs fire дважды подряд |
| **Sharks** | Frost | Swim-through icebound cells | BLOODHUNT: +30% damage when boss < 30% HP |
| **Crocodiles** *(Ph5)* | Earth | Death Roll: first hero death → revives at 1 HP | Iron Hide: squad +1 shield each turn |
| **Sparks** *(Ph5)* | Light | Charge Regen: ULT +10% faster | Static Field: every 5 placements = AoE burst |

### Activation rules

- 1 hero of race (только captain или alone) → **NO passive** (only captain dual buff if applicable)
- 2 heroes of race → **small passive** (~10-15% impact)
- 3+ heroes of race → **strong passive** (~25-30% impact) + cinematic feedback

### Race-pure squad strategy

Best with race-pure squad: 3 of race + Captain of same race.
Activates: 3+ race-passive + max captain race buff (+30%) + captain element drop (+25%).

Example: 3 Pirates + CRIMSON
- +30% pirate damage (captain race buff scaling)
- +25% ember drops (captain element buff)
- Pirate 3+ passive: 15% double combo multiplier
- Total damage uplift: ~50-60% vs neutral squad

---

## 9. ULTIMATE DISPATCH

How ULTs actually fire.

### Ultimate types (per role)

#### Warrior ULT — board CREATE
- THORGAR: spawns 3-5 charged ember cells in random positions
- RIFFBLADE: SIEGE — encore-stack-on-clear doubles for 3 placements
- RIMEFANG: SIEGE — chains shatter on next chain (full board frost burst)
- MOSSJAW Bedrock Bastion (Ph5): convert all empty cells to earth
- EMBERSPARK Sun Cascade (Ph5): convert 5 cells to solar + 2× shields per clear

#### Mage ULT — squad-wide AMPLIFY
- EMBERHAND: BLOOM extended — +50% INFERNO for 5 placements (vs base 3)
- KEYCRYPT: every squad hero gets one free Encore (DEBT-016 — pending B5)
- CRYOMIND: TIDE WEAVE freezes boss attack timer +1 turn
- MOSSWEAVER Verdant Surge (Ph5): convert all shields to bonus damage
- LUMENWIND Halo of Suns (Ph5): double current shields (8 → 16) for 2 turns

#### Hunter ULT — mass DETONATE
- BLACKTOOTH: VOLLEY — INFERNO without ×3 cap (uncapped massive burst)
- SHRIEK: VOLLEY — Encore-of-Encore at 100% (vs base 50%)
- BRINESHOT: VOLLEY — chain rows × 2 (1-4 row → 2-8 row)
- THORNBACK Vengeance Quake (Ph5): triple absorbed damage of largest earth-cell
- RADIANCE Aurora Burst (Ph5): SHIELDS-TO-DAMAGE without consuming shields

#### Tank ULT — board PROTECT
- IRONBELLY: AEGIS — seeds 3-5 charged ember cells + counter-burns
- THUNDERBEAT: AEGIS — free Rhythm proc + squad-wide encore window (DEBT-016)
- BULWARK: AEGIS — refund 1 placement (DEBT-017 — Phase 6) OR fallback +3 shields
- IRONSCALE Wall of Roots (Ph5): full row earth-cells, 3 turns absorption
- AEGIS Equilibrium (Ph5): pool & redistribute shields equally + 1 turn immunity

#### Captain ULT — squad-wide ENABLE
- CRIMSON: DOMINION — spawn ember field на board
- NIGHTLORD: DOMINION — encoreWindowActive squad-wide for 3 placements
- ABYSSKING: DOMINION — chill entire board 2 turns
- ANCIENTSCALE Eternal Bastion (Ph5): squad +3 shields + 5 earth cells
- SOLARLORD Eternal Dawn (Ph5): heal squad +25% HP + 2 shields each + 4 solar cells

### ULT dispatch flow

```
fireHero(hero) → checks if hero.charge ≥ hero.period
  → if ULT charge ready: ultRoleDispatch(hero) → routes to hero.ultSignature()
  → if not: hero.fire(counts)

ultRoleDispatch routes through:
  ultTwistThorgar / ultTwistEmberhand / ultTwistBlacktooth / ultTwistIronbelly /
  ultTwistCrimson / ultTwistRiffblade / ... etc.

After ULT fires:
  hero.charge = 0 (reset)
  ULT visual feedback (banner, flash)
  Show signature line in dialog (e.g., "DOMINION!" "INFERNO!" "ENCORE-OF-ENCORE!")
```

### ULT charge accumulation (current model — per-role cost)

> 📌 **HOTFIX B3.3 model** (zafiksirovan v master plan §9.1 amendment log). Older `minCombo + period` model deprecated.

**Per-role cost** — fixed integer per `newRole`:

```javascript
const HERO_ULT_COST_BY_NEWROLE = {
  warrior: 80,
  mage:    100,
  hunter:  120,
  tank:    80,
  captain: 100,
};
```

ULT ready when `heroCharges[heroId] ≥ getUltCost(heroId)`.

**Per-cell charge** — inverse-scaling по количеству героев matching element:

```javascript
const HERO_CHARGE_PER_CELL_BY_COUNT = { 1: 20, 2: 14, 3: 10 };
// 1 hero of element  → +20 per cleared cell
// 2 heroes of element → +14 per cleared cell each
// 3+ heroes of element → +10 per cleared cell each
```

**Cost ordering** (fastest → slowest by cells needed):
- Warrior / Tank (cost 80) ← fastest
- Mage / Captain (cost 100)
- Hunter (cost 120) ← slowest but largest payoff

**Why Hunter is slowest** despite being "DETONATOR":
- Hunter ULT effects scale with **side-system state** (charged cells, encore stacks, frost chains)
- Slowest cost ensures Hunter fires when state is highest = biggest burst
- Warriors/Tanks fire often (frequent CREATE / PROTECT setup)
- Mages/Captains fire medium (strategic AMPLIFY / ENABLE windows)

---

## 10. CHARGE MECHANICS

How heroes charge their abilities. **Per-role cost model** (HOTFIX B3.3 + element-driven distribution post HOTFIX B3.1).

### Per-hero independent charges (CRITICAL invariant)

`heroCharges = { heroId: 0..120 }` — каждый герой имеет own charge counter.

**Firing one hero changes ONLY that hero's charge.** Other heroes' charges INDEPENDENT.

> 📌 This was broken in B3 — fixed in HOTFIX B3.1 by restoring per-hero state from archived/phase-4 commit b0796ac. Documented explicitly to prevent regression.

### Charge advancement — element-driven

**On cell-clear cascade** (the ONLY way charge accumulates in v1):

```javascript
function distributeChargeOnElementClear(element, cellsCleared) {
  const matching = HERO_DECK.filter(h => h && h.stihiya === element);
  if (matching.length === 0) return;
  const gain = HERO_CHARGE_PER_CELL_BY_COUNT[clamp(matching.length, 1, 3)] * cellsCleared;
  for (const h of matching) addChargeToHero(h.id, gain);
}
```

**Inverse-scaling by element count** (HERO_CHARGE_PER_CELL_BY_COUNT):
- 1 hero of element in squad → +20 charge per cleared cell
- 2 heroes of element → +14 charge per cleared cell each
- 3+ heroes of element → +10 charge per cleared cell each

> **Why inverse-scaling?** Race-pure squads (3+ same element) get massive cascade payoffs — but each individual hero charges slower. Mixed squads charge faster per-hero but lose race-passive + signature combo.

**On ULT fire:**
- Firing hero's charge resets to 0
- Other heroes' charges UNCHANGED
- ULT-READY transition flash + per-hero vibrate(60) on first cross of `prev < cost ≤ next`

### Per-role cost (fastest → slowest)

```
Warrior  cost=80  ← fastest (CREATE often)
Tank     cost=80  ← fast (PROTECT often)
Mage     cost=100 ← medium (AMPLIFY rarely)
Captain  cost=100 ← medium (ENABLE rarely, high-impact)
Hunter   cost=120 ← slowest (DETONATE on biggest state)
```

> **Note**: Inverts the original §2.3 ordering in master plan. Per amendment log §9.1 entry, this serves grammar: Hunter waits for state to peak (charged cells / encore stacks / frost chain length), then explodes. Warriors fire frequently to seed.

### Edge cases

- **No matching squad heroes** for cleared element → charge dropped (not banked).
- **Element not in `computeActiveElements()`** → cells of that element don't drop in tray; non-issue.
- **Captain element drop bonus** — captain race buff makes captain's element drop more, but charge math still uses raw cell counts.

---

## 11. UNIVERSAL INFRASTRUCTURE

Cross-element shared systems that make grammar work without per-hero code duplication.

### Element gating

```javascript
function computeActiveElements() {
  // Returns Set of elements active in current battle
  // Sources: squad heroes' elements + boss element
  const elements = new Set();
  HERO_DECK.forEach(h => h && elements.add(h.stihiya));
  if (currentBoss?.element) elements.add(currentBoss.element);
  return elements;
}
```

**Purpose:** drops, stack accumulation, captain pill rendering all gated by what's actually relevant in this fight.

**Example:** Pirate-only squad vs Pyredrake (Fire boss) → activeElements = {ember} only. Tide cells don't drop, frost chains don't accumulate.

### Per-element clear hooks (universal)

| Element | Hook | Triggered | Status |
|---|---|---|---|
| Fire/Ember | *(no universal hook — uses `chargedCellAge` per-cell + element-driven `distributeChargeOnElementClear`)* | On ember cell clear | ✅ functional, non-unified |
| Frost/Tide | `onTideCellsCleared(n)` | On tide cell clear (B2) | ✅ universal |
| Earth/Grove | `onGroveCellsCleared(n)` | Phase 5 | 🔴 not built |
| Dark/Umbra | `onUmbraCellsCleared(n)` | On umbra cell clear (B1) | ✅ universal |
| Light/Solar | `onSolarCellsCleared(n)` | Phase 5 | 🔴 not built |

> 📌 Ember is the only v1 element without a unified `onXCellsCleared` hook. Pirates uses per-cell timers + race-specific charge logic instead. Future cleanup (post Phase 5) could unify under `onEmberCellsCleared` for consistency, but functionally indistinguishable from the player's perspective.

These hooks are THE place where Warrior CREATE half of the spec lives — universal, not per-hero.

### Per-element consume helpers

| Element | Helper | Used by |
|---|---|---|
| Fire | (charge-timer-based, not consume helper) | BLACKTOOTH INFERNO |
| Frost | `consumeChainStack()` | BRINESHOT SHATTER (B2) |
| Earth | `consumeEarthCells()` | THORNBACK Crystal Volley (Ph5) |
| Dark | `consumeEncoreStacks()` | SHRIEK Encore-of-Encore (B1) |
| Light | `consumeShieldsForBurst()` | RADIANCE Solar Lance (Ph5) |

These helpers are THE place where Hunter DETONATE half lives + side-effects (Tank shield bumps, etc.).

### Captain dual buff (universal §6)

`calcSynergyState()` runs each turn → detects captain → injects `_captainDualContext` into `dealDamage` mult stack. Race-agnostic.

### Race plural map

```javascript
const _RACE_PLURAL = {
  pirate: 'PIRATES',
  rock: 'ROCK BAND',
  shark: 'SHARKS',
  croc: 'CROCODILES',     // Phase 5
  spark: 'SPARKS',         // Phase 5
  // post-launch races added here
};
```

Used by captain pill text rendering. New race? Add entry, captain auto-works.

### Element flash overlays

| Element | Banner | Trigger |
|---|---|---|
| Fire | INFERNO! | 6+ charged cells detonated |
| Frost | SHATTER VOLLEY! | chain length ≥ 4 |
| Earth | REVENGE BURST! | absorbed damage threshold |
| Dark | ENCORE-OF-ENCORE! | encore stacks ≥ 4 |
| Light | SHIELDS-TO-DAMAGE! | shields ≥ 8 converted |

---

## 12. SQUAD MECHANICS

### SQUAD_MAX progression

| Stage | SQUAD_MAX | Trigger |
|---|---|---|
| Game start | 3 | Cognitive load — учим grammar |
| Win Boss 2 (Abyssal Tyrant) | 4 | "+1 SQUAD SLOT" celebration |
| Win Boss 4 (Solar Phoenix) | 5 | "+1 SQUAD SLOT" celebration |

State persisted via `localStorage[bw_squad_max]`. Migration `runMigration_B3()` backfills based on `bossesDefeated`.

### Hero unlock progression (Model B + BACKLOG-002 branching captain pick)

> 📌 **BACKLOG-002 changed the timeline**. Originally Boss 1 unlocked +EMBERHAND/IRONBELLY (linear). Now after Pyredrake win, player picks **CRIMSON or NIGHTLORD** as starting captain — that choice unlocks 5 same-faction heroes simultaneously. Phase 4 doc-sync timeline below.

| Stage | Heroes unlocked | Cumulative |
|---|---|---|
| Game start (FTUE) | 3 prologue heroes (mixed-race): pirate_warrior + pirate_hunter + rock_mage | 3 |
| Win Pyredrake (FTUE Boss 1) | **Branching captain pick**: choose CRIMSON or NIGHTLORD path | 3 → 5 |
| Pick CRIMSON (Pirates) | Unlock 5 Pirates: warrior + mage + hunter + tank + captain | 5 (Pirates) |
| OR Pick NIGHTLORD (Rock Band) | Unlock 5 Rock Band: warrior + mage + hunter + tank + captain | 5 (Rock) |
| Squad post-pick | 4 active (W + M + H + Captain) — tank in roster but not in squad slot | SQUAD_MAX 3 still |
| Win Grunt (FTUE Boss 1.5) | FTUE complete; full menu unlocked | 5 |
| Win Boss 2 (Abyssal Tyrant) | + 5 of OTHER captain's faction (the path NOT chosen) | 10 + SQUAD_MAX→4 |
| Win Boss 3 (Grovewarden) | + RIMEFANG, BRINESHOT (2 Sharks) | 12 |
| Win Boss 4 (Solar Phoenix) | + CRYOMIND, BULWARK, ABYSSKING (rest of Sharks) | 15 + SQUAD_MAX→5 |
| Win Boss 5 (Crypt Lich) | Chapter 1 complete celebration | 15 |

**Branching consequence:** Players who pick CRIMSON go through Pirates → Rock Band → Sharks. Players who pick NIGHTLORD go through Rock Band → Pirates → Sharks. Same total heroes unlocked, different exposure order.

State persisted: `hero.unlocked` boolean + `HEROES_UNLOCKED_STORAGE_KEY`.

**Tank backfill migration** (`runMigration_BACKLOG002_tank_backfill`): pre-BACKLOG-002 saves had captain unlocked but tank NOT unlocked (BACKLOG-002 originally only unlocked 4 of 5 faction heroes). Migration runs once at parse time, backfills missing tanks for any faction with unlocked captain. Idempotent flag in localStorage.

### Squad templates

| Template | Composition | Strategy |
|---|---|---|
| **Burst** | Warrior + Mage + Hunter (one element) | CREATE → AMPLIFY → DETONATE pure |
| **Sustain** | Tank + Captain + Hunter | Survive then strike |
| **Control** | Warrior + Mage + Tank (Frost) | Slow boss, build storm |
| **Race-pure** | 3 of one race + Captain of same race | Max race-passive + captain race buff |

### Captain selection — highest leverage decision

Captain choice影響:
- Race buff scaling (which race получает damage uplift)
- Element drop rate (which element falls more often в tray)
- ULT signature (which squad-wide effect available)

**Recommended:** Match captain to dominant squad race when possible. Match to boss element when squad mixed.

---

## 13. BOSS ARCHETYPES

5 archetypes, 5 bosses (Chapter 1).

| # | Boss | Element | Archetype | HP | atkInterval | Mechanic | Visual aura |
|---|---|---|---|---|---|---|---|
| 1 | **PYREDRAKE** | 🔥 Fire | **Berserker** | 1800 | 11 | ×2 attack damage at HP ≤ 50% | Red pulsing aura |
| 2 | **ABYSSAL TYRANT** | ❄️ Frost | **Armored** | 3800 | 9 | 70% damage absorb (existing armor profile) | Cool blue steel sheen |
| 3 | **GROVEWARDEN** | 🌍 Earth | **Bruiser** *(default)* | 6500 | 7 | 1.5× HP, 7-CD attacks | Warm green organic breath |
| 4 | **SOLAR PHOENIX** | ☀️ Light | **Phoenix** | 7500 | 6 | 60% HP rebirth + 2-turn motif immunity | Gold rebirth aura |
| 5 | **CRYPT LICH** | 🌑 Dark | **Assassin** | 11000 | 5 | 1.4× damage, 4-CD attack | Purple shadow tendrils |

> 📌 FTUE Pyredrake override: HP 1800→800, attackInterval 11→15 (`getEffectiveBossStats` gates on `ftueIs('pyredrake_fight') && img==='Boss_1' && !_isFtueOnly`). Tuned for first-fight playability.

### Attack telegraph patterns

| Archetype | Telegraph label | Mechanic |
|---|---|---|
| Berserker | ⚡ BERSERKER STRIKE | Chaotic random AoE |
| Armored | 🛡 ROW STRIKE | Predictable row |
| Bruiser | 🌿 BLOOM STRIKE | Bloom delayed AoE (3-turn warning) |
| Phoenix | ☀ SOLAR LINE | Line strike on column |
| Assassin | ▦ DARK GEOMETRY | Multi-cell pattern |

### Boss voice lines (Chapter 1 — 15 lines)

| Boss | Intro | Mid (HP < 50%) | Death (final kill) |
|---|---|---|---|
| **PYREDRAKE** | "The cinder that refuses to die... STILL BURNS." | "Your flames are kindling to mine." | "I... will return... in ash..." |
| **ABYSSAL TYRANT** | "You disturb the depths. The depths answer." | "Tide does not retreat. Tide consumes." | "...the deep... remembers..." |
| **GROVEWARDEN** | "The forest watches. The forest judges." | "You are temporary. We are root and bough." | "...new growth... from old wounds..." |
| **SOLAR PHOENIX** | "I have died. I have risen. WATCH ME RISE AGAIN." | "Each death is rehearsal. I AM ETERNAL." | "Not... yet... not... yet..." |
| **CRYPT LICH** | "Mortals. Such... persistent... noise." | "Your defiance amuses me. Briefly." | "Death... is... a... door..." |

---

## 14. COMBAT RESOLUTION ORDER

What happens когда player places a piece:

```
1. Place piece on grid
2. Check for line clears (rows + cols completed)
3. For each cleared cell:
   - Check element type (ember/tide/grove/umbra/solar)
   - Trigger element-specific hook (onUmbraCellsCleared, etc.)
   - Award element-specific bonuses
4. Calculate combo (number of clears × multiplier)
5. Update charge meters:
   - All heroes with period: charge += 1
   - Heroes with minCombo if combo ≥ threshold: charge += 1
6. Check for ULT readiness:
   - Display ULT-ready visual on hero portraits
7. Apply per-placement decrements:
   - EMBERHAND BLOOM duration--
   - KEYCRYPT DEEP BEAT duration--
   - CRYOMIND WEAVE duration--
   - Any expired → reset state
8. Boss countdown:
   - attackCountdown -= 1
   - If 0: boss attacks → trigger archetype mechanic
9. Check victory condition:
   - bossHP ≤ 0:
     - If revivesRemaining > 0 (Phoenix): trigger maybePhoenixRevive
     - Else: fire boss death voice → victory cinematic
10. Check defeat condition:
    - playerHP ≤ 0: trigger Death Flashback (Phase 3) → game over
```

---

## 15. DAMAGE PIPELINE & MULTIPLIERS

How damage gets calculated. **10-multiplier stack, multiplicative, capped at FIRE_MULT_CAP.**

### Actual code stack (`dealDamage` line ~17831)

```javascript
const _multStack = currentDmgMult * _passiveDmgContext * _ultDmgContext
                 * _warbandStrikeContext * _hunterMarkContext
                 * _grommarRallyContext  * _packMarkContext * _helioRoarContext
                 * _captainDualContext   * _signatureComboContext;
const _clampedMult = Math.min(FIRE_MULT_CAP, _multStack);
```

### Per-multiplier breakdown

| # | Multiplier | When > 1 | Source |
|---|---|---|---|
| 1 | `currentDmgMult` | Combo multiplier from cells cleared | core combo system |
| 2 | `_passiveDmgContext` | Race-passive damage bonuses (Pirates 15% double, Sharks BLOODHUNT) | race-passive system |
| 3 | `_ultDmgContext` | Hero-firing-ULT context (e.g. INFERNO ×3 cap, SHATTER VOLLEY chain mult) | per-element ULT |
| 4 | `_warbandStrikeContext` | Rock Band warband strike active | Rock race-passive (B1) |
| 5 | `_hunterMarkContext` | Hunter Mark applies to current fire | Hunter universal mark |
| 6 | `_grommarRallyContext` | Grommar Rally active (warrior/hunter) | Pirate-specific |
| 7 | `_packMarkContext` | Pack Mark applies to current fire | race-specific (Sharks) |
| 8 | `_helioRoarContext` | Helio Roar window active | Phase 5 reserved (Sparks) |
| 9 | `_captainDualContext` | Hero matches captain race (race buff scaling) | Captain §6 system |
| 10 | `_signatureComboContext` | Tier 3 signature combo active (×1.30) | **Phase 3** Signature Combos |

### Damage flow (per ULT fire)

```
Hero fires ULT (e.g., BLACKTOOTH INFERNO)
  ↓
baseDmg = base ULT damage
  ↓
multStack = product of 10 contexts (each defaults to 1.0)
  ↓
clampedMult = min(FIRE_MULT_CAP, multStack)   // FIRE_MULT_CAP = 3.0
  ↓
rawDmg = floor(baseDmg × clampedMult)
  ↓
Boss-side processing:
  - Berserker amplifier (if boss < 50% HP, ×2.0 boss attack — not dmg done to boss)
  - Boss armor (Armored archetype absorb 70%)
  - Apply to bossHP
  ↓
Mark consumption flags set:
  if _hunterMarkContext > 1: _hunterMarkConsumed = true
  if _packMarkContext > 1:    _packMarkConsumed = true
  if _grommarRallyContext > 1: _grommarRallyConsumed = true
```

### Element-specific caps

| Element | Cap | Threshold |
|---|---|---|
| Fire/Ember | INFERNO ×3 | 6+ charged cells |
| Frost/Tide | SHATTER ×4 | chain length ≥ 4 |
| Earth/Grove | REVENGE BURST line | absorbed dmg ≥ 1000 *(Phase 5)* |
| Dark/Umbra | ENCORE-OF-ENCORE 50% repeat | encore stacks ≥ 4 |
| Light/Solar | SHIELDS-TO-DAMAGE | shields ≥ 8 *(Phase 5)* |

### Global caps

- **FIRE_MULT_CAP** = 3.0 (multStack clamp — applies to ALL elements despite name)
- Combo multiplier soft cap: ×6 (hard cap at ×12 with full screen flash)
- Race buff cap: +30% (3+ of race + captain of same race = 1.30)
- Crit damage: ×1.5 fixed
- Signature Combo Tier 3: ×1.30 fixed (joins multStack, subject to FIRE_MULT_CAP clamp)

### Worked example: race-pure Pirates squad with full stack

```
Squad: THORGAR + EMBERHAND + BLACKTOOTH + IRONBELLY + CRIMSON (all pirates/ember)
Active: THE GOLDEN HOARD signature combo (×1.30)
        CRIMSON captain dual (3+ pirate → +30% race buff)
        EMBERHAND BLOOM amplifier window active (+50%)
        Pirate 3+-of-race passive: 15% chance double combo

BLACKTOOTH fires INFERNO with 6+ charged cells and BLOOM active:
  baseDmg                = 200
  currentDmgMult         = 1.50  (combo from cells)
  _ultDmgContext         = 3.0   (INFERNO ×3 cap, 6+ cells)
  _passiveDmgContext     = 1.0   (no proc this fire)
  _captainDualContext    = 1.30  (3+ pirate race buff)
  _signatureComboContext = 1.30  (THE GOLDEN HOARD)
  raw multStack          = 1.50 × 3.0 × 1.0 × 1.30 × 1.30 = 7.605
  clampedMult            = 3.0   (FIRE_MULT_CAP clamp)
  rawDmg                 = 200 × 3.0 = 600
```

> Note: stack often hits cap with race-pure + signature combo. Cap exists by design — prevents one-shot kills when all multipliers align.

### Defensive pipeline (boss attacks player)

```
Boss attacks → calculate baseDamage from boss profile (HP × dmgFactor)

Step 1: Berserker amplifier (if Berserker boss at <50% HP)
  baseDamage ×= 2.0

Step 2: Earth-cell absorption (Phase 5 — earth-cells exist)
  Each earth-cell absorbs damage instead of HP
  Absorbed damage stored in earth-cell for later REVENGE BURST

Step 3: Tank PROTECT (AEGIS auto-block first attack/turn — Phase 5)
  If first attack this turn AND AEGIS in squad: damage = 0

Step 4: FTUE safety rail (only during pyredrake_fight beat)
  If hp would drop to 0 AND !ftueSafetyRailUsed: hp = 1; flag set

Step 5: Shields
  Reduce by shieldCount, decrement shieldCount

Step 6: Hero HP
  Apply remaining damage to player HP

Step 7: Defeat check
  If hp ≤ 0: trigger Death Flashback (§17) → game over
```

### Defensive pipeline (boss attacks)

```
Boss attacks → calculate baseDamage from boss profile (HP × dmgFactor)

Step 1: Berserker amplifier (if Berserker boss at <50% HP)
  baseDamage ×= 2.0

Step 2: Earth-cell absorption (if earth-cells exist)
  Each earth-cell absorbs damage instead of HP
  Absorbed damage stored in earth-cell for later REVENGE BURST

Step 3: Tank PROTECT (AEGIS auto-block first attack/turn)
  If first attack this turn AND AEGIS in squad: damage = 0

Step 4: Shields
  Reduce by shieldCount, decrement shieldCount

Step 5: Hero HP
  Apply remaining damage to player HP
```

---

## 16. QUICK REFERENCE

### Element lookup
```
Fire   = Ember  = burst, INFERNO ×3 cap, charged cells
Frost  = Tide   = chain control, SHATTER VOLLEY 4-row, frost cells
Earth  = Grove  = absorb→revenge, REVENGE BURST line, earth-cells
Dark   = Umbra  = escalation, ENCORE-OF-ENCORE 50% repeat, encore stacks
Light  = Solar  = sustain→conversion, SHIELDS-TO-DAMAGE, light cells + shields
```

### Role lookup
```
Warrior = CREATOR     = direct hit + spawn charged
Mage    = AMPLIFIER   = +X% mult window 3 placements (NO state creation)
Hunter  = DETONATOR   = mass burst all charged + amp mult
Tank    = PROTECTOR   = +shield + element-specific defense
Captain = ENABLER     = race buff + element drop + squad ULT window
```

### Race lookup
```
Pirates    = Fire  = +10% gold / 15% double combo
Rock Band  = Dark  = +5% cascade / ENCORE ULT-double
Sharks     = Frost = swim icebound / BLOODHUNT +30% boss<30%
Crocodiles = Earth = Death Roll revival / Iron Hide +1 shield/turn  [Phase 5]
Sparks     = Light = Charge Regen +10% / Static Field every 5 placements [Phase 5]
```

### v1 hero roster (15 heroes)
```
PIRATES (Fire):       THORGAR, EMBERHAND, BLACKTOOTH, IRONBELLY, CRIMSON
ROCK BAND (Dark):     RIFFBLADE, KEYCRYPT, SHRIEK, THUNDERBEAT, NIGHTLORD
SHARKS (Frost):       RIMEFANG, CRYOMIND, BRINESHOT, BULWARK, ABYSSKING
```

### Phase 5 hero roster (10 heroes — backlog names)
```
CROCODILES (Earth):  MOSSJAW, MOSSWEAVER, THORNBACK, IRONSCALE, ANCIENTSCALE
SPARKS (Light):      EMBERSPARK, LUMENWIND, RADIANCE, AEGIS, SOLARLORD
```

### Captain dual buff cheat sheet
```
SAME-RACE COUNT      | RACE BUFF | DROP BUFF
1 (only captain)     | +5%       | +25% (fixed)
2                    | +15%      | +25% (fixed)
3+                   | +30%      | +25% (fixed)
```

### Boss roster (Chapter 1)
```
1. PYREDRAKE         (Fire,  Berserker)  — HP 1800   atk 11
2. ABYSSAL TYRANT    (Frost, Armored)    — HP 3800   atk 9
3. GROVEWARDEN       (Earth, Bruiser)    — HP 6500   atk 7
4. SOLAR PHOENIX     (Light, Phoenix)    — HP 7500   atk 6   revives 1
5. CRYPT LICH        (Dark,  Assassin)   — HP 11000  atk 5
```
> FTUE Pyredrake override: HP 800, atk 15.

### SQUAD progression
```
Game start: SQUAD_MAX 3, 3 prologue heroes unlocked (mixed-race FTUE squad)
After FTUE Pyredrake → captain pick (BACKLOG-002 branching):
  Pick CRIMSON   → 5 Pirates unlocked
  Pick NIGHTLORD → 5 Rock Band unlocked
After Boss 2: 10 heroes (+ other faction unlocks) + SQUAD_MAX 4
After Boss 3: 12 heroes (+ 2 Sharks)
After Boss 4: 15 heroes (+ full Sharks) + SQUAD_MAX 5
After Boss 5: Chapter 1 complete

Phase 5 (planned):
After Phase 5 ship: 25 heroes (+ 5 Crocodiles + 5 Sparks); SQUAD_MAX may → 6
```

---

## 17. PHASE 3 MECHANICS

The Moment Mechanics — three cinematic systems that wrap combat with build-up / crisis / aftermath story beats. Tag `v0.3.0-phase-3-done`.

### 17.1 Signature Combos (Block 1, commit `281a5c1`)

Three-tier squad-detection + cinematic + damage multiplier.

| Tier | Trigger | Cinematic | Multiplier |
|---|---|---|---|
| 1 — Same-Race | 3+ heroes of same race in squad | small race-flavor banner | ×1.10 |
| 2 — Same-Element | 3+ same element from mixed races | element burst banner | ×1.20 |
| 3 — **Full Combo** | 3+ same race AND same element | **named cinematic** | **×1.30** |

**v1 named Tier 3 combos** (frozen mapping in `SIGNATURE_COMBOS`):

| Race × Element | Name | Color | Status |
|---|---|---|---|
| Pirates × Ember | **THE GOLDEN HOARD** | gold `#FFB84A` | ✅ shipped |
| Rock Band × Umbra | **THE DARK ENCORE** | purple `#9B59D6` | ✅ shipped |
| Sharks × Tide | **THE FROST DEEP** | blue `#3B8BD4` | ✅ shipped |
| Crocodiles × Grove | **THE EMERALD WARDEN** *(reserved)* | green | 🔴 Phase 5 |
| Sparks × Solar | **THE PRISMATIC RIDE** *(reserved)* | gold | 🔴 Phase 5 |

**v1 trigger reality:** Since v1 races are mono-element (Pirates=Fire, Rock=Dark, Sharks=Frost), 3+ of any race AUTOMATICALLY satisfies 3+ of that element → **only Tier 3 typically fires**. Tier 1/2 are forward-compat for Phase 5+ when mixed-race possibilities open up.

**Cinematic** (`#sigComboCinema`): full-screen overlay 600ms after battle init, scale-bounce in (2.2s sequence), shows emblem + tier label + combo name + bonus. Auto-dismisses. Reduced-motion: linear fade.

**Multiplier injection:** `_signatureComboContext` joins the 10-multiplier `dealDamage` stack (§15), subject to `FIRE_MULT_CAP = 3.0` clamp.

**Synergy bar pill:** `🌟 NAME +30%` — gradient gold pill with animated glow (`sigPillGlow`), highest visual prominence. Suppresses overlapping race + element pills (Phase 3 polish).

**Skipped for:** FTUE Pyredrake (`_isFtueOnly`) + Tower battles (`_isTowerBattle`).

### 17.2 Clutch Slow-Mo (Block 2, commit `dce7a9d`)

The "2 seconds of silence" cinematic. Fires once per battle when:
- Player at exactly 1 HP
- Boss attack imminent (`attackCountdown ≤ 1`)
- `gameEnded === false`
- FTUE safety-rail not the cause (FTUE has its own moment)

**Visual stack** (`#clutchOverlay`, z-index 9999):
1. Vignette — radial gradient, edges deep black
2. Cool-blue tint — radial blue overlay (tide stihiya color)
3. Card — red border + glow + pulse, "⚠ THE LAST LINE / **CLUTCH MOMENT** / ONE LIFE LEFT · ONE SHOT"

**Animation** 2.2s 3-phase: scale-bounce-in (0–18%) → hold + pulse (18–78%) → fade (78–100%). Reduced-motion: linear 1.6s, no pulse.

**Tactile:** `vibrate([100, 60, 140])` — heartbeat-skip pattern.

**State:** `_clutchSlowMoFired` (let, false) reset in `startBossBattle`. Single-fire per battle even if player heals back to 2+ HP and drops to 1 HP again.

### 17.3 Death Flashback (Block 3, commit `a3032e3`)

Cinematic recap of the battle's key moments shown on player defeat BEFORE the defeat modal.

**Battle event log** — 6 event types captured during fight (capped at 30 entries):

| Type | Where logged | Label format | Color |
|---|---|---|---|
| `ult` | `ultRoleDispatch` after mission tracking | `HERO · ABILITY` | hero stihiya color |
| `crit` | `dealDamage` after `floatDamage` (gated `critMult ≥ 2.0` OR `actualDmg ≥ 600`) | `HERO · CRIT ×N.N` or `· BIG HIT` | gold |
| `signature` | `showSignatureComboCinematic` end | combo name | combo color |
| `clutch` | `showClutchMoment` end | `CLUTCH MOMENT` | red |
| `enrage` | `maybeEnrageBerserker` after enrage commits | `BOSS ENRAGED` | red |
| `phoenix` | `maybePhoenixRevive` after revive commits | `PHOENIX REVIVES` | orange |

**Cinematic overlay** (`#deathFlashback`): full-screen, dark radial backdrop with red center tint, centered card with `FLASHBACK / YOUR LAST FIGHT`, top **5 events** from log (deduped by type, most recent kept), in chronological order. Each event card 1px border in event color + drop-shadow halo. Stagger-in: 0.30s apart.

**Hook into defeat flow:** `showDefeatModal` body extracted into `_showDefeatModalBody()`. Outer wrapper:
1. Set `gameEnded = true`
2. Award post-battle XP
3. Show flashback (with `_showDefeatModalBody` as `onDismiss`) — non-FTUE / non-Tower only
4. Player taps `CONTINUE` → flashback hides → defeat modal shows

**Empty-log fallback:** "A valiant effort. The grid was unforgiving." placeholder so modal never blank.

**Tactile:** `vibrate([200, 100, 200])` — somber long-pulse (distinct from clutch's heartbeat).

---

## 18. PHASE 4 MECHANICS

Onboarding Rebuild — splash polish + branching captain pick + interactive FTUE chronograph + FSM rework. Tag `v0.4.0-phase-4-done` + hotfixes `v0.4.1` / `v0.4.2`.

### 18.1 Splash polish (BACKLOG-001, polish pass)

3 splash cards on first launch (`vMaybeShowSplash`, key `vFirstRun`):
- Slide 0: Deck icon (⚔) + "SUMMON LEGENDS"
- Slide 1: Puzzle icon (🧩) + "CLEAR LINES"
- Slide 2: Flame icon (🔥) + 5 element emblems (Ember/Tide/Grove/Solar/Umbra)

Logo fades after 1500ms, slides reveal with dot navigation. Final "BEGIN" → `vSplashDone` → `routeByFtue`. Narrow CONTINUE buttons (AAA+ polish).

### 18.2 Branching captain pick (BACKLOG-002, commit `db410bf`)

After FTUE Pyredrake win → `showLeaderChoiceModal` shows two cards:
- **CRIMSON** (Pirates / Fire) — "Fire charts the course."
- **NIGHTLORD** (Rock Band / Dark) — "Conduct the dark."

`onLeaderChosen(chosenId)`:
1. **Unlock all 5 faction heroes** via `factionHeroesAllUnlocks` (warrior + mage + hunter + tank + captain)
2. **Force squad to 4** via `factionHeroes` (warrior + mage + hunter + captain)
3. `rebuildHeroDeck()` + `saveProgress()` (persist squad)
4. Reveal both captains, play faction intro dialog, advance FTUE to `grunt_fight`

**Tank backfill migration** (`runMigration_BACKLOG002_tank_backfill`): pre-fix saves had captain unlocked but tank NOT (BACKLOG-002 originally only unlocked 4 heroes). Migration runs once at parse time, idempotent flag.

### 18.3 FTUE Chronograph (Block 1 + Hotfix #1 + Hotfix #2)

Interactive 7-min curriculum with 6 contextual coachmarks split into two phases bracketing the captain pick.

**PHASE A · BASICS** (during Pyredrake fight, 4 beats):

| # | Beat | Trigger | Highlight | Body (EN) |
|---|---|---|---|---|
| 1/4 | MATCH | startBossBattle, 850ms after init | `#tray` | "Drag pieces onto the grid. Match 3+ tiles of the same color to deal damage." |
| 2/4 | CHARGE | first cells-cleared cascade | first hero card | "Every match charges your heroes. Gold ring on each portrait = ULT progress." |
| 3/4 | ULT | first hero crosses charge≥cost | that hero card | "Hero is charged! Tap the portrait to fire the ULT." |
| 4/4 | INCOMING ATTACK | first `attackCountdown ≤ 2` | telegraph badge | "Boss is winding up. Number = turns until his attack. Defend or strike first." |

**PHASE B · ADVANCED** (during Grunt fight, 2 beats — full faction squad with captain):

| # | Beat | Trigger | Highlight | Body (EN) |
|---|---|---|---|---|
| 1/2 | RACE BUFF | first synergy pill rendered | `#synergyBar` | "3+ same-race heroes give a passive damage boost. See the badge above." |
| 2/2 | CAPTAIN DROP | first captain ULT drops cells | `#grid` | "Captain dropped charged tiles. Match them to trigger huge chain explosions." |

**Coachmark overlay** (`#chronoOverlay`, z-index 9100): radial spotlight cutout on highlighted element + pulsing gold rect + tip card with tier label (BASICS/ADVANCED) + step counter (N/M) + CONTINUE.

**Gates:**
- Per-beat phase: `ftueIs(CHRONO_PHASE_FTUE[beat.phase])` — A only fires during `pyredrake_fight`, B only during `grunt_fight`
- Single-shot per FTUE attempt (`_chronoBeatsSeen[beatId]` flag)
- One overlay at a time (`_chronoActive` lock)
- Force-dismissed in `advanceFtue` on FSM transition (HOTFIX #1: prevents overlay bleed if cells-cleared setTimeout queues a beat just before victory)

**Reset** in `startBossBattle` when entering `pyredrake_fight` OR `grunt_fight` — retries get full curriculum re-shown.

**Reduced-motion:** pulse animation disabled, card entry linear 0.3s.

**Tactile:** `vibrate(40)` on each beat.

**Localization:** all 6 bodies in EN, AAA+ copy rules (verb-first imperative, jargon-light, concrete numbers, visual anchors, length 50–85 chars). HOTFIX #2 — `BOSS TELEGRAPH` renamed to `INCOMING ATTACK` for clarity.

### 18.4 DEBT-014 FSM rework (Block 2, commit `64c38e6`)

Three additive changes to FTUE state machine:

1. **`FTUE_TRANSITIONS` table** — explicit prev→next adjacency map:
   ```
   not_started     → intro
   intro           → pyredrake_fight
   pyredrake_fight → pyredrake_won | grunt_fight
   pyredrake_won   → hero_reveals | leader_choice
   leader_choice   → grunt_fight
   grunt_fight     → grunt_won
   grunt_won       → complete
   complete        → (terminal)
   ```
   `FTUE_TRANSITIONS_FORCE = ['complete', 'not_started']` allows `skipFtue()` / `resetFtue()` bypass.

2. **`ftueIs(beat)` helper** — single-source predicate replacing ad-hoc `ftueBeat === 'X'`. Accepts string OR array (any-match). Defensively warns + returns false for unknown beats.

3. **`__ftueDebug()` console diagnostic** — single-call snapshot:
   ```js
   {
     beat: 'pyredrake_fight',
     allowedNext: ['pyredrake_won', 'grunt_fight'],
     forceAlways: ['complete', 'not_started'],
     safetyRailUsed: false,
     chronoBeatsSeen: { match: true, charge: true },
     chronoActive: false,
     battleTutorialShown: false,
     storage: { ftue: 'pyredrake_fight', ... }
   }
   ```

**Soft-fail validation** — `advanceFtue` warns on non-canonical transitions but still applies (back-compat). Future block can flip to hard-reject after auditing every callsite.

**Migrated call sites** (raw `ftueBeat ===` → `ftueIs()`): `getEffectiveBossStats`, `routeByFtue`, `maybeShowBattleTutorial`, `startBossBattle` (chronograph reset + MATCH beat), `maybeChronoBeat`. ~12 remaining raw checks left untouched (battle hot path) — surgical scope.

### 18.5 FTUE Pyredrake tuning (Block 1.1)

`getEffectiveBossStats(boss)` non-destructive override during `pyredrake_fight`:
- HP: 1800 → **800** (FTUE_PYREDRAKE_HP)
- attackInterval: 11 → **15** (FTUE_PYREDRAKE_ATTACK_INTERVAL)

Plus **safety rail** — first time HP would hit 0 during FTUE Pyredrake, restore to 1 HP, set `ftueSafetyRailUsed = true` (per-battle), flash "BLACKFANG SHIELDS YOU" gold.

---

## КОНЕЦ

**Документ:** Combat Reference v2.0 (Phase 4 done · Phase 5 prep)
**Дата:** 2026-04-26
**Phase:** **4 done** · `v0.4.2-hotfix-2` · Phase 5 starting
**Статус:** combat reference for active development. Update as new races/bosses ship.

**Companion documents:**
- BLOCKSWORN_MASTER_PLAN_V3.md — roadmap, phases, decisions, amendment log §9.1
- HERO_GRAMMAR.md — formal spec, role-verb requirements, non-negotiables
- docs/PHASE_2_PIRATES_AUDIT.md — Pirates implementation
- docs/PHASE_2_ROCK_AUDIT.md — Rock Band implementation
- docs/PHASE_2_SHARKS_AUDIT.md — Sharks implementation
- docs/PHASE_2_PROGRESSION_AUDIT.md — Squad/Boss progression
- docs/PHASE_2_SIGNOFF.md — Phase 2 closure
- docs/PHASE_3_SIGNATURE_COMBOS_AUDIT.md — §17.1
- docs/PHASE_3_CLUTCH_SLOWMO_AUDIT.md — §17.2
- docs/PHASE_3_DEATH_FLASHBACK_AUDIT.md — §17.3
- docs/PHASE_4_CHRONOGRAPH_AUDIT.md — §18.3
- docs/PHASE_4_FSM_REWORK_AUDIT.md — §18.4
- docs/PHASE_4_HOTFIX_1_AUDIT.md — chronograph 2-phase split
- docs/PHASE_4_HOTFIX_2_LOCALIZATION_AUDIT.md — EN AAA+ copy

**Используй когда нужно:**
- Быстро посмотреть что делает определённый element/role/race
- Объяснить grammar новому контрибьютору (или себе через 3 недели)
- Validate что новый hero conforms to architecture
- Reference при balance discussions
- Cross-check Phase 3+4 cinematic / FTUE behavior против spec

**Phase 5 prep checklist** (when starting Earth/Crocodiles + Light/Sparks):
- [ ] Implement `earthCells` array + `absorbBossDamage` + `consumeEarthCells` + `onGroveCellsCleared`
- [ ] Implement `lightCells` array + `consumeShieldsForBurst` + `onSolarCellsCleared`
- [ ] Build 5 Crocodile heroes (MOSSJAW/MOSSWEAVER/THORNBACK/IRONSCALE/ANCIENTSCALE)
- [ ] Build 5 Spark heroes (EMBERSPARK/LUMENWIND/RADIANCE/AEGIS/SOLARLORD)
- [ ] Wire Crocodile + Spark race-passives (Death Roll/Iron Hide, Charge Regen/Static Field)
- [ ] Add THE EMERALD WARDEN + THE PRISMATIC RIDE Tier 3 signature combos
- [ ] Update unlock progression for 25 heroes total
- [ ] Wire 10 hero portraits from `/Users/rm/Downloads/game/races/{earth croc,light spark}/`

---

*"Element × Role × Race — три оси. Они независимые. Они не пересекаются. Это и есть extensibility."*
— Architecture, frozen non-negotiable
