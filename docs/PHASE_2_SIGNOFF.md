# PHASE 2 — ELEMENT × ROLE × RACE GRAMMAR · SIGN-OFF

**Branch closed:** `phase-2-grammar`
**Tag:** `v0.2.0-phase-2-done`
**Spec authority:** [BLOCKSWORN_MASTER_PLAN_V3.md](../BLOCKSWORN_MASTER_PLAN_V3.md) · [HERO_GRAMMAR.md](HERO_GRAMMAR.md)
**Date:** 2026-04-26

---

## Section A — Block roadmap status

| Block | Plan status | Final delivery | Commits |
|---|---|---|---|
| **B0 Pirates** | ✅ DONE | Pirates conform to grammar; CRIMSON dual buff; element gating helper; BLACKTOOTH INFERNO + EMBERHAND BLOOM rewrites | 5 atomic patches: `03ef056` → `0b300ea` |
| **B1 Rock Band** | ✅ DONE | All 5 Rock Band heroes conform to §4 [Dark/Umbra]; SHRIEK Encore-of-Encore; KEYCRYPT amplifier; THUNDERBEAT shield-on-encore; NIGHTLORD captain dual; legacy phase-4 archived | `694fe34` |
| **B2 Sharks** | ✅ DONE | 5 Sharks implemented from scratch with art (RIMEFANG/BRINESHOT/CRYOMIND/BULWARK/ABYSSKING); universal frost chain infrastructure; ABYSSKING dual buff | `3cf9415` |
| **B3 Squad+Bosses** | ✅ DONE + 6 hotfixes | Hero unlock progression Model B; SQUAD_MAX 3→4→5; 5 boss voices; 5 archetype auras; archetype-specific telegraph; migration | `45b5dab` + B3.1-B3.6 hotfix sequence |
| **B4 Combo UI Polish** | ✅ DONE (focused scope) | Synergy bar horizontal scroll; flashText escalation for cap moments; reduced-motion compliance verified | `(this commit)` |
| **B5 Phase 2 Sign-off** | ✅ DONE | This doc + tag `v0.2.0-phase-2-done` | `(this commit)` |

---

## Section B — Phase 2 hotfix audit (B3.1–B3.6 sequence)

After Block B3 shipped, Roman playtest surfaced design + regression issues that drove a 6-hotfix sequence. Each is documented in its own audit doc. Final state per hotfix:

| Hotfix | Commit | Issue / Decision | Outcome |
|---|---|---|---|
| **B3.1** | `4496466` | BUG #1 voice dialog broken portrait (B3 regression); BUG #2 charge bar drain (legacy mechanic exposed) | BUG #1 fixed (`portraitKey: currentBoss.img` added). BUG #2 escalated to MGD with 4 decision options. |
| **B3.1 Option A** | `d1bc8c2` | MGD pick: revert STARTER_HEROES to mixed-element 4-hero set as a stop-gap | Applied (later superseded by B3.2). |
| **B3.2** | `b51fb20` | MGD pick Option C: restore per-hero charge architecture from `archived/phase-4` | `heroCharges = {heroId: 0..120}` cherry-picked; each card has independent charge meter. STARTER_HEROES reverted to B3 mono-pirate trio. |
| **B3.3** | `c8f5e01` | Per-role ULT cost requested | `HERO_ULT_COST_BY_NEWROLE = { warrior:80, mage:100, hunter:120, tank:80, captain:100 }`. **Inverts §2.3 ordering** — amendment-log entry recorded. |
| **B3.4** | `33d176b` | Three coupled changes: remove ember auto-ignite; EMBERHAND ignite 6 cells; ALL Hunter ULTs detonate every cell of color | `tickEmberAges` reduced to cleanup-only; new `_hunterUltDetonateAllCells` helper used by all 3 Hunter ULTs (×8 cap). |
| **B3.5** | `1d69dd5` | Disable passive auto-fire for non-captains | (Later reverted in B3.6 — see below.) |
| **B3.6** | `049ab26` | Audit vs MASTER_PLAN_V3 found B3.5 contradicted §2.3 + §4.3. THORGAR + EMBERHAND not enforcing §2.4 role verbs. | Revert B3.5 (passive auto-fire restored); THORGAR now charges 3 ember per fire (Warrior CREATOR per §2.4); EMBERHAND now converts neighbors of charged ember (Mage AMPLIFIER per §2.4). |

---

## Section C — Final architecture summary

### C.1 Heroes implemented (15 total — 3 races × 5 roles)

| Race | Element | Heroes | Status |
|---|---|---|---|
| **Pirates** | Fire | THORGAR (Warrior), BLACKTOOTH (Hunter), EMBERHAND (Mage), IRONBELLY (Tank), CRIMSON (Captain) | ✅ All conform to §4 [Fire/Ember] row |
| **Rock Band** | Dark | RIFFBLADE (Warrior), SHRIEK (Hunter), KEYCRYPT (Mage), THUNDERBEAT (Tank), NIGHTLORD (Captain) | ✅ All conform to §4 [Dark/Umbra] row |
| **Sharks** | Frost | RIMEFANG (Warrior), BRINESHOT (Hunter), CRYOMIND (Mage), BULWARK (Tank), ABYSSKING (Captain) | ✅ All conform to §4 [Frost/Tide] row |

