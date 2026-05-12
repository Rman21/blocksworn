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
  migrateRemoveArtifacts,
  LEGACY_ARTIFACT_STORAGE_KEYS,
  ARTIFACTS_REMOVED_SENTINEL_KEY,
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

describe('migrateRemoveArtifacts (T1.14)', () => {
  it('removes known artifact localStorage keys + strips save fields', () => {
    // Seed every artifact-related key the legacy ever wrote.
    for (const k of LEGACY_ARTIFACT_STORAGE_KEYS) {
      localStorage.setItem(k, '"seed"');
    }
    // Seed an aggregated progress save with legacy artifact fields.
    localStorage.setItem('blocksworn_progress', JSON.stringify({
      essences: { ember: 2 },
      heroUpgrades: {},
      bossesDefeated: 0,
      artifactsOwned: { orc_ring: { 1: 3 } },
      equippedArtifacts: ['orc_ring', null, null, null, null],
      artDropPityCounter: 1,
      _v: 17,
    }));

    const result = migrateRemoveArtifacts();

    expect(result.removed).toBe(LEGACY_ARTIFACT_STORAGE_KEYS.length);
    expect(result.savePatched).toBe(true);
    expect(result.skipped).toBeUndefined();

    // Every key removed.
    for (const k of LEGACY_ARTIFACT_STORAGE_KEYS) {
      expect(localStorage.getItem(k)).toBeNull();
    }

    // Save stripped of artifact fields but preserves everything else.
    const patched = JSON.parse(localStorage.getItem('blocksworn_progress'));
    expect(patched.artifactsOwned).toBeUndefined();
    expect(patched.equippedArtifacts).toBeUndefined();
    expect(patched.artDropPityCounter).toBeUndefined();
    expect(patched.essences).toEqual({ ember: 2 });
    expect(patched._v).toBe(17);

    // Sentinel stamped.
    expect(localStorage.getItem(ARTIFACTS_REMOVED_SENTINEL_KEY)).toBe('"true"');
  });

  it('subsequent calls short-circuit via sentinel', () => {
    localStorage.setItem('blocksworn_artifact_pity', '"seed"');
    const first = migrateRemoveArtifacts();
    expect(first.removed).toBe(1);
    expect(first.skipped).toBeUndefined();

    // Plant a NEW artifact key — second call must NOT touch it because
    // the sentinel short-circuits.
    localStorage.setItem('blocksworn_artifact_inventory', '"replant"');
    const second = migrateRemoveArtifacts();
    expect(second).toEqual({ removed: 0, savePatched: false, skipped: 'sentinel' });
    expect(localStorage.getItem('blocksworn_artifact_inventory')).toBe('"replant"');
  });

  it('handles missing save + corrupt save gracefully', () => {
    // No 'blocksworn_progress' key at all.
    const noSave = migrateRemoveArtifacts();
    expect(noSave.removed).toBe(0);
    expect(noSave.savePatched).toBe(false);
    expect(localStorage.getItem(ARTIFACTS_REMOVED_SENTINEL_KEY)).toBe('"true"');

    // Wipe + retry with corrupt save (sentinel was stamped on first run).
    localStorage.clear();
    localStorage.setItem('blocksworn_progress', '{not json');
    const corrupt = migrateRemoveArtifacts();
    // Sentinel had been removed by clear(); fresh run — corrupt JSON is
    // silently swallowed by JSON.parse try/catch (savePatched stays false).
    expect(corrupt.removed).toBe(0);
    expect(corrupt.savePatched).toBe(false);
    // Sentinel still gets stamped so we don't loop forever on corrupt data.
    expect(localStorage.getItem(ARTIFACTS_REMOVED_SENTINEL_KEY)).toBe('"true"');
    // Corrupt save left untouched (don't make corrupt data worse).
    expect(localStorage.getItem('blocksworn_progress')).toBe('{not json');
  });

  it('allow-list is frozen + covers the legacy cleanup keys', () => {
    expect(Object.isFrozen(LEGACY_ARTIFACT_STORAGE_KEYS)).toBe(true);
    // Pin the keys the legacy P5 cleanup (29959-29964) + legacy
    // _migrateArtifactStorageCleanup (38808-38809) ever wrote.
    expect(LEGACY_ARTIFACT_STORAGE_KEYS).toContain('blocksworn_equipped_artifacts');
    expect(LEGACY_ARTIFACT_STORAGE_KEYS).toContain('blocksworn_artifact_inventory');
    expect(LEGACY_ARTIFACT_STORAGE_KEYS).toContain('blocksworn_artifact_history');
    expect(LEGACY_ARTIFACT_STORAGE_KEYS).toContain('blocksworn_artifact_pity');
  });
});
