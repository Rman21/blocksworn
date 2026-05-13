// 2026-05-13 — TASK-047 (T3.07): Replay capture infrastructure (Phase 3 first task).
//
// Spec: docs/design/endgame-social.md §4 (Replay/Share infrastructure)
//       + §15 ESC-03 Q2 ruling — storage tier wiring from getPlayerSegment().
//
// FIRST Phase 3 implementation task (Designer's strategic recommendation —
// lateral dependency that unblocks Codex Moments Replay button as the visible
// Phase 2 → Phase 3 bridge moment). Backend-only; T3.08 ships the viewer UI,
// T3.09 wires the Codex Replay button.
//
// What this module ships:
//   1. Rolling 60-second in-memory replay buffer (240 frames @ 4 fps × ~10 KB).
//   2. Lightweight state snapshots (JSON), NOT screen recording.
//   3. 9 capture trigger predicates (7 LIVE + 2 deferred stubs for T3.04 / T3.13).
//   4. Storage tier per ESC-03 Q2 — F2P 100 MB / Minnow 100 MB /
//      Dolphin 250 MB / Whale 500 MB — ALL PERMANENT (no TTL).
//   5. Firebase Storage upload helper (gracefully no-op when SDK absent).
//
// Performance budget (spec §4.1 + §4.6):
//   - Frame-time overhead: ≤4 ms / frame averaged
//   - Memory: ≤2.4 MB rolling buffer (240 × ~10 KB)
//   - Trigger extraction: ≤16 ms
//
// Sacred-cow safety (CLAUDE.md §2):
//   - READ-ONLY of game state. Never mutates grid / squad / boss / fx state.
//   - `getPlayerSegment()` read-only — sacred T1.20 thresholds untouched.
//   - No V_HAPTICS / NARRATOR_LINES / RACE_SYNERGY / combo crit interaction.
//   - All exports wrapped in defensive try/catch — sacred game loop must NOT
//     regress if replay infra throws (ADR-004 hybrid coexistence discipline).
//
// Public API:
//   Lifecycle:
//     - startReplayCapture()        — start 4fps interval (idempotent)
//     - stopReplayCapture()         — clear interval (idempotent)
//     - resetReplayBuffer()         — drop buffer (call on battle end / new run)
//   Snapshot + buffer (pure helpers, unit-tested in isolation):
//     - captureFrameSnapshot(state) → frame JSON
//     - appendFrameToBuffer(buf, frame, max) → new buffer (FIFO ring)
//     - extractSliceAroundTrigger(buf, t, windowMs) → frame[]
//     - compressFrames(frames)      → string
//     - computeReplaySize(jsonStr)  → byte count
//   Storage tier:
//     - getStorageQuotaForSegment(seg) → MB cap
//     - getStorageTier()              → segment name
//   Trigger emit:
//     - emitReplayTrigger(type, ctx) — fire-and-forget upload
//   9 trigger predicates (window-bridge friendly):
//     - onBossDefeatedTrigger / onTetrisCritTrigger / onIdentityFxTrigger /
//       onIdentityBossReactivityTrigger / onBigComboTrigger /
//       onStaggerEntryTrigger / onTowerMilestoneTrigger /
//       onAdventureWeeklyDefeatTrigger (stub) / onPartyTowerRunClearTrigger (stub)
//   Firebase Storage:
//     - uploadReplay(json, replayId, segment) → async
//     - fetchReplay(replayId)               → async

import { getPlayerSegment, SEGMENT_F2P, SEGMENT_MINNOW, SEGMENT_DOLPHIN, SEGMENT_WHALE } from './analytics.js';
import { uploadStorageBlob, downloadStorageBlob } from './firebase.js';
import { log } from './logger.js';
// T3.09 (2026-05-13): Direct-import the Codex moment-replay recorder (mirrors
// T3.08's `fetchReplay` direct-import precedent — keeps the window-bridge
// footprint stable at 38 functions). Only consumed by `emitReplayTrigger`
// when the trigger type is IDENTITY_BOSS_REACTIVITY AND the handler key maps
// to a known Codex moment. All other trigger types skip the linkage silently.
import { recordMomentReplay } from '../ui/codex.js';
import { IDENTITY_BOSS_HANDLER_TO_MOMENT_KEY } from '../data/identity-layer.js';

// ──────────────────────────────────────────────────────────────────────────
// Constants (per spec §4.1 + §4.6). Named — no magic numbers in logic.
// ──────────────────────────────────────────────────────────────────────────

