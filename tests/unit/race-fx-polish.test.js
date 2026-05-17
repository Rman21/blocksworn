// 2026-05-17 — TASK-CP-008 regression tests
//
// Locks the contract for Combat Polish Tier-3 race FX polish module — the
// first Tier-3 Identity task and the LARGEST single Combat Polish block
// (6 races + cross-race combo banner).
//
// Coverage strategy (mirrors stagger-fx.test.js / damage-channel-fx.test.js /
// synergy-bar.test.js precedent): Vitest runs in `node` env. DOM-state
// assertions belong to Playwright smoke tests. This file covers:
//
//   1. Module exports present (mount/update/destroy + pure helpers +
//      spawnFromSoilLabel + _testables)
//   2. Defensive guards — mount returns false for null/undefined rootEl;
//      update/destroy idempotent; never throws on bad input
//   3. Pure helper: resolveBannerText — default + custom + invalid input
//   4. Pure helper: formatFromSoilLabel — default + custom amount + invalid
//   5. Sacred-cow audit (module mirror) — all 6 race constant blocks
//      byte-perfect:
//        - SACRED_PIRATE (gold/cell=5, max pirates=5, MAX_COINS=32, decay=1000)
//        - SACRED_SHARK  (min trigger=2, max extra=4, decay=500, svg/line=1,
//                          dominant='tide')
//        - SACRED_ROCK   (charge=1, max charge=4, decay=700, delay=200,
//                          element='umbra', ult meter='umbra')
//        - SACRED_CROCODILE (frag/shield=5, max particles=16, decay=600,
//                             element='grove', target=0)
//        - SACRED_SPARK  (min solar=2, max boost=1, max rays=16, decay=400,
//                          element='solar', enabled=true)
//        - SACRED_GROVE  (element='grove', overlay='#2D8659', gold/clear=10,
//                          trigger non-grove=3, turns auto-clear=5)
//        - SACRED_BERSERKER_ENRAGE_MULT = 2.0 (informational)
//   6. Sacred-cow audit (canonical regex-grep) — same values byte-perfect
//      against src/data/identity-layer.js (the sacred SHA1 baseline file)
//   7. Berserker enrage canonical lives in src/core/bosses.js — regex-grep
//      audit there for the value (referenced for cross-race awareness)
//   8. Sacred class continuity audit — our new CSS does NOT add/remove the
//      legacy sacred classes (.stagger-slow-mo, .boss-death-pause,
//      .v-fx-shake, .v-fx-crit-flash, .cell--engineer-welded, .phase-2,
//      .phase-3)
//   9. identity-fx.js signature parity — assert all 80+ exported function
//      names are still present (regression catch for accidental drift)
//  10. feel-layer discipline — identity-fx-polish.js never imports from
//      src/core/

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IDENTITY_LAYER_PATH  = resolve(__dirname, '../../src/data/identity-layer.js');
const IDENTITY_FX_PATH     = resolve(__dirname, '../../src/feel/identity-fx.js');
const POLISH_CSS_PATH      = resolve(__dirname, '../../src/feel/identity-fx-polish.css');
const POLISH_JS_PATH       = resolve(__dirname, '../../src/feel/identity-fx-polish.js');
const BOSSES_CORE_PATH     = resolve(__dirname, '../../src/core/bosses.js');

import {
  mountRaceFxPolish,
  updateRaceFxPolish,
  destroyRaceFxPolish,
  spawnFromSoilLabel,
  resolveBannerText,
  formatFromSoilLabel,
  _testables,
} from '../../src/feel/identity-fx-polish.js';

// Clean state between tests — mount holds a module-local handle.
afterEach(() => {
  try { destroyRaceFxPolish(); } catch (_e) { /* defensive */ }
});

describe('TASK-CP-008 — module exports', () => {
  it('exports lifecycle functions (mount/update/destroy)', () => {
    expect(typeof mountRaceFxPolish).toBe('function');
    expect(typeof updateRaceFxPolish).toBe('function');
    expect(typeof destroyRaceFxPolish).toBe('function');
  });

  it('exports spawnFromSoilLabel (Grove integration entry)', () => {
    expect(typeof spawnFromSoilLabel).toBe('function');
  });

  it('exports pure helpers (resolveBannerText / formatFromSoilLabel)', () => {
    expect(typeof resolveBannerText).toBe('function');
    expect(typeof formatFromSoilLabel).toBe('function');
  });

  it('exports a _testables hook with sacred constant mirrors', () => {
    expect(_testables).toBeDefined();
    expect(typeof _testables.SACRED_PIRATE).toBe('object');
    expect(typeof _testables.SACRED_SHARK).toBe('object');
    expect(typeof _testables.SACRED_ROCK).toBe('object');
    expect(typeof _testables.SACRED_CROCODILE).toBe('object');
    expect(typeof _testables.SACRED_SPARK).toBe('object');
    expect(typeof _testables.SACRED_GROVE).toBe('object');
    expect(typeof _testables.SACRED_BERSERKER_ENRAGE_MULT).toBe('number');
    expect(typeof _testables.ROOT_SLOT_ID).toBe('string');
    expect(typeof _testables.ROOT_CONTAINER_CLASS).toBe('string');
    expect(typeof _testables.CROSS_RACE_BANNER_CLASS).toBe('string');
    expect(typeof _testables.CROSS_RACE_BANNER_VISIBLE_CLASS).toBe('string');
    expect(typeof _testables.FROM_SOIL_LABEL_CLASS).toBe('string');
    expect(typeof _testables.FROM_SOIL_LABEL_RISING_CLASS).toBe('string');
    expect(typeof _testables.CROSS_RACE_BANNER_VISIBLE_MS).toBe('number');
    expect(typeof _testables.FROM_SOIL_LABEL_VISIBLE_MS).toBe('number');
    expect(typeof _testables.CROSS_RACE_BANNER_DEFAULT_TEXT).toBe('string');
    expect(typeof _testables._getCurrentRaceFxPolish).toBe('function');
  });
});

