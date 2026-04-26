# PHASE 5b — CHAPTER 2: BLOOM OF MADNESS · SIGN-OFF

**Branch:** `phase-2-grammar`
**Spec:** [BLOCKSWORN_BOSS_COMPENDIUM.md](../BLOCKSWORN_BOSS_COMPENDIUM.md) §6-10 · [BLOCKSWORN_META_PROGRESSION.md](../BLOCKSWORN_META_PROGRESSION.md) §4 + §5 · MASTER_PLAN_V3 §7 row 5b (decoupled phase per D3 decision)
**Predecessor:** Phase 5 sign-off `v0.5.0-phase-5-done` (`7c2b99d`)
**Date:** 2026-04-26
**Tag:** `v0.5.5-chapter-2-done`

---

## A. Phase 5b deliverables

Per master plan §7 + D3-D7 decisions: Phase 5b ships Chapter 2 entirely as a decoupled phase (separate from Phase 5 hero-only scope). Shipped across 9 blocks.

### A.1 Block-by-block summary

| # | Block | Commit | Doc |
|---|---|---|---|
| 1 | Chapter 2 archetype infrastructure (5 NEW archetypes) | `95bc783` | [PHASE_5B_BLOCK_1_CHAPTER2_ARCHETYPES_AUDIT.md](PHASE_5B_BLOCK_1_CHAPTER2_ARCHETYPES_AUDIT.md) |
| 2 | Chapter 2 boss data + 5 PNG assets | `1c869c4` | [PHASE_5B_BLOCK_2_CHAPTER2_BOSSES_DATA_AUDIT.md](PHASE_5B_BLOCK_2_CHAPTER2_BOSSES_DATA_AUDIT.md) |
| 3 | VEROTHIRA (Hypnotist) + 2 Crocs unlock | `8d656b9` | [PHASE_5B_BLOCK_3_VEROTHIRA_AUDIT.md](PHASE_5B_BLOCK_3_VEROTHIRA_AUDIT.md) |
| 4 | GEARHEART (Engineer) + 3 Crocs unlock | `738f1b8` | [PHASE_5B_BLOCK_4_GEARHEART_AUDIT.md](PHASE_5B_BLOCK_4_GEARHEART_AUDIT.md) |
| 5 | URSARO (Frenzy) + 2 Sparks unlock | `044bb1f` | [PHASE_5B_BLOCK_5_URSARO_AUDIT.md](PHASE_5B_BLOCK_5_URSARO_AUDIT.md) |
| 6 | TIDESPIRE (Tempo Disruptor) + 3 Sparks unlock | `b7d9148` | [PHASE_5B_BLOCK_6_TIDESPIRE_AUDIT.md](PHASE_5B_BLOCK_6_TIDESPIRE_AUDIT.md) |
| 7 | HELIOTRON (Battery) + Chapter 2 finale | `e961a4f` | [PHASE_5B_BLOCK_7_HELIOTRON_AUDIT.md](PHASE_5B_BLOCK_7_HELIOTRON_AUDIT.md) |
| 8 | World Map cinematic + Chapter 2 transition | `b06c54f` | [PHASE_5B_BLOCK_8_WORLDMAP_CINEMATIC_AUDIT.md](PHASE_5B_BLOCK_8_WORLDMAP_CINEMATIC_AUDIT.md) |
| 9 | Sign-off + tag | (this commit) | this doc |

---

## B. What's in the game now

**10/10 boss archetypes** complete (5 Chapter 1 + 5 Chapter 2):

| Chapter | # | Boss | Element | Archetype | HP | atk |
|---|---|---|---|---|---|---|
| 1 | 1 | PYREDRAKE | Fire | Berserker | 1800 | 11 |
| 1 | 2 | ABYSSAL TYRANT | Frost | Armored | 3800 | 9 |
| 1 | 3 | GROVEWARDEN | Earth | Bruiser | 6500 | 7 |
| 1 | 4 | SOLAR PHOENIX | Light | Phoenix | 7500 | 6 |
| 1 | 5 | CRYPT LICH | Dark | Assassin | 11000 | 5 |
| **2** | **6** | **VEROTHIRA** | umbra | **Hypnotist** | 14500 | 6 |
| **2** | **7** | **GEARHEART** | grove | **Engineer** | 16000 | 6 |
| **2** | **8** | **URSARO** | ember | **Frenzy** | 15000 | 5 |
| **2** | **9** | **TIDESPIRE** | tide | **Tempo Disruptor** | 17000 | 5 |
| **2** | **10** | **HELIOTRON** | solar | **Battery** | 19000 | 5 |

