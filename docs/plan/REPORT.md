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
