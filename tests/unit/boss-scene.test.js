// 2026-05-16 — TASK-CP-001 regression tests
//
// Locks the contract for Combat Polish Tier-1 boss scene module.
//
// Coverage strategy (per project convention — see adventures-ui.test.js
// header): Vitest runs in `node` env. DOM-state assertions belong to
// Playwright smoke tests (visual regression baseline + JS-readable class
// integrity). This file covers:
//   1. ELEMENT_ASSETS aligns with sacred STIHIYAS
//   2. Asset bundle is frozen (immutable per CLAUDE.md §2)
//   3. Asset path bundling convention (public/assets/backgrounds/ etc)
//   4. resolveBossElement defensively falls back to 'umbra'
//   5. preloadBackground rejects for invalid element
//   6. _formatHp matches plan §7.2 spec (M/K/raw thresholds)
//   7. mount() returns false for null rootEl (defensive guard)
//   8. destroy() / update() on unmounted scene are silent no-ops

import { describe, it, expect } from 'vitest';

import { STIHIYAS } from '../../src/data/elements.js';
import {
  ELEMENT_ASSETS,
  preloadBackground,
  resolveBossElement,
} from '../../src/feel/element-assets.js';
import {
  mountBossScene,
  updateBossScene,
  destroyBossScene,
  _testables,
} from '../../src/feel/boss-scene.js';

describe('TASK-CP-001 — ELEMENT_ASSETS contract', () => {
  it('contains all 5 STIHIYAS exactly (sacred parity)', () => {
    for (const elem of STIHIYAS) {
      expect(ELEMENT_ASSETS[elem]).toBeDefined();
      expect(typeof ELEMENT_ASSETS[elem].bg).toBe('string');
      expect(typeof ELEMENT_ASSETS[elem].emblem).toBe('string');
      expect(typeof ELEMENT_ASSETS[elem].ambient).toBe('string');
    }
    expect(Object.keys(ELEMENT_ASSETS).sort()).toEqual([...STIHIYAS].sort());
  });

  it('is frozen at top-level + per-entry (immutable per CLAUDE.md §2)', () => {
    expect(Object.isFrozen(ELEMENT_ASSETS)).toBe(true);
    for (const elem of STIHIYAS) {
      expect(Object.isFrozen(ELEMENT_ASSETS[elem])).toBe(true);
    }
  });

  it('background paths point to public/assets/backgrounds/ (bundle convention)', () => {
    for (const elem of STIHIYAS) {
      expect(ELEMENT_ASSETS[elem].bg).toMatch(/^\/assets\/backgrounds\/[a-z]+_background\.png$/);
    }
  });

  it('emblem paths point to public/assets/icons/elements/ (bundle convention)', () => {
    for (const elem of STIHIYAS) {
      expect(ELEMENT_ASSETS[elem].emblem).toMatch(/^\/assets\/icons\/elements\/[a-z]+_emblem\.png$/);
    }
  });

  it('ambient keys correspond to documented animation classes', () => {
    const validAmbients = ['sparks', 'snowflakes', 'leaves', 'golden_motes', 'wisps'];
    for (const elem of STIHIYAS) {
      expect(validAmbients).toContain(ELEMENT_ASSETS[elem].ambient);
    }
  });

  it('element-specific theme mapping is correct (per plan §6.2)', () => {
    expect(ELEMENT_ASSETS.ember.ambient).toBe('sparks');
    expect(ELEMENT_ASSETS.tide.ambient).toBe('snowflakes');
    expect(ELEMENT_ASSETS.grove.ambient).toBe('leaves');
    expect(ELEMENT_ASSETS.solar.ambient).toBe('golden_motes');
    expect(ELEMENT_ASSETS.umbra.ambient).toBe('wisps');
  });
});

