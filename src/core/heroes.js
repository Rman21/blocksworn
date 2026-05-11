// 2026-05-11 — TASK-011 (T1.10.4): heroes system relocated from legacy.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - Tier progression framework             lines 21070-21194
//   - HERO_ROSTER (25 entries)               lines 21009-21068
//   - STARTER_HEROES + unlock init           lines 21196-21218
//   - ULT charging machinery                 lines 40013-40215
//     (heroCharges, getUltCost, canFireUlt, consumeUltCharge,
//      addChargeToHero, addChargeToHeroesOfElement,
//      distributeChargeOnElementClear, HERO_CHARGE_PER_CELL_BY_COUNT,
//      ELEMENT_POOL_TO_HERO_CHARGE)
//   - ROLE_ULT_PARAMS + STIHIYA_ULT_BONUS    lines 60260-60274
//   - burnRandomCells + _V1_WARRIOR_IDS      lines 60276-60310
//   - applyWarriorUlt/HunterUlt/MageUlt/
//     TankUlt/CaptainUlt + applyStihiyaUltBonus  lines 60311-60456
//   - ultRoleDispatch (main ULT entry)       lines 60460-60626
//   - PIRATE fires + ultTwists               lines 60753-61211
//   - EMBER tier deltas (fire + ult)         lines 61410-61613
//   - applyEmberTierFlagsAtBattleInit        lines 61615-61632
//   - TIDE tier init (comments only — bodies stay in legacy until v2)
//                                            lines 61633-61705
//   - GROVE tier init (comments only)        lines 61707-61774
//   - SOLAR tier init (comments only)        lines 61776-61844
//   - UMBRA tier deltas (fire + ult)         lines 61846-62030
//   - ROCK fires + ultTwists                 lines 62036-62354
//   - SHARK fires + ultTwists                lines 62356-62592
//   - CROCODILE fires + ultTwists            lines 62593-62800
//   - SPARK fires + ultTwists                lines 62801-63001
//   - fireHero dispatcher                    lines 64294-64457
//   - Aegis Conductor (Tank P3)              lines 68680-68871
//   - Squad Conductor (Captain Mark P3)      lines 68873-69180
//   - Tank Emergency ULT modal + applier     lines 26982-27049
//   - applyCaptainMarkOnUlt + OnSquadAction  lines 69708-69716
//
// SACRED PER CLAUDE.md §2.1:
//   - HERO_ULT_COST_BY_NEWROLE (warrior:80, mage:100, hunter:120, tank:80,
//     captain:100) — imported from src/data/heroes.js (T1.07 canonical) and
//     consumed by getUltCost. NOT redeclared here.
//   - HERO_TIER_ABILITIES — imported from src/data/heroes.js (T1.07). NOT
//     consumed inline here (UI surface in Hero Detail Modal — T1.11). The
//     mechanics behind each tier ability (e.g., AEGIS PROTOCOL, MARK system,
//     LOW HP REFLEX, etc.) live in Aegis Conductor + Squad Conductor blocks
//     + per-hero fire/ultDelta tier functions.
//
// SACRED PER CLAUDE.md §2.5 (v2.1 P3 hero ascension):
//   - Aegis Conductor (Tank redesign): activateAegisProtocol,
//     tickAegisProtocol, _computeTankPressureConversion,
//     _getT2TankMitigationBoost, _maybeFireT2TankReactive,
//     MYTHIC_TANK_STAGGER_MULT, AEGIS_PROTOCOL_DURATION — byte-perfect.
//   - Squad Conductor (Captain redesign): captainMarkedHeroId,
//     mythicCaptainStaggerThreshold, MYTHIC_CAPTAIN_THRESHOLDS,
//     CAPTAIN_T2_STAGGER_EXTEND, _consumeCaptainMarkBonus, setCaptainMark,
//     clearCaptainMark, getStaggerTriggerThreshold,
//     setMythicStaggerThreshold, applyCaptainMarkOnUlt,
//     applyCaptainMarkOnSquadAction — byte-perfect.
//
// SACRED:
//   - Every per-hero fire / ultTwist / fireDelta / ultDelta body — damage
//     formulas, hit counts, element tags, status effect durations, fizzle
//     fallbacks — preserved byte-perfect from legacy.
//
// T1.10.4 is pure relocation — no value, formula, threshold, or function
// body modified. Sacred per CLAUDE.md §2.1 + §2.5 — only relocation.
//
// Owns:
//   - 25-hero master roster (HERO_ROSTER) + STARTER_HEROES gate
//   - Per-hero state (tier, xp, unlocked, _ultFiredThisBattle,
//     _landedKillShot) attached to roster entries
//   - HERO_TIERS_STORAGE_KEY persistence (save / load) via T1.08 storage
//   - Tier XP framework (computeTierFromXP, getNextTierThreshold,
//     calculatePostBattleXP, applyXPGainsAndLevelUps, awardPostBattleXP)
//   - ULT charging state machine (heroCharges, getUltCost, canFireUlt,
//     consumeUltCharge, addChargeToHero, addChargeToHeroesOfElement,
//     distributeChargeOnElementClear)
//   - Role-level ULT appliers (warrior/hunter/mage/tank/captain) + stihiya
//     bonus + main ultRoleDispatch entry
//   - All 25 per-hero fire / ultTwist signatures (pirate, rock, shark,
//     crocodile, spark) with full v1 + bug-fix layered logic
//   - Ember + Umbra fire/ult tier delta functions (T1/T2/T3 progressions —
//     other elements declared with comment-only bodies per legacy)
//   - 5 per-element tier-init dispatchers
//     (applyEmber/Tide/Grove/Solar/UmbraTierFlagsAtBattleInit)
//   - fireHero dispatcher (combo-cell fire path) with all Phase 2-5 context
//     multipliers (Warband Strike, Hunter Mark, Grommar Rally, Pack Mark,
//     Helios Roar, Ironbelly Charged Burst, Maelen all-fire, Leorex team,
//     Voxi Plague Aura, Seraphina Inferno, Nightlord post-Encore, Captain
//     Mark fire consumption)
//   - Aegis Conductor (v2.1 P3 Tank) — pressure conversion, T2 reactive
//     mitigation + auto-shield, T3 AEGIS PROTOCOL damage→pressure window,
//     Mythic squad damage boost
//   - Squad Conductor (v2.1 P3 Captain) — Mark system, Mythic Stagger
//     threshold selection, Mark consumption on hero fire + ULT
//   - Tank Emergency ULT modal + applier (bottom-row clear + standard ULT)
//
// Does NOT own:
//   - HERO_ULT_COST_BY_NEWROLE + HERO_TIER_ABILITIES — src/data/heroes.js
//     (T1.07 canonical, sacred per CLAUDE.md §2.1; imported as readonly).
//   - HERO_DECK (battle-scope squad cache) — declared in legacy line 38260,
//     used as `/* global HERO_DECK */` here; T1.10.9 (battle) will take
//     ownership.
//   - 4-channel damage system (DEAD_ZONE, VOID, SIGNATURE, GRID_SATURATION)
//     — T1.10.5 territory.
//   - Stagger Loop (PRESSURE_MAX, PRESSURE_GAIN, addPressure,
//     extendStaggerState, bossState, BOSS_STATE_STAGGER, _firePhase3Hook,
//     _registerPhase3Hook) — T1.10.6 territory.
//   - Boss state (currentBoss, _ch3HasSeal, _ch3HasDebuff, _ch3BossId,
//     _ch3State.witherCells, hypnotistTendrilHeroId,
//     abyssalCrushSpireHeroId, frenzyDevouredHeroId) — T1.10.7 /
//     T1.10.8 territory.
//   - Reactivity Events (squadSilencedTurns, tempoChargeNullifyQueued) —
//     T1.10.8 territory.
//   - Tower / pact runState (_isTowerBattle, pactRunState, getBuffValue) —
//     T1.10.7 or T1.11 territory.
//   - Battle-scope state (grid, hp, currentMaxHP, shieldCount, MAX_SHIELD,
//     maxShieldBonus, attackCountdown, gameEnded, _passiveDmgContext,
//     _warbandStrikeContext, _hunterMarkContext, _grommarRallyContext,
//     _packMarkContext, _helioRoarContext, all motif state) — T1.10.9
//     (battle) territory.
//   - DOM / UI (flashText, flashStateBanner, vibrate, render,
//     renderChargedVisuals, renderHeroCards, renderEmergencyUltButton,
//     renderCaptainMarkBadge, _maybeTriggerCaptainMarkIntro,
//     _maybeTriggerMythicIntro, document.getElementById, document.body) —
//     T1.11 (ui) territory.
//   - Helpers _spawnEmberCharged / _spawnUmbraCells / _spawnTideCells /
//     _spawnGroveAbsorbers / _spawnSolarCells / applyCascade / spawnCharged
//     / consumeEncoreStacks / consumeChainStack / _hunterUltDetonateAllCells
//     / spawnUmbraCell / dealDamage / sleep / speakNarrator (already
//     extracted T1.09) / playULTReady / maybeChronoBeat / logBattleEvent /
//     logEvent / trackMissionEvent / flashHero / markFired /
//     applyUmbraCarriedBonus / onUmbraUltFired / maybeMarkRadiant /
//     onHeroFireCompleted / showDefeatModal / getHeroStats / getBuffValue
//     — battle + feel + analytics + helpers, T1.10.9 / T1.10.5 / T1.11
//     territory.
//
// Storage migration: HERO_TIERS_STORAGE_KEY uses JSON.stringify on save and
// JSON.parse on load (already JSON-shape, not a bare string) — routes
// cleanly through T1.08 storage abstraction. NO new bare-string keys added
// in this sub-task.

// ESLint scaffolding for the long byte-perfect legacy paste below.
// Per T1.10.1-3 sibling pattern: explicit /* global */ blocks for every
// legacy ambient + writable mutation site. The list is wide because hero
// fire/ult bodies touch many systems (stagger pressure, channels, motifs,
// reactivity, tower, captain mark) — all of which migrate in T1.10.5+. We
// also disable file-scope no-empty (legacy uses `} catch (e) {}` patterns
// abundantly — preserving byte-perfect requires accepting them) and
// caughtErrors no-unused-vars (legacy uses `catch (e)` not `catch (_e)` —
// renaming would violate byte-perfect). The `:writable` annotations match
// every mutation site flagged by lint.
/* eslint-disable no-empty, no-unused-vars */

// T1.13.1: /* global */ → ES imports for resolved src/ exports.
import {
  PRESSURE_MAX, PRESSURE_GAIN, BOSS_STATE_STAGGER,
  addPressure, extendStaggerState,
} from './stagger-loop.js';
import { isHeroMythic } from './progression.js';
import { STIHIYA_COLORS } from '../data/elements.js';
import { speakNarrator } from '../feel/narrator.js';
import { vHaptic } from '../feel/haptics.js';
import { logEvent } from '../services/analytics.js';

/* global
  HERO_DECK,
  bossState, _firePhase3Hook, _registerPhase3Hook,
  hypnotistTendrilHeroId, hypnotistTendrilTurnsLeft,
  abyssalCrushSpireHeroId, abyssalCrushSpireTurnsLeft,
  frenzyDevouredHeroId, frenzyDevouredTurnsLeft,
  squadSilencedTurns, tempoChargeNullifyQueued, currentBoss,
  _isTowerBattle, pactRunState, getBuffValue,
  _ch3HasSeal, _ch3HasDebuff, _ch3BossId, _ch3State,
  ULT_THRESHOLD, currentUltThreshold,
  SIZE, MAX_HP, MAX_SHIELD, maxShieldBonus,
  MOTIFS_ENABLED, EMBER_CHARGED_CAP,
  EMBER_ULT_CHARGED_BONUS, EMBERHAND_BLOOM_TURNS,
  CRYOMIND_WEAVE_TURNS, FROST_CHAIN_CAP, GROVE_REVENGE_THRESHOLD,
  KEYCRYPT_DEEP_BEAT_TURNS, LUMENWIND_HALO_TURNS,
  MOSSWEAVER_SURGE_TURNS, SOLAR_BURST_DMG_PER_SHIELD,
  TIDE_COUNTDOWN_CAP,
  SPARK_CHARGE_REGEN_MULT,
  chargedCells, radiantCells, bloomTokens,
  groveAbsorbedByCell,
  blackfangPackMult,
  captainConversionBoost,
  heroUpgrades,
  currentPassiveDmgMult,
  rainbowEffectActive, rainbowTier, rainbowBonus, deadlockImmunity,
  emergencyULTRemaining,
  spawnCharged, applyCascade, _hunterUltDetonateAllCells, spawnUmbraCell,
  consumeEncoreStacks, consumeChainStack, consumeEarthCells,
  consumeShieldsForBurst, applyUmbraCarriedBonus,
  onUmbraUltFired, onFreezeApplied, maybeMarkRadiant, onHeroFireCompleted,
  flashRacePassiveOnce,
  groveRevengeFired, groveTotalAbsorbed,
  rhythmSectionActive,
  dealDamage, sleep, vibrate, render, renderChargedVisuals,
  renderHeroCards, renderHP, flashText,
  flashStateBanner, flashHero, markFired, playULTReady, playSFX,
  maybeChronoBeat, logBattleEvent, trackMissionEvent,
  getHeroStats, _t2Bonus, _t2BonusInDeck,
  showDefeatModal
*/
// LEGACY-ONLY: above tokens have no src/ export — shims retired in T1.14+ cleanup.
/* global
  grid:writable, hp:writable, currentMaxHP:writable, shieldCount:writable,
  attackCountdown:writable, gameEnded:writable, bossHP:writable,
  battleDamageTaken:writable, ultCharges:writable,
  encoreStacks:writable, encoreActive:writable, encoreUsed:writable,
  rockEncoreActive:writable,
  frostChainStack:writable, chainWindow:writable, chainStack:writable,
  chainWindowOpen:writable,
  warbandStrikeActive:writable, warbandStrikeWindow:writable,
  warbandUltShareActive:writable,
  hunterMarkActive:writable, hunterMarkWindow:writable, hunterMarkConsumed:writable,
  grommarRallyWindow:writable, grommarRallyPermanent:writable,
  grommarRallyShield:writable,
  packMarkActive:writable, blackfangPackRemaining:writable,
  helioRoarWindow:writable, heliosRoarMult:writable,
  heliosRoarFlatBonus:writable, helioRoarActive:writable,
  ironbellyNextFireBonus:writable, ironbellyUltChargedCount:writable,
  ironbellyBaseDmg:writable, ironbellyChargedMarks:writable,
  ironbellyPhoenixImmune:writable, ironbellyExtraShield:writable,
  ironbellyUltShield:writable,
  maelenAllFireBonus:writable, leorexTeamFireBonus:writable,
  plagueAuraTurns:writable,
  inferno_mode_window:writable, nightlordPostEncoreBoost:writable,
  blacktoothBaseDmg:writable, blacktoothShotCount:writable,
  blacktoothMarkBeforeClear:writable, blacktoothChargedBonus:writable,
  blacktoothVolleyRows:writable, blacktoothVolleyInferno:writable,
  emberhandBloomActive:writable,
  emberhandBloomDuration:writable, emberhandBloomMult:writable,
  emberhandSpawnCount:writable, emberhandSpawnCharged:writable,
  emberhandCascadeOnFire:writable, emberhandUltShield:writable,
  thorgarBaseDmg:writable, thorgarClearCount:writable,
  thorgarChargedChance:writable, thorgarFleetSiegeBurns:writable,
  thorgarFleetSiegeAlways:writable, thorgarBurnCascade:writable,
  crimsonConvertCount:writable, crimsonChargedRate:writable,
  crimsonCascadeDepth:writable, crimsonFullTeamCharge:writable,
  crimsonCascadeScan:writable, crimsonDominionInferno:writable,
  riffbladeBeatInterval:writable, riffbladeBeatMult:writable,
  riffbladeFlatBonus:writable, riffbladeUltSiegeBonus:writable,
  riffbladeSelfEncore:writable, riffbladeEncorePermanent:writable,
  riffbladeFireCounter:writable,
  shriekRockThreshold:writable, shriekSpreadCount:writable,
  shriekSpreadDetonate:writable, shriekEchoTurns:writable,
  shriekEchoMult:writable, shriekEchoPermanent:writable,
  shriekEchoNextPlacement:writable,
  keycryptSpawnCount:writable, keycryptSpawnCharged:writable,
  keycryptSpawnChargesHero:writable, keycryptAmpRate:writable,
  keycryptAmpChargePerPlace:writable, keycryptAmpWindowTier:writable,
  keycryptAmpWindow:writable,
  thunderbeatBaseDmg:writable, thunderbeatRhythmBonus:writable,
  thunderbeatRhythmWindow:writable, thunderbeatRhythmWindowTier:writable,
  thunderbeatRockThreshold:writable, thunderbeatUltDrops:writable,
  rhythmSectionPermanent:writable,
  nightlordChargeChance:writable, nightlordGuaranteedCharge:writable,
  nightlordUltExtraCells:writable, nightlordUltAmpOpens:writable,
  valeriusRadiantTurnOpen:writable, valeriusRadiantUntilUlt:writable,
  lumenwindHaloActive:writable, lumenwindHaloDuration:writable,
  lumenwindHaloShieldsBonus:writable,
  cryomindWeaveActive:writable, cryomindWeaveDuration:writable,
  cryomindWeaveMult:writable,
  keycryptDeepBeatActive:writable, keycryptDeepBeatDuration:writable,
  keycryptDeepBeatMult:writable,
  mossweaverSurgeActive:writable, mossweaverSurgeDuration:writable,
  mossweaverSurgeMult:writable,
  frostChainSegments:writable,
  _passiveDmgContext:writable, _warbandStrikeContext:writable,
  _hunterMarkContext:writable, _hunterMarkConsumed:writable,
  _grommarRallyContext:writable, _grommarRallyConsumed:writable,
  _packMarkContext:writable, _packMarkConsumed:writable,
  _helioRoarContext:writable,
  heroFireCount:writable, lastFireCounts:writable,
  showTankConversionFX:writable, showAegisProtocolFX:writable,
  showAegisProtocolEntryFX:writable, renderCaptainMarkBadge:writable,
  _maybeTriggerCaptainMarkIntro:writable, _maybeTriggerMythicIntro:writable
*/
// no-empty + no-unused-vars stay disabled for the rest of the file.
// (The legacy paste below uses `try { ... } catch (e) {}` heavily — preserving
// byte-perfect requires accepting those patterns. Module-private logic that
// future contributors add to this file should still respect the rules; the
// existing legacy block is the only known exception.)

import {
  HERO_ULT_COST_BY_NEWROLE,
  HERO_TIER_ABILITIES,
} from '../data/heroes.js';
import { BALANCE } from '../data/balance.js';
import * as storage from '../services/storage.js';
import { log } from '../services/logger.js';

// HERO_TIER_ABILITIES is sacred per CLAUDE.md §2.1 — re-exported here for
// downstream consumers (Hero Detail Modal in T1.11, profile tab, etc.) so the
// canonical tier metadata sits next to the runtime tier logic that consumes it.
export { HERO_TIER_ABILITIES };

// ===== V2.0 STAGE 5 BLOCK 5.1 — TIER PROGRESSION FRAMEWORK =====
// Each hero evolves T0 → T1 → T2 → T3 via XP from battle participation.
// Tier deltas are optional hero fields that run AFTER base fire / ultSignature.

// Tier XP thresholds (cumulative) — see Block 5.1 PART A.3.
// BALANCE.tier.xpThresholds + BALANCE.tier.{max,fireMultCap,xp} live in
// src/data/balance.js (T1.07 canonical) — imported above.
const TIER_XP_THRESHOLDS = { T1: BALANCE.tier.xpThresholds.t1, T2: BALANCE.tier.xpThresholds.t2, T3: BALANCE.tier.xpThresholds.t3 };
const TIER_MAX           = BALANCE.tier.max;
// V2.0 Stage 5 Block 5.7: FIRE_MULT_CAP — hard ceiling on combined multiplier stack (Part F.1.2)
// Prevents extreme lion-fire-buff chain (Warband × Pack × Hunter × Grommar × Roar = 6.55×)
// from breaking the game; clamps to 3.0× regardless of how many active buffs stack.
// Flat bonuses (Leorex team +50/lion, Helios +50) still add on top of clamped mult per spec.
const FIRE_MULT_CAP      = BALANCE.tier.fireMultCap;
const XP_PARTICIPATION   = BALANCE.tier.xp.participation;  // hero in squad (win or loss)
const XP_ULT_FIRED       = BALANCE.tier.xp.ultFired;       // hero's ULT fired during battle (total +3)
const XP_KILL_SHOT       = BALANCE.tier.xp.killShot;       // hero dealt kill-shot on boss (total +8)
const XP_CAP_PER_BATTLE  = BALANCE.tier.xp.capPerBattle;   // matches Cairo contract validation

// Tracks the hero currently executing their fire or ULT — used for kill-shot attribution in dealDamage.
// Set in fireHero/ultRoleDispatch start, cleared in finally. Null outside those flows.
let _currentFiringHero = null;

// ===== Hero tier persistence (T1.08 storage abstraction; was localStorage in legacy) =====
const HERO_TIERS_STORAGE_KEY = 'blocksworn_hero_tiers';

function saveHeroTiersToStorage() {
  try {
    const data = {};
    for (const h of HERO_ROSTER) {
      if ((h.tier || 0) > 0 || (h.xp || 0) > 0) {
        data[h.id] = { tier: h.tier || 0, xp: h.xp || 0 };
      }
    }
    storage.setItem(HERO_TIERS_STORAGE_KEY, data);
  } catch (e) { log.warn('saveHeroTiersToStorage failed:', e); }
}

function loadHeroTiersFromStorage() {
  try {
    const data = storage.getItem(HERO_TIERS_STORAGE_KEY, null);
    if (!data) return;
    for (const h of HERO_ROSTER) {
      if (data[h.id]) {
        h.tier = Math.min(TIER_MAX, Math.max(0, data[h.id].tier || 0));
        h.xp   = Math.max(0, data[h.id].xp || 0);
      }
    }
  } catch (e) { log.warn('loadHeroTiersFromStorage failed:', e); }
}

// Compute current tier from cumulative XP (monotonic — tier only goes up)
function computeTierFromXP(xp) {
  if (xp >= TIER_XP_THRESHOLDS.T3) return 3;
  if (xp >= TIER_XP_THRESHOLDS.T2) return 2;
  if (xp >= TIER_XP_THRESHOLDS.T1) return 1;
  return 0;
}

// Compute next tier threshold for progress display
function getNextTierThreshold(currentTier) {
  if (currentTier === 0) return TIER_XP_THRESHOLDS.T1;
  if (currentTier === 1) return TIER_XP_THRESHOLDS.T2;
  if (currentTier === 2) return TIER_XP_THRESHOLDS.T3;
  return null;  // T3 = max
}

// Post-battle XP calculation — returns {heroId: xpGain} map, capped per-hero
function calculatePostBattleXP(_isWin) {
  const xpGains = {};
  for (const hero of HERO_DECK) {
    if (!hero) continue;
    // V3.0 Block 0.1 trap 1: locked heroes never earn XP. They shouldn't be in
    // HERO_DECK at all (reconcileSquadUnlocks filters them), but guard anyway.
    if (hero.unlocked === false) continue;
    let gain = XP_PARTICIPATION;
    if (hero._ultFiredThisBattle) gain += XP_ULT_FIRED;
    if (hero._landedKillShot)     gain += XP_KILL_SHOT;
    xpGains[hero.id] = Math.min(XP_CAP_PER_BATTLE, gain);
  }
  return xpGains;
}

// Apply XP gains + compute tier-ups → returns array of {hero, prevTier, newTier}
function applyXPGainsAndLevelUps(xpGains) {
  const levelUps = [];
  for (const heroId in xpGains) {
    const hero = HERO_ROSTER.find(h => h.id === heroId);
    if (!hero) continue;
    const prevTier = hero.tier || 0;
    hero.xp = (hero.xp || 0) + xpGains[heroId];
    const newTier = computeTierFromXP(hero.xp);
    if (newTier > prevTier) {
      hero.tier = newTier;
      levelUps.push({ hero, prevTier, newTier });
    }
  }
  saveHeroTiersToStorage();
  return levelUps;
}

// Called from onBossDefeated (win=true) and showDefeatModal (win=false).
// Flashes level-up notifications with staggered timing.
function awardPostBattleXP(isWin) {
  const xpGains = calculatePostBattleXP(isWin);
  const levelUps = applyXPGainsAndLevelUps(xpGains);
  // Stagger level-up flashes so multiple tier-ups don't overlap visually
  levelUps.forEach((lu, i) => {
    setTimeout(() => {
      flashText(`${lu.hero.name} · T${lu.newTier} UNLOCKED`, '#FFD53D');
      vibrate([80, 40, 80]);
    }, 400 + i * 1000);
  });
  return { xpGains, levelUps };
}

// ===== V3.0 PHASE 0 BLOCK 0.1 — HERO UNLOCK SYSTEM =====
// Starters = the 3 mono-pirate trio (HOTFIX B3.2 — Option C / Block B3 layout).
// HOTFIX B3.2 — Option C applied (per-hero charge architecture restored from
// archived/phase-4 b0796ac). With per-hero `heroCharges` driving the gate
// (canFireUlt/consumeUltCharge), each card has its own meter — Option A's
// mixed-element starter workaround is no longer needed. Reverting to the
// B3 mono-pirate starter trio which Roman originally approved — smallest
// legal squad showcasing all 3 main combo verbs.
// BOSS_UNLOCKS[1]/[2] reverted to B3 layout below (they pair with this set).
const STARTER_HEROES = new Set([
  'pirate_warrior', // THORGAR    (Warrior / CREATOR)
  'pirate_hunter',  // BLACKTOOTH (Hunter / DETONATOR)
  'pirate_captain', // CRIMSON    (Captain / ENABLER)
]);

// ===== ULT CHARGING MACHINERY =====
// Per-hero individual charge meters (Pillars 1, 2, 4 foundation from V4.0 Phase 4 Task 4.1).
// Each hero in HERO_DECK has an independent 0..HERO_CHARGE_MAX meter that drives
// ULT-fire eligibility. The legacy `ultCharges` element pool (declared in legacy
// battle scope) is still bumped by various artifact/passive procs at other callsites
// — those bumps are dead-write residue (DEBT-014) until rewired in Task 4.2/4.3.
let heroCharges = {};                  // { heroId: charge } — battle-scope, reset on startBossBattle()
const HERO_CHARGE_MAX = 120;           // ceiling cap (over-charge buffer for Pillar 4 chain combo, Task 4.3)
const HERO_ULT_COST_DEFAULT = 100;     // fallback when hero.newRole is missing / unknown
// HERO_ULT_COST_BY_NEWROLE imported from src/data/heroes.js (T1.07 sacred — see CLAUDE.md §2.1).

function getUltCost(heroId) {
  if (!heroId) return HERO_ULT_COST_DEFAULT;
  const hero = (typeof HERO_DECK !== 'undefined') && HERO_DECK.find(h => h && h.id === heroId);
  if (!hero || !hero.newRole) return HERO_ULT_COST_DEFAULT;
  let baseCost = HERO_ULT_COST_BY_NEWROLE[hero.newRole] || HERO_ULT_COST_DEFAULT;
  // 2026-04-27 — Block T.2 — Tower pact ULT cost multiplier. Outside Tower
  // runs pactRunState.ultCostMult = 1.0 (no-op). QUICK PACT (×0.85) makes
  // ULTs charge faster; STORM PACT (×1.50) makes them slower.
  if (typeof _isTowerBattle !== 'undefined' && _isTowerBattle
      && typeof pactRunState !== 'undefined' && pactRunState.ultCostMult) {
    baseCost = Math.max(20, Math.round(baseCost * pactRunState.ultCostMult));
  }
  // 2026-04-27 — Block T.6 — 24h Buff: ULTs charge +20% faster (any combat).
  try {
    if (typeof getBuffValue === 'function') {
      const buffUltMult = getBuffValue('ultCostMult', 1.0);
      if (buffUltMult !== 1.0) baseCost = Math.max(20, Math.round(baseCost * buffUltMult));
    }
  } catch (e) {}
  return baseCost;
}
const HERO_CHARGE_PER_CELL_BY_COUNT = { 1: 20, 2: 14, 3: 10 }; // inverse-scaling fill rate per spec
function _heroChargePerCell(matchingCount) {
  if (matchingCount <= 0) return 0;
  return HERO_CHARGE_PER_CELL_BY_COUNT[matchingCount] || Math.max(6, Math.floor(30 / matchingCount));
}
function distributeChargeOnElementClear(element, cellsCleared) {
  if (!cellsCleared || cellsCleared <= 0) return;
  if (!Array.isArray(HERO_DECK) || HERO_DECK.length === 0) return;
  // PHASE 5b BLOCK 6 — Tempo Disruptor REVERSE TEMPO. While flag is true, all
  // charge gain is nullified for the current placement (across all elements).
  // Flag was set by previous tick (interval hit); consumed at end of CURRENT
  // placement by _tickTempo. Multi-element clears in same placement all gated.
  if (typeof tempoChargeNullifyQueued !== 'undefined' && tempoChargeNullifyQueued
      && typeof currentBoss !== 'undefined' && currentBoss
      && currentBoss.archetype === 'tempo_disruptor') {
    try { flashText('❄ UNDERTOW · CHARGE BLOCKED', '#78C8FF'); } catch (e) {}
    return;
  }
  const matching = HERO_DECK.filter(h => h && h.stihiya === element);
  if (matching.length === 0) return;
  const gain = _heroChargePerCell(matching.length) * cellsCleared;
  for (const h of matching) addChargeToHero(h.id, gain);
  // PHASE 4 BLOCK 1 — chronograph CHARGE beat. First time charge actually distributes
  // during FTUE Pyredrake → highlight the first-charged hero card so the player sees
  // the ULT ring fill. Delay 220ms so render() has emitted the new charge bar before
  // we measure rect for the spotlight.
  try {
    if (typeof maybeChronoBeat === 'function' && matching.length > 0) {
      const firstHero = matching[0];
      setTimeout(() => {
        const card = document.querySelector(`.hero-card[data-id="${firstHero.id}"]`);
        maybeChronoBeat('charge', { targetEl: card });
      }, 220);
    }
  } catch (e) {}
}
// DEBT-014 — Element-pool dead writes mitigation (PRELAUNCH_MASTER amendment #3).
// The legacy `ultCharges` pool is no longer the ult-fire gate (per-hero
// `heroCharges` took over in Phase 4 Block 1). Various artifact/passive procs
// still bump the legacy pool — this helper translates those bumps into per-hero
// charge so the procs actually contribute to ult-readiness. Each call-site now
// invokes this alongside the legacy write; the legacy write stays for any
// side-effect dependency (UI flashes etc.).
//
// Scale conversion: 1 legacy pool unit ≈ 1/12 of bar ≈ 8% of an ult cost.
// Pass `legacyAmount * ELEMENT_POOL_TO_HERO_CHARGE` to preserve intent.
const ELEMENT_POOL_TO_HERO_CHARGE = 8;
function addChargeToHeroesOfElement(element, amount) {
  if (!element || !amount) return 0;
  if (typeof addChargeToHero !== 'function') return 0;
  if (typeof HERO_DECK === 'undefined' || !Array.isArray(HERO_DECK) || HERO_DECK.length === 0) return 0;
  const matching = HERO_DECK.filter(h => h && h.stihiya === element);
  if (matching.length === 0) return 0;
  for (const h of matching) addChargeToHero(h.id, amount);
  return matching.length;
}

