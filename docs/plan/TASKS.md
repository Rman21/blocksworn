# Active Tasks

> Source of truth for current work. Updated real-time by CTO.
> Detailed spec для каждой task → `docs/plan/00_EXECUTION_PLAN.md` §13-16.

---

## GAME DEVELOPER

### TASK-008 (T1.07) — Extract data constants into `src/data/`

**Status:** TODO (READY — TASK-007 DONE; assignment ready for Game Dev Agent)
**Priority:** HIGH
**Phase:** 1 (Week 2-3, second code migration task)
**Estimated complexity:** L (large by surface area — many constants; low risk per constant since pure relocation)
**Depends on:** ✅ T1.06 (CSS extracted — proves migration pattern works)

**Files affected:**
- `src/data/balance.js` (new — BALANCE, TIER_COSTS, TIER_COSTS_V18 consolidated)
- `src/data/races.js` (new — RACES, RACE_SYNERGY, RACE_TO_STIHIYA)
- `src/data/elements.js` (new — STIHIYAS, STIHIYA_DESC, STIHIYA_COLORS)
- `src/data/chapters.js` (new — CHAPTERS structure)
- `src/data/bosses.js` (new — BOSSES per chapter, archetypes)
- `src/data/heroes.js` (new — HERO_ROSTER, HERO_TIER_ABILITIES, ROLE_DESC, HERO_ULT_COST_BY_NEWROLE)
- `src/data/ftue-scripts.js` (new — FTUE_BEATS, FTUE_SCRIPTS, FTUE_TRANSITIONS, FTUE_BOSS_GUARANTEES, FTUE_TUTORIAL_TEXTS)
- `src/data/tower.js` (new — TOWER_ROSTER_TIER_*, TOWER_PACTS, TOWER_LEADERBOARDS, TOWER_SEASONAL_REWARDS, BOSS_TTK_TARGETS)
- `src/data/monetization-config.js` (new — GEM_PACKS, RESOURCE_PACKS, HERO_CARD_PACKS, STARTER_PACK_*, TOWER_CLIMBER_PACK_*, SEASON_PASS_*)
- `src/feel/haptics.js` (new — V_HAPTICS + vHaptic function; sacred per CLAUDE.md §2.2)
- `src/feel/narrator-lines.js` (new — NARRATOR_LINES strings; sacred per CLAUDE.md §2.3)
- `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` — **DO NOT TOUCH** (sacred, byte-identical)

**Goal:** Extract all top-level data constants from legacy inline JS into named-export modules under `src/data/` (and `src/feel/` for the two sacred-cow tables). Game logic stays in legacy for now; this task ONLY moves constants. T1.10 will replace legacy's logic and have those modules `import` from `src/data/`.

**Context:** Per Execution Plan §13 T1.07 (around lines ~1327-1391). Data isolation is the second-easiest migration after CSS — pure constants, no execution-time risk. Setting up `src/data/` cleanly now means T1.10 (XL core logic) can `import` from it instead of inlining constants.

**Critical Sacred Cows in this task (CLAUDE.md §2):**
- **V_HAPTICS table** values — `{tap:10, place:15, clear:25, hit:30, crit:[30,20,30], levelup:[20,30,40], rareDrop:[40,40,40], victory:[100,50,100,50,200], defeat:[200]}` — copy EXACTLY, byte-perfect
- **NARRATOR_LINES** strings — Darkest Dungeon poetic voice = game identity. Copy EXACTLY.
- **Combo crit formula** values inside BALANCE constants — sacred
- **TIER_COSTS_V18** `{1:1, 2:2, 3:3, 4:5}` — sacred
- **HERO_ULT_COST_BY_NEWROLE** `warrior:80, mage:100, hunter:120, tank:80, captain:100` — sacred
- **GEM_PACKS** price ladder `$0.99 / $4.99 / $9.99 / $19.99 / $49.99 / $99.99` — sacred
- **Battle Pass tier formula** `xp = 500 + tier × 150` — sacred (find it in monetization config)

If you see any other constant that LOOKS like a sacred cow (combat formula coefficient, drop rate, timing) — **escalate or treat as sacred by default**. When in doubt, don't change values.

