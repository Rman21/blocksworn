# Identity Layer — Phase 2 Design Spec

**Status:** DRAFT — awaiting Roman approval
**Author:** Game Designer (TASK-028 / T2.01)
**Date:** 2026-05-12
**Phase:** 2 (Identity Layer) — opening task
**Implementation status:** Not started (T2.02–T2.12 implement per this spec)

---

## 0. Overview

The Identity Layer is the per-line-clear "flavor" layer that makes every race
feel mechanically distinct **and** makes every boss archetype react to player
play in a memorable way. It fires **every line clear** (frequent), in
deliberate contrast to v2.1 P4 Reactivity Events which fire **at HP phase
gates 70% / 35%** (rare). The two layers are complementary: Reactivity Events
escalate boss difficulty in two pre-announced beats; the Identity Layer
sprinkles small, race-coded "I-was-here" moments across the entire fight and
turns the rare ones (Phoenix board burn, Lich curse cells) into adaptive
puzzles.

Design goal in Roman's audit phrase: **mechanics × race/boss identity**.
A Pirate squad vs Phoenix should feel different from a Crocodile squad vs
Lich. The Identity Layer is how we deliver that.

---

## 1. Architectural fit

| Layer | Granularity | Triggers | Source of truth | Touch frequency |
|-------|-------------|----------|-----------------|-----------------|
| **Reactivity Events** (v2.1 P4 — sacred) | per-archetype | Phase gates `PHASE_GATE_P1_TO_P2 = 0.70`, `PHASE_GATE_P2_TO_P3 = 0.35` | `src/core/reactivity-events.js` (22 handlers) | ~2× per battle |
| **Identity Layer** (Phase 2 — new) | per-race × per-boss matchup | Every `clearLines(rows, cols)` resolve | New: `src/feel/identity-fx.js` + new `src/data/identity-layer.js` | 10–40× per battle |

### Hard rules

1. **Identity Layer extends, never modifies, v2.1 P4.** Reactivity handlers
   stay byte-perfect. New code only adds new hooks; existing 22 handlers,
   phase gates, and `REACTIVITY_TELEGRAPH_MS = 3000` are sacred.
2. **No sacred-cow numeric changes.** Combo crit formula, RACE_SYNERGY
   tier values (`hp` / `dmgMult` / `ultMinus` / `passiveMult` /
   `startCharge` / `spawnWeight` / `bonusDmg`), `V_HAPTICS`, TTK formula,
   and TIER_COSTS_V18 must remain identical.
3. **Layered, not replacement.** RACE_SYNERGY's existing 2x/3x/5x tier
   bonuses fire on **squad composition** (count threshold). Identity Layer
   fires on **action** (line clear). A 5-pirate squad receives BOTH:
   `bonusDmg.ember +5/cell` (RACE_SYNERGY tier 5, sacred) AND the
   Pirate's Plunder FX (new layer). They co-exist additively; the new
   layer never multiplies into the sacred damage formula.
4. **Boss-reactive identity hooks reuse the telegraph→execute pattern**
   already established for Reactivity Events: 3-second wind-up banner
   (`REACTIVITY_TELEGRAPH_MS`) followed by handler execution. New
   identity reactions piggy-back on this surface so the player learns one
   visual language for "boss is doing a thing."

### Scope: 5 races, 5+ boss archetypes

Per Execution Plan §7.2 the 5 races in Phase 2 scope are the V18.8 NEW
RACES: **Pirate (ember), Shark (tide), Rock (umbra), Crocodile (grove),
Spark (solar).** These are the races whose hero tier abilities live in
`HERO_TIER_ABILITIES` (`src/data/heroes.js` lines 35–209) but which do
NOT yet have RACE_SYNERGY tier entries — `pirate` and `rock` have synergy
tiers; `shark`, `crocodile`, `spark` have only an entry in
`RACE_TO_STIHIYA` (tide / grove / solar respectively) and no
RACE_SYNERGY block yet. **Open question O1 to Roman below.**

The 5 original races (orc/elf/troll/human/dark_elf) already carry full
v2.0 race kits in RACE_SYNERGY. They are NOT in Phase 2 Identity Layer
scope (no flavor effect — they remain "racial passives only"). They are
listed in the Codex screen for completeness.

For boss-reactive mechanics: 5 chapter-finale archetypes + 2 optional
spotlight archetypes (Voidfang in Tower; Uroboros seasonal). That gives
the spec 7 boss identity mechanics total.

---

## 2. Race line-clear flavors

### Convention

Every race flavor has exactly the same 10 spec fields. Each effect
**must** decay or self-cap inside its own performance budget. The
mechanical contribution may NEVER feed the combo-crit damage formula —
it is layered on top via independent state writes (gold, charge, board
hazards) so the sacred formula `total_dmg × (1 + dominantCount × combo
× 10%)` is untouched.

Trigger condition for **all** race flavors below: line clear of any
length resolves AND ≥1 hero of the named race is alive in the active
squad. Effect strength is `f(raceCount)` — see each entry. If 0 heroes
of the race are alive, the flavor silently no-ops (graceful exit, no
DOM creation).

---

### 2.1 Pirate (Ember) — "Pirate's Plunder"

1. **Race / element:** `pirate` / `ember` (per `RACE_TO_STIHIYA`).
2. **Identity name:** Pirate's Plunder.
3. **Visual:** From each cleared cell, a small gold coin (16×16 SVG)
   pops upward with rotation, then arcs toward the gold counter in the
   HUD. ~3-coin trail per cell, capped overall at 32 coins per fire.
   Coins use the existing painterly emblem style (matches PR #157).
4. **Mechanical:** `+5 gold per cleared cell × min(pirateCount, 5)`.
   At 5 pirates that is 25 gold per cell; a 5-line crit clear (40
   cells) yields 1000 gold maximum. Capped against the squad-of-5
   ceiling (sacred — squad max 5).
5. **Sound:** existing coin clink sample at 0.5× volume, layered on
   top of the standard line-clear SFX. No new asset (use whatever the
   shop screen plays for purchase confirm — re-use to save bundle).
6. **Haptic:** standard `clear` (V_HAPTICS.clear = 25ms) — no new key
   added (sacred §2.2).
7. **Counter:** pure flavor + economic. Bosses do not counter Plunder
   directly; the gold flows into the meta-economy, not the fight.
8. **Stacking:** Multiplies with **gold-side** modifiers only.
   - Stacks with Combo Crit's **cell count** (more cells cleared →
     more gold) but NOT with the crit damage multiplier.
   - Stacks with RACE_SYNERGY pirate tier 5 `PLUNDER` flag — when both
     active, RACE_SYNERGY's "bonus shards" drop AND Plunder gold both
     fire (independent rewards).
   - Stacks with Element Synergy 2x/3x/5x — independently (synergy
     reduces ULT cost; Plunder gives gold).
9. **Performance budget:**
   - Wall-time ≤6ms per fire (well under 16ms frame budget).
   - Max 32 coin DOM nodes simultaneously (matches existing
     `vPlayLineClearBurst` cap of 32 sparks — re-use pool).
   - Decay 1000ms (coin spawn → HUD arrival → fade).
10. **Trigger condition:** Every successful `clearLines(rows, cols)`
    where rows.length + cols.length ≥ 1 AND `squad.some(h =>
    h.race === 'pirate' && h.hp > 0)`.

**Player perspective:**
- **Newbie:** "Cool, coins!" — gold counter visibly ticks, reinforces
  loop reward.
- **Mid:** "I should run pirates for econ; 25g × 40 cells is real
  shop money." Strategic depth without combat power-creep.
- **Hardcore:** "Pirate-stack farming in early Ch1 grunt fights →
  ~1000g per 5-clear → fund Mythic ascension faster." Optimization
  path opens.

---

### 2.2 Shark (Tide) — "Feeding Frenzy"

