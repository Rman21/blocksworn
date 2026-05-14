# Blocksworn — Project State Report

**Date:** 2026-05-14
**Scope:** All 4 phases of the Execution Plan + production deployment status

---

## 1. Phase completion matrix

| Phase | Tasks Planned | Tasks Done | Bridge Tasks | Tests Added | Sacred Mods | Merged to main |
|---|---|---|---|---|---|---|
| **Phase 1** Foundation Reset | T1.01–T1.20 (20) | 20/20 | T1.13.5 | ~37 unit + 22 visual + 1 smoke | 0 | ✅ `4aea3ce` |
| **Phase 2** Identity Layer | T2.01–T2.12 (12) | 12/12 | T2.B + T2.B.QA | ~498 unit + 7 smoke + 25 visual | 0 | ✅ `6545b57` |
| **Phase 3** Endgame Social | T3.01–T3.15 (15) | 15/15 | T3.16 | ~700 unit + 8 smoke | 0 | ✅ `2dd0f29` |
| **Phase 4** Chia Integration | T4.01–T4.12 (12) | 12/12 | T4.13 | ~393 unit | 0 | ✅ `7db7c95` |
| **Phase 4.1** Sidecar wiring | (not planned) | rolled back tonight | — | — | 0 | reverted in `300a070` |
| **Phase A/B/C/D** Tonight | (not planned) | A+C+D merged, B reverted | — | live-URL smoke gate | 0 | merged in `62e085a`, `e728841`, `d44d541` |

**Net:** 63 numbered tasks + 4 architectural bridge tasks complete. 1758 unit tests passing. 0 sacred-cow modifications across the entire program.

---

## 2. What's live at play.blocksworm.com today

Production serves the **pure legacy single-HTML game** (21 MB, ~76% of the v2.1 reboot complete per Execution Plan §1.2). This is the same content that was at `blocksworm.com/play` for the past 2+ weeks — it works, plays, and contains:

### Core game systems (working)
- 4-channel damage system (DEAD_ZONE, VOID, SIGNATURE, GRID_SATURATION)
- Stagger Loop with Active/Stagger/Recovery state machine
- 25-hero roster with Hero Tier Abilities + Mythic ascension
- HERO_ULT_COST_BY_NEWROLE (warrior 80, mage 100, hunter 120, tank 80, captain 100) — sacred
- TIER_COSTS_V18 `{1:1, 2:2, 3:3, 4:5}` — sacred
- Combo crit formula `total_dmg × (1 + dominantCount × combo × 10%)` — sacred
- 22 v2.1 P4 archetype handlers
- TTK formula (boss_hp = expected_squad_dps × target_ttk_seconds)
- All 187 CSS keyframes + V_HAPTICS table — sacred (byte-perfect)

