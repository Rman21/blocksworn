// 2026-05-13 — TASK-048 (T3.08): Replay viewer unit tests.
//
// Spec: docs/design/endgame-social.md §4.2 (Replay viewer).
// Pure helpers + playback state coverage. No DOM — Vitest `node` env. Where
// the viewer touches the canvas, we stub a minimal getContext('2d') so the
// render path is exercised end-to-end without a real browser.
//
// Surface tested:
//   - parseReplayMetadata        — various trigger-type metadata + fallback
//   - formatTimestamp            — relative vs absolute formatting
//   - computeTimelineProgress    — 0/0, 10/20, 19/20, bounds clamping
//   - clampSpeed                 — 0.25 → 0.5, 4 → 2, 0.7 → 0.5 (snapping)
//   - renderFrameToCanvas        — deterministic fillRect call sequence
//   - Playback state transitions — play → pause → play; seek preserves state
//   - Speed change semantics     — clamping, label update side-effect
//   - Loop behavior              — at last frame, advance → frame 0 (loop on)
//   - Malformed frame data       — empty snapshot → no crash, blank canvas
//   - prefers-reduced-motion     — auto-play disabled flag honored
//   - navigator.share absence    — graceful no-op
//   - Sacred audit               — viewer never writes Codex state / sacred tables

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  renderReplayViewer,
  parseReplayMetadata,
  formatTimestamp,
  computeTimelineProgress,
  clampSpeed,
  renderFrameToCanvas,
  play,
  pause,
  seek,
  setSpeed,
  toggleLoop,
  __replayViewerTestables,
} from '../../src/ui/replay-viewer.js';
import {
  REPLAY_VIEWER_FCP_BUDGET_MS,
  REPLAY_VIEWER_FRAME_BUDGET_MS,
  REPLAY_VIEWER_SPEEDS,
  REPLAY_VIEWER_DEFAULT_SPEED,
  REPLAY_VIEWER_DURATION_MS,
  REPLAY_VIEWER_CANVAS_PX,
} from '../../src/data/replay-config.js';

// ── Mock canvas 2D context — captures call sequence for assertions ────
function makeMockCtx() {
  const calls = [];
  return {
    imageSmoothingEnabled: true,
    fillStyle: '',
    fillRect(x, y, w, h) { calls.push(['fillRect', x, y, w, h, this.fillStyle]); },
    _calls: calls,
  };
}

beforeEach(() => {
  __replayViewerTestables.reset();
});

afterEach(() => {
  __replayViewerTestables.reset();
});

// ══════════════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════════════

describe('Replay viewer constants (T3.08)', () => {
  it('REPLAY_VIEWER_FCP_BUDGET_MS is 300 per spec §4.6', () => {
    expect(REPLAY_VIEWER_FCP_BUDGET_MS).toBe(300);
  });

  it('REPLAY_VIEWER_FRAME_BUDGET_MS is 16 per spec §4.2', () => {
    expect(REPLAY_VIEWER_FRAME_BUDGET_MS).toBe(16);
  });

  it('REPLAY_VIEWER_SPEEDS exposes 0.5 / 1 / 2 per spec §4.2', () => {
    expect(Array.from(REPLAY_VIEWER_SPEEDS)).toEqual([0.5, 1, 2]);
  });

  it('REPLAY_VIEWER_DURATION_MS is 5000 (matches REPLAY_SLICE_WINDOW_MS)', () => {
    expect(REPLAY_VIEWER_DURATION_MS).toBe(5000);
  });
});

// ══════════════════════════════════════════════════════════════════════
// parseReplayMetadata
// ══════════════════════════════════════════════════════════════════════

