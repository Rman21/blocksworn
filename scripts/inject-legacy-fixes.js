// 2026-05-14 — Post-build legacy HTML fixes.
//
// Phase 4.1 sidecar wiring was rolled back. play.blocksworm.com/ now
// serves the pure 21 MB legacy single-HTML game — same content that ran
// at blocksworm.com/play for months.
//
// One thing legacy has out of the box that we need to suppress:
//
//   _maybeShowIntroVideo() at legacy line 24433 plays an intro overlay
//   on first visit (when localStorage.seenIntroVideo !== '1'). Its
//   on-finish callback fails to restore the active screen, leaving the
//   player stuck on a blank screen. We seed the flag synchronously
//   before any other legacy script runs, so the intro flow is skipped
//   entirely for everyone.
//
// The injection is a single inline <script> at the top of <head>:
//
//   <script>try{localStorage.setItem('seenIntroVideo','1')}catch(_){}</script>
//
// Defensive (try/catch), tiny, runs synchronously before legacy scripts.
// Idempotent (marker-based skip).

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const LEGACY_PATH = resolve(process.cwd(), 'dist', 'blocksworn_index_fixed.html');

const MARKER = '<!-- BSW-LEGACY-FIXES-INJECTED -->';

// Seed two localStorage keys synchronously BEFORE any other legacy script runs:
//   1. `blocksworn_save_version` = '2' (current SAVE_VERSION constant in legacy).
//      Legacy's `_saveVersionGate` IIFE at the top of its scripts compares the
//      stored value with SAVE_VERSION and CALLS `_wipeAllBlocksworn` when the
//      stored value is missing or lower — which ALSO removes `seenIntroVideo`.
//      Pre-seeding the save_version key short-circuits the wipe so our intro-
//      skip survives.
//   2. `seenIntroVideo` = '1' so `_maybeShowIntroVideo` exits early and the
//      intro-video overlay stays in its initial `hidden` state.
//
// `if (!localStorage.getItem(...))` guards ensure we don't clobber values a
// returning player has already accumulated — we only seed when keys are
// missing.
const INTRO_SKIP = `<script>try{var ls=localStorage;if(!ls.getItem('blocksworn_save_version'))ls.setItem('blocksworn_save_version','2');if(!ls.getItem('seenIntroVideo'))ls.setItem('seenIntroVideo','1')}catch(_){}</script>`;
const INJECTION = `  ${MARKER}\n  ${INTRO_SKIP}\n`;

async function main() {
  if (!existsSync(LEGACY_PATH)) {
    console.warn(`[inject-legacy-fixes] ${LEGACY_PATH} not found — skipping`);
    return;
  }

  const html = await readFile(LEGACY_PATH, 'utf-8');

  if (html.includes(MARKER)) {
    console.log('[inject-legacy-fixes] already injected; nothing to do');
    return;
  }

  if (!html.includes('</head>')) {
    console.warn('[inject-legacy-fixes] no </head> tag — skipping');
    return;
  }

  const out = html.replace(/<\/head>/i, `${INJECTION}</head>`);
  await writeFile(LEGACY_PATH, out, 'utf-8');

  console.log(`[inject-legacy-fixes] injected intro-video skip into ${LEGACY_PATH}`);
}

main().catch((err) => {
  console.error('[inject-legacy-fixes] FAILED:', err);
  process.exit(1);
});
