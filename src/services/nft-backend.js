// 2026-05-13 — TASK-063 (T4.03 + T4.04): NFT-hero binding state + mint flow.
// 2026-05-13 — TASK-064 (T4.05 + T4.06): NFT transfer + trade flow + 2.5% royalty.
//
// Spec: docs/design/chia-integration.md §2.1 (sacred stat-block identity)
//       + §2.4 (mint flow) + §2.5 (trade/transfer flow) + §2.6 (Founder Badge)
//       + §13.6 ESC-04 Q2 ruling (2.5% royalty hard cap, honor voluntary).
//
// Sacred-cow safety:
//   - This file holds NO sacred-cow logic per CLAUDE.md §2.x. It is a new
//     Phase 4 service introducing the NFT cosmetic binding layer — no
//     overlap with combat math, V_HAPTICS, NARRATOR_LINES, GEM_PACKS, Battle
//     Pass, Tower retry ladder, Tower leaderboards, TOWER_PACTS, HERO_ROSTER,
//     HERO_TIER_ABILITIES, or any Phase 1/2/3 backend.
//   - Per ADR-003 (no-P2W) sacred invariant: NFT mint NEVER writes back to
//     HERO_ROSTER and NEVER modifies any hp / dmg / crit / ultCost / tier /
//     synergy field. Variants are render-time cosmetic overlay ONLY. The
//     applyNftSkin / unapplyNftSkin functions write to MODULE-LOCAL cache
//     only — they DO NOT touch sacred hero data. This invariant is statically
//     audited in tests/unit/nft-backend.test.js (substring scan of exported
//     source).
//   - Per ADR-004 (hybrid): this file lives in src/services/, never imported
//     by legacy HTML.
//   - Per ADR-005 (mobile feature flag, T4.09): EVERY exported async op
//     first checks isChiaEnabled() and returns {ok:false, reason:'chia-disabled'}
//     if the flag is off. Mobile build (VITE_CHIA_ENABLED=false) NEVER touches
//     the NFT surface.
//
// Envelope pattern (per Phase 3 backend convention):
//   - All async ops return { ok: boolean, ...payload } and NEVER throw.
//   - Common reason codes:
//       'chia-disabled'        — isChiaEnabled() === false
//       'wallet-not-connected' — connectWallet has not been called
//       'unknown-variant'      — variantId not in NFT_VARIANT_CATALOG
//       'hero-not-owned'       — player save does not have the hero unlocked
//       'invalid-input'        — defensive guard (bad shape)
//       'user-cancelled'       — Sage prompt rejected during mint signing
//       'exception'            — caught exception (returns `error: String(e)`)
//
// V1 stub mode per spec §2.4 Field 4 + TODO(T4.12):
//   - mintNftVariant simulates the wallet-mint-proposal handshake by calling
//     signMessage on the wallet-connect service and synthesizing an nftId.
//     The actual on-chain transaction submission is wired in T4.12 (live
//     Chia full-node RPC / indexer). For V1 dev + closed beta:
//     `_setMintBehaviorForTest({mode:'success'|'fail'|'pending'})` injects
//     deterministic results.
//   - syncOwnedNfts is a no-op stub at V1; T4.12 wires it to the live indexer.

import { isChiaEnabled } from './feature-flags.js';
import { log } from './logger.js';
import { getConnectedWallet, signMessage } from './wallet-connect.js';
import {
  NFT_NAMESPACE_PREFIX,
  NFT_GAS_FEE_MOJOS,
  BLOCKSWORN_TREASURY_ROYALTY_BPS,
  getVariantById,
  computeMintFeeMojos,
} from '../data/nft-variants.js';
import { BLOCKSWORN_TREASURY_PUZZLEHASH } from '../data/chia-config.js';

// ─── T4.05 + T4.06 transfer/trade sacred-cow safety ────────────────────────
// Per ADR-003 anti-P2W invariant: transfer + trade NEVER:
//   - confer stats / damage / win-rate
//   - add new mechanical content
//   - change Tower / Adventures / Party Tower behavior
// Transfer is identity / collection / provenance / liquidity — never mechanics.
//
// Per ESC-04 Q2 sacred ruling: BLOCKSWORN_TREASURY_ROYALTY_BPS === 250 (2.5%).
// Royalty honor is voluntary at the marketplace level per Chia NFT1 ecosystem
// norm. Blocksworn sets royalty metadata at mint; marketplaces (Sage / Chia
// Spacescan / Mintgarden) honor on secondary sale. applyRoyaltyOnSale below
// is the audit/log surface — it does NOT submit on-chain (the marketplace
// handles royalty submission per NFT1).
//
// Per spec §2.5 Field 4: settlement listener subscribes to Chia block-events
// for the player's puzzle hash. V1 = local listener stub; T4.12 wires the
// live indexer subscription.

// ─── Module-local state ────────────────────────────────────────────────────
// Per Phase 1 standards: no window globals. State lives here. Phase 4 V1
// scope is session-only (no persistence to localStorage); T4.12 may add a
// short-lived sync cache once the live indexer is wired.

