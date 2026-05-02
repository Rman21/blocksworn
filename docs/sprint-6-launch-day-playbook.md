# Sprint 6 — Public Launch Day Playbook

**Source:** SPRINT_6_FULL_LAUNCH_PREP.md §8
**Use:** Print, pin, walk-through on launch day. One person owns each row.

---

## T-7 Days — Pre-Launch Verification

```
□ Final build approved on Apple App Store (review queue ~24-48h)
□ Final build approved on Google Play
□ Privacy Policy live at https://www.blocksworm.com/privacy-policy
□ Terms of Service live at https://www.blocksworm.com/terms
□ Customer support inbox monitored (support@blocksworm.com)
□ Discord active — launch announcement queued
□ Twitter/X account active — launch tweet queued
□ Marketing assets ready (Path 2/3 only)
□ Influencer content scheduled (Path 2/3 only)
□ Press embargo set (Path 3 only — confirm lift time)
□ Soft launch tester founder grandfathering cutoff date set
   (See blocksworn_index_fixed.html — _SOFT_LAUNCH_TESTER_CUTOFF_DATE constant)
□ Roman has confirmed: T+0 calendar cleared, no other meetings
```

---

## T-1 Day — Final Preparations

```
□ Final smoke test on production: 5 testers, fresh install per platform
   - iOS Safari (web)
   - iOS native (TestFlight build promoted to App Store)
   - Android Chrome (web)
   - Android native (Play Console build promoted)
   - Desktop Chrome
□ Server scaling alarm thresholds verified (Firestore, Cloud Functions)
□ Sentry alerts armed
□ Firebase Analytics dashboard refresh confirmed
□ Customer support response templates loaded
□ Hotfix capacity reserved (1-2 days, no other commitments)
□ Roman/team rest: launch day is high-stress, sleep well
□ Pre-staged: Discord post, Twitter post, Reddit post, blog post drafts
```

---

## T+0 Launch Day — Hour-by-Hour

### Hour 0: Apps go public

```
□ App Store + Google Play listings flip to PUBLIC (manual or scheduled)
□ Apple Search Ads campaigns activate (Path 2/3)
□ Discord announcement posted
□ Twitter/X launch tweet
□ Reddit AMA post (Path 1/2)
□ Email blast to soft launch testers — Founder badges activate on next login
```

### Hour 1-4: First waves

```
□ Real-time Firebase Analytics dashboard open
□ Crash rate monitor: target <2% (alert if >5%)
□ Refund rate: should be near 0%
□ Reply to Discord questions (Roman or community manager)
□ Sentry triage: anything new shows up immediately
```

### Hour 4-12: First day

```
□ ROAS estimate (Path 2/3 paid)
□ Tester sentiment scan
□ First reviews appearing — read all of them
□ Address top concerns publicly via Discord (transparency wins trust)
□ Channel performance review (per-source CAC, Path 2/3)
```

### Hour 12-24: Day close

```
□ Daily metrics report:
  - Cumulative installs
  - Organic vs paid breakdown
  - First boss defeat rate
  - First shop visit rate
  - First purchases (cumulative)
  - Payment success rate
  - App Store rating snapshot
□ P0/P1 issue list compiled
□ Overnight Sentry alerts confirmed armed
□ Sleep — Day 2 starts in hours
```

---

## First-Day Metrics to Watch

### Health
- Crash-free %: target **>99%**
- Auth success: target **>99%**
- Server response time: target **<500ms p95**
- App Store rating: track every 4 hours

### Acquisition
- Total installs (cumulative)
- Organic vs paid breakdown
- Channel performance (per-source CAC)

### Engagement
- Sessions per user
- FTUE completion rate
- First boss defeat rate
- First shop visit rate

### Early monetization
- First purchases (cumulative)
- Payment success rate
- Refund rate

---

## Escalation paths

| Severity | Trigger | Owner | SLA |
|---|---|---|---|
| P0 | Crash rate >5% or auth broken | Roman | <1 hour |
| P0 | Payment failure rate >10% | Roman | <1 hour |
| P1 | Specific Sentry pattern affecting >2% of users | Roman | <4 hours |
| P1 | Customer support escalation (whale, refund dispute) | Roman | <8 hours |
| P2 | Discord/Reddit complaint (general) | Community | <24 hours |
| P3 | Cosmetic / polish bug | Backlog | Next polish patch |
