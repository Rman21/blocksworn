// 2026-05-13 — TASK-048 (T3.08): Replay viewer named constants.
//
// Spec: docs/design/endgame-social.md §4.2 (Replay viewer) + §4.6 (Perf).
// Pure data module — no logic. Mirrors the constants-in-data discipline
// established by src/data/identity-layer.js (CODEX_* table at line 894+).
//
// Sacred safety: this file is READ-ONLY consumed by src/ui/replay-viewer.js
// and tests/unit/replay-viewer.test.js. No sacred values touched.

/** Replay viewer FCP budget — page render must complete in ≤300ms (spec §4.6). */
export const REPLAY_VIEWER_FCP_BUDGET_MS = 300;

/** Frame render budget — single canvas paint ≤16ms for 60fps smoothness (spec §4.2). */
export const REPLAY_VIEWER_FRAME_BUDGET_MS = 16;

/** Stream rehydration budget — fetch + decompress + parse ≤500ms (spec §4.2). */
export const REPLAY_VIEWER_REHYDRATION_BUDGET_MS = 500;

/** Capture frame rate (matches replay-backend REPLAY_CAPTURE_INTERVAL_MS = 250ms). */
export const REPLAY_VIEWER_BASE_FPS = 4;

/** Allowed playback speeds (spec §4.2: 0.5×, 1×, 2× — no faster than 2× at 4fps). */
export const REPLAY_VIEWER_SPEEDS = Object.freeze([0.5, 1, 2]);

/** Default playback speed on viewer mount. */
export const REPLAY_VIEWER_DEFAULT_SPEED = 1;

/** Replay duration in milliseconds (5 sec window — matches REPLAY_SLICE_WINDOW_MS). */
export const REPLAY_VIEWER_DURATION_MS = 5000;

/** Grid dimensions for canvas render (8×8 board — sacred legacy grid). */
export const REPLAY_VIEWER_GRID_COLS = 8;
export const REPLAY_VIEWER_GRID_ROWS = 8;

/** Canvas pixel dimensions — mobile-first 380px-friendly. */
export const REPLAY_VIEWER_CANVAS_PX = 320;

/** Element color palette for grid cells (matches sacred stihiya colors). */
export const REPLAY_VIEWER_CELL_COLORS = Object.freeze({
  0: '#1a1a1a',          // empty cell — dark slate
  1: '#E85D4A',          // ember
  2: '#3B8BD4',          // tide
  3: '#5DCA79',          // grove
  4: '#E8B84A',          // solar
  5: '#9B59D6',          // umbra
  ember: '#E85D4A',
  tide: '#3B8BD4',
  grove: '#5DCA79',
  solar: '#E8B84A',
  umbra: '#9B59D6',
});

/** Default canvas background — parchment-tinted dark for grid contrast. */
export const REPLAY_VIEWER_CANVAS_BG = '#0d0a08';

/** Trigger type → human-readable label for the bottom info panel. */
export const REPLAY_VIEWER_TRIGGER_LABELS = Object.freeze({
  boss_defeat:               'Boss defeated',
  tetris_crit:               '4-line crit',
  identity_fx:               'Identity FX',
  identity_boss_reactivity:  'Boss reactivity',
  big_combo:                 'Big combo',
  stagger_entry:             'Stagger entry',
  tower_milestone:           'Tower milestone',
  adventure_weekly_defeat:   'Adventure defeat',
  party_tower_run_clear:     'Party run clear',
});

/** Days-from-install cutoff for relative ("Day N") vs absolute date formatting. */
export const REPLAY_VIEWER_REL_DAY_CUTOFF = 30;
