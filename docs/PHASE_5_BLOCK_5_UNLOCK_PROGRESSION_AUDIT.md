# PHASE 5 BLOCK 5 — Hero Unlock Progression (lock Crocs/Sparks behind Chapter 2)

**Branch:** `phase-2-grammar`
**Spec:** [BLOCKSWORN_META_PROGRESSION.md](../BLOCKSWORN_META_PROGRESSION.md) §7 Hero Unlocks · [BLOCKSWORN_BOSS_COMPENDIUM.md](../BLOCKSWORN_BOSS_COMPENDIUM.md) §11 Chapter 2 Progression
**Predecessor:** Phase 5 Block 4 (Sparks) — `7386916`
**Date:** 2026-04-26

---

## A. Spec recap

Per Meta-Progression spec §7 hero unlock timeline:

| Stage | Heroes | Status |
|---|---|---|
| FTUE start | 3 prologue heroes | ✅ implemented |
| Win Pyredrake | + 5 same-faction (BACKLOG-002 captain pick) | ✅ implemented |
| Win Abyssal Tyrant | + 5 OTHER faction + SQUAD_MAX→4 | ✅ via BOSS_UNLOCKS[2] |
| Win Grovewarden | + 2 Sharks | ✅ via BOSS_UNLOCKS[3] |
| Win Solar Phoenix | + 3 Sharks + SQUAD_MAX→5 | ✅ via BOSS_UNLOCKS[4] |
| Win Crypt Lich | Chapter 1 complete + World Map opens | ✅ via BOSS_UNLOCKS[5] (no new heroes) |
| **Win Verothira (Chapter 2 Boss 6)** | + 2 Crocodiles | 🔴 **gated behind Phase 5b** |
| **Win Gearheart (Boss 7)** | + 3 Crocodiles | 🔴 **gated behind Phase 5b** |
| **Win Ursaro (Boss 8)** | + 2 Sparks | 🔴 **gated behind Phase 5b** |
| **Win Tidespire (Boss 9)** | + 3 Sparks | 🔴 **gated behind Phase 5b** |
| **Win Heliotron (Boss 10)** | Chapter 2 complete | 🔴 **gated behind Phase 5b** |

Per **D1 Option A** decision (spec-compliant): Crocs/Sparks remain locked until Chapter 2 ships in Phase 5b. This block enforces that lock at the data + UI + storage layer.

---

## B. Implementation

### B.1 `locked: true` flag on 10 Crocs/Sparks heroes

All 5 Crocodile + 5 Spark HERO_ROSTER entries flagged `locked: true`:

```js
{ id:'crocodile_warrior', name:'MOSSJAW', ..., locked: true }
{ id:'crocodile_hunter',  name:'THORNBACK', ..., locked: true }
{ id:'crocodile_mage',    name:'MOSSWEAVER', ..., locked: true }
{ id:'crocodile_tank',    name:'IRONSCALE', ..., locked: true }
{ id:'crocodile_captain', name:'ANCIENTSCALE', ..., locked: true }
{ id:'spark_warrior',     name:'EMBERSPARK', ..., locked: true }
{ id:'spark_hunter',      name:'RADIANCE', ..., locked: true }
{ id:'spark_mage',        name:'LUMENWIND', ..., locked: true }
{ id:'spark_tank',        name:'AEGIS', ..., locked: true }
{ id:'spark_captain',     name:'SOLARLORD', ..., locked: true }
```

Mirrors existing `clockwork_*` placeholder pattern — heroes EXIST in roster (full mechanics intact) but are excluded from squad-select / battle / craft until lock is removed.

### B.2 Hardened `unlockHero` + `isHeroUnlocked` against `locked: true`

