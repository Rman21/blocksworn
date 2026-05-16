# ADR-005: Option C+ — Full Vite Migration with Gated Preparation

**Status:** Accepted
**Date:** 2026-05-16
**Author:** CTO (Roman approved, post-consultant review)
**Supersedes (partial):** ADR-004 Hybrid Runtime Coexistence — retired at the end of Phase 5 cutover (Gate 3)
**Related:** REPORT-35 (Phase 4.1 sidecar postmortem closure), `docs/reports/03_SESSION_INCIDENTS.md`

---

## Context

Three forces converge to make the hybrid runtime (ADR-004) unsustainable as the long-term architecture:

1. **Phase 4.1 sidecar incident (2026-05-13).** Attempt to wire Phase 2-4 src/ modules into the legacy primary runtime through a sidecar script collided with ~130 legacy global-scope names. 6 PRs over ~4 hours of broken production. Root cause is architectural: legacy declares functions/vars at script-tag top level; any src/ module writing to `window.X` collides. Defensive guards mass-applied (`mirrorWindowProp`, `if (typeof window.X === 'undefined')`) reduce TypeError surface but leave behavioral collisions (clobbered `showScreen`, etc). Sidecar pattern is structurally fragile at the current legacy scope.

2. **Phase 2-4 features are dormant.** ~95% of code is shipped + unit-tested but 0% is user-visible because there is no working integration path from src/ modules into the legacy primary runtime. Three months of engineering investment sits inert.

3. **Consultant review (2026-05-13).** Senior Game Strategy Consultant reviewed the incident postmortem + risk register + roadmap options and recommended Option C (Full Vite Migration) over Option B (Defensive Sidecar v2). CTO's initial recommendation B was acknowledged biased by recency of the incident. C is architecturally correct; the only debate is execution discipline.

The pre-condition for safe migration: the original Execution Plan §10 specified 6 golden-path smoke tests as a phase-gate invariant. Audit (2026-05-13) revealed they DO NOT EXIST. Current smoke coverage is `legacy-loads.spec.js` (one assertion: HTML loads, Chronicler dialog renders, BEGIN click reaches first battle) plus 14 phase-specific stubs for Phase 2-4 features. Real coverage of the AAA+ user journey is ~30% of plan. **Starting a migration without those tests would repeat the Phase 4.1 mistake at larger scale.**

## Decision

**Adopt Option C+ — Full Vite Migration executed sequentially with three hard gates blocking forward progress.**

The "+" denotes the preparation discipline that distinguishes this from a naive Option C (rush migration):

- **Week 1** is BLOCKING preparation. Migration does not start until Gate 1 passes.
- **Week 2-3** is the migration sprint itself. No parallel polish, no parallel beta-prep, no parallel hiring discussions inside the migration workstream.
- **Week 4** is staging soak. Migration does not promote to play.blocksworm.com until Gate 2 passes.
- **Week 5** is staged cutover with 1-week rollback safety net via `v1.blocksworm.com`. Gate 3 controls retirement of the safety net.
- **Weeks 6-8** are operational provisioning + post-migration UI/UX polish work integration from the (separately hired) Mobile Game UI/UX Designer's Figma specs.
- **Weeks 9-12** are T4.11 closed beta (firm 100 / soft 200-300 / hard 500 testers per ESC-04 Q5).
- **Week 13** is T4.12 production launch (3-wave per existing runbook).

ADR-004 (Hybrid Runtime Coexistence) is **retired at Gate 3**, not before. While the migration is in flight, the legacy runtime remains the authoritative source of truth for what players see on play.blocksworm.com.

### Gate 1 (end of Week 1) — Migration may begin

Both conditions must hold:

