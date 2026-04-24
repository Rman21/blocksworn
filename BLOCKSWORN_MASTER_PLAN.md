# BLOCKSWORN — MASTER IMPLEMENTATION PLAN
## Сценарий А: ФОКУС → Soft Launch → Full Launch
### От Master Game Director · для Роман-основатель · апрель 2026

---

## ОГЛАВЛЕНИЕ

0. **Executive Summary**
1. **The North Star — Душа игры**
2. **Конвенции для Claude Code**
3. **Обзор фаз**
4. **Фаза 1 — Великое Сокращение** (задачи 1.1–1.9)
5. **Фаза 2 — Clockwork Faction** (задачи 2.1–2.10)
6. **Фаза 3 — Boss Voices + Archetype Identity** (задачи 3.1–3.7)
7. **Фаза 4 — The Moment Mechanics** (задачи 4.1–4.6)
8. **Фаза 5 — Onboarding Rebuild** (задачи 5.1–5.5)
9. **Фаза 6 — Launch Prep** (задачи 6.1–6.8)
10. **Deferred v2 Backlog (явно отложенное)**
11. **Web3 Phase 7+ — на потом, после проверенного retention**
12. **Appendix — финальные реестры**

---

# 0. EXECUTIVE SUMMARY

**Сценарий:** А (Focus — резать 60%). Одна глава с 5 боссами. 15 героев в 3 фракциях. Один визуальный стиль (Arena Premium). Минималистская монетизация.

**Цель:** полноценный лонч (Global Launch через AppStore/Play + PWA web) после проверенного soft-launch retention.

**Горизонт:** время некритично — ставим на **качество**, не на скорость. Суммарно 6 фаз от 11 до ~20 недель чистой работы (плюс плейтест-паузы между фазами, которые не считаем "работой"). Ориентир: **soft launch через 4-5 месяцев, full launch через 7-9 месяцев**.

**Web3:** **отложен до Фазы 7+**, когда игра уже проверена в soft-launch и retention доказан. Задача StarkNet-слоя — дать marketplace для ownership героев. Это имеет смысл только когда сами герои ценные (= игра любима).

**Принципиальное правило:** ни один новый фичей не добавляется до завершения текущей фазы. Scope creep = смерть проекта.

---

# 1. THE NORTH STAR — ДУША ИГРЫ

## 1.1 The Moment: «The Last Line»

> Ты на 1 HP. Босс на 8% HP. Следующий его удар — смерть. В tray падает Z-фигура. 2 секунды тишины. Ты видишь: B3 → горизонталь из 4 ember-charged клеток → inferno multiplier × ULT Thorgar → cascade → carried bonus Umbra-капитана → boss dies с -2 HP в последний ход перед своей атакой.
>
> Ты ставишь фигуру. Время замедляется. Cascade идёт.

**Эмоция:** «я не выиграл случайно — я **прочитал** доску на 3 хода вперёд».

**Частота:** каждый 3-й бой в среднем. Каждый бой в финальной фазе босса должен иметь потенциал для The Moment.

## 1.2 Эмоциональный контракт

> **«Это игра где ты чувствуешь себя тактиком на грани — когда мозг видит решение за полсекунды до смерти, и оно срабатывает благодаря squad, который ты собрал сам.»**

Не Diablo (всесильность). Не Genshin (коллекционер). Не Royal Match (зэнен). **Ты — тот кто выкручивается на грани. Снова и снова.**

## 1.3 Уникальность

| Жанр | Обычные игры | Blocksworn |
|---|---|---|
| Block puzzle | Бесконечны, без ставок | Короткие бои с HP и смертью |
| Puzzle RPG | Match-3, медленный | 8×8 placement, 2-минутные бои |
| Hero collectors | Auto-battle | Твоё размещение = damage героев |

**То что даёт только Blocksworn:** 2-минутный тактический эндшпиль, где каждое размещение — ставка жизни, а squad из 3 героев лепит уникальные combat-цепочки.

---

# 2. КОНВЕНЦИИ ДЛЯ CLAUDE CODE

## 2.1 Структура задачи

Каждая задача имеет блоки:
- **Контекст** — где, какой файл, какая фаза, какой агент
- **Задача** — что конкретно сделать, нумерованно
- **Технические требования** — стек, паттерны, ограничения
- **Что НЕ трогать** — явная защита от scope creep
- **Критерий готовности** — проверяемые чеклист-пункты
- **Коммит** — готовая conventional-commit строка

## 2.2 Git conventions

- Каждая фаза = отдельная ветка: `phase-1-reduction`, `phase-2-clockwork`, etc.
- Каждая задача = отдельный коммит
- После последней задачи фазы: merge в `main` + тег `v0.N.0-phase-N-done`
- **НИКОГДА не squash**: полная история задач критична для отладки

## 2.3 Fidelity labels

🟢 **GREEN** — задача готова к отправке Claude Code как есть, без дополнительных решений от меня.

🟡 **YELLOW** — задача структурно готова, но содержит балансные числа или UX-выборы, которые **я уточню до её реализации** после предыдущих фаз. Если Claude Code получает YELLOW без моего апдейта — сигнализируй мне.

🔴 **RED** — задача требует прямого solveния после реализации предыдущей фазы. Нельзя планировать наперёд без данных.

## 2.4 Процедура приёмки задачи

1. Claude Code завершает задачу → отправляет diff
2. Роман проверяет критерии готовности
3. Если чекбоксы пройдены → merge
4. Если нет → исправления, цикл повторяется
5. **Важно:** между задачами никаких "заодно ещё сделаю X" от Claude Code. Scope задачи = scope задачи.

## 2.5 Визуальные чекпоинты от Романа

На критических точках Роман делает визуальный прогон и шлёт скрин Master Game Director'у (мне) на санкцию:

- После **1.3** → скрин hub + battle (проверяем что ничего не поехало)
- После **1.6** → скрин всех экранов (финализация визуала)
- После **1.9** → merge Фазы 1
- После **2.10** → merge Фазы 2
- После **3.7** → скрин всех 5 боссов в бою с voice lines
- После **4.6** → видео The Last Line-момента
- После **5.5** → видео прохождения FTUE новым игроком
- После **6.8** → soft-launch build

---

# 3. ОБЗОР ФАЗ

| Фаза | Название | Срок (нетто) | Критерий завершения |
|---|---|---|---|
| **1** | Великое Сокращение | 1-2 нед | Игра работает; 10 функциональных героев + 5 placeholder Clockwork; 1 глава × 5 боссов; один стиль; Energy/Arena/Event/Awaken/Modifiers/Artifacts удалены |
| **2** | Clockwork Faction | 2-3 нед | 15 полностью функциональных героев в 3 фракциях; новая faction identity; уникальные time-manipulation механики |
| **3** | Boss Voices + Archetype Identity | 1-2 нед | 5 боссов говорят (текст); каждый archetype (Berserker/Armored/Phoenix) визуально различим |
| **4** | The Moment Mechanics | 3-4 нед | Signature Combos работают; Clutch Slow-Mo триггерится; Death Flashback показывается; игра даёт The Moment минимум раз в 3 боя |
| **5** | Onboarding Rebuild | 2 нед | Новый игрок проходит FTUE за ≤7 минут и выигрывает Boss_1 с пониманием core-loop |
| **6** | Launch Prep | 2-3 нед | Sound, Analytics, Store assets, Season Pass v2, Legal, Performance — все готово для soft-launch |

**Итого до soft-launch:** 11-16 недель чистой работы + плейтест-паузы.

---

# 4. ФАЗА 1 — ВЕЛИКОЕ СОКРАЩЕНИЕ

**Цель:** к концу фазы игра запускается и работает core loop, но только с Chapter 1, двумя функциональными фракциями (Pirates + Rock Band) и placeholder Clockwork. Удалены все лишние режимы и predatory monetization.

**Критерий готовности:**
- ✅ Игра запускается, Chapter 1 проходится до конца
- ✅ Squad select показывает 10 unlock-доступных + 5 locked Clockwork
- ✅ Нет Vivid CSS, нет упоминаний Vivid в DOM
- ✅ Нет доступа к Arena/Event/Awaken/Achievements/Codex/Mods/Artifacts
- ✅ Energy chip удалён, battle запускается мгновенно
- ✅ Файл уменьшен с ~12MB до ≤6MB
- ✅ Нет оборванных onclick/ID/CSS-селекторов (0 консольных ошибок)

---

## 🟢 TASK #1.1 — Baseline Snapshot

**Контекст:**
- Игра: Blocksworn (single-file HTML PWA)
- Файл: `blocksworn_index_fixed.html` (~12MB, 31443 строк)
- Фаза: 1 / Великое Сокращение
- Агент: GitHub Agent

**Задача:**
1. Создать git branch `phase-1-reduction` от текущей ветки.
2. Создать SNAPSHOT-файл: скопировать текущий `blocksworn_index_fixed.html` в `/backups/blocksworn_v_pre_reduction.html`. Rollback-якорь.
3. Создать файл `PHASE_1_BASELINE.md` в корне репозитория со следующими данными:
   - Общий размер файла в KB
   - Число строк
   - Число `async function fire*`
   - Число `async function ultTwist*`
   - Длина массивов `CHAPTERS`, `HERO_ROSTER`
   - Число `<div class="screen"` экранов
   - Список всех `id="screen*"` в `<ul>`

**Что НЕ трогать:** сам `blocksworn_index_fixed.html` — только читать.

**Критерий готовности:**
- [ ] Существует ветка `phase-1-reduction`
- [ ] Существует `/backups/blocksworn_v_pre_reduction.html` идентичный исходнику
- [ ] `PHASE_1_BASELINE.md` содержит все метрики выше

**Коммит:** `chore(phase-1): create baseline snapshot and metrics before reduction`

---

## 🟢 TASK #1.2 — Удалить режимы Arena, Event, Awaken

**Контекст:** файл `blocksworn_index_fixed.html`, фаза 1, агент GitHub Agent.

**Задача:**
Полностью удалить три игровых режима: **Arena (Ghost Arena), Event (Event Dungeons), Awaken (Awakening Hub)**.

Для каждого режима:

1. **HTML:** весь блок `<div class="screen" id="screenArena">...</div>`, то же для `screenEvent`, `screenAwaken`. Плюс связанные modal окна (но `Tower floor-clear modal` оставить).

2. **CSS:** все блоки с комментариями `/* ===== V3.0 PHASE 7 BLOCK 7.2 · GHOST ARENA ===== */`, `BLOCK 7.3 · EVENT DUNGEONS`, `BLOCK 7.4 · AWAKENING` — целиком, до следующего `/* ===== */` маркера.

3. **JS:** все функции связанные с этими режимами — `goToArena`, `goToEvent`, `goToAwaken`, `openAwaken*`, `updateArenaRoster`, `renderEventDungeon`, а также префикс-функции `arena*`, `event*`, `awaken*`.

4. **Hub drawer:** удалить кнопки ARENA, AWAKEN из `#aHubDrawer`.

5. **LocalStorage:** удалить записи с ключами содержащими "arena", "event_dungeon", "awaken". Добавить однократную функцию `migrateSave()` которая при запуске игры удаляет эти ключи у существующих игроков (defensive migration).

6. **Bottom nav:** удалить `data-nav="events"` кнопку EVENTS. Место пока пустое (задача 1.8 переставит nav на Tower).

**Технические требования:**
- Порядок удаления: HTML → JS → CSS
- После JS-удаления прогнать страницу в headless browser и искать `ReferenceError`. Оставшиеся вызовы удалённых функций удаляются по корню. Никаких try/catch для маскировки.

**Что НЕ трогать:** `screenTower`; `screenDailies`, `screenAchievements`, `screenCodex`, `screenSeason` (удалим отдельными задачами); Battle/Menu/Select/Shop core.

**Критерий готовности:**
- [ ] `grep -c "screenArena\|screenEvent\|screenAwaken" blocksworn_index_fixed.html` возвращает 0
- [ ] `grep -cE "function.*[aA]rena|function.*[eE]vent[DR]|function.*[aA]waken" blocksworn_index_fixed.html` возвращает 0
- [ ] Игра запускается без консольных ошибок
- [ ] Existing save с данными arena/event/awaken не ломает загрузку

**Коммит:** `refactor(phase-1): remove Arena, Event Dungeons, and Awakening modes`

---

## 🟢 TASK #1.3 — Удалить Achievements, Codex, Mods, Artifacts

**Контекст:** файл `blocksworn_index_fixed.html`, фаза 1.

**Задача:** удалить ещё три экрана + систему артефактов.

1. **screenAchievements** — HTML + CSS + JS. Achievement-tracking удаляется полностью. Утилитарную функцию `grantReward(type, amount)` оставить — используется другими системами.

2. **screenCodex** — HTML + CSS + JS полностью. Hero-lore превью вернётся через hero detail modal (Phase 2).

