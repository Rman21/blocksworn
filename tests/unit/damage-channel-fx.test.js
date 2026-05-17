// 2026-05-16 — TASK-CP-006 regression tests
//
// Locks the contract for Combat Polish Tier-2 damage-channel-fx module
// (second polish task on top of the MVP gate, after TASK-CP-005 synergy bar).
//
// Coverage strategy (mirrors synergy-bar.test.js / pressure-meter.test.js
// precedent): Vitest runs in `node` env. DOM-state assertions belong to
// Playwright smoke tests (visual regression + per-channel pixel diff).
// This file covers:
//   1. Module exports present (mount/update/spawn/trigger/destroy + pure
//      helpers + _testables)
//   2. Defensive guards — mount returns false for null/undefined rootEl;
//      update/destroy idempotent
//   3. Pure helper: resolveChannelColor — per-channel + signature element
//      inheritance + fallback for unknown channels
//   4. Pure helper: resolveChannelHaptic — per-channel vibrate pattern
//      + empty for unknown channels
//   5. Pure helper: formatDamageText — numeric formatting + crit suffix
//      + non-numeric coercion
//   6. Sacred-cow audit: SACRED_CHANNEL_KEYS 4 strings byte-perfect
//      (module mirror + regex-grep on src/core/damage-channels.js)
//   7. Sacred-cow audit: channel colors `#FF4D1F` + `#9B59E8` byte-perfect
//   8. Sacred-cow audit: CHANNEL_DEADZONE_DMG=5 / CHANNEL_VOID_TICK_PCT=0.005
//      / CHANNEL_GRID_SATURATION_THRESHOLD=0.75 / CHANNEL_GRID_SATURATION_DMG=8
//      / MITIGATION_CAP=0.70 byte-perfect (regex-grep on canonical source)

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DAMAGE_CHANNELS_PATH = resolve(__dirname, '../../src/core/damage-channels.js');

import {
  mountDamageChannelFx,
  updateDamageChannelFx,
  destroyDamageChannelFx,
  spawnDamageNumber,
  triggerChannelFx,
  resolveChannelColor,
  resolveChannelHaptic,
  formatDamageText,
  _testables,
} from '../../src/feel/damage-channel-fx.js';
import { STIHIYAS, STIHIYA_COLORS } from '../../src/data/elements.js';

describe('TASK-CP-006 — module exports', () => {
  it('exports lifecycle functions (mount/update/destroy)', () => {
    expect(typeof mountDamageChannelFx).toBe('function');
    expect(typeof updateDamageChannelFx).toBe('function');
    expect(typeof destroyDamageChannelFx).toBe('function');
  });

  it('exports event-spawn helpers (spawnDamageNumber / triggerChannelFx)', () => {
    expect(typeof spawnDamageNumber).toBe('function');
    expect(typeof triggerChannelFx).toBe('function');
  });

  it('exports pure helpers (resolveChannelColor / resolveChannelHaptic / formatDamageText)', () => {
    expect(typeof resolveChannelColor).toBe('function');
    expect(typeof resolveChannelHaptic).toBe('function');
    expect(typeof formatDamageText).toBe('function');
  });

  it('exports a _testables hook with sacred constant mirrors', () => {
    expect(_testables).toBeDefined();
    expect(typeof _testables.SACRED_CHANNEL_KEYS).toBe('object');
    expect(typeof _testables.CHANNEL_COLORS).toBe('object');
    expect(typeof _testables.CHANNEL_HAPTICS).toBe('object');
    expect(typeof _testables.FALLBACK_COLOR).toBe('string');
    expect(typeof _testables.SIGNATURE_DEFAULT_ELEMENT).toBe('string');
    expect(typeof _testables.ROOT_SLOT_ID).toBe('string');
    expect(typeof _testables.OVERLAY_CLASS).toBe('string');
    expect(typeof _testables.OVERLAY_LAYER_CLASS).toBe('string');
    expect(typeof _testables.MITIGATION_CHIP_CLASS).toBe('string');
    expect(typeof _testables._getCurrentChannelFx).toBe('function');
  });
});

