# Blocksworn — Roadmap Options

**Date:** 2026-05-14
**Audience:** Director — three decision menus with cost/benefit framing
**Author:** CTO

---

## Decision 1 — How to integrate Phase 2-4 features into the live game

The core question: ~3 months of Phase 2-4 development is in main but invisible to users. How much investment to make it user-visible?

### Option 1A — Status quo (do nothing)
- **Effort:** 0 days
- **Cost:** $0
- **Outcome:** Players see the v2.1 game (combat, FTUE, Tower, Battle Pass, Uroboros, 25 heroes, 12 music tracks). Phase 2-4 development cost is sunk but features remain dormant. Codebase still benefits from Phase 1 modularization for future work.
- **Risk:** Low — current state is provably stable (Playwright passing on every push)
- **Best for:** "We just want a stable v2.1 launch and will iterate later" thinking. Acceptable as final state if Chia integration is not pursued.

### Option 1B — Defensive sidecar v2 (recommended)
- **Effort:** 3-5 days focused engineering
- **Cost:** ~$2-5k if outsourced; 0 if Roman + AI agent
- **Scope:**
  1. Comprehensive legacy collision audit (every `function X` / `var X` in legacy ↔ every `window.X = …` in src/)
  2. Defensive guards on every collision (`if (typeof window.X === 'undefined') window.X = X`)
  3. Full Chronicler FTUE Playwright walk against the production-build artifact BEFORE merge
  4. Staged rollout via `?sidecar=1` query flag; default-on after 2-week soak
  5. Visual regression baselines for each new UI surface
- **Outcome:** All Phase 2-4 features become user-visible:
  - Phase 2: Identity Layer FX in combat, Codex screen
  - Phase 3: Adventures clan menu, Party Tower lobby, Replay viewer, Friend leaderboard widget, Tower Seasonal banner
  - Phase 4: Chia wallet connect, NFT inventory, Adventure DAO, PURE PATH CHAIN leaderboard tab
- **Risk:** Medium — controlled by the pre-merge Playwright gate. Risk shape is "tonight's incident" type cascading failures; mitigated by lesson-learned controls.
- **Best for:** "We want a polished launch with all the work we've already invested visible to players."

### Option 1C — Full modular-shell migration (T1.13 finished)
- **Effort:** 2-3 weeks
- **Cost:** ~$15-25k if outsourced
- **Scope:**
  - Replace legacy single-HTML entirely with the Vite-built modular shell
  - Migrate the 71k LoC of legacy inline JS into src/ modules
  - Recreate every CSS keyframe, V_HAPTICS call, narrator dialog in the modular pipeline
  - Full Playwright regression suite covering every screen
- **Outcome:** Cleanest long-term architecture. No more hybrid. Faster initial load (~50 KB shell instead of 21 MB legacy HTML). Easier to add Phase 5+ features.
- **Risk:** High — biggest delta from current state, longest critical path
- **Best for:** "Phase 4.1 v2 isn't enough; we want the architecture right before scaling." Probably the right destination eventually but probably NOT the next step.

### Recommendation
**Option 1B** after the closed beta milestone is reached (Decision 2). 1B captures the user-visible value of the Phase 2-4 work without the multi-week commitment of 1C. 1C remains the long-term direction once cash flow + team supports it.

---

## Decision 2 — Whether to launch the Chia integration

Phase 4 (T4.01–T4.13) shipped the full Chia-blockchain layer: NFT-hero variants, Sage Wallet integration, Adventure DAO, PURE PATH CHAIN leaderboard, anti-P2W audit. Code is complete + 393 unit tests passing. ESC-04 questions all resolved by Roman with documented rulings.

Launching it requires operational sprint:

### Option 2A — Defer Chia indefinitely; v2.1 game launch only
- **Effort:** 0 additional days for Chia
- **Cost:** $0 — Chia development cost already sunk
- **Outcome:** Launch the v2.1 game as a standalone product. Chia code stays in main as future capability. T4.11 and T4.12 runbooks remain on the shelf.
- **Risk:** Low — no new infrastructure surface
- **Best for:** "Crypto is too risky / we want to validate the v2.1 game economy first."

### Option 2B — Launch Chia per the T4.11 + T4.12 runbooks (recommended)
- **Effort:** ~4 weeks operational (not engineering):
  - Week 1: Provision `beta.blocksworm.com`, Discord, treasury wallet seed; recruit 100+ Chia-community testers
  - Weeks 2-3: Run closed beta per `docs/plan/T4_11_CLOSED_BETA_RUNBOOK.md`. T4.10 statistical anti-P2W parity audit gates progression.
  - Week 4: Production launch waves per `docs/plan/T4_12_PRODUCTION_LAUNCH_SEQUENCE.md`. Founder Badge gift to closed-beta testers.
