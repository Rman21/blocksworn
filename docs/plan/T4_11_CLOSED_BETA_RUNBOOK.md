# T4.11 — Closed Beta Runbook

**Phase:** 4 (Chia Integration)
**Task:** T4.11
**Status:** READY (gated on T4.05-T4.07 completion)
**Author:** CTO
**Created:** 2026-05-13
**Owner approval:** ESC-04 Q5 RESOLVED — firm 100 min / soft 200-300 / hard 500 ceiling; Chia-community recruitment; no paid acquisition

---

## 1. Purpose

Validate Phase 4 Chia integration with 100+ real crypto-native testers under simulated production conditions before T4.12 mainnet launch. Surface anti-P2W parity violations + mint-flow edge cases + wallet-confusion bugs at scale that no internal test suite can catch.

This is a **HARD GATE** per Execution Plan §9.5 — T4.12 production launch cannot proceed until all 4 success criteria in §5 below are green.

## 2. Scope

### 2.1 What testers experience
- Testnet11 build of Blocksworn deployed at `beta.blocksworn.com` (subdomain to be provisioned by Roman)
- Full Phase 1+2+3 game (Foundation Reset + Identity Layer + Endgame Social)
- Phase 4 surfaces enabled via `VITE_CHIA_ENABLED=true`:
  - Wallet connect (Sage)
  - NFT-hero variant mint (testnet XCH; testers receive 1.0 testnet XCH gift on enroll)
  - NFT skin apply / unapply
  - PURE PATH CHAIN leaderboard tab
  - Adventure DAO (clan-gated; Phase 3 substrate)
  - Anti-P2W audit dashboard (read-only — internal Bug Tester)

### 2.2 What testers do NOT experience
- Mainnet (testnet11 only)
- Real-money mint fees (testnet faucet only)
- Founder Badge gift (delayed to T4.12 Wave 1 per ESC-04 Q3)
- Cross-marketplace trading (Sage only; Spacescan / Mintgarden integration is V1.1)

## 3. Recruitment plan (per ESC-04 Q5)

### 3.1 Channels (Chia-community first, no paid acquisition)

| Priority | Channel | Target reach | Tactic |
|----------|---------|--------------|--------|
| **1** | Chia Discord (official) | 10K+ members | Announcement in #games + #nft channels; pinned post |
| **2** | Twitter/X | Chia OG accounts | Roman thread + retweets from @chia_project + Chia Foundation; bounty: Founder Badge for top 50 recruiters |
| **3** | Chia forum | Active dev/collector segment | Topic in `#Off-Topic / Games` with screenshots + magnet link |
| **4** | Sage Wallet community | Direct Sage user base | Sage team co-promotion (coordinate via Sage Discord if accessible) |
| **5** | Mintgarden / Spacescan communities | NFT collectors | Cross-post in NFT community channels |

### 3.2 NOT in scope for closed beta recruitment

- ❌ Paid acquisition (Twitter Ads, Google, Reddit Ads)
- ❌ Crypto-gaming media outreach (CoinTelegraph, CoinDesk, Decrypt) — reserved for T4.12 Wave 2
- ❌ Mainstream gaming outlets (RPS, Polygon, IGN) — reserved for T4.12 Wave 3
- ❌ Influencer outreach beyond organic Chia OG accounts

### 3.3 Tester profile (target distribution)