---

## C. 5 NEW archetype mechanics

| Archetype | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| **Hypnotist** | Suggestion (1 hero, +30%) + Petal Fall (4 cells → umbra) | + Tendril Coil (lock hero 2 turns), Suggestion 2 heroes +50% | + Bloom Bloom (umbra clears damage player), Suggestion 2 heroes +75% |
| **Engineer** | Cell Lockdown (2 cells welded, 4 turns) | + Resource Extract (drain earth-cells, +5% HP heal/cell), Lockdown 3 cells | + Critical Mass (electrified row, 50 dmg/clear), Lockdown 4 cells |
| **Frenzy** | Stacks (+1/turn no-hit, +5% dmg each) | + Maul Combo (≥5 stacks → 3 attacks/turn), stacks decay 50% on hit | + Devour (≥8 stacks → lock weakest hero 3 turns + boss heal 8% HP), gain doubled (+2/turn) |
| **Tempo Disruptor** | Slow Time (visual blue tint) | + Reverse Tempo (next placement: 0 charge gain) | + Tidal Lock (next turn entirely skipped) |
| **Battery** | Solar Charge meter (+1 hit / +2 no-hit, visible UI) | + Solar Convergence (100% → 4-row top-half AoE) | + Sunfire Cascade (3 sequential strikes: 3 cols → 3 rows → center 3×3), gain doubled |

Each archetype has full 3-phase escalation per Compendium §6-10.

---

## D. Hero unlock progression — full Chapter 1 + Chapter 2

| Stage | Heroes Unlocked | Cumulative | Captains |
|---|---|---|---|
| FTUE prologue | 3 mixed-race starters | 3 | — |
| Win Pyredrake (1) | 5 same-faction (BACKLOG-002 captain pick: CRIMSON or NIGHTLORD) | 5 | 1 |
| Win Tyrant (2) | + 5 OTHER faction + SQUAD_MAX→4 | 10 | 2 |
| Win Grovewarden (3) | + 2 Sharks (warrior + hunter) | 12 | 2 |
| Win Solar Phoenix (4) | + 3 Sharks (mage/tank/captain) + SQUAD_MAX→5 | 15 | 3 |
| Win Crypt Lich (5) | Chapter 1 Complete + **Chapter 2 unlocked via cinematic** | 15 | 3 |
| **Win Verothira (6)** | + 2 Crocodiles (MOSSJAW + THORNBACK) | 17 | 3 |
| **Win Gearheart (7)** | + 3 Crocodiles (MOSSWEAVER + IRONSCALE + ANCIENTSCALE) | 20 | **4** |
| **Win Ursaro (8)** | + 2 Sparks (EMBERSPARK + RADIANCE) | 22 | 4 |
| **Win Tidespire (9)** | + 3 Sparks (LUMENWIND + AEGIS + SOLARLORD) | 25 | **5** |
| **Win Heliotron (10)** | Chapter 2 Complete celebration | 25 | 5 |

**All 25 v1 heroes unlockable through legitimate progression.**

---

## E. Crypt Lich aftermath cinematic (Block 8)

Per Meta-Progression §4.1 — the most critical D7 retention moment:

```
[Crypt Lich death]
  ↓
"Chapter 1 Complete!" celebration (existing tier label)
  ↓ +2s
[BLACK OVERLAY · purple → gold radial gradient]
  ↓ 0.6s
"The dominion has fallen."
  ↓ 1.4s
"But something else has risen."
  ↓ 1.4s
"Welcome, Summoner — to what comes next."
  ↓ 1.6s
CHAPTER 2 — BLOOM OF MADNESS  (purple→gold gradient banner)
  ↓ 1.4s
[ENTER THE WORLD]
  ↓ tap
[Menu re-renders → Chapter 2 tab unlocked]
```

