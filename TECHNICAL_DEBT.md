# Technical Debt Ledger

Файл отслеживает временные компромиссы внутри Phase 1 reduction.
Каждая запись должна иметь explicit resolution target.

## DEBT-001 · Phase 1 Task 1.3 · Artifact/Modifier stubs
**Introduced:** 2026-04-24 · commit ec4f253
**What:** Следующие идентификаторы сохранены как no-op stubs вместо полного удаления:
- `MODIFIERS = {}`
- `activeModifiers = new Set()`
- `artifactsOwned = {}`
- `equippedArtifacts = {}`
- `artDropPityCounter` state
- `addArtifact() { /* no-op */ }`
- `rollBossArtifactDrop() { return null; }`
- `grantRandomT3Artifact() { return null; }`
- `grantRandomArtifactAtTier() { return null; }`
- `getRewardMultiplier() { return 1; }`

**Why:** Call-sites распределены по кодовой базе и пересекаются с системами которые будут удалены в Task #1.5 (Chapter 2/3 rewards) и Task #1.7 (Paid Packs). Полная очистка в одной задаче утроила бы scope.

**Resolution plan:**
- Task #1.5 должна удалить call-sites в Chapter 2/3 floor reward logic + все ссылки на `getRewardMultiplier`
- Task #1.7 должна удалить call-sites в paid packs / monetization path
- Task #1.9 (regression) должна verify: `grep -cE "MODIFIERS|activeModifiers|artifactsOwned|addArtifact|rollBossArtifactDrop|grantRandomT3Artifact|grantRandomArtifactAtTier|getRewardMultiplier"` = 0

## DEBT-002 · Phase 1 Task 1.3 · Dead CSS selectors
**Introduced:** 2026-04-24 · commit ec4f253
**What:** Следующие CSS selectors упоминаются в shared `.v-secondary` rules но больше не имеют matching DOM элементов:
- `.ach-wrap`
- `.codex-wrap`
- `.arena-wrap`

**Why:** Находятся внутри общих rules которые также применяются к сохраняемым элементам. Хирургическое удаление потребует CSS refactoring.

**Resolution plan:**
- Task #1.6 (Vivid removal) всё равно будет trogать .v-secondary rules — удалить там же
- Если не в 1.6 — в Task #1.9 финальный cleanup pass

## DEBT-003 · Phase 1 Task 1.1 · Heroes fire/fireDelta asymmetry
**Introduced:** 2026-04-24 · baseline observation
**What:** `fire*` count (51) и `fireDelta*` count (49) не совпадают. Один герой имеет дубликат fire ИЛИ один не имеет fireDelta.

**Why:** Не блокирует reduction. Resolution происходит естественно в Task #1.4 когда удаляется 35 из 50 героев.

**Resolution plan:** Task #1.4 verification: после удаления оставшиеся 10 героев должны иметь 10 `fire*` + 10 `fireDelta*` (1:1).