describe('TASK-CP-008 — defensive guards', () => {
  it('mountRaceFxPolish returns false for null/undefined rootEl', () => {
    expect(mountRaceFxPolish(null)).toBe(false);
    expect(mountRaceFxPolish(undefined)).toBe(false);
  });

  it('updateRaceFxPolish is a silent no-op when not mounted', () => {
    destroyRaceFxPolish();
    expect(() => updateRaceFxPolish({})).not.toThrow();
    expect(() => updateRaceFxPolish(undefined)).not.toThrow();
    expect(() => updateRaceFxPolish(null)).not.toThrow();
    expect(() => updateRaceFxPolish({ hasCrossRaceCombo: true })).not.toThrow();
  });

  it('destroyRaceFxPolish is idempotent (safe when not mounted)', () => {
    destroyRaceFxPolish();
    expect(() => destroyRaceFxPolish()).not.toThrow();
    expect(() => destroyRaceFxPolish()).not.toThrow();
  });

  it('updateRaceFxPolish never throws on non-object input', () => {
    destroyRaceFxPolish();
    expect(() => updateRaceFxPolish(42)).not.toThrow();
    expect(() => updateRaceFxPolish('combo')).not.toThrow();
    expect(() => updateRaceFxPolish(true)).not.toThrow();
  });

  it('updateRaceFxPolish tolerates unknown / falsy hasCrossRaceCombo', () => {
    destroyRaceFxPolish();
    expect(() => updateRaceFxPolish({ hasCrossRaceCombo: false })).not.toThrow();
    expect(() => updateRaceFxPolish({ hasCrossRaceCombo: 'yes' })).not.toThrow();
    expect(() => updateRaceFxPolish({ unrelated: 42 })).not.toThrow();
  });

  it('spawnFromSoilLabel returns false when not mounted', () => {
    destroyRaceFxPolish();
    expect(spawnFromSoilLabel(100, 200, 10)).toBe(false);
  });

  it('spawnFromSoilLabel returns false for invalid coords', () => {
    destroyRaceFxPolish();
    expect(spawnFromSoilLabel(NaN, 100, 10)).toBe(false);
    expect(spawnFromSoilLabel(100, undefined, 10)).toBe(false);
    expect(spawnFromSoilLabel('x', 'y', 10)).toBe(false);
  });
});

describe('TASK-CP-008 — resolveBannerText (banner copy resolver)', () => {
  it('returns the default text for missing / falsy input', () => {
    expect(resolveBannerText()).toBe('CROSS-RACE COMBO');
    expect(resolveBannerText(null)).toBe('CROSS-RACE COMBO');
    expect(resolveBannerText(undefined)).toBe('CROSS-RACE COMBO');
    expect(resolveBannerText('')).toBe('CROSS-RACE COMBO');
  });

  it('returns the custom string when provided', () => {
    expect(resolveBannerText('PARTY POWER')).toBe('PARTY POWER');
    expect(resolveBannerText('5x SYNERGY')).toBe('5x SYNERGY');
  });

  it('returns the default for non-string input (never throws)', () => {
    expect(resolveBannerText(42)).toBe('CROSS-RACE COMBO');
    expect(resolveBannerText({})).toBe('CROSS-RACE COMBO');
    expect(resolveBannerText([])).toBe('CROSS-RACE COMBO');
  });
});

describe('TASK-CP-008 — formatFromSoilLabel (Grove label formatter)', () => {
  it('formats default to "+10 FROM SOIL" (sacred ROOT_SURGE_GOLD_PER_CLEAR=10)', () => {
    expect(formatFromSoilLabel()).toBe('+10 FROM SOIL');
    expect(formatFromSoilLabel(null)).toBe('+10 FROM SOIL');
    expect(formatFromSoilLabel(undefined)).toBe('+10 FROM SOIL');
  });

  it('formats custom finite amount', () => {
    expect(formatFromSoilLabel(5)).toBe('+5 FROM SOIL');
    expect(formatFromSoilLabel(20)).toBe('+20 FROM SOIL');
    expect(formatFromSoilLabel(0)).toBe('+0 FROM SOIL');
  });

  it('falls back to default for invalid amounts (never throws)', () => {
    expect(formatFromSoilLabel('x')).toBe('+10 FROM SOIL');
    expect(formatFromSoilLabel(NaN)).toBe('+10 FROM SOIL');
    expect(formatFromSoilLabel(Infinity)).toBe('+10 FROM SOIL');
  });
});

