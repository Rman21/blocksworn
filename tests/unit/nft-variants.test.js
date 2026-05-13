// 2026-05-13 — TASK-063 (T4.03): NFT variant catalog invariants.
//
// Spec: docs/design/chia-integration.md §2.1-§2.4 + §13.6 ESC-04 Q2.
//
// Sacred-cow safety verified at every assertion:
//   - All exports frozen (no runtime mutation possible)
//   - Rarity enum is exactly {COMMON, RARE, LEGENDARY}
//   - Prices align with the ESC-04 Q2 rarity ladder
//   - Gas fee = 0.0001 XCH sacred per Chia network
//   - Treasury royalty = 250 bps (2.5%) sacred per ESC-04 Q2
//   - ADR-003 anti-P2W: no variant references hp/dmg/crit/ultCost/tier/synergy

import { describe, it, expect } from 'vitest';
import {
  NFT_VARIANT_RARITIES,
  NFT_RARITY_PRICES_MOJOS,
  NFT_GAS_FEE_MOJOS,
  BLOCKSWORN_TREASURY_ROYALTY_BPS,
  NFT_NAMESPACE_PREFIX,
  NFT_VARIANT_CATALOG,
  getVariantById,
  getVariantsForHero,
  computeMintFeeMojos,
} from '../../src/data/nft-variants.js';

// ─── Frozen constants ──────────────────────────────────────────────────────

describe('T4.03 — frozen constants (no runtime mutation)', () => {
  it('NFT_VARIANT_RARITIES is frozen', () => {
    expect(Object.isFrozen(NFT_VARIANT_RARITIES)).toBe(true);
  });

  it('NFT_RARITY_PRICES_MOJOS is frozen', () => {
    expect(Object.isFrozen(NFT_RARITY_PRICES_MOJOS)).toBe(true);
  });

  it('NFT_VARIANT_CATALOG is frozen', () => {
    expect(Object.isFrozen(NFT_VARIANT_CATALOG)).toBe(true);
  });

  it('every catalog entry is frozen', () => {
    for (const v of NFT_VARIANT_CATALOG.values()) {
      expect(Object.isFrozen(v)).toBe(true);
    }
  });
});

// ─── Rarity enum ───────────────────────────────────────────────────────────

describe('T4.03 — rarity enum (exactly 3 tiers per spec §2.4 Field 3)', () => {
  it('exposes exactly COMMON / RARE / LEGENDARY', () => {
    expect(Object.keys(NFT_VARIANT_RARITIES).sort()).toEqual(
      ['COMMON', 'LEGENDARY', 'RARE'],
    );
  });

  it('every catalog rarity is one of the three enum values', () => {
    const allowed = new Set(Object.values(NFT_VARIANT_RARITIES));
    for (const v of NFT_VARIANT_CATALOG.values()) {
      expect(allowed.has(v.rarity)).toBe(true);
    }
  });
});

// ─── Sacred price/gas/royalty constants ────────────────────────────────────

describe('T4.03 — sacred price + gas + royalty constants (ESC-04 Q2)', () => {
  it('common premium = 0.01 XCH (10_000_000_000 mojos)', () => {
    expect(NFT_RARITY_PRICES_MOJOS.common).toBe(10_000_000_000);
  });

  it('rare premium = 0.1 XCH (100_000_000_000 mojos)', () => {
    expect(NFT_RARITY_PRICES_MOJOS.rare).toBe(100_000_000_000);
  });

  it('legendary premium = 1.0 XCH (1_000_000_000_000 mojos)', () => {
    expect(NFT_RARITY_PRICES_MOJOS.legendary).toBe(1_000_000_000_000);
  });

  it('NFT_GAS_FEE_MOJOS = 100_000_000 (0.0001 XCH sacred per Chia)', () => {
    expect(NFT_GAS_FEE_MOJOS).toBe(100_000_000);
  });

  it('BLOCKSWORN_TREASURY_ROYALTY_BPS = 250 (2.5% sacred per ESC-04 Q2)', () => {
    expect(BLOCKSWORN_TREASURY_ROYALTY_BPS).toBe(250);
  });

  it('NFT_NAMESPACE_PREFIX = "chia:bls:"', () => {
    expect(NFT_NAMESPACE_PREFIX).toBe('chia:bls:');
  });

  it('prices form a strictly increasing ladder common < rare < legendary', () => {
    expect(NFT_RARITY_PRICES_MOJOS.common).toBeLessThan(NFT_RARITY_PRICES_MOJOS.rare);
    expect(NFT_RARITY_PRICES_MOJOS.rare).toBeLessThan(NFT_RARITY_PRICES_MOJOS.legendary);
  });
});

// ─── Catalog invariants ────────────────────────────────────────────────────

