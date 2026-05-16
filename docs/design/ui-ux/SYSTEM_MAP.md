# Blocksworm — UI System Map

**For:** Roman + UI/UX Designer + Engineering Lead during Phase 5 polish workstream
**Created:** 2026-05-16
**Maintained by:** CTO
**Purpose:** "Where does X live in the codebase?" — fastest path from a Polish Strategy bullet to the actual file + line.

> **How to use:**
> 1. Find your subsystem in §2 (Combat) / §3 (Menu) / §4 (Other).
> 2. Each subsystem lists: **legacy line numbers** (live runtime), **src/ paths** (dormant / target for migration), **CSS locations**, **sacred boundaries**.
> 3. When Roman writes implementation task: reference these anchors so Engineering Lead doesn't hunt.

---

## 1. Architecture overview

### 1.1 Two runtimes co-exist (ADR-004)

| Runtime | Status | Where | Served at |
|---|---|---|---|
| **Legacy** (21 MB single HTML) | LIVE in production | `docs/_legacy/_archive_v1/blocksworn_index_fixed.html` | `https://play.blocksworm.com/` via `vercel.json` rewrite `/` → `/blocksworn_index_fixed` |
| **Modular Vite** (94 KB gzipped) | DORMANT — Phase 2-4 features here but not user-visible | `src/` + `index.html` (Vite entry) | `/shell` route only; primary path at Phase 5 Gate 3 cutover |

**Phase 5 Gate 3 (target Week 5 end):** Vite becomes primary; legacy retired.

### 1.2 src/ top-level layout

```
src/
├── core/       (battle.js, bosses.js, damage-channels.js, ftue-state.js, grid.js,
│                heroes.js, progression.js, reactivity-events.js, stagger-loop.js)
├── data/       (assets, balance, bosses, chapters, chia-config, clan-config,
│                dao-config, elements, ftue-scripts, heroes, identity-layer,
│                monetization-config, nft-variants, party-config, races,
│                replay-config, season-config, tower)
├── feel/       (animations.js, haptics.js, identity-fx.js, narrator-lines.js,
│                narrator.js, particles.js)
├── services/   (analytics, anti-p2w-audit, clan-backend, dao-adventures,
│                feature-flags, firebase, friend-graph-backend, logger, migrate,
│                nft-backend, party-tower-backend, phase4-bridge, replay-backend,
│                revenuecat, sentry, storage, tower-season-backend, wallet-connect)
├── styles/
│   ├── tokens.css         (316 lines — design system foundation; sacred place for Designer)
│   ├── animations.css
│   ├── typography.css
│   ├── utilities.css
│   ├── reset.css
│   ├── index.css          (imports + global)
│   ├── components/
│   └── screens/           (battle.css, menu.css, shop.css, codex.css, adventures.css,
│                           party-tower.css, replay-viewer.css, tower-season.css,
│                           tower.css, profile.css, season.css, select.css, dailies.css)
└── ui/         (19 modules — see §3-§5 for per-screen map)
```

### 1.3 Render hybrid model

In legacy runtime, src/ modules are wired via **window-bridges** (e.g., `window.__getPlayerClanCount`) only where Phase 2-4 features have been integrated. The vast majority of legacy combat + menu logic lives **inline in the 21 MB HTML** — see legacy line ranges below for surgical access.

At Phase 5 cutover, the inverse becomes true: src/ is primary, legacy archived.

---

## 2. Combat Interface (Tier S priority — Roman's first polish target)

> **60-70% of player time** is on the battle screen. AAA+ feel benchmarks here are non-negotiable.

### 2.1 Battle screen container

| Layer | Location | Notes |
|---|---|---|
| Legacy DOM root | `_legacy/.../blocksworn_index_fixed.html:17033` `<div class="screen" id="screenBattle">` | All combat HUD nests inside |
| src/ orchestration | `src/ui/battle-screen.js` (375 lines) | Mostly archetype-tick stubs after Phase 1 T1.11 extraction; main render flow still in legacy |
| CSS | Legacy: lines 21-16629 (inline `<style>`); src/: `src/styles/screens/battle.css` (7061 lines — extracted in T1.06) | Most battle CSS is already in src/styles/screens/battle.css |

### 2.2 HP bar / health indicator

| Layer | Location | Sacred? |
|---|---|---|
| Render function | `_legacy/...html:65723` `function renderHP()` | NO (visual) |
| HP value | `src/data/balance.js:1` `export const MAX_HP = 100` | YES (the number) |
| CSS — current bar | Legacy `<style>` lines 1257-2048 (`§5.5 Resource bar HP + mitigation chip` + element-themed HP fill block) | NO (visual) |
| Low-HP pulse | Legacy CSS line 2020 `Low-HP state (≤25%) — pulses fill + text in critical red` | NO |
| Element-themed HP fill | Legacy CSS line 1785 `Element-themed HP fill — overrides legacy fire-only gradient` per-element via `data-element` | NO |
| 100-hearts strip (REMOVED in T1.17 — was sacred-cow ambiguous, now scaled bar) | History only — see git log T1.17 | n/a |

**Polish Strategy Tier S #1:** Replace text+heart visual with animated healthbar (Hades-style + Brawl Stars HP scroll). MAX_HP=100 stays; representation fully redesignable.

### 2.3 Pressure meter (Stagger Loop gauge — v2.1 P2)

| Layer | Location | Sacred? |
|---|---|---|
| Render function | `_legacy/...html:39691` `function renderPressureMeter()` | NO (visual) |
| Contribution per-hero | `_legacy/...html:39799` `function renderPressureContribution(hero)` | NO |
| Squad forecast | `_legacy/...html:39819` `function renderSquadPressureForecast()` | NO |
| Boss state machine | `src/core/stagger-loop.js` (Active/Stagger/Recovery) | YES (mechanic) |
| Sacred timings (stagger duration) | `src/core/stagger-loop.js` `STAGGER_DURATION_TURNS=4`, `RECOVERY_DURATION_TURNS=2` | YES |
| CSS | Legacy `<style>` line 1911 `⚡ Incoming attack — pink animated pulse`; line 1015 `§4.3 — Stagger entry FX: gold flash overlay` | NO |

