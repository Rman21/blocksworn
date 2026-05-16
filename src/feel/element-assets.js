// 2026-05-16 — TASK-CP-001 (combat-polish-implementation-plan.md §9 Task 1):
//
// ELEMENT_ASSETS — single source of truth mapping the 5 sacred elements
// (STIHIYAS per src/data/elements.js:14) to their visual assets used by
// the new boss scene composition (boss-scene.js).
//
// Sacred-cow protection (CLAUDE.md §2 + combat-polish-implementation-plan.md §12):
//   - Element keys must match STIHIYAS exactly (ember/tide/grove/solar/umbra).
//   - This module never modifies STIHIYAS, STIHIYA_COLORS, RACE_TO_STIHIYA, or
//     any data in src/core/* / src/data/*. Read-only asset routing.
//   - --a-{element} tokens (tokens.css:219-235) are the color authority; this
//     module references element keys, not hex codes.
//
// Asset filename convention (per combat-polish-implementation-plan.md §4.2):
//   Source files at /Users/rm/Downloads/game file/assets/backgrounds/ have
//   spaces ("fire background.png"). TASK-CP-001 bundle-step copies to
//   public/assets/backgrounds/ with space→underscore rename. Same for
//   element emblems (source has "earth emblam.png" typo; bundle normalizes
//   to "earth_emblem.png").
//
// Lazy-load contract (plan §4.4):
//   Only the current boss's element background is loaded at battle start
//   (~1.4 MB) rather than all 5 eagerly (~7.1 MB). preloadBackground() is
//   called by boss-scene.mount() when the boss element is known.

import { STIHIYAS } from '../data/elements.js';

/**
 * ELEMENT_ASSETS: element key → { bg, emblem, ambient } asset bundle.
 *
 * bg: portrait 9:16 background scene (~1.4 MB each, 941×1672)
 * emblem: hex-shaped element marker (used for boss domain marker + synergy bar)
 * ambient: CSS class suffix selecting ambient particle keyframes in boss-scene.css
 *
 * Frozen to prevent runtime mutation; element keys verified against STIHIYAS.
 */
export const ELEMENT_ASSETS = Object.freeze({
  ember: Object.freeze({
    bg: '/assets/backgrounds/fire_background.png',
    emblem: '/assets/icons/elements/fire_emblem.png',
    ambient: 'sparks',
  }),
  tide: Object.freeze({
    bg: '/assets/backgrounds/frost_background.png',
    emblem: '/assets/icons/elements/water_emblem.png',
    ambient: 'snowflakes',
  }),
  grove: Object.freeze({
    bg: '/assets/backgrounds/earth_background.png',
    emblem: '/assets/icons/elements/earth_emblem.png',
    ambient: 'leaves',
  }),
  solar: Object.freeze({
    bg: '/assets/backgrounds/light_background.png',
    emblem: '/assets/icons/elements/light_emblem.png',
    ambient: 'golden_motes',
  }),
  umbra: Object.freeze({
    bg: '/assets/backgrounds/dark_background.png',
    emblem: '/assets/icons/elements/dark_emblem.png',
    ambient: 'wisps',
  }),
});

// Defensive parity check: ELEMENT_ASSETS keys must align with STIHIYAS exactly.
// Throwing at module-load time catches sacred-cow drift during refactor.
for (const stihiya of STIHIYAS) {
  if (!ELEMENT_ASSETS[stihiya]) {
    throw new Error(
      `ELEMENT_ASSETS missing required element key: "${stihiya}". ` +
      `Must align with STIHIYAS in src/data/elements.js (sacred per CLAUDE.md §2.1).`
    );
  }
}

/**
 * preloadBackground(element): returns a Promise resolving when the background
 * PNG for the given element is decoded and ready for paint. Used by
 * boss-scene.mount() to avoid a flash-of-unstyled-background at battle start.
 *
 * Safe to call multiple times for the same element (browser caches the image).
 * Returns rejected Promise if element is not a valid stihiya.
 */
export function preloadBackground(element) {
  if (!ELEMENT_ASSETS[element]) {
    return Promise.reject(
      new Error(`preloadBackground: unknown element "${element}"`)
    );
  }
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line no-undef -- Image is a browser global (window.Image)
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load background for "${element}": ${e.message || e.type}`));
    img.src = ELEMENT_ASSETS[element].bg;
  });
}

/**
 * resolveBossElement(boss): defensive lookup — returns the boss's element if
 * present and valid, else falls back to 'umbra' (visually neutral dark theme).
 *
 * Used by boss-scene.mount() so missing/malformed boss data never breaks
 * the scene render. Logs a warning for diagnostics but never throws.
 */
export function resolveBossElement(boss) {
  const e = boss && boss.element;
  if (e && ELEMENT_ASSETS[e]) return e;
  // Fallback path — boss data malformed or test fixture. Don't crash the scene.
  return 'umbra';
}
