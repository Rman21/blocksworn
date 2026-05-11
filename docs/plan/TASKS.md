# Active Tasks

> Source of truth for current work. Updated real-time by CTO.
> Detailed spec для каждой task → `docs/plan/00_EXECUTION_PLAN.md` §13-16.

---

## BUG TESTER

### BUGS (closed)

#### BUG-001 🟡 MAJOR ✅ CLOSED 2026-05-11 — Visual regression WARN band silently passed CI

**Severity:** 🟡 MAJOR → resolved (no longer applicable)
**Area:** Visual regression gate / CI quality contract
**Discovered:** 2026-05-11 during AUDIT-01 Scenario 5 (Bug Tester)
**Resolution:** CTO config patch — Phase 1 strict mode

**Original issue:** 30px red banner injected on every screen produced 3.18-4.08% diff; all 22 tests PASSED because implementation treated 2-5% as "WARN + pass" (per CLAUDE.md §3.7 three-band canon). Tester correctly identified the gap: CTO's AUDIT-01 spec said "EXPECT FAIL at ≥2%" but implementation gates at >5%. Spec wording was wrong; implementation matched CLAUDE.md canon.

**CTO triage:** Tester's Option (a) — tighten `WARN_THRESHOLD` to `PASS_THRESHOLD` (both 0.02) for Phase 1 strict mode. Rationale: during code migration (T1.06-T1.20), any diff >2% should be human-reviewed at PR time, not accumulate silently. WARN band will be re-relaxed to 0.05 in Phase 2 when intentional Identity-FX visual changes land.

**Fix applied:** `tests/visual/regression.spec.js` line ~37-42:
- `WARN_THRESHOLD` lowered from `0.05` to `0.02`
- Header comment + inline comment document Phase 1 strict mode + planned Phase 2 relax

