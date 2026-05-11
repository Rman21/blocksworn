// 2026-05-11 — TASK-011 (T1.10.9): one-shot migration shim unit tests.
//
// Covers the 9 legacy bare-string keys allow-list (FTUE / intro-video /
// onboarding / 5 chapter-complete / voidfang) + idempotency sentinel +
// graceful skip paths (already-JSON, missing, post-sentinel).
//
// Uses an in-memory localStorage stub so the test never touches the host
// browser's storage. Stub is installed as `globalThis.localStorage` before
// each test and torn down after.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  migrateBareStringKeys,
  LEGACY_BARE_STRING_KEYS,
  MIGRATION_SENTINEL_KEY,
} from '../../src/services/migrate.js';

// Minimal in-memory localStorage shim. Mirrors the Web Storage API surface
// that migrate.js touches (getItem / setItem / removeItem / clear).
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
    // Test-only accessor for assertions.
    _raw(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
  };
}

let _originalLocalStorage;

beforeEach(() => {
  _originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = createMockLocalStorage();
});

afterEach(() => {
  if (_originalLocalStorage === undefined) {
    delete globalThis.localStorage;
  } else {
    globalThis.localStorage = _originalLocalStorage;
  }
});

describe('migrateBareStringKeys (T1.10.9)', () => {
  it('migrates bare-string values to JSON-wrapped form', () => {
    // Seed all 9 known keys with their legacy bare-string wire format.
    localStorage.setItem('blocksworn_ftue_beat', 'pyredrake_fight');
    localStorage.setItem('seenIntroVideo', '1');
    localStorage.setItem('onboardingSeen', '1');
    localStorage.setItem('blocksworn_chapter_1_complete', 'true');
    localStorage.setItem('blocksworn_chapter_2_complete', 'true');
    localStorage.setItem('blocksworn_chapter_3_complete', 'true');
    localStorage.setItem('blocksworn_chapter_4_complete', 'true');
    localStorage.setItem('blocksworn_chapter_5_complete', 'true');
    localStorage.setItem('blocksworn_voidfang_defeated', '1');

    const result = migrateBareStringKeys();

    expect(result.migrated).toBe(9);
    expect(result.alreadyJSON).toBe(0);
    expect(result.missing).toBe(0);
    expect(result.total).toBe(9);
    expect(result.skipped).toBeUndefined();

    // Verify each key is now JSON-wrapped.
    expect(localStorage.getItem('blocksworn_ftue_beat')).toBe('"pyredrake_fight"');
    expect(localStorage.getItem('seenIntroVideo')).toBe('"1"');
    expect(localStorage.getItem('onboardingSeen')).toBe('"1"');
    expect(localStorage.getItem('blocksworn_chapter_1_complete')).toBe('"true"');
    expect(localStorage.getItem('blocksworn_chapter_5_complete')).toBe('"true"');
    expect(localStorage.getItem('blocksworn_voidfang_defeated')).toBe('"1"');

    // Sentinel stamped.
    expect(localStorage.getItem(MIGRATION_SENTINEL_KEY)).toBe('"true"');
  });

  it('skips already-JSON values (alreadyJSON counter increments)', () => {
    // Seed a mix: 3 already-JSON, 0 bare-string.
    localStorage.setItem('blocksworn_ftue_beat', '"pyredrake_fight"');
    localStorage.setItem('seenIntroVideo', '"1"');
    localStorage.setItem('blocksworn_chapter_1_complete', '"true"');

    const result = migrateBareStringKeys();

    expect(result.migrated).toBe(0);
    expect(result.alreadyJSON).toBe(3);
    expect(result.missing).toBe(6); // remaining 6 keys are absent
    expect(result.total).toBe(9);

    // Already-JSON values are NOT re-wrapped.
    expect(localStorage.getItem('blocksworn_ftue_beat')).toBe('"pyredrake_fight"');
    expect(localStorage.getItem('seenIntroVideo')).toBe('"1"');
    expect(localStorage.getItem('blocksworn_chapter_1_complete')).toBe('"true"');
  });

  it('counts missing keys when nothing is stored', () => {
    const result = migrateBareStringKeys();

    expect(result.migrated).toBe(0);
    expect(result.alreadyJSON).toBe(0);
    expect(result.missing).toBe(9);
    expect(result.total).toBe(9);

    // Sentinel still stamped — second-boot path must short-circuit.
    expect(localStorage.getItem(MIGRATION_SENTINEL_KEY)).toBe('"true"');
  });

  it('subsequent calls short-circuit via sentinel', () => {
    // First call seeds + migrates.
    localStorage.setItem('blocksworn_ftue_beat', 'pyredrake_fight');
    const first = migrateBareStringKeys();
    expect(first.migrated).toBe(1);
    expect(first.skipped).toBeUndefined();

    // Plant a NEW bare-string value that would otherwise be migrated.
    localStorage.setItem('blocksworn_voidfang_defeated', '1');

    // Second call must short-circuit on the sentinel and NOT touch the
    // new bare-string value (T1.12 will call this on every boot — second
    // boot must be O(1) and side-effect-free).
    const second = migrateBareStringKeys();
    expect(second).toEqual({
      migrated: 0,
      alreadyJSON: 0,
      missing: 0,
      total: 9,
      skipped: 'sentinel',
    });
    expect(localStorage.getItem('blocksworn_voidfang_defeated')).toBe('1');
  });

  it('allow-list covers all 9 known bare-string keys', () => {
    // Pin the allow-list contents — any future addition / removal must
    // update this test and the migration shim's audit trail in sync.
    expect(LEGACY_BARE_STRING_KEYS).toHaveLength(9);
    expect(LEGACY_BARE_STRING_KEYS).toEqual([
      'blocksworn_ftue_beat',
      'seenIntroVideo',
      'onboardingSeen',
      'blocksworn_chapter_1_complete',
      'blocksworn_chapter_2_complete',
      'blocksworn_chapter_3_complete',
      'blocksworn_chapter_4_complete',
      'blocksworn_chapter_5_complete',
      'blocksworn_voidfang_defeated',
    ]);
    // Allow-list is frozen — any accidental push() must throw.
    expect(Object.isFrozen(LEGACY_BARE_STRING_KEYS)).toBe(true);
  });
});