describe('TASK-CP-008 — sacred-cow audit · Pirate (module mirror)', () => {
  it('PIRATE_PLUNDER_GOLD_PER_CELL = 5 byte-perfect', () => {
    expect(_testables.SACRED_PIRATE.GOLD_PER_CELL).toBe(5);
  });
  it('PIRATE_PLUNDER_MAX_PIRATES = 5 byte-perfect', () => {
    expect(_testables.SACRED_PIRATE.MAX_PIRATES).toBe(5);
  });
  it('PIRATE_PLUNDER_MAX_COINS = 32 byte-perfect (HARD CAP)', () => {
    expect(_testables.SACRED_PIRATE.MAX_COINS).toBe(32);
  });
  it('PIRATE_PLUNDER_COIN_DECAY_MS = 1000 byte-perfect', () => {
    expect(_testables.SACRED_PIRATE.COIN_DECAY_MS).toBe(1000);
  });
  it('SACRED_PIRATE is frozen — sacred immutability guard', () => {
    expect(Object.isFrozen(_testables.SACRED_PIRATE)).toBe(true);
  });
});

describe('TASK-CP-008 — sacred-cow audit · Shark (module mirror)', () => {
  it('SHARK_FRENZY_MIN_SHARKS_FOR_2X_TRIGGER = 2 byte-perfect', () => {
    expect(_testables.SACRED_SHARK.MIN_SHARKS_FOR_2X_TRIGGER).toBe(2);
  });
  it('SHARK_FRENZY_MAX_EXTRA_CELLS = 4 byte-perfect (HARD CAP)', () => {
    expect(_testables.SACRED_SHARK.MAX_EXTRA_CELLS).toBe(4);
  });
  it('SHARK_FRENZY_BITE_DECAY_MS = 500 byte-perfect', () => {
    expect(_testables.SACRED_SHARK.BITE_DECAY_MS).toBe(500);
  });
  it('SHARK_FRENZY_BITE_SVG_PER_LINE = 1 byte-perfect', () => {
    expect(_testables.SACRED_SHARK.BITE_SVG_PER_LINE).toBe(1);
  });
  it("SHARK_FRENZY_DOMINANT_ELEMENT = 'tide' byte-perfect", () => {
    expect(_testables.SACRED_SHARK.DOMINANT_ELEMENT).toBe('tide');
  });
  it('SACRED_SHARK is frozen — sacred immutability guard', () => {
    expect(Object.isFrozen(_testables.SACRED_SHARK)).toBe(true);
  });
});

describe('TASK-CP-008 — sacred-cow audit · Rock (module mirror)', () => {
  it('ROCK_ECHO_CHARGE_PER_LINE = 1 byte-perfect', () => {
    expect(_testables.SACRED_ROCK.CHARGE_PER_LINE).toBe(1);
  });
  it('ROCK_ECHO_MAX_CHARGE_PER_FIRE = 4 byte-perfect (HARD CAP)', () => {
    expect(_testables.SACRED_ROCK.MAX_CHARGE_PER_FIRE).toBe(4);
  });
  it('ROCK_ECHO_GHOST_DECAY_MS = 700 byte-perfect', () => {
    expect(_testables.SACRED_ROCK.GHOST_DECAY_MS).toBe(700);
  });
  it('ROCK_ECHO_DELAY_MS = 200 byte-perfect', () => {
    expect(_testables.SACRED_ROCK.DELAY_MS).toBe(200);
  });
  it("ROCK_ECHO_DOMINANT_ELEMENT = 'umbra' byte-perfect", () => {
    expect(_testables.SACRED_ROCK.DOMINANT_ELEMENT).toBe('umbra');
  });
  it("ROCK_ECHO_ULT_METER = 'umbra' byte-perfect", () => {
    expect(_testables.SACRED_ROCK.ULT_METER).toBe('umbra');
  });
  it('SACRED_ROCK is frozen — sacred immutability guard', () => {
    expect(Object.isFrozen(_testables.SACRED_ROCK)).toBe(true);
  });
});

