# Active Tasks

> Source of truth for current work. Updated real-time.
> Detailed spec для каждой task → `docs/plan/00_EXECUTION_PLAN.md` §13-16.

---

## GAME DEVELOPER

### TASK-001 (T1.01) — Setup Vite scaffold + new repository

**Status:** TODO
**Priority:** HIGH
**Phase:** 1
**Created:** 2026-05-11
**Estimated complexity:** M
**Depends on:** none

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
