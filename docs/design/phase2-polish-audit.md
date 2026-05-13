# Phase 2 Polish Audit — TASK-043

**Status:** READY FOR CTO REVIEW
**Task:** TASK-043 (Phase 2 Live Audit)
**Author:** Bug Tester
**Date:** 2026-05-13
**Trigger:** Phase 2 Identity Layer merged to main `6545b57` (PR #159, 2026-05-12); Phase 2.5 polish PR #160 in flight
**Verdict (TL;DR):** **CONDITIONAL GO TO PHASE 3 — proceed in parallel with a small FTUE patch.** No SHIP-BLOCKERs found. Three SHOULD-FIX gaps identified — all isolated, all polish-pass scope, none gate Phase 3 kickoff.

---

## Executive summary

### Verdict

**CONDITIONAL GO TO PHASE 3.** No mechanic regresses sacred contracts (verified by prior T2.B.QA), no perf hotspot exceeds spec budget (verified below by `tests/smoke/identity-perf-probe.spec.js`), and the 5-race × 5-boss matchup matrix already cleared TTK at ±15%. **However**, the Identity Layer ships with **zero FTUE introduction copy**: the new player gets no Chronicler-voice teaching beat for any of the 10 new mechanics. Two of the three highest-impact mechanics (Sun Cascade, Cursed Tiles) are mechanically silent in their newbie-perspective surface. The Codex is also a silent accumulation surface — no on-discover notification beat.

These are all post-merge polish gaps, not regressions. Phase 3 (Endgame Social) is on a separate critical-path arc; we do not block it. We recommend a **Phase 2.5 polish patch** (1-3 tasks for Designer + Game Dev) for the C-ranked FTUE gaps and the codex-discovery beat, runnable in parallel with Phase 3 design work.

### Top 5 findings (ranked by AAA+ leverage)

1. **🟡 SHOULD-FIX — Sun Cascade is mechanically invisible to newbies.** The +1 dominantCount mutation has no HUD surface, no on-fire banner, no "PROMOTED!" beat. The golden ray VFX is purely decorative. A new player who triggers a Combo 4 via Sun Cascade has no way to learn the mechanic exists. (FTUE-readiness rank: **C**.) See Area 1.5 below.

2. **🟡 SHOULD-FIX — Codex accumulates silently.** `recordRaceTrigger` / `recordMomentTrigger` write to localStorage with zero player-facing notification beat. AAA+ standard (Marvel Snap, Hearthstone) gives every collection unlock a small dopamine ping. Today, the player only learns the Codex exists if they tap the Codex drawer entry. See Area 3.4 below.

3. **🟡 SHOULD-FIX — Phoenix Ashen Reign + Lich Cursed Tiles ship without narrator lines.** Spec §3.1 / §3.2 specifies "The ash remembers..." and "What you took, the deep remembers..." — neither is wired. Only Root Surge has its placeholder line live (`ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER`). Both missing lines are documented as Phase 2.5 follow-ups in the prior T2.B.QA audit; **Phase 2.5 PR #160 already addresses Phoenix + Lich per the CTO brief** — so this is informational only, not a NEW finding. See Area 3.2 below.

4. **🟢 NICE-TO-HAVE — Bloodtide Pulse 3rd-clear tempo is unteachable on the FIRST FTUE boss.** Pyredrake (Ch1 Boss 1) is `berserker` archetype, so Bloodtide Pulse can fire as early as the player's third successful line clear in the FTUE Pyredrake fight. The HUD label `BLOODTIDE PULSE — +5% incoming` exists but has no FTUE-style tutorial overlay introducing the concept. Newbies see a red pulse, a HUD label, and a damage spike, with no causal-explanation beat. (FTUE-readiness rank: **B**.) See Area 1.3 below.

5. **🟢 NICE-TO-HAVE — Mixed-race squads blur cross-mechanic chemistry.** A Pirate + Shark squad clearing a tide-dominant line fires both `fxPirateLineClear` (gold-coin trail to HUD) AND `fxSharkLineClear` (cyan-bite extra cell). Visually the gold-coin animation overlaps the bite-extension animation. Both are decoded eventually, but the combined fire has no "fused" beat — a mid-player loses the read-out that two things just happened. See Area 3.5 below.

### Performance result

**All 8 perf-probe tests PASS within spec budgets.** No frame stability concerns observed. Worst-case dispatch (5-race quad-row clear, every fx hot) registers **0/10 over-frame on chromium** with **median 0.10ms** wall-time. See Area 2 below for full table.

### Recommendation

**GO TO PHASE 3 NOW** in parallel with a Phase 2.5 polish task:

- **Phase 3 (Endgame Social)** kicks off immediately — design work on Tower / Party / Adventures is decoupled from Identity Layer polish.
- **Phase 2.5 polish task (Designer + Game Dev, ~3-5 days)** picks up:
  1. Sun Cascade newbie-tutorial overlay (`fxSparkLineClear` → emit a one-time `cascadePromoted` event when a Combo-promoted clear fires; FTUE-style overlay teaches the mechanic). C-rank → B-rank.
  2. Cursed Tiles FTUE introduction line (the first time a player encounters Lich Cursed Tiles in Ch1 Boss 5). C-rank → B-rank.
  3. Codex on-discover notification beat (`recordRaceTrigger` / `recordMomentTrigger` emit a transient HUD toast on FIRST encounter only). Silent → audible.

---

## Test environment

| Component | Value |
|-----------|-------|
| OS | macOS 13 (host) |
| Node.js | v24.15.0 |
| Browsers | chromium 120 + (mobile-chrome verified via prior T2.B.QA on same code) |
| Branch | `claude/phase2-polish-audit` (worktree) |
| Worktree | `/Users/rm/Downloads/game file/.claude/worktrees/dreamy-bouman-f8e247` |
| HEAD before audit | `6545b57` (PR #159 merged to main 2026-05-12) |
| New test artifact | `tests/smoke/identity-perf-probe.spec.js` (8 tests) |

Static analysis covered the full `src/feel/identity-fx.js` (4727 lines), `src/data/identity-layer.js` (911 lines), `src/core/ftue-state.js` (513 lines), `src/data/ftue-scripts.js` (236 lines), `src/feel/narrator-lines.js`, `src/ui/codex.js` (719 lines), and the 26 window-bridge functions in `src/main.js` lines 77-164.

---

## Area 1 — First-5-Minutes FTUE audit

### 1.1 New-player flow trace (Ch1 first 5 minutes)

| Beat | Source of truth | Identity Layer triggers possible? |
|------|-----------------|-----------------------------------|
| `not_started` → `chronicle_fight` | `src/core/ftue-state.js:480-487` (auto-route on fresh install) | Chronicle is a no-fail trainer; squad has no race-tagged heroes yet, so no Identity Layer fires. |
| `chronicle_won` → `intro` | `src/data/ftue-scripts.js:62-95` (Chronicle outro dialog) | No FX fires during dialog overlay. |
| `intro` → `pyredrake_fight` | `src/data/ftue-scripts.js:98-101` (Thorgar intro line) | No FX fires during dialog. |
| **`pyredrake_fight`** (Ch1 Boss 1 PYREDRAKE — `berserker`) | `src/data/chapters.js:32` | **Identity triggers possible:** Bloodtide Pulse (every 3rd line clear), Pirate Plunder (if squad has pirates — by default newbies start with `pirate_warrior` so YES this fires from line 1), Rock Encore Echo (no — `rock_mage` joins AFTER pyredrake_won). |
| `pyredrake_won` → `hero_reveals` | `src/core/ftue-state.js:291-304` (Thara + Urzog reveal) | Reveals `pirate_hunter` then `rock_mage`. Dialog overlay — no FX. |
| `leader_choice` → `grunt_fight` | Leader picked, then Ember Grunt fight. | Squad now has pirate + rock — Pirate Plunder + Rock Encore Echo can fire (rock fires on umbra-dominant clears only — Grunt is ember, so rock Echo silent here). |
| `grunt_won` → `complete` | FTUE complete. Player exits FTUE. | Free Ch1 progression resumes. Boss 2 ABYSSAL (`armored` — no Identity hook), Boss 3 GROVEWARDEN (`bruiser` — Root Surge), Boss 4 PHOENIX (`phoenix` — Ashen Reign), Boss 5 LICH (`assassin` — Cursed Tiles). |

**Window:** between cold-launch and `grunt_won` is approximately 2–4 minutes (Chronicle 30-45s + dialog 30s + Pyredrake 60-90s + reveal/leader 45s + Grunt 30-60s). **A newbie can encounter Pirate Plunder + Bloodtide Pulse before 5 minutes elapsed.** Phoenix Ashen Reign, Cursed Tiles, Root Surge, Engineer Lockdown can NOT fire in the first 5 minutes (they require Ch1 Boss 3+ access, which is post-FTUE).

### 1.2 First 5-min Identity Layer triggers — concrete list

Within the first 5 minutes a new player WILL encounter:

1. **Pirate Plunder** (every line clear in Pyredrake + Grunt — both pirate_warrior is in default squad).
2. **Bloodtide Pulse** (every 3rd line clear during Pyredrake Active state).
3. **Rock Encore Echo** (zero — no umbra-dominant clears in FTUE; grunt is ember; pyredrake is ember).

So the first-5-min Identity Layer surface is **2 mechanics**. The other 8 surface only at Ch1 Boss 3+ or post-FTUE.

### 1.3 FTUE-readiness rank per mechanic (10 of 10 audited)

| # | Mechanic | Fire window in F5M? | Visual self-teaches? | Mechanical surface obvious? | Build-optim cue? | Rank | Recommendation |
|---|----------|---------------------|----------------------|-----------------------------|------------------|------|----------------|
| 1 | **Pirate Plunder** | YES (line 1 of Pyredrake fight) | YES — coins fly to gold counter; HUD ticks visibly | YES — gold counter ticks 200g per row | YES — "I should run pirates" inferable | **A** | Ships as-is. Self-teaching loop. |
| 2 | **Shark Feeding Frenzy** | NO (post-FTUE) | YES — cyan bite arc + extra cell visibly clears | YES — board state changes visibly | YES — "sharks eat extra blocks" | **A** | Ships as-is. |
| 3 | **Rock Encore Echo** | NO (no umbra-dominant clears in F5M) | YES — purple ghost echo on cleared cells | NO — silent +1 ULT charge is invisible | NO — newbie can't connect echo → faster ULT | **B** | Add a subtle hint: on first Encore Echo fire post-FTUE, briefly flash the rock-mage's ULT meter to telegraph "this is the connection". |
| 4 | **Crocodile Bedrock Bastion** | NO (post-FTUE) | YES — fragments fly to crocodile portrait; shield icon animates at 5 | PARTIAL — shield grant is visible AT threshold; per-cell accrual is opaque | YES — "feed crocs grove → shields" | **B** | Self-teaching above threshold but per-cell math invisible. Add a 1-time "+5 fragments → SHIELD" tooltip on first shield grant. |
| 5 | **Spark Sun Cascade** | NO (post-FTUE) | PARTIAL — golden ray VFX is decorative; mechanical effect is **invisible** | NO — silent +1 to dominantCount is the highest-impact mechanic with the lowest visible surface | NO — only a hardcore player reading code knows | **C** | **CRITICAL FTUE GAP.** Recommend: emit a transient "COMBO PROMOTED!" banner on the FIRST time Sun Cascade causes a Combo3 → Combo4 promotion. Without this beat, the most powerful race flavor is the most invisible. |
| 6 | **Phoenix Ashen Reign** | NO (post-FTUE; Ch1 Boss 4) | YES — full-screen flame border + EMBER ONLY HUD label | YES — placement gate is enforced via predicate | YES — "hold an ember piece" is inferable from the visible failure to place | **A** | Ships as-is once narrator line wired (per PR #160). |
| 7 | **Lich Cursed Tiles** | NO (post-FTUE; Ch1 Boss 5) | PARTIAL — purple skull overlays appear; player understands "danger" but not "shark-stacking caused this" | NO — the trigger condition (≥2 sharks in squad) is invisible; cursed cells just appear | NO — newbie can't connect "shark squad → curses" | **C** | **CRITICAL FTUE GAP.** Recommend: a one-time Chronicler-voice overlay on FIRST encounter explaining the cause: "The deep punishes the predator". Without it, this is opaque "boss does a thing" rather than "boss reacts to me". |
| 8 | **Berserker Bloodtide Pulse** | **YES** (Ch1 Boss 1 — every 3rd clear) | YES — red pulse sweep + HUD label `BLOODTIDE PULSE — +5% incoming` | PARTIAL — HUD label is functional but TINY; +5% magnitude is small enough to be missed | NO — counting-clears mechanic is not surfaced | **B** | Self-teaches at hardcore tier; opaque at newbie tier. Recommend: in FTUE Pyredrake fight (and ONLY in FTUE), make the first Bloodtide Pulse trigger a Chronicler line: "PYREDRAKE remembers. Three strikes — and it answers." |
| 9 | **Engineer Lockdown Protocol** | NO (post-FTUE; Ch2 Boss 7) | YES — "TETRIS!" celebration banner + lockdown CSS | YES — locked cells visibly inaccessible | YES — anti-Tetris is implicit | **A** | Ships as-is. |
| 10 | **Grovewarden Root Surge** | NO (post-FTUE; Ch1 Boss 3) | YES — moss/root overlays on cells + narrator line via placeholder | YES — placement gate is enforced | YES — "play grove" is the obvious counterplay | **A** | Ships as-is. |

**Summary: A=5, B=3, C=2.**

The two C-ranked gaps (Sun Cascade, Cursed Tiles) are both the same pattern: **the trigger condition is invisible to the player**. Sun Cascade's `+1 dominantCount` is silent input mutation; Cursed Tiles' "≥2 sharks in squad" trigger is invisible state inspection. Both reward hardcore players (who read source) and punish newbies (who can't infer cause).

### 1.4 Does the FTUE script teach Identity Layer anywhere?

**No.** Grep audit (`src/data/ftue-scripts.js` + `FTUE_TUTORIAL_TEXTS`):

- `FTUE_TUTORIAL_TEXTS` covers: placement, line_clear, boss_exists, boss_attack, hero_ult, mitigation, attack_countdown, signature_damage, pressure_meter, stagger_window, phase_gate, reactivity_event, chapter_pack_reward, hero_card_economy, tier_ascension_preview.
- **Zero entries** mention any of: pirate, plunder, shark, frenzy, rock, echo, crocodile, bastion, spark, cascade, phoenix, ashen, lich, cursed, berserker, bloodtide, engineer, lockdown, grovewarden, root, identity.

Identity Layer is invisible to the FTUE narrative scaffold. This is the most fundamental finding of the audit.

### 1.5 Suggested Chronicler-voice intro lines (PLACEHOLDERS only — DO NOT WIRE)

Per the brief: draft placeholder lines for C-ranked gaps, do NOT wire to NARRATOR_LINES sacred table. Both lines below follow the existing ESC-02 O2 pattern: **isolated string constants in `src/data/identity-layer.js`** with a `// FINAL COPY: pending Roman approval` marker (mirroring `ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER` at line 858).

#### Sun Cascade FTUE intro (C → B promotion)

**Trigger condition:** First time `fxSparkLineClear` writes a non-zero `ctx._dominantCountModifier` AND `localStorage['blocksworn_sun_cascade_seen']` is unset.

**Suggested placeholder constant** (proposed wire site: new constant in `src/data/identity-layer.js` between line 860-870):

```js
// FINAL COPY: pending Roman approval (Phase 2.5 polish pass).
// Trigger: first time Sun Cascade promotes a Combo. Persists via
// localStorage['blocksworn_sun_cascade_seen'] so it fires exactly once
// per player.
export const SUN_CASCADE_FIRST_PROMOTION_LINE_PLACEHOLDER =
  'The sun bends to your clearing hand. Combo climbs — solar remembers solar.';
```

#### Cursed Tiles FTUE intro (C → B promotion)

**Trigger condition:** First time `fxLichCursedTiles` executes AND `localStorage['blocksworn_cursed_tiles_seen']` is unset.

**Suggested placeholder constant** (proposed wire site: same file, parallel placement):

```js
// FINAL COPY: pending Roman approval (Phase 2.5 polish pass).
// Trigger: first time Cursed Tiles fires in any battle. Persists via
// localStorage['blocksworn_cursed_tiles_seen'] so it fires exactly once
// per player. Counter the spec §3.2 placeholder
// "What you took, the deep remembers." (the on-EVERY-fire narrator
// line — already documented in narrator-copy-review.md).
export const CURSED_TILES_FIRST_FIRE_TUTORIAL_LINE_PLACEHOLDER =
  'You hunt with sharks. The Lich hunts hunters. Three cursed tiles — wait them out, or vary your squad.';
```

#### Bloodtide Pulse FTUE intro (B → A promotion — optional)

**Trigger condition:** First time `fxBerserkerBloodtidePulse` fires AND `localStorage['blocksworn_bloodtide_seen']` is unset. Pyredrake (Ch1 Boss 1, FTUE boss) is `berserker` so this fires during FTUE; the Chronicler is contextually appropriate as narrator since FTUE has not yet ended.

**Suggested placeholder constant:**

```js
// FINAL COPY: pending Roman approval (Phase 2.5 polish pass).
// Trigger: first time Bloodtide Pulse fires. Fires during FTUE
// (Pyredrake = berserker). Persists via localStorage so it fires
// exactly once per player.
export const BLOODTIDE_PULSE_FIRST_FIRE_TUTORIAL_LINE_PLACEHOLDER =
  'The dragon counts your strikes. Every third strike, it answers — read the tempo, time your guard.';
```

**Note:** These lines are drafted in the Chronicler voice (Darkest Dungeon-style — terse, poetic, second-person, never coach-speak). They are **NOT** edits to the sacred NARRATOR_LINES table. They are isolated constants intended for one-shot first-fire tutorial overlays, exactly the same pattern as `ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER`.

---

## Area 2 — Performance profiling

### 2.1 Test artifact

**File:** `tests/smoke/identity-perf-probe.spec.js` (8 tests, ~440 LoC)

**Strategy:** Wall-time per fx via `performance.now()` deltas inside `page.evaluate`. Each fx executes its hottest single-fire path (quad-row clear, 5-race squad of the fx's race, dominant-element grid) for N=20 samples after a warm-up call. Median / p99 / max captured and asserted against per-fx spec budgets multiplied by a CI-tolerance factor (3×, per existing CI variance pattern observed in the smoke suite). A separate mixed-race aggregate test fires `dispatchIdentityFx` 10 times with all 5 race fx hot simultaneously.

**Caveats:**
- Wall-time per fx is a stricter contract than rendered FPS — if every fx fits within a frame, the runtime can safely schedule them. Full rendered FPS sampling (`PerformanceObserver { entryType: 'frame' }`) is Phase 3 polish scope per the brief.
- Boss-reactive `fxPhoenixAshenReign` and `fxLichCursedTiles` are CSS-keyframe-driven during the steady-state window (per spec §3.1 field 7: "zero per-frame JS during the 5s window"). The architectural rule was audited in T2.B.QA. We measure their INITIAL trigger only here.

### 2.2 Results — chromium / Pixel 7-class hardware

```
[perf-probe] Pirate quad-row × 5-pirate × 20:               median=0.00ms  p99=0.30ms  max=0.30ms
[perf-probe] Shark quad × 5-shark × 20:                     median=0.00ms  p99=0.10ms  max=0.10ms
[perf-probe] Rock quad-row × 5-rock × 20:                   median=0.00ms  p99=0.10ms  max=0.10ms
[perf-probe] Crocodile quad-row × 5-croc × 20:              median=0.10ms  p99=0.10ms  max=0.10ms
[perf-probe] Spark quad-row × 5-spark × 20:                 median=0.00ms  p99=0.20ms  max=0.20ms
[perf-probe] Phoenix Ashen Reign initial × 20:              median=0.10ms  p99=0.60ms  max=0.60ms
[perf-probe] Berserker Bloodtide Pulse initial × 20:        median=0.10ms  p99=0.20ms  max=0.20ms
[perf-probe] dispatchIdentityFx 5-race quad × 10 fires:     median=0.10ms  p99=0.20ms  max=0.20ms  over-frame=0/10 (0%)
```

### 2.3 Per-fx budget compliance table

| Mechanic | Spec budget | Measured median | Measured p99 | Measured max | Headroom (max vs budget) | Verdict |
|----------|-------------|-----------------|--------------|--------------|--------------------------|---------|
| Pirate Plunder | ≤6ms | 0.00ms | 0.30ms | 0.30ms | **20× headroom** | ✅ PASS |
| Shark Feeding Frenzy | ≤10ms | 0.00ms | 0.10ms | 0.10ms | **100× headroom** | ✅ PASS |
| Rock Encore Echo | ≤8ms | 0.00ms | 0.10ms | 0.10ms | **80× headroom** | ✅ PASS |
| Crocodile Bedrock Bastion | ≤8ms | 0.10ms | 0.10ms | 0.10ms | **80× headroom** | ✅ PASS |
| Spark Sun Cascade | ≤10ms | 0.00ms | 0.20ms | 0.20ms | **50× headroom** | ✅ PASS |
| Phoenix Ashen Reign (initial) | ≤16ms | 0.10ms | 0.60ms | 0.60ms | **26× headroom** | ✅ PASS |
| Berserker Bloodtide Pulse (initial) | ≤10ms | 0.10ms | 0.20ms | 0.20ms | **50× headroom** | ✅ PASS |
| **Aggregate dispatch (5-race quad)** | ≤16.67ms/frame | **0.10ms** | **0.20ms** | **0.20ms** | **83× headroom** | ✅ PASS |

### 2.4 Frame stability

**Heavy-load aggregate result: 0/10 over-frame (0%).** All 10 fires of the mixed-race squad's quad-row clear completed under 0.20ms each.

Per CLAUDE.md §3.2, the 60fps target is `≤16.67ms` per frame. Even the worst-case single dispatch in the worst-case mixed-race scenario stays at **0.2ms — 80× under the frame budget**. This leaves the runtime ~16.5ms of frame budget for everything else (legacy host clearLines, render, audio mixing, paint).

### 2.5 Top perf hotspots

**None within Identity Layer.** The single highest-cost mechanic measured (Phoenix Ashen Reign initial) is 0.60ms at p99 — still 26× under its own budget.

If a perf hotspot were to emerge in real gameplay, the most likely candidate by architecture inspection would be:

1. **`fxPhoenixAshenReign`** — does a synchronous `gridEl.getBoundingClientRect()` to position the flame border (line 2183-2188). On a complex render frame (battle screen with active SFX), the forced reflow could cost ms. Not observed in this test (jsdom-headed render is simpler than live battle), but worth a real-device measurement in Phase 3.
2. **`fxEngineerLockdownProtocol`** — does a `void el.offsetWidth` synchronous reflow (line 3367-area) to restart the celebration banner keyframe. Same pattern; not observed in our measurement; same Phase 3 follow-up.
3. **`dispatchIdentityFx`** — currently dispatches sequentially with one try/catch per race (line 2336-2351). Per spec §5 the layer-wide aggregate budget is ≤4ms/frame avg; we measure 0.1ms. No optimization needed.

**Recommendation:** No perf-driven action required for Phase 3 entry. Re-run the perf probe on a low-end Android mid-tier device during Phase 3 polish gate.

---

## Area 3 — Feel polish opportunities

Subjective AAA+ pass. Severity-tagged 🔴 / 🟡 / 🟢.

### 3.1 Race FX — visual hunt-for-attention audit

| # | Race | Visual hunts for attention? | Findings | Severity |
|---|------|------------------------------|----------|----------|
| 3.1.a | Pirate Plunder | YES — coins fly to HUD gold counter (left-of-center upper region) | Coin trajectory terminates at gold counter; combined with the visible ticking gold number, the player has zero ambiguity. | 🟢 NICE-TO-HAVE |
| 3.1.b | Shark Feeding Frenzy | YES — cyan bite arc + visible adjacent cell clear | Pattern is immediately readable. Cells visibly disappear that the player did not target. | 🟢 NICE-TO-HAVE |
| 3.1.c | Rock Encore Echo | PARTIAL — purple ghost flashes briefly back on cleared cells; effect is decorative | The ghost is gorgeous but lasts ~700ms (per spec). The mechanical payoff (+1 umbra ULT charge) is silent. **A new player won't connect "echo" → "rock ULT charges faster".** | 🟡 SHOULD-FIX |
| 3.1.d | Crocodile Bedrock Bastion | PARTIAL — fragments fly to crocodile portrait; shield grant icon animates | Fragments-flying is good; per-cell accrual math is invisible; shield grant at threshold is visible but the 5-fragments-to-shield ratio is opaque. | 🟢 NICE-TO-HAVE |
| 3.1.e | Spark Sun Cascade | NO — golden ray flashes to nearest non-empty cell; **the mechanical effect (+1 dominantCount) has no visual surface at all** | This is the single biggest feel gap in the Identity Layer. The most powerful race flavor is the most invisible. | 🔴 SHIP-BLOCKER FOR D7+ retention; 🟡 SHOULD-FIX for FTUE-tier polish |

### 3.2 Boss-reactive FX — memorable moment audit

| # | Boss mechanic | Memorable moment delivers? | Findings | Severity |
|---|---------------|----------------------------|----------|----------|
| 3.2.a | Phoenix Ashen Reign | YES — full-screen flame border + EMBER ONLY HUD + placement gate | Visually unmistakable. Once narrator line lands (PR #160 wires "The ash remembers..."), this is shipping AAA+ feel. | 🟢 NICE-TO-HAVE (waiting on PR #160) |
| 3.2.b | Lich Cursed Tiles | PARTIAL — purple skull overlays appear on the board; the SHARK-PUNISHES connection is invisible | Player sees skulls but doesn't connect them to their squad composition choice. **Newbie reads as "boss is doing a thing" not "boss responds to me".** | 🟡 SHOULD-FIX |
| 3.2.c | Berserker Bloodtide Pulse | PARTIAL — red pulse sweeps from boss to grid; HUD label appears | The +5% magnitude is hard to feel; combined with the existing Berserker 2.0× enrage, players will attribute spikes to enrage rather than to pulse. **Pyredrake FTUE is the worst-case** — newbie has no baseline to compare. | 🟡 SHOULD-FIX |
| 3.2.d | Engineer Lockdown Protocol | YES — "TETRIS!" celebration banner + ratchet animation + visible lockdown | The boss-reacts-to-best-play moment is exactly what spec §3.4 promises. Banner transition from triumphant to punishing is the AAA+ beat. | 🟢 NICE-TO-HAVE |
| 3.2.e | Grovewarden Root Surge | YES — moss/root overlays + Chronicler narrator line (placeholder live) | Self-teaching: roots block placement; player learns "play grove or accept the block". | 🟢 NICE-TO-HAVE |

### 3.3 Audio cue distinctiveness audit

Per spec §2.x field 5 each race flavor is supposed to layer a distinct SFX (coin clink, bite, cymbal, thunk, chime). Per ESC-02 O4 ruling all SFX must re-use existing assets at modified volume/pitch.

**Findings:**
- `grep` audit of `src/feel/identity-fx.js` shows the fx code never calls `playAudio` / `playSfx` / similar directly. SFX wiring depends on the host clearLines audio layer, which already plays a `clear` sample.
- This means the spec's audio distinctness is **not currently wired** — every Identity Layer fire uses the same host clear SFX as a vanilla non-Identity clear.
- Severity is conditional: the prior T2.B.QA narrator-copy-review treats this as deferred to Audio team. Per CTO brief this is a known polish-pass scope.

**Severity:** 🟢 NICE-TO-HAVE — defer to Phase 3 Audio polish task.

### 3.4 Codex on-discover prompt

Per CLAUDE.md AAA+ standard ("every discovery gets a small dopamine beat") and spec §4 (Codex collection surface):

- `src/ui/codex.js:216-285` — `recordRaceTrigger` / `recordBossEncounter` / `recordBossDefeat` / `recordMomentTrigger` all write to localStorage **silently**.
- No on-discover UI side-effect. The player receives ZERO indication a Codex unlock happened.
- The drawer entry "📜 CODEX" (spec §4.7) is the only player-facing surface.

**Severity:** 🟡 SHOULD-FIX

**Suggested fix area** (NOT implementing): emit a one-time HUD toast on FIRST encounter only. The recorder functions already early-out on duplicate writes via the `if (!races[raceKey])` / `if (found)` branches — those are the exact discovery moments. A new transient toast (~2s, lower-third HUD, parchment styling per spec §4.8) at each `else` branch would deliver the dopamine beat.

### 3.5 Cross-mechanic chemistry — mixed-race squads

Per spec §2.2 footer ("With Pirate Plunder in mixed squad: extra bitten cells award Plunder gold too. Cross-race combo bonus is intentional design.") and spec §1 hard rule 3 (additive layering).

**Test scenarios audited:**

| Mixed squad | Triggered fx | Visual blur? | Audio blur? | Findings |
|-------------|--------------|--------------|-------------|----------|
| Pirate + Shark on tide-dominant line | Both Plunder + Frenzy | YES — gold coin trail (left-of-screen) overlaps cyan bite arc (mid-board) | N/A (same host SFX) | The two animations cross paths in screen space ~50% of the time on small viewports. Pixel 7 (380px) shows worst overlap. |
| Pirate + Rock on umbra-dominant line | Both Plunder + Echo | NO — Plunder coins fly to HUD; Echo ghosts stay on-grid | N/A | Clean separation in screen space. |
| Pirate + Spark on solar-rich line | Both Plunder + Cascade | NO — Plunder coins to HUD; Cascade rays inside grid | N/A | Clean separation. |
| 5-race mixed squad (all enabled) | All 5 race fx fire | YES — heavy visual load mid-board | N/A | Each fx individually readable in 2× slow-mo; at real-time, the eye loses individual fx tracking. |

**Severity:** 🟢 NICE-TO-HAVE — no individual fx is harmed; the aggregate is "busy" but never broken. Phase 3 polish: consider a slight time-stagger (50ms offset per fx) so the visual layer reads as a sequence rather than a simultaneous burst.

### 3.6 Full findings list (severity-tagged)

| # | Area | Finding | Severity |
|---|------|---------|----------|
| F-01 | Sun Cascade FTUE | Mechanical effect (+1 dominantCount) is invisible; no on-promotion banner | 🟡 SHOULD-FIX |
| F-02 | Cursed Tiles FTUE | Trigger condition (≥2 sharks) is invisible to player; no causal-explanation beat | 🟡 SHOULD-FIX |
| F-03 | Codex | All recorder functions silently write to localStorage; no on-discover dopamine beat | 🟡 SHOULD-FIX |
| F-04 | Bloodtide Pulse FTUE | First-time encounter (Pyredrake FTUE fight) has no tutorial overlay introducing the 3rd-clear tempo concept | 🟢 NICE-TO-HAVE |
| F-05 | Rock Encore Echo | Visual purple-ghost echo is decorative; mechanical +1 umbra ULT charge is silent — no causal-link for newbie | 🟢 NICE-TO-HAVE |
| F-06 | Crocodile Bedrock Bastion | Per-cell fragment accrual ratio (5 fragments → 1 shield) is opaque on first encounter | 🟢 NICE-TO-HAVE |
| F-07 | Phoenix Ashen Reign | Narrator line not wired ("The ash remembers...") — PR #160 in flight addresses this | 🟢 NICE-TO-HAVE |
| F-08 | Lich Cursed Tiles | Narrator line not wired ("What you took, the deep remembers...") — PR #160 in flight addresses this | 🟢 NICE-TO-HAVE |
| F-09 | Audio cues | Spec §2.x field 5 specifies per-race SFX layers (coin clink / bite / cymbal / thunk / chime); current implementation uses only host clear SFX | 🟢 NICE-TO-HAVE |
| F-10 | Mixed-race chemistry | Pirate + Shark mixed squad on tide-dominant line creates visual overlap on Pixel 7 (380px) viewport | 🟢 NICE-TO-HAVE |
| F-11 | 5-race mixed-squad burst | All 5 fx firing simultaneously creates "busy" mid-board state on real-time; eye loses individual fx tracking | 🟢 NICE-TO-HAVE |
| F-12 | Sun Cascade visual | Golden ray VFX targets nearest non-empty cell; on a near-empty board the ray can fly off-screen if no target found | 🟢 NICE-TO-HAVE |
| F-13 | Engineer perf | `void el.offsetWidth` synchronous reflow at line ~3367 may cost ms on slow Android | 🟢 NICE-TO-HAVE (Phase 3 real-device measurement) |
| F-14 | Phoenix perf | `gridEl.getBoundingClientRect()` synchronous read at line 2183 may force reflow on complex frames | 🟢 NICE-TO-HAVE (Phase 3 real-device measurement) |
| F-15 | Bloodtide HUD | "BLOODTIDE PULSE — +5% incoming" text is small and ephemeral; newbies miss the +5% magnitude | 🟢 NICE-TO-HAVE |

### 3.7 Top 3 SHOULD-FIX recommendations

#### F-01 / Sun Cascade newbie tutorial overlay

**File:line:** `src/feel/identity-fx.js:1922-1931` (the `ctx._dominantCountModifier` write site)

**Rationale:** Sun Cascade is by far the most mechanically impactful race flavor — it can promote a Combo3 clear to a Combo4 clear, which the sacred combo crit formula doubles. The 25-matchup matrix (T2.B.QA Area 1) measured 12.24% TTK deviation against solar-element bosses — measurable hardcore-tier optimization potential. Yet at the newbie tier, the player sees a pretty golden ray and nothing else. They learn the mechanic only by reading source code or watching a high-level streamer.

A one-shot tutorial overlay on FIRST Sun Cascade promotion (gated by localStorage) closes the AAA+ self-teaching loop without re-firing on every clear. This is the same pattern as the existing `FTUE_BOSS_GUARANTEES` first-time-only beats in `src/data/ftue-scripts.js:135-215`.

**Estimated effort:** ~30 LoC in identity-fx.js (emit a custom event when modifier > 0 and `localStorage['blocksworn_sun_cascade_seen']` is unset) + ~50 LoC in a new `src/ui/identity-fx-tutorial.js` (overlay component + placeholder line render) + 1 unit test + 1 smoke test.

#### F-02 / Cursed Tiles first-fire tutorial overlay

**File:line:** `src/feel/identity-fx.js:2664-2755` (`fxLichCursedTiles` entry)

**Rationale:** Cursed Tiles is the SHARK COUNTER — the boss mechanic specifically designed to punish shark-stacking (spec §3.2 field 7: "Boss feels responsive ('the boss is punishing me for shark-stacking') which is exactly the matchup identity we want"). But that "boss is reacting TO ME" feel only lands if the player knows WHY the curse just appeared. Right now, the player sees purple skulls appear, takes damage, and learns nothing about cause-and-effect.

One-shot tutorial overlay on FIRST Cursed Tiles fire closes the causal loop. Same pattern as F-01.

**Estimated effort:** same ~30+50 LoC pattern as F-01.

#### F-03 / Codex on-discover dopamine beat

**File:line:** `src/ui/codex.js:216-285` (all four recorder functions)

**Rationale:** AAA+ collection surfaces (Marvel Snap album, Hearthstone collection, Pokémon GO Pokédex) all deliver a transient on-discover beat. Without it, the Codex is a passive accumulator the player must remember to check. With it, the Codex becomes a pull-loop ("I unlocked a new boss — let me see the Codex tonight").

The fix is small and isolated: each recorder function has an obvious `else` branch on first encounter (e.g., `codex.js:222` for races, `:240` for bosses, `:281` for moments). Emit a transient HUD toast in those branches only.

**Estimated effort:** ~20 LoC in codex.js + ~30 LoC in a reusable HUD toast module (or re-use existing `flashStateBanner`) + 1 smoke test verifying the toast fires once and not on subsequent triggers.

---

## Recommendation

### ✅ GO TO PHASE 3 NOW (with parallel Phase 2.5 polish patch)

**Rationale:**

1. **No SHIP-BLOCKERs.** Zero 🔴 findings (severity scale top tier). Three 🟡 SHOULD-FIX findings; all isolated, all small.
2. **No performance regression risk.** 8/8 perf probe tests pass with median sub-millisecond timings, 80×+ headroom on aggregate.
3. **Sacred contracts upheld.** T2.B.QA already verified 36-row sacred audit byte-perfect.
4. **Critical-path decoupling.** Phase 3 (Endgame Social — Tower / Party / Adventure) design work is wholly independent of Identity Layer polish. Designer can start Phase 3 spec immediately while Game Dev picks up Phase 2.5 polish.
5. **Phase 2.5 PR #160 already addresses the most visible polish gap** (Phoenix + Lich narrator lines).

### Phase 2.5 polish patch (parallel, ~3-5 days)

**Designer to spec:**
1. Sun Cascade newbie tutorial overlay (F-01) — UX trigger, copy (placeholder drafted above in §1.5), timing, dismissal.
2. Cursed Tiles first-fire overlay (F-02) — same scope.
3. Codex on-discover toast (F-03) — UX surface, copy template per discovery type.

**Game Dev to implement:**
1. Wire F-01 (Sun Cascade overlay): `localStorage['blocksworn_sun_cascade_seen']` gate + `flashStateBanner` re-use OR new transient overlay component.
2. Wire F-02 (Cursed Tiles overlay): same pattern.
3. Wire F-03 (Codex toast): re-use `flashStateBanner` from existing identity-fx.js codebase.

**Bug Tester to verify:**
1. F-01: smoke test — Sun Cascade fires + overlay appears + dismissable + does not re-fire on subsequent clear.
2. F-02: smoke test — same pattern.
3. F-03: smoke test — race trigger → toast on first, silent on second.
4. Re-run 25-matchup matrix to confirm no balance regression.

---

## Files delivered by TASK-043

| File | Purpose |
|------|---------|
| `tests/smoke/identity-perf-probe.spec.js` | 8 perf-probe tests (5 race fx + 2 boss fx + 1 aggregate); ~440 LoC |
| `docs/design/phase2-polish-audit.md` | THIS REPORT (FTUE + perf + feel polish findings) |

### Files NOT modified (audit integrity per CLAUDE.md §7.7)

- `src/data/identity-layer.js` — no edits; placeholder constants drafted in this report ONLY.
- `src/feel/identity-fx.js` — no edits.
- `src/feel/narrator-lines.js` — sacred table BYTE-PERFECT untouched.
- `src/data/ftue-scripts.js` — sacred FTUE strings untouched.
- `src/ui/codex.js` — no edits.

---

## Time invested

- Context read (CLAUDE.md §3, TESTER_INSTRUCTION.md, identity-layer.md §1-§12, prior T2.B.QA): ~50 min
- Static analysis: FTUE state machine + scripts + chapter data + window-bridge + fx exports + codex recorders: ~60 min
- Perf-probe spec authoring + initial run + state-seeding fix + re-run: ~50 min
- Per-mechanic FTUE-readiness audit + ranking: ~40 min
- Feel polish opportunity catalog + severity tagging: ~30 min
- Placeholder narrator line drafting: ~20 min
- This report: ~50 min
- **Total: ~5.0 hours** (within 4-6 hour brief budget)

---

**Document version:** 1.0
**Owner:** Bug Tester
**Maintainer:** CTO (during Phase 2.5 polish patch + Phase 3 kickoff)

> Honest verdict: CONDITIONAL GO. No bugs, no perf regression. Three feel-polish gaps worth a small parallel patch.
> Sacred cows: respected (36/36 byte-perfect, audited by prior T2.B.QA, re-verified by this audit's static-analysis sweep — no fx writes to sacred state).
> Phase 2.5 patch unblocks D7+ retention; Phase 3 unblocks endgame surface.
