// 2026-05-13 — TASK-062 (T4.08): PURE PATH CHAIN leaderboard unit tests.
//
// Sacred-cow verification at every assertion:
//   - TOWER_LEADERBOARDS sacred 3 entries BYTE-PERFECT (CLAUDE.md §2.5)
//   - Object.isFrozen(TOWER_LEADERBOARDS) === true
//   - Phase 4 f2p_walleted entry is purely ADDITIVE; does not mutate sacred 3
//   - ADR-003 anti-P2W invariant: PURE PATH F2P (`totalSpent === 0`) criterion
//     preserved verbatim in PURE PATH CHAIN eligibility

import { describe, it, expect } from 'vitest';
import {
  TOWER_LEADERBOARDS,
  PURE_PATH_CHAIN_NFT_WINDOW_DAYS,
  PURE_PATH_CHAIN_NFT_WINDOW_MS,
  isPurePathChainEligible,
} from '../../src/data/tower.js';

describe('T4.08 — TOWER_LEADERBOARDS sacred 3 entries byte-perfect', () => {
  it('global GLOBAL CHAMPIONS entry sacred', () => {
    expect(TOWER_LEADERBOARDS.global).toEqual({
      name:        'GLOBAL CHAMPIONS',
      description: 'All players combined',
      eligibility: 'all',
    });
    expect(Object.isFrozen(TOWER_LEADERBOARDS.global)).toBe(true);
  });

  it('f2p_only PURE PATH entry sacred', () => {
    expect(TOWER_LEADERBOARDS.f2p_only).toEqual({
      name:            'PURE PATH',
      description:     'Players with zero real money spent',
      eligibility:     'totalSpent === 0',
    });
    expect(Object.isFrozen(TOWER_LEADERBOARDS.f2p_only)).toBe(true);
  });

  it('weekly_seasonal CURRENT SEASON entry sacred', () => {
    expect(TOWER_LEADERBOARDS.weekly_seasonal).toEqual({
      name:               'CURRENT SEASON',
      description:        'Resets each season',
      eligibility:        'all',
      resetOnSeasonEnd:   true,
    });
    expect(Object.isFrozen(TOWER_LEADERBOARDS.weekly_seasonal)).toBe(true);
  });

  it('TOWER_LEADERBOARDS itself is frozen', () => {
    expect(Object.isFrozen(TOWER_LEADERBOARDS)).toBe(true);
  });

  it('mutation attempts on sacred entries throw or no-op (strict mode)', () => {
    // In strict-mode ESM modules, mutation of frozen objects throws TypeError.
    // We accept either behavior (throw OR silent no-op) — invariant is that the value
    // remains unchanged after the attempted mutation.
    const beforeGlobal = TOWER_LEADERBOARDS.global.name;
    try { TOWER_LEADERBOARDS.global.name = 'HACKED'; } catch (_e) { /* expected */ }
    expect(TOWER_LEADERBOARDS.global.name).toBe(beforeGlobal);

    const beforeF2P = TOWER_LEADERBOARDS.f2p_only.eligibility;
    try { TOWER_LEADERBOARDS.f2p_only.eligibility = 'totalSpent > 0'; } catch (_e) { /* expected */ }
    expect(TOWER_LEADERBOARDS.f2p_only.eligibility).toBe(beforeF2P);
  });
});

describe('T4.08 — PURE PATH CHAIN (f2p_walleted) additive entry', () => {
  it('f2p_walleted entry exists', () => {
    expect(TOWER_LEADERBOARDS.f2p_walleted).toBeDefined();
  });

  it('f2p_walleted is frozen', () => {
    expect(Object.isFrozen(TOWER_LEADERBOARDS.f2p_walleted)).toBe(true);
  });

  it('f2p_walleted has expected metadata', () => {
    const e = TOWER_LEADERBOARDS.f2p_walleted;
    expect(e.name).toBe('PURE PATH CHAIN');
    expect(e.eligibility).toContain('totalSpent === 0');
    expect(e.eligibility).toContain('walletConnected');
    expect(e.eligibility).toContain('walletHasMintedNftInLast90Days');
    expect(e.requiresChiaEnabled).toBe(true);
    expect(e.phase).toBe(4);
    expect(e.addedIn).toBe('T4.08');
  });

  it('f2p_walleted PRESERVES the sacred PURE PATH F2P criterion', () => {
    // ADR-003 anti-P2W invariant: the `totalSpent === 0` substring of the
    // sacred PURE PATH eligibility MUST appear verbatim in CHAIN eligibility.
    expect(TOWER_LEADERBOARDS.f2p_walleted.eligibility).toContain(TOWER_LEADERBOARDS.f2p_only.eligibility);
  });

  it('exactly 4 keys present (sacred 3 + 1 Phase 4 additive)', () => {
    const keys = Object.keys(TOWER_LEADERBOARDS).sort();
    expect(keys).toEqual(['f2p_only', 'f2p_walleted', 'global', 'weekly_seasonal']);
  });
});

