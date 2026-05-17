// 2026-05-17 — TASK-CP-010 regression tests
//
// Locks the contract for Combat Polish Tier-3 reactivity event telegraphs
// polish module — the THIRD and FINAL Tier-3 Identity polish task that
// CLOSES the Combat Polish Identity-Complete gate. Polish refines the
// visual *content* of each archetype-specific reactivity banner (11
// archetypes × 2 phase gates = 22 handlers per BOSS_PHASES registry) +
// the 5 boss-reactive mechanics (Phoenix Ashen Reign / Lich Cursed Tiles
// / Berserker Bloodtide / Engineer Lockdown / Grovewarden Root Surge
// boss-side) while keeping ALL sacred timings + HARD CAPS byte-perfect.
//
// Coverage strategy (mirrors boss-death-polish.test.js / race-fx-polish
// .test.js precedent): Vitest runs in `node` env. DOM-state assertions
// belong to Playwright smoke tests. This file covers:
//
//   1. Module exports present (mount/update/destroy + pure helper +
//      _testables)
//   2. Defensive guards — mount returns false for null/undefined rootEl;
//      destroy idempotent; updateReactivityTelegraphs accepts undefined /
//      bad input without throwing
//   3. Pure helper: resolveArchetypeTheme — 11 archetypes + casing +
//      whitespace + hyphen-underscore normalization + invalid input
//   4. Sacred-cow audit (module mirror) — all sacred reactivity timings +
//      HARD CAPS byte-perfect:
//        - REACTIVITY_TELEGRAPH_MS = 3000
//        - REACTIVITY_PHASE_GATES = [70, 35]
//        - ASHEN_REIGN_DURATION_MS = 5000, TELEGRAPH_MS = 3000,
//          FLAME_BORDER_WIDTH_PX = 180, INITIAL_BUDGET_MS = 16,
//          STEADY_STATE_BUDGET_MS = 2
//        - CURSED_TILES_COUNT = 3, TURNS_UNTIL_AUTO_CLEAR = 3, glow
//          color #9B59E8
//        - BERSERKER_ENRAGE_MULT = 2.0
//        - Engineer copper #B87333 + 4-cell trigger
//        - Grove ROOT_SURGE_OVERLAY_COLOR = #2D8659
//   5. Sacred-cow audit (canonical regex-grep) — same values byte-
//      perfect against src/core/reactivity-events.js (sacred SHA1
//      `01c35963…`), src/core/bosses.js (sacred SHA1 `573273c…` — owns
//      REACTIVITY_TELEGRAPH_MS + BERSERKER_ENRAGE_MULT), and
//      src/data/identity-layer.js (sacred SHA1 `2edc3fe…`). Any drift
//      trips CI.
//   6. BOSS_PHASES registry — 26 boss keys present in canonical
//      reactivity-events.js (25 main campaign + VOIDFANG fallback).
//      Module mirror SACRED_BOSS_KEYS matches.
//   7. 11 archetype list — module mirror + canonical regex-grep against
//      BOSS_PHASES p1_p2 / p2_p3 reactivity strings.
//   8. Sacred class continuity audit — polish CSS does NOT REMOVE any
//      legacy sacred classes (.cell--engineer-welded / .phase-2 /
//      .phase-3 / .v-fx-shake / .v-fx-crit-flash / .stagger-slow-mo /
//      .boss-death-pause / .p-boss-death-flash). Where polish CSS DOES
//      reference a sacred class (.cell--engineer-welded for additive
//      ::after aura), the rule MUST be additive — no `animation: none`
//      / unset / initial declarations on the bare sacred selector.
//   9. reactivity-events.js + identity-layer.js signature parity —
//      assert exported sacred constants are still present (regression
//      catch for accidental drift)
//  10. feel-layer discipline — reactivity-telegraphs.js never imports
//      from src/core/, src/data/, src/services/, or src/feel/animations
//      .js / haptics.js / identity-fx.js (sacred-SHA1 baseline files)

import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REACTIVITY_EVENTS_PATH = resolve(__dirname, '../../src/core/reactivity-events.js');
const BOSSES_PATH            = resolve(__dirname, '../../src/core/bosses.js');
const IDENTITY_LAYER_PATH    = resolve(__dirname, '../../src/data/identity-layer.js');
const POLISH_CSS_PATH        = resolve(__dirname, '../../src/feel/reactivity-telegraphs.css');
const POLISH_JS_PATH         = resolve(__dirname, '../../src/feel/reactivity-telegraphs.js');

import {
  mountReactivityTelegraphs,
  updateReactivityTelegraphs,
  destroyReactivityTelegraphs,
  resolveArchetypeTheme,
  _testables,
} from '../../src/feel/reactivity-telegraphs.js';

// Clean state between tests — mount holds a module-local handle.
afterEach(() => {
  try { destroyReactivityTelegraphs(); } catch (_e) { /* defensive */ }
});

// ────────────────────────────────────────────────────────────────────────
// 1. Module exports
// ────────────────────────────────────────────────────────────────────────

