// 2026-05-13 — TASK-059 (T3.15): Tower seasonal UI unit tests.
//
// Spec: docs/design/endgame-social.md §6 (Tower seasonal infrastructure)
//       + §6.1 (Uroboros variant rotation banner)
//       + §6.2 (Seasonal pacts list — additive surface)
//       + §6.3 (PURE PATH F2P-only leaderboard reset hint)
//       + §6.4 (Battle Pass tier widget — sacred §2.4 formula READ-only).
//
// Coverage strategy: Vitest runs in `node` env. We hand-roll the minimal
// localStorage + DOM shim (mirrors party-tower-ui.test.js + codex.test.js)
// so the UI render functions exercise their full path without a real
// browser.
//
// Surface tested:
//   - formatSeasonCountdown        — pure; severity bands; expired path
//   - computeBattlePassDisplayState — sacred §2.4 formula READ-only;
//                                      tier compute; progress %; rewards
//   - resolveBattlePassXpEarned    — localStorage roundtrip
//   - renderHeroBlock              — banner + Uroboros variant card
//   - renderSeasonalPactsPanel     — empty / populated; rarity classes
//   - renderBattlePassWidget       — tier label; bar fill; next reward
//   - renderLeaderboardHint        — PURE PATH F2P-only copy preserved
//   - __towerSeasonTestables       — reset isolation + CSS color sanitizer
//   - Sacred audit                 — formula byte-perfect; PURE PATH copy

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  renderHeroBlock,
  renderSeasonalPactsPanel,
  renderBattlePassWidget,
  renderLeaderboardHint,
  computeBattlePassDisplayState,
  formatSeasonCountdown,
  resolveBattlePassXpEarned,
  __towerSeasonTestables,
} from '../../src/ui/tower-season.js';
import {
  BATTLE_PASS_BASE_XP,
  BATTLE_PASS_PER_TIER_XP,
  BATTLE_PASS_MAX_TIER,
  UROBOROS_VARIANTS,
  SEASONAL_PACTS,
  TOWER_SEASON_WEEKS,
  computeBattlePassTotalXpForTier,
  _resetMockSeasonState,
} from '../../src/services/tower-season-backend.js';

// ─── Minimal in-memory localStorage shim ────────────────────────────
function createMockLocalStorage() {
  const store = Object.create(null);
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
    clear() { for (const k of Object.keys(store)) delete store[k]; },
  };
}

// ─── Minimal DOM shim — element factory + by-id selector ─────────────
function createElement(tag) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [],
    _listeners: {},
    _attrs: {},
    _id: '',
    _innerHTML: '',
    _value: '',
    parentNode: null,
    style: {},
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); },
      toggle(c, force) {
        if (force === true) this._set.add(c);
        else if (force === false) this._set.delete(c);
        else if (this._set.has(c)) this._set.delete(c);
        else this._set.add(c);
      },
    },
    get id() { return this._id; },
    set id(v) { this._id = String(v); },
    get textContent() { return this._textContent || ''; },
    set textContent(v) { this._textContent = String(v); this._innerHTML = String(v); },
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) { this._innerHTML = String(v); this.children = []; },
    get value() { return this._value; },
    set value(v) { this._value = String(v); },
    appendChild(child) {
      if (child) { child.parentNode = this; this.children.push(child); }
      return child;
    },
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx >= 0) { this.children.splice(idx, 1); if (child) child.parentNode = null; }
      return child;
    },
    setAttribute(k, v) { this._attrs[k] = String(v); if (k === 'id') this._id = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; },
    addEventListener(ev, fn) {
      if (!this._listeners[ev]) this._listeners[ev] = [];
      this._listeners[ev].push(fn);
    },
    querySelector(sel) { return _querySelector(this, sel); },
    querySelectorAll() { return []; },
    closest() { return null; },
  };
  return el;
}

function _querySelector(root, sel) {
  if (typeof sel !== 'string' || !sel.startsWith('#')) return null;
  const id = sel.slice(1);
  const stack = [...(root.children || [])];
  while (stack.length > 0) {
    const node = stack.shift();
    if (!node) continue;
    if (node._id === id) return node;
    if (Array.isArray(node.children)) {
      for (const c of node.children) stack.push(c);
    }
  }
  return null;
}

// ─── Test lifecycle ──────────────────────────────────────────────────
let _originalLocalStorage;
let _originalDocument;