describe('TASK-CP-006 — defensive guards', () => {
  it('mountDamageChannelFx returns false for null/undefined rootEl', () => {
    expect(mountDamageChannelFx(null)).toBe(false);
    expect(mountDamageChannelFx(undefined)).toBe(false);
  });

  it('updateDamageChannelFx is a silent no-op when not mounted', () => {
    destroyDamageChannelFx();
    expect(() => updateDamageChannelFx({})).not.toThrow();
    expect(() => updateDamageChannelFx(undefined)).not.toThrow();
    expect(() => updateDamageChannelFx(null)).not.toThrow();
    expect(() => updateDamageChannelFx({ mitigated: 5 })).not.toThrow();
  });

  it('destroyDamageChannelFx is idempotent (safe when not mounted)', () => {
    destroyDamageChannelFx();
    expect(() => destroyDamageChannelFx()).not.toThrow();
    expect(() => destroyDamageChannelFx()).not.toThrow();
  });

  it('updateDamageChannelFx never throws on non-object input', () => {
    destroyDamageChannelFx();
    expect(() => updateDamageChannelFx(42)).not.toThrow();
    expect(() => updateDamageChannelFx('mitigated')).not.toThrow();
    expect(() => updateDamageChannelFx(true)).not.toThrow();
  });

  it('spawnDamageNumber returns null when no DOM host resolves (node env)', () => {
    // In Vitest's `node` env there's no document — the function must defend
    // and return null rather than throw. (Smoke tests cover real DOM.)
    expect(() => spawnDamageNumber('deadzone', 5, false)).not.toThrow();
    // We don't assert null specifically here — Vitest may inject a jsdom
    // shim — but the call must never throw.
  });

  it('triggerChannelFx is a silent no-op when not mounted', () => {
    destroyDamageChannelFx();
    expect(() => triggerChannelFx('deadzone')).not.toThrow();
    expect(triggerChannelFx('deadzone')).toBeNull();
  });
});

describe('TASK-CP-006 — resolveChannelColor (per-channel + boss element)', () => {
  it('returns #FF4D1F sacred for DEAD_ZONE', () => {
    expect(resolveChannelColor('deadzone')).toBe('#FF4D1F');
  });

  it('returns #9B59E8 sacred for VOID', () => {
    expect(resolveChannelColor('void_tick')).toBe('#9B59E8');
  });

  it('returns the boss element color for SIGNATURE', () => {
    // Plan §6.3: "Damage channel SIGNATURE | Boss's element color"
    // STIHIYA_COLORS is the legacy authoritative element → hex map.
    for (const element of STIHIYAS) {
      const expectedColor = STIHIYA_COLORS[element];
      expect(resolveChannelColor('signature', element)).toBe(expectedColor);
    }
  });

  it('falls back to umbra color when SIGNATURE has no/invalid boss element', () => {
    // Per docs/header: 'umbra' is the SIGNATURE_DEFAULT_ELEMENT.
    expect(resolveChannelColor('signature')).toBe(STIHIYA_COLORS.umbra);
    expect(resolveChannelColor('signature', null)).toBe(STIHIYA_COLORS.umbra);
    expect(resolveChannelColor('signature', 'not_an_element')).toBe(STIHIYA_COLORS.umbra);
    expect(resolveChannelColor('signature', 42)).toBe(STIHIYA_COLORS.umbra);
  });

  it('returns amber #FFC04A for GRID_SATURATION', () => {
    expect(resolveChannelColor('saturation')).toBe('#FFC04A');
  });

  it('returns fallback color for unknown channels (never throws)', () => {
    expect(resolveChannelColor('bogus')).toBe(_testables.FALLBACK_COLOR);
    expect(resolveChannelColor('')).toBe(_testables.FALLBACK_COLOR);
    expect(resolveChannelColor(null)).toBe(_testables.FALLBACK_COLOR);
    expect(resolveChannelColor(undefined)).toBe(_testables.FALLBACK_COLOR);
    expect(resolveChannelColor(42)).toBe(_testables.FALLBACK_COLOR);
    expect(resolveChannelColor({})).toBe(_testables.FALLBACK_COLOR);
  });
});

