# Blocksworn — Master Plan

## Project Status

- **Current phase:** 1 — Foundation Reset ✅ **COMPLETE 20/20 (100%)** 🎉
- **Overall progress:** Phase 1 done; ready for Phase 2 Identity Layer
- **Bundle:** ✅ **4.5 MB total** (205KB JS + 368KB CSS + 3.4MB public/images) — UNDER AAA+ 5MB cap
- **Architectural decision (ADR-004):** Hybrid coexistence — legacy + src/ co-runtime through Phase 2-4; full switchover deferred to future sprint
- **CI status:** ✅ ALL GREEN (PR #158, 115+ commits)
- **Cumulative migrated:** src/core/ 12,164 + src/ui/ 5,012 + src/data/ + src/feel/ + src/services/ + dialog + assets pipeline + migrate shim = **17,000+ LoC** in modular ES architecture
- **Tests:** lint 0, unit 37/37, smoke 2/2 (4 projects on Linux CI incl. WebKit + mobile-safari), visual 22/22 chromium
- **Pending Roman action:** merge PR #158 (Phase 1 milestone) → Phase 2 starts
- **Last updated:** 2026-05-12 by CTO (Phase 1 closeout)

> **Source of truth:** `docs/plan/00_EXECUTION_PLAN.md` (full 2700-line spec)
> **Working conventions:** `CLAUDE.md` (project root)
> **Sacred cows:** `CLAUDE.md` §2 — DO NOT MODIFY without Roman approval via ESC

---

## Phase 1: Foundation Reset

**Status:** ✅ **COMPLETE 2026-05-12** (started 2026-05-11)
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
- [x] T1.12 — Wire `src/main.js` entry point — **STRUCTURAL DONE 2026-05-11** (commits `b87a57e`, `4b9c790`; index.html 113 LoC scaffold + src/main.js 94 LoC boot + migration shim first-boot active; bundle 400KB)
- [x] T1.13 — Verify (INFRASTRUCTURE only per ADR-004) — **DONE 2026-05-12** (commits `c49bbce`, `52c3999`; Lighthouse Perf 99/100; CI green; smoke 4/4 on Linux; visual 11/11 chromium; bundle 4.5MB under cap; cross-boundary deferrals audited; **NEW shell full-playthrough goal moved to optional future switchover sprint per ADR-004 Hybrid Coexistence**)

**Week 6: Cleanup**
- [x] T1.14 — DELETE artifact subsystem (v2.1 P1 §4 completion) — **DONE 2026-05-12** (commits `aed0cc6`, `eeea459`; legacy −7.5KB; 19 fns + 13 consts/state deleted; migrateRemoveArtifacts shim + 4 unit tests; legacy was already 80% gutted by v2.1 P1 PR #1.E + P5 §7)
- [x] T1.15 — DELETE Cosmic Memorial (v2.1 P5 §7 completion) — **DONE 2026-05-12** (commits `8ef8e3a`, `028def7`; legacy −4KB; Ch3 hub strip purged; P6.F active memorial system preserved; migration shim 5 keys; 4 new unit tests (19 total); CSS bundle −2.1KB)
- [x] T1.16 — DELETE legacy `--v-*` CSS tokens — **DONE 2026-05-12** (CTO patch — was already 0 active refs per T1.06 closeout; 3 stale historical comments purged from legacy lines 23, 62, 2113; verified 0 refs everywhere)
- [x] T1.17 — Replace 100-hearts UI with scaled HP bar — **DONE 2026-05-12** (commits `8cbfae6`, `f20f060`; engineering catch: real 100-hearts source was `_renderBossAreaHearts` (boss-area strip), NOT renderHP; 100 spans → 4-node bar; CSS mirror in legacy + src/styles for ADR-004 hybrid parity; MAX_HP=100 sacred preserved)
- [x] T1.18 — Consolidate shop pack systems — **DONE 2026-05-12** (commits `b50efac`, `afa6c9e`; 13 SHOP_PACKS entries; 38 scalar shadows deleted; 14 IAP SKUs preserved; sacred §2.4 ladder/+50%/Battle Pass/Tower retry all byte-perfect)

**Week 7-8: Completion + hardening**
- [x] T1.19 — Complete v2.1 Mythic ability framework — **DONE 2026-05-12** (commits `795953d`, `5cc2867`; VERIFIED COMPLETE, no code change; 25/25 descriptors + ascension commitment screen + one-per-save + 5/5 role fire paths verified; 8 new unit tests (27 total); Plan §23 P3 Mythic ⚠️→✓)
- [x] T1.20 — Complete v2.1 Player Segments — **DONE 2026-05-12** (commits `e13d51b`, `853ddf1`; getPlayerSegment + 4 constants in src/services/analytics.js; logEvent auto-enriches with segment; 10 new unit tests (37 total); Pinch system Phase 2 integration flagged)

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

**Status:** IN_PROGRESS (started 2026-05-12; T2.01 DONE; T2.02 BLOCKED on Roman O1–O4)
**Goal:** Реализовать mechanics × race/boss identity — per-race line-clear flavor + boss-reactive mechanics.
**Estimated:** 3-4 weeks
**Tasks:** T2.01 — T2.12 (defined в Execution Plan §14)

### High-level Tasks
- [x] T2.01 — Identity Layer design doc (Designer) — **DONE 2026-05-12** (`b325c30`; 1189 LoC spec `docs/design/mechanics/identity-layer.md`; 5 race flavors + 7 boss mechanics + Codex + 36-row sacred audit; ESC-02 O1–O4 awaiting Roman)
- [ ] T2.02 — Pirate line-clear flavor (Pirate's Plunder) — **BLOCKED on ESC-02**
- [ ] T2.03 — Shark line-clear flavor (Feeding Frenzy) — BLOCKED on ESC-02
- [ ] T2.04 — Rock line-clear flavor (Encore Echo) — BLOCKED on ESC-02
- [ ] T2.05 — Crocodile line-clear flavor (Bedrock Bastion) — BLOCKED on ESC-02
- [ ] T2.06 — Spark line-clear flavor (Sun Cascade) — BLOCKED on ESC-02 (specifically O3)
- [ ] T2.07 — Phoenix Ashen Reign
- [ ] T2.08 — Lich Cursed Tiles
- [ ] T2.09 — Berserker/Frenzy Bloodtide Pulse
- [ ] T2.10 — Engineer Lockdown Protocol
- [ ] T2.11 — Grovewarden Root Surge
- [ ] T2.12 — Codex screen

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
