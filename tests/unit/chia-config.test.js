// 2026-05-13 — TASK-062 (T4.02): Chia config invariants.
//
// Verifies the Phase 4 wallet/network constants are frozen, expose the
// expected keys, and honor the ESC-04 Q1 ruling (Sage primary at V1) +
// V1 testnet default per spec §4.

import { describe, it, expect } from 'vitest';
import {
  CHIA_NETWORK_TESTNET,
  CHIA_NETWORK_MAINNET,
  CHIA_DEFAULT_NETWORK,
  WALLET_CONNECTION_TIMEOUT_MS,
  WALLET_PROVIDERS,
  WALLET_DEFAULT_PROVIDER,
  WALLET_AUTH_CHALLENGE_PREFIX,
  WALLET_STORAGE_KEY,
} from '../../src/data/chia-config.js';

describe('T4.02 — chia-config constants', () => {
  it('CHIA_NETWORK_TESTNET === "testnet11" per spec §4', () => {
    expect(CHIA_NETWORK_TESTNET).toBe('testnet11');
  });

  it('CHIA_NETWORK_MAINNET === "mainnet"', () => {
    expect(CHIA_NETWORK_MAINNET).toBe('mainnet');
  });

  it('CHIA_DEFAULT_NETWORK === testnet11 for V1 (mainnet switch is T4.12)', () => {
    expect(CHIA_DEFAULT_NETWORK).toBe('testnet11');
    expect(CHIA_DEFAULT_NETWORK).toBe(CHIA_NETWORK_TESTNET);
  });

  it('WALLET_CONNECTION_TIMEOUT_MS === 30000', () => {
    expect(WALLET_CONNECTION_TIMEOUT_MS).toBe(30000);
    expect(typeof WALLET_CONNECTION_TIMEOUT_MS).toBe('number');
  });

  it('WALLET_PROVIDERS exposes SAGE + CHIA_WALLET keys (ESC-04 Q1 forward-compat)', () => {
    expect(WALLET_PROVIDERS.SAGE).toBe('sage');
    expect(WALLET_PROVIDERS.CHIA_WALLET).toBe('chia_wallet');
  });

  it('WALLET_PROVIDERS is frozen', () => {
    expect(Object.isFrozen(WALLET_PROVIDERS)).toBe(true);
    // Mutation attempt is silently ignored (non-strict) or throws (strict);
    // either way the value must be unchanged.
    try { WALLET_PROVIDERS.SAGE = 'tampered'; } catch (_e) { /* strict mode */ }
    expect(WALLET_PROVIDERS.SAGE).toBe('sage');
  });

  it('WALLET_DEFAULT_PROVIDER === "sage" per ESC-04 Q1 ruling', () => {
    expect(WALLET_DEFAULT_PROVIDER).toBe('sage');
    expect(WALLET_DEFAULT_PROVIDER).toBe(WALLET_PROVIDERS.SAGE);
  });

  it('WALLET_AUTH_CHALLENGE_PREFIX === "Blocksworn auth: "', () => {
    expect(WALLET_AUTH_CHALLENGE_PREFIX).toBe('Blocksworn auth: ');
    // Trailing space matters — concatenated directly with the nonce.
    expect(WALLET_AUTH_CHALLENGE_PREFIX.endsWith(' ')).toBe(true);
  });

  it('WALLET_STORAGE_KEY uses bsw_ namespace', () => {
    expect(WALLET_STORAGE_KEY).toBe('bsw_wallet_state');
    expect(WALLET_STORAGE_KEY.startsWith('bsw_')).toBe(true);
  });
});

describe('T4.02 — chia-config sacred invariants', () => {
  it('all string constants are non-empty', () => {
    expect(CHIA_NETWORK_TESTNET.length).toBeGreaterThan(0);
    expect(CHIA_NETWORK_MAINNET.length).toBeGreaterThan(0);
    expect(CHIA_DEFAULT_NETWORK.length).toBeGreaterThan(0);
    expect(WALLET_DEFAULT_PROVIDER.length).toBeGreaterThan(0);
    expect(WALLET_AUTH_CHALLENGE_PREFIX.length).toBeGreaterThan(0);
    expect(WALLET_STORAGE_KEY.length).toBeGreaterThan(0);
  });

  it('WALLET_DEFAULT_PROVIDER value is a valid WALLET_PROVIDERS entry', () => {
    const validValues = Object.values(WALLET_PROVIDERS);
    expect(validValues).toContain(WALLET_DEFAULT_PROVIDER);
  });

  it('CHIA_DEFAULT_NETWORK is a valid known network', () => {
    expect([CHIA_NETWORK_TESTNET, CHIA_NETWORK_MAINNET]).toContain(CHIA_DEFAULT_NETWORK);
  });
});
