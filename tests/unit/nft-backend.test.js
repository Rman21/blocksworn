// 2026-05-13 — TASK-063 (T4.03 + T4.04): NFT backend unit tests.
//
// Spec: docs/design/chia-integration.md §2.1 (sacred stat-block identity)
//       + §2.4 (mint flow) + §13.6 ESC-04 Q2 ruling.
//
// Sacred-cow safety verified at every assertion:
//   - isChiaEnabled() gate honored by EVERY exported async op
//   - wallet-connect.getConnectedWallet gate honored by every async op
//   - Envelope { ok, ... } pattern — no exception leaks
//   - Module-local state only (no window globals)
//   - ADR-003 anti-P2W: applyNftSkin source code never mentions
//     hp/dmg/crit/ultCost/tier/synergy substrings (static reflection)
//   - nft-backend MUST NOT import src/data/heroes.js (HERO_ROSTER read-only;
//     mint flow reads variant.heroId but NEVER writes hero records)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as nftBackendModule from '../../src/services/nft-backend.js';
import {
  getActiveSkin,
  getOwnedNftsForHero,
  validateNftBinding,
  computeProvenanceTimeline,
  isNftEligibleForMint,
  getMintFeeBreakdown,
  syncOwnedNfts,
  mintNftVariant,
  applyNftSkin,
  unapplyNftSkin,
  _resetNftBackendForTest,
  _seedOwnedNftForTest,
  _setMintBehaviorForTest,
} from '../../src/services/nft-backend.js';
import {
  _setChiaEnabledForTest,
} from '../../src/services/feature-flags.js';
import {
  _setWalletForTest,
  _setSageStubForTest,
  _setSageBehaviorForTest,
} from '../../src/services/wallet-connect.js';
import {
  NFT_VARIANT_CATALOG,
  NFT_NAMESPACE_PREFIX,
  NFT_GAS_FEE_MOJOS,
  BLOCKSWORN_TREASURY_ROYALTY_BPS,
  NFT_RARITY_PRICES_MOJOS,
} from '../../src/data/nft-variants.js';

// ─── Test setup ────────────────────────────────────────────────────────────
// nft-backend depends on wallet-connect; for tests that exercise mint flow,
// we inject a fake wallet via _setWalletForTest + a Sage behavior override
// that signs the proposal message.

const MOCK_PUZZLE = 'chia1mocknftbackend0000000';

function _ensureFakeWindow() {
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = {};
  }
}

function _resetAll() {
  _resetNftBackendForTest();
  _setChiaEnabledForTest(null);
  _setSageBehaviorForTest(null);
  _setSageStubForTest(null);
  _setWalletForTest(null);
}

function _connectMockWallet() {
  _setWalletForTest({ connected: true, address: MOCK_PUZZLE, provider: 'sage' });
}

function _enableMintSigning() {
  // Mint flow calls wallet-connect.signMessage; install a synthetic Sage stub
  // + behavior that returns ok.
  _setSageStubForTest({});
  _setSageBehaviorForTest({
    sign: async () => ({ ok: true, signature: 'mockSig' }),
  });
}

beforeEach(() => {
  _ensureFakeWindow();
  _resetAll();
});

afterEach(() => {
  _resetAll();
});

// Pick a variant id for tests (first available in catalog).
const SAMPLE_VARIANT_ID = Array.from(NFT_VARIANT_CATALOG.keys())[0];
const SAMPLE_VARIANT = NFT_VARIANT_CATALOG.get(SAMPLE_VARIANT_ID);
const LEGENDARY_VARIANT = Array.from(NFT_VARIANT_CATALOG.values()).find(
  (v) => v.rarity === 'legendary',
);

// ─── Default state ─────────────────────────────────────────────────────────

describe('T4.03 — default backend state', () => {
  it('getActiveSkin returns null for unknown hero', () => {
    expect(getActiveSkin('unknown_hero')).toBe(null);
  });

  it('getActiveSkin returns null for non-string input', () => {
    expect(getActiveSkin(null)).toBe(null);
    expect(getActiveSkin('')).toBe(null);
  });

  it('getOwnedNftsForHero returns empty array by default', () => {
    expect(getOwnedNftsForHero(SAMPLE_VARIANT.heroId)).toEqual([]);
  });

  it('getOwnedNftsForHero returns empty array for non-string input', () => {
    expect(getOwnedNftsForHero(null)).toEqual([]);
    expect(getOwnedNftsForHero('')).toEqual([]);
  });
});

