# Phase 5b Polish — Boss & Race Emblems Wiring

## Scope
Roman commissioned 15 emblems split across two folders:

- `assets/boss emblems/` — 10 unique per-boss emblems (one per archetype)
- `assets/race emblems/` — 5 emblems for the playable races

Two requests:

1. Wire each boss emblem onto its boss's **void cells** (the cubes the boss
   spawns after attacks — same slot used by the first 5 bosses' element
   defaults).
2. Replace the **race-filter chip text** in the Select screen with the
   new race emblems, AND **remove the clockwork chip** entirely
   (clockwork heroes are Phase 2 placeholders — the chip was a dead row).

## Implementation

### 1. ASSETS map (15 new entries)

Inserted into the central `ASSETS` map after the `void_emblem_umbra` anchor.
PNG sources resized to 180×180 (preserving alpha) via `sips`, base64-encoded:

```
boss_emblem_1   → Pyredrake     (dragon)        Boss 1 / Ember
boss_emblem_2   → Abyssal Tyrant (kraken)       Boss 2 / Tide
boss_emblem_3   → Grovewarden   (treant)        Boss 3 / Grove
boss_emblem_4   → Solar Phoenix (phoenix)       Boss 4 / Solar
boss_emblem_5   → Crypt Lich    (lich)          Boss 5 / Umbra
boss_emblem_6   → Verothira     (dark plant)    Boss 6 / Grove (Ch2)
boss_emblem_7   → Gearheart     (earth thrash)  Boss 7 / Umbra (Ch2)
boss_emblem_8   → Ursaro        (fire bear)     Boss 8 / Ember (Ch2)
boss_emblem_9   → Tidespire     (frost element) Boss 9 / Tide (Ch2)
boss_emblem_10  → Heliotron     (light beaver)  Boss 10 / Solar (Ch2)

emblem_race_pirate    → Fire pirate
emblem_race_rock      → Dark rock
emblem_race_shark     → Frost shark
emblem_race_crocodile → Earth croc
emblem_race_spark     → Light spark
```

The race keys deliberately reuse the existing **`emblem_race_<race>`** naming
convention used by `renderRosterFilters()` (line 26330: `` `emblem_race_${r}` ``).
This means the race-filter renderer picks the new commission art up
automatically — no renderer change needed for the race chip switch.

> **Note on duplicates:** the V18.14 placeholder set already shipped
> `emblem_race_pirate` and `emblem_race_rock`. The new entries appear
> *later* in the ASSETS object literal, so JS overwrites the V18.14 art
> with Roman's new commission. `emblem_race_shark/crocodile/spark` are
> brand-new (no prior key) and fill the missing trio.

### 2. `applyBossEmblems()` — boss-specific override

Pre-polish behaviour: void cells used the **element-default** emblem
(`void_emblem_<stihiya>`), so all 5 Grove bosses (Verothira) shared the
same generic Grove void emblem.

New behaviour: when the current boss has a commissioned emblem, override
the element-default for **just that boss's stihiya**. Other elements
keep their defaults.

```js
function applyBossEmblems() {
  ...
  const globalBossNum = (currentChapter - 1) * 5 + currentBossIdx + 1;
  const bossEmblemUrl = ASSETS[`boss_emblem_${globalBossNum}`];
  const bossStihiya   = (currentBoss && currentBoss.stihiya) || null;
  ['ember', 'tide', 'grove', 'solar', 'umbra'].forEach(stihiya => {
    ...
    let voidEmblemUrl = ASSETS[`void_emblem_${stihiya}`];
    if (stihiya === bossStihiya && bossEmblemUrl) {
      voidEmblemUrl = bossEmblemUrl;          // ← per-boss override
    }
    if (voidEmblemUrl) {
      host.style.setProperty(`--void-emblem-${stihiya}`, `url("${voidEmblemUrl}")`);
    }
  });
}
```

Chapter-aware numbering matches the same global index used by
`applyBossDefeatProgression` (`(currentChapter-1)*5 + currentBossIdx + 1`),
so Chapter 1 fights resolve `boss_emblem_1..5` and Chapter 2 resolves
`boss_emblem_6..10`.

### 3. Clockwork removed from race filter

`renderRosterFilters()` builds the race chip set by walking `HERO_ROSTER`
and de-duplicating `h.race`. Clockwork heroes are tagged
`{ id:'clockwork_*', race:'clockwork', locked:true, fireText:'[PHASE 2]' }`
— they're permanent Phase 2 placeholders that can't be squadded.

Patch:

```js
for (const h of HERO_ROSTER) {
-  if (h.race && !races.includes(h.race)) races.push(h.race);
+  if (h.race && h.race !== 'clockwork' && !races.includes(h.race)) races.push(h.race);
   if (h.stihiya && !factions.includes(h.stihiya)) factions.push(h.stihiya);
   if (h.newRole && !roles.includes(h.newRole)) roles.push(h.newRole);
 }
```

The clockwork chip no longer appears. Clockwork heroes themselves remain
visible in the roster (still locked, still gated by Task #1.4
"ARRIVES IN PHASE 2" toast) — they just can't be filtered to.

## Verification

- **JS parse**: full HTML extracted to combined JS (7.46 MB) and run through
  JavaScriptCore. Parse OK — execution proceeds past line 493 and only halts
  on a runtime `console.warn` (JSC has no `console` global), which is a JSC
  environment limitation, not a SyntaxError.
- **ASSETS keys count**: `grep -oE "boss_emblem_[0-9]+:" | sort -u`
  → 10 unique. `grep -oE "emblem_race_[a-z_]+:"` → 13 entries (10 V18.14
  + 5 new, with pirate/rock duplicating — JS object semantics: later wins).
- **No regressions in renderer**: `renderRosterFilters` already supported
  `emblem_race_<race>` keys (V18.14 commit) — the new keys plug into the
  existing image-render branch; the text-fallback branch is untouched.
- **Boss emblem references**: pre-existing code already calls
  `ASSETS[\`boss_emblem_${idx+1}\`]` for the portrait corner badge
  (line 18498), victory modal (line 20208), and progression UI
  (line 15005) — those paths now light up automatically.

## Files changed

- `blocksworn_index_fixed.html`
  - +15 ASSETS entries (~1.23 MB inline)
  - `applyBossEmblems()` — per-boss override branch
  - `renderRosterFilters()` — clockwork excluded from race chip set
- `docs/PHASE_5B_POLISH_EMBLEMS_AUDIT.md` — this file

## Risk

Low. All changes are additive or guarded:

- New ASSETS keys — pure additions.
- `applyBossEmblems` override — only fires when both
  `boss_emblem_${N}` and `currentBoss.stihiya` resolve; otherwise the
  pre-existing default-emblem path runs unchanged.
- Clockwork filter exclusion — single conjunct in the dedup loop;
  faction/role rows untouched; clockwork heroes still listed elsewhere.
