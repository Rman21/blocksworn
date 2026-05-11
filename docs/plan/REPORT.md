# Reports & Audits

> Phase reports, audits, escalations, bug summaries.
> Per CTO_INSTRUCTION.md §11 — updated phase end, bug finding, escalation, audit.

---

## REPORT-01: Initial Project Audit

**Date:** 2026-05-11
**Author:** CTO
**Phase:** 0 (pre-Phase 1 setup)
**Trigger:** First CTO session — Initial Setup per CTO_INSTRUCTION.md §3

### Project state at session start

**Codebase:**
- Single 21MB `blocksworn_index_fixed.html` (still in repo root at session start)
- v2.1 reboot ~76% complete per Execution Plan §1.2
- 10 v2.1 phase spec docs in `Restructure/` folder (parent dir)
- Recent commits show v2.1 sprint P1-P10 completion (combat-v21-10e through 10a, emblems layer #157)
- Marketing site live at blocksworm.com (`site/` folder — Next.js, deployed via Vercel)

**Infrastructure:**
- ❌ No `package.json` in repo root (Vite scaffold not yet done — T1.01)
- ❌ No `docs/plan/`, `docs/agents/`, `docs/adr/`, `docs/design/`, `docs/_legacy/` structure (created in this session)
- ❌ No `PLAN.md`, `TASKS.md`, `REPORT.md` (created in this session)
- ❌ No smoke tests, visual regression baseline, CI pipeline (planned T1.03-T1.05)
- ✅ Existing `docs/` folder has v2.1 audit history (PHASE_*_AUDIT.md, CHAPTER_*_DIAGNOSTIC.md) — preserved as legacy reference

**Worktree state:**
- Current worktree: `claude/dreamy-bouman-f8e247`
- Branch clean at session start
- Initial Setup performed in this worktree

### v2.1 Implementation Status (per Execution Plan §23)

**✅ Implemented (per spec):**
- P1 Foundation: MAX_HP=100, 4 channels, mitigation matrix
- P2 Stagger Loop: Recovery state, Pressure UI
- P3 Hero Tiers: HERO_TIER_ABILITIES, Aegis Conductor, Squad Conductor
- P4 Boss Recalc: BOSS_TTK_TARGETS, TTK formula
- P5 Polish + Mon: Inter-battle screens, Tower differentiation
- P6 Cosmic Ascension: Ch4-5 bosses, Hero Cards, Tower Hearts (per Execution Plan §1.2 — TO BE VERIFIED — see Memory conflict below)
- P7 Monetization: Battle Pass, PURE PATH leaderboard
- P8 FTUE Restructure: Chronicler narrator, Tutorial Library, FTUE_BOSS_GUARANTEES
- P9 Tower System: dedicated roster, Tower Pacts, Uroboros, Achievements, Weekly Rotation
- P10 Endgame Polish: colorblind, localization, reduce motion, profile customization

**🔴 Identified debt (per Execution Plan §1.2):**
- P1 §4: Артефакты НЕ удалены (`applyArtifact*` functions in code) → T1.14
- P5 §7 Final Legacy Purge: Cosmic Memorial renderer + CSS remain → T1.15
- P3 Mythic ability framework: possibly partially implemented → T1.19 verify
- P7 Player Segments constants: not confirmed in code → T1.20 verify

### Memory conflicts to resolve

**Memory says:** "Chapters Ch1-3 shipped (VEIL OF FORGOTTEN GODS, not PRIMAL CONCLAVE); Ch4-5 post-launch only"

**Execution Plan says:** "P6 Cosmic Ascension: Ch4-5 bosses ✅ Implemented"

**Resolution plan:** during T1.07 (data extraction) or T1.10 (logic extraction), Game Dev will grep `_legacy/blocksworn_index_fixed.html` for Ch4-5 boss data. If found → Execution Plan correct, Memory stale, update memory. If not found → Execution Plan §1.2 P6 line is aspirational, update PLAN.md to reflect Ch4-5 as post-launch.

**This is NOT blocking** Phase 1 — code extraction is identical either way. Status will be confirmed in T1.10 review.

### Site (blocksworm.com)

`site/` folder = Next.js + Tailwind marketing site, separate deploy.
**Decision:** Out of scope для Phase 1-4 Execution Plan. Site stays as-is until Roman directs site updates после game milestones.

### Initial Setup Actions Performed (this session)

1. ✅ Created `docs/plan/`, `docs/agents/`, `docs/adr/`, `docs/design/{mechanics,balance,ux,progression,monetization}`, `docs/_legacy/{v21_phase_specs,_archive_v1}`
2. ✅ Copied 4 agent instructions to `docs/agents/` (CTO, DEV, DESIGNER, TESTER)
3. ✅ Copied `CLAUDE.md` to project root
4. ✅ Copied `Blocksworn_Execution_Plan.md` → `docs/plan/00_EXECUTION_PLAN.md`
5. ✅ Created `PLAN.md` with all 4 phases + T1.01-T1.20 listed
6. ✅ Created `TASKS.md` with first 3 tasks (T1.01-T1.03) in TODO for Game Developer
7. ✅ Created this REPORT.md
8. ⏳ Initial commit pending
9. ⏳ T1.01 assignment to Game Dev — next step

### Sacred Cows confirmed (per CLAUDE.md §2)

All v2.1 systems noted в CLAUDE.md §2.5 are sacred. Combat math, Feel layer (V_HAPTICS, NARRATOR_LINES), Narrative voice, Economy ladders — all enforced as constraints in every Game Dev task prompt.

### Phase 1 Sequence (week 1-8)

Per Execution Plan §6.4:

```
Week 1:    T1.01 → T1.02 → T1.03 → T1.04 → T1.05  (infrastructure)
Week 2-3:  T1.06 → T1.07 → T1.08                  (data + services + CSS)
Week 4-5:  T1.09 → T1.10 → T1.11 → T1.12 → T1.13  (logic + UI extraction)
Week 6:    T1.14 → T1.15 → T1.16 → T1.17 → T1.18  (cleanup)
Week 7-8:  T1.19 → T1.20                          (completion + hardening)
```

### Recommendations

1. **Start T1.01 immediately** — Vite scaffold + relocate `blocksworn_index_fixed.html` to `_legacy/`
2. **Bug Tester engagement deferred** — not needed until T1.05 (CI ready)
3. **Designer engagement deferred** — Phase 1 has no design work (Foundation Reset). Designer activates at T2.01.
4. **No escalations needed** at this stage.

### Bug Testing Required

None at Phase 0. First test cycle планируется после T1.05 (CI ready → can run smoke tests reliably).

### Roman notification (sent in chat)

> "Initial setup complete. Created `docs/` structure, `CLAUDE.md` in root, `PLAN.md`, `TASKS.md`, `REPORT.md`, copied Execution Plan and 4 agent instructions.
>
> Phase 1 ready. TASK-001 (T1.01 Vite scaffold) ready for Game Developer execution.
>
> Memory vs Execution Plan conflict on Ch4-5 status — will resolve during T1.10 review. Non-blocking.
>
> Proceeding to assign TASK-001 to Game Dev agent."

---

## REPORT-02: T1.01 + T1.02 Review (Phase 1 Week 1 — first 2 tasks)

**Date:** 2026-05-11
**Author:** CTO
**Phase:** 1
**Trigger:** TASK-001 submitted REVIEW after ESC-01 unblock; TASK-002 self-verified by CTO

### Summary

Phase 1 Week 1 momentum re-established after ESC-01 (Node install) consumed half the day. T1.01 + T1.02 both DONE, Phase 1 progress 2/20. T1.03 (Playwright) assignment ready in TASKS.md.

### T1.01 outcome

**PASS — all 9 acceptance criteria met.** See `TASKS.md` CLOSED TASKS entry for full breakdown. Highlights:
- `npm run build` → 8.0K `dist/`, 41ms
- `npm run dev` → Vite v5.4.21 serves shell HTML on :5173, killed cleanly
- Legacy HTML byte-identical (21,480,494 bytes) at `docs/_legacy/_archive_v1/`
- 2 commits clean: `c9cf50e` (T1.01) + `6c010ef` (DOCS self-check)

### T1.02 outcome

**PASS — verification only.** CLAUDE.md was already copied to repo root in Initial Setup commit `41da1eb` (during this same session). Verified content matches required sections per CLAUDE.md §1.4 / Execution Plan §17. 799 lines, markdown valid. No code commits needed for T1.02 — DONE entry recorded in TASKS.md.

### Tech debt items flagged for tracking

From T1.01 self-report ("Замечено рядом"):
1. **npm 2 moderate vulnerabilities** in transitive deps — investigate during T1.05 (CI setup) or spawn dedicated security-audit task. Severity moderate, not blocker.
2. **npm minor version** `11.12.1 → 11.14.1` available — cosmetic, defer.
3. **Empty directories** not tracked by git — acceptable, will populate organically in T1.06+.

These DO NOT block Phase 1 progression.

### Sequencing forward

Next: T1.03 (Playwright + smoke infrastructure). Highest priority — Test Infrastructure FIRST principle (Execution Plan §3.1) means we cannot proceed to code migration (T1.06+) without smoke + visual + CI gates established.

Estimated Week 1 completion: T1.05 (CI green) within 1-2 working days at current pace, assuming no further blockers.

### Bug Testing Required

Not yet. Tester still on standby until T1.05 (CI ready). At that point I will assign Tester a pre-T1.06 smoke-suite audit (baseline test pass against legacy HTML, before migration starts).

---

## REPORT-03: T1.03 Review + WebKit constraint decision

**Date:** 2026-05-11
**Author:** CTO
**Phase:** 1
**Trigger:** TASK-003 submitted REVIEW with one-question rule blocker

### Summary

T1.03 delivered correct Playwright + smoke infrastructure. Host platform (macOS 13 arm64) cannot install WebKit binary (Playwright 1.59 requires macOS 14+ for WebKit on Apple Silicon). CTO decided to accept the work as DONE with a script-level workaround so local `npm run test:smoke` exits 0; CI on Linux runner (T1.05) will run all 4 projects without constraint.

### Decision: WebKit constraint handling

**Three options considered (raised by Dev via one-question rule):**

1. **Accept current state, rely on CI for WebKit** — config defines all 4 projects, but webkit + mobile-safari fail at browser launch on this host. *(Dev's recommendation.)*
2. **Add `test.skip(browserName === 'webkit', ...)`** in the spec file — would also skip on CI. *(Bad — defeats purpose of CI coverage.)*
3. **Downgrade Playwright** to a version that supported webkit on mac13-arm64 *(High risk, unclear if such version exists.)*

**CTO chose Option 1 + script split** (cleaner than pure Option 1):

- `package.json` `test:smoke` (local default) → filters to `chromium + mobile-chrome` projects → exits 0 on Roman's host
- `package.json` `test:smoke:full` (new) → runs all 4 projects → CI uses this
- `playwright.config.js` untouched (all 4 projects defined; script filter is the correct layer for host-specific divergence)
- T1.05 spec updated in TASKS.md to require CI uses `test:smoke:full`, not `test:smoke`

### Why this is the right call

- AAA+ principle: smoke tests MUST pass on dev machine (a red smoke run rots developer trust in the safety net)
- The WebKit gap is environment-only, not project-level — CI on Ubuntu has no such constraint
- Forward compatibility: if Roman upgrades to macOS 14+, local `test:smoke` can be expanded to all 4 projects via a one-line script edit
- No code lock-in to host limitation: `playwright.config.js` is unchanged from spec

### Notable T1.03 engineering observation

The legacy HTML (21MB single file) contains a **malformed nested HTML comment** near line 18129 — pattern: `<!-- ... <!-- ... -->`. Browsers tolerate this; **parse5** (used by Vite's `transformIndexHtml` step) rejects it with `nested-comment` error → HTTP 500. Without a workaround, Vite dev server cannot serve the legacy HTML at all.

Dev's solution: a `serveLegacyHtmlRaw` Vite plugin (`vite.config.js`) that intercepts the exact legacy URL and serves raw bytes, bypassing the HTML transform pipeline entirely. Legacy HTML stays untouched (sacred, byte-identical at 21,480,494 bytes). Plugin documented in-file.

This pattern (raw passthrough for legacy assets) may resurface in T1.04 (visual baseline) and T1.06 (CSS migration) — keep an eye on it.

### Tech debt items (still tracked)

Continuing from REPORT-01/02:
- 2 moderate npm transitive vulnerabilities → defer to T1.05 lint/CI security
- `@playwright/test` version drift `^1.47 → 1.59.1` semver-allowed; consider exact-pin discussion at T1.05
- npm 11.12.1 → 11.14.1 cosmetic
- Legacy HTML's malformed nested comment is a v1 authoring bug — will be naturally fixed during T1.06+ code migration out of single HTML

### Phase 1 Week 1 progress

3 / 20 tasks done in roughly 1 working session (with ~50% of time burned on ESC-01 Node install). T1.04 (visual baseline) assignment ready. T1.05 (CI pipeline) next after. Week 1 plan still tracking.

### Bug Testing Required

Not yet. Tester engagement first triggers at T1.05 completion (full CI green) — at that point I will assign a pre-T1.06 smoke audit (baseline test pass against legacy HTML, before migration starts).

---

## REPORT-04: T1.04 Visual Baseline Review

**Date:** 2026-05-11
**Author:** CTO
**Phase:** 1
**Trigger:** TASK-004 submitted REVIEW with all AC met

### Summary

T1.04 passes cleanly. 22 baselines captured (11 screen/state combinations × chromium + mobile-chrome). 11M total, well under the 50MB cap. Legacy HTML byte-identical at 21,480,494. `npm run test:visual:baseline` produces all 22 reproducibly in ~12s.

### Engineering discoveries worth flagging for future tasks

Game Dev's investigation surfaced two **non-obvious legacy quirks** that will bite future state-seeders:

1. **Save-version-gate IIFE (legacy ~18504):** the legacy HTML has a `_wipeAllBlocksworn` self-executing function that silently wipes ALL `blocksworn_*` localStorage keys at boot if `blocksworn_save_version` is missing or stale. Any future seeder MUST set `blocksworn_save_version='2'` FIRST, before any other key. Currently documented at the top of `setupState()` in `tests/helpers/game-state.js`. **Action:** when T1.10 ships full-gameplay seeders, this needs surfacing in `docs/agents/DEV_INSTRUCTION.md` (or a dedicated `docs/legacy-quirks.md`) so the next Dev doesn't rediscover the hard way.

2. **COMBAT v2.1 P8 First Contact modal (legacy ~48266):** auto-fires 1200ms after menu paint if `blocksworn_p8_player_name` is unset. Caused mobile menu screenshots to capture the name-entry modal instead of the menu. Workaround: seed `blocksworn_p8_player_name='TESTER'`. T1.10 may want to expose this as a deliberate FTUE: P8 first-contact baseline state.

These are valuable because they predict future migration pain. **CTO note:** during T1.06 (CSS migration) and T1.10 (logic extraction), the migrator MUST preserve both behaviors exactly. They are not Sacred Cows per CLAUDE.md §2 but they are functionally identity-bearing — losing them would be a regression.

### Test infrastructure status after T1.04

- ✅ Vite scaffold (T1.01)
- ✅ CLAUDE.md (T1.02)
- ✅ Playwright + smoke (T1.03) — chromium + mobile-chrome green locally; full 4-project CI ready via `test:smoke:full`
- ✅ Visual baseline (T1.04) — 22 PNGs, ready for diff
- ⏳ CI + visual regression diff (T1.05) — final Week 1 infra

After T1.05 green, Week 1 phase gate met. T1.06 (CSS migration) can start.

### Misc tooling note

Game Dev widened `playwright.config.js` `testDir` from `./tests/smoke` to `./tests` so visual specs are discoverable. CI in T1.05 must keep this; npm scripts pin subpaths anyway.

### Bug Testing Required

Not yet. First Tester engagement deferred until T1.05 (CI green) — pre-T1.06 baseline smoke audit.

### Tech debt items (continuing)

Unchanged from REPORT-03:
- 2 moderate npm transitive vulnerabilities → defer to T1.05
- @playwright/test version drift discussion → T1.05
- Legacy malformed nested comment → resolves naturally in T1.06+
- `mobile/fresh-chronicle-intro.png` 2.06MB (3% over soft cap) → T1.05 can decide pngquant

---

## REPORT-05: T1.05 Review (Week 1 Infrastructure Complete)

**Date:** 2026-05-11
**Author:** CTO
**Phase:** 1 — Week 1 → Week 2 transition
**Trigger:** TASK-005 + T1.05.1 fix passed all acceptance criteria

### Summary

**Phase 1 Week 1 infrastructure track is complete.** 5/20 tasks done — Vite scaffold, CLAUDE.md, Playwright smoke, visual baseline (22 PNGs), CI workflow + visual regression diff + husky + ESLint. Local verification all green. CI workflow ready for first push to GitHub Actions runner.

### T1.05 outcome

**PASS after one RETURN cycle.**

Initial T1.05 delivered all 5 deliverables but visual regression flaked on `fresh-chronicle-intro` (8.4% chromium, 30.8% mobile). CTO RETURNED with rAF hypothesis.

T1.05.1 fix: Dev correctly identified CTO's rAF hypothesis as wrong (rAF stub made diff worse: 20% chromium, 75% mobile). Real cause: `#introVideoPlayer <video>` element autoplay on cold-start. Real fix: pause `<video>` elements (currentTime=0, autoplay=false), parity in both capture and regression specs.

**Lesson for CTO:** when RETURNING a task with a fix hypothesis, mark it as *hypothesis*, not as the answer. Trust the Dev's diagnostics over my pattern-matching from a distance. Dev agents have the failing diff image; CTO does not. The agent's "RETURN with specific fixes" template should include a step like "verify CTO's diagnosis; if it's wrong, investigate root cause yourself" — added implicitly in the future via better RETURN framing.

### Week 1 infrastructure scorecard

| Component | Status | Notes |
|---|---|---|
| Vite scaffold + ES modules | ✅ | `npm run dev` / `build` clean; bundle <50KB shell |
| Legacy HTML preserved | ✅ | `wc -c` = 21,480,494; byte-identical, hash recorded in AUDIT-01 |
| Playwright smoke | ✅ | 2/2 pass locally (chromium + mobile-chrome) in ~2.7s |
| Visual baseline | ✅ | 22 PNGs, 11M total |
| Visual regression diff | ✅ | 22/22 pass under 2% after T1.05.1 fix |
| ESLint flat config v9 | ✅ | 0 errors / 0 warnings |
| Husky pre-commit | ✅ | `.husky/pre-commit` executable, wired to lint:staged + build |
| GitHub Actions CI workflow | ✅ (locally) | Awaiting first push to verify on Linux runner |
| AAA+ §3.2 Bundle <5MB | ✅ | Currently 8 KB; T1.06+ migration grows this naturally |
| AAA+ §3.4 Code quality | partial | Lint enforces; magic numbers / 500-line file rule not yet checked (no game code in src/ yet) |

### Infrastructure tech debt items remaining

Tracked from REPORT-01 through 04:
- 2 moderate npm transitive vulnerabilities → bring up to Roman after AUDIT-01 if Tester confirms it doesn't block runtime
- @playwright/test ^1.47 → 1.59.1 version drift → consider exact-pin once Phase 1 settles
- npm minor 11.12.1 → 11.14.1 (cosmetic)
- Legacy HTML malformed nested comment + autoplay video — handled via workarounds, root fix happens organically during T1.06+ migration
- `mobile/fresh-chronicle-intro.png` 2.06MB — accept; T1.05 didn't pngquant; total dir still 11M

### Decision: Bug Tester engagement BEFORE T1.06

Per CTO_INSTRUCTION §8.1 "MANDATORY after any major refactor" — Phase 1 Week 1 IS the major refactor of project infrastructure. Before code migration (T1.06+) begins, Tester must:

1. Verify local toolchain works end-to-end (smoke + visual + lint + build)
2. **Prove visual regression detects a forced change** (inject a temporary red banner, confirm test fails, revert) — this is the most important step
3. Verify legacy HTML byte-identity (SHA-256 hash recorded as immutable reference)
4. Verify CI workflow YAML is syntactically valid
5. Verdict: GO / CONDITIONAL / NO-GO

Assignment created: TASKS.md AUDIT-01.

### Decision: Roman action — push to verify CI on real GitHub Actions runner

CI workflow has not been tested on actual Linux runner yet. Worktree branch `claude/dreamy-bouman-f8e247` has 11 commits ahead of `origin/main`. Roman should push so first CI run validates:
- WebKit installs on Ubuntu (it should — host-specific limitation was macOS 13 arm64 only)
- All 4 Playwright projects run in `smoke` job
- `visual` job passes (only chromium project — visual baseline doesn't cover WebKit)
- Bundle-size guard fires correctly

If CI hits issues — those become T1.05.2 fix work. If clean — Week 1 phase gate fully validated.

CTO is **not** pushing autonomously per discipline (push affects shared state; Roman owns when to engage GitHub Actions minutes).

### Phase 1 Week 1 → Week 2 transition

After AUDIT-01 GO + Roman push CI green:
- T1.06 — CSS extraction (Week 2-3 first major code task)
- T1.07 — Data constants extraction
- T1.08 — Services extraction
- T1.09 — Feel layer extraction (sacred cow handling)
- T1.10 — Core game logic extraction (largest task in Phase 1; ~50% of Week 4-5)

Total Week 2 ETA: 2 working sessions (Week 2-3 in plan; agent throughput compressed it).

---

## ESCALATIONS

### ESCALATION ESC-01: Node.js / npm not installed on host

**Status:** RESOLVED 2026-05-11

### Resolution

**Roman decision (2026-05-11):** Option 2 (Node.js .pkg installer from nodejs.org).

**Reason:** Option 1 (Homebrew → `brew install node`) was attempted first — Homebrew installed cleanly, but `brew install node` failed during build-from-source. macOS 13 = Tier 3 Homebrew config, `readline` and `lzip` source patches timed out from `ftp.gnu.org` / `download-mirror.savannah.gnu.org` (curl 15-second timeouts × 4 retries). Pivoted to `.pkg` installer — pre-built binary, no compilation, no Homebrew dependency.

**Outcome:**
- Node.js v24.15.0 + npm 11.12.1 installed on host
- Verified by Roman in fresh terminal: `node --version && npm --version` → `v24.15.0` / `11.12.1`
- Homebrew remains installed (5.1.11) but not used for Node
- T1.01 unblocked, agent re-tasked to complete remaining `npm install` + verify + commit steps

**Lessons for future Phase 1 tasks:**
- macOS 13 host: prefer `.pkg` / `tar.gz` direct downloads over `brew install` for tooling
- Playwright (T1.03) may have similar source-build issues if it depends on system libs — watch for it
- All future Dev tasks can assume `node` / `npm` available in PATH

**Original escalation:**
**Created:** 2026-05-11
**Severity:** BLOCKER
**Origin:** TASK-001 (T1.01 Vite scaffold)

### Context

Game Developer agent attempted T1.01 (Vite scaffold). All file-system steps succeeded (folders created, `blocksworn_index_fixed.html` moved to `docs/_legacy/_archive_v1/`, `package.json` / `vite.config.js` / `index.html` shell / `src/main.js` / `.gitignore` written). Steps requiring `npm` — install dev deps, `npm run dev` verify, `npm run build` verify — could not execute.

CTO verified independently:
- `command -v node npm brew` → not found
- No `~/.nvm`, `~/.fnm`, `~/.asdf`, `~/.volta` directories
- No `/opt/homebrew/`, `/usr/local/bin/node`

The host is a clean macOS dev machine without Node.js toolchain.

This is environment-level, not design-level. The Execution Plan implicitly assumed Node.js would be installed (every Phase 1 task uses `npm` / `vite`). T1.01 is just where the assumption first hits.

### Options considered

1. **Install Node.js via Homebrew (recommended path)**
   - Roman runs: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` then `brew install node`
   - Pros: standard macOS approach, future tasks unblocked permanently, version-managed
   - Cons: ~5-10 min of Roman's time, requires sudo, modifies system PATH
   - Impact: unblocks everything from T1.01 through T4.12

2. **Install Node.js via official installer**
   - Roman downloads .pkg from https://nodejs.org/ → run installer
   - Pros: no Homebrew dependency, GUI-driven
   - Cons: harder to update later, no version manager
   - Impact: same — unblocks all Phase 1+

3. **Install Node.js via nvm**
   - Roman runs nvm install script + `nvm install --lts`
   - Pros: easy version switching for future projects
   - Cons: more complex setup, shell init configuration
   - Impact: same

4. **Authorize unverified commit (NOT recommended)**
   - Commit scaffold files without running `npm run dev` / `npm run build` to verify
   - Pros: progress without tooling install
   - Cons: violates spec (verification non-negotiable), accumulates risk, every downstream task (T1.02-T1.20) still needs Node anyway — only defers the problem by one task
   - Impact: BLOCKED by T1.02 regardless

5. **Revert and pause Phase 1**
   - `git restore --staged . && git checkout . && git clean -fd` — discard agent's work
   - Pros: clean slate
   - Cons: throws away ~80% of T1.01's file-system work for nothing — same blocker on re-attempt
   - Impact: pure waste

### CTO recommendation

**Option 1 (Homebrew + node).** Standard, idiomatic macOS setup. Single one-time action unblocks ALL of Phase 1-4. Roman runs two commands locally and notifies CTO when done. CTO then re-tasks the agent to run `npm install`, verify `npm run dev` / `npm run build`, and commit.

Verify after install: `node --version` (need ≥18), `npm --version`.

### Awaiting decision on

Which install path (1, 2, or 3)? Or alternative direction?

### Project impact while waiting

- T1.01 BLOCKED (file work parked uncommitted in working tree — preserved)
- T1.02-T1.20 BLOCKED transitively
- Designer / Tester not yet activated → no parallel work possible
- Estimated unblock time: 5-15 min after Roman runs install commands

### Files parked in working tree (uncommitted)

```
A  .gitignore               (modified — entries appended)
A  index.html               (shell, 293 bytes)
A  package.json             (scripts + devDeps declared, NOT installed)
A  src/main.js              (placeholder)
A  vite.config.js
A  src/{core,ui,feel,data,services,styles/{components,screens}}/   (empty folders)
A  public/{images,audio,fonts}/                                    (empty folders)
A  tests/{smoke,visual/{baseline,current},unit}/                   (empty folders)
R  blocksworn_index_fixed.html → docs/_legacy/_archive_v1/blocksworn_index_fixed.html
```

These will be committed by Game Dev agent in a re-run once Node is available.

---

## CHANGELOG of project structure (this session)

- **2026-05-11:** Initial Setup performed. Created `docs/plan/`, `docs/agents/`, `docs/adr/`, `docs/design/`, `docs/_legacy/`. Copied CLAUDE.md, role instructions, Execution Plan. Created PLAN/TASKS/REPORT.md. Worktree: `claude/dreamy-bouman-f8e247`.

---

**Maintained by:** CTO agent
