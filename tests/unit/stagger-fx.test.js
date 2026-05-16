// 2026-05-16 — TASK-CP-007 regression tests
//
// Locks the contract for Combat Polish Tier-2 stagger-fx module (third
// and FINAL polish task on top of the MVP gate — this test file lands
// alongside the commit that CLOSES the Polish gate).
//
// Coverage strategy (mirrors damage-channel-fx.test.js / synergy-bar.test.js /
// pressure-meter.test.js precedent): Vitest runs in `node` env. DOM-state
// assertions belong to Playwright smoke tests. This file covers:
//   1. Module exports present (mount/update/destroy + pure helpers + _testables)
//   2. Defensive guards — mount returns false for null/undefined rootEl;
//      update/destroy idempotent; never throws on bad input
//   3. Pure helper: resolveStateClassName — per-state CSS class hook +
//      null for unknown states
//   4. Pure helper: formatRecoveryCountdown — N-turn / 1-turn / REVENGE
//      labels + empty for invalid input
//   5. Sacred-cow audit (module mirror): SACRED_BOSS_STATES 3 strings,
//      STAGGER_DURATION_TURNS=4, RECOVERY_DURATION_TURNS=2,
//      FIRE_MULT_*_RATIO byte-perfect
//   6. Sacred-cow audit (canonical regex-grep): same values byte-perfect
//      against src/core/stagger-loop.js
//   7. Sacred class continuity audit (regex-grep on our new CSS): the
//      legacy classes .stagger-slow-mo / .boss-death-pause / .v-fx-shake /
//      .v-fx-crit-flash / .cell--engineer-welded / .phase-2 / .phase-3
//      are NOT mentioned (added/removed) in src/feel/stagger-fx.css.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGGER_LOOP_PATH    = resolve(__dirname, '../../src/core/stagger-loop.js');
const STAGGER_FX_CSS_PATH  = resolve(__dirname, '../../src/feel/stagger-fx.css');
const STAGGER_FX_JS_PATH   = resolve(__dirname, '../../src/feel/stagger-fx.js');

import {
  mountStaggerFx,
  updateStaggerFx,
  destroyStaggerFx,
  resolveStateClassName,
  formatRecoveryCountdown,
  _testables,
} from '../../src/feel/stagger-fx.js';

describe('TASK-CP-007 — module exports', () => {
  it('exports lifecycle functions (mount/update/destroy)', () => {
    expect(typeof mountStaggerFx).toBe('function');
    expect(typeof updateStaggerFx).toBe('function');
    expect(typeof destroyStaggerFx).toBe('function');
  });

  it('exports pure helpers (resolveStateClassName / formatRecoveryCountdown)', () => {
    expect(typeof resolveStateClassName).toBe('function');
    expect(typeof formatRecoveryCountdown).toBe('function');
  });

  it('exports a _testables hook with sacred constant mirrors', () => {
    expect(_testables).toBeDefined();
    expect(typeof _testables.SACRED_BOSS_STATES).toBe('object');
    expect(typeof _testables.STAGGER_DURATION_TURNS).toBe('number');
    expect(typeof _testables.RECOVERY_DURATION_TURNS).toBe('number');
    expect(typeof _testables.FIRE_MULT_ACTIVE_RATIO).toBe('number');
    expect(typeof _testables.FIRE_MULT_STAGGER_RATIO).toBe('number');
    expect(typeof _testables.FIRE_MULT_RECOVERY_RATIO).toBe('number');
    expect(typeof _testables.ROOT_SLOT_ID).toBe('string');
    expect(typeof _testables.ROOT_CONTAINER_CLASS).toBe('string');
    expect(typeof _testables.CHROMATIC_CLASS).toBe('string');
    expect(typeof _testables.RECOVERY_CLASS).toBe('string');
    expect(typeof _testables.ACTIVE_CLASS).toBe('string');
    expect(typeof _testables.TELEGRAPH_LAYER_CLASS).toBe('string');
    expect(typeof _testables.COUNTDOWN_LABEL_CLASS).toBe('string');
    expect(typeof _testables.FADE_OUT_MS).toBe('number');
    expect(typeof _testables._getCurrentStaggerFx).toBe('function');
  });
});

