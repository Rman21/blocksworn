# Active Tasks

> Source of truth for current work. Updated real-time by CTO.
> Detailed spec для каждой task → `docs/plan/00_EXECUTION_PLAN.md` §13-16.

---

## GAME DEVELOPER

### TASK-009 (T1.08) — Extract services into `src/services/`

**Status:** REVIEW (awaiting CTO sign-off; submitted 2026-05-11 by Game Dev Agent)
**Priority:** HIGH
**Phase:** 1 (Week 2-3, third code migration task)
**Estimated complexity:** M
**Depends on:** ✅ T1.07 (data constants in place — services may need to import from data)

**Files affected:**
- `src/services/firebase.js` (new — Firebase auth, Firestore, RTDB init wrappers)
- `src/services/revenuecat.js` (new — IAP via RevenueCat / Purchases SDK)
- `src/services/sentry.js` (new — error tracking init)
- `src/services/analytics.js` (new — `logEvent()` wrapper consolidating Firebase + RevenueCat + Sentry events)
- `src/services/logger.js` (new — `log()/warn()/error()` wrappers; production no-ops `log.debug` but routes `error` to Sentry)
- `src/services/storage.js` (new — `localStorage` abstraction with versioning + mock mode for tests)
- `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` — **DO NOT TOUCH** (sacred byte-identical)
- `tests/unit/storage.test.js` (new — first unit tests in project; test get/set/remove/clear/migrate)
- `package.json` — add `vitest` to devDependencies + `test:unit` script (currently a stub)

**Goal:** Extract all external-service code from legacy inline JS into modular `src/services/`. Each service module exposes a clean public API. `storage.js` gets a mock mode for tests. First unit tests for `storage.js` introduced (T1.08 is the right place per Execution Plan §10 — unit tests on critical infrastructure).

**Context:** Per Execution Plan §13 T1.08 (around lines ~1394-1459). Services are external integrations — Firebase, RevenueCat, Sentry. Isolating them now means future tasks (T1.10 logic) can mock them in tests. Storage abstraction is the most important: getting the versioning + mock mode right unblocks T1.14 (artifacts migration) which needs storage migration helpers.

**Approach:**

1. **Inventory pass:** grep legacy for SDK initializations:
   ```bash
   grep -n "firebase.initializeApp\|Purchases.configure\|Sentry.init\|logEvent\b\|localStorage.getItem\|localStorage.setItem" docs/_legacy/_archive_v1/blocksworn_index_fixed.html | head -50
   ```
2. Map each integration to a module per file-affected list above.
3. Each module exports a clean public API:
   - `firebase.js`: `initFirebase()`, `getAuth()`, `getDb()`, etc.
   - `revenuecat.js`: `initRevenueCat()`, `getPurchaseOfferings()`, `purchasePackage()`, etc.
   - `sentry.js`: `initSentry()`, `captureException()`, `captureMessage()`
   - `analytics.js`: `logEvent(eventName, properties)` — wraps Firebase Analytics + RevenueCat + Sentry breadcrumbs
   - `logger.js`: `log()` (`.debug` no-op in prod, `.info`, `.warn`, `.error` always log; `.error` also calls `sentry.captureException`)
   - `storage.js`: `getItem`, `setItem`, `removeItem`, `clear`, `migrate`, `setMockMode(boolean)` — see below
4. **Storage module design** (most important):
   ```js
   // src/services/storage.js
   const STORAGE_VERSION = 1;
   let mockStore = null; // in-memory backing for tests when mockMode = true
   let mockMode = false;
   
   export function setMockMode(enabled) {
     mockMode = enabled;
     mockStore = enabled ? {} : null;
   }
   
   export function getItem(key, defaultValue = null) {
     if (mockMode) return key in mockStore ? mockStore[key] : defaultValue;
     try {
       const raw = localStorage.getItem(key);
       return raw === null ? defaultValue : JSON.parse(raw);
     } catch (_e) { return defaultValue; }
   }
   
   export function setItem(key, value) {
     if (mockMode) { mockStore[key] = value; return; }
     try { localStorage.setItem(key, JSON.stringify(value)); } catch (_e) { /* quota */ }
   }
   
   export function removeItem(key) {
     if (mockMode) { delete mockStore[key]; return; }
     try { localStorage.removeItem(key); } catch (_e) { /* */ }
   }
   
   export function clear() {
     if (mockMode) { mockStore = {}; return; }
     try { localStorage.clear(); } catch (_e) { /* */ }
   }
   
   export function migrate(fromVersion, toVersion) {
     // Placeholder; T1.14 will implement artifact migration
   }
   ```
   Note: the legacy code uses raw `localStorage.setItem('foo', 'bar')` for strings AND `localStorage.setItem('state', JSON.stringify(obj))` mixed. Our new API normalizes everything through `JSON.stringify`/`JSON.parse`. This is intentional but FUTURE migration callers must be aware. Document in module header.
