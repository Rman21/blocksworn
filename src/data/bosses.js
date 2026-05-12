// 2026-05-11 — TASK-008 (T1.07): boss-scaling constants relocated from legacy.
//
// Per-chapter boss rosters live in `./chapters.js` (the legacy `BOSSES` binding
// is a dynamic `let` reassigned by setChapter(n); not migrated — T1.10 owns it).
// What lives HERE is the TTK / DPS scaling math:
//
//   - BOSS_TTK_TARGETS         per role tier (tutorial → chapter_finale)
//   - TOWER_BOSS_TTK_TARGETS   per Tower archetype (bruiser, mirror, …)
//   - EXPECTED_DPS_BY_CHAPTER  squad-DPS reference used by HP formula
//   - TOWER_DPS_REFERENCE      single scalar for Tower DPS calibration
//
// Sacred per CLAUDE.md §2.1 + §2.5: `boss_hp = expected_squad_dps × target_ttk_seconds`.
// Don't touch values.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - BOSS_TTK_TARGETS         line 20251-20257
//   - EXPECTED_DPS_BY_CHAPTER  line 20262-20268
//   - TOWER_DPS_REFERENCE      line 20271
//   - TOWER_BOSS_TTK_TARGETS   line 49982-50001
//
// BOSS_ARCHETYPES + ARCHETYPE_MATCHUP are deferred to T1.10 — they're declared
// at top level (lines 20142, 20159) but then mutated by `Object.assign(...)`
// (lines 20179, 20199) with Ch3/4/5 entries, so pure relocation would lose
// the Cosmic Ascension archetypes. Same applies to BOSS_PHASES, EFFECT_HANDLERS,
// REACTIVITY_HANDLERS, BOSS_VOICES (function-bound, not pure data).

// 2026-05-02 — COMBAT v2.1 P4 §2: TTK targets per boss role tier.
export const BOSS_TTK_TARGETS = Object.freeze({
  tutorial:       240,    // Boss 1 — 4 minutes
  gatekeeper:     360,    // Bosses 2,3,6,7,11,12,16,17,21,22 — 6 minutes
  mid_act:        420,    // Bosses 4,8,9,13,14,18,19,23,24 — 7 minutes
  act_boss:       480,    // Bosses 5,10,15,20 — 8 minutes
  chapter_finale: 540,    // Boss 25 (Ch5 only) — 9 minutes
});

// 2026-05-02 — COMBAT v2.1 P4 §2: expected squad DPS per chapter.
// Calibrated assuming T0-T1 (Ch1) → T3+Mythic (Ch5) ascension curve.
// Includes Stagger window damage burst from Phase 2 + tier scaling from Phase 3.
export const EXPECTED_DPS_BY_CHAPTER = Object.freeze({
  1: 30,     // Ch1: starter T0-T1 squad, infrequent stagger
  2: 75,     // Ch2: T1-T2 squad, more frequent stagger
  3: 165,    // Ch3: T2 squad, regular stagger
  4: 320,    // Ch4: T2-T3 squad, mastery stagger
  5: 460,    // Ch5: T3+ squad with Mythic, high frequency stagger
});

// 2026-05-02 — COMBAT v2.1 P4 §2: tower DPS reference (separate from chapter scaling).
export const TOWER_DPS_REFERENCE = 280;

// 2026-05-03 — COMBAT v2.1 P9 §2: Tower-specific TTK targets per archetype.
export const TOWER_BOSS_TTK_TARGETS = Object.freeze({
  bruiser:                240,    // Tier 1 standard
  mirror:                 270,
  element_shifter:        300,
  darkness_pure:          240,
  armored_pure:           300,
  swarm:                  360,    // Tier 2
  puzzle:                 420,
  phoenix_extreme:        360,
  frost_pure:             360,
  earth_pure:             360,
  devourer:               480,    // Tier 3
  phase_shifter_extreme:  540,
  regent_extreme:         480,
  co_op_extreme:          540,
  choice_seasonal:        720,    // Mythic 12 min
  berserker_extreme:      300,    // Limited-time event
  multi_phase_special:    420,
  cosmic_revelation:      420,
});