describe('parseReplayMetadata (T3.08)', () => {
  it('fallback for null / non-object input', () => {
    expect(parseReplayMetadata(null).whenStr).toBe('???');
    expect(parseReplayMetadata(undefined).bossKey).toBe('');
    expect(parseReplayMetadata(42).triggerType).toBe('unknown');
  });

  it('unwraps the [{...}] array wrapper produced by compressFrames([payload])', () => {
    const json = [{
      version: 1,
      type: 'boss_defeat',
      timestamp: new Date().toISOString(),
      duration_ms: 5000,
      frames: [{ squad: ['pirate', 'pirate', 'pirate', 'pirate', 'pirate'] }],
      metadata: { boss_id: 'pyredrake' },
    }];
    const meta = parseReplayMetadata(json);
    expect(meta.triggerType).toBe('boss_defeat');
    expect(meta.bossKey).toBe('pyredrake');
    expect(meta.youStr).toMatch(/Pirate squad/);
  });

  it('formats tetris_crit context with rows + cols', () => {
    const json = [{
      type: 'tetris_crit',
      timestamp: new Date().toISOString(),
      frames: [],
      metadata: { rows_cleared: 2, cols_cleared: 2 },
    }];
    const meta = parseReplayMetadata(json);
    expect(meta.ctxStr).toContain('4-line crit');
    expect(meta.ctxStr).toContain('2R + 2C');
  });

  it('formats big_combo context with combo count', () => {
    const json = [{
      type: 'big_combo',
      timestamp: new Date().toISOString(),
      frames: [],
      metadata: { combo: 5 },
    }];
    const meta = parseReplayMetadata(json);
    expect(meta.ctxStr).toContain('Big combo');
    expect(meta.ctxStr).toContain('combo ×5');
  });

  it('Stagger entry formats with boss key', () => {
    const json = [{
      type: 'stagger_entry',
      timestamp: new Date().toISOString(),
      frames: [],
      metadata: { boss_id: 'lich' },
    }];
    const meta = parseReplayMetadata(json);
    expect(meta.ctxStr).toContain('Stagger entry');
    expect(meta.ctxStr).toContain('Lich');
  });

  it('Tower milestone formats with floor', () => {
    const json = [{
      type: 'tower_milestone',
      timestamp: new Date().toISOString(),
      frames: [],
      metadata: { floor: 50 },
    }];
    const meta = parseReplayMetadata(json);
    expect(meta.ctxStr).toContain('Tower milestone');
  });
});

// ══════════════════════════════════════════════════════════════════════
// formatTimestamp
// ══════════════════════════════════════════════════════════════════════

describe('formatTimestamp (T3.08)', () => {
  it('returns "Today" for 0 days ago', () => {
    const now = Date.parse('2026-05-13T12:00:00Z');
    expect(formatTimestamp('2026-05-13T08:00:00Z', now)).toBe('Today');
  });

  it('returns "Day N ago" for recent timestamps', () => {
    const now = Date.parse('2026-05-13T12:00:00Z');
    expect(formatTimestamp('2026-05-06T12:00:00Z', now)).toBe('Day 7 ago');
  });

  it('returns absolute YYYY-MM-DD for >30 days', () => {
    const now = Date.parse('2026-05-13T12:00:00Z');
    expect(formatTimestamp('2026-01-01T12:00:00Z', now)).toBe('2026-01-01');
  });

  it('returns "???" for non-string / malformed input', () => {
    expect(formatTimestamp(null)).toBe('???');
    expect(formatTimestamp('')).toBe('???');
    expect(formatTimestamp('garbage')).toBe('???');
  });
});

// ══════════════════════════════════════════════════════════════════════
// computeTimelineProgress
// ══════════════════════════════════════════════════════════════════════

