// 2026-05-11 — TASK-011 (T1.10.9): battle orchestrator — final sub-task of T1.10.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - getEffectiveBossStats              lines 24161-24183 (DEFERRED from T1.10.7)
//   - startPyredrakeFtueBattle           lines 24334-24342 (FTUE launcher)
//   - startGruntFtueBattle               lines 25077-25092 (FTUE launcher)
//   - startChronicleFtueBattle           lines 25127-25139 (FTUE launcher)
//   - finalizeFtue                       lines 25156-25182 (FTUE finalizer)
//   - _phase8GetAdaptiveHpMultiplier     lines 47452-47462 (DEFERRED from T1.10.7 — Phase 8 dispatcher)
//   - startBossBattle                    lines 55271-55799 (battle lifecycle)
//   - dealDamage                         lines 57093-57348 (CENTRAL damage dispatcher)
//   - showVictoryModal                   lines 57950-58112 (victory check)
//   - showDefeatModal                    lines 58114-58178 (defeat check)
//   - bossAttack                         lines 59033-59220 (DEFERRED from T1.10.7 — turn loop)
//   - exitBattle                         lines 59405-59417 (battle teardown)
//
// OWNS (T1.10.9 territory):
//   - Battle lifecycle: startBattle (startBossBattle) / endBattle (exitBattle).
//   - Turn loop: bossAttack (per-spec the "bossTurn" entry — pulls in
//     archetype dmgMult, signature damage, FTUE Grunt void cap, etc.).
//   - Central damage dispatcher: dealDamage — synergy/crit/captain-dual/
//     bloodhunt/pirate-double/Tower-pact/buff/Mythic-Tank/Phase-3-AEGIS mult
//     stack + FIRE_MULT_CAP clamp + Overflow conversion + phase-transition
//     check. SACRED per CLAUDE.md §2.1 (combo crit formula).
//   - Victory/defeat: showVictoryModal / showDefeatModal — modal rendering,
//     XP award hook, Phase 8 defeat tracker, narrator triggers. UI-heavy.
//   - getEffectiveBossStats: FTUE Pyredrake HP/cadence override +
//     Phase-8 adaptive HP multiplier. Returns a SHALLOW clone — never
//     mutates the source boss data.
//   - Phase 8 adaptive HP multiplier dispatcher (_phase8GetAdaptiveHpMultiplier).
//   - FTUE battle launchers: startPyredrakeFtueBattle (chapter 1 boss 0,
//     FTUE override layer), startGruntFtueBattle (sentinel -1 + EMBER_GRUNT),
//     startChronicleFtueBattle (sentinel -1 + CHRONICLE training dummy),
//     finalizeFtue (force-reveal heroes + coda + post-FTUE gift hero).
//
// SACRED PER CLAUDE.md §2.1 (preserved byte-perfect):
//   - Combo crit formula: total_dmg × (1 + dominantCount × combo × 10%).
//     The mult stack inside dealDamage composes _passiveDmgContext +
//     _ultDmgContext + _warbandStrikeContext + _hunterMarkContext +
//     _grommarRallyContext + _packMarkContext + _helioRoarContext +
//     _captainDualContext + _signatureComboContext + _hypnoSuggestContext +
//     _bloodhuntContext + _pirateDoubleContext + _pactDamageMult +
//     _towerThemeMult + _buffDamageMult + _mythicTankSquadMult +
//     _sparkSunAuraMult + heart tower mult + hero ascension mult +
//     Ch3 twilight mult + Ch3 hunter/mage halved + Ch3 dmg_halved seal +
//     pact dual element mult + hero level milestone mult. Clamped via
//     getFireMultCap() (context-aware Stagger window) instead of static
//     FIRE_MULT_CAP. LV7 Element Mastery flat add is post-clamp.
//   - Phase-gate Overflow conversion: damage caps at next phase gate,
//     excess converts to ULT charge / essence / shield / Tower points.
//   - FIRE_MULT_CAP clamp (context-aware via getFireMultCap()).
//   - SHARK_BLOODHUNT_THRESHOLD / SHARK_BLOODHUNT_MULT
//     (race-passive +30% dmg when boss HP < 30% with 3+ sharks).
//   - PIRATE_DOUBLE_COMBO_CHANCE (15% chance to double combo mult with 3+ pirates).
//
// SACRED PER CLAUDE.md §2.5 (preserved byte-perfect):
//   - FTUE_BOSS_GUARANTEES dispatch (applyScriptedActions / _phase8RecordBossFtueEvent).
//   - boss archetype dmgMult / attackCD / hpMult application order.
//   - Phoenix revivesRemaining gate on kill-shot attribution + death voice.
//   - VOIDFANG shroud-state setup deferred to reactivity-events.js.
//
// DOES NOT OWN (deferred or sibling territory):
//   - Per-archetype tick handlers (_tickPyredrake / _tickAbyssalTyrant /
//     _tickGrovewarden / _tickSolarPhoenix / _tickCryptLich / Ch2 hypnotist /
//     engineer / frenzy / tempo / battery / Ch3-5 archetypes / initChapter2Archetype) —
//     LEGACY-OWNED for T1.10.9 ship. ~1500 LoC across 25+ tick handlers
//     spanning legacy lines 40709-42799. They touch FX + DOM render +
//     cross-module reactivity state heavily; pulling them in would
//     dwarf the orchestrator. Flagged as DEFERRED: legacy keeps
//     ownership; battle.js calls them via /* global */ stubs (typeof
//     checks). Resolution path: T1.11 (UI) or a T1.10.10 cleanup sub-task
//     to flip ownership once the new shell is wired up.
//   - maybePhaseTransition / applyBossSignatureDamage — kept in legacy
//     (referenced via /* global */ + typeof guard). They sit between
//     dealDamage and bossAttack semantically; the orchestrator calls them
//     defensively. T1.11 territory.
//   - onBossDefeated — 535-line reward / chapter-progression / dialog /
//     analytics chain. Sits between dealDamage and showVictoryModal. Out
//     of scope for the orchestrator extraction; lives in legacy until
//     T1.11 + progression follow-up.
//   - All UI rendering (render / renderHP / renderULTBar / flashText /
//     flashAttack / floatDamage / hitBoss / showThreatBanner / etc.) —
//     T1.11 (ui) territory; referenced via /* global */.
//   - All FX / haptics — owned by src/feel/* (T1.09); legacy still wires
//     them via the bare-identifier surface, replaced by imports in T1.12.
//   - Audio (playBossDamage / playContextMusic / playCaptainBuff / etc.) —
//     legacy audio module; T1.11 / T1.12 will route through src/feel/audio.
//
// Storage migration:
//   ZERO new bare-string localStorage keys. Battle.js touches only per-
//   battle ephemeral state (hp / bossHP / shieldCount / battleDamageTaken /
//   gameEnded / battleStartTime / attackCountdown / revivesRemaining). All
//   persistent reward / progression writes are handled in onBossDefeated
//   (legacy-owned) and progression.js (T1.10.2). The T1.10.9 migration
//   shim allow-list is COMPLETE at 9 keys — no T1.10.9-originating
//   additions.
//
// /* global */ surface:
//   battle.js is the LAST sub-task — it sits at the top of the import
//   graph. Every prior sibling reference resolves to either (a) an
//   import from a T1.10.1-T1.10.8 module, (b) a legacy global that
//   T1.11 / T1.12 will rewire, or (c) a sacred src/data/ constant.
//   The /* global */ block below documents (b) — referenced names that
//   legacy still owns. ~80 identifiers; one /* global */ declaration
//   per system slice for readability.
//
// 2026-05-11 — Roman: pure-relocation discipline. No "improvements".
// Function bodies are byte-perfect to legacy after copy. Comments above
// this line summarize intent; comments INSIDE each function body are
// preserved verbatim from legacy.

/* eslint-disable no-empty, no-unused-vars, no-undef */
// no-undef disabled because battle.js sits at the top of the import graph;
// dozens of cross-module identifiers are referenced as legacy globals
// during the wire-up phase. T1.11 / T1.12 replace these with imports.

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// /* global */ surface — legacy-owned identifiers referenced below.
// Grouped by system slice; each group will be rewired in T1.11 / T1.12.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Feel layer (T1.09 — already extracted, currently re-exposed as globals):
/* global flashText, vibrate, vHaptic, speakNarrator, flashAttack,
   floatDamage, hitBoss, showThreatBanner, hideThreatBanner,
   hideStateBanner, flashStateBanner, flashRacePassiveOnce, render,
   renderHP, renderBossHP, renderChainStackUI, renderHypnotistVisuals */

// FTUE (T1.10.1 — extracted; legacy still owns chronograph + dialog):
/* global ftueBeat:writable, ftueIs, isFtueActive, isFtueComplete,
   advanceFtue, saveFtueToStorage, resetChronoForFtueAttempt,
   maybeChronoBeat, _chronoActive, _hideChronoBeat,
   FTUE_PYREDRAKE_HP, FTUE_PYREDRAKE_ATTACK_INTERVAL, FTUE_GRUNT_VOID_SPAWN,
   ensureRevealedForComplete, revealHero, ftueSafetyRailUsed:writable,
   POST_FTUE_GIFT_HERO_ID, grantPostFtueHeroInstantly,
   showLeaderChoiceModal, FTUE_SCRIPTS, EMBER_GRUNT, CHRONICLE */

// Progression (T1.10.2 — extracted):
/* global setChapter, currentChapter:writable, chapter2Unlocked,
   chapter3Unlocked, chapter4Unlocked, BOSSES, CHAPTERS,
   activeModifiers, MODIFIERS */

// Grid (T1.10.3 — extracted):
/* global grid:writable, SIZE, gridFillRatio, newPieces, knownDeadZones:writable,
   chargedCells, bloomTokens, radiantCells, radiantAge,
   groveAbsorbedByCell, STIHIYA_COLORS */

// Heroes (T1.10.4 — extracted):
/* global HERO_DECK, HERO_ULT_COST_DEFAULT, getUltCost, computeSynergies,
   ultCharges:writable, heroCharges:writable, heroFireCount:writable,
   ULT_THRESHOLD, MAX_SHIELD, maxShieldBonus, currentMaxHP:writable,
   currentStartShields, currentStartCharges, currentDmgMult,
   _currentFiringHero, _passiveDmgContext, _ultDmgContext,
   _warbandStrikeContext, _hunterMarkContext, _hunterMarkConsumed:writable,
   _grommarRallyContext, _grommarRallyConsumed:writable,
   _packMarkContext, _packMarkConsumed:writable,
   _helioRoarContext, _captainDualContext:writable,
   captainDual_active, captainDual_race, captainDual_raceMult,
   captainDual_active:writable,
   _signatureComboContext:writable, activeSignatureCombo,
   hypnotistSuggestedHeroIds, HYPNOTIST_OBEY_BONUS_P1,
   HYPNOTIST_OBEY_BONUS_P2, HYPNOTIST_OBEY_BONUS_P3,
   _bossArchetypePhase, SHARK_BLOODHUNT_THRESHOLD, SHARK_BLOODHUNT_MULT,
   PIRATE_DOUBLE_COMBO_CHANCE, racePassiveFirstProcSeen,
   pirateDoubleComboFiredThisBattle:writable, FIRE_MULT_CAP,
   getFireMultCap, getHeroAscensionMult, _heroLevelMilestoneMult,
   _heroLevelFlatBonus, applyArmoredAbsorb, bossStonebloodBypass:writable,
   tharaRageAutoArm, tharaRageArmed:writable, firstAttackImmune:writable,
   bossRagePending:writable, bossRageEmber:writable, bossNextAttackBonus:writable,
   frenzyStacks, FRENZY_DMG_PER_STACK, glacierIceArmorHits:writable,
   glacierIceArmorReduce, glacierIceArmorPermanent,
   groveDefense, MOTIFS_ENABLED, EMBER_VOID_PRESSURE_THRESH,
   EMBER_VOID_PRESSURE_BONUS, bossArchetype:writable,
   bossAttackDmgMult:writable, bossEnraged:writable,
   bossArmorShields:writable, bossRevivedOnce:writable,
   bossPhoenixImmuneTurns:writable, bossStealthTurns,
   maybeEnrageBerserker, _isBulwarkFrozenWardActive,
   _getMythicTankStaggerMult, _getSparkSunAuraDmgMult,
   _t2BonusInDeck, getActiveRacePassives, registerPhase3HeroHooks,
   _resetPhase3Hooks, _resetPhase3TankState, _resetPhase3CaptainState,
   _maybePromptMythicStaggerThreshold,
   turnsSinceTideGrove:writable, chainWindow:writable, chainStack:writable,
   tideDamageBonus:writable, frozenStreakTurns:writable,
   bloomTriggeredCount:writable, guaranteedRadiantRemaining:writable,
   umbraClearCounter:writable, umbraCarriedBonus:writable */

// Damage channels (T1.10.5 — extracted):
/* global applyOverflowConversion */

// Stagger loop (T1.10.6 — extracted):
/* global bossState, BOSS_STATE_ACTIVE, addPressure, resetStaggerState,
   _phase5StartingPressureBonus:writable, _getPhaseGateHP */

// Bosses (T1.10.7 — extracted):
/* global currentBoss:writable, currentBossIdx:writable, selectedBossIdx:writable,
   bossHP:writable, bossMaxHP:writable, BOSS_ARCHETYPES, ARMORED_SHIELD_COUNT,
   ASSETS, applyBossEmblems, resetBossVoiceFlags, maybeFireBossVoiceIntro,
   maybeFireBossVoiceMidfight, maybeFireBossVoiceDeath,
   _resetPyredrakeState, _resetAbyssalTyrantState,
   _resetGrovewardenState, _resetSolarPhoenixState,
   _resetCryptLichState, initChapter2Archetype, initChapter3Boss,
   _ch3HasDebuff, _ch3HasSeal, _ch3TwilightMult, ESSENCE_EMOJI */

