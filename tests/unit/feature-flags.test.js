// 2026-05-13 — TASK-061 (T4.09): Mobile feature flag unit tests.
//
// Sacred-cow safety verified at every assertion: isChiaEnabled() is the
// ONLY source of truth. Default true (web/PWA) — mobile build sets false
// via VITE_CHIA_ENABLED env at compile time.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isChiaEnabled, _setChiaEnabledForTest, logChiaFlagState } from '../../src/services/feature-flags.js';

describe('T4.09 — isChiaEnabled() default behavior', () => {
  beforeEach(() => { _setChiaEnabledForTest(null); });
  afterEach(() => { _setChiaEnabledForTest(null); });

  it('defaults to true when no override + no env var', () => {
    // In Node test env, import.meta.env exists via Vite but VITE_CHIA_ENABLED
    // is undefined → default true.
    const r = isChiaEnabled();
    // Either truly true (default) or false if env happens to be 'false'.
    // Test environment doesn't set VITE_CHIA_ENABLED, so it must be true.
    expect(typeof r).toBe('boolean');
    expect(r).toBe(true);
  });

  it('runtime override false → returns false', () => {
    _setChiaEnabledForTest(false);
    expect(isChiaEnabled()).toBe(false);
  });

  it('runtime override true → returns true', () => {
    _setChiaEnabledForTest(true);
    expect(isChiaEnabled()).toBe(true);
  });

  it('runtime override null → returns to default (true)', () => {
    _setChiaEnabledForTest(false);
    expect(isChiaEnabled()).toBe(false);
    _setChiaEnabledForTest(null);
    expect(isChiaEnabled()).toBe(true);
  });
});

describe('T4.09 — _setChiaEnabledForTest defensive', () => {
  it('handles non-boolean → coerces via !!', () => {
    _setChiaEnabledForTest(1);
    expect(isChiaEnabled()).toBe(true);
    _setChiaEnabledForTest(0);
    expect(isChiaEnabled()).toBe(false);
    _setChiaEnabledForTest(null);
  });

  it('logChiaFlagState calls logFn without throwing', () => {
    const calls = [];
    logChiaFlagState((...args) => calls.push(args));
    expect(calls.length).toBe(1);
    expect(calls[0][0]).toMatch(/feature-flags/);
  });

  it('logChiaFlagState with non-function logFn → no throw', () => {
    expect(() => logChiaFlagState(null)).not.toThrow();
    expect(() => logChiaFlagState('not a fn')).not.toThrow();
  });
});

describe('T4.09 — sacred invariants', () => {
  it('return value is ALWAYS boolean (defensive — no string leaks)', () => {
    _setChiaEnabledForTest(null);
    expect(typeof isChiaEnabled()).toBe('boolean');
    _setChiaEnabledForTest(true);
    expect(typeof isChiaEnabled()).toBe('boolean');
    _setChiaEnabledForTest(false);
    expect(typeof isChiaEnabled()).toBe('boolean');
  });

  it('idempotent: same input always returns same output', () => {
    _setChiaEnabledForTest(true);
    expect(isChiaEnabled()).toBe(isChiaEnabled());
    expect(isChiaEnabled()).toBe(isChiaEnabled());
  });
});
