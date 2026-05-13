// 2026-05-13 — TASK-065 (T4.07): Adventure DAO overlay (wallet-gated clan).
//
// Spec: docs/design/chia-integration.md §5 Adventure DAO + §13.6 ESC-04 Q2.
//
// PHASE 3 INTEGRATION NOTE (CRITICAL)
// -----------------------------------
// This worktree is branched from origin/main which has Phase 1+2 but NOT
// Phase 3 yet (Phase 3 clan-backend lives in PR #162 awaiting Roman merge).
// Therefore T4.07 is built as a STANDALONE wallet-gated DAO OVERLAY service
// that defines a clan-overlay adapter interface and uses dependency
// injection for clan operations. When Phase 3 merges, the production
// wire-up is a one-line import update (see T4.07.1 follow-up).
//
// Adapter contract (clanBackendAdapter argument):
//   {
//     createClan: async ({clanId, governanceMode, ...}) => {ok, clanId?, reason?},
//     getClan:    async (clanId) => {ok, clan?, reason?},
//     joinClan:   async (clanId, {walletAddr, ...}) => {ok, reason?},
//   }
//
// Sacred-cow safety (ADR-003 + CLAUDE.md §2.7):
//   - DAO progression IDENTICAL to non-DAO (parity invariant). T4.10 anti-P2W
//     audit verifies parity vs non-DAO clans statistically.
//   - The DAO confers ONLY: on-chain provenance + governance display + tradable
//     membership badge. NEVER mechanical advantage.
//   - DAO_PROPOSAL_TYPES is a CLOSED COSMETIC-ONLY WHITELIST. submitProposal
//     REJECTS any type not in the whitelist (sacred-enforced).
//   - DAO_BADGE_MINT_FEE_MOJOS === 50_000_000_000 (ESC-04 Q2 sacred).
//   - DAO_DEFAULT_GOVERNANCE_MODE === 'one_member_one_vote' (avoids token-
//     weighted P2W vector per ADR-003).
//   - This module NEVER imports HERO_ROSTER, V_HAPTICS, NARRATOR_LINES,
//     GEM_PACKS, Battle Pass, Tower retry ladder, Tower leaderboards,
//     TOWER_PACTS, HERO_TIER_ABILITIES.
//   - Source code is statically audited for forbidden stat-block substrings
//     (hp/dmg/damage/crit/ultCost/synergy/winrate/tier) — see
//     tests/unit/dao-adventures.test.js ADR-003 anti-P2W block.
//   - Per ADR-004 (hybrid): lives in src/services/, never imported by legacy.
//   - Per ADR-005 (mobile feature flag, T4.09): EVERY exported async op
//     first checks isChiaEnabled() and returns {ok:false, reason:'chia-disabled'}
//     if the flag is off.
//
// Envelope pattern (per Phase 3 backend convention):
//   - All async ops return { ok: boolean, ...payload } and NEVER throw.
//   - Common reason codes:
//       'chia-disabled'         — isChiaEnabled() === false
//       'wallet-not-connected'  — connectWallet has not been called
//       'invalid-input'         — defensive guard (bad shape)
//       'invalid-governance-mode' — governanceMode not in DAO_GOVERNANCE_MODES
//       'not-a-dao-clan'        — clanId is not registered as a DAO overlay
//       'unknown-proposal-type' — proposal.type not in DAO_PROPOSAL_TYPES whitelist
//       'too-many-active-proposals' — clan already has DAO_PROPOSAL_MAX_ACTIVE
//       'unknown-proposal'      — proposalId not found
//       'duplicate-vote'        — wallet already voted on this proposal
//       'adapter-missing'       — clanBackendAdapter missing required method
//       'adapter-failed'        — clanBackendAdapter call returned ok:false
//       'mint-failed'           — NFT-backend mint call returned ok:false
//       'exception'             — caught exception (returns `error: String(e)`)
//
// V1 stub mode per spec §5 + TODO(T4.12):
//   - Proposals are stored in module-local cache; on-chain proposal
//     submission is wired in T4.12 (live Chia full-node RPC).
//   - `_setProposalBehaviorForTest({mode:'success'|'fail'})` injects
//     deterministic results for unit tests.