```js
function isHeroUnlocked(heroId) {
  const hero = HERO_ROSTER.find(h => h.id === heroId);
  // PHASE 5 BLOCK 5 — locked: true is a hard gate (defense in depth)
  if (hero && hero.locked) return false;
  return !!(hero && hero.unlocked);
}

function unlockHero(heroId) {
  const hero = HERO_ROSTER.find(h => h.id === heroId);
  if (!hero) { ...; return false; }
  // PHASE 5 BLOCK 5 — refuse to unlock locked heroes
  if (hero.locked) {
    console.log('unlockHero: ' + heroId + ' is locked behind Chapter 2 — skipped');
    return false;
  }
  if (hero.unlocked) return false;
  hero.unlocked = true;
  ...
}
```

Why both layers:
- `isHeroUnlocked` guard prevents UI/squad/battle code from treating a locked hero as available even if `unlocked` somehow flipped (legacy save, race condition).
- `unlockHero` guard prevents future `unlockHero('crocodile_warrior')` calls (e.g. from BOSS_UNLOCKS dispatcher) from succeeding before Phase 5b removes the lock.

### B.3 Hardened `loadUnlockedHeroesFromStorage`

Locked heroes can never be unlocked from storage even if a previous build wrote them:

```js
for (const h of HERO_ROSTER) {
  if (h.locked) { h.unlocked = false; continue; }
  h.unlocked = STARTER_HEROES.has(h.id) || storedSet.has(h.id);
}
```

### B.4 One-time migration `runMigration_PHASE5_lock_chapter2_heroes`

Strips Crocs/Sparks IDs from `blocksworn_heroes_unlocked` AND `blocksworn_squad` localStorage entries on first parse-time run. Idempotent — `blocksworn_migration_phase5_chapter2_lock` flag prevents re-runs.

Use case: dev/playtest saves from Phase 5 Block 2-4 may have `crocodile_warrior` etc. in unlocked list (manually unlocked via `unlockHero()` in DevTools, or via direct storage edit). Migration scrubs those entries on first load post Block 5 ship.

**Migration order** (preserved):
```
runMigration_PHASE5_lock_chapter2_heroes()  ← NEW: scrub Croc/Spark from storage
loadUnlockedHeroesFromStorage()
loadSquadMaxFromStorage()
runMigration_B3()                             ← existing: backfill from bossesDefeated
runMigration_BACKLOG002_tank_backfill()       ← existing: BACKLOG-002 tank fix
```

PHASE 5 migration runs FIRST so storage is clean before `loadUnlockedHeroesFromStorage` reads it. Otherwise Crocs/Sparks would briefly appear unlocked, then get re-locked — causes a flicker if any UI renders during the gap.

### B.5 Lock-modal UX — "Coming in Chapter 2" placeholder

`showLockedHeroModal` branches on `hero.locked`:

- **Hard-locked (Crocs/Sparks)**: race-aware Chapter 2 message, NO fragment progress bar, NO CLAIM button:
  - Crocodiles → "Coming in Chapter 2 — defeat VEROTHIRA to unlock the Crocodiles."
  - Sparks → "Coming in Chapter 2 — defeat URSARO to unlock the Sparks."
  - Generic fallback (future races) → "Coming in Chapter 2 — keep playing to unlock new races."
- **Soft-locked (existing pattern)**: standard "Locked — defeat the right boss or collect 50 fragments" + fragment progress + CLAIM button.

Modal still shows hero portrait + name + meta (race · element · role) — players see WHAT'S coming, just not WHEN beyond "Chapter 2."

### B.6 BOSS_UNLOCKS map — already correct

Existing `BOSS_UNLOCKS` map (line ~9381) handles Chapter 1 progression unchanged:

```js
const BOSS_UNLOCKS = {
  1: ['pirate_mage', 'pirate_tank'],            // Pyredrake (BACKLOG-002 unlocks 5; this is fallback)
  2: ['rock_warrior', 'rock_hunter', ...],      // Tyrant → Rock Band
  3: ['shark_warrior', 'shark_hunter'],         // Grovewarden → 2 Sharks
  4: ['shark_mage', 'shark_tank', 'shark_captain'],  // Phoenix → rest of Sharks
  5: [],                                         // Crypt Lich → no new heroes
};
```

