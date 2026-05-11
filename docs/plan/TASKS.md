# Active Tasks

> Source of truth for current work. Updated real-time by CTO.
> Detailed spec для каждой task → `docs/plan/00_EXECUTION_PLAN.md` §13-16.

---

## GAME DEVELOPER

### TASK-009 (T1.08) — Extract services into `src/services/`

**Status:** TODO (READY — T1.07 DONE; assignment ready for Game Dev Agent)
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
