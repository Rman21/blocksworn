# Blocksworn — Risk Register & Technical Debt

**Date:** 2026-05-14
**Audience:** Director + future engineering owner

Each risk: rated by likelihood × impact, with current mitigation status and decision point if any.

---

## High-impact risks (need director attention)

### R1 — Phase 2-4 features invisible to users
- **Likelihood:** Certain (current state)
- **Impact:** High — 3 months of development in main but not user-visible
- **Status (2026-05-16):** ADDRESSED BY PLAN. Roman decision = Option C+ (Full Vite Migration). Phase 5 Weeks 1-5 retire ADR-004 hybrid + make Phase 2-4 features user-visible at Gate 3.
- **Residual risk:** that Phase 5 slips past 5-week timeline (see R19, R22). Original R1 closes at Phase 5 Gate 3.

### R2 — 21 MB legacy single-HTML as primary runtime (per ADR-004)
- **Likelihood:** Current architectural reality
- **Impact:** Medium — large initial download (~4 MB gzipped), single point of failure for any legacy-side bug
- **Status (2026-05-16):** ADDRESSED BY PLAN. ADR-005 supersedes ADR-004 at Phase 5 Gate 3. Migrated build projected at ~94 KB gzipped (50× reduction in initial JS+CSS download; audio remains separately on CDN via R5 plan).
- **Residual risk:** migration introduces TTI regression vs legacy if assets accidentally inline-bundled (see R20).

### R3 — Chia integration (Phase 4) operationally unproven at scale
- **Likelihood:** Medium — code is unit-tested, but no real testnet wallet integration has been live-tested
- **Impact:** High if mishandled — wallet integration touches real money flows even on testnet, and ADR-003 no-P2W invariant must hold under real player behaviour
- **Status (2026-05-16):** PLAN UPDATED. Per Roman Decision 2: Chia operational provisioning **deferred until after Phase 5 Gate 3**. T4.11 closed beta runs Weeks 9-12 with anti-P2W audit on REAL data (not synthetic). T4.12 production launch Week 13.
- **Mitigation:**
  - 393 Phase 4 unit tests cover the contracts
  - ADR-003 enforced via T4.10 statistical parity audit
  - T4.11 hard-gate (100+ real testers, 4 weeks) before T4.12 launch
  - Engineering lead operationally responsible per Roman Decision 3

### R4 — No named human engineering owner
- **Likelihood:** Active risk
- **Impact:** Medium-high — session-to-session drift, no on-call coverage, no PR review discipline
- **Status (2026-05-16):** ADDRESSED BY PLAN. Roman Decision 3 = hire part-time engineering lead (Option 3B; 10-20 hrs/week × $50-80/hr; senior JavaScript/Vite/production-incident experience).
- **Residual risk:** hiring delay past end of Phase 5 Week 2 → see R20.

---

## Medium-impact risks

### R5 — 84 MB audio in repo (4 MB gzipped over the wire)
- **Likelihood:** Operational, manageable
- **Impact:** Low immediate (Vercel free tier handles), Medium long-term (slow first-load on mobile, repo bloat in git)
- **Mitigation:** Migrate audio to CDN (Cloudflare R2, Cloudinary, S3+CloudFront). Estimated ~half-day work.
- **Tracker:** flagged as tech debt in PR #180 commit message

### R6 — Sentry DSN not configured → silent error swallowing in production
- **Likelihood:** Current state
- **Impact:** Medium — any production crash today is invisible to ops
- **Mitigation:** add Sentry DSN as Vercel environment variable. Done by Roman in <5 min.
- **Tracker:** Listed as Roman action in `02_PRODUCTION_TOPOLOGY.md` Section 8

### R7 — Vercel deploy protection prevents `*.vercel.app` direct access
- **Likelihood:** Current state — `ssoProtection: all_except_custom_domains`
- **Impact:** Low — by design; users get the custom domain. Preview URLs require Vercel auth.
- **Mitigation:** correct settings already in place