1. **Race / element:** `shark` / `tide`.
2. **Identity name:** Feeding Frenzy.
3. **Visual:** A teeth-arc SVG (curved bite shape, white-on-cyan)
   sweeps left→right across each cleared row and top→bottom across
   each cleared column. After the sweep, **one extra adjacent cell**
   per cleared line lights up cyan and clears as if it were part of
   the line — the "bite extension." Capped at 4 extra cells per
   `clearLines` call (one per cleared row/col, max).
4. **Mechanical:** Clears `min(1, sharkCount/2)` adjacent cells per
   cleared row/col, max 4 extra cells total per fire. The extra
   cleared cells DO count as cells cleared by the line — meaning they
   feed back into Combo Crit's `dominantCount` AND back into
   Pirate's Plunder (cross-race synergy in mixed squads). They do
   NOT count as a new line for cascade purposes (no infinite chain
   risk).
5. **Sound:** wet bite + small water splash (200ms layered sample,
   re-use existing tide line-clear sample if available; else flag
   asset request to Audio in T2.03).
6. **Haptic:** standard `clear` (25ms) — same as 2.1 Pirate.
7. **Counter:** Bosses with `tempo_disruptor`, `wither`, or
   `engineer` archetypes already lock or freeze cells; if Shark would
   clear a locked/electrified cell, the bite is **absorbed** —
   visually it still plays but the locked cell is not cleared. This
   means the boss's lockdown counters Shark naturally (no new boss
   code needed — Shark just respects existing cell-state predicates
   from grid.js).
8. **Stacking:**
   - With Combo Crit: cleared extra cells count toward
     `dominantCount`, so a Shark bite can push a 3-line clear into
     4-line crit territory. This **is** an interaction with sacred
     combo crit — but it operates by adding cells to the input set
     **before** the formula runs, not by modifying the formula. This
     is the same pattern as existing cascade mechanics.
   - With RACE_SYNERGY skeleton tier 5 `UNDYING CHILL` (also
     tide-themed) — independent layers, no conflict.
   - With Pirate Plunder in mixed squad: extra bitten cells award
     Plunder gold too. Cross-race combo bonus is intentional design.
9. **Performance budget:**
   - Wall-time ≤10ms per fire (slightly heavier than Pirate due to
     extra grid mutations).
   - Max 4 extra cells cleared per fire (hard cap, not soft).
   - Bite SVG: 1 element per cleared line, decay 500ms.
10. **Trigger condition:** Every `clearLines(rows, cols)` with ≥1 row
    or ≥1 col where dominant element is `tide` OR ≥2 shark heroes in
    squad. (Two paths: dominant-tide gates a single-shark squad to a
    smaller effect; 2+ sharks always fire regardless of element.)

**Counter (boss):** Sharks have the **strongest mechanical effect** of
any race flavor. To prevent shark-dominance, the boss-reactive Lich
identity mechanic (§3.2 below) specifically counters Shark.

**Player perspective:**
- **Newbie:** "Sharks eat extra blocks!" — visually obvious, easy to
  read.
- **Mid:** "Shark + dominant-tide clears = guaranteed combo crit
  promotion." Real strategic call.
- **Hardcore:** "Run 5-shark squad on engineer boss to overwhelm
  lockdown rate" — mastery moment.

---

### 2.3 Rock (Umbra) — "Encore Echo"

1. **Race / element:** `rock` / `umbra`.
2. **Identity name:** Encore Echo.
3. **Visual:** ~200ms after the line clears, a translucent purple
   "ghost" of the cleared cells flashes back in place for one beat,
   then dissolves. Visual reference: a faint echo afterimage, akin to
   the Encore tier-3 race-synergy flavor (`rock.3 = ENCORE — first
   🌑ULT ×2`). Particles are slow-moving violet sparks (re-use
   particle pool, recolor only).
4. **Mechanical:** **+1 ULT charge** to the umbra ULT meter (only) per
   cleared line where dominant element is `umbra`. Capped at +4 per
   fire (one per line, max 4 lines from a quad-clear). No charge
   awarded if dominant is anything other than umbra.
5. **Sound:** soft cymbal swell, 400ms, layered. Re-use existing
   `Encore` proc sound from rock-tier RACE_SYNERGY if Audio surfaced
   it; else flag for Audio task.
6. **Haptic:** standard `clear`.
7. **Counter:** Boss archetype `confession_reader` already silences
   umbra/solar plays (per ARCHETYPE_MATCHUP §223 it's strong vs
   umbra+solar) — Encore Echo is naturally weaker against
   confession_reader matchups. Reinforces existing matchup chart.
8. **Stacking:**
   - With existing RACE_SYNERGY rock tier 3 `ENCORE` (first 🌑ULT
     ×2): both fire — Encore tier-3 doubles the *next* umbra ULT
     fired, Encore Echo gives extra charge so that ULT comes sooner.
     Compound synergy intentional.
   - With Element Synergy umbra 3x/5x: independent layers; Identity
     Layer adds raw charge, Element Synergy reduces threshold.
   - With Combo Crit: no interaction (charge ≠ damage).
9. **Performance budget:**
   - Wall-time ≤8ms per fire.
   - Max 4 echo elements simultaneously (one per line).
   - Decay 700ms.
10. **Trigger condition:** `clearLines(rows, cols)` with at least one
    line where dominant element (`getDominantElementCount` from
    `grid.js`) is `umbra`, AND ≥1 rock hero alive.

**Player perspective:**
- **Newbie:** "The line came back as a purple ghost!" — visual
  curiosity, doesn't need to understand the mechanic.
- **Mid:** "Rock squads charge umbra ULTs faster. Run mage for ULT
  payoff." Build optimization unlocked.
- **Hardcore:** "Rock + dark_elf hybrid squad against umbra-weak
  bosses = umbra ULT spam loop." Min-maxer payoff.

---

### 2.4 Crocodile (Grove) — "Bedrock Bastion"

1. **Race / element:** `crocodile` / `grove`.
2. **Identity name:** Bedrock Bastion.
3. **Visual:** From each cleared cell of grove element, a small
   sandstone/earth fragment (8×8 brown pixel-rect) flies inward
   toward the squad portraits at the bottom of the screen and lands
   visually on whichever crocodile hero is leftmost in the lineup.
   When that hero accumulates 5 fragments, a small shield icon (re-use
   existing shield SVG from HUD) animates on the portrait.
4. **Mechanical:** Per cleared grove cell, accumulate 1 fragment on
   a counter (call it `_crocFragmentBank`). Every 5 fragments grants
   **1 shield** to the squad (or refreshes 1 expired shield) up to
   the squad's existing max shield cap from RACE_SYNERGY golem tier
   2/3/5 `maxShieldBonus` (sacred). If max-shield cap reached, surplus
   fragments are discarded (no overflow exploit).
5. **Sound:** light rocky thunk, 150ms, layered. Re-use any existing
   earth/grove SFX.
6. **Haptic:** standard `clear`.
7. **Counter:** Boss archetype `wither` (Ch3) already drains grove
   over time — `wither` matchup naturally suppresses fragment
   accumulation. Boss archetype `engineer` (Ch2) lockdown also slows
   grove clears. Reinforces existing matchup chart again — no new
   boss code needed.
8. **Stacking:**
   - With RACE_SYNERGY golem (which is also grove-themed and shield-
     centric): both fire. Golem gives static `+shields` and `+max
     shield`; Crocodile gives **dynamic** per-cell accrual. A mixed
     golem+crocodile grove squad can hit max shield faster — but
     never exceed sacred max-shield-bonus values.
   - With Combo Crit: no interaction (shields ≠ damage).
   - With Pirate Plunder in mixed squad: independent (gold and
     shields are different reward channels).
9. **Performance budget:**
   - Wall-time ≤8ms per fire.
   - Max 16 fragment particles simultaneously (4 fragments per cell
     × ~4 cells average), each decay 600ms.
   - Counter math is pure integer addition — negligible CPU.
