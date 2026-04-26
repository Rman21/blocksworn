# PHASE 5b BLOCK 4 — GEARHEART (Engineer mechanics) + 3 Crocodile unlock

**Branch:** `phase-2-grammar`
**Spec:** [BLOCKSWORN_BOSS_COMPENDIUM.md](../BLOCKSWORN_BOSS_COMPENDIUM.md) §7 GEARHEART · [BLOCKSWORN_META_PROGRESSION.md](../BLOCKSWORN_META_PROGRESSION.md) §5.3 Chapter 2 unlock progression
**Predecessor:** Phase 5b Block 3 (Verothira) — `8d656b9`
**Date:** 2026-04-26

---

## A. Spec recap

Per Boss Compendium §7 GEARHEART "The Rusted Colossus" — Engineer archetype with 3 sub-mechanics escalating per phase:

1. **Cell Lockdown** (P1+, every 5 turns): weld 2/3/4 cells (per phase) shut for 4 turns — locked cells skip clearLines, blocking cascade resolution
2. **Resource Extract** (P2+, every 7 turns): boss drains up to 3 earth-cells from `groveAbsorbedByCell`; heals 5% maxHP per absorbed cell
3. **Critical Mass** (P3, every 6 turns): 1 random row electrified for 2 turns; clearing cells in that row deals 50 dmg/cell to PLAYER

Plus per Meta-Progression §5.3: Gearheart victory unlocks remaining 3 Crocodile heroes (MOSSWEAVER, IRONSCALE, ANCIENTSCALE) via BOSS_UNLOCKS[7]. After this block, full 5/5 Crocodile roster playable.

---

## B. Implementation

### B.1 BOSS_UNLOCKS[7] + lock removal for 3 Crocs

```js
7: ['crocodile_mage', 'crocodile_tank', 'crocodile_captain'],   // Gearheart → rest of Crocs
```

Removed `locked: true` from:
- `crocodile_mage` (MOSSWEAVER) — Verdant Surge amp window mage
- `crocodile_tank` (IRONSCALE) — Wall of Roots tank
- `crocodile_captain` (ANCIENTSCALE) — Eternal Bastion captain dual

After this block: all 5 Crocodiles playable (MOSSJAW + THORNBACK from Block 3 + these 3). All 5 Sparks remain locked (Blocks 5b.5-5b.6).

### B.2 Cell Lockdown — actual cell welding

Block 1's `_tickEngineer` was scaffolding (counter ticks + flashText). Block 4 upgrades it to call `_engineerWeldCells(count)`:

```js
function _engineerWeldCells(count) {
  // Pick random non-welded non-empty non-void cells; lock for 4 turns each
  const candidates = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const v = grid[r][c]; const key = r + '_' + c;
    if (!v || v.startsWith('void_') || engineerLockedCells.has(key)) continue;
    candidates.push([r, c]);
  }
  // ...random pick `count` items, set in engineerLockedCells Map
  for (const [r, c] of picks) engineerLockedCells.set(r + '_' + c, ENGINEER_WELD_DURATION);
  flashText('⚙ WELD ×' + picks.length, '#B87333');
}
```

`engineerLockedCells` Map (from Block 1) ticks decay per turn — locked cells unlock automatically after 4 turns.

**clearLines integration** — locked cells skip clear (mirror of `permanentFrozenCells` pattern):

```js
for (const r of rows) for (let c = 0; c < SIZE; c++) {
  const _key = r + '_' + c;
  if (permanentFrozenCells.has(_key)) continue;
  if (engineerLockedCells.has(_key)) continue;  // NEW: Engineer Cell Lockdown
  grid[r][c] = null;
}
```

When player completes a line that includes a welded cell, the line "completes" but the welded cell stays. Other cells in the line clear normally. Result: row partially cleared, welded cell remains as obstacle.

### B.3 Resource Extract (P2+)

Boss heal mechanic — drain earth-cells from `groveAbsorbedByCell` (Phase 5 Block 1 infrastructure):

