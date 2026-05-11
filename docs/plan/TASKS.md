# Active Tasks

> Source of truth for current work. Updated real-time by CTO.
> Detailed spec для каждой task → `docs/plan/00_EXECUTION_PLAN.md` §13-16.

---

## GAME DEVELOPER

### TASK-003 (T1.03) — Setup Playwright + smoke test infrastructure

**Status:** TODO (ready for assignment — TASK-001 + TASK-002 both DONE)
**Priority:** HIGH
**Phase:** 1
**Created:** 2026-05-11
**Estimated complexity:** M
**Depends on:** TASK-001 (DONE)

**Files affected:**
- `playwright.config.js` (new)
- `tests/helpers/game-state.js` (new)
- `tests/smoke/legacy-loads.spec.js` (new)
- `package.json` (scripts update — replace stub `test:smoke` with real `playwright test`)

**Goal:** Установить Playwright, создать helpers, написать первый smoke test против `docs/_legacy/_archive_v1/blocksworn_index_fixed.html`. Smoke infrastructure ДОЛЖНА существовать до любой code migration (T1.06+) — без неё refactor вслепую.

**Context:** Per Execution Plan §3.1 "Test Infrastructure FIRST". Это safety net для всего Phase 1. После T1.03 + T1.04 + T1.05 (CI green) — можно начинать code migration с уверенностью что регрессия будет обнаружена.

**Detailed spec:** `docs/plan/00_EXECUTION_PLAN.md` §13 T1.03 (lines ~1029-1108).

**What to do (high-level — full spec in Execution Plan):**

1. `npm install -D @playwright/test` (уже declared в `package.json`, но возможно нужен install).
2. `npx playwright install --with-deps chromium webkit` — install browser binaries.
3. Создать `playwright.config.js` exactly per Execution Plan §13 T1.03 (4 projects: chromium, webkit, mobile-chrome Pixel 7, mobile-safari iPhone 14; webServer config; baseURL).
4. Создать `tests/helpers/game-state.js` со stubs:
   - `loadAuthenticatedState(page)`
   - `loadStateWithCompleteFTUE(page)`
   - `playOptimalBattle(page, opts)` — stub OK if logic unclear, real impl in T1.10+
5. Создать `tests/smoke/legacy-loads.spec.js` — minimal test that:
   - Loads `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` via Vite dev server
   - Waits for `#screenMenu` selector (legacy main screen)
   - Asserts zero `pageerror` events
6. Replace `package.json` script stub: `"test:smoke": "playwright test tests/smoke"`
7. Verify `npm run test:smoke` passes against legacy HTML.
8. Commit: `[T1.03] Setup Playwright + smoke test infrastructure`

**DO NOT TOUCH:**
- Any code in `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` (read-only reference — sacred boundary).
- `site/` folder.
- Sacred cows (CLAUDE.md §2).
- Don't write smoke tests for new code yet — only the `legacy-loads` test.
- Don't add game logic.
- Don't add visual regression here — that's T1.04.

**Acceptance criteria:**
- [ ] Playwright installed + browsers (chromium + webkit at minimum) downloaded
- [ ] `playwright.config.js` соответствует Execution Plan §13 T1.03 spec
- [ ] `tests/helpers/game-state.js` с 3 stub functions (named exports)
- [ ] `tests/smoke/legacy-loads.spec.js` проходит — at least chromium project
- [ ] `npm run test:smoke` exits 0 and reports pass
- [ ] Vite dev server serves `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` correctly (may need adjusting Vite config to allow access outside `src/` — investigate)
- [ ] Commit: `[T1.03] Setup Playwright + smoke test infrastructure`

**Known unknowns to investigate during execution:**
- Does Vite dev server need explicit `server.fs.allow` config to serve files from `docs/_legacy/`? If yes — add to `vite.config.js` (allow the path, document the reason).
- Legacy HTML loads heavy inline JS — does it work standalone in Vite dev or does it need a separate route? Investigate, document.

**Rollback plan:** `git revert <commit-sha>` — Playwright artifacts will need manual cleanup (`node_modules/`, `~/Library/Caches/ms-playwright/`).

---

### TASK-004 (T1.04) — Capture visual regression baseline

**Status:** TODO (blocked by TASK-003)
**Priority:** HIGH
**Phase:** 1
**Depends on:** TASK-003

**Goal:** ~30 screenshots всех major screens из legacy HTML как baseline.
**Detailed spec:** `docs/plan/00_EXECUTION_PLAN.md` §13 T1.04.
**Spawned in TASKS.md after T1.03 reaches REVIEW.**

---

### TASK-005 (T1.05) — Setup CI pipeline

**Status:** TODO (blocked by TASK-004)
**Priority:** HIGH
**Phase:** 1
**Depends on:** TASK-004

**Goal:** GitHub Actions workflow — lint + build + unit + smoke + visual.
**Detailed spec:** `docs/plan/00_EXECUTION_PLAN.md` §13 T1.05.

---

## GAME DESIGNER

(no active tasks — Designer activated в Phase 2)

---

## BUG TESTER

(no active tasks — Tester activated after T1.05 CI ready)

---

## CLOSED TASKS (chronological history)

### TASK-001 (T1.01) ✅ DONE 2026-05-11
**Reviewed by:** CTO
**Outcome:** All 9 acceptance criteria met
**Files committed:** 11 files (package.json, vite.config.js, index.html shell, src/main.js, .gitignore update, empty folder skeleton, legacy HTML rename)
**Commits:**
- `c9cf50e` — `[T1.01] Setup Vite scaffold + relocate legacy HTML`
- `6c010ef` — `[DOCS] TASK-001 → REVIEW with self-check`
**Verification:**
- `npm run build` → 3 modules transformed, dist/ = 8.0K, 41ms
- `npm run dev` → Vite v5.4.21 on :5173, shell HTML served, killed cleanly
- Legacy HTML byte-identical: `wc -c docs/_legacy/_archive_v1/blocksworn_index_fixed.html` → 21,480,494
**Previously blocked:** ESC-01 (Node missing) — resolved via Node v24.15.0 .pkg installer
**"Замечено рядом" (tracked, not fixed):**
- npm reported 2 moderate transitive vulnerabilities → defer to T1.05 lint/CI or dedicated security audit
- npm minor version available (`11.12.1 → 11.14.1`) — cosmetic, no action
- Empty dirs not tracked by git — will populate in T1.06+ naturally (no `.gitkeep` added per scope discipline)

### TASK-002 (T1.02) ✅ DONE 2026-05-11
**Reviewed by:** CTO (verification only — no code changes needed)
**Outcome:** All 3 acceptance criteria met
**Self-check:**
- [x] CLAUDE.md exists in repo root (`/CLAUDE.md`, 29 KB, committed in `41da1eb` during Initial Setup)
- [x] Contains required sections: §1 Project at a glance, §2 Sacred Cows, §3 AAA+ Standards, §4 Document Protocols (incl §4.4 Commit format), §5 Role Boundaries, §6 Reference Materials, §7 Working Principles, §8 Escalation Paths, §9 Glossary
- [x] Markdown valid (no broken refs; 799 lines, headings consistent)
**Note:** Standalone CLAUDE.md (from `Instructions Game AAA+/`) is the source — more comprehensive than the Execution Plan §17 summary. Standalone is the canonical project version.
**Commits:** No code commits (verification only — recorded in this DONE entry).

---

**Maintained by:** CTO agent
**Last update:** 2026-05-11 — after T1.01 + T1.02 review
