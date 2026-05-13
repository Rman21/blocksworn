// 2026-05-13 — TASK-058 (T3.14): Tower seasonal infrastructure config.
//
// Spec: docs/design/endgame-social.md §6 (Tower seasonal)
//       + §15 ESC-03 Q4 ruling — 13-week Tower seasons + 1-week Adventures
//         rotation + Battle Pass cadence matches Tower.
//       + ADR-003 — strict no-P2W; Battle Pass tier rewards cosmetic-only.
//
// Sacred-cow safety (CLAUDE.md §2):
//   - Battle Pass formula `500 + (tier-1) × 150` BYTE-PERFECT (sacred §2.4).
//   - TOWER_PACTS_BASE (30) + TOWER_PACTS_MYTHIC (15) BYTE-PERFECT (sacred §2.5).
//     Seasonal pact registry is a SEPARATE additive surface — sacred base
//     + mythic registries are read-only.
//   - Uroboros boss spec untouched (sacred §2.5). Variant rotation is a
//     metadata layer — boss stats / TTK targets / phase mechanics unchanged.
//   - PURE PATH F2P-only leaderboard sacred (§2.5). Season wipes honor it.
//   - GEM_PACKS ladder, First Purchase Bonus, Tower retry untouched.

// ──────────────────────────────────────────────────────────────────────────
// Season cadence — ESC-03 Q4 ruling.
// ──────────────────────────────────────────────────────────────────────────

/** Tower season length in weeks — 13 weeks (~1 quarter, Marvel Snap precedent). */
export const TOWER_SEASON_WEEKS = 13;

/** Tower season length in milliseconds. Used for season-end scheduling. */
export const TOWER_SEASON_DURATION_MS = TOWER_SEASON_WEEKS * 7 * 24 * 60 * 60 * 1000;

/** Adventures rotation cadence — 1 week per ESC-03 Q4 (Adventures is a
 *  sub-loop within Tower season). */
export const ADVENTURES_ROTATION_WEEKS = 1;

/** Battle Pass cadence MATCHES Tower season per ESC-03 Q4 (13 weeks). */
export const BATTLE_PASS_DURATION_MS = TOWER_SEASON_DURATION_MS;

// ──────────────────────────────────────────────────────────────────────────
// Sacred Battle Pass formula — READ-ONLY accessor + invariant.
// ──────────────────────────────────────────────────────────────────────────

/** Battle Pass tier XP formula per CLAUDE.md §2.4 sacred:
 *  `xp_for_tier(N) = 500 + (N - 1) × 150`
 *
 *  Tier 1 = 500 xp; tier 2 = 650 xp; ... tier 50 = 7850 xp.
 *  Total xp for tier 50 = sum(500 + (k-1)×150 for k=1..50) = 207,500.
 *
 *  T3.14 READS this formula via computeBattlePassTierXp(); it NEVER
 *  modifies the formula. Test invariant pins the coefficients. */
export const BATTLE_PASS_BASE_XP = 500;
export const BATTLE_PASS_PER_TIER_XP = 150;
export const BATTLE_PASS_MAX_TIER = 50;

// ──────────────────────────────────────────────────────────────────────────
// Uroboros variant rotation — seasonal metadata layer.
// ──────────────────────────────────────────────────────────────────────────
//
// Sacred Uroboros boss (CLAUDE.md §2.5) has fixed stats, TTK targets, phase
// mechanics. Per spec §6.1, seasonal rotation cycles through VARIANTS — a
// cosmetic metadata layer that does NOT modify the sacred core. Each
// variant is a frozen object pointing to:
//   - `displayName`     — variant name (e.g., "Cosmic Eye")
//   - `auraColor`       — UI accent (cosmetic)
//   - `narratorVariant` — Chronicler line variant key (cosmetic; refers to
//                          existing NARRATOR_LINES sacred entries OR
//                          isolated placeholders per ESC-02 O2)
//
// ADR-003: variants confer NO mechanical advantage. Damage / HP / TTK /
// phase gates unchanged across all variants.

