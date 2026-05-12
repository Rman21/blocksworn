# CLAUDE.md — Blocksworn Project Working Conventions

**Universal context for all Claude Code agents** (CTO / Game Developer / Game Designer / Bug Tester).

> Этот файл читается **первым** в каждой сессии любого агента, **до** ролевой инструкции.
> Содержит project-wide истину которую все 4 роли должны знать одинаково.

**Owner:** Roman (project lead, single human approver for all escalations)
**Document version:** 1.0
**Last update:** 2026-05-10

---

## Содержание

1. [Project at a glance](#1-project-at-a-glance)
2. [Sacred Cows — DO NOT MODIFY](#2-sacred-cows--do-not-modify)
3. [AAA+ Standards](#3-aaa-standards)
4. [Document Protocols](#4-document-protocols)
5. [Role Boundaries](#5-role-boundaries)
6. [Reference Materials](#6-reference-materials)
7. [Working Principles](#7-working-principles)
8. [Escalation Paths](#8-escalation-paths)
9. [Glossary](#9-glossary)

---

## 1. Project at a glance

### 1.1 Игра

- **Название:** Blocksworn
- **Жанр:** Block puzzle RPG (PvE) с асинхронной конкуренцией
- **Платформы:** Web/PWA (mobile-first), позже Chia blockchain integration
- **Стадия:** 70% готовности, 76% v2.1 reboot завершено, до запуска — Phase 1-4
- **Целевая аудитория:** Гибрид — обычные web-игроки + crypto

### 1.2 Stack

- **Runtime:** HTML5 / CSS3 / Vanilla JavaScript (ES Modules)
- **Build:** Vite
- **Test:** Playwright (smoke + visual regression), Vitest (unit)
- **CI:** GitHub Actions
- **External services:** Firebase (auth, Firestore), RevenueCat (IAP), Sentry (errors)
- **Будущее (Phase 4):** Chia (Sage / Chia Wallet, NFT-героев)

### 1.3 Endgame fantasy (locked)

Игрок на 100-й час игры имеет:
- Competitive seasonal Tower (solo + party 2-5 + Adventure 5-15 чел)
- Collections (codex races/bosses + identity moments)
- Upgrades (hero levels/tiers/Mythic + позже NFT-bound)

### 1.4 Текущая структура папок

После Phase 1 миграции:
```
blocksworn/
├── CLAUDE.md                    ← этот файл
├── docs/
│   ├── agents/                  ← инструкции ролей
│   │   ├── CTO_INSTRUCTION.md
│   │   ├── DEV_INSTRUCTION.md
│   │   ├── DESIGNER_INSTRUCTION.md
│   │   └── TESTER_INSTRUCTION.md
│   ├── plan/                    ← живые проектные документы
│   │   ├── PLAN.md              ← создаёт CTO
│   │   ├── TASKS.md             ← создаёт CTO
│   │   ├── REPORT.md            ← создаёт CTO
│   │   └── 00_EXECUTION_PLAN.md ← reference (от Roman)
│   ├── design/                  ← создаёт Designer
│   │   ├── mechanics/
│   │   ├── balance/
│   │   ├── ux/
│   │   ├── progression/
│   │   └── monetization/
│   ├── adr/                     ← Architecture Decision Records
│   └── _legacy/                 ← старые v2.1 specs + single HTML
│       ├── v21_phase_specs/
│       └── _archive_v1/
├── public/                      ← static assets
├── src/                         ← ES modules (после Phase 1)
├── tests/                       ← smoke + visual + unit
└── package.json
```

**ВАЖНО:** структура — целевая. На старте Phase 1 будет только `_legacy/`, остальное создаётся task-by-task. Не предполагать что папка существует — проверять.

---

## 2. Sacred Cows — DO NOT MODIFY

> Эти системы работают **точно** как должны. Любое изменение — risk без upside.
> Если task требует изменения sacred cow → **escalate, не делать**.

### 2.1 Combat математика

| System | Sacred value |
|--------|-------------|
| Combo crit формула | `total_dmg × (1 + dominantCount × combo × 10%)` |
| Element synergy 2x | `-2 ULT threshold` |
| Element synergy 3x | `-4 ULT, +20% passive damage` |
| Element synergy 5x | `-6 ULT, +50% damage, 30% start charge` |
| RACE_SYNERGY tiers | 2x/3x/5x bonuses per RACE_SYNERGY config |
| TIER_COSTS_V18 | `{1:1, 2:2, 3:3, 4:5}` |
| HERO_ULT_COST_BY_NEWROLE | `warrior:80, mage:100, hunter:120, tank:80, captain:100` |
| TTK formula (v2.1 P4) | `boss_hp = expected_squad_dps × target_ttk_seconds` |
| MAX_HP | `100 (фиксированный, v2.1 P1)` |

### 2.2 Feel layer

| System | Sacred value |
|--------|-------------|
| V_HAPTICS table | `{tap:10, place:15, clear:25, hit:30, crit:[30,20,30], levelup:[20,30,40], rareDrop:[40,40,40], victory:[100,50,100,50,200], defeat:[200]}` |
| vPlayCritFlash timing | `180ms flash + 440ms shake` |
| 5-beat boss death cinematic | `vPlayBossDieFx` sequence |
| Particle line clear pattern | направлены к bossImg coordinates |

### 2.3 Narrative voice

- **NARRATOR_LINES** строки (Darkest Dungeon-style poetry)
- **The Chronicler** character + portrait + cyan glow
- **chronicle_intro / chronicle_outro / intro** dialog copy
- **Boss names + element subtitles**
- **Tone:** poetic, terse, никогда не "coach-speak"

### 2.4 Economy

| System | Sacred value |
|--------|-------------|
| GEM_PACKS price ladder | `$0.99 / $4.99 / $9.99 (+10%) / $19.99 (+15%) / $49.99 (+20% MEGA) / $99.99 (+30% WHALE)` |
| First Purchase Bonus | `+50% gems + 1 Hero Card + Founder Badge` |
| Battle Pass tier formula | `xp = 500 + tier × 150` |
| Tower retry gem ladder | `[100, 200, 400]` |
| 3-min target Tower-боя | TTK target |

### 2.5 v2.1 implemented systems

Не изменять, только integrate с ними:
- 4-channel damage system (DEAD_ZONE, VOID, SIGNATURE, GRID_SATURATION)
- Stagger Loop / Recovery state
- HERO_TIER_ABILITIES
- BOSS_TTK_TARGETS
- TOWER_LEADERBOARDS (Global / F2P / Weekly)
- TOWER_PACTS
- Uroboros seasonal boss
- FTUE_BOSS_GUARANTEES
- The Chronicler narrator
- PURE PATH leaderboard

### 2.6 Что МОЖНО менять

Эти системы можно дорабатывать (не sacred):
- UI layout / hierarchy
- Animation choreography (новые animations OK; не менять existing timing для sacred elements)
- Asset replacement (изображения, аудио)
- Text content (кроме Narrator)
- New mechanics (если не conflict с sacred)
- Все systems которых ещё не существует

### 2.7 Procedure для изменения sacred cow

**ЕСЛИ task требует изменения sacred cow:**

1. **STOP.** Не делать.
2. **Escalate to CTO** с описанием:
   - Какая sacred cow
   - Почему task требует изменения
   - Альтернативы рассмотрены ли?
3. **CTO escalates to Roman** через REPORT.md секцию "ESCALATION REQUIRED"
4. **Wait for Roman's explicit approval** в чате
5. Если approved — обновить CLAUDE.md (удалить из sacred list) **до** изменения кода

---

## 3. AAA+ Standards

### 3.1 Feel (отклик)

| Метрика | AAA+ цель |
|---------|-----------|
| Тап → подсветка элемента | 0–50ms |
| Тап → начало анимации | < 100ms |
| Анимация результата | 100–300ms |
| Звук синхронен с анимацией | ±50ms |
| Haptic на критические события | обязательно (mobile) |
| Damage numbers движутся | не статичны |
| Screen feedback (shake/flash) | 0.1–0.3s на ключевых событиях |

### 3.2 Performance

| Метрика | AAA+ цель |
|---------|-----------|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3s |
| Bundle size | < 5MB |
| FPS (бой) | 60 stable |
| FPS (heavy сцены) | > 30 |
| Memory leak detection | 0 после 15 мин play |

### 3.3 Retention (для будущей валидации)

| Метрика | AAA+ цель |
|---------|-----------|
| D1 retention | > 40% |
| D7 retention | > 20% |
| D30 retention | > 10% |
| Avg session length | > 10 мин |
| Sessions/day | > 3 |
| ARPDAU | > $0.15 |

### 3.4 Code quality

| Standard | Limit |
|----------|-------|
| Function length | < 30 lines |
| File length | < 500 lines (split в modules) |
| Magic numbers | banned (только named constants) |
| `console.log` в production | banned (use `src/services/logger.js`) |
| Window globals | banned (ES modules only) |
| Duplication threshold | 3+ повторений = функция |
| `any` type comments | not allowed (vanilla JS — но имена переменных explicit) |

### 3.5 Test coverage

| Test type | Coverage requirement |
|-----------|---------------------|
| Smoke tests | All golden paths must pass |
| Visual regression | ≤2% pixel diff (pass), 2-5% (review), >5% (fail) |
| Unit tests | На критическую math (combat, tier, stagger) |
| Manual smoke | Перед каждым phase gate |

### 3.6 First 5 minutes (FTUE)

| Time | Standard |
|------|----------|
| 0–30s | Игрок делает первое действие. Без текста. |
| 30–90s | Первая микропобеда. Гарантирована. |
| 90–180s | Понял суть. Хочет ещё. |
| 3–5 мин | AHA момент. |
| 5 мин | Причина вернуться завтра озвучена. |

---

## 4. Document Protocols

### 4.1 Three living documents (создаются и обновляются CTO)

**`docs/plan/PLAN.md`** — мастер-план проекта
- Текущая фаза, статус, milestone
- Все 4 фазы (Foundation Reset / Identity Layer / Endgame Social / Chia)
- Все tasks (TODO / IN PROGRESS / REVIEW / DONE)
- Phase gates (go/no-go criteria)

**`docs/plan/TASKS.md`** — текущие задачи в работе
- Active tasks per role (DEV / DESIGNER / TESTER)
- Каждая task: ID, файлы, что сделать, не трогать, критерий
- Status updates real-time

**`docs/plan/REPORT.md`** — аудиты, репорты, эскалации
- Per-phase reports
- Bug testing results
- Escalation tickets для Roman
- Rollback log

### 4.2 ID conventions

- **TASK-NNN** — задачи (incrementing, never reused). E.g., TASK-001, TASK-042
- **BUG-NNN** — баги (incrementing). E.g., BUG-001
- **REPORT-NN** — репорты (incrementing). E.g., REPORT-01
- **ADR-NNN** — Architecture Decision Records. E.g., ADR-001
- **ESC-NN** — эскалации к Roman. E.g., ESC-01

### 4.3 Status lifecycle

**Tasks:**
```
TODO → IN PROGRESS → REVIEW → DONE
                  ↓
                BLOCKED (если зависимость не готова)
                  ↓
              RETURNED (CTO returned for fixes) → IN PROGRESS
```

**Bugs:**
```
OPEN → ASSIGNED → IN PROGRESS → FIXED → REGRESSION TEST → CLOSED
                                     ↓
                              REOPEN (если regression failed)
```

### 4.4 Commit message format

`[T<N>] <description>` для tasks
`[BUG-<N>] <description>` для bug fixes
`[DOCS] <description>` для doc updates only
`[REVERT] <reverted commit hash>` для rollbacks

Примеры:
- `[T1.07] Extract data constants to src/data/`
- `[BUG-023] Fix HP not updating after Phoenix revive`
- `[DOCS] Update PLAN.md after Phase 1 completion`

### 4.5 PLAN.md template

```markdown
# Blocksworn — Master Plan

## Project Status
- **Current phase:** [N — name]
- **Phase progress:** [X / Y tasks done]
- **Overall progress:** [X%]
- **Next milestone:** [what / when]
- **Last updated:** [date by CTO]

## Phase 1: Foundation Reset
**Status:** [NOT_STARTED / IN_PROGRESS / DONE]
**Goal:** Modular ES Modules + Vite + v2.1 cleanup completion
**Estimated:** 6-8 weeks

### Tasks
- [x] TASK-001: Setup Vite scaffold — DONE (2026-05-15)
- [x] TASK-002: Create CLAUDE.md — DONE (2026-05-15)
- [ ] TASK-003: Setup Playwright — IN PROGRESS (Game Dev)
- [ ] TASK-004: Capture visual baseline — TODO
- ...

### Phase Gate Criteria
- [ ] All smoke tests pass
- [ ] Visual regression ≤2% on all screens
- [ ] Bundle <5MB
- ...

## Phase 2: Identity Layer
**Status:** NOT_STARTED
...

## Phase 3: Endgame Social
...

## Phase 4: Chia Integration
...
```

### 4.6 TASKS.md template

```markdown
# Active Tasks

## GAME DEVELOPER

### TASK-007 — Extract feel layer to src/feel/
**Status:** IN PROGRESS
**Priority:** HIGH
**Phase:** 1
**Assigned:** 2026-05-20
**Files:**
  - src/feel/haptics.js (new)
  - src/feel/animations.js (new)
  - src/feel/particles.js (new)
  - src/feel/narrator.js (new)
**What to do:**
  - Locate V_HAPTICS, vHaptic, NARRATOR_LINES in _legacy/
  - Move to respective src/feel/*.js files as named exports
  - Keep all values exactly identical
**DO NOT TOUCH:**
  - V_HAPTICS values (sacred — see CLAUDE.md §2.2)
  - NARRATOR_LINES strings (sacred — see CLAUDE.md §2.3)
  - Animation timing constants
**Acceptance criteria:**
  - [ ] All sacred values identical to legacy
  - [ ] Smoke tests pass
  - [ ] Visual regression ≤2%
  - [ ] Manual: haptics fire on mobile device test
**Pass to Claude Code:**
"Extract feel layer (haptics, animations, particles, narrator) to src/feel/. Reference CLAUDE.md §2.2-2.3 for sacred cows.

Files to create:
- src/feel/haptics.js (V_HAPTICS + vHaptic)
- src/feel/animations.js (vPlayLineClearBurst, vPlayCritFlash, vPlayBossDieFx)
- src/feel/particles.js (particle creation)
- src/feel/narrator.js (NARRATOR_LINES + speakNarrator)

Pure relocation. DO NOT change any value, timing, or string. Run smoke tests after."

---

### TASK-008 — [Next task]
...

## GAME DESIGNER

### TASK-009 — Identity Layer design doc
...

## BUG TESTER

### TASK-010 — Smoke test for FTUE complete flow
...

## CLOSED TASKS (chronological, для истории)

### TASK-001 ✅ DONE 2026-05-15
Setup Vite scaffold. Files: package.json, vite.config.js, src/main.js
Commit: a1b2c3d
```

### 4.7 REPORT.md template

```markdown
# Reports & Audits

## REPORT-03: Phase 1 Foundation Reset Complete
**Date:** 2026-07-10
**Phase:** 1
**Author:** CTO

### Summary
Phase 1 завершён — Vite migration complete, v2.1 cleanup done, all smoke tests green.

### Done
- TASK-001 through TASK-020 all DONE
- Bundle size: 4.2MB (target <5MB ✅)
- First load: 2.1s (target <3s ✅)
- Visual regression: 0.8% avg (target ≤2% ✅)
- Smoke tests: 23 / 23 passing
- Artifact subsystem: 0 references found ✅
- Cosmic Memorial: 0 references found ✅

### Issues encountered
- TASK-014 (delete artifacts) returned twice — string references in localStorage keys missed initially
- Visual regression false positive on shop screen — captured new baseline T1.18

### Bug Tester findings
- 3 bugs found, 3 fixed (BUG-001 through BUG-003 in TASKS.md)
- 0 BLOCKER, 1 CRITICAL, 2 MAJOR

### Phase Gate Status
- ✅ All criteria met (see PLAN.md Phase 1 §6.5)
- Recommendation: GO to Phase 2

### Recommendations for Phase 2
- Identity Layer design doc (TASK-021) starts immediately
- Designer should reference v2.1 P4 archetype data в _legacy/v21_phase_specs/

---

## REPORT-02: ...

## ESCALATION ESC-01: Sacred Cow modification request
**Status:** AWAITING ROMAN APPROVAL
**Date:** 2026-06-15
**Origin:** TASK-014
**Issue:** Removing artifacts requires changing boss drop schedule (sacred? — see CLAUDE.md §2.4)
**Analysis:** Boss drops are NOT in sacred cows list. Proceeding without escalation.
**Resolution:** SELF-RESOLVED, no escalation needed.
```

---

## 5. Role Boundaries

### 5.1 Hierarchy

```
                    Roman (human owner)
                          ↑ (escalations only)
                    CTO (this Claude Code session)
                          ↑ (task results, status)
            ┌─────────────┼─────────────┐
            ↓             ↓             ↓
       Game Dev      Game Designer    Bug Tester
       (code)        (design docs)    (test reports)
```

### 5.2 Who does what

| Role | Does | Doesn't do |
|------|------|------------|
| **CTO** | Plans, assigns, reviews, documents, escalates | Writes code, designs mechanics, tests bugs |
| **Game Dev** | Writes code, fixes bugs, refactors, updates tests | Designs mechanics, decides priorities, plans phases |
| **Designer** | Designs mechanics, balance, UX, progression docs | Writes code, tests, decides architecture |
| **Tester** | Finds bugs, writes regression tests, reports | Fixes bugs, designs features, decides architecture |

### 5.3 Communication channels

**All communication через файлы:**
- TASKS.md — task assignments + status updates
- REPORT.md — phase reports + escalations + bug reports
- /design/ folder — design docs (Designer → Dev)
- /tests/ folder — test results
- Git commits — implementation evidence

**Никаких "verbal" сообщений** — всё фиксируется в файлах. Roman может прочитать всю историю проекта через эти документы.

### 5.4 Sequential workflow в Phase 1

В Phase 1 (Foundation Reset) — **strict sequential execution**:

```
CTO assigns TASK to Dev
    → Dev works (no parallel tasks)
        → Dev marks REVIEW
            → CTO reviews
                → DONE or RETURN with fix
                    → Dev fixes
                → CTO assigns next TASK
```

Phase 2-4 — **phase-locked pipeline:** Designer работает на N+1 пока Dev делает N (но в одной фазе).

### 5.5 Conflict resolution

**Designer ↔ Dev disagreement:**

1. Если Designer предлагает что Dev считает технически невозможным:
   - Dev пишет в TASKS.md под task: "TECHNICAL CONCERN: <details>"
   - CTO читает, оценивает
   - CTO может: (a) approve как есть, (b) request Designer revision, (c) escalate to Roman
2. Если CTO sam не может решить (architectural impact) → escalate to Roman через REPORT.md ESC-NN

**Tester ↔ Dev disagreement:**

1. Если Tester считает баг, Dev — feature:
   - CTO читает обе стороны
   - CTO решает: bug или by-design
   - Если by-design — CTO updates expected behavior в spec
   - Если bug — back to Dev для fix

**Sacred Cow violation:**

ESCALATE TO ROMAN. CTO не может одобрить sacred cow change.

---

## 6. Reference Materials

> Где искать дополнительный контекст. **Не дублировать сюда** — ссылаться.

### 6.1 На уровне проекта

- **`docs/plan/00_EXECUTION_PLAN.md`** — полный 4-phase execution plan, ~2700 строк, все tasks с acceptance criteria. **Главный reference для CTO.**
- **`docs/plan/PLAN.md`** — текущий статус (живой)
- **`docs/plan/TASKS.md`** — активные задачи (живой)
- **`docs/plan/REPORT.md`** — реporты + эскалации (живой)

### 6.2 v2.1 history (legacy reference)

- **`docs/_legacy/v21_phase_specs/`** — 10 phase docs (P1 Foundation → P10 Polish)
  - 76% уже implemented, остаётся cleanup в Phase 1
  - Использовать как detailed spec для existing systems
- **`docs/_legacy/_archive_v1/blocksworn_index_fixed.html`** — оригинальный single HTML
  - Read-only reference для migration
  - Никаких import'ов оттуда в новый код

### 6.3 Strategy / standards

- **`docs/Blocksworn_Strategic_Roadmap.md`** — стратегия с phase gates
- **`docs/AAA_PvP_Universal_Guide.md`** — общие AAA+ принципы (background reading)

### 6.4 Architecture Decision Records (ADR)

- **`docs/adr/001-vite-vanilla.md`** — почему Vite + Vanilla JS
- **`docs/adr/002-async-party-tower.md`** — почему async, не WebRTC
- **`docs/adr/003-no-power-creep-nft.md`** — strict no-P2W в Chia integration

CTO создаёт новые ADR при значимых архитектурных решениях.

### 6.5 External standards

- **AAA+ feel reference:** Marvel Snap, Brawl Stars, Clash Royale, Hades
- **Endgame depth reference:** Slay the Spire (Pacts), Genshin (Constellations), Diablo 4 (Paragon)
- **Async social reference:** Marvel Snap (async PvP), Words With Friends (turn-based)
- **Chia ecosystem:** Sage Wallet docs, Chia DEX info

---

## 7. Working Principles

### 7.1 Test infrastructure first

**До любого рефакторинга должны существовать:**
- Smoke tests для критических user-flows (`tests/smoke/`)
- Visual regression baseline (`tests/visual/baseline/`)
- CI pipeline проверяющий оба

Без них refactor вслепую → регрессия не обнаруживается.

### 7.2 Atomic tasks

Каждая task:
- **Один deliverable** (не "и refactor X и delete Y")
- **Один PR / commit batch**
- **Один commit message format:** `[T<N>] <desc>`
- **Полный test pass до merge**

### 7.3 Rollback first, fix-forward second

Если PR ломает smoke test → `git revert` сразу. Не "fix on master".

Это safer. Forward-fixing накапливает риск.

### 7.4 No parallel feature work в Phase 1

В Phase 1 (Foundation Reset) **запрещено**:
- Добавлять новые фичи
- Балансировать (даже тривиально)
- Менять combat math
- Менять monetization

Phase 1 = single track. Merge conflicts на refactor = катастрофа.

В Phase 2-4 — phase-locked pipeline разрешён.

### 7.5 One question rule

Если task неясна — **один точечный вопрос** к CTO в REPORT.md или TASKS.md.

НЕ:
- Угадывать
- Делать "наверное правильно"
- Делать половину
- Делать "creative interpretation"

ДА:
- Точное уточнение конкретного места неясности
- Wait for CTO answer
- Then execute

### 7.6 Visual regression as a contract

Pixel diff ≤2% — passes
Pixel diff 2-5% — manual review (warning)
Pixel diff >5% — fails CI

**Если intentional change:** обновить baseline с обоснованием в commit:
```
[T1.17] Replace 100-hearts UI with scaled bar

Visual baseline updated for screens: battle.png, settings.png
Reason: T1.17 spec — 100 individual hearts replaced with HP bar
```

### 7.7 Sacred Cow як constraint в каждом prompt

Когда CTO формулирует task для Dev/Designer/Tester — **в prompt'е явно указать**:

```
"DO NOT modify [list relevant sacred cows]:
- V_HAPTICS values
- Combo crit formula
- ..."
```

Это снижает риск accidental change.

### 7.8 Один источник truth для constants

Никаких magic numbers в logic коде. Всё в `src/data/`. Если константа повторяется в 2 местах — это bug, не feature.

### 7.9 Логи через services/logger.js

Никаких `console.log` в production code. Use:
```js
import { log, warn, error } from 'src/services/logger.js';
log.debug('Battle state:', state);  // no-op in production
log.warn('Save migration applied');  // logged
log.error('Boss data missing:', bossId);  // logged + Sentry
```

---

## 8. Escalation Paths

### 8.1 Когда escalate (от любой роли к CTO)

✅ **MUST escalate:**
- Task требует изменения Sacred Cow
- Технически невозможно реализовать как описано
- Найден BLOCKER баг
- Conflict между instructions (e.g., spec contradicts CLAUDE.md)
- Требуются новые external dependencies (npm packages, services)

🟡 **SHOULD escalate:**
- Estimate в 2x превышает what spec'd
- Task ambiguous after re-read
- Significant technical debt уведен в process

❌ **DON'T escalate:**
- Минорные details решаемые из context
- Что-то "не нравится в дизайне" но работает
- Стандартные dev decisions (naming, ordering)

### 8.2 Когда CTO escalates to Roman

В REPORT.md создаётся секция:

```markdown
## ESCALATION ESC-NN: <Title>
**Status:** AWAITING ROMAN APPROVAL
**Created:** [date]
**Origin:** TASK-NNN / BUG-NNN
**Severity:** [BLOCKER / HIGH / NORMAL]

### Context
[What happened, what's needed]

### Options considered
1. [Option A] — [tradeoffs]
2. [Option B] — [tradeoffs]
3. [Option C] — [tradeoffs]

### CTO recommendation
[Recommended option + reasoning]

### Awaiting decision on
[Specific question for Roman]
```

Roman отвечает в чате. CTO записывает решение в ESC секцию + переходит к execution.

### 8.3 Roman triggers (что заставляет CTO escalate'ить)

- **ESC needed:** Sacred Cow change request, new external dependency, ambiguity в endgame fantasy, monetization changes, NFT economy decisions
- **NOT needed:** task sequencing, code style, test coverage decisions, internal architecture choices (pick one, document via ADR)

---

## 9. Glossary

| Term | Definition |
|------|------------|
| **AAA+** | Polished standard где first 60s perfect, no rough edges |
| **Adventure** | Async clan для 5-15 игроков (Phase 3) |
| **Aegis Conductor** | Tank role redesign (v2.1 P3) — converts damage to Pressure |
| **Battle Pass** | Seasonal progression with free + premium tracks |
| **Combo Crit** | Multi-line clear damage multiplier (sacred formula) |
| **Chronicler** | FTUE narrator character (sacred voice) |
| **Damage Channels** | 4-source damage system (v2.1 P1): DEAD_ZONE, VOID, SIGNATURE, GRID_SATURATION |
| **Dolphin** | Player segment: $25-$99 lifetime spend |
| **F2P** | Free-to-play (totalSpent === 0) |
| **First Purchase Bonus** | +50% gems on first purchase (sacred) |
| **Founder Badge** | Soft-launch tester award (NFT candidate) |
| **FTUE** | First-Time User Experience |
| **Identity Layer** | Race × boss flavor mechanics (Phase 2) |
| **Mythic** | Hero ascension tier 4 (one per save commitment) |
| **Party Tower** | 2-5 player async coop Tower mode (Phase 3) |
| **Pinch System** | Soft monetization triggers at frustration moments (v2.1) |
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

## 10. Quick Reference Card

### Что прочитать в начале каждой сессии

1. **CLAUDE.md** (этот файл) — project context
2. **`docs/agents/<YOUR_ROLE>_INSTRUCTION.md`** — your role manual
3. **`docs/plan/PLAN.md`** — current phase, progress
4. **`docs/plan/TASKS.md`** — your active tasks
5. **`docs/plan/REPORT.md`** — recent reports, context

### Что обновить в конце каждой сессии

| Role | Update |
|------|--------|
| **CTO** | PLAN.md (status), TASKS.md (assignments), REPORT.md (если phase changed) |
| **Dev** | TASKS.md (status TODO→IN PROGRESS→REVIEW + результат) |
| **Designer** | TASKS.md (status), создать spec в `/design/` |
| **Tester** | TASKS.md (status), записать BUG-NN в TASKS.md, создать TEST REPORT в REPORT.md |

### Принципы которые нельзя нарушать

- ✅ Test-first (smoke tests до refactor)
- ✅ Atomic tasks (один deliverable per task)
- ✅ Sacred cows immutable (escalate любое изменение)
- ✅ Rollback first (git revert при breakage)
- ✅ One question rule (не угадывать)
- ✅ Visual regression contract (≤2% pass)

---

**Document version:** 1.0
**Owner:** Roman (project lead)
**Maintainer:** CTO agent (per phase updates)

> Этот файл — единственный источник истины project-wide.
> Всё что роли должны знать одинаково — здесь.
> Role-specific детали — в `docs/agents/<ROLE>_INSTRUCTION.md`.
