// 2026-05-13 — TASK-063 (T4.03): NFT cosmetic variant catalog.
//
// Spec: docs/design/chia-integration.md §2.1-§2.4 (NFT data model + mint)
//       + §13.6 ESC-04 Q2 ruling (uniform fee, 2.5% royalty).
//
// Sacred-cow safety:
//   - This file holds NO sacred-cow values per CLAUDE.md §2.x. Variants are
//     a NEW Phase 4 concept; no overlap with combat math, V_HAPTICS,
//     NARRATOR_LINES, GEM_PACKS, Battle Pass, Tower retry ladder, Tower
//     leaderboards, TOWER_PACTS, HERO_ROSTER, HERO_TIER_ABILITIES, or any
//     Phase 1/2/3 backend.
//   - All exports are Object.freeze'd to prevent runtime mutation.
//   - Per ADR-003 (no-P2W): variants confer ONLY cosmetic skin + provenance
//     + trade-ability + ascension binding. EVERY variant entry is statically
//     audited (in tests) to ensure NO field references hp / dmg / crit /
//     ultCost / tier / synergy. F2P parity invariant preserved.
//   - Per ADR-004 (hybrid): this file lives in src/data/, never imported by
//     legacy HTML.
//   - Per ADR-005 (mobile feature flag, T4.09): consumers MUST gate on
//     isChiaEnabled() before reading the catalog into Chia-bound UI.
//
// V1 scope per spec §2.4 Field 2 + ESC-04 Q2:
//   - 5 sample variants (1 per Phase 2 race) prove the pattern. Real catalog
//     expands post-launch via additional Phase 4 sub-tasks (catalog entries
//     are pure data — additions do not require code changes).
//   - Rarity ladder: common 0.01 XCH, rare 0.1 XCH, legendary 1.0 XCH
//     (per spec §2.4 Field 3 + ESC-04 Q2 ruling).
//   - Network gas: 0.0001 XCH flat (per spec §2.4 Field 3, sacred Chia gas).
//   - Treasury royalty: 2.5% (250 bps) per ESC-04 Q2.
//
// V1 hero anchors (5 races × 1 hero each, alphabetical-by-race choice):
//   - crocodile_warrior (MOSSJAW, grove)   — common bedrock variant
//   - pirate_warrior    (THORGAR, ember)   — rare crimson variant
//   - rock_warrior      (RIFFBLADE, umbra) — rare obsidian variant
//   - shark_warrior     (RIMEFANG, tide)   — common saltwater variant
//   - spark_warrior     (EMBERSPARK, solar)— legendary corona variant
//   These IDs are the actual HERO_ROSTER keys in src/core/heroes.js (line
//   3778); the variants are render-time skin overlays, NEVER writes.

/**
 * NFT variant rarity enum. Three tiers per design spec §2.4 Field 3.
 * Each tier maps to a fixed mint premium via NFT_RARITY_PRICES_MOJOS.
 */
export const NFT_VARIANT_RARITIES = Object.freeze({
  COMMON:    'common',
  RARE:      'rare',
  LEGENDARY: 'legendary',
});

/**
 * Premium (excludes gas) charged per variant rarity, in mojos (1 XCH = 1e12 mojos).
 * Per spec §2.4 Field 3 + ESC-04 Q2 ruling:
 *   - common    = 0.01 XCH = 10_000_000_000     mojos
 *   - rare      = 0.1  XCH = 100_000_000_000    mojos
 *   - legendary = 1.0  XCH = 1_000_000_000_000  mojos
 * Premium flows to the Blocksworn treasury wallet; gas flows to Chia network.
 * NO part of the premium scales hero stats (ADR-003 anti-P2W invariant).
 */
export const NFT_RARITY_PRICES_MOJOS = Object.freeze({
  common:    10_000_000_000,
  rare:      100_000_000_000,
  legendary: 1_000_000_000_000,
});

/**
 * Chia network gas fee for an NFT mint operation, in mojos.
 * Per spec §2.4 Field 3: 0.0001 XCH flat = 100_000_000 mojos.
 * Sacred per Chia ecosystem norm; not adjustable by Blocksworn.
 */
export const NFT_GAS_FEE_MOJOS = 100_000_000;

/**
 * Treasury royalty in basis points (1/100th of a percent).
 * Per ESC-04 Q2 ruling: 2.5% = 250 bps. Honored voluntarily by Chia NFT1
 * marketplaces (Sage / Spacescan / Mintgarden). NO part of royalty grants
 * mechanical advantage to the player (ADR-003 anti-P2W invariant).
 */
export const BLOCKSWORN_TREASURY_ROYALTY_BPS = 250;

/**
 * Chia NFT1 namespace prefix for all Blocksworn-minted NFTs.
 * Per spec §2.1 conceptual schema. Used to disambiguate Blocksworn NFTs from
 * other Chia NFT projects when scanning a wallet's holdings via the indexer.
 */
export const NFT_NAMESPACE_PREFIX = 'chia:bls:';

