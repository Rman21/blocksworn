// 2026-05-16 — TASK-CP-003 regression tests
//
// Locks the contract for Combat Polish Tier-1 top-HUD chip-row module.
//
// Coverage strategy (per project convention — see boss-scene.test.js +
// hero-card.test.js): Vitest runs in `node` env. DOM-state assertions
// belong to Playwright smoke tests (visual regression + WCAG contrast).
// This file covers:
//   1. Module exports present (mount/update/destroy + pure formatters + _testables)
//   2. Defensive guards — mount returns false for null/undefined rootEl
//   3. update/destroy are silent no-ops when not mounted
//   4. hpFormatter correctness (97,100 → "97/100"; nulls → "--/--"; etc.)
//   5. shieldPctFormatter correctness (6 → "6%"; null → "--"; clamps)
//   6. turnFormatter correctness (16 → "16"; null → "--")
//   7. fireMultFormatter correctness vs sacred baseline 0.7
//      (1.5 → "+114%"; 0.7 → "+0%"; null → "--")
//   8. Sacred-cow audit: MAX_HP = 100 byte-perfect (CLAUDE.md §2.1)
//   9. Sacred-cow audit: FIRE_MULT_ACTIVE_RATIO = 0.7 byte-perfect
//
// WCAG-style contrast assertion is OUT OF SCOPE for unit tests (smoke tests
// + visual regression at the Playwright tier handle pixel-level contrast).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Sacred audit reads the stagger-loop.js source TEXTUALLY rather than
// importing it — the import chain bootstraps heavy legacy state
// (HERO_ROSTER → progression init) that requires a full save+window
// runtime. textual audit catches drift in the sacred 0.7 value without
// triggering the bootstrap.
const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGGER_LOOP_PATH = resolve(__dirname, '../../src/core/stagger-loop.js');

import {
  mountTopHud,
  updateTopHud,
  destroyTopHud,
  hpFormatter,
  shieldPctFormatter,
  turnFormatter,
  fireMultFormatter,
  _testables,
} from '../../src/feel/top-hud.js';

describe('TASK-CP-003 — module exports', () => {
  it('exports mountTopHud / updateTopHud / destroyTopHud as functions', () => {
    expect(typeof mountTopHud).toBe('function');
    expect(typeof updateTopHud).toBe('function');
    expect(typeof destroyTopHud).toBe('function');
  });

  it('exports pure formatter helpers as functions', () => {
    expect(typeof hpFormatter).toBe('function');
    expect(typeof shieldPctFormatter).toBe('function');
    expect(typeof turnFormatter).toBe('function');
    expect(typeof fireMultFormatter).toBe('function');
  });

  it('exports a _testables hook with sacred constant mirrors', () => {
    expect(_testables).toBeDefined();
    expect(typeof _testables.MAX_HP).toBe('number');
    expect(typeof _testables.FIRE_MULT_ACTIVE_RATIO).toBe('number');
    expect(typeof _testables._getCurrentHud).toBe('function');
  });
});

describe('TASK-CP-003 — defensive guards', () => {
  it('mountTopHud returns false for null/undefined rootEl', () => {
    expect(mountTopHud(null)).toBe(false);
    expect(mountTopHud(undefined)).toBe(false);
  });

  it('updateTopHud is a silent no-op when no HUD mounted', () => {
    destroyTopHud();   // ensure clean state
    expect(() => updateTopHud({})).not.toThrow();
    expect(() => updateTopHud(undefined)).not.toThrow();
    expect(() => updateTopHud(null)).not.toThrow();
    expect(() => updateTopHud({ hp: 97, shieldPct: 6, turn: 16 })).not.toThrow();
  });

  it('destroyTopHud is idempotent (safe to call when not mounted)', () => {
    destroyTopHud();
    expect(() => destroyTopHud()).not.toThrow();
    expect(() => destroyTopHud()).not.toThrow();
  });

  it('updateTopHud never throws on non-object input', () => {
    expect(() => updateTopHud(42)).not.toThrow();
    expect(() => updateTopHud('hello')).not.toThrow();
    expect(() => updateTopHud(true)).not.toThrow();
  });
});

describe('TASK-CP-003 — hpFormatter (HP chip rendering)', () => {
  it('renders "<hp>/<hpMax>" for normal values', () => {
    expect(hpFormatter(97, 100)).toBe('97/100');
    expect(hpFormatter(100, 100)).toBe('100/100');
    expect(hpFormatter(50, 100)).toBe('50/100');
    expect(hpFormatter(1, 100)).toBe('1/100');
  });

  it('floors fractional hp to integer', () => {
    expect(hpFormatter(97.7, 100)).toBe('97/100');
    expect(hpFormatter(0.5, 100)).toBe('0/100');
  });

  it('clamps negative hp to 0', () => {
    expect(hpFormatter(-5, 100)).toBe('0/100');
  });

  it('renders "--/--" when both fields missing', () => {
    expect(hpFormatter(null, null)).toBe('--/--');
    expect(hpFormatter(undefined, undefined)).toBe('--/--');
  });

  it('renders "--/--" for fully-missing call', () => {
    // No args at all — both fields undefined → "--/--".
    expect(hpFormatter()).toBe('--/--');
  });

  it('defaults hpMax to sacred MAX_HP=100 when hp is provided alone', () => {
    expect(hpFormatter(50)).toBe('50/100');
    expect(hpFormatter(97)).toBe('97/100');
  });

  it('renders "--/100" when hp missing but max known (partial state)', () => {
    expect(hpFormatter(null, 100)).toBe('--/100');
    expect(hpFormatter(undefined, 100)).toBe('--/100');
  });

  it('renders "--" placeholder for non-numeric hp', () => {
    expect(hpFormatter('X', 100)).toBe('--/100');
    expect(hpFormatter(NaN, 100)).toBe('--/100');
  });
});

