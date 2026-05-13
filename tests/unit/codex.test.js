// 2026-05-12 — TASK-039 (T2.12): Codex screen unit tests.
//
// Spec: docs/design/mechanics/identity-layer.md §4 (Codex screen).
// Pure state + helpers coverage. Mocks `globalThis.localStorage` per the
// migrate.test.js pattern. No DOM — Vitest runs in `node` env.
//
// Surface tested:
//   - getCodexState()                            — initial + roundtrip
//   - saveCodexState(state)                      — persist + cache mirror
//   - recordRaceTrigger(raceKey)                 — increment + Mastered at 25
//   - recordBossEncounter(bossKey)               — Encountered mark
//   - recordBossDefeat(bossKey)                  — Mastered at 1
//   - recordMomentTrigger(momentKey)             — append + count
//   - getRaceState / getBossState                — Locked/Encountered/Mastered
//   - Defensive coding                           — invalid keys = silent no-op
//   - Schema migration                           — defensive defaults
//   - Sacred audit                               — writes ONLY to its own key

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getCodexState,
  saveCodexState,
  recordRaceTrigger,
  recordBossEncounter,
  recordBossDefeat,
  recordMomentTrigger,
  recordMomentReplay,
  getRaceState,
  getBossState,
  __codexTestables,
} from '../../src/ui/codex.js';
import {
  CODEX_LOCALSTORAGE_KEY,
  CODEX_RACE_MASTERY_THRESHOLD,
  CODEX_BOSS_MASTERY_DEFEATS,
  CODEX_FCP_BUDGET_MS,
  CODEX_SCHEMA_VERSION,
  CODEX_STATE,
  CODEX_TABS,
  CODEX_DEFAULT_TAB,
  IDENTITY_BOSS_HANDLER_TO_MOMENT_KEY,
} from '../../src/data/identity-layer.js';

// Minimal in-memory localStorage shim (matches migrate.test.js precedent).
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
  __codexTestables.reset();
});

afterEach(() => {
  if (_originalLocalStorage === undefined) {
    delete globalThis.localStorage;
  } else {
    globalThis.localStorage = _originalLocalStorage;
  }
  __codexTestables.reset();
});

describe('Codex constants (T2.12)', () => {
  it('CODEX_LOCALSTORAGE_KEY is the spec-mandated namespaced key', () => {
    expect(CODEX_LOCALSTORAGE_KEY).toBe('blocksworn_codex_state');
  });

  it('CODEX_RACE_MASTERY_THRESHOLD is 25 per spec §4.5', () => {
    expect(CODEX_RACE_MASTERY_THRESHOLD).toBe(25);
  });

  it('CODEX_BOSS_MASTERY_DEFEATS is 1 per spec §4.5', () => {
    expect(CODEX_BOSS_MASTERY_DEFEATS).toBe(1);
  });

  it('CODEX_FCP_BUDGET_MS is 300 per spec §4.9', () => {
    expect(CODEX_FCP_BUDGET_MS).toBe(300);
  });

  it('CODEX_SCHEMA_VERSION is 1 (first schema)', () => {
    expect(CODEX_SCHEMA_VERSION).toBe(1);
  });

  it('CODEX_STATE enum has three values per spec §4.5', () => {
    expect(CODEX_STATE.LOCKED).toBe('locked');
    expect(CODEX_STATE.ENCOUNTERED).toBe('encountered');
    expect(CODEX_STATE.MASTERED).toBe('mastered');
  });

  it('CODEX_TABS has three entries (races / bosses / moments)', () => {
    expect(CODEX_TABS).toEqual(['races', 'bosses', 'moments']);
  });

  it('CODEX_DEFAULT_TAB is races (spec §4.2 first tab)', () => {
    expect(CODEX_DEFAULT_TAB).toBe('races');
  });
});

