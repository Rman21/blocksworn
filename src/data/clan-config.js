// 2026-05-13 — TASK-050 (T3.02): Adventures backend — clan progression config.
//
// Spec: docs/design/endgame-social.md §2.4 (Persistent clan progression).
//       + §15 ESC-03 Q1 ruling — clan size 5–15 HARD CAP, no exceptions.
//       + ADR-003 — strict no-P2W; clan rewards COSMETIC-ONLY.
//
// Frozen registry of cosmetic-only clan-level unlocks. Per ADR-003 every entry
// here must be PURELY COSMETIC — no stat / damage / HP / win-rate / progression
// speed advantage. The mechanical "weekly contribution cap raise" at clan-level
// 3 and "1-week grace" at clan-level 6 referenced in spec §2.4 are deferred to
// T3.04 weekly-rotation logic (T3.02 is data-layer only); only cosmetics live
// in this file so the no-P2W invariant is statically verifiable.
//
// Sacred-cow safety:
//   - No NARRATOR_LINES additions.
//   - No V_HAPTICS keys.
//   - No combat / damage / TTK / Battle Pass / GEM_PACKS interaction.
//   - All entries are frozen objects — runtime cannot mutate them.

/** Cosmetic tier ladder — bronze < silver < gold < platinum < mythic.
 *  Maps to banner art variants surfaced in T3.03 UI. */
export const CLAN_COSMETIC_TIERS = Object.freeze([
  'bronze',
  'silver',
  'gold',
  'platinum',
  'mythic',
]);

/** Starting banner tier for a freshly-created clan. */
export const CLAN_DEFAULT_BANNER_TIER = 'bronze';

/**
 * Per-level cosmetic unlocks (spec §2.4 table, COSMETIC-ONLY subset).
 *
 * Each entry is an array of unlock descriptors, each with shape:
 *   { kind: 'banner'|'emblem'|'badge'|'motto', value: string }
 *
 * Every level transition awards exactly the unlocks at the new level.
 * Key levels chosen per spec §2.4: 1, 2, 4, 5, 7, 8, 10, 15, 20, 25.
 * The mechanical-feeling levels (3 = contribution-cap raise; 6 = grace
 * week) are intentionally OMITTED here — those are T3.04 concerns, not
 * cosmetic-progression concerns. Keeps this table no-P2W by construction.
 */
export const CLAN_LEVEL_COSMETIC_UNLOCKS = Object.freeze({
  1: Object.freeze([
    Object.freeze({ kind: 'banner', value: 'bronze' }),
  ]),
  2: Object.freeze([
    Object.freeze({ kind: 'emblem', value: 'emblem_default' }),
  ]),
  4: Object.freeze([
    Object.freeze({ kind: 'banner', value: 'silver' }),
  ]),
  5: Object.freeze([
    Object.freeze({ kind: 'badge', value: 'flair_first' }),
  ]),
  7: Object.freeze([
    Object.freeze({ kind: 'badge', value: 'voiceline_sting' }),
  ]),
  8: Object.freeze([
    Object.freeze({ kind: 'motto', value: 'motto_slot_unlocked' }),
  ]),
  10: Object.freeze([
    Object.freeze({ kind: 'banner', value: 'gold' }),
    Object.freeze({ kind: 'badge', value: 'veteran_clan' }),
  ]),
  15: Object.freeze([
    Object.freeze({ kind: 'banner', value: 'platinum' }),
  ]),
  20: Object.freeze([
    Object.freeze({ kind: 'badge', value: 'name_color' }),
  ]),
  25: Object.freeze([
    Object.freeze({ kind: 'banner', value: 'mythic' }),
    Object.freeze({ kind: 'badge', value: 'founding_clan' }),
  ]),
});

/** Sorted level list — used by unlockCosmeticAtLevel for fast lookup. */
export const CLAN_UNLOCK_LEVELS = Object.freeze(
  Object.keys(CLAN_LEVEL_COSMETIC_UNLOCKS)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b)
);