- **All 6 Execution Plan §10 golden-path smoke tests are written, green against legacy production, and wired into CI.** Specifically:
  - `tests/smoke/ftue.spec.js` — full Chronicler intro → ▶ BEGIN → first board → first piece → first line clear → first crit, 0 console errors
  - `tests/smoke/ch1-boss1.spec.js` — Pyredrake fight to completion including reactivity events
  - `tests/smoke/tower.spec.js` — Tower run start → 5 floors → retry-with-gem → leaderboard submit
  - `tests/smoke/shop.spec.js` — gem pack render (all 6 SKUs with correct prices + bonuses), Battle Pass widget render, First Purchase Bonus copy
  - `tests/smoke/settings.spec.js` — audio toggle, haptic toggle, language (n/a — English only), reset confirm flow
  - `tests/smoke/mythic.spec.js` — Mythic ascension commitment screen, one-per-save invariant, fire path verification

- **Save migration framework exists, is unit-tested, and is verified on 10+ real save snapshots harvested from legacy localStorage.** The framework must:
  - Read legacy v2 save shape
  - Transform to modular runtime shape
  - Preserve all sacred values (gems balance, hero collection, Battle Pass XP, Tower floor reached, Codex unlocks, friend list, clan membership, NFT ownership references, Mythic commitment state)
  - Be reversible (one-way wipe is unacceptable post-migration)
  - Have automated regression tests covering each save version branch

If either condition fails, Week 1 extends. **There is no negotiated partial pass.**

### Gate 2 (end of Week 4) — Staging soak success

Both conditions must hold:

- **72 hours of `staging.blocksworm.com` running the migrated Vite build with no production incidents.** Incident = any Sentry-class error reaching real user surface OR any smoke-test regression OR any visual regression >2% pixel diff OR any save-migration data loss event in the staging cohort.

- **Bug Tester integration-level cycle on user-visible Phase 2-4 features.** Adventures join flow, Party Tower create flow, Replay viewer playback, Friend leaderboard render, Tower Seasonal banner, Codex tabs. GO verdict required (BLOCKER count = 0, CRITICAL count = 0, MAJOR count ≤ 2 with remediation plan).

### Gate 3 (end of Week 5, +24h soak) — Cutover complete, safety net retired

Both conditions must hold:

- **24 hours of `play.blocksworm.com` serving the migrated build with zero Sentry-class production incidents.**
- **`v1.blocksworm.com` (legacy rollback alias) has not been needed during the 24h window.**

At Gate 3, ADR-004 retires. Legacy is moved from `_legacy/_archive_v1/` to archive-only status; rewrites in `vercel.json` are simplified; the legacy HTML is no longer a deploy artifact.

## Alternatives considered

### Option A — Status quo (do nothing)
Players keep seeing v2.1 game. Phase 2-4 stays dormant forever. Sunk-cost of ~3 months engineering is unrecovered. **Rejected** because three months of investment without user-visible payoff is not a defensible end state, and because the consultant + Roman explicitly want Phase 2-4 features in front of beta testers.

### Option B — Defensive sidecar v2 (3-5 days)
What CTO recommended in the initial report. Adds collision-audit + Playwright walk + staged `?sidecar=1` rollout + 2-week soak. **Rejected** because the architectural fragility identified in the Phase 4.1 postmortem (legacy global scope vs src/ module imports) is not addressed; only its blast radius is reduced. Risk is structural, not procedural. Buying ~10x risk reduction for 1/4 the cost is not the right tradeoff when migration is on the table.

### Option C — Naive full migration (2-3 weeks without prep)
The "do it fast" version. Migration sprint without golden-path tests in place + without save migration framework. **Rejected** because it repeats the Phase 4.1 mistake at larger scale: shipping integration work whose verification surface is incomplete. The 1-week Gate 1 cost buys cheap insurance against expensive incidents.

### Option D — Strangler-fig over 6+ months
Move one screen at a time from legacy to src/, validated per-screen, no big-bang cutover. **Rejected** because it sustains hybrid runtime cost across the entire migration window, blocks closed beta until migration completes, and creates merge-conflict surface for the UI/UX Designer's polish workstream. Acceptable as fallback if Gate 2 reveals migration is more fragile than expected; not the primary plan.

## Consequences

### Positive