5. **Sentry DSN placeholder:** leave existing placeholders as-is (per Execution Plan T1.08 step 5). Don't put a real DSN.
6. **Don't migrate game logic** — only services. Anything that LOOKS like game logic (computing balance, processing battle state, etc.) stays in legacy.
7. **Add Vitest** (`npm install -D vitest`) + first unit tests for storage module:
   ```js
   // tests/unit/storage.test.js
   import { describe, it, expect, beforeEach } from 'vitest';
   import { setMockMode, getItem, setItem, removeItem, clear } from '../../src/services/storage.js';
   
   beforeEach(() => { setMockMode(true); clear(); });
   
   describe('storage', () => {
     it('getItem returns defaultValue when key absent', () => {
       expect(getItem('missing', 'fallback')).toBe('fallback');
     });
     it('setItem then getItem roundtrips object', () => {
       setItem('a', { x: 1 });
       expect(getItem('a')).toEqual({ x: 1 });
     });
     it('removeItem clears key', () => {
       setItem('b', 1);
       removeItem('b');
       expect(getItem('b', 'gone')).toBe('gone');
     });
     it('clear wipes everything', () => {
       setItem('c', 1); setItem('d', 2);
       clear();
       expect(getItem('c', 'gone')).toBe('gone');
       expect(getItem('d', 'gone')).toBe('gone');
     });
   });
   ```
8. Add `test:unit` script to `package.json`: `"test:unit": "vitest run"`.

**Acceptance criteria:**
- [ ] 6 service modules created with clean public API (named exports)
- [ ] `storage.js` has mock mode (`setMockMode(true)` switches to in-memory)
- [ ] `analytics.logEvent()` wraps Firebase Analytics + Sentry breadcrumbs
- [ ] `logger.error()` calls `sentry.captureException` (or wraps gracefully if Sentry not initialized)
- [ ] **Sentry DSN placeholder unchanged** (no real DSN)
- [ ] `tests/unit/storage.test.js` covers get/set/remove/clear (minimum)
- [ ] `vitest` added to devDependencies; `npm run test:unit` exits 0 with passing tests
- [ ] CI workflow updated: add `unit` job that runs `test:unit` (slot it after `lint`, before `smoke`)
- [ ] `npm run test:smoke` → 2/2 pass
- [ ] `npm run test:visual` → 22/22 pass
- [ ] `npm run build` → succeeds, bundle still under 5MB
- [ ] `npm run lint` → 0 errors
- [ ] Legacy HTML: `wc -c` = 21,480,494; SHA-256 = `4b3a3974f8b9030bf195dc9fad2b7b4bf07857021b3c01b44410ac547fcee67f`
- [ ] Commit: `[T1.08] Extract services to src/services/ + first unit tests`

**DO NOT TOUCH:**
- `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` (sacred)
- `serveLegacyHtmlRaw` plugin in `vite.config.js`
- CSS from T1.06 (`src/styles/`)
- Data from T1.07 (`src/data/`, `src/feel/`)
- Visual baselines, smoke tests, regression spec, husky, eslint config
- Sacred cows (CLAUDE.md §2)
- Game logic — DO NOT migrate gameplay functions (T1.10 territory)
- `site/`

**Known unknowns / risks:**
- The legacy may initialize services in a specific order that matters for auth (Sentry before Firebase? Firebase auth needs to fire before storage migration? Etc.). Per Execution Plan T1.08: "DO NOT change service initialization sequences (Firebase ordering matters for auth)." Document the legacy init order in `src/main.js` comment as the future T1.12 wire target.
- Firebase config object may be inline (apiKey, authDomain, projectId, etc.). For T1.08, leave the config as-is — it stays in `src/services/firebase.js` even if it contains real keys. (Production hygiene is a separate T1.18+ task.)
- Some legacy code may use `localStorage` directly without going through the abstraction. For T1.08, just create the abstraction; T1.10 will rewire callers. Document direct-localStorage usages found in "Замечено рядом" so T1.10 catches them all.