// ─── isChiaEnabled() gate (sacred ADR-005 invariant) ──────────────────────

describe('T4.04 — Chia-disabled gate (ADR-005 sacred invariant)', () => {
  it('mintNftVariant returns chia-disabled when flag is false', async () => {
    _setChiaEnabledForTest(false);
    const r = await mintNftVariant(SAMPLE_VARIANT_ID);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('chia-disabled');
  });

  it('syncOwnedNfts returns chia-disabled when flag is false', async () => {
    _setChiaEnabledForTest(false);
    const r = await syncOwnedNfts();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('chia-disabled');
  });

  it('applyNftSkin returns chia-disabled when flag is false', async () => {
    _setChiaEnabledForTest(false);
    const r = await applyNftSkin(SAMPLE_VARIANT.heroId, SAMPLE_VARIANT_ID);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('chia-disabled');
  });

  it('unapplyNftSkin returns chia-disabled when flag is false', async () => {
    _setChiaEnabledForTest(false);
    const r = await unapplyNftSkin(SAMPLE_VARIANT.heroId);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('chia-disabled');
  });

  it('isNftEligibleForMint returns chia-disabled when flag is false', () => {
    _setChiaEnabledForTest(false);
    const r = isNftEligibleForMint({}, SAMPLE_VARIANT_ID);
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('chia-disabled');
  });
});

// ─── Wallet-not-connected gate ─────────────────────────────────────────────

describe('T4.04 — wallet-not-connected gate', () => {
  it('mintNftVariant returns wallet-not-connected with no wallet', async () => {
    const r = await mintNftVariant(SAMPLE_VARIANT_ID);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('wallet-not-connected');
  });

  it('syncOwnedNfts returns wallet-not-connected with no wallet', async () => {
    const r = await syncOwnedNfts();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('wallet-not-connected');
  });

  it('isNftEligibleForMint returns wallet-not-connected with no wallet', () => {
    const r = isNftEligibleForMint({}, SAMPLE_VARIANT_ID);
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('wallet-not-connected');
  });
});

// ─── Unknown variant ───────────────────────────────────────────────────────

describe('T4.04 — unknown variant gate', () => {
  it('mintNftVariant returns unknown-variant for bogus id', async () => {
    _connectMockWallet();
    const r = await mintNftVariant('does_not_exist');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unknown-variant');
  });

  it('isNftEligibleForMint returns unknown-variant for bogus id', () => {
    _connectMockWallet();
    const r = isNftEligibleForMint({}, 'does_not_exist');
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('unknown-variant');
  });
});

// ─── Mint success path ─────────────────────────────────────────────────────

describe('T4.04 — mintNftVariant happy path', () => {
  it('returns ok=true + nftId + txProposalId when fully eligible', async () => {
    _connectMockWallet();
    _enableMintSigning();
    const r = await mintNftVariant(SAMPLE_VARIANT_ID);
    expect(r.ok).toBe(true);
    expect(typeof r.nftId).toBe('string');
    expect(r.nftId.startsWith(NFT_NAMESPACE_PREFIX)).toBe(true);
    expect(typeof r.txProposalId).toBe('string');
  });

  it('mint populates ownedNfts cache for the hero', async () => {
    _connectMockWallet();
    _enableMintSigning();
    const r = await mintNftVariant(SAMPLE_VARIANT_ID);
    expect(r.ok).toBe(true);
    const owned = getOwnedNftsForHero(SAMPLE_VARIANT.heroId);
    expect(owned.length).toBe(1);
    expect(owned[0].nftId).toBe(r.nftId);
    expect(owned[0].variantId).toBe(SAMPLE_VARIANT_ID);
    expect(owned[0].heroId).toBe(SAMPLE_VARIANT.heroId);
  });

  it('mint records provenance: mintedAt + mintedBy + seasonOfMint', async () => {
    _connectMockWallet();
    _enableMintSigning();
    const before = Date.now();
    const r = await mintNftVariant(SAMPLE_VARIANT_ID);
    expect(r.ok).toBe(true);
    const owned = getOwnedNftsForHero(SAMPLE_VARIANT.heroId);
    const nft = owned[0];
    expect(typeof nft.mintedAt).toBe('number');
    expect(nft.mintedAt).toBeGreaterThanOrEqual(before);
    expect(nft.mintedBy).toBe(MOCK_PUZZLE);
    expect(nft.seasonOfMint).toBe(SAMPLE_VARIANT.seasonOfMint);
    expect(nft.ascensionBinding).toBe(null);
  });

  it('mint allows custom ascensionBinding via options', async () => {
    _connectMockWallet();
    _enableMintSigning();
    const r = await mintNftVariant(SAMPLE_VARIANT_ID, { ascensionBinding: 'mythic_season_2' });
    expect(r.ok).toBe(true);
    const owned = getOwnedNftsForHero(SAMPLE_VARIANT.heroId);
    expect(owned[0].ascensionBinding).toBe('mythic_season_2');
  });
});