describe('TASK-CP-007 — defensive guards', () => {
  it('mountStaggerFx returns false for null/undefined rootEl', () => {
    expect(mountStaggerFx(null)).toBe(false);
    expect(mountStaggerFx(undefined)).toBe(false);
  });

  it('updateStaggerFx is a silent no-op when not mounted', () => {
    destroyStaggerFx();
    expect(() => updateStaggerFx({})).not.toThrow();
    expect(() => updateStaggerFx(undefined)).not.toThrow();
    expect(() => updateStaggerFx(null)).not.toThrow();
    expect(() => updateStaggerFx({ bossState: 'stagger' })).not.toThrow();
  });

  it('destroyStaggerFx is idempotent (safe when not mounted)', () => {
    destroyStaggerFx();
    expect(() => destroyStaggerFx()).not.toThrow();
    expect(() => destroyStaggerFx()).not.toThrow();
  });

  it('updateStaggerFx never throws on non-object input', () => {
    destroyStaggerFx();
    expect(() => updateStaggerFx(42)).not.toThrow();
    expect(() => updateStaggerFx('stagger')).not.toThrow();
    expect(() => updateStaggerFx(true)).not.toThrow();
  });

  it('updateStaggerFx tolerates unknown bossState strings', () => {
    destroyStaggerFx();
    expect(() => updateStaggerFx({ bossState: 'not_a_state' })).not.toThrow();
    expect(() => updateStaggerFx({ bossState: '' })).not.toThrow();
  });
});

describe('TASK-CP-007 — resolveStateClassName (per-state class hook)', () => {
  it('returns the active class hook for "active"', () => {
    expect(resolveStateClassName('active')).toBe('bw-stagger-fx--active');
    expect(resolveStateClassName('active')).toBe(_testables.ACTIVE_CLASS);
  });

  it('returns the chromatic-shift class for "stagger"', () => {
    expect(resolveStateClassName('stagger')).toBe('bw-stagger-fx--stagger');
    expect(resolveStateClassName('stagger')).toBe(_testables.CHROMATIC_CLASS);
  });

  it('returns the telegraph class for "recovery"', () => {
    expect(resolveStateClassName('recovery')).toBe('bw-stagger-fx--recovery');
    expect(resolveStateClassName('recovery')).toBe(_testables.RECOVERY_CLASS);
  });

  it('returns null for unknown or invalid states (never throws)', () => {
    expect(resolveStateClassName('bogus')).toBeNull();
    expect(resolveStateClassName('')).toBeNull();
    expect(resolveStateClassName(null)).toBeNull();
    expect(resolveStateClassName(undefined)).toBeNull();
    expect(resolveStateClassName(42)).toBeNull();
    expect(resolveStateClassName({})).toBeNull();
  });
});

describe('TASK-CP-007 — formatRecoveryCountdown (label formatting)', () => {
  it('returns "RECOVERING — N turns" for plural counts', () => {
    expect(formatRecoveryCountdown(2)).toBe('RECOVERING — 2 turns');
    expect(formatRecoveryCountdown(3)).toBe('RECOVERING — 3 turns');
    expect(formatRecoveryCountdown(5)).toBe('RECOVERING — 5 turns');
  });

  it('returns "RECOVERING — 1 turn" (singular) for 1', () => {
    expect(formatRecoveryCountdown(1)).toBe('RECOVERING — 1 turn');
  });

  it('returns "REVENGE" for 0 (revenge fires)', () => {
    expect(formatRecoveryCountdown(0)).toBe('REVENGE');
  });

  it('floors fractional turn counts before rendering', () => {
    expect(formatRecoveryCountdown(2.7)).toBe('RECOVERING — 2 turns');
    expect(formatRecoveryCountdown(1.4)).toBe('RECOVERING — 1 turn');
    expect(formatRecoveryCountdown(0.9)).toBe('REVENGE');
  });

  it('returns empty string for invalid or negative input', () => {
    expect(formatRecoveryCountdown(-1)).toBe('');
    expect(formatRecoveryCountdown(-99)).toBe('');
    expect(formatRecoveryCountdown(null)).toBe('');
    expect(formatRecoveryCountdown(undefined)).toBe('');
    expect(formatRecoveryCountdown('x')).toBe('');
    expect(formatRecoveryCountdown(NaN)).toBe('');
    expect(formatRecoveryCountdown(Infinity)).toBe('');
    expect(formatRecoveryCountdown({})).toBe('');
  });
});

