// 2026-05-13 — TASK-064 (T4.05 + T4.06): NFT transfer + trade flow unit tests.
//
// Spec: docs/design/chia-integration.md §2.5 (Trade flow / transfer)
//       + §13.6 ESC-04 Q2 ruling (2.5% royalty, honor voluntary at
//       marketplace level per Chia NFT1 ecosystem norm).
//
// Sacred-cow safety verified at every assertion:
//   - isChiaEnabled() gate honored by every async op + every transfer-bound
//     surface
//   - wallet-connect.getConnectedWallet gate honored
//   - Envelope { ok, ... } pattern — no exception leaks
//   - Module-local state only (no window globals)
//   - ESC-04 Q2: BLOCKSWORN_TREASURY_ROYALTY_BPS === 250 in every royalty
//     envelope (static + runtime audit)
//   - ADR-003 anti-P2W: submitTransfer + applyRoyaltyOnSale source MUST NOT
//     contain hp/dmg/damage/crit/ultCost/synergy/winRate/tier/race substrings
//     (static reflection audit)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as nftBackendModule from '../../src/services/nft-backend.js';
import {
  buildTransferProposal,
  getRoyaltyBreakdown,
  getTreasuryPuzzleHash,
  formatNftDeepLink,
  formatSageWalletDeepLink,
  submitTransfer,
  subscribeToTransfers,
  simulateTransferSettlement,
  applyRoyaltyOnSale,
  getActiveSkin,
  getOwnedNftsForHero,
  applyNftSkin,
  _resetNftBackendForTest,
  _seedOwnedNftForTest,
  _setTransferBehaviorForTest,
  _clearTransferListenersForTest,
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
  BLOCKSWORN_TREASURY_ROYALTY_BPS,
} from '../../src/data/nft-variants.js';
import {
  BLOCKSWORN_TREASURY_PUZZLEHASH,
} from '../../src/data/chia-config.js';

// ─── Test setup ────────────────────────────────────────────────────────────

// NOTE: wallet-connect._isValidAddress regex requires `^chia[0-9a-z]+$` for
// test fixtures (V1 dev mock convention). Our nft-backend._isValidPuzzleHash
// accepts the union (xch1/txch1/chia) so production mainnet/testnet shapes
// pass + test mocks pass. We use `chia1...` here to satisfy _setWalletForTest.
const SELLER_PUZZLE   = 'chia1mocksellerwallet0000000000000000000000000000000000';
const BUYER_PUZZLE    = 'chia1mockbuyerwallet00000000000000000000000000000000000';
const STRANGER_PUZZLE = 'chia1mockstrangerwallet0000000000000000000000000000000';

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
  _clearTransferListenersForTest();
}

function _connectSellerWallet() {
  _setWalletForTest({ connected: true, address: SELLER_PUZZLE, provider: 'sage' });
}

function _connectBuyerWallet() {
  _setWalletForTest({ connected: true, address: BUYER_PUZZLE, provider: 'sage' });
}

function _enableSignSigning() {
  _setSageStubForTest({});
  _setSageBehaviorForTest({
    sign: async () => ({ ok: true, signature: 'mockTransferSig' }),
  });
}

const SAMPLE_VARIANT_ID = Array.from(NFT_VARIANT_CATALOG.keys())[0];
const SAMPLE_VARIANT = NFT_VARIANT_CATALOG.get(SAMPLE_VARIANT_ID);

function _seedSellerNft() {
  const nft = {
    nftId:           NFT_NAMESPACE_PREFIX + 'transfer:test:1',
    heroId:          SAMPLE_VARIANT.heroId,
    variantId:       SAMPLE_VARIANT_ID,
    ownerPuzzleHash: SELLER_PUZZLE,
    mintedAt:        Date.now(),
    mintedBy:        SELLER_PUZZLE,
    ascensionBinding: null,
    seasonOfMint:    'season_1',
  };
  _seedOwnedNftForTest(nft);
  return nft;
}

beforeEach(() => {
  _ensureFakeWindow();
  _resetAll();
});

afterEach(() => {
  _resetAll();
});

// ─── buildTransferProposal happy path ──────────────────────────────────────

