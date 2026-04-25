# HERO GRAMMAR — Element × Role × Race Architecture

**Status:** Foundation spec for Phase 2. Frozen unless an explicit MGD decision overrides a clause.
**Owner:** Master Game Director.
**Scope:** The grammar by which every Blocksworn v1 hero is described, balanced, and read. All Phase 2 hero work derives from this document.

---

## 1. Philosophy

Blocksworn exists to deliver one feeling repeatedly: **The Moment**.

> *"You are at 1 HP. The boss is at 8% HP. The next boss attack is your death. A Z-piece falls into the tray. Two seconds of silence. You see it: B3 → a horizontal of 4 ember-charged cells → inferno multiplier × Thorgar ULT → cascade → carried bonus from the Umbra captain → boss dies, with -2 HP on the last turn before its swing. You place the piece. Time slows. The cascade runs."*
> — *The Last Line*, BLOCKSWORN_MASTER_PLAN §1.1

The Moment is not an accident. It is the player **reading** the board three turns ahead and being **right**. Every system here exists to make that reading possible, repeatable, and earned.

**The Combo Grammar.** Every fight is a sentence built from five verbs:

> **Warrior creates → Mage amplifies → Hunter detonates = DAMAGE CASCADE.**
> **Tank absorbs = TEAM GETS TURNS.**
> **Captain enables = MULTIPLIER + DROPS.**

Every hero answers exactly one question: *"Am I creating, amplifying, detonating, protecting, or enabling?"* If a hero cannot be reduced to one of those five verbs in one sentence, the design is wrong.

**Predictability is non-negotiable.** A Warrior that sometimes detonates, a Captain that sometimes deals damage, or an element whose effect varies between fights destroys the read. Variance lives only in **drop order**, never in **hero behavior**.

**Element × Role is the only mechanical identity in v1.** A Pirate Warrior and a Shark Warrior differ on the board only because their elements differ. Two Warriors of the same element behave identically in the combo grammar — only visual, audio, and race-passive differ.

---

## 2. Element Matrix

Five elements. **Hybrid naming:** UI uses the short form (Fire, Frost, Earth, Dark, Light); in-world copy and code use the in-world form (Ember, Tide, Grove, Umbra, Solar). Mapping is fixed for v1.