describe('T4.08 — PURE_PATH_CHAIN_NFT_WINDOW constants', () => {
  it('default window is 90 days (per design spec §6.2 + ESC-04 Q5)', () => {
    expect(PURE_PATH_CHAIN_NFT_WINDOW_DAYS).toBe(90);
  });

  it('window ms is derived correctly', () => {
    expect(PURE_PATH_CHAIN_NFT_WINDOW_MS).toBe(90 * 24 * 60 * 60 * 1000);
  });
});

describe('T4.08 — isPurePathChainEligible() pure helper', () => {
  const NOW = 1_700_000_000_000; // arbitrary epoch ms

  it('null / undefined player → false', () => {
    expect(isPurePathChainEligible(null, NOW)).toBe(false);
    expect(isPurePathChainEligible(undefined, NOW)).toBe(false);
  });

  it('non-object player → false', () => {
    expect(isPurePathChainEligible('player', NOW)).toBe(false);
    expect(isPurePathChainEligible(42, NOW)).toBe(false);
    expect(isPurePathChainEligible([], NOW)).toBe(false);
  });

  it('totalSpent > 0 → false (sacred PURE PATH F2P criterion enforced)', () => {
    expect(isPurePathChainEligible({
      totalSpent: 0.99,
      walletConnected: true,
      lastNftMintAt: NOW - 1000,
    }, NOW)).toBe(false);
  });

  it('totalSpent === 0 + walletConnected===false → false', () => {
    expect(isPurePathChainEligible({
      totalSpent: 0,
      walletConnected: false,
      lastNftMintAt: NOW - 1000,
    }, NOW)).toBe(false);
  });

  it('totalSpent === 0 + walletConnected===true + no NFT → false', () => {
    expect(isPurePathChainEligible({
      totalSpent: 0,
      walletConnected: true,
      lastNftMintAt: 0,
    }, NOW)).toBe(false);
  });

  it('totalSpent === 0 + walletConnected===true + NFT minted < 90 days ago → TRUE', () => {
    expect(isPurePathChainEligible({
      totalSpent: 0,
      walletConnected: true,
      lastNftMintAt: NOW - (89 * 24 * 60 * 60 * 1000),
    }, NOW)).toBe(true);
  });

  it('NFT minted >90 days ago → false (active-participant filter)', () => {
    expect(isPurePathChainEligible({
      totalSpent: 0,
      walletConnected: true,
      lastNftMintAt: NOW - (91 * 24 * 60 * 60 * 1000),
    }, NOW)).toBe(false);
  });

  it('NFT minted exactly 90 days ago → TRUE (inclusive boundary)', () => {
    expect(isPurePathChainEligible({
      totalSpent: 0,
      walletConnected: true,
      lastNftMintAt: NOW - PURE_PATH_CHAIN_NFT_WINDOW_MS,
    }, NOW)).toBe(true);
  });

  it('defaults nowMs to Date.now() when not provided', () => {
    // Use far-past mint timestamp + omit nowMs → must be false
    const r = isPurePathChainEligible({
      totalSpent: 0,
      walletConnected: true,
      lastNftMintAt: 1000, // year 1970+
    });
    expect(r).toBe(false);
  });

  it('returns flat boolean (never throws — defensive)', () => {
    expect(typeof isPurePathChainEligible({}, NOW)).toBe('boolean');
    expect(typeof isPurePathChainEligible({ totalSpent: 'spent' }, NOW)).toBe('boolean');
    expect(typeof isPurePathChainEligible({ totalSpent: 0, walletConnected: 1, lastNftMintAt: '0' }, NOW)).toBe('boolean');
  });
});

describe('T4.08 — sacred-cow byte-perfect invariant (CLAUDE.md §2.5)', () => {
  it('sacred 3 entries reference exact spec strings', () => {
    // Lifted verbatim from CLAUDE.md §2.5 + sacred src/data/tower.js block at line 88
    expect(TOWER_LEADERBOARDS.global.name).toBe('GLOBAL CHAMPIONS');
    expect(TOWER_LEADERBOARDS.f2p_only.name).toBe('PURE PATH');
    expect(TOWER_LEADERBOARDS.weekly_seasonal.name).toBe('CURRENT SEASON');
  });

  it('f2p_only.eligibility string is EXACTLY "totalSpent === 0"', () => {
    // Sacred PURE PATH F2P invariant. ANY deviation = sacred-cow violation.
    expect(TOWER_LEADERBOARDS.f2p_only.eligibility).toBe('totalSpent === 0');
  });

  it('weekly_seasonal.resetOnSeasonEnd === true (sacred behavior)', () => {
    expect(TOWER_LEADERBOARDS.weekly_seasonal.resetOnSeasonEnd).toBe(true);
  });
});
