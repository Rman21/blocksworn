# Technical Debt Ledger

Файл отслеживает временные компромиссы по всему проекту.
Каждая запись должна иметь explicit resolution target.

**Numbering schemes** (исторически разъехались — неймспейсы независимые):
- `DEBT-NNN` — Phase 1 reduction + последующие phases (исходный счётчик)
- `Block 6.5 DEBT-N` — Chapter 3 follow-ups (отдельная секция ниже)
- `TOWER-DEBT-N` — Tower system follow-ups (отдельная секция ниже)

**Last sync with source:** 2026-04-28 — verified via grep of all `DEBT-` markers in `blocksworn_index_fixed.html`.

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

## DEBT-012 · Phase 1 Task 1.9 · Orphan Ch2/Ch3 DIALOG_LINES entries
**Introduced:** 2026-04-25 · observed during Task #1.9 regression audit
**Status update (2026-04-28):** Описание ниже ссылается на **удалённый pre-Phase-5
roster** (TIDAL LEVIATHAN/COLOSSUS/SERAPH/WRAITH/EMBERBEARD для Ch2 и
PYRESPIRE/MONARCH/STONEMAGUS/SUNFORGED/VOIDFANG для Ch3). Реальный шиппнутый
roster: Ch2 — VEROTHIRA / GEARHEART / URSARO / TIDESPIRE / HELIOTRON; Ch3 —
TWILIGHT VESSEL / STORMSHEPHERD / VOIDPRIESTESS / ROOT-OF-NOTHING / ARCHIVAL
ETERNAL. Phase 5 (5b) шиппнулся со своим roster и не делал generic «DIALOG_LINES
cleanup» pass — orphan строки старого roster всё ещё лежат мёртвым кодом
(grep по старым ids = **63 hits на 2026-04-28**). **Low-priority dead text data**,
no trigger path активирует их в gameplay.

**What (исторический контекст):** 44 dialog data entries в `DIALOG_LINES` для
бывших Ch2 (TIDAL LEVIATHAN / VERDANT COLOSSUS / SERAPH JUDICATOR / WRAITH OF
CHAINS / EMBERBEARD) и бывших Ch3 (PYRESPIRE / GLACIAL MONARCH / STONEMAGUS /
SUNFORGED / VOIDFANG) bosses. Reference `portraitKey: 'Boss_6'..'Boss_15'` —
assets removed в Task #1.5.

**Why deferred:** Functionally inert. DIALOG_LINES lookups идут по dialog id,
ни один trigger path не активирует эти ids. ASSETS lookup для Boss_6..15
возвращает undefined → dialog player handles missing portraits gracefully.
~50 lines / ~5KB мёртвого текста.

**Resolution plan:** generic cleanup pass — точечно удалить 44 orphan entries.
Cleanup grep pattern:
```bash
grep -cE "leviathan_|colossus_|seraph_|wraith_|emberbeard_|pyrespire_|monarch_|stonemagus_|sunforged_|voidfang_" blocksworn_index_fixed.html
# Currently: 63. Expected post-cleanup: 0.
```

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
**Resolved:** 2026-04-28 · Player Education Stage 13 work (Option A taken)

**What was the debt:** Season system (`goToSeason()`, `screenSeason` HTML, related
CSS and localStorage keys) сохранён в коде но недоступен через UI:
- Drawer SEASON button удалён в Task #1.7
- Underlying system inert (no trigger path)

**Why deferred:** Scenario A focus (MVP без monetization) не требовал Season.
Удаление entire system = double work в Phase 7.

**Resolution:** Phase C+ shipped полную subscription/premium economy
(`seasonPassSub`, $4.99/mo, 50 tiers с free+premium tracks, 2 warning notifications,
console dev tools). System is fully alive. Player Education Stage 13
(BLOCKSWORN_PLAYER_EDUCATION.md §16) restored the permanent drawer entry as
`#seasonBtn` (✦ BATTLE PASS, alongside DAILY) with FTUE-gated visibility via
`updateSeasonButtonVisibility()` wired into the menu-refresh path. Stage 13
intro modal `maybeShowBattlePassEducation()` fires once when player reaches
Ch1 cleared OR 3+ T2 ascensions, with CTA → goToSeason().

