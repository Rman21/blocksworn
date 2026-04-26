# PHASE 4 BLOCK 1 — FTUE CHRONOGRAPH (7-min curriculum)

**Branch:** `phase-2-grammar` (Phase 4 work continues here; tag `v0.4.0-phase-4-done` after Block 2)
**Spec:** MASTER_PLAN_V3 §7 (Phase 4 — Onboarding Rebuild) · §7.1 BACKLOG-001/002 already shipped
**Predecessor:** Phase 3 sign-off `v0.3.0-phase-3-done` (`3b1cec4`)
**Date:** 2026-04-26

---

## A. Spec recap

Per master plan §7 — Phase 4 has 4 backlog items, two already shipped via polish passes:

| # | Item | Status |
|---|---|---|
| 1 | BACKLOG-001 splash polish | ✅ DONE (3 splash cards with element emblems) |
| 2 | BACKLOG-002 branching captain choice | ✅ DONE (CRIMSON / NIGHTLORD pick → 4 same-faction heroes + tank backfill migration) |
| 3 | **7-min FTUE chronograph teaching combo grammar** | ✅ THIS BLOCK |
| 4 | DEBT-014 FTUE FSM rework | Phase 4 Block 2 |

The chronograph IS the 7-minute curriculum. During the FTUE Pyredrake fight (the first battle every new player sees), six interactive coachmarks fire **at the moment each combo-grammar lesson first becomes mechanically relevant** — not as a passive intro carousel.

---

## B. Implementation

### B.1 Beat catalog

| # | Beat | Trigger condition | Highlight target | Body text |
|---|---|---|---|---|
| 1 | `match` | `startBossBattle` (FTUE Pyredrake), 850ms after init | `#tray` | "Перетащи фигуру в сетку. Совмести 3+ клеток одного цвета — они исчезнут и нанесут урон." |
| 2 | `charge` | `distributeChargeOnElementClear` first cells-cleared call | first matching hero `.hero-card[data-id]` | "Каждый матч заряжает ULT героев твоей расы. Жёлтое кольцо вокруг портрета растёт." |
| 3 | `ult` | `addChargeToHero` first time `prev < cost && next >= cost` | that hero's `.hero-card[data-id="<heroId>"]` | "Герой готов. Тапни портрет — выстрел уникальной способности." |
| 4 | `race` | `renderSynergyBar` first non-empty `pillSource.length > 0` | `#synergyBar` | "3+ героя одной расы → пассивный бонус к урону. Пилл сверху показывает активный комбо." |
| 5 | `captain` | `applyCaptainUlt` end, `picks.length > 0` | `#grid` | "Капитан уронил element-charged клетки на сетку. Цепляй их в матч — они взрывают цепи." |
| 6 | `telegraph` | `maybeBossAttack` first time `attackCountdown ≤ 2` | `.p-attack-telegraph` (fallback `#bossImgWrap`) | "Босс готовит удар. Цифра — сколько ходов до импакта. Планируй защиту или добивай первым." |

All beats fire in the order players naturally encounter the mechanics — no hard-coded sequence enforcement, just a single-shot flag per beat per FTUE attempt.

### B.2 State + lifecycle

```js
let _chronoBeatsSeen = {};  // { match, charge, ult, race, captain, telegraph } → true once shown
let _chronoActive    = false; // is overlay showing right now (gates double-fire)
```

Reset in `startBossBattle` when `ftueBeat === 'pyredrake_fight'` so retries get the full curriculum. After FTUE completes (`ftueBeat === 'complete'`), the gate at line 1 of `maybeChronoBeat` permanently closes — no localStorage flag needed; the FTUE FSM state itself is the persistence.

### B.3 Coachmark overlay (`#chronoOverlay`)

Full-screen overlay (z-index 9100, between cinematic 9999 and game UI):
- **Backdrop** — radial-gradient with transparent center at `(--cx, --cy)`, radius `--ri` from target rect; outside rim fades to rgba(0,0,0,0.88).
- **Pulse rect** — 2px gold border at `(--sx, --sy, --sw, --sh)` matching target bounding rect with +12px padding. Pulses scale 1.00 → 1.04 every 1.6s.
- **Tip card** — centered, 360px max-width. Header "CHRONOGRAPH · STEP N / 6" + beat name + body text + "CONTINUE" CTA button. Auto-positions: target in top half → card below spotlight; target in bottom half → card pinned to `bottom: 32px`.

Fallback: if target rect resolves to zero-area (element hidden / not in DOM yet), overlay applies `.no-spotlight` class — full-screen dim, no pulse, card centered.

### B.4 maybeChronoBeat() gate logic

```js
function maybeChronoBeat(beatId, opts) {
  if (ftueBeat !== 'pyredrake_fight') return false;  // FTUE-only
  if (_chronoActive) return false;                   // one beat at a time
  if (_chronoBeatsSeen[beatId]) return false;        // single-shot per attempt
  if (!CHRONO_BEATS[beatId]) return false;
  _chronoBeatsSeen[beatId] = true;
  _showChronoBeat(beatId, opts);
  return true;
}
```

Order matters: `_chronoActive` check is BEFORE seen-flag set, so a beat dropped due to overlap can re-fire later (no permanent loss).

### B.5 Existing carousel gated out during FTUE

The legacy 3-step `#vBattleTutorial` auto-carousel (`maybeShowBattleTutorial` line 22893) was firing on first battle **including FTUE Pyredrake** — competing with chronograph for visual real estate. Added gate:

```js
if (typeof ftueBeat !== 'undefined' && ftueBeat === 'pyredrake_fight') return;
```

