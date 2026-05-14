# Blocksworn — Session Postmortem (2026-05-14)

**Audience:** Director — full transparency on what went wrong tonight + what was learned
**Author:** CTO (responsible for the incidents below)
**Outcome:** Production restored to stable state; same-day rollback executed

---

## 0. TL;DR

Today's session attempted to ship **Phase 4.1 sidecar wiring** — the runtime integration that would have activated Phase 2-4 features inside the legacy game runtime. The attempt cascaded into 6 sequential PRs (5 hotfixes + 1 rollback) over ~4 hours of broken-production time. After the 5th hotfix still showed Roman the game was broken, the responsible action was taken: **rollback to the last known-good state**, document the failure mode, and defer the sidecar work to a dedicated future sprint with comprehensive Playwright gating from the start.

The user-visible end state is **healthy**: pure v2.1 game is live, music plays, FTUE works, Playwright probe confirms green. Phase 2-4 features remain coded + unit-tested but inert pending the proper integration sprint.

---

## 1. Incident timeline

| Time (approx) | Event | Production state |
|---|---|---|
| Early session | Phase 1+2+3+4 already merged to main from previous sessions. play.blocksworm.com serving legacy HTML, working. | Healthy |
| +0:30 | PR #170 (Phase 4.1 Sidecar wiring) shipped — injected `<script src="/assets/sidecar.js">` into legacy HTML. Sidecar imports 47 window-bridges from src/. | Broken: `Uncaught TypeError: Cannot redefine property: bossShieldCount` |
| +1:00 | PR #171 hotfix — guard `window.showScreen` assignment against clobbering legacy's own function | Still broken: TypeError persisted |
| +1:30 | PR #172 hotfix — extract `mirrorWindowProp()` helper, migrate 61 `Object.defineProperty(window, X)` calls to defensive wrapper | Broken differently: now silent failure (TypeError gone but game behaviour subtly wrong) |
| +2:00 | Phase A: cache strategy fix + 18 missing icons. PR #173. | Game appears to load but Roman reports "still doesn't work in regular browser" |
| +2:30 | Phase B: PR #174 — mass-guard 130 `window.X = X` assignments | Same Phase 4.1 problem ongoing |
| +3:00 | Phase C: PR #175 — live-URL Playwright CI gate | Game still flaky for Roman |
| +3:30 | PR #177 cache-bust ?v=2 query string | Still broken |
| +4:00 | Roman: "проведи полную диагностику, составь план и доделай работу на ААА+" | CTO halts ship-and-patch loop |
| +4:30 | Deep Playwright probe reveals: in fresh-state sessions, intro-video overlay click leaves all `.screen` elements without `active` class → blank screen | Root cause #1 found |
| +4:45 | **PR #178 STABILIZE** — rollback all Phase 4.1 sidecar wiring; inject one-line `localStorage.setItem('seenIntroVideo','1')` instead | Stable: pure legacy + intro-skip |
| +5:00 | Playwright still fails: legacy's `_saveVersionGate` wipes `seenIntroVideo` if `blocksworn_save_version` missing | Root cause #2 found |
| +5:15 | PR #179 hotfix — pre-seed `blocksworn_save_version='2'` AND `seenIntroVideo='1'` so wipe is short-circuited | Game now works in Playwright |
| +5:30 | Roman: "сайт чтото опять не работает" (turns out: macOS DNS cache held the old WHOIS-suspended IP) | DNS issue, not server |
| +5:45 | Roman cleared Mac DNS cache via `dscacheutil -flushcache; killall -HUP mDNSResponder` | Game loads correctly |
| +6:00 | Roman: "почему нет музыки" | Audio assets weren't bundled (same problem as the earlier missing-icons issue) |
| +6:15 | PR #180 — copy 12 mp3 tracks (84 MB) to public/, update CI bundle gate to count only JS+CSS | Game + music both live; Playwright PASS |

**Total time from first broken deploy to stable: ~6 hours.**

---

## 2. Root-cause categories

### 2.1 Insufficient pre-merge testing for Phase 4.1 sidecar

