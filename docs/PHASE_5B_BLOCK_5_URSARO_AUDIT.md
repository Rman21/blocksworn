# PHASE 5b BLOCK 5 — URSARO (Frenzy mechanics) + 2 Spark unlock

**Branch:** `phase-2-grammar`
**Spec:** [BLOCKSWORN_BOSS_COMPENDIUM.md](../BLOCKSWORN_BOSS_COMPENDIUM.md) §8 URSARO · [BLOCKSWORN_META_PROGRESSION.md](../BLOCKSWORN_META_PROGRESSION.md) §5.3 Chapter 2 unlock progression
**Predecessor:** Phase 5b Block 4 (Gearheart) — `738f1b8`
**Date:** 2026-04-26

---

## A. Spec recap

Per Boss Compendium §8 URSARO "The Magma Bear" — Frenzy archetype with 3-phase escalation:

1. **Frenzy Stacks** (P1+, every turn): boss accumulates +1 stack per turn not hit; each stack adds +5% to boss attack damage. Hitting boss resets stacks to 0 (P1) or decays 50% (P2).
2. **Maul Combo** (P2+, ≥5 stacks): boss does 3 attacks in one turn (chained AoE strikes)
3. **Devour** (P3, ≥8 stacks): boss eats lowest-HP hero — locked from firing for 3 turns + boss heals 8% maxHP

Plus per Meta-Progression §5.3: URSARO victory unlocks first 2 Spark heroes (EMBERSPARK + RADIANCE) via BOSS_UNLOCKS[8].

This block ships full URSARO combat behavior. Phase 5b Block 1 shipped infrastructure scaffolding (counter ticks, queue flags, flashText announcements); Block 5 adds actual mechanic logic (damage scaling, attack multiplication, hero locking) + visual indicators.

---

## B. Implementation

### B.1 BOSS_UNLOCKS[8] + lock removal for 2 Sparks

```js
8: ['spark_warrior', 'spark_hunter'],   // Ursaro → first 2 Sparks
```

Removed `locked: true` from:
- `spark_warrior` (EMBERSPARK) — Sun Strike + Sun Cascade ULT
- `spark_hunter` (RADIANCE) — Aurora Burst + Aurora Burst ULT

Mage/Tank/Captain Sparks remain locked behind Block 5b.6 (Tidespire). After Block 5: 17/25 heroes unlockable through Chapter 2 progression (15 Chapter 1 + 2 Crocs from Verothira + 3 Crocs from Gearheart + 2 Sparks from Ursaro − 5 Spark M/T/C still locked).

### B.2 Devour state vars

Added to existing Frenzy state block (Phase 5b Block 1):

```js
// Devoured hero state (mirror of Hypnotist Tendril Coil pattern, 3-turn duration)
let frenzyDevouredHeroId        = null;
let frenzyDevouredTurnsLeft     = 0;
const FRENZY_DEVOUR_DURATION    = 3;
const FRENZY_DEVOUR_HEAL_PCT    = 0.08;
```

Reset in `resetChapter2ArchetypeState` alongside other Frenzy state.

### B.3 Frenzy stack damage scaling

In `bossAttack` cell-count formula (where `mult` is composed):

```js
if (currentBoss.archetype === 'frenzy' && frenzyStacks > 0) {
  mult *= (1 + frenzyStacks * FRENZY_DMG_PER_STACK);
}
```

Result: 5 stacks = ×1.25 cell count; 8 stacks = ×1.40; 10 stacks = ×1.50.

Stack accumulation handled by Block 1 `_tickFrenzy(phase)`. Decay/reset handled by Block 5 `frenzyHitThisTurn` flag set in `dealDamage`.

### B.4 Hit detection in dealDamage

```js
const actualDmg = Math.min(amount, bossHP);
bossHP -= actualDmg;
// PHASE 5b BLOCK 5 — Frenzy hit detection
if (actualDmg > 0 && currentBoss.archetype === 'frenzy') {
  frenzyHitThisTurn = true;
}
```

