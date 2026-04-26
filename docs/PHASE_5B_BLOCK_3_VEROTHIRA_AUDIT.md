# PHASE 5b BLOCK 3 — VEROTHIRA (Hypnotist mechanics) + 2 Crocodile unlock

**Branch:** `phase-2-grammar`
**Spec:** [BLOCKSWORN_BOSS_COMPENDIUM.md](../BLOCKSWORN_BOSS_COMPENDIUM.md) §6 VEROTHIRA · [BLOCKSWORN_META_PROGRESSION.md](../BLOCKSWORN_META_PROGRESSION.md) §5.3 Chapter 2 unlock progression
**Predecessor:** Phase 5b Block 2 (Chapter 2 boss data) — `1c869c4`
**Date:** 2026-04-26

---

## A. Spec recap

Per Boss Compendium §6 VEROTHIRA "The Hungering Bloom" — Hypnotist archetype with 3-phase progression and 4 sub-mechanics:

1. **Petal Fall** (P1+, every 5 turns): 4 random non-umbra cells → umbra
2. **Hypnotic Suggestion** (P1+, every 8/6/4 turns by phase): boss "suggests" 1/2/2 squad heroes; firing them grants +30%/+50%/+75% damage bonus
3. **Tendril Coil** (P2+, every 6 turns): tentacle wraps a random hero → cannot fire ULT for 2 turns
4. **Bloom Bloom** (P3, every 8 turns): corrupts board — clearing umbra cells deals damage to PLAYER (cruel inversion)

Plus per Meta-Progression §5.3: Verothira victory unlocks first 2 Crocodile heroes (MOSSJAW + THORNBACK) via BOSS_UNLOCKS[6].

This block ships full Verothira combat behavior. Phase 5b Block 1 shipped infrastructure scaffolding (counters, flashText announcements); Block 3 adds actual mechanic logic (cell conversion, damage bonus, firing lock, corruption damage) + visual indicators.

---

## B. Implementation

### B.1 Chapter-aware boss numbering — fixed collision

Pre-Block 3: `applyBossDefeatProgression(currentBossIdx + 1)` used chapter-LOCAL boss index. Chapter 2 Boss 1 (Verothira) would map to `BOSS_UNLOCKS[1]` → wrongly unlock Pirates.

Fix: compute global boss number at call site:
```js
const _globalBossNum = (currentChapter - 1) * 5 + currentBossIdx + 1;
applyBossDefeatProgression(_globalBossNum);
```

Mapping:
- Chapter 1 Boss 1-5 → `BOSS_UNLOCKS[1..5]` (unchanged)
- Chapter 2 Boss 1-5 → `BOSS_UNLOCKS[6..10]` (NEW; Block 3 adds [6], blocks 4-7 add [7..10])

`applyBossDefeatProgression` function signature unchanged — single integer, no signature break.

### B.2 BOSS_UNLOCKS[6] + Croc lock removal

```js
6: ['crocodile_warrior', 'crocodile_hunter'],   // Verothira → first 2 Crocodiles (Block 5b.3)
```

Removed `locked: true` from `crocodile_warrior` (MOSSJAW) and `crocodile_hunter` (THORNBACK) in HERO_ROSTER. Mage/Tank/Captain remain locked behind Block 5b.4 (Gearheart).

Phase 5 Block 5's defense-in-depth lock guards (`unlockHero` + `isHeroUnlocked` + `loadUnlockedHeroesFromStorage`) all check `h.locked`; with flag removed, normal unlock flow now succeeds for these 2 heroes.

### B.3 Petal Fall — actual cell conversion

```js
function _hypnotistPetalFall(count) {
  // Pick `count` random non-umbra non-void cells, flash burning, convert to umbra
  const targets = [];
  for (...) if (v && !v.startsWith('void_') && v !== 'umbra') targets.push([r, c]);
  targets.sort(() => Math.random() - 0.5);
  const picks = targets.slice(0, Math.min(count, targets.length));
  // Flash 'burning' class, then mutate after 250ms
  for (const [r, c] of picks) cellEls[r * SIZE + c].classList.add('burning');
  setTimeout(() => { for (const [r, c] of picks) grid[r][c] = 'umbra'; render(); }, 250);
  flashText('🌸 PETAL FALL ×' + picks.length, '#9B59D6');
  vibrate([40, 30, 40]);
}
```

Triggered every 5 turns from `_tickHypnotist`. Forces board state — gives Verothira free umbra cells to fuel her own mechanics + Encore stack interactions (when Rock Band squad).

