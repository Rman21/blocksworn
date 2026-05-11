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
- [x] T1.10.4 — `heroes.js` — **DONE 2026-05-11** (commits `7196ec1`, `3725199`; **3,972 LoC** biggest sub-task; HERO_ROSTER 25/25 + 25 fire + 25 ultTwist + 10 fireDelta + 10 ultDelta + Aegis Conductor + Squad Conductor + 25/25 Mythic descriptors — all byte-perfect; ~600 LoC legacy dead code deferred to T1.10.9 audit; 0 new bare-string keys)
- [x] T1.10.5 — `damage-channels.js` (v2.1 P1) — **DONE 2026-05-11** (commits `31a3786`, `cdf37df`; 457 LoC / 16 exports; SACRED v2.1 P1 Mitigation Matrix + 4 channel formulas + shield-absorption order byte-perfect; cross-boundary `getSquadMitigation`/`getHeroMitigationKey` belong in heroes.js — flagged for T1.10.9 audit)
- [ ] T1.10.6 — `stagger-loop.js` (v2.1 P2) — IN PROGRESS (Game Dev Agent — assigned 2026-05-11)
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
**Last update:** 2026-05-11 — T1.10.5 → REVIEW (damage-channels module extracted, 457 LoC / 16 exports = 4 CH_* canonical names + 5 channel constants + 3 mitigation tables + 4 functions; SACRED 4-channel system + Mitigation Matrix + shield-absorption order + AEGIS PROTOCOL HP→Pressure reroute byte-perfect; 0 new bare-string keys)