import { isChiaEnabled } from './feature-flags.js';
import { log } from './logger.js';
import { getConnectedWallet } from './wallet-connect.js';
import { mintNftVariant } from './nft-backend.js';
import {
  BLOCKSWORN_TREASURY_ROYALTY_BPS,
} from '../data/nft-variants.js';
import {
  DAO_GOVERNANCE_MODES,
  DAO_DEFAULT_GOVERNANCE_MODE,
  DAO_BADGE_MINT_FEE_MOJOS,
  DAO_PROPOSAL_TYPES,
  DAO_PROPOSAL_QUORUM_FRACTION,
  DAO_PROPOSAL_MAX_ACTIVE,
} from '../data/dao-config.js';

// ─── Module-local state ────────────────────────────────────────────────────
// Per Phase 1 standards: no window globals. State lives here. Phase 4 V1
// scope is session-only (no persistence to localStorage); T4.12 wires the
// live Firestore + Chia indexer sync.

function _emptyState() {
  return {
    daoClans:         Object.create(null),    // clanId → daoClan record
    pendingProposals: Object.create(null),    // proposalId → proposal record
  };
}

let _state = _emptyState();
let _proposalBehaviorOverride = null;
let _proposalCounter = 0;

// ─── Pure helpers (synchronous, no gating) ─────────────────────────────────

/**
 * Pure helper: determine whether a clan object is DAO-eligible. Accepts
 * either a Phase 3 clan shape (real or stub) and inspects the `daoMode`
 * flag per spec §5.7 Field 1.
 *
 * Pure; never throws.
 *
 * @param {object} clan
 * @returns {boolean}
 */
export function isDaoEligibleClan(clan) {
  if (!clan || typeof clan !== 'object') return false;
  return clan.daoMode === true;
}

/**
 * Pure helper: compute the DAO badge mint fee breakdown for UI display.
 *
 * Per ESC-04 Q2 sacred ruling: total fee = 0.05 XCH = 50_000_000_000 mojos.
 * The fee is split conceptually into a base portion (gas + on-chain
 * descriptor mint) and a premium portion (treasury); for V1 both flow
 * through the same Chia mint transaction. Returns explicit base/premium
 * fields for future split-fee UI affordance.
 *
 * For token-weighted governance the fee is identical — governance mode
 * does NOT affect the mint fee. (ADR-003 sacred: no mechanical advantage
 * tied to mode choice, so the fee tier is uniform.)
 *
 * Pure; never throws. Defensive against unknown governance mode (returns
 * the default-mode fee envelope).
 *
 * @param {string} governanceMode
 * @returns {{baseMojos:number, premiumMojos:number, totalMojos:number, totalXch:number, royaltyBps:number}}
 */
export function computeDaoBadgeMintFee(governanceMode) {
  // V1: fee is uniform across governance modes per ADR-003 sacred invariant
  // (mode choice must NOT confer mechanical or economic advantage). We still
  // accept the governanceMode parameter so the API stays forward-compatible
  // with future fee tiers, but the math is currently uniform.
  const _modeKnown = governanceMode === DAO_GOVERNANCE_MODES.TOKEN_WEIGHTED
    || governanceMode === DAO_GOVERNANCE_MODES.ONE_MEMBER_ONE_VOTE;
  // For V1: base = full fee, premium = 0. T4.12 may split when treasury
  // routing lands.
  void _modeKnown;
  const baseMojos = DAO_BADGE_MINT_FEE_MOJOS;
  const premiumMojos = 0;
  const totalMojos = baseMojos + premiumMojos;
  return Object.freeze({
    baseMojos,
    premiumMojos,
    totalMojos,
    totalXch: totalMojos / 1e12,
    royaltyBps: BLOCKSWORN_TREASURY_ROYALTY_BPS,
  });
}

/**
 * Pure helper: defensive proposal shape validation.
 * Returns { ok: true } on success or { ok: false, reason } on failure.
 *
 * Sacred-enforced: proposal.type MUST be in DAO_PROPOSAL_TYPES whitelist
 * (cosmetic-only per ADR-003 anti-P2W). This is the SINGLE source of truth
 * for the whitelist gate.
 *
 * Pure; never throws.
 *
 * @param {object} proposal
 * @returns {{ok:boolean, reason?:string}}
 */
export function validateDaoProposal(proposal) {
  if (!proposal || typeof proposal !== 'object') {
    return { ok: false, reason: 'invalid-input' };
  }
  if (typeof proposal.type !== 'string' || !proposal.type) {
    return { ok: false, reason: 'invalid-input' };
  }
  const allowedTypes = Object.values(DAO_PROPOSAL_TYPES);
  if (!allowedTypes.includes(proposal.type)) {
    return { ok: false, reason: 'unknown-proposal-type' };
  }
  return { ok: true };
}

