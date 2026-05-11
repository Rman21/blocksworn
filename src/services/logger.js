// 2026-05-11 — TASK-009 (T1.08): production-aware logger.
//
// Replaces scattered console.* calls in legacy with a single surface that:
//   - log.debug — no-op in production builds (Vite's import.meta.env.PROD === true);
//                 logs in dev so debugging still works locally.
//   - log.info / .warn — always log (tagged).
//   - log.error — always logs AND routes through ./sentry.js captureException
//                 so production crashes show up in error tracking.
//
// The legacy code uses bare console.log/console.warn at ~213 call sites
// (grep for `console.log` in docs/_legacy/_archive_v1/blocksworn_index_fixed.html).
// T1.10 will rewire callers; T1.08 just creates the abstraction.
//
// Notes:
//   - import.meta.env.PROD is Vite-provided. In Vitest it is `false`; in `vite
//     build` it is `true`. Tests can monkeypatch PROD via env if needed.
//   - captureException is wrapped in try/catch because Sentry may not be
//     initialized when a cold-start error fires (script tag is async; init
//     happens after DOMContentLoaded per legacy block).

import { captureException } from './sentry.js';

// `import.meta.env` is undefined in environments where the bundler hasn't
// substituted it (defensive check; Vite/Vitest both provide it).
const IS_PROD = (typeof import.meta !== 'undefined' &&
                 import.meta.env &&
                 import.meta.env.PROD === true);

export const log = Object.freeze({
  debug: (...args) => {
    if (IS_PROD) return;
    try { console.log('[debug]', ...args); } catch (_e) { /* swallow */ }
  },
  info: (...args) => {
    try { console.info('[info]', ...args); } catch (_e) { /* swallow */ }
  },
  warn: (...args) => {
    try { console.warn('[warn]', ...args); } catch (_e) { /* swallow */ }
  },
  error: (...args) => {
    try { console.error('[error]', ...args); } catch (_e) { /* swallow */ }
    const err = args.find((a) => a instanceof Error)
      || new Error(args.map((a) => {
        try { return String(a); } catch (_e) { return '[unstringifiable]'; }
      }).join(' '));
    try { captureException(err); } catch (_e) { /* sentry not initialized yet */ }
  },
});

// Convenience top-level named exports for ergonomic imports:
//   import { warn, error } from '@/services/logger.js';
export const debug = log.debug;
export const info = log.info;
export const warn = log.warn;
export const error = log.error;
