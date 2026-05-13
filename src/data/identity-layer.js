// 2026-05-12 — TASK-029 (T2.02): Identity Layer constants module.
//
// Spec: docs/design/mechanics/identity-layer.md §2 / §5 / §7.
// Phase 2 Identity Layer = per-line-clear "flavor" layer that fires every
// `clearLines(rows, cols)` resolve, layered ON TOP of (never modifying) the
// v2.1 P4 Reactivity Events handlers and the sacred combat math (CLAUDE.md
// §2.1–§2.5). This module is the SINGLE SOURCE OF TRUTH for layer-wide
// numeric constants; consumer modules (`src/feel/identity-fx.js`,
// `src/feel/particles.js`) import named exports — no magic numbers.
//
// Sacred safety:
//   - No V_HAPTICS keys defined here (re-use existing `clear` only).
//   - No combo crit / element synergy / RACE_SYNERGY values touched.
//   - All constants are ADDITIVE per spec §8 — zero modifications to the
//     36-row sacred audit table.
//
// T2.02 ships the Pirate's Plunder constants. T2.03–T2.06 will append
// Shark / Rock / Crocodile / Spark sections; T2.07–T2.11 boss-reactive
// constants. The IDENTITY_FX_KEYS enum + IDENTITY_FX_BUDGETS table are
// established here in T2.02 so the dispatcher and future tasks have a stable
// surface to extend.

// ─── Effect key enum (stable IDs, never re-numbered) ────────────────────
// Used by the dispatcher (`src/feel/identity-fx.js#dispatchIdentityFx`) to
// route to the right effect handler per race, AND by `src/data/races.js` as
// the value of the new optional `identity_fx_key` field per spec §7.2.
export const IDENTITY_FX_KEYS = Object.freeze({
  PIRATE_PLUNDER:      'pirate_plunder',
  SHARK_FRENZY:        'shark_frenzy',
  ROCK_ECHO:           'rock_echo',
  CROCODILE_BASTION:   'crocodile_bastion',
  SPARK_CASCADE:       'spark_cascade',
});

// ─── Boss-reactive identity FX key enum (sibling to IDENTITY_FX_KEYS) ──
// T2.07 adds the first boss-reactive identity mechanic — Phoenix Ashen Reign.
// T2.08–T2.11 will append entries for Lich Cursed Tiles / Berserker Bloodtide
// Pulse / Engineer Lockdown Protocol / Grovewarden Root Surge / Voidfang
// Shroud Pull / Uroboros Eternal Loop per spec §3.2–§3.7. Sibling enum keeps
// boss-side identity keys lexically separate from race-side identity keys so
// the codex / dispatcher / tooling can branch by namespace.
export const IDENTITY_BOSS_FX_KEYS = Object.freeze({
  PHOENIX_ASHEN_REIGN:   'phoenix_ashen_reign',
  // T2.08 — Lich Cursed Tiles (Assassin archetype, Shark-counter mechanism).
  LICH_CURSED_TILES:     'lich_cursed_tiles',
  // T2.09 — Berserker / Frenzy Bloodtide Pulse (every-3rd-clear tempo mech).
  // SAME identity key for BOTH `berserker` and `frenzy` archetypes (spec §3.3
  // field 1 — both are "build aggression over time" archetypes; same hook).
  BERSERKER_BLOODTIDE:   'berserker_bloodtide',
  // T2.10 — Engineer Lockdown Protocol (anti-Tetris 4-line crit counter,
  // spec §3.4). Layered on top of sacred `engineer_p1_p2` phase-gate
  // lockdown (40T, 4-cell — UNTOUCHED). On-crit handler ADDS a new 2×2
  // lockdown instance via the same `engineerLockedCells` state.
  ENGINEER_LOCKDOWN:     'engineer_lockdown',
  // T2.11 — Grovewarden Root Surge (Bruiser archetype, sliding-window
  // non-grove trigger, spec §3.5). FIFTH and FINAL boss-reactive mechanic.
  // 3 random empty cells gain "root" overlays that block placement for
  // 5 turns and grant +10 gold per cleared root (cross-layer Pirate Plunder
  // interaction).
  GROVEWARDEN_ROOT_SURGE: 'grovewarden_root_surge',
});

// ─── Per-effect performance budgets (spec §5) ───────────────────────────
// `wallTimeMs`            — per-fire wall-time ceiling (≤16ms frame budget).
// `maxConcurrentParticles` — DOM-node cap for the effect's particle pool.
// `decayMs`               — particle lifetime (spawn → cleanup).
// Layer-wide budget: ≤100 concurrent particles across all effects, ≤4ms/frame
// steady-state average (spec §5).
export const IDENTITY_FX_BUDGETS = Object.freeze({
  [IDENTITY_FX_KEYS.PIRATE_PLUNDER]:    Object.freeze({ wallTimeMs: 6,  maxConcurrentParticles: 32, decayMs: 1000 }),
  [IDENTITY_FX_KEYS.SHARK_FRENZY]:      Object.freeze({ wallTimeMs: 10, maxConcurrentParticles: 4,  decayMs: 500  }),
  [IDENTITY_FX_KEYS.ROCK_ECHO]:         Object.freeze({ wallTimeMs: 8,  maxConcurrentParticles: 4,  decayMs: 700  }),
  [IDENTITY_FX_KEYS.CROCODILE_BASTION]: Object.freeze({ wallTimeMs: 8,  maxConcurrentParticles: 16, decayMs: 600  }),
  [IDENTITY_FX_KEYS.SPARK_CASCADE]:     Object.freeze({ wallTimeMs: 10, maxConcurrentParticles: 16, decayMs: 400  }),
});

// ─── Per-effect performance budgets — boss-reactive (spec §3 + §5) ──────
// Same shape as IDENTITY_FX_BUDGETS but `initialMs` / `steadyStateMs` /
// `duration` reflect the boss-reactive grammar (trigger event → 5s window →
// release). `decayMs` is the fade-out tail. Sibling to IDENTITY_FX_BUDGETS
// so the codex / tooling can read both budgets uniformly.
//
// Phoenix Ashen Reign (spec §3.1 field 7):
//   - Initial trigger ≤16ms (one DOM overlay + heat distortion CSS filter)
//   - Steady-state during 5s window: ≤2ms per frame (CSS animation, no JS)
//   - Decay: 200ms fade-out
//   - Duration: 5000ms exact (hard spec value)
export const IDENTITY_BOSS_FX_BUDGETS = Object.freeze({
  [IDENTITY_BOSS_FX_KEYS.PHOENIX_ASHEN_REIGN]: Object.freeze({
    initialMs:     16,
    steadyStateMs: 2,
    decayMs:       200,
    duration:      5000,
  }),
  // Lich Cursed Tiles (spec §3.2 field 7):
  //   - Initial trigger ≤16ms (3 skull overlay activations + telegraph banner)
  //     = telegraph ≤8ms + 3 overlays @ ≤2ms each (≤6ms) = ≤14ms wall-time, 16ms ceiling
  //   - Per-turn tick ≤3ms (3 cursed cells × 1 HP damage application, clamp at 0)
  //   - Decay: 300ms fade-out when a curse auto-clears at expiration turn
  //   - Duration: 3 turns (player-paced — NOT a wall-clock window). Distinct
  //     from Phoenix's 5000ms wall-clock duration; documented as the literal
  //     string '3 turns' so codex / tooling can branch by namespace.
  [IDENTITY_BOSS_FX_KEYS.LICH_CURSED_TILES]: Object.freeze({
    initialMs:     16,
    steadyStateMs: 3,
    decayMs:       300,
    duration:      '3 turns',
  }),
  // Berserker Bloodtide Pulse (spec §3.3 field 7):
  //   - Initial trigger ≤10ms (one DOM pulse element + CSS sweep)
  //   - Steady-state: 0ms — Bloodtide is a ONE-SHOT BUFF, not a windowed state.
  //     After the pulse VFX completes, the +5% damage bonus is held in a pure
  //     integer flag (_bloodtidePulsePending) consumed on the next boss attack.
  //     Zero per-frame work between activation and consumption.
  //   - Decay: 200ms pulse decay (CSS-only fade after the 600ms sweep)
  //   - Duration: 'one-shot' — pulse buff consumed on next boss attack; not
  //     a wall-clock window like Phoenix's 5000ms or Lich's 3-turn windows.
  [IDENTITY_BOSS_FX_KEYS.BERSERKER_BLOODTIDE]: Object.freeze({
    initialMs:     10,
    steadyStateMs: 0,
    decayMs:       200,
    duration:      'one-shot',
  }),
  // Engineer Lockdown Protocol (spec §3.4 field 7):
  //   - Initial trigger ≤10ms (4-cell placement ≤4ms + ratchet ≤6ms)
  //   - Per-turn tick ≤1ms — existing engineer state machinery
  //     (ui/archetype-ticks.js) decrements `engineerLockedCells` Map per
  //     turn; T2.10 module-side mirror state is lifecycle accounting only.
  //   - Decay: 600ms ratchet animation; lockdown itself persists 40 turns.
  //   - Duration: '40 turns' — player-paced, NOT wall-clock (spec §3.4
  //     field 4). Documented as the literal string so codex/tooling can
  //     branch by namespace (matches the T2.08 '3 turns' precedent).
  [IDENTITY_BOSS_FX_KEYS.ENGINEER_LOCKDOWN]: Object.freeze({
    initialMs:     10,
    steadyStateMs: 1,
    decayMs:       600,
    duration:      '40 turns',
  }),
  // Grovewarden Root Surge (spec §3.5 field 7):
  //   - Initial trigger ≤14ms (3 root overlay activations + bloom particle).
  //     = 3 overlays @ ≤2ms each (≤6ms) + 1 bloom particle ≤8ms = ≤14ms.
  //   - Per-turn tick ≤1ms (≤3 root cells × lifecycle check, integer math).
  //   - Decay: 300ms fade-out when a root auto-clears at 5-turn timeout OR
  //     when player clears it during the window.
  //   - Duration: 5 turns (player-paced — NOT a wall-clock window).
  //     Documented as literal string '5 turns' so codex / tooling can branch
  //     by namespace (mirrors T2.08 '3 turns' + T2.10 '40 turns' precedent).
  [IDENTITY_BOSS_FX_KEYS.GROVEWARDEN_ROOT_SURGE]: Object.freeze({
    initialMs:     14,
    steadyStateMs: 1,
    decayMs:       300,
    duration:      '5 turns',
  }),
});

