# Sprint 6 — Scenario Decision Tree

**Source:** SPRINT_6_FULL_LAUNCH_PREP.md §2
**Use:** After Sprint 5 (soft launch) completes. Pick the matching scenario, execute that plan only.

---

## Decision flow

```
END OF SPRINT 5 (Soft Launch Retrospective)
│
├─ Gate C: ALL items pass? ──── No ──┐
│                                    │
│                                    ├─ Partial pass (4-6/7) ────► SCENARIO C: Extend
│                                    │
│                                    └─ Major fail ────────────► SCENARIO D: Pivot
│
└─ Yes ──┐
         │
         ├─ Capital available? ──── No ─────────────────────► SCENARIO B: Path 1 default
         │
         └─ Yes ──┐
                  │
                  ├─ Strong viral signals + $1.5M+ capital? ──► SCENARIO E: Path 3
                  │
                  └─ $200-300K capital + good metrics ───────► SCENARIO A: Path 2
```

If unclear at end of Sprint 5: **default to Scenario B (Path 1)**. Always upgrade later — going down is harder.

---

## Scenario summaries

### A — Path 2 Promotion

**Trigger:** All Gate C passed. D7 ≥22%, conversion ≥5%, organic share ≥30%. Capital ($200-300K) available.

| Phase | Duration | Budget | Action |
|---|---|---|---|
| Pre-launch | 30 days | $30K + $200-300K marketing | Retrospective fixes + ASO + UA setup |
| Launch | Day 1 | (in marketing budget) | Public launch with paid UA Day 1 |
| First 30 days | 30 days | (rolling) | ROAS Day 7 ≥0.4 monitoring; iterate creatives |
| Days 31-90 | 60 days | (rolling) | BP S2 attach; whale formation; Year 1 reaffirm |

### B — Path 1 Default

**Trigger:** Gates passed but no marketing capital. Solo founder mode.

| Phase | Duration | Budget | Action |
|---|---|---|---|
| Pre-launch | 14-21 days | $5K | Tier 1 fixes only; ASO; Discord/Reddit |
| Launch | Day 1 | $0 | Quiet launch — Discord + Reddit + Twitter |
| First 30 days | 30 days | $0 | Reply to App Store reviews personally |
| Days 31-90 | 60 days | $0 | If organic >50/day, consider Path 2 promotion |

### C — Soft Launch Extension

**Trigger:** Gate C partial (4-6/7 pass), one fixable issue identified.

| Phase | Duration | Action |
|---|---|---|
| Extension | 30 days | Diagnose + fix specific failing gate item; tester comms |
| Re-test | T+90 (or +30) | Re-evaluate Gate C |
| Branch | — | If passes → A or B; still partial → second extension OR pivot |

**Hard stop:** Maximum 2 extensions before pivot decision.

### D — Pivot Required

**Trigger:** Gate C failure, multiple items below threshold.

| Phase | Duration | Action |
|---|---|---|
| Diagnosis | 1-2 weeks | Compile soft launch data, identify root causes (not just symptoms), categorize: balance / monetization / retention / UX / technical |
| Sprint revisit | 4-8 weeks | Major changes per diagnosis |
| Re-soft-launch | (Sprint 5 redux) | Same testers + 50 fresh; re-evaluate Gate C |
| Decision | — | If still failing after 2 pivots → game design overhaul or sunset |

### E — Path 3 Hit-Game

**Trigger:** D7 ≥28%, viral signals, Apple/Google noticed, $1.5M+ capital.

| Phase | Duration | Budget | Action |
|---|---|---|---|
| Pre-launch | 45-60 days | $200K + $1.5M marketing | Retrospective + 5-channel UA + 3-5 contractors + localization (EN+ES+PT+DE) + featuring secured + PR + 20+ influencers |
| Launch | Day 1 | (in marketing budget) | Coordinated launch with featuring + press embargo lifts T+0 |
| First 30 days | 30 days | (rolling) | Server scaling watch (5-10x soft launch load); 24/7 hotfix capacity |
| Days 31-90 | 60 days | (rolling) | Year 1 second-half production; localization launch; tournaments |

---

## Code sprint duration by scenario

```
Scenario A (Path 2):   14-21 days for Tier 1 + Tier 2
Scenario B (Path 1):    7-14 days for Tier 1 only
Scenario C (Extend):   14-30 days targeted at gate-failure cause
Scenario D (Pivot):    30-60 days, full sprint cycle revisit
Scenario E (Path 3):   21-30 days for Tier 1 + Tier 2 + polish
```

---

## Tier classification (use after retrospective)

```
TIER 1 — CRITICAL (must fix before public launch):
  - Crash patterns affecting >2% of users
  - Monetization broken (low conversion despite intent)
  - Save data corruption / loss
  - Significant exploits

TIER 2 — IMPORTANT (fix in launch build OR within 7 days):
  - UI confusion that affects retention
  - Balance issues identified by data
  - Localization-blocking bugs (for non-EN markets)
  - Feature requests with overwhelming demand

TIER 3 — POLISH (post-launch live ops):
  - Cosmetic improvements
  - QoL features
  - Edge case bugs
  - Player-requested content additions
```

Anticipated retrospective volume: ~3-5 Tier 1 + ~5-10 Tier 2 + ~10-20 Tier 3 items.