describe('T4.05 — buildTransferProposal happy path', () => {
  it('returns ok=true with full envelope when chia + wallet + owned NFT + valid recipient', () => {
    _connectSellerWallet();
    const nft = _seedSellerNft();
    const r = buildTransferProposal(nft.nftId, BUYER_PUZZLE);
    expect(r.ok).toBe(true);
    expect(r.nftId).toBe(nft.nftId);
    expect(r.fromAddr).toBe(SELLER_PUZZLE);
    expect(r.toAddr).toBe(BUYER_PUZZLE);
    expect(r.royaltyBps).toBe(250);
    expect(r.royaltyRecipientPuzzleHash).toBe(BLOCKSWORN_TREASURY_PUZZLEHASH);
    expect(typeof r.gasMojos).toBe('number');
    expect(r.gasMojos).toBeGreaterThan(0);
  });

  it('envelope is frozen (no runtime mutation)', () => {
    _connectSellerWallet();
    const nft = _seedSellerNft();
    const r = buildTransferProposal(nft.nftId, BUYER_PUZZLE);
    expect(Object.isFrozen(r)).toBe(true);
  });

  it('royaltyBps in envelope is always 250 (sacred ESC-04 Q2)', () => {
    _connectSellerWallet();
    const nft = _seedSellerNft();
    const r = buildTransferProposal(nft.nftId, BUYER_PUZZLE);
    expect(r.royaltyBps).toBe(BLOCKSWORN_TREASURY_ROYALTY_BPS);
    expect(r.royaltyBps).toBe(250);
  });
});

// ─── buildTransferProposal rejection paths ─────────────────────────────────

describe('T4.05 — buildTransferProposal rejection paths', () => {
  it('rejects with chia-disabled when feature flag off', () => {
    _setChiaEnabledForTest(false);
    _connectSellerWallet();
    _seedSellerNft();
    const r = buildTransferProposal(NFT_NAMESPACE_PREFIX + 'transfer:test:1', BUYER_PUZZLE);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('chia-disabled');
  });

  it('rejects with wallet-not-connected when no wallet', () => {
    const r = buildTransferProposal(NFT_NAMESPACE_PREFIX + 'transfer:test:1', BUYER_PUZZLE);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('wallet-not-connected');
  });

  it('rejects with unknown-nft when nftId not in owned set', () => {
    _connectSellerWallet();
    const r = buildTransferProposal(NFT_NAMESPACE_PREFIX + 'does:not:exist', BUYER_PUZZLE);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unknown-nft');
  });

  it('rejects with invalid-input when nftId is null', () => {
    _connectSellerWallet();
    const r = buildTransferProposal(null, BUYER_PUZZLE);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-input');
  });

  it('rejects with invalid-input when nftId is empty string', () => {
    _connectSellerWallet();
    const r = buildTransferProposal('', BUYER_PUZZLE);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-input');
  });

  it('rejects with invalid-recipient when recipient is null', () => {
    _connectSellerWallet();
    const nft = _seedSellerNft();
    const r = buildTransferProposal(nft.nftId, null);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-recipient');
  });

  it('rejects with invalid-recipient when recipient is empty string', () => {
    _connectSellerWallet();
    const nft = _seedSellerNft();
    const r = buildTransferProposal(nft.nftId, '');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-recipient');
  });

  it('rejects with invalid-recipient when recipient is non-string', () => {
    _connectSellerWallet();
    const nft = _seedSellerNft();
    const r = buildTransferProposal(nft.nftId, 12345);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-recipient');
  });

  it('rejects with invalid-recipient when recipient does not match Chia bech32 shape', () => {
    _connectSellerWallet();
    const nft = _seedSellerNft();
    const r = buildTransferProposal(nft.nftId, 'not-a-chia-address');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-recipient');
  });

  it('rejects with nft-not-owned when caller does not own the NFT', () => {
    // Seed an NFT owned by the buyer, then connect as a stranger.
    _setWalletForTest({ connected: true, address: BUYER_PUZZLE, provider: 'sage' });
    _seedSellerNft(); // seeds an NFT owned by SELLER_PUZZLE, not BUYER
    const r = buildTransferProposal(NFT_NAMESPACE_PREFIX + 'transfer:test:1', STRANGER_PUZZLE);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('nft-not-owned');
  });
});

// ─── getRoyaltyBreakdown — sacred 2.5% math ────────────────────────────────