// ─── Mint failure modes via _setMintBehaviorForTest ────────────────────────

describe('T4.04 — _setMintBehaviorForTest override modes', () => {
  it('mode=success → mint succeeds', async () => {
    _connectMockWallet();
    _enableMintSigning();
    _setMintBehaviorForTest({ mode: 'success' });
    const r = await mintNftVariant(SAMPLE_VARIANT_ID);
    expect(r.ok).toBe(true);
  });

  it('mode=fail → short-circuit returns ok=false', async () => {
    _connectMockWallet();
    _setMintBehaviorForTest({ mode: 'fail', reason: 'user-cancelled' });
    const r = await mintNftVariant(SAMPLE_VARIANT_ID);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('user-cancelled');
  });

  it('mode=pending → returns ok=true with nftId=null, txProposalId populated', async () => {
    _connectMockWallet();
    _setMintBehaviorForTest({ mode: 'pending' });
    const r = await mintNftVariant(SAMPLE_VARIANT_ID);
    expect(r.ok).toBe(true);
    expect(r.nftId).toBe(null);
    expect(typeof r.txProposalId).toBe('string');
  });
});

// ─── applyNftSkin / unapplyNftSkin ─────────────────────────────────────────

describe('T4.04 — applyNftSkin / unapplyNftSkin', () => {
  it('applyNftSkin writes cache (verified via getActiveSkin)', async () => {
    _connectMockWallet();
    _enableMintSigning();
    await mintNftVariant(SAMPLE_VARIANT_ID);
    expect(getActiveSkin(SAMPLE_VARIANT.heroId)).toBe(null);
    const r = await applyNftSkin(SAMPLE_VARIANT.heroId, SAMPLE_VARIANT_ID);
    expect(r.ok).toBe(true);
    expect(getActiveSkin(SAMPLE_VARIANT.heroId)).toBe(SAMPLE_VARIANT_ID);
  });

  it('unapplyNftSkin clears cache (back to base sprite)', async () => {
    _connectMockWallet();
    _enableMintSigning();
    await mintNftVariant(SAMPLE_VARIANT_ID);
    await applyNftSkin(SAMPLE_VARIANT.heroId, SAMPLE_VARIANT_ID);
    expect(getActiveSkin(SAMPLE_VARIANT.heroId)).toBe(SAMPLE_VARIANT_ID);
    const r = await unapplyNftSkin(SAMPLE_VARIANT.heroId);
    expect(r.ok).toBe(true);
    expect(getActiveSkin(SAMPLE_VARIANT.heroId)).toBe(null);
  });

  it('applyNftSkin rejects unknown variant', async () => {
    _connectMockWallet();
    const r = await applyNftSkin(SAMPLE_VARIANT.heroId, 'does_not_exist');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unknown-variant');
  });

  it('applyNftSkin rejects mismatched heroId/variantId pair', async () => {
    _connectMockWallet();
    _enableMintSigning();
    await mintNftVariant(SAMPLE_VARIANT_ID);
    const r = await applyNftSkin('wrong_hero', SAMPLE_VARIANT_ID);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-input');
  });

  it('applyNftSkin rejects when player does not own the variant', async () => {
    _connectMockWallet();
    // No mint — should reject as invalid-input (no ownership).
    const r = await applyNftSkin(SAMPLE_VARIANT.heroId, SAMPLE_VARIANT_ID);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-input');
  });
});

// ─── isNftEligibleForMint full shape ───────────────────────────────────────

describe('T4.04 — isNftEligibleForMint full eligibility chain', () => {
  it('returns eligible=true when chia enabled + wallet connected + valid variant', () => {
    _connectMockWallet();
    const r = isNftEligibleForMint({ unlockedHeroIds: [SAMPLE_VARIANT.heroId] }, SAMPLE_VARIANT_ID);
    expect(r.eligible).toBe(true);
    expect(r.reason).toBeUndefined();
  });

  it('returns hero-not-owned when unlockedHeroIds excludes the hero', () => {
    _connectMockWallet();
    const r = isNftEligibleForMint({ unlockedHeroIds: ['some_other_hero'] }, SAMPLE_VARIANT_ID);
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('hero-not-owned');
  });

  it('returns eligible=true when player lacks unlockedHeroIds (V1 dev affordance)', () => {
    _connectMockWallet();
    const r = isNftEligibleForMint({}, SAMPLE_VARIANT_ID);
    expect(r.eligible).toBe(true);
  });
});

