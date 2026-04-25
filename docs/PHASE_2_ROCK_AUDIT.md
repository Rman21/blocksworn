# PHASE 2 — ROCK BAND AUDIT (HERO_GRAMMAR §4 conformance, Block B1)

**Branch:** `phase-2-grammar`
**Spec:** [HERO_GRAMMAR.md](HERO_GRAMMAR.md) §3 (Role Matrix) · §4 row [Dark / Umbra] · §6 (Captain dual buff) · §8 non-negotiables
**Scope:** 5 Rock Band heroes — RIFFBLADE, SHRIEK, KEYCRYPT, THUNDERBEAT, NIGHTLORD. This is the [Dark / Umbra] sibling of `PHASE_2_PIRATES_AUDIT.md`. Ships in a single Block B1 commit per workflow.
**Approach:** Audit existing fire/ULT bodies vs. spec; refactor SHRIEK + KEYCRYPT for role-verb conformance; verify NIGHTLORD captain dual buff fires for free via the universal §6 system; spot-check element gating; document all 5 heroes via in-code header comments.

---

## Section A — Per-hero divergence table

| Hero | Spec §4 cell | Pre-Block-B1 behavior (fire / ULT) | Divergence | Status post-Block-B1 |
|---|---|---|---|---|
| **RIFFBLADE** | Dark × Warrior — *direct hit on placement; every umbra clear adds 1 Encore stack to next ability* | Fires `200` flat dmg per placement; every Nth fire (N=3 default) deals `200 × riffbladeBeatMult` (×2 default). | Direct-hit half ✓. Encore-stack-on-clear half MISSING — was nowhere in code. | ✅ **CONFORMS** — encore stack creation now lives in universal `onUmbraCellsCleared` hook ([blocksworn_index_fixed.html:15700](blocksworn_index_fixed.html:15700)). RIFFBLADE fire body unchanged. |
| **SHRIEK** | Dark × Hunter — *detonates every Encore stack as echoing line damage; line repeats once at 50% (Encore-of-Encore)* | Burned 1 random cell × 180 dmg + adjacent umbra spread if 3+ rocks (collateral, not detonation). | ❌ **ROLE-VERB CONFLICT** — Hunter must DETONATE all stacks at once. Current was single-target burst with collateral spread. | ✅ **CONFORMS post-rewrite** — mass detonate of all encoreStacks (×3 cap) + KEYCRYPT amp mult + 50% Encore-of-Encore repeat 200ms later + ENCORE-OF-ENCORE! banner ≥4 stacks + primer-shot fallback on 0 stacks. |
| **KEYCRYPT** | Dark × Mage — *Encore stacks gain +20% per stack; ULT: every squad hero gets one free Encore* | +1 HP regen + spawned 1–2 umbra cells on empty (T2 marked as "charged-equivalent"). | ❌ **ROLE-VERB CONFLICT** — Mage must AMPLIFY existing stacks; current was a CREATOR (spawned cells). | ✅ **CONFORMS post-rewrite (fire)** — pure AMPLIFIER: opens 3-placement DEEP BEAT window with mult `1.0 + stacks × 0.20`; no spawning, no damage, no heal. ULT: ⚠ partial — see DEBT-016 below. |
| **THUNDERBEAT** | Dark × Tank — *every Encore proc grants +1 shield; ULT: free Rhythm proc + squad-wide Encore window* | +1 shield + 160/210 dmg on fire. ULT opens 1–2 placement Rhythm window (+50 free on next umbra clear). | Active fire ✓ (PROTECTOR EXTENDS). "Encore proc grants +1 shield" missing. ULT free Rhythm proc ✓; squad-wide Encore window ⚠ partial. | ✅ **CONFORMS post-rewrite (fire)** via `consumeEncoreStacks` helper — every encore-consume event auto-bumps shieldCount when THUNDERBEAT in squad. ULT half ⚠ — see DEBT-016. |
| **NIGHTLORD** | Dark × Captain — *race-buff scales rock band Encore multiplier; +25% umbra drops; ULT triggers immediate squad-wide Encore window* | Active fire converts 2 cells to umbra + per-cell chance to gift +1 charge to umbra hero. ULT sets `encoreActive=true; encoreUsed=false`. | Active fire is a Captain board effect (preserved). Captain DUAL BUFF (race-scaling dmg + fixed +25% umbra drop) handled by universal §6 system from TASK #2.2b. ULT ✓. | ✅ **CONFORMS** — captain dual buff fires automatically via `calcSynergyState` (no rock-specific code needed). `_RACE_PLURAL` map already includes `rock: 'ROCK BAND'` from #2.2b. ULT body unchanged. |

---

## Section B — Refactor changes applied (Block B1 commit)