10. **Trigger condition:** Every `clearLines` where rows∪cols contain
    ≥1 grove cell AND ≥1 crocodile hero alive.

**Player perspective:**
- **Newbie:** "Earth chunks fly to my crocodiles!" — visible cause→
  effect, even if shield gain not yet understood.
- **Mid:** "Crocodile is a defensive race — pair with tank tiers for
  Ch3 wither pacing." Identity clarifies role.
- **Hardcore:** "Crocodile+Golem grove-stack vs Engineer boss caps
  shield economy" — meta-optimization for hard content.

---

### 2.5 Spark (Solar) — "Sun Cascade"

1. **Race / element:** `spark` / `solar`.
2. **Identity name:** Sun Cascade.
3. **Visual:** Each cleared solar cell emits a small golden ray that
   "chains" briefly to the nearest non-empty cell of any element. The
   nearest cell flashes yellow-white for one frame, then resolves
   normally. Pure VFX — does NOT clear the touched cell. Looks like
   light bouncing off cleared cells onto remaining board state.
4. **Mechanical:** **+1 to dominantCount** for the combo crit input
   set, IF cleared rows/cols contained ≥2 solar cells. This is the
   ONLY race flavor that interacts directly with the combo crit
   input (sacred-formula-adjacent). It does so by **mutating
   dominantCount before the formula runs**, not by changing the
   formula — same architectural pattern as cascade. This is the
   highest-impact race flavor; gated by a 2-solar-cell minimum and
   capped at +1 (not stacking).
5. **Sound:** crisp bell chime (200ms, golden-tone), layered.
6. **Haptic:** standard `clear`.
7. **Counter:** Boss archetype `phoenix` already trades in solar
   space (Ch1 Phoenix's revive is solar-themed); `equalizer` (Ch4)
   already balances vs solar; the new boss-reactive Phoenix Burning
   Board (§3.1 below) gates the player to solar-only for 5s, which
   means Sun Cascade fires repeatedly — Phoenix matchup becomes a
   high-tempo solar engagement (the boss reaction TURNS UP Sun
   Cascade rather than countering it; intentional choreography).
8. **Stacking:**
   - With Combo Crit: this is the interaction described in field 4.
     A solar-heavy clear that would have been Combo 3 (3 lines)
     becomes Combo 4 because Sun Cascade adds +1 to dominantCount.
     Sacred formula unchanged; only the input is modified, same as
     existing cascade behavior.
   - With Element Synergy solar 2x/3x/5x: independent — synergy
     reduces ULT cost; Sun Cascade boosts crit.
   - With Lion RACE_SYNERGY tier 5 (`solar` themed, `bonusDmg.solar
     +3/cell`): both apply, independent reward channels.
9. **Performance budget:**
   - Wall-time ≤10ms per fire.
   - Max 16 ray VFX simultaneously, decay 400ms.
   - One `dominantCount += 1` write per fire (pure math).
10. **Trigger condition:** `clearLines` where total solar cells in
    cleared rows+cols ≥ 2 AND ≥1 spark hero alive. If solar cells
    in clear < 2, no effect.

**Design balance note:** Sun Cascade is the most mechanically potent
of the five race flavors (it can turn a 3-line clear into a 4-line
crit clear, which the combo crit formula doubles). It is gated by
two cell minimums and capped at +1 to avoid runaway crit promotion.
Per the task brief's balance rule: ≥3 of 5 races are pure flavor
(Pirate gold, Rock charge, Crocodile shield drip) and 2 have stronger
mechanical effects (Shark adjacent clear, Spark crit promotion).
Spark sits at the upper bound and **must** be playtested at L1, L10,
L20 squads vs all 5 chapter-finale bosses before T2.06 closes.

**Player perspective:**
- **Newbie:** "Light bounces around the board!" — visual delight,
  mechanic invisible.
- **Mid:** "Spark + solar dominant = guaranteed crit upgrade. Pair
  with hunter for VOLLEY combo." Strategy unlock.
- **Hardcore:** "Spark + Lion + solar 5x synergy = compound crit
  promotion chain — peak ember/grove counter squad." Optimization
  ceiling.

---

## 3. Boss-reactive identity mechanics

### Convention

Each boss-reactive mechanic uses the SAME telegraph→execute pattern
as v2.1 P4 Reactivity Events: a 3-second wind-up banner
(`REACTIVITY_TELEGRAPH_MS = 3000`) followed by handler execution.
This gives the player visible reaction time (per AAA+ anti-frustration
standard) and reuses the existing UI surface
(`showReactivityTelegraph`).

The trigger condition is **what the player did**, not just HP gates —
that's the boss-identity-vs-Reactivity-Events distinction.

---

### 3.1 Phoenix archetype — "Ashen Reign"

1. **Archetype name:** `phoenix` (Ch1 Boss 4 SOLAR PHOENIX; possibly
   reused in Ch5 by the FLAME ITSELF cinematic per existing code).
2. **Identity name:** Ashen Reign.
3. **Trigger condition:** Phoenix revive event fires. This is
   ALREADY handled by `PHOENIX_REVIVE_HP_PCT = 0.6` +
   `PHOENIX_IMMUNE_TURNS = 2` (sacred per §2.5). New: when revive
   fires, **also** enter the Ashen Reign state. No change to revive
   numbers; new state is layered.
4. **Boss reaction:** For exactly 5000ms after revive completes:
   - Board renders a flame border (180px-wide pulsing red-orange
     gradient overlay on grid container).
   - `pieceCanBePlaced(piece)` returns false unless
     `piece.element === 'ember'`.
   - HUD shows "EMBER ONLY — 5s" countdown.
   - Pieces drawn during the window are NOT re-rolled — the player
     sees their current pieces and decides if they can place any.
   - If no placeable ember piece exists, the window times out
     harmlessly at 5000ms (no penalty, but a tempo loss).
5. **Player counterplay:**
   - Hold an ember piece in queue for the revive moment (intel via
     `showBossIntelOverlay` should hint this).
   - Run ember-friendly squad (Pirate, Orc) which spawn extra ember
     cells via RACE_SYNERGY `spawnWeight.ember`.
   - Accept the tempo loss and chain Sun Cascade (§2.5) on the
     ember-friendly state that follows the window.
6. **Memorable moment:** The screen catching fire — animated flame
   border, heat distortion, narrator line: "The ash remembers. Strike
   only with the flame that birthed it." (Darkest Dungeon voice, per
   §2.3 — Designer to write new line; if line is sacred-adjacent,
   escalate per §2.7).
7. **Performance budget:**
   - Initial trigger ≤16ms (one DOM overlay + heat distortion CSS
     filter on grid).
   - Steady-state overhead during 5s window: ≤2ms per frame (CSS
     animation, no JS work).
   - Decay: 200ms fade-out.
8. **Sacred cow safety:**
   - Does NOT modify `PHOENIX_REVIVE_HP_PCT` or `PHOENIX_IMMUNE_TURNS`.
   - Does NOT modify combat math, ULT thresholds, or damage formulas.
   - Extends existing phoenix Reactivity handler — adds the Ashen
     Reign state alongside, never replaces.
   - Uses existing `REACTIVITY_TELEGRAPH_MS = 3000` for the wind-up.

**Player perspective:**
- **Newbie:** "The board is on fire!" — clear visual prompt to react.
- **Mid:** "I need to plan ember piece in queue before 60% HP."
- **Hardcore:** "Pre-stack ember board state before crossing 60% so
  the 5s window converts directly into a quad-clear."

---

### 3.2 Assassin / Lich archetype — "Cursed Tiles"

1. **Archetype name:** `assassin` (Ch1 Boss 5 CRYPT LICH —
   archetype = assassin, stihiya = umbra; "Lich" as evocative name).
2. **Identity name:** Cursed Tiles.
3. **Trigger condition:** A clearLines fires where the **player's
   active squad has ≥2 sharks** (the high-mechanical-power race).
   The boss responds the NEXT turn (not same-turn) — telegraph fires
   on player's end-of-turn, handler resolves at start of player's
   next turn.