function _emptyState() {
  return {
    cache:      Object.create(null),   // heroId → { activeSkin, ownedNfts:[nftId,...] }
    ownedNfts:  [],                    // flat list of full nft records
    lastSyncAt: 0,
  };
}

let _state = _emptyState();
let _mintBehaviorOverride = null;
let _mintCounter = 0;

// T4.05 + T4.06: transfer flow state
//   - _transferBehaviorOverride: test-injected behavior for submitTransfer
//   - _transferListeners: registered subscribeToTransfers callbacks
//   - _pendingTransfers: map nftId → { toAddr, proposedAt } (cleared on settle)
let _transferBehaviorOverride = null;
let _transferListeners = [];
let _pendingTransfers = Object.create(null);
let _transferCounter = 0;

// ─── Internal helpers ──────────────────────────────────────────────────────

function _ensureCacheEntry(heroId) {
  if (!_state.cache[heroId]) {
    _state.cache[heroId] = { activeSkin: null, ownedNfts: [] };
  }
  return _state.cache[heroId];
}

function _synthesizeNftId(variantId) {
  // V1 stub id shape: chia:bls:<variantId>:<counter>:<ts>
  // T4.12 replaces with real Chia NFT1 launcher coin id.
  _mintCounter++;
  return NFT_NAMESPACE_PREFIX + variantId + ':' + _mintCounter + ':' + Date.now();
}

function _validateNftShape(nft) {
  if (!nft || typeof nft !== 'object') return false;
  if (typeof nft.nftId !== 'string' || !nft.nftId.startsWith(NFT_NAMESPACE_PREFIX)) return false;
  if (typeof nft.heroId !== 'string' || !nft.heroId) return false;
  if (typeof nft.variantId !== 'string' || !nft.variantId) return false;
  if (typeof nft.ownerPuzzleHash !== 'string' || !nft.ownerPuzzleHash) return false;
  if (typeof nft.mintedAt !== 'number' || !Number.isFinite(nft.mintedAt)) return false;
  if (typeof nft.mintedBy !== 'string' || !nft.mintedBy) return false;
  if (typeof nft.seasonOfMint !== 'string' || !nft.seasonOfMint) return false;
  // ascensionBinding may be null (default) or a string event id (post-ascension)
  if (nft.ascensionBinding !== null && typeof nft.ascensionBinding !== 'string') return false;
  return true;
}

// ─── Pure helpers (synchronous, no gating) ─────────────────────────────────

/**
 * Return the variantId currently applied as a cosmetic overlay for a hero,
 * or null if the hero renders with its base sprite. Called at hero render
 * time (battle screen, select screen, Codex). MUST be O(1) and ≤1ms per
 * spec §2.4 performance budget.
 *
 * Sacred-cow note: this read is the ONLY place where NFT data influences
 * rendering — and it ONLY swaps art/voice/particle accent, NEVER stats.
 *
 * @param {string} heroId
 * @returns {string|null}
 */
export function getActiveSkin(heroId) {
  if (typeof heroId !== 'string' || !heroId) return null;
  const entry = _state.cache[heroId];
  if (!entry) return null;
  return entry.activeSkin || null;
}

/**
 * Return all NFT records bound to the given hero (by nftId list in cache).
 * Pure; never throws.
 *
 * @param {string} heroId
 * @returns {object[]} array of full NFT records owned for this hero
 */
export function getOwnedNftsForHero(heroId) {
  if (typeof heroId !== 'string' || !heroId) return [];
  const entry = _state.cache[heroId];
  if (!entry || !Array.isArray(entry.ownedNfts) || entry.ownedNfts.length === 0) {
    return [];
  }
  const ids = new Set(entry.ownedNfts);
  return _state.ownedNfts.filter((n) => ids.has(n.nftId));
}

/**
 * Defensive check: validate that an NFT record conforms to the schema
 * (per spec §2.1 conceptual schema). Pure; never throws.
 *
 * @param {object} nft
 * @returns {boolean}
 */
export function validateNftBinding(nft) {
  return _validateNftShape(nft);
}

/**
 * Build a provenance event timeline for an NFT. Per spec §2.5 trade flow:
 * "the on-chain mint record persists forever". V1 timeline includes only
 * the mint event; T4.06 trade flow adds transfer events.
 *
 * @param {object} nft
 * @returns {Array<{type:string, at:number, addr:string}>}
 */
export function computeProvenanceTimeline(nft) {
  if (!_validateNftShape(nft)) return [];
  return [
    { type: 'mint', at: nft.mintedAt, addr: nft.mintedBy },
    // Future: transfer events from on-chain index (T4.06).
  ];
}

/**
 * Determine whether the connected wallet + player can mint a given variant.
 * Pure; never throws. Returns { eligible:boolean, reason?:string }.
 *
 * Eligibility chain (per spec §2.4 Field 1 + Field 4):
 *   1. isChiaEnabled() must be true (ADR-005)
 *   2. Wallet must be connected (T4.02 wallet-connect)
 *   3. variantId must exist in NFT_VARIANT_CATALOG
 *   4. player must own the hero (V1: mocked — full save integration is T4.04.1)
 *
 * The mock-ownership check at V1 accepts a `player.unlockedHeroIds` array;
 * absent (legacy/no-save flow) → eligible (V1 dev affordance).
 *
 * @param {object} player — { unlockedHeroIds?: string[], ... }
 * @param {string} variantId
 * @returns {{eligible:boolean, reason?:string}}
 */
