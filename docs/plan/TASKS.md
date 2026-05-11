# Active Tasks

> Source of truth for current work. Updated real-time.
> Detailed spec для каждой task → `docs/plan/00_EXECUTION_PLAN.md` §13-16.

---

## GAME DEVELOPER

### TASK-001 (T1.01) — Setup Vite scaffold + new repository

**Status:** REVIEW (completed 2026-05-11 — scaffold verified end-to-end; Node v24.15.0 / npm 11.12.1)
**Priority:** HIGH
**Phase:** 1
**Created:** 2026-05-11
**Assigned:** 2026-05-11 to Game Developer (Agent)
**Estimated complexity:** M
**Depends on:** none
**Previously blocked:** 2026-05-11 — ESC-01 (Node.js missing) — RESOLVED via .pkg installer from nodejs.org

**BLOCKER:**
Node.js / npm are not installed on this machine. Verified via:
- `command -v node npm` → not found
- `which node npm` → not found
- `bash -lc 'node --version'` → not found
- `zsh -lc 'node --version'` → not found
- `mdfind` / `find /` for `node` binary → no installs anywhere

The task spec's steps **1 (`npm create vite@latest`)**, **2 (`npm install -D ...`)**,
**8 (`npm run dev` verification)**, and **9 (`npm run build` verification)** cannot be
executed. The CTO marked the verification steps NON-NEGOTIABLE.

**Work completed in working tree (NOT committed):**
- Folder structure created per step 4 (src/{core,ui,feel,data,services,styles/{components,screens}}, public/{images,audio,fonts}, tests/{smoke,visual/{baseline,current},unit})
- `blocksworn_index_fixed.html` moved via `git mv` to `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` (single byte unchanged; rename detected by git)
- `package.json` written manually (scripts: dev/build/preview + test:smoke/test:visual/lint stubs; devDependencies: vite ^5.4, @playwright/test ^1.47, pixelmatch ^6, eslint ^9 — declared but NOT installed)
- `vite.config.js` written manually (minimal: root, publicDir, build.outDir=dist, server.port=5173)
- `index.html` shell written per spec
- `src/main.js` placeholder written (`console.log('Blocksworn loading...');`)
- `.gitignore` appended with `dist/`, `tests/visual/current/`, `tests/visual/diff/`, `playwright-report/`, `test-results/`

**Awaiting CTO decision (one of):**
1. Install Node.js (≥18 recommended) on the host so Agent can run `npm install`, `npm run dev`, `npm run build` and complete steps 1, 2, 8, 9 + commit.
2. Authorize commit of unverified scaffold (deviation from spec — step 8/9 marked non-negotiable).
3. Revert working tree (`git restore --staged . && git checkout . && git clean -fd`) and re-assign once tooling is available.

**Self-check (partial — verification gates not run):**
- [ ] `npm run dev` starts Vite dev server — **BLOCKED (no node)**
- [ ] `npm run build` produces `dist/` — **BLOCKED (no node)**
- [x] Folder structure matches step 4 — verified via `ls -la src/ public/ tests/`
- [x] `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` exists (21,480,494 bytes, unchanged)
- [x] `blocksworn_index_fixed.html` not in repo root — verified
- [x] `index.html` in root is shell (200 bytes, ≤2KB)
- [x] `src/main.js` exists with placeholder
- [x] `.gitignore` updated (appended, not replaced)
- [ ] Commit message — **NOT committed (would be premature without verification)**

**Self-check (post-resume completion, 2026-05-11):**
- [x] `npm run dev` стартует Vite dev server без ошибок — Vite v5.4.21 ready in 112ms on :5173; curl `/` returned HTTP 200 with shell HTML containing `<div id="app"></div>` and `/src/main.js`; curl `/src/main.js` returned HTTP 200 with `console.log('Blocksworn loading...');` placeholder; dev server killed cleanly, port freed
- [x] `npm run build` производит `dist/` папку — 3 modules transformed, built in 41ms; `dist/index.html` (0.32 kB) + `dist/assets/index-CB1O8LMT.js` (0.75 kB); total `du -sh dist/` = 8.0K
- [x] Структура папок соответствует пункту 4 — `src/{core,ui,feel,data,services,styles/{components,screens}}`, `public/{images,audio,fonts}`, `tests/{smoke,visual/{baseline,current},unit}` all present (empty dirs not tracked by git, will populate in T1.02+)
- [x] `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` существует — `wc -c` returns `21480494` (byte-identical), git records rename at 100% similarity
- [x] `blocksworn_index_fixed.html` НЕТ в repo root — confirmed via `ls -la` and `git status`
- [x] `index.html` в repo root — shell version 293 bytes (≤2KB) — confirmed
- [x] `src/main.js` exists with placeholder — `console.log('Blocksworn loading...');`
- [x] `.gitignore` обновлён — `node_modules/`, `dist/`, `tests/visual/current/`, `tests/visual/diff/`, `playwright-report/`, `test-results/` present
- [x] Commit message — committed as `[T1.01] Setup Vite scaffold + relocate legacy HTML` (SHA `c9cf50e`)