3. **Модификаторы** — удалить `#modifiersSheet`, `.challenge-modifier-*` классы, функции `openModifiersSheet`, `toggleModifier`, массив `MODIFIERS`. Удалить кнопку MODS из hub drawer.

4. **Артефакты V18** — удалить полностью:
   - CSS: блоки `/* ===== ARTIFACTS (V18) ===== */`, `/* ===== SYNERGY INFO BUTTON + MODAL (V18.1) ===== */`
   - HTML: `artifactPickerModal`, `artifactInventoryModal`, `synergyInfoModal`
   - JS: все функции `artifact*`, `mergeArtifact*`, `pickArtifact*`
   - **Assets:** все ключи из `ASSETS` начинающиеся с `art_` (`art_ring_*`, `art_weapon_*`, `art_shield_*`, `art_staff_*`) — это ~30% размера файла в base64.

**Важно про Synergy Info:**
Если `synergyInfoModal` показывает инфо только об артефактах → удалить. Если также о стихии-синергии squad → сохранить логику, но снять UI-кнопку, перенести инфо в hero-detail modal. Проверить: `showSynergyInfo()` function покажет правду.

**Что НЕ трогать:** `grantReward`, gold/gem modifications; hero tier system; hero unlock system (fragments); Season Pass (отдельной задачей).

**Критерий готовности:**
- [ ] `grep -c "screenAchievements\|screenCodex\|modifiersSheet\|artifactPicker\|art_ring_\|art_weapon_\|art_shield_\|art_staff_" blocksworn_index_fixed.html` возвращает 0
- [ ] Файл уменьшился минимум на **1.5MB**
- [ ] Игра запускается без ошибок
- [ ] Hub drawer содержит: DAILY / TOWER / SEASON / SETTINGS

**🟡 Визуальный чекпоинт для Романа:** после этой задачи — прислать мне скрин hub + battle.

**Коммит:** `refactor(phase-1): remove Achievements, Codex, Modifiers, and Artifact systems`

---

## 🟢 TASK #1.4 — Урезать ростер до 15 героев

**Контекст:** файл `blocksworn_index_fixed.html`, фаза 1.

**Задача:** удалить 8 фракций. Оставить **Pirates (Ember)** и **Rock Band (Umbra)**. Создать placeholder для **Clockwork (Tide)**.

**Удаляемые фракции:**
- Orcs: Blackfang, Thara, Urzog, Skarn, Grommar
- Elves: Azuralys, Nerissa, Liora, Maelen, Sylvi
- Trolls (id `troll_*`)
- Humans: Aurelius, Solaris, Lumia, Valerius, Seraphina
- Dark Elves: включая Kaelen
- Skeletons: Bonelord, Iceshot, Frostweaver, Glacier, Rimehelm
- Golems: Igneon, Boulder, Verdania, Bastion, Auron
- Lions: Leorex, Solara, Astarion, Helios, Goldmane

Для каждого удаляемого:
1. Запись из `HERO_ROSTER` массива
2. Функции `fire<Name>`, `ultTwist<Name>`, `fireDelta<Name>`, `ultDelta<Name>`
3. Из `ASSETS` ключ `hero_<имя>`
4. Специфические CSS-блоки с селектором race

**Оставляемые фракции:**
- **Pirates (ember)**: Thorgar, Blacktooth, Emberhand, Ironbelly, Crimson
- **Rock Band (umbra)**: Riffblade, Shriek, Keycrypt, Thunderbeat, Nightlord

**Placeholder для Clockwork (tide)** — добавить 5 stub-записей в `HERO_ROSTER`:

```js
{ id:'clockwork_warrior', name:'GEARSWORN', race:'clockwork', role:'striker', newRole:'warrior', stihiya:'tide', img:'hero_placeholder_clockwork', roleIcon:'⚔', minCombo:2, fireText:'[PHASE 2]', fire: firePlaceholder, ult: ultPlaceholder, ultSignature: ultPlaceholder, ultText:'[Coming in Phase 2]', locked: true },
{ id:'clockwork_hunter', name:'TICKTOCK', ... locked: true },
{ id:'clockwork_mage', name:'CHRONOS', role:'weaver', period:12, ... locked: true },
{ id:'clockwork_tank', name:'PENDULUM', role:'guard', ... locked: true },
{ id:'clockwork_captain', name:'HOROLOGE', role:'weaver', period:10, ... locked: true },
```

**Helper функции (добавить):**
```js
async function firePlaceholder() {
  showToast("This hero arrives in Phase 2");
  return 0;
}
async function ultPlaceholder() {
  showToast("This hero arrives in Phase 2");
  return 0;
}
```

В UI карточки Clockwork отображаются как locked с плашкой "AVAILABLE IN PHASE 2".

**Миграция старых сейвов:**
- `STARTER_HEROES` Set → теперь 4 стартовых: 1 warrior + 1 mage от Pirates, 1 warrior + 1 mage от Rock Band
- `HEROES_UNLOCKED_STORAGE_KEY`: при загрузке, если у игрока есть разблокированные удалённые герои → показать modal "We simplified the game — your unlocked heroes have been refunded as 500 gold. Let's start fresh." и сбросить unlock list на стартовых 4.

**Что НЕ трогать:** HERO_TIERS logic; fragments logic; squad-select UI layout.

**Критерий готовности:**
- [ ] `HERO_ROSTER.length === 15` (10 рабочих + 5 Clockwork placeholder)
- [ ] Grep count `async function fire(Blackfang|Thara|Urzog|Skarn|Grommar|Azuralys|Nerissa|Liora|Maelen|Sylvi|Aurelius|Solaris|Lumia|Valerius|Seraphina|Bonelord|Iceshot|Frostweaver|Glacier|Rimehelm|Igneon|Boulder|Verdania|Bastion|Auron|Leorex|Solara|Astarion|Helios|Goldmane|Kaelen)` = 0
- [ ] Squad select показывает 10 unlock + 5 locked clockwork карточек
- [ ] Migration modal работает для старых сейвов
- [ ] Бой с Pirates или Rock Band squad проходится end-to-end

**Коммит:** `refactor(phase-1): reduce roster to 15 heroes (Pirates, Rock Band, Clockwork stub)`

---

## 🟢 TASK #1.5 — Удалить главы 2 и 3

**Контекст:** файл `blocksworn_index_fixed.html`, фаза 1.

**Задача:** в массиве `CHAPTERS` оставить только первый элемент (`ASHEN DOMINION`, 5 боссов). Удалить `FORSAKEN DEPTHS` и `PRIMAL CONCLAVE`.

**Побочные действия:**
- Функция `setChapter(n)` — если сильно распространена, превратить в no-op; иначе удалить
- UI `#vChapterNum` постоянно показывает "CHAPTER 1" — пока оставить (переосмыслим в Фазе 6)
- ASSETS: удалить ключи `Boss_6` … `Boss_15` (∼1-2MB экономии)
- Удалить UI-flow "unlock next chapter"

**Новый Chapter Complete flow:**
После победы над `CRYPT LICH` (Boss_5):
- Новая модалка `chapterCompleteModal`: текст `CHAPTER COMPLETE / YOU HAVE DEFEATED THE ASHEN DOMINION / The Tower awaits...`
- Кнопки: `[ENTER TOWER]` → переводит в Tower mode. `[REPLAY CHAPTER]` → сбрасывает Chapter progress.
- Флаг в сейве: `hasCompletedChapter1: true` — активирует Tower-кнопку.

**Что НЕ трогать:** Tower mode механика; HP values и archetype боссов Chapter 1.

**Критерий готовности:**
- [ ] `CHAPTERS.length === 1`
- [ ] Grep count `Boss_6|Boss_7|Boss_8|Boss_9|Boss_10|Boss_11|Boss_12|Boss_13|Boss_14|Boss_15` = 0
- [ ] Победа над Boss_5 триггерит Chapter Complete modal
- [ ] Tower button разблокируется после победы над Boss_5
- [ ] Файл уменьшился ещё на 1-2MB

**Коммит:** `refactor(phase-1): keep only Chapter 1 (Ashen Dominion); add chapter-complete flow`

---

## 🟢 TASK #1.6 — Удалить Vivid Visual System

**Контекст:** файл `blocksworn_index_fixed.html`, фаза 1, агенты UI/UX Director + GitHub Agent.

**Задача:** в файле живут два параллельных визуальных стиля. Удаляем Vivid полностью.

**Идентификация:**
- Vivid CSS custom properties: все `--v-*` в `:root` — удалить
- Vivid utility-классы: `.v-primary`, `.v-secondary`, `.v-chip`, `.v-btn-*`, `.v-card-*`, `.v-bottom-nav` и т.д. Grep `\.v-` в CSS — удалить Vivid-специфичные
- Arena Premium использует `--a-*` и `.a-*` — оставить

**Алгоритм:**
1. В DOM: элементы с двойными классами `v-* a-*` → убрать `v-*`, оставить `a-*`.
2. Элементы с только `v-*` (без `a-*` аналога) → заменить на Arena Premium эквивалент:
   - `v-btn-primary` → `a-btn-cta`
   - `v-btn-secondary` → `a-btn-ghost`
   - `v-card` → `a-card` или `a-panel`
   - `v-chip` → `a-btn-chip`
   - `v-bottom-nav` → `a-bottom-nav`
3. Удалить CSS определения `.v-*` после обновления DOM.
4. Удалить все `--v-*` переменные.

**Visual regression:**
Полный прогон — Menu, Select, Battle, Shop, Dailies, Tower. Если что-то сломалось → фиксить через `--a-*` аналог. **Никогда не возвращать Vivid.**

**Что НЕ трогать:** `--a-*` tokens; game logic; если `--v-radius-*` упоминаются в Arena блоках — переименовать в `--shared-radius-*`.

**Критерий готовности:**
- [ ] `grep -c "\-\-v\-" blocksworn_index_fixed.html` ≤ 5 (остаточное в комментариях допустимо)
- [ ] `grep -c "/\* =====.*VIVID" blocksworn_index_fixed.html` = 0
- [ ] Файл уменьшился ещё на 0.8-1.5MB
- [ ] Визуальный прогон всех экранов успешен
- [ ] 0 CSS warnings в консоли

**🟡 Визуальный чекпоинт для Романа:** после этой задачи — прислать скрины всех экранов.

**Коммит:** `refactor(phase-1): remove Vivid visual system; Arena Premium is the only style`

---

## 🟢 TASK #1.7 — Удалить Energy, Paid Packs, Pity Bypass, Season Pass (временно)

**Контекст:** файл `blocksworn_index_fixed.html`, фаза 1, агенты Balance Architect + GitHub Agent.

**Задача:**

**1. Energy — удалить полностью:**
- Resource counter `.energy` из hub topbar (`#vEnergyAmt`, `#vEnergyChip`)
- `noEnergyModal` и всю логику проверки energy перед боем
- CSS блок `/* ===== V3.0 PHASE 0 BLOCK 0.3 — GOLD & ENERGY RESOURCE STRIP ===== */` — переименовать, оставить только Gold/Gem
- Вызовы `spendEnergy`, `restoreEnergy`, `canAfford` (для energy), константы `ENERGY_*`
- LocalStorage ключ energy → игнорировать при миграции старых сейвов

**2. Paid Packs (Shop tab "OFFERS"):**
- Tab "OFFERS" → empty-state: "New offers coming soon — keep playing to unlock heroes through gameplay."
- CSS `/* ===== V3.0 PHASE 3 BLOCK 3.2 — PAID PACK CARDS ===== */` — удалить
- `.pack-card`, `.pack-buy`, связанные функции — удалить

**3. Pity Bypass (Shop tab "CONVENIENCE"):**
- Вкладку "CONVENIENCE" удалить полностью
- Shop теперь 1 таб с coming-soon сообщением

**4. Season Pass — временно удалить:**
- `screenSeason` + связанный CSS + JS удалить
- SEASON button из hub drawer
- Константа `SEASON_FEATURE_ENABLED = false` сохранить (в Фазе 6 включим)

**Что НЕ трогать:** Gold (earning + spending); Gem counter (оставляем, контент позже); Hero fragments.

**Критерий готовности:**
- [ ] Нет `energy` в hub UI
- [ ] BATTLE button запускает бой мгновенно (нет energy-check)
- [ ] Shop показывает 1 таб с coming-soon
- [ ] `screenSeason` удалён
- [ ] Grep `spendEnergy\|ENERGY_COST\|paidPack\|pityBypass` = 0

**Коммит:** `refactor(phase-1): remove Energy/Paid Packs/Pity/Season; simplify monetization surface`

---

## 🟢 TASK #1.8 — Rebuild Bottom Nav + Hub Drawer

**Контекст:** файл `blocksworn_index_fixed.html`, фаза 1.

**Задача:** собираем чистую структуру.

**Bottom nav (4 кнопки):**
1. `HOME` (⌂) → `goToMenu`
2. `HEROES` (⚔) → `goToSelect` (squad management)
3. `TOWER` (🗼) → `goToTower` — **disabled/greyed** если `!hasCompletedChapter1`
4. `SHOP` (💎) → `goToShop`