export function isNftEligibleForMint(player, variantId) {
  if (!isChiaEnabled()) {
    return { eligible: false, reason: 'chia-disabled' };
  }
  const wallet = getConnectedWallet();
  if (!wallet || !wallet.connected) {
    return { eligible: false, reason: 'wallet-not-connected' };
  }
  const variant = getVariantById(variantId);
  if (!variant) {
    return { eligible: false, reason: 'unknown-variant' };
  }
  if (player && Array.isArray(player.unlockedHeroIds)) {
    if (!player.unlockedHeroIds.includes(variant.heroId)) {
      return { eligible: false, reason: 'hero-not-owned' };
    }
  }
  return { eligible: true };
}

/**
 * Compute the full mint-fee breakdown for UI display. Pure; never throws.
 * Returns zeros for unknown variant (defensive).
 *
 * Per spec §2.4 Field 3 + ESC-04 Q2 ruling:
 *   - gas         = NFT_GAS_FEE_MOJOS                  (0.0001 XCH)
 *   - premium     = variant.mintPriceMojos             (0.01 / 0.1 / 1.0 XCH)
 *   - royaltyBps  = BLOCKSWORN_TREASURY_ROYALTY_BPS    (250 bps = 2.5%)
 *   - totalMojos  = gas + premium
 *   - totalXch    = totalMojos / 1e12
 *
 * @param {string} variantId
 * @returns {{gas:number, premium:number, royaltyBps:number, totalMojos:number, totalXch:number}}
 */
export function getMintFeeBreakdown(variantId) {
  const variant = getVariantById(variantId);
  const gas = NFT_GAS_FEE_MOJOS;
  const premium = variant ? variant.mintPriceMojos : 0;
  const totalMojos = variant ? computeMintFeeMojos(variantId) : 0;
  const totalXch = totalMojos / 1e12;
  return Object.freeze({
    gas,
    premium,
    royaltyBps: BLOCKSWORN_TREASURY_ROYALTY_BPS,
    totalMojos,
    totalXch,
  });
}

// ─── Async ops (gated by isChiaEnabled + wallet check) ─────────────────────

/**
 * Sync on-chain NFT inventory from the Chia indexer. V1 is a stub (no live
 * indexer until T4.12); for V1 dev, ownedNfts are seeded via
 * `_seedOwnedNftForTest`. The TODO(T4.12) marker below pins where the live
 * wiring lands.
 *
 * Performance budget per spec §2.4: ≤3s p99 sync after wallet connect.
 *
 * @returns {Promise<{ok:boolean, count?:number, reason?:string, error?:string}>}
 */
export async function syncOwnedNfts() {
  if (!isChiaEnabled()) {
    return { ok: false, reason: 'chia-disabled' };
  }
  const wallet = getConnectedWallet();
  if (!wallet || !wallet.connected) {
    return { ok: false, reason: 'wallet-not-connected' };
  }
  try {
    // TODO(T4.12): replace with live indexer fetch:
    //   const rows = await fetchIndexerNftsByPuzzleHash(wallet.address, NFT_NAMESPACE_PREFIX);
    //   rebuild _state.cache + _state.ownedNfts from rows
    // V1 stub: state already populated via mintNftVariant calls + test helpers.
    _state.lastSyncAt = Date.now();
    return { ok: true, count: _state.ownedNfts.length };
  } catch (e) {
    log.error('[nft-backend] syncOwnedNfts failed', e);
    return { ok: false, reason: 'exception', error: String(e) };
  }
}

/**
 * Mint an NFT cosmetic variant. Per spec §2.4 Field 4: hands off to Sage
 * Wallet via walletconnect-style transaction proposal. V1 stub simulates
 * the handshake via wallet-connect.signMessage; T4.12 replaces with a real
 * on-chain mint coin spend.
 *
 * Sacred-cow note: this function DOES NOT write to HERO_ROSTER. It only:
 *   - asks the wallet to sign a mint-proposal message
 *   - synthesizes an nft record (id + provenance)
 *   - stores the record in MODULE-LOCAL cache for later getActiveSkin reads
 *
 * @param {string} variantId
 * @param {object} [options] — { player?, seasonOfMint?, ascensionBinding? }
 * @returns {Promise<{ok:boolean, nftId?:string, txProposalId?:string, reason?:string, error?:string}>}
 */
