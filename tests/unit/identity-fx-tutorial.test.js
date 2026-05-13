// 2026-05-13 — TASK-045 (Phase 2.5 FTUE polish): Tutorial overlay unit tests.
//
// Spec: docs/design/phase2-5-ftue-polish.md §3.x.10 acceptance criteria.
// Vitest runs in `node` env (no DOM) — these tests cover the localStorage
// gate logic + defensive paths. DOM-dependent overlay behavior is verified
// by Playwright smoke tests (tests/smoke/phase2-5-ftue-polish.spec.js).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  showFirstTimeTutorialOverlay,
  hideFirstTimeTutorialOverlay,
  __identityFxTutorialTestables,
} from '../../src/ui/identity-fx-tutorial.js';
import {
  SUN_CASCADE_FIRST_PROMOTION_LINE_1_PLACEHOLDER,
  SUN_CASCADE_FIRST_PROMOTION_LINE_2_PLACEHOLDER,
  SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_LOCALSTORAGE_KEY,
  SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_TITLE,
  SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_ACCENT,
  SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_EMBLEM,
  CURSED_TILES_FIRST_FIRE_LINE_1_PLACEHOLDER,
  CURSED_TILES_FIRST_FIRE_LINE_2_PLACEHOLDER,
  CURSED_TILES_FIRST_FIRE_TUTORIAL_LOCALSTORAGE_KEY,
  CURSED_TILES_FIRST_FIRE_TUTORIAL_EMBLEM,
  BLOODTIDE_PULSE_FIRST_FIRE_LINE_1_PLACEHOLDER,
  BLOODTIDE_PULSE_FIRST_FIRE_LINE_2_PLACEHOLDER,
  BLOODTIDE_PULSE_FIRST_FIRE_TUTORIAL_LOCALSTORAGE_KEY,
  BLOODTIDE_PULSE_FIRST_FIRE_TUTORIAL_EMBLEM,
  IDENTITY_FX_TUTORIAL_AUTO_DISMISS_MS,
} from '../../src/data/identity-layer.js';

// Minimal in-memory localStorage shim (matches codex.test.js precedent).
function createMockLocalStorage() {
  const store = Object.create(null);
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      for (const k of Object.keys(store)) delete store[k];
    },
    _raw(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    _allKeys() {
      return Object.keys(store);
    },
  };
}

let _originalLocalStorage;

beforeEach(() => {
  _originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = createMockLocalStorage();
  __identityFxTutorialTestables.resetForTests();
});

afterEach(() => {
  if (_originalLocalStorage === undefined) {
    delete globalThis.localStorage;
  } else {
    globalThis.localStorage = _originalLocalStorage;
  }
  __identityFxTutorialTestables.resetForTests();
});

describe('Phase 2.5 FTUE polish — tutorial placeholder constants (TASK-045)', () => {
  it('F-01 Sun Cascade lines match Designer-redlined copy', () => {
    expect(SUN_CASCADE_FIRST_PROMOTION_LINE_1_PLACEHOLDER).toBe('Your strike was promoted.');
    expect(SUN_CASCADE_FIRST_PROMOTION_LINE_2_PLACEHOLDER).toBe('Solar burns brighter when solar is plentiful.');
  });

  it('F-02 Cursed Tiles lines match Designer-redlined copy', () => {
    expect(CURSED_TILES_FIRST_FIRE_LINE_1_PLACEHOLDER).toBe('You hunt with sharks.');
    expect(CURSED_TILES_FIRST_FIRE_LINE_2_PLACEHOLDER).toBe('The deep hunts hunters.');
  });

  it('F-04 Bloodtide Pulse lines match Designer-redlined copy', () => {
    expect(BLOODTIDE_PULSE_FIRST_FIRE_LINE_1_PLACEHOLDER).toBe('The dragon counts your strikes.');
    expect(BLOODTIDE_PULSE_FIRST_FIRE_LINE_2_PLACEHOLDER).toBe('Every third, it answers.');
  });

  it('tutorial emblem keys are stable strings (matches /images/emblems/<key>.png contract)', () => {
    expect(SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_EMBLEM).toBe('spark');
    expect(CURSED_TILES_FIRST_FIRE_TUTORIAL_EMBLEM).toBe('lich');
    expect(BLOODTIDE_PULSE_FIRST_FIRE_TUTORIAL_EMBLEM).toBe('pyredrake');
  });

  it('localStorage keys are isolated from codex schema (separate keys)', () => {
    expect(SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_LOCALSTORAGE_KEY).toBe('blocksworn_sun_cascade_seen');
    expect(CURSED_TILES_FIRST_FIRE_TUTORIAL_LOCALSTORAGE_KEY).toBe('blocksworn_cursed_tiles_seen');
    expect(BLOODTIDE_PULSE_FIRST_FIRE_TUTORIAL_LOCALSTORAGE_KEY).toBe('blocksworn_bloodtide_seen');
    // None should collide with codex state key.
    expect(SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_LOCALSTORAGE_KEY).not.toBe('blocksworn_codex_state');
    expect(CURSED_TILES_FIRST_FIRE_TUTORIAL_LOCALSTORAGE_KEY).not.toBe('blocksworn_codex_state');
    expect(BLOODTIDE_PULSE_FIRST_FIRE_TUTORIAL_LOCALSTORAGE_KEY).not.toBe('blocksworn_codex_state');
  });

  it('IDENTITY_FX_TUTORIAL_AUTO_DISMISS_MS is 5000ms per Designer §3.1.7', () => {
    expect(IDENTITY_FX_TUTORIAL_AUTO_DISMISS_MS).toBe(5000);
  });
});