```js
function _engineerExtractEarthCells() {
  if (groveAbsorbedByCell.size === 0) {
    flashText('⚙ EXTRACT · NO RESOURCES', ...);
    return 0;
  }
  // Pick up to 3 random earth-cell keys, drain from Map
  const picks = keys.slice(0, Math.min(3, keys.length));
  for (const key of picks) {
    totalAbsorbed += groveAbsorbedByCell.get(key) || 0;
    groveAbsorbedByCell.delete(key);
  }
  // Reduce groveTotalAbsorbed in sync (REVENGE BURST cap detection)
  groveTotalAbsorbed = Math.max(0, groveTotalAbsorbed - totalAbsorbed);
  // Boss heals 5% maxHP per drained cell
  const healAmount = Math.floor(bossMaxHP * ENGINEER_EXTRACT_HEAL_PCT * picks.length);
  bossHP = Math.min(bossMaxHP, bossHP + healAmount);
  flashText('⚙ EXTRACT ×' + picks.length + ' · BOSS +' + healAmount, ...);
  renderBossHP();
}
```

Strategic counter: player can fire THORNBACK / MOSSWEAVER ULT to consume earth-cells before boss extracts them. Drains player's defensive pool but denies boss heal.

### B.4 Critical Mass (P3 electrified row)

Block 1 sets `engineerElectrifiedRow` and decays counter. Block 4 adds the actual damage path:

```js
async function clearLines(rows, cols) {
  // Count cleared cells in electrified row BEFORE clear
  let _engineerElectrifiedClears = 0;
  if (engineerElectrifiedRow >= 0 && engineerElectrifiedTurns > 0
      && currentBoss.archetype === 'engineer') {
    for (let c = 0; c < SIZE; c++) {
      // Skip welded cells (they don't clear → no electrification damage)
      if (engineerLockedCells.has(engineerElectrifiedRow + '_' + c)) continue;
      if (idxs.has(engineerElectrifiedRow * SIZE + c) && grid[engineerElectrifiedRow][c]) {
        _engineerElectrifiedClears++;
      }
    }
  }
  // ... existing clear logic ...
  // After clears: damage player
  if (_engineerElectrifiedClears > 0) {
    const _criticalDmg = _engineerElectrifiedClears * 50;
    flashText('⚙⚙ CRITICAL MASS · ' + _criticalDmg, ...);
    if (shieldCount > 0) shieldCount = Math.max(0, shieldCount - 1);
    else { hp = Math.max(0, hp - _criticalDmg); battleDamageTaken += _criticalDmg; ... }
  }
}
```

**Cruel inversion per Compendium**: clearing cells normally good (combo damage). In electrified row, same act hurts player. Forces player to work AROUND the row OR clear strategically (one cell at a time, not full row).

50 dmg per cell scales: 4-cell partial clear in electrified row = 200 dmg = significant chunk of HP. 1 shield blocks the entire burst (similar to Bloom Bloom corruption pattern from Block 3).

### B.5 Visual indicators