function addChargeToHero(heroId, amount) {
  if (!heroId || !amount) return;
  // 2026-04-27 — Block 6.5 DEBT-6 — ARCHIVAL "charge_frozen" seal:
  // hero per-cell charges = 0. No charge gain while seal active.
  try {
    if (typeof _ch3HasSeal === 'function' && _ch3HasSeal('charge_frozen')) return;
  } catch (e) {}
  // PHASE 5 BLOCK 4 — Spark race-passive [CHARGE REGEN] (2-of-race). Multiplies
  // every charge gain by SPARK_CHARGE_REGEN_MULT (1.10 = +10%). Stateless — read
  // squad composition at fire time. Fires for ALL heroes regardless of race
  // (Sparks "amp the team's energy", not just themselves).
  try {
    if (Array.isArray(HERO_DECK)) {
      const sparkCount = HERO_DECK.filter(h => h && h.race === 'spark').length;
      if (sparkCount >= 2 && typeof SPARK_CHARGE_REGEN_MULT === 'number') {
        amount = amount * SPARK_CHARGE_REGEN_MULT;
      }
    }
  } catch (e) {}
  const prev = heroCharges[heroId] || 0;
  const next = Math.min(HERO_CHARGE_MAX, prev + amount);
  if (next === prev) return;
  heroCharges[heroId] = next;
  // ULT-READY transition flash — fires once when crossing from below cost to >= cost.
  // HOTFIX B3.3: cost is per-role via getUltCost (warrior/tank=80, mage/captain=100, hunter=120).
  const cost = getUltCost(heroId);
  if (prev < cost && next >= cost) {
    const hero = (typeof HERO_DECK !== 'undefined') && HERO_DECK.find(h => h && h.id === heroId);
    if (hero) {
      try { flashText(`${hero.name} · ULT READY`, STIHIYA_COLORS[hero.stihiya] || '#ffd53d'); } catch(e){}
      try { vibrate(60); } catch(e){}
      // 2026-04-27 — Audio A.2.4: rising chime on ULT-ready transition (per spec §4.1).
      try { if (typeof playULTReady === 'function') playULTReady(); } catch(e){}
    }
    // PHASE 4 BLOCK 1 — chronograph ULT beat. First hero crossing the per-role
    // cost threshold during FTUE → coachmark on that specific hero card so the
    // player learns "tap charged portrait to fire ULT". 250ms delay lets the
    // render() emit the .ult-ready class before we measure rect.
    try {
      if (typeof maybeChronoBeat === 'function') {
        setTimeout(() => {
          const card = document.querySelector(`.hero-card[data-id="${heroId}"]`);
          maybeChronoBeat('ult', { targetEl: card });
        }, 250);
      }
    } catch (e) {}
  }
}
function canFireUlt(heroId) {
  // PHASE 5b BLOCK 3 — Hypnotist Tendril Coil: locked hero cannot fire ULT for
  // duration of coil (2 turns by default). Visual feedback via .hero-card--hypno-coiled
  // CSS class; canFireUlt returns false during the lock.
  if (typeof hypnotistTendrilHeroId !== 'undefined'
      && hypnotistTendrilHeroId === heroId
      && hypnotistTendrilTurnsLeft > 0) {
    return false;
  }
  // 2026-04-30 — Abyssal Tyrant Crush Spire: locked hero cannot fire ULT
  // for 2 turns (BOSS_COMPENDIUM §1.2). Same shape as Hypnotist Tendril.
  if (typeof abyssalCrushSpireHeroId !== 'undefined'
      && abyssalCrushSpireHeroId === heroId
      && abyssalCrushSpireTurnsLeft > 0) {
    return false;
  }
  // PHASE 5b BLOCK 5 — Frenzy Devour: locked hero cannot fire ULT for 3 turns.
  // Visual feedback via .hero-card--frenzy-devoured CSS class.
  if (typeof frenzyDevouredHeroId !== 'undefined'
      && frenzyDevouredHeroId === heroId
      && frenzyDevouredTurnsLeft > 0) {
    return false;
  }
  return (heroCharges[heroId] || 0) >= getUltCost(heroId);
}
function consumeUltCharge(heroId) {
  if (!heroId) return;
  heroCharges[heroId] = 0;
}

const ROLE_ULT_PARAMS = {
  warrior: { baseDmg: 500, burns: 10 },         // direct dmg + burn N random cells
  hunter:  { rows: 3, baseDmg: 200, perCube: 40 }, // clear N rows, dmg scales with cubes
  mage:    { /* heal only */ },
  tank:    { shields: 3 },
  captain: { convert: 10 },
};
// Stihiya-level bonuses stack atop role effects
const STIHIYA_ULT_BONUS = {
  ember:  { burnDmgPerCell: 5 },    // +5 dmg per burned cell (warrior/hunter only)
  tide:   { freeze: 3 },             // +3 attack countdown
  grove:  { heal: 1 },               // +1 HP
  solar:  { shield: 1 },             // +1 shield
  umbra:  { umbraCharge: 3 },        // +3 to team's umbra ULT charge
};

// Helper: burn N random filled non-void cells, populate ctx.burnedCount and ctx.burnedStihiyas.
async function burnRandomCells(n, ctx) {
  const filled = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const v = grid[r][c];
    if (v && !v.startsWith('void_')) filled.push([r, c]);
  }
  if (!filled.length) return;
  filled.sort(() => Math.random() - 0.5);
  const picks = filled.slice(0, Math.min(n, filled.length));
  const cellEls = document.querySelectorAll('.grid .cell');
  const burnedStihiyas = [];
  for (const [r, c] of picks) {
    cellEls[r*SIZE+c].classList.add('burning');
    burnedStihiyas.push(grid[r][c]);
  }
  vibrate([25, 25, 25, 25, 25]);
  await sleep(500);
  for (const [r, c] of picks) grid[r][c] = null;
  ctx.burnedCount = picks.length;
  ctx.burnedStihiyas = burnedStihiyas;
  ctx.burnedKeys = picks.map(([r, c]) => r + '_' + c); // V2.0 Block 1.1: for charged-ult bonus
}

// WARRIOR: direct dmg + burn 10 random cubes
// 2026-04-27 GRAMMAR HOTFIX: v1 Warriors (THORGAR/RIFFBLADE/RIMEFANG/MOSSJAW/
// EMBERSPARK) are pure CREATORS per §5 — they MUST NOT call dealDamage or
// burnRandomCells on ULT either. The generic SIEGE template (damage+burn) is
// preserved for legacy heroes (orc warriors, etc) so we don't break tier 4-5
// races. v1 warriors: skip damage+burn, the per-hero ultSignature handles
// mass-CREATE (board-wide cell spawning) per plan §9 "Warrior ULT — board CREATE".
const _V1_WARRIOR_IDS = new Set([
  'pirate_warrior', 'rock_warrior', 'shark_warrior',
  'crocodile_warrior', 'spark_warrior',
]);
async function applyWarriorUlt(hero, ctx) {
  // V2.0 Block 1.3: umbra carried-bonus pulse (pre-main-damage, so it can't be nullified by death)
  applyUmbraCarriedBonus(hero);
  if (hero && _V1_WARRIOR_IDS.has(hero.id)) {
    // §5 pure CREATOR — no damage, no burn. Per-hero ultSignature (ultTwist*)
    // delivers the board-wide cell creation (FORGE / BASTION / CASCADE / etc).
    return;
  }
  // Legacy non-v1 warriors keep the SIEGE damage+burn template.
  const cfg = ROLE_ULT_PARAMS.warrior;
  // V2.0 Block 3.2: WARBAND STRIKE — +50% warrior ULT base damage during 2-placement window
  const strikeBoost = (warbandStrikeActive && warbandStrikeWindow > 0) ? 1.5 : 1;
  dealDamage(Math.floor(cfg.baseDmg * strikeBoost), true);
  await burnRandomCells(cfg.burns, ctx);
}

// HUNTER: clear 3 random non-empty rows, dmg scales with cubes cleared
async function applyHunterUlt(hero, ctx) {
  const cfg = ROLE_ULT_PARAMS.hunter;
  // V2.0 Block 1.3: umbra carried-bonus pulse
  applyUmbraCarriedBonus(hero);
  const cands = [];
  for (let r = 0; r < SIZE; r++) if (grid[r].some(c => c !== null)) cands.push(r);
  if (!cands.length) { dealDamage(cfg.baseDmg, true); return; }
  cands.sort(() => Math.random() - 0.5);
  const picks = cands.slice(0, Math.min(cfg.rows, cands.length));
  const cellEls = document.querySelectorAll('.grid .cell');
  let burned = 0;
  const burnedStihiyas = [];
  const burnedKeys = []; // V2.0 Block 1.1: for charged-ult bonus
  for (const r of picks) for (let c = 0; c < SIZE; c++) {
    const v = grid[r][c];
    if (v) {
      cellEls[r*SIZE+c].classList.add('burning');
      burned++;
      burnedKeys.push(r + '_' + c);
      if (!v.startsWith('void_')) burnedStihiyas.push(v);
    }
  }
  vibrate([80, 40, 80, 40, 80]);
  await sleep(700);
  for (const r of picks) for (let c = 0; c < SIZE; c++) grid[r][c] = null;
  ctx.burnedCount = burned;
  ctx.burnedStihiyas = burnedStihiyas;
  ctx.burnedKeys = burnedKeys;
  dealDamage(cfg.baseDmg + burned * cfg.perCube, true);
}

// MAGE: heal to full
async function applyMageUlt(hero, ctx) {
  hp = currentMaxHP;
  vibrate([50, 30, 50, 30, 50]);
}

// TANK: +3 shields (cap MAX_SHIELD+2, extended by golem maxShieldBonus)
async function applyTankUlt(hero, ctx) {
  const cfg = ROLE_ULT_PARAMS.tank;
  // 2026-04-29 — Block 6.5 DEBT-5 close: VOIDPRIESTESS `tank_halved` seal
  // halves Tank's shield generation per spec §2.4 ("Tank shields halved 3
  // turns"). Replaces the prior pragmatic dmg-halve workaround.
  let _shieldGain = cfg.shields;
  try {
    if (typeof _ch3HasDebuff === 'function' && _ch3HasDebuff('tank_halved')) {
      _shieldGain = Math.floor(cfg.shields / 2);
      try { flashText('✦ TANK SHIELDS HALVED', '#C0A6DF'); } catch (e) {}
    }
  } catch (e) {}
  shieldCount = Math.min(MAX_SHIELD + 2 + maxShieldBonus, shieldCount + _shieldGain);
  vibrate([60, 40, 60]);
  // 2026-05-02 — COMBAT v2.1 P3 §3.4: T3 Tank ULT redirect to AEGIS PROTOCOL.
  // Renamed effect — for the next 3 (or 4 for THUNDERBEAT/AEGIS-spark) turns,
  // ALL incoming damage routes to Pressure (zero HP loss). Shields still gained
  // above (T0/T1/T2 baseline preserved per spec — T3 STACKS on top).
  try {
    const tier = (hero && typeof heroUpgrades !== 'undefined' && heroUpgrades[hero.id]) || 0;
    if (tier >= 3 && typeof activateAegisProtocol === 'function') {
      activateAegisProtocol(hero.id);
    }
  } catch (e) { console.warn('[Tank T3 ULT] AEGIS PROTOCOL activation failed:', e); }
}

// CAPTAIN: convert up to 10 non-matching non-void cells to hero's stihiya
// V2.0 Block 3.2: WARBAND — captainConversionBoost 1.0→1.5 scales 10 → 15 cells
async function applyCaptainUlt(hero, ctx) {
  const cfg = ROLE_ULT_PARAMS.captain;
  const targets = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const v = grid[r][c];
    if (v && !v.startsWith('void_') && v !== hero.stihiya) targets.push([r, c]);
  }
  if (!targets.length) return;
  targets.sort(() => Math.random() - 0.5);
  const convertCount = Math.floor(cfg.convert * captainConversionBoost);
  const picks = targets.slice(0, convertCount);
  const cellEls = document.querySelectorAll('.grid .cell');
  // Flash 'burning' briefly then mutate — gives visual pop before re-render
  for (const [r, c] of picks) cellEls[r*SIZE+c].classList.add('burning');
  await sleep(300);
  for (const [r, c] of picks) {
    grid[r][c] = hero.stihiya;
    // V2.0 Block 1.2: captain solar conversion can proc radiant
    if (hero.stihiya === 'solar') maybeMarkRadiant(r, c);
  }
  render();
  vibrate([40, 20, 40, 20, 40]);
  ctx.convertedCount = picks.length;
  // PHASE 4 BLOCK 1 — chronograph CAPTAIN beat. First captain ULT during FTUE
  // converts cells → highlight the grid so the player sees what was dropped.
  // 380ms delay lets the conversion + render settle visually first (give the
  // player a beat to perceive the new charged cells before we explain).
  try {
    if (typeof maybeChronoBeat === 'function' && picks.length > 0) {
      setTimeout(() => {
        const grid = document.getElementById('grid');
        maybeChronoBeat('captain', { targetEl: grid });
      }, 380);
    }
  } catch (e) {}
}

// Stihiya bonus — applied AFTER the base role effect completes
async function applyStihiyaUltBonus(hero, ctx) {
  const bonus = STIHIYA_ULT_BONUS[hero.stihiya];
  if (!bonus) return;
  if (bonus.burnDmgPerCell && ctx.burnedCount > 0) {
    // V2.0 Block 1.1: charged cells burned in ULT give extra EMBER_ULT_CHARGED_BONUS per cell
    let chargedBurned = 0;
    if (ctx.burnedKeys) for (const k of ctx.burnedKeys) if (chargedCells.has(k)) chargedBurned++;
    dealDamage(ctx.burnedCount * bonus.burnDmgPerCell + chargedBurned * EMBER_ULT_CHARGED_BONUS, true);
  }
  if (bonus.freeze) {
    attackCountdown += bonus.freeze;
    onFreezeApplied(bonus.freeze); // V2.0 Block 1.1: chain proc
    vibrate([40, 40, 40]);
  }
  if (bonus.heal) {
    hp = Math.min(currentMaxHP, hp + bonus.heal);
  }
  if (bonus.shield) {
    shieldCount = Math.min(MAX_SHIELD + 2 + maxShieldBonus, shieldCount + bonus.shield);
  }
  if (bonus.umbraCharge) {
    const cap = (currentUltThreshold && currentUltThreshold.umbra) || ULT_THRESHOLD.umbra || 10;
    ultCharges.umbra = Math.min(cap, ultCharges.umbra + bonus.umbraCharge);
  }
}

// Main dispatcher — `this` is set to hero by hero.ult() invocation pattern.
// Reads hero.newRole to pick template, then applies stihiya bonus uniformly.
async function ultRoleDispatch() {
  const hero = this;
  const role = hero && hero.newRole;
  const ctx = { burnedCount: 0, burnedStihiyas: [], convertedCount: 0 };
  // 2026-04-27 — Ch3 ARCHIVAL ETERNAL "ults_disabled" seal — block ULT firing.
  try {
    if (typeof _ch3HasSeal === 'function' && _ch3HasSeal('ults_disabled')) {
      try { flashText('📜 ULTS SEALED', '#E8D88A'); } catch (e) {}
      return;
    }
  } catch (e) {}
  // 2026-05-02 — COMBAT v2.1 P4 PR #4.C §4.6: hypnotist silence reactivity.
  // squadSilencedTurns set to 2 by hypnotist_p2_p3; blocks all hero ULTs
  // until counter ticks to 0 in tickStaggerState.
  try {
    if (typeof squadSilencedTurns === 'number' && squadSilencedTurns > 0) {
      try { flashText('🤫 SILENCED · NO ULT', '#9B59D6'); } catch (e) {}
      return;
    }
  } catch (e) {}
  // V3.0 Phase 5 Block 5.1: mission tracking — one increment per ult fire
  try { if (typeof trackMissionEvent === 'function') trackMissionEvent('ult_fired'); } catch (e) {}
  // PHASE 3 BLOCK 3 — Death Flashback log (hero ULT fire)
  try {
    if (hero && hero.name) {
      const _ultLabel = (hero.ultText || '').split(':')[0].trim() || 'ULT';
      logBattleEvent('ult', hero.name + ' · ' + _ultLabel.toUpperCase(), '', STIHIYA_COLORS[hero.stihiya] || '#FFB84A');
    }
  } catch (e) {}
  // V2.0 Stage 5 Block 5.1: track ULT fires for post-battle XP (+2 per hero who fired ULT)
  if (hero) hero._ultFiredThisBattle = true;
  // 2026-05-02 — COMBAT v2.1 P2 §3.10.4: hero ULT adds Pressure (+15).
  // Fires ONCE per ULT regardless of multi-line clear chain that may follow
  // (line-clear pressure handles the chain). Stacks with INFERNO/DETONATE
  // when the same ULT triggers them — intentional per spec §11.2 (mastery
  // moments are mastery moments).
  try { addPressure(PRESSURE_GAIN.hero_ult, 'hero_ult'); } catch (e) {}
  // 2026-05-02 — COMBAT v2.1 P3 §3.5 (PR #3.F): T3 Captain universal mark.
  // If this hero is the marked one and the Captain is T3+, the mark consumes
  // here and applies a +30% damage burst to the ULT path (folded into the
  // _passiveDmgContext slot used by applyXxxUlt → dealDamage).
  try {
    if (typeof applyCaptainMarkOnUlt === 'function') {
      const mark = applyCaptainMarkOnUlt(hero);
      if (mark) {
        if (typeof _passiveDmgContext === 'number') {
          _passiveDmgContext *= mark.dmgMult;
        }
        try { flashText('⚐ MARKED · ULT +' + Math.round((mark.dmgMult - 1) * 100) + '%', '#FFD53D'); } catch (e) {}
      }
    }
  } catch (e) { console.warn('[Captain Mark on ULT] failed:', e); }
  // V2.0 Stage 5 Block 5.1: firing-hero pointer for kill-shot attribution in dealDamage
  const _prevFiringHero = _currentFiringHero;
  _currentFiringHero = hero;
  try {
    if (role === 'warrior')      await applyWarriorUlt(hero, ctx);
    else if (role === 'hunter')  await applyHunterUlt(hero, ctx);
    else if (role === 'mage')    await applyMageUlt(hero, ctx);
    else if (role === 'tank') {
      // 2026-04-27 — AD.2 — Tank ULT mode selector (BLOCKSWORN_ANTI_DEADLOCK §4).
      // Tank gets a choice modal between Normal ULT and Emergency Mode (1/battle).
      // Modal only shown if Emergency is still available; otherwise Normal ULT
      // fires immediately (no extra friction once 1/battle is exhausted).
      // No cancel option — charge is already consumed upstream.
      const useEmergency = await maybeShowTankUltModeModal(hero);
      if (useEmergency === 'emergency') {
        await applyTankEmergencyUlt(hero, ctx);
      } else {
        await applyTankUlt(hero, ctx);
      }
    }
    else if (role === 'captain') await applyCaptainUlt(hero, ctx);
    // (unknown role → nothing; stihiya bonus still fires as a baseline effect)
    await applyStihiyaUltBonus(hero, ctx);
    // V2.0 Block 4.1: per-hero ULT signature — extends role template (optional field on hero)
    if (hero && typeof hero.ultSignature === 'function') {
      await hero.ultSignature.call(hero, ctx);
    }
    // V2.0 Stage 5 Block 5.1: per-hero ULT tier delta — runs AFTER ultSignature, passes tier + ctx.
    // Delta function receives (ctx, tier). Populated per-hero in Blocks 5.2–5.6.
    if (hero && typeof hero.ultTierDelta === 'function' && (hero.tier || 0) > 0) {
      try {
        await hero.ultTierDelta.call(hero, ctx, hero.tier);
      } catch (e) {
        console.warn('ultTierDelta error for ' + hero.id + ':', e);
      }
    }
    // V2.0 Block 1.3: umbra ULT self-feeding loop — drop cells + reset carried bonus
    if (hero && hero.stihiya === 'umbra') onUmbraUltFired(hero);
    // V2.0 Stage 5 Block 5.5: VALERIUS T3 valeriusRadiantUntilUlt — window persists until first solar ULT fires
    if (hero && hero.stihiya === 'solar' && valeriusRadiantUntilUlt && valeriusRadiantTurnOpen > 0) {
      valeriusRadiantTurnOpen = 0;
      flashText('RADIANT WARD · CONSUMED', STIHIYA_COLORS.solar);
    }
    // V2.0 Block 3.2: WARBAND captain-ULT hooks — placed BEFORE Encore so rock_captain + Encore
    // doesn't double-grant charge/window (one captain-ULT event = one warband trigger).
    if (hero && hero.newRole === 'captain' && warbandUltShareActive) {
      const warriors = HERO_DECK.filter(h => h && h.newRole === 'warrior');
      for (const w of warriors) {
        const wsCap = (currentUltThreshold && currentUltThreshold[w.stihiya]) || ULT_THRESHOLD[w.stihiya] || 12;
        ultCharges[w.stihiya] = Math.min(wsCap, (ultCharges[w.stihiya] || 0) + 3);
        // DEBT-014 — feed per-hero charge for WARBAND warrior proc.
        addChargeToHeroesOfElement(w.stihiya, 3 * ELEMENT_POOL_TO_HERO_CHARGE);
      }
      if (warriors.length > 0) flashText('WARBAND: +3 to warriors', '#FFD53D');
    }
    if (hero && hero.newRole === 'captain' && warbandStrikeActive) {
      warbandStrikeWindow = 2;  // 2 placements of +50% warrior dmg
      flashText('WARBAND STRIKE', '#FFD53D');
    }
    // V2.0 Block 2.5: ROCK ENCORE — first umbra ULT of battle fires twice (second cast is free).
    // Full mechanics re-execute: role effect, stihiya bonus, drops, carried consumption.
    // During phoenix immunity, Encore still fires (raw ULT mechanics execute; motif multipliers gated as usual).
    if (encoreActive && !encoreUsed && hero && hero.stihiya === 'umbra') {
      encoreUsed = true;
      flashRacePassiveOnce('rock3', 'ENCORE — ULT ×2', STIHIYA_COLORS.umbra);
      vibrate([80, 40, 80, 40, 80, 40, 120]);
      const ctx2 = { burnedCount: 0, burnedStihiyas: [], convertedCount: 0 };
      if (role === 'warrior')      await applyWarriorUlt(hero, ctx2);
      else if (role === 'hunter')  await applyHunterUlt(hero, ctx2);
      else if (role === 'mage')    await applyMageUlt(hero, ctx2);
      else if (role === 'tank')    await applyTankUlt(hero, ctx2);
      else if (role === 'captain') await applyCaptainUlt(hero, ctx2);
      await applyStihiyaUltBonus(hero, ctx2);
      // V2.0 Block 4.1: per-hero signature also fires on Encore re-run (mirrors stihiya bonus pattern)
      if (typeof hero.ultSignature === 'function') {
        await hero.ultSignature.call(hero, ctx2);
      }
      // V2.0 Stage 5 Block 5.1: tier delta also re-runs on Encore (parity with ultSignature)
      if (typeof hero.ultTierDelta === 'function' && (hero.tier || 0) > 0) {
        try {
          await hero.ultTierDelta.call(hero, ctx2, hero.tier);
        } catch (e) {
          console.warn('ultTierDelta error (encore re-run) for ' + hero.id + ':', e);
        }
      }
      onUmbraUltFired(hero);
    }
    // 2026-04-29 — Block 6.5 DEBT-4 — Root-of-Nothing wither ULT-reset.
    // Spec §2.5: "Player must STRATEGICALLY clear neighbors to break wither
    // stack OR use ULTs to reset". Each ULT cast clears ALL standing withers
    // (placement-driven row/col clears already handle the neighbor escape).
    // Runs once per ULT — placed AFTER the Encore re-run block so it doesn't
    // double-fire when Encore re-casts the ULT.
    try {
      if (typeof _ch3BossId !== 'undefined' && _ch3BossId === 'root'
          && _ch3State && Array.isArray(_ch3State.witherCells) && _ch3State.witherCells.length > 0) {
        let cleared = 0;
        for (const w of _ch3State.witherCells) {
          if (grid[w.r] && grid[w.r][w.c] === 'void_grove') {
            grid[w.r][w.c] = null;
            cleared++;
          }
        }
        if (cleared > 0) {
          _ch3State.witherCells = [];
          try { flashText('🌱 ULT RESET · WITHER ×' + cleared, '#A8D89C'); } catch (e) {}
          try { render(); } catch (e) {}
        }
      }
    } catch (e) {}
  } finally {
    // Stage 5 Block 5.1: restore firing-hero pointer to previous state (supports nested fires if any)
    _currentFiringHero = _prevFiringHero;
  }
}

// ===== V2.0 STAGE 4 BLOCK 4.1 — EMBER HERO SIGNATURES =====
// Per-hero fire functions replace generic role/element fires for the 10 ember heroes.
// All damage flows through dealDamage which auto-applies context multipliers (Warband Strike,
// Hunter Mark, Grommar Rally, Pack Mark) — no manual applyFireDamageMultipliers wrapping needed.

// PLACEHOLDER HEROES (firePlaceholder / ultPlaceholder) removed 2026-04-28 along
// with the Clockwork roster entries — they were Phase-2 scaffolding only.

// --- ORC SIGNATURES ---

// BLACKFANG (orc hunter) — PACK LEAD: row burn, sets Pack Mark if any charged in row

// THARA (orc warrior) — RECKLESS CHARGE: 220 dmg + Rage Chain (+220 if armed AND below max HP)
// V2.0 Stage 5 Block 5.2 tier reads: tharaBaseDmg (T1 250), tharaRageChainLimit (T1 2), bossDmgBonus (T3 +1-10)

// URZOG (orc mage) — METEOR BREW: 2 cells × 120 dmg + free cascade if charged hit

// SKARN (orc captain) — PYRE CONVERT: clear 3 cells × 60 dmg + spawn 1 charged ember
// V2.0 Stage 5 Block 5.2 tier reads: skarnPyreCount (T1 2 converts), skarnCascadeOnConvert (T2)

// GROMMAR (orc tank) — WARCHIEF'S CALL: +1 shield + 100 dmg + +2 ULT charge to random orc teammate
// V2.0 Stage 5 Block 5.2 tier reads: grommarBaseDmg (T1 120), grommarChargeBonus (T1 +3), grommarChargeAllOrcs (T2)

// --- PIRATE SIGNATURES ---