| UI Name | In-World | Core Mechanic | Board Interaction | Combo Role | Visual Signature | Audio Signature |
|---|---|---|---|---|---|---|
| **Fire** | Ember | Charges cells; charged cells detonate for multiplied damage. | On clear, surviving ember cells become *charged*. Adjacent charged cells chain on detonation. | **Damage payoff** — the loudest element; converts board state into spike damage. | Saturated orange-red (#E85D4A → #FF8B3D). Ember sparks, heat shimmer, sharp flash on detonation. | Crackle, low whoosh on charge, percussive crack on detonation. |
| **Frost** | Tide | Freezes cells; frozen cells form chains; chain length grants extra turns. | Cleared cells chill neighbors. Three chilled in a row form a *chain*. Broken chains refund placements. | **Tempo control** — converts board state into time, not damage. The "stop time" element. | Cold cyan (#3B8BD4 → #7FD4E8). Crystalline drift, freeze-frame snap, brittle shatter. | Soft shimmer on freeze, glassy shatter on chain break, sub-bass swell on tide ULT. |
| **Earth** | Grove | Roots cells; rooted cells bloom over turns into HP and thorn damage. | Surviving grove cells become *rooted*; survive 2 extra clears; emit +HP on bloom (turn 3). | **Survival → revenge** — the slowest element. "I'm still here, and now I hurt you." | Warm green (#5DCA79 → #B8E89A). Vines grow in real time, leaf burst, woody thorn crack. | Low organic rumble, soft chime on bloom, woody snap on thorn release. |
| **Dark** | Umbra | Stacks Encore; Encore replays the last beat at higher cost. | Each clear adds an *Encore stack*. Triggering Encore replays the last ability at scaling multiplier. | **Escalation** — revenge + rhythm. Rewards keeping the same line alive across turns. | Deep violet (#9B59D6 → #4A1E5F). Smoke trails, neon pulse, double-flash on Encore. | Sub-bass kick on Encore, rising distortion as stacks build, vinyl reverse on ULT. |
| **Light** | Solar | Illuminates cells; illuminated cells convert clears into squad-wide gain. | Surviving solar cells become *radiant*: +crit to next ability; convert overflow damage into squad heal/charge. | **Sustain → conversion** — the only element that turns excess into something else. | Pale gold (#E8B84A → #FFE8A8). Rays, lens flare, gentle bloom, prismatic flash. | Bell chime on illumination, choral swell on conversion, bright peal on solar ULT. |

---

## 3. Role Matrix

Five roles. Each role is one verb in the combo grammar. A hero has exactly one role.

| Role | Function | Verb | Board Interaction | Charge Cost (Relative) | ULT Signature Pattern |
|---|---|---|---|---|---|
| **Warrior** | CREATOR | *creates* | Establishes board state — spawns charged/frozen/rooted/encore/radiant cells. Direct hit on placement. | **Medium** (combo ≥ 2 fires ability; ULT ~4 placements). | **SIEGE** — large flat damage burst; the cleanest finisher. |
| **Mage** | AMPLIFIER | *amplifies* | Multiplies the value of element-state cells already on the board. Does not create state. | **Medium-slow** (period-based, ~12 placements). | **MENDING** — full heal or board-state extension; restores the engine. |
| **Hunter** | DETONATOR | *detonates* | Triggers all element-state cells at once for AoE / line burst damage. The payoff role. | **Fastest** (combo ≥ 2; ULT ~3 placements). | **VOLLEY** — multi-line burst; the cascade trigger. |
| **Tank** | PROTECTOR | *absorbs* | Generates shields from element-state. Taunts or reroutes incoming damage. Buys the squad turns. | **Slowest** (no minCombo gate; passive shield/turn; ULT ~5 placements). | **AEGIS** — large shield + element seed; the survival pivot. |
| **Captain** | ENABLER | *enables* | Two simultaneous buffs: race-passive scaling and element-drop weighting (§6). One per squad. | **Medium** (period-based, ~10 placements). | **DOMINION** — board-wide element seed + multiplier window. |

Charge cost ordering — fastest to slowest: **Hunter < Warrior ≈ Captain ≈ Mage < Tank**. Fixed. The loudest role (Hunter) fires most often; the sturdiest (Tank) fires least.

---

## 4. Element × Role Combination Table (5 × 5)

Each cell is one mechanically distinct hero archetype. No two cells share a mechanic.

|  | **Warrior (CREATE)** | **Mage (AMPLIFY)** | **Hunter (DETONATE)** | **Tank (PROTECT)** | **Captain (ENABLE)** |
|---|---|---|---|---|---|
| **Fire / Ember** | **CLEAVER** — direct hit on placement; clears N random ember cells (N=1 base, scales with tier); cascade triggers if any cleared cell was charged. Initiates the damage cascade for amplifier/detonator roles to chain. *(Per-cell charge timer mechanic deferred to Phase 6 — see §8 amendment log.)* | **EMBER BLOOM** — every charged cell gains +50% detonation damage; ULT: full squad heal + +1 ULT charge. | **INFERNO** — detonates every charged ember cell at once; damage scales with charged-cell count (×3 cap). | **FIREBRAND** — +1 shield per ember clear; ULT: +3 shields + seeds 3 charged ember cells. | **CRIMSON GAMBIT** — race-buff scales pirate damage; +25% ember drops; ULT seeds 10 charged cells. |
| **Frost / Tide** | **TIDEBREAKER** — direct hit on placement; every tide clear *chills* adjacent cells, building chains. | **TIDE WEAVER** — extends every active chain by +1 cell; ULT freezes the boss attack timer for 1 turn. | **SHATTER VOLLEY** — breaks every active chain for line damage; longer chain = wider line (1 = 1 row, 4+ = 4 rows). | **TOCK GUARD** — +1 shield per chain segment broken; ULT *refunds 1 placement* to the player. | **DEEP TIDE** — race-buff scales shark chain bonuses; +25% tide drops; ULT chills entire board for 2 turns. |
| **Earth / Grove** | **ROOTHEWER** — direct hit on placement; every grove clear becomes a *rooted* cell surviving 2 clears. | **GROVE WEAVER** — every rooted cell emits +30 HP/turn; ULT: every rooted cell blooms into a thorn (boss damage). | **THORN BURST** — detonates every rooted cell as a thorn projectile; damage scales with bloom turns elapsed. | **BARKHIDE** — rooted cells in squad's row absorb 50% of next boss attack; ULT: taunt 2 turns + 4 rooted cells. | **GROVEMOTHER** — race-buff scales crocodile sustain; +25% grove drops; ULT roots half the board with simultaneous bloom turn 3. |
| **Dark / Umbra** | **RIFFBLADE** — direct hit on placement; every umbra clear adds 1 *Encore stack* to the next ability. | **DEEP BEAT** — Encore stacks gain +20% per stack; ULT: every squad hero gets one free Encore. | **PIERCING SHRIEK** — detonates every Encore stack as echoing line damage; line repeats once at 50% (Encore-of-Encore). | **DRUMHEAD** — every Encore proc grants +1 shield; ULT: free Rhythm proc + squad-wide Encore window. | **NIGHTLORD** — race-buff scales rock band Encore multiplier; +25% umbra drops; ULT triggers immediate squad-wide Encore window. |
| **Light / Solar** | **SOLAR EDGE** — direct hit on placement; every solar clear becomes *radiant*: +10% crit to the next ability. | **SOLAR WEAVER** — every radiant cell converts 25% overflow damage into squad ULT charge; ULT: each radiant cell heals one squad member. | **SOLAR FLARE** — detonates every radiant cell as an AoE flash; damage = base × radiant count; crit splashes to all boss DOTs. | **LIGHTBEARER** — radiant cells in squad's row cleanse 1 debuff/turn; ULT: full cleanse + 4 radiant cells. | **DAYBREAK** — race-buff scales sparks crit chance; +25% solar drops; ULT illuminates the entire board (every cell radiant for 1 turn). |

**Reading rule:** When a new hero is requested, fill in (Element, Role) and copy the cell. The cell is the brief. Race adds visual, audio, race-passive, and naming — nothing mechanical.

---

## 5. Race Layer

Race is **not** mechanical identity. Race is **flavor + collection**. Mechanical identity is fully described by the §4 cell.

**Race-passive activation rules** (per race in the active squad):

| Heroes of race in squad | Passive | Magnitude |
|---|---|---|
| **1** | None | — |
| **2** | Small passive | +10–15% to a single race-flavored stat (e.g., +10% ember crit for 2 pirates). |
| **3+** | Strong passive + cinematic | +25–30% to a single race-flavored stat, plus a one-time intro cinematic on first activation in a fight. |

**Critical rule (non-negotiable):** No race-passive may exceed **30%** of any core mechanic's value at full stack. Race must never out-scale Element × Role.

### v1 races (3 races shipping in Phase 2)

| Race | Element | Status | Race-flavor |
|---|---|---|---|
| **Pirates** | Fire / Ember | 5/5 implemented | Raw, kinetic, "all here, all now." Passive scales raw ember damage. |
| **Rock Band** | Dark / Umbra | 5/5 implemented | Rhythmic, escalating, "encore on top of encore." Passive scales Encore multiplier. |
| **Sharks** | Frost / Tide | 5/5 art ready, code TBD | Patient, predatory, "the chain pulls you under." Passive scales chain length / refund odds. |

### Pre-launch additions (Phase 5)

| Race | Element | Status |
|---|---|---|
| **Crocodiles** | Earth / Grove | Phase 5 |
| **Sparks** | Light / Solar | Phase 5 |

### Future expansions (placeholder; not in v1)

Clockwork (Frost-alt), Steamworks, Skeletons, Bananas, Aliens, Trolls. Naming reservation only. **Clockwork is deferred to post-launch expansion #1** — not in v1 squads, drops, or roster screens.

---

## 6. Squad Composition

**SQUAD_MAX progression:**

| Stage | Squad Max | Unlocked by |
|---|---|---|
| Game start | **3** | Default. |
| After Boss 2 | **4** | Boss 2 clear. |
| After Boss 4 | **5** | Boss 4 clear. |

### Captain dual buff system

A captain provides **two buffs simultaneously**, both active for the entire fight:

1. **Race buff (scaling)** — scales with same-race count in the squad: 1 hero = **+5%**, 2 = **+15%**, 3+ = **+30%**.
2. **Element drop buff (fixed)** — **+25%** drop weight toward the captain's element, regardless of squad composition.

**Both apply at the same time.** A Crimson captain in a 3-pirate squad gives +30% pirate damage *and* +25% ember drops, simultaneously.

**Only ONE captain per squad.** Captains do not stack. Choosing the captain is the highest-leverage squad decision in the game.

### Recommended squad templates

| Template | Composition | Logic |
|---|---|---|
| **Burst** | Warrior + Mage + Hunter (same element) | Pure cascade: create → amplify → detonate. Highest damage ceiling, lowest survivability. |
| **Sustain** | Tank + Mage + Captain (Earth or Light) | Long fights, boss with high attack frequency. Captain weights drops to feed the sustain element. |
| **Control** | Tank + Captain + Hunter (Frost) | Tide chain extension + tide drop buff + chain detonation. Wins by stealing turns. |
| **Race-pure** | 3 heroes of one race + Captain of same race + 1 flex | Activates +30% race passive AND captain race-buff at +30%. Strongest mid-game template, pure flavor playstyle. |

---

## 7. Signature Combos (forward declaration — Phase 3)

Forward declaration only. Numbers and triggers are set in Phase 3.

- **Same-Race signature** (3+ same race) → race-flavor cinematic + small bonus.
- **Same-Element signature** (3+ same element) → element burst cinematic + medium bonus.
- **Same-Race-AND-Element signature** (3+ same race AND same element) → full Signature Combo: large bonus, unique cinematic. Reserved names (fixed):
  - Pirates × Ember → **THE GOLDEN HOARD**
  - Rock Band × Umbra → **THE DARK ENCORE**
  - Sharks × Tide → **THE FROST DEEP**
  - Crocodiles × Grove → *(reserved, Phase 5)*
  - Sparks × Solar → *(reserved, Phase 5)*

Numbers, trigger conditions, and cinematic timing are owned by Phase 3 (TASK #4.1).

---

## 8. Non-Negotiables

Frozen for v1. Change requires an explicit MGD decision and a versioned amendment.

1. **5 elements, 5 roles, fixed.** Fire, Frost, Earth, Dark, Light. Warrior, Mage, Hunter, Tank, Captain. No additions, no merges, no role hybrids.
2. **Race is cosmetic + collection only.** Race adds visual, audio, naming, and a capped race-passive — never defines what a hero does in the combo grammar.
3. **One element per hero in v1.** No dual-element heroes. No element-switching abilities. The §4 cell is the hero.
4. **Element drop buff is fixed; race buff is scaling.** Captain's +25% element drop never scales with squad composition; race buff only scales. This asymmetry is what makes captain selection a real decision.
5. **Race-passive impact ≤ 30% on core mechanics.** No race-passive at any stack count exceeds 30% of any core stat. Element × Role always out-scales race.
6. **Tier system is NOT implemented until Phase 6.** No T2/T3 variants, no tier-delta abilities, no tier currencies in v1. References to `fireTierDelta` / `ultTierDelta` in code are placeholder.
7. **Sharks = Frost element. Mapping is fixed for v1.** Not Tide-flavored Clockwork, not dual-element, not interchangeable with any future Frost race.
8. **Clockwork is deferred to post-launch expansion #1.** Removed from v1 squad selection, drops, and unlock screens. Sharks take the Frost slot.
9. **Spec amendments require explicit MGD decision and a versioned entry in the amendment log below.** No silent rewording of §4 cells, §5 race rules, or §6 captain mechanics.

### Amendment log

- **2026-04-26** — §4 [Fire × Warrior] CLEAVER updated to reflect v1 implementation (clears N ember cells with cascade, vs. the original "becomes a charged cell for 2 turns"). Per-cell charge timer mechanic deferred to Phase 6 tier system. Reason: the timer mechanic does not exist in the v1 codebase and would force a mid-Phase-2 architectural change. THORGAR ships as-is for v1; spec wording now matches the shipped behavior.

---

*End of HERO GRAMMAR v1. Every Phase 2 hero — design, code, art, audio — is graded against this contract.*