### R8 — No formal staging environment
- **Likelihood:** Current state
- **Impact:** Medium — every merge to main goes to production directly. PR previews exist via Vercel but they share the same `blocksworn-game` project's Deployment Protection.
- **Mitigation:** Create a `beta.blocksworm.com` Vercel domain alias for the closed-beta cohort (T4.11 will require this anyway).
- **Tracker:** T4.11 closed beta runbook

### R9 — CI bundle-size gate exempted media (intentional but easy to drift)
- **Likelihood:** Low
- **Impact:** Low — JS+CSS bundle gate still enforced at 5 MB
- **Mitigation:** CI YAML comments document the rationale. Periodic audit recommended.

### R10 — DNS for `blocksworm.com` is on Namecheap BasicDNS (single-vendor)
- **Likelihood:** Low (Namecheap is reliable)
- **Impact:** Medium — outage of Namecheap DNS = entire game offline
- **Mitigation:** could migrate to Cloudflare DNS (free) for better resiliency + analytics. Estimated 30 min.
- **Tracker:** flagged as future optional improvement

### R11 — Save-version migration is one-shot wipe (no soft-migration)
- **Likelihood:** Will recur when game balance overhauls
- **Impact:** Medium — every player loses their save when SAVE_VERSION is bumped
- **Mitigation:** none short-term; pre-launch this is intentional. Post-launch, a migration framework (write per-version transformations) is needed.

---

## Lower-impact risks

### R12 — `_legacy/` directory size (21 MB single HTML) makes git operations slow
- **Likelihood:** Operational
- **Impact:** Low — clones take longer, branch switches noticeable
- **Mitigation:** none short-term; intrinsic to the legacy reference. Full migration (R2) removes it.

### R13 — RevenueCat placeholder API keys; IAP currently mock
- **Likelihood:** Current state
- **Impact:** Low until launch; High at launch
- **Mitigation:** add real RevenueCat keys at T4.11 setup
- **Tracker:** `02_PRODUCTION_TOPOLOGY.md` Section 8

### R14 — Firebase auth + Firestore not wired for live multiplayer (Adventures, Party Tower)
- **Likelihood:** Required for Phase 3 live UI
- **Impact:** High for Phase 3 features specifically
- **Mitigation:** Phase 3 backends ship with stub-mode (`{ok:false, reason:'no-sdk'}` graceful degradation); live wiring is T4.11 work
- **Tracker:** Phase 3 backend modules document the contract

### R15 — Sage Wallet SDK currently stubbed; live SDK at T4.12
- **Likelihood:** Required for Phase 4 live UI
- **Impact:** High for Phase 4 features specifically
- **Mitigation:** stub-mode in place via `_setSageBehaviorForTest`; live SDK calls have TODO(T4.12) markers
- **Tracker:** Phase 4 wallet-connect.js documents the swap-out points

### R16 — No load testing has been done
- **Likelihood:** Will need before mass launch
- **Impact:** Unknown until measured
- **Mitigation:** k6 or Artillery load test at T4.11 beta milestone

### R17 — Localization is English-only
- **Likelihood:** Design decision per project memory (no i18n)
- **Impact:** Low for V1; Medium for international expansion
- **Mitigation:** explicit ruling — no localization. Future XL sprint.

### R18 — One-off transform scripts in `scripts/_hotfix-*.js`
- **Likelihood:** Already cleaned up; both `_hotfix-*` scripts deleted in their respective PRs
- **Impact:** None now
- **Mitigation:** the inject-legacy-fixes.js remains as a permanent build step

---

## Phase 5 plan-derived risks (added 2026-05-16)

### R19 — Save migration data loss during Phase 5 cutover
- **Likelihood:** Medium without framework, Low with framework + 10+ snapshot test
- **Impact:** Critical for any post-launch player — losing saves to a migration is reputational damage proportional to active player count
- **Mitigation:**
  - Phase 5 Week 1 TASK-067 builds save migration framework with reversibility (legacy v2 snapshot stored alongside modular state)
  - 10+ real save snapshots harvested + round-trip tested before Gate 1
  - Gate 1 blocks migration sprint start until framework verified
  - Phase 5 Week 5 cutover has `v1.blocksworm.com` 1-week safety net for full rollback
- **Status:** active risk through Phase 5 Gate 3; closes at Gate 3 + 7 days of safety-net unused

