// 2026-05-17 — TASK-CP-009 regression tests
//
// Locks the contract for Combat Polish Tier-3 5-beat boss death cinematic
// polish module — the second Tier-3 Identity task. Polish refines the
// visual *content* of each beat (shake amplitude curve / hit-pause
// desaturation intensity / Beat-2 themed-color flash tint / Beat-4 zoom
// origin + easing) within the sacred 440 / 300 / 260+220 / 420ms beat
// durations.
//
// Coverage strategy (mirrors race-fx-polish.test.js / stagger-fx.test.js /
// damage-channel-fx.test.js precedent): Vitest runs in `node` env. DOM-
// state assertions belong to Playwright smoke tests. This file covers:
//
//   1. Module exports present (mount/destroy + pure helper + _testables)
//   2. Defensive guards — mount returns false for null/undefined rootEl;
//      destroy idempotent; never throws on bad input
//   3. Pure helper: resolveBossElementClass — 5 stihiyas + casing +
//      whitespace + invalid input
//   4. Sacred-cow audit (module mirror) — all sacred 5-beat durations
//      byte-perfect:
//        - Beat 0 shake = 440ms (both vPlayBossDieFx + vPlayCritFlash)
//        - Beat 1 hit-pause = 300ms
//        - Beat 2 flash delay = 260ms + hold = 220ms
//        - Beat 4 zoom delay = 420ms
//        - vPlayCritFlash white-flash hold = 180ms
//   5. Sacred-cow audit (canonical regex-grep) — same values byte-perfect
//      against src/feel/animations.js (the sacred SHA1 baseline file
//      `41fd7ec0…`). Any drift trips CI.
//   6. Sacred element list audit — module mirror + canonical regex-grep
//      against src/data/elements.js (sacred SHA1 `edf0ab7…`)
//   7. Sacred element color hex audit — module mirror byte-perfect with
//      STIHIYA_COLORS in src/data/elements.js
//   8. Sacred class continuity audit — our new CSS does NOT REMOVE the
//      legacy sacred classes (.stagger-slow-mo, .v-fx-crit-flash,
//      .cell--engineer-welded, .phase-2, .phase-3). For the .v-fx-shake /
//      .boss-death-pause / .p-boss-death-flash / .boss-dissolve /
//      .boss-death-zoom classes we audit that our CSS ADDS overrides
//      (selectors present) but never resets / removes them.
//   9. animations.js signature parity — assert all exported function
//      names (vPlayLineClearBurst / vPlayCritFlash / vPlayBossDieFx /
//      vCleanupBossDeathFx / vPlayLevelPulse) are still present
//      (regression catch for accidental drift)
//  10. feel-layer discipline — boss-death-polish.js never imports from
//      src/core/ or src/data/

import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ANIMATIONS_PATH      = resolve(__dirname, '../../src/feel/animations.js');
const ELEMENTS_PATH        = resolve(__dirname, '../../src/data/elements.js');
const POLISH_CSS_PATH      = resolve(__dirname, '../../src/feel/boss-death-polish.css');
const POLISH_JS_PATH       = resolve(__dirname, '../../src/feel/boss-death-polish.js');

import {
  mountBossDeathPolish,
  destroyBossDeathPolish,
  resolveBossElementClass,
  _testables,
} from '../../src/feel/boss-death-polish.js';

// Clean state between tests — mount holds a module-local handle.
afterEach(() => {
  try { destroyBossDeathPolish(); } catch (_e) { /* defensive */ }
});

describe('TASK-CP-009 — module exports', () => {
  it('exports lifecycle functions (mount/destroy)', () => {
    expect(typeof mountBossDeathPolish).toBe('function');
    expect(typeof destroyBossDeathPolish).toBe('function');
  });

  it('exports resolveBossElementClass (pure helper)', () => {
    expect(typeof resolveBossElementClass).toBe('function');
  });

  it('exports a _testables hook with sacred constant mirrors', () => {
    expect(_testables).toBeDefined();
    expect(typeof _testables.SACRED_BOSS_DEATH_BEATS).toBe('object');
    expect(typeof _testables.SACRED_CRIT_FLASH_SHAKE_MS).toBe('number');
    expect(typeof _testables.SACRED_CRIT_FLASH_HOLD_MS).toBe('number');
    expect(typeof _testables.SACRED_BOSS_DEATH_CLASSES).toBe('object');
    expect(Array.isArray(_testables.SACRED_STIHIYAS)).toBe(true);
    expect(typeof _testables.SACRED_STIHIYA_COLORS).toBe('object');
    expect(typeof _testables.FLASH_CLASS_NAME).toBe('string');
    expect(typeof _testables.BOSS_ELEMENT_ATTR).toBe('string');
    expect(typeof _testables._getCurrentBossDeathPolish).toBe('function');
    expect(typeof _testables._applyBossElementAttr).toBe('function');
  });
});

