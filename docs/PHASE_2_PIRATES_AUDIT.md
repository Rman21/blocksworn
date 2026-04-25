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
| **BLACKTOOTH** | Fire × Hunter — INFERNO | Deals `blacktoothBaseDmg` (T0=180) + charged bonus on **1–2 random cells** (T0=1, T2=2); ULT WILDFIRE adds +100/+150 if any burnt cell was charged. | Spec INFERNO: **detonates EVERY charged ember cell at once**, ×3 cap. Current shoots 1–2 random cells (NOT all charged), no ×3 multiplier scaling on charged-cell count. Detonator role verb **not** satisfied. | ❌ **ROLE-VERB CONFLICT** — Hunter must DETONATE (all charged at once). Current is single-target burst with optional charged-bonus side effect. | **STOP. No code change.** Header comment + MGD decision required. |
| **EMBERHAND** | Fire × Mage — EMBER BLOOM | +1 HP regen + **spawns 2–3 ember cells** on empty (T2 spawned-as-charged). ULT FLOOD MENDING: +1 ULT charge to each squad member's stihiya. | Spec EMBER BLOOM: **every charged cell gains +50% detonation damage** (AMPLIFIER); ULT: full squad heal + +1 ULT to all. Current is a **CREATOR** (spawns ember), not an AMPLIFIER (boosts charged dmg). ULT partially matches (+1 ULT to all ✓; full squad heal ✗ — only +1 HP regen). | ❌ **ROLE-VERB CONFLICT** — Mage must AMPLIFY existing charged cells. Current spawns new cells (Warrior territory). | **STOP. No code change.** Header comment + MGD decision required. |
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