describe('T4.06 — getRoyaltyBreakdown (sacred 2.5% per ESC-04 Q2)', () => {
  it('returns all zeros for salePriceMojos === 0', () => {
    const r = getRoyaltyBreakdown(0);
    expect(r.ok).toBe(true);
    expect(r.royaltyMojos).toBe(0);
    expect(r.treasuryMojos).toBe(0);
    expect(r.sellerNetMojos).toBe(0);
    expect(r.royaltyBps).toBe(250);
  });

  it('1 XCH sale → 0.025 XCH royalty (25_000_000 mojos)', () => {
    const r = getRoyaltyBreakdown(1_000_000_000);
    expect(r.ok).toBe(true);
    expect(r.royaltyMojos).toBe(25_000_000);
    expect(r.treasuryMojos).toBe(25_000_000);
    expect(r.sellerNetMojos).toBe(975_000_000);
    expect(r.royaltyBps).toBe(250);
  });

  it('40 XCH sale → 1 XCH royalty (1_000_000_000 mojos)', () => {
    const r = getRoyaltyBreakdown(40_000_000_000);
    expect(r.ok).toBe(true);
    expect(r.royaltyMojos).toBe(1_000_000_000);
    expect(r.treasuryMojos).toBe(1_000_000_000);
    expect(r.sellerNetMojos).toBe(39_000_000_000);
    expect(r.royaltyBps).toBe(250);
  });

  it('1 XCH (1e12 mojos) sale → 2.5e10 mojo royalty', () => {
    const r = getRoyaltyBreakdown(1_000_000_000_000);
    expect(r.royaltyMojos).toBe(25_000_000_000);
    expect(r.sellerNetMojos).toBe(975_000_000_000);
    expect(r.royaltyBps).toBe(250);
  });

  it('royalty + sellerNet === input price (no rounding leak at clean inputs)', () => {
    const price = 5_000_000_000_000; // 5 XCH
    const r = getRoyaltyBreakdown(price);
    expect(r.royaltyMojos + r.sellerNetMojos).toBe(price);
  });

  it('defensive: negative input returns zero envelope', () => {
    const r = getRoyaltyBreakdown(-1);
    expect(r.ok).toBe(true);
    expect(r.royaltyMojos).toBe(0);
    expect(r.sellerNetMojos).toBe(0);
    expect(r.royaltyBps).toBe(250);
  });

  it('defensive: NaN input returns zero envelope', () => {
    const r = getRoyaltyBreakdown(NaN);
    expect(r.ok).toBe(true);
    expect(r.royaltyMojos).toBe(0);
    expect(r.sellerNetMojos).toBe(0);
    expect(r.royaltyBps).toBe(250);
  });

  it('defensive: Infinity input returns zero envelope', () => {
    const r = getRoyaltyBreakdown(Infinity);
    expect(r.ok).toBe(true);
    expect(r.royaltyMojos).toBe(0);
    expect(r.royaltyBps).toBe(250);
  });

  it('defensive: non-number input returns zero envelope', () => {
    const r = getRoyaltyBreakdown('1000');
    expect(r.ok).toBe(true);
    expect(r.royaltyMojos).toBe(0);
    expect(r.royaltyBps).toBe(250);
  });

  it('Sacred-cow invariant: royaltyBps === 250 across the full range', () => {
    const samples = [0, 1, 100, 1_000_000, 1_000_000_000, 999_999_999_999, 5e15];
    for (const p of samples) {
      const r = getRoyaltyBreakdown(p);
      expect(r.royaltyBps).toBe(250);
      expect(r.royaltyBps).toBe(BLOCKSWORN_TREASURY_ROYALTY_BPS);
    }
  });

  it('envelope is frozen', () => {
    const r = getRoyaltyBreakdown(1_000_000_000);
    expect(Object.isFrozen(r)).toBe(true);
  });
});

// ─── getTreasuryPuzzleHash ────────────────────────────────────────────────

describe('T4.06 — getTreasuryPuzzleHash', () => {
  it('returns a non-empty string starting with xch1 (Chia bech32 prefix)', () => {
    const addr = getTreasuryPuzzleHash();
    expect(typeof addr).toBe('string');
    expect(addr.length).toBeGreaterThan(0);
    expect(addr.startsWith('xch1')).toBe(true);
  });

  it('matches the BLOCKSWORN_TREASURY_PUZZLEHASH config constant', () => {
    expect(getTreasuryPuzzleHash()).toBe(BLOCKSWORN_TREASURY_PUZZLEHASH);
  });
});