The `// DEBT-010` comment at `goToSeason()` declaration is stale — left in place
to avoid touching merged code; future cleanup pass can remove.

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

## DEBT-013 · Phase 1 sign-off · Blacktooth (pirate_hunter) portrait mismatch
**Introduced:** 2026-04-25 · noted by Roman during Phase 1 sign-off playtest
**Resolved:** 2026-04-25 · Task #4.0.1 (same day, asset provided in chat)
**What:** `pirate_hunter` (BLACKTOOTH, race='pirate', stihiya='ember') currently
renders with an elf-styled portrait — hooded figure, purple eyes, daggers. Does
not match the pirate faction visual language (tricorn / bandana / firearm /
ember accents) established by the other 4 pirate heroes (Thorgar, Emberhand,
Ironbelly, Crimson).

**Root cause (likely):** Two ASSETS keys named `hero_pirate_gun` exist in
`blocksworn_index_fixed.html`:
- Line 8118 — original V18.10 entry inside the main ASSETS object literal
- Line 8171 — override inside the "ARENA PREMIUM · ASSET OVERRIDES" block
  (`Object.assign(ASSETS, {...})`, added 2026-04-23)

Per JS object-literal + Object.assign semantics, the override at L8171 wins.
Hypothesis: the Arena Premium asset bundle on 2026-04-23 mis-labeled an
unrelated portrait (likely the legacy `hero_dark_elf_hunter` art) with the
`hero_pirate_gun` key, so the override stomps the original pirate art with
elf art. Not visually verified — Phase 4.x will confirm by inspecting both
base64 payloads.

**Why no swap performed in Task #4.0.1:**
All 5 pirate ASSETS keys are mapped 1:1 to the 5 pirate heroes:

| Hero id          | Display    | img key              |
|------------------|------------|----------------------|
| pirate_warrior   | THORGAR    | hero_pirate_sword    |
| pirate_hunter    | BLACKTOOTH | hero_pirate_gun ← bug|
| pirate_mage      | EMBERHAND  | hero_pirate_bomb     |
| pirate_tank      | IRONBELLY  | hero_pirate_tank     |
| pirate_captain   | CRIMSON    | hero_pirate_captain  |

No spare proper-pirate portrait exists to swap into the hunter slot without
making two heroes share a face. Reverting just the L8171 override might fix
it (if L8118 is the proper original), but cannot be visually verified without
rendering both base64 payloads — risk of substituting one wrong portrait with
another. Deferred to a proper asset task with visual diff.

**Severity:** Cosmetic only. Gameplay, FTUE flow, hero stats, fire/ult code
all correct. `pirate_hunter` race/stihiya tags drive ember-faction synergies
correctly regardless of portrait pixels.

**Resolution:** Roman provided the proper pirate-hunter portrait in chat
(2026-04-25, ~301 KB JPEG, 1086×1448 px — bandana under tricorn, dual
flintlocks one firing flame, ember/lava skin, glowing orange eyes, red sash,
skull belt buckle). Task #4.0.1 embedded the new base64 at L8119 (the
original `hero_pirate_gun:` slot inside main ASSETS) and deleted the L8171
override line entirely. The "ARENA PREMIUM · ASSET OVERRIDES" Object.assign
block now contains only Boss_1..Boss_5 entries.

Net file delta: +269,756 bytes (4.04 MB → 4.12 MB), −1 line (21,746 → 21,745).
Embedded sha256 = `8f0aa1c3d77c472ddd862f488fb9b8cc4cbd0af6f168a1a28244be4462004878`.

**Verification post-fix:**
```bash
# Should be 1, not 2 (after dedup):
grep -cE "^\s*hero_pirate_gun:" blocksworn_index_fixed.html
# → 1 ✓
```

