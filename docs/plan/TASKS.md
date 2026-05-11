# Active Tasks

> Source of truth for current work. Updated real-time by CTO.
> Detailed spec для каждой task → `docs/plan/00_EXECUTION_PLAN.md` §13-16.

---

## GAME DEVELOPER

### TASK-005 (T1.05) — Setup CI pipeline

**Status:** TODO (ready for assignment — TASK-004 DONE)
**Priority:** HIGH
**Phase:** 1
**Created:** 2026-05-11
**Estimated complexity:** M
**Depends on:** TASK-003 (DONE), TASK-004 (DONE)

**Files affected:**
- `.github/workflows/ci.yml` (new)
- `tests/visual/regression.spec.js` (new — diff vs baseline using pixelmatch)
- `.husky/pre-commit` (new — lint + build)
- `package.json` (replace `test:visual` and `lint` stubs with real scripts; add `lint:staged` config)
- `eslint.config.js` (new — minimal flat config for ES modules)
- Possibly `.eslintignore` or via flat config ignores

**Goal:** GitHub Actions workflow that runs lint + build + unit + smoke + visual diff on every PR + push to main. CI must use `test:smoke:full` (4 projects — Linux runs WebKit fine). Pre-commit hook runs `lint` + `build`. CI green is THE phase gate criterion for proceeding to T1.06.

**Context:** Per Execution Plan §12 + §3.1 "Test Infrastructure FIRST". T1.05 closes Week 1 — after this, T1.06+ (code migration) starts with full safety net: any regression caught by CI before merge.

**Detailed spec:** `docs/plan/00_EXECUTION_PLAN.md` §12 (CI Gates) + §13 T1.05 (around lines ~1189-1248).

**What to do:**

### A) Visual regression spec (`tests/visual/regression.spec.js`)

Pixelmatch-based diff against `tests/visual/baseline/*.png` (and `mobile/*.png`):

1. For each baseline file in `tests/visual/baseline/`:
   - Replicate the `setupState()` + capture flow from `capture-baseline.spec.js`
   - Save current screenshot to `tests/visual/current/<name>.png`
   - Diff vs baseline using `pixelmatch`
   - Compute pixel diff %:
     - ≤2% → PASS
     - 2-5% → log warning, still pass
     - \>5% → FAIL, save diff image to `tests/visual/diff/<name>.png`
2. Use the SAME `setupState` strategies as in `capture-baseline.spec.js` to ensure reproducibility.
3. Helper: extract the screen list + setup keys to a shared `tests/visual/screens.js` (or inline both specs use the same array — but DRY preferred).
4. Run for chromium + mobile-chrome locally (matching what was captured); CI will also run WebKit + mobile-safari but those projects have no baseline → either skip those projects in the visual spec via `test.skip(['webkit','mobile-safari'].includes(project))` OR document that visual regression only covers chromium projects (chromium is what we captured baselines for). **Choose:** skip approach is cleaner. Document the choice in the spec file header.

### B) ESLint config (`eslint.config.js`)

Minimal ES module flat config:
```js
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'tests/**/*.js', 'playwright.config.js', 'vite.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // browser globals only where we know src/ targets browser
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        console: 'readonly',
        // node globals for config / tests
        process: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',  // we allow during scaffold phase; T1.10+ src/services/logger.js enforces
    },
  },
  {
    ignores: ['node_modules/**', 'dist/**', 'docs/_legacy/**', 'tests/visual/**', 'playwright-report/**', 'test-results/**', 'site/**'],
  },
];
```

Note: `eslint` is already in `devDependencies` from T1.01. May need `npm install -D @eslint/js` if `js.configs.recommended` isn't auto-shipped — verify and install if needed.

### C) Husky pre-commit hook

1. `npm install -D husky lint-staged`
2. `npx husky init` — creates `.husky/` folder
3. `.husky/pre-commit` content:
   ```bash
   #!/bin/sh
   npm run lint:staged && npm run build
   ```
4. Add `lint-staged` config to `package.json`:
   ```json
   "lint-staged": {
     "*.{js,mjs,cjs}": ["eslint --max-warnings=0"]
   }
   ```