**Polish Strategy Tier S #2:** Visually distinct gauge (Sekiro posture / Sifu structure reference). Stagger threshold indicator. Threshold values mechanically fixed; meter UI fully redesignable.

### 2.4 Damage numbers (4-channel system — v2.1 P1)

| Layer | Location | Sacred? |
|---|---|---|
| Current rendering | inline within `_legacy/...html` battle screen render path; no dedicated `renderDmgNum` function (search returns 0) | NO (visual) |
| Damage channels (DEAD_ZONE / VOID / SIGNATURE / GRID_SATURATION) | `src/core/damage-channels.js` | YES (mechanic) |
| Combo crit formula | `_legacy/...html:64005` (line verified in REPORT-32 Phase 2 sacred audit); also derived in `src/core/battle.js` | YES — byte-perfect |
| CSS | Legacy `<style>` line 1296 `Spec §4.4: hide damage on width <380` (iPhone SE narrow) | NO |

**Polish Strategy Tier S #3:** Animated float-up + crit emphasis + per-channel color coding. Channels are mechanical (sacred); their colors are part of design system (Designer's call within accessibility constraints).

### 2.5 Turn / round indicator

| Layer | Location | Sacred? |
|---|---|---|
| Current rendering | inline in legacy battle render; emoji `TURN N` text | NO |
| Top bar CSS | Legacy `<style>` line 832 `Spec: §4 — 40px sticky row. Carries hearts + turn + damage + ⚙` | NO |
| Phase indicator | `_legacy/...html:28281` `function renderBossPhaseIndicator()` | NO (visual) |
| TTK forecast | `_legacy/...html:28373` `function renderSquadTTKForecast()` | NO (visual; TTK formula sacred) |