**Замечено рядом (NOT fixed, reported):**
- `site/package.json` references Next.js dependencies but no `node_modules/` exists in parent project — site/ marketing build pipeline also presumably depends on node being installed on dev machine. Not in scope (per CTO instruction "DO NOT touch the `site/` folder").
- `npm install` reported 2 moderate severity vulnerabilities in transitive deps; not investigated (out of scope for T1.01 — track for T1.05 lint/CI task or a security-audit task).
- npm notice: minor version available (`11.12.1 → 11.14.1`); cosmetic, no action.
- `package.json` already had `"private": true` and `"type": "module"` from the previous Dev agent's parked state — no edit needed in Step B.3.
- Empty directories (`public/`, `public/images`, `public/audio`, `public/fonts`, `tests/smoke`, `tests/unit`, `tests/visual`, `tests/visual/baseline`, `tests/visual/current`) exist on disk but git does not track them; they will appear naturally as files land in T1.02+. The instructions' explicit `git add public/ tests/` was a no-op for that reason — no `.gitkeep` sentinels were added (would have been a structural deviation beyond the instruction scope).
- `docs/plan/REPORT.md` has unstaged modifications from the previous Dev agent's parked state (104 added lines); left untouched for the CTO to review/handle separately — not part of the T1.01 code commit nor this DOCS commit.

---



**Files affected:**
- `package.json` (new)
- `vite.config.js` (new)
- `index.html` (new shell ~5KB)
- `src/main.js` (new placeholder)
- `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` (moved from root)
- `.gitignore` (update)

**Goal:** Создать Vite-based scaffold для project. Single 21MB HTML переезжает в `docs/_legacy/_archive_v1/` как read-only reference. Корень repo становится Vite project.

**Context:** Это foundation для всей Phase 1 migration. Без неё T1.02-T1.20 невозможны. Старый `blocksworn_index_fixed.html` сохраняется в `_legacy/` для reference во время migration (T1.06-T1.13). После T1.13 — `_legacy/` готов к удалению.

**What to do:**

1. Создать новый Vite vanilla JS scaffold **в текущем repo root** (не в подпапке):
   ```bash
   npm create vite@latest . -- --template vanilla
   ```
   Если интерактивный prompt спросит "directory not empty" — confirm, выбрать "Ignore files and continue".

2. Установить dev dependencies:
   ```bash
   npm install -D vite @playwright/test pixelmatch eslint
   ```

3. **Переместить** `blocksworn_index_fixed.html` (21MB) → `docs/_legacy/_archive_v1/blocksworn_index_fixed.html`
   ```bash
   mv blocksworn_index_fixed.html docs/_legacy/_archive_v1/blocksworn_index_fixed.html
   ```

4. Создать структуру папок (пустые, populated в last tasks):
   ```
   src/
   ├── core/
   ├── ui/
   ├── feel/
   ├── data/
   ├── services/
   ├── styles/
   │   ├── components/
   │   └── screens/
   └── (main.js — populated step 6)
   public/
   ├── images/
   ├── audio/
   └── fonts/
   tests/
   ├── smoke/
   ├── visual/
   │   ├── baseline/
   │   └── current/
   └── unit/
   ```
   Использовать `mkdir -p`.

5. Заменить `index.html` (созданный Vite) на shell:
   ```html
   <!DOCTYPE html>
   <html lang="en">
   <head>
     <meta charset="UTF-8">
     <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
     <title>Blocksworn</title>
   </head>
   <body>
     <div id="app"></div>
     <script type="module" src="/src/main.js"></script>
   </body>
   </html>
   ```

6. Заменить `src/main.js` placeholder:
   ```js
   // Blocksworn entry point — populated in T1.12
   console.log('Blocksworn loading...');
   ```

