// 2026-05-11 — TASK-001 (T1.01): minimal Vite config for Blocksworn scaffold.
// 2026-05-11 — TASK-003 (T1.03): add raw-passthrough middleware for legacy HTML.
// Populated further in later Phase 1 tasks (aliases, build options, etc.).

import { defineConfig } from 'vite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// T1.03: legacy single HTML (`docs/_legacy/_archive_v1/blocksworn_index_fixed.html`)
// contains an unclosed nested HTML comment (line ~18129) that browsers tolerate
// but parse5 (used by Vite's HTML transform pipeline) rejects with 500. The file
// is read-only sacred reference (cannot edit). This plugin intercepts the request
// and serves the file as raw bytes, bypassing the HTML transform entirely.
const LEGACY_HTML_URL = '/docs/_legacy/_archive_v1/blocksworn_index_fixed.html';
const LEGACY_HTML_FILE = 'docs/_legacy/_archive_v1/blocksworn_index_fixed.html';

function serveLegacyHtmlRaw() {
  return {
    name: 'blocksworn:serve-legacy-html-raw',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Trim querystring/hash if any.
        const url = (req.url || '').split('?')[0].split('#')[0];
        if (url !== LEGACY_HTML_URL) return next();
        try {
          const filePath = resolve(server.config.root, LEGACY_HTML_FILE);
          const html = await readFile(filePath);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.statusCode = 200;
          res.end(html);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [serveLegacyHtmlRaw()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: false,
    // T1.03: allow serving files from `docs/` (legacy HTML location).
    fs: {
      allow: ['.'],
    },
  },
});
