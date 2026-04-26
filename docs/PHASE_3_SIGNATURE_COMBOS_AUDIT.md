# PHASE 3 BLOCK 1 — SIGNATURE COMBOS

**Branch:** `phase-2-grammar` (continued — Phase 3 work shipped on the same branch since Phase 2 closure was just a tag)
**Spec:** [HERO_GRAMMAR.md](HERO_GRAMMAR.md) §7 (Signature Combos forward declaration) · MASTER_PLAN_V3 §7 (Phase 3 — The Moment Mechanics)
**Predecessor:** Phase 2 closed at tag `v0.2.0-phase-2-done`
**Date:** 2026-04-26

---

## A. Spec recap

Per HERO_GRAMMAR §7 — three tiers of signature combos:

| Tier | Trigger | Visual | Bonus |
|---|---|---|---|
| **1 — Same-Race** | 3+ heroes of same race in squad | race-flavor cinematic | small (+10%) |
| **2 — Same-Element** | 3+ same element from mixed races | element burst cinematic | medium (+20%) |
| **3 — Full Combo** | 3+ same race AND same element | full named cinematic | large (+30%) |

### v1 named Tier 3 combos (frozen mapping)

| Race × Element | Name |
|---|---|
| Pirates × Ember | **THE GOLDEN HOARD** |
| Rock Band × Umbra | **THE DARK ENCORE** |
| Sharks × Tide | **THE FROST DEEP** |
| Crocodiles × Grove | reserved Phase 5 |
| Sparks × Solar | reserved Phase 5 |

### v1 trigger reality

Since v1 races are mono-element (Pirates=Fire, Rock=Dark, Sharks=Frost), 3+ of any race AUTOMATICALLY satisfies 3+ of that element → only Tier 3 typically fires. Tier 1 (Same-Race generic) and Tier 2 (Same-Element only, mixed-race) are forward-compat for Phase 5 when Crocodiles/Sparks add mixed-race possibilities.

---

## B. Implementation

### B.1 Data model

```js
const SIGNATURE_COMBOS = {
  'pirate_ember': { name: 'THE GOLDEN HOARD', race: 'pirate', stihiya: 'ember', tier: 3, mult: 1.30, color: '#FFB84A' },
  'rock_umbra':   { name: 'THE DARK ENCORE',  race: 'rock',   stihiya: 'umbra', tier: 3, mult: 1.30, color: '#9B59D6' },
  'shark_tide':   { name: 'THE FROST DEEP',   race: 'shark',  stihiya: 'tide',  tier: 3, mult: 1.30, color: '#3B8BD4' },
};
const SIGNATURE_TIER_BONUS = { 1: 1.10, 2: 1.20, 3: 1.30 };
```

