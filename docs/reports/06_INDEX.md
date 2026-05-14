# Blocksworn Reports — Index

**For director review.** Self-contained reports covering all fronts of the project as of 2026-05-14.

## Read order

1. **[`00_EXECUTIVE_BRIEFING.md`](00_EXECUTIVE_BRIEFING.md)** — 1-page summary. Three decisions for the director. Start here.

2. **[`01_PROJECT_STATE.md`](01_PROJECT_STATE.md)** — Detailed phase completion matrix, what's live vs. dormant, test coverage, sacred-cow audit, performance metrics, open ADRs/ESCs.

3. **[`02_PRODUCTION_TOPOLOGY.md`](02_PRODUCTION_TOPOLOGY.md)** — Domain map (blocksworm.com + subdomains), Vercel project structure, deploy pipeline, cache strategy, external services status, Roman's required action items.

4. **[`03_SESSION_INCIDENTS.md`](03_SESSION_INCIDENTS.md)** — Honest postmortem of today's Phase 4.1 sidecar attempt, 5 hotfixes, eventual rollback. Root causes, lessons learned, compensating controls now in place.

5. **[`04_RISK_REGISTER.md`](04_RISK_REGISTER.md)** — 18 risks rated by likelihood × impact. R1-R4 are director-attention; R5-R11 are next-sprint candidates; tech debt items tracked separately.

6. **[`05_ROADMAP_OPTIONS.md`](05_ROADMAP_OPTIONS.md)** — Three decision menus (sidecar integration / Chia launch / engineering ownership) with cost-benefit analysis. Recommended combined path: ~6-10 weeks to production launch.

## Supporting documents (deeper context, optional)

- `../plan/00_EXECUTION_PLAN.md` — original 4-phase 2,690-line plan (Roman + CTO 2026-05-10)
- `../plan/PLAN.md` — phase-by-phase progress tracker
- `../plan/REPORT.md` — historical CTO reports for prior sessions
- `../plan/PRODUCTION_LAUNCH_AAA.md` — Phase A/B/C/D plan + rollback procedure
- `../plan/T4_11_CLOSED_BETA_RUNBOOK.md` — 100+ tester closed beta runbook
- `../plan/T4_12_PRODUCTION_LAUNCH_SEQUENCE.md` — 3-wave production launch sequence
- `../design/chia-integration.md` — 1785 LoC Phase 4 master design (Roman ESC-04 rulings appendix)
- `../design/endgame-social.md` — Phase 3 master design (Roman ESC-03 rulings)
- `../design/mechanics/identity-layer.md` — Phase 2 master design (Roman ESC-02 rulings)
- `../adr/001-vite-vanilla.md` — Vite + Vanilla JS architecture decision
- `../adr/002-async-party-tower.md` — Async > realtime for Party Tower
- `../adr/003-no-power-creep-nft.md` — Strict no-P2W invariant
- `../adr/004-hybrid-runtime-coexistence.md` — Legacy + src/ coexistence
- `../adr/005-mobile-feature-flag.md` — Chia compile-time gate for mobile

## Key data points (quick reference)

| Metric | Value |
|---|---|
| Phases shipped (code) | 4 of 4 (Phase 1-4) |
| Tasks completed | 63 numbered + 4 bridge tasks |
| Unit tests passing | 1758 |
| Sacred-cow modifications | 0 (across all 63+ tasks) |
| Vite JS+CSS bundle | 844 KB (94 KB gzipped) |
| Production live URL | https://play.blocksworm.com |
| Marketing live URL | https://www.blocksworm.com |
| Latest deploy commit (game) | `0dfbbcc` (music fix, 2026-05-14) |
| Phase 2-4 features status | code complete, NOT yet user-visible |

## What's been live since today's session

- ✅ play.blocksworm.com — full v2.1 game (FTUE, combat, Tower, Battle Pass, Uroboros)
- ✅ www.blocksworm.com — Next.js marketing landing
- ✅ 12 music tracks (menu, boss themes, win/lose)
- ✅ 18 game icons
- ✅ FTUE Chronicler intro → ▶ BEGIN → Pyredrake battle
- ✅ Live-URL Playwright CI gate on every push to main

## What's NOT yet live

- ❌ Phase 2 Identity Layer race FX (5 races) + boss-reactive mechanics (5 bosses) + Codex
- ❌ Phase 3 Adventures, Party Tower, Replay viewer, Friend leaderboard, Tower Seasonal UI
- ❌ Phase 4 Chia wallet, NFT mint/transfer, DAO, PURE PATH CHAIN tab
- ❌ T4.11 closed beta operational launch (runbook ready)
- ❌ T4.12 production launch (runbook ready)