### R20 — Engineering lead hiring delay
- **Likelihood:** Medium — senior JavaScript + Vite + production-incident-response is a specific profile; typical hiring window 2-4 weeks
- **Impact:** Medium — Phase 5 Week 1 can run with CTO solo (golden-path tests + save framework do not require human gate yet). Week 2+ ideally has engineering lead onboarded for PR review. If slipped past Week 2, ADR-005 §Compliance §4 specifies decision: extend Week 1 OR accept reduced gate (NOT recommended).
- **Mitigation:**
  - Roman starts hiring immediately (Decision 3 finalized 2026-05-16)
  - Onboarding materials prepared in `docs/reports/` (6 files) + ADR-001..005
  - Engineering lead reads + signs off Gate 1 alongside CTO
- **Status:** active through Phase 5 Week 2; closes when lead is onboarded
- **Decision point:** if hire slips, Roman + CTO must explicitly agree on bridge strategy before Week 2 ends

### R21 — Parallel UI/UX Designer workstream collides with migration
- **Likelihood:** Low if separation honored (Designer = Figma only, Engineering lead = code)
- **Impact:** Medium if Designer's specs land in repo during Weeks 2-5 migration sprint — would force merge conflicts + competing focus
- **Mitigation:**
  - PLAN.md §Phase 5 explicitly sequences: Designer audit Weeks 2-3, spec implementation Weeks 6-8 (post-migration)
  - Designer's deliverables are Figma files + written specs, NOT code commits, during Weeks 2-5
  - Engineering lead integrates Designer's polish into migrated codebase Weeks 6-8 as separate sprint
- **Status:** active through Phase 5 Week 5; closes at Week 6 sprint kickoff
- **Watchpoint:** if Designer requests "small CSS tweak" during Weeks 2-5, engineering lead must REFUSE and defer to Week 6+ batch

### R22 — Phase 5 migration sprint scope creep
- **Likelihood:** Medium — migration projects historically creep ("while we're here, let's also...")
- **Impact:** Medium-high if Week 2-3 extends past Week 4 → cascades into staging soak compression OR cutover risk
- **Mitigation:**
  - ADR-005 §Out-of-scope explicitly lists what does NOT belong in Phase 5 migration (audio CDN, T4.07 live wire-up, T4.12 mainnet, mobile build path) — all named alternative homes
  - Engineering lead's job description includes "scope discipline"; PR review gate enforces ADR-005 §Compliance
  - Gate 2 (72h staging soak) creates natural pressure to ship Week 2-3 work cleanly
- **Status:** active through Phase 5 Gate 2; closes at Gate 2 pass

### R23 — Gate 2 staging soak reveals unexpected defects blocking Week 5 cutover
- **Likelihood:** Medium — first time Phase 2-4 features run integrated; integration surface untested at this scale until now
- **Impact:** Medium — pushes cutover from Week 5 to Week 6+; cascades T4.11 closed beta start from Week 9 to later. Does not endanger T4.12 launch quality; only schedule.
- **Mitigation:**
  - Bug Tester runs integration-level cycle during Week 4 staging soak (not just smoke + visual)
  - Defect triage at Gate 2 review: BLOCKER count = 0 MUST hold; CRITICAL = 0 MUST hold; MAJOR ≤ 2 with remediation plan acceptable
  - If Gate 2 fails, fallback is Option D (strangler-fig over additional weeks) per ADR-005 §Alternatives
- **Status:** active during Phase 5 Week 4; closes at Gate 2 pass

---

## UI/UX Polish workstream risks (added 2026-05-16, per Polish Strategy §11)

### R24 — UI/UX Designer scope creep beyond Tier S+A
- **Likelihood:** High — designers naturally want to polish everything
- **Impact:** Medium — pushes Tier S+A delivery past Week 7, jeopardizes Week 8 device matrix QA, cascades into beta delay
- **Mitigation:**
  - Polish Strategy §4 enumerates strict Tier S (10 items) / Tier A (7 items) / Tier B (5 items deferred post-launch) / Tier C (4 items Chia)
  - TASK-UX-009 + TASK-UX-010 are pre-marked DEFERRED so scope-creep tasks land there, not in active sprint
  - CTO is gatekeeper for any Tier S+A→Tier B promotions during sprint; declines by default
  - Week 5 mid-sprint review: if Tier S not 70%+ complete, Tier A items defer to post-beta