// ─── Pirate's Plunder constants (spec §2.1) ─────────────────────────────
// Mechanical contract:
//   gold = PIRATE_PLUNDER_GOLD_PER_CELL
//          × cellsCleared
//          × min(pirateCount, PIRATE_PLUNDER_MAX_PIRATES)
// Spec §2.1 field 4: "+5 gold per cleared cell × min(pirateCount, 5)".
// At max squad (5 pirates) and max quad-line clear (40 cells), this yields
// 1000 gold — large but not power-creep (gold ≠ damage; pure econ).
//
// Capped against the sacred squad-of-5 ceiling.
// Decay 1000ms matches spec §2.1 field 9.
export const PIRATE_PLUNDER_GOLD_PER_CELL  = 5;
export const PIRATE_PLUNDER_MAX_PIRATES    = 5;
export const PIRATE_PLUNDER_MAX_COINS      = 32; // DOM-pool ceiling per spec §2.1 + §5
export const PIRATE_PLUNDER_COIN_DECAY_MS  = 1000;

// ─── Shark Feeding Frenzy constants (spec §2.2) ─────────────────────────
// Mechanical contract:
//   bitesPerLine = min(1, floor(sharkCount / 2))   [per-line cap, spec field 4]
//   extraCellsCleared ≤ SHARK_FRENZY_MAX_EXTRA_CELLS  [hard cap, spec field 9]
//
// Trigger gate (spec field 10):
//   - Dominant element of ≥1 cleared row/col is `tide`, OR
//   - ≥ SHARK_FRENZY_MIN_SHARKS_FOR_2X_TRIGGER alive shark heroes in squad.
//   (Two paths: dominant-tide allows a single-shark squad to enter the
//    "smaller effect" branch — visual fires, bite count is 0; 2+ sharks
//    always enter the full effect branch with 1 bite/line.)
//
// Cell-state predicates (spec field 7): locked / electrified / cursed
// cells are immune. Shark bite is absorbed visually but the cell is NOT
// added to the cleared set. This is the boss-counter mechanism — Shark
// just respects existing grid.js cell-state predicates, no new boss code.
//
// Combo-crit interaction (spec field 8): extra-bitten cells DO count
// toward `dominantCount` (input modification path — same architectural
// pattern as cascade; sacred combo crit formula UNTOUCHED). They do NOT
// count as a new line for cascade purposes (no infinite chain risk).
//
// Performance budget (spec field 9): ≤10ms wall-time per fire, max 4
// teeth-arc SVG elements concurrent (one per cleared line, max 4 lines
// per `clearLines` call by board geometry), 500ms decay.
export const SHARK_FRENZY_MIN_SHARKS_FOR_2X_TRIGGER = 2;
export const SHARK_FRENZY_MAX_EXTRA_CELLS           = 4;  // HARD CAP per spec §2.2 field 9
export const SHARK_FRENZY_BITE_DECAY_MS             = 500;
export const SHARK_FRENZY_BITE_SVG_PER_LINE         = 1;
export const SHARK_FRENZY_DOMINANT_ELEMENT          = 'tide';

// ─── Rock Encore Echo constants (spec §2.3) ─────────────────────────────
// Mechanical contract:
//   echoChargeToAdd = min(umbraDominantLineCount, ROCK_ECHO_MAX_CHARGE_PER_FIRE)
//   ultCharges.umbra = min(threshold, ultCharges.umbra + echoChargeToAdd)
//
// Per spec §2.3 field 4: "+1 ULT charge to the umbra ULT meter (only) per
// cleared line where dominant element is `umbra`. Capped at +4 per fire
// (one per line, max 4 lines from a quad-clear). No charge awarded if
// dominant is anything other than umbra."
//
// Trigger gate (spec §2.3 field 10):
//   - At least one cleared row/col has dominant element === 'umbra'
//     (via `getDominantElementCount` from `src/core/grid.js`), AND
//   - ≥1 rock hero alive in squad.
//   Else silent no-op (no DOM, no allocation, no log).
//
// Sacred-cow safety (CLAUDE.md §2.1 — HERO_ULT_COST_BY_NEWROLE is sacred):
//   - This is a CHARGE addition, NOT a threshold modification. The ULT
//     threshold (mage=100 etc.) is UNTOUCHED. We add to `ultCharges.umbra`
//     and clamp to `currentUltThreshold.umbra` / `ULT_THRESHOLD.umbra` —
//     never overshoot, never modify the threshold itself.
//   - The ULT-fire pipeline (player-initiated trigger at threshold-ready
//     state) is left alone. Encore Echo writes charge; the pipeline reads.
//
// Stacking (spec §2.3 field 8):
//   - With RACE_SYNERGY rock tier 3 `ENCORE` (first 🌑ULT ×2): both fire,
//     compound synergy intentional. RACE_SYNERGY UNTOUCHED.
//   - With Element Synergy umbra 3x/5x (`-4 ULT, +20% passive`, `-6 ULT,
//     +50% damage, 30% start`): independent layers; Identity Layer adds
//     raw charge, Element Synergy reduces threshold. No conflict.
//   - With Combo Crit: no interaction (charge ≠ damage).
//
// Performance budget (spec §2.3 field 9): ≤8ms wall-time per fire, max 4
// echo ghost elements simultaneously (one per cleared line, max 4 lines
// per `clearLines` call by board geometry), 700ms decay.
export const ROCK_ECHO_CHARGE_PER_LINE       = 1;     // +1 charge per umbra-dominant line
export const ROCK_ECHO_MAX_CHARGE_PER_FIRE   = 4;     // HARD CAP per spec §2.3 field 4
export const ROCK_ECHO_GHOST_DECAY_MS        = 700;
export const ROCK_ECHO_DELAY_MS              = 200;   // delay between clear and ghost flash
export const ROCK_ECHO_DOMINANT_ELEMENT      = 'umbra';
export const ROCK_ECHO_ULT_METER             = 'umbra'; // which ULT meter to write to