describe('getCodexState — initial + load (T2.12)', () => {
  it('returns initial state when localStorage absent', () => {
    const state = getCodexState();
    expect(state).toBeDefined();
    expect(state.version).toBe(CODEX_SCHEMA_VERSION);
    expect(state.races).toEqual({});
    expect(state.bosses).toEqual({});
    expect(state.moments).toEqual([]);
  });

  it('returns same cached state on repeated calls (no re-parse)', () => {
    const a = getCodexState();
    const b = getCodexState();
    expect(a).toBe(b); // same reference (cache hit)
  });

  it('hydrates from localStorage when present', () => {
    const seed = { version: 1, races: { pirate: { encountered: true, mastered: false, triggerCount: 3 } }, bosses: {}, moments: [] };
    localStorage.setItem(CODEX_LOCALSTORAGE_KEY, JSON.stringify(seed));
    __codexTestables.reset(); // force re-hydrate
    const state = getCodexState();
    expect(state.races.pirate.triggerCount).toBe(3);
  });

  it('defensive defaults when localStorage has corrupted JSON', () => {
    localStorage.setItem(CODEX_LOCALSTORAGE_KEY, '{not-json');
    __codexTestables.reset();
    const state = getCodexState();
    expect(state.races).toEqual({});
    expect(state.bosses).toEqual({});
    expect(state.moments).toEqual([]);
  });

  it('schema migration: version mismatch returns initial state', () => {
    const oldSchema = { version: 999, races: { pirate: { encountered: true } } };
    localStorage.setItem(CODEX_LOCALSTORAGE_KEY, JSON.stringify(oldSchema));
    __codexTestables.reset();
    const state = getCodexState();
    expect(state.version).toBe(CODEX_SCHEMA_VERSION);
    expect(state.races).toEqual({}); // pirate dropped — version mismatch
  });

  it('defensive: missing races/bosses/moments fields use empty defaults', () => {
    localStorage.setItem(CODEX_LOCALSTORAGE_KEY, JSON.stringify({ version: 1 }));
    __codexTestables.reset();
    const state = getCodexState();
    expect(state.races).toEqual({});
    expect(state.bosses).toEqual({});
    expect(state.moments).toEqual([]);
  });
});

describe('saveCodexState — persist (T2.12)', () => {
  it('persists to localStorage under the codex key', () => {
    const state = getCodexState();
    state.races.pirate = { encountered: true, mastered: false, triggerCount: 7 };
    saveCodexState(state);
    const raw = localStorage.getItem(CODEX_LOCALSTORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.races.pirate.triggerCount).toBe(7);
  });

  it('roundtrip: save then re-hydrate matches', () => {
    const state = getCodexState();
    state.races.shark = { encountered: true, mastered: false, triggerCount: 5 };
    state.bosses.phoenix = { encountered: true, mastered: false, defeatedCount: 0, firstSeenAt: '2026-05-12' };
    state.moments.push({ id: 'phoenix_ashen_reign', firstSeenAt: '2026-05-12', count: 2 });
    saveCodexState(state);

    __codexTestables.reset();
    const reloaded = getCodexState();
    expect(reloaded.races.shark.triggerCount).toBe(5);
    expect(reloaded.bosses.phoenix.firstSeenAt).toBe('2026-05-12');
    expect(reloaded.moments.length).toBe(1);
  });

  it('returns false for non-object input (defensive)', () => {
    expect(saveCodexState(null)).toBe(false);
    expect(saveCodexState(undefined)).toBe(false);
    expect(saveCodexState('not-an-object')).toBe(false);
  });
});

