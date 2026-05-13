// 2026-05-13 — TASK-048 (T3.08): Replay viewer UI — scrubable canvas playback.
//
// Spec: docs/design/endgame-social.md §4.2 (Replay viewer) + §4.3 (Share).
// SECOND Phase 3 implementation task. Depends on T3.07 replay-backend (the
// 12 window-bridge functions exposing the JSON-frame replay format).
//
// What this module ships:
//   1. Scrubable 5-sec canvas playback (4fps × 0.5/1/2× speed multiplier).
//   2. Play/pause/loop/speed controls + share button (navigator.share).
//   3. Async load via window.__fetchReplay(replayId) (T3.07) with empty-state
//      "Replay not available" graceful fallback.
//   4. Auto-play on mount (respects prefers-reduced-motion).
//   5. Parchment aesthetic matching Codex screen (T2.12).
//
// Performance contract (spec §4.6):
//   - FCP ≤300ms (initial render + first frame paint).
//   - Frame render ≤16ms (canvas 2D context, imageSmoothingEnabled=false).
//   - Stream rehydration ≤500ms for 100 KB JSON buffer.
//
// Sacred-cow safety (CLAUDE.md §2):
//   - READ-ONLY consumer of the replay JSON format (T3.07 deliverable).
//   - Never mutates Codex state, game state, sacred tables, or identity FX.
//   - Wraps every async / playback operation in try/catch — must not crash
//     the new shell even on malformed frame data.
//
// Public API:
//   - renderReplayViewer(rootEl?, replayId?)      — main render entry
//   - parseReplayMetadata(replayJson)             — pure helper
//   - renderFrameToCanvas(frame, ctx, scale)      — pure helper
//   - computeTimelineProgress(idx, total)         — pure helper (clamped 0..1)
//   - formatTimestamp(t, nowMs?)                  — pure helper
//   - clampSpeed(speed)                           — pure helper
//   - __replayViewerTestables                     — test-only escape hatches

/* eslint-disable no-empty */

import {
  REPLAY_VIEWER_FCP_BUDGET_MS,
  REPLAY_VIEWER_FRAME_BUDGET_MS,
  REPLAY_VIEWER_BASE_FPS,
  REPLAY_VIEWER_SPEEDS,
  REPLAY_VIEWER_DEFAULT_SPEED,
  REPLAY_VIEWER_DURATION_MS,
  REPLAY_VIEWER_GRID_COLS,
  REPLAY_VIEWER_GRID_ROWS,
  REPLAY_VIEWER_CANVAS_PX,
  REPLAY_VIEWER_CELL_COLORS,
  REPLAY_VIEWER_CANVAS_BG,
  REPLAY_VIEWER_TRIGGER_LABELS,
  REPLAY_VIEWER_REL_DAY_CUTOFF,
} from '../data/replay-config.js';
// T3.07 backend — viewer is a READ-ONLY consumer. fetchReplay returns the
// JSON string (Firebase Storage blob) or null when SDK absent / not found.
import { fetchReplay as _fetchReplayBackend } from '../services/replay-backend.js';
import { log } from '../services/logger.js';

// ─── Module state — current playback session ───────────────────────────
//
// Holds the in-flight replay JSON + decoded frames + playback cursor. Reset
// on every renderReplayViewer() call so cross-mount state never leaks. The
// rAF loop is the sole driver of frame advancement during play.
let _replayJson = null;
let _frames = [];
let _currentFrameIdx = 0;
let _isPlaying = false;
let _isLooping = false;
let _speed = REPLAY_VIEWER_DEFAULT_SPEED;
let _rafHandle = null;
let _lastTickMs = 0;
let _rootEl = null;
let _autoPlayDisabled = false; // prefers-reduced-motion + manual override

// ─── Pure helpers (unit-tested in isolation) ───────────────────────────

/**
 * Parse the replay JSON's metadata block + first frame for the bottom info
 * panel (WHEN / CTX / YOU lines per spec §4.2 mockup). Defensive — any
 * missing field falls back to '???' so the viewer renders for partial data.
 *
 * @param {object} replayJson - parsed replay JSON (the array wrapper [{...}])
 * @returns {{whenStr: string, ctxStr: string, youStr: string, triggerType: string, bossKey: string, title: string}}
 */