- **Architectural clarity.** Single primary runtime. New features land in src/ only. Module boundaries enforce themselves through the build.
- **Phase 2-4 features become user-visible** at end of Week 5. Three months of engineering investment realizes user value.
- **TTI improves measurably.** Legacy 21 MB HTML / ~4 MB gzipped → Vite shell ~94 KB gzipped projected. TTI goes from ~2.1s to ~0.8-1.2s on desktop, larger relative improvement on mobile.
- **Test coverage gap (6 missing golden paths) closes as a side effect of the Gate 1 work, even if migration were later abandoned.**
- **Save migration framework is reusable** for future SAVE_VERSION bumps; no more one-shot wipes.
- **CLAUDE.md §7.1 ("test infrastructure first") is honored** — Gate 1 is exactly this principle applied retroactively.

### Negative

- **5 weeks of focused engineering** dedicated to migration. Other work (T4.11 prep, polish features, etc) cannot run in parallel inside Week 1-5. **This is intentional** — the Phase 4.1 incident was caused by interleaving.
- **Save migration is the highest residual risk.** Mitigated by 10+ snapshot test + reversibility requirement, but not zeroed.
- **Hiring dependency.** Engineering lead must be onboarded by end of Week 2 at latest to gate PR reviews from Week 3 onward. Roman owns this critical path; CTO does not gate on it but flags risk if slipping.
- **Schedule cost vs Option B:** 5 weeks vs 3-5 days. Acknowledged.

### Neutral

- **Visual regression baselines (25 desktop + 25 mobile PNGs)** continue to act as the parity contract during migration.
- **Sacred cows audit (CLAUDE.md §2)** continues unchanged. ZERO modifications expectation extends through Phase 5.
- **`vercel.json` rewrites** will need a one-line change at Gate 3 (`/` → modular shell instead of `/blocksworn_index_fixed`). Documented in cutover runbook.
- **UI/UX Designer (hired separately by Roman, working Figma)** integrates post-migration (Week 6-8). Designer's specs do not block migration; migration does not block Designer's audit work. Two independent workstreams converging at Week 6.

## Compliance

How to verify this decision is being followed:

1. **No migration PR may merge before Gate 1.** CI must enforce: if a PR touches `src/main.js` boot chain OR removes legacy rewrites, smoke test job must include the 6 golden paths. Failing any of the 6 = PR blocked.
2. **No staging promotion before Gate 2.** Staging-to-prod promotion is a manual deploy gated by Bug Tester GO verdict + 72h soak metric review.
3. **No safety-net retirement before Gate 3.** `v1.blocksworm.com` stays live for 1 full week minimum post-cutover. Removal requires explicit CTO + engineering lead sign-off.
4. **Engineering lead onboarding deadline:** end of Week 2. If hire slips, Roman + CTO decide whether to (a) extend Week 1 to bridge or (b) accept reduced PR-review discipline during migration sprint, **never** (c) ship without any human gate.
5. **Audit trail:** every Gate pass produces a REPORT-NN entry with concrete metrics (test counts, timing, Sentry error counts, save snapshot test results).

## Out of scope for this ADR

- Audio CDN migration (84 MB MP3 assets). Tech debt item R5; spawned parallel as a half-day task at any point during Phase 5 if engineering lead has bandwidth; not a gate.
- T4.07 Adventure DAO live Firestore wire-up. Existing TODO marker; lands in T4.11 operational prep (Week 7), not in migration.
- T4.12 Chia mainnet RPC + treasury wallet. Lands in T4.12 launch Wave 1 prep (Week 13), not in migration.
- Mobile (CHIA_ENABLED=false) build separation. Already handled by feature flag (ADR-005 is web-runtime; mobile path is compile-time gated).

## Rationale (one-paragraph why now)

The Phase 4.1 incident proved cheap (~4 hours broken production, zero real users affected, full rollback executed). The lesson is purchased. Using it as foundation for 13 weeks of disciplined migration → operational provisioning → closed beta → production launch is the maximum return on a cheap incident. Trying to "save" the 5 weeks by shortcutting back to Option B would burn the lesson and re-take the same risk at a stage where real users are affected.