// ─── Crocodile Bedrock Bastion constants (spec §2.4) ────────────────────
// Mechanical contract:
//   _crocFragmentBank += groveCellsCleared              // per-fire accumulation
//   { shieldsToGrant, newBank } =
//     computeShieldsGrantable(_crocFragmentBank, CROCODILE_BASTION_FRAGMENTS_PER_SHIELD)
//   shieldCount = clampShieldsToSquadMax(shieldCount, shieldsToGrant, sacredCap)
//   _crocFragmentBank = newBank   // remainder persists ACROSS fires in a battle
//
// Per spec §2.4 field 4: "Per cleared grove cell, accumulate 1 fragment on
// a counter (_crocFragmentBank). Every 5 fragments grants 1 shield to the
// squad (or refreshes 1 expired shield) up to the squad's existing max
// shield cap from RACE_SYNERGY golem tier 2/3/5 maxShieldBonus (sacred).
// If max-shield cap reached, surplus fragments are discarded (no overflow
// exploit)."
//
// Trigger gate (spec §2.4 field 10):
//   - Every `clearLines(rows, cols)` resolve, AND
//   - rows∪cols contain ≥1 grove cell, AND
//   - ≥1 crocodile hero alive.
//   Else silent no-op (no DOM, no allocation, no log).
//
// Cross-fire fragment persistence (spec §2.4 field 4):
//   `_crocFragmentBank` accumulates ACROSS multiple line clears in a single
//   battle. Reset only on battle end / new battle start via the exported
//   `resetCrocFragmentBank()` function. This is the unique invariant for
//   Crocodile: the other 4 race flavors are per-fire stateless.
//
// Sacred-cow safety (CLAUDE.md §2.1 — RACE_SYNERGY.golem maxShieldBonus is sacred):
//   - This is a SHIELD addition, NOT a max-cap modification. The sacred
//     `RACE_SYNERGY.golem.<tier>.maxShieldBonus` values (1/2/2 for tiers
//     2/3/5) are UNTOUCHED — read-only sacred source for the clamp.
//   - The shield cap is `MAX_SHIELD + 2 + maxShieldBonus` (legacy line 715 +
//     heroes.js:715). Bedrock Bastion writes shields up to (never beyond)
//     this cap; the existing shield-decay / damage-absorb pipeline owns the
//     subtract path.
//   - SQUAD shields (defensive) — NOT boss armored shields (offensive,
//     ARMORED_SHIELD_COUNT = 2 / ARMORED_SHIELD_ABSORB = 0.3 are sacred §2.5
//     and UNTOUCHED).
//
// Stacking (spec §2.4 field 8):
//   - With RACE_SYNERGY golem (grove-themed shield-centric): both fire.
//     Golem gives static `+shields` and `+maxShield`; Crocodile gives
//     dynamic per-cell accrual. Mixed golem+crocodile grove squad reaches
//     max shield faster but NEVER exceeds sacred max-shield-bonus values.
//   - With Combo Crit: no interaction (shields ≠ damage).
//   - With Pirate Plunder in mixed squad: independent (gold + shields are
//     separate reward channels).
//
// Performance budget (spec §2.4 field 9): ≤8ms wall-time per fire, max 16
// fragment particles simultaneously (~4 per cleared grove cell × ~4 cells
// average), 600ms decay each. Counter math is pure integer addition —
// negligible CPU.
export const CROCODILE_BASTION_FRAGMENTS_PER_SHIELD  = 5;
export const CROCODILE_BASTION_MAX_FRAGMENT_PARTICLES = 16; // HARD CAP per spec §2.4 field 9
export const CROCODILE_BASTION_FRAGMENT_DECAY_MS      = 600;
export const CROCODILE_BASTION_GROVE_ELEMENT          = 'grove';
export const CROCODILE_BASTION_TARGET_HERO_INDEX      = 0;   // leftmost crocodile

// ─── Spark Sun Cascade constants (spec §2.5) ────────────────────────────
// Mechanical contract (THE highest-stakes sacred-cow-adjacent path in Phase 2):
//   IF (sparkCount >= 1 AND solarCellsInClear >= SPARK_CASCADE_MIN_SOLAR_CELLS
//       AND SPARK_CASCADE_ENABLED):
//     ctx._dominantCountModifier = (ctx._dominantCountModifier || 0)
//                                 + SPARK_CASCADE_MAX_DOMINANT_BOOST
//   ELSE silent no-op.
//
// The sacred combo crit formula `total_dmg × (1 + dominantCount × combo × 10%)`
// (CLAUDE.md §2.1 row 1, legacy line 63664: `critMult = 1 + domCount * count *
// CRIT_MULT_K`) is UNTOUCHED. Sun Cascade modifies the INPUT (dominantCount)
// before the formula evaluates — same architectural pattern as existing
// cascade behavior (cells get added to the input set BEFORE evaluation).
//
// Roman ruling ESC-02 O3: "WITHIN BOUNDARY. Input modification (same
// architectural pattern as cascade), not formula modification. Capped at +1,
// gated 2-solar-cell minimum, not stacking."
//
// CRITICAL HARD CAPS (sacred — DO NOT increase without escalation):
//   - SPARK_CASCADE_MIN_SOLAR_CELLS = 2 — gate threshold, prevents single-solar
//     promotion from being a tempo cheese strategy
//   - SPARK_CASCADE_MAX_DOMINANT_BOOST = 1 — NOT stacking; multiple sparks or
//     multiple lines never produce more than +1 per fire
//
// SPARK_CASCADE_ENABLED is the T2.B fallback toggle. If the 5×5 matchup
// matrix (Bug Tester, ESC-02 ruling-added quality gate #1) surfaces >15% TTK
// deviation on any Spark pairing, the toggle flips to `false` and Spark
// becomes pure-FX (visual rays only, no mechanical contribution). Single-flip
// demotion to fallback — code path unchanged.
//
// Trigger gate (spec §2.5 field 10):
//   - Every `clearLines(rows, cols)` resolve, AND
//   - rows∪cols contain ≥ SPARK_CASCADE_MIN_SOLAR_CELLS solar cells, AND
//   - ≥1 spark hero alive.
//   Else silent no-op (no DOM, no allocation, no modifier write, no log).
//
// Cell-state predicates: none — Sun Cascade is gated purely on solar-cell
// count in the cleared rows∪cols. Visual rays are pure VFX (do NOT clear
// touched cells — that would be a Shark Frenzy mechanic, not Spark).
//
// Combo-crit interaction (spec §2.5 field 4): THIS is the interaction.
// Sun Cascade is the ONLY race flavor that mutates `dominantCount` directly.
// Implementation pattern (T2.03 ctx side-channel):
//   1. fxSparkLineClear computes `wouldFire` from gate
//   2. If wouldFire AND SPARK_CASCADE_ENABLED:
//        ctx._dominantCountModifier = (ctx._dominantCountModifier || 0) + 1
//   3. Legacy bridge (T2.B, deferred) reads ctx._dominantCountModifier and
//      threads it into legacy's `domCount + modifier` BEFORE
//      `critMult = 1 + (domCount + modifier) * count * CRIT_MULT_K`.
//   Formula is BYTE-PERFECT. Only the input value is mutated.
//
// Stacking (spec §2.5 field 8):
//   - With Combo Crit: input modification (this IS the interaction).
//     A solar-heavy clear that would have been combo=3 becomes effective
//     dominantCount + 1, which the sacred multiplier reads as a stronger
//     crit. Sacred formula unchanged.
//   - With Element Synergy solar 2x/3x/5x: independent — synergy reduces
//     ULT cost; Sun Cascade boosts crit input. No conflict.
//   - With RACE_SYNERGY.lion.5.bonusDmg.solar (+3/cell, SACRED): both fire,
//     independent reward channels. Sacred lion value UNTOUCHED.
//   - With Phoenix Ashen Reign (5s solar-only window): CHOREOGRAPHED — the
//     boss reaction makes the board ember-heavy after the window, which
//     makes solar-cell clears RARER, balancing Sun Cascade. Phoenix Ashen
//     Reign INTENTIONALLY turns Sun Cascade UP, not down (per spec §2.5
//     field 7).
//
// Performance budget (spec §2.5 field 9): ≤10ms wall-time per fire, max 16
// ray VFX simultaneously (one per cleared solar cell, capped by board
// geometry at ~16 per quad-clear), 400ms decay.
export const SPARK_CASCADE_MIN_SOLAR_CELLS     = 2;     // HARD gate — sacred (Roman ruling ESC-02 O3)
export const SPARK_CASCADE_MAX_DOMINANT_BOOST  = 1;     // HARD CAP — NOT stacking (sacred ESC-02 O3)
export const SPARK_CASCADE_MAX_RAY_PARTICLES   = 16;    // DOM pool ceiling per spec §2.5 + §5
export const SPARK_CASCADE_RAY_DECAY_MS        = 400;
export const SPARK_CASCADE_DOMINANT_ELEMENT    = 'solar';
// T2.B fallback toggle — flip to `false` if 5×5 matchup matrix surfaces
// >15% TTK deviation on any Spark pairing (per ESC-02 O3 ruling fallback
// path). When false, fxSparkLineClear fires VISUAL rays only — no
// `_dominantCountModifier` write. Single-flip demotion to pure-FX.
export const SPARK_CASCADE_ENABLED             = true;