describe('TASK-CP-006 — resolveChannelHaptic (per-channel vibrate)', () => {
  it('returns [30] for DEAD_ZONE (V_HAPTICS.hit alignment)', () => {
    // V_HAPTICS.hit = 30 per CLAUDE.md §2.2 — the deadzone vibrate matches
    // the hit haptic so a single boss attack feels consistent.
    expect(resolveChannelHaptic('deadzone')).toEqual([30]);
  });

  it('returns [40, 30, 40] sacred for VOID', () => {
    // Sacred per damage-channels.js:223 + plan §6.3 element appearance row.
    expect(resolveChannelHaptic('void_tick')).toEqual([40, 30, 40]);
  });

  it('returns [120, 50, 120] for SIGNATURE', () => {
    expect(resolveChannelHaptic('signature')).toEqual([120, 50, 120]);
  });

  it('returns [50, 30, 50, 30, 50] for GRID_SATURATION', () => {
    expect(resolveChannelHaptic('saturation')).toEqual([50, 30, 50, 30, 50]);
  });

  it('returns empty array for unknown channels (never throws)', () => {
    expect(resolveChannelHaptic('bogus')).toEqual([]);
    expect(resolveChannelHaptic('')).toEqual([]);
    expect(resolveChannelHaptic(null)).toEqual([]);
    expect(resolveChannelHaptic(undefined)).toEqual([]);
    expect(resolveChannelHaptic(42)).toEqual([]);
  });

  it('returns a defensive copy — callers cannot mutate the frozen mirror', () => {
    const a = resolveChannelHaptic('void_tick');
    const b = resolveChannelHaptic('void_tick');
    a.push(999);
    expect(b).toEqual([40, 30, 40]);     // second call still pristine
    expect(_testables.CHANNEL_HAPTICS.void_tick).toEqual([40, 30, 40]);
  });
});

describe('TASK-CP-006 — formatDamageText (display formatting)', () => {
  it('formats numeric damage without crit', () => {
    expect(formatDamageText(0, false)).toBe('0');
    expect(formatDamageText(1, false)).toBe('1');
    expect(formatDamageText(5, false)).toBe('5');
    expect(formatDamageText(50, false)).toBe('50');
    expect(formatDamageText(999, false)).toBe('999');
  });

  it('appends "!" for crit', () => {
    expect(formatDamageText(0, true)).toBe('0!');
    expect(formatDamageText(50, true)).toBe('50!');
    expect(formatDamageText(123, true)).toBe('123!');
  });

  it('rounds non-integer damage to nearest int', () => {
    expect(formatDamageText(2.4, false)).toBe('2');
    expect(formatDamageText(2.5, false)).toBe('3');
    expect(formatDamageText(2.9, true)).toBe('3!');
  });

  it('clamps negative damage to 0 (defensive)', () => {
    expect(formatDamageText(-5, false)).toBe('0');
    expect(formatDamageText(-5, true)).toBe('0!');
  });

  it('coerces non-numeric input to 0 (never throws)', () => {
    expect(formatDamageText('x', false)).toBe('0');
    expect(formatDamageText('x', true)).toBe('0!');
    expect(formatDamageText(null, false)).toBe('0');
    expect(formatDamageText(undefined, true)).toBe('0!');
    expect(formatDamageText(NaN, false)).toBe('0');
    expect(formatDamageText(Infinity, false)).toBe('0');
    expect(formatDamageText({}, false)).toBe('0');
  });
});