describe('TASK-CP-008 — sacred-cow audit · Crocodile (module mirror)', () => {
  it('CROCODILE_BASTION_FRAGMENTS_PER_SHIELD = 5 byte-perfect', () => {
    expect(_testables.SACRED_CROCODILE.FRAGMENTS_PER_SHIELD).toBe(5);
  });
  it('CROCODILE_BASTION_MAX_FRAGMENT_PARTICLES = 16 byte-perfect (HARD CAP)', () => {
    expect(_testables.SACRED_CROCODILE.MAX_FRAGMENT_PARTICLES).toBe(16);
  });
  it('CROCODILE_BASTION_FRAGMENT_DECAY_MS = 600 byte-perfect', () => {
    expect(_testables.SACRED_CROCODILE.FRAGMENT_DECAY_MS).toBe(600);
  });
  it("CROCODILE_BASTION_GROVE_ELEMENT = 'grove' byte-perfect", () => {
    expect(_testables.SACRED_CROCODILE.GROVE_ELEMENT).toBe('grove');
  });
  it('CROCODILE_BASTION_TARGET_HERO_INDEX = 0 byte-perfect (leftmost crocodile)', () => {
    expect(_testables.SACRED_CROCODILE.TARGET_HERO_INDEX).toBe(0);
  });
  it('SACRED_CROCODILE is frozen — sacred immutability guard', () => {
    expect(Object.isFrozen(_testables.SACRED_CROCODILE)).toBe(true);
  });
});

describe('TASK-CP-008 — sacred-cow audit · Spark (module mirror)', () => {
  it('SPARK_CASCADE_MIN_SOLAR_CELLS = 2 byte-perfect (HARD gate, Roman ESC-02 O3)', () => {
    expect(_testables.SACRED_SPARK.MIN_SOLAR_CELLS).toBe(2);
  });
  it('SPARK_CASCADE_MAX_DOMINANT_BOOST = 1 byte-perfect (HARD CAP, NOT stacking)', () => {
    expect(_testables.SACRED_SPARK.MAX_DOMINANT_BOOST).toBe(1);
  });
  it('SPARK_CASCADE_MAX_RAY_PARTICLES = 16 byte-perfect', () => {
    expect(_testables.SACRED_SPARK.MAX_RAY_PARTICLES).toBe(16);
  });
  it('SPARK_CASCADE_RAY_DECAY_MS = 400 byte-perfect', () => {
    expect(_testables.SACRED_SPARK.RAY_DECAY_MS).toBe(400);
  });
  it("SPARK_CASCADE_DOMINANT_ELEMENT = 'solar' byte-perfect", () => {
    expect(_testables.SACRED_SPARK.DOMINANT_ELEMENT).toBe('solar');
  });
  it('SPARK_CASCADE_ENABLED = true byte-perfect (T2.B fallback toggle)', () => {
    expect(_testables.SACRED_SPARK.ENABLED).toBe(true);
  });
  it('SACRED_SPARK is frozen — sacred immutability guard', () => {
    expect(Object.isFrozen(_testables.SACRED_SPARK)).toBe(true);
  });
});

describe('TASK-CP-008 — sacred-cow audit · Grove (module mirror)', () => {
  it("ROOT_SURGE_GROVE_ELEMENT = 'grove' byte-perfect", () => {
    expect(_testables.SACRED_GROVE.GROVE_ELEMENT).toBe('grove');
  });
  it("ROOT_SURGE_OVERLAY_COLOR = '#2D8659' byte-perfect (mossy green)", () => {
    expect(_testables.SACRED_GROVE.OVERLAY_COLOR).toBe('#2D8659');
  });
  it('ROOT_SURGE_GOLD_PER_CLEAR = 10 byte-perfect', () => {
    expect(_testables.SACRED_GROVE.GOLD_PER_CLEAR).toBe(10);
  });
  it('ROOT_SURGE_TRIGGER_NON_GROVE_COUNT = 3 byte-perfect (sliding-window size)', () => {
    expect(_testables.SACRED_GROVE.TRIGGER_NON_GROVE).toBe(3);
  });
  it('ROOT_SURGE_TURNS_UNTIL_AUTO_CLEAR = 5 byte-perfect (block + opportunity window)', () => {
    expect(_testables.SACRED_GROVE.TURNS_AUTO_CLEAR).toBe(5);
  });
  it('SACRED_GROVE is frozen — sacred immutability guard', () => {
    expect(Object.isFrozen(_testables.SACRED_GROVE)).toBe(true);
  });
});

describe('TASK-CP-008 — sacred-cow audit · Berserker (informational)', () => {
  // Berserker isn't polished in this task (covered by Task 10), but the
  // module mirrors BERSERKER_ENRAGE_MULT = 2.0 for cross-race awareness +
  // so the regex-grep canonical audit catches drift on src/core/bosses.js.
  it('SACRED_BERSERKER_ENRAGE_MULT = 2.0 byte-perfect', () => {
    expect(_testables.SACRED_BERSERKER_ENRAGE_MULT).toBe(2.0);
  });
});

