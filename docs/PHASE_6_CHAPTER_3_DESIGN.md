# Phase 6 — Chapter 3: PRIMAL CONCLAVE · Design Document

Status: **DRAFT — awaiting Roman ratification**
Date: 2026-04-27

This is a design proposal, not implementation. Approve / iterate / reject
before any code lands. Block-by-block plan included; each block is a
small, isolated commit (mirror of Phase 5b Block 1-9 cadence).

---

## 1. Theme — "Primal Conclave"

Chapter 1 (Ashen Dominion) = **souls of failure** (RAGE / PATIENCE / JUDGMENT / ARROGANCE / BOREDOM)
Chapter 2 (Bloom of Madness) = **madness expansion** (SEDUCTION / DUTY / HUNGER / INEVITABILITY / NOSTALGIA)
**Chapter 3 (Primal Conclave) = the original Summoners themselves, turned tyrants by their own ambition.**

> "Before you, others answered the call. They held the grid. They built squads.
> They failed — and were consumed by the very souls they tried to bind. Now
> their squads are *part of them*. Five Summoners. Five corruptions. One Conclave."

Each boss represents a **failure mode of the Summoner role**:
- They use HERO grammar against you (CREATE / AMPLIFY / DETONATE — but as boss mechanics)
- They mirror your design vocabulary
- They are personal, not abstract

This is a dark mirror of the player's journey.

## 2. Boss Roster (Chapter 3, bosses 11-15)

| # | Name | Element | Archetype | Soul | HP | Theme |
|---|---|---|---|---|---|---|
| 11 | **VOIDCASTER** | Dark/Umbra | **Mage Boss** (NEW) | AMBITION | 13000 | Telegraphed spell-casts. Player must read + counter. |
| 12 | **ECHOCALL** | Frost/Tide | **Mirror** (NEW) | ENVY | 14500 | Mimics player's last placement. Punishes spam. |
| 13 | **HORDEMASTER** | Earth/Grove | **Summoner** (NEW) | GREED | 16000 | Spawns add-units (mini-grunts) every 4 turns. |
| 14 | **BLOODSTORM** | Fire/Ember | **Apex Berserker** (NEW) | WRATH | 17000 | Frenzy × Berserker hybrid. Stacks don't decay. |
| 15 | **FINAL JUDGEMENT** | Light/Solar | **Adjudicator** (NEW) | PRIDE | 19500 | Judges play style. Rewards balance, punishes spam. |

5 NEW archetypes (Chapter 1 had 5, Chapter 2 had 5, Chapter 3 has 5 → total **15 archetypes** at endgame).

## 3. The 5 New Archetypes

### 3.1 Mage Boss (VOIDCASTER)
**Mechanic**: Telegraphs 3 spells per phase. Player sees telegraph 2 turns ahead, must clear specific element to counter.
- **VOID HEX**: telegraphed shadow on grid → if not cleared in 2 turns, spawns 3 void_umbra cells
- **SOUL DRAIN**: targets squad hero with most HP → that hero loses ULT charge
- **REND TIME**: telegraphed → next 2 turns boss attacks twice

### 3.2 Mirror (ECHOCALL)
**Mechanic**: Boss memorizes player's last 2 placements. On its next attack, it spawns void cells in the SAME SHAPE the player just placed.
- Player learns: don't predict; vary placement
- Counter: skip a turn (defensive) or change pattern

### 3.3 Summoner (HORDEMASTER)
**Mechanic**: Every 4 turns, spawns 2 "Grunt" sub-bosses (small 1500 HP each). Player damage SPLITS between main boss + grunts.
- Grunts spawn void_grove cells when alive
- Killing a grunt restores 1 player HP (Hunger feedback loop)

### 3.4 Apex Berserker (BLOODSTORM)
**Mechanic**: Frenzy stacks NEVER decay. Plus Berserker rage: <50% HP → +50% void spawn count. Stacks both.
- Player must kill fast OR survive long with massive shield
- Hardest fight in Chapter 3 by far

