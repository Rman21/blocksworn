# PHASE 2 — ELEMENT GATING AUDIT

**Branch:** `phase-2-grammar`
**Spec:** [HERO_GRAMMAR.md](HERO_GRAMMAR.md) §1 (predictability) · §2 (element mechanics) · §5 (race layer)
**Scope:** Suppress element side-systems (drops, bloom overlays, ember auto-charge, radiant aging) when the element is neither in the active squad nor on the current boss. v1 ships with playable Pirates (Fire/Ember) + Rock Band (Dark/Umbra); Sharks (Frost/Tide) art-ready, code TBD; Crocodiles (Earth/Grove) and Sparks (Light/Solar) are Phase 5. Element leakage from old factions (Earth/Light always in spawn pool; bloom overlays in Pirates-only fights) violates HERO_GRAMMAR §1 predictability and pollutes baseline measurement before BLACKTOOTH/EMBERHAND rewrites.

---

## Section A — Bloom mechanic (Grove × Warrior / Earth × Mage side-system)

**State:** `bloomTokens` Map<"r_c", turnsLeft> ([blocksworn_index_fixed.html:12929](blocksworn_index_fixed.html:12929)).

**Spawn:**
- `spawnBloomToken()` ([:15378](blocksworn_index_fixed.html:15378)) — picks a random empty cell, sets gestation timer.
- `spawnBloomTokenAt(r, c)` ([:13385](blocksworn_index_fixed.html:13385)) — Auron T3 seed-on-convert.

**Trigger source — clearLines() flow:**
- [:19285](blocksworn_index_fixed.html:19285) `for (let i = 0; i < (counts.grove || 0); i++) spawnBloomToken();` — one bloom per grove cell cleared in player's combo.
- [:19287](blocksworn_index_fixed.html:19287) Stonemason 20% bonus per grove cell.
- [:19498](blocksworn_index_fixed.html:19498) Auron T3 etc.

**Tick / payoff:**
- `tickBloomTokens()` ([:15414](blocksworn_index_fixed.html:15414)) — runs once per placement; decrements timer; calls `triggerBloom` at 0.
- `triggerBloom(key)` ([:15380](blocksworn_index_fixed.html:15380)) — heals + converts neighbors to grove cells. Self-perpetuating chain when grove drops are in pool.

**UI render:**
- `renderBloomTokens()` ([:15441](blocksworn_index_fixed.html:15441)) — adds `.has-bloom` class + `.bloom-overlay` div with turn count.
- `renderGrid()` ([:19972](blocksworn_index_fixed.html:19972)) — same overlay during full re-render.

**Classification: needs gating.** The bloom mechanic is correct *for Grovewarden fights or Crocodile squads*, but in v1 with Pirates vs Pyredrake, no Grove anywhere → bloom should be dormant.

**Action taken:** Gated at the source (`spawnBloomToken` + `spawnBloomTokenAt`) and at the tick (`tickBloomTokens`). With no grove drops in the pool (Section B), `counts.grove` is also always 0 — multiple layers of suppression. `triggerBloom` and `renderBloomTokens` are not gated directly because they only see what `spawnBloomToken` produced; gating upstream is sufficient.

---

## Section B — Grove drops in spawn pool

**Baseline:**
- `STIHIYAS = ['ember', 'tide', 'grove', 'solar', 'umbra']` ([:8214](blocksworn_index_fixed.html:8214)) — element list, kept intact (Phase 5 races still need to reference these).
- Global `let stihiyaSpawnWeights = { ember:1, tide:1, grove:1, solar:1, umbra:1 }` ([:12899](blocksworn_index_fixed.html:12899)).
- `calcSynergyState` baseline ([:13889](blocksworn_index_fixed.html:13889)) — `state.spawnWeights = { ember:1, tide:1, grove:1, solar:1, umbra:1 }`.
- `weightedStihiya()` ([:14736](blocksworn_index_fixed.html:14736)) — weighted random pick.

**Bug 1 — leak:** baseline keeps grove and solar at weight 1 unconditionally; with no Grove/Solar heroes in v1, they still drop in the tray.