/**
 * Pure helper: aggregate votes from a proposal record into a tally.
 * Supports both 'token_weighted' and 'one_member_one_vote' modes.
 *
 * Tally shape:
 *   { yes: number, no: number, voterCount: number }
 *
 * For 'one_member_one_vote': each vote contributes 1 to the relevant
 * counter regardless of voteWeight.
 *
 * For 'token_weighted': each vote contributes voteWeight (default 1) to
 * the relevant counter.
 *
 * Pure; never throws. Defensive against missing votes / invalid shape.
 *
 * @param {object} proposal — { governanceMode, votes: [{walletAddr, choice, voteWeight}] }
 * @returns {{yes:number, no:number, voterCount:number}}
 */
export function computeVoteTally(proposal) {
  const zero = Object.freeze({ yes: 0, no: 0, voterCount: 0 });
  if (!proposal || typeof proposal !== 'object') return zero;
  if (!Array.isArray(proposal.votes)) return zero;
  const tokenWeighted = proposal.governanceMode === DAO_GOVERNANCE_MODES.TOKEN_WEIGHTED;
  let yes = 0;
  let no = 0;
  let voterCount = 0;
  for (const v of proposal.votes) {
    if (!v || typeof v !== 'object') continue;
    if (typeof v.walletAddr !== 'string' || !v.walletAddr) continue;
    if (v.choice !== 'yes' && v.choice !== 'no') continue;
    voterCount++;
    let weight = 1;
    if (tokenWeighted
        && typeof v.voteWeight === 'number'
        && Number.isFinite(v.voteWeight)
        && v.voteWeight > 0) {
      weight = v.voteWeight;
    }
    if (v.choice === 'yes') yes += weight;
    else no += weight;
  }
  return Object.freeze({ yes, no, voterCount });
}

/**
 * Pure helper: format a Chia explorer deep link for a DAO badge NFT.
 * Per spec §5.4 cosmetic-banner reference: opens Spacescan.io.
 *
 * Pure; never throws. Returns empty string for invalid input.
 *
 * @param {string} onChainBadgeNftId
 * @returns {string}
 */
export function formatDaoExplorerLink(onChainBadgeNftId) {
  if (typeof onChainBadgeNftId !== 'string' || !onChainBadgeNftId) return '';
  return 'https://www.spacescan.io/nft/' + onChainBadgeNftId;
}

/**
 * Pure helper: local cache lookup for a wallet's DAO membership status
 * within a given clan. Returns:
 *   { isMember: boolean, hasMintedBadge: boolean, badgeNftId?: string }
 *
 * Pure; never throws. Defensive against unknown clanId / wallet.
 *
 * @param {string} clanId
 * @param {string} walletAddr
 * @returns {{isMember:boolean, hasMintedBadge:boolean, badgeNftId?:string}}
 */
export function getDaoMemberStatus(clanId, walletAddr) {
  const empty = Object.freeze({ isMember: false, hasMintedBadge: false });
  if (typeof clanId !== 'string' || !clanId) return empty;
  if (typeof walletAddr !== 'string' || !walletAddr) return empty;
  const clan = _state.daoClans[clanId];
  if (!clan) return empty;
  const memberBadges = clan.memberMintedBadges || Object.create(null);
  const badgeNftId = memberBadges[walletAddr];
  const isMember = (clan.memberWallets || []).indexOf(walletAddr) !== -1
    || typeof badgeNftId === 'string';
  if (badgeNftId) {
    return Object.freeze({ isMember, hasMintedBadge: true, badgeNftId });
  }
  return Object.freeze({ isMember, hasMintedBadge: false });
}

// ─── Internal helpers ──────────────────────────────────────────────────────

function _isValidGovernanceMode(mode) {
  return mode === DAO_GOVERNANCE_MODES.TOKEN_WEIGHTED
    || mode === DAO_GOVERNANCE_MODES.ONE_MEMBER_ONE_VOTE;
}

function _isAdapterValid(adapter) {
  if (!adapter || typeof adapter !== 'object') return false;
  return typeof adapter.createClan === 'function'
    && typeof adapter.getClan === 'function'
    && typeof adapter.joinClan === 'function';
}

function _synthesizeProposalId(clanId) {
  _proposalCounter++;
  return 'dao_prop:' + clanId + ':' + _proposalCounter + ':' + Date.now();
}