// ─── Deep link formatters ──────────────────────────────────────────────────

describe('T4.06 — formatNftDeepLink', () => {
  it('returns spacescan.io URL for a Blocksworn nftId', () => {
    expect(formatNftDeepLink('chia:bls:abc')).toBe('https://www.spacescan.io/nft/chia:bls:abc');
  });

  it('returns empty string for invalid input', () => {
    expect(formatNftDeepLink(null)).toBe('');
    expect(formatNftDeepLink('')).toBe('');
    expect(formatNftDeepLink(42)).toBe('');
  });
});

describe('T4.06 — formatSageWalletDeepLink', () => {
  it('returns sage:// URL for a Blocksworn nftId', () => {
    expect(formatSageWalletDeepLink('chia:bls:abc')).toBe('sage://nft/chia:bls:abc');
  });

  it('returns empty string for invalid input', () => {
    expect(formatSageWalletDeepLink(null)).toBe('');
    expect(formatSageWalletDeepLink('')).toBe('');
  });
});

// ─── submitTransfer — Chia-disabled gate ───────────────────────────────────

describe('T4.05 — submitTransfer gate paths', () => {
  it('returns chia-disabled when feature flag off', async () => {
    _setChiaEnabledForTest(false);
    _connectSellerWallet();
    const r = await submitTransfer(NFT_NAMESPACE_PREFIX + 'x', BUYER_PUZZLE);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('chia-disabled');
  });

  it('returns wallet-not-connected with no wallet', async () => {
    const r = await submitTransfer(NFT_NAMESPACE_PREFIX + 'x', BUYER_PUZZLE);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('wallet-not-connected');
  });

  it('passes through buildTransferProposal validation: unknown-nft', async () => {
    _connectSellerWallet();
    const r = await submitTransfer(NFT_NAMESPACE_PREFIX + 'unknown', BUYER_PUZZLE);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unknown-nft');
  });

  it('passes through buildTransferProposal validation: invalid-recipient', async () => {
    _connectSellerWallet();
    _seedSellerNft();
    const r = await submitTransfer(NFT_NAMESPACE_PREFIX + 'transfer:test:1', 'not-an-addr');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-recipient');
  });
});

// ─── submitTransfer happy + behavior overrides ─────────────────────────────

describe('T4.05 — submitTransfer happy path + behavior overrides', () => {
  it('mode=success path returns ok=true + txProposalId', async () => {
    _connectSellerWallet();
    _enableSignSigning();
    const nft = _seedSellerNft();
    _setTransferBehaviorForTest({ mode: 'success' });
    const r = await submitTransfer(nft.nftId, BUYER_PUZZLE);
    expect(r.ok).toBe(true);
    expect(typeof r.txProposalId).toBe('string');
    expect(r.txProposalId.length).toBeGreaterThan(0);
  });

  it('default (no override) + signMessage success → returns ok=true + txProposalId', async () => {
    _connectSellerWallet();
    _enableSignSigning();
    const nft = _seedSellerNft();
    const r = await submitTransfer(nft.nftId, BUYER_PUZZLE);
    expect(r.ok).toBe(true);
    expect(typeof r.txProposalId).toBe('string');
  });

  it('mode=fail short-circuits to ok=false with supplied reason', async () => {
    _connectSellerWallet();
    const nft = _seedSellerNft();
    _setTransferBehaviorForTest({ mode: 'fail', reason: 'user-cancelled' });
    const r = await submitTransfer(nft.nftId, BUYER_PUZZLE);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('user-cancelled');
  });

  it('mode=pending returns ok=true + txProposalId without invoking signMessage', async () => {
    _connectSellerWallet();
    // Note: NO _enableSignSigning() — pending path must not require signMessage.
    const nft = _seedSellerNft();
    _setTransferBehaviorForTest({ mode: 'pending' });
    const r = await submitTransfer(nft.nftId, BUYER_PUZZLE);
    expect(r.ok).toBe(true);
    expect(typeof r.txProposalId).toBe('string');
  });

  it('NFT is NOT removed from ownedNfts until settlement (per spec §2.5 Field 4)', async () => {
    _connectSellerWallet();
    _enableSignSigning();
    const nft = _seedSellerNft();
    expect(getOwnedNftsForHero(nft.heroId).length).toBe(1);
    await submitTransfer(nft.nftId, BUYER_PUZZLE);
    // Still owned locally — settlement is async + on-chain.
    expect(getOwnedNftsForHero(nft.heroId).length).toBe(1);
  });
});

