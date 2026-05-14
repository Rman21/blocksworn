// 2026-05-14 — Phase 4.1 post-build step.
//
// Injects the sidecar entry into the legacy single-HTML at build time so the
// 47-surface Phase 2/3/4 bridge installer activates when a player loads
// play.blocksworm.com/ (which serves the legacy HTML via vercel.json rewrite).
//
// Inserted exactly once before </body>:
//   <script type="module" src="/assets/sidecar.js" defer></script>
//
// The sidecar.js filename is pinned (no content hash) in vite.config.js so
// this tag stays valid across rebuilds without modifying the legacy HTML.
//
// Safe to re-run: detects existing injection and skips. Defensive — exits
// 0 with a warning if dist/blocksworn_index_fixed.html is absent so the
// build script doesn't break in environments where the legacy HTML isn't
// staged.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const LEGACY_PATH = resolve(process.cwd(), 'dist', 'blocksworn_index_fixed.html');

// 2026-05-14 — Cache-bust version. Increment when the cached sidecar.js
// on returning visitors' browsers is incompatible with the new build and
// must be force-refetched. Browsers treat URL+query as a separate cache
// key — bumping this number forces a fresh fetch even when the old
// content was cached with `immutable max-age=1y`.
//
// History:
//   v2 — 2026-05-14 — break out of legacy `immutable` cache that shipped
//        with the original Phase 4.1 sidecar before Phase A swapped the
//        Cache-Control header to `max-age=0, must-revalidate`.
const SIDECAR_VERSION = '2';

const SCRIPT_TAG = `<script type="module" src="/assets/sidecar.js?v=${SIDECAR_VERSION}" defer></script>`;
const MARKER = '<!-- BSW-SIDECAR-INJECTED -->';

async function main() {
  if (!existsSync(LEGACY_PATH)) {
    console.warn(`[inject-sidecar] ${LEGACY_PATH} not found — skipping`);
    return;
  }

  const html = await readFile(LEGACY_PATH, 'utf-8');

  if (html.includes(MARKER)) {
    console.log('[inject-sidecar] sidecar already injected; nothing to do');
    return;
  }

  if (!html.includes('</body>')) {
    console.warn('[inject-sidecar] no </body> tag found; skipping injection');
    return;
  }

  const injection = `  ${MARKER}\n  ${SCRIPT_TAG}\n`;
  const out = html.replace(/<\/body>/i, `${injection}</body>`);

  await writeFile(LEGACY_PATH, out, 'utf-8');

  const beforeKb = Math.round(html.length / 1024);
  const afterKb = Math.round(out.length / 1024);
  console.log(`[inject-sidecar] injected sidecar tag (${beforeKb} KB → ${afterKb} KB)`);
}

main().catch((err) => {
  console.error('[inject-sidecar] FAILED:', err);
  process.exit(1);
});