7. Обновить `.gitignore` (добавить `node_modules/`, `dist/`, `tests/visual/current/`, `tests/visual/diff/`, `playwright-report/`, `test-results/`).

8. Verify `npm run dev` стартует Vite dev server без ошибок. Открыть `http://localhost:5173`, увидеть пустую страницу + console.log.

9. Verify `npm run build` производит `dist/` папку без ошибок.

10. Commit: `[T1.01] Setup Vite scaffold + relocate legacy HTML`

**DO NOT TOUCH:**
- Любой код в `blocksworn_index_fixed.html` (только move, no edits)
- `site/` folder (отдельный Next.js — не наш scope)
- `docs/` существующие audit файлы (legacy reference)
- Sacred cows (см. CLAUDE.md §2 — здесь не релевантно, но general principle)
- НЕ добавлять никаких features / mechanics / UI / game logic в этой task

**Acceptance criteria:**
- [ ] `npm run dev` стартует Vite dev server без ошибок
- [ ] `npm run build` производит `dist/` папку
- [ ] Структура папок соответствует пункту 4
- [ ] `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` существует и openable in browser
- [ ] `blocksworn_index_fixed.html` НЕТ в repo root
- [ ] `index.html` в repo root — shell version (≤2KB)
- [ ] `src/main.js` exists with placeholder
- [ ] `.gitignore` обновлён
- [ ] Commit message: `[T1.01] Setup Vite scaffold + relocate legacy HTML`

**Smoke tests:** none yet (T1.03 добавит)

**Rollback plan:** `git revert <commit-sha>` + `git mv docs/_legacy/_archive_v1/blocksworn_index_fixed.html ./blocksworn_index_fixed.html`

---

### TASK-002 (T1.02) — Create CLAUDE.md repository file

**Status:** TODO (assigned, blocked by TASK-001)
**Priority:** HIGH
**Phase:** 1
**Created:** 2026-05-11
**Estimated complexity:** S
**Depends on:** TASK-001

**Goal:** Verify CLAUDE.md in repo root актуален.

**Note:** CLAUDE.md уже скопирован в repo root в Initial Setup. Эта task — verification only. Если содержимое идентично `docs/agents/`-source — pass with note.

**What to do:**

1. Verify CLAUDE.md (project root) идентичен по structure к Section 17 of `docs/plan/00_EXECUTION_PLAN.md` ИЛИ к standalone CLAUDE.md, который более детальный (current source).
2. Если нужны minor updates per Execution Plan §17 — apply.
3. Commit if changes: `[T1.02] Verify CLAUDE.md`. Если no changes — mark DONE with note "verification only".

**Acceptance criteria:**
- [ ] CLAUDE.md exists in repo root
- [ ] Contains: Sacred Cows, Operating Principles, Commit format, Repository structure
- [ ] Markdown valid (no broken refs)

---

### TASK-003 (T1.03) — Setup Playwright + smoke test infrastructure

**Status:** TODO (blocked by TASK-001)
**Priority:** HIGH
**Phase:** 1
**Created:** 2026-05-11
**Estimated complexity:** M
**Depends on:** TASK-001

**Files affected:**
- `playwright.config.js` (new)
- `tests/helpers/game-state.js` (new)
- `tests/smoke/legacy-loads.spec.js` (new)
- `package.json` (scripts update)

**Goal:** Установить Playwright, создать helpers, написать первый smoke test против `docs/_legacy/_archive_v1/blocksworn_index_fixed.html`.

**Detailed spec:** см. `docs/plan/00_EXECUTION_PLAN.md` §13 T1.03.

**Acceptance criteria (high-level):**
- [ ] Playwright installed + configured per Execution Plan §13 T1.03
- [ ] `tests/helpers/game-state.js` с минимум `loadAuthenticatedState`, `loadStateWithCompleteFTUE` stubs
- [ ] `tests/smoke/legacy-loads.spec.js` проходит against legacy HTML
- [ ] `npm run test:smoke` script добавлен в package.json
- [ ] Commit: `[T1.03] Setup Playwright + smoke test infrastructure`

---

## GAME DESIGNER

(no active tasks — Designer activated в Phase 2)

---

## BUG TESTER

(no active tasks — Tester activated после T1.05 CI ready)

---

## CLOSED TASKS

(none yet — Phase 1 just started)

---

**Maintained by:** CTO agent
**Last update:** 2026-05-11
