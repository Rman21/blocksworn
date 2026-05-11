# Active Tasks

> Source of truth for current work. Updated real-time by CTO.
> Detailed spec для каждой task → `docs/plan/00_EXECUTION_PLAN.md` §13-16.

---

## BUG TESTER

### TASK-006 (AUDIT-01) — Pre-T1.06 infrastructure smoke audit

**Status:** TODO (ready for assignment — T1.05 DONE)
**Priority:** HIGH
**Phase:** 1 (Week 1 → Week 2 gate)
**Created:** 2026-05-11
**Assigned to:** Bug Tester
**Estimated complexity:** S
**Trigger:** Week 1 infrastructure track complete (T1.01-T1.05). Before T1.06 (CSS extraction) begins, infrastructure must be **proven** to work end-to-end. If smoke/visual/lint/build catch a real regression in T1.06+, this audit is what made that catch possible — it's the safety net.

**Test scope:**
- Vite scaffold (T1.01) — dev server, build pipeline
- Smoke tests (T1.03) — Playwright fires correctly
- Visual regression (T1.04 + T1.05) — pixelmatch diff catches changes
- CI workflow (T1.05) — YAML syntactically valid, structure matches expectation
- Husky pre-commit (T1.05) — hook fires on staged JS changes
- ESLint (T1.05) — runs across project, 0 errors on current state
- Legacy HTML — still byte-identical (`wc -c` = 21,480,494)

**Test scenarios:**

1. **Cold environment check:**
   - `git status` — clean working tree (or only WIP files)
   - `wc -c docs/_legacy/_archive_v1/blocksworn_index_fixed.html` — must be `21480494`
   - `node --version` — v24.x, `npm --version` — 11.x

2. **Dev + build cycle:**
   - `npm run dev` (background, then kill) — Vite v5 starts, port 5173 responds with shell HTML
   - `npm run build` — succeeds, `dist/` exists, `du -sh dist` < 50KB
   - `npm run preview` (background, then kill) — production build serves

3. **Smoke tests:**
   - `npm run test:smoke` — 2/2 pass on chromium + mobile-chrome (~5s)
   - Report duration, pass count, any flake on retry (run twice if first fails)

4. **Visual regression — passes:**
   - `npm run test:visual` — 22/22 pass under 2%
   - Report any screens with diff between 1-2% (close to threshold but not failing)

5. **Visual regression — detects real change (REGRESSION CATCH TEST):**
   - Inject a temporary visible change into the page (e.g., add a red banner via `page.evaluate(() => document.body.style.borderTop = '20px solid red')` in `tests/visual/regression.spec.js` — TEMPORARY)
   - Run `npm run test:visual` — expect tests to FAIL with diff > 2% (proving the gate WORKS)
   - **REVERT the temporary change immediately** — do not commit the injected red banner
   - Confirm `git status` shows clean again after revert
   - This is the most important audit step: proves regression detection actually works, not just passively passes

6. **Lint:**
   - `npm run lint` — exits 0, 0 warnings
   - Try injecting a deliberate lint error (`const unused = 1;` somewhere) — confirm lint catches it — REVERT.

7. **CI workflow YAML structure check:**
   - Read `.github/workflows/ci.yml` — verify structure: 4 jobs (lint, build, smoke, visual), `needs` chain wired, bundle-size check, artifact upload on visual failure
   - `npx js-yaml .github/workflows/ci.yml > /dev/null` (or `python3 -c 'import yaml; yaml.safe_load(open(".github/workflows/ci.yml"))'`) — must parse cleanly. If neither available, do visual inspection.

8. **Husky pre-commit hook:**
   - `.husky/pre-commit` exists and is executable (`ls -la .husky/pre-commit` shows `-rwx`)
   - Content matches: `npm run lint:staged && npm run build`
   - Trigger manually: `bash .husky/pre-commit` — should run without error (against the current staged state — may be no-op if nothing staged)

9. **Legacy HTML byte-identity (sacred boundary check):**
   - `shasum -a 256 docs/_legacy/_archive_v1/blocksworn_index_fixed.html` — save the hash. This becomes the canonical hash; any future task touching the legacy file is checked against it.

10. **Replay test:** open Playwright HTML report (if generated) and confirm screenshots match expectations.