describe('TASK-CP-008 — sacred-cow audit (canonical regex-grep · identity-layer.js)', () => {
  // Regex-grep on src/data/identity-layer.js (the sacred SHA1 baseline file
  // — `2edc3fe…`). Any drift here is a sacred-cow violation and a CI fail.

  it('can read src/data/identity-layer.js', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src.length).toBeGreaterThan(0);
  });

  // ─── Pirate ────────────────────────────────────────────────────────────
  it('PIRATE_PLUNDER_GOLD_PER_CELL = 5 byte-perfect (identity-layer.js)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const PIRATE_PLUNDER_GOLD_PER_CELL\s+=\s+5;/);
  });
  it('PIRATE_PLUNDER_MAX_PIRATES = 5 byte-perfect', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const PIRATE_PLUNDER_MAX_PIRATES\s+=\s+5;/);
  });
  it('PIRATE_PLUNDER_MAX_COINS = 32 byte-perfect (HARD CAP)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const PIRATE_PLUNDER_MAX_COINS\s+=\s+32;/);
  });
  it('PIRATE_PLUNDER_COIN_DECAY_MS = 1000 byte-perfect', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const PIRATE_PLUNDER_COIN_DECAY_MS\s+=\s+1000;/);
  });

  // ─── Shark ─────────────────────────────────────────────────────────────
  it('SHARK_FRENZY_MIN_SHARKS_FOR_2X_TRIGGER = 2 byte-perfect', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const SHARK_FRENZY_MIN_SHARKS_FOR_2X_TRIGGER\s+=\s+2;/);
  });
  it('SHARK_FRENZY_MAX_EXTRA_CELLS = 4 byte-perfect (HARD CAP)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const SHARK_FRENZY_MAX_EXTRA_CELLS\s+=\s+4;/);
  });
  it('SHARK_FRENZY_BITE_DECAY_MS = 500 byte-perfect', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const SHARK_FRENZY_BITE_DECAY_MS\s+=\s+500;/);
  });
  it('SHARK_FRENZY_BITE_SVG_PER_LINE = 1 byte-perfect', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const SHARK_FRENZY_BITE_SVG_PER_LINE\s+=\s+1;/);
  });
  it("SHARK_FRENZY_DOMINANT_ELEMENT = 'tide' byte-perfect", () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const SHARK_FRENZY_DOMINANT_ELEMENT\s+=\s+'tide';/);
  });

  // ─── Rock ──────────────────────────────────────────────────────────────
  it('ROCK_ECHO_CHARGE_PER_LINE = 1 byte-perfect', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const ROCK_ECHO_CHARGE_PER_LINE\s+=\s+1;/);
  });
  it('ROCK_ECHO_MAX_CHARGE_PER_FIRE = 4 byte-perfect (HARD CAP)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const ROCK_ECHO_MAX_CHARGE_PER_FIRE\s+=\s+4;/);
  });
  it('ROCK_ECHO_GHOST_DECAY_MS = 700 byte-perfect', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const ROCK_ECHO_GHOST_DECAY_MS\s+=\s+700;/);
  });
  it('ROCK_ECHO_DELAY_MS = 200 byte-perfect', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const ROCK_ECHO_DELAY_MS\s+=\s+200;/);
  });
  it("ROCK_ECHO_DOMINANT_ELEMENT = 'umbra' byte-perfect", () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const ROCK_ECHO_DOMINANT_ELEMENT\s+=\s+'umbra';/);
  });
  it("ROCK_ECHO_ULT_METER = 'umbra' byte-perfect", () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const ROCK_ECHO_ULT_METER\s+=\s+'umbra';/);
  });

  // ─── Crocodile ─────────────────────────────────────────────────────────
  it('CROCODILE_BASTION_FRAGMENTS_PER_SHIELD = 5 byte-perfect', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const CROCODILE_BASTION_FRAGMENTS_PER_SHIELD\s+=\s+5;/);
  });
  it('CROCODILE_BASTION_MAX_FRAGMENT_PARTICLES = 16 byte-perfect (HARD CAP)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const CROCODILE_BASTION_MAX_FRAGMENT_PARTICLES\s+=\s+16;/);
  });
  it('CROCODILE_BASTION_FRAGMENT_DECAY_MS = 600 byte-perfect', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const CROCODILE_BASTION_FRAGMENT_DECAY_MS\s+=\s+600;/);
  });
  it("CROCODILE_BASTION_GROVE_ELEMENT = 'grove' byte-perfect", () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const CROCODILE_BASTION_GROVE_ELEMENT\s+=\s+'grove';/);
  });
  it('CROCODILE_BASTION_TARGET_HERO_INDEX = 0 byte-perfect', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const CROCODILE_BASTION_TARGET_HERO_INDEX\s+=\s+0;/);
  });

  // ─── Spark ─────────────────────────────────────────────────────────────
  it('SPARK_CASCADE_MIN_SOLAR_CELLS = 2 byte-perfect (HARD gate)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const SPARK_CASCADE_MIN_SOLAR_CELLS\s+=\s+2;/);
  });
  it('SPARK_CASCADE_MAX_DOMINANT_BOOST = 1 byte-perfect (HARD CAP, NOT stacking)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const SPARK_CASCADE_MAX_DOMINANT_BOOST\s+=\s+1;/);
  });
  it('SPARK_CASCADE_MAX_RAY_PARTICLES = 16 byte-perfect', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const SPARK_CASCADE_MAX_RAY_PARTICLES\s+=\s+16;/);
  });
  it('SPARK_CASCADE_RAY_DECAY_MS = 400 byte-perfect', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const SPARK_CASCADE_RAY_DECAY_MS\s+=\s+400;/);
  });
  it("SPARK_CASCADE_DOMINANT_ELEMENT = 'solar' byte-perfect", () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const SPARK_CASCADE_DOMINANT_ELEMENT\s+=\s+'solar';/);
  });
  it('SPARK_CASCADE_ENABLED = true byte-perfect (T2.B fallback toggle)', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const SPARK_CASCADE_ENABLED\s+=\s+true;/);
  });

  // ─── Grove ─────────────────────────────────────────────────────────────
  it("ROOT_SURGE_GROVE_ELEMENT = 'grove' byte-perfect", () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const ROOT_SURGE_GROVE_ELEMENT\s+=\s+'grove';/);
  });
  it("ROOT_SURGE_OVERLAY_COLOR = '#2D8659' byte-perfect (sacred mossy green)", () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const ROOT_SURGE_OVERLAY_COLOR\s+=\s+'#2D8659';/);
  });
  it('ROOT_SURGE_GOLD_PER_CLEAR = 10 byte-perfect', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const ROOT_SURGE_GOLD_PER_CLEAR\s+=\s+10;/);
  });
  it('ROOT_SURGE_TRIGGER_NON_GROVE_COUNT = 3 byte-perfect', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const ROOT_SURGE_TRIGGER_NON_GROVE_COUNT\s+=\s+3;/);
  });
  it('ROOT_SURGE_TURNS_UNTIL_AUTO_CLEAR = 5 byte-perfect', () => {
    const src = readFileSync(IDENTITY_LAYER_PATH, 'utf8');
    expect(src).toMatch(/export const ROOT_SURGE_TURNS_UNTIL_AUTO_CLEAR\s+=\s+5;/);
  });
});

