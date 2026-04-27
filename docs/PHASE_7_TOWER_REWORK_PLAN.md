# Phase 7 — Tower of Endless · Block Plan

Status: **Block T.1 (Foundation) shipped 2026-04-27**. T.2-T.11 design'd, implementation phased.

Source: `BLOCKSWORN_TOWER_OF_ENDLESS.md` (1305 lines, ~10 systems).

---

## Why phased

The Tower spec is one of the largest design docs in the project: Daily/Weekly/
Seasonal gauntlets, 80-100 pacts, 10 seasonal bosses, 4 currencies, 24h buffs,
meta upgrade tree, cosmetics, daily curses, weekly themes. Shipping it as one
PR would be ~3000 LOC across 10 systems — un-reviewable, un-debuggable.

Phased per the existing Phase 5b cadence: each block is autonomous, ships
independently, gated by feature flags so half-shipped state never leaks.

---

## Block T.1 — Foundation: Daily Gauntlet structure ✅ SHIPPED

Reworked the existing `Endless Tower` (Phase 7 Block 7.1) — which was an
infinite-floor climb — into the **Daily Gauntlet** structure per spec §2.1.

**State extensions (towerState):**
- `dailyKey` — YYYY-MM-DD of last reset (4 AM-bounded local time)
- `attemptsToday` — 0..5 (attempts used this daily cycle)
- `dailyStreak` — consecutive-day full-clear count
- `dailyClearsTotal` — lifetime daily completions
- `lastDailyClearKey` — most recent clear's dailyKey (for streak math)
- `towerHearts` — meta-upgrade currency (5 fragments = 1 heart)
- `towerHeartFragments` — 0..4 accumulator
- `sigilShards` — 24h Buff currency (Block T.6 will spend)

Backward-compat: `Object.assign(towerState, parsed)` in `loadTowerState`
fills new fields with defaults for upgrading players.

**Daily reset gate (`checkTowerDailyReset`):**
- 4 AM local time boundary (per spec §2.1)
- Resets `attemptsToday`, mid-run state if `dailyKey` rolled over
- Streak math: yesterday's clear → continue, otherwise reset to 0
- Called on `goToTower`, `startTowerRun`, `renderTowerScreen`

**10-floor cap + boss slots:**
- Daily Gauntlet length: 10 floors (constant `TOWER_DAILY_FLOORS`)
- F5 = mid-boss slot (existing seeded random — Block T.10 swaps in tower-exclusive bosses when art lands)
- F10 = climax boss (highest tier from same seeded pool)
- Existing endless-mode infinite-floor logic preserved as `continueTowerRun` fallback

**Retry economy (per spec §7.2):**
- Free first attempt per day
- Retries 2-5 cost 100 / 500 / 2000 / 5000 gold
- Cap at 5 attempts/day (prevents grinding per §7.5)
- `getNextTowerRetryCost()` helper for UI
- `confirm()` gate before gold spend (mobile-safe)

**Daily completion reward (`onTowerDailyComplete`, F10 trigger):**
- +100 gold + scaled bonus (per spec §2.1)
- +5 sigil shards
- +1 tower heart fragment (5 frag → 1 heart conversion)
- Streak +1 (gated on dailyKey not yet recorded)
- 3-banner celebration (1.1s stagger so each plate gets eye-time)

**UI:**
- Daily status pill row: `DAY {key}` · `STREAK 🔥` · `ATTEMPTS Y/5` · `♥ X (Y/5)` · `◈ Z`
- Enter button label changes: "FREE" / "100💰" / "500💰" etc, or "🔒 DAILY CAP REACHED"
- Mid-run continues from saved `currentFloor`
- Disabled state on cap reached (greyed button + cursor not-allowed)

---

## Block T.2 — Pact System (next)

**Scope:** 80-100 pacts library. Per-floor 2-pact choice screen between fights.
Pacts persist for the entire run (cumulate). Tier gating: T1 (F1-5), T2 (F6-10),
T3 (F11-15 weekly+), T4 (F16-20 weekly+), T5 (F21+ seasonal only).

**Implementation cost:** ~600 LOC (data + UI + multiplier wiring).

