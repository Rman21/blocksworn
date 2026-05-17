# Combat Polish — Pre-Execution Readiness Report

**For:** Roman + Engineering Lead before Task 1 kickoff
**Input plan:** `/Users/rm/Downloads/game file/Instructions Game AAA+/combat-polish-implementation-plan.md` (v1.0, 2026-05-13 / activated 2026-05-16)
**Companion docs:** `docs/design/mechanics/combat-mechanics.md`, `docs/design/ui-ux/SYSTEM_MAP.md`
**Created:** 2026-05-16
**Status:** Pre-flight — Task 1 BLOCKED until 4 items resolved (§5)

---

## 1. Plan validation summary

| Plan claim | Verified? | Evidence |
|---|---|---|
| 10 tasks Tier 1 (1-4 MVP) / Tier 2 (5-7 polish) / Tier 3 (8-10 identity) | ✅ | Plan §9-§10 |
| Zero touches to `src/core/*` and `src/data/*` | ⚠️ **Internal contradiction** — see §3 below | Plan §8.2 vs §8.3 |
| All sacred constants cited in §12 exist in code | ✅ All 25+ verified | See §2 grep audit below |
| `--a-{element}` tokens exist in tokens.css | ✅ | [src/styles/tokens.css:219-235](src/styles/tokens.css:219) |
| `RACE_TO_STIHIYA` mapping exists | ✅ | [src/data/races.js:23](src/data/races.js:23) |
| `bossImg` element ID + `.phase-2/.phase-3` classes preserved | ✅ Battle screen DOM `<img id="bossImg">` legacy:17094 + CSS rules legacy:1810 | grep confirmed |
| Element emblem assets exist | ✅ All 5 — but **filenames have spaces not underscores** | `/Users/rm/Downloads/game/elements emblems/` (5 files: dark/water/earth/fire/light) |
| Element background assets exist | ❌ **HARD GAP** — none found | §4 below |
| Boss artwork available for full roster | ⚠️ Partial — ~15 of 25 bosses + chapter-foldered | §4 below |
| Sequencing fits with Phase 5 plan Weeks 6-7 | ⚠️ One overlap point — see §6 | §6 below |

**Bottom line:** plan is implementable as-is with the §3 contradiction resolved, the §4 asset gap closed (CSS-gradient fallback for Task 1, designer commission long-term), the §5 dependencies acknowledged, and the §6 sequencing aligned with Phase 5 Gate 3.

---

## 2. Sacred-cow grep audit suite

Every 🔒 in plan §12 is grep-verifiable. Engineering Lead runs this audit **before merging each task PR**:

### 2.1 Durations
```bash
grep -nE "180.*flash|440.*shake" src/feel/animations.js              # → :92,99
grep -nE "Beat [0-4]" src/feel/animations.js                          # → :11-17 (5-beat doc)
grep -nE "REACTIVITY_TELEGRAPH_MS\s*=\s*3000" src/core/reactivity-events.js  # → :227
grep -nE "ASHEN_REIGN_DURATION_MS\s*=\s*5000" src/data/identity-layer.js     # → :433
grep -nE "ASHEN_REIGN_TELEGRAPH_MS\s*=\s*3000" src/data/identity-layer.js    # → :442
grep -nE "STAGGER_DURATION_TURNS\s*=\s*4" src/core/stagger-loop.js    # → :232
grep -nE "RECOVERY_DURATION_TURNS\s*=\s*2" src/core/stagger-loop.js   # → :233
```

### 2.2 Formulas & values
```bash
grep -n "MAX_HP = 100" src/data/balance.js                            # → :1
grep -nE "PRESSURE_MAX\s*=\s*100" src/core/stagger-loop.js            # → :215
grep -A11 "PRESSURE_GAIN = Object.freeze" src/core/stagger-loop.js    # → all 9 values
grep -nE "FIRE_MULT_(ACTIVE|STAGGER|RECOVERY)_RATIO" src/core/stagger-loop.js  # → :250-252
grep -nE "OVERFLOW_TO_(ULT|ESSENCE|TOWER)" src/core/stagger-loop.js   # → :255-258
grep -A6 "HERO_ULT_COST_BY_NEWROLE" src/data/heroes.js                # → W:80/M:100/H:120/T:80/C:100
grep -nE "REACTIVITY_PHASE_GATES\s*=\s*Object.freeze\(\[70, 35\]" src/core/reactivity-events.js  # → :234
grep -A6 "BOSS_TTK_TARGETS = Object.freeze" src/data/bosses.js        # → :31-37
grep -A6 "EXPECTED_DPS_BY_CHAPTER = Object.freeze" src/data/bosses.js  # → :42-48
grep -nE "TOWER_DPS_REFERENCE\s*=\s*280" src/data/bosses.js
```