Carousel still fires for the rare post-FTUE first-battle case (e.g. dev who used `skipFtue()`), so no functionality lost.

### B.6 Reduced-motion compliance

`@media (prefers-reduced-motion: reduce)`:
- Overlay opacity transition stays at 0.3s linear
- `.chrono-pulse` animation disabled (static gold border, no scale loop)
- Card entry animation 0.3s linear (no cubic-bezier bounce)

### B.7 Tactile cue

`vibrate(40)` on each beat open — short single-pulse, distinct from clutch's heartbeat-skip and flashback's somber long-pulse.

---

## C. Edge cases handled

| Scenario | Behavior |
|---|---|
| Player retries FTUE Pyredrake (lost first attempt) | `_chronoBeatsSeen` reset in `startBossBattle` → full curriculum re-shown |
| 4 heroes cross ULT-ready in same `distributeChargeOnElementClear` call | First setTimeout wins; subsequent ones see `_chronoActive=true` AND `_chronoBeatsSeen.ult=true`, return false silently |
| CHARGE beat queued (220ms), ULT beat queued (250ms) — overlap | CHARGE fires first; ULT setTimeout sees `_chronoActive=true`, drops without setting seen flag → re-fires on next ULT cross. (Realistically impossible in FTUE since first-match charge=~12, prev was 0, ULT cost ≥ 80 — needs many matches to cross) |
| `applyCaptainUlt` with zero pickable cells | `picks.length === 0` → CAPTAIN beat skipped |
| Target element not in DOM | `getBoundingClientRect` returns 0×0 → `.no-spotlight` mode (full-screen dim, centered card) |
| Reduced-motion preference | Pulse animation disabled, card entry linear 0.3s, no transform-bounce |
| Post-FTUE battles | `ftueBeat === 'complete'` → first gate in `maybeChronoBeat` returns false; chronograph never fires |
| Tower battles | Same `ftueBeat === 'complete'` gate skips chronograph (Tower is post-FTUE) |
| Dev `skipFtue()` then first battle | Chronograph never fires (FSM at `complete`); legacy carousel fires once instead |

---

## D. Roman regression checklist

JS syntax verified post-edits via JavaScriptCore (`jsc` from `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc`) — full file parses cleanly through 15,000+ lines.

1. **Fresh install** (`localStorage.clear()` then reload):
   - Splash carousel runs (3 cards)
   - FTUE intro dialogs run
   - Pyredrake fight starts
   - **Beat 1 (MATCH)** appears 850ms after battle init: tray highlighted, "STEP 1 / 6 · MATCH" tip card, CONTINUE button
   - Tap CONTINUE → overlay fades out → game resumes
   - Player makes first match → **Beat 2 (CHARGE)** fires with hero card highlighted
   - Player accumulates charge → **Beat 3 (ULT)** fires when first hero ready (~80 for warrior/captain charge)
   - Synergy bar visible → **Beat 4 (RACE)** fires highlighting the bar
   - CRIMSON ULT used → cells dropped → **Beat 5 (CAPTAIN)** fires highlighting the grid
   - Boss countdown reaches 2 → **Beat 6 (TELEGRAPH)** fires highlighting the telegraph badge
   - Each beat dismissed via CONTINUE; none auto-advance.

2. **Retry FTUE Pyredrake** (lose first attempt → restart):
   - All 6 beats re-fire from scratch (chrono state reset in `startBossBattle`)
   - Safety rail behavior unchanged (still 1 HP rescue once per battle)

3. **DevTools console** during FTUE fight:
   - `__chronoState()` → `{ seen: {match: true}, active: false, ftueBeat: 'pyredrake_fight' }`
   - `__chronoFire('telegraph')` → forces telegraph beat to show (debug aid)
   - `__chronoReset()` → re-enables all beats

4. **Post-FTUE battle** (Boss 2 / Tower / etc):
   - No chronograph fires (FSM at `complete`)
   - Legacy 3-step carousel doesn't fire either (already seen flag in localStorage from FTUE)

5. **Reduced-motion enabled** (system preference):
   - Pulse animation disabled
   - Card entry 0.3s linear, no scale bounce
   - Spotlight + tip text fully visible, no animation jank

6. **Console errors**: none expected through full FTUE.

---

## E. Spec adherence

| Spec point (§7) | Implementation | Status |
|---|---|---|
| FTUE учит grammar за 7 минут | 6 contextual coachmarks at gameplay moments + existing FSM dialog beats | ✅ |
| Branching captain choice | BACKLOG-002 (already shipped) | ✅ |
| BACKLOG-001 splash polish | Already shipped (3 cards + emblems) | ✅ |
| DEBT-014 FSM rework | Phase 4 Block 2 (next) | ⏳ |
| Reduced-motion compliance | `@media (prefers-reduced-motion: reduce)` block | ✅ |

---

## F. What this commit does NOT touch

- Phase 1-3 work — all heroes / blocks / cinematics intact
- FTUE FSM (`ftueBeat`, `advanceFtue`, dialog scripts) — Block 2 will refactor
- Existing safety rail (`ftueSafetyRailUsed`) — preserved
- Splash carousel — preserved (still fires for non-FTUE first battles)
- Captain pick branching — preserved (BACKLOG-002 untouched)

---

## G. Phase 4 progress

- ✅ **Block 1 — FTUE Chronograph** (this commit)
- ⏳ Block 2 — DEBT-014 FTUE FSM rework + Phase 4 sign-off

After Block 2 → tag `v0.4.0-phase-4-done` on the merge commit on `main`.

---

## H. Git status

Single Block 1 commit on `phase-2-grammar`. Auto-merged to `main` per Roman standing instruction.