function _countActiveProposalsForClan(clanId) {
  let n = 0;
  for (const pid in _state.pendingProposals) {
    if (Object.prototype.hasOwnProperty.call(_state.pendingProposals, pid)) {
      const p = _state.pendingProposals[pid];
      if (p && p.clanId === clanId && p.status === 'active') n++;
    }
  }
  return n;
}

// ─── Async ops (gated by isChiaEnabled + wallet check) ─────────────────────

/**
 * Create a DAO clan overlay record. Per spec §5.2 create flow:
 *   1. wallet check (caller wallet connected — gate)
 *   2. mint-fee disclosure (caller UI handles; we just record the fee)
 *   3. invoke adapter.createClan to register the Phase 3 clan substrate
 *   4. mint the DAO badge NFT via nft-backend.mintNftVariant
 *   5. store the DAO overlay record in module-local cache
 *
 * The clanBackendAdapter is dependency-injected so this service can ship
 * before Phase 3 lands in this branch (PR #162). When Phase 3 merges, the
 * production wire-up imports the real clan-backend's exported adapter.
 *
 * Sacred-cow note: DAO progression is IDENTICAL to non-DAO (spec §5.1
 * parity invariant). This function does NOT modify any Phase 3 clan logic
 * — it only adds an overlay layer (daoMode flag + badge NFT id) on top.
 *
 * @param {object} opts — { clanId, governanceMode?, clanBackendAdapter, daoBadgeVariantId? }
 * @returns {Promise<{ok:boolean, clanId?:string, onChainBadgeNftId?:string, reason?:string, error?:string}>}
 */
export async function createDaoClan(opts) {
  if (!isChiaEnabled()) {
    return { ok: false, reason: 'chia-disabled' };
  }
  const wallet = getConnectedWallet();
  if (!wallet || !wallet.connected) {
    return { ok: false, reason: 'wallet-not-connected' };
  }
  if (!opts || typeof opts !== 'object') {
    return { ok: false, reason: 'invalid-input' };
  }
  const { clanId, clanBackendAdapter, daoBadgeVariantId } = opts;
  const governanceMode = typeof opts.governanceMode === 'string'
    ? opts.governanceMode
    : DAO_DEFAULT_GOVERNANCE_MODE;
  if (typeof clanId !== 'string' || !clanId) {
    return { ok: false, reason: 'invalid-input' };
  }
  if (!_isValidGovernanceMode(governanceMode)) {
    return { ok: false, reason: 'invalid-governance-mode' };
  }
  if (!_isAdapterValid(clanBackendAdapter)) {
    return { ok: false, reason: 'adapter-missing' };
  }

  // Step 1 — register the Phase 3 clan substrate via the injected adapter.
  let adapterResult;
  try {
    adapterResult = await clanBackendAdapter.createClan({
      clanId,
      daoMode: true,
      governanceMode,
      creatorWallet: wallet.address,
    });
  } catch (e) {
    log.error('[dao-adventures] adapter.createClan threw', e);
    return { ok: false, reason: 'exception', error: String(e) };
  }
  if (!adapterResult || !adapterResult.ok) {
    return {
      ok: false,
      reason: 'adapter-failed',
      error: adapterResult && adapterResult.reason ? adapterResult.reason : 'unknown',
    };
  }

  // Step 2 — mint the DAO clan badge NFT. The variantId is passed in by the
  // caller (UI selects from NFT_VARIANT_CATALOG); if absent we skip the mint
  // (caller can call mintMemberBadge later).
  let onChainBadgeNftId = null;
  if (typeof daoBadgeVariantId === 'string' && daoBadgeVariantId) {
    let mintResult;
    try {
      mintResult = await mintNftVariant(daoBadgeVariantId, {
        seasonOfMint: 'dao_season_1',
        ascensionBinding: 'dao_clan:' + clanId,
      });
    } catch (e) {
      log.error('[dao-adventures] mintNftVariant threw', e);
      return { ok: false, reason: 'exception', error: String(e) };
    }
    if (!mintResult || !mintResult.ok) {
      return {
        ok: false,
        reason: 'mint-failed',
        error: mintResult && mintResult.reason ? mintResult.reason : 'unknown',
      };
    }
    onChainBadgeNftId = mintResult.nftId;
  }

  // Step 3 — record the DAO overlay locally.
  _state.daoClans[clanId] = {
    clanId,
    governanceMode,
    creatorWallet:        wallet.address,
    createdAt:            Date.now(),
    onChainBadgeNftId,
    proposalLog:          [],
    memberMintedBadges:   Object.create(null),
    memberWallets:        [wallet.address],
  };
  log.info('[dao-adventures] DAO clan created', clanId, 'mode=' + governanceMode);
  return { ok: true, clanId, onChainBadgeNftId };
}

