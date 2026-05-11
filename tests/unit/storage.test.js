// 2026-05-11 — TASK-009 (T1.08): first unit tests in the project.
// Covers the storage abstraction's mock-mode roundtrip. Real-localStorage
// behavior is covered indirectly by smoke/visual tests once T1.10 rewires
// callers; T1.14 will add migration-specific unit tests on top.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  setMockMode, isMockMode,
  getItem, setItem, removeItem, clear,
  STORAGE_VERSION, migrate,
} from '../../src/services/storage.js';

beforeEach(() => {
  setMockMode(true);
  clear();
});

describe('storage (mock mode)', () => {
  it('mock mode is enabled by the beforeEach hook', () => {
    expect(isMockMode()).toBe(true);
  });

  it('getItem returns defaultValue when key is absent', () => {
    expect(getItem('missing', 'fallback')).toBe('fallback');
    expect(getItem('also-missing')).toBe(null);
  });

  it('setItem then getItem roundtrips a plain object', () => {
    setItem('player', { hp: 100, gold: 250 });
    expect(getItem('player')).toEqual({ hp: 100, gold: 250 });
  });

  it('removeItem clears the key (subsequent getItem returns default)', () => {
    setItem('streak', 7);
    expect(getItem('streak')).toBe(7);
    removeItem('streak');
    expect(getItem('streak', 'gone')).toBe('gone');
  });

  it('clear wipes every key', () => {
    setItem('a', 1);
    setItem('b', { nested: true });
    setItem('c', 'literal');
    clear();
    expect(getItem('a', 'gone')).toBe('gone');
    expect(getItem('b', 'gone')).toBe('gone');
    expect(getItem('c', 'gone')).toBe('gone');
  });

  it('STORAGE_VERSION is exported as 1 and migrate is a no-op for T1.08', () => {
    expect(STORAGE_VERSION).toBe(1);
    expect(migrate(0, 1)).toEqual({ ok: true, migrated: 0 });
  });
});
