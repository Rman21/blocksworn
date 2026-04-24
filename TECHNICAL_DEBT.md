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
**Resolved:** 2026-04-24 · Task #1.4

**Root cause (identified during Task #1.4 recon):**
- `^async function fire[A-Z]` grep matched 51 because `fireHero(hero, counts)` — the meta-dispatcher — also starts with `fireH*`, inflating the count by 1 (50 hero abilities + 1 dispatcher).
- `fireDelta*` was 49 instead of 50 because **HELIOS** (lion tank) had `fireTierDelta: null` — explicit design choice, no `fireDeltaHelios` function. HELIOS was removed as part of the lion faction in Task #1.4.

**Post-1.4 symmetry (verified):**
- 10 `fire*` hero functions (5 pirates + 5 rock)
- 10 `fireDelta*` hero functions
- 10 `ultTwist*` / 10 `ultDelta*`
- Plus: `fireHero` (dispatcher), `firePlaceholder` / `ultPlaceholder` (Clockwork stubs)

No further action required.

## DEBT-004 · Phase 1 Task 1.3 · Hero-specific state variables
**Introduced:** 2026-04-24 · commit ec4f253 (not fixed in 1.4 either)
**What:** Hero-specific state variables for removed heroes remain as dead `let` declarations:
- `tharaRageArmed`, `tharaRageUsedCount`, `blackfangPackRemaining`, `blackfangPackChain`, `grommarRallyWindow`, `frostweaverBonusDmg`, `glacierIceArmorHits`, `valeriusRadiantTurnOpen`
- All `shade*`, `nyx*`, `vyra*`, `zarnok*`, `kaelen*` flags (umbra tier framework)
- All `aurelius*`, `solaris*`, `lumia*`, `valerius*`, `seraphina*` flags (solar tier framework)
- Plus equivalent blocks for grove/tide/ember removed factions

**Why:** Variables are isolated `let` declarations with no callers (their reader functions — `fire*`/`ultDelta*` — were removed in Task #1.4). They occupy memory but cannot cause runtime errors or behavioral drift.

**Resolution plan:**
- Task #1.9 (regression) grep verification: `grep -cE "(tharaRage|blackfangPack|grommarRally|frostweaverBonusDmg|glacierIceArmor|valeriusRadiant|aureliusColumn|solarisRay|lumiaPanic|seraphinaMark|shadeUlt|nyxConvert|vyraShot|zarnokBolt|kaelenEn|bonelord|iceshot|glacier|rimehelm|leorex|solara|astarion|goldmane)[A-Z]"` should equal 0 after cleanup pass.

## DEBT-006 · Phase 1 Task 1.4 · FTUE script content placeholders
**Introduced:** 2026-04-24 · commit 6bd3744
**What:** Keys `hero_reveals_thara` and `hero_reveals_urzog` in `FTUE_SCRIPTS` были
восстановлены с ad-hoc content адаптированным под новый roster (pirate_warrior +
rock_mage speakers). Original content потерян либо deleted within Task #1.4
working state.

**Forensic audit (2026-04-24):** Keys + array literals присутствовали во всех
commit boundaries baseline → 6bd3744 (FTUE_SCRIPTS bracket balance 6/6 at every
commit). Transient corruption наблюдался только в моём in-task working state
перед финальным restoration edit. Root cause: inadvertent deletion между
uncommitted edits; точный источник не идентифицирован. Финальный commit 6bd3744
структурно корректен.

**Why:** Восстановление было необходимо для resolution наблюдаемого syntax error
(4 `[` / 6 `]` в FTUE_SCRIPTS object literal). Без полного контекста оригинала
content был написан на основе типичной FTUE flow (narrator introduces new hero).

**Resolution plan:** Phase 5 (Onboarding Rebuild) — FTUE_SCRIPTS полностью
переписываются через Creative Director под новый 15-hero roster. Ad-hoc content
этой записи будет заменён в рамках Phase 5 Task 5.1 или 5.2.

**Action now:** Inline `// TODO(phase-5):` comments помечают relevant keys.

## DEBT-007 · Phase 1 Task 1.4 · Narrative elements adapted ad-hoc
**Introduced:** 2026-04-24 · commit 6bd3744
**What:** Следующие narrative elements были переделаны под новый roster без явной
MGD approval перед изменением:
- Leader choice options: LIORA (elf hunter) / OAKROOT (troll druid) → CRIMSON (pirate captain) / NIGHTLORD (rock captain)
- Leader narrator / FTUE storyteller: `grommar_warchief` (orc tank) → `pirate_warrior` (THORGAR) — 21 reference sites
- `POST_FTUE_GIFT_HERO_ID` set to `null` (was `'golem_mage'` — VERDANIA)
- FTUE post-battle reveals: `skeleton_mage` (FROSTWEAVER) → `rock_mage` (KEYCRYPT)

**Why:** Полностью orphaned references после удаления 8 factions в Task #1.4.
Без немедленной адаптации:
- Leader choice modal показывал бы два dead hero IDs → dead-click state
- FTUE narrator dispatch `HERO_ROSTER.find(...)` returned undefined → broken speaker portrait + name
- Post-FTUE gift grant пытался бы разблокировать несуществующего героя

**Resolution plan:** Phase 5 Onboarding Rebuild переосмысляет leader choice и
narrator identity полностью под новую 3-faction структуру. Текущие substitutions
— interim, не final narrative design.

**Action now:** Inline `// TODO(phase-5):` comments помечают каждый из 4 блоков.

## DEBT-005 · Phase 1 Task 1.4 · Chapter 2/3 boss-hero reward mappings
**Introduced:** 2026-04-24 · Task #1.4
**Resolved:** 2026-04-24 · Task #1.5
**What:** `BOSS_HERO_REWARDS[2]` and `BOSS_HERO_REWARDS[3]` mapped to removed hero ids (skeleton_hunter, golem_hunter, lion_hunter, skeleton_captain, golem_captain, lion_captain). Unreachable in Ch1-only play.

**Resolution:** Task #1.5 deleted both `BOSS_HERO_REWARDS[2]` and `BOSS_HERO_REWARDS[3]` entirely along with the Ch2/Ch3 CHAPTERS entries. Only `BOSS_HERO_REWARDS[1]` (Chapter 1, 2 hero grants) remains.

## DEBT-008 · Phase 1 Task 1.4.2 · FTUE reveal does not unlock
**Introduced:** 2026-04-24 · observed during Task #1.4.2 smoke test
**Resolved:** 2026-04-24 · Task #1.5 (Part B)
**What:** After FTUE reveal cinematic, `pirate_hunter` (Blacktooth) was shown as "JOINS THE WARBAND" but `hero.unlocked` remained `false`. Player saw the new hero in the reveal dialog but could not add them to squad.

**Root cause:** `revealHero()` managed only the cosmetic `revealedHeroes` Set + its storage key. It never called `unlockHero()` nor flipped `hero.unlocked`, leaving reveal and unlock as separate paths.

**Resolution:** `revealHero()` now flips `hero.unlocked = true` and appends the id to `HEROES_UNLOCKED_STORAGE_KEY` array (idempotent append, guarded to skip Clockwork placeholders via `!hero.locked`). Clockwork heroes stay locked until Phase 2 spawns real implementations.
