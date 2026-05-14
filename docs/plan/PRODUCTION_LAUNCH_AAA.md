# Blocksworn — AAA+ Production Launch Plan

**Author:** CTO
**Created:** 2026-05-14
**Status:** PHASE A IN PROGRESS

## Why this document exists

Tonight Phase 4.1 (sidecar wiring) shipped and immediately bit us with two
production bugs:

1. PR #170 sidecar clobbered `window.showScreen` (legacy's own function with
   identical name). **Hotfixed in #171** by guarding the assignment.
2. PR #172 fixed 61 `Object.defineProperty(window, X)` calls that throw
   `Cannot redefine property` when legacy has already claimed the name via
   `var X` (60+ collisions across 9 src/ modules).

Then a third issue surfaced: Roman sees the game broken in a normal Chrome
session even though Playwright probes confirm the latest code is healthy.
**Root cause:** browser cache. The sidecar entry is pinned to a stable
filename (`/assets/sidecar.js`) so the `<script>` tag in legacy stays
valid across rebuilds. The `vercel.json` cache rule applies
`Cache-Control: immutable, max-age=1y` to all `.js`. The hashed chunks are
safe with that header (their URLs change per build), but the stable
`sidecar.js` is **not** — browsers serve the stale cached sidecar forever.

This document is the disciplined plan to fix everything and ship AAA+
quality.

## What "AAA+" means here

- Zero ship-and-patch loops. Each PR is validated end-to-end on the actual
  live origin BEFORE merge.
- Playwright smoke against `https://play.blocksworm.com/` is a hard gate
  on every PR that touches deploy config, sidecar, or window-bridge code.
- Browser cache strategy is deliberate: hashed assets immutable, unhashed
  entries no-cache.
- All 82 currently unguarded `window.X = …` collision sites get defensive
  guards before the next sidecar release.
- Visible-to-user feature flag rollouts only after the underlying runtime
  is provably stable.

## Phase A — Immediate stabilization (TONIGHT, ~1 hour)

Goal: regular browsers (not just incognito) get the working game on next
visit without manual cache clearing.

| Step | Action | Gate |
|------|--------|------|
| A.1 | `vercel.json`: split cache rules — keep `immutable` for `/assets/*-HASH.{js,css}` (hashed names), but `Cache-Control: public, max-age=0, must-revalidate` for `/assets/sidecar.js` and other stable-name entries. | Build clean |
| A.2 | Copy `./assets/icons/` → `./public/assets/icons/` so `coin.png` + `cristal.png` are emitted to `dist/`. Fixes 2 visible 404s. | Build clean |
| A.3 | New `tests/smoke/live-url.spec.js` — Playwright probe against `https://play.blocksworm.com/`. Asserts: 0 JS page errors, sidecar log present, `#screenMenu` active, < N network 404s. | Test passes locally |
| A.4 | `npm run lint && npm run test:unit && npm run test:smoke -- tests/smoke/live-url.spec.js` all green | All green |
| A.5 | Single PR → squash-merge → wait for Vercel deploy → re-run live probe → confirm GREEN | Probe shows 0 errors |
| A.6 | Manual verification: open `https://play.blocksworm.com/` in a regular Chrome window (no incognito); should load to menu with NO console errors. | Roman confirms |

Acceptance for Phase A: regular-browser users land on a clean menu with
zero JS errors, no missing icon 404s, and stable behaviour on refresh.

## Phase B — Defensive collision guards (next session, ~1-2 hours)

Goal: eliminate the entire class of "legacy has the same name" runtime
bugs so we never ship a 3rd hotfix.

Audit found **82 unguarded `window.X = …` direct assignments** in src/
modules that collide with names legacy declares (var or function). Each is
a latent bug — the modular version replaces legacy's behaviour, possibly
silently misbehaving instead of throwing.

| Step | Action |
|------|--------|
| B.1 | Build a one-off script `scripts/_guard-window-assignments.js` that wraps every `window.X = Y;` in legacy-collision modules with `if (typeof window.X === 'undefined') window.X = Y;`. Idempotent. |
| B.2 | Run it across the 4 files identified by the audit: `src/core/bosses.js`, `src/core/reactivity-events.js`, `src/core/stagger-loop.js`, `src/ui/archetype-ticks.js`. |
| B.3 | Spot-check the 10 most dangerous collisions (`computeBossHP`, `firePhase`, `triggerReactivityEvent`, etc.) — verify the guard works as intended for both modular shell and legacy sidecar runtimes. |
| B.4 | Re-run live Playwright smoke. |
| B.5 | Ship as single PR. |

Acceptance for Phase B: zero TypeError or behavior-regression in live
playwright run; modular shell at `/shell.html` still functions
independently.

## Phase C — Live-URL smoke as CI gate (~30 min)

Goal: catch future regressions BEFORE merge.

| Step | Action |
|------|--------|
| C.1 | Promote `tests/smoke/live-url.spec.js` into the regular smoke suite (remove `_` prefix). |
| C.2 | Add a separate workflow job `live-smoke` in `.github/workflows/ci.yml` that runs the live test on every PR + main push. |
| C.3 | Document in CLAUDE.md: any PR that modifies `vercel.json`, `src/legacy-bridges.js`, `src/sidecar.js`, or `scripts/inject-sidecar.js` requires green live-smoke before merge. |

## Phase D — Phase 4.2 UI mount points (optional, future)

Goal: surface Phase 3 (Adventures, Party Tower, Replay viewer, Friend
leaderboard) and Phase 4 (Wallet, NFT inventory, Adventure DAO, PURE PATH
CHAIN) UI entries inside the legacy menu, so the back-end work that's
already live becomes user-visible.

Approach (to be designed):
- Option D.1: sidecar performs runtime DOM injection into legacy menu.
- Option D.2: complete the T1.13 modular-shell migration so the new shell
  becomes the primary runtime.

Decision deferred — Phase D is not required to ship the existing v2.1
game cleanly.

## Rollback plan

If Phase A regresses the live game:

1. Revert PR #170 + #171 + #172 in main (these introduced the sidecar).
2. The deploy reverts to commit `c07646c` (Serve legacy HTML at /) — pure
   legacy game, no sidecar, no Phase 2-4 wiring. This is the known-good
   state.
3. Re-plan sidecar in a separate sprint with full Playwright gating.

## Sacred-cow safety (unchanged across all phases)

- Zero modification to `docs/_legacy/_archive_v1/blocksworn_index_fixed.html`.
- Zero modification to combat math, V_HAPTICS, NARRATOR_LINES, GEM_PACKS,
  Battle Pass formula, Tower retry, TOWER_LEADERBOARDS sacred 3 keys,
  HERO_ROSTER, or any v2.1 system.
- All Phase A/B/C changes are deploy-config + module-shape defensive
  hardening only.

## Status tracker

- [ ] **A.1** vercel.json cache split
- [ ] **A.2** copy `./assets/icons/` to `./public/`
- [ ] **A.3** live-url.spec.js
- [ ] **A.4** local green
- [ ] **A.5** ship + verify deploy
- [ ] **A.6** Roman confirms in regular browser
- [ ] **B.1-5** Defensive guards
- [ ] **C.1-3** CI gate
- [ ] **D** Phase 4.2 UI mounts (deferred)