/**
 * Join a DAO clan. Per spec §5.3 join flow:
 *   1. wallet check (caller wallet connected — gate)
 *   2. clan must exist as a DAO overlay (registered via createDaoClan)
 *   3. invoke adapter.joinClan to register the Phase 3 clan membership
 *   4. optionally mint the member badge (via mintMemberBadge follow-up)
 *
 * Sacred-cow note: the per-member weekly contribution cap is IDENTICAL to
 * non-DAO clans (Phase 3 §2.2 sacred). This function does NOT modify
 * contribution math — it only gates the join behind a wallet check.
 *
 * @param {string} clanId
 * @param {object} opts — { clanBackendAdapter }
 * @returns {Promise<{ok:boolean, reason?:string, error?:string}>}
 */
export async function joinDaoClan(clanId, opts) {
  if (!isChiaEnabled()) {
    return { ok: false, reason: 'chia-disabled' };
  }
  const wallet = getConnectedWallet();
  if (!wallet || !wallet.connected) {
    return { ok: false, reason: 'wallet-not-connected' };
  }
  if (typeof clanId !== 'string' || !clanId) {
    return { ok: false, reason: 'invalid-input' };
  }
  if (!opts || typeof opts !== 'object') {
    return { ok: false, reason: 'invalid-input' };
  }
  const adapter = opts.clanBackendAdapter;
  if (!_isAdapterValid(adapter)) {
    return { ok: false, reason: 'adapter-missing' };
  }
  const clan = _state.daoClans[clanId];
  if (!clan) {
    return { ok: false, reason: 'not-a-dao-clan' };
  }

  let adapterResult;
  try {
    adapterResult = await adapter.joinClan(clanId, {
      walletAddr: wallet.address,
      daoMode: true,
    });
  } catch (e) {
    log.error('[dao-adventures] adapter.joinClan threw', e);
    return { ok: false, reason: 'exception', error: String(e) };
  }
  if (!adapterResult || !adapterResult.ok) {
    return {
      ok: false,
      reason: 'adapter-failed',
      error: adapterResult && adapterResult.reason ? adapterResult.reason : 'unknown',
    };
  }

  // Record member wallet in local overlay cache.
  if (!Array.isArray(clan.memberWallets)) clan.memberWallets = [];
  if (clan.memberWallets.indexOf(wallet.address) === -1) {
    clan.memberWallets.push(wallet.address);
  }
  log.info('[dao-adventures] joined DAO clan', clanId);
  return { ok: true };
}

/**
 * Mint an individual member's clan-membership NFT badge. Per spec §5.4
 * "Optional member commemorative" — cosmetic NFT-bound provenance ONLY,
 * no stat impact.
 *
 * Sacred-cow note: this mint is COSMETIC. It does NOT grant the member
 * any mechanical advantage in clan progression, weekly defeat, or rewards.
 * ADR-003 anti-P2W audited.
 *
 * @param {string} clanId
 * @param {object} opts — { memberBadgeVariantId }
 * @returns {Promise<{ok:boolean, nftId?:string, reason?:string, error?:string}>}
 */
export async function mintMemberBadge(clanId, opts) {
  if (!isChiaEnabled()) {
    return { ok: false, reason: 'chia-disabled' };
  }
  const wallet = getConnectedWallet();
  if (!wallet || !wallet.connected) {
    return { ok: false, reason: 'wallet-not-connected' };
  }
  if (typeof clanId !== 'string' || !clanId) {
    return { ok: false, reason: 'invalid-input' };
  }
  if (!opts || typeof opts !== 'object') {
    return { ok: false, reason: 'invalid-input' };
  }
  const { memberBadgeVariantId } = opts;
  if (typeof memberBadgeVariantId !== 'string' || !memberBadgeVariantId) {
    return { ok: false, reason: 'invalid-input' };
  }
  const clan = _state.daoClans[clanId];
  if (!clan) {
    return { ok: false, reason: 'not-a-dao-clan' };
  }

  let mintResult;
  try {
    mintResult = await mintNftVariant(memberBadgeVariantId, {
      seasonOfMint: 'dao_season_1',
      ascensionBinding: 'dao_member:' + clanId + ':' + wallet.address,
    });
  } catch (e) {
    log.error('[dao-adventures] mintNftVariant (member) threw', e);
    return { ok: false, reason: 'exception', error: String(e) };
  }
  if (!mintResult || !mintResult.ok) {
    return {
      ok: false,
      reason: 'mint-failed',
      error: mintResult && mintResult.reason ? mintResult.reason : 'unknown',
    };
  }

  if (!clan.memberMintedBadges) clan.memberMintedBadges = Object.create(null);
  clan.memberMintedBadges[wallet.address] = mintResult.nftId;
  log.info('[dao-adventures] minted member badge', clanId, '→', mintResult.nftId);
  return { ok: true, nftId: mintResult.nftId };
}

