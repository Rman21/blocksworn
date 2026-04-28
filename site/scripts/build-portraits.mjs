#!/usr/bin/env node
// Day 4 — Hero Portrait Build Step
//
// Reads source PNG hero portraits from the parent project's `assets/heroes/`
// (where the artist drops them — see BLOCKSWORN_HERO_COMPENDIUM.md §14.1) and
// produces optimized JPGs in `site/public/heroes/{canonical_id}.jpg`.
//
// Why a build step (vs committing source PNGs directly):
//   - Source PNGs are ~2 MB × 25 = ~50 MB. Too heavy for /public/ + git.
//   - Output JPGs (quality 85, max 720w) are ~150-300 KB × 25 = ~5 MB.
//   - Filename mapping reconciles artist-friendly names ("fire pirate sword")
//     with engineering canonical IDs (pirate_warrior) used in HERO_ROSTER.
//
// Source: macOS-only (uses `sips`). Outputs are committed to /public/heroes/
// so Linux Vercel builds don't need to re-run this — it's a pre-commit ritual,
// not part of `next build`.
//
// Run: `node scripts/build-portraits.mjs` from /site/.

import { execSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(SITE_ROOT, '..');
const PARENT = resolve(REPO_ROOT, '..');
// Artist drops portraits at `<game file>/assets/heroes/<element race>/<element race role>.png`.
// REPO_ROOT == `<game file>/.claude/worktrees/<wt>` — go up 3 levels to reach `<game file>`.
const ASSETS_HEROES = resolve(REPO_ROOT, '..', '..', '..', 'assets', 'heroes');
const OUT_DIR = resolve(SITE_ROOT, 'public', 'heroes');

// Canonical id ← (source folder, source basename without .png). Pirates use
// weapon names (sword/gun/bomb) instead of role names — preserved here.
const MAPPING = [
  ['pirate_warrior',     'fire pirates',  'fire pirate sword'],
  ['pirate_hunter',      'fire pirates',  'fire pirate gun'],
  ['pirate_mage',        'fire pirates',  'fire pirate bomb'],
  ['pirate_tank',        'fire pirates',  'fire pirate tank'],
  ['pirate_captain',     'fire pirates',  'fire pirate captain'],
  ['rock_warrior',       'dark rock',     'dark rock warrior'],
  ['rock_hunter',        'dark rock',     'dark rock hunter'],
  ['rock_mage',          'dark rock',     'dark rock mage'],
  ['rock_tank',          'dark rock',     'dark rock tank'],
  ['rock_captain',       'dark rock',     'dark rock captain'],
  ['shark_warrior',      'frost sharks',  'frost shark warrior'],
  ['shark_hunter',       'frost sharks',  'frost shark hunter'],
  ['shark_mage',         'frost sharks',  'frost shark mage'],
  ['shark_tank',         'frost sharks',  'frost shark tank'],
  ['shark_captain',      'frost sharks',  'frost shark captain'],
  ['crocodile_warrior',  'earth croc ',   'earth croc warrior'],
  ['crocodile_hunter',   'earth croc ',   'earth croc hunter'],
  ['crocodile_mage',     'earth croc ',   'earth croc mage'],
  ['crocodile_tank',     'earth croc ',   'earth croc tank'],
  ['crocodile_captain',  'earth croc ',   'earth croc captain'],
  ['spark_warrior',      'light spark',   'light spark warrior'],
  ['spark_hunter',       'light spark',   'light spark hunter'],
  ['spark_mage',         'light spark',   'light spark mage'],
  ['spark_tank',         'light spark',   'light spark tank'],
  ['spark_captain',      'light spark',   'light spark captain'],
];

const MAX_WIDTH = 720;
const QUALITY = 85;

if (!existsSync(ASSETS_HEROES)) {
  console.error(`✗ Source dir missing: ${ASSETS_HEROES}`);
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });

let ok = 0;
let fail = 0;
for (const [id, folder, basename] of MAPPING) {
  const src = resolve(ASSETS_HEROES, folder, `${basename}.png`);
  const dst = resolve(OUT_DIR, `${id}.jpg`);
  if (!existsSync(src)) {
    console.error(`✗ ${id}: source missing — ${src}`);
    fail++;
    continue;
  }
  try {
    // sips: resample to max width, set jpeg format + quality, write to dst.
    // -Z preserves aspect ratio; -s formatOptions takes 0-100.
    execSync(
      `sips -Z ${MAX_WIDTH} -s format jpeg -s formatOptions ${QUALITY} ${JSON.stringify(src)} --out ${JSON.stringify(dst)}`,
      { stdio: 'pipe' },
    );
    ok++;
  } catch (e) {
    console.error(`✗ ${id}: sips failed — ${e.message}`);
    fail++;
  }
}

console.log(`✓ ${ok}/${MAPPING.length} portraits written to ${OUT_DIR}`);
if (fail > 0) process.exit(1);