export function parseReplayMetadata(replayJson) {
  const fallback = {
    whenStr: '???',
    ctxStr: '???',
    youStr: '???',
    triggerType: 'unknown',
    bossKey: '',
    title: 'REPLAY',
  };
  try {
    // T3.07 wraps the payload in `compressFrames([payload])` → top-level array.
    const root = Array.isArray(replayJson) ? replayJson[0] : replayJson;
    if (!root || typeof root !== 'object') return fallback;
    const triggerType = root.type || 'unknown';
    const meta = (root.metadata && typeof root.metadata === 'object') ? root.metadata : {};
    const bossKey = meta.boss_id || '';

    // WHEN: ISO timestamp → relative ("Day N") or absolute date string.
    const whenStr = formatTimestamp(root.timestamp);

    // CTX: trigger label + boss when relevant.
    const triggerLabel = REPLAY_VIEWER_TRIGGER_LABELS[triggerType] || triggerType;
    const ctxBits = [triggerLabel];
    if (bossKey) ctxBits.push(_displayBossKey(bossKey));
    if (typeof meta.combo === 'number' && meta.combo > 0) ctxBits.push(`combo ×${meta.combo}`);
    if (meta.rows_cleared !== undefined && meta.cols_cleared !== undefined) {
      ctxBits.push(`${meta.rows_cleared}R + ${meta.cols_cleared}C`);
    }
    const ctxStr = ctxBits.join(' · ');

    // YOU: race/squad summary from first frame's squad field.
    let youStr = '???';
    if (Array.isArray(root.frames) && root.frames.length > 0) {
      const firstFrame = root.frames[0];
      const squad = firstFrame && firstFrame.squad;
      if (Array.isArray(squad) && squad.length > 0) {
        const tags = squad.map(s => (typeof s === 'string' ? s : (s && s.race) || '')).filter(Boolean);
        if (tags.length > 0) {
          // Compact: "Pirate squad (×5)" — dominant tag + count, like spec mockup.
          const dominant = _modeOf(tags);
          youStr = `${_titleCase(dominant)} squad (×${tags.length})`;
        }
      }
    }
    if (meta.race_dominant && youStr === '???') {
      youStr = `${_titleCase(meta.race_dominant)} squad`;
    }

    const title = bossKey
      ? `${_displayBossKey(bossKey)} · ${triggerLabel}`
      : triggerLabel.toUpperCase();

    return { whenStr, ctxStr, youStr, triggerType, bossKey, title };
  } catch (_e) {
    return fallback;
  }
}

/**
 * Format an ISO-8601 timestamp into a "Day N" relative string (if within
 * REPLAY_VIEWER_REL_DAY_CUTOFF days) or an absolute YYYY-MM-DD fallback.
 *
 * @param {string} isoTs
 * @param {number} [nowMs] - override "now" for deterministic tests
 * @returns {string}
 */
export function formatTimestamp(isoTs, nowMs) {
  try {
    if (typeof isoTs !== 'string' || isoTs.length === 0) return '???';
    const ts = Date.parse(isoTs);
    if (!isFinite(ts)) return '???';
    const now = (typeof nowMs === 'number' && isFinite(nowMs)) ? nowMs : Date.now();
    const daysAgo = Math.floor((now - ts) / (24 * 60 * 60 * 1000));
    if (daysAgo < 0) return isoTs.slice(0, 10);
    if (daysAgo <= REPLAY_VIEWER_REL_DAY_CUTOFF) {
      // Spec §4.2 mockup uses "Day 7" — interpret as days since the replay event.
      return daysAgo === 0 ? 'Today' : `Day ${daysAgo} ago`;
    }
    return isoTs.slice(0, 10);
  } catch (_e) {
    return '???';
  }
}

/**
 * Compute normalized timeline progress in [0, 1]. Defensive for zero-total
 * and out-of-bounds index; clamps both ends.
 *
 * @param {number} currentFrameIdx
 * @param {number} totalFrames
 * @returns {number} 0..1 inclusive
 */
export function computeTimelineProgress(currentFrameIdx, totalFrames) {
  const t = (typeof totalFrames === 'number' && isFinite(totalFrames) && totalFrames > 0) ? totalFrames : 0;
  if (t === 0) return 0;
  const idx = (typeof currentFrameIdx === 'number' && isFinite(currentFrameIdx)) ? currentFrameIdx : 0;
  if (idx <= 0) return 0;
  if (idx >= t - 1) return 1;
  return idx / (t - 1);
}