describe('TASK-CP-009 — defensive guards', () => {
  it('mountBossDeathPolish returns false for null/undefined rootEl', () => {
    expect(mountBossDeathPolish(null)).toBe(false);
    expect(mountBossDeathPolish(undefined)).toBe(false);
  });

  it('destroyBossDeathPolish is idempotent (safe when not mounted)', () => {
    destroyBossDeathPolish();
    expect(() => destroyBossDeathPolish()).not.toThrow();
    expect(() => destroyBossDeathPolish()).not.toThrow();
  });

  it('_applyBossElementAttr never throws on bad input', () => {
    expect(() => _testables._applyBossElementAttr(null)).not.toThrow();
    expect(() => _testables._applyBossElementAttr(undefined)).not.toThrow();
    // No window.currentBoss in node — should silent no-op without throwing.
    const fakeEl = { setAttribute: () => { /* no-op */ } };
    expect(() => _testables._applyBossElementAttr(fakeEl)).not.toThrow();
  });
});

describe('TASK-CP-009 — resolveBossElementClass (pure helper)', () => {
  it('returns matching element for each sacred stihiya', () => {
    expect(resolveBossElementClass('ember')).toBe('ember');
    expect(resolveBossElementClass('tide')).toBe('tide');
    expect(resolveBossElementClass('grove')).toBe('grove');
    expect(resolveBossElementClass('solar')).toBe('solar');
    expect(resolveBossElementClass('umbra')).toBe('umbra');
  });

  it('is case-insensitive', () => {
    expect(resolveBossElementClass('EMBER')).toBe('ember');
    expect(resolveBossElementClass('Solar')).toBe('solar');
    expect(resolveBossElementClass('UmBrA')).toBe('umbra');
  });

  it('trims whitespace', () => {
    expect(resolveBossElementClass('  tide  ')).toBe('tide');
    expect(resolveBossElementClass('\tgrove\n')).toBe('grove');
  });

  it('returns null for unknown element strings', () => {
    expect(resolveBossElementClass('bogus')).toBe(null);
    expect(resolveBossElementClass('fire')).toBe(null);     // legacy term — not a stihiya
    expect(resolveBossElementClass('void')).toBe(null);
    expect(resolveBossElementClass('')).toBe(null);
  });

  it('returns null for non-string / falsy input (never throws)', () => {
    expect(resolveBossElementClass(null)).toBe(null);
    expect(resolveBossElementClass(undefined)).toBe(null);
    expect(resolveBossElementClass(42)).toBe(null);
    expect(resolveBossElementClass({})).toBe(null);
    expect(resolveBossElementClass([])).toBe(null);
    expect(resolveBossElementClass(true)).toBe(null);
  });
});

describe('TASK-CP-009 — sacred-cow audit · 5-beat durations (module mirror)', () => {
  it('Beat 0 shake = 440ms byte-perfect (vPlayBossDieFx)', () => {
    expect(_testables.SACRED_BOSS_DEATH_BEATS.SHAKE_MS).toBe(440);
  });
  it('Beat 1 hit-pause = 300ms byte-perfect', () => {
    expect(_testables.SACRED_BOSS_DEATH_BEATS.HIT_PAUSE_MS).toBe(300);
  });
  it('Beat 2 flash delay = 260ms byte-perfect', () => {
    expect(_testables.SACRED_BOSS_DEATH_BEATS.FLASH_DELAY_MS).toBe(260);
  });
  it('Beat 2 flash hold = 220ms byte-perfect', () => {
    expect(_testables.SACRED_BOSS_DEATH_BEATS.FLASH_HOLD_MS).toBe(220);
  });
  it('Beat 3 dissolve delay = 380ms byte-perfect', () => {
    expect(_testables.SACRED_BOSS_DEATH_BEATS.DISSOLVE_DELAY_MS).toBe(380);
  });
  it('Beat 4 zoom delay = 420ms byte-perfect', () => {
    expect(_testables.SACRED_BOSS_DEATH_BEATS.ZOOM_DELAY_MS).toBe(420);
  });
  it('SACRED_BOSS_DEATH_BEATS is frozen — sacred immutability guard', () => {
    expect(Object.isFrozen(_testables.SACRED_BOSS_DEATH_BEATS)).toBe(true);
  });
  it('vPlayCritFlash shake = 440ms byte-perfect (same as Beat 0)', () => {
    expect(_testables.SACRED_CRIT_FLASH_SHAKE_MS).toBe(440);
  });
  it('vPlayCritFlash white-flash hold = 180ms byte-perfect', () => {
    expect(_testables.SACRED_CRIT_FLASH_HOLD_MS).toBe(180);
  });
});