**Approach:**

1. **Inventory pass:** grep the legacy file for top-level `const X = ` declarations. Group them per the file-affected list above. Approximate count:
   ```bash
   grep -nE "^[[:space:]]*const [A-Z_]+ *=" docs/_legacy/_archive_v1/blocksworn_index_fixed.html | wc -l
   ```
2. **Create modules** with named exports + `Object.freeze()`:
   ```js
   // src/data/balance.js
   export const BALANCE = Object.freeze({ /* ... */ });
   export const TIER_COSTS = Object.freeze({ 1: 1, 2: 2, 3: 3, 4: 5 });
   ```
3. **Consolidate `TIER_COSTS` / `TIER_COSTS_V18`** — if both exist in legacy, pick the one used in production paths. Document choice in commit message. Per Execution Plan canon, `TIER_COSTS_V18` `{1:1, 2:2, 3:3, 4:5}` is the sacred one.
4. **Consolidate shop pack constants** if legacy has multiple PACK_* systems — but T1.18 is the dedicated consolidation task. **For T1.07: just relocate everything as-is.** Multiple consts = multiple exports. T1.18 will unify.
5. Game logic stays in legacy — **do not modify the legacy inline JS that uses these constants**. T1.10 makes new modules import from `src/data/`; T1.10 also rewires legacy or replaces it.
6. **Do NOT** edit `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` — single byte change fails the task.
7. Run smoke + visual after each file group to confirm no regression (the legacy render path is unchanged — both should stay green).