- **Cost:** $0-500 in operational cost (Vercel free tier, Chia testnet free, mainnet gas fees only at launch).
- **Outcome:** Blocksworn becomes the first AAA+-quality Chia game with anti-P2W invariant. Differentiated positioning vs. mainstream block puzzles.
- **Risk:** Medium — wallet UX edge cases at scale, NFT royalty enforcement reliance on Chia ecosystem norm (no protocol-level enforcement)
- **Best for:** "We want to capture the Chia community first-mover advantage; the engineering work is already done."

### Option 2C — Soft-launch Chia (achievements only, no NFT heroes)
- **Effort:** ~2 weeks
- **Cost:** $0-200
- **Scope:** Only ship Founder Badge + on-chain achievements. Defer NFT-hero variants + Adventure DAO.
- **Outcome:** Validates Chia integration at smaller scope; Founder Badge as a gift to alpha testers preserves community goodwill
- **Risk:** Low — smaller surface area
- **Best for:** "Pilot Chia integration before committing to the full NFT-hero economy."

### Recommendation
**Option 2B** if the team has bandwidth for ~4 weeks of operational launch work. The engineering investment in Phase 4 is sunk; the question is purely whether to operationalize. Anti-P2W audit (T4.10) is a sacred-cow ENFORCEMENT layer that meaningfully reduces P2W risk to zero by design.

---

## Decision 3 — Engineering ownership model

Today's session demonstrated both the strength (rapid AI-CTO velocity, comprehensive plan documents, structured PRs) and the weakness (no human gating, ship-and-patch incident) of pure-AI development. The director needs to set the operational model:

### Option 3A — Continue Roman + AI agent (current model)
- **Effort:** None to set up; ongoing daily work
- **Cost:** Roman's time + AI API costs
- **Outcome:** Maintain session-by-session velocity. Roman as the final approver of merges + decisions.
- **Risk:** Medium — Roman is a single point of failure; no peer review; session-to-session drift
- **Best for:** Early-stage, pre-revenue, fast iteration. Current model.

### Option 3B — Add a part-time human engineering lead (recommended)
- **Effort:** Hiring time (~2-4 weeks to find + onboard)
- **Cost:** 10-20 hours/week × hourly rate
- **Outcome:** Human accountability for merges, PR reviews, sprint planning, incident response, on-call during beta + launch. AI agent continues as the IDE-driven worker. Director gets a single point of contact.
- **Risk:** Low — adds discipline, doesn't slow down velocity meaningfully
- **Best for:** Pre-launch through stable post-launch operation. Recommended for any T4.11+ work.

### Option 3C — Full-time engineer in-house
- **Effort:** Hiring + onboarding (~1-2 months)
- **Cost:** $5-15k/month
- **Outcome:** Sustained engineering capacity; deeper architectural ownership; better positioned for Phase 5+ features
- **Risk:** Low — most stable model
- **Best for:** Post-launch when revenue justifies fixed engineering cost

### Recommendation
**Option 3B** for the T4.11 closed beta through ~3 months post-T4.12 launch. Re-evaluate at month-3 based on actual revenue + product-market-fit signals.

---

## Recommended combined path (if all three decisions point "yes")

1. **Now (no change to live):** play.blocksworm.com serves the pure v2.1 game. Stable. Music plays. Playwright gated.
2. **Decision 3 — first action:** name an engineering lead (Option 3B).
3. **Engineering lead onboarding (1-2 weeks):** lead reviews the 5 reports in `docs/reports/`, gets context on the codebase, takes ownership of merges.
4. **Phase 4.1 v2 sprint (3-5 days, post-onboarding):** engineering lead drives Option 1B with the pre-merge Playwright gate. Phase 2-4 features become user-visible.
5. **T4.11 closed beta provisioning (parallel, 1 week):** Roman provisions `beta.blocksworm.com`, Discord, treasury wallet; lead handles Sentry/RevenueCat env vars.
6. **T4.11 closed beta runs (2-4 weeks):** per the closed-beta runbook. Anti-P2W audit must pass.
7. **T4.12 production launch (1 week):** 3-wave Chia community → crypto media → mainstream. Founder Badge gift.
8. **Post-launch:** monitor Sentry + KPI dashboards; iterate on community feedback. Schedule Phase 5 if applicable.

**Total time from now to production launch: ~6-10 weeks.**

**Total incremental cost: $5-25k depending on engineering ownership choice.**

---

## Read next

- `00_EXECUTIVE_BRIEFING.md` — one-paragraph summary
- `01_PROJECT_STATE.md` — detailed completeness matrix
- `02_PRODUCTION_TOPOLOGY.md` — infrastructure map
- `03_SESSION_INCIDENTS.md` — what went wrong tonight + lessons
- `04_RISK_REGISTER.md` — known risks + tech debt
- `06_INDEX.md` — navigation
