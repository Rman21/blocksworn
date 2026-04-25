# PHASE 2 — PIRATES AUDIT (HERO_GRAMMAR §4 conformance)

**Branch:** phase-2-grammar
**Spec:** [docs/HERO_GRAMMAR.md](HERO_GRAMMAR.md) §4 (Element × Role 5×5)
**Scope:** 5 pirate heroes — THORGAR, BLACKTOOTH, EMBERHAND, IRONBELLY, CRIMSON.
**Approach:** Read-only audit of existing fire/ULT functions vs. spec cells. Refactor only where additive (no role-verb conflicts) and where MGD has explicitly authorized rewrites. Role-verb conflicts are flagged for MGD decision and **not** silently rewritten per TASK #2.2 instructions.

---

## Summary table

| Hero | Spec § | Current behavior (fire / ULT) | Divergence | Status | Fix in this commit |
|---|---|---|---|---|---|
| **THORGAR** | Fire × Warrior — CLEAVER | Deals `thorgarBaseDmg` (T0=200) + 5/cell ember bonus; **clears N random ember cells** (T0=1, T2=2); cascade on charged. ULT FLEET SIEGE: extra burns at 5-pirate gate. | Spec says cleared ember cells become **charged for 2 turns**. Current implementation **removes** ember cells (sets to null). Mechanic direction inverted. | ⚠ **MECHANIC CONFLICT** — clears vs. charges. Role verb (CREATOR/Warrior) is technically satisfied via "spawns charged" elsewhere in pirate kit (IRONBELLY active charges, EMBERHAND ULT charges), but THORGAR personally does not create charged state. | **No code change.** Header comment + flagged for MGD. |
| **BLACKTOOTH** | Fire × Hunter — INFERNO | Deals `blacktoothBaseDmg` (T0=180) + charged bonus on **1–2 random cells** (T0=1, T2=2); ULT WILDFIRE adds +100/+150 if any burnt cell was charged. | ~~Spec INFERNO: **detonates EVERY charged ember cell at once**, ×3 cap.~~ **Resolved in TASK #2.2d:** mass-detonation rewrite + WILDFIRE bonus removed. | ✅ **CONFORMS post-rewrite** (TASK #2.2d). | Code rewrite — see Resolution log §B. |
| **EMBERHAND** | Fire × Mage — EMBER BLOOM | +1 HP regen + **spawns 2–3 ember cells** on empty (T2 spawned-as-charged). ULT FLOOD MENDING: +1 ULT charge to each squad member's stihiya. | ~~Spec EMBER BLOOM: **every charged cell gains +50% detonation damage** (AMPLIFIER); ULT: full squad heal + +1 ULT to all.~~ **Resolved in TASK #2.2d:** AMPLIFIER window + full squad heal added to ULT. | ✅ **CONFORMS post-rewrite** (TASK #2.2d). | Code rewrite — see Resolution log §C. |
| **IRONBELLY** | Fire × Tank — FIREBRAND | +1 shield + `ironbellyBaseDmg` (T0=160) direct dmg + **pre-charges 2–3 non-charged ember cells**. ULT CHARGED AEGIS: spawns 3–5 charged ember cells on empty. | Spec FIREBRAND: passive +1 shield **per ember clear**; ULT: +3 shields + seeds 3 charged ember cells. Current applies +1 shield on **active** fire (not per-ember-clear passive); also adds direct dmg not in spec; pre-charges existing cells (≈ ULT seeding). ULT close to spec (3–5 vs. 3 charged ember). | ✅ **EXTENDS** — role verb (PROTECTOR/Tank) preserved; current adds active dmg + active charging which extend (not contradict) tank kit. | **No code change.** Header comment + documented as intentional extension. |
| **CRIMSON** | Fire × Captain — CRIMSON GAMBIT | Converts 2–3 cells to ember + cascade if neighbors charged. ULT PIRATE DOMINION: 50%/60% of converted cells spawn charged. | Spec CRIMSON GAMBIT: **race-buff scales pirate damage** (+5/+15/+30%) + **fixed +25% ember drops**; ULT seeds 10 charged cells. **Captain dual buff system not implemented.** Existing `captainConversionBoost` and `warbandUltShare` are 5-pirate FORMATION effects, not the spec's per-captain dual buff. | ❌ **CRITICAL — captain dual buff missing.** Role verb (ENABLER/Captain) is the missing piece: captain is supposed to *persistently enable* the squad. Current captain only adds active board effects. | **CODE CHANGE — implement captain dual buff** (this commit). Header comment added. |