Phase 5b will extend this map with Boss 6-10 entries when Chapter 2 ships:

```js
// Phase 5b additions (NOT in this block):
// 6: ['crocodile_warrior', 'crocodile_hunter'],
// 7: ['crocodile_mage', 'crocodile_tank', 'crocodile_captain'],
// 8: ['spark_warrior', 'spark_hunter'],
// 9: ['spark_mage', 'spark_tank', 'spark_captain'],
// 10: [],  // Heliotron → Chapter 2 complete
```

When Phase 5b removes `locked: true` and adds Boss 6-10 entries, `unlockHero` will start succeeding for Crocs/Sparks naturally — no further infrastructure changes.

---

## C. What this block does NOT touch

- All 10 Croc/Spark hero **mechanics** preserved verbatim (fire/ULT/race-passives/captain dual/signature combo all functional — just inaccessible via squad-select).
- Phase 5 Block 1/2/3/4 work intact.
- Existing Chapter 1 unlock progression (Boss 1-5 → BOSS_UNLOCKS map) unchanged.
- Fragment-craft system (Phase 0 Block 0.2) unchanged for non-locked heroes.
- BACKLOG-002 captain pick branch unchanged.
- All Phase 1/2/3/4 work intact.

---

## D. Edge cases handled

| Scenario | Behavior |
|---|---|
| Fresh install | All 10 Crocs/Sparks locked from the start; never appear in unlocked roster |
| Existing save with manual Croc/Spark unlock (DevTools) | Migration strips them on first load post Block 5; player sees locked modal next time they tap |
| Existing save with Croc/Spark in active squad | Squad-strip migration removes them; squad rebuilt with starter heroes via `reconcileSquadUnlocks` (existing pattern) |
| Player taps locked Croc → modal shows "Coming in Chapter 2 — defeat VEROTHIRA" | Race-aware messaging, no fragment progress UI, no CLAIM button |
| Player taps locked Spark → modal shows "Coming in Chapter 2 — defeat URSARO" | Same UX pattern |
| Future BOSS_UNLOCKS extension calls `unlockHero('crocodile_warrior')` before lock removed | Returns false + console log "locked behind Chapter 2 — skipped" |
| Phase 5b removes `locked: true` for a Croc | `unlockHero` succeeds normally; storage starts saving the unlock |
| BACKLOG-002 captain pick at FTUE | Unaffected — pirates / rocks not flagged locked, captain pick path intact |
| Migration runs on an already-migrated save | Flag check returns early; no-op |

---

## E. Roman regression checklist

JS syntax verified post-edits via JavaScriptCore — file parses through 16,456+ lines clean.

1. **Fresh install** (`localStorage.clear()` then reload):
   - Squad-select shows 15 unlocked + 10 locked Crocs/Sparks (greyscale)
   - Tap any locked Croc → modal: "MOSSJAW · CROCODILE · GROVE · WARRIOR · Coming in Chapter 2 — defeat VEROTHIRA to unlock the Crocodiles."
   - Tap any locked Spark → modal: "EMBERSPARK · SPARK · SOLAR · WARRIOR · Coming in Chapter 2 — defeat URSARO to unlock the Sparks."
   - No fragment bar, no CLAIM button on Croc/Spark locked modals

2. **Migrated save** (existing playtest with Crocs unlocked from Phase 5 Block 2-4):
   - Console: `[PHASE 5 Migration] stripped N Croc/Spark unlock(s) from storage`
   - Squad-select shows Crocs/Sparks correctly locked
   - Active squad rebuilt with starters if Crocs/Sparks were in squad