// Universal helper — spawn N ember cells in random empties AND mark each as
// charged (chargedCells). Used by THORGAR (Fire Warrior CREATE per §2.4
// "Создаёт ember-charged клетки на линии фигуры. Источник цепочки").
// Capped by EMBER_CHARGED_CAP. Returns count actually placed.
async function _spawnEmberCharged(maxCount) {
  // 2026-04-28 — Pirate ability visibility hardening (BUG #1 — "не появлялись клетки").
  // Three-layer protection per user request:
  //   A) Fizzle feedback — flashText explains why if nothing spawned (cap / no room).
  //   B) Guaranteed-min fallback — when grid is full, displace ONE non-ember non-void
  //      cell so the ability always has visible impact (player's main element is ember
  //      anyway when this is called via pirate fire/ULT).
  //   C) Console diagnostics — every call logs inputs + outcome so [BLOCKSWORN] tag
  //      grep on devtools tells you exactly what happened.
  console.log('[BLOCKSWORN][EMBER_SPAWN] called maxCount=' + maxCount + ' charged=' + chargedCells.size + '/' + EMBER_CHARGED_CAP);
  if (!MOTIFS_ENABLED.ember) {
    console.log('[BLOCKSWORN][EMBER_SPAWN] aborted: motif disabled');
    return 0;
  }
  if (!maxCount || maxCount <= 0) return 0;
  // Layer A: cap check produces a visible fizzle so the player understands.
  const slot = (typeof EMBER_CHARGED_CAP === 'number') ? Math.max(0, EMBER_CHARGED_CAP - chargedCells.size) : maxCount;
  if (slot <= 0) {
    console.log('[BLOCKSWORN][EMBER_SPAWN] aborted: charged cap full');
    try { flashText('CHARGED CAP REACHED', '#888'); } catch(e){}
    return 0;
  }
  const empties = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (grid[r][c] === null) empties.push([r, c]);
  }
  let picks;
  let displaced = 0;
  if (empties.length > 0) {
    empties.sort(() => Math.random() - 0.5);
    const room = Math.min(maxCount, empties.length, slot);
    picks = empties.slice(0, room);
  } else {
    // Layer B: grid full — displace one non-ember non-void cell so the ability
    // always produces a visible result. Skipped if every cell is already ember
    // (then there's literally nowhere to put new ember without overwriting same).
    const displaceable = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (v && v !== 'ember' && !v.startsWith('void_')) displaceable.push([r, c]);
    }
    if (displaceable.length === 0) {
      console.log('[BLOCKSWORN][EMBER_SPAWN] aborted: grid full and no displaceable cells');
      try { flashText('GRID FULL — NO ROOM', '#888'); } catch(e){}
      return 0;
    }
    displaceable.sort(() => Math.random() - 0.5);
    picks = [displaceable[0]];
    displaced = 1;
    console.log('[BLOCKSWORN][EMBER_SPAWN] fallback: displacing 1 cell at ' + picks[0][0] + ',' + picks[0][1]);
  }
  const cellEls = document.querySelectorAll('.grid .cell');
  for (const [r, c] of picks) {
    grid[r][c] = 'ember';
    chargedCells.add(r + '_' + c);
    if (cellEls[r * SIZE + c]) cellEls[r * SIZE + c].classList.add('spawning');
  }
  renderChargedVisuals();
  render();
  console.log('[BLOCKSWORN][EMBER_SPAWN] success spawned=' + picks.length + ' displaced=' + displaced);
  return picks.length;
}

// HERO_GRAMMAR §4 [Fire × Warrior] — THORGAR / CLEAVER FORGE
// Spec (§2.4): "Создаёт ember-charged клетки на линии фигуры. Источник цепочки."
// Warrior is a **pure CREATOR** — no damage on fire. Damage flows through Hunter
// (BLACKTOOTH = "Главный damage dealer" per §2.3). THORGAR sows ember-charged
// substrate that EMBERHAND amplifies and BLACKTOOTH detonates. This honors the
// role separation: Warrior = setup, Mage = amplifier, Hunter = finisher.
// Charge cost relative: fastest (combo ≥ 2 fires; cheapest setup per §2.3).
// HOTFIX 2026-04-26b — removed direct damage + cleave per Roman feedback
// "Thorgar до сих пор атакует, а не просто создает клетки". Earlier hotfix
// added FORGE spawn but kept legacy attack/cleave — those diluted the role.
async function fireThorgar(counts) {
  console.log('[BLOCKSWORN][THORGAR] fire (combo) — calling _spawnEmberCharged(3)');
  const created = await _spawnEmberCharged(3);
  // 2026-04-28 — BUG FIX #1 layer A: always show feedback (not just when created>0).
  // _spawnEmberCharged already shows its own fizzle for cap-full / grid-full cases,
  // but a hero-named confirmation makes it clear THIS hero just fired.
  if (created > 0) {
    flashText('CLEAVER FORGE ×' + created, '#FF8B3D');
  } else {
    flashText('CLEAVER FORGE — FIZZLE', '#888');
  }
  vibrate([40, 20, 40]);
}

// HERO_GRAMMAR §4 [Fire × Hunter] — BLACKTOOTH / INFERNO
// Spec: Detonates every charged ember cell at once; damage scales with charged-cell
// count (×3 cap). Charge cost relative: fastest (combo ≥ 2; ULT ~3 placements).
// CONFORMS to spec post-rewrite (TASK #2.2d). Damage = baseDmg × min(charged.length, 3),
// then × emberhandBloomMult (1.5) if EMBERHAND BLOOM window is active.
// Fallback when 0 charged on board: deal flat baseDmg as a "primer shot" so combo-fired
// Hunter never feels wasted (Roman feedback risk).
// VFX: all charged cells get .burning in the same frame (batched) so 12+ simultaneous
// detonations don't stutter; reduced-motion users get the static-burn fallback via the
// existing @media (prefers-reduced-motion: reduce) guard on .cell.charged animation.
// V2.0 Stage 5 Block 5.2 tier deltas (blacktoothBaseDmg, blacktoothShotCount,
// blacktoothMarkBeforeClear) remain dormant in v1 per HERO_GRAMMAR §8 NN #6.
async function fireBlacktooth(counts) {
  const baseDmg = blacktoothBaseDmg;  // T0=180, T1+=210
  // Collect every charged cell that still holds an ember on the grid (defensive against
  // stale entries — chargedCells should already track grid['ember'] only via tickEmberAges).
  const charged = [];
  for (const key of chargedCells) {
    const [r, c] = key.split('_').map(Number);
    if (grid[r] && grid[r][c] === 'ember') charged.push([r, c, key]);
  }

  // Primer-shot fallback: nothing to detonate, but the player committed to firing.
  if (charged.length === 0) {
    flashText('NO TARGETS', '#A07530');
    dealDamage(baseDmg, true);
    vibrate([30, 30, 30]);
    return;
  }

  // Cap at 3× per spec.
  const scale = Math.min(3, charged.length);
  let totalDmg = baseDmg * scale;

  // EMBERHAND BLOOM amplifier — +50% if active (HERO_GRAMMAR §4 [Fire × Mage]).
  const bloomActive = emberhandBloomActive && emberhandBloomDuration > 0;
  if (bloomActive) {
    totalDmg = Math.floor(totalDmg * emberhandBloomMult);
    flashText('+50% INFERNO', '#FFB84A');
  }

  // INFERNO banner only on big detonations to keep the small ones quiet.
  if (charged.length >= 4) flashText('INFERNO! ×' + charged.length, '#FF8B3D');

  // Batched VFX: stamp .burning on all charged cells in the same frame.
  const cellEls = document.querySelectorAll('.grid .cell');
  for (const [r, c] of charged) {
    cellEls[r * SIZE + c].classList.add('burning');
  }
  await sleep(300);

  // Clear cells + drop charged tracking, all at once.
  for (const [r, c, key] of charged) {
    grid[r][c] = null;
    chargedCells.delete(key);
  }
  renderChargedVisuals();
  render();

  dealDamage(totalDmg, true);
  // Stronger haptic on bigger detonations.
  vibrate(charged.length >= 4 ? [80, 40, 80, 40, 120] : [60, 30, 60]);
}

// HERO_GRAMMAR §4 [Fire × Mage] — EMBERHAND / EMBER BLOOM
// Spec: Every charged cell on the board gains +50% detonation damage; ULT: full squad
// heal + +1 ULT charge to all. Charge cost relative: medium-slow (period ~12).
// CONFORMS to spec post-rewrite (TASK #2.2d). Activates the 3-placement BLOOM amplifier
// window — BLACKTOOTH INFERNO (and any future Hunter detonator) within the window
// multiplies its detonation damage by emberhandBloomMult (1.5).
// AMPLIFIER role verb: this fire creates no cells and deals no direct damage; it
// magnifies the next detonation. The +50% INFERNO floating text fires from BLACKTOOTH
// at consume time so the player sees the chain (BLOOM → INFERNO+50% → cascade).
// V2.0 Stage 5 Block 5.2 tier deltas (emberhandSpawnCount, emberhandSpawnCharged) are
// now dead stores — deferred Phase 6 will rewire to extend window / boost mult.
async function fireEmberhand() {
  // HOTFIX B3.6 — Mage AMPLIFIER per MASTER_PLAN_V3 §2.4 [Fire × Mage].
  // Plan: "Конвертит соседей в ember-charged. Множит/распространяет существующие.
  // NO new state — only amplifies."
  // Implementation: scan grid for charged ember cells, look at their orthogonal
  // neighbors that are also ember but NOT charged, and convert those neighbors to
  // charged. Pure spreading — no new ember cells spawned, only existing ember
  // cells get their state upgraded. The +50% BLOOM window from B0/2.2d stacks
  // on top (BLACKTOOTH INFERNO honors emberhandBloomMult).
  const toCharge = new Set();
  const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const key of chargedCells) {
    const [r, c] = key.split('_').map(Number);
    for (const [dr, dc] of neighbors) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
      const nkey = nr + '_' + nc;
      if (grid[nr][nc] === 'ember' && !chargedCells.has(nkey)) toCharge.add(nkey);
    }
  }
  let converted = 0;
  for (const key of toCharge) {
    if (chargedCells.size >= EMBER_CHARGED_CAP) break;
    chargedCells.add(key);
    converted++;
  }
  // 2026-04-28 — BUG FIX #1 layer B+C: guaranteed-min fallback for EMBERHAND.
  // EMBERHAND was AMPLIFIER-only — if no charged ember existed yet, it had nothing
  // to spread to and produced no visible board change (only invisible BLOOM%
  // window). User report: "не поджигал клетки" — exactly this scenario.
  // Fallback: when 0 cells got converted, seed 1 fresh charged ember via
  // _spawnEmberCharged so the ability always has visible impact.
  let fallbackSpawn = 0;
  console.log('[BLOCKSWORN][EMBER_BLOOM] called chargedBefore=' + (chargedCells.size - converted) + ' converted=' + converted + ' toChargeCandidates=' + toCharge.size);
  if (converted === 0 && chargedCells.size < EMBER_CHARGED_CAP) {
    fallbackSpawn = await _spawnEmberCharged(1);
    console.log('[BLOCKSWORN][EMBER_BLOOM] fallback _spawnEmberCharged returned ' + fallbackSpawn);
  }
  // BLOOM amplifier window — unchanged from B0/2.2d. Stacks with the conversion.
  // 2026-04-27 — Block H.9b — VERDANT MASTERY (T2): window 3→5 + mult 1.5→1.75.
  emberhandBloomActive   = true;
  const _t2Window = _t2Bonus('pirate_mage', 'mageWindow');
  emberhandBloomDuration = (_t2Window != null) ? _t2Window : EMBERHAND_BLOOM_TURNS;
  const _t2Mult = _t2Bonus('pirate_mage', 'mageMult');
  emberhandBloomMult = (_t2Mult != null) ? _t2Mult : 1.5;
  const _bloomPct = Math.round((emberhandBloomMult - 1) * 100);
  if (converted > 0) {
    flashText('EMBER BLOOM +' + _bloomPct + '% · SPREAD ×' + converted, '#FFB84A');
  } else if (fallbackSpawn > 0) {
    flashText('EMBER BLOOM +' + _bloomPct + '% · SEED ×1', '#FFB84A');
  } else {
    flashText('EMBER BLOOM +' + _bloomPct + '% · NO TARGETS', '#FFB84A');
  }
  vibrate([50, 30, 50]);
  renderChargedVisuals();
}

// HERO_GRAMMAR §4 [Fire × Tank] — IRONBELLY / FIREBRAND
// Spec: Passive +1 shield per ember clear; ULT: +3 shields + seeds 3 charged ember cells.
// Charge cost relative: slowest (no minCombo gate; ULT ~5 placements).
// AUDIT (docs/PHASE_2_PIRATES_AUDIT.md): EXTENDS spec — current adds active +1 shield on
// fire (vs passive per-ember-clear) plus direct dmg + active pre-charging. PROTECTOR role
// verb preserved. Documented as intentional extension; ships as-is for v1.
// IRONBELLY (pirate tank) — FIREBRAND: +1 shield + 160 dmg + mark 2 non-charged ember as charged
// V2.0 Stage 5 Block 5.2 tier reads: ironbellyBaseDmg (T1 180), ironbellyChargedMarks (T1 3)
async function fireIronbelly(counts) {
  const shieldCap = MAX_SHIELD + 2 + maxShieldBonus;
  if (shieldCount < shieldCap) shieldCount++;
  dealDamage(ironbellyBaseDmg, true);  // T0=160, T1+=180
  // Signature: pre-age N random non-charged ember cells (T0=2, T1+=3)
  const ember = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (grid[r][c] === 'ember' && !chargedCells.has(r + '_' + c)) ember.push([r, c]);
  }
  ember.sort(() => Math.random() - 0.5);
  const picks = ember.slice(0, Math.min(ironbellyChargedMarks, ember.length));
  let added = 0;
  for (const [r, c] of picks) {
    if (chargedCells.size < EMBER_CHARGED_CAP) {
      chargedCells.add(r + '_' + c);
      added++;
    }
  }
  if (added > 0) renderChargedVisuals();
  vibrate([50, 30, 50]);
}

// HERO_GRAMMAR §4 [Fire × Captain] — CRIMSON / CRIMSON GAMBIT
// Spec: Race-buff scales pirate squad damage (+5/+15/+30%); element-buff weights drops
// +25% toward ember (fixed); ULT seeds 10 charged cells with 50% spawn bias.
// Charge cost relative: medium (period ~10).
// IMPLEMENTATION: dual buff lives in calcSynergyState (§6) → captainDual_* mirrored
// globals. fire body below remains the active board effect (cell conversion + cascade).
// CRIMSON (pirate captain) — CAPTAIN'S GAMBIT: convert 2 cells to ember, free cascade if neighbors charged
async function fireCrimson() {
  const hero = this;
  if (!hero || !hero.stihiya) return;
  // V2.0 Stage 5 Block 5.2: crimsonConvertCount — T0=2, T1+=3. Warband boost applies on top.
  const convertCount = Math.floor(crimsonConvertCount * captainConversionBoost);
  const targets = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const v = grid[r][c];
    if (v && !v.startsWith('void_') && v !== hero.stihiya) targets.push([r, c]);
  }
  if (targets.length > 0) {
    targets.sort(() => Math.random() - 0.5);
    const picks = targets.slice(0, convertCount);
    const cellEls = document.querySelectorAll('.grid .cell');
    for (const [r, c] of picks) cellEls[r * SIZE + c].classList.add('burning');
    await sleep(250);
    for (const [r, c] of picks) {
      grid[r][c] = hero.stihiya;
      // Signature: if ANY neighbor is charged ember, trigger cascade from THAT neighbor
      const neighbors = [[-1,0],[1,0],[0,-1],[0,1]];
      for (const [dr, dc] of neighbors) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && chargedCells.has(nr + '_' + nc)) {
          applyCascade(nr + '_' + nc);
          break;  // one cascade per converted cell
        }
      }
    }
    render();
    renderChargedVisuals();
  }
  vibrate([25, 25, 25]);
}

// ===== ULT TWISTS — extend role template, called via ultSignature in ultRoleDispatch =====

// BLACKFANG — LEAD THE VOLLEY: extra row burn at HP=1 (+desperate shot bonus dmg)
// V2.0 Stage 5 Block 5.2: T1+ extends eligibility to HP≤2 (reads hero.tier via `this`)

// THARA — UNBROKEN SIEGE: +200 bonus damage at HP=1
// V2.0 Stage 5 Block 5.2: T1+ extends eligibility to HP≤2 (reads hero.tier via `this`)

// URZOG — MENDING METEORS: spawn 3 charged ember cells on empty post-heal

// SKARN — BURNING DOMINION: 30% of converted cells spawn charged
// V2.0 Stage 5 Block 5.2: reads skarnChargedRate (T1 0.40)

// GROMMAR — RALLY AEGIS: open 2-placement +100% warrior/hunter dmg window
// V2.0 Stage 5 Block 5.2: ultDeltaGrommar sets grommarRallyWindow=3 at T1+ BEFORE this twist runs —
// so we respect the tier-set window (don't overwrite). T0 falls through to 2.

// HERO_GRAMMAR §4 [Fire × Warrior] — THORGAR / EMBER FORGE ULT
// Spec §9 (Warrior ULT — board CREATE): "spawns 3-5 charged ember cells in
// random positions". Pure CREATOR ULT — no damage, no burn (handled by
// applyWarriorUlt v1-warrior gate). This twist spawns the base CREATE +
// FLEET bonus when 5-pirate race-pure synergy is active.
// 2026-04-27 GRAMMAR HOTFIX: replaced burnRandomCells with _spawnEmberCharged.
async function ultTwistThorgar(ctx) {
  console.log('[BLOCKSWORN][THORGAR] ULT — calling _spawnEmberCharged(5)');
  // Base CREATE — 5 ember-charged cells (high end of plan §9 range).
  const baseSpawn = await _spawnEmberCharged(5);
  if (baseSpawn > 0) {
    flashText('EMBER FORGE ULT ×' + baseSpawn, '#FF8B3D');
  } else {
    flashText('EMBER FORGE — FIZZLE', '#888');
  }
  // FLEET bonus — 5+ pirates or T2+ thorgarFleetSiegeAlways → bonus ember.
  const pirateCount = HERO_DECK.filter(h => h && h.race === 'pirate').length;
  const gate = thorgarFleetSiegeAlways || pirateCount >= 5;
  if (gate) {
    const extras = Math.max(0, thorgarFleetSiegeBurns - 10);
    if (extras > 0) {
      const bonus = await _spawnEmberCharged(extras);
      if (bonus > 0) flashText('FLEET FORGE +' + bonus, '#FFA500');
    }
  }
}

// HERO_GRAMMAR §4 [Fire × Hunter] — BLACKTOOTH / VOLLEY ULT signature
// Spec ULT pattern (Hunter): VOLLEY — multi-line burst; the cascade trigger.
// CONFORMS to spec post-rewrite (TASK #2.2d, Option A — WILDFIRE bonus removed).
// Rationale: the legacy WILDFIRE bonus rewarded a single random burnt cell that happened
// to be charged. Post-rewrite, fireBlacktooth ALREADY detonates every charged cell at
// once (the DETONATOR contract); piling a +100/+150 ULT bonus on top of that double-
// counted the same identity. The generic hunter VOLLEY template (multi-line burst) is
// now the entire Hunter ULT — clean and on-spec.
// V2.0 Stage 5 Block 5.2 tier deltas (blacktoothChargedBonus, T3 +200 inferno) become
// dead stores in v1; Phase 6 may rewire them when the tier system goes live.
async function ultTwistBlacktooth(ctx) {
  // HOTFIX B3.4 (Roman spec): Hunter ULT detonates ALL ember cells on the board
  // (not just charged). EMBERHAND BLOOM amp window stacks on top.
  const ampMult = (emberhandBloomActive && emberhandBloomDuration > 0) ? emberhandBloomMult : 1.0;
  await _hunterUltDetonateAllCells('ember', 180, ampMult, '#FF8B3D', 'INFERNO ULT');
}

// HERO_GRAMMAR §4 [Fire × Mage] — EMBERHAND / MENDING ULT signature
// Spec ULT pattern (Mage): MENDING — full heal or board-state extension; restores the engine.
// CONFORMS to spec post-rewrite (TASK #2.2d): full squad heal (HP → currentMaxHP)
// AND +1 ULT charge to every squad member's stihiya. Both halves now present.
async function ultTwistEmberhand(ctx) {
  // Full squad heal — HP restored to currentMaxHP (single shared HP pool in v1).
  if (hp < currentMaxHP) hp = currentMaxHP;
  // +1 ULT charge to each squad member's stihiya (clamped to per-element threshold).
  for (const h of HERO_DECK) {
    if (!h) continue;
    const s = h.stihiya;
    const cap = (currentUltThreshold && currentUltThreshold[s]) || ULT_THRESHOLD[s] || 12;
    ultCharges[s] = Math.min(cap, (ultCharges[s] || 0) + 1);
    // DEBT-014 — feed per-hero charge for FLOOD MENDING proc.
    addChargeToHeroesOfElement(s, ELEMENT_POOL_TO_HERO_CHARGE);
  }
  flashText('FLOOD MENDING', '#FF6600');
}

// HERO_GRAMMAR §4 [Fire × Tank] — IRONBELLY / AEGIS ULT signature
// Spec ULT pattern (Tank): AEGIS — large shield + element seed; the survival pivot.
// Spec cell ULT: +3 shields + seeds 3 charged ember cells. Current matches: shields via
// generic applyTankUlt + 3–5 charged ember seed via this twist (T0=3, T1+=4, T3+=5).
// IRONBELLY — CHARGED AEGIS: spawn 3 charged ember on empty cells after shields applied
// V2.0 Stage 5 Block 5.2: T1+ ironbellyUltChargedCount=4, T3+=5 (via ultDeltaIronbelly runtime)
async function ultTwistIronbelly(ctx) {
  const empty = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (!grid[r][c]) empty.push([r, c]);
  }
  empty.sort(() => Math.random() - 0.5);
  const picks = empty.slice(0, ironbellyUltChargedCount);  // T0=3, T1+=4, T3+=5
  for (const [r, c] of picks) {
    grid[r][c] = 'ember';
    if (chargedCells.size < EMBER_CHARGED_CAP) chargedCells.add(r + '_' + c);
  }
  if (picks.length > 0) { render(); renderChargedVisuals(); flashText('CHARGED AEGIS ×' + picks.length, '#FFAA00'); }
}

// HERO_GRAMMAR §4 [Fire × Captain] — CRIMSON / DOMINION ULT signature
// §5 matrix: "DOMINION ULT spawns ember field" — board-wide ember spawn (mass
// cell creation, not just charging existing). 2-stage:
//   1. Charge a tier-scoped fraction of cells already converted to ember by
//      applyCaptainUlt (50%/60% per crimsonChargedRate).
//   2. NEW (2026-04-26): spawn an extra ember field — 4 fresh ember-charged
//      cells in random empties via _spawnEmberCharged. This delivers the
//      "ember field" half of the matrix spec. Pre-fix ULT only charged
//      existing cells (failed §5 "field" mechanic).
// Persistent dual buff (race-scaling dmg + fixed +25% drop) lives in calcSynergyState.
// V2.0 Stage 5 Block 5.2: reads crimsonChargedRate (T1 0.60)
async function ultTwistCrimson(ctx) {
  console.log('[BLOCKSWORN][CRIMSON] ULT — convertedCount=' + (ctx.convertedCount || 0));
  // Stage 1 — charge existing ember from converted set.
  if (ctx.convertedCount) {
    const cands = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 'ember' && !chargedCells.has(r + '_' + c)) cands.push(r + '_' + c);
    }
    cands.sort(() => Math.random() - 0.5);
    const target = Math.floor(ctx.convertedCount * crimsonChargedRate);  // T0=0.50, T1+=0.60
    let added = 0;
    for (let i = 0; i < cands.length && added < target; i++) {
      if (chargedCells.size < EMBER_CHARGED_CAP) {
        chargedCells.add(cands[i]);
        added++;
      }
    }
    if (added > 0) { renderChargedVisuals(); flashText('PIRATE DOMINION ×' + added, '#FFAA00'); }
  }
  // Stage 2 — spawn ember FIELD (matrix §5 mandate). Independent of converted
  // cells: 4 brand-new charged ember cells in empties, capped by EMBER_CHARGED_CAP.
  const fielded = await _spawnEmberCharged(4);
  if (fielded > 0) {
    flashText('EMBER FIELD ×' + fielded, '#FFAA00');
  } else {
    flashText('EMBER FIELD — FIZZLE', '#888');
  }
  console.log('[BLOCKSWORN][CRIMSON] ULT field=' + fielded);
}
// ===== V2.0 STAGE 5 BLOCK 5.2 — EMBER TIER PROGRESSIONS =====
// 10 ember heroes × T1/T2/T3 tier deltas. Each delta is dual-purpose:
//   - Init phase (counts === null): set tier-scoped global flags based on hero.tier
//   - Runtime phase (counts !== null): apply per-fire effects
//
// Base fire functions (fireBlackfang etc.) are modified in Phase 2 to read these flags.
// Called from fireHero/ultRoleDispatch AFTER base fire/signature (Block 5.1 framework).

// --- ORC FIRE DELTAS ---

// BLACKFANG — T1 Pack Mark +40% · T2 Pack Mark chains 2 fires · T3 spawn charged on activation

// THARA — T1 dmg 250 + 2 rage chains · T2 auto-arm on boss attack · T3 streak bonus (cap 10)

// URZOG — T1 3 meteors · T2 cascade ALL adjacent · T3 convert adjacent non-ember

// SKARN — T1 convert 2 · T2 cascade on convert · T3 column shuffle chance

// GROMMAR — T1 dmg 120 + charge +3 · T2 charge all orcs · T3 full team charge

// --- PIRATE FIRE DELTAS ---

// THORGAR — T1 dmg 230 · T2 clear 2 ember · T3 40% charged spawn on cleave
async function fireDeltaThorgar(counts, tier) {
  if (tier >= 1) thorgarBaseDmg     = 230;
  if (tier >= 2) thorgarClearCount  = 2;
  if (tier >= 3) thorgarChargedChance = 0.40;
  // Runtime-only: T3 40% chance spawn charged on random ember after cleave
  if (counts !== null && tier >= 3 && Math.random() < thorgarChargedChance) {
    const spawned = spawnCharged(1);
    if (spawned > 0) flashText('CLEAVE SPARK', STIHIYA_COLORS.ember);
  }
}

// BLACKTOOTH — T1 dmg 210 · T2 2 shots · T3 mark charged before clear
async function fireDeltaBlacktooth(counts, tier) {
  if (tier >= 1) blacktoothBaseDmg  = 210;
  if (tier >= 2) blacktoothShotCount = 2;
  if (tier >= 3) blacktoothMarkBeforeClear = true;
}

// EMBERHAND — T1 3 ember spawn · T2 always charged · T3 cascade on fire
async function fireDeltaEmberhand(counts, tier) {
  if (tier >= 1) emberhandSpawnCount   = 3;
  if (tier >= 2) emberhandSpawnCharged = true;
  if (tier >= 3) emberhandCascadeOnFire = true;
  // Runtime-only: T3 trigger 1 cascade on random existing charged cell
  if (counts !== null && tier >= 3 && chargedCells.size > 0) {
    const keys = [...chargedCells];
    const key = keys[Math.floor(Math.random() * keys.length)];
    applyCascade(key);
    flashText('BLOOM CASCADE', STIHIYA_COLORS.ember);
  }
}

// IRONBELLY — T1 dmg 180 + 3 marks · T2 Phoenix immune · T3 +1🛡 at 5-pirate
async function fireDeltaIronbelly(counts, tier) {
  if (tier >= 1) { ironbellyBaseDmg = 180; ironbellyChargedMarks = 3; }
  if (tier >= 2) ironbellyPhoenixImmune = true;
  if (tier >= 3) ironbellyExtraShield   = true;
  // Runtime-only: T3 +1🛡 extra at 5-pirate squad
  if (counts !== null && tier >= 3 && ironbellyExtraShield) {
    const pirates = HERO_DECK.filter(h => h && h.race === 'pirate').length;
    if (pirates >= 5) {
      const cap = MAX_SHIELD + 2 + maxShieldBonus;
      if (shieldCount < cap) {
        shieldCount++;
        flashText('PIRATE BULWARK', STIHIYA_COLORS.ember);
      }
    }
  }
}

// CRIMSON — T1 convert 3 · T2 cascade depth 2 · T3 full team charge
async function fireDeltaCrimson(counts, tier) {
  if (tier >= 1) crimsonConvertCount = 3;
  if (tier >= 2) crimsonCascadeDepth = 2;
  if (tier >= 3) crimsonFullTeamCharge = true;
  // Runtime-only: T3 +1 charge all teammates after convert
  if (counts !== null && tier >= 3 && crimsonFullTeamCharge) {
    for (const h of HERO_DECK) {
      if (!h) continue;
      const cap = (currentUltThreshold && currentUltThreshold[h.stihiya]) || ULT_THRESHOLD[h.stihiya] || 12;
      ultCharges[h.stihiya] = Math.min(cap, (ultCharges[h.stihiya] || 0) + 1);
      // DEBT-014 — feed per-hero charge for CRIMSON GAMBIT proc.
      addChargeToHeroesOfElement(h.stihiya, ELEMENT_POOL_TO_HERO_CHARGE);
    }
    flashText('CRIMSON GAMBIT', STIHIYA_COLORS.ember);
  }
}

// --- ULT DELTAS ---

// BLACKFANG — T1 Volley HP≤2 · T2 burn charged in rows · T3 INFERNO on charged hit

// THARA — T1 Unbroken HP≤2 · T2 +2 burns at low HP · T3 stoneblood bypass

// URZOG — T1 4 charged spawn · T2 chain from fresh charged · T3 squad heal

// SKARN — T1 40% spawn rate · T2 charge per charged/3 · T3 INFERNO at 5+ charged

// GROMMAR — T1 Rally 3 placements · T2 +shield per warrior fire · T3 Rally permanent

// THORGAR — T1 +14 burns at 5-pirate · T2 always 14 · T3 each burnt cascades
async function ultDeltaThorgar(ctx, tier) {
  if (tier >= 1) thorgarFleetSiegeBurns = 14;
  if (tier >= 2) thorgarFleetSiegeAlways = true;
  if (tier >= 3) thorgarBurnCascade     = true;
  // Runtime: T3 trigger cascade on each already-burned key
  if (ctx && tier >= 3 && ctx.burnedKeys) {
    for (const key of ctx.burnedKeys) applyCascade(key);
    if (ctx.burnedKeys.length > 0) flashText('FLEET CASCADE', STIHIYA_COLORS.ember);
  }
}

// BLACKTOOTH — T1 +150 charged bonus · T2 4 volley rows · T3 +200 INFERNO
async function ultDeltaBlacktooth(ctx, tier) {
  if (tier >= 1) blacktoothChargedBonus = 150;
  if (tier >= 2) blacktoothVolleyRows   = 4;
  if (tier >= 3) blacktoothVolleyInferno = true;
  // Runtime: T1 extra +50 vs T0 base (150 vs 100)
  if (ctx && tier >= 1 && ctx.burnedKeys && ctx.burnedKeys.some(k => chargedCells.has(k))) {
    dealDamage(50, true);
  }
  if (ctx && tier >= 3 && ctx.burnedKeys && ctx.burnedKeys.length > 0) {
    dealDamage(200, true);
    flashText('VOLLEY INFERNO +200', '#FF4400');
  }
}

