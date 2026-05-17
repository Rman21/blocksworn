// 2026-05-16 — TASK-CP-004 regression tests
//
// Locks the contract for Combat Polish Tier-1 Sekiro-style pressure-meter
// module. This commit CLOSES the Combat Polish MVP gate (Tasks 1-4 complete).
//
// Coverage strategy (per project convention — see boss-scene.test.js +
// hero-card.test.js + top-hud.test.js): Vitest runs in `node` env. DOM-state
// assertions belong to Playwright smoke tests (visual regression + 60fps
// frame-timeline). This file covers:
//   1. Module exports present (mount/update/destroy + pure helpers + _testables)
//   2. Defensive guards — mount returns false for null/undefined rootEl
//   3. update/destroy are silent no-ops when not mounted
//   4. pressureFillPct correctness (62/100 → 62; clamp [0..max])
//   5. formatPressureLabel correctness (62/100 → "62/100"; nulls → "--/100")
//   6. shouldTriggerSurge predicate (line_quad → true; 8 other events → false)
//   7. Sacred-cow audit: PRESSURE_MAX = 100 byte-perfect (module mirror)
//   8. Sacred-cow audit: PRESSURE_GAIN 9 values byte-perfect (module mirror)
//   9. Sacred-cow audit: canonical src/core/stagger-loop.js regex-grep parity
//      (PRESSURE_MAX + all 9 PRESSURE_GAIN entries — without bootstrapping
//      heavy legacy state via import)
//
// Performance / 60fps assertion is OUT OF SCOPE for unit tests (smoke tests
// at the Playwright tier handle frame timeline + CSS layout-thrash audit).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Sacred audit reads the stagger-loop.js source TEXTUALLY rather than
// importing it — the import chain bootstraps heavy legacy state
// (HERO_ROSTER → progression init) that requires a full save+window
// runtime. textual audit catches drift in the sacred values without
// triggering the bootstrap.
const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGGER_LOOP_PATH = resolve(__dirname, '../../src/core/stagger-loop.js');

import {
  mountPressureMeter,
  updatePressureMeter,
  destroyPressureMeter,
  pressureFillPct,
  formatPressureLabel,
  shouldTriggerSurge,
  _testables,
} from '../../src/feel/pressure-meter.js';

// Canonical 9 PRESSURE_GAIN entries (per combat-mechanics.md §13.2 +
// src/core/stagger-loop.js:219-229). Drives both the module-mirror parity
// assertion AND the regex-grep audit against canonical source.
const EXPECTED_PRESSURE_GAIN = Object.freeze({
  line_single:      5,
  line_double:     12,
  line_triple:     25,
  line_quad:       45,
  inferno_proc:    20,
  detonate_proc:   20,
  hero_ult:        15,
  signature_combo: 30,
  cascade_per_cell: 8,
});

describe('TASK-CP-004 — module exports', () => {
  it('exports mountPressureMeter / updatePressureMeter / destroyPressureMeter as functions', () => {
    expect(typeof mountPressureMeter).toBe('function');
    expect(typeof updatePressureMeter).toBe('function');
    expect(typeof destroyPressureMeter).toBe('function');
  });

  it('exports pure helper functions', () => {
    expect(typeof pressureFillPct).toBe('function');
    expect(typeof formatPressureLabel).toBe('function');
    expect(typeof shouldTriggerSurge).toBe('function');
  });

  it('exports a _testables hook with sacred constant mirrors', () => {
    expect(_testables).toBeDefined();
    expect(typeof _testables.PRESSURE_MAX).toBe('number');
    expect(typeof _testables.PRESSURE_GAIN).toBe('object');
    expect(typeof _testables.SURGE_EVENT).toBe('string');
    expect(typeof _testables.SURGE_DURATION_MS).toBe('number');
    expect(typeof _testables._getCurrentMeter).toBe('function');
  });
});

