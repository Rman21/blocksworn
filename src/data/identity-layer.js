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
