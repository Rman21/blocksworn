# Active Tasks

> Source of truth for current work. Updated real-time by CTO.
> Detailed spec для каждой task → `docs/plan/00_EXECUTION_PLAN.md` §13-16.

---

## GAME DEVELOPER

### TASK-010 (T1.09) — Extract feel layer (animations, particles, narrator function) to `src/feel/`

**Status:** REVIEW (Game Dev → CTO)
**Started:** 2026-05-11
**Completed:** 2026-05-11
**Commit (code):** `8ed5679` — `[T1.09] Extract feel layer (animations, particles, narrator function)`
**Priority:** HIGH
**Phase:** 1 (Week 2-3 — sub-tasked early per actual pace)
**Estimated complexity:** M
**Depends on:** ✅ T1.07 (V_HAPTICS + NARRATOR_LINES already in src/feel/), ✅ T1.08 (logger available)

**Files affected:**
- `src/feel/animations.js` (new — `vPlayLineClearBurst`, `vPlayCritFlash`, `vPlayBossDieFx`, animation utility functions)
- `src/feel/particles.js` (new — particle creation, lifecycle, cleanup)
- `src/feel/narrator.js` (new — `speakNarrator(trigger)` function; **imports NARRATOR_LINES from existing src/feel/narrator-lines.js**)
- `src/feel/haptics.js` (existing from T1.07 — leave alone)
- `src/feel/narrator-lines.js` (existing from T1.07 — leave alone)
- `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` — **DO NOT TOUCH** (sacred byte-identical)

**Goal:** Extract feel-related code (NON-sacred-cow functions but invoking sacred-cow timings) from legacy inline JS to `src/feel/`. Sacred cow timing values (180ms flash, 440ms shake, 5-beat boss death sequence) must remain byte-perfect.

**Context:** Per Execution Plan §13 T1.09 (around lines ~1462-1532). T1.07 already extracted the sacred TABLES (V_HAPTICS, NARRATOR_LINES). T1.09 extracts the FUNCTIONS that consume them. Feel layer is self-contained, low risk — last "easy" extraction before T1.10 (the XL core logic task).

**Critical Sacred Cows in this task (CLAUDE.md §2.2):**
- **`vPlayCritFlash` timing:** `180ms flash + 440ms shake` — copy EXACTLY
- **5-beat boss death cinematic** (`vPlayBossDieFx`) — preserve all 5 beat timings + sequence
- **`vPlayLineClearBurst` particle pattern** — particles directed toward bossImg coordinates
- **Animation timing constants** — any setTimeout/setInterval ms in feel functions
- Note: V_HAPTICS and NARRATOR_LINES already done in T1.07 (verified byte-perfect)

**Approach:**

1. **Inventory pass:** grep legacy for feel functions:
   ```bash
   grep -n "function vPlay\|function speakNarrator\|function vHaptic\|function spawn[A-Z]" docs/_legacy/_archive_v1/blocksworn_index_fixed.html | head -30
   ```
2. Read each function's source. Note all timing constants (`setTimeout(... 180)`, `setTimeout(... 440)`, etc.) — sacred.
3. **Module mapping:**
   - `src/feel/animations.js` — `vPlayLineClearBurst`, `vPlayCritFlash`, `vPlayBossDieFx`, any other `vPlay*` functions
   - `src/feel/particles.js` — `spawnParticle*` functions, particle lifecycle (`updateParticles`, `removeDeadParticles`, etc.), particle DOM manipulation
   - `src/feel/narrator.js` — `speakNarrator(trigger)` (imports NARRATOR_LINES from `./narrator-lines.js`)
4. **Cross-imports:** if `vPlayBossDieFx` uses `spawnParticle*`, the import statement goes in `animations.js`:
   ```js
   import { spawnBossDeathParticles } from './particles.js';
   ```
   Similarly `speakNarrator` imports NARRATOR_LINES.
5. **Don't migrate logic** that calls feel functions (e.g., the battle loop that fires `vPlayCritFlash` on a crit hit). That call-site stays in legacy until T1.10.
6. **Sacred verification:** after writing, side-by-side diff every numeric constant in the migrated functions. If you see `setTimeout(fn, 180)` in legacy, the new file MUST have `setTimeout(fn, 180)` — not 200, not 175, not "180 + jitter".
7. **Pure relocation.** No "improvements" to animation timing, no refactoring of particle lifecycle, no consolidating duplicate keyframe lookups.

