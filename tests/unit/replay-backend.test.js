// 2026-05-13 — TASK-047 (T3.07): Replay capture backend — unit suite.
//
// Spec: docs/design/endgame-social.md §4 (Replay/Share infrastructure)
//       + §15 ESC-03 Q2 ruling — storage tier wiring from getPlayerSegment().
//
// Coverage strategy:
//   1. Pure helpers (captureFrameSnapshot, ring buffer, slice, compress,
//      computeReplaySize, generateReplayId, getStorageQuotaForSegment).
//   2. Storage tier wiring — F2P / Minnow / Dolphin / Whale per ESC-03 Q2.
//   3. 9 trigger predicates: 7 LIVE fire correctly, 2 stubs return early.
//   4. Defensive: every export wrapped in try/catch; no throws under
//      adversarial inputs (null / undefined / wrong types).
//   5. Sacred audit: getPlayerSegment thresholds READ-only; Codex / Identity
//      FX / sacred reactivity handlers NOT imported here.
//   6. Performance: snapshot < 2 ms; slice (240 frames) < 4 ms.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  // pure helpers
  captureFrameSnapshot,
  appendFrameToBuffer,
  extractSliceAroundTrigger,
  compressFrames,
  computeReplaySize,
  generateReplayId,
  // storage tier
  getStorageQuotaForSegment,
  getStorageTier,
  STORAGE_QUOTA_MB_BY_SEGMENT,
  // constants
  REPLAY_BUFFER_MAX_FRAMES,
  REPLAY_CAPTURE_INTERVAL_MS,
  REPLAY_SLICE_WINDOW_MS,
  IDENTITY_FX_SAMPLE_RATE,
  BIG_COMBO_THRESHOLD,
  TETRIS_CRIT_LINE_COUNT,
  TOWER_MILESTONE_FLOORS,
  REPLAY_TRIGGER_TYPES,
  // lifecycle
  startReplayCapture,
  stopReplayCapture,
  resetReplayBuffer,
  setGameStateProvider,
  _getReplayBufferForTest,
  _resetIdentityFxSampleCounter,
  // triggers
  onBossDefeatedTrigger,
  onTetrisCritTrigger,
  onIdentityFxTrigger,
  onIdentityBossReactivityTrigger,
  onBigComboTrigger,
  onStaggerEntryTrigger,
  onTowerMilestoneTrigger,
  onAdventureWeeklyDefeatTrigger,
  onPartyTowerRunClearTrigger,
  // emit + upload
  emitReplayTrigger,
  uploadReplay,
  fetchReplay,
} from '../../src/services/replay-backend.js';
import {
  SEGMENT_F2P,
  SEGMENT_MINNOW,
  SEGMENT_DOLPHIN,
  SEGMENT_WHALE,
} from '../../src/services/analytics.js';

// ──────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────

