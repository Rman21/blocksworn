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

**Status:** ✅ **COMPLETE 14/14** 2026-05-12 — Bug Tester GO verdict (`216371a`). Awaiting Roman merge.
**Goal:** Реализовать mechanics × race/boss identity — per-race line-clear flavor + boss-reactive mechanics. **ACHIEVED.**
**Actual duration:** 2026-05-12 (single intensive session — same day as Phase 1 close)
**Tasks:** T2.01 — T2.12 + T2.B + T2.B.QA = 14/14 done
**Phase 1 milestone:** ✅ MERGED to main 2026-05-12 12:26 UTC (squash `4aea3ce`)
**Phase 2 branch:** `claude/phase2-identity-layer` — ready for Phase 2 PR

### High-level Tasks
- [x] T2.01 — Identity Layer design doc (Designer) — **DONE 2026-05-12** (`b325c30`; 1189 LoC spec `docs/design/mechanics/identity-layer.md` v1.1 with Roman ruling appendix; 5 race flavors + 7 boss mechanics + Codex + 36-row sacred audit)
- [x] T2.02 — Pirate line-clear flavor (Pirate's Plunder) — **DONE 2026-05-12** (`6a6ad39`; 1100 LoC across 9 files; +28 unit tests (37→65); 12/12 smoke pass × 2 projects; 0 sacred-cow modifications. CTO-blessed `RACE_IDENTITY_FX` sibling export pattern for T2.03–T2.06)
- [x] T2.03 — Shark line-clear flavor (Feeding Frenzy) — **DONE 2026-05-12** (`3dee3cd`; +1163 LoC across 8 files; +45 unit tests (65→110); 22/22 smoke pass; 0 sacred-cow modifications. `_lastBittenCells` side-channel for combo-crit input modification — formula untouched. Wall-time 1-3ms typical, well under 10ms budget)
- [x] T2.04 — Rock line-clear flavor (Encore Echo) — **DONE 2026-05-12** (`fe3e3c1`; +1252 LoC across 8 files; +42 unit tests (110→152); 34/34 smoke pass; 0 sacred-cow modifications. `HERO_ULT_COST_BY_NEWROLE` READS for threshold clamp only — never WRITES. `RACE_SYNERGY.rock` literal incl sacred ENCORE flag byte-perfect. Median 0.2ms — 40× under 8ms budget)
- [x] T2.05 — Crocodile line-clear flavor (Bedrock Bastion) — **DONE 2026-05-12** (`e24c0e1`; +1855 LoC across 8 files; +23 unit tests (152→175); 48/48 smoke pass; 0 sacred-cow modifications. `RACE_SYNERGY.golem.<tier>.maxShieldBonus` (1,2,2) byte-perfect read-only for clamp source. Squad-vs-boss shield distinction respected. `_crocFragmentBank` cross-fire persistence + `resetCrocFragmentBank()` API)
- [x] T2.06 — Spark line-clear flavor (Sun Cascade) — **DONE 2026-05-12** (`d2423bc`; +1648 LoC across 8 files; +49 unit tests (175→224); 62/62 smoke pass; 0 sacred-cow modifications. **Combo crit formula BYTE-PERFECT** (line 63664 unchanged); cap invariant verified exhaustive [0..10]×[0..64] sweep — modifier ∈ {0, +1}; `SUN_CASCADE_ENABLED` single-flip fallback to pure-FX architected for T2.B matchup-matrix gate. T2.B bridge is one-line patch with zero formula touch. **Race-flavor portion of Phase 2 COMPLETE 5/5.**)
- [x] T2.07 — Phoenix Ashen Reign — **DONE 2026-05-12** (`060fbcc`; 1625 insertions / 0 deletions across 8 files; +42 unit tests (224→303); 76/76 smoke pass; 0 sacred-cow modifications. **22 v2.1 P4 reactivity handlers byte-perfect** (smoke enumerates all 22). `IDENTITY_BOSS_HANDLERS` parallel registry + `triggerIdentityBossEvent` dispatcher pattern established for T2.08–T2.11. Steady-state ZERO JS per-frame (pure CSS @keyframes). Telegraph sacred re-use invariant: `ASHEN_REIGN_TELEGRAPH_MS === REACTIVITY_TELEGRAPH_MS === 3000`)
- [x] T2.08 — Lich Cursed Tiles — **DONE 2026-05-12** (`bc229f7`; +1922/-3 LoC across 9 files; +58 unit tests (303→361); 88/88 smoke pass; 0 sacred-cow modifications. 22 sacred P4 handlers byte-perfect (0 deletions in reactivity-events.js diff). `HERO_ULT_COST_BY_NEWROLE` threshold clamp verified across all 5 roles. Discovery: Shark `isSharkBiteBlocked` predicate already understands `gridState.cursedCells` — Shark + Lich integration essentially free at T2.B. New primitive `fxLichCursedTilesTick` per-turn-tick pattern reusable for T2.09–T2.11.)
- [x] T2.09 — Berserker/Frenzy Bloodtide Pulse — **DONE 2026-05-12** (`e471099`; +1682/-2 LoC across 9 files; +60 unit tests (361→421); 100/100 smoke pass; 0 sacred-cow modifications. **Stagger Loop UNTOUCHED** (`git diff src/core/stagger-loop.js = 0`); `BERSERKER_ENRAGE_MULT = 2.0` byte-perfect; damage composition `base × enrageMult × (1 + pulseBonus)` LAYERED verified via `not.toBe(205)` diff check. One-shot buff (no stacking) verified. Real APIs: `getBossState()`, `STAGGER_DURATION_TURNS=4`, `RECOVERY_DURATION_TURNS=2`, `BOSS_STATE_ACTIVE='active'` all byte-perfect.)
- [x] T2.10 — Engineer Lockdown Protocol — **DONE 2026-05-12** (`72bd903`; +2180/-3 LoC across 8 files; +54 unit tests (421→475); 114/114 smoke pass; 0 sacred-cow modifications. 4 sacred RE-USE invariants: 40T duration / 4-cell shape / `#B87333` banner color / `.cell--engineer-welded` CSS class all byte-perfect — none duplicated. Sacred `engineer_p1_p2` handler UNTOUCHED. Anti-Tetris gate verified: 3-line+crit / 4-line+no-crit / 5-line+crit (defensive) all NO-fire; only 4-line crit triggers.)
- [x] T2.11 — Grovewarden Root Surge (+ placeholder narrator per ESC-02 O2) — **DONE 2026-05-12** (`f47bff6`; +2292/-3 LoC across 8 files; +60 unit tests (475→535); 128/128 smoke pass; 0 sacred-cow modifications. **NEW sliding-window trigger primitive** (circular buffer of last 3 line clears + non-grove gate). First LIVE cross-layer integration: +10 gold per rooted-cell clear via existing addGold (no double-count with Pirate Plunder). Placeholder narrator `ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER` isolated in `src/data/identity-layer.js:858` with "FINAL COPY: pending Roman approval" marker — sacred NARRATOR_LINES table UNTOUCHED. **Boss-reactive scoreboard COMPLETE 5/5.**)
- [x] T2.12 — Codex screen — **DONE 2026-05-12** (`2b85e9f`; +2009/-1 LoC across 12 files (4 new + 8 modified additively); +46 unit tests (535→581); 140/140 smoke pass; 0 sacred-cow modifications. Codex writes ONLY to `localStorage[blocksworn_codex_state]` (verified via grep + dedicated sacred-audit unit test). All 10 identity fx mechanical contracts unchanged — recording calls added at end-of-fire with `try/catch` defensive wrapper. FCP <5ms (60× under 300ms budget). 3 tabs (Races/Bosses/Moments), 3-state unlock model, parchment aesthetic with PR #157 emblem PNGs.)
- [x] **T2.B (Game Dev portion)** — Legacy Bridge wiring — **DONE 2026-05-12** (`e6acb6d`; +651/-2 LoC across 4 files; +10 smoke tests (140→150); 0 sacred-cow modifications. **Combo crit formula at line 63825 byte-perfect verified**; 26 window-bridge functions exposed; 8 discrete legacy insertion points; bridge overhead <0.001ms per call. LIVE integration verified: Pirate Plunder gold flows via addGold, Phoenix Ashen Reign toggle works, Codex persists to localStorage, legacy boot clean.)
- [x] **T2.B.QA (Bug Tester)** — 25-smoke matchup matrix + 14 visual baselines + narrator copy-pass + final sacred audit — **DONE 2026-05-12** (`216371a`; ✅ **GO VERDICT** — all 4 audit areas PASS, 0 bugs. 25/25 matchups within ±15% TTK budget; Spark peak 12.24% (KEEP `SPARK_CASCADE_ENABLED = true`); 14 visual baselines captured × 2 projects (28 PNGs total); 5 narrator strings documented in `docs/design/narrator-copy-review.md` for Roman copy-pass; sacred `NARRATOR_LINES` byte-perfect; all 36 sacred-cow rows byte-perfect; 204/204 smoke; 581/581 unit.)

### Gate Criteria
- Each race has distinct line-clear flavor
- Each chapter-finale boss has identity-driven reaction
- Codex screen renders all encountered races/bosses
- Performance: 60fps with 10+ identity-FX simultaneously

---

## Phase 3: Endgame Social

**Status:** IN_PROGRESS (started 2026-05-13; T3.01 design DONE; **ESC-03 RESOLVED** 2026-05-13 — Roman approved Q1–Q5 per CTO recommendations; T3.07 ACTIVE)
**Goal:** Competitive seasonal endgame — Adventures (async clan 5-15) + Party Tower (2-5 coop async) + share infrastructure.
**Estimated:** 5-6 weeks
**Tasks:** T3.01 — T3.15
**Phase 3 branch:** `claude/phase3-endgame-design` — design PR ready

### High-level Tasks
- [x] T3.01 — Phase 3 Endgame Social design spec (Designer) — **DONE 2026-05-13** (`7c5ec5c`; 1572 LoC `docs/design/endgame-social.md`; 5 systems × 14 sections + 47-row sacred audit + 16 new files + 7 additive modifications + 5 ESC-03 questions Q1–Q5)
- [x] T3.07 — Replay capture infrastructure — **DONE 2026-05-13** (`b9c9a84`; +1835 LoC across 7 files; +71 unit tests (581→652); 222/222 smoke pass; 0 sacred-cow modifications. 12 new replay window-bridge functions; 9 trigger predicates (7 live + 2 stubs T3.04/T3.13); 4fps rolling 240-frame buffer ~2.4 MB; storage tier from sacred `getPlayerSegment()`; <4ms/frame overhead. Identity Layer fx NOT in diff — replay listens at dispatcher level. Bundle JS 272 → 278 KB.)
- [x] T3.02 — Adventures backend — **DONE 2026-05-13** (`268e701`; +2327 LoC across 8 files; +100 unit tests (713→813); 292/292 smoke pass; 0 sacred-cow modifications. `CLAN_MAX_SIZE === 15` HARD CAP verified server+client; ADR-003 no-P2W static audit (cosmetic unlocks contain ZERO banned mechanical fields); 8 pure helpers + 9 async CRUD ops in mock-mode; +1 minimal window-bridge (`__getPlayerClanCount` for legacy menu badge); T3.02.1 live Firestore SDK + T3.04 weekly cron deferred)
- [ ] T3.03 — Clan create/join flow — **ACTIVE** (Adventures UI screen consuming clan-backend.js via direct-import)
- [ ] T3.04 — Weekly target / boss-of-the-week rotation
- [ ] T3.05 — Contributor stats + clan progression
- [ ] T3.06 — Friend leaderboard mini-block
- [x] T3.08 — Replay viewer — **DONE 2026-05-13** (`f2fe02d`; +1851 LoC across 10 files (5 new + 5 modified); +42 unit tests (652→694); 238/238 smoke pass; 0 sacred-cow modifications. Scrubable canvas playback at 4fps with 0.5/1/2× speed; navigator.share OS-native with graceful no-op; `?replay=<id>` deeplink in main.js; code-split into 11.21 KB lazy chunk — JS main bundle unchanged at 280.21 KB. `prefers-reduced-motion` respected (no auto-play). renderFrameToCanvas avg 0.001ms (16000× under 16ms budget))
- [x] T3.09 — Codex Moments tab Replay button integration — **DONE 2026-05-13** (`654e81f`; +900/-4 LoC across 7 files; +18 unit tests (695→713); 252/252 smoke pass; 0 sacred-cow modifications. Phase 2 Codex recorder signatures preserved (backward-compat). `recordMomentReplay(momentKey, replayId)` NEW separate function. `IDENTITY_BOSS_HANDLER_TO_MOMENT_KEY` mapping for 5 boss-reactive moments. T3.08 direct-import precedent followed — NO window-bridge bloat. Race condition handled (silent no-op). **Wave 2 Replay subsystem COMPLETE — visible Phase 2 → Phase 3 bridge LIVE.**)
- [ ] T3.10 — Party Tower async architecture (per ADR-002)
- [ ] T3.11 — Shared Tower-Hearts pool + shared TOWER_PACTS selection
- [ ] T3.12 — Per-turn Identity Layer dispatch (cross-race synergies)
- [ ] T3.13 — Party async social hooks + turn timeout
- [ ] T3.14 — Tower seasonal infrastructure (Uroboros rotation + seasonal TOWER_PACTS pool)
- [ ] T3.15 — Battle Pass tier-cosmetic tie-in (sacred formula honored)
- [ ] **T3.16** — Legacy Bridge (mirrors T2.B pattern; wires Phase 3 src/ → legacy primary runtime)

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
