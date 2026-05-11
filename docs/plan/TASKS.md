# Active Tasks

> Source of truth for current work. Updated real-time by CTO.
> Detailed spec для каждой task → `docs/plan/00_EXECUTION_PLAN.md` §13-16.

---

## GAME DEVELOPER

### TASK-004 (T1.04) — Capture visual regression baseline

**Status:** REVIEW (Game Dev → awaiting CTO)
**Priority:** HIGH
**Phase:** 1
**Created:** 2026-05-11
**Started:** 2026-05-11
**Completed:** 2026-05-11
**Estimated complexity:** M
**Depends on:** TASK-003 (DONE — Playwright + smoke infrastructure)

**Implementation summary:**
22 baseline PNGs captured across chromium (1280×720) + mobile-chrome (Pixel 7),
covering 11 distinct screen/state combinations. `setupState(page, stateName)`
added to `tests/helpers/game-state.js` with 6 seed strategies. New npm script
`test:visual:baseline` runs the spec end-to-end (~12s wall time). `.gitattributes`
created with `*.png binary`. playwright.config.js testDir widened from
`./tests/smoke` → `./tests` so the visual spec is discovered (npm scripts pin
subpaths). `tests/visual/baseline/` total: 11M (well under 50MB cap).

**Files changed:**
- `tests/visual/capture-baseline.spec.js` (new, 145 lines)
- `tests/helpers/game-state.js` (extended, +90 lines `setupState()` + seed map)
- `tests/visual/baseline/*.png` + `tests/visual/baseline/mobile/*.png` (22 files)
- `.gitattributes` (new — `*.png binary`)
- `package.json` (added `test:visual:baseline` script; updated stub note)
- `playwright.config.js` (widened testDir to `./tests` so visual specs discoverable)

**Commits:**
- T1.04 code+baseline: `2c08bb2` — `[T1.04] Capture visual regression baseline (legacy HTML)`
- DOCS (this update): `(pending second commit)`

**Smoke tests:** ✅ `npm run test:smoke` 2/2 passing (chromium + mobile-chrome)
**Visual baseline run:** ✅ 22/22 passing in ~12s
**Build:** N/A (no src/ changes)
**Lint:** N/A (stub)
**Legacy HTML byte count:** ✅ 21,480,494 (sacred file untouched)

**Self-check:**
- [x] Minimum 10 unique screen/state combinations — **22** captured (11 screens × 2 projects)
- [x] Screenshots stored in `tests/visual/baseline/<name>.png` (chromium) + `tests/visual/baseline/mobile/<name>.png` (mobile-chrome)
- [x] Captured at chromium viewport (1280×720)
- [x] mobile-chrome (Pixel 7) also captured — subfolder layout chosen (`baseline/mobile/<name>.png`), documented in spec header
- [x] `.gitattributes` has `*.png binary` line
- [x] `test:visual:baseline` npm script in `package.json`
- [x] `setupState()` helper documented (one-comment-per-state explaining seed) + IIFE save-version-gate caveat
- [x] Each baseline PNG within 5KB–2MB range (smallest 60KB ftue-chronicle, largest 2.06MB mobile/fresh-chronicle-intro)
- [x] Total `tests/visual/baseline/` size 11M < 50MB
- [x] Commit: `[T1.04] Capture visual regression baseline ...`
- [x] DO NOT TOUCH: `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` — `wc -c` confirms 21,480,494 (unchanged)
- [x] DO NOT TOUCH: `serveLegacyHtmlRaw` Vite plugin — unmodified
- [x] DO NOT TOUCH: `site/` — unmodified
- [x] No `tests/visual/regression.spec.js` created (T1.05 territory)
- [x] No pixelmatch wired up (T1.05 territory)
- [x] No new npm dependencies installed