/**
 * Clamp a requested playback speed to the allowed REPLAY_VIEWER_SPEEDS set.
 * Below the min or above the max collapses to the nearest valid speed.
 *
 * @param {number} speed
 * @returns {number}
 */
export function clampSpeed(speed) {
  const s = (typeof speed === 'number' && isFinite(speed)) ? speed : REPLAY_VIEWER_DEFAULT_SPEED;
  const min = REPLAY_VIEWER_SPEEDS[0];
  const max = REPLAY_VIEWER_SPEEDS[REPLAY_VIEWER_SPEEDS.length - 1];
  if (s <= min) return min;
  if (s >= max) return max;
  // Snap to closest allowed value (0.5 / 1 / 2).
  let closest = REPLAY_VIEWER_SPEEDS[0];
  let diff = Math.abs(closest - s);
  for (const v of REPLAY_VIEWER_SPEEDS) {
    const d = Math.abs(v - s);
    if (d < diff) { diff = d; closest = v; }
  }
  return closest;
}

/**
 * Render a single frame snapshot to a 2D canvas context. Pure — paints
 * grid cells (8×8) with `imageSmoothingEnabled = false` for pixel-perfect
 * rendering. Defensive — null/missing frames paint just the background.
 *
 * @param {object} frame - frame snapshot { grid, boss, squad, ... }
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} canvasPx - canvas edge length in pixels
 */
export function renderFrameToCanvas(frame, ctx, canvasPx) {
  if (!ctx) return;
  const px = (typeof canvasPx === 'number' && canvasPx > 0) ? canvasPx : REPLAY_VIEWER_CANVAS_PX;
  try {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = REPLAY_VIEWER_CANVAS_BG;
    ctx.fillRect(0, 0, px, px);

    const grid = frame && frame.grid;
    if (Array.isArray(grid)) {
      const rows = REPLAY_VIEWER_GRID_ROWS;
      const cols = REPLAY_VIEWER_GRID_COLS;
      const cellPx = Math.floor(px / cols);
      for (let r = 0; r < rows; r++) {
        const rowArr = grid[r];
        if (!Array.isArray(rowArr)) continue;
        for (let c = 0; c < cols; c++) {
          const cell = rowArr[c];
          if (cell === undefined || cell === null || cell === 0) continue;
          const color = REPLAY_VIEWER_CELL_COLORS[cell] || REPLAY_VIEWER_CELL_COLORS[1];
          ctx.fillStyle = color;
          ctx.fillRect(c * cellPx, r * cellPx, cellPx - 1, cellPx - 1);
        }
      }
    }

    // Boss HP banner along the bottom strip (purely informational).
    const boss = frame && frame.boss;
    if (boss && (typeof boss.hp === 'number' || typeof boss.id === 'string')) {
      const stripH = Math.max(4, Math.floor(px * 0.04));
      ctx.fillStyle = '#A88033';
      ctx.fillRect(0, px - stripH, px, stripH);
      if (typeof boss.hp === 'number' && typeof boss.maxHp === 'number' && boss.maxHp > 0) {
        const pct = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
        ctx.fillStyle = '#E85D4A';
        ctx.fillRect(0, px - stripH, Math.floor(px * pct), stripH);
      }
    }
  } catch (_e) { /* defensive — canvas paint must not crash */ }
}

// ─── Display helpers (private) ─────────────────────────────────────────

function _displayBossKey(key) {
  if (typeof key !== 'string' || key.length === 0) return '';
  return key.split(/[_-]/).map(_titleCase).join(' ');
}

function _titleCase(s) {
  if (typeof s !== 'string' || s.length === 0) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function _modeOf(arr) {
  const counts = Object.create(null);
  let best = arr[0] || '';
  let bestN = 0;
  for (const v of arr) {
    counts[v] = (counts[v] | 0) + 1;
    if (counts[v] > bestN) { bestN = counts[v]; best = v; }
  }
  return best;
}

function _escape(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _prefersReducedMotion() {
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
    }
  } catch (_e) {}
  return false;
}

// ─── Main render entry ─────────────────────────────────────────────────