## DEBT-014 · Phase 4 Task 4.1 · Element-pool charge writes are dead state
**Introduced:** 2026-04-25 · Task #4.1 (per-hero charge meters)
**What:** Task 4.1 replaced the ult-fire gate from the legacy element-pool model
(`ultCharges = {ember:0, tide:0, grove:0, solar:0, umbra:0}`) to the new per-hero
model (`heroCharges = {heroId: charge}`). The canonical line-clear fill site (in
the placement handler around L19200) was rewired to call
`distributeChargeOnElementClear`, but ~12 secondary write sites still bump
the legacy element pool:

| Line  | Source                                                         |
|-------|----------------------------------------------------------------|
| 15457 | LION ROAR — first detonate grants +5 solar to element pool     |
| 15463 | HUMAN HALO CHAIN — every detonate grants +1 solar pool         |
| 15578 | (radiant chain proc) — element pool                            |
| 15610 | UMBRA chain accumulator — every Nth umbra clear                |
| 16874 | Ember ULT umbra-charge bonus (when ult resolves)               |
| 16925 | (weapon-stihiya proc) — +3 to weapon's stihiya pool            |
| 17316 | (per-stihiya proc inside ultRoleDispatch)                      |
| 17638 | (per-hero-stihiya bump)                                        |
| 17690 | (per-hero-stihiya bump, second site)                           |
| 18031 | (umbra-stihiya bump)                                           |
| 18334 | (target-stihiya bump)                                          |
| 19084 | STRIKE FORCE RELENTLESS — combo ≥ 2 grants +1 random striker   |
| 19378-80 | ASTARION STARPATH — +1 to all non-Astarion teammates' pool  |
| 19396 | KEYCRYPT AMPLIFIER — +1 umbra pool per amp placement           |

These sites still execute and write to `ultCharges[s]`, but `ultCharges` no
longer drives ult-fire (the gate at `onHeroCardClick` now reads `heroCharges`).
Effect: artifacts/passives that grant "+N ult charge to element X" silently
no-op for ult-readiness purposes. Their other side-effects (UI flashes, etc.)
still fire correctly.

**Why deferred:** Most affected effects are mid-to-late-game artifacts /
passives (T2/T3 specials, Astarion Starpath, Keycrypt Amplifier, Lion Roar).
Phase 1 reduced roster to 15 active heroes; the actively-relevant procs in
the 15-hero MVP are minimal. Rewiring all 12+ sites would inflate Task 4.1
scope and conflict with the spec's "не trogai existing ult effects" rule.

**Resolution plan:** Task #4.2 (3-tier ULT cost system) will introduce
tier-aware cost gating. At that time, the secondary fill sites should be
rewired through a new helper `addChargeToHeroesOfElement(element, amount)`
that walks `HERO_DECK` and bumps each matching hero's `heroCharges[id]` by
`amount` (respecting `HERO_CHARGE_MAX` ceiling). Task 4.3 (chain combo)
may further consolidate fill paths.

**Action now:** none — all writes still execute without error. Preview test
verifies primary line-clear fill works; legacy procs may not contribute to
ult-readiness until 4.2 rewire.

**Verification (2026-04-28):**
```bash
grep -cE "ultCharges\[" blocksworn_index_fixed.html
# → 15 hits (matches "≈12-15" expectation — STILL OPEN)
grep -cE "heroCharges\[" blocksworn_index_fixed.html
# → 12 hits (>0 — 4.1 primary path live)
```

> **ID collision note:** В исходниках 8 строк помечены `// PHASE 4 BLOCK 2 —
> DEBT-014 FSM REWORK` (FTUE_TRANSITIONS table, `ftueIs()` helper). Это **другой
> debt** — refactor FTUE state machine, который был зарешён в Phase 4 Block 2.
> Кто-то переиспользовал id. Резолюция этого второго debt-а вынесена ниже как
> отдельная запись **DEBT-015**. Код-комменты не трогаем чтобы не разъезжать
> с merge-history.

