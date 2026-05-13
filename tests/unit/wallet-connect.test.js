// 2026-05-13 — TASK-062 (T4.02): Sage Wallet connect service unit tests.
//
// Spec: docs/design/chia-integration.md §4 + §13.6 (ESC-04 Q1).
//
// Sacred-cow safety verified at every assertion:
//   - isChiaEnabled() gate honored by EVERY exported async op
//   - Sage primary at V1; chia_wallet returns 'not-supported'
//   - Envelope { ok, ...} pattern — no exception leaks
//   - Module-local state only (no window globals beyond the synthetic Sage stub)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  connectWallet,
  disconnectWallet,
  getConnectedWallet,
  signMessage,
  isWalletAvailable,
  _setWalletForTest,
  _setSageStubForTest,
  _setSageBehaviorForTest,
} from '../../src/services/wallet-connect.js';
import { _setChiaEnabledForTest } from '../../src/services/feature-flags.js';
import { WALLET_PROVIDERS, WALLET_STORAGE_KEY } from '../../src/data/chia-config.js';

// ─── Test setup: synthetic window so _detectSage() can find a fake Sage SDK.
// Vitest runs in `node` env — `window` is not defined by default. We attach
// a minimal `globalThis.window` so test-injected `_setSageStubForTest` has
// somewhere to write. Tests that need "no window" simulate via stub clear.

function _ensureFakeWindow() {
  if (typeof globalThis.window === 'undefined') {
    // Minimal fake — wallet-connect only reads `window.sage`.
    globalThis.window = {};
  }
}

function _resetAll() {
  _setChiaEnabledForTest(null);
  _setSageBehaviorForTest(null);
  _setSageStubForTest(null);
  _setWalletForTest(null);
}

beforeEach(() => {
  _ensureFakeWindow();
  _resetAll();
});

afterEach(() => {
  _resetAll();
});

// ─── Default state ─────────────────────────────────────────────────────────

describe('T4.02 — default state', () => {
  it('getConnectedWallet returns disconnected snapshot by default', () => {
    const s = getConnectedWallet();
    expect(s.connected).toBe(false);
    expect(s.address).toBe(null);
    expect(s.provider).toBe(null);
    expect(s.connectedAt).toBe(null);
  });

  it('getConnectedWallet snapshot is frozen', () => {
    const s = getConnectedWallet();
    expect(Object.isFrozen(s)).toBe(true);
  });
});

// ─── isChiaEnabled() gate (sacred invariant) ──────────────────────────────

describe('T4.02 — Chia-disabled gate (ADR-005 sacred invariant)', () => {
  it('connectWallet returns chia-disabled when flag is false', async () => {
    _setChiaEnabledForTest(false);
    const r = await connectWallet();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('chia-disabled');
  });

  it('disconnectWallet returns chia-disabled when flag is false', async () => {
    _setChiaEnabledForTest(false);
    const r = await disconnectWallet();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('chia-disabled');
  });

  it('signMessage returns chia-disabled when flag is false', async () => {
    _setChiaEnabledForTest(false);
    const r = await signMessage('challenge-nonce');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('chia-disabled');
  });

  it('isWalletAvailable returns false when flag is false (even if SDK present)', () => {
    _setSageStubForTest({});
    _setChiaEnabledForTest(false);
    expect(isWalletAvailable()).toBe(false);
  });
});

// ─── SDK absence ──────────────────────────────────────────────────────────

describe('T4.02 — no-sdk path', () => {
  it('connectWallet returns no-sdk when Sage not installed', async () => {
    _setSageStubForTest(null);
    const r = await connectWallet();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no-sdk');
  });

  it('isWalletAvailable returns false when Sage not installed', () => {
    _setSageStubForTest(null);
    expect(isWalletAvailable()).toBe(false);
  });

  it('isWalletAvailable returns true when Sage stub is present', () => {
    _setSageStubForTest({ fake: true });
    expect(isWalletAvailable()).toBe(true);
  });

  it('signMessage returns no-sdk when not connected and no SDK', async () => {
    // With no connection, signMessage short-circuits on not-connected BEFORE
    // checking SDK — this is the correct precedence.
    const r = await signMessage('challenge');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-connected');
  });
});

// ─── Provider routing (ESC-04 Q1) ─────────────────────────────────────────

describe('T4.02 — ESC-04 Q1: Sage primary, Chia Wallet not-supported at V1', () => {
  it('chia_wallet provider returns not-supported', async () => {
    _setSageStubForTest({});
    const r = await connectWallet(WALLET_PROVIDERS.CHIA_WALLET);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-supported');
  });

  it('unknown provider returns invalid-input', async () => {
    _setSageStubForTest({});
    const r = await connectWallet('some-other-wallet');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-input');
  });

  it('empty-string provider returns invalid-input', async () => {
    const r = await connectWallet('');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-input');
  });

  it('non-string provider returns invalid-input', async () => {
    const r = await connectWallet(123);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-input');
  });
});

// ─── _setWalletForTest stub-mode ──────────────────────────────────────────