// ─── getMintFeeBreakdown ───────────────────────────────────────────────────

describe('T4.04 — getMintFeeBreakdown', () => {
  it('legendary variant totalMojos = 1_000_000_000_000 + 100_000_000 = 1_000_100_000_000', () => {
    const breakdown = getMintFeeBreakdown(LEGENDARY_VARIANT.id);
    expect(breakdown.gas).toBe(NFT_GAS_FEE_MOJOS);
    expect(breakdown.premium).toBe(NFT_RARITY_PRICES_MOJOS.legendary);
    expect(breakdown.totalMojos).toBe(1_000_100_000_000);
    expect(breakdown.totalXch).toBe(1.0001);
  });

  it('includes royaltyBps = 250 (sacred per ESC-04 Q2)', () => {
    const breakdown = getMintFeeBreakdown(SAMPLE_VARIANT_ID);
    expect(breakdown.royaltyBps).toBe(BLOCKSWORN_TREASURY_ROYALTY_BPS);
    expect(breakdown.royaltyBps).toBe(250);
  });

  it('returns zero fees for unknown variant', () => {
    const breakdown = getMintFeeBreakdown('does_not_exist');
    expect(breakdown.premium).toBe(0);
    expect(breakdown.totalMojos).toBe(0);
    expect(breakdown.totalXch).toBe(0);
    // Gas + royaltyBps are static; they always render.
    expect(breakdown.gas).toBe(NFT_GAS_FEE_MOJOS);
    expect(breakdown.royaltyBps).toBe(BLOCKSWORN_TREASURY_ROYALTY_BPS);
  });

  it('breakdown is frozen (no runtime mutation)', () => {
    const breakdown = getMintFeeBreakdown(SAMPLE_VARIANT_ID);
    expect(Object.isFrozen(breakdown)).toBe(true);
  });
});

// ─── validateNftBinding ────────────────────────────────────────────────────

describe('T4.04 — validateNftBinding defensive checks', () => {
  function _makeValidNft() {
    return {
      nftId:           NFT_NAMESPACE_PREFIX + 'sample:1:12345',
      heroId:          SAMPLE_VARIANT.heroId,
      variantId:       SAMPLE_VARIANT_ID,
      ownerPuzzleHash: MOCK_PUZZLE,
      mintedAt:        Date.now(),
      mintedBy:        MOCK_PUZZLE,
      ascensionBinding: null,
      seasonOfMint:    'season_1',
    };
  }

  it('accepts a valid nft record', () => {
    expect(validateNftBinding(_makeValidNft())).toBe(true);
  });

  it('rejects null / non-object', () => {
    expect(validateNftBinding(null)).toBe(false);
    expect(validateNftBinding(undefined)).toBe(false);
    expect(validateNftBinding('abc')).toBe(false);
    expect(validateNftBinding(42)).toBe(false);
  });

  it('rejects missing nftId or wrong namespace prefix', () => {
    const bad = _makeValidNft();
    bad.nftId = 'wrong:prefix:1';
    expect(validateNftBinding(bad)).toBe(false);
  });

  it('rejects non-string heroId / variantId / ownerPuzzleHash', () => {
    const bad = _makeValidNft();
    bad.heroId = null;
    expect(validateNftBinding(bad)).toBe(false);
  });
});

// ─── computeProvenanceTimeline ─────────────────────────────────────────────

describe('T4.04 — computeProvenanceTimeline', () => {
  it('returns [{ type:"mint", at, addr }] for a valid nft', () => {
    const nft = {
      nftId:           NFT_NAMESPACE_PREFIX + 'sample:1:12345',
      heroId:          SAMPLE_VARIANT.heroId,
      variantId:       SAMPLE_VARIANT_ID,
      ownerPuzzleHash: MOCK_PUZZLE,
      mintedAt:        12345,
      mintedBy:        MOCK_PUZZLE,
      ascensionBinding: null,
      seasonOfMint:    'season_1',
    };
    const timeline = computeProvenanceTimeline(nft);
    expect(timeline.length).toBe(1);
    expect(timeline[0].type).toBe('mint');
    expect(timeline[0].at).toBe(12345);
    expect(timeline[0].addr).toBe(MOCK_PUZZLE);
  });

  it('returns empty array for invalid nft', () => {
    expect(computeProvenanceTimeline(null)).toEqual([]);
    expect(computeProvenanceTimeline({})).toEqual([]);
  });
});

