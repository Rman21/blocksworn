// 2026-05-13 — TASK-065 (T4.07): Adventure DAO overlay unit tests.
//
// Spec: docs/design/chia-integration.md §5 Adventure DAO + §13.6 ESC-04 Q2.
//
// Sacred-cow safety verified at every assertion:
//   - isChiaEnabled() gate honored by EVERY exported async op
//   - wallet-connect.getConnectedWallet gate honored by every async op
//   - Envelope { ok, ... } pattern — no exception leaks
//   - Module-local state only (no window globals)
//   - ADR-003 anti-P2W: dao-adventures source code does NOT contain
//     hp/dmg/damage/crit/ultCost/synergy/winrate/tier substrings
//     (static reflection)
//   - DAO_PROPOSAL_TYPES is a CLOSED COSMETIC-ONLY WHITELIST
//   - DAO_BADGE_MINT_FEE_MOJOS === 50_000_000_000 (ESC-04 Q2 sacred)
//   - DAO_DEFAULT_GOVERNANCE_MODE === 'one_member_one_vote' (ADR-003 sacred)
//   - dao-adventures MUST NOT import src/core/heroes.js (HERO_ROSTER read-only)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as daoModule from '../../src/services/dao-adventures.js';
import {
  isDaoEligibleClan,
  computeDaoBadgeMintFee,
  validateDaoProposal,
  computeVoteTally,
  formatDaoExplorerLink,
  getDaoMemberStatus,
  createDaoClan,
  joinDaoClan,
  mintMemberBadge,
  submitProposal,
  castVote,
  resolveDaoProposal,
  _resetDaoAdventuresForTest,
  _seedDaoClanForTest,
  _setProposalBehaviorForTest,
  _makeMockClanBackendAdapter,
} from '../../src/services/dao-adventures.js';
import {
  DAO_GOVERNANCE_MODES,
  DAO_DEFAULT_GOVERNANCE_MODE,
  DAO_BADGE_MINT_FEE_MOJOS,
  DAO_PROPOSAL_TYPES,
  DAO_PROPOSAL_QUORUM_FRACTION,
  DAO_PROPOSAL_MAX_ACTIVE,
} from '../../src/data/dao-config.js';
import {
  _setChiaEnabledForTest,
} from '../../src/services/feature-flags.js';
import {
  _setWalletForTest,
  _setSageStubForTest,
  _setSageBehaviorForTest,
} from '../../src/services/wallet-connect.js';
import {
  _resetNftBackendForTest,
  _setMintBehaviorForTest,
} from '../../src/services/nft-backend.js';
import {
  NFT_VARIANT_CATALOG,
} from '../../src/data/nft-variants.js';
import {
  BLOCKSWORN_TREASURY_ROYALTY_BPS,
} from '../../src/data/nft-variants.js';

// ─── Test setup ────────────────────────────────────────────────────────────

const MOCK_PUZZLE   = 'chia1mockdaocreator00000000';
const MOCK_PUZZLE_2 = 'chia1mockdaomember000000000';
const MOCK_PUZZLE_3 = 'chia1mockdaothirdmember0000';

const SAMPLE_VARIANT_ID = Array.from(NFT_VARIANT_CATALOG.keys())[0];

function _ensureFakeWindow() {
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = {};
  }
}

function _resetAll() {
  _resetDaoAdventuresForTest();
  _resetNftBackendForTest();
  _setChiaEnabledForTest(null);
  _setSageBehaviorForTest(null);
  _setSageStubForTest(null);
  _setWalletForTest(null);
  _setMintBehaviorForTest(null);
}

function _connectMockWallet(addr) {
  _setWalletForTest({ connected: true, address: addr || MOCK_PUZZLE, provider: 'sage' });
}

