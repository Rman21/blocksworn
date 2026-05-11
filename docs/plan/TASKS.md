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

**Status:** IN PROGRESS — Roman GO'd 2026-05-11; sub-task T1.10.1 (FTUE state) launched first

**Sub-task progress:**
- [x] T1.10.1 — `ftue-state.js` — **DONE 2026-05-11** (commits `e12d27b`, `ec4e409`; 21 exports / 475 LoC; sacred FTUE_BEATS/TRANSITIONS preserved byte-perfect via import from T1.07)
- [x] T1.10.2 — `progression.js` — **DONE 2026-05-11** (commits `981c136`, `3005c69`; 79 exports / 1128 LoC; TIER_COSTS sacred + one-Mythic + T2/T3/Mythic bonuses byte-perfect; 5 chapter-complete bare-string keys flagged for T1.10.9 shim)
- [x] T1.10.3 — `grid.js` — **DONE 2026-05-11** (commits `73358d0`, `226fb7d`; 26 exports / 603 LoC; sacred combo-crit dominant-count + GRID_SATURATION + VOID_TICK 0.5%/cell byte-perfect; 0 new bare-string keys — grid is per-battle ephemeral; minor `placePiece` return-value polish flagged for T1.10.9 audit)
- [ ] T1.10.4 — `heroes.js` — IN PROGRESS (Game Dev Agent — assigned 2026-05-11)
- [ ] T1.10.5 — `damage-channels.js` (v2.1 P1)
- [ ] T1.10.6 — `stagger-loop.js` (v2.1 P2)
- [ ] T1.10.7 — `bosses.js`
- [ ] T1.10.8 — `reactivity-events.js` (v2.1 P4)
- [ ] T1.10.9 — `battle.js` + final wire (`index.html` → uses `src/main.js`; legacy demoted to read-only archive)

**Discipline:** ONE SUB-SYSTEM AT A TIME. After each: smoke + visual must pass. Commit `[T1.10.N]`. STOP on first failure.

**⚠️ MANDATORY for T1.10.9 wire-up** (flagged by T1.10.1 Game Dev — HIGH priority):
Legacy stored `FTUE_STORAGE_KEY` as **bare string** (e.g., `'pyredrake_fight'`), but T1.08's `storage.getItem` JSON-parses and returns `defaultValue` on bare strings. **Without one-shot migration shim in T1.10.9, existing player saves will silently reset to `not_started`** when new shell takes over. Same caveat for `seenIntroVideo` + `onboardingSeen` (5 ad-hoc legacy localStorage calls left raw with TODO(T1.11) markers).

**Migration shim spec (for T1.10.9 prompt):** for each known legacy bare-string key, run once on first boot post-wire-up.

**Known bare-string keys (allow-list — grows during T1.10.3-T1.10.8 extractions):**
- `FTUE_STORAGE_KEY` (T1.10.1) — stored as `'pyredrake_fight'` etc.
- `seenIntroVideo` (T1.10.1, 3 sites)
- `onboardingSeen` (T1.10.1, 2 sites)
- `blocksworn_chapter_1_complete` … `blocksworn_chapter_5_complete` (T1.10.2 — 5 keys) — stored as literal `'true'`, read with `=== 'true'`. JSON-routing breaks chapter-complete semantics.

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
**Last update:** 2026-05-11 — T1.10.3 → REVIEW (grid module extracted, 26 exports, GRID_SATURATION + dominant-count surface byte-perfect, 0 new bare-string keys)