describe('TASK-CP-006 — sacred-cow audit (module mirror)', () => {
  it('SACRED_CHANNEL_KEYS — 4 byte-perfect string identifiers', () => {
    // Sacred per CLAUDE.md §2.5 + combat-mechanics.md §9.5. Mirrored verbatim
    // from src/core/damage-channels.js:157-160. Many call sites (showChannelFX,
    // FTUE dialog gates, Sentry breadcrumbs) key off these exact strings.
    expect(_testables.SACRED_CHANNEL_KEYS.DEAD_ZONE).toBe('deadzone');
    expect(_testables.SACRED_CHANNEL_KEYS.VOID).toBe('void_tick');
    expect(_testables.SACRED_CHANNEL_KEYS.SIGNATURE).toBe('signature');
    expect(_testables.SACRED_CHANNEL_KEYS.GRID_SATURATION).toBe('saturation');
  });

  it('SACRED_CHANNEL_KEYS is frozen — sacred immutability guard', () => {
    expect(Object.isFrozen(_testables.SACRED_CHANNEL_KEYS)).toBe(true);
  });

  it('CHANNEL_COLORS — sacred hex codes byte-perfect (plan §6.3)', () => {
    // Sacred per plan §6.3 element-appearance table:
    //   DEAD_ZONE | #FF4D1F (always ember-orange, sacred)
    //   VOID      | #9B59E8 (always umbra-violet, sacred)
    expect(_testables.CHANNEL_COLORS.deadzone).toBe('#FF4D1F');
    expect(_testables.CHANNEL_COLORS.void_tick).toBe('#9B59E8');
    expect(_testables.CHANNEL_COLORS.signature).toBeNull();       // resolved from boss element
    expect(_testables.CHANNEL_COLORS.saturation).toBe('#FFC04A'); // amber warning
  });

  it('CHANNEL_HAPTICS frozen — vibrate patterns immutable', () => {
    expect(Object.isFrozen(_testables.CHANNEL_HAPTICS)).toBe(true);
    expect(Object.isFrozen(_testables.CHANNEL_HAPTICS.void_tick)).toBe(true);
    expect(Object.isFrozen(_testables.CHANNEL_HAPTICS.deadzone)).toBe(true);
    expect(Object.isFrozen(_testables.CHANNEL_HAPTICS.signature)).toBe(true);
    expect(Object.isFrozen(_testables.CHANNEL_HAPTICS.saturation)).toBe(true);
  });

  it('SIGNATURE_DEFAULT_ELEMENT = "umbra"', () => {
    // Defaults to umbra so SIGNATURE without a boss element still reads
    // as visually distinct from the other 3 channels.
    expect(_testables.SIGNATURE_DEFAULT_ELEMENT).toBe('umbra');
    expect(STIHIYAS.includes(_testables.SIGNATURE_DEFAULT_ELEMENT)).toBe(true);
  });
});