**Bug 2 — defense:** `weightedStihiya` used `(stihiyaSpawnWeights[s] || 1)` which silently coerced explicit 0 weights back to 1. Any "set weight to 0" gate would have been defeated.

**Classification: needs gating + bug fix.**

**Action taken:**
- New helper `computeActiveElements(heroes)` ([:13884](blocksworn_index_fixed.html:13884)) — returns `Set` of stihiya values from squad + current boss. Single source of truth for the 3 gates in this commit and all future element-conditional code.
- After all weight contributions in `calcSynergyState` (race-affinity, captain dual buff §6, artifact rings) the weights for any element NOT in `activeElements` are zeroed — race-affinity / captain / ring boosts for inactive elements are also dropped (correctly — they had nothing to do with this fight).
- `weightedStihiya` switched to `?? 1` so explicit 0 is honored. Added a defensive total-zero fallback (return first non-zero, else `STIHIYAS[0]`) — shouldn't fire because at least one squad/boss element is always active.

---

## Section C — Ember auto-charge

**Mechanic:** `tickEmberAges()` ([:15172](blocksworn_index_fixed.html:15172)) runs once per placement (called from main per-placement post-hook at [:19394](blocksworn_index_fixed.html:19394)). Each ember cell ages +1; at age `EMBER_CHARGE_AGE` (=3, [:8234](blocksworn_index_fixed.html:8234)) it gets added to `chargedCells`. Promotion is irreversible until the cell is cleared.

**Status:** **INTENTIONAL.** Documented in HERO_GRAMMAR §2 [Fire / Ember] — *"On clear, surviving ember cells become charged. Adjacent charged cells chain on detonation."* The shipped behavior is "after N placements" rather than "on adjacent clear" but functionally equivalent — ember cells must "ripen" so HUNTER can DETONATE them per §4 [Fire × Hunter]. Charged cells are the foundation of pirate cascade. Removing this would break THORGAR / IRONBELLY / BLACKTOOTH / EMBERHAND / CRIMSON simultaneously.

**Per-cell un-charging (charge-decay timer):** does not exist in v1 codebase. Once charged, a cell stays charged until cleared. Per HERO_GRAMMAR §8 amendment log (2026-04-26), this is deferred to Phase 6.

**UX gap (not addressed in this commit):** there is no flash text or visual when an ember cell matures into charged. The cell's `.charged` class adds a static glow. From a player POV, ember cells "light up" on their own without explanation. Filed as **DEBT-015** for a polish pass — proposed: brief `EMBER MATURED` flash text or animated halo on promotion.

**Classification: intentional, gated for cleanliness.** With Pirates in squad OR Pyredrake as boss, ember IS in `activeElements`, so the tick runs. With a pure non-fire fight (e.g. Sharks vs Crypt Lich) the side-system goes dormant + `cellAge` / `chargedCells` are cleared.

**Action taken:** Added `if (!computeActiveElements().has('ember')) { cellAge.clear(); chargedCells.clear(); return; }` immediately after the existing `MOTIFS_ENABLED.ember` guard ([:15177](blocksworn_index_fixed.html:15177)). Comment block documents intentional status, links to HERO_GRAMMAR §2 / §8 amendment log, and points at DEBT-015 for the UX gap.

---

## Other 3 element side-systems — gating audit

| Element | Side-system | Tick / event | Gating posture |
|---|---|---|---|
| Tide | `chainStack` / `chainWindow` (Frost chains) | Event-driven: `onFreezeApplied` ([:15315](blocksworn_index_fixed.html:15315)) called only when a hero applies freeze. With no Tide hero in squad and no Tide boss, no freeze ever happens → naturally gated. **No code change needed.** |
| Umbra | Encore stacks | Event-driven: triggered by umbra cell clears ([:15634](blocksworn_index_fixed.html:15634), [:15669](blocksworn_index_fixed.html:15669)). With umbra drops zeroed, `counts.umbra = 0`, encore never fires → naturally gated. **No code change needed.** |
| Solar | `radiantCells` / `radiantAge` | Tick-driven: `tickRadiantAges()` ([:15536](blocksworn_index_fixed.html:15536)) runs per placement (parallel to `tickEmberAges`). Stale `radiantCells` from a prior battle could leak; gated for parity with ember/grove. |
| Grove | `bloomTokens` | Tick-driven: `tickBloomTokens()` ([:15414](blocksworn_index_fixed.html:15414)). Gated. |
| Ember | `cellAge` / `chargedCells` | Tick-driven: `tickEmberAges()`. Gated. |