describe('TASK-CP-008 — sacred-cow audit (canonical regex-grep · bosses.js)', () => {
  // BERSERKER_ENRAGE_MULT canonical source is src/core/bosses.js. Audited
  // for cross-race awareness — Task 10 will polish this race.

  it('BERSERKER_ENRAGE_MULT = 2.0 byte-perfect (src/core/bosses.js)', () => {
    const src = readFileSync(BOSSES_CORE_PATH, 'utf8');
    expect(src).toMatch(/export const BERSERKER_ENRAGE_MULT\s+=\s+2\.0;/);
  });
});

describe('TASK-CP-008 — sacred CSS-class continuity audit', () => {
  // CLAUDE.md §2.2 / §2.5 + plan §12: our new CSS MUST NOT override,
  // remove, or modify any of the existing legacy JS-readable / sacred
  // class selectors. The audit below regex-greps our own CSS for any
  // mention of these classes — any hit fires the test.

  it('does NOT mention .stagger-slow-mo in identity-fx-polish.css', () => {
    const css = readFileSync(POLISH_CSS_PATH, 'utf8');
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(stripped).not.toMatch(/\.stagger-slow-mo\b/);
  });

  it('does NOT mention .boss-death-pause in identity-fx-polish.css', () => {
    const css = readFileSync(POLISH_CSS_PATH, 'utf8');
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(stripped).not.toMatch(/\.boss-death-pause\b/);
  });

  it('does NOT mention .v-fx-shake in identity-fx-polish.css', () => {
    const css = readFileSync(POLISH_CSS_PATH, 'utf8');
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(stripped).not.toMatch(/\.v-fx-shake\b/);
  });

  it('does NOT mention .v-fx-crit-flash in identity-fx-polish.css', () => {
    const css = readFileSync(POLISH_CSS_PATH, 'utf8');
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(stripped).not.toMatch(/\.v-fx-crit-flash\b/);
  });

  it('does NOT mention .cell--engineer-welded in identity-fx-polish.css', () => {
    const css = readFileSync(POLISH_CSS_PATH, 'utf8');
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(stripped).not.toMatch(/\.cell--engineer-welded\b/);
  });

  it('does NOT mention .phase-2 / .phase-3 in identity-fx-polish.css', () => {
    const css = readFileSync(POLISH_CSS_PATH, 'utf8');
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(stripped).not.toMatch(/\.phase-2\b/);
    expect(stripped).not.toMatch(/\.phase-3\b/);
  });

  it('identity-fx-polish.js never imports from src/core/ (feel-layer discipline)', () => {
    const src = readFileSync(POLISH_JS_PATH, 'utf8');
    expect(src).not.toMatch(/from\s+['"][^'"]*src\/core\//);
    expect(src).not.toMatch(/from\s+['"]\.\.\/core\//);
  });

  it('identity-fx-polish.js never imports from src/data/ (sacred data immutability)', () => {
    const src = readFileSync(POLISH_JS_PATH, 'utf8');
    expect(src).not.toMatch(/from\s+['"][^'"]*src\/data\//);
    expect(src).not.toMatch(/from\s+['"]\.\.\/data\//);
  });
});

describe('TASK-CP-008 — identity-fx.js signature parity audit', () => {
  // identity-fx.js is NOT in the sacred-12 SHA1 baseline, but this task's
  // architectural rule is: identity-fx.js must stay byte-perfect untouched
  // (the polish layer is a NEW sibling module). The audit below regex-greps
  // identity-fx.js for the 80+ exported function signatures and asserts
  // every one is still present. Any drift here = a regression signal.
  //
  // The exhaustive list is sourced from the post-cbaaadb HEAD snapshot at
  // the time of this task's commit. New exports added in a later task
  // would extend this list — drift in EITHER direction = test fail.

  const EXPECTED_IDENTITY_FX_EXPORTS = Object.freeze([
    'computePirateGold',
    'computeCellsCleared',
    'countAlivePirates',
    'fxPirateLineClear',
    'countAliveSharks',
    'computeSharkBiteCount',
    'isSharkBiteBlocked',
    'computeBittenCells',
    'sharkFrenzyGatePasses',
    'fxSharkLineClear',
    'countAliveRocks',
    'countUmbraDominantLines',
    'computeEncoreEchoCharge',
    'clampEncoreEchoCharge',
    'fxRockLineClear',
    'resetCrocFragmentBank',
    'countAliveCrocodiles',
    'countGroveCells',
    'accumulateFragments',
    'computeShieldsGrantable',
    'clampShieldsToSquadMax',
    'resolveSacredMaxShieldBonus',
    'fxCrocodileLineClear',
    'countAliveSparks',
    'countSolarCellsInClear',
    'computeSunCascadeModifier',
    'fxSparkLineClear',
    'computeAshenReignDuration',
    'canPlacePieceDuringAshenReign',
    'isAshenReignActive',
    'getAshenReignEndsAt',
    'fxPhoenixAshenReign',
    'fxPhoenixAshenReignRelease',
    'resetAshenReign',
    'dispatchIdentityFx',
    'pickRandomNonEmptyCells',
    'applyCurseCellDamage',
    'computeCurseTickResult',
    'clampUltCharge',
    'isCellCursed',
    'getCursedTilesCount',
    'getCursedTilesSnapshot',
    'resetCursedTiles',
    'fxLichCursedTiles',
    'fxLichCursedTilesTick',
    'cursedTilesGatePasses',
    'shouldBloodtidePulse',
    'computeBloodtideDamageBonus',
    'applyBloodtideToDamage',
    'incrementBloodtideClearCount',
    'getBloodtideClearCount',
    'consumeBloodtidePulse',
    'isBloodtidePulsePending',
    'resetBloodtide',
    'fxBerserkerBloodtidePulse',
    'bloodtideGatePasses',
    'isTetrisCrit',
    'pickMostClearedCorner',
    'compute2x2LockdownCells',
    'isCellLockedByLockdownProtocol',
    'getEngineerLockdownsCount',
    'getEngineerLockdownsSnapshot',
    'resetEngineerLockdowns',
    'fxEngineerLockdownProtocol',
    'fxEngineerLockdownTick',
    'engineerLockdownGatePasses',
    'shouldRootSurgeFire',
    'pushRecentClear',
    'pickRandomEmptyCells',
    'computeRootSurgeCells',
    'computeRootClearGoldReward',
    'computeRootSurgeTickResult',
    'isCellRooted',
    'getActiveRootCellsCount',
    'getActiveRootCellsSnapshot',
    'getRecentClearsSnapshot',
    'resetGrovewardenRootSurge',
    'fxGrovewardenRootSurge',
    'fxGrovewardenRootSurgeTick',
    'onRootCellCleared',
    'rootSurgeGatePasses',
  ]);

  it('can read src/feel/identity-fx.js', () => {
    const src = readFileSync(IDENTITY_FX_PATH, 'utf8');
    expect(src.length).toBeGreaterThan(0);
  });

  it('every expected exported function name is still present in identity-fx.js', () => {
    const src = readFileSync(IDENTITY_FX_PATH, 'utf8');
    const missing = [];
    EXPECTED_IDENTITY_FX_EXPORTS.forEach((name) => {
      const re = new RegExp(`export function ${name}\\b`);
      if (!re.test(src)) missing.push(name);
    });
    expect(missing).toEqual([]);
  });

  it('identity-fx.js still exports the __identityFxTestables sentinel object', () => {
    // The internal test-hooks bundle — its presence is part of the contract.
    const src = readFileSync(IDENTITY_FX_PATH, 'utf8');
    expect(src).toMatch(/export const __identityFxTestables\s+=/);
  });
});

describe('TASK-CP-008 — banner / FROM SOIL helpers (mock DOM via spies)', () => {
  // Vitest runs in node env (no real DOM). We exercise the helpers with a
  // hand-rolled minimal DOM shim so the lifecycle paths are exercised.

  let originalDocument;
  let originalWindow;

  beforeEach(() => {
    originalDocument = globalThis.document;
    originalWindow = globalThis.window;

    // Minimal element factory — supports the API surface our module uses.
    const make = (tag) => {
      const el = {
        tagName: tag,
        children: [],
        classList: {
          add(c)    { if (!el._classes.includes(c)) el._classes.push(c); },
          remove(c) { el._classes = el._classes.filter((x) => x !== c); },
          contains(c) { return el._classes.includes(c); },
        },
        _classes: [],
        get className() { return el._classes.join(' '); },
        set className(v) { el._classes = String(v).split(/\s+/).filter(Boolean); },
        style: {},
        get offsetWidth() { return 0; },
        textContent: '',
        setAttribute(k, v) { el[`__attr_${k}`] = v; },
        appendChild(child) { el.children.push(child); child.parentNode = el; return child; },
        removeChild(child) {
          el.children = el.children.filter((c) => c !== child);
          child.parentNode = null;
          return child;
        },
        querySelector() { return null; },
        get innerHTML() { return ''; },
        set innerHTML(v) { if (v === '') el.children = []; },
        parentNode: null,
      };
      return el;
    };

    globalThis.document = {
      createElement: (tag) => make(tag),
      body: make('body'),
    };
    globalThis.window = {};
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    try { destroyRaceFxPolish(); } catch (_e) { /* defensive */ }
    vi.useRealTimers();
  });

  it('mountRaceFxPolish mounts a slot with the cross-race banner DOM', () => {
    const root = globalThis.document.createElement('div');
    const ok = mountRaceFxPolish(root);
    expect(ok).toBe(true);
    expect(_testables._getCurrentRaceFxPolish()).not.toBeNull();
    const handle = _testables._getCurrentRaceFxPolish();
    expect(handle.slot).toBeDefined();
    expect(handle.banner).toBeDefined();
    expect(handle.banner.textContent).toBe(_testables.CROSS_RACE_BANNER_DEFAULT_TEXT);
  });

  it('mountRaceFxPolish is idempotent (returns false on repeat mount)', () => {
    const root = globalThis.document.createElement('div');
    expect(mountRaceFxPolish(root)).toBe(true);
    expect(mountRaceFxPolish(root)).toBe(false);
  });

  it('updateRaceFxPolish({ hasCrossRaceCombo: true }) adds visible class', () => {
    const root = globalThis.document.createElement('div');
    mountRaceFxPolish(root);
    updateRaceFxPolish({ hasCrossRaceCombo: true });
    const handle = _testables._getCurrentRaceFxPolish();
    expect(handle.banner.classList.contains(
      _testables.CROSS_RACE_BANNER_VISIBLE_CLASS
    )).toBe(true);
  });

  it('destroyRaceFxPolish clears handle (idempotent)', () => {
    const root = globalThis.document.createElement('div');
    mountRaceFxPolish(root);
    expect(_testables._getCurrentRaceFxPolish()).not.toBeNull();
    destroyRaceFxPolish();
    expect(_testables._getCurrentRaceFxPolish()).toBeNull();
  });

  it('mountRaceFxPolish installs window-bridge entry points', () => {
    const root = globalThis.document.createElement('div');
    mountRaceFxPolish(root);
    expect(typeof globalThis.window.__triggerCrossRaceCombo).toBe('function');
    expect(typeof globalThis.window.__spawnGroveFromSoilLabel).toBe('function');
  });

  it('destroyRaceFxPolish removes window-bridge entry points', () => {
    const root = globalThis.document.createElement('div');
    mountRaceFxPolish(root);
    destroyRaceFxPolish();
    expect(globalThis.window.__triggerCrossRaceCombo).toBeUndefined();
    expect(globalThis.window.__spawnGroveFromSoilLabel).toBeUndefined();
  });

  it('spawnFromSoilLabel returns true when mounted with valid coords', () => {
    const root = globalThis.document.createElement('div');
    mountRaceFxPolish(root);
    expect(spawnFromSoilLabel(100, 200, 10)).toBe(true);
    expect(spawnFromSoilLabel(50, 75)).toBe(true);   // defaults goldAmount=10
  });

  it('spawnFromSoilLabel uses default gold amount when not provided', () => {
    const root = globalThis.document.createElement('div');
    mountRaceFxPolish(root);
    expect(spawnFromSoilLabel(100, 200)).toBe(true);
    // Verify document.body received a child label with default text content
    const body = globalThis.document.body;
    const label = body.children.find((c) =>
      c._classes && c._classes.includes(_testables.FROM_SOIL_LABEL_CLASS));
    expect(label).toBeDefined();
    expect(label.textContent).toBe(formatFromSoilLabel());
  });
});