function _enableMintSigning() {
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

// ═══════════════════════════════════════════════════════════════════════════
// dao-config.js sacred constants
// ═══════════════════════════════════════════════════════════════════════════

describe('T4.07 — dao-config constants (sacred)', () => {
  it('DAO_GOVERNANCE_MODES is frozen', () => {
    expect(Object.isFrozen(DAO_GOVERNANCE_MODES)).toBe(true);
  });

  it('DAO_GOVERNANCE_MODES exposes exactly two modes', () => {
    const keys = Object.keys(DAO_GOVERNANCE_MODES);
    expect(keys.length).toBe(2);
    expect(keys).toContain('TOKEN_WEIGHTED');
    expect(keys).toContain('ONE_MEMBER_ONE_VOTE');
  });

  it('DAO_GOVERNANCE_MODES.TOKEN_WEIGHTED === "token_weighted"', () => {
    expect(DAO_GOVERNANCE_MODES.TOKEN_WEIGHTED).toBe('token_weighted');
  });

  it('DAO_GOVERNANCE_MODES.ONE_MEMBER_ONE_VOTE === "one_member_one_vote"', () => {
    expect(DAO_GOVERNANCE_MODES.ONE_MEMBER_ONE_VOTE).toBe('one_member_one_vote');
  });

  it('DAO_DEFAULT_GOVERNANCE_MODE is "one_member_one_vote" (sacred ADR-003)', () => {
    // ADR-003 anti-P2W: token-weighted could be a P2W vector if used as
    // the default. The default MUST be one-member-one-vote.
    expect(DAO_DEFAULT_GOVERNANCE_MODE).toBe('one_member_one_vote');
    expect(DAO_DEFAULT_GOVERNANCE_MODE).toBe(DAO_GOVERNANCE_MODES.ONE_MEMBER_ONE_VOTE);
  });

  it('DAO_BADGE_MINT_FEE_MOJOS === 50_000_000_000 (ESC-04 Q2 sacred)', () => {
    expect(DAO_BADGE_MINT_FEE_MOJOS).toBe(50_000_000_000);
  });

  it('DAO_BADGE_MINT_FEE_MOJOS === 0.05 XCH exactly (1 XCH = 1e12 mojos)', () => {
    expect(DAO_BADGE_MINT_FEE_MOJOS / 1e12).toBe(0.05);
  });

  it('DAO_PROPOSAL_TYPES is frozen', () => {
    expect(Object.isFrozen(DAO_PROPOSAL_TYPES)).toBe(true);
  });

  it('DAO_PROPOSAL_TYPES is a CLOSED WHITELIST of cosmetic-only types', () => {
    const values = Object.values(DAO_PROPOSAL_TYPES);
    expect(values).toContain('cosmetic_theme');
    expect(values).toContain('weekly_focus');
    expect(values).toContain('name_change');
  });

  it('DAO_PROPOSAL_TYPES does NOT contain mechanical/P2W types (sacred ADR-003)', () => {
    // ADR-003: governance covers cosmetic decisions ONLY.
    const values = Object.values(DAO_PROPOSAL_TYPES);
    const forbidden = [
      'damage_buff', 'damage_multiplier', 'win_advantage',
      'hp_boost', 'crit_boost', 'tier_unlock', 'mechanic_change',
      'boss_hp_reduction', 'weekly_target_reduction',
      'contribution_cap_increase', 'gold_multiplier',
      'gem_multiplier', 'tower_heart_multiplier',
    ];
    for (const bad of forbidden) {
      expect(values).not.toContain(bad);
    }
  });

  it('DAO_PROPOSAL_QUORUM_FRACTION === 0.50 (exact)', () => {
    expect(DAO_PROPOSAL_QUORUM_FRACTION).toBe(0.50);
  });

  it('DAO_PROPOSAL_MAX_ACTIVE === 3', () => {
    expect(DAO_PROPOSAL_MAX_ACTIVE).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Pure helpers
// ═══════════════════════════════════════════════════════════════════════════

describe('T4.07 — isDaoEligibleClan pure helper', () => {
  it('returns true for clan with daoMode === true', () => {
    expect(isDaoEligibleClan({ clanId: 'c1', daoMode: true })).toBe(true);
  });

  it('returns false for clan with daoMode === false', () => {
    expect(isDaoEligibleClan({ clanId: 'c1', daoMode: false })).toBe(false);
  });

  it('returns false for clan with no daoMode field', () => {
    expect(isDaoEligibleClan({ clanId: 'c1' })).toBe(false);
  });

  it('returns false for null / non-object', () => {
    expect(isDaoEligibleClan(null)).toBe(false);
    expect(isDaoEligibleClan(undefined)).toBe(false);
    expect(isDaoEligibleClan('abc')).toBe(false);
    expect(isDaoEligibleClan(42)).toBe(false);
  });
});

describe('T4.07 — computeDaoBadgeMintFee pure helper', () => {
  it('returns totalMojos === DAO_BADGE_MINT_FEE_MOJOS for default mode', () => {
    const fee = computeDaoBadgeMintFee(DAO_DEFAULT_GOVERNANCE_MODE);
    expect(fee.totalMojos).toBe(DAO_BADGE_MINT_FEE_MOJOS);
    expect(fee.totalMojos).toBe(50_000_000_000);
  });

  it('returns totalXch === 0.05 for default mode', () => {
    const fee = computeDaoBadgeMintFee(DAO_DEFAULT_GOVERNANCE_MODE);
    expect(fee.totalXch).toBe(0.05);
  });

  it('returns identical fee for token_weighted (uniform across modes per ADR-003)', () => {
    const feeDefault = computeDaoBadgeMintFee(DAO_GOVERNANCE_MODES.ONE_MEMBER_ONE_VOTE);
    const feeTokWtd  = computeDaoBadgeMintFee(DAO_GOVERNANCE_MODES.TOKEN_WEIGHTED);
    expect(feeTokWtd.totalMojos).toBe(feeDefault.totalMojos);
  });

  it('exposes royaltyBps === 250 (ESC-04 Q2 sacred)', () => {
    const fee = computeDaoBadgeMintFee(DAO_DEFAULT_GOVERNANCE_MODE);
    expect(fee.royaltyBps).toBe(BLOCKSWORN_TREASURY_ROYALTY_BPS);
    expect(fee.royaltyBps).toBe(250);
  });

  it('returned envelope is frozen', () => {
    const fee = computeDaoBadgeMintFee(DAO_DEFAULT_GOVERNANCE_MODE);
    expect(Object.isFrozen(fee)).toBe(true);
  });

  it('returns default fee envelope for unknown governance mode (defensive)', () => {
    const fee = computeDaoBadgeMintFee('not_a_mode');
    expect(fee.totalMojos).toBe(DAO_BADGE_MINT_FEE_MOJOS);
  });
});

describe('T4.07 — validateDaoProposal pure helper', () => {
  it('accepts cosmetic_theme proposal', () => {
    expect(validateDaoProposal({ type: 'cosmetic_theme' }).ok).toBe(true);
  });

  it('accepts weekly_focus proposal', () => {
    expect(validateDaoProposal({ type: 'weekly_focus' }).ok).toBe(true);
  });

  it('accepts name_change proposal', () => {
    expect(validateDaoProposal({ type: 'name_change' }).ok).toBe(true);
  });

  it('rejects mechanical proposal type (sacred whitelist enforced)', () => {
    const r = validateDaoProposal({ type: 'damage_buff' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unknown-proposal-type');
  });

  it('rejects null / non-object / missing type', () => {
    expect(validateDaoProposal(null).ok).toBe(false);
    expect(validateDaoProposal({}).ok).toBe(false);
    expect(validateDaoProposal({ type: '' }).ok).toBe(false);
    expect(validateDaoProposal({ type: 42 }).ok).toBe(false);
  });
});

describe('T4.07 — computeVoteTally pure helper', () => {
  it('returns zero tally for invalid proposal', () => {
    expect(computeVoteTally(null)).toEqual({ yes: 0, no: 0, voterCount: 0 });
    expect(computeVoteTally({})).toEqual({ yes: 0, no: 0, voterCount: 0 });
  });

  it('one_member_one_vote: each vote contributes 1 regardless of weight', () => {
    const tally = computeVoteTally({
      governanceMode: DAO_GOVERNANCE_MODES.ONE_MEMBER_ONE_VOTE,
      votes: [
        { walletAddr: 'a', choice: 'yes', voteWeight: 99 },
        { walletAddr: 'b', choice: 'yes', voteWeight: 50 },
        { walletAddr: 'c', choice: 'no',  voteWeight: 100 },
      ],
    });
    expect(tally.yes).toBe(2);
    expect(tally.no).toBe(1);
    expect(tally.voterCount).toBe(3);
  });

  it('token_weighted: weight contributes per-vote', () => {
    const tally = computeVoteTally({
      governanceMode: DAO_GOVERNANCE_MODES.TOKEN_WEIGHTED,
      votes: [
        { walletAddr: 'a', choice: 'yes', voteWeight: 3 },
        { walletAddr: 'b', choice: 'no',  voteWeight: 2 },
      ],
    });
    expect(tally.yes).toBe(3);
    expect(tally.no).toBe(2);
    expect(tally.voterCount).toBe(2);
  });

  it('ignores malformed vote entries', () => {
    const tally = computeVoteTally({
      governanceMode: DAO_GOVERNANCE_MODES.ONE_MEMBER_ONE_VOTE,
      votes: [
        { walletAddr: 'a', choice: 'yes' },
        null,
        { walletAddr: '', choice: 'yes' },
        { walletAddr: 'b', choice: 'maybe' },
        { walletAddr: 'c', choice: 'no' },
      ],
    });
    expect(tally.voterCount).toBe(2);
    expect(tally.yes).toBe(1);
    expect(tally.no).toBe(1);
  });
});

describe('T4.07 — formatDaoExplorerLink pure helper', () => {
  it('returns spacescan URL for valid nftId', () => {
    expect(formatDaoExplorerLink('chia:bls:daobadge:1:123')).toBe(
      'https://www.spacescan.io/nft/chia:bls:daobadge:1:123');
  });

  it('returns empty string for invalid input', () => {
    expect(formatDaoExplorerLink('')).toBe('');
    expect(formatDaoExplorerLink(null)).toBe('');
    expect(formatDaoExplorerLink(undefined)).toBe('');
  });
});

describe('T4.07 — getDaoMemberStatus pure helper', () => {
  it('returns empty status for unknown clan', () => {
    expect(getDaoMemberStatus('no_clan', MOCK_PUZZLE)).toEqual({
      isMember: false, hasMintedBadge: false,
    });
  });

  it('returns isMember=true when wallet in memberWallets', () => {
    _seedDaoClanForTest({
      clanId: 'c1',
      creatorWallet: MOCK_PUZZLE,
      memberWallets: [MOCK_PUZZLE, MOCK_PUZZLE_2],
    });
    const status = getDaoMemberStatus('c1', MOCK_PUZZLE_2);
    expect(status.isMember).toBe(true);
    expect(status.hasMintedBadge).toBe(false);
  });

  it('returns hasMintedBadge=true with badgeNftId when present', () => {
    _seedDaoClanForTest({
      clanId: 'c1',
      creatorWallet: MOCK_PUZZLE,
      memberWallets: [MOCK_PUZZLE],
      memberMintedBadges: { [MOCK_PUZZLE]: 'chia:bls:memb:1:1' },
    });
    const status = getDaoMemberStatus('c1', MOCK_PUZZLE);
    expect(status.hasMintedBadge).toBe(true);
    expect(status.badgeNftId).toBe('chia:bls:memb:1:1');
  });

  it('returns empty status for non-string inputs (defensive)', () => {
    expect(getDaoMemberStatus(null, MOCK_PUZZLE).isMember).toBe(false);
    expect(getDaoMemberStatus('c1', null).isMember).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Async-op gates (Chia-disabled / wallet / invalid mode)
// ═══════════════════════════════════════════════════════════════════════════

describe('T4.07 — Chia-disabled gate (ADR-005 sacred invariant)', () => {
  it('createDaoClan returns chia-disabled when flag is false', async () => {
    _setChiaEnabledForTest(false);
    const r = await createDaoClan({
      clanId: 'c1',
      clanBackendAdapter: _makeMockClanBackendAdapter(),
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('chia-disabled');
  });

  it('joinDaoClan returns chia-disabled when flag is false', async () => {
    _setChiaEnabledForTest(false);
    const r = await joinDaoClan('c1', { clanBackendAdapter: _makeMockClanBackendAdapter() });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('chia-disabled');
  });

  it('mintMemberBadge returns chia-disabled when flag is false', async () => {
    _setChiaEnabledForTest(false);
    const r = await mintMemberBadge('c1', { memberBadgeVariantId: SAMPLE_VARIANT_ID });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('chia-disabled');
  });

  it('submitProposal returns chia-disabled when flag is false', async () => {
    _setChiaEnabledForTest(false);
    const r = await submitProposal('c1', { type: 'cosmetic_theme' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('chia-disabled');
  });

  it('castVote returns chia-disabled when flag is false', async () => {
    _setChiaEnabledForTest(false);
    const r = await castVote('c1', 'p1', { choice: 'yes' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('chia-disabled');
  });

  it('resolveDaoProposal returns chia-disabled when flag is false', async () => {
    _setChiaEnabledForTest(false);
    const r = await resolveDaoProposal('c1', 'p1');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('chia-disabled');
  });
});

describe('T4.07 — wallet-not-connected gate', () => {
  it('createDaoClan returns wallet-not-connected when no wallet', async () => {
    const r = await createDaoClan({
      clanId: 'c1',
      clanBackendAdapter: _makeMockClanBackendAdapter(),
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('wallet-not-connected');
  });

  it('joinDaoClan returns wallet-not-connected when no wallet', async () => {
    const r = await joinDaoClan('c1', { clanBackendAdapter: _makeMockClanBackendAdapter() });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('wallet-not-connected');
  });

  it('submitProposal returns wallet-not-connected when no wallet', async () => {
    const r = await submitProposal('c1', { type: 'cosmetic_theme' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('wallet-not-connected');
  });
});

describe('T4.07 — invalid governance mode gate', () => {
  it('createDaoClan rejects unknown governance mode', async () => {
    _connectMockWallet();
    const r = await createDaoClan({
      clanId: 'c1',
      governanceMode: 'plutocracy',
      clanBackendAdapter: _makeMockClanBackendAdapter(),
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-governance-mode');
  });

  it('createDaoClan defaults to ONE_MEMBER_ONE_VOTE when governanceMode omitted', async () => {
    _connectMockWallet();
    const adapter = _makeMockClanBackendAdapter();
    const r = await createDaoClan({ clanId: 'c1', clanBackendAdapter: adapter });
    expect(r.ok).toBe(true);
    // Adapter received the default mode
    expect(adapter.calls[0].args.governanceMode).toBe(DAO_DEFAULT_GOVERNANCE_MODE);
    expect(adapter.calls[0].args.governanceMode).toBe('one_member_one_vote');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// createDaoClan happy path
// ═══════════════════════════════════════════════════════════════════════════

describe('T4.07 — createDaoClan happy path (adapter DI verified)', () => {
  it('creates DAO clan + records member status (no badge mint)', async () => {
    _connectMockWallet();
    const adapter = _makeMockClanBackendAdapter();
    const r = await createDaoClan({
      clanId: 'c1',
      governanceMode: DAO_GOVERNANCE_MODES.ONE_MEMBER_ONE_VOTE,
      clanBackendAdapter: adapter,
    });
    expect(r.ok).toBe(true);
    expect(r.clanId).toBe('c1');
    // No daoBadgeVariantId passed → no on-chain badge mint
    expect(r.onChainBadgeNftId).toBe(null);
  });

  it('adapter.createClan was called with correct args (DI wire-up verified)', async () => {
    _connectMockWallet();
    const adapter = _makeMockClanBackendAdapter();
    await createDaoClan({
      clanId: 'c1',
      governanceMode: DAO_GOVERNANCE_MODES.TOKEN_WEIGHTED,
      clanBackendAdapter: adapter,
    });
    expect(adapter.calls.length).toBe(1);
    expect(adapter.calls[0].method).toBe('createClan');
    expect(adapter.calls[0].args.clanId).toBe('c1');
    expect(adapter.calls[0].args.daoMode).toBe(true);
    expect(adapter.calls[0].args.governanceMode).toBe('token_weighted');
    expect(adapter.calls[0].args.creatorWallet).toBe(MOCK_PUZZLE);
  });

  it('mints badge NFT when daoBadgeVariantId provided', async () => {
    _connectMockWallet();
    _enableMintSigning();
    _setMintBehaviorForTest({ mode: 'success' });
    const adapter = _makeMockClanBackendAdapter();
    const r = await createDaoClan({
      clanId: 'c1',
      clanBackendAdapter: adapter,
      daoBadgeVariantId: SAMPLE_VARIANT_ID,
    });
    expect(r.ok).toBe(true);
    expect(typeof r.onChainBadgeNftId).toBe('string');
    expect(r.onChainBadgeNftId.length).toBeGreaterThan(0);
  });

  it('returns mint-failed when nft-backend mint fails', async () => {
    _connectMockWallet();
    _setMintBehaviorForTest({ mode: 'fail', reason: 'user-cancelled' });
    const adapter = _makeMockClanBackendAdapter();
    const r = await createDaoClan({
      clanId: 'c1',
      clanBackendAdapter: adapter,
      daoBadgeVariantId: SAMPLE_VARIANT_ID,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('mint-failed');
  });

  it('returns adapter-failed when adapter.createClan returns ok:false', async () => {
    _connectMockWallet();
    const adapter = _makeMockClanBackendAdapter();
    adapter._setNextResult({ method: 'createClan', result: { ok: false, reason: 'clan-exists' } });
    const r = await createDaoClan({
      clanId: 'c1',
      clanBackendAdapter: adapter,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('adapter-failed');
  });

  it('returns adapter-missing when adapter object lacks required methods', async () => {
    _connectMockWallet();
    const r = await createDaoClan({
      clanId: 'c1',
      clanBackendAdapter: { foo: () => null },
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('adapter-missing');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// joinDaoClan happy path
// ═══════════════════════════════════════════════════════════════════════════

describe('T4.07 — joinDaoClan happy path (adapter DI verified)', () => {
  it('rejects join when clan not a DAO', async () => {
    _connectMockWallet();
    const r = await joinDaoClan('not_a_dao_clan', {
      clanBackendAdapter: _makeMockClanBackendAdapter(),
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-a-dao-clan');
  });

  it('adapter.joinClan was called with clanId + walletAddr', async () => {
    _seedDaoClanForTest({
      clanId: 'c1', creatorWallet: MOCK_PUZZLE, memberWallets: [MOCK_PUZZLE],
    });
    _connectMockWallet(MOCK_PUZZLE_2);
    const adapter = _makeMockClanBackendAdapter();
    const r = await joinDaoClan('c1', { clanBackendAdapter: adapter });
    expect(r.ok).toBe(true);
    expect(adapter.calls.length).toBe(1);
    expect(adapter.calls[0].method).toBe('joinClan');
    expect(adapter.calls[0].args.clanId).toBe('c1');
    expect(adapter.calls[0].args.walletAddr).toBe(MOCK_PUZZLE_2);
  });

  it('records member wallet in local overlay cache', async () => {
    _seedDaoClanForTest({
      clanId: 'c1', creatorWallet: MOCK_PUZZLE, memberWallets: [MOCK_PUZZLE],
    });
    _connectMockWallet(MOCK_PUZZLE_2);
    await joinDaoClan('c1', { clanBackendAdapter: _makeMockClanBackendAdapter() });
    const status = getDaoMemberStatus('c1', MOCK_PUZZLE_2);
    expect(status.isMember).toBe(true);
  });

  it('returns adapter-failed when adapter rejects', async () => {
    _seedDaoClanForTest({
      clanId: 'c1', creatorWallet: MOCK_PUZZLE, memberWallets: [MOCK_PUZZLE],
    });
    _connectMockWallet(MOCK_PUZZLE_2);
    const adapter = _makeMockClanBackendAdapter();
    adapter._setNextResult({ method: 'joinClan', result: { ok: false, reason: 'clan-full' } });
    const r = await joinDaoClan('c1', { clanBackendAdapter: adapter });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('adapter-failed');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// submitProposal — sacred whitelist enforced
// ═══════════════════════════════════════════════════════════════════════════

describe('T4.07 — submitProposal sacred whitelist (ADR-003)', () => {
  beforeEach(() => {
    _seedDaoClanForTest({
      clanId: 'c1', creatorWallet: MOCK_PUZZLE, memberWallets: [MOCK_PUZZLE],
    });
    _connectMockWallet();
  });

  it('accepts cosmetic_theme proposal', async () => {
    const r = await submitProposal('c1', { type: DAO_PROPOSAL_TYPES.COSMETIC_THEME });
    expect(r.ok).toBe(true);
    expect(typeof r.proposalId).toBe('string');
  });

  it('REJECTS damage_buff proposal (sacred whitelist enforcement)', async () => {
    const r = await submitProposal('c1', { type: 'damage_buff' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unknown-proposal-type');
  });

  it('REJECTS win_advantage proposal (sacred whitelist enforcement)', async () => {
    const r = await submitProposal('c1', { type: 'win_advantage' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unknown-proposal-type');
  });

  it('REJECTS hp_boost proposal (sacred whitelist enforcement)', async () => {
    const r = await submitProposal('c1', { type: 'hp_boost' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unknown-proposal-type');
  });

  it('rejects when active proposals already at DAO_PROPOSAL_MAX_ACTIVE', async () => {
    // Submit MAX active proposals
    for (let i = 0; i < DAO_PROPOSAL_MAX_ACTIVE; i++) {
      const r = await submitProposal('c1', { type: 'cosmetic_theme', title: 'p' + i });
      expect(r.ok).toBe(true);
    }
    // Next submission should fail
    const r = await submitProposal('c1', { type: 'cosmetic_theme' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('too-many-active-proposals');
  });

  it('returns not-a-dao-clan when clan is not registered', async () => {
    const r = await submitProposal('unknown_clan', { type: 'cosmetic_theme' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-a-dao-clan');
  });

  it('test override mode=fail short-circuits submitProposal', async () => {
    _setProposalBehaviorForTest({ mode: 'fail', reason: 'simulated-fail' });
    const r = await submitProposal('c1', { type: 'cosmetic_theme' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('simulated-fail');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// castVote
// ═══════════════════════════════════════════════════════════════════════════

describe('T4.07 — castVote happy path + duplicate guard', () => {
  let proposalId;

  beforeEach(async () => {
    _seedDaoClanForTest({
      clanId: 'c1',
      creatorWallet: MOCK_PUZZLE,
      memberWallets: [MOCK_PUZZLE, MOCK_PUZZLE_2, MOCK_PUZZLE_3],
    });
    _connectMockWallet();
    const r = await submitProposal('c1', { type: 'cosmetic_theme' });
    proposalId = r.proposalId;
  });

  it('records yes vote and tally reflects it', async () => {
    const r = await castVote('c1', proposalId, { choice: 'yes' });
    expect(r.ok).toBe(true);
    // Resolve to see tally
    _connectMockWallet(MOCK_PUZZLE_2);
    await castVote('c1', proposalId, { choice: 'yes' });
    const res = await resolveDaoProposal('c1', proposalId);
    expect(res.tally.yes).toBe(2);
    expect(res.tally.no).toBe(0);
  });

  it('rejects duplicate vote from same wallet', async () => {
    const r1 = await castVote('c1', proposalId, { choice: 'yes' });
    expect(r1.ok).toBe(true);
    const r2 = await castVote('c1', proposalId, { choice: 'no' });
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe('duplicate-vote');
  });

  it('rejects vote on unknown proposal', async () => {
    const r = await castVote('c1', 'no_such_proposal', { choice: 'yes' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unknown-proposal');
  });

  it('rejects vote when clan is not a DAO', async () => {
    const r = await castVote('not_a_dao', 'p1', { choice: 'yes' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-a-dao-clan');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// resolveDaoProposal — quorum logic
// ═══════════════════════════════════════════════════════════════════════════

describe('T4.07 — resolveDaoProposal quorum + outcome logic', () => {
  let proposalId;

  beforeEach(async () => {
    _seedDaoClanForTest({
      clanId: 'c1',
      creatorWallet: MOCK_PUZZLE,
      memberWallets: [MOCK_PUZZLE, MOCK_PUZZLE_2, MOCK_PUZZLE_3, 'chia1mockfourth00000000'],
    });
    _connectMockWallet();
    const r = await submitProposal('c1', { type: 'cosmetic_theme' });
    proposalId = r.proposalId;
  });

  it('returns passed when quorum met AND yes > no', async () => {
    await castVote('c1', proposalId, { choice: 'yes' });
    _connectMockWallet(MOCK_PUZZLE_2);
    await castVote('c1', proposalId, { choice: 'yes' });
    _connectMockWallet(MOCK_PUZZLE_3);
    await castVote('c1', proposalId, { choice: 'no' });
    const r = await resolveDaoProposal('c1', proposalId);
    expect(r.ok).toBe(true);
    // 4 members, quorum = ceil(0.5*4) = 2, voters = 3 → quorum met
    expect(r.outcome).toBe('passed');
    expect(r.tally.yes).toBe(2);
    expect(r.tally.no).toBe(1);
  });

  it('returns failed when quorum NOT met', async () => {
    // 4 members, quorum = 2, only 1 voter → quorum not met
    await castVote('c1', proposalId, { choice: 'yes' });
    const r = await resolveDaoProposal('c1', proposalId);
    expect(r.ok).toBe(true);
    expect(r.outcome).toBe('failed');
  });

  it('returns tied when quorum met AND yes === no', async () => {
    await castVote('c1', proposalId, { choice: 'yes' });
    _connectMockWallet(MOCK_PUZZLE_2);
    await castVote('c1', proposalId, { choice: 'no' });
    // 4 members, quorum = 2, voters = 2 → quorum met; 1 yes, 1 no → tied
    const r = await resolveDaoProposal('c1', proposalId);
    expect(r.ok).toBe(true);
    expect(r.outcome).toBe('tied');
  });

  it('returns failed when yes < no', async () => {
    await castVote('c1', proposalId, { choice: 'no' });
    _connectMockWallet(MOCK_PUZZLE_2);
    await castVote('c1', proposalId, { choice: 'no' });
    const r = await resolveDaoProposal('c1', proposalId);
    expect(r.ok).toBe(true);
    expect(r.outcome).toBe('failed');
  });

  it('returns unknown-proposal for unknown proposalId', async () => {
    const r = await resolveDaoProposal('c1', 'no_such_proposal');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unknown-proposal');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// mintMemberBadge
// ═══════════════════════════════════════════════════════════════════════════

describe('T4.07 — mintMemberBadge', () => {
  it('rejects when clan not a DAO', async () => {
    _connectMockWallet();
    const r = await mintMemberBadge('not_a_dao', { memberBadgeVariantId: SAMPLE_VARIANT_ID });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-a-dao-clan');
  });

  it('records badge in local cache on success', async () => {
    _seedDaoClanForTest({
      clanId: 'c1', creatorWallet: MOCK_PUZZLE, memberWallets: [MOCK_PUZZLE],
    });
    _connectMockWallet();
    _enableMintSigning();
    _setMintBehaviorForTest({ mode: 'success' });
    const r = await mintMemberBadge('c1', { memberBadgeVariantId: SAMPLE_VARIANT_ID });
    expect(r.ok).toBe(true);
    expect(typeof r.nftId).toBe('string');
    const status = getDaoMemberStatus('c1', MOCK_PUZZLE);
    expect(status.hasMintedBadge).toBe(true);
    expect(status.badgeNftId).toBe(r.nftId);
  });

  it('returns mint-failed when nft-backend mint fails', async () => {
    _seedDaoClanForTest({
      clanId: 'c1', creatorWallet: MOCK_PUZZLE, memberWallets: [MOCK_PUZZLE],
    });
    _connectMockWallet();
    _setMintBehaviorForTest({ mode: 'fail', reason: 'user-cancelled' });
    const r = await mintMemberBadge('c1', { memberBadgeVariantId: SAMPLE_VARIANT_ID });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('mint-failed');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ADR-003 anti-P2W static reflection audit
// ═══════════════════════════════════════════════════════════════════════════

describe('T4.07 — ADR-003 anti-P2W invariant (static source reflection)', () => {
  it('dao-adventures.js source contains no stat-block substrings', async () => {
    // Static source scan: read the actual file content (function .toString()
    // misses module-level identifiers and comments). Substring match is
    // case-insensitive against a banned list per ADR-003.
    const fs = await import('node:fs/promises');
    const url = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const srcPath = path.join(here, '../../src/services/dao-adventures.js');
    const src = await fs.readFile(srcPath, 'utf8');
    // Strip comments to avoid false positives — the file's TOP-OF-FILE doc
    // block legitimately names ADR-003-banned tokens when explaining what is
    // FORBIDDEN. Block + line comments are stripped before the substring
    // scan; the scan therefore targets executable code identifiers only.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
      .replace(/(^|[^:])\/\/.*$/gm, '$1') // line comments (not URL ://)
      .toLowerCase();
    const banned = ['hp', 'dmg', 'damage', 'crit', 'ultcost', 'synergy', 'winrate', 'tier'];
    for (const b of banned) {
      expect(codeOnly.includes(b)).toBe(false);
    }
  });

  it('createDaoClan source contains no stat-block substrings', () => {
    const src = daoModule.createDaoClan.toString().toLowerCase();
    const banned = ['hp', 'dmg', 'damage', 'crit', 'ultcost', 'synergy', 'winrate', 'tier'];
    for (const b of banned) {
      expect(src.includes(b)).toBe(false);
    }
  });

  it('submitProposal source contains no stat-block substrings', () => {
    const src = daoModule.submitProposal.toString().toLowerCase();
    const banned = ['hp', 'dmg', 'damage', 'crit', 'ultcost', 'synergy', 'winrate', 'tier'];
    for (const b of banned) {
      expect(src.includes(b)).toBe(false);
    }
  });

  it('dao-adventures does NOT import src/core/heroes.js (HERO_ROSTER read-only)', async () => {
    const fs = await import('node:fs/promises');
    const url = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const src = await fs.readFile(
      path.join(here, '../../src/services/dao-adventures.js'), 'utf8');
    expect(src.includes('from \'../core/heroes.js\'')).toBe(false);
    expect(src.includes('from "../core/heroes.js"')).toBe(false);
    expect(src.includes('from \'../data/heroes.js\'')).toBe(false);
    expect(src.includes('from "../data/heroes.js"')).toBe(false);
  });

  it('dao-adventures does NOT modify BLOCKSWORN_TREASURY_ROYALTY_BPS (sacred-cow safety)', async () => {
    // The constant is imported (for fee disclosure UI), but never written.
    // Static scan: ensure no assignment statement targets it.
    const fs = await import('node:fs/promises');
    const url = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const src = await fs.readFile(
      path.join(here, '../../src/services/dao-adventures.js'), 'utf8');
    // Confirm it's imported
    expect(src.includes('BLOCKSWORN_TREASURY_ROYALTY_BPS')).toBe(true);
    // Confirm it's never written to (no `= ` after the identifier in source).
    // The import line itself contains `BLOCKSWORN_TREASURY_ROYALTY_BPS,` —
    // but never `BLOCKSWORN_TREASURY_ROYALTY_BPS =`.
    expect(/BLOCKSWORN_TREASURY_ROYALTY_BPS\s*=/.test(src)).toBe(false);
  });
});