describe('TASK-CP-004 — defensive guards', () => {
  it('mountPressureMeter returns false for null/undefined rootEl', () => {
    expect(mountPressureMeter(null)).toBe(false);
    expect(mountPressureMeter(undefined)).toBe(false);
  });

  it('updatePressureMeter is a silent no-op when no meter mounted', () => {
    destroyPressureMeter();   // ensure clean state
    expect(() => updatePressureMeter({})).not.toThrow();
    expect(() => updatePressureMeter(undefined)).not.toThrow();
    expect(() => updatePressureMeter(null)).not.toThrow();
    expect(() => updatePressureMeter({ pressure: 62, recentEvent: 'line_quad' })).not.toThrow();
  });

  it('destroyPressureMeter is idempotent (safe to call when not mounted)', () => {
    destroyPressureMeter();
    expect(() => destroyPressureMeter()).not.toThrow();
    expect(() => destroyPressureMeter()).not.toThrow();
  });

  it('updatePressureMeter never throws on non-object input', () => {
    expect(() => updatePressureMeter(42)).not.toThrow();
    expect(() => updatePressureMeter('hello')).not.toThrow();
    expect(() => updatePressureMeter(true)).not.toThrow();
  });
});

describe('TASK-CP-004 — pressureFillPct (fill width % calculator)', () => {
  it('renders correct % for normal values (sacred PRESSURE_MAX=100)', () => {
    expect(pressureFillPct(62, 100)).toBe(62);
    expect(pressureFillPct(100, 100)).toBe(100);
    expect(pressureFillPct(0, 100)).toBe(0);
    expect(pressureFillPct(50, 100)).toBe(50);
  });

  it('floors fractional pressure', () => {
    // 62.9 / 100 = 0.629 → 62%
    expect(pressureFillPct(62.9, 100)).toBe(62);
    // PRESSURE_GAIN.line_quad delta lands at 45/100 = 45%
    expect(pressureFillPct(45, 100)).toBe(45);
    // PRESSURE_GAIN.cascade_per_cell × 1 = 8/100 = 8%
    expect(pressureFillPct(8, 100)).toBe(8);
  });

  it('clamps negative pressure to 0', () => {
    expect(pressureFillPct(-5, 100)).toBe(0);
    expect(pressureFillPct(-100, 100)).toBe(0);
  });

  it('clamps over-max pressure to 100', () => {
    expect(pressureFillPct(150, 100)).toBe(100);
    expect(pressureFillPct(99999, 100)).toBe(100);
  });

  it('returns 0 for non-numeric / invalid pressure', () => {
    expect(pressureFillPct(null, 100)).toBe(0);
    expect(pressureFillPct(undefined, 100)).toBe(0);
    expect(pressureFillPct('X', 100)).toBe(0);
    expect(pressureFillPct(NaN, 100)).toBe(0);
  });

  it('defaults pressureMax to sacred PRESSURE_MAX=100 when caller omits it', () => {
    // The gauge must never invent a wrong max — if caller passes only
    // pressure, fall back to sacred 100. Drift in PRESSURE_MAX would surface here.
    expect(pressureFillPct(62)).toBe(62);
    expect(pressureFillPct(0)).toBe(0);
    expect(pressureFillPct(100)).toBe(100);
  });
});