**Hub drawer (2 пункта):**
1. `📅 DAILY` → `goToDailies`
2. `⚙ SETTINGS` → `openSettings`

**Settings screen** (если ещё нет — создать базовый):
- Audio: Master volume slider, SFX on/off, Music on/off
- Gameplay: Reduced motion (для accessibility)
- Danger zone: "Reset all progress" (двойное подтверждение)
- Info: Version number, Credits link

**Tower-gated logic:**
- Читаем `hasCompletedChapter1` из сейва
- Пока не разблокирован:
  - Tower-кнопка показывает lock-icon overlay (opacity 0.5 + 🔒 bage)
  - При нажатии → модалка: "Defeat CRYPT LICH to unlock the Tower."

**Что НЕ трогать:** Battle screen; Hub layout (boss portrait, squad dock, BATTLE CTA).

**Критерий готовности:**
- [ ] Bottom nav = ровно 4 кнопки: HOME / HEROES / TOWER / SHOP
- [ ] Hub drawer = ровно 2 пункта: DAILY / SETTINGS
- [ ] Tower locked state работает
- [ ] Settings экран базовый существует и работает

**Коммит:** `refactor(phase-1): simplify bottom nav (4 tabs) and hub drawer (2 items); basic settings`

---

## 🟢 TASK #1.9 — Regression Test + Phase 1 Sign-off

**Контекст:** файл `blocksworn_index_fixed.html`, фаза 1, агенты Bug Fixer + QA.

**Задача:** полный регрессионный прогон. Никакого нового кода.

**Тест-кейсы (все должны пройти):**

### 1. New player full run
- Игра в Incognito (чистый localStorage)
- FTUE: splash + leader choice + first battle
- Победа над Boss_1 (Pyredrake) → награда + Boss_2 разблокирован
- Squad-select: 10 unlock + 5 locked Clockwork
- Победа над Boss_5 (Crypt Lich) → Chapter Complete modal
- Tower button активен после Chapter Complete

### 2. Returning player (old save)
- В localStorage старый сейв: Chapter 2 progress, squad из Grommar/Leorex, energy=0, artifacts unlocked
- Запуск игры → migration modal ("refunded as gold")
- После закрытия — игрок на Chapter 1, gold пополнен
- Бой играется

### 3. No-regression visuals
- Menu, Select, Battle, Shop, Dailies, Tower, Settings — все открываются
- 0 консольных ошибок
- 0 white-flash backgrounds (все Arena Premium dark)

### 4. Size check
- `blocksworn_index_fixed.html` ≤ 6MB
- Если больше — искать base64/CSS дубли/dead code

### 5. Functional — 5 element motifs на доске
- Ember boss: charged cells + inferno работают даже без ember-героев в squad
- Tide boss: freeze chain работает через motif-on-board
- Grove boss: bloom + defense
- Solar boss: radiant crit + detonate
- Umbra boss: умбра-цепи
- Hero Tier XP: participation +1, ult +2, kill-shot +5

**Создать `PHASE_1_SIGNOFF.md`:**
- Чеклист всех задач 1.1–1.9 с ✅
- Финальный размер файла
- Число строк, героев, боссов, экранов
- 2 screenshot attached: hub + battle

**Что НЕ трогать:** нет нового кода — только фикс найденных багов.

**Критерий готовности:**
- [ ] Все 5 тест-кейсов проходят
- [ ] Файл ≤ 6MB
- [ ] `PHASE_1_SIGNOFF.md` заполнен

**Коммит:** `test(phase-1): full regression pass; Phase 1 complete`

**После этого:** merge `phase-1-reduction` → `main` + тег `v0.1.0-phase-1-done`.

---

# 5. ФАЗА 2 — CLOCKWORK FACTION

**Цель:** Clockwork Automatons становятся полноценной фракцией с 5 героями + уникальная mechanical identity (time manipulation).

**Критерий готовности:** squad из 3 Clockwork героев проходит Chapter 1. Каждый Clockwork hero ощущается отличным от Pirates (raw damage) и Rock Band (combo multipliers).

**Ключевая mechanical thesis:** Clockwork = **deferred payoff**. Setup now, cash out later. Это принципиально отличается от пиратов (всё здесь и сейчас) и рок-банды (escalation через combo).

---

## 🟢 TASK #2.1 — Clockwork Faction Bible

**Контекст:** фаза 2, агент Creative Director. Это narrative document, не код.

**Задача:** создать `/gdd/factions/CLOCKWORK_FACTION_BIBLE.md` со следующими разделами.

### Раздел 1 — Core Identity (жёсткий limit: 5 предложений)

Гайд: **холодные, точные, механические. Время — их религия. Они чинят мир, возвращая его в "правильный такт".**
Должно звучать отлично от пиратов (грубые/огненные авантюристы) и от Rock Band (хаотично-тёмные бунтари).

### Раздел 2 — Faction Lore 1-pager
- Где родились (в-мире Blocksworn)
- Главная легенда (the Grand Clockwork, первый Часовщик, etc)
- Почему их element — Tide: связь `freeze = stop time, chain = repeating pattern`, а не просто вода

### Раздел 3 — Hero Roster (финализация имён)

| Имя | Role | Signature | 1 reply line |
|---|---|---|---|
| **GEARSWORN** | warrior/striker | Winding Strike — delayed damage | "Time remembers. Time repays." |
| **TICKTOCK** | hunter/striker | Pendulum Shot — damage echoes | "Once. Twice. Again." |
| **CHRONOS** | mage/weaver | Rewind — reverse void | "The clock turns both ways." |
| **PENDULUM** | tank/guard | Tock Guard — rhythm shield | "In. Out. In. Out." |
| **HOROLOGE** | captain/weaver | Grand Clockwork — synchronize all | "The Hour strikes as ONE." |

Roman может переименовать если найдёт лучше — но каждое имя ДОЛЖНО содержать time/mechanism морфологию.

### Раздел 4 — Mechanical Signatures (preview — детали в 2.2-2.6)

Общая тема: **манипуляция turn counter'ом и pending actions**. Не просто "freeze". Три концептуальных шаблона:

**A. Pending Damage (set → fire later)**
- GEARSWORN, TICKTOCK

**B. Time Reversal (undo state)**
- CHRONOS, PENDULUM

**C. Synchronization (faction-wide timing)**
- HOROLOGE

### Раздел 5 — Visual Brief для Art Director

- **Палитра:** bronze + deep tide blue + brass highlights. Тёплая бронза, не сталь/серебро.
- **Силуэты:** угловатые, геометричные. Видимые шестерни на броне/оружии.
- **Не steampunk.** Ближе к **ритуальной механике** — астролябия + часы Гюйгенса + religious automaton.
- **Expression:** спокойная сосредоточенность, почти монашеская. Нет ярости, нет радости. Только precision.
- **Refs словами:** FromSoftware's clockwork bosses, the Guardian from Breath of the Wild, Ghibli's Castle in the Sky automatons.

**Что НЕ трогать:** код.

**Критерий готовности:**
- [ ] `CLOCKWORK_FACTION_BIBLE.md` создан и заполнен
- [ ] Имена 5 героев финализированы
- [ ] 3 mechanical templates сформулированы
- [ ] Visual brief с ≥3 reference-концептами

**Коммит:** `docs(phase-2): Clockwork faction bible — identity, lore, hero names, signatures`

---

## 🟢 TASK #2.2 — GEARSWORN (warrior/striker) Implementation

**Контекст:** файл `blocksworn_index_fixed.html`, фаза 2, агент Balance Architect + GitHub Agent.

**Задача:** реализовать GEARSWORN полностью. Удалить locked/placeholder statement в его HERO_ROSTER entry. Добавить functioning `fire` + `ultSignature` + tier deltas.

### Mechanical Design

**Fire ability:** `fireGearsworn(counts)` — triggers at combo ≥ 2 на умышленных tide-clears
- Dealing: 0 immediate damage, BUT sets `tickDamage` on boss
- `tickDamage` fires after 2 turns as damage equal to `80 × number of tide cells cleared that combo`
- Visual: boss has small "🕰" overlay counting down turns to tick-damage fire
- Multiple ticks can stack (each has own countdown)

**ULT signature:** `ultTwistGearsworn(ctx)` — fires on global Tide ULT
- Immediately fires ALL pending ticks at 1.5× multiplier
- Player gets haptic "boom-boom-boom" rapid-fire visual

**Tier deltas:**
- **T1:** base ability
- **T2 fireTierDelta:** `tickDamage` countdown reduced from 2 turns to 1 turn
- **T3 ultTierDelta:** pending ticks fire at 2.0× instead of 1.5×

### State Management

Add to battle state:
```js
let pendingTicks = []; // array of { source: heroId, damage: int, turnsRemaining: int }
```

Hook into turn progression: after each player placement, decrement `turnsRemaining` of each tick. When `turnsRemaining === 0`, fire damage via `dealDamage(tick.damage, false, 0)`, remove from array.

### UI requirements
- Boss card gets a "🕰 N" indicator showing largest pending tick countdown
- When tick fires: floating damage label with 🕰 icon prefix

**Что НЕ трогать:** battle core loop (только hook-in); другие герои; UI layout (только добавить tick indicator).

**Критерий готовности:**
- [ ] GEARSWORN unlocked в `HERO_ROSTER` (`locked: false`)
- [ ] `firePlaceholder` NOT invoked for GEARSWORN
- [ ] Combo tide-clear с GEARSWORN в squad создаёт pending tick
- [ ] Tick visual на boss card видим и обновляется
- [ ] Через 2 turns tick fires damage correctly
- [ ] Tide ULT триггерит all pending ticks at 1.5× (проверить в DevTools)
- [ ] T2 tier reduces countdown to 1 turn (test by artificially setting hero.tier=2)
- [ ] T3 multiplies by 2.0× (test artificially)
- [ ] No console errors

**Коммит:** `feat(phase-2): implement GEARSWORN — Winding Strike + Great Winding ULT`

---

## 🟢 TASK #2.3 — TICKTOCK (hunter/striker) Implementation

**Контекст:** фаза 2, агент Balance Architect + GitHub Agent.

### Mechanical Design

**Fire ability:** `fireTicktock(counts)` — triggers at combo ≥ 2 на tide-clears
- Deals immediate damage: `60 × tide cells cleared`
- Schedules "echo": **same damage fires again 1 turn later** (`pendingTicks` with turnsRemaining = 1)
- Visual: damage number appears in doubled form briefly

**ULT signature:** `ultTwistTicktock(ctx)` — fires on global Tide ULT
- ALL pending echoes fire immediately
- BONUS: boss stunned for 1 turn (`attackCountdown += 1`)

**Tier deltas:**
- **T1:** base (single echo)
- **T2 fireTierDelta:** echo fires TWICE (turnsRemaining 1 AND 2) — double echo
- **T3 ultTierDelta:** ULT stun extends to 2 turns

### Interaction with GEARSWORN

If both GEARSWORN and TICKTOCK are in squad:
- GEARSWORN's pending tick can be "echo-hit" by TICKTOCK's echo, doubling the value
- Explicit rule in code: when resolving TICKTOCK echo, check `pendingTicks` from GEARSWORN; for each hit, add `+20%` to that tick's damage
- This is the **synergy hint** that rewards collecting both

**Что НЕ трогать:** GEARSWORN code уже рабочий (только добавить check для echo-hit synergy).

**Критерий готовности:**
- [ ] TICKTOCK unlocked
- [ ] Combo tide-clear с TICKTOCK → immediate damage + scheduled echo
- [ ] Echo fires 1 turn later with correct damage
- [ ] Tide ULT triggers all echoes + 1-turn stun
- [ ] GEARSWORN+TICKTOCK synergy: ticks hit by echoes get +20% boost
- [ ] T2 adds second echo at turn 2
- [ ] T3 extends stun to 2 turns
- [ ] No console errors

**Коммит:** `feat(phase-2): implement TICKTOCK — Pendulum Shot with echo + synergy with GEARSWORN`

---

## 🟢 TASK #2.4 — CHRONOS (mage/weaver) Implementation

**Контекст:** фаза 2.

### Mechanical Design

CHRONOS — weaver с `period: 12`. Fire triggers every 12 placements (not on combos).

**Fire ability:** `fireChronos()` — every 12 placements
- Heal player +2 HP (max cap MAX_HP = 3 — respects existing cap, but we consider raising cap later)
- **Reverse time on void cells:** convert 3 random void cells back to tide cells
- Visual: radial reverse-sweep animation

**ULT signature:** `ultTwistChronos(ctx)` — on global Tide ULT
- **The Pause:** `bossAttackCountdown` frozen at current value for next 3 player placements
- During the Pause: boss can't attack, can't spawn void cells
- After 3 placements: countdown resumes normally