/** Capture interval — 4 fps per spec §4.1 (every 250 ms). */
export const REPLAY_CAPTURE_INTERVAL_MS = 250;

/** Rolling buffer cap — 60 sec × 4 fps = 240 frames (spec §4.1). */
export const REPLAY_BUFFER_MAX_FRAMES = 240;

/** Trigger slice window — 5 sec around the event (spec §4.1). */
export const REPLAY_SLICE_WINDOW_MS = 5000;

/** Identity FX sample rate — 1 in 5 fires get captured (spec §4.1 row 3). */
export const IDENTITY_FX_SAMPLE_RATE = 5;

/** Big-combo threshold — combo ≥ 4 (spec §4.1 row 5). */
export const BIG_COMBO_THRESHOLD = 4;

/** Tetris-crit line count — 4 (spec §4.1 row 2). */
export const TETRIS_CRIT_LINE_COUNT = 4;

/** Storage quota per segment in MB (sacred ESC-03 Q2 ruling — all permanent). */
export const STORAGE_QUOTA_MB_BY_SEGMENT = Object.freeze({
  [SEGMENT_F2P]: 100,
  [SEGMENT_MINNOW]: 100,
  [SEGMENT_DOLPHIN]: 250,
  [SEGMENT_WHALE]: 500,
});

/** Trigger type names — frozen registry to keep upload metadata consistent. */
export const REPLAY_TRIGGER_TYPES = Object.freeze({
  BOSS_DEFEAT: 'boss_defeat',
  TETRIS_CRIT: 'tetris_crit',
  IDENTITY_FX: 'identity_fx',
  IDENTITY_BOSS_REACTIVITY: 'identity_boss_reactivity',
  BIG_COMBO: 'big_combo',
  STAGGER_ENTRY: 'stagger_entry',
  TOWER_MILESTONE: 'tower_milestone',
  ADVENTURE_WEEKLY_DEFEAT: 'adventure_weekly_defeat',
  PARTY_TOWER_RUN_CLEAR: 'party_tower_run_clear',
});

/** Tower milestone floor markers (spec §4.1 row 7). */
export const TOWER_MILESTONE_FLOORS = Object.freeze([25, 50, 75, 100]);

// ──────────────────────────────────────────────────────────────────────────
// Module state — rolling buffer + capture timer + sample counters.
// ──────────────────────────────────────────────────────────────────────────

let _replayBuffer = [];
let _captureTimer = null;
let _identityFxSampleCounter = 0;

// Injection seam — `getCurrentGameState` is a no-op by default; tests + the
// legacy bridge can wire it to a real snapshot source. NEVER mutates state.
let _stateProvider = () => null;

/**
 * Inject a game-state provider (called every capture tick). Pure read.
 * @param {function(): object} fn
 */
export function setGameStateProvider(fn) {
  _stateProvider = (typeof fn === 'function') ? fn : (() => null);
}

/**
 * Reset Identity FX sample counter — used by tests for deterministic asserts.
 */
export function _resetIdentityFxSampleCounter() {
  _identityFxSampleCounter = 0;
}

// ──────────────────────────────────────────────────────────────────────────
// Pure helpers (unit-tested in isolation).
// ──────────────────────────────────────────────────────────────────────────

/**
 * Build a lightweight JSON snapshot of the current game state. Defensive —
 * any missing field defaults to null/empty, never throws. Per spec §4.1:
 * `{ grid, pieceQueue, squad, boss, identityFxState, ultCharges, t }`.
 *
 * @param {object} gameState - snapshot input (may be null)
 * @returns {object} frame JSON
 */
export function captureFrameSnapshot(gameState) {
  const t = (typeof performance !== 'undefined' && performance.now)
    ? performance.now()
    : Date.now();
  if (!gameState || typeof gameState !== 'object') {
    return { grid: null, pieceQueue: null, squad: null, boss: null, identityFxState: null, ultCharges: null, t };
  }
  // Shallow-clone (per spec §4.1: snapshot, not deep-copy of mutable refs).
  // Each field is defensively read — sacred game state objects are never
  // mutated by this function.
  return {
    grid: gameState.grid || null,
    pieceQueue: gameState.pieceQueue || null,
    squad: gameState.squad || null,
    boss: gameState.boss || null,
    identityFxState: gameState.identityFxState || null,
    ultCharges: gameState.ultCharges || null,
    t,
  };
}