describe('TASK-CP-004 — formatPressureLabel (numeric label rendering)', () => {
  it('renders "<pressure>/<max>" for normal values', () => {
    expect(formatPressureLabel(62, 100)).toBe('62/100');
    expect(formatPressureLabel(100, 100)).toBe('100/100');
    expect(formatPressureLabel(0, 100)).toBe('0/100');
    expect(formatPressureLabel(45, 100)).toBe('45/100');     // line_quad sacred delta
    expect(formatPressureLabel(8, 100)).toBe('8/100');       // cascade_per_cell sacred delta
  });

  it('floors fractional pressure', () => {
    expect(formatPressureLabel(45.7, 100)).toBe('45/100');
    expect(formatPressureLabel(0.5, 100)).toBe('0/100');
  });

  it('clamps negative pressure to 0', () => {
    expect(formatPressureLabel(-5, 100)).toBe('0/100');
  });

  it('clamps over-max pressure to max', () => {
    expect(formatPressureLabel(150, 100)).toBe('100/100');
  });

  it('renders "--/<max>" for non-numeric pressure', () => {
    expect(formatPressureLabel(null, 100)).toBe('--/100');
    expect(formatPressureLabel(undefined, 100)).toBe('--/100');
    expect(formatPressureLabel('X', 100)).toBe('--/100');
    expect(formatPressureLabel(NaN, 100)).toBe('--/100');
  });

  it('defaults max to sacred PRESSURE_MAX=100 when caller omits it', () => {
    expect(formatPressureLabel(62)).toBe('62/100');
    expect(formatPressureLabel(null)).toBe('--/100');
  });
});

describe('TASK-CP-004 — shouldTriggerSurge (line_quad-only predicate)', () => {
  it('returns true for the sacred line_quad event (the +45 mastery moment)', () => {
    // PRESSURE_GAIN.line_quad = 45 — biggest single delta per
    // combat-mechanics.md §13.2. This is the ONLY event that surges.
    expect(shouldTriggerSurge('line_quad')).toBe(true);
  });

  it('returns false for all 8 other PRESSURE_GAIN events (build without surge)', () => {
    expect(shouldTriggerSurge('line_single')).toBe(false);
    expect(shouldTriggerSurge('line_double')).toBe(false);
    expect(shouldTriggerSurge('line_triple')).toBe(false);
    expect(shouldTriggerSurge('inferno_proc')).toBe(false);
    expect(shouldTriggerSurge('detonate_proc')).toBe(false);
    expect(shouldTriggerSurge('hero_ult')).toBe(false);
    expect(shouldTriggerSurge('signature_combo')).toBe(false);
    expect(shouldTriggerSurge('cascade_per_cell')).toBe(false);
  });

  it('returns false for unknown / invalid event identifiers', () => {
    expect(shouldTriggerSurge('made_up_event')).toBe(false);
    expect(shouldTriggerSurge('')).toBe(false);
    expect(shouldTriggerSurge(null)).toBe(false);
    expect(shouldTriggerSurge(undefined)).toBe(false);
    expect(shouldTriggerSurge(42)).toBe(false);
    expect(shouldTriggerSurge(false)).toBe(false);
  });

  it('exposes SURGE_EVENT canonical identifier matching the predicate', () => {
    // Module-internal consistency: the predicate fires on _testables.SURGE_EVENT.
    expect(_testables.SURGE_EVENT).toBe('line_quad');
    expect(shouldTriggerSurge(_testables.SURGE_EVENT)).toBe(true);
  });
});

