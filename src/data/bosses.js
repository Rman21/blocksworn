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

// 2026-05-12 — TASK-034 (T2.07): Identity Layer boss-archetype FX key map.
//
// Spec: docs/design/mechanics/identity-layer.md §3 (boss-reactive identity
// mechanics convention) — sibling to `RACE_IDENTITY_FX` in `src/data/races.js`.
// Maps each boss archetype to the boss-reactive identity FX key registered
// in `IDENTITY_BOSS_FX_KEYS` (`src/data/identity-layer.js`). Used by the
// boss-reactive handler in `src/core/reactivity-events.js` and (T2.12) the
// Codex screen to surface each archetype's identity mechanic.
//
// SIBLING export precedent — established by T2.02 RACE_IDENTITY_FX pattern
// (`src/data/races.js#212`). Sacred boss data (BOSS_TTK_TARGETS, archetype
// roster) lives elsewhere and is BYTE-PERFECT untouched by this addition.
// CLAUDE.md §2.5 (BOSS_TTK_TARGETS, PHOENIX_REVIVE_HP_PCT, PHOENIX_IMMUNE_TURNS,
// REACTIVITY_TELEGRAPH_MS, all 22 reactivity handlers) — 0 modifications.
//
// T2.07 ships only the phoenix entry (Ashen Reign). T2.08–T2.11 will append
// the other 6 boss-reactive entries per spec §3.2–§3.7 schedule (assassin /
// berserker / engineer / grovewarden / void / uroboros).
export const BOSS_IDENTITY_FX = Object.freeze({
  phoenix:    'phoenix_ashen_reign',
  // T2.08 — Lich Cursed Tiles (Assassin archetype, Ch1 Boss 5 CRYPT LICH +
  // Ch3 ARCHIVAL ETERNAL). Explicit Shark counter per spec §2.2 / §3.2.
  assassin:   'lich_cursed_tiles',
  // T2.09 — Berserker / Frenzy Bloodtide Pulse (Ch1 Boss 1 PYREDRAKE +
  // Ch2 Boss 8 URSARO). SAME identity hook for BOTH archetypes per spec
  // §3.3 field 1 ("both are 'build aggression over time' archetypes"):
  // every 3rd line clear in boss Active state → +5% next-attack damage
  // pulse, layered ON TOP of sacred BERSERKER_ENRAGE_MULT = 2.0.
  berserker:  'berserker_bloodtide',
  frenzy:     'berserker_bloodtide',
  // T2.10 — Engineer Lockdown Protocol (Engineer archetype, Ch2 Boss 7
  // GEARHEART + Ch5 Tower bosses). Anti-Tetris counter: 4-line crit clear
  // → 2×2 lockdown for 40 turns in the most-cleared corner. Layered ON
  // TOP of sacred `engineer_p1_p2` phase-gate lockdown (UNTOUCHED) via
  // parallel handler in `IDENTITY_BOSS_HANDLERS`.
  engineer:   'engineer_lockdown',
  // T2.11 — Grovewarden Root Surge (Bruiser archetype, Ch1 Boss 3
  // GROVEWARDEN + Tower bruisers). Sliding-window non-grove trigger: when
  // player's last 3 line clears were all NOT grove-dominant, boss reacts by
  // placing 3 root overlays on random empty cells (5-turn block + +10 gold
  // per cleared root via existing addGold cross-layer Pirate Plunder
  // integration). Layered ON TOP of sacred `bruiser_p1_p2` / `bruiser_p2_p3`
  // phase-gate handlers (UNTOUCHED) via parallel handler in
  // `IDENTITY_BOSS_HANDLERS`.
  bruiser:    'grovewarden_root_surge',
  // T2.11+: void / uroboros (optional spotlight, deferred per spec §7.1)
});
