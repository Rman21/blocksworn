# Blocksworn — Risk Register & Technical Debt

**Date:** 2026-05-14
**Audience:** Director + future engineering owner

Each risk: rated by likelihood × impact, with current mitigation status and decision point if any.

---

## High-impact risks (need director attention)

### R1 — Phase 2-4 features invisible to users until Phase 4.1 v2 ships
- **Likelihood:** Certain (it's the current state)
- **Impact:** High for the project narrative — 3 months of development is in main but not user-visible
- **Mitigation:** Phase 4.1 v2 sprint with comprehensive E2E gating (see `05_ROADMAP_OPTIONS.md` Option B). Estimated 3-5 days.
- **Director decision:** approve / defer Phase 4.1 v2 sprint

### R2 — 21 MB legacy single-HTML as primary runtime (per ADR-004)
- **Likelihood:** Architectural reality
- **Impact:** Medium — large initial download (~4 MB gzipped), single point of failure for any legacy-side bug
- **Mitigation:** ADR-004 hybrid coexistence is documented + accepted. Full migration to modular shell is T1.13 deferred work (~2-3 weeks).
- **Director decision:** continue hybrid (cheaper) or fund full migration sprint

### R3 — Chia integration (Phase 4) operationally unproven at scale
- **Likelihood:** Medium — code is unit-tested, but no real testnet wallet integration has been live-tested
- **Impact:** High if mishandled — wallet integration touches real money flows even on testnet, and ADR-003 no-P2W invariant must hold under real player behaviour
- **Mitigation:**
  - 393 Phase 4 unit tests cover the contracts
  - ADR-003 enforced via T4.10 statistical parity audit (sacred-cow ENFORCEMENT layer)
  - T4.11 closed beta (100+ testers, 2 weeks) is HARD GATE before T4.12 production launch
- **Director decision:** go / no-go on Chia integration; if go, when to start T4.11

### R4 — No named human engineering owner
- **Likelihood:** Active risk every session
- **Impact:** Medium-high — session-to-session drift, no on-call coverage, no PR review discipline
- **Mitigation:** none currently
- **Director decision:** name an engineering lead (could be Roman + AI agent under his direction, or a dedicated hire)

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

- For director: focus on R1-R4 (high-impact decisions)
- For engineering owner: R5-R11 are next-sprint candidates
- For pre-launch checklist: R3 (Chia), R6 (Sentry), R13 (RevenueCat), R14 (Firebase), R15 (Sage)