- **Status:** active Weeks 2-8

### R25 — Visual specs conflict with sacred timings
- **Likelihood:** Low (Designer briefed on sacred cows Day 1 per TASK-UX-001) but non-zero
- **Impact:** High if missed — modifying 180ms crit flash or 440ms shake or V_HAPTICS table breaks combat feel
- **Mitigation:**
  - `docs/design/ui-ux/README.md` §3 enumerates every sacred timing
  - CTO reviews every Tier S spec for timing conflicts before Engineering Lead implements
  - Designer-vs-sacred-cow conflict → ESC-NN to Roman, never silent workaround
  - Animations on NEW UI surfaces (healthbar, damage numbers, pressure meter, CTAs) are Designer's domain; animations on EXISTING sacred surfaces are off-limits
- **Status:** active Weeks 2-8

### R26 — Hero portraits + art direction needed but out of scope for budget
- **Likelihood:** High — Tier A #16 lists hero portraits; raw art at `/Users/rm/Downloads/game/` may NOT match code roster (per TASK-UX-002 audit findings)
- **Impact:** High — placeholder hero cards in beta is a visible AAA+ gap
- **Mitigation:**
  - TASK-UX-002 art library audit Week 2 determines what's usable vs needs creation
  - Roman decision point Week 2 end: (a) keep placeholders for beta + commission art post-beta, (b) extend Designer budget for art direction + commission illustrator, (c) defer Tier A #16 to Tier B post-launch
  - Existing `Game bosses/`, `boss/`, `new boss/` folders audited first — bosses are more impactful than heroes for first impression
- **Status:** active Week 2-3; Roman decision required by end of Week 3

### R27 — Designer/Dev miscommunication despite CTO gatekeeper
- **Likelihood:** Medium — async handoffs through Figma + docs can lose nuance
- **Impact:** Medium — implementation diverges from spec; iteration rounds increase; Week 6-7 implementation slips
- **Mitigation:**
  - Polish Strategy §8.2 explicit communication path: Designer → CTO → Eng Lead → Dev; no direct Designer↔Dev
  - All handoffs include Figma link + Markdown spec doc + asset manifest entry
  - Implementation screenshots reviewed within 24h by Designer (TASK-UX-007 budget covers)
  - Weekly 30-min sync call catches drift early
- **Status:** active Weeks 6-7

### R28 — Performance regression from polish work
- **Likelihood:** Medium — adding Lottie animations + animated SVG icons + damage number float-up can compound
- **Impact:** High — dropping below 60fps on mid-tier mobile (iPhone SE, Samsung S22) breaks AAA+ feel claim
- **Mitigation:**
  - Per-component performance budget enforced in TASK-UX-006: each Lottie ≤16ms/frame; SVG ≤2 KB gz each; total bundle bloat ≤+200 KB gz
  - Bug Tester Week 8 device matrix verifies 60fps maintained per Polish Strategy §10.2
  - Engineering Lead spot-checks frame timing during Weeks 6-7 implementation; reports regression to CTO immediately
  - Fallback for low-end devices: `prefers-reduced-motion` already respected in Phase 2-3 code (e.g., replay viewer); extend pattern to new animations
- **Status:** active Weeks 6-8

---

## Combat Polish workstream risks (added 2026-05-16 per combat-polish-implementation-plan.md activation)

### R29 — Element background assets do not exist in disclosed library
- **Original status:** Confirmed gap in `/Users/rm/Downloads/game/` library (verified via `find` 2026-05-16)
- **Resolution 2026-05-16:** Roman disclosed `/Users/rm/Downloads/game file/assets/backgrounds/` with all 5 element backgrounds pre-commissioned. Verified: 941×1672 portrait (≈9:16), 1.39-1.46 MB each (within plan §3 ≤1.5 MB/element cap), 7.13 MB total (within ≤7.5 MB cap). Filename normalization (space→underscore) happens in TASK-CP-001 bundling step.
- **Status:** ✅ **CLOSED 2026-05-16**