// Reactivity (T1.10.8 — extracted):
/* global _resetReactivityState, _resetPhase6ArchetypeState,
   maybePhaseTransition, applyBossSignatureDamage, BOSS_PHASES,
   battlePhasesTriggered:writable, clearVoidfangTints */

// Battle state writable globals OWNED here in spirit (canonical post-T1.12):
/* global hp:writable, shieldCount:writable, gameEnded:writable,
   battleDamageTaken:writable, damageDealt:writable, placementCount:writable,
   revivesRemaining:writable, attackCountdown:writable,
   battleStartTime:writable, skipPlayerTurnsCount:writable */

// Tower / pact / heart / buff (T1.11+ Tower module):
/* global _isTowerBattle, pactRunState, getTowerThemeMult, getBuffValue,
   getHeartUpgradeStats, getHeartTowerMult, _pactDualElementMult,
   _currentRacePureRace:writable, RACE_PURE_HP_MULT, BOSS_REWARD,
   _battleRetryUsedThisBattle:writable, _lastReward:writable,
   _currentBossRoleTier:writable */

// Reward / floor / dungeon (T1.10.2 follow-up + dungeon module):
/* global currentFloorId, _isFtueOnly */

// FTUE chronograph + dialog (T1.11 dialog module):
/* global playDialogScript, playDialog, seenDialogs, DIALOG_LINES,
   getBossDialogPrefix, maybeShowBattleTutorial, _dialogDeferredQueue:writable,
   _pendingDialogRequest:writable */

// Education / tutorials (T1.11):
/* global maybeShowElementEducation, maybeShowMageEducation,
   maybeShowCaptainEducation, maybeShowAntiDeadlockEducation,
   resetBossDefeatStreak */

// Phase 8 boss FTUE / loss recovery (T1.11):
/* global applyScriptedActions, _phase8RecordBossFtueEvent,
   _phase8HandleBossDefeat, _phase8GetBossLosses,
   _phase6MaybeFireBossArchetypeIntro */

// Anti-deadlock + rainbow (T1.10.4 follow-up):
/* global resetAntiDeadlockState, applyRainbowBuff */

// Audio (T1.11 audio module):
/* global playBossDamage, playContextMusic, playDefeat,
   playCaptainBuff, _audioPrevShieldCount:writable */

// Profile / analytics / events (T1.10.2 follow-up):
/* global trackProfileBattlePlayed, trackProfileDamage, awardPostBattleXP,
   logBattleEvent, battleEventLog:writable */

// UI rendering (T1.11) — `showScreen` and `goToMenu` already provided as
// readonly globals via eslint.config.js (legacy single-HTML surface):
/* global showBossIntelOverlay, showDeathFlashback,
   maybeShowBattleRetry, _showDefeatModalBody, injectMenuButton,
   vDecorateVictoryModal, _incrementConsecutiveBattleLosses,
   maybeShowConsecutiveLossPinch, returnToMenuFromBattle,
   closeSettings, _signatureComboCinemaShown:writable,
   _clutchSlowMoFired:writable, maybeFireSignatureComboCinematic,
   buildArtifactIcon, artDisplayName */

import { log } from '../services/logger.js';