5. Add `package.json` script: `"lint:staged": "lint-staged"`
6. Replace `lint` stub with: `"lint": "eslint ."`

### D) Replace `test:visual` stub

Replace stub `"test:visual": "echo ..." && exit 0` with:
`"test:visual": "playwright test tests/visual/regression.spec.js --project=chromium --project=mobile-chrome"`

(WebKit + mobile-safari excluded from local because of host constraint, but ALSO excluded from local visual because we only captured chromium baselines.)

Add `test:visual:update`:
`"test:visual:update": "playwright test --update-snapshots"` — used for intentional baseline updates (T1.17 etc.)

### E) GitHub Actions workflow (`.github/workflows/ci.yml`)

Use Execution Plan §12.1 template, but adjust for our reality:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint

  build:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run build
      - name: Enforce bundle <5MB
        run: |
          BUNDLE_KB=$(du -sk dist | cut -f1)
          echo "Bundle size: ${BUNDLE_KB} KB"
          if [ "$BUNDLE_KB" -gt 5120 ]; then
            echo "Bundle exceeds 5MB limit"; exit 1
          fi

  smoke:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium webkit
      - run: npm run test:smoke:full        # 4 projects (Linux can do WebKit)

  visual:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:visual
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: visual-diffs
          path: tests/visual/diff/
