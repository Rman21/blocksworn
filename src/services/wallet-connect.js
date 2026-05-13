// 2026-05-13 — TASK-062 (T4.02): Sage Wallet connect service.
//
// Spec: docs/design/chia-integration.md §4 Wallet login flow
//       + §13.6 (ESC-04 Q1: Sage primary at V1; Chia Wallet deferred to V1.1).
//
// Sacred-cow safety:
//   - This file holds NO sacred-cow logic per CLAUDE.md §2.x. It is a new
//     Phase 4 service introducing wallet connection — no overlap with combat
//     math, V_HAPTICS, NARRATOR_LINES, GEM_PACKS, Battle Pass, Tower retry
//     gem ladder, or any Phase 2/3 backend (clan-backend, party-tower-backend,
//     tower-season-backend, friend-graph). All sacred systems untouched.
//   - Per ADR-003 (no-P2W) + ADR-004 (hybrid): wallet connection grants ZERO
//     mechanical advantage. Connecting only enables NFT inventory rendering
//     + DAO clan visibility + on-chain Achievement Wall surface — all per
//     spec §4.4. F2P parity is preserved.
//   - Per ADR-005 (mobile feature flag, T4.09): EVERY exported async op
//     first checks `isChiaEnabled()` and returns
//     `{ok:false, reason:'chia-disabled'}` if the flag is off. The mobile
//     build (VITE_CHIA_ENABLED=false) MUST never initiate a wallet flow.
//
// V1 lifecycle (per spec §4.3): session-only.
//   - No persistent wallet binding to the player's save.
//   - Connection state lives in module-local memory + a short-lived
//     localStorage envelope (key WALLET_STORAGE_KEY) that is cleared on
//     disconnect or page-tab-close. The envelope is a dev convenience to
//     survive reloads within a single session, NOT a remembered-token.
//
// Envelope pattern (per Phase 3 backend convention):
//   - All async ops return { ok: boolean, ...payload } and NEVER throw.
//   - Common reason codes:
//       'chia-disabled'   — isChiaEnabled() === false (mobile build / runtime flag)
//       'no-sdk'          — Sage extension not detected on window
//       'not-supported'   — caller asked for chia_wallet provider at V1
//       'invalid-input'   — bad argument (defensive guard)
//       'not-connected'   — caller asked to sign with no active connection
//       'timeout'         — handshake exceeded WALLET_CONNECTION_TIMEOUT_MS
//       'user-cancelled'  — Sage prompt rejected by user
//
// TODO(T4.12): replace SDK stub calls (_callSageConnect, _callSageSign,
//   _detectSage) with the production Sage Wallet SDK once the live
//   integration spec is finalized. V1 dev runs with stub-mode via
//   `_setWalletForTest({connected:true, address:'chia1mock...'})`
//   or `_setSageBehaviorForTest({connect, sign})` for unit-test injection.

import { isChiaEnabled } from './feature-flags.js';
import { log } from './logger.js';
import {
  WALLET_PROVIDERS,
  WALLET_DEFAULT_PROVIDER,
  WALLET_AUTH_CHALLENGE_PREFIX,
  WALLET_STORAGE_KEY,
  WALLET_CONNECTION_TIMEOUT_MS,
} from '../data/chia-config.js';

// ─── Module-local state ────────────────────────────────────────────────────
// Per Phase 1 standards: no window globals. State lives here, persisted to
// localStorage on connect/disconnect.

let _state = _emptyState();
let _sageBehaviorOverride = null;

function _emptyState() {
  return Object.freeze({
    connected: false,
    address: null,
    provider: null,
    connectedAt: null,
  });
}

function _isValidAddress(addr) {
  return typeof addr === 'string' && addr.length >= 10 && /^chia[0-9a-z]+$/i.test(addr);
}

function _persist() {
  try {
    if (typeof localStorage === 'undefined') return;
    if (_state.connected) {
      localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(_state));
    } else {
      localStorage.removeItem(WALLET_STORAGE_KEY);
    }
  } catch (_e) {
    // Quota / unavailable — swallow. Wallet state still lives in memory.
  }
}