/**
 * Append a frame to the buffer, dropping the oldest frame on overflow (FIFO
 * ring-buffer pattern). PURE — returns a new array; does not mutate input.
 *
 * @param {Array<object>} buffer
 * @param {object} frame
 * @param {number} maxFrames - cap (default REPLAY_BUFFER_MAX_FRAMES)
 * @returns {Array<object>}
 */
export function appendFrameToBuffer(buffer, frame, maxFrames) {
  const cap = (typeof maxFrames === 'number' && maxFrames > 0) ? maxFrames : REPLAY_BUFFER_MAX_FRAMES;
  const next = Array.isArray(buffer) ? buffer.slice() : [];
  next.push(frame);
  if (next.length > cap) {
    return next.slice(next.length - cap);
  }
  return next;
}

/**
 * Extract the frame slice in `[triggerTime - windowMs, triggerTime]`. Defensive
 * for buffer-start edge case — if the trigger fires before windowMs of capture
 * has elapsed, returns whatever frames are available.
 *
 * @param {Array<object>} buffer
 * @param {number} triggerTime
 * @param {number} windowMs - default REPLAY_SLICE_WINDOW_MS
 * @returns {Array<object>}
 */
export function extractSliceAroundTrigger(buffer, triggerTime, windowMs) {
  if (!Array.isArray(buffer) || buffer.length === 0) return [];
  const w = (typeof windowMs === 'number' && windowMs > 0) ? windowMs : REPLAY_SLICE_WINDOW_MS;
  const lower = triggerTime - w;
  const out = [];
  for (const f of buffer) {
    if (!f || typeof f.t !== 'number') continue;
    if (f.t >= lower && f.t <= triggerTime) out.push(f);
  }
  return out;
}

/**
 * Compress frames to a JSON string. MVP uses JSON.stringify; future passes
 * (T3.07.1+) may layer delta-encoding for additional compression.
 *
 * @param {Array<object>} frames
 * @returns {string}
 */
export function compressFrames(frames) {
  try {
    return JSON.stringify(Array.isArray(frames) ? frames : []);
  } catch (_e) {
    return '[]';
  }
}

/**
 * Compute byte size of a compressed JSON string. Used for storage-quota
 * accounting. Falls back to `string.length` when Buffer / TextEncoder are
 * unavailable (e.g., very old runtimes).
 *
 * @param {string} jsonStr
 * @returns {number}
 */
export function computeReplaySize(jsonStr) {
  if (typeof jsonStr !== 'string') return 0;
  // Node has Buffer; browsers have TextEncoder; both report UTF-8 byte length.
  try {
    if (typeof Buffer !== 'undefined' && typeof Buffer.byteLength === 'function') {
      return Buffer.byteLength(jsonStr, 'utf8');
    }
  } catch (_e) { /* swallow */ }
  try {
    // eslint-disable-next-line no-undef
    const TE = (typeof TextEncoder !== 'undefined') ? TextEncoder : null;
    if (TE) {
      return new TE().encode(jsonStr).length;
    }
  } catch (_e) { /* swallow */ }
  return jsonStr.length;
}

/**
 * Return per-segment storage quota in MB per ESC-03 Q2 ruling. Unknown
 * segments fall back to F2P quota — sacred ALL-PERMANENT guarantee.
 *
 * @param {string} segment - 'F2P' | 'Minnow' | 'Dolphin' | 'Whale'
 * @returns {number}
 */
export function getStorageQuotaForSegment(segment) {
  if (segment && Object.prototype.hasOwnProperty.call(STORAGE_QUOTA_MB_BY_SEGMENT, segment)) {
    return STORAGE_QUOTA_MB_BY_SEGMENT[segment];
  }
  return STORAGE_QUOTA_MB_BY_SEGMENT[SEGMENT_F2P];
}

/**
 * Read the current player's segment via analytics.getPlayerSegment(). Pure
 * READ — the legacy spending key is the source of truth (sacred T1.20).
 * Defaults to F2P on any error.
 *
 * @returns {string} segment name
 */
export function getStorageTier() {
  try {
    // Mirrors src/main.js _readTotalSpentUSD() shape; replay reads — never writes.
    let totalSpentUSD = 0;
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('blocksworn_p5_spending');
        const n = raw ? parseFloat(raw) : 0;
        if (typeof n === 'number' && isFinite(n) && n > 0) totalSpentUSD = n;
      }
    } catch (_e) { /* swallow */ }
    return getPlayerSegment({ iap: { totalSpentUSD } });
  } catch (_e) {
    return SEGMENT_F2P;
  }
}

