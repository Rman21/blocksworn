// 2026-05-13 — TASK-063 (T4.03 + T4.04): NFT-hero binding state + mint flow.
//
// Spec: docs/design/chia-integration.md §2.1 (sacred stat-block identity)
//       + §2.4 (mint flow) + §2.6 (Founder Badge) + §13.6 ESC-04 Q2 ruling.
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