describe('TASK-CP-003 — shieldPctFormatter (shield chip rendering)', () => {
  it('renders "<n>%" for normal values', () => {
    expect(shieldPctFormatter(6)).toBe('6%');
    expect(shieldPctFormatter(0)).toBe('0%');
    expect(shieldPctFormatter(50)).toBe('50%');
    expect(shieldPctFormatter(100)).toBe('100%');
  });

  it('floors fractional percentages', () => {
    expect(shieldPctFormatter(6.9)).toBe('6%');
    expect(shieldPctFormatter(50.1)).toBe('50%');
  });

  it('clamps to [0..100]', () => {
    expect(shieldPctFormatter(-5)).toBe('0%');
    expect(shieldPctFormatter(150)).toBe('100%');
    expect(shieldPctFormatter(999)).toBe('100%');
  });

  it('renders "--" for missing/invalid values', () => {
    expect(shieldPctFormatter(null)).toBe('--');
    expect(shieldPctFormatter(undefined)).toBe('--');
    expect(shieldPctFormatter('X')).toBe('--');
    expect(shieldPctFormatter(NaN)).toBe('--');
  });
});

describe('TASK-CP-003 — turnFormatter (turn chip rendering)', () => {
  it('renders "<n>" for normal values', () => {
    expect(turnFormatter(16)).toBe('16');
    expect(turnFormatter(0)).toBe('0');
    expect(turnFormatter(1)).toBe('1');
    expect(turnFormatter(999)).toBe('999');
  });

  it('floors fractional turn numbers', () => {
    expect(turnFormatter(16.7)).toBe('16');
  });

  it('clamps negative turn to 0', () => {
    expect(turnFormatter(-1)).toBe('0');
  });

  it('renders "--" for missing/invalid values', () => {
    expect(turnFormatter(null)).toBe('--');
    expect(turnFormatter(undefined)).toBe('--');
    expect(turnFormatter('X')).toBe('--');
    expect(turnFormatter(NaN)).toBe('--');
  });
});

describe('TASK-CP-003 — fireMultFormatter (fire-mult chip — Stagger delta)', () => {
  it('renders "+0%" for the Active-state baseline (sacred 0.7)', () => {
    expect(fireMultFormatter(0.7)).toBe('+0%');
  });

  it('renders "+114%" for Stagger 1.5x (sacred ratio, derived delta)', () => {
    // (1.5 / 0.7 - 1) * 100 = 114.2857… → trunc → 114
    expect(fireMultFormatter(1.5)).toBe('+114%');
  });

  it('renders "+71%" for an intermediate 1.2x amplifier', () => {
    // (1.2 / 0.7 - 1) * 100 = 71.4285… → trunc → 71
    expect(fireMultFormatter(1.2)).toBe('+71%');
  });

  it('renders negative delta with "-" sign when below baseline', () => {
    // (0.35 / 0.7 - 1) * 100 = -50
    expect(fireMultFormatter(0.35)).toBe('-50%');
  });

  it('renders "--" for missing/invalid values', () => {
    expect(fireMultFormatter(null)).toBe('--');
    expect(fireMultFormatter(undefined)).toBe('--');
    expect(fireMultFormatter('X')).toBe('--');
    expect(fireMultFormatter(NaN)).toBe('--');
  });
});

describe('TASK-CP-003 — sacred-cow audit (CLAUDE.md §2.1)', () => {
  it('MAX_HP = 100 byte-perfect (sacred per v2.1 P1 Foundation)', () => {
    // The HUD module mirrors the sacred MAX_HP=100 value as a module-local
    // constant. If the legacy global ever drifts to a different value, the
    // module's runtime parity warning would catch it. This unit assertion
    // locks the module's mirrored constant byte-perfect.
    expect(_testables.MAX_HP).toBe(100);
  });

  it('FIRE_MULT_ACTIVE_RATIO = 0.7 byte-perfect (sacred per v2.1 P2 Stagger ratios) — module mirror', () => {
    // The HUD module mirrors the sacred value as a module-local constant
    // (it never imports from src/core/* per plan §8.3). This unit
    // assertion locks the module's mirrored constant byte-perfect.
    expect(_testables.FIRE_MULT_ACTIVE_RATIO).toBe(0.7);
  });

  it('FIRE_MULT_ACTIVE_RATIO = 0.7 byte-perfect — canonical src/core/stagger-loop.js (textual audit)', () => {
    // Textual audit catches drift in the canonical sacred constant without
    // triggering the legacy bootstrap (HERO_ROSTER → progression init). If
    // stagger-loop.js ever changes the value, this regex fails and the
    // module mirror above must be re-synced.
    const src = readFileSync(STAGGER_LOOP_PATH, 'utf8');
    const match = src.match(/export\s+const\s+FIRE_MULT_ACTIVE_RATIO\s*=\s*([0-9.]+)/);
    expect(match).not.toBeNull();
    expect(parseFloat(match[1])).toBe(0.7);
  });

  it('hpFormatter defaults to sacred MAX_HP when caller omits hpMax', () => {
    // Contract: the chip never invents a wrong max — if caller passes only
    // hp, fall back to sacred 100. Drift in MAX_HP would surface here.
    expect(hpFormatter(50)).toBe('50/100');
    expect(hpFormatter(0)).toBe('0/100');
    expect(hpFormatter(100)).toBe('100/100');
  });
});