describe('TASK-CP-009 — sacred-cow audit · 5-beat durations (canonical regex-grep · animations.js)', () => {
  // Regex-grep on src/feel/animations.js — the sacred SHA1 baseline file
  // (`41fd7ec0…`). Any drift here is a sacred-cow violation and CI fail.

  it('can read src/feel/animations.js', () => {
    const src = readFileSync(ANIMATIONS_PATH, 'utf8');
    expect(src.length).toBeGreaterThan(0);
  });

  // ─── vPlayCritFlash beats (440 shake + 180 flash) ──────────────────────
  it('vPlayCritFlash white-flash hold = 180ms byte-perfect', () => {
    const src = readFileSync(ANIMATIONS_PATH, 'utf8');
    expect(src).toMatch(/document\.body\.classList\.remove\('v-fx-crit-flash'\),\s*180\)/);
  });
  it('vPlayCritFlash shake = 440ms byte-perfect', () => {
    const src = readFileSync(ANIMATIONS_PATH, 'utf8');
    expect(src).toMatch(/g\.classList\.remove\('v-fx-shake'\),\s*440\)/);
  });

  // ─── vPlayBossDieFx Beat 0 — shake 440ms ──────────────────────────────
  it('vPlayBossDieFx Beat 0 shake = 440ms byte-perfect', () => {
    const src = readFileSync(ANIMATIONS_PATH, 'utf8');
    expect(src).toMatch(/battle\.classList\.remove\('v-fx-shake'\),\s*440\)/);
  });

  // ─── vPlayBossDieFx Beat 1 — hit-pause 300ms ──────────────────────────
  it('vPlayBossDieFx Beat 1 hit-pause = 300ms byte-perfect', () => {
    const src = readFileSync(ANIMATIONS_PATH, 'utf8');
    expect(src).toMatch(/battle\.classList\.remove\('boss-death-pause'\),\s*300\)/);
  });

  // ─── vPlayBossDieFx Beat 2 — flash 260+220ms ──────────────────────────
  it('vPlayBossDieFx Beat 2 flash delay = 260ms byte-perfect', () => {
    const src = readFileSync(ANIMATIONS_PATH, 'utf8');
    // The flash setTimeout outer arg is 260ms; structure is:
    //   setTimeout(() => { ... setTimeout(() => flash.remove(), 220); }, 260);
    expect(src).toMatch(/}\s*,\s*260\)\s*;/);
  });
  it('vPlayBossDieFx Beat 2 flash hold = 220ms byte-perfect', () => {
    const src = readFileSync(ANIMATIONS_PATH, 'utf8');
    expect(src).toMatch(/setTimeout\(\(\) => flash\.remove\(\),\s*220\)/);
  });

  // ─── vPlayBossDieFx Beat 3 — dissolve delay 380ms ─────────────────────
  it('vPlayBossDieFx Beat 3 dissolve delay = 380ms byte-perfect', () => {
    const src = readFileSync(ANIMATIONS_PATH, 'utf8');
    expect(src).toMatch(/}\s*,\s*380\)\s*;/);
  });

  // ─── vPlayBossDieFx Beat 4 — zoom delay 420ms ─────────────────────────
  it('vPlayBossDieFx Beat 4 zoom delay = 420ms byte-perfect', () => {
    const src = readFileSync(ANIMATIONS_PATH, 'utf8');
    expect(src).toMatch(/}\s*,\s*420\)\s*;/);
  });

  // ─── Beat order — sacred sequence: shake → pause → flash → dissolve → zoom
  it('5-beat order preserved: shake → pause → flash → dissolve → zoom (sacred sequence)', () => {
    const src = readFileSync(ANIMATIONS_PATH, 'utf8');

    // Isolate the body of vPlayBossDieFx so vCleanupBossDeathFx's class
    // removals (which read 'boss-death-zoom' first, then 'boss-death-pause'
    // — reverse order) don't confuse the position checks.
    const fnStart = src.indexOf('export function vPlayBossDieFx');
    expect(fnStart).toBeGreaterThan(-1);
    const fnEnd = src.indexOf('export function vCleanupBossDeathFx', fnStart);
    expect(fnEnd).toBeGreaterThan(fnStart);
    const body = src.slice(fnStart, fnEnd);

    // Find the FIRST add() / appendChild / addClass occurrence of each
    // sacred class. The order of FIRST-occurrence in the function body
    // reflects the sacred 5-beat sequence.
    const idxShake    = body.indexOf("'v-fx-shake'");
    const idxPause    = body.indexOf("'boss-death-pause'");
    const idxFlash    = body.indexOf("'p-boss-death-flash'");
    const idxDissolve = body.indexOf("'boss-dissolve'");
    const idxZoom     = body.indexOf("'boss-death-zoom'");
    expect(idxShake).toBeGreaterThan(-1);
    expect(idxPause).toBeGreaterThan(-1);
    expect(idxFlash).toBeGreaterThan(-1);
    expect(idxDissolve).toBeGreaterThan(-1);
    expect(idxZoom).toBeGreaterThan(-1);

    expect(idxShake).toBeLessThan(idxPause);
    expect(idxPause).toBeLessThan(idxFlash);
    expect(idxFlash).toBeLessThan(idxDissolve);
    expect(idxDissolve).toBeLessThan(idxZoom);
  });
});