**Acceptance criteria:**
- [ ] All identified data constants extracted to `src/data/*.js` and `src/feel/{haptics,narrator-lines}.js`
- [ ] Each module exports as named exports
- [ ] All values `Object.freeze()`'d (immutable)
- [ ] `TIER_COSTS_V18` consolidated → exported as canonical `TIER_COSTS` (document the chosen variant in commit body)
- [ ] **V_HAPTICS values byte-identical to legacy** (sacred — verify by reading legacy + diffing)
- [ ] **NARRATOR_LINES strings byte-identical to legacy** (sacred)
- [ ] No data const duplicated across modules
- [ ] `npm run test:smoke` → 2/2 pass (legacy still works against itself; smoke doesn't touch src/data yet)
- [ ] `npm run test:visual` → 22/22 pass (same reasoning)
- [ ] `npm run build` → succeeds, bundle still small (new modules tree-shake if nothing imports them yet)
- [ ] `npm run lint` → 0 errors
- [ ] Legacy HTML: `wc -c` = 21,480,494; SHA-256 = `4b3a3974f8b9030bf195dc9fad2b7b4bf07857021b3c01b44410ac547fcee67f`
- [ ] Commit: `[T1.07] Extract data constants to src/data/`

**DO NOT TOUCH:**
- `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` (sacred byte-identical)
- `serveLegacyHtmlRaw` plugin
- CSS from T1.06 (`src/styles/`)
- Visual baselines, smoke tests, regression spec, CI workflow, husky, eslint config
- Game logic — DO NOT migrate functions (T1.09-T1.11 territory)
- Sacred cow VALUES (only relocate; never modify)
- `site/`

**Known unknowns / risks:**
- Some constants may be defined in non-top-level scope (inside IIFEs, closures). For T1.07, only extract top-level `const NAME = { ... }` declarations. If you find a constant that's only accessible inside a closure, flag in "Замечено рядом" — likely T1.10 work.
- `TIER_COSTS` vs `TIER_COSTS_V18` — if both exist, pick V_18 (sacred). If only one exists, use that.
- `NARRATOR_LINES` may be a large object literal with multi-line strings. Read carefully; don't truncate or rewrap.
- Currency / numeric values that look like "obvious typos" (e.g., 199 instead of 200) — leave alone. Pure relocation.

**Rollback plan:** `git revert <commit-sha>` — fully reversible; legacy untouched.

**Time-box:** 60-90 min (inventory 15-20, relocate 30-45, verify 15-20).

---

### TASK-009 (T1.08) — Extract services into `src/services/`

**Status:** TODO (blocked by TASK-008)
**Priority:** HIGH
**Phase:** 1 (Week 2-3)
**Goal:** Firebase, RevenueCat, Sentry, analytics, logger, storage abstractions → `src/services/*.js`.
**Detailed spec:** `docs/plan/00_EXECUTION_PLAN.md` §13 T1.08.
**Will be promoted after T1.07 reaches REVIEW.**

---

## GAME DESIGNER

(no active tasks — Designer activated в Phase 2)

---

## BUG TESTER

### BUGS (closed)

#### BUG-001 🟡 MAJOR ✅ CLOSED 2026-05-11 — Visual regression WARN band silently passed CI
**Resolution:** CTO config patch — `WARN_THRESHOLD` 0.05 → 0.02 (Phase 1 strict mode). Closes Tester's Option (a) from AUDIT-01. Verified 22/22 still pass under 2% post-tightening. `tests/visual/regression.spec.js` header documents Phase 2 plan to relax back to 0.05.

---

## CLOSED TASKS (chronological history)

### TASK-001 (T1.01) ✅ DONE 2026-05-11
**Commits:** `c9cf50e`, `6c010ef`
**Outcome:** Vite scaffold + legacy HTML relocated to `docs/_legacy/_archive_v1/` byte-identical (21,480,494)
**Previously blocked:** ESC-01 (Node missing) — resolved via Node v24.15.0 .pkg

### TASK-002 (T1.02) ✅ DONE 2026-05-11
**Verification only** — CLAUDE.md (799 lines) committed in Initial Setup `41da1eb`

### TASK-003 (T1.03) ✅ DONE 2026-05-11
**Commits:** `8d79a61`, `8773ca6`, `ac9cedb` (CTO admin)
**Outcome:** Playwright + smoke infrastructure; chromium + mobile-chrome green
**Engineering:** `serveLegacyHtmlRaw` Vite plugin (parse5 nested-comment workaround)

### TASK-004 (T1.04) ✅ DONE 2026-05-11
**Commits:** `2c08bb2`, `04e8456`
**Outcome:** 22 visual baselines (11 screens × chromium + mobile), 11M total
**Discoveries:** save-version-gate IIFE + COMBAT v2.1 P8 First Contact modal timing

### TASK-005 (T1.05) ✅ DONE 2026-05-11
**Commits:** `235941e`, `9464311`, `a7084a2` (T1.05.1 video freeze fix), `527fa74`
**Outcome:** CI workflow + visual regression + husky + ESLint flat config

### TASK-006 (AUDIT-01) ✅ DONE 2026-05-11
**Verdict:** GO for T1.06+
**Commits:** `d942eff`, `fc08d51`
**Engineering:** Legacy HTML SHA-256 = `4b3a3974f8b9030bf195dc9fad2b7b4bf07857021b3c01b44410ac547fcee67f` (canonical immutable ref)
**Bugs found:** BUG-001 (MAJOR, since CLOSED)

### TASK-007 (T1.06) ✅ DONE 2026-05-11
**Commits:** `2e097f4` (T1.06 — 542KB inline CSS → modular), `f2c662f` (DOCS)
**Outcome:** 19 CSS files (576KB on disk), 368KB bundle (66KB gzip), 179 @keyframes preserved, 39 @media rules, zero `--v-*` legacy tokens
**Verification:**
- `npm run test:smoke` → 2/2 pass
- `npm run test:visual` → 22/22 pass under 2% (legacy render path independent)
- `npm run build` → 372KB total dist, 36ms
- `npm run lint` → 0 errors
- Legacy HTML byte-identical (SHA-256 verified)
- Vite warns on 2 `url('assets/icons/coin.png|cristal.png')` references — pre-existing in legacy, files exist, runtime-resolved; flagged in Замечено рядом, NOT band-aided
- `typography.css` is 277-byte placeholder (no `@font-face` in legacy)
- 4 empty component stubs (card/badge/tooltip/progress-bar) dropped instead of shipped empty

---

**Maintained by:** CTO agent
**Last update:** 2026-05-11 — after T1.06 review; T1.07 ready