describe('TASK-CP-007 — sacred-cow audit (module mirror)', () => {
  it('SACRED_BOSS_STATES — 3 byte-perfect string identifiers', () => {
    // Sacred per CLAUDE.md §2.5 + combat-mechanics.md §12. Mirrored verbatim
    // from src/core/stagger-loop.js:210-212. Many call sites key off these
    // exact strings — they MUST match the canonical source.
    expect(_testables.SACRED_BOSS_STATES.ACTIVE).toBe('active');
    expect(_testables.SACRED_BOSS_STATES.STAGGER).toBe('stagger');
    expect(_testables.SACRED_BOSS_STATES.RECOVERY).toBe('recovery');
  });

  it('SACRED_BOSS_STATES is frozen — sacred immutability guard', () => {
    expect(Object.isFrozen(_testables.SACRED_BOSS_STATES)).toBe(true);
  });

  it('STAGGER_DURATION_TURNS = 4 byte-perfect (sacred turn window)', () => {
    // Sacred per CLAUDE.md §2.5 + combat-mechanics.md §12 +
    // src/core/stagger-loop.js:232. The chromatic shift holds for THIS
    // many turns — drift here would silently desync the visual layer
    // from the sacred state machine.
    expect(_testables.STAGGER_DURATION_TURNS).toBe(4);
  });

  it('RECOVERY_DURATION_TURNS = 2 byte-perfect (sacred countdown window)', () => {
    // Sacred per CLAUDE.md §2.5 + combat-mechanics.md §12 +
    // src/core/stagger-loop.js:233.
    expect(_testables.RECOVERY_DURATION_TURNS).toBe(2);
  });

  it('FIRE_MULT_ACTIVE_RATIO = 0.7 byte-perfect', () => {
    // Sacred per CLAUDE.md §2.5 + combat-mechanics.md §12 +
    // src/core/stagger-loop.js:250. Audit mirror only — this module
    // never reads the value at runtime (visual-binding only).
    expect(_testables.FIRE_MULT_ACTIVE_RATIO).toBe(0.7);
  });

  it('FIRE_MULT_STAGGER_RATIO = 1.5 byte-perfect', () => {
    // Sacred per CLAUDE.md §2.5 + combat-mechanics.md §12 +
    // src/core/stagger-loop.js:251.
    expect(_testables.FIRE_MULT_STAGGER_RATIO).toBe(1.5);
  });

  it('FIRE_MULT_RECOVERY_RATIO = 0.7 byte-perfect', () => {
    // Sacred per CLAUDE.md §2.5 + combat-mechanics.md §12 +
    // src/core/stagger-loop.js:252. Same as Active during Recovery —
    // boss damage doesn't surge until the revenge attack actually lands.
    expect(_testables.FIRE_MULT_RECOVERY_RATIO).toBe(0.7);
  });
});

