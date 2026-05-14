# Blocksworn — Executive Briefing

**Audience:** Director / decision-maker
**Author:** CTO (Claude Code agent under Roman's direction)
**Date:** 2026-05-14
**Status:** Production-stable; awaiting strategic decisions for next sprint

---

## One-paragraph summary

Blocksworn ship status is **good with one important asterisk**: the full v2.1 game (combat, FTUE, Tower, Battle Pass, 25 heroes, 12 music tracks, all polish from 10 prior sprints) is **LIVE at https://play.blocksworm.com** behind a stable deploy pipeline. The marketing site at **https://www.blocksworm.com** is also live. Across the 4-phase modernization plan (T1.01 → T4.13), **63 development tasks completed** with **0 sacred-cow modifications** (combat math, narrative voice, monetization formulas all byte-perfect) and **1758 unit tests** passing. The asterisk: **Phase 2-4 features (Identity Layer FX, Adventures, Party Tower, Chia wallet/NFT) are coded + unit-tested in `src/` but NOT yet active in the live-served runtime** — they require a "sidecar wiring" integration sprint that attempted to ship tonight but had to be rolled back after surfacing a series of cascading bugs. The director needs to choose how to handle that integration next.

---

## What's live, today

| Surface | URL | State |
|---|---|---|
| Marketing landing site | https://www.blocksworm.com | LIVE (Next.js) |
| Game (full v2.1 + audio) | https://play.blocksworm.com | LIVE (legacy single-HTML, 21 MB) |
| Modular shell (parity testing only) | https://play.blocksworm.com/shell | LIVE (Vite-built) |
| Apex domain | https://blocksworm.com | 308 → www |

End-to-end Playwright probe confirms: page loads cleanly, FTUE Chronicler dialog renders, **▶ BEGIN** click enters first battle, no JS errors, 0 same-origin 404s, music files reachable. Live verification runs automatically on every push to main.

---

## What's in the codebase but NOT yet in the live game

These features were built, unit-tested, and merged to main — but require runtime integration that's currently deferred:

| Feature set | Status | Why it's not live |
|---|---|---|
| Phase 2 Identity Layer — 5 race FX + 5 boss-reactive mechanics + Codex | Code complete, 498 unit tests | Sidecar wiring incident (see Section 03 postmortem) |
| Phase 3 Adventures — async 5-15 player clans | Code complete, 4 smoke tests | No UI mount points in legacy menu |
| Phase 3 Party Tower — 2-5 player async coop | Code complete, 2 smoke tests | No UI mount points |
| Phase 3 Replay viewer | Code complete, 2 smoke tests | No UI mount points |
| Phase 3 Friend leaderboard | Code complete | No UI mount points |
| Phase 3 Tower Seasonal — 13-week rotation | Code complete | No UI mount points |
| Phase 4 Sage Wallet + NFT mint/transfer/royalty | Code complete, 43+79+62 unit tests | Sidecar wiring incident |
| Phase 4 Adventure DAO | Code complete, 82 unit tests | Sidecar wiring incident |
| Phase 4 PURE PATH CHAIN leaderboard | Code complete, 44 unit tests | Sidecar wiring incident |
| Phase 4 Mobile feature flag + Anti-P2W audit | Code complete, 9+48 unit tests | Sidecar wiring incident |

**Bottom line:** ~393 new Phase 2-4 unit tests prove the modules work in isolation. They sit dormant in production until an integration sprint wires them into the live runtime.

---

## What today's session shipped

| | Commits this session |
|---|---|
| Phase A — Production cache strategy + 18 missing icons | merged |
| Phase B — 130 window-bridge collision guards (rolled back) | reverted |
| Phase C — Live-URL Playwright CI gate | merged |
| Phase D — UI mount-points scope doc for next session | merged |
| Phase 4.1 — Sidecar wiring attempt (rolled back) | reverted |
| STABILIZE rollback — restore pure legacy game | merged |
| Music tracks (12 mp3 files) + cache rules | merged |
| **Net result** | game works, music plays, Phase 2-4 features pending |

---

## Three decision points for the director

### Decision 1: How to integrate Phase 2-4 features into the live runtime

Three options, in increasing order of investment:

| Option | Effort | Risk | Outcome |
|---|---|---|---|
| **A. Keep pure legacy as-is** | 0 | 0 | Players get the v2.1 game; Phase 2-4 work stays as code-complete but invisible (development cost already sunk) |
| **B. Defensive sidecar v2 — full E2E gating** | ~3-5 days | Medium | All Phase 2-4 features become user-visible (Identity Layer FX, Adventures, Party Tower, Replay, Friend Leaderboard, Tower Seasonal, Chia wallet/NFT/DAO). Requires comprehensive collision audit + Playwright walk for every UI surface BEFORE merge. |
| **C. Full modular-shell migration (T1.13)** | 2-3 weeks | High | Replace legacy HTML entirely with the modular Vite shell. Cleanest long-term architecture; biggest short-term risk. |

Recommendation: **B**, scheduled as a dedicated sprint after the closed beta (Decision 3 below). C is the right destination but not the next step.

### Decision 2: Whether to launch the Chia integration (T4.11 + T4.12)

The Phase 4 Chia integration (NFT-hero variants, Adventure DAO, wallet connect) was a Roman-ESC-resolved scope. The code is complete and unit-tested. Going live requires:

- ~1 week to provision: `beta.blocksworm.com` subdomain, Discord channel, Chia testnet wallet seed
- ~2 weeks closed beta with 100+ Chia-community testers (per ESC-04 Q5 ruling)
- ~1 week 3-wave production launch (Chia community → crypto media → mainstream)
- ~$0-500 in operational cost (Vercel free tier handles it; Chia testnet is free)

Decision needed: **go / no-go on Chia integration**. The code investment is sunk either way; the question is whether to operationally launch.

### Decision 3: Operational ownership

This session was driven by a CTO-style AI agent (Claude Code) under Roman's direction, with 180+ commits over 4 days across 4 phases. The architecture is documented but is not currently owned by a human engineer. For sustainable operation, the director should decide:

- **Engineering lead:** who owns merges, incident response, sprint planning?
- **Cadence:** weekly merges to main? feature flags for staged rollout?
- **On-call:** during T4.11 beta + T4.12 launch, who answers Sentry P0 alerts?

Without a named owner, the project is at risk of stalling between sessions.

---

## Read next

- `01_PROJECT_STATE.md` — detailed state of each phase, test coverage, sacred cows
- `02_PRODUCTION_TOPOLOGY.md` — URLs, hosting, DNS, deploy pipeline
- `03_SESSION_INCIDENTS.md` — honest postmortem of today's Phase 4.1 churn
- `04_RISK_REGISTER.md` — known risks + tech debt
- `05_ROADMAP_OPTIONS.md` — three decision menus with cost/benefit analysis