### B.4 Hypnotic Suggestion — bonus damage path

Block 1 picked suggestion targets via `hypnotistSuggestedHeroIds[]`. Block 3 adds:

**Visual** (CSS `.hero-card--hypno-suggested`):
```css
.hero-card.hero-card--hypno-suggested {
  outline: 2px solid #9B59D6;
  box-shadow: 0 0 16px 3px rgba(155, 89, 214, 0.85), 0 0 28px rgba(190, 130, 240, 0.55);
  animation: hypnoSuggestPulse 1.8s ease-in-out infinite;
}
.hero-card.hero-card--hypno-suggested::after {
  content: '🌸';  /* corner badge */
  ...
}
```

**Damage bonus** (in `dealDamage` mult stack):
```js
let _hypnoSuggestContext = 1;
if (hypnotistSuggestedHeroIds.length > 0
    && _currentFiringHero
    && hypnotistSuggestedHeroIds.includes(_currentFiringHero.id)) {
  const phase = _bossArchetypePhase();
  const bonus = phase === 1 ? 0.30 : phase === 2 ? 0.50 : 0.75;
  _hypnoSuggestContext = 1 + bonus;
  // Consume — clear suggestion to prevent stacking
  hypnotistSuggestedHeroIds.splice(idx, 1);
  flashText('🌸 OBEYED · +' + Math.round(bonus * 100) + '%', '#9B59D6');
}
const _multStack = ... × _hypnoSuggestContext;
```

Adds 11th multiplier to dealDamage stack (was 10 — Phase 5 Block 1 spec). Subject to FIRE_MULT_CAP = 3.0 (existing clamp).

**Choice mechanic per spec**: Player can ignore suggestion (no penalty, no bonus) or obey (bonus). Maps directly to "trust your own decisions vs dance to her song" Compendium thematic identity.

`renderHypnotistVisuals()` re-applied on every `renderDeck()` so portrait pulse persists across re-renders.

### B.5 Tendril Coil — firing lock

Block 1 stored `hypnotistTendrilHeroId` + `hypnotistTendrilTurnsLeft`. Block 3 adds:

**Selection** (`_hypnotistTendrilCoil`): pick a random non-suggested non-already-coiled squad hero, lock for 2 turns.

**Firing guard** (in `canFireUlt`):
```js
if (hypnotistTendrilHeroId === heroId && hypnotistTendrilTurnsLeft > 0) {
  return false;
}
return (heroCharges[heroId] || 0) >= getUltCost(heroId);
```

**Visual** (CSS `.hero-card--hypno-coiled`):
```css
.hero-card.hero-card--hypno-coiled {
  outline: 2px solid #6B3FA0;
  filter: brightness(0.55) saturate(0.7);
  box-shadow: inset 0 0 24px rgba(74, 30, 110, 0.85);
}
.hero-card.hero-card--hypno-coiled::after {
  content: '🔗';  /* corner chain badge */
  ...
}
```

Coiled hero portrait dimmed + chain badge — visually distinct from the bright glow of suggested heroes (distinct "stop" vs "go" prompts).

Decay handled in `_tickHypnotist` — turns counter -1 per placement; auto-clears when 0.

### B.6 Bloom Bloom — corrupted umbra clears

Block 1 set `hypnotistBloomCorrupted` flag at P3 8-turn intervals. Block 3 adds the actual damage path in `onUmbraCellsCleared`:

```js
function onUmbraCellsCleared(n) {
  if (hypnotistBloomCorrupted && currentBoss && currentBoss.archetype === 'hypnotist') {
    const corruptDmg = n * 30;
    flashText('🌸 BLOOM CORRUPT · ' + corruptDmg, '#9B59D6');
    if (shieldCount > 0) {
      shieldCount = Math.max(0, shieldCount - 1);  // shield blocks
    } else {
      hp = Math.max(0, hp - corruptDmg);            // HP loss
      battleDamageTaken += corruptDmg;
      if (hp === 0 && !gameEnded) showDefeatModal();  // defeat check
    }
  }
  // ... existing umbra-clear logic (encore stacks, rhythm section, etc.) ...
}
```

**Cruel inversion per Compendium**: clearing umbra cells normally = +1 encore stack benefit. During Bloom Bloom, the same act now hurts the player. Forces tempo pivot — clear umbra fast OR avoid clearing umbra at all.

Damage scales linearly with cells cleared (30 per cell). 4-row clear = 120 dmg = significant chunk of HP. Capped by available shields (1 shield blocks all corruption damage from that clear) → tank-heavy squads have natural counter.