function _hydrate() {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(WALLET_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.connected === true && _isValidAddress(parsed.address)) {
      _state = Object.freeze({
        connected: true,
        address: parsed.address,
        provider: parsed.provider || WALLET_DEFAULT_PROVIDER,
        connectedAt: typeof parsed.connectedAt === 'number' ? parsed.connectedAt : Date.now(),
      });
    }
  } catch (_e) {
    // Corrupt envelope — silently fall back to empty state.
    _state = _emptyState();
  }
}

// Attempt hydration once at module load. Safe in node test env (early-return
// when localStorage is undefined).
_hydrate();

// ─── Sage SDK stub layer ──────────────────────────────────────────────────
// TODO(T4.12): swap with real Sage Wallet SDK. Until then, detection is
// based on `window.sage` presence and connect/sign are stubs that return
// a synthetic "no-sdk" envelope. Tests inject behavior via
// `_setSageBehaviorForTest({connect, sign})`.

function _detectSage() {
  if (typeof window === 'undefined') return null;
  // Sage browser extension is expected to inject `window.sage`. The exact
  // surface is finalized in T4.12 live integration. Until then, any truthy
  // value is treated as "available".
  return window.sage || null;
}

async function _callSageConnect(sage) {
  if (_sageBehaviorOverride && typeof _sageBehaviorOverride.connect === 'function') {
    return _sageBehaviorOverride.connect(sage);
  }
  // TODO(T4.12): real Sage SDK handshake. For V1 dev:
  //   const result = await sage.requestConnection({ network: CHIA_DEFAULT_NETWORK });
  //   return { ok: true, address: result.address };
  return { ok: false, reason: 'no-sdk' };
}

async function _callSageSign(sage, message) {
  if (_sageBehaviorOverride && typeof _sageBehaviorOverride.sign === 'function') {
    return _sageBehaviorOverride.sign(sage, message);
  }
  // TODO(T4.12): real Sage SDK signature request. For V1 dev:
  //   const sig = await sage.signMessage({ message });
  //   return { ok: true, signature: sig };
  return { ok: false, reason: 'no-sdk' };
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Detect whether a supported wallet provider is installed in the current
 * environment. Safe to call regardless of `isChiaEnabled()` state — returns
 * false in mobile builds where Chia is gated off.
 *
 * @returns {boolean}
 */
export function isWalletAvailable() {
  if (!isChiaEnabled()) return false;
  return _detectSage() !== null;
}

/**
 * Returns the current wallet connection state as a frozen snapshot.
 * Never throws. Always returns an object with `connected:boolean`.
 *
 * @returns {{connected:boolean, address?:string, provider?:string, connectedAt?:number}}
 */
export function getConnectedWallet() {
  return _state;
}

/**
 * Initiate a wallet connection handshake.
 *
 * @param {string} [provider] — 'sage' (default) or 'chia_wallet' (V1: not-supported).
 * @returns {Promise<{ok:boolean, address?:string, provider?:string, reason?:string}>}
 */
export async function connectWallet(provider = WALLET_DEFAULT_PROVIDER) {
  if (!isChiaEnabled()) {
    return { ok: false, reason: 'chia-disabled' };
  }
  if (typeof provider !== 'string' || !provider) {
    return { ok: false, reason: 'invalid-input' };
  }
  // Per ESC-04 Q1: Sage is the ONLY V1 provider. Chia Wallet returns
  // 'not-supported' until T4.02.1 follow-up enables it.
  if (provider === WALLET_PROVIDERS.CHIA_WALLET) {
    return { ok: false, reason: 'not-supported' };
  }
  if (provider !== WALLET_PROVIDERS.SAGE) {
    return { ok: false, reason: 'invalid-input' };
  }

  const sage = _detectSage();
  if (!sage) {
    return { ok: false, reason: 'no-sdk' };
  }

  // Race the handshake against the connection timeout.
  let timeoutId = null;
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve({ ok: false, reason: 'timeout' }),
      WALLET_CONNECTION_TIMEOUT_MS);
  });
  let result;
  try {
    result = await Promise.race([_callSageConnect(sage), timeoutPromise]);
  } catch (_e) {
    result = { ok: false, reason: 'no-sdk' };
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
  if (!result || !result.ok || !_isValidAddress(result.address)) {
    return result && result.reason
      ? { ok: false, reason: result.reason }
      : { ok: false, reason: 'no-sdk' };
  }

  _state = Object.freeze({
    connected: true,
    address: result.address,
    provider: WALLET_PROVIDERS.SAGE,
    connectedAt: Date.now(),
  });
  _persist();
  log.info('[wallet-connect] connected', _state.address.slice(0, 10) + '…');
  return { ok: true, address: _state.address, provider: _state.provider };
}

