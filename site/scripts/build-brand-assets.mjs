#!/usr/bin/env node
// Day 6 — Brand Asset Build Step
//
// Composes Blocksworm brand assets from the game's Logo PNG (in ASSETS map):
//   - app/icon.png        (512×512, padded square for Next.js auto-favicon)
//   - app/apple-icon.png  (180×180, iOS home screen)
//   - public/og-image.png (1200×630, social card with logo + tagline)
//
// Why a script: reproducible re-build when the artist updates the master logo.
// Implementation: shells to a Python+Pillow one-liner, since macOS doesn't have
// ImageMagick by default but Pillow is in stock python3.
//
// Run: `node scripts/build-brand-assets.mjs` from /site/.
// Or:  `python3 scripts/build-brand-assets.py` directly (see sibling .py).
//
// Source PNG path is auto-derived from the game's `Logo` ASSETS entry by
// scripts/build-brand-assets.py — see that file for the actual composition.

import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
execSync(`python3 ${JSON.stringify(resolve(__dirname, 'build-brand-assets.py'))}`, {
  stdio: 'inherit',
});