describe('T4.02 — _setWalletForTest stub-mode (V1 dev fallback)', () => {
  it('sets connected wallet state with synthetic address', () => {
    _setWalletForTest({ connected: true, address: 'chia1mockaddr0001' });
    const s = getConnectedWallet();
    expect(s.connected).toBe(true);
    expect(s.address).toBe('chia1mockaddr0001');
    expect(s.provider).toBe('sage');
    expect(typeof s.connectedAt).toBe('number');
  });

  it('rejects invalid address (non-chia prefix) and falls back to empty', () => {
    _setWalletForTest({ connected: true, address: 'eth0xbadaddress' });
    expect(getConnectedWallet().connected).toBe(false);
  });

  it('rejects too-short address', () => {
    _setWalletForTest({ connected: true, address: 'chia1' });
    expect(getConnectedWallet().connected).toBe(false);
  });

  it('null clears state to disconnected', () => {
    _setWalletForTest({ connected: true, address: 'chia1mockaddr0002' });
    expect(getConnectedWallet().connected).toBe(true);
    _setWalletForTest(null);
    expect(getConnectedWallet().connected).toBe(false);
  });
});

// ─── Disconnect ───────────────────────────────────────────────────────────

describe('T4.02 — disconnectWallet', () => {
  it('clears connected state', async () => {
    _setWalletForTest({ connected: true, address: 'chia1mockaddr0003' });
    expect(getConnectedWallet().connected).toBe(true);
    const r = await disconnectWallet();
    expect(r.ok).toBe(true);
    expect(getConnectedWallet().connected).toBe(false);
  });

  it('is idempotent when already disconnected', async () => {
    const r1 = await disconnectWallet();
    const r2 = await disconnectWallet();
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
  });
});

// ─── signMessage ──────────────────────────────────────────────────────────

describe('T4.02 — signMessage', () => {
  it('returns not-connected when no wallet active', async () => {
    const r = await signMessage('challenge-abc');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-connected');
  });

  it('returns invalid-input on non-string msg', async () => {
    _setWalletForTest({ connected: true, address: 'chia1mockaddr0004' });
    const r = await signMessage(null);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-input');
  });

  it('returns invalid-input on empty msg', async () => {
    _setWalletForTest({ connected: true, address: 'chia1mockaddr0005' });
    const r = await signMessage('');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-input');
  });

  it('returns no-sdk when connected but SDK absent', async () => {
    _setWalletForTest({ connected: true, address: 'chia1mockaddr0006' });
    _setSageStubForTest(null);
    const r = await signMessage('challenge');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no-sdk');
  });

  it('returns signature via injected Sage behavior with auth prefix', async () => {
    _setWalletForTest({ connected: true, address: 'chia1mockaddr0007' });
    _setSageStubForTest({});
    let capturedMessage = null;
    _setSageBehaviorForTest({
      sign: (_sage, message) => {
        capturedMessage = message;
        return Promise.resolve({ ok: true, signature: '0xdeadbeefsignature' });
      },
    });
    const r = await signMessage('session-uuid-xyz');
    expect(r.ok).toBe(true);
    expect(r.signature).toBe('0xdeadbeefsignature');
    // The challenge MUST be prefixed with "Blocksworn auth: " to prevent
    // signature replay against other apps.
    expect(capturedMessage).toBe('Blocksworn auth: session-uuid-xyz');
  });

  it('returns no-sdk envelope when Sage sign throws', async () => {
    _setWalletForTest({ connected: true, address: 'chia1mockaddr0008' });
    _setSageStubForTest({});
    _setSageBehaviorForTest({
      sign: () => { throw new Error('Sage extension crashed'); },
    });
    const r = await signMessage('challenge');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no-sdk');
  });
});

// ─── connectWallet success path ────────────────────────────────────────────

describe('T4.02 — connectWallet success path (Sage stub)', () => {
  it('returns ok + address when Sage handshake succeeds', async () => {
    _setSageStubForTest({});
    _setSageBehaviorForTest({
      connect: () => Promise.resolve({ ok: true, address: 'chia1success000abc' }),
    });
    const r = await connectWallet();
    expect(r.ok).toBe(true);
    expect(r.address).toBe('chia1success000abc');
    expect(r.provider).toBe('sage');
    expect(getConnectedWallet().connected).toBe(true);
  });

  it('rejects connect result with malformed address', async () => {
    _setSageStubForTest({});
    _setSageBehaviorForTest({
      connect: () => Promise.resolve({ ok: true, address: 'not-a-chia-addr' }),
    });
    const r = await connectWallet();
    expect(r.ok).toBe(false);
    // Falls through to no-sdk reason since result.ok was true but address was
    // not a valid chia address.
    expect(r.reason).toBe('no-sdk');
  });

  it('honors Sage user-cancelled rejection', async () => {
    _setSageStubForTest({});
    _setSageBehaviorForTest({
      connect: () => Promise.resolve({ ok: false, reason: 'user-cancelled' }),
    });
    const r = await connectWallet();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('user-cancelled');
  });

  it('handles Sage SDK throw without leaking exception', async () => {
    _setSageStubForTest({});
    _setSageBehaviorForTest({
      connect: () => { throw new Error('extension crashed'); },
    });
    const r = await connectWallet();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no-sdk');
  });
});

// ─── Persistence ──────────────────────────────────────────────────────────

describe('T4.02 — localStorage persistence', () => {
  it('persists connected state to bsw_wallet_state', () => {
    // Provide a minimal localStorage stub for node env.
    const store = {};
    globalThis.localStorage = {
      getItem: (k) => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { for (const k in store) delete store[k]; },
    };
    _setWalletForTest({ connected: true, address: 'chia1persistent01' });
    const raw = globalThis.localStorage.getItem(WALLET_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.connected).toBe(true);
    expect(parsed.address).toBe('chia1persistent01');
    // Cleanup
    _setWalletForTest(null);
    expect(globalThis.localStorage.getItem(WALLET_STORAGE_KEY)).toBeNull();
    delete globalThis.localStorage;
  });
});