### 2.3 Damage channels
```bash
grep -nE "CH_(DEAD_ZONE|VOID|SIGNATURE|GRID_SATURATION)" src/core/damage-channels.js  # → :157-160
grep -nE "CHANNEL_VOID_TICK_PCT\s*=\s*0\.005" src/core/damage-channels.js             # → :165
grep -nE "CHANNEL_GRID_SATURATION_(THRESHOLD\s*=\s*0\.75|DMG\s*=\s*8)" src/core/damage-channels.js  # → :166,167
grep -nE "CHANNEL_DEADZONE_DMG\s*=\s*5" src/core/damage-channels.js   # → :164
grep -nE "MITIGATION_CAP\s*=\s*0\.70" src/core/damage-channels.js     # → :183
```

### 2.4 Identity layer HARD CAPS
```bash
grep -nE "PIRATE_PLUNDER_(GOLD_PER_CELL\s*=\s*5|MAX_COINS\s*=\s*32)" src/data/identity-layer.js  # → :167,169
grep -nE "SHARK_FRENZY_(MIN_SHARKS_FOR_2X_TRIGGER\s*=\s*2|MAX_EXTRA_CELLS\s*=\s*4)" src/data/identity-layer.js  # → :197,198
grep -nE "ROCK_ECHO_MAX_CHARGE_PER_FIRE\s*=\s*4" src/data/identity-layer.js  # → :239
grep -nE "CROCODILE_BASTION_(FRAGMENTS_PER_SHIELD\s*=\s*5|MAX_FRAGMENT_PARTICLES\s*=\s*16)" src/data/identity-layer.js  # → :297,298
grep -nE "SPARK_CASCADE_(MIN_SOLAR_CELLS\s*=\s*2|MAX_DOMINANT_BOOST\s*=\s*1)" src/data/identity-layer.js  # → :372,373
grep -E "BERSERKER_ENRAGE_MULT" src/data/identity-layer.js            # confirms 2.0
grep -nE "CURSED_TILES_(COUNT\s*=\s*3|TURNS_UNTIL_AUTO_CLEAR\s*=\s*3)" src/data/identity-layer.js  # → :521,522
grep -nE "ASHEN_REIGN_FLAME_BORDER_WIDTH_PX\s*=\s*180" src/data/identity-layer.js  # → :434
```

### 2.5 Element & color constants
```bash
grep -n "STIHIYAS = Object.freeze" src/data/elements.js              # → :14
grep -A1 "STIHIYA_COLORS = Object.freeze" src/data/elements.js       # → :16 (5 hex codes)
grep -nE "^\s*--a-(ember|tide|grove|solar|umbra):" src/styles/tokens.css  # → :219-228 (×2 for lt variants)
grep -E "ROOT_SURGE_OVERLAY_COLOR.*2D8659" src/data/identity-layer.js  # → :853
grep -E "B87333" src/data/identity-layer.js                          # Engineer copper
```

### 2.6 Per-PR audit command (cumulative)
```bash
# Run this against the git diff of each Combat Polish task PR:
git diff origin/main -- src/core/ src/data/ src/services/ | wc -l    # Should be 0 for §8.3 compliance
git diff origin/main -- src/feel/ src/styles/ src/ui/                # Should contain ONLY new files or additive lines
```

---

## 3. Internal plan contradiction — `src/core/battle.js` mount calls

### 3.1 The contradiction

Plan §8.2 (Files modified additive only):
> `src/feel/animations.js` ← Tasks 7, 9 — extend existing FX, do not remove
> `src/feel/identity-fx.js` ← Task 8 — polish race FX visuals only