### B.7 Per-tick orchestration

Block 1's `_tickHypnotist(phase)` upgraded from interval-only to full mechanic dispatch:

```js
function _tickHypnotist(phase) {
  // Suggestion (P1+, 8/6/4 interval)
  // Petal Fall (P1+, 5 interval) → _hypnotistPetalFall(4)
  // Tendril Coil (P2+, 6 interval) → _hypnotistTendrilCoil()
  // Bloom Bloom (P3, 8 interval) → set hypnotistBloomCorrupted = true
  // Tendril decay (per turn)
}
```

Suggestions exclude current Tendril target (no double-bind on same hero). Tendril candidates exclude suggested heroes (no contradiction).

---

## C. What this block does NOT touch

- Phase 1/2/3/4/5 + Phase 5b Block 1/2 work intact.
- Existing Chapter 1 progression (5 bosses, 15 unlock timeline) unchanged.
- Block 1 archetype infrastructure (other 4 archetypes) preserved verbatim.
- Block 2 Chapter 2 boss data (CHAPTERS[1] roster) unchanged.
- Crocodile Mage/Tank/Captain stay `locked: true` (Block 5b.4 unlocks).
- All 5 Spark heroes stay `locked: true` (Blocks 5b.5-5b.6 unlock).
- World Map / Chapter 2 nav UI not yet (Block 5b.8).

---

## D. Edge cases handled

| Scenario | Behavior |
|---|---|
| Verothira fight starts | Hypnotist aura + intro voice + tickChapter2Archetype dispatcher routes to `_tickHypnotist` |
| Player fires non-suggested hero | No bonus, no penalty — neutral path |
| Player fires suggested hero | +30/50/75% damage bonus per phase, "OBEYED" flash, suggestion consumed |
| Suggestion windows overlap (P2/P3 has 2 simultaneous) | Each suggested hero independently consumable; firing one clears just that hero from suggestion list |
| Tendril coiled hero tapped by player | `canFireUlt` returns false → ULT doesn't fire; hero card visually dimmed + chained |
| Tendril candidate selection finds no eligible hero (all coiled / all suggested) | No-op, retry next interval |
| Bloom Bloom triggers during phoenix immunity | Unaffected — Bloom Bloom is hypnotist-only, fires regardless |
| Bloom umbra clear with shields > 0 | 1 shield consumed per affected clear (vs full HP loss) |
| Bloom umbra clear with hp would drop to 0 | Triggers `showDefeatModal()` → Death Flashback flow as normal |
| Player retries Verothira (lost first attempt) | All Hypnotist state reset via `resetChapter2ArchetypeState` in `startBossBattle`; full curriculum re-fires |
| Verothira win | `applyBossDefeatProgression(6)` → BOSS_UNLOCKS[6] unlocks MOSSJAW + THORNBACK; existing `unlockHero` celebration fires |
| Existing save with Crocs in storage from pre-Block-5 | Phase 5 Block 5 migration already stripped them; Block 3 `BOSS_UNLOCKS[6]` re-grants them on Verothira win |
| Devtools `setChapter(2); currentBossIdx = 0; startBossBattle();` | Archetype 'hypnotist' aura + voice intro + all 4 mechanics tick correctly |
| Renderdeck called during Hypnotist battle | `renderHypnotistVisuals()` re-applies CSS classes for suggested/coiled heroes |
| Reduced-motion preference | Suggestion pulse animation killed via `@media` query; static glow retained |

---

## E. Roman regression checklist

JS syntax verified post-edits via JavaScriptCore — file parses through 17,067+ lines clean.

1. **Chapter 1 progression unaffected**:
   - Pyredrake win → BOSS_UNLOCKS[1] (Pirates) — chapter-aware mapping verified
   - Crypt Lich win → BOSS_UNLOCKS[5] (empty) — chapter complete celebration unchanged
   - All 5 Chapter 1 bosses play unchanged

2. **Chapter 2 dry-run** (DevTools):
   ```js
   setChapter(2); currentBossIdx = 0; startBossBattle();
   // → VEROTHIRA fight; hypnotist aura active
   // → "Welcome, little spark..." voice line at 1.5s
   // → ~8 turns later: 🌸 SUGGESTION +30% flash; one hero card glows purple
   // → ~5 turns later: 🌸 PETAL FALL ×4; 4 random cells burn → umbra
   ```

3. **Hypnotic Suggestion obey path**:
   - Wait for suggestion → fire suggested hero
   - Damage number = base × 1.30 (P1)
   - "OBEYED · +30%" flash
   - Suggestion cleared (hero card pulse stops)