export const UROBOROS_VARIANTS = Object.freeze([
  Object.freeze({
    id:               'cosmic_eye',
    displayName:      'Cosmic Eye',
    auraColor:        '#7e3fb8',          // purple — matches umbra palette
    narratorVariant:  'uroboros_base',    // existing sacred line
  }),
  Object.freeze({
    id:               'eternal_loop',
    displayName:      'Eternal Loop',
    auraColor:        '#FFD700',          // gold — solar palette
    narratorVariant:  'uroboros_eternal', // placeholder per ESC-02 O2 pattern
  }),
  Object.freeze({
    id:               'shrouded_serpent',
    displayName:      'Shrouded Serpent',
    auraColor:        '#2D8659',          // mossy green — grove palette
    narratorVariant:  'uroboros_shroud',  // placeholder per ESC-02 O2 pattern
  }),
  Object.freeze({
    id:               'crimson_devourer',
    displayName:      'Crimson Devourer',
    auraColor:        '#E53935',          // red — bloodtide palette
    narratorVariant:  'uroboros_crimson', // placeholder per ESC-02 O2 pattern
  }),
]);

/** Variant rotation period — every 1 season (~13 weeks) the Uroboros
 *  variant cycles to the next entry in UROBOROS_VARIANTS. After the last
 *  variant, cycles back to entry 0. */
export const UROBOROS_VARIANT_ROTATION_PERIOD_SEASONS = 1;

// ──────────────────────────────────────────────────────────────────────────
// Seasonal TOWER_PACTS — additive registry (does NOT modify sacred base).
// ──────────────────────────────────────────────────────────────────────────
//
// Sacred TOWER_PACTS_BASE (30 pacts) + TOWER_PACTS_MYTHIC (15 pacts) live
// in src/data/tower.js — READ-only. Per spec §6.2, seasonal rotation can
// ADD a small set of season-only pacts to the pool. These have the same
// shape (`{ rarity, name, description, effect }`) but live in a SEPARATE
// frozen registry. The pact dispatcher merges base + mythic + active
// seasonal at run-start time.
//
// ADR-003: seasonal pacts must NOT exceed sacred mythic-tier strength.
// Effects are similar in magnitude to existing rare/epic pacts.

export const SEASONAL_PACTS = Object.freeze({
  // Season 1 — "First Watch" (3 seasonal pacts).
  s1_cosmic_clarity: Object.freeze({
    rarity:      'rare',
    seasonal:    true,
    seasonId:    1,
    name:        'COSMIC CLARITY',
    description: 'First two pact picks per run reveal +1 extra candidate (4 instead of 3)',
    effect:      Object.freeze({ pact_candidates_bonus_count: 1, pact_candidates_bonus_picks: 2 }),
  }),
  s1_eternal_recall: Object.freeze({
    rarity:      'epic',
    seasonal:    true,
    seasonId:    1,
    name:        'ETERNAL RECALL',
    description: 'On stagger entry, replenish 1 hero ULT charge per surviving member',
    effect:      Object.freeze({ stagger_ult_replenish_per_member: 1 }),
  }),
  s1_serpent_blessing: Object.freeze({
    rarity:      'rare',
    seasonal:    true,
    seasonId:    1,
    name:        'SERPENT BLESSING',
    description: 'Umbra-dominant clears regenerate 1 shield (max-shield cap respected)',
    effect:      Object.freeze({ umbra_clear_shield_regen: 1 }),
  }),
});

// ──────────────────────────────────────────────────────────────────────────
// Season state defaults.
// ──────────────────────────────────────────────────────────────────────────

/** Default first-season id (incremented at each season rollover). */
export const SEASON_INITIAL_ID = 1;

/** Sentinel for "no active season yet" (pre-launch state). */
export const SEASON_PRE_LAUNCH = 0;
