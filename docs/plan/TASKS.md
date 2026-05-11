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
- [x] T1.10.2 — `progression.js` — **REVIEW** (commit `981c136`; 79 exports / 1128 LoC; sacred TIER_COSTS imported from T1.07; one-Mythic-per-save constraint preserved byte-perfect)
- [ ] T1.10.3 — `grid.js`
- [ ] T1.10.4 — `heroes.js`
- [ ] T1.10.5 — `damage-channels.js` (v2.1 P1)
- [ ] T1.10.6 — `stagger-loop.js` (v2.1 P2)
- [ ] T1.10.7 — `bosses.js`
- [ ] T1.10.8 — `reactivity-events.js` (v2.1 P4)
- [ ] T1.10.9 — `battle.js` + final wire (`index.html` → uses `src/main.js`; legacy demoted to read-only archive)

**Discipline:** ONE SUB-SYSTEM AT A TIME. After each: smoke + visual must pass. Commit `[T1.10.N]`. STOP on first failure.

**⚠️ MANDATORY for T1.10.9 wire-up** (flagged by T1.10.1 Game Dev — HIGH priority):
Legacy stored `FTUE_STORAGE_KEY` as **bare string** (e.g., `'pyredrake_fight'`), but T1.08's `storage.getItem` JSON-parses and returns `defaultValue` on bare strings. **Without one-shot migration shim in T1.10.9, existing player saves will silently reset to `not_started`** when new shell takes over. Same caveat for `seenIntroVideo` + `onboardingSeen` (5 ad-hoc legacy localStorage calls left raw with TODO(T1.11) markers).

**Migration shim spec (for T1.10.9 prompt):** for each known legacy bare-string key (`FTUE_STORAGE_KEY`, `seenIntroVideo`, `onboardingSeen`, others discovered during T1.10.2-T1.10.8 extractions), run once on first boot post-wire-up:
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
**Last update:** 2026-05-11 — T1.09 → REVIEW (3 feel modules extracted, sacred timings byte-perfect)