// ─── Phoenix Ashen Reign constants (spec §3.1) ──────────────────────────
// FIRST boss-reactive identity mechanic — T2.07.
//
// Mechanical contract (spec §3.1 fields 3-4):
//   - Trigger: Phoenix revive event fires (sacred PHOENIX_REVIVE_HP_PCT = 0.6
//     + PHOENIX_IMMUNE_TURNS = 2 path UNTOUCHED — Ashen Reign LAYERS ON TOP).
//   - For exactly ASHEN_REIGN_DURATION_MS (5000ms) after revive completes:
//     * Board renders ASHEN_REIGN_FLAME_BORDER_WIDTH_PX (180px) pulsing
//       red-orange gradient overlay on grid container.
//     * `pieceCanBePlaced(piece)` returns false unless
//       `piece.element === ASHEN_REIGN_REQUIRED_ELEMENT` ('ember').
//     * HUD shows ASHEN_REIGN_HUD_COUNTDOWN_TEXT ("EMBER ONLY — 5s").
//     * Pieces drawn during the window are NOT re-rolled.
//     * Window times out harmlessly at duration end (no penalty, just
//       a tempo loss if no placeable ember exists).
//   - Telegraph: ASHEN_REIGN_TELEGRAPH_MS (3000ms) wind-up banner —
//     RE-USES the sacred `REACTIVITY_TELEGRAPH_MS` constant value
//     (CLAUDE.md §2.5, `src/core/bosses.js:265`). Both are 3000.
//   - Decay: ASHEN_REIGN_DECAY_MS (200ms) fade-out.
//
// Sacred-cow safety (CLAUDE.md §2.5 + spec §3.1 field 8):
//   - PHOENIX_REVIVE_HP_PCT = 0.6 UNTOUCHED — Ashen Reign reads the existing
//     revive event; never modifies the 60% threshold or any heal math.
//   - PHOENIX_IMMUNE_TURNS = 2 UNTOUCHED — same.
//   - REACTIVITY_TELEGRAPH_MS = 3000 UNTOUCHED — Ashen Reign RE-USES the
//     constant by importing it from `src/core/bosses.js`. The invariant
//     `ASHEN_REIGN_TELEGRAPH_MS === REACTIVITY_TELEGRAPH_MS === 3000` is
//     unit-tested.
//   - All 22 v2.1 P4 reactivity handlers UNTOUCHED — Ashen Reign adds a
//     NEW handler in `src/core/reactivity-events.js` under namespace
//     `identity_phoenix_revive`, separate from the sacred 22.
//
// Performance budget (spec §3.1 field 7 / §5):
//   - Initial trigger ≤ASHEN_REIGN_INITIAL_BUDGET_MS (16ms) — one DOM
//     overlay flag + one HUD element flag, both CSS-animation driven.
//   - Steady-state during 5s window ≤ASHEN_REIGN_STEADY_STATE_BUDGET_MS
//     (2ms per frame) — PURE CSS animation, zero JS per-frame work.
//   - Single `setTimeout(release, 5000)` fires once at window end —
//     not a per-frame timer.
//
// Player counterplay (spec §3.1 field 5): Hold an ember piece in queue for
// the revive moment (boss-intel-overlay should hint this); run ember-friendly
// squad (Pirate, Orc); accept the tempo loss and chain Sun Cascade afterward.
//
// Architectural pattern (spec §1 hard rule 1): Identity Layer EXTENDS, never
// MODIFIES, v2.1 P4. The sacred `phoenix_p1_p2` handler (legacy revive heal)
// stays byte-perfect; the new `identity_phoenix_revive` handler runs IN
// PARALLEL via a separate window-bridge call from the legacy
// `maybePhoenixRevive` site. NO modification to the sacred 22 REACTIVITY_HANDLERS
// entries.
export const ASHEN_REIGN_DURATION_MS               = 5000;
export const ASHEN_REIGN_FLAME_BORDER_WIDTH_PX     = 180;
export const ASHEN_REIGN_DECAY_MS                  = 200;
// Telegraph duration. Spec §3.1 field 8 + spec §3 "Convention": RE-USES
// the sacred REACTIVITY_TELEGRAPH_MS = 3000 value. The unit-tested invariant
// `ASHEN_REIGN_TELEGRAPH_MS === REACTIVITY_TELEGRAPH_MS` ensures both stay
// in lock-step. Documented as 3000 here (single source of truth in this
// module per CLAUDE.md §7.8) AND imported separately in tests for the
// equality assertion (sacred re-use audit).
export const ASHEN_REIGN_TELEGRAPH_MS              = 3000;
export const ASHEN_REIGN_REQUIRED_ELEMENT          = 'ember';
export const ASHEN_REIGN_HUD_COUNTDOWN_TEXT        = 'EMBER ONLY — 5s';
// Performance ceilings (spec §3.1 field 7) — mirrored from IDENTITY_BOSS_FX_BUDGETS
// for direct named import in fx + tests. The budget object remains the
// single-source-of-truth aggregate; these named exports avoid the indirection
// when a single number is needed inline.
export const ASHEN_REIGN_INITIAL_BUDGET_MS         = 16;
export const ASHEN_REIGN_STEADY_STATE_BUDGET_MS    = 2;
// Spec §3.1 field 6 narrator line. Wired by Phase 2.5 polish patch via the
// same isolated-constant + ctx.narratorApi pattern T2.11 Root Surge
// established. Lives HERE (in identity-layer.js), NOT in the sacred
// NARRATOR_LINES table (`src/feel/narrator-lines.js`) — that table stays
// byte-perfect per ESC-02 O2 ruling.
// FINAL COPY: pending Roman approval (Phase 2.5 review).
export const ASHEN_REIGN_NARRATOR_LINE_PLACEHOLDER = 'The ash remembers. Strike only with the flame that birthed it.';