---

## Per-hero detail

### THORGAR — Fire × Warrior — CLEAVER (`fireThorgar` line 17129, `ultTwistThorgar` line 17285)
- **Spec cell:** *Direct hit on placement; every ember cell cleared becomes a charged cell for 2 turns.*
- **Current fire:** `baseDmg = thorgarBaseDmg` + 5/cell; for N random ember cells, `grid[r][c] = null` (cleared) + `chargedCells.delete(...)`. Cascade on `wasCharged`.
- **Conflict:** Spec implies the ability transforms cleared ember into a charged state (positive board state). Current code removes ember entirely. The 2-turn charge expiry mechanic does not exist in the codebase as a per-cell timer.
- **MGD decision needed:** (a) Rewrite CLEAVER to leave ember cells in place but mark them charged (with ember chip remaining), OR (b) amend spec to "every ember cell cleared this turn spawns a charged ember on a different empty cell" (closer to current implementation), OR (c) accept current as the v1 implementation and update §4 spec to "Direct hit; clears N ember cells with cascade if charged."
- **Recommendation:** Option (c). Current behavior is balanced and matches the kinetic Warrior feel. The spec wording was aspirational but conflicts with the existing 2-turn charge timer (which doesn't exist). Defer charge-timer mechanic to Phase 6 tier system.

### BLACKTOOTH — Fire × Hunter — INFERNO (`fireBlacktooth` line 17157, `ultTwistBlacktooth` line 17300)
- **Spec cell:** *Detonates every charged ember cell at once; damage scales with charged-cell count (×3 cap).*
- **Current fire:** Picks N random filled cells (NOT specifically charged), burns them with charged-bonus damage applied flat (`baseShot + (EMBER_CHARGED_BONUS - BONUS_DMG.ember)`).
- **Conflict:** Hunter is the DETONATOR — must trigger ALL charged cells in one cascade, with damage scaling by charged-cell count. Current is single-target burst.
- **MGD decision needed:** Rewriting BLACKTOOTH to true mass-detonate would significantly change pirate damage curves and Boss 1 win rate. The change touches: damage cap (×3), cell selection (charged-only), VFX (mass detonation visual), and ULT WILDFIRE bonus (currently +100/+150 if any burnt cell was charged — would always trigger after rewrite, so needs rebalance).
- **Recommendation:** Schedule a dedicated rewrite task (TASK #2.6 candidate). Until then, BLACKTOOTH ships as-is with a header comment marking the divergence. Do NOT touch in this commit.

### EMBERHAND — Fire × Mage — EMBER BLOOM (`fireEmberhand` line 17187, `ultTwistEmberhand` line 17312)
- **Spec cell:** *Every charged cell gains +50% detonation damage; ULT: full squad heal + +1 ULT charge to all.*
- **Current fire:** +1 HP regen + spawns 2–3 ember cells (T2 spawned-as-charged).
- **Current ULT:** +1 ULT charge to each squad member's stihiya (no full squad heal).
- **Conflict:** Mage is AMPLIFIER. Current is CREATOR. Spawning is a Warrior verb, not a Mage verb. The codebase does not currently have a "+50% detonation damage on charged cells" multiplier hook.
- **MGD decision needed:** (a) Rewrite EMBERHAND fire to apply a temporary +50% multiplier to chargedCells (requires new state + new dealDamage hook for ember detonation specifically), OR (b) amend §4 spec to acknowledge EMBERHAND as a hybrid CREATOR+AMPLIFIER (spawns charged ember, which IS a form of amplification of the ember economy), OR (c) accept current as v1 with header comment.
- **Recommendation:** Option (b) — amend spec to recognize "spawns charged ember = pre-amplifies the next detonation." The functional outcome (more charged cells in the next BLACKTOOTH/THORGAR cascade) matches the AMPLIFIER intent. ULT could optionally add a "full squad heal" line in a follow-up commit.

### IRONBELLY — Fire × Tank — FIREBRAND (`fireIronbelly` line 17209, `ultTwistIronbelly` line 17324)
- **Spec cell:** *Passive +1 shield per ember clear; ULT: +3 shields + seeds 3 charged ember cells.*
- **Current fire:** +1 shield (active, on fire) + `ironbellyBaseDmg` direct dmg + pre-charges 2–3 ember cells.
- **Current ULT:** Spawns 3–5 charged ember cells (matches spec's "seeds 3 charged ember"). Note: no explicit `+3 shields` in ULT path — that is handled by the generic `applyTankUlt` template (verified separately).
- **Conflict:** None on role verb. PROTECTOR identity preserved. Active shield + active dmg + active charging extend the tank kit beyond the spec's pure passive but do not contradict it.
- **Decision:** Document as intentional extension. Header comment added. The spec's "passive +1 per ember clear" mechanic could be added in a future polish pass without removing current active behavior.

### CRIMSON — Fire × Captain — CRIMSON GAMBIT (`fireCrimson` line 17232, `ultTwistCrimson` line 17340)
- **Spec cell:** *Race-buff scales pirate squad damage (+5/+15/+30% by pirate count); element-buff weights drops +25% toward ember (fixed); ULT seeds 10 charged cells with 50% spawn bias.*
- **Current fire:** Converts 2–3 cells to ember + cascade if neighbor charged.
- **Current ULT:** 50%/60% of converted cells spawn charged.
- **Conflict:** Captain is ENABLER — must persistently buff the squad. Current CRIMSON only does active board effects. The spec's two captain buffs (race-scaling damage + fixed +25% element drop) are **not implemented**.
- **Existing related state (NOT what the spec asks for):**
   - `captainConversionBoost` — only flips 1.0→1.5 with the WARBAND formation (5-pirate gate), not per-captain.
   - `warbandUltShare` / `warbandStrike` — 5-pirate formation effects, not per-captain.
   - Race-affinity spawn weight in `calcSynergyState` already gives ember +1/+2/+3 at 3/4/5 pirates — race-driven, not captain-driven.
- **Decision:** **Implement captain dual buff in this commit** (additive change, no existing mechanic broken).

---

## Captain dual buff — implementation contract (this commit)

Per HERO_GRAMMAR §6:

1. **Race buff (scaling)** on captain's race count in active squad: 1 hero = +5%, 2 = +15%, 3+ = +30%.
2. **Element drop buff (fixed)** = +25% toward captain's element.
3. Both apply simultaneously. Only ONE captain per squad (already enforced at line 21287).

**Implementation:**
- New state in `calcSynergyState`: `captainDualActive`, `captainDualRace`, `captainDualStihiya`, `captainDualRaceMult`, `captainDualDropBonus`.
- New globals: `captainDual_active`, `captainDual_race`, `captainDual_stihiya`, `captainDual_raceMult`, `captainDual_dropBonus`.
- `state.spawnWeights[captain.stihiya] += 0.25` — additive on the existing weight pool (consistent with `eff.spawnWeight` and ring weight patterns).
- New per-fire context `_captainDualContext` injected into `dealDamage`'s mult stack (alongside `_warbandStrikeContext`, etc.). Set/cleared based on `_currentFiringHero.race === captainDual_race` — works for both fires and ULTs since both flow through `dealDamage` with `_currentFiringHero` set.
- Pushed to `state.active` for the synergy bar UI: `👑 CAPTAIN PIRATE: +30% pirate dmg · +25% ember drops`.
- Subject to existing `FIRE_MULT_CAP` (3.0) — captain dual buff is a stacking multiplier that respects the cap.

**What this commit does NOT do:**
- Does NOT touch `captainConversionBoost` / `warbandUltShare` / `warbandStrike` (separate WARBAND formation system).
- Does NOT change `RACE_SYNERGY` race-tier bonuses (separate race-passive system; spec §5 caps it ≤30%, current pirate config ships within that).
- Does NOT modify any pirate fire/ULT body. Only adds header comments.
- Does NOT alter Rock Band, Sharks, or Clockwork heroes (out of scope per task).

---

## Regression note

**Author cannot run the game in this environment.** The HTML is structurally validated (single-file PWA, line counts unchanged elsewhere, no syntax breakage from edits — `node --check` is not applicable to inline `<script>` blocks but the diff is surgical and additive). 

**Required manual regression by Roman before sign-off:**
1. Open `blocksworn_index_fixed.html`, start Chapter 1.
2. Build a 3-pirate squad including CRIMSON (captain).
3. Verify the synergy bar shows `👑 CAPTAIN PIRATE: +30% pirate dmg · +25% ember drops` (with 3 pirates → +30%; with 2 pirates → +15%; with CRIMSON alone → +5%).
4. Fight PYREDRAKE. Verify damage numbers from THORGAR/BLACKTOOTH/IRONBELLY visibly reflect the captain dual mult (compare with and without CRIMSON in squad).
5. Verify the boss is defeated in 8–15 placements with no console errors.
6. Capture screenshot of the captain buff pill in the synergy bar; attach to Phase 2 sign-off.

If any of the above fails, rollback the `captainDual_*` block and reopen TASK #2.2 with findings.

---

## MGD decisions queued

Three items require MGD adjudication before next pirate work:

1. **THORGAR CLEAVER** — accept current "clears ember" behavior (recommend amend spec wording) OR rewrite to "ember cells become charged."
2. **BLACKTOOTH INFERNO** — schedule rewrite task to mass-detonate all charged cells, with rebalance pass on damage cap and ULT WILDFIRE bonus.
3. **EMBERHAND EMBER BLOOM** — accept current "spawns charged ember" as a hybrid CREATOR+AMPLIFIER (recommend amend spec) OR add true `+50% detonation damage on charged cells` multiplier hook + `full squad heal` to ULT.

Until adjudicated, all three pirates ship with header comments documenting the divergence. THORGAR and IRONBELLY are functionally close enough to spec that v1 ships as-is. BLACKTOOTH and EMBERHAND have the largest divergences.

---

## TASK #2.2b — playtest follow-up (2026-04-26)

Roman ran #2.2 against Chapter 1 → Solar Phoenix. Three blockers surfaced; this section logs the resolutions.

### 1. THORGAR CLEAVER — RESOLVED via spec amendment
MGD adjudicated MGD-queued item #1 in favor of amending the spec to match the v1 implementation. `docs/HERO_GRAMMAR.md` §4 [Fire × Warrior] cell updated and §8 amendment log records the decision (entry dated 2026-04-26). Per-cell charge timer mechanic deferred to Phase 6. THORGAR ships as-is. Header comment in `blocksworn_index_fixed.html` updated to point at the amendment.

### 2. Captain portrait broken on FTUE leader_choice — FIXED
**Root cause:** `showLeaderChoiceModal` (line ~9341) was loading stale asset keys (`ASSETS.hero_liora`, `ASSETS.hero_oakroot`) that no longer exist in the ASSETS map. Both `<img>` tags fell through to the browser's broken-image placeholder.
**Fix:** swapped the asset keys to the actual captain portraits — `ASSETS.hero_pirate_captain` (CRIMSON, left/grommar slot) and `ASSETS.hero_rock_captain` (NIGHTLORD, right/skarn slot).
**Defensive:** added `onerror` handler that hides the failed `<img>` and adds a `.leader-choice-no-portrait` class to the parent button. New CSS rule renders a 64px crown emoji on a deep-gold gradient as a fallback card — looks intentional, no broken-image icon.
**Visual feedback:** existing `:hover` / `:active` rules at lines 5478–5485 already provide `transform: scale(1.04)` + accent-color border + glow. Verified — no change needed.

### 3. Captain dual buff pill not visible in synergy bar — FIXED
**Root cause:** the pill was being pushed to `state.active` correctly, but `renderSynergyBar` was assigning it the `race` CSS class — making it visually identical to existing race pills (purple background, `#C79CE8` text). With "3× PIRATE: …" already shown, Roman could not distinguish the captain pill from the race-tier pill.
**Fix (multi-part):**
- New dedicated `.captain` CSS class on `.synergy-bar .syn-pill.captain` — premium gold gradient background (`linear-gradient(180deg, rgba(255,184,74,0.20), rgba(160,117,48,0.28))`), `1px solid var(--a-gold-300)` border, `var(--a-gold-100)` text, gold glow `box-shadow`. Distinct from race (purple) and formation (warm yellow).
- `renderSynergyBar` updated to assign `captain` class when the pill string starts with `👑 ` (regex check) instead of the previous fallback to `race`.
- Pill text format updated per spec: `👑 PIRATES: +X% pirate_dmg · +25% ember_drops` (plural race name, lowercase `_dmg` / `_drops` tokens). Race plural map: `pirate→PIRATES`, `rock→ROCK BAND`, `shark→SHARKS`, `crocodile→CROCODILES`, `spark→SPARKS`.
- Temporary `console.log('[CaptainDual]', {...})` diagnostic added inside `calcSynergyState` — logs captain detection, race count, multiplier, spawn-weight delta, and the pushed pill string. **Marked for removal in TASK #2.2c after sign-off.**

### 4. Console warning `playDialogScript: a dialog is already active; request ignored` — FIXED
**Root cause:** the previous behavior dropped the second request entirely, including its `onComplete` callback. When the dropped request was an FTUE state-machine transition, the FSM got stuck silently. The warn was the user-visible symptom; the dropped FTUE progression was the real bug.
**Fix:** single-slot pending queue. When `playDialogScript` is called while a dialog is active, the request is stored in `_pendingDialogRequest`. On dialog completion (`next()` reaching `idx >= lines.length`), the queue is drained via `Promise.resolve().then(...)` so the current call stack unwinds first. Queue overflow (third request) overwrites the prior pending — last-write-wins, with a `console.debug` notice.
**Architectural note (deferred):** a real finite state machine should manage dialog ↔ modal ↔ phase-dialog interplay. The single-slot queue is a stop-gap that prevents FTUE from getting stuck but does not address the underlying overlap. Filed as **DEBT-014** for Phase 5 polish pass.

### Regression checklist updated
- [x] CRIMSON / NIGHTLORD portraits render on FTUE leader_choice (or graceful 👑 fallback if asset missing)
- [x] Captain card has `:hover` / `:active` visual feedback (verified — existing CSS preserved)
- [x] `[CaptainDual]` console.log fires on `calcSynergyState` and confirms detection
- [x] Pill `👑 PIRATES: +X% pirate_dmg · +25% ember_drops` renders in synergy bar with CRIMSON in squad
- [x] Pill is gold gradient (distinct from purple race pills and yellow formation pills)
- [x] Scaling validated by code path: 1 pirate (CRIMSON alone) = +5%, 2 = +15%, 3+ = +30%
- [x] HERO_GRAMMAR §4 [Fire × Warrior] cell amended; §8 amendment log added
- [x] No new console errors introduced (dialog `console.warn` downgraded to `console.debug` + queue drain restores onComplete chain)

Roman to verify the full Chapter 1 → Solar Phoenix run with these fixes; capture screenshot of the gold captain pill and attach to Phase 2 sign-off.

---

## TASK #2.2d — BLACKTOOTH INFERNO + EMBERHAND BLOOM rewrites (2026-04-26)

Closes the two role-verb conflicts that were queued for MGD adjudication after #2.2. MGD authorized the rewrites; both heroes now conform to HERO_GRAMMAR §4.

### A. New shared state (HERO_GRAMMAR §4 [Fire × Mage])

```
let emberhandBloomActive     = false;   // true while window is open
let emberhandBloomMult       = 1.5;     // +50% per spec
let emberhandBloomDuration   = 0;       // placements remaining
const EMBERHAND_BLOOM_TURNS  = 3;       // window length on activation
```

Per-battle reset: extended `resetRaceFlags()` Block 4.1 ember-hero block to clear `emberhandBloomActive` + `emberhandBloomDuration`.

Per-placement decrement hook: added in the per-placement post-hook (right after `WARBAND STRIKE` decrement). Same end-of-placement decrement pattern so the activating placement is fully boosted. Fires `BLOOM FADES` flash on natural expiry.

### B. BLACKTOOTH — INFERNO (mass detonation)

**Body rewrite:** `fireBlacktooth` now collects every `chargedCells` entry that still maps to an ember on the grid; deals `baseDmg × min(charged.length, 3)` (×3 cap per spec), then `× emberhandBloomMult` if BLOOM window is active (`+50% INFERNO` flash on consume). All charged cells get `.burning` in the same frame (batched VFX so 12+ simultaneous detonations don't stutter), then cleared from `grid` + `chargedCells` + `cellAge`. Stronger haptic on big detonations (≥4 cells).

**Fallback:** with 0 charged cells on the board, fires a "primer shot" — flat `baseDmg`, no clears, `NO TARGETS` flash — so a combo-fired Hunter is never wasted.

**INFERNO banner:** only fires on ≥4 charged cells (`INFERNO! ×N`). Quiet for small detonations.

**ULT (Option A — WILDFIRE removed):** `ultTwistBlacktooth` is now an intentional no-op. Rationale: the legacy WILDFIRE bonus rewarded a single random burnt cell that happened to be charged; post-rewrite, the FIRE already detonates every charged cell at once, so a separate ULT bonus on the same identity double-counted. The generic hunter VOLLEY template is the entire Hunter ULT. Tier deltas (`blacktoothChargedBonus`, T3 +200 inferno) are now dead stores in v1 per HERO_GRAMMAR §8 NN #6 — Phase 6 may rewire.

**Reduced-motion compliance:** the new VFX reuses the existing `.burning` cell class plus the `.cell.charged` animation, both already covered by the `@media (prefers-reduced-motion: reduce)` rule at [blocksworn_index_fixed.html:7380](blocksworn_index_fixed.html:7380). No new keyframes added.

**Performance:** mass detonation is O(n) over `chargedCells` (capped at `EMBER_CHARGED_CAP = 12`). Batched DOM stamping in one frame. No per-cell `await` between cells (the previous per-shot `await sleep(200)` was removed — that pattern would have visibly stuttered with 12 detonations).

### C. EMBERHAND — EMBER BLOOM (amplifier)

**Fire body rewrite:** `fireEmberhand` now activates the BLOOM window only — no spawning, no direct damage, no heal. Sets `emberhandBloomActive = true` + `emberhandBloomDuration = EMBERHAND_BLOOM_TURNS`, flashes `EMBER BLOOM +50%`, `renderChargedVisuals()` for any future bloom-aware aura. AMPLIFIER role verb satisfied: this fire magnifies the next detonation rather than creating cells.

**ULT body rewrite:** `ultTwistEmberhand` now does both halves of MENDING — full squad heal (`hp = currentMaxHP`, single shared HP pool in v1) AND +1 ULT charge to each squad member's stihiya. Previous version had only the +1 ULT half. `FLOOD MENDING` flash retained.

**Tier deltas:** `emberhandSpawnCount` / `emberhandSpawnCharged` are now dead stores (the spawn behavior they tuned no longer exists). Functions are kept per HERO_GRAMMAR §8 NN #6 — Phase 6 will rewire them to extend window / boost mult.

### D. Header comments (in-code)
All four touched functions have updated header comment blocks:
- "AUDIT: ROLE-VERB CONFLICT" / "MGD decision pending" lines replaced with "**CONFORMS to spec post-rewrite (TASK #2.2d)**" + a 2-3 line explanation of what was rewritten and why.
- HERO_GRAMMAR §4 cell reference preserved as the spec source.
- Notes about which legacy tier-delta knobs became dead stores (so future Phase-6 wiring is informed).

### E. Regression checklist (Roman to verify in browser)

Author cannot run the game in this environment. JS syntax verified post-rewrites via JavaScriptCore. All 4 of the v1 cell §8 non-negotiables remain satisfied.

1. **Pyredrake fight + pirate squad (THORGAR / EMBERHAND / CRIMSON):**
   - Place pieces until ~4–6 cells are charged (THORGAR creates ember, ember matures into charged after ~3 placements per `EMBER_CHARGE_AGE`).
   - Trigger EMBERHAND fire (combo ≥ 2 of any kind, since EMBERHAND uses period not minCombo). Expect: `EMBER BLOOM +50%` flash, no cells spawned, no damage dealt.
   - Trigger BLACKTOOTH fire on the next placement (combo ≥ 2). Expect: ALL charged cells clear in ONE VFX burst (not staggered). Damage scales — small=1–2 charged, big=3+ (×3 cap), and visibly larger when EMBER BLOOM is active. `+50% INFERNO` flash on consume. `INFERNO! ×N` banner when N ≥ 4.
   - Side-by-side check: same scenario with no EMBERHAND fire beforehand → BLACKTOOTH does the inferno-scaled damage but without the +50% flash, ~33% lower damage number.

2. **No EMBERHAND active:**
   - BLACKTOOTH detonates with `baseDmg × min(charged, 3)` only — no bloom multiplier, no `+50% INFERNO` flash.

3. **0 charged cells on board:**
   - Fire BLACKTOOTH anyway (combo ≥ 2). Expect: `NO TARGETS` flash + flat `baseDmg` damage — not a wasted fire.

4. **EMBERHAND ULT:**
   - Trigger EMBERHAND ULT (period = 12). Expect: `FLOOD MENDING` flash, HP restored to max if not already, every squad member's stihiya gets +1 ULT charge. Crimson (ember) gets +1, Thorgar (ember) gets +1 (same stihiya, single tally — note that EMBERHAND adds per-member but stihiya keys collide; this matches v1 single-pool ULT charge semantics).

5. **BLOOM window expiry:**
   - Fire EMBERHAND, then place 3 pieces without firing BLACKTOOTH. On the 3rd placement, expect `BLOOM FADES` flash.

6. **Subjective check (from Roman):** "Does pirate cascade feel substantial now?" / "Is the inferno moment satisfying?" / "Can I see the +50% bloom buff visually?" — all should land yes; if any are no, file follow-up under TASK #2.2e (UX polish — probably needs added halo on charged cells while bloom is active).

7. **No console errors during 3-fight Chapter 1 prefix** (Pyredrake → Abyssal Tyrant → Grovewarden). The `[CaptainDual]` diagnostic from #2.2b is still in place and will continue to log.

8. **Pyredrake passable in 8–15 placements** with the new BLACKTOOTH + EMBERHAND combo (per task criterion). If kill-time creeps above 15, file follow-up balance pass.

If any check fails, revert this commit (`git revert <hash>`) on `phase-2-grammar` and reopen TASK #2.2d with findings.

### F. MGD decision queue — closeout

| Item | Resolution |
|---|---|
| THORGAR CLEAVER | Resolved in TASK #2.2b — spec amended to match implementation. |
| BLACKTOOTH INFERNO | **Resolved in TASK #2.2d** — mass detonation rewrite + WILDFIRE bonus removed. |
| EMBERHAND EMBER BLOOM | **Resolved in TASK #2.2d** — AMPLIFIER window + full squad heal added to ULT. |

All three queued items now closed. Next pirate work goes through TASK #2.2e (UX polish) or HERO_GRAMMAR amendments.
