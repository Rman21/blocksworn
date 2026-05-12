# Blocksworn — Master Plan

## Project Status

- **Current phase:** 1 — Foundation Reset (Vite + ES Modules migration)
- **Phase progress:** 12 / 20 done + T1.12 structural + T1.13.1/.2/.3 wire-up + asset pipeline
- **Overall progress:** ~68% (Phase 1 — bundle compliant; FTUE-layer wire-up gap remaining)
- **Bundle:** ✅ **4.5 MB total** (160KB JS + 368KB CSS + 3.4MB public/images files served separately) — UNDER AAA+ 5MB cap
- **Next milestone:** **T1.13.4** — extract remaining FTUE-layer dependencies (playDialogScript + dialog system, SQUAD_MAX) → then T1.13 main verify (Lighthouse + manual playthrough)
- **⚠️ Outstanding for T1.13:**
  - `playDialogScript` not defined → dialog system extraction needed
  - `SQUAD_MAX` legacy-only constant — needs named export
  - Cross-boundary deferrals (placePiece return, ~600 LoC dead hero code, getSquadMitigation ownership)
  - Future quality upgrade: re-import parent-dir PNG originals + re-capture baselines (currently using legacy JPEG-compressed `sips -Z 1024 q85`)
- **CI status:** ✅ ALL GREEN (PR #158, 6 iterations to fix Node/lockfile/vitest/threshold/visual)
- **T1.13 verdict:** **NO-GO for T1.14** — boot/shim/router work; renders empty (vRender* family + FTUE launcher wiring + mitigation extraction still needed). Lighthouse Performance 99/100 (AAA+ met); TTI 11s is empty-shell artifact.
- **Active sub-task:** T1.13.5 — close 4 runtime gaps before T1.14 cleanup can start
- **Last updated:** 2026-05-12 by CTO (after T1.13 verify)

> **Source of truth:** `docs/plan/00_EXECUTION_PLAN.md` (full 2700-line spec)
> **Working conventions:** `CLAUDE.md` (project root)
> **Sacred cows:** `CLAUDE.md` §2 — DO NOT MODIFY without Roman approval via ESC

---

## Phase 1: Foundation Reset

**Status:** IN_PROGRESS (started 2026-05-11)
**Goal:** Превратить 21MB single HTML в модульный, тестируемый Vite + ES Modules проект.
**Estimated:** 6-8 weeks
**Approach:** Strict sequential. One Dev task at a time. Test infrastructure FIRST.

### Deliverables (per Execution Plan §6.2)

- Вся кодовая база в Vite + ES Modules (`/src/...`)
- Smoke tests + visual regression baseline
- CI pipeline (build + test + visual diff)
- 0 артефакт-related кода в codebase
- 0 Cosmic Memorial dead code
- v2.1 incomplete items завершены (Mythic framework, Player Segments)
- Bundle size < 5MB (vs current 21MB)
- First load time < 3 сек (mid-tier mobile, 4G)

### Tasks (T1.01 — T1.20)

**Week 1: Infrastructure**
- [x] T1.01 — Setup Vite scaffold + new repository — **DONE 2026-05-11** (commits `c9cf50e`, `6c010ef`)
- [x] T1.02 — Create CLAUDE.md repository file — **DONE 2026-05-11** (verification only — copied in Initial Setup `41da1eb`)
- [x] T1.03 — Setup Playwright + smoke test infrastructure — **DONE 2026-05-11** (commits `8d79a61`, `8773ca6`, `ac9cedb`; chromium green; WebKit deferred to CI)
- [x] T1.04 — Capture visual regression baseline — **DONE 2026-05-11** (commits `2c08bb2`, `04e8456`; 22 baselines, 11M)
- [x] T1.05 — Setup CI pipeline — **DONE 2026-05-11** (commits `235941e`, `9464311`, `a7084a2` T1.05.1 fix, `527fa74`)
  - Visual flake fix: `freezeAnimations()` now pauses `<video>` elements (was: only CSS; real culprit was `#introVideoPlayer` autoplay, not rAF as initially hypothesized)
  - All 22 visual tests PASS under 2% threshold

**Week 2-3: Data + Services + CSS extraction**
- [x] T1.06 — Extract CSS into modular structure — **DONE 2026-05-11** (commits `2e097f4`, `f2c662f`; 19 CSS files, 368KB bundle, 179 @keyframes, all visual green)
- [x] T1.07 — Extract data constants into `src/data/` — **DONE 2026-05-11** (commits `c357124`, `a93435a`; 35 constants, sacred cows byte-perfect)
- [x] T1.08 — Extract services into `src/services/` — **DONE 2026-05-11** (commits `f6b67a4`, `694b5aa`; 6 modules + first unit tests + CI `unit` job)

**Week 4-5: Logic + UI extraction**
- [x] T1.09 — Extract feel layer (haptics, animations, particles, narrator) — **DONE 2026-05-11** (commits `8ed5679`, `39bc613`; 3 new modules + 7 functions; sacred timings 180/440/300/260/220/380/420ms all byte-perfect)
- [x] T1.10 — Extract core game logic to `src/core/` — ✅ **DONE 2026-05-11** (9/9 sub-tasks; **12,164 LoC across 9 modules**; sacred v2.1 P1+P2+P4 all preserved byte-perfect; migration shim landed for 9 bare-string keys)
- [x] T1.11 — Extract UI screens to `src/ui/` — **DONE 2026-05-11** (commits `e0fbb2c`, `f3ad6ef`; 10 modules / 3,021 LoC; onBossDefeated 545 LoC + 16 small ticks landed inline; 10 large ticks + Ch3 SM deferred to T1.11.1)
- [x] T1.11.1 — Land deferred archetype tick handlers + Ch3 state machine — **DONE 2026-05-11** (commits `ca6d351`, `943018e`; src/ui/archetype-ticks.js 2,007 LoC; 11 owners + helpers; battle-screen.js dispatcher cleaned of `/* global */` tick stubs)
- [x] T1.12 — Wire `src/main.js` entry point — **STRUCTURAL DONE 2026-05-11** (commits `b87a57e`, `4b9c790`; index.html 113 LoC scaffold + src/main.js 94 LoC boot + migration shim first-boot active; bundle 400KB; **functional wire-up of remaining `/* global */` → imports deferred to T1.13**)
- [ ] T1.13 — Verify game runs identically + visual regression pass — IN PROGRESS (**expanded scope:** flip remaining `/* global */` → ES imports in router/menu/etc. so heavy modules tree-shake correctly; manual playthrough; Lighthouse ≥90; bundle audit; cross-boundary deferrals; optional baseline re-capture against new shell)

**Week 4-5: Logic + UI extraction**
- [ ] T1.09 — Extract feel layer (haptics, animations, particles, narrator) — TODO
- [ ] T1.10 — Extract core game logic to `src/core/` — TODO
- [ ] T1.11 — Extract UI screens to `src/ui/` — TODO
- [ ] T1.12 — Wire `main.js` entry point — TODO
- [ ] T1.13 — Verify game runs identically + visual regression pass — TODO

**Week 6: Cleanup**
- [ ] T1.14 — DELETE artifact subsystem (v2.1 P1 §4 completion) — TODO
- [ ] T1.15 — DELETE Cosmic Memorial (v2.1 P5 §7 completion) — TODO
- [ ] T1.16 — DELETE legacy `--v-*` CSS tokens — TODO
- [ ] T1.17 — Replace 100-hearts UI in combat top bar — TODO
- [ ] T1.18 — Consolidate shop pack systems — TODO

**Week 7-8: Completion + hardening**
- [ ] T1.19 — Complete v2.1 Mythic ability framework — TODO
- [ ] T1.20 — Complete v2.1 Player Segments — TODO

### Phase 1 Gate Criteria (Go/No-Go to Phase 2)

- [ ] All smoke tests pass
- [ ] Visual regression ≤2% pixel diff на всех экранах
- [ ] Bundle size < 5MB
- [ ] First load < 3 сек на mid-tier mobile (Lighthouse)
- [ ] Zero `console.error` в production build
- [ ] `_legacy/` ready to delete (или удалён)
- [ ] `CLAUDE.md` создан и актуален
- [ ] CI passes на main branch 5 дней подряд

---

## Phase 2: Identity Layer

**Status:** NOT_STARTED
**Goal:** Реализовать mechanics × race/boss identity — per-race line-clear flavor + boss-reactive mechanics.
**Estimated:** 3-4 weeks
**Tasks:** T2.01 — T2.12 (defined в Execution Plan §14)

### High-level Tasks
- T2.01 — Identity Layer design doc (Designer)
- T2.02-T2.06 — Race line-clear flavors (Pirate / Shark / Rock / Crocodile / Spark)
- T2.07-T2.11 — Boss-reactive mechanics (Phoenix burn, Lich curse, etc.)
- T2.12 — Codex screen

### Gate Criteria
- Each race has distinct line-clear flavor
- Each chapter-finale boss has identity-driven reaction
- Codex screen renders all encountered races/bosses
- Performance: 60fps with 10+ identity-FX simultaneously

---

## Phase 3: Endgame Social

**Status:** NOT_STARTED
**Goal:** Competitive seasonal endgame — Adventures (async clan 5-15) + Party Tower (2-5 coop async) + share infrastructure.
**Estimated:** 5-6 weeks
**Tasks:** T3.01 — T3.15

### High-level Tasks
- T3.01-T3.05 — Adventures backend + create/join + weekly target + boss-of-week
- T3.06 — Friend leaderboard mini-block
- T3.07-T3.09 — Replay/Share infrastructure
- T3.10-T3.13 — Party Tower (async turn-based per ADR-002)
- T3.14 — Tower endless mode (post floor 50)
- T3.15 — Rotating seasonal modifiers

### Gate Criteria (per Execution Plan §8.5)
- Adventure CRUD + Friend Code join
- Weekly target functional
- Boss-of-week shared HP
- Party Tower 2-player session completes
- Replay auto-record + navigator.share

---

## Phase 4: Chia Integration

**Status:** NOT_STARTED
**Goal:** Chia blockchain as endgame layer — NFT heroes, on-chain achievements, wallet login. STRICT no-P2W.
**Estimated:** 6-8 weeks
**Tasks:** T4.01 — T4.12

### High-level Tasks
- T4.01 — Chia design doc finalization
- T4.02 — Testnet wallet integration (Sage / Chia Wallet)
- T4.03-T4.06 — NFT-hero mint/transfer/trading
- T4.07 — Adventure DAO (wallet-gated)
- T4.08 — PURE PATH CHAIN leaderboard
- T4.09 — Mobile feature flag (`isChiaEnabled()`)
- T4.10 — Anti-P2W audit
- T4.11 — Closed beta with crypto users
- T4.12 — Production launch sequence

### Gate Criteria (per Execution Plan §9.5)
- Chia testnet integration works
- NFT mint/transfer tested
- Anti-P2W audit passes (statistical parity)
- 100+ crypto user closed beta complete
- Mobile builds with `CHIA_ENABLED=false` work

---

## Tech Debt Backlog (outside current phase scope)

Captured here; raised to priority по решению Roman.

- (none yet)

---

## Sequencing principles

- **Phase 1:** STRICT sequential. One Dev task at a time. No parallel feature work.
- **Phase 2-4:** Phase-locked pipeline. Designer работает на N+1 пока Dev делает N.
- **Bug Tester:** invoked at phase gates + after major refactors (T1.10, T1.13, T1.18, T1.20).
- **Sacred cow change:** ALWAYS ESC to Roman (CLAUDE.md §2.7).

---

**Maintained by:** CTO agent
**Updates:** After every task DONE, after every phase gate