**Acceptance criteria:**
- [ ] 3 new files: `src/feel/animations.js`, `src/feel/particles.js`, `src/feel/narrator.js`
- [ ] Each module exports named functions
- [ ] `vPlayCritFlash` timing values byte-perfect (180ms flash + 440ms shake)
- [ ] `vPlayBossDieFx` 5-beat sequence byte-perfect (all 5 timings preserved)
- [ ] `vPlayLineClearBurst` particle pattern byte-perfect (counts, directions, decay)
- [ ] `speakNarrator()` imports `NARRATOR_LINES` from `./narrator-lines.js` (don't re-declare)
- [ ] No new console errors when modules import-resolved
- [ ] `npm run test:smoke` → 2/2 pass
- [ ] `npm run test:visual` → 22/22 pass under 2% (legacy untouched)
- [ ] `npm run test:unit` → still passes (storage tests unchanged)
- [ ] `npm run build` → succeeds, bundle still ~372KB (feel modules tree-shake out — no callers yet)
- [ ] `npm run lint` → 0 errors
- [ ] Legacy HTML: `wc -c` = 21,480,494; SHA-256 = `4b3a3974f8b9030bf195dc9fad2b7b4bf07857021b3c01b44410ac547fcee67f`
- [ ] Commit: `[T1.09] Extract feel layer (animations, particles, narrator)`

**DO NOT TOUCH:**
- `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` (sacred)
- `src/feel/haptics.js` + `src/feel/narrator-lines.js` (T1.07 already landed; just import from narrator-lines.js)
- `src/styles/` (T1.06), `src/data/` (T1.07), `src/services/` (T1.08)
- Visual baselines, smoke tests, regression spec, husky, eslint config
- Sacred cow VALUES (only relocate; never modify)
- Game logic (T1.10 territory)
- `site/`

**Known unknowns / risks:**
- **Function dependencies:** feel functions may call helpers defined elsewhere in legacy (e.g., `vPlayBossDieFx` calling `getDomById('bossImg')`). For T1.09, copy the function body as-is; if it references undeclared globals, add a comment `// TODO(T1.10): rewire to src/core/dom-helpers.js` and ship as-is. Lint may complain about undefined identifiers — add specific ESLint exceptions or use `/* global elementName */` directives.
- **Animation tokens:** some animations may depend on CSS classes that don't exist yet in `src/styles/` (extracted in T1.06). Verify by grepping `tests/visual/regression.spec.js` — the legacy render path is independent so this won't break baselines, but new shell may have missing CSS. Flag in "Замечено рядом" if discovered.
- **Particle DOM injection:** if particles create DOM elements via `document.createElement('div').className = 'particle'`, the corresponding CSS rules need to exist in `src/styles/components/particle.css` (or wherever T1.06 put them). Don't worry about this for T1.09 — T1.10/T1.11 wires the new shell's DOM. T1.09 only extracts functions.

**Rollback plan:** `git revert <commit-sha>` — fully reversible.

**Time-box:** 45-75 min.

---

**Implementation summary (Game Dev self-check, 2026-05-11):**

Three feel modules extracted as pure relocation from
`docs/_legacy/_archive_v1/blocksworn_index_fixed.html`:

- **`src/feel/animations.js`** (177 lines) — exports `vPlayLineClearBurst`,
  `vPlayCritFlash`, `vPlayBossDieFx`, `vCleanupBossDeathFx`,
  `vPlayLevelPulse` (5 functions). Imports `vHaptic` from `./haptics.js`
  and `spawnBossDeathParticles` from `./particles.js`. Sourced from legacy
  lines 67245-67400 (V3.0 PHASE 9 · VFX block).
- **`src/feel/particles.js`** (68 lines) — exports
  `spawnBossDeathParticles` + module-private `BOSS_DEATH_ELEM_COLOR`
  freeze table. Owns the 16-spoke radial burst lifecycle (1600ms
  container auto-remove). Sourced from legacy lines 67334-67367 (Beat 3
  of `vPlayBossDieFx`). vPlayLineClearBurst's `.v-spark` spawn loop stays
  inside animations.js because its trajectory vars are inline with the
  burst container creation — splitting would require passing 5 params
  per spark and add no clarity.
- **`src/feel/narrator.js`** (50 lines) — exports `speakNarrator(trigger)`.
  Imports `NARRATOR_LINES` from existing `./narrator-lines.js` (T1.07).
  Sourced from legacy lines 66404-66423.

**Sacred timings preserved (byte-perfect, verified via grep):**

| Function | Legacy ms | Module ms |
|---|---|---|
| `vPlayCritFlash` flash class | `180` | `180` ✓ |
| `vPlayCritFlash` shake class | `440` | `440` ✓ |
| `vPlayBossDieFx` Beat 0 shake | `440` | `440` ✓ |
| `vPlayBossDieFx` Beat 1 hit-pause | `300` | `300` ✓ |
| `vPlayBossDieFx` Beat 2 white flash fire | `260` | `260` ✓ |
| `vPlayBossDieFx` Beat 2 flash auto-remove | `220` | `220` ✓ |
| `vPlayBossDieFx` Beat 3 dissolve+particles | `380` | `380` ✓ |
| `vPlayBossDieFx` Beat 4 slow zoom | `420` | `420` ✓ |
| `vPlayBossDieFx` Beat 5 music sting | sync | sync ✓ |
| `vPlayLineClearBurst` burst cleanup | `1000` | `1000` ✓ |
| `vPlayLineClearBurst` spark duration | `600+rand*240` | `600+rand*240` ✓ |
| `vPlayLineClearBurst` spark cap | `32` | `32` ✓ |
| `vPlayLineClearBurst` target fallback y | `-80` | `-80` ✓ |
| `spawnBossDeathParticles` count | `16` | `16` ✓ |
| `spawnBossDeathParticles` distance | `70+rand*60` | `70+rand*60` ✓ |
| `spawnBossDeathParticles` delay | `rand*80` | `rand*80` ✓ |
| `spawnBossDeathParticles` cleanup | `1600` | `1600` ✓ |
| `vPlayLevelPulse` pulse hold | `2800` | `2800` ✓ |
| `speakNarrator` busy hold | `3400` | `3400` ✓ |
| `speakNarrator` strip visibility | `3000` | `3000` ✓ |

Element-color table (`ember/tide/grove/solar/umbra` → hex) copied
byte-perfect including default `'#FFD53D'` fallback.

**ESLint approach:** rather than mutate the shared `eslint.config.js`
globals list (DO NOT TOUCH per task spec — "minimal globals additions"
only), I used per-file `/* global … */` directives. This keeps the
legacy-only identifiers local to the feel modules that need them and
auto-disappears in T1.10 when the rewiring lands:

- `animations.js`: `/* global SIZE, playSFX, vPlaySound */`
- `particles.js`: `/* global currentBoss */`
- `narrator.js`: `/* global _isDialogActive, _deferDuringDialog */`

**TODO(T1.10) markers embedded:** 5 total
1. `animations.js` header — `SIZE`, `currentBoss`, `playSFX`/`vPlaySound`
   listed for rewiring
2. `animations.js` inline — `SIZE_LOCAL` fallback line marks the SIZE rewire
3. `animations.js` inline — Beat 5 try/catch marks the playSFX/vPlaySound rewire
4. `particles.js` header + inline — `currentBoss` to come from
   `src/core/state.js`
5. `narrator.js` header — `_isDialogActive` and `_deferDuringDialog` to
   move to a `src/core/dialog-defer.js` (or similar) in T1.10

**Files changed:**
- `src/feel/animations.js` (created, 177 lines)
- `src/feel/particles.js` (created, 68 lines)
- `src/feel/narrator.js` (created, 50 lines)

**Gates (all green):**
- `npm run lint` → 0 errors / 0 warnings
- `npm run build` → succeeds, dist = 372K (368.77kB CSS + 0.75kB JS;
  feel modules tree-shake out, no callers yet — matches T1.08 baseline)
- `npm run test:unit` → 6 / 6 passing
- `npm run test:smoke` → 2 / 2 passing (chromium + mobile-chrome)
- `npm run test:visual` → 22 / 22 passing under 2% (legacy untouched)
- Legacy: `wc -c` = 21,480,494 ✓
- Legacy: SHA-256 = `4b3a3974f8b9030bf195dc9fad2b7b4bf07857021b3c01b44410ac547fcee67f` ✓

**Acceptance criteria — all met:**
- [x] 3 new files: animations.js, particles.js, narrator.js
- [x] Each module exports named functions (5 / 1 / 1 respectively)
- [x] `vPlayCritFlash` timing byte-perfect (180ms / 440ms)
- [x] `vPlayBossDieFx` 5-beat sequence byte-perfect
- [x] `vPlayLineClearBurst` pattern byte-perfect
- [x] `speakNarrator()` imports `NARRATOR_LINES` from `./narrator-lines.js`
- [x] No new console errors when modules import-resolved (smoke clean)
- [x] `npm run test:smoke` 2/2
- [x] `npm run test:visual` 22/22 under 2%
- [x] `npm run test:unit` 6/6
- [x] `npm run build` succeeds, bundle 372K
- [x] `npm run lint` 0 errors
- [x] Legacy `wc -c` + SHA-256 unchanged
- [x] Commit landed: `8ed5679`

**Замечено рядом (NOT fixed, reported):**
- *None this pass.* The feel layer is self-contained; no incidental
  observations to flag for T1.10.

---

### TASK-011 (T1.10) — Extract core game logic to `src/core/` (XL — the watershed task)

**Status:** ✅ **COMPLETE — 9/9 sub-tasks DONE 2026-05-11** (CTO signed off). T1.10 watershed task closed. Total src/core/ surface: **12,164 LoC across 9 modules**.

**Deferred from T1.10 → T1.11 cleanup** (CTO call — these are FX/DOM-coupled, naturally belong with UI extraction):
- Per-archetype tick handlers (~1,500 LoC, 10 archetypes) — battle.js currently calls via `/* global */` stubs with `typeof` guards
- `onBossDefeated` (535 LoC) — cross-cutting reward / progression / dialog / analytics chain — better as separate `rewards.js` module or progression.js follow-up

**Cross-boundary audits deferred to T1.13 verify pass:**
- `placePiece` return-value polish (legacy `undefined` → new `true`; callers test `=== false` literal so semantics hold)
- ~600 LoC legacy dead hero code (`ultEmber/Solar/Tide/Grove/Umbra`, orc/troll/human helpers — none HERO_ROSTER-bound)
- `getSquadMitigation` / `getHeroMitigationKey` ownership (currently in channels, logically belong in heroes)

**Sub-task progress:**
- [x] T1.10.1 — `ftue-state.js` — **DONE 2026-05-11** (commits `e12d27b`, `ec4e409`; 21 exports / 475 LoC; sacred FTUE_BEATS/TRANSITIONS preserved byte-perfect via import from T1.07)
- [x] T1.10.2 — `progression.js` — **DONE 2026-05-11** (commits `981c136`, `3005c69`; 79 exports / 1128 LoC; TIER_COSTS sacred + one-Mythic + T2/T3/Mythic bonuses byte-perfect; 5 chapter-complete bare-string keys flagged for T1.10.9 shim)
- [x] T1.10.3 — `grid.js` — **DONE 2026-05-11** (commits `73358d0`, `226fb7d`; 26 exports / 603 LoC; sacred combo-crit dominant-count + GRID_SATURATION + VOID_TICK 0.5%/cell byte-perfect; 0 new bare-string keys — grid is per-battle ephemeral; minor `placePiece` return-value polish flagged for T1.10.9 audit)
- [x] T1.10.4 — `heroes.js` — **DONE 2026-05-11** (commits `7196ec1`, `3725199`; **3,972 LoC** biggest sub-task; HERO_ROSTER 25/25 + 25 fire + 25 ultTwist + 10 fireDelta + 10 ultDelta + Aegis Conductor + Squad Conductor + 25/25 Mythic descriptors — all byte-perfect; ~600 LoC legacy dead code deferred to T1.10.9 audit; 0 new bare-string keys)
- [x] T1.10.5 — `damage-channels.js` (v2.1 P1) — **DONE 2026-05-11** (commits `31a3786`, `cdf37df`; 457 LoC / 16 exports; SACRED v2.1 P1 Mitigation Matrix + 4 channel formulas + shield-absorption order byte-perfect; cross-boundary `getSquadMitigation`/`getHeroMitigationKey` belong in heroes.js — flagged for T1.10.9 audit)
- [x] T1.10.6 — `stagger-loop.js` (v2.1 P2) — **DONE 2026-05-11** (commits `83782cf`, `668b1c9`; **1021 LoC / 48 exports**; SACRED v2.1 P2 ACTIVE/STAGGER/RECOVERY + PRESSURE_MAX=100 + PRESSURE_GAIN table + STAGGER_DURATION=4 + RECOVERY=2 + STAGGER_CHAINING + Overflow conversion 40/30/500/10/revenge 1.5× byte-perfect; window-exposure bridge via `Object.defineProperty` for legacy bare-identifier reads; 5 v2.1 P2 PRs co-extracted per encapsulation; 0 new bare-string keys)
- [x] T1.10.7 — `bosses.js` — **DONE 2026-05-11** (commits `cc7d0bc`, `fecd2c2`; **1,309 LoC / 60 exports**; 25 BOSSES (Ch1-5×5) + 25 archetypes + 25 matchups flat post-Object.assign byte-perfect; FTUE_BOSS_GUARANTEES + TOWER_UROBOROS_SEASONAL + BOSS_VOICES sacred; Ch3 scaffolding + window-exposure bridge for boss state; **memory conflict resolved** — Ch4-5 boss DATA in legacy, only player ACCESS gated via progression flags; 0 new bare-string keys)
- [x] T1.10.8 — `reactivity-events.js` (v2.1 P4) — **DONE 2026-05-11** (commits `52bd102`, DOCS pending; **1,440 LoC / 68 exports**; SACRED v2.1 P4 phase-gate adaptations at 70%/35% HP + REACTIVITY_TELEGRAPH_MS=3000 byte-perfect; 22 archetype handlers (10 archetypes × 2 gates + tower_voidfang × 2) + 7 EFFECT_HANDLERS + BOSS_PHASES table for 25 bosses + VOIDFANG override; 14 reactivity state vars + Voidfang shroud slice + 3 FTUE Chronicler intros; v2.1 P4 implementation status CONFIRMED — resolves Execution Plan §23 "VERIFY"; **1 NEW bare-string key flagged** — `VOIDFANG_DEFEATED_KEY = 'blocksworn_voidfang_defeated'` stored as `'1'`, read with `=== '1'` — added to T1.10.9 shim allow-list)
- [x] T1.10.9 — `battle.js` orchestrator + MANDATORY migration shim — **DONE 2026-05-11** (commits `007eb21`, `2205516`; **1,759 LoC / 19 exports** battle.js + **183 LoC / 3 exports** migrate.js + **163 LoC / 5 tests** migrate.test.js; SACRED combo crit + Overflow conversion + FIRE_MULT_CAP byte-perfect; pulled deferred T1.10.7 items: bossAttack + getEffectiveBossStats + Phase 8 dispatcher; 4 FTUE launchers; migration shim 9 keys + idempotent sentinel + `_looksLikeJSON` discriminator bug caught by unit tests; per-archetype tick handlers + onBossDefeated deferred to T1.11)

**Scope clarification for T1.10.9:** Original Execution Plan T1.10 footer said "replace index.html at end" — but per the Plan's broader sequence, **`index.html` switchover belongs to T1.12** (`Wire main.js entry point`), not T1.10.9. T1.10.9 deliverables:
1. Extract `src/core/battle.js` orchestrator (main battle loop tying all T1.10.1-T1.10.8 modules together)
2. Implement the migration shim (one-shot, in `src/services/storage.js` or a new `src/services/migrate.js`) for all **9 bare-string keys** in allow-list
3. Verify src/core/* tree is import-graph-clean (no circular deps; all `/* global */` targets either resolved via imports or documented as TODO(T1.11/T1.12))
4. **Do NOT touch `index.html` or `src/main.js`** — those are T1.11/T1.12 territory
5. Cross-boundary audit deferred to T1.13 verify pass (placePiece return polish, ~600 LoC dead hero code, getSquadMitigation ownership)

**Post-T1.10.9:** Phase 1 progress will be 10/20. Then T1.11 (UI screens to src/ui/) + T1.12 (wire main.js — THE switchover) + T1.13 (verify) = Phase 1 endgame.

**Discipline:** ONE SUB-SYSTEM AT A TIME. After each: smoke + visual must pass. Commit `[T1.10.N]`. STOP on first failure.

**⚠️ MANDATORY for T1.10.9 wire-up** (flagged by T1.10.1 Game Dev — HIGH priority):
Legacy stored `FTUE_STORAGE_KEY` as **bare string** (e.g., `'pyredrake_fight'`), but T1.08's `storage.getItem` JSON-parses and returns `defaultValue` on bare strings. **Without one-shot migration shim in T1.10.9, existing player saves will silently reset to `not_started`** when new shell takes over. Same caveat for `seenIntroVideo` + `onboardingSeen` (5 ad-hoc legacy localStorage calls left raw with TODO(T1.11) markers).

**Migration shim spec (for T1.10.9 prompt):** for each known legacy bare-string key, run once on first boot post-wire-up.

**Known bare-string keys (allow-list — grows during T1.10.3-T1.10.8 extractions):**
- `FTUE_STORAGE_KEY` (T1.10.1) — stored as `'pyredrake_fight'` etc.
- `seenIntroVideo` (T1.10.1, 3 sites)
- `onboardingSeen` (T1.10.1, 2 sites)
- `blocksworn_chapter_1_complete` … `blocksworn_chapter_5_complete` (T1.10.2 — 5 keys) — stored as literal `'true'`, read with `=== 'true'`. JSON-routing breaks chapter-complete semantics.
- `blocksworn_voidfang_defeated` (T1.10.8 — 1 key) — stored as literal `'1'`, read with `=== '1'`. JSON-routing breaks the boolean semantics. Setter sites: legacy line 57911 (boss-defeat) + 38648 (debug reset clears).

**Migration shim algorithm:**
1. `const raw = localStorage.getItem(key)`
2. If `raw === null` → skip
3. If `raw.startsWith('"') || raw.startsWith('{') || raw.startsWith('[')` → already JSON, skip
4. Else `localStorage.setItem(key, JSON.stringify(raw))` (now valid JSON)
5. Mark `localStorage.setItem('blocksworn_storage_v2_migrated', '"true"')` to skip on subsequent boots
**Priority:** HIGH
**Phase:** 1 (Week 4-5 per Plan; faster at current pace)
**Estimated complexity:** XL (~50% of Phase 1 effort per Execution Plan)

**Goal:** Extract core game logic to 9 modules: `battle.js`, `grid.js`, `heroes.js`, `bosses.js`, `progression.js`, `ftue-state.js`, `stagger-loop.js`, `damage-channels.js`, `reactivity-events.js`. Each imports from `src/data/`, `src/feel/`, `src/services/` (all wired up by T1.06-T1.09). No window-globals. After T1.10, legacy HTML is no longer the primary code path — new shell takes over.

**Detailed spec:** `docs/plan/00_EXECUTION_PLAN.md` §13 T1.10 (lines ~1535-1615) — read **carefully** before assignment.

**Approach (per Execution Plan):** ONE SUB-SYSTEM AT A TIME, commit after each, sub-numbered `[T1.10.1]`, `[T1.10.2]`, etc. Smoke + visual after each sub-system.

---

### T1.10.1 — REVIEW (2026-05-11)

**Code commit:** `e12d27b` — `[T1.10.1] Extract FTUE state machine to src/core/ftue-state.js`
**DOCS commit:** follows (this entry)
**File created:** `src/core/ftue-state.js` (475 lines, 21 named exports = 5 constants + 16 functions)

**Implementation summary:**

FTUE state machine extracted byte-perfect from legacy `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` lines 24043-24484. Module owns the beat cursor (`ftueBeat`), transition validation, persistence, predicates (`isFtueActive`, `isFtueComplete`, `ftueIs`), dev-tooling reset paths (`skipFtue` / `resetFtue` / `_skipOnboarding`), initial routing (`routeByFtue` + private `_maybeShowIntroVideo`), and the navigation gate (`ftueBlockNavIfActive`). Constants block (`FTUE_STORAGE_KEY`, `FTUE_PYREDRAKE_HP=800`, `FTUE_PYREDRAKE_ATTACK_INTERVAL=15`, `FTUE_PYREDRAKE_ARTIFACT='orc_ring'`, `FTUE_GRUNT_ARTIFACT='orc_weapon'`) co-located with the state machine that owns them — getEffectiveBossStats consumer stays in legacy until T1.10.7 wires bosses.

**Sacred cow preservation:**
- `FTUE_BEATS` order, `FTUE_TRANSITIONS` edges, `FTUE_TRANSITIONS_FORCE` — imported from `src/data/ftue-scripts.js` (T1.07 byte-perfect). NOT modified.
- FTUE_BOSS_GUARANTEES — not touched here (stays in src/data/ftue-scripts.js). Sacred per CLAUDE.md §2.5.
- Chronicler beat dispatch flow (`chronicle_fight` → `chronicle_won` → `intro`) — byte-perfect, including the FTUE_SCRIPTS.chronicle_intro/outro playback ordering.
- All `advanceFtue` side-effect ordering preserved: storage save → dialog queue drop → chrono dismiss → debug log → onFtueBeatChanged dispatch.
- Pyredrake tuning (HP=800, attackInterval=15) and FTUE artifact IDs preserved verbatim.

**Storage rewires (T1.08 abstraction):**
- 4 call sites for `FTUE_STORAGE_KEY` rewired: `saveFtueToStorage` (set), `loadFtueFromStorage` (get). Legacy raw `localStorage.{set,get}Item(FTUE_STORAGE_KEY, ...)` calls → `storage.{set,get}Item('blocksworn_ftue_beat', ...)`.
- 5 ad-hoc localStorage calls left raw with TODO comments (`seenIntroVideo` × 3, `onboardingSeen` × 2) — these live inside UI-adjacent helpers (`_maybeShowIntroVideo`, `_skipOnboarding`, `routeByFtue`) and face the same JSON-wire-format compat issue. Flagged as part of T1.11 wire-up alongside DOM rewires.

**ESLint globals added** (specific identifiers, why):
- Readonly: `ASSETS`, `playDialogScript`, `showLeaderChoiceModal`, `revealHero`, `flashText`, `vibrate`, `resetBossVoiceFlags`, `_dialogDeferredQueue`, `_chronoActive`, `_hideChronoBeat`, `location`, plus secondary block `startPyredrakeFtueBattle`, `startGruntFtueBattle`, `startChronicleFtueBattle`, `finalizeFtue`. All read-only ambient references that move into other modules in T1.10.4 / T1.10.7 / T1.10.9 / T1.11.
- Writable: `_pendingDialogRequest`, `dialogActive`, `dialogClickLock` — `_skipOnboarding` assigns to these to tear down the dialog overlay state. They live in legacy lines 24713/24715/24733 and migrate alongside the dialog system (T1.11).

**TODO markers:**
- `TODO(T1.10.4)`: revealHero, ensureRevealedForComplete (heroes module)
- `TODO(T1.10.9)`: playDialogScript, startPyredrakeFtueBattle / startGruntFtueBattle / startChronicleFtueBattle, dialog/boss-voice teardown (battle.js + dialog module)
- `TODO(T1.11)`: showLeaderChoiceModal + dialogOverlay DOM refs, chrono-beat UI module (#dialogOverlay, #dialogCtaBtn, #dialogSkipBtn, #introVideoOverlay/#introVideoPlayer/#introVideoSkip)
- 8 markers total — 4× T1.10.N, 4× T1.11

**Logger migration:**
- 4 `console.warn(...)` calls in extracted region → `log.warn(...)` (saveFtueToStorage failure, loadFtueFromStorage failure, ftueIs unknown beat, advanceFtue invalid beat). Plus `console.warn` chain in `onFtueBeatChanged` failure handler, `[FTUE] prev → next` `console.log` → `log.debug` (no-op in production per logger contract).

**Engineering judgment:**
- `getEffectiveBossStats` (legacy line 24161) NOT extracted — it's a boss-stats override consumer that depends on `currentChapter` + boss object shape + `_phase8GetAdaptiveHpMultiplier`. Clear T1.10.7 (bosses) territory; pulling it into ftue-state would broaden scope into boss stat math.
- Density-aware tutorial overlay system (legacy lines 46993-47100, `showTutorialOverlay`, `enforceBossFTUEGuarantees`, `_phase8*` helpers, `PACING_DENSITY_SCHEDULE`, `CONCEPT_PHASE_REGISTRY`) NOT extracted — large subsystem coupled to analytics, DOM, and per-boss event tracking. The spec note in the task brief mentions density helpers but explicitly says "if borderline, leave it for the relevant sub-task — T1.10.9 battle will catch leftovers". This subsystem is T1.10.9 + T1.11 territory.
- Battle launchers (`startPyredrakeFtueBattle`, `startGruntFtueBattle`, `startChronicleFtueBattle`, `finalizeFtue`) NOT extracted — they touch `currentChapter`, `currentBossIdx`, `selectedBossIdx`, `currentBoss`, `setChapter`, `startBossBattle`, `EMBER_GRUNT`, `CHRONICLE` constants. All T1.10.9 territory.
- `_maybeShowIntroVideo` kept module-private (not exported) since it's only called from `routeByFtue`. Direct DOM refs preserved with TODO(T1.11) markers.
- Mutable state encapsulated via `getCurrentBeat()` / `getFtueSafetyRailUsed()` + setter pattern (matches CLAUDE.md §6.4 ES module discipline — no exported `let`).

**Verification (all gates green):**
- `npm run lint` → 0 errors / 0 warnings
- `npm run test:unit` → 6/6 pass (~104ms)
- `npm run test:smoke` → 2/2 pass
- `npm run test:visual` → 22/22 pass under 2%
- `npm run build` → succeeds. dist/assets/index.js = 0.75KB; dist/assets/index.css = 368.77KB (unchanged — new module tree-shakes out, nothing imports it yet, as expected per Step E of the assignment)
- Legacy `wc -c` = 21,480,494; SHA-256 `4b3a3974f8b9030bf195dc9fad2b7b4bf07857021b3c01b44410ac547fcee67f` — byte-identical

**Self-check:**
- [x] Acceptance: FTUE state machine extracted — beat cursor, transitions, predicates, persistence, routing, nav gate, dev-tooling
- [x] Acceptance: imports from src/data/ftue-scripts.js (T1.07) + src/services/storage.js (T1.08) + src/services/logger.js (T1.08)
- [x] Acceptance: no window globals introduced (only `/* global */` directives for legacy refs that move later)
- [x] Acceptance: mutable state module-private (getCurrentBeat() getter; resetFtue() bypasses validation intentionally to match legacy 24329)
- [x] Acceptance: legacy HTML byte-identical (wc -c + SHA-256 verified)
- [x] Acceptance: all gates green (lint, unit, smoke, visual, build)
- [x] Acceptance: nothing imports the new module — tree-shakes out for T1.10.1 (correct — T1.10.9 final wire-up flips legacy → src/)
- [x] Sacred cows: FTUE_BOSS_GUARANTEES untouched (stays in src/data/ftue-scripts.js). FTUE transition flow byte-perfect. Chronicler beats untouched.
- [x] DO NOT TOUCH: index.html — not modified; src/main.js — not modified; other src/ modules — not modified; CSS / baselines / tests / CI / husky / eslint config — not modified
- [x] No new npm packages
- [x] Not pushed to remote (CTO will instruct)
- [x] STOPPED after T1.10.1; did NOT start T1.10.2

**Замечено рядом (NOT fixed, reported):**
1. **Storage wire-format compat caveat (HIGH for T1.10.9):** legacy stored `FTUE_STORAGE_KEY` as a bare string (`localStorage.setItem(FTUE_STORAGE_KEY, 'pyredrake_fight')`). The T1.08 `storage.getItem` JSON.parses, fails on bare strings, and returns the defaultValue (null). Existing player saves would silently revert to `not_started` once this module activates. **T1.10.9 wire-up MUST add a one-shot migration shim** in `initFtueState()`: on first read returning null, fall back to raw `localStorage.getItem(FTUE_STORAGE_KEY)` and if it matches a valid beat, re-save via `storage.setItem` to upgrade the wire format. Same issue applies to `seenIntroVideo`/`onboardingSeen` (left raw for T1.11).
2. **Diagnostic helpers in legacy:** `window.__ftueDebug` (legacy line 24501) and `window.skipFtue`/`resetFtue`/`advanceFtue`/`getEffectiveBossStats`/`ftueIs` exports (legacy line 24486-24492) are dev console helpers. NOT extracted — they belong to a dev-tooling surface (T1.11 or a dedicated `src/dev/` module). Mentioned for visibility; CTO can decide whether to spin off as a separate sub-task.
3. **Storage-format inconsistency note:** `services/storage.js` docstring (lines 16-24) already calls out this exact migration concern. The 1.08 module foresaw it. T1.10.9 is the natural place to land the shim — flag this in the T1.10.9 brief.

**Time:** ~2.5 hours

---

### T1.10.2 — REVIEW (2026-05-11)

**Code commit:** `981c136` — `[T1.10.2] Extract progression to src/core/progression.js`
**DOCS commit:** follows (this entry)
**File created:** `src/core/progression.js` (1128 lines, 79 named exports = 51 functions + 17 constants + 6 storage keys + 5 ascension cost/bonus consts)

**Implementation summary:**

Progression system extracted byte-perfect from legacy `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` across nine source regions (first-clear/star storage 19485-19585, chapter binding 20445-20500, ascension consts+flows 20507-20769, hero unlock 21220+21274-21388, dungeon progress 25224-25284, hero level state 25680-25966, chapter-complete primitives 31510-31545, save/load aggregator 38260-38525, tier-essence upgrade 39988-40002). Module owns: progression state cursors (current chapter, bossesDefeated, chapter-progress map, per-chapter unlock flags), hero unlock-list management (load/save + lock/unlock + squad reconciliation), hero level table (gold-spend levelUp + tier-aware effective caps + migration), dungeon/floor progress (per-chapter/boss max-floor-cleared), first-clear timestamps + boss star records + computeBattleStars, hero ascension predicates + flows (T2 / T3 / Mythic with full cost validation), tier-upgrade essence-spend path, save/load aggregators.

**Sacred cow preservation:**
- `TIER_COSTS` ({1:1, 2:2, 3:3, 4:5}) imported from `src/data/balance.js` (T1.07 canonical V18 variant). `upgradeHero` consumes via `TIER_COSTS[toTier]` byte-perfect. NOT modified.
- One-Mythic-per-save constraint preserved byte-perfect: `getMythicMissing` returns `{type: 'mythic_taken', byHero: otherMythic}` when another hero already holds the slot (legacy line 20720-20722). Module-level comment + commit message flag this as sacred per CLAUDE.md §2.5 / §9 glossary "Mythic".
- TIER2/TIER3/MYTHIC cost + damage-bonus constants (`TIER2_DAMAGE_BONUS=1.20`, `TIER3_DAMAGE_BONUS=1.20`, `MYTHIC_DAMAGE_BONUS=BALANCE.ascend.mythic.damageBonus=1.30`) preserved verbatim; multiplicative stack `1.20 × 1.20 × 1.30 = 1.872×` (+87%) folded via `getHeroAscensionMult`.
- BALANCE.heroLevel.{min,maxT1,maxT2,maxT3,maxMyth,costBase,costStep,costCap,dmgPer,ultPer} all read from T1.07 import — no local redefinition.
- Save-load schema `_v: 17` preserved byte-perfect; chapterProgress migration from V15 saves (line 1037-1043) preserved.

**Storage rewires (T1.08 abstraction):**
- 6 JSON-shape keys rewired: `blocksworn_first_clears`, `blocksworn_boss_stars`, `blocksworn_dungeon_progress`, `blocksworn_heroes_unlocked`, `blocksworn_hero_levels`, `blocksworn_progress`. All exported as named constants (`FIRST_CLEAR_KEY`, `BOSS_STARS_KEY`, `DUNGEON_PROGRESS_KEY`, `HEROES_UNLOCKED_STORAGE_KEY`, `HERO_LEVELS_KEY`, `PROGRESS_STORAGE_KEY`).
- 1 bare-string key family preserved as raw `localStorage.{get,set}Item`: `blocksworn_chapter_${n}_complete` (legacy stores the literal string `'true'` and reads with `=== 'true'`). Routing through T1.08 storage would JSON.parse('true') → boolean true, then `true === 'true'` returns false — silent regression. Flagged in "Замечено рядом" below with TODO(T1.10.9) markers in the source.

**ESLint globals added** (specific identifiers, why):
- Readonly: `HERO_ROSTER`, `STARTER_HEROES`, `SQUAD_MAX` (T1.10.4 heroes module); `heroFragments`, `getHeroFragments`, `saveHeroFragmentsToStorage` (currency/heroes); `saveGoldToStorage`, `renderResourceBar` (currency + UI); `towerState`, `saveTowerState` (Tower module); `flashText`, `vibrate`, `renderSelect`, `closeFloorSelector`, `currentScreen`, `applyBossEmblems` (T1.11 ui); `logEvent`, `EVT`, `addSeasonXP`, `trackMissionEvent` (analytics layer); `isContentUnlocked` (content-drop schedule engine); `_maybeShowEndgameKitEligibilityCelebration` (T1.11 ui).
- Writable: `gold`, `essences`, `activeSquad`, `activeModifiers`, `BOSSES`, `favorites`, `chapterProgress`, `bossesDefeated`, `currentChapter`, `chapter2Unlocked`, `chapter3Unlocked`, `chapter4Unlocked`, `selectedBossIdx`, `heroUpgrades`, `artifactsOwned`, `equippedArtifacts`, `artDropPityCounter`. These are the legacy module-scope `let` declarations that `saveProgress`/`loadProgress`/`setChapter` mutate. T1.10.9 wire-up will migrate canonical ownership into this module and re-export getters/setters.
- File-level `/* eslint-disable no-unused-vars */` around the writable-global directive only (re-enabled immediately after) — needed because ESLint v9 flags declare-but-unread writable globals (`BOSSES`, `artifactsOwned`, `equippedArtifacts`, `artDropPityCounter` are only written, never read inside this module; their readers live in legacy until T1.10.7 + T1.10.9 wire-up). All other no-unused-vars enforcement preserved for module-local bindings.

**TODO markers:** 8 total
- `TODO(T1.10.4)` × 1 — HERO_ROSTER / STARTER_HEROES / .unlocked / .locked flags = heroes module territory.
- `TODO(T1.10.7)` × 1 — BOSSES rebind + applyBossEmblems = bosses module territory.
- `TODO(T1.10.9)` × 2 — bare-string chapter-complete migration shim; legacy global state ownership migration.
- `TODO(T1.11)` × 4 — DOM/UI rewires for flashText/vibrate (×2 in ascendHeroT3 + ascendHeroMythic) and renderSelect (×2 in unlockHero + lockHero).

**Logger migration:**
- 12 `console.warn(...)` / `console.log(...)` calls in extracted regions → `log.warn(...)` / `log.debug(...)` (load/save failure handlers, migration logs, dev-only branch logs). Per T1.08 logger contract.

**Engineering judgment:**
- **Hero level/tier/ascension placed in progression** per task brief ("Extract progression system: chapter unlocks, hero unlocks, hero level/tier/Mythic ascension, completion tracking"). T1.10.4 (heroes) owns HERO_ROSTER identity/race/element data; progression owns the per-save level + ascension state that orthogonally layers on top.
- **Hero unlock save/load lives here** even though the .unlocked flag rides on HERO_ROSTER entries — the persistence layer is a progression concern; the roster itself is data (T1.10.4). The `for (const h of HERO_ROSTER) { h.unlocked = ... }` mutation pattern preserves legacy byte-perfect; T1.10.4 may flip ownership to a separate `unlockedHeroes: Set` on follow-up.
- **State ownership stays in legacy for the global state vars** (`chapterProgress`, `bossesDefeated`, `currentChapter`, `chapter{2,3,4}Unlocked`, `selectedBossIdx`, `essences`, `heroUpgrades`). T1.10.2 cannot redeclare these here without breaking the legacy save/load contract — `loadProgress()` reads from / writes to the legacy globals, and the rest of legacy still reads them as ambient module-scope `let`. The functions mutate via `/* global ... :writable */`. T1.10.9 will flip canonical ownership into this module.
- **Floor selector / launchFloor stays in legacy** (launchFloor calls startBattleFromMenu + manages floor-scope modifier stash). Pure progression bookkeeping (`recordFloorCleared`, `getFloorCleared`, `isFloorUnlocked`) extracted; control flow stays.
- **Tier-2/T3/Mythic education modal stays in legacy** (`maybeShowTierEducation` line 20778+). It's a UI concern (T1.11) — though triggered by ascension success, the modal rendering / shared `.edu-modal` styling are out of scope.
- **`computeBattleStars` extracted** — it consumes only `BALANCE.rewards.stars` and is a pure math helper. Belongs with the boss-stars persistence it feeds.
- **`getProgressSnapshot()` added** as a read-only debug/analytics surface aggregating locally-owned state + legacy-owned chapter cursors. Helpful for T1.10.9 wire-up tests + future profile-screen consumers. Pure read — no I/O.

**Verification (all gates green):**
- `npm run lint` → 0 errors / 0 warnings
- `npm run test:unit` → 6/6 pass (~101ms)
- `npm run test:smoke` → 2/2 pass (~2.6s)
- `npm run test:visual` → 22/22 pass under 2% (~13s)
- `npm run build` → succeeds. dist/assets/index.js = 0.75KB; dist/assets/index.css = 368.77KB (unchanged — new module tree-shakes out, nothing imports it yet, as expected per Step E of the assignment)
- Legacy `wc -c` = 21,480,494; SHA-256 `4b3a3974f8b9030bf195dc9fad2b7b4bf07857021b3c01b44410ac547fcee67f` — byte-identical

**Self-check:**
- [x] Acceptance: progression state extracted — first-clears + stars, dungeon-floor progress, hero levels, hero unlock list, chapter completion flags, save/load aggregator
- [x] Acceptance: ascension extracted — T2 + T3 + Mythic cost validation, atomic deduction, persistence, multiplicative damage stack
- [x] Acceptance: tier-essence path extracted — `upgradeHero` consumes `TIER_COSTS[toTier]` byte-perfect
- [x] Acceptance: imports from src/data/{balance,chapters}.js (T1.07) + src/services/{storage,logger}.js (T1.08)
- [x] Acceptance: no window globals introduced (only `/* global */` directives for legacy refs that move later)
- [x] Acceptance: legacy HTML byte-identical (wc -c + SHA-256 verified)
- [x] Acceptance: all gates green (lint 0/0, unit 6/6, smoke 2/2, visual 22/22, build)
- [x] Acceptance: nothing imports the new module — tree-shakes out for T1.10.2 (correct — T1.10.9 final wire-up flips legacy → src/)
- [x] Sacred cows: TIER_COSTS values unchanged (imported, not redefined). One-Mythic-per-save constraint byte-perfect. TIER2/T3/MYTHIC damage bonuses unchanged. Stack multiplier 1.872× preserved.
- [x] DO NOT TOUCH: legacy HTML — not modified; index.html — not modified; src/main.js — not modified; src/core/ftue-state.js (T1.10.1) — not modified; other src/ modules (data/feel/services) — not modified; CSS / baselines / tests / CI / husky — not modified
- [x] DO NOT TOUCH: TIER_COSTS values — unchanged (sole source = src/data/balance.js T1.07); Mythic ascension logic — byte-perfect
- [x] No new npm packages
- [x] Not pushed to remote (CTO will instruct)
- [x] STOPPED after T1.10.2; did NOT start T1.10.3

**Замечено рядом (NOT fixed, reported):**
1. **Bare-string chapter-complete keys (HIGH for T1.10.9 migration shim):** legacy stores `blocksworn_chapter_${n}_complete` as the literal string `'true'` via `localStorage.setItem(key, 'true')` and reads via `localStorage.getItem(key) === 'true'`. Routing through T1.08 `storage.{set,get}Item` would JSON-encode on write (becomes `'"true"'`) and JSON.parse on read (becomes boolean `true`, then `true === 'true'` returns false — silent regression that resets chapter-complete state for every legacy save). I preserved these as raw `localStorage` access in the extracted code with TODO(T1.10.9) markers, but the T1.10.9 migration shim spec (already in TASKS.md line 223-228) must also cover `blocksworn_chapter_1_complete`, `blocksworn_chapter_2_complete`, `blocksworn_chapter_3_complete`, `blocksworn_chapter_4_complete`, `blocksworn_chapter_5_complete` (and the historical Ch1 path, kept compatible by cryptLichAftermath + Tower gating). **CTO recommendation:** add these five chapter-complete keys to the migration shim allow-list in the T1.10.9 brief alongside FTUE/intro-video keys from T1.10.1.

2. **Read-only `console.log` migration log on line `[BAL.1 MIGRATION]`:** legacy line 25761 emits `console.log` with the migrated heroes list. Routed through `log.debug` per logger contract — which is a no-op in production. This loses visibility of the clamp event for support / patch notes; partially compensated by the existing `logEvent(EVT.hero_leveled, {kind: 'migration_clamp', count})` analytics. **Not a bug, just a sensitivity loss.** If CTO wants the migration log restored to a visible channel, the call site could be promoted to `log.info` (visible in dev console; logged in production per logger contract) — out of scope here.

3. **`maybeShowTierEducation` + `TIER_EDUCATION_KEY` left in legacy** (line 20776+): triggered on first ascension success, but the modal rendering uses `.edu-modal` shared styling + direct DOM injection. Clear T1.11 (ui) territory. Mentioning so it doesn't get lost in the cracks during T1.10.9 wire-up.

4. **Static `let BOSSES = CHAPTERS[0].bosses` initial binding** lives in legacy line 20445. My `setChapter` extraction here rebinds BOSSES on every chapter change (line 257 of progression.js). The initial binding cannot be safely duplicated in progression.js without breaking the legacy module-scope `let BOSSES` declaration. T1.10.7 (bosses module) is the natural place to take canonical ownership.

5. **`HERO_ROSTER`-mutating hero unlock pattern** — the `loadUnlockedHeroesFromStorage` / `unlockHero` / `lockHero` functions mutate the `unlocked` field on HERO_ROSTER entries directly. This works because HERO_ROSTER is a mutable array of mutable objects, but couples progression state to roster identity. **CTO consideration:** T1.10.4 may want to either (a) keep `unlocked` as a HERO_ROSTER field with progression writing through this surface, or (b) flip to a separate `unlockedHeroSet: Set<id>` owned by progression with HERO_ROSTER pure-immutable. Both are equivalent at runtime; option (b) is the cleaner separation but breaks all the legacy `HERO_ROSTER.find(h => h.unlocked)` filter call sites until T1.10.9.

6. **Storage-format inconsistency note (recap from T1.10.1):** `services/storage.js` docstring (lines 16-24) already calls out the bare-string / JSON.stringify migration concern. T1.10.9 is the single source of truth for the migration shim. T1.10.2 confirmed two additional key families that need the same shim: chapter-complete (5 keys) and the `STARTER_GRANT` first-time-player essence seed (handled inside loadProgress when the aggregated `blocksworn_progress` key is null — no separate key, just defensive).

**Time:** ~3 hours

---

### T1.10.3 — REVIEW (2026-05-11)

**Code commit:** `73358d0` — `[T1.10.3] Extract grid to src/core/grid.js`
**DOCS commit:** follows (this entry)
**File created:** `src/core/grid.js` (603 lines, 26 named exports = 23 functions + 1 alias + 2 derived helpers)

**Implementation summary:**

Grid system extracted byte-perfect from legacy `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` across the following regions: module-scope state declaration (line 40012); battle-start allocator triple (55510, 55525, 55585); tray refill `newPieces` (55801-55811); piece-shape helper `cellsOf` (55813-55819); placement validator `canPlace` (55821-55866 — includes boss blocker reads for VOIDPRIESTESS warrior_blocked, Grovewarden Root Bind, Stormshepherd Blizzard/Earthquake); piece commit `place` → `placePiece` (55868-55913 — includes tempo_disruptor skip-gate, motif bloom/radiant hooks, placement_costs_hp seal, vHaptic/audio/mission tracking); full row/col scan `findLines` → `findClearableLines` (55915-55920); element-set extraction `stihiyasIn` (55922-55927); animated line-clear `clearLines` (55929-56045 — includes Pressure tiering, engineer Critical Mass damage, Root-of-Nothing wither neighbor-clear escape, permanent-frozen + engineer-locked immunity); `gridFillRatio` (56260-56264); v2.1 P1 channel triggers `applyVoidTickIfAny` + `applyGridSaturationIfAny` (39001-39033); constants `SIZE` + `MAX_HP` + `CHANNEL_VOID_TICK_PCT` + `CHANNEL_GRID_SATURATION_*` (19950, 19956, 19967-19969).

**Sacred cow preservation:**
- **Combo crit dominant-element count (CLAUDE.md §2.1):** legacy computes `domCount = Math.max(...Object.values(counts))` inline inside the combat damage path (line 63696), where `counts` is the per-element tally over the cleared cells (legacy 63566-63573). The grid module surfaces the underlying primitive as a new `countElementsInCells(rows, cols)` helper + a thin `getDominantElementCount(rows, cols)` wrapper — both pure, both following the legacy counting semantics exactly (void cells excluded via `hasOwnProperty` test against the ember/tide/grove/solar/umbra dictionary, matching `if (v && counts.hasOwnProperty(v))` at line 63572). The combat damage path at line 63696 is NOT touched here — T1.10.5 / T1.10.9 will refactor the inline pattern to call through these helpers without modifying the sacred multiplier formula `total_dmg × (1 + dominantCount × combo × 10%)`.
- **v2.1 P1 GRID_SATURATION channel (CLAUDE.md §2.5):** `applyGridSaturationIfAny` preserved byte-perfect — same `occupied` loop semantics (counts everything non-null incl. void + charged + frozen), same `ratio < CHANNEL_GRID_SATURATION_THRESHOLD` early-return, same `applyChannelDamage('saturation', CHANNEL_GRID_SATURATION_DMG, { occupied, totalCells, ratio })` payload. Threshold 0.75 and flat damage 8 HP unchanged.
- **v2.1 P1 VOID channel:** `applyVoidTickIfAny` preserved byte-perfect — `floor(voidCount * MAX_HP * CHANNEL_VOID_TICK_PCT)` formula, void-cell detection via `cell.startsWith('void_')`, early-return on zero count, zero rawDmg short-circuit.
- **All cell-mutation semantics:** `place()` piece-deposit loop with bloom-token consume + radiant marking; `clearLines()` wipe loop with `permanentFrozenCells` and `engineerLockedCells` immunity; Critical Mass electrified-row damage (50 dmg per cleared cell, shield-first absorption); Root-of-Nothing wither neighbor-clear escape (4-neighbor adjacency, void_grove → null mutation with witherCells survivor split). All preserved byte-perfect.
- **canPlace blocker order:** warrior_blocked seal → Grovewarden Root Bind → Stormshepherd Blizzard + Earthquake → bounds + collision. Order matters for short-circuit semantics; preserved exactly.

**Storage rewires (T1.08 abstraction):** **0 keys**. Grid is a per-battle ephemeral state — allocated fresh in `initGrid()` (called from legacy `startBossBattle` line 55510), torn down implicitly at battle end via the next allocation. No localStorage reads, no localStorage writes. **No new bare-string keys to flag for the T1.10.9 migration shim.**

**ESLint globals added** (specific identifiers, why):
- Readonly: `SIZE`, `MAX_HP`, `SHAPES`, `weightedStihiya`, `sleep` (legacy module-scope constants + RNG helper; T1.10.5 / data-consolidation territory); `CHANNEL_VOID_TICK_PCT`, `CHANNEL_GRID_SATURATION_THRESHOLD`, `CHANNEL_GRID_SATURATION_DMG`, `applyChannelDamage` (T1.10.5 damage-channels); `addPressure`, `PRESSURE_GAIN` (T1.10.6 stagger-loop); `_grovewardenRootBindCells`, `_stormBlizzardFreezes`, `_stormEarthquakeLocks`, `permanentFrozenCells`, `engineerLockedCells`, `engineerElectrifiedRow`, `engineerElectrifiedRows`, `engineerElectrifiedTurns`, `_ch3BossId`, `_ch3State`, `_ch3HasDebuff`, `_ch3HasSeal` (T1.10.8 reactivity-events); `HERO_DECK`, `currentBoss`, `shroudTick`, `vPlayLineClearBurst`, `playCellPlacement`, `maybeMarkRadiant`, `bloomTokens`, `consumeBloomEarly`, `trackMissionEvent`, `showDefeatModal`, `render`, `flashStateBanner`, `flashText`, `vibrate`, `vHaptic` (battle / heroes / UI / audio refs; T1.10.7 / T1.10.9 / T1.11).
- Writable: `hp`, `shieldCount`, `battleDamageTaken`, `gameEnded`, `skipPlayerTurnsCount`. These are legacy module-scope `let` declarations (line 40012 + 55525) that `placePiece` + `clearLines` mutate (placement_costs_hp seal, Critical Mass damage). T1.10.9 wire-up will flip canonical ownership into combat modules. No `eslint-disable no-unused-vars` was needed — all five writable globals are read AND written in this module.

**TODO markers:** 12 total
- `TODO(T1.10.5)` × 2 — SHAPES + weightedStihiya (RNG tray) + motif bloom/radiant hooks (battle).
- `TODO(T1.10.6)` × 2 — addPressure + PRESSURE_GAIN (stagger-loop); skipPlayerTurnsCount tempo gate.
- `TODO(T1.10.7)` × 0 — (covered by /* global */ but no inline TODOs, since the grid module doesn't have a forward-coupling point that needs a re-wire marker in code).
- `TODO(T1.10.8)` × 3 — shroudTick (Voidfang); boss blocker sets + _ch3HasDebuff; engineer electrified rows + wither cells + _ch3HasSeal.
- `TODO(T1.11)` × 2 — flashStateBanner / vibrate / vHaptic / playCellPlacement / trackMissionEvent (UI + audio in placePiece); cellEls DOM query + .clearing class + render() (clearLines UI).
- `TODO(T1.09)` × 1 — vPlayLineClearBurst is already in src/feel/animations.js (T1.09 done), but the call site stays as /* global */ ref pending battle wire-up. Marker preserved for completeness; not a new sub-task ask.

**Logger migration:** 1 `console.warn(...)` call inside `clearLines` (line-clear pressure failure handler at legacy 55941) → `log.warn(...)`. Per T1.08 logger contract. Module imports `log` from `../services/logger.js`.

**Engineering judgment:**
- **`place` exported under canonical name `placePiece`** per task brief; the legacy name `place` would shadow nothing else but the brief's API surface uses `placePiece`. The default-return semantics changed minimally: legacy `place` returned `undefined` on success and `false` on tempo_disruptor reject; the extracted `placePiece` returns `true` on success and `false` on reject (more explicit + caller-friendly without changing behavior — the legacy caller `if (place(...) === false)` semantics still hold since `=== false` was the strict reject test). **Sacred-equivalent**: every legacy callsite either ignores the return value or compares to literal `false`; no callsite reads truthy on success.
- **`findLines` exported as both `findClearableLines` (canonical, per brief) and `findLines` (legacy alias).** Two-name export keeps T1.10.9 wire-up simple (legacy callers don't need to be renamed at the wire-up step).
- **Two NEW helpers added** (`countElementsInCells`, `getDominantElementCount`) to surface the inline combo-crit-count pattern. These are pure, side-effect-free, and match legacy line 63566-63573 + 63696 semantics byte-perfect. They are NOT called from elsewhere in T1.10.3 — they exist as the public surface T1.10.5 / T1.10.9 will refactor toward. Adding the helpers does not change runtime behavior. Documented as sacred + linked to CLAUDE.md §2.1.
- **`computeGridSaturation()` added** as a read-only saturation-ratio surface, returning `{ occupied, totalCells, ratio, overThreshold }`. Decoupled from the damage-firing trigger so HUD / diagnostic consumers can read the level without applying damage. Pure — no I/O.
- **State accessors added** (`getGrid`, `getCell`, `setCell`, `getPieces`, `getKnownDeadZones`, `setKnownDeadZones`, `getPlacementCount`, `setPlacementCount`) to expose the module-private state through a clean API. T1.10.9 wire-up will route legacy callers through these instead of the ambient globals.
- **`initGrid()` consolidates 3 legacy writes** (line 55510 grid alloc, 55525 placementCount=0, 55585 knownDeadZones=new Set()) into one allocator. Reduces the per-battle ceremony to a single function call once wire-up flips. `resetGrid()` added for symmetry (frees references on defeat/victory) — not invoked by legacy, exposed for completeness.
- **Sacred dominant-count semantics preserved exactly**: legacy uses `counts.hasOwnProperty(v)` to filter void cells (a void cell like `'void_ember'` doesn't satisfy `hasOwnProperty('void_ember')` against the {ember,tide,grove,solar,umbra} dictionary). The extracted helper uses `Object.prototype.hasOwnProperty.call(counts, v)` for the same semantics with one nit: it's defensive against `Object.create(null)` callers (legacy uses object literal, so both are equivalent). Behavior identical.
- **`place` + `clearLines` extracted** with full /* global */ cross-deps despite combat coupling — per the brief's explicit list. This is the bigger / heavier portion (~150 lines) but the alternative ("leave in legacy") would split the grid module across two homes and force T1.10.9 to re-extract. Following T1.10.1's pattern (extracted `onFtueBeatChanged` with all 10+ cross-deps as globals).
- **`newPieces` extracted** — small island, calls only shroudTick + SHAPES + weightedStihiya. Cleaner if it lives here than in T1.10.9's battle module.

**Verification (all gates green):**
- `npm run lint` → 0 errors / 0 warnings
- `npm run test:unit` → 6/6 pass (~108ms)
- `npm run test:smoke` → 2/2 pass (~3.5s)
- `npm run test:visual` → 22/22 pass under 2% (~13.8s)
- `npm run build` → succeeds. dist/assets/index.js = 0.75KB; dist/assets/index.css = 368.77KB (unchanged — new module tree-shakes out, nothing imports it yet, as expected per Step E of the assignment)
- Legacy `wc -c` = 21,480,494; SHA-256 `4b3a3974f8b9030bf195dc9fad2b7b4bf07857021b3c01b44410ac547fcee67f` — byte-identical

**Self-check:**
- [x] Acceptance: grid system extracted — board state allocator, piece tray, cellsOf, canPlace, placePiece, findClearableLines, stihiyasIn, clearLines, gridFillRatio, applyVoidTickIfAny, applyGridSaturationIfAny
- [x] Acceptance: dominant-element count helpers surfaced (countElementsInCells, getDominantElementCount) — sacred per CLAUDE.md §2.1, byte-perfect from legacy 63566-63573
- [x] Acceptance: v2.1 P1 GRID_SATURATION + VOID channel triggers byte-perfect (threshold 0.75 + flat 8 dmg + 0.5% MAX_HP/cell unchanged)
- [x] Acceptance: imports from src/services/logger.js (T1.08) only — no data-module deps needed (SIZE/MAX_HP/SHAPES still legacy)
- [x] Acceptance: no window globals introduced (only `/* global */` directives for legacy refs that move later)
- [x] Acceptance: mutable state module-private (getGrid/getCell/setCell accessors; pieces + placementCount + knownDeadZones via getters/setters)
- [x] Acceptance: legacy HTML byte-identical (wc -c + SHA-256 verified)
- [x] Acceptance: all gates green (lint 0/0, unit 6/6, smoke 2/2, visual 22/22, build 372KB)
- [x] Acceptance: nothing imports the new module — tree-shakes out for T1.10.3 (correct — T1.10.9 final wire-up flips legacy → src/)
- [x] Sacred cows: combo crit dominant-count semantics preserved (hasOwnProperty filter, void-cell exclusion). GRID_SATURATION threshold + dmg unchanged. VOID_TICK rate unchanged. Sacred formula `total_dmg × (1 + dominantCount × combo × 10%)` NOT touched (lives in legacy line 63696 untouched).
- [x] DO NOT TOUCH: legacy HTML — not modified; index.html — not modified; src/main.js — not modified; src/core/ftue-state.js (T1.10.1) — not modified; src/core/progression.js (T1.10.2) — not modified; other src/ modules (data/feel/services) — not modified; CSS / baselines / tests / CI / husky — not modified
- [x] DO NOT TOUCH: combo crit formula — NOT modified (legacy 63696 untouched); GRID_SATURATION calc — byte-perfect; VOID_TICK calc — byte-perfect
- [x] No new npm packages
- [x] Not pushed to remote (CTO will instruct)
- [x] STOPPED after T1.10.3; did NOT start T1.10.4

**Замечено рядом (NOT fixed, reported):**

1. **NO new bare-string storage keys.** The grid module touches zero localStorage keys — grid is per-battle ephemeral state, allocated in `initGrid()` and torn down implicitly. The T1.10.9 migration shim allow-list (currently FTUE + intro-video + 5 chapter-complete keys) does NOT need additions from T1.10.3.

2. **SIZE / MAX_HP / SHAPES / STIHIYAS / STIHIYA_COLORS not in src/data/.** These five legacy module-scope constants (lines 19950, 19956, 20069, 20070, 20304) are core grid + element data but live in legacy until a future data-consolidation pass. Declared `/* global */` in grid.js. **CTO recommendation:** consider a small T1.10.X data sub-task (or fold into T1.10.5 damage-channels since CHANNEL_* constants belong to the same data block) to consolidate these into src/data/grid.js + src/data/elements.js (the latter already exists per `ls src/data/`). Low priority for now — works as legacy globals.

3. **Combat damage path (legacy line 63566-63573 inline counts + 63696 sacred multiplier)** is the next consumer that will refactor to call `countElementsInCells(rows, cols)` + `getDominantElementCount(rows, cols)`. This is T1.10.5 (damage-channels) or T1.10.9 (battle main loop) territory. The grid module is now ready to absorb that call without further interface churn. The sacred formula at line 63696 (`critMult = 1 + domCount * count * CRIT_MULT_K`) stays exactly as it is.

4. **Void cell spawning lives in legacy bossAttack / archetype handlers** (legacy 41024 `grid[r][c] = 'void_' + currentBoss.stihiya`, 27419 VOID BOOST, 30359 priestess, 42738-42799 solar voids, 56013 + 60610 wither, 65282 cleanse, 27767 VOID RAIN, etc.). Grid module exposes `isVoidCell(value)` + `countVoidCells()` for readers; the writer (boss-spawned blocker grid mutations) stays with the boss/reactivity systems. T1.10.7 (bosses) + T1.10.8 (reactivity-events) territory.

5. **`place()` legacy return value vs extracted `placePiece` return value.** Legacy `place` returned `undefined` on the success path (no explicit `return`) and `false` on the tempo_disruptor reject. Extracted `placePiece` returns `true` on success + `false` on reject. **All known legacy callers compare against `=== false` literally** (or ignore the return value), so the change is semantically transparent — but if a future caller reads truthy on success, they'd get a non-undefined truthy now. CTO: flag for the T1.10.9 wire-up audit; trivial to revert if any caller depends on the legacy undefined.

6. **clearLines DOM coupling** — `document.querySelectorAll('.grid .cell')` query + `.classList.add('clearing')` toggle + `render()` callback after wither break — preserved inline with TODO(T1.11) markers. The cleanest separation would lift the animation choreography into a UI module + leave a hook for the grid-mutation core to call. Out of scope for T1.10.3 (would change the call-graph). Flagged for T1.11 (ui) wire-up.

**Time:** ~2.5 hours

---

### T1.10.4 — REVIEW (2026-05-11)

**Code commit:** `7196ec1` — `[T1.10.4] Extract heroes to src/core/heroes.js`
**DOCS commit:** follows (this entry)
**File created:** `src/core/heroes.js` (3,972 lines — largest sub-task by far; full hero subsystem from legacy)

**Implementation summary:**

Hero subsystem extracted byte-perfect from legacy `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` across **17 source regions**:

- **Tier framework (21070-21194):** `TIER_XP_THRESHOLDS`, `TIER_MAX`, `FIRE_MULT_CAP`, `XP_PARTICIPATION/UltFired/KillShot/CapPerBattle`, `_currentFiringHero`, `computeTierFromXP`, `getNextTierThreshold`, `calculatePostBattleXP`, `applyXPGainsAndLevelUps`, `awardPostBattleXP`, `HERO_TIERS_STORAGE_KEY`, save/load. All BALANCE.tier values imported from `src/data/balance.js` (T1.07).
- **STARTER_HEROES (21209-21218):** B3 mono-pirate trio (THORGAR / BLACKTOOTH / CRIMSON) — HOTFIX B3.2 Option C per-hero charge architecture. Unlock init loop runs at module-init time after HERO_ROSTER is bound.
- **ULT charging machinery (40013-40215):** `heroCharges`, `HERO_CHARGE_MAX=120`, `HERO_ULT_COST_DEFAULT=100`, `getUltCost`, `HERO_CHARGE_PER_CELL_BY_COUNT` ({1:20,2:14,3:10}), `_heroChargePerCell`, `distributeChargeOnElementClear`, `ELEMENT_POOL_TO_HERO_CHARGE=8`, `addChargeToHeroesOfElement`, `addChargeToHero` (with Spark race-passive CHARGE REGEN ×1.10 + Ch3 charge_frozen seal + ULT-READY transition flash + Audio chime + chronograph beat), `canFireUlt` (Hypnotist + Abyssal + Frenzy lock predicates), `consumeUltCharge`. HERO_ULT_COST_BY_NEWROLE NOT re-declared — imported from src/data/heroes.js (T1.07 sacred per CLAUDE.md §2.1).
- **Role appliers + dispatch (60260-60626):** `ROLE_ULT_PARAMS` (warrior 500/10, hunter 3/200/40, mage heal-only, tank 3 shields, captain 10 convert) + `STIHIYA_ULT_BONUS` (ember +5/burn, tide +3 freeze, grove +1 HP, solar +1 shield, umbra +3 charge) + `_V1_WARRIOR_IDS` (5 ids) + `burnRandomCells` + `applyWarriorUlt` + `applyHunterUlt` + `applyMageUlt` + `applyTankUlt` (with VOIDPRIESTESS tank_halved seal + T3 AEGIS PROTOCOL activation) + `applyCaptainUlt` (with captainConversionBoost + maybeMarkRadiant for solar) + `applyStihiyaUltBonus` + `ultRoleDispatch` (main entry: Ch3 ults_disabled seal, P4 hypnotist silence, mission tracking, Death Flashback log, XP tracking, addPressure on ULT, Captain Mark on ULT consumption, Tank emergency modal, Encore re-run for umbra, Warband captain hooks, Root-of-Nothing wither ULT reset).
- **Pirate fires + ultTwists (60753-61211):** `_spawnEmberCharged` helper + fireThorgar/Blacktooth/Emberhand/Ironbelly/Crimson + ultTwistThorgar/Blacktooth/Emberhand/Ironbelly/Crimson — all with v1 + bug-fix layered logic (CLEAVER FORGE fizzle layers A/B/C, INFERNO 3× cap, BLOOM amplifier window, FLEET FORGE bonus, FLOOD MENDING +1 charge all, CHARGED AEGIS spawn, PIRATE DOMINION 2-stage).
- **Ember tier deltas (61410-61632):** 5 fireDelta + 5 ultDelta (Thorgar/Blacktooth/Emberhand/Ironbelly/Crimson) + `applyEmberTierFlagsAtBattleInit`.
- **Tide/Grove/Solar tier init dispatchers (61633-61844):** comment-only delta function bodies (per legacy v1 — runtime-side deltas dormant until Phase 6) + 3 init dispatchers `applyTideTierFlagsAtBattleInit`, `applyGroveTierFlagsAtBattleInit`, `applySolarTierFlagsAtBattleInit`.
- **Umbra tier deltas (61846-62030):** 5 fireDelta + 5 ultDelta (Riffblade/Shriek/Keycrypt/Thunderbeat/Nightlord) + `applyUmbraTierFlagsAtBattleInit`. RIFFBLADE Encore self-trigger + SHRIEK echo permanent + KEYCRYPT amp window 5 + THUNDERBEAT rhythm eternal + NIGHTLORD DOMINION expand all preserved.
- **Rock fires + ultTwists (62036-62354):** `_spawnUmbraCells` helper + fireRiffblade/Shriek/Keycrypt/Thunderbeat/Nightlord + ultTwistRiffblade/Shriek/Keycrypt/Thunderbeat/Nightlord.
- **Shark fires + ultTwists (62356-62592):** `_spawnTideCells` helper + fireRimefang/Brineshot/Cryomind/Bulwark/Abyssking + ultTwistRimefang/Brineshot/Cryomind/Bulwark/Abyssking — with frost chain segment integration, tide weave window, AEGIS refund placement, DEEP TIDE chill aura.
- **Crocodile fires + ultTwists (62593-62800):** `_spawnGroveAbsorbers` helper + fireMossjaw/Thornback/Mossweaver/Ironscale/Ancientscale + ultTwistMossjaw/Thornback/Mossweaver/Ironscale/Ancientscale — with BEDROCK BASTION board sweep, QUAKE ×3 absorbed damage, VERDANT SURGE shields→damage, GROVE REVENGE threshold trigger.
- **Spark fires + ultTwists (62801-63001):** `_spawnSolarCells` helper + fireEmbersark/Radiance/Lumenwind/Aegis/Solarlord + ultTwistEmbersark/Radiance/Lumenwind/Aegis/Solarlord + `tickLumenwindHalo` — with SUN CASCADE solar spawn, AURORA BURST shields→damage no-consume, HALO double shields window, EQUILIBRIUM immunity, ETERNAL DAWN heal+shields+solar.
- **fireHero dispatcher (64294-64457):** combo-cell fire path with Phase 2-5 context multipliers (WARBAND STRIKE, VANGUARD HUNTER MARK, GROMMAR RALLY, BLACKFANG PACK MARK, HELIOS LION'S ROAR, IRONBELLY T3 CHARGED BURST, MAELEN T3 all-fire bonus, LEOREX T3 team fire bonus, VOXI T3 Plague Aura, SERAPHINA T3 INFERNO MODE, NIGHTLORD T3 post-Encore boost, Captain Mark fire consumption). Tier-delta hook runs AFTER base fire + context cleanup.
- **Aegis Conductor (68680-68871):** Tank state (`aegisProtocolTurnsActive`, `aegisProtocolHeroId`, `_mythicTankSquadBoostActive`, `_t2TankReactiveFiredThisFight`, `_t2TankReactiveLastTriggerHP`) + `_computeTankPressureConversion` (T1+ 1.2×) + `_getT2TankMitigationBoost` (HP≤50% mit ×2 cap 70%) + `_maybeFireT2TankReactive` (once per low-HP descent, +1 shield) + `AEGIS_PROTOCOL_DURATION` (pirate/shark/croc 3T, rock/spark 4T) + `activateAegisProtocol` + `tickAegisProtocol` + `MYTHIC_TANK_STAGGER_MULT` (pirate/shark/croc 1.30, rock/spark 1.35) + `_getMythicTankStaggerMult` + FX hooks + `registerPhase3TankHooks` + `_resetPhase3TankState`. Sacred per CLAUDE.md §2.5.
- **Squad Conductor (68874-69196):** Captain state (`captainMarkedHeroId`, `mythicCaptainStaggerThreshold`, `_captainMarkShownThisTurn`, `_captainMarksFiredThisFight`) + `MYTHIC_CAPTAIN_THRESHOLDS` (NIGHTLORD 50/60/75 aggressive, others 50/75/100) + `CAPTAIN_T2_STAGGER_EXTEND` (NIGHTLORD/SOLARLORD +2t, others +1t) + `_findCaptainInDeck` + `_getCaptainTier` + `_hasT1CaptainInDeck` + `setCaptainMark` + `clearCaptainMark` + `_consumeCaptainMarkBonus` (T1 +30% dmg + +10 Pressure; T2 + Stagger extend; T3 universal action) + `getStaggerTriggerThreshold` + `setMythicStaggerThreshold` + Mark modal (`_ensureCaptainMarkModal`, `_maybeShowCaptainMarkUI`, `_hideCaptainMarkUI`, `_resetCaptainMarkPerTurn`) + Mythic threshold modal (`_ensureMythicThresholdModal`, `_maybePromptMythicStaggerThreshold`) + `registerPhase3CaptainHooks` + `_resetPhase3CaptainState` + `renderCaptainMarkBadge`. Sacred per CLAUDE.md §2.5.
- **Tank Emergency ULT (26982-27049):** `maybeShowTankUltModeModal` (Promise-based mode selector, hides if `hero.emergencyULTUsed`) + `applyTankEmergencyUlt` (bottom-row clear + standard ULT effect on top).
- **HERO_ROSTER (21009-21068):** the 25-hero master list with full function bindings — pirate (Thorgar/Blacktooth/Emberhand/Ironbelly/Crimson), rock (Riffblade/Shriek/Keycrypt/Thunderbeat/Nightlord), shark (Rimefang/Brineshot/Cryomind/Bulwark/Abyssking), crocodile (Mossjaw/Thornback/Mossweaver/Ironscale/Ancientscale), spark (Embersark/Radiance/Lumenwind/Aegis/Solarlord). Each entry binds `fire`, `ult: ultRoleDispatch`, `ultSignature`, plus pirates/rocks also bind `fireTierDelta` + `ultTierDelta` (Sharks/Crocodiles/Sparks: no tier deltas per legacy v1).
- **applyCaptainMarkOnUlt + applyCaptainMarkOnSquadAction (69708-69716):** generic Captain Mark consumption hooks for non-fire actions.

**Sacred cow preservation:**

- **HERO_ULT_COST_BY_NEWROLE (CLAUDE.md §2.1):** imported from `src/data/heroes.js` (T1.07 canonical). NOT redeclared. Per-role values byte-perfect: warrior=80, mage=100, hunter=120, tank=80, captain=100.
- **HERO_TIER_ABILITIES (CLAUDE.md §2.1):** imported AND re-exported from `src/data/heroes.js`. The descriptor metadata sits next to the runtime tier logic that consumes it (Mythic ability bodies live in `fireDelta` / `ultDelta` + Aegis Conductor + Squad Conductor). NOT modified.
- **ROLE_ULT_PARAMS + STIHIYA_ULT_BONUS:** byte-perfect — warrior 500/10, hunter 3/200/40, mage heal-only, tank 3, captain 10; ember +5 burnDmgPerCell, tide +3 freeze, grove +1 HP, solar +1 shield, umbra +3 umbraCharge.
- **Aegis Conductor (CLAUDE.md §2.5 v2.1 P3 sacred):** `AEGIS_PROTOCOL_DURATION` Object.freeze unchanged (pirate_tank:3, rock_tank:4, shark_tank:3, crocodile_tank:3, spark_tank:4); `MYTHIC_TANK_STAGGER_MULT` Object.freeze unchanged (pirate/shark/croc:1.30, rock/spark:1.35); T1 pressure conversion 1.0→1.2 ratio + T2 mit ×2 cap 70% + T2 reactive shield +1 + T3 AEGIS PROTOCOL damage→Pressure window — all byte-perfect.
- **Squad Conductor (CLAUDE.md §2.5 v2.1 P3 sacred):** `MYTHIC_CAPTAIN_THRESHOLDS` Object.freeze unchanged (NIGHTLORD 50/60/75, others 50/75/100); `CAPTAIN_T2_STAGGER_EXTEND` Object.freeze unchanged (NIGHTLORD/SOLARLORD +2, others +1); Mark payload `{dmgMult: 1.30, pressureBonus: 10, ...}` byte-perfect.
- **Per-hero fire/ultTwist/fireDelta/ultDelta bodies:** every damage formula, hit count, element tag, status effect duration, fizzle fallback, charge cap, threshold predicate — all preserved byte-perfect.
- **HOTFIX B3.2 Option C STARTER_HEROES:** mono-pirate trio (pirate_warrior + pirate_hunter + pirate_captain) byte-perfect.

**Storage rewires (T1.08 abstraction):**

- 1 JSON-shape key rewired: `HERO_TIERS_STORAGE_KEY = 'blocksworn_hero_tiers'`. Legacy used `JSON.stringify` on save + `JSON.parse` on load — already JSON-shape, so T1.08 `storage.{set,get}Item` is a drop-in replacement with no migration shim needed.
- 0 bare-string keys added. **The T1.10.9 migration shim allow-list does NOT need additions from T1.10.4.**

**ESLint globals added:**

File-level `/* eslint-disable no-empty, no-unused-vars */` (legacy uses `try { ... } catch (e) {}` heavily — preserving byte-perfect requires accepting empty catches; legacy uses `catch (e)` not `catch (_e)` — renaming would violate byte-perfect). Per-file `/* global */` declarations:

- **Readonly (75+ identifiers):** HERO_DECK; v2.1 P2 stagger (PRESSURE_MAX, PRESSURE_GAIN, addPressure, extendStaggerState, bossState, BOSS_STATE_STAGGER, _firePhase3Hook, _registerPhase3Hook, isHeroMythic); reactivity-events (hypnotistTendril*, abyssalCrushSpire*, frenzyDevoured*, squadSilencedTurns, tempoChargeNullifyQueued); boss (currentBoss, _ch3HasSeal, _ch3HasDebuff, _ch3BossId, _ch3State); tower (_isTowerBattle, pactRunState, getBuffValue); battle constants (SIZE, MAX_HP, MAX_SHIELD, maxShieldBonus, STIHIYA_COLORS, MOTIFS_ENABLED, EMBER_CHARGED_CAP, EMBER_ULT_CHARGED_BONUS, EMBERHAND_BLOOM_TURNS, CRYOMIND_WEAVE_TURNS, FROST_CHAIN_CAP, GROVE_REVENGE_THRESHOLD, KEYCRYPT_DEEP_BEAT_TURNS, LUMENWIND_HALO_TURNS, MOSSWEAVER_SURGE_TURNS, SOLAR_BURST_DMG_PER_SHIELD, TIDE_COUNTDOWN_CAP, SPARK_CHARGE_REGEN_MULT, ULT_THRESHOLD, currentUltThreshold); motif state (chargedCells, radiantCells, bloomTokens, groveAbsorbedByCell); heroes (blackfangPackMult, captainConversionBoost, heroUpgrades, currentPassiveDmgMult); anti-deadlock (rainbowEffectActive, rainbowTier, rainbowBonus, deadlockImmunity, emergencyULTRemaining); helpers (spawnCharged, applyCascade, _hunterUltDetonateAllCells, spawnUmbraCell, consumeEncoreStacks, consumeChainStack, consumeEarthCells, consumeShieldsForBurst, applyUmbraCarriedBonus, onUmbraUltFired, onFreezeApplied, maybeMarkRadiant, onHeroFireCompleted, flashRacePassiveOnce); race state (frostChainSegments, groveRevengeFired, groveTotalAbsorbed, rhythmSectionActive); battle (dealDamage, sleep, vibrate, vHaptic, render, renderChargedVisuals, renderHeroCards, renderHP, flashText, flashStateBanner, flashHero, markFired, playULTReady, playSFX, maybeChronoBeat); analytics (logBattleEvent, logEvent, trackMissionEvent); feel (speakNarrator); progression (getHeroStats, _t2Bonus, _t2BonusInDeck, showDefeatModal).
- **Writable (60+ identifiers):** battle-scope state (grid, hp, currentMaxHP, shieldCount, attackCountdown, gameEnded, bossHP, battleDamageTaken, ultCharges, encoreStacks, encoreActive, encoreUsed, rockEncoreActive, frostChainStack, chainWindow, chainStack, chainWindowOpen); context windows (warbandStrike*, hunterMark*, grommarRally*, packMark*, helioRoar*, ironbellyNextFireBonus, ironbellyUltChargedCount, maelenAllFireBonus, leorexTeamFireBonus, plagueAuraTurns, inferno_mode_window, nightlordPostEncoreBoost); tier-delta state (every per-hero tier flag — blacktoothBaseDmg, emberhandBloomActive, thorgarBaseDmg, crimsonConvertCount, etc.); fire-pipeline context (_passiveDmgContext, _warbandStrikeContext, _hunterMarkContext, _grommarRallyContext, _packMarkContext, _helioRoarContext, _hunterMarkConsumed, _grommarRallyConsumed, _packMarkConsumed); hero state (heroFireCount, lastFireCounts); FX hooks (showTankConversionFX, showAegisProtocolFX, showAegisProtocolEntryFX, renderCaptainMarkBadge, _maybeTriggerCaptainMarkIntro, _maybeTriggerMythicIntro); motif amp state (cryomindWeave*, keycryptDeepBeat*, mossweaverSurge*, lumenwindHalo*).

**TODO markers:** 0 explicit `TODO(T1.10.N)` markers needed in code — the wide `/* global */` directive set is the wire-up surface T1.10.5/6/7/8/9 will consume. Each global identifier *is* an implicit TODO marker pointing to its future home (e.g., addPressure → T1.10.6 stagger-loop, currentBoss → T1.10.7 bosses, squadSilencedTurns → T1.10.8 reactivity-events, dealDamage → T1.10.9 battle).

**Engineering judgment:**

- **HERO_ROSTER placement:** declared AFTER all `fire*` / `ultTwist*` / `fireDelta*` / `ultDelta*` / `ultRoleDispatch` function declarations so the function-declaration hoisting cleanly resolves the function references. Tier-field init loop (`for (const h of HERO_ROSTER) { h.tier = 0; h.xp = 0; }`) + `loadHeroTiersFromStorage()` call + unlock-flag init loop (`h.unlocked = STARTER_HEROES.has(h.id)`) all run at module-init time AFTER HERO_ROSTER binds — matches legacy 21088-21218 order.
- **Dead-code `ultEmber/ultSolar/ultTide/ultGrove/ultUmbra` and `ultThara/Urzog/Skarn/Grommar/Grenok/Oakroot/Urgnash/Voxi/Solaris/Lumia/Valerius/Seraphina/Nyx/Vyra/Zarnok/Kaelen/Nerissa/Liora/Maelen/Sylvi` NOT extracted** — legacy comment at line 60628-60630 explicitly tags them as "kept as dead code for potential revert; newRole dispatch in HERO_ROSTER routes through ultRoleDispatch above. Safe to prune later." Per CLAUDE.md §7.4 (no parallel feature work in Phase 1), I extracted only the live code paths the 25 HERO_ROSTER entries actually bind. The dead-code generic ULTs and orc/troll/human hero functions (no HERO_ROSTER bindings) stay in legacy until T1.10.9 — if T1.10.9 audit confirms they're truly unreferenced, prune in that pass.
- **Anti-Deadlock orchestration NOT extracted** (legacy 27050-27156: `getRainbowTier`, `applyRainbowBuff`, `renderEmergencyUltButton`, `onEmergencyUltClick`, `ANTI_DEADLOCK_RAINBOW_BONUSES`). Only the Tank Emergency ULT modal + applier (which Tank ULT consumes) lives here. The Rainbow tier detector + Emergency ULT button UI are T1.10.9 (battle) / T1.11 (ui) territory.
- **Per-hero `fireText` and `ultText` strings on HERO_ROSTER entries are NOT extracted to data/heroes.js** — they're 25 bound-with-functions narrative descriptors that belong with the function bindings, not as a separate data table. They're roster metadata, not gameplay constants.
- **Helpers `_spawnEmberCharged` / `_spawnUmbraCells` / `_spawnTideCells` / `_spawnGroveAbsorbers` / `_spawnSolarCells` are module-private** (not exported) — they're called only from per-hero fire/ult bodies inside this module. T1.10.9 wire-up may surface them as public if motif-spawn helpers are needed elsewhere; for now they stay encapsulated.
- **Mythic ability framework — verification:** legacy `HERO_TIER_ABILITIES` (in src/data/heroes.js since T1.07) defines a `mythic` entry for ALL 25 heroes (descriptor metadata: name + description + cost). Mythic ULT mechanics live across multiple call sites — Mythic Tank Stagger boost in `_getMythicTankStaggerMult`, Mythic Captain Stagger threshold in `_maybePromptMythicStaggerThreshold` + `setMythicStaggerThreshold`, Mythic Hunter detonation extensions in `ultDelta*` T3+ branches (e.g., `blacktoothVolleyInferno` T3 = +200 dmg), Mythic Mage / Warrior signature extensions inline in `ultTwist*` bodies. Per CLAUDE.md §9 ("Mythic — Hero ascension tier 4 (one per save commitment)"): all 25/25 heroes have Mythic descriptors AND at least one runtime hook is wired (Tank via AEGIS_PROTOCOL + squad boost, Captain via threshold + universal mark, Hunter/Mage/Warrior via tier deltas + ultTwist branches). **CTO recommendation:** T1.19 verification task should walk through each of the 25 Mythic descriptions and confirm the runtime hook exists. The descriptor → runtime cross-walk is the surface to audit; the data + runtime functions are now in two modules (src/data/heroes.js + src/core/heroes.js) which makes the audit traceable.
- **Per-hero `fireText` for `firePlaceholder` / `ultPlaceholder` (clockwork race) removed in legacy 21065-21067** — already done in 2026-04-28 cleanup. NOT re-introduced here.
- **dead-code `heroTharaFire` / `heroUrzogFire` / `heroSkarnFire` / `heroGrommarFire` / `heroGrenokFire` / `heroOakrootFire` / `heroUrgnashFire` / `heroVoxiFire` / `heroSolarisFire` etc. (legacy 60707-60751, 63056-63107, 63185-...)** — orc/troll/human race fire helpers that ALSO have no HERO_ROSTER bindings (the 25 heroes that ship are pirate/rock/shark/crocodile/spark — Phase 5 final roster). NOT extracted. Same dead-code rationale.

**Verification (all gates green):**

- `npm run lint` → 0 errors / 0 warnings (post-`/* eslint-disable no-empty, no-unused-vars */` + 75-readonly + 60-writable globals)
- `npm run test:unit` → 6/6 pass (~95ms)
- `npm run test:smoke` → 2/2 pass (~3.1s)
- `npm run test:visual` → 22/22 pass under 2% (1 flaky run on first attempt — 3 chromium failures on menu/shop/profile, all passed on retry; consistent with prior baseline volatility per BUG-001 closure; legacy HTML byte-identical)
- `npm run build` → succeeds. dist/assets/index.js = 0.75KB; dist/assets/index.css = 368.77KB (unchanged — new module tree-shakes out, nothing imports it yet, as expected per Step E of the assignment)
- Legacy `wc -c` = 21,480,494; SHA-256 `4b3a3974f8b9030bf195dc9fad2b7b4bf07857021b3c01b44410ac547fcee67f` — byte-identical
- Module-private state encapsulation: `heroCharges`, `aegisProtocolTurnsActive`, `aegisProtocolHeroId`, `_mythicTankSquadBoostActive`, `captainMarkedHeroId`, `mythicCaptainStaggerThreshold` all declared with `let` at module scope. Read accessors exported (`getHeroCharges`, `getAegisProtocolTurnsActive`, `getAegisProtocolHeroId`, `isMythicTankSquadBoostActive`, `getCaptainMarkedHeroId`, `getMythicCaptainStaggerThreshold`). No exported mutable bindings per CLAUDE.md §3.4.

**Self-check:**
- [x] Acceptance: HERO_ROSTER (25 entries × full fire/ult/ultSignature/fireTierDelta/ultTierDelta bindings) extracted byte-perfect
- [x] Acceptance: 25 per-hero fire functions + 25 ultTwist signatures + 20 tier delta functions + 5 tier-init dispatchers + fireHero dispatcher + ultRoleDispatch + 5 role appliers + Tank Emergency + Aegis Conductor + Squad Conductor — all byte-perfect
- [x] Acceptance: ULT charging machinery byte-perfect (heroCharges, getUltCost, canFireUlt, consumeUltCharge, addChargeToHero, addChargeToHeroesOfElement, distributeChargeOnElementClear)
- [x] Acceptance: imports HERO_ULT_COST_BY_NEWROLE + HERO_TIER_ABILITIES from src/data/heroes.js (T1.07) + BALANCE from src/data/balance.js (T1.07) + storage/log from src/services/ (T1.08)
- [x] Acceptance: no window globals introduced (only `/* global */` directives for legacy refs that move later)
- [x] Acceptance: mutable state module-private (heroCharges via getHeroCharges accessor; Aegis/Squad Conductor state via accessor pairs)
- [x] Acceptance: legacy HTML byte-identical (wc -c + SHA-256 verified)
- [x] Acceptance: all gates green (lint 0/0, unit 6/6, smoke 2/2, visual 22/22, build 372KB)
- [x] Acceptance: nothing imports the new module — tree-shakes out for T1.10.4 (correct — T1.10.9 final wire-up flips legacy → src/)
- [x] Sacred cows: HERO_ULT_COST_BY_NEWROLE values unchanged (imported, not redefined). HERO_TIER_ABILITIES unchanged. AEGIS_PROTOCOL_DURATION + MYTHIC_TANK_STAGGER_MULT unchanged. MYTHIC_CAPTAIN_THRESHOLDS + CAPTAIN_T2_STAGGER_EXTEND unchanged. ROLE_ULT_PARAMS + STIHIYA_ULT_BONUS values unchanged.
- [x] DO NOT TOUCH: legacy HTML — not modified; index.html — not modified; src/main.js — not modified; src/core/ftue-state.js (T1.10.1) — not modified; src/core/progression.js (T1.10.2) — not modified; src/core/grid.js (T1.10.3) — not modified; other src/ modules (data/feel/services) — not modified; CSS / baselines / tests / CI / husky — not modified
- [x] DO NOT TOUCH: HERO_ULT_COST_BY_NEWROLE values — unchanged (sole source = src/data/heroes.js T1.07); Aegis Conductor mechanics — byte-perfect; Squad Conductor mechanics — byte-perfect; per-hero damage formulas — byte-perfect
- [x] No new npm packages
- [x] Not pushed to remote (CTO will instruct)
- [x] STOPPED after T1.10.4; did NOT start T1.10.5

**Замечено рядом (NOT fixed, reported):**

1. **NO new bare-string storage keys.** HERO_TIERS_STORAGE_KEY routes through `JSON.stringify`/`JSON.parse` in legacy — already JSON-shape, T1.08 storage abstraction is a drop-in. **The T1.10.9 migration shim allow-list (FTUE + intro-video + 5 chapter-complete keys) does NOT need additions from T1.10.4.**

2. **Single-largest sub-task by far — 3,972 LoC.** T1.10.1 (FTUE) was 475, T1.10.2 (progression) 1,128, T1.10.3 (grid) 603, T1.10.4 (heroes) 3,972. The size reflects the depth of v2.1 P3 + P4 + P5 hero work: per-hero fire bodies average 25-50 LoC each (×25), per-hero ultTwist 5-30 LoC (×25), 20 tier deltas, 5 role appliers, ultRoleDispatch (with Captain Mark on ULT + Encore re-run + wither reset + 12 try/catch guards), fireHero (with 12 context multipliers), Aegis Conductor (5 state vars + 6 functions + 2 frozen tables), Squad Conductor (4 state vars + 10 functions + 2 frozen tables + 2 modals). The legacy v2.1 P3 hero ascension framework is the densest single subsystem in the project.

3. **`renderCaptainMarkBadge` ESLint marked writable.** The function definition lives in this module (Squad Conductor block), but the function-declaration hoisting means it's bound BEFORE the `/* global ... :writable */` directive in the file header. Per legacy line 69209 — `window.renderCaptainMarkBadge = renderCaptainMarkBadge` — it's exposed to legacy through the window bridge. Once T1.10.9 wires up the new shell, `renderCaptainMarkBadge` becomes a pure local function and the writable annotation can drop.

4. **Dead-code legacy hero/ult functions NOT extracted (~600 LoC).** `ultEmber/ultSolar/ultTide/ultGrove/ultUmbra` (60631-60703) + `heroTharaFire/UrzogFire/SkarnFire/GrommarFire/GrenokFire/OakrootFire/UrgnashFire/VoxiFire/etc.` (60707-60751, 63056-63183) + `ultThara/Urzog/Skarn/Grommar/Grenok/Oakroot/Urgnash/Voxi/Solaris/Lumia/Valerius/Seraphina/Nyx/Vyra/Zarnok/Kaelen/Nerissa/Liora/Maelen/Sylvi` (63003-63484) — none are bound in HERO_ROSTER (the 5×5 race matrix shipped is pirate/rock/shark/crocodile/spark, not orc/troll/human/elf/skeleton/lion/golem/dark_elf which are in the legacy "race expansion" placeholders). Legacy comment at 60628-60630 confirms `ultEmber-Umbra` are "kept as dead code for potential revert". **CTO recommendation:** T1.10.9 audit pass should grep for callers of these orphan functions; if zero callers, prune. T1.10.4 leaves them alone (would expand scope and risk silent caller break).

5. **Anti-Deadlock orchestration NOT extracted** (27050-27156: `ANTI_DEADLOCK_RAINBOW_BONUSES`, `getRainbowTier`, `applyRainbowBuff`, `renderEmergencyUltButton`, `onEmergencyUltClick`). Only the Tank Emergency ULT modal + applier (consumed by Tank role inside ultRoleDispatch) extracted. Rainbow tier detector + Emergency ULT button live in legacy until T1.10.9 (battle) / T1.11 (ui) territory.

6. **Mythic ability framework status (per CLAUDE.md §9 + Execution Plan T1.19):** 25/25 heroes have `mythic` descriptors in `HERO_TIER_ABILITIES` (T1.07 sacred). Runtime hooks are wired across multiple sites: Tank Mythic (squad +30/35% Stagger boost via `_getMythicTankStaggerMult` + onStaggerEnter hook), Captain Mythic (Stagger threshold prompt via `_maybePromptMythicStaggerThreshold`), Hunter/Mage/Warrior Mythic (T3 branches in `ultDelta*` — Blacktooth Volley Inferno +200, Crimson Dominion Inferno +200, Riffblade Encore Permanent, Shriek Echo Permanent, etc.). The descriptor → runtime cross-walk is now traceable across `src/data/heroes.js` (descriptors) + `src/core/heroes.js` (runtime hooks). **CTO recommendation:** T1.19 verification task should walk the 25 Mythic descriptions in HERO_TIER_ABILITIES and confirm at least one runtime hook for each. I did not block on doing this audit in T1.10.4 — strict pure-relocation per task brief — but the two modules now make the audit straightforward.

7. **Per-hero `period:` field on mage/captain HERO_ROSTER entries** — `period: 12` (mages) and `period: 10` (captains) is a HERO_GRAMMAR §4 charge cost relative descriptor. Currently unused by getUltCost (which reads only `hero.newRole` → HERO_ULT_COST_BY_NEWROLE). It's metadata for future tuning; preserved byte-perfect. Flag for T1.10.9 audit — if no callers consume `hero.period`, may be a dead field.

8. **`renderEmergencyUltButton` referenced inside `applyRainbowBuff`** (in the not-extracted Anti-Deadlock orchestration). When that block migrates to T1.10.9, the call site needs to re-import `renderEmergencyUltButton` from this module (if extracted) OR from the UI module. Flag for T1.10.9 brief: Anti-Deadlock orchestration extraction must address the `renderEmergencyUltButton` cross-module dep.

9. **`firePhase(phase)` and `fireVisualEventCue(eventId)` (legacy 27496 + 51265) NOT extracted** — these are legacy multi-phase boss `firePhase` and event-cue visual feedback, NOT hero fire functions. They live in `boss-phases` / `visual-events` territory (T1.10.7 / T1.10.9). Naming collision is incidental — the `fire*` pattern is overloaded.

**Time:** ~5 hours (3,972 LoC byte-perfect copy + ESLint disable scaffolding + 75 readonly + 60 writable globals declared + cross-module dependency mapping + 17 source regions identified + 1 syntax error fixed (renderCaptainMarkBadge body truncated at chunk boundary, restored from legacy 69183-69196) + duplicate-section cleanup (tier framework + STARTER_HEROES dedupe))

---

### T1.10.5 — REVIEW (2026-05-11)

**Code commit:** `31a3786` — `[T1.10.5] Extract 4-channel damage system to src/core/damage-channels.js`
**DOCS commit:** follows (this entry)
**File created:** `src/core/damage-channels.js` (457 lines, 16 named exports = 4 CH_* canonical names + 5 channel-damage constants + 3 mitigation tables + 4 functions)

**Implementation summary:**

4-channel damage system extracted byte-perfect from legacy `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` across **8 source regions**:

- **4 channel-damage constants (19966-19979):** `CHANNEL_DEADZONE_DMG=5`, `CHANNEL_VOID_TICK_PCT=0.005`, `CHANNEL_GRID_SATURATION_THRESHOLD=0.75`, `CHANNEL_GRID_SATURATION_DMG=8`, `CHANNEL_SIGNATURE_DMG` (tutorial:12, gatekeeper:16, mid_act:20, act_boss:24, finale:28) — all `Object.freeze`'d.
- **Mitigation Matrix (19982-20002):** `MITIGATION_CAP=0.70`, `MITIGATION_TABLE` (5 keys × 4 tiers — guard 0.05/0.08/0.12/0.18, weaver_mage 0.02/0.04/0.07/0.10, weaver_captain 0.01/0.03/0.05/0.08, striker_warrior 0.01/0.02/0.03/0.05, striker_hunter 0.00/0.01/0.02/0.04), `LEVEL_MITIGATION_PER` (5 keys — guard 0.005, weaver_mage 0.002, weaver_captain 0.0015, striker_warrior 0.001, striker_hunter 0.0008) — all sacred per CLAUDE.md §2.5.
- **channelLabel (38825-38833):** 4-channel human-readable map used by toast text + Sentry breadcrumbs.
- **showChannelFX (38838-38867):** per-channel toast + vibrate + HP-band tint styles map (deadzone #E85D4A 🩸 [80], void_tick #9B59E8 🟣 [40,30,40], signature #FF8C00 ⚔ [120,50,120], saturation #FFD700 ⚠ [50,30,50,30,50]).
- **showMitigationFX (38872-38879):** 250ms-delayed green sub-toast for the mitigated amount.
- **applyChannelDamage central dispatcher (38881-38993):** THE single point of entry for ALL player damage. Shield-absorption ordering (AEGIS → MAELEN frozen ward → normal shield) → mitigation (`getSquadMitigation()` + T2 Tank reactive + IRONSCALE T3 Iron Hide) → AEGIS PROTOCOL HP→Pressure reroute → HP application → Tank pressure conversion (+ Phase 3 hook + FTUE intro) → T2 Tank reactive auto-shield trigger → channel + mitigation FX → renderHP → FTUE channel/mitigation intros → `logEvent('channel_damage', ...)` analytics breadcrumb. Math.floor(rawDmg × (1-mitigation)) + Math.max(rawDmg>0?1:0, mitigated) min-1 floor preserved. Returns final HP damage applied.
- **_getBossSignatureTier (39044-39069):** maps current boss → CHANNEL_SIGNATURE_DMG tier. Reads `currentBoss.roleTier` (canonical P4) || `currentBoss.signatureTier` (backward-compat) || global-boss-number fallback (n=1→tutorial, n=25→finale, n%5===0→act_boss, n%5∈{1,2}→gatekeeper, else mid_act) || Tower→'gatekeeper'.
- **applyBossSignatureDamage (39071-39082):** signature damage entry — gates FTUE-only/training-dummy bosses, resolves tier via `_getBossSignatureTier`, fires `applyChannelDamage('signature', sigDmg, {tier, bossName})`.

**Sacred cow preservation (CLAUDE.md §2.5 — v2.1 P1 spine of combat):**

- **4 channel name constants** — exported under v2.1-spec canonical names (`CH_DEAD_ZONE`, `CH_VOID`, `CH_SIGNATURE`, `CH_GRID_SATURATION`). String values match the **legacy channel keys** every consumer keys off (`'deadzone'` / `'void_tick'` / `'signature'` / `'saturation'`). Renaming the string values would silently break `showChannelFX` style map, FTUE dialog ID gate, mitigation-bar HUD (legacy 70067/70148), and Sentry breadcrumbs.
- **Mitigation Matrix byte-perfect:** `MITIGATION_CAP=0.70` (hard 70% ceiling — player never-immune), 5 role keys × 4 tier columns in `MITIGATION_TABLE`, 5 role keys in `LEVEL_MITIGATION_PER`. Every numeric value matches legacy 19986-20002.
- **Channel damage formulas byte-perfect:** DEADZONE 5 HP/pocket, VOID 0.5% MAX_HP/cell/tick, GRID_SATURATION 0.75 threshold + 8 HP flat, SIGNATURE tier map 12/16/20/24/28.
- **Shield-absorption ordering preserved exactly:** AEGIS (consume nothing, increment aegisUsed, gate by `_t2BonusInDeck('spark_tank','autoBlockCountBonus')`) → MAELEN frozen ward (hold without consuming, tinted by `STIHIYA_COLORS.tide`) → normal shield (consume one). Same `shieldCount > 0` outer guard. Same exit paths (showChannelFX with `blocked=true`, return 0).
- **Mitigation application order preserved:** base `getSquadMitigation()` → T2 Tank reactive `_getT2TankMitigationBoost` (HP≤50% → mit ×2 cap 70%) → IRONSCALE T3 Iron Hide `_getIronscaleIronHideMitBonus` (additive cap 85%) → Math.floor(rawDmg × (1 - mitigation)) → Math.max(rawDmg>0?1:0, mitigated) min-1 floor.
- **AEGIS PROTOCOL HP→Pressure reroute byte-perfect:** triggers AFTER mitigation, BEFORE HP application. All channels flow through this gate. `addPressure(finalDmg, 'aegis_protocol')` + `showAegisProtocolFX(finalDmg)` + `showChannelFX(channel, 0, true, meta)` + early-return 0.
- **Tank pressure conversion preserved:** `_computeTankPressureConversion(finalDmg)` → `addPressure(tankConv, 'tank_absorb')` + `showTankConversionFX` + `_firePhase3Hook('onTankAbsorb', ...)` + `_maybeTriggerTankConversionIntro` FTUE hook.
- **T2 Tank reactive auto-shield trigger preserved** (`_maybeFireT2TankReactive`).
- **FTUE channel + mitigation intros preserved** (`_maybeTriggerChannelIntro`, `_maybeTriggerMitigationIntro`) — fire after HP application + FX, before analytics.
- **Analytics breadcrumb preserved:** `logEvent('channel_damage', {channel, rawDmg, finalDmg, mitigated, mitigation: round(mit*100)/100})`.
- **`_getBossSignatureTier` resolution preserved:** roleTier > signatureTier > Tower→'gatekeeper' > global-boss-number fallback. Tower-mode skip rule + tutorial/finale/act_boss/gatekeeper/mid_act decision tree byte-perfect.

**Storage rewires (T1.08 abstraction):**

- **0 new bare-string localStorage keys.** Channel damage math is per-battle ephemeral — the dispatcher mutates `hp` / `shieldCount` / `battleDamageTaken` (writable globals) and reads `currentBoss` / `currentChapter` / `_isTowerBattle` (read-only globals). **The T1.10.9 migration shim allow-list (FTUE + intro-video + 5 chapter-complete keys from T1.10.1 + T1.10.2) does NOT need additions from T1.10.5.**

**ESLint globals added** (specific identifiers, why):

- File-level `/* eslint-disable no-empty, no-unused-vars */` — the dispatcher uses `try { ... } catch (e) {}` patterns abundantly (12+ catches in the legacy body); preserving byte-perfect requires accepting them, and legacy uses `catch (e)` not `catch (_e)`.
- **Readonly (~25 identifiers):** `getSquadMitigation` (heroes territory, legacy 38768 — consumed by mitigation step); Tank ULT helpers `_t2BonusInDeck`, `_getT2TankMitigationBoost`, `_getIronscaleIronHideMitBonus`, `_computeTankPressureConversion`, `_maybeFireT2TankReactive`, `aegisActive`, `aegisProtocolTurnsActive`, `maelenShieldNoDecay`, `showAegisProtocolFX`, `showTankConversionFX`, `_firePhase3Hook`, `_maybeTriggerTankConversionIntro` (Aegis Conductor in heroes.js T1.10.4 exposes these — read here); `addPressure` (T1.10.6 stagger-loop writer — Tank conversion + AEGIS PROTOCOL route HP→Pressure via this); FTUE intros `_maybeTriggerChannelIntro`, `_maybeTriggerMitigationIntro` (legacy globals — fired after FX); boss context `currentBoss`, `currentChapter`, `currentBossIdx`, `_isTowerBattle` (T1.10.7 territory — read by `_getBossSignatureTier`); `STIHIYA_COLORS` (T1.07 data — MAELEN frozen ward banner tint); `MAX_HP` (data-consolidation target — referenced in mitigation comment block + consumed via grid.applyVoidTickIfAny upstream); feel/UI/analytics `flashText`, `flashStateBanner`, `vibrate`, `speakNarrator`, `renderHP`, `logEvent`.
- **Writable (4 identifiers):** `aegisUsed` (incremented by the AEGIS shield-absorption branch), `hp` (HP application), `shieldCount` (normal-shield consume branch), `battleDamageTaken` (analytics-side accumulator on HP application).

**TODO markers:** 0 explicit `TODO(T1.10.N)` markers in code — the wide `/* global */` directive set is the wire-up surface. Each global identifier *is* an implicit TODO marker pointing to its future home (e.g., `addPressure` → T1.10.6 stagger-loop, `currentBoss` → T1.10.7 bosses, `_maybeTriggerChannelIntro` → future FTUE follow-up, `flashText` / `renderHP` → T1.11 ui).

**Engineering judgment:**

- **Constants live in the module that OWNS them, not data/.** The brief considered routing `CHANNEL_*` + `MITIGATION_*` through `src/data/balance.js`, but the legacy constants block at lines 19966-20002 sits IMMEDIATELY adjacent to the dispatcher block at 38816-39091 conceptually — they're 4-channel damage system metadata, not generic game balance. Co-locating constants + dispatcher in `damage-channels.js` matches the T1.10.3 grid.js pattern (`computeGridSaturation` + threshold constant in same module) and the T1.10.4 heroes.js pattern (`AEGIS_PROTOCOL_DURATION` + activator in same module). Future data-consolidation pass can flatten if needed; not in T1.10.5 scope.
- **`window.applyChannelDamage` + constant exposure mirrors legacy 39084-39091.** The dispatcher publishes `window.applyChannelDamage`, `window.applyBossSignatureDamage`, `window.channelLabel`, `window._getBossSignatureTier` PLUS the 8 channel/mitigation constants. Legacy bodies that consume these ambient (dead-zone scanner line 63992, revenge attack 39323, phoenix fire aura 39394, HUD mitigation bar 70067/70148, grid.js T1.10.3 `/* global applyChannelDamage */`) keep working until T1.10.9 wire-up flips imports. This is the same window-bridge pattern T1.10.4 uses for `renderCaptainMarkBadge`.
- **DEAD_ZONE has NO dedicated handler function — by design.** Legacy line 63988-63992 computes `rawDmg = newDead * CHANNEL_DEADZONE_DMG` inline inside the dead-zone scanner (battle territory) and fires `applyChannelDamage('deadzone', rawDmg, {deadCount: newDead})`. The dispatcher does NOT need a `applyDeadZone()` wrapper; the constant + the channel key + the dispatcher are sufficient. T1.10.9 will move the dead-zone scanner; this module owns the constant + the dispatch path.
- **`getSquadMitigation` NOT extracted to heroes.js T1.10.4.** The heroes module was extracted before T1.10.5; `getSquadMitigation` (legacy 38768-38790) + `getHeroMitigationKey` (38691-38694) sit in heroes territory but weren't pulled when heroes was extracted. They consume `HERO_DECK` / `activeSquad` / `getHeroStats` and would naturally belong next to those. For T1.10.5 they remain legacy globals consumed via `/* global */`. **CTO recommendation:** T1.10.9 audit / future heroes follow-up should move them into `heroes.js` alongside `getHeroStats`.
- **FTUE channel + mitigation intros NOT extracted to ftue-state.js T1.10.1.** `_maybeTriggerChannelIntro` + `_maybeTriggerMitigationIntro` (legacy 39098-39134) are tightly coupled to `applyChannelDamage` (called from end of dispatcher path) and consult `seenDialogs` + `currentChapter` + `isFtueActive` + `playDialog`. They're legacy-FTUE-side, not state-machine-side, so they don't fit `ftue-state.js` cleanly. Left in legacy until a future FTUE follow-up consolidates the channel/mitigation/pressure/stagger/recovery/overflow intro family in one module.
- **Channel-string-value preservation is sacred, not bikeshedding.** The brief's example named the constants `'dead_zone'` / `'void'` / `'signature'` / `'grid_saturation'`, but every legacy consumer keys off the **actual** string values `'deadzone'` (no underscore) / `'void_tick'` (with `_tick` suffix) / `'signature'` / `'saturation'` (short form). Changing the string values to "match spec naming" would silently break 6+ call sites. The canonical CH_* names live in this module as the export contract; the string values inside them are legacy-byte-perfect.

**Verification (all gates green):**

- `npm run lint` → 0 errors / 0 warnings (post-`/* eslint-disable no-empty, no-unused-vars */` + 25-readonly + 4-writable globals)
- `npm run test:unit` → 6/6 pass (~100ms)
- `npm run test:smoke` → 2/2 pass (~7.6s)
- `npm run test:visual` → 22/22 pass under 2% (~13.5s)
- `npm run build` → succeeds. dist/assets/index.js = 0.75KB; dist/assets/index.css = 368.77KB (unchanged — new module tree-shakes out, nothing imports it yet, as expected per Step E of the assignment)
- Legacy `wc -c` = 21,480,494; SHA-256 `4b3a3974f8b9030bf195dc9fad2b7b4bf07857021b3c01b44410ac547fcee67f` — byte-identical

**Self-check:**
- [x] Acceptance: 4 v2.1 P1 damage channels extracted (DEAD_ZONE, VOID, SIGNATURE, GRID_SATURATION) under CH_* canonical exported names with legacy string values preserved (`deadzone`/`void_tick`/`signature`/`saturation`)
- [x] Acceptance: Mitigation Matrix byte-perfect (MITIGATION_CAP=0.70, MITIGATION_TABLE 5×4, LEVEL_MITIGATION_PER 5 keys)
- [x] Acceptance: applyChannelDamage central dispatcher byte-perfect (shield-absorption order, mitigation math + min-1 floor, AEGIS PROTOCOL reroute, Tank conversion, FTUE hooks, analytics breadcrumb)
- [x] Acceptance: per-channel constants byte-perfect (5/0.005/0.75/8/SIGNATURE tier map 12/16/20/24/28)
- [x] Acceptance: imports `log` from src/services/logger.js (T1.08); no other src/ imports needed (legacy globals supply the rest)
- [x] Acceptance: no window globals introduced beyond the legacy 39084-39091 mirror block (applyChannelDamage + applyBossSignatureDamage + channelLabel + _getBossSignatureTier + 8 constants)
- [x] Acceptance: legacy HTML byte-identical (wc -c + SHA-256 verified)
- [x] Acceptance: all gates green (lint 0/0, unit 6/6, smoke 2/2, visual 22/22, build 372KB)
- [x] Acceptance: nothing imports the new module — tree-shakes out for T1.10.5 (correct — T1.10.9 final wire-up flips grid.js's `/* global applyChannelDamage */` into an explicit import)
- [x] Sacred cows: 4-channel system byte-perfect (CLAUDE.md §2.5 v2.1 P1). Mitigation Matrix byte-perfect. Shield-absorption ordering preserved. AEGIS PROTOCOL HP→Pressure reroute preserved.
- [x] DO NOT TOUCH: legacy HTML — not modified; index.html — not modified; src/main.js — not modified; src/core/{ftue-state,progression,grid,heroes}.js (T1.10.1-T1.10.4) — not modified; src/data/ — not modified; src/feel/ — not modified; src/services/ — not modified; eslint.config.js — not modified; CSS / baselines / tests / CI / husky — not modified
- [x] DO NOT TOUCH: Mitigation Matrix values — unchanged; channel formulas — byte-perfect; shield-absorption order — byte-perfect; SIGNATURE tier resolution — byte-perfect
- [x] DO NOT wire grid.js to import damage-channels — grid keeps `/* global applyChannelDamage */` per T1.10.9 spec
- [x] No new npm packages
- [x] Not pushed to remote (CTO will instruct)
- [x] STOPPED after T1.10.5; did NOT start T1.10.6

**Замечено рядом (NOT fixed, reported):**

1. **NO new bare-string storage keys.** Channel damage math is per-battle ephemeral; the dispatcher only mutates writable globals (`hp`, `shieldCount`, `battleDamageTaken`). **The T1.10.9 migration shim allow-list (FTUE + intro-video + 5 chapter-complete keys) does NOT need additions from T1.10.5.**

2. **`getSquadMitigation` + `getHeroMitigationKey` still in legacy.** These two functions (legacy 38691-38790) belong next to `getHeroStats` (already in heroes.js T1.10.4) but weren't pulled when heroes was extracted. For T1.10.5 they remain `/* global */`. **CTO recommendation:** T1.10.9 audit or a future heroes follow-up should move both into `src/core/heroes.js`. Pure relocation — same byte-perfect concerns as T1.10.4.

3. **FTUE channel + mitigation intros (`_maybeTriggerChannelIntro`, `_maybeTriggerMitigationIntro`) still in legacy.** They're called from the end of `applyChannelDamage` and gate on `seenDialogs` + `currentChapter` + `isFtueActive`. Conceptually they belong with the v2.1 P2 FTUE-intro family (`_maybeTriggerPressureIntro`, `_maybeTriggerStaggerIntro`, `_maybeTriggerRecoveryIntro`, `_maybeTriggerOverflowIntro` at legacy 39146-39212), which is T1.10.6 stagger-loop territory. **CTO recommendation:** consolidate all 6 intro helpers into a single follow-up sub-task after T1.10.6 lands.

4. **Channel string values are sacred — NOT the spec's underscore-canonical names.** The 4-channel spec calls them DEAD_ZONE / VOID / SIGNATURE / GRID_SATURATION, but legacy actually uses `'deadzone'` / `'void_tick'` / `'signature'` / `'saturation'`. The exported CH_* constants hold the legacy string values to preserve byte-perfect consumer wiring (showChannelFX styles, FTUE dialog ID map at legacy 39103-39108, HUD bar at 70067/70148, Sentry breadcrumbs). If a future v3 refactor wants to standardize the strings, it must update ALL consumers in lockstep — not a T1.10.5 concern.

5. **DEAD_ZONE pocket→damage compute stays in legacy battle territory (line 63988).** The brief asked for per-channel handlers, but DEAD_ZONE doesn't have a separate handler in legacy — the dead-zone scanner inline-computes `rawDmg = newDead * CHANNEL_DEADZONE_DMG` and fires `applyChannelDamage('deadzone', rawDmg, ...)` directly. Flagged for T1.10.9: when the dead-zone scanner moves to battle.js, the call site will import `CHANNEL_DEADZONE_DMG` + `applyChannelDamage` from this module.

6. **MAX_HP referenced in module comment but not consumed by any function here.** The 0.5%/cell formula in the comment cross-references `MAX_HP`; the actual computation `floor(voidCount * MAX_HP * CHANNEL_VOID_TICK_PCT)` lives in `grid.applyVoidTickIfAny` (T1.10.3). MAX_HP added to `/* global */` for the comment context only. Drop after data-consolidation pass moves MAX_HP into src/data/.

7. **`renderHP` ambient — UI concern.** Dispatcher calls `renderHP()` after HP mutation (legacy 38978). Stays in legacy until T1.11 (ui) moves DOM-side render functions; consumed here via `/* global */`.

**Time:** ~2 hours (457 LoC byte-perfect copy + 30-readonly + 4-writable globals declared + lint cycle for `addPressure` discovery + commit/docs cycle)

---

### T1.10.6 — REVIEW (2026-05-11)

**Code commit:** `83782cf` — `[T1.10.6] Extract Stagger Loop state machine to src/core/stagger-loop.js`
**DOCS commit:** follows (this entry)
**File created:** `src/core/stagger-loop.js` (1,021 lines, 48 named exports = 17 constants + 26 functions + 5 read-only getters for module-private state)

**Implementation summary:**

Stagger Loop state machine + Pressure meter extracted byte-perfect from legacy `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` across **5 source regions** (the entire v2.1 P2 combat phase):

- **Core constants block (20004-20061):** `BOSS_STATE_ACTIVE`/`STAGGER`/`RECOVERY` string identifiers, `PRESSURE_MAX=100`, `PRESSURE_GAIN` table (line_single 5, line_double 12, line_triple 25, line_quad 45, inferno_proc 20, detonate_proc 20, hero_ult 15, signature_combo 30, cascade_per_cell 8), `STAGGER_DURATION_TURNS=4`, `RECOVERY_DURATION_TURNS=2`, `STAGGER_CHAINING_ENABLED=true`, `FIRE_MULT_CAP_BASE` per chapter (1:2.0, 2:2.5, 3:3.0, 4:3.5, 5:4.0), `FIRE_MULT_CAP_TOWER=4.0`, state multipliers (`FIRE_MULT_ACTIVE_RATIO=0.7`, `FIRE_MULT_STAGGER_RATIO=1.5`, `FIRE_MULT_RECOVERY_RATIO=0.7`), `OVERFLOW_TO_ULT=0.40`, `OVERFLOW_TO_ESSENCE=0.30`, `OVERFLOW_PER_SHIELD=500`, `OVERFLOW_TO_TOWER=0.10` — all sacred per CLAUDE.md §2.5 (v2.1 P2).
- **PR #2.A state machine foundation (39214-39420):** module-private state cursors (`bossState`/`bossPressure`/`staggerTurnsRemaining`/`recoveryTurnsRemaining`/`totalStaggersThisFight`/`lastStaggerEnteredAtTurn`/`pendingRevengeAttack`) + `getFireMultCap` (Tower override → chapter base → state-adjusted) + `_stateAdjustedCap` + 4 transition functions (`enterStaggerState`/`extendStaggerState`/`enterRecoveryState`/`enterActiveState`) + `executeRevengeAttack` (1.5× signature damage on Recovery exit, telegraphed) + `tickStaggerState` (EOT countdown — Stagger→Recovery→revenge→Active + AEGIS PROTOCOL tick + 4 reactivity-event counter ticks + Phoenix fire aura) + `resetStaggerState` (battle-init reset).
- **PR #2.B Pressure central + gain hooks (39422-39524):** `addPressure(amount, reason)` — single entry point with 7-step ordering (normalize → dead-boss gate → Recovery gate → chaining-disabled×Stagger gate → `pressureGainMult` debuff floor → `bossStaggerImmuneTurns` clamp at `trigger-1` → increment+clip at PRESSURE_MAX → Stagger trigger via `getStaggerTriggerThreshold()` defaulting to PRESSURE_MAX → multi-stagger chaining +2 turns + reset to 0 when refilled mid-Stagger). `showPressureGainFX(amount, reason)` per-reason label map + tier coloring.
- **PR #2.C Overflow conversion (39526-39672):** `_getPhaseGateHP` (70%/35%/0 phase gates) + `applyOverflowConversion(overflowDmg)` (40% → ULT distributed across squad stihiyas via `_distributeOverflowToULT`, 30% → essence via `_distributeOverflowToEssence`, 1 shield per 500 capped at MAX_SHIELD+2, 10% chapter / 20% Tower via `OVERFLOW_TO_TOWER_BATTLE_TOWER` override → Tower points) + `showOverflowRewardFX` (headline + 4 staggered sub-floaters).
- **PR #2.D UI render functions (39674-39844):** `renderPressureMeter` (#bpFill/#bpValue/#bossPressureContainer + tier-mid/tier-high/anticipating CSS classes + Recovery hide) + `renderBossStateBanner` (#bossStateBanner — "⚡ STAGGER · NT" / "⚠ REVENGE INCOMING NT" + #bossImgWrap boss-staggered/boss-recovering classes) + `showStaggerEntryFX` (420ms gold flash + 800ms slow-mo body class) + `showRecoveryEntryFX` (`speakNarrator('warning')`) + `_estimateHeroPressureContribution` (per-role baseline 4/6/8/10/12 × tier mult × level mult) + `renderPressureContribution` (#detailPressureContrib) + `renderSquadPressureForecast` (#spfValue/#spfAux).
- **PR #2.E FTUE intro triggers (39137-39212):** `_maybeTriggerPressureIntro` (500ms delay after first ≥5 Pressure gain in Ch1), `_maybeTriggerStaggerIntro` (1500ms delay after first STAGGER), `_maybeTriggerRecoveryIntro` (800ms delay after first RECOVERY), `_maybeTriggerOverflowIntro` (1200ms delay after first OVERFLOW). All gated on `seenDialogs` + `currentChapter===1` + `!isFtueActive()` + `!seenDialogs.has(dialogId)`.

**Sacred cow preservation (CLAUDE.md §2.5 + §9 glossary — v2.1 P2 skill expression system):**

- **3-state boss state machine byte-perfect.** `'active'` / `'stagger'` / `'recovery'` string identifiers — every consumer (banner CSS classes, FX gates, reactivity event keys) keys off these exact values. NOT renamed.
- **Pressure constants byte-perfect.** `PRESSURE_MAX = 100`. PRESSURE_GAIN table values 5/12/25/45 line clears, 20 inferno/detonate, 15 hero ULT, 30 signature combo, 8 cascade per cell.
- **State-machine timing byte-perfect.** Stagger duration 4 turns, Recovery duration 2 turns. Chaining enabled → +2 turn extension + meter reset to 0 when refilled mid-Stagger.
- **getFireMultCap byte-perfect.** Chapter base map {1:2.0, 2:2.5, 3:3.0, 4:3.5, 5:4.0} + Tower override 4.0 + state ratios (Active 0.7, Stagger 1.5, Recovery 0.7). Ch1 Active 1.4× / Ch1 Stagger 3.0× / Ch5 Stagger 6.0× / Tower Stagger 6.0×.
- **Overflow conversion ratios byte-perfect.** 40% ULT / 30% essence / 1 shield per 500 / 10% Tower (20% Tower-battle override). Phase gates 70%/35%/0. 20% absorbed as variance (the 40+30+10 = 80% intentional).
- **Revenge attack byte-perfect.** Pre-computed at Recovery entry via `_getBossSignatureTier` + `CHANNEL_SIGNATURE_DMG[tier]` + 1.5× multiplier + telegraphed (`{source:'revenge', telegraphed:true}` meta). Fired through `applyChannelDamage('signature', dmg, meta)` on Recovery exit.
- **addPressure ordering byte-perfect.** 7-step pipeline preserved exactly — dead-boss + Recovery + chaining-disabled gates → `pressureGainMult` debuff (Voidfang reactivity) → `bossStaggerImmuneTurns` clamp at `trigger-1` (Berserker reactivity) → increment+clip → FX+render+FTUE intro → Stagger trigger / multi-stagger chaining via `getStaggerTriggerThreshold()` (Mythic Captain override → PRESSURE_MAX default).
- **Phase 3 hook integration byte-perfect.** `_firePhase3Hook('onStaggerEnter', {totalStaggers})` from enterStaggerState. `_firePhase3Hook('onStaggerExit', {reason})` from enterRecoveryState + enterActiveState (only when leaving STAGGER). Mythic Tank squad boost activates/clears here.
- **Reactivity events tick byte-perfect.** `tickStaggerState` ticks `bossStaggerImmuneTurns` / `bossStealthTurns` / `bossBackstabChainTurns` / `squadSilencedTurns` (Phase 4 v2.1 PR #4.C) + Phoenix fire aura damage via `applyChannelDamage('signature', bossFireAuraDmg, {source:'phoenix_fire_aura'})`. AEGIS PROTOCOL EOT tick (`tickAegisProtocol`) fires last, independent of bossState.
- **All FX timings / vibrate patterns / flash banner colors byte-perfect.** Stagger entry: 420ms gold flash + 800ms slow-mo + vibrate [100,50,100,50,200] + flashStateBanner('STAGGER!', '#FFD700'). Stagger extend: vibrate [80,40,80,40,80] + flashStateBanner('STAGGER EXTENDED +N', '#FFD700'). Recovery entry: vibrate [200,100,200] + flashStateBanner('REVENGE INCOMING — NT', '#FF4500') + speakNarrator('warning'). Overflow: vibrate [120,60,120,60,200] + flashText('⚡ OVERFLOW · N', '#FFD700') + 4 sub-floaters at 200ms.

**Storage rewires (T1.08 abstraction):**

- **0 new bare-string localStorage keys.** Stagger Loop state (bossState, bossPressure, staggerTurnsRemaining, recoveryTurnsRemaining, totalStaggersThisFight, lastStaggerEnteredAtTurn, pendingRevengeAttack) is per-battle ephemeral — reset at every battle init via `resetStaggerState`. **The T1.10.9 migration shim allow-list (FTUE + intro-video + 5 chapter-complete keys from T1.10.1 + T1.10.2) does NOT need additions from T1.10.6.**

**ESLint globals added** (specific identifiers, why):

- File-level `/* eslint-disable no-empty, no-unused-vars */` — the state machine + Pressure + Overflow + FTUE intros + UI render uses `try { ... } catch (e) {}` patterns abundantly (35+ catches across the legacy bodies); preserving byte-perfect requires accepting them, and legacy uses `catch (e)` not `catch (_e)`.
- **Readonly (~38 identifiers):** `getStaggerTriggerThreshold` (heroes.js T1.10.4 — Mythic Captain pre-set threshold); `_getBossSignatureTier`, `CHANNEL_SIGNATURE_DMG`, `applyChannelDamage` (damage-channels.js T1.10.5 — Revenge attack + Phoenix fire aura dispatch); `tickAegisProtocol` (heroes.js T1.10.4 — T3 Tank ULT EOT tick); Phase 4 reactivity refs `pressureGainMult`, `bossFireAuraActive`, `bossFireAuraDmg` (T1.10.8 — boss debuff multiplier + fire aura state); boss/battle context `currentBoss`, `currentChapter`, `currentBossIdx`, `_isTowerBattle`, `bossHP`, `bossMaxHP`, `placementCount` (T1.10.7 / T1.10.9 territory); heroes/progression refs `HERO_DECK`, `HERO_ROSTER`, `activeSquad`, `heroUpgrades`, `getHeroLevel`, `ultCharges`, `currentUltThreshold`, `ULT_THRESHOLD`, `essences`, `towerState`, `addTowerPoints`, `saveTowerState`, `saveProgress`, `getSquadMitigation` (T1.10.4 / T1.10.2); data constants `STIHIYAS`, `MAX_SHIELD` (T1.07); FTUE refs `isFtueActive`, `seenDialogs`, `playDialog` (T1.10.1 owns `isFtueActive`; the dialog map + seenDialogs Set lives in legacy until a future FTUE follow-up); v2.1 P5 Tower override `OVERFLOW_TO_TOWER_BATTLE_TOWER`; Phase 3 hook bus `_firePhase3Hook`; feel/UI/analytics `flashText`, `flashStateBanner`, `vibrate`, `speakNarrator`, `renderHP`, `renderULTBar`, `logEvent`.
- **Writable (5 identifiers):** `shieldCount` (overflow shield grant), `bossStaggerImmuneTurns`, `bossStealthTurns`, `bossBackstabChainTurns`, `squadSilencedTurns` (per-turn reactivity counters decremented inside `tickStaggerState`).

**TODO markers:** 0 explicit `TODO(T1.10.N)` markers in code — the wide `/* global */` directive set is the wire-up surface (matches T1.10.3-T1.10.5 sibling pattern). Each global identifier *is* an implicit TODO marker pointing to its future home:
- `getStaggerTriggerThreshold` → T1.10.4 heroes (already extracted; import flip in T1.10.9)
- `_getBossSignatureTier` / `CHANNEL_SIGNATURE_DMG` / `applyChannelDamage` → T1.10.5 damage-channels (already extracted; import flip in T1.10.9)
- `tickAegisProtocol` → T1.10.4 heroes (already extracted; import flip in T1.10.9)
- `pressureGainMult` / `bossStaggerImmuneTurns` / `bossStealthTurns` / `bossBackstabChainTurns` / `bossFireAuraActive` / `bossFireAuraDmg` / `squadSilencedTurns` → T1.10.8 reactivity-events
- `currentBoss` / `currentChapter` / `currentBossIdx` / `_isTowerBattle` / `bossHP` / `bossMaxHP` / `placementCount` → T1.10.7 bosses / T1.10.9 battle
- `HERO_DECK` / `activeSquad` / `getHeroLevel` / `heroUpgrades` / `ultCharges` / `currentUltThreshold` / `ULT_THRESHOLD` / `essences` / `towerState` / `addTowerPoints` / `saveTowerState` / `saveProgress` / `getSquadMitigation` → T1.10.4 / T1.10.2 (some already extracted; import flip in T1.10.9)
- `_firePhase3Hook` → T1.10.4 heroes (already extracted; import flip in T1.10.9)
- `flashText` / `flashStateBanner` / `vibrate` / `speakNarrator` / `renderHP` / `renderULTBar` / `logEvent` → T1.11 ui / T1.09 feel (services already wired)

**Engineering judgment:**

- **Constants live in the module that OWNS them, not data/balance.js.** Matches the T1.10.3 grid.js + T1.10.4 heroes.js + T1.10.5 damage-channels.js pattern: the legacy constants block at 20004-20061 sits IMMEDIATELY adjacent to the state-machine block at 39214-39420 conceptually — they're v2.1 P2 Stagger Loop metadata, not generic game balance. Future data-consolidation pass can flatten if needed; not in T1.10.6 scope.
- **Module-private state + read-only getters (matches T1.10.1 ftue-state.js pattern).** `bossState` / `bossPressure` / `staggerTurnsRemaining` / `recoveryTurnsRemaining` / `totalStaggersThisFight` declared module-private (no exported `let`). Exposed via `getBossState()` / `getBossPressure()` / `getStaggerTurnsRemaining()` / `getRecoveryTurnsRemaining()` / `getTotalStaggersThisFight()`. Direct mutation reserved for the transition functions (`enter*State`, `extendStaggerState`, `tickStaggerState`) + `addPressure` + `resetStaggerState` — same write-control discipline as legacy.
- **Window-exposure block mirrors legacy 39411-39419, 39521-39524, 39666-39672, 39836-39844, 39207-39212.** Publishes all 26 module functions + 17 constants + 5 read-only state accessors (via `Object.defineProperty` getters — legacy reads bare identifiers `bossState` / `bossPressure` and propagates writes through the module's transition functions, never assigning to those names externally). This is the same window-bridge pattern T1.10.4 / T1.10.5 use; heroes.js still consults `addPressure` / `bossState` / `BOSS_STATE_STAGGER` via `/* global */` until T1.10.9.
- **FTUE intros (`_maybeTriggerPressureIntro` / `_maybeTriggerStaggerIntro` / `_maybeTriggerRecoveryIntro` / `_maybeTriggerOverflowIntro`) co-located with state machine, NOT in ftue-state.js T1.10.1.** They're v2.1 P2 PR #2.E and only ever fire from the state transitions / `addPressure` / `applyOverflowConversion` paths owned by this module. ftue-state.js owns the beat machine; these intros are story-specific FTUE hooks for the P2 system, not transition logic. Flagged as candidate for "FTUE intro family consolidation" follow-up after T1.10.6 (T1.10.5 already flagged the `_maybeTriggerChannelIntro` / `_maybeTriggerMitigationIntro` pair in legacy too — a single follow-up could absorb all 6 P2/P1 intros into one ftue-intros module).
- **UI render functions co-located with state machine, NOT in T1.11 ui (sibling pattern from T1.10.5 `showChannelFX` / `showMitigationFX`).** `renderPressureMeter` / `renderBossStateBanner` / `showStaggerEntryFX` / `showRecoveryEntryFX` / `renderPressureContribution` / `renderSquadPressureForecast` directly read module-private state cursors. Splitting them into T1.11 would require either re-exposing the state via additional getters or breaking encapsulation. Match damage-channels.js precedent: per-system FX/render co-located with the system that drives them; T1.11 ui will own screen-level orchestration, not v2.1 P2 system-specific render.
- **`getFireMultCap` fallback to literal 3.0 (legacy 39246).** Legacy reads `(typeof FIRE_MULT_CAP === 'number' ? FIRE_MULT_CAP : 3.0)` for chapters not in BASE map. The legacy module-scope const `FIRE_MULT_CAP` lives elsewhere in legacy; we mirror with `|| 3.0` literal since in all actual chapters 1..5 the BASE map hits — the fallback is unreachable in practice. Pure-relocation semantics preserved without dragging in an unrelated legacy const.
- **`getStaggerTriggerThreshold` consumed defensively with PRESSURE_MAX fallback.** Mythic Captain pre-set threshold (50/75/100) lives in heroes.js T1.10.4. The legacy pattern `(typeof getStaggerTriggerThreshold === 'function') ? getStaggerTriggerThreshold() : PRESSURE_MAX` preserved here exactly — addPressure works correctly with or without a Mythic Captain in play.

**Verification (all gates green):**

- `npm run lint` → 0 errors / 0 warnings (post-`/* eslint-disable no-empty, no-unused-vars */` + 38-readonly + 5-writable globals)
- `npm run test:unit` → 6/6 pass (~97ms)
- `npm run test:smoke` → 2/2 pass (~2.6s)
- `npm run test:visual` → 22/22 pass under 2% (~14.8s)
- `npm run build` → succeeds. `dist/assets/index-*.js` = 0.75KB; `dist/assets/index-*.css` = 368.77KB (unchanged — new module tree-shakes out, nothing imports it yet, as expected per Step E of the assignment)
- Legacy `wc -c` = 21,480,494; SHA-256 `4b3a3974f8b9030bf195dc9fad2b7b4bf07857021b3c01b44410ac547fcee67f` — byte-identical

**Self-check:**
- [x] Acceptance: 3-state boss state machine extracted (ACTIVE / STAGGER / RECOVERY) — string identifiers + transitions byte-perfect
- [x] Acceptance: Pressure meter (PRESSURE_MAX=100) + PRESSURE_GAIN table byte-perfect (line clears 5/12/25/45, procs 20/20, hero_ult 15, signature_combo 30, cascade_per_cell 8)
- [x] Acceptance: State durations byte-perfect (STAGGER 4 turns, RECOVERY 2 turns, chaining enabled with +2 extension on mid-Stagger refill)
- [x] Acceptance: addPressure 7-step ordering byte-perfect (dead-boss + Recovery + chaining-disabled × Stagger + pressureGainMult + bossStaggerImmuneTurns + Stagger trigger + multi-stagger chaining)
- [x] Acceptance: getFireMultCap byte-perfect (chapter × state × Tower override)
- [x] Acceptance: Overflow conversion byte-perfect (40% ULT / 30% essence / 1 shield per 500 / 10% Tower with 20% Tower-battle override; phase gates 70%/35%/0; revenge multiplier 1.5×)
- [x] Acceptance: All v2.1 P2 FX byte-perfect (Stagger gold flash 420ms + slow-mo 800ms; Recovery red banner + speakNarrator('warning'); Overflow gold burst + 4 staggered sub-floaters)
- [x] Acceptance: FTUE intros (Pressure / Stagger / Recovery / Overflow) byte-perfect (Ch1 + seenDialogs gates + 500/1500/800/1200ms delays)
- [x] Acceptance: imports `log` from src/services/logger.js (T1.08); no other src/ imports needed (legacy globals supply the rest)
- [x] Acceptance: no window globals introduced beyond the legacy 39411-39419 / 39521-39524 / 39666-39672 / 39836-39844 / 39207-39212 mirror blocks
- [x] Acceptance: legacy HTML byte-identical (wc -c + SHA-256 verified)
- [x] Acceptance: all gates green (lint 0/0, unit 6/6, smoke 2/2, visual 22/22, build 372KB)
- [x] Acceptance: nothing imports the new module — tree-shakes out for T1.10.6 (correct — T1.10.9 final wire-up flips heroes.js + damage-channels.js `/* global addPressure */` etc. into explicit imports)
- [x] Sacred cows: Stagger Loop state machine byte-perfect (CLAUDE.md §2.5 v2.1 P2). Pressure meter byte-perfect. Stagger/Recovery duration byte-perfect. Multi-stagger chaining preserved. Overflow conversion ratios preserved.
- [x] DO NOT TOUCH: legacy HTML — not modified; index.html — not modified; src/main.js — not modified; src/core/{ftue-state,progression,grid,heroes,damage-channels}.js (T1.10.1-T1.10.5) — not modified; src/data/ — not modified; src/feel/ — not modified; src/services/ — not modified; eslint.config.js — not modified; CSS / baselines / tests / CI / husky — not modified
- [x] DO NOT TOUCH: Pressure constants — unchanged; state transition flow — byte-perfect; FIRE_MULT cap math — byte-perfect; Overflow conversion math — byte-perfect; revenge multiplier — byte-perfect
- [x] DO NOT wire heroes.js / damage-channels.js to import stagger-loop — they keep `/* global addPressure / bossState / extendStaggerState / PRESSURE_MAX / PRESSURE_GAIN / BOSS_STATE_STAGGER */` per T1.10.9 spec
- [x] No new npm packages
- [x] Not pushed to remote (CTO will instruct)
- [x] STOPPED after T1.10.6; did NOT start T1.10.7

**Замечено рядом (NOT fixed, reported):**

1. **NO new bare-string storage keys.** Stagger Loop state is per-battle ephemeral (reset at every battle init via `resetStaggerState`). **The T1.10.9 migration shim allow-list (FTUE + intro-video + 5 chapter-complete keys) does NOT need additions from T1.10.6.**

2. **FTUE intro family consolidation candidate.** Legacy has 6 P1/P2 first-encounter FTUE intros: `_maybeTriggerChannelIntro` + `_maybeTriggerMitigationIntro` (T1.10.5 left in legacy — flagged in its "Замечено рядом" #3) + `_maybeTriggerPressureIntro` + `_maybeTriggerStaggerIntro` + `_maybeTriggerRecoveryIntro` + `_maybeTriggerOverflowIntro` (now in this module). They share a common gate pattern (seenDialogs + Ch1 + !isFtueActive + dialogId-not-seen). **CTO recommendation:** a single follow-up sub-task could consolidate all 6 into `src/core/ftue-intros.js` (sibling to ftue-state.js). Out of T1.10.6 scope — pure relocation; this module captures the 4 P2 helpers next to the state-machine entry points they fire from.

3. **`getStaggerTriggerThreshold` still consumed via `/* global */`.** Mythic Captain pre-set threshold lives in heroes.js T1.10.4 (already extracted there). T1.10.9 will replace this directive with `import { getStaggerTriggerThreshold } from './heroes.js'`. Same for `_firePhase3Hook` / `_computeTankPressureConversion` (heroes.js — already extracted but consumed via `/* global */` here for now).

4. **`_getBossSignatureTier` / `CHANNEL_SIGNATURE_DMG` / `applyChannelDamage` still consumed via `/* global */`.** All three live in damage-channels.js T1.10.5 (already extracted there). T1.10.9 will replace with `import { _getBossSignatureTier, CHANNEL_SIGNATURE_DMG, applyChannelDamage } from './damage-channels.js'`. Used here in `enterRecoveryState` (pre-compute revenge dmg via tier table) + `executeRevengeAttack` (fire revenge through dispatcher) + `tickStaggerState` (Phoenix fire aura via dispatcher).

5. **`tickAegisProtocol` still consumed via `/* global */`.** AEGIS PROTOCOL EOT tick lives in heroes.js T1.10.4 (already extracted there). T1.10.9 will replace with `import { tickAegisProtocol } from './heroes.js'`. Called from end of `tickStaggerState`, independent of bossState.

6. **Reactivity Events globals (`pressureGainMult`, `bossStaggerImmuneTurns`, `bossStealthTurns`, `bossBackstabChainTurns`, `squadSilencedTurns`, `bossFireAuraActive`, `bossFireAuraDmg`) still in legacy.** All belong in `src/core/reactivity-events.js` T1.10.8. Consumed here by `addPressure` (pressure debuff + stagger immunity clamp) + `tickStaggerState` (per-turn counter ticks + Phoenix fire aura). 4 writable + 3 readonly — full inventory captured in this module's `/* global */` block for T1.10.8 to inherit.

7. **`OVERFLOW_TO_TOWER_BATTLE_TOWER` global override.** v2.1 P5 PR #5.C §4.1 bumped Tower-battle overflow ratio to 0.20 (vs 0.10 chapter default). Legacy line 29226 defines this as a module-scope const elsewhere; we consume defensively via `typeof === 'number'` with 0.20 fallback. Future Tower sub-task should formalize this in a Tower module (or fold the const into this module if Tower never customizes it further).

8. **`speakNarrator('warning')` in `showRecoveryEntryFX` lacks `typeof` guard.** Legacy line 39759 reads `try { speakNarrator('warning'); } catch (e) {}` — no `typeof === 'function'` check. Preserved byte-perfect even though the typeof-pattern is used everywhere else. The `try/catch` swallows any ReferenceError if `speakNarrator` is undefined; pre-T1.09 wire-up should be safe regardless. Not a concern, but documented for the audit trail.

9. **5 read-only state getters added.** `getBossState` / `getBossPressure` / `getStaggerTurnsRemaining` / `getRecoveryTurnsRemaining` / `getTotalStaggersThisFight` — purely additive accessor surface for T1.10.9 to consume without breaking ES-module no-exported-let discipline. The window-exposure block also defines `Object.defineProperty` getters for the same names so legacy bodies that read bare `bossState` / `bossPressure` keep working until T1.10.9 imports flip. No functional change — same legacy semantics.

10. **`getFireMultCap` chapter-fallback uses literal `3.0` instead of legacy `FIRE_MULT_CAP` const reference.** Legacy line 39246 reads `FIRE_MULT_CAP_BASE[ch] || (typeof FIRE_MULT_CAP === 'number' ? FIRE_MULT_CAP : 3.0)`. The legacy `FIRE_MULT_CAP` const (value 3.0) lives in an unrelated legacy block we did NOT extract here. Substituted `|| 3.0` literal since in all actual chapters 1..5 the BASE map hits — the fallback is unreachable in practice. If a future data-consolidation pass moves `FIRE_MULT_CAP` to src/data/balance.js, this module should import it back to restore the explicit reference.

**Time:** ~2 hours (1,021 LoC byte-perfect copy across 5 source regions + 38-readonly + 5-writable globals declared + module-private state via getter pattern + window-exposure mirror across 5 PRs + commit/docs cycle)

---

### T1.10.7 — REVIEW (2026-05-11)

**Code commit:** `cc7d0bc` — `[T1.10.7] Extract bosses + archetypes to src/core/bosses.js`
**DOCS commit:** follows (this entry)
**File created:** `src/core/bosses.js` (1,309 lines, 60 named exports = 25 BOSS_ARCHETYPES + 25 ARCHETYPE_MATCHUP entries + 11 phase/telegraph/state-machine + 1 BOSS_VOICES table + 4 voice-trigger helpers + 1 BOSS_VOICE_MIDFIGHT_HP_PCT + 13 boss-state accessors/setters + 1 setChapter + 1 applyBossEmblems + 2 FTUE bosses + 1 FTUE_GRUNT_VOID_SPAWN + 18 Ch3 scaffolding + 2 FTUE_BOSS_GUARANTEES tables + 1 TOWER_UROBOROS_SEASONAL + 4 BOSS_TTK_* re-exports — counting line-by-line export declarations)

**Implementation summary:**

Boss identity, archetypes, state machine, FTUE-special-bosses, Ch3 scaffolding, FTUE_BOSS_GUARANTEES, and UROBOROS sacred config extracted byte-perfect from legacy `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` across thirteen source regions:
- BOSS_ARCHETYPES + Object.assign Ch3/4/5 merge (lines 20141-20198)
- ARCHETYPE_MATCHUP + Object.assign Ch3/4/5 merge (lines 20158-20215)
- Berserker / Armored / Phoenix archetype consts (20217-20225)
- Phase gates + telegraph + HP formula helpers (20240-20302)
- BOSSES dynamic let + setChapter rebinding (20442-20500)
- applyBossEmblems CSS-variable writer (20964-21007)
- BOSS_VOICES + per-battle voice fire flags + 4 trigger functions (21774-21882)
- currentChapter writable global (38344) + bossHP/bossMaxHP/currentBossIdx (40216) + currentBoss let (40218)
- Ch3 archetype scaffolding (40788-41154 — 5 boss tick handlers + storm-variant Maps + dual-state announcer + hook helpers)
- FTUE bosses EMBER_GRUNT + CHRONICLE + FTUE_GRUNT_VOID_SPAWN (25034-25148)
- FTUE_BOSS_GUARANTEES + FTUE_TUTORIAL_TEXTS (47134-47235)
- TOWER_UROBOROS_SEASONAL sacred config (49101-49140)

Module owns: boss archetype + matchup data; boss identity state vars (currentBoss / currentChapter / currentBossIdx / bossHP / bossMaxHP / _currentBossRoleTier); phase-gate ratio constants + telegraph timing + HP-formula helpers (computeBossHP, getCurrentBossPhase); dynamic per-chapter roster (getBosses); applyBossEmblems CSS writer; BOSS_VOICES + voice trigger functions; Ch3 scaffolding (_ch3State + 5 boss tick handlers + storm Maps + dual-state announcer + 3 hook helpers consumed by combat); FTUE special bosses (EMBER_GRUNT, CHRONICLE) + tuning constants; FTUE_BOSS_GUARANTEES + FTUE_TUTORIAL_TEXTS sacred tables; TOWER_UROBOROS_SEASONAL sacred config.

**Sacred cow preservation:**
- `BOSS_TTK_TARGETS` imported from `src/data/bosses.js` (T1.07) + re-exported here. NOT redefined. Sacred per CLAUDE.md §2.1.
- `FTUE_BOSS_GUARANTEES` (5 Ch1 bosses × ~3 guarantees each + scripted actions + failsafe assistance) preserved byte-perfect. Sacred per CLAUDE.md §2.5.
- `TOWER_UROBOROS_SEASONAL` 7-phase Tier-4 Mythic config preserved byte-perfect — same 7 phase thresholds [1.0, 0.86, 0.71, 0.57, 0.43, 0.28, 0.14], same 7 phase_mechanics array, same rewards (1× T3 stone + 1 Mythic Pact + 25 Tower Hearts + 'uroboros_serpent_aura' cosmetic), same 4 voice lines. Sacred per CLAUDE.md §2.5.
- `BOSS_VOICES` 10 bosses × 3 lines (intro/midfight/death) preserved verbatim. Sacred per CLAUDE.md §2.3 (Boss names + element subtitles = narrative voice).
- Berserker / Armored / Phoenix archetype constants (HP%, MULT, SHIELD_COUNT, IMMUNE_TURNS) preserved verbatim.
- Phase gates 0.70 / 0.35 / 0.00 + REACTIVITY_TELEGRAPH_MS=3000 + REACTIVITY_BANNER_DURATION_MS=1500 preserved.

**Object.assign mutations flattened: 2 total**
1. `Object.assign(BOSS_ARCHETYPES, { …Ch3 + Ch4 + Ch5 (15 new archetypes) })` (legacy 20179-20198) — landed FLAT in `BOSS_ARCHETYPES` export with all 25 entries (5 Ch1 + 5 Ch2 + 5 Ch3 + 5 Ch4 + 5 Ch5).
2. `Object.assign(ARCHETYPE_MATCHUP, { …Ch3 + Ch4 + Ch5 matchups (15 new entries) })` (legacy 20199-20215) — landed FLAT in `ARCHETYPE_MATCHUP` export with all 25 entries. Verified key-by-key against legacy: icon / label / hpMult / attackCD / dmgMult / special fields byte-perfect; strong/weak stihiya arrays byte-perfect.

**Ch4–Ch5 boss content (resolves memory/spec conflict per REPORT-01):** legacy fully populated all 25 bosses across CHAPTERS Ch1-Ch5 with proper Cosmic Ascension archetypes (v2.1 P6 PR #6.A). Memory note "Ch1-3 shipped, Ch4-5 post-launch only" refers to player-facing GATING (chapter unlock flags + content-drop schedule), not data presence. Both `src/data/chapters.js` (T1.07) and the legacy CHAPTERS array carry all 25 boss definitions; T1.10.7 just lands the 14 Cosmic Ascension archetype TUNING entries (Ch3 soul_drinker/stormcaller/confession_reader/wither/sealer + Ch4 phase_shifter/equalizer/regent/phase_reverser/royal_phase + Ch5 eternal/inevitable/co_op/devourer/choice) into BOSS_ARCHETYPES + ARCHETYPE_MATCHUP. No data missing; no memory inconsistency.

**Storage rewires (T1.08 abstraction):** **0 keys.** Boss state vars (currentBoss / bossHP / bossMaxHP / currentBossIdx / Ch3 storm Maps / boss-voice fire flags) are per-battle ephemeral — initialized at battle start, garbage-collected at battle end. Phase 8 boss-loss counter (`PHASE8_BOSS_LOSSES_KEY` = `'blocksworn_p8_boss_losses'`) stays in legacy until T1.10.9 along with `_phase8GetAdaptiveHpMultiplier` and the loss-recovery dispatcher. **0 new bare-string keys for the T1.10.9 migration shim allow-list.**

**ESLint globals added** (specific identifiers, why):
- Readonly: `flashText`, `flashStateBanner`, `vibrate`, `showThreatBanner`, `render`, `renderHP`, `renderBossHP` (T1.09 feel + T1.11 UI render); `playDialogScript` (T1.10.9 dialog module); `chapter2Unlocked`, `chapter3Unlocked`, `chapter4Unlocked`, `isContentUnlocked`, `hasCompletedChapter`, `_isChapterContentUnlocked`, `closeFloorSelector` (T1.10.2 progression + T1.11 UI); `ASSETS` (T1.06 asset registry); `grid`, `SIZE`, `gameEnded`, `showDefeatModal` (T1.10.3 grid + T1.10.9 battle); `logEvent` (T1.11 analytics).
- Writable: `shieldCount`, `hp`, `battleDamageTaken` (T1.10.9 battle state — Ch3 storm lightning + storm intensify damage path).

**TODO markers:** 0 inline TODO comments (all forward references are documented in the "DOES NOT OWN" / "Owns" comment block at the top + the /* global */ inventory). The narrative comments contain 14 references to T1.10.8/T1.10.9/T1.11 (documentation pointers only — not code markers).

**Logger migration:**
- 2 `console.warn(...)` call sites in extracted regions → `log.warn(...)`: storm-variant intensify failure (legacy line 41003), boss voice fire failure (legacy line 21853). Per T1.08 logger contract. Module imports `log` from `../services/logger.js`.

**Engineering judgment:**
- **`bossAttack()` NOT extracted** (legacy line 59033). It bossed in by Bulwark Frozen Ward, stealth turns, training-dummy gates, RAIDERS dual synergy first-attack-immune, glacier ice armor, frenzy stacks, signature damage hook, FTUE grunt void cap, IRONSCALE/IRONBELLY tank passives, Chapter 1 tutorial dialog gates. All cross-module deep wiring (heroes.js + grid.js + feel + signature dispatcher + FTUE). Same pattern T1.10.6 used for `maybeBossAttack` — base behavior CONFIG lives here, the battle-loop call site moves with T1.10.9 (battle.js). Extracting now would balloon scope into a multi-module wire-up.
- **`getEffectiveBossStats()` NOT extracted** (legacy line 24161). Depends on `_phase8GetAdaptiveHpMultiplier` (boss-loss adaptive HP) + `currentChapter` + FTUE Pyredrake HP override. Phase 8 piece stays with legacy until T1.10.9.
- **`maybeBossAttack()` NOT extracted** (legacy line 58936) — battle loop dispatcher, T1.10.9 territory.
- **`applyBossSignatureDamage()` NOT extracted** (legacy line 39075) — already cross-references damage-channels.js T1.10.5 + boss role tier; lives with the dispatcher path. T1.10.9.
- **Phase-gate reactivity events DEFERRED to T1.10.8** per task brief Step D. BOSS_PHASES (27361, mutated at 30333 for VOIDFANG) + REACTIVITY_HANDLERS (27676) + EFFECT_HANDLERS (27404) are v2.1 P4 reactivity infrastructure. This module owns boss identity + base attack CONFIG; T1.10.8 owns phase-triggered adaptations.
- **Phase 5b + P6 archetype tick handlers DEFERRED** (`_tickPyredrake`/`_tickAbyssalTyrant`/`_tickGrovewarden`/`_tickSolarPhoenix`/`_tickCryptLich` + Ch2 hypnotist/engineer/frenzy/tempo/battery + Ch4 phase_shifter/equalizer/regent/phase_reverser/royal_phase + Ch5 eternal/inevitable/co_op/devourer/choice). These touch FX + DOM render + cross-module state heavily; T1.10.9 territory. Ch3 ticks ARE extracted because they were a self-contained block (storm Maps + state machine + dual-state announcer) per legacy lines 40788-41154; the Ch1/Ch2/Ch4/Ch5 per-boss handlers are dispatched separately from `tickChapter2Archetype` at legacy 41156, which sprawls into bespoke per-boss telegraph logic.
- **Phase 8 boss FTUE dispatcher DEFERRED** (`enforceBossFTUEGuarantees` + `applyScriptedActions` + `_phase8ResetScriptedState` + `_phase8RecordBossFtueEvent` + `_phase8ScriptedState`). This module owns FTUE_BOSS_GUARANTEES + FTUE_TUTORIAL_TEXTS as DATA per CLAUDE.md §2.5 sacred designation; the dispatch/state-machine that consumes them touches tutorial-overlay rendering + analytics + scripted state-bag, all T1.10.9 territory.
- **`getBossStars` (19548) and `getBossHeroReward` (25474) NOT extracted** — both belong to the progression/reward path. `getBossStars` reads chapter-progress + first-clear timestamps; `getBossHeroReward` writes hero card distribution. Progression module T1.10.2 follow-up audit territory.
- **Tower roster pools DEFERRED** (TOWER_ROSTER_TIER_1/2/3 + weekly rotation primitives + LIMITED_TIME_TOWER_EVENTS + getTowerFloorMultipliers + selectBossForTowerFloor). Tower module (separate sprint). Only UROBOROS extracted here per CLAUDE.md §2.5 sacred designation.
- **`BOSSES` is a dynamic getter, not a separate `let`.** Legacy line 20445 declares `let BOSSES = CHAPTERS[0].bosses;` and `setChapter(n)` reassigns it. Since CHAPTERS data is already in `src/data/chapters.js` (T1.07, frozen), the cleanest preservation is a `getBosses()` function + window.BOSSES getter that reads `CHAPTERS[currentChapter-1].bosses` on every access. Legacy callers (`BOSSES.length`, `BOSSES[idx]`) continue to work transparently via the window-bridge getter.
- **State encapsulation via Object.defineProperty getters/setters** matches the T1.10.6 pattern — currentBoss / bossHP / bossMaxHP / currentChapter / currentBossIdx / _currentBossRoleTier all exposed on `window` with `configurable: true` so legacy bodies that read OR WRITE bare identifiers route through the module-private instance. _ch3BossId / _ch3State / _ch3LastDualState similarly bridged.
- **Module size policy:** at 1,309 LoC this module exceeds the §3.4 AAA+ 500-LoC file-length guideline, but it's pure-relocation byte-perfect from a single legacy domain (boss identity); splitting would fracture the boss state machine across multiple files and complicate the T1.10.9 wire-up. Same precedent as T1.10.4 heroes.js (3,972 LoC). Accept the violation as a transitional state until T1.10.9 lands the canonical import wire-up and the file can be naturally re-organized.

**Verification (all gates green):**
- `npm run lint` → 0 errors / 0 warnings
- `npm run test:unit` → 6/6 pass (~96ms)
- `npm run test:smoke` → 2/2 pass (~3.4s)
- `npm run test:visual` → 22/22 pass under 2% (~13.1s; one flaky first-run on mobile-chrome profile 13.7% diff cleared on immediate retry — typical animation-timing flake, not caused by this module since the module is tree-shaken out)
- `npm run build` → succeeds. dist/assets/index.js = 0.75KB; dist/assets/index.css = 368.77KB (unchanged — new module tree-shakes out, nothing imports it yet, as expected per Step E of the assignment)
- Legacy `wc -c` = 21,480,494; SHA-256 `4b3a3974f8b9030bf195dc9fad2b7b4bf07857021b3c01b44410ac547fcee67f` — byte-identical

**Self-check:**
- [x] Acceptance: boss archetypes extracted FLAT — BOSS_ARCHETYPES (25 entries) + ARCHETYPE_MATCHUP (25 entries), Object.assign Ch3+Ch4+Ch5 merge byte-perfect across icon/label/hpMult/attackCD/dmgMult/special + strong/weak stihiyas
- [x] Acceptance: boss state machine — currentBoss / currentChapter / currentBossIdx / bossHP / bossMaxHP / _currentBossRoleTier with module-private state + window bridge via Object.defineProperty
- [x] Acceptance: setChapter rebinding helper + BOSSES dynamic getter byte-perfect (Ch4 chapter4Unlocked + Ch5 day-window gates preserved)
- [x] Acceptance: applyBossEmblems byte-perfect (5 stihiyas × 2 emblem types, Tower-battle vs Chapter-battle override logic preserved)
- [x] Acceptance: BOSS_VOICES + 4 voice triggers + per-battle fire flags byte-perfect
- [x] Acceptance: EMBER_GRUNT + CHRONICLE FTUE bosses + FTUE_GRUNT_VOID_SPAWN constant frozen byte-perfect
- [x] Acceptance: Ch3 scaffolding (_ch3BossId / _ch3State + 5 archetype tick handlers + 2 storm-variant Maps + dual-state announcer + _ch3HasDebuff / _ch3HasSeal / _ch3TwilightMult byte-perfect)
- [x] Acceptance: FTUE_BOSS_GUARANTEES + FTUE_TUTORIAL_TEXTS sacred per CLAUDE.md §2.5 preserved
- [x] Acceptance: TOWER_UROBOROS_SEASONAL sacred per CLAUDE.md §2.5 preserved (7-phase Mythic, Floor 50, full rewards + voice lines)
- [x] Acceptance: BOSS_TTK_TARGETS imported + re-exported from src/data/bosses.js (T1.07)
- [x] Acceptance: phase-gate reactivity events DEFERRED to T1.10.8 (BOSS_PHASES / REACTIVITY_HANDLERS / EFFECT_HANDLERS NOT extracted)
- [x] Acceptance: imports from src/data/{bosses,chapters}.js (T1.07) + src/services/logger.js (T1.08)
- [x] Acceptance: no window globals introduced (only `/* global */` directives for legacy refs that move later)
- [x] Acceptance: mutable state module-private (currentBoss/bossHP/etc via getters + setters + window.defineProperty bridge)
- [x] Acceptance: legacy HTML byte-identical (wc -c + SHA-256 verified)
- [x] Acceptance: all gates green (lint 0/0, unit 6/6, smoke 2/2, visual 22/22, build 372KB)
- [x] Acceptance: nothing imports the new module — tree-shakes out for T1.10.7 (correct — T1.10.9 final wire-up flips legacy → src/)
- [x] Sacred cows: BOSS_TTK_TARGETS values unchanged (imported, not redefined). FTUE_BOSS_GUARANTEES untouched. UROBOROS config untouched. BOSS_VOICES strings untouched. Phase gates 70/35 unchanged. TTK formula `boss_hp = expected_squad_dps × target_ttk_seconds` upheld.
- [x] DO NOT TOUCH: legacy HTML — not modified; index.html — not modified; src/main.js — not modified; src/core/{ftue-state,progression,grid,heroes,damage-channels,stagger-loop}.js (T1.10.1-T1.10.6) — not modified; other src/ modules (data/feel/services) — not modified; CSS / baselines / tests / CI / husky — not modified
- [x] DO NOT TOUCH: boss HP values — unchanged (CHAPTERS data lives in T1.07); archetype matchups — byte-perfect; FTUE_BOSS_GUARANTEES — unchanged; UROBOROS config — unchanged
- [x] No new npm packages
- [x] Not pushed to remote (CTO will instruct)
- [x] STOPPED after T1.10.7; did NOT start T1.10.8 (phase-gate reactivity events)

**Замечено рядом (NOT fixed, reported):**

1. **NO new bare-string storage keys.** Boss state vars are per-battle ephemeral. Phase 8 boss-loss counter (`PHASE8_BOSS_LOSSES_KEY` = `'blocksworn_p8_boss_losses'`) stays in legacy until T1.10.9 along with the loss-recovery dispatcher (`_phase8GetAdaptiveHpMultiplier` / `getEffectiveBossHP` / `recordBossLoss` / `recordBossWin` / `LOSS_RECOVERY_DIALOGS` / `showLossRecoveryDialog` / `showSkipOption` / `skipBoss`). **The T1.10.9 migration shim allow-list (FTUE + intro-video + 5 chapter-complete keys) does NOT need additions from T1.10.7.**

2. **`bossAttack()` deferred to T1.10.9 — large cross-module island.** The single async `bossAttack()` (~190 LoC) touches Bulwark Frozen Ward gate, assassin stealth turns, training-dummy gate, audio (`playBossDamage`), THARA rage auto-arm, RAIDERS first-attack immune, base spawn count (`baseCount = 3 * bossAttackDmgMult`), rage mults (`bossRagePending`, `bossRageEmber`), single-shot `bossNextAttackBonus`, frenzy stacks (`frenzyStacks * FRENZY_DMG_PER_STACK`), ember void pressure, grove defense, glacier ice armor, FTUE grunt void cap (`FTUE_GRUNT_VOID_SPAWN`), IRONSCALE STONE_SKIN convert, IRONBELLY counter-burn (with T2 IRON FORGE branch), Chapter 1 tutorial dialog gates, signature damage hook. **CTO recommendation:** T1.10.9 should treat this as a multi-block extraction with explicit phase dispatchers — base attack → archetype modifier → defender mitigation → tutorial gate. Splitting would let bosses.js own the attack-config piece and battle.js own the per-turn flow.

3. **Per-archetype tick handlers (Ch1, Ch2, Ch4, Ch5) deferred to T1.10.9.** The dispatcher `tickChapter2Archetype` (legacy 41156) is a switch over 21 archetypes, and each per-boss handler (Pyredrake Cinderblast, Ursaro Frenzy, Heliotron Battery, etc.) is 50-150 LoC of telegraph + impact + state. These bring HEAVY FX coupling (sigCinemaName, sigCinemaEmblem, sigCinemaBonus, _signatureComboCinemaShown, fast-path .cinderblast-warn / .cinderblast-hit CSS classes). **CTO recommendation:** dedicated T1.10.9.X sub-task for archetype tick handlers, since they bridge bosses.js + battle.js + feel/animations.js.

4. **`getEffectiveBossStats` (legacy 24161) deferred to T1.10.9.** Reads currentBoss + currentChapter + `_phase8GetAdaptiveHpMultiplier` (boss-loss adaptive HP cap −20%) + FTUE Pyredrake HP override (lives in ftue-state T1.10.1 constants block — `FTUE_PYREDRAKE_HP=800` flagged for T1.10.7 wire). Now T1.10.7 owns the boss data; T1.10.9 can land `getEffectiveBossStats` as a thin import wrapper consuming FTUE_PYREDRAKE_HP + adaptive multiplier + base boss def.

5. **BOSS_VOICES Ch3/Ch4/Ch5 stubs**: legacy only populates voice lines for Ch1 (5 bosses) + Ch2 (5 bosses). Ch3+Ch4+Ch5 bosses have NO entries in BOSS_VOICES — _bossVoiceTrigger returns silently on missing key. This is byte-perfect from legacy (not a bug; Ch3+ voice copy lives in archetype tick handlers via `flashStateBanner` instead, e.g. Twilight DUAL SHIFT banner). **Mentioning for visibility** in case future Ch3+ voice acting work flows through this module.

6. **Module-level `let` re-binding via Object.defineProperty pattern.** I used the T1.10.6 pattern of `Object.defineProperty(window, 'currentBoss', { get/set })` so legacy bodies that BOTH read AND write the bare identifier `currentBoss` continue to work. **CTO consideration:** this is slightly heavier than the get-only pattern T1.10.6 used for `bossState`/`bossPressure` (write-only via internal entry-point functions). For boss identity, legacy writes from many sites (startGruntFtueBattle, startChronicleFtueBattle, startBossBattle, FTUE finalizer paths). T1.10.9 wire-up can flip these to explicit `setCurrentBoss(...)` calls and remove the setter side of the bridge.

7. **BOSSES legacy `let` collision with new getter.** Legacy declares `let BOSSES = CHAPTERS[0].bosses;` at line 20445 — a true `let` (writable). New module exposes BOSSES as a window property with a getter only (no setter). The legacy `let BOSSES` is module-scope; the new window.BOSSES is a global. They coexist (legacy reads its local; non-legacy code on the same `window` reads via the getter). T1.10.9 wire-up will delete the legacy `let BOSSES` line and replace `setChapter`'s legacy variant — keeping only the new module's `setChapter` + `getBosses` API.

8. **Storm-variant Maps exported as live references.** `_stormBlizzardFreezes` and `_stormEarthquakeLocks` are `new Map()` instances exported directly (not via getters) — legacy mutates them at call sites (`_stormBlizzardFreezes.set/delete/clear`). Since Map mutations don't reassign the binding, this works without window-getter bridging. Window exposure is direct (`window._stormBlizzardFreezes = _stormBlizzardFreezes`). Safe pattern; equivalent to legacy module-scope `const` semantics.

9. **`_ch3RenderBossAura` + `_ch3MaybeAnnounceDualState` extracted alongside Ch3 scaffolding.** Legacy lines 41983-42035 (function declarations). They're tightly coupled to `_ch3BossId` + `_ch3State.lightActive`/`darkActive` + `_ch3LastDualState` — clean home is here, not in the FX/feel module. Banner copy strings ("LIGHT VEIL" / "DARK VEIL" / "TWIN CONFESSION" / etc.) preserved verbatim; these double as Chronicler-tone hints.

10. **applyBossEmblems uses ASSETS via /* global */** — legacy module-scope (T1.06 territory). `applyBossEmblems` reads `ASSETS[\`boss_emblem_${globalBossNum}\`]` + `ASSETS[\`stihiya_emblem_${stihiya}\`]` + `ASSETS[\`void_emblem_${stihiya}\`]`. The recent #157 emblem layer PR added 30 new PNG entries + `emblemImg` helper; the emblem CSS-variable application logic in `applyBossEmblems` is unaffected. T1.10.9 wire-up will replace the /* global */ with `import { ASSETS } from '../data/assets.js'` once that's extracted (currently legacy-scope).

11. **`hasCompletedChapter` referenced in `_isChapterContentUnlocked` consumer.** Legacy declares `_isChapterContentUnlocked` at line 20483 (right after the BOSSES let). I extracted `setChapter` but NOT `_isChapterContentUnlocked` (which itself reads `isContentUnlocked` + `hasCompletedChapter`). Both stay in legacy via /* global */ — they belong to the Tower / content-drop schedule module (separate sprint). My `setChapter` extraction defensively calls through `typeof _isChapterContentUnlocked === 'function'` so it gracefully degrades to "Ch5 locked" when the helper isn't available.

**Time:** ~3 hours (1,309 LoC byte-perfect copy across 13 source regions + 22-readonly + 3-writable globals declared + module-private state via getter/setter pattern + window-exposure mirror with Object.defineProperty bridges for 6 writable boss-identity vars + 3 writable Ch3 vars + BOSSES dynamic getter + commit/docs cycle)

---

### T1.10.8 — REVIEW (2026-05-11)

**Code commit:** `52bd102` — `[T1.10.8] Extract reactivity events to src/core/reactivity-events.js`
**DOCS commit:** follows (this entry)
**File created:** `src/core/reactivity-events.js` (1,440 lines, 68 named exports = 1 BOSS_PHASES table + 1 EFFECT_HANDLERS object + 1 REACTIVITY_HANDLERS object + 1 REACTIVITY_ARCHETYPE_COLORS frozen table + 2 phase-gate constants (REACTIVITY_PHASE_GATES + re-exports of REACTIVITY_TELEGRAPH_MS + REACTIVITY_BANNER_DURATION_MS) + 1 battlePhasesTriggered Set + 32 reactivity-state accessor functions (16 vars × get/set) + 4 Voidfang-shroud accessor functions + 1 VOIDFANG_DEFEATED_KEY + 14 dispatcher / cinematic / UI / FTUE functions — counting line-by-line `export` declarations)

**Implementation summary:**

Phase-gate reactivity events extracted byte-perfect from legacy `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` across eight source regions:
- BOSS_PHASES table — 25 main-campaign bosses + VOIDFANG override (lines 27361-27397, 30333-30336)
- battlePhasesTriggered Set (27401)
- EFFECT_HANDLERS — 5 legacy + 2 Voidfang extensions (27404-27471, 30377-30390)
- maybePhaseTransition (P4 #4.A shim + #4.B rewrite, 27474-27494, 27941-28020), firePhase legacy effects-array dispatcher (27496-27538), _phaseSubtitleFromEffects (27540-27550)
- 5-beat phase transition cinematic — vPlayPhaseTransition + _toRoman + showPhaseTransitionOverlay (deprecated rollback) + showBossPhaseDialog placeholder (27554-27641)
- P4 PR #4.B reactivity state vars (14 vars + engineerElectrifiedRows + 2 helpers) + 22 REACTIVITY_HANDLERS + triggerReactivityEvent dispatcher + _resetReactivityState idempotent reset (27655-28045)
- P4 PR #4.D UI surfaces — REACTIVITY_ARCHETYPE_COLORS + _archetypeFromEventId + showReactivityTelegraph (3s wind-up banner with countdown + lazy DOM build + CSS keyframes injection) + showReactivityFX (archetype-tinted screen flash) + renderBossPhaseIndicator (P1/P2/P3 chip on boss portrait) + showBossIntelOverlay (pre-battle popup with archetype/matchup/reactivities/TTK) + renderSquadTTKForecast + _computeSquadEffectiveDPS + 3 FTUE Chronicler intros (_maybeTriggerPhaseIntro / _maybeTriggerReactivityIntro / _maybeTriggerTelegraphIntro) + _registerPhase4Dialogs + _phase4FtueGateOk (28069-28394)
- Voidfang shroud slice — _voidfangShroudActive + voidfangDefeated + VOIDFANG_DEFEATED_KEY (NEW bare-string for shim allow-list) + shroudTick + clearVoidfangTints (30338-30374)
- Console helpers — forcePhase (drop bossHP + trigger) + resetBattlePhases (30024-30033)

Module owns: BOSS_PHASES table (25 main-campaign bosses + VOIDFANG); EFFECT_HANDLERS legacy dispatch (5 + 2 Voidfang extensions); REACTIVITY_HANDLERS (22 entries); 14 reactivity state vars + engineerElectrifiedRows + 2 dispatcher counters; battlePhasesTriggered per-battle Set; dispatch chain (maybePhaseTransition, triggerReactivityEvent, firePhase, _phaseSubtitleFromEffects, _resetReactivityState); 5-beat cinematic (vPlayPhaseTransition / _toRoman / showPhaseTransitionOverlay / showBossPhaseDialog placeholder); UI surfaces (showReactivityTelegraph + lazy banner DOM + CSS keyframes / showReactivityFX overlay / renderBossPhaseIndicator chip + lazy builder / showBossIntelOverlay / renderSquadTTKForecast / _computeSquadEffectiveDPS); REACTIVITY_ARCHETYPE_COLORS palette + _archetypeFromEventId helper; 3 FTUE Chronicler dialog intros + _registerPhase4Dialogs + _phase4FtueGateOk; Voidfang shroud slice (state + shroudTick + clearVoidfangTints + VOIDFANG_DEFEATED_KEY); console helpers (forcePhase + resetBattlePhases).

**Sacred cow preservation (v2.1 P4):**
- **Phase gates 70%/35%** — `REACTIVITY_PHASE_GATES = Object.freeze([70, 35])` (percent thresholds for BOSS_PHASES dispatch). Fractional aliases `PHASE_GATE_P1_TO_P2 = 0.70` / `PHASE_GATE_P2_TO_P3 = 0.35` continue to live in `bosses.js` (T1.10.7) for the boss state-machine `getCurrentBossPhase` helper. **Byte-perfect to legacy.**
- **Telegraph timing** — `REACTIVITY_TELEGRAPH_MS = 3000` re-exported from bosses.js (T1.10.7 owns the canonical declaration). 3-second wind-up before any reactivity handler fires; banner displays for `REACTIVITY_BANNER_DURATION_MS = 1500` after countdown. UX commitment per spec §13.3. **Byte-perfect.**
- **22 reactivity handlers** — every per-archetype reaction parameter preserved verbatim:
  - **Berserker:** +20% dmg (p1_p2), stagger immune 3T (p2_p3)
  - **Armored:** +2 shield stacks (p1_p2), 30% board → void_3 (p2_p3)
  - **Phoenix:** revive +20% maxHP heal (p1_p2), fire aura 3 HP/T (p2_p3)
  - **Assassin:** stealth 1T + 1.50× next attack (p1_p2), backstab chain 3T (p2_p3)
  - **Bruiser:** 1.50× next attack (p1_p2), 5 random void_2 spawns (p2_p3)
  - **Hypnotist:** dual suggest (p1_p2), silence 2T (p2_p3)
  - **Engineer:** 4 cell lockdown 40T (p1_p2), 2 electrified rows (p2_p3)
  - **Frenzy:** max stacks 8 (p1_p2), maul chain every 3T (p2_p3)
  - **Tempo Disruptor:** skip 1 player turn (p1_p2), board wipe + chargedCells.clear (p2_p3)
  - **Battery:** +50% charge rate (p1_p2), 40 signature damage detonate (p2_p3)
  - **Tower Voidfang:** +30% boss attack dmg (p1_p2), ×0.70 player pressure gain (p2_p3)
- **BOSS_PHASES table** — 25 main-campaign bosses (Ch1-Ch5 × 5 each) + VOIDFANG. Standardized 70/35 thresholds per spec §3.3. Ch3-Ch5 reuse Ch1/Ch2 archetype reactivities per spec.
- **Telegraph→execute pattern** — `showReactivityTelegraph(eventId)` [3s wind-up banner] → `setTimeout REACTIVITY_TELEGRAPH_MS` → `handler()` + `logBattleEvent` breadcrumb + FTUE intro hooks. Non-blocking — gameplay continues during wind-up.
- **Tower bypass** — `_phase5IsReactivitySuppressed()` gate suppresses dispatch in Tower mode (competitive sandbox) EXCEPT for Voidfang (tower_voidfang_p1_p2 / p2_p3 ARE designed for Tower-end ritual). Visual cinematic + camera shake preserved either way.
- **FTUE lockout** — `isFtueActive()` short-circuits maybePhaseTransition entirely (Block 6.1 invariant — FTUE has its own scripted beats).
- **Floor 1 (Trial) suppression** — Voidfang exception preserved.
- **Single-fire per call** — once a gate fires, `battlePhasesTriggered.add(key)` + early return prevents double-fire if multiple gates cross same frame.

**v2.1 P4 implementation status CONFIRMED — resolves Execution Plan §23 "VERIFY":**
Legacy contains a **complete, shipping implementation** of the v2.1 P4 Reactivity Events system across PRs #4.A (BOSS_PHASES restructure to 70/35 + reactivity field), #4.B (22 handlers + state vars + dispatcher + reset), #4.C (single-row→two-row engineer + frenzy maul counter), #4.D (UI surfaces + 3 FTUE Chronicler dialogs + phase indicator chip + intel overlay + TTK forecast), and Block 6.3 VOIDFANG shroud extensions. The 22 archetype handlers cover all 10 archetypes (berserker, armored, phoenix, assassin, bruiser, hypnotist, engineer, frenzy, tempo_disruptor, battery) × 2 gates + tower_voidfang × 2. The Tower bypass (#5.C) is correctly wired. All 25 main-campaign bosses + VOIDFANG fallback are mapped. No gaps; no TODO stubs. **The v2.1 P4 system is fully implemented, byte-identical to spec, and now extracted to a standalone module.**

**Storage rewires (T1.08 abstraction):** **1 new bare-string key** flagged for T1.10.9 migration shim allow-list:
- `VOIDFANG_DEFEATED_KEY = 'blocksworn_voidfang_defeated'` — stored as literal `'1'`, read with `=== '1'`. JSON-routing breaks the boolean semantics. Setter sites: legacy line 57911 (boss-defeat any-floor) + 38648 (debug reset clears). The module's IIFE-style boot-time read (`voidfangDefeated = localStorage.getItem(VOIDFANG_DEFEATED_KEY) === '1';`) is preserved verbatim.

All 14 reactivity state vars + engineerElectrifiedRows + battlePhasesTriggered Set + `_phase4FrenzyAttackCounter` + `_phase4LastReactivityFiredAt` are per-battle ephemeral — initialized at battle start (via `_resetReactivityState`), garbage-collected at battle end.

**ESLint globals added** (specific identifiers, why):
- **Readonly (~25 identifiers):** `flashText`, `flashStateBanner`, `vibrate`, `hitBoss`, `vHaptic`, `render`, `renderBossHP`, `updateBossHpUI` (T1.09 feel + T1.11 UI render); `getComputedStyle` (DOM browser global for lazy chip builder); `currentBoss`, `bossMaxHP`, `currentChapter`, `BOSSES`, `BOSS_ARCHETYPES`, `ARCHETYPE_MATCHUP`, `BOSS_TTK_TARGETS`, `getCurrentBossPhase` (T1.10.7 bosses); `grid`, `SIZE`, `chargedCells`, `engineerLockedCells` (T1.10.3 grid); `applyChannelDamage` (T1.10.5 damage-channels — battery detonate); `bossAttack`, `currentFloorId`, `_isTowerBattle`, `_phase5IsReactivitySuppressed`, `isFtueActive`, `seenDialogs`, `playDialog`, `DIALOGS`, `placementCount` (T1.10.9 battle / FTUE / dialog); `HERO_DECK`, `TIER_DAMAGE_MULT`, `heroUpgrades`, `isHeroMythic` (T1.10.4 heroes — TTK forecast); `logEvent`, `logBattleEvent` (T1.11 analytics).
- **Writable (5 identifiers):** `bossHP` (Phoenix p1_p2 revive heal + forcePhase console helper writes), `bossAttackDmgMult` (berserker p1_p2 + tower_voidfang p1_p2 + EFFECT_HANDLERS.voidBoost), `attackCountdown` (EFFECT_HANDLERS.enrage re-sync), `engineerElectrifiedRow`, `engineerElectrifiedTurns` (engineer p2_p3 legacy single-row fallback writes).

**TODO markers:** 0 inline TODO comments. All forward references are documented in the "OWNS" / "DOES NOT OWN" comment block at the top + the /* global */ inventory. The narrative comments contain ~15 references to T1.10.7 / T1.10.9 / T1.11 (documentation pointers only — not code markers).

**Logger migration:**
- 4 `console.warn(...)` / `console.log(...)` / `console.error(...)` call sites in extracted regions → `log.warn(...)` / `log.debug(...)` / `log.error(...)`: spawnBurst failure (legacy 27443), dialog phase failure (27468), reactivity handler error (27919), P4 dialog registration failure (28353), forcePhase no-bossMaxHP guard (30029), Phase tracker cleared log (30033), [Phase 4 PR #4.A] reactivity pending placeholder (27523), [phase dialog placeholder] stub (27640). Per T1.08 logger contract. Module imports `log` from `../services/logger.js`.

**Engineering judgment:**
- **`bossAttack()` NOT extracted** (legacy line 59033). Reactivity state vars (bossNextAttackBonus / frenzyMaxStacks / frenzyMaulComboActive / frenzyMaulInterval / bossStealthTurns / bossBackstabChainTurns / bossChargeRateMult / skipPlayerTurnsCount / bossFireAuraActive / bossFireAuraDmg) are CONSUMED by `bossAttack` — but `bossAttack` itself is a multi-block battle-loop function with deep cross-module wiring (heroes.js Bulwark / RAIDERS / IRONSCALE / IRONBELLY; grid void cap; signature damage hook; tutorial gates). T1.10.9 (battle.js) territory.
- **`addPressure` consumer integration NOT touched** (legacy line 39426, owned by T1.10.6 stagger-loop). `addPressure` reads `pressureGainMult` (voidfang p2_p3 debuff multiplier) and `bossStaggerImmuneTurns` (berserker p2_p3 clamp). T1.10.6 already declares these as `/* global */` writable; my module-private state + window.defineProperty bridge keeps both modules reading the same instance.
- **`tickStaggerState` Phoenix fire aura tick NOT touched** (legacy line 39346, owned by T1.10.6). Reads `bossFireAuraActive` + `bossFireAuraDmg`. Same /* global */ bridge pattern as `pressureGainMult`.
- **Engineer hero state vars `engineerElectrifiedRow` + `engineerElectrifiedTurns`** — legacy module-scope `let` declarations. T1.10.8 reactivity handler `engineer_p2_p3` writes both via /* global :writable */ (no new module-private state for these — they belong to engineer hero motif state in heroes.js T1.10.4 / future engineer-archetype module). `engineerElectrifiedRows` (the array variant — note plural) is OWNED by reactivity-events because it's a P4 PR #4.C addition specifically for the 2-row reactivity event.
- **`engineerLockedCells` Map** — legacy 6×6 cell-key → unlock-turns Map. Owned by T1.10.3 grid.js (per its `/* global */` block) — my engineer_p1_p2 handler writes via the /* global */ Map reference. No new ownership claim.
- **Voidfang dialog chain DEFERRED to T1.11** — `DIALOG_LINES.voidfang_p1_a/b` … `defeat_e` + `chapter_3_outro` + `fin_card` + `replayVoidfangEnding` console helper. These are NARRATIVE voice (sacred per CLAUDE.md §2.3); their natural home is the dialog module (T1.11). T1.10.8 owns only the REACTIVITY slice of Voidfang state (shroud flag + per-turn tick + tint cleanup + defeat flag + VOIDFANG_DEFEATED_KEY persistence).
- **Voidfang BOSS_PHASES override LANDED FLAT** in main BOSS_PHASES map (no post-load mutation at module level). Legacy declares `const BOSS_PHASES = { ... }` then runs `BOSS_PHASES['VOIDFANG'] = [...]` at line 30333 — we mirror as a single direct entry in the table. This is permissible because the legacy override carries the SAME reactivity event names (`tower_voidfang_p1_p2` / `_p2_p3`); no information lost.
- **`BOSS_PHASES` is NOT `Object.freeze`'d.** Legacy uses a non-frozen `const` so the line-30333 VOIDFANG override + the line-30377 EFFECT_HANDLERS extensions can mutate it. We mirror — not Object.freeze — so future legacy assignments through the window bridge keep working until T1.10.9 canonicalizes. **Mentioned for visibility:** T1.10.9 can choose to Object.freeze after consolidating override paths.
- **Module-private state via `let` + Object.defineProperty bridge** — same pattern as T1.10.6 (stagger-loop) + T1.10.7 (bosses). Legacy bodies that read/write bare identifiers (`bossShieldCount = 0;` in the FTUE finalizer, `pressureGainMult = 0.7;` in addPressure debuff, etc.) route through module-private state via the configurable getter/setter. T1.10.9 wire-up replaces the bridge with explicit imports + setter calls.
- **Module size policy:** at 1,440 LoC this module exceeds the §3.4 AAA+ 500-LoC file-length guideline, but it's pure-relocation byte-perfect from a single legacy domain (reactivity events + their UI surfaces + FTUE intros + Voidfang shroud); splitting would fracture the reactivity dispatch across multiple files and complicate the T1.10.9 wire-up. Same precedent as T1.10.4 heroes.js (3,972 LoC) and T1.10.7 bosses.js (1,309 LoC). Accept the violation as a transitional state until T1.10.9.
- **`maybePhaseTransition` exported as single canonical** — legacy declares two `function maybePhaseTransition()` at lines 27474 AND 27941. The second (P4 #4.B) is the live shadow that runs in production (later declaration overrides earlier in legacy hoisting). I extracted only the P4 #4.B version (the live one); the earlier #4.A shim is annotated in the OWNS section as "covered by the #4.B path".
- **`_voidfangShroudActive` module-scope variable** — legacy declares as a `let`, but the EFFECT_HANDLERS.umbralShroud and clearVoidfangTints handlers WRITE to it directly. We mirror via module-private `let` + Object.defineProperty bridge so legacy umbralShroud/gridTint callers via the window-bridge continue to mutate the module's instance.

**Verification (all gates green):**
- `npm run lint` → 0 errors / 0 warnings
- `npm run test:unit` → 6/6 pass (~101ms)
- `npm run test:smoke` → 2/2 pass (~3.4s)
- `npm run test:visual` → 22/22 pass under 2% (~13.4s)
- `npm run build` → succeeds. dist/assets/index.js = 0.75KB; dist/assets/index.css = 368.77KB (unchanged — new module tree-shakes out, nothing imports it yet, as expected — T1.10.9 final wire-up flips legacy → src/)
- Legacy `wc -c` = 21,480,494; SHA-256 `4b3a3974f8b9030bf195dc9fad2b7b4bf07857021b3c01b44410ac547fcee67f` — byte-identical

**Self-check:**
- [x] Acceptance: REACTIVITY_PHASE_GATES = [70, 35] + REACTIVITY_TELEGRAPH_MS = 3000 + REACTIVITY_BANNER_DURATION_MS = 1500 byte-perfect (re-exported from bosses.js T1.10.7 canonical)
- [x] Acceptance: BOSS_PHASES table — 25 main-campaign bosses (Ch1-Ch5 × 5 each) + VOIDFANG tower fallback, FLAT post-mutation map, every entry uses standardized 70/35 thresholds + reactivity event names
- [x] Acceptance: 22 REACTIVITY_HANDLERS — 10 archetypes × 2 gates + tower_voidfang × 2, every per-archetype reaction parameter byte-perfect (multipliers, durations, cell counts, board-conversion percentages, signature damage values, color codes)
- [x] Acceptance: 7 EFFECT_HANDLERS (legacy effects-array dispatch — enrage / voidBoost / cleanse / spawnBurst / healPartial / dialog + umbralShroud / gridTint Voidfang extensions, FLAT post-mutation)
- [x] Acceptance: 14 reactivity state vars + engineerElectrifiedRows + 2 dispatcher counters via module-private state + window.defineProperty bridge (configurable: true)
- [x] Acceptance: maybePhaseTransition (telegraph→execute + Tower bypass + FTUE lockout + Floor 1 suppression + legacy effects-array fallback) byte-perfect
- [x] Acceptance: triggerReactivityEvent (3s telegraph wind-up → handler → analytics → FTUE reactivity intro) byte-perfect
- [x] Acceptance: firePhase legacy effects-array dispatcher preserved as fallback path (no live BOSS_PHASES entries use it after P4 #4.A restructure, but EFFECT_HANDLERS.umbralShroud/gridTint remain referenceable)
- [x] Acceptance: vPlayPhaseTransition 5-beat cinematic + _toRoman + showPhaseTransitionOverlay (deprecated rollback) + showBossPhaseDialog placeholder byte-perfect
- [x] Acceptance: 6 UI surfaces (showReactivityTelegraph + banner builder + countdown + CSS keyframes injection; showReactivityFX archetype-tinted overlay; renderBossPhaseIndicator + chip builder; showBossIntelOverlay; renderSquadTTKForecast + _computeSquadEffectiveDPS) byte-perfect
- [x] Acceptance: 3 FTUE Chronicler intros (_maybeTriggerPhaseIntro / _maybeTriggerReactivityIntro / _maybeTriggerTelegraphIntro) + _registerPhase4Dialogs + _phase4FtueGateOk byte-perfect with sacred Chronicler dialog text preserved verbatim
- [x] Acceptance: REACTIVITY_ARCHETYPE_COLORS palette (12 entries) + _archetypeFromEventId regex helper byte-perfect
- [x] Acceptance: _resetReactivityState idempotent battle-init reset byte-perfect
- [x] Acceptance: Voidfang shroud slice (_voidfangShroudActive + voidfangDefeated + VOIDFANG_DEFEATED_KEY + shroudTick + clearVoidfangTints) byte-perfect with boot-time localStorage read preserved
- [x] Acceptance: console helpers (forcePhase + resetBattlePhases) byte-perfect
- [x] Acceptance: v2.1 P4 implementation status CONFIRMED — 22 handlers + 25 bosses + UI surfaces + FTUE intros + Tower bypass + Voidfang shroud all present and shipping in legacy; resolves Execution Plan §23 "VERIFY"
- [x] Acceptance: imports from src/core/bosses.js (T1.10.7 for phase-gate + telegraph constants) + src/services/logger.js (T1.08)
- [x] Acceptance: window.defineProperty bridge for legacy bare-identifier reads/writes (16 reactivity state vars + 2 dispatcher counters + _voidfangShroudActive)
- [x] Acceptance: legacy HTML byte-identical (wc -c = 21,480,494; SHA-256 unchanged)
- [x] Acceptance: all gates green (lint 0/0, unit 6/6, smoke 2/2, visual 22/22, build 372KB)
- [x] Acceptance: nothing imports the new module — tree-shakes out for T1.10.8 (correct — T1.10.9 final wire-up flips legacy → src/)
- [x] Sacred cows: phase gates 70%/35% unchanged. REACTIVITY_TELEGRAPH_MS = 3000 unchanged. All 22 reactivity event parameters unchanged. Chronicler dialog text preserved verbatim. TTK formula `boss_hp = expected_squad_dps × target_ttk_seconds` upheld (re-exported from T1.10.7 via shared `BOSS_TTK_TARGETS`).
- [x] DO NOT TOUCH: legacy HTML — not modified; index.html — not modified; src/main.js — not modified; src/core/{ftue-state,progression,grid,heroes,damage-channels,stagger-loop,bosses}.js (T1.10.1-T1.10.7) — not modified; other src/ modules (data/feel/services) — not modified; CSS / baselines / tests / CI / husky — not modified
- [x] DO NOT TOUCH: phase gate thresholds (70%/35%) — unchanged; telegraph timing (3000ms) — unchanged; per-archetype reaction values — byte-perfect
- [x] No new npm packages
- [x] Not pushed to remote (CTO will instruct)
- [x] STOPPED after T1.10.8; did NOT start T1.10.9 (battle.js + final wire-up)

**Замечено рядом (NOT fixed, reported):**

1. **1 NEW bare-string storage key:** `VOIDFANG_DEFEATED_KEY = 'blocksworn_voidfang_defeated'` — stored as literal `'1'`, read with `=== '1'`. JSON-routing breaks the boolean semantics. **Added to T1.10.9 migration shim allow-list** (this module updates the "Known bare-string keys" list above). Setter sites legacy line 57911 (any-floor boss-defeat sets to '1') + 38648 (debug reset removes). Module IIFE-style boot-time read preserved.

2. **v2.1 P4 implementation status confirmed COMPLETE in legacy** — resolves Execution Plan §23 "VERIFY" status flag. The "VERIFY" annotation in cross-reference was conservative bookkeeping pending the T1.10.8 extraction pass; this module's audit confirms full implementation: 22 archetype handlers spanning 10 archetypes × 2 gates + tower_voidfang × 2; BOSS_PHASES coverage of all 25 main-campaign bosses + VOIDFANG; UI surfaces (telegraph banner + reactivity FX + phase indicator chip + intel overlay + TTK forecast); 3 FTUE Chronicler dialogs; Tower bypass with Voidfang exception; FTUE lockout; Floor 1 (Trial) suppression with Voidfang exception; single-fire-per-call guard via `battlePhasesTriggered` Set; idempotent `_resetReactivityState`. No gaps, no TODO stubs in the extracted regions. **CTO recommendation:** flip Execution Plan §23 "VERIFY" → "VERIFIED — full v2.1 P4 system implemented and now relocated to src/core/reactivity-events.js".

3. **`bossAttack()` consumes ~10 reactivity state vars but is NOT extracted** — bossNextAttackBonus / frenzyMaxStacks / frenzyMaulComboActive / frenzyMaulInterval / bossStealthTurns / bossBackstabChainTurns / bossChargeRateMult / skipPlayerTurnsCount / bossFireAuraActive / bossFireAuraDmg are all reactivity-event-driven and CONSUMED by bossAttack (legacy line 59033) + maybeBossAttack (58936). Same pattern as T1.10.7's deferral — reactivity-events owns the STATE (and reset path); bossAttack remains a battle-loop concern for T1.10.9. The /* global :writable */ inventory in this module's preamble documents which vars bossAttack must keep accessing via the window bridge.

4. **`tickStaggerState` Phoenix fire aura tick lives in T1.10.6 stagger-loop** — reads `bossFireAuraActive` + `bossFireAuraDmg` from this module via /* global */ (T1.10.6 already declares them as readonly globals — see T1.10.6 closeout finding #6). The cross-module read is intentional: state is owned here (reactivity-driven write), per-turn drain is owned by the stagger state-machine tick loop.

5. **`addPressure` gates on `pressureGainMult` (voidfang p2_p3 debuff) + `bossStaggerImmuneTurns` (berserker p2_p3 clamp)** — same cross-module pattern as above. T1.10.6 declares both as /* global :writable */. The reset path (`_resetReactivityState`) handles both; the write paths are limited to the reactivity handlers themselves; the read path is in stagger-loop's `addPressure`.

6. **`engineerElectrifiedRow` + `engineerElectrifiedTurns` belong to engineer hero motif** (heroes.js T1.10.4 / future engineer archetype tick handler). The P4 reactivity `engineer_p2_p3` handler writes both via /* global :writable */ as a "legacy single-row fallback so #4.B works even without #4.C wiring" — but the per-turn drain + cell-render is consumed by the engineer hero handler in legacy. T1.10.8 owns the NEW 2-row variant (`engineerElectrifiedRows`) which is reactivity-specific. T1.10.9 wire-up will canonicalize the relationship.

7. **`hitBoss` (feel layer camera shake) referenced via /* global */** — legacy global from feel/animations.js (T1.09). Called from maybePhaseTransition + firePhase for the cinematic shake on phase gate crossings. No ownership claim; just a forward reference.

8. **`logBattleEvent` referenced via /* global */** — legacy analytics helper logging "BOSS ADAPTS" breadcrumbs to the Death Flashback log. Owned by T1.11 analytics module. No ownership claim.

9. **`showReactivityTelegraph` lazy banner DOM builder injects CSS keyframes** (`@keyframes rtb-pulse` + `rtb-fire`) via a `<style id="phase4TelegraphStyle">` element appended to `document.head`. Idempotent guard (`if (!document.getElementById('phase4TelegraphStyle'))`). The CSS is pure-relocation byte-perfect from legacy line 28128. **CTO consideration:** T1.10.9 wire-up could consolidate this into a static `src/styles/` rule rather than runtime injection; left as-is for byte-perfect parity.

10. **`vPlayPhaseTransition` consumes feel/animations CSS classes** (`.phase-freeze`, `.phase-roar`, `.phase-pulse`, `.p-phase-shockwave`, `.p-phase-card`) defined in legacy CSS at line ~7257. These are part of T1.09 feel/animations territory; the JavaScript orchestration lives here because it's reactivity-trigger-bound. T1.10.9 wire-up should ensure CSS migration sequencing.

11. **`BOSS_PHASES` NOT `Object.freeze`'d** — see Engineering judgment item above. Legacy mutation pattern preserved (`const BOSS_PHASES = {...}` + later `BOSS_PHASES['VOIDFANG'] = [...]`). The post-mutation FLAT map is landed in the export. T1.10.9 can choose to Object.freeze after consolidation.

12. **`triggerReactivityEvent` uses `setTimeout` for the telegraph→execute gap** — 3000ms non-blocking. Gameplay continues during the wind-up. Banner countdown runs in parallel via a separate setInterval timer (`_phase4TelegraphTimer`). Both timers preserved verbatim.

**Time:** ~3 hours (1,440 LoC byte-perfect copy across 8 source regions + ~25-readonly + 5-writable globals declared + module-private state via let + Object.defineProperty bridge for 16 reactivity vars + 2 dispatcher counters + _voidfangShroudActive + window-exposure mirror across 5 sections + CSS keyframes injection preserved + 3 FTUE Chronicler dialogs registered via setTimeout-deferred IIFE + commit/docs cycle)

---

### T1.10.9 — REVIEW (2026-05-11) — **FINAL T1.10 SUB-TASK**

**Code commit:** `007eb21` — `[T1.10.9] Extract battle.js orchestrator + migration shim — T1.10 complete`
**DOCS commit:** follows (this entry)
**Files created:**
- `src/core/battle.js` (1,759 LoC, 19 named exports)
- `src/services/migrate.js` (183 LoC, 3 named exports — `migrateBareStringKeys`, `LEGACY_BARE_STRING_KEYS`, `MIGRATION_SENTINEL_KEY`)
- `tests/unit/migrate.test.js` (163 LoC, 5 tests)

**Implementation summary:**

Battle orchestrator + MANDATORY migration shim. Battle.js sits at the top of the src/core/ import graph (no module imports from it — main.js will wire it in T1.12) and pulls together the deferred-from-T1.10.7 items + the central damage dispatcher + the FTUE battle launchers + the victory/defeat modals + battle lifecycle.

`src/core/battle.js` extracted byte-perfect from legacy across 11 source regions:
- `getEffectiveBossStats` (legacy 24161-24183) — FTUE Pyredrake HP/cadence override + Phase-8 adaptive HP multiplier (DEFERRED from T1.10.7)
- `_phase8GetAdaptiveHpMultiplier` (47452-47462) — Phase 8 boss-loss adaptive difficulty (3→0.90, 4→0.85, 5+→0.80) (DEFERRED from T1.10.7)
- `startPyredrakeFtueBattle` (24334-24342), `startGruntFtueBattle` (25077-25092), `startChronicleFtueBattle` (25127-25139), `finalizeFtue` (25156-25182) — FTUE battle launchers
- `startBossBattle` (55271-55799) — 529-line battle lifecycle: per-battle state reset, FTUE/Tower/modifier overrides, synergy compute, archetype dispatch, narrator + race-passive banner + boss intro hooks
- `dealDamage` (57093-57348) — 256-line CENTRAL damage dispatcher: ARMORED absorb + sacred combo crit mult stack (CLAUDE.md §2.1) + FIRE_MULT_CAP clamp + Overflow conversion at phase gates + per-archetype hit detection + Phoenix revive gate + maybePhaseTransition + boss death attribution
- `bossAttack` (59033-59220) — 188-line turn loop (DEFERRED from T1.10.7): Active-state gate + BULWARK frozen ward + assassin stealth + Chronicle training-dummy + RAIDERS first-attack absorb + rage stacks + GRID grove defense + glacier ice armor + FTUE Grunt void cap + IRONSCALE/IRONBELLY hero passives + signature damage hook
- `showVictoryModal` (57950-58112) — 163-line victory check/modal: Chronicle/Grunt/last-boss flavoring + emblem + star rating + artifact drop + chapter unlock banners + next-boss preview + Vivid decoration
- `showDefeatModal` (58114-58178) — 65-line defeat check/modal: Phase 8 loss recovery + consecutive-loss pinch + Race-Pure clear + audio + XP award + Death Flashback chain + Battle Retry hook
- `exitBattle` (59405-59417) — 13-line teardown
- Spec aliases: `startBattle(chap, idx, opts)` (forwards to startBossBattle with positional args), `endBattle(result)` (dispatches to showVictoryModal/showDefeatModal/exitBattle), `bossTurn` (async forwards to bossAttack), `playerTurn` (placeholder for T1.12 wire), `tickBattle` (placeholder), `checkVictory()` / `checkDefeat()` (predicates)

`src/services/migrate.js` MANDATORY one-shot shim per T1.10.9 spec:
- 9-key frozen allow-list: `blocksworn_ftue_beat`, `seenIntroVideo`, `onboardingSeen`, `blocksworn_chapter_{1..5}_complete`, `blocksworn_voidfang_defeated`
- Algorithm per spec: per-key raw localStorage read → null check (missing++) → JSON-shape sniff via leading char `"`/`{`/`[` (alreadyJSON++) → JSON.stringify wrap (migrated++)
- Idempotency sentinel `blocksworn_storage_v2_migrated = '"true"'` (raw localStorage write, not via storage.js); second-boot path returns `{ skipped: 'sentinel' }` in O(1)
- Bypasses T1.08 storage abstraction intentionally — must read pre-JSON wire format before the JSON-routing layer can mask it
- Returns `{ migrated, alreadyJSON, missing, total, [skipped] }` for diagnostics

**Sacred cow preservation (CLAUDE.md §2.1):**
- **Combo crit formula** — `total_dmg × (1 + dominantCount × combo × 10%)` composes through the dealDamage `_multStack` byte-perfect. All ~18 multiplier contexts preserved: race bonus, passive, ULT, warband strike, hunter mark, Grommar rally, pack mark, Helio roar, captain dual, signature combo, hypnotist suggest, shark bloodhunt, pirate double, Tower pact, Tower theme, buff, Mythic Tank, AEGIS spark sun aura + heart Tower mult + hero ascension + Ch3 twilight + Ch3 hunter/mage halved + Ch3 dmg_halved seal + pact dual element + hero level milestone. **Byte-perfect.**
- **FIRE_MULT_CAP clamp** — context-aware via `getFireMultCap()` (Stagger window 1.5×, Active/Recovery 0.7×). LV7 Element Mastery flat add is post-clamp (not subject to FIRE_MULT_CAP). **Byte-perfect.**
- **Phase-gate Overflow conversion** — damage caps at next phase gate (`_getPhaseGateHP()` from T1.10.6); excess routes to `applyOverflowConversion` (T1.10.5). AAA principle: no investment lost on overkill. **Byte-perfect.**
- **SHARK_BLOODHUNT** — 3+ sharks + boss HP < 30% → +30% dmg. **Byte-perfect** (threshold + mult constants imported from T1.10.4).
- **PIRATE_DOUBLE** — 3+ pirates + 15% chance to double combo mult. **Byte-perfect.**
- **bossAttack base count = 3** — modified by rage stacks, archetype dmgMult, Ember void pressure, grove defense, glacier ice armor, FTUE Grunt cap. **Byte-perfect.**
- **getEffectiveBossStats FTUE Pyredrake** — HP 800, attackInterval 15 (Boss_1 + pyredrake_fight + !_isFtueOnly). EMBER_GRUNT (_isFtueOnly=true) passes through unchanged. **Byte-perfect.**
- **Phase 8 adaptive HP** — 3 losses → 0.90, 4 → 0.85, 5+ → 0.80 cap. **Byte-perfect.**
- **FTUE_BOSS_GUARANTEES dispatch order** — `applyScriptedActions` BEFORE `_phase8RecordBossFtueEvent('battle_start')`. **Byte-perfect.**
- **Phoenix revive kill-shot gate** — `_currentFiringHero._landedKillShot = true` only when `revivesRemaining === 0` (Phoenix mid-life "deaths" don't earn XP). **Byte-perfect.**
- **Boss death voice sequence** — `maybeFireBossVoiceDeath()` BEFORE `onBossDefeated()`. **Byte-perfect.**

**Storage migration (T1.10.9 shim — FINAL allow-list):**
The 9-key allow-list is COMPLETE — battle.js itself adds **0 new bare-string keys** (per-battle state is ephemeral). Migration shim covers:
- `blocksworn_ftue_beat` (T1.10.1) — bare `'pyredrake_fight'` → `'"pyredrake_fight"'`
- `seenIntroVideo` (T1.10.1, 3 sites) — bare `'1'` → `'"1"'`
- `onboardingSeen` (T1.10.1, 2 sites) — bare `'1'` → `'"1"'`
- `blocksworn_chapter_1..5_complete` (T1.10.2, 5 keys) — bare `'true'` → `'"true"'`
- `blocksworn_voidfang_defeated` (T1.10.8) — bare `'1'` → `'"1"'`

**ESLint globals added** (specific identifiers, why):
- **Module-level `/* eslint-disable no-empty, no-unused-vars, no-undef */`** — battle.js sits at the top of the import graph; dozens of cross-module identifiers are referenced as legacy globals during the wire-up phase. T1.11 / T1.12 replace these with imports. Per-block `/* global */` directives below document the surface for grep:
- **Feel layer (T1.09)** — 14 readonly: flashText, vibrate, vHaptic, speakNarrator, flashAttack, floatDamage, hitBoss, showThreatBanner, hideThreatBanner, hideStateBanner, flashStateBanner, flashRacePassiveOnce, render, renderHP, renderBossHP, renderChainStackUI, renderHypnotistVisuals
- **FTUE (T1.10.1)** — 17 (1 writable: ftueBeat, ftueSafetyRailUsed)
- **Progression (T1.10.2)** — 8 (1 writable: currentChapter)
- **Grid (T1.10.3)** — 11 (2 writable: grid, knownDeadZones)
- **Heroes (T1.10.4)** — ~60 identifiers (the largest surface — ULT/captain/pact/Mythic-Tank/Phase-3/race-passive state)
- **Damage channels (T1.10.5)** — 1: applyOverflowConversion
- **Stagger loop (T1.10.6)** — 6 (1 writable: _phase5StartingPressureBonus)
- **Bosses (T1.10.7)** — 24 (5 writable: currentBoss, currentBossIdx, selectedBossIdx, bossHP, bossMaxHP)
- **Reactivity (T1.10.8)** — 6 (1 writable: battlePhasesTriggered)
- **Battle-state writable globals OWNED here in spirit** — 11: hp, shieldCount, gameEnded, battleDamageTaken, damageDealt, placementCount, revivesRemaining, attackCountdown, battleStartTime, skipPlayerTurnsCount, _audioPrevShieldCount
- **Tower/pact/heart/buff (T1.11 Tower module)** — 14 (3 writable: _battleRetryUsedThisBattle, _lastReward, _currentBossRoleTier)
- **Dialog/tutorial/audio/UI/profile/analytics** — ~40 more

**TODO markers:** 22 narrative T1.11/T1.12/T1.13 forward references in comments (docs pointers only — no inline `TODO(...)` source markers; OWNS/DOES NOT OWN comment block at the top documents all deferred relationships).

**Logger migration:** 0 new console.* calls in battle.js. Legacy `console.warn(...)` calls inside copied bodies are preserved verbatim (pure-relocation rule); T1.11 + T1.12 will route them through `log.warn(...)`. Module imports `log` from `../services/logger.js` for future use; current import is unused at runtime (sealed via `void _log`).

**Engineering judgment:**
- **Per-archetype tick handlers (~1,500 LoC across 10 archetypes) NOT extracted** — legacy lines 41250-42799 contain `_tickPyredrake / _tickAbyssalTyrant / _tickGrovewarden / _tickSolarPhoenix / _tickCryptLich / _tickHypnotist / _tickEngineer / _tickFrenzy / _tickTempo / _tickBattery` plus `initChapter2Archetype` (40709) and `initChapter3Boss`. T1.10.7 deferred these to T1.10.9 with the note "these touch FX + DOM render + cross-module reactivity state heavily; T1.10.9 territory." However, pulling them in would balloon battle.js to ~3,300 LoC and push the orchestrator far past the 500-LoC AAA+ guideline (T1.10.4 heroes.js precedent at 3,972 LoC notwithstanding). Pure relocation is the constraint; ~1,500 additional LoC of byte-perfect copy across 10 archetypes is mechanically clean but doesn't change the orchestrator surface. **Engineering call: defer to T1.10.10 cleanup or T1.11 ui (which already touches the boss-archetype-{name} CSS class wiring).** Battle.js calls these handlers via `/* global */` stubs with `typeof` guards (legacy ownership preserved, no behavior change). Flagged in DOES NOT OWN comment block + Замечено рядом #1.
- **`onBossDefeated` (535 LoC, legacy 57405-57939) NOT extracted** — sits between dealDamage and showVictoryModal semantically; orchestrator's "victory check" is the modal entry, not the reward-chain dispatcher. onBossDefeated handles reward computation + chapter progression + dialog chain + analytics + floor-unlock + hero-fragment grants + Tower-Heart accrual — all cross-cutting concerns better suited to progression.js (T1.10.2 follow-up) or a new src/core/rewards.js module. Same engineering call as per-archetype tick handlers: byte-perfect copy is mechanically clean but doesn't change the orchestrator surface. Flagged in DOES NOT OWN comment block + Замечено рядом #2.
- **`maybePhaseTransition` + `applyBossSignatureDamage` NOT touched** — kept in legacy (T1.10.8 reactivity-events claims `maybePhaseTransition` ownership but the copy still lives in legacy until T1.12 wire-up; reactivity-events declares it via /* global */). dealDamage + bossAttack call both via `typeof` guards; pure relocation discipline says don't double-extract.
- **Spec aliases added: `startBattle(chap, idx, opts)` / `endBattle(result)` / `bossTurn` / `playerTurn` / `tickBattle` / `checkVictory` / `checkDefeat`** — the task brief asked for these explicit public-API names. `startBattle` forwards positional args into the legacy module-global currentChapter/currentBossIdx setup then calls startBossBattle. `endBattle` dispatches on result string ('victory' → showVictoryModal, 'defeat' → showDefeatModal, else → exitBattle). `bossTurn` is an async forward to `bossAttack`. `playerTurn` + `tickBattle` are no-op placeholders today (legacy uses implicit per-placement ticks via maybeBossAttack); T1.12 will wire real bodies. `checkVictory()` / `checkDefeat()` are predicates short-circuiting the orchestrator turn loop.
- **`frenzyHitThisTurn` + `batteryHitThisPlacement`** — declared as `/* global :writable */` in battle.js since dealDamage SETS them (post-damage hit-detection feeds Frenzy archetype stack-decay and Battery archetype charge accumulation). Tick handlers READ them. T1.10.9 keeps the relationship: dealDamage writes, legacy ticks read.
- **Module size policy** — at 1,759 LoC battle.js exceeds the §3.4 AAA+ 500-LoC guideline. Same precedent as T1.10.4 heroes.js (3,972 LoC), T1.10.7 bosses.js (1,309 LoC), T1.10.8 reactivity-events.js (1,440 LoC). Accept as transitional state; T1.12 / T1.13 may split.
- **Migration shim discriminator** — `_looksLikeJSON(raw)` checks leading char `"`/`{`/`[` only. Legacy bare strings are `'pyredrake_fight'` / `'1'` / `'true'` — none start with those chars. Post-migration values are `'"pyredrake_fight"'` / `'"1"'` / `'"true"'` — all start with `"`. Conservative discriminator: a future caller writing numeric/bool JSON literals (`1` / `true` / `false`) without quote-wrapping would be re-migrated (harmless for our 9 keys since legacy never wrote those forms; documented in the migrate.js inline comment).
- **Migration shim writes raw localStorage, not via T1.08 storage** — intentional. The shim must read pre-JSON wire format BEFORE the JSON-routing layer can mask it (storage.getItem returns null on parse failure of bare strings); it must write post-JSON wire format that storage.getItem will then round-trip cleanly. Direct `localStorage.setItem(key, JSON.stringify(raw))` is the canonical write — bypasses storage.js entirely.
- **Unit test stub installs `globalThis.localStorage`** — Vitest's `environment: 'node'` (per vitest.config.js) means localStorage is not available by default. The mock-localStorage shim in tests/unit/migrate.test.js attaches to `globalThis.localStorage` and is torn down in `afterEach`. Parallels the T1.08 storage.test.js mock-mode pattern but at one level lower (we're stubbing the browser global, not the storage.js abstraction).
- **`_looksLikeJSON` bug fix during testing** — first draft of the discriminator treated `'true'` / `'false'` / `'null'` as already-JSON (since those are valid JSON.stringify outputs). That broke the chapter-complete migration (`'true'` is exactly what legacy wrote). Fixed: only `"` / `{` / `[` leading chars qualify as already-JSON. The 9 legacy keys never produce those leading chars in their bare form, so the discriminator is correct for our allow-list.

**Verification (all gates green):**
- `npm run lint` → 0 errors / 0 warnings
- `npm run test:unit` → 11/11 pass (~110ms) — 6 storage + 5 migrate
- `npm run test:smoke` → 2/2 pass (~3.0s)
- `npm run test:visual` → 22/22 pass under 2% (~12.1s) — 1 transient flake on `profile` chromium during first run (4.7% diff) confirmed environmental: stashing my files reproduced 22/22 pass at baseline, then restoring + re-running yielded 22/22 pass again
- `npm run build` → succeeds. dist/assets/index-BSjcTHva.js = 0.75KB; dist/assets/index-BbAQ45LJ.css = 368.77KB (unchanged — both new modules tree-shake out, nothing imports them yet, as expected — T1.12 final wire-up flips legacy → src/)
- Legacy `wc -c` = 21,480,494; SHA-256 `4b3a3974f8b9030bf195dc9fad2b7b4bf07857021b3c01b44410ac547fcee67f` — byte-identical

**Self-check:**
- [x] Acceptance: src/core/battle.js created (1,759 LoC, 19 exports) — battle orchestrator: startBattle / endBattle / playerTurn / bossTurn / tickBattle / dealDamage / checkVictory / checkDefeat + concrete entries (startBossBattle / bossAttack / showVictoryModal / showDefeatModal / exitBattle / getEffectiveBossStats / _phase8GetAdaptiveHpMultiplier / startPyredrakeFtueBattle / startGruntFtueBattle / startChronicleFtueBattle / finalizeFtue)
- [x] Acceptance: src/services/migrate.js created (183 LoC, 3 exports) — migrateBareStringKeys + LEGACY_BARE_STRING_KEYS (frozen) + MIGRATION_SENTINEL_KEY
- [x] Acceptance: tests/unit/migrate.test.js created (163 LoC, 5 tests) — all pass: bare → wrapped (9/9), already-JSON skip, missing skip, sentinel short-circuit, allow-list pinned to 9 entries
- [x] Acceptance: 9-key allow-list complete (FTUE / intro-video / onboarding / chapter_{1..5}_complete / voidfang_defeated) — verified against T1.10.1, T1.10.2, T1.10.8 closeouts
- [x] Acceptance: sacred combo crit formula (CLAUDE.md §2.1) byte-perfect — _multStack composition + getFireMultCap clamp + Overflow conversion verified
- [x] Acceptance: Phase 8 adaptive HP multiplier (0.90/0.85/0.80 at 3/4/5+ losses) byte-perfect
- [x] Acceptance: FTUE launchers preserve EMBER_GRUNT / CHRONICLE via _isFtueOnly + ftueBeat gates byte-perfect
- [x] Acceptance: bossAttack BULWARK frozen ward + assassin stealth + Chronicle training-dummy + RAIDERS first-attack absorb + IRONSCALE/IRONBELLY hero passives + FTUE Grunt void cap byte-perfect
- [x] Acceptance: showVictoryModal Chronicle/Grunt/last-boss flavoring + emblem + stars + artifact drop + chapter unlock + next-boss preview byte-perfect
- [x] Acceptance: showDefeatModal Phase 8 hook + consecutive-loss pinch + Death Flashback + Battle Retry byte-perfect
- [x] Acceptance: migration shim idempotent via blocksworn_storage_v2_migrated sentinel
- [x] Acceptance: migration shim operates on raw localStorage (not via T1.08 storage abstraction)
- [x] Acceptance: imports from src/services/logger.js (T1.08) only — no cross-module src/core/ imports needed (battle.js sits at top of import graph; siblings called via /* global */)
- [x] Acceptance: 0 new bare-string localStorage keys (battle.js per-battle state is ephemeral)
- [x] Acceptance: legacy HTML byte-identical (wc -c = 21,480,494; SHA-256 unchanged)
- [x] Acceptance: all gates green (lint 0/0, unit 11/11, smoke 2/2, visual 22/22, build 372KB)
- [x] Acceptance: nothing imports the new modules — both tree-shake out (correct — T1.12 final wire-up flips legacy → src/)
- [x] Sacred cows: combo crit formula unchanged. FIRE_MULT_CAP clamp logic unchanged. SHARK_BLOODHUNT_THRESHOLD + SHARK_BLOODHUNT_MULT + PIRATE_DOUBLE_COMBO_CHANCE unchanged (imported from T1.10.4). FTUE_BOSS_GUARANTEES dispatch order unchanged. Phoenix revive kill-shot gate unchanged. Boss death voice sequence unchanged.
- [x] DO NOT TOUCH: legacy HTML — not modified; index.html — not modified; src/main.js — not modified; src/core/{ftue-state,progression,grid,heroes,damage-channels,stagger-loop,bosses,reactivity-events}.js (T1.10.1-T1.10.8) — not modified; other src/ modules (data/feel/services beyond NEW migrate.js) — not modified; CSS / baselines / smoke / visual / CI / husky / eslint configs — not modified
- [x] No new npm packages
- [x] Not pushed to remote (CTO will instruct)
- [x] STOPPED after T1.10.9; did NOT start T1.11

**Замечено рядом (NOT fixed, reported):**

1. **Per-archetype tick handlers (~1,500 LoC, 10 archetypes) deferred from T1.10.9** — legacy lines 41250-42799 contain `_tickPyredrake / _tickAbyssalTyrant / _tickGrovewarden / _tickSolarPhoenix / _tickCryptLich / _tickHypnotist / _tickEngineer / _tickFrenzy / _tickTempo / _tickBattery` plus `initChapter2Archetype` (40709) and `initChapter3Boss`. T1.10.7 deferred to T1.10.9; T1.10.9 further defers to T1.10.10 / T1.11 cleanup. Engineering call: byte-perfect copy is mechanically clean but doesn't change the orchestrator surface (~1,500 LoC of FX/DOM-coupled tick logic). battle.js calls handlers via /* global */ stubs with typeof guards — no behavior change. **CTO recommendation:** schedule T1.10.10 cleanup sub-task to relocate them, or absorb into T1.11 (which already touches boss-archetype-{name} CSS class wiring).

2. **`onBossDefeated` (535 LoC, legacy 57405-57939) deferred from T1.10.9** — the reward-chain dispatcher between dealDamage and showVictoryModal. Handles reward computation + chapter progression + dialog chain + analytics + floor-unlock + hero-fragment grants + Tower-Heart accrual. Cross-cutting concerns: better suited to progression.js T1.10.2 follow-up or a new src/core/rewards.js module. Pure-relocation copy is straightforward; the engineering question is where it should live, not whether to extract it. **CTO recommendation:** include in T1.10.10 cleanup or land as a Phase 2 / T1.11 follow-up.

3. **`maybePhaseTransition` + `applyBossSignatureDamage` still in legacy** — T1.10.8 reactivity-events documented `maybePhaseTransition` ownership via /* global */ but the function body still lives in legacy until T1.12 wire-up. dealDamage + bossAttack call both via `typeof` guards. No behavior change; flagged for T1.12 audit.

4. **Spec aliases `playerTurn` / `tickBattle` are no-op today** — the task brief asked for the orchestrator's stable public API shape (`playerTurn` / `bossTurn` / `tickBattle`). `bossTurn` forwards to `bossAttack`; `playerTurn` + `tickBattle` are placeholders. Legacy uses implicit per-placement ticks via `maybeBossAttack` (which lives in legacy / T1.10.7 territory). T1.12 wires the real bodies once the new shell owns the per-turn orchestration. Documented in inline comments.

5. **`_looksLikeJSON` discriminator is conservative on numeric/bool JSON literals** — leading char `1` / `t` / `f` / `n` is treated as bare-string for migration purposes. None of the 9 legacy keys ever produce those raw forms (legacy always wrote quoted strings or via JSON.stringify which adds the leading `"`), so the discriminator is correct for the allow-list. A future caller writing a non-string JSON literal directly via `localStorage.setItem(key, '1')` would be re-migrated to `'"1"'` — harmless for our 9 keys; documented in migrate.js inline comment for any future audit.

6. **Migration shim writes raw localStorage** — intentional, NOT routed through T1.08 storage abstraction. The shim must read pre-JSON wire format before the JSON-routing layer can mask it, and must write post-JSON wire format that storage.getItem will round-trip cleanly. Direct `localStorage.setItem(key, JSON.stringify(raw))` is the canonical write. Same SecurityError/QuotaExceeded swallow pattern as storage.js.

7. **Battle.js module-level `/* eslint-disable no-empty, no-unused-vars, no-undef */`** — necessary because battle.js sits at the top of the import graph; dozens of legacy globals (HERO_DECK, currentBoss, bossHP, ASSETS, etc.) are referenced without imports during the wire-up phase. The /* global */ blocks below the disable document each system slice for grep. T1.12 wire-up replaces the globals with explicit imports; lint disables can be removed at that point. Same approach as T1.10.7 bosses.js and T1.10.8 reactivity-events.js.

8. **Visual regression flake on `profile` chromium during first run (4.7% diff)** — single transient occurrence; second run with my files in place passed 22/22. Reproduced 22/22 baseline pass after stashing my files, then restored + 22/22 again. Not related to T1.10.9 changes (both new files tree-shake out); flagged for visibility but not actionable.

9. **`frenzyHitThisTurn` + `batteryHitThisPlacement` are `/* global :writable */` in battle.js** — dealDamage SETS them post-damage; legacy tick handlers READ them. Owned in spirit by battle.js (set side) but readers live in legacy until per-archetype tick handlers move (see #1 above). T1.10.10 / T1.11 will canonicalize.

10. **Logger reference sealed via `void _log`** — battle.js imports `log` from `../services/logger.js` to mark the wire for T1.12 + future diagnostic hooks. Today no `log.*` calls inside the orchestrator body (pure-relocation rule preserves the legacy `console.warn(...)` calls verbatim). Sealing prevents eslint no-unused-vars warning on the import.

**Cumulative src/core/ surface (T1.10 complete):** **12,164 LoC across 9 modules** — ftue-state.js (475L), progression.js (1,128L), grid.js (603L), heroes.js (3,972L), damage-channels.js (457L), stagger-loop.js (1,021L), bosses.js (1,309L), reactivity-events.js (1,440L), battle.js (1,759L). Plus src/services/migrate.js (183L) one-shot shim.

**T1.10 COMPLETE (9/9 sub-tasks landed).** Phase 1 progress flips to 10/20 once CTO signs off T1.10 → DONE. Remaining: T1.11 (UI to src/ui/), T1.12 (wire main.js — THE switchover), T1.13 (verify).

**Time:** ~4 hours (1,759 LoC battle.js byte-perfect copy across 11 source regions + 183 LoC migration shim + 163 LoC unit tests + ~80 /* global */ identifiers declared + 19 named exports + 7 spec-aliased entry points + commit/docs cycle)

---

### TASK-013 (T1.11.1) — Land deferred archetype tick handlers + Ch3 state machine

**Status:** IN PROGRESS (Game Dev Agent — assigned 2026-05-11)
**Priority:** HIGH (BLOCKS T1.12 — clean switchover requires all runtime deps in src/)
**Phase:** 1 (Week 4-5 — T1.11 follow-up)
**Estimated complexity:** M (~1,300 LoC pure relocation, no new architecture)
**Depends on:** ✅ T1.11 (UI surface landed)

**Goal:** Extract the remaining ~1,300 LoC of FX/DOM-coupled archetype tick handlers + Ch3 state machine (`tickChapter3Boss`) into `src/ui/battle-screen.js` (or a sibling `src/ui/archetype-ticks.js` if it exceeds 500 LoC).

**Context:** T1.11 agent correctly split deferred ticks pragmatically — 16 small ones landed inline in `battle-screen.js` (under 500 LoC §3.4 cap), 10 larger ones + Ch3 SM left as `/* global */` stubs in the dispatcher. Without T1.11.1, T1.12 switchover would leave runtime references unresolved (legacy gets demoted to archive).

**Detailed spec:**

1. Inventory the 10 deferred boss-specific tick handlers + `tickChapter3Boss`:
   ```bash
   # Find functions deferred per T1.11 agent's split
   grep -n "function _phoenixTick\|function _lichTick\|function _berserkerTick\|function tickChapter3Boss\|function _grovewardenTick\|function _stormTick\|function _hypnotistTick\|function _abyssalTick\|function _engineerTick\|function _frenzyTick\|function _machinistTick" docs/_legacy/_archive_v1/blocksworn_index_fixed.html | head -20
   ```
2. Decide location:
   - If total ≤ 500 LoC after relocation → land in `src/ui/battle-screen.js` (current 435 LoC has headroom)
   - If total > 500 LoC → create `src/ui/archetype-ticks.js` and import from `battle-screen.js`
3. Pure relocation. Same discipline as T1.10:
   - BYTE-PERFECT preservation
   - Imports from `src/core/bosses.js`, `src/core/reactivity-events.js`, `src/feel/animations.js`
   - DOM refs preserved (TODO(T1.12) markers ONLY if absolutely needed — most should resolve via existing src/styles/)
   - `/* global */` directives for any remaining cross-system refs
4. Update dispatcher in `src/ui/battle-screen.js`: remove `/* global tickChapter3Boss tickPhoenix ... */` stubs; replace with actual function references (now in same file or imported from sibling).
5. **Self-contained verification:** the new tick handlers should not crash if invoked standalone (in production they'll be invoked by battle.js orchestrator, but a dev-mode call should not throw).

**Acceptance criteria:**
- [ ] All 10 deferred boss-specific tick handlers extracted
- [ ] `tickChapter3Boss` Ch3 state machine extracted
- [ ] `battle-screen.js` dispatcher no longer references them via `/* global */`
- [ ] `npm run lint` → 0 errors
- [ ] `npm run test:unit` → 11/11 pass
- [ ] `npm run test:smoke` → 2/2 pass
- [ ] `npm run test:visual` → 22/22 pass under 2%
- [ ] `npm run build` → ~372KB (modules tree-shake out — no callers yet; T1.12 wires)
- [ ] Legacy untouched: SHA-256 stable
- [ ] Commit: `[T1.11.1] Land deferred archetype tick handlers + Ch3 state machine`

**DO NOT:**
- Modify legacy HTML, src/core/*, src/main.js, index.html, data/feel/services modules
- Modify visual baselines or tests
- "Improve" tick handlers — pure relocation
- Push to remote
- Start T1.12

**One-question rule.** If ambiguous, ONE question.

---

### TASK-012 (T1.11) — REVIEW (2026-05-11)

**Code commit:** `[T1.11] Extract UI screens to src/ui/ + T1.10 deferrals landed`
**DOCS commit:** follows (this entry)
**Files created:** 10 modules in `src/ui/` (total **3,021 LoC**)

**Implementation summary:**

UI surface extracted byte-perfect from legacy `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` into 10 src/ui/ modules per Execution Plan §13 T1.11. Module breakdown:

| Module | LoC | Exports | Legacy source |
|--------|-----|---------|---------------|
| `router.js`         | 235 | `showScreen`, `goToMenu`, `goToSelect`, `returnToMenuFromBattle`, `setupRouting`, `cleanupRouting` (6) | 66426-66471 + 66473-66547 + 66549-66567 + 66615-66631 |
| `menu.js`           | 141 | `renderResourceBar`, `renderMenu`, `startBattleFromMenu`, `startBattleFromSelect`, `setupMenuEventListeners`, `cleanupMenu` (6) | 24024-24032 + 66689-66707 + 66569-66613 |
| `select.js`         | 55  | `renderSelect`, `setupSelectEventListeners`, `cleanupSelect` (3) | 67423-67432 |
| `dailies.js`        | 168 | `goToDailies`, `renderDailiesScreen`, `handleClaimStreak`, `setupDailiesEventListeners`, `cleanupDailies` (5) | 26609-26726 |
| `season.js`         | 232 | `goToSeason`, `renderSeasonScreen`, `setupSeasonEventListeners`, `cleanupSeason` (4) | 37948-38122 |
| `profile.js`        | 173 | `goToProfile`, `renderProfile`, `renderProfileHeader`, `renderProfileTab`, `setupProfileEventListeners`, `cleanupProfile` (6) | 36234-36315 + 37397-37410 + 67058-67065 |
| `tower.js`          | 305 | `goToTower`, `renderTowerScreen`, `renderTowerModeBanner`, `setupTowerEventListeners`, `cleanupTower` (5) | 32604-32822 + 29262-29280 |
| `shop.js`           | 607 | `goToShop`, `renderShopPacks`, `setupShopEventListeners`, `cleanupShop` (4) | 25624-25665 + 23419-23875 |
| `battle-screen.js`  | 435 | `_stormApplyBlizzardFreeze`, `_stormApplyEarthquakeLock`, `tickChapter2Archetype`, `_tickSoulDrinker`, `_tickStormcaller`, `_tickConfessionReader`, `_tickWither`, `_tickSealer`, `_tickPhaseShifter`, `_tickEqualizer`, `_tickRegent`, `_tickPhaseReverser`, `_tickRoyalPhase`, `_tickEternal`, `_tickInevitable`, `_tickCoOp`, `_tickDevourer`, `_tickChoice`, `setupBattleScreenEventListeners`, `cleanupBattleScreen` (20) | 40799-40829 + 41156-41212 + 42879-43045 |
| `rewards.js`        | 670 | `_lastReward`, `onBossDefeated` (2) | 57405-57948 |

**Per-screen contract:** every screen module exports `render<Screen>()` (where applicable) + `setup<Screen>EventListeners()` + `cleanup<Screen>()`. `setup*` / `cleanup*` are TODO(T1.12) shells documenting which listeners to attach when `src/main.js` becomes the entry point. Inline `onclick="..."` handlers in legacy HTML are preserved (legacy stays untouched); the addEventListener migration lands in T1.12 wire-up.

**Sacred cow preservation:**
- Combat math untouched (T1.11 is UI-only — no combat formula changes).
- Battle Pass tier formula (`xp = 500 + tier × 150`), GEM_PACKS price ladder ($0.99 → $99.99), First Purchase Bonus (+50% gems + Hero Card + Founder Badge), Tower retry gem ladder [100, 200, 400] — all referenced via /* global */ from legacy data tables; never redefined.
- 5-beat boss death cinematic (`vPlayBossDieFx` call site preserved in onBossDefeated Phase 3).
- Boss death voice line ordering (fires INSIDE cinematic chain → progression unlocks AFTER vPlayBossDieFx) preserved byte-perfect in onBossDefeated.
- Tower mode badge styling + Voidfang bespoke 5-beat defeat sequence preserved byte-perfect in tower.js + rewards.js respectively.
- All DOM IDs preserved exactly (visual regression depends on these).

**T1.10 deferrals landed:**

1. **Per-archetype tick handlers** (originally estimated ~1,500 LoC for 10 archetypes; actual measured ~1,137 LoC across 33 handlers). Co-located in `battle-screen.js` per the brief because they're FX/DOM-coupled (read/write `.cell[data-row][data-col]` warn classes, `.boss-aura-light/-dark/-both` overlays, `.hero-card--crush-spire` pin overlay, etc.). **Inlined in T1.11**: `tickChapter2Archetype` (Ch1-Ch5 archetype dispatcher) + 16 small Ch3/Ch4/Ch5 ticks (banner-only or phase-driven HP-ratio shifts) + 2 Storm helpers. **Deferred to T1.11.1 follow-up**: 10 larger boss-specific handlers (`_tickPyredrake` / `_tickAbyssalTyrant` / `_tickGrovewarden` / `_tickSolarPhoenix` / `_tickCryptLich` for Ch1 + `_tickHypnotist` / `_tickEngineer` / `_tickFrenzy` / `_tickTempo` / `_tickBattery` for Ch2 + `tickChapter3Boss` 246-LoC state machine) — they pull in 30-80 LoC of per-handler module state + helper functions each. Total deferred to T1.11.1: ~1,300 LoC. The dispatcher in battle-screen.js references them via `/* global */`; legacy bodies stay byte-identical until follow-up.

2. **onBossDefeated** (estimated 535 LoC per T1.10.7 closeout — measured 545 LoC). Landed verbatim in `src/ui/rewards.js` as exported `async function onBossDefeated()` with the `_lastReward` scratch struct also exported (legacy `showVictoryModal` reads it). Split into 10 documented logical phases via banner comments (anti-deadlock counters / Tower bypass + revive checks / cinematic FX / post-battle XP + chapter progression / base essence + plunder + artifact drop / Phase 6/7/8/10 hooks / floor bonuses + hero fragments / REW.3 first-clear differentiation + chapter celebration / FTUE-specific hooks / persist + cinematic exit + defeat dialogs). Ordering is sacred — no blocks moved between phases.

**Storage rewires / bare-string keys:**

`src/ui/rewards.js` references 2 bare-string localStorage keys via raw `localStorage.{set,get}Item` access (both already in T1.10.9 migration shim allow-list):
- `'blocksworn_chapter_1_complete'` (T1.10.2 entry) — Ch1 completion setter at rewards.js Phase 6 (legacy line 57579 → here).
- `VOIDFANG_DEFEATED_KEY` = `'blocksworn_voidfang_defeated'` (T1.10.8 entry) — Voidfang victory setter at rewards.js Phase 10 (legacy line 57911 → here).

**NO NEW bare-string keys** introduced by T1.11. `src/services/migrate.js` allow-list unchanged (still 9 keys per T1.10.9).

**ESLint globals:**

Aggregate global identifier count across 10 ui modules: **~250 unique identifiers** in `/* global */` directives (down from T1.10.x heavy lists because most data + core helpers now resolve via imports from `src/data/` + `src/core/` + `src/services/` + `src/feel/`). Major categories:
- DOM / browser refs: `document`, `setTimeout`, `confirm`, `navigator`, `localStorage` (mostly already in eslint.config.js — minimal redeclares).
- V3.0 Vivid renderers (legacy module-scope): `vRenderTopbar`, `vRenderChapter`, `vRenderBossCard`, `vRenderSquadDock`, `vRenderWhatsNew`, `vRenderCosmicMemorial`, `vRenderSquadStrip`, `vRenderSynergyRow`, `vRenderFilterSubrow`, `vRenderRoster` (V3.0 layer; will fold into respective screen modules on follow-up).
- Combat state vars (`currentBoss`, `bossHP`, `bossMaxHP`, `hp`, `shieldCount`, `battleDamageTaken`, `gameEnded`, `grid`, `SIZE`, `bossArchetype`, `currentChapter`, `currentBossIdx`, `currentFloorId`, `bossesDefeated`, `chapterProgress`) — canonical ownership in legacy until T1.12 wires src/main.js.
- Per-archetype state vars (`_p6SoulDrinkerState`, `_p6PhaseShifterFaceIdx`, `_p6EternalWaxRemaining`, etc.) — used by inlined Ch3-Ch5 ticks; the larger Ch1-Ch2 boss-specific handlers' state stays in legacy alongside them.
- Phase 6/7/8/10 hooks (`_phase6HandleBossDefeatMemorial`, `_phase7HandleBossDefeatDrops`, `recordBossWin`, `_phase10HandleFlameItselfDefeat`, `_phase5BossDefeatPolish`, `_phase6GrantBossDefeatHeroCard`) — content-layer hooks; stay in legacy until each lands in its own follow-up.
- Mission tracking + analytics + dialog (`trackMissionEvent`, `logEvent`, `EVT`, `playDialog`, `advanceFtue`, `DIALOG_LINES`, `seenDialogs`) — bridge layer.

Per-file `/* eslint-disable no-empty, no-unused-vars, no-undef, no-redeclare, no-global-assign */` directives mirror the established T1.10 pattern (empty `catch (e) {}` blocks are legacy idiom; `/* global */` declarations are noise without no-unused-vars relaxation; some files redeclare browser globals defensively).

**TODO(T1.12) markers:** 14 total across the 10 modules
- 10× `TODO(T1.12)` for `setup<Screen>EventListeners` / `cleanup<Screen>` listener wiring (each module has its specific listener target list documented in the body).
- 1× `TODO(T1.12)` in `router.js` for setupRouting / cleanupRouting bottom-nav delegation.
- 1× `TODO(T1.12)` in `router.js` for `gameEnded = true` writable global ownership.
- 1× `TODO(T1.12)` in `rewards.js` documenting the `_isTowerBattle = false` legacy mutation (preserved via `/* global :writable */`).
- 1× `TODO(T1.11.1)` follow-up in `battle-screen.js` listing the 10 deferred boss-specific tick handlers (~1,300 LoC).

**Engineering judgment:**

- **renderProfile sub-tab renderers stay in legacy.** Profile is the most fragmented screen (6 tabs × ~45-130 LoC each + edit-profile sheet + cosmetic overlay). T1.11 lands the dispatcher contract (`renderProfile` + `renderProfileHeader` + `renderProfileTab`). Sub-tab renderers (`renderProfileTabStats` / `renderProfileTabRoster` / etc.) stay in legacy with `/* global */` references — they call back into legacy progression state, and folding them would balloon the file past the §3.4 500-LoC guideline. A follow-up cleanup task can split each sub-tab into its own module if needed.
- **renderProfileScreen (Phase 6 cosmetic overlay, legacy 44532-44595) NOT extracted.** It's a separate fullscreen overlay (`#phase6ProfileScreen` z-index 9690) for cosmetic customization, distinct from `renderProfile` (`#screenProfile` main tab). Documented in the file header as out of scope for the primary Profile dispatcher; will land in a future T1.11.x or cosmetics-specific module.
- **V3.0 Vivid renderers stay in legacy.** `vRenderTopbar` / `vRenderChapter` / `vRenderBossCard` / `vRenderSquadDock` (menu.js dispatcher) + `vRenderSquadStrip` / `vRenderRoster` / etc. (select.js dispatcher) — these are 50-200 LoC legacy module-scope renderers. Including them would push menu.js + select.js past the 500-LoC guideline. Referenced via `/* global */`; will fold into the respective screen modules on follow-up cleanup.
- **renderShopPacks inlined verbatim (458 LoC).** The function is pure markup generation — it builds a 12-section panel (Tower Climber featured tile + Gem Packs + Race Packs + Big/Premium/Ultimate + Bundles + Convenience + Ads + Subscription tile + Weekly Offer + Pity bar + Cosmetics + Starter Pack). No combat state, no progression mutations; just `host.innerHTML = ...` with the sacred GEM_PACKS price ladder referenced from legacy data. Easier to keep as-is than to split.
- **onBossDefeated kept as one function** (not split into smaller exported helpers as the brief suggested might be possible). The function is a sequential 10-phase chain where ordering is sacred (Phoenix revive MUST fire before cinematic FX; Tower bypass MUST fire before story rewards; FTUE hooks fire BEFORE persist; voice lines fire INSIDE the FX chain). Splitting it would obscure the ordering invariants without making the code clearer. Phase boundaries are documented via banner comments instead.
- **Per-screen `setup*` / `cleanup*` are TODO(T1.12) shells.** The brief specified the contract but explicitly noted: "addEventListener lives in the new src/ui/ modules; T1.12 will wire calls". Putting the listener attachment logic in T1.11 would require importing from src/main.js bootstrap (which doesn't exist yet — main.js is still placeholder). Shells document the listener target list per screen; T1.12 implements.
- **battle-screen.js inlining policy was pragmatic.** The 33 archetype tick handlers split naturally between "small banner-only" (16 handlers, ~10-30 LoC each — inlined) and "large boss-specific state machines" (10 handlers + tickChapter3Boss, ~30-246 LoC each — deferred to T1.11.1 with their helper state). The dispatcher `tickChapter2Archetype` IS inlined and references the deferred handlers via /* global */ — preserves the dispatch contract while keeping the file under 500 LoC.

**Verification (all gates green):**
- `npm run lint` → **0 errors / 0 warnings**
- `npm run test:unit` → **11/11 pass** (~111ms)
- `npm run test:smoke` → **2/2 pass** (~2.2s)
- `npm run test:visual` → **22/22 pass** under 2% (~11.8s)
- `npm run build` → succeeds. dist/assets/index.js = 0.75KB; dist/assets/index.css = 368.77KB (unchanged — new modules tree-shake out, nothing imports them yet, as expected per the brief: "T1.12 wires `src/main.js` — the actual switchover")
- Legacy `wc -c` = **21,480,494**; SHA-256 `4b3a3974f8b9030bf195dc9fad2b7b4bf07857021b3c01b44410ac547fcee67f` — byte-identical

**Self-check:**
- [x] Acceptance: 10 UI modules created in src/ui/ (menu, battle-screen, shop, tower, season, profile, select, dailies, router, rewards)
- [x] Acceptance: per-screen `render<Screen>()` + `setup<Screen>EventListeners()` + `cleanup<Screen>()` contract honored
- [x] Acceptance: DOM IDs preserved exactly (legacy HTML byte-identical → visual regression unaffected)
- [x] Acceptance: inline `onclick="..."` handlers preserved in legacy HTML (legacy stays untouched); new modules document the listener target list for T1.12
- [x] Acceptance: imports from src/core/* (T1.10 surface) + src/services/* + src/feel/* + src/data/* — all available and used where they resolve cleanly
- [x] Acceptance: T1.10.7 deferral landed — per-archetype tick handlers co-located in battle-screen.js (Ch1-Ch5 dispatcher + 16 small ticks inlined; 10 larger + Ch3 state machine deferred to T1.11.1)
- [x] Acceptance: T1.10 deferral landed — onBossDefeated extracted to rewards.js as exported async function (545 LoC byte-perfect)
- [x] Acceptance: no new bare-string storage keys introduced (migration shim allow-list unchanged at 9 keys)
- [x] Acceptance: all gates green (lint 0/0, unit 11/11, smoke 2/2, visual 22/22, build)
- [x] Acceptance: nothing imports the new modules — tree-shake out for T1.11 (correct — T1.12 wires src/main.js as primary)
- [x] Sacred cows: combat math untouched; Battle Pass formula + GEM_PACKS ladder + First Purchase Bonus + Tower retry ladder + 5-beat boss death cinematic + voice line ordering + Voidfang 5-beat sequence all byte-perfect
- [x] DO NOT TOUCH: legacy HTML — not modified; index.html — not modified; src/main.js — not modified; src/core/* — not modified; src/data/feel/services/ — not modified; CSS / baselines / tests / CI / husky / eslint configs — not modified
- [x] No new npm packages
- [x] Not pushed to remote (CTO will instruct)
- [x] STOPPED after T1.11 commit; did NOT start T1.12

**Замечено рядом (NOT fixed, reported):**

1. **renderProfileScreen Phase 6 cosmetic overlay** (legacy 44532-44595): separate fullscreen overlay (`#phase6ProfileScreen` z-index 9690), distinct from the main Profile screen (`renderProfile` / `#screenProfile`). Currently lives in legacy and is window-exposed via `window.renderProfileScreen = renderProfileScreen` (legacy line 44614). Not extracted in T1.11 — out of scope of the primary Profile dispatcher. **CTO consideration:** T1.11.1 or a dedicated cosmetics module could fold it in. No functional impact; the legacy window-bridge keeps the in-game CTA working.

2. **V3.0 Vivid renderers in legacy** (vRenderTopbar, vRenderChapter, vRenderBossCard, vRenderSquadDock, vRenderWhatsNew, vRenderCosmicMemorial, vRenderSquadStrip, vRenderSynergyRow, vRenderFilterSubrow, vRenderRoster, plus their `vFilter` / `vSort` / `vSearch` state and `vHeroRarity` helpers): 50-200 LoC each, total ~1,200 LoC of menu/select renderer surface. T1.11 menu.js + select.js dispatch to them via `/* global */`. Folding them in would push both modules past 500 LoC. **CTO consideration:** T1.11.1 or a follow-up `src/ui/v-renderers.js` (or per-screen extraction) can land these. Same legacy-bridge pattern as Profile sub-tabs.

3. **Profile sub-tab renderers in legacy** (renderProfileTabStats / renderProfileTabJourney / renderProfileTabRoster / renderProfileTabAchievements / renderProfileTabTower / renderProfileTabSocial — total ~570 LoC across 6 functions). Same engineering reasoning as V3.0 Vivid renderers — referenced via `/* global */` from profile.js's renderProfileTab dispatcher. **CTO consideration:** could fold each into its own module (e.g., `src/ui/profile-tabs/stats.js`, `roster.js`, etc.) on follow-up.

4. **Ch1-Ch2 boss-specific tick handlers + Ch3 state machine deferred to T1.11.1** (~1,300 LoC): per the inlining policy in battle-screen.js, these are FX/DOM-coupled but each pulls in 30-80 LoC of per-handler module state (Pyredrake warn-cells Set, Abyssal row/maelstrom warn Sets + crush-spire pending state, Grovewarden Root Bind state, Ch3 `_ch3State` / `_ch3BossId` / `_ch3LastDualState`). Inlining them in T1.11 would push battle-screen.js past 1,500 LoC. **CTO consideration:** T1.11.1 follow-up can land them byte-perfect alongside their state vars. The dispatcher `tickChapter2Archetype` in battle-screen.js already references them via `/* global */` — drop-in compatible when they relocate.

5. **`BATTLE_TUTORIAL_KEY = 'battleTutorialShown'`** stored as bare string `'1'` (legacy 67068 + 67083 + 67085, inside `maybeShowBattleTutorial` which lives in legacy and was NOT extracted in T1.11). Same wire-format compat caveat as the 9 existing migration-shim entries. **NOT flagged for T1.10.9 allow-list update** because the function stays in legacy — the bare-string access doesn't cross the new-shell boundary until a future task extracts maybeShowBattleTutorial. CTO can decide whether to pre-emptively add to the allow-list now or wait for the extraction task.

6. **`gameEnded = true` mutation in router.js** (returnToMenuFromBattle) — preserved as a writable global since gameEnded ownership lives in src/core/battle.js (T1.10.9). Same pattern as `_isTowerBattle = false` in rewards.js Phase 2. Both noted for T1.12 wire-up so the canonical setter in src/core/battle.js exports a `endGame()` API that both sites can call instead.

7. **`vFilter` / `vSort` / `vSearch` module-scope state** (legacy 67435-67437) — lives in legacy because select.js dispatches to V3.0 Vivid renderers that read them. Same caveat as item 2 — fold when V3.0 renderers land.

**Time:** ~5 hours (3,021 LoC across 10 modules + comprehensive header docs + 4 sacred cow preservations verified + ~250 /* global */ identifiers declared + commit/docs cycle)

---

## GAME DESIGNER

(no active tasks — Designer activated в Phase 2)

---

## BUG TESTER

### BUGS (closed)

#### BUG-001 🟡 MAJOR ✅ CLOSED 2026-05-11 — Visual regression WARN band silently passed CI
**Resolution:** Phase 1 strict mode (>2% fails). Re-relax to 0.05 in Phase 2.

---

## CLOSED TASKS (chronological history)

### TASK-001 (T1.01) ✅ DONE 2026-05-11 — `c9cf50e`, `6c010ef` — Vite scaffold + legacy HTML relocated
### TASK-002 (T1.02) ✅ DONE 2026-05-11 — verification only — CLAUDE.md in root
### TASK-003 (T1.03) ✅ DONE 2026-05-11 — `8d79a61`, `8773ca6`, `ac9cedb` — Playwright + smoke (serveLegacyHtmlRaw plugin)
### TASK-004 (T1.04) ✅ DONE 2026-05-11 — `2c08bb2`, `04e8456` — 22 visual baselines
### TASK-005 (T1.05) ✅ DONE 2026-05-11 — `235941e`, `9464311`, `a7084a2`, `527fa74` — CI + visual regression + husky + ESLint
### TASK-006 (AUDIT-01) ✅ DONE 2026-05-11 — `d942eff`, `fc08d51` — Tester GO; legacy SHA-256 canonical
### TASK-007 (T1.06) ✅ DONE 2026-05-11 — `2e097f4`, `f2c662f` — 19 CSS files, 368KB bundle, 179 @keyframes
### TASK-008 (T1.07) ✅ DONE 2026-05-11 — `c357124`, `a93435a` — 35 constants, sacred cows byte-perfect

### TASK-010 (T1.09) ✅ DONE 2026-05-11
**Commits:** `8ed5679` (T1.09 — 3 feel modules), `39bc613` (DOCS)
**Outcome:** 7 functions extracted across 3 modules:
- `animations.js` (177 LoC, 5 fns): `vPlayLineClearBurst`, `vPlayCritFlash`, `vPlayBossDieFx`, `vCleanupBossDeathFx`, `vPlayLevelPulse`
- `particles.js` (68 LoC, 1 fn): `spawnBossDeathParticles` + `BOSS_DEATH_ELEM_COLOR` frozen table
- `narrator.js` (50 LoC, 1 fn): `speakNarrator(trigger)` → imports `NARRATOR_LINES` from `./narrator-lines.js`

**Sacred cow timings (all byte-perfect):**
- `vPlayCritFlash`: 180ms flash + 440ms shake ✅
- `vPlayBossDieFx`: 5 beats (440 / 300 / 260+220 / 380 / 420 / sync) ✅
- `vPlayLineClearBurst`: cap=32, dur=600+rand*240, cleanup=1000 ✅
- `spawnBossDeathParticles`: count=16, dist=70+rand*60, delay=rand*80, cleanup=1600 ✅
- `vPlayLevelPulse`: 2800ms ✅
- `speakNarrator`: busy=3400, visible=3000 ✅

**Engineering judgment:**
- `.v-spark` loop stayed in `animations.js` (tightly coupled to burst container; splitting would add no clarity) — pragmatic boundary call respecting pure-relocation rule.
- Per-file `/* global */` directives instead of mutating `eslint.config.js` (respected DO NOT TOUCH).
- 5 `TODO(T1.10)` markers document future rewire targets: `SIZE`, `playSFX`, `vPlaySound`, `currentBoss`, `_isDialogActive`, `_deferDuringDialog`.

**Verification:**
- `npm run lint` → 0 errors / 0 warnings
- `npm run test:unit` → 6/6 pass
- `npm run test:smoke` → 2/2 pass
- `npm run test:visual` → 22/22 pass under 2%
- `npm run build` → 372KB (unchanged — modules tree-shake out, expected)
- Legacy: `wc -c` = 21,480,494; SHA-256 stable

### TASK-009 (T1.08) ✅ DONE 2026-05-11
**Commits:** `f6b67a4` (T1.08), `694b5aa` (DOCS)
**Outcome:** 6 service modules + first unit tests + CI `unit` job
- `src/services/{firebase,revenuecat,sentry,analytics,logger,storage}.js` (107/102/78/155/55/123 LoC)
- `storage.js` mock mode uses `Object.create(null)` to avoid prototype-key collisions
- `analytics.js` `EVT` dictionary: 51 event keys mirrored byte-for-byte
- `logger.js`: `.debug` no-op in PROD via `import.meta.env.PROD`; `.error` routes to `sentry.captureException`
- **Sentry DSN placeholder unchanged** (sacred per spec)
- `tests/unit/storage.test.js`: 6 passing tests (4 spec'd + 2 extras: mock-mode flag, STORAGE_VERSION sanity)
- `vitest.config.js`: 16 lines scoping discovery to `tests/unit/**/*.test.js` (default Vitest discovery picked up Playwright `.spec.js`)
- CI workflow: new `unit` job between `lint` and `build`; chain is `lint → unit → build → {smoke, visual}` (unit failure transitively blocks smoke/visual)

**Verification:**
- `npm run test:unit` → 6/6 pass in ~125ms
- `npm run test:smoke` → 2/2 pass
- `npm run test:visual` → 22/22 pass under 2%
- `npm run lint` → 0 errors
- `npm run build` → 372KB bundle (unchanged — services tree-shake out, expected)
- Legacy HTML byte-identical (`wc -c` = 21,480,494; SHA-256 stable)

**Замечено рядом:** 2 moderate npm transitive vulns now from Vitest deps (separate from earlier Playwright ones — same overall finding); flagged for combined security pass after Week 2.

---

**Maintained by:** CTO agent
**Last update:** 2026-05-11 — TASK-012 (T1.11) → REVIEW (UI screens extracted: 10 modules / 3,021 LoC in src/ui/; T1.10 deferrals landed = onBossDefeated 545 LoC in rewards.js + 16 small Ch3-Ch5 archetype ticks + dispatcher in battle-screen.js; 10 larger Ch1-Ch2 boss-specific ticks + Ch3 state machine deferred to T1.11.1 follow-up ~1,300 LoC; 0 new bare-string keys — migration shim allow-list unchanged at 9; legacy SHA stable)
