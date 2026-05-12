// 2026-05-11 — TASK-011 (T1.10.2): progression system relocated from legacy.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - First-clears + boss-stars storage          lines 19485-19585
//     (FIRST_CLEAR_KEY, BOSS_STARS_KEY, firstClearMap, bossStarsMap, _bossKey,
//      load/save Maps, isBossFirstCleared, markBossFirstCleared, getBossStars,
//      recordBossStars, computeBattleStars, load-at-parse-time, window exposure)
//   - Hero unlock storage + state                lines 21220, 21274-21388
//     (HEROES_UNLOCKED_STORAGE_KEY, save/loadUnlockedHeroes, isHeroUnlocked,
//      unlockHero, lockHero, reconcileSquadUnlocks)
//   - Chapter binding (setChapter + gate helper) lines 20445-20500
//   - Ascension constants + functions            lines 20507-20769
//     (TIER2/TIER3/MYTHIC_* cost+bonus consts; isHeroAscended,
//      getAscensionMissing, canAscendHero, ascendHero, getHeroAscensionMult,
//      isHeroAscendedT3, isHeroMythic, getEffectiveLevelMax, isAtTierCap,
//      getNextTierMax, getMythicHeroId, getT3Missing, canAscendT3, ascendHeroT3,
//      getMythicMissing, canAscendMythic, ascendHeroMythic)
//   - Floor / dungeon progress                   lines 25224-25284
//     (dungeonProgress, DUNGEON_PROGRESS_KEY, save/load helpers,
//      getFloorCleared, isFloorUnlocked, recordFloorCleared)
//   - Hero level state + functions               lines 25680-25966
//     (HERO_LEVEL_MIN/MAX, LEVEL_COST_* + LEVEL_DMG_PER + LEVEL_ULT_PER aliases,
//      heroLevels, HERO_LEVELS_KEY, save/loadHeroLevelsFromStorage,
//      _migrateHeroLevelsToTierCaps, getHeroLevel, getLevelUpCost,
//      getLevelBonuses, levelUpHero, setHeroLevel, bumpLevel,
//      applyLevelBonusToHeroes, load-at-parse-time)
//   - Chapter completion flags + helpers         lines 31510-31545
//     (hasCompletedChapter1, hasCompletedChapter, markChapterComplete)
//   - Save/load + chapter unlock flags + state   lines 38260-38525
//     (chapterProgress, bossesDefeated, currentChapter, chapter2Unlocked,
//      chapter3Unlocked, chapter4Unlocked, selectedBossIdx, essences,
//      heroUpgrades, TIER_COSTS_LEGACY, BOSS_REWARD, STARTER_GRANT, saveProgress,
//      loadProgress, _migrateChapter4UnlockForExistingFinishers)
//   - Tier upgrade (essence-tier path)           lines 39988-40002
//     (TIER_COSTS_V18 + upgradeHero — TIER_COSTS_V18 superseded by canonical
//      TIER_COSTS import from src/data/balance.js per T1.07)
//
// SACRED PER CLAUDE.md §2.1 + §2.5:
//   - TIER_COSTS = {1:1, 2:2, 3:3, 4:5} — imported from src/data/balance.js
//     (T1.07 consolidated the legacy V18 table into the canonical export).
//   - One-Mythic-per-save constraint (CLAUDE.md §9 glossary "Mythic"):
//     getMythicMissing enforces single-slot via `mythicHero` field on
//     towerState; refuses ascension when another hero already holds the slot.
//     Preserved byte-perfect from legacy line 20719-20722.
//   - All TIER2_/TIER3_/MYTHIC_ cost + damage-bonus constants preserved as-is
//     (some derived from BALANCE.ascend.* in src/data/balance.js).
//
// T1.10.2 is pure relocation — no transition edges, no cost arithmetic, no
// commitment semantics modified.
//
// Owns: progression state cursors (current chapter, bosses-defeated counters,
// per-chapter completion flags), hero unlock list, hero level table, dungeon
// (per-boss floor-cleared) progress, first-clear timestamps + boss star
// records, hero ascension predicates + flows (T2 / T3 / Mythic), tier-upgrade
// essence-spend path, save/load aggregators.
//
// Does NOT own:
//   - HERO_ROSTER / STARTER_HEROES / BOSS_UNLOCKS / SQUAD_MAX / activeSquad —
//     T1.10.4 (heroes). Preserved here as undeclared globals.
//   - towerState shape + persistence (saveTowerState / loadTowerState +
//     tier2Stones / tier3Stones / legendaryStones / mythicHero / ascendedHeroes
//     / tier3Ascended fields) — Tower module (T1.10.6 or later) territory.
//   - heroFragments + gold + essences (and their save helpers) — partial state
//     here (essences declared as part of legacy progression block) is consumed
//     by upgradeHero and the ascension flows. Full ownership of currency state
//     lives in legacy until follow-up sub-tasks pick it up. Cross-module refs
//     declared as globals.
//   - DOM refs (renderResourceBar, flashText, vibrate, renderSelect,
//     closeFloorSelector) — T1.11 (ui) territory.
//   - logEvent / EVT / addSeasonXP / trackMissionEvent / showToast — analytics
//     + retention layer; T1.08 (analytics) wired services-level only, the
//     legacy call surfaces stay until each system is extracted.
//   - getHeroFragments, saveGoldToStorage, saveHeroFragmentsToStorage,
//     saveTowerState — currency / tower modules.
//
// Storage migration: legacy stores progression keys as a mix of
//   (a) JSON.stringify(obj) — blocksworn_progress, blocksworn_first_clears,
//       blocksworn_boss_stars, blocksworn_dungeon_progress,
//       blocksworn_hero_levels, blocksworn_heroes_unlocked
//   (b) Bare strings — blocksworn_chapter_N_complete (stores the literal
//       string 'true' via localStorage.setItem('blocksworn_chapter_1_complete', 'true')
//       and reads with === 'true' equality).
// Per T1.08 we route through src/services/storage.js for JSON-shape keys; the
// bare-string chapter-complete flag is flagged below for the T1.10.9 migration
// shim. See "Замечено рядом" in the task report.
//
// IMPORTANT COMPATIBILITY CAVEAT — flagged for T1.10.9 wire-up review:
// Existing player saves store `blocksworn_chapter_<N>_complete` as the bare
// string 'true' (NOT JSON-encoded). storage.getItem JSON.parses, which on the
// 4-byte string `true` actually succeeds (JSON.parse('true') === true), so
// reads will compare `true === 'true'` and return false — a silent regression
// that resets chapter-complete state for every legacy save when this module
// activates. The same family of bare-string keys applies to several non-prog
// flags (`seenIntroVideo`, `onboardingSeen`, `blocksworn_tier_education_revealed`,
// `blocksworn_chapter_1_complete`) — already flagged by T1.10.1.
//
// T1.10.2 does NOT activate this module (nothing imports it yet — tree-shakes
// out of the bundle). T1.10.9 wire-up MUST add a one-shot migration shim that,
// for each known legacy bare-string key, falls back to a raw
// localStorage.getItem on first read returning unexpected shape, and re-saves
// via storage.setItem. Flagged in "Замечено рядом".
//
// Undeclared cross-module identifiers preserved with /* global */ + TODO
// markers (per the T1.09 / T1.10.1 pattern). Each will be wired in subsequent
// sub-tasks.
//
// 2026-05-11 — Roman: pure-relocation discipline. No "improvements". Nothing
// new. Comments above this line replicate legacy intent.

// T1.13.1: /* global */ → ES imports for resolved src/ exports.
// T1.13.4: SQUAD_MAX flipped from /* global */ to import (src/data/balance.js).
/* global heroFragments, getHeroFragments, saveHeroFragmentsToStorage,
   saveGoldToStorage,
   towerState, saveTowerState,
   flashText, vibrate, closeFloorSelector,
   currentScreen,
   addSeasonXP, trackMissionEvent,
   isContentUnlocked,
   _maybeShowEndgameKitEligibilityCelebration */
// LEGACY-ONLY: above tokens have no src/ export — shims retired in T1.14+ cleanup.

import { BALANCE, TIER_COSTS, getSquadMax } from '../data/balance.js';
import { CHAPTERS } from '../data/chapters.js';
import { HERO_ROSTER, STARTER_HEROES } from './heroes.js';
import { applyBossEmblems, getCurrentChapter, setCurrentChapterValue } from './bosses.js';
import { renderResourceBar } from '../ui/menu.js';
import { renderSelect } from '../ui/select.js';
import { logEvent, EVT } from '../services/analytics.js';
import * as storage from '../services/storage.js';
import { log } from '../services/logger.js';