### B.1 New shared state (`blocksworn_index_fixed.html` ~§13205)

```
let encoreStacks              = 0;
const ENCORE_STACK_CAP        = 8;        // generous cap; spec is silent
let keycryptDeepBeatActive    = false;
let keycryptDeepBeatMult      = 1.0;
let keycryptDeepBeatDuration  = 0;
const KEYCRYPT_DEEP_BEAT_TURNS = 3;
```

### B.2 Lifecycle hooks
- **Per-battle reset** in `resetRaceFlags()` Block 4.5 umbra block: clears `encoreStacks`, `keycryptDeepBeatActive/Mult/Duration`.
- **Per-placement decrement** in the per-placement post-hook (right after EMBERHAND BLOOM): `keycryptDeepBeatDuration--` at end-of-placement so the activating placement is fully boosted; `DEEP BEAT FADES` flash on natural expiry.
- **Stack creator** in `onUmbraCellsCleared(n)`: when umbra is in `computeActiveElements()`, `encoreStacks = min(ENCORE_STACK_CAP, encoreStacks + n)`. Universal element mechanic — fires regardless of which heroes are in squad.
- **Stack consumer** new helper `consumeEncoreStacks()`: drains to 0, returns consumed count, fires THUNDERBEAT shield bump if THUNDERBEAT in squad.

### B.3 SHRIEK — mass DETONATOR
- All charged-stack damage scales by `min(stacks, 3)` (×3 cap).
- KEYCRYPT amplifier window read from `keycryptDeepBeatMult` if `keycryptDeepBeatActive && keycryptDeepBeatDuration > 0` — consumed display with `+X% ENCORE` flash.
- Encore-of-Encore: 50% damage repeat 200ms after the first echo.
- Primer-shot fallback on 0 stacks (flat `baseDmg` + `NO STACKS` flash) so a combo-fired Hunter never feels wasted.
- `ENCORE-OF-ENCORE!` banner only on detonations of 4+ stacks (quiet for small).
- Stronger haptic on big detonations.
- Old collateral umbra-spread mechanic removed — mass detonation is the entire signature.
- Tier deltas (`shriekRockThreshold`, `shriekSpreadCount`, `shriekSpreadDetonate`) become dead stores per HERO_GRAMMAR §8 NN #6.

### B.4 KEYCRYPT — pure AMPLIFIER
- Activates 3-placement DEEP BEAT window only. No spawning, no damage, no heal. AMPLIFIER role verb satisfied.
- Mult computed AT FIRE TIME from current encoreStacks (`1.0 + stacks × 0.20`) — captures the moment.
- `DEEP BEAT +X%` flash on activation.
- Tier deltas (`keycryptSpawnCount`, `keycryptSpawnCharged`, `keycryptSpawnChargesHero`) become dead stores per §8 NN #6.

