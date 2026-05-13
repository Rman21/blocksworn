// 2026-05-13 — TASK-063 (T4.08): PURE PATH CHAIN UI unit tests.
//
// Sacred-cow safety:
//   - The new 4th tab is purely additive — sacred 3-tab legacy modal untouched
//   - All renderer entry points gated by isChiaEnabled() (T4.09)
//   - F2P parity: when chia disabled, mount returns {ok:false, mode:'hidden'}

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PURE_PATH_CHAIN_TAB,
  getPurePathChainTabDefinition,
  getPurePathChainTabMode,
  renderPurePathChainTab,
  initPurePathChainTab,
} from '../../src/ui/tower-leaderboard-chain.js';
import { _setChiaEnabledForTest } from '../../src/services/feature-flags.js';

// Minimal JSDOM-style document stub so renderer DOM ops succeed in node test env.
// Vitest defaults to node — we only need a couple of element factories.
beforeEach(() => {
  if (typeof globalThis.document === 'undefined') {
    const _stub = {
      createElement(tag) {
        const el = {
          tagName: String(tag || 'div').toUpperCase(),
          className: '',
          textContent: '',
          innerHTML: '',
          children: [],
          dataset: {},
          appendChild(child) { this.children.push(child); return child; },
          replaceChildren() { this.children = []; this.innerHTML = ''; },
        };
        return el;
      },
    };
    globalThis.document = _stub;
  }
  _setChiaEnabledForTest(null);
});

afterEach(() => {
  _setChiaEnabledForTest(null);
});

describe('T4.08 UI — PURE_PATH_CHAIN_TAB sentinel', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(PURE_PATH_CHAIN_TAB)).toBe(true);
  });

  it('has expected shape', () => {
    expect(PURE_PATH_CHAIN_TAB.key).toBe('f2p_walleted');
    expect(PURE_PATH_CHAIN_TAB.label).toBe('PURE PATH CHAIN');
    expect(PURE_PATH_CHAIN_TAB.iconChar).toBe('⛓');
    expect(PURE_PATH_CHAIN_TAB.requiresChiaEnabled).toBe(true);
  });
});

describe('T4.08 UI — getPurePathChainTabDefinition', () => {
  it('returns null when chia disabled (mobile build parity)', () => {
    _setChiaEnabledForTest(false);
    expect(getPurePathChainTabDefinition()).toBeNull();
  });

  it('returns tab when chia enabled', () => {
    _setChiaEnabledForTest(true);
    const def = getPurePathChainTabDefinition();
    expect(def).not.toBeNull();
    expect(def.key).toBe('f2p_walleted');
  });
});

describe('T4.08 UI — getPurePathChainTabMode', () => {
  it('chia disabled → hidden (regardless of player state)', () => {
    _setChiaEnabledForTest(false);
    expect(getPurePathChainTabMode({ totalSpent: 0, walletConnected: true, lastNftMintAt: Date.now() })).toBe('hidden');
  });

  it('chia enabled + null player → browseable', () => {
    _setChiaEnabledForTest(true);
    expect(getPurePathChainTabMode(null)).toBe('browseable');
  });

  it('chia enabled + F2P + wallet-connected + recent NFT → active', () => {
    _setChiaEnabledForTest(true);
    const mode = getPurePathChainTabMode({
      totalSpent: 0,
      walletConnected: true,
      lastNftMintAt: Date.now() - 1000,
    });
    expect(mode).toBe('active');
  });

  it('paid player even with wallet+NFT → browseable (sacred PURE PATH F2P)', () => {
    _setChiaEnabledForTest(true);
    expect(getPurePathChainTabMode({
      totalSpent: 4.99,
      walletConnected: true,
      lastNftMintAt: Date.now(),
    })).toBe('browseable');
  });

  it('F2P + wallet-connected but NFT >90d ago → browseable', () => {
    _setChiaEnabledForTest(true);
    expect(getPurePathChainTabMode({
      totalSpent: 0,
      walletConnected: true,
      lastNftMintAt: Date.now() - (91 * 24 * 60 * 60 * 1000),
    })).toBe('browseable');
  });
});

describe('T4.08 UI — renderPurePathChainTab', () => {
  it('chia disabled → {ok:false, mode:hidden}', () => {
    _setChiaEnabledForTest(false);
    const r = renderPurePathChainTab(document.createElement('div'));
    expect(r.ok).toBe(false);
    expect(r.mode).toBe('hidden');
    expect(r.reason).toBe('chia-disabled');
  });

  it('null container → {ok:false, reason:invalid-container}', () => {
    _setChiaEnabledForTest(true);
    const r = renderPurePathChainTab(null);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-container');
  });

  it('chia enabled + valid container → {ok:true}', () => {
    _setChiaEnabledForTest(true);
    const container = document.createElement('div');
    const r = renderPurePathChainTab(container, {
      entries: [],
      player: { totalSpent: 0, walletConnected: false, lastNftMintAt: 0 },
      seasonLabel: 'Season 1 · Week 3 / 13',
    });
    expect(r.ok).toBe(true);
    expect(r.mode).toBe('browseable');
  });

  it('empty entries → renders placeholder (no broken empty state)', () => {
    _setChiaEnabledForTest(true);
    const container = document.createElement('div');
    renderPurePathChainTab(container, { entries: [] });
    // root mounted
    expect(container.children.length).toBe(1);
  });

  it('with entries → renders list', () => {
    _setChiaEnabledForTest(true);
    const container = document.createElement('div');
    renderPurePathChainTab(container, {
      entries: [
        { rank: 1, address: 'chia1abcdefghijklmnopqrstuvwxyz0123456', floor: 87 },
        { rank: 2, displayName: 'Solar-Phoenix', floor: 84 },
      ],
    });
    expect(container.children.length).toBe(1);
  });
});

describe('T4.08 UI — initPurePathChainTab', () => {
  it('chia disabled → {enabled:false, definition:null, mode:hidden}', () => {
    _setChiaEnabledForTest(false);
    const r = initPurePathChainTab({ totalSpent: 0 });
    expect(r.enabled).toBe(false);
    expect(r.definition).toBeNull();
    expect(r.mode).toBe('hidden');
  });

  it('chia enabled + null player → {enabled:true, mode:browseable}', () => {
    _setChiaEnabledForTest(true);
    const r = initPurePathChainTab(null);
    expect(r.enabled).toBe(true);
    expect(r.definition).not.toBeNull();
    expect(r.mode).toBe('browseable');
  });

  it('chia enabled + eligible F2P+wallet+NFT → {mode:active}', () => {
    _setChiaEnabledForTest(true);
    const r = initPurePathChainTab({
      totalSpent: 0,
      walletConnected: true,
      lastNftMintAt: Date.now() - 1000,
    });
    expect(r.mode).toBe('active');
  });
});

describe('T4.08 UI — sacred invariants', () => {
  it('renderer never throws on malformed entries', () => {
    _setChiaEnabledForTest(true);
    const container = document.createElement('div');
    expect(() => {
      renderPurePathChainTab(container, {
        entries: [null, undefined, 'not an object', 42, {}],
      });
    }).not.toThrow();
  });

  it('renderer returns boolean ok flag (defensive)', () => {
    _setChiaEnabledForTest(true);
    const r = renderPurePathChainTab(document.createElement('div'), {});
    expect(typeof r.ok).toBe('boolean');
  });
});