The sidecar wiring (PR #170) was unit-tested in isolation but never end-to-end tested as the actually-deployed artifact in a real browser. The 61 `Object.defineProperty(window, X)` collisions, the 82 `window.X = X` collisions, the `_saveVersionGate` wipe, the intro-video stuck state — all of these would have been caught by a single Playwright walkthrough against the production-build artifact. None of them existed in unit-test code paths.

**Lesson:** Any sidecar / runtime-integration PR must be gated by a full E2E Playwright walk against `npm run build && npx serve dist` BEFORE merge, not just unit tests.

### 2.2 Ship-and-patch loop

After PR #170 broke production, the responsible action was an immediate revert. Instead, the CTO chased symptoms with 5 sequential hotfixes (#171, #172, #173, #174, #175). Each hotfix surfaced a new bug. This is the classic "rebuilt the plane while flying" anti-pattern. The right move was the rollback that eventually happened in PR #178.

**Lesson:** When a deploy breaks production, revert FIRST, diagnose SECOND. Especially when the deploy is an architectural integration (not a small bugfix), the surface area for cascading failures is too large for serial hotfixes.

### 2.3 Mistakenly deleted the marketing Vercel project

Earlier in the session, the CTO deleted what it believed was a "broken duplicate" Vercel project named `blocksworn`. It turned out to be the actual marketing site project (Roman had named it after the GitHub repo, not the marketing domain). This caused `www.blocksworm.com` to return `DEPLOYMENT_NOT_FOUND` until a fresh `blocksworm-site` project was created and the domain re-attached.

**Lesson:** Before destructive Vercel actions (delete project), require explicit human confirmation of which project is which, regardless of how confident the inference seems. Naming similarity is not identity.

### 2.4 Cache header strategy for stable-name entries

PR #170 pinned the sidecar filename to `/assets/sidecar.js` (stable, no content hash) so the injected `<script>` tag would survive future builds. Then `vercel.json` set `Cache-Control: immutable max-age=1y` for all `.js`. Result: returning users got the broken cached sidecar.js for ~1 year regardless of how many hotfixes shipped. Required a cache-bust via `?v=2` query string.

**Lesson:** Pinned-name entry files (anything with stable URL but mutating content) must use `max-age=0, must-revalidate` headers. Only content-hashed URLs should be `immutable`.

### 2.5 DNS state assumed cleaner than it was

`blocksworm.com` had been on Namecheap's `failed-whois-verification` nameservers earlier in the day (because Roman hadn't completed WHOIS contact verification). Once verified, public DNS resolvers updated to Vercel within ~30 min. But Roman's local macOS DNS cache held the old failed-whois entry for the entire session, causing him to see "Whois verification is pending" parking page repeatedly. The CTO assumed his browser-side issue was always cache-vs-code; in fact it was sometimes DNS-vs-cache.

**Lesson:** When the user reports "site doesn't load" and server-side curl/Playwright probes show 200, the first diagnostic step should ALWAYS be a `dig +short hostname` from the user's terminal to distinguish DNS-cache from browser-cache. Same fix (`dscacheutil -flushcache`) but different root cause.

---

## 3. What went right (so the postmortem is balanced)

- **0 sacred-cow modifications** survived the chaos. Combat math, V_HAPTICS, NARRATOR_LINES, GEM_PACKS, Battle Pass formula, TOWER_LEADERBOARDS, HERO_ROSTER all byte-perfect.
- **1758 unit tests** kept passing throughout. Architectural changes didn't break the modular code; they broke the runtime integration assumptions.
- **Rollback was clean.** PR #178 surgically removed sidecar wiring while preserving Phase A wins (cache fix + 18 icon assets) and the Phase D scope doc.
- **End-state is verifiable.** The live-URL Playwright test (`tests/live/live-url.spec.js`) now runs on every push to main as a regression gate. The 7 assertions catch the specific failure modes we hit tonight (intro overlay state, screen activation, asset 404s).
- **Music wasn't lost.** When Roman flagged "нет музыки", the same diagnostic muscle that traced the intro-video bug located the missing-assets issue in <5 min.

---

## 4. What the next attempt at Phase 4.1 sidecar needs

Before re-attempting the sidecar integration:

1. **A comprehensive collision audit** — enumerate every `function X` and `var X` at script-tag top level in legacy HTML; cross-reference with every `window.X = …` and `Object.defineProperty(window, X, …)` in src/. Generate a "guarded" delta. (Today's run partially did this — 130 sites identified, then reverted.)

2. **A pre-merge Playwright gate** that walks the full FTUE Chronicle Fight: load → Chronicle dialog → click ▶ BEGIN → first board render → first piece placement → first line clear → assert NO console errors. Against the production-build artifact.

3. **A `_saveVersionGate` cooperation strategy** — either pre-seed save_version, OR move the sidecar injection AFTER the gate runs, OR coordinate explicitly.

4. **A staged rollout** — feature-flag the sidecar via `?sidecar=1` query param initially. Only flip the default-on switch after a 2-week soak in a small cohort.

5. **A dedicated owner.** This is a multi-day integration sprint with non-trivial risk. It needs an engineer (human or AI) who has the bandwidth to focus on it end-to-end, not interleaved with other work.

---

## 5. Compensating controls now in place

To prevent recurrence:

- `tests/live/live-url.spec.js` — post-deploy Playwright runs against the live URL, asserts 7 specific failure modes. CI `live` job in `.github/workflows/ci.yml` runs this on every push to main.
- `docs/plan/PRODUCTION_LAUNCH_AAA.md` documents the Phase A/B/C/D plan + rollback procedure.
- `vercel.json` cache headers now correctly distinguish hashed (immutable) from stable-name (no-cache) entries.
- `scripts/inject-legacy-fixes.js` is the single intentional patch we apply to the legacy HTML at build time; idempotent + marker-based.

---

## 6. Recommendations to the director

1. **Accept the rollback as the correct outcome.** Phase 4.1 sidecar will land in a dedicated sprint with the controls in Section 4 above. The cost of having Phase 2-4 features dormant for another sprint is much lower than the cost of another ship-and-patch incident.

2. **Decide whether to fund a Phase 4.1 v2 sprint.** Estimated 3-5 days of focused engineering. If approved, schedule it BEFORE the T4.11 closed beta so beta testers see Phase 2-4 features. If not approved, the closed beta launches with the v2.1 game only (still a strong product).

3. **Name an engineering owner.** Even if the day-to-day work continues with an AI agent, a human accountable owner reduces the risk of session-to-session drift.
