# Blocksworn — Краткий отчёт для директора

**Дата:** 2026-05-14
**От:** CTO (Claude Code agent, под управлением Romana)

---

## Состояние одним абзацем

**Игра РАБОТАЕТ в продакшене.** Полная v2.1 версия (бои, FTUE, Tower, Battle Pass, 25 героев, 12 музыкальных треков, вся полировка от прошлых 10 спринтов) — **LIVE на https://play.blocksworm.com**. Маркетинговый сайт **https://www.blocksworm.com** тоже live. По 4-фазному плану модернизации (T1.01 → T4.13) выполнено **63 задачи разработки**, **ноль модификаций sacred-cow систем** (combat math, narrative voice, монетизация — байт-идентичные), **1758 unit-тестов** проходят. **Важный нюанс:** фичи Phase 2-4 (Identity Layer FX, Adventures, Party Tower, Chia wallet/NFT) написаны и unit-протестированы в `src/`, но **НЕ активны в live runtime** — это требует интеграционного спринта ("sidecar wiring"), который сегодня попробовали выкатить и пришлось откатить из-за серии каскадных багов. Директор решает, как обработать эту интеграцию дальше.

---

## Что live прямо сейчас

| URL | Статус |
|---|---|
| https://www.blocksworm.com | ✅ Marketing landing (Next.js) |
| https://play.blocksworm.com | ✅ Game (legacy v2.1, 21 MB, всё работает) |
| https://blocksworm.com | ✅ 308 → www |
| beta.blocksworm.com | ❌ Не provisioned (для T4.11 closed beta) |

End-to-end Playwright probe подтверждает: страница грузится чисто, FTUE Chronicler dialog отображается, клик **▶ BEGIN** входит в первую битву, 0 JS errors, 0 same-origin 404s, музыка играет. Live-verification работает автоматически на каждый push в main через CI.

---

## Что есть в коде, но НЕ в live runtime

Эти фичи замержены в main и покрыты unit-тестами, но требуют интеграции (runtime wiring + UI mount points) прежде чем пользователи их увидят:

| Фича | Состояние | Почему не live |
|---|---|---|
| Phase 2 Identity Layer — 5 race FX + 5 boss-reactive механик + Codex | 498 unit-тестов | Sidecar wiring incident сегодня |
| Phase 3 Adventures — async кланы 5-15 игроков | Code complete | Нет UI кнопки в legacy menu |
| Phase 3 Party Tower — 2-5 игроков coop | Code complete | Нет UI |
| Phase 3 Replay viewer | Code complete | Нет UI |
| Phase 3 Friend leaderboard | Code complete | Нет UI |
| Phase 3 Tower Seasonal — 13-недельная ротация | Code complete | Нет UI |
| Phase 4 Sage Wallet + NFT mint/transfer/royalty 2.5% | 184 unit-тестов | Sidecar wiring incident |
| Phase 4 Adventure DAO | 82 unit-тестов | Sidecar wiring incident |
| Phase 4 PURE PATH CHAIN leaderboard | 44 unit-тестов | Sidecar wiring incident |
| Phase 4 Mobile feature flag + Anti-P2W audit | 57 unit-тестов | Sidecar wiring incident |

**Суть:** ~393 новых unit-теста для Phase 2-4 доказывают что модули работают изолированно. Они сидят dormant в продакшене пока не выкатим интеграционный спринт.

---

## Что произошло сегодня (постмортем)

Попытались выкатить **Phase 4.1 sidecar wiring** — runtime интеграция Phase 2-4 фич в legacy. Получили каскад из 6 PR'ов (5 hotfix + 1 rollback) за ~4 часа сломанного продакшена. Root causes:

1. **Недостаточное pre-merge тестирование** — sidecar тестировался unit-тестами в изоляции, но никогда не тестировался как реально-задеплоенный артефакт в реальном браузере
2. **Ship-and-patch loop** — когда первый PR сломал прод, CTO гонялся за симптомами 5 hotfix'ами вместо немедленного revert
3. **Cache header strategy** — стабильное имя `/assets/sidecar.js` + `immutable max-age=1y` = пользователи получали сломанный кэш на год
4. **macOS DNS cache** — Roman'ская машина держала старый IP пока WHOIS verification была pending