export async function mintNftVariant(variantId, options) {
  if (!isChiaEnabled()) {
    return { ok: false, reason: 'chia-disabled' };
  }
  const wallet = getConnectedWallet();
  if (!wallet || !wallet.connected) {
    return { ok: false, reason: 'wallet-not-connected' };
  }
  const variant = getVariantById(variantId);
  if (!variant) {
    return { ok: false, reason: 'unknown-variant' };
  }
  // Defensive player eligibility (mirrors isNftEligibleForMint, but skipped
  // if no player argument is supplied — V1 dev affordance).
  const player = options && typeof options === 'object' ? options.player : null;
  if (player) {
    const elig = isNftEligibleForMint(player, variantId);
    if (!elig.eligible) {
      return { ok: false, reason: elig.reason };
    }
  }

  // V1 stub: optionally short-circuit via test override.
  if (_mintBehaviorOverride && _mintBehaviorOverride.mode === 'fail') {
    return { ok: false, reason: _mintBehaviorOverride.reason || 'exception' };
  }
  if (_mintBehaviorOverride && _mintBehaviorOverride.mode === 'pending') {
    // Pending = no synthesis yet. UI shows spinner; tx settles later.
    return { ok: true, txProposalId: 'pending:' + variantId, nftId: null };
  }

  // Request a wallet signature on the mint-proposal message. This is the
  // V1 stub path; T4.12 replaces this with a real coin-spend submission
  // via Sage Wallet RPC. The mint-proposal message is auth-only — it does
  // NOT carry transaction details (those live on-chain).
  let sigResult;
  try {
    const proposalMsg = 'mint:' + variantId + ':' + Date.now();
    sigResult = await signMessage(proposalMsg);
  } catch (e) {
    log.error('[nft-backend] mintNftVariant signMessage threw', e);
    return { ok: false, reason: 'exception', error: String(e) };
  }
  if (!sigResult || !sigResult.ok) {
    // Pass through wallet-connect reason codes (no-sdk, user-cancelled, etc.).
    return { ok: false, reason: (sigResult && sigResult.reason) || 'exception' };
  }

  // Synthesize the NFT record.
  const nftId = _synthesizeNftId(variantId);
  const seasonOfMint = (options && typeof options.seasonOfMint === 'string' && options.seasonOfMint)
    || variant.seasonOfMint;
  const ascensionBinding = (options && typeof options.ascensionBinding === 'string')
    ? options.ascensionBinding
    : null;
  const nft = Object.freeze({
    nftId,
    heroId:           variant.heroId,
    variantId,
    ownerPuzzleHash:  wallet.address,
    mintedAt:         Date.now(),
    mintedBy:         wallet.address,
    ascensionBinding,
    seasonOfMint,
  });

  // Persist into module-local cache. NEVER writes to HERO_ROSTER.
  _state.ownedNfts.push(nft);
  const entry = _ensureCacheEntry(variant.heroId);
  entry.ownedNfts.push(nftId);

  log.info('[nft-backend] minted', variantId, '→', nftId);

  // V1: synchronous synthesis (no on-chain wait). T4.12 swaps with a real
  // tx settlement subscription that resolves only when the coin lands.
  return { ok: true, nftId, txProposalId: 'stub:' + nftId };
}

/**
 * Apply an owned NFT skin to a hero (binds variant to hero in local cache).
 * Idempotent — re-applying the same variant is a no-op. Cross-hero swaps
 * are allowed (a player can switch between owned variants).
 *
 * Sacred-cow note: this writes ONLY to module-local _state.cache. The
 * sacred HERO_ROSTER is never mutated. The skin is consulted at render time
 * via getActiveSkin; absent skin → base sprite renders (F2P parity).
 *
 * @param {string} heroId
 * @param {string} variantId
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function applyNftSkin(heroId, variantId) {
  if (!isChiaEnabled()) {
    return { ok: false, reason: 'chia-disabled' };
  }
  if (typeof heroId !== 'string' || !heroId) {
    return { ok: false, reason: 'invalid-input' };
  }
  const variant = getVariantById(variantId);
  if (!variant) {
    return { ok: false, reason: 'unknown-variant' };
  }
  if (variant.heroId !== heroId) {
    return { ok: false, reason: 'invalid-input' };
  }
  // Defensive: caller must actually own the variant. (Wallet-connected +
  // mint cache has the variant.)
  const wallet = getConnectedWallet();
  if (!wallet || !wallet.connected) {
    return { ok: false, reason: 'wallet-not-connected' };
  }
  const ownsVariant = _state.ownedNfts.some((n) => n.variantId === variantId);
  if (!ownsVariant) {
    return { ok: false, reason: 'invalid-input' };
  }
  const entry = _ensureCacheEntry(heroId);
  entry.activeSkin = variantId;
  return { ok: true };
}

/**
 * Revert a hero's render to its base sprite (clear the skin overlay).
 * Idempotent — calling on an already-base hero is a no-op.
 *
 * @param {string} heroId
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function unapplyNftSkin(heroId) {
  if (!isChiaEnabled()) {
    return { ok: false, reason: 'chia-disabled' };
  }
  if (typeof heroId !== 'string' || !heroId) {
    return { ok: false, reason: 'invalid-input' };
  }
  const entry = _state.cache[heroId];
  if (entry) {
    entry.activeSkin = null;
  }
  return { ok: true };
}

// ─── Test helpers ──────────────────────────────────────────────────────────
// Per Phase 1 testing convention: module-local overrides that work in both
// browser + node test env without touching window globals.

/**
 * Test helper: reset all module-local state. Call in beforeEach + afterEach
 * to isolate test cases.
 */