/**
 * Clear local wallet state. Idempotent — safe to call when already
 * disconnected. Note: per spec §4.3 disconnecting does NOT un-mint NFTs
 * (those live on-chain forever).
 *
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function disconnectWallet() {
  if (!isChiaEnabled()) {
    return { ok: false, reason: 'chia-disabled' };
  }
  _state = _emptyState();
  _persist();
  log.info('[wallet-connect] disconnected');
  return { ok: true };
}

/**
 * Request a signature on a Blocksworn auth challenge from the connected
 * wallet. The message is prefixed with WALLET_AUTH_CHALLENGE_PREFIX so a
 * Sage signature for any other app can never be replayed against our
 * auth surface.
 *
 * @param {string} msg — challenge nonce (e.g., session UUID).
 * @returns {Promise<{ok:boolean, signature?:string, reason?:string}>}
 */
export async function signMessage(msg) {
  if (!isChiaEnabled()) {
    return { ok: false, reason: 'chia-disabled' };
  }
  if (typeof msg !== 'string' || !msg) {
    return { ok: false, reason: 'invalid-input' };
  }
  if (!_state.connected) {
    return { ok: false, reason: 'not-connected' };
  }
  const sage = _detectSage();
  if (!sage) {
    return { ok: false, reason: 'no-sdk' };
  }
  const challenge = WALLET_AUTH_CHALLENGE_PREFIX + msg;
  let result;
  try {
    result = await _callSageSign(sage, challenge);
  } catch (_e) {
    result = { ok: false, reason: 'no-sdk' };
  }
  if (!result || !result.ok || typeof result.signature !== 'string') {
    return result && result.reason
      ? { ok: false, reason: result.reason }
      : { ok: false, reason: 'no-sdk' };
  }
  return { ok: true, signature: result.signature };
}

// ─── Test helpers ──────────────────────────────────────────────────────────
// Per Phase 1 testing convention: module-local overrides that work in both
// browser + node test env without touching window globals.

/**
 * Test helper: set the module-local wallet state directly. Bypasses the
 * Sage SDK detection layer entirely. Also serves as the V1 dev stub-mode
 * fallback when Sage isn't installed.
 *
 * Example:
 *   _setWalletForTest({connected:true, address:'chia1mockaddr0000'});
 *
 * @param {{connected?:boolean, address?:string, provider?:string, connectedAt?:number}|null} state
 */
export function _setWalletForTest(state) {
  if (state === null || state === undefined) {
    _state = _emptyState();
    _persist();
    return;
  }
  if (state.connected === true && _isValidAddress(state.address)) {
    _state = Object.freeze({
      connected: true,
      address: state.address,
      provider: state.provider || WALLET_DEFAULT_PROVIDER,
      connectedAt: typeof state.connectedAt === 'number' ? state.connectedAt : Date.now(),
    });
  } else {
    _state = _emptyState();
  }
  _persist();
}

/**
 * Test helper: inject a synthetic Sage SDK presence onto window for unit
 * tests that need `_detectSage()` to find something. Must be paired with
 * `_setSageStubForTest(null)` in `afterEach` to clear.
 *
 * @param {object|null} stub — fake sage object (any truthy value to mark "installed"); null clears.
 */
export function _setSageStubForTest(stub) {
  if (typeof window === 'undefined') return;
  if (stub === null || stub === undefined) {
    delete window.sage;
  } else {
    window.sage = stub;
  }
}

/**
 * Test helper: inject synthetic Sage SDK behavior. Replaces the stub
 * `_callSageConnect` / `_callSageSign` resolvers for one test.
 *
 * @param {{connect?:Function, sign?:Function}|null} overrides
 */
export function _setSageBehaviorForTest(overrides) {
  _sageBehaviorOverride = overrides || null;
}