Tactile cue + reduced-motion compliant. One-shot per save (gated by `!chapter2Unlocked` at trigger site). Migration backfills for existing playtest saves.

---

## F. 15 NEW Chapter 2 voice lines

3 lines per boss (intro / midfight / death) per Compendium tone identity:

```
VEROTHIRA — overlapping plural voices, seductive
  intro:    "Welcome, little spark. We have... so many gifts... for you."
  midfight: "Your heart races. Such... wonderful... rhythm. Give me more."
  death:    "...we... we were... so... close..."

GEARHEART — mechanical fragments with static
  intro:    "DIRECTIVE... ACTIVE. INTRUDER... DETECTED. INITIATING... PROTOCOL: ELIMINATE."
  midfight: "FUEL... LOW. CONSUMING... AVAILABLE... RESOURCES."
  death:    "DIRECTIVE... FAILED. SHUTTING... DOWN... ALL... SYSTEMS..."

URSARO — animalistic growls, short phrases
  intro:    "Hungry... hungry... hungry..."
  midfight: "You wound. I HUNGER. Wound MORE."
  death:    "...always... hungry... forever..."

TIDESPIRE — drowning chorus, inevitable
  intro:    "One drop... then ten thousand... we are... ONE."
  midfight: "Resist. We have heard ten thousand resist. Each fell to the same... ...QUIET."
  death:    "...soft... soft... silent... ...silent..."

HELIOTRON — formal sovereign, sad-but-confident
  intro:    "I am the sun's last echo. Step into my light, and prove worthy."
  midfight: "This is what your ancestors built. To outlast you. To remind you what was lost."
  death:    "I... served... well..."
```

---

## G. Phase 5b smoke — code-state verification

JS syntax verified via JavaScriptCore (~6.55MB parses through 17,632+ lines clean — no SyntaxError; runtime TypeError is expected absence of `document.head` shim in headless `jsc`).

Counts verified via `grep`:
- **CHAPTERS array**: 2 entries (Chapter 1 + Chapter 2), 5 bosses each = 10 bosses total ✅
- **BOSS_ARCHETYPES**: 10 entries (5 Chapter 1 + 5 Chapter 2) ✅
- **ARCHETYPE_MATCHUP**: 10 entries with strong/weak element pairings ✅
- **5 Chapter 2 boss assets**: Boss_6 → Boss_10 inlined as base64 (~1MB total) ✅
- **15 NEW voice lines**: 3 per Chapter 2 boss in BOSS_VOICES ✅
- **BOSS_UNLOCKS**: 10 entries (1-10), Chapter 2 entries 6-9 unlock Crocs/Sparks ✅
- **UNLOCK_TIER_LABELS**: 10 entries (Chapter 1 Complete + Chapter 2 Complete + per-boss labels) ✅
- **All 25 v1 heroes unlocked** (no `locked: true` on Pirates/Rock/Sharks/Crocs/Sparks) ✅
- **5 archetype CSS auras** + reduced-motion fallback ✅
- **5 archetype tick functions** (_tickHypnotist / _tickEngineer / _tickFrenzy / _tickTempo / _tickBattery) ✅
- **4 migrations** (B3 / BACKLOG002 / PHASE5_lock / PHASE5B_chapter2) ✅
- **Crypt Lich aftermath cinematic** + dismiss handler ✅
- **Charge meter UI** for Battery archetype ✅
- **Hero card visual indicators**: hypno-suggested / hypno-coiled / frenzy-devoured + welded cells + electrified row ✅
- **Body tint**: tempo-slow-tint for Slow Time visual ✅

---

## H. Roman regression — full Chapter 1 → Chapter 2 pass

1. **Fresh install**:
   - Splash → FTUE intro → Pyredrake fight (HP 800)
   - Chronograph PHASE A · BASICS → captain pick → Grunt → Chronograph PHASE B → FTUE complete
   - Chapter 1 progression: Pyredrake → Tyrant → Grovewarden → Solar Phoenix → Crypt Lich
   - On Crypt Lich win: "Chapter 1 Complete!" → World Map cinematic → "ENTER THE WORLD"
   - Menu re-renders with Chapter 2 tab unlocked
   - Tap Chapter 2 → boss list shows Verothira (Boss 6) + locked future bosses