export function _resetNftBackendForTest() {
  _state = _emptyState();
  _mintBehaviorOverride = null;
  _mintCounter = 0;
  _transferBehaviorOverride = null;
  _transferListeners = [];
  _pendingTransfers = Object.create(null);
  _transferCounter = 0;
}

/**
 * Test helper: inject a pre-built NFT record into module-local state.
 * Useful for testing applyNftSkin / getOwnedNftsForHero / provenance
 * without going through the mint flow.
 *
 * @param {object} nft — must pass validateNftBinding()
 */
export function _seedOwnedNftForTest(nft) {
  if (!_validateNftShape(nft)) return;
  _state.ownedNfts.push(Object.freeze({ ...nft }));
  const entry = _ensureCacheEntry(nft.heroId);
  if (!entry.ownedNfts.includes(nft.nftId)) {
    entry.ownedNfts.push(nft.nftId);
  }
}

/**
 * Test helper: override mint behavior to bypass the wallet signMessage stub.
 * Mode 'success' = default (sign + synthesize); 'fail' = short-circuit with
 * the supplied reason; 'pending' = returns a tx-proposal envelope with no
 * nftId yet (simulates pre-settlement state).
 *
 * @param {{mode:'success'|'fail'|'pending', reason?:string}|null} override
 */
export function _setMintBehaviorForTest(override) {
  _mintBehaviorOverride = override || null;
}

// ═══════════════════════════════════════════════════════════════════════════
// T4.05 + T4.06 — NFT transfer + trade flow + 2.5% royalty enforcement
// ═══════════════════════════════════════════════════════════════════════════
//
// Spec: docs/design/chia-integration.md §2.5 (Trade flow / transfer)
//       + §13.6 ESC-04 Q2 ruling (2.5% royalty, honor voluntary at
//       marketplace level per Chia NFT1 ecosystem norm).
//
// Sacred-cow safety:
//   - ADR-003 anti-P2W: transfer/trade confers ONLY an ownership change.
//     Statically audited: submitTransfer + applyRoyaltyOnSale source MUST
//     NOT contain hp/dmg/damage/crit/ultCost/synergy/winRate/tier/race
//     substrings (audit in tests/unit/nft-transfer.test.js).
//   - ESC-04 Q2: royaltyBps === 250 in every emitted royalty envelope.
//   - HERO_ROSTER is never touched here. NFT records are module-local.
//
// V1 stub mode (TODO(T4.12) markers below):
//   - submitTransfer: V1 invokes wallet-connect.signMessage on a transfer
//     proposal message; T4.12 swaps to a real Chia coin-spend submission
//     via Sage Wallet RPC.
//   - subscribeToTransfers: V1 = local in-process listener registry; T4.12
//     wires the Chia full-node block-event subscription per spec §2.5
//     Field 4.
//   - simulateTransferSettlement: TEST helper (also useful for staging) —
//     in V1 production builds the settlement event flows from the chain
//     listener; the simulate helper short-circuits that for unit tests.

function _isValidPuzzleHash(addr) {
  // Defensive validation: accept Chia bech32 shapes.
  // Production addresses use 'xch1' (mainnet) or 'txch1' (testnet); the
  // existing wallet-connect _isValidAddress regex accepts 'chia[0-9a-z]+'
  // for test fixtures, so we accept the union here. The live integration
  // (T4.12) re-validates server-side anyway.
  if (typeof addr !== 'string') return false;
  if (addr.length < 10) return false;
  if (!/^(t?xch1|chia)[0-9a-z]+$/i.test(addr)) return false;
  return true;
}

function _findOwnedNft(nftId) {
  if (typeof nftId !== 'string' || !nftId) return null;
  for (const nft of _state.ownedNfts) {
    if (nft.nftId === nftId) return nft;
  }
  return null;
}

function _synthesizeTxProposalId(nftId) {
  _transferCounter++;
  return 'transfer:' + nftId + ':' + _transferCounter + ':' + Date.now();
}

function _notifyTransferListeners(event) {
  for (const cb of _transferListeners.slice()) {
    try {
      cb(event);
    } catch (e) {
      log.error('[nft-backend] transfer listener threw', e);
    }
  }
}

// ─── Pure helpers (synchronous, no gating) ─────────────────────────────────

/**
 * Compute the royalty + treasury + seller-net breakdown for a Blocksworn
 * NFT secondary sale. Per ESC-04 Q2 ruling: 2.5% of sale price flows to the
 * Blocksworn treasury (BLOCKSWORN_TREASURY_ROYALTY_BPS === 250).
 *
 * Pure; never throws. Defensive against NaN / negative inputs.
 *
 * Sacred-cow note: royaltyBps is ALWAYS 250 in the returned envelope
 * (ESC-04 Q2 sacred). Royalty math uses integer floor (Math.floor) to
 * match on-chain mojo precision (no fractional mojos).
 *
 * Per spec §2.5 Field 6 + ADR-003: NO part of the royalty grants
 * mechanical advantage; it is treasury revenue that funds ongoing
 * development. Sale itself transfers identity, NEVER mechanics.
 *
 * @param {number} salePriceMojos — sale price in mojos (1 XCH = 1e12 mojos)
 * @returns {{ok:boolean, royaltyMojos:number, treasuryMojos:number, sellerNetMojos:number, royaltyBps:number}}
 */