// Helper: sleep promise — used by bossAttack for the 300ms beat between
// flash and void-spawn. Legacy `sleep` was a top-level module global; we
// inline a local copy so battle.js owns its own timing without window-
// shadowing concerns. Same semantics: resolve after `ms` milliseconds.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// getEffectiveBossStats — legacy lines 24161-24183 (DEFERRED from T1.10.7)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// FTUE Pyredrake override + Phase 8 adaptive HP multiplier applied to
// boss data at battle launch. Returns a SHALLOW clone — never mutates
// the source boss data.
export function getEffectiveBossStats(boss) {
  if (!boss) return boss;
  // Legacy FTUE Pyredrake override (HP=800)
  let result = boss;
  if (ftueIs('pyredrake_fight') && boss.img === 'Boss_1' && !boss._isFtueOnly) {
    result = { ...boss, hp: FTUE_PYREDRAKE_HP, attackInterval: FTUE_PYREDRAKE_ATTACK_INTERVAL };
  }
  // 2026-05-03 — COMBAT v2.1 P8 PR #8.C §5.2: adaptive difficulty multiplier.
  // Cap −20% at 5+ losses on same boss. Resets on victory (recordBossWin).
  // Layered AFTER legacy FTUE override — both can stack if applicable.
  // Skip for FTUE-only / training / tower battles + non-Ch1 chapters.
  try {
    if (boss._isFtueOnly || boss._isTrainingDummy || boss._isTowerBattle) return result;
    if (typeof currentChapter === 'number' && currentChapter !== 1) return result;
    if (typeof _phase8GetAdaptiveHpMultiplier === 'function' && boss.name) {
      const mult = _phase8GetAdaptiveHpMultiplier(boss.name);
      if (mult < 1.0 && typeof result.hp === 'number') {
        result = { ...result, hp: Math.round(result.hp * mult) };
      }
    }
  } catch (e) { console.warn('[P8.C adaptive HP] failed:', e); }
  return result;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// _phase8GetAdaptiveHpMultiplier — legacy lines 47452-47462
// (DEFERRED from T1.10.7 — Phase 8 dispatcher consumed by getEffectiveBossStats)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 2026-05-03 — COMBAT v2.1 P8 §5.2: adaptive HP multiplier per boss loss count.
// 3 losses → 0.90, 4 → 0.85, 5+ → 0.80 (cap). Resets on win via recordBossWin.
// Skips FTUE-only / training / tower per the getEffectiveBossStats wrapper.
export function _phase8GetAdaptiveHpMultiplier(bossName) {
  if (!bossName || typeof bossName !== 'string') return 1.0;
  try {
    const losses = _phase8GetBossLosses();
    const count = (losses && losses[bossName]) || 0;
    if (count >= 5) return 0.80;
    if (count >= 4) return 0.85;
    if (count >= 3) return 0.90;
    return 1.0;
  } catch (e) { return 1.0; }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FTUE battle launchers — legacy lines 24334-24342 / 25077-25092 /
// 25127-25139 / 25156-25182.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Launcher for Pyredrake during FTUE. Sets chapter/boss state, then calls the
// existing battle path. startBossBattle consumes currentBoss via getEffectiveBossStats,
// so HP + attackInterval are swapped in transparently.
export function startPyredrakeFtueBattle() {
  currentChapter = 1;
  try { setChapter(1); } catch(e){}
  currentBossIdx = 0;
  selectedBossIdx = null;
  // Switch to battle screen first so startBossBattle's DOM writes land on the right nodes
  showScreen('battle');
  startBossBattle();
}

export function startGruntFtueBattle() {
  if (ftueBeat !== 'grunt_fight') {
    console.warn('startGruntFtueBattle: only callable during grunt_fight beat');
    return;
  }
  // Ember Grunt lives at sentinel index -1 so nothing mistakes it for a chapter
  // boss. bossesDefeated stays at 1 — Pyredrake is the only chapter-1 boss
  // cleared; Grunt is off-sequence.
  currentChapter = 1;
  try { setChapter(1); } catch (e) {}
  selectedBossIdx = null;
  currentBossIdx = -1;
  currentBoss = EMBER_GRUNT;
  showScreen('battle');
  startBossBattle(); // gated to preserve EMBER_GRUNT via _isFtueOnly check
}

// Launcher — only callable during chronicle_fight beat. Mirrors the EMBER_GRUNT
// pattern: sentinel currentBossIdx = -1 keeps the dummy off-sequence; preserve-
// boss gate in startBossBattle keeps CHRONICLE intact through the standard
// battle init path.
export function startChronicleFtueBattle() {
  if (ftueBeat !== 'chronicle_fight') {
    console.warn('startChronicleFtueBattle: only callable during chronicle_fight beat (current: ' + ftueBeat + ')');
    return;
  }
  currentChapter = 1;
  try { setChapter(1); } catch (e) {}
  selectedBossIdx = null;
  currentBossIdx = -1;
  currentBoss = CHRONICLE;
  showScreen('battle');
  startBossBattle();
}

// Finalize FTUE — called on transition into 'complete'. Guarantees all unlocked
// heroes are revealed (safety backfill), routes to menu, then plays the final
// coda dialog with a short delay so menu render settles first.
// V3.0 Phase 1 Block 1.3 trap 5/6: coda dialog must play ONLY on the live
// not_complete → complete transition, never on reload-after-complete. Gate on
// the `prev` argument forwarded from onFtueBeatChanged.
export function finalizeFtue(prev) {
  // Force-reveal every unlocked hero. ensureRevealedForComplete already does
  // this, but we invoke it explicitly here so the guarantee is visible in the
  // complete flow. It internally checks isFtueComplete() which is now true.
  ensureRevealedForComplete();
  // Route back to normal menu — FTUE is done so ftueBlockNavIfActive passes through
  try { showScreen('menu'); } catch (e) { console.warn('showScreen menu failed:', e); }
  // Coda plays ONLY on the live transition. On reload (prev === 'complete'
  // because routeByFtue calls onFtueBeatChanged(ftueBeat, ftueBeat)), skip it.
  if (prev === 'complete') return;
  // Short delay gives the menu transition + renderMenu() time to paint before
  // the coda dialog overlay mounts on top. 800ms = feels intentional, not janky.
  setTimeout(() => {
    try { playDialogScript(FTUE_SCRIPTS.ftue_complete_coda, null); }
    catch (e) { console.warn('coda dialog failed:', e); }
  }, 800);
  // V3.0 Phase 0.1 post-refit: "tutorial complete" gift hero (VERDANIA). Delayed
  // 2000ms (200ms after coda starts + 1800ms reading time) so it lands visually
  // after the coda line resolves. Guarded so re-runs don't double-grant.
  setTimeout(() => {
    try {
      if (typeof grantPostFtueHeroInstantly === 'function' && typeof POST_FTUE_GIFT_HERO_ID === 'string') {
        grantPostFtueHeroInstantly(POST_FTUE_GIFT_HERO_ID, 'THE WARCHIEF\'S CALL');
      }
    } catch (e) { console.warn('post-FTUE gift grant failed:', e); }
  }, 2000);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// startBossBattle — legacy lines 55271-55799 (battle lifecycle / startBattle)
// 529-line orchestrator: resets per-battle state, applies FTUE / Tower /
// modifier overrides, computes synergies, renders boss UI, schedules
// narrator beats + race-passive banners + boss intro hooks.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function startBossBattle() {
  // Profile P2 — track every battle started (incl. retries / Tower floors).
  try { if (typeof trackProfileBattlePlayed === 'function') trackProfileBattlePlayed(); } catch (e) {}
  // 2026-04-28 — Drop stale dialog/flash state at battle start. Same trio of
  // leak sources documented in advanceFtue's clear: deferred flash queue,
  // single-slot pending-dialog request, and boss-voice once-per-battle flags.
  // Without these clears, ability/buff banners that arrived during a previous
  // battle's voice-intro / midfight / defeat dialogs survived and fired during
  // the NEXT battle's outro chain — looking like Pyredrake text replayed after
  // Ember Grunt's defeat.
  try {
    if (typeof _dialogDeferredQueue !== 'undefined') _dialogDeferredQueue.length = 0;
    if (typeof _pendingDialogRequest !== 'undefined') _pendingDialogRequest = null;
    if (typeof resetBossVoiceFlags === 'function') resetBossVoiceFlags();
    // 2026-04-29 polish v0.1 Track C.2: clear any lingering threat banner
    // from the previous battle so it doesn't bleed into the new fight.
    if (typeof hideThreatBanner === 'function') hideThreatBanner();
    // 2026-04-30 polish v0.2 Track H Part 2: same hygiene for the state banner.
    if (typeof hideStateBanner === 'function') hideStateBanner();
    // 2026-04-30 — Pyredrake Cinderblast state. Strips any leftover
    // warning class on cells from a prior fight before the next encounter.
    if (typeof _resetPyredrakeState === 'function') _resetPyredrakeState();
    // 2026-04-30 — Abyssal Tyrant Row Strike / Crush Spire / Maelstrom state.
    if (typeof _resetAbyssalTyrantState === 'function') _resetAbyssalTyrantState();
    // 2026-04-30 — Grovewarden Bloom Strike / Root Bind / Forest Wrath state.
    if (typeof _resetGrovewardenState === 'function') _resetGrovewardenState();
    // 2026-04-30 — Solar Phoenix Solar Line / Solar Storm state.
    if (typeof _resetSolarPhoenixState === 'function') _resetSolarPhoenixState();
    // 2026-04-30 — Crypt Lich Dark Geometry / Soul Drain / Necropulse state.
    if (typeof _resetCryptLichState === 'function') _resetCryptLichState();
  } catch (e) {}
  // V3.0 Phase 4: show one-time tutorial toast carousel on first battle.
  // PHASE 4 BLOCK 1 — carousel is gated to NON-FTUE inside maybeShowBattleTutorial
  // because the FTUE Pyredrake fight uses the chronograph (deeper, contextual)
  // instead. Post-FTUE first battle (e.g. dev who skipFtue'd) still gets carousel.
  try { maybeShowBattleTutorial(); } catch(e){}
  // PHASE 4 BLOCK 1 — reset chronograph beats per FTUE attempt so a player
  // who retries either FTUE fight gets the full curriculum re-shown rather
  // than skipping silently because the previous attempt set the seen-flags.
  // HOTFIX #1: reset on EITHER pyredrake_fight or grunt_fight (Phase A or B).
  // Resets all 6 flags but per-phase gates ensure only relevant beats fire.
  // DEBT-014: use ftueIs() helper.
  try {
    if (typeof ftueIs === 'function' && ftueIs(['pyredrake_fight', 'grunt_fight'])
        && typeof resetChronoForFtueAttempt === 'function') {
      resetChronoForFtueAttempt();
    }
  } catch (e) {}
  // V3.0 Phase 1 Block 1.3: preserve EMBER_GRUNT if startGruntFtueBattle already
  // assigned it. Without this gate, the line below would overwrite it with
  // BOSSES[currentBossIdx] (which is -1 → undefined → crash). The gate is:
  // if we're in grunt_fight beat AND currentBoss is already a _isFtueOnly boss,
  // keep it as-is; otherwise do the normal lookup.
  // V3.0 Phase 7 Block 7.1: analogous gate for Tower — Tower sets currentBoss
  // directly with `_isTowerBattle` flag before calling startBossBattle. Preserve it.
  // 2026-04-28 — chronicle_fight also preserves an _isFtueOnly currentBoss so
  // CHRONICLE (training dummy) survives the BOSSES[currentBossIdx] reassignment
  // below. Extends the original grunt_fight gate.
  const _preserveFtueBoss  = (currentBoss && currentBoss._isFtueOnly &&
                              (ftueBeat === 'grunt_fight' || ftueBeat === 'chronicle_fight'));
  const _preserveTowerBoss = (currentBoss && currentBoss._isTowerBattle);
  if (!_preserveFtueBoss && !_preserveTowerBoss) {
    currentBoss = BOSSES[currentBossIdx];
  }
  // V3.0 Block 1.1: apply FTUE overrides non-destructively. For Pyredrake during
  // pyredrake_fight beat: HP 1800→800, attackInterval 11→15. getEffectiveBossStats
  // gates on img='Boss_1' && !_isFtueOnly, so EMBER_GRUNT (which has _isFtueOnly=true)
  // passes through untouched — using its own 1200 HP and interval 10.
  currentBoss = getEffectiveBossStats(currentBoss);
  // V3.0 Block 1.1: reset per-battle safety-rail flag. Consumed once per battle
  // by the HP-drop site — see the FTUE rail block near line 12471.
  ftueSafetyRailUsed = false;
  // V3.0 Phase 5 Block 5.2: reset per-battle damage counter. Used by perfect_clear
  // achievement + battle_won_perfect weekly mission (Block 5.3).
  battleDamageTaken = 0;
  // ECO.1 — reset retry-sink one-shot flag so each new battle starts with the
  // option available again (subject to FTUE/Tower exclusions).
  _battleRetryUsedThisBattle = false;
  // V3.0 Phase 6 Block 6.1: reset phase-transition tracker so thresholds can
  // re-fire on next battle. Scoped per-battle to preserve one-way semantics
  // within a fight but restart cleanly on retry.
  try { battlePhasesTriggered.clear(); } catch (e) {}
  // V3.0 Phase 6 Block 6.3: reset Voidfang shroud state + clear any lingering grid
  // tints from a previous Voidfang battle (tints set via CSS class on #grid which
  // persists across battles unless explicitly removed).
  try { if (typeof clearVoidfangTints === 'function') clearVoidfangTints(); } catch (e) {}
  bossMaxHP = currentBoss.hp;
  // 2026-05-02 — COMBAT v2.1 P4 §5.5: capture role tier for signature damage
  // lookup + TTK forecast UI. Default 'gatekeeper' if boss data omits roleTier.
  _currentBossRoleTier = (currentBoss && currentBoss.roleTier) || 'gatekeeper';
  // 2026-04-29 — Race-Pure Challenge HP boost (Player Education Stage 15).
  // Only applies to story Ch1 bosses (FTUE / Tower / Grunt skip via the same
  // _isFtueOnly + _isTowerBattle gates that protect other branches above).
  if (_currentRacePureRace && !(currentBoss && (currentBoss._isFtueOnly || currentBoss._isTowerBattle))) {
    bossMaxHP = Math.ceil(bossMaxHP * RACE_PURE_HP_MULT);
  }
  // Block B3: per-battle voice flag reset + intro line (1.5s after battle start so
  // squad-pop animation completes). FTUE-only Pyredrake skips voice lines (it has
  // its own intro dialog flow); real boss kills get the voice. Tower battles also
  // skip — they don't have a story-canon boss line.
  try {
    if (typeof resetBossVoiceFlags === 'function') resetBossVoiceFlags();
    const _isFtueOnly  = currentBoss && currentBoss._isFtueOnly;
    const _isTower     = currentBoss && currentBoss._isTowerBattle;
    if (!_isFtueOnly && !_isTower && typeof maybeFireBossVoiceIntro === 'function') {
      maybeFireBossVoiceIntro();
    }
    // 2026-05-02 — COMBAT v2.1 P4 PR #4.D §6.3: pre-battle boss intel overlay.
    // Shows archetype + role tier + matchup + reactivities for ~3 seconds at
    // battle start. FTUE / training-dummy / Tower fights skip via internal gate.
    try {
      if (!_isFtueOnly && !_isTower && typeof showBossIntelOverlay === 'function') {
        showBossIntelOverlay(currentBoss);
      }
      // 2026-05-02 — COMBAT v2.1 P6 PR #6.F §13.2: archetype-specific FTUE intros
      // for Boss 21/23/24/25 (eternal/co_op/devourer/choice). Fires once per
      // install on first encounter. Skips FTUE / Tower / training paths.
      try {
        if (typeof _phase6MaybeFireBossArchetypeIntro === 'function') {
          _phase6MaybeFireBossArchetypeIntro(currentBoss);
        }
      } catch (e) { console.warn('[P6.F boss FTUE intro] failed:', e); }
    } catch (e) { console.warn('[P4 boss intel] failed:', e); }
    // PHASE 3 BLOCK 1 — Signature Combo cinematic. Reset per-battle one-shot flag
    // and fire if a combo is active. Skipped for FTUE/Tower like voice lines.
    _signatureComboCinemaShown = false;
    // PHASE 3 BLOCK 2 — Clutch Slow-Mo per-battle reset. Single fire per battle.
    _clutchSlowMoFired = false;
    // PHASE 3 BLOCK 3 — Death Flashback event log per-battle reset.
    battleEventLog = [];
    if (!_isFtueOnly && !_isTower && typeof maybeFireSignatureComboCinematic === 'function') {
      maybeFireSignatureComboCinematic();
    }
    // PHASE 4 BLOCK 1 — chronograph MATCH beat. First beat of the FTUE curriculum.
    // Fires for FTUE Pyredrake fight (the FIRST EVER battle for new players) once
    // the tray has rendered with the first piece. 850ms delay so initial squad-pop
    // animations + signature-combo-cinema-skip transition land cleanly before
    // pausing for the lesson. DEBT-014: use ftueIs() helper.
    if (typeof ftueIs === 'function' && ftueIs('pyredrake_fight')
        && typeof maybeChronoBeat === 'function') {
      setTimeout(() => {
        const tray = document.getElementById('tray');
        maybeChronoBeat('match', { targetEl: tray });
      }, 850);
    }
    // Block B3: archetype aura class on the boss portrait. CSS rule per archetype
    // (.boss-archetype-berserker / -armored / -bruiser / -phoenix / -assassin) drives
    // visual identity. Reduced-motion users inherit the static-fallback variants.
    // PHASE 5b BLOCK 1: extended with 5 Chapter 2 archetypes (hypnotist, engineer,
    // frenzy, tempo_disruptor, battery). CSS class name uses dash form for the
    // multi-word archetype (`tempo_disruptor` → `boss-archetype-tempo-disruptor`).
    const wrap = document.getElementById('bossImgWrap');
    if (wrap) {
      wrap.classList.remove(
        'boss-archetype-berserker', 'boss-archetype-armored', 'boss-archetype-bruiser',
        'boss-archetype-phoenix',   'boss-archetype-assassin',
        'boss-archetype-hypnotist', 'boss-archetype-engineer', 'boss-archetype-frenzy',
        'boss-archetype-tempo-disruptor', 'boss-archetype-battery'
      );
      const arch = (currentBoss && currentBoss.archetype) || 'bruiser';
      // Convert underscore → dash for CSS class (tempo_disruptor → tempo-disruptor)
      wrap.classList.add('boss-archetype-' + arch.replace(/_/g, '-'));
    }
    // PHASE 5b BLOCK 1: per-archetype init dispatcher. Calls init function for
    // current boss's archetype if defined. Init functions reset state + open any
    // archetype-specific UI elements (charge meter, frenzy stack counter, etc.).
    try {
      if (currentBoss && currentBoss.archetype && typeof initChapter2Archetype === 'function') {
        initChapter2Archetype(currentBoss.archetype);
      }
    } catch (e) { console.warn('Chapter 2 archetype init failed:', e); }
    // 2026-04-27 — Chapter 3 archetype init (VEIL OF FORGOTTEN GODS).
    try { if (typeof initChapter3Boss === 'function') initChapter3Boss(); } catch (e) { console.warn('Chapter 3 archetype init failed:', e); }
  } catch (e) { console.warn('B3 boss-battle init hook failed:', e); }
  // V3.0 Phase 2 Block 2.2 trap 5: reset _lastReward at battle start so a stale
  // floor-context from a previous fight can't contaminate the victory modal of
  // a subsequent non-floor fight (edge case: player launches floor, loses, quits,
  // then starts a direct battle via some other path).
  _lastReward = {
    amount: BOSS_REWARD, stihiya: 'ember', mult: 1,
    justUnlockedChapter2: false, justUnlockedChapter3: false,
    floorId: null, floorName: null, floorColor: null, floorBonusEssence: 0,
  };
  // MODIFIER: Bloodlust — +50% boss HP
  if (activeModifiers.has('bloodlust')) bossMaxHP = Math.floor(bossMaxHP * MODIFIERS.bloodlust.hpMult);
  bossHP = bossMaxHP;
  // 2026-05-02 — COMBAT v2.1 P2 §3.12: reset Stagger state per battle.
  // Pressure / state / revenge attack all start fresh. Idempotent.
  try { if (typeof resetStaggerState === 'function') resetStaggerState(); } catch (e) {}
  // 2026-05-02 — COMBAT v2.1 P3 §14.1: clear Phase 3 hook registry.
  // PRs #3.B-F register per-tier hooks at battle init; this reset
  // ensures clean slate so prior-fight registrations don't leak.
  try { if (typeof _resetPhase3Hooks === 'function') _resetPhase3Hooks(); } catch (e) {}
  // 2026-05-02 — COMBAT v2.1 P3 PR #3.B: reset Tank state + register Phase 3 hero hooks.
  try { if (typeof _resetPhase3TankState === 'function') _resetPhase3TankState(); } catch (e) {}
  // 2026-05-02 — COMBAT v2.1 P3 PR #3.C: reset Captain state + prompt Mythic threshold.
  try { if (typeof _resetPhase3CaptainState === 'function') _resetPhase3CaptainState(); } catch (e) {}
  // 2026-05-02 — COMBAT v2.1 P4 PR #4.B §5.8: reset reactivity state alongside
  // Phase 1/2/3 resets. Clears all 13 boss state vars + engineerElectrifiedRows.
  // battlePhasesTriggered already cleared above (legacy infra).
  try { if (typeof _resetReactivityState === 'function') _resetReactivityState(); } catch (e) {}
  // 2026-05-02 — COMBAT v2.1 P6 PR #6.A §2.4: reset Cosmic Ascension archetype state.
  // Clears all 14 archetype trackers (faces, wax, twin grief, flame phase) on battle init.
  try { if (typeof _resetPhase6ArchetypeState === 'function') _resetPhase6ArchetypeState(); } catch (e) {}
  // 2026-05-03 — COMBAT v2.1 P8 PR #8.B §4.2: apply scripted FTUE actions for Ch1 bosses.
  // Resets per-battle scripted state + activates per-boss overrides on first encounter.
  // Idempotent: skips if all guarantees seen (replay battle) or if not Ch1 / FTUE-only.
  try {
    if (typeof applyScriptedActions === 'function') applyScriptedActions(currentBoss);
  } catch (e) { console.warn('[P8.B applyScriptedActions] failed:', e); }
  // 2026-05-03 — COMBAT v2.1 P8 PR #8.B §4.2: fire battle_start guarantee event.
  try {
    if (typeof _phase8RecordBossFtueEvent === 'function') {
      _phase8RecordBossFtueEvent('battle_start', { boss: currentBoss });
    }
  } catch (e) {}
  // 2026-05-02 — COMBAT v2.1 P5 PR #5.A §2.7: consume reward carryovers.
  // _phase5StartingPressureBonus set by post-victory reward pick (+25 starting Pressure).
  // Applied AFTER state machine reset so addPressure sees a fresh meter.
  try {
    if (typeof _phase5StartingPressureBonus === 'number' && _phase5StartingPressureBonus > 0) {
      const _bonus = _phase5StartingPressureBonus;
      _phase5StartingPressureBonus = 0;
      if (typeof addPressure === 'function') addPressure(_bonus, 'p5_reward_carryover');
    }
  } catch (e) {}
  try { if (typeof registerPhase3HeroHooks === 'function') registerPhase3HeroHooks(); } catch (e) {}
  try { if (typeof _maybePromptMythicStaggerThreshold === 'function') _maybePromptMythicStaggerThreshold(); } catch (e) {}
  revivesRemaining = currentBoss.revives || 0;
  attackCountdown = currentBoss.attackInterval;
  // MODIFIER: Double Time — boss attacks 2× faster (halve interval)
  if (activeModifiers.has('doubleTime')) attackCountdown = Math.max(2, Math.floor(attackCountdown / MODIFIERS.doubleTime.speedMult));
  // 2026-04-27 — Block T.5 — Tower Heart "−1 boss turn" upgrade. Tower-only.
  if (_isTowerBattle && typeof getHeartUpgradeStats === 'function') {
    try {
      const hs = getHeartUpgradeStats();
      if (hs.attackCdBonus > 0) attackCountdown += hs.attackCdBonus;
    } catch (e) {}
  }
  grid = Array.from({length: SIZE}, () => Array(SIZE).fill(null));
  // Compute synergies from current HERO_DECK composition
  computeSynergies();
  // 2026-04-27 — Audio A.2.5: captainBuff SFX if captain dual is active this battle.
  try {
    if (typeof captainDual_active !== 'undefined' && captainDual_active
        && typeof playCaptainBuff === 'function') {
      // Delay 400ms so the SFX lands after the initial battle render breath.
      setTimeout(() => { try { playCaptainBuff(); } catch (e) {} }, 400);
    }
  } catch (e) {}
  hp = currentMaxHP;
  // MODIFIER: Fragile — override starting HP to 2 (overrides synergy bonus entirely)
  if (activeModifiers.has('fragile')) hp = Math.min(hp, MODIFIERS.fragile.hpOverride);
  damageDealt = 0;
  placementCount = 0;
  shieldCount = currentStartShields;
  // 2026-04-27 — Audio A.2.8: reset shield-tracker to current start count so
  // the first renderHP() of the battle doesn't fire a phantom shield SFX.
  try { _audioPrevShieldCount = currentStartShields; } catch (e) {}
  // 2026-04-27 — Audio: switch to boss battle music on fight start.
  try { if (typeof playContextMusic === 'function') playContextMusic('boss'); } catch (e) {}
  // 2026-04-27 — Anti-Deadlock: reset Hunter turn counters + emergency flags
  // + Rainbow tier state on battle start (spec §7.3 cooldown rule).
  try { resetAntiDeadlockState(); } catch (e) {}
  try { applyRainbowBuff(); } catch (e) {}
  // 2026-04-27 — Block T.2 — Tower pact starting-shields bonus. Adds on top
  // of synergy-derived start, capped at MAX_SHIELD + maxShieldBonus + 2 to
  // prevent runaway stacking. Outside Tower runs pactRunState.shieldsBonus = 0.
  if (_isTowerBattle && typeof pactRunState !== 'undefined' && pactRunState.shieldsBonus > 0) {
    const _shieldCap = (typeof MAX_SHIELD === 'number' ? MAX_SHIELD : 5) + 2 + (typeof maxShieldBonus === 'number' ? maxShieldBonus : 0);
    shieldCount = Math.min(_shieldCap, shieldCount + pactRunState.shieldsBonus);
  }
  // 2026-04-27 — Block T.5 — Tower Heart upgrades: HP mult + extra starting
  // shield. Apply Tower-only.
  if (_isTowerBattle && typeof getHeartUpgradeStats === 'function') {
    try {
      const hs = getHeartUpgradeStats();
      if (hs.hpMult > 1.0) {
        currentMaxHP = Math.ceil(currentMaxHP * hs.hpMult);
        if (typeof hp === 'number') hp = Math.min(currentMaxHP, Math.ceil(hp * hs.hpMult));
      }
      if (hs.extraShield > 0) {
        const _shieldCap = (typeof MAX_SHIELD === 'number' ? MAX_SHIELD : 5) + 2 + (typeof maxShieldBonus === 'number' ? maxShieldBonus : 0);
        shieldCount = Math.min(_shieldCap, shieldCount + hs.extraShield);
      }
    } catch (e) {}
  }
  ultCharges = { ...currentStartCharges };
  // V4.0 Phase 4 Task 4.1 — reset per-hero charges; seed every active deck member at 0.
  heroCharges = {};
  if (Array.isArray(HERO_DECK)) {
    for (const _h of HERO_DECK) if (_h && _h.id) heroCharges[_h.id] = 0;
  }
  // 2026-04-28 — Stage 1 polish: Chronicle Tutorial Dummy starts the player
  // with all ULTs ready (per spec §4.4 "All 3 heroes have full charge meters
  // at start"). Lets the player tap THORGAR / BLACKTOOTH / CRIMSON portraits
  // immediately and feel the ULT-fire loop without grinding charge first.
  // ultCharges legacy pool also primed for any element-pool readers (DEBT-014).
  if (currentBoss && currentBoss._isTrainingDummy) {
    try {
      if (Array.isArray(HERO_DECK)) {
        for (const _h of HERO_DECK) {
          if (_h && _h.id) {
            const cost = (typeof getUltCost === 'function') ? getUltCost(_h.id) : HERO_ULT_COST_DEFAULT;
            heroCharges[_h.id] = cost;
          }
        }
      }
      if (typeof ULT_THRESHOLD === 'object' && ULT_THRESHOLD.ember) {
        ultCharges.ember = ULT_THRESHOLD.ember;
      }
    } catch (e) { console.warn('Chronicle full-ULT prime failed:', e); }
  }
  heroFireCount = 0;
  knownDeadZones = new Set();
  gameEnded = false;
  battleStartTime = Date.now();
  // V2.0 Block 1.1: reset motif state
  chargedCells.clear();
  turnsSinceTideGrove = 0;
  bossRageEmber = 0;
  chainWindow = 0;
  chainStack = 0;
  tideDamageBonus = 0;
  frozenStreakTurns = 0;
  bossRagePending = 0;
  // V2.0 Block 1.2: grove + solar motif state
  bloomTokens.clear();
  bloomTriggeredCount = 0;
  radiantCells.clear();
  radiantAge.clear();
  guaranteedRadiantRemaining = 0;
  // V2.0 Block 1.3: umbra motif state
  umbraClearCounter = 0;
  umbraCarriedBonus = 0;
  // V2.0 Block 1.3: boss archetype state — derived from currentBoss.archetype (default 'bruiser')
  bossArchetype = currentBoss.archetype || 'bruiser';
  const _arch = BOSS_ARCHETYPES[bossArchetype] || BOSS_ARCHETYPES.bruiser;
  bossMaxHP = Math.floor(bossMaxHP * _arch.hpMult);   // rescale from base hp
  bossHP = bossMaxHP;
  // 2026-05-02 — COMBAT v2.1 P2 §3.12: reset Stagger state for archetype path too.
  try { if (typeof resetStaggerState === 'function') resetStaggerState(); } catch (e) {}
  // 2026-05-02 — COMBAT v2.1 P3 §14.1: clear Phase 3 hook registry (archetype path).
  try { if (typeof _resetPhase3Hooks === 'function') _resetPhase3Hooks(); } catch (e) {}
  // 2026-05-02 — COMBAT v2.1 P3 PR #3.B: reset Tank state + register Phase 3 hero hooks.
  try { if (typeof _resetPhase3TankState === 'function') _resetPhase3TankState(); } catch (e) {}
  // 2026-05-02 — COMBAT v2.1 P3 PR #3.C: reset Captain state + prompt Mythic threshold.
  try { if (typeof _resetPhase3CaptainState === 'function') _resetPhase3CaptainState(); } catch (e) {}
  // 2026-05-02 — COMBAT v2.1 P4 PR #4.B §5.8: reset reactivity state alongside
  // Phase 1/2/3 resets. Clears all 13 boss state vars + engineerElectrifiedRows.
  // battlePhasesTriggered already cleared above (legacy infra).
  try { if (typeof _resetReactivityState === 'function') _resetReactivityState(); } catch (e) {}
  // 2026-05-02 — COMBAT v2.1 P6 PR #6.A §2.4: reset Cosmic Ascension archetype state.
  // Clears all 14 archetype trackers (faces, wax, twin grief, flame phase) on battle init.
  try { if (typeof _resetPhase6ArchetypeState === 'function') _resetPhase6ArchetypeState(); } catch (e) {}
  // 2026-05-03 — COMBAT v2.1 P8 PR #8.B §4.2: apply scripted FTUE actions for Ch1 bosses.
  // Resets per-battle scripted state + activates per-boss overrides on first encounter.
  // Idempotent: skips if all guarantees seen (replay battle) or if not Ch1 / FTUE-only.
  try {
    if (typeof applyScriptedActions === 'function') applyScriptedActions(currentBoss);
  } catch (e) { console.warn('[P8.B applyScriptedActions] failed:', e); }
  // 2026-05-03 — COMBAT v2.1 P8 PR #8.B §4.2: fire battle_start guarantee event.
  try {
    if (typeof _phase8RecordBossFtueEvent === 'function') {
      _phase8RecordBossFtueEvent('battle_start', { boss: currentBoss });
    }
  } catch (e) {}
  // 2026-05-02 — COMBAT v2.1 P5 PR #5.A §2.7: consume reward carryovers.
  // _phase5StartingPressureBonus set by post-victory reward pick (+25 starting Pressure).
  // Applied AFTER state machine reset so addPressure sees a fresh meter.
  try {
    if (typeof _phase5StartingPressureBonus === 'number' && _phase5StartingPressureBonus > 0) {
      const _bonus = _phase5StartingPressureBonus;
      _phase5StartingPressureBonus = 0;
      if (typeof addPressure === 'function') addPressure(_bonus, 'p5_reward_carryover');
    }
  } catch (e) {}
  attackCountdown = _arch.attackCD;                    // override cadence from archetype
  if (activeModifiers.has('doubleTime')) attackCountdown = Math.max(2, Math.floor(attackCountdown / MODIFIERS.doubleTime.speedMult));
  bossAttackDmgMult = _arch.dmgMult;
  bossEnraged = false;
  bossArmorShields = _arch.special === 'shields' ? ARMORED_SHIELD_COUNT : 0;
  bossRevivedOnce = false;
  bossPhoenixImmuneTurns = 0;
  renderChainStackUI(); // clear stale pip from previous battle
  newPieces();
  document.getElementById('modal').classList.remove('active');
  // Reset modal boss emblem (will be re-set by victory/defeat modals)
  const modalEmblem = document.getElementById('modalBossEmblem');
  if (modalEmblem) modalEmblem.classList.remove('visible');
  document.getElementById('bossImgWrap').classList.remove('defeated');
  document.getElementById('bossBar').style.setProperty('--boss-color', currentBoss.color);
  document.getElementById('bossImg').src = ASSETS[currentBoss.img];
  // 2026-04-30 — Combat UI Redesign §5 (PR 4/6) + Final Polish §8 +
  // §10 (PR 5/6 + 6/6): set data-element on the boss-card, grid-wrap,
  // AND tray so element-themed HP gradient (PR #72), atmospheric
  // board background + edge glows + particles (PR #79), and the
  // tray drawer accent line + upward glow (this PR) all resolve in
  // lock-step. Spec uses fire/frost/earth/dark/light naming; map
  // from the existing stihiya tokens (ember/tide/grove/umbra/solar).
  try {
    const _el2spec = { ember: 'fire', tide: 'frost', grove: 'earth', umbra: 'dark', solar: 'light' };
    const _el = _el2spec[currentBoss.stihiya] || 'fire';
    const _bossCard = document.getElementById('bossBar');
    if (_bossCard) _bossCard.setAttribute('data-element', _el);
    // Final Polish §8: atmospheric board theming
    const _gridWrap = document.getElementById('gridWrap');
    if (_gridWrap) _gridWrap.setAttribute('data-element', _el);
    // Final Polish §10: tray drawer theming
    const _tray = document.getElementById('tray');
    if (_tray) _tray.setAttribute('data-element', _el);
  } catch (e) {}
  // Reset phase glow at battle start — applied dynamically by
  // renderBossHP based on HP %. Without this, a re-entry of a boss
  // we previously wounded inherits the stale phase class.
  try {
    const _portrait = document.getElementById('bossImgWrap');
    if (_portrait) _portrait.classList.remove('phase-2', 'phase-3');
  } catch (e) {}
  // V18.2: apply current chapter's boss emblems to grid/tray cell backgrounds
  applyBossEmblems();
  // Boss emblem badge on portrait corner
  const badge = document.getElementById('bossEmblemBadge');
  const emblemKey = `boss_emblem_${currentBossIdx + 1}`;
  if (badge && ASSETS[emblemKey]) {
    badge.style.backgroundImage = `url(${ASSETS[emblemKey]})`;
  }
  document.getElementById('bossName').textContent = currentBoss.name;
  document.getElementById('bossLevel').textContent = currentBoss.title;
  // POLISH v1 · PHASE 3 — phase markers на HP bar (данные из BOSS_PHASES)
  try {
    const progressEl = document.querySelector('.a-battle .v-battle-boss-card .v-progress');
    if (progressEl) {
      progressEl.classList.remove('phases-1', 'phases-2');
      progressEl.style.removeProperty('--phase-m1');
      progressEl.style.removeProperty('--phase-m2');
      const phaseData = (typeof BOSS_PHASES !== 'undefined') ? BOSS_PHASES[currentBoss.name] : null;
      const thresholds = Array.isArray(phaseData) ? phaseData.map(p => p && p.threshold).filter(n => typeof n === 'number') : [];
      if (thresholds.length === 0) {
        progressEl.classList.add('phases-1');
      } else if (thresholds.length === 1) {
        progressEl.classList.add('phases-2');
        progressEl.style.setProperty('--phase-m1', thresholds[0] + '%');
      } else {
        // 2+ thresholds → show the two highest (descending = first = m1)
        const sorted = thresholds.slice().sort((a, b) => b - a);
        progressEl.style.setProperty('--phase-m1', sorted[0] + '%');
        progressEl.style.setProperty('--phase-m2', sorted[1] + '%');
      }
    }
  } catch (e) { /* non-fatal */ }
  // V2.0 Block 1.3: archetype pip on boss-bar
  const archData = BOSS_ARCHETYPES[bossArchetype];
  if (archData) {
    let archPip = document.getElementById('bossArchetype');
    if (!archPip) {
      archPip = document.createElement('div');
      archPip.id = 'bossArchetype';
      archPip.className = 'boss-archetype-pip';
      const info = document.querySelector('.boss-info');
      if (info) info.appendChild(archPip);
    }
    archPip.textContent = archData.icon + ' ' + archData.label;
  }
  render();
  // Narrator: boss appears + run start (delayed so UI settles)
  setTimeout(() => speakNarrator('bossAppears'), 500);
  setTimeout(() => speakNarrator('runStart'), 4200);
  // 2026-04-27 — Race-passive UX visibility banner. Show 1 banner per active
  // passive at battle start, staggered so each gets eye-time. Fires AFTER boss
  // intro/narrator so it doesn't collide with the boss reveal moment.
  // 2026-04-28 — UX cleanup: same intent as the synergy-bar hide in
  // renderSynergyBar — post-FTUE the player has seen what race-passives are
  // and doesn't need a battle-start recap chain. Mechanics still apply; only
  // the start-of-battle recap chain is suppressed. During FTUE the chain
  // stays so the player sees the system once.
  try {
    const _ftueDoneRP = (typeof isFtueComplete === 'function') && isFtueComplete();
    if (!_ftueDoneRP && typeof getActiveRacePassives === 'function') {
      const active = getActiveRacePassives();
      active.forEach((p, i) => {
        setTimeout(() => {
          try {
            if (typeof flashText === 'function') {
              flashText(p.label + ' ACTIVE · ' + p.desc, p.color);
            }
          } catch (e) {}
        }, 1400 + i * 1100);  // 1.4s start, 1.1s gap → never overlaps boss banners
      });
    }
  } catch (e) { console.warn('race-passive banner failed:', e); }
  // V3.0 Phase 6 Block 6.2: pre-battle boss intro on FIRST encounter (non-FTUE, non-F1).
  // Floor 1 skips intros to keep trial runs snappy — Floor 2+ introduces narrative.
  // Fires after a short delay so boss-appears narration doesn't collide with dialog.
  // V3.0 Phase 7 Block 7.1: also skip for Tower battles (seeded random bosses
  // would fire intros on every floor — narrative-destructive).
  // V3.0 Phase 7 Block 7.2: also skip for Arena (synthetic bosses have opponent
  // names, not canonical boss names — dialog lookup would miss anyway).
  try {
    if (currentBoss && currentBoss.name && !currentBoss._isTowerBattle) {
      const prefix = getBossDialogPrefix(currentBoss.name);
      if (prefix && currentFloorId !== 1 && (typeof isFtueActive !== 'function' || !isFtueActive())) {
        const introId = `${prefix}_intro`;
        if (DIALOG_LINES[introId] && !seenDialogs.has(introId)) {
          setTimeout(() => playDialog(introId), 600);
        }
      }
    }
  } catch (e) { console.warn('boss intro hook failed:', e); }
  // 2026-04-28 — Player Education Stages 5/7/8: per-boss progressive teaching.
  // Fires when player first enters Boss 2 / 3 / 4 in Chapter 1 (one boss-entry
  // per modal). Delayed 1500ms so battle UI settles before the overlay layers
  // on top. Self-gates: skip during FTUE + Tower (handled by _eduBattleGate).
  try {
    if (currentBoss && !currentBoss._isFtueOnly && !currentBoss._isTowerBattle && currentChapter === 1) {
      // Boss indices in Ch1: 0=Pyredrake, 1=Abyssal Tyrant, 2=Grovewarden,
      // 3=Solar Phoenix, 4=Crypt Lich. We teach mechanics on entry to 1/2/3.
      if (currentBossIdx === 1 && typeof maybeShowElementEducation === 'function') {
        setTimeout(maybeShowElementEducation, 1500);
      } else if (currentBossIdx === 2 && typeof maybeShowMageEducation === 'function') {
        setTimeout(maybeShowMageEducation, 1500);
      } else if (currentBossIdx === 3 && typeof maybeShowCaptainEducation === 'function') {
        setTimeout(maybeShowCaptainEducation, 1500);
      }
    }
  } catch (e) { console.warn('mechanics education hook failed:', e); }
}

// Alias per task spec — `startBattle(chap, idx, opts)` is the public API shape
// the orchestrator brief asks for. Legacy reads chapter / idx from module
// globals; we accept positional args for the new shell's call sites and
// forward to the legacy entry point.
export function startBattle(chap, idx, _opts) {
  if (typeof chap === 'number') currentChapter = chap;
  if (typeof idx === 'number') currentBossIdx = idx;
  startBossBattle();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// dealDamage — legacy lines 57093-57348 (CENTRAL DAMAGE DISPATCHER)
// SACRED per CLAUDE.md §2.1 — combo crit formula composes through the
// _multStack here. Byte-perfect to legacy.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function dealDamage(amount, isCrit = false, critMult = 0) {
  if (gameEnded) return;
  // Profile P2 — track lifetime damage dealt (positive deltas only, post-armor pre-synergy is fine for "raw effort" metric).
  try { if (typeof trackProfileDamage === 'function' && amount > 0) trackProfileDamage(amount); } catch (e) {}
  // V2.0 Block 1.3: ARMORED archetype — absorb 70% of incoming dmg per shield break (pre-synergy)
  // V2.0 Stage 5 Block 5.2: THARA T3 bossStonebloodBypass — skip armored absorb ONCE (one-shot consume)
  if (bossStonebloodBypass) {
    bossStonebloodBypass = false;
    flashText('STONEBLOOD PIERCED', '#E85D4A');
  } else {
    amount = applyArmoredAbsorb(amount);
  }
  // Apply synergy multipliers: global race bonus + current passive context (set by hero fire)
  // V2.0 Block 3.2: _warbandStrikeContext set by dispatch loop for warrior fires (×1.5 during window)
  // V2.0 Block 3.3: _hunterMarkContext set for any fire while Mark active (×1.4, consumed on first damage)
  // V2.0 Block 4.1: _grommarRallyContext (×2.0, warrior/hunter only) + _packMarkContext (×1.3, any role)
  // V2.0 Block 4.4: _helioRoarContext (×1.2 any fire during Roar window, no per-fire consumption)
  // HERO_GRAMMAR §6: captain dual race-buff (×1.05 / ×1.15 / ×1.30) on heroes of captain's race.
  //   Computed inline from _currentFiringHero so both fire and ULT damage paths benefit; no
  //   set/clear needed in fireHero / ultRoleDispatch (single source of truth).
  // PHASE 3 BLOCK 1: Signature Combo passive damage multiplier. Active for the entire
  // battle if a combo was detected at squad-build time (Tier 1=+10%, Tier 2=+20%,
  // Tier 3=+30%). Applies to ALL damage from any squad member — it's a squad-wide
  // bonus, not race-scoped (race-scoping is the captain dual buff layer).
  // V2.0 Stage 5 Block 5.7: FIRE_MULT_CAP — clamp combined multiplier stack to 3x per shipping contract F.1.2
  const _baseAmount = amount;
  _captainDualContext = (captainDual_active && _currentFiringHero
                         && _currentFiringHero.race === captainDual_race) ? captainDual_raceMult : 1;
  // 2026-04-27 — Ch3 VOIDPRIESTESS "captain_disabled" debuff — disable dual buff.
  try {
    if (typeof _ch3HasDebuff === 'function' && _ch3HasDebuff('captain_disabled')) {
      _captainDualContext = 1;
    }
  } catch (e) {}
  // 2026-04-27 — Block 6.5 DEBT-6 — ARCHIVAL "captain_inverted" seal:
  // captain dual buff inverted (mult > 1 → reciprocal < 1).
  try {
    if (typeof _ch3HasSeal === 'function' && _ch3HasSeal('captain_inverted')
        && _captainDualContext && _captainDualContext !== 1) {
      _captainDualContext = 1 / _captainDualContext;
    }
  } catch (e) {}
  _signatureComboContext = (activeSignatureCombo && activeSignatureCombo.mult) || 1;
  // PHASE 5b BLOCK 3 — Hypnotist Suggestion: if VEROTHIRA "suggested" the firing hero
  // and player obeyed (fired that hero this turn), apply phase-scaled bonus damage
  // (P1=+30%, P2=+50%, P3=+75%). Choice-based mechanic: ignore = no penalty, obey = bonus.
  // Consumed on use (suggestion cleared so each suggestion is one-shot).
  let _hypnoSuggestContext = 1;
  if (typeof hypnotistSuggestedHeroIds !== 'undefined'
      && hypnotistSuggestedHeroIds.length > 0
      && _currentFiringHero
      && hypnotistSuggestedHeroIds.includes(_currentFiringHero.id)) {
    const phase = (typeof _bossArchetypePhase === 'function') ? _bossArchetypePhase() : 1;
    const bonus = phase === 1 ? HYPNOTIST_OBEY_BONUS_P1
                : phase === 2 ? HYPNOTIST_OBEY_BONUS_P2
                : HYPNOTIST_OBEY_BONUS_P3;
    _hypnoSuggestContext = 1 + bonus;
    // Clear suggestion to prevent stacking re-fires within same suggestion window.
    const idx = hypnotistSuggestedHeroIds.indexOf(_currentFiringHero.id);
    if (idx >= 0) hypnotistSuggestedHeroIds.splice(idx, 1);
    try { flashText('🌸 OBEYED · +' + Math.round(bonus * 100) + '%', '#9B59D6'); } catch(e) {}
    try { renderHypnotistVisuals(); } catch(e) {}
  }
  // §8 race-passive — SHARKS 3+-of-race: BLOODHUNT — +30% dmg when boss HP < 30%.
  let _bloodhuntContext = 1;
  try {
    if (Array.isArray(HERO_DECK) && bossMaxHP > 0) {
      const sharkCount = HERO_DECK.filter(h => h && h.race === 'shark').length;
      if (sharkCount >= 3 && (bossHP / bossMaxHP) < SHARK_BLOODHUNT_THRESHOLD) {
        _bloodhuntContext = SHARK_BLOODHUNT_MULT;
        // First-proc-per-battle banner so player knows BLOODHUNT just activated.
        if (!racePassiveFirstProcSeen['shark3']) {
          try { flashRacePassiveOnce('shark3', 'BLOODHUNT +30%', STIHIYA_COLORS.tide || '#3B8BD4'); } catch (e3) {}
        }
      }
    }
  } catch (e) {}
  // §8 race-passive — PIRATES 3+-of-race: 15% chance to DOUBLE the combo mult.
  // Roll once per dealDamage call; banner only on proc to avoid spam.
  let _pirateDoubleContext = 1;
  try {
    if (Array.isArray(HERO_DECK)) {
      const pirateCount = HERO_DECK.filter(h => h && h.race === 'pirate').length;
      if (pirateCount >= 3 && Math.random() < PIRATE_DOUBLE_COMBO_CHANCE) {
        _pirateDoubleContext = 2;
        pirateDoubleComboFiredThisBattle++;
        try { flashRacePassiveOnce('pirate3', 'PIRATE DOUBLE ×2', '#FFD53D'); } catch (e2) {}
      }
    }
  } catch (e) {}
  // 2026-04-27 — Block T.2 — Tower pact damage multiplier. Folded into the
  // _multStack so all existing clamps (FIRE_MULT_CAP) still apply. Reads
  // pactRunState.damageMult which defaults to 1.0 outside Tower runs.
  const _pactDamageMult = (typeof pactRunState !== 'undefined' && _isTowerBattle)
    ? (pactRunState.damageMult || 1.0) : 1.0;
  // 2026-04-27 — Block T.7 — Weekly Element Theme. Tower-only ×1.5/×0.5
  // multiplier on damage of dominant/suppressed-element heroes. No-op
  // outside Tower battles or for neutral elements.
  let _towerThemeMult = 1.0;
  try {
    if (_isTowerBattle && typeof _currentFiringHero !== 'undefined' && _currentFiringHero
        && _currentFiringHero.stihiya && typeof getTowerThemeMult === 'function') {
      _towerThemeMult = getTowerThemeMult(_currentFiringHero.stihiya);
    }
  } catch (e) {}
  // 2026-04-27 — Block T.6 — 24h Buff System damage mult + race-pure bonus.
  // Active outside Tower too (per spec §9 — buffs are global retention hooks).
  let _buffDamageMult = 1.0;
  try {
    if (typeof getBuffValue === 'function') {
      _buffDamageMult = getBuffValue('damageMult', 1.0);
      // Race-pure buff stacks if all squad heroes share a race
      const racePureMult = getBuffValue('racePureMult', 1.0);
      if (racePureMult > 1.0 && Array.isArray(HERO_DECK) && HERO_DECK.length > 0) {
        const races = new Set(HERO_DECK.filter(h => h && h.race).map(h => h.race));
        if (races.size === 1) _buffDamageMult *= racePureMult;
      }
    }
  } catch (e) {}
  // 2026-05-02 — COMBAT v2.1 P3 §3.4: Mythic Tank squad-wide damage boost.
  // Active during Stagger when a Mythic Tank is in HERO_DECK; +30% baseline,
  // +35% for THUNDERBEAT (rock_tank) and AEGIS (spark_tank). The flag is set
  // by the onStaggerEnter hook and cleared by onStaggerExit.
  const _mythicTankSquadMult = (typeof _getMythicTankStaggerMult === 'function')
                               ? _getMythicTankStaggerMult() : 1.0;
  // 2026-05-02 — COMBAT v2.1 P3 §4.5 (PR #3.F): AEGIS-spark T3 sun aura.
  // Post-AEGIS PROTOCOL window — squad +10% damage for 5 turns when the
  // owning hero was AEGIS (spark_tank). Composes additively in mult stack.
  const _sparkSunAuraMult = (typeof _getSparkSunAuraDmgMult === 'function')
                            ? _getSparkSunAuraDmgMult() : 1.0;
  const _multStack = currentDmgMult * _passiveDmgContext * _ultDmgContext
                   * _warbandStrikeContext * _hunterMarkContext
                   * _grommarRallyContext * _packMarkContext * _helioRoarContext
                   * _captainDualContext * _signatureComboContext * _hypnoSuggestContext
                   * _bloodhuntContext * _pirateDoubleContext * _pactDamageMult
                   * _towerThemeMult * _buffDamageMult * _mythicTankSquadMult * _sparkSunAuraMult
                   * (typeof getHeartTowerMult === 'function' ? getHeartTowerMult('damageMult') : 1.0)
                   // 2026-04-27 — Ch3 mechanics:
                   //   TWILIGHT VESSEL DUAL SHIFT — hunter+matching-element +50%, others -25%
                   //   VOIDPRIESTESS hunter_silenced — Hunter dmg ×0.5
                   //   VOIDPRIESTESS mage_halved — Mage dmg ×0.5
                   //   ARCHIVAL ETERNAL dmg_halved seal — all dmg ×0.5
                   * (typeof getHeroAscensionMult === 'function' && _currentFiringHero ? getHeroAscensionMult(_currentFiringHero) : 1.0)
                   * (typeof _ch3TwilightMult === 'function' && _currentFiringHero ? _ch3TwilightMult(_currentFiringHero) : 1.0)
                   * ((typeof _ch3HasDebuff === 'function' && _ch3HasDebuff('hunter_silenced') && _currentFiringHero && _currentFiringHero.newRole === 'hunter') ? 0.5 : 1.0)
                   * ((typeof _ch3HasDebuff === 'function' && _ch3HasDebuff('mage_halved') && _currentFiringHero && _currentFiringHero.newRole === 'mage') ? 0.5 : 1.0)
                   // 2026-04-29 — Block 6.5 DEBT-5 closed: tank_halved + warrior_blocked
                   // moved off the damage stack and into spec-correct hooks (applyTankUlt
                   // halves shield gain, canPlace blocks first-row placements). The
                   // damage-mult placeholders that lived here are gone.
                   * ((typeof _ch3HasSeal === 'function' && _ch3HasSeal('dmg_halved')) ? 0.5 : 1.0)
                   // 2026-04-27 — Block 6.5 DEBT-10: dual-element pact synergies.
                   //  Folds the product of all squad-satisfied dual pacts into the stack.
                   //  Returns 1.0 outside Tower or when no dual pacts active.
                   * (typeof _pactDualElementMult === 'function' ? _pactDualElementMult() : 1.0)
                   // 2026-04-27 — Block H.8: Tier 1 milestone passives.
                   //  LV3 Crit (5%×1.5) + LV5 Cascade (+10% during combos). Folds per firing hero.
                   //  LV7 Element Mastery applied as flat post-clamp bonus below.
                   * (typeof _heroLevelMilestoneMult === 'function' && _currentFiringHero ? _heroLevelMilestoneMult(_currentFiringHero) : 1.0);
  // 2026-05-02 — COMBAT v2.1 P2 §3.5: damage clamp uses context-aware
  // getFireMultCap() (chapter × state × Tower) instead of static FIRE_MULT_CAP.
  // In Stagger state the cap is 1.5× wider — that's the "uncap window" the
  // Pressure meter rewards. Active/Recovery use 0.7× (tighter than legacy).
  const _cap = (typeof getFireMultCap === 'function') ? getFireMultCap() : FIRE_MULT_CAP;
  const _clampedMult = Math.min(_cap, _multStack);
  amount = Math.floor(_baseAmount * _clampedMult);
  // Block H.8 — LV7 Element Mastery flat add (post-clamp, not subject to FIRE_MULT_CAP).
  try {
    if (typeof _heroLevelFlatBonus === 'function' && _currentFiringHero) {
      amount += _heroLevelFlatBonus(_currentFiringHero);
    }
  } catch (e) {}
  // V2.0 Block 3.3: track whether Hunter Mark bonus actually applied to damage (drives consumption logic)
  // (consumption triggers even if clamp cut the bonus — the Mark was "used" even though effective mult capped)
  if (_hunterMarkContext > 1) _hunterMarkConsumed = true;
  // V2.0 Block 4.1: track Pack Mark / Grommar Rally consumption (only consume on actual damage flow)
  if (_packMarkContext > 1)     _packMarkConsumed = true;
  if (_grommarRallyContext > 1) _grommarRallyConsumed = true;
  // 2026-05-02 — COMBAT v2.1 P2 §3.6: damage application + Overflow conversion.
  // Overshoot caps at the next phase gate (70% / 35% / 0). Excess converts to
  // ULT charge / essence / shield / Tower points via applyOverflowConversion.
  // AAA principle: no investment lost on overkill.
  let actualDmg, overflowDmg;
  const _phaseGate = (typeof _getPhaseGateHP === 'function') ? _getPhaseGateHP() : 0;
  const _remainingToGate = bossHP - _phaseGate;
  if (amount > _remainingToGate && _remainingToGate > 0) {
    // Damage caps at phase gate; rest converts to overflow.
    actualDmg   = _remainingToGate;
    overflowDmg = amount - _remainingToGate;
  } else if (amount >= bossHP) {
    // Lethal hit (or beyond) — overflow is everything past bossHP.
    actualDmg   = bossHP;
    overflowDmg = amount - bossHP;
  } else {
    actualDmg   = amount;
    overflowDmg = 0;
  }
  bossHP -= actualDmg;
  damageDealt += actualDmg;
  floatDamage(actualDmg, isCrit, critMult);
  hitBoss(critMult > 1);
  if (overflowDmg > 0) {
    try { if (typeof applyOverflowConversion === 'function') applyOverflowConversion(overflowDmg); }
    catch (e) { console.warn('overflow conversion failed:', e); }
  }
  // PHASE 5b BLOCK 5 — Frenzy hit detection. Boss took damage this placement →
  // mark frenzyHitThisTurn so _tickFrenzy resets/decays stacks at end of turn.
  // Only applies when current boss is Frenzy archetype (URSARO).
  if (actualDmg > 0 && typeof currentBoss !== 'undefined'
      && currentBoss && currentBoss.archetype === 'frenzy') {
    frenzyHitThisTurn = true;
  }
  // PHASE 5b BLOCK 7 — Battery hit detection. Boss took damage this placement →
  // mark batteryHitThisPlacement so _tickBattery accumulates +1 charge instead of
  // +2. P3 ignores this distinction (always +2). Only applies when current boss
  // is Battery archetype (HELIOTRON).
  if (actualDmg > 0 && typeof currentBoss !== 'undefined'
      && currentBoss && currentBoss.archetype === 'battery') {
    batteryHitThisPlacement = true;
  }
  // PHASE 3 BLOCK 3 — Death Flashback log (big crits only — combo crits ≥ 2.0× or
  // any single hit dealing ≥ 600 dmg are "highlight reel" worthy).
  try {
    if ((critMult >= 2.0) || (actualDmg >= 600)) {
      const _src = (_currentFiringHero && _currentFiringHero.name) ? _currentFiringHero.name : 'CRIT';
      const _label = (critMult >= 2.0) ? (_src + ' · CRIT ×' + critMult.toFixed(1)) : (_src + ' · BIG HIT');
      logBattleEvent('crit', _label, '−' + actualDmg.toLocaleString('ru-RU') + ' dmg', '#FFD53D');
    }
  } catch (e) {}
  // V2.0 Block 1.3: BERSERKER archetype — check enrage threshold post-damage
  maybeEnrageBerserker();
  // V3.0 Phase 6 Block 6.1: multi-phase boss transitions. Fires AFTER enrage
  // so berserker + phase transitions compose naturally. Early-returns for FTUE
  // and Floor 1 (Voidfang exempt — Block 6.3). Safe when BOSS_PHASES lookup misses.
  try { maybePhaseTransition(); } catch (e) { console.warn('phase transition check failed:', e); }
  // Block B3: midfight voice line — fires once when boss HP first crosses 50%.
  // Routed through playDialogScript queue (TASK #2.2b) so it serializes with any
  // other dialog. Internal idempotency flag prevents re-fire on subsequent ticks.
  try { maybeFireBossVoiceMidfight(); } catch (e) {}
  if (bossHP <= 0) {
    bossHP = 0;
    // V2.0 Stage 5 Block 5.1: kill-shot attribution — current firing hero earns +5 XP (total +8)
    // Guarded: revivesRemaining > 0 means Phoenix will revive the boss; not a real kill.
    if (_currentFiringHero && revivesRemaining === 0) {
      _currentFiringHero._landedKillShot = true;
    }
    // Block B3: death voice line fires BEFORE onBossDefeated so the boss's last
    // words appear before the cinematic chain. Phoenix mid-life "deaths" (revives
    // remaining) skip via the same revivesRemaining guard above — only the final
    // kill triggers the death line.
    if (revivesRemaining === 0) {
      try { maybeFireBossVoiceDeath(); } catch (e) {}
    }
    onBossDefeated();
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// bossAttack — legacy lines 59033-59220 (TURN LOOP / DEFERRED from T1.10.7)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function bossAttack() {
  // 2026-05-02 — COMBAT v2.1 P2 §3.9: boss attacks gated to Active state only.
  // During Stagger the boss is wide open — no void scatter, no signature.
  // During Recovery the boss telegraphs revenge (handled separately by
  // executeRevengeAttack on Recovery exit). The attack countdown UI may
  // still tick visually during Stagger; the actual attack just no-ops.
  if (typeof bossState !== 'undefined' && bossState !== BOSS_STATE_ACTIVE) {
    return;
  }
  // 2026-05-02 — COMBAT v2.1 P3 §4.3 (PR #3.F): BULWARK T3 frozen ward.
  // While AEGIS PROTOCOL is active and the owning hero is BULWARK
  // (shark_tank), boss attacks are completely no-op'd (frozen ward).
  if (typeof _isBulwarkFrozenWardActive === 'function' && _isBulwarkFrozenWardActive()) {
    try { flashText('❄ FROZEN WARD · ATTACK BLOCKED', '#5DCAFF'); } catch (e) {}
    try { vibrate([60, 30, 60]); } catch (e) {}
    return;
  }
  // 2026-05-02 — COMBAT v2.1 P4 PR #4.C §4.4: assassin stealth turn.
  // bossStealthTurns set to 1 by assassin_p1_p2; boss skips this attack.
  // bossNextAttackBonus persists (+50%) until next non-stealth attack.
  if (typeof bossStealthTurns === 'number' && bossStealthTurns > 0) {
    try { flashText('🌫 STEALTH · ATTACK HIDDEN', '#9B59D6'); } catch (e) {}
    return;
  }
  // 2026-04-28 — CHRONICLE Tutorial Dummy: training constructs never attack.
  // Early-return suppresses SFX, cell spawning, rage mechanics, everything.
  // Player learns mechanics without pressure (BLOCKSWORN_PLAYER_EDUCATION.md §4.4).
  if (currentBoss && currentBoss._isTrainingDummy) return;
  // 2026-04-27 — Audio A.2.6: boss attack lands → bossDamage SFX (per spec §4.1).
  // Intensity scales with current HP — heavier hits when low HP (visceral cue).
  try {
    if (typeof playBossDamage === 'function' && typeof hp !== 'undefined' && typeof currentMaxHP !== 'undefined') {
      const hpPct = currentMaxHP > 0 ? (hp / currentMaxHP) : 1;
      const intensity = hpPct < 0.33 ? 'heavy' : (hpPct < 0.66 ? 'medium' : 'light');
      playBossDamage(intensity);
    }
  } catch(e){}
  // V2.0 Stage 5 Block 5.2: THARA T2 tharaRageAutoArm — rage auto-arms on any boss attack
  if (tharaRageAutoArm) {
    tharaRageArmed = true;
  }
  // V2.0 Block 2.1: RAIDERS dual synergy — first boss attack fully absorbed
  if (firstAttackImmune) {
    firstAttackImmune = false; // consume
    flashText('RAIDERS · ATTACK ABSORBED', '#FF4D1F');
    vibrate([120, 60, 120]);
    return; // maybeBossAttack will reset attackCountdown on its own
  }
  // Find empty cells
  const empties = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++)
    if (grid[r][c] === null) empties.push([r, c]);
  if (empties.length === 0) return;
  // Shuffle
  for (let i = empties.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [empties[i], empties[j]] = [empties[j], empties[i]];
  }
  // V2.0 Block 1.1: base spawn = 3. Translated rage mechanics (no numeric bossDmg in game):
  //  - TIDE rage (bossRagePending ≥ 1.25): scale up count by that mult for first post-thaw attack
  //  - EMBER rage (bossRageEmber): additive % → scales count (rewards player for balanced play)
  //  - VOID PRESSURE: gridFillRatio > 0.60 → +1 extra void (punishes hoarding, ember motif flavor)
  // V2.0 Block 1.2: GROVE DEFENSE — subtract groveDefense() from final void count (additive, not %)
  // V2.0 Block 1.3: ARCHETYPE dmgMult — scales baseCount (assassin ×1.4, armored ×0.7, bruiser ×1.0, +berserker enrage ×2)
  let baseCount = 3 * bossAttackDmgMult;
  let mult = 1;
  if (bossRagePending > 1) { mult *= bossRagePending; bossRagePending = 0; }
  if (bossRageEmber > 0)   mult *= (1 + bossRageEmber);
  // 2026-05-02 — COMBAT v2.1 P4 PR #4.C §5.6: single-shot bossNextAttackBonus.
  // Set by bruiser_p1_p2 (heavy strike +50%) or assassin_p1_p2 (stealth strike).
  // Consumed on this fire — resets to 1.0 after applying.
  if (typeof bossNextAttackBonus === 'number' && bossNextAttackBonus > 1.0) {
    mult *= bossNextAttackBonus;
    try { flashText('💥 STRIKE +' + Math.round((bossNextAttackBonus - 1) * 100) + '%', '#FF4D1F'); } catch (e) {}
    bossNextAttackBonus = 1.0;
  }
  // PHASE 5b BLOCK 5 — Frenzy stack damage scaling. When boss is Frenzy archetype,
  // each stack adds +5% to attack severity (more void cells spawned). Stack count
  // resets/decays when boss takes damage (handled in dealDamage hit detection).
  if (typeof currentBoss !== 'undefined' && currentBoss
      && currentBoss.archetype === 'frenzy'
      && typeof frenzyStacks !== 'undefined' && frenzyStacks > 0) {
    mult *= (1 + frenzyStacks * FRENZY_DMG_PER_STACK);
  }
  let n = Math.ceil(baseCount * mult);
  if (MOTIFS_ENABLED.ember && gridFillRatio() > EMBER_VOID_PRESSURE_THRESH) n += EMBER_VOID_PRESSURE_BONUS;
  n = Math.max(0, n - groveDefense()); // V2.0 Block 1.2: grove damage reduction (respects MOTIFS_ENABLED.grove internally)
  // V2.0 Block 4.2: GLACIER Ice Armor — reduce next N boss attacks by 1 cell (stacks additively with grove defense)
  // V2.0 Stage 5 Block 5.3: T2+ glacierIceArmorReduce (1→2 per hit), T3+ glacierIceArmorPermanent (no decay)
  if (glacierIceArmorHits > 0) {
    n = Math.max(0, n - glacierIceArmorReduce);  // T0=1, T2+=2
    if (!glacierIceArmorPermanent) {
      glacierIceArmorHits--;
      if (glacierIceArmorHits === 0) flashText('ICE ARMOR ENDS', STIHIYA_COLORS.tide);
    }
  }
  n = Math.min(n, empties.length);
  // V3.0 Phase 1 Block 1.3: FTUE Grunt hard cap. Applied AFTER all modifier
  // logic so it truly wins against every other path (rage stacks, pressure
  // bonuses, grove defense subtraction, glacier ice armor). Capped to empties
  // count to preserve the n===0 → NATURE SHIELDED branch when the grid is
  // nearly full. Triple-gate (beat + currentBoss + _isFtueOnly) = no leakage.
  if (ftueBeat === 'grunt_fight' && currentBoss && currentBoss._isFtueOnly) {
    n = Math.min(FTUE_GRUNT_VOID_SPAWN, empties.length);
  }
  // V2.0 Block 1.2: full block — show nature shield message instead of empty attack
  if (n === 0) {
    flashText('NATURE SHIELDED', STIHIYA_COLORS.grove);
    vibrate([30, 60, 30]);
    return;
  }
  const picks = empties.slice(0, n);
  flashAttack(n);
  vibrate([40, 30, 40, 30, 60]);
  await sleep(300);
  const voidKey = 'void_' + currentBoss.stihiya;
  for (const [r, c] of picks) grid[r][c] = voidKey;

  // §5 matrix Tank passives — element-specific reactions to boss attacks.
  // Each fires only if the corresponding hero is in HERO_DECK.
  // IRONSCALE (Earth Tank): "Auto-convert hits to earth-cells" — convert N
  // freshly-spawned voids back to grove absorbers (registers via groveAbsorbedByCell
  // so REVENGE BURST consumes them later). Up to 1/3 of incoming voids.
  if (typeof HERO_DECK !== 'undefined' && Array.isArray(HERO_DECK)
      && HERO_DECK.some(h => h && h.id === 'crocodile_tank') && MOTIFS_ENABLED.grove) {
    const convertCount = Math.min(picks.length, Math.max(1, Math.floor(picks.length / 3)));
    let converted = 0;
    for (let i = 0; i < picks.length && converted < convertCount; i++) {
      const [r, c] = picks[i];
      grid[r][c] = 'grove';
      if (typeof groveAbsorbedByCell !== 'undefined') groveAbsorbedByCell.set(r + '_' + c, 0);
      converted++;
    }
    if (converted > 0) flashText('STONE SKIN · ' + converted + ' → 🌍', STIHIYA_COLORS.grove);
  }
  // IRONBELLY (Fire Tank): "Counter-burns boss" — chip damage proportional to
  // void cells absorbed. 25 dmg per incoming void, capped at 200 per attack.
  // 2026-04-27 — Block H.9c — IRON FORGE (T2): IRONBELLY ascended doubles
  // counter-burn (50/void, cap 400) and adds bonus +50% boss-HP-burn read
  // for high-roll synergy.
  if (typeof HERO_DECK !== 'undefined' && Array.isArray(HERO_DECK)
      && HERO_DECK.some(h => h && h.id === 'pirate_tank') && MOTIFS_ENABLED.ember) {
    const _t2IronbellyAny = (typeof _t2BonusInDeck === 'function') ? _t2BonusInDeck('pirate_tank', 'ironbellyCounterAny') : null;
    const _perVoid = _t2IronbellyAny ? 50 : 25;
    const _cap     = _t2IronbellyAny ? 400 : 200;
    const counterDmg = Math.min(_cap, picks.length * _perVoid);
    if (counterDmg > 0) {
      flashText((_t2IronbellyAny ? '🔥 IRON FORGE · ' : 'FIREBRAND · ') + 'COUNTER ' + counterDmg, '#FF8B3D');
      dealDamage(counterDmg, true);
    }
  }

  render();
  const cellEls = document.querySelectorAll('.grid .cell');
  for (const [r, c] of picks) cellEls[r*SIZE+c].classList.add('spawning');

  // 2026-04-27 — Chapter 1 tutorial: explain boss attacks on FIRST hit (any
  // Chapter 1 boss, after FTUE complete). Suppressed during FTUE so the
  // scripted Pyredrake FTUE flow stays clean. Two dialogs chained: attack
  // mechanic first, void-cell consequence second. Gated by seenDialogs so
  // each fires only once per install. Routed through playDialog → inherits
  // dialog defer-queue (no plate/banner overlap).
  try {
    const ftueOff  = (typeof isFtueActive !== 'function') || !isFtueActive();
    const ch1Boss  = (typeof currentChapter !== 'undefined') && currentChapter === 1;
    const seen     = (typeof seenDialogs !== 'undefined') && seenDialogs;
    if (ftueOff && ch1Boss && seen && !seen.has('tut_boss_attack_intro')) {
      // Defer 600ms so the void-cell spawn animation lands first; player sees
      // the consequence, then reads the explanation.
      setTimeout(() => {
        try {
          if (typeof playDialog === 'function') {
            playDialog('tut_boss_attack_intro', () => {
              setTimeout(() => playDialog('tut_void_cells'), 250);
            });
          }
        } catch (e) {}
      }, 600);
    }
  } catch (e) { /* tutorial is decorative — never break combat */ }
  // 2026-05-02 — COMBAT v2.1 P1 §3.9: signature damage hook. Minimal P1
  // implementation — flat damage by boss role tier (12-28). Real telegraph
  // pacing + per-archetype patterns ship in P2/P4. Defensive try/catch so
  // damage helper failure never breaks the existing void-spawn flow above.
  try {
    if (typeof applyBossSignatureDamage === 'function') applyBossSignatureDamage();
  } catch (e) { console.warn('signature damage failed:', e); }
}

// Per-spec alias: `bossTurn` is the public API name; bossAttack is the legacy
// entry-point name. New shell call sites will use bossTurn; legacy retains
// bossAttack identifier (re-exported below for the wire-up phase).
export async function bossTurn() {
  await bossAttack();
}

// Per-spec alias: `playerTurn` is the orchestrator-side placeholder for the
// move-application path (placePiece + line-clear + per-hero fires). Legacy
// has no single `playerTurn` function — those concerns live in grid.js
// `place()` + `clearLines()` (T1.10.3) and heroes.js fire dispatch
// (T1.10.4). This wrapper exposes a stable name for the new shell to call;
// today it forwards to grid + heroes via /* global */ entry points. T1.12
// will rewire to explicit imports.
export function playerTurn() {
  // T1.12: replace with explicit placePiece + clearLines + fire dispatch
  // call sequence once the new shell owns the per-turn orchestration.
  // For T1.10.9 the legacy flow stays in place — this is the shape the
  // orchestrator API will eventually present.
}

// Per-spec alias: `tickBattle` — per-frame or per-action tick. Legacy uses
// implicit ticks (attackCountdown decrements per placement). Surface here
// for the new shell's call sites; today no-op. T1.12 wires the actual tick.
export function tickBattle() {
  // T1.12: pump grid / boss / stagger-loop / reactivity ticks once per
  // user action. For T1.10.9 the legacy implicit tick survives via the
  // existing maybeBossAttack hook (which lives in legacy / T1.10.7).
}

// Per-spec alias: `checkVictory` — predicate used by the orchestrator turn
// loop to short-circuit on bossHP <= 0. Legacy threads this through the
// dealDamage `if (bossHP <= 0)` branch directly. Surfaced here for the new
// shell's call sites.
export function checkVictory() {
  return typeof bossHP === 'number' && bossHP <= 0;
}

// Per-spec alias: `checkDefeat` — predicate used by the orchestrator turn
// loop to short-circuit on hp <= 0. Legacy threads this through the boss-
// attack damage flow inline. Surfaced here for the new shell's call sites.
export function checkDefeat() {
  return typeof hp === 'number' && hp <= 0;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// showVictoryModal — legacy lines 57950-58112 (VICTORY CHECK / MODAL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function showVictoryModal() {
  // V3.0 Phase 1 Block 1.3: Grunt is off-sequence (currentBossIdx=-1), so normal
  // "next boss" + chapter-cleared logic doesn't apply. Suppress next-boss preview,
  // use a tutorial-flavored sub-line instead of "CHAPTER N CLEARED".
  const isGrunt = !!(currentBoss && currentBoss._isFtueOnly);
  // 2026-04-28 — Stage 1 AAA+: Chronicle (training dummy) is a sub-class of
  // _isFtueOnly. Detect first so the cyan-themed "TRAINING COMPLETE" path
  // takes precedence over Grunt's gold "TUTORIAL COMPLETE" path.
  const isChronicle = !!(currentBoss && currentBoss._isTrainingDummy);
  const isLast = !isGrunt && (currentBossIdx === BOSSES.length - 1);
  const isAllChaptersDone = isLast && currentChapter === CHAPTERS.length;
  const elapsed = Math.floor((Date.now() - battleStartTime) / 1000);
  const mins = Math.floor(elapsed / 60), secs = elapsed % 60;
  const box = document.getElementById('modalBox');
  // Cyan accent for Chronicle reinforces the Codex visual identity (boss color
  // #5DCAFF, dialog glow, TRAINING COMPLETE banner — all tied together).
  box.style.setProperty('--modal-accent', isChronicle ? '#5DCAFF' : '#E8B84A');
  // Show defeated boss emblem
  const emblem = document.getElementById('modalBossEmblem');
  const emblemKey = `boss_emblem_${currentBossIdx + 1}`;
  if (emblem && !isGrunt && ASSETS[emblemKey]) {
    emblem.style.backgroundImage = `url(${ASSETS[emblemKey]})`;
    emblem.className = 'modal-boss-emblem victory visible';
  } else if (emblem) {
    // Block 1.3: hide emblem for Grunt + Chronicle (no chapter emblem for off-sequence FTUE bosses)
    emblem.className = 'modal-boss-emblem';
  }
  document.getElementById('modalTitle').textContent =
    isChronicle ? 'TRAINING COMPLETE'
    : isGrunt ? 'TUTORIAL COMPLETE'
    : isLast ? 'VICTORY'
    : 'BOSS DEFEATED';
  document.getElementById('modalTitle').style.color = isChronicle ? '#5DCAFF' : '#FFD53D';
  // Poetic secondary line per UI Spec Part 5.3 Session Milestones.
  // V3.0 Phase 2 Block 2.2: when the fight was a floor launch, prepend "FLOOR CLEARED: NAME"
  // using the floor color. Otherwise fall back to the existing poetic line.
  const labelEl = document.getElementById('modalLabel');
  if (_lastReward.floorName && !isGrunt) {
    labelEl.innerHTML = `<span style="color:${_lastReward.floorColor || '#FFD53D'};font-weight:800;letter-spacing:2.5px">FLOOR ${_lastReward.floorId} CLEARED · ${_lastReward.floorName}</span>`;
  } else {
    labelEl.textContent =
      isChronicle ? 'The Codex fades'
      : isGrunt ? 'The warband stands'
      : isLast ? 'The heroes rise'
      : 'The ancient falls';
  }
  const rewardEmblem = ASSETS['elem_' + currentBoss.stihiya];
  const rewardIcon = rewardEmblem
    ? `<img src="${rewardEmblem}" style="width:18px;height:18px;border-radius:4px;vertical-align:-4px;margin:0 4px"/>`
    : ESSENCE_EMOJI[currentBoss.stihiya];
  const multText = _lastReward.mult > 1
    ? ` <span style="color:#E85D4A;font-size:11px">(×${_lastReward.mult.toFixed(2)})</span>`
    : '';
  const unlockBanner = _lastReward.justUnlockedChapter3
    ? `<div style="margin-top:10px;padding:8px 12px;background:linear-gradient(90deg,rgba(125,236,143,0.2),rgba(232,184,74,0.2));border:1px solid rgba(125,236,143,0.5);border-radius:8px;color:#7DEC8F;font-weight:700;letter-spacing:1.5px;font-size:12px">★ CHAPTER 3 UNLOCKED ★</div>`
    : _lastReward.justUnlockedChapter2
    ? `<div style="margin-top:10px;padding:8px 12px;background:linear-gradient(90deg,rgba(255,213,61,0.2),rgba(232,93,74,0.2));border:1px solid rgba(255,213,61,0.5);border-radius:8px;color:#FFD53D;font-weight:700;letter-spacing:1.5px;font-size:12px">★ CHAPTER 2 UNLOCKED ★</div>`
    : '';
  // V18: artifact drop banner
  // V18.25: forced (pity) drops get a subtle "PITY" tag so player understands the system is fair
  // V18.26: use buildArtifactIcon so real images render instead of CSS placeholder
  // V3.0 Phase 2 Block 2.2: T2 upgrade (floor 3) gets a dedicated "T2 UPGRADE" badge with
  // warmer color so the player immediately sees the floor scaling paid off.
  const artDropBanner = _lastReward.artDrop
    ? `<div style="margin-top:10px;padding:10px 12px;background:linear-gradient(90deg,${_lastReward.artDrop.floorUpgrade ? 'rgba(255,77,31,0.18),rgba(255,213,61,0.18)' : 'rgba(140,59,255,0.15),rgba(255,213,61,0.15)'});border:1px solid ${_lastReward.artDrop.floorUpgrade ? '#FF4D1F' : 'rgba(255,213,61,0.4)'};border-radius:8px;display:flex;align-items:center;gap:10px">
         <div style="width:38px;height:38px;flex-shrink:0;border-radius:6px;overflow:hidden;background:#12121E">${buildArtifactIcon(_lastReward.artDrop.id, _lastReward.artDrop.tier)}</div>
         <div style="flex:1;text-align:left">
           <div style="font-size:9px;color:#A8A5B8;letter-spacing:1.5px">${_lastReward.artDrop.floorUpgrade ? '🌟 T2 UPGRADE' : '🎁 ARTIFACT DROPPED'}${_lastReward.artDrop.forced && !_lastReward.artDrop.floorUpgrade ? ' <span style="color:#7DEC8F">· BONUS</span>' : ''}</div>
           <div style="font-size:12px;font-weight:700;color:${_lastReward.artDrop.floorUpgrade ? '#FF4D1F' : '#FFD53D'};letter-spacing:1px">${artDisplayName(_lastReward.artDrop.id, _lastReward.artDrop.tier)}</div>
         </div>
       </div>`
    : '';
  // REW.1 — Star rating banner. Only shown for chapter-bosses where stars
  // were tracked (skipped for FTUE / Tower / no-table paths where firstClear
  // is undefined). Gold for 3⭐, silver for 2⭐, bronze for 1⭐.
  let starsBanner = '';
  if (typeof _lastReward.stars === 'number' && _lastReward.stars > 0) {
    const filled = '★'.repeat(_lastReward.stars);
    const empty  = '☆'.repeat(3 - _lastReward.stars);
    const starCol = _lastReward.stars >= 3 ? '#FFD53D' : (_lastReward.stars >= 2 ? '#C0C8D8' : '#B07840');
    const starLabel = _lastReward.stars >= 3 ? 'PERFECT CLEAR' : (_lastReward.stars >= 2 ? 'NICE CLEAR' : 'CLEARED');
    starsBanner =
      `<div style="margin-top:10px;padding:8px 12px;background:rgba(255,213,61,0.08);border:1px solid ${starCol}55;border-radius:8px;display:flex;justify-content:space-between;align-items:center">
         <span style="font-size:9px;color:#A8A5B8;letter-spacing:1.5px">${starLabel}</span>
         <span style="font-size:18px;color:${starCol};letter-spacing:3px;text-shadow:0 0 8px ${starCol}88">${filled}<span style="opacity:0.25">${empty}</span></span>
       </div>`;
  }
  // REW.3 — First-clear / replay differentiation chip (shown only when
  // _lastReward.firstClear is defined, i.e., chapter boss with reward table).
  let firstClearBanner = '';
  if (_lastReward.firstClear === true) {
    firstClearBanner =
      `<div style="margin-top:8px;padding:6px 12px;background:linear-gradient(90deg,rgba(125,236,143,0.18),rgba(255,213,61,0.18));border:1px solid rgba(125,236,143,0.55);border-radius:8px;color:#7DEC8F;font-weight:700;letter-spacing:2px;font-size:11px;text-align:center">✦ FIRST CLEAR · BIG REWARD ✦</div>`;
  } else if (_lastReward.firstClear === false) {
    firstClearBanner =
      `<div style="margin-top:8px;padding:5px 12px;background:rgba(168,165,184,0.10);border:1px solid rgba(168,165,184,0.30);border-radius:8px;color:#A8A5B8;font-weight:600;letter-spacing:1.5px;font-size:10px;text-align:center">REPLAY CLEAR</div>`;
  }
  // 2026-04-28 — De-dupe REWARD: previously this inline "REWARD: +N STIHIYA
  // ESSENCE" span rendered here AND `vDecorateVictoryModal()` injected a
  // styled v-reward-card right below — same data shown twice (see screenshot).
  // Drop the inline span; the Vivid card now carries the reward visually.
  // Variables `rewardEmblem`, `rewardIcon`, `multText` are still computed above
  // so existing call sites / future hooks won't break, but they're unused here.
  document.getElementById('modalStats').innerHTML =
    `Damage: <b>${damageDealt.toLocaleString('en-US')}</b> · Time: <b>${mins}:${String(secs).padStart(2,'0')}</b><br>` +
    `Placements: <b>${placementCount}</b> · Hero triggers: <b>${heroFireCount}</b>` +
    starsBanner +
    firstClearBanner +
    artDropBanner +
    unlockBanner;
  const nextBox = document.getElementById('modalNextBoss');
  if (isChronicle) {
    // 2026-04-28 — Stage 1 AAA+: Chronicle victory leaves Pyredrake unnamed —
    // the existing prologue dialog (next FTUE beat) introduces him. Generic
    // teaser keeps the Codex theme without spoiling the reveal.
    nextBox.innerHTML = `<div style="font-size:11px;color:#5DCAFF;letter-spacing:1.5px;margin:10px 0">PROLOGUE BEGINS</div>`;
    document.getElementById('modalBtn').textContent = 'CONTINUE';
    document.getElementById('modalBtn').className = 'btn';
  } else if (isGrunt) {
    // Block 1.3: Grunt victory — no chapter progression, no next boss.
    // Just a flavor caption; the outro dialog will play after modal dismisses.
    nextBox.innerHTML = `<div style="font-size:11px;color:#A8A5B8;letter-spacing:1.5px;margin:10px 0">PATH OPENED · ABYSSAL TYRANT AWAITS</div>`;
    document.getElementById('modalBtn').textContent = 'CONTINUE';
    document.getElementById('modalBtn').className = 'btn';
  } else if (isLast) {
    const msg = isAllChaptersDone
      ? 'ALL CHAPTERS CLEARED'
      : `CHAPTER ${currentChapter} CLEARED`;
    nextBox.innerHTML = `<div style="font-size:11px;color:#A8A5B8;letter-spacing:1.5px;margin:10px 0">${msg}</div>`;
    document.getElementById('modalBtn').textContent = 'TO MENU';
    document.getElementById('modalBtn').className = 'btn victory';
  } else {
    const next = BOSSES[currentBossIdx + 1];
    nextBox.innerHTML = `<div class="modal-next-boss">
      <img src="${ASSETS[next.img]}" alt="">
      <div class="next-info">
        <div class="next-label">NEXT BOSS</div>
        <div class="next-name" style="color:${next.color}">${next.name}</div>
        <div class="next-label" style="margin-top:3px">${next.title}</div>
      </div>
    </div>`;
    document.getElementById('modalBtn').textContent = 'CONTINUE';
    document.getElementById('modalBtn').className = 'btn';
  }
  // Inject "to menu" secondary button if not already present
  injectMenuButton();
  document.getElementById('modal').classList.add('active');
  // V3.0 Phase 5 Vivid: staggered rewards, confetti, damage counter animation.
  try { vDecorateVictoryModal(); } catch(e){ console.warn('vDecorateVictoryModal failed:', e); }
  // V3.0 Phase 9 Vivid: celebratory haptic.
  try { vHaptic('victory'); } catch(e){}
  // 2026-04-28 — Player Education Stage 14: one-time AD-systems explainer if
  // deadlock fired this battle. No-op otherwise.
  try { maybeShowAntiDeadlockEducation(); } catch(e){ console.warn('maybeShowAntiDeadlockEducation (victory) failed:', e); }
  // 2026-04-28 — Player Education Failure Recovery: victory clears the
  // per-boss defeat streak so the "STUCK?" modal won't fire again until the
  // player accumulates 3 fresh consecutive defeats on the same boss.
  try {
    if (currentBoss && currentBoss.name && !currentBoss._isFtueOnly && !currentBoss._isTowerBattle) {
      resetBossDefeatStreak(currentBoss.name);
    }
  } catch (e) { console.warn('resetBossDefeatStreak failed:', e); }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// showDefeatModal — legacy lines 58114-58178 (DEFEAT CHECK / MODAL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function showDefeatModal() {
  gameEnded = true;
  // 2026-05-03 — COMBAT v2.1 P8 PR #8.C §5.2: record loss + show recovery + maybe offer skip.
  // Idempotent per battle via boss._p8DefeatHandled sentinel. Defers to existing
  // SPRINT 3B retry pinch flow below — both can fire (P8.C is supportive narrative beat,
  // SPRINT 3B is mechanical pinch).
  try {
    if (typeof _phase8HandleBossDefeat === 'function' && typeof currentBoss !== 'undefined') {
      _phase8HandleBossDefeat(currentBoss);
    }
  } catch (e) { console.warn('[P8.C defeat hook] failed:', e); }
  // 2026-05-02 — SPRINT 3B B3 T2: increment consecutive-loss counter
  // (chapter mode only — Tower has its own retry economy + pinch). Schedule
  // pinch offer if this is the 2nd straight loss; fires AFTER defeat modal
  // settles + AFTER any Battle Retry path the existing maybeShowBattleRetry
  // hook chains. Counter resets on victory or quit-to-menu.
  try {
    const _isTower = (typeof currentBoss !== 'undefined' && currentBoss && currentBoss._isTowerBattle);
    if (!_isTower && typeof _incrementConsecutiveBattleLosses === 'function') {
      const lossCount = _incrementConsecutiveBattleLosses();
      if (lossCount >= 2) {
        // Defer so defeat modal renders first; player sees defeat → 2.5s
        // later sees the pinch. Quick enough to feel reactive, slow enough
        // to read the defeat stats.
        setTimeout(function () {
          try { if (typeof maybeShowConsecutiveLossPinch === 'function') maybeShowConsecutiveLossPinch(); } catch (e) {}
        }, 2500);
      }
    }
  } catch (e) { console.warn('B3 T2 trigger failed:', e); }
  // 2026-04-29 — Race-Pure: clear run flag on defeat so the next attempt
  // starts clean (player may retry from the modal).
  try { _currentRacePureRace = null; } catch (e) {}
  // 2026-04-27 — Audio A.2.7: defeat tone (per spec §4.1).
  // SFX descend first (~1.2s), then defeat.mp3 fades in for reflective music.
  try { if (typeof playDefeat === 'function') playDefeat(); } catch(e){}
  setTimeout(() => { try { if (typeof playContextMusic === 'function') playContextMusic('defeat'); } catch(e){} }, 1200);
  // V2.0 Stage 5 Block 5.1: award participation XP on LOSS (no ULT/kill-shot bonuses per cap logic)
  try { awardPostBattleXP(false); } catch (e) { console.warn('awardPostBattleXP (loss) failed:', e); }
  // Task #1.7: Floor 3 loss tracking for stihiya_focus paid-pack trigger removed
  // with Block 3.2 (PAID_PACKS + offers state).
  // PHASE 3 BLOCK 3 — DEATH FLASHBACK. Show event recap BEFORE the defeat modal.
  // Player taps CONTINUE in flashback → modal proceeds. Skipped for FTUE-only Pyredrake
  // and Tower battles (matches voice-line + signature-cinematic gating). Robust fallback:
  // if showDeathFlashback throws, modal still shows.
  // ECO.1 — Battle Retry sink hook. Wraps _showDefeatModalBody so the player
  // gets a "Continue from where you fell?" gold-pay offer BEFORE the defeat
  // modal lands. If shown and player declines (or pays — handled separately),
  // the underlying body still fires. Death Flashback still chains in front.
  const _proceedToModal = () => {
    try {
      if (typeof maybeShowBattleRetry === 'function' && maybeShowBattleRetry(_showDefeatModalBody)) {
        return;  // retry modal owns the flow now
      }
    } catch (e) { console.warn('maybeShowBattleRetry hook failed:', e); }
    _showDefeatModalBody();
  };
  const _isFtueOnly = (typeof currentBoss !== 'undefined' && currentBoss && currentBoss._isFtueOnly);
  const _isTower    = (typeof currentBoss !== 'undefined' && currentBoss && currentBoss._isTowerBattle);
  if (!_isFtueOnly && !_isTower && typeof showDeathFlashback === 'function') {
    try { showDeathFlashback(_proceedToModal); return; }
    catch (e) { console.warn('showDeathFlashback failed:', e); }
  }
  _proceedToModal();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// exitBattle — legacy lines 59405-59417 (BATTLE TEARDOWN / endBattle)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function exitBattle() {
  closeSettings();
  // Defer the confirm() so the slide-out animation has a frame to
  // play; on iOS Safari, native confirm() during a transition can
  // race the layout and feel jankier than waiting one tick.
  setTimeout(() => {
    if (!confirm('Exit battle? Progress will be lost.')) return;
    try {
      if (typeof returnToMenuFromBattle === 'function') returnToMenuFromBattle();
      else if (typeof goToMenu === 'function') goToMenu();
    } catch (e) { console.warn('exitBattle failed:', e); }
  }, 200);
}

// Per-spec alias: `endBattle(result)` is the orchestrator-side public API
// for battle teardown. Legacy splits this into showVictoryModal /
// showDefeatModal (which await onBossDefeated / _phase8HandleBossDefeat
// chains) + exitBattle (player quit). New shell call sites use endBattle;
// today this forwards based on the `result` arg.
export function endBattle(result) {
  if (result === 'victory') {
    showVictoryModal();
  } else if (result === 'defeat') {
    showDefeatModal();
  } else {
    // 'quit' or undefined — player-initiated exit.
    exitBattle();
  }
}

// frenzyHitThisTurn / batteryHitThisPlacement are legacy module-scope
// `let` writable globals consumed by archetype tick handlers (still in
// legacy). dealDamage sets them; the tick handlers read + reset. Declared
// here as eslint /* global :writable */ so the cross-module reference
// resolves; canonical ownership flips to battle.js once tick handlers
// land in a follow-up.
/* global frenzyHitThisTurn:writable, batteryHitThisPlacement:writable */

// Re-export legacy entry-point names for backward compatibility during
// the T1.10.9 → T1.12 transition. The new shell's wire-up may call
// either the spec-name (startBattle / bossTurn / endBattle) or the
// legacy-name (startBossBattle / bossAttack / exitBattle); both reach
// the same byte-perfect implementation.
//
// (Already exported above by `export function` — re-listed here as a
// readable surface for grep / IDE outline.)
//
//   export {
//     startBossBattle, startBattle,
//     bossAttack, bossTurn, playerTurn, tickBattle,
//     dealDamage,
//     getEffectiveBossStats, _phase8GetAdaptiveHpMultiplier,
//     startPyredrakeFtueBattle, startGruntFtueBattle,
//     startChronicleFtueBattle, finalizeFtue,
//     showVictoryModal, showDefeatModal, exitBattle, endBattle,
//     checkVictory, checkDefeat,
//   };

// Module side-effect: capture the logger surface for any future
// diagnostic hook (debug-only; no console.* in this file by policy).
// Today it's a typed reference so import-graph stays clean; T1.12 wires
// real log.* calls into the orchestrator boundaries.
const _log = log;
void _log;