2. **Chapter 2 progression**:
   - Verothira (Hypnotist): Suggestion + Petal Fall + Tendril Coil + Bloom Bloom; win → 2 Crocs unlock
   - Gearheart (Engineer): Cell Lockdown + Resource Extract + Critical Mass; win → 3 Crocs unlock
   - Ursaro (Frenzy): stacks + Maul Combo + Devour; win → 2 Sparks unlock
   - Tidespire (Tempo Disruptor): Slow Time + Reverse Tempo + Tidal Lock; win → 3 Sparks unlock
   - Heliotron (Battery): charge meter + Solar Convergence + Sunfire Cascade; win → "Chapter 2 Complete!"

3. **Race-pure squad cinematics** (3+ same-race + same-element):
   - All 5 Tier 3 signature combos accessible:
     - THE GOLDEN HOARD (3+ Pirates × Ember)
     - THE DARK ENCORE (3+ Rock × Umbra)
     - THE FROST DEEP (3+ Sharks × Tide)
     - **THE EMERALD WARDEN** (3+ Crocs × Grove) — Phase 5
     - **THE PRISMATIC RIDE** (3+ Sparks × Solar) — Phase 5

4. **Existing playtest saves** (Crypt Lich already defeated pre-Block-8):
   - PHASE5B migration backfills `chapter2Unlocked = true` silently on next launch
   - No cinematic re-fire (gate: !chapter2Unlocked at trigger)
   - Chapter 2 tab immediately accessible

5. **DevTools**:
   - `__debugChapter2Archetype()` shows current archetype state during Chapter 2 fights
   - `BOSS_UNLOCKS[6-10]` populated correctly
   - `chapter2Unlocked === true` after Crypt Lich win
   - `HERO_ROSTER.filter(h => h.race === 'crocodile').every(h => !h.locked)` → true after Gearheart win
   - All 25 heroes accessible after Tidespire win

6. **No console errors** through full Chapter 1 + Chapter 2 sequence.

---

## I. Spec adherence (Phase 5b sign-off)

| Spec point | Implementation | Status |
|---|---|---|
| 5 Chapter 2 bosses (Compendium §6-10) | CHAPTERS[1] roster with HP/atkInterval/archetype/img | ✅ |
| 5 NEW archetypes (Compendium §12) | BOSS_ARCHETYPES extension + 5 tick functions + CSS auras | ✅ |
| 3-phase progression per boss (HP gates 100/66/33%) | `_bossArchetypePhase()` helper drives all 5 archetypes | ✅ |
| 15 voice lines (3 per boss) | BOSS_VOICES extension | ✅ |
| Crocs/Sparks unlock progression (Meta §5.3) | BOSS_UNLOCKS[6-9] entries | ✅ |
| Crypt Lich aftermath cinematic (Meta §4.1) | `showCryptLichAftermathCinematic` + 4-stage reveal | ✅ |
| Chapter 2 tab access via existing UI | `chapter2Unlocked` flag wired to `renderChapterToggle` | ✅ |
| Migration for existing saves | `runMigration_PHASE5B_chapter2_unlock` | ✅ |
| 5 archetype-specific visual indicators | hero-card / cell / body / charge-meter classes | ✅ |
| Reduced-motion compliance | `@media (prefers-reduced-motion: reduce)` for all new animations | ✅ |
| Tactile feedback | `vibrate(...)` on key beats per archetype | ✅ |
| Full World Map UI per Meta §4.2 (Daily Quests / Tower / Hero Upgrades) | Reserved for Phase 6+ per master plan §7 + D5 decision | ⏳ Phase 6/7 |

---

## J. Phase 5b metrics

