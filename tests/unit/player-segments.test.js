// 2026-05-12 — TASK-027 (T1.20): Player segments — threshold regression suite.
//
// Sacred thresholds per CLAUDE.md §9 (Glossary) + Execution Plan §13 T1.20:
//   F2P     — totalSpentUSD === 0
//   Minnow  — $1 .. $24.99
//   Dolphin — $25 .. $99.99
//   Whale   — $100+
//
// These boundary values are LOCKED. Any change to the thresholds must be
// escalated to Roman per the source-code comment in src/services/analytics.js.
// This test acts as the regression net — drift here = sacred constant tampered.

import { describe, it, expect } from 'vitest';
import {
  getPlayerSegment,
  setSegmentState,
  logEvent,
  SEGMENT_F2P,
  SEGMENT_MINNOW,
  SEGMENT_DOLPHIN,
  SEGMENT_WHALE,
} from '../../src/services/analytics.js';

describe('getPlayerSegment — sacred thresholds (T1.20)', () => {
  it('segment-name constants are the canonical strings', () => {
    expect(SEGMENT_F2P).toBe('F2P');
    expect(SEGMENT_MINNOW).toBe('Minnow');
    expect(SEGMENT_DOLPHIN).toBe('Dolphin');
    expect(SEGMENT_WHALE).toBe('Whale');
  });

  it('returns F2P for unset / partial state', () => {
    expect(getPlayerSegment(undefined)).toBe('F2P');
    expect(getPlayerSegment(null)).toBe('F2P');
    expect(getPlayerSegment({})).toBe('F2P');
    expect(getPlayerSegment({ iap: {} })).toBe('F2P');
    expect(getPlayerSegment({ iap: { totalSpentUSD: 0 } })).toBe('F2P');
  });

  it('returns F2P for malformed / negative / non-numeric totalSpentUSD', () => {
    expect(getPlayerSegment({ iap: { totalSpentUSD: -1 } })).toBe('F2P');
    expect(getPlayerSegment({ iap: { totalSpentUSD: 'oops' } })).toBe('F2P');
    expect(getPlayerSegment({ iap: { totalSpentUSD: NaN } })).toBe('F2P');
    expect(getPlayerSegment({ iap: { totalSpentUSD: Infinity } })).toBe('F2P');
  });

  it('returns Minnow for $1 .. $24.99', () => {
    expect(getPlayerSegment({ iap: { totalSpentUSD: 1 } })).toBe('Minnow');
    expect(getPlayerSegment({ iap: { totalSpentUSD: 4.99 } })).toBe('Minnow');
    expect(getPlayerSegment({ iap: { totalSpentUSD: 10 } })).toBe('Minnow');
    expect(getPlayerSegment({ iap: { totalSpentUSD: 24.99 } })).toBe('Minnow');
  });

  it('returns Dolphin for $25 .. $99.99', () => {
    expect(getPlayerSegment({ iap: { totalSpentUSD: 25 } })).toBe('Dolphin');
    expect(getPlayerSegment({ iap: { totalSpentUSD: 49.99 } })).toBe('Dolphin');
    expect(getPlayerSegment({ iap: { totalSpentUSD: 75 } })).toBe('Dolphin');
    expect(getPlayerSegment({ iap: { totalSpentUSD: 99.99 } })).toBe('Dolphin');
  });

  it('returns Whale for $100+', () => {
    expect(getPlayerSegment({ iap: { totalSpentUSD: 100 } })).toBe('Whale');
    expect(getPlayerSegment({ iap: { totalSpentUSD: 199.99 } })).toBe('Whale');
    expect(getPlayerSegment({ iap: { totalSpentUSD: 1000 } })).toBe('Whale');
    expect(getPlayerSegment({ iap: { totalSpentUSD: 10000 } })).toBe('Whale');
  });

  it('boundary values are SACRED — locked byte-perfect to CLAUDE.md §9', () => {
    // F2P → Minnow at >0
    expect(getPlayerSegment({ iap: { totalSpentUSD: 0 } })).toBe('F2P');
    expect(getPlayerSegment({ iap: { totalSpentUSD: 0.01 } })).toBe('Minnow');
    // Minnow → Dolphin at 25
    expect(getPlayerSegment({ iap: { totalSpentUSD: 24.99 } })).toBe('Minnow');
    expect(getPlayerSegment({ iap: { totalSpentUSD: 25 } })).toBe('Dolphin');
    // Dolphin → Whale at 100
    expect(getPlayerSegment({ iap: { totalSpentUSD: 99.99 } })).toBe('Dolphin');
    expect(getPlayerSegment({ iap: { totalSpentUSD: 100 } })).toBe('Whale');
  });
});

describe('logEvent enrichment (T1.20)', () => {
  it('setSegmentState accepts the canonical state shape', () => {
    // Pure exercise — no return value, no throw allowed.
    expect(() => setSegmentState({ iap: { totalSpentUSD: 50 } })).not.toThrow();
    expect(() => setSegmentState(null)).not.toThrow();
    expect(() => setSegmentState(undefined)).not.toThrow();
    expect(() => setSegmentState('not-an-object')).not.toThrow();
  });

  it('logEvent is callable without state context (boot-before-init safety)', () => {
    // logEvent must never throw — analytics must not break gameplay.
    // No assertion on segment here; we only verify no throw when state is
    // unset and the firebase / sentry sinks are absent in the vitest env.
    setSegmentState(null);
    expect(() => logEvent('test_event', { foo: 'bar' })).not.toThrow();
    expect(() => logEvent('test_event')).not.toThrow();
    expect(() => logEvent('')).not.toThrow();
    expect(() => logEvent(null)).not.toThrow();
  });

  it('logEvent does not throw when segment state is set (no firebase / sentry)', () => {
    setSegmentState({ iap: { totalSpentUSD: 50 } });  // Dolphin
    expect(() => logEvent('purchase_completed', { sku: 'gems_999' })).not.toThrow();
    setSegmentState({ iap: { totalSpentUSD: 150 } }); // Whale
    expect(() => logEvent('purchase_completed', { sku: 'gems_9999' })).not.toThrow();
    setSegmentState({ iap: { totalSpentUSD: 0 } });   // F2P
    expect(() => logEvent('session_start')).not.toThrow();
  });
});