End-of-turn `_tickFrenzy` reads `frenzyHitThisTurn` and applies decay/reset:
- P1: full reset (`frenzyStacks = 0`)
- P2+: half decay (`frenzyStacks = floor(stacks * 0.5)`)

### B.5 Maul Combo — 3 attacks in one turn

Wrapped in `maybeBossAttack` where `bossAttack()` is called when `attackCountdown <= 0`:

```js
let _attacksThisTurn = 1;
if (currentBoss.archetype === 'frenzy' && frenzyMaulQueued && !frenzyDevourQueued) {
  _attacksThisTurn = 3;
  flashText('🐻 MAUL COMBO ×3', '#FF6E28');
  vibrate([100, 60, 100, 60, 100, 60, 200]);
  frenzyMaulQueued = false;  // consume — won't repeat next turn unless rebuilt
}
(async () => {
  for (let i = 0; i < _attacksThisTurn; i++) {
    await bossAttack();
    if (i < _attacksThisTurn - 1) await sleep(400);  // brief pause between strikes
  }
})();
```

**Devour gate**: when `frenzyDevourQueued` is true, Devour fires INSTEAD of regular attack (Maul skipped). Devour fires immediately on `_tickFrenzy` when threshold crossed.

### B.6 Devour mechanic

Implementation in `_frenzyDevour()`:

```js
function _frenzyDevour() {
  // Pick "weakest" hero (lowest charge fraction = least combat-ready)
  let target = null;
  let lowestFrac = Infinity;
  for (const h of HERO_DECK) {
    const frac = (heroCharges[h.id] || 0) / Math.max(1, getUltCost(h.id));
    if (frac < lowestFrac) { lowestFrac = frac; target = h; }
  }
  if (!target) return;
  frenzyDevouredHeroId    = target.id;
  frenzyDevouredTurnsLeft = 3;
  frenzyStacks            = 0;  // consume buildup
  // Boss heals 8% maxHP
  bossHP = Math.min(bossMaxHP, bossHP + Math.floor(bossMaxHP * 0.08));
  flashText('🐻🐻 DEVOUR · ' + target.name + ' · BOSS +' + healAmount, '#FF4400');
  vibrate([100, 50, 100, 50, 200]);
}
```

**Lowest-HP analog in v1**: heroes don't have HP, but they have charge. "Lowest charge fraction" = "least ready to fire" = thematic match for "weakest". Player counter: keep all heroes' charges high so devour target is randomized (no clear "weakest").

### B.7 canFireUlt guard

Extended Block 3's Tendril Coil guard with Devour check:

```js
function canFireUlt(heroId) {
  if (hypnotistTendrilHeroId === heroId && hypnotistTendrilTurnsLeft > 0) return false;  // Block 3
  if (frenzyDevouredHeroId === heroId && frenzyDevouredTurnsLeft > 0)     return false;  // Block 5
  return (heroCharges[heroId] || 0) >= getUltCost(heroId);
}
```

Tap on devoured hero → no fire. ULT animation skipped. Hero unlocks naturally after 3 turns.

### B.8 Visual indicators