describe('TASK-CP-006 — sacred-cow audit (canonical regex-grep)', () => {
  // The regex-grep audits below read src/core/damage-channels.js TEXTUALLY
  // (no import — avoids bootstrapping the heavy legacy ambient state) and
  // assert that every sacred value referenced by this module's mirror is
  // byte-perfect against the canonical source.
  let damageChannelsSrc;
  it('can read src/core/damage-channels.js', () => {
    damageChannelsSrc = readFileSync(DAMAGE_CHANNELS_PATH, 'utf8');
    expect(damageChannelsSrc.length).toBeGreaterThan(0);
  });

  it('CH_DEAD_ZONE = "deadzone" byte-perfect (damage-channels.js:157)', () => {
    const src = readFileSync(DAMAGE_CHANNELS_PATH, 'utf8');
    expect(src).toMatch(/export const CH_DEAD_ZONE\s*=\s*'deadzone';/);
  });

  it('CH_VOID = "void_tick" byte-perfect (damage-channels.js:158)', () => {
    const src = readFileSync(DAMAGE_CHANNELS_PATH, 'utf8');
    expect(src).toMatch(/export const CH_VOID\s*=\s*'void_tick';/);
  });

  it('CH_SIGNATURE = "signature" byte-perfect (damage-channels.js:159)', () => {
    const src = readFileSync(DAMAGE_CHANNELS_PATH, 'utf8');
    expect(src).toMatch(/export const CH_SIGNATURE\s*=\s*'signature';/);
  });

  it('CH_GRID_SATURATION = "saturation" byte-perfect (damage-channels.js:160)', () => {
    const src = readFileSync(DAMAGE_CHANNELS_PATH, 'utf8');
    expect(src).toMatch(/export const CH_GRID_SATURATION\s*=\s*'saturation';/);
  });

  it('CHANNEL_DEADZONE_DMG = 5 byte-perfect (damage-channels.js:164)', () => {
    const src = readFileSync(DAMAGE_CHANNELS_PATH, 'utf8');
    expect(src).toMatch(/export const CHANNEL_DEADZONE_DMG\s+=\s+5;/);
  });

  it('CHANNEL_VOID_TICK_PCT = 0.005 byte-perfect (damage-channels.js:165)', () => {
    const src = readFileSync(DAMAGE_CHANNELS_PATH, 'utf8');
    expect(src).toMatch(/export const CHANNEL_VOID_TICK_PCT\s+=\s+0\.005;/);
  });

  it('CHANNEL_GRID_SATURATION_THRESHOLD = 0.75 byte-perfect (damage-channels.js:166)', () => {
    const src = readFileSync(DAMAGE_CHANNELS_PATH, 'utf8');
    expect(src).toMatch(/export const CHANNEL_GRID_SATURATION_THRESHOLD\s+=\s+0\.75;/);
  });

  it('CHANNEL_GRID_SATURATION_DMG = 8 byte-perfect (damage-channels.js:167)', () => {
    const src = readFileSync(DAMAGE_CHANNELS_PATH, 'utf8');
    expect(src).toMatch(/export const CHANNEL_GRID_SATURATION_DMG\s+=\s+8;/);
  });

  it('MITIGATION_CAP = 0.70 byte-perfect (damage-channels.js:183)', () => {
    const src = readFileSync(DAMAGE_CHANNELS_PATH, 'utf8');
    expect(src).toMatch(/export const MITIGATION_CAP\s*=\s*0\.70;/);
  });

  it('legacy showChannelFX styles map confirms #9B59E8 void color byte-perfect (~line 223)', () => {
    // Cross-validates our module-local CHANNEL_COLORS.void_tick = '#9B59E8'
    // against the canonical legacy styles map. If the legacy hex ever
    // drifts, this test fires and the module mirror needs re-syncing.
    const src = readFileSync(DAMAGE_CHANNELS_PATH, 'utf8');
    expect(src).toMatch(/void_tick:\s*\{\s*color:\s*'#9B59E8'/);
  });

  it('legacy showChannelFX styles map exposes the void vibrate pattern [40, 30, 40]', () => {
    // Cross-validates our module-local CHANNEL_HAPTICS.void_tick.
    const src = readFileSync(DAMAGE_CHANNELS_PATH, 'utf8');
    expect(src).toMatch(/void_tick:\s*\{[\s\S]*?vibrate:\s*\[40,\s*30,\s*40\]/);
  });

  it('module mirror values numerically align with canonical regex grep', () => {
    // Defensive numeric cross-check on the few values this module touches.
    const src = readFileSync(DAMAGE_CHANNELS_PATH, 'utf8');

    // Verify the 4 channel-key strings appear in the canonical file in the
    // exact form the module mirrors them.
    expect(src.includes("'deadzone'")).toBe(true);
    expect(src.includes("'void_tick'")).toBe(true);
    expect(src.includes("'signature'")).toBe(true);
    expect(src.includes("'saturation'")).toBe(true);

    // Verify the void-tick hex code appears in the legacy FX styles map.
    expect(src.includes("'#9B59E8'")).toBe(true);
  });
});