**Test environments:**
- Local: macOS 13 arm64 (Roman's host) — chromium + mobile-chrome
- CI (deferred): Ubuntu Linux + chromium + webkit + mobile-chrome + mobile-safari — verified on first push by Roman

**What to report (in REPORT.md as REPORT-AUDIT-01):**
- Each scenario pass/fail with details (durations, sizes, screenshot counts)
- The regression catch test result — **THIS IS CRITICAL.** If injecting a visible change does NOT cause visual regression to fail, the gate is broken and T1.06 cannot start.
- The legacy HTML SHA-256 hash (becomes immutable reference)
- Any BUG-NN found (in standard format in TASKS.md)
- Any suggestions (separate from bugs)
- Verdict: **GO** / **CONDITIONAL** / **NO-GO** for proceeding to T1.06

**Acceptance criteria:**
- [ ] All 10 scenarios executed
- [ ] Regression catch test PROVES visual diff catches a forced change
- [ ] Zero BLOCKER bugs found
- [ ] REPORT-AUDIT-01 written in REPORT.md
- [ ] Verdict communicated to CTO

**DO NOT:**
- Modify production code (this is a test audit, not a fix task)
- Modify baselines
- Commit the temporary regression-catch-test injection (revert before commit)
- Touch sacred cows (CLAUDE.md §2)
- Open a PR

**Rollback plan:** N/A — read-only audit. If you accidentally commit something, `git reset --hard HEAD~1`.

---

## GAME DEVELOPER

### TASK-007 (T1.06) — Extract CSS into modular structure

**Status:** TODO (BLOCKED by AUDIT-01)
**Priority:** HIGH
**Phase:** 1 (Week 2-3, code migration begins)
**Depends on:** Bug Tester AUDIT-01 verdict = GO

**Goal:** Все inline `<style>` блоки из `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` → modular `src/styles/`. CSS — самая независимая часть кода. Migration here не имеет execution-time риска на game logic.
**Detailed spec:** `docs/plan/00_EXECUTION_PLAN.md` §13 T1.06 (around lines ~1252-1325).
**Will be assigned после AUDIT-01 GO verdict.**

---

## GAME DESIGNER

(no active tasks — Designer activated в Phase 2)

---

## CLOSED TASKS (chronological history)

### TASK-001 (T1.01) ✅ DONE 2026-05-11
**Commits:** `c9cf50e`, `6c010ef`
**Outcome:** Vite scaffold + legacy HTML relocated to `docs/_legacy/_archive_v1/` byte-identical (21,480,494)
**Previously blocked:** ESC-01 (Node missing) — resolved via Node v24.15.0 .pkg

### TASK-002 (T1.02) ✅ DONE 2026-05-11
**Verification only** — CLAUDE.md (799 lines) committed in Initial Setup `41da1eb`

### TASK-003 (T1.03) ✅ DONE 2026-05-11
**Commits:** `8d79a61`, `8773ca6`, `ac9cedb` (CTO admin)
**Outcome:** Playwright + smoke infrastructure; chromium + mobile-chrome green
**WebKit constraint:** unavailable on macOS 13 arm64 (Playwright 1.59 requires macOS 14+); CI Linux runs all 4 via `test:smoke:full`
**Engineering:** `serveLegacyHtmlRaw` Vite plugin works around legacy HTML's malformed nested comment

### TASK-004 (T1.04) ✅ DONE 2026-05-11
**Commits:** `2c08bb2`, `04e8456`
**Outcome:** 22 visual baselines (11 screens × chromium + mobile), 11M total
**Discoveries:** save-version-gate IIFE (legacy ~18504), COMBAT v2.1 P8 First Contact modal timing — both documented in `tests/helpers/game-state.js` for future seeders

### TASK-005 (T1.05) ✅ DONE 2026-05-11
**Commits:** `235941e` (initial), `9464311` (DOCS), `a7084a2` (T1.05.1 fix), `527fa74` (DOCS)
**Outcome:** Complete Week 1 CI infrastructure:
- `.github/workflows/ci.yml` — 4 jobs (lint/build/smoke/visual), bundle <5MB enforcement, artifact upload on failure
- `tests/visual/regression.spec.js` — pixelmatch diff vs baselines, 2%/5% thresholds
- `tests/visual/screens.js` — shared SCREENS array (DRY for capture + regression)
- `eslint.config.js` — flat config v9, ES modules, browser globals
- `.husky/pre-commit` — `lint:staged && build`
- `package.json` — `lint`, `test:visual`, `lint:staged`, `prepare` scripts; `lint-staged` config

**T1.05.1 fix detail:**
- Initial commit had `fresh-chronicle-intro` visual flake (chromium 8.4%, mobile 30.8% diff on same-machine re-run)
- CTO RETURNED with rAF hypothesis (incorrect)
- Dev investigation found real cause: `#introVideoPlayer <video>` autoplay element ticking between capture and regression
- Fix: `freezeAnimations()` now pauses `<video>` elements (pin currentTime=0, autoplay=false). Applied parity in both capture-baseline AND regression specs.
- Re-captured only the 2 affected baselines; all 22 visual tests now PASS under 2%

**New devDeps added in T1.05:** `pngjs@^7.0.0`, `@eslint/js@^9.39.4` (pinned v9 to match eslint peer), `husky@^9.1.7`, `lint-staged@^17.0.4`

**Final verification:**
- `npm run lint` → 0 errors, 0 warnings
- `npm run test:smoke` → 2/2 passed
- `npm run test:visual` → 22/22 passed under 2%
- `npm run build` → 8 KB dist, ~37ms
- `wc -c docs/_legacy/_archive_v1/blocksworn_index_fixed.html` → 21,480,494 ✓

---

**Maintained by:** CTO agent
**Last update:** 2026-05-11 — Week 1 infrastructure complete (5/20 Phase 1); Tester audit queued before T1.06