// EMBERHAND — T1 +2 charge all · T2 +1🛡 to all · T3 team passive regen trigger
async function ultDeltaEmberhand(ctx, tier) {
  if (tier >= 1) {
    // +1 extra charge (on top of T0's +1) = +2 total
    for (const h of HERO_DECK) {
      if (!h) continue;
      const cap = (currentUltThreshold && currentUltThreshold[h.stihiya]) || ULT_THRESHOLD[h.stihiya] || 12;
      ultCharges[h.stihiya] = Math.min(cap, (ultCharges[h.stihiya] || 0) + 1);
      // DEBT-014 — feed per-hero charge for FLOOD +1 CHARGE ALL proc.
      addChargeToHeroesOfElement(h.stihiya, ELEMENT_POOL_TO_HERO_CHARGE);
    }
    flashText('FLOOD +1 CHARGE ALL', STIHIYA_COLORS.ember);
  }
  if (tier >= 2) {
    emberhandUltShield = true;
    const cap = MAX_SHIELD + 2 + maxShieldBonus;
    if (shieldCount < cap) {
      shieldCount++;
      flashText('FLOOD SHIELD +1', STIHIYA_COLORS.ember);
    }
  }
  if (tier >= 3) {
    // Trigger team passive regen: +1 HP (shared pool proxy for per-hero heal)
    if (hp < currentMaxHP) {
      hp = Math.min(currentMaxHP, hp + 1);
      flashText('PASSIVE PULSE +1HP', STIHIYA_COLORS.ember);
    }
  }
}

// IRONBELLY — T1 4 charged · T2 +4🛡 + 4 charged · T3 +5 charged + next fire +50%
async function ultDeltaIronbelly(ctx, tier) {
  if (tier >= 1) {
    ironbellyUltChargedCount = 4;
    spawnCharged(1);  // +1 over T0's 3
  }
  if (tier >= 2) {
    ironbellyUltShield = true;
    const cap = MAX_SHIELD + 2 + maxShieldBonus;
    if (shieldCount < cap) shieldCount++;
    flashText('AEGIS +1🛡', STIHIYA_COLORS.ember);
  }
  if (tier >= 3) {
    ironbellyUltChargedCount = 5;
    spawnCharged(1);  // another +1 for 5 total
    ironbellyNextFireBonus = 0.50;
    flashText('CHARGED AEGIS +50%', STIHIYA_COLORS.ember);
  }
}

// CRIMSON — T1 60% charged rate · T2 cascade scan per charged · T3 +200 DOMINION INFERNO
async function ultDeltaCrimson(ctx, tier) {
  if (tier >= 1) crimsonChargedRate = 0.60;
  if (tier >= 2) crimsonCascadeScan = true;
  if (tier >= 3) crimsonDominionInferno = true;
  // Runtime: T2 cascade scan on each charged cell (up to 5)
  if (tier >= 2) {
    const charged = [...chargedCells].slice(0, 5);
    for (const key of charged) applyCascade(key);
    if (charged.length > 0) flashText('CRIMSON SCAN ×' + charged.length, STIHIYA_COLORS.ember);
  }
  if (tier >= 3) {
    // Inferno if any row has 3+ charged
    for (let r = 0; r < SIZE; r++) {
      let rowCharged = 0;
      for (let c = 0; c < SIZE; c++) if (chargedCells.has(r + '_' + c)) rowCharged++;
      if (rowCharged >= 3) {
        dealDamage(200, true);
        flashText('DOMINION INFERNO +200', '#FF4400');
        break;
      }
    }
  }
}

// ===== Block 5.2 init dispatcher — called at battle start to apply tier flags =====
function applyEmberTierFlagsAtBattleInit() {
  for (const hero of HERO_DECK) {
    if (!hero || (hero.tier || 0) === 0) continue;
    if (typeof hero.fireTierDelta === 'function') {
      // Init-phase call: counts=null signals flag-setup only, no runtime effects
      try { hero.fireTierDelta.call(hero, null, hero.tier); } catch (e) {
        console.warn('fireTierDelta init failed for ' + hero.id + ':', e);
      }
    }
    if (typeof hero.ultTierDelta === 'function') {
      try { hero.ultTierDelta.call(hero, null, hero.tier); } catch (e) {
        console.warn('ultTierDelta init failed for ' + hero.id + ':', e);
      }
    }
  }
}
// ===== END Block 5.2 delta functions =====

// ===== V2.0 STAGE 5 BLOCK 5.3 — TIDE TIER PROGRESSIONS =====
// 10 tide heroes × T1/T2/T3 tier deltas. Same dual-purpose pattern as Block 5.2:
//   - Init phase (counts === null): set tier-scoped global flags
//   - Runtime phase (counts !== null): apply per-fire effects
// Note: spec references several variables that don't exist in codebase (MAX_CHAIN, bossArmor,
//       undyingTriggered, chainedCells, freezeCounters, ctx.targetCell, ctx.shotKey).
//       Remapped to codebase equivalents or skipped where no clean mapping exists.

// --- ELF FIRE DELTAS ---

// AZURALYS — T1 window +2 · T2 extend+chainStack+1 · T3 window for any chain + permafrost on ULT

// NERISSA — T1 +1 chainStack · T2 heal+2 if frozen cells · T3 window extend +1 per fire

// LIORA — T1 dmg 230 · T2 always freeze target · T3 2 shots

// MAELEN — T1 chain at 2+ shields · T2 shields don't decay 2 turns · T3 max-shield +50 all fires

// SYLVI — T1 +180 bonus · T2 ignore threshold · T3 cascade adjacent +50

// --- SKELETON FIRE DELTAS ---

// BONELORD — T1 +130 vs frozen · T2 armor pierce · T3 revive on death

// ICESHOT — T1 self-freeze +2 · T2 adjacent freeze on tide hit · T3 first-fire double effect

// FROSTWEAVER — T1 cap 6 · T2 cap 7 + cross-stihiya · T3 team share

// GLACIER — T1 freeze amount 2 · T2 adjacent freeze + Ice Armor hits ×3 · T3 permanent Ice Armor

// RIMEHELM — T1 convert 3 · T2 +chainStack per converted · T3 cascade convert + permafrost

// --- ULT DELTAS ---

// AZURALYS — T1 DOMINION +6 procs (T0 5) · T2 chain per tide convert · T3 permafrost ×3

// NERISSA — T1 +4 chainStack (was 3) · T2 refresh freeze · T3 full heal + reset chains

// LIORA — T1 Volley threshold 4 · T2 Volley mult 1.75 · T3 freeze burned rows

// MAELEN — T1 freeze +8 (was 6) · T2 Aegis cells count ×2 chain · T3 teammates +1 shield + 6 freeze

// SYLVI — T1 +25/stack cap 250 · T2 reset chainStack to 5 · T3 cleave adjacent rows

// BONELORD — T1 Siege +400 (was 300) post-Undying · T2 +5 burns if Undying · T3 Undying +5 HP

// ICESHOT — T1 +4 chainStack (was 3) · T2 priority frozen · T3 +50/frozen cell hit

// FROSTWEAVER — T1 shield cap 4 · T2 ULT restores +1 chainStack per shield · T3 team shield

// GLACIER — T1 Ice Armor 4 hits · T2 reduce 2 per hit · T3 Ice Armor permanent

// RIMEHELM — T1 chainWindow extend +1 · T2 convert 12 cells to tide · T3 permafrost ×3

// ===== Block 5.3 init dispatcher — apply tide tier flags for HERO_DECK at battle start =====
function applyTideTierFlagsAtBattleInit() {
  for (const hero of HERO_DECK) {
    if (!hero || (hero.tier || 0) === 0) continue;
    if (hero.stihiya !== 'tide') continue;  // scope to tide heroes only
    if (typeof hero.fireTierDelta === 'function') {
      try { hero.fireTierDelta.call(hero, null, hero.tier); } catch (e) {
        console.warn('tide fireTierDelta init failed for ' + hero.id + ':', e);
      }
    }
    if (typeof hero.ultTierDelta === 'function') {
      try { hero.ultTierDelta.call(hero, null, hero.tier); } catch (e) {
        console.warn('tide ultTierDelta init failed for ' + hero.id + ':', e);
      }
    }
  }
}
// ===== END Block 5.3 delta functions =====

// ===== V2.0 STAGE 5 BLOCK 5.4 — GROVE TIER PROGRESSIONS =====
// 10 grove heroes × T1/T2/T3 tier deltas. Spec references many ctx fields that don't exist
// in fire deltas (ctx is ULT-only) — deltas adapted to grid-scan or skipped where no clean mapping.

// --- TROLL FIRE DELTAS ---

// MOSSTUSK — T1 2 blooms · T2 gestation 1 · T3 active-bloom heal

// GRENOK — T1 dmg 280 · T2 chain burn adjacent grove · T3 +50/bloom on grove burn

// OAKROOT — T1 heal 3 · T2 overflow 2🛡 · T3 overflow on any HP gain

// URGNASH — T1 heal +2 · T2 threshold 4 · T3 +1 charge grove at 7+

// VOXI — T1 dmg 220 + 2 seeds · T2 void purge → +1 charge · T3 seed spreads

// --- GOLEM FIRE DELTAS ---

// IGNEON — T1 dmg 220 · T2 ×2 at 1+🛡 · T3 +25/shield

// BOULDER — T1 dmg 210 · T2 +2🛡 on grove burn · T3 shield gain → +1 charge

// VERDANIA — T1 2 blooms · T2 +1 bloom dmg · T3 bloom trigger → +1 charge grove

// BASTION — T1 dmg 180 · T2 overflow 2 blooms · T3 max-🛡 → charge + dmg

// AURON — T1 convert 3 · T2 check 2 neighbors · T3 seed bloom on converted

// --- ULT DELTAS ---

// MOSSTUSK — T1 +50% heal from blooms · T2 blooms spawn grove · T3 void purge

// GRENOK — T1 Siege +100 · T2 priority grove · T3 trigger all blooms post-siege

// OAKROOT — T1 +1 extra shield · T2 triggered blooms +1 HP each · T3 Aegis permanent 2 turns

// URGNASH — T1 +3HP/grove row · T2 +30 dmg per grove · T3 convert burned to grove

// VOXI — T1 bloom rate 0.50 · T2 +50 per void converted · T3 plague aura

// IGNEON — T1 Siege +60/🛡 cap 300 · T2 shield trade +200 · T3 no consume

// BOULDER — T1 +4🛡 · T2 row shields · T3 overflow → dmg

// VERDANIA — T1 cap 6 · T2 cap 7 cross-stihiya · T3 team share

// BASTION — T1 +4🛡 base (was 3) · T2 grove ×2 for 2 turns · T3 grove ×3

// AURON — T1 bloom rate 0.40 · T2 0.50 if 5-golem · T3 next bloom doubled

// ===== Block 5.4 init dispatcher =====
function applyGroveTierFlagsAtBattleInit() {
  for (const hero of HERO_DECK) {
    if (!hero || (hero.tier || 0) === 0) continue;
    if (hero.stihiya !== 'grove') continue;
    if (typeof hero.fireTierDelta === 'function') {
      try { hero.fireTierDelta.call(hero, null, hero.tier); } catch (e) {
        console.warn('grove fireTierDelta init failed for ' + hero.id + ':', e);
      }
    }
    if (typeof hero.ultTierDelta === 'function') {
      try { hero.ultTierDelta.call(hero, null, hero.tier); } catch (e) {
        console.warn('grove ultTierDelta init failed for ' + hero.id + ':', e);
      }
    }
  }
}
// ===== V2.0 STAGE 5 BLOCK 5.5 — SOLAR TIER PROGRESSIONS =====
// 10 solar heroes × T1/T2/T3. HELIOS has no fireTierDelta (null) — all progression is ULT-side.
// Spec uses ctx in fire deltas (wrong signature) — remapped to runtime grid scans or inline flag sets.

// --- HUMAN FIRE DELTAS ---

// AURELIUS — T1 column bonus 75 · T2 chain adjacent column · T3 always-spawn radiant on fire

// SOLARIS — T1 3 rays · T2 ray chains adjacent · T3 permanent radiant cap accumulator

// LUMIA — T1 panic 60% · T2 panic +2HP · T3 fire heals random teammate

// VALERIUS — T1 +1🛡 bonus · T2 Halo threshold 4 · T3 always +1 all stihiyas

// SERAPHINA — T1 mark 60% · T2 +30 dmg on mark clear · T3 mark → +1 charge

// --- LION FIRE DELTAS ---

// LEOREX — T1 bonus 130 · T2 always-on +50 · T3 team fire bonus per lion

// SOLARA — T1 +2 charge on solar burn · T2 solar burn spawns radiant · T3 increments lion counter

// ASTARION — T1 2 spawns · T2 pre-aged · T3 heal all teammates

// HELIOS — NO fireTierDelta (all progression ULT-side per spec)
// Roster binding uses null for fireTierDelta; init dispatcher skips null values safely.

// GOLDMANE — T1 radiant 40% · T2 50% + DOMINION +3 · T3 every conversion = +1 charge solar

// --- ULT DELTAS ---

// AURELIUS — T1 AoE ×1.5 · T2 chain to random radiant · T3 cleared cells → solar

// SOLARIS — T1 3 spawns · T2 pre-aged · T3 burnt cells radiant flame chain

// LUMIA — T1 2 radiants/row · T2 reset all ages · T3 Sanctuary 1 turn

// VALERIUS — T1 window 3 · T2 radiant on placement · T3 window until ULT

// SERAPHINA — T1 radiant rate 60% · T2 radiant spawn AoE · T3 INFERNO mode

// LEOREX — T1 +40/counter cap 200 · T2 double increment · T3 uncapped

// SOLARA — T1 75/row · T2 rows +1 charge ea · T3 4 rows

// ASTARION — T1 2 charges/lion · T2 non-lion +1 · T3 Starpath 3 turns

// HELIOS — T1 roar +30% · T2 3 placements · T3 +1🛡 team + +50 flat

// GOLDMANE — T1 +3 cells at Pride · T2 drop 2 radiants · T3 INFERNO at 5+ radiant

// ===== Block 5.5 init dispatcher =====
function applySolarTierFlagsAtBattleInit() {
  for (const hero of HERO_DECK) {
    if (!hero || (hero.tier || 0) === 0) continue;
    if (hero.stihiya !== 'solar') continue;
    if (typeof hero.fireTierDelta === 'function') {
      try { hero.fireTierDelta.call(hero, null, hero.tier); } catch (e) {
        console.warn('solar fireTierDelta init failed for ' + hero.id + ':', e);
      }
    }
    if (typeof hero.ultTierDelta === 'function') {
      try { hero.ultTierDelta.call(hero, null, hero.tier); } catch (e) {
        console.warn('solar ultTierDelta init failed for ' + hero.id + ':', e);
      }
    }
  }
}
// ===== END Block 5.5 delta functions =====
// ===== V2.0 STAGE 5 BLOCK 5.6 — UMBRA TIER PROGRESSIONS =====
// 10 umbra heroes × T1/T2/T3. Spec uses ctx in fire deltas (wrong signature) — remapped to inline.
// spawnUmbraCell() called directly from deltas where needed; umbraChain mapped to existing infra.

// --- DARK ELF FIRE DELTAS ---

// SHADE — T1 threshold 2 · T2 always spawn · T3 pre-aged umbra

// NYX — T1 convert 30% · T2 4th strike at 4+ dark_elves · T3 +3 charges/fire

// VYRA — T1 200 dmg · T2 3rd shot · T3 feeds umbraChain

// ZARNOK — T1 3 bolts · T2 4 at Void Siphon · T3 30% bolt spawn umbra

// KAELEN — T1 +2 charges at EN · T2 +1 charge always · T3 shield mult × 1.3

// --- ROCK FIRE DELTAS ---

// RIFFBLADE — T1 every-2nd beat · T2 ×3 mult · T3 +50 flat per fire
async function fireDeltaRiffblade(counts, tier) {
  if (tier >= 1) riffbladeBeatInterval = 2;
  if (tier >= 2) riffbladeBeatMult = 3;
  if (tier >= 3) riffbladeFlatBonus = 50;
  // Runtime T3: +50 flat per fire (applied as small passive bump)
  if (counts !== null && tier >= 3 && riffbladeFlatBonus > 0) {
    dealDamage(riffbladeFlatBonus, true);
  }
}

// SHRIEK — T1 threshold 2 rocks · T2 spread 2 · T3 spread → detonation cells
async function fireDeltaShriek(counts, tier) {
  if (tier >= 1) shriekRockThreshold = 2;
  if (tier >= 2) shriekSpreadCount = 2;
  if (tier >= 3) shriekSpreadDetonate = true;
}

// KEYCRYPT — T1 2 spawns · T2 spawns charged · T3 every fire +1 umbra charge
async function fireDeltaKeycrypt(counts, tier) {
  if (tier >= 1) keycryptSpawnCount = 2;
  if (tier >= 2) keycryptSpawnCharged = true;
  if (tier >= 3) keycryptSpawnChargesHero = true;
  // Runtime T3: +1 umbra charge per fire
  if (counts !== null && tier >= 3 && keycryptSpawnChargesHero) {
    const cap = (currentUltThreshold && currentUltThreshold.umbra) || ULT_THRESHOLD.umbra || 12;
    ultCharges.umbra = Math.min(cap, (ultCharges.umbra || 0) + 1);
  }
}

// THUNDERBEAT — T1 230 dmg · T2 threshold 3 rocks · T3 threshold 0
async function fireDeltaThunderbeat(counts, tier) {
  if (tier >= 1) thunderbeatBaseDmg = 230;
  if (tier >= 2) thunderbeatRockThreshold = 3;
  if (tier >= 3) thunderbeatRockThreshold = 0;
}

// NIGHTLORD — T1 35% · T2 50% · T3 guaranteed charge per convert
async function fireDeltaNightlord(counts, tier) {
  if (tier >= 1) nightlordChargeChance = 0.35;
  if (tier >= 2) nightlordChargeChance = 0.50;
  if (tier >= 3) nightlordGuaranteedCharge = true;
}

// --- ULT DELTAS ---

// SHADE — T1 +1 drop · T2 each drop +1 charge · T3 +2 drops + permanent shield

// NYX — T1 charge rate 0.40 · T2 flat dmg per charge · T3 min 5 charges

// VYRA — T1 +30/chain cap 150 · T2 double on EN · T3 +5 umbra drops

// ZARNOK — T1 +40%/row · T2 priority umbra · T3 each row +1 charge

// KAELEN — T1 reset motifs · T2 +1 chargedAge umbra · T3 heal + extend EN

// RIFFBLADE — T1 +200 Siege · T2 self-Encore · T3 Encore permanent
async function ultDeltaRiffblade(ctx, tier) {
  if (tier >= 1) riffbladeUltSiegeBonus = 200;
  if (tier >= 2) riffbladeSelfEncore = true;
  if (tier >= 3) riffbladeEncorePermanent = true;
  // Runtime T1: +200 extra Siege dmg when Encore active
  if (ctx && tier >= 1 && riffbladeUltSiegeBonus > 0 && rockEncoreActive) {
    dealDamage(riffbladeUltSiegeBonus, true);
    flashStateBanner('ENCORE SIEGE +' + riffbladeUltSiegeBonus, STIHIYA_COLORS.umbra);
  }
  // Runtime T2: triggers self-Encore if not already active
  if (ctx && tier >= 2 && riffbladeSelfEncore && !rockEncoreActive) {
    rockEncoreActive = true;
    encoreUsed = false;
    flashText('SELF-ENCORE', '#9D4EDD');
  }
  // Runtime T3: prevent encoreUsed from sticking
  if (ctx && tier >= 3 && riffbladeEncorePermanent) {
    encoreUsed = false;
    flashStateBanner('ENCORE ETERNAL', STIHIYA_COLORS.umbra);
  }
}

// SHRIEK — T1 echo 2 placements · T2 mult 1.5 · T3 permanent echo
async function ultDeltaShriek(ctx, tier) {
  if (tier >= 1) shriekEchoTurns = 2;
  if (tier >= 2) shriekEchoMult = 1.5;
  if (tier >= 3) shriekEchoPermanent = true;
  // Note: base ultTwistShriek sets shriekEchoNextPlacement; multi-turn extension below
  if (ctx && tier >= 1 && shriekEchoTurns > 1) {
    shriekEchoNextPlacement = true;  // ensure next placement triggers
  }
  if (ctx && tier >= 3) flashStateBanner('ECHO PERMANENT', STIHIYA_COLORS.umbra);
}

// KEYCRYPT — T1 amp 0.25 · T2 +1 charge per amp placement · T3 window 5
async function ultDeltaKeycrypt(ctx, tier) {
  if (tier >= 1) keycryptAmpRate = 0.25;
  if (tier >= 2) keycryptAmpChargePerPlace = true;
  if (tier >= 3) keycryptAmpWindowTier = 5;
  // Runtime T3: override keycryptAmpWindow to 5 (base set 3, T3 extends to 5)
  if (ctx && tier >= 3) {
    keycryptAmpWindow = Math.max(keycryptAmpWindow, 5);
    flashText('AMPLIFIER ×5', STIHIYA_COLORS.umbra);
  }
}

// THUNDERBEAT — T1 +50 dmg · T2 2 free procs · T3 3 umbra drops + permanent rhythm
async function ultDeltaThunderbeat(ctx, tier) {
  if (tier >= 1) thunderbeatRhythmBonus = 50;
  if (tier >= 2) thunderbeatRhythmWindowTier = 2;
  if (tier >= 3) { thunderbeatUltDrops = 3; rhythmSectionPermanent = true; }
  // Runtime T2: extend Rhythm window to 2 placements
  if (ctx && tier >= 2) {
    thunderbeatRhythmWindow = Math.max(thunderbeatRhythmWindow, thunderbeatRhythmWindowTier);
  }
  // Runtime T3: drop 3 umbra + set permanent rhythm
  if (ctx && tier >= 3) {
    let dropped = 0;
    for (let i = 0; i < thunderbeatUltDrops; i++) {
      if (typeof spawnUmbraCell === 'function') { spawnUmbraCell(); dropped++; }
    }
    if (dropped > 0) flashText('DRUMHEAD DROP ×' + dropped, STIHIYA_COLORS.umbra);
    flashText('RHYTHM ETERNAL', STIHIYA_COLORS.umbra);
  }
}

// NIGHTLORD — T1 +4 cells · T2 open amp window · T3 post-Encore boost
async function ultDeltaNightlord(ctx, tier) {
  if (tier >= 1) nightlordUltExtraCells = 4;
  if (tier >= 2) nightlordUltAmpOpens = true;
  if (tier >= 3) nightlordPostEncoreBoost = 2;
  // Runtime T1: +4 extra DOMINION cells (best-effort additional conversions)
  if (ctx && tier >= 1 && nightlordUltExtraCells > 0 && ctx.convertedCount) {
    const targets = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (v && !v.startsWith('void_') && v !== 'umbra') targets.push([r, c]);
    }
    targets.sort(() => Math.random() - 0.5);
    const picks = targets.slice(0, nightlordUltExtraCells);
    for (const [r, c] of picks) grid[r][c] = 'umbra';
    if (picks.length > 0) { render(); flashText('DOMINION EXPAND ×' + picks.length, STIHIYA_COLORS.umbra); }
    ctx.convertedCount += picks.length;
  }
  // Runtime T2: open Keycrypt's Amplifier window (2 placements)
  if (ctx && tier >= 2 && nightlordUltAmpOpens) {
    keycryptAmpWindow = Math.max(keycryptAmpWindow, 2);
    flashStateBanner('ENCORE AMP OPEN', STIHIYA_COLORS.umbra);
  }
  if (ctx && tier >= 3) flashStateBanner('POST-ENCORE BOOST 2T', STIHIYA_COLORS.umbra);
}

// ===== Block 5.6 init dispatcher =====
function applyUmbraTierFlagsAtBattleInit() {
  for (const hero of HERO_DECK) {
    if (!hero || (hero.tier || 0) === 0) continue;
    if (hero.stihiya !== 'umbra') continue;
    if (typeof hero.fireTierDelta === 'function') {
      try { hero.fireTierDelta.call(hero, null, hero.tier); } catch (e) {
        console.warn('umbra fireTierDelta init failed for ' + hero.id + ':', e);
      }
    }
    if (typeof hero.ultTierDelta === 'function') {
      try { hero.ultTierDelta.call(hero, null, hero.tier); } catch (e) {
        console.warn('umbra ultTierDelta init failed for ' + hero.id + ':', e);
      }
    }
  }
}
// ===== END Block 5.6 delta functions =====

// ===== END Block 5.5 delta functions =====

// ===== END Block 5.4 delta functions =====
// ===== V2.0 STAGE 4 BLOCK 4.5 — UMBRA HERO SIGNATURES =====
// Per-hero fire functions for 10 umbra heroes (5 dark elves + 5 rocks).
// Damage flows through dealDamage with all active context multipliers automatically applied
// (Warband, Hunter Mark, Grommar Rally, Pack Mark, Helios Roar). Plain dealDamage(dmg, true).
//
// IMPORTANT: codebase uses `encoreActive` (NOT spec's `rockEncoreActive`). All Block 4.5 code
// references the actual codebase flag name `encoreActive`.

// --- DARK ELF SIGNATURES ---

// SHADE (dark_elf tank) — SHADOW WARD: +1🛡, drop 1 umbra cell on empty if shieldCount ≥ 3
// V2.0 Stage 5 Block 5.6: shadeShieldThreshold (3→2→0 always), shadeUmbraPreAged (T3)

// NYX (dark_elf captain) — TRIPLE SHADOW STRIKE: 3 × 120 dmg + 25% per strike converts target to umbra
// V2.0 Stage 5 Block 5.6: nyxStrikeCount (3→4 at 4+ dark_elves), nyxConvertChance (0.25→0.30)

// VYRA (dark_elf warrior) — TWIN SHADOW SHOT: 2 × 160 dmg + +1 umbra charge if both shots hit umbra cells
// V2.0 Stage 5 Block 5.6: vyraShotCount (2→3 at 4+ dark_elves), vyraShotDmg (160→200)

// ZARNOK (dark_elf hunter) — SHADOW BOLT BARRAGE: 2 × 180 dmg, fire 3rd if voidSiphonActive (4+ dark_elves)
// V2.0 Stage 5 Block 5.6: zarnokBoltCount (2→3→4 at Void Siphon)

// KAELEN (dark_elf mage) — COUNTERSTRIKE: 100 × max(1, shieldCount) dmg + +1 umbra charge if endlessNightActive

// --- ROCK SIGNATURES ---

// Universal helper — spawn N umbra cells in random empties. Used by RIFFBLADE
// (Dark Warrior CREATE per §2.4 "Сеет dark seed-cells") and THUNDERBEAT (Dark
// Tank "Конвертит входящий damage в dark-cells" — channels stored damage as
// fresh umbra substrate). Umbra cells fuel encoreStacks via onUmbraCellsCleared.
async function _spawnUmbraCells(maxCount) {
  if (!MOTIFS_ENABLED.umbra) return 0;
  if (!maxCount || maxCount <= 0) return 0;
  const empties = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (grid[r][c] === null) empties.push([r, c]);
  }
  if (empties.length === 0) return 0;
  empties.sort(() => Math.random() - 0.5);
  const picks = empties.slice(0, Math.min(maxCount, empties.length));
  const cellEls = document.querySelectorAll('.grid .cell');
  for (const [r, c] of picks) {
    grid[r][c] = 'umbra';
    if (cellEls[r * SIZE + c]) cellEls[r * SIZE + c].classList.add('spawning');
  }
  render();
  return picks.length;
}

// HERO_GRAMMAR §4 [Dark × Warrior] — RIFFBLADE / RIFF SEED
// Spec (§2.4): "Сеет dark seed-cells" — Warrior is a **pure CREATOR**. No damage
// on fire. Damage flows through Hunter (SHRIEK detonates Encore stacks).
// RIFFBLADE sows umbra seeds that onUmbraCellsCleared turns into encoreStacks,
// KEYCRYPT amplifies, SHRIEK detonates with Encore-of-Encore.
// RIFF BEAT every 2nd fire = bonus seeds (instead of legacy doubled damage).
// Charge cost relative: fastest (combo ≥ 2 fires; cheapest setup per §2.3).
// HOTFIX 2026-04-26b — removed direct damage. RIFF BEAT now boosts seed count.
async function fireRiffblade(counts) {
  riffbladeFireCounter++;
  let seedCount = 3;
  const isBeat = (riffbladeFireCounter % riffbladeBeatInterval === 0);
  if (isBeat) {
    seedCount = 5;  // RIFF BEAT — overflow seeds for big Encore stacking
    flashText('RIFF BEAT ×' + seedCount, STIHIYA_COLORS.umbra);
  }
  const created = await _spawnUmbraCells(seedCount);
  if (!isBeat && created > 0) flashText('RIFF SEED ×' + created, STIHIYA_COLORS.umbra);
  vibrate([40, 20, 40]);
}

