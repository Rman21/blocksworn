# Blocksworm — Combat Mechanics Specification

**For:** UI/UX Designer + Roman + Engineering Lead during Phase 5 polish workstream
**Purpose:** Single source of mechanical truth so visual polish has accurate foundation. Every event the player sees in combat corresponds to a system here.
**Created:** 2026-05-16
**Maintainer:** CTO
**Sacred boundaries:** marked 🔒 throughout. CLAUDE.md §2 is the authoritative project-wide list; this doc shows where each sacred value lives in code.

> **Reader's promise:** when Designer designs a healthbar pulse, they know exactly what mechanical event fires the pulse, how often, and what its sacred timings are. When Roman writes a polish task, he references the exact mechanic + file:line.

---

## Contents

1. [Combat in one paragraph](#1-combat-in-one-paragraph)
2. [Match lifecycle](#2-match-lifecycle)
3. [Grid, pieces, line clearing](#3-grid-pieces-line-clearing)
4. [Elements & dominant element per line](#4-elements--dominant-element-per-line)
5. [Combo crit (sacred formula)](#5-combo-crit-sacred-formula)
6. [Element synergy 2x / 3x / 5x](#6-element-synergy-2x--3x--5x)
7. [Race synergy (RACE_SYNERGY tiers)](#7-race-synergy-race_synergy-tiers)
8. [Damage flow: player → boss](#8-damage-flow-player--boss)
9. [Damage flow: boss → player (4-channel system)](#9-damage-flow-boss--player-4-channel-system)
10. [Mitigation matrix](#10-mitigation-matrix)
11. [HP, death, revive](#11-hp-death-revive)
12. [Stagger Loop — boss state machine](#12-stagger-loop--boss-state-machine)
13. [Pressure meter](#13-pressure-meter)
14. [Overflow distribution (overkill economy)](#14-overflow-distribution-overkill-economy)
15. [ULT system (per-role)](#15-ult-system-per-role)
16. [Boss HP formula + TTK targets](#16-boss-hp-formula--ttk-targets)
17. [Boss phases + reactivity events (22 handlers)](#17-boss-phases--reactivity-events-22-handlers)
18. [Identity Layer — race line-clear flavors (Phase 2, 6 races)](#18-identity-layer--race-line-clear-flavors)
19. [Identity Layer — boss-reactive mechanics (Phase 2, 5 bosses)](#19-identity-layer--boss-reactive-mechanics)
20. [5-beat boss death cinematic (sacred timing)](#20-5-beat-boss-death-cinematic)
21. [Sacred values quick-reference](#21-sacred-values-quick-reference)
22. [Visual hooks table — mechanic → fires-what-when](#22-visual-hooks-table)

---

## 1. Combat in one paragraph

Blocksworm combat is a turn-based PvE block puzzle. Player commands a **squad of up to 5 heroes** (different races + roles) against **1 boss**. Each player **turn**, the player places **blocks (pieces)** on a grid; clearing **lines** deals damage to the boss based on heroes' roles, races, and the elements of cleared cells. **Multi-line clears** trigger the sacred **combo crit**. Sustained pressure fills the **Pressure meter** which **Staggers** the boss into a 4-turn vulnerability window; after Stagger, the boss enters a 2-turn **Recovery** with a telegraphed revenge attack. Boss attacks on player ticks (every turn) deal damage through one of **4 channels**: DEAD_ZONE, VOID, SIGNATURE, GRID_SATURATION. Boss **HP is calibrated** so a properly-built squad clears it in a **target TTK** (4-9 minutes depending on boss tier). At **70% HP and 35% HP** the boss triggers **reactivity events** (22 handlers across the roster); at 0 HP the **sacred 5-beat death cinematic** plays.

---

## 2. Match lifecycle

| Phase | Trigger | Key functions | Visual hooks |
|---|---|---|---|
| **Battle start** | `startBattle(chap, idx, _opts)` | [src/core/battle.js:1010](src/core/battle.js:1010) | Screen transition to `#screenBattle`; Chronicler dialog (FTUE only); music swap to boss theme |
| **Boss spawn** | `startBossBattle()` | [src/core/battle.js:478](src/core/battle.js:478) | Boss portrait fade-in; HP bar fill animation; phase glow init |
| **Player turn** | `playerTurn()` | [src/core/battle.js:1486](src/core/battle.js:1486) | Turn indicator increments; Pressure meter visible; piece tray shows |
| **Piece placement** | (within turn) | Grid logic in [src/core/grid.js](src/core/grid.js) | Piece settle haptic (`V_HAPTICS.place = 15`); cell highlight; drag-ghost feedback |
| **Line clear** | (player completes row/col) | `dealDamage(amount, isCrit, critMult)` [src/core/battle.js:1022](src/core/battle.js:1022); particle burst `vPlayLineClearBurst(rows, cols)` [src/feel/animations.js:43](src/feel/animations.js:43) | `V_HAPTICS.clear = 25` haptic; particle stream directed toward `bossImg`; damage number float-up; element synergy bar update; race FX fire (per §18); Pressure meter increment |
| **Crit fires** | (multi-line) | `vPlayCritFlash()` [src/feel/animations.js:88](src/feel/animations.js:88) | 🔒 **180ms `.v-fx-crit-flash` body class** + **440ms `.v-fx-shake` grid class**; `V_HAPTICS.crit = [30,20,30]` 3-pulse haptic |
| **Boss reactivity** | HP crosses 70% or 35% | `REACTIVITY_HANDLERS` dispatcher [src/core/reactivity-events.js:227](src/core/reactivity-events.js:227) | Telegraph banner (3000ms `REACTIVITY_TELEGRAPH_MS`); banner shows boss name + reactivity name; identity-fx may fire (§19) |
| **Stagger triggered** | Pressure ≥ 100 | `_maybeTriggerStaggerIntro()` [src/core/stagger-loop.js:288](src/core/stagger-loop.js:288); state ← `BOSS_STATE_STAGGER` | Gold flash overlay (legacy CSS `§4.3 Stagger entry FX`); slow-mo transitions (`.stagger-slow-mo` class); narrator speaks |
| **Stagger expires** | 4 turns elapsed | Transition to `BOSS_STATE_RECOVERY` [src/core/stagger-loop.js:436](src/core/stagger-loop.js:436) | Telegraph; recovery banner; revenge attack countdown visible |
| **Recovery expires** | 2 turns elapsed | Boss revenge attack fires; state ← `BOSS_STATE_ACTIVE` | Boss attack VFX; signature damage channel |
| **Boss attack tick** | (each player turn end) | DAMAGE_CHANNELS dispatcher; `_endOfTurnTicks` | Channel-specific FX (`#FF4D1F` deadzone, `#9B59E8` void, signature element color); damage number on player HP |
| **Player damage** | Boss attack lands | `renderHP()` [legacy:65723] updates | HP bar decrement animation; element-themed fill (per-boss); low-HP pulse if ≤25%; haptic `V_HAPTICS.hit = 30` |
| **Boss phase 2 (HP <70%)** | `REACTIVITY_PHASE_GATES[0]` | Phase glow `.phase-2` on `bossImg`; reactivity event fires | Legacy CSS line 1810 phase glow; boss palette shifts |
| **Boss phase 3 (HP <35%)** | `REACTIVITY_PHASE_GATES[1]` | Phase glow `.phase-3`; second reactivity event | Same pattern + intensified |
| **Victory** | `checkVictory()` [src/core/battle.js:1506](src/core/battle.js:1506); boss HP ≤ 0 | `vPlayBossDieFx()` 5-beat cinematic (§20); `showVictoryModal()` [src/core/battle.js:1521](src/core/battle.js:1521) | 🔒 5-beat sequence (sacred timing); `V_HAPTICS.victory = [100,50,100,50,200]`; reward screen; identity Codex moment record |
| **Defeat** | `checkDefeat()` [src/core/battle.js:1513](src/core/battle.js:1513); all heroes HP=0 | `showDefeatModal()` [src/core/battle.js:1679](src/core/battle.js:1679); death flashback panel | `V_HAPTICS.defeat = [200]`; defeat music; retry-with-gem modal (Tower) |
| **Exit** | `exitBattle()` [src/core/battle.js:1749](src/core/battle.js:1749) | Screen transition back; menu music |

---

## 3. Grid, pieces, line clearing

### 3.1 Board dimensions

| Value | Where |
|---|---|
| BOARD_COLS / BOARD_ROWS | Defaults from grid.js (see [src/feel/identity-fx.js:212](src/feel/identity-fx.js:212) parameter usage) |
| Auto-scaled cell size | CSS `--cell-size` token computed via `width: min(100%, calc(100dvh - 480px))` + `1fr` columns + `aspect-ratio: 1/1` (proven layout) |

### 3.2 Pieces

Standard block puzzle pieces (Tetris-family shapes). Each cell has an **element** (ember, tide, grove, solar, umbra). Player drags pieces from a 3-piece tray onto the grid. Pieces cannot rotate (block placement game, not Tetris).

### 3.3 Line clearing

When player completes a full row OR column, those cells clear. A **line clear** triggers:
1. `vPlayLineClearBurst(rows, cols)` particle burst directed toward `bossImg` 🔒 sacred direction
2. Damage calculation (§8)
3. Element synergy update (§6)
4. Race FX (§18) — per-race identity flavor fires
5. Pressure meter increment per `PRESSURE_GAIN` table (§13)
6. Damage number float-up

**Multi-line clear** (2+ lines in one placement) = **combo crit eligible** (§5).

---

## 4. Elements & dominant element per line

### 4.1 The 5 sacred elements

[src/data/elements.js:14](src/data/elements.js:14):

```javascript
STIHIYAS = ['ember', 'tide', 'grove', 'solar', 'umbra']
```

| Element | Color (`--a-*` token) | Hex | Theme |
|---|---|---|---|
| ember | `--a-ember` | `#ff5a3a` (token) / `#FF4D1F` (STIHIYA_COLORS legacy) | Fire / heat / aggression |
| tide | `--a-tide` | `#4adbff` / `#1FA3FF` | Water / flow / counter |
| grove | `--a-grove` | `#7aec4a` / `#3DD66E` | Earth / nature / sustain |
| solar | `--a-solar` | `#ffe14a` / `#FFD53D` | Light / radiance / detonate |
| umbra | `--a-umbra` | `#c06adf` / `#8C3BFF` | Shadow / void / ULT-amplifying |

**Note:** Two color tables exist — `tokens.css` `--a-*` (modular path) and `STIHIYA_COLORS` (legacy). Designer should reconcile or keep separate per use-case (likely keep `--a-*` for everything new).

### 4.2 Dominant element per line

When a line clears, the system counts cell elements in that line and picks the **dominant** (most-frequent) element. If tied, the first-in-array of STIHIYAS wins. This dominant element is used by:
- Element synergy bonus computation (§6)
- Race FX gates (e.g., Spark Sun Cascade requires solar-dominant lines — §18.5)
- Boss reactivity (e.g., grove-dominant lines feed Grovewarden Root Surge — §19.5)

---

## 5. Combo crit (sacred formula)

🔒 **CLAUDE.md §2.1 — DO NOT MODIFY**

**Formula:**

```
total_dmg × (1 + dominantCount × combo × 10%)
```

Where:
- `total_dmg` = pre-crit damage from line clears
- `dominantCount` = number of lines where dominant element matches squad element preference
- `combo` = number of lines cleared in this placement (≥2 for crit eligibility)

**Source:**
- Legacy HTML line 64005 (verified byte-perfect in REPORT-32 Phase 2 sacred audit)
- Comment in [src/core/battle.js:37](src/core/battle.js:37)
- In-game info copy (legacy line 60399): `Clear 2+ lines at once → crit bonus: total dmg × (1 + dominantCount × combo × 10%)`

**Modifier hook:**
- Spark race writes to `_dominantCountModifier` (legacy line 56124 + 56127) which is READ by combo crit computation. **Modifier ∈ {0, +1} only** — verified exhaustively in T2.06 sacred audit. Formula itself UNTOUCHED.

**Visual hooks for crit:**
- `vPlayCritFlash()` body class flash (🔒 180ms) + grid shake (🔒 440ms)
- `V_HAPTICS.crit = [30, 20, 30]` 3-pulse haptic
- Damage number floats with crit emphasis (Designer designs scale + color)

---

## 6. Element synergy 2x / 3x / 5x

🔒 **CLAUDE.md §2.1 — DO NOT MODIFY**

When the squad has heroes whose elements align with the dominant elements being cleared, a synergy multiplier applies:

| Synergy tier | Trigger | Mechanical effect (sacred) |
|---|---|---|
| **2x** | 2 squad heroes share dominant element | `−2 ULT threshold` |
| **3x** | 3 squad heroes share dominant element | `−4 ULT threshold` + `+20% passive damage` |
| **5x** | 5 squad heroes share dominant element | `−6 ULT threshold` + `+50% damage` + `30% start charge` |

**Source:** CLAUDE.md §2.1 sacred table; verified across Phase 2 audits (T2.07-T2.12)

**Visual hooks:**
- Synergy bar at top of battle screen (`renderSynergyBar()` legacy:64850) shows current synergy tier
- Legacy CSS line 1926 `✨ player synergy — green` — current visual representation
- Designer: per-tier escalating visual treatment (Marvel Snap snap-moment-style) — distinct 2x / 3x / 5x feel

---

## 7. Race synergy (RACE_SYNERGY tiers)

🔒 **CLAUDE.md §2.1 — DO NOT MODIFY** (per-race per-tier bonuses)

Each race has 3 progressive tier bonuses (2x / 3x / 5x squad members of same race). Sacred values live in `RACE_SYNERGY` constant inside legacy + [src/data/identity-layer.js](src/data/identity-layer.js).

Examples (verified across Phase 2 audits):
- **Pirate** — Pirate's Plunder gold drops on line clear (§18.1)
- **Shark (internal: `shark`)** — Feeding Frenzy bite-modifier on combo lines (§18.2)
- **Rock (internal: `golem`)** — Encore Echo `ENCORE` flag at tier 3 (first ULT 🌑 ×2); `maxShieldBonus` 1/2/2 across tiers — sacred shield-cap source
- **Crocodile (internal: `golem` tier kit + bedrock bastion shield mechanic)** — shield fragment accumulation
- **Spark (internal: `lion`)** — `bonusDmg.solar` +3/cell at tier 5 (sacred), Sun Cascade dominant-line modifier
- **Grove (internal: `troll`)** — grove tier kit + Root Surge boss-reactive integration

**Race name layers:**
- DISPLAY name (player-facing + design docs): pirate / shark / rock / crocodile / spark / grove
- INTERNAL RACE_SYNERGY key: pirate / shark / golem / lion / troll (legacy v2.1 naming)
- Mapping: `RACE_TO_STIHIYA` constant (associates each race with its primary element)

**Visual hooks:** Race-tier visual indicators on hero cards (T1/T2/T3/Mythic ascension states per §11). 5x race-synergy state deserves ceremonial framing.

---

## 8. Damage flow: player → boss

### 8.1 Pipeline

```
Player line clear
  → base damage per cell (element-weighted)
    × race tier bonus (from RACE_SYNERGY)
    × element synergy multiplier (2x/3x/5x §6)
    × combo crit (if ≥2 lines, §5)
    + dominantCount modifier (race-fx hook, §18)
      = total damage to boss HP

  → if boss is in BOSS_STATE_STAGGER:
      effective damage × FIRE_MULT_STAGGER_RATIO (1.5x)
  → if boss is in BOSS_STATE_RECOVERY:
      effective damage × FIRE_MULT_RECOVERY_RATIO (0.7x) — same as Active
  → if boss is in BOSS_STATE_ACTIVE:
      effective damage × FIRE_MULT_ACTIVE_RATIO (0.7x)
```

### 8.2 Fire-multiplier sacred values

[src/core/stagger-loop.js:240-252](src/core/stagger-loop.js:240):

```javascript
FIRE_MULT_CAP_BASE = Object.freeze({/* tier caps */})
FIRE_MULT_CAP_TOWER = 4.0                          // Tower always max
FIRE_MULT_ACTIVE_RATIO   = 0.7                     // 70% in Active state
FIRE_MULT_STAGGER_RATIO  = 1.5                     // 150% in Stagger (effective uncap)
FIRE_MULT_RECOVERY_RATIO = 0.7                     // Same as Active during Recovery
```

🔒 All sacred — don't touch ratios.

**Implication for Designer:** the Stagger window is where the player feels "ULT-economy-spike" — visual should reinforce this (chromatic shift, screen tint, particle density spike). Recovery is "danger" — telegraph the revenge.

---

## 9. Damage flow: boss → player (4-channel system)

🔒 **v2.1 P1 sacred** — [src/core/damage-channels.js](src/core/damage-channels.js)

The boss damages the player through one of 4 named channels:

### 9.1 DEAD_ZONE

- **Effect:** direct boss-targeted damage at end-of-turn
- **Value:** `CHANNEL_DEADZONE_DMG = 5 HP` per new pocket created in the grid
- **Trigger:** unfilled "dead pockets" left after player turn
- **Channel constant:** `CH_DEAD_ZONE = 'deadzone'`
- **Color (legacy):** `#FF4D1F` orange-red
- **Icon (legacy):** ⚠ or text label
- **Haptic:** `V_HAPTICS.hit = 30` (or boss-attack variant)

### 9.2 VOID

- **Effect:** percentage-based damage per void cell per tick
- **Value:** `CHANNEL_VOID_TICK_PCT = 0.005` (0.5% MAX_HP per void cell at end-of-turn)
- **Trigger:** cells marked void by certain mechanics (e.g., Crypt Lich)
- **Channel constant:** `CH_VOID = 'void_tick'`
- **Color:** `#9B59E8` purple
- **Icon (legacy):** 🟣
- **Vibrate pattern (channel-specific):** `[40, 30, 40]`

### 9.3 SIGNATURE

- **Effect:** element-typed burst from boss attacks (boss's "signature" move)
- **Value:** `CHANNEL_SIGNATURE_DMG` is a tier-mapped Object (tutorial: 12, etc) — sacred constants
- **Trigger:** boss attack landing at end of Recovery phase
- **Channel constant:** `CH_SIGNATURE = 'signature'`
- **Color:** boss-specific (element color of signature tier)
- **Icon:** boss's signature symbol

### 9.4 GRID_SATURATION

- **Effect:** flat damage when player has cluttered the grid
- **Value:** `CHANNEL_GRID_SATURATION_DMG = 8 HP` flat at `≥75%` board occupancy
- **Threshold:** `CHANNEL_GRID_SATURATION_THRESHOLD = 0.75`
- **Trigger:** end-of-turn check
- **Channel constant:** `CH_GRID_SATURATION = 'saturation'`
- **Color:** grid-warning hue (Designer chooses; current legacy is amber/red)

### 9.5 Channel constants — exact sacred values

[src/core/damage-channels.js:157-171](src/core/damage-channels.js:157):

```javascript
CH_DEAD_ZONE       = 'deadzone'
CH_VOID            = 'void_tick'
CH_SIGNATURE       = 'signature'
CH_GRID_SATURATION = 'saturation'

CHANNEL_VOID_TICK_PCT             = 0.005    // 0.5% MAX_HP per void cell at EOT
CHANNEL_GRID_SATURATION_THRESHOLD = 0.75     // >75% board occupied
CHANNEL_GRID_SATURATION_DMG       = 8        // flat 8 HP at EOT
CHANNEL_SIGNATURE_DMG = Object.freeze({/* tier map */})
```

🔒 All sacred — don't touch values, thresholds, or channel string identifiers (legacy FX dispatcher matches on exact strings).

**Visual hooks per channel:**
- Each channel gets distinct color + icon + haptic pattern (Polish Strategy Tier S #3 — Designer plans per-channel damage number color coding)
- Channel FX appear next to player HP bar as the damage lands

---

## 10. Mitigation matrix

🔒 **Sacred** — [src/core/damage-channels.js:183-200](src/core/damage-channels.js:183)

```javascript
MITIGATION_CAP        = 0.70   // hard ceiling — never immune
MITIGATION_TABLE      = Object.freeze({/* per-channel mitigation */})
LEVEL_MITIGATION_PER  = Object.freeze({/* per-level scaling */})
```

**Logic:**
- Every damage source is mitigated by `MITIGATION_TABLE[channel]` reduced by hero stats
- Cap at 70% (player always takes some damage; immune is forbidden)
- `Math.max(rawDmg > 0 ? 1 : 0, mitigated)` — minimum-1 floor when there was any incoming damage
- Order of operations: AEGIS → MAELEN frozen ward → normal shield → mitigation → final damage

**Visual hooks:**
- Mitigation chip displayed adjacent to HP bar (`§5.5 Resource bar HP + mitigation chip` — legacy CSS line 1257)
- "MITIGATED N" floating text when significant mitigation occurs (e.g., -50% absorbed)

---

## 11. HP, death, revive

### 11.1 Player HP

🔒 **`MAX_HP = 100`** — [src/data/balance.js:1](src/data/balance.js:1)

- Each hero in squad has independent HP (current+max). Squad HP shared as resource in some modes; per-hero in others.
- Damage applies first to AEGIS shields, then MAELEN frozen ward, then base HP.
- "Squad HP" displayed by `renderHP()` — current implementation is text + heart icon; Polish Strategy Tier S #1 replaces with animated healthbar.

### 11.2 Death triggers

- Player HP ≤ 0 → hero dies (cannot act, may have death-triggered FX e.g. Phoenix revive)
- All heroes dead → `checkDefeat()` → defeat modal

### 11.3 Revive mechanics

- **Phoenix race**: Phoenix Ashen Reign boss-reactive grants revive condition (per Phase 2 §19.1)
- Generic revive system (post-revive checks) — fire 5-beat cinematic only on FINAL death after all revive resolved (legacy line 57728)

### 11.4 Boss HP

- Single bar (no per-phase reset)
- Formula in §16
- Phase glow shifts at HP gates (§17)

---

## 12. Stagger Loop — boss state machine

🔒 **CLAUDE.md §2.5 v2.1 P2 sacred** — [src/core/stagger-loop.js](src/core/stagger-loop.js)

### 12.1 Three states

```javascript
BOSS_STATE_ACTIVE   = 'active'      // baseline; player attacks at 0.7x
BOSS_STATE_STAGGER  = 'stagger'     // 4-turn vulnerability; player attacks at 1.5x
BOSS_STATE_RECOVERY = 'recovery'    // 2-turn telegraph; revenge attack at end
```

### 12.2 State durations

```javascript
STAGGER_DURATION_TURNS  = 4        // Stagger window
RECOVERY_DURATION_TURNS = 2        // Recovery telegraph + revenge
STAGGER_CHAINING_ENABLED = true    // Pressure can re-trigger Stagger mid-Recovery if reached
```

🔒 All sacred — don't touch durations.

### 12.3 State transitions

```
ACTIVE
  → (Pressure reaches PRESSURE_MAX = 100)
    → STAGGER  (gold flash overlay, slow-mo, narrator: "STAGGERED")
      ↳ Player damage × 1.5 for STAGGER_DURATION_TURNS (4)
      ↳ Phase 2 stagger hooks fire
    → (4 turns elapse)
    → RECOVERY  (banner: "RECOVERING", revenge telegraph 2-turn countdown)
      ↳ Player damage × 0.7 (same as Active)
      ↳ Boss queues revenge attack
    → (2 turns elapse)
    → boss revenge attack lands (channel-based, §9)
    → ACTIVE
```

### 12.4 Visual hooks (Polish Strategy Tier S #2 / #3)

| Event | Visual |
|---|---|
| State transition into STAGGER | Gold flash overlay (legacy `§4.3 Stagger entry FX`); slow-mo `.stagger-slow-mo` CSS class; narrator line; `vHaptic('levelup')` ([20,30,40]) |
| In STAGGER (4 turns) | Battle screen tint (Designer); damage numbers oversized; particle density spike; chromatic-shift effect |
| State transition to RECOVERY | Banner: "RECOVERY — revenge in 2 turns"; telegraph border on bossImg |
| Boss revenge attack fires | Channel-specific FX (§9.3 SIGNATURE typically); shake; damage number on player |

---

## 13. Pressure meter

🔒 **CLAUDE.md §2.5 v2.1 P2 sacred** — [src/core/stagger-loop.js:215-228](src/core/stagger-loop.js:215)

### 13.1 Gauge

```javascript
PRESSURE_MAX = 100        // sacred ceiling
```

Player builds pressure through play; at 100 → boss enters Stagger.

### 13.2 Pressure gain table (sacred)

```javascript
PRESSURE_GAIN = Object.freeze({
  line_single:      5,    // 1-line clear
  line_double:     12,    // 2-line clear (cross / double row)
  line_triple:     25,    // 3-line clear
  line_quad:       45,    // 4-line clear (mastery moment)
  inferno_proc:    20,    // EMBER inferno trigger
  detonate_proc:   20,    // SOLAR detonate trigger
  hero_ult:        15,    // Any hero ULT fired
  signature_combo: 30,    // Squad-wide signature combo (P3+ scaffold)
  cascade_per_cell: 8,    // Cascade chain — per cleared cell
})
```

🔒 All 9 values sacred. Don't change.

### 13.3 Visual hooks (Polish Strategy Tier S #2)

- Build-up animation: gauge fills in real-time as events fire
- Stagger threshold indicator: visible "100% triggers STAGGER" marker
- Reference visual: Sekiro posture bar / Sifu structure
- When `line_quad` fires (+45 pressure — the biggest single delta), the gauge surge should feel like a mastery moment (reinforced visually)

---

## 14. Overflow distribution (overkill economy)

🔒 [src/core/stagger-loop.js:255-258](src/core/stagger-loop.js:255):

When player deals damage exceeding boss HP (overkill in Stagger), the excess is distributed:

```javascript
OVERFLOW_TO_ULT     = 0.40    // 40% of overkill → distributed ULT charge
OVERFLOW_TO_ESSENCE = 0.30    // 30% → essence drops
OVERFLOW_PER_SHIELD = 500     // 1 shield per 500 overkill damage
OVERFLOW_TO_TOWER   = 0.10    // 10% → Tower points (Tower battles only)
```

**Implication:** maximizing Stagger damage isn't just for kill — it returns ULT charge + essence + shields, accelerating subsequent turns. Visual should reinforce that "overkill is rewarded" (number floats with extra emphasis).

---

## 15. ULT system (per-role)

🔒 **CLAUDE.md §2.1 sacred** — [src/data/heroes.js](src/data/heroes.js) `HERO_ULT_COST_BY_NEWROLE`

### 15.1 ULT costs per role

```javascript
HERO_ULT_COST_BY_NEWROLE = {
  warrior:  80,
  mage:    100,
  hunter:  120,
  tank:     80,
  captain: 100,
}
```

🔒 All 5 values sacred.

### 15.2 ULT charge sources

- Damage dealt (proportional)
- Element synergy 5x grants `30% start charge`
- Overflow distribution `OVERFLOW_TO_ULT = 0.40`
- `PRESSURE_GAIN.hero_ult = 15` (firing an ULT also gains pressure)
- Race-specific ULT meter writes (e.g., Rock Encore Echo writes to umbra ULT meter — §18.3)

### 15.3 Element synergy reductions

- 2x synergy: `−2 ULT threshold` (e.g., warrior 80 → 78)
- 3x synergy: `−4 ULT threshold` (warrior 80 → 76) + 20% passive damage
- 5x synergy: `−6 ULT threshold` (warrior 80 → 74) + 50% damage + 30% start charge

### 15.4 Visual hooks (Polish Strategy Tier S #5)

- ULT button per hero — distinct visual hierarchy when ready vs charging
- Reference: Marvel Snap on-snap moment for "ULT ready"; satisfying press feedback
- ULT firing → particle burst (race-fx flavor — §18) + signature attack channel (§9.3) toward boss

---

## 16. Boss HP formula + TTK targets

🔒 **CLAUDE.md §2.5 v2.1 P4 sacred** — [src/data/bosses.js:12](src/data/bosses.js:12)

### 16.1 Formula

```
boss_hp = expected_squad_dps × target_ttk_seconds
```

### 16.2 TTK targets per boss tier

[src/data/bosses.js:31-37](src/data/bosses.js:31):

```javascript
BOSS_TTK_TARGETS = Object.freeze({
  tutorial:       240,    // Boss 1 — 4 minutes
  gatekeeper:     360,    // Bosses 2,3,6,7,11,12,16,17,21,22 — 6 minutes
  mid_act:        420,    // Bosses 4,8,9,13,14,18,19,23,24 — 7 minutes
  act_boss:       480,    // Bosses 5,10,15,20 — 8 minutes
  chapter_finale: 540,    // Boss 25 (Ch5 only) — 9 minutes
})
```

### 16.3 Expected squad DPS per chapter

[src/data/bosses.js:42-48](src/data/bosses.js:42):

```javascript
EXPECTED_DPS_BY_CHAPTER = Object.freeze({
  1: 30,      // starter T0-T1 squad, infrequent stagger
  2: 75,      // T1-T2 squad, more frequent stagger
  3: 165,     // T2 squad, regular stagger
  4: 320,     // T2-T3 squad, mastery stagger
  5: 460,     // T3+ squad with Mythic, high frequency stagger
})

TOWER_DPS_REFERENCE = 280    // Tower DPS calibration (separate from chapter)
```

**Implication:** Ch1 tutorial boss has HP = 30 × 240 = **7,200**. Chapter-finale Ch5 boss = 460 × 540 = **248,400**. The bar visual must accommodate this 35× range — Designer plans bar that scales but preserves "this is the boss HP" semantic.

---

## 17. Boss phases + reactivity events (22 handlers)

🔒 **CLAUDE.md §2.5 v2.1 P4 sacred** — [src/core/reactivity-events.js](src/core/reactivity-events.js)

### 17.1 Phase gates

```javascript
REACTIVITY_PHASE_GATES = Object.freeze([70, 35])
```

At **70% HP** and **35% HP**, the boss triggers a reactivity event. Two events per boss (p1→p2 and p2→p3).

### 17.2 Telegraph timings

```javascript
REACTIVITY_TELEGRAPH_MS  = 3000    // 3-second telegraph banner before event lands
REACTIVITY_BANNER_DURATION_MS = (durations defined adjacent)
```

🔒 Sacred — Phase 2 Identity Layer (Phoenix Ashen Reign) RE-USES the exact 3000ms value to maintain feel coherence:
> `ASHEN_REIGN_TELEGRAPH_MS === REACTIVITY_TELEGRAPH_MS === 3000`

### 17.3 The 22 handlers

[src/core/reactivity-events.js:263-290](src/core/reactivity-events.js:263) — `BOSS_PHASES` registry maps each named boss to its 2-stage reactivity:

**Story bosses (Ch1-Ch5):**

| Boss | p1→p2 (70% HP) | p2→p3 (35% HP) |
|---|---|---|
| PYREDRAKE (Ch1 tutorial) | berserker_p1_p2 | berserker_p2_p3 |
| ABYSSAL TYRANT | armored_p1_p2 | armored_p2_p3 |
| GROVEWARDEN | bruiser_p1_p2 | bruiser_p2_p3 |
| SOLAR PHOENIX | phoenix_p1_p2 | phoenix_p2_p3 |
| CRYPT LICH | assassin_p1_p2 | assassin_p2_p3 |
| VEROTHIRA | hypnotist_p1_p2 | hypnotist_p2_p3 |
| GEARHEART | engineer_p1_p2 | engineer_p2_p3 |
| URSARO | frenzy_p1_p2 | frenzy_p2_p3 |
| TIDESPIRE | tempo_disruptor_p1_p2 | tempo_disruptor_p2_p3 |
| HELIOTRON | battery_p1_p2 | battery_p2_p3 |
| TWILIGHT VESSEL | phoenix_p1_p2 | phoenix_p2_p3 |
| STORMSHEPHERD | engineer_p1_p2 | engineer_p2_p3 |
| VOIDPRIESTESS | hypnotist_p1_p2 | hypnotist_p2_p3 |
| ROOT-OF-NOTHING | bruiser_p1_p2 | bruiser_p2_p3 |
| ARCHIVAL ETERNAL | assassin_p1_p2 | assassin_p2_p3 |
| THE PROSECUTOR | phoenix_p1_p2 | phoenix_p2_p3 |
| JUSTICE BLIND | tempo_disruptor_p1_p2 | tempo_disruptor_p2_p3 |
| SUN-CROWN REGENT | bruiser_p1_p2 | bruiser_p2_p3 |
| ECLIPSE-WALKER | hypnotist_p1_p2 | hypnotist_p2_p3 |
| THE FALLEN HIGHEST | engineer_p1_p2 | engineer_p2_p3 |
| CROWN-OF-DUST | armored_p1_p2 | armored_p2_p3 |
| SHARDLORD | tempo_disruptor_p1_p2 | tempo_disruptor_p2_p3 |

22 handlers across 11 archetypes (each archetype = 2-stage). 🔒 All handler keys, timings, and reactivity-event behaviors are byte-perfect sacred.

### 17.4 Visual hooks

- Telegraph banner appears 3000ms BEFORE the event fires (player sees "INCOMING: BERSERKER RAGE" or similar)
- Banner color matches boss archetype tone
- Phase glow on `bossImg` shifts (`.phase-2` class at 70%, `.phase-3` at 35% — legacy CSS line 1810)
- Some reactivity events have bespoke FX (e.g., Phoenix Ashen Reign — §19.1)

---

## 18. Identity Layer — race line-clear flavors

🔒 **Phase 2 sacred** — [src/feel/identity-fx.js](src/feel/identity-fx.js) + [src/data/identity-layer.js](src/data/identity-layer.js)

Each race has a per-line-clear identity FX that fires when ≥N members of that race are alive in squad. **All mechanics are sacred; visuals can be polished.**

### 18.1 Pirate — Pirate's Plunder

| Field | Value | Sacred? |
|---|---|---|
| Mechanic | +5 gold per cleared cell (when pirates alive) | 🔒 mechanic |
| Constants | `PIRATE_PLUNDER_GOLD_PER_CELL = 5`, `PIRATE_PLUNDER_MAX_PIRATES = 5`, `PIRATE_PLUNDER_MAX_COINS = 32` (DOM pool ceiling), `PIRATE_PLUNDER_COIN_DECAY_MS = 1000` | 🔒 |
| Handler | `fxPirateLineClear(rows, cols, squad)` [src/feel/identity-fx.js:284](src/feel/identity-fx.js:284) | n/a |
| Visual | coin particles fly from cleared cells to gold counter; 32-coin DOM pool prevents overdraw | Designer redesignable |

### 18.2 Shark — Feeding Frenzy

| Field | Value |
|---|---|
| Mechanic | When 2+ sharks alive on tide-dominant combo line, bite 1-4 adjacent cells | 🔒 |
| Constants | `SHARK_FRENZY_MIN_SHARKS_FOR_2X_TRIGGER = 2`, `SHARK_FRENZY_MAX_EXTRA_CELLS = 4` (HARD CAP), `SHARK_FRENZY_BITE_DECAY_MS = 500`, `SHARK_FRENZY_DOMINANT_ELEMENT = 'tide'` | 🔒 |
| Handler | `fxSharkLineClear(rows, cols, squad, ctx)` [src/feel/identity-fx.js:665](src/feel/identity-fx.js:665) | n/a |
| Modifier hook | `_lastBittenCells` side-channel for combo-crit input (formula UNTOUCHED) | 🔒 |
| Visual | cyan bite VFX on bitten cells (`#1FA3FF`); chompy haptic + audio cue | Designer redesignable |

### 18.3 Rock — Encore Echo

| Field | Value |
|---|---|
| Mechanic | On umbra-dominant lines, accumulate echo charge; on threshold, replay last line's damage as ghost flash; writes to umbra ULT meter | 🔒 |
| Constants | `ROCK_ECHO_CHARGE_PER_LINE = 1`, `ROCK_ECHO_MAX_CHARGE_PER_FIRE = 4` (HARD CAP), `ROCK_ECHO_GHOST_DECAY_MS = 700`, `ROCK_ECHO_DELAY_MS = 200`, `ROCK_ECHO_DOMINANT_ELEMENT = 'umbra'`, `ROCK_ECHO_ULT_METER = 'umbra'` | 🔒 |
| Handler | `fxRockLineClear(rows, cols, squad, ctx)` [src/feel/identity-fx.js:935](src/feel/identity-fx.js:935) | n/a |
| Visual | purple ghost-flash overlay on cells; ULT meter writes — sacred bonus from RACE_SYNERGY rock tier 3 (`ENCORE` first ULT ×2) | Designer redesignable |

### 18.4 Crocodile — Bedrock Bastion

| Field | Value |
|---|---|
| Mechanic | Accumulate grove-cell fragments; convert to shields on leftmost crocodile at threshold | 🔒 |
| Constants | `CROCODILE_BASTION_FRAGMENTS_PER_SHIELD = 5`, `CROCODILE_BASTION_MAX_FRAGMENT_PARTICLES = 16` (HARD CAP), `CROCODILE_BASTION_FRAGMENT_DECAY_MS = 600`, `CROCODILE_BASTION_GROVE_ELEMENT = 'grove'`, `CROCODILE_BASTION_TARGET_HERO_INDEX = 0` | 🔒 |
| Cross-fire | `_crocFragmentBank` persists across line clears; `resetCrocFragmentBank()` API | 🔒 |
| Shield cap | Reads `RACE_SYNERGY.golem.<tier>.maxShieldBonus` (1/2/2) — sacred | 🔒 |
| Handler | `fxCrocodileLineClear(rows, cols, squad, ctx)` [src/feel/identity-fx.js:1413](src/feel/identity-fx.js:1413) | n/a |
| Visual | mossy fragment particles converge on hero portrait; shield-bloom VFX on convert | Designer redesignable |

### 18.5 Spark — Sun Cascade

| Field | Value |
|---|---|
| Mechanic | On solar-dominant lines (≥2 solar cells), grant +1 to `dominantCount` modifier read by combo-crit formula | 🔒 |
| Constants | `SPARK_CASCADE_MIN_SOLAR_CELLS = 2` (HARD gate, Roman ESC-02 O3), `SPARK_CASCADE_MAX_DOMINANT_BOOST = 1` (HARD CAP — NOT stacking), `SPARK_CASCADE_MAX_RAY_PARTICLES = 16`, `SPARK_CASCADE_RAY_DECAY_MS = 400`, `SPARK_CASCADE_DOMINANT_ELEMENT = 'solar'` | 🔒 |
| Single-flip fallback | `SPARK_CASCADE_ENABLED = true` (fallback to pure-FX architected for T2.B matchup-matrix) | 🔒 |
| Handler | `fxSparkLineClear(rows, cols, squad, ctx)` [src/feel/identity-fx.js:1882](src/feel/identity-fx.js:1882) | n/a |
| Modifier hook | Writes `_dominantCountModifier` ∈ {0, +1} — verified exhaustive sweep | 🔒 |
| Visual | solar ray particles burst from solar cells; combo-crit gets a "solar glow" treatment on top | Designer redesignable |
| Sacred boundary | Combo crit formula at legacy line 64005 BYTE-PERFECT — Spark modifies INPUT, not formula | 🔒 |

### 18.6 Grove — Root Surge (sliding-window primitive)

| Field | Value |
|---|---|
| Mechanic | Sliding window of last 3 line clears; if all grove-dominant AND no non-grove gate violated, fire Root Surge: +10 gold per rooted-cell clear (NEW non-pirate gold path, via addGold; no double-count) | 🔒 |
| Element | `ROOT_SURGE_GROVE_ELEMENT = 'grove'` | 🔒 |
| Overlay color | `ROOT_SURGE_OVERLAY_COLOR = '#2D8659'` (mossy green — distinct from purple Lich curse / cyan Shark bite / red Berserker pulse / copper Engineer lockdown / orange Phoenix flame) | 🔒 |
| Narrator placeholder | `ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER` isolated in identity-layer.js:858, marked "FINAL COPY: pending Roman approval" | 🔒 |
| Visual | mossy roots grow across cells; +10 gold "FROM SOIL" labeled gold drops; live cross-layer integration with addGold | Designer redesignable |

### 18.7 Cross-race synergy (Phase 3 T3.12)

[src/services/party-tower-backend.js](src/services/party-tower-backend.js) `computeCrossRaceSynergy()`:
- 3+ distinct races firing identity FX in same turn = `hasCrossRaceCombo: true` flag
- Cosmetic-only output (no damage/mult/crit fields — ADR-003 verified)
- Visual: optional "CROSS-RACE COMBO" banner — Designer's call

---

## 19. Identity Layer — boss-reactive mechanics

🔒 **Phase 2 sacred** — [src/feel/identity-fx.js](src/feel/identity-fx.js) + [src/data/identity-layer.js](src/data/identity-layer.js)

5 bosses get unique mechanics on top of their 2 reactivity events (§17). Mechanic handlers are sacred; visuals are redesignable.

### 19.1 Solar Phoenix — Ashen Reign

| Field | Value |
|---|---|
| Mechanic | 5-second window where only EMBER cells score; non-ember clears = ignored | 🔒 |
| Duration | `ASHEN_REIGN_DURATION_MS = 5000` | 🔒 |
| Telegraph | `ASHEN_REIGN_TELEGRAPH_MS = 3000` (matches sacred `REACTIVITY_TELEGRAPH_MS`) | 🔒 |
| Required element | `ASHEN_REIGN_REQUIRED_ELEMENT = 'ember'` | 🔒 |
| HUD countdown text | `ASHEN_REIGN_HUD_COUNTDOWN_TEXT = 'EMBER ONLY — 5s'` | 🔒 |
| Border (visual constant) | `ASHEN_REIGN_FLAME_BORDER_WIDTH_PX = 180` | 🔒 (sacred since perf-budget verified) |
| Performance budgets | `ASHEN_REIGN_INITIAL_BUDGET_MS = 16`, steady-state `2ms` (pure CSS @keyframes — zero JS per frame) | 🔒 |
| Handler | `fxPhoenixAshenReign(_bossState, _ctx)` + `fxPhoenixAshenReignRelease()` [src/feel/identity-fx.js:2154](src/feel/identity-fx.js:2154) | n/a |
| Visual | orange flame border pulses on board edges; ember cells highlighted; non-ember cells dimmed | Designer redesignable |

### 19.2 Crypt Lich — Cursed Tiles

| Field | Value |
|---|---|
| Mechanic | Lich curses 3 random tiles; each curse decrements turn counter; at 0 → auto-clear + damage tick (or boss heal) | 🔒 |
| Constants | `CURSED_TILES_COUNT = 3` (HARD), `CURSED_TILES_TURNS_UNTIL_AUTO_CLEAR = 3` (HARD) | 🔒 |
| Handler | `fxLichCursedTiles(_bossState, ctx)` + per-turn tick `computeCurseTickResult(curse, currentTurn)` [src/feel/identity-fx.js:2664](src/feel/identity-fx.js:2664) | n/a |
| Cross-race | Shark's `isSharkBiteBlocked` predicate already understands `gridState.cursedCells` — counter integration free | 🔒 |
| Visual | purple curse glow on tiles (`#9B59E8`); countdown number on each cursed tile; Shark can chomp curse for counter-play | Designer redesignable |

### 19.3 Berserker / Frenzy — Bloodtide Pulse

| Field | Value |
|---|---|
| Mechanic | One-shot buff: next attack damage `base × BERSERKER_ENRAGE_MULT × (1 + pulseBonus)` — layered, NOT stacking | 🔒 |
| Multiplier | `BERSERKER_ENRAGE_MULT = 2.0` BYTE-PERFECT | 🔒 |
| Stagger Loop | UNTOUCHED — Bloodtide reads `getBossState()`, `STAGGER_DURATION_TURNS=4`, `RECOVERY_DURATION_TURNS=2`, `BOSS_STATE_ACTIVE='active'` byte-perfect | 🔒 |
| Visual | red pulse on bossImg; HUD telegraph banner | Designer redesignable |

### 19.4 Engineer (Gearheart) — Lockdown Protocol

| Field | Value |
|---|---|
| Mechanic | On 4-line clear + crit, weld 4 cells into rigid block for 40 turns (anti-Tetris counter) | 🔒 |
| Constants | 40-turn duration, 4-cell shape, banner color `#B87333` (copper), CSS class `.cell--engineer-welded` — all sacred | 🔒 |
| Anti-Tetris gate | 3-line+crit / 4-line+no-crit / 5-line+crit = NO-fire; only 4-line crit triggers | 🔒 |
| Sacred handler | `engineer_p1_p2` reactivity UNTOUCHED | 🔒 |
| Visual | copper-welded block VFX; 40-turn countdown overlay | Designer redesignable |

### 19.5 Grovewarden — Root Surge (boss-side)

| Field | Value |
|---|---|
| Mechanic | Sliding window primitive (same code path as Grove race-side §18.6, different consumer) | 🔒 |
| Visual | mossy roots from boss reach toward grid; thematic ties to Grove race identity | Designer redesignable |

---

## 20. 5-beat boss death cinematic

🔒 **CLAUDE.md §2.2 sacred** — [src/feel/animations.js:104-159](src/feel/animations.js:104) `vPlayBossDieFx()` / `vCleanupBossDeathFx()`

### 20.1 The 5 beats (DURATION SACRED — content redesignable)

```
Beat 0 (t=0):       haptic + shake
                    add .v-fx-shake on battle screen
                    remove .v-fx-shake at +440ms

Beat 1 (t=0):       hit-pause
                    add .boss-death-pause on battle
                    remove at +300ms

Beat 2 (t=260ms):   white flash
                    create flash element
                    auto-remove at +220ms (so element gone at t=480ms)

Beat 3 (t=?):       (intermediate — see source for exact)

Beat 4 (t=420ms):   slow zoom
                    add zoom class; held until vCleanupBossDeathFx is called
```

### 20.2 Sacred durations

🔒 All durations BYTE-PERFECT. Cannot change.

### 20.3 Bespoke 5-beat for special bosses

- **Voidfang** has its own bespoke 5-beat defeat sequence [legacy line 58175]: V3.0 Phase 6 Block 6.3
- Other special bosses (Dominion, Cosmic Ascension finales) may have variants

### 20.4 Trigger conditions

- Fires **only on FINAL death** (after Phoenix revive checks resolved) [legacy line 57728]
- Cleanup awaits cinematic complete (300 + 220 + 1400 breathing) before unlocking next chapter [legacy line 58134]

### 20.5 Visual hooks

The 5 beats are *the* cinematic moment of a boss kill. Designer scope (per Polish Strategy Tier S #9 boss panel work):
- Beat 0 shake: amplitude curve + tilt direction
- Beat 1 hit-pause: how dark / how desaturated
- Beat 2 white flash: solid white vs themed-color tint?
- Beat 4 slow zoom: zoom target on bossImg center vs offset
- All within 🔒 sacred durations

---

## 21. Sacred values quick-reference

(Full project list in CLAUDE.md §2; this is combat-mechanics subset)

| Value | File:line |
|---|---|
| `MAX_HP = 100` | [src/data/balance.js:1](src/data/balance.js:1) |
| `V_HAPTICS` table | [src/feel/haptics.js:13](src/feel/haptics.js:13) |
| Crit flash 180ms / shake 440ms | [src/feel/animations.js:92,99](src/feel/animations.js:92) |
| 5-beat boss death timings (300/260+220/420ms) | [src/feel/animations.js:104](src/feel/animations.js:104) |
| Combo crit formula `total_dmg × (1 + dominantCount × combo × 10%)` | legacy line 64005; comment [src/core/battle.js:37](src/core/battle.js:37) |
| Element synergy 2x/3x/5x (-2/-4/-6 ULT, +20%/+50% dmg, 30% start charge) | CLAUDE.md §2.1 |
| `TIER_COSTS_V18 = {1:1, 2:2, 3:3, 4:5}` | [src/data/heroes.js](src/data/heroes.js) |
| `HERO_ULT_COST_BY_NEWROLE` (W:80/M:100/H:120/T:80/C:100) | [src/data/heroes.js](src/data/heroes.js) |
| `RACE_SYNERGY` per-race per-tier | [src/data/identity-layer.js](src/data/identity-layer.js) |
| `STIHIYAS = ['ember','tide','grove','solar','umbra']` | [src/data/elements.js:14](src/data/elements.js:14) |
| `STIHIYA_COLORS` (5 hex codes) | [src/data/elements.js:16](src/data/elements.js:16) |
| `BOSS_STATE_ACTIVE/STAGGER/RECOVERY` strings | [src/core/stagger-loop.js:210-212](src/core/stagger-loop.js:210) |
| `PRESSURE_MAX = 100`; `PRESSURE_GAIN` (9 values) | [src/core/stagger-loop.js:215-228](src/core/stagger-loop.js:215) |
| `STAGGER_DURATION_TURNS = 4`, `RECOVERY_DURATION_TURNS = 2` | [src/core/stagger-loop.js:232-233](src/core/stagger-loop.js:232) |
| `FIRE_MULT_*_RATIO` (0.7/1.5/0.7 + 4.0 Tower cap) | [src/core/stagger-loop.js:247-252](src/core/stagger-loop.js:247) |
| `OVERFLOW_TO_ULT = 0.40`, `OVERFLOW_TO_ESSENCE = 0.30`, etc | [src/core/stagger-loop.js:255-258](src/core/stagger-loop.js:255) |
| `CH_DEAD_ZONE / CH_VOID / CH_SIGNATURE / CH_GRID_SATURATION` strings | [src/core/damage-channels.js:157-160](src/core/damage-channels.js:157) |
| `CHANNEL_VOID_TICK_PCT = 0.005`; `CHANNEL_GRID_SATURATION_THRESHOLD = 0.75`; `CHANNEL_GRID_SATURATION_DMG = 8` | [src/core/damage-channels.js:165-167](src/core/damage-channels.js:165) |
| `CHANNEL_SIGNATURE_DMG` tier map | [src/core/damage-channels.js:171](src/core/damage-channels.js:171) |
| `MITIGATION_CAP = 0.70`; `MITIGATION_TABLE`; `LEVEL_MITIGATION_PER` | [src/core/damage-channels.js:183-200](src/core/damage-channels.js:183) |
| `REACTIVITY_PHASE_GATES = [70, 35]` | [src/core/reactivity-events.js:234](src/core/reactivity-events.js:234) |
| `REACTIVITY_TELEGRAPH_MS = 3000` | [src/core/reactivity-events.js:227](src/core/reactivity-events.js:227) |
| `BOSS_PHASES` 22-handler registry | [src/core/reactivity-events.js:263-290](src/core/reactivity-events.js:263) |
| `BOSS_TTK_TARGETS` (5 boss tiers) | [src/data/bosses.js:31-37](src/data/bosses.js:31) |
| `EXPECTED_DPS_BY_CHAPTER` (Ch1-Ch5) + `TOWER_DPS_REFERENCE = 280` | [src/data/bosses.js:42-50](src/data/bosses.js:42) |
| Identity Layer race constants (Pirate / Shark / Rock / Crocodile / Spark / Grove) | [src/data/identity-layer.js:167-853](src/data/identity-layer.js) |
| Identity Layer boss constants (Phoenix / Lich / Berserker / Engineer / Grovewarden) | [src/data/identity-layer.js:433-924](src/data/identity-layer.js) |
| `BERSERKER_ENRAGE_MULT = 2.0` | [src/data/identity-layer.js](src/data/identity-layer.js) |
| `BLOCKSWORN_TREASURY_ROYALTY_BPS = 250` (2.5% — Phase 4) | [src/services/nft-backend.js](src/services/nft-backend.js) |

---

## 22. Visual hooks table

> **For Designer:** "when the mechanic fires X, what visual event fires?" Use this table when planning per-event polish.

| Mechanical event | Fires when | Current visual | Sacred timing | Polish opportunity |
|---|---|---|---|---|
| Piece placement | Player drops piece on grid | Settle haptic + cell highlight | `V_HAPTICS.place = 15` | Subtle press feedback / shadow / settle bounce |
| 1-line clear (single) | Row or column completes | Particles fly to bossImg + damage number | `V_HAPTICS.clear = 25` | Designer #2 — animated damage float |
| 2-line clear (combo crit) | 2 lines in one placement | + crit flash (body 180ms) + shake (grid 440ms) | 🔒 180ms / 440ms | Designer #3 — crit emphasis, screen feel |
| 3-line clear | Mastery moment | + bigger combo crit | 🔒 timing fixed | Same crit visual; scale particle density |
| 4-line clear (Tetris) | Max value | + biggest combo crit + +45 pressure surge | 🔒 | Mastery-moment visual; rare; reinforce reward |
| Element synergy 2x → 3x → 5x | Squad alignment | Synergy bar updates (✨ green) | none | Designer #6 escalating tier visuals; 5x deserves ceremony |
| Race FX fire (Pirate gold drop) | Pirate alive + line clear | 32-coin DOM pool → fly to counter | 1000ms decay | Polish coin particle + counter pop |
| Race FX fire (Shark bite) | 2+ sharks + tide-dom combo | Cyan bite VFX on adjacent cells | 500ms decay | Polish bite arc + audio |
| Race FX fire (Rock echo ghost) | Umbra-dom line + threshold | Purple ghost flash + ULT meter write | 700ms decay + 200ms delay | Polish ghost overlay |
| Race FX fire (Crocodile shield) | 5 fragments accumulated | Particles converge on hero portrait + shield bloom | 600ms decay | Polish particle convergence path |
| Race FX fire (Spark cascade) | 2+ solar in line | Solar ray burst + +1 combo crit modifier | 400ms decay | Polish solar ray emission |
| Race FX fire (Grove root) | Sliding-window grove-dom | Mossy roots overlay (`#2D8659`) + gold from soil | (decay per spec) | Polish root growth animation |
| Boss reactivity telegraph | 3s before phase event | Banner: "INCOMING: BERSERKER RAGE" | 🔒 3000ms | Designer #9 — per-archetype banner styling |
| Boss reactivity fires (Phase 2 → 70%) | HP crosses 70% | Phase glow `.phase-2` on bossImg + handler fires | per-handler | Per-boss glow color + intensity |
| Boss reactivity fires (Phase 3 → 35%) | HP crosses 35% | Phase glow `.phase-3` + handler fires | per-handler | Per-boss intensified glow |
| Phoenix Ashen Reign | Phoenix reactivity | Orange flame border (180px) + 5s countdown HUD | 🔒 5000ms duration + 3000ms telegraph | Polish flame curve + dimmed non-ember cells |
| Lich Cursed Tiles | Lich reactivity | 3 tiles get purple curse + 3-turn countdown each | 3-turn auto-clear | Polish purple glow + countdown number |
| Berserker Bloodtide | Berserker reactivity | Red pulse on bossImg | 🔒 timing | Polish pulse rhythm |
| Engineer Lockdown (welded block) | 4-line + crit on Engineer | Copper 4-cell block + 40-turn overlay | 🔒 40 turns | Polish weld VFX + turn countdown |
| Grovewarden Root Surge | Grove sliding-window | Mossy roots from boss | (per spec) | Polish root growth tendrils |
| Pressure increases | Per `PRESSURE_GAIN` event | Meter fills | 🔒 values | Designer #2 — gauge build animation |
| Pressure reaches 100 → Stagger | Threshold | Gold flash + slow-mo + narrator | sacred timings | Designer Stagger entry FX polish |
| In Stagger (4 turns) | State = STAGGER | Damage 1.5x; visual stays "ULT-economy" | 4 turns | Polish chromatic shift / particle density |
| Stagger → Recovery | After 4 turns | Banner: "RECOVERY 2T" + revenge telegraph | 2 turns | Polish telegraph border |
| Recovery → boss revenge | After 2 turns | Channel-specific FX + damage on player | per-channel | Per-channel damage feedback (Designer #3) |
| ULT button ready | Cost threshold reached | Button glow per element | none specific | Designer #5 — distinct ready vs charging |
| ULT fires | Player taps ready | Race-fx flavor + signature attack | per-handler | Polish ULT ceremony |
| Boss HP crosses 70% / 35% | Mid-fight | (covered by reactivity above) | n/a | n/a |
| Boss death | HP ≤ 0 | 5-beat cinematic | 🔒 5 beats | Designer #9 — beat content within sacred timings |
| Victory modal | Post-cinematic | Reward screen | none specific | Designer reward ceremony polish |
| Defeat (squad wipe) | All heroes HP=0 | Defeat modal + death flashback | none specific | Designer defeat tone (poetic, not punishing) |
| Player HP damage | Boss attack lands | HP bar decrement (animated) + haptic | `V_HAPTICS.hit = 30` | Designer #1 — animated healthbar |
| Player HP low (≤25%) | HP threshold | Bar pulses in critical red (legacy CSS line 2020) | none specific | Designer #1 — escalation visual |
| Mitigation absorbs damage | Mitigation > 0 | "MITIGATED N" float text | none specific | Polish mitigation chip + float text |
| Heal received | Heal effect fires | (heal-flash VFX) | none specific | Designer #1 — heal feedback (part of healthbar redesign) |

---

## 23. How to use this doc

**Roman's workflow for writing a polish task:**

1. **Identify the mechanical event** — find it in §1-§19 sections OR in §22 visual hooks table
2. **Note sacred boundaries** — every 🔒 marker means the underlying mechanic / timing / value cannot change
3. **Cite file:line** in the task brief — gives Engineering Lead exact target
4. **Reference SYSTEM_MAP.md** for asset locations + CSS files (the "where to apply the polish" map)
5. **Reference Polish Strategy doc** §4 Tier S/A for prioritization

**Designer's workflow for spec'ing a screen:**

1. **List every mechanical event that fires on this screen** (consult §22)
2. **Per event, design visual** — within sacred boundaries (timings + colors-of-channels are constraints; everything else is open)
3. **Annotate Figma layers** with: "this fires when [event from §22]; sacred timing = X ms"
4. **Performance budget** per Polish Strategy §10.2: 60fps maintained throughout

**Engineering Lead's workflow during implementation:**

1. **Open the relevant src/ file** per file:line citation in task brief
2. **Verify sacred boundaries are not touched** via grep + git log
3. **Implement Designer's visual** in CSS / Lottie / new src/feel module (NOT touching the mechanic files in src/core or src/data)
4. **Update visual regression baseline** for affected screen
5. **Run sacred-cow audit** before PR merge — automated via test:unit + manual grep verification

---

**Document version:** 1.0
**Coverage:** all combat mechanics referenced by Polish Strategy §4 Tier S (combat HUD redesign — 10 items)
**Open items for future revisions:**
- Phase 3 / Phase 4 mechanics (Party Tower shared Hearts + TOWER_PACTS, NFT-hero variants) — not in combat scope; will get their own design doc when those become user-visible at Phase 5 Gate 3
- Tower-specific mechanics (Pacts, retry economy, Uroboros seasonal boss) — partially covered; expand if Roman + Designer need Tower-screen polish detail
- Audio mapping per event — currently text-only; add audio cue column if Designer requests