/**
 * Submit a DAO proposal for clan governance. Per spec §5 + ADR-003:
 * proposals are COSMETIC-ONLY (DAO_PROPOSAL_TYPES whitelist enforced).
 *
 * Mechanical proposal types are NEVER allowed and are statically rejected
 * via validateDaoProposal (which only accepts types in DAO_PROPOSAL_TYPES).
 *
 * V1 = local cache + log; T4.12 = on-chain proposal submission via Sage
 * Wallet RPC.
 *
 * Defensive gates:
 *   - isChiaEnabled() must be true
 *   - wallet connected
 *   - clanId must be a registered DAO overlay
 *   - proposal.type must be in DAO_PROPOSAL_TYPES whitelist
 *   - clan must have fewer than DAO_PROPOSAL_MAX_ACTIVE active proposals
 *
 * @param {string} clanId
 * @param {object} proposal — { type, title?, description? }
 * @returns {Promise<{ok:boolean, proposalId?:string, reason?:string, error?:string}>}
 */
export async function submitProposal(clanId, proposal) {
  if (!isChiaEnabled()) {
    return { ok: false, reason: 'chia-disabled' };
  }
  const wallet = getConnectedWallet();
  if (!wallet || !wallet.connected) {
    return { ok: false, reason: 'wallet-not-connected' };
  }
  if (typeof clanId !== 'string' || !clanId) {
    return { ok: false, reason: 'invalid-input' };
  }
  const clan = _state.daoClans[clanId];
  if (!clan) {
    return { ok: false, reason: 'not-a-dao-clan' };
  }
  const validation = validateDaoProposal(proposal);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason };
  }
  if (_countActiveProposalsForClan(clanId) >= DAO_PROPOSAL_MAX_ACTIVE) {
    return { ok: false, reason: 'too-many-active-proposals' };
  }

  // V1 stub: optional test override short-circuit.
  if (_proposalBehaviorOverride && _proposalBehaviorOverride.mode === 'fail') {
    return { ok: false, reason: _proposalBehaviorOverride.reason || 'exception' };
  }

  try {
    const proposalId = _synthesizeProposalId(clanId);
    const record = {
      proposalId,
      clanId,
      type:             proposal.type,
      title:            typeof proposal.title === 'string' ? proposal.title : '',
      description:      typeof proposal.description === 'string' ? proposal.description : '',
      submittedBy:      wallet.address,
      submittedAt:      Date.now(),
      status:           'active',
      governanceMode:   clan.governanceMode,
      votes:            [],
    };
    _state.pendingProposals[proposalId] = record;
    if (!Array.isArray(clan.proposalLog)) clan.proposalLog = [];
    clan.proposalLog.push(proposalId);
    log.info('[dao-adventures] proposal submitted', proposalId, 'type=' + proposal.type);
    return { ok: true, proposalId };
  } catch (e) {
    log.error('[dao-adventures] submitProposal failed', e);
    return { ok: false, reason: 'exception', error: String(e) };
  }
}

/**
 * Cast a vote on an active DAO proposal. Per spec §5 + DAO_GOVERNANCE_MODES:
 *   - one_member_one_vote: voteWeight is ignored; each wallet contributes 1.
 *   - token_weighted:      voteWeight contributes that many "yes" or "no"
 *                          votes; defaults to 1 if absent/invalid.
 *
 * Duplicate votes from the same wallet on the same proposal are REJECTED
 * (no vote-replay attacks).
 *
 * V1 = local cache; T4.12 = on-chain vote submission.
 *
 * @param {string} clanId
 * @param {string} proposalId
 * @param {object|number} voteOpts — {choice:'yes'|'no', voteWeight?:number} OR raw voteWeight number (legacy)
 * @returns {Promise<{ok:boolean, reason?:string, error?:string}>}
 */