4. **Boss reaction:** The Lich curses up to **3 random non-empty
   cells** on the board, marking them with a translucent purple skull
   overlay. Cursed cells:
   - Cannot be cleared for 3 turns (act like soft-void cells but
     visually distinct).
   - Inflict 1 HP of damage to the squad each turn they remain.
   - Auto-clear after 3 turns AND grant +20 player ULT charge to
     compensate (so curses are net-neutral over time if you wait
     them out).
5. **Player counterplay:**
   - Stop running 2+ sharks against Lich matchups (run mixed squad).
   - Use a non-shark line clear adjacent to the cursed cells to
     "isolate" them and minimize board pressure.
   - Use Crocodile's Bedrock Bastion (§2.4) which accrues shields
     and can absorb the 1 HP/turn drip.
   - This is the **explicit Shark counter** referenced in §2.2.
6. **Memorable moment:** 3 cells smoking with purple skull glyphs;
   narrator line: "What you took, the deep remembers." Boss feels
   responsive ("the boss is punishing me for shark-stacking") which
   is exactly the matchup identity we want.
7. **Performance budget:**
   - Telegraph banner ≤8ms (re-use existing telegraph component).
   - 3 cursed-cell overlays @ ≤2ms each = ≤6ms.
   - Per-turn tick ≤3ms.
   - Total per fire ≤16ms peak.
