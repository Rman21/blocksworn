// 2026-05-13 — TASK-062 (T4.02): Chia network + wallet provider constants.
//
// Spec: docs/design/chia-integration.md §4 Wallet login flow + §13.6
//       ESC-04 Q1 ruling (Sage primary at V1; Chia Wallet deferred to V1.1).
//
// Sacred-cow safety:
//   - This file holds NO sacred-cow values per CLAUDE.md §2.x. It introduces
//     Phase 4 Chia-specific constants only — no overlap with combat math,
//     V_HAPTICS, NARRATOR_LINES, GEM_PACKS, Battle Pass, Tower, or any
//     Phase 2/3 system.
//   - All exports are Object.freeze'd to prevent runtime mutation.
//   - Per ADR-003 (no-P2W) + ADR-004 (hybrid): all Phase 4 code in src/ only.
//   - Per ADR-005 (mobile feature flag): callers MUST gate on isChiaEnabled()
//     before referencing any of these constants in a flow that initiates a
//     wallet handshake.
//
// V1 scope per ESC-04 Q1:
//   - Sage Wallet is the ONLY supported provider at V1 ship.
//   - Chia Wallet (reference) is listed in WALLET_PROVIDERS but the
//     wallet-connect service returns `{ok:false, reason:'not-supported'}`
//     when chia_wallet is requested in V1. Activation deferred to T4.02.1
//     follow-up (if T4.11 beta demands).
//
// V1 network scope per spec §4 + T4.12 (mainnet cutover):
//   - Default network is testnet11 for V1 dev + closed beta.
//   - Mainnet switch is a separate task (T4.12) that swaps
//     CHIA_DEFAULT_NETWORK and ships the Founder Badge gift batch.

/**
 * Chia testnet identifier (per spec §4 + Chia ecosystem convention).
 * Used during V1 dev + closed beta.
 */
export const CHIA_NETWORK_TESTNET = 'testnet11';

/**
 * Chia mainnet identifier.
 * Activated by T4.12 Wave 1 mainnet cutover.
 */
export const CHIA_NETWORK_MAINNET = 'mainnet';

/**
 * Default network at V1 = testnet11 (per spec §4). T4.12 flips this to
 * CHIA_NETWORK_MAINNET when mainnet launches.
 */
export const CHIA_DEFAULT_NETWORK = CHIA_NETWORK_TESTNET;

/**
 * Wallet connection timeout in milliseconds. Per spec §4.6 performance
 * budget: "Connect handshake (excluding user signature time): ≤3s p99".
 * 30s upper bound includes user signature dwell time before timeout fires.
 */
export const WALLET_CONNECTION_TIMEOUT_MS = 30000;

/**
 * Supported wallet providers. Sage is V1 primary per ESC-04 Q1; Chia Wallet
 * is listed for SDK forward-compatibility but the wallet-connect service
 * returns 'not-supported' for it at V1.
 */
export const WALLET_PROVIDERS = Object.freeze({
  SAGE: 'sage',
  CHIA_WALLET: 'chia_wallet',
});

/**
 * Default wallet provider — Sage per ESC-04 Q1.
 */
export const WALLET_DEFAULT_PROVIDER = WALLET_PROVIDERS.SAGE;

/**
 * Prefix prepended to challenge nonces before requesting a wallet signature.
 * Signed messages are namespaced to Blocksworn so a Sage signature for any
 * other app can never be replayed against our auth surface.
 *
 * Concrete shape: `Blocksworn auth: <session-nonce-uuid>`
 */
export const WALLET_AUTH_CHALLENGE_PREFIX = 'Blocksworn auth: ';

/**
 * localStorage key for the wallet connection state envelope. Per spec §4.3
 * "session-only for V1", we still cache the connection within a single
 * session so a page reload during dev does not force re-handshake; the
 * stored envelope is short-lived and disconnect clears it instantly.
 */
export const WALLET_STORAGE_KEY = 'bsw_wallet_state';

/**
 * Blocksworn treasury wallet puzzle hash (Chia bech32 `xch1...` address).
 *
 * Per spec §2.5 Field 6 + ESC-04 Q2 ruling: the 2.5% royalty on Blocksworn
 * NFT secondary sales flows to this address. Honor is voluntary at the
 * marketplace level per Chia NFT1 ecosystem norm (Sage / Spacescan /
 * Mintgarden honor royalty metadata; the protocol does not enforce).
 *
 * V1 stub value — TODO(T4.12): replace with the real production treasury
 * puzzle hash at mainnet cutover. The stub is `xch1...`-shaped so all
 * client-side address-shape validation passes; on-chain submission of the
 * stub at V1 is impossible because mint/transfer flows are gated behind a
 * real wallet handshake (T4.02) + live indexer (T4.12).
 *
 * Sacred-cow note: this is a configuration constant, NOT a sacred value.
 * Changing the treasury puzzle hash before T4.12 mainnet is a no-op for
 * gameplay (no chain submission happens at V1 dev / testnet beta).
 */
export const BLOCKSWORN_TREASURY_PUZZLEHASH = 'xch1blocksworntreasury000000000000000000000000000000000000';