/**
 * Mount the Replay viewer into `rootEl` and async-fetch the replay JSON
 * by `replayId`. Defaults: rootEl = #screenReplayViewer; replayId from
 * window.__replayViewerCurrentId (set by router deeplink handler).
 *
 * The render sequence:
 *   1. Synchronous "Loading…" shell (FCP <300ms).
 *   2. Async window.__fetchReplay(replayId) — graceful empty-state on
 *      null/missing or thrown.
 *   3. parseReplayMetadata + first-frame paint.
 *   4. Auto-play if prefers-reduced-motion is NOT set.
 *
 * @param {HTMLElement} [rootEl]
 * @param {string} [replayId]
 */
export function renderReplayViewer(rootEl, replayId) {
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  const root = rootEl || (typeof document !== 'undefined'
    ? document.getElementById('screenReplayViewer')
    : null);
  if (!root) return;
  _rootEl = root;

  // Reset playback state — fresh viewer mount.
  _replayJson = null;
  _frames = [];
  _currentFrameIdx = 0;
  _isPlaying = false;
  _isLooping = false;
  _speed = REPLAY_VIEWER_DEFAULT_SPEED;
  _lastTickMs = 0;
  _autoPlayDisabled = _prefersReducedMotion();
  if (_rafHandle !== null) {
    try { cancelAnimationFrame(_rafHandle); } catch (_e) {}
    _rafHandle = null;
  }

  // Resolve replayId from arg → window-pinned current id → query string.
  const id = replayId
    || (typeof window !== 'undefined' && window.__replayViewerCurrentId)
    || _readReplayIdFromQuery();

  // Step 1 — synchronous loading shell. Even if fetch fails this paints.
  root.innerHTML = _renderShell({ title: 'REPLAY', loading: true });
  _wireBackButton(root);

  // Step 2 — async fetch. Defensive — fetch may be unavailable (no SDK)
  // and that's a legal first-launch state. Prefer the window-bridge
  // (overridable by tests) and fall back to the direct backend import.
  Promise.resolve().then(async () => {
    let blob = null;
    let fetchOk = false;
    try {
      if (id) {
        const fetchFn = (typeof window !== 'undefined' && typeof window.__fetchReplay === 'function')
          ? window.__fetchReplay
          : _fetchReplayBackend;
        blob = await fetchFn(id);
      }
    } catch (_e) {
      blob = null;
    }
    if (typeof blob === 'string' && blob.length > 0) {
      try {
        _replayJson = JSON.parse(blob);
        const root0 = Array.isArray(_replayJson) ? _replayJson[0] : _replayJson;
        _frames = (root0 && Array.isArray(root0.frames)) ? root0.frames : [];
        fetchOk = _frames.length > 0;
      } catch (_e) {
        fetchOk = false;
      }
    }
    if (!fetchOk) {
      // Empty state — fetch returned null, malformed JSON, or zero frames.
      root.innerHTML = _renderEmptyState();
      _wireBackButton(root);
      return;
    }
    // Step 3 — full viewer paint with controls + first frame.
    const meta = parseReplayMetadata(_replayJson);
    root.innerHTML = _renderShell({ title: meta.title, loading: false, meta });
    _wireBackButton(root);
    _wireControls(root);
    _paintCurrentFrame();

    // Step 4 — auto-play (respect prefers-reduced-motion).
    if (!_autoPlayDisabled) {
      play();
    }

    try {
      if (typeof performance !== 'undefined') {
        const dt = performance.now() - _t0;
        if (dt > REPLAY_VIEWER_FCP_BUDGET_MS) {
          try { log.warn('Replay viewer render over FCP budget:', dt.toFixed(2), 'ms'); } catch (_e) {}
        }
      }
    } catch (_e) {}
  });
}

// ─── Shell HTML (synchronous loading + populated viewer) ───────────────

