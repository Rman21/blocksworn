# Sprint 6 — Known Gotchas + Mitigations

**Source:** SPRINT_6_FULL_LAUNCH_PREP.md §12
**Use:** Pre-mortem reference. Read once before launch, re-read at any "uh-oh" moment.

---

## 1. Day 0 launch crashes (server load 5-10× soft launch)

**Issue:** First public launch traffic spikes server load 5-10x soft launch peak. Firestore / Cloud Functions may throttle.

**Mitigation:**
- Set Firestore rules to handle spike
- Pre-warm Cloud Functions
- Monitor cost meter (free tier cliffs)
- Backup plan: graceful degradation (cache more locally)

---

## 2. Apple App Store featuring rejection

**Issue:** Apple reviewer marks featuring application as "not ready" or "needs polish." No specific feedback often.

**Mitigation:**
- Polish before applying
- Don't apply on Day 0 — wait until Day 30+ when stability proven
- Check Apple feature criteria: https://developer.apple.com/app-store/promote
- Re-apply after 90+ days if denied

---

## 3. Marketing spend out-pacing revenue

**Issue:** Path 2/3 burns $200K-$1.5M before retention/conversion validated at scale.

**Mitigation:**
- ROAS Day 7 ≥0.4 trigger to continue
- ROAS Day 7 <0.3 = pause + investigate
- Channel-by-channel kill switches
- Reserve 20-30% for crisis management

---

## 4. Public reviews complaining about removed features

**Issue:** Players who played soft launch + early public launch see changes between builds. Some complain "you took away my favorite feature."

**Mitigation:**
- Public changelog with reasoning
- Discord transparency about decisions
- Sometimes restore features if backlash is significant
- Soft launch testers grandfathered (Founder badge, etc.)

---

## 5. Whale concentration at scale

**Issue:** 5% of payers = 60% of revenue. If top 5 whales churn (bug, dispute, life event), revenue drops 25% overnight.

**Mitigation:**
- Whale CS responsiveness within 24h
- Direct communication with top 10 whales (Discord DM, email)
- Pre-launch new content with whale beta
- Avoid power creep that invalidates their spend

---

## 6. Chapter content drought

**Issue:** Players hit Chapter 4 finale by Day 60-75. If Chapter 5 not ready by Day 90, content drought begins.

**Mitigation:**
- Chapter 5 content production starts at Day 30 of public launch
- Architectural placeholders (Chapter 5 button visible but locked) — already in code
- Communicate publicly: "Chapter 5 coming Day 135"
- Stretch existing content with new modes (Tower variants, race expansions)

---

## 7. Battle Pass S2 transition friction

**Issue:** First BP S1 → S2 transition reveals UX issues not visible in soft launch.

**Mitigation:**
- BP rollover stress-test in Sprint 2 (already shipped)
- Subscriber communication 7 days ahead
- Don't reset progress without warning
- Generous "S1 carryover" if any items missed

---

## 8. Region-specific issues

**Issue:** Game launches globally but UI/mechanics fail in specific regions (RTL, font rendering, payment methods).

**Mitigation:**
- Geographic testing before global launch
- Region-specific App Store listings (where applicable)
- Backup payment methods (some regions need alternatives)
- Regional customer support response times

---

## 9. Roman emotional swing

**Issue:** Day 0 success feels great → Day 30 minor metrics dip feels catastrophic → emotional decisions follow.

**Mitigation:**
- Stick to validation gates, not vibes
- Talk to peers / mentors about decisions before acting
- Take 1 day/week off (mandatory, not optional)
- Therapy budget is part of mental capital

---

## 10. Year 2 planning too early

**Issue:** Tempting to plan Year 2 content/marketing during stressful Year 1.

**Mitigation:**
- Year 2 detailed planning: Month 9 (3 months before Year 1 close)
- Quick Year 2 sketch: Month 6 (high-level only)
- Stay focused on Year 1 execution