export function getRoyaltyBreakdown(salePriceMojos) {
  // Defensive: NaN / non-finite / negative → return zero envelope (ok:true
  // so callers don't have to special-case; the values are simply zero).
  if (typeof salePriceMojos !== 'number'
      || !Number.isFinite(salePriceMojos)
      || salePriceMojos < 0) {
    return Object.freeze({
      ok: true,
      royaltyMojos: 0,
      treasuryMojos: 0,
      sellerNetMojos: 0,
      royaltyBps: BLOCKSWORN_TREASURY_ROYALTY_BPS,
    });
  }
  // Integer math: floor to whole mojos to match on-chain precision.
  const royaltyMojos = Math.floor(salePriceMojos * BLOCKSWORN_TREASURY_ROYALTY_BPS / 10000);
  const treasuryMojos = royaltyMojos;
  const sellerNetMojos = Math.floor(salePriceMojos) - royaltyMojos;
  return Object.freeze({
    ok: true,
    royaltyMojos,
    treasuryMojos,
    sellerNetMojos,
    royaltyBps: BLOCKSWORN_TREASURY_ROYALTY_BPS,
  });
}

/**
 * Return the Blocksworn treasury wallet puzzle hash (recipient of the
 * 2.5% royalty per ESC-04 Q2 ruling). Pure; never throws.
 *
 * V1 stub value lives in src/data/chia-config.js. T4.12 replaces with
 * the real production treasury address.
 *
 * @returns {string}
 */
export function getTreasuryPuzzleHash() {
  return BLOCKSWORN_TREASURY_PUZZLEHASH;
}

/**
 * Format a "View on Chia Explorer" deep link for a Blocksworn NFT, per
 * spec §2.5 Field 2. Opens Spacescan.io (Chia ecosystem block explorer).
 * NIP-XX compliant — any Chia NFT1 wallet can resolve the launcher coin id.
 *
 * Pure; never throws. Returns empty string for invalid input.
 *
 * @param {string} nftId — Blocksworn NFT id (e.g., 'chia:bls:variant:1:ts')
 * @returns {string}
 */
export function formatNftDeepLink(nftId) {
  if (typeof nftId !== 'string' || !nftId) return '';
  return 'https://www.spacescan.io/nft/' + nftId;
}

/**
 * Format a "VIEW ON SAGE WALLET" deep link for a Blocksworn NFT, per
 * spec §2.5 Field 2. Sage Wallet handles the actual NFT detail view +
 * transfer initiation.
 *
 * Pure; never throws. Returns empty string for invalid input.
 *
 * @param {string} nftId
 * @returns {string}
 */
export function formatSageWalletDeepLink(nftId) {
  if (typeof nftId !== 'string' || !nftId) return '';
  return 'sage://nft/' + nftId;
}

/**
 * Build a transfer proposal envelope for handoff to Sage Wallet. Per spec
 * §2.5 Field 3: Blocksworn prepares the envelope; Sage handles wallet
 * selection / QR scan / on-chain submission.
 *
 * Pure (no async ops, no signature request). Validates:
 *   1. isChiaEnabled()           — ADR-005 mobile gate
 *   2. wallet connected          — caller must have a connected wallet
 *   3. nftId exists in owned set — caller must own the NFT
 *   4. recipient is valid string — bech32 puzzle hash shape
 *
 * Returns the envelope on success: {nftId, fromAddr, toAddr, royaltyBps,
 * royaltyRecipientPuzzleHash, gasMojos}. The envelope carries royalty
 * metadata (per ESC-04 Q2) so Sage can include it in the transfer
 * transaction's NFT metadata fields (NIP-XX standard).
 *
 * Sacred-cow note: royaltyBps is ALWAYS 250 (ESC-04 Q2). This is the
 * marketplace-honor contract — Blocksworn declares the royalty; market-
 * places voluntarily honor it on secondary sale.
 *
 * @param {string} nftId
 * @param {string} recipientPuzzleHash — Chia bech32 address
 * @returns {{ok:boolean, nftId?:string, fromAddr?:string, toAddr?:string, royaltyBps?:number, royaltyRecipientPuzzleHash?:string, gasMojos?:number, reason?:string}}
 */