function _renderShell({ title, loading, meta }) {
  const headerTitle = _escape(title || 'REPLAY');
  if (loading) {
    return [
      '<div class="rv-wrap">',
      _renderHeader(headerTitle),
      '<div class="rv-loading">Loading…</div>',
      '</div>',
    ].join('');
  }
  const m = meta || { whenStr: '???', ctxStr: '???', youStr: '???' };
  return [
    '<div class="rv-wrap">',
    _renderHeader(headerTitle),
    '<div class="rv-canvas-wrap">',
    `<canvas class="rv-canvas" id="rvCanvas" width="${REPLAY_VIEWER_CANVAS_PX}" height="${REPLAY_VIEWER_CANVAS_PX}" aria-label="Replay playback"></canvas>`,
    '</div>',
    '<div class="rv-timeline" id="rvTimeline" role="slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0">',
    '<div class="rv-timeline-track">',
    '<div class="rv-timeline-progress" id="rvProgress"></div>',
    '<div class="rv-timeline-handle" id="rvHandle"></div>',
    '</div>',
    `<div class="rv-timeline-label">0.0 / ${(REPLAY_VIEWER_DURATION_MS / 1000).toFixed(1)}s</div>`,
    '</div>',
    '<div class="rv-controls">',
    '<button type="button" class="rv-btn rv-btn--play" id="rvPlayBtn" aria-label="Play / Pause">&#9654;</button>',
    '<button type="button" class="rv-btn rv-btn--slow" id="rvSlowBtn" aria-label="Slower">&#9866;</button>',
    `<span class="rv-speed-label" id="rvSpeedLabel">1×</span>`,
    '<button type="button" class="rv-btn rv-btn--fast" id="rvFastBtn" aria-label="Faster">&#9867;</button>',
    '<button type="button" class="rv-btn rv-btn--loop" id="rvLoopBtn" aria-label="Toggle loop">&#8634;</button>',
    '<button type="button" class="rv-btn rv-btn--share" id="rvShareBtn" aria-label="Share replay">&#8593;</button>',
    '</div>',
    '<div class="rv-info">',
    `<div class="rv-info-row"><span class="rv-info-label">WHEN</span><span class="rv-info-val">${_escape(m.whenStr)}</span></div>`,
    `<div class="rv-info-row"><span class="rv-info-label">CTX</span><span class="rv-info-val">${_escape(m.ctxStr)}</span></div>`,
    `<div class="rv-info-row"><span class="rv-info-label">YOU</span><span class="rv-info-val">${_escape(m.youStr)}</span></div>`,
    '</div>',
    '</div>',
  ].join('');
}

function _renderHeader(title) {
  return [
    '<div class="rv-header">',
    '<button type="button" class="rv-back-btn" id="rvBackBtn" aria-label="Back">&larr;</button>',
    `<h1 class="rv-title">${title}</h1>`,
    '</div>',
  ].join('');
}

function _renderEmptyState() {
  return [
    '<div class="rv-wrap">',
    _renderHeader('REPLAY'),
    '<div class="rv-empty">',
    '<p class="rv-empty-title">Replay not available</p>',
    '<p class="rv-empty-sub">This moment could not be retrieved. It may have expired, or replay storage is not yet available.</p>',
    '</div>',
    '</div>',
  ].join('');
}

// ─── Event wiring ──────────────────────────────────────────────────────

function _wireBackButton(root) {
  try {
    const back = root.querySelector('#rvBackBtn');
    if (!back) return;
    back.addEventListener('click', () => {
      _stopPlayback();
      // Defer-import via window.goToMenu / showScreen — same pattern as codex.js
      // back-button to avoid circular dependency between router + replay-viewer.
      try {
        if (typeof window !== 'undefined') {
          // Prefer back-to-codex if we came from there; otherwise menu.
          if (typeof window.__replayViewerReturnTo === 'string' && typeof window.showScreen === 'function') {
            window.showScreen(window.__replayViewerReturnTo);
          } else if (typeof window.goToMenu === 'function') {
            window.goToMenu();
          } else if (typeof window.showScreen === 'function') {
            window.showScreen('menu');
          }
        }
      } catch (_e) {}
    });
  } catch (_e) {}
}

function _wireControls(root) {
  try {
    // Play / Pause toggle.
    const playBtn = root.querySelector('#rvPlayBtn');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (_isPlaying) pause(); else play();
      });
    }
    // Speed controls.
    const slowBtn = root.querySelector('#rvSlowBtn');
    if (slowBtn) {
      slowBtn.addEventListener('click', () => {
        const idx = REPLAY_VIEWER_SPEEDS.indexOf(_speed);
        const nextIdx = Math.max(0, idx - 1);
        setSpeed(REPLAY_VIEWER_SPEEDS[nextIdx]);
      });
    }
    const fastBtn = root.querySelector('#rvFastBtn');
    if (fastBtn) {
      fastBtn.addEventListener('click', () => {
        const idx = REPLAY_VIEWER_SPEEDS.indexOf(_speed);
        const nextIdx = Math.min(REPLAY_VIEWER_SPEEDS.length - 1, idx + 1);
        setSpeed(REPLAY_VIEWER_SPEEDS[nextIdx]);
      });
    }
    const loopBtn = root.querySelector('#rvLoopBtn');
    if (loopBtn) {
      loopBtn.addEventListener('click', () => toggleLoop());
    }
    const shareBtn = root.querySelector('#rvShareBtn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => _onShareClick());
    }
    // Timeline scrub (click anywhere on the track).
    const timeline = root.querySelector('#rvTimeline');
    if (timeline) {
      timeline.addEventListener('click', (e) => {
        try {
          const rect = timeline.getBoundingClientRect();
          if (!rect || rect.width <= 0) return;
          const x = (e.clientX !== undefined) ? e.clientX : 0;
          const progress = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
          seek(progress);
        } catch (_e) {}
      });
    }
  } catch (_e) {}
}

