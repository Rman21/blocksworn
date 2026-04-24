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

## DEBT-011 · Phase 1 Task 1.8 · FTUE splash cards full-width
**Introduced:** 2026-04-25 · Task #1.7.1 hotfix
**What:** Splash cards в FTUE intro (3 slides: SUMMONER / PLACE BLOCKS / MATCH
ELEMENTS) рендерятся при full available width вместо центрированного card
с боковыми отступами как было до Task #1.6 Vivid removal.

**Why:** Task #1.7.1 added `.v-splash-card.active { display: flex !important }`
без `max-width`/`width` constraint. Original Vivid had explicit width rule
(удалён в Task #1.6).

**Severity:** Cosmetic only. Splash functionally works (CONTINUE button нажимается,
текст читается). Не блокирует gameplay.

**Resolution plan:** Phase 6 Launch Prep — add Arena Premium splash card sizing
rules:
```css
.v-splash-card.active {
  max-width: 380px;
  margin: 0 auto;
  padding: 24px;
}
```

## DEBT-010 · Phase 1 Task 1.7 · Season system retained as dead code
**Introduced:** 2026-04-25 · Task #1.7
**What:** Season system (`goToSeason()`, `screenSeason` HTML, related CSS and
localStorage keys) сохранён в коде но недоступен через UI:
- Drawer SEASON button удалён в Task #1.7
- Underlying system inert (no trigger path)

**Why:** Scenario A focus (MVP без monetization) не требует Season, но Phase 7+
(post-launch LTV) потенциально вернёт Season Pass. Удаление entire system =
double work в Phase 7.

**Resolution plan:**
- Option A (Phase 7+ needed): restore drawer SEASON button
- Option B (deprecated post-launch): full removal as Phase 6 Launch Prep task

**Action now:** none. Dead code annotated in source with `DEBT-010` comment at
`goToSeason()` function declaration.

## DEBT-009 · Phase 1 Task 1.6 · Vivid class-name aliases retained
**Introduced:** 2026-04-25 · Task #1.6
**What removed (this task):**
- 10 `VIVID STYLIZED — ...` CSS section blocks (lines 7456–9916, 2461 lines):
  ATOMIC COMPONENTS, MAIN HUB LAYOUT, LOADOUT/SELECT, BATTLE SCREEN, RESULT MODAL,
  SHOP, SECONDARY SCREENS, HERO DETAIL BOTTOM SHEET, MOTION/VFX/HAPTICS, FIRST-RUN SPLASH.
- Vivid-specific modal rules (`.modal.vivid-victory`, `.modal.vivid-defeat`) — Arena
  Premium `.a-result[data-result="..."]` rules supersede via proper selector.
- `#infoModal` Vivid cream-card styling block — Arena Premium `.modal` rules now apply.
- All 40 `--v-*` CSS custom properties in `:root` — Arena Premium `--a-*` tokens
  are the single source of design values. Chapter Complete modal font-family
  fallback chain cleaned to `--a-font-display` only.

**What is deferred (still Vivid-named):**

Three parallel coupling layers keep the `v-*` identifier space alive. All three
must change in lockstep — touching one while leaving the others creates a broken
selector chain.

**Layer 1 — DOM class names (67 unique, preserved as architectural hooks):**

Grouped by subsystem for Phase 6 rename planning:

- *Battle (16):* `v-battle`, `v-battle-boss-card`, `v-battle-boss-hptext`,
  `v-battle-boss-info`, `v-battle-boss-lvl`, `v-battle-boss-name`,
  `v-battle-boss-portrait`, `v-battle-dmg-chip`, `v-battle-player-hp`,
  `v-battle-player-hp-num`, `v-battle-topbar`, `v-battle-topbar-actions`,
  `v-battle-tutorial`, `v-battle-tutorial-dots`, `v-battle-tutorial-step`,
  `v-badge`
- *Loadout / Heroes (6):* `v-loadout`, `v-loadout-search`, `v-loadout-topbar`,
  `v-filter-bar`, `v-filter-sort`, `v-filter-subrow`, `v-filter-tab`,
  `v-filter-tabs`, `v-roster-grid`
- *Hero detail sheet (8):* `v-hero-sheet`, `v-hero-sheet-actions`,
  `v-hero-sheet-box`, `v-hero-sheet-close`, `v-hero-sheet-handle`,
  `v-hero-sheet-header`, `v-hero-sheet-portrait`, `v-hero-tab`, `v-hero-tab-body`,
  `v-hero-tab-pane`, `v-hero-tabs`
- *Hub / squad strip (5):* `v-squad-strip`, `v-squad-strip-count`,
  `v-squad-strip-head`, `v-squad-strip-slots`, `v-synergy-row`
- *Secondary screens (6):* `v-secondary`, `v-dailies`, `v-tower`, `v-season`,
  `v-shop`, `v-shop-body`, `v-shop-tabs`, `v-shop-topbar`
- *Navigation (2):* `v-bottom-nav`, `v-nav-item`
- *Splash (11):* `v-splash`, `v-splash-card`, `v-splash-cta`, `v-splash-dots`,
  `v-splash-icon`, `v-splash-intro`, `v-splash-logo`, `v-splash-logo-img`,
  `v-splash-logo-sub`, `v-splash-skip`, `v-splash-track`
- *Generic primitives (5):* `v-btn-primary`, `v-btn-icon`, `v-progress`,
  `v-progress-fill`, `v-progress-lag`

**Layer 2 — JS selector binds (43 total):**

*36 `getElementById('v...')` sites (camelCase DOM ids):*
`vAvatarBtn`, `vAvatarImg`, `vBattleTutorial`, `vBattleTutorialStep`, `vBossCard`,
`vBossDiff`, `vBossImg`, `vBossName`, `vBossRewardsItems`, `vBossSub`,
`vChapterFill`, `vChapterNodes`, `vChapterNum`, `vChapterOfN`, `vCtaSub`,
`vDailyBadge`, `vEnergyAmt`, `vFilterSubrow`, `vGemAmt`, `vGoldAmt`,
`vHeroSheetHandle`, `vLoadoutSearch`, `vMenuLogoImg`, `vPlayerLvl`, `vRosterGrid`,
`vSearchInput`, `vSortLabel`, `vSplash`, `vSplashCta`, `vSplashIntro`,
`vSplashLogo`, `vSplashLogoImg`, `vSquadAvatars`, `vSquadCount`, `vSquadSlots`,
`vSynergyRow`.

*7 `querySelector[All]('.v-*')` sites:*
`.v-hero-sheet-box`, `.v-hero-tab-body`, `.v-battle-tutorial-dots .dot`,
`.v-bottom-nav .v-nav-item`, `.v-filter-tab`, `.v-hero-tab`, `.v-result-extra`.

**Layer 3 — CSS compound selectors (309 occurrences):**

Arena Premium rules scope to the `v-*` class as a child under an `.a-*` parent,
e.g.:
```css
.a-battle .v-battle-boss-card { ... }
.a-hub-squad-slots .v-avatar { ... }
.a-bottom-nav .v-nav-item.active { ... }
.a-filter-subrow .v-sub-chip { ... }
```
These provide the actual Arena Premium *styling* — the `v-*` side of the compound
is just a selector hook.

**Other cosmetic residue:**
- JS section comment `V3.0 PHASE 2 · VIVID RENDERERS` — cosmetic label only,
  underlying logic is Arena Premium.
- 20 textual `VIVID` / `Vivid` occurrences across Task #1.6 explanatory comments
  and inline notes.

**Why:** After Task #1.6 the Vivid *visual style* is gone — `--v-*` tokens are
deleted, all 2461 lines of Vivid baseline CSS rules stripped, and the compound
selectors left behind use the `v-*` class only as a scoped selector hook. The
`v-*` names are effectively arbitrary identifiers now, no different from
`#bossImgWrap` or `.modal-box`. Rename is cosmetic, not functional — but it
couples three layers (DOM + CSS + JS) that must move in lockstep.

Attempting the rename inside Task #1.6 would have touched ~400 sites during a
task already carrying 2461 lines of CSS removal and a live risk of visual
regressions on previously-approved screens (Hub / Battle / Tower). The size
payoff is also small — `v-*` vs `a-*` is a 1-char-per-site delta.

**Resolution plan — Phase 6 Launch Prep, dedicated sub-task:**

1. **Rename pass** — atomic find/replace in lockstep across all three layers:
   - DOM: `class="... v-foo ..."` → `class="... a-foo ..."` (67 class names)
   - DOM ids: `id="vFoo"` → `id="aFoo"` (36 ids)
   - CSS: `.v-foo` → `.a-foo` (309 occurrences, all inside compound selectors —
     need regex that doesn't touch legitimate `.v-foo` standalone selectors if
     any survived the Task #1.6 baseline strip)
   - JS: `getElementById('vFoo')` → `getElementById('aFoo')` (36 sites)
   - JS: `querySelector('.v-foo')` → `querySelector('.a-foo')` (7 sites)
2. **Cleanup** — remove remaining `VIVID` / `Vivid` comment strings +
   `VIVID RENDERERS` label (20 textual hits).
3. **Visual smoke test** across every screen, every modal — same checklist as
   Task #1.6 visual regression check.

**Task #1.9 (Phase 1 regression) verification:**
Playtest confirms no screen still renders in the Vivid palette (bright blue sky,
cream cards, yellow chunky CTAs, Baloo 2 / Fredoka fonts). Pre-1.6 Roman playtest
flagged Tutorial Complete / Defeat modal / Heroes screen as still-Vivid — post-1.6
they should render Arena Premium via the remaining compound selectors now that
the baseline Vivid CSS is gone.

## DEBT-008 · Phase 1 Task 1.4.2 · FTUE reveal does not unlock
**Introduced:** 2026-04-24 · observed during Task #1.4.2 smoke test
**Resolved:** 2026-04-24 · Task #1.5 (Part B)
**What:** After FTUE reveal cinematic, `pirate_hunter` (Blacktooth) was shown as "JOINS THE WARBAND" but `hero.unlocked` remained `false`. Player saw the new hero in the reveal dialog but could not add them to squad.

**Root cause:** `revealHero()` managed only the cosmetic `revealedHeroes` Set + its storage key. It never called `unlockHero()` nor flipped `hero.unlocked`, leaving reveal and unlock as separate paths.

**Resolution:** `revealHero()` now flips `hero.unlocked = true` and appends the id to `HEROES_UNLOCKED_STORAGE_KEY` array (idempotent append, guarded to skip Clockwork placeholders via `!hero.locked`). Clockwork heroes stay locked until Phase 2 spawns real implementations.
