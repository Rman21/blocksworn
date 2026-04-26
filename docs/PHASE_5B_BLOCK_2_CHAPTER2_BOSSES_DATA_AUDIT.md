# PHASE 5b BLOCK 2 — Chapter 2 Boss Data + Assets

**Branch:** `phase-2-grammar`
**Spec:** [BLOCKSWORN_BOSS_COMPENDIUM.md](../BLOCKSWORN_BOSS_COMPENDIUM.md) §6-10 Chapter 2 boss specs · [BLOCKSWORN_META_PROGRESSION.md](../BLOCKSWORN_META_PROGRESSION.md) §5 Chapter 2 progression
**Predecessor:** Phase 5b Block 1 (archetype infrastructure) — `95bc783`
**Date:** 2026-04-26

---

## A. Spec recap

Per Boss Compendium §6-10 — Chapter 2 introduces 5 NEW bosses each tied to a Chapter 2 archetype (Phase 5b Block 1 infrastructure).

| # | Boss | Element | Archetype | HP est | atkInterval |
|---|---|---|---|---|---|
| 6 | VEROTHIRA | umbra | hypnotist | 14500 | 6 |
| 7 | GEARHEART | grove | engineer | 16000 | 6 |
| 8 | URSARO | ember | frenzy | 15000 | 5 |
| 9 | TIDESPIRE | tide | tempo_disruptor | 17000 | 5 |
| 10 | HELIOTRON | solar | battery | 19000 | 5 |

This block ships **data + assets only**. Specific mechanic logic ships in Phase 5b.3-5b.7 (per-boss blocks). Chapter 2 is NOT yet accessible via UI — `BOSSES = CHAPTERS[0].bosses` still points to Chapter 1; Phase 5b.8 (World Map cinematic) will add the navigation path.

---

## B. Implementation

### B.1 Asset conversion

Source: `/Users/rm/Downloads/game file/assets/Game bosses/{name}.png`
- 5 PNGs at native 1086×1448 (3:4 portrait)
- Resampled via `sips` to 512×683 JPEG q80 (preserves aspect, ~150KB each)

| Boss key | Source PNG | base64 size |
|---|---|---|
| `Boss_6` | dark plant boss.png | 199,295 bytes |
| `Boss_7` | earth trash boss.png | 179,687 bytes |
| `Boss_8` | fire bear boss.png | 201,887 bytes |
| `Boss_9` | frost wave boss.png | 244,983 bytes |
| `Boss_10` | light beaver boss.png | 236,035 bytes |

**Total Chapter 2 boss asset payload: ~1.06 MB.** File grew 5.43MB → 6.50MB.

> Note: Existing Boss_1-Boss_5 are overridden by an `Object.assign` "Arena Premium" block at line ~9036 with commissioned art. My new Boss_6-Boss_10 entries in the original ASSETS map are NOT overridden (no Boss_6-10 keys in Object.assign), so they load directly. Architecture verified ✅.

### B.2 CHAPTERS array extension

Added Chapter 2 entry after existing Chapter 1:

```js
{
  id: 2,
  name: 'BLOOM OF MADNESS',
  bosses: [
    { name: 'VEROTHIRA',  title: 'Lvl 6 · Hungering Bloom',  hp: 14500, attackInterval: 6, img: 'Boss_6',  color: '#9B59D6', stihiya: 'umbra', archetype: 'hypnotist'       },
    { name: 'GEARHEART',  title: 'Lvl 7 · Rusted Colossus',  hp: 16000, attackInterval: 6, img: 'Boss_7',  color: '#B87333', stihiya: 'grove', archetype: 'engineer'        },
    { name: 'URSARO',     title: 'Lvl 8 · Magma Bear',       hp: 15000, attackInterval: 5, img: 'Boss_8',  color: '#FF6E28', stihiya: 'ember', archetype: 'frenzy'          },
    { name: 'TIDESPIRE',  title: 'Lvl 9 · Drowned Howl',     hp: 17000, attackInterval: 5, img: 'Boss_9',  color: '#78C8FF', stihiya: 'tide',  archetype: 'tempo_disruptor' },
    { name: 'HELIOTRON',  title: 'Lvl 10 · Solar Sovereign', hp: 19000, attackInterval: 5, img: 'Boss_10', color: '#FFD75A', stihiya: 'solar', archetype: 'battery'         },
  ]
}
```