4. **Suggestion ignore path**:
   - Wait for suggestion → fire non-suggested hero
   - Damage number = base (no bonus)
   - Suggestion remains active until next 8-turn cycle

5. **Tendril Coil P2** (drop boss to 60% HP):
   - 🌸 TENDRIL · [HERO] COILED flash
   - That hero card dims + 🔗 badge appears
   - Tap hero portrait → no fire
   - 2 placements later: hero card brightens, ULT fires normally

6. **Bloom Bloom P3** (drop boss to 30% HP):
   - 🌸🌸 BLOOM BLOOM · UMBRA HURTS flash
   - Next umbra clear → 🌸 BLOOM CORRUPT · N flash + hp loss
   - Shields absorb if any

7. **Verothira win**:
   - `applyBossDefeatProgression(6)` fires
   - 🦎 MOSSJAW UNLOCKED + 🦎 THORNBACK UNLOCKED celebrations
   - Squad-select shows MOSSJAW + THORNBACK no longer locked
   - Other 3 Crocs + all 5 Sparks remain locked ("Coming in Chapter 2...")

8. **DevTools verification**:
   - `BOSS_UNLOCKS[6]` → `['crocodile_warrior', 'crocodile_hunter']`
   - `HERO_ROSTER.find(h => h.id === 'crocodile_warrior').locked` → `undefined` (removed)
   - `HERO_ROSTER.find(h => h.id === 'crocodile_mage').locked` → `true` (still locked)
   - `__debugChapter2Archetype()` shows hypnotist counters during Verothira fight

9. **No console errors** through full Chapter 1 + Verothira dry-run.

---

## F. Spec adherence

| Spec point (Compendium §6 + Meta §5.3) | Implementation | Status |
|---|---|---|
| Petal Fall: every 5 turns, 4 cells → umbra | `_hypnotistPetalFall(4)` | ✅ |
| Hypnotic Suggestion: 1 (P1) / 2 (P2/P3) heroes per cycle | `_tickHypnotist` count = phase === 1 ? 1 : 2 | ✅ |
| Suggestion bonus +30/50/75% | `_hypnoSuggestContext = 1 + bonus` in dealDamage stack | ✅ |
| Choice mechanic (ignore = no penalty) | Suggestion only triggers bonus on obey path | ✅ |
| Tendril Coil: P2+, every 6 turns, lock for 2 turns | `canFireUlt` guard + `hypnotistTendrilTurnsLeft` decay | ✅ |
| Bloom Bloom: P3, every 8 turns, corrupted umbra clears | `hypnotistBloomCorrupted` flag + `onUmbraCellsCleared` damage path | ✅ |
| 3-phase progression (HP gates 100/66/33%) | `_bossArchetypePhase()` per Block 1 | ✅ |
| Verothira win → 2 Crocs unlock | `BOSS_UNLOCKS[6]` + chapter-aware boss number | ✅ |
| Mage/Tank/Captain Crocs still locked | `locked: true` retained on those 3 | ✅ |
| Sparks all still locked | `locked: true` retained on all 5 | ✅ |
| Visual: suggested hero glow / coiled hero dim | `.hero-card--hypno-suggested` + `.hero-card--hypno-coiled` CSS classes + render hook | ✅ |
| Reduced-motion compliance | `@media (prefers-reduced-motion: reduce)` block | ✅ |
| Tactile feedback | `vibrate(...)` on each major beat | ✅ |

---

## G. Phase 5b progress

- ✅ Block 1 — Chapter 2 archetype infrastructure (`95bc783`)
- ✅ Block 2 — Chapter 2 boss data + 5 PNG assets (`1c869c4`)
- ✅ **Block 3 — VEROTHIRA (Hypnotist) + 2 Crocs unlock** (this commit)
- ⏳ Block 4 — GEARHEART (Engineer) + 3 Crocs unlock
- ⏳ Block 5 — URSARO (Frenzy) + 2 Sparks unlock
- ⏳ Block 6 — TIDESPIRE (Tempo Disruptor) + 3 Sparks unlock
- ⏳ Block 7 — HELIOTRON (Battery) + Chapter 2 finale
- ⏳ Block 8 — World Map cinematic + Chapter 2 transition + UI access
- ⏳ Block 9 — Phase 5b sign-off + tag `v0.5.5-chapter-2-done`

---

## H. Git status

Single Block 3 commit on `phase-2-grammar`. Auto-merged to `main`.