// ─── Lich Cursed Tiles constants (spec §3.2) ────────────────────────────
// SECOND boss-reactive identity mechanic — T2.08. Explicit Shark counter
// referenced in spec §2.2 — boss responds to ≥2-shark squads by cursing
// 3 random non-empty cells with a 1 HP/turn drip that auto-clears after
// 3 turns AND grants +20 ULT compensation on auto-clear (net-neutral if
// player waits it out, painful if player must clear pressure with sharks).
//
// Mechanical contract (spec §3.2 fields 3-4):
//   - Trigger: `clearLines` fires where the player's active squad has
//     ≥CURSED_TILES_TRIGGER_SHARK_THRESHOLD (2) sharks. Boss responds NEXT
//     turn (telegraph on player's end-of-turn, handler resolves at start
//     of player's next turn).
//   - For CURSED_TILES_COUNT (3) random non-empty cells on the board:
//     * Translucent purple skull overlay placed on each cell.
//     * Cells CANNOT be cleared for CURSED_TILES_TURNS_UNTIL_AUTO_CLEAR
//       (3) turns (act like soft-void cells; visually distinct purple).
//     * Inflict CURSED_TILES_HP_DAMAGE_PER_TURN (1) HP per cell per turn
//       they remain.
//   - Auto-clear after 3 turns AND grant CURSED_TILES_ULT_COMPENSATION
//     (+20) player ULT charge per expiring cell to compensate (net-neutral
//     over time if player waits it out).
//   - Telegraph: CURSED_TILES_TELEGRAPH_MS (3000ms) wind-up banner —
//     RE-USES the sacred `REACTIVITY_TELEGRAPH_MS` constant value
//     (CLAUDE.md §2.5, `src/core/bosses.js:265`). Both are 3000.
//   - Decay (skull fade): CURSED_TILES_SKULL_DECAY_MS (300ms) fade-out
//     animation when a curse auto-clears at its expiration turn.
//
// Sacred-cow safety (CLAUDE.md §2.5 + spec §3.2 field 8):
//   - All 22 v2.1 P4 reactivity handlers UNTOUCHED — Cursed Tiles adds a
//     NEW handler in `src/core/reactivity-events.js` under namespace
//     `identity_assassin_shark_counter`, separate from the sacred 22 and
//     from the sacred `assassin_p1_p2` / `assassin_p2_p3` entries.
//   - REACTIVITY_TELEGRAPH_MS = 3000 UNTOUCHED — Cursed Tiles RE-USES the
//     constant by importing it from `src/core/bosses.js`. The invariant
//     `CURSED_TILES_TELEGRAPH_MS === REACTIVITY_TELEGRAPH_MS === 3000` is
//     unit-tested.
//   - HERO_ULT_COST_BY_NEWROLE thresholds (mage:100, warrior:80, hunter:120,
//     tank:80, captain:100) UNTOUCHED — the +20 ULT compensation is a
//     CHARGE addition, NOT a threshold modification. We add to the ULT
//     meter and clamp via Math.min(threshold, current + delta) (T2.04
//     `clampEncoreEchoCharge` pattern). The ULT-fire pipeline (player-
//     initiated trigger at threshold-ready state) is left alone.
//   - Phoenix Ashen Reign invariants from T2.07 (PHOENIX_REVIVE_HP_PCT,
//     PHOENIX_IMMUNE_TURNS, ASHEN_REIGN_DURATION_MS, etc.) UNTOUCHED —
//     Cursed Tiles adds alongside, never modifies.
//
// Performance budget (spec §3.2 field 7 / §5):
//   - Telegraph banner ≤CURSED_TILES_TELEGRAPH_BUDGET_MS (8ms) — re-use of
//     existing telegraph component, no new allocation.
//   - 3 cursed-cell overlay placements @ ≤2ms each = ≤6ms total
//     (CURSED_TILES_PER_OVERLAY_BUDGET_MS).
//   - Per-turn tick ≤CURSED_TILES_PER_TURN_TICK_BUDGET_MS (3ms) — 3 cells
//     × 1ms each for damage application + threshold-clamped ULT charge
//     write at expiration.
//   - Total per fire ≤CURSED_TILES_INITIAL_BUDGET_MS (16ms peak).
//   - Steady-state per turn ≤3ms (pure integer math + 3 DOM class swaps
//     when expiration fires; pure CSS animation otherwise).
//
// Player counterplay (spec §3.2 field 5): stop running 2+ sharks vs Lich;
// non-shark line clear adjacent to cursed cells; Crocodile Bedrock Bastion
// shields absorb the 1 HP/turn drip; wait out the 3 turns to claim the
// +20 ULT compensation.
//
// Architectural pattern (spec §1 hard rule 1): Identity Layer EXTENDS,
// never MODIFIES, v2.1 P4. The sacred `assassin_p1_p2` / `assassin_p2_p3`
// handlers (legacy stealth + backstab chain) stay byte-perfect; the new
// `identity_assassin_shark_counter` handler runs IN PARALLEL via the T2.07-
// established `IDENTITY_BOSS_HANDLERS` registry + `triggerIdentityBossEvent`
// dispatcher. NO modification to the sacred 22 REACTIVITY_HANDLERS entries.
export const CURSED_TILES_COUNT                       = 3;     // HARD spec value (spec §3.2 field 4)
export const CURSED_TILES_TURNS_UNTIL_AUTO_CLEAR      = 3;     // HARD spec value (spec §3.2 field 4)
export const CURSED_TILES_HP_DAMAGE_PER_TURN          = 1;     // 1 HP per cell per turn (spec §3.2 field 4)
export const CURSED_TILES_ULT_COMPENSATION            = 20;    // +20 ULT charge per expiring cursed cell (spec §3.2 field 4)
export const CURSED_TILES_TRIGGER_SHARK_THRESHOLD     = 2;     // ≥2 sharks in squad to trigger (spec §3.2 field 3)
// Telegraph duration. Spec §3.2 field 7 + spec §3 "Convention": RE-USES
// the sacred REACTIVITY_TELEGRAPH_MS = 3000 value. The unit-tested invariant
// `CURSED_TILES_TELEGRAPH_MS === REACTIVITY_TELEGRAPH_MS` ensures both stay
// in lock-step. Documented as 3000 here (single source of truth in this
// module per CLAUDE.md §7.8) AND imported separately in tests for the
// equality assertion (sacred re-use audit).
export const CURSED_TILES_TELEGRAPH_MS                = 3000;
export const CURSED_TILES_SKULL_DECAY_MS              = 300;   // fade-out when a curse auto-clears
export const CURSED_TILES_SKULL_COLOR                 = '#7e3fb8'; // translucent purple — same palette as Rock echo ghost (T2.04 RE-USE-FIRST per ESC-02 O4)
// Performance ceilings (spec §3.2 field 7) — mirrored from IDENTITY_BOSS_FX_BUDGETS
// for direct named import in fx + tests. The budget object remains the
// single-source-of-truth aggregate; these named exports avoid the indirection
// when a single number is needed inline.
export const CURSED_TILES_INITIAL_BUDGET_MS           = 16;
export const CURSED_TILES_TELEGRAPH_BUDGET_MS         = 8;
export const CURSED_TILES_PER_OVERLAY_BUDGET_MS       = 2;
export const CURSED_TILES_PER_TURN_TICK_BUDGET_MS     = 3;
// Spec §3.2 field 6 narrator line. Wired by Phase 2.5 polish patch via the
// same isolated-constant + ctx.narratorApi pattern T2.11 Root Surge
// established. Lives HERE (in identity-layer.js), NOT in the sacred
// NARRATOR_LINES table per ESC-02 O2 ruling.
// FINAL COPY: pending Roman approval (Phase 2.5 review).
export const CURSED_TILES_NARRATOR_LINE_PLACEHOLDER   = 'What you took, the deep remembers.';