**Rollback plan:** `git revert <commit-sha>` — fully reversible; legacy untouched.

**Time-box:** 60-90 min (inventory 15, modules 30-45, unit tests 10, CI yml update 5, verify 15-20).

---

**Self-check (Game Dev → CTO, 2026-05-11):**

Implementation summary — six service modules created with named-export public API, first unit tests added (Vitest), first new CI job (`unit`) wired in between `lint` and `build`. Pure abstraction layer: zero legacy callers rewired (T1.10 territory), zero changes to legacy HTML / CSS / data / feel.

**Files changed / created:**
- `src/services/firebase.js` (new, 107 lines / 4.0KB) — `initFirebase()`, `getApp/getAuth/getDb/getAnalytics`, `onReady(cb)`. Thin wrapper over `window.fb` (which legacy module script exposes). `FIREBASE_CONFIG` byte-identical to legacy lines 18285-18293.
- `src/services/revenuecat.js` (new, 102 lines / 3.6KB) — `initRevenueCat(apiKey, appUserID)`, `isReady`, `getOfferings`, `purchasePackage`, `restorePurchases`. Placeholder-key guard preserves legacy mock-fallback behavior.
- `src/services/sentry.js` (new, 78 lines / 3.2KB) — `initSentry(dsn?)`, `captureException`, `captureMessage`, `addBreadcrumb`. DSN placeholder byte-identical to legacy line 18442. Init early-returns on placeholder so dev / Vitest never phone home.
- `src/services/analytics.js` (new, 155 lines / 5.6KB) — `EVT` taxonomy (51 keys, byte-mirror of legacy 18809-18873), `logEvent(name, props)`, `setUserProperty`, `setUserId`. logEvent forks to Firebase Analytics modular SDK + legacy compat + Sentry breadcrumb, each sink try/catch'd so analytics never breaks gameplay.
- `src/services/logger.js` (new, 55 lines / 2.4KB) — `log.{debug,info,warn,error}` + flat named exports. `log.debug` is no-op when `import.meta.env.PROD === true` (Vite-provided); `log.error` routes to Sentry via `captureException`, wrapped in try/catch so cold-start (Sentry not yet initialized) never throws.
- `src/services/storage.js` (new, 123 lines / 4.6KB) — `getItem/setItem/removeItem/clear`, `setMockMode/isMockMode`, `migrate` placeholder, `STORAGE_VERSION = 1`. JSON-stringifies on set, JSON-parses on get; mock mode swaps to in-memory `Object.create(null)` backing.
- `tests/unit/storage.test.js` (new, 54 lines / 1.8KB) — 6 tests covering mock-mode flag, getItem default fallback, set/get roundtrip with object, removeItem, clear, STORAGE_VERSION + migrate sanity.
- `vitest.config.js` (new, 16 lines / 0.6KB) — scopes test discovery to `tests/unit/**/*.test.js` so Vitest does not pick up Playwright `.spec.js` files.
- `src/main.js` — added comment documenting legacy service init order (Firebase → RevenueCat → Sentry) as T1.12 wire-up target per Known Unknowns note.
- `package.json` — added `"test:unit": "vitest run"` + `"test:unit:watch": "vitest"`; `vitest` ^4.1.5 added as devDep.
- `package-lock.json` — Vitest dep tree (+37 packages, all transitive Vitest deps).
- `.github/workflows/ci.yml` — new `unit` job between `lint` and `build`; `build` now `needs: unit`. Smoke + visual remain `needs: build` (so unit-test regression blocks them transitively).

**Verification:**
- `npm run lint` → 0 errors ✅
- `npm run test:unit` → 6/6 pass in ~125ms (Vitest 4.1.5) ✅
- `npm run build` → succeeded; bundle = 372 KB (CSS 368.77 KB + JS 0.75 KB), identical to T1.07 — services tree-shake out as expected ✅
- `npm run test:smoke` → 2/2 pass on chromium + mobile-chrome ✅
- `npm run test:visual` → 22/22 pass under 2% threshold ✅
- Legacy HTML: `wc -c` = 21,480,494 ✅; SHA-256 = `4b3a3974f8b9030bf195dc9fad2b7b4bf07857021b3c01b44410ac547fcee67f` ✅