describe('TASK-CP-009 — sacred-cow audit · class names (module mirror)', () => {
  it("SACRED_BOSS_DEATH_CLASSES.SHAKE = 'v-fx-shake' byte-perfect", () => {
    expect(_testables.SACRED_BOSS_DEATH_CLASSES.SHAKE).toBe('v-fx-shake');
  });
  it("SACRED_BOSS_DEATH_CLASSES.HIT_PAUSE = 'boss-death-pause' byte-perfect", () => {
    expect(_testables.SACRED_BOSS_DEATH_CLASSES.HIT_PAUSE).toBe('boss-death-pause');
  });
  it("SACRED_BOSS_DEATH_CLASSES.FLASH = 'p-boss-death-flash' byte-perfect", () => {
    expect(_testables.SACRED_BOSS_DEATH_CLASSES.FLASH).toBe('p-boss-death-flash');
  });
  it("SACRED_BOSS_DEATH_CLASSES.DISSOLVE = 'boss-dissolve' byte-perfect", () => {
    expect(_testables.SACRED_BOSS_DEATH_CLASSES.DISSOLVE).toBe('boss-dissolve');
  });
  it("SACRED_BOSS_DEATH_CLASSES.ZOOM = 'boss-death-zoom' byte-perfect", () => {
    expect(_testables.SACRED_BOSS_DEATH_CLASSES.ZOOM).toBe('boss-death-zoom');
  });
  it('SACRED_BOSS_DEATH_CLASSES is frozen — sacred immutability guard', () => {
    expect(Object.isFrozen(_testables.SACRED_BOSS_DEATH_CLASSES)).toBe(true);
  });
});

describe('TASK-CP-009 — sacred-cow audit · stihiyas (module mirror)', () => {
  it("SACRED_STIHIYAS = ['ember','tide','grove','solar','umbra'] byte-perfect", () => {
    expect(_testables.SACRED_STIHIYAS).toEqual(['ember', 'tide', 'grove', 'solar', 'umbra']);
  });
  it('SACRED_STIHIYAS is frozen', () => {
    expect(Object.isFrozen(_testables.SACRED_STIHIYAS)).toBe(true);
  });

  it("STIHIYA_COLORS.ember = '#FF4D1F' byte-perfect", () => {
    expect(_testables.SACRED_STIHIYA_COLORS.ember).toBe('#FF4D1F');
  });
  it("STIHIYA_COLORS.tide = '#1FA3FF' byte-perfect", () => {
    expect(_testables.SACRED_STIHIYA_COLORS.tide).toBe('#1FA3FF');
  });
  it("STIHIYA_COLORS.grove = '#3DD66E' byte-perfect", () => {
    expect(_testables.SACRED_STIHIYA_COLORS.grove).toBe('#3DD66E');
  });
  it("STIHIYA_COLORS.solar = '#FFD53D' byte-perfect", () => {
    expect(_testables.SACRED_STIHIYA_COLORS.solar).toBe('#FFD53D');
  });
  it("STIHIYA_COLORS.umbra = '#8C3BFF' byte-perfect", () => {
    expect(_testables.SACRED_STIHIYA_COLORS.umbra).toBe('#8C3BFF');
  });
  it('SACRED_STIHIYA_COLORS is frozen', () => {
    expect(Object.isFrozen(_testables.SACRED_STIHIYA_COLORS)).toBe(true);
  });
});