// ─── Berserker Bloodtide Pulse constants (spec §3.3) ─────────────────────
// THIRD boss-reactive identity mechanic — T2.09. Tempo / aggression-over-time
// mechanic shared by BOTH `berserker` (Ch1 Boss 1 PYREDRAKE) and `frenzy`
// (Ch2 Boss 8 URSARO) archetypes per spec §3.3 field 1. Every 3rd line clear
// the player resolves while the boss is in Active state (NOT Stagger, NOT
// Recovery — gated via `getBossState() === BOSS_STATE_ACTIVE` from
// `src/core/stagger-loop.js`, READ-ONLY) triggers a red pulse VFX from the
// boss portrait toward the grid. On arrival, the boss's next attack deals
// +5% damage (one-shot buff, consumed on next attack — NOT stacking with
// itself).
//
// Mechanical contract (spec §3.3 fields 3-4):
//   - Trigger gate: clearCount > 0 && clearCount % BLOODTIDE_PULSE_INTERVAL
//     (3) === 0 && bossState === BLOODTIDE_REQUIRED_STAGGER_STATE ('active').
//     During Stagger / Recovery the gate fails silently (no pulse, no
//     count reset — clearCount keeps incrementing; pulse fires on the first
//     qualifying 3rd-clear after returning to Active).
//   - Damage layering: the +BLOODTIDE_PULSE_DAMAGE_BONUS (0.05 = +5%) bonus
//     is applied AS A FINAL MULTIPLIER on the enrage-multiplied base damage:
//       finalDamage = baseDamage × BERSERKER_ENRAGE_MULT (2.0) × (1 + pulseBonus)
//                   = baseDamage × 2.0 × 1.05
//                   = baseDamage × 2.1
//     NEVER `baseDamage × (BERSERKER_ENRAGE_MULT + pulseBonus)` (which would
//     mutate the sacred enrage multiplier). The pulse multiplies the result;
//     it does NOT modify sacred BERSERKER_ENRAGE_MULT = 2.0.
//   - One-shot buff: each pulse marks _bloodtidePulsePending = true. The
//     consumeBloodtidePulse() call (invoked by battle pipeline before a boss
//     attack) returns 0.05 once and resets the flag to false. Subsequent
//     consumes return 0 until a new pulse fires.
//   - Caps: BLOODTIDE_PULSE_MAX_BONUS = 0.25 (+25%) covers the case where the
//     `computeBloodtideDamageBonus(pulsesPending)` helper is called with a
//     hypothetical multi-pulse scalar. In practice only one pulse is live at
//     a time (one-shot semantics), so this cap is defensive against future
//     extensions that might stack pulses.
//
// Sacred-cow safety (CLAUDE.md §2.5 + spec §3.3 field 8):
//   - BERSERKER_ENRAGE_HP_PCT = 0.5 UNTOUCHED (sacred §2.5).
//   - BERSERKER_ENRAGE_MULT = 2.0 UNTOUCHED (sacred §2.5). Pulse multiplies
//     the enrage-multiplied result; never modifies the multiplier itself.
//   - Stagger Loop state machine UNTOUCHED — `getBossState()` is called
//     READ-ONLY; no transition function invoked. STAGGER_DURATION_TURNS = 4
//     and RECOVERY_DURATION_TURNS = 2 byte-perfect.
//   - 22 v2.1 P4 reactivity handlers UNTOUCHED — Bloodtide adds a NEW
//     handler under namespace `identity_berserker_frenzy_pulse` in
//     `src/core/reactivity-events.js`, separate from the sacred 22 and
//     from the sacred `berserker_p1_p2` / `berserker_p2_p3` /
//     `frenzy_p1_p2` / `frenzy_p2_p3` entries.
//   - REACTIVITY_TELEGRAPH_MS = 3000 UNTOUCHED — Bloodtide does NOT use the
//     wind-up telegraph (it's reactive to clear-count tempo, not phase-gate),
//     so no telegraph constant is duplicated. If a future spec change wires
//     a telegraph, it MUST re-use REACTIVITY_TELEGRAPH_MS by import (same
//     T2.07/T2.08 invariant pattern).
//   - Phoenix / Lich invariants UNTOUCHED — Bloodtide adds alongside.
//
// Performance budget (spec §3.3 field 7):
//   - Gate check: O(1) pure integer math (count % 3 === 0 && stagger === 'active').
//   - Pulse VFX: ≤BLOODTIDE_PULSE_VFX_DURATION_MS (600ms) CSS sweep.
//   - Initial trigger: ≤10ms (1 DOM pulse element activation + CSS swap).
//   - Damage modifier: pure integer math at consume time.
//
// Player counterplay (spec §3.3 field 5):
//   - Time Tank ULT (AEGIS) during pulse telegraphs.
//   - Burst-clear in groups of 2 to avoid the 3rd-clear trigger.
//   - Crocodile Bedrock Bastion shields pre-absorb pulse damage.
//
// Architectural pattern (spec §1 hard rule 1): Identity Layer EXTENDS, never
// MODIFIES, v2.1 P4. The sacred `berserker_p1_p2` / `berserker_p2_p3` /
// `frenzy_p1_p2` / `frenzy_p2_p3` handlers stay byte-perfect; the new
// `identity_berserker_frenzy_pulse` handler runs IN PARALLEL via the T2.07-
// established `IDENTITY_BOSS_HANDLERS` registry + `triggerIdentityBossEvent`
// dispatcher. NO modification to the sacred 22 REACTIVITY_HANDLERS entries.
export const BLOODTIDE_PULSE_INTERVAL                 = 3;     // every 3rd clear (spec §3.3 field 3)
export const BLOODTIDE_PULSE_DAMAGE_BONUS             = 0.05;  // +5% next-attack damage (spec §3.3 field 4)
export const BLOODTIDE_PULSE_MAX_BONUS                = 0.25;  // HARD CAP — +25% from 5 pulses (spec §3.3 field 4)
export const BLOODTIDE_PULSE_VFX_DURATION_MS          = 600;   // red pulse sweep duration
export const BLOODTIDE_PULSE_DECAY_MS                 = 200;   // pulse fade-out tail
// Required Stagger Loop state for Bloodtide to fire. Spec §3.3 field 3:
// "while boss is in Active state (NOT Stagger, NOT Recovery)". Matches the
// `BOSS_STATE_ACTIVE = 'active'` constant exported from
// `src/core/stagger-loop.js:210` — READ-ONLY; the constant itself is sacred.
export const BLOODTIDE_REQUIRED_STAGGER_STATE         = 'active';
export const BLOODTIDE_PULSE_COLOR                    = '#E53935';  // red — distinct from purple curse / cyan bite
// Performance ceilings (spec §3.3 field 7) — mirrored from IDENTITY_BOSS_FX_BUDGETS
// for direct named import in fx + tests.
export const BLOODTIDE_INITIAL_BUDGET_MS              = 10;

// ─── Engineer Lockdown Protocol constants (spec §3.4) ───────────────────
// FOURTH boss-reactive identity mechanic — T2.10. The "anti-Tetris" mechanic
// — punishes the maximalist Tetris-style 4-line crit clear by locking down
// a 2×2 square of cells in the corner of the grid that received the most
// cleared cells in the player's last fire.
//
// Mechanical contract (spec §3.4 fields 3-4):
//   - Trigger: Player completes a 4-line crit clear (the "Tetris" max).
//     `isTetrisCrit(linesCleared, comboTriggered)` returns true ONLY when
//     `linesCleared === ENGINEER_LOCKDOWN_TRIGGER_LINES (4)` AND
//     `comboTriggered === true`. 3-line clears + crit do NOT fire. 4-line
//     non-crit (impossible by definition but defensive) does NOT fire.
//   - Boss reaction (same-turn — NO 3000ms telegraph per spec §3.4 field 6:
//     "Triumphant TETRIS celebration banner IMMEDIATELY followed by clanking
//     metal lockdown" — celebration IS the reaction signal).
//   - For 1 random 2×2 square (ENGINEER_LOCKDOWN_CELL_COUNT = 4 cells) at
//     the corner of the grid that received the most cleared cells in the
//     last fire (`pickMostClearedCorner`):
//     * Lockdown cells get the existing engineer-lockdown CSS class
//       (`.grid .cell.cell--engineer-welded` — RE-USED, not duplicated).
//     * Cells CANNOT accept pieces for ENGINEER_LOCKDOWN_TURNS (40) turns.
//       Matches the sacred `engineer_p1_p2` phase-gate handler duration
//       byte-perfect — these two handlers populate the SAME underlying
//       lockdown state (the legacy `engineerLockedCells` Map) but via
//       different entry points (phase-gate vs on-crit).
//   - Player counterplay (spec §3.4 field 5): avoid Tetris-stacking by
//     clearing 2-3 lines; Shark Feeding Frenzy adjacent clears can offset
//     locked cells; Pirate ember spawn-weight keeps non-locked corners
//     viable.
//   - Memorable moment (spec §3.4 field 6): Triumphant TETRIS celebration
//     banner (ENGINEER_LOCKDOWN_CELEBRATION_MS = 400ms) IMMEDIATELY
//     followed by clanking metal ratchet (ENGINEER_LOCKDOWN_RATCHET_DURATION_MS
//     = 600ms) on the 4 newly-locked cells.
//   - Decay: lockdown removed at turn (placedTurn + 40), CSS class stripped
//     from the 4 cells.
//
// Sacred-cow safety (CLAUDE.md §2.1 + §2.5 + spec §3.4 field 8):
//   - All 22 v2.1 P4 reactivity handlers UNTOUCHED — Engineer Lockdown
//     Protocol adds a NEW handler in `src/core/reactivity-events.js` under
//     namespace `identity_engineer_tetris_counter`, separate from the
//     sacred `engineer_p1_p2` / `engineer_p2_p3` entries.
//   - **`engineer_p1_p2` handler BYTE-PERFECT** — sacred 40T lockdown
//     duration UNTOUCHED. T2.10 RE-USES the same `engineerLockedCells` Map
//     state and the same `.cell--engineer-welded` CSS class — the on-crit
//     handler ADDS a new lockdown instance to the existing state, never
//     modifying the phase-gate handler's behavior.
//   - **40T lockdown duration sacred** — ENGINEER_LOCKDOWN_TURNS = 40
//     matches the sacred `engineer_p1_p2` handler's `engineerLockedCells.set(k, 40)`
//     byte-perfect. Documented as the canonical source in this constant.
//   - **4-cell 2×2 lockdown shape sacred** — ENGINEER_LOCKDOWN_CELL_COUNT = 4
//     matches the sacred `engineer_p1_p2` handler's 4-cell loop byte-perfect.
//     T2.10 places a contiguous 2×2 square (vs the phase-gate handler's
//     random 4-cell scatter); both consume the same `engineerLockedCells`
//     state predicate from grid.js.
//   - **Combo Crit formula UNTOUCHED** — the 4-line crit trigger reads the
//     post-formula result (lines cleared + comboTriggered flag) AFTER the
//     sacred combo crit damage resolves. T2.10 never feeds combo crit input.
//   - **NARRATOR_LINES untouched** — TETRIS banner copy ("TETRIS!" celebration
//     + "LOCKDOWN" reaction) goes through existing `flashStateBanner` UI
//     surface, NOT NARRATOR_LINES infrastructure.
//   - **No new V_HAPTICS keys** — uses inline `vibrate(...)` like other
//     boss-reactive handlers.
//   - **REACTIVITY_TELEGRAPH_MS = 3000 UNTOUCHED** — Engineer Lockdown
//     Protocol does NOT use the wind-up telegraph (action-based trigger,
//     same precedent as T2.09 Bloodtide Pulse per REPORT-27). The TETRIS
//     celebration banner IS the reaction signal per spec §3.4 field 6.
//   - **Phoenix / Lich / Berserker invariants UNTOUCHED** — Engineer Lockdown
//     Protocol adds alongside; T2.07/T2.08/T2.09 module state independent.
//
// Performance budget (spec §3.4 field 7):
//   - 4-cell lockdown placement ≤ENGINEER_LOCKDOWN_PLACEMENT_BUDGET_MS (4ms)
//     — pure integer math (`compute2x2LockdownCells` returns 4 cell coords)
//     + 4 CSS class swaps on grid cell DOM elements.
//   - Ratchet/clanking animation ≤ENGINEER_LOCKDOWN_RATCHET_BUDGET_MS (6ms)
//     — single CSS keyframe overlay, no rAF, no per-frame DOM writes.
//   - Total per-fire wall-time ≤ENGINEER_LOCKDOWN_INITIAL_BUDGET_MS (10ms).
//   - Per-turn tick ≤ENGINEER_LOCKDOWN_PER_TURN_TICK_BUDGET_MS (1ms) —
//     existing engineer state machinery (`ui/archetype-ticks.js`) already
//     decrements `engineerLockedCells` per turn; T2.10 ADDS lockdown
//     instances to the same Map (when CSS class state needs T2.B bridge
//     wiring) but does NOT pay tick cost. Module-side mirror state
//     (`_engineerLockdowns` array) is maintained for testability + lifecycle
//     accounting in headless tests; the live runtime path defers to the
//     existing tick.
//
// Architectural pattern (spec §1 hard rule 1 + REPORT-27 anti-precedent):
//   - Identity Layer EXTENDS, never MODIFIES, v2.1 P4. The sacred
//     `engineer_p1_p2` / `engineer_p2_p3` handlers stay byte-perfect; the
//     new `identity_engineer_tetris_counter` handler runs IN PARALLEL via
//     the T2.07-established `IDENTITY_BOSS_HANDLERS` registry +
//     `triggerIdentityBossEvent` dispatcher.
//   - Action-based trigger (no telegraph) — same architectural shape as
//     T2.09 Bloodtide Pulse (count-based trigger, no telegraph). The
//     `triggerIdentityBossEvent` dispatcher will still wrap the handler
//     in its 3000ms wind-up by default; T2.B legacy bridge will skip the
//     dispatcher and call the fx directly to satisfy the spec §3.4 field 6
//     "IMMEDIATELY followed" requirement. Both code paths are exposed.
export const ENGINEER_LOCKDOWN_TURNS                  = 40;    // HARD spec — MATCHES sacred engineer_p1_p2 duration byte-perfect (CLAUDE.md §2.5)
export const ENGINEER_LOCKDOWN_CELL_COUNT             = 4;     // HARD spec — 2×2 square (spec §3.4 field 4)
export const ENGINEER_LOCKDOWN_TRIGGER_LINES          = 4;     // HARD spec — Tetris crit threshold (spec §3.4 field 3)
export const ENGINEER_LOCKDOWN_RATCHET_DURATION_MS    = 600;   // mechanical ratchet animation duration (spec §3.4 field 6)
export const ENGINEER_LOCKDOWN_CELEBRATION_MS         = 400;   // TETRIS celebration banner duration (spec §3.4 field 6)
export const ENGINEER_LOCKDOWN_COLOR                  = '#B87333';  // copper/bronze — MATCHES sacred engineer banner color byte-perfect (reactivity-events.js engineer_p1_p2 banner '#B87333')
// Performance ceilings (spec §3.4 field 7) — mirrored from IDENTITY_BOSS_FX_BUDGETS
// for direct named import in fx + tests.
export const ENGINEER_LOCKDOWN_INITIAL_BUDGET_MS      = 10;
export const ENGINEER_LOCKDOWN_PLACEMENT_BUDGET_MS    = 4;
export const ENGINEER_LOCKDOWN_RATCHET_BUDGET_MS      = 6;
export const ENGINEER_LOCKDOWN_PER_TURN_TICK_BUDGET_MS = 1;