// ──────────────────────────────────────────────────────────────────────────
// 2026-05-13 — TASK-052 (T3.04): Weekly boss-of-the-week rotation config.
//
// Spec: docs/design/endgame-social.md §2.2 (Weekly target — Boss-of-the-Week)
//       + §15 ESC-03 Q4 ruling — 1-week Adventures rotation cadence.
//       + ADR-003 — no-P2W; weekly difficulty has a HARD cap at 2.0×.
//       + CLAUDE.md §2.5 — Uroboros sacred seasonal mythic (UNTOUCHED, this
//         file only references it by id).
//
// All constants below are READ-ONLY tunables. T3.04's algorithm reads them
// from `src/services/clan-backend.js`. Sacred-cow safety: no BOSSES roster
// values, no archetype values, no Uroboros stats live here — only rotation
// metadata (lookback horizon, cadence, difficulty scaling factors, etc).
// ──────────────────────────────────────────────────────────────────────────

/** Anti-repeat horizon in weeks — boss archetypes defeated within the last
 *  N weeks are filtered OUT of the next-week candidate pool. Keeps weekly
 *  variety across ~1 month of play. Set to 4 per task brief §"Mechanical contract". */
export const WEEKLY_ROTATION_LOOKBACK_WEEKS = 4;

/** Uroboros seasonal-mythic interval — every Nth `totalWeeksCompleted` value
 *  rotates the clan onto Uroboros (the sacred seasonal boss per CLAUDE.md §2.5).
 *  Uroboros bypasses anti-repeat + element-preference filters; the rotation
 *  algorithm yields Uroboros whenever (totalWeeksCompleted % N === 0 && >0). */
export const WEEKLY_ROTATION_UROBOROS_INTERVAL_WEEKS = 4;

/** Base difficulty multiplier applied at clan level 1 (no scaling). */
export const WEEKLY_BOSS_DIFFICULTY_BASE_MULT = 1.0;

/** Per-level difficulty increment — boss HP grows 5% per clan level above 1.
 *  Modest scaling per task brief; anti-P2W per ADR-003 (whale clans pay no
 *  faster, they just unlock cosmetics earlier). */
export const WEEKLY_BOSS_DIFFICULTY_PER_LEVEL = 0.05;

/** HARD cap on weekly boss difficulty — even level 20+ clans never face an
 *  impossibly hard boss. Caps at 2.0× per task brief + ADR-003 invariant.
 *  Statically auditable: scaleBossDifficulty cannot return > 2.0. */
export const WEEKLY_BOSS_DIFFICULTY_MAX_MULT = 2.0;

/** Threshold for declaring a clan "element-aligned" — 60% of contributing
 *  members must share a stihiya preference for the boss to be selected as
 *  counter-element. Below this, the clan is "balanced" (no element bias),
 *  and the algorithm picks freely from anti-repeat-filtered archetypes. */
export const WEEKLY_ELEMENT_PREFERENCE_THRESHOLD = 0.6;

/** One-week rotation period in ms — Adventures rotate weekly per ESC-03 Q4
 *  ruling (Tower seasons stay separate at 13 weeks). */
export const WEEKLY_ROTATION_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/** Counter-element map — picks a boss element STRONG vs the clan element
 *  (matchup tension per task brief §"Mechanical contract" step 3).
 *  RPS-triangle for the 3 nature elements (ember↔tide↔grove), and a
 *  binary opposition for the celestial pair (solar↔umbra) — matches the
 *  existing Identity-Layer racial fantasy without modifying any sacred
 *  combat math (no RACE_SYNERGY / RACE_TO_STIHIYA / damage-mult writes). */
export const WEEKLY_ELEMENT_COUNTER = Object.freeze({
  ember: 'tide',
  tide:  'grove',
  grove: 'ember',
  solar: 'umbra',
  umbra: 'solar',
});

/** Sacred seasonal boss id — used as the rotation target every Nth week
 *  (see WEEKLY_ROTATION_UROBOROS_INTERVAL_WEEKS). Matches the literal id
 *  of TOWER_UROBOROS_SEASONAL in `src/core/bosses.js` — sacred per
 *  CLAUDE.md §2.5; this constant is only a string identifier reference. */
export const WEEKLY_UROBOROS_BOSS_ID = 'tower_uroboros_seasonal';