## DEBT-015 · Phase 4 Block 2 · FTUE state-machine refactor
**Introduced:** до 2026-04-26 (legacy: ad-hoc `ftueBeat === 'X'` checks по всему файлу)
**Resolved:** 2026-04-26 · Phase 4 Block 2 (commit history)

**What was the debt:** FTUE state machine управлялся через разрозненные
`ftueBeat === '...'` строковые сравнения, без явной таблицы переходов.
Опечатки в beat names → silent fall-through. Невозможно было аудитить
"какие переходы legal".

**Resolution:**
- `FTUE_TRANSITIONS` table — explicit prev→next edges. `advanceFtue()` warns
  on invalid edges (still permitted for back-compat: `skipFtue`, `resetFtue`,
  idempotent `routeByFtue` re-entry).
- `ftueIs(beat)` helper — single-source predicate, accepts string или array.
  Defensively returns false для unknown beats (typo never silently passes).
- `FtueState` namespace — read-only debug view, queryable via `__ftueDebug()`
  для triage.

**Note:** В коде эта работа помечена `DEBT-014 FSM REWORK` (8 сайтов,
e.g. L16192, L16209, L16270). Id переиспользован по ошибке — настоящий
DEBT-014 (element-pool dead writes) описан выше и всё ещё открыт. Не
правлю комменты в коде чтобы не плодить merge-конфликты.

## DEBT-016 · V2.0 Stage 5 Block 5.6 · Per-hero free-Encore token + Tank-specific Encore window
**Introduced:** 2026-04-27 (Block B1 KEYCRYPT/THUNDERBEAT T2/T3 mechanics)
**What:**
- KEYCRYPT spec mentions "every squad hero gets one free Encore" mechanic. v1
  codebase has only board-state extension on MENDING template (umbra clears get
  +20% damage), не per-hero token tracker.
- THUNDERBEAT spec mentions Tank-specific "3-placement encore window" (umbra
  clear gets +50 free Rhythm bonus during window). Только squad-wide Encore
  через NIGHTLORD ULT (`encoreActive` flag) реализован.

**Why deferred:** Требует per-hero token tracker + `fireHero` double-fire path
с recursion guard. Out of scope для Block B1.

**Resolution plan:** dedicated MGD task — design per-hero encore token state +
non-recursive double-fire dispatch.

**Code refs:** L33746, L33761.

## DEBT-017 · V2.0 Stage 5 Block 5.6 · ULT placement-refund mechanic missing
**Introduced:** 2026-04-27 (Bulwark BULWARK/CHARGED AEGIS implementation)
**What:** Spec [Frost × Tank] cell ULT для BULWARK: «refunds 1 placement to
the player». В v1 codebase **нет placement-refund mechanism**. Реализация
fallback’ит на +3 shields (parity с IRONBELLY CHARGED AEGIS shape).

**Why deferred:** Требует новую механику в core placement loop — добавить
"refund" способность на placement counter. Не существует в v1, нет точки
расширения.

**Resolution plan:** core-loop task — добавить `refundPlacements(n)` API в
placement system, переписать BULWARK fire/ult на новый API.

**Code refs:** L33901, L33996.

## DEBT-019 · Phase 0 Block B3 · Squad slot card-flip animation deferred
**Introduced:** 2026-04-25 (Block B3 SQUAD_MAX storage + boss-defeat unlock)
**What:** Block B3 unlock celebration overlay использует existing `flashText`
toast + `chapterCompleteModal` pattern для hero unlock visualization. Полная
card-flip animation (per design intent) deferred to Block B4 polish.

**Severity:** Cosmetic only. Unlock логика работает, новый герой появляется
в слоте. Просто без юмового флипа — статичная toast-а.

**Resolution plan:** Block B4 polish — implement card-flip animation
(CSS 3D transform + sequenced fadeIn/Out).

**Code refs:** L14454.

---

## Block 6.5 (Chapter 3) follow-ups