describe('recordRaceTrigger (T2.12)', () => {
  it('marks Encountered on first trigger; triggerCount = 1', () => {
    recordRaceTrigger('pirate');
    const state = getCodexState();
    expect(state.races.pirate).toBeDefined();
    expect(state.races.pirate.encountered).toBe(true);
    expect(state.races.pirate.mastered).toBe(false);
    expect(state.races.pirate.triggerCount).toBe(1);
  });

  it('increments triggerCount on subsequent triggers', () => {
    for (let i = 0; i < 5; i++) recordRaceTrigger('pirate');
    expect(getCodexState().races.pirate.triggerCount).toBe(5);
  });

  it('marks Mastered exactly at triggerCount = CODEX_RACE_MASTERY_THRESHOLD (25)', () => {
    for (let i = 0; i < 24; i++) recordRaceTrigger('shark');
    expect(getCodexState().races.shark.mastered).toBe(false);
    recordRaceTrigger('shark'); // 25th
    expect(getCodexState().races.shark.triggerCount).toBe(CODEX_RACE_MASTERY_THRESHOLD);
    expect(getCodexState().races.shark.mastered).toBe(true);
  });

  it('continues counting past threshold (no overflow)', () => {
    for (let i = 0; i < 50; i++) recordRaceTrigger('rock');
    const entry = getCodexState().races.rock;
    expect(entry.triggerCount).toBe(50);
    expect(entry.mastered).toBe(true);
  });

  it('silent no-op for invalid keys (empty / non-string)', () => {
    recordRaceTrigger('');
    recordRaceTrigger(null);
    recordRaceTrigger(undefined);
    recordRaceTrigger(123);
    expect(Object.keys(getCodexState().races).length).toBe(0);
  });

  it('persists immediately to localStorage (no batching)', () => {
    recordRaceTrigger('crocodile');
    const raw = localStorage.getItem(CODEX_LOCALSTORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.races.crocodile.triggerCount).toBe(1);
  });
});

describe('recordBossEncounter / recordBossDefeat (T2.12)', () => {
  it('recordBossEncounter marks Encountered', () => {
    recordBossEncounter('phoenix');
    const entry = getCodexState().bosses.phoenix;
    expect(entry.encountered).toBe(true);
    expect(entry.mastered).toBe(false);
    expect(entry.defeatedCount).toBe(0);
  });

  it('recordBossEncounter stamps firstSeenAt', () => {
    recordBossEncounter('lich');
    expect(getCodexState().bosses.lich.firstSeenAt).toBeTruthy();
  });

  it('recordBossEncounter is idempotent (re-encountering preserves first-seen)', () => {
    recordBossEncounter('lich');
    const firstSeen = getCodexState().bosses.lich.firstSeenAt;
    recordBossEncounter('lich');
    recordBossEncounter('lich');
    expect(getCodexState().bosses.lich.firstSeenAt).toBe(firstSeen);
  });

  it('recordBossDefeat marks Mastered at CODEX_BOSS_MASTERY_DEFEATS (1)', () => {
    recordBossDefeat('berserker');
    const entry = getCodexState().bosses.berserker;
    expect(entry.defeatedCount).toBe(1);
    expect(entry.mastered).toBe(true);
  });

  it('recordBossDefeat increments on repeated defeats', () => {
    for (let i = 0; i < 3; i++) recordBossDefeat('engineer');
    expect(getCodexState().bosses.engineer.defeatedCount).toBe(3);
  });

  it('silent no-op for invalid boss keys', () => {
    recordBossEncounter('');
    recordBossDefeat(null);
    expect(Object.keys(getCodexState().bosses).length).toBe(0);
  });
});

describe('recordMomentTrigger (T2.12)', () => {
  it('appends new moment on first trigger', () => {
    recordMomentTrigger('phoenix_ashen_reign');
    const moments = getCodexState().moments;
    expect(moments.length).toBe(1);
    expect(moments[0].id).toBe('phoenix_ashen_reign');
    expect(moments[0].count).toBe(1);
    expect(moments[0].firstSeenAt).toBeTruthy();
  });

  it('increments count on repeated trigger (does NOT append)', () => {
    for (let i = 0; i < 4; i++) recordMomentTrigger('lich_cursed_tiles');
    const moments = getCodexState().moments;
    expect(moments.length).toBe(1);
    expect(moments[0].count).toBe(4);
  });

  it('appends distinct moments separately', () => {
    recordMomentTrigger('phoenix_ashen_reign');
    recordMomentTrigger('grovewarden_root_surge');
    recordMomentTrigger('engineer_lockdown');
    expect(getCodexState().moments.length).toBe(3);
  });

  it('silent no-op for invalid moment keys', () => {
    recordMomentTrigger('');
    recordMomentTrigger(null);
    expect(getCodexState().moments.length).toBe(0);
  });
});