**Welded cell (`.cell--engineer-welded`)**:
- Outline: copper bronze (#B87333)
- Background: 3-stop radial gradient (rust spots + center darkening)
- Box-shadow: deep inset shadow with rust pulse animation (2.4s)
- ::before pseudo-element: ⚙ gear emoji centered, gold text-shadow

**Electrified row (`.cell--engineer-electrified`)**:
- Outline: bright green (#5BFF80)
- Box-shadow: green glow + inset green tint
- Pulse animation: faster (0.9s) for "active electricity" feel

**Reduced-motion** disabled both pulse animations; static glows retained.

`_renderEngineerVisuals()` re-applied on every `renderGrid()` so welded cell badges + electrified row glow persist across re-renders.

---

## C. What this block does NOT touch

- Phase 1/2/3/4/5 + Phase 5b Block 1/2/3 work intact.
- Block 1 archetype infrastructure (other 4 archetypes) preserved verbatim.
- Block 3 Verothira mechanics + Crocs[1-2] unlock unchanged.
- Existing Chapter 1 progression unaffected.
- All 5 Sparks stay `locked: true` (Blocks 5b.5-5b.6 unlock).
- `permanentFrozenCells` (Phase 2 V2.0 frost mechanic) untouched — Engineer welds use SEPARATE Map (`engineerLockedCells`).
- Existing groveAbsorbedByCell mechanics (Crocodile heroes' fire/ULT) unchanged — Resource Extract is a NEW drainer that DECREASES the pool.
- World Map / Chapter 2 nav UI (Block 5b.8).

---

## D. Edge cases handled

| Scenario | Behavior |
|---|---|
| Gearheart fight starts | Engineer aura + intro voice + tickChapter2Archetype routes to `_tickEngineer` |
| Welded cell included in completed line | Cell stays welded; other cells in line clear normally; row remains "partial" |
| Welded cell unlocks (4 turns expired) | Map entry deleted; cell behaves normally next placement |
| Resource Extract with 0 earth-cells in pool | "EXTRACT · NO RESOURCES" flash; bossHP unchanged |
| Resource Extract triggers REVENGE BURST cap detection | groveTotalAbsorbed updated downward; if was past threshold then dropped below, no re-fire (one-shot flag) |
| Critical Mass electrified row + welded cell in that row | Welded cell skips clear → does NOT contribute to electrified damage count |
| Critical Mass full-row clear (5 cells in electrified row) | 5 × 50 = 250 dmg; 1 shield absorbs OR full HP loss |
| Critical Mass with shieldCount > 0 | 1 shield consumed (regardless of damage amount); damage prevented |
| Critical Mass on empty board (no cells in row) | _engineerElectrifiedClears = 0; no damage |
| Welded cell blocks placement attempt | Player can place pieces ON welded cells (existing canPlace check unchanged); piece sits there but row never clears until weld expires |
| Player retries Gearheart (lost first attempt) | All Engineer state reset via `resetChapter2ArchetypeState` in `startBossBattle` |
| Gearheart win | `applyBossDefeatProgression(7)` → BOSS_UNLOCKS[7] unlocks 3 Crocs; existing celebration |
| Existing Verothira save state migrates to Block 4 | No migration needed — Block 4 is purely additive (new Cell Lockdown / Extract / Critical Mass mechanics gated by Engineer archetype) |
| Reduced-motion preference | Weld + electrify pulse animations disabled; static glows retained |

---

## E. Roman regression checklist

JS syntax verified post-edits via JavaScriptCore — file parses through 17,198+ lines clean.

1. **Chapter 1 progression unaffected**:
   - All 5 Chapter 1 bosses play unchanged
   - clearLines logic preserved (existing permanentFrozenCells path)
   - No Engineer state leaks into Chapter 1 fights

2. **Verothira fight (Block 3) preserved**:
   - Hypnotist mechanics still fire correctly
   - Crocs[1-2] unlock still triggers on Verothira win

3. **Gearheart dry-run** (DevTools):
   ```js
   setChapter(2); currentBossIdx = 1; startBossBattle();
   // → GEARHEART fight; engineer aura active
   // → Voice intro: "DIRECTIVE... ACTIVE..."
   // → ~5 turns later: ⚙ WELD ×2; 2 cells gain copper outline + ⚙ badge
   // → Welded cells skip clearLines → row stays partial after line completion
   ```

4. **Cell Lockdown lifecycle**:
   - Watch a welded cell across 4 turns → unlocks automatically (4-turn duration)
   - Confirm `__debugChapter2Archetype().engineer.lockedCells` shrinks to 0

5. **Resource Extract P2** (drop boss to 60%):
   - With Crocs in squad + earth-cells absorbed: Extract drains 3 cells, boss heals
   - Without Crocs/earth-cells: "EXTRACT · NO RESOURCES" flash

6. **Critical Mass P3** (drop boss to 30%):
   - Random row gets bright green outline + electricity pulse
   - Clearing cells in that row → "⚙⚙ CRITICAL MASS · N" flash + HP loss
   - 2 turns later: row de-electrifies

7. **Gearheart win**:
   - `applyBossDefeatProgression(7)` fires
   - 🦎 MOSSWEAVER + IRONSCALE + ANCIENTSCALE UNLOCKED celebrations
   - Squad-select shows all 5 Crocodiles unlocked

8. **DevTools verification**:
   - `BOSS_UNLOCKS[7]` → `['crocodile_mage', 'crocodile_tank', 'crocodile_captain']`
   - `HERO_ROSTER.find(h => h.id === 'crocodile_captain').locked` → `undefined` (removed)
   - `HERO_ROSTER.filter(h => h.race === 'crocodile').every(h => !h.locked)` → `true` after Gearheart win
   - `HERO_ROSTER.find(h => h.id === 'spark_warrior').locked` → `true` (still locked)

9. **No console errors** through Verothira → Gearheart full sequence.

---

## F. Spec adherence

| Spec point (Compendium §7 + Meta §5.3) | Implementation | Status |
|---|---|---|
| Cell Lockdown: 2/3/4 cells per phase | `_engineerWeldCells(count)` with phase-aware count | ✅ |
| Welded cell duration: 4 turns | `ENGINEER_WELD_DURATION = 4` + per-tick decay | ✅ |
| Welded cells skip clearLines | New guard alongside `permanentFrozenCells` | ✅ |
| Resource Extract: P2+, every 7 turns | `_tickEngineer` phase guard + `_engineerExtractEarthCells` | ✅ |
| Boss heal: 5% maxHP per drained cell | `Math.floor(bossMaxHP * 0.05 * picks.length)` | ✅ |
| Critical Mass: P3, every 6 turns, 2-turn duration | `engineerElectrifiedRow` + `engineerElectrifiedTurns` | ✅ |
| Critical Mass damage: clearing cells in row hurts player | `clearLines` Critical Mass count + post-clear damage | ✅ |
| Critical Mass damage: 50 dmg/cell | `_engineerElectrifiedClears * 50` | ✅ |
| Gearheart win → 3 Crocs unlock | `BOSS_UNLOCKS[7]` + `locked: true` removal | ✅ |
| Visual: welded cells (copper rust) | `.cell--engineer-welded` CSS + ⚙ badge | ✅ |
| Visual: electrified row (green pulse) | `.cell--engineer-electrified` CSS | ✅ |
| Reduced-motion compliance | `@media` block disables both pulses | ✅ |
| Tactile feedback | `vibrate(...)` on weld + extract + electrify | ✅ |

---

## G. Phase 5b progress

- ✅ Block 1 — Chapter 2 archetype infrastructure (`95bc783`)
- ✅ Block 2 — Chapter 2 boss data + 5 PNG assets (`1c869c4`)
- ✅ Block 3 — VEROTHIRA (Hypnotist) + 2 Crocs unlock (`8d656b9`)
- ✅ **Block 4 — GEARHEART (Engineer) + 3 Crocs unlock** (this commit)
- ⏳ Block 5 — URSARO (Frenzy) + 2 Sparks unlock
- ⏳ Block 6 — TIDESPIRE (Tempo Disruptor) + 3 Sparks unlock
- ⏳ Block 7 — HELIOTRON (Battery) + Chapter 2 finale
- ⏳ Block 8 — World Map cinematic + Chapter 2 transition + UI access
- ⏳ Block 9 — Phase 5b sign-off + tag `v0.5.5-chapter-2-done`

After Block 4: **all 5 Crocodiles unlockable** through Chapter 2 progression. All 5 Sparks remain Phase 5b.5-5b.6.

---

## H. Git status

Single Block 4 commit on `phase-2-grammar`. Auto-merged to `main`.