**Data shape:**
```js
const PACTS = {
  spark_pact:   { tier: 1, name: 'The Spark Pact',
                  power: '+10% damage on first attack each fight',
                  cost:  'Bosses gain +5% HP',
                  apply: (state) => { state.firstAttackBonus = 1.10; state.bossHpMult = 1.05; } },
  // ... 80-100 more
};
```

**UI:** Modal between F1→F2, F2→F3, etc. 2 pact cards + SKIP button.
Selected pact's `apply` fn called → mutates active run state.

**Gating:** Pact pool filtered by floor depth. Random pair drawn each floor.

---

## Block T.3 — Daily Curses

**Scope:** At each daily reset, 2-4 random heroes from player's roster get
LOCKED for the 24h tower cycle. Cannot be selected for Tower squad.

**Per spec §3.2:**
- Player must have 5+ heroes unlocked (FTUE protection)
- Captain heroes immune (always at least 1 captain available)
- Curse count scales: 5-10 unlocked = 1 curse, 11-19 = 2, 20+ = 3-4
- No race elimination (always leaves ≥1 from each race)
- Same curse can't repeat 2 days in row

**Implementation cost:** ~150 LOC.

**State:** `dailyCurses: ['hero_id_1', 'hero_id_2', ...]` regenerated on daily reset.

---

## Block T.4 — Weekly + Seasonal Gauntlets

**Scope:** 25-floor Weekly (Sundays, 1 attempt only), 50-floor Seasonal
(last 3 days of season, 1 attempt only).

**Implementation cost:** ~400 LOC. Mostly variations of T.1's daily gauntlet
with different floor counts, boss frequencies, and reward bundles per spec §2.2-2.3.

---

## Block T.5 — Currency dispensers (Tower Hearts spending)

**Scope:** Meta-upgrade tree per spec §10. Tower Hearts buy permanent buffs
(starting shields, ULT charge accel, etc).

**Implementation cost:** ~250 LOC + UI for upgrade tree screen.

---

## Block T.6 — 24h Buff System

**Scope:** Daily completion grants 1-of-3 buff selection (per spec §9). Buff
active for 24h, applies modifiers across both Tower and Chapter play.

**Implementation cost:** ~200 LOC + buff selection UI.

---

## Block T.7 — Weekly Element Theme

**Scope:** Each week, one element gets +30% damage / -30% damage globally
(per spec §4). Rotates through 5 elements over 5 weeks.

**Implementation cost:** ~120 LOC + theme indicator UI.

---

## Block T.8 — Tower-exclusive Bosses (data + mechanics)

**Scope:** 10 seasonal bosses per spec §6.1-6.10. Each has unique mechanic
(RAGE LOCK, HUNTER'S MARK, STONE COURT, etc). Mechanic implementations
vary; estimate ~80 LOC each + 1 data entry.

**Implementation cost:** ~1000 LOC. Art **gated on Roman delivery**.

---

## Block T.9 — Cosmetics + Prestige

**Scope:** Cosmetic asset slots, leaderboard scaffolding, season titles.

**Implementation cost:** ~400 LOC.

---

## Block T.10 — Mythic Tower Boss (UROBOROS)

**Scope:** F50 secret boss per spec §6.11. Multi-phase, time-bending mechanic.
Single biggest fight in the game.

**Implementation cost:** ~300 LOC + heavy art requirement.

---

## Block T.11 — Sign-off + audit doc

**Scope:** Full-system audit, balance pass, tag `v0.7.0-tower-of-endless-done`.

---

## Total estimate

~3500 LOC across 11 blocks. Ships in ~6-10 weeks of development at current cadence.

**Block T.1 ratio**: ~4% of total scope (foundation + state migration + daily structure).
Roman can review T.1 in production playtest before approving T.2 etc.

---

## Decision points for Roman

After playtest of T.1:

1. Daily reset hour — 4 AM local OK, or shift to 0:00? (currently `TOWER_DAILY_RESET_HOUR=4`)
2. Retry cost progression — 100 / 500 / 2000 / 5000 OK, or rebalance?
3. Streak — full daily clear required, or partial (F5 mid-boss?) for streak credit?
4. Daily reward bundle — 100 gold + 5 sigils + 1 heart frag OK, or change?
5. Currency display — pills row above run hint OK, or move to header?

Block T.2 (Pacts) should not start until T.1 plays well. Pacts are heavy work
(80-100 entries) and depend on T.1's run-flow being stable.