describe('TASK-CP-001 — resolveBossElement (defensive lookup)', () => {
  it('returns valid element when boss.element is a stihiya', () => {
    expect(resolveBossElement({ element: 'ember' })).toBe('ember');
    expect(resolveBossElement({ element: 'tide' })).toBe('tide');
    expect(resolveBossElement({ element: 'grove' })).toBe('grove');
    expect(resolveBossElement({ element: 'solar' })).toBe('solar');
    expect(resolveBossElement({ element: 'umbra' })).toBe('umbra');
  });

  it('falls back to umbra for missing / null / invalid boss', () => {
    expect(resolveBossElement(undefined)).toBe('umbra');
    expect(resolveBossElement(null)).toBe('umbra');
    expect(resolveBossElement({})).toBe('umbra');
    expect(resolveBossElement({ element: null })).toBe('umbra');
    expect(resolveBossElement({ element: 'invalid_stihiya' })).toBe('umbra');
    expect(resolveBossElement({ element: '' })).toBe('umbra');
  });
});

describe('TASK-CP-001 — preloadBackground', () => {
  it('rejects for unknown element', async () => {
    await expect(preloadBackground('invalid')).rejects.toThrow(/unknown element/);
  });

  // Note: actual image-load test against real PNG files is left to e2e /
  // Playwright smoke — node env does not provide window.Image decode.
});

describe('TASK-CP-001 — _formatHp (plan §7.2 M/K/raw)', () => {
  const { _formatHp } = _testables;

  it('formats million-range HP as N.NM', () => {
    expect(_formatHp(3_600_000)).toBe('3.6M');
    expect(_formatHp(1_000_000)).toBe('1.0M');
  });

  it('formats thousand-range HP as N.NK (Ch1 → Ch5 boss range per combat-mechanics §16)', () => {
    expect(_formatHp(7_200)).toBe('7.2K');       // Ch1 tutorial boss (30 dps × 240s)
    expect(_formatHp(1_000)).toBe('1.0K');
    expect(_formatHp(248_400)).toBe('248.4K');   // Ch5 chapter-finale boss (460 × 540)
  });

  it('formats sub-thousand HP as integer (player MAX_HP=100 sacred range)', () => {
    expect(_formatHp(999)).toBe('999');
    expect(_formatHp(100)).toBe('100');
    expect(_formatHp(50)).toBe('50');
    expect(_formatHp(0)).toBe('0');
  });

  it('handles edge: exactly 1000 / 1000000 thresholds', () => {
    expect(_formatHp(1_000)).toBe('1.0K');         // K threshold inclusive
    expect(_formatHp(999_999)).toBe('1000.0K');    // just-under-M still K
    expect(_formatHp(1_000_000)).toBe('1.0M');     // M threshold inclusive
  });
});

describe('TASK-CP-001 — boss scene defensive guards', () => {
  it('mount returns false for null/undefined rootEl', () => {
    expect(mountBossScene(null)).toBe(false);
    expect(mountBossScene(undefined)).toBe(false);
  });

  it('update is silent no-op when no scene mounted', () => {
    // Ensure clean state — destroy idempotent
    destroyBossScene();
    expect(() => updateBossScene({ element: 'ember', hp: 100, hpMax: 100 })).not.toThrow();
  });

  it('destroy is idempotent (safe to call when not mounted)', () => {
    destroyBossScene();
    expect(() => destroyBossScene()).not.toThrow();
    expect(() => destroyBossScene()).not.toThrow();
  });
});

describe('TASK-CP-001 — sacred-cow audit (compile-time parity)', () => {
  it('STIHIYAS import path verified (src/data/elements.js sacred source)', () => {
    expect(STIHIYAS).toContain('ember');
    expect(STIHIYAS).toContain('tide');
    expect(STIHIYAS).toContain('grove');
    expect(STIHIYAS).toContain('solar');
    expect(STIHIYAS).toContain('umbra');
    expect(STIHIYAS.length).toBe(5);
  });

  it('ELEMENT_ASSETS keys exactly = STIHIYAS (catches sacred drift)', () => {
    const assetKeys = Object.keys(ELEMENT_ASSETS).sort();
    const sacredKeys = [...STIHIYAS].sort();
    expect(assetKeys).toEqual(sacredKeys);
  });
});