/**
 * Generate a 12-char replay ID. Content-hashed via a cheap polynomial digest
 * over the compressed JSON so identical replay states dedupe naturally
 * (spec §4.4). MVP — not cryptographically secure; collision probability is
 * negligible for personal-collection scale.
 *
 * @param {string} jsonStr
 * @returns {string}
 */
export function generateReplayId(jsonStr) {
  const s = (typeof jsonStr === 'string') ? jsonStr : '';
  // 32-bit polynomial hash (djb2-ish). 12-char base-36 keeps the URL short.
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  }
  // Combine with current ms timestamp to avoid identical-state collisions
  // across multiple captures within the same battle.
  const ts = Date.now() & 0xffffffff;
  const base = (h.toString(36) + ts.toString(36) + '000000000000').slice(0, 12);
  return base;
}

// ──────────────────────────────────────────────────────────────────────────
// Lifecycle.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Start the 4 fps capture timer. Idempotent — repeated calls are no-ops.
 * Defensive — any error in the capture tick is swallowed (must not regress
 * sacred game loop).
 */
export function startReplayCapture() {
  try {
    if (_captureTimer !== null) return;
    if (typeof setInterval !== 'function') return;
    _captureTimer = setInterval(() => {
      try {
        const state = _stateProvider();
        const frame = captureFrameSnapshot(state);
        _replayBuffer = appendFrameToBuffer(_replayBuffer, frame, REPLAY_BUFFER_MAX_FRAMES);
      } catch (_e) { /* swallow — capture must never throw */ }
    }, REPLAY_CAPTURE_INTERVAL_MS);
  } catch (e) {
    try { log.warn('[replay-backend] startReplayCapture failed:', e); } catch (_e) { /* swallow */ }
  }
}

/**
 * Stop the capture timer. Idempotent.
 */
export function stopReplayCapture() {
  try {
    if (_captureTimer !== null) {
      clearInterval(_captureTimer);
      _captureTimer = null;
    }
  } catch (e) {
    try { log.warn('[replay-backend] stopReplayCapture failed:', e); } catch (_e) { /* swallow */ }
  }
}

/**
 * Drop the rolling buffer (call on battle end / new run). Does not stop the
 * capture timer — that's `stopReplayCapture`.
 */
export function resetReplayBuffer() {
  try {
    _replayBuffer = [];
    _identityFxSampleCounter = 0;
  } catch (_e) { /* swallow */ }
}

/**
 * Test-only accessor for the in-memory buffer (used by unit tests + the
 * smoke specs to assert buffer-shape after timer ticks). Never call from
 * production code — buffer mutations remain internal.
 *
 * @returns {Array<object>}
 */
export function _getReplayBufferForTest() {
  return _replayBuffer.slice();
}

// ──────────────────────────────────────────────────────────────────────────
// Firebase Storage interface.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Upload a replay JSON blob to Firebase Storage at the canonical path
 * `replays/{uid}/{replayId}.json`. Async + fire-and-forget. Gracefully
 * no-ops when the Storage SDK isn't initialized (T3.07 scope — live SDK
 * wired in T3.07.1 follow-up if needed).
 *
 * @param {string} replayJson - compressed JSON
 * @param {string} replayId   - 12-char content hash
 * @param {string} segment    - player segment for quota tagging
 * @returns {Promise<{ok: boolean, path?: string, size?: number, reason?: string}>}
 */