describe('TASK-CP-010 — module exports', () => {
  it('exports lifecycle functions (mount/update/destroy)', () => {
    expect(typeof mountReactivityTelegraphs).toBe('function');
    expect(typeof updateReactivityTelegraphs).toBe('function');
    expect(typeof destroyReactivityTelegraphs).toBe('function');
  });

  it('exports resolveArchetypeTheme (pure helper)', () => {
    expect(typeof resolveArchetypeTheme).toBe('function');
  });

  it('exports a _testables hook with sacred constant mirrors', () => {
    expect(_testables).toBeDefined();
    expect(typeof _testables.SACRED_REACTIVITY_TIMINGS).toBe('object');
    expect(Array.isArray(_testables.SACRED_REACTIVITY_PHASE_GATES)).toBe(true);
    expect(typeof _testables.SACRED_ASHEN_REIGN).toBe('object');
    expect(typeof _testables.SACRED_LICH_CURSED_TILES).toBe('object');
    expect(typeof _testables.SACRED_BERSERKER_ENRAGE_MULT).toBe('number');
    expect(typeof _testables.SACRED_ENGINEER_LOCKDOWN).toBe('object');
    expect(typeof _testables.SACRED_GROVE_ROOT_SURGE).toBe('object');
    expect(Array.isArray(_testables.SACRED_ARCHETYPES)).toBe(true);
    expect(Array.isArray(_testables.SACRED_BOSS_KEYS)).toBe(true);
    expect(typeof _testables.SACRED_REACTIVITY_CLASSES).toBe('object');
    expect(Array.isArray(_testables.BANNER_SELECTORS)).toBe(true);
    expect(typeof _testables.BANNER_ARCHETYPE_ATTR).toBe('string');
    expect(typeof _testables.BANNER_REACTIVITY_ATTR).toBe('string');
    expect(typeof _testables._getCurrentReactivityTelegraphs).toBe('function');
    expect(typeof _testables._maybeStampBanner).toBe('function');
    expect(typeof _testables._resolveReactivityPhase).toBe('function');
  });
});

// ────────────────────────────────────────────────────────────────────────
// 2. Defensive guards
// ────────────────────────────────────────────────────────────────────────

describe('TASK-CP-010 — defensive guards', () => {
  it('mountReactivityTelegraphs returns false for null/undefined rootEl', () => {
    expect(mountReactivityTelegraphs(null)).toBe(false);
    expect(mountReactivityTelegraphs(undefined)).toBe(false);
  });

  it('destroyReactivityTelegraphs is idempotent (safe when not mounted)', () => {
    destroyReactivityTelegraphs();
    expect(() => destroyReactivityTelegraphs()).not.toThrow();
    expect(() => destroyReactivityTelegraphs()).not.toThrow();
  });

  it('updateReactivityTelegraphs never throws on bad / missing input', () => {
    expect(() => updateReactivityTelegraphs()).not.toThrow();
    expect(() => updateReactivityTelegraphs(null)).not.toThrow();
    expect(() => updateReactivityTelegraphs(undefined)).not.toThrow();
    expect(() => updateReactivityTelegraphs('not-an-object')).not.toThrow();
    expect(() => updateReactivityTelegraphs(42)).not.toThrow();
    expect(() => updateReactivityTelegraphs({})).not.toThrow();
    expect(() => updateReactivityTelegraphs({ archetype: 'bogus' })).not.toThrow();
  });

  it('_maybeStampBanner never throws on bad input', () => {
    expect(() => _testables._maybeStampBanner(null)).not.toThrow();
    expect(() => _testables._maybeStampBanner(undefined)).not.toThrow();
    expect(() => _testables._maybeStampBanner({})).not.toThrow();
    // El without classList — silent no-op.
    expect(() => _testables._maybeStampBanner({ classList: null })).not.toThrow();
  });

  it('_resolveReactivityPhase never throws + normalizes p1_p2 / p2_p3', () => {
    expect(_testables._resolveReactivityPhase('phoenix_p1_p2')).toBe('p1_p2');
    expect(_testables._resolveReactivityPhase('phoenix_p2_p3')).toBe('p2_p3');
    expect(_testables._resolveReactivityPhase('p1_p2')).toBe('p1_p2');
    expect(_testables._resolveReactivityPhase('p2_p3')).toBe('p2_p3');
    expect(_testables._resolveReactivityPhase('p1-p2')).toBe('p1_p2');
    expect(_testables._resolveReactivityPhase('bogus')).toBe(null);
    expect(_testables._resolveReactivityPhase(null)).toBe(null);
    expect(_testables._resolveReactivityPhase(undefined)).toBe(null);
    expect(_testables._resolveReactivityPhase(42)).toBe(null);
    expect(_testables._resolveReactivityPhase('')).toBe(null);
  });
});

// ────────────────────────────────────────────────────────────────────────
// 3. resolveArchetypeTheme — pure helper
// ────────────────────────────────────────────────────────────────────────