describe('TASK-CP-009 — sacred-cow audit · stihiyas (canonical regex-grep · elements.js)', () => {
  // Regex-grep on src/data/elements.js — sacred SHA1 baseline `edf0ab7…`.

  it('can read src/data/elements.js', () => {
    const src = readFileSync(ELEMENTS_PATH, 'utf8');
    expect(src.length).toBeGreaterThan(0);
  });

  it("STIHIYAS = ['ember','tide','grove','solar','umbra'] byte-perfect (elements.js)", () => {
    const src = readFileSync(ELEMENTS_PATH, 'utf8');
    expect(src).toMatch(/export const STIHIYAS\s*=\s*Object\.freeze\(\['ember',\s*'tide',\s*'grove',\s*'solar',\s*'umbra'\]\);/);
  });

  it("STIHIYA_COLORS.ember = '#FF4D1F' byte-perfect (elements.js)", () => {
    const src = readFileSync(ELEMENTS_PATH, 'utf8');
    expect(src).toMatch(/ember:\s*'#FF4D1F'/);
  });
  it("STIHIYA_COLORS.tide = '#1FA3FF' byte-perfect (elements.js)", () => {
    const src = readFileSync(ELEMENTS_PATH, 'utf8');
    expect(src).toMatch(/tide:\s*'#1FA3FF'/);
  });
  it("STIHIYA_COLORS.grove = '#3DD66E' byte-perfect (elements.js)", () => {
    const src = readFileSync(ELEMENTS_PATH, 'utf8');
    expect(src).toMatch(/grove:\s*'#3DD66E'/);
  });
  it("STIHIYA_COLORS.solar = '#FFD53D' byte-perfect (elements.js)", () => {
    const src = readFileSync(ELEMENTS_PATH, 'utf8');
    expect(src).toMatch(/solar:\s*'#FFD53D'/);
  });
  it("STIHIYA_COLORS.umbra = '#8C3BFF' byte-perfect (elements.js)", () => {
    const src = readFileSync(ELEMENTS_PATH, 'utf8');
    expect(src).toMatch(/umbra:\s*'#8C3BFF'/);
  });
});