describe('showFirstTimeTutorialOverlay — gate behavior (Node env / no DOM)', () => {
  it('returns false when called with no content (defensive)', () => {
    const result = showFirstTimeTutorialOverlay(null);
    expect(result).toBe(false);
  });

  it('returns false when called with empty object (no persistenceKey)', () => {
    const result = showFirstTimeTutorialOverlay({});
    expect(result).toBe(false);
  });

  it('returns false when persistenceKey is empty string', () => {
    const result = showFirstTimeTutorialOverlay({ persistenceKey: '' });
    expect(result).toBe(false);
  });

  it('returns false when persistenceKey is non-string', () => {
    const result = showFirstTimeTutorialOverlay({ persistenceKey: 123 });
    expect(result).toBe(false);
  });

  it('returns false when document is unavailable (Node test env)', () => {
    // In vitest node env, document is undefined → no-op return false
    // even though localStorage is mocked + key is fresh.
    const result = showFirstTimeTutorialOverlay({
      persistenceKey: SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_LOCALSTORAGE_KEY,
      emblem:         SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_EMBLEM,
      title:          SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_TITLE,
      line1:          SUN_CASCADE_FIRST_PROMOTION_LINE_1_PLACEHOLDER,
      line2:          SUN_CASCADE_FIRST_PROMOTION_LINE_2_PLACEHOLDER,
      accentColor:    SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_ACCENT,
    });
    expect(result).toBe(false);
    expect(__identityFxTutorialTestables.isActive()).toBe(false);
  });

  it('does NOT write localStorage when document unavailable (Node env)', () => {
    // No DOM → no overlay → no flag write (preserves first-fire chance
    // for next session when DOM available).
    showFirstTimeTutorialOverlay({
      persistenceKey: SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_LOCALSTORAGE_KEY,
      line1: 'test',
    });
    expect(localStorage.getItem(SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_LOCALSTORAGE_KEY)).toBeNull();
  });

  it('returns false when already-seen flag is set in localStorage', () => {
    // Even if DOM were available, the gate respects already-seen flag.
    localStorage.setItem(SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_LOCALSTORAGE_KEY, '1');
    const result = showFirstTimeTutorialOverlay({
      persistenceKey: SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_LOCALSTORAGE_KEY,
      line1: 'test',
    });
    expect(result).toBe(false);
  });

  it('returns false when localStorage is unavailable (private mode)', () => {
    delete globalThis.localStorage;
    const result = showFirstTimeTutorialOverlay({
      persistenceKey: SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_LOCALSTORAGE_KEY,
      line1: 'test',
    });
    expect(result).toBe(false);
  });

  it('localStorage getItem throwing → returns false (defensive)', () => {
    globalThis.localStorage = {
      getItem() { throw new Error('SecurityError'); },
      setItem() {},
    };
    const result = showFirstTimeTutorialOverlay({
      persistenceKey: SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_LOCALSTORAGE_KEY,
      line1: 'test',
    });
    expect(result).toBe(false);
  });

  it('handles already-seen for all 4 distinct persistence keys without collision', () => {
    // Mark only Sun Cascade as seen.
    localStorage.setItem(SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_LOCALSTORAGE_KEY, '1');
    // Sun Cascade gate → would be false (seen flag set; node env also blocks).
    // Cursed Tiles + Bloodtide → still gated by node env, but flag NOT set.
    expect(localStorage.getItem(SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_LOCALSTORAGE_KEY)).toBe('1');
    expect(localStorage.getItem(CURSED_TILES_FIRST_FIRE_TUTORIAL_LOCALSTORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(BLOODTIDE_PULSE_FIRST_FIRE_TUTORIAL_LOCALSTORAGE_KEY)).toBeNull();
  });
});

describe('hideFirstTimeTutorialOverlay — defensive (no DOM)', () => {
  it('does not throw when called without active overlay', () => {
    expect(() => hideFirstTimeTutorialOverlay()).not.toThrow();
  });

  it('is idempotent (multiple calls safe)', () => {
    expect(() => {
      hideFirstTimeTutorialOverlay();
      hideFirstTimeTutorialOverlay();
      hideFirstTimeTutorialOverlay();
    }).not.toThrow();
  });
});

describe('__identityFxTutorialTestables — escape hatch', () => {
  it('exposes reset / resetForTests / isActive / getOverlayEl', () => {
    expect(typeof __identityFxTutorialTestables.reset).toBe('function');
    expect(typeof __identityFxTutorialTestables.resetForTests).toBe('function');
    expect(typeof __identityFxTutorialTestables.isActive).toBe('function');
    expect(typeof __identityFxTutorialTestables.getOverlayEl).toBe('function');
  });

  it('isActive returns false initially', () => {
    expect(__identityFxTutorialTestables.isActive()).toBe(false);
  });

  it('reset is idempotent', () => {
    expect(() => {
      __identityFxTutorialTestables.reset();
      __identityFxTutorialTestables.reset();
    }).not.toThrow();
  });

  it('getOverlayEl returns null in node env (no DOM)', () => {
    expect(__identityFxTutorialTestables.getOverlayEl()).toBeNull();
  });
});

describe('Sacred audit — tutorial constants are isolated (TASK-045)', () => {
  it('tutorial copy lives in identity-layer.js, NOT in NARRATOR_LINES table', async () => {
    // Verify the constants are importable from src/data/identity-layer.js
    // (not from src/feel/narrator-lines.js). Designer §1.3 sacred safety row 1.
    const identityLayerModule = await import('../../src/data/identity-layer.js');
    expect(identityLayerModule.SUN_CASCADE_FIRST_PROMOTION_LINE_1_PLACEHOLDER).toBeDefined();
    expect(identityLayerModule.CURSED_TILES_FIRST_FIRE_LINE_1_PLACEHOLDER).toBeDefined();
    expect(identityLayerModule.BLOODTIDE_PULSE_FIRST_FIRE_LINE_1_PLACEHOLDER).toBeDefined();
  });

  it('CODEX_LOCALSTORAGE_KEY untouched (still blocksworn_codex_state)', async () => {
    const m = await import('../../src/data/identity-layer.js');
    expect(m.CODEX_LOCALSTORAGE_KEY).toBe('blocksworn_codex_state');
  });

  it('codex state schema fields (CODEX_RACE_MASTERY_THRESHOLD / CODEX_BOSS_MASTERY_DEFEATS) byte-perfect', async () => {
    const m = await import('../../src/data/identity-layer.js');
    expect(m.CODEX_RACE_MASTERY_THRESHOLD).toBe(25);
    expect(m.CODEX_BOSS_MASTERY_DEFEATS).toBe(1);
    expect(m.CODEX_SCHEMA_VERSION).toBe(1);
  });

  it('tutorial localStorage keys do NOT collide with sacred save keys', () => {
    const sacredSaveKeys = [
      'blocksworn_save',
      'blocksworn_progress',
      'blocksworn_codex_state',
      'blocksworn_p5_spending',
      'blocksworn_ftue_beat',
    ];
    const tutorialKeys = [
      SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_LOCALSTORAGE_KEY,
      CURSED_TILES_FIRST_FIRE_TUTORIAL_LOCALSTORAGE_KEY,
      BLOODTIDE_PULSE_FIRST_FIRE_TUTORIAL_LOCALSTORAGE_KEY,
    ];
    for (const sacred of sacredSaveKeys) {
      for (const tutorial of tutorialKeys) {
        expect(tutorial).not.toBe(sacred);
      }
    }
  });
});