// ─── T1.13.2: Canonical writable-globals bindings ─────────────────────────
// Per the T1.10.6 stagger-loop.js / T1.10.7 bosses.js bridge pattern: declare
// each legacy writable global as a module-private `let` matching its legacy
// initial value, then expose via Object.defineProperty(window, ...) with
// get + set accessors so:
//   • In-module bare reads/writes (e.g. `essences = ...`) resolve to the
//     module-local binding (ES strict-mode safe).
//   • Cross-module legacy-style `/* global X */` consumers in other src/
//     modules still resolve to the same value through the window bridge.
//
// Note: `currentChapter` + `BOSSES` are canonically owned by src/core/bosses.js
// (T1.10.7) — progression.js reads them via getCurrentChapter()/setCurrentChapterValue()
// and the BOSSES dynamic getter that bosses.js exposes on window. The local
// duplication that previously existed in legacy is collapsed here.
//
// Initial values copied byte-perfect from legacy declarations:
//   legacy 23932 `let gold = 0;`
//   legacy 38265 `let activeSquad = HERO_ROSTER.filter(...).map(h => h.id).slice(0, SQUAD_MAX);`
//   legacy 38266 `let favorites = new Set();`
//   legacy 38272 `let chapterProgress = { 1: 0, 2: 0, 3: 0 };`
//   legacy 38273 `let bossesDefeated = 0;`
//   legacy 38276 `let essences = { ember: 0, tide: 0, grove: 0, solar: 0, umbra: 0 };`
//   legacy 38277 `let heroUpgrades = {};`
//   legacy 38309 `let activeModifiers = new Set();`
//   legacy 38314 `let artifactsOwned = {};`       (removed in T1.14)
//   legacy 38315 `let equippedArtifacts = [...]`  (removed in T1.14)
//   legacy 38316 `let artDropPityCounter = 0;`    (removed in T1.14)
//   legacy 38345 `let chapter2Unlocked = false;`
//   legacy 38346 `let chapter3Unlocked = false;`
//   legacy 38350 `let chapter4Unlocked = false;`
//   legacy 38351 `let selectedBossIdx = null;`
//
// T1.13.4: SQUAD_MAX now lives in src/data/balance.js (mutable per Boss-defeat
// progression: 3 → 4 after Boss 2 → 5 after Boss 4). The T1.13.2-era
// `_SQUAD_MAX_FALLBACK = 5` defensive shim retires here; we read the live
// value via getSquadMax() at module init. reconcileSquadUnlocks() later
// slices to the actual cap on each squad mutation.
let gold = 0;
let essences = { ember: 0, tide: 0, grove: 0, solar: 0, umbra: 0 };
let activeSquad = HERO_ROSTER
  .filter(h => STARTER_HEROES.has(h.id))
  .map(h => h.id)
  .slice(0, getSquadMax());
let favorites = new Set();
let activeModifiers = new Set();
let chapterProgress = { 1: 0, 2: 0, 3: 0 };
let bossesDefeated = 0;
let heroUpgrades = {};
// T1.14: removed `artifactsOwned`, `equippedArtifacts`, `artDropPityCounter`.
// Artifact subsystem deleted per Execution Plan §13. Migration shim
// `migrateRemoveArtifacts` in src/services/migrate.js strips these fields
// from the aggregated `blocksworn_progress` save on next boot.
let chapter2Unlocked = false;
let chapter3Unlocked = false;
let chapter4Unlocked = false;
let selectedBossIdx = null;

// Window bridge — Object.defineProperty with get+set per T1.10.6/T1.10.7
// pattern. Cross-module legacy-style bare reads/writes go through these
// accessors so the module-private binding stays the single source of truth.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'gold',                  { configurable: true, get: () => gold,                  set: (v) => { gold = v; } });
  Object.defineProperty(window, 'essences',              { configurable: true, get: () => essences,              set: (v) => { essences = v; } });
  Object.defineProperty(window, 'activeSquad',           { configurable: true, get: () => activeSquad,           set: (v) => { activeSquad = v; } });
  Object.defineProperty(window, 'favorites',             { configurable: true, get: () => favorites,             set: (v) => { favorites = v; } });
  Object.defineProperty(window, 'activeModifiers',       { configurable: true, get: () => activeModifiers,       set: (v) => { activeModifiers = v; } });
  Object.defineProperty(window, 'chapterProgress',       { configurable: true, get: () => chapterProgress,       set: (v) => { chapterProgress = v; } });
  Object.defineProperty(window, 'bossesDefeated',        { configurable: true, get: () => bossesDefeated,        set: (v) => { bossesDefeated = v; } });
  Object.defineProperty(window, 'heroUpgrades',          { configurable: true, get: () => heroUpgrades,          set: (v) => { heroUpgrades = v; } });
  // T1.14: window bridges for artifactsOwned / equippedArtifacts /
  // artDropPityCounter removed — legacy reads of these now resolve to
  // `undefined` (no bridge installed). All callsites have been deleted from
  // both src/ and legacy.
  Object.defineProperty(window, 'chapter2Unlocked',      { configurable: true, get: () => chapter2Unlocked,      set: (v) => { chapter2Unlocked = v; } });
  Object.defineProperty(window, 'chapter3Unlocked',      { configurable: true, get: () => chapter3Unlocked,      set: (v) => { chapter3Unlocked = v; } });
  Object.defineProperty(window, 'chapter4Unlocked',      { configurable: true, get: () => chapter4Unlocked,      set: (v) => { chapter4Unlocked = v; } });
  Object.defineProperty(window, 'selectedBossIdx',       { configurable: true, get: () => selectedBossIdx,       set: (v) => { selectedBossIdx = v; } });
}

// ─── First-clear + boss-stars state (legacy 19485-19488) ──────────────────
export const FIRST_CLEAR_KEY = 'blocksworn_first_clears';
export const BOSS_STARS_KEY  = 'blocksworn_boss_stars';
let firstClearMap = {};  // { '<ch>.<bossIdx>': unix ms timestamp }
let bossStarsMap  = {};  // { '<ch>.<bossIdx>': 1 | 2 | 3 }

function _bossKey(chapter, bossIdx) {
  return `${chapter | 0}.${bossIdx | 0}`;
}