// ─── Grovewarden Root Surge constants (spec §3.5) ───────────────────────
// FIFTH and FINAL boss-reactive identity mechanic — T2.11. Sliding-window
// non-grove trigger: when the player's last 3 line clears were all NOT
// grove-dominant (boss is "patient"; if you ignore its element, it acts),
// the Grovewarden boss reacts by placing 3 "root" overlays on random empty
// cells. Roots block placement for 5 turns. Each root cleared during the
// 5-turn window grants +10 gold via the existing addGold legacy
// infrastructure (cross-layer Pirate Plunder interaction per spec §3.5
// field 4). Roots auto-clear at the 5-turn timeout with no penalty.
//
// Mechanical contract (spec §3.5 fields 3-4):
//   - Trigger: Player's last ROOT_SURGE_TRIGGER_NON_GROVE_COUNT (3) line
//     clears were all NOT grove-dominant. Tracked via a circular buffer of
//     size 3 (_grovewardenRecentClears in identity-fx.js) that records the
//     dominant element of each clear. Gate is true iff buffer.length === 3
//     AND every entry !== ROOT_SURGE_GROVE_ELEMENT ('grove').
//   - Boss reaction: pick ROOT_SURGE_CELL_COUNT (3) random EMPTY cells on
//     the board (vs T2.08's "non-empty cells" pattern — roots grow on
//     empty space). Place mossy green SVG overlay on each.
//   - During the ROOT_SURGE_TURNS_UNTIL_AUTO_CLEAR (5)-turn window:
//     * Rooted cells BLOCK placement (T2.B bridge wires `isCellRooted`
//       predicate into legacy `pieceCanBePlaced`).
//     * When player CLEARS a rooted cell (via `onRootCellCleared`), grant
//       ROOT_SURGE_GOLD_PER_CLEAR (10) gold via existing `addGold` path.
//       Independent of Pirate Plunder's +5g/cell × pirateCount — no
//       double-count (rooted cell clear is a distinct event from a normal
//       line-clear cell).
//   - Auto-clear at 5-turn timeout: roots removed silently (no damage, no
//     compensation). The 5-turn block is the cost; the gold is the
//     opportunity.
//
// Sacred-cow safety (CLAUDE.md §2.1 + §2.5 + spec §3.5 field 8):
//   - **Element Synergy values UNTOUCHED** — especially grove 3x (−4 grove
//     ULT + +20% passive dmg) per spec §2.5 / CLAUDE.md §2.1. Root Surge
//     does NOT modify the synergy table; it modifies BOARD STATE only.
//   - **RACE_SYNERGY.troll.* UNTOUCHED** (grove-themed sacred tier kit:
//     hp 2/2/3, dmgMult 0/0.10/0.15, regrowth/stoneblood/mossArmor/heartwood).
//   - **RACE_SYNERGY.golem.* UNTOUCHED** (grove + shield sacred tier kit:
//     maxShieldBonus 1/2/2 from T2.05 invariant).
//   - **All 22 v2.1 P4 reactivity handlers UNTOUCHED** — Root Surge adds a
//     NEW handler in `src/core/reactivity-events.js` under namespace
//     `identity_bruiser_grove_surge`, separate from the sacred 22 and
//     from the sacred `bruiser_p1_p2` / `bruiser_p2_p3` entries.
//   - **NARRATOR_LINES sacred table UNTOUCHED** — the new narrator line
//     "Where you would not bloom, I will." lives in this module as
//     ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER (an isolated string constant per
//     ESC-02 O2 ruling). Roman's copy-pass at Phase 2 PR merge will either
//     approve as-is or replace; the sacred NARRATOR_LINES infrastructure
//     stays byte-perfect regardless.
//   - **Chronicler dialog UNTOUCHED** — Root Surge banner uses
//     `flashStateBanner` UI surface only.
//   - **REACTIVITY_TELEGRAPH_MS = 3000 UNTOUCHED** — Root Surge uses the
//     telegraph→execute pattern via the T2.07-established dispatcher; the
//     constant is RE-USED (read, never written).
//   - **HERO_ULT_COST_BY_NEWROLE UNTOUCHED** — Root Surge does not write
//     to ULT charges (unlike T2.08 Lich Cursed Tiles' +20 compensation).
//   - **V_HAPTICS UNTOUCHED** — uses inline `vibrate(...)` like other
//     boss-reactive handlers.
//   - **Phoenix / Lich / Berserker / Engineer invariants UNTOUCHED** —
//     T2.07–T2.10 module state independent.
//   - **Stagger Loop UNTOUCHED** — T2.09 invariant maintained.
//   - **Combo Crit formula UNTOUCHED** — Root Surge never feeds combo crit
//     input. It only writes to board state + gold.
//
// Performance budget (spec §3.5 field 7):
//   - 3 cell overlays ≤ROOT_SURGE_PER_OVERLAY_BUDGET_MS × 3 (6ms total).
//   - Per-turn tick handled by existing per-turn flow ≤1ms — re-uses T2.08
//     per-turn lifecycle primitive pattern.
//   - 1 mossy bloom particle per overlay ≤8ms.
//   - Total per-fire ≤ROOT_SURGE_INITIAL_BUDGET_MS (14ms peak).
//
// Player counterplay (spec §3.5 field 5):
//   - Run grove squad (Troll/Golem/Crocodile) → grove clears keep the
//     sliding-window buffer mixed, preventing surge trigger.
//   - Accept temporary block, deliberately farm +10 gold per cleared root
//     for econ runs (cross-layer Pirate Plunder synergy).
//   - Element Synergy 3x grove (sacred −4 grove ULT + +20% passive dmg)
//     — Grovewarden is intentionally STRONG-VS-GROVE, the design tension
//     is "play your boss's element."
//
// Architectural pattern (spec §1 hard rule 1):
//   - Identity Layer EXTENDS, never MODIFIES, v2.1 P4. The sacred
//     `bruiser_p1_p2` / `bruiser_p2_p3` handlers stay byte-perfect; the
//     new `identity_bruiser_grove_surge` handler runs IN PARALLEL via the
//     T2.07-established `IDENTITY_BOSS_HANDLERS` registry +
//     `triggerIdentityBossEvent` dispatcher.
//   - **NEW sliding-window primitive** — circular buffer of size 3 tracks
//     the dominant element of the player's last 3 line clears. New trigger
//     archetype alongside:
//       * T2.07 phase-gate trigger (Phoenix revive)
//       * T2.08 condition + per-turn-tick (Lich shark gate + 3T lifecycle)
//       * T2.09 count-based trigger (every 3rd clear + Stagger Loop state)
//       * T2.10 action-based trigger (4-line crit detection)
//       * T2.11 sliding-window trigger (last 3 clears all non-grove) ← NEW
//   - **Cross-layer Pirate Plunder integration** — FIRST live cross-layer
//     interaction in Phase 2. Root cleared by player → +10 gold via
//     existing `addGold` API (same path T2.02 Pirate's Plunder uses). No
//     double-count: the rooted cell clear is a DISTINCT event from a
//     regular line-clear cell; Pirate Plunder fires on `clearLines` rows∪cols,
//     Root Surge gold fires on `onRootCellCleared(row, col)` event.
export const ROOT_SURGE_CELL_COUNT                  = 3;   // HARD spec — 3 root overlays per fire (spec §3.5 field 4)
export const ROOT_SURGE_TURNS_UNTIL_AUTO_CLEAR      = 5;   // HARD spec — 5-turn block + opportunity window (spec §3.5 field 4)
export const ROOT_SURGE_GOLD_PER_CLEAR              = 10;  // HARD spec — +10 gold per cleared rooted cell (spec §3.5 field 4, cross-layer Pirate Plunder)
export const ROOT_SURGE_TRIGGER_NON_GROVE_COUNT     = 3;   // HARD spec — last 3 clears all non-grove (spec §3.5 field 3, sliding-window size)
export const ROOT_SURGE_GROVE_ELEMENT               = 'grove';  // sacred element name (matches RACE_TO_STIHIYA + grove RACE_SYNERGY tier kit)
// Telegraph duration. Spec §3.5 + spec §3 "Convention": RE-USES the sacred
// REACTIVITY_TELEGRAPH_MS = 3000 value. The unit-tested invariant
// `ROOT_SURGE_TELEGRAPH_MS === REACTIVITY_TELEGRAPH_MS` ensures both stay
// in lock-step. Documented as 3000 here (single source of truth in this
// module per CLAUDE.md §7.8) AND imported separately in tests for the
// equality assertion (sacred re-use audit).
export const ROOT_SURGE_TELEGRAPH_MS                = 3000;
export const ROOT_SURGE_OVERLAY_DECAY_MS            = 300;  // fade-out when root auto-clears or cleared by player
export const ROOT_SURGE_OVERLAY_COLOR               = '#2D8659';  // mossy green — distinct from purple curse (Lich) / cyan bite (Shark) / red pulse (Berserker) / copper lockdown (Engineer) / orange flame (Phoenix); matches grove RACE_SYNERGY element color family
// PLACEHOLDER narrator line per ESC-02 O2 ruling. Designer-drafted Darkest-
// Dungeon-voice line. Lives in this isolated constant (NOT in the sacred
// NARRATOR_LINES table) so the sacred infrastructure stays byte-perfect.
// FINAL COPY: pending Roman approval at Phase 2 PR merge.
export const ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER   = 'Where you would not bloom, I will.';
// Performance ceilings (spec §3.5 field 7) — mirrored from IDENTITY_BOSS_FX_BUDGETS
// for direct named import in fx + tests. The budget object remains the
// single-source-of-truth aggregate; these named exports avoid the indirection
// when a single number is needed inline.
export const ROOT_SURGE_INITIAL_BUDGET_MS           = 14;
export const ROOT_SURGE_PER_OVERLAY_BUDGET_MS       = 2;
export const ROOT_SURGE_BLOOM_BUDGET_MS             = 8;
export const ROOT_SURGE_PER_TURN_TICK_BUDGET_MS     = 1;

