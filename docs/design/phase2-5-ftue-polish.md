# Phase 2.5 FTUE Polish — Design Spec (TASK-044)

**Status:** REVIEW — awaiting CTO sign-off + Roman copy approval (ESC-02 O2 pattern)
**Task:** TASK-044 (Phase 2.5 FTUE polish design specs)
**Author:** Game Designer
**Date:** 2026-05-13
**Phase:** 2.5 (polish patch — parallel to Phase 3 kickoff)
**Trigger:** Bug Tester audit `docs/design/phase2-polish-audit.md` (2026-05-13) identified 3 SHOULD-FIX FTUE gaps in shipped Identity Layer (Phase 2 PR #159 merged `6545b57`). Phase 2.5 narrator PR #160 already addresses boss-line-on-every-fire pattern; this spec addresses the **complementary first-time-only tutorial overlays** that teach the player WHAT the mechanic does on first encounter.
**Implementation status:** Not started (Game Dev wires per this spec after CTO + Roman approval).

---

## 0. Executive summary

Three (optionally four) first-time-only tutorial overlays close the AAA+
self-teaching loop for the highest-impact Identity Layer mechanics that
the player otherwise learns only by reading source code. Each overlay
fires **exactly once per player** (gated by localStorage), reuses
existing visual infrastructure where possible, and respects every
sacred cow in CLAUDE.md §2.

| ID | Mechanic | Trigger | Surface | Persistence key | Copy refinement |
|----|----------|---------|---------|-----------------|-----------------|
| **F-01** | Sun Cascade first promotion | First `_dominantCountModifier` write | NEW `showFirstTimeTutorialOverlay` | `blocksworn_sun_cascade_seen` | **REDLINED** (see §3.1.5) |
| **F-02** | Cursed Tiles first fire | First `fxLichCursedTiles` execution | NEW `showFirstTimeTutorialOverlay` | `blocksworn_cursed_tiles_seen` | **REDLINED** (see §3.2.5) |
| **F-03** | Codex on-discover toast | First-time race/boss/moment record | RE-USE `flashStateBanner` | (none — uses existing Codex state) | New copy per discovery type (§3.3.5) |
| **F-04** | Bloodtide Pulse first fire (OPTIONAL) | First `fxBerserkerBloodtidePulse` | NEW `showFirstTimeTutorialOverlay` | `blocksworn_bloodtide_seen` | **REDLINED** (see §3.4.5) |

**Architecture decision (§2):** Option **C** — F-01/F-02/F-04 use a new
richer overlay component (`src/ui/identity-fx-tutorial.js`); F-03 re-uses
`flashStateBanner` (it's a dopamine beat, not a tutorial).

**Total new code estimate:** ~110 LoC across two new files +
~40 LoC additions to identity-fx.js + ~25 LoC additions to codex.js.

**Open questions for Roman (ESC-02 O2 batch):** 4 — see §6.

---

## 1. Audit & rationale

### 1.1 Why these three (and not the other twelve audit findings)

Bug Tester's audit (`phase2-polish-audit.md` §3.6) catalogued 15
findings, tagged 3 🟡 SHOULD-FIX and 12 🟢 NICE-TO-HAVE. This spec covers
the 3 SHOULD-FIX entries (F-01 / F-02 / F-03) and assesses F-04
(Bloodtide Pulse FTUE) as a B→A "optional promotion".

The other 12 NICE-TO-HAVE findings (Rock Encore Echo, Crocodile Bedrock
Bastion per-cell math, Audio cue distinctness, Mixed-race visual blur,
etc.) are deferred to Phase 3 polish gates per CTO direction. Rationale:
the C-ranked FTUE gaps are causality-loop failures (player can't see why
something happened); the B-ranked NICE-TO-HAVE findings are mostly
clarity gradations (player understands "something happened" just not the
full optimization curve). Causality before clarity, per AAA+ first-5-min
standard (CLAUDE.md §3.6).

### 1.2 The "Phase 2.5 PR #160" complement

PR #160 (in flight) wires Phoenix Ashen Reign + Lich Cursed Tiles
narrator lines **per-fire** ("The ash remembers..." / "What you took,
the deep remembers..."). That is the Darkest-Dungeon boss-voice layer
that fires on **every** mechanical activation.

THIS spec is **complementary, not overlapping**: it wires
**first-time-only** tutorial overlays that teach **causality** ("you
hunt with sharks → the Lich hunts hunters"). The two layers stack:

| Fire # | PR #160 (boss line, every fire) | This spec (tutorial, first only) |
|--------|---------------------------------|----------------------------------|
| 1st | "What you took, the deep remembers." | "You hunt with sharks. The Lich hunts hunters..." |
| 2nd | "What you took, the deep remembers." | (silent — already seen) |
| 3rd | "What you took, the deep remembers." | (silent) |

Both lines fire on the first invocation; the tutorial overlay leads
(causality first), the boss line follows (atmospheric reinforcement).
Choreography detail in §4.4.

### 1.3 Sacred cow audit (pre-commit)

| Sacred system | Touched by this spec? | How |
|---------------|----------------------|-----|
| `NARRATOR_LINES` table (CLAUDE.md §2.3) | NO | Tutorial copy lives in new isolated constants in `src/data/identity-layer.js` parallel to `ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER` (§4.1) |
| Combat math (CLAUDE.md §2.1) | NO | Zero damage / threshold / multiplier writes |
| `V_HAPTICS` table (CLAUDE.md §2.2) | NO | Re-uses existing `clear` key (25ms) on overlay dismiss only |
| 5-beat boss death cinematic | NO | Untouched |
| 10 Identity Layer fx mechanical contracts | NO | Trigger-only side-effect (read after mechanical write, no mutation) |
| Codex `localStorage[blocksworn_codex_state]` isolation | YES — additively | F-03 re-uses existing `recordRaceTrigger`/etc. `else` branches; new tutorial keys (`blocksworn_sun_cascade_seen`, `blocksworn_cursed_tiles_seen`, `blocksworn_bloodtide_seen`) live in SEPARATE localStorage keys — no collision with codex state object |
| `flashStateBanner` UI surface (precedent: Root Surge wiring) | YES — re-use only | F-03 calls `flashStateBanner(text, color)` exactly as Root Surge already does (identity-fx.js:4350). No signature change. |
| Existing 22 v2.1 P4 reactivity handlers | NO | Untouched |
| `CODEX_LOCALSTORAGE_KEY` schema | NO | Tutorial flags use separate keys outside codex state object; codex schema v1 untouched |

**0 sacred cow modifications.** All copy is **pending Roman approval**
per the ESC-02 O2 placeholder-first ruling (resolved 2026-05-12) — same
pattern that shipped `ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER`.

---

## 2. Reusable overlay architecture — recommendation

### 2.1 Three options considered

**Option A — All 3 re-use `flashStateBanner`.**
- Pros: zero new UI infrastructure (~10 LoC per fire site).
- Cons: `flashStateBanner` is a one-line state banner. It supports
  `(text, color, durationMs)` — no icon, no multi-line, no
  click-to-dismiss. F-01/F-02 need 2 lines (cause + effect) to deliver
  the causal beat — collapsing to one line ("Combo climbs — solar
  remembers solar") removes the teaching half of the overlay.
- Verdict: **REJECT** for F-01/F-02. Acceptable for F-03.

**Option B — New `showFirstTimeTutorialOverlay(content)` for all 3.**
- Pros: uniform UX, richer parchment-style overlay, click-to-dismiss
  affordance for the tutorial fires.
- Cons: F-03 Codex discoveries are 60+ per playthrough (every race
  trigger × 25, every moment × N, every boss × N). A heavyweight
  overlay for each is visual fatigue. Codex discoveries should feel
  like a **small dopamine ping**, not a stop-and-read tutorial.
- Verdict: **REJECT** for F-03. Acceptable for F-01/F-02.

**Option C (RECOMMENDED) — Split by purpose: tutorial for F-01/F-02/F-04, toast for F-03.**
- F-01/F-02/F-04 use a NEW `src/ui/identity-fx-tutorial.js` overlay
  component (~80 LoC) — richer parchment card, 1 emblem + 2 lines,
  auto-dismiss at 5000ms OR click-to-dismiss.
- F-03 re-uses existing `flashStateBanner` — 1-line dopamine toast,
  auto-dismiss at 1800ms, no click affordance.
- Pros: each surface matches its purpose (tutorial = pause-and-read;
  toast = peripheral acknowledgement); minimal new code; preserves the
  existing `flashStateBanner` precedent for Codex.
- Cons: two surfaces instead of one — minor cognitive surface area.

### 2.2 Recommendation: **Option C**

**Rationale:**
1. **Information density matches purpose.** Causal-loop tutorials
   need 2 lines (cause + effect); dopamine beats need 1 line.
2. **Fire frequency matches surface.** Tutorial fires AT MOST 3 times
   per player (F-01/F-02/F-04 first-time gates). Toast fires 60+ times
   per playthrough. A heavy overlay on a 60+ event surface is fatigue.
3. **Precedent already exists.** `flashStateBanner` is the established
   one-shot beat surface in this codebase (used 25+ times across
   `heroes.js`, `damage-channels.js`, `reactivity-events.js`).
   F-03 should match that precedent.
4. **Sacred safety.** `flashStateBanner` is battle-proven (renders via
   `#stateBanner` DOM node, has FTUE Chronicle silence guard at
   `identity-fx.js`-adjacent legacy global). Re-using it for F-03 means
   we inherit that hardening for free.

### 2.3 Performance budget

| Component | Budget per fire | Justification |
|-----------|----------------|---------------|
| `showFirstTimeTutorialOverlay` (F-01/F-02/F-04) | ≤2ms per fire (first-only) | Single DOM node creation + CSS class swap; one-shot |
| `flashStateBanner` (F-03) | ≤2ms per fire (every Codex first-discovery) | Re-uses existing implementation; measured @ <0.3ms in identity perf probes |
| localStorage read (overlay gate check) | ≤0.5ms per gate check | Sync `localStorage.getItem` — fastest path |
| localStorage write (mark-as-seen) | ≤1ms per write (first-only) | Sync `localStorage.setItem` once per first-fire |

**Aggregate first-fire cost:** ≤3.5ms (overlay + gate + persist).
**Aggregate steady-state cost (after first-fire):** ≤0.5ms (gate
check returns early; overlay never instantiated).

Per CLAUDE.md §3.2 frame budget is ≤16.67ms at 60fps. First-fire cost
of 3.5ms leaves 13.17ms headroom for the rest of the frame — well
within budget. Steady-state cost of 0.5ms is **negligible** (3% of
frame budget) and matches the perf-probe envelope Bug Tester measured
on the existing Identity Layer (median 0.10ms aggregate).

### 2.4 Accessibility

- **prefers-reduced-motion:** Overlay slide-in animation is gated by
  `@media (prefers-reduced-motion: reduce)` CSS rule — falls back to
  instant fade-in (`opacity: 0 → 1` over 0ms transition).
- **Keyboard dismiss:** Overlay accepts `Escape` keypress to dismiss.
- **Touch dismiss:** Overlay accepts tap-anywhere-on-overlay to
  dismiss.
- **Auto-dismiss:** 5000ms default — long enough to read 2 lines;
  short enough to not feel like a blocking modal.
- **Color contrast:** Parchment beige `#E8DAB6` background + dark
  text `#2B1B0A` — meets WCAG AA at 13.5:1.
- **Focus management:** Tutorial overlay does NOT trap focus (it's
  not a modal, just a hint card layered above the grid).

---

## 3. Per-overlay specs

Each spec follows the **10-field** structure required by the task brief.

---

### 3.1 F-01 — Sun Cascade first-promotion tutorial overlay

#### 3.1.1 Identity name
**Sun Cascade First-Promotion Tutorial Overlay**

#### 3.1.2 Trigger condition

**EXACT predicate (evaluated inside `fxSparkLineClear` AFTER the
mechanical write at `src/feel/identity-fx.js:1930`, BEFORE the
visual ray spawn at line 1938):**

```
trigger ⟺ (
  modifier > 0                                                    // Sun Cascade actually promoted this clear
  AND ctx._dominantCountModifier was 0 before this fire           // first promotion this clearLines call
  AND localStorage.getItem('blocksworn_sun_cascade_seen') === null  // never fired before
  AND typeof document !== 'undefined'                             // DOM available (skips Node test envs)
)
```

The localStorage gate fires the overlay at MOST ONCE per browser /
localStorage namespace. Players who clear localStorage will see it
again — same UX contract as the existing Codex state and FTUE
progress.

**Defensive notes:**
- If `localStorage` is unavailable (private mode, quota exceeded),
  silently skip the overlay (return early, no error). Matches the
  defensive try/catch pattern used in `recordRaceTrigger` etc.
- The gate evaluates ONLY when `modifier > 0` — i.e., the player has
  spark in their squad AND the clear had ≥2 solar cells. This is the
  exact moment the player needs the lesson.

#### 3.1.3 Persistence key

`localStorage['blocksworn_sun_cascade_seen']`

Set to `'1'` (string) on first fire. Read as truthy/falsy. Separate
from `blocksworn_codex_state` (codex schema v1 is UNTOUCHED).

#### 3.1.4 Visual surface choice — RECOMMENDATION

**Use NEW `showFirstTimeTutorialOverlay(content)` component (Option C
recommendation §2.2).**

Rationale: Sun Cascade is the highest-impact race flavor (12.24% TTK
deviation vs solar bosses per Bug Tester §2). The mechanic mutates
`dominantCount` BEFORE the sacred combo crit formula — the most
delicate sacred-adjacent interaction in the Identity Layer. The
overlay needs 2 lines to teach: line 1 = what just happened ("Combo
climbs"), line 2 = why ("solar remembers solar"). A single-line
`flashStateBanner` collapses that to a slogan and removes the
teaching half.

**Component contract (full signature in §5.1):**

```js
showFirstTimeTutorialOverlay({
  emblem: 'spark',                                  // emblem key for icon
  title: 'SUN CASCADE',                             // small caps title
  lines: [TUTORIAL_LINE_PLACEHOLDER],               // 1-2 lines of body text
  accentColor: '#FFD700',                           // gold, matches Sun Cascade visual
  dismissOnTap: true,
  autoDismissMs: 5000,
});
```

#### 3.1.5 Copy — REFINED

**Bug Tester draft:**
> "The sun bends to your clearing hand. Combo climbs — solar
> remembers solar."

**Designer refinement (REDLINED):**

| Reason | Bug Tester draft | Designer redline |
|--------|------------------|------------------|
| "Combo climbs" is poetic but the player's HUD doesn't show a "Combo" number per se — they see the damage spike. The player needs the **causal link** between solar dominance and the damage spike. | "Combo climbs — solar remembers solar." | "Your strike was promoted. Solar burns brighter when solar is plentiful." |
| The proposed line ties **"strike was promoted"** to the visible damage number AND ties **"solar burns brighter when solar is plentiful"** to the mechanic gate (≥2 solar cells). Both halves are now teachable. |  |  |

**Final placeholder:**

```js
// FINAL COPY: pending Roman approval (Phase 2.5 polish pass).
// Trigger: FIRST TIME Sun Cascade promotes a Combo (modifier > 0).
// Persists via localStorage['blocksworn_sun_cascade_seen'] so it fires
// exactly once per player. Lives OUTSIDE sacred NARRATOR_LINES table
// per CLAUDE.md §2.3.
export const SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_LINES_PLACEHOLDER = Object.freeze([
  'Your strike was promoted.',
  'Solar burns brighter when solar is plentiful.',
]);
```

**Voice rationale:**
- 2 sentences total, 11 words.
- Second-person ("Your strike", not "the strike" or "a strike") —
  matches Chronicler tone (Darkest Dungeon "you are a stone hurled
  against").
- "Promoted" is the exact same verb the spec uses internally
  (`dominantCount` promotion) — vocabulary anchors the lesson.
- "Solar burns brighter when solar is plentiful" is poetic-aphoristic
  (Darkest Dungeon "the dark calls to its own"), not coach-speak ("Tip:
  clear lots of solar cells to maximize damage").
- No "Tutorial:" / "Tip:" / "Hint:" prefix — voice is Chronicler-style
  by default.

#### 3.1.6 Trigger timing

Within the `fxSparkLineClear` flow:

1. **(existing) Gate check:** `solarCellsInClear < 2` → no-op
2. **(existing) Mechanical write:** `ctx._dominantCountModifier = prev + modifier` (identity-fx.js:1930)
3. **NEW — Tutorial gate:** `if (modifier > 0 && !localStorage[KEY])`
4. **NEW — Fire overlay:** `showFirstTimeTutorialOverlay({...})` + `localStorage.setItem(KEY, '1')`
5. **(existing) Visual ray spawn:** identity-fx.js:1938+

Overlay fires **AFTER** the mechanical write so the player sees the
overlay AND the resulting damage spike together — the causal beat
lands when cause is visible alongside effect.

Overlay fires **BEFORE** the visual ray spawn so the overlay
sits on top of (not below) the ray VFX z-order.

#### 3.1.7 Dismissal

- **Auto-dismiss:** 5000ms (matches `ROOT_SURGE_ACTIVE_WINDOW_MS`
  precedent in Phoenix Ashen Reign — same "read window" length).
- **Tap-to-dismiss:** Yes (`dismissOnTap: true`).
- **Escape-to-dismiss:** Yes (keyboard accessibility).
- **Click-outside-to-dismiss:** No — the overlay is layered, not
  modal, so the player can keep playing while reading.
- **Programmatic close:** Yes — exposes `hideFirstTimeTutorialOverlay()`
  for tests + edge cases.

#### 3.1.8 Performance budget

| Operation | Budget | Measured (target) |
|-----------|--------|-------------------|
| Gate check (`localStorage.getItem`) | ≤0.5ms | sync; one read |
| Overlay DOM creation (first-fire only) | ≤2ms | one `document.createElement` + 4 child elements + CSS class swap |
| Overlay show animation | 200ms CSS transition (not on JS thread) | non-blocking |
| Auto-dismiss timer (`setTimeout`) | negligible | one timer registration |
| localStorage write (first-fire only) | ≤1ms | sync; one write |
| **Total first-fire wall-time** | **≤3.5ms** | well under 16.67ms frame budget |
| Steady-state wall-time (after first) | ≤0.5ms | gate check only; overlay never instantiated |

#### 3.1.9 Sacred cow safety

- `NARRATOR_LINES` table: UNTOUCHED. Tutorial copy lives in new
  isolated `SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_LINES_PLACEHOLDER`
  constant in `src/data/identity-layer.js`, parallel placement to
  `ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER` at line 858.
- `fxSparkLineClear` mechanical contract: UNTOUCHED. The
  `ctx._dominantCountModifier` write at line 1930 is read but never
  mutated by the new tutorial code. New code is inserted as a
  side-effect block BETWEEN the existing write and the existing visual
  spawn (lines 1931-1937 currently — empty insertion zone).
- All 10 fx invariants per identity-fx.js header: UNTOUCHED. Tutorial
  is read-only on fx state.
- New localStorage key `blocksworn_sun_cascade_seen` lives ALONGSIDE
  `blocksworn_codex_state` — NO collision (different keys; codex
  schema untouched).
- Sun Cascade combo-crit input mutation (ESC-02 O3, approved by Roman
  2026-05-12): UNTOUCHED. Spark's `+1 to dominantCount` is a separate
  concern; this tutorial only reads the result of that write.

#### 3.1.10 Acceptance criteria

For Game Dev:
- [ ] `showFirstTimeTutorialOverlay({...})` invoked from
  `fxSparkLineClear` after line 1930 mechanical write.
- [ ] `localStorage['blocksworn_sun_cascade_seen']` set to `'1'` on
  first fire.
- [ ] Gate check at top: if localStorage key set, do not fire.
- [ ] All errors swallowed (defensive `try/catch` — overlay must NEVER
  regress fx pipeline).
- [ ] `SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_LINES_PLACEHOLDER` constant
  added to `src/data/identity-layer.js` with placeholder marker
  comment.

For Bug Tester:
- [ ] Scenario A: fresh localStorage + spark in squad + 2+ solar cells
  in clear → overlay appears within 1 frame.
- [ ] Scenario B: same conditions + already-seen flag → no overlay.
- [ ] Scenario C: spark in squad + 1 solar cell (gate fail) → no
  overlay, no flag write.
- [ ] Scenario D: rapid-fire test (10 consecutive promoting clears) →
  exactly 1 overlay fire, 9 silent.
- [ ] Scenario E: localStorage disabled (private mode) → no crash, no
  overlay, fx pipeline unaffected.
- [ ] Scenario F: auto-dismiss timer at 5000ms.
- [ ] Scenario G: tap-to-dismiss works.
- [ ] Scenario H: Escape-to-dismiss works.
- [ ] Scenario I: prefers-reduced-motion fallback renders without
  animation.
- [ ] Performance: overlay first-fire wall-time ≤3.5ms median, ≤6ms
  p99.
- [ ] Sacred: NARRATOR_LINES table byte-perfect post-implementation.

---

### 3.2 F-02 — Cursed Tiles first-fire tutorial overlay

#### 3.2.1 Identity name
**Cursed Tiles First-Fire Tutorial Overlay**

#### 3.2.2 Trigger condition

**EXACT predicate (evaluated inside `fxLichCursedTiles` AFTER the
curse-placement loop completes at `src/feel/identity-fx.js:2729`,
BEFORE the Codex `recordMomentTrigger` call at line 2732):**

```
trigger ⟺ (
  picks.length > 0                                                     // curses were actually placed
  AND localStorage.getItem('blocksworn_cursed_tiles_seen') === null    // never fired before
  AND typeof document !== 'undefined'                                  // DOM available
)
```

Picks-length gate is necessary because `fxLichCursedTiles` silently
returns at line 2680 if the board has no non-empty cells —
in that edge case the player saw nothing happen, so the tutorial
should not fire.

#### 3.2.3 Persistence key

`localStorage['blocksworn_cursed_tiles_seen']`

Set to `'1'` on first fire. Same isolation contract as F-01.

#### 3.2.4 Visual surface choice

**Use NEW `showFirstTimeTutorialOverlay(content)` component (Option C).**

Rationale: Cursed Tiles is the **boss-responds-to-squad-composition**
mechanic. The player sees skull overlays appear and doesn't know:
(a) why they appeared, (b) what the player did to provoke them, (c)
what counterplay exists. The overlay must close ALL THREE causal
loops in 1-2 lines. Single-line `flashStateBanner` is insufficient.

**Component contract:**

```js
showFirstTimeTutorialOverlay({
  emblem: 'lich',                                   // boss emblem
  title: 'CURSED TILES',
  lines: [TUTORIAL_LINE_1, TUTORIAL_LINE_2],
  accentColor: '#9D40C4',                           // purple, matches CURSED_TILES_SKULL_COLOR
  dismissOnTap: true,
  autoDismissMs: 5000,
});
```

#### 3.2.5 Copy — REFINED

**Bug Tester draft:**
> "You hunt with sharks. The Lich hunts hunters. Three cursed tiles —
> wait them out, or vary your squad."

**Designer refinement (REDLINED):**

| Reason | Bug Tester draft | Designer redline |
|--------|------------------|------------------|
| Bug Tester's draft is 3 sentences (one of which is a fragment with a hyphen list) — too dense for an in-fight overlay. AAA+ first-5-min standard prefers 1-2 sentences. Specifically the "wait them out, or vary your squad" half is a coach-speak prescription ("how to play") rather than a causal beat ("why this is happening"). The on-EVERY-fire boss line ("What you took, the deep remembers.") is already poetic causality — the tutorial overlay should add the **explicit causal link** ("YOU hunt with sharks → the Lich hunts hunters"). The counterplay can be inferred from the visible 5-turn auto-clear timer + the +20 ULT reward — no need to spell out "wait them out". | "You hunt with sharks. The Lich hunts hunters. Three cursed tiles — wait them out, or vary your squad." | "You hunt with sharks. The deep hunts hunters." |
| Tightened to 2 sentences, 9 words, mirror-structure. The "deep" callback reinforces the on-EVERY-fire line ("the deep remembers") — vocabulary anchors the lesson across both surfaces. The counterplay is delegated to the visible mechanics (5-turn timer + ULT reward). |  |  |

**Final placeholder:**

```js
// FINAL COPY: pending Roman approval (Phase 2.5 polish pass).
// Trigger: FIRST TIME Cursed Tiles fires (after at least 1 curse
// placed). Persists via localStorage['blocksworn_cursed_tiles_seen']
// so it fires exactly once per player. The on-EVERY-fire boss line
// ("What you took, the deep remembers.") is wired via PR #160 —
// this tutorial line is the COMPLEMENTARY first-time causal beat.
// Lives OUTSIDE sacred NARRATOR_LINES table per CLAUDE.md §2.3.
export const CURSED_TILES_FIRST_FIRE_TUTORIAL_LINES_PLACEHOLDER = Object.freeze([
  'You hunt with sharks.',
  'The deep hunts hunters.',
]);
```

**Voice rationale:**
- 2 sentences, 9 words. Mirror-structure ("You hunt..." / "The deep
  hunts...") — Darkest Dungeon-style rhetorical reversal.
- Second-person ("You hunt") for cause; third-person "the deep"
  for effect — voice rotates between player-self-awareness and
  cosmic-indifference, exactly the Chronicler register.
- "The deep" vocabulary anchors the on-EVERY-fire boss line "What you
  took, the deep remembers." Player learns the boss's voice across
  both surfaces.
- No counterplay prescription — the visible 5-turn skull timer and
  the +20 ULT-on-expire reward teach counterplay themselves.

#### 3.2.6 Trigger timing

Within `fxLichCursedTiles`:

1. **(existing) Pick non-empty cells** (line 2679)
2. **(existing) Early-return on empty picks** (line 2680)
3. **(existing) Pool init + skull-overlay placement loop** (lines 2683-2729)
4. **NEW — Tutorial gate:** `if (picks.length > 0 && !localStorage[KEY])`
5. **NEW — Fire overlay:** `showFirstTimeTutorialOverlay({...})` + `localStorage.setItem(KEY, '1')`
6. **(existing) Codex recordMomentTrigger** (line 2732)

Overlay fires AFTER the visible skull-placement choreography
completes — the player has seen the cause (skulls appearing); the
overlay arrives to explain WHY.

**Interaction with PR #160's per-fire boss line:**
On the **first** fire only, both surfaces fire:
1. The tutorial overlay shows immediately ("You hunt with sharks.")
2. The boss line shows ~200ms later via PR #160's wiring
   (`flashStateBanner('What you took, the deep remembers.')`)

The 200ms stagger (matching the existing `_clearedSet` build-time
delay) ensures the tutorial reads first (player attention captured),
then the boss line reinforces (atmospheric layer). Confirmed
non-conflicting because `flashStateBanner` and
`showFirstTimeTutorialOverlay` use different DOM nodes
(`#stateBanner` vs new `#identity-fx-tutorial`).

On **subsequent** fires (after `blocksworn_cursed_tiles_seen` is
set), only the boss line fires — exactly matching the
"causality once, atmosphere always" architecture.

#### 3.2.7 Dismissal

Same as F-01: auto-dismiss 5000ms, tap, Escape. No click-outside;
not modal.

#### 3.2.8 Performance budget

Same as F-01: ≤3.5ms first-fire, ≤0.5ms steady-state.

Cursed Tiles' existing `CURSED_TILES_INITIAL_BUDGET_MS` is 16ms
(per the budget check at identity-fx.js:2737). The new overlay
adds ≤3.5ms — total first-fire `fxLichCursedTiles` execution stays
under 20ms, **first-fire only**. Steady-state remains at the original
16ms ceiling. This is a one-time +3.5ms cost per player, not a
recurring overhead.

#### 3.2.9 Sacred cow safety

- `NARRATOR_LINES` table: UNTOUCHED. New constant
  `CURSED_TILES_FIRST_FIRE_TUTORIAL_LINES_PLACEHOLDER` lives in
  `src/data/identity-layer.js` parallel to existing placeholders.
- `fxLichCursedTiles` mechanical contract: UNTOUCHED. New code is a
  side-effect block BETWEEN the existing skull-placement loop and the
  existing Codex recording call — no mutation of `_cursedTiles`
  array or any fx state.
- PR #160's boss line wiring: COMPATIBLE. Both surfaces use isolated
  DOM nodes; sequential firing order documented above.
- All 10 fx invariants: UNTOUCHED.
- New localStorage key `blocksworn_cursed_tiles_seen` isolated from
  codex state.

#### 3.2.10 Acceptance criteria

For Game Dev:
- [ ] `showFirstTimeTutorialOverlay({...})` invoked from
  `fxLichCursedTiles` after line 2729 (skull-placement loop end).
- [ ] `localStorage['blocksworn_cursed_tiles_seen']` set to `'1'` on
  first fire.
- [ ] Gate check: if localStorage key set OR `picks.length === 0`, no
  fire.
- [ ] All errors swallowed (defensive try/catch).
- [ ] `CURSED_TILES_FIRST_FIRE_TUTORIAL_LINES_PLACEHOLDER` constant
  added to `src/data/identity-layer.js`.
- [ ] Verify PR #160 boss line still fires on subsequent fires (no
  regression).

For Bug Tester:
- [ ] Scenario A: fresh localStorage + shark squad triggers Lich
  → overlay appears within 1 frame.
- [ ] Scenario B: same conditions + already-seen → no overlay.
- [ ] Scenario C: PR #160 line still fires alongside tutorial on
  first fire (both surfaces).
- [ ] Scenario D: PR #160 line still fires on second+ fires; tutorial
  overlay silent.
- [ ] Scenario E: edge — Lich fires with `picks.length === 0` (board
  fully empty) → no overlay, no flag write, no error.
- [ ] Scenario F: localStorage disabled → no crash.
- [ ] Performance: overlay first-fire wall-time ≤3.5ms median.
- [ ] Sacred: NARRATOR_LINES byte-perfect; existing fx state untouched.

---

### 3.3 F-03 — Codex on-discover dopamine toast

#### 3.3.1 Identity name
**Codex On-Discover Dopamine Toast**

#### 3.3.2 Trigger condition

Fires in **5 distinct discovery moments**, each gated by an `else`
branch in the existing recorder functions (no NEW localStorage keys
needed — codex state itself is the gate):

| Discovery type | Source location | Gate condition | Copy template |
|----------------|-----------------|----------------|---------------|
| Race encountered | `src/ui/codex.js:221` (`if (!races[raceKey])` branch) | First write — `races[raceKey]` was undefined before this call | `"<RACE NAME> — recorded in the Codex."` |
| Race mastered | `src/ui/codex.js:227-229` (`triggerCount >= CODEX_RACE_MASTERY_THRESHOLD` AND was just promoted from false→true) | Transition: previously `mastered: false`, now `mastered: true` | `"<RACE NAME> mastered. The Codex remembers."` |
| Boss encountered | `src/ui/codex.js:239` (`if (!bosses[bossKey])` branch in `recordBossEncounter`) | First write — `bosses[bossKey]` was undefined | `"<BOSS NAME> — its name is now known."` |
| Boss defeated | `src/ui/codex.js:258-260` (`defeatedCount >= CODEX_BOSS_MASTERY_DEFEATS` AND was just promoted from false→true) | Transition: previously `mastered: false`, now `mastered: true` | `"<BOSS NAME> — defeated. A page is added."` |
| Moment witnessed | `src/ui/codex.js:280` (`else` branch of `if (found)` in `recordMomentTrigger`) | First fire of this moment ID | `"NEW MOMENT — <IDENTITY NAME>."` |

Note: race "encountered" and race "mastered" can fire on the SAME
`recordRaceTrigger` call only in the pathological case of
`CODEX_RACE_MASTERY_THRESHOLD === 1` (currently 25). In practice
mastered fires 24+ triggers after encountered — no double-toast risk.

#### 3.3.3 Persistence key

**No new localStorage key.** Re-uses the existing
`blocksworn_codex_state` schema (CODEX_LOCALSTORAGE_KEY) — the
encountered/mastered transitions ARE the gate.

#### 3.3.4 Visual surface choice — RECOMMENDATION

**Re-use existing `flashStateBanner` (Option C).**

Rationale: Codex discoveries are **dopamine beats**, not tutorials.
The player has just had a small "I unlocked something" moment; a
1-line toast acknowledging it is the AAA+ standard (Marvel Snap
card-unlock burst, Hearthstone collection-grow). A multi-line
tutorial overlay would feel like a stop-and-read interruption every
60+ events.

**`flashStateBanner` signature** (verified from
`docs/_legacy/_archive_v1/blocksworn_index_fixed.html:65803`):

```js
flashStateBanner(text, color, durationMs)
```

- `text`: HTML string (rendered via `el.innerHTML` — XSS risk noted;
  we control all strings, no user input).
- `color`: optional accent color (matches `--state-color` CSS var).
- `durationMs`: optional dismiss timer (defaults to `_STATE_BANNER_DEFAULT_MS`).

**Per-discovery call signatures:**

| Discovery type | `flashStateBanner` call | Color rationale |
|----------------|--------------------------|-----------------|
| Race encountered | `flashStateBanner('PIRATE — recorded in the Codex.', '#E8DAB6', 1800)` | Parchment beige (matches Codex aesthetic spec §4.8) |
| Race mastered | `flashStateBanner('PIRATE mastered. The Codex remembers.', '#FFD700', 2200)` | Gold (matches "Mastered" badge gilded border spec §4.5) |
| Boss encountered | `flashStateBanner('SOLAR PHOENIX — its name is now known.', '#E8DAB6', 1800)` | Parchment |
| Boss defeated | `flashStateBanner('SOLAR PHOENIX — defeated. A page is added.', '#FFD700', 2200)` | Gold (defeat parity with race-mastery dopamine weight) |
| Moment witnessed | `flashStateBanner('NEW MOMENT — ASHEN REIGN.', '#E8DAB6', 1800)` | Parchment |

#### 3.3.5 Copy — REFINED

**Bug Tester draft templates:**
- Race encountered: `"<RACE NAME> — recorded in the Codex."`
- Race mastered: `"<RACE NAME> mastered. The Codex remembers."`
- Boss encountered: `"<BOSS NAME> — its name is now known."`
- Boss defeated: `"<BOSS NAME> — defeated. A page is added."`
- Moment witnessed: `"NEW MOMENT — <IDENTITY NAME>."`

**Designer refinement (KEEP-AS-IS for 4 of 5, REDLINE 1):**

| Discovery type | Bug Tester draft | Designer verdict | Justification |
|----------------|------------------|------------------|---------------|
| Race encountered | "<RACE NAME> — recorded in the Codex." | **KEEP** | Concise, Chronicler-voice ("recorded" — archival language), 6 words. |
| Race mastered | "<RACE NAME> mastered. The Codex remembers." | **KEEP** | "The Codex remembers" anchors the same vocabulary as boss-voice "the deep remembers" (PR #160). Codex personification is a sustainable narrative thread. |
| Boss encountered | "<BOSS NAME> — its name is now known." | **KEEP** | "Its name is now known" — knowledge-as-power phrasing, Darkest Dungeon-adjacent. |
| Boss defeated | "<BOSS NAME> — defeated. A page is added." | **REDLINE** | "A page is added" is mechanical — the Codex is a collection, not a binder. Suggested redline: "<BOSS NAME> falls. The Codex grows." Mirrors race-mastery line vocabulary ("grows" vs "remembers"). |
| Moment witnessed | "NEW MOMENT — <IDENTITY NAME>." | **KEEP** | All-caps "NEW MOMENT" is the universal collection-game beat (Marvel Snap "NEW CARD!"). Pairs identity name without dressing. |

**Final templates (as JavaScript constants):**

```js
// FINAL COPY: pending Roman approval (Phase 2.5 polish pass).
// Codex on-discover dopamine toast templates. ALL strings are
// composed at fire-time via JS template literal — no copy lives in
// the sacred NARRATOR_LINES table.
//
// Templates use `{name}` placeholder; replaced by the upstream race /
// boss / moment display name at call site.
export const CODEX_TOAST_RACE_ENCOUNTERED_PLACEHOLDER = '{NAME} — recorded in the Codex.';
export const CODEX_TOAST_RACE_MASTERED_PLACEHOLDER    = '{NAME} mastered. The Codex remembers.';
export const CODEX_TOAST_BOSS_ENCOUNTERED_PLACEHOLDER = '{NAME} — its name is now known.';
export const CODEX_TOAST_BOSS_DEFEATED_PLACEHOLDER    = '{NAME} falls. The Codex grows.';
export const CODEX_TOAST_MOMENT_WITNESSED_PLACEHOLDER = 'NEW MOMENT — {NAME}.';
```

**Voice rationale:**
- All 5 templates are 1 sentence, 4-8 words.
- Vocabulary anchors: "the Codex remembers" / "the Codex grows" /
  "its name is now known" — collection-as-personified-archive thread
  consistent with Chronicler voice.
- "NEW MOMENT" all-caps for moments only — universal
  collection-game grammar (Marvel Snap precedent).
- All names rendered in CAPS to match existing HUD label style
  (`'BLOODTIDE PULSE — +5% incoming'`, `'TETRIS!'`).

#### 3.3.6 Trigger timing

Fires **inside the existing recorder function** AT THE end of the
`else` branch that detects first-encounter. New code is inserted:

```
recordRaceTrigger(raceKey):
  ...
  if (!races[raceKey]) {                                // ← gate already exists
    races[raceKey] = { encountered: true, ... };        // ← existing
    // NEW: emit toast for race encounter
    emitCodexToast('race_encountered', raceKey);        // ← INSERT HERE
  }
  ...
  // NEW: check mastery transition
  if (justBecameMastered) {                             // ← INSERT
    emitCodexToast('race_mastered', raceKey);           // ← INSERT
  }
```

The toast fires **AFTER** the codex state is mutated and **AFTER**
`saveCodexState(state)` persists — so even if the toast emission
fails, the codex state is correctly persisted.

#### 3.3.7 Dismissal

`flashStateBanner` auto-dismisses on its existing timer
(`_stateBannerHideTimer`). No custom dismiss logic needed.

Duration: 1800ms for encounter-tier beats; 2200ms for
mastery/defeat-tier beats (mastery is more important; reads slightly
longer).

#### 3.3.8 Performance budget

| Operation | Budget | Justification |
|-----------|--------|---------------|
| Mastery-transition detection | ≤0.5ms | One comparison per recorder call (was-mastered vs is-now-mastered) |
| `flashStateBanner` invocation | ≤1ms | Existing impl measured at <0.3ms in identity perf probes |
| Display name lookup (race/boss/moment) | ≤0.5ms | Map lookup against existing constants |
| **Total per-toast cost** | **≤2ms** | within ≤2ms-per-fire budget per task brief |

Note: recorder functions ALREADY persist localStorage on every call
(line 230, 244, 262, 283), so the toast emission adds only the
flashStateBanner call cost — localStorage I/O is already paid.

#### 3.3.9 Sacred cow safety

- `NARRATOR_LINES` table: UNTOUCHED. New copy templates live in
  `src/data/identity-layer.js` as plain constants.
- Codex schema v1 (`CODEX_LOCALSTORAGE_KEY`): UNTOUCHED. We READ
  current state to detect transitions; we WRITE nothing new — the
  existing `saveCodexState` continues to be the only write path.
- All 10 fx mechanical contracts: UNTOUCHED.
- `flashStateBanner` UI surface: re-used as-is (no signature changes).
- FTUE Chronicle silence guard: respected (legacy impl returns
  silently if `ftueBeat === 'chronicle_fight'`) — meaning during the
  Chronicle tutorial fight, even if a record-trigger fires, the toast
  is silent. This is desirable (no Codex spam during dialog).

#### 3.3.10 Acceptance criteria

For Game Dev:
- [ ] `emitCodexToast(discoveryType, key)` helper added to
  `src/ui/codex.js` — switches on discovery type, computes display
  name, calls `flashStateBanner`.
- [ ] 5 toast emit call sites wired:
  - Inside `recordRaceTrigger`'s `if (!races[raceKey])` branch
  - Inside `recordRaceTrigger` mastery-transition branch
  - Inside `recordBossEncounter`'s `if (!bosses[bossKey])` branch
  - Inside `recordBossDefeat` mastery-transition branch
  - Inside `recordMomentTrigger`'s `if (!found)` branch
- [ ] Mastery-transition detection — store `wasMastered` before write,
  compare to `entry.mastered` after.
- [ ] Display name resolution — look up
  display name from existing race/boss constants (re-use codex.js
  `getRaceState`/`getBossState` patterns).
- [ ] All 5 copy templates added to `src/data/identity-layer.js`
  with placeholder markers.
- [ ] All errors swallowed (defensive try/catch — toast must NEVER
  regress fx pipeline).

For Bug Tester:
- [ ] Scenario A: fresh localStorage + first pirate trigger →
  "PIRATE — recorded in the Codex." toast appears.
- [ ] Scenario B: pirate's 24th trigger → no toast.
- [ ] Scenario C: pirate's 25th trigger → "PIRATE mastered. The
  Codex remembers." toast appears.
- [ ] Scenario D: pirate's 26th trigger → no toast (already mastered).
- [ ] Scenario E: first encounter of Phoenix → "SOLAR PHOENIX — its
  name is now known." toast.
- [ ] Scenario F: first defeat of Phoenix → "SOLAR PHOENIX falls.
  The Codex grows." toast.
- [ ] Scenario G: second defeat of Phoenix → no toast.
- [ ] Scenario H: first fire of `phoenix_ashen_reign` moment → "NEW
  MOMENT — ASHEN REIGN." toast.
- [ ] Scenario I: second fire of same moment → no toast.
- [ ] Scenario J: during `ftueBeat === 'chronicle_fight'`,
  recording fires → no toast (legacy silence guard).
- [ ] Performance: per-toast wall-time ≤2ms median.
- [ ] Sacred: NARRATOR_LINES byte-perfect; codex schema v1 byte-perfect.

---

### 3.4 F-04 — Bloodtide Pulse first-fire tutorial overlay (OPTIONAL)

#### 3.4.1 Identity name
**Bloodtide Pulse First-Fire Tutorial Overlay**

#### 3.4.2 Designer recommendation: **INCLUDE in Phase 2.5**

Rationale for inclusion (rather than defer):
1. **First-encounter falls within FTUE** — Pyredrake (Ch1 Boss 1) is
   `berserker` archetype; Bloodtide Pulse fires as early as the
   player's 3rd line clear during the FTUE Pyredrake fight (Bug
   Tester §1.1). This is the FIRST and ONLY boss-reactive mechanic
   a newbie sees in the first 5 minutes.
2. **The +5% damage spike is currently un-attributable** to its cause
   — the newbie can't distinguish Bloodtide Pulse from Berserker's
   2.0× enrage, from the chapter-finale boss baseline damage, or from
   their own mistakes. Without the tutorial, the spike is "boss did a
   thing" not "boss is responding to me on a 3-clear rhythm".
3. **Low marginal cost** — F-04 re-uses the F-01/F-02 overlay
   component (Option C architecture). Adding F-04 is essentially
   wiring 1 new trigger + 1 new copy line — ~15 LoC marginal.
4. **AAA+ FTUE first-5-min** standard (CLAUDE.md §3.6) requires the
   "first action without text → first micro-victory → understands the
   core" arc. If Bloodtide Pulse fires twice in FTUE without
   explanation, the newbie's mental model is "RNG damage spikes" —
   the opposite of "boss responds to rhythm".

If Roman or CTO declines F-04 for scope, **rationale to defer:**
Bloodtide Pulse is mechanically B-ranked (not C-ranked), and the
HUD label "BLOODTIDE PULSE — +5% incoming" already telegraphs the
pulse. F-04 is a polish on a polish; F-01/F-02/F-03 are the must-haves.

**Designer's stance:** ship F-04 alongside F-01/F-02. The marginal
cost is low (≤15 LoC); the FTUE quality lift is significant for a
newbie's first 5 minutes.

#### 3.4.3 Trigger condition

**EXACT predicate (evaluated inside `fxBerserkerBloodtidePulse` at
the start of the function body at identity-fx.js:3167):**

```
trigger ⟺ (
  localStorage.getItem('blocksworn_bloodtide_seen') === null     // never fired before
  AND typeof document !== 'undefined'                            // DOM available
)
```

No additional gating needed — `fxBerserkerBloodtidePulse` is only
invoked when the boss's pulse condition is met, so we ride the
existing gate.

#### 3.4.4 Persistence key

`localStorage['blocksworn_bloodtide_seen']` — same contract as F-01/F-02.

#### 3.4.5 Visual surface + Copy — REFINED

**Use NEW `showFirstTimeTutorialOverlay` (Option C).**

**Bug Tester draft:**
> "The dragon counts your strikes. Every third strike, it answers —
> read the tempo, time your guard."

**Designer refinement (REDLINED):**

| Reason | Bug Tester draft | Designer redline |
|--------|------------------|------------------|
| The draft is 2 sentences with a coach-speak prescription ("read the tempo, time your guard"). Per CLAUDE.md §2.3, voice is Darkest Dungeon — never coach-speak. Tightening to 2 short sentences keeps the causal beat ("every third strike → it answers") and removes the prescription. Counterplay (timing your guard) is delegated to the visible 3-clear counter HUD and Bloodtide Pulse banner. | "The dragon counts your strikes. Every third strike, it answers — read the tempo, time your guard." | "The dragon counts your strikes. Every third, it answers." |
| 8 words. Mirror-clause structure ("dragon counts strikes" / "third, it answers"). |  |  |

```js
// FINAL COPY: pending Roman approval (Phase 2.5 polish pass).
// Trigger: FIRST TIME Bloodtide Pulse fires (any battle, but in
// practice during FTUE Pyredrake — Ch1 Boss 1 is berserker). Persists
// via localStorage['blocksworn_bloodtide_seen']. Lives outside sacred
// NARRATOR_LINES per CLAUDE.md §2.3.
export const BLOODTIDE_PULSE_FIRST_FIRE_TUTORIAL_LINES_PLACEHOLDER = Object.freeze([
  'The dragon counts your strikes.',
  'Every third, it answers.',
]);
```

Component contract: `emblem: 'berserker'`, `title: 'BLOODTIDE PULSE'`,
`accentColor: '#FF4D1F'` (red pulse).

#### 3.4.6-3.4.10 Same structure as F-01/F-02

Trigger timing: at start of `fxBerserkerBloodtidePulse`, before existing
red-pulse VFX spawn. Dismissal: 5000ms auto-dismiss, tap, Escape.
Performance: ≤3.5ms first-fire. Sacred safety: identical contract.
Acceptance criteria: identical scenario template.

---

## 4. Cross-cutting concerns

### 4.1 Player perspective (per-overlay, per-persona)

| Overlay | Newbie (D0-D7) | Mid (D7-D30) | Hardcore (D30+) |
|---------|----------------|---------------|------------------|
| F-01 Sun Cascade | "Why did my damage spike?" → overlay teaches "solar dominance = promotion" | Confirms inferred build optimization path | Sees overlay once; never blocks |
| F-02 Cursed Tiles | "Why did skulls appear?" → overlay teaches "shark stacking is the cause" | Confirms shark-counter awareness | Sees overlay once; can plan squad-vary or shark-double-down |
| F-03 Codex toasts | "I'm unlocking things!" → reinforces playtime reward loop | "I'm building a collection" → meso-loop progression visibility | "Mastery progress is trackable" → completionist hook |
| F-04 Bloodtide Pulse | "The boss attacks every 3rd?" → causality learned in FTUE itself | Already knew; overlay confirms | Sees once; rhythm-counting becomes Tower meta |

### 4.2 First 5 minutes (FTUE) impact

Per CLAUDE.md §3.6:
- 0-30s: First action without text — UNCHANGED (overlay fires only
  on first MECHANIC, not first action).
- 30-90s: First micro-victory — UNCHANGED.
- 90-180s: Player understands core — **IMPROVED**: F-04 (Bloodtide
  Pulse) lands during Pyredrake fight (~120-180s mark), teaching
  the boss-responds-to-rhythm beat.
- 3-5min: AHA moment — UNCHANGED (overlays support, don't replace).
- 5min: Reason to return tomorrow — **IMPROVED**: F-03 race-encounter
  toast on every new race fires their identity reinforces "there's
  more to discover" tomorrow.

F-01 and F-02 do NOT fire in the FTUE window (Sun Cascade requires
spark hero post-Ch1 Boss 3; Cursed Tiles is Ch1 Boss 5). They land
later, but they land at the first encounter — exactly when needed.

### 4.3 Frustration check

For each overlay, "what's most frustrating outcome?":

| Overlay | Worst case | Mitigation |
|---------|-----------|------------|
| F-01 | Overlay obscures the damage number | Overlay is layered (not modal); positioned bottom-center; damage number floats top of grid; no z-order conflict |
| F-02 | Overlay slows reaction to skull damage | Tutorial fires AFTER skulls placed; 5000ms auto-dismiss + tap-to-dismiss; player can act through it |
| F-03 | 60+ toasts in a 30-min session feels spammy | Toast fires ONLY on first-discovery (gated by codex state transitions); per-playthrough cap is bounded by codex collection size (~50 max) |
| F-04 | Tutorial fires in FTUE Pyredrake fight during a damage spike | Overlay fires BEFORE the red-pulse VFX spawn so player has 200ms heads-up; auto-dismiss 5000ms; non-modal |

### 4.4 Choreography on PR #160 + this spec interaction

For Cursed Tiles specifically, both surfaces fire on the **first**
fire only:

```
Time (ms)  | Event                                              | Surface used
-----------|----------------------------------------------------|-------------
0          | Player completes line clear with shark squad        | (grid.js)
0          | clearLines triggers boss-reactive Lich next-turn    | (existing)
~50        | fxLichCursedTiles invoked                           | (existing)
~50-200    | Skull overlays placed on 3 cells                    | (existing)
~200       | NEW: Tutorial overlay shows ("You hunt with sharks.")| F-02 overlay
~400       | PR #160: boss line shows ("What you took...")        | flashStateBanner
~5200      | NEW: Tutorial overlay auto-dismisses                 | F-02 overlay
~5400      | PR #160: boss line auto-dismisses                    | flashStateBanner
```

On second+ fires: only PR #160's boss line fires (tutorial silent
via localStorage gate). Causality once; atmosphere always.

### 4.5 Codex toast vs PR #160 narrator lines — non-conflict

F-03 (Codex toasts) and PR #160 (per-fire boss lines) both use
`flashStateBanner`. Risk: simultaneous fires could collide on the
single `#stateBanner` DOM node — the second call overwrites the
first.

**Mitigation:** F-03 toasts fire from Codex recorder functions,
which are called AT THE END of fx invocations (e.g.,
`fxLichCursedTiles` line 2732). PR #160 boss lines fire in the
middle of fx invocations (typically before the Codex recording).
Empirical ordering means the F-03 toast naturally fires AFTER the
PR #160 line, replacing it on `#stateBanner`. **This is the desired
behavior**: the boss-line atmospheric beat fires first (~400ms),
then the dopamine acknowledgment ("NEW MOMENT — ...") fires
last (~500-600ms), reinforcing the "this is a collection event"
takeaway.

Bug Tester acceptance test should verify this ordering on the FIRST
fire of any boss-reactive moment.

---

## 5. Game Dev handoff — file insertion points + estimated LoC

### 5.1 New file: `src/ui/identity-fx-tutorial.js`

**Estimated LoC:** ~80 net new.

Exports:

```js
/**
 * Show a first-time tutorial overlay for an Identity Layer mechanic.
 * Fires exactly once per player (gated upstream by localStorage key).
 *
 * @param {Object} content
 * @param {string} content.emblem      Emblem key for icon (matches EMBLEM_REGISTRY)
 * @param {string} content.title       Title in small-caps
 * @param {string[]} content.lines     1-2 body lines (each rendered as <p>)
 * @param {string} content.accentColor Hex color (gold/purple/red/etc.)
 * @param {boolean} content.dismissOnTap   Default true
 * @param {number} content.autoDismissMs   Default 5000ms
 * @returns {void}
 */
export function showFirstTimeTutorialOverlay(content) { ... }

/** Programmatic close — exposed for tests + edge cases. */
export function hideFirstTimeTutorialOverlay() { ... }
```

### 5.2 New CSS: `src/styles/components/identity-fx-tutorial.css`

**Estimated LoC:** ~50 (selectors + keyframes + prefers-reduced-motion fallback).

Required selectors:
- `.identity-fx-tutorial` — base overlay container (fixed position, layered)
- `.identity-fx-tutorial__emblem` — 48×48 icon left-aligned
- `.identity-fx-tutorial__title` — small-caps title
- `.identity-fx-tutorial__line` — body lines
- `.identity-fx-tutorial--visible` — slide-in animation trigger
- `@media (prefers-reduced-motion: reduce)` block — replaces transitions with `transition: none`
- `.identity-fx-tutorial--exiting` — fade-out class

### 5.3 Additions to `src/data/identity-layer.js`

**Estimated LoC:** ~30 net new (4 placeholder constants + 5 codex toast templates + comments).

Insertion point: parallel placement to existing
`ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER` at line 858, in a new section
titled "Phase 2.5 FTUE polish placeholders":

```js
// ─── Phase 2.5 FTUE polish (TASK-044) ──────────────────────────────────
// FIRST-TIME-ONLY tutorial overlay lines. Each fires exactly once per
// player (gated by localStorage key). Lives OUTSIDE sacred NARRATOR_LINES
// table per CLAUDE.md §2.3 — same isolation pattern as
// ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER above.
// FINAL COPY: pending Roman approval (Phase 2.5 polish pass).

export const SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_LINES_PLACEHOLDER = Object.freeze([
  'Your strike was promoted.',
  'Solar burns brighter when solar is plentiful.',
]);
export const SUN_CASCADE_FIRST_PROMOTION_TUTORIAL_LOCALSTORAGE_KEY = 'blocksworn_sun_cascade_seen';

export const CURSED_TILES_FIRST_FIRE_TUTORIAL_LINES_PLACEHOLDER = Object.freeze([
  'You hunt with sharks.',
  'The deep hunts hunters.',
]);
export const CURSED_TILES_FIRST_FIRE_TUTORIAL_LOCALSTORAGE_KEY = 'blocksworn_cursed_tiles_seen';

export const BLOODTIDE_PULSE_FIRST_FIRE_TUTORIAL_LINES_PLACEHOLDER = Object.freeze([
  'The dragon counts your strikes.',
  'Every third, it answers.',
]);
export const BLOODTIDE_PULSE_FIRST_FIRE_TUTORIAL_LOCALSTORAGE_KEY = 'blocksworn_bloodtide_seen';

// Codex on-discover toast templates. Composed at fire-time with display
// name substitution.
export const CODEX_TOAST_RACE_ENCOUNTERED_PLACEHOLDER = '{NAME} — recorded in the Codex.';
export const CODEX_TOAST_RACE_MASTERED_PLACEHOLDER    = '{NAME} mastered. The Codex remembers.';
export const CODEX_TOAST_BOSS_ENCOUNTERED_PLACEHOLDER = '{NAME} — its name is now known.';
export const CODEX_TOAST_BOSS_DEFEATED_PLACEHOLDER    = '{NAME} falls. The Codex grows.';
export const CODEX_TOAST_MOMENT_WITNESSED_PLACEHOLDER = 'NEW MOMENT — {NAME}.';
```

### 5.4 Additions to `src/feel/identity-fx.js`

**Estimated LoC:** ~40 net new (3 trigger sites + helper for gate check).

Insertion points:

| Function | Line (approx) | Insertion |
|----------|---------------|-----------|
| `fxSparkLineClear` | After line 1930 (`ctx._dominantCountModifier = prev + modifier`) | F-01 overlay trigger (~12 LoC) |
| `fxLichCursedTiles` | After line 2729 (end of curse-placement loop), before line 2732 (`recordMomentTrigger`) | F-02 overlay trigger (~12 LoC) |
| `fxBerserkerBloodtidePulse` | After line 3167 (function entry) | F-04 overlay trigger (~12 LoC) |

Each trigger block follows this pattern (mirror of existing
ROOT_SURGE narrator wiring at line 4341-4352):

```js
// F-01 / F-02 / F-04 first-time tutorial overlay (TASK-044).
// Persists via localStorage[<KEY>] so it fires exactly once per player.
try {
  if (typeof document !== 'undefined' && typeof localStorage !== 'undefined') {
    if (localStorage.getItem(<KEY>) === null) {
      showFirstTimeTutorialOverlay({
        emblem: <EMBLEM_KEY>,
        title: <TITLE>,
        lines: <PLACEHOLDER_LINES>,
        accentColor: <COLOR>,
      });
      localStorage.setItem(<KEY>, '1');
    }
  }
} catch (_e) { /* swallow — tutorial is non-essential */ }
```

### 5.5 Additions to `src/ui/codex.js`

**Estimated LoC:** ~25 net new (helper + 5 toast emit sites).

Insertion points:

| Function | Existing line | Insertion |
|----------|---------------|-----------|
| (new) `_emitCodexToast(discoveryType, key)` helper | After line 285 (`recordMomentTrigger` end) | ~15 LoC — switch on discovery type, look up display name, call `flashStateBanner` |
| `recordRaceTrigger` | Inside `if (!races[raceKey])` branch (after line 222) | `_emitCodexToast('race_encountered', raceKey)` |
| `recordRaceTrigger` | After mastery-transition detection (new code around line 227-229) | Store `wasMastered`, compare after; if transition, `_emitCodexToast('race_mastered', raceKey)` |
| `recordBossEncounter` | Inside `if (!bosses[bossKey])` branch (after line 240) | `_emitCodexToast('boss_encountered', bossKey)` |
| `recordBossDefeat` | After mastery-transition detection (new code around line 259-260) | If transition, `_emitCodexToast('boss_defeated', bossKey)` |
| `recordMomentTrigger` | Inside `else` branch (after line 281) | `_emitCodexToast('moment_witnessed', momentKey)` |

### 5.6 Implementation order

**Game Dev should implement in this order** (each step is independently
testable; rollback is per-step):

1. **Add placeholders to `src/data/identity-layer.js`** (no behavior
   change — just data). Verify build green.
2. **Create `src/ui/identity-fx-tutorial.js` + CSS file** (overlay
   exists but unused). Verify build green; visual regression
   baselines unchanged.
3. **Wire F-03 toasts in `src/ui/codex.js`** (lowest-risk: uses
   existing `flashStateBanner`, no new component dependency). Verify
   smoke + visual regression — codex toasts now fire on first
   discoveries.
4. **Wire F-01 in `fxSparkLineClear`** (verify Sun Cascade overlay
   fires on first promotion; sacred combo-crit input mutation
   untouched).
5. **Wire F-02 in `fxLichCursedTiles`** (verify Cursed Tiles overlay
   fires on first fire; PR #160 boss line still fires after on every
   fire — non-regression of #160).
6. **Wire F-04 in `fxBerserkerBloodtidePulse`** (verify Bloodtide
   overlay fires on first fire during FTUE Pyredrake).
7. **Add 1 unit test per overlay** verifying the localStorage gate
   (4 unit tests total — 1 per overlay).
8. **Add 1 smoke test for each overlay** verifying the fire/silence
   contract (4 smoke tests total). Visual regression baseline
   capture for each first-fire state.

### 5.7 Total LoC estimate

| File | New LoC |
|------|---------|
| `src/ui/identity-fx-tutorial.js` (new) | ~80 |
| `src/styles/components/identity-fx-tutorial.css` (new) | ~50 |
| `src/data/identity-layer.js` (additions) | ~30 |
| `src/feel/identity-fx.js` (additions) | ~40 |
| `src/ui/codex.js` (additions) | ~25 |
| **Total source LoC** | **~225** |
| `tests/unit/identity-fx-tutorial.spec.js` (new) | ~60 |
| `tests/smoke/identity-fx-tutorial.spec.js` (new) | ~100 |
| **Total test LoC** | **~160** |
| **Grand total** | **~385 LoC** |

Implementation estimate: **2-3 days Game Dev** (a focused
single-track Phase 2.5 task).

---

## 6. Open questions for Roman

Per ESC-02 O2 placeholder-first ruling. CTO routes to Roman in batch
at PR merge time.

### Q1 — F-01 Sun Cascade copy approval
**Lines:**
1. "Your strike was promoted."
2. "Solar burns brighter when solar is plentiful."

**Designer rationale:** §3.1.5 redline. Bug Tester's draft was
poetic but didn't bridge to the visible damage number. The redline
ties "promoted" (mechanical) to "solar burns brighter" (poetic).

**Roman action:** APPROVE / REDLINE / REJECT.

### Q2 — F-02 Cursed Tiles copy approval
**Lines:**
1. "You hunt with sharks."
2. "The deep hunts hunters."

**Designer rationale:** §3.2.5 redline. Tightened from 3 sentences
to 2; removed coach-speak ("wait them out, or vary your squad");
anchored vocabulary to PR #160's "the deep remembers".

**Roman action:** APPROVE / REDLINE / REJECT.

### Q3 — F-03 Codex toast copy approval (5 templates)
**Templates:**
1. `'{NAME} — recorded in the Codex.'`
2. `'{NAME} mastered. The Codex remembers.'`
3. `'{NAME} — its name is now known.'`
4. `'{NAME} falls. The Codex grows.'`
5. `'NEW MOMENT — {NAME}.'`

**Designer rationale:** §3.3.5. 4 of 5 kept-as-drafted by Bug Tester;
1 redlined (boss-defeated). Established "the Codex remembers/grows"
vocabulary thread across mastery beats.

**Roman action:** APPROVE / REDLINE individual / REJECT.

### Q4 — F-04 inclusion in Phase 2.5 scope
**Question:** Ship F-04 (Bloodtide Pulse tutorial) in Phase 2.5
patch OR defer?

**Designer recommendation (§3.4.2):** SHIP. Marginal cost ~15 LoC,
FTUE-window mechanic, B→A FTUE-readiness lift.

If shipped, additional copy approval:
**Lines:**
1. "The dragon counts your strikes."
2. "Every third, it answers."

**Roman action:** SHIP (with copy approval) / DEFER to Phase 3 / REJECT.

---

## 7. Sacred cow audit — final pre-commit checklist

| Sacred system | Status | Verification command |
|---------------|--------|---------------------|
| `NARRATOR_LINES` (CLAUDE.md §2.3) | UNTOUCHED | `git diff main..HEAD -- src/feel/narrator-lines.js` → empty |
| `V_HAPTICS` (CLAUDE.md §2.2) | UNTOUCHED | `grep -n "V_HAPTICS\[" src/data/identity-layer.js src/ui/identity-fx-tutorial.js src/ui/codex.js` → only existing `clear` key references |
| Combat math formulas (CLAUDE.md §2.1) | UNTOUCHED | No new damage / threshold / multiplier writes |
| MAX_HP = 100 (CLAUDE.md §2.1) | UNTOUCHED | Spec is read-only on HP |
| TIER_COSTS_V18 (CLAUDE.md §2.1) | UNTOUCHED | No tier writes |
| 22 v2.1 P4 reactivity handlers | UNTOUCHED | `git diff main..HEAD -- src/core/reactivity-events.js` shows 0 content changes |
| 10 Identity Layer fx mechanical contracts | UNTOUCHED | Trigger-only side-effects after existing writes |
| `CODEX_LOCALSTORAGE_KEY` schema v1 | UNTOUCHED | No schema field additions; toast helper reads existing fields |
| 5-beat boss death cinematic timing | UNTOUCHED | Out of scope |
| Sun Cascade combo-crit input mutation (Roman-approved ESC-02 O3) | UNTOUCHED | Tutorial is read-only on `ctx._dominantCountModifier` |
| `flashStateBanner` UI surface | RE-USED ONLY | Existing signature `(text, color, durationMs)` unchanged |
| FTUE Chronicle silence guard | RESPECTED | F-03 toasts inherit silence guard via `flashStateBanner` |
| `blocksworn_codex_state` key isolation | MAINTAINED | New tutorial keys (`blocksworn_sun_cascade_seen` / `_cursed_tiles_seen` / `_bloodtide_seen`) are SEPARATE localStorage entries |
| `blocksworn_save` / `blocksworn_progress` sacred saves | UNTOUCHED | Tutorial spec never reads or writes these keys |

**Total sacred cow modifications: 0.** All copy is **pending Roman
approval per ESC-02 O2** placeholder-first ruling — same pattern that
shipped `ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER`.

---

## 8. Bug Tester acceptance test outline

Per overlay, Bug Tester verifies the scenarios listed in §3.x.10.
Aggregate test count:

- F-01: 11 scenarios
- F-02: 8 scenarios
- F-03: 12 scenarios (5 discovery types × covered states)
- F-04 (if shipped): 7 scenarios

**Total: ~38 test scenarios across ~8-10 spec files.**

Cross-cutting tests Bug Tester should add:
- **Smoke: PR #160 + F-02 choreography** — first fire of Cursed
  Tiles fires BOTH surfaces in the documented 200ms-stagger order.
- **Smoke: F-03 + PR #160 choreography on boss-moment fires** —
  e.g., first fire of Phoenix Ashen Reign fires PR #160 boss line
  THEN F-03 moment toast in the documented order; subsequent fires
  fire only PR #160 boss line.
- **Sacred regression: NARRATOR_LINES table byte-perfect** —
  `git diff main..<phase2.5-patch-merge> -- src/feel/narrator-lines.js`
  returns empty.
- **Sacred regression: Codex schema v1 byte-perfect** —
  `git diff main..<phase2.5-patch-merge> -- src/ui/codex.js | grep "CODEX_LOCALSTORAGE_KEY\|CODEX_SCHEMA_VERSION"`
  returns 0 hits.
- **Performance regression: identity perf probe still PASS** —
  re-run `tests/smoke/identity-perf-probe.spec.js` (8 tests) — all
  budgets respected (worst-case +0.5ms steady-state per first-fire
  pathway; first-fire +3.5ms one-shot is non-recurring).
- **Visual regression: existing baselines unchanged** —
  new overlay states get NEW baselines (4 first-fire visuals + ~5
  codex toast visuals); existing 14 Identity Layer baselines must
  not change.

---

## 9. Acceptance criteria for this design doc

- [x] 3 (or 4) FTUE overlay specs at full 10-field detail
- [x] Each overlay has trigger condition, persistence key, copy,
  dismissal, performance budget, sacred safety, acceptance criteria
- [x] Reusable overlay component architecture recommendation (Option
  C) with rationale, performance budget, accessibility considerations
- [x] Game Dev handoff section: "implement in this order, here are
  the file insertion points" (§5)
- [x] Bug Tester acceptance test outline (§8)
- [x] Sacred cow audit confirms 0 modifications (§1.3 + §7)
- [x] Open questions section for Roman copy approval (§6)
- [x] Copy refinements either accept-as-is or redlined with
  rationale (Bug Tester drafts addressed in §3.x.5)
- [x] No code written (Design only — Game Dev wires after CTO + Roman
  approval)
- [x] No `src/` files modified
- [x] No test files / baselines / CI / husky touched

---

**Document version:** 1.0
**Owner:** Game Designer (TASK-044)
**Maintainer:** CTO during Phase 2.5 polish patch; archive after Roman
approval + Game Dev implementation.

> First-time-only tutorial overlays close the AAA+ self-teaching loop.
> Sacred NARRATOR_LINES untouched. All copy is Chronicler-voice and
> pending Roman approval per ESC-02 O2 placeholder-first ruling.