describe('TASK-CP-007 — sacred-cow audit (canonical regex-grep)', () => {
  // The regex-grep audits below read src/core/stagger-loop.js TEXTUALLY
  // (no import — avoids bootstrapping the heavy legacy ambient state) and
  // assert that every sacred value referenced by this module's mirror is
  // byte-perfect against the canonical source.

  it('can read src/core/stagger-loop.js', () => {
    const src = readFileSync(STAGGER_LOOP_PATH, 'utf8');
    expect(src.length).toBeGreaterThan(0);
  });

  it('BOSS_STATE_ACTIVE = "active" byte-perfect (stagger-loop.js:210)', () => {
    const src = readFileSync(STAGGER_LOOP_PATH, 'utf8');
    expect(src).toMatch(/export const BOSS_STATE_ACTIVE\s+=\s+'active';/);
  });

  it('BOSS_STATE_STAGGER = "stagger" byte-perfect (stagger-loop.js:211)', () => {
    const src = readFileSync(STAGGER_LOOP_PATH, 'utf8');
    expect(src).toMatch(/export const BOSS_STATE_STAGGER\s+=\s+'stagger';/);
  });

  it('BOSS_STATE_RECOVERY = "recovery" byte-perfect (stagger-loop.js:212)', () => {
    const src = readFileSync(STAGGER_LOOP_PATH, 'utf8');
    expect(src).toMatch(/export const BOSS_STATE_RECOVERY\s+=\s+'recovery';/);
  });

  it('STAGGER_DURATION_TURNS = 4 byte-perfect (stagger-loop.js:232)', () => {
    const src = readFileSync(STAGGER_LOOP_PATH, 'utf8');
    expect(src).toMatch(/export const STAGGER_DURATION_TURNS\s+=\s+4;/);
  });

  it('RECOVERY_DURATION_TURNS = 2 byte-perfect (stagger-loop.js:233)', () => {
    const src = readFileSync(STAGGER_LOOP_PATH, 'utf8');
    expect(src).toMatch(/export const RECOVERY_DURATION_TURNS\s+=\s+2;/);
  });

  it('FIRE_MULT_ACTIVE_RATIO = 0.7 byte-perfect (stagger-loop.js:250)', () => {
    const src = readFileSync(STAGGER_LOOP_PATH, 'utf8');
    expect(src).toMatch(/export const FIRE_MULT_ACTIVE_RATIO\s+=\s+0\.7;/);
  });

  it('FIRE_MULT_STAGGER_RATIO = 1.5 byte-perfect (stagger-loop.js:251)', () => {
    const src = readFileSync(STAGGER_LOOP_PATH, 'utf8');
    expect(src).toMatch(/export const FIRE_MULT_STAGGER_RATIO\s+=\s+1\.5;/);
  });

  it('FIRE_MULT_RECOVERY_RATIO = 0.7 byte-perfect (stagger-loop.js:252)', () => {
    const src = readFileSync(STAGGER_LOOP_PATH, 'utf8');
    expect(src).toMatch(/export const FIRE_MULT_RECOVERY_RATIO\s+=\s+0\.7;/);
  });

  it('module mirror strings align with canonical regex grep', () => {
    const src = readFileSync(STAGGER_LOOP_PATH, 'utf8');
    expect(src.includes("'active'")).toBe(true);
    expect(src.includes("'stagger'")).toBe(true);
    expect(src.includes("'recovery'")).toBe(true);
  });
});

describe('TASK-CP-007 — sacred CSS-class continuity audit', () => {
  // CLAUDE.md §2.2 / §2.5 + plan §12: our new CSS MUST NOT override,
  // remove, or modify any of the existing legacy JS-readable / sacred
  // class selectors. The audit below regex-greps our own CSS for any
  // mention of these classes — any hit fires the test.

  it('does NOT mention .stagger-slow-mo in stagger-fx.css', () => {
    const css = readFileSync(STAGGER_FX_CSS_PATH, 'utf8');
    // We do reference the NAME in a comment header explaining we DON'T
    // touch it — strip out comments before scanning. A simple block-comment
    // strip is sufficient: our CSS uses /* */ comments exclusively.
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(stripped).not.toMatch(/\.stagger-slow-mo\b/);
  });

  it('does NOT mention .boss-death-pause in stagger-fx.css', () => {
    const css = readFileSync(STAGGER_FX_CSS_PATH, 'utf8');
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(stripped).not.toMatch(/\.boss-death-pause\b/);
  });

  it('does NOT mention .v-fx-shake in stagger-fx.css', () => {
    const css = readFileSync(STAGGER_FX_CSS_PATH, 'utf8');
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(stripped).not.toMatch(/\.v-fx-shake\b/);
  });

  it('does NOT mention .v-fx-crit-flash in stagger-fx.css', () => {
    const css = readFileSync(STAGGER_FX_CSS_PATH, 'utf8');
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(stripped).not.toMatch(/\.v-fx-crit-flash\b/);
  });

  it('does NOT mention .cell--engineer-welded in stagger-fx.css', () => {
    const css = readFileSync(STAGGER_FX_CSS_PATH, 'utf8');
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(stripped).not.toMatch(/\.cell--engineer-welded\b/);
  });

  it('does NOT mention .phase-2 / .phase-3 in stagger-fx.css', () => {
    const css = readFileSync(STAGGER_FX_CSS_PATH, 'utf8');
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(stripped).not.toMatch(/\.phase-2\b/);
    expect(stripped).not.toMatch(/\.phase-3\b/);
  });

  it('stagger-fx.js never imports from src/core/ (feel-layer discipline)', () => {
    const src = readFileSync(STAGGER_FX_JS_PATH, 'utf8');
    // Imports from sibling feel modules + own data is fine; src/core/
    // imports would bootstrap heavy legacy state.
    expect(src).not.toMatch(/from\s+['"][^'"]*src\/core\//);
    expect(src).not.toMatch(/from\s+['"]\.\.\/core\//);
  });
});
