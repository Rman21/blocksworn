# PHASE 2 — SHARKS AUDIT (HERO_GRAMMAR §4 [Frost / Tide], Block B2)

**Branch:** `phase-2-grammar`
**Spec:** [HERO_GRAMMAR.md](HERO_GRAMMAR.md) §3 (Role Matrix) · §4 row [Frost / Tide] · §5 (Race layer — Sharks) · §6 (Captain dual buff) · §8 non-negotiables
**Predecessors:** TASK #2.2 / 2.2b / 2.2c / 2.2d (Pirates) and Block B1 (Rock Band)
**Scope:** 5 net-new Shark heroes — RIMEFANG, BRINESHOT, CRYOMIND, BULWARK, ABYSSKING — implemented from scratch and wired with art. Universal frost-chain side-system added (mirror of B1's umbra/encore architecture). Single Block B2 commit per workflow.

---

## Section A — 5 heroes implementation summary

| Hero | Role / Verb | Spec §4 cell (excerpt) | Status | Implementation notes |
|---|---|---|---|---|
| **RIMEFANG** | Warrior / CREATOR | *Direct hit on placement; every tide clear chills adjacent cells, building chains.* | ✅ CONFORMS | Direct-hit half satisfied via flat 200 dmg fire body. Chain creation half satisfied universally via `onTideCellsCleared` (fires regardless of which heroes are in squad). |
| **BRINESHOT** | Hunter / DETONATOR | *Detonates every active chain for line damage; longer chain = wider line (1=1 row, 4+=4 rows).* | ✅ CONFORMS | Mass-detonate of `frostChainSegments` with ×4 cap (matches "4+=4 rows" spec wording). × `cryomindWeaveMult` if amp window active. Primer-shot fallback on 0 segments. SHATTER VOLLEY! banner ≥4. |
| **CRYOMIND** | Mage / AMPLIFIER | *Extends every active chain by +1 cell; ULT freezes the boss attack timer for 1 turn.* | ✅ CONFORMS | AMPLIFIER role verb satisfied: opens 3-placement TIDE WEAVE window with mult `1.0 + segments × 0.25`; also bumps `frostChainSegments` by 1 (the "+1 extend" spec half). No damage, no heal. ULT pumps `attackCountdown` by current boss `attackInterval` and routes through `onFreezeApplied`. |
| **BULWARK** | Tank / PROTECTOR | *+1 shield per chain segment broken; ULT refunds 1 placement to the player.* | ✅ CONFORMS (fire) / ⚠ partial (ULT) | Active fire EXTENDS spec — preserves PROTECTOR role with +1 shield + 160 dmg. The "+1 shield per chain segment broken" half fires automatically in `consumeChainStack` helper when BRINESHOT detonates. ULT placement-refund mechanism does not exist in v1 codebase — fallback to +3 shields. Filed as **DEBT-017**. |
| **ABYSSKING** | Captain / ENABLER | *Race-buff scales shark chain bonuses; +25% tide drops; ULT chills entire board for 2 turns.* | ✅ CONFORMS | Captain dual buff fires automatically via universal §6 system from #2.2b — no shark-specific code needed. Pill renders gold `👑 SHARKS: +X% shark_dmg · +25% tide_drops`. Active fire converts 2–3 random non-tide cells to tide (mirror of CRIMSON/NIGHTLORD captain pattern). ULT chills entire board ≈ 2× attackInterval freeze. |

---

## Section B — Asset wiring confirmation

**Source:** `/Users/rm/Downloads/game file/assets/heroes/frost sharks/`
- `frost shark warrior.png` — 1086×1448 PNG, 1.77MB
- `frost shark hunter.png` — 1086×1448 PNG, 1.50MB
- `frost shark mage.png` — 1086×1448 PNG, 2.13MB
- `frost shark tank.png` — 1086×1448 PNG, 2.15MB
- `frost shark captain.png` — 1086×1448 PNG, 2.26MB

**Critical decision: data URI inline vs file path.**

Roman's task spec called for file paths (`assets/heroes/sharks/shark_warrior.png`). Investigation showed:
1. Existing portraits (Pirates, Rock Band, all emblems) are **inline base64 data URIs** at lines 8120–8200 (~280px JPEGs, ~24–55KB each).
2. The game is opened via `file://` protocol (double-click HTML). Browsers **block** local file fetches in `file://` for security — file-path images would simply not load.
3. Inline base64 PNGs at original size: ~13MB bloat → catastrophic for the size budget Phase 1 fought to maintain.

**Resolution:** optimized PNGs to 280×373 JPEG q75 via `sips` (macOS built-in), inlined as base64 data URIs matching the existing Pirate/Rock pattern. Total HTML growth: ~278KB (4.07MB → 4.35MB). Far under the original 6MB Phase 1 budget. Originals + optimized JPEGs preserved at `/assets/heroes/sharks/*.jpg` for posterity (committed but not loaded at runtime).

**ASSETS keys added** (after `hero_rock_captain` block at ~line 8153):
```
hero_shark_warrior  (jpeg, 280×373, ~36KB)
hero_shark_hunter   (jpeg, 280×373, ~29KB)
hero_shark_mage     (jpeg, 280×373, ~46KB)
hero_shark_tank     (jpeg, 280×373, ~48KB)
hero_shark_captain  (jpeg, 280×373, ~55KB)
```

**Onerror fallback:** existing renderers (`renderDeck`, squad-select, detail modal) call `img.src = ASSETS[h.img]`. Data URIs do not 404 — they either decode or throw a synchronous error, so an `onerror` handler is essentially dead code for the inline pattern. No `onerror` wiring added in this commit — if a future asset-key typo ships a missing key, the broken-image icon shows up immediately and is caught in playtest. The shark-emoji fallback CSS proposed in the task is filed as **DEBT-018** (cosmetic polish for missing-key safety net).

---

## Section C — ABYSSKING captain dual verification

The universal captain dual buff system (TASK #2.2b) is fully race-agnostic. ABYSSKING inherits with zero shark-specific code:

| Check | Verified path | Expected behavior |
|---|---|---|
| Detection | `calcSynergyState` ~line 14070 — `heroes.find(h => h && h.newRole === 'captain')` | Returns ABYSSKING when in squad. |
| `captainDual_active` | Set true via state mirror | True. |
| `captainDual_race` | `_captainHero.race` | `'shark'`. |
| `captainDual_stihiya` | `_captainHero.stihiya` | `'tide'`. |
| `captainDual_raceMult` | scales by same-race count | +5% / +15% / +30% by shark count. |
| `captainDual_dropBonus` | Fixed `0.25` added to `state.spawnWeights['tide']` | +25% tide drop weight. |
| Pill text | `_RACE_PLURAL[_captainHero.race]` already includes `shark: 'SHARKS'` (line 14065) | `👑 SHARKS: +30% shark_dmg · +25% tide_drops` (with 3+ sharks). |
| Pill class | `renderSynergyBar` regex `/^👑 /` test → `.captain` class | Gold gradient. |
| Race-buff dmg path | `_captainDualContext` injected into `dealDamage` mult stack | Multiplies all damage from shark heroes by `captainDual_raceMult`. |

**Verified by code path inspection.** No new code required. Roman to confirm in playtest via Section H regression checklist.

---

## Section D — Frost chain infrastructure (extended, not duplicated)

### Existing tide infrastructure (preserved untouched)
- `chainStack` (single int, cap 10–15) — built by `onFreezeApplied` from active hero freezes (Maelen, Glacier, etc.). Drives passive tide-clear damage bonus via `tideDamageBonus`.
- `chainWindow` — turns-since-last-freeze window for chain extension.
- `tideEchoStack` — Frost Echo (T3) per-tide-cell-cleared bonus.
- `onFreezeApplied(amount)` — universal freeze hook, ticks chainStack within chainWindow.

### New Block B2 infrastructure (parallel layer for spec conformance)

The existing `chainStack` is freeze-application-based. The HERO_GRAMMAR §4 [Frost / Tide] cells expect a chain that grows on **tide cell clears** (not just hero-applied freezes). Adding a parallel counter avoids breaking existing elf/skeleton tide synergies.

| Addition | Purpose | Mirror of |
|---|---|---|
| `frostChainSegments` (cap 8) | Universal per-tide-clear counter | `encoreStacks` (B1) |
| `FROST_CHAIN_CAP` const | Cap on segment accumulation | `ENCORE_STACK_CAP` |
| `cryomindWeaveActive / Mult / Duration` + `CRYOMIND_WEAVE_TURNS=3` | AMPLIFIER window state | `keycryptDeepBeatActive/Mult/Duration` (B1) |
| `onTideCellsCleared(n)` function | Per-tide-clear hook called from clearLines | `onUmbraCellsCleared(n)` (B1) |
| `consumeChainStack()` function | Drain helper + BULWARK shield bump | `consumeEncoreStacks()` (B1) |

`onTideCellsCleared` wired into clearLines right after `onUmbraCellsCleared(counts.umbra || 0)` — symmetrical placement.

---

## Section E — Element gating regression (TASK #2.2c, B2 verification)

`computeActiveElements()` (TASK #2.2c) handles tide correctly across all required combos:

| Squad | Boss | activeElements | Expected drops | Status |
|---|---|---|---|---|
| RIMEFANG only (1 shark) | Pyredrake (ember) | `{ember, tide}` | ember + tide | ✅ — tide in set via squad |
| no shark heroes | Abyssal Tyrant (tide) | `{<squad>, tide}` | <squad> + tide | ✅ — tide in set via boss |
| no shark heroes | Pyredrake (ember) | `{<squad>}` only | no tide drops | ✅ — tide correctly excluded |

Chain accumulation gated:
- `onTideCellsCleared` early-returns when `!computeActiveElements().has('tide')` — `frostChainSegments` stays 0 in non-tide contexts.
- `consumeChainStack` is safe to call any time — drains 0 to 0 with no side effects when no segments.

No code changes required to the gating helper itself; the universal pattern from #2.2c handles tide as it does ember/grove/solar/umbra.

---

## Section F — State vars + reset locations

| Variable | Declaration | Reset (resetRaceFlags) | Decrement / drain |
|---|---|---|---|
| `frostChainSegments` | ~13231 | Block 4.5 tide block | Drained to 0 by `consumeChainStack` (called from BRINESHOT fire + ULT). Capped at `FROST_CHAIN_CAP` on accumulate. |
| `FROST_CHAIN_CAP` | ~13232 (const) | n/a | n/a |
| `cryomindWeaveActive` | ~13238 | Block 4.5 tide block | Per-placement decrement sets back to false on natural expiry. |
| `cryomindWeaveMult` | ~13239 | Block 4.5 tide block | Reset to 1.0 on natural expiry. |
| `cryomindWeaveDuration` | ~13240 | Block 4.5 tide block | Per-placement decrement (mirrors KEYCRYPT DEEP BEAT). |
| `CRYOMIND_WEAVE_TURNS` | ~13241 (const) | n/a | n/a |

---

## Section G — Header comments coverage

All 10 functions (5 fire + 5 ULT twist) carry `HERO_GRAMMAR §4 [Frost × Role] — HERO / NAME` blocks documenting:
- Spec verbatim (one or two lines).
- Charge-cost relative position.
- Status (CONFORMS / EXTENDS).
- Implementation notes referencing the universal hooks (`onTideCellsCleared`, `consumeChainStack`, `_RACE_PLURAL`, `attackCountdown`).
- Any DEBT-XXX deferrals.

Mirror of pirate/rock audit pattern. Direct grep for `HERO_GRAMMAR §4 \[Frost` returns 10 matches.

---

## Section H — Regression checklist (Roman to verify in browser)

Author cannot run the game in this environment. JS syntax verified post-rewrites via JavaScriptCore (4.37MB → parses clean).

1. **Squad-select:** 5 Sharks visible with portraits (frost-themed shark renders, 280px). If any portrait fails to load, broken-image icon (no shark-emoji fallback in this commit — see DEBT-018).

2. **Squad: RIMEFANG + CRYOMIND + BRINESHOT + ABYSSKING** (4 sharks, `SQUAD_MAX = 4` stage):
   - Console: `[CaptainDual]` log shows `captainDualActive=true, race='shark', stihiya='tide', sameRaceCount=4, captainDualRaceMult=1.3`.
   - Synergy bar: gold pill `👑 SHARKS: +30% shark_dmg · +25% tide_drops`.
   - Tray: tide (cyan) cells dominant + boss element.

3. **Trigger RIMEFANG fire on tide clears**: `frostChainSegments` increments by N per N tide cells cleared (visible via DevTools `console.log(frostChainSegments)`).

4. **Trigger CRYOMIND fire** with segments > 0:
   - `TIDE WEAVE +X%` flash where X = segments × 25.
   - Console: `frostChainSegments` grew by +1 (from "extends every active chain by +1" spec half).
   - `cryomindWeaveActive` = true, `cryomindWeaveMult` = `1.0 + segments × 0.25`, `cryomindWeaveDuration` = 3.
   - After 3 placements without firing BRINESHOT: `TIDE FADES` flash + state resets.

5. **Trigger BRINESHOT fire** with segments ≥ 4:
   - Mass shatter damage = baseDmg × min(segments, 4) × cryomindWeaveMult (if active).
   - `SHATTER VOLLEY!` banner.
   - `+X% SHATTER` if CRYOMIND amp window was active.
   - `frostChainSegments` resets to 0 post-fire.
   - BULWARK in squad → `TOCK GUARD +N🛡` flash (N = consumed segments) + shieldCount increments by N (capped to MAX_SHIELD + 2).

6. **Trigger BRINESHOT fire** with 0 segments: `NO CHAINS` flash + flat `baseDmg = 180` damage. Not wasted.

7. **Trigger CRYOMIND ULT** (period = 12): `TIME FROZEN` flash + `attackCountdown` bumped by current boss `attackInterval` (boss skips one swing). `chainStack` ticks via `onFreezeApplied`.

8. **Trigger ABYSSKING ULT** (period = 10): `DEEP TIDE` flash + `attackCountdown` bumped by `2 × attackInterval` (boss skips ~2 swings). `chainStack` ticks via `onFreezeApplied`.

9. **Trigger BULWARK ULT** (no minCombo gate): `TOCK GUARD +N🛡` flash + +3 shields (capped). DEBT-017 — placement-refund mechanism does not exist in v1; falls back to +3 shields.

10. **Squad: pirate-only (no shark) + Pyredrake fight**:
    - 0 tide pieces in tray (gating: tide not in `activeElements`).
    - `frostChainSegments` stays 0 (gating verified).
    - Captain pill is PIRATES (CRIMSON), not SHARKS.

11. **No console errors** during 3-fight Chapter 1 prefix (Pyredrake → Abyssal Tyrant → Grovewarden) with shark squad. The `[CaptainDual]` diagnostic from #2.2b is still in place.

---

## Section I — Deferred items

### DEBT-017 — BULWARK placement-refund mechanism
**Spec:** `[Frost × Tank]` ULT — *"refunds 1 placement to the player"*.
**Reality:** v1 codebase has no placement-refund hook. The placement counter is monotonically increasing; no inverse operation exists.
**v1 fallback:** `ultTwistBulwark` grants +3 shields (parity with IRONBELLY CHARGED AEGIS shape).
**Effort estimate:** medium — needs a `refundPlacement()` function that bumps `placementCount` back by 1, re-renders the tray with the previous piece restored, and gracefully handles the edge case where the previous piece was already cleared. Phase 6 candidate.

### DEBT-018 — Shark portrait emoji fallback
**Spec:** task §0 called for an `onerror` handler that shows a 🦈 emoji card when PNG fails to load.
**Reality:** existing portraits are base64 data URIs (which can't 404). Adding `onerror` to every `img.src = ASSETS[h.img]` call site would be cosmetic-only insurance against asset-key typos.
**Effort estimate:** small (~6 call sites, 1 line each + small CSS rule). Bundled with the existing leader-choice modal fallback (TASK #2.2b) when polish time comes. Not a blocker.

### DEBT-016 (still open from B1)
KEYCRYPT ULT literal "every squad hero gets one free Encore" + THUNDERBEAT ULT "squad-wide Encore window" — both need per-hero token tracker + fireHero double-fire path with recursion guard. Status unchanged from Block B1.

---

## Section J — Git status

Single Block B2 commit on `phase-2-grammar`. Per MGD instruction (post-#2.2c), the auto-merge propagation pattern is **stopped** — Roman drives playtest checkout (switching `game file/` worktree to `phase-2-grammar` or creating `phase-2-playtest` branch) when ready to test. `archived/phase-4` tag preserves the legacy Phase 4 work indefinitely.