### 3.5 Adjudicator (FINAL JUDGEMENT) — chapter finale
**Mechanic**: Tracks player's element-clear ratio. If player clears >60% of one element → JUDGEMENT triggers: that element's clears do 0 damage for 2 turns. Rewards balanced 4-element play.
- Forces full-roster decision-making
- Mechanic: counts clearsPerElement; on judgement → suppressMult[elem] = 0 for 2 turns

## 4. Race tie-in — Clockwork unlocks

Chapter 3 unlocks the **6th race: Clockwork** (Frost-alt). Already 5 placeholders in HERO_ROSTER (`clockwork_*` ids, currently `locked: true`).

> Lore: ECHOCALL's broken time-magic shatters when she dies. Her Clockwork
> constructs (5 of them) escape and seek a new Summoner.

| Boss # | Unlock |
|---|---|
| 11 (VOIDCASTER) | + 2 Clockworks: GEARSWORN (W), TICKTOCK (H) |
| 12 (ECHOCALL) | + 2 Clockworks: CHRONOS (M), PENDULUM (T) |
| 13 (HORDEMASTER) | + 1 Clockwork: HOROLOGE (C) — race complete |
| 14 (BLOODSTORM) | tier-up reward (no new heroes) |
| 15 (FINAL JUDGEMENT) | TOWER MODE unlock + cinematic |

→ Chapter 3 closure = **30 v1 heroes total** (5 races × 5 roles + 5 Clockworks).

## 5. Clockwork race-passive (per §8 plan)

Frost-alt race needs distinct passive (not duplicate Sharks):

| Tier | Passive | Mechanic |
|---|---|---|
| 2-of-race | **CLOCK CHIME** | First placement each turn auto-extends frostChainSegments by +1 |
| 3+-of-race | **TIME ECHO** | Every 6th placement, the LAST charged ember/umbra cell detonates a second time |

Theme: time manipulation. Doesn't break Sharks' tempo lane (chains) — extends differently (hint: per-turn auto-bump vs per-cleared chain build).

## 6. Clockwork hero abilities (5 fire/ULT pairs)

Following pure-grammar (Warrior CREATE only, Hunter detonate, etc.):

| Hero | Role | fire (passive) | ULT signature |
|---|---|---|---|
| **GEARSWORN** | Warrior | spawn 3 tide-cells AND 1 ember-cell — dual-element seed | TICK FORGE: spawn 4 tide + 2 ember |
| **TICKTOCK** | Hunter | detonate ALL frostChainSegments at once × time-mult | VOLLEY: ×2 cap, freeze attack +1 turn on detonate |
| **CHRONOS** | Mage | open 3-placement TIME WEAVE: each clear = +1 turn freezeBank | MENDING: instantly convert freezeBank → attackCountdown (massive freeze) |
| **PENDULUM** | Tank | +1 shield + delay attack +1 + spawn 1 grove absorber | AEGIS: +3 shields + reset attackCountdown to max |
| **HOROLOGE** | Captain | convert 2 cells to tide + extend 1 active mage-window | DOMINION: chill board 3 turns + open chronograph window |

Charge cost per role unchanged (Warrior 80 / Tank 80 / Mage 100 / Captain 100 / Hunter 120).

## 7. Cinematic outline — between Chapter 2 → Chapter 3

Mirror Phase 5b Block 8 (World Map cinematic from Crypt Lich → Heliotron). After Heliotron defeat:

```
[Heliotron defeat → standard victory modal]
[400ms]
playDialog('chapter_2_outro')
  ↓ "Two chapters fall. The grid grows quiet. But silence is a lie."
[onComplete →]
playDialog('chapter_3_intro')
  ↓ "Five thrones await. Five Summoners who came before you. They built
     what you build. They failed. They became the very souls they tried to bind.
     Welcome to the Conclave."
[onComplete →]
showWorldMap('chapter_3') → reveals 5 boss portraits with new emblems
```

Chapter 3 outro (after Final Judgement defeat) leads into **Tower Mode** unlock cinematic.

## 8. Implementation Block Plan (mirror Phase 5b)