// ─── Codex screen constants (T2.12) ─────────────────────────────────────
// Spec: docs/design/mechanics/identity-layer.md §4 (Codex screen design).
// Codex is the aggregation surface for the Identity Layer. All numeric
// thresholds + storage keys live here (single source of truth per CLAUDE.md
// §7.8 — no magic numbers in logic).
//
// Sacred safety (spec §4.10):
//   - Codex state writes ONLY to localStorage[CODEX_LOCALSTORAGE_KEY].
//   - Codex NEVER mutates game state (heroes / bosses / save / sacred tables).
//   - Pure additive — zero modifications to the 36-row sacred audit table.
//
// CODEX_LOCALSTORAGE_KEY is namespaced under `blocksworn_codex_state` per
// spec §4.9. Distinct from `blocksworn_progress` / `blocksworn_save` so
// Codex state lives in its own isolated slot; sacred save data UNTOUCHED.
//
// CODEX_RACE_MASTERY_THRESHOLD (25) is the trigger count required to mark
// a race as Mastered (spec §4.5). Reading: "saw the Identity flavor fire
// AT LEAST 25 times". For bosses, Mastered = defeated at least once
// (CODEX_BOSS_MASTERY_DEFEATS = 1).
//
// CODEX_FCP_BUDGET_MS (300) is the page render budget per spec §4.9 — the
// performance contract verified by smoke test.
//
// CODEX_SCHEMA_VERSION = 1 — first Codex schema. Bumping triggers a
// defensive defaults reset in getCodexState (forward-compat with future
// schema migrations; mirrors the migrateBareStringKeys precedent).
export const CODEX_LOCALSTORAGE_KEY           = 'blocksworn_codex_state';
export const CODEX_RACE_MASTERY_THRESHOLD     = 25;
export const CODEX_BOSS_MASTERY_DEFEATS       = 1;
export const CODEX_FCP_BUDGET_MS              = 300;
export const CODEX_SCHEMA_VERSION             = 1;

// Three unlock states per spec §4.5. Frozen enum — never re-numbered.
export const CODEX_STATE = Object.freeze({
  LOCKED:      'locked',
  ENCOUNTERED: 'encountered',
  MASTERED:    'mastered',
});

// Tabs in info architecture (spec §4.2). Ordered: Races / Bosses / Moments.
export const CODEX_TABS = Object.freeze(['races', 'bosses', 'moments']);

// Default tab opened on first nav per spec §4.2.
export const CODEX_DEFAULT_TAB = 'races';