### B.5 RIFFBLADE / THUNDERBEAT / NIGHTLORD — fire bodies unchanged
- RIFFBLADE: direct-hit Warrior CREATOR; the encore-stack-on-clear half is now satisfied universally via `onUmbraCellsCleared`. Header comment updated to point at the universal hook.
- THUNDERBEAT: PROTECTOR — active fire EXTENDS spec; the spec "encore proc grants +1 shield" half now fires via `consumeEncoreStacks` helper.
- NIGHTLORD: Captain dual buff fires automatically via `calcSynergyState` (universal §6 system from TASK #2.2b). Active fire body unchanged.

### B.6 ULT signatures
| Hero | Spec ULT | What changed |
|---|---|---|
| RIFFBLADE | SIEGE | No change. Header comment now documents EXTENDS spec via ENCORE SIEGE doubling. |
| SHRIEK | VOLLEY | No change. Header comment notes ECHO VOLLEY aligns with the Encore-of-Encore identity. |
| KEYCRYPT | MENDING | No body change. Header comment notes existing keycryptAmpWindow is a v1 stop-gap; literal "every squad hero gets one free Encore" filed as **DEBT-016**. |
| THUNDERBEAT | AEGIS | No body change. Header comment notes free Rhythm proc lives in thunderbeatRhythmWindow; squad-wide Encore-window-from-Tank-ULT half also filed as **DEBT-016**. |
| NIGHTLORD | DOMINION | No change. Header comment confirms CONFORMS — `encoreActive=true` opens the squad-wide encore window. |

### B.7 In-code header comments
All 10 functions (5 fire + 5 ULT twist) carry `HERO_GRAMMAR §4 [Dark × Role] — HERO / NAME` blocks documenting spec, status, and any DEBT references. Mirror of pirate audit pattern.

---

## Section C — NIGHTLORD captain dual buff verification

The universal captain dual buff system was implemented in TASK #2.2b. NIGHTLORD inherits without any rock-specific code:

| Check | Verified path | Expected behavior |
|---|---|---|
| Detection | `calcSynergyState` line ~14017 — `heroes.find(h => h && h.newRole === 'captain')` | Returns NIGHTLORD when in squad. |
| `captainDual_active` | Set true via state mirror at ~14188 | True. |
| `captainDual_race` | `_captainHero.race` | `'rock'`. |
| `captainDual_stihiya` | `_captainHero.stihiya` | `'umbra'`. |
| `captainDual_raceMult` | `_raceN >= 3 ? 1.30 : (_raceN === 2 ? 1.15 : 1.05)` | +5% / +15% / +30% by rock-hero count. |
| `captainDual_dropBonus` | Fixed `0.25` added to `state.spawnWeights['umbra']` | +25% umbra drop weight. |
| Pill text | `_RACE_PLURAL[_captainHero.race]` → `'ROCK BAND'` (already in map from #2.2b) | `👑 ROCK BAND: +30% rock_dmg · +25% umbra_drops` (with 3 rocks). |
| Pill class | renderSynergyBar regex `/^👑 /` test → `.captain` class | Gold gradient. Distinct from race (purple) and formation (yellow). |
| Race-buff dmg path | `_captainDualContext` injected into `dealDamage` mult stack from `_currentFiringHero.race` check | Multiplies all damage from rock heroes by `captainDual_raceMult`. |

**Verified by code path inspection.** Roman to confirm in browser via the Section G regression checklist.

---

## Section D — Element gating regression (TASK #2.2c, Block B1 verification)

Confirming `computeActiveElements()` (TASK #2.2c) handles umbra correctly across the 3 task-spec'd squad/boss combos:

| Squad | Boss | activeElements | Expected tray drops | Status |
|---|---|---|---|---|
| RIFFBLADE only (1 rock hero) | Pyredrake (ember) | `{ember, umbra}` | ember + umbra | ✅ — umbra in set via squad |
| no rock heroes | Crypt Lich (umbra) | `{ember, umbra}` (assuming pirate squad) | ember + umbra | ✅ — umbra in set via boss |
| no rock heroes | Pyredrake (ember) | `{ember}` only (assuming pirate squad) | ember only | ✅ — umbra correctly excluded |

`computeActiveElements()` is fully universal (added in #2.2c). No rock-specific changes needed; spec-conformance for umbra was already in place from the helper's design.

---

## Section E — State vars added + reset locations

| Variable | Declaration | Reset in `resetRaceFlags` | Decrement / drain |
|---|---|---|---|
| `encoreStacks` | ~13205 | Block 4.5 umbra block | Drained to 0 by `consumeEncoreStacks` (called from SHRIEK fire). Capped at `ENCORE_STACK_CAP` on accumulate. |
| `ENCORE_STACK_CAP` | ~13206 (const) | n/a | n/a |
| `keycryptDeepBeatActive` | ~13211 | Block 4.5 umbra block | Per-placement decrement sets back to false on natural expiry. |
| `keycryptDeepBeatMult` | ~13212 | Block 4.5 umbra block | Reset to 1.0 on natural expiry. |
| `keycryptDeepBeatDuration` | ~13213 | Block 4.5 umbra block | Per-placement decrement (mirrors EMBERHAND BLOOM). |
| `KEYCRYPT_DEEP_BEAT_TURNS` | ~13214 (const) | n/a | n/a |

---

## Section F — Git Cleanup Resolution

**Decision:** PATH A (tag + delete), executed per MGD authorization at start of Block B1.

Steps performed in order:
1. Switched main worktree (`/Users/rm/Downloads/game file/`) from `phase-4-moment-mechanics` to `main` (clean baseline; no WIP affected — only untracked `BLOCKSWORN_MASTER_PLAN_V2.md` and `assets/` preserved).
2. Tagged the deleted-branch tip: `git tag archived/phase-4 phase-4-moment-mechanics` (commit `befcffe`).
3. Deleted branch: `git branch -D phase-4-moment-mechanics` → "Deleted branch phase-4-moment-mechanics (was befcffe)".
4. Remote delete attempt — no-op since the repo has no remote configured.
5. Verified: `archived/phase-4` shows in `git tag --list 'archived/*'`; `phase-4-moment-mechanics` no longer in `git branch -a`; `git log archived/phase-4 -3` resolves the tip and walks history.

**11 unique Phase 4 feature commits preserved permanently** under tag `archived/phase-4` (recovery via `git checkout archived/phase-4` always works; tag is never GC'd):
- `b0796ac` per-hero charge meters with inverse scaling fill rate
- `d07a48a` session notes day 1 — Task 4.1 + design pillars + transition prep
- `7bc2fe3` tier-based ult cost (80/100/120) + DEBT-014 audit
- `48c73b2` max 1 captain per squad — auto-swap (Pillar 20)
- `f56ffe9` chain role data layer (Task 4.3.1)
- `cdff836` chain combo detection state machine (Task 4.3.2)
- `10380a7` chain combo wiring + ult effects rewrite (Pillars 7-10, Task 4.3.3)
- `7b9e1ea` mage convert empty cells + dev unlock helper (Task 4.3.3 hotfix)
- `c6ab219` mage igniter rewrite + identity scaffolding (Task 4.3.3.1)
- `8ccf88b` visual feedback core — banner + shake + damage numbers (Task 4.5a)
- `55bd41e` banner sizing + shake tiers + thorgar smart-seed + one-shot timing (4.5a hotfix)

Per MGD instruction: when playtest of new code is needed, Roman switches main worktree to `phase-2-grammar` (or creates a fresh `phase-2-playtest` branch). Auto-merge propagation pattern from earlier sessions is **not** continued — Roman drives the playtest checkout himself.

---

## Section G — Regression checklist (Roman to verify)

Author cannot run the game in this environment. JS syntax verified post-rewrites via JavaScriptCore.

1. **Squad: RIFFBLADE + KEYCRYPT + SHRIEK + NIGHTLORD** (4 rock heroes — `SQUAD_MAX = 4` stage):
   - Console: `[CaptainDual]` log shows `captainDualActive=true, race='rock', stihiya='umbra', sameRaceCount=4, captainDualRaceMult=1.3`.
   - Synergy bar: gold pill `👑 ROCK BAND: +30% rock_dmg · +25% umbra_drops`.
   - Tray content: predominantly umbra (purple) cells + boss element.

2. **Trigger RIFFBLADE fire on umbra clears**: `encoreStacks` increments by N per N umbra cells cleared (visible via DevTools `console.log(encoreStacks)`).

3. **Trigger KEYCRYPT fire** with stacks > 0:
   - `DEEP BEAT +X%` flash where X = stacks × 20.
   - Console: `encoreStacks` BEFORE === AFTER (no stacks created — AMPLIFIER, not CREATOR).
   - `keycryptDeepBeatActive` = true, `keycryptDeepBeatMult` = `1.0 + stacks × 0.20`, `keycryptDeepBeatDuration` = 3.
   - After 3 placements without firing SHRIEK: `DEEP BEAT FADES` flash + state resets.

4. **Trigger SHRIEK fire** with stacks ≥ 4:
   - Two damage numbers visible (full echo + 50% encore-of-encore, ~200ms apart).
   - `ENCORE-OF-ENCORE!` banner.
   - `+50%` flash if KEYCRYPT amp window was active.
   - `encoreStacks` resets to 0 post-fire.
   - THUNDERBEAT in squad → `DRUMHEAD +1🛡` flash + shield count increments.

5. **Trigger SHRIEK fire** with 0 stacks:
   - `NO STACKS` flash + flat `baseDmg = 180` damage. Not wasted.

6. **Trigger NIGHTLORD ULT** (period = 10):
   - `ENCORE NOW` flash + `encoreActive = true`. The next umbra ULT fired auto-double-fires (existing universal mechanic).

7. **Squad: pirate-only (no rock)** in same boss fight:
   - Captain pill is PIRATES (CRIMSON), not ROCK BAND.
   - `encoreStacks` does NOT accumulate (umbra not in `activeElements` unless boss is umbra-element).

8. **Element gating cross-check (squad: pirate-only + Pyredrake)**:
   - Tray: 0 umbra pieces (umbra not in `activeElements`).
   - `[CaptainDual]` log shows captain detection for CRIMSON (race='pirate', stihiya='ember').

9. **No console errors** during 3-fight Chapter 1 prefix (Pyredrake → Abyssal Tyrant → Grovewarden) with rock squad. The `[CaptainDual]` diagnostic from #2.2b is still in place.

---

## Section H — Deferred items (DEBT-016)

Filed for a follow-up MGD task; out of scope for Block B1:

- **KEYCRYPT ULT** literal "every squad hero gets one free Encore" — requires per-hero token tracker + fireHero double-fire path with recursion guard. Current keycryptAmpWindow (3-placement umbra-clear +20%) is the v1 stop-gap.
- **THUNDERBEAT ULT** "squad-wide Encore window" half — partially covered by NIGHTLORD ULT (which sets `encoreActive`). A Tank-specific 3-placement encore window for ALL fires (not just umbra ULTs) would need the same per-fire double-fire path as KEYCRYPT.

Both are deferred together because they share the same architectural prerequisite (a `freeEncoreTokens` Set + recursion-guarded fireHero re-execution path). When MGD prioritizes DEBT-016, both heroes get rewired in a single follow-up commit.