The pattern: **event-driven side-systems are naturally gated** by the spawn-weight zero-out (no clears → no events). **Tick-driven side-systems** (ember/grove/solar) need explicit gating because they fire every placement regardless of clears, and could see stale state across battles.

---

## What this commit changes

1. **Helper:** `computeActiveElements(heroes?)` — returns `Set<stihiya>` from squad heroes + `currentBoss`. Falls back to global `HERO_DECK` when called without an argument.
2. **Spawn weights:** baseline of 1 per element preserved; AFTER all contributions, elements not in `computeActiveElements` are set to 0 in `state.spawnWeights`.
3. **`weightedStihiya`:** `||` → `??` (so explicit 0 is honored); defensive fallback when total weight is 0.
4. **`spawnBloomToken` + `spawnBloomTokenAt`:** early return if grove not active.
5. **`tickBloomTokens`:** clear bloomTokens + early return if grove not active.
6. **`tickEmberAges`:** clear cellAge + chargedCells + early return if ember not active.
7. **`tickRadiantAges`:** clear radiantCells + radiantAge + early return if solar not active.
8. Documentation block atop `tickEmberAges` records intentional status + DEBT-015 reference.

**Single source of truth:** all 3 gates call `computeActiveElements()`. No element list is hard-coded outside the helper.

---

## What this commit does NOT change

- Pirate fire/ULT bodies (THORGAR / BLACKTOOTH / EMBERHAND / IRONBELLY / CRIMSON) — reserved for TASK #2.2d.
- Captain dual buff (TASK #2.2b complete) — preserved.
- Boss attack damage numbers — Phase 3.
- Rock Band / Sharks / Clockwork heroes.
- FTUE intro modals / synergy bar layout / combo banners.
- `MOTIFS_ENABLED` constant — left as kill-switch above the element-active gate.

---

## Regression checklist (Roman to verify in browser)

Author cannot run the game in this environment. JS syntax verified post-edits via JavaScriptCore.

1. **Pyredrake fight + pirate-only squad (Fire boss × Fire squad):** `activeElements = {ember}`. Tray contains **only ember (Fire)** pieces. 0 grove, 0 tide, 0 solar, 0 umbra. 0 bloom overlays on board. Ember cells still mature into charged after ~3 placements (intentional, see Section C).
2. **Pyredrake fight + pirate + rock_warrior squad:** `activeElements = {ember, umbra}`. Tray contains ember + umbra. 0 grove, 0 tide, 0 solar.
3. **Abyssal Tyrant fight + pirate-only squad (Frost boss × Fire squad):** `activeElements = {ember, tide}`. Tray contains ember + tide. Frost chains activate when tide cells are cleared (boss element in play). 0 grove overlays.
4. **Solar Phoenix + pirate squad (Light boss × Fire squad):** `activeElements = {ember, solar}`. Tray includes solar pieces (boss adds it). Solar overlays may appear (radiant cells from solar clears). 0 grove.
5. **Crypt Lich + pirate squad (Dark boss × Fire squad):** `activeElements = {ember, umbra}`. Tray ember + umbra. Encore stacks on umbra clears. 0 grove, 0 solar.
6. **Captain dual buff pill** (`👑 PIRATES: +X% pirate_dmg · +25% ember_drops`) still renders — TASK #2.2b unchanged.
7. **No new console errors** in any of the above flows. The `[CaptainDual]` diagnostic from #2.2b remains until #2.2c sign-off.
8. **Cross-battle hygiene:** restart the game between fights and verify no stale bloom/radiant state survives (the tick gates clear maps when the element is inactive — defense in depth).

If any check fails, revert this commit (`git revert <hash>` on `phase-2-grammar`) and reopen TASK #2.2c with findings.