HP / attackInterval per Compendium first-pass; balance pass on Phase 5b.9 sign-off. Color codes match archetype CSS aura tones from Block 1.

### B.3 BOSS_VOICES extension — 15 new voice lines

3 lines per boss (intro / midfight / death) per Compendium tone notes:

```js
VEROTHIRA:  { intro: 'Welcome, little spark...', midfight: 'Your heart races...', death: '...we... we were... so... close...' },
GEARHEART:  { intro: 'DIRECTIVE... ACTIVE...',    midfight: 'FUEL... LOW...',     death: 'DIRECTIVE... FAILED...' },
URSARO:     { intro: 'Hungry... hungry...',       midfight: 'You wound. I HUNGER.', death: '...always... hungry...' },
TIDESPIRE:  { intro: 'One drop... then ten...',   midfight: 'Resist. We have heard...', death: '...soft... silent...' },
HELIOTRON:  { intro: "I am the sun's last echo.", midfight: 'This is what your ancestors built.', death: 'I... served... well...' },
```

Tone identity per Compendium:
- **Verothira** — overlapping plural voices, seductive
- **Gearheart** — mechanical fragments with static
- **Ursaro** — animalistic growls, short phrases
- **Tidespire** — drowning chorus, inevitable
- **Heliotron** — formal sovereign, sad-but-confident

Existing `_bossVoiceTrigger(slot)` dispatcher auto-wires these via `BOSS_VOICES[currentBoss.name]` lookup — no further dispatcher changes needed.

### B.4 Architecture: Block 2 is purely additive

- `BOSSES = CHAPTERS[0].bosses` still points to Chapter 1.
- Chapter 2 inaccessible via existing UI (no chapter-switch nav yet — Phase 5b.8 adds World Map).
- DevTools dry-run path:
  ```js
  setChapter(2); currentBossIdx = 0; startBossBattle();
  // → Verothira fight starts; archetype 'hypnotist' aura active;
  //   tickChapter2Archetype() drives suggestion/petal/tendril counters
  ```

This means Block 2 ships data WITHOUT exposing it to player flow. Per-boss blocks 5b.3-5b.7 add boss-specific mechanics + Crocs/Sparks unlock per `BOSS_UNLOCKS[6-10]` (currently empty / not yet defined). Block 5b.8 wires player-facing UI.

---

## C. What this block does NOT touch

- Phase 1/2/3/4/5 + Phase 5b Block 1 work intact.
- Existing Chapter 1 progression (5 bosses, 15 unlocked heroes timeline) unchanged.
- Crocs/Sparks `locked: true` flags preserved (Block 5b.3-5b.7 will remove per-boss).
- BOSS_UNLOCKS map for Chapter 2 not yet extended (per-boss blocks add 6-10 entries).
- No per-boss specific mechanic logic (per-boss blocks 5b.3-5b.7).
- No Chapter 2 navigation UI / cinematic (Block 5b.8).
- Existing voice line dispatcher unchanged — auto-handles new Chapter 2 BOSS_VOICES entries.

---

## D. Edge cases handled

| Scenario | Behavior |
|---|---|
| Existing CHAPTERS[0] (Chapter 1) play unchanged | `BOSSES = CHAPTERS[0].bosses` default; players never reach Chapter 2 from current UI |
| DevTools `setChapter(2)` to test Chapter 2 boss | BOSSES rebound to CHAPTERS[1].bosses; `startBossBattle` runs Chapter 2 boss with archetype mechanics from Block 1 (currently scaffolded; full mechanics in 5b.3-5b.7) |
| Chapter 2 boss launched without per-boss block done | tickChapter2Archetype dispatcher fires; counters tick + flashText emits; no specific cell-conversion / hero-coil / charge-meter UI yet — all "infrastructure-only" effects |
| Boss voice lookup for Chapter 2 boss | `BOSS_VOICES[currentBoss.name]` returns the new entry; `_bossVoiceTrigger` fires 3 lines (intro/mid/death) at standard cues |
| Boss portrait load | `ASSETS[currentBoss.img]` resolves Boss_6-Boss_10 to inline base64 JPEG; no network fetch, no broken-image fallback |