export function buildTransferProposal(nftId, recipientPuzzleHash) {
  if (!isChiaEnabled()) {
    return { ok: false, reason: 'chia-disabled' };
  }
  const wallet = getConnectedWallet();
  if (!wallet || !wallet.connected) {
    return { ok: false, reason: 'wallet-not-connected' };
  }
  if (typeof nftId !== 'string' || !nftId) {
    return { ok: false, reason: 'invalid-input' };
  }
  if (typeof recipientPuzzleHash !== 'string' || !recipientPuzzleHash) {
    return { ok: false, reason: 'invalid-recipient' };
  }
  if (!_isValidPuzzleHash(recipientPuzzleHash)) {
    return { ok: false, reason: 'invalid-recipient' };
  }
  const nft = _findOwnedNft(nftId);
  if (!nft) {
    return { ok: false, reason: 'unknown-nft' };
  }
  if (nft.ownerPuzzleHash !== wallet.address) {
    return { ok: false, reason: 'nft-not-owned' };
  }
  return Object.freeze({
    ok: true,
    nftId,
    fromAddr: wallet.address,
    toAddr: recipientPuzzleHash,
    royaltyBps: BLOCKSWORN_TREASURY_ROYALTY_BPS,
    royaltyRecipientPuzzleHash: BLOCKSWORN_TREASURY_PUZZLEHASH,
    gasMojos: NFT_GAS_FEE_MOJOS,
  });
}

// ─── Async ops (gated by isChiaEnabled + wallet) ───────────────────────────

/**
 * Submit an NFT transfer proposal to the wallet for signing + on-chain
 * submission. Per spec §2.5 Field 3-4: Sage handles the actual transaction
 * submission; Blocksworn requests a signature on the transfer proposal
 * message + tracks the pending state until settlement.
 *
 * V1 stub: invokes wallet-connect.signMessage on the transfer proposal
 * message; transitions the local NFT record to pending state (does NOT
 * remove from ownedNfts until on-chain settle).
 *
 * Sacred-cow note: this function NEVER writes to HERO_ROSTER or any
 * sacred system. Only module-local state is mutated. ADR-003 audited.
 *
 * @param {string} nftId
 * @param {string} recipientPuzzleHash
 * @returns {Promise<{ok:boolean, txProposalId?:string, reason?:string, error?:string}>}
 */
export async function submitTransfer(nftId, recipientPuzzleHash) {
  if (!isChiaEnabled()) {
    return { ok: false, reason: 'chia-disabled' };
  }
  const wallet = getConnectedWallet();
  if (!wallet || !wallet.connected) {
    return { ok: false, reason: 'wallet-not-connected' };
  }
  // Re-use buildTransferProposal validation (gives consistent reason codes).
  const proposal = buildTransferProposal(nftId, recipientPuzzleHash);
  if (!proposal.ok) {
    return { ok: false, reason: proposal.reason };
  }

  // V1 stub: optional test override short-circuit.
  if (_transferBehaviorOverride && _transferBehaviorOverride.mode === 'fail') {
    return { ok: false, reason: _transferBehaviorOverride.reason || 'exception' };
  }
  if (_transferBehaviorOverride && _transferBehaviorOverride.mode === 'pending') {
    const txProposalId = _synthesizeTxProposalId(nftId);
    _pendingTransfers[nftId] = Object.freeze({
      toAddr: recipientPuzzleHash,
      proposedAt: Date.now(),
      txProposalId,
    });
    return { ok: true, txProposalId };
  }

  // Request wallet signature on the transfer proposal message. V1 stub.
  // TODO(T4.12): replace with real Sage Wallet coin-spend submission.
  let sigResult;
  try {
    const proposalMsg = 'transfer:' + nftId + ':' + recipientPuzzleHash + ':' + Date.now();
    sigResult = await signMessage(proposalMsg);
  } catch (e) {
    log.error('[nft-backend] submitTransfer signMessage threw', e);
    return { ok: false, reason: 'exception', error: String(e) };
  }
  if (!sigResult || !sigResult.ok) {
    return { ok: false, reason: (sigResult && sigResult.reason) || 'exception' };
  }

  const txProposalId = _synthesizeTxProposalId(nftId);
  _pendingTransfers[nftId] = Object.freeze({
    toAddr: recipientPuzzleHash,
    proposedAt: Date.now(),
    txProposalId,
  });
  log.info('[nft-backend] transfer proposed', nftId, '→', recipientPuzzleHash.slice(0, 10) + '…');
  return { ok: true, txProposalId };
}

/**
 * Register a callback for transfer settlement events (incoming or outgoing).
 * Per spec §2.5 Field 4: subscribes to Chia block-events for the player's
 * puzzle hash. V1 stub = local in-process registry; T4.12 wires the live
 * Chia full-node indexer subscription.
 *
 * Returns an unsubscribe function that the caller MUST call when the
 * subscription is no longer needed (typical: component unmount).
 *
 * Callback signature:
 *   ({type:'incoming'|'outgoing', nftId:string, atMs:number, ...}) => void
 *
 * @param {Function} callback
 * @returns {Function} unsubscribe
 */
export function subscribeToTransfers(callback) {
  if (typeof callback !== 'function') {
    return () => { /* no-op */ };
  }
  _transferListeners.push(callback);
  return function unsubscribe() {
    const idx = _transferListeners.indexOf(callback);
    if (idx !== -1) _transferListeners.splice(idx, 1);
  };
}

