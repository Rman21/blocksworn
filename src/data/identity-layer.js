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