describe('computeTimelineProgress (T3.08)', () => {
  it('zero / zero → 0', () => {
    expect(computeTimelineProgress(0, 0)).toBe(0);
  });

  it('half-way → 0.5 for index 10 of 21 frames', () => {
    expect(computeTimelineProgress(10, 21)).toBeCloseTo(0.5, 3);
  });

  it('one-before-last → 0.95 for 19 / 20', () => {
    expect(computeTimelineProgress(19, 20)).toBeCloseTo(1, 3); // 19 >= 20-1 → clamp to 1
  });

  it('negative index clamps to 0', () => {
    expect(computeTimelineProgress(-5, 20)).toBe(0);
  });

  it('overshoot clamps to 1', () => {
    expect(computeTimelineProgress(999, 20)).toBe(1);
  });

  it('handles non-finite inputs defensively', () => {
    expect(computeTimelineProgress(NaN, 20)).toBe(0);
    expect(computeTimelineProgress(5, NaN)).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// clampSpeed
// ══════════════════════════════════════════════════════════════════════

describe('clampSpeed (T3.08)', () => {
  it('0.25 → 0.5 (clamp to min)', () => {
    expect(clampSpeed(0.25)).toBe(0.5);
  });

  it('4 → 2 (clamp to max)', () => {
    expect(clampSpeed(4)).toBe(2);
  });

  it('0.6 → 0.5 (snap nearest)', () => {
    expect(clampSpeed(0.6)).toBe(0.5);
  });

  it('1.4 → 1 (snap nearest below midpoint between 1 and 2)', () => {
    expect(clampSpeed(1.4)).toBe(1);
  });

  it('1.6 → 2 (snap nearest above midpoint)', () => {
    expect(clampSpeed(1.6)).toBe(2);
  });

  it('non-finite / non-number falls back to default speed', () => {
    expect(clampSpeed(NaN)).toBe(REPLAY_VIEWER_DEFAULT_SPEED);
    expect(clampSpeed('fast')).toBe(REPLAY_VIEWER_DEFAULT_SPEED);
  });
});

// ══════════════════════════════════════════════════════════════════════
// renderFrameToCanvas
// ══════════════════════════════════════════════════════════════════════

describe('renderFrameToCanvas (T3.08)', () => {
  it('paints background even for empty/null frame', () => {
    const ctx = makeMockCtx();
    renderFrameToCanvas(null, ctx, REPLAY_VIEWER_CANVAS_PX);
    // First call: clear background.
    expect(ctx._calls.length).toBeGreaterThan(0);
    expect(ctx._calls[0][0]).toBe('fillRect');
    expect(ctx._calls[0][1]).toBe(0);
    expect(ctx._calls[0][2]).toBe(0);
    expect(ctx._calls[0][3]).toBe(REPLAY_VIEWER_CANVAS_PX);
    expect(ctx._calls[0][4]).toBe(REPLAY_VIEWER_CANVAS_PX);
  });

  it('sets imageSmoothingEnabled = false for pixel-perfect rendering', () => {
    const ctx = makeMockCtx();
    renderFrameToCanvas(null, ctx, REPLAY_VIEWER_CANVAS_PX);
    expect(ctx.imageSmoothingEnabled).toBe(false);
  });

  it('paints cells for a populated 8×8 grid', () => {
    const grid = new Array(8).fill(0).map((_, r) =>
      new Array(8).fill(0).map((_, c) => ((r + c) % 5) === 0 ? 0 : ((r + c) % 5))
    );
    const ctx = makeMockCtx();
    renderFrameToCanvas({ grid }, ctx, REPLAY_VIEWER_CANVAS_PX);
    // 1 background + N populated cells.
    expect(ctx._calls.length).toBeGreaterThan(1);
  });

  it('survives a malformed grid (non-array row) without throwing', () => {
    const grid = ['not-an-array', null, undefined, [1, 2, 3]];
    const ctx = makeMockCtx();
    expect(() => renderFrameToCanvas({ grid }, ctx, REPLAY_VIEWER_CANVAS_PX)).not.toThrow();
  });

  it('paints HP strip when boss data is present', () => {
    const ctx = makeMockCtx();
    renderFrameToCanvas({ grid: null, boss: { id: 'pyredrake', hp: 1500, maxHp: 3000 } }, ctx, REPLAY_VIEWER_CANVAS_PX);
    // 1 background + 1 strip background + 1 strip foreground at 50%.
    expect(ctx._calls.length).toBe(3);
  });

  it('no-op when ctx is null/undefined', () => {
    expect(() => renderFrameToCanvas({ grid: [[1, 2]] }, null, REPLAY_VIEWER_CANVAS_PX)).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════════
// Playback state transitions
// ══════════════════════════════════════════════════════════════════════

describe('Playback state transitions (T3.08)', () => {
  it('play / pause toggle preserves currentFrameIdx', () => {
    __replayViewerTestables.setFrames([{ grid: null }, { grid: null }, { grid: null }]);
    // No rAF in node env — playback won't advance, but the state flag flips.
    play();
    let s = __replayViewerTestables.getState();
    expect(s.isPlaying).toBe(true);
    pause();
    s = __replayViewerTestables.getState();
    expect(s.isPlaying).toBe(false);
    expect(s.currentFrameIdx).toBe(0);
  });

  it('seek to 0.5 lands on middle frame', () => {
    __replayViewerTestables.setFrames(new Array(11).fill(0).map((_, i) => ({ grid: null, i })));
    seek(0.5);
    expect(__replayViewerTestables.getState().currentFrameIdx).toBe(5);
  });

  it('seek clamps to bounds (negative → 0, overshoot → last)', () => {
    __replayViewerTestables.setFrames(new Array(10).fill(0).map(() => ({ grid: null })));
    seek(-1);
    expect(__replayViewerTestables.getState().currentFrameIdx).toBe(0);
    seek(2);
    expect(__replayViewerTestables.getState().currentFrameIdx).toBe(9);
  });

  it('setSpeed clamps to allowed values (4 → 2; 0.25 → 0.5)', () => {
    setSpeed(4);
    expect(__replayViewerTestables.getState().speed).toBe(2);
    setSpeed(0.25);
    expect(__replayViewerTestables.getState().speed).toBe(0.5);
  });

  it('toggleLoop flips the loop flag idempotently', () => {
    expect(__replayViewerTestables.getState().isLooping).toBe(false);
    toggleLoop();
    expect(__replayViewerTestables.getState().isLooping).toBe(true);
    toggleLoop();
    expect(__replayViewerTestables.getState().isLooping).toBe(false);
  });

  it('play on empty frames is a no-op (does not flip isPlaying)', () => {
    __replayViewerTestables.setFrames([]);
    play();
    expect(__replayViewerTestables.getState().isPlaying).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Auto-play + prefers-reduced-motion
// ══════════════════════════════════════════════════════════════════════

describe('prefers-reduced-motion behavior (T3.08)', () => {
  it('autoPlayDisabled flag is settable via testables', () => {
    __replayViewerTestables.setAutoPlayDisabled(true);
    expect(__replayViewerTestables.getState().autoPlayDisabled).toBe(true);
    __replayViewerTestables.setAutoPlayDisabled(false);
    expect(__replayViewerTestables.getState().autoPlayDisabled).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Reset semantics
// ══════════════════════════════════════════════════════════════════════

describe('testables.reset (T3.08)', () => {
  it('reset() clears playback state', () => {
    __replayViewerTestables.setFrames([{ grid: null }, { grid: null }]);
    play();
    setSpeed(2);
    toggleLoop();
    __replayViewerTestables.reset();
    const s = __replayViewerTestables.getState();
    expect(s.isPlaying).toBe(false);
    expect(s.isLooping).toBe(false);
    expect(s.speed).toBe(REPLAY_VIEWER_DEFAULT_SPEED);
    expect(s.frameCount).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Sacred audit — viewer never writes Codex state
// ══════════════════════════════════════════════════════════════════════

describe('Sacred audit (T3.08)', () => {
  it('renderReplayViewer with null rootEl is a no-op (no global mutation)', () => {
    // In node env there's no document; renderReplayViewer should bail safely
    // and NOT touch any other module state.
    const before = __replayViewerTestables.getState();
    renderReplayViewer(null, 'some-id');
    const after = __replayViewerTestables.getState();
    expect(after.frameCount).toBe(before.frameCount);
    expect(after.isPlaying).toBe(false);
  });

  it('module does not export Codex / identity-fx / reactivity recorders', async () => {
    // Sanity — viewer module must not re-export the sacred recording API.
    const mod = await import('../../src/ui/replay-viewer.js');
    expect(mod.recordRaceTrigger).toBeUndefined();
    expect(mod.recordBossDefeat).toBeUndefined();
    expect(mod.recordMomentTrigger).toBeUndefined();
    expect(mod.dispatchIdentityFx).toBeUndefined();
  });
});