Bonus magnitudes: small/medium/large = 10/20/30% per spec wording. All tiers are **passive damage multipliers** applied to ALL squad heroes (not race-scoped — that's the captain dual buff layer).

### B.2 New state

```js
let activeSignatureCombo   = null;       // { name, race, stihiya, tier, mult, color }
let _signatureComboContext = 1;          // mult fed into dealDamage stack
let _signatureComboCinemaShown = false;  // per-battle one-shot for the cinematic
```

### B.3 Detector — inside `calcSynergyState`

Walks `state.raceCount`. For each race with count ≥ 3:
1. Find the dominant element among heroes of that race.
2. If `SIGNATURE_COMBOS[race + '_' + element]` exists AND element count ≥ 3 → Tier 3 (Full Combo).
3. Else → Tier 1 (Same-Race generic, no named cinematic).

Fallback: if no race triggered, walk `state.stihiyaCount`. If any element ≥ 3 → Tier 2 (Same-Element generic, mixed race).

Sets `state.activeSignatureCombo` to the found combo or `null`. Pushes a `🌟 NAME +X%` pill to `state.active` for the synergy bar.

### B.4 Mirror to global

In `computeSynergies` (right after the captain-dual mirror block):
```js
activeSignatureCombo = state.activeSignatureCombo || null;
```

### B.5 Multiplier in `dealDamage`

```js
_signatureComboContext = (activeSignatureCombo && activeSignatureCombo.mult) || 1;
const _multStack = currentDmgMult * _passiveDmgContext * _ultDmgContext
                 * _warbandStrikeContext * _hunterMarkContext
                 * _grommarRallyContext * _packMarkContext * _helioRoarContext
                 * _captainDualContext * _signatureComboContext;
```

Subject to existing `FIRE_MULT_CAP = 3.0` clamp. So a Pirates-only squad with active GOLDEN HOARD (1.30×) + active CRIMSON dual buff at 3+ pirates (1.30×) = 1.69× combined, well under the cap.

### B.6 Cinematic overlay

DOM element `#sigComboCinema` (full-screen, z-index 9999, hidden by default):
- `.sig-cinema-bg` — radial gradient with `--sig-color` tint over 55% black
- `.sig-cinema-card` — bordered box with combo's color glow
- `.sig-cinema-emblem` — 80×80 image using new `emblem_*_v2` assets (commissioned art from `/assets/elements emblems/`)
- `.sig-cinema-tier` — small caps "SIGNATURE COMBO" / "ELEMENT BURST" / "RACE SIGNATURE"
- `.sig-cinema-name` — 32px gradient gold text, the combo name
- `.sig-cinema-bonus` — 16px "+30% DAMAGE"

Animation: 2.2s sequence — card scale-bounce in (0% → 18% peak → 30% settle → 72% hold → 100% fade).

Trigger: `showSignatureComboCinematic(combo)` called from `maybeFireSignatureComboCinematic()`, which is called from `startBossBattle` 600ms after battle init (lets squad-pop animations settle).

Reduced-motion fallback: `prefers-reduced-motion: reduce` swaps the bounce animation for a 1.6s linear fade.

### B.7 Synergy bar pill

New `.syn-pill.signature` style — gradient gold background, `--a-gold-100` border + text, animated glow (`sigPillGlow` 2.4s pulse). Reduced-motion disables animation. Most prominent pill style after captain (visually higher impact than race/formation).

`renderSynergyBar` regex `/^🌟 /` detects signature pills, applies the `signature` class. Signature + captain pills bypass the `_emblematizeSynergy` text-replacement (already concise).

---

## C. What this commit does NOT touch

- Phase 2 work — all heroes / blocks / hotfixes intact.
- Captain dual buff system — independent multiplier layer (race-scoped); signature combo is squad-wide.
- Per-hero charges, per-role ULT cost, hero unlock progression, voice triggers, archetype activation — all preserved.
- Element gating, encore stacks, frost chains, EMBERHAND ignite, Hunter universal detonate — all preserved.

---

## D. Roman regression checklist

JS syntax verified post-edits via JavaScriptCore (~4.44MB parses clean).

1. **Squad: 3 Pirates** (e.g. THORGAR + EMBERHAND + CRIMSON) → enter any boss fight:
   - Console can verify: `console.log(activeSignatureCombo)` → `{ name: 'THE GOLDEN HOARD', tier: 3, mult: 1.30 }`.
   - 600ms after battle starts: cinematic overlay appears with `THE GOLDEN HOARD` in gold, fire emblem, `+30% DAMAGE`. Auto-dismiss in 2.3s.
   - Synergy bar shows `🌟 THE GOLDEN HOARD +30%` pill (gold gradient, animated glow).
   - All damage dealt by squad heroes shows ~30% higher numbers vs squad without combo.

2. **Squad: 3 Rock Band** (RIFFBLADE + KEYCRYPT + NIGHTLORD or similar 3+) → enter fight:
   - Cinematic: `THE DARK ENCORE` in purple, dark emblem.
   - Pill: `🌟 THE DARK ENCORE +30%`.

3. **Squad: 3 Sharks** (RIMEFANG + CRYOMIND + ABYSSKING or similar 3+) → enter fight:
   - Cinematic: `THE FROST DEEP` in blue, water emblem.
   - Pill: `🌟 THE FROST DEEP +30%`.

4. **Squad: 2 Pirates + 2 Rock** (or any composition without 3+ of same race):
   - No cinematic.
   - No 🌟 pill.
   - Console: `activeSignatureCombo` is `null`.
   - Damage at baseline (no signature mult applied).

5. **FTUE Pyredrake fight** (with starter squad — currently mono-pirate trio) → cinematic SKIPPED:
   - `_isFtueOnly` flag prevents cinematic firing during FTUE (matches voice-line behavior).
   - Pill MAY still show if 3+ pirates in starter squad — pill is detection-based, not battle-context-gated.

6. **Reduced motion enabled** (system preference): cinematic fades in/out without scale bounce; synergy pill no animated glow.

7. **No console errors** through full Chapter 1 run with various squads.

---

## E. Spec adherence

| Spec point | Implementation | Status |
|---|---|---|
| Tier 1 / 2 / 3 trigger conditions | `detectSignatureCombo` walks raceCount → stihiyaCount fallback | ✅ |
| Bonus magnitudes (small/medium/large) | `SIGNATURE_TIER_BONUS = { 1: 1.10, 2: 1.20, 3: 1.30 }` | ✅ |
| Named combos for v1 | 3 entries in `SIGNATURE_COMBOS` map (GOLDEN HOARD / DARK ENCORE / FROST DEEP) | ✅ |
| Phase 5 reservations | Comments in `SIGNATURE_COMBOS` map note crocodile_grove + spark_solar reserved | ✅ |
| Cinematic on activation | `showSignatureComboCinematic` triggered from `startBossBattle` | ✅ |
| Race-passive cap ≤ 30% | Tier 3 = 30% (matches HERO_GRAMMAR §5 race-passive cap) | ✅ |
| Reduced-motion compliance | `@media prefers-reduced-motion: reduce` for cinematic + pill | ✅ |
| Subject to FIRE_MULT_CAP | `_signatureComboContext` joins existing mult stack, capped at 3.0 | ✅ |

---

## F. Deferred for future Phase 3 blocks

Per master plan §7 Phase 3 has 3 mechanics; this Block 1 ships Signature Combos. Remaining:

- **Phase 3 Block 2** — Clutch Slow-Mo (1 HP + boss attack incoming → time slows)
- **Phase 3 Block 3** — Death Flashback (on player defeat → recap of key moments)

Both reuse infrastructure shipped here (cinematic overlay system, dialog queue from #2.2b, archetype CSS framework). Estimate 1 block each.

---

## G. Git status

Single commit on `phase-2-grammar` branch (kept active for Phase 3 work since Phase 2 closure was a tag, not a branch retire). Auto-merged to `main` per Roman standing instruction.

Phase 3 progression toward an eventual `v0.3.0-phase-3-done` tag after Block 3 completes.