Plan §8.3 (Files NEVER touched):
> `src/core/*` ← Game logic — sacred
> `src/data/*` ← Constants — sacred (CLAUDE.md §2)
> `src/services/*` ← Backend integrations — out of scope

Plan §8.5 (JS feel-layer organization):
> Battle screen orchestrator (`src/core/battle.js`) calls these at the existing lifecycle points (`startBattle`, `playerTurn`, `exitBattle`). The orchestrator changes are minimal — only swapping component mount calls.

And in each individual task (1-4) under "Files":
> Modified: `src/core/battle.js` (mount call only — no logic changes)

**The §8.3 "NEVER touched" rule contradicts the §8.5 + per-task "mount call only" allowance.**

### 3.2 Recommended resolution (CTO proposal — Roman confirms)

Three options, in preference order:

**Option A (recommended) — Use `src/ui/battle-screen.js` for mount wiring**

[src/ui/battle-screen.js](src/ui/battle-screen.js) already exists (375 lines), already has `setupBattleScreenEventListeners()` and `cleanupBattleScreen()` exports. These were designed exactly for this purpose during Phase 1 T1.11. Combat Polish mount calls land here, NOT in `src/core/battle.js`.

- Pros: keeps §8.3 invariant strict; ui/ is correct architectural home for view wiring
- Cons: requires verifying `src/ui/battle-screen.js` is called from the right lifecycle points; may need to add 1 line to battle.js to invoke setup at startBattle (still a "core" touch but trivially scoped)

**Option B — Allow `src/core/battle.js` mount-call-only edits with strict audit**

Define mount-call-only as: file diff contains ONLY new function calls (`mountBossScene()`, etc) at existing call sites, no constant changes, no formula changes, no logic mutation. Each PR diff manually inspected.

- Pros: matches what the plan currently says
- Cons: weakens §8.3 invariant; relies on PR review discipline (which Phase 4.1 incident showed is fallible without engineering lead)

**Option C — Use src/main.js boot chain**

Mount components from `src/main.js` (the Vite entry), keying off route activation events.

- Pros: most architecturally pure (orchestration in entry, not core)
- Cons: introduces another file in the call chain; less coupled to battle lifecycle so may have timing issues

**CTO recommendation:** Option A. Tested architecturally during Phase 1; ui/ is correct home; preserves §8.3 verbatim.

**Roman decision needed before Task 1.**

---

## 4. Asset inventory — element backgrounds RESOLVED 2026-05-16

### 4.1 Roman ruling (2026-05-16)

> "1. Option A | 2. yes | 3. backgrounds here `/Users/rm/Downloads/game file/assets/backgrounds`"

### 4.2 Verification result (post-ruling)

```bash
ls "/Users/rm/Downloads/game file/assets/backgrounds"
# dark background.png    1.39 MB    941 × 1672 (≈9:16)
# earth background.png   1.42 MB    941 × 1672
# fire background.png    1.46 MB    941 × 1672
# frost background.png   1.40 MB    941 × 1672
# light background.png   1.46 MB    941 × 1672
# Total: ~7.13 MB (within ≤7.5 MB plan §3 perf budget; each within ≤1.5 MB cap)
```

All 5 element backgrounds **CONFIRMED PRESENT** with correct aspect ratio (941 × 1672 = 1:1.78 ≈ 9:16 portrait per plan §4) and within performance budgets (1.39-1.46 MB each, ≤1.5 MB cap).

### 4.3 Element-to-file mapping

| Element key (code) | Background file | Plan §4 theme description |
|---|---|---|
| ember | `fire background.png` | Lava field with mountains, glowing cracks |
| tide | `frost background.png` | Icy mountains, snow, blue mist |
| grove | `earth background.png` | Forest path with light rays through trees |
| solar | `light background.png` | Golden temple with stairs to throne |
| umbra | `dark background.png` | Purple ruins with stone path, wisps |

### 4.4 Bundling step (TASK-CP-001 sub-step)

Files live outside the worktree (in parent project dir `/Users/rm/Downloads/game file/assets/backgrounds/`). For production deploy they must be copied into the build artifact:

```bash
# TASK-CP-001 build-step:
mkdir -p public/assets/backgrounds
for elem in dark earth fire frost light; do
  cp "/Users/rm/Downloads/game file/assets/backgrounds/${elem} background.png" \
     "public/assets/backgrounds/${elem}_background.png"   # rename: space → underscore
done
# Result: 5 files committed to repo at public/assets/backgrounds/ totaling 7.13 MB
```