---

## E. Roman regression checklist

JS syntax verified post-edits via JavaScriptCore — file parses through 16,906+ lines clean.

1. **Existing Chapter 1 progression unaffected**:
   - All 5 Chapter 1 bosses play unchanged (Pyredrake → Crypt Lich)
   - Voice lines fire at standard cues for existing bosses
   - SQUAD_MAX progression 3 → 4 → 5 unchanged
   - Crocs/Sparks remain locked (Block 5 verified)

2. **DevTools Chapter 2 dry-run** (manual access — Phase 5b.8 adds player path):
   ```js
   setChapter(2);
   currentBossIdx = 0;  // VEROTHIRA
   startBossBattle();
   // → boss portrait shows dark_plant art, archetype: 'hypnotist'
   //   bossImgWrap gets .boss-archetype-hypnotist class (purple shimmer)
   //   _bossVoiceTrigger('intro') fires "Welcome, little spark..." 1.5s after start
   //   __debugChapter2Archetype() shows hypnotist counters ticking
   ```

3. **All 5 Chapter 2 bosses load correctly**:
   ```js
   for (let i = 0; i < 5; i++) {
     setChapter(2); currentBossIdx = i; startBossBattle();
     // each boss → correct portrait + archetype aura + voice intro
   }
   ```

4. **Voice line lookup**:
   - `BOSS_VOICES.VEROTHIRA` → 3 lines
   - `BOSS_VOICES.HELIOTRON` → 3 lines
   - All 5 Chapter 2 boss names mapped

5. **CHAPTERS array integrity**:
   - `CHAPTERS.length === 2`
   - `CHAPTERS[0].bosses.length === 5` (Chapter 1)
   - `CHAPTERS[1].bosses.length === 5` (Chapter 2)
   - `CHAPTERS[0].id === 1`, `CHAPTERS[1].id === 2`

6. **No console errors** through full Chapter 1 + Chapter 2 dry-run.

---

## F. Spec adherence

| Spec point (Compendium §6-10 + Meta §5) | Implementation | Status |
|---|---|---|
| 5 Chapter 2 bosses with names + titles | CHAPTERS[1].bosses 5 entries | ✅ |
| HP estimates per Compendium | 14500 / 16000 / 15000 / 17000 / 19000 | ✅ |
| Attack interval per Compendium first-pass | 6 / 6 / 5 / 5 / 5 | ✅ |
| Element + archetype pairing per Compendium | umbra/hypnotist · grove/engineer · ember/frenzy · tide/tempo_disruptor · solar/battery | ✅ |
| Boss portraits inlined as base64 | 5 entries Boss_6-Boss_10 in ASSETS | ✅ |
| 15 voice lines (3 per boss) | BOSS_VOICES extended with 5 entries | ✅ |
| Tone identity per Compendium per boss | Verothira plural / Gearheart mechanical / Ursaro animal / Tidespire chorus / Heliotron sovereign | ✅ |
| Chapter 2 inaccessible via player UI in Block 2 | BOSSES still = CHAPTERS[0]; Phase 5b.8 adds nav | ✅ (per design) |

---

## G. Phase 5b progress

- ✅ Block 1 — Chapter 2 archetype infrastructure (`95bc783`)
- ✅ **Block 2 — Chapter 2 boss data + assets** (this commit)
- ⏳ Block 3 — VEROTHIRA (Hypnotist mechanics) + unlock 2 Crocs
- ⏳ Block 4 — GEARHEART (Engineer mechanics) + unlock 3 Crocs
- ⏳ Block 5 — URSARO (Frenzy mechanics) + unlock 2 Sparks
- ⏳ Block 6 — TIDESPIRE (Tempo Disruptor mechanics) + unlock 3 Sparks
- ⏳ Block 7 — HELIOTRON (Battery mechanics) + Chapter 2 finale
- ⏳ Block 8 — World Map cinematic + Chapter 2 transition + UI access
- ⏳ Block 9 — Phase 5b sign-off + tag `v0.5.5-chapter-2-done`

---

## H. Git status

Single Block 2 commit on `phase-2-grammar`. Auto-merged to `main`.