**Self-check checklist:**
- [x] 6 service modules with named exports + clean public API
- [x] `storage.js` mock mode (`setMockMode(true)` → in-memory backing)
- [x] `analytics.logEvent()` wraps Firebase Analytics + Sentry breadcrumbs
- [x] `logger.error()` calls `sentry.captureException`, wrapped in try/catch for cold-start safety
- [x] Sentry DSN placeholder unchanged (byte-identical to legacy)
- [x] `tests/unit/storage.test.js` covers get/set/remove/clear (6 tests, 4 minimum)
- [x] `vitest` added; `npm run test:unit` exits 0
- [x] CI workflow: `unit` job added, slotted between `lint` and `build`
- [x] All test gates green (lint, unit, smoke, visual)
- [x] Build succeeds, bundle 372 KB (well under 5 MB)
- [x] Legacy HTML byte-identical
- [x] No new console.log in production code (debug-only path; `log.debug` is no-op in PROD)
- [x] No game logic migrated (pure service abstractions)
- [x] Sacred cows untouched
- [x] DO NOT TOUCH list respected (legacy HTML, vite plugin, CSS, data, feel, baselines, eslint config, husky, site/)

**Замечено рядом (NOT fixed, reported):**
- `src/main.js` still uses `console.log('Blocksworn loading...');` — intentional per ESLint config comment (`no-console` is OFF until T1.10+ rewires call sites through the new `src/services/logger.js`). Flagging here for tracking but not in scope to fix.
- Legacy has ~413 raw `localStorage.{getItem,setItem,removeItem,clear}` call sites (grep count) — full inventory deferred to T1.10. Key risk: many legacy callers read raw strings (no JSON.parse), so when T1.10 rewires those to `storage.getItem()`, the value coming back will be JSON-parsed (string → string still works because `JSON.parse('"foo"') === 'foo'`, but legacy uses both formats — needs per-callsite verification).
- Legacy has 4 distinct boot ordering hooks that T1.12 must preserve: `firebaseReady` CustomEvent (line 18339), `revenueCatReady` (line 18411), `_saveVersionGate` IIFE that runs before any const/let reads localStorage (line 18504), and DOMContentLoaded for Sentry (line 18467). Captured in `src/main.js` header comment.
- Vitest 4.1.5 install reports "2 moderate severity vulnerabilities" via npm audit (transitive — not in our top-level deps). Not actionable in T1.08; flag for next dependency audit pass.
- `vitest.config.js` was required (not anticipated by TASKS.md spec): default Vitest discovery picks up Playwright `.spec.js` files in `tests/smoke/` + `tests/visual/`, which crash because `test()` is registered on Playwright runner not Vitest. Minimal config (16 lines) scopes Vitest to `tests/unit/**/*.test.js`. Surfacing as a "Known unknowns" resolution rather than a deviation — the spec said "may need a minimal vitest.config.js"; this is that.

**Time:** ~75 min (inventory 10, modules 35, unit tests 5, vitest config 3, CI yml 5, lint-fix cycle 5, verification + self-check 12).

**Commits:**
- `[T1.08] Extract services to src/services/ + first unit tests` — `f6b67a4`
- `[DOCS] TASK-009 → REVIEW with self-check` — (this update)

**One open question for CTO:** none — task executed cleanly to spec.

---

### TASK-010 (T1.09) — Extract feel layer (animations, particles) to `src/feel/`

**Status:** TODO (blocked by TASK-009)
**Priority:** HIGH
**Phase:** 1 (Week 4-5 per Plan; faster at current pace)
**Goal:** Extract `vPlayLineClearBurst`, `vPlayCritFlash`, `vPlayBossDieFx`, particle creation/lifecycle, speakNarrator function to `src/feel/{animations,particles,narrator}.js`. **V_HAPTICS and NARRATOR_LINES already done in T1.07.** Sacred cow timing values (180ms flash, 440ms shake, 5-beat boss death) must remain byte-perfect.
**Detailed spec:** `docs/plan/00_EXECUTION_PLAN.md` §13 T1.09.