describe('TASK-CP-009 — sacred class continuity audit (CSS does not remove)', () => {
  // Sacred CSS classes that this task INTENTIONALLY overrides via additive
  // cascade. The polish CSS must add SELECTORS for these classes (the
  // overrides) but must not contain any rule that resets / unsets the
  // sacred animations / properties to neutral.

  // Strip /* … */ block comments so the audit reads CSS RULE BODY only —
  // prose mentions of sacred class names inside the file header / inline
  // rationale comments don't count as overrides.
  const cssRules = () => {
    const src = readFileSync(POLISH_CSS_PATH, 'utf8');
    return src.replace(/\/\*[\s\S]*?\*\//g, '');
  };

  it('polish CSS adds .v-fx-shake selector (Beat 0 amplitude curve)', () => {
    expect(cssRules()).toMatch(/\.v-fx-shake\s*\{/);
  });
  it('polish CSS adds .a-battle.boss-death-pause selector (Beat 1 desaturation)', () => {
    expect(cssRules()).toMatch(/\.a-battle\.boss-death-pause/);
  });
  it('polish CSS adds .p-boss-death-flash selector (Beat 2 themed flash)', () => {
    expect(cssRules()).toMatch(/\.p-boss-death-flash\s*\{/);
  });
  it('polish CSS adds .a-battle.boss-death-zoom selector (Beat 4 zoom)', () => {
    expect(cssRules()).toMatch(/\.a-battle\.boss-death-zoom/);
  });

  // Untouched sacred classes — polish CSS must NEVER select them in any
  // CSS rule (prose mentions inside comments are stripped above and are OK).
  it('polish CSS does NOT select .v-fx-crit-flash (sacred — untouched)', () => {
    expect(cssRules()).not.toMatch(/\.v-fx-crit-flash/);
  });
  it('polish CSS does NOT select .stagger-slow-mo (sacred — untouched)', () => {
    expect(cssRules()).not.toMatch(/\.stagger-slow-mo/);
  });
  it('polish CSS does NOT select .cell--engineer-welded (sacred — untouched)', () => {
    expect(cssRules()).not.toMatch(/\.cell--engineer-welded/);
  });
  it('polish CSS does NOT select .phase-2 (sacred — untouched)', () => {
    expect(cssRules()).not.toMatch(/\.phase-2(?![0-9a-z-])/);
  });
  it('polish CSS does NOT select .phase-3 (sacred — untouched)', () => {
    expect(cssRules()).not.toMatch(/\.phase-3(?![0-9a-z-])/);
  });

  // Sacred durations referenced via tokens (--p-beat-*) — must NOT use
  // raw literal millisecond values inside the polish CSS (single source of
  // truth: tokens.css for the existing beat durations, plus a single new
  // --p-beat-shake mirror constant defined ONCE in this sheet).
  it('polish CSS uses var(--p-beat-hit-pause) for Beat 1 (single source of truth)', () => {
    expect(cssRules()).toMatch(/var\(--p-beat-hit-pause\)/);
  });
  it('polish CSS uses var(--p-beat-zoom) for Beat 4 (single source of truth)', () => {
    expect(cssRules()).toMatch(/var\(--p-beat-zoom\)/);
  });
  it('polish CSS uses var(--p-beat-shake) for Beat 0 (single source of truth)', () => {
    expect(cssRules()).toMatch(/var\(--p-beat-shake\)/);
  });
  it('polish CSS defines --p-beat-shake = 440ms once (sacred mirror)', () => {
    expect(cssRules()).toMatch(/--p-beat-shake:\s*440ms\s*;/);
  });
});

describe('TASK-CP-009 — animations.js signature parity (sacred SHA1 file)', () => {
  it('vPlayBossDieFx is still exported from animations.js (sacred function)', () => {
    const src = readFileSync(ANIMATIONS_PATH, 'utf8');
    expect(src).toMatch(/export\s+function\s+vPlayBossDieFx\s*\(/);
  });
  it('vCleanupBossDeathFx is still exported (sacred function)', () => {
    const src = readFileSync(ANIMATIONS_PATH, 'utf8');
    expect(src).toMatch(/export\s+function\s+vCleanupBossDeathFx\s*\(/);
  });
  it('vPlayCritFlash is still exported (sacred function — shares 440ms shake)', () => {
    const src = readFileSync(ANIMATIONS_PATH, 'utf8');
    expect(src).toMatch(/export\s+function\s+vPlayCritFlash\s*\(/);
  });
  it('vPlayLineClearBurst is still exported (sacred function)', () => {
    const src = readFileSync(ANIMATIONS_PATH, 'utf8');
    expect(src).toMatch(/export\s+function\s+vPlayLineClearBurst\s*\(/);
  });
  it('vPlayLevelPulse is still exported (sacred function)', () => {
    const src = readFileSync(ANIMATIONS_PATH, 'utf8');
    expect(src).toMatch(/export\s+function\s+vPlayLevelPulse\s*\(/);
  });
});

describe('TASK-CP-009 — feel-layer discipline', () => {
  it('boss-death-polish.js never imports from src/core/', () => {
    const src = readFileSync(POLISH_JS_PATH, 'utf8');
    expect(src).not.toMatch(/from\s+['"][^'"]*\/core\//);
  });
  it('boss-death-polish.js never imports from src/data/', () => {
    const src = readFileSync(POLISH_JS_PATH, 'utf8');
    expect(src).not.toMatch(/from\s+['"][^'"]*\/data\//);
  });
  it('boss-death-polish.js never imports from src/services/', () => {
    const src = readFileSync(POLISH_JS_PATH, 'utf8');
    expect(src).not.toMatch(/from\s+['"][^'"]*\/services\//);
  });
  it('boss-death-polish.js never imports from src/feel/animations.js (sacred SHA1)', () => {
    const src = readFileSync(POLISH_JS_PATH, 'utf8');
    expect(src).not.toMatch(/from\s+['"][^'"]*animations(?:\.js)?['"]/);
  });
});
