// 2026-05-13 — TASK-061 (T4.09): Mobile feature flag service.
//
// Spec: docs/design/chia-integration.md §7 (Mobile feature flag)
//       + Execution Plan §9.4 (Mobile compatibility plan).
//
// Sacred-cow safety:
//   - This file is the ONLY source of truth for `isChiaEnabled()`.
//   - All Chia entry points (T4.02 wallet-connect.js, T4.03-T4.06 nft-mint.js,
//     T4.07 dao-adventures.js) MUST wrap in `if (isChiaEnabled()) { ... }`.
//   - Mobile build (compile-time `VITE_CHIA_ENABLED=false`) → returns false.
//   - Web/PWA build (default) → returns true.
//   - Runtime override available via `window.__BLOCKSWORN_CHIA_ENABLED__`
//     for testing; never modify in production code.
//
// Per ADR-003 + ADR-004:
//   - F2P parity invariant: when flag is false, F2P players experience
//     the game identically to flag-true F2P players (no missing content).
//   - All new Chia code lives in src/ only.

// Module-local override (preferred — works in both browser + node test env).
// `null` = no override (use env/window defaults); `true`/`false` = forced value.
let _moduleOverride = null;

/**
 * Returns true if Chia integration features are enabled for this build.
 *
 * Resolution order:
 *   1. Module-local override (set via `_setChiaEnabledForTest`) — tests + debug
 *   2. `window.__BLOCKSWORN_CHIA_ENABLED__` — runtime override for browser
 *   3. Vite env `VITE_CHIA_ENABLED` — compile-time gate
 *   4. Default: true (web/PWA build). Mobile sets `VITE_CHIA_ENABLED=false`.
 *
 * Wrapping pattern (use at every Chia entry point):
 *   if (isChiaEnabled()) {
 *     // wallet connect button render
 *     // NFT mint flow
 *     // DAO clan create
 *     // PURE PATH CHAIN leaderboard column
 *   }
 *
 * @returns {boolean}
 */
export function isChiaEnabled() {
  // 1. Module-local override (test-friendly; works in node + browser).
  if (typeof _moduleOverride === 'boolean') {
    return _moduleOverride;
  }
  // 2. Browser runtime override (developer console / debug).
  if (typeof window !== 'undefined' && typeof window.__BLOCKSWORN_CHIA_ENABLED__ === 'boolean') {
    return window.__BLOCKSWORN_CHIA_ENABLED__;
  }
  // 3. Compile-time flag from Vite env. Defaults to true for web/PWA.
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const v = import.meta.env.VITE_CHIA_ENABLED;
    return v !== 'false' && v !== false;
  }
  // 4. Default true (web/PWA build).
  return true;
}

/**
 * Test helper: set module-local override. Works in both browser + node
 * test env (Vitest default is node — `window` may not exist).
 *
 * @param {boolean|null} v — true / false to force; null to clear override.
 */
export function _setChiaEnabledForTest(v) {
  if (v === null || v === undefined) {
    _moduleOverride = null;
    if (typeof window !== 'undefined') {
      delete window.__BLOCKSWORN_CHIA_ENABLED__;
    }
  } else {
    _moduleOverride = !!v;
  }
}

/**
 * Convenience helper: log Chia-flag state for debugging at boot.
 * Called once from src/main.js boot chain.
 */
export function logChiaFlagState(logFn) {
  if (typeof logFn !== 'function') return;
  try {
    logFn('[feature-flags] isChiaEnabled =', isChiaEnabled());
  } catch (_e) { /* swallow */ }
}