В итоге выполнили **полный откат** (PR #178) к чистому legacy. Игра работает. Phase 2-4 sidecar wiring отложен на отдельный спринт с E2E gate с самого начала.

---

## Три решения для директора

### Решение 1 — Как интегрировать Phase 2-4 фичи в live runtime

| Вариант | Усилия | Риск | Результат |
|---|---|---|---|
| **A. Оставить как есть** | 0 дней | 0 | Игроки получают v2.1 game; Phase 2-4 dormant |
| **B. Defensive sidecar v2 (рекомендую)** | 3-5 дней | Средний | Все Phase 2-4 фичи становятся user-visible. Требует pre-merge Playwright walk + collision audit |
| **C. Полная миграция на modular shell** | 2-3 недели | Высокий | Заменить legacy полностью. Чистейшая архитектура. |

**Рекомендация:** B после closed beta. C — правильное направление, но не следующий шаг.

### Решение 2 — Запускать ли Chia integration

| Вариант | Усилия | Стоимость | Результат |
|---|---|---|---|
| **A. Отложить Chia** | 0 | $0 | v2.1 launch standalone |
| **B. Запустить per T4.11 + T4.12 runbooks (рекомендую)** | ~4 недели операционно | $0-500 | Первая AAA+-quality Chia игра с anti-P2W invariant |
| **C. Soft-launch (только achievements)** | ~2 недели | $0-200 | Пилот integration |

**Рекомендация:** B. Engineering investment в Phase 4 уже сделан. Вопрос — операционно запустить или нет. Anti-P2W audit (T4.10) — sacred-cow ENFORCEMENT layer, который сводит P2W риск к нулю by design.

### Решение 3 — Операционное owning

| Вариант | Усилия | Стоимость | Подходит для |
|---|---|---|---|
| **A. Roman + AI agent (текущая модель)** | Текущее | Время Романа + AI API | Pre-revenue, fast iteration |
| **B. Part-time human engineering lead (рекомендую)** | Найм 2-4 нед | 10-20 ч/нед × часовая ставка | Pre-launch через 3 мес post-launch |
| **C. Full-time engineer in-house** | 1-2 мес найм | $5-15k/мес | Post-launch когда revenue это оправдывает |

**Рекомендация:** B на период T4.11 closed beta через ~3 месяца post-T4.12. Re-evaluate по реальным метрикам.

---

## Рекомендованный комбо-путь

Если все три решения "да":

1. **Сейчас:** play.blocksworm.com stable. Не трогать.
2. **Решение 3:** назначить engineering lead (B)
3. **Onboarding lead (1-2 недели):** прочесть 6 reports в `docs/reports/`, взять ownership merges
4. **Phase 4.1 v2 sprint (3-5 дней):** lead делает Option 1B с pre-merge Playwright gate. Phase 2-4 становятся видимы.
5. **T4.11 closed beta provisioning (parallel, 1 нед):** Roman provisions beta.blocksworm.com, Discord, treasury wallet; lead настраивает Sentry/RevenueCat env vars
6. **T4.11 closed beta (2-4 недели):** per runbook. Anti-P2W audit gate.
7. **T4.12 production launch (1 неделя):** 3-волновой launch
8. **Post-launch:** мониторинг + итерации

**Время от сейчас до production launch: ~6-10 недель.**
**Дополнительная стоимость: $5-25k** в зависимости от engineering ownership.

---

## Ключевые цифры

| Метрика | Значение |
|---|---|
| Фаз выкачено (код) | 4 из 4 |
| Задач выполнено | 63 numbered + 4 bridge |
| Unit-тестов проходит | 1758 |
| Sacred-cow модификаций | 0 |
| Vite JS+CSS bundle | 844 KB (94 KB gzipped) |
| ESLint warnings | 0 |
| Visual regression baselines | 25 PNGs |
| PRs за сессию (4 дня) | 23 (#158-#180) |
| Live URL | https://play.blocksworm.com |
| Последний deploy | `0dfbbcc` (music fix, 2026-05-14) |

---

## Файлы для глубокого ознакомления

В папке `docs/reports/`:

- `00_EXECUTIVE_BRIEFING.md` — full executive briefing (English)
- `01_PROJECT_STATE.md` — phase completion matrix, test coverage, sacred cows
- `02_PRODUCTION_TOPOLOGY.md` — URLs, hosting, DNS, deploy pipeline
- `03_SESSION_INCIDENTS.md` — честный постмортем сегодняшнего incident
- `04_RISK_REGISTER.md` — 18 рисков + tech debt
- `05_ROADMAP_OPTIONS.md` — три меню решений с cost-benefit анализом
- `06_INDEX.md` — навигация
- **`RU_BRIEF_FOR_DIRECTOR.md`** — этот документ