describe('T4.03 — V1 catalog invariants', () => {
  it('contains 5 variants (one per Phase 2 race)', () => {
    expect(NFT_VARIANT_CATALOG.size).toBe(5);
  });

  it('all variants have required fields populated', () => {
    for (const v of NFT_VARIANT_CATALOG.values()) {
      expect(typeof v.id).toBe('string');
      expect(typeof v.heroId).toBe('string');
      expect(typeof v.displayName).toBe('string');
      expect(typeof v.artAssetPath).toBe('string');
      expect(typeof v.voiceAssetPath).toBe('string');
      expect(typeof v.particleAccentColor).toBe('string');
      expect(typeof v.mintPriceMojos).toBe('number');
      expect(typeof v.rarity).toBe('string');
      expect(typeof v.seasonOfMint).toBe('string');
    }
  });

  it('variant prices match their rarity in NFT_RARITY_PRICES_MOJOS', () => {
    for (const v of NFT_VARIANT_CATALOG.values()) {
      expect(v.mintPriceMojos).toBe(NFT_RARITY_PRICES_MOJOS[v.rarity]);
    }
  });

  it('every variant binds to a unique heroId (V1: one variant per race)', () => {
    const heroIds = new Set();
    for (const v of NFT_VARIANT_CATALOG.values()) {
      heroIds.add(v.heroId);
    }
    expect(heroIds.size).toBe(NFT_VARIANT_CATALOG.size);
  });

  it('every variant id is unique', () => {
    const ids = new Set();
    for (const v of NFT_VARIANT_CATALOG.values()) {
      expect(ids.has(v.id)).toBe(false);
      ids.add(v.id);
    }
  });

  it('every variant heroId follows snake_case (matches HERO_ROSTER convention)', () => {
    for (const v of NFT_VARIANT_CATALOG.values()) {
      expect(v.heroId).toMatch(/^[a-z_]+$/);
    }
  });

  it('every variant seasonOfMint is non-empty', () => {
    for (const v of NFT_VARIANT_CATALOG.values()) {
      expect(v.seasonOfMint.length).toBeGreaterThan(0);
    }
  });

  it('every variant artAssetPath ends with .png', () => {
    for (const v of NFT_VARIANT_CATALOG.values()) {
      expect(v.artAssetPath).toMatch(/\.png$/);
    }
  });

  it('every variant particleAccentColor is a hex color', () => {
    for (const v of NFT_VARIANT_CATALOG.values()) {
      expect(v.particleAccentColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

// ─── ADR-003 anti-P2W audit ────────────────────────────────────────────────

describe('T4.03 — ADR-003 anti-P2W invariant (variants confer ONLY cosmetic)', () => {
  it('no variant field name references stat properties', () => {
    // Defensive substring scan: serialize each variant entry and grep for
    // sacred-cow stat substrings. If ANY variant carries hp/dmg/crit/etc.
    // it's a P2W bug that must be caught here.
    const banned = ['hp', 'dmg', 'damage', 'crit', 'ultcost', 'tierability', 'synergy', 'winrate'];
    for (const v of NFT_VARIANT_CATALOG.values()) {
      const keys = Object.keys(v).map((k) => k.toLowerCase());
      for (const k of keys) {
        for (const b of banned) {
          expect(k.includes(b)).toBe(false);
        }
      }
    }
  });

  it('no variant value references stat properties (deep scan)', () => {
    // Stringify each variant and grep for stat field names case-insensitively.
    // This catches accidental embedding in any string field.
    const bannedRe = /\b(hp|dmg|damage|crit|ultCost|tierAbility|synergy|winRate)\b/i;
    for (const v of NFT_VARIANT_CATALOG.values()) {
      const json = JSON.stringify(v);
      expect(bannedRe.test(json)).toBe(false);
    }
  });
});

// ─── Helpers ───────────────────────────────────────────────────────────────

describe('T4.03 — getVariantById', () => {
  it('returns the variant for a known id', () => {
    const id = Array.from(NFT_VARIANT_CATALOG.keys())[0];
    const v = getVariantById(id);
    expect(v).not.toBe(null);
    expect(v.id).toBe(id);
  });

  it('returns null for an unknown id (no throw)', () => {
    expect(getVariantById('does_not_exist')).toBe(null);
  });

  it('returns null for non-string input', () => {
    expect(getVariantById(null)).toBe(null);
    expect(getVariantById(undefined)).toBe(null);
    expect(getVariantById(42)).toBe(null);
    expect(getVariantById('')).toBe(null);
  });
});

describe('T4.03 — getVariantsForHero', () => {
  it('returns array of variants for a known heroId', () => {
    const first = Array.from(NFT_VARIANT_CATALOG.values())[0];
    const arr = getVariantsForHero(first.heroId);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBeGreaterThanOrEqual(1);
    expect(arr.every((v) => v.heroId === first.heroId)).toBe(true);
  });

  it('returns empty array for unknown heroId', () => {
    expect(getVariantsForHero('not_a_hero')).toEqual([]);
  });

  it('returns empty array for non-string input', () => {
    expect(getVariantsForHero(null)).toEqual([]);
    expect(getVariantsForHero('')).toEqual([]);
  });
});

describe('T4.03 — computeMintFeeMojos', () => {
  it('returns gas + premium for known variant', () => {
    for (const v of NFT_VARIANT_CATALOG.values()) {
      const total = computeMintFeeMojos(v.id);
      expect(total).toBe(NFT_GAS_FEE_MOJOS + v.mintPriceMojos);
    }
  });

  it('returns 0 for unknown variant', () => {
    expect(computeMintFeeMojos('does_not_exist')).toBe(0);
  });

  it('legendary variant total = 1_000_000_000_000 + 100_000_000 = 1_000_100_000_000 mojos', () => {
    const legendary = Array.from(NFT_VARIANT_CATALOG.values()).find(
      (v) => v.rarity === NFT_VARIANT_RARITIES.LEGENDARY,
    );
    expect(legendary).toBeDefined();
    expect(computeMintFeeMojos(legendary.id)).toBe(1_000_100_000_000);
  });
});
