// 2026-05-11 — TASK-010 (T1.09): narrator dispatch helper relocated from
// legacy.
//
// Pairs with the already-extracted T1.07 module ./narrator-lines.js which
// owns the SACRED NARRATOR_LINES strings (CLAUDE.md §2.3). This file owns
// the speakNarrator(trigger) helper that picks a line and renders it into
// the #narrator strip.
//
// Sacred timings preserved (verified vs legacy lines 66404-66423):
//   - narratorBusyUntil window: 3400ms hold (`now + 3400`)
//   - on-strip visibility hold:  3000ms (`setTimeout(... 3000)`)
//
// Behavioural notes preserved byte-perfect:
//   - Defers via _deferDuringDialog when a script dialog is active
//     (prevents narrator strip from bleeding through the dialog overlay).
//   - Silently no-ops if NARRATOR_LINES has no entry for `trigger`, if the
//     busy window hasn't elapsed, or if the #narrator element is missing.
//   - Multi-line entries are picked uniformly at random (preserved as-is —
//     all current triggers ship single lines but the loop is sacred to
//     keep parity with future entries).
//
// Undeclared identifiers preserved from legacy (TODO(T1.10): rewire):
//   - _isDialogActive       — dialog-overlay state probe (legacy line 65502)
//   - _deferDuringDialog    — queues the call until dialog dismissed (legacy line 65507)
// Both will move to a `src/core/dialog-defer.js` (or similar) in T1.10.

/* global _isDialogActive, _deferDuringDialog */

import { NARRATOR_LINES } from './narrator-lines.js';

let narratorBusyUntil = 0;
let narratorTimer = null;

export function speakNarrator(trigger) {
  // 2026-04-27 — defer if a dialog is on screen so narrator strip doesn't
  // bleed through the dialog overlay.
  if (_isDialogActive()) { _deferDuringDialog(() => speakNarrator(trigger)); return; }
  const lines = NARRATOR_LINES[trigger];
  if (!lines || !lines.length) return;
  const now = Date.now();
  if (now < narratorBusyUntil) return; // respect on-screen hold
  const el = document.getElementById('narrator');
  if (!el) return;
  // Rotate lines if multiple
  const line = lines[Math.floor(Math.random() * lines.length)];
  el.textContent = line;
  el.classList.add('visible');
  narratorBusyUntil = now + 3400;
  clearTimeout(narratorTimer);
  narratorTimer = setTimeout(() => el.classList.remove('visible'), 3000);
}