The space→underscore rename normalizes to plan §4.2's canonical naming (`fire_background.png` etc).

**Bundle size impact:**
- Current modular bundle: 94 KB gzipped JS+CSS
- +7.13 MB raw PNGs (media exempt from CI 5MB JS+CSS gate per Phase 1 ruling)
- Lazy-load opportunity: load only the current battle's boss element background, not all 5 (saves ~5.7 MB on first paint)
- TASK-CP-001 implements lazy strategy via `element-assets.js` loader (only load on-demand per BOSS.element)

### 4.5 Decision log

| Originally proposed | Resolution |
|---|---|
| Option α (CSS gradient interim) | NOT NEEDED — real backgrounds available |
| Option β (commission, $1-2k) | ALREADY COMMISSIONED — assets in hand 2026-05-16 |
| Option γ (use boss artwork backdrops) | NOT NEEDED |

R29 in `04_RISK_REGISTER.md` **CLOSED 2026-05-16**.

### 4.6 Element emblem filename mismatch (minor — unchanged from earlier)

Plan §4.2 references:
```
fire_emblem.png, water_emblem.png, earth_emblam.png, light_emblem.png, dark_emblem.png
```

Actual filenames at `/Users/rm/Downloads/game/elements emblems/` (with SPACES, no underscores):
```
fire emblem.png
water emblem.png
earth emblam.png   ← "emblam" typo preserved (verified in both plan and file)
light emblem.png
dark emblem.png
```

**Resolution:** asset-bundling step at Task 5 renames spaces → underscores when copying to `public/assets/icons/elements/` (or wherever lands). Plan's filename convention becomes the production canonical.

### 4.6 Boss roster vs artwork map

Plan §4 §17 references 25 bosses across Ch1-Ch5. Available artwork (`/Users/rm/Downloads/game/`):