beforeEach(() => {
  _originalLocalStorage = globalThis.localStorage;
  _originalDocument = globalThis.document;
  globalThis.localStorage = createMockLocalStorage();
  globalThis.document = { createElement, getElementById() { return null; } };
  __towerSeasonTestables.reset();
  _resetMockSeasonState();
});

afterEach(() => {
  if (_originalLocalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = _originalLocalStorage;
  if (_originalDocument === undefined) delete globalThis.document;
  else globalThis.document = _originalDocument;
  __towerSeasonTestables.reset();
  _resetMockSeasonState();
});

// ═══════════════════════════════════════════════════════════════════════
// formatSeasonCountdown
// ═══════════════════════════════════════════════════════════════════════

describe('formatSeasonCountdown (T3.15)', () => {
  it('returns "—" / safe for invalid deadline', () => {
    expect(formatSeasonCountdown(0).text).toBe('—');
    expect(formatSeasonCountdown(NaN).text).toBe('—');
    expect(formatSeasonCountdown(undefined).text).toBe('—');
  });

  it('returns "Season ended" / severity expired when past deadline', () => {
    const cd = formatSeasonCountdown(1000, 99999);
    expect(cd.severity).toBe('expired');
    expect(cd.text).toBe('Season ended');
  });

  it('produces "Xd Yh" format for >1 day', () => {
    const now = 1_000_000_000_000;
    // 5d 6h
    const cd = formatSeasonCountdown(now + 5 * 86400_000 + 6 * 3600_000, now);
    expect(cd.text).toBe('5d 6h');
  });

  it('produces "Xh Ym" format for <1 day', () => {
    const now = 1_000_000_000_000;
    // 5h 30m
    const cd = formatSeasonCountdown(now + 5 * 3600_000 + 30 * 60_000, now);
    expect(cd.text).toBe('5h 30m');
  });

  it('classifies severity across thresholds (1d / 3d boundaries)', () => {
    const now = 1_000_000_000_000;
    // Safe band: >3d
    expect(formatSeasonCountdown(now + 5 * 86400_000, now).severity).toBe('safe');
    // Warn band: <3d, >=1d
    expect(formatSeasonCountdown(now + 2 * 86400_000, now).severity).toBe('warn');
    // Danger band: <1d
    expect(formatSeasonCountdown(now + 6 * 3600_000, now).severity).toBe('danger');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// computeBattlePassDisplayState — SACRED §2.4 formula READ-only
// ═══════════════════════════════════════════════════════════════════════

describe('computeBattlePassDisplayState (T3.15) — sacred §2.4 formula READ-only', () => {
  it('xp=0 → tier 1, progress 0%, next reward at Tier 5', () => {
    const s = computeBattlePassDisplayState(0);
    expect(s.currentTier).toBe(1);
    expect(s.xpIntoCurrent).toBe(0);
    expect(s.xpForNextTier).toBe(BATTLE_PASS_BASE_XP); // 500
    expect(s.progressPct).toBe(0);
    expect(s.nextRewardTier).toBe(5);
    expect(typeof s.nextRewardLabel).toBe('string');
    expect(s.isMaxed).toBe(false);
  });

  it('xp=250 → tier 1, progress 50% (250 / 500)', () => {
    const s = computeBattlePassDisplayState(250);
    expect(s.currentTier).toBe(1);
    expect(s.xpIntoCurrent).toBe(250);
    expect(s.progressPct).toBe(50);
  });

  it('xp=500 → tier 2 (cum tier1 reached), next-tier xpForNextTier=650', () => {
    // Sacred formula: tier2 needs 500 + (2-1)*150 = 650 XP
    const s = computeBattlePassDisplayState(500);
    expect(s.currentTier).toBe(2);
    expect(s.xpForNextTier).toBe(BATTLE_PASS_BASE_XP + BATTLE_PASS_PER_TIER_XP); // 650
  });

  it('xp at tier-50 cumulative threshold → isMaxed === true', () => {
    const totalForMax = computeBattlePassTotalXpForTier(BATTLE_PASS_MAX_TIER);
    expect(totalForMax).toBe(208750); // sacred cumulative sum
    const s = computeBattlePassDisplayState(totalForMax);
    expect(s.currentTier).toBe(BATTLE_PASS_MAX_TIER);
    expect(s.isMaxed).toBe(true);
    expect(s.progressPct).toBe(100);
    expect(s.nextRewardTier).toBe(null);
  });

  it('rejects negative / NaN / non-number xp → zeroed state', () => {
    expect(computeBattlePassDisplayState(-100).currentTier).toBe(1);
    expect(computeBattlePassDisplayState(NaN).currentTier).toBe(1);
    expect(computeBattlePassDisplayState('asdf').currentTier).toBe(1);
    expect(computeBattlePassDisplayState(null).currentTier).toBe(1);
  });

  it('next cosmetic reward tier always > currentTier when not maxed', () => {
    // Cross-check the reward-tier ladder honors §6.4 cosmetic schedule.
    const samples = [0, 500, 1150, 5000, 30000];
    for (const xp of samples) {
      const s = computeBattlePassDisplayState(xp);
      if (!s.isMaxed) {
        expect(s.nextRewardTier).toBeGreaterThan(s.currentTier);
      }
    }
  });

  it('sacred §2.4 invariant — derived tier matches manual cumulative walk', () => {
    // Build cumulative XP for tier 10, expect tier 10 boundary == tier 11.
    let cum = 0;
    for (let n = 1; n <= 10; n++) cum += BATTLE_PASS_BASE_XP + (n - 1) * BATTLE_PASS_PER_TIER_XP;
    // cum = 11750 (sum_{k=1..10}(500 + (k-1)*150))
    const s = computeBattlePassDisplayState(cum);
    expect(s.currentTier).toBe(11);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// resolveBattlePassXpEarned
// ═══════════════════════════════════════════════════════════════════════

describe('resolveBattlePassXpEarned (T3.15)', () => {
  it('returns 0 when no XP saved', () => {
    expect(resolveBattlePassXpEarned()).toBe(0);
  });

  it('returns parsed int when localStorage key set', () => {
    globalThis.localStorage.setItem(__towerSeasonTestables.LS_BP_XP_KEY, '1234');
    expect(resolveBattlePassXpEarned()).toBe(1234);
  });

  it('returns 0 when XP value is malformed', () => {
    globalThis.localStorage.setItem(__towerSeasonTestables.LS_BP_XP_KEY, 'gibberish');
    expect(resolveBattlePassXpEarned()).toBe(0);
  });

  it('returns 0 for negative values (clamped)', () => {
    globalThis.localStorage.setItem(__towerSeasonTestables.LS_BP_XP_KEY, '-99');
    expect(resolveBattlePassXpEarned()).toBe(0);
  });

  it('does not throw when localStorage is undefined', () => {
    delete globalThis.localStorage;
    expect(() => resolveBattlePassXpEarned()).not.toThrow();
    expect(resolveBattlePassXpEarned()).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// renderHeroBlock
// ═══════════════════════════════════════════════════════════════════════

describe('renderHeroBlock (T3.15)', () => {
  it('renders season banner + Uroboros variant card', () => {
    const root = createElement('div');
    const variant = UROBOROS_VARIANTS[0];
    renderHeroBlock(root, {
      seasonId: 1,
      weekIndex: 3,
      uroborosVariant: variant,
      deadlineMs: Date.now() + 5 * 86400_000,
    });
    expect(root.innerHTML).toContain('Season 1');
    expect(root.innerHTML).toContain(`Week 3 of ${TOWER_SEASON_WEEKS}`);
    expect(root.innerHTML).toContain('Cosmic Eye'); // variant displayName
    expect(root.innerHTML).toContain('tsCountdown');
  });

  it('honors variant auraColor as sanitized inline style', () => {
    const root = createElement('div');
    const variant = UROBOROS_VARIANTS[1]; // Eternal Loop — gold #FFD700
    renderHeroBlock(root, {
      seasonId: 2,
      weekIndex: 1,
      uroborosVariant: variant,
      deadlineMs: Date.now() + 10 * 86400_000,
    });
    expect(root.innerHTML).toContain('Eternal Loop');
    expect(root.innerHTML).toContain('#FFD700');
  });

  it('falls back to default variant when uroborosVariant missing', () => {
    const root = createElement('div');
    renderHeroBlock(root, {
      seasonId: 1,
      weekIndex: 1,
      deadlineMs: Date.now() + 86400_000,
    });
    expect(root.innerHTML).toContain('Cosmic Eye'); // index 0 default
  });

  it('clamps weekIndex above TOWER_SEASON_WEEKS', () => {
    const root = createElement('div');
    renderHeroBlock(root, {
      seasonId: 1,
      weekIndex: 999,
      uroborosVariant: UROBOROS_VARIANTS[0],
      deadlineMs: Date.now() + 86400_000,
    });
    expect(root.innerHTML).toContain(`Week ${TOWER_SEASON_WEEKS} of ${TOWER_SEASON_WEEKS}`);
  });

  it('defensive: renders without crashing on null viewState', () => {
    const root = createElement('div');
    expect(() => renderHeroBlock(root, null)).not.toThrow();
    expect(root.innerHTML).toContain('Season');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// renderSeasonalPactsPanel
// ═══════════════════════════════════════════════════════════════════════

describe('renderSeasonalPactsPanel (T3.15)', () => {
  it('empty state shows "No seasonal pacts active"', () => {
    const root = createElement('div');
    renderSeasonalPactsPanel(root, []);
    expect(root.innerHTML).toContain('No seasonal pacts active');
    expect(root.innerHTML).toContain('Seasonal Pacts');
  });

  it('populated state renders pact name + description + rarity pill', () => {
    const root = createElement('div');
    const defs = Object.entries(SEASONAL_PACTS).slice(0, 3).map(([id, def]) => ({ id, def }));
    renderSeasonalPactsPanel(root, defs);
    expect(root.innerHTML).toContain('COSMIC CLARITY');
    expect(root.innerHTML).toContain('ETERNAL RECALL');
    expect(root.innerHTML).toContain('SERPENT BLESSING');
    expect(root.innerHTML).toContain('ts-pact-rarity--rare');
    expect(root.innerHTML).toContain('ts-pact-rarity--epic');
    // Description surface
    expect(root.innerHTML).toContain('extra candidate');
  });

  it('filters out malformed entries (missing def)', () => {
    const root = createElement('div');
    const defs = [
      { id: 'good', def: SEASONAL_PACTS.s1_cosmic_clarity },
      { id: 'broken', def: null },
      null,
    ];
    expect(() => renderSeasonalPactsPanel(root, defs)).not.toThrow();
    expect(root.innerHTML).toContain('COSMIC CLARITY');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// renderBattlePassWidget
// ═══════════════════════════════════════════════════════════════════════

describe('renderBattlePassWidget (T3.15)', () => {
  it('renders Tier 1 / max-tier denominator + 0% fill at xp=0', () => {
    const root = createElement('div');
    renderBattlePassWidget(root, { xpEarned: 0 });
    expect(root.innerHTML).toContain('Battle Pass');
    expect(root.innerHTML).toContain('Current tier');
    expect(root.innerHTML).toContain('1 <span class="ts-bp-tier-max">/ 50</span>');
    expect(root.innerHTML).toContain('width: 0%');
    expect(root.innerHTML).toContain('500 XP'); // sacred tier1 base
  });

  it('renders next reward label hint at low tiers (Tier 5)', () => {
    const root = createElement('div');
    renderBattlePassWidget(root, { xpEarned: 0 });
    expect(root.innerHTML).toContain('Tier 5');
    expect(root.innerHTML).toContain('clan emblem');
  });

  it('maxed state surfaces "All tiers earned" + bar fill --max', () => {
    const root = createElement('div');
    const fully = computeBattlePassTotalXpForTier(BATTLE_PASS_MAX_TIER);
    renderBattlePassWidget(root, { xpEarned: fully });
    expect(root.innerHTML).toContain('All tiers earned');
    expect(root.innerHTML).toContain('ts-bp-bar-fill--max');
    expect(root.innerHTML).toContain('All seasonal cosmetic rewards earned');
  });

  it('sacred §2.4 formula NEVER hardcoded — uses computed xpForNextTier', () => {
    const root = createElement('div');
    // 500 XP → tier 2 → xpForNextTier = 650 (per sacred formula)
    renderBattlePassWidget(root, { xpEarned: 500 });
    expect(root.innerHTML).toContain('0 / 650 XP');
    expect(root.innerHTML).toContain('XP to tier 3');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// renderLeaderboardHint
// ═══════════════════════════════════════════════════════════════════════

describe('renderLeaderboardHint (T3.15) — sacred §2.5 PURE PATH invariant', () => {
  it('renders reset copy with season id', () => {
    const root = createElement('div');
    renderLeaderboardHint(root, {
      seasonId: 2,
      deadlineMs: Date.now() + 5 * 86400_000,
    });
    expect(root.innerHTML).toContain('Season 2');
    expect(root.innerHTML).toContain('Weekly seasonal ranks reset');
  });

  it('renders PURE PATH F2P-only invariant copy', () => {
    const root = createElement('div');
    renderLeaderboardHint(root, { seasonId: 1, deadlineMs: 0 });
    expect(root.innerHTML).toContain('PURE PATH');
    expect(root.innerHTML).toContain('F2P-only');
    expect(root.innerHTML).toContain('never wiped');
  });

  it('defensive: renders without crashing on missing viewState', () => {
    const root = createElement('div');
    expect(() => renderLeaderboardHint(root, null)).not.toThrow();
    expect(root.innerHTML).toContain('PURE PATH');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// __towerSeasonTestables
// ═══════════════════════════════════════════════════════════════════════

describe('__towerSeasonTestables (T3.15)', () => {
  it('exposes reward ladder honoring §6.4 cosmetic schedule', () => {
    const ladder = __towerSeasonTestables.BATTLE_PASS_REWARD_TIERS;
    expect(ladder).toContain(5);
    expect(ladder).toContain(10);
    expect(ladder).toContain(20);
    expect(ladder).toContain(35);
    expect(ladder).toContain(50);
  });

  it('reward table entries declare cosmetic-only (ADR-003)', () => {
    const t = __towerSeasonTestables.BATTLE_PASS_TIER_REWARDS;
    for (const tier of [5, 10, 20, 35, 50]) {
      expect(t[tier]).toBeDefined();
      expect(t[tier].cosmetic).toBe(true);
    }
  });

  it('cssEscapeColor sanitizes invalid input to default gold', () => {
    expect(__towerSeasonTestables.cssEscapeColor('javascript:alert(1)')).toBe('#A88033');
    expect(__towerSeasonTestables.cssEscapeColor('red;background:url(evil)')).toBe('#A88033');
    expect(__towerSeasonTestables.cssEscapeColor('#FF00AA')).toBe('#FF00AA');
    expect(__towerSeasonTestables.cssEscapeColor('#fff')).toBe('#fff');
  });

  it('computeSeasonEndDeadline returns 0 for pre-launch / invalid state', () => {
    expect(__towerSeasonTestables.computeSeasonEndDeadline(null)).toBe(0);
    expect(__towerSeasonTestables.computeSeasonEndDeadline({ seasonStartMs: 0 })).toBe(0);
  });

  it('reset() clears module state to defaults', () => {
    __towerSeasonTestables.setRoot({ tag: 'pretend' });
    expect(__towerSeasonTestables.getState().hasRoot).toBe(true);
    __towerSeasonTestables.reset();
    expect(__towerSeasonTestables.getState().hasRoot).toBe(false);
    expect(__towerSeasonTestables.getState().activeViewState).toBe(null);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Sacred-audit invariants
// ═══════════════════════════════════════════════════════════════════════

describe('Sacred audit (T3.15) — formula + PURE PATH', () => {
  it('§2.4: BATTLE_PASS_BASE_XP === 500 and PER_TIER_XP === 150 (re-exported)', () => {
    expect(BATTLE_PASS_BASE_XP).toBe(500);
    expect(BATTLE_PASS_PER_TIER_XP).toBe(150);
    expect(BATTLE_PASS_MAX_TIER).toBe(50);
  });

  it('§2.5 PURE PATH: leaderboard hint mentions F2P-only separate column', () => {
    const root = createElement('div');
    renderLeaderboardHint(root, { seasonId: 1, deadlineMs: 0 });
    expect(root.innerHTML).toMatch(/PURE PATH.*F2P-only.*separate column/i);
  });

  it('ADR-003: no paid-tier shortcuts surfaced in BP widget', () => {
    const root = createElement('div');
    renderBattlePassWidget(root, { xpEarned: 0 });
    expect(root.innerHTML.toLowerCase()).not.toContain('whale');
    expect(root.innerHTML.toLowerCase()).not.toContain('premium');
    expect(root.innerHTML.toLowerCase()).not.toContain('paid');
    expect(root.innerHTML.toLowerCase()).not.toContain('upgrade');
    expect(root.innerHTML.toLowerCase()).not.toContain('buy');
  });
});
