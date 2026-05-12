# ADR-004: Hybrid Runtime — src/ + Legacy Coexistence Through Phase 1

**Status:** Accepted
**Date:** 2026-05-12
**Author:** CTO (Roman approved)

## Context

Execution Plan §13 T1.12 expected `index.html` switchover to make `src/main.js` the primary render path, with legacy 21MB HTML demoted to read-only archive at the end of Phase 1. The Plan's T1.13 verify pass was intended as final sanity check.

In execution, the migration revealed deeper interconnection than the Plan modeled:
- Legacy was a single 21MB scope where everything called everything via window-globals
- Pure-relocation discipline through T1.06-T1.11 extracted ~17,000 LoC byte-perfect but deferred all cross-module wire-up to T1.12+
- T1.12 structural switchover landed cleanly (scaffold + boot + migration shim + bundle <5MB)
- T1.13 main verify + 5 follow-up iterations (T1.13.1-T1.13.5) revealed the new shell at `/` boots cleanly but renders empty content — each fix layer exposed the next: writable globals, ASSETS data URIs, dialog system, vRender* helpers, DOM scaffold, archetype tick handlers
- T1.13.6 agent stalled trying to extract menu DOM scaffold from 24,000-line legacy `<body>` — task scope ran past agent's deliberation budget

This is **typical AAA migration reality** — Discord, VS Code, Slack, GitHub all maintained hybrid runtime states for substantial time during major architectural transitions. Expecting clean switchover at the end of pure-relocation is optimistic.

## Decision

**Phase 1 closes at the infrastructure level, not at "new shell plays the game" level.**

Specifically:
- **Phase 1 success criteria (revised):** modular foundation built, sacred values preserved byte-perfect, CI green, infrastructure proven, accumulated v2.1 debt cleaned (T1.14-T1.20 cleanup tasks)
- **New shell at `/`:** infrastructure milestone — boots, routes, runs migration shim, surface for future feature work. NOT required to play the game during Phase 1.
- **Legacy URL `/docs/_legacy/_archive_v1/blocksworn_index_fixed.html`:** primary runtime through Phase 1 endgame. Players + smoke tests + visual baselines all use this path.
- **Phase 2+ work:** ALL new features built **only** in `src/`. Never in legacy. Over time, src/ surface surpasses legacy; legacy retires through natural attrition (or future dedicated "switchover sprint" once src/ surface is dominant).

## Practical implications

1. **Legacy byte-identity rule retires (controlled):**
   - The "SHA-256 must stay `4b3a3974f8...`" invariant was a migration-phase discipline (T1.06-T1.11). It served its purpose.
   - T1.14-T1.20 cleanup tasks may modify legacy to delete dead code (artifacts, Cosmic Memorial, etc.).
   - Visual baselines + smoke tests continue to validate that legacy mutations don't break gameplay. Any breakage = task RETURN.
   - SHA-256 audit trail moves to git commit history.

2. **Test gates remain authoritative:**
   - Smoke tests (legacy load) — must stay green
   - Visual regression (chromium, against `_legacy/_archive_v1/`) — ≤2% PASS / 2-5% WARN / >5% FAIL per CLAUDE.md §3.7 canonical (already restored T1.13.4)
   - CI on PR — must stay green
   - Any cleanup that breaks these = revert + re-plan

3. **PR #158 remains "Phase 1 milestone PR":**
   - Roman merges when 20/20 tasks done + verdict GO
   - All T1.14-T1.20 work lands on same branch (`claude/dreamy-bouman-f8e247`)

4. **Phase 2 Identity Layer:**
   - Activates `src/feel/identity-fx.js`, `src/data/identity-layer.js`, `src/core/reactivity-events.js` extension hooks
   - Render functions live in `src/ui/battle-screen.js` (already extracted)
   - Wired through `src/main.js` boot chain — Identity Layer becomes the FIRST live feature using the new modular architecture
   - This is where the new shell finally "earns" its primary-path semantics (per-feature, not all-at-once)

5. **No "switchover sprint" scheduled in Phase 1:**
   - Could be done at end of Phase 4 (just before Chia ship), or as opportunistic backfill in Phase 2-3
   - Not blocking Phase 2-4 value delivery

## Rationale

- **Discord precedent:** Electron app maintained legacy jQuery code in some surfaces while new TS/React code shipped in others, for years. Migration completed when feature parity made retirement safe.
- **VS Code precedent:** "Monaco editor" refactor maintained dual rendering paths during multi-year transition.
- **Slack precedent:** jQuery → React rewrite was hybrid for ~3 years before completion.
- **AAA+ §7.4 from CLAUDE.md:** "No parallel feature work во время Phase 1" — keeping Phase 1 focused on foundation + cleanup, not also a full UI rewrite, aligns with this principle.
- **Risk vs value:** Path B (strangler-fig bootstrap rewrite) would add 5-15 more sessions to Phase 1 with uncertain finish. Path A finishes Phase 1 in 3-5 sessions and starts Phase 2 immediately.

## Consequences

**Positive:**
- Phase 1 finishes on reasonable timeline (~3-5 more sessions for T1.14-T1.20 cleanup)
- Foundation value realized: any Phase 2-4 feature inherits the modular architecture
- Legacy stays playable (zero downtime for players)
- Test infrastructure (smoke + visual + CI) continues validating
- Phase 2 design can start immediately while Phase 1 finishes

**Negative:**
- "New shell IS the game" goal deferred (no Phase 1 endgame moment of UI switchover)
- Two runtime paths coexist — small mental overhead for new contributors
- Legacy file gets mutated during T1.14-T1.20 — SHA-256 invariant changes (audit via git log instead)
- Eventually need a dedicated switchover sprint OR natural retirement once src/ dominates

**Neutral:**
- Bundle stays small (4.5MB) — only modules that are imported land in bundle
- `src/main.js` boot chain works as feature-flag gate for what's wired up
- Migration shim already addresses the data-loss risk on eventual switchover

## Compliance

How to verify this decision is being followed:

1. **No new code in legacy:** any task that adds NEW functionality must add it to `src/`. Bug fixes to existing legacy behavior may modify legacy directly (T1.14-T1.20 cleanup) but should also flag for eventual src/ migration.
2. **Phase 2+ feature implementation in src/ only:** new tasks audit "where did this functionality land?" — if answer is "legacy", that's a violation.
3. **Tests remain authoritative:** all changes (legacy or src/) must pass smoke + visual + unit + lint + build.
4. **Document switchover sprint** when scheduled: a future ADR (probably ADR-007 or similar) will describe the strangler-fig retirement plan once Phase 2-4 sees how much surface migrates naturally.

## Related

- CLAUDE.md §6.2 Phase 1 deliverables (revised scope per this ADR)
- CLAUDE.md §7.4 No parallel feature work in Phase 1
- Execution Plan §13 T1.12-T1.13 (original optimistic switchover)
- REPORT-13 (T1.10 closeout) — migration discipline win + tech debt list
- REPORT-15 (PR #158 CI green) — infrastructure validated
- REPORT-16 (this decision documented in plan/REPORT.md)
