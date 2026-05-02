# Sprint 6 — First 30 Days Live Ops Runbook

**Source:** SPRINT_6_FULL_LAUNCH_PREP.md §9
**Use:** Daily/weekly cadence for the first month post-launch. Highest intensity period of Year 1.

---

## Week 1 — Stabilization

### Daily
```
□ Morning standup: review overnight metrics
□ Sentry triage (P0/P1 issues)
□ Customer support queue (48h SLA)
□ Discord engagement (1-2h)
□ Channel ROAS review (Path 2/3 only)
```

### Weekly
```
□ Hotfix deployment if needed
□ Tester retention re-check
□ Marketing creative iteration (Path 2/3)
```

---

## Week 2 — D1 Validation

### Key metrics to lock
- **D1 retention** (locked from Day 7+ data)
- **Initial conversion rate**
- **Crash trend** (should be declining)

### Decisions
```
□ Continue UA at current spend, OR pause + adjust (Path 2/3)
□ Continue Discord cadence
□ Plan Week 3 content (polish patch)
```

---

## Week 3 — Polish Patch 1.0.1

```
□ Push patch with Tier 2 fixes from Sprint 5 retrospective
□ Discord announcement
□ Monitor for regressions (Sentry watch)
□ Public review reply campaign (improve App Store rating)
```

---

## Week 4 — Battle Pass S2 Launch

```
□ Battle Pass Season 1 ends Day 60 (overlaps with launch period)
□ Pre-rollover warning to subscribers (7 days ahead)
□ Battle Pass S2 launches with new theme + cosmetics
□ Subscriber renewal reminder
□ Track renewal rate (target >50%)
```

---

## First 30 days — success criteria

```
□ D1 retention ≥35%
□ D7 retention ≥18% (forming)
□ Conversion rate ≥3%
□ Daily revenue trending up
□ App Store rating ≥4.0
□ Sentry crash rate <1%
□ Customer support queue under control
```

If hitting these → **continue with confidence**.
If missing 2+ → **pause growth efforts, focus on fixes**.

---

## Daily metrics dashboard (template)

```
[ DATE: YYYY-MM-DD · LAUNCH DAY +N ]

INSTALLS
  Cumulative: ____
  Today: ____
  Organic %: ____  · Paid %: ____

RETENTION (cohort views)
  D1: ____%  · target ≥35%
  D7: ____%  · target ≥18% (Day 7+ cohorts)
  D30: ____% · target ≥10% (Day 30+ cohorts)

CONVERSION
  First-purchase rate: ____% · target ≥3%
  ARPDAU: $____  · target ≥$0.07

HEALTH
  Crash-free %: ____%  · target >99%
  Auth success: ____%  · target >99%
  Sentry P0/P1 open: ____ items

COMMUNITY
  App Store rating: ____  · target ≥4.0
  Open support tickets: ____
  Discord new members: ____

PATH 2/3 ONLY
  ROAS Day 7: ____  · target ≥0.4
  Per-channel CAC: ASA $____ · UAC $____ · TikTok $____
  Pause/scale decisions: [list]

NOTES / DECISIONS
  - 
  - 
```

Refresh the dashboard daily; archive each filled copy as `dashboards/YYYY-MM-DD.md` so the trend is auditable.