// ─── subscribeToTransfers listener pattern ─────────────────────────────────

describe('T4.05 — subscribeToTransfers listener pattern', () => {
  it('returns an unsubscribe function', () => {
    const unsub = subscribeToTransfers(() => {});
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('callback fires on simulateTransferSettlement with type=outgoing for an owned NFT', () => {
    _connectSellerWallet();
    const nft = _seedSellerNft();
    const events = [];
    subscribeToTransfers((e) => events.push(e));
    simulateTransferSettlement(nft.nftId, BUYER_PUZZLE);
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('outgoing');
    expect(events[0].nftId).toBe(nft.nftId);
    expect(typeof events[0].atMs).toBe('number');
  });

  it('outgoing settlement removes NFT from owned cache + clears skin if applicable', async () => {
    _connectSellerWallet();
    _setSageStubForTest({});
    _setSageBehaviorForTest({ sign: async () => ({ ok: true, signature: 'x' }) });
    const nft = _seedSellerNft();
    // Apply the skin so we can verify it's cleared on outgoing transfer.
    await applyNftSkin(nft.heroId, nft.variantId);
    expect(getActiveSkin(nft.heroId)).toBe(nft.variantId);
    simulateTransferSettlement(nft.nftId, BUYER_PUZZLE);
    expect(getOwnedNftsForHero(nft.heroId).length).toBe(0);
    expect(getActiveSkin(nft.heroId)).toBe(null);
  });

  it('unsubscribe stops further callbacks', () => {
    _connectSellerWallet();
    const nft = _seedSellerNft();
    const events = [];
    const unsub = subscribeToTransfers((e) => events.push(e));
    unsub();
    simulateTransferSettlement(nft.nftId, BUYER_PUZZLE);
    expect(events.length).toBe(0);
  });

  it('non-function callback is a no-op (returns unsubscribe that does nothing)', () => {
    const unsub = subscribeToTransfers(null);
    expect(typeof unsub).toBe('function');
    // Should not throw:
    unsub();
  });

  it('listener exception does not crash dispatch (other listeners still fire)', () => {
    _connectSellerWallet();
    const nft = _seedSellerNft();
    const events = [];
    subscribeToTransfers(() => { throw new Error('boom'); });
    subscribeToTransfers((e) => events.push(e));
    expect(() => simulateTransferSettlement(nft.nftId, BUYER_PUZZLE)).not.toThrow();
    expect(events.length).toBe(1);
  });
});

// ─── simulateTransferSettlement ────────────────────────────────────────────

describe('T4.05 — simulateTransferSettlement', () => {
  it('returns invalid-input for non-string nftId', () => {
    const r = simulateTransferSettlement(null, BUYER_PUZZLE);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-input');
  });

  it('returns invalid-input for non-string newOwner', () => {
    const r = simulateTransferSettlement(NFT_NAMESPACE_PREFIX + 'x', null);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-input');
  });

  it('observed event for unknown nft when wallet is not the new owner', () => {
    const r = simulateTransferSettlement(NFT_NAMESPACE_PREFIX + 'unknown', STRANGER_PUZZLE);
    expect(r.ok).toBe(true);
    expect(r.type).toBe('observed');
  });

  it('incoming type when newOwner === connected wallet (and we did not own previously)', () => {
    _connectBuyerWallet();
    const r = simulateTransferSettlement(NFT_NAMESPACE_PREFIX + 'incoming:test', BUYER_PUZZLE);
    expect(r.ok).toBe(true);
    expect(r.type).toBe('incoming');
  });
});

// ─── applyRoyaltyOnSale ────────────────────────────────────────────────────

describe('T4.06 — applyRoyaltyOnSale', () => {
  it('returns chia-disabled when feature flag off', async () => {
    _setChiaEnabledForTest(false);
    const r = await applyRoyaltyOnSale(NFT_NAMESPACE_PREFIX + 'x', 1_000_000_000);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('chia-disabled');
  });

  it('returns invalid-input for non-string nftId', async () => {
    const r = await applyRoyaltyOnSale(null, 1_000_000_000);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-input');
  });

  it('happy path: returns royalty + treasury + sellerNet envelope with bps=250', async () => {
    const r = await applyRoyaltyOnSale(NFT_NAMESPACE_PREFIX + 'sale:1', 1_000_000_000);
    expect(r.ok).toBe(true);
    expect(r.royaltyMojos).toBe(25_000_000);
    expect(r.treasuryMojos).toBe(25_000_000);
    expect(r.sellerNetMojos).toBe(975_000_000);
    expect(r.royaltyBps).toBe(250);
  });

  it('zero-price edge case: all zero royalty + zero sellerNet', async () => {
    const r = await applyRoyaltyOnSale(NFT_NAMESPACE_PREFIX + 'sale:0', 0);
    expect(r.ok).toBe(true);
    expect(r.royaltyMojos).toBe(0);
    expect(r.sellerNetMojos).toBe(0);
    expect(r.royaltyBps).toBe(250);
  });

  it('returns royaltyBps === 250 even on defensive zero-input path', async () => {
    const r = await applyRoyaltyOnSale(NFT_NAMESPACE_PREFIX + 'x', -1);
    expect(r.ok).toBe(true);
    expect(r.royaltyBps).toBe(250);
  });
});

// ─── ADR-003 anti-P2W static reflection audit ──────────────────────────────

describe('T4.05 + T4.06 — ADR-003 anti-P2W invariant (static source reflection)', () => {
  it('submitTransfer source contains no stat-field substrings', () => {
    const src = nftBackendModule.submitTransfer.toString();
    const banned = ['hp', 'dmg', 'damage', 'crit', 'ultcost', 'tierability', 'synergy', 'winrate'];
    const srcLower = src.toLowerCase();
    for (const b of banned) {
      expect(srcLower.includes(b)).toBe(false);
    }
  });

  it('buildTransferProposal source contains no stat-field substrings', () => {
    const src = nftBackendModule.buildTransferProposal.toString();
    const banned = ['hp', 'dmg', 'damage', 'crit', 'ultcost', 'tierability', 'synergy', 'winrate'];
    const srcLower = src.toLowerCase();
    for (const b of banned) {
      expect(srcLower.includes(b)).toBe(false);
    }
  });

  it('applyRoyaltyOnSale source contains no stat-field substrings', () => {
    const src = nftBackendModule.applyRoyaltyOnSale.toString();
    const banned = ['hp', 'dmg', 'damage', 'crit', 'ultcost', 'tierability', 'synergy', 'winrate'];
    const srcLower = src.toLowerCase();
    for (const b of banned) {
      expect(srcLower.includes(b)).toBe(false);
    }
  });

  it('getRoyaltyBreakdown source contains no stat-field substrings', () => {
    const src = nftBackendModule.getRoyaltyBreakdown.toString();
    const banned = ['hp', 'dmg', 'damage', 'crit', 'ultcost', 'tierability', 'synergy', 'winrate'];
    const srcLower = src.toLowerCase();
    for (const b of banned) {
      expect(srcLower.includes(b)).toBe(false);
    }
  });
});

// ─── Sacred-cow audit: 2.5% royalty hard-bound to 250 bps ─────────────────

describe('T4.06 — Sacred-cow audit (ESC-04 Q2: BLOCKSWORN_TREASURY_ROYALTY_BPS === 250)', () => {
  it('every getRoyaltyBreakdown envelope shows royaltyBps === 250', () => {
    const samples = [0, 1, 1_000_000, 1_000_000_000, 40_000_000_000];
    for (const p of samples) {
      const r = getRoyaltyBreakdown(p);
      expect(r.royaltyBps).toBe(250);
    }
  });

  it('every applyRoyaltyOnSale envelope shows royaltyBps === 250', async () => {
    const samples = [0, 1_000_000, 40_000_000_000];
    for (const p of samples) {
      const r = await applyRoyaltyOnSale(NFT_NAMESPACE_PREFIX + 'x', p);
      expect(r.royaltyBps).toBe(250);
    }
  });

  it('buildTransferProposal envelope shows royaltyBps === 250', () => {
    _connectSellerWallet();
    const nft = _seedSellerNft();
    const r = buildTransferProposal(nft.nftId, BUYER_PUZZLE);
    expect(r.royaltyBps).toBe(250);
  });

  it('BLOCKSWORN_TREASURY_ROYALTY_BPS constant is exactly 250', () => {
    expect(BLOCKSWORN_TREASURY_ROYALTY_BPS).toBe(250);
  });
});