export function loadFirstClearsFromStorage() {
  try {
    const parsed = storage.getItem(FIRST_CLEAR_KEY, null);
    if (parsed === null) { firstClearMap = {}; return; }
    firstClearMap = (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (e) {
    log.warn('loadFirstClearsFromStorage failed:', e);
    firstClearMap = {};
  }
}

export function saveFirstClearsToStorage() {
  try { storage.setItem(FIRST_CLEAR_KEY, firstClearMap); }
  catch (e) { log.warn('saveFirstClearsToStorage failed:', e); }
}

export function isBossFirstCleared(chapter, bossIdx) {
  const k = _bossKey(chapter, bossIdx);
  return !!firstClearMap[k];
}

export function markBossFirstCleared(chapter, bossIdx) {
  const k = _bossKey(chapter, bossIdx);
  if (firstClearMap[k]) return false;  // already marked, no-op
  firstClearMap[k] = Date.now();
  saveFirstClearsToStorage();
  return true;
}

export function loadBossStarsFromStorage() {
  try {
    const parsed = storage.getItem(BOSS_STARS_KEY, null);
    if (parsed === null) { bossStarsMap = {}; return; }
    if (!parsed || typeof parsed !== 'object') { bossStarsMap = {}; return; }
    // Sanitize: only keep 1-3 integer values
    const clean = {};
    for (const k in parsed) {
      const v = Math.floor(Number(parsed[k]));
      if (v >= 1 && v <= 3) clean[k] = v;
    }
    bossStarsMap = clean;
  } catch (e) {
    log.warn('loadBossStarsFromStorage failed:', e);
    bossStarsMap = {};
  }
}

export function saveBossStarsToStorage() {
  try { storage.setItem(BOSS_STARS_KEY, bossStarsMap); }
  catch (e) { log.warn('saveBossStarsToStorage failed:', e); }
}

export function getBossStars(chapter, bossIdx) {
  return bossStarsMap[_bossKey(chapter, bossIdx)] || 0;
}

// Returns true if record updated (new best). Replay matching/below previous best is no-op.
export function recordBossStars(chapter, bossIdx, stars) {
  const s = Math.max(0, Math.min(3, Math.floor(Number(stars) || 0)));
  if (s <= 0) return false;
  const k = _bossKey(chapter, bossIdx);
  const prev = bossStarsMap[k] || 0;
  if (s <= prev) return false;
  bossStarsMap[k] = s;
  saveBossStarsToStorage();
  return true;
}

// Compute star count from damage taken in a single battle.
// damageTaken = battleDamageTaken accumulator (incremented per hit landed)
// maxHp       = MAX_HP (typically 3)
// Thresholds drive from BALANCE.rewards.stars.
export function computeBattleStars(damageTaken, maxHp) {
  const ratio = (Number(damageTaken) || 0) / Math.max(1, Number(maxHp) || 1);
  const t = BALANCE.rewards.stars;
  if (ratio < t.threeStar) return 3;
  if (ratio < t.twoStar)   return 2;
  return 1;
}

// ─── Chapter binding (legacy 20445-20500) ─────────────────────────────────
// BOSSES is a live reference to the current chapter's bosses. setChapter
// rebinds it when the player switches chapters. The default initial state
// (`BOSSES = CHAPTERS[0].bosses`) was a top-level let in legacy; here it lives
// inside module scope and is updated through setChapter only.
// TODO(T1.10.7): rebinding BOSSES + applyBossEmblems is a UI/bosses concern —
// review after bosses module lands.
export function setChapter(n) {
  // V3.0 Phase 2 Block 2.1 trap 3: if floor selector is open for a boss in the
  // old chapter, close it before switching — data underneath changes meaning.
  try { closeFloorSelector(); } catch (_e) { /* swallow */ }
  // 2026-04-27 HOTFIX — restore proper chapter binding. The previous clamp
  // (Task #1.5 "Chapters 2/3 removed") was Phase 1 tech debt that was never
  // reverted after Phase 5b shipped Chapter 2. Result: even after Crypt Lich
  // unlocked Chapter 2 + cinematic played, switchChapter(2) silently rebinds
  // back to Chapter 1. Now setChapter(n) honors n with bounds + unlock guards.
  const requestedIdx = Math.max(1, Math.min(CHAPTERS.length, Number(n) || 1)) - 1;
  // Bounds + unlock guards: never bind to a locked chapter even if caller asks.
  // 2026-05-01 — SPRINT 3A: Ch4 gate switched from CONTENT.2 day-window
  // (_isChapterContentUnlocked(4)) to chapter4Unlocked flag (set on ARCHIVAL
  // ETERNAL Boss 15 defeat). Mirrors chapter2/3 unlock pattern.
  // Ch5 keeps CONTENT.2 day-window gate (placeholder chapter, no boss-defeat
  // unlock yet — separate sprint will swap when Ch5 ships v1).
  let idx = 0;
  if (requestedIdx === 0) {
    idx = 0;
  } else if (requestedIdx === 1 && (typeof chapter2Unlocked === 'undefined' || chapter2Unlocked)) {
    idx = 1;
  } else if (requestedIdx === 2 && (typeof chapter3Unlocked === 'undefined' || chapter3Unlocked)) {
    idx = 2;
  } else if (requestedIdx === 3 && (typeof chapter4Unlocked !== 'undefined' && chapter4Unlocked)) {
    idx = 3;
  } else if (requestedIdx === 4 && _isChapterContentUnlocked(5)) {
    idx = 4;
  }
  // T1.13.2: currentChapter + BOSSES canonical owner is bosses.js (T1.10.7).
  // BOSSES rebinds dynamically via getBosses() reading CHAPTERS[currentChapter-1].bosses,
  // so the explicit `BOSSES = ...` legacy redundancy is dropped here.
  setCurrentChapterValue(idx + 1);
  applyBossEmblems();
}

// CONTENT.2 — Helper to gate Ch4/5 by content-drop unlock day. Reads from
// CONTENT.1 schedule engine. Returns true if both day-window AND prior-chapter
// progression gate are open. Idempotent — safe on every chapter switch.
export function _isChapterContentUnlocked(chapterId) {
  if (chapterId <= 3) return true;  // Ch1-3 use legacy flags above
  const dropId = 'chapter_' + chapterId;
  if (typeof isContentUnlocked === 'function' && !isContentUnlocked(dropId)) return false;
  // Ch4 requires Ch3 cleared (storyline gate); Ch5 requires Ch4.
  try {
    if (chapterId === 4) {
      return typeof hasCompletedChapter === 'function' && hasCompletedChapter(3);
    }
    if (chapterId === 5) {
      return typeof hasCompletedChapter === 'function' && hasCompletedChapter(4);
    }
  } catch (_e) { /* swallow */ }
  return false;
}

// ─── Hero ascension (legacy 20507-20769) ──────────────────────────────────
// 2026-04-27 — Block 6.4 — Tier 2 Hero Ascension (spec §2.7 + §7).
// 2026-04-27 — Block H.1 — full cost compliance per HERO_COMPENDIUM §8.1:
//   5 hero cards (heroFragments) of THAT hero
//   + 1 Tier 2 Ascension Stone
//   + 200 gold
//   + 5 element essence (matching hero stihiya)
// Ascended hero gains permanent +20% damage and visible T2 badge.
// One-shot per hero — cannot un-ascend (legendary commitment).
export const TIER2_ASCEND_COST     = 1;     // stones per ascension
export const TIER2_CARDS_COST      = 5;     // hero fragments per ascension (Block H.1)
export const TIER2_GOLD_COST       = BALANCE.ascend.tier2Gold;   // gold per ascension (Block H.1)
export const TIER2_ESSENCE_COST    = 5;     // element essence per ascension (Block H.1)
export const TIER2_DAMAGE_BONUS    = 1.20;  // +20% multiplier in damage stack

export function isHeroAscended(heroId) {
  return Array.isArray(towerState.ascendedHeroes)
      && towerState.ascendedHeroes.includes(heroId);
}
// Returns null if all reqs met; else returns array of failing reqs as { type, have, need }.
// Block H.1 — used by both canAscendHero (boolean gate) and showHeroDetail
// (shows red/green chips per requirement).
export function getAscensionMissing(heroId) {
  if (!heroId) return [{ type: 'unknown', have: 0, need: 1 }];
  if (isHeroAscended(heroId)) return [{ type: 'already_ascended', have: 1, need: 0 }];
  const hero = HERO_ROSTER.find(h => h.id === heroId);
  if (!hero) return [{ type: 'unknown', have: 0, need: 1 }];
  const missing = [];
  const stones  = (towerState && towerState.tier2Stones) || 0;
  const cards   = (typeof getHeroFragments === 'function') ? getHeroFragments(heroId) : 0;
  const goldAvail = (typeof gold !== 'undefined') ? (gold || 0) : 0;
  const essAvail  = (typeof essences !== 'undefined' && essences && hero.stihiya)
                  ? (essences[hero.stihiya] || 0) : 0;
  if (stones    < TIER2_ASCEND_COST)  missing.push({ type: 'stone',   have: stones,    need: TIER2_ASCEND_COST });
  if (cards     < TIER2_CARDS_COST)   missing.push({ type: 'cards',   have: cards,     need: TIER2_CARDS_COST });
  if (goldAvail < TIER2_GOLD_COST)    missing.push({ type: 'gold',    have: goldAvail, need: TIER2_GOLD_COST });
  if (essAvail  < TIER2_ESSENCE_COST) missing.push({ type: 'essence', have: essAvail,  need: TIER2_ESSENCE_COST, stihiya: hero.stihiya });
  return missing.length ? missing : null;
}
export function canAscendHero(heroId) {
  return getAscensionMissing(heroId) === null;
}
export function ascendHero(heroId) {
  if (!canAscendHero(heroId)) return false;
  const hero = HERO_ROSTER.find(h => h.id === heroId);
  if (!hero) return false;
  // Atomic deduction — all 4 reqs validated by canAscendHero, so safe to mutate.
  towerState.tier2Stones -= TIER2_ASCEND_COST;
  // Hero cards: heroFragments goes through subtractive path (no helper exists,
  // direct map mutation matches the addHeroFragments pattern).
  if (typeof heroFragments === 'object') {
    heroFragments[heroId] = Math.max(0, (heroFragments[heroId] || 0) - TIER2_CARDS_COST);
    try { if (typeof saveHeroFragmentsToStorage === 'function') saveHeroFragmentsToStorage(); } catch (_e) { /* swallow */ }
  }
  // Gold deduction
  if (typeof gold !== 'undefined') {
    gold = Math.max(0, gold - TIER2_GOLD_COST);
    try { if (typeof saveGoldToStorage === 'function') saveGoldToStorage(); } catch (_e) { /* swallow */ }
    try { if (typeof renderResourceBar === 'function') renderResourceBar(); } catch (_e) { /* swallow */ }
  }
  // Element essence
  if (typeof essences === 'object' && hero.stihiya) {
    essences[hero.stihiya] = Math.max(0, (essences[hero.stihiya] || 0) - TIER2_ESSENCE_COST);
    try { if (typeof saveProgress === 'function') saveProgress(); } catch (_e) { /* swallow */ }
  }
  // Final commit: append to ascended list and persist tower state.
  if (!Array.isArray(towerState.ascendedHeroes)) towerState.ascendedHeroes = [];
  towerState.ascendedHeroes.push(heroId);
  saveTowerState();
  // ECO.3 — Mission tracker: ascend_any_hero daily template.
  try { if (typeof trackMissionEvent === 'function') trackMissionEvent('hero_ascended', { heroId, tier: 2 }); } catch (_e) { /* swallow */ }
  try { if (typeof logEvent === 'function' && typeof EVT !== 'undefined') logEvent(EVT.hero_ascended, { heroId, tier: 2 }); } catch (_e) { /* swallow */ }
  return true;
}
// Combat hook helper — multiplicative T2 × T3 × Mythic damage stack.
// T2 alone = 1.20×, T3 stacked = 1.44×, Mythic stacked = 1.872× (+87%).
// Read from inside dealDamage damage stack.
export function getHeroAscensionMult(hero) {
  if (!hero || !hero.id) return 1.0;
  let mult = 1.0;
  if (isHeroAscended(hero.id))   mult *= TIER2_DAMAGE_BONUS;
  if (typeof isHeroAscendedT3 === 'function' && isHeroAscendedT3(hero.id))   mult *= TIER3_DAMAGE_BONUS;
  if (typeof isHeroMythic     === 'function' && isHeroMythic(hero.id))       mult *= MYTHIC_DAMAGE_BONUS;
  return mult;
}

// ==========================================================================
// 2026-04-29 — Tier 3 + Mythic ascension flows.
// Per BLOCKSWORN_HERO_COMPENDIUM.md §9-10 + BLOCKSWORN_META_PROGRESSION.md.
//   Tier 3   — additional 10 hero cards (15 total cumulative) + 1 T3 stone +
//              500g + 10 essence. Stacks multiplicatively with T2 → 1.44×.
//              Gated: hero must already be T2-ascended.
//   Mythic   — additional 25 hero cards (35 total) + 1 Legendary Stone +
//              1000g + 20 essence. Stacks on T2×T3 → 1.872× (+87%).
//              Gated: hero must already be T3-ascended. SINGLE hero per
//              save (irreversible). Player commits one favorite forever.
// Per-hero unique T3 passive / Mythic ULT replacement is content-author task
// (HERO_T3_RUNTIME / HERO_MYTHIC_ULTS) — deferred. This commit ships the
// flow + multiplier; per-hero abilities slot in via the same runtime hooks
// already used for T2 (HERO_T2_RUNTIME).
// ==========================================================================
export const TIER3_ASCEND_COST     = 1;      // T3 stones per ascension
export const TIER3_CARDS_COST      = 10;     // additional fragments (15 total w/ T2)
export const TIER3_GOLD_COST       = BALANCE.ascend.tier3Gold;
export const TIER3_ESSENCE_COST    = 10;
export const TIER3_DAMAGE_BONUS    = 1.20;   // multiplicative on top of T2

export const MYTHIC_ASCEND_COST    = BALANCE.ascend.mythic.ascend;      // legendary stones per ascension
export const MYTHIC_CARDS_COST     = BALANCE.ascend.mythic.cards;       // additional fragments (35 total w/ T2+T3)
export const MYTHIC_GOLD_COST      = BALANCE.ascend.mythic.gold;
export const MYTHIC_ESSENCE_COST   = BALANCE.ascend.mythic.essence;
export const MYTHIC_DAMAGE_BONUS   = BALANCE.ascend.mythic.damageBonus; // multiplicative on top of T2 × T3

export function isHeroAscendedT3(heroId) {
  return towerState && Array.isArray(towerState.tier3Ascended) && towerState.tier3Ascended.includes(heroId);
}
export function isHeroMythic(heroId) {
  return towerState && towerState.mythicHero === heroId;
}

// BAL.1 — Tier-gated hero level cap (PRELAUNCH_MASTER §3.1).
//   T1 (default)     → LV cap = 10
//   T2 (ascended)    → LV cap = 20
//   T3 (deep ascend) → LV cap = 30
//   Mythic           → LV cap = 40
// Used everywhere a per-hero cap matters. The flat HERO_LEVEL_MAX const remains
// as the absolute ceiling for storage sanitization and generic UI labels.
export function getEffectiveLevelMax(heroId) {
  if (isHeroMythic(heroId))      return BALANCE.heroLevel.maxMyth;
  if (isHeroAscendedT3(heroId))  return BALANCE.heroLevel.maxT3;
  if (isHeroAscended(heroId))    return BALANCE.heroLevel.maxT2;
  return BALANCE.heroLevel.maxT1;
}
// SPRINT.1 §4.2 — true if hero is at their current tier cap (would benefit
// from ascending). Used by hero detail UI to show ASCEND affordance + by
// analytics to fire `tier_cap_reached` once per cap-hit.
export function isAtTierCap(heroId) {
  const lvl = (typeof getHeroLevel === 'function') ? getHeroLevel(heroId) : 1;
  return lvl >= getEffectiveLevelMax(heroId);
}
// SPRINT.1 §4.2 — returns the NEXT tier's max if hero can ascend further,
// else null. Used by levelUpHero flash text and ASCEND button hints.
export function getNextTierMax(heroId) {
  const cur = getEffectiveLevelMax(heroId);
  if (cur === BALANCE.heroLevel.maxT1) return BALANCE.heroLevel.maxT2;
  if (cur === BALANCE.heroLevel.maxT2) return BALANCE.heroLevel.maxT3;
  if (cur === BALANCE.heroLevel.maxT3) return BALANCE.heroLevel.maxMyth;
  return null;  // already at Mythic cap — no further ascension
}
export function getMythicHeroId() {
  return (towerState && towerState.mythicHero) || null;
}

export function getT3Missing(heroId) {
  if (!heroId) return [{ type: 'unknown', have: 0, need: 1 }];
  if (!isHeroAscended(heroId)) return [{ type: 'requires_t2', have: 0, need: 1 }];
  if (isHeroAscendedT3(heroId)) return [{ type: 'already_t3', have: 1, need: 0 }];
  const hero = HERO_ROSTER.find(h => h.id === heroId);
  if (!hero) return [{ type: 'unknown', have: 0, need: 1 }];
  const missing = [];
  const stones = (towerState && towerState.tier3Stones) || 0;
  const cards  = (typeof getHeroFragments === 'function') ? getHeroFragments(heroId) : 0;
  const goldAvail = (typeof gold !== 'undefined') ? (gold || 0) : 0;
  const essAvail  = (typeof essences !== 'undefined' && essences && hero.stihiya)
                  ? (essences[hero.stihiya] || 0) : 0;
  if (stones    < TIER3_ASCEND_COST)  missing.push({ type: 'stone',   have: stones,    need: TIER3_ASCEND_COST });
  if (cards     < TIER3_CARDS_COST)   missing.push({ type: 'cards',   have: cards,     need: TIER3_CARDS_COST });
  if (goldAvail < TIER3_GOLD_COST)    missing.push({ type: 'gold',    have: goldAvail, need: TIER3_GOLD_COST });
  if (essAvail  < TIER3_ESSENCE_COST) missing.push({ type: 'essence', have: essAvail,  need: TIER3_ESSENCE_COST, stihiya: hero.stihiya });
  return missing.length ? missing : null;
}
export function canAscendT3(heroId) { return getT3Missing(heroId) === null; }
export function ascendHeroT3(heroId) {
  if (!canAscendT3(heroId)) return false;
  const hero = HERO_ROSTER.find(h => h.id === heroId);
  if (!hero) return false;
  towerState.tier3Stones -= TIER3_ASCEND_COST;
  if (typeof heroFragments === 'object') {
    heroFragments[heroId] = Math.max(0, (heroFragments[heroId] || 0) - TIER3_CARDS_COST);
    try { if (typeof saveHeroFragmentsToStorage === 'function') saveHeroFragmentsToStorage(); } catch (_e) { /* swallow */ }
  }
  if (typeof gold !== 'undefined') {
    gold = Math.max(0, gold - TIER3_GOLD_COST);
    try { if (typeof saveGoldToStorage === 'function') saveGoldToStorage(); } catch (_e) { /* swallow */ }
    try { if (typeof renderResourceBar === 'function') renderResourceBar(); } catch (_e) { /* swallow */ }
  }
  if (typeof essences === 'object' && hero.stihiya) {
    essences[hero.stihiya] = Math.max(0, (essences[hero.stihiya] || 0) - TIER3_ESSENCE_COST);
    try { if (typeof saveProgress === 'function') saveProgress(); } catch (_e) { /* swallow */ }
  }
  if (!Array.isArray(towerState.tier3Ascended)) towerState.tier3Ascended = [];
  towerState.tier3Ascended.push(heroId);
  saveTowerState();
  // 2026-04-29 — Celebration baked into the ascend function so console-driven
  // tests see the cinematic too. UI handler (onTryAscendT3) used to own this
  // alone — moved here for visibility across all entry points.
  // TODO(T1.11): rewire flashText/vibrate to ui module once extracted.
  try {
    flashText('★ ' + hero.name + ' DEEP ASCENDED', '#BB60FF');
    setTimeout(() => { try { flashText('TIER 3 · 1.44× DAMAGE', '#BB60FF'); } catch (_e) { /* swallow */ } }, 1100);
    vibrate([120, 60, 120, 60, 250]);
  } catch (_e) { /* swallow */ }
  return true;
}

// SACRED PER CLAUDE.md §2.5 + glossary "Mythic": single-hero-per-save commitment.
// The `mythic_taken` rejection branch (line 20720-20722 in legacy) enforces the
// constraint. DO NOT modify this gate without ESC.
export function getMythicMissing(heroId) {
  if (!heroId) return [{ type: 'unknown', have: 0, need: 1 }];
  if (!isHeroAscendedT3(heroId)) return [{ type: 'requires_t3', have: 0, need: 1 }];
  if (isHeroMythic(heroId)) return [{ type: 'already_mythic', have: 1, need: 0 }];
  // SINGLE hero per save — refuse if another is already mythic.
  const otherMythic = getMythicHeroId();
  if (otherMythic && otherMythic !== heroId) {
    return [{ type: 'mythic_taken', have: 0, need: 1, byHero: otherMythic }];
  }
  const hero = HERO_ROSTER.find(h => h.id === heroId);
  if (!hero) return [{ type: 'unknown', have: 0, need: 1 }];
  const missing = [];
  const stones = (towerState && towerState.legendaryStones) || 0;
  const cards  = (typeof getHeroFragments === 'function') ? getHeroFragments(heroId) : 0;
  const goldAvail = (typeof gold !== 'undefined') ? (gold || 0) : 0;
  const essAvail  = (typeof essences !== 'undefined' && essences && hero.stihiya)
                  ? (essences[hero.stihiya] || 0) : 0;
  if (stones    < MYTHIC_ASCEND_COST)  missing.push({ type: 'legendary', have: stones,    need: MYTHIC_ASCEND_COST });
  if (cards     < MYTHIC_CARDS_COST)   missing.push({ type: 'cards',     have: cards,     need: MYTHIC_CARDS_COST });
  if (goldAvail < MYTHIC_GOLD_COST)    missing.push({ type: 'gold',      have: goldAvail, need: MYTHIC_GOLD_COST });
  if (essAvail  < MYTHIC_ESSENCE_COST) missing.push({ type: 'essence',   have: essAvail,  need: MYTHIC_ESSENCE_COST, stihiya: hero.stihiya });
  return missing.length ? missing : null;
}
export function canAscendMythic(heroId) { return getMythicMissing(heroId) === null; }
export function ascendHeroMythic(heroId) {
  if (!canAscendMythic(heroId)) return false;
  const hero = HERO_ROSTER.find(h => h.id === heroId);
  if (!hero) return false;
  towerState.legendaryStones = Math.max(0, (towerState.legendaryStones || 0) - MYTHIC_ASCEND_COST);
  if (typeof heroFragments === 'object') {
    heroFragments[heroId] = Math.max(0, (heroFragments[heroId] || 0) - MYTHIC_CARDS_COST);
    try { if (typeof saveHeroFragmentsToStorage === 'function') saveHeroFragmentsToStorage(); } catch (_e) { /* swallow */ }
  }
  if (typeof gold !== 'undefined') {
    gold = Math.max(0, gold - MYTHIC_GOLD_COST);
    try { if (typeof saveGoldToStorage === 'function') saveGoldToStorage(); } catch (_e) { /* swallow */ }
    try { if (typeof renderResourceBar === 'function') renderResourceBar(); } catch (_e) { /* swallow */ }
  }
  if (typeof essences === 'object' && hero.stihiya) {
    essences[hero.stihiya] = Math.max(0, (essences[hero.stihiya] || 0) - MYTHIC_ESSENCE_COST);
    try { if (typeof saveProgress === 'function') saveProgress(); } catch (_e) { /* swallow */ }
  }
  // Single-slot commit: store the chosen mythic hero id at the towerState root.
  towerState.mythicHero = heroId;
  saveTowerState();
  // 2026-04-29 — 3-stage cinematic + heavy haptic baked in so console-driven
  // tests see the celebration. UI handler (onTryAscendMythic) used to own
  // this alone — moved here for visibility across all entry points.
  // TODO(T1.11): rewire flashText/vibrate to ui module once extracted.
  try {
    flashText('✦ ' + hero.name + ' TRANSCENDS', '#FF5A3A');
    setTimeout(() => { try { flashText('MYTHIC · 1.872× DAMAGE', '#FFD53D'); } catch (_e) { /* swallow */ } }, 1100);
    setTimeout(() => { try { flashText('★ LEGENDARY CHAMPION ★', '#BB60FF'); } catch (_e) { /* swallow */ } }, 2200);
    vibrate([200, 80, 200, 80, 200, 80, 400]);
  } catch (_e) { /* swallow */ }
  return true;
}

// ─── Hero unlock state (legacy 21220, 21274-21388) ────────────────────────
export const HEROES_UNLOCKED_STORAGE_KEY = 'blocksworn_heroes_unlocked';

// TODO(T1.10.4): HERO_ROSTER / STARTER_HEROES + the .unlocked / .locked flags
// on each entry are heroes-module territory. Preserved as cross-module refs
// while progression owns the persistence layer.
export function saveUnlockedHeroesToStorage() {
  try {
    // Persist only non-starter unlocks — starters are always unlocked by construction,
    // so excluding them keeps the payload compact and prevents duplication.
    const ids = HERO_ROSTER
      .filter(h => h.unlocked && !STARTER_HEROES.has(h.id))
      .map(h => h.id);
    storage.setItem(HEROES_UNLOCKED_STORAGE_KEY, ids);
  } catch (e) { log.warn('saveUnlockedHeroesToStorage failed:', e); }
}

export function loadUnlockedHeroesFromStorage() {
  try {
    const parsed = storage.getItem(HEROES_UNLOCKED_STORAGE_KEY, null);
    if (parsed === null) {
      // Task #1.4.2 hotfix: seed localStorage with starter heroes on first run.
      // Previous build only wrote non-starter unlocks (starters were implicit),
      // so fresh-install smoke tests saw `null` in localStorage even though the
      // in-memory flags were correct. Seeding makes the persisted list concrete.
      const starterIds = Array.from(STARTER_HEROES);
      try { storage.setItem(HEROES_UNLOCKED_STORAGE_KEY, starterIds); } catch (_e) { /* swallow */ }
      for (const h of HERO_ROSTER) h.unlocked = STARTER_HEROES.has(h.id);
      return;
    }
    const storedSet = new Set(Array.isArray(parsed) ? parsed : []);
    // PHASE 5 BLOCK 5 — locked: true heroes can NEVER be unlocked from storage,
    // even if a previous build/dev tool wrote them in. Crocs/Sparks remain locked
    // until Chapter 2 (Phase 5b) re-opens the gate via dedicated unlock dispatcher.
    for (const h of HERO_ROSTER) {
      if (h.locked) { h.unlocked = false; continue; }
      h.unlocked = STARTER_HEROES.has(h.id) || storedSet.has(h.id);
    }
  } catch (e) {
    log.warn('loadUnlockedHeroesFromStorage failed:', e);
    // Safe fallback — starters unlocked only
    for (const h of HERO_ROSTER) {
      h.unlocked = STARTER_HEROES.has(h.id);
    }
  }
}

export function isHeroUnlocked(heroId) {
  const hero = HERO_ROSTER.find(h => h.id === heroId);
  // PHASE 5 BLOCK 5 — `locked: true` is a hard gate. Even if `unlocked` somehow
  // got flipped (legacy save, devTools, race condition), locked heroes never
  // count as unlocked for squad-select / battle / craft purposes.
  if (hero && hero.locked) return false;
  return !!(hero && hero.unlocked);
}

export function unlockHero(heroId) {
  const hero = HERO_ROSTER.find(h => h.id === heroId);
  if (!hero) { log.warn('unlockHero: unknown hero', heroId); return false; }
  // PHASE 5 BLOCK 5 — refuse to unlock locked heroes. Crocs/Sparks gated behind
  // Chapter 2 (Phase 5b). To bypass for dev: set `hero.locked = false` first.
  if (hero.locked) {
    log.debug('unlockHero: ' + heroId + ' is locked behind Chapter 2 — skipped');
    return false;
  }
  if (hero.unlocked) return false;
  hero.unlocked = true;
  saveUnlockedHeroesToStorage();
  try { flashText(`${hero.name} UNLOCKED`, '#3DD66E'); } catch (_e) { /* swallow */ }
  try { vibrate([80, 60, 120]); } catch (_e) { /* swallow */ }
  // Refresh roster view if it's currently rendered
  // TODO(T1.11): rewire renderSelect call once UI module extracted.
  try { if (typeof currentScreen !== 'undefined' && currentScreen === 'select') renderSelect(); } catch (_e) { /* swallow */ }
  return true;
}

export function lockHero(heroId) {
  const hero = HERO_ROSTER.find(h => h.id === heroId);
  if (!hero) { log.warn('lockHero: unknown hero', heroId); return false; }
  if (STARTER_HEROES.has(heroId)) {
    log.debug('lockHero: starter heroes cannot be locked');
    return false;
  }
  if (!hero.unlocked) return false;
  hero.unlocked = false;
  // If locked hero was in the active squad, evict + backfill with a starter
  if (typeof activeSquad !== 'undefined') {
    const si = activeSquad.indexOf(heroId);
    if (si >= 0) {
      activeSquad.splice(si, 1);
      for (const s of HERO_ROSTER) {
        if (activeSquad.length >= getSquadMax()) break;
        if (!STARTER_HEROES.has(s.id)) continue;
        if (activeSquad.includes(s.id)) continue;
        activeSquad.push(s.id);
      }
    }
  }
  saveUnlockedHeroesToStorage();
  // TODO(T1.11): rewire renderSelect call once UI module extracted.
  try { if (typeof currentScreen !== 'undefined' && currentScreen === 'select') renderSelect(); } catch (_e) { /* swallow */ }
  return true;
}

// Squad reconciliation — strips any locked-hero IDs from activeSquad and pads
// with starter heroes (in roster order) until length = SQUAD_MAX. Called at load
// time after unlock-state is restored, and defensively anywhere activeSquad origin
// is untrusted (e.g. migrated save, hand-edited localStorage).
export function reconcileSquadUnlocks() {
  if (typeof activeSquad === 'undefined') return;
  activeSquad = activeSquad.filter(id => isHeroUnlocked(id));
  if (activeSquad.length < getSquadMax()) {
    for (const h of HERO_ROSTER) {
      if (activeSquad.length >= getSquadMax()) break;
      if (!STARTER_HEROES.has(h.id)) continue;
      if (activeSquad.includes(h.id)) continue;
      activeSquad.push(h.id);
    }
  }
  // Trim in case caller handed us an over-length squad
  if (activeSquad.length > getSquadMax()) activeSquad.length = getSquadMax();
}

// ─── Dungeon / floor progress (legacy 25224-25284) ────────────────────────
// Per-chapter per-boss max-floor-cleared counter.
// Shape: { 1: { 0: 3, 1: 1, ... }, 2: {...}, 3: {...} }. Absent entry = 0.
let dungeonProgress = { 1: {}, 2: {}, 3: {} };
export const DUNGEON_PROGRESS_KEY = 'blocksworn_dungeon_progress';

export function saveDungeonProgressToStorage() {
  try {
    storage.setItem(DUNGEON_PROGRESS_KEY, dungeonProgress);
  } catch (e) { log.warn('saveDungeonProgressToStorage failed:', e); }
}

export function loadDungeonProgressFromStorage() {
  try {
    const parsed = storage.getItem(DUNGEON_PROGRESS_KEY, null);
    if (parsed === null) { dungeonProgress = { 1: {}, 2: {}, 3: {} }; return; }
    if (parsed && typeof parsed === 'object') {
      // Ensure all 3 chapter buckets exist and values are numeric
      const clean = { 1: {}, 2: {}, 3: {} };
      for (const ch of [1, 2, 3]) {
        const src = parsed[ch];
        if (src && typeof src === 'object') {
          for (const k in src) {
            const v = src[k];
            if (typeof v === 'number' && v >= 1 && v <= 3) clean[ch][k] = Math.floor(v);
          }
        }
      }
      dungeonProgress = clean;
    } else {
      dungeonProgress = { 1: {}, 2: {}, 3: {} };
    }
  } catch (e) {
    log.warn('loadDungeonProgressFromStorage failed:', e);
    dungeonProgress = { 1: {}, 2: {}, 3: {} };
  }
}

export function getFloorCleared(chapter, bossIdx) {
  return (dungeonProgress[chapter] && dungeonProgress[chapter][bossIdx]) || 0;
}

export function isFloorUnlocked(chapter, bossIdx, floorId) {
  if (floorId === 1) return true;
  return getFloorCleared(chapter, bossIdx) >= (floorId - 1);
}

export function recordFloorCleared(chapter, bossIdx, floorId) {
  if (!dungeonProgress[chapter]) dungeonProgress[chapter] = {};
  const cur = dungeonProgress[chapter][bossIdx] || 0;
  if (floorId > cur) {
    dungeonProgress[chapter][bossIdx] = floorId;
    saveDungeonProgressToStorage();
  }
}

// ─── Hero level state (legacy 25680-25966) ────────────────────────────────
// ===== V3.0 PHASE 4 BLOCK 4.1 — HERO LEVELS (MECHANICS) =====
// Second progression axis for each hero, orthogonal to Tier:
//   - Tier  = milestone-based role ability unlocks (existing, T0→T4)
//   - Level = continuous stat scaling via gold spend (NEW, 1→60)
//
// Per-level delta (additive, stacks on tier/synergy; artifact term retired
// in T1.14):
//   +2% dmg, +1 HP, +0.5% ult charge rate
//
// Gold cost: 50 + (current-1)*50, capped at 3000 per level.
// Total L1 → L60 ≈ 91,500 gold. Whale-friendly, F2P-feasible.
//
// Integration: bonuses flow via getHeroStats so all downstream consumers
// (damage calc, HP init, ult charging) pick them up without changes.

const HERO_LEVEL_MIN    = BALANCE.heroLevel.min;
const HERO_LEVEL_MAX    = BALANCE.heroLevel.max;
const LEVEL_COST_BASE   = BALANCE.heroLevel.costBase;
const LEVEL_COST_STEP   = BALANCE.heroLevel.costStep;
const LEVEL_COST_CAP    = BALANCE.heroLevel.costCap;
const LEVEL_DMG_PER     = BALANCE.heroLevel.dmgPer;   // +2% dmg per level
// 2026-05-02 — COMBAT v2.1 P1: LEVEL_HP_PER removed. Per-level progression
// now contributes mitigation (LEVEL_MITIGATION_PER table above), not HP.
// BALANCE.heroLevel.hpPer is left intact in config for legacy-save compat
// but is not read anywhere — see getLevelBonuses() below.
const LEVEL_ULT_PER     = BALANCE.heroLevel.ultPer;   // +0.5% ult rate per level

let heroLevels = {}; // { heroId: integer in [1, 60] }
export const HERO_LEVELS_KEY = 'blocksworn_hero_levels';

export function saveHeroLevelsToStorage() {
  try { storage.setItem(HERO_LEVELS_KEY, heroLevels); } catch (e) { log.warn('saveHeroLevelsToStorage failed:', e); }
}

export function loadHeroLevelsFromStorage() {
  try {
    const parsed = storage.getItem(HERO_LEVELS_KEY, null);
    if (parsed === null) { heroLevels = {}; return; }
    if (parsed && typeof parsed === 'object') {
      // Sanitize: only keep valid numeric levels within bounds (absolute Mythic cap)
      // SPRINT.1 §4.7 — tier-aware migration is a SEPARATE step, run AFTER
      // loadTowerState() so isHeroAscended/T3/Mythic predicates work.
      // See _migrateHeroLevelsToTierCaps() below.
      const clean = {};
      for (const id in parsed) {
        const v = Math.floor(Number(parsed[id]));
        if (Number.isFinite(v) && v >= HERO_LEVEL_MIN && v <= HERO_LEVEL_MAX) clean[id] = v;
      }
      heroLevels = clean;
    } else {
      heroLevels = {};
    }
  } catch (e) { log.warn('loadHeroLevelsFromStorage failed:', e); heroLevels = {}; }
}

// SPRINT.1 §4.7 — Tier-aware save migration. Clamps each saved hero level
// to its current tier's effective cap. Runs ONCE on boot AFTER loadTowerState
// so ascension predicates (isHeroMythic / isHeroAscendedT3 / isHeroAscended)
// have valid state to read. Without this ordering, all heroes would be
// treated as T1 → over-aggressive clamp (existing T2/T3 testers all dropped
// to LV10).
//
// No gold refund per spec §3.3 — over-spent gold is sunk cost. Console log
// + analytics event surface the clamp for support / patch notes.
export function _migrateHeroLevelsToTierCaps() {
  if (typeof heroLevels !== 'object' || !heroLevels) return;
  let migrationDirty = false;
  const migrationLog = [];
  for (const id in heroLevels) {
    const v = heroLevels[id] | 0;
    let effective;
    try { effective = getEffectiveLevelMax(id); }
    catch (_e) { effective = BALANCE.heroLevel.maxMyth; }  // fallback to absolute ceiling
    if (v > effective) {
      migrationLog.push(id + ': ' + v + '→' + effective);
      heroLevels[id] = effective;
      migrationDirty = true;
    }
  }
  if (migrationDirty) {
    log.debug('[BAL.1 MIGRATION] Clamped ' + migrationLog.length +
                ' hero(es) to tier cap:', migrationLog.join(', '));
    try { saveHeroLevelsToStorage(); } catch (e) { log.warn('migration save failed:', e); }
    try { logEvent(EVT.hero_leveled, { kind: 'migration_clamp', count: migrationLog.length }); } catch (_e) { /* swallow */ }
  }
}

export function getHeroLevel(heroId) {
  const lvl = heroLevels[heroId];
  if (typeof lvl !== 'number' || !Number.isFinite(lvl) || lvl < HERO_LEVEL_MIN) return HERO_LEVEL_MIN;
  // BAL.1 — clamp display to current tier's cap. Saved levels above cap survive
  // in storage but render as the cap until the hero is ascended further.
  const effMax = getEffectiveLevelMax(heroId);
  if (lvl > effMax) return effMax;
  return Math.floor(lvl);
}

export function getLevelUpCost(heroId) {
  const lvl = getHeroLevel(heroId);
  if (lvl >= getEffectiveLevelMax(heroId)) return null;
  const raw = LEVEL_COST_BASE + (lvl - 1) * LEVEL_COST_STEP;
  return Math.min(raw, LEVEL_COST_CAP);
}

export function getLevelBonuses(heroId) {
  const lvl = getHeroLevel(heroId);
  const delta = lvl - HERO_LEVEL_MIN; // 0 at level 1 (no bonus yet)
  return {
    dmgBonus: delta * LEVEL_DMG_PER,
    // 2026-05-02 — COMBAT v2.1 P1: hpBonus stub stays at 0 for backwards-
    // compat with Hero Detail render code (line ~53256). PR #1.C
    // refactors that surface to use mitigation. After #1.C this field
    // can be deleted without breaking anything.
    hpBonus:  0,
    ultBonus: delta * LEVEL_ULT_PER,
  };
}

export function levelUpHero(heroId) {
  const hero = HERO_ROSTER.find(h => h.id === heroId);
  if (!hero) { log.warn('levelUpHero: unknown hero', heroId); return false; }
  if (!hero.unlocked) {
    try { flashText('UNLOCK HERO FIRST', '#E85D4A'); } catch (_e) { /* swallow */ }
    return false;
  }
  const lvl = getHeroLevel(heroId);
  const effMax = getEffectiveLevelMax(heroId);
  if (lvl >= effMax) {
    // SPRINT.1 §4.5 — level-specific ASCEND hint via getNextTierMax.
    // Points player toward the literal next milestone (LV20 / LV30 / LV40).
    const nextMax = getNextTierMax(heroId);
    if (nextMax) {
      try { flashText('⚡ ASCEND TO REACH LV' + nextMax, '#A88AC8'); } catch (_e) { /* swallow */ }
    } else {
      try { flashText('⭐ MYTHIC MAX LEVEL', '#FFD53D'); } catch (_e) { /* swallow */ }
    }
    // SPRINT.1 §5 — tier_cap_reached analytics. Fires on every cap-hit attempt
    // (player education + churn signal — repeated taps = "I want this hero
    // ascended"). Cheap event, no debounce needed.
    try {
      const tier = (effMax === BALANCE.heroLevel.maxT1) ? 'T1'
                 : (effMax === BALANCE.heroLevel.maxT2) ? 'T2'
                 : (effMax === BALANCE.heroLevel.maxT3) ? 'T3'
                 : 'Mythic';
      logEvent(EVT.hero_leveled, { kind: 'tier_cap_reached', heroId, tier, level: lvl });
    } catch (_e) { /* swallow */ }
    return false;
  }
  const cost = getLevelUpCost(heroId);
  if (cost === null || cost === undefined) return false;

  // Phase 0 has no spendGold() helper — direct manipulation with save + renderResourceBar.
  // Atomicity: check balance BEFORE mutating any state, so a fail leaves everything intact.
  if ((gold || 0) < cost) {
    try { flashText('❌ NOT ENOUGH GOLD', '#E85D4A'); } catch (_e) { /* swallow */ }
    return false;
  }
  gold -= cost;
  try { saveGoldToStorage(); } catch (e) { log.warn('saveGoldToStorage failed:', e); }
  try { renderResourceBar(); } catch (_e) { /* swallow */ }

  heroLevels[heroId] = lvl + 1;
  saveHeroLevelsToStorage();
  try { flashText(`⬆ ${hero.name} LVL ${lvl + 1}`, '#FFD53D'); } catch (_e) { /* swallow */ }
  try { vibrate([40, 30, 40]); } catch (_e) { /* swallow */ }
  // V3.0 Phase 5 Block 5.1: mission tracking
  try { if (typeof trackMissionEvent === 'function') trackMissionEvent('hero_leveled'); } catch (_e) { /* swallow */ }
  // V3.0 Phase 7 Block 7.5: Season XP reward (+50 per level-up)
  try { if (typeof addSeasonXP === 'function') addSeasonXP(50); } catch (_e) { /* swallow */ }
  // SPRINT.1 §4.11 — Endgame Kit eligibility check on each successful level-up.
  // Idempotent — only fires the FIRST time conditions become eligible.
  // Catches the "5th hero hits LV10" moment specifically.
  try { if (typeof _maybeShowEndgameKitEligibilityCelebration === 'function') _maybeShowEndgameKitEligibilityCelebration(); } catch (_e) { /* swallow */ }
  return true;
}

export function setHeroLevel(heroId, level) {
  // BAL.1 — clamp to current tier's effective cap. Bulk grants (pack rewards
  // via applyLevelBonusToHeroes → bumpLevel) over the cap silently waste; the
  // player must ascend to absorb further levels.
  const effMax = getEffectiveLevelMax(heroId);
  const clamped = Math.max(HERO_LEVEL_MIN, Math.min(effMax, Math.floor(Number(level) || HERO_LEVEL_MIN)));
  heroLevels[heroId] = clamped;
  saveHeroLevelsToStorage();
  return clamped;
}

export function bumpLevel(heroId, count = 1) {
  const cur = getHeroLevel(heroId);
  return setHeroLevel(heroId, cur + count);
}

// Bulk helper for Phase 3 pack extras. filter = {race?, role?, stihiya?, ids?} (any subset).
// Returns number of heroes affected.
export function applyLevelBonusToHeroes(filter, count) {
  const c = Math.floor(Number(count) || 0);
  if (c <= 0) return 0;
  const heroes = HERO_ROSTER.filter(h => {
    if (filter.ids   && !filter.ids.includes(h.id)) return false;
    if (filter.race   && h.race   !== filter.race) return false;
    if (filter.role   && h.role   !== filter.role) return false;
    if (filter.stihiya && h.stihiya !== filter.stihiya) return false;
    return true;
  });
  for (const hero of heroes) bumpLevel(hero.id, c);
  if (heroes.length > 0) {
    try { flashText(`+${c} LVL to ${heroes.length} heroes`, '#FFD53D'); } catch (_e) { /* swallow */ }
  }
  return heroes.length;
}

// ─── Chapter completion flags (legacy 31510-31545) ────────────────────────
// Task #1.5: Chapter 1 completion flag — set by the Boss_5 (CRYPT LICH) win flow.
// Used by Tower gating, Task #1.8 bottom-nav Tower button state, and future save checks.
// IMPORTANT: legacy stores these as bare strings via
//   localStorage.setItem(`blocksworn_chapter_N_complete`, 'true')
// and reads with `=== 'true'`. T1.10.9 wire-up must add a migration shim — see
// "Замечено рядом" in the task report. For now, the wrapper preserves the raw
// localStorage access path so semantics are byte-perfect.
// TODO(T1.10.9): rewire to storage.* + migration shim.
export function hasCompletedChapter1() {
  try { return localStorage.getItem('blocksworn_chapter_1_complete') === 'true'; } catch (_e) { return false; }
}

// REW.2 — Generic chapter-completion primitives (PRELAUNCH §4.2 + REW.2).
// Per-chapter localStorage flag keyed `blocksworn_chapter_N_complete`. Ch1
// path (`blocksworn_chapter_1_complete`) is the historical key — preserved
// to keep Tower gating + cryptLichAftermath compatible.
export function hasCompletedChapter(n) {
  try { return localStorage.getItem(`blocksworn_chapter_${n | 0}_complete`) === 'true'; }
  catch (_e) { return false; }
}
export function markChapterComplete(n) {
  try { localStorage.setItem(`blocksworn_chapter_${n | 0}_complete`, 'true'); return true; }
  catch (_e) { return false; }
}

// ─── Save/load + chapter unlock flags + state (legacy 38260-38525) ────────
// V16: per-chapter progress tracker. `bossesDefeated` below remains the live
// working counter for the CURRENT chapter; chapterProgress persists all chapters.
// sync helpers are used during save/load and chapter switching.
//
// NOTE: chapterProgress / bossesDefeated / currentChapter / chapter{2,3,4}Unlocked
// / selectedBossIdx / essences / heroUpgrades remain declared in legacy with
// `let` at file scope. T1.10.2 cannot redeclare them here without breaking
// runtime parity (the live save/load aggregator reads + writes the legacy
// globals). The functions below mutate via the existing globals (declared as
// /* global ... :writable */ at the top of this file).
//
// TODO(T1.10.9): once legacy is demoted to a read-only archive, move the
// canonical state ownership here and re-export getters/setters. For T1.10.2 we
// preserve the legacy globals so the existing save/load contract is byte-perfect.

const STARTER_GRANT = { ember: 2 }; // first-time player gets 2 ember essences

// Legacy used the localStorage key 'blocksworn_progress' for the aggregated
// progression save. Preserved through storage.* for shape parity.
export const PROGRESS_STORAGE_KEY = 'blocksworn_progress';

export function saveProgress() {
  try {
    // Sync live bossesDefeated back into chapterProgress before persisting
    const _ch = getCurrentChapter();
    chapterProgress[_ch] = bossesDefeated;
    // T1.14: artifact subsystem fully deleted. No artifact-related fields
    // persisted; migrateRemoveArtifacts() strips legacy residue from
    // existing saves on next boot.
    const data = { essences, heroUpgrades, bossesDefeated, chapterProgress,
                   favorites: [...favorites], activeModifiers: [...activeModifiers],
                   currentChapter: _ch, chapter2Unlocked, chapter3Unlocked, chapter4Unlocked,
                   activeSquad: [...activeSquad], // V3.0 Block 0.1: persist squad (reconciled on load)
                   _v: 17 };
    storage.setItem(PROGRESS_STORAGE_KEY, data);
  } catch(_e) { /* storage unavailable — silent */ }
}

export function loadProgress() {
  try {
    const data = storage.getItem(PROGRESS_STORAGE_KEY, null);
    if (data === null) {
      // First-time player — grant starter essences
      Object.assign(essences, STARTER_GRANT);
      saveProgress();
      return;
    }
    essences = { ember: 0, tide: 0, grove: 0, solar: 0, umbra: 0, ...(data.essences || {}) };
    heroUpgrades = data.heroUpgrades || {};
    if (Array.isArray(data.favorites)) favorites = new Set(data.favorites);
    if (Array.isArray(data.activeModifiers)) activeModifiers = new Set(data.activeModifiers);
    // T1.13.2: currentChapter canonical owner is bosses.js; route writes through setter.
    setCurrentChapterValue(data.currentChapter || 1);
    chapter2Unlocked = !!data.chapter2Unlocked;
    chapter3Unlocked = !!data.chapter3Unlocked;
    // 2026-05-01 — SPRINT 3A: chapter4Unlocked. Defaults to false on absent
    // (pre-Sprint-3A) saves; existing Ch3 finishers grandfathered separately
    // via _migrateChapter4UnlockForExistingFinishers() (called after loads).
    chapter4Unlocked = !!data.chapter4Unlocked;
    // T1.14 (was: 2026-05-02 COMBAT v2.1 P1 PR #1.E §4.3): artifact
    // subsystem fully deleted. Old saves may carry `artifactsOwned` /
    // `equippedArtifacts` / `artDropPityCounter` fields — the
    // migrateRemoveArtifacts() shim (src/services/migrate.js, called from
    // boot chain) strips them on next boot. No defensive defaults needed
    // here — all read sites in src/ and legacy have been deleted.
    // V16: migrate chapterProgress from legacy saves
    if (data.chapterProgress && typeof data.chapterProgress === 'object') {
      chapterProgress = { 1: 0, 2: 0, 3: 0, ...data.chapterProgress };
    } else {
      // Legacy V15 save: put defeated counter into whatever chapter the player was on
      chapterProgress = { 1: 0, 2: 0, 3: 0 };
      chapterProgress[getCurrentChapter()] = data.bossesDefeated || 0;
    }
    // Sync BOSSES reference and live bossesDefeated to current chapter
    setChapter(getCurrentChapter());
    bossesDefeated = chapterProgress[getCurrentChapter()];
    // V3.0 Block 0.1: restore activeSquad, then strip any locked heroes and pad with starters.
    // Also runs on fresh defaults — harmless (default squad is all starters).
    if (Array.isArray(data.activeSquad) && data.activeSquad.length > 0) {
      activeSquad = data.activeSquad.slice(0, getSquadMax());
    }
    reconcileSquadUnlocks();
  } catch(_e) {
    Object.assign(essences, STARTER_GRANT);
    // Defensive: even on load failure, make sure squad contains only unlocked heroes
    try { reconcileSquadUnlocks(); } catch(_e){ /* swallow */ }
  }
}

// 2026-05-02 — SPRINT 3A: One-time migration. Existing Ch3 finishers
// (chapter3FinalRewardClaimed = true) need chapter4Unlocked grandfathered.
// Without this, players who defeated ARCHIVAL ETERNAL before Sprint 3A shipped
// would never see Ch4 unlock — Ch3 finale chain only fires on first defeat,
// and chapter4Unlocked is gated inside the same block. Idempotent: only acts
// when flag is missing. No cinematic — earned before Ch4 existed.
export function _migrateChapter4UnlockForExistingFinishers() {
  try {
    if (towerState && towerState.chapter3FinalRewardClaimed && !chapter4Unlocked) {
      log.debug('[SPRINT 3A · Chapter 4 MIGRATION] Existing Ch3 finisher detected — granting Ch4 unlock');
      chapter4Unlocked = true;
      try { saveProgress(); } catch (_e) { /* swallow */ }
      try { if (typeof logEvent === 'function') logEvent('chapter_4_migration_unlock', {}); } catch (_e) { /* swallow */ }
    }
  } catch (e) { log.warn('Ch4 migration failed:', e); }
}

// ─── Tier upgrade (essence-tier path) (legacy 39988-40002) ────────────────
// SACRED PER CLAUDE.md §2.1: TIER_COSTS values { 1:1, 2:2, 3:3, 4:5 } imported
// from src/data/balance.js (the V18 variant, canonical per T1.07).
// 2026-04-27 — upgradeHero gates progress through TIER_COSTS (essence spend).
export function upgradeHero(heroId, toTier) {
  const hero = HERO_ROSTER.find(h => h.id === heroId);
  if (!hero) return false;
  const currentTier = heroUpgrades[heroId] || 0;
  if (toTier !== currentTier + 1) return false;
  if (toTier < 1 || toTier > 4) return false;
  const cost = TIER_COSTS[toTier];
  if ((essences[hero.stihiya] || 0) < cost) return false;
  essences[hero.stihiya] -= cost;
  heroUpgrades[heroId] = toTier;
  saveProgress();
  return true;
}

// ─── Snapshot + init helpers ──────────────────────────────────────────────
// Returns a read-only view of progression state for analytics / debug surfaces.
// Aggregates the locally-owned state (first clears, boss stars, dungeon
// progress, hero levels) with the legacy-owned aggregator (chapter flags +
// bossesDefeated) so callers don't have to compose both. Pure-read — no I/O.
export function getProgressSnapshot() {
  return {
    currentChapter: getCurrentChapter(),
    bossesDefeated: bossesDefeated,
    chapterProgress: { ...chapterProgress },
    chapter2Unlocked: !!chapter2Unlocked,
    chapter3Unlocked: !!chapter3Unlocked,
    chapter4Unlocked: !!chapter4Unlocked,
    selectedBossIdx: selectedBossIdx,
    firstClearMap:  { ...firstClearMap },
    bossStarsMap:   { ...bossStarsMap },
    dungeonProgress: JSON.parse(JSON.stringify(dungeonProgress)),
    heroLevels:     { ...heroLevels },
  };
}

// Init helper — legacy ran load* helpers at top-level parse time (lines 19576,
// 19577, 25412, 25955). T1.10.9 wire-up will call this from src/main.js boot;
// T1.10.2 only provides the function — nothing imports it yet, so the side
// effect does not run.
export function initProgression() {
  loadFirstClearsFromStorage();
  loadBossStarsFromStorage();
  loadDungeonProgressFromStorage();
  loadHeroLevelsFromStorage();
  loadUnlockedHeroesFromStorage();
  loadProgress();
}