// HERO_GRAMMAR §4 [Dark × Hunter] — SHRIEK / PIERCING SHRIEK
// Spec: Detonates every Encore stack as echoing line damage; line repeats once at 50%
// (Encore-of-Encore). Charge cost relative: fastest (combo ≥ 2 fires; ULT ~3 placements).
// CONFORMS to spec post-rewrite (Block B1). Damage = baseDmg × min(stacks, 3) × KEYCRYPT
// amplifier (if active), then a 50% damage repeat 200ms later (Encore-of-Encore).
// THUNDERBEAT in squad → +1 shield per Encore proc (via consumeEncoreStacks helper).
// Fallback when 0 stacks: flat baseDmg primer shot + NO STACKS flash so a combo-fired
// Hunter is never wasted (mirrors BLACKTOOTH primer-shot pattern from TASK #2.2d).
// V2.0 Stage 5 Block 5.6 tier deltas (shriekRockThreshold, shriekSpreadCount,
// shriekSpreadDetonate) become dead stores in v1 per HERO_GRAMMAR §8 NN #6 — Phase 6
// may rewire. The collateral umbra-spread from old PIERCING SHRIEK is removed; mass
// detonation is the entire signature now.
async function fireShriek(counts) {
  const baseDmg = 180;
  const stacks = encoreStacks;

  // Primer shot — nothing to detonate.
  if (stacks === 0) {
    flashText('NO STACKS', '#7A4FA8');
    dealDamage(baseDmg, true);
    vibrate([30, 30, 30]);
    return;
  }

  // KEYCRYPT amplifier window (set by fireKeycrypt; drained per-placement).
  let mult = 1.0;
  const ampActive = keycryptDeepBeatActive && keycryptDeepBeatDuration > 0;
  if (ampActive) {
    mult = keycryptDeepBeatMult;
    flashText('+' + Math.round((mult - 1) * 100) + '% ENCORE', '#FFB84A');
  }

  // First echo: cap at ×3 per spec parity with INFERNO.
  // 2026-04-27 — Block H.9c — VOLLEY MASTER (T2): SHRIEK ascended → cap raised
  // ×3 → ×4 to match BLACKTOOTH/BRINESHOT pattern.
  const _t2ShriekCapBonus = (typeof _t2Bonus === 'function') ? _t2Bonus('rock_hunter', 'hunterCapBonus') : null;
  const _stackCap = 3 + (_t2ShriekCapBonus || 0);
  const cappedStacks = Math.min(stacks, _stackCap);
  const echoDmg = Math.floor(baseDmg * cappedStacks * mult);
  if (stacks >= 4) flashText('ENCORE-OF-ENCORE!', '#FFB84A');
  dealDamage(echoDmg, stacks >= 4, 0);

  // Encore-of-Encore: 50% damage repeat after 200ms.
  // 2026-04-27 — Block H.9c — VOLLEY MASTER (T2): repeat 50% → 75% on T2.
  const _t2EchoBonus = (typeof _t2Bonus === 'function') ? _t2Bonus('rock_hunter', 'encoreEchoPctBonus') : null;
  const _echoPct = 0.5 + (_t2EchoBonus || 0);
  await sleep(200);
  dealDamage(Math.floor(echoDmg * _echoPct), false, 0);

  // Consume stacks → THUNDERBEAT shield bump fires inside the helper.
  consumeEncoreStacks();
  vibrate(stacks >= 4 ? [80, 40, 80, 40, 120] : [60, 30, 60]);
}

// HERO_GRAMMAR §4 [Dark × Mage] — KEYCRYPT / DEEP BEAT
// Spec: Encore stacks gain +20% per stack. Charge cost relative: medium-slow (period ~12).
// CONFORMS to spec post-rewrite (Block B1). Activates the 3-placement DEEP BEAT window;
// mult is computed AT FIRE TIME from current encoreStacks (1.0 + stacks × 0.20). SHRIEK
// (and any future Hunter detonator) reads keycryptDeepBeatMult on detonate.
// AMPLIFIER role verb: this fire creates no cells, no stacks, no damage, no heal — it
// magnifies the next detonation. Mirror of EMBERHAND BLOOM pattern (TASK #2.2d).
// V2.0 Stage 5 Block 5.6 tier deltas (keycryptSpawnCount, keycryptSpawnCharged,
// keycryptSpawnChargesHero) are now dead stores — Phase 6 may rewire to extend window
// or boost mult. The legacy +1 HP regen is removed (Mage doesn't heal — that's MENDING ULT).
async function fireKeycrypt() {
  const stacks = encoreStacks;
  keycryptDeepBeatActive   = true;
  // 2026-04-27 — Block H.9b — DEEP BEAT MASTERY (T2): per-stack mult 0.20 → 0.25
  // and window 3 → 5 placements.
  const _t2Mult = _t2Bonus('rock_mage', 'mageMult');
  const perStack = (_t2Mult != null) ? (_t2Mult - 1) : 0.20;
  keycryptDeepBeatMult     = 1.0 + (stacks * perStack);
  const _t2Window = _t2Bonus('rock_mage', 'mageWindow');
  keycryptDeepBeatDuration = (_t2Window != null) ? _t2Window : KEYCRYPT_DEEP_BEAT_TURNS;
  flashText('DEEP BEAT +' + Math.round(stacks * perStack * 100) + '%', STIHIYA_COLORS.umbra);
  vibrate([50, 30, 50]);
}

// HERO_GRAMMAR §4 [Dark × Tank] — THUNDERBEAT / DRUMHEAD
// Spec (§2.4): "Конвертит входящий damage в dark-cells" — Tank PROTECTOR for
// Dark element. Spec also grants "+1 shield per Encore proc" (preserved via
// consumeEncoreStacks helper which routes shields when THUNDERBEAT in squad).
// Charge cost relative: slowest (no minCombo gate; ULT ~5 placements).
// HOTFIX 2026-04-26 — added active umbra-cell conversion on fire (2 cells;
// 3 on Rhythm). The "channel damage as dark substrate" interpretation: each
// fire seeds umbra cells that fuel encoreStacks via onUmbraCellsCleared.
// Pre-fix was shield + dmg only with no conversion (failed §2.4 contract).
// THUNDERBEAT (rock tank) — DRUMHEAD: +1🛡, 160 dmg (210 if rhythmSectionActive)
// V2.0 Stage 5 Block 5.6: thunderbeatBaseDmg (210→230), thunderbeatRockThreshold (5→3→0)
async function fireThunderbeat(counts) {
  const cap = MAX_SHIELD + 2 + maxShieldBonus;
  if (shieldCount < cap) shieldCount++;
  // Signature: Rhythm Section conditional bonus — tier-scoped threshold + base dmg
  let dmg = 160;
  let umbraSeed = 2;
  const rockCount = HERO_DECK.filter(h => h && h.race === 'rock').length;
  // Rhythm gate: active if race synergy active OR tier reduces threshold OR T3 permanent
  const rhythmGate = rhythmSectionActive || rhythmSectionPermanent || (thunderbeatRockThreshold > 0 && rockCount >= thunderbeatRockThreshold) || thunderbeatRockThreshold === 0;
  if (rhythmGate) {
    dmg = thunderbeatBaseDmg;  // T0=210, T1+=230
    umbraSeed = 3;
    flashText('RHYTHM STRIKE +' + (dmg - 160), STIHIYA_COLORS.umbra);
  }
  dealDamage(dmg, true);
  // §2.4 conversion — channel damage absorbed by shield into dark substrate.
  await _spawnUmbraCells(umbraSeed);
  vibrate([50, 30, 50]);
}

// HERO_GRAMMAR §4 [Dark × Captain] — NIGHTLORD / CONDUCT THE DARK
// Spec: Race-buff scales rock band Encore multiplier; +25% umbra drops; ULT triggers
// immediate squad-wide Encore window. Charge cost relative: medium (period ~10).
// IMPLEMENTATION: dual buff lives in calcSynergyState (§6) → captainDual_* mirrored
// globals (race-scaling damage + fixed +25% umbra drop weight; see _RACE_PLURAL map).
// fire body remains the active board effect (cell conversion + per-cell charge gift).
// ULT (ultTwistNightlord) opens the squad-wide encore window via encoreActive flag.
// NIGHTLORD (rock captain) — CONDUCT THE DARK: convert 2 cells to umbra + 25% per cell drops +1 charge to umbra hero
async function fireNightlord() {
  const hero = this;
  if (!hero || !hero.stihiya) return;
  const convertCount = Math.floor(2 * captainConversionBoost);
  const targets = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const v = grid[r][c];
    if (v && !v.startsWith('void_') && v !== hero.stihiya) targets.push([r, c]);
  }
  if (targets.length > 0) {
    targets.sort(() => Math.random() - 0.5);
    const picks = targets.slice(0, convertCount);
    const cellEls = document.querySelectorAll('.grid .cell');
    for (const [r, c] of picks) cellEls[r * SIZE + c].classList.add('burning');
    await sleep(250);
    let charges = 0;
    for (const [r, c] of picks) {
      grid[r][c] = hero.stihiya;
      // Signature: tier-scoped chance per cell (T0=0.25, T1+=0.35, T2+=0.50)
      // T3 nightlordGuaranteedCharge — every convert = +1 charge (100%)
      const trigger = nightlordGuaranteedCharge || Math.random() < nightlordChargeChance;
      if (trigger) {
        const umbraHeroes = HERO_DECK.filter(h => h && h.stihiya === 'umbra');
        if (umbraHeroes.length > 0) {
          const tgt = umbraHeroes[Math.floor(Math.random() * umbraHeroes.length)];
          const sCap = (currentUltThreshold && currentUltThreshold[tgt.stihiya]) || ULT_THRESHOLD[tgt.stihiya] || 12;
          ultCharges[tgt.stihiya] = Math.min(sCap, (ultCharges[tgt.stihiya] || 0) + 1);
          // DEBT-014 — feed per-hero charge so the proc contributes to ult-readiness.
          addChargeToHeroesOfElement(tgt.stihiya, ELEMENT_POOL_TO_HERO_CHARGE);
          charges++;
        }
      }
    }
    render();
    if (charges > 0) flashText('CONDUCT +' + charges + '🌑', STIHIYA_COLORS.umbra);
  }
  vibrate([25, 25, 25]);
}

// ===== ULT TWISTS =====

// SHADE — VOID AEGIS: drop 5 umbra cells on random empty (vs standard 3 from base AEGIS)

// NYX — VOID DOMINION: 30% chance per converted umbra cell → +1 charge to random umbra hero
// V2.0 Stage 5 Block 5.6: nyxChargeRate (0.30→0.40); ctx.chargesPropagated exposed for T2 flat dmg delta

// VYRA — CHAIN SIEGE: +25 dmg per umbra chain progress (cap +100 at chain=4)
// V2.0 Stage 5 Block 5.6: vyraSiegePerChain (25→30), vyraSiegeCap (100→150)

// ZARNOK — UMBRA VOLLEY: +30% per umbra row in VOLLEY (≈ +90 flat per row, max +270)
// V2.0 Stage 5 Block 5.6: zarnokUltRowBonus (0.30→0.40)

// KAELEN — VOID MENDING: reset radiantAge to 0 for ALL umbra cells (Endless Night persistence refresh)

// HERO_GRAMMAR §4 [Dark × Warrior] — RIFFBLADE / RIFF FORGE ULT
// Spec §9 (Warrior ULT — board CREATE): "SIEGE — encore-stack-on-clear doubles
// for 3 placements". Pure CREATOR ULT — no damage (handled by applyWarriorUlt
// v1-warrior gate). This twist spawns mass umbra substrate; the encore-doubling
// happens organically through the encoreActive flag and onUmbraCellsCleared hook.
// 2026-04-27 GRAMMAR HOTFIX: replaced dealDamage(500) with _spawnUmbraCells.
async function ultTwistRiffblade(ctx) {
  // Base CREATE — 6 umbra cells (mass seed for Encore stacking).
  const baseSpawn = await _spawnUmbraCells(6);
  if (baseSpawn > 0) flashText('RIFF FORGE ULT ×' + baseSpawn, STIHIYA_COLORS.umbra);
  // ENCORE FORGE bonus — extra umbra spawn if encore primed.
  if (encoreActive && !encoreUsed) {
    const bonus = await _spawnUmbraCells(4);
    encoreUsed = true;
    if (bonus > 0) flashText('ENCORE FORGE +' + bonus, STIHIYA_COLORS.umbra);
  }
}

// HERO_GRAMMAR §4 [Dark × Hunter] — SHRIEK / VOLLEY ULT signature
// Spec ULT pattern (Hunter): VOLLEY — multi-line burst; the cascade trigger.
// EXTENDS spec — current twist queues an echo VOLLEY for the next placement if encore
// is primed. Aligns with the Encore-of-Encore identity in fireShriek (Block B1).
// SHRIEK — ECHO VOLLEY: re-fire VOLLEY on next placement if encoreActive (consumes encore via encoreUsed)
async function ultTwistShriek(ctx) {
  // HOTFIX B3.4 (Roman spec): Hunter ULT detonates ALL umbra cells on the board.
  // KEYCRYPT DEEP BEAT amp window stacks on top.
  const ampMult = (keycryptDeepBeatActive && keycryptDeepBeatDuration > 0) ? keycryptDeepBeatMult : 1.0;
  await _hunterUltDetonateAllCells('umbra', 180, ampMult, STIHIYA_COLORS.umbra || '#9B59D6', 'PIERCING ULT');
  // Legacy ECHO VOLLEY queue — preserved as auxiliary identity.
  if (encoreActive && !encoreUsed) {
    shriekEchoNextPlacement = true;
    encoreUsed = true;
    flashText('ECHO QUEUED', STIHIYA_COLORS.umbra);
  }
}

// HERO_GRAMMAR §4 [Dark × Mage] — KEYCRYPT / MENDING ULT signature
// Spec ULT pattern (Mage): MENDING — full heal or board-state extension; restores the engine.
// Spec [Dark × Mage] cell: "ULT: every squad hero gets one free Encore."
// v1 IMPLEMENTATION (deferred): existing keycryptAmpWindow opens a 3-placement window
// where umbra-containing line clears get +20% damage — board-state extension on the spec
// MENDING template, but NOT a per-hero free-encore token. The literal "every squad hero
// gets one free Encore" mechanic is filed as DEBT-016 for a follow-up MGD task — it
// requires a per-hero token tracker + fireHero double-fire path with recursion guard,
// which is out of scope for Block B1.
// V2.0 Stage 5 Block 5.6: keycryptAmpWindowTier (3→5 at T3)
async function ultTwistKeycrypt(ctx) {
  keycryptAmpWindow = keycryptAmpWindowTier;
  flashText('AMPLIFIER ON ×' + keycryptAmpWindowTier, STIHIYA_COLORS.umbra);
}

// HERO_GRAMMAR §4 [Dark × Tank] — THUNDERBEAT / AEGIS ULT signature
// Spec ULT pattern (Tank): AEGIS — large shield + element seed; the survival pivot.
// Spec [Dark × Tank] cell: "ULT: free Rhythm proc + squad-wide Encore window."
// v1 IMPLEMENTATION: free Rhythm proc lives in thunderbeatRhythmWindow (current twist
// opens a 1- or 2-placement window where the next umbra clear gets +50 free Rhythm bonus).
// The "squad-wide Encore window" half is partially covered by NIGHTLORD ULT (encoreActive
// flag); a Tank-specific 3-placement encore window is filed as DEBT-016 alongside the
// KEYCRYPT per-hero-token enhancement.
// V2.0 Stage 5 Block 5.6: thunderbeatRhythmWindowTier (1→2 at T2)
async function ultTwistThunderbeat(ctx) {
  thunderbeatRhythmWindow = thunderbeatRhythmWindowTier;
  flashText('RHYTHM PRIMED ×' + thunderbeatRhythmWindowTier, STIHIYA_COLORS.umbra);
}

// HERO_GRAMMAR §4 [Dark × Captain] — NIGHTLORD / DOMINION ULT signature
// Spec ULT pattern (Captain): DOMINION — board-wide element seed + multiplier window.
// Spec [Dark × Captain] cell: "ULT triggers immediate squad-wide Encore window."
// CONFORMS to spec (Block B1 — no body change). Sets encoreActive + clears encoreUsed,
// arming the squad-wide Encore window so the next umbra ULT auto-fires twice (existing
// universal mechanic in ultRoleDispatch). Persistent dual buff (race-scaling dmg + fixed
// +25% umbra drop) lives in calcSynergyState — see fireNightlord header.
// NOTE: Codebase uses `encoreActive` (not spec's `rockEncoreActive`).
async function ultTwistNightlord(ctx) {
  encoreActive = true;
  encoreUsed = false;
  flashText('ENCORE NOW', STIHIYA_COLORS.umbra);
}
// ===== V2.0 STAGE 4 BLOCK B2 — SHARKS (Frost / Tide) HERO SIGNATURES =====
// 5 shark heroes: RIMEFANG / BRINESHOT / CRYOMIND / BULWARK / ABYSSKING.
// Mirror Pirates/Rock pattern: damage flows through dealDamage with all active context
// multipliers automatically applied (Warband, Hunter Mark, Grommar Rally, Pack Mark,
// Helios Roar, Captain Dual). Frost chain segments are universal (built in
// onTideCellsCleared), consumed by BRINESHOT + amplified by CRYOMIND, drained via
// consumeChainStack helper which fires BULWARK shield bump.

// Universal helper — spawn N tide cells in random empties. Used by RIMEFANG (Frost
// Warrior CREATE per §2.4 "Создаёт frost-cells (требуют цепь)"). Tide cells fuel
// frostChainSegments via onTideCellsCleared when player matches them.
async function _spawnTideCells(maxCount) {
  if (!MOTIFS_ENABLED.tide) return 0;
  if (!maxCount || maxCount <= 0) return 0;
  const empties = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (grid[r][c] === null) empties.push([r, c]);
  }
  if (empties.length === 0) return 0;
  empties.sort(() => Math.random() - 0.5);
  const picks = empties.slice(0, Math.min(maxCount, empties.length));
  const cellEls = document.querySelectorAll('.grid .cell');
  for (const [r, c] of picks) {
    grid[r][c] = 'tide';
    if (cellEls[r * SIZE + c]) cellEls[r * SIZE + c].classList.add('spawning');
  }
  render();
  return picks.length;
}

// HERO_GRAMMAR §4 [Frost × Warrior] — RIMEFANG / TIDEBREAKER
// Spec (§2.4): "Создаёт frost-cells (требуют цепь)" — Warrior is a **pure CREATOR**.
// No damage on fire. Damage flows through Hunter (BRINESHOT detonates chains).
// RIMEFANG sows tide substrate that onTideCellsCleared turns into frostChainSegments,
// CRYOMIND amplifies the chain, BRINESHOT detonates.
// Charge cost: fastest (combo ≥ 2 fires; cheapest setup per §2.3).
// HOTFIX 2026-04-26b — removed direct damage. Warrior = setup, not attack.
async function fireRimefang(counts) {
  const created = await _spawnTideCells(3);
  if (created > 0) flashText('TIDEBREAKER ×' + created, STIHIYA_COLORS.tide);
  vibrate([40, 20, 40]);
}

// HERO_GRAMMAR §4 [Frost × Hunter] — BRINESHOT / SHATTER VOLLEY
// Spec: Detonates every active chain for line damage; longer chain = wider line
// (1=1 row, 4+=4 rows). Charge cost: fastest (combo ≥ 2; ULT ~3 placements).
// CONFORMS post-rewrite. Damage = baseDmg × min(segments, 4) (×4 cap matching the
// "4+=4 rows" wording from spec — wider scaling than INFERNO's ×3 because Frost
// trades raw spike for tempo). × cryomindWeaveMult if amp window active.
// BULWARK in squad → +N shields per chain segment broken (via consumeChainStack helper).
// Primer-shot fallback on 0 segments (mirror BLACKTOOTH/SHRIEK pattern).
async function fireBrineshot(counts) {
  const baseDmg = 180;
  const segments = frostChainSegments;

  if (segments === 0) {
    flashText('NO CHAINS', STIHIYA_COLORS.tide);
    dealDamage(baseDmg, true);
    vibrate([30, 30, 30]);
    return;
  }

  let mult = 1.0;
  const ampActive = cryomindWeaveActive && cryomindWeaveDuration > 0;
  if (ampActive) {
    mult = cryomindWeaveMult;
    flashText('+' + Math.round((mult - 1) * 100) + '% SHATTER', STIHIYA_COLORS.tide);
  }

  // 2026-04-27 — Block H.9b — VOLLEY MASTER (T2): chain cap 4 → 5.
  const _t2BrineshotBonus = (typeof _t2Bonus === 'function') ? _t2Bonus('shark_hunter', 'hunterCapBonus') : null;
  const _chainCap = 4 + (_t2BrineshotBonus || 0);
  const cappedSegments = Math.min(segments, _chainCap);
  const echoDmg = Math.floor(baseDmg * cappedSegments * mult);
  if (segments >= 4) flashText('SHATTER VOLLEY!', STIHIYA_COLORS.tide);
  dealDamage(echoDmg, segments >= 4, 0);

  // Consume → BULWARK shield bump fires inside the helper.
  consumeChainStack();
  vibrate(segments >= 4 ? [80, 40, 80, 40, 120] : [60, 30, 60]);
}

// HERO_GRAMMAR §4 [Frost × Mage] — CRYOMIND / TIDE WEAVE
// Spec: Extends every active chain by +1 cell; ULT freezes boss attack timer for 1 turn.
// Charge cost: medium-slow (period ~12).
// CONFORMS post-rewrite. AMPLIFIER role verb: this fire creates no cells, no damage,
// no heal. Opens the 3-placement TIDE WEAVE window with mult 1.0 + segments × 0.25
// (heavier per-stack than KEYCRYPT to reward Frost's tempo identity). Also extends
// the existing chain by adding +1 segment (the "extend every active chain by +1" half
// of spec — single-counter model where extending = bumping the segment count).
async function fireCryomind() {
  const segments = frostChainSegments;
  cryomindWeaveActive   = true;
  // 2026-04-27 — Block H.9b — WEAVE MASTERY (T2): per-segment mult 0.25 → 0.5
  // and window 3 → 5 placements.
  const _t2Mult = _t2Bonus('shark_mage', 'mageMult');
  const perSegment = (_t2Mult != null) ? (_t2Mult - 1) : 0.25;
  cryomindWeaveMult     = 1.0 + (segments * perSegment);
  const _t2Window = _t2Bonus('shark_mage', 'mageWindow');
  cryomindWeaveDuration = (_t2Window != null) ? _t2Window : CRYOMIND_WEAVE_TURNS;
  // Spec "extends every active chain by +1 cell" — bump segment counter by 1
  // (capped at FROST_CHAIN_CAP). Fires only if there's at least one chain to extend.
  if (segments > 0) {
    frostChainSegments = Math.min(FROST_CHAIN_CAP, frostChainSegments + 1);
  }
  flashText('TIDE WEAVE +' + Math.round(segments * perSegment * 100) + '%', STIHIYA_COLORS.tide);
  vibrate([50, 30, 50]);
}

// HERO_GRAMMAR §4 [Frost × Tank] — BULWARK / TOCK GUARD
// Spec (§2.4): "Замораживает атаки босса (delays attack countdown)" — Tank PROTECTOR
// for Frost element. +1 shield per chain segment broken from spec is preserved
// via consumeChainStack helper (BRINESHOT detonations route shields through it).
// Charge cost: slowest (no minCombo gate; ULT ~5 placements).
// HOTFIX 2026-04-26 — added attackCountdown +1 delay on fire (the literal §2.4
// "freezes boss attacks" mechanic). Pre-fix fire was shield + dmg only with no
// freeze effect — failed §2.4 PROTECTOR contract.
// ULT placement-refund mechanic does not exist in v1 codebase — falls back to
// +3 shields with DEBT-017 filed.
async function fireBulwark(counts) {
  const cap = MAX_SHIELD + 2 + (maxShieldBonus || 0);
  if (shieldCount < cap) shieldCount++;
  dealDamage(160, true);
  // §2.4 freeze — delay boss attack timer by 1. Capped by TIDE_COUNTDOWN_CAP.
  // Routed through onFreezeApplied so excess→shield conversion + frozenStreakTurns
  // bookkeeping behaves consistently with universal Frost freeze plumbing.
  if (typeof attackCountdown === 'number' && attackCountdown < TIDE_COUNTDOWN_CAP) {
    attackCountdown += 1;
    if (typeof onFreezeApplied === 'function') onFreezeApplied(1);
    flashStateBanner('TOCK GUARD · FREEZE +1', STIHIYA_COLORS.tide);
  }
  vibrate([50, 30, 50]);
}

// HERO_GRAMMAR §4 [Frost × Captain] — ABYSSKING / DEEP TIDE
// Spec: Race-buff scales shark chain bonuses; +25% tide drops; ULT chills entire board
// for 2 turns. Charge cost: medium (period ~10).
// IMPLEMENTATION: dual buff lives in calcSynergyState (§6) → captainDual_* mirrored
// globals (race-scaling damage + fixed +25% tide drop weight; _RACE_PLURAL map already
// includes shark: 'SHARKS'). fire body is the active board effect — converts a few
// random non-tide cells to tide (mirror of CRIMSON/NIGHTLORD captain pattern).
async function fireAbyssking() {
  const hero = this;
  if (!hero || !hero.stihiya) return;
  const convertCount = Math.floor(2 * (typeof captainConversionBoost === 'number' ? captainConversionBoost : 1));
  const targets = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const v = grid[r][c];
    if (v && !v.startsWith('void_') && v !== hero.stihiya) targets.push([r, c]);
  }
  if (targets.length === 0) { vibrate([25, 25, 25]); return; }
  targets.sort(() => Math.random() - 0.5);
  const picks = targets.slice(0, convertCount);
  const cellEls = document.querySelectorAll('.grid .cell');
  for (const [r, c] of picks) cellEls[r * SIZE + c].classList.add('burning');
  await sleep(250);
  for (const [r, c] of picks) grid[r][c] = hero.stihiya;
  render();
  vibrate([25, 25, 25]);
}

// ===== SHARKS ULT TWISTS =====

// HERO_GRAMMAR §4 [Frost × Warrior] — RIMEFANG / TIDE FORGE ULT
// Spec §9 (Warrior ULT — board CREATE): "SIEGE — chains shatter on next chain
// (full board frost burst)". Pure CREATOR ULT — no damage (handled by
// applyWarriorUlt v1-warrior gate). This twist spawns mass tide substrate;
// chain-shatter mechanic emerges through onTideCellsCleared and frostChainSegments.
// 2026-04-27 GRAMMAR HOTFIX: pre-fix was no-op relying on SIEGE damage from
// applyWarriorUlt — now does proper mass tide CREATE.
async function ultTwistRimefang(ctx) {
  const baseSpawn = await _spawnTideCells(6);
  if (baseSpawn > 0) flashText('TIDE FORGE ULT ×' + baseSpawn, STIHIYA_COLORS.tide);
}

// HERO_GRAMMAR §4 [Frost × Hunter] — BRINESHOT / VOLLEY ULT signature
// Spec ULT pattern (Hunter): VOLLEY — multi-line burst; the cascade trigger.
// EXTENDS spec — twist consumes any remaining frost chain segments at end of VOLLEY,
// adding a shatter bonus. Mirrors the post-FIRE consume pattern but ULT-scoped so
// BRINESHOT ULT also fully drains the chain pool.
async function ultTwistBrineshot(ctx) {
  // HOTFIX B3.4 (Roman spec): Hunter ULT detonates ALL tide cells on the board.
  // CRYOMIND TIDE WEAVE amp window stacks on top.
  const ampMult = (cryomindWeaveActive && cryomindWeaveDuration > 0) ? cryomindWeaveMult : 1.0;
  await _hunterUltDetonateAllCells('tide', 180, ampMult, STIHIYA_COLORS.tide || '#3B8BD4', 'SHATTER ULT');
  // Legacy SHATTER ECHO bonus on chain segments — preserved as auxiliary identity.
  if (frostChainSegments > 0) {
    const bonus = Math.floor(60 * Math.min(frostChainSegments, 4));
    consumeChainStack();
    if (bonus > 0) {
      dealDamage(bonus, false, 0);
      flashText('SHATTER ECHO +' + bonus, STIHIYA_COLORS.tide);
    }
  }
}

// HERO_GRAMMAR §4 [Frost × Mage] — CRYOMIND / MENDING ULT signature
// Spec ULT pattern (Mage): MENDING — full heal or board-state extension; restores the engine.
// Spec [Frost × Mage] cell ULT: "freezes the boss attack timer for 1 turn (boss skips
// one swing)". CONFORMS — bumps attackCountdown by current boss attackInterval (which
// effectively skips one boss swing) and routes through onFreezeApplied so the chain
// economy ticks naturally.
async function ultTwistCryomind(ctx) {
  const interval = (typeof currentBoss !== 'undefined' && currentBoss && currentBoss.attackInterval) || 8;
  attackCountdown += interval;
  if (typeof onFreezeApplied === 'function') onFreezeApplied(interval);
  flashText('TIME FROZEN', STIHIYA_COLORS.tide);
}

// HERO_GRAMMAR §4 [Frost × Tank] — BULWARK / AEGIS ULT signature
// Spec ULT pattern (Tank): AEGIS — large shield + element seed; the survival pivot.
// Spec [Frost × Tank] cell ULT: "refunds 1 placement to the player". v1 codebase has
// no placement-refund mechanism — falling back to +3 shields (parity with IRONBELLY
// CHARGED AEGIS shape). Filed as DEBT-017 for the refund-placement plumbing.
async function ultTwistBulwark(ctx) {
  const cap = MAX_SHIELD + 2 + (maxShieldBonus || 0);
  const before = shieldCount;
  shieldCount = Math.min(cap, shieldCount + 3);
  const gained = shieldCount - before;
  if (gained > 0) flashStateBanner('TOCK GUARD +' + gained + '🛡', STIHIYA_COLORS.tide);
}