describe('TASK-CP-010 — resolveArchetypeTheme (pure helper)', () => {
  it('returns matching archetype for each of 11 sacred archetypes', () => {
    expect(resolveArchetypeTheme('berserker')).toBe('berserker');
    expect(resolveArchetypeTheme('armored')).toBe('armored');
    expect(resolveArchetypeTheme('bruiser')).toBe('bruiser');
    expect(resolveArchetypeTheme('phoenix')).toBe('phoenix');
    expect(resolveArchetypeTheme('assassin')).toBe('assassin');
    expect(resolveArchetypeTheme('hypnotist')).toBe('hypnotist');
    expect(resolveArchetypeTheme('engineer')).toBe('engineer');
    expect(resolveArchetypeTheme('frenzy')).toBe('frenzy');
    expect(resolveArchetypeTheme('tempo_disruptor')).toBe('tempo_disruptor');
    expect(resolveArchetypeTheme('battery')).toBe('battery');
    expect(resolveArchetypeTheme('tower_voidfang')).toBe('tower_voidfang');
  });

  it('is case-insensitive', () => {
    expect(resolveArchetypeTheme('BERSERKER')).toBe('berserker');
    expect(resolveArchetypeTheme('Phoenix')).toBe('phoenix');
    expect(resolveArchetypeTheme('EnGiNeEr')).toBe('engineer');
  });

  it('trims whitespace', () => {
    expect(resolveArchetypeTheme('  berserker  ')).toBe('berserker');
    expect(resolveArchetypeTheme('\tphoenix\n')).toBe('phoenix');
  });

  it('normalizes hyphen → underscore (tempo-disruptor → tempo_disruptor)', () => {
    expect(resolveArchetypeTheme('tempo-disruptor')).toBe('tempo_disruptor');
    expect(resolveArchetypeTheme('tower-voidfang')).toBe('tower_voidfang');
  });

  it('returns null for unknown archetype strings', () => {
    expect(resolveArchetypeTheme('bogus')).toBe(null);
    expect(resolveArchetypeTheme('tank')).toBe(null);
    expect(resolveArchetypeTheme('warrior')).toBe(null);
    expect(resolveArchetypeTheme('')).toBe(null);
  });

  it('returns null for non-string / falsy input (never throws)', () => {
    expect(resolveArchetypeTheme(null)).toBe(null);
    expect(resolveArchetypeTheme(undefined)).toBe(null);
    expect(resolveArchetypeTheme(42)).toBe(null);
    expect(resolveArchetypeTheme({})).toBe(null);
    expect(resolveArchetypeTheme([])).toBe(null);
    expect(resolveArchetypeTheme(true)).toBe(null);
  });
});

// ────────────────────────────────────────────────────────────────────────
// 4. Sacred-cow audit — module mirror
// ────────────────────────────────────────────────────────────────────────

describe('TASK-CP-010 — sacred-cow audit · reactivity timings (module mirror)', () => {
  it('REACTIVITY_TELEGRAPH_MS = 3000 byte-perfect', () => {
    expect(_testables.SACRED_REACTIVITY_TIMINGS.TELEGRAPH_MS).toBe(3000);
  });
  it('SACRED_REACTIVITY_TIMINGS is frozen', () => {
    expect(Object.isFrozen(_testables.SACRED_REACTIVITY_TIMINGS)).toBe(true);
  });
  it('REACTIVITY_PHASE_GATES = [70, 35] byte-perfect', () => {
    expect(_testables.SACRED_REACTIVITY_PHASE_GATES).toEqual([70, 35]);
  });
  it('SACRED_REACTIVITY_PHASE_GATES is frozen', () => {
    expect(Object.isFrozen(_testables.SACRED_REACTIVITY_PHASE_GATES)).toBe(true);
  });
});

describe('TASK-CP-010 — sacred-cow audit · Phoenix Ashen Reign (module mirror)', () => {
  it('ASHEN_REIGN_DURATION_MS = 5000 byte-perfect', () => {
    expect(_testables.SACRED_ASHEN_REIGN.DURATION_MS).toBe(5000);
  });
  it('ASHEN_REIGN_TELEGRAPH_MS = 3000 byte-perfect (mirrors REACTIVITY_TELEGRAPH_MS)', () => {
    expect(_testables.SACRED_ASHEN_REIGN.TELEGRAPH_MS).toBe(3000);
  });
  it('ASHEN_REIGN_FLAME_BORDER_WIDTH_PX = 180 byte-perfect', () => {
    expect(_testables.SACRED_ASHEN_REIGN.FLAME_BORDER_WIDTH_PX).toBe(180);
  });
  it('ASHEN_REIGN_INITIAL_BUDGET_MS = 16 byte-perfect (perf budget)', () => {
    expect(_testables.SACRED_ASHEN_REIGN.INITIAL_BUDGET_MS).toBe(16);
  });
  it('ASHEN_REIGN_STEADY_STATE_BUDGET_MS = 2 byte-perfect (perf budget)', () => {
    expect(_testables.SACRED_ASHEN_REIGN.STEADY_STATE_BUDGET_MS).toBe(2);
  });
  it("ASHEN_REIGN_REQUIRED_ELEMENT = 'ember' byte-perfect", () => {
    expect(_testables.SACRED_ASHEN_REIGN.REQUIRED_ELEMENT).toBe('ember');
  });
  it('SACRED_ASHEN_REIGN is frozen — sacred immutability guard', () => {
    expect(Object.isFrozen(_testables.SACRED_ASHEN_REIGN)).toBe(true);
  });
});