describe('TASK-CP-004 — sacred-cow audit (CLAUDE.md §2.5 + combat-mechanics.md §13)', () => {
  it('PRESSURE_MAX = 100 byte-perfect — module mirror (v2.1 P2 Stagger Loop)', () => {
    // The meter module mirrors the sacred PRESSURE_MAX=100 value as a
    // module-local constant. If the legacy global ever drifts to a different
    // value, the module's runtime parity warning would catch it. This unit
    // assertion locks the module's mirrored constant byte-perfect.
    expect(_testables.PRESSURE_MAX).toBe(100);
  });

  it('PRESSURE_MAX = 100 byte-perfect — canonical src/core/stagger-loop.js (regex-grep)', () => {
    // Textual audit catches drift in the canonical sacred constant without
    // triggering the legacy bootstrap (HERO_ROSTER → progression init). If
    // stagger-loop.js ever changes the value, this regex fails and the
    // module mirror above must be re-synced.
    const src = readFileSync(STAGGER_LOOP_PATH, 'utf8');
    const match = src.match(/export\s+const\s+PRESSURE_MAX\s*=\s*([0-9]+)/);
    expect(match).not.toBeNull();
    expect(parseInt(match[1], 10)).toBe(100);
  });

  it('PRESSURE_GAIN 9 values byte-perfect — module mirror (combat-mechanics.md §13.2)', () => {
    // The meter module mirrors all 9 sacred PRESSURE_GAIN values as a
    // module-local frozen object. Per-key value assertion locks each entry
    // byte-perfect — line_quad=45 is the surge trigger (mastery moment).
    expect(_testables.PRESSURE_GAIN.line_single).toBe(5);
    expect(_testables.PRESSURE_GAIN.line_double).toBe(12);
    expect(_testables.PRESSURE_GAIN.line_triple).toBe(25);
    expect(_testables.PRESSURE_GAIN.line_quad).toBe(45);
    expect(_testables.PRESSURE_GAIN.inferno_proc).toBe(20);
    expect(_testables.PRESSURE_GAIN.detonate_proc).toBe(20);
    expect(_testables.PRESSURE_GAIN.hero_ult).toBe(15);
    expect(_testables.PRESSURE_GAIN.signature_combo).toBe(30);
    expect(_testables.PRESSURE_GAIN.cascade_per_cell).toBe(8);
  });

  it('PRESSURE_GAIN object is frozen (defensive immutability)', () => {
    expect(Object.isFrozen(_testables.PRESSURE_GAIN)).toBe(true);
  });

  it('PRESSURE_GAIN 9 values byte-perfect — canonical src/core/stagger-loop.js (regex-grep)', () => {
    // Textual audit catches drift in the canonical sacred 9-value table
    // without triggering the legacy bootstrap. For each key, regex-extracts
    // the value and asserts byte-perfect parity. If stagger-loop.js ever
    // changes a value, this audit fails and the module mirror above must
    // be re-synced. Mirrors top-hud.test.js FIRE_MULT_ACTIVE_RATIO audit
    // pattern.
    const src = readFileSync(STAGGER_LOOP_PATH, 'utf8');

    // Extract the PRESSURE_GAIN frozen object block.
    const blockMatch = src.match(/export\s+const\s+PRESSURE_GAIN\s*=\s*Object\.freeze\(\s*\{([\s\S]*?)\}\s*\)/);
    expect(blockMatch).not.toBeNull();
    const block = blockMatch[1];

    // Per-key value assertion — walks the 9 keys in EXPECTED_PRESSURE_GAIN
    // and confirms each appears with the sacred value inside the block.
    for (const [key, expected] of Object.entries(EXPECTED_PRESSURE_GAIN)) {
      const keyRegex = new RegExp(`${key}\\s*:\\s*([0-9]+)`);
      const m = block.match(keyRegex);
      expect(m, `PRESSURE_GAIN.${key} not found in canonical source`).not.toBeNull();
      expect(parseInt(m[1], 10), `PRESSURE_GAIN.${key} drift`).toBe(expected);
    }
  });

  it('pressureFillPct defaults to sacred PRESSURE_MAX when caller omits max', () => {
    // Contract: the gauge never invents a wrong max — drift in PRESSURE_MAX
    // would surface here as the default-fallback path.
    expect(pressureFillPct(50)).toBe(50);
    expect(pressureFillPct(100)).toBe(100);
    expect(pressureFillPct(0)).toBe(0);
  });

  it('SURGE_EVENT canonical key matches a real PRESSURE_GAIN entry', () => {
    // The surge predicate fires on line_quad — confirm that's actually a
    // valid key in the sacred PRESSURE_GAIN table (not a stale identifier
    // pointing at a renamed sacred event).
    expect(_testables.PRESSURE_GAIN).toHaveProperty(_testables.SURGE_EVENT);
    // And the value at that key is the sacred +45 (the biggest single delta).
    expect(_testables.PRESSURE_GAIN[_testables.SURGE_EVENT]).toBe(45);
  });
});