// ─── Playback engine ───────────────────────────────────────────────────

/**
 * Begin playback. Idempotent — already-playing is a no-op. Drives an rAF
 * loop that advances `_currentFrameIdx` at 4 fps × `_speed`.
 */
export function play() {
  if (_isPlaying) return;
  if (!Array.isArray(_frames) || _frames.length === 0) return;
  _isPlaying = true;
  _lastTickMs = _nowMs();
  _updatePlayButton();
  if (typeof requestAnimationFrame !== 'function') return;
  const tick = () => {
    if (!_isPlaying) { _rafHandle = null; return; }
    try {
      const now = _nowMs();
      const dt = now - _lastTickMs;
      const frameIntervalMs = 1000 / (REPLAY_VIEWER_BASE_FPS * _speed);
      if (dt >= frameIntervalMs) {
        _lastTickMs = now;
        const next = _currentFrameIdx + 1;
        if (next >= _frames.length) {
          if (_isLooping) {
            _currentFrameIdx = 0;
            _paintCurrentFrame();
          } else {
            _currentFrameIdx = _frames.length - 1;
            _paintCurrentFrame();
            pause();
            return;
          }
        } else {
          _currentFrameIdx = next;
          _paintCurrentFrame();
        }
      }
    } catch (_e) {}
    _rafHandle = requestAnimationFrame(tick);
  };
  _rafHandle = requestAnimationFrame(tick);
}

/**
 * Pause playback. Idempotent. The current frame index is preserved.
 */
export function pause() {
  _isPlaying = false;
  if (_rafHandle !== null) {
    try { cancelAnimationFrame(_rafHandle); } catch (_e) {}
    _rafHandle = null;
  }
  _updatePlayButton();
}

/**
 * Seek to a normalized 0..1 progress point. Pauses → seeks → repaints.
 * Resumes play only if the user was playing before the seek.
 *
 * @param {number} progress - 0..1 inclusive
 */
export function seek(progress) {
  if (!Array.isArray(_frames) || _frames.length === 0) return;
  const p = Math.max(0, Math.min(1, (typeof progress === 'number' && isFinite(progress)) ? progress : 0));
  const idx = Math.floor(p * (_frames.length - 1));
  _currentFrameIdx = Math.max(0, Math.min(_frames.length - 1, idx));
  _paintCurrentFrame();
}

/**
 * Set playback speed. Clamps to nearest allowed (0.5 / 1 / 2).
 *
 * @param {number} speed
 */
export function setSpeed(speed) {
  _speed = clampSpeed(speed);
  if (_rootEl) {
    const label = _rootEl.querySelector('#rvSpeedLabel');
    if (label) label.textContent = `${_speed}×`;
  }
  // Reset the tick clock so the new speed kicks in immediately on next frame.
  _lastTickMs = _nowMs();
}

/**
 * Toggle the loop flag.
 */
export function toggleLoop() {
  _isLooping = !_isLooping;
  if (_rootEl) {
    const btn = _rootEl.querySelector('#rvLoopBtn');
    if (btn) btn.classList.toggle('rv-btn--active', _isLooping);
  }
}

function _stopPlayback() {
  pause();
}

function _updatePlayButton() {
  if (!_rootEl) return;
  const btn = _rootEl.querySelector('#rvPlayBtn');
  if (!btn) return;
  // Unicode play / pause toggle.
  btn.innerHTML = _isPlaying ? '&#10074;&#10074;' : '&#9654;';
}

