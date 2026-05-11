# Active Tasks

> Source of truth for current work. Updated real-time by CTO.
> Detailed spec для каждой task → `docs/plan/00_EXECUTION_PLAN.md` §13-16.

---

## BUG TESTER

### BUGS (open)

#### BUG-001 🟡 MAJOR — Visual regression WARN band (2-5%) silently passes CI

**Severity:** 🟡 MAJOR
**Area:** Visual regression gate / CI quality contract
**Reproducibility:** Always (10/10)
**Discovered:** 2026-05-11 during AUDIT-01 Scenario 5 Phase A
**Status:** OPEN — awaiting CTO triage (3 options listed in REPORT-AUDIT-01)
**Full details:** see REPORT-AUDIT-01 → "Bugs found" → BUG-001 in `docs/plan/REPORT.md`

**One-liner:** A 30px red banner injected on every screen produced 3.18-4.08% diff; all 22 tests still PASSED because the implementation treats 2-5% as "WARN + pass" while CLAUDE.md §3.5/§7.6 wording and AUDIT-01 spec scenario 5 expected ≥2% to FAIL. Gate fires correctly at >5% (verified with 80px banner — 22/22 FAIL). Not a BLOCKER (>5% gate works), but decision needed on contract wording vs implementation before this gap bites T1.06+ migrations.

---

### TASK-006 (AUDIT-01) — moved to CLOSED TASKS below

---

## GAME DEVELOPER

### TASK-007 (T1.06) — Extract CSS into modular structure

**Status:** TODO (READY — AUDIT-01 verdict = GO delivered 2026-05-11)
**Priority:** HIGH
**Phase:** 1 (Week 2-3, code migration begins)
**Depends on:** ✅ AUDIT-01 (DONE, verdict GO)

**Goal:** Все inline `<style>` блоки из `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` → modular `src/styles/`. CSS — самая независимая часть кода. Migration here не имеет execution-time риска на game logic.
**Detailed spec:** `docs/plan/00_EXECUTION_PLAN.md` §13 T1.06 (around lines ~1252-1325).

**Note from Tester (AUDIT-01):** Visual regression gate fires reliably at >5% diff (proven 22/22 FAIL with 80px red banner). At 2-5% diff the gate currently warns silently — see BUG-001 in this file. CTO may want to triage BUG-001 before/in parallel with T1.06 start so CSS extraction's first PR runs against the intended gate sensitivity.

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

### TASK-006 (AUDIT-01) ✅ DONE 2026-05-11
**Verdict:** ✅ **GO** for T1.06 (CSS extraction)
**Author:** Bug Tester (first Tester engagement on project)
**Report:** REPORT-AUDIT-01 in `docs/plan/REPORT.md`
**Scenarios executed:** 10/10 PASS
**Regression catch test:** PROVEN — 22/22 FAIL with diff 8-10% on 80px banner injection (revertion clean; 22/22 PASS on re-run)
**Legacy HTML SHA-256 (canonical immutable reference):** `4b3a3974f8b9030bf195dc9fad2b7b4bf07857021b3c01b44410ac547fcee67f`
**Bugs found:** 1 MAJOR (BUG-001 — see BUG TESTER → BUGS open above; not a blocker, awaiting CTO triage)
**Suggestions:** 3 (see REPORT-AUDIT-01)
**Time invested:** ~40 min

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
**Last update:** 2026-05-11 — AUDIT-01 verdict = GO; T1.06 ready for assignment; BUG-001 awaiting CTO triage (non-blocking)
