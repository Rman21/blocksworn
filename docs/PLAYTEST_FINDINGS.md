# Playtest Findings Ledger

Записи findings от Romana-founder'а в ходе smoke test'ов.
НЕ блокеры для текущей фазы. Priority для Phase 4 (The Moment Mechanics) и Phase 5 (Onboarding Rebuild).

## PF-001 · Grovewarden difficulty spike
**Observed:** Task #1.5 smoke test, 2026-04-24
**Source:** Roman playtest (founder)
**Symptom:** Roman failed Grovewarden (Boss_3) 4 times consecutively.
Combat damage recorded: 10,720 dealt vs 9,750 HP, but player defeated due to 
Grove Bloom regen mechanics.
**Likely causes:**
- Boss HP/mechanics tuned for 5-hero squad; current SQUAD_MAX=3 reduces 
  effective player damage output ~40%
- Grove heal motifs overtuned relative to player damage capacity
- Defeat tip "Try 3× EMBER" suggests rock-paper-scissors counter, but 
  requires squad composition knowledge not yet earned at Boss_3
**Phase affected:** 
- Phase 4 (balance pass): re-tune boss HP for 3-hero squad
- Phase 5 (onboarding): teach element counters earlier in progression
**Severity:** HIGH (4-attempt wall = retention killer per master plan soul-brief)

## PF-002 · HP mechanic not taught
**Observed:** Task #1.5 smoke test
**Source:** Roman playtest
**Symptom:** No in-game explanation of player HP loss mechanics:
- When boss attacks (attack countdown visible but not explained)
- What "AoE incoming: N" means
- How to prevent/mitigate damage (shields? avoid full rows?)
**Phase affected:** Phase 5 (onboarding) — progressive disclosure of combat systems
**Severity:** HIGH — core mechanic opacity

## PF-003 · Hero abilities feel weak and unexplained
**Observed:** Task #1.5 smoke test
**Source:** Roman playtest
**Symptoms:**
- ULT charge rate not visible during combat (3/12 indicator exists but mechanic 
  not taught)
- Fire abilities trigger conditions unclear (combo ≥ 2, but what is "combo"?)
- Damage output from hero fires feels low relative to line-clear damage
- Hero tooltips exist in detail modal but NOT accessible mid-combat
**Phase affected:**
- Phase 4 (The Moment Mechanics): make hero fires feel powerful via polish
- Phase 5 (onboarding): progressive disclosure of ULT/fire mechanics
**Severity:** MEDIUM-HIGH — couples with PF-001 (weak heroes → boss fails)

## PF-004 · Chapter Complete auto-trigger — not E2E verified in Task #1.5
**Observed:** Task #1.5 smoke test, 2026-04-24
**Status:** DEFERRED VERIFICATION

**What was verified:**
- showChapterCompleteModal() function renders modal correctly ✅
- Modal UI is Arena Premium styled per spec ✅
- ENTER TOWER / REPLAY CHAPTER buttons functional ✅
- localStorage write path exists in code ✅

**What was NOT verified:**
- Auto-trigger after real Boss_5 (Crypt Lich) victory
- Roman blocked at Boss_3 (Grovewarden) due to PF-001 difficulty wall
- Manual setItem('blocksworn_chapter_1_complete', 'true') bypass used for Tower unlock test

**Resolution plan:**
- Task #1.9 (Phase 1 regression): after all Phase 1 fixes complete, attempt full Chapter 1 walkthrough with Tower unlock verification.
- If PF-001 still blocks progress, consider manual balance patch to Grovewarden as separate Phase 1.x hotfix.

**Severity:** MEDIUM — modal system works, only E2E auto-trigger path unverified.