// HERO_GRAMMAR §4 [Frost × Captain] — ABYSSKING / DOMINION ULT signature
// Spec ULT pattern (Captain): DOMINION — board-wide element seed + multiplier window.
// Spec [Frost × Captain] cell ULT: "chills the entire board for 2 turns". CONFORMS via
// large attackCountdown bump (≈ 2× current boss attackInterval) → boss effectively
// skips ~2 swings. Routes through onFreezeApplied so the chain economy ticks. The
// "entire board chilled" visual intent is achieved via the attackCountdown freeze
// (mechanically equivalent — there's no per-cell chill state in v1).
async function ultTwistAbyssking(ctx) {
  const interval = (typeof currentBoss !== 'undefined' && currentBoss && currentBoss.attackInterval) || 8;
  const freezeAmount = interval * 2;
  attackCountdown += freezeAmount;
  if (typeof onFreezeApplied === 'function') onFreezeApplied(freezeAmount);
  flashText('DEEP TIDE', STIHIYA_COLORS.tide);
}

// ===== CROCODILES (Phase 5 Block 2) =====
// 5 heroes × Earth/Grove. Wires into Phase 5 Block 1 infrastructure
// (groveAbsorbedByCell, absorbBossDamage, consumeEarthCells, REVENGE BURST).

// Universal helper — spawn N grove "absorber" cells in random empties + register
// each in groveAbsorbedByCell so they participate in absorbBossDamage. Used by
// MOSSJAW (Warrior CREATE), IRONSCALE (Tank PROTECT), ANCIENTSCALE (Captain ENABLE).
// Returns count actually placed. Capped by available empties.
async function _spawnGroveAbsorbers(maxCount) {
  if (!MOTIFS_ENABLED.grove) return 0;
  if (!maxCount || maxCount <= 0) return 0;
  const empties = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (grid[r][c] === null) empties.push([r, c]);
  }
  if (empties.length === 0) return 0;
  empties.sort(() => Math.random() - 0.5);
  const picks = empties.slice(0, Math.min(maxCount, empties.length));
  const cellEls = document.querySelectorAll('.grid .cell');
  for (const [r, c] of picks) {
    grid[r][c] = 'grove';
    groveAbsorbedByCell.set(r + '_' + c, 0);
    if (cellEls[r * SIZE + c]) cellEls[r * SIZE + c].classList.add('spawning');
  }
  render();
  return picks.length;
}

// HERO_GRAMMAR §4 [Earth × Warrior] — MOSSJAW / BEDROCK FORGE
// Spec (§2.4): "Создаёт earth-cells (поглощают boss damage)" — Warrior is a
// **pure CREATOR**. No damage on fire. Damage flows through Hunter (THORNBACK
// REVENGE BURST = absorbed dmg). MOSSJAW seeds absorbers that soak boss hits,
// MOSSWEAVER amplifies absorption, THORNBACK detonates the stored absorption.
// Charge cost: fastest (combo ≥ 2 fires; cheapest setup per §2.3).
// HOTFIX 2026-04-26b — removed direct damage. Pure CREATE.
// ULT BEDROCK BASTION (signature) converts ALL empty cells to grove absorbers.
async function fireMossjaw(counts) {
  const created = await _spawnGroveAbsorbers(3);
  if (created > 0) flashText('BEDROCK FORGE ×' + created, STIHIYA_COLORS.grove);
  vibrate([40, 20, 40]);
}
async function ultTwistMossjaw(ctx) {
  // Bedrock Bastion — convert all empty cells to grove + register all as absorbers.
  const placed = await _spawnGroveAbsorbers(99);
  if (placed > 0) flashText('BEDROCK BASTION · ' + placed, STIHIYA_COLORS.grove);
}

// HERO_GRAMMAR §4 [Earth × Mage] — MOSSWEAVER / VERDANT SURGE
// Spec: +1.5× absorption + REVENGE scaling. Charge cost: medium-slow (period ~12).
// CONFORMS — AMPLIFIER role verb: opens 3-placement window with mult based on
// current groveTotalAbsorbed. NO state creation (Mage rule). THORNBACK reads
// mossweaverSurgeMult on detonate.
// ULT VERDANT SURGE (signature) consumes all shields → bonus damage burst.
async function fireMossweaver(counts) {
  const total = groveTotalAbsorbed;
  mossweaverSurgeActive   = true;
  // 2026-04-27 — Block H.9b — VERDANT MASTERY (T2): window 3 → 5; mult cap 0.5 → 1.0.
  const _t2Mult = _t2Bonus('crocodile_mage', 'earthCellAbsorb');  // 2.0 = 100% cap
  const multCap = (_t2Mult != null) ? (_t2Mult - 1) : 0.5;
  mossweaverSurgeMult     = 1.0 + Math.min(multCap, (total / GROVE_REVENGE_THRESHOLD) * multCap);
  const _t2Window = _t2Bonus('crocodile_mage', 'mageWindow');
  mossweaverSurgeDuration = (_t2Window != null) ? _t2Window : MOSSWEAVER_SURGE_TURNS;
  flashText('VERDANT SURGE +' + Math.round((mossweaverSurgeMult - 1) * 100) + '%', STIHIYA_COLORS.grove);
  vibrate([50, 30, 50]);
}
async function ultTwistMossweaver(ctx) {
  // Convert all current shields to bonus damage (200 dmg per shield).
  if (shieldCount > 0) {
    const bonusDmg = shieldCount * 200;
    const consumed = shieldCount;
    shieldCount = 0;
    dealDamage(bonusDmg, true);
    flashText('VERDANT SURGE · ' + consumed + '🛡 → ' + bonusDmg + ' dmg', STIHIYA_COLORS.grove);
  } else {
    flashText('NO SHIELDS', STIHIYA_COLORS.grove);
  }
}

// HERO_GRAMMAR §4 [Earth × Hunter] — THORNBACK / VENGEANCE SLAM
// Spec: REVENGE BURST = absorbed dmg. Charge cost: fastest (combo ≥ 2).
// CONFORMS — DETONATOR role verb: consumes all earth-cell absorbed damage as
// burst, with primer-shot fallback when no absorption banked. MOSSWEAVER amp
// window stacks. REVENGE BURST cap (groveRevengeFired) bumps mult ×1.5 (the
// "4-row line" intent — wider damage spread when threshold reached).
// ULT VENGEANCE QUAKE (signature) consumes ×3 multiplier on absorbed total.
async function fireThornback(counts) {
  const total = consumeEarthCells();
  if (total === 0) {
    flashText('NO ABSORPTION', STIHIYA_COLORS.grove);
    dealDamage(180, true); // primer-shot fallback (Hunter rule per Combat Ref §4)
    vibrate([30, 30, 30]);
    return;
  }
  let mult = 1.0;
  const ampActive = mossweaverSurgeActive && mossweaverSurgeDuration > 0;
  if (ampActive) {
    mult = mossweaverSurgeMult;
    flashText('+' + Math.round((mult - 1) * 100) + '% SURGE', STIHIYA_COLORS.grove);
  }
  // 2026-04-27 — Block H.9c — REVENGE MASTER (T2): scaling 1.5 → 2.25 (×1.5 boost).
  if (groveRevengeFired) {
    const _t2RevengeScale = (typeof _t2BonusInDeck === 'function') ? _t2BonusInDeck('crocodile_hunter', 'revengeBurstScale') : null;
    mult *= (_t2RevengeScale != null) ? (1.5 * _t2RevengeScale) : 1.5;
  }
  const dmg = Math.floor(total * mult);
  if (groveRevengeFired) flashText('VENGEANCE · ' + dmg, STIHIYA_COLORS.grove);
  dealDamage(dmg, groveRevengeFired || total >= 500, 0);
  vibrate(groveRevengeFired ? [80, 40, 80, 40, 120] : [60, 30, 60]);
}
async function ultTwistThornback(ctx) {
  // Vengeance Quake — consume earth-cells × 3 multiplier (Combat Ref §9 ULT Dispatch).
  const total = consumeEarthCells();
  if (total > 0) {
    const dmg = Math.floor(total * 3);
    dealDamage(dmg, true);
    flashText('VENGEANCE QUAKE ×3 · ' + dmg, STIHIYA_COLORS.grove);
  } else {
    flashText('NO ABSORPTION', STIHIYA_COLORS.grove);
  }
}

// HERO_GRAMMAR §4 [Earth × Tank] — IRONSCALE / STONE SKIN
// Spec: Auto-convert hits to earth-cells + ULT full row earth-cells.
// CONFORMS — PROTECTOR role verb: small dmg + +1 shield + spawn 1 earth absorber
// cell on fire. ULT WALL OF ROOTS (signature) converts entire center row to grove
// absorber cells (mass earth-field for sustained absorption window).
async function fireIronscale(counts) {
  const cap = MAX_SHIELD + 2 + (maxShieldBonus || 0);
  if (shieldCount < cap) shieldCount++;
  dealDamage(160, true);
  // 2026-04-27 — Block H.9c — DEEP STONE (T2): IRONSCALE ascended → spawn 2
  // earth absorbers per fire instead of 1.
  const _t2IronscaleBonus = (typeof _t2Bonus === 'function') ? _t2Bonus('crocodile_tank', 'ultCellsBonus') : null;
  await _spawnGroveAbsorbers(1 + (_t2IronscaleBonus || 0));
  vibrate([50, 30, 50]);
}
async function ultTwistIronscale(ctx) {
  // Wall of Roots — full center row → grove absorber cells. Replaces existing
  // grid contents in the center row (whether empty, void, or other element).
  const centerRow = Math.floor(SIZE / 2);
  const cellEls = document.querySelectorAll('.grid .cell');
  let placed = 0;
  for (let c = 0; c < SIZE; c++) {
    grid[centerRow][c] = 'grove';
    groveAbsorbedByCell.set(centerRow + '_' + c, 0);
    if (cellEls[centerRow * SIZE + c]) cellEls[centerRow * SIZE + c].classList.add('spawning');
    placed++;
  }
  render();
  flashText('WALL OF ROOTS · ' + placed + ' EARTH', STIHIYA_COLORS.grove);
  vibrate([80, 40, 80]);
}

// HERO_GRAMMAR §4 [Earth × Captain] — ANCIENTSCALE / ETERNAL BASTION
// Spec: Race-buff scales croc bonuses; +25% grove drops; ULT squad +3 shields +
// 5 earth cells. Charge cost: medium (period ~10).
// IMPLEMENTATION: dual buff lives in calcSynergyState (§6) → captainDual_*
// mirrored globals (race-scaling damage + fixed +25% grove drop weight; _RACE_PLURAL
// already includes crocodile: 'CROCODILES'). Fire body is the active board effect —
// converts a few random non-grove cells to grove + registers as absorbers (CAPTAIN
// ENABLE pattern, mirror ABYSSKING/CRIMSON).
// ULT ETERNAL BASTION (signature): +3 shields (cap-clamped) + 5 additional earth
// absorber cells.
async function fireAncientscale() {
  const hero = this;
  if (!hero || !hero.stihiya) return;
  const convertCount = Math.floor(2 * (typeof captainConversionBoost === 'number' ? captainConversionBoost : 1));
  const targets = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const v = grid[r][c];
    if (v && !v.startsWith('void_') && v !== hero.stihiya) targets.push([r, c]);
  }
  if (targets.length === 0) { vibrate([25, 25, 25]); return; }
  targets.sort(() => Math.random() - 0.5);
  const picks = targets.slice(0, convertCount);
  const cellEls = document.querySelectorAll('.grid .cell');
  for (const [r, c] of picks) cellEls[r * SIZE + c].classList.add('burning');
  await sleep(250);
  for (const [r, c] of picks) {
    grid[r][c] = hero.stihiya;
    // Captain conversion ALSO registers as absorber (race identity: tank-and-spank)
    groveAbsorbedByCell.set(r + '_' + c, 0);
  }
  render();
  vibrate([25, 25, 25]);
}
async function ultTwistAncientscale(ctx) {
  // Eternal Bastion — squad +3 shields + 5 earth absorber cells.
  const cap = MAX_SHIELD + 2 + (maxShieldBonus || 0);
  const before = shieldCount;
  shieldCount = Math.min(cap, shieldCount + 3);
  const gained = shieldCount - before;
  const placed = await _spawnGroveAbsorbers(5);
  flashText('ETERNAL BASTION · +' + gained + '🛡 +' + placed + 'EARTH', STIHIYA_COLORS.grove);
  vibrate([60, 40, 60, 40, 100]);
}

// MOSSWEAVER amp window per-placement decrement (mirrors KEYCRYPT/CRYOMIND pattern).
// Called from the per-placement post-hook so the activating placement is fully boosted.
function tickMossweaverSurge() {
  if (!mossweaverSurgeActive || mossweaverSurgeDuration <= 0) return;
  mossweaverSurgeDuration--;
  if (mossweaverSurgeDuration <= 0) {
    mossweaverSurgeActive = false;
    mossweaverSurgeMult   = 1.0;
  }
}

// ===== SPARKS (Phase 5 Block 4) =====
// 5 heroes × Light/Solar. Wires into Phase 5 Block 3 infrastructure
// (onSolarCellsCleared, consumeShieldsForBurst, SHIELDS-TO-DAMAGE).

// Universal helper — spawn N solar cells in random empties. Used by EMBERSPARK
// (Warrior CREATE) and SOLARLORD (Captain ENABLE). No per-cell metadata needed
// (Light's "side-system" IS shieldCount); cells just become regular grid solar
// tiles that produce shields when cleared via onSolarCellsCleared.
async function _spawnSolarCells(maxCount) {
  if (!MOTIFS_ENABLED.solar) return 0;
  if (!maxCount || maxCount <= 0) return 0;
  const empties = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (grid[r][c] === null) empties.push([r, c]);
  }
  if (empties.length === 0) return 0;
  empties.sort(() => Math.random() - 0.5);
  const picks = empties.slice(0, Math.min(maxCount, empties.length));
  const cellEls = document.querySelectorAll('.grid .cell');
  for (const [r, c] of picks) {
    grid[r][c] = 'solar';
    if (cellEls[r * SIZE + c]) cellEls[r * SIZE + c].classList.add('spawning');
    if (typeof maybeMarkRadiant === 'function') maybeMarkRadiant(r, c);
  }
  render();
  return picks.length;
}

// HERO_GRAMMAR §4 [Light × Warrior] — EMBERSPARK / SUN FORGE
// Spec (§2.4): "Создаёт light-cells (+1 shield на clear)" — Warrior is a
// **pure CREATOR**. No damage on fire. Damage flows through Hunter (RADIANCE
// SHIELDS-TO-DAMAGE — converts ALL shields to burst). EMBERSPARK seeds solar
// cells that produce shields on clear, LUMENWIND amps to +2 shields/clear,
// RADIANCE detonates the shield pool.
// Charge cost: fastest (combo ≥ 2 fires; cheapest setup per §2.3).
// HOTFIX 2026-04-26b — removed direct damage. Pure CREATE.
// ULT SUN CASCADE (signature): convert 5 random cells to solar (mass CREATE).
async function fireEmbersark(counts) {
  const created = await _spawnSolarCells(3);
  if (created > 0) flashText('SUN FORGE ×' + created, STIHIYA_COLORS.solar || '#E8B84A');
  vibrate([40, 20, 40]);
}
async function ultTwistEmbersark(ctx) {
  const placed = await _spawnSolarCells(5);
  if (placed > 0) flashText('SUN CASCADE · ' + placed, STIHIYA_COLORS.solar || '#E8B84A');
}

// HERO_GRAMMAR §4 [Light × Mage] — LUMENWIND / HALO WINDOW
// Spec: Light clears = +2 shields (vs +1) during amp window. Charge cost: medium-slow (period ~12).
// CONFORMS — AMPLIFIER role verb: opens 3-placement window where each onSolarCellsCleared
// produces +2 shields per cell instead of +1. NO state creation per Mage rule (shield is
// a separate pool, not a "charged state"). RADIANCE benefits from accumulated shields.
// ULT HALO OF SUNS (signature): instantly double current shieldCount (capped).
async function fireLumenwind(counts) {
  lumenwindHaloActive       = true;
  // 2026-04-27 — Block H.9b — WEAVE MASTERY (T2): window 3 → 5; +1 shield per
  // clear (3 vs 2 base). Default lumenwindHaloShieldsBonus=1 → 2 shields/clear.
  // T2 bumps the bonus to 2 → 3 shields/clear.
  lumenwindHaloShieldsBonus = 1;  // +1 extra → 2 total per clear
  if (_t2Bonus('spark_mage', 'mageWindow') != null) {
    lumenwindHaloShieldsBonus = 2;  // T2 boost — 3 shields per clear
  }
  const _t2Window = _t2Bonus('spark_mage', 'mageWindow');
  lumenwindHaloDuration     = (_t2Window != null) ? _t2Window : LUMENWIND_HALO_TURNS;
  const _shieldsPerClear = 1 + lumenwindHaloShieldsBonus;
  flashStateBanner('HALO WINDOW ×' + _shieldsPerClear + '🛡/clear', STIHIYA_COLORS.solar || '#E8B84A');
  vibrate([50, 30, 50]);
}
async function ultTwistLumenwind(ctx) {
  // Halo of Suns — instantly double shields (capped).
  const cap = MAX_SHIELD + 2 + (maxShieldBonus || 0);
  const before = shieldCount;
  shieldCount = Math.min(cap, shieldCount * 2);
  const gained = shieldCount - before;
  if (gained > 0) {
    flashText('HALO OF SUNS · ' + before + ' → ' + shieldCount + '🛡', STIHIYA_COLORS.solar || '#E8B84A');
  } else {
    flashText('HALO OF SUNS · ' + shieldCount + '🛡', STIHIYA_COLORS.solar || '#E8B84A');
  }
}

// HERO_GRAMMAR §4 [Light × Hunter] — RADIANCE / AURORA BURST
// Spec: SHIELDS-TO-DAMAGE single burst. Charge cost: fastest (combo ≥ 2).
// CONFORMS — DETONATOR role verb: consume shields × dmg-per-shield burst with primer-shot
// fallback. Damage scales with current shieldCount × SOLAR_BURST_DMG_PER_SHIELD (200).
// ULT AURORA BURST (signature): SHIELDS-TO-DAMAGE WITHOUT consuming shields (per spec) —
// uncapped variant; shieldCount persists for sustained burst-then-defend pattern.
async function fireRadiance(counts) {
  const shields = consumeShieldsForBurst();
  if (shields === 0) {
    flashText('NO SHIELDS', STIHIYA_COLORS.solar || '#E8B84A');
    dealDamage(180, true); // primer-shot fallback (Hunter rule per Combat Ref §4)
    vibrate([30, 30, 30]);
    return;
  }
  // 2026-04-27 — Block H.9b — SOLAR MASTER (T2): RADIANCE per-shield scaling
  // ×1.5 (so 200 → 300 dmg per shield). Applied to both fire and ULT paths.
  const _t2RadianceBonus = (typeof _t2Bonus === 'function') ? _t2Bonus('spark_hunter', 'shieldDmgScaleBonus') : null;
  const _perShield = SOLAR_BURST_DMG_PER_SHIELD * (1 + (_t2RadianceBonus || 0));
  const dmg = Math.floor(shields * _perShield);
  flashText('AURORA · ' + shields + '🛡 → ' + dmg, STIHIYA_COLORS.solar || '#E8B84A');
  dealDamage(dmg, shields >= 4, 0);
  vibrate(shields >= 4 ? [80, 40, 80, 40, 120] : [60, 30, 60]);
}
async function ultTwistRadiance(ctx) {
  // Aurora Burst — shields-to-damage WITHOUT consuming (spec): shieldCount preserved.
  const shields = shieldCount;
  if (shields === 0) {
    flashText('NO SHIELDS', STIHIYA_COLORS.solar || '#E8B84A');
    return;
  }
  // 2026-04-27 — Block H.9b — SOLAR MASTER (T2): RADIANCE per-shield scaling
  // ×1.5 (so 200 → 300 dmg per shield). Applied to both fire and ULT paths.
  const _t2RadianceBonus = (typeof _t2Bonus === 'function') ? _t2Bonus('spark_hunter', 'shieldDmgScaleBonus') : null;
  const _perShield = SOLAR_BURST_DMG_PER_SHIELD * (1 + (_t2RadianceBonus || 0));
  const dmg = Math.floor(shields * _perShield);
  flashText('AURORA BURST · ' + dmg + ' (kept ' + shields + '🛡)', STIHIYA_COLORS.solar || '#E8B84A');
  dealDamage(dmg, true);
  // shields NOT consumed — that's the ULT's defining trait per Combat Ref §9
}

// HERO_GRAMMAR §4 [Light × Tank] — AEGIS / SUN GUARD
// Spec: Auto-block 1 attack/turn + ULT shield distribution + 1 turn immunity.
// CONFORMS — PROTECTOR role verb: small dmg + +1 shield (existing tank pattern).
// Auto-block-1-attack mechanic merged into existing aegisActive flag (Golem race had
// once-per-battle save; Spark AEGIS extends to once-per-turn while in squad — implemented
// via per-battle counter).
// ULT EQUILIBRIUM (signature): +5 shields + 1-turn boss attack immunity (skip next swing).
async function fireAegis(counts) {
  const cap = MAX_SHIELD + 2 + (maxShieldBonus || 0);
  if (shieldCount < cap) shieldCount++;
  dealDamage(160, true);
  vibrate([50, 30, 50]);
}
async function ultTwistAegis(ctx) {
  // Equilibrium — +5 shields (cap-clamped) + skip next boss attack
  const cap = MAX_SHIELD + 2 + (maxShieldBonus || 0);
  const before = shieldCount;
  shieldCount = Math.min(cap, shieldCount + 5);
  const gained = shieldCount - before;
  // Bump attackCountdown to skip next swing (mirrors CRYOMIND TIME FROZEN pattern).
  const interval = (typeof currentBoss !== 'undefined' && currentBoss && currentBoss.attackInterval) || 8;
  attackCountdown += interval;
  if (typeof onFreezeApplied === 'function') onFreezeApplied(interval);
  flashText('EQUILIBRIUM · +' + gained + '🛡 + IMMUNE', STIHIYA_COLORS.solar || '#E8B84A');
  vibrate([80, 40, 80, 40, 120]);
}

// HERO_GRAMMAR §4 [Light × Captain] — SOLARLORD / ETERNAL DAWN
// Spec: Race-buff scales spark bonuses; +25% solar drops; ULT heals squad +25% HP +
// 2 shields each + 4 solar cells. Charge cost: medium (period ~10).
// IMPLEMENTATION: dual buff lives in calcSynergyState (§6) → captainDual_* mirrored
// globals (race-scaling damage + fixed +25% solar drop weight; _RACE_PLURAL already
// includes spark: 'SPARKS'). Fire body is the active board effect — converts a few
// random non-solar cells to solar (mirror of CRIMSON/ABYSSKING/ANCIENTSCALE pattern).
// ULT ETERNAL DAWN (signature): heal player to 25% over current cap + 2 shields + 4 solar cells.
async function fireSolarlord() {
  const hero = this;
  if (!hero || !hero.stihiya) return;
  const convertCount = Math.floor(2 * (typeof captainConversionBoost === 'number' ? captainConversionBoost : 1));
  const targets = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const v = grid[r][c];
    if (v && !v.startsWith('void_') && v !== hero.stihiya) targets.push([r, c]);
  }
  if (targets.length === 0) { vibrate([25, 25, 25]); return; }
  targets.sort(() => Math.random() - 0.5);
  const picks = targets.slice(0, convertCount);
  const cellEls = document.querySelectorAll('.grid .cell');
  for (const [r, c] of picks) cellEls[r * SIZE + c].classList.add('burning');
  await sleep(250);
  for (const [r, c] of picks) {
    grid[r][c] = hero.stihiya;
    if (typeof maybeMarkRadiant === 'function') maybeMarkRadiant(r, c);
  }
  render();
  vibrate([25, 25, 25]);
}
async function ultTwistSolarlord(ctx) {
  // Eternal Dawn — heal +25% max HP + 2 shields + 4 solar cells.
  const healAmount = Math.floor(currentMaxHP * 0.25);
  hp = Math.min(currentMaxHP, hp + healAmount);
  const cap = MAX_SHIELD + 2 + (maxShieldBonus || 0);
  const beforeShields = shieldCount;
  shieldCount = Math.min(cap, shieldCount + 2);
  const shieldsGained = shieldCount - beforeShields;
  const placed = await _spawnSolarCells(4);
  flashText('ETERNAL DAWN · +' + healAmount + 'HP +' + shieldsGained + '🛡 +' + placed + '☀',
    STIHIYA_COLORS.solar || '#E8B84A');
  vibrate([60, 40, 60, 40, 100]);
}

// LUMENWIND amp window per-placement decrement (mirrors MOSSWEAVER pattern).
function tickLumenwindHalo() {
  if (!lumenwindHaloActive || lumenwindHaloDuration <= 0) return;
  lumenwindHaloDuration--;
  if (lumenwindHaloDuration <= 0) {
    lumenwindHaloActive = false;
    lumenwindHaloShieldsBonus = 1;
  }
}