**Devoured hero (`.hero-card--frenzy-devoured`)**:
- Outline: deep red (#FF4400)
- Filter: brightness 0.45 + saturation 0.65 (heavy dim)
- Box-shadow: inset deep red shadow + outer red glow
- ::after pseudo-element: 🐻 corner badge
- Distinct from Tendril Coil (purple/🔗) by color + emoji

`_renderFrenzyVisuals()` re-applied on every `renderDeck()` so devoured-hero indicator persists across re-renders.

---

## C. What this block does NOT touch

- Phase 1/2/3/4/5 + Phase 5b Block 1/2/3/4 work intact.
- Block 1 archetype infrastructure (other 4 archetypes) preserved verbatim.
- Block 3 Verothira mechanics + Crocs[1-2] unlock unchanged.
- Block 4 Gearheart mechanics + Crocs[3-5] unlock unchanged.
- Existing `bossAttack` mechanics for Chapter 1 archetypes (berserker enrage / armored shields / phoenix revive / assassin damage profile) unchanged.
- Existing `dealDamage` mult stack (10+ multipliers) unchanged.
- Other 3 Sparks (Mage/Tank/Captain) stay `locked: true` (Block 5b.6 unlocks).

---

## D. Edge cases handled

| Scenario | Behavior |
|---|---|
| Ursaro fight starts | Frenzy aura + intro voice ("Hungry... hungry...") + tickChapter2Archetype routes to `_tickFrenzy` |
| Player hits boss every turn | Stacks reset to 0 each turn (P1) → no damage scaling, no Maul, no Devour |
| Player skips ULT for 5 turns | Stacks reach 5 → Maul Combo queued → next bossAttack is 3-attack burst |
| Player at P2 lets stacks reach 8 | Maul still triggers (≥5); ≥8 doesn't promote to Devour at P2 (Devour P3-only per spec) |
| Player at P3 reaches 8 stacks | Devour fires immediately on tick (not queued for next bossAttack) |
| Devour at P3 with all heroes at full charge | Picks first hero in iteration (tied lowest fraction); minor player-frustration but matches spec intent |
| Devoured hero tapped by player | `canFireUlt` returns false; ULT animation skipped |
| Devoured hero unlocks (3 turns expired) | Map cleared, hero can fire normally next placement |
| Maul Combo on empty grid | Each `bossAttack` short-circuits at `empties.length === 0`; flashText shows MAUL but no actual cells spawn (graceful) |
| Boss takes damage during Maul Combo (cascade between attacks) | `frenzyHitThisTurn = true` set; tick at end of placement applies decay; mid-combo stack count unchanged |
| Player retries Ursaro (lost first attempt) | All Frenzy state reset via `resetChapter2ArchetypeState`; full curriculum re-fires |
| Ursaro win | `applyBossDefeatProgression(8)` → BOSS_UNLOCKS[8] unlocks EMBERSPARK + RADIANCE; existing celebration |
| Reduced-motion preference | No new animations added (visual indicators are static glow + filter; CSS `@media` retained) |

---

## E. Roman regression checklist

JS syntax verified post-edits via JavaScriptCore — file parses through 17,314+ lines clean.

1. **Chapter 1 progression unaffected**:
   - Pyredrake Berserker enrage at 50% HP unchanged
   - All 5 Chapter 1 bosses play unchanged

2. **Verothira (Block 3) + Gearheart (Block 4) preserved**:
   - Hypnotist mechanics still fire correctly
   - Engineer Cell Lockdown / Resource Extract / Critical Mass still fire correctly
   - 5 Crocs unlock at correct boss kills

3. **Ursaro dry-run** (DevTools):
   ```js
   setChapter(2); currentBossIdx = 2; startBossBattle();
   // → URSARO fight; frenzy aura active (hot orange pulse)
   // → Voice intro: "Hungry... hungry... hungry..."
   // → Stack count climbs each turn boss isn't hit
   // → At ≥5 stacks (P2): "🐻 MAUL · 5" flash → next attack is 3-burst
   // → At ≥8 stacks (P3): "🐻🐻 DEVOUR · MOSSJAW · BOSS +N" flash; hero card dims red
   ```

4. **Frenzy stack damage scaling**:
   - With 5 stacks: bossAttack spawns ×1.25 cells (vs base 3 → 4 cells)
   - With 10 stacks (P1 cap): ×1.50 cells (3 → 5)

5. **Maul Combo behavior**:
   - Stack ≥5, P2+ → next `bossAttack` runs 3 times in sequence (400ms apart)
   - Each strike spawns void cells per Frenzy-scaled count
   - Player can hit boss between strikes (stacks decay 50% next turn)

6. **Devour interaction**:
   - At P3 ≥8 stacks: Devour fires on tick → weakest hero locked + boss heals
   - canFireUlt returns false for devoured hero
   - Hero card shows red dim + 🐻 badge
   - 3 turns later: hero card brightens, ULT fires normally

7. **Ursaro win**:
   - `applyBossDefeatProgression(8)` fires
   - ⚡ EMBERSPARK + RADIANCE UNLOCKED celebrations
   - Squad-select shows EMBERSPARK + RADIANCE no longer locked
   - LUMENWIND + AEGIS + SOLARLORD remain locked ("Coming in Chapter 2 — defeat TIDESPIRE...")

8. **DevTools verification**:
   - `BOSS_UNLOCKS[8]` → `['spark_warrior', 'spark_hunter']`
   - `HERO_ROSTER.find(h => h.id === 'spark_warrior').locked` → `undefined` (removed)
   - `HERO_ROSTER.find(h => h.id === 'spark_mage').locked` → `true` (still locked)
   - `__debugChapter2Archetype()` shows frenzy.stacks ticking during Ursaro fight

9. **No console errors** through Verothira → Gearheart → Ursaro full sequence.

---

## F. Spec adherence

| Spec point (Compendium §8 + Meta §5.3) | Implementation | Status |
|---|---|---|
| Frenzy Stacks: +1/turn no-hit, reset on hit | Block 1 tick + Block 5 hit detection in dealDamage | ✅ |
| Each stack +5% boss attack | `mult *= (1 + frenzyStacks * 0.05)` in bossAttack | ✅ |
| P2: stacks decay 50% on hit (not full reset) | `_tickFrenzy` phase guard + `FRENZY_DECAY_P2` | ✅ |
| P3: stacks gain doubled (+2/turn) | Block 1 `frenzyP3Active` flag + `BATTERY_GAIN_P3_BASE` | ✅ |
| Maul Combo: P2+ ≥5 stacks → 3 attacks | maybeBossAttack wraps bossAttack in 3-iteration loop | ✅ |
| Devour: P3 ≥8 stacks → lock hero 3 turns + boss heal 8% | `_frenzyDevour` picks lowest-charge hero, locks, heals | ✅ |
| Devoured hero firing locked | `canFireUlt` returns false for devoured hero | ✅ |
| Ursaro win → 2 Sparks unlock | `BOSS_UNLOCKS[8]` + `locked: true` removal | ✅ |
| Visual: devoured hero indicator | `.hero-card--frenzy-devoured` red theme + 🐻 badge | ✅ |
| Tactile feedback | `vibrate(...)` on Maul + Devour | ✅ |

---

## G. Phase 5b progress

- ✅ Block 1 — Chapter 2 archetype infrastructure (`95bc783`)
- ✅ Block 2 — Chapter 2 boss data + 5 PNG assets (`1c869c4`)
- ✅ Block 3 — VEROTHIRA (Hypnotist) + 2 Crocs unlock (`8d656b9`)
- ✅ Block 4 — GEARHEART (Engineer) + 3 Crocs unlock (`738f1b8`)
- ✅ **Block 5 — URSARO (Frenzy) + 2 Sparks unlock** (this commit)
- ⏳ Block 6 — TIDESPIRE (Tempo Disruptor) + 3 Sparks unlock
- ⏳ Block 7 — HELIOTRON (Battery) + Chapter 2 finale
- ⏳ Block 8 — World Map cinematic + Chapter 2 transition + UI access
- ⏳ Block 9 — Phase 5b sign-off + tag `v0.5.5-chapter-2-done`

After Block 5: 22/25 heroes unlockable (5 Pirates + 5 Rock + 5 Sharks + 5 Crocs + 2 Sparks).

---

## H. Git status

Single Block 5 commit on `phase-2-grammar`. Auto-merged to `main`.