**Замечено рядом (NOT fixed, reported):**
- `mobile/fresh-chronicle-intro.png` is 2.06MB (~3% over the 2MB soft cap noted in
  acceptance criteria). The screen captures correctly; size is driven by the
  large parchment-style background on a long mobile viewport. Suggested action:
  T1.05 CI can decide to compress baselines via `pngquant` if total dir size
  becomes a concern. Not a blocker.
- `mobile-chrome` initially captured the COMBAT v2.1 P8 "First Contact" name-entry
  modal instead of the menu on `'authenticated'` state — root cause is a 1200ms
  deferred fire of `showFirstContactSequence` (legacy ~48266) that triggers
  when `blocksworn_p8_player_name` is unset. Workaround: seed
  `blocksworn_p8_player_name='TESTER'` in setupState. Suggested action: T1.10
  may want to expose this as a deliberate baseline state (FTUE: P8 first-contact)
  since it's a real player-facing moment.
- Legacy save-version gate IIFE (`_wipeAllBlocksworn` at ~18504) silently wipes
  every `blocksworn_*` key if `blocksworn_save_version` is missing/stale. Any
  future test-state seeder needs to know about this. Documented at top of
  `setupState()` but worth surfacing in DEV_INSTRUCTION.md or the T1.10 spec
  when full-gameplay seeders land.
- `playwright.config.js` testDir was `./tests/smoke` — widened to `./tests` so
  visual specs are discoverable. T1.05 CI must keep this in mind when adding
  `tests/visual/regression.spec.js` (no extra config needed).
- FTUE chronicle/pyredrake baselines capture the *intro dialog overlay*, not
  the post-dialog battle UI (since the dialog gates the battle start and
  requires a user tap to advance). The dialog screen IS the player-facing
  beat at that FTUE step, so it's a legitimate baseline — but if T1.06+ CSS
  migration wants to verify the battle layout itself, a follow-up spec should
  auto-advance the dialog and capture mid-fight.

**Time:** ~90 min (15 min investigation, 30 min initial impl, 30 min debugging
the save-version-gate / FTUE-blockNav issues, 15 min final verification)

**Files affected:**
- `tests/visual/capture-baseline.spec.js` (new)
- `tests/visual/baseline/*.png` (~10-30 new screenshots)
- `tests/helpers/game-state.js` (extend with `setupState()` helper)
- `.gitattributes` (new or update — PNG as binary)
- `package.json` (new script `test:visual:baseline`)

**Goal:** Сделать screenshots всех major screens из legacy HTML — это становится reference для visual regression detection в T1.06+ (CSS migration), T1.10+ (logic extraction), T1.13 (final verify).

**Context:** Per Execution Plan §11 + §3.1 "Test Infrastructure FIRST". Без baseline нет способа проверить что migration не сломала визуал. Baseline сделан ОДИН РАЗ против legacy HTML, потом intentional changes (T1.17 100-hearts → bar, etc.) обновляют specific screens.

**Detailed spec:** `docs/plan/00_EXECUTION_PLAN.md` §13 T1.04 (around lines ~1112-1186) + §11.1.

**What to do (high-level — full spec in Execution Plan):**

1. Создать `tests/visual/capture-baseline.spec.js` per Execution Plan §13 T1.04 template:
   - Loop через SCREENS array (menu, battle, shop, tower, season, profile, select, dailies, ftue-chronicle, ftue-pyredrake — minimum 10 entries)
   - Для каждого: setup state → wait selector → wait 500ms (animations settle) → `page.screenshot({ fullPage: true })` → save to `tests/visual/baseline/<name>.png`
2. Extend `tests/helpers/game-state.js` with `setupState(page, stateName)` helper:
   - `'fresh'` → goto legacy HTML, default state
   - `'authenticated'` → seed localStorage with completed FTUE + chapter 1 unlocked
   - `'in-battle'` → seed authenticated + force load into a battle
   - `'ch1-complete'` → seed with chapter 1 finished
   - `'ftue-chronicle'`, `'ftue-pyredrake'` → seed FTUE at specific beat
   
   Use legacy HTML's known localStorage keys (grep `_legacy/_archive_v1/blocksworn_index_fixed.html` for `localStorage.setItem`, `localStorage.getItem` to find the actual keys). If a specific state cannot be reliably seeded (legacy code initialization order is fragile), **stub the state by setting just the minimal localStorage subset needed to reach the selector** and document why in the spec file.