```

**Skip `unit` job for now** (no unit tests yet — T1.08+ adds storage unit tests; CI workflow can have `unit:` job added then via PR).

### F) Verify

1. `npm run lint` → exits 0 on current codebase (may need to fix any warnings in `tests/`, `playwright.config.js`, `vite.config.js`)
2. `npm run test:visual` → likely fails first run if baseline machine != local machine; **expected** — document this as known visual flake on local; CI is the authority. If diffs >5%, investigate before merging.
3. Husky hook fires on a test commit (don't actually commit a noise change — just verify the file is executable).
4. Open a test PR (or use `gh pr create --draft`) → CI runs all 5 jobs → all green.

### G) Commit + status

1. Commit 1: code/config (CI workflow, husky, lint, visual regression spec)
   ```
   [T1.05] Setup CI pipeline + visual regression + husky pre-commit
   ```
2. Commit 2: TASKS.md update → REVIEW with self-check + Замечено рядом
   ```
   [DOCS] TASK-005 → REVIEW with self-check
   ```

**DO NOT TOUCH:**
- `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` (sacred)
- Existing `tests/visual/baseline/*.png` (those are the reference — leave them alone)
- `site/` folder
- `serveLegacyHtmlRaw` plugin in `vite.config.js`
- Sacred cows (CLAUDE.md §2)
- Don't add unit tests (T1.08+ scope)
- Don't add branch protection rules (Roman manages this on GitHub directly — out of scope for the code agent)
- Don't write any production game code

**Acceptance criteria:**
- [ ] `.github/workflows/ci.yml` exists, syntactically valid (test with `gh workflow view` or YAML lint)
- [ ] 4 jobs: lint, build, smoke, visual (unit deferred)
- [ ] Bundle size check < 5MB in `build` job
- [ ] `npm run lint` exits 0 locally
- [ ] `tests/visual/regression.spec.js` exists, diffs vs baseline using pixelmatch
- [ ] `.husky/pre-commit` exists, executable (`chmod +x`)
- [ ] `lint-staged` config in `package.json` + `lint:staged` script
- [ ] `test:visual`, `test:visual:update`, `lint` scripts replace their stubs in `package.json`
- [ ] Commit messages match format

**Known unknowns:**
- pixelmatch needs PNG decoding. May need `pngjs` peer. Investigate during execution.
- Husky v9+ uses different init syntax than older docs. Use whatever `npx husky init` produces.
- ESLint flat config (`eslint.config.js`) is the v9 format — older `.eslintrc.*` is deprecated.

**Rollback plan:** `git revert <commit-sha>`. CI workflow + visual regression are additive — reverting just removes them.

---

## GAME DESIGNER

(no active tasks — Designer activated в Phase 2)

---

## BUG TESTER

(no active tasks — Tester first triggered after T1.05 — pre-T1.06 smoke audit assignment will follow CI green)

---

## CLOSED TASKS (chronological history)

### TASK-001 (T1.01) ✅ DONE 2026-05-11
**Reviewed by:** CTO
**Outcome:** All 9 AC met
**Commits:** `c9cf50e`, `6c010ef`
**Verification:** `npm run build` → dist/ 8.0K, 41ms; `npm run dev` → Vite on :5173; legacy HTML byte-identical (21,480,494)
**Previously blocked:** ESC-01 (Node missing) — resolved via Node v24.15.0 .pkg

### TASK-002 (T1.02) ✅ DONE 2026-05-11
**Reviewed by:** CTO (verification only)
**Outcome:** All 3 AC met — CLAUDE.md (799 lines) committed in Initial Setup `41da1eb`
**Commits:** none (verification only)

### TASK-003 (T1.03) ✅ DONE 2026-05-11
**Reviewed by:** CTO
**Outcome:** 6/7 AC met; WebKit binary unavailable on host (Playwright 1.59 requires macOS 14+ on arm64) — **environment, not code**
**Commits:** `8d79a61` (Dev), `8773ca6` (DOCS), `ac9cedb` (CTO admin script split)
**CTO decision:** Option 1 + script split (REPORT-03):
- `test:smoke` (local) → `--project=chromium --project=mobile-chrome` (exits 0 on Roman's host)
- `test:smoke:full` (CI) → all 4 projects (Linux has no WebKit constraint)
- `playwright.config.js` untouched
**Notable engineering:** legacy HTML has malformed nested `<!--` at line ~18129 → parse5 rejects → `serveLegacyHtmlRaw` Vite plugin serves raw bytes, bypass transform. Legacy file byte-identical.

### TASK-004 (T1.04) ✅ DONE 2026-05-11
**Reviewed by:** CTO
**Outcome:** All AC met — 22 baseline PNGs (11 screen/state × chromium + mobile-chrome), 11M total
**Commits:** `2c08bb2` (T1.04), `04e8456` (DOCS)
**Verification:**
- `npm run test:visual:baseline` → 22/22 passing in ~12s
- `npm run test:smoke` → 2/2 still green
- `wc -c docs/_legacy/_archive_v1/blocksworn_index_fixed.html` → 21,480,494 (sacred unchanged)
- `du -sh tests/visual/baseline/` → 11M (well under 50MB cap)

**Screens captured (chromium + mobile each):**
- `menu`, `menu-ch1-complete`, `select`, `shop`, `profile`, `dailies`, `season`, `tower`
- `fresh-chronicle-intro`, `ftue-chronicle`, `ftue-pyredrake`

**setupState() seed strategies (in `tests/helpers/game-state.js`):**
- `'fresh'` / `'authenticated'` / `'ch1-complete'` / `'ftue-chronicle'` / `'ftue-pyredrake'` — see source comments

**Major engineering discoveries (FYI for future tasks):**
- **Save-version-gate IIFE** (legacy ~18504) wipes all `blocksworn_*` keys on cold load if `blocksworn_save_version` is missing/stale. Any future state-seeder MUST set this first. → `setupState()` documented this; surface in DEV_INSTRUCTION.md if/when full-gameplay seeders land (T1.10+).
- **COMBAT v2.1 P8 First Contact modal** (legacy ~48266) auto-fires 1200ms after menu paint if `blocksworn_p8_player_name` is unset — captures menu screenshots show modal instead of menu. Workaround: seed `blocksworn_p8_player_name='TESTER'`. T1.10 may want to expose this as a deliberate baseline state.
- **playwright.config.js testDir** widened from `./tests/smoke` → `./tests` so visual specs discoverable. T1.05 must keep this.

**"Замечено рядом" (tracked):**
- `mobile/fresh-chronicle-intro.png` is 2.06MB (~3% over 2MB soft cap) — large parchment-style background on long mobile viewport. T1.05 CI may decide to pngquant baselines if dir bloats.
- FTUE chronicle/pyredrake baselines show the intro dialog overlay (gates battle, requires user tap). Legitimate first-contact baseline; T1.06+ may want a follow-up spec that auto-advances dialog and captures mid-fight.

---

**Maintained by:** CTO agent
**Last update:** 2026-05-11 — after T1.04 review