| Segment | Target % | Why |
|---------|----------|-----|
| Chia NFT collectors / minters | 50% | NFT mint flow critical path |
| Chia developers / builders | 20% | Wallet UX + integration feedback |
| Mobile/web casual gamers (Chia-adjacent) | 15% | F2P parity vs walleted experience comparison |
| Crypto-curious non-Chia (Sage Wallet adopters) | 10% | Cold-start funnel signal |
| Mainstream non-crypto (Roman's network) | 5% | Anti-P2W sanity check (would they notice / care about NFT layer?) |

### 3.4 Enrollment form (Google Forms or Typeform)

- Wallet address (Chia bech32 — `xch1…` or `chia1…`)
- Chia experience level (1-5)
- Mobile vs desktop primary
- Expected hours of play (1-20)
- Email (optional; for bug report follow-up)
- Discord handle (for tester-only channel)

### 3.5 Onboarding flow (per tester)

1. Tester submits form → CTO/Roman approves
2. Auto-email with:
   - Beta URL (`beta.blocksworn.com`)
   - Testnet XCH faucet gift (1.0 testnet XCH from Blocksworn treasury wallet) — `nft-backend.js` syncs on first wallet connect
   - Discord invite to `#blocksworn-beta` tester-only channel
   - Bug-report URL + Loom screen-share instructions
3. First-week check-in at day 3 + day 7 (CTO sends short pulse questions in Discord)

## 4. Operational cadence

### 4.1 Beta duration

**Minimum:** 14 calendar days from cohort cutoff
**Soft maximum:** 28 days (if extended for critical bug or active growth)
**Hard cap:** 42 days (forces T4.12 launch decision)

### 4.2 Cohort batching

- **Cohort 1 (Week 1):** 25 testers — soft launch, fast feedback loop
- **Cohort 2 (Week 2):** 50 testers (total 75) — scale test
- **Cohort 3 (Week 3):** 25 testers (total 100 — firm minimum met)
- **Cohort 4 (Week 4, optional):** up to 200 additional (total ≤ 300 — soft target)
- **Hard ceiling:** 500 testers total (Cohort 5+ rejected with "thanks; T4.12 mainnet open within 30 days")

### 4.3 Daily ops

| Time | Activity | Owner |
|------|----------|-------|
| 09:00 UTC | Sentry / analytics review | Bug Tester |
| 09:30 UTC | Discord pulse — read + reply to overnight reports | CTO |
| 10:00 UTC | Anti-P2W audit run (T4.10) — snapshot leaderboards, run `runSeasonAudit()` on weekly-rolling window | Bug Tester |
| 14:00 UTC | Wallet-connect funnel review (drop-off chart) | CTO |
| 18:00 UTC | Critical-bug triage (if any P0/P1 opened today) | CTO + Game Dev |

### 4.4 Weekly milestones

| Week | Milestone | Pass criteria |
|------|-----------|---------------|
| 1 | Soft launch (25 testers) | <5 P0 bugs; wallet-connect funnel >70%; mint success >85% |
| 2 | 75 testers | Anti-P2W audit indeterminate-pass (insufficient sample expected); no escalation |
| 3 | 100 testers (firm minimum) | Anti-P2W audit Week 3 PASSES (delta <5% on all 5 metrics); zero P0 bugs open |
| 4 | Optional scale to 300 | Audit Week 4 also passes; mint queue depth <100; settlement latency p99 <60s |

## 5. Success criteria (HARD GATE — all 4 must be GREEN for T4.12)

### 5.1 Anti-P2W parity (sacred)

Per T4.10 + design spec §6.4:

- ✅ Final-week `runSeasonAudit(weekly snapshot)` returns `{passes: true, violations: []}`
- ✅ `evaluateEscalation(auditHistory)` returns `{shouldEscalate: false}` for last 2 audit cycles
- ✅ All 5 metrics within 5% parity tolerance:
  - Mean Tower floor
  - 90th-percentile Tower floor
  - Top-10 player average floor
  - Weekly Adventures contribution per active member
  - Party Tower run-completion rate

**If audit fails for 2 consecutive cycles:** ESCALATE to Roman, freeze NFT-mint UI (T4.04), investigate root cause. T4.12 BLOCKED.

### 5.2 Quality (zero-critical-bug invariant)

- ✅ 0 P0 (BLOCKER) bugs open at gate-decision moment
- ✅ ≤2 P1 (CRITICAL) bugs open, each with documented mitigation
- ✅ Smoke pass rate 100% (`npm run test:smoke` on production-build artifact)
- ✅ Sentry P0 rate <0.1% of sessions in final week

### 5.3 Performance budgets met (AAA+ per CLAUDE.md §3.2)

- ✅ First Contentful Paint p95 <1.5s on testnet build
- ✅ Time to Interactive p95 <3s
- ✅ Bundle ≤5MB (currently 272 KB JS → well under)
- ✅ Wallet sync p99 ≤3s (design spec §2.4)
- ✅ Hero render with NFT skin lookup ≤1ms (cache hit)
- ✅ Mint settlement p99 ≤60s on testnet (Chia block time ~52s — ~1 block latency)

### 5.4 Adoption signal (Phase 4 viability)

- ✅ ≥60% of testers connect wallet at least once
- ✅ ≥40% of wallet-connected testers mint ≥1 NFT
- ✅ ≥20% of NFT-minters apply the skin to a hero (cosmetic-utility validation)
- ✅ Net Promoter Score (NPS) on Phase 4 layer ≥40 (10-point ask on final-week survey)
- ✅ ≥1 organic tweet / Discord post per ~5 testers (organic-share rate >20%)

## 6. Communication plan

### 6.1 Tester-facing communication

- **Discord channel:** `#blocksworn-beta` — tester-only; tester-to-tester chat + dev replies; daily Roman pulse
- **Bug reports:** Loom screen-share + Discord thread; CTO triages within 24h
- **Weekly digest:** CTO posts "Beta Week N" summary every Sunday with stats + known issues + roadmap forward

### 6.2 Public communication during beta

- **No mainstream marketing** during beta (per ESC-04 Q5)
- **Limited social posts:** Roman tweets ~2x/week ("Day N — wallet-connect funnel hit X% — keep the bugs coming")
- **No mainnet hints** until Week 3 minimum-met milestone reached

### 6.3 Beta-end → T4.12 transition

When 4 success criteria GREEN:
1. CTO posts go/no-go report (REPORT-NN in `docs/plan/REPORT.md`)
2. Roman approves T4.12 production launch sequence
3. Tester-only thank-you in Discord + heads-up that mainnet launches within 7 days
4. Testers eligible for Founder Badge (per ESC-04 Q3) gifted at T4.12 Wave 1
5. Anti-P2W audit history archived → permanent ADR-006 reference

## 7. Risks + mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Anti-P2W audit fails Week 3 | HIGH | Freeze mint; investigate; Phase 4 ships without NFT variants (only Founder Badge) per ESC-04 Q1 fallback |
| Sage Wallet has critical UX bug | HIGH | Coordinate with Sage team via Discord; revert to wallet-connect stub mode for 24h while patch lands |
| Recruitment stalls below 100 | MEDIUM | Extend beta 2 weeks; intensify Chia Discord push; Roman direct outreach to OG accounts |
| Mint queue depth blows past 100 | MEDIUM | Throttle mints via `_setMintBehaviorForTest('pending')` lever in T4.12 staging build |
| Testnet11 instability / fork | LOW | Pause beta; communicate; resume when Chia testnet stabilizes |
| Mass tester abandonment after Week 1 | MEDIUM | Triage; if NPS<20 in Week 2 survey → ESC + reassess Phase 4 launch readiness |

## 8. Tools + dashboards required (T4.11.1 setup)

- `beta.blocksworn.com` subdomain + Vercel deploy with `VITE_CHIA_ENABLED=true` + Sentry env tag `phase4-beta`
- Sentry alert rules: P0 → Discord webhook; P1 → email
- Anti-P2W audit dashboard: T4.10 `runSeasonAudit` results pushed to `docs/plan/REPORT.md` weekly (manual MVP — T4.11.2 auto-push deferred)
- Tester roster spreadsheet: wallet address + enrollment date + last activity ts
- Mint analytics: `nft-backend.js` mint events → analytics (RevenueCat or Sentry breadcrumbs)
- Wallet-connect funnel: connect-attempt → connect-success → first-action

## 9. Open items (pre-T4.11 launch)

- [ ] T4.05-T4.07 ship (Wave 2 + 3)
- [ ] T4.13 Legacy Bridge wires all Phase 4 surfaces into legacy modal/screens
- [ ] `beta.blocksworn.com` subdomain provisioned by Roman
- [ ] Discord `#blocksworn-beta` channel + invite link
- [ ] Enrollment form deployed (Google Forms MVP)
- [ ] Treasury wallet seeded with 500 testnet XCH (5 × hard-cap = enough for 1 XCH/tester gift)
- [ ] Founder Badge NFT metadata uploaded to IPFS (mint deferred to T4.12 Wave 1 per ESC-04 Q3)

## 10. Post-beta cleanup

- Disable enrollment form
- Migrate `beta.blocksworn.com` artifacts to staging archive
- Anti-P2W audit history → permanent record in `docs/adr/006-phase4-launch-audit-history.md`
- Tester Discord channel archived; appreciation post pinned
- Lessons-learned report in REPORT.md before T4.12 Wave 1

---

**Document version:** 1.0
**Approval:** ESC-04 Q5 RESOLVED — runbook canonical until T4.11 starts
**Next update:** at T4.05-T4.07 completion (pre-beta-launch checklist)