export async function castVote(clanId, proposalId, voteOpts) {
  if (!isChiaEnabled()) {
    return { ok: false, reason: 'chia-disabled' };
  }
  const wallet = getConnectedWallet();
  if (!wallet || !wallet.connected) {
    return { ok: false, reason: 'wallet-not-connected' };
  }
  if (typeof clanId !== 'string' || !clanId) {
    return { ok: false, reason: 'invalid-input' };
  }
  if (typeof proposalId !== 'string' || !proposalId) {
    return { ok: false, reason: 'invalid-input' };
  }
  const clan = _state.daoClans[clanId];
  if (!clan) {
    return { ok: false, reason: 'not-a-dao-clan' };
  }
  const proposal = _state.pendingProposals[proposalId];
  if (!proposal || proposal.clanId !== clanId) {
    return { ok: false, reason: 'unknown-proposal' };
  }
  if (proposal.status !== 'active') {
    return { ok: false, reason: 'unknown-proposal' };
  }

  // Normalize voteOpts: accept either {choice, voteWeight} object or a
  // raw number (legacy weight-only signature; defaults choice to 'yes').
  let choice = 'yes';
  let voteWeight = 1;
  if (typeof voteOpts === 'number' && Number.isFinite(voteOpts) && voteOpts > 0) {
    voteWeight = voteOpts;
  } else if (voteOpts && typeof voteOpts === 'object') {
    if (voteOpts.choice === 'yes' || voteOpts.choice === 'no') {
      choice = voteOpts.choice;
    }
    if (typeof voteOpts.voteWeight === 'number'
        && Number.isFinite(voteOpts.voteWeight)
        && voteOpts.voteWeight > 0) {
      voteWeight = voteOpts.voteWeight;
    }
  }

  // Duplicate-vote guard: same wallet can't vote twice on a single proposal.
  const alreadyVoted = proposal.votes.some((v) => v && v.walletAddr === wallet.address);
  if (alreadyVoted) {
    return { ok: false, reason: 'duplicate-vote' };
  }

  proposal.votes.push({
    walletAddr: wallet.address,
    choice,
    voteWeight,
    castAt: Date.now(),
  });
  log.info('[dao-adventures] vote cast', proposalId, choice);
  return { ok: true };
}

/**
 * Resolve a DAO proposal — tally votes, check quorum, finalize outcome.
 *
 * Quorum: at least DAO_PROPOSAL_QUORUM_FRACTION × clan member count must
 * have voted (any choice). Below quorum → outcome 'failed'.
 *
 * Outcomes:
 *   - 'passed' — quorum met AND yes > no
 *   - 'failed' — quorum NOT met OR yes < no
 *   - 'tied'   — quorum met AND yes === no
 *
 * V1 = local resolution; T4.12 = on-chain proposal close + outcome record.
 *
 * @param {string} clanId
 * @param {string} proposalId
 * @returns {Promise<{ok:boolean, outcome?:'passed'|'failed'|'tied', tally?:{yes:number,no:number,voterCount:number}, reason?:string, error?:string}>}
 */
export async function resolveDaoProposal(clanId, proposalId) {
  if (!isChiaEnabled()) {
    return { ok: false, reason: 'chia-disabled' };
  }
  const wallet = getConnectedWallet();
  if (!wallet || !wallet.connected) {
    return { ok: false, reason: 'wallet-not-connected' };
  }
  if (typeof clanId !== 'string' || !clanId) {
    return { ok: false, reason: 'invalid-input' };
  }
  if (typeof proposalId !== 'string' || !proposalId) {
    return { ok: false, reason: 'invalid-input' };
  }
  const clan = _state.daoClans[clanId];
  if (!clan) {
    return { ok: false, reason: 'not-a-dao-clan' };
  }
  const proposal = _state.pendingProposals[proposalId];
  if (!proposal || proposal.clanId !== clanId) {
    return { ok: false, reason: 'unknown-proposal' };
  }

  try {
    const tally = computeVoteTally(proposal);
    const memberCount = Array.isArray(clan.memberWallets) ? clan.memberWallets.length : 0;
    const quorumNeeded = Math.ceil(memberCount * DAO_PROPOSAL_QUORUM_FRACTION);
    let outcome;
    if (memberCount === 0 || tally.voterCount < quorumNeeded) {
      outcome = 'failed';
    } else if (tally.yes > tally.no) {
      outcome = 'passed';
    } else if (tally.yes < tally.no) {
      outcome = 'failed';
    } else {
      outcome = 'tied';
    }
    proposal.status = 'resolved';
    proposal.outcome = outcome;
    proposal.resolvedAt = Date.now();
    log.info('[dao-adventures] proposal resolved', proposalId,
      'outcome=' + outcome,
      'yes=' + tally.yes, 'no=' + tally.no,
      'voters=' + tally.voterCount + '/' + memberCount);
    return { ok: true, outcome, tally };
  } catch (e) {
    log.error('[dao-adventures] resolveDaoProposal failed', e);
    return { ok: false, reason: 'exception', error: String(e) };
  }
}