function _paintCurrentFrame() {
  if (!_rootEl) return;
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  try {
    const canvas = _rootEl.querySelector('#rvCanvas');
    if (canvas && typeof canvas.getContext === 'function') {
      const ctx = canvas.getContext('2d');
      const frame = _frames[_currentFrameIdx] || null;
      renderFrameToCanvas(frame, ctx, REPLAY_VIEWER_CANVAS_PX);
    }
    // Timeline progress + label.
    const progress = computeTimelineProgress(_currentFrameIdx, _frames.length);
    const progressEl = _rootEl.querySelector('#rvProgress');
    if (progressEl) progressEl.style.width = `${(progress * 100).toFixed(1)}%`;
    const handleEl = _rootEl.querySelector('#rvHandle');
    if (handleEl) handleEl.style.left = `${(progress * 100).toFixed(1)}%`;
    const labelEl = _rootEl.querySelector('.rv-timeline-label');
    if (labelEl) {
      const tSec = (progress * REPLAY_VIEWER_DURATION_MS / 1000).toFixed(1);
      const totalSec = (REPLAY_VIEWER_DURATION_MS / 1000).toFixed(1);
      labelEl.textContent = `${tSec} / ${totalSec}s`;
    }
    const timeline = _rootEl.querySelector('#rvTimeline');
    if (timeline) {
      timeline.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    }
  } catch (_e) {}
  try {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      if (dt > REPLAY_VIEWER_FRAME_BUDGET_MS) {
        try { log.warn('Replay frame render over budget:', dt.toFixed(2), 'ms'); } catch (_e) {}
      }
    }
  } catch (_e) {}
}

function _nowMs() {
  try {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  } catch (_e) {
    return Date.now();
  }
}

// ─── Share (navigator.share native, with graceful no-op) ───────────────

function _onShareClick() {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      // Graceful no-op — flash a hint on the share button.
      if (_rootEl) {
        const btn = _rootEl.querySelector('#rvShareBtn');
        if (btn) btn.classList.add('rv-btn--share-unavailable');
      }
      return;
    }
    const id = (typeof window !== 'undefined' && window.__replayViewerCurrentId) || '';
    const meta = parseReplayMetadata(_replayJson);
    const loc = (typeof window !== 'undefined') ? window.location : null;
    const url = id
      ? `${(loc && loc.origin) || 'https://blocksworm.com'}/r/${id}`
      : (loc ? loc.href : '');
    const text = (meta.bossKey ? `Defeated ${_displayBossKey(meta.bossKey)} — ` : '') + (meta.ctxStr || 'A moment.');
    navigator.share({ title: 'Blocksworn replay', text, url }).catch(() => { /* user cancelled */ });
  } catch (_e) {}
}

function _readReplayIdFromQuery() {
  try {
    if (typeof window === 'undefined' || !window.location || !window.location.search) return '';
    const m = /[?&]replay=([^&]+)/.exec(window.location.search);
    return (m && m[1]) ? decodeURIComponent(m[1]) : '';
  } catch (_e) {
    return '';
  }
}

// ─── Test-only escape hatches (NOT used in production) ─────────────────
//
// Mirrors __codexTestables / __identityFxTestables convention. Lets unit
// tests inspect + reset module state without depending on private bindings.
export const __replayViewerTestables = Object.freeze({
  reset() {
    _replayJson = null;
    _frames = [];
    _currentFrameIdx = 0;
    _isPlaying = false;
    _isLooping = false;
    _speed = REPLAY_VIEWER_DEFAULT_SPEED;
    _lastTickMs = 0;
    _rootEl = null;
    _autoPlayDisabled = false;
    if (_rafHandle !== null) {
      try { cancelAnimationFrame(_rafHandle); } catch (_e) {}
      _rafHandle = null;
    }
  },
  setFrames(frames) {
    _frames = Array.isArray(frames) ? frames : [];
    _currentFrameIdx = 0;
  },
  setReplayJson(json) { _replayJson = json; },
  setRoot(root) { _rootEl = root; },
  setAutoPlayDisabled(flag) { _autoPlayDisabled = !!flag; },
  getState() {
    return {
      currentFrameIdx: _currentFrameIdx,
      isPlaying: _isPlaying,
      isLooping: _isLooping,
      speed: _speed,
      frameCount: _frames.length,
      autoPlayDisabled: _autoPlayDisabled,
    };
  },
});