// ===== FIRE HERO DISPATCHER =====
// Combo-cell fire path: applies all Phase 2-5 context multipliers, calls hero.fire(counts),
// then runs the optional fireTierDelta hook. ULT fires go through ultRoleDispatch above.
async function fireHero(hero, counts) {
  if (gameEnded) return;
  heroFireCount++;
  markFired(hero.id);
  // 2026-04-27 — Anti-Deadlock: reset Hunter dormancy counter when Hunter fires.
  // Spec §7.2 condition #2: "Hunter has not fired in past 3 turns".
  if (hero && hero.newRole === 'hunter') hero.turnsSinceLastFire = 0;
  flashHero(hero);
  vibrate([30, 50, 30]);
  // V2.0 Stage 5 Block 5.1: track hero currently executing for kill-shot attribution in dealDamage
  _currentFiringHero = hero;
  // Narrator by hero role (UI Spec Part 5.4)
  if (hero.role === 'guard') speakNarrator('guardFire');
  else if (hero.role === 'striker') speakNarrator('strikerFire');
  else if (hero.role === 'weaver') speakNarrator('weaverFire');
  await sleep(550);
  // Apply stihiya passive damage multiplier × hero upgrade damage multiplier
  _passiveDmgContext = (currentPassiveDmgMult[hero.stihiya] || 1) * getHeroStats(hero).dmgMult;
  // V2.0 Block 3.2: capture counts for Mage Double Fire (replay needs original stihiya tallies)
  lastFireCounts = counts;
  // V2.0 Block 3.2: WARBAND STRIKE — +50% damage on warrior fires during 2-placement window
  const _warbandStrikeApplies = (warbandStrikeActive && warbandStrikeWindow > 0 && hero.newRole === 'warrior');
  if (_warbandStrikeApplies) _warbandStrikeContext = 1.5;
  // V2.0 Block 3.3: VANGUARD HUNTER MARK — +40% dmg on ANY fire during window. Consumes on first dmg tick.
  const _hunterMarkApplies = (hunterMarkActive && hunterMarkWindow > 0);
  if (_hunterMarkApplies) {
    _hunterMarkContext = 1.4;
    _hunterMarkConsumed = false;
  }
  // V2.0 Block 4.1: GROMMAR RALLY — +100% dmg on warrior/hunter fires (2-placement window). Consumes on first dmg.
  const _grommarRallyApplies = (grommarRallyWindow > 0 && (hero.newRole === 'warrior' || hero.newRole === 'hunter'));
  if (_grommarRallyApplies) {
    _grommarRallyContext = 2.0;
    _grommarRallyConsumed = false;
  }
  // V2.0 Block 4.1: BLACKFANG PACK MARK — +30% dmg on ANY hero fire (turn-scoped, set BY Blackfang's fire body).
  // Captured at fire START, so Blackfang's own dealDamage doesn't get the bonus he sets at the END of his fire.
  // V2.0 Stage 5 Block 5.2: dynamic multiplier from blackfangPackMult (T0=0.30, T1+=0.40)
  const _packMarkApplies = packMarkActive;
  if (_packMarkApplies) {
    _packMarkContext = 1 + blackfangPackMult;
    _packMarkConsumed = false;
  }
  // V2.0 Block 4.4: HELIOS LION'S ROAR — +20% dmg on ANY fire while window open. NO per-fire consumption
  // V2.0 Stage 5 Block 5.5: heliosRoarMult (0.20→0.30 at T1+); heliosRoarFlatBonus (+50 at T3)
  const _helioRoarApplies = (helioRoarWindow > 0);
  if (_helioRoarApplies) {
    _helioRoarContext = 1 + heliosRoarMult;  // T0=1.20, T1+=1.30
    if (heliosRoarFlatBonus > 0) {
      _passiveDmgContext *= (1 + heliosRoarFlatBonus / 500);  // ~+10% proxy (flat +50 on 500-dmg avg)
    }
  }
  // V2.0 Stage 5 Block 5.2: IRONBELLY T3 "next fire +50%" one-shot bonus (consumed this fire)
  const _ironbellyBonusApplies = (ironbellyNextFireBonus > 0);
  if (_ironbellyBonusApplies) {
    // Piggy-back on _helioRoarContext slot for one-shot mult (non-conflicting: both window-scoped)
    // Actually use a fresh multiplier entry: temporarily amplify _passiveDmgContext which already flows through dealDamage
    _passiveDmgContext *= (1 + ironbellyNextFireBonus);
    ironbellyNextFireBonus = 0;  // consumed once
    flashText('CHARGED BURST +50%', '#FF6600');
  }
  // V2.0 Stage 5 Block 5.3: MAELEN T3 all-fire bonus — flat +50 to all hero fires this turn
  // Applied as small multiplier approximation (1 + 50/avgFireDmg). Using conservative +10% flat bump.
  const _maelenBonusApplies = (maelenAllFireBonus > 0);
  if (_maelenBonusApplies) {
    _passiveDmgContext *= 1.10;  // ~+10% ≈ +50 on avg 500-dmg fires, bounded
  }
  // V2.0 Stage 5 Block 5.5: LEOREX T3 team fire bonus — +50 per lion to ALL hero fires
  // Applied as passive multiplier scaled to fire volume (proxy: +10% per lion on 500-dmg avg)
  if (leorexTeamFireBonus > 0) {
    _passiveDmgContext *= (1 + leorexTeamFireBonus / 500);
  }
  // V2.0 Stage 5 Block 5.4: VOXI T3 Plague Aura — boss takes +20% dmg for N turns
  const _plagueAuraApplies = (plagueAuraTurns > 0);
  if (_plagueAuraApplies) {
    _passiveDmgContext *= 1.20;
  }
  // V2.0 Stage 5 Block 5.5: SERAPHINA T3 INFERNO MODE — solar clears detonate for +20% dmg window
  // Decrement happens in afterPlacement (per-placement, not per-fire, so window lasts N placements)
  const _infernoApplies = (inferno_mode_window > 0 && hero.stihiya === 'solar');
  if (_infernoApplies) {
    _passiveDmgContext *= 1.20;
  }
  // V2.0 Stage 5 Block 5.6: NIGHTLORD T3 post-Encore — +30% umbra fires during boost window
  const _nightlordBoostApplies = (nightlordPostEncoreBoost > 0 && hero.stihiya === 'umbra');
  if (_nightlordBoostApplies) {
    _passiveDmgContext *= 1.30;
  }
  // 2026-05-02 — COMBAT v2.1 P3 §3.5: Captain Mark consumption on hero fire.
  // If this hero is the marked one, consumes the mark and applies +30% damage
  // (folded into _passiveDmgContext) + addPressure(10) + Stagger ext at T2+.
  try {
    if (typeof _consumeCaptainMarkBonus === 'function') {
      const mark = _consumeCaptainMarkBonus(hero, 'fire');
      if (mark) {
        _passiveDmgContext *= mark.dmgMult;
        try { flashText('⚐ MARKED · +' + Math.round((mark.dmgMult - 1) * 100) + '% / +' + mark.pressureBonus + '⚡', '#FFD53D'); } catch (e) {}
      }
    }
  } catch (e) { console.warn('[Captain Mark fire] failed:', e); }
  try {
    await hero.fire(counts);
  } finally {
    _passiveDmgContext = 1;
    if (_warbandStrikeApplies) _warbandStrikeContext = 1;
    if (_hunterMarkApplies) {
      _hunterMarkContext = 1;
      // Only consume the Mark if damage actually flowed through dealDamage (shield-only fires preserve it)
      if (_hunterMarkConsumed) {
        hunterMarkWindow = 0;
        flashText('MARK CONSUMED +40%', '#E85D4A');
      }
    }
    if (_grommarRallyApplies) {
      _grommarRallyContext = 1;
      // V2.0 Stage 5 Block 5.2: T3 grommarRallyPermanent — skip consume (window stays open entire duration)
      if (_grommarRallyConsumed && !grommarRallyPermanent) {
        grommarRallyWindow = 0;
        flashText('RALLY CONSUMED +100%', '#FFD53D');
      } else if (_grommarRallyConsumed && grommarRallyPermanent) {
        flashText('RALLY PERMANENT +100%', '#FFD53D');
        // Optional: T2 grommarRallyShield — +1🛡 per warrior/hunter fire during Rally
        if (grommarRallyShield && (hero.newRole === 'warrior' || hero.newRole === 'hunter')) {
          const cap = MAX_SHIELD + 2 + maxShieldBonus;
          if (shieldCount < cap) { shieldCount++; flashStateBanner('RALLY SHIELD +1🛡', '#FFD53D'); }
        }
      }
    }
    if (_packMarkApplies) {
      _packMarkContext = 1;
      if (_packMarkConsumed) {
        // V2.0 Stage 5 Block 5.2: Blackfang T2 packMarkChain — allow Pack Mark to survive 2 fires
        blackfangPackRemaining--;
        if (blackfangPackRemaining <= 0) {
          packMarkActive = false;
          blackfangPackRemaining = 0;
          flashText('PACK MARK +' + Math.round(blackfangPackMult*100) + '%', '#FF4D1F');
        } else {
          flashText('PACK MARK ×' + blackfangPackRemaining + ' LEFT', '#FF4D1F');
        }
      }
    }
    if (_helioRoarApplies) _helioRoarContext = 1;  // no consumption — window-scoped
    // V2.0 Stage 5 Block 5.1: clear firing-hero pointer at end of fire execution
    _currentFiringHero = null;
  }
  // V2.0 Stage 5 Block 5.1: tier-delta hook — runs AFTER base fire + context cleanup.
  // Delta can mutate global state (e.g., override Pack Mark bonus) but gets no implicit multipliers.
  if (typeof hero.fireTierDelta === 'function' && (hero.tier || 0) > 0) {
    try {
      _currentFiringHero = hero;
      await hero.fireTierDelta.call(hero, counts, hero.tier);
    } catch (e) {
      console.warn('fireTierDelta error for ' + hero.id + ':', e);
    } finally {
      _currentFiringHero = null;
    }
  }
  // V2.0 Stage 3 (Block 3.1): central post-hook for role-based formation effects
  // Awaited because mage-double-fire needs to complete synchronously (prevents race with next fire).
  await onHeroFireCompleted(hero);
  render();
  await sleep(150);
}

// 2026-05-02 — COMBAT v2.1 P3 §3.4: Tank state.
// `aegisProtocolTurnsActive` is the T3 ULT window — while > 0, all incoming
// damage routes to Pressure (zero HP loss). Tick on EOT alongside Stagger.
// `_mythicTankSquadBoostActive` is the per-Stagger flag that adds squad-wide
// +30/35% damage in dealDamage. Set via onStaggerEnter hook, cleared in
// enterActiveState. `_t2TankReactiveFiredThisStagger` prevents repeated
// auto-shield spawns within a single low-HP event window.
let aegisProtocolTurnsActive       = 0;
let aegisProtocolHeroId            = null;   // who fired (for FX color/race)
let _mythicTankSquadBoostActive    = 0;      // 0 = inactive, else mult (1.30 / 1.35)
let _t2TankReactiveFiredThisFight  = 0;      // increments per trigger (telemetry)
let _t2TankReactiveLastTriggerHP   = -1;     // anti-spam: only re-fire after HP recovers above 50%

// 2026-05-02 — COMBAT v2.1 P3 §3.4: Tank pressure conversion ratio.
// Returns total ratio summed across all Tanks in HERO_DECK (T0=1.0, T1+=1.2).
// Spec §3.4 sample: tier 0 → 1.0, tier 1+ → 1.2; T2 doesn't add ratio (adds
// reactive doubling); T3 doesn't add ratio (replaces with AEGIS PROTOCOL).
// All 5 Tank rows in spec §4.1-§4.5 confirm uniform 1.2× at T1.
function _computeTankPressureConversion(dmg) {
  if (typeof HERO_DECK === 'undefined' || !Array.isArray(HERO_DECK)) return 0;
  let totalRatio = 0;
  for (const h of HERO_DECK) {
    if (!h || h.newRole !== 'tank') continue;
    const tier = (typeof heroUpgrades !== 'undefined' && heroUpgrades[h.id]) || 0;
    let ratio = 1.0;       // T0 baseline
    if (tier >= 1) ratio = 1.2;
    totalRatio += ratio;
  }
  if (totalRatio <= 0 || dmg <= 0) return 0;
  return Math.floor(dmg * totalRatio);
}

// 2026-05-02 — COMBAT v2.1 P3 §3.4: T2 reactive low-HP doubling.
// Returns adjusted mitigation when at least one Tank in squad is T2+ AND
// player HP <= 50%. Mitigation doubles, capped at 70%. Auto-shield trigger
// is handled separately in _maybeFireT2TankReactive() to avoid coupling.
function _getT2TankMitigationBoost(baseMitigation) {
  if (typeof HERO_DECK === 'undefined' || !Array.isArray(HERO_DECK)) return baseMitigation;
  if (typeof hp !== 'number' || typeof currentMaxHP !== 'number') return baseMitigation;
  const hpRatio = hp / Math.max(1, currentMaxHP);
  if (hpRatio > 0.5) return baseMitigation;
  // Find any T2+ Tank in deck
  const hasT2Tank = HERO_DECK.some(h => h && h.newRole === 'tank'
    && ((typeof heroUpgrades !== 'undefined' && heroUpgrades[h.id]) || 0) >= 2);
  if (!hasT2Tank) return baseMitigation;
  // Double mitigation, cap at 70%
  return Math.min(0.70, baseMitigation * 2);
}

// Fire the auto-shield side of the T2 reactive once per low-HP event.
// "Once per fight low-HP descent" — re-arms if HP recovers above 50% then drops.
function _maybeFireT2TankReactive() {
  if (typeof HERO_DECK === 'undefined' || !Array.isArray(HERO_DECK)) return;
  if (typeof hp !== 'number' || typeof currentMaxHP !== 'number') return;
  const hpRatio = hp / Math.max(1, currentMaxHP);
  // Re-arm: if HP previously triggered and we're now back above 50%, clear marker
  if (hpRatio > 0.5) { _t2TankReactiveLastTriggerHP = -1; return; }
  // Already triggered at lower HP this descent? No re-fire.
  if (_t2TankReactiveLastTriggerHP !== -1 && hp <= _t2TankReactiveLastTriggerHP) return;
  const t2Tank = HERO_DECK.find(h => h && h.newRole === 'tank'
    && ((typeof heroUpgrades !== 'undefined' && heroUpgrades[h.id]) || 0) >= 2);
  if (!t2Tank) return;
  _t2TankReactiveLastTriggerHP = hp;
  _t2TankReactiveFiredThisFight++;
  // Auto-shield +1 (capped at MAX_SHIELD + 2 + maxShieldBonus, same as ULT path)
  try {
    const cap = (typeof MAX_SHIELD === 'number' ? MAX_SHIELD : 6)
              + 2 + (typeof maxShieldBonus === 'number' ? maxShieldBonus : 0);
    if (typeof shieldCount === 'number') {
      shieldCount = Math.min(cap, shieldCount + 1);
    }
  } catch (e) {}
  try { if (typeof flashStateBanner === 'function') flashStateBanner('AEGIS REACTIVE — ' + (t2Tank.name || 'TANK'), '#5DCA79'); } catch (e) {}
  try { vibrate([60, 40, 60]); } catch (e) {}
  try { if (typeof renderHP === 'function') renderHP(); } catch (e) {}
}

// 2026-05-02 — COMBAT v2.1 P3 §3.4: AEGIS PROTOCOL T3 ULT.
// Fires on ULT for any Tank at T3+. Duration: 3 turns base, 4 for THUNDERBEAT
// (rock_tank) and AEGIS (spark_tank) per spec §4.2 + §4.5.
const AEGIS_PROTOCOL_DURATION = Object.freeze({
  pirate_tank:    3,   // IRONBELLY  §4.1
  rock_tank:      4,   // THUNDERBEAT §4.2 (vs 3)
  shark_tank:     3,   // BULWARK    §4.3 (3 + frozen ward — TODO #3.F polish)
  crocodile_tank: 3,   // IRONSCALE  §4.4 (3 + Iron Hide +10% mit — TODO #3.F polish)
  spark_tank:     4,   // AEGIS      §4.5 (vs 3, + sun aura — TODO #3.F polish)
});

function activateAegisProtocol(heroId) {
  const dur = AEGIS_PROTOCOL_DURATION[heroId] || 3;
  aegisProtocolTurnsActive = dur;
  aegisProtocolHeroId      = heroId;
  try { if (typeof flashStateBanner === 'function') flashStateBanner('AEGIS PROTOCOL — ' + dur + 'T', '#FFD700'); } catch (e) {}
  try { if (typeof showAegisProtocolEntryFX === 'function') showAegisProtocolEntryFX(dur); } catch (e) {}
  try { vibrate([120, 60, 120, 60, 200]); } catch (e) {}
  try { if (typeof logEvent === 'function') logEvent('aegis_protocol_activated', { heroId, dur }); } catch (e) {}
}

function tickAegisProtocol() {
  if (aegisProtocolTurnsActive <= 0) return;
  aegisProtocolTurnsActive--;
  if (aegisProtocolTurnsActive <= 0) {
    try { if (typeof flashStateBanner === 'function') flashStateBanner('AEGIS PROTOCOL ENDED', '#9B7AD6'); } catch (e) {}
    aegisProtocolHeroId = null;
  }
}

// 2026-05-02 — COMBAT v2.1 P3 §3.4: Mythic Tank squad-wide damage boost.
// Per-hero override: THUNDERBEAT (rock) +35%, AEGIS (spark) +35%, others +30%.
// Activated by onStaggerEnter hook registered at battle init when a Mythic
// Tank is in HERO_DECK. Cleared in enterActiveState.
const MYTHIC_TANK_STAGGER_MULT = Object.freeze({
  pirate_tank:    1.30,
  rock_tank:      1.35,   // THUNDERBEAT §4.2 (+35%)
  shark_tank:     1.30,
  crocodile_tank: 1.30,
  spark_tank:     1.35,   // AEGIS §4.5 (+35%)
});

function _getMythicTankStaggerMult() {
  // Returns the active multiplier (1.0 if inactive). Used in dealDamage stack.
  if (!_mythicTankSquadBoostActive) return 1.0;
  return _mythicTankSquadBoostActive;
}

// 2026-05-02 — COMBAT v2.1 P3 §3.4 visual treatment.
// Minimal floating-text variants — gold particle stream lands in PR #3.F.
function showTankConversionFX(amount) {
  try { flashText('+' + amount + ' ⛨→⚡ TANK', '#FFD53D'); } catch (e) {}
}
function showAegisProtocolFX(amount) {
  try { flashText('+' + amount + ' ⛨ AEGIS', '#FFC700'); } catch (e) {}
}
function showAegisProtocolEntryFX(dur) {
  try { flashText('AEGIS PROTOCOL · ' + dur + 'T · DAMAGE → PRESSURE', '#FFD700'); } catch (e) {}
}

// 2026-05-02 — COMBAT v2.1 P3 §14.1: register Tank hooks per battle init.
// Called from registerPhase3HeroHooks() (wired into battle-init paths).
// Mythic onStaggerEnter sets _mythicTankSquadBoostActive based on hero id.
function registerPhase3TankHooks() {
  if (typeof HERO_DECK === 'undefined' || !Array.isArray(HERO_DECK)) return;
  for (const h of HERO_DECK) {
    if (!h || h.newRole !== 'tank') continue;
    const isMythic = (typeof isHeroMythic === 'function') && isHeroMythic(h.id);
    if (!isMythic) continue;
    const mult = MYTHIC_TANK_STAGGER_MULT[h.id] || 1.30;
    if (typeof _registerPhase3Hook === 'function') {
      _registerPhase3Hook('onStaggerEnter', h.id, () => {
        _mythicTankSquadBoostActive = mult;
        try { if (typeof flashStateBanner === 'function') flashStateBanner('SQUAD ×' + mult.toFixed(2) + ' — ' + (h.name || 'TANK'), '#FFD700'); } catch (e) {}
      });
      _registerPhase3Hook('onStaggerExit', h.id, () => {
        _mythicTankSquadBoostActive = 0;
      });
    }
  }
}

// 2026-05-02 — COMBAT v2.1 P3: Phase 3 hero-hook registry registration.
// Aggregator that registers all role-specific Phase 3 hooks. PR #3.B wires
// Tank; #3.C adds Captain; #3.D-F finish remaining roles. Called from battle
// init alongside _resetPhase3Hooks().
function registerPhase3HeroHooks() {
  try { if (typeof registerPhase3TankHooks === 'function') registerPhase3TankHooks(); } catch (e) { console.warn('[P3 Tank hook reg] failed:', e); }
  try { if (typeof registerPhase3CaptainHooks === 'function') registerPhase3CaptainHooks(); } catch (e) { console.warn('[P3 Captain hook reg] failed:', e); }
  // PR #3.D-F: per-race / per-hero hooks
}

// 2026-05-02 — COMBAT v2.1 P3 §3.4: reset Tank state on battle init.
// Called alongside _resetPhase3Hooks() / resetStaggerState().
function _resetPhase3TankState() {
  aegisProtocolTurnsActive       = 0;
  aegisProtocolHeroId            = null;
  _mythicTankSquadBoostActive    = 0;
  _t2TankReactiveFiredThisFight  = 0;
  _t2TankReactiveLastTriggerHP   = -1;
}

if (typeof window !== 'undefined') {
  window._computeTankPressureConversion = _computeTankPressureConversion;
  window._getT2TankMitigationBoost      = _getT2TankMitigationBoost;
  window._maybeFireT2TankReactive       = _maybeFireT2TankReactive;
  window.activateAegisProtocol          = activateAegisProtocol;
  window.tickAegisProtocol              = tickAegisProtocol;
  window._getMythicTankStaggerMult      = _getMythicTankStaggerMult;
  window.showTankConversionFX           = showTankConversionFX;
  window.showAegisProtocolFX            = showAegisProtocolFX;
  window.registerPhase3TankHooks        = registerPhase3TankHooks;
  window.registerPhase3HeroHooks        = registerPhase3HeroHooks;
  window._resetPhase3TankState          = _resetPhase3TankState;
}

// COMBAT v2.1 PHASE 3 PR #3.C — CAPTAIN MARK SYSTEM
// Per /Restructure/BLOCKSWORN_COMBAT_V21_PHASE_3_HERO_TIERS.md §3.5 + §4 + §7.5 + §7.7.
// Captain becomes "Squad Conductor" — per-turn tactical decision-making:
//   T0:     race buff + DOMINION ULT preserved (existing)
//   T1:     MARK SYSTEM unlocks. Per-turn modal: pick squad hero. Marked
//           hero's next fire = +30% damage + +10 Pressure. Bonus consumed.
//   T2:     marked hero's fire extends Stagger +1t (NIGHTLORD/SOLARLORD +2t).
//   T3:     mark works on ANY squad action (fires, ULTs, shields). Universal.
//   Mythic: pre-set Stagger trigger threshold 50/75/100 at battle start.
//           NIGHTLORD overrides with 50/60/75 (aggressive options).
// PR #3.F adds visual polish (gold border on marked hero, FTUE intro).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 2026-05-02 — COMBAT v2.1 P3 §3.5: Captain Mark state.
// captainMarkedHeroId — currently marked hero (null = no mark / consumed).
// mythicCaptainStaggerThreshold — Stagger trigger threshold; defaults to
//   PRESSURE_MAX (100). Mythic Captain at battle start picks 50/75/100.
// _captainMarkShownThisTurn — anti-spam: only show modal once per player turn.
// _captainMarksFiredThisFight — telemetry counter.
let captainMarkedHeroId            = null;
let mythicCaptainStaggerThreshold  = (typeof PRESSURE_MAX === 'number') ? PRESSURE_MAX : 100;
let _captainMarkShownThisTurn      = false;
let _captainMarksFiredThisFight    = 0;

// Per-hero Mythic threshold options (spec §4.2 NIGHTLORD = 50/60/75 aggressive).
// All other Mythic Captains use baseline 50/75/100.
const MYTHIC_CAPTAIN_THRESHOLDS = Object.freeze({
  pirate_captain:    [50, 75, 100],
  rock_captain:      [50, 60, 75],     // NIGHTLORD §4.2 aggressive
  shark_captain:     [50, 75, 100],
  crocodile_captain: [50, 75, 100],
  spark_captain:     [50, 75, 100],
});

// Per-hero T2 Stagger extension on marked fire (spec §4.2/§4.5: NIGHTLORD +2,
// SOLARLORD +2, others +1).
const CAPTAIN_T2_STAGGER_EXTEND = Object.freeze({
  pirate_captain:    1,
  rock_captain:      2,    // NIGHTLORD §4.2
  shark_captain:     1,
  crocodile_captain: 1,
  spark_captain:     2,    // SOLARLORD §4.5
});

// 2026-05-02 — COMBAT v2.1 P3 §3.5: Captain detection helpers.
function _findCaptainInDeck() {
  if (typeof HERO_DECK === 'undefined' || !Array.isArray(HERO_DECK)) return null;
  return HERO_DECK.find(h => h && h.newRole === 'captain') || null;
}

function _getCaptainTier() {
  const cap = _findCaptainInDeck();
  if (!cap) return -1;
  return (typeof heroUpgrades !== 'undefined' && heroUpgrades[cap.id]) || 0;
}

function _hasT1CaptainInDeck() {
  return _getCaptainTier() >= 1;
}

// Mark setter — banners + state. UI calls this when player picks.
function setCaptainMark(heroId) {
  if (!heroId) { clearCaptainMark(); return; }
  captainMarkedHeroId = heroId;
  try {
    const hero = (typeof HERO_DECK !== 'undefined' && Array.isArray(HERO_DECK))
                 ? HERO_DECK.find(h => h && h.id === heroId) : null;
    if (typeof flashStateBanner === 'function') {
      flashStateBanner('MARKED · ' + (hero && hero.name || heroId.toUpperCase()), '#FFD53D');
    }
    if (typeof renderCaptainMarkBadge === 'function') renderCaptainMarkBadge();
  } catch (e) {}
}

function clearCaptainMark() {
  captainMarkedHeroId = null;
  try { if (typeof renderCaptainMarkBadge === 'function') renderCaptainMarkBadge(); } catch (e) {}
}

// Returns the bonus payload if `actingHero` is the marked one, else null.
// CONSUMES the mark on call. Caller folds dmgMult into context, calls
// addPressure for the bonus, and extends Stagger if tier ≥ 2.
//   T1: dmgMult=1.30, pressureBonus=10
//   T2: + Stagger +1t (or +2t per CAPTAIN_T2_STAGGER_EXTEND override)
//   T3: applies on ANY action (caller passes actionType)
function _consumeCaptainMarkBonus(actingHero, actionType) {
  if (!captainMarkedHeroId || !actingHero || actingHero.id !== captainMarkedHeroId) return null;
  const captain = _findCaptainInDeck();
  if (!captain) return null;
  const tier = (typeof heroUpgrades !== 'undefined' && heroUpgrades[captain.id]) || 0;
  if (tier < 1) return null;
  // T1/T2: only consumed by hero fires. T3+: consumed by any action.
  const isFire = (actionType === 'fire' || !actionType);
  if (!isFire && tier < 3) return null;

  // Apply pressure bonus inline (single-source-of-truth; caller doesn't repeat).
  if (typeof addPressure === 'function') addPressure(10, 'captain_mark');

  // T2+: extend Stagger window if currently in Stagger.
  let extended = 0;
  if (tier >= 2 && typeof bossState !== 'undefined' && bossState === BOSS_STATE_STAGGER) {
    const ext = CAPTAIN_T2_STAGGER_EXTEND[captain.id] || 1;
    if (typeof extendStaggerState === 'function') {
      extendStaggerState(ext);
      extended = ext;
    }
  }

  // Fire centralized hook so other systems can observe (FTUE, telemetry).
  try { if (typeof _firePhase3Hook === 'function') {
    _firePhase3Hook('onCaptainMark', { heroId: captain.id, marked: actingHero.id, tier, actionType: actionType || 'fire', extended });
  } } catch (e) {}
  _captainMarksFiredThisFight++;

  // Consume mark — clear state.
  const payload = { dmgMult: 1.30, pressureBonus: 10, staggerExtended: extended, tier };
  clearCaptainMark();
  return payload;
}

// 2026-05-02 — COMBAT v2.1 P3 §3.5: Mythic Captain Stagger threshold.
// Default = PRESSURE_MAX (100). Mythic at battle start picks one of allowed
// options. Replaces hardcoded PRESSURE_MAX in addPressure stagger trigger.
function getStaggerTriggerThreshold() {
  if (typeof PRESSURE_MAX !== 'number') return mythicCaptainStaggerThreshold;
  return Math.min(PRESSURE_MAX, mythicCaptainStaggerThreshold);
}

function setMythicStaggerThreshold(threshold) {
  const cap = _findCaptainInDeck();
  const allowed = (cap && MYTHIC_CAPTAIN_THRESHOLDS[cap.id]) || [50, 75, 100];
  if (allowed.indexOf(threshold) < 0) return false;
  mythicCaptainStaggerThreshold = threshold;
  try { if (typeof flashStateBanner === 'function') flashStateBanner('STAGGER THRESHOLD · ' + threshold, '#FFA500'); } catch (e) {}
  return true;
}

// 2026-05-02 — COMBAT v2.1 P3 §7.5: Captain Mark modal UI.
// Lazily-built DOM. Called from end of maybeBossAttack (= start of next player
// turn) when T1+ Captain in deck and mark not yet set this turn.
function _ensureCaptainMarkModal() {
  if (typeof document === 'undefined') return null;
  let modal = document.getElementById('captainMarkModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'captainMarkModal';
  modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.72);' +
                       'align-items:center;justify-content:center;backdrop-filter:blur(6px);';
  modal.innerHTML = '<div style="background:linear-gradient(180deg,#1a1830,#0d0c1a);' +
                       'border:2px solid #FFD53D;border-radius:14px;padding:22px 26px;max-width:420px;' +
                       'box-shadow:0 0 32px rgba(255,213,61,0.45);color:#fff;font-family:inherit;">' +
                     '<div style="font-size:18px;font-weight:700;color:#FFD53D;margin-bottom:14px;letter-spacing:0.06em;">CAPTAIN\'S MARK</div>' +
                     '<div style="font-size:13px;opacity:0.85;margin-bottom:14px;">Choose a hero to MARK this turn:</div>' +
                     '<div id="captainMarkButtons" style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;"></div>' +
                     '<div style="font-size:11px;opacity:0.7;line-height:1.4;margin-bottom:12px;">' +
                       'Marked hero\'s next fire: <b style="color:#FFD53D;">+30% damage + +10 Pressure</b></div>' +
                     '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">' +
                       '<button id="captainMarkSkip" style="background:transparent;border:1px solid #555;color:#aaa;border-radius:6px;padding:8px 14px;cursor:pointer;font-size:12px;">Skip turn</button>' +
                       '<span id="captainMarkTimer" style="font-size:12px;color:#FFD53D;font-variant-numeric:tabular-nums;">3s</span>' +
                     '</div></div>';
  document.body.appendChild(modal);
  return modal;
}

let _captainMarkModalTimer = null;
function _maybeShowCaptainMarkUI() {
  if (typeof gameEnded !== 'undefined' && gameEnded) return;
  if (typeof bossHP === 'number' && bossHP <= 0) return;
  if (_captainMarkShownThisTurn) return;
  if (!_hasT1CaptainInDeck()) return;
  if (captainMarkedHeroId) return;        // already marked this turn (set last turn but not consumed)
  const captain = _findCaptainInDeck();
  if (!captain) return;
  const modal = _ensureCaptainMarkModal();
  if (!modal) return;
  // Build hero buttons (exclude Captain herself per spec §3.5).
  const btnRoot = modal.querySelector('#captainMarkButtons');
  if (btnRoot) {
    btnRoot.innerHTML = '';
    if (typeof HERO_DECK !== 'undefined' && Array.isArray(HERO_DECK)) {
      HERO_DECK.forEach(h => {
        if (!h || h.id === captain.id) return;
        const b = document.createElement('button');
        b.textContent = h.name || h.id;
        b.style.cssText = 'background:#2a2548;border:1px solid #FFD53D;color:#fff;border-radius:8px;' +
                          'padding:10px 14px;cursor:pointer;font-size:13px;text-align:left;';
        b.onclick = () => { _hideCaptainMarkUI(); setCaptainMark(h.id); };
        btnRoot.appendChild(b);
      });
    }
  }
  const skipBtn = modal.querySelector('#captainMarkSkip');
  if (skipBtn) skipBtn.onclick = () => { _hideCaptainMarkUI(); /* no mark this turn */ };
  modal.style.display = 'flex';
  _captainMarkShownThisTurn = true;
  // 3-second auto-skip per spec §7.5.
  let remaining = 3;
  const timerEl = modal.querySelector('#captainMarkTimer');
  if (timerEl) timerEl.textContent = remaining + 's';
  if (_captainMarkModalTimer) clearInterval(_captainMarkModalTimer);
  _captainMarkModalTimer = setInterval(() => {
    remaining--;
    if (timerEl) timerEl.textContent = remaining + 's';
    if (remaining <= 0) {
      clearInterval(_captainMarkModalTimer);
      _captainMarkModalTimer = null;
      _hideCaptainMarkUI();
    }
  }, 1000);
  // FTUE intro — first-time-only (registered hook fired separately by spec §8.2).
  try { if (typeof _maybeTriggerCaptainMarkIntro === 'function') _maybeTriggerCaptainMarkIntro(); } catch (e) {}
}

function _hideCaptainMarkUI() {
  if (_captainMarkModalTimer) { clearInterval(_captainMarkModalTimer); _captainMarkModalTimer = null; }
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('captainMarkModal');
  if (modal) modal.style.display = 'none';
}

// Reset per-turn flag — called from end of maybeBossAttack (after the modal
// trigger). When set, prevents re-show if player closes/reopens the same turn.
function _resetCaptainMarkPerTurn() {
  _captainMarkShownThisTurn = false;
}

// 2026-05-02 — COMBAT v2.1 P3 §7.7: Mythic threshold prompt.
function _ensureMythicThresholdModal() {
  if (typeof document === 'undefined') return null;
  let modal = document.getElementById('mythicThresholdModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'mythicThresholdModal';
  modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,0.78);' +
                       'align-items:center;justify-content:center;backdrop-filter:blur(8px);';
  modal.innerHTML = '<div style="background:linear-gradient(180deg,#1a1830,#0d0c1a);' +
                       'border:2px solid #FFA500;border-radius:14px;padding:24px 28px;max-width:440px;' +
                       'box-shadow:0 0 36px rgba(255,165,0,0.5);color:#fff;font-family:inherit;">' +
                     '<div style="font-size:18px;font-weight:700;color:#FFA500;margin-bottom:14px;letter-spacing:0.06em;">STAGGER THRESHOLD</div>' +
                     '<div style="font-size:13px;opacity:0.85;margin-bottom:18px;">Choose Stagger trigger threshold:</div>' +
                     '<div id="mythicThresholdButtons" style="display:flex;flex-direction:column;gap:10px;"></div>' +
                     '</div>';
  document.body.appendChild(modal);
  return modal;
}