**Verification:** `npm run test:visual` → 22/22 still pass under 2% (no false-positive flakes from tightening); regression-catch behavior now: ANY diff >2% fails CI (caught by Tester's 30px banner case).

**Commit:** see CTO closeout commit (post-AUDIT-01).
**CLAUDE.md §3.7 / §7.6:** left unchanged — the three-band wording IS the long-term contract; we're temporarily strict during Phase 1 only, documented in spec file.

---

## GAME DEVELOPER

### TASK-007 (T1.06) — Extract CSS into modular structure

**Status:** IN PROGRESS (Game Dev Agent assigned 2026-05-11)
**Priority:** HIGH
**Phase:** 1 (Week 2-3, **first code migration task**)
**Depends on:** ✅ AUDIT-01 (DONE, verdict GO); ✅ BUG-001 (CLOSED, Phase 1 strict threshold landed)
**Estimated complexity:** L (largest non-extraction-XL task in Phase 1; ~500KB inline CSS to migrate)

**Files affected:**
- `src/styles/tokens.css` (new)
- `src/styles/reset.css` (new)
- `src/styles/typography.css` (new)
- `src/styles/animations.css` (new — all 187 @keyframes)
- `src/styles/components/*.css` (new — button, card, modal, progress-bar, etc.)
- `src/styles/screens/*.css` (new — menu, battle, shop, tower, season, profile, select, dailies)
- `src/styles/index.css` (new — top-level `@import` chain)
- `src/main.js` (add `import './styles/index.css';`)
- `index.html` (no inline `<style>` — confirm shell stays minimal)
- `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` — **DO NOT TOUCH** (sacred, byte-identical)

**Goal:** Extract all inline `<style>` blocks from the legacy 21MB HTML into modular `src/styles/` files. The new Vite project root index.html stays minimal (just imports `src/main.js` which imports `src/styles/index.css`). The legacy HTML continues to render correctly via the `serveLegacyHtmlRaw` Vite plugin (it has its own inline CSS — leave that alone).

**Context:** Per Execution Plan §6.3 Week 2-3 + §13 T1.06. CSS is the **most independent** layer of the legacy code — extracting it has zero execution-time risk on game logic. Migration here builds confidence and surfaces patterns for subsequent harder tasks (T1.07 data, T1.08 services, T1.09 feel, T1.10 core logic).

**Detailed spec:** `docs/plan/00_EXECUTION_PLAN.md` §13 T1.06 (around lines ~1252-1325) — read carefully.

**Approach:**
1. Read legacy HTML, identify all `<style>` blocks (likely 1 large + several smaller)
2. Categorize CSS by purpose:
   - CSS custom properties (`:root` variables) → `tokens.css`
   - Reset / typography → `reset.css`, `typography.css`
   - All `@keyframes` (~187 of them) → `animations.css`
   - Generic patterns (button, card, modal, etc.) → `components/<name>.css`
   - Per-screen styles (anything `.menu-*`, `.battle-*`, `.shop-*`, etc.) → `screens/<name>.css`
3. Create `src/styles/index.css` with `@import` statements in **correct cascade order**:
   ```css
   @import './tokens.css';
   @import './reset.css';
   @import './typography.css';
   @import './animations.css';
   @import './components/button.css';
   /* ... other components ... */
   @import './screens/menu.css';
   /* ... other screens ... */
   ```
4. In `src/main.js`, add: `import './styles/index.css';`
5. **DELETE all `--v-*` legacy tokens** during extraction — they're marked deprecated. After this task, grep `--v-` across `src/` must return 0 results.
6. **DO NOT change any CSS value during migration.** Pure relocation. If you see something that looks wrong → flag in "Замечено рядом", don't fix.
7. Run smoke + visual regression after each significant chunk. Visual must remain ≤2% diff per screen (now strict per BUG-001 fix).
8. The legacy HTML continues to serve via Vite plugin — its inline CSS is irrelevant to the new `src/styles/`. The two render paths are independent.

**Acceptance criteria:**
- [ ] All inline `<style>` content from legacy migrated to `src/styles/`
- [ ] `src/styles/index.css` `@imports` everything in correct cascade order
- [ ] `src/main.js` imports `./styles/index.css`
- [ ] CSS modular structure matches Execution Plan §5.1
- [ ] **Zero `--v-*` references in `src/styles/`** (grep verifies)
- [ ] **All 187 `@keyframes` preserved** (count in animations.css matches legacy)
- [ ] `npm run test:smoke` → 2/2 pass
- [ ] `npm run test:visual` → 22/22 pass under 2% (legacy HTML render path unchanged; new src/styles doesn't affect it)
- [ ] `npm run build` → succeeds, dist/ size still < 5MB
- [ ] `npm run lint` → 0 errors
- [ ] Bundle CSS size < 500KB (Vite minified)
- [ ] Commit: `[T1.06] Extract CSS into modular structure`

**DO NOT TOUCH:**
- `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` (sacred — `wc -c` must remain `21480494`; SHA-256 `4b3a3974f8b9030bf195dc9fad2b7b4bf07857021b3c01b44410ac547fcee67f`)
- `serveLegacyHtmlRaw` Vite plugin (T1.03)
- Visual baselines (T1.04 — they're the reference)
- CI workflow, husky, eslint config (T1.05 — they're done)
- Sacred cows (CLAUDE.md §2)
- Any JavaScript — pure CSS extraction
- `site/` folder
- New CSS frameworks (no Tailwind, no styled-components, no SASS)
- CSS values during migration — pure relocation only

**Known unknowns:**
- Exact count of inline `<style>` blocks (could be 1 huge or many smaller — depends on legacy authoring)
- Whether `--v-*` tokens are in :root or scattered — grep first
- Cascade order matters; if visual diff appears, FIRST check cascade order before changing CSS

**Rollback plan:** `git revert <commit-sha>` — pure CSS extraction is fully reversible; legacy HTML wasn't touched.

**Time-box / pacing:**
This is a Large (L) task. Plan for: 15 min read/categorize, 60-90 min relocate, 30 min verify (smoke + visual + build + lint). If you hit a visual regression you can't explain in 5 min, STOP and report — don't chase silently.

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
