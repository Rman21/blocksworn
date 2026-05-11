# Blocksworn — Execution Plan

**Vision-driven roadmap for Web finalization → Chia launch**

> Документ-стек для CTO Claude Chat. Готов для Claude Code execution.
> Каждая task atomic, с приёмочными критериями и smoke-test референсами.
> AAA+ standard: zero regression, zero error tolerance.

**Версия:** 1.0
**Создан:** 2026-05-10
**Пререкизит:** Blocksworn v2.1 (76% из 10 фаз реализовано в single HTML)

---

## Содержание

### SECTION A: FOUNDATION
1. [Context — что есть на старте](#1-context--что-есть-на-старте)
2. [Architecture Decision — Vite + ES Modules](#2-architecture-decision--vite--es-modules)
3. [AAA+ Operating Principles для Claude Code](#3-aaa-operating-principles-для-claude-code)
4. [Sacred Cows — что НЕ трогаем](#4-sacred-cows--что-не-трогаем)
5. [Repository Structure](#5-repository-structure)

### SECTION B: PHASE PLAN
6. [Phase 1: Foundation Reset](#6-phase-1-foundation-reset-6-8-недель)
7. [Phase 2: Identity Layer](#7-phase-2-identity-layer-3-4-недели)
8. [Phase 3: Endgame Social](#8-phase-3-endgame-social-5-6-недель)
9. [Phase 4: Chia Integration](#9-phase-4-chia-integration-6-8-недель)

### SECTION C: TEST INFRASTRUCTURE
10. [Smoke Tests + Golden Paths](#10-smoke-tests--golden-paths)
11. [Visual Regression Baseline](#11-visual-regression-baseline)
12. [CI Gates](#12-ci-gates)

### SECTION D: TASK CATALOG
13. [Phase 1 Tasks (T1.01 — T1.20)](#13-phase-1-tasks)
14. [Phase 2 Tasks (T2.01 — T2.12)](#14-phase-2-tasks)
15. [Phase 3 Tasks (T3.01 — T3.15)](#15-phase-3-tasks)
16. [Phase 4 Tasks (T4.01 — T4.12)](#16-phase-4-tasks)

### SECTION E: WORKING WITH CLAUDE CODE
17. [CLAUDE.md repository file](#17-claudemd-repository-file)
18. [Task Template](#18-task-template)
19. [Rollback Procedures](#19-rollback-procedures)
20. [Common Pitfalls](#20-common-pitfalls)

### SECTION F: APPENDICES
21. [Risk Register](#21-risk-register)
22. [Glossary](#22-glossary)
23. [Cross-reference с v2.1 specs](#23-cross-reference-с-v21-specs)

---

# SECTION A: FOUNDATION

## 1. Context — что есть на старте

### 1.1 Игра

**Blocksworn** — block-puzzle RPG (PvE) с асинхронной конкуренцией. Размер кодовой базы: 21 МБ single HTML (70 815 строк, 7.6 МБ inline JS). Реализовано 76% v2.1 reboot спека (10 фаз).

### 1.2 Что уже сделано (v2.1)

Подтверждённое реальной grep-проверкой кода:

**✅ Реализовано:**
- P1 Foundation: MAX_HP=100, 4 channels, mitigation matrix, applyChannelDamage
- P2 Stagger Loop: Recovery state, bossStateBanner, Pressure UI (bpFill)
- P3 Hero Tiers: HERO_TIER_ABILITIES, Aegis Conductor (Tank), Squad Conductor (Captain)
- P4 Boss Recalc: BOSS_TTK_TARGETS, TTK formula
- P5 Polish + Mon: Inter-battle screens, Tower differentiation, monetization framework
- P6 Cosmic Ascension: Ch4-5 bosses, Hero Cards, Tower Hearts
- P7 Monetization: Battle Pass, PURE PATH leaderboard
- P8 FTUE Restructure: Chronicler narrator, Tutorial Library, FTUE_BOSS_GUARANTEES
- P9 Tower System: dedicated roster, Tower Pacts, Uroboros, Achievements, Weekly Rotation
- P10 Endgame Polish: colorblind, localization, reduce motion, profile customization

**🔴 Не доделано (debt):**
- P1 §4: Артефакты НЕ удалены (`applyArtifact*` функции в коде)
- P5 §7 Final Legacy Purge: НЕ сделан — Cosmic Memorial renderer + CSS остались
- P3 Mythic ability framework: возможно частично реализован
- P7 Player Segments (Whale/Dolphin/Minnow/F2P) constants: не найдены

### 1.3 Что v2.1 НЕ покрывал (gap для нового плана)

- Архитектурный refactor (single HTML → modular)
- Identity Layer per-race line-clear flavor (P4 Reactivity Events были per-archetype, не per-race)
- Async social (Adventures / clans)
- Party Tower (2-5 player coop)
- Replay/share infrastructure
- Chia integration

### 1.4 Endgame fantasy (locked from user)

Игрок на 100-й час должен иметь:
- Competitive seasonal Tower (solo + party + small guild)
- Collections (codex, races, bosses, achievements)
- Upgrades (hero levels/tiers/Mythic + later NFT-bound)

---

## 2. Architecture Decision — Vite + ES Modules

### 2.1 Решение

**Modular Vanilla JS на Vite build pipeline.**

- Vanilla JS сохраняется (вся игровая логика без переписывания)
- ES Modules (`import`/`export`)
- Vite как dev server + bundler
- CSS разбивается на `tokens.css` + `components/` + `screens/`
- Активы выходят из inline base64 в `/public/`

### 2.2 Почему именно так

| Опция | Risk | Сохранение работы | Future-proof | Verdict |
|-------|------|-------------------|--------------|---------|
| React/Vue rewrite | Очень высокий | ~10% (выбрасываем 187 анимаций, V_HAPTICS, FTUE state machine) | Да | ❌ Слишком рискованно |
| Single HTML cleanup | Низкий | 100% | Нет (Chia integration в window-scope = ад) | ❌ Не решает problem |
| **Vite + ES Modules** | **Контролируемый** | **~95%** | **Да (lazy load, tree-shake, Chia как отдельный модуль)** | **✅** |
| Hybrid (vanilla core + React shell) | Высокий (два paradigm) | 70% | Да | ❌ Сложно поддерживать |

### 2.3 Что Vite даёт

- **Instant HMR в dev:** изменили CSS — видно мгновенно, не нужно reload
- **Production bundle ~2-5 МБ** (вместо 21 МБ single file)
- **Code splitting:** Chia/Adventures/Party Tower lazy-loaded (не нужны до endgame)
- **Tree shaking:** unused exports автоматически удаляются
- **TypeScript ready** (если позже захотите types — drop-in)
- **Test infrastructure:** Vitest нативно интегрирован

### 2.4 Что НЕ меняется

- Вся игровая логика (combat, grid, heroes, bosses, FTUE state)
- Все 187 CSS keyframes
- V_HAPTICS table
- Все API endpoints (Firebase, RevenueCat, Sentry)
- localStorage state model (на старте — рефакторим в Phase 3+)
- DOM structure (224 ID'ed элементов остаются)

### 2.5 Migration approach

**Postепенный, с проверкой на каждом шаге:**

1. Создаём новый репо рядом со старым
2. Старый сохраняется в `_legacy/blocksworn_index_fixed.html` для reference
3. Vite scaffold + smoke tests
4. По одному модулю переносим, после каждого — full smoke test pass
5. Когда все модули перенесены — delete `_legacy/`

**ВАЖНО:** старый HTML остаётся доступен **до полного завершения migration**. Это safety net.

---

## 3. AAA+ Operating Principles для Claude Code

> Это **не "best practices" wishlist"** — это операционные правила. Нарушение = риск регрессии.

### 3.1 Первый принцип: Test Infrastructure FIRST

**До любого рефакторинга должны существовать:**

- Smoke tests для критических user-flows
- Visual regression baseline (screenshot всех экранов)
- CI pipeline проверяющий оба на каждом PR

**Без них refactor вслепую.** Регрессия будет — вопрос только когда обнаружится.

### 3.2 Атомарность tasks

Каждая task в этом плане:
- **Один deliverable** (не "и refactor X и delete Y")
- **Один PR** (не накапливаем несколько tasks в один)
- **Один commit message format:** `[T1.05] <description>`
- **Полный test pass** до merge

### 3.3 No parallel feature work во время Phase 1

В Phase 1 (Foundation Reset) **запрещено**:
- Добавлять новые фичи
- Балансировать (даже тривиально)
- Изменять combat math
- Менять monetization

Причина: merge conflicts на refactor = катастрофа. Phase 1 — single track.

### 3.4 Sacred cows enforced as constraint

Список в Section 4 — **CONSTRAINT в каждом Claude Code prompt**. Любой prompt включает: "DO NOT modify [sacred cow list]."

### 3.5 Rollback first, fix-forward second

Если PR ломает smoke test — `git revert` сразу. Не "fix on master".

### 3.6 Each PR = one CLAUDE.md anchor

Repo должен иметь `CLAUDE.md` (см. Section 17). Перед каждой Claude Code сессией — оно прочитывается.

### 3.7 Visual regression threshold

- Pixel diff ≤2% — passes
- Pixel diff 2-5% — manual review required
- Pixel diff >5% — fails CI

Применяется ко всем экранам в `tests/screenshots/baseline/`.

### 3.8 Smoke test contracts

Минимальный набор golden paths которые **должны проходить** на каждом PR:

1. **FTUE complete** (`ftue.spec.js`): запуск → Chronicle → Pyredrake → hero reveals → Grunt → complete, < 10 минут
2. **Chapter 1 Boss 1** (`ch1-boss1.spec.js`): загрузка → менеджер → battle → win
3. **Tower floor 1-5** (`tower.spec.js`): tower mode → floor 5 climax
4. **Shop opens** (`shop.spec.js`): все секции рендерятся, нет console errors
5. **Settings + accessibility** (`settings.spec.js`): toggle colorblind / reduce motion / volume → applied

См. Section 10.

### 3.9 Никакого console.log в production

Все debug logs через `import { log } from 'src/services/logger.js'`. Production build — `log()` no-op.

### 3.10 Один источник truth для constants

Никаких magic numbers в logic коде. Всё в `src/data/balance.js`. Если константа повторяется в 2 местах — это bug, не feature.

---

## 4. Sacred Cows — что НЕ трогаем

> Эти системы работают **точно** как должны. Любое изменение — risk без upside.

### 4.1 Combat математика

- **Combo crit формула:** `total_dmg × (1 + dominantCount × combo × 10%)`
- **Element synergy multipliers:** 2x = -2 ULT threshold, 3x = -4 + 20%, 5x = -6 + 50% + 30% start
- **Race tier bonuses:** 2x/3x/5x per RACE_SYNERGY config
- **TIER_COSTS_V18:** {1:1, 2:2, 3:3, 4:5}
- **HERO_ULT_COST_BY_NEWROLE:** warrior:80, mage:100, hunter:120, tank:80, captain:100
- **TTK formula (P4):** `boss_hp = expected_squad_dps × target_ttk_seconds`
- **Phase gates:** уже стандартизированы в P4 (если нет — Phase 1 fix)

### 4.2 Feel layer

- **V_HAPTICS table:** `{tap:10, place:15, clear:25, hit:30, crit:[30,20,30], levelup:[20,30,40], rareDrop:[40,40,40], victory:[100,50,100,50,200], defeat:[200]}`
- **vPlayLineClearBurst** (particle pattern → boss)
- **vPlayCritFlash** (180ms flash + 440ms shake)
- **Boss death 5-beat cinematic** (`vPlayBossDieFx`)
- **NARRATOR_LINES** (Darkest Dungeon poetic voice — это identity игры)

### 4.3 Narrative voice

- **The Chronicler character** (FTUE narrator)
- **chronicle_intro / chronicle_outro / intro dialog** copy
- **Tone:** poetic, terse, Darkest Dungeon-inspired
- **Boss names + element subtitles**

### 4.4 Economy core

- **GEM_PACKS price ladder:** $0.99 / $4.99 / $9.99 (+10%) / $19.99 (+15%) / $49.99 (+20% MEGA) / $99.99 (+30% WHALE)
- **First Purchase Bonus:** +50% gems + 1 Hero Card + Founder Badge
- **Battle Pass tier formula:** `xp_required = 500 + tier × 150`
- **Tower retry gem ladder:** [100, 200, 400]
- **3-минутный target Tower-боя**

### 4.5 v2.1 implemented systems

Никакая task не должна изменять следующие готовые v2.1 системы (только integrate с ними):
- 4-channel damage system
- Stagger Loop / Recovery state
- HERO_TIER_ABILITIES
- BOSS_TTK_TARGETS
- TOWER_LEADERBOARDS (Global / F2P / Weekly)
- TOWER_PACTS
- Uroboros seasonal boss
- FTUE_BOSS_GUARANTEES

**Если task требует изменения sacred cow — escalate, не делай.**

---

## 5. Repository Structure

### 5.1 Финальная структура (после Phase 1)

```
blocksworn/
├── CLAUDE.md                      ← working conventions для Claude Code
├── README.md
├── package.json
├── vite.config.js
├── playwright.config.js           ← smoke + visual tests
├── .github/workflows/ci.yml
├── _legacy/                       ← старый single HTML (удаляется в конце Phase 1)
│   └── blocksworn_index_fixed.html
├── public/                        ← статические активы
│   ├── images/
│   │   ├── heroes/
│   │   ├── bosses/
│   │   └── ui/
│   ├── audio/
│   │   ├── sfx/
│   │   └── music/
│   └── fonts/
├── src/
│   ├── main.js                    ← entry point
│   ├── core/                      ← игровая логика (vanilla JS)
│   │   ├── battle.js
│   │   ├── grid.js
│   │   ├── heroes.js
│   │   ├── bosses.js
│   │   ├── progression.js
│   │   ├── ftue-state.js
│   │   ├── stagger-loop.js        ← v2.1 P2 system
│   │   ├── damage-channels.js     ← v2.1 P1 system
│   │   ├── reactivity-events.js   ← v2.1 P4 system
│   │   └── identity-fx-router.js  ← Phase 2 new
│   ├── ui/
│   │   ├── menu.js
│   │   ├── battle-screen.js
│   │   ├── shop.js
│   │   ├── tower.js
│   │   ├── season.js
│   │   ├── profile.js
│   │   ├── select.js
│   │   ├── dailies.js
│   │   ├── adventures.js          ← Phase 3 new
│   │   ├── party-tower.js         ← Phase 3 new
│   │   └── codex.js               ← Phase 3 new
│   ├── feel/
│   │   ├── animations.js          ← line clear bursts, crit flash, boss death
│   │   ├── haptics.js             ← V_HAPTICS sacred
│   │   ├── particles.js
│   │   ├── narrator.js            ← speakNarrator
│   │   └── identity-fx.js         ← Phase 2 new (race/boss flavors)
│   ├── monetization/
│   │   ├── shop.js
│   │   ├── battle-pass.js
│   │   ├── pinch.js               ← v2.1 system
│   │   └── starter-pack.js
│   ├── data/                      ← single source of truth для констант
│   │   ├── balance.js             ← BALANCE object
│   │   ├── races.js               ← RACES, RACE_SYNERGY
│   │   ├── chapters.js            ← CHAPTERS data
│   │   ├── bosses.js              ← BOSSES, archetypes
│   │   ├── heroes.js              ← HERO_ROSTER
│   │   ├── ftue-scripts.js        ← FTUE_BEATS, FTUE_SCRIPTS
│   │   ├── tower-roster.js        ← TOWER_ROSTER_TIER_*
│   │   ├── tower-pacts.js         ← TOWER_PACTS
│   │   ├── achievements.js
│   │   └── monetization-config.js
│   ├── services/
│   │   ├── analytics.js           ← logEvent wrapper
│   │   ├── revenuecat.js          ← IAP
│   │   ├── firebase.js            ← auth + Firestore
│   │   ├── sentry.js              ← error tracking
│   │   ├── logger.js              ← log() wrapper
│   │   └── storage.js             ← localStorage abstraction
│   ├── chia/                      ← Phase 4, ВСЁ feature-flag-gated
│   │   ├── wallet.js              ← Sage / Chia Wallet integration
│   │   ├── nft.js                 ← NFT-hero data model
│   │   ├── achievements.js        ← on-chain registry
│   │   ├── adventures-dao.js      ← walletted async clans
│   │   └── feature-flag.js        ← isChiaEnabled() — single check
│   └── styles/
│       ├── tokens.css             ← CSS variables (single source)
│       ├── reset.css
│       ├── typography.css
│       ├── components/
│       │   ├── button.css
│       │   ├── card.css
│       │   ├── modal.css
│       │   ├── progress-bar.css
│       │   └── ...
│       └── screens/
│           ├── menu.css
│           ├── battle.css
│           ├── shop.css
│           └── ...
├── tests/
│   ├── smoke/
│   │   ├── ftue.spec.js
│   │   ├── ch1-boss1.spec.js
│   │   ├── tower.spec.js
│   │   ├── shop.spec.js
│   │   ├── settings.spec.js
│   │   └── ...
│   ├── visual/
│   │   ├── baseline/              ← reference screenshots
│   │   └── current/               ← per-PR screenshots
│   └── unit/                      ← на критическую math
│       ├── combat.test.js
│       ├── tier.test.js
│       └── stagger.test.js
└── docs/
    ├── plan/
    │   ├── 00_EXECUTION_PLAN.md   ← этот документ
    │   ├── v21_phase_specs/       ← reference, не active
    │   └── tasks/
    │       └── archive/           ← завершённые tasks
    ├── adr/                       ← Architecture Decision Records
    │   ├── 001-vite-vanilla.md
    │   ├── 002-async-party-tower.md
    │   └── ...
    └── design/
        ├── identity-layer.md      ← Phase 2 spec
        ├── adventures.md          ← Phase 3 spec
        └── chia-integration.md    ← Phase 4 spec
```

### 5.2 Правила структуры

- **`/data` — read-only constants.** Никакая task не пишет в data файлы game state. Только для определения констант.
- **`/services` — внешние зависимости** изолированы. Если API меняется — меняем 1 файл.
- **`/feel` — никакой game logic.** Только визуальные/тактильные эффекты.
- **`/chia` — всё gated.** Feature flag `isChiaEnabled()` обязателен на каждой entry point.
- **`/legacy` — read-only.** Если нужен код оттуда — копируется, не импортируется.

---

# SECTION B: PHASE PLAN

## 6. Phase 1: Foundation Reset (6-8 недель)

### 6.1 Цель

Превратить 21 МБ single HTML в **модульный, тестируемый, без legacy debt** проект.

### 6.2 Deliverables

- Вся кодовая база в Vite + ES Modules (`/src/...`)
- Smoke tests + visual regression baseline
- CI pipeline (build + test + visual diff)
- **0 артефакт-related кода** в codebase
- **0 Cosmic Memorial dead code**
- v2.1 incomplete items завершены (Mythic framework, Player Segments)
- Bundle size < 5 МБ (vs current 21 МБ)
- First load time < 3 сек (mid-tier mobile, 4G)

### 6.3 Approach

**Aggressive parallel-safe migration:**

```
Week 1:    Test infrastructure FIRST
           - Vite scaffold + Playwright + visual baseline
Week 2-3:  CSS + data extraction
           - Все CSS → tokens + components + screens
           - Все data constants → src/data/*.js
Week 4-5:  Logic extraction
           - Core game logic → src/core/
           - UI screens → src/ui/
           - Feel layer → src/feel/
           - Services → src/services/
Week 6:    Cleanup pass
           - DELETE artifacts subsystem
           - DELETE Cosmic Memorial
           - Consolidate shop pack systems
           - Complete v2.1 unfinished items
Week 7-8:  Hardening + buffer
           - Performance optimization
           - Bundle size analysis
           - Visual regression review
           - Buffer for unexpected issues
```

### 6.4 Phase 1 Sequencing

Tasks выполняются **строго последовательно** — каждая зависит от предыдущей.

```
T1.01 → T1.02 → T1.03 → T1.04 → T1.05    (week 1: infrastructure)
                ↓
T1.06 → T1.07 → T1.08                     (week 2-3: data + services + CSS)
                ↓
T1.09 → T1.10 → T1.11 → T1.12 → T1.13    (week 4-5: logic + UI extraction)
                ↓
T1.14 → T1.15 → T1.16 → T1.17 → T1.18    (week 6: cleanup)
                ↓
T1.19 → T1.20                             (week 7-8: completion + hardening)
```

### 6.5 Phase 1 Go/No-Go criteria

Перед переходом к Phase 2:
- [ ] Все smoke tests проходят
- [ ] Visual regression < 2% pixel diff на всех экранах
- [ ] Bundle size < 5 МБ
- [ ] First load < 3 сек на mid-tier mobile
- [ ] Zero `console.error` в production build
- [ ] `_legacy/` удалён или ready to be deleted
- [ ] CLAUDE.md создан и реалистичен
- [ ] CI passes на main branch 5 дней подряд

**Если что-то не выполнено:** добавить tasks T1.21+ и не двигаться.

---

## 7. Phase 2: Identity Layer (3-4 недели)

### 7.1 Цель

Реализовать **mechanics × race/boss identity** — ваше видение из аудита: "хочется чтобы механики скрещивались с расами и боссами".

### 7.2 Deliverables

- 5 race-flavored line-clear effects (Pirate / Shark / Rock / Crocodile / Spark)
- 5+ boss-reactive mechanics (Phoenix board burn, Lich curse cells, etc)
- Codex screen (gallery races + bosses + identity moments encountered)
- Visual polish: identity-specific FX (extending /feel/identity-fx.js)

### 7.3 Approach

**Не заменяет Reactivity Events из v2.1 P4** — расширяет их.

| Layer | Granularity | Когда срабатывает | Источник |
|-------|-------------|-------------------|----------|
| Reactivity Events (P4) | per-archetype | Phase gates 70%/35% | v2.1 P4 |
| **Identity Layer (Phase 2)** | **per-race × per-boss matchup** | **Каждый line clear** | **новое** |

Identity Layer срабатывает ЧАСТО (каждый line clear), Reactivity Events — РЕДКО (2 раза за бой). Они комплементарны.

### 7.4 Phase 2 Go/No-Go criteria

- [ ] Каждая раса имеет distinct line-clear flavor (visual + mechanical)
- [ ] Каждый chapter-finale босс имеет identity-driven reaction
- [ ] Codex screen рендерит все encountered races/bosses
- [ ] Smoke test: identity FX visible in test play
- [ ] Performance: 60fps maintained даже при 10+ identity-FX simultaneously

---

## 8. Phase 3: Endgame Social (5-6 недель)

### 8.1 Цель

Реализовать competitive seasonal endgame: **Adventures (small guild) + Party Tower (2-5 coop) + share infrastructure**.

### 8.2 Deliverables

- **Adventures** — асинхронный clan для 5-15 игроков
- **Party Tower** — 2-5 player turn-based coop
- **Replay/Share** — auto-record + navigator.share + watermark
- **Friend leaderboard** — mini-block на home hub
- **Tower endless** — после floor 50

### 8.3 Architectural Decision: Async > Real-time для Party Tower

**Решение:** Party Tower использует **async turn-based** механику, не real-time WebRTC.

**Обоснование:**

| Аспект | Real-time WebRTC | Async turn-based |
|--------|------------------|------------------|
| Server overhead | Matchmaking + STUN/TURN servers | Только storage |
| Latency tolerance | <100ms required | Часы или дни OK |
| Mobile reliability | Плохая (соединение дроп'ает) | Отличная |
| Live ops staffing | 24/7 monitoring | Background |
| AAA reference | — | Marvel Snap, Words With Friends |
| Block puzzle fit | Плохой (puzzle natural turn-based) | Идеальный |

См. ADR `docs/adr/002-async-party-tower.md`.

### 8.4 Adventures vs Guilds

Решение: использовать слово **"Adventures"** вместо **"Guilds"**.

Причина:
- "Guild" implies live activity, chat, drama
- "Adventure" implies shared journey, async contribution
- Соответствует tone игры (Darkest Dungeon-style narrator)

Adventure = 5-15 игроков async-группа с:
- Weekly Tower target (collective floor count)
- Boss-of-the-week (shared HP, individual contribution tracked)
- Member contributions visible (мягкое social pressure без токсичности)
- НЕТ chat (или emoji-only)
- НЕТ роли модераторов
- НЕТ real-time activity feed

### 8.5 Phase 3 Go/No-Go criteria

- [ ] Adventure can be created, joined via Friend Code
- [ ] Adventure weekly target functional, rewards distributed
- [ ] Boss-of-the-week shared HP, individual tracking works
- [ ] Party Tower 2-player session completes successfully
- [ ] Replay auto-record produces shareable mp4/gif
- [ ] navigator.share opens native share sheet
- [ ] Friend leaderboard displays correctly on home hub
- [ ] Tower endless mode functional after floor 50

---

## 9. Phase 4: Chia Integration (6-8 недель)

### 9.1 Цель

Интегрировать Chia blockchain как **endgame layer**, не как монетизацию-поверх.

### 9.2 Scope (locked from user)

- **NFT-герои** (skin + history + ascension binding, tradable)
- **On-chain achievements** (которые игрок показывает другим)
- **Wallet login** (опциональный, не required для core game)
- ❌ NO play-to-earn tokens (out of scope для V1)
- ❌ NO NFT artifacts (artifacts removed в Phase 1)

### 9.3 Strict constraint: NO P2W

**NFT-герои НЕ сильнее не-NFT героев того же tier.**

- NFT даёт: skin, history, tradability, ascension binding
- НЕ даёт: больше HP, damage, special abilities, exclusive content

Тестируется через extended PURE PATH leaderboard system: появляется **PURE PATH CHAIN** (walleted F2P игроков), статистически не должен отличаться от **PURE PATH** (web F2P) в Tower performance.

### 9.4 Mobile compatibility plan

При future mobile port (iOS/Android):
- Chia features behind feature flag `isChiaEnabled()`
- Mobile build: `isChiaEnabled() === false`
- Web/PWA build: `isChiaEnabled() === true`
- Все Chia entry points обёрнуты в check
- Mobile pure F2P leaderboard separate (нет walleted players)

### 9.5 Phase 4 Go/No-Go criteria

- [ ] Chia testnet wallet integration работает (Sage или Chia Wallet)
- [ ] NFT-hero mint/transfer flow tested на testnet
- [ ] On-chain achievement registry functional
- [ ] Adventure DAO (wallet-gated) functional
- [ ] PURE PATH CHAIN leaderboard separated correctly
- [ ] Anti-P2W audit passes (NFT performance parity verified)
- [ ] Closed beta with 100+ crypto users completed
- [ ] Mobile compatibility: builds with `CHIA_ENABLED=false` work

---

# SECTION C: TEST INFRASTRUCTURE

## 10. Smoke Tests + Golden Paths

### 10.1 Tooling

- **Playwright** — браузерная автоматизация (Chrome/Safari/Firefox)
- **Vitest** — unit tests на critical math
- **Pixelmatch** — visual diff library

### 10.2 Golden Paths (must pass on every PR)

#### `tests/smoke/ftue.spec.js`

```js
test('FTUE complete in <10 minutes', async ({ page }) => {
  await page.goto('/');
  // Skip cold-start animations
  await page.waitForSelector('#screenMenu', { timeout: 5000 });

  // Trigger FTUE
  await page.click('#vChapterPick'); // или прямой запуск
  await page.click('button:has-text("BEGIN")');

  // Chronicle fight
  await playChronicleFight(page);
  await expect(page.locator('text=THE WARCHIEF')).toBeVisible();

  // Pyredrake fight
  await playPyredrakeFight(page);

  // Hero reveals + leader choice
  await selectLeader(page, 'pirate_warrior');

  // Grunt fight
  await playGruntFight(page);

  // Complete
  await expect(page.locator('text=Chapter 1 unlocked')).toBeVisible({ timeout: 600000 });
});
```

#### `tests/smoke/ch1-boss1.spec.js`

```js
test('Chapter 1 Boss 1 (Pyredrake) wins with full squad', async ({ page }) => {
  await loadStateWithCompleteFTUE(page);
  await page.click('button:has-text("BATTLE")');

  await playOptimalBattle(page, { targetBoss: 'pyredrake' });
  await expect(page.locator('text=VICTORY')).toBeVisible({ timeout: 300000 });
});
```

#### `tests/smoke/tower.spec.js`

```js
test('Tower floors 1-5 progression', async ({ page }) => {
  await loadStateWithChapter1Complete(page);
  await page.click('[data-nav="tower"]');

  for (let floor = 1; floor <= 5; floor++) {
    await page.click(`[data-floor="${floor}"]`);
    await playOptimalBattle(page);
    await expect(page.locator(`text=Floor ${floor} cleared`)).toBeVisible();
  }
});
```

#### `tests/smoke/shop.spec.js`

```js
test('Shop renders all sections without errors', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await loadAuthenticatedState(page);
  await page.click('[data-nav="shop"]');

  await expect(page.locator('#shopSectionOffers')).toBeVisible();
  await expect(page.locator('text=GEMS')).toBeVisible();
  await expect(page.locator('text=BATTLE PASS')).toBeVisible();
  await expect(page.locator('text=FIRST PURCHASE BONUS')).toBeVisible();

  expect(consoleErrors).toEqual([]);
});
```

#### `tests/smoke/settings.spec.js`

```js
test('Accessibility settings apply correctly', async ({ page }) => {
  await loadAuthenticatedState(page);
  await page.click('.a-hub-burger');
  await page.click('text=Settings');

  // Color blind mode
  await page.click('text=Color Blind Mode');
  await expect(page.locator('html')).toHaveClass(/colorblind-/);

  // Reduce motion
  await page.click('text=Reduce Motion');
  await expect(page.locator('html')).toHaveClass(/reduce-motion/);

  // Verify persistence
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/colorblind-/);
});
```

### 10.3 Helpers

`tests/helpers/game-state.js`:

```js
export async function loadStateWithCompleteFTUE(page) {
  await page.addInitScript(() => {
    localStorage.setItem('blocksworn_ftue', 'complete');
    localStorage.setItem('blocksworn_first_launch_date', '2026-05-01');
    // ... other required state
  });
  await page.goto('/');
}

export async function playOptimalBattle(page, opts = {}) {
  // Drag pieces from tray, clear lines
  // Use boss-aware optimal play heuristic
  // ...
}
```

---

## 11. Visual Regression Baseline

### 11.1 Baseline capture (Phase 1, Week 1)

```bash
npm run test:visual:baseline
```

Захватывает screenshots всех screens в **legacy single HTML версии**:

- `tests/visual/baseline/menu.png`
- `tests/visual/baseline/battle.png`
- `tests/visual/baseline/shop.png`
- `tests/visual/baseline/tower.png`
- `tests/visual/baseline/season.png`
- `tests/visual/baseline/profile.png`
- `tests/visual/baseline/select.png`
- `tests/visual/baseline/dailies.png`
- `tests/visual/baseline/ftue-pyredrake-fight.png`
- `tests/visual/baseline/ftue-victory.png`

Total ~30 screenshots: каждый screen в default state + 1-2 typical states.

### 11.2 Per-PR diff

```bash
npm run test:visual
```

Запускает Playwright, делает screenshots, сравнивает с baseline через pixelmatch:

- ≤2% diff → PASS
- 2-5% diff → manual review (warning)
- \>5% diff → FAIL

### 11.3 Updating baseline

После Phase 2+ (когда identity FX появятся), некоторые screenshots могут intentionally измениться:

```bash
npm run test:visual:update -- battle.png
```

Новый baseline commit'ится с обоснованием в commit message.

---

## 12. CI Gates

### 12.1 GitHub Actions workflow

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint

  build:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - run: |
          BUNDLE_SIZE=$(du -sk dist | cut -f1)
          if [ "$BUNDLE_SIZE" -gt 5120 ]; then
            echo "Bundle exceeds 5MB ($BUNDLE_SIZE KB)"
            exit 1
          fi

  unit:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:unit

  smoke:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:smoke

  visual:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:visual
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: visual-diffs
          path: tests/visual/diff/
```

### 12.2 Pre-commit hook

`.husky/pre-commit`:

```bash
#!/bin/sh
npm run lint:staged && npm run build
```

### 12.3 Branch protection

`main` branch protection rules:
- Require PR before merging
- Require status checks: `lint`, `build`, `unit`, `smoke`, `visual`
- Require conversation resolution
- No direct pushes к main

---

# SECTION D: TASK CATALOG

## 13. Phase 1 Tasks

> Каждая task atomic, executable, с приёмочными критериями.

---

### T1.01 — Setup Vite scaffold + new repository

**Status:** pending
**Phase:** 1
**Estimated complexity:** M
**Goal:** Создать новый Vite-based проект с правильной структурой папок, базовым package.json, и legacy/ директорией.
**Why now:** Это foundation. Без неё дальнейшие tasks невозможны.
**Depends on:** none
**Files affected:** entire repo (initial setup)

**What to do:**

1. Создать новый `blocksworn/` проект:
   ```bash
   npm create vite@latest blocksworn -- --template vanilla
   cd blocksworn
   npm install
   ```
2. Установить dependencies:
   ```bash
   npm install -D vite playwright @playwright/test pixelmatch eslint
   ```
3. Создать структуру папок (см. Section 5.1)
4. Скопировать существующий `blocksworn_index_fixed.html` в `_legacy/`
5. Создать пустой `index.html` (shell, ~5KB):
   ```html
   <!DOCTYPE html>
   <html lang="en">
   <head>
     <meta charset="UTF-8">
     <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
     <title>Blocksworn</title>
     <link rel="stylesheet" href="/src/styles/tokens.css">
     <link rel="stylesheet" href="/src/styles/reset.css">
   </head>
   <body>
     <div id="app"></div>
     <script type="module" src="/src/main.js"></script>
   </body>
   </html>
   ```
6. Создать `src/main.js` placeholder (echo "Blocksworn loading...")
7. Verify `npm run dev` запускается, страница загружается
8. Initial commit

**Acceptance criteria:**
- [ ] `npm run dev` стартует Vite dev server без ошибок
- [ ] `npm run build` производит `dist/` папку
- [ ] Структура папок соответствует Section 5.1
- [ ] `_legacy/blocksworn_index_fixed.html` существует и openable в browser
- [ ] CLAUDE.md создан с базовой версией (см. Section 17)
- [ ] Initial commit: `[T1.01] Setup Vite scaffold`

**Smoke tests:** none yet (T1.03 добавит)

**Rollback plan:** удалить новую директорию, вернуться к старому single HTML

**Claude Code prompt seed:**

```
Setup new Vite-based project for Blocksworn migration. Reference docs/plan/00_EXECUTION_PLAN.md Section 5 for repo structure.

Steps:
1. Run `npm create vite@latest . -- --template vanilla` in blocksworn/ directory
2. Install dev dependencies: vite, @playwright/test, pixelmatch, eslint
3. Create folder structure exactly per Section 5.1 (do not create empty files yet, just folders)
4. Copy existing /mnt/user-data/uploads/blocksworn_index_fixed.html to _legacy/
5. Replace index.html with shell version (see task spec)
6. Create src/main.js with placeholder console.log("Blocksworn loading...")
7. Verify `npm run dev` works
8. Commit as: [T1.01] Setup Vite scaffold

DO NOT modify any logic in _legacy/. It is read-only reference.
DO NOT add any other features in this task — scaffold only.
```

---

### T1.02 — Create CLAUDE.md repository file

**Status:** pending
**Phase:** 1
**Estimated complexity:** S
**Goal:** Создать CLAUDE.md в корне репозитория с правилами работы для Claude Code.
**Why now:** Каждая последующая Claude Code session начнётся с чтения этого файла.
**Depends on:** T1.01
**Files affected:** `CLAUDE.md`

**What to do:**

Создать `CLAUDE.md` с содержимым из Section 17 этого плана.

**Acceptance criteria:**
- [ ] `CLAUDE.md` существует в repo root
- [ ] Содержит: Sacred Cows list, Operating Principles, Commit message format, How to read this codebase
- [ ] Markdown valid
- [ ] Commit: `[T1.02] Add CLAUDE.md`

**Claude Code prompt seed:**

```
Create CLAUDE.md in repo root. Content per docs/plan/00_EXECUTION_PLAN.md Section 17.

This file is read at the start of every Claude Code session. It contains:
- Sacred Cows (what NOT to modify)
- Operating Principles (test first, atomic commits, etc.)
- Repository structure overview
- Commit message format

Do not add anything not in Section 17. Do not include speculative content.
```

---

### T1.03 — Setup Playwright + smoke test infrastructure

**Status:** pending
**Phase:** 1
**Estimated complexity:** M
**Goal:** Установить Playwright, создать helpers, написать первый smoke test против _legacy/ HTML.
**Why now:** Smoke tests должны существовать ДО любого refactor. Без них регрессии необнаружимы.
**Depends on:** T1.01

**What to do:**

1. `npm install -D @playwright/test`
2. `npx playwright install --with-deps chromium webkit`
3. Создать `playwright.config.js`:
   ```js
   import { defineConfig, devices } from '@playwright/test';
   export default defineConfig({
     testDir: './tests/smoke',
     fullyParallel: true,
     forbidOnly: !!process.env.CI,
     retries: process.env.CI ? 2 : 0,
     workers: process.env.CI ? 1 : undefined,
     reporter: 'html',
     use: {
       baseURL: 'http://localhost:5173',
       trace: 'on-first-retry',
     },
     projects: [
       { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
       { name: 'webkit', use: { ...devices['Desktop Safari'] } },
       { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
       { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
     ],
     webServer: {
       command: 'npm run dev',
       port: 5173,
       reuseExistingServer: !process.env.CI,
     },
   });
   ```
4. Создать `tests/helpers/game-state.js` с functions из Section 10.3
5. Создать `tests/smoke/legacy-loads.spec.js`:
   ```js
   import { test, expect } from '@playwright/test';
   test('legacy single HTML loads without errors', async ({ page }) => {
     const errors = [];
     page.on('pageerror', err => errors.push(err.message));
     await page.goto('/_legacy/blocksworn_index_fixed.html');
     await page.waitForSelector('#screenMenu', { timeout: 10000 });
     expect(errors).toEqual([]);
   });
   ```
6. Verify `npm run test:smoke` passes
7. Commit

**Acceptance criteria:**
- [ ] Playwright установлен и configured
- [ ] `playwright.config.js` соответствует spec выше
- [ ] `tests/helpers/game-state.js` с минимум `loadAuthenticatedState`, `loadStateWithCompleteFTUE` helpers
- [ ] `tests/smoke/legacy-loads.spec.js` проходит
- [ ] `npm run test:smoke` script добавлен в package.json
- [ ] CI workflow (T1.05) заведомо имеет где это запускать

**Claude Code prompt seed:**

```
Set up Playwright smoke testing infrastructure. Reference docs/plan/00_EXECUTION_PLAN.md Section 10 for golden paths and Section 12 for CI integration.

Steps:
1. Install @playwright/test as dev dependency
2. Run `npx playwright install --with-deps chromium webkit`
3. Create playwright.config.js per task spec exactly
4. Create tests/helpers/game-state.js with loadAuthenticatedState, loadStateWithCompleteFTUE, playOptimalBattle helpers (stubs OK if implementation unclear)
5. Create tests/smoke/legacy-loads.spec.js per spec
6. Add to package.json: "test:smoke": "playwright test"
7. Run `npm run test:smoke` and verify it passes against _legacy/

DO NOT write smoke tests for new code yet — only the legacy loads test for baseline.
DO NOT modify any game logic in _legacy/.
```

---

### T1.04 — Capture visual regression baseline

**Status:** pending
**Phase:** 1
**Estimated complexity:** M
**Goal:** Сделать screenshots всех major screens из legacy HTML — это становится reference для visual regression detection.
**Why now:** Без baseline нет способа проверить что migration не сломала визуал.
**Depends on:** T1.03

**What to do:**

1. Создать `tests/visual/capture-baseline.spec.js`:
   ```js
   import { test } from '@playwright/test';
   const SCREENS = [
     { name: 'menu', selector: '#screenMenu', setup: 'fresh' },
     { name: 'battle', selector: '#screenBattle', setup: 'in-battle' },
     { name: 'shop', selector: '#screenShop', setup: 'authenticated' },
     { name: 'tower', selector: '#screenTower', setup: 'ch1-complete' },
     { name: 'season', selector: '#screenSeason', setup: 'authenticated' },
     { name: 'profile', selector: '#screenProfile', setup: 'authenticated' },
     { name: 'select', selector: '#screenSelect', setup: 'authenticated' },
     { name: 'dailies', selector: '#screenDailies', setup: 'authenticated' },
     // FTUE screens
     { name: 'ftue-chronicle', selector: '#screenBattle', setup: 'ftue-chronicle' },
     { name: 'ftue-pyredrake', selector: '#screenBattle', setup: 'ftue-pyredrake' },
   ];
   for (const s of SCREENS) {
     test(`baseline ${s.name}`, async ({ page }) => {
       await setupState(page, s.setup);
       await page.waitForSelector(s.selector);
       await page.waitForTimeout(500); // animations settle
       await page.screenshot({
         path: `tests/visual/baseline/${s.name}.png`,
         fullPage: true,
       });
     });
   }
   ```
2. Запустить `npm run test:visual:baseline` (новый script)
3. Зафиксировать ~30 screenshots в `tests/visual/baseline/`
4. Создать `.gitattributes` для PNG как binary
5. Commit baselines

**Acceptance criteria:**
- [ ] Минимум 10 unique screen-state combinations captured
- [ ] Screenshots stored в `tests/visual/baseline/`
- [ ] Размер каждого screenshot reasonable (full page, not zoomed)
- [ ] Все 4 viewports captured (desktop chrome, safari, mobile chrome, mobile safari) ИЛИ documented почему 1
- [ ] Commit: `[T1.04] Capture visual regression baseline`

**Claude Code prompt seed:**

```
Capture visual regression baseline for all major Blocksworn screens. Reference docs/plan/00_EXECUTION_PLAN.md Section 11.

Steps:
1. Create tests/visual/capture-baseline.spec.js per task spec
2. Implement setupState() helper in tests/helpers/game-state.js (extends existing helpers)
3. Add npm script: "test:visual:baseline": "playwright test tests/visual/capture-baseline.spec.js"
4. Run capture, generate ~30 screenshots in tests/visual/baseline/
5. Create .gitattributes if missing: `*.png binary`
6. Commit: "[T1.04] Capture visual regression baseline"

Captured screens (minimum):
- menu (fresh state, after FTUE)
- battle (mid-fight)
- shop, tower, season, profile, select, dailies
- ftue-chronicle, ftue-pyredrake states

For each: capture for at minimum chromium + mobile-chrome viewports.

DO NOT modify game code. Use only state setup via localStorage in helpers.
```

---

### T1.05 — Setup CI pipeline

**Status:** pending
**Phase:** 1
**Estimated complexity:** M
**Goal:** GitHub Actions workflow runs lint + build + unit + smoke + visual on each PR.
**Why now:** CI должен работать с самого начала, иначе разработка идёт без safety net.
**Depends on:** T1.03, T1.04

**What to do:**

1. Создать `.github/workflows/ci.yml` per Section 12.1
2. Создать `.husky/pre-commit` per Section 12.2 (`npm install -D husky` + `npx husky init`)
3. Add npm scripts:
   ```json
   {
     "scripts": {
       "lint": "eslint src tests",
       "lint:staged": "lint-staged",
       "build": "vite build",
       "test:unit": "vitest run",
       "test:smoke": "playwright test tests/smoke",
       "test:visual": "playwright test tests/visual/regression.spec.js",
       "test:visual:baseline": "playwright test tests/visual/capture-baseline.spec.js",
       "test:visual:update": "playwright test --update-snapshots"
     }
   }
   ```
4. Создать `tests/visual/regression.spec.js` — runs against current build, diffs vs baseline
5. Verify CI runs green on PR

**Acceptance criteria:**
- [ ] `.github/workflows/ci.yml` exists, syntactically valid
- [ ] CI runs on PR + push to main
- [ ] All 5 jobs (lint, build, unit, smoke, visual) defined
- [ ] Bundle size check < 5MB enforced
- [ ] Pre-commit hook installed via husky
- [ ] Test PR: создать dummy branch, открыть PR, убедиться CI green

**Claude Code prompt seed:**

```
Setup full CI pipeline. Reference docs/plan/00_EXECUTION_PLAN.md Section 12.

Steps:
1. Create .github/workflows/ci.yml exactly per Section 12.1
2. Install husky: `npm install -D husky lint-staged`
3. Run `npx husky init`
4. Create .husky/pre-commit per Section 12.2
5. Add scripts to package.json (see task spec)
6. Create tests/visual/regression.spec.js that:
   - Loads current built version
   - Captures screenshots
   - Diffs vs tests/visual/baseline/ using pixelmatch
   - Fails if >5% diff, warns if 2-5%
7. Create dummy "test-ci" branch, open PR to main, verify all 5 CI jobs run green

DO NOT lower bundle size limit below 5MB.
DO NOT skip the visual regression job — it's critical.
```

---

### T1.06 — Extract CSS into modular structure

**Status:** pending
**Phase:** 1
**Estimated complexity:** L
**Goal:** Все inline `<style>` блоки из legacy HTML → modular `src/styles/`.
**Why now:** CSS — самая независимая часть кода. Migration here не риск-эффект на logic.
**Depends on:** T1.05

**What to do:**

1. Прочитать `_legacy/blocksworn_index_fixed.html`, найти все `<style>` блоки
2. Идентифицировать sections:
   - CSS variables (тokens) → `src/styles/tokens.css`
   - Reset / typography → `src/styles/reset.css`, `typography.css`
   - Component styles (button, card, modal, progress-bar) → `src/styles/components/*.css`
   - Screen-specific styles (menu, battle, shop, tower, season, profile, etc.) → `src/styles/screens/*.css`
   - Animations / keyframes → `src/styles/animations.css`
3. **СОХРАНИТЬ ПОРЯДОК CASCADE** — order matters. Используйте `@import` в `src/styles/index.css`:
   ```css
   @import './tokens.css';
   @import './reset.css';
   @import './typography.css';
   @import './animations.css';
   @import './components/button.css';
   /* ... */
   @import './screens/menu.css';
   /* ... */
   ```
4. В `src/main.js` import `./styles/index.css`
5. **DELETE legacy `--v-*` tokens** (помечены deprecated в коде)
6. Run smoke tests + visual regression
7. Visual diff threshold: ≤2% per screen

**Acceptance criteria:**
- [ ] Все inline `<style>` блоки удалены из `index.html`
- [ ] CSS modular structure соответствует Section 5.1
- [ ] `src/styles/index.css` импортирует всё в правильном cascade order
- [ ] Visual regression: ≤2% diff на всех экранах
- [ ] `--v-*` legacy tokens полностью удалены (grep: 0 references)
- [ ] Все smoke tests проходят
- [ ] Bundle CSS size < 500KB

**Claude Code prompt seed:**

```
Extract all CSS from legacy HTML into modular structure. Reference docs/plan/00_EXECUTION_PLAN.md Section 5.1 for target structure.

CRITICAL CONTEXT:
- _legacy/blocksworn_index_fixed.html contains ~500KB of inline CSS
- Current 187 @keyframes must all be preserved
- CSS variables (CSS custom properties) are heavily used — must move to tokens.css

Steps:
1. Read _legacy/blocksworn_index_fixed.html, identify all <style> blocks
2. Categorize CSS by purpose:
   - :root variables → src/styles/tokens.css
   - Animations (@keyframes) → src/styles/animations.css
   - Component patterns → src/styles/components/*.css
   - Per-screen styles → src/styles/screens/*.css
3. Create src/styles/index.css that @imports all in cascade order
4. Import src/styles/index.css in src/main.js
5. DELETE all `--v-*` tokens (legacy, marked deprecated)
6. Run `npm run test:smoke` AND `npm run test:visual` after each significant change
7. Acceptance: visual regression <=2% on all screens

DO NOT modify any actual CSS values during migration. Pure relocation only.
DO NOT introduce new CSS frameworks (no Tailwind, no styled-components).
DO NOT touch JavaScript in this task. CSS only.

If visual diff exceeds 2% — investigate cascade order, don't change CSS values.
```

---

### T1.07 — Extract data constants into `src/data/`

**Status:** pending
**Phase:** 1
**Estimated complexity:** L
**Goal:** Все game constants (BALANCE, RACES, CHAPTERS, FTUE_SCRIPTS, etc.) из inline JS → `src/data/*.js` modules.
**Why now:** Data isolated, no execution-time risk. Easier to refactor logic if data already separate.
**Depends on:** T1.06

**What to do:**

1. Identify all top-level const objects in legacy JS:
   - `BALANCE` → `src/data/balance.js`
   - `RACES`, `RACE_SYNERGY`, `RACE_TO_STIHIYA` → `src/data/races.js`
   - `STIHIYAS`, `STIHIYA_DESC`, `STIHIYA_COLORS` → `src/data/elements.js`
   - `CHAPTERS`, `BOSSES` (per chapter), boss archetypes → `src/data/chapters.js`, `bosses.js`
   - `HERO_ROSTER`, `HERO_TIER_ABILITIES`, `ROLE_DESC`, `HERO_ULT_COST_BY_NEWROLE` → `src/data/heroes.js`
   - `FTUE_BEATS`, `FTUE_SCRIPTS`, `FTUE_TRANSITIONS`, `FTUE_BOSS_GUARANTEES`, `FTUE_TUTORIAL_TEXTS` → `src/data/ftue-scripts.js`
   - `TOWER_ROSTER_TIER_*`, `TOWER_PACTS`, `TOWER_LEADERBOARDS`, `TOWER_SEASONAL_REWARDS`, `BOSS_TTK_TARGETS` → `src/data/tower.js`
   - `GEM_PACKS`, `RESOURCE_PACKS`, `HERO_CARD_PACKS`, `STARTER_PACK_*`, `TOWER_CLIMBER_PACK_*`, `SEASON_PASS_*` → `src/data/monetization-config.js`
   - `V_HAPTICS`, `NARRATOR_LINES` → `src/feel/haptics.js`, `src/feel/narrator-lines.js`
   - `TIER_COSTS`, `TIER_COSTS_V18`, ascend constants → `src/data/balance.js` (consolidated)
2. Each module exports as named exports:
   ```js
   // src/data/balance.js
   export const BALANCE = Object.freeze({ ... });
   export const TIER_COSTS = Object.freeze({ 1: 1, 2: 2, 3: 3, 4: 5 });
   ```
3. **CONSOLIDATE TIER_COSTS / TIER_COSTS_V18** — оставить ONE.
4. **CONSOLIDATE shop pack constants** — multiple legacy systems → unified в `monetization-config.js`. См. T1.18 для full deduplication.
5. Game logic пока ОСТАЁТСЯ в `_legacy/` HTML. Не переносим logic в этой task.
6. Verify: `_legacy/blocksworn_index_fixed.html` не имеет копий этих constants — заменить на `import` (see step 7) ИЛИ временно — оставить дубликат если дешевле, удалить в T1.10.

**Note:** Step 7 is tricky — мы не хотим разломать legacy HTML до того как logic мигрирован. Pragmatic approach:
- В T1.07: создаём `src/data/*.js` файлы. Legacy HTML остаётся unchanged.
- В T1.10 (logic migration): новый module imports from `src/data/`. Legacy остаётся как reference.

**Acceptance criteria:**
- [ ] Все data constants в `src/data/*.js` modules
- [ ] Each module exports как named exports
- [ ] TIER_COSTS / TIER_COSTS_V18 consolidated to ONE export
- [ ] Все exports `Object.freeze()`'d (immutable)
- [ ] No data const duplicated between modules
- [ ] Smoke tests still pass against `_legacy/` (unchanged)

**Claude Code prompt seed:**

```
Extract all data constants from _legacy/blocksworn_index_fixed.html into src/data/*.js modules. Reference docs/plan/00_EXECUTION_PLAN.md Section 5.1 for target structure.

CRITICAL: This task does NOT modify _legacy/ at all. _legacy/ continues to work during this migration.

Steps:
1. Identify all top-level const objects in the inline JS of _legacy/
2. Create src/data/*.js modules per task spec mapping
3. Each module: named exports, Object.freeze() values
4. CONSOLIDATE TIER_COSTS and TIER_COSTS_V18 — pick one (the one currently used in production paths), document which in commit message
5. Run `npm run test:smoke` — should still pass against _legacy/
6. Commit: "[T1.07] Extract data constants to src/data/"

DO NOT modify _legacy/blocksworn_index_fixed.html.
DO NOT migrate any game logic in this task. Data only.
DO NOT change any constant values. Pure relocation.

For TIER_COSTS / TIER_COSTS_V18 consolidation: read the legacy code, determine which one is actively used, document the choice in commit message body.
```

---

### T1.08 — Extract services into `src/services/`

**Status:** pending
**Phase:** 1
**Estimated complexity:** M
**Goal:** External services (Firebase, RevenueCat, Sentry, analytics, storage) → `src/services/*.js`.
**Why now:** Services могут быть mocked для tests. Иметь их в отдельных файлах позволяет writing unit tests.
**Depends on:** T1.07
**Files affected:** `src/services/*.js`, eventually `_legacy/`

**What to do:**

1. Создать modules:
   - `src/services/firebase.js` — auth, Firestore, RTDB
   - `src/services/revenuecat.js` — IAP integration
   - `src/services/sentry.js` — error tracking init
   - `src/services/analytics.js` — `logEvent()` wrapper
   - `src/services/logger.js` — `log()` wrapper (production no-op)
   - `src/services/storage.js` — localStorage abstraction with versioning
2. Каждый module exports public API:
   ```js
   // src/services/storage.js
   const STORAGE_VERSION = 1;
   export function getItem(key, defaultValue = null) { /* ... */ }
   export function setItem(key, value) { /* ... */ }
   export function removeItem(key) { /* ... */ }
   export function clear() { /* ... */ }
   export function migrate(fromVersion, toVersion) { /* ... */ }
   ```
3. Stub-mode for tests: `services/storage.js` поддерживает `setMockMode(true)` для in-memory operation
4. **DO NOT migrate game logic** — только services
5. Verify smoke tests pass

**Acceptance criteria:**
- [ ] Все 6 service modules созданы
- [ ] Каждый имеет clean public API (named exports)
- [ ] `analytics.logEvent()` обёртывает RevenueCat/Sentry/console
- [ ] `storage` module имеет mock mode для tests
- [ ] Unit tests для storage module (read/write/migrate)
- [ ] Smoke tests pass

**Claude Code prompt seed:**

```
Extract external service integrations into src/services/. Reference docs/plan/00_EXECUTION_PLAN.md Section 5.1.

Services to extract from _legacy/:
1. firebase.js — Firebase auth, Firestore, RTDB initialization
2. revenuecat.js — IAP integration (Purchases SDK calls)
3. sentry.js — Sentry error tracking init
4. analytics.js — wraps logEvent calls
5. logger.js — log() wrapper, production no-op
6. storage.js — localStorage abstraction with versioning + mock mode

Steps:
1. Read _legacy/blocksworn_index_fixed.html, identify service-related code
2. Create each module with clean public API
3. Add unit tests for storage.js: get/set/remove/clear/migrate
4. Verify smoke tests still pass against _legacy/

DO NOT migrate game logic in this task.
DO NOT change service initialization sequences (Firebase ordering matters for auth).
DO NOT remove existing Sentry DSN placeholders — leave them as-is, even if "PLACEHOLDER".
```

---

### T1.09 — Extract feel layer (haptics, animations, particles, narrator)

**Status:** pending
**Phase:** 1
**Estimated complexity:** M
**Goal:** Feel-related code в `src/feel/`. Sacred — НЕ менять values.
**Why now:** Feel layer self-contained, low risk. Делаем перед logic extraction.
**Depends on:** T1.08

**What to do:**

1. `src/feel/haptics.js`:
   ```js
   // V_HAPTICS table — SACRED, do not modify
   export const V_HAPTICS = Object.freeze({
     tap: 10, place: 15, clear: 25, hit: 30,
     crit: [30, 20, 30],
     levelup: [20, 30, 40],
     rareDrop: [40, 40, 40],
     victory: [100, 50, 100, 50, 200],
     defeat: [200],
   });
   export function vHaptic(type) {
     const p = V_HAPTICS[type];
     if (p === undefined) return;
     if (navigator.vibrate) try { navigator.vibrate(p); } catch(e){}
   }
   ```
2. `src/feel/animations.js`:
   - `vPlayLineClearBurst(rows, cols)`
   - `vPlayCritFlash()`
   - `vPlayBossDieFx()` (5-beat cinematic)
   - All animation utility functions
3. `src/feel/particles.js`:
   - Particle creation, lifecycle, cleanup
4. `src/feel/narrator.js`:
   - `speakNarrator(trigger)`
   - `NARRATOR_LINES` (sacred — Darkest Dungeon voice)
5. **Keep all values exactly as in legacy** — relocation only
6. Smoke + visual regression must pass

**Acceptance criteria:**
- [ ] `V_HAPTICS` values identical to legacy
- [ ] `NARRATOR_LINES` strings identical to legacy
- [ ] All animation functions ported
- [ ] No new console errors
- [ ] Visual regression: ≤2% per screen
- [ ] Haptics still fire (manual verification на mobile)

**Claude Code prompt seed:**

```
Extract feel layer (haptics, animations, particles, narrator) to src/feel/. Reference docs/plan/00_EXECUTION_PLAN.md Section 5.1 and Section 4.2 (Sacred Cows).

CRITICAL SACRED COWS in this task:
- V_HAPTICS table values — DO NOT change any number
- NARRATOR_LINES strings — DO NOT change any string (Darkest Dungeon voice = identity)
- Animation timing constants (180ms flash, 440ms shake, 5-beat boss death) — DO NOT change

Steps:
1. Locate in _legacy/: V_HAPTICS, vHaptic, NARRATOR_LINES, speakNarrator
2. Locate animation functions: vPlayLineClearBurst, vPlayCritFlash, vPlayBossDieFx
3. Create src/feel/haptics.js, animations.js, particles.js, narrator.js
4. Pure relocation — copy code as-is, wrap in named exports
5. Run smoke + visual regression
6. Manual: test on a mobile device, verify haptics still work

DO NOT change any value, timing, or string. Pure relocation only.
DO NOT optimize or refactor functions during this task.
```

---

### T1.10 — Extract core game logic to `src/core/`

**Status:** pending
**Phase:** 1
**Estimated complexity:** XL
**Goal:** Core game logic (battle, grid, heroes, bosses, FTUE state, stagger loop, damage channels) → `src/core/`.
**Why now:** Самая большая task в Phase 1. Делаем после CSS / data / services / feel — minimizes risk.
**Depends on:** T1.09
**Files affected:** `src/core/*.js`, eventually `_legacy/` removed

**What to do:**

1. Identify functional groups в legacy JS:
   - **battle.js** — main battle loop, dealDamage, applyChannelDamage, damage clamps
   - **grid.js** — board state, line clears, void cells, grid saturation check
   - **heroes.js** — hero state, ULT charging, fire(), tier abilities
   - **bosses.js** — boss state machine (Active/Stagger/Recovery), bossAttack, archetype handlers
   - **stagger-loop.js** — Pressure meter, state transitions, overflow conversion (v2.1 P2)
   - **damage-channels.js** — 4 channels (DEAD_ZONE, VOID, SIGNATURE, GRID_SATURATION) (v2.1 P1)
   - **reactivity-events.js** — phase-gate adaptations (v2.1 P4)
   - **ftue-state.js** — FTUE state machine, beat transitions, density-aware overlays
   - **progression.js** — chapter progress, hero unlocks, ascensions, mythic
2. Each module:
   - Imports from `src/data/`
   - Imports from `src/feel/`
   - Imports from `src/services/`
   - Exports public API
   - **No window-globals** (если кому-то нужно — explicit `globalThis.X = ...`)
3. **Migrate carefully:**
   - One sub-system at a time
   - After each: smoke test pass
   - If anything fails: revert that sub-system, investigate
4. **Replace `_legacy/blocksworn_index_fixed.html`** at end:
   - Old HTML файл remove from runtime path
   - Keep as `_legacy/_archive_blocksworn_v1.html` for reference
   - `index.html` теперь использует только `src/main.js`
5. Verify: full FTUE play-through manually

**Acceptance criteria:**
- [ ] Все 9 core modules созданы и functional
- [ ] No window-global pollution (audit: `grep -r "window\." src/core/` = 0 results, except `window.addEventListener`)
- [ ] All v2.1 systems still work: 4 channels, Stagger Loop, Hero Tiers, TTK boss HP
- [ ] FTUE complete in <10 min (smoke test)
- [ ] Chapter 1 Boss 1 winnable (smoke test)
- [ ] Tower floor 1-5 progression (smoke test)
- [ ] No `console.error` in production build
- [ ] Bundle size < 5MB

**Claude Code prompt seed:**

```
Extract core game logic to src/core/ modules. Reference docs/plan/00_EXECUTION_PLAN.md Section 5.1 and Section 4 (Sacred Cows).

CRITICAL CONTEXT: This is THE largest task in Phase 1. ~50% of Phase 1 effort.

Approach: ONE SUB-SYSTEM AT A TIME. Do not try to do everything at once.

Sub-systems (in order):
1. ftue-state.js — FTUE state machine (lowest risk, well-isolated)
2. progression.js — chapter / hero unlocks / ascension
3. grid.js — board state, line clears, void cells
4. heroes.js — hero state, ULT, fire(), tier abilities
5. damage-channels.js — 4 channels (v2.1 P1)
6. stagger-loop.js — Pressure / Stagger / Recovery (v2.1 P2)
7. bosses.js — boss state machine, archetypes
8. reactivity-events.js — phase-gate events (v2.1 P4)
9. battle.js — main loop, ties everything together

After each sub-system:
1. Replace _legacy/ usage of those functions with imports from src/core/
2. Run npm run test:smoke
3. If pass: commit "[T1.10.N] Extract <subsystem>" (use sub-numbering)
4. If fail: revert the sub-system, investigate

DO NOT change any combat math.
DO NOT touch sacred cows (Section 4).
DO NOT introduce new bugs while moving code.

Final step: replace index.html to use src/main.js only. Move _legacy/ to _legacy/_archive_v1/. Verify full FTUE manually.
```

---

### T1.11 — Extract UI screens to `src/ui/`

**Status:** pending
**Phase:** 1
**Estimated complexity:** L
**Goal:** Per-screen rendering / event handling → `src/ui/*.js`.
**Why now:** После logic migration. UI screens depend on core game state.
**Depends on:** T1.10

**What to do:**

1. Per-screen modules:
   - `menu.js` — home hub
   - `battle-screen.js` — combat UI
   - `shop.js`
   - `tower.js`
   - `season.js` — battle pass
   - `profile.js`
   - `select.js` — squad selection
   - `dailies.js`
2. Каждый screen:
   - Imports from `src/core/`
   - Imports from `src/feel/`
   - Exports `render<ScreenName>()`, `setup<ScreenName>EventListeners()`, `cleanup<ScreenName>()`
3. Replace inline `onclick="..."` handlers with explicit `addEventListener` calls в setup function
4. **DOM IDs preserved exactly** для visual regression compatibility

**Acceptance criteria:**
- [ ] All 8 screens migrated
- [ ] No inline `onclick="..."` handlers in HTML
- [ ] All event handlers via `addEventListener`
- [ ] Visual regression ≤2% per screen
- [ ] Smoke tests pass

**Claude Code prompt seed:**

```
Extract UI screens to src/ui/ modules. Reference docs/plan/00_EXECUTION_PLAN.md Section 5.1.

Steps:
1. Per-screen module mapping:
   - Menu (home hub) → src/ui/menu.js
   - Battle screen → src/ui/battle-screen.js
   - Shop, Tower, Season, Profile, Select, Dailies similarly
2. Each module exports: render<Screen>(), setup<Screen>EventListeners(), cleanup<Screen>()
3. Replace inline onclick="..." with addEventListener in setup functions
4. Preserve ALL DOM IDs exactly (visual regression compatibility)
5. Run visual regression after each screen migration

DO NOT change DOM structure or IDs.
DO NOT change UI text.
DO NOT change layout.
```

---

### T1.12 — Wire `main.js` entry point

**Status:** pending
**Phase:** 1
**Estimated complexity:** S
**Goal:** Bootstrap sequence в `src/main.js`.
**Why now:** Tie everything together.
**Depends on:** T1.11

**What to do:**

```js
// src/main.js
import './styles/index.css';

import { initFirebase } from './services/firebase.js';
import { initRevenueCat } from './services/revenuecat.js';
import { initSentry } from './services/sentry.js';
import { initStorage } from './services/storage.js';

import { loadGameState } from './core/progression.js';
import { initFTUE } from './core/ftue-state.js';

import { renderMenu, setupMenuEventListeners } from './ui/menu.js';
import { setupRouting } from './ui/router.js';

async function main() {
  // 1. Init services
  initSentry();
  await initFirebase();
  initRevenueCat();
  initStorage();

  // 2. Load state
  await loadGameState();
  initFTUE();

  // 3. Setup routing + render initial screen
  setupRouting();

  // Determine initial screen
  if (isFtueActive()) {
    showScreen('battle'); // FTUE pyredrake
  } else {
    showScreen('menu');
  }
}

main().catch(err => {
  console.error('Boot failed:', err);
  Sentry?.captureException(err);
});
```

**Acceptance criteria:**
- [ ] `main.js` < 100 lines
- [ ] Async init order correct (Sentry first → Firebase → RC → Storage → Game)
- [ ] Bootloader handles errors via Sentry
- [ ] No console errors на cold start

---

### T1.13 — Verify game runs identically + visual regression pass

**Status:** pending
**Phase:** 1
**Estimated complexity:** M
**Goal:** Полная manual + automated verification что migration complete.
**Why now:** Gate перед cleanup phase. Если game broken — fix before deleting legacy.
**Depends on:** T1.12

**What to do:**

1. Run full smoke test suite: `npm run test:smoke`
2. Run visual regression: `npm run test:visual`
3. **Manual playthrough:**
   - Cold start → menu loads in <3 sec
   - Open shop → purchases (mock) work
   - Battle Pass screen renders
   - Tower floor 1-5 wins
   - FTUE complete (если save state allows)
4. **Performance check:**
   - First Contentful Paint < 1.5 sec (Lighthouse)
   - Time to Interactive < 3 sec
   - Bundle size < 5MB
5. Document anything unexpected в `docs/migration-notes.md`

**Acceptance criteria:**
- [ ] All smoke tests green
- [ ] Visual regression ≤2% on all screens
- [ ] Manual playthrough completes без errors
- [ ] Lighthouse score ≥90 mobile
- [ ] Bundle <5MB
- [ ] No console.error on any tested user-flow

**If any fail:** add T1.13.1+ for fixes, do not proceed to T1.14.

---

### T1.14 — DELETE artifact subsystem (v2.1 P1 §4 completion)

**Status:** pending
**Phase:** 1
**Estimated complexity:** L
**Goal:** Полностью удалить артефакт-related code (v2.1 P1 didn't finish).
**Why now:** Самый большой piece of accumulated debt. Easy to delete теперь когда modular.
**Depends on:** T1.13

**What to do:**

1. **Inventory artifact code** (grep across `src/`):
   - Functions: `applyArtifact*`, `mergeArtifact*`, `equipArtifact*`, `getArtifact*`, `dropArtifact*`
   - Constants: `ARTIFACTS`, `ARTIFACT_*`, `artId()`
   - State variables: `state.artifacts`, `hero.artifact`, `boss.artifactDrop`
   - UI: artifact panels, merge UI, equip slots in hero detail
2. **Storage migration** (one-time):
   ```js
   // src/services/storage.js — добавить migration step
   export function migrateRemoveArtifacts() {
     const state = getItem('blocksworn_state');
     if (state?.artifacts) {
       delete state.artifacts;
       setItem('blocksworn_state', state);
     }
     removeItem('blocksworn_artifacts');
     removeItem('blocksworn_artifact_pity');
     // ... other artifact-related keys
   }
   ```
3. **Boss drops:** заменить artifact drops на equivalent gold/cards (compensate value):
   - Pyredrake old: orc_ring (artifact) → new: 50g + 2 hero cards
   - Grunt old: orc_weapon (artifact) → new: 75g + 3 hero cards
4. **DELETE all artifact code**:
   - Functions
   - Constants
   - UI
   - CSS rules (.artifact-*, .merge-modal, etc.)
5. Run smoke + visual regression
6. **Verification:** `grep -r "artifact" src/` returns ONLY:
   - `// removed in T1.14` comments (acceptable)
   - References in `_legacy/_archive_v1/` (acceptable, archive)
   - 0 actual code references (required)

**Acceptance criteria:**
- [ ] Zero `applyArtifact*` etc. functions in src/
- [ ] Zero `ARTIFACTS` constants in src/
- [ ] All boss artifact drops replaced with gold + cards
- [ ] Storage migration runs cleanly on existing user state
- [ ] Smoke tests pass
- [ ] Visual regression: hero detail screen + boss drops screen MAY differ (intentional) — capture new baseline if so
- [ ] CHANGELOG.md entry: "Removed artifact subsystem (legacy)"

**Claude Code prompt seed:**

```
Delete artifact subsystem completely. This is incomplete work from v2.1 Phase 1 §4 (see _legacy/_archive_v1/ phase docs).

Reference: docs/plan/00_EXECUTION_PLAN.md Task T1.14.

Steps:
1. Inventory all artifact code via grep
2. Plan boss drop replacements (artifacts → gold + cards equivalent)
3. Add migrateRemoveArtifacts() to src/services/storage.js
4. Delete all artifact functions, constants, UI, CSS
5. Replace boss drops in src/data/bosses.js
6. Run all smoke tests
7. Run visual regression — UPDATE BASELINE for hero-detail and boss-drops screens (intentional change)
8. CHANGELOG.md update
9. Commit: "[T1.14] Delete artifact subsystem (v2.1 P1 §4 completion)"

DO NOT preserve any artifact code "for later". Complete removal.
DO NOT change ascension or merge mechanics for OTHER systems (hero cards, etc.).
DO NOT remove RACE_SYNERGY or hero passives — those are separate systems.

If user state migration fails for any user — log warning, continue. Don't crash.
```

---

### T1.15 — DELETE Cosmic Memorial (v2.1 P5 §7 Final Legacy Purge completion)

**Status:** pending
**Phase:** 1
**Estimated complexity:** S
**Goal:** Удалить Cosmic Memorial dead code (помечен removed в comments, но renderer + CSS остался).
**Why now:** Continuation of v2.1 incomplete cleanup.
**Depends on:** T1.14

**What to do:**

1. Find `vCosmicMemorial`, `vRenderCosmicMemorial`, `cosmic-memorial-*` CSS
2. Delete всё — это уже не используется
3. Remove early-return guards в other code that mentioned it

**Acceptance criteria:**
- [ ] `grep -ri "cosmic.memorial" src/` returns 0 results
- [ ] No CSS rules `.a-hub-memorial*`
- [ ] Smoke tests pass

---

### T1.16 — DELETE legacy --v-* CSS tokens (already partial)

**Status:** pending
**Phase:** 1
**Estimated complexity:** S
**Goal:** Final cleanup of `--v-*` deprecated CSS tokens.
**Why now:** Done together with other legacy purge.
**Depends on:** T1.15

**What to do:**

1. `grep -r "--v-" src/styles/` (variable definitions + usages)
2. Verify zero references в JS/CSS (should already be from T1.06)
3. Remove from `tokens.css` если ещё остались

**Acceptance criteria:**
- [ ] Zero `--v-*` references in src/

---

### T1.17 — Replace 100-hearts UI in combat top bar

**Status:** pending
**Phase:** 1
**Estimated complexity:** M
**Goal:** Combat top bar показывает HP scalably (не 100 individual heart icons).
**Why now:** This is your specific complaint — explicit visible debt.
**Depends on:** T1.16
**Files affected:** `src/ui/battle-screen.js`, `src/styles/screens/battle.css`

**What to do:**

1. **New design:** scaled HP bar + numeric value:
   ```
   ┌──────────────────────────────────────┐
   │ ❤  ████████████████░░░░  80 / 100  │
   └──────────────────────────────────────┘
   ```
2. Optional: 5 large heart icons (each = 20 HP), filled/empty state, для visual flair
3. Implement в battle-screen.js
4. Visual regression: battle screen MUST update baseline

**Acceptance criteria:**
- [ ] HP visible without 100 individual icons
- [ ] Updates correctly during damage / healing
- [ ] Mobile (small viewport) — readable
- [ ] Visual regression baseline updated

---

### T1.18 — Consolidate shop pack systems

**Status:** pending
**Phase:** 1
**Estimated complexity:** M
**Goal:** Multiple PACK_* systems (PACK_PREMIUM, PACK_BIG, PACK_RACE, PACK_STANDARD, STARTER_PACK, TOWER_CLIMBER_PACK, etc.) → unified system.
**Why now:** Cleaner monetization config, fewer chances for inconsistency.
**Depends on:** T1.17

**What to do:**

1. Inventory всех PACK_* constants across legacy:
   - `PACK_PREMIUM_*` (cards, gold, T2)
   - `PACK_BIG_*` (cards, gold, T2)
   - `PACK_STANDARD_*`
   - `PACK_RACE_*`
   - `STARTER_PACK_*`
   - `TOWER_CLIMBER_PACK_*`
   - `HERO_CARD_PACKS`
   - `RESOURCE_PACKS`
2. Unified data model в `src/data/monetization-config.js`:
   ```js
   export const SHOP_PACKS = Object.freeze({
     starter: {
       id: 'starter',
       priceUSD: 1.99,
       contents: { gems: STARTER_PACK_GEMS, cards: STARTER_PACK_CARDS, ... },
       availability: 'first-purchase-bonus-eligible',
       window: { type: 'one-time' },
     },
     tower_climber: {
       id: 'tower_climber',
       priceUSD: 0.99,
       contents: { /* ... */ },
       availability: 'tower-active',
       window: { type: 'rolling-7-day' },
     },
     // ... все остальные packs
   });
   ```
3. Single shop renderer iterates SHOP_PACKS
4. Smoke test: shop opens, all packs render
5. Update IAP integration (RevenueCat) если skus поменялись (probably no — keep ids stable)

**Acceptance criteria:**
- [ ] All packs in `SHOP_PACKS` const
- [ ] Single rendering function
- [ ] Shop displays correctly
- [ ] IAP SKUs unchanged
- [ ] Visual regression: shop screen baseline updated если структура изменилась

---

### T1.19 — Complete v2.1 Mythic ability framework

**Status:** pending
**Phase:** 1
**Estimated complexity:** L
**Goal:** Verify (and complete if partial) Mythic ability system from v2.1 P3 §5.
**Why now:** Это foundation для endgame, который мы будем расширять в Phase 2-3.
**Depends on:** T1.18
**Files affected:** `src/core/heroes.js`, `src/data/heroes.js`, `src/ui/select.js`

**What to do:**

1. Read v2.1 P3 spec в `_legacy/_archive_v1/v21_phase_specs/PHASE_3_HERO_TIERS.md`
2. Verify в текущем коде:
   - One Mythic per save constraint
   - Mythic ability lookup table
   - Mythic ascension UI ("commitment moment")
   - Mythic ability fires correctly
3. **If partially implemented:** complete per spec
4. **If completely implemented:** verification PR (no code change), document в commit message
5. Smoke test: Mythic ascension triggers correctly

**Acceptance criteria:**
- [ ] One-Mythic-per-save enforced
- [ ] All 25 heroes have Mythic ability defined
- [ ] Ascension UI shows commitment screen
- [ ] Mythic ability fires correctly in battle
- [ ] Smoke test added: `tests/smoke/mythic-ascension.spec.js`

---

### T1.20 — Complete v2.1 Player Segments

**Status:** pending
**Phase:** 1
**Estimated complexity:** M
**Goal:** Verify / complete Player Segments (Whale/Dolphin/Minnow/F2P) from v2.1 P7 §2.
**Why now:** Final v2.1 cleanup. Used for analytics + Pinch system targeting.
**Depends on:** T1.19

**What to do:**

1. Read v2.1 P7 §2 spec
2. Implement / verify в `src/services/analytics.js`:
   ```js
   export function getPlayerSegment(state) {
     const totalSpentUSD = state.iap?.totalSpentUSD || 0;
     if (totalSpentUSD === 0) return 'F2P';
     if (totalSpentUSD < 25) return 'Minnow';
     if (totalSpentUSD < 100) return 'Dolphin';
     return 'Whale';
   }
   ```
3. Wire into analytics events
4. Wire into Pinch system targeting (если v2.1 spec требовал)

**Acceptance criteria:**
- [ ] Segment computed correctly per spec
- [ ] Logged with each major event
- [ ] Used in Pinch system if spec'd

---

## 14. Phase 2 Tasks

### T2.01 — Identity Layer design doc

**Status:** pending
**Phase:** 2
**Estimated complexity:** M
**Goal:** Spec doc для всех race/boss identity-effects (no code).
**Files affected:** `docs/design/identity-layer.md`

**What to do:**

Создать `docs/design/identity-layer.md` со спецификацией:

```markdown
# Identity Layer Spec

## Race line-clear flavors

### Pirate (Ember)
- **Visual:** золотая монета (animated SVG) вылетает из каждой clear-cell
- **Mechanical:** +5 gold per cell cleared
- **Sound:** light coin clink, layered with normal clear sfx
- **Haptic:** none (uses standard `clear`)
- **Counter:** none — pure flavor

### Shark (Tide)
- **Visual:** "bite" arc effect — chomping teeth animation
- **Mechanical:** clears adjacent 1 cell to each cleared row/col (max 4 extra cells per line)
- **Sound:** wet bite sound + water splash
- **Counter:** boss summons void cells faster
- **Note:** Stacks with Combo Crit

[... все 5 races ...]

## Boss-reactive mechanics

### Phoenix archetype (revive moment)
- On revive: board gets "burning" overlay for 5 seconds
- During burning: only Ember pieces accepted
- After 5 sec: board returns to normal
- This creates a memorable moment + tests adaptive play
- VFX: animated flame border + heat distortion

[... остальные archetypes ...]
```

**Acceptance criteria:**
- [ ] Spec covers все 5 races + 5+ boss archetypes
- [ ] Each effect: visual / mechanical / sound / haptic / counter
- [ ] Performance budget per effect (max 60ms wall time, max 100 particles)
- [ ] Approved by user (review gate)

---

### T2.02 — Pirate line-clear flavor

**Status:** pending
**Phase:** 2
**Estimated complexity:** M
**Depends on:** T2.01
**Files affected:** `src/feel/identity-fx.js`, `src/core/grid.js`, `src/data/races.js`

**What to do:**

1. Add to `src/feel/identity-fx.js`:
   ```js
   export function fxPirateLineClear(rows, cols, squad) {
     const pirateCount = squad.filter(h => h.race === 'pirate').length;
     if (pirateCount === 0) return;

     const goldDropPerCell = 5 * pirateCount;

     // Visual: spawn coin particles
     spawnCoinParticles(rows, cols, goldDropPerCell);

     // Mechanical: add gold (delegate to game state)
     return { goldBonus: countCells(rows, cols) * goldDropPerCell };
   }
   ```
2. Wire в `clearLines` flow:
   ```js
   const result = fxPirateLineClear(rows, cols, squad);
   state.gold += result?.goldBonus || 0;
   ```
3. Add `spawnCoinParticles` to `src/feel/particles.js`
4. Smoke test: `tests/smoke/identity-pirate.spec.js`
5. Visual regression: battle screen with Pirate squad — new baseline

**Acceptance criteria:**
- [ ] Pirate clear → coins fly visually
- [ ] Gold added correctly (5 × pirateCount × cellsCleared)
- [ ] No effect if 0 pirates in squad
- [ ] Stacks correctly with combo crit
- [ ] Smoke test passes
- [ ] Performance: <16ms additional frame time даже на 5x crit clear

---

### T2.03 — T2.06 — Shark / Rock Band / Crocodile / Spark line-clear flavors

**Status:** pending
**Phase:** 2
**Estimated complexity:** M each
**Depends on:** T2.02 (uses same pattern)

Same structure as T2.02, для each race per spec в T2.01.

**Per-race acceptance criteria:**
- Visual effect implemented
- Mechanical effect functional
- Sound integrated
- Stacks correctly with Combo Crit
- Performance ≤16ms additional
- Smoke test added

---

### T2.07 — Boss-reactive: Phoenix board burn

**Status:** pending
**Phase:** 2
**Estimated complexity:** L
**Depends on:** T2.06
**Files affected:** `src/core/bosses.js`, `src/feel/identity-fx.js`, `src/core/grid.js`

**What to do:**

1. On Phoenix revive (existing Phoenix archetype hook):
   ```js
   if (boss.archetype === 'phoenix') {
     enterBurningBoard(); // new identity-fx
   }
   ```
2. `enterBurningBoard()`:
   - Sets state flag `boardBurningUntil = now + 5000`
   - Spawns burning border VFX
   - Audio: roaring fire ambient
3. During burning state:
   - `pieceCanBePlaced(piece)` returns false unless `piece.element === 'ember'`
   - UI shows "EMBER ONLY" prompt
4. After 5 seconds:
   - Clear flag
   - Stop VFX
5. Smoke test: Phoenix boss → revive → board enters burning → ember piece placed → exits burning

**Acceptance criteria:**
- [ ] Phoenix revive triggers burning state
- [ ] Only ember pieces accepted during burn
- [ ] Visual: clear "burning" indication
- [ ] Audio plays
- [ ] Auto-exits after 5 sec
- [ ] Smoke test passes

---

### T2.08 — T2.11 — Other boss-reactive mechanics

**Status:** pending
**Phase:** 2

Per T2.01 spec — Lich curse cells, Berserker pressure pulse, Engineer lockdown variations, etc.

---

### T2.12 — Codex screen

**Status:** pending
**Phase:** 2
**Estimated complexity:** L
**Files affected:** `src/ui/codex.js`, `src/styles/screens/codex.css`

**What to do:**

Galleria of:
- All races (encountered + locked silhouettes)
- All bosses (encountered + locked)
- Identity moments witnessed (Phoenix burns, Lich curses, etc. — counts visible)

**Acceptance criteria:**
- [ ] Codex accessible from main menu (drawer entry)
- [ ] Shows progress: "8/25 heroes encountered"
- [ ] Click on race → detail page (passives, lore, member heroes)
- [ ] Click on boss → detail page (after first encounter)

---

## 15. Phase 3 Tasks

### T3.01 — Adventures backend design

**Status:** pending
**Phase:** 3
**Estimated complexity:** L
**Files affected:** `docs/adr/003-adventures-backend.md`

Architecture Decision Record для:
- Firestore vs RTDB?
- Schema for Adventures, Members, Weekly Targets, Boss-of-the-Week
- Rate limits
- Cost estimation

---

### T3.02 — T3.05 — Adventures implementation

Standard breakdown — create/join, weekly target, boss-of-week, member contributions UI.

---

### T3.06 — Friend leaderboard mini-block

Component на home hub — top 5 friends in this week's Tower.

---

### T3.07 — T3.09 — Replay/Share infrastructure

- Auto-record (MediaRecorder)
- navigator.share integration
- Watermark + Friend Code overlay
- Auto-prompt after memorable moments

---

### T3.10 — Party Tower design

ADR: async turn-based architecture (per Section 8.3).

---

### T3.11 — T3.13 — Party Tower implementation

Backend, matchmaking, turn UI, shared rewards.

---

### T3.14 — Tower endless mode

After floor 50, infinite scaling.

---

### T3.15 — Rotating seasonal modifiers

"Tide-only week", "double damage week", etc. в `TOWER_SEASON_MODIFIERS` data.

---

## 16. Phase 4 Tasks

### T4.01 — Chia design doc finalization

`docs/design/chia-integration.md` finalized after Phase 3 validation.

---

### T4.02 — Chia testnet wallet integration

Sage / Chia Wallet connect flow. Feature flag gated.

---

### T4.03 — T4.06 — NFT-hero data model + minting + trading

Standard breakdown.

---

### T4.07 — Adventure DAO

Wallet-gated async clans.

---

### T4.08 — PURE PATH CHAIN leaderboard

Walletted F2P segregation.

---

### T4.09 — Mobile feature flag

`isChiaEnabled()` enforced on all entry points.

---

### T4.10 — Anti-P2W audit

Statistical analysis: NFT vs non-NFT performance parity.

---

### T4.11 — Closed beta with crypto users

100-300 testers, 2-4 weeks.

---

### T4.12 — Production launch sequence

Wave 1 (Chia community), Wave 2 (crypto gaming media), Wave 3 (mainstream).

---

# SECTION E: WORKING WITH CLAUDE CODE

## 17. CLAUDE.md repository file

This is what goes into `CLAUDE.md` at repo root:

```markdown
# Working with Blocksworn — Claude Code Conventions

This file is read at the start of every Claude Code session.

## Sacred Cows — DO NOT MODIFY

These systems work correctly. Any change risks regression without upside.

### Combat Math
- `combo crit formula: total_dmg × (1 + dominantCount × combo × 10%)`
- `Element synergy: 2x→-2 ULT, 3x→-4+20%, 5x→-6+50%+30% start`
- `RACE_SYNERGY` 2x/3x/5x bonuses
- `TIER_COSTS_V18: {1:1, 2:2, 3:3, 4:5}`
- `HERO_ULT_COST_BY_NEWROLE: warrior:80, mage:100, hunter:120, tank:80, captain:100`
- `BOSS_TTK_TARGETS` (TTK formula)

### Feel Layer
- `V_HAPTICS table values` (in src/feel/haptics.js)
- `vPlayCritFlash` timing (180ms flash, 440ms shake)
- `5-beat boss death cinematic` (vPlayBossDieFx)
- `NARRATOR_LINES strings` (Darkest Dungeon voice = identity)

### Economy
- `GEM_PACKS price ladder` ($0.99/$4.99/$9.99/$19.99/$49.99/$99.99)
- `First Purchase Bonus formula` (+50% gems)
- `Battle Pass tier formula` (xp = 500 + tier × 150)
- `Tower retry gem ladder` ([100, 200, 400])

### v2.1 implemented systems
- `4-channel damage system`
- `Stagger Loop / Recovery state`
- `HERO_TIER_ABILITIES`
- `TOWER_LEADERBOARDS`
- `TOWER_PACTS`
- `Uroboros seasonal boss`
- `FTUE_BOSS_GUARANTEES`

If a task requires modifying any sacred cow → escalate, do not proceed.

## Operating Principles

1. **Test-first**: smoke + visual regression must pass before any merge
2. **Atomic tasks**: one PR = one task = one commit
3. **No parallel feature work** during Phase 1 (Foundation Reset)
4. **Rollback-first**: if a PR breaks tests → `git revert`, don't fix-forward
5. **Visual diff threshold**: ≤2% pass, 2-5% review, >5% fail

## Repository Structure

See docs/plan/00_EXECUTION_PLAN.md Section 5.

## Commit Message Format

`[T<X.YY>] <description>`

Examples:
- `[T1.01] Setup Vite scaffold`
- `[T1.14] Delete artifact subsystem`
- `[T2.02] Implement Pirate line-clear flavor`

## Before Starting Any Task

1. Read this CLAUDE.md
2. Read docs/plan/00_EXECUTION_PLAN.md for the specific task
3. Check sacred cows list — confirm task does NOT modify them
4. Verify dependencies completed (check task spec)
5. Run `npm test` baseline — ensure clean before starting

## After Completing Any Task

1. Run `npm test` — all green
2. Run `npm run test:visual` — within thresholds
3. Verify acceptance criteria from task spec
4. Commit with proper message format
5. Open PR — wait for CI green before merging

## Common Pitfalls

- Forgetting to update visual regression baseline when intentional change
- Removing code that LOOKS unused but is referenced by string (e.g., `localStorage.getItem('FOO')` referenced as string elsewhere)
- Adding new globals to window scope (BANNED — use ES modules)
- Modifying CSS variable values during refactor (BANNED — relocate only)
- Adding console.log to production code (use src/services/logger.js)

## Escalation

If you encounter:
- Conflicting task specs → escalate to user before proceeding
- Sacred cow modification needed → escalate before any change
- Smoke test fails after task → revert + escalate
- Visual regression >5% diff → revert + escalate
```

---

## 18. Task Template

Для добавления новых tasks в плане:

```markdown
### TX.YY — <short description>

**Status:** pending | in-progress | done | blocked
**Phase:** 1 | 2 | 3 | 4
**Estimated complexity:** S (1d) | M (3d) | L (1w) | XL (2-3w)
**Goal:** [one sentence: what does this task accomplish]
**Why now:** [why this task is at this position in dependency chain]
**Depends on:** [task IDs or "none"]
**Files affected:** [explicit list of paths]

**What to do:**
1. [step 1]
2. [step 2]
...

**Acceptance criteria:**
- [ ] [testable item 1]
- [ ] [testable item 2]
...

**Smoke tests added/updated:**
- `tests/smoke/<name>.spec.js`
- `tests/visual/baseline/<screen>.png` (if updated)

**Rollback plan:** [how to undo if needed]

**Claude Code prompt seed:**
```
[the actual prompt to give Claude Code, complete and runnable]
```
```

---

## 19. Rollback Procedures

### 19.1 PR breaks main

```bash
git checkout main
git pull
git revert <bad-commit-sha> --no-edit
git push
```

CI re-runs. Если green → bad PR is reverted, work continues.

### 19.2 Storage migration broke users

If `migrateRemoveArtifacts()` (from T1.14) или similar breaks user state:

1. Revert deployment immediately
2. Check Sentry for migration errors
3. Add fallback: if migration throws, log to Sentry but do NOT crash app
4. Re-deploy with fallback
5. Investigate offline

### 19.3 Visual regression false positive

If visual diff >5% but change is intentional:

1. Investigate in `tests/visual/diff/<screen>.png` (artifact)
2. If genuinely intentional: `npm run test:visual:update -- <screen>.png`
3. Commit new baseline with explanation: `[T1.X] Update <screen> baseline: <reason>`
4. Re-run CI

### 19.4 Smoke test flaky

1. Run 3 times — if 2/3 pass, it's flaky, not broken
2. Add wait conditions / retry logic
3. If genuinely broken: revert PR

---

## 20. Common Pitfalls

### 20.1 String references to removed code

Example: removed `applyArtifact` function, but `localStorage.getItem('artifact_pity')` references "artifact" as string.

**Solution:** during T1.14, do TWO greps:
- `grep -r "applyArtifact" src/` — function refs
- `grep -ri "artifact" src/` — string refs (broader)

### 20.2 Window-global pollution

Vanilla JS legacy code often uses `window.X = ...` для cross-file communication. This is BANNED in src/.

**Solution:** explicit ES module imports/exports.

### 20.3 Async ordering bugs

Firebase init must complete before storage migration (auth determines storage scope). Sentry must init before any potential error.

**Solution:** await chain in main.js. No "fire and forget".

### 20.4 CSS cascade order

Moving CSS to multiple files can break cascade. `tokens.css` must come before `components/`, which must come before `screens/`.

**Solution:** single `index.css` that imports in correct order. Document order with comments.

### 20.5 Forgetting visual regression update

After intentional UI change (T1.17 100-hearts → bar), forgetting to update baseline → CI fails forever.

**Solution:** task acceptance criteria explicitly includes "update baseline if intentional change".

---

# SECTION F: APPENDICES

## 21. Risk Register

| # | Risk | Probability | Impact | Mitigation |
|---|------|-------------|--------|------------|
| 1 | Vite migration introduces subtle regression | Medium | High | Smoke tests + visual regression on every task |
| 2 | Removing artifacts breaks ascension flow elsewhere | Low | High | T1.14 thorough grep + storage migration |
| 3 | v2.1 incomplete items more broken than thought | Medium | Medium | T1.19, T1.20 verify before completing |
| 4 | Phase 2 identity FX hurts performance | Medium | Medium | Per-effect budget 16ms, profiling required |
| 5 | Adventures backend cost > expected | Medium | Medium | Use Firestore (not RTDB), aggressive caching |
| 6 | Party Tower async UX confusing | Low | Medium | Closed beta validation before scale |
| 7 | Chia gas costs hurt economics | Low (Chia low-gas) | High | Batch minting strategies in T4.05 |
| 8 | Mobile (when ported) blocked by Apple/Google due to NFT | High if mobile pursued | High | Feature flag from day 1 (T4.09) |
| 9 | NFT P2W perception kills F2P | High | Critical | Strict no-power-creep + statistical audit (T4.10) |
| 10 | Team velocity < estimate → 6 months becomes 12 | Medium | Medium | Phase gates, no concurrent fhasen |

---

## 22. Glossary

| Term | Definition |
|------|------------|
| **Adventure** | Async clan для 5-15 игроков (Phase 3, ours) |
| **Aegis Conductor** | Tank role redesign (v2.1 P3) — converts damage to Pressure |
| **AAA+** | Polished standard где first 60s perfect, no rough edges |
| **Battle Pass** | Seasonal progression with free + premium tracks |
| **Combo Crit** | Multi-line clear damage multiplier |
| **Chronicler** | FTUE narrator character (sacred voice) |
| **Cosmic Memorial** | Removed feature (P5 §7), dead code in legacy |
| **Damage Channels** | 4-source damage system (v2.1 P1): DEAD_ZONE, VOID, SIGNATURE, GRID_SATURATION |
| **Dolphin** | Player segment: $25-$99 lifetime spend |
| **F2P** | Free-to-play (totalSpent === 0) |
| **First Purchase Bonus** | +50% gems on first purchase, sacred |
| **Founder Badge** | Soft-launch tester award (NFT candidate) |
| **FTUE** | First-Time User Experience |
| **Identity Layer** | Race × boss flavor mechanics (Phase 2, ours) |
| **Mythic** | Hero ascension tier 4 (one per save commitment) |
| **Party Tower** | 2-5 player async coop Tower mode (Phase 3, ours) |
| **Pinch System** | Soft monetization triggers at frustration moments |
| **Pressure Meter** | Skill-driven Stagger Loop gauge (v2.1 P2) |
| **PURE PATH** | F2P-only Tower leaderboard |
| **Reactivity Events** | Phase-gate boss adaptations (v2.1 P4) |
| **Sacred Cow** | System that must not be modified |
| **Squad Conductor** | Captain role redesign (v2.1 P3) — per-turn marshalling |
| **Stagger Loop** | Boss state machine: Active/Stagger/Recovery (v2.1 P2) |
| **Tower Hearts** | Currency for Tower retries |
| **Tower Pacts** | Slay-the-Spire-style Tower relics (v2.1 P9) |
| **TTK** | Time-to-Kill |
| **Uroboros** | Seasonal Tower mythic boss (v2.1 P9) |
| **Whale** | Player segment: $100+ lifetime spend |

---

## 23. Cross-reference с v2.1 specs

Где смотреть детали уже реализованных v2.1 систем:

| v2.1 System | Spec File (in `_legacy/_archive_v1/v21_phase_specs/`) | Status |
|-------------|-------------------------------------------------------|--------|
| 4-channel damage | PHASE_1_FOUNDATION.md §3 | ✅ Implemented |
| Mitigation Matrix | PHASE_1_FOUNDATION.md §3 | ✅ Implemented |
| Artifact removal | PHASE_1_FOUNDATION.md §4 | 🔴 INCOMPLETE → T1.14 |
| Stagger Loop | PHASE_2_STAGGER_LOOP.md | ✅ Implemented |
| Hero Tiers | PHASE_3_HERO_TIERS.md | ✅ Implemented |
| Aegis Conductor | PHASE_3_HERO_TIERS.md §3.4 | ✅ Implemented |
| Squad Conductor | PHASE_3_HERO_TIERS.md §3.5 | ✅ Implemented |
| Mythic Framework | PHASE_3_HERO_TIERS.md §5 | ⚠️ VERIFY → T1.19 |
| TTK Formula | PHASE_4_BOSS_RECALC.md §2 | ✅ Implemented |
| Reactivity Events | PHASE_4_BOSS_RECALC.md §4 | ⚠️ VERIFY |
| Inter-battle Screens | PHASE_5_POLISH_MONETIZATION.md §2 | ✅ Implemented |
| Final Legacy Purge | PHASE_5_POLISH_MONETIZATION.md §7 | 🔴 INCOMPLETE → T1.15 |
| Cosmic Ascension | PHASE_6_COSMIC_ASCENSION.md | ✅ Implemented |
| Hero Cards Economy | PHASE_6_COSMIC_ASCENSION.md §5 | ✅ Implemented |
| Tower Hearts | PHASE_6_COSMIC_ASCENSION.md §8 | ✅ Implemented |
| Battle Pass | PHASE_7_MONETIZATION.md §6 | ✅ Implemented |
| Player Segments | PHASE_7_MONETIZATION.md §2 | ⚠️ VERIFY → T1.20 |
| FTUE Restructure | PHASE_8_FTUE_RESTRUCTURE.md | ✅ Implemented |
| Tutorial Library | PHASE_8_FTUE_RESTRUCTURE.md §8 | ✅ Implemented |
| Tower Roster | PHASE_9_TOWER_SYSTEM.md §2 | ✅ Implemented |
| Tower Pacts | PHASE_9_TOWER_SYSTEM.md §4 | ✅ Implemented |
| Uroboros Seasonal | PHASE_9_TOWER_SYSTEM.md §6 | ✅ Implemented |
| Endgame Polish | PHASE_10_ENDGAME_POLISH.md | ✅ Implemented |

**Все v2.1 spec docs остаются в `_legacy/_archive_v1/v21_phase_specs/`** для reference. Не активные — но не удалять.

---

# Финальный совет

## Главный риск этого плана

**Phase 1 (Foundation Reset) длится 6-8 недель и не добавляет НИКАКОЙ новой функциональности.** Это может казаться демотивирующим. Но:

- После Phase 1 темп Phase 2-4 удвоится (нет debt drag)
- Visual regression защищает от регрессий
- Каждая task делает game STRICTLY лучше (cleanup) или identical (refactor)
- К концу Phase 1 у вас **production-ready foundation**

## Если что-то идёт не по плану

- **Phase 1 длится >10 недель:** STOP, пересмотр. Возможно estimates были оптимистичны.
- **Smoke test breaks многократно:** investigate **до** добавления retry/skip. Симптом design issue.
- **Visual regression noise:** возможно baseline нестабильна (animations не settle до screenshot). Increase wait time.
- **Claude Code путается между tasks:** упрощать task prompts. Каждый prompt должен fit в 1-2 paragraphs context.

## Reading order для нового Claude Code session

1. `CLAUDE.md` (always first)
2. `docs/plan/00_EXECUTION_PLAN.md` Section 1 (context)
3. `docs/plan/00_EXECUTION_PLAN.md` Section 4 (Sacred Cows)
4. The specific task you're about to do
5. Task acceptance criteria
6. Begin work

---

**Документ создан как execution-ready для CTO Claude Chat + Claude Code.**
**Каждая task atomic. Каждый sacred cow zafiksирован. Visual regression — gate на каждом шаге.**

> Aggressive ≠ reckless.
> Clean foundation now = 2x velocity later.
> Test-first или regression-later.

---

*Версия 1.0 | Создан 2026-05-10 | Execution Plan для Blocksworn → Chia launch*