**Polish Strategy Tier S not separately listed** — bundle with boss panel work (#2.6).

### 2.6 Boss panel (per-archetype identity — ties Phase 2 Identity Layer)

| Layer | Location | Sacred? |
|---|---|---|
| Boss image | `_legacy/...html:17094` `<img id="bossImg" alt="">` | NO (asset swap OK) |
| Boss state banner | `_legacy/...html:39713` `function renderBossStateBanner()` | NO |
| Boss phase indicator | `_legacy/...html:28281` `renderBossPhaseIndicator()` | NO |
| Boss HP | inline within `renderHP()` and boss-area DOM | NO |
| Phase 2 reactivity handlers (5 bosses) | `src/core/reactivity-events.js` + `src/data/identity-layer.js` | YES (22 v2.1 P4 handlers byte-perfect) |
| Boss-reactive FX overlays | `src/feel/identity-fx.js` (`fxLichCursedTilesTick`, Phoenix Ashen Reign, etc) | YES (mechanic) — visual representation OK |
| CSS — boss portrait phase glow | Legacy `<style>` line 1810 `Phase glow on boss portrait — JS adds .phase-2 / .phase-3 class` | NO |
| CSS — boss details modal | `src/styles/screens/battle.css:280` `.boss-details-modal` | NO |
| Boss roster (in code) | 5 bosses: **phoenix, lich, berserker, engineer, grovewarden** per `src/data/bosses.js` + `src/data/identity-layer.js` | n/a |

**Polish Strategy Tier S #9:** Phoenix glow ≠ Lich shadow ≠ Berserker pulse ≠ Engineer grid ≠ Grovewarden roots. Each archetype gets distinct visual identity. **Mechanic handlers UNTOUCHABLE; visual overlay/glow/color fully designable.**

### 2.7 Hero panel / squad UI

| Layer | Location | Sacred? |
|---|---|---|
| Hero card inventory render | `_legacy/...html:43290` `function renderHeroCardInventory()` | NO (visual) |
| Hero card status panel | `_legacy/...html:43477` `function renderHeroCardStatusPanel(hero)` | NO |
| Hero detail (lore, stats, tiers) | `_legacy/...html:70208` lore / `:70340` stats / `:70834` tiers | NO |
| Hero mitigation badges | `_legacy/...html:70456` `function renderHeroCardMitBadges()` | NO |
| Hero data | `src/data/heroes.js` (HERO_ROSTER + TIER_COSTS_V18 + HERO_ULT_COST_BY_NEWROLE + HERO_TIER_ABILITIES) | **YES — all 4 are sacred** |
| Squad dock (menu side) | `src/ui/menu.js:400` `export function vRenderSquadDock()` | NO (visual) |
| CSS — role icon top-left corner | Legacy `<style>` line 1705 `Role icon in top-LEFT corner (spec §6.3)` | NO |
| CSS — empty squad slot placeholder | Legacy `<style>` line 1769 `Placeholder slot for empty squad positions (squad < SQUAD_MAX)` | NO |

**Polish Strategy Tier S #7:** Tier states (T1/T2/T3/Mythic) need clear visual differentiation. Mythic ascension deserves ceremony (separate Tier S #8 — see §4.X below).

### 2.8 Primary CTAs (BATTLE / ATTACK / ULT / RETRY)

| CTA | Location | Sacred? |
|---|---|---|
| `▶ BATTLE` button (menu) | `_legacy/...html:16767` `<span>▶ BATTLE</span>` | NO (visual) |
| Emergency ULT button | `_legacy/...html:27188` `function renderEmergencyUltButton()` | NO |
| ULT cost per role | `src/data/heroes.js` `HERO_ULT_COST_BY_NEWROLE` (warrior:80, mage:100, hunter:120, tank:80, captain:100) | YES |
| Tower retry gem ladder | `src/data/monetization-config.js` `TOWER_RETRY_GEM_LADDER = [100, 200, 400]` | YES |

**Polish Strategy Tier S #5:** AAA+ feel for primary CTAs — Marvel Snap-grade satisfying press, distinct visual hierarchy. **Numbers stay; button visual fully redesignable.**

### 2.9 Board / grid

| Layer | Location | Sacred? |
|---|---|---|
| Grid logic | `src/core/grid.js` | YES (board state correctness) |
| Cell render | inline in legacy battle screen | NO (visual) |
| Cell size token | `src/styles/tokens.css` `--cell-size` (auto-calculated) | NO |
| Grid auto-scaling | tokens.css line 23+ `width: min(100%, calc(100dvh - 480px))` + `aspect-ratio: 1/1` "proven layout — kept untouched" | NO (but careful — layout is fragile) |

### 2.10 Pieces / drag-drop

| Layer | Location | Sacred? |
|---|---|---|
| Piece logic | inline in legacy battle script section | NO (visual + interaction) |
| Drag-ghost size token | `src/styles/tokens.css` `--cell-size` consumed | NO |

### 2.11 Particles + line-clear FX

| Layer | Location | Sacred? |
|---|---|---|
| Burst function | `src/feel/animations.js:43` `vPlayLineClearBurst(rows, cols)` (extracted T1.09) | YES (particle direction toward bossImg + timing) |
| Legacy mirror | `_legacy/...html:67539` same function (byte-perfect) | YES |
| Particles helper | `src/feel/particles.js` | YES (per CLAUDE.md §2.2) |

**Polish Strategy Tier S not separately listed; bundled in Tier S #2 (damage numbers) — channel color may flow through particles.** Particle direction toward boss = sacred; particle visual style = designable.

### 2.12 Crit flash + shake (sacred timings)

| Layer | Location | Sacred? |
|---|---|---|
| Crit flash function | `src/feel/animations.js:88` `vPlayCritFlash()` — **180ms flash, 440ms shake** | YES — byte-perfect |
| Legacy mirror | `_legacy/...html:67583` `function vPlayCritFlash()` | YES |
| CSS classes | `.v-fx-crit-flash`, `.v-fx-shake` in legacy `<style>` | NO (style of the flash) |

**Designer constraint:** the **180ms** and **440ms** durations cannot change. The *visual content* of the flash (color, opacity curve, layered text-shadow) may change.

### 2.13 Boss death cinematic (sacred 5-beat sequence)

| Layer | Location | Sacred? |
|---|---|---|
| Function | `src/feel/animations.js:104` `vPlayBossDieFx()` — 5 beats at 0/300/260+220/?/420ms | YES — byte-perfect |
| Legacy mirror | `_legacy/...html:67599` same function | YES |
| Comments documenting sequence | `src/feel/animations.js:11-17` (full beat documentation) | YES |
| Cleanup | `src/feel/animations.js:159` `vCleanupBossDeathFx()` | YES |
| Voidfang bespoke 5-beat (different sequence for one specific boss) | `_legacy/...html:58175` `V3.0 Phase 6 Block 6.3: Voidfang bespoke 5-beat defeat sequence` | YES |

**Beat timings (DO NOT CHANGE):**
- Beat 0 (haptic + shake): synchronous + 440ms shake removal
- Beat 1 (hit-pause): add class, remove at 300ms
- Beat 2 (white flash): fire at 260ms, flash element auto-remove at +220ms
- Beat 3: (intermediate)
- Beat 4 (slow zoom): fire at 420ms (zoom class held until vCleanupBossDeathFx)

Designer can change the *content* of each beat (what the player sees during the flash, the shake amplitude curve, the zoom target) — not the *durations*.

### 2.14 Element synergy indicators (2x / 3x / 5x)

| Layer | Location | Sacred? |
|---|---|---|
| Synergy bar render | `_legacy/...html:64850` `function renderSynergyBar()` | NO (visual) |
| Synergy info modal | `_legacy/...html:70902` `function renderSynergyInfo()` | NO |
| Synergy mechanical values | `src/data/identity-layer.js` `RACE_SYNERGY` per-tier | YES (2x = -2 ULT threshold; 3x = -4 ULT + 20% passive; 5x = -6 ULT + 50% dmg + 30% start charge) |
| Element synergy bonus animation | Legacy `<style>` line 1926 `✨ player synergy — green` | NO |
| Per-element color palette | tokens.css lines 219-235 (--a-ember/tide/grove/solar/umbra + light/dark variants) | NO (Designer extends) |
| 5 element keys in code | `src/data/elements.js`: **ember, tide, grove, solar, umbra** | n/a (semantic) |

### 2.15 Identity Layer FX (Phase 2 — race line-clear + boss-reactive)

| Layer | Location | Sacred? |
|---|---|---|
| All 6 race line-clear flavors | `src/feel/identity-fx.js` (`fxPirateLineClear`, `fxSharkLineClear`, `fxRockLineClear`, `fxCrocodile*`, `fxSpark*`, plus grove ROOT_SURGE) | YES (mechanic contracts) |
| All 5 boss-reactive handlers | `src/feel/identity-fx.js` (`fxLichCursedTilesTick`, Phoenix Ashen Reign, Berserker Bloodtide, Engineer Lockdown, Grovewarden Root Surge) | YES (mechanic) — visual representation OK |
| Race roster (display) | pirate, shark, rock, crocodile (croc), spark, grove | n/a |
| Race roster (internal — RACE_SYNERGY keys) | pirate, shark, golem, lion, troll | n/a — **art folder `race emblems/` uses these internal names; Designer audit verifies mapping** |
| Codex moments recording (visual catalog) | `src/ui/codex.js:279` `recordMomentTrigger(momentKey)` + `:320` `recordMomentReplay(momentKey, replayId)` | NO |

**ROOT_SURGE_OVERLAY_COLOR `#2D8659`** is hard-coded in `src/data/identity-layer.js:853` with comment: "mossy green — distinct from purple curse (Lich) / cyan bite (Shark) / red pulse (Berserker) / copper lockdown (Engineer) / orange flame (Phoenix)". **This is the existing per-boss color language** — Designer either preserves or extends, but should know it.

---

## 3. Menu / hub screens

### 3.1 Screen container map (legacy DOM order)

| Screen | Legacy line | src/ UI module | src/ CSS |
|---|---|---|---|
| `#screenMenu` (home hub) | `16634` | `src/ui/menu.js` (475 lines) | `src/styles/screens/menu.css` (2494 lines) |
| `#screenProfile` | `16854` | `src/ui/profile.js` (177 lines) | `src/styles/screens/profile.css` |
| `#screenSelect` (squad selection) | `16941` | `src/ui/select.js` (referenced via router) | `src/styles/screens/select.css` |
| `#screenBattle` | `17033` | `src/ui/battle-screen.js` (orchestration; main render in legacy) | `src/styles/screens/battle.css` (7061 lines) |
| `#screenShop` | `17279` | `src/ui/shop.js` (609 lines) | `src/styles/screens/shop.css` |
| `#screenDailies` | `17310` | `src/ui/dailies.js` | `src/styles/screens/dailies.css` |
| `#screenTower` | `17347` | `src/ui/tower.js` | `src/styles/screens/tower.css` |
| `#screenSeason` (Battle Pass) | `17503` | `src/ui/season.js` (235 lines) | `src/styles/screens/season.css` |

### 3.2 Home hub (Polish Strategy Tier A #11)

| Element | Location | Sacred? |
|---|---|---|
| Top bar (`<button class="a-hub-burger">☰</button>`) | `_legacy/...html:16654` | NO |
| Drawer entries | `src/ui/menu.js`: `vRenderCodexDrawerEntry` (:444), `vRenderAdventuresDrawerEntry` (:495), `vRenderPartyTowerDrawerEntry` (:563), `vRenderTowerSeasonDrawerEntry` (:606), `vRenderFriendLeaderboardMount` (:649) | NO |
| `▶ BATTLE` CTA | `_legacy/...html:16767` `<span>▶ BATTLE</span>` (the primary action) | NO |
| Daily badge | `_legacy/...html:26649` `function updateDailyButtonBadge()` | NO |
| Battle Pass button (`✦ BATTLE PASS`) | `_legacy/...html:16803` | NO |
| Resource bar | `src/ui/menu.js:64` `export function renderResourceBar()` | NO (visual); resources are sacred (gems, hearts, cristals) |
| Topbar | `src/ui/menu.js:219` `export function vRenderTopbar()` | NO |
| What's New banner | `src/ui/menu.js:273` `vRenderWhatsNew()` | NO |
| Chapter selector | `src/ui/menu.js:289` `vRenderChapter()` | NO |
| Boss card preview | `src/ui/menu.js:357` `vRenderBossCard()` | NO |
| Memorials (active in T1.15 P6.F system) | `_legacy/...html:44772` `function renderHomeScreenMemorials()` | NO |

### 3.3 Shop (Polish Strategy Tier A #12)

| Element | Location | Sacred? |
|---|---|---|
| Shop screen container | `_legacy/...html:17279` | n/a |
| Shop pack render (modular) | `src/ui/shop.js:140` `export function renderShopPacks()` | NO (visual); GEM_PACKS data sacred |
| Legacy shop render | `_legacy/...html:23496` `function renderShopPacks()` | NO |
| Pack card markup | `_legacy/...html:22907` `.pack-card` template | NO |
| GEM_PACKS data | `src/data/monetization-config.js` (6 SKUs $0.99/$4.99/$9.99/$19.99/$49.99/$99.99 with +0/+0/+10%/+15%/+20% MEGA/+30% WHALE bonuses) | **YES — byte-perfect** |
| Battle Pass formula | `src/data/monetization-config.js` `battlePassXpForTier = tier => 500 + (tier-1) * 150` | YES (ESC-02 Roman ruling confirms tier-1) |
| First Purchase Bonus copy | Legacy inline (+50% gems + 1 Hero Card + Founder Badge) | YES (the literal copy) |
| RevenueCat IAP service | `src/services/revenuecat.js` | n/a (placeholder keys; live at T5.18) |

### 3.4 Settings menu (Polish Strategy Tier A #15)

| Element | Location | Sacred? |
|---|---|---|
| Overlay container | `_legacy/...html:16817` `<div class="settings-menu-overlay" id="mainMenuSettingsOverlay">` | NO |
| Menu items DOM | `_legacy/...html:16818-...` with hardcoded `🔊 Audio`, `↻ Restore Purchases`, `⚠ Reset All Progression` | NO |
| Modular CSS | `src/styles/screens/menu.css:35-160` `.settings-menu-overlay`, `.settings-menu`, `.settings-menu-header`, `.settings-menu-item`, etc. | NO |
| Accessibility toggles (colorblind, reduce motion) | settings sub-modals (`audioSettingsModal:17703`, etc.) | NO (visual); CLAUDE.md §3 AAA+ accessibility = required compliance |

### 3.5 Tower screen (Polish Strategy Tier A #13)

| Element | Location | Sacred? |
|---|---|---|
| Container | `_legacy/...html:17347` `#screenTower` | n/a |
| Render | `_legacy/...html:32673` `function renderTowerScreen()` | NO |
| Active pacts panel | `_legacy/...html:49784` `function renderActivePactsPanel()` | NO |
| Tower mode banner | `_legacy/...html:29331` `function renderTowerModeBanner()` | NO |
| Tower button visibility (lock state) | `_legacy/...html:33303` `function updateTowerButtonVisibility()` | NO |
| Achievements modal | `_legacy/...html:32887` `function renderAchievementsModal()` | NO |
| Heart modal (Tower currency) | `_legacy/...html:32941` `function renderHeartModal()` | NO |
| Pacts data (sacred) | `src/data/tower.js` `TOWER_PACTS_BASE=30`, `TOWER_PACTS_MYTHIC=15` | **YES — frozen** |
| TOWER_LEADERBOARDS 3 keys | `src/data/tower.js` (Global/F2P/Weekly) | **YES — sacred** |
| Tower retry ladder | `src/data/monetization-config.js` `[100, 200, 400]` | **YES** |
| Uroboros seasonal boss | `src/data/season-config.js` UROBOROS_VARIANTS | YES (mechanic) |

### 3.6 Battle Pass / Season screen (Polish Strategy Tier A #14)

| Element | Location | Sacred? |
|---|---|---|
| Container | `_legacy/...html:17503` `#screenSeason` | n/a |
| Render | `_legacy/...html:37999` `function renderSeasonScreen()` + `src/ui/season.js:62` `renderSeasonScreen()` (modular mirror) | NO |
| Season button visibility | `_legacy/...html:38160` `function updateSeasonButtonVisibility()` | NO |
| BP formula | `src/data/monetization-config.js` `battlePassXpForTier` | YES |

### 3.7 Profile screen (Polish Strategy not separately listed; Tier B candidate)

| Element | Location |
|---|---|
| Profile container | `_legacy/...html:16854` `#screenProfile` |
| Modular render | `src/ui/profile.js:65` `renderProfile()` |
| Legacy renderProfile | `_legacy/...html:36269` `function renderProfile()` |
| Tabs (Social/Roster/Achievements/Journey/Tower/Stats) | `_legacy/...html:36643-37432` (renderProfileTab + 6 sub-renderers) |
| Cosmetic grid | `_legacy/...html:44405` `function renderCosmeticGrid(category)` |
| Hero card UI (cosmetics) | `_legacy/...html:43290` |

### 3.8 Bottom nav + drawer

| Element | Location |
|---|---|
| Hamburger trigger | `_legacy/...html:16654` `<button class="a-hub-burger" onclick="aOpenHubDrawer()">☰</button>` |
| Tower nav button (with lock badge) | `_legacy/...html:16779` `<button class="v-nav-item" data-nav="tower" id="navTowerBtn" onclick="goToTower()">` |
| Drawer entries (Codex/Adventures/Party Tower/Tower Season/Friend LB) | `src/ui/menu.js:444-700` |

---

## 4. Other blocks (FTUE / Phase 2-4 / dormant features)

### 4.1 FTUE Chronicler intro (Polish Strategy Tier S #6)

| Element | Location | Sacred? |
|---|---|---|
| Intro video overlay | `_legacy/...html:18053` `<div id="introVideoOverlay">` (currently suppressed via `localStorage.seenIntroVideo='1'` seed) | NO |
| Dialog overlay | `_legacy/...html:18070` `<div id="dialogOverlay">` | NO |
| Chronicler dialog script playback | `_legacy/...html:24334` `playDialogScript(FTUE_SCRIPTS.chronicle_intro, startChronicleFtueBattle)` | NO |
| Chronicler dialog text | `_legacy/...html:24732-24745` `chronicle_intro` + `chronicle_outro` arrays | **YES — sacred Narrator voice** |
| Show Chronicler dialog | `_legacy/...html:48415` `function showChroniclerDialog(text, options)` | NO |
| Modular dialog system | `src/ui/dialog.js:326` `export function playDialogScript(lines, onComplete)` + 9 other exports | NO |
| Narrator | `src/feel/narrator.js` (`speakNarrator`) | YES (sacred function + sacred NARRATOR_LINES) |
| Narrator lines | `src/feel/narrator-lines.js` + legacy `:66747` `function speakNarrator(trigger)` | **YES — byte-perfect strings** |
| FTUE scripts data | `src/data/ftue-scripts.js` | **YES — narrator copy literal** |

**Polish Strategy Tier S #6:** Cinematic typography pacing, atmospheric visual layer. **Sacred strings preserved; pacing of the TYPEWRITER effect is sacred** (per CLAUDE.md §2.3); ambient visual layer fully new.

### 4.2 Codex (Phase 2 — dormant but code-complete)

| Element | Location |
|---|---|
| Codex UI | `src/ui/codex.js` (803 lines, 8+ exports) |
| Codex state | `src/ui/codex.js:167` `getCodexState()`, `:199` `saveCodexState()` |
| Race/boss/moment recording | `:229` `recordRaceTrigger`, `:247` `recordBossEncounter`, `:261` `recordBossDefeat`, `:279` `recordMomentTrigger`, `:320` `recordMomentReplay` |
| CSS | `src/styles/screens/codex.css` |
| Drawer entry mount point | `src/ui/menu.js:444` `vRenderCodexDrawerEntry()` |
| Status | Dormant in legacy; visible via Vite shell `/shell` route only |

### 4.3 Adventures (Phase 3 — dormant, 5-15 player async clan)

| Element | Location |
|---|---|
| UI | `src/ui/adventures.js` (1473 lines, 8 exports) |
| Backend | `src/services/clan-backend.js` |
| CSS | `src/styles/screens/adventures.css` |
| Drawer entry | `src/ui/menu.js:495` `vRenderAdventuresDrawerEntry` + `:531` `_refreshAdventuresBadge(btn)` |
| Player clan count window-bridge | `window.__getPlayerClanCount` (single minimal bridge per Phase 3 discipline) |
| Status | Stub mode in live; full Firebase wire-up at Phase 5 Week 6-8 (T5.19) |

### 4.4 Party Tower (Phase 3 — dormant, 2-5 player coop)

| Element | Location |
|---|---|
| UI | `src/ui/party-tower.js` (1073 lines, 8 exports incl. `renderCreatePartyModal`) |
| Backend | `src/services/party-tower-backend.js` |
| CSS | `src/styles/screens/party-tower.css` |
| Drawer entry | `src/ui/menu.js:563` `vRenderPartyTowerDrawerEntry` |
| Sacred timeouts (ESC-03 Q3 ruling) | `src/data/party-config.js`: Competitive 4h / Standard 24h (default) / Casual 7d |
| Status | Stub mode in live; full Firebase wire-up at T5.19 |

### 4.5 Replay viewer (Phase 3 — dormant)

| Element | Location |
|---|---|
| UI | `src/ui/replay-viewer.js` (759 lines) |
| Backend | `src/services/replay-backend.js` |
| CSS | `src/styles/screens/replay-viewer.css` |
| Frame renderer (canvas 4fps) | `src/ui/replay-viewer.js:216` `renderFrameToCanvas(frame, ctx, canvasPx)` |
| Deeplink | `?replay=<id>` route via `src/main.js` (Phase 5 wires into legacy too) |
| Codex Moments → Replay bridge | `src/ui/codex.js:320` `recordMomentReplay(momentKey, replayId)` |
| Status | Dormant in legacy |

### 4.6 Friend leaderboard (Phase 3 — dormant)

| Element | Location |
|---|---|
| UI | `src/ui/friend-leaderboard.js` (452 lines) |
| Backend | `src/services/friend-graph-backend.js` |
| Mount point on menu | `src/ui/menu.js:649` `vRenderFriendLeaderboardMount()` |
| Sacred TOWER_LEADERBOARDS 3 keys | `src/data/tower.js` — UNTOUCHED; friend LB is parallel widget |
| ADR-003 anti-P2W | totalSpend field DISCARDED from aggregation (sort by `currentTowerFloor` only) |
| Status | Dormant; full wire-up at T5.19 (clan members live + season top-10 overlap auto-friending) |

### 4.7 Tower Seasonal (Phase 3 — dormant, 13-week rotation)

| Element | Location |
|---|---|
| UI | `src/ui/tower-season.js` (677 lines) |
| Backend | `src/services/tower-season-backend.js` |
| CSS | `src/styles/screens/tower-season.css` |
| Drawer entry | `src/ui/menu.js:606` `vRenderTowerSeasonDrawerEntry` |
| Seasonal pacts (Season 1: COSMIC CLARITY / ETERNAL RECALL / SERPENT BLESSING) | `src/data/season-config.js` |
| 4 Uroboros variants | `src/data/season-config.js` UROBOROS_VARIANTS |
| Battle Pass tier-cosmetic display | `src/ui/tower-season.js:529` `renderBattlePassWidget` |

### 4.8 Phase 4 dormant features (Wallet / NFT / DAO / PURE PATH CHAIN)

| Feature | UI | Service | Status |
|---|---|---|---|
| Sage Wallet | UI mount point TBD (T5.20 wire-up) | `src/services/wallet-connect.js` (340 lines) | Stubbed; live SDK at T5.20 |
| NFT mint/transfer/2.5% royalty | UI mount TBD | `src/services/nft-backend.js` (929 lines) | `BLOCKSWORN_TREASURY_ROYALTY_BPS=250` byte-perfect |
| Adventure DAO | UI mount TBD (overlays Adventures screen) | `src/services/dao-adventures.js` (843 lines) | 13 forbidden proposal types blocked; ADR-003 audit clean |
| PURE PATH CHAIN leaderboard tab | `src/ui/tower-leaderboard-chain.js` (203 lines) | n/a | 4th column additive to sacred 3 |
| Anti-P2W audit | Dashboard UI TBD (T5.21) | `src/services/anti-p2w-audit.js` (337 lines) | T4.10 statistical parity audit; sacred-cow ENFORCEMENT layer |
| Mobile feature flag | n/a | `src/services/feature-flags.js` `isChiaEnabled()` | 55 call-sites in src/; defaults false on web |
| Phase 4 bridge | n/a | `src/services/phase4-bridge.js` (257 lines) | 22 window-namespaced surfaces |

---

## 5. Asset inventories

### 5.1 Already-bundled icons (`public/assets/icons/`)

```
class_captain_emblem.png    ✓ aligned to code role
class_hunter_emblem.png     ✓
class_mage_emblem.png       ✓
class_tank_emblem.png       ✓
class_warrior_emblem.png    ✓ — all 5 class emblems present
coin.png                    ✓ currency
cristal.png                 ✓ currency
energy.png                  ✓ currency
race_dark_elf_race.png      ⚠ not in code roster
race_elf_race.png           ⚠ not in code roster
race_golem_race.png         ✓ — internal name for crocodile/rock-family race
race_human_race.png         ⚠ not in code roster
race_lion_race.png          ✓ — internal name for spark race
race_orc_race.png           ⚠ not in code roster
race_pirate_race.png        ✓ — primary
race_rock_race.png          ✓ — display name for rock race
race_skelet_race.png        ⚠ not in code roster (maybe lich-flavor?)
race_troll_race.png         ✓ — internal name for grove race
```

**Status:** 13 of 18 align (5 class + 3 currency + 5 race usable). 5 race emblems (dark elf, elf, human, orc, skelet) are unused per current code roster; Designer audits whether to repurpose or remove.

### 5.2 Audio (`public/assets/audio/music/`)

```
menu.mp3            menu theme
boss fight.mp3      generic boss combat
chapter 2.mp3       chapter theme
cosmic.mp3
royal.mp3
tower.mp3
phoenix boss.mp3    ✓ aligned (Phase 2 boss-reactive #1)
lich boss.mp3       ✓ aligned (Phase 2 boss-reactive #2)
trent boss.mp3      ✓ aligned (grove/grovewarden — "trent" is internal name for grovewarden archetype)
kraken boss.mp3     ⚠ no kraken in current 5-boss roster
win.mp3 / lose.mp3
```

**Missing for full Phase 2 coverage:** berserker boss.mp3, engineer boss.mp3 (2 of 5 boss-reactive bosses lack themed tracks). Designer / audio direction decision: either commission OR map to existing tracks.

### 5.3 External library (`/Users/rm/Downloads/game/` — 356 MB, Roman 2026-05-16 disclosure)

Pre-audit summary (TASK-UX-002 confirms or revises):

| Folder | Pre-audit verdict | Refinement post-investigation |
|---|---|---|
| `ingame_icons_cropped/set2_*.png` | REUSE-DIRECT | ✓ Confirmed — ember/tide/grove/solar/umbra emblems + 8-12 UI icons align with code element keys |
| `ingame_icons_cropped/set1_*.png` | REUSE-DIRECT | ✓ Confirmed — generic UI baseline |
| `race emblems/` | Originally flagged DISCARD | ✓ **Partially aligned** — pirate/rock/golem/lion/troll/skelet match RACE_SYNERGY internal names; elf/dark elf/human/orc unused. Designer decides keep vs prune. |
| `elements emblems/` | Originally flagged DISCARD | ✓ **Functionally aligned** — dark/earth/fire/light/water = umbra/grove/ember/solar/tide (1:1 rename). Designer chooses naming scheme. |
| `boss emblems/`, `boss/`, `new boss/`, `Game bosses/` | Audit | Cross-check against code: **phoenix, lich, berserker, engineer, grovewarden** (5 core) + uroboros variants. Plus 25 chapter-finale bosses across 5 chapters. |
| `chapter emblems/` | Audit | Code chapters per `src/data/chapters.js` — verify count matches |
| `class emblem/` | Likely REUSE | 5 class emblems already in `public/assets/icons/`; this folder may be source |
| `Modifications emblems/`, `Armor/` | Audit | Tier 1-4 + Mythic visual differentiation possibilities |
| `energy.png`, `cristal.png`, `coin.png` | REUSE | Already in `public/assets/icons/` |

---

## 6. Sacred values quick-reference (CLAUDE.md §2 verbatim, with grep evidence)

| Sacred | File:line | Verified value |
|---|---|---|
| V_HAPTICS | `src/feel/haptics.js:13` | `Object.freeze({tap:10, place:15, clear:25, hit:30, crit:[30,20,30], levelup:[20,30,40], rareDrop:[40,40,40], victory:[100,50,100,50,200], defeat:[200]})` |
| Crit flash timing | `src/feel/animations.js:92` | 180ms |
| Crit shake timing | `src/feel/animations.js:99` | 440ms |
| 5-beat boss death | `src/feel/animations.js:104` (function start) + `:11-17` (doc) | 5 beats at synchronous / 300ms / 260+220 / / 420ms |
| MAX_HP | `src/data/balance.js:1` | 100 |
| TIER_COSTS_V18 | `src/data/heroes.js` | `{1:1, 2:2, 3:3, 4:5}` |
| HERO_ULT_COST_BY_NEWROLE | `src/data/heroes.js` | `{warrior:80, mage:100, hunter:120, tank:80, captain:100}` |
| BOSS_TTK_TARGETS | `src/data/bosses.js` | `{tutorial:240, gatekeeper:360, mid_act:420, act_boss:480, chapter_finale:540}` |
| GEM_PACKS prices | `src/data/monetization-config.js` | `[$0.99, $4.99, $9.99, $19.99, $49.99, $99.99]` with `[+0, +0, +10%, +15%, +20% MEGA, +30% WHALE]` bonuses |
| Battle Pass formula | `src/data/monetization-config.js` | `battlePassXpForTier = tier => 500 + (tier-1) * 150` (ESC-02 Roman ruling) |
| Tower retry ladder | `src/data/monetization-config.js` | `TOWER_RETRY_GEM_LADDER = [100, 200, 400]` |
| TOWER_PACTS_BASE | `src/data/tower.js` | 30 |
| TOWER_PACTS_MYTHIC | `src/data/tower.js` | 15 |
| TOWER_LEADERBOARDS keys | `src/data/tower.js` | 3 sacred (Global / F2P / Weekly) |
| PURE PATH eligibility | `src/data/tower.js` | `totalSpent === 0` (F2P-only) |
| NARRATOR_LINES | `src/feel/narrator-lines.js` + legacy `:66747` | byte-perfect strings, full poetic catalog |
| FTUE Chronicle dialog | `src/data/ftue-scripts.js` + legacy `:24732-24745` | `chronicle_intro` + `chronicle_outro` literal |
| Royalty BPS | `src/services/nft-backend.js` | `BLOCKSWORN_TREASURY_ROYALTY_BPS = 250` (2.5% — ESC-04 Q2) |

---

## 7. Emoji audit — 22 to replace (Polish Strategy §2.3, grep-verified)

| Emoji | Replacement target | Where used in legacy (sample line) | Replacement candidate from existing assets |
|---|---|---|---|
| ☰ | Hamburger menu | `16654` `class="a-hub-burger"` | `ingame_icons_cropped/set1_arrow_back.png` (similar style baseline) — Designer creates dedicated |
| ⚙ | Settings | `14174` CSS `content: '⚙'`; many sites | Designer creates |
| ❤ | HP indicator | `65723` `renderHP()` + CSS line 1974 | Designer creates as part of animated healthbar |
| 🛡 | Shield / mitigation | `src/ui/archetype-ticks.js:211` flashText + many sites | `ingame_icons_cropped/set1_shield_mitigation.png` ✓ exists |
| 🔊 | Audio | `16825` settings menu | Designer creates |
| 📅 | Daily | `16748`, `16798` daily nav | Designer creates |
| ✦ | Battle Pass / Mythic | `9322`, `9370`, `16803` `✦ BATTLE PASS` | Thematically works; designer stylizes |
| ✨ | Coming soon / synergy | line 1926 CSS `✨ player synergy — green` | Replace or stylize (synergy use is meaningful; coming-soon is temp) |
| 📚 | Codex | drawer entry | `ingame_icons_cropped/set1_book_codex.png` ✓ exists |
| 🗼 | Tower | nav | Designer creates (signature element — careful) |
| ⚔ | Battle | nav | `ingame_icons_cropped/set1_sword.png` ✓ exists |
| 🏆 | Achievement | profile tab | `ingame_icons_cropped/set1_trophy_achievement.png` ✓ exists |
| 👤 | Profile | nav | Designer creates |
| 👥 | Roster / Social | profile / clan | `ingame_icons_cropped/set2_heroes_squad.png` ✓ exists |
| 📊 | Stats | profile | `ingame_icons_cropped/set1_barchart_stats.png` ✓ exists |
| 🗺 | Journey | profile | Designer creates |
| 🔍 | Search | various | `ingame_icons_cropped/set1_magnifier.png` ✓ exists |
| ↕ | Sort | various | Designer creates / system-OK |
| ⚡ | Pressure / ULT | line 1911 CSS + many flashText sites | `ingame_icons_cropped/set2_lightning_energy.png` ✓ exists (rename: energy?) |
| ⭐ | Star / Seasonal | season screen | `ingame_icons_cropped/set2_star_favorite.png` ✓ exists |
| ♥ | Tower Hearts (different from HP ❤) | tower retry modal | Designer creates (distinct from HP) |
| ▶ | Play CTA | `16767` `▶ BATTLE` + many | Designer creates (signature button — most important) |
| ▲ | Up / Floor | various | system-OK or Designer |

**Pre-audit coverage:** ~10-11 of 22 emojis have existing icon counterparts in `ingame_icons_cropped/set1_*` or `set2_*`. Designer creates the remaining ~11-12 in consistent style. Reduces Polish Strategy §7 estimate ~25%.

---

## 8. CSS architecture for Designer's tokens

### 8.1 Existing `src/styles/tokens.css` foundation (316 lines)

Already includes:
- Viewport tokens (`--viewport-height`, `--small/large-viewport-height`)
- Safe-area tokens (`--safe-area-top/bottom/left/right` from `env(safe-area-inset-*)`)
- Cell-size token (`--cell-size` auto-calculated)
- Background palette (`--a-bg-deepest/base/surface/elevated/well`)
- Element palette (`--a-ember/tide/grove/solar/umbra` + `-lt` light + `-dk` dark variants)
- Text palette (`--a-text-primary/gold/secondary/muted/disabled`)

Designer extends this file as part of TASK-UX-003 (design system foundational decisions). **Anything Designer adds lands here as `--a-*` or new prefix** — single source of truth.

### 8.2 Per-screen CSS files (13 in `src/styles/screens/`)

Already extracted from legacy in T1.06. Designer adds new selectors to these files; Engineering Lead integrates per Designer's spec.

### 8.3 Animations CSS (`src/styles/animations.css`)

For NEW animations (healthbar pulse, damage number float, CTA press). Existing sacred animations (crit flash, boss death cinematic, line clear burst) stay in legacy + `src/feel/animations.js` — these are mechanical-coupled.

---

## 9. Workflow recommendation

**When Roman writes a polish task to me:**

1. **Identify the subsystem** — find it in §2 / §3 / §4 of this doc.
2. **Note all 3 layers** in the task brief:
   - Legacy line(s) to modify (current live runtime)
   - src/ file(s) to modify (will become primary at Phase 5 Gate 3)
   - CSS file (legacy inline `<style>` + `src/styles/screens/*.css`)
3. **Cross-reference sacred boundaries** — paste relevant §6 entries into the task's DO-NOT-TOUCH list
4. **Cite asset availability** — if §5 says an icon exists, reference it; otherwise flag for Designer creation

**Example task brief format:**

```
TASK-XXX — Polish Combat HP indicator

Spec: Designer Figma file `Blocksworm Tier S Specs / Battle / HP`
Visual change: animated healthbar replacing `100/100 ❤` text + low-HP pulse + heal flash
Files to modify:
  - Legacy: `_legacy/.../blocksworn_index_fixed.html` line 65723 (renderHP function)
            + CSS lines 1974-2048 (`§5.5 Resource bar HP` + `Low-HP state`)
  - src/: `src/ui/menu.js:64` renderResourceBar consumer + future src/ui/battle-hud.js
  - CSS: `src/styles/screens/battle.css` (extend; add new selectors)
  - Tokens: extend `src/styles/tokens.css` with `--a-hp-fill-gradient` etc per Designer spec
DO NOT TOUCH:
  - MAX_HP = 100 (src/data/balance.js:1)
  - V_HAPTICS.hit = 30, V_HAPTICS.crit = [30,20,30] (src/feel/haptics.js:13)
  - Crit flash 180ms / shake 440ms (src/feel/animations.js:92,99)
Acceptance:
  - Visual matches Figma spec ±2px / ±20ms
  - Performance 60fps maintained
  - Sacred grep audit clean
  - Visual regression baseline updated (battle.png desktop + mobile)
```

---

## 10. Open questions for Roman before Designer kick-off

These need decisions or won't block immediate Tier S work but matter for Designer scope:

1. **Race art naming convention** — keep dual `display name / internal RACE_SYNERGY name` or unify? (Current: pirate displays + internal both work; rock displays + golem internal RACE_SYNERGY; etc.) Designer cleaner working with one canonical name per race.
2. **Hero portrait art direction** — commission for beta (Tier A #16), or placeholder + post-launch art pass (Tier B)? R26 in risk register.
3. **Audio gap for berserker + engineer bosses** — commission tracks (~$200-400/each on Fiverr-tier composers) or remap existing tracks?
4. **`race emblems/` 4 unused art (elf, dark elf, human, orc)** — discard or repurpose for some Tier C / future content? Recommend discard, no current narrative slot.
5. **Chapter emblems verification** — code has 3 chapters shipped (Ch4-5 post-launch per project memory). External lib `chapter emblems/` may have art for all 5; check during TASK-UX-002 audit.

---

**Document version:** 1.0
**Last updated:** 2026-05-16
**Maintainer:** CTO
**Next update:** post-TASK-UX-002 asset library audit (refine §5.3 verdicts with Designer's findings)