| Metric | Phase 5 end | Phase 5b end | Δ |
|---|---|---|---|
| File size | 5.42 MB | **6.55 MB** | +1.13 MB |
| Lines | 25,332 | **26,889** | +1,557 |
| Bosses | 5 (Chapter 1) | **10** (Ch1 + Ch2) | +5 |
| Archetypes | 5 | **10** | +5 |
| Boss voice lines | 15 | **30** (15 Ch1 + 15 Ch2) | +15 |
| BOSS_UNLOCKS entries | 5 | **10** (1-10) | +5 |
| UNLOCK_TIER_LABELS | 5 | **10** | +5 |
| Migrations | 3 | **4** (+ PHASE5B_chapter2_unlock) | +1 |
| Hero card visual classes | 4 | **6** (+ frenzy-devoured + welded/electrified cell variants) | +2 |
| Cinematic overlays | 4 (sigCombo / clutch / deathFlashback / chronograph) | **5** (+ cryptLichAftermath) | +1 |
| Console diagnostics | 5 | **6** (+ __debugChapter2Archetype) | +1 |

---

## K. Tag history

```
v0.1.0-phase-1-done          Phase 1 — Foundation
v0.2.0-phase-2-done          Phase 2 — Element × Role × Race Grammar
v0.3.0-phase-3-done          Phase 3 — The Moment Mechanics
v0.4.0-phase-4-done          Phase 4 — Onboarding Rebuild
v0.4.1-hotfix-1              Phase 4 chronograph 2-phase split
v0.4.2-hotfix-2              Phase 4 EN localization + AAA+ copy
v0.5.0-phase-5-done          Phase 5 — Earth + Light Race + 25-hero matrix
v0.5.5-chapter-2-done        ← THIS TAG (Phase 5b — Chapter 2: Bloom of Madness)
```

---

## L. Soft launch readiness

| Soft launch criterion | Status |
|---|---|
| 5 elements implemented (Fire/Frost/Earth/Dark/Light) | ✅ |
| 5 races implemented (Pirates/Rock/Sharks/Crocs/Sparks) | ✅ |
| 25 v1 heroes implemented + unlockable via progression | ✅ |
| 10 archetypes (5 Chapter 1 + 5 Chapter 2 NEW) | ✅ |
| 10 Chapter 1+2 bosses with voice lines | ✅ |
| 5 Tier 3 signature combos | ✅ |
| FTUE chronograph (7-min curriculum) | ✅ |
| Branching captain pick (BACKLOG-002) | ✅ |
| Phase 3 cinematics (Signature / Clutch / Death Flashback) | ✅ |
| **Chapter 2 (5 bosses + 5 archetypes + Crocs/Sparks unlock)** | ✅ Phase 5b |
| **Crypt Lich aftermath cinematic** | ✅ Phase 5b Block 8 |
| Star rating system (1-3 stars/boss) | 🔴 Phase 6+ |
| Hero upgrade system (levels 1-10) | 🔴 Phase 6 |
| Tower Mode | 🔴 Phase 7 |
| Daily quests | 🔴 Phase 7 |

**Soft launch is now achievable** — full Chapter 1 → Chapter 2 narrative loop complete with 25 unlockable heroes, all archetypes, signature combos, and the World Map transition cinematic. Phase 6+ work (Hero levels, Star rating, Tower, Daily Quests, Premium currency) is post-soft-launch monetization layer.

---

## M. Phase 6+ pipeline (per master plan §7)

After Phase 5 + 5b ship:

- **Phase 6 — Tier + Pack Economy** (~2-3 weeks): Hero levels 1-10 upgrade system, T2/T3 ascension, hero card duplicates, premium currency layer, pack purchases, Star rating system
- **Phase 7 — Launch Prep** (~2-3 weeks): Tower Mode, Daily quests, Race-Pure mode, Login bonus, Sound + analytics, store submission, full launch build, full World Map UI per Meta §4.2
- **Phase 8+ — Post-Launch Expansions**: Clockwork, Steamworks, Skeletons, Bananas, Aliens, Trolls, element-variant races, seasonal events, Chapter 3

---

## N. Git status

Phase 5b sign-off commit on `phase-2-grammar`. Auto-merged to `main`. Tag `v0.5.5-chapter-2-done` placed on the merge commit.

```
9 blocks · 9 commits · 9 audit docs · 1 tag
```