### R30 — Combat Polish workstream slips if Phase 5 Gate 3 (migration cutover) slips
- **Likelihood:** Medium — migration sprints historically encounter unexpected complexity
- **Impact:** Medium-high — Combat Polish Weeks 6-8 absolutely depend on Vite shell being primary runtime at play.blocksworm.com. If Gate 3 slips from Week 5 to Week 6+, Combat Polish slips proportionally, cascading into T4.11 beta start.
- **Mitigation:**
  - Combat Polish architecture is feel-layer-only (CSS + new `src/feel/*` modules); can be developed offline against legacy / src/ shell during Weeks 6-8 even if migration not yet primary
  - But VISIBILITY at play.blocksworm.com requires Gate 3 — until cutover, polish only renders at `/shell` route
  - If T4.11 beta delays from Week 9, beta cohort still gets full polish (just later)
  - Bug Tester integration cycle at Phase 5 Gate 2 (Week 4) catches any migration-side regressions that would block polish work
- **Status:** active Weeks 5-6 transition; closes at Gate 3 pass

---

## Tech debt items (tracked, not blocking)

| Item | Where flagged | Estimated effort |
|---|---|---|
| Migrate audio to CDN | PR #180 commit | ~half-day |
| T1.13 full modular-shell migration (replace legacy) | T1.13 deferred goal | 2-3 weeks |
| Phase 4.1 v2 sidecar wiring | this session's incident | 3-5 days |
| Phase 4.2 UI mount points (Adventures/Party Tower/Wallet buttons) | `docs/plan/PRODUCTION_LAUNCH_AAA.md` Phase D | ~1 working day |
| T4.07.1 live clan-backend wire-up | Phase 4 deferred | 1 hour after PR #162 dependencies clarified |
| T4.12.1 Chia mainnet RPC + treasury wallet | Phase 4 deferred | ~half-day |
| Anti-P2W audit dashboard auto-push | Phase 4 deferred | half-day |
| Adventure DAO on-chain governance V2 | Phase 4 deferred | future post-V1 |
| Founder Badge NFT mint at T4.12 Wave 1 | T4.12 runbook | half-day |
| Cloudflare DNS migration | R10 above | 30 min optional |
| Save-version migration framework | R11 above | 1-2 days |
| Sentry DSN + RevenueCat + Firebase keys | R6, R13 above | 1 hour (config only) |

---

## Risks RESOLVED tonight (no longer active)

- Phase 4.1 sidecar `Cannot redefine property: bossShieldCount` TypeError → rolled back
- 18 missing icon PNGs (404 errors) → bundled into deploy
- Intro-video overlay stuck state for fresh-state players → suppressed via localStorage seed
- 12 missing music tracks → bundled into deploy
- macOS DNS cache holding stale failed-WHOIS IP → cleared via dscacheutil flush
- Stale `sidecar.js` cached with immutable header → query-string cache-bust (now moot since sidecar reverted)

---

## How to use this register

- **For director:** R1-R4 are addressed by 2026-05-16 plan (Phase 5 + Option C+); R19-R23 are the new high-impact risks introduced by that plan; R24-R28 are the UI/UX polish workstream risks
- **For engineering lead (incoming):** R19 (save migration), R20 (your onboarding), R22 (scope discipline), R23 (Gate 2 defects), R27-R28 (Designer handoff + perf regression during Weeks 6-7) are your owned risks during Phase 5
- **For UI/UX Designer (incoming):** R21 (workstream collision), R24 (your scope discipline), R25 (sacred-cow conflicts), R26 (hero portrait art-direction decision), R27 (handoff quality), R28 (animation perf budget) are your owned risks
- **For pre-launch checklist (Weeks 6-8 operational provisioning):** R6 (Sentry), R13 (RevenueCat), R14 (Firebase), R15 (Sage)
- **For closed beta (Weeks 9-12):** R3 (Chia operational), R19 (residual save framework risk on real player data), R16 (load testing)
- **Last updated:** 2026-05-16 by CTO (Phase 5 kickoff + UI/UX Polish workstream addition)