function _maybePromptMythicStaggerThreshold() {
  if (typeof gameEnded !== 'undefined' && gameEnded) return;
  const cap = _findCaptainInDeck();
  if (!cap) return;
  const isMythic = (typeof isHeroMythic === 'function') && isHeroMythic(cap.id);
  if (!isMythic) return;
  const modal = _ensureMythicThresholdModal();
  if (!modal) return;
  const opts = MYTHIC_CAPTAIN_THRESHOLDS[cap.id] || [50, 75, 100];
  const labels = {
    50:  ['Aggressive', 'Frequent Staggers, smaller windows'],
    60:  ['Aggressive+', 'Even more frequent (NIGHTLORD only)'],
    75:  ['Balanced', 'Recommended'],
    100: ['Conservative', 'Rare Staggers, bigger payoff'],
  };
  const root = modal.querySelector('#mythicThresholdButtons');
  if (root) {
    root.innerHTML = '';
    opts.forEach(t => {
      const lab = labels[t] || ['', ''];
      const b = document.createElement('button');
      b.style.cssText = 'background:#2a2548;border:1px solid #FFA500;color:#fff;border-radius:8px;' +
                        'padding:12px 14px;cursor:pointer;text-align:left;font-size:13px;';
      b.innerHTML = '<div style="font-weight:700;color:#FFA500;">' + t + ' · ' + lab[0] + '</div>' +
                    '<div style="font-size:11px;opacity:0.75;margin-top:4px;">' + lab[1] + '</div>';
      b.onclick = () => { setMythicStaggerThreshold(t); modal.style.display = 'none'; };
      root.appendChild(b);
    });
  }
  modal.style.display = 'flex';
}

// 2026-05-02 — COMBAT v2.1 P3 §3.5: register Captain Phase 3 hooks.
// Mark consumption hooks for T3+ universal mark. Hooks fire from squad
// action sites (ULT, shield gain, etc.) — see registerPhase3HeroHooks.
function registerPhase3CaptainHooks() {
  // Currently no hooks registered (T3 universal mark consumption is done
  // inline at action sites that call _consumeCaptainMarkBonus). Reserved for
  // future event-driven extensions per §14.1.
}

// Battle-init reset for Captain state.
function _resetPhase3CaptainState() {
  captainMarkedHeroId          = null;
  _captainMarkShownThisTurn    = false;
  _captainMarksFiredThisFight  = 0;
  // Reset threshold to PRESSURE_MAX baseline; Mythic prompt re-arms if applicable.
  mythicCaptainStaggerThreshold = (typeof PRESSURE_MAX === 'number') ? PRESSURE_MAX : 100;
  _hideCaptainMarkUI();
  try {
    const m = (typeof document !== 'undefined') ? document.getElementById('mythicThresholdModal') : null;
    if (m) m.style.display = 'none';
  } catch (e) {}
}

// Optional HUD badge — minimal placeholder; PR #3.F polishes with gold border
// on roster portrait.
function renderCaptainMarkBadge() {
  if (typeof document === 'undefined') return;
  let badge = document.getElementById('captainMarkBadge');
  if (!captainMarkedHeroId) { if (badge) badge.style.display = 'none'; return; }
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'captainMarkBadge';
    badge.style.cssText = 'position:fixed;top:8px;right:8px;z-index:8500;background:rgba(0,0,0,0.7);' +
                          'border:1px solid #FFD53D;color:#FFD53D;padding:5px 10px;border-radius:8px;' +
                          'font-size:11px;letter-spacing:0.06em;font-weight:700;pointer-events:none;';
    document.body.appendChild(badge);
  }
  let name = captainMarkedHeroId;
  if (typeof HERO_DECK !== 'undefined' && Array.isArray(HERO_DECK)) {
    const h = HERO_DECK.find(x => x && x.id === captainMarkedHeroId);
    if (h && h.name) name = h.name;
  }
  badge.textContent = '⚐ MARKED · ' + name;
  badge.style.display = 'block';
}

function maybeShowTankUltModeModal(hero) {
  return new Promise((resolve) => {
    if (!hero || hero.newRole !== 'tank') return resolve('normal');
    if (hero.emergencyULTUsed) return resolve('normal');
    let modal = document.getElementById('tankUltModeModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'tankUltModeModal';
      modal.className = 'tank-mode-modal';
      document.body.appendChild(modal);
    }
    modal.innerHTML =
      `<div class="tank-mode-box">
        <div class="tank-mode-title">CHOOSE ULT MODE</div>
        <button class="tank-mode-option" data-mode="normal">
          <span class="opt-name">⚔ NORMAL ULT</span>
          <span class="opt-desc">${hero.ultText || 'Standard tank ULT'}</span>
        </button>
        <button class="tank-mode-option tank-mode-option--emergency" data-mode="emergency">
          <span class="opt-name">⚡ EMERGENCY MODE (1/battle)</span>
          <span class="opt-desc">Clears bottom row (8 cells) + standard ULT effect.<br>Single use this battle.</span>
        </button>
      </div>`;
    modal.classList.add('active');
    const opts = modal.querySelectorAll('.tank-mode-option');
    opts.forEach(opt => {
      opt.onclick = () => {
        const mode = opt.getAttribute('data-mode');
        modal.classList.remove('active');
        if (mode === 'emergency') hero.emergencyULTUsed = true;
        resolve(mode === 'emergency' ? 'emergency' : 'normal');
      };
    });
  });
}

// Spec §4.3 — Tank Emergency ULT: bottom-row clear (8 cells) + standard ULT effect.
// Per-hero flavor (IRONBELLY +5 shields, THUNDERBEAT extra Encore, etc.) is layered
// via existing ultSignature + tier-delta hooks — base behavior is the row clear.
async function applyTankEmergencyUlt(hero, ctx) {
  if (!hero) return;
  // Step 1 — clear the bottom row (row SIZE-1). Mirrors heroEmberFire/heroSolarFire
  // pattern: visual burning class → sleep → null cells. Counts cleared cells for ctx.
  const bottomRow = SIZE - 1;
  const cellEls = document.querySelectorAll('.grid .cell');
  let clearedCount = 0;
  for (let c = 0; c < SIZE; c++) {
    if (grid[bottomRow] && grid[bottomRow][c]) {
      const idx = bottomRow * SIZE + c;
      if (cellEls[idx]) cellEls[idx].classList.add('burning');
      clearedCount++;
    }
  }
  if (clearedCount > 0) {
    try { flashText('⚡ EMERGENCY · ' + clearedCount + ' cells cleared', '#FF8B6F'); } catch (e) {}
    try { vibrate([100, 60, 100, 60, 200]); } catch (e) {}
    await sleep(500);
    for (let c = 0; c < SIZE; c++) {
      if (grid[bottomRow]) grid[bottomRow][c] = null;
    }
    try { render(); } catch (e) {}
    ctx.burnedCount = (ctx.burnedCount || 0) + clearedCount;
  } else {
    try { flashText('⚡ EMERGENCY · row already clear', '#FF8B6F'); } catch (e) {}
  }
  // Step 2 — apply normal Tank ULT on top so the player still gets the standard effect.
  await applyTankUlt(hero, ctx);
}
function applyCaptainMarkOnUlt(hero) {
  if (typeof _consumeCaptainMarkBonus !== 'function') return null;
  return _consumeCaptainMarkBonus(hero, 'ult');
}

// applyMarkOnSquadAction: generic call for shield-gain, line-clear, race
// proc, etc. The acting hero passes through; bonus payload returned.
function applyCaptainMarkOnSquadAction(hero, actionType) {
  if (typeof _consumeCaptainMarkBonus !== 'function') return null;
  return _consumeCaptainMarkBonus(hero, actionType || 'squad_action');
}

// HERO_ROSTER — master list of all available heroes
const HERO_ROSTER = [
  // V18.9: each hero gets newRole (warrior/hunter/mage/tank/captain) — drives unified ULT template.
  // `role` and `roleIcon` are kept for existing fire-trigger & UI logic (striker/guard/weaver).
  // --- PIRATES (Ember) ---
  { id:'pirate_warrior', name:'THORGAR', race:'pirate', role:'striker', newRole:'warrior', stihiya:'ember', img:'hero_pirate_sword', roleIcon:'⚔', minCombo:2, fireText:'Cleaver Forge', fire: fireThorgar, ult: ultRoleDispatch, ultSignature: ultTwistThorgar, fireTierDelta: fireDeltaThorgar, ultTierDelta: ultDeltaThorgar, ultText:'EMBER FORGE: spawn 5 charged ember (+ FLEET bonus at 5 pirates)' },
  { id:'pirate_hunter', name:'BLACKTOOTH', race:'pirate', role:'striker', newRole:'hunter', stihiya:'ember', img:'hero_pirate_gun', roleIcon:'⚔', minCombo:2, fireText:'Sparkshot', fire: fireBlacktooth, ult: ultRoleDispatch, ultSignature: ultTwistBlacktooth, fireTierDelta: fireDeltaBlacktooth, ultTierDelta: ultDeltaBlacktooth, ultText:'VOLLEY: 3 rows + 100 if charged hit' },
  { id:'pirate_mage', name:'EMBERHAND', race:'pirate', role:'weaver', newRole:'mage', stihiya:'ember', img:'hero_pirate_bomb', roleIcon:'✦', period:12, fireText:'Ember Bloom', fire: fireEmberhand, ult: ultRoleDispatch, ultSignature: ultTwistEmberhand, fireTierDelta: fireDeltaEmberhand, ultTierDelta: ultDeltaEmberhand, ultText:'MENDING: full heal + +1 ULT to all' },
  { id:'pirate_tank', name:'IRONBELLY', race:'pirate', role:'guard', newRole:'tank', stihiya:'ember', img:'hero_pirate_tank', roleIcon:'🛡', fireText:'Firebrand', fire: fireIronbelly, ult: ultRoleDispatch, ultSignature: ultTwistIronbelly, fireTierDelta: fireDeltaIronbelly, ultTierDelta: ultDeltaIronbelly, ultText:'AEGIS: +3 shields + 3 charged ember' },
  { id:'pirate_captain', name:'CRIMSON', race:'pirate', role:'weaver', newRole:'captain', stihiya:'ember', img:'hero_pirate_captain', roleIcon:'✦', period:10, fireText:"Captain's Gambit", fire: fireCrimson, ult: ultRoleDispatch, ultSignature: ultTwistCrimson, fireTierDelta: fireDeltaCrimson, ultTierDelta: ultDeltaCrimson, ultText:'DOMINION: 10 cells + 50% charged spawn' },
  // --- ROCK BAND (Umbra) ---
  { id:'rock_warrior', name:'RIFFBLADE', race:'rock', role:'striker', newRole:'warrior', stihiya:'umbra', img:'hero_rock_warrior', roleIcon:'⚔', minCombo:2, fireText:'Riff Seed',     fire: fireRiffblade,   ult: ultRoleDispatch, ultSignature: ultTwistRiffblade,   fireTierDelta: fireDeltaRiffblade,   ultTierDelta: ultDeltaRiffblade,   ultText:'RIFF FORGE: spawn 6 umbra (+4 if Encore primed)' },
  { id:'rock_hunter', name:'SHRIEK', race:'rock', role:'striker', newRole:'hunter', stihiya:'umbra', img:'hero_rock_hunter', roleIcon:'⚔', minCombo:2, fireText:'Piercing Shriek', fire: fireShriek,      ult: ultRoleDispatch, ultSignature: ultTwistShriek,      fireTierDelta: fireDeltaShriek,      ultTierDelta: ultDeltaShriek,      ultText:'VOLLEY echo on next placement' },
  { id:'rock_mage', name:'KEYCRYPT', race:'rock', role:'weaver', newRole:'mage', stihiya:'umbra', img:'hero_rock_mage', roleIcon:'✦', period:12, fireText:'Deep Beat',         fire: fireKeycrypt,    ult: ultRoleDispatch, ultSignature: ultTwistKeycrypt,    fireTierDelta: fireDeltaKeycrypt,    ultTierDelta: ultDeltaKeycrypt,    ultText:'MENDING + 3-placement umbra +20%' },
  { id:'rock_tank', name:'THUNDERBEAT', race:'rock', role:'guard', newRole:'tank', stihiya:'umbra', img:'hero_rock_tank', roleIcon:'🛡', fireText:'Drumhead',           fire: fireThunderbeat, ult: ultRoleDispatch, ultSignature: ultTwistThunderbeat, fireTierDelta: fireDeltaThunderbeat, ultTierDelta: ultDeltaThunderbeat, ultText:'AEGIS + free Rhythm proc' },
  { id:'rock_captain', name:'NIGHTLORD', race:'rock', role:'weaver', newRole:'captain', stihiya:'umbra', img:'hero_rock_captain', roleIcon:'✦', period:10, fireText:'Conduct the Dark', fire: fireNightlord,   ult: ultRoleDispatch, ultSignature: ultTwistNightlord,   fireTierDelta: fireDeltaNightlord,   ultTierDelta: ultDeltaNightlord,   ultText:'DOMINION + immediate Encore' },
  // --- SHARKS (Tide) — Block B2 implementation ---
  { id:'shark_warrior', name:'RIMEFANG',  race:'shark', role:'striker', newRole:'warrior', stihiya:'tide', img:'hero_shark_warrior', roleIcon:'⚔', minCombo:2, fireText:'Tide Seed',     fire: fireRimefang,  ult: ultRoleDispatch, ultSignature: ultTwistRimefang,  ultText:'TIDE FORGE: spawn 6 tide cells' },
  { id:'shark_hunter',  name:'BRINESHOT', race:'shark', role:'striker', newRole:'hunter',  stihiya:'tide', img:'hero_shark_hunter',  roleIcon:'⚔', minCombo:2, fireText:'Shatter Volley', fire: fireBrineshot, ult: ultRoleDispatch, ultSignature: ultTwistBrineshot, ultText:'VOLLEY: chain rows' },
  { id:'shark_mage',    name:'CRYOMIND',  race:'shark', role:'weaver',  newRole:'mage',    stihiya:'tide', img:'hero_shark_mage',    roleIcon:'✦', period:12,    fireText:'Tide Weave',     fire: fireCryomind,  ult: ultRoleDispatch, ultSignature: ultTwistCryomind,  ultText:'MENDING: freeze attack' },
  { id:'shark_tank',    name:'BULWARK',   race:'shark', role:'guard',   newRole:'tank',    stihiya:'tide', img:'hero_shark_tank',    roleIcon:'🛡',                fireText:'Tock Guard',     fire: fireBulwark,   ult: ultRoleDispatch, ultSignature: ultTwistBulwark,   ultText:'AEGIS: refund placement' },
  { id:'shark_captain', name:'ABYSSKING', race:'shark', role:'weaver',  newRole:'captain', stihiya:'tide', img:'hero_shark_captain', roleIcon:'✦', period:10,    fireText:'Deep Tide',      fire: fireAbyssking, ult: ultRoleDispatch, ultSignature: ultTwistAbyssking, ultText:'DOMINION: chill board' },
  // --- CROCODILES (Grove) — Phase 5 Block 2 implementation, locked behind Chapter 2 (Phase 5b) ---
  // 5 heroes × Earth/Grove. CREATE earth-cells (absorbers), AMPLIFY surge, DETONATE
  // Vengeance Quake, PROTECT Wall of Roots, ENABLE Eternal Bastion. Race-passive:
  // Death Roll (2-of) + Iron Hide (3+). Tier 3 signature combo: THE EMERALD WARDEN.
  // PHASE 5 BLOCK 5: locked: true keeps these out of squad-select until Chapter 2 ships.
  // Per Meta-Progression spec §7: VEROTHIRA (Boss 6) → 2 unlocked, GEARHEART (Boss 7) → rest.
  // PHASE 5b BLOCK 3: locked: true removed for crocodile_warrior + crocodile_hunter
  // — VEROTHIRA (Boss 6) victory unlocks them via BOSS_UNLOCKS[6]. Mage/Tank/Captain
  // remain locked behind GEARHEART (Block 5b.4 → BOSS_UNLOCKS[7]).
  { id:'crocodile_warrior', name:'MOSSJAW',      race:'crocodile', role:'striker', newRole:'warrior', stihiya:'grove', img:'hero_crocodile_warrior', roleIcon:'⚔', minCombo:2, fireText:'Bedrock Forge',  fire: fireMossjaw,      ult: ultRoleDispatch, ultSignature: ultTwistMossjaw,      ultText:'BEDROCK BASTION: all empties → earth absorbers' },
  { id:'crocodile_hunter',  name:'THORNBACK',    race:'crocodile', role:'striker', newRole:'hunter',  stihiya:'grove', img:'hero_crocodile_hunter',  roleIcon:'⚔', minCombo:2, fireText:'Vengeance Slam',  fire: fireThornback,    ult: ultRoleDispatch, ultSignature: ultTwistThornback,    ultText:'QUAKE: ×3 absorbed dmg' },
  // PHASE 5b BLOCK 4: locked: true removed for crocodile_mage / tank / captain —
  // GEARHEART (Boss 7) victory unlocks them via BOSS_UNLOCKS[7]. Full Crocodile
  // roster (5/5) becomes playable after Gearheart kill.
  { id:'crocodile_mage',    name:'MOSSWEAVER',   race:'crocodile', role:'weaver',  newRole:'mage',    stihiya:'grove', img:'hero_crocodile_mage',    roleIcon:'✦', period:12,    fireText:'Verdant Surge',   fire: fireMossweaver,   ult: ultRoleDispatch, ultSignature: ultTwistMossweaver,   ultText:'SURGE: shields → damage' },
  { id:'crocodile_tank',    name:'IRONSCALE',    race:'crocodile', role:'guard',   newRole:'tank',    stihiya:'grove', img:'hero_crocodile_tank',    roleIcon:'🛡',                fireText:'Stone Skin',      fire: fireIronscale,    ult: ultRoleDispatch, ultSignature: ultTwistIronscale,    ultText:'AEGIS: full row earth' },
  { id:'crocodile_captain', name:'ANCIENTSCALE', race:'crocodile', role:'weaver',  newRole:'captain', stihiya:'grove', img:'hero_crocodile_captain', roleIcon:'✦', period:10,    fireText:'Eternal Bastion', fire: fireAncientscale, ult: ultRoleDispatch, ultSignature: ultTwistAncientscale, ultText:'DOMINION: shields + earth field' },
  // --- SPARKS (Solar) — Phase 5 Block 4 implementation, locked behind Chapter 2 (Phase 5b) ---
  // 5 heroes × Light/Solar. CREATE solar cells, AMPLIFY shields-per-clear window,
  // DETONATE shields-to-damage burst, PROTECT auto-block, ENABLE Eternal Dawn heal+shields.
  // Race-passive: Charge Regen (2-of) + Static Field (3+). Tier 3 signature: THE PRISMATIC RIDE.
  // PHASE 5 BLOCK 5: locked: true. Per Meta-Progression spec §7: URSARO (Boss 8) → 2 unlocked,
  // TIDESPIRE (Boss 9) → rest. Block 5b will re-gate progression after Chapter 2 implementation.
  // PHASE 5b BLOCK 5: locked: true removed for spark_warrior + spark_hunter —
  // URSARO (Boss 8) victory unlocks them via BOSS_UNLOCKS[8]. Mage/Tank/Captain
  // remain locked behind TIDESPIRE (Block 5b.6 → BOSS_UNLOCKS[9]).
  { id:'spark_warrior', name:'EMBERSPARK', race:'spark', role:'striker', newRole:'warrior', stihiya:'solar', img:'hero_spark_warrior', roleIcon:'⚔', minCombo:2, fireText:'Sun Forge',     fire: fireEmbersark,  ult: ultRoleDispatch, ultSignature: ultTwistEmbersark,  ultText:'SUN CASCADE: spawn 5 solar cells' },
  { id:'spark_hunter',  name:'RADIANCE',   race:'spark', role:'striker', newRole:'hunter',  stihiya:'solar', img:'hero_spark_hunter',  roleIcon:'⚔', minCombo:2, fireText:'Aurora Burst',   fire: fireRadiance,   ult: ultRoleDispatch, ultSignature: ultTwistRadiance,   ultText:'BURST: shields → damage (no consume)' },
  // PHASE 5b BLOCK 6: locked: true removed for spark_mage / tank / captain —
  // TIDESPIRE (Boss 9) victory unlocks them via BOSS_UNLOCKS[9]. Full Spark
  // roster (5/5) becomes playable after Tidespire kill.
  { id:'spark_mage',    name:'LUMENWIND',  race:'spark', role:'weaver',  newRole:'mage',    stihiya:'solar', img:'hero_spark_mage',    roleIcon:'✦', period:12,    fireText:'Halo Window',    fire: fireLumenwind,  ult: ultRoleDispatch, ultSignature: ultTwistLumenwind,  ultText:'HALO: double shields' },
  { id:'spark_tank',    name:'AEGIS',      race:'spark', role:'guard',   newRole:'tank',    stihiya:'solar', img:'hero_spark_tank',    roleIcon:'🛡',                fireText:'Sun Guard',      fire: fireAegis,      ult: ultRoleDispatch, ultSignature: ultTwistAegis,      ultText:'EQUILIBRIUM: shields + immunity' },
  { id:'spark_captain', name:'SOLARLORD',  race:'spark', role:'weaver',  newRole:'captain', stihiya:'solar', img:'hero_spark_captain', roleIcon:'✦', period:10,    fireText:'Eternal Dawn',   fire: fireSolarlord,  ult: ultRoleDispatch, ultSignature: ultTwistSolarlord,  ultText:'DOMINION: heal + shields + solar cells' },
  // CLOCKWORK placeholder roster removed 2026-04-28 (was Task #1.4 scaffolding for
  // a Phase 2 race that won't ship in v1; reintroduce when actual Clockwork heroes
  // are designed). Removal cleans 5 dead roster entries + 2 placeholder functions.
];

// Initialize tier + xp fields on every HERO_ROSTER entry (non-intrusive; doesn't touch existing fields)
for (const h of HERO_ROSTER) {
  if (typeof h.tier !== 'number') h.tier = 0;
  if (typeof h.xp   !== 'number') h.xp   = 0;
  // fireTierDelta / ultTierDelta remain undefined unless populated in Blocks 5.2–5.6
}


// Load saved tiers at script init (idempotent — safe to call multiple times)
loadHeroTiersFromStorage();

// Initialize unlocked flag on every roster entry. Default: starter-only.
for (const h of HERO_ROSTER) {
  h.unlocked = STARTER_HEROES.has(h.id);
}

// ===== PUBLIC EXPORTS =====
// Aliases / barrel exports so T1.10.9 wire-up can `import { ... } from
// 'src/core/heroes.js'` without renaming legacy callsites. Mutable bindings
// stay module-private (per CLAUDE.md §3.4 no window-globals) — consumers
// read through these named functions instead of mutating module state.

// Hero state + roster
export { HERO_ROSTER, STARTER_HEROES };
export function getHeroById(id) {
  return id ? HERO_ROSTER.find(h => h.id === id) : null;
}

// ULT charging machinery
export {
  getUltCost, canFireUlt, consumeUltCharge,
  addChargeToHero, addChargeToHeroesOfElement,
  distributeChargeOnElementClear,
  HERO_CHARGE_MAX, HERO_ULT_COST_DEFAULT,
  HERO_CHARGE_PER_CELL_BY_COUNT, ELEMENT_POOL_TO_HERO_CHARGE,
};
// Battle-scope heroCharges state — read via accessor (caller must NOT mutate
// the returned object directly; use addChargeToHero / consumeUltCharge).
export function getHeroCharges() { return heroCharges; }
export function resetHeroCharges() { heroCharges = {}; }
export function setHeroCharge(heroId, value) {
  if (!heroId) return;
  heroCharges[heroId] = Math.max(0, Math.min(HERO_CHARGE_MAX, value));
}

// Tier framework
export {
  TIER_XP_THRESHOLDS, TIER_MAX, FIRE_MULT_CAP,
  XP_PARTICIPATION, XP_ULT_FIRED, XP_KILL_SHOT, XP_CAP_PER_BATTLE,
  computeTierFromXP, getNextTierThreshold,
  calculatePostBattleXP, applyXPGainsAndLevelUps, awardPostBattleXP,
  saveHeroTiersToStorage, loadHeroTiersFromStorage,
  HERO_TIERS_STORAGE_KEY,
};

// Role appliers + dispatch
export {
  ROLE_ULT_PARAMS, STIHIYA_ULT_BONUS,
  burnRandomCells,
  applyWarriorUlt, applyHunterUlt, applyMageUlt, applyTankUlt,
  applyCaptainUlt, applyStihiyaUltBonus,
  ultRoleDispatch,
  applyTankEmergencyUlt, maybeShowTankUltModeModal,
};

// Per-hero fires (25) — exported so the HERO_ROSTER bindings resolve when
// the module is consumed externally. T1.10.9 wire-up reads HERO_ROSTER and
// the bound fire / ultSignature / fireTierDelta / ultTierDelta references
// from each hero entry directly; these named exports are for diagnostic /
// test-harness consumers that need direct access.
export {
  fireThorgar, fireBlacktooth, fireEmberhand, fireIronbelly, fireCrimson,
  fireRiffblade, fireShriek, fireKeycrypt, fireThunderbeat, fireNightlord,
  fireRimefang, fireBrineshot, fireCryomind, fireBulwark, fireAbyssking,
  fireMossjaw, fireThornback, fireMossweaver, fireIronscale, fireAncientscale,
  fireEmbersark, fireRadiance, fireLumenwind, fireAegis, fireSolarlord,
};

// Per-hero ult signatures (25)
export {
  ultTwistThorgar, ultTwistBlacktooth, ultTwistEmberhand,
  ultTwistIronbelly, ultTwistCrimson,
  ultTwistRiffblade, ultTwistShriek, ultTwistKeycrypt,
  ultTwistThunderbeat, ultTwistNightlord,
  ultTwistRimefang, ultTwistBrineshot, ultTwistCryomind,
  ultTwistBulwark, ultTwistAbyssking,
  ultTwistMossjaw, ultTwistThornback, ultTwistMossweaver,
  ultTwistIronscale, ultTwistAncientscale,
  ultTwistEmbersark, ultTwistRadiance, ultTwistLumenwind,
  ultTwistAegis, ultTwistSolarlord,
};

// Tier deltas (ember + umbra populated per legacy v1)
export {
  fireDeltaThorgar, fireDeltaBlacktooth, fireDeltaEmberhand,
  fireDeltaIronbelly, fireDeltaCrimson,
  ultDeltaThorgar, ultDeltaBlacktooth, ultDeltaEmberhand,
  ultDeltaIronbelly, ultDeltaCrimson,
  fireDeltaRiffblade, fireDeltaShriek, fireDeltaKeycrypt,
  fireDeltaThunderbeat, fireDeltaNightlord,
  ultDeltaRiffblade, ultDeltaShriek, ultDeltaKeycrypt,
  ultDeltaThunderbeat, ultDeltaNightlord,
};

// Tier-init dispatchers (one per element)
export {
  applyEmberTierFlagsAtBattleInit,
  applyTideTierFlagsAtBattleInit,
  applyGroveTierFlagsAtBattleInit,
  applySolarTierFlagsAtBattleInit,
  applyUmbraTierFlagsAtBattleInit,
};

// LUMENWIND amp window tick — invoked per-placement by battle loop
export { tickLumenwindHalo };

// Main fire dispatcher (combo-cell path)
export { fireHero };

// Aegis Conductor (v2.1 P3 Tank — sacred per CLAUDE.md §2.5)
export {
  AEGIS_PROTOCOL_DURATION, MYTHIC_TANK_STAGGER_MULT,
  activateAegisProtocol, tickAegisProtocol,
  registerPhase3TankHooks, registerPhase3HeroHooks,
  _computeTankPressureConversion, _getT2TankMitigationBoost,
  _maybeFireT2TankReactive, _getMythicTankStaggerMult,
  showTankConversionFX as showTankConversionFXImpl,
  showAegisProtocolFX as showAegisProtocolFXImpl,
  showAegisProtocolEntryFX as showAegisProtocolEntryFXImpl,
  _resetPhase3TankState,
};
// Read-only accessors for the Tank state (T1.10.9 consumers — battle.js will
// call these instead of importing the mutable bindings directly).
export function getAegisProtocolTurnsActive() { return aegisProtocolTurnsActive; }
export function getAegisProtocolHeroId() { return aegisProtocolHeroId; }
export function isMythicTankSquadBoostActive() { return _mythicTankSquadBoostActive; }

// Squad Conductor (v2.1 P3 Captain — sacred per CLAUDE.md §2.5)
export {
  MYTHIC_CAPTAIN_THRESHOLDS, CAPTAIN_T2_STAGGER_EXTEND,
  setCaptainMark, clearCaptainMark, _consumeCaptainMarkBonus,
  getStaggerTriggerThreshold, setMythicStaggerThreshold,
  _maybeShowCaptainMarkUI, _hideCaptainMarkUI, _resetCaptainMarkPerTurn,
  _maybePromptMythicStaggerThreshold,
  _resetPhase3CaptainState, registerPhase3CaptainHooks,
  applyCaptainMarkOnUlt, applyCaptainMarkOnSquadAction,
};
export function getCaptainMarkedHeroId() { return captainMarkedHeroId; }
export function getMythicCaptainStaggerThreshold() { return mythicCaptainStaggerThreshold; }