3. Capture for at minimum **chromium** project. Optionally mobile-chrome (Pixel 7 viewport). WebKit skipped per T1.03 host constraint (see CLOSED TASK-003 — webkit will run in CI T1.05).
4. Create or update `.gitattributes` with `*.png binary` (prevents accidental text-diff confusion in git).
5. Add npm script: `"test:visual:baseline": "playwright test tests/visual/capture-baseline.spec.js"`.
6. Run `npm run test:visual:baseline` → generates ~10-30 PNGs in `tests/visual/baseline/`.
7. Verify screenshots are reasonable (look at 2-3 manually if you can — e.g., `du -sh tests/visual/baseline/` and `ls -la`; if a screenshot is suspiciously tiny like <5KB or huge like >2MB, investigate — that's often a rendering bug, not an asset thing).
8. Commit: `[T1.04] Capture visual regression baseline (legacy HTML, ~N screenshots, chromium + mobile-chrome)`.

**DO NOT TOUCH:**
- `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` (read-only sacred boundary)
- Any code in `src/` — visual baseline runs against legacy, not the new shell
- The `serveLegacyHtmlRaw` Vite plugin from T1.03 (it's why legacy HTML can render at all)
- `site/`
- Sacred cows (CLAUDE.md §2)
- Don't compute visual *regression* yet — that's part of T1.05 CI (the `tests/visual/regression.spec.js` will exist later)
- Don't capture screenshots from the new Vite shell (`index.html` is empty placeholder — would be useless baseline)

**Acceptance criteria:**
- [ ] Minimum 10 unique screen/state combinations captured as PNG
- [ ] Screenshots stored in `tests/visual/baseline/<name>.png`
- [ ] Captured at minimum `chromium` viewport (1280×720 default Playwright)
- [ ] If `mobile-chrome` (Pixel 7) viewport works without issue — capture those too (suffix `<name>.mobile.png` or use subfolder — pick one and stick with it; document choice)
- [ ] `.gitattributes` has `*.png binary` line
- [ ] `test:visual:baseline` npm script in package.json
- [ ] `setupState()` helper documented (one comment line per state explaining what it seeds)
- [ ] Each baseline PNG reasonable size (5KB-2MB range; flag anything outside as `Замечено рядом`)
- [ ] Total `tests/visual/baseline/` size < 50MB (so we don't bloat the repo)
- [ ] Commit: `[T1.04] Capture visual regression baseline ...`

**Known unknowns:**
- Some screens may require user interaction (e.g., opening shop drawer, navigating to profile). Use `page.click()` / `page.locator(...).click()` to reach them — but keep setup minimal; don't try to fully script gameplay.
- Some FTUE states may be hard to seed from cold. If a particular FTUE beat is unreachable from localStorage seeding alone, document the limitation in the spec file and skip that beat (don't block T1.04 on it — note as `Замечено рядом` for T1.10 follow-up).
- Animations may cause flake. The 500ms settle wait is a starting point — increase per-screen if you see flake; document in comment per screen.

**Rollback plan:** `git revert <commit-sha>` + `rm -rf tests/visual/baseline/`. Baselines are not load-bearing for any other task yet.

---

### TASK-005 (T1.05) — Setup CI pipeline

**Status:** TODO (blocked by TASK-004)
**Priority:** HIGH
**Phase:** 1
**Depends on:** TASK-004

**Goal:** GitHub Actions workflow — lint + build + unit + smoke + visual regression. CI must run all 4 Playwright projects (Linux runner has no mac13-arm64 limitation — webkit works).
**Detailed spec:** `docs/plan/00_EXECUTION_PLAN.md` §13 T1.05.
**Must include:** `npm run test:smoke:full` (4-project run) on CI, NOT the local default `test:smoke` (which filters to chromium).

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

### TASK-002 (T1.02) ✅ DONE 2026-05-11
**Reviewed by:** CTO (verification only — no code changes needed)
**Outcome:** All 3 acceptance criteria met
**Self-check:**
- [x] CLAUDE.md exists in repo root (`/CLAUDE.md`, 29 KB, committed in `41da1eb`)
- [x] Contains required sections (§1-§9 — Sacred Cows, AAA+, Document Protocols, Role Boundaries, etc.)
- [x] Markdown valid (799 lines)

### TASK-003 (T1.03) ✅ DONE 2026-05-11
**Reviewed by:** CTO
**Outcome:** 6 of 7 acceptance criteria met; AC #1 partial (chromium installed, WebKit blocked by host platform — **environment limitation, not a code defect**)
**Commits:**
- `8d79a61` — `[T1.03] Setup Playwright + smoke test infrastructure` (Dev work)
- `8773ca6` — `[DOCS] TASK-003 → REVIEW with self-check` (Dev self-check)
- (CTO admin patch commit — split `test:smoke` script)

**What was delivered:**
- @playwright/test 1.59.1 installed (declared ^1.47, npm bumped to current — semver compatible)
- Chromium browser binary fetched (531 MB total cache: chromium + chromium_headless_shell + ffmpeg)
- `playwright.config.js` byte-for-byte per Execution Plan §13 T1.03 (4 projects retained for forward compatibility)
- `tests/helpers/game-state.js` — 3 named-export stubs (`loadAuthenticatedState`, `loadStateWithCompleteFTUE`, `playOptimalBattle`)
- `tests/smoke/legacy-loads.spec.js` — passes on chromium + mobile-chrome (2.7s)
- `vite.config.js` — added `serveLegacyHtmlRaw` plugin (legacy HTML has malformed nested `<!--` comment at line ~18129 that browsers tolerate but parse5/Vite-transformIndexHtml rejects — plugin serves raw bytes for that URL, bypassing transform); also explicit `server.fs.allow: ['.']`

**CTO decision on WebKit:**
- Question raised by Dev: WebKit binaries refuse install on macOS 13 arm64 (Playwright 1.59 requires macOS 14+ on arm64). chromium + mobile-chrome PASS; webkit + mobile-safari FAIL at browser launch.
- **CTO chose Option 1** (accept current state) **with admin script split:**
  - `test:smoke` (local default) → `playwright test tests/smoke --project=chromium --project=mobile-chrome` — exits 0 on Roman's macOS 13 host
  - `test:smoke:full` (new, for CI) → `playwright test tests/smoke` — runs all 4 projects, Linux runner has no WebKit constraint
  - `playwright.config.js` left untouched (all 4 projects defined; the script filter is the right layer for the host-specific divergence)
- **Why:** WebKit constraint is purely environment (host macOS version). Config is correct. Defaulting local `test:smoke` to the passing subset matches the AAA+ principle "smoke must always pass on dev machine"; full coverage runs in CI on Linux.

**Tech debt items tracked (not fixed in T1.03):**
- @playwright/test version drift `^1.47 → 1.59.1` — semver-allowed but worth a pin discussion at T1.05 (CI reproducibility)
- Legacy HTML's malformed nested comment is a v1 authoring bug — out of scope; will resolve naturally when code migrates out of single HTML (T1.06+)
- 2 moderate npm transitive vulnerabilities (still flagged from T1.01) — defer to T1.05 lint/security pass
- Browser cache 531 MB on dev machine — gitignored (`node_modules/`) doesn't catch it because it's in `~/Library/Caches/`; that's expected/fine

**Verification of CTO admin patch:**
- `npm run test:smoke` → 2 passed (2.7s), exit 0 ✅

---

**Maintained by:** CTO agent
**Last update:** 2026-05-11 — after T1.03 review + CTO admin script split