describe('TASK-CP-010 — sacred-cow audit · Lich Cursed Tiles (module mirror)', () => {
  it('CURSED_TILES_COUNT = 3 byte-perfect', () => {
    expect(_testables.SACRED_LICH_CURSED_TILES.COUNT).toBe(3);
  });
  it('CURSED_TILES_TURNS_UNTIL_AUTO_CLEAR = 3 byte-perfect', () => {
    expect(_testables.SACRED_LICH_CURSED_TILES.TURNS_UNTIL_AUTO_CLEAR).toBe(3);
  });
  it("CURSED_TILES glow color = '#9B59E8' (matches VOID damage family)", () => {
    expect(_testables.SACRED_LICH_CURSED_TILES.GLOW_COLOR).toBe('#9B59E8');
  });
  it('SACRED_LICH_CURSED_TILES is frozen', () => {
    expect(Object.isFrozen(_testables.SACRED_LICH_CURSED_TILES)).toBe(true);
  });
});

describe('TASK-CP-010 — sacred-cow audit · Berserker Bloodtide (module mirror)', () => {
  it('BERSERKER_ENRAGE_MULT = 2.0 byte-perfect', () => {
    expect(_testables.SACRED_BERSERKER_ENRAGE_MULT).toBe(2.0);
  });
});

describe('TASK-CP-010 — sacred-cow audit · Engineer Lockdown (module mirror)', () => {
  it('ENGINEER_LOCKDOWN_COLOR = "#B87333" byte-perfect (copper/bronze sacred)', () => {
    expect(_testables.SACRED_ENGINEER_LOCKDOWN.COLOR).toBe('#B87333');
  });
  it('ENGINEER_LOCKDOWN trigger lines = 4 byte-perfect (anti-Tetris gate)', () => {
    expect(_testables.SACRED_ENGINEER_LOCKDOWN.TRIGGER_LINES).toBe(4);
  });
  it('SACRED_ENGINEER_LOCKDOWN is frozen', () => {
    expect(Object.isFrozen(_testables.SACRED_ENGINEER_LOCKDOWN)).toBe(true);
  });
});