/**
 * Simulate a transfer settlement event. Per spec §2.5 Field 4: on real
 * settlement the chain listener fires this; for V1 dev / staging / unit
 * tests, callers can invoke directly.
 *
 * Side effects:
 *   - If the NFT is owned by the current wallet, removes it from owned
 *     set (outgoing transfer) and notifies listeners with type='outgoing'.
 *   - If the NFT is incoming (new owner === current wallet), seeds an
 *     incoming record if not already present.
 *   - Clears pending state for the nftId.
 *
 * @param {string} nftId
 * @param {string} newOwner — the puzzle hash of the new owner after settlement
 * @returns {{ok:boolean, type?:'incoming'|'outgoing'|'observed', reason?:string}}
 */
export function simulateTransferSettlement(nftId, newOwner) {
  if (typeof nftId !== 'string' || !nftId) {
    return { ok: false, reason: 'invalid-input' };
  }
  if (typeof newOwner !== 'string' || !newOwner) {
    return { ok: false, reason: 'invalid-input' };
  }
  const wallet = getConnectedWallet();
  const ourAddr = wallet && wallet.connected ? wallet.address : null;
  const existing = _findOwnedNft(nftId);
  let type = 'observed';
  const atMs = Date.now();

  if (existing) {
    // We owned it. If newOwner !== ourAddr, this is an outgoing transfer:
    // remove from owned cache.
    if (newOwner !== existing.ownerPuzzleHash) {
      const heroId = existing.heroId;
      _state.ownedNfts = _state.ownedNfts.filter((n) => n.nftId !== nftId);
      const entry = _state.cache[heroId];
      if (entry) {
        entry.ownedNfts = entry.ownedNfts.filter((id) => id !== nftId);
        if (entry.activeSkin === existing.variantId
            && !entry.ownedNfts.some((id) => {
              const n = _findOwnedNft(id);
              return n && n.variantId === existing.variantId;
            })) {
          // Skin was set to this variant and we no longer own any of it:
          // clear the active skin (revert to base sprite).
          entry.activeSkin = null;
        }
      }
      type = 'outgoing';
    }
  } else if (ourAddr && newOwner === ourAddr) {
    // Incoming: V1 stub cannot reconstruct full NFT record without a chain
    // lookup, but tests + staging can pre-seed via _seedOwnedNftForTest
    // before calling simulate. Mark as incoming for listener payload only.
    type = 'incoming';
  }

  if (_pendingTransfers[nftId]) {
    delete _pendingTransfers[nftId];
  }

  _notifyTransferListeners(Object.freeze({ type, nftId, atMs, newOwner }));
  return { ok: true, type };
}

/**
 * Apply the 2.5% royalty on an observed marketplace sale. Per spec §2.5
 * Field 6 + ESC-04 Q2 ruling: Blocksworn does NOT submit royalty on-chain
 * (marketplace handles per NFT1 honor system). This function is the
 * audit/log surface: when a marketplace settlement event is observed, the
 * royalty breakdown is computed + logged for treasury accounting.
 *
 * Sacred-cow note: royaltyBps === 250 ALWAYS in the returned envelope
 * (ESC-04 Q2). DOES NOT modify any sacred system. DOES NOT submit a
 * transaction. ADR-003 anti-P2W audited.
 *
 * @param {string} nftId
 * @param {number} salePriceMojos
 * @returns {Promise<{ok:boolean, royaltyMojos?:number, treasuryMojos?:number, sellerNetMojos?:number, royaltyBps?:number, reason?:string}>}
 */
export async function applyRoyaltyOnSale(nftId, salePriceMojos) {
  if (!isChiaEnabled()) {
    return { ok: false, reason: 'chia-disabled' };
  }
  if (typeof nftId !== 'string' || !nftId) {
    return { ok: false, reason: 'invalid-input' };
  }
  const breakdown = getRoyaltyBreakdown(salePriceMojos);
  log.info('[nft-backend] royalty observed', nftId,
    'royaltyMojos=' + breakdown.royaltyMojos,
    'treasuryMojos=' + breakdown.treasuryMojos,
    'sellerNetMojos=' + breakdown.sellerNetMojos);
  return {
    ok: true,
    royaltyMojos: breakdown.royaltyMojos,
    treasuryMojos: breakdown.treasuryMojos,
    sellerNetMojos: breakdown.sellerNetMojos,
    royaltyBps: breakdown.royaltyBps,
  };
}

// ─── Test helpers (T4.05 / T4.06) ──────────────────────────────────────────

/**
 * Test helper: override transfer behavior. Mode 'success' = default
 * (sign + record); 'fail' = short-circuit with the supplied reason;
 * 'pending' = synthesize a tx-proposal envelope without invoking
 * signMessage (used to test the listener path in isolation).
 *
 * @param {{mode:'success'|'fail'|'pending', reason?:string}|null} override
 */
export function _setTransferBehaviorForTest(override) {
  _transferBehaviorOverride = override || null;
}

/**
 * Test helper: clear all registered transfer listeners. Useful between
 * test cases that register listeners without explicitly unsubscribing.
 */
export function _clearTransferListenersForTest() {
  _transferListeners = [];
}