// ─── Test helpers ──────────────────────────────────────────────────────────
// Per Phase 1 testing convention: module-local overrides that work in both
// browser + node test env without touching window globals.

/**
 * Test helper: reset all module-local state. Call in beforeEach + afterEach
 * to isolate test cases.
 */
export function _resetDaoAdventuresForTest() {
  _state = _emptyState();
  _proposalBehaviorOverride = null;
  _proposalCounter = 0;
}

/**
 * Test helper: inject a pre-built DAO clan record into module-local state.
 * Useful for testing submitProposal / castVote / resolve flows without
 * going through createDaoClan.
 *
 * @param {object} daoClan
 */
export function _seedDaoClanForTest(daoClan) {
  if (!daoClan || typeof daoClan !== 'object') return;
  if (typeof daoClan.clanId !== 'string' || !daoClan.clanId) return;
  _state.daoClans[daoClan.clanId] = {
    clanId:             daoClan.clanId,
    governanceMode:     daoClan.governanceMode || DAO_DEFAULT_GOVERNANCE_MODE,
    creatorWallet:      daoClan.creatorWallet || '',
    createdAt:          typeof daoClan.createdAt === 'number' ? daoClan.createdAt : Date.now(),
    onChainBadgeNftId:  daoClan.onChainBadgeNftId || null,
    proposalLog:        Array.isArray(daoClan.proposalLog) ? daoClan.proposalLog.slice() : [],
    memberMintedBadges: daoClan.memberMintedBadges
      ? Object.assign(Object.create(null), daoClan.memberMintedBadges)
      : Object.create(null),
    memberWallets:      Array.isArray(daoClan.memberWallets) ? daoClan.memberWallets.slice() : [],
  };
}

/**
 * Test helper: override proposal behavior. Mode 'success' = default;
 * 'fail' = short-circuit submitProposal with the supplied reason.
 *
 * @param {{mode:'success'|'fail', reason?:string}|null} override
 */
export function _setProposalBehaviorForTest(override) {
  _proposalBehaviorOverride = override || null;
}

/**
 * Test helper: produce a mock clanBackendAdapter that records every call
 * in a `calls` array and returns ok:true by default. Useful for verifying
 * dependency-injection wire-up without a real Phase 3 clan-backend.
 *
 * The returned adapter exposes:
 *   - createClan, getClan, joinClan (all async, all return {ok:true} default)
 *   - calls: [{method, args}] — append-only log of every invocation
 *   - _setNextResult({method, result}) — inject the next return for a method
 *
 * @returns {object} mock adapter
 */
export function _makeMockClanBackendAdapter() {
  const calls = [];
  const nextResults = Object.create(null);
  function _take(method) {
    if (nextResults[method] && nextResults[method].length > 0) {
      return nextResults[method].shift();
    }
    return null;
  }
  return {
    calls,
    _setNextResult(opts) {
      if (!opts || typeof opts !== 'object') return;
      const m = opts.method;
      if (typeof m !== 'string' || !m) return;
      if (!nextResults[m]) nextResults[m] = [];
      nextResults[m].push(opts.result || { ok: true });
    },
    async createClan(args) {
      calls.push({ method: 'createClan', args });
      const injected = _take('createClan');
      if (injected) return injected;
      return { ok: true, clanId: args && args.clanId ? args.clanId : 'mock_clan' };
    },
    async getClan(clanId) {
      calls.push({ method: 'getClan', args: { clanId } });
      const injected = _take('getClan');
      if (injected) return injected;
      return { ok: true, clan: { clanId, daoMode: true } };
    },
    async joinClan(clanId, args) {
      calls.push({ method: 'joinClan', args: Object.assign({ clanId }, args || {}) });
      const injected = _take('joinClan');
      if (injected) return injected;
      return { ok: true };
    },
  };
}