Total playable heroes: **15**. Clockwork (locked, post-launch expansion #1) — placeholder in roster, hidden from squad-select per §9 NN #8.

### C.2 Universal infrastructure (block-by-block)

| Layer | Helper / Mechanism | Block |
|---|---|---|
| Captain dual buff | `calcSynergyState` per-captain → `captainDual_*` mirrored globals → `dealDamage` mult stack | B0 (#2.2b) |
| Element gating | `computeActiveElements(heroes?)` → spawn weights + tick-driven side-systems gated | B0 (#2.2c) |
| Encore stacks | `encoreStacks` + `consumeEncoreStacks` (THUNDERBEAT shield-on-proc) | B1 |
| Frost chain segments | `frostChainSegments` + `consumeChainStack` (BULWARK shield-on-segment) | B2 |
| Hero unlock progression | `BOSS_UNLOCKS` map + `applyBossDefeatProgression` hook in `onBossDefeated` | B3 |
| SQUAD_MAX progression | `BOSS_SQUAD_BUMPS` + persistent `SQUAD_MAX_STORAGE_KEY` | B3 |
| Per-hero charges | `heroCharges = {heroId: 0..120}` + `canFireUlt` + `consumeUltCharge` + `getUltCost(heroId)` | B3.2 + B3.3 |
| Hunter universal detonate | `_hunterUltDetonateAllCells(element, baseDmg, ampMult)` × 3 Hunters | B3.4 |
| Boss voice serialization | `playDialogScript` queue (#2.2b) + `BOSS_VOICES` data + `_bossVoiceTrigger` | B3 |
| Boss archetype auras | 5 CSS classes `.boss-archetype-{archetype}` + reduced-motion fallback | B3 |
| Migration | `runMigration_B3` (idempotent, gated by `SQUAD_MAX_STORAGE_KEY` presence) | B3 |
| Synergy bar polish | Horizontal scroll instead of multi-row wrap | B4 |
| Banner escalation | `flashText` `.big` class for cap-moment banners | B4 |

### C.3 Active passive layer (post-B3.6)

| Trigger | What | Who |
|---|---|---|
| Striker auto-fire on combo ≥ minCombo | Direct hit + role-specific board effect | THORGAR / RIFFBLADE / RIMEFANG (warriors); BLACKTOOTH / SHRIEK / BRINESHOT (hunters) |
| Guard auto-fire on stihiya line clear | Shield + utility | IRONBELLY / THUNDERBEAT / BULWARK (tanks) |
| Weaver auto-fire on `placementCount % period === 0` | Period-based passive (mage 12, captain 10) | EMBERHAND / KEYCRYPT / CRYOMIND (mages); CRIMSON / NIGHTLORD / ABYSSKING (captains) |
| Captain dual buff multiplier | Race-mult dmg on `_currentFiringHero.race` matches captain's race | CRIMSON / NIGHTLORD / ABYSSKING |
| `onUmbraCellsCleared` | `encoreStacks += n` (cap 8) | universal Dark element |
| `onTideCellsCleared` | `frostChainSegments += n` (cap 8) | universal Frost element |
| `distributeChargeOnElementClear` | `heroCharges[id] += per-cell-rate` (inverse-scaled by same-element count) | universal — all 5 elements |
| Boss berserker enrage | ×2 attack damage at HP ≤ 50% (one-way) | PYREDRAKE |
| Boss phoenix revive | 60% HP rebirth + 2-turn motif immunity (one-time) | SOLAR PHOENIX |
| Boss attack telegraph | Per-archetype label + cell highlight 1-2 turns before strike | All 5 bosses |
| Boss voice triggers | intro (1.5s after start) + midfight (HP < 50%) + death (final kill) | All 5 bosses |

### C.4 Boss roster + archetype mapping

| Boss | Element | Archetype | Auto-passive |
|---|---|---|---|
| PYREDRAKE | Fire | Berserker | `maybeEnrageBerserker` (×2 dmg @ 50% HP) |
| ABYSSAL TYRANT | Frost | Armored | `armored.special: 'shields'` (70% absorb on hits) |
| GROVEWARDEN | Earth | Bruiser | Default profile (1.5× HP, 8 attack CD) |
| SOLAR PHOENIX | Light | Phoenix | `maybePhoenixRevive` (60% HP rebirth + 2-turn immunity) + legacy `revives:1` |
| CRYPT LICH | Dark | Assassin | Fast-deadly profile (0.7× HP, 4 CD, 1.4× dmg) |

---

## Section D — Plan deviations (amendment log canonical)

Documented in `BLOCKSWORN_MASTER_PLAN_V3.md` §9.1. Summary:

1. **Per-hero charges out-of-Phase-6.** Restored from `archived/phase-4` into Phase 2. Tier system architecture (T1/T2/T3) still deferred to Phase 6.
2. **Per-role ULT costs invert §2.3 ordering.** Active mapping `warrior/tank=80, mage/captain=100, hunter=120` per Roman directive (Hunter is DETONATOR with biggest payoff → highest cost). §2.3 line superseded for v1.
3. **Hunter ULT mass-detonate generalized.** All 3 Hunters detonate ALL cells of their stihiya (×8 cap), not just charged/encore/chain.
4. **Legacy `tickEmberAges` auto-ignition removed.** EMBERHAND fire (Mage AMPLIFIER spread) + THORGAR fire (Warrior CREATOR) + IRONBELLY ULT seed + CRIMSON ULT field — these are now the only ember-charged sources.

---

## Section E — DEBT register (final state)

| ID | Item | Where to address |
|---|---|---|
| **DEBT-014** | FTUE FSM rework | Phase 4 (Onboarding Rebuild) |
| **DEBT-015** | Ember matured visual flash | RESOLVED — auto-mature removed in B3.4, mechanic gone |
| **DEBT-016** | KEYCRYPT/THUNDERBEAT free-encore-token architecture | Phase 3 candidate (signature combos) |
| **DEBT-017** | BULWARK refundPlacement plumbing | Phase 6 (tier system) |
| **DEBT-018** | Shark-emoji onerror fallback for portraits | B4 polish (non-blocking) |
| **DEBT-019** | Full hero-unlock modal w/ card-flip animation | B4 polish (non-blocking) |
| **DEBT-020** | Crypt Lich music shift at <30% HP | Phase 6+ (no music system in v1) |
| **DEBT-021** | Per-archetype telegraph cell highlighting | Phase 3 polish |
| **DEBT-022** | Squad-select tooltips/badges/locked-slot indicator | B4 polish (non-blocking) |
| **DEBT-023** | Parse-time lint check that boss voice scripts include portraitKey | Phase 5 polish |
| **DEBT-024** | `EMBER_CHARGE_AGE` orphan constant cleanup | Phase 5 polish |

DEBT-015 closed in B3.4. DEBT-018 / DEBT-019 / DEBT-022 logged as B4 polish but deferred — current B4 scope was prioritized to focused changes (synergy bar scroll + banner escalation) per Roman scope-pinning.

---

## Section F — Sign-off checklist

JS syntax verified post-each-commit via JavaScriptCore (final size: ~4.39MB parses clean).

Roman manual verification summary (across the 6 hotfix cycles):
- ✅ Voice dialog portraits load correctly post-B3.1
- ✅ Per-hero charge bars work independently post-B3.2
- ✅ Per-role ULT costs visible in toasts (X/80, X/100, X/120) post-B3.3
- ✅ EMBERHAND ignite + Hunter universal detonate work post-B3.4
- ✅ Cascade restored (warrior+mage+hunter passive trigger on placement) post-B3.6
- ✅ THORGAR creates charged + EMBERHAND spreads to neighbors post-B3.6

Block B4 polish (this commit) — Roman to verify:
- Synergy bar fits on a single horizontal row even with many pills (scroll if overflow)
- Cap-moment banners (INFERNO!, SHATTER VOLLEY!, ENCORE-OF-ENCORE!, FLOOD MENDING, DEEP TIDE, PHOENIX REBORN!) render at larger size with stronger glow
- Reduced-motion preference falls back to standard banner size (no dramatic scale animation)

---

## Section G — Tag + merge status

After this commit (B4 + B5 deliverables):
- `phase-2-grammar` HEAD will be the final Phase 2 commit
- Auto-merge into `main` per Roman standing instruction
- Tag `v0.2.0-phase-2-done` placed on the merge commit on `main` so the entire Phase 2 lineage is permanently recoverable via `git checkout v0.2.0-phase-2-done`

Phase 3 (The Moment Mechanics: Signature Combos + Clutch Slow-Mo + Death Flashback) is the next milestone per `BLOCKSWORN_MASTER_PLAN_V3.md` §7. No work in this commit touches Phase 3 territory.

---

## Section H — What Phase 2 delivered

The 4-week Phase 2 work shipped:

1. **HERO_GRAMMAR.md** — 5×5 Element × Role matrix as the canonical hero spec.
2. **15 playable heroes** across 3 factions, each with role-verb-conformant fire + ULT abilities.
3. **Captain dual buff system** — universal §6 mechanic auto-applies for any captain.
4. **Element gating** — `computeActiveElements` ensures elements only activate when in squad or on boss.
5. **Per-hero charge meters** — independent ULT charge per hero, inverse-scaled fill rate, per-role costs.
6. **Hero unlock progression** — Model B (Pirates → Rock Band → Sharks across Bosses 1-4).
7. **SQUAD_MAX progression** — 3→4→5 by Boss 2 + Boss 4.
8. **5 boss archetypes** — distinct visual auras + per-archetype attack telegraph + 15 voice lines.
9. **Boss roster** — Pyredrake (berserker), Abyssal Tyrant (armored), Grovewarden (bruiser), Solar Phoenix (phoenix), Crypt Lich (assassin).
10. **Migration** — idempotent state backfill for existing saves.
11. **B4 polish** — synergy bar scroll, banner escalation, reduced-motion compliance.

Closes the v1 foundation. Next: Phase 3 — The Moment Mechanics.