**Tier deltas:**
- **T1:** base
- **T2 fireTierDelta:** Fire also grants +1 shield
- **T3 ultTierDelta:** Pause extended to 5 placements

### State Management
```js
let pauseState = { active: false, placementsRemaining: 0, originalCountdown: null };
```

Hook in `bossAttack()` and `spawnVoidCells()`: if `pauseState.active`, early return. Decrement `placementsRemaining` in placement handler. When 0, set `pauseState.active = false`.

**Что НЕ трогать:** max HP cap (пока respect, но note for Phase 4).

**Критерий готовности:**
- [ ] CHRONOS unlocked
- [ ] Fire every 12 placements: heal + 3 void→tide conversion
- [ ] Tide ULT activates Pause for 3 placements
- [ ] During Pause: boss doesn't attack, doesn't spawn void
- [ ] T2 adds +1 shield on fire
- [ ] T3 extends Pause to 5
- [ ] No console errors

**Коммит:** `feat(phase-2): implement CHRONOS — Rewind + The Pause ULT`

---

## 🟢 TASK #2.5 — PENDULUM (tank/guard) Implementation

**Контекст:** фаза 2.

### Mechanical Design

**Fire ability:** `firePendulum(counts)` — triggers at combo ≥ 2 на tide-clears
- +1 shield per combo tier (1 shield at combo=2, up to 3 shields at combo=4)
- Reduces boss `attackCountdown += 1` (pushes next attack 1 turn further)

**ULT signature:** `ultTwistPendulum(ctx)` — on global Tide ULT
- **Eternal Swing:** entire squad gets `nextAbilityRepeats = true`
- Meaning: each squad hero's next fire/ULT fires TWICE
- Flag cleared after each hero's next trigger

**Tier deltas:**
- **T1:** base
- **T2 fireTierDelta:** Fire also gives +1 shield to each OTHER squad hero
- **T3 ultTierDelta:** Eternal Swing also resets all squad hero `period` counters (weavers fire sooner)

### State Management
```js
for (const hero of squad) {
  hero.nextAbilityRepeats = false;
}
```

In `fireHero(hero, ...)` and `ultRoleDispatch(hero, ...)`: check `hero.nextAbilityRepeats`. If true → execute twice, set to false.

**Что НЕ трогать:** shield cap (MAX_SHIELD = 3 сохраняется).

**Критерий готовности:**
- [ ] PENDULUM unlocked
- [ ] Combo tide-clear: gives shields + pushes boss attack
- [ ] Tide ULT: all squad heroes' next ability fires twice
- [ ] T2: shield distribution to squad
- [ ] T3: period reset on ULT
- [ ] No console errors

**Коммит:** `feat(phase-2): implement PENDULUM — Tock Guard + Eternal Swing ULT`

---

## 🟢 TASK #2.6 — HOROLOGE (captain/weaver) Implementation

**Контекст:** фаза 2. HOROLOGE — captain, period: 10 (faster than mage).

### Mechanical Design

**Fire ability:** `fireHorologe()` — every 10 placements
- **Synchronize:** reduces ULT charge requirement by 2 for all squad heroes this turn
- Effect: if any squad hero was 2-charge away from ULT, fires immediately next clear
- Visual: pendulum-swing overlay across all squad cards

**ULT signature:** `ultTwistHorologe(ctx)` — on global Tide ULT
- **The Grand Clockwork:** resets all squad hero cooldowns to 0 (instant next-fire available)
- ALSO: next 2 player placements auto-crit (treat as combo ≥ 2 regardless of actual combo)

**Tier deltas:**
- **T1:** base
- **T2 fireTierDelta:** Sync effect also applies to GEARSWORN/TICKTOCK pending ticks — they fire immediately
- **T3 ultTierDelta:** Grand Clockwork auto-crit extends to 4 placements

### HOROLOGE as captain — Signature Combo Hint

When squad = 3 Clockwork heroes including HOROLOGE:
- HOROLOGE's fire triggers a small "⚙ SIGNATURE: THE HOUR" indicator
- This is a **hint** of the signature combo system coming in Phase 4
- For now: cosmetic indicator only, no gameplay effect
- Real signature combo implementation: Phase 4

**Критерий готовности:**
- [ ] HOROLOGE unlocked
- [ ] Fire every 10 placements: ULT charge -2 to all squad
- [ ] Tide ULT: cooldowns reset + 2 auto-crit placements
- [ ] T2: GEARSWORN/TICKTOCK pending ticks fire immediately on Sync
- [ ] T3: auto-crit extends to 4 placements
- [ ] SIGNATURE hint UI appears when squad = 3 Clockwork (even if not all tier-3)
- [ ] No console errors

**Коммит:** `feat(phase-2): implement HOROLOGE — Synchronize + Grand Clockwork ULT; signature hint UI`

---

## 🟡 TASK #2.7 — Balance Pass for Clockwork

**Контекст:** фаза 2, агент Balance Architect.

**Status:** YELLOW — balance numbers above (80/60/multipliers) are **opening bid**. После implementation 2.2–2.6 Роман играет 20 боёв с Clockwork squad и я (через Роман) корректирую.

**Задача:**
1. Роман играет минимум 20 боёв с squad вариациями:
   - 3 Clockwork (чистый синергичный)
   - 2 Clockwork + 1 Pirate (mixed)
   - 2 Clockwork + 1 Rock Band (mixed)
   - 1 of each faction (neutral)
2. Заполняет `/PHASE_2_PLAYTEST.md`:
   - Average damage per battle by squad comp
   - Avg turns per boss kill
   - Subjective "fun" rating 1-10 per composition
   - Frustration notes (если слишком медленно/быстро/запутанно)
3. Присылает мне отчёт
4. Я выношу вердикт по корректировкам балансных чисел (я пишу `BALANCE_ADJUSTMENT_2.7.md`)
5. Claude Code применяет корректировки через `str_replace`

**Что НЕ трогать:** game mechanics themselves — только numbers (damage multipliers, turn counts, percentages).

**Критерий готовности:**
- [ ] `PHASE_2_PLAYTEST.md` заполнен Романом
- [ ] Master Game Director (я) выдал `BALANCE_ADJUSTMENT_2.7.md`
- [ ] Claude Code применил изменения
- [ ] Повторный прогон 5 боёв — нет явных проблем (frustration ≤ 2/10)

**Коммит:** `balance(phase-2): Clockwork balance pass after playtest`

---

## 🟢 TASK #2.8 — Clockwork Visual Assets

**Контекст:** фаза 2, агент Art Director. Это создание graphic assets.

**Задача:** создать 6 visual assets для Clockwork:

### Required assets
1. `hero_clockwork_warrior.webp` — GEARSWORN portrait (square 512×512)
2. `hero_clockwork_hunter.webp` — TICKTOCK
3. `hero_clockwork_mage.webp` — CHRONOS
4. `hero_clockwork_tank.webp` — PENDULUM
5. `hero_clockwork_captain.webp` — HOROLOGE
6. `stihiya_emblem_tide_clockwork.svg` — faction emblem (уже есть tide emblem, этот — Clockwork-специфичный оверлей)

### Specification для каждого hero portrait