| Boss (code roster, code name) | Element | Artwork found? |
|---|---|---|
| Pyredrake (Ch1 tutorial — sacred reactivity berserker_p1) | ember | ✅ `boss/chapter 1/1 Fire Pirate Boss.png` (maybe — needs Designer match check) OR `Game bosses/3 boss phoenix.png` |
| Solar Phoenix | solar | ✅ `Game bosses/3 boss phoenix.png` |
| Crypt Lich | umbra | ✅ `Game bosses/3 boss lich.png` |
| Grovewarden | grove | ✅ `Game bosses/3 Boss treant.png` (treant = grovewarden's internal name?) |
| Abyssal Tyrant | tide | ⚠️ check `boss/chapter 2 elements boss/3 Elemental water boss final.png` |
| Verothira / Gearheart / Ursaro / Tidespire / Heliotron / Twilight Vessel / Stormshepherd / Voidpriestess / Root-of-Nothing / Archival Eternal / The Prosecutor / Justice Blind / Sun-Crown Regent / Eclipse-Walker / The Fallen Highest / Crown-of-Dust / Shardlord | various | ❓ Designer audit Week 2 (TASK-UX-002 closes this gap) |
| Game bosses extras (dragon / kraken / fire bear / dark plant / earth trash / frost wave / light beaver) | various | ✅ likely for Tower archetype bosses; Designer maps |
| `new boss/` folder | ❓ | ❓ Designer audits |

**Status:** boss artwork ~60% complete for known roster. TASK-UX-002 (asset library audit) is the formal closure step. Combat Polish Task 1 can ship with current artwork + fallback strategy for missing bosses.

---

## 5. Pre-Task-1 dependencies

Resolved (2026-05-16 Roman ruling):

1. ✅ **§3 mount-call location** — **Option A**: mount via `src/ui/battle-screen.js`, NOT `src/core/battle.js`. §8.3 NEVER-touched invariant preserved verbatim.
2. ✅ **§4 element backgrounds** — assets in hand at `/Users/rm/Downloads/game file/assets/backgrounds/` (5 files, 941×1672, ~7.13 MB total). Bundling step in TASK-CP-001 copies to `public/assets/backgrounds/` with space→underscore rename. R29 CLOSED.

Still pending (do NOT start TASK-CP-001 until all green):

3. ⏳ **Engineering Lead onboarded** (Phase 5 Week 0-2 per ADR-005; lead reviews this readiness doc + signs off Task 1 brief)
4. ⏳ **Designer's Tier S Figma spec for Boss Scene delivered** (Phase 5 Week 3 end per Polish Strategy §6.3 — "ALL Tier S screens spec'd in Figma" precondition for Week 6 implementation)
5. ⏳ **Phase 5 Gate 1 passed** (6 golden-path smoke tests green + save migration framework tested — see §6 sequencing)
6. ⏳ **Phase 5 Gate 3 passed** (Vite migration cutover complete — Combat Polish renders on the migrated runtime)

---

## 6. Sequencing alignment with Phase 5 plan

### 6.1 Phase 5 plan (ADR-005) week-by-week

| Phase 5 Week | Engineering | Designer (parallel) |
|---|---|---|
| Week 0-1 | Eng Lead hire + onboard; Designer hire | Designer hire + onboard (TASK-UX-001) |
| Week 1 | 6 golden-path smoke tests + save migration framework | Designer audit (TASK-UX-001 sign-off) |
| Week 2-3 | Vite migration sprint | Audit + design system (TASK-UX-002, TASK-UX-003) |
| Weeks 3-5 | Migration completion + staging | Asset push + screen specs (TASK-UX-004, TASK-UX-005, TASK-UX-006) |
| Week 5 | Production cutover (Gate 3) | Final spec delivery |
| **Weeks 6-7** | **Combat Polish Tasks 1-4 (MVP) + Tasks 5-7 (polish)** | Implementation support (TASK-UX-007) |
| Week 8 | Combat Polish Tasks 8-10 (identity) + final pass | Device matrix QA + sign-off (TASK-UX-008) |
| Weeks 9-12 | T4.11 closed beta with full polish | (Designer monitors + iterates from beta feedback) |
| Week 13 | T4.12 production launch | — |

### 6.2 Combat Polish 10 tasks → Phase 5 week mapping

| Combat Polish task | Phase 5 week | Notes |
|---|---|---|
| Task 1 (composition + boss scene) | Week 6 Day 1-3 | BLOCKING for 2-4; depends on Vite migration Gate 3 (Week 5) |
| Task 2 (hero card) | Week 6 Day 4-7 | parallel-OK with 3, 4 |
| Task 3 (top HUD) | Week 6 Day 4-7 | parallel-OK |
| Task 4 (pressure meter) | Week 6 Day 4-7 | parallel-OK; MVP gate at end of Week 6 |
| Task 5 (element emblems) | Week 7 Day 1-3 | depends on MVP gate |
| Task 6 (damage channels) | Week 7 Day 1-3 | parallel-OK with 5, 7 |
| Task 7 (Stagger FX) | Week 7 Day 1-3 | parallel-OK; polish gate at end of Week 7 |
| Task 8 (race FX × 6) | Week 8 Day 1-5 | depends on polish gate; biggest single block |
| Task 9 (boss death cinematic) | Week 8 Day 3-5 | parallel-OK with 8 last days |
| Task 10 (reactivity events × 22 + 5 bosses) | Week 8 Day 4-7 | identity-complete gate at end of Week 8 → beta ready |

**Total Combat Polish execution window: Weeks 6-8 (3 weeks, 21 calendar days).** Matches Phase 5 Polish Strategy §6.1.

### 6.3 Critical-path watchpoints

- **End of Week 5 Gate 3 (Vite migration complete)** — Combat Polish absolutely depends on this. If migration slips, Combat Polish Weeks 6-8 slip accordingly. Beta Week 9 either delays or ships without identity-level polish (Tasks 8-10 deferred).
- **End of Week 5 Designer Figma handoff** — if Designer's Tier S spec is incomplete, Eng Lead can't start Task 1 on schedule. Polish Strategy §6.3 explicit critical handoff.
- **End of Week 6 MVP gate** — game looks new even if not yet polished. Bug Tester does first integration cycle here.
- **End of Week 8 identity-complete gate** — final sign-off from Designer + Bug Tester for T4.11 beta release.

---

## 7. Files-to-create scaffold (Task 1)

Pre-flight: confirm none of these conflict with existing files.

```bash
# Verify Task 1 file targets don't exist yet:
ls src/feel/battle-layout.css 2>/dev/null || echo "TASK1: battle-layout.css OK to create"
ls src/feel/boss-scene.js 2>/dev/null || echo "TASK1: boss-scene.js OK to create"
ls src/feel/boss-scene.css 2>/dev/null || echo "TASK1: boss-scene.css OK to create"
ls src/feel/element-assets.js 2>/dev/null || echo "TASK1: element-assets.js OK to create"
```

All 4 paths confirmed empty (none exist as of 2026-05-16).

**Task 1 boot wiring (per §3 Option A recommendation):**
- `src/ui/battle-screen.js:setupBattleScreenEventListeners()` adds `mountBossScene(rootEl)` call
- `src/ui/battle-screen.js:cleanupBattleScreen()` adds `destroyBossScene()` call
- No edit to `src/core/battle.js`

---

## 8. Open questions — status 2026-05-16

| # | Question | Status |
|---|---|---|
| 1 | §3 mount-call location | ✅ **RESOLVED** Roman 2026-05-16: Option A (`src/ui/battle-screen.js`) |
| 2 | §4 asset strategy | ✅ **RESOLVED** Roman 2026-05-16: backgrounds in hand at `/Users/rm/Downloads/game file/assets/backgrounds/` (5 files, 7.13 MB) |
| 3 | Background asset budget | ✅ **N/A** — assets pre-commissioned, no incremental cost |
| 4 | Engineering Lead status | ⏳ open — Roman owns hiring (Phase 5 Week 0-2 onboarding deadline) |
| 5 | Designer status | ⏳ open — Roman owns hiring; Tier S Figma spec must be delivered end of Phase 5 Week 5 to unblock TASK-CP-001 |
| 6 | Boss artwork roster gap | ⏳ open — CTO-recommended closure via Designer's TASK-UX-002 audit Week 2-3 unless Roman directs alternate path |
| 7 | `new boss/` folder content | ⏳ open — Designer audit consumes during TASK-UX-002 |
| 8 | Mythic ceremony scope | ⏳ open — CTO read: belongs to a separate menu-level Tier S workstream, not Combat Polish (battle-level only) |

---

## 9. Status

| Item | State |
|---|---|
| Plan read + validated | ✅ DONE 2026-05-16 |
| Sacred constants grep audit suite | ✅ documented §2 |
| §3 internal contradiction | ✅ **RESOLVED 2026-05-16** — Option A (mount via `src/ui/battle-screen.js`) |
| §4 asset gap | ✅ **RESOLVED 2026-05-16** — backgrounds at `/Users/rm/Downloads/game file/assets/backgrounds/` (5 files verified) |
| TASKS.md placeholders registered | ✅ TASK-CP-001..010 (see TASKS.md) |
| PLAN.md updated for Phase 5 Weeks 6-8 sub-roadmap | ✅ |
| Risk register R29 (asset gap) | ✅ CLOSED 2026-05-16 |
| Risk register R30 (migration-slip cascade) | ⏳ active until Phase 5 Gate 3 |
| File-to-create scaffolds verified non-conflicting | ✅ §7 |
| Open questions enumerated | ✅ §8 (2 resolved, 5 pending non-blocking, 1 needs hiring) |

**Remaining blockers to TASK-CP-001 start (all in Roman / hiring critical path):**

1. Engineering Lead onboarded
2. Designer onboarded + Tier S Figma Boss Scene spec delivered (Phase 5 Week 5 end)
3. Phase 5 Gate 1 passed (golden paths green + save migration framework)
4. Phase 5 Gate 3 passed (Vite migration cutover)

When all 4 above are green, Engineering Lead opens TASK-CP-001 with detailed `━━ ЗАДАЧА ━━` block referencing this readiness doc; CTO reviews against sacred-cow grep suite (§2); implementation begins per §6.2 schedule (Phase 5 Week 6 Day 1).

---

**Document version:** 1.0
**Maintainer:** CTO
**Last updated:** 2026-05-16
**Companion:** [combat-polish-implementation-plan.md](../../Instructions Game AAA+/combat-polish-implementation-plan.md) (Roman authored)