describe('TASK-CP-010 — sacred-cow audit · Grovewarden Root Surge (module mirror)', () => {
  it('ROOT_SURGE_OVERLAY_COLOR = "#2D8659" byte-perfect (mossy green)', () => {
    expect(_testables.SACRED_GROVE_ROOT_SURGE.OVERLAY_COLOR).toBe('#2D8659');
  });
  it('SACRED_GROVE_ROOT_SURGE is frozen', () => {
    expect(Object.isFrozen(_testables.SACRED_GROVE_ROOT_SURGE)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────
// 5. Sacred-cow audit — canonical regex-grep
// ────────────────────────────────────────────────────────────────────────

describe('TASK-CP-010 — sacred-cow audit · canonical regex-grep · bosses.js (REACTIVITY_TELEGRAPH_MS + BERSERKER_ENRAGE_MULT)', () => {
  it('can read src/core/bosses.js', () => {
    const src = readFileSync(BOSSES_PATH, 'utf8');
    expect(src.length).toBeGreaterThan(0);
  });

  it('REACTIVITY_TELEGRAPH_MS = 3000 byte-perfect (bosses.js)', () => {
    const src = readFileSync(BOSSES_PATH, 'utf8');
    expect(src).toMatch(/export\s+const\s+REACTIVITY_TELEGRAPH_MS\s*=\s*3000\b/);
  });

  it('BERSERKER_ENRAGE_MULT = 2.0 byte-perfect (bosses.js)', () => {
    const src = readFileSync(BOSSES_PATH, 'utf8');
    expect(src).toMatch(/export\s+const\s+BERSERKER_ENRAGE_MULT\s*=\s*2\.0\b/);
  });
});

describe('TASK-CP-010 — sacred-cow audit · canonical regex-grep · reactivity-events.js (REACTIVITY_PHASE_GATES + BOSS_PHASES)', () => {
  it('can read src/core/reactivity-events.js', () => {
    const src = readFileSync(REACTIVITY_EVENTS_PATH, 'utf8');
    expect(src.length).toBeGreaterThan(0);
  });

  it('REACTIVITY_PHASE_GATES = Object.freeze([70, 35]) byte-perfect', () => {
    const src = readFileSync(REACTIVITY_EVENTS_PATH, 'utf8');
    expect(src).toMatch(/export\s+const\s+REACTIVITY_PHASE_GATES\s*=\s*Object\.freeze\(\[70,\s*35\]\);/);
  });

  it('BOSS_PHASES is an exported const object', () => {
    const src = readFileSync(REACTIVITY_EVENTS_PATH, 'utf8');
    expect(src).toMatch(/export\s+const\s+BOSS_PHASES\s*=\s*\{/);
  });

  // ─── 26 boss keys — 25 main campaign + VOIDFANG fallback ───
  const SACRED_BOSS_KEYS_CANONICAL = [
    'PYREDRAKE', 'ABYSSAL TYRANT', 'GROVEWARDEN', 'SOLAR PHOENIX', 'CRYPT LICH',
    'VEROTHIRA', 'GEARHEART', 'URSARO', 'TIDESPIRE', 'HELIOTRON',
    'TWILIGHT VESSEL', 'STORMSHEPHERD', 'VOIDPRIESTESS', 'ROOT-OF-NOTHING', 'ARCHIVAL ETERNAL',
    'THE PROSECUTOR', 'JUSTICE BLIND', 'SUN-CROWN REGENT', 'ECLIPSE-WALKER', 'THE FALLEN HIGHEST',
    'CROWN-OF-DUST', 'SHARDLORD', 'SEEDREAPER', 'PYREKING', 'WORLD-EATER',
    'VOIDFANG',
  ];

  for (const bossKey of SACRED_BOSS_KEYS_CANONICAL) {
    it(`BOSS_PHASES contains '${bossKey}' boss key (sacred registry entry)`, () => {
      const src = readFileSync(REACTIVITY_EVENTS_PATH, 'utf8');
      // Match e.g. 'PYREDRAKE': [...] (allow flexible whitespace; quotes
      // around the key).
      const safe = bossKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`'${safe}'\\s*:\\s*\\[`);
      expect(src).toMatch(re);
    });
  }

  it('module mirror SACRED_BOSS_KEYS matches canonical 26-entry list byte-perfect', () => {
    expect(_testables.SACRED_BOSS_KEYS).toEqual(SACRED_BOSS_KEYS_CANONICAL);
  });

  it('SACRED_BOSS_KEYS is frozen', () => {
    expect(Object.isFrozen(_testables.SACRED_BOSS_KEYS)).toBe(true);
  });

  // ─── 11 archetypes — every p1_p2 / p2_p3 reactivity string ───
  const SACRED_ARCHETYPES_CANONICAL = [
    'berserker', 'armored', 'bruiser', 'phoenix', 'assassin',
    'hypnotist', 'engineer', 'frenzy', 'tempo_disruptor', 'battery',
    'tower_voidfang',
  ];

  for (const archetype of SACRED_ARCHETYPES_CANONICAL) {
    it(`reactivity-events.js BOSS_PHASES references '${archetype}_p1_p2' (sacred reactivity string)`, () => {
      const src = readFileSync(REACTIVITY_EVENTS_PATH, 'utf8');
      const safe = archetype.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`reactivity:\\s*'${safe}_p1_p2'`);
      expect(src).toMatch(re);
    });
    it(`reactivity-events.js BOSS_PHASES references '${archetype}_p2_p3' (sacred reactivity string)`, () => {
      const src = readFileSync(REACTIVITY_EVENTS_PATH, 'utf8');
      const safe = archetype.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`reactivity:\\s*'${safe}_p2_p3'`);
      expect(src).toMatch(re);
    });
  }

  it('module mirror SACRED_ARCHETYPES matches canonical 11-entry list byte-perfect', () => {
    expect(_testables.SACRED_ARCHETYPES).toEqual(SACRED_ARCHETYPES_CANONICAL);
  });

  it('SACRED_ARCHETYPES is frozen', () => {
    expect(Object.isFrozen(_testables.SACRED_ARCHETYPES)).toBe(true);
  });
});

describe('TASK-CP-010 — sacred-cow audit · canonical regex-grep · identity-layer.js (5 boss-reactive HARD CAPS)', () => {
  it('can read src/data/identity-layer.js', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src.length).toBeGreaterThan(0);
  });

  // ─── Phoenix Ashen Reign ───
  it('ASHEN_REIGN_DURATION_MS = 5000 byte-perfect (identity-layer.js)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export\s+const\s+ASHEN_REIGN_DURATION_MS\s*=\s*5000\b/);
  });
  it('ASHEN_REIGN_FLAME_BORDER_WIDTH_PX = 180 byte-perfect (identity-layer.js)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export\s+const\s+ASHEN_REIGN_FLAME_BORDER_WIDTH_PX\s*=\s*180\b/);
  });
  it('ASHEN_REIGN_TELEGRAPH_MS = 3000 byte-perfect (identity-layer.js)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export\s+const\s+ASHEN_REIGN_TELEGRAPH_MS\s*=\s*3000\b/);
  });
  it('ASHEN_REIGN_INITIAL_BUDGET_MS = 16 byte-perfect (identity-layer.js)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export\s+const\s+ASHEN_REIGN_INITIAL_BUDGET_MS\s*=\s*16\b/);
  });
  it('ASHEN_REIGN_STEADY_STATE_BUDGET_MS = 2 byte-perfect (identity-layer.js)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export\s+const\s+ASHEN_REIGN_STEADY_STATE_BUDGET_MS\s*=\s*2\b/);
  });

  // ─── Lich Cursed Tiles ───
  it('CURSED_TILES_COUNT = 3 byte-perfect (identity-layer.js)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export\s+const\s+CURSED_TILES_COUNT\s*=\s*3\b/);
  });
  it('CURSED_TILES_TURNS_UNTIL_AUTO_CLEAR = 3 byte-perfect (identity-layer.js)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export\s+const\s+CURSED_TILES_TURNS_UNTIL_AUTO_CLEAR\s*=\s*3\b/);
  });

  // ─── Engineer Lockdown ───
  it('ENGINEER_LOCKDOWN_COLOR = "#B87333" byte-perfect (identity-layer.js)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export\s+const\s+ENGINEER_LOCKDOWN_COLOR\s*=\s*'#B87333'/);
  });

  // ─── Grovewarden Root Surge ───
  it('ROOT_SURGE_OVERLAY_COLOR = "#2D8659" byte-perfect (identity-layer.js)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export\s+const\s+ROOT_SURGE_OVERLAY_COLOR\s*=\s*'#2D8659'/);
  });
});

