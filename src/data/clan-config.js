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