---

## GAME DESIGNER

(no active tasks — Designer activated в Phase 2)

---

## BUG TESTER

### BUGS (closed)

#### BUG-001 🟡 MAJOR ✅ CLOSED 2026-05-11 — Visual regression WARN band silently passed CI
**Resolution:** CTO config patch — `WARN_THRESHOLD` 0.05 → 0.02 (Phase 1 strict mode).

---

## CLOSED TASKS (chronological history)

### TASK-001 (T1.01) ✅ DONE 2026-05-11
**Commits:** `c9cf50e`, `6c010ef`
**Outcome:** Vite scaffold + legacy HTML relocated byte-identical

### TASK-002 (T1.02) ✅ DONE 2026-05-11
**Verification only** — CLAUDE.md in root

### TASK-003 (T1.03) ✅ DONE 2026-05-11
**Commits:** `8d79a61`, `8773ca6`, `ac9cedb`
**Outcome:** Playwright + smoke; chromium + mobile-chrome green; `serveLegacyHtmlRaw` plugin for legacy parse5 quirk

### TASK-004 (T1.04) ✅ DONE 2026-05-11
**Commits:** `2c08bb2`, `04e8456`
**Outcome:** 22 visual baselines, 11M total

### TASK-005 (T1.05) ✅ DONE 2026-05-11
**Commits:** `235941e`, `9464311`, `a7084a2` (T1.05.1 fix), `527fa74`
**Outcome:** CI + visual regression diff + husky + ESLint

### TASK-006 (AUDIT-01) ✅ DONE 2026-05-11
**Commits:** `d942eff`, `fc08d51`
**Verdict:** GO; legacy HTML SHA-256 = `4b3a3974f8b9030bf195dc9fad2b7b4bf07857021b3c01b44410ac547fcee67f`
**Bugs found:** BUG-001 (CLOSED)

### TASK-007 (T1.06) ✅ DONE 2026-05-11
**Commits:** `2e097f4`, `f2c662f`
**Outcome:** 19 CSS files (576KB on disk, 368KB bundle), 179 @keyframes, zero `--v-*` tokens

### TASK-008 (T1.07) ✅ DONE 2026-05-11
**Commits:** `c357124` (T1.07 — 35 constants relocated), `a93435a` (DOCS)
**Outcome:** 35 top-level constants → 11 modules in `src/data/` (116KB) + `src/feel/` (8KB)
**Sacred cow verifications:**
- V_HAPTICS byte-perfect (legacy lines 66373-66383)
- NARRATOR_LINES byte-perfect (9 keys, legacy lines 66393-66403)
- TIER_COSTS_V18 consolidated → canonical `TIER_COSTS` (legacy 3-tier was dead code, properly identified)
- HERO_ULT_COST_BY_NEWROLE preserved as named export
- GEM_PACKS price ladder unchanged
- Battle Pass tier formula: `SEASON_TIER_XP_BASE = 500` + `SEASON_TIER_XP_STEP = 150` discovered as scalars

**Deferred to other tasks (correctly flagged, NOT band-aided):**
- HERO_ROSTER (function-bound `fire: fireThorgar` etc — needs T1.10 logic context)
- BOSS_ARCHETYPES (mutated post-decl via `Object.assign` for Ch3/4/5 → T1.10)
- ROLE_DESC, STIHIYA_DESC (closure-scoped → T1.10)
- STARTER_PACK_*, TOWER_CLIMBER_PACK_* (scalar shadows of MONETIZATION.* → T1.18 consolidation)
- P7 WHALE_OFFERINGS, etc. (Player Segments → T1.20)
- SEASON_FREE_TRACK, SEASON_CONFIG, SEASON_REWARDS, TOWER_UROBOROS_SEASONAL → T1.10 (with season state machine)

**Verification:**
- `npm run test:smoke` → 2/2 pass
- `npm run test:visual` → 22/22 pass under 2%
- `npm run build` → 372KB dist (identical to T1.06 — modules tree-shake out as expected)
- `npm run lint` → 0 errors
- Legacy HTML byte-identical (`wc -c` = 21,480,494; SHA-256 unchanged)

---

**Maintained by:** CTO agent
**Last update:** 2026-05-11 — after T1.07 review; T1.08 ready