// ────────────────────────────────────────────────────────────────────────
// 6. Sacred class continuity audit (CSS does not remove)
// ────────────────────────────────────────────────────────────────────────

describe('TASK-CP-010 — sacred CSS class continuity audit (polish CSS)', () => {
  // Strip /* … */ block comments so the audit reads CSS RULE BODY only —
  // prose mentions of sacred class names inside the file header / inline
  // rationale comments don't count as overrides.
  const cssRules = () => {
    const src = readFileSync(POLISH_CSS_PATH, 'utf8');
    return src.replace(/\/\*[\s\S]*?\*\//g, '');
  };

  // ─── Untouched sacred classes — polish CSS must NEVER select them in
  //     any rule (prose mentions inside comments are stripped above). ───
  it('polish CSS does NOT select .v-fx-shake (sacred — untouched)', () => {
    expect(cssRules()).not.toMatch(/\.v-fx-shake/);
  });
  it('polish CSS does NOT select .v-fx-crit-flash (sacred — untouched)', () => {
    expect(cssRules()).not.toMatch(/\.v-fx-crit-flash/);
  });
  it('polish CSS does NOT select .stagger-slow-mo (sacred — untouched)', () => {
    expect(cssRules()).not.toMatch(/\.stagger-slow-mo/);
  });
  it('polish CSS does NOT select .boss-death-pause (sacred — untouched)', () => {
    expect(cssRules()).not.toMatch(/\.boss-death-pause/);
  });
  it('polish CSS does NOT select .p-boss-death-flash (sacred — untouched)', () => {
    expect(cssRules()).not.toMatch(/\.p-boss-death-flash/);
  });
  it('polish CSS does NOT select .phase-2 (sacred — untouched)', () => {
    expect(cssRules()).not.toMatch(/\.phase-2(?![0-9a-z-])/);
  });
  it('polish CSS does NOT select .phase-3 (sacred — untouched)', () => {
    expect(cssRules()).not.toMatch(/\.phase-3(?![0-9a-z-])/);
  });

  // ─── .cell--engineer-welded — polish ADDS an ::after aura. The base
  //     selector + the legacy ::before icon are NOT redefined. ───
  it('polish CSS adds .cell--engineer-welded::after aura (additive ::after override)', () => {
    expect(cssRules()).toMatch(/\.cell--engineer-welded::after/);
  });
  it('polish CSS does NOT redefine .cell--engineer-welded::before (legacy ⚙ icon preserved)', () => {
    expect(cssRules()).not.toMatch(/\.cell--engineer-welded::before/);
  });
  it('polish CSS does NOT use `animation: none` / `unset` on bare .cell--engineer-welded', () => {
    const rules = cssRules();
    // The bare selector .cell--engineer-welded { ... } body must NOT
    // disable / reset the legacy keyframe. We extract the bare rule and
    // assert no `animation: none` / `unset` / `initial` inside it.
    const bareRule = rules.match(/\.cell\.cell--engineer-welded\s*\{[^}]*\}/g) || [];
    for (const rule of bareRule) {
      expect(rule).not.toMatch(/animation\s*:\s*none/);
      expect(rule).not.toMatch(/animation\s*:\s*unset/);
      expect(rule).not.toMatch(/animation\s*:\s*initial/);
    }
  });

  // ─── Sacred banner classes ARE selected — but only as scoped data-
  //     attribute themes, never as bare overrides. ───
  it('polish CSS adds .state-banner archetype-themed selectors (data-archetype scoped)', () => {
    expect(cssRules()).toMatch(/\.state-banner\[data-archetype=/);
  });
  it('polish CSS adds .threat-banner archetype-themed selectors (data-archetype scoped)', () => {
    expect(cssRules()).toMatch(/\.threat-banner\[data-archetype=/);
  });

  // ─── 11 archetypes — each must have a data-archetype rule ───
  const ALL_ARCHETYPES_FOR_CSS = [
    'berserker', 'armored', 'bruiser', 'phoenix', 'assassin',
    'hypnotist', 'engineer', 'frenzy', 'tempo_disruptor', 'battery',
    'tower_voidfang',
  ];
  for (const archetype of ALL_ARCHETYPES_FOR_CSS) {
    it(`polish CSS adds [data-archetype="${archetype}"] theme rule`, () => {
      const re = new RegExp(`data-archetype="${archetype}"`);
      expect(cssRules()).toMatch(re);
    });
  }

  // ─── 5 boss-reactive polish targets — all 5 mechanics referenced ───
  it('polish CSS adds .identity-phoenix-ashen-reign-border refinement (Phoenix)', () => {
    expect(cssRules()).toMatch(/\.identity-phoenix-ashen-reign-border/);
  });
  it('polish CSS adds .identity-lich-cursed-tile refinement (Lich)', () => {
    expect(cssRules()).toMatch(/\.identity-lich-cursed-tile/);
  });
  it('polish CSS adds .identity-bloodtide-pulse refinement (Berserker)', () => {
    expect(cssRules()).toMatch(/\.identity-bloodtide-pulse/);
  });
  it('polish CSS adds .cell--engineer-welded refinement (Engineer)', () => {
    expect(cssRules()).toMatch(/\.cell--engineer-welded/);
  });
  it('polish CSS adds .identity-grovewarden-root-overlay refinement (Grovewarden)', () => {
    expect(cssRules()).toMatch(/\.identity-grovewarden-root-overlay/);
  });

  // ─── Sacred timing mirror — telegraph + flame-width single source of truth ───
  it('polish CSS defines --p-reactivity-telegraph = 3000ms once (sacred mirror)', () => {
    expect(cssRules()).toMatch(/--p-reactivity-telegraph:\s*3000ms\s*;/);
  });
  it('polish CSS defines --p-ashen-flame-width = 180px once (sacred mirror)', () => {
    expect(cssRules()).toMatch(/--p-ashen-flame-width:\s*180px\s*;/);
  });

  // ─── Sacred engineer copper #B87333 byte-perfect (case-insensitive — CSS) ───
  it('polish CSS references sacred engineer copper rgba(184, 115, 51) (== #B87333)', () => {
    // The polish sheet uses rgba(184, 115, 51, …) so #B87333 stays
    // referenced via decimal equivalents. 184 / 115 / 51 hex == B8 / 73
    // / 33 — sacred decomposition byte-perfect.
    expect(cssRules()).toMatch(/rgba\(\s*184\s*,\s*115\s*,\s*51\s*,/);
  });

  // ─── prefers-reduced-motion respected ───
  it('polish CSS respects prefers-reduced-motion (kinetic ornament dial-back)', () => {
    expect(cssRules()).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/);
  });
});

// ────────────────────────────────────────────────────────────────────────
// 7. Sacred SHA1 baseline signature parity — sacred exports still present
// ────────────────────────────────────────────────────────────────────────

describe('TASK-CP-010 — sacred export parity (reactivity-events.js + identity-layer.js)', () => {
  it('reactivity-events.js still exports REACTIVITY_PHASE_GATES (sacred)', () => {
    const src = readFileSync(REACTIVITY_EVENTS_PATH, 'utf8');
    expect(src).toMatch(/export\s+const\s+REACTIVITY_PHASE_GATES\b/);
  });
  it('reactivity-events.js still re-exports REACTIVITY_TELEGRAPH_MS (sacred)', () => {
    const src = readFileSync(REACTIVITY_EVENTS_PATH, 'utf8');
    expect(src).toMatch(/export\s*\{[^}]*REACTIVITY_TELEGRAPH_MS[^}]*\}/);
  });
  it('reactivity-events.js still exports BOSS_PHASES (sacred)', () => {
    const src = readFileSync(REACTIVITY_EVENTS_PATH, 'utf8');
    expect(src).toMatch(/export\s+const\s+BOSS_PHASES\b/);
  });
  it('identity-layer.js still exports ASHEN_REIGN_DURATION_MS (sacred)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export\s+const\s+ASHEN_REIGN_DURATION_MS\b/);
  });
  it('identity-layer.js still exports ASHEN_REIGN_FLAME_BORDER_WIDTH_PX (sacred)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export\s+const\s+ASHEN_REIGN_FLAME_BORDER_WIDTH_PX\b/);
  });
  it('identity-layer.js still exports CURSED_TILES_COUNT (sacred)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export\s+const\s+CURSED_TILES_COUNT\b/);
  });
  it('identity-layer.js still exports ENGINEER_LOCKDOWN_COLOR (sacred)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export\s+const\s+ENGINEER_LOCKDOWN_COLOR\b/);
  });
  it('identity-layer.js still exports ROOT_SURGE_OVERLAY_COLOR (sacred)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export\s+const\s+ROOT_SURGE_OVERLAY_COLOR\b/);
  });
  it('bosses.js still exports BERSERKER_ENRAGE_MULT (sacred)', () => {
    const src = readFileSync(BOSSES_PATH, 'utf8');
    expect(src).toMatch(/export\s+const\s+BERSERKER_ENRAGE_MULT\b/);
  });
});