3. **DevTools attempt to bypass**:
   - `unlockHero('crocodile_warrior')` → console: "locked behind Chapter 2 — skipped" + returns false
   - `isHeroUnlocked('crocodile_warrior')` → false (even if `hero.unlocked = true` set manually)
   - To dev-bypass for testing: `HERO_ROSTER.find(h => h.id === 'crocodile_warrior').locked = false; unlockHero('crocodile_warrior');`

4. **Boss progression timeline** (linear Chapter 1 unchanged):
   - Pyredrake win → BACKLOG-002 captain pick (5 same-faction unlocks)
   - Tyrant win → 5 OTHER faction unlock + SQUAD_MAX→4
   - Grovewarden win → 2 Sharks unlock
   - Phoenix win → 3 Sharks unlock + SQUAD_MAX→5
   - Crypt Lich win → no new heroes; placeholder for Chapter 1 complete cinematic (Phase 5b)

5. **`__debugHeroes()` console**:
   - `unlocked: [...15 heroes]` (no Croc/Spark)
   - `roster: [..., { id: 'crocodile_warrior', name: 'MOSSJAW', unlocked: false, locked: true }, ...]`

6. **No console errors** through Chapter 1 progression.

---

## F. Spec adherence

| Spec point | Implementation | Status |
|---|---|---|
| Crocs/Sparks gated behind Chapter 2 (Meta-Progression §7) | `locked: true` + Phase 5b unlock dispatcher | ✅ |
| Lock-modal "Coming in Chapter 2" UX | Race-aware message in showLockedHeroModal | ✅ |
| Existing Chapter 1 timeline preserved | BOSS_UNLOCKS map untouched, BACKLOG-002 unchanged | ✅ |
| Migration for existing saves | runMigration_PHASE5_lock_chapter2_heroes (idempotent) | ✅ |
| Defense in depth (multiple guard layers) | `isHeroUnlocked` + `unlockHero` + `loadUnlockedHeroesFromStorage` all check `h.locked` | ✅ |
| Phase 5b extension path documented | BOSS_UNLOCKS extension + `locked: true` removal — no further infra needed | ✅ |

---

## G. Phase 5 progress

- ✅ Block 1 — Earth/Grove infrastructure (`2994f0a`)
- ✅ Block 2 — Crocodile heroes (`a3557ce`)
- ✅ Block 3 — Light/Solar infrastructure (`ab491fa`)
- ✅ Block 4 — Spark heroes (`7386916`)
- ✅ **Block 5 — Hero unlock progression** (this commit)
- ⏳ Block 6 — Phase 5 sign-off + tag `v0.5.0-phase-5-done`

After Block 6 → ship v0.5.0 with all 25 heroes implemented (15 unlockable in Chapter 1, 10 placeholder for Chapter 2).

---

## H. Phase 5b preview (decoupled, separate phase)

Per **D3 + D6** decisions, Chapter 2 ships as separate Phase 5b (~5-6 weeks):

- 5b.1 — Chapter 2 archetype infrastructure (Hypnotist / Engineer / Frenzy / Tempo Disruptor / Battery)
- 5b.2 — 5 Chapter 2 boss data + assets (10 PNGs at `/Users/rm/Downloads/game file/assets/Game bosses/`)
- 5b.3 — Verothira (Hypnotist mechanics)
- 5b.4 — Gearheart (Engineer mechanics)
- 5b.5 — Ursaro (Frenzy mechanics)
- 5b.6 — Tidespire (Tempo Disruptor mechanics)
- 5b.7 — Heliotron (Battery mechanics)
- 5b.8 — World Map cinematic + Chapter 2 transition + Crocs/Sparks unlock re-gate
- 5b.9 — Chapter 2 sign-off + tag `v0.5.5-chapter-2-done`

When Phase 5b ships, this block's `locked: true` flags are removed in Phase 5b.8 and Crocs/Sparks unlock via BOSS_UNLOCKS[6-10] entries on natural Chapter 2 boss progression.

---

## I. Git status

Single Block 5 commit on `phase-2-grammar`. Auto-merged to `main`.