### Content (working)
- FTUE: Chronicler intro → Pyredrake → hero reveals → Grunt → Chapter 1
- 6 chapters worth of content (Ch1-3 shipped, Ch4-5 spec'd)
- Tower mode (gauntlet + Pacts + Uroboros seasonal)
- Battle Pass formula `500 + (N-1) × 150` — sacred
- Tower retry gem ladder `[100, 200, 400]` — sacred
- GEM_PACKS economy `$0.99 → $99.99 (+30% MEGA)` — sacred
- First Purchase Bonus +50% — sacred
- The Chronicler narrator (Darkest Dungeon poetic voice) — sacred
- 12 music tracks (menu, boss fights, tower, win/lose, per-boss themes)

### Polish (working)
- Colorblind mode
- Reduce motion accessibility
- Localization scaffolding (English only — per Roman ruling)
- Profile customization
- 100-Hearts HP UI

---

## 3. What's coded but NOT in the live runtime

These are merged to `main` and unit-tested but require integration (runtime wiring + UI mount points) before users see them:

### Phase 2 Identity Layer (498 unit tests passing)
- 5 race line-clear flavors: Pirate Plunder, Shark Bloodtide, Rock Riffblade, Crocodile Mossjaw, Spark Emberspark
- 5 boss-reactive mechanics: Phoenix Ashen Reign, Lich Cursed Tiles, Berserker Pressure Pulse, Engineer Lockdown Protocol, Grovewarden Root Surge
- Codex screen: gallery of races/bosses/identity moments
- 36-row sacred audit confirms 0 combat-math modifications

### Phase 3 Endgame Social (~700 unit tests passing)
- **Adventures** — async clans of 5-15 members, weekly boss-of-the-week, contributor stats, clan progression with cosmetic-only ladder (ADR-003 no-P2W)
- **Party Tower** — 2-5 player turn-based async coop (per ADR-002 async-only), shared Tower-Hearts pool, shared TOWER_PACTS
- **Replay** — 9-trigger auto-record, 4fps rolling buffer, scrubable viewer, navigator.share OS-native
- **Friend Leaderboard** — auto-friending via clan/Codex/Tower
- **Tower Seasonal** — 13-week season rotation, 4 Uroboros variants, 3 seasonal pacts, Battle Pass tier-cosmetic tie-in

### Phase 4 Chia Integration (393 unit tests passing)
- Sage Wallet integration (testnet11 → mainnet via Roman's provisioning)
- NFT-hero variant mint (5 V1 variants tied to actual HERO_ROSTER keys)
- NFT transfer + 2.5% royalty enforcement (`BLOCKSWORN_TREASURY_ROYALTY_BPS = 250` sacred per ESC-04 Q2)
- Adventure DAO (wallet-gated clan overlay, dependency-injected adapter)
- PURE PATH CHAIN — additive 4th leaderboard column (sacred 3 keys byte-perfect)
- Mobile feature flag `isChiaEnabled()` — mobile builds Chia-free
- Anti-P2W parity audit (statistical 5-metric audit; sacred-cow ENFORCEMENT layer)
- Closed beta runbook + production launch runbook
- Phase 4 Legacy Bridge — 22 window-namespaced surfaces

---

## 4. Test coverage

| Layer | Count | Notes |
|---|---|---|
| Unit tests | 1758 | All passing. Includes Phase 1 (37) + Phase 2 (498) + Phase 3 (~700) + Phase 4 (393) + helpers. |
| Smoke tests | 15 | Phase-specific Playwright tests; local Vite dev-server target |
| Live-URL Playwright | 1 | Runs against `https://play.blocksworm.com/` on every push to main via CI `live` job |
| Visual regression baselines | 25 PNGs | Captured during T1.04, includes menu/battle/shop/tower/etc. |
| Manual smoke | ad-hoc | FTUE walk, Pyredrake fight |

CI workflow at `.github/workflows/ci.yml`:
- **lint** — ESLint flat config, 0 warnings tolerated
- **unit** — Vitest, must pass 1758/1758
- **build** — Vite build + JS+CSS bundle <5 MB (currently 844 KB)
- **smoke** — Playwright on chromium + webkit + mobile-chrome + mobile-safari
- **visual** — chromium-only regression, 25 baselines
- **live** — post-main only; verifies the actual production deploy

---

## 5. Sacred cows audit (byte-perfect across all 4 phases)

Per CLAUDE.md §2.x, these values have not been modified anywhere in src/ or legacy:

- Combat math (combo crit formula, TIER_COSTS_V18, HERO_ULT_COST_BY_NEWROLE, MAX_HP=100, TTK)
- V_HAPTICS table (10/15/25/30/[30,20,30]/[20,30,40]/[40,40,40]/[100,50,100,50,200]/[200])
- NARRATOR_LINES (Darkest Dungeon poetic voice — game's identity)
- vPlayCritFlash 180ms flash + 440ms shake; 5-beat boss death cinematic
- GEM_PACKS price ladder, First Purchase Bonus, Battle Pass formula, Tower retry `[100, 200, 400]`
- TOWER_LEADERBOARDS sacred 3 keys (Global, PURE PATH F2P, CURRENT SEASON) — Phase 4 adds 4th additive
- TOWER_PACTS_BASE (30 pacts) + TOWER_PACTS_MYTHIC (15 seasonal)
- All 22 Reactivity Events archetype handlers, Stagger Loop state machine, 4-channel damage
- BLOCKSWORN_TREASURY_ROYALTY_BPS = 250 (Phase 4 sacred per ESC-04 Q2)

**Modifications planned next sprint: 0**

---

## 6. Architecture decisions

| ADR | Decision | Status |
|---|---|---|
| ADR-001 | Vite + Vanilla JS (no React rewrite) | Active |
| ADR-002 | Async > real-time for Party Tower | Active |
| ADR-003 | Strict no-P2W in Chia integration | Active |
| ADR-004 | Hybrid legacy + src/ coexistence (legacy = primary runtime) | Active |
| ADR-005 | Mobile feature flag for Chia (compile-time gate) | Active |

---

## 7. Open escalations (ESC)

All resolved:

| ESC | Topic | Resolution |
|---|---|---|
| ESC-01 | Node.js install on Mac | macOS .pkg installer (24.15.0) |
| ESC-02 | Phase 2 Identity Layer Q1-Q4 (race FX details) | All approved |
| ESC-03 | Phase 3 Endgame Q1-Q5 (clan size cap, replay storage, party timeout, season cadence, friend invite) | All approved |
| ESC-04 | Phase 4 Chia Q1-Q5 (Sage primary, fee schedule, Founder Badge, hybrid storage, beta gate) | All approved |

No open escalations as of 2026-05-14.

---

## 8. Bundle + performance metrics

| Metric | Target (AAA+) | Actual | Pass |
|---|---|---|---|
| First Contentful Paint p95 | <1.5s | not measured at scale (single-tester local) | TBD |
| Time to Interactive p95 | <3s | not measured | TBD |
| Vite JS+CSS bundle | <5 MB | 844 KB (94 KB gzipped) | ✅ |
| Total dist | (no hard limit) | 120 MB (audio 84 + legacy HTML 22 + images 4 + JS+CSS 0.84) | ✅ |
| FPS in battle | 60 stable | not measured at scale | TBD |
| ESLint warnings | 0 | 0 | ✅ |

Lighthouse Performance score from T1.13: **99/100** (single test). Full performance instrumentation is part of T4.11 closed beta gate.

---

## 9. Tech debt (flagged, not blocking)

See `04_RISK_REGISTER.md` for the comprehensive list. Top items:

1. **84 MB audio in repo** — should migrate to CDN (Cloudflare R2 / Cloudinary)
2. **21 MB legacy HTML as primary runtime** — sacred per ADR-004 hybrid, but full migration to modular shell (T1.13 deferred goal) is a future ~2-3 week sprint
3. **Phase 2-4 src/ modules dormant** — sidecar wiring needed (Phase 4.1 v2)
4. **Phase 3 menu UI mounts missing** — Adventures/Party Tower/Replay/Friend buttons not in legacy menu
5. **Phase 4 wallet/NFT UI mounts missing** — Connect Wallet button, NFT inventory, PURE PATH CHAIN tab not in legacy
6. **T4.07.1 live clan-backend wire-up** — DAO adapter is dependency-injected; one-line import update remains
7. **Live SDK wire-ups deferred to T4.12** — Sage SDK stubbed; live wiring at staging build