// ────────────────────────────────────────────────────────────────────────
// 8. Feel-layer discipline
// ────────────────────────────────────────────────────────────────────────

describe('TASK-CP-010 — feel-layer discipline', () => {
  it('reactivity-telegraphs.js never imports from src/core/', () => {
    const src = readFileSync(POLISH_JS_PATH, 'utf8');
    expect(src).not.toMatch(/from\s+['"][^'"]*\/core\//);
  });
  it('reactivity-telegraphs.js never imports from src/data/', () => {
    const src = readFileSync(POLISH_JS_PATH, 'utf8');
    expect(src).not.toMatch(/from\s+['"][^'"]*\/data\//);
  });
  it('reactivity-telegraphs.js never imports from src/services/', () => {
    const src = readFileSync(POLISH_JS_PATH, 'utf8');
    expect(src).not.toMatch(/from\s+['"][^'"]*\/services\//);
  });
  it('reactivity-telegraphs.js never imports from src/feel/animations.js (sacred SHA1)', () => {
    const src = readFileSync(POLISH_JS_PATH, 'utf8');
    expect(src).not.toMatch(/from\s+['"][^'"]*animations(?:\.js)?['"]/);
  });
  it('reactivity-telegraphs.js never imports from src/feel/haptics.js (sacred SHA1)', () => {
    const src = readFileSync(POLISH_JS_PATH, 'utf8');
    expect(src).not.toMatch(/from\s+['"][^'"]*haptics(?:\.js)?['"]/);
  });
  it('reactivity-telegraphs.js never imports from src/feel/identity-fx.js (sacred SHA1)', () => {
    const src = readFileSync(POLISH_JS_PATH, 'utf8');
    // The polish module imports from src/feel/reactivity-telegraphs.js
    // only (its own file is the home). It must NOT pull identity-fx.
    expect(src).not.toMatch(/from\s+['"][^'"]*identity-fx['"]/);
  });
});

// ────────────────────────────────────────────────────────────────────────
// 9. Mount/update lifecycle — minimal smoke
// ────────────────────────────────────────────────────────────────────────

describe('TASK-CP-010 — lifecycle smoke (mount/update/destroy)', () => {
  it('mount with a non-null el succeeds (returns true) when document.body absent', () => {
    // Node env — no document.body. Module short-circuits to no-observer
    // state but still records mount handle.
    const fakeEl = { tagName: 'DIV' };
    const result = mountReactivityTelegraphs(fakeEl);
    expect(result).toBe(true);
    expect(_testables._getCurrentReactivityTelegraphs()).not.toBe(null);
    destroyReactivityTelegraphs();
    expect(_testables._getCurrentReactivityTelegraphs()).toBe(null);
  });

  it('mount idempotent — second call returns false (already mounted)', () => {
    const fakeEl = { tagName: 'DIV' };
    expect(mountReactivityTelegraphs(fakeEl)).toBe(true);
    expect(mountReactivityTelegraphs(fakeEl)).toBe(false);
  });

  it('update after mount with archetype state updates internal handle', () => {
    const fakeEl = { tagName: 'DIV' };
    mountReactivityTelegraphs(fakeEl);
    updateReactivityTelegraphs({ archetype: 'phoenix' });
    expect(_testables._getCurrentReactivityTelegraphs().archetype).toBe('phoenix');
    updateReactivityTelegraphs({ archetype: 'BOGUS' });
    // Bogus → null (silent no-op resolution).
    expect(_testables._getCurrentReactivityTelegraphs().archetype).toBe(null);
  });

  it('update with reactivityPhase normalizes to p1_p2 / p2_p3', () => {
    const fakeEl = { tagName: 'DIV' };
    mountReactivityTelegraphs(fakeEl);
    updateReactivityTelegraphs({ reactivityPhase: 'phoenix_p1_p2' });
    expect(_testables._getCurrentReactivityTelegraphs().reactivityPhase).toBe('p1_p2');
    updateReactivityTelegraphs({ reactivityPhase: 'p2_p3' });
    expect(_testables._getCurrentReactivityTelegraphs().reactivityPhase).toBe('p2_p3');
  });

  it('initial state seed via mount(rootEl, state)', () => {
    const fakeEl = { tagName: 'DIV' };
    mountReactivityTelegraphs(fakeEl, { archetype: 'engineer', reactivityPhase: 'p2_p3' });
    expect(_testables._getCurrentReactivityTelegraphs().archetype).toBe('engineer');
    expect(_testables._getCurrentReactivityTelegraphs().reactivityPhase).toBe('p2_p3');
  });
});