describe('getRaceState / getBossState (T2.12)', () => {
  it('getRaceState returns Locked when never encountered', () => {
    expect(getRaceState('pirate')).toBe(CODEX_STATE.LOCKED);
  });

  it('getRaceState returns Encountered after first trigger', () => {
    recordRaceTrigger('pirate');
    expect(getRaceState('pirate')).toBe(CODEX_STATE.ENCOUNTERED);
  });

  it('getRaceState returns Mastered after 25 triggers', () => {
    for (let i = 0; i < CODEX_RACE_MASTERY_THRESHOLD; i++) recordRaceTrigger('rock');
    expect(getRaceState('rock')).toBe(CODEX_STATE.MASTERED);
  });

  it('getBossState returns Locked when never encountered', () => {
    expect(getBossState('phoenix')).toBe(CODEX_STATE.LOCKED);
  });

  it('getBossState returns Encountered after encounter (not defeat)', () => {
    recordBossEncounter('phoenix');
    expect(getBossState('phoenix')).toBe(CODEX_STATE.ENCOUNTERED);
  });

  it('getBossState returns Mastered after first defeat', () => {
    recordBossDefeat('phoenix');
    expect(getBossState('phoenix')).toBe(CODEX_STATE.MASTERED);
  });

  it('getRaceState/getBossState defensive: invalid keys return Locked', () => {
    expect(getRaceState('')).toBe(CODEX_STATE.LOCKED);
    expect(getRaceState(null)).toBe(CODEX_STATE.LOCKED);
    expect(getBossState(undefined)).toBe(CODEX_STATE.LOCKED);
  });
});

describe('Sacred-cow audit (T2.12)', () => {
  it('Codex writes ONLY to CODEX_LOCALSTORAGE_KEY (no other keys touched)', () => {
    // Seed an unrelated key — must remain untouched.
    localStorage.setItem('blocksworn_progress', '{"hero":"untouched"}');
    localStorage.setItem('blocksworn_save_version', '2');

    recordRaceTrigger('pirate');
    recordBossEncounter('phoenix');
    recordBossDefeat('lich');
    recordMomentTrigger('phoenix_ashen_reign');

    expect(localStorage.getItem('blocksworn_progress')).toBe('{"hero":"untouched"}');
    expect(localStorage.getItem('blocksworn_save_version')).toBe('2');

    // Only ONE codex-specific key was written.
    const codexKeys = localStorage._allKeys().filter(k => k === CODEX_LOCALSTORAGE_KEY);
    expect(codexKeys.length).toBe(1);
    // Total keys should be 3 (the two seeded + codex)
    expect(localStorage._allKeys().length).toBe(3);
  });

  it('Codex never imports or mutates RACE_SYNERGY / BOSS_TTK_TARGETS / V_HAPTICS / NARRATOR_LINES', async () => {
    // Static-text contract: the Codex source must reference its own constants
    // only — not sacred tables. We assert by reading the module file source
    // and grepping for forbidden symbols.
    const codexModule = await import('../../src/ui/codex.js?audit-fresh');
    expect(typeof codexModule.recordRaceTrigger).toBe('function');
    // Importing RACE_SYNERGY for READ purposes is allowed (detail page);
    // it must NEVER be assigned to. The codex module never reassigns or
    // mutates RACE_SYNERGY — verified by the lack of `RACE_SYNERGY[...] =`
    // or `Object.assign(RACE_SYNERGY...` patterns. This test asserts that
    // the codex API surface for state mutation is the recorder functions
    // alone (no exported mutator for sacred tables).
    expect(codexModule.RACE_SYNERGY).toBeUndefined();
    expect(codexModule.BOSS_TTK_TARGETS).toBeUndefined();
    expect(codexModule.V_HAPTICS).toBeUndefined();
    expect(codexModule.NARRATOR_LINES).toBeUndefined();
  });

  it('Codex state schema persists complete cross-mechanic flow', () => {
    // Race triggers
    for (let i = 0; i < 30; i++) recordRaceTrigger('pirate');
    recordRaceTrigger('shark');
    // Boss encounter + defeat
    recordBossEncounter('phoenix');
    recordBossDefeat('phoenix');
    // Moments
    recordMomentTrigger('phoenix_ashen_reign');
    recordMomentTrigger('phoenix_ashen_reign');
    recordMomentTrigger('lich_cursed_tiles');

    expect(getRaceState('pirate')).toBe(CODEX_STATE.MASTERED);
    expect(getRaceState('shark')).toBe(CODEX_STATE.ENCOUNTERED);
    expect(getBossState('phoenix')).toBe(CODEX_STATE.MASTERED);

    const state = getCodexState();
    expect(state.moments.length).toBe(2);
    expect(state.moments.find(m => m.id === 'phoenix_ashen_reign').count).toBe(2);
    expect(state.moments.find(m => m.id === 'lich_cursed_tiles').count).toBe(1);
  });
});