| Block | Scope | LOC est. |
|---|---|---|
| **6.1** | Archetype infrastructure + Clockwork race-passive constants | ~150 |
| **6.2** | Boss data entries (5 bosses + portraits + intros + dialogs) | ~250 |
| **6.3** | VOIDCASTER fight (Mage Boss archetype) + 2 Clockworks unlock | ~400 |
| **6.4** | ECHOCALL fight (Mirror archetype) + 2 Clockworks unlock | ~400 |
| **6.5** | HORDEMASTER fight (Summoner archetype) + 1 Clockwork unlock + Clockwork race complete | ~450 |
| **6.6** | BLOODSTORM fight (Apex Berserker) — no new heroes | ~300 |
| **6.7** | FINAL JUDGEMENT fight (Adjudicator) + chapter finale cinematic | ~400 |
| **6.8** | World Map for Chapter 3 (mirror Phase 5b Block 8) | ~200 |
| **6.9** | Sign-off doc + tag `v0.6.0-chapter-3-done` | docs only |

**Total est: ~2550 LOC + ~10 boss portraits + cinematic art**

Same cadence as Phase 5b: each block ships independently with audit doc + commit + auto-merge to main.

## 9. Asset requirements (NOT YET COMMISSIONED)

- 5 boss portraits (VOIDCASTER, ECHOCALL, HORDEMASTER, BLOODSTORM, FINAL JUDGEMENT)
- 5 boss emblems (for void cells, like Chapter 2 had)
- 5 Clockwork hero portraits (placeholders exist; commission art per existing race pattern)
- 1 Clockwork race emblem
- 1 Chapter 3 world map cinematic frame

**Block 6.1 (infrastructure) doesn't need any asset yet.** Other blocks gate on art delivery.

## 10. Open design questions (need Roman input before Block 6.2+)

1. **Boss names** — are VOIDCASTER / ECHOCALL / HORDEMASTER / BLOODSTORM / FINAL JUDGEMENT acceptable, or rename?
2. **Clockwork race-passive theme** — chronograph fits? Or change?
3. **HP scaling** — peak 19500 HP on Final Judgement OK? Or harder/softer?
4. **HORDEMASTER grunt sub-bosses** — accept added complexity, or simplify to "spawn 2 void_grove per 4 turns" without HP-bearing grunts?
5. **Adjudicator mechanic complexity** — clearsPerElement tracking is a new system. Roman OK with it, or simpler "boss has 3 phases, each phase punishes a different element" version?
6. **Tower Mode unlock as Chapter 3 reward** — already gated by Crypt Lich today; does it shift to Final Judgement?

## 11. What I propose to do AUTONOMOUSLY (Block 6.1)

Even before Roman ratifies the full design, **Block 6.1 (infrastructure)** is safe to ship. It adds:

1. CHAPTER_3 constant in chapter cap checks (extends `currentChapter < 3` → `currentChapter < 4`)
2. Stub `BOSS_UNLOCKS[11..15]` entries pointing at Clockwork hero IDs
3. Clockwork race-passive constants (`CLOCKWORK_CHIME_*`, `CLOCKWORK_TIME_ECHO_*`)
4. `_RACE_PASSIVE_DETAILS.clockwork` entry (so getActiveRacePassives surfaces it)
5. RACE_TO_STIHIYA + RACE_SYNERGY entries for clockwork (the only race currently missing from these tables)
6. Helper stubs: `_spawnClockworkChime`, `applyTimeEcho` — no-op until heroes wired

These are **additive, gated, and don't affect gameplay** until Block 6.3+ ships. If Roman rejects the design, we revert just Block 6.1 cleanly.

## 12. Decision points for Roman

Reply with one of:

- **"approve full design"** → I implement Blocks 6.1-6.9 in sequence
- **"approve 6.1 only, hold 6.2+ until I review names"** → I ship Block 6.1, wait
- **"change <X>"** → describe; I revise design doc
- **"different theme — try <Y>"** → I redo the design

Block 6.1 takes ~30 minutes after approval. Then Block 6.2 (boss data) needs your name approval first.