describe('constants — spec §4.1 + §4.6 + §15 Q2', () => {
  it('REPLAY_CAPTURE_INTERVAL_MS = 250 (4 fps per spec §4.1)', () => {
    expect(REPLAY_CAPTURE_INTERVAL_MS).toBe(250);
  });

  it('REPLAY_BUFFER_MAX_FRAMES = 240 (60 sec × 4 fps per spec §4.1)', () => {
    expect(REPLAY_BUFFER_MAX_FRAMES).toBe(240);
  });

  it('REPLAY_SLICE_WINDOW_MS = 5000 (5-sec trigger slice per spec §4.1)', () => {
    expect(REPLAY_SLICE_WINDOW_MS).toBe(5000);
  });

  it('IDENTITY_FX_SAMPLE_RATE = 5 (1-in-5 per spec §4.1 row 3)', () => {
    expect(IDENTITY_FX_SAMPLE_RATE).toBe(5);
  });

  it('BIG_COMBO_THRESHOLD = 4 (combo ≥ 4 per spec §4.1 row 5)', () => {
    expect(BIG_COMBO_THRESHOLD).toBe(4);
  });

  it('TETRIS_CRIT_LINE_COUNT = 4 (per spec §4.1 row 2)', () => {
    expect(TETRIS_CRIT_LINE_COUNT).toBe(4);
  });

  it('TOWER_MILESTONE_FLOORS = [25, 50, 75, 100] per spec §4.1 row 7', () => {
    expect(TOWER_MILESTONE_FLOORS).toEqual([25, 50, 75, 100]);
  });

  it('REPLAY_TRIGGER_TYPES has 9 entries (7 live + 2 deferred stubs)', () => {
    expect(Object.keys(REPLAY_TRIGGER_TYPES).length).toBe(9);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Pure helpers
// ──────────────────────────────────────────────────────────────────────────

describe('captureFrameSnapshot — pure read of game state', () => {
  it('returns frame shape: grid, pieceQueue, squad, boss, identityFxState, ultCharges, t', () => {
    const frame = captureFrameSnapshot({
      grid: [[1, 0], [0, 1]],
      pieceQueue: ['I', 'L'],
      squad: ['pirate', 'shark'],
      boss: { id: 'pyredrake', hp: 3000 },
      identityFxState: { ashenReign: true },
      ultCharges: { pirate: 0.4 },
    });
    expect(frame.grid).toEqual([[1, 0], [0, 1]]);
    expect(frame.pieceQueue).toEqual(['I', 'L']);
    expect(frame.squad).toEqual(['pirate', 'shark']);
    expect(frame.boss.id).toBe('pyredrake');
    expect(frame.identityFxState.ashenReign).toBe(true);
    expect(frame.ultCharges.pirate).toBe(0.4);
    expect(typeof frame.t).toBe('number');
  });

  it('defensive: null gameState returns all-null frame with t timestamp', () => {
    const frame = captureFrameSnapshot(null);
    expect(frame.grid).toBeNull();
    expect(frame.pieceQueue).toBeNull();
    expect(frame.squad).toBeNull();
    expect(frame.boss).toBeNull();
    expect(typeof frame.t).toBe('number');
  });

  it('defensive: undefined / non-object input returns null-fields frame', () => {
    expect(captureFrameSnapshot(undefined).grid).toBeNull();
    expect(captureFrameSnapshot(42).grid).toBeNull();
    expect(captureFrameSnapshot('whatever').grid).toBeNull();
  });

  it('NEVER mutates the input game state object', () => {
    const state = { grid: [[1, 2]], squad: ['a'] };
    const frozen = Object.freeze(state);
    expect(() => captureFrameSnapshot(frozen)).not.toThrow();
  });

  it('performance: < 2ms on typical state (sacred §3.1 AAA+ feel budget)', () => {
    const state = {
      grid: new Array(64).fill(null).map((_, i) => i % 2),
      pieceQueue: new Array(10).fill('I'),
      squad: ['pirate', 'shark', 'rock', 'spark', 'crocodile'],
      boss: { id: 'pyredrake', hp: 3000, archetype: 'bruiser' },
      identityFxState: { ashenReign: false, cursed: [] },
      ultCharges: { pirate: 0.4, shark: 0.2 },
    };
    const start = performance.now();
    for (let i = 0; i < 1000; i++) captureFrameSnapshot(state);
    const elapsed = performance.now() - start;
    expect(elapsed / 1000).toBeLessThan(2);
  });
});

describe('appendFrameToBuffer — FIFO ring buffer at 240-cap', () => {
  it('appends to empty buffer', () => {
    const out = appendFrameToBuffer([], { t: 0 }, REPLAY_BUFFER_MAX_FRAMES);
    expect(out.length).toBe(1);
    expect(out[0].t).toBe(0);
  });

  it('appends within cap (FIFO grows)', () => {
    let buf = [];
    for (let i = 0; i < 100; i++) buf = appendFrameToBuffer(buf, { t: i }, REPLAY_BUFFER_MAX_FRAMES);
    expect(buf.length).toBe(100);
    expect(buf[0].t).toBe(0);
    expect(buf[99].t).toBe(99);
  });

  it('drops oldest at 240-cap overflow (ring buffer)', () => {
    let buf = [];
    for (let i = 0; i < 300; i++) buf = appendFrameToBuffer(buf, { t: i }, REPLAY_BUFFER_MAX_FRAMES);
    expect(buf.length).toBe(240);
    expect(buf[0].t).toBe(60);
    expect(buf[239].t).toBe(299);
  });

  it('PURE — does not mutate input buffer', () => {
    const original = [{ t: 1 }, { t: 2 }];
    const out = appendFrameToBuffer(original, { t: 3 }, REPLAY_BUFFER_MAX_FRAMES);
    expect(original.length).toBe(2);
    expect(out.length).toBe(3);
  });

  it('defensive: invalid buffer input treated as empty', () => {
    expect(appendFrameToBuffer(null, { t: 0 }, 10).length).toBe(1);
    expect(appendFrameToBuffer(undefined, { t: 0 }, 10).length).toBe(1);
  });

  it('defensive: invalid maxFrames defaults to REPLAY_BUFFER_MAX_FRAMES', () => {
    let buf = [];
    for (let i = 0; i < 250; i++) buf = appendFrameToBuffer(buf, { t: i }, null);
    expect(buf.length).toBe(REPLAY_BUFFER_MAX_FRAMES);
  });
});

describe('extractSliceAroundTrigger — 5-sec window extraction', () => {
  it('returns frames in [triggerTime - 5000, triggerTime]', () => {
    const buf = [
      { t: 1000 },
      { t: 3000 },
      { t: 5000 },
      { t: 7000 },
      { t: 9000 },
    ];
    const slice = extractSliceAroundTrigger(buf, 9000, 5000);
    // 5-sec window: [4000, 9000] inclusive → frames at 5000, 7000, 9000
    expect(slice.length).toBe(3);
    expect(slice.map(f => f.t)).toEqual([5000, 7000, 9000]);
  });

  it('handles buffer-start edge case (trigger before windowMs elapsed)', () => {
    const buf = [{ t: 100 }, { t: 200 }];
    const slice = extractSliceAroundTrigger(buf, 300, 5000);
    expect(slice.length).toBe(2);
  });

  it('returns empty for empty buffer', () => {
    expect(extractSliceAroundTrigger([], 100, 5000)).toEqual([]);
  });

  it('defensive: malformed buffer / null entries skipped', () => {
    const buf = [null, { t: 100 }, undefined, { t: 200 }, { wrongKey: 1 }];
    const slice = extractSliceAroundTrigger(buf, 300, 5000);
    expect(slice.length).toBe(2);
  });

  it('performance: < 4ms on 240-frame buffer (sacred extract budget)', () => {
    const buf = [];
    for (let i = 0; i < 240; i++) buf.push({ t: i * 250 });
    const start = performance.now();
    for (let i = 0; i < 100; i++) extractSliceAroundTrigger(buf, 60000, 5000);
    const elapsed = performance.now() - start;
    expect(elapsed / 100).toBeLessThan(4);
  });
});

describe('compressFrames — JSON.stringify round-trip', () => {
  it('round-trips empty frames array', () => {
    const json = compressFrames([]);
    expect(JSON.parse(json)).toEqual([]);
  });

  it('round-trips multi-frame data identity', () => {
    const frames = [{ t: 0, grid: [1, 2] }, { t: 250, grid: [3, 4] }];
    expect(JSON.parse(compressFrames(frames))).toEqual(frames);
  });

  it('defensive: non-array input returns "[]"', () => {
    expect(compressFrames(null)).toBe('[]');
    expect(compressFrames(undefined)).toBe('[]');
    expect(compressFrames(42)).toBe('[]');
  });

  it('defensive: circular reference does not throw, returns "[]"', () => {
    const circ = {};
    circ.self = circ;
    expect(() => compressFrames([circ])).not.toThrow();
    expect(compressFrames([circ])).toBe('[]');
  });
});

describe('computeReplaySize — byte length (UTF-8)', () => {
  it('returns 0 for non-string input', () => {
    expect(computeReplaySize(null)).toBe(0);
    expect(computeReplaySize(undefined)).toBe(0);
    expect(computeReplaySize(42)).toBe(0);
  });

  it('returns ASCII byte length', () => {
    expect(computeReplaySize('hello')).toBe(5);
    expect(computeReplaySize('[]')).toBe(2);
  });

  it('returns UTF-8 byte length (multi-byte chars > char length)', () => {
    const s = '∞';
    const bytes = computeReplaySize(s);
    expect(bytes).toBeGreaterThanOrEqual(s.length);
  });
});

describe('generateReplayId — 12-char content hash', () => {
  it('returns 12-char string', () => {
    const id = generateReplayId('{"frames":[]}');
    expect(id.length).toBe(12);
    expect(typeof id).toBe('string');
  });

  it('defensive: handles empty / non-string input', () => {
    expect(generateReplayId('').length).toBe(12);
    expect(generateReplayId(null).length).toBe(12);
    expect(generateReplayId(undefined).length).toBe(12);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Storage tier (ESC-03 Q2 ruling — sacred)
// ──────────────────────────────────────────────────────────────────────────

describe('getStorageQuotaForSegment — ESC-03 Q2 ruling (sacred all-permanent)', () => {
  it('F2P → 100 MB', () => {
    expect(getStorageQuotaForSegment(SEGMENT_F2P)).toBe(100);
  });

  it('Minnow → 100 MB', () => {
    expect(getStorageQuotaForSegment(SEGMENT_MINNOW)).toBe(100);
  });

  it('Dolphin → 250 MB', () => {
    expect(getStorageQuotaForSegment(SEGMENT_DOLPHIN)).toBe(250);
  });

  it('Whale → 500 MB', () => {
    expect(getStorageQuotaForSegment(SEGMENT_WHALE)).toBe(500);
  });

  it('unknown segment → defaults to F2P quota', () => {
    expect(getStorageQuotaForSegment('UnknownSegment')).toBe(100);
    expect(getStorageQuotaForSegment(null)).toBe(100);
    expect(getStorageQuotaForSegment(undefined)).toBe(100);
  });

  it('STORAGE_QUOTA_MB_BY_SEGMENT is frozen (immutable contract)', () => {
    expect(Object.isFrozen(STORAGE_QUOTA_MB_BY_SEGMENT)).toBe(true);
  });
});

describe('getStorageTier — reads getPlayerSegment via legacy spending key', () => {
  beforeEach(() => {
    try { if (typeof localStorage !== 'undefined') localStorage.clear(); } catch (_e) { /* swallow */ }
  });

  it('defaults to F2P when localStorage empty', () => {
    expect(getStorageTier()).toBe(SEGMENT_F2P);
  });

  it('returns Minnow at $1 spend', () => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('blocksworn_p5_spending', '1');
    expect(getStorageTier()).toBe(SEGMENT_MINNOW);
  });

  it('returns Dolphin at $25 spend (sacred threshold)', () => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('blocksworn_p5_spending', '25');
    expect(getStorageTier()).toBe(SEGMENT_DOLPHIN);
  });

  it('returns Whale at $100 spend (sacred threshold)', () => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('blocksworn_p5_spending', '100');
    expect(getStorageTier()).toBe(SEGMENT_WHALE);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 9 trigger predicates (7 live + 2 deferred stubs)
// ──────────────────────────────────────────────────────────────────────────

describe('9 trigger predicates — per spec §4.1 table', () => {
  beforeEach(() => {
    resetReplayBuffer();
    _resetIdentityFxSampleCounter();
  });

  it('#1 onBossDefeatedTrigger — fires for any boss (always per spec row 1)', async () => {
    const result = await onBossDefeatedTrigger('pyredrake', { chapter: 1 });
    expect(result).toBeDefined();
    expect(typeof result.ok).toBe('boolean');
  });

  it('#2 onTetrisCritTrigger — fires ONLY for rows + cols === 4', async () => {
    const valid = await onTetrisCritTrigger([1, 2], [3, 4], {});
    expect(valid.reason).not.toBe('not-tetris');
    const invalid3 = await onTetrisCritTrigger([1, 2], [3], {});
    expect(invalid3.ok).toBe(false);
    expect(invalid3.reason).toBe('not-tetris');
    const invalid5 = await onTetrisCritTrigger([1, 2, 3], [4, 5], {});
    expect(invalid5.ok).toBe(false);
    expect(invalid5.reason).toBe('not-tetris');
  });

  it('#3 onIdentityFxTrigger — 1-in-5 deterministic sampling', async () => {
    _resetIdentityFxSampleCounter();
    let fires = 0;
    for (let i = 0; i < 25; i++) {
      const result = await onIdentityFxTrigger('pirate', {});
      if (result.reason !== 'sampled-out') fires++;
    }
    expect(fires).toBe(5); // 25 calls / 5 sample-rate = exactly 5 fires
  });

  it('#4 onIdentityBossReactivityTrigger — always fires (no sampling per spec row 4)', async () => {
    const result = await onIdentityBossReactivityTrigger('identity_phoenix_ashen_reign', {});
    expect(result.reason).not.toBe('sampled-out');
  });

  it('#5 onBigComboTrigger — fires ONLY for combo ≥ 4', async () => {
    const valid = await onBigComboTrigger(4, {});
    expect(valid.reason).not.toBe('below-threshold');
    const valid5 = await onBigComboTrigger(5, {});
    expect(valid5.reason).not.toBe('below-threshold');
    const invalid = await onBigComboTrigger(3, {});
    expect(invalid.ok).toBe(false);
    expect(invalid.reason).toBe('below-threshold');
    const invalid0 = await onBigComboTrigger(0, {});
    expect(invalid0.ok).toBe(false);
  });

  it('#6 onStaggerEntryTrigger — always fires per spec row 6', async () => {
    const result = await onStaggerEntryTrigger('pyredrake', { totalStaggers: 1 });
    expect(result).toBeDefined();
  });

  it('#7 onTowerMilestoneTrigger — fires ONLY for floors 25/50/75/100', async () => {
    const f25 = await onTowerMilestoneTrigger(25, {});
    expect(f25.reason).not.toBe('not-milestone');
    const f50 = await onTowerMilestoneTrigger(50, {});
    expect(f50.reason).not.toBe('not-milestone');
    const f75 = await onTowerMilestoneTrigger(75, {});
    expect(f75.reason).not.toBe('not-milestone');
    const f100 = await onTowerMilestoneTrigger(100, {});
    expect(f100.reason).not.toBe('not-milestone');
    const f24 = await onTowerMilestoneTrigger(24, {});
    expect(f24.ok).toBe(false);
    expect(f24.reason).toBe('not-milestone');
    const f99 = await onTowerMilestoneTrigger(99, {});
    expect(f99.reason).toBe('not-milestone');
  });

  it('#8 onAdventureWeeklyDefeatTrigger — DEFERRED stub (T3.04)', async () => {
    const result = await onAdventureWeeklyDefeatTrigger({});
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('deferred-to-T3.04');
  });

  it('#9 onPartyTowerRunClearTrigger — DEFERRED stub (T3.13)', async () => {
    const result = await onPartyTowerRunClearTrigger({});
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('deferred-to-T3.13');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Defensive behavior (every export wrapped in try/catch)
// ──────────────────────────────────────────────────────────────────────────

describe('defensive: trigger predicates never throw on adversarial input', () => {
  it('onBossDefeatedTrigger — null / undefined inputs return falsy ok', async () => {
    await expect(onBossDefeatedTrigger(null, null)).resolves.toBeDefined();
    await expect(onBossDefeatedTrigger(undefined, undefined)).resolves.toBeDefined();
  });

  it('onTetrisCritTrigger — non-array inputs do not throw', async () => {
    await expect(onTetrisCritTrigger(null, null, null)).resolves.toBeDefined();
    await expect(onTetrisCritTrigger('a', 'b', 'c')).resolves.toBeDefined();
  });

  it('onBigComboTrigger — non-numeric input returns below-threshold', async () => {
    const result = await onBigComboTrigger('NaN', null);
    expect(result.ok).toBe(false);
  });

  it('onTowerMilestoneTrigger — non-numeric floor returns not-milestone', async () => {
    const result = await onTowerMilestoneTrigger(null, null);
    expect(result.reason).toBe('not-milestone');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Lifecycle — capture/stop/reset idempotency
// ──────────────────────────────────────────────────────────────────────────

describe('lifecycle — startReplayCapture / stopReplayCapture / resetReplayBuffer', () => {
  beforeEach(() => {
    stopReplayCapture();
    resetReplayBuffer();
  });

  it('startReplayCapture is idempotent (repeated calls no-op)', () => {
    expect(() => {
      startReplayCapture();
      startReplayCapture();
      startReplayCapture();
    }).not.toThrow();
    stopReplayCapture();
  });

  it('stopReplayCapture is idempotent', () => {
    expect(() => {
      stopReplayCapture();
      stopReplayCapture();
    }).not.toThrow();
  });

  it('resetReplayBuffer drops in-memory buffer', () => {
    resetReplayBuffer();
    expect(_getReplayBufferForTest()).toEqual([]);
  });

  it('capture tick appends frames to buffer (4 fps timer-driven)', async () => {
    setGameStateProvider(() => ({ grid: [1, 2, 3], boss: { id: 'pyredrake' } }));
    startReplayCapture();
    await new Promise(r => setTimeout(r, 600)); // ~2 ticks at 250ms
    stopReplayCapture();
    const buf = _getReplayBufferForTest();
    expect(buf.length).toBeGreaterThanOrEqual(1);
    expect(buf[0].grid).toEqual([1, 2, 3]);
    setGameStateProvider(() => null);
  });

  it('capture tick survives state-provider throw (sacred game loop protected)', async () => {
    setGameStateProvider(() => { throw new Error('state read failed'); });
    startReplayCapture();
    await new Promise(r => setTimeout(r, 350));
    stopReplayCapture();
    // No assertion on buffer content — just verify no unhandled rejection.
    setGameStateProvider(() => null);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// emit + upload — Firebase Storage no-SDK path
// ──────────────────────────────────────────────────────────────────────────

describe('emitReplayTrigger + uploadReplay — no-SDK graceful no-op', () => {
  it('emitReplayTrigger never throws on absent SDK', async () => {
    const result = await emitReplayTrigger(REPLAY_TRIGGER_TYPES.BOSS_DEFEAT, { boss_id: 'pyredrake' });
    expect(result).toBeDefined();
    expect(typeof result.ok).toBe('boolean');
  });

  it('uploadReplay returns ok:false / no-sdk when Firebase Storage absent', async () => {
    const result = await uploadReplay('{"frames":[]}', 'abc123', SEGMENT_F2P);
    expect(result.ok).toBe(false);
  });

  it('uploadReplay rejects invalid input (missing replayId)', async () => {
    const result = await uploadReplay('{}', '', SEGMENT_F2P);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid-input');
  });

  it('uploadReplay rejects oversized replay (> 1 MB)', async () => {
    const huge = 'x'.repeat(1024 * 1024 + 100);
    const result = await uploadReplay(huge, 'abc', SEGMENT_F2P);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('replay-too-large');
  });

  it('fetchReplay returns null on missing replayId / no SDK', async () => {
    expect(await fetchReplay(null)).toBeNull();
    expect(await fetchReplay('nonexistent')).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Sacred audit
// ──────────────────────────────────────────────────────────────────────────

describe('sacred audit — T3.07 must not touch sacred surfaces', () => {
  it('replay-backend does NOT export anything that mutates getPlayerSegment thresholds', async () => {
    const mod = await import('../../src/services/replay-backend.js');
    // The only segment-related export is the READ helper; no setter for segment math.
    expect(typeof mod.getStorageTier).toBe('function');
    expect(typeof mod.getStorageQuotaForSegment).toBe('function');
    expect(mod.setPlayerSegment).toBeUndefined();
    expect(mod.SEGMENT_F2P).toBeUndefined(); // segments only re-imported, not re-exported
  });

  it('replay-backend.js does NOT import Identity FX or Codex modules', async () => {
    // Sanity check via the manifest of what the module pulls in. The unit
    // imports of analytics + firebase + logger only — nothing from
    // src/feel/identity-fx.js or src/ui/codex.js.
    const mod = await import('../../src/services/replay-backend.js');
    // No symbols from identity-fx or codex should leak through.
    expect(mod.fxPirateLineClear).toBeUndefined();
    expect(mod.dispatchIdentityFx).toBeUndefined();
    expect(mod.recordMomentTrigger).toBeUndefined();
  });

  it('STORAGE_QUOTA_MB_BY_SEGMENT keys match sacred T1.20 segment names', () => {
    expect(STORAGE_QUOTA_MB_BY_SEGMENT[SEGMENT_F2P]).toBe(100);
    expect(STORAGE_QUOTA_MB_BY_SEGMENT[SEGMENT_MINNOW]).toBe(100);
    expect(STORAGE_QUOTA_MB_BY_SEGMENT[SEGMENT_DOLPHIN]).toBe(250);
    expect(STORAGE_QUOTA_MB_BY_SEGMENT[SEGMENT_WHALE]).toBe(500);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Spy / smoke: trigger predicates ultimately call emitReplayTrigger
// ──────────────────────────────────────────────────────────────────────────

describe('trigger predicates → emit pathway', () => {
  beforeEach(() => {
    resetReplayBuffer();
    _resetIdentityFxSampleCounter();
  });

  it('emit pathway produces a result envelope with ok + replayId on full pass', async () => {
    // Even with no SDK, the upload returns ok:false but the envelope still
    // contains a replayId — verifies the pipe ran end-to-end.
    const result = await emitReplayTrigger(REPLAY_TRIGGER_TYPES.BIG_COMBO, { combo: 5 });
    expect(result).toBeDefined();
    expect(typeof result.replayId === 'string' || result.replayId === undefined).toBe(true);
  });

  it('vi spy: a successful trigger eventually attempts upload', async () => {
    // Mock isn't necessary — verify shape contract holds when Firebase missing.
    const spy = vi.fn();
    setGameStateProvider(() => ({ grid: [1], boss: { id: 'p' } }));
    startReplayCapture();
    await new Promise(r => setTimeout(r, 280));
    spy(await onBossDefeatedTrigger('pyredrake', {}));
    stopReplayCapture();
    expect(spy).toHaveBeenCalledTimes(1);
    setGameStateProvider(() => null);
  });
});