- **Size:** 512×512, PNG or WebP
- **Background:** transparent OR solid dark (match Arena Premium `--a-bg-surface`)
- **Style:** см. Visual Brief в Faction Bible (Task 2.1)
- **Palette:** bronze (#8B6914) + brass (#C9A759) + tide blue (#4ADBFF accent) + deep shadow (#2A1810)
- **Composition:** shoulders-up bust. Face visible but stylized (not photo-realistic).
- **Distinctive element** каждому:
  - GEARSWORN: massive gear-shaped shoulder pauldron, battle-marked
  - TICKTOCK: mechanical crossbow/rifle with visible pendulum balance
  - CHRONOS: floating orrery around head, closed eyes (seeing through time)
  - PENDULUM: large circular shield with clock-face, neutral stance
  - HOROLOGE: ornate captain's coat, pocket-watch on chain, commanding posture

### Integration

В ASSETS object добавить (после generation):
```js
hero_clockwork_warrior: 'data:image/webp;base64,...',
hero_clockwork_hunter: 'data:image/webp;base64,...',
...
stihiya_emblem_tide_clockwork: 'data:image/svg+xml;base64,...'
```

Обновить HERO_ROSTER entries — поле `img` с правильным ключом.

**Практическое замечание:** если Роман использует AI-image tool (Midjourney/DALL-E) — это приемлемо для Фазы 2. В Фазе 6 (polish) возможна замена на финальные assets.

**Что НЕ трогать:** ассеты других фракций (Pirates/Rock Band).

**Критерий готовности:**
- [ ] 5 hero portraits созданы и интегрированы в ASSETS
- [ ] Faction emblem созданy и интегрирован
- [ ] Squad-select отображает Clockwork героев с правильными портретами
- [ ] Battle screen отображает Clockwork heroes correctly
- [ ] Файл увеличился ≤ 2MB (watch bloat)

**Коммит:** `feat(phase-2): add Clockwork visual assets — 5 portraits + faction emblem`

---

## 🟢 TASK #2.9 — Clockwork Unlock Flow

**Контекст:** фаза 2, агент Progression Director.

**Задача:** определить как игрок получает Clockwork героев.

### Unlock Design

Clockwork — **late-game reward**. Получается через Floor 2 и 3 clears + первый Tower run.

| Hero | Unlock Condition |
|---|---|
| **GEARSWORN** | 1-й раз побеждаешь Boss_2 (Abyssal Tyrant) на Floor 2 |
| **TICKTOCK** | 1-й раз побеждаешь Boss_4 (Solar Phoenix) на Floor 2 |
| **CHRONOS** | 1-й раз побеждаешь Boss_5 (Crypt Lich) на любом Floor |
| **PENDULUM** | Tower: достигаешь Floor 10 |
| **HOROLOGE** | Tower: достигаешь Floor 25 + собрал 50 `clockwork_shards` |

### `clockwork_shards` currency
- Новая валюта. Dropп с Tower floors 10+: 1-3 shards per floor.
- Display в hub chips: `⚙ X` chip добавляется к gold/gem
- LocalStorage: `CLOCKWORK_SHARDS_STORAGE_KEY = 'blocksworn_clockwork_shards'`

### Unlock UX
- Когда unlock condition met: full-screen cinematic modal
  - "⚙ CLOCKWORK RECOGNIZES YOU"
  - Hero portrait appears with brass frame
  - Name + faction + 1 reply line
  - `[ADD TO SQUAD]` / `[LATER]`

**Что НЕ трогать:** Pirates/Rock Band unlock flow (они в Phase 1 уже решены).

**Критерий готовности:**
- [ ] Каждая из 5 unlock conditions работает end-to-end
- [ ] `clockwork_shards` собираются с Tower floors 10+
- [ ] Unlock cinematic показывается правильно
- [ ] LocalStorage сохраняет + восстанавливает прогресс
- [ ] Hub chip показывает shards

**Коммит:** `feat(phase-2): Clockwork unlock flow — 5 conditions + shards currency + cinematic`

---

## 🟢 TASK #2.10 — Phase 2 Regression + Sign-off

**Контекст:** фаза 2, агент Bug Fixer + QA.

**Задача:** полный регрессионный прогон.

**Тест-кейсы:**
1. Chapter 1 (все 5 боссов) пройдены с pure Pirates squad — работает
2. Chapter 1 пройден с pure Rock Band squad — работает
3. Chapter 1 пройден с pure Clockwork squad (после unlock) — работает
4. Все 15 героев (3 fractions × 5 roles) имеют unique fire + ult + tier deltas
5. GEARSWORN+TICKTOCK synergy (echo hits tick) proc correctly
6. HOROLOGE signature hint показывается при squad = 3 Clockwork
7. Unlock flow для 5 Clockwork героев работает
8. Clockwork shards earned from Tower
9. File size ≤ 8MB (допускаем рост из-за portrait assets)

Создать `PHASE_2_SIGNOFF.md` с:
- Чеклистом задач 2.1–2.10
- Final hero roster (15 heroes)
- Screenshots: squad-select (все 15), battle с clockwork squad, unlock cinematic

**Критерий готовности:**
- [ ] 9 тест-кейсов прошли
- [ ] Файл ≤ 8MB
- [ ] `PHASE_2_SIGNOFF.md` готов

**Коммит:** `test(phase-2): full regression; Phase 2 complete`

Merge `phase-2-clockwork` → `main` + tag `v0.2.0-phase-2-done`.

---

# 6. ФАЗА 3 — BOSS VOICES + ARCHETYPE IDENTITY

**Цель:** 5 боссов перестают быть `bossIdx`-спрайтами и становятся characters. Каждый говорит. Каждый archetype визуально различим за секунду.

**Критерий готовности:** новый игрок может посмотреть скриншот боя и сказать "это Berserker-босс / Armored / Phoenix" без подсказок UI.

**Srok:** 1-2 недели.

---

## 🟢 TASK #3.1 — Boss Lore Document

**Контекст:** фаза 3, агент Creative Director. Narrative document, не код.

**Задача:** создать `/gdd/bosses/ASHEN_DOMINION_BOSSES.md` с lore для каждого из 5 боссов Chapter 1.

### Per-boss structure

```markdown
## BOSS 1: PYREDRAKE (Fire Dragon, Ember)
**Archetype:** Berserker
**Title:** "The Cinder That Refuses To Die"
**Core identity:** [5 sentences — who, why, stakes]
**Pre-battle voice line:** [1 short line, dramatic not cringe]
**Low-HP taunt (triggers at ≤30% HP):** [1 line]
**Victory (boss wins):** [1 line]
**Defeat (player wins):** [1 line]
**Visual direction note for Art Director:** [2 sentences]
```

Same for Boss 2-5.

### Guideline for voice lines

- **English by default.** Clean, uncluttered. No "forsooth verily" fake-Shakespeare.
- **Each line ≤ 12 words.** Short = memorable.
- **Distinctive voice per boss.** Different verb choice, different rhythm.
- **Reference:** Hades boss taunts. Not Skyrim.

### Example (для калибровки)

```
## BOSS 1: PYREDRAKE
**Pre-battle:** "Warm yourself. I will return to ash."
**Low-HP taunt:** "Fire does not lose. Fire waits."
**Victory:** "Sleep in the cinders."
**Defeat:** "...again."
```

**Что НЕ трогать:** код.

**Критерий готовности:**
- [ ] `ASHEN_DOMINION_BOSSES.md` заполнен для всех 5 боссов
- [ ] Каждый босс имеет 4 voice lines
- [ ] Voice lines ≤ 12 words каждая
- [ ] Master Game Director (я) прочитал и одобрил (Роман присылает мне для review)

**Коммит:** `docs(phase-3): Ashen Dominion bosses lore + voice lines`

---

## 🟢 TASK #3.2 — Voice Line Engine

**Контекст:** фаза 3, файл `blocksworn_index_fixed.html`.

**Задача:** создать systems для отображения boss voice lines.

### Data structure

```js
const BOSS_VOICES = {
  'Boss_1': {
    preBattle: "Warm yourself. I will return to ash.",
    lowHPTaunt: "Fire does not lose. Fire waits.",
    victory: "Sleep in the cinders.",
    defeat: "...again."
  },
  'Boss_2': { ... },
  // ... 5 entries total
};
```

### Display system

New component: **Voice Bubble**
- Positioned above boss portrait
- Arena Premium styled: dark surface + gold border + brass accent
- Fade-in over 300ms, hold for `line.length × 80ms` (reading time), fade-out 300ms
- Type-on animation: letters appear one-by-one at 40ms interval (skippable on tap)

### Trigger points

1. **preBattle:** fires when battle screen loads, after 800ms delay (lets player orient first)
2. **lowHPTaunt:** fires once when `bossHP <= maxHP * 0.30`. Flag `boss.tauntFired = true` to prevent re-trigger.
3. **victory:** fires on boss-wins (player HP = 0)
4. **defeat:** fires on boss-loses (boss HP = 0), BEFORE death cinematic

### Accessibility
- Voice bubbles have `role="status"` for screen readers
- Skip all animations if `settings.reducedMotion === true`

**Что НЕ трогать:** battle core mechanics; boss HP logic.

**Критерий готовности:**
- [ ] `BOSS_VOICES` const created with all 5 bosses
- [ ] Voice Bubble component renders with Arena Premium styling
- [ ] All 4 trigger points fire correctly
- [ ] Type-on animation works, skippable on tap
- [ ] Reduced motion setting respected
- [ ] No console errors

**Коммит:** `feat(phase-3): boss voice line engine — display + 4 trigger points`

---

## 🟢 TASK #3.3 — Berserker Archetype Visual

**Контекст:** фаза 3, агент Art Director + GitHub Agent. Только для боссов с `archetype: 'berserker'` (Boss_1 Pyredrake).

**Задача:** Berserker-archetype-специфичный визуал.

### Base state (>50% HP): normal

Boss displays standard idle animation.

### Enraged state (≤50% HP, after enrage trigger)

**Visual changes:**
1. **Red rim-light:** CSS filter adds `drop-shadow(0 0 20px #ff3d3d)` pulsing at 1.5Hz
2. **Idle animation speeds up 2×**
3. **Cracked texture overlay:** SVG overlay with red cracks grows from HP reduction
4. **Battle background:** radial overlay `#3a0f08` at 30% opacity — environmental cue
5. **Voice bubble** (separate from таунт): Berserker-specific idle line every 45 seconds — 2-3 additional lines per battle (requires extending BOSS_VOICES for Berserker)

### Implementation
New function `applyBerserkerEnrage(boss)` triggered when `bossHP <= maxHP * BERSERKER_ENRAGE_HP_PCT` (existing constant).

CSS class `.boss-card.enraged-berserker` toggles on boss card element.

**Критерий готовности:**
- [ ] Pyredrake at >50% HP — normal state visual
- [ ] At ≤50% HP — enrage triggers visually (все 5 эффектов)
- [ ] Damage multiplier (2.0×) продолжает работать как раньше
- [ ] Battle bg changes correctly
- [ ] Idle voice lines proc каждые 45s
- [ ] No console errors

**Коммит:** `feat(phase-3): Berserker archetype enrage visual — Pyredrake`

---

## 🟢 TASK #3.4 — Armored Archetype Visual

**Контекст:** фаза 3. Boss с `archetype: 'armored'` — в Chapter 1 это может быть Boss_2 (Abyssal Tyrant) или Boss_3 (Grovewarden), зависит от текущей архетип-разметки.

**Задача:** armored archetype визуал.

### Design

**Normal state:** shields visible as badges on boss card (already partially implemented via `ARMORED_SHIELD_COUNT`).

**Per shield visual:**
- Gold-brass shield icons around boss card
- Damage-absorb effect: когда player hits shielded boss, damage number shows with 🛡 prefix + `×0.3` dim mod
- Shield breaks: loud shatter SFX + shield icon flies off

**After all shields broken:**
- 1-second slow-mo freeze
- Gold shatter particles fly out
- Boss card goes from "armored idle" to "vulnerable idle" (more exposed, different posture animation)
- Voice line: "You've earned this." (add to BOSS_VOICES for armored archetype specifically)

### Implementation
Hook into existing `dealDamage` where `ARMORED_SHIELD_ABSORB` modifies damage. Add visual side-effects.

**Критерий готовности:**
- [ ] Armored boss показывает shields visually
- [ ] Damage absorption visible в damage number
- [ ] Shield break animation + SFX
- [ ] Post-armor voice line triggers once
- [ ] Mechanic (70% dmg absorb) работает как раньше
- [ ] No console errors

**Коммит:** `feat(phase-3): Armored archetype visual — shields, breakage, vulnerability reveal`

---

## 🟢 TASK #3.5 — Phoenix Archetype Visual

**Контекст:** фаза 3. Boss с `archetype: 'phoenix'` — Boss_4 (Solar Phoenix).

**Задача:** Phoenix revive визуал.

### Design

**Near-death (HP ≤ 10%):** boss starts glowing with increasing intensity. Background pulse 🟡.

**At HP = 0 (first "death"):**
1. Full-screen flash (0.5s white with gold tint)
2. Boss sprite dissolves into gold particles (particle cascade)
3. 1-second beat
4. Gold particles re-coalesce into boss at `PHOENIX_REVIVE_HP_PCT` (60%) HP
5. Boss appears in "reborn" posture — slightly different sprite variant
6. Voice line: "Again. And again. And again."
7. Immune indicator overlay shows for `PHOENIX_IMMUNE_TURNS` (2 turns)

**At HP = 0 second time:** regular death cinematic (no re-revive for Chapter 1).

### Implementation
Existing `PHOENIX_REVIVE_HP_PCT` and `PHOENIX_IMMUNE_TURNS` constants — keep. Add full-screen animation overlay + particle effects.

**Что НЕ трогать:** revive mechanic числа (60% HP, 2 turns immunity).

**Критерий готовности:**
- [ ] Phoenix boss near-death glow triggers
- [ ] First death → revive cinematic plays fully
- [ ] Boss returns at 60% HP
- [ ] Immunity indicator visible during 2 turns
- [ ] Second death = normal death cinematic
- [ ] Voice line proc
- [ ] No console errors

**Коммит:** `feat(phase-3): Phoenix archetype revive cinematic + immunity visual`

---

## 🟡 TASK #3.6 — Boss Voice Line Polish Pass

**Контекст:** фаза 3. YELLOW — зависит от того, как боссы ощущаются после 3.2–3.5.

**Задача:** после implementation Voice Engine + all 3 archetype visuals, Роман играет все 5 боёв и оценивает:
- Насколько голоса "попадают" в момент
- Не слишком часто/редко
- Не мешают ли читать доску
- Эмоциональный вес

Создать `/gdd/bosses/VOICE_POLISH_2026.md` — корректировки voice lines + timing.

Master Game Director (я) делает final review + approve.

Claude Code применяет финальные voice lines через str_replace.

**Критерий готовности:**
- [ ] Полный прогон 5 боёв Романом done
- [ ] Polish doc заполнен
- [ ] Финальные lines approved и applied
- [ ] 0 "cringe factor" от any line

**Коммит:** `polish(phase-3): boss voice line final pass after playtest`

---

## 🟢 TASK #3.7 — Phase 3 Regression + Sign-off

**Контекст:** фаза 3, Bug Fixer + QA.

**Задача:** полный regression.

**Тест-кейсы:**
1. Все 5 боссов: preBattle line triggers
2. Все 5: lowHPTaunt triggers at ≤30% HP exactly once
3. Все 5: victory/defeat lines trigger
4. Berserker (Pyredrake) enrage visual работает
5. Armored archetype visual работает (shield break)
6. Phoenix revive cinematic работает
7. Reduced motion setting отключает все animations корректно
8. Файл size ≤ 9MB

Создать `PHASE_3_SIGNOFF.md` + screenshots: 5 боссов в enraged/armored/revived state, voice bubble example.

**Критерий готовности:**
- [ ] 8 тест-кейсов прошли
- [ ] Файл ≤ 9MB
- [ ] SIGNOFF doc заполнен

**Коммит:** `test(phase-3): full regression; Phase 3 complete`

Merge `phase-3-voices-archetypes` → `main` + tag `v0.3.0-phase-3-done`.

**🟡 Визуальный чекпоинт для Романа:** прислать скрин или видео каждого из 5 боссов в ключевом моменте с voice bubble.

---

# 7. ФАЗА 4 — THE MOMENT MECHANICS

**Цель:** The Moment ("The Last Line") триггерится в каждом 3-м бою в среднем. Signature Combos работают. Clutch Slow-Mo проявляется. Death Flashback учит, а не наказывает.

**Критерий готовности:** после Romanа игра даёт ему минимум 3 ярких "wow"-момента в 10 подряд боях. Retention subjective рост по собственному ощущению Романа.

**Срок:** 3-4 недели.

**🟡 Важно:** балансные числа в этой фазе часто YELLOW — они настраиваются после прогонов.

---

## 🟢 TASK #4.1 — Signature Combo Engine

**Контекст:** фаза 4, Balance Architect + GitHub Agent.

**Задача:** построить engine для Signature Combos — которые активируются когда squad = 3 героя из одной фракции.

### Data structure

```js
const SIGNATURE_COMBOS = {
  'pirates': {
    name: "THE GOLDEN HOARD",
    description: "All Ember damage +25%. Every 5th placement: +1 random charged ember cell.",
    effect: applySignatureCombo_Pirates, // function
    activationVisual: "signature_pirates.svg" // gold coin cascade
  },
  'rock': {
    name: "THE DARK ENCORE",
    description: "Every Umbra ULT fires the previous one's echo. Combo multipliers capped raised from 12× to 18×.",
    effect: applySignatureCombo_RockBand,
    activationVisual: "signature_rock.svg" // neon pulse lines
  },
  'clockwork': {
    name: "THE HOUR",
    description: "All pending ticks fire +50% damage. Attack countdown +1 once per battle at 50% boss HP.",
    effect: applySignatureCombo_Clockwork,
    activationVisual: "signature_clockwork.svg" // clock-face bloom
  }
};
```

### Activation logic

```js
function checkSignatureCombo(squad) {
  const factions = squad.map(h => h.race);
  const counts = {};
  factions.forEach(f => counts[f] = (counts[f] || 0) + 1);
  for (const [faction, count] of Object.entries(counts)) {
    if (count === 3) return SIGNATURE_COMBOS[faction];
  }
  return null;
}
```

Called at `startBattle()`. If signature active, applied throughout battle.

### UI

**Squad-select screen:** when signature eligible (3 of same faction), show banner above squad:

```
⚙ SIGNATURE: THE HOUR
+50% pending tick damage · Attack countdown +1 once per battle
```

**Battle screen:** small icon in topbar indicating active signature.

**Activation cinematic (one-time per battle):**
- 1.5s overlay при начале боя
- Faction emblem flares up
- Signature name appears in large brass letters
- Short text rollup of effect

**Что НЕ трогать:** individual hero abilities; combo multiplier base logic.

**Критерий готовности:**
- [ ] `SIGNATURE_COMBOS` data structure defined
- [ ] 3 signature effects implemented (Pirates/Rock/Clockwork)
- [ ] Squad-select shows signature banner when eligible
- [ ] Battle-start cinematic plays
- [ ] Signature effect actually applies (test damage numbers)
- [ ] No console errors

**Коммит:** `feat(phase-4): signature combo engine — 3 faction signatures`

---

## 🟢 TASK #4.2 — Clutch Slow-Mo

**Контекст:** фаза 4.

**Задача:** визуальный slow-mo-эффект когда игрок близок к победе И к смерти одновременно.

### Trigger condition

```js
function shouldTriggerClutchSlowMo() {
  return bossHP / bossMaxHP <= 0.20 && playerHP / MAX_HP <= 0.33;
}
```

### Effect
- Triggers после player places a piece when condition become true
- 700ms slow-mo: battle animations at 0.3× speed
- Chromatic aberration overlay at 30% intensity
- Soft heartbeat SFX (low thump-thump, 40Hz)
- When slow-mo ends: normal speed resumes for damage calc/clear/attack
- **Cooldown:** once per battle maximum (don't re-trigger on every placement once at low-HP)

### Optional (YELLOW)
- Preview overlay showing "if you place this piece here → outcome" ghost
- This might be too much visual noise. Test at Romanом first.

**Что НЕ трогать:** damage calc timing; boss attack logic. Only visual timing affected.

**Критерий готовности:**
- [ ] Trigger condition fires correctly
- [ ] Slow-mo visual плавный, не вызывает lag
- [ ] Heartbeat SFX plays
- [ ] Cooldown (once per battle) работает
- [ ] Reduced motion setting disables slow-mo completely
- [ ] No console errors

**Коммит:** `feat(phase-4): clutch slow-mo cinematic trigger`

---

## 🟢 TASK #4.3 — Death Flashback

**Контекст:** фаза 4. Этот тот самый механизм превращающий поражение в обучение.

**Задача:** пост-смертный экран который показывает игроку "вот где ты бы выжил".

### On player defeat

Вместо обычного "YOU LOSE" — show Death Flashback overlay.

### Data collection

During battle, record snapshot of board state + tray + HP at **every placement**. Store in `battleHistory` array (max 50 entries = 50 placements, LRU):

```js
battleHistory.push({
  turn: turn,
  board: JSON.parse(JSON.stringify(board)),
  tray: [...tray],
  playerHP: playerHP,
  bossHP: bossHP,
  placedAt: { row, col, piece }
});
```

### On defeat

1. Analyze `battleHistory` (backward scan): find latest turn where board state had a *better placement* that would have:
   - Triggered higher combo
   - Cleared more charged cells
   - Delayed boss attack

2. Algorithm: simple simulator — for each recorded snapshot, try placing the piece in all valid positions, compute alternative damage. Find the placement with highest alternative damage.

3. If alternative damage > actual damage taken by more than 30% → show Flashback.

### Display

```
YOU FELL.

Turn 14 — you placed L-shape at H7.
If you'd placed it at B3, the cascade would have cleared 4 charged ember cells.
You would have survived.

[RETRY] [BACK]
```

Visual: freeze-frame of that turn's board, with alternative placement shown in ghost-gold outline.

**Tone:** not judgmental. Not "you screwed up." More like "here's what the next attempt can look like."

**Что НЕ трогать:** core defeat logic; save data.

**Критерий готовности:**
- [ ] `battleHistory` collected correctly (test in devtools)
- [ ] On defeat, analysis finds alternative placement
- [ ] Flashback UI renders with freeze-frame + ghost placement
- [ ] Retry button works, board restored to start
- [ ] Если no alternative found ("you played optimally but boss too strong") → fallback message: "Your squad wasn't enough. Try a different composition."
- [ ] No console errors

**Коммит:** `feat(phase-4): death flashback — analyse + show alternative placement after defeat`

---

## 🟡 TASK #4.4 — Combo UI Feedback Enhancement

**Контекст:** фаза 4. YELLOW — точная калибровка после playtest.

**Задача:** усилить visual feedback для combos чтобы the moment "я собрал цепь" был осязаем.

### Enhancements

1. **Combo escalation visual** (x1 → x3 → x6 → x12):
   - Each tier: different particle color + intensity + SFX tone
   - x12 combo: full-screen flash (brief, 200ms) + "MAX COMBO" text overlay

2. **Cascade animation:**
   - When line clear triggers second line clear (via motif), slow each cascade step by 150ms
   - Makes multi-line cascades feel earned, not confusing

3. **Charged cell combo:**
   - When placement clears 3+ charged cells in one line: unique "INFERNO" text overlay + screen shake (subtle)

4. **Damage number polish:**
   - Crit damage numbers 1.5× bigger + gold tint
   - Max combo numbers in capital letters

**Что НЕ трогать:** damage calc.

**Критерий готовности:**
- [ ] 4 enhancements implemented
- [ ] No performance drop (60fps sustained on mobile)
- [ ] Reduced motion setting respects all новые effects
- [ ] Romanov playtest confirms "combos feel powerful" subjective rating ≥ 8/10
- [ ] No console errors

**Коммит:** `polish(phase-4): combo UI feedback — escalation visuals + cascade timing + inferno overlay`

---

## 🟡 TASK #4.5 — Phase 4 Balance Pass

**Контекст:** YELLOW. После реализации 4.1–4.4, Роман играет 30 боёв.

**Задача:** сбор playtest data + balance tuning.

Метрики:
- Frequency of The Moment (по subjective оценке — "wow" count per 10 battles)
- Signature combo usage rate (сколько times players собрал 3-of-faction squad)
- Clutch slow-mo triggers (not too often, not too rare)
- Death Flashback accuracy (alternative placement truly better в субъективной оценке)

Cell `/PHASE_4_PLAYTEST.md` + MGD adjustment doc + apply.

**Критерий готовности:**
- [ ] 30 боёв отыграны Романом
- [ ] `PHASE_4_PLAYTEST.md` заполнен
- [ ] MGD adjustment applied
- [ ] The Moment triggers в 3+ of 10 последующих боёв

**Коммит:** `balance(phase-4): the moment calibration`

---

## 🟢 TASK #4.6 — Phase 4 Regression + Sign-off

**Контекст:** фаза 4, Bug Fixer + QA.

**Тест-кейсы:**
1. Signature combos: 3 faction signatures работают
2. Clutch slow-mo: triggers correctly, cooldown works
3. Death Flashback: renders + alternative placement sensible
4. Combo escalation: x1→x12 visually distinct
5. Cascade timing: обоснован, not sluggish
6. Reduced motion: все новые effects отключаются
7. No performance drops during signature + slow-mo + inferno combo

Создать `PHASE_4_SIGNOFF.md` + **видео** The Last Line-момента.

**Критерий готовности:**
- [ ] 7 тест-кейсов прошли
- [ ] Video The Moment captured
- [ ] SIGNOFF doc заполнен

**Коммит:** `test(phase-4): full regression; Phase 4 complete`

Merge `phase-4-the-moment` → `main` + tag `v0.4.0-phase-4-done`.

**🟡 Визуальный чекпоинт:** Роман присылает video The Moment в реальном бою.

---

# 8. ФАЗА 5 — ONBOARDING REBUILD

**Цель:** новый игрок за ≤7 минут проходит FTUE и выигрывает Boss_1 с пониманием core loop (без текстовых туториалов).

**Правило:** **учить через действие**, не через текст. Если требуется "read this tooltip" — это проигрыш дизайна.

**Срок:** 2 недели.

---

## 🟢 TASK #5.1 — FTUE Storyboard Design

**Контекст:** фаза 5, агент UI/UX Director + Creative Director. Design document.

**Задача:** создать `/gdd/ftue/FTUE_STORYBOARD.md` с 7-минутным прохождением.

### 7-minute FTUE arc

| Минута | Событие | Что игрок учит |
|---|---|---|
| 0:00–0:30 | Splash + leader choice (1 выбор, не 3) | Identity: "я на стороне X" |
| 0:30–1:00 | Меню с pointer на BATTLE, shifted squad показывает 1 hero | Minimum viable hub |
| 1:00–1:30 | Pre-battle dialogue от Pyredrake (voice line) | Stakes: враг-character, не спрайт |
| 1:30–3:30 | **Battle_0: scripted first battle** — see Task 5.2 | Core loop через действие |
| 3:30–4:00 | Victory + reward: unlock 2nd hero | Dopamine + прогрессия |
| 4:00–4:30 | Back to hub, показывает добавленного героя, squad теперь 2 | Collection is real |
| 4:30–6:30 | Battle_1: Boss_1 normally — но с 2 heroes | Первое самостоятельное прохождение |
| 6:30–7:00 | Если победа: Boss_2 unlocked. Если проигрыш: Death Flashback triggered (уже сам учит). | Either way — hooked |

### Design принципы

1. **NO text tutorials.** Tooltips OK для icons (1 line max), но не для механик.
2. **Scripted first battle:** specific piece drop order chosen to guarantee combo ≥ 3 at first clear. Game "позволяет" игроку feel smart.
3. **Progressive disclosure:** element motifs не all 5 at once. Battle_0 — только ember. Other motifs появляются in Chapter 1 progression.
4. **Leader choice simplified:** сейчас показывает 3 options. Упростить до 2 — более ясный dichotomy.

**Что НЕ трогать:** код.

**Критерий готовности:**
- [ ] `FTUE_STORYBOARD.md` заполнен
- [ ] 7-минутный arc labeled per-minute
- [ ] Scripted first battle piece order определён
- [ ] Progressive disclosure rules defined
- [ ] MGD approved

**Коммит:** `docs(phase-5): FTUE storyboard — 7-minute arc + progressive disclosure`

---

## 🟢 TASK #5.2 — Scripted First Battle

**Контекст:** фаза 5. Implementation of the critical Battle_0.

**Задача:** создать special-case "FTUE battle" mode where piece drops are scripted to guarantee success + combo-demo.

### Data structure

```js
const FTUE_BATTLE_SCRIPT = {
  bossId: 'Boss_1_ftue',
  bossHP: 600, // lower than normal 1800
  pieceSequence: [ // forced piece drops in order
    'I-horizontal',
    'L-shape-rotated-left',
    'square-2x2',
    'I-vertical',
    'T-shape',
    // ... ~10 pieces, designed to guarantee clear on piece 4 at B3 column
  ],
  boardInitialState: [
    // pre-placed ember-charged cells at positions that combo easily
    // row 7: [0,0,0,'ember-charged',0,0,0,0]
    // row 6: [...]
    // ... placements that make "ah, I see it" easy at piece 4
  ],
  bossAttackPattern: [5, 10, 15] // attack countdowns, delayed to let player breathe
};
```

### Gameplay flow

1. Instead of random `SHAPES[rand]`, tray draws from `pieceSequence` in order
2. Board starts with pre-placed cells (demonstrates что "charged" state existed)
3. Player places 1st piece → nothing special
4. Player places 2nd piece → nothing special
5. Player places 3rd piece → hints appear on board (gold outline at B3 ghost position)
6. Player places 4th piece at B3 → **3-line cascade** + charged ember trigger + "COMBO x6!" overlay
7. Boss takes massive damage (first visceral The Moment)
8. Battle continues with more relaxed piece sequence until boss dies

### Hint overlay logic

After piece 3: `ghostHintActive = true`, render faint gold outline on optimal placement position. Fade when player touches piece.

If player places elsewhere: no harsh penalty, piece 4 sequence continues, eventually игрок выигрывает другим путём, но без big cascade.

**Flag на сейве:** `ftueCompleted: true`. После того как flag = true, piece sequence returns to normal random.

**Что НЕ трогать:** core piece-drop logic — только FTUE-mode branch.

**Критерий готовности:**
- [ ] FTUE battle mode activates if `!ftueCompleted`
- [ ] Scripted pieces приходят in order
- [ ] Board initial state pre-placed correctly
- [ ] Ghost hint overlay appears after piece 3
- [ ] Placement at B3 → guaranteed 3-line cascade + combo x6
- [ ] Boss dies feels earned
- [ ] After victory: `ftueCompleted = true` saved
- [ ] Subsequent battles normal random

**Коммит:** `feat(phase-5): scripted first battle — guaranteed The Moment in FTUE`

---

## 🟢 TASK #5.3 — Progressive Disclosure System

**Контекст:** фаза 5.

**Задача:** все element motifs (ember, tide, grove, solar, umbra) активны default. В FTUE они раскрываются постепенно.

### Unlock order through Chapter 1

| Boss | Active motifs |
|---|---|
| Boss_1 (Pyredrake / Ember) | Ember only |
| Boss_2 (Abyssal Tyrant / Tide) | Ember + Tide |
| Boss_3 (Grovewarden / Grove) | Ember + Tide + Grove |
| Boss_4 (Solar Phoenix / Solar) | Ember + Tide + Grove + Solar |
| Boss_5 (Crypt Lich / Umbra) | All 5 motifs active |

### Implementation

Global flag in state: `activeMotifs = Set(['ember'])`. Add to set after victory over each boss.

In motif-trigger logic (ember inferno, tide chain, grove bloom, etc.): gate with `if (!activeMotifs.has('ember')) return;`.

Cells of "not yet active" stihiyas still appear on board (visual variety), but motifs don't trigger для них. They just give base damage.

### "New motif unlocked" cinematic

Between Boss_1 victory and Boss_2 start: 10-second cinematic showing tide-chain demo on a fake board. Show, don't tell. Skippable by tap.

**Критерий готовности:**
- [ ] `activeMotifs` state tracks correctly
- [ ] Gated motifs don't trigger when not active
- [ ] Victory over each boss adds motif to set
- [ ] 4 "new motif unlocked" cinematics работают (tide/grove/solar/umbra)
- [ ] After Chapter 1 complete: все 5 active indefinitely

**Коммит:** `feat(phase-5): progressive motif disclosure — unlocks per boss`

---

## 🟢 TASK #5.4 — Remove All Tutorial Text

**Контекст:** фаза 5.

**Задача:** найти и удалить всё tutorial-style text. Заменить на action-based feedback где возможно.

### Audit

Grep поиск:
- `tutorial`, `tip:`, `hint:`, `"Tap here"`, `"This is your"`, `"You can"`

Each instance оценить:
1. Useful → keep, shorten to ≤8 words
2. Redundant (player learns by doing) → delete
3. Genuinely needed → replace with icon + 1-word label

### Tooltip system policy

- Icons in UI: tap-hold shows tooltip 1 line max
- **Never** modal tutorials blocking gameplay
- Never "walkthrough pointer" after FTUE (single pointer in FTUE = OK; persistent = no)

**Что НЕ трогать:** FTUE scripted battle elements (они уже минималистичны).

**Критерий готовности:**
- [ ] Full audit list in `PHASE_5_TUTORIAL_CLEANUP.md`
- [ ] All tutorial text either deleted или сжато до ≤8 words
- [ ] No tutorial modal blocks gameplay post-FTUE
- [ ] Tooltips exist only for icons, tap-hold
- [ ] No console errors

**Коммит:** `refactor(phase-5): remove tutorial text; action-based feedback only`

---

## 🟢 TASK #5.5 — Phase 5 Regression + Sign-off

**Контекст:** фаза 5, Bug Fixer + QA.

**Задача:** полное FTUE regression.

**Тест-кейсы:**
1. Fresh install: FTUE завершается за ≤7 минут (stopwatch)
2. Scripted first battle delivers cascade at piece 4
3. New player (наёмный тестер, если возможно — или сам Роман в incognito) понимает core loop без reading text
4. Progressive disclosure works: motif cinematics play between bosses
5. Post-FTUE: все 5 motifs active permanently
6. Settings "skip FTUE" на fresh install doesn't work (FTUE mandatory for new players)

**Важный тест:** Роман просит friend (не игрока Blocksworn) пройти FTUE. Записывает timing + friction points. Заполняет `/PHASE_5_USER_TEST.md`.

Create `PHASE_5_SIGNOFF.md`.

**Критерий готовности:**
- [ ] 6 тест-кейсов прошли
- [ ] Friend-test done, documented
- [ ] Friend understands: "The goal is clear lines to hurt the boss" без explanation
- [ ] SIGNOFF doc заполнен

**Коммит:** `test(phase-5): FTUE regression + user test`

Merge + tag `v0.5.0-phase-5-done`.

---

# 9. ФАЗА 6 — LAUNCH PREP

**Цель:** игра готова к soft-launch. Audio, analytics, store assets, Season Pass v2, legal, performance — всё на месте.

**Срок:** 2-3 недели.

**Критерий готовности:** можно залить в AppStore TestFlight / Play Internal Testing + PWA на production-домен без stopper-issues.

---

## 🟢 TASK #6.1 — Audio System

**Контекст:** фаза 6, Art Director (audio side) + GitHub Agent.

**Задача:** добавить SFX + music.

### SFX library

Minimum (≤20 sounds):
- `sfx_piece_drop` (placement)
- `sfx_line_clear_1`, `_2`, `_3`, `_4` (by combo tier)
- `sfx_inferno` (ember inferno trigger)
- `sfx_freeze_chain` (tide motif)
- `sfx_bloom` (grove motif)
- `sfx_detonate` (solar motif)
- `sfx_umbra_pulse` (umbra motif)
- `sfx_hero_fire_<stihiya>` × 5
- `sfx_hero_ult_<stihiya>` × 5 (more dramatic than fire)
- `sfx_boss_attack`
- `sfx_boss_death`
- `sfx_victory`
- `sfx_defeat`
- `sfx_ui_tap` (button clicks)
- `sfx_ui_error`

### Music

3 tracks:
1. `music_hub` (chill atmospheric, 2-min loop)
2. `music_battle_normal` (tension-building, 3-min loop)
3. `music_battle_phoenix_revive` (override briefly during revive cinematic)

### Implementation

Use `Howler.js` или плейн HTMLAudioElement pool. LocalStorage persist volume settings. Reduced motion doesn't affect sound (different setting — `settings.muteSound`, `settings.masterVolume`).

### Asset sources

Budget-friendly: Freesound.org (CC0/CC-BY), Zapsplat, Pixabay. Royalty-free commercial-use licenses only. **Никогда не копипастить из YouTube рипов.**

**Что НЕ трогать:** battle logic — только add sound triggers.

**Критерий готовности:**
- [ ] ≥18 SFX integrated
- [ ] 3 music tracks integrated
- [ ] Volume controls in Settings работают
- [ ] Mute option работает
- [ ] License files stored in `/licenses/audio/`
- [ ] Файл size растёт on ≤3MB (audio compressed to OGG/MP3 low bitrate)
- [ ] No console errors

**Коммит:** `feat(phase-6): audio system — SFX library + music tracks`

---

## 🟢 TASK #6.2 — Analytics Integration

**Контекст:** фаза 6.

**Задача:** базовые analytics для понимания retention без инвазивного tracking.

### Privacy-first подход

Use **Plausible**, **Umami**, или self-hosted PostHog. NOT Google Analytics (privacy concerns).

### Events to track

| Event | Props |
|---|---|
| `app_open` | firstOpen?, appVersion |
| `ftue_start` | — |
| `ftue_complete` | elapsedSeconds |
| `ftue_abandon` | lastStep, elapsedSeconds |
| `battle_start` | bossId, squadComposition |
| `battle_win` | bossId, turnsElapsed, heroesUsed |
| `battle_loss` | bossId, turnsElapsed, causeOfDeath |
| `chapter_complete` | chapterId |
| `hero_unlocked` | heroId, method |
| `signature_combo_used` | factionId |
| `settings_changed` | settingKey, newValue |
| `app_close` | sessionDurationSeconds |

### Privacy disclosure

Settings → Privacy panel с opt-out: "Help improve the game by sharing anonymous usage data [ ] ON". Default: opt-in (можно обсудить GDPR для EU launch). MVP: opt-out toggle clearly visible.

### What NOT to track

- No user IDs (anonymized session UUID)
- No device fingerprints
- No crash-reporting of user input
- No location beyond country-code (for localization)

**Что НЕ трогать:** game logic.

**Критерий готовности:**
- [ ] Analytics endpoint configured (dev + prod)
- [ ] All 11 events fire correctly (test in dashboard)
- [ ] Privacy opt-out works
- [ ] No PII tracked (audit by Роман)
- [ ] Offline mode: events queued, flushed on reconnect

**Коммит:** `feat(phase-6): privacy-first analytics integration`

---

## 🟢 TASK #6.3 — Store Listing Assets

**Контекст:** фаза 6, Art Director.

**Задача:** создать pack of store assets.

### Required

**App Icon** (all sizes):
- iOS: 1024×1024 + 180 + 120 + 87 + 80 + 60 + 40 + 29
- Android: 512×512 + 192 + 144 + 96 + 72 + 48 + 36
- PWA: 512 + 256 + 192 + 144 + 96 + 48

**Design:** single distinctive symbol (predлагаю: square grid with one ember-charged cell glowing). Arena Premium palette — deep black + gold accent.

**Screenshots** (5-6 per platform, in multiple sizes):
- Hub с BATTLE CTA
- Battle mid-combat (combo x6 firing)
- The Moment (board visible with hero ULTs)
- Squad-select with Signature indicator
- Boss death cinematic
- Tower entry (optional)

**Store description:**
- **Short (30 chars):** "Block puzzle × boss-battle RPG"
- **Subtitle (100 chars):** "Place blocks, summon heroes, outwit legendary bosses in 2-minute tactical battles"
- **Long description:** 4000-char (AppStore) / 4000-char (Play). Written by Роман, reviewed by MGD.
- **Keywords:** puzzle, block, rpg, tactical, heroes, boss battle, strategy, indie

**Feature image:**
- Android Play: 1024×500
- AppStore: N/A (no direct feature image)

**Trailer video:**
- 15-30s
- Hub → Battle → Cascade → Boss defeat → Logo
- No voiceover, just SFX + music

**Что НЕ трогать:** существующие in-game assets.

**Критерий готовности:**
- [ ] Icon в всех sizes saved в `/store_assets/icons/`
- [ ] Screenshots saved in `/store_assets/screenshots/`
- [ ] Descriptions drafted в `/store_assets/copy/`
- [ ] MGD approved descriptions
- [ ] Trailer video 15-30s ready

**Коммит:** `assets(phase-6): store listing pack — icons, screenshots, copy, trailer`

---

## 🟢 TASK #6.4 — Performance Optimization

**Контекст:** фаза 6, Polish Director + GitHub Agent.

**Задача:** target 60fps stable on mid-range mobile devices.

### Audit targets

1. **File size:** aim ≤10MB total (HTML + SFX + images). Lighthouse mobile score ≥ 90.
2. **First contentful paint:** ≤2.5s on 3G throttle.
3. **Battle 60fps:** measure with DevTools Performance на mid-range Android.

### Optimizations

1. **Image:** convert все base64 JPG в ASSETS → WebP (50-70% size reduction). Update encoding script.
2. **Code splitting:** if feasible в single-HTML approach — при нет, оставить single-file для PWA simplicity.
3. **Animation frame budget:** use `requestAnimationFrame` throttling for non-critical animations (idle particles, background gradient pulse).
4. **DOM count:** grid = 64 cells; keep DOM lightweight. No unnecessary wrapper divs.
5. **localStorage batching:** debounce saves to once per 500ms vs every change.
6. **Assets lazy-load:** don't load hero portraits for non-active chapter's heroes.

### Benchmarks

Before/after:
- File size KB
- First contentful paint ms
- Combat FPS (avg, 1% low)
- Memory use MB

Store в `/PERFORMANCE_BENCHMARK.md`.

**Что НЕ трогать:** game logic (только performance side-effects).

**Критерий готовности:**
- [ ] File ≤10MB
- [ ] Lighthouse mobile perf ≥ 90
- [ ] Combat 60fps sustained on test device (iPhone 11 / Pixel 5)
- [ ] FCP ≤2.5s на 3G throttle
- [ ] Benchmark doc заполнен

**Коммит:** `perf(phase-6): optimize to 60fps mobile + ≤10MB + ≤2.5s FCP`

---

## 🟢 TASK #6.5 — Season Pass v2 Design + Implementation

**Контекст:** фаза 6. Возвращаем Season Pass но с правильным дизайном.

### Design principles

1. **Never pay-to-win.** Paid track gives cosmetics + QoL, never unique mechanics.
2. **Free track is generous.** 70% of rewards available без payment.
3. **No FOMO pressure.** Season completion realistic at 20-30 min/day play, not 2hr/day.
4. **No push-to-spend ads.** Shown once on Season start, never ambient.

### Season structure

- **Duration:** 60 days
- **Tiers:** 50
- **XP source:** battle wins, daily missions, Tower progress
- **Free track rewards:** gold (5000/tier), fragments, small banner frames, one hero portrait (alt skin)
- **Paid track rewards (premium):** 5000 gems (more generous than cost), more banner frames, 3 alt skins, profile emotes

### Implementation

Re-enable `SEASON_FEATURE_ENABLED = true`. Rebuild `screenSeason` UI:
- Top: current tier + XP progress
- Body: scrollable list of all 50 tiers, free + paid sides
- Bottom: "Unlock Premium" CTA if not unlocked

Price: **USD 6.99** (once per season). Offered only to players who completed Chapter 1 (gate: meaningful choice).

### Cosmetics

- **Banner frames:** profile card bordering; 15 total (5 free, 10 premium)
- **Alt skins:** 3 alternate portraits for existing heroes; subtle recolors, not new-character
- **Profile emotes:** 8 emotes for social sharing later (placeholder now)

**Что НЕ трогать:** core game mechanics.

**Критерий готовности:**
- [ ] Season Pass UI working
- [ ] Free + paid tracks render
- [ ] XP earning works
- [ ] Premium purchase flow (stubbed for soft-launch, real integration in Phase 6.7)
- [ ] Cosmetics properly unlocked and applied
- [ ] No pay-to-win items anywhere

**Коммит:** `feat(phase-6): Season Pass v2 — ethical design, cosmetics only, Chapter-1 gate`

---

## 🟢 TASK #6.6 — Legal + Compliance Checklist

**Контекст:** фаза 6, agent: GitHub Agent + Роман (legal consults external lawyer if needed).

**Задача:** create `/legal/` folder + полное compliance review.

### Documents

- `privacy_policy.md` — GDPR-compliant. Хост на публичном URL перед store submission. Standard template + Blocksworn-specific data mentions.
- `terms_of_service.md`
- `eula.md`
- `credits.md` — list all licenses (fonts, SFX, images, code libs)
- `/licenses/` folder with actual license files for all 3rd-party assets

### Store-specific compliance

- **Apple App Store:** no outbound links to non-Apple payment methods. Gambling/loot box mechanic disclosure в description (если Season Pass качает как such — IAP disclosure).
- **Google Play:** similar. Plus Data Safety form filling.
- **Age rating:** submit как 12+ (violence is mild fantasy, no gore, mild strategic tension).

### Blocksworn-specific

- Monetization clearly disclosed in store listing
- Analytics opt-out visible
- No children's-targeted features (unless explicit COPPA consideration — default no)

**Что НЕ трогать:** existing code — только добавлять legal docs.

**Критерий готовности:**
- [ ] Privacy Policy, ToS, EULA, Credits docs ready
- [ ] `/licenses/` folder contains all 3rd-party licenses
- [ ] Roman review + external lawyer sign-off (если budget позволяет)
- [ ] Age-rating assets prepared for store submission
- [ ] Data Safety form filled for Play Store

**Коммит:** `legal(phase-6): privacy policy, ToS, EULA, credits, licenses`

---

## 🟡 TASK #6.7 — Soft-Launch Geo Selection + IAP Integration

**Контекст:** фаза 6. YELLOW — geo selection зависит от Romanова market intuition + budget.

**Задача:** выбрать soft-launch markets + integrate IAP.

### Soft-launch geo principles

- **Smaller English-speaking markets:** Philippines, Canada, Australia, New Zealand. Lower CPI for testing, feedback in English.
- **Non-English option:** Brazil (big mobile gaming market, fast feedback).
- **Avoid:** US (saturate testing budgets), China (requires partner), EU (GDPR strict testing).

Recommend start with **Philippines + Canada** for ~30-day soft launch.

### IAP integration

- **iOS:** StoreKit 2 for Season Pass. Apple sandbox testing.
- **Android:** Google Play Billing. Test accounts for internal testing.
- **Web PWA:** Stripe Checkout (fallback if no platform-native IAP available).

Wrapper module `iap.js`:
```js
async function iap_purchase(productId) {
  // Detect platform; route to correct SDK
}
async function iap_restore() {
  // Restore purchased items after reinstall
}
```

**Что НЕ трогать:** Season Pass content (только payment layer).

**Критерий готовности:**
- [ ] Soft-launch countries chosen (Philippines + Canada recommended)
- [ ] iOS StoreKit sandbox works (test purchase flow)
- [ ] Android Play Billing test account works
- [ ] Web Stripe fallback works
- [ ] Purchase restoration works после clean reinstall
- [ ] Telemetry verified: `iap_purchase_attempted`, `iap_purchase_success`, `iap_purchase_failed` all tracked

**Коммит:** `feat(phase-6): IAP integration + soft-launch geo selected`

---

## 🟢 TASK #6.8 — Final QA + Soft-Launch Build

**Контекст:** фаза 6, Bug Fixer + QA + Роман.

**Задача:** полный regression perfect build.

### Regression matrix

| Test | Pass criteria |
|---|---|
| Fresh install (iOS) | FTUE completes in ≤7 min |
| Fresh install (Android) | Same |
| Fresh install (PWA mobile) | Same |
| Fresh install (PWA desktop) | FTUE works, screen scales |
| Returning player (old save from v0.1) | Migration work end-to-end |
| Full Chapter 1 run | Finishes без crashes |
| Tower Floor 1-25 | Accessible, progress saves |
| Squad-select: all 15 heroes | Render correctly |
| All 5 boss voices | Fire in correct order |
| Signature combos (3 factions) | Active correctly |
| Clutch slow-mo | Triggers once per battle |
| Death Flashback | Renders with meaningful alternative |
| Settings volume | All volumes work |
| Analytics events | Firing correctly |
| IAP purchase (sandbox) | Completes + Season Pass unlocks |
| Offline mode | Battles playable, queue analytics |
| Reload mid-battle | State restored correctly |
| Low-end device (iPhone 11 / Pixel 4a) | 60fps sustained |

### Soft-launch readiness checklist

- [ ] 18 regression tests pass
- [ ] Store listing ready (icon, screenshots, copy, trailer)
- [ ] Legal docs published on public URL
- [ ] Analytics dashboard live + events firing
- [ ] Privacy opt-out works
- [ ] IAP tested в sandbox
- [ ] File ≤10MB
- [ ] Lighthouse ≥90 mobile
- [ ] Crash reporting active
- [ ] Backend uptime if applicable

### Soft-launch build submission

- iOS: TestFlight build uploaded, external testers invited
- Android: Internal testing track + closed alpha setup
- PWA: Production domain configured, SSL valid

Create `SOFT_LAUNCH_READY.md` with full checklist signed off.

**Критерий готовности:**
- [ ] 18 regression tests pass
- [ ] Soft-launch build submitted to stores
- [ ] PWA production live
- [ ] `SOFT_LAUNCH_READY.md` signed off by Роман + MGD

**Коммит:** `release(phase-6): soft-launch build ready`

Merge `phase-6-launch-prep` → `main` + tag `v1.0.0-soft-launch`.

---

# 10. DEFERRED v2 BACKLOG

**Явно отложенные фичи — возвращаемся после soft-launch + retention data.**

## v2.1 — Content Expansion
- **Chapter 2 (Forsaken Depths):** 5 new bosses
- **Chapter 3 (Primal Conclave):** 5 new bosses
- **4th faction:** (undefined — пусть появится как reward после v1 retention data укажет куда тянет игроков)

## v2.2 — Endgame Systems
- **Event Dungeons:** weekly limited-time challenges
- **Arena (async PvP):** ghost-squad matches
- **Awakening:** deeper hero evolution
- **Artifacts:** equippable items with synergies

## v2.3 — Social
- **Guilds:** group play coordination
- **Leaderboards:** Tower + Event rankings
- **Profile sharing:** showcase squad via deep links

## v2.4 — Challenge Modifiers
- **Daily challenge modifiers:** random twists (double damage, halved HP)
- **Weekly mega-challenge:** themed mod combo

---

# 11. WEB3 PHASE 7+ — ПОСЛЕ PROVEN RETENTION

**Ключевой принцип:** Web3 не добавляется пока игра не любима без него.

## Триггер-условия для Phase 7

- [ ] v1 soft-launch D7 retention ≥ 25%
- [ ] D30 retention ≥ 10%
- [ ] Avg session length ≥ 15 min
- [ ] Organic organic word-of-mouth observed (social mentions, sharing)
- [ ] Roman personally чувствует "игра есть"

Если эти условия не выполнены после soft-launch → **никакого Web3**. Возвращаемся к v2 content/polish до тех пор пока retention не вырастет.

## Phase 7 plan (high-level, detailed позже)

### 7.1 — StarkNet wallet connection (optional)
- Cartridge/Argent wallet integration
- Read-only connection first: game works without wallet, но тест с wallet показывает "your heroes are yours" messaging

### 7.2 — Hero ownership as ERC-721 (StarkNet)
- Cairo contract для hero NFTs
- Mint on unlock (free, paid by game treasury — not player)
- Metadata frozen: name, race, role, stihiya, tier
- Transferable между wallets

### 7.3 — Marketplace
- In-game marketplace UI
- List hero for sale (set price in STRK or USDC)
- Buy flow: wallet signing → transfer
- Royalty 5% to game treasury (sustaining, not extractive)

### 7.4 — Tournament system
- Weekly tournaments with entry fee (wallet signed)
- Prize pool distributed on-chain
- Transparent, auditable

**Что НЕ делаем в Phase 7:**
- Tokenomics ("blocksworn coin") — скользкая дорожка к speculation
- NFT bosses, NFT items — scope creep
- DAO governance — игрок платит за игру, не за политику

---

# 12. APPENDIX

## 12.1 Final Hero Roster (15 heroes, 3 factions)

### Pirates (Ember) — Raw damage, explosive
1. THORGAR (warrior) — Cleaver Sweep + SIEGE ULT
2. BLACKTOOTH (hunter) — Sparkshot + VOLLEY ULT
3. EMBERHAND (mage) — Ember Bloom + MENDING ULT
4. IRONBELLY (tank) — Firebrand + AEGIS ULT
5. CRIMSON (captain) — Captain's Gambit + DOMINION ULT

### Rock Band (Umbra) — Combo multipliers, escalation
1. RIFFBLADE (warrior) — Riff Strike + SIEGE ULT
2. SHRIEK (hunter) — Piercing Shriek + VOLLEY ULT
3. KEYCRYPT (mage) — Deep Beat + MENDING ULT
4. THUNDERBEAT (tank) — Drumhead + AEGIS ULT
5. NIGHTLORD (captain) — Conduct the Dark + DOMINION ULT

### Clockwork (Tide) — Deferred payoff, time manipulation
1. GEARSWORN (warrior) — Winding Strike + Great Winding ULT
2. TICKTOCK (hunter) — Pendulum Shot + Tock Returns ULT
3. CHRONOS (mage) — Rewind + The Pause ULT
4. PENDULUM (tank) — Tock Guard + Eternal Swing ULT
5. HOROLOGE (captain) — Synchronize + Grand Clockwork ULT

## 12.2 Final Boss Roster (Chapter 1: Ashen Dominion)

| # | Name | Title | Element | Archetype | HP | Attack Int |
|---|---|---|---|---|---|---|
| 1 | PYREDRAKE | The Cinder That Refuses To Die | Ember | Berserker | 1800 | 11 |
| 2 | ABYSSAL TYRANT | Sea Overlord | Tide | Armored | 3800 | 9 |
| 3 | GROVEWARDEN | Ancient Keeper | Grove | ??? | 6500 | 7 |
| 4 | SOLAR PHOENIX | Reborn Tyrant | Solar | Phoenix | 7500 | 6 |
| 5 | CRYPT LICH | Final Overlord | Umbra | ??? | 11000 | 5 |

(Boss 3 and 5 archetypes to be assigned in Phase 3 lore doc)

## 12.3 Retention Metrics to Watch (after Phase 6 soft-launch)

| Metric | Soft-launch target | Green-light full-launch |
|---|---|---|
| D1 retention | ≥45% | ≥55% |
| D7 retention | ≥20% | ≥25% |
| D30 retention | ≥8% | ≥12% |
| Avg session length | ≥8 min | ≥15 min |
| FTUE completion | ≥75% | ≥85% |
| Chapter 1 completion | ≥30% of FTUE-completers | ≥40% |
| Sessions/day (active user) | ≥2 | ≥3 |
| Voluntary uninstall rate | ≤20% at D7 | ≤12% |

**Если targets не hit после 30-60 days soft-launch:**
- Не лончить globally. Вернуться к Phase 4-5 polish based on specific retention drop-off points (e.g., if D7 = 15% but D1 = 55% → onboarding/early-game issue).
- Используй analytics data от Task 6.2 для диагностики.

---

# КОНЕЦ

**Документ готов для отправки задач Claude Code.**

Процедура:
1. Начни с **Task #1.1**. Не пропускай.
2. После каждой задачи — чеклист + commit.
3. После Фазы 1 merge — пришли мне sign-off + скриншоты.
4. Я валидирую → идём в Фазу 2.
5. Фазы 2-6 по той же схеме.

**Если возникает scope creep, "а может заодно X":**
- Записываем в `/BACKLOG.md`
- Не включаем в текущую задачу
- Обсуждаем с MGD в pause между фазами

**Если баланс / UX не попадает:**
- YELLOW tasks маркированы — после playtest уточняем together
- RED tasks нет в документе сейчас — появятся, если что-то неожиданное выплывет

---

**Подпись:**
*Master Game Director*
*Blocksworn · Scenario A · April 2026*