> **Namespace note:** Эти записи в исходниках помечены `Block 6.5 DEBT-N` где N
> = 3..10. Это **отдельный счётчик** от основного DEBT-NNN — не путать с
> DEBT-003..010 выше. Все open. Введены при шиппинге Chapter 3 (VEIL OF
> FORGOTTEN GODS) 27 апр.

### ~~Block 6.5 DEBT-3~~ · Stormshepherd storm cells — RESOLVED 2026-04-29
**What:** Storm cells персистятся как `{r, c, turnsLeft = 2}` — tracking
existed, но визуальный индикатор отсутствовал.
**Resolution:** `renderGrid()` теперь читает `_ch3State.stormCells` при ch3 +
storm-боссе и крепит `.storm-turns` chip в правый верхний угол каждой void-
клетки с числом оставшихся ходов. `turnsLeft <= 1` → `.urgent` модификатор
(красный pulsing chip — игрок видит "осталось 1 ход до интенсификации").

### Block 6.5 DEBT-4 · Root-of-Nothing wither neighbor-clear escape
**What:** Wither effect от Root-of-Nothing должен иметь "neighbor-clear escape"
условие (если соседняя клетка cleared в тот же turn — wither снимается).
Реализация частичная.
**Code ref:** L28907.

### Block 6.5 DEBT-5 · Tank/Warrior role-specific seal mechanics
**What:** Seal mechanics `tank_halved` (Tank dmg ×0.5) + `warrior_blocked`
(Warrior dmg ×0.5) — реализованы как dual-element pact synergies, но без
полной интеграции в seal pool (см. DEBT-6).
**Code ref:** L30113.

### Block 6.5 DEBT-6 · Archival Eternal seal pool
**What:** Spec §2.6 описывает 7 seal mechanics для Archival Eternal. В коде
реализованы 4: `charge_frozen`, `element_drops_random`, `placement_costs_hp`,
`captain_inverted`. Остальные 3 — pending.
**Code refs:** L25103, L25925, L28362, L28811, L30013.

### Block 6.5 DEBT-7 · "Forgotten Names" mythic portrait frame
**What:** Cosmetic mythic portrait frame для Tier 3 ascended heroes. Toggle-only
реализация (включается/выключается per hero), но frame asset (border SVG/PNG)
— placeholder.
**Code refs:** L6768, L15173, L15249, L19539.

### Block 6.5 DEBT-9 · Cosmic Memorial для defeated Ch3 bosses
**What:** Profile section отображает "ethereal mini" представления побеждённых
Ch3 боссов как memorial. Layout + render pipeline на месте, но visual polish
(particle effect, glow) — placeholder.
**Code refs:** L6715, L12310, L37557.

### Block 6.5 DEBT-10 · Dual-element pact synergies (Tower)
**What:** Tower pact selection активирует synergy bonuses для dual-element
комбо (per spec §2.7). Runtime calc реализован, но **balance-numbers** не
финализированы (текущие значения placeholder).
**Code refs:** L20023, L20087, L20102, L30119.

---

## Tower system follow-ups

### ~~TOWER-DEBT-4~~ · Seasonal hero card drop · leaderboard-tier scaling — RESOLVED 2026-04-29
**Introduced:** 2026-04-27 (Block H.2 — seasonal Tower hero card drop, spec §12)
**Resolution:** Backend leaderboard shipped 2026-04-28 (Phase G-Social). Added
`BackendProvider.getMyLeaderboardRank(seasonId)` (mock + Firebase). On seasonal
clear, `_awardSeasonalRankBonus()` submits the player's best, fetches rank,
and drops bonus cards by tier:
  - Top 1     → +20 (25 total) "TOWER GOD"
  - Top 10    → +15 (20 total) "TITAN"
  - Top 100   → +10 (15 total) "ELITE"
  - Top 1000  →  +5 (10 total) "VETERAN"
  - Outside   →   0 (5 baseline — participation only)
Best-effort: any backend failure leaves the 5-card baseline intact.