8. **Sacred cow safety:**
   - Does NOT modify any v2.1 P4 handler. New handler added in
     parallel under namespace `identity_assassin_shark_counter`.
   - Cursed cells use existing void-cell rendering pipeline with
     a new CSS class; no new grid-state types.
   - The +20 ULT compensation respects sacred ULT thresholds
     (it's a charge addition, not a threshold change).

**Player perspective:**
- **Newbie:** "Skull tiles appeared!" — clear danger signal.
- **Mid:** "Lich punishes shark-stacking; I'll vary squad
  composition by chapter."
- **Hardcore:** "Time shark-stack outside Lich fights; use mixed
  Spark+Pirate vs Lich for ember dominance."

---

### 3.3 Berserker / Frenzy archetype — "Bloodtide Pulse"

1. **Archetype name:** `berserker` (Ch1 Boss 1 PYREDRAKE) +
   `frenzy` (Ch2 Boss 8 URSARO) — both use the same identity hook
   since both are "build aggression over time" archetypes.
2. **Identity name:** Bloodtide Pulse.
3. **Trigger condition:** Every 3rd line clear the player resolves
   while boss is in Active state (NOT Stagger, NOT Recovery — uses
   `getStaggerState()` from `src/core/stagger-loop.js`).
4. **Boss reaction:** A red "pulse" sweeps from the boss portrait
   outward toward the grid. On arrival, **+5% boss attack damage**
   for the next attack only (one-shot buff, not stacking with itself).
   - Caps at +25% total (5 pulses worth) — but since each pulse
     consumes on next attack, only one pulse is ever live at a time
     in practice.
   - This is layered ON TOP of existing
     `BERSERKER_ENRAGE_MULT = 2.0` (sacred). After enrage threshold,
     pulse damage is `+5%` applied to the 2.0× base.
5. **Player counterplay:**
   - Use Tank ULT cooldown to time their AEGIS during pulse
     telegraphs.
   - Burst burst-line-clears in groups of 2 (avoid the 3rd-clear
     trigger).
   - Run Crocodile Bedrock Bastion to bank shields and pre-absorb.
6. **Memorable moment:** Visible "tempo" — every 3rd clear, the
   boss "winds up." Player learns to count clears and bait the
   pulse on safe turns.
7. **Performance budget:**
   - Telegraph at every 3rd clear: count check is O(1).
   - Visual pulse: ≤10ms DOM animation.
   - Damage modifier: pure integer math on next-attack-pending state.
8. **Sacred cow safety:**
   - Does NOT modify `BERSERKER_ENRAGE_HP_PCT = 0.5` or
     `BERSERKER_ENRAGE_MULT = 2.0`.
   - Does NOT modify Stagger Loop state machine.
   - Reads stagger state read-only.
   - Adds new state var `_identityBloodtidePending` (small additive).

**Player perspective:**
- **Newbie:** "Boss flashed red every few clears."
- **Mid:** "Counting clears matters. I'll time my burst around the
  3rd-clear tempo."
- **Hardcore:** "Stagger entry timing + Bloodtide skip = peak boss
  vulnerability window."

---

### 3.4 Engineer archetype — "Lockdown Protocol"

1. **Archetype name:** `engineer` (Ch2 Boss 7 GEARHEART; also
   chapter-finale-adjacent).
2. **Identity name:** Lockdown Protocol.
3. **Trigger condition:** Player completes a 4-line crit clear (the
   "Tetris" max). Boss responds same-turn with a new lockdown.
4. **Boss reaction:** Engineer immediately locks down 1 random 2×2
   square (4 cells) at the corner of the grid most-cleared in the
   last fire. Locked cells:
   - Cannot accept pieces for 40 turns (matches existing engineer
     P1→P2 lockdown handler param `4 cell lockdown 40T`, per spec
     §65; we don't duplicate that handler — we ADD this on-crit
     instance).
   - Visually shown with the existing engineer-lockdown styling
     (re-use CSS class from v2.1 P4).
5. **Player counterplay:**
   - Avoid Tetris-stacking — clear 2–3 lines instead of 4 to dodge
     the trigger. (Direct anti-greed mechanic — punishes maximalist
     clears the way real Tetris punishes you for not clearing.)
   - Shark Feeding Frenzy (§2.2) bites can offset locked cells
     (extra adjacent clears reclaim some board real estate).
   - Pirate ember spawn-weight (RACE_SYNERGY tier) keeps the
     non-locked corners viable.
6. **Memorable moment:** Triumphant "TETRIS!" celebration banner
   immediately followed by a clanking metal lockdown of 4 cells.
   The boss reacts to your best play.
7. **Performance budget:**
   - 4 cells lockdown ≤4ms.
   - Particle effect 1×ratchet animation ≤6ms.
   - 40-turn ticking handled by existing engineer state machinery —
     no new tick cost.
8. **Sacred cow safety:**
   - Does NOT modify the existing `engineer_p1_p2` handler (40T
     lockdown stays exact).
   - Does NOT modify Combo Crit. (The 4-line trigger happens AFTER
     combo crit damage resolves.)
   - Adds new handler entry — does not replace any of the 22 sacred
     handlers.

**Player perspective:**
- **Newbie:** "I got a big clear but the boss did SOMETHING."
- **Mid:** "Engineer punishes Tetris. I'll plan smaller clears."
- **Hardcore:** "Vary clear cadence by boss matchup; Engineer
  inverts the normal 'always Tetris' meta."

---

### 3.5 Grovewarden / Bruiser archetype — "Root Surge"

1. **Archetype name:** `bruiser` (Ch1 Boss 3 GROVEWARDEN; archetype
   shared with Tower bruisers).
2. **Identity name:** Root Surge.
3. **Trigger condition:** Player's last 3 line clears were all NOT
   grove-dominant (boss is "patient"; if you ignore its element,
   it acts).
4. **Boss reaction:** 3 random empty cells gain a "root" overlay
   (green moss SVG). These cells:
   - Block placement for 5 turns.
   - When cleared during the 5 turns, grant +10 player gold (the
     Pirate Plunder economy reward; cross-layer interaction).
   - Auto-clear at 5-turn timeout (no damage, only the placement
     blocker).
5. **Player counterplay:**
   - Run grove squad (Troll/Golem/Crocodile) → grove clears prevent
     the surge from triggering.
   - Accept the temporary block and farm the +10 gold by clearing
     rooted cells deliberately.
   - Element Synergy 3x grove (sacred −4 grove ULT + +20% passive
     dmg) — boss-strong-against-grove matchup is the design
     point; you're meant to bring grove if you can.
6. **Memorable moment:** Mossy roots crawl up empty cells; bossvoice
   narrator: "Where you would not bloom, I will." Boss feels
   thematically alive.
7. **Performance budget:**
   - 3 cell overlays ≤6ms.
   - 5-turn tick handled by existing per-turn flow.
   - Particle: 1× mossy bloom per overlay, ≤8ms.
8. **Sacred cow safety:**
   - Does NOT modify Element Synergy values.
   - Does NOT modify RACE_SYNERGY troll/golem tiers (grove-themed,
     sacred).
   - Adds new state — does not touch existing P4 handlers.

**Player perspective:**
- **Newbie:** "Plants grew on the board!"
- **Mid:** "Grovewarden wants me to play grove. I'll bring Troll."
- **Hardcore:** "Convert non-grove play into root-farming for gold
  econ on Grovewarden runs."

---

### 3.6 (Optional spotlight) Voidfang — "Shroud Pull"

1. **Archetype name:** `tower_voidfang` (Tower-only seasonal — note
   this is a v2.1 P4 handler suffix, see reactivity-events.js spec).
2. **Identity name:** Shroud Pull.
3. **Trigger condition:** Player clears a line where dominant element
   is `umbra` (Voidfang's matchup-strong element).
4. **Boss reaction:** 1-cell void hazard spawns at random empty
   location (re-uses existing `umbralShroud` EFFECT_HANDLER from
   reactivity-events.js — sacred; we trigger it, don't reimplement).
   Caps at 5 voidfang-identity-spawned cells per fight.
5. **Player counterplay:**
   - Avoid umbra-dominant clears against Voidfang.
   - Run Rock Encore Echo (§2.3) — umbra-dominant clears feed
     Encore Echo's ULT charge, accelerating an umbra ULT that wipes
     void cells.
   - Run Crocodile Bedrock Bastion — shields buffer the cumulative
     void damage.
6. **Memorable moment:** Each umbra clear costs the player a board
   cell. The matchup feels predatory; Voidfang is "playing back."
7. **Performance budget:**
   - Re-uses existing void-cell rendering (zero new VFX cost).
   - Per-fire ≤6ms (one state write).
8. **Sacred cow safety:**
   - REUSES existing `umbralShroud` handler — does not modify it.
   - Triggers it from a NEW input gate (line clear) alongside the
     existing phase-gate trigger.

**Player perspective:**
- **Newbie:** "Umbra clears are dangerous here." (Implicit learning.)
- **Mid:** "Voidfang inverts the normal umbra-aggression meta."
- **Hardcore:** "Solar-only run vs Voidfang for void cell denial."

---

### 3.7 (Optional spotlight) Uroboros — "Eternal Loop"

1. **Archetype name:** Uroboros (seasonal Tower mythic per
   CLAUDE.md §2.5; uses `choice` archetype per chapters.js Ch5).
2. **Identity name:** Eternal Loop.
3. **Trigger condition:** Player clears any line of any element.
4. **Boss reaction:** The element JUST cleared becomes Uroboros's
   "strong" element for 30 seconds (visible timer banner). During
   those 30s, that element does −20% damage to Uroboros. After 30s,
   it reverts and the boss-strong-element rotates to the LAST
   element cleared.
5. **Player counterplay:**
   - Diversify clears — never clear the same element twice in a
     row.
   - Use Element Synergy 5x bonuses for the *non*-current-strong
     element (sacred bonuses still apply for off-element).
   - Spark Sun Cascade (§2.5) which promotes mixed-element crit —
     natural anti-Uroboros tooling.
6. **Memorable moment:** Boss visibly cycles strong-element along
   with player's recent play. Narrator: "The eye that sees itself
   sees you, too." Closes the loop on Roman's identity-matters
   thesis: the BOSS adapts to your style, in real time.
7. **Performance budget:**
   - State write per clear ≤2ms.
   - Timer banner re-uses Reactivity Events banner — ≤4ms.
   - −20% applied as multiplier on existing damage write — pure
     math, no formula change.
8. **Sacred cow safety:**
   - Uroboros is sacred (CLAUDE.md §2.5) — we do NOT modify the
     boss itself, its HP, or its v2.1 P9 spec.
   - We ADD an identity hook that reads recent-clear state. Pure
     additive.

**Player perspective:**
- **Newbie:** "Boss is changing color." (Hopefully not too confusing
  — may need FTUE intro.)
- **Mid:** "Vary element. Don't repeat clears."
- **Hardcore:** "Engineer 30s cycle around Uroboros's rotation —
  best-in-class endgame skill check."

---

## 4. Codex screen (T2.12) — design spec

### 4.1 Purpose

The Codex is the **collection surface** for the Identity Layer. Every
race line-clear flavor witnessed and every boss-reactive moment
triggered gets recorded permanently, building a "collection of memorable
moments" the player accumulates over their hours of play.

### 4.2 Information architecture

Three top-level tabs (≤4 tab limit per Designer §6.4):

1. **Races** — all 10 races (5 in scope + 5 original) as portrait cards.
2. **Bosses** — all 25 bosses (Ch1–Ch5) as portrait cards.
3. **Moments** — chronological list of unique Identity-Layer
   triggers witnessed (Phoenix Ashen Reign #4, Lich Cursed Tiles
   #12, etc.).

### 4.3 Per-race detail page

Layout (mobile 380px):

```
┌─────────────────────────────────┐
│  ← Codex / Races / Pirate       │
├─────────────────────────────────┤
│   [emblem]   PIRATE             │
│   element: 🔥 ember             │
│   identity: PIRATE'S PLUNDER    │
│   "+5 gold per cell × pirates"  │
├─────────────────────────────────┤
│  ▸ RACE SYNERGY TIERS           │
│   tier 2: +1 HP · ember flood   │
│   tier 3: +10% dmg · PLUNDER    │
│   tier 5: ... (sacred desc)     │
├─────────────────────────────────┤
│  ▸ MEMBER HEROES (5)            │
│   [P_W] [P_H] [P_M] [P_T] [P_C] │
├─────────────────────────────────┤
│  ▸ LORE (Darkest Dungeon voice) │
│   "Plunderers know one truth..."│
├─────────────────────────────────┤
│  ▸ STATS                        │
│   identity triggered: 47 times  │
│   gold earned (all-time): 6420  │
└─────────────────────────────────┘
```

### 4.4 Per-boss detail page

Layout (mobile 380px):

```
┌─────────────────────────────────┐
│  ← Codex / Bosses / Solar Phoenix│
├─────────────────────────────────┤
│   [boss portrait]               │
│   SOLAR PHOENIX                 │
│   Lvl 4 · Reborn Tyrant         │
│   archetype: 🔥 PHOENIX         │
├─────────────────────────────────┤
│  ▸ MATCHUP                      │
│   strong vs: umbra              │
│   weak to: ember                │
├─────────────────────────────────┤
│  ▸ IDENTITY MECHANIC            │
│   "ASHEN REIGN"                 │
│   On revive: board ember-only   │
│   for 5 seconds. Plan ahead.    │
│   ▸ first encountered: D3       │
│   ▸ defeated: 2 times           │
├─────────────────────────────────┤
│  ▸ LORE                         │
│   "The ash remembers..."        │
└─────────────────────────────────┘
```

### 4.5 Unlock model

Three states per Codex entry:

- **Locked** — never encountered. Card shows a silhouette + "?".
  No mechanical info revealed. No spoiler text.
- **Encountered** — fought at least once (boss) or had at least one
  Identity-Layer trigger fire (race). Card glows softly; full info
  visible.
- **Mastered** — for races: saw the Identity flavor fire AT LEAST 25
  times. For bosses: defeated at least once. Card has a "MASTERED"
  badge (golden border).

Progress widget at top of each tab:
- Races: "Mastered 3 / 5"
- Bosses: "Mastered 8 / 25"
- Moments: "47 unique moments witnessed"

### 4.6 Moments tab

Chronological list of unique boss-reactive Identity moments witnessed.
Each row:
- Boss portrait (small) · "ASHEN REIGN" · "first seen: D3" ·
  `[Replay video]` (if T2.12 ships with auto-record, per Phase 3 plan).

Stretch goal (not required for T2.12): tap a moment → see a 5-second
loop of when it happened. Defer to Phase 3 / Replay infrastructure.

### 4.7 Entry point + nav

- Drawer entry from main hub: "📜 CODEX" below TOWER and ADVENTURE.
- 3 taps max from main menu: Menu → Codex → tab → entry.
- Back/exit via top-left ←, persistent.
- Search/filter optional (Phase 3 polish).

### 4.8 Visual aesthetic

**Parchment / archive** style fits Darkest Dungeon Chronicler voice.
Suggested palette:
- Background: deep parchment beige (#E8DAB6) or aged-paper texture.
- Borders: gold-leaf accents.
- Locked cards: blacked-out silhouettes with a faint candle glow.
- Mastered badges: gilded gold border, soft sparkle.

Re-use existing emblem PNG assets from PR #157 (30 painterly emblems
ready) as race/boss thumbnails — no new asset budget needed for MVP.

### 4.9 Performance + persistence

- Persist Codex state in `localStorage` under
  `blocksworn_codex_state` (new key).
- Schema: `{ races: { pirate: { encountered: true, mastered: false,
  triggerCount: 47 } }, bosses: { ... }, moments: [{ id, firstSeenAt,
  count }] }`.
- Codex page render budget ≤300ms FCP (mostly thumbnail SVGs +
  small text).

### 4.10 Sacred cow safety

- Codex is read-only of game state. Writes only to its own localStorage
  key. Does not modify save data, hero data, boss data, or any sacred
  table.
- Does not affect combat math, ULT thresholds, or any rendered
  numbers.
- Pure aggregation surface.

---

## 5. Performance budgets — layer-wide

| Constraint | Value | Justification |
|------------|-------|---------------|
| Identity FX max fires per turn | 5 | Multi-line clear ceiling |
| Per-effect wall-time | ≤16ms | One frame at 60fps |
| Concurrent particles all effects | ≤100 | Existing mobile budget |
| DOM creation per fire | 0 new (object pool) | Re-use existing pools |
| Audio layered SFX | ≤3 simultaneous | Existing audio mixer |
| Memory per FX type | ≤100KB | Texture/SVG budget |
| Frame budget for boss reactive | ≤16ms initial + ≤2ms steady | Anti-jank |
| Total Identity Layer overhead vs baseline | ≤4ms/frame avg | Maintains 60fps |

### Object-pool requirement

Game Dev must implement particle pooling in `src/feel/identity-fx.js`:
do NOT call `document.createElement` per fire. Allocate pools of 32
coin elements, 16 ray elements, 16 fragment elements at module load;
reset and re-use per fire. This is a hard requirement to meet the
≤4ms/frame budget.

### Audio mixer requirement

The Identity Layer adds up to 5 new SFX (coin / bite / cymbal / thunk /
chime). Audio task in T2.0x must verify the existing audio mixer can
hold the additional samples without exceeding mobile audio memory
limits (~5MB working set). If samples exceed budget, re-use existing
ULT/clear sounds at modified volume/pitch — no new asset spend
required for MVP.

---

## 6. Player perspective (cross-cutting)

### 6.1 Newbie (D0–D7, ~0–10 hours)

The Identity Layer must **delight without confusing**. Each race flavor
must be visually unmistakable; each boss-reactive identity must
telegraph clearly (3s wind-up + banner).

- ✅ All 5 race flavors fire **visually** before mechanically
  rewarding — newbie sees coins/teeth/echoes/fragments/rays before
  understanding the math.
- ✅ All boss-reactive mechanics use the existing telegraph→execute
  pattern — newbie has 3s reaction time + visible boss intent.
- ✅ Codex unlocks reward exploration — every new race/boss
  encounter has a discovery beat.

Risk: Sun Cascade (§2.5) is mechanically subtle (silent +1 to
dominantCount). Newbies may not connect spark to crit upgrade.
**Mitigation:** add a one-time tutorial popup the first time Sun
Cascade promotes a crit, per FTUE standards (CLAUDE.md §3.6).

### 6.2 Mid player (D7–D30, ~10–50 hours)

Identity Layer should give the mid player **build optimization
levers**. Each race has a clear "play for X" purpose:
- Pirate → gold farming.
- Shark → board control / extra clears.
- Rock → umbra ULT acceleration.
- Crocodile → defensive shield economy.
- Spark → crit promotion / damage scaling.

Boss-reactive mechanics force the mid player to **vary squad
composition by matchup** — the central engagement loop Roman called
for ("mechanics × race/boss identity").

### 6.3 Hardcore (D30+, ~50+ hours)

Identity Layer must NOT collapse to a single dominant strategy. The
balance bullets baked into each effect (Shark's 4-cell cap, Spark's
+1 max, Crocodile's max-shield cap) prevent runaway optimization.

- ✅ Sun Cascade gated by 2-solar-cells minimum AND +1 cap → no
  infinite crit loop.
- ✅ Bedrock Bastion respects sacred max-shield cap → no infinite
  shield stack.
- ✅ Encore Echo capped at +4 charge per fire → no infinite ULT
  loop.
- ✅ Pirate Plunder scales linearly with squad pirate count, capped
  at squad of 5 → no exponential gold farm.
- ✅ Feeding Frenzy capped at 4 extra cells per fire → no infinite
  cascade.

Hardcore players will find specific race × boss pairings that
optimize ("Spark+Lion vs Phoenix is busted"). This is desired —
matchup mastery IS the Phase 2 fantasy. Bug Tester should run a
post-T2.11 matrix audit to verify no single pairing dominates.

---

## 7. Implementation dependencies (for Game Developer)

### 7.1 New files

| File | Purpose | T-number |
|------|---------|----------|
| `src/feel/identity-fx.js` | All FX functions: fxPirateLineClear, fxSharkLineClear, fxRockLineClear, fxCrocodileLineClear, fxSparkLineClear + fxAshenReign, fxCursedTiles, fxBloodtidePulse, fxLockdownProtocol, fxRootSurge, fxShroudPull, fxEternalLoop | T2.02–T2.11 |
| `src/data/identity-layer.js` | Constants: race effect map, per-effect budgets, trigger thresholds | T2.02 (created first) |
| `src/ui/codex.js` | Codex screen component | T2.12 |
| `src/styles/screens/codex.css` | Codex styling | T2.12 |
| `tests/smoke/identity-layer.spec.js` | Smoke tests per race + boss mechanic | T2.02–T2.11 (incremental) |

### 7.2 Files to modify (additive only)

| File | Change | Sacred risk |
|------|--------|-------------|
| `src/core/grid.js` | After `clearLines` resolves (line 401 area, after `vPlayLineClearBurst`), add identity-fx dispatch hook. Pass `(rows, cols, squad, currentBoss)`. | NONE — pure addition after sacred call |
| `src/core/reactivity-events.js` | Add identity hooks alongside existing 22 handlers. New handlers under `identity_*` namespace. NEVER edit the 22 existing handlers. | NONE — additive, sacred handlers untouched |
| `src/core/bosses.js` | Read-only — Identity Layer consumes archetype/matchup data, does not modify | NONE |
| `src/data/races.js` | Add new optional field `identity_fx_key: 'plunder' \| 'frenzy' \| 'echo' \| 'bastion' \| 'cascade'` to the 5 V18.8 races. RACE_SYNERGY tiers UNTOUCHED. | NONE — new field only |
| `src/feel/particles.js` | Add 5 new particle factory functions (coin, bite, echo, fragment, ray). Re-use existing pool patterns. | NONE — additive |
| `src/styles/screens/battle.css` | Add CSS classes for identity overlays (board burning, cursed tiles, lockdown, root surge, shroud, loop banner). | LOW — CSS only |
| `src/styles/animations.css` | Possibly add @keyframes for new effects (`@keyframes ashenReignBorder`, `@keyframes cursedTileSkull`, etc.). | LOW — additive only |

### 7.3 Sequence

T2.02 creates `src/data/identity-layer.js` (constants only) + Pirate
flavor implementation. T2.03–T2.06 implement the other 4 races in
parallel-friendly order. T2.07–T2.11 implement boss-reactive mechanics.
T2.12 implements Codex screen LAST (it depends on all triggers being
wired so they can write to the codex state).

### 7.4 Visual regression baseline impact

The following baselines will need RE-CAPTURE after each T2.0x ships
(per CLAUDE.md §7.6 — intentional change → update baseline with
justification):

- `tests/visual/baseline/battle-pirate-squad.png` (after T2.02)
- `tests/visual/baseline/battle-shark-squad.png` (after T2.03)
- `tests/visual/baseline/battle-rock-squad.png` (after T2.04)
- `tests/visual/baseline/battle-crocodile-squad.png` (after T2.05)
- `tests/visual/baseline/battle-spark-squad.png` (after T2.06)
- `tests/visual/baseline/battle-phoenix-revive.png` (after T2.07)
- `tests/visual/baseline/battle-lich-cursed.png` (after T2.08)
- `tests/visual/baseline/battle-berserker-pulse.png` (after T2.09)
- `tests/visual/baseline/battle-engineer-lockdown.png` (after T2.10)
- `tests/visual/baseline/battle-grovewarden-roots.png` (after T2.11)
- `tests/visual/baseline/codex-races-tab.png` (T2.12)
- `tests/visual/baseline/codex-bosses-tab.png` (T2.12)
- `tests/visual/baseline/codex-detail-race.png` (T2.12)
- `tests/visual/baseline/codex-detail-boss.png` (T2.12)

Baselines for squads NOT containing the named race / fighting the
named boss must NOT change (regression contract). If they do, Identity
Layer is leaking — flag as bug.

### 7.5 Test coverage requirements

Per CLAUDE.md §3.5:

- **Smoke**: 1 smoke test per race flavor (5) + 1 per boss mechanic
  (5+) = ≥10 new smokes by end of Phase 2.
- **Unit**: math purity tests for each effect's mechanical contribution
  (e.g., Pirate `goldBonus(pirateCount, cellsCleared) = 5 × pirateCount
  × cellsCleared` is a pure function — unit test it).
- **Visual**: 14 new baselines listed above.
- **Manual**: Tester must run end-to-end battle for each race × each
  chapter-finale boss matchup (5 × 5 = 25 matchup smokes) after T2.11
  closes.

---

## 8. Sacred cow safety audit

| Sacred system (CLAUDE.md ref) | Modified? | Notes |
|-------------------------------|-----------|-------|
| Combo crit formula (§2.1) | NO | Sun Cascade adds to dominantCount input pre-formula, same pattern as cascade |
| Element synergy 2x/3x/5x (§2.1) | NO | Identity Layer is parallel to synergy |
| RACE_SYNERGY tier values (§2.1) | NO | All tier 2/3/5 desc strings + numeric values byte-perfect |
| TIER_COSTS_V18 (§2.1) | NO | Not touched |
| HERO_ULT_COST_BY_NEWROLE (§2.1) | NO | Encore Echo grants charge but does not change cost |
| TTK formula (§2.1) | NO | Not touched |
| MAX_HP = 100 (§2.1) | NO | Not touched |
| V_HAPTICS table (§2.2) | NO | All effects use existing `clear` haptic; no new keys |
| vPlayCritFlash 180+440ms (§2.2) | NO | Not touched |
| 5-beat boss death (§2.2) | NO | Not touched |
| Particle line clear pattern (§2.2) | EXTENDED, not modified | Re-uses `vPlayLineClearBurst` cap of 32; new layers run alongside |
| NARRATOR_LINES (§2.3) | NO | New lines drafted per §2.3 voice rules; if any line collides, ESCALATE |
| Chronicler dialog (§2.3) | NO | New Codex copy in Chronicler voice, but no existing strings edited |
| Boss names / element subtitles (§2.3) | NO | Re-used read-only |
| GEM_PACKS prices (§2.4) | NO | Not touched |
| First Purchase Bonus (§2.4) | NO | Not touched |
| Battle Pass tier formula (§2.4) | NO | Not touched |
| Tower retry gem ladder (§2.4) | NO | Not touched |
| 3-min Tower TTK (§2.4) | NO | Not touched |
| 4-channel damage system (§2.5) | NO | Identity Layer does not write to damage channels |
| Stagger Loop / Recovery (§2.5) | NO | Read-only for Bloodtide Pulse trigger |
| HERO_TIER_ABILITIES (§2.5) | NO | Not touched |
| BOSS_TTK_TARGETS (§2.5) | NO | Not touched |
| TOWER_LEADERBOARDS (§2.5) | NO | Not touched |
| TOWER_PACTS (§2.5) | NO | Not touched |
| Uroboros seasonal (§2.5) | EXTENDED, not modified | Identity hook reads recent-clear state; boss itself untouched |
| FTUE_BOSS_GUARANTEES (§2.5) | NO | Not touched |
| Chronicler narrator (§2.5) | EXTENDED | New lines must match voice; ESCALATE on uncertainty |
| PURE PATH leaderboard (§2.5) | NO | Not touched |
| Reactivity Events 22 handlers (§2.5) | NO | All 22 byte-perfect; new handlers added in `identity_*` namespace |
| PHASE_GATE_P1_TO_P2 = 0.70 (§2.5) | NO | Not touched |
| PHASE_GATE_P2_TO_P3 = 0.35 (§2.5) | NO | Not touched |
| REACTIVITY_TELEGRAPH_MS = 3000 (§2.5) | NO | Re-used for new identity telegraphs |
| REACTIVITY_BANNER_DURATION_MS = 1500 (§2.5) | NO | Re-used |
| PHOENIX_REVIVE_HP_PCT = 0.6 (§2.5) | NO | Ashen Reign layers on top, does not change |
| PHOENIX_IMMUNE_TURNS = 2 (§2.5) | NO | Not touched |
| BERSERKER_ENRAGE_HP_PCT = 0.5 (§2.5) | NO | Bloodtide Pulse is additive |
| BERSERKER_ENRAGE_MULT = 2.0 (§2.5) | NO | Not touched |
| ARMORED_SHIELD_COUNT = 2 (§2.5) | NO | Not touched |
| ARMORED_SHIELD_ABSORB = 0.3 (§2.5) | NO | Not touched |

**Result: 0 sacred-cow value modifications.** The Identity Layer is
purely additive. All extensions use the established
"add-new-handler-in-parallel" pattern from v2.1 P4.

---

## 9. Visual baseline impact (recap)

14 new visual regression baselines, all intentional, listed in §7.4.
Existing baselines must NOT change — if they do, Identity Layer is
leaking into matchups it shouldn't affect (regression).

---

## 10. Open questions for Roman

### O1 — RACE_SYNERGY entries for shark / crocodile / spark?

The 5 V18.8 NEW RACES (`pirate, skeleton, golem, lion, rock`) all have
RACE_SYNERGY tier entries in `src/data/races.js` (lines 100–159).
However, **shark / crocodile / spark** are referenced ONLY in
`RACE_TO_STIHIYA` (line 29, added in Phase D Race Launch Bundles on
2026-04-28) and have full `HERO_TIER_ABILITIES` entries in
`src/data/heroes.js` (lines 105–209) — but **no RACE_SYNERGY tier
block**.

Question: Should the Identity Layer also fill in RACE_SYNERGY tier 2/3/5
entries for shark / crocodile / spark? Or are those deferred to a
later phase / sprint?

**My recommendation:** Defer RACE_SYNERGY tiers for these 3 races to
post-Phase-2 (separate task). The Identity Layer should NOT modify
RACE_SYNERGY (sacred § 2.1). If shark / crocodile / spark need synergy
tiers, that is a separate sacred-cow-EXTENSION request requiring its
own ESC.

This means in Phase 2 the 5 races in scope have the following uneven
synergy support:
- pirate: RACE_SYNERGY ✓ + Identity Layer ✓
- rock: RACE_SYNERGY ✓ + Identity Layer ✓
- shark: RACE_SYNERGY ✗ + Identity Layer ✓
- crocodile: RACE_SYNERGY ✗ + Identity Layer ✓
- spark: RACE_SYNERGY ✗ + Identity Layer ✓

Acceptable for Phase 2, or block T2.03 / T2.05 / T2.06 until
synergy tiers exist?

### O2 — Narrator line approvals

The boss-reactive mechanics include 5+ new Darkest-Dungeon-voice
narrator lines (§3.1 "The ash remembers...", §3.2 "What you took,
the deep remembers...", §3.5 "Where you would not bloom, I will.",
§3.7 "The eye that sees itself sees you, too."). These are NEW text
content (not edits to existing NARRATOR_LINES), but per §2.3 the
voice is sacred.

Question: Should these lines route through CTO → Roman for tone
approval BEFORE Game Dev wires them, or is "Darkest-Dungeon-voice
compliance per Designer judgment" sufficient?

**My recommendation:** Game Dev implements with placeholder lines; CTO
+ Roman approve final lines in a separate copy-pass before T2.11
closes (parallel work).

### O3 — Sun Cascade scope

Sun Cascade (§2.5) is the most mechanically potent flavor — it modifies
the input to Combo Crit (sacred formula). Architecturally this is the
same pattern as existing cascade (cells get added to the cleared set
BEFORE the formula runs, not modifying the formula), but Combo Crit is
specifically called out as sacred in §2.1.

Question: Is "modify dominantCount before combo crit math runs" within
the sacred boundary, or does it cross the line?

**My recommendation:** Within the boundary — it's input modification,
not formula modification, same as existing cascade behavior. But this
is a JUDGMENT CALL that deserves explicit ROMAN sign-off because Sun
Cascade is the single highest-impact mechanic in the spec.

If Roman rejects: Spark's flavor changes to a pure-FX layer (gold
visual rays) with NO mechanical contribution, demoted to "pure
flavor" tier alongside Pirate / Rock / Crocodile.

### O4 — Audio asset budget

The Identity Layer needs 5 new SFX (coin, bite, cymbal, thunk, chime)
+ ambient fire roar for Ashen Reign. Most can re-use existing assets
at modified volume/pitch. But if Audio task surfaces that any sample
must be new, that's a small but non-zero asset spend.

Question: Is the audio team's budget for Phase 2 includes 5–6 new
samples, or should everything strictly re-use existing assets?

**My recommendation:** Re-use existing for MVP. Flag any
re-use-impossible cases to CTO for a separate asset-request task.

---

## 11. Acceptance criteria — design ready

- [x] 5 race flavors designed at full 10-field spec
- [x] 7 boss-reactive mechanics designed at full 8-field spec
  (5 required + 2 optional spotlights for Voidfang & Uroboros)
- [x] Codex screen spec (T2.12) with IA, screens, unlock model,
  persistence schema, aesthetic
- [x] Performance budgets explicit + measurable (layer-wide table)
- [x] Player perspective notes (newbie / mid / hardcore) per effect
  AND cross-cutting in §6
- [x] Implementation dependencies named (src/ files listed in §7)
- [x] Sacred cow safety audit (§8 — 0 modifications confirmed)
- [x] Visual baseline impact listed (§7.4 + §9 — 14 new baselines)
- [x] Open questions for Roman section (§10 — 4 questions: O1–O4)
- [x] No code written — design only
- [x] No sacred-cow values modified
- [x] No src/ touched

---

**Document version:** 1.1 — Roman ruling applied 2026-05-12
**Status:** APPROVED — T2.02 unblocked
**Maintainer:** Game Designer agent (T2.01) + CTO

> "Mechanics × race/boss identity." — Roman's audit phrase.
> The Identity Layer is how every fight remembers the race that
> fought it and every race remembers the boss it faced.

---

## 12. ROMAN RULING APPENDIX — ESC-02 resolved 2026-05-12

Roman authorized "merge and continue (on your recommendations if AAA+ game development)" — all 4 ESC-02 open questions approved per CTO recommendations.

| ID | Question | Ruling | Effect on Phase 2 |
|---|---|---|---|
| **O1** | RACE_SYNERGY tier entries for shark / crocodile / spark | ✅ **DEFER** to post-Phase-2 sacred-cow-EXTENSION task | Phase 2 ships with asymmetric synergy support (pirate+rock have RACE_SYNERGY+Identity ✓; shark/crocodile/spark have Identity only ✓). RACE_SYNERGY remains sacred-immutable in Phase 2. |
| **O2** | Narrator line approvals (4+ new Darkest-Dungeon-voice lines) | ✅ **PLACEHOLDER-FIRST.** Game Dev wires with Designer's draft strings; CTO + Roman do a copy-pass before T2.11 closes (parallel review track) | Implementation unblocked; final-line editorial review batched at end of Phase 2 |
| **O3** | Sun Cascade modifies `dominantCount` BEFORE sacred combo-crit formula (input-mutation, not formula-change) | ✅ **WITHIN BOUNDARY.** Input modification (same architectural pattern as cascade), not formula modification. Capped at +1, gated 2-solar-cell minimum, not stacking | T2.06 (Spark Sun Cascade) proceeds as designed; **Bug Tester must run 5×5 matchup matrix (25 smokes) with explicit Spark balance check before T2.06 closes** |
| **O4** | Audio asset budget for 5–6 new SFX (coin / bite / cymbal / thunk / chime / fire roar) | ✅ **RE-USE-FIRST.** All Identity Layer SFX must re-use existing assets at modified volume/pitch. Flag re-use-impossible cases as separate asset-request tasks (not blocking T2.02–T2.11) | Audio mixer stays under 5MB working set; mobile audio budget preserved |

### Phase 2 implementation green-lit per ruling

- **T2.02** Pirate's Plunder — UNBLOCKED ✅
- **T2.03** Shark Feeding Frenzy — UNBLOCKED ✅
- **T2.04** Rock Encore Echo — UNBLOCKED ✅
- **T2.05** Crocodile Bedrock Bastion — UNBLOCKED ✅
- **T2.06** Spark Sun Cascade — UNBLOCKED ✅ with mandatory matchup matrix gate
- **T2.07–T2.11** Boss-reactive mechanics — UNBLOCKED ✅ (narrator placeholder-first)
- **T2.12** Codex screen — UNBLOCKED ✅ (gated by all triggers wired)

### Sacred cow status after ruling

Identity Layer remains **purely additive**. Roman's ruling does NOT change the 36-row sacred audit in §8 — 0 modifications. The O3 "within boundary" ruling confirms: input modification before sacred formula evaluation is established precedent (cascade) and not a sacred-cow change.

### Quality gates added by ruling

1. **T2.06 mandatory Bug Tester matchup matrix:** 5 races × 5 chapter-finale bosses = 25 smokes verifying no single Spark-pairing dominates. If any pairing exceeds expected TTK by >15%, demote Spark to pure-FX per §2.5 fallback path.
2. **T2.11 mandatory narrator copy-pass:** All Designer-drafted Darkest-Dungeon-voice lines reviewed by CTO + Roman before Phase 2 PR merges.
3. **Phase 2 closeout audit:** Bug Tester re-verifies 22 sacred Reactivity handlers byte-perfect; identity_* namespace stays cleanly separated.
