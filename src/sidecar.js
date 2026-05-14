// 2026-05-14 — Phase 4.1 sidecar entry.
//
// This module is injected into the legacy single-HTML runtime
// (dist/blocksworn_index_fixed.html) via a post-build script that appends
//
//   <script type="module" src="/assets/sidecar.js" defer></script>
//
// before </body>. Vite's rollup config pins the emitted filename to
// `assets/sidecar.js` (no hash) so the injected tag stays valid across
// builds without touching the legacy HTML each time.
//
// What this entry DOES:
//   - Installs the 47-surface Phase 2/3/4 window-bridge so the legacy
//     runtime can invoke src/ functions through `window.__*` keys.
//   - Logs the install on boot for diagnostic visibility.
//
// What this entry does NOT do:
//   - No Sentry / Firebase / RevenueCat init — legacy boots those itself.
//   - No progression / FTUE / router boot — legacy owns its own boot chain.
//   - No `showScreen` or any state mutation — pure bridge install only.
//
// Per ADR-004 hybrid coexistence + CLAUDE.md §0.

import { installLegacyBridges } from './legacy-bridges.js';
import { log } from './services/logger.js';

try {
  const r = installLegacyBridges();
  log.info('[sidecar] legacy bridges installed:', r);
} catch (err) {
  // Never throw into the legacy boot chain.
  try { log.warn('[sidecar] install failed (non-fatal):', err); } catch (_e) { /* swallow */ }
}