// ─── V1 Variant Catalog ────────────────────────────────────────────────────
// One variant per Phase 2 race proves the cosmetic-overlay pattern. Real
// catalog expands post-launch — additions are pure-data and require no code
// change. Each variant binds to a HERO_ROSTER key; render time consults
// nft-backend.getActiveSkin(heroId) to optionally overlay the variant.
//
// Per spec §2.4 Field 1: "only heroes the player has already unlocked in
// their F2P save can be minted. NFT minting is not a path to acquire new
// heroes." The variants below are bound to heroes that ALREADY exist in
// HERO_ROSTER; the catalog never adds heroes.

const _variantEntries = [
  Object.freeze({
    id:                  'crocodile_warrior_bedrock',
    heroId:              'crocodile_warrior',
    displayName:         'Bedrock Mossjaw',
    artAssetPath:        'nft/crocodile_warrior_bedrock.png',
    voiceAssetPath:      'nft/crocodile_warrior_bedrock_voice.mp3',
    particleAccentColor: '#3f7a3a', // grove green, deeper hue
    mintPriceMojos:      NFT_RARITY_PRICES_MOJOS.common,
    rarity:              NFT_VARIANT_RARITIES.COMMON,
    seasonOfMint:        'season_1',
  }),
  Object.freeze({
    id:                  'pirate_warrior_crimson',
    heroId:              'pirate_warrior',
    displayName:         'Crimson Thorgar',
    artAssetPath:        'nft/pirate_warrior_crimson.png',
    voiceAssetPath:      'nft/pirate_warrior_crimson_voice.mp3',
    particleAccentColor: '#c81f1f', // crimson with gold-flecks vs base ember-orange
    mintPriceMojos:      NFT_RARITY_PRICES_MOJOS.rare,
    rarity:              NFT_VARIANT_RARITIES.RARE,
    seasonOfMint:        'season_1',
  }),
  Object.freeze({
    id:                  'rock_warrior_obsidian',
    heroId:              'rock_warrior',
    displayName:         'Obsidian Riffblade',
    artAssetPath:        'nft/rock_warrior_obsidian.png',
    voiceAssetPath:      'nft/rock_warrior_obsidian_voice.mp3',
    particleAccentColor: '#1f1024', // deep obsidian-violet vs base umbra-purple
    mintPriceMojos:      NFT_RARITY_PRICES_MOJOS.rare,
    rarity:              NFT_VARIANT_RARITIES.RARE,
    seasonOfMint:        'season_1',
  }),
  Object.freeze({
    id:                  'shark_warrior_saltwater',
    heroId:              'shark_warrior',
    displayName:         'Saltwater Rimefang',
    artAssetPath:        'nft/shark_warrior_saltwater.png',
    voiceAssetPath:      'nft/shark_warrior_saltwater_voice.mp3',
    particleAccentColor: '#2f6f8c', // saltwater teal vs base tide cyan
    mintPriceMojos:      NFT_RARITY_PRICES_MOJOS.common,
    rarity:              NFT_VARIANT_RARITIES.COMMON,
    seasonOfMint:        'season_1',
  }),
  Object.freeze({
    id:                  'spark_warrior_corona',
    heroId:              'spark_warrior',
    displayName:         'Corona Emberspark',
    artAssetPath:        'nft/spark_warrior_corona.png',
    voiceAssetPath:      'nft/spark_warrior_corona_voice.mp3',
    particleAccentColor: '#ffd000', // corona gold with white flares vs base solar yellow
    mintPriceMojos:      NFT_RARITY_PRICES_MOJOS.legendary,
    rarity:              NFT_VARIANT_RARITIES.LEGENDARY,
    seasonOfMint:        'season_1',
  }),
];

/**
 * Frozen Map of variantId → variant record. Keyed for O(1) lookup at render
 * time. Source of truth for the cosmetic catalog; pure data; never mutated.
 */
export const NFT_VARIANT_CATALOG = Object.freeze(
  new Map(_variantEntries.map((v) => [v.id, v])),
);

// ─── Public helpers ────────────────────────────────────────────────────────

/**
 * Look up a variant by id. Pure; never throws.
 *
 * @param {string} id — variant id (e.g., 'pirate_warrior_crimson')
 * @returns {object|null} frozen variant record or null if unknown
 */
export function getVariantById(id) {
  if (typeof id !== 'string' || !id) return null;
  return NFT_VARIANT_CATALOG.get(id) || null;
}

/**
 * Return all variants bound to a given hero id. Pure; never throws.
 *
 * @param {string} heroId — HERO_ROSTER key (e.g., 'pirate_warrior')
 * @returns {object[]} array of variants (may be empty)
 */
export function getVariantsForHero(heroId) {
  if (typeof heroId !== 'string' || !heroId) return [];
  const out = [];
  for (const v of NFT_VARIANT_CATALOG.values()) {
    if (v.heroId === heroId) out.push(v);
  }
  return out;
}

/**
 * Compute the total mint fee for a variant (gas + premium) in mojos.
 * Pure; returns 0 for unknown variant (defensive — never throws).
 *
 * Per spec §2.4 Field 3:
 *   totalMojos = NFT_GAS_FEE_MOJOS + variant.mintPriceMojos
 *
 * @param {string} variantId
 * @returns {number} total mojos, or 0 if variant unknown
 */
export function computeMintFeeMojos(variantId) {
  const v = getVariantById(variantId);
  if (!v) return 0;
  return NFT_GAS_FEE_MOJOS + v.mintPriceMojos;
}