export async function uploadReplay(replayJson, replayId, segment) {
  try {
    if (typeof replayJson !== 'string' || !replayId) {
      return { ok: false, reason: 'invalid-input' };
    }
    const size = computeReplaySize(replayJson);
    const quotaMB = getStorageQuotaForSegment(segment || getStorageTier());
    // Per-replay sanity guard — single replay must not exceed 1 MB (spec §4.1
    // hard cap on slice size). Quota enforcement aggregates across replays
    // server-side; T3.07 client only blocks individually-oversized uploads.
    if (size > 1024 * 1024) {
      return { ok: false, reason: 'replay-too-large', size };
    }
    const uid = _readCurrentUid();
    const path = `replays/${uid}/${replayId}.json`;
    const metadata = {
      contentType: 'application/json',
      customMetadata: {
        segment: segment || getStorageTier(),
        quotaMB: String(quotaMB),
      },
    };
    const result = await uploadStorageBlob(path, replayJson, metadata);
    return { ok: !!(result && result.ok), path, size, reason: result && result.reason };
  } catch (e) {
    try { log.warn('[replay-backend] uploadReplay failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false, reason: 'exception' };
  }
}

/**
 * Fetch a replay JSON blob by ID (for T3.08 viewer). Returns null when SDK
 * absent or the blob is missing.
 *
 * @param {string} replayId
 * @returns {Promise<string|null>}
 */
export async function fetchReplay(replayId) {
  try {
    if (!replayId) return null;
    const uid = _readCurrentUid();
    const path = `replays/${uid}/${replayId}.json`;
    const blob = await downloadStorageBlob(path);
    return (typeof blob === 'string') ? blob : null;
  } catch (e) {
    try { log.warn('[replay-backend] fetchReplay failed:', e); } catch (_e) { /* swallow */ }
    return null;
  }
}

function _readCurrentUid() {
  try {
    if (typeof window !== 'undefined' && window.fb && window.fb.auth
        && window.fb.auth.currentUser && window.fb.auth.currentUser.uid) {
      return window.fb.auth.currentUser.uid;
    }
  } catch (_e) { /* swallow */ }
  return 'anonymous';
}

// ──────────────────────────────────────────────────────────────────────────
// Trigger emit + 9 predicates.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Core emit — extract the 5-sec slice around `now`, compress, hash, upload.
 * Fire-and-forget. Wrapped in try/catch — sacred game loop never regresses.
 *
 * @param {string} triggerType - one of REPLAY_TRIGGER_TYPES
 * @param {object} contextData - trigger-specific metadata for the upload
 * @returns {Promise<{ok: boolean, replayId?: string}>}
 */
export async function emitReplayTrigger(triggerType, contextData) {
  try {
    const now = (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();
    const slice = extractSliceAroundTrigger(_replayBuffer, now, REPLAY_SLICE_WINDOW_MS);
    const payload = {
      version: 1,
      type: triggerType,
      timestamp: new Date().toISOString(),
      duration_ms: REPLAY_SLICE_WINDOW_MS,
      frames: slice,
      metadata: (contextData && typeof contextData === 'object') ? contextData : {},
    };
    const jsonStr = compressFrames([payload]);
    const replayId = generateReplayId(jsonStr);
    const segment = getStorageTier();
    const result = await uploadReplay(jsonStr, replayId, segment);
    // T3.09 (spec §4.5) — on successful upload of a boss-reactivity replay,
    // link the replayId to the matching Codex moment so the Moments tab
    // shows a Replay button. Only fires for IDENTITY_BOSS_REACTIVITY triggers
    // whose handler key maps to a known moment (5 entries today: phoenix /
    // lich / berserker / engineer / grovewarden). Other trigger types
    // (boss_defeat, tetris_crit, identity_fx, big_combo, stagger_entry,
    // tower_milestone) still upload but don't attach to a Codex moment.
    //
    // Defensive: any failure inside recordMomentReplay is swallowed by its
    // own try/catch; this outer try/catch protects the replay-emit pipeline
    // from any unforeseen issue with the Codex import chain.
    if (result && result.ok && triggerType === REPLAY_TRIGGER_TYPES.IDENTITY_BOSS_REACTIVITY) {
      try {
        const handlerKey = (contextData && typeof contextData === 'object') ? contextData.event : null;
        const momentKey = (handlerKey && Object.prototype.hasOwnProperty.call(IDENTITY_BOSS_HANDLER_TO_MOMENT_KEY, handlerKey))
          ? IDENTITY_BOSS_HANDLER_TO_MOMENT_KEY[handlerKey]
          : null;
        if (momentKey) {
          recordMomentReplay(momentKey, replayId);
        }
      } catch (linkErr) {
        try { log.warn('[replay-backend] recordMomentReplay linkage failed:', linkErr); } catch (_e) { /* swallow */ }
      }
    }
    return { ok: !!(result && result.ok), replayId, ...result };
  } catch (e) {
    try { log.warn('[replay-backend] emitReplayTrigger failed:', e); } catch (_e) { /* swallow */ }
    return { ok: false };
  }
}

// 1. Boss defeated (always — one per boss-kill).
export function onBossDefeatedTrigger(bossKey, ctx) {
  try {
    return emitReplayTrigger(REPLAY_TRIGGER_TYPES.BOSS_DEFEAT, {
      boss_id: bossKey || 'unknown',
      ...(ctx && typeof ctx === 'object' ? ctx : {}),
    });
  } catch (_e) { return Promise.resolve({ ok: false }); }
}

// 2. Tetris crit — 4-line clear (rows.length + cols.length === 4). Spec row 2.
export function onTetrisCritTrigger(rows, cols, ctx) {
  try {
    const rLen = Array.isArray(rows) ? rows.length : 0;
    const cLen = Array.isArray(cols) ? cols.length : 0;
    if ((rLen + cLen) !== TETRIS_CRIT_LINE_COUNT) {
      return Promise.resolve({ ok: false, reason: 'not-tetris' });
    }
    return emitReplayTrigger(REPLAY_TRIGGER_TYPES.TETRIS_CRIT, {
      rows_cleared: rLen, cols_cleared: cLen,
      ...(ctx && typeof ctx === 'object' ? ctx : {}),
    });
  } catch (_e) { return Promise.resolve({ ok: false }); }
}

// 3. Identity Layer race FX — sample 1-in-5 (spec row 3).
export function onIdentityFxTrigger(raceKey, ctx) {
  try {
    _identityFxSampleCounter++;
    // Fire on every 5th call (deterministic + simple — no RNG required, matches
    // spec "sample 1-in-5" without coin-flip noise. Tests can verify exactly.)
    if ((_identityFxSampleCounter % IDENTITY_FX_SAMPLE_RATE) !== 0) {
      return Promise.resolve({ ok: false, reason: 'sampled-out' });
    }
    return emitReplayTrigger(REPLAY_TRIGGER_TYPES.IDENTITY_FX, {
      race: raceKey || 'unknown',
      ...(ctx && typeof ctx === 'object' ? ctx : {}),
    });
  } catch (_e) { return Promise.resolve({ ok: false }); }
}

// 4. Identity Layer boss reactivity (spec row 4 — always).
export function onIdentityBossReactivityTrigger(eventKey, ctx) {
  try {
    return emitReplayTrigger(REPLAY_TRIGGER_TYPES.IDENTITY_BOSS_REACTIVITY, {
      event: eventKey || 'unknown',
      ...(ctx && typeof ctx === 'object' ? ctx : {}),
    });
  } catch (_e) { return Promise.resolve({ ok: false }); }
}

// 5. Big combo — combo ≥ 4 (spec row 5).
export function onBigComboTrigger(comboCount, ctx) {
  try {
    const c = (typeof comboCount === 'number' && isFinite(comboCount)) ? comboCount : 0;
    if (c < BIG_COMBO_THRESHOLD) {
      return Promise.resolve({ ok: false, reason: 'below-threshold' });
    }
    return emitReplayTrigger(REPLAY_TRIGGER_TYPES.BIG_COMBO, {
      combo: c,
      ...(ctx && typeof ctx === 'object' ? ctx : {}),
    });
  } catch (_e) { return Promise.resolve({ ok: false }); }
}

// 6. Stagger entry — Active → Stagger transition (spec row 6).
export function onStaggerEntryTrigger(bossKey, ctx) {
  try {
    return emitReplayTrigger(REPLAY_TRIGGER_TYPES.STAGGER_ENTRY, {
      boss_id: bossKey || 'unknown',
      ...(ctx && typeof ctx === 'object' ? ctx : {}),
    });
  } catch (_e) { return Promise.resolve({ ok: false }); }
}

// 7. Tower floor 25/50/75/100 milestones (spec row 7).
export function onTowerMilestoneTrigger(floor, ctx) {
  try {
    const f = (typeof floor === 'number' && isFinite(floor)) ? floor : 0;
    if (!TOWER_MILESTONE_FLOORS.includes(f)) {
      return Promise.resolve({ ok: false, reason: 'not-milestone' });
    }
    return emitReplayTrigger(REPLAY_TRIGGER_TYPES.TOWER_MILESTONE, {
      floor: f,
      ...(ctx && typeof ctx === 'object' ? ctx : {}),
    });
  } catch (_e) { return Promise.resolve({ ok: false }); }
}

// 8. Adventure weekly defeat — DEFERRED stub (T3.04 wires this).
export function onAdventureWeeklyDefeatTrigger(_ctx) {
  // Deferred to T3.04 Adventures backend. Returns early but reserves the
  // trigger-type registry slot so T3.04 can drop in the live emit without
  // re-touching the bridge / main.js wire-up.
  return Promise.resolve({ ok: false, reason: 'deferred-to-T3.04' });
}

// 9. Party Tower run clear — DEFERRED stub (T3.13 wires this).
export function onPartyTowerRunClearTrigger(_ctx) {
  return Promise.resolve({ ok: false, reason: 'deferred-to-T3.13' });
}