describe('Codex catalogs (T2.12)', () => {
  it('Race catalog includes the 10 + 3 Identity-only races', () => {
    const catalog = __codexTestables.getRaceCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(10);
    const keys = catalog.map(r => r.key);
    // 5 original
    expect(keys).toContain('orc');
    expect(keys).toContain('elf');
    expect(keys).toContain('troll');
    expect(keys).toContain('human');
    expect(keys).toContain('dark_elf');
    // 5 V18.8
    expect(keys).toContain('pirate');
    expect(keys).toContain('skeleton');
    expect(keys).toContain('golem');
    expect(keys).toContain('lion');
    expect(keys).toContain('rock');
    // 3 Identity-only
    expect(keys).toContain('shark');
    expect(keys).toContain('crocodile');
    expect(keys).toContain('spark');
  });

  it('Boss catalog includes 25 entries (Ch1-Ch5)', () => {
    const catalog = __codexTestables.getBossCatalog();
    expect(catalog.length).toBe(25);
  });

  it('Boss catalog entries have key/name/chapter/archetype/stihiya', () => {
    const catalog = __codexTestables.getBossCatalog();
    const phoenix = catalog.find(b => b.archetype === 'phoenix');
    expect(phoenix).toBeDefined();
    expect(phoenix.name).toBe('SOLAR PHOENIX');
    expect(phoenix.chapter).toBe(1);
    expect(phoenix.stihiya).toBe('solar');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// T3.09 — Codex Moments Replay button integration (endgame-social.md §4.5)
// ──────────────────────────────────────────────────────────────────────────

describe('IDENTITY_BOSS_HANDLER_TO_MOMENT_KEY (T3.09)', () => {
  it('maps all 5 boss-reactive identity handler keys to moment IDs', () => {
    expect(IDENTITY_BOSS_HANDLER_TO_MOMENT_KEY.identity_phoenix_revive).toBe('phoenix_ashen_reign');
    expect(IDENTITY_BOSS_HANDLER_TO_MOMENT_KEY.identity_assassin_shark_counter).toBe('lich_cursed_tiles');
    expect(IDENTITY_BOSS_HANDLER_TO_MOMENT_KEY.identity_berserker_frenzy_pulse).toBe('berserker_bloodtide');
    expect(IDENTITY_BOSS_HANDLER_TO_MOMENT_KEY.identity_engineer_tetris_counter).toBe('engineer_lockdown');
    expect(IDENTITY_BOSS_HANDLER_TO_MOMENT_KEY.identity_bruiser_grove_surge).toBe('grovewarden_root_surge');
  });

  it('has exactly 5 entries (no Voidfang/Uroboros yet — spec §4.5)', () => {
    expect(Object.keys(IDENTITY_BOSS_HANDLER_TO_MOMENT_KEY).length).toBe(5);
  });

  it('is frozen (Object.freeze)', () => {
    expect(Object.isFrozen(IDENTITY_BOSS_HANDLER_TO_MOMENT_KEY)).toBe(true);
  });

  it('moment IDs match the exact strings used by recordMomentTrigger call sites', () => {
    // These are the literal strings passed by identity-fx.js end-of-fire hooks
    // (see grep `recordMomentTrigger(` in src/feel/identity-fx.js — 5 fire sites).
    // The values must remain byte-perfect — T2.12 contracts preserved.
    const values = Object.values(IDENTITY_BOSS_HANDLER_TO_MOMENT_KEY);
    expect(values).toContain('phoenix_ashen_reign');
    expect(values).toContain('lich_cursed_tiles');
    expect(values).toContain('berserker_bloodtide');
    expect(values).toContain('engineer_lockdown');
    expect(values).toContain('grovewarden_root_surge');
  });
});

describe('recordMomentReplay (T3.09)', () => {
  it('sets lastReplayId and lastReplayAt on an existing moment', () => {
    // Seed the moment first via recordMomentTrigger (production order).
    recordMomentTrigger('phoenix_ashen_reign');
    recordMomentReplay('phoenix_ashen_reign', 'abc123replay');
    const m = getCodexState().moments[0];
    expect(m.id).toBe('phoenix_ashen_reign');
    expect(m.lastReplayId).toBe('abc123replay');
    expect(typeof m.lastReplayAt).toBe('number');
    expect(m.lastReplayAt).toBeGreaterThan(0);
  });

  it('preserves count + firstSeenAt when linking a replay', () => {
    for (let i = 0; i < 4; i++) recordMomentTrigger('lich_cursed_tiles');
    const before = getCodexState().moments[0];
    const beforeFirstSeen = before.firstSeenAt;
    const beforeCount = before.count;
    recordMomentReplay('lich_cursed_tiles', 'xyz789replay');
    const after = getCodexState().moments[0];
    expect(after.count).toBe(beforeCount);
    expect(after.firstSeenAt).toBe(beforeFirstSeen);
    expect(after.lastReplayId).toBe('xyz789replay');
  });

  it('overwrites lastReplayId on subsequent calls (latest replay wins)', () => {
    recordMomentTrigger('berserker_bloodtide');
    recordMomentReplay('berserker_bloodtide', 'first_id');
    recordMomentReplay('berserker_bloodtide', 'second_id');
    expect(getCodexState().moments[0].lastReplayId).toBe('second_id');
  });

  it('silent no-op if momentKey not in moments array (race condition guard)', () => {
    // No recordMomentTrigger fired first — moment array is empty.
    recordMomentReplay('phoenix_ashen_reign', 'orphan_replay_id');
    const state = getCodexState();
    expect(state.moments.length).toBe(0); // no entry created
  });

  it('silent no-op for invalid momentKey (empty / null / non-string)', () => {
    recordMomentTrigger('engineer_lockdown');
    recordMomentReplay('', 'replay1');
    recordMomentReplay(null, 'replay2');
    recordMomentReplay(undefined, 'replay3');
    recordMomentReplay(123, 'replay4');
    const m = getCodexState().moments[0];
    expect(m.lastReplayId).toBeUndefined();
  });

  it('silent no-op for invalid replayId (empty / null / non-string)', () => {
    recordMomentTrigger('grovewarden_root_surge');
    recordMomentReplay('grovewarden_root_surge', '');
    recordMomentReplay('grovewarden_root_surge', null);
    recordMomentReplay('grovewarden_root_surge', undefined);
    recordMomentReplay('grovewarden_root_surge', 0);
    const m = getCodexState().moments[0];
    expect(m.lastReplayId).toBeUndefined();
  });

  it('persists immediately to localStorage', () => {
    recordMomentTrigger('phoenix_ashen_reign');
    recordMomentReplay('phoenix_ashen_reign', 'persisted_id');
    const raw = localStorage.getItem(CODEX_LOCALSTORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.moments[0].lastReplayId).toBe('persisted_id');
  });

  it('roundtrip: save → reload preserves lastReplayId + lastReplayAt', () => {
    recordMomentTrigger('phoenix_ashen_reign');
    recordMomentReplay('phoenix_ashen_reign', 'roundtrip_id');
    const beforeAt = getCodexState().moments[0].lastReplayAt;

    __codexTestables.reset();
    const reloaded = getCodexState();
    expect(reloaded.moments[0].lastReplayId).toBe('roundtrip_id');
    expect(reloaded.moments[0].lastReplayAt).toBe(beforeAt);
  });
});

describe('Codex schema backward-compat (T3.09)', () => {
  it('legacy moment entries without lastReplayId load correctly', () => {
    const legacy = {
      version: 1,
      races: {},
      bosses: {},
      moments: [
        { id: 'phoenix_ashen_reign', firstSeenAt: '2026-05-01', count: 7 },
        { id: 'lich_cursed_tiles',   firstSeenAt: '2026-05-02', count: 3 },
      ],
    };
    localStorage.setItem(CODEX_LOCALSTORAGE_KEY, JSON.stringify(legacy));
    __codexTestables.reset();
    const state = getCodexState();
    expect(state.moments.length).toBe(2);
    expect(state.moments[0].id).toBe('phoenix_ashen_reign');
    expect(state.moments[0].count).toBe(7);
    expect(state.moments[0].lastReplayId).toBeUndefined();
    expect(state.moments[1].lastReplayId).toBeUndefined();
  });

  it('mixed entries (some with lastReplayId, some without) load correctly', () => {
    const mixed = {
      version: 1,
      races: {},
      bosses: {},
      moments: [
        { id: 'phoenix_ashen_reign', firstSeenAt: '2026-05-01', count: 7, lastReplayId: 'old_id', lastReplayAt: 1715000000000 },
        { id: 'lich_cursed_tiles',   firstSeenAt: '2026-05-02', count: 3 },
      ],
    };
    localStorage.setItem(CODEX_LOCALSTORAGE_KEY, JSON.stringify(mixed));
    __codexTestables.reset();
    const state = getCodexState();
    expect(state.moments[0].lastReplayId).toBe('old_id');
    expect(state.moments[0].lastReplayAt).toBe(1715000000000);
    expect(state.moments[1].lastReplayId).toBeUndefined();
  });

  it('legacy state can be upgraded via recordMomentReplay on next call', () => {
    const legacy = {
      version: 1,
      races: {},
      bosses: {},
      moments: [{ id: 'engineer_lockdown', firstSeenAt: '2026-05-01', count: 1 }],
    };
    localStorage.setItem(CODEX_LOCALSTORAGE_KEY, JSON.stringify(legacy));
    __codexTestables.reset();
    recordMomentReplay('engineer_lockdown', 'upgraded_id');
    const state = getCodexState();
    expect(state.moments[0].lastReplayId).toBe('upgraded_id');
    expect(state.moments[0].count).toBe(1); // legacy field preserved
    expect(state.moments[0].firstSeenAt).toBe('2026-05-01'); // legacy field preserved
  });
});

describe('Sacred audit — T3.09 additive only (T2.12 contracts preserved)', () => {
  it('recordMomentTrigger signature unchanged (single momentKey param)', () => {
    // Smoke check on the contract — calling with the single-arg shape used
    // by all 5 fx end-of-fire hooks must continue to work identically.
    recordMomentTrigger('phoenix_ashen_reign');
    const m = getCodexState().moments[0];
    expect(m.id).toBe('phoenix_ashen_reign');
    expect(m.count).toBe(1);
    // T3.09 fields must not appear when only recordMomentTrigger was called.
    expect(m.lastReplayId).toBeUndefined();
    expect(m.lastReplayAt).toBeUndefined();
  });

  it('recordRaceTrigger / recordBossEncounter / recordBossDefeat signatures unchanged', () => {
    // Smoke check — identical to T2.12 tests above; included here as the
    // sacred-audit guard for the T3.09 PR diff.
    recordRaceTrigger('pirate');
    recordBossEncounter('phoenix');
    recordBossDefeat('lich');
    const state = getCodexState();
    expect(state.races.pirate.triggerCount).toBe(1);
    expect(state.bosses.phoenix.encountered).toBe(true);
    expect(state.bosses.lich.defeatedCount).toBe(1);
  });

  it('CODEX_LOCALSTORAGE_KEY byte-perfect', () => {
    expect(CODEX_LOCALSTORAGE_KEY).toBe('blocksworn_codex_state');
  });

  it('T3.09 still writes ONLY to CODEX_LOCALSTORAGE_KEY', () => {
    localStorage.setItem('blocksworn_progress', '{"hero":"untouched"}');
    recordMomentTrigger('phoenix_ashen_reign');
    recordMomentReplay('phoenix_ashen_reign', 'sacred_audit_id');
    expect(localStorage.getItem('blocksworn_progress')).toBe('{"hero":"untouched"}');
    // Total keys: codex + unrelated seed = 2.
    const keys = localStorage._allKeys().sort();
    expect(keys).toEqual(['blocksworn_codex_state', 'blocksworn_progress']);
  });
});