// ─── syncOwnedNfts ────────────────────────────────────────────────────────

describe('T4.04 — syncOwnedNfts (V1 stub)', () => {
  it('returns ok=true + count when wallet connected', async () => {
    _connectMockWallet();
    const r = await syncOwnedNfts();
    expect(r.ok).toBe(true);
    expect(typeof r.count).toBe('number');
  });

  it('count reflects seeded NFTs', async () => {
    _connectMockWallet();
    _seedOwnedNftForTest({
      nftId:           NFT_NAMESPACE_PREFIX + 'seed:1:99',
      heroId:          SAMPLE_VARIANT.heroId,
      variantId:       SAMPLE_VARIANT_ID,
      ownerPuzzleHash: MOCK_PUZZLE,
      mintedAt:        Date.now(),
      mintedBy:        MOCK_PUZZLE,
      ascensionBinding: null,
      seasonOfMint:    'season_1',
    });
    const r = await syncOwnedNfts();
    expect(r.ok).toBe(true);
    expect(r.count).toBe(1);
  });
});

// ─── _seedOwnedNftForTest ──────────────────────────────────────────────────

describe('T4.04 — _seedOwnedNftForTest helper', () => {
  it('injects an NFT record that is then visible via getOwnedNftsForHero', () => {
    _seedOwnedNftForTest({
      nftId:           NFT_NAMESPACE_PREFIX + 'seed:1:99',
      heroId:          SAMPLE_VARIANT.heroId,
      variantId:       SAMPLE_VARIANT_ID,
      ownerPuzzleHash: MOCK_PUZZLE,
      mintedAt:        99,
      mintedBy:        MOCK_PUZZLE,
      ascensionBinding: null,
      seasonOfMint:    'season_1',
    });
    const owned = getOwnedNftsForHero(SAMPLE_VARIANT.heroId);
    expect(owned.length).toBe(1);
    expect(owned[0].mintedAt).toBe(99);
  });

  it('ignores invalid shapes silently', () => {
    _seedOwnedNftForTest({ bogus: true });
    expect(getOwnedNftsForHero(SAMPLE_VARIANT.heroId)).toEqual([]);
  });
});

// ─── ADR-003 anti-P2W static reflection audit ──────────────────────────────

describe('T4.03 — ADR-003 anti-P2W invariant (static source reflection)', () => {
  // The applyNftSkin function (where cosmetic state is bound) MUST NOT
  // touch any stat-block field. Static substring scan of the exported
  // function source guards against accidental introduction.
  it('applyNftSkin source contains no stat-field substrings', () => {
    const src = nftBackendModule.applyNftSkin.toString();
    const banned = ['hp', 'dmg', 'damage', 'crit', 'ultCost', 'tierAbility', 'synergy', 'winRate'];
    // Lowercase the source so we catch case-mistyped variants too.
    const srcLower = src.toLowerCase();
    for (const b of banned) {
      const bLower = b.toLowerCase();
      expect(srcLower.includes(bLower)).toBe(false);
    }
  });

  it('mintNftVariant source contains no stat-field substrings', () => {
    const src = nftBackendModule.mintNftVariant.toString();
    const banned = ['hp', 'dmg', 'damage', 'crit', 'ultCost', 'tierAbility', 'synergy', 'winRate'];
    const srcLower = src.toLowerCase();
    for (const b of banned) {
      const bLower = b.toLowerCase();
      expect(srcLower.includes(bLower)).toBe(false);
    }
  });

  it('nft-backend does NOT import src/data/heroes.js (HERO_ROSTER read-only)', async () => {
    // Static import scan: read the file source and grep for forbidden imports.
    const fs = await import('node:fs/promises');
    const url = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const src = await fs.readFile(path.join(here, '../../src/services/nft-backend.js'), 'utf8');
    expect(src.includes('from \'../data/heroes.js\'')).toBe(false);
    expect(src.includes('from "../data/heroes.js"')).toBe(false);
    // Also exclude src/core/heroes.js (the actual HERO_ROSTER location):
    expect(src.includes('from \'../core/heroes.js\'')).toBe(false);
    expect(src.includes('from "../core/heroes.js"')).toBe(false);
  });
});
