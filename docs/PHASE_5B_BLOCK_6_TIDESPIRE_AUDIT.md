# PHASE 5b BLOCK 6 — TIDESPIRE (Tempo Disruptor mechanics) + 3 Spark unlock

**Branch:** `phase-2-grammar`
**Spec:** [BLOCKSWORN_BOSS_COMPENDIUM.md](../BLOCKSWORN_BOSS_COMPENDIUM.md) §9 TIDESPIRE · [BLOCKSWORN_META_PROGRESSION.md](../BLOCKSWORN_META_PROGRESSION.md) §5.3
**Predecessor:** Phase 5b Block 5 (Ursaro) — `044bb1f`
**Date:** 2026-04-26

---

## A. Spec recap

Per Boss Compendium §9 TIDESPIRE "The Drowned Howl" — Tempo Disruptor archetype with 3 sub-mechanics escalating per phase:

1. **Slow Time** (P1+, every 6 turns): visual-only slow-mo turn (no mechanical change, just psychological pressure of time "trickling")
2. **Reverse Tempo** (P2+, every 7 turns): next placement nullifies all charge gain (heroes don't accumulate ULT charge that turn)
3. **Tidal Lock** (P3, every 8 turns): next turn entirely skipped (boss doesn't attack but player loses one move opportunity)

Plus per Meta-Progression §5.3: TIDESPIRE victory unlocks remaining 3 Spark heroes (LUMENWIND + AEGIS + SOLARLORD) via BOSS_UNLOCKS[9]. After this block, full 5/5 Spark roster playable.

---

## B. Implementation

### B.1 BOSS_UNLOCKS[9] + lock removal for 3 Sparks

```js
9: ['spark_mage', 'spark_tank', 'spark_captain'],   // Tidespire → rest of Sparks
```

Removed `locked: true` from:
- `spark_mage` (LUMENWIND) — Halo Window amp + Halo of Suns ULT (double shields)
- `spark_tank` (AEGIS) — Sun Guard + Equilibrium ULT (+5 shields + immunity)
- `spark_captain` (SOLARLORD) — DOMINION + Eternal Dawn ULT (heal + shields + solar cells)

After Tidespire kill: **all 25 v1 heroes unlockable** (5 Pirates + 5 Rock + 5 Sharks + 5 Crocs + 5 Sparks).

### B.2 Tempo Disruptor flag-consumption ordering

`_tickTempo` runs at end-of-placement, AFTER:
- `distributeChargeOnElementClear` (multiple times during cascade)
- `await maybeBossAttack()` (boss attack site at line ~23583)

Block 1 only set queued flags; consumers were missing. Block 6 wires:

| Producer | Consumer | Where |
|---|---|---|
| `tempoSlowQueued` set in `_tickTempo` (interval hit) | `_tickTempo` (next placement, top) → applies blue tint visual | end-of-placement |
| `tempoChargeNullifyQueued` set in `_tickTempo` | `distributeChargeOnElementClear` (gate, no consume) → `_tickTempo` (consume) | distribute → tick |
| `tempoTurnLockQueued` set in `_tickTempo` | `maybeBossAttack` site (skip + consume) | placement loop |

Order matters: distribute happens BEFORE tick, so distribute can read the flag set by previous tick. Tick consumes at end so next placement starts fresh (unless flag re-queued by interval).

### B.3 Slow Time (visual-only)

Block 6 adds visual tint via body class:

```js
if (tempoSlowQueued) {
  tempoSlowQueued = false;
  document.body.classList.add('tempo-slow-tint');
  setTimeout(() => document.body.classList.remove('tempo-slow-tint'), 1100);
}
```

CSS:
```css
body.tempo-slow-tint::after {
  position: fixed; inset: 0; z-index: 9050;
  background: radial-gradient(circle at 50% 50%,
    rgba(120, 200, 255, 0.18) 0%,
    rgba(80, 160, 220, 0.30) 60%,
    rgba(40, 90, 180, 0.45) 100%);
  animation: tempoSlowTint 1.1s ease-in-out forwards;
}
@keyframes tempoSlowTint {
  0% { opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { opacity: 0; }
}
```

Cool-blue radial wash conveys "time bends" thematic identity. Reduced-motion fallback: 0.4s linear (shorter, no easing).

### B.4 Reverse Tempo (charge nullification)

Gate at top of `distributeChargeOnElementClear`:

```js
function distributeChargeOnElementClear(element, cellsCleared) {
  if (...usual guards...) return;
  // PHASE 5b BLOCK 6 — REVERSE TEMPO. Nullify all charge gain for current placement.
  if (tempoChargeNullifyQueued && currentBoss.archetype === 'tempo_disruptor') {
    flashText('❄ UNDERTOW · CHARGE BLOCKED', '#78C8FF');
    return;
  }
  ...rest...
}
```

Multi-element clears in same placement all gated (flag stays true through all distribute calls; consumed by tick at end-of-placement). Visual: "❄ UNDERTOW · CHARGE BLOCKED" flash on first attempted distribute call.

### B.5 Tidal Lock (turn skip)

Wrapped `await maybeBossAttack()` site:

```js
if (tempoTurnLockQueued && currentBoss.archetype === 'tempo_disruptor') {
  flashText('❄❄ TIDAL LOCK · TURN SKIPPED', '#78C8FF');
  vibrate([100, 50, 100, 50, 200]);
  tempoTurnLockQueued = false;  // consume here
  // Skip maybeBossAttack
} else {
  await maybeBossAttack();
}
```

Effect: player placed a piece (move opportunity used), but boss's countdown didn't decrement and no void cells spawned. Per Compendium: "passes through; boss does not attack but player loses one move opportunity". Defensive consume in `_tickTempo` handles edge case (game ended before maybeBossAttack reached).

### B.6 Telegraph announcements

`_tickTempo` emits flashText announcements when intervals hit (queues NEXT-placement effect):

| Phase | Trigger | Telegraph |
|---|---|---|
| P1+ | Slow interval hit | `❄ TEMPO BREAK` |
| P2+ | Reverse interval hit | `❄ UNDERTOW · NEXT PLACEMENT` + vibrate |
| P3 | Lock interval hit | `❄❄ TIDAL LOCK · NEXT TURN` + vibrate |

Plus consumption announcements:
- Reverse Tempo consumed: "❄ UNDERTOW · CHARGE BLOCKED" (in distribute)
- Tidal Lock consumed: "❄❄ TIDAL LOCK · TURN SKIPPED" (at maybeBossAttack site)
- Slow Time consumed: full-screen blue tint (no flashText, visual sufficient)

---

## C. What this block does NOT touch

- Phase 1/2/3/4/5 + Phase 5b Block 1/2/3/4/5 work intact.
- Block 1 archetype infrastructure (other 4 archetypes) preserved verbatim.
- Block 3 Verothira / Block 4 Gearheart / Block 5 Ursaro mechanics + unlocks unchanged.
- Existing `distributeChargeOnElementClear` chronograph hook + Spark Charge Regen path preserved (new gate is at TOP, before existing logic).
- Existing `maybeBossAttack` flow unchanged for non-Tidespire bosses (gate is conditional on archetype === 'tempo_disruptor').
- Crocodile heroes + first 2 Sparks (EMBERSPARK + RADIANCE) unchanged from Blocks 5b.3-5b.5.
- World Map / Chapter 2 nav UI (Block 5b.8 pending).

---

## D. Edge cases handled

| Scenario | Behavior |
|---|---|
| Tidespire fight starts | Tempo Disruptor aura + intro voice ("One drop... then ten thousand...") + tickChapter2Archetype routes to `_tickTempo` |
| Player at P1 | Slow Time triggers every 6 turns → blue tint on screen for 1.1s; nothing mechanical |
| Player at P2 → Reverse Tempo triggers | "❄ UNDERTOW" flash → next placement: "❄ UNDERTOW · CHARGE BLOCKED" → 0 charge gain across all elements |
| Player at P3 → Tidal Lock triggers | "❄❄ TIDAL LOCK" flash → next placement: piece placed, "TURN SKIPPED" flash, no boss attack, no void cells, attackCountdown unchanged |
| Multi-element clear during Reverse Tempo turn | All distribute calls gated; "CHARGE BLOCKED" flash fires on first call only (subsequent silent) |
| Tidal Lock + Reverse Tempo overlap (P3 both intervals hit close) | Both effects apply to subsequent placements independently — Reverse on placement N+1 (charge), Lock on placement N+2 (no boss attack) |
| Game ends during Tidal Lock turn (boss death from cascade in clearLines) | `gameEnded` check after `else` branch; flag still consumed defensively in tick |
| Player retries Tidespire (lost first attempt) | All Tempo state reset via `resetChapter2ArchetypeState`; full curriculum re-fires from P1 |
| Tidespire win | `applyBossDefeatProgression(9)` → BOSS_UNLOCKS[9] unlocks LUMENWIND + AEGIS + SOLARLORD; existing celebration |
| Reduced-motion preference | Slow Time tint shortened to 0.4s linear (no easing fade); other effects unchanged |
| Existing Sharks battle (Chapter 1 Boss 2: Abyssal Tyrant) | tempo_disruptor archetype check guards all gates → no leakage to non-Tidespire bosses |

---

## E. Roman regression checklist

JS syntax verified post-edits via JavaScriptCore — file parses through 17,374+ lines clean.

1. **Chapter 1 progression unaffected**:
   - All 5 Chapter 1 bosses play unchanged
   - distributeChargeOnElementClear runs normally for non-tempo_disruptor bosses
   - maybeBossAttack runs normally for non-tempo_disruptor bosses

2. **Verothira / Gearheart / Ursaro (Blocks 3-5) preserved**:
   - All Chapter 2 mechanics (Hypnotist suggestion / Engineer weld+extract+electrify / Frenzy stacks+maul+devour) still fire correctly
   - Crocs unlock at Verothira+Gearheart, 2 Sparks unlock at Ursaro

3. **Tidespire dry-run** (DevTools):
   ```js
   setChapter(2); currentBossIdx = 3; startBossBattle();
   // → TIDESPIRE fight; tempo_disruptor aura active (ice-blue swell pulse)
   // → Voice intro: "One drop... then ten thousand... we are... ONE."
   // → ~6 turns later: "❄ TEMPO BREAK" flash → blue tint full-screen 1.1s
   ```

4. **Reverse Tempo P2** (drop boss to 60% HP):
   - Wait for "❄ UNDERTOW · NEXT PLACEMENT" flash
   - Next placement: clear cells → "❄ UNDERTOW · CHARGE BLOCKED" flash, no charge gain
   - `__debugCharges()` confirms heroCharges unchanged for that placement
   - Subsequent placement: charge gain resumes normally

5. **Tidal Lock P3** (drop boss to 30% HP):
   - Wait for "❄❄ TIDAL LOCK · NEXT TURN" flash
   - Next placement: place piece → "❄❄ TIDAL LOCK · TURN SKIPPED" flash
   - `attackCountdown` unchanged (boss didn't progress)
   - No void cells spawned

6. **Tidespire win**:
   - `applyBossDefeatProgression(9)` fires
   - ⚡ LUMENWIND + AEGIS + SOLARLORD UNLOCKED celebrations
   - Squad-select: all 25 heroes unlocked (5 Pirates + 5 Rock + 5 Sharks + 5 Crocs + 5 Sparks)

7. **DevTools verification**:
   - `BOSS_UNLOCKS[9]` → `['spark_mage', 'spark_tank', 'spark_captain']`
   - `HERO_ROSTER.find(h => h.id === 'spark_captain').locked` → `undefined`
   - `HERO_ROSTER.filter(h => h.race === 'spark').every(h => !h.locked)` → `true`
   - `__debugChapter2Archetype()` shows tempo flags during Tidespire

8. **No console errors** through Verothira → Gearheart → Ursaro → Tidespire full sequence.

---

## F. Spec adherence

| Spec point (Compendium §9 + Meta §5.3) | Implementation | Status |
|---|---|---|
| Slow Time: P1+, every 6 turns, visual-only | `_tickTempo` consume + `body.tempo-slow-tint` 1.1s blue radial wash | ✅ |
| Reverse Tempo: P2+, every 7 turns, 0 charge | `distributeChargeOnElementClear` gate + flag consumed in tick | ✅ |
| Tidal Lock: P3, every 8 turns, turn entirely skipped | `maybeBossAttack` site gate + boss countdown unchanged | ✅ |
| Player still loses move on Tidal Lock | Player still placed piece; only boss attack + countdown gated | ✅ |
| Boss doesn't attack on Tidal Lock | `maybeBossAttack` skipped; attackCountdown not decremented | ✅ |
| Tidespire win → 3 Sparks unlock | `BOSS_UNLOCKS[9]` + `locked: true` removal | ✅ |
| Visual: blue tint for Slow Time | `body.tempo-slow-tint::after` radial gradient + keyframes | ✅ |
| Telegraph announcements per spec | `❄` / `❄❄` flashText for Slow / Reverse / Lock | ✅ |
| Tactile feedback | `vibrate(...)` on Reverse Tempo + Tidal Lock | ✅ |
| Reduced-motion compliance | Slow Time tint 0.4s linear in `@media (prefers-reduced-motion)` | ✅ |

---

## G. Phase 5b progress

- ✅ Block 1 — Chapter 2 archetype infrastructure (`95bc783`)
- ✅ Block 2 — Chapter 2 boss data + 5 PNG assets (`1c869c4`)
- ✅ Block 3 — VEROTHIRA (Hypnotist) + 2 Crocs unlock (`8d656b9`)
- ✅ Block 4 — GEARHEART (Engineer) + 3 Crocs unlock (`738f1b8`)
- ✅ Block 5 — URSARO (Frenzy) + 2 Sparks unlock (`044bb1f`)
- ✅ **Block 6 — TIDESPIRE (Tempo Disruptor) + 3 Sparks unlock** (this commit)
- ⏳ Block 7 — HELIOTRON (Battery) + Chapter 2 finale
- ⏳ Block 8 — World Map cinematic + Chapter 2 transition + UI access
- ⏳ Block 9 — Phase 5b sign-off + tag `v0.5.5-chapter-2-done`

After Block 6: **all 25 heroes unlockable** through Chapter 2 progression. Block 7 (Heliotron / Battery) is the final boss + Chapter 2 finale.

---

## H. Git status

Single Block 6 commit on `phase-2-grammar`. Auto-merged to `main`.
