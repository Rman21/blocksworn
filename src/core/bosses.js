// 2026-05-11 — TASK-011 (T1.10.7): Boss identity, archetypes, state machine,
// and FTUE / Chapter-3 / UROBOROS sacred config relocated from legacy.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - BOSS_ARCHETYPES + Object.assign Ch3/4/5 merge   lines 20141-20198
//   - ARCHETYPE_MATCHUP + Object.assign Ch3/4/5 merge lines 20158-20215
//   - Berserker / Armored / Phoenix archetype consts  lines 20217-20225
//   - _currentBossRoleTier (writable)                 line  20230
//   - PHASE_GATE_P1_TO_P2 / P2_TO_P3 / DEATH          lines 20240-20243
//   - REACTIVITY_TELEGRAPH_MS / BANNER_DURATION_MS    lines 20245-20248
//   - computeBossHP helper                            lines 20276-20280
//   - getCurrentBossPhase helper                      lines 20282-20290
//   - BOSSES dynamic let + setChapter rebinding       lines 20442-20478
//     (BOSSES = CHAPTERS[idx].bosses; chapter unlock gates)
//   - applyBossEmblems CSS-variable writer            lines 20964-21007
//   - BOSS_VOICES + per-battle fire flags             lines 21774-21882
//     (BOSS_VOICES table, BOSS_VOICE_MIDFIGHT_HP_PCT,
//      _bossVoiceTrigger, maybeFireBossVoiceIntro /
//      maybeFireBossVoiceMidfight / maybeFireBossVoiceDeath,
//      resetBossVoiceFlags)
//   - currentChapter writable global                  line  38344
//   - currentBossIdx / bossHP / bossMaxHP             line  40216
//   - currentBoss let (writable, alongside battleStartTime — battleStartTime
//     stays in legacy, T1.10.9 will pair it with battle.js)  line  40218
//   - Ch3 archetype scaffolding state + helpers       lines 40788-41154
//     (_ch3BossId / _ch3State, _ch3PhaseFromHp,
//      initChapter3Boss / tickChapter3Boss,
//      _ch3HasDebuff / _ch3HasSeal / _ch3TwilightMult,
//      _stormBlizzardFreezes / _stormEarthquakeLocks Maps,
//      _stormApplyBlizzardFreeze / _stormApplyEarthquakeLock /
//      _stormApplyLightningRow,
//      _ch3LastDualState announcer flag,
//      _ch3RenderBossAura / _ch3MaybeAnnounceDualState)
//   - FTUE bosses EMBER_GRUNT / CHRONICLE             lines 25034-25148
//     (data + FTUE_GRUNT_VOID_SPAWN ember-grunt cap)
//   - FTUE_BOSS_GUARANTEES + FTUE_TUTORIAL_TEXTS      lines 47134-47235
//   - TOWER_UROBOROS_SEASONAL sacred config           lines 49101-49140
//
// SACRED PER CLAUDE.md §2.1 + §2.5:
//   - BOSS_TTK_TARGETS table (imported from src/data/bosses.js T1.07).
//   - TTK formula `boss_hp = expected_squad_dps × target_ttk_seconds`.
//   - FTUE_BOSS_GUARANTEES (per-Ch1-boss guarantee blocks — Player cannot
//     skip core mechanics; they're scripted into Ch1 progression).
//   - Uroboros seasonal boss (TOWER_UROBOROS_SEASONAL — 7-phase Tier-4
//     Mythic seasonal mythic, Floor 50, drops T3 stone + Mythic Pact +
//     25 Tower Hearts + unique cosmetic).
//
// SACRED ARCHETYPE FLATTENING:
//   The legacy file declares BOSS_ARCHETYPES + ARCHETYPE_MATCHUP at lines
//   20142 and 20159 with the Ch1+Ch2 archetypes inline, then mutates both
//   via two Object.assign calls (lines 20179, 20199) injecting the Ch3+Ch4+Ch5
//   archetypes from the v2.1 P6 Cosmic Ascension PR. T1.07 closeout flagged
//   this as a relocation-loss risk: pure data relocation would only carry
//   the Ch1/Ch2 keys, dropping the 14 Cosmic Ascension archetypes (Ch3:
//   soul_drinker / stormcaller / confession_reader / wither / sealer;
//   Ch4: phase_shifter / equalizer / regent / phase_reverser / royal_phase;
//   Ch5: eternal / inevitable / co_op / devourer / choice). This module
//   lands BOTH maps FLAT — the post-Object.assign final state, byte-perfect
//   in icon / label / hpMult / attackCD / dmgMult / special fields and
//   strong/weak stihiya arrays.
//
// OWNS (T1.10.7 territory):
//   - Boss archetype + matchup data (BOSS_ARCHETYPES, ARCHETYPE_MATCHUP,
//     archetype-specific tuning constants).
//   - Boss identity state vars (currentBoss, currentChapter, currentBossIdx,
//     bossHP, bossMaxHP, _currentBossRoleTier).
//   - Phase-gate ratio constants (PHASE_GATE_P1_TO_P2, P2_TO_P3, DEATH) +
//     telegraph timing constants (REACTIVITY_TELEGRAPH_MS, BANNER_DURATION).
//   - HP-formula helpers (computeBossHP, getCurrentBossPhase).
//   - Dynamic per-chapter roster (getBosses returns CHAPTERS[ch-1].bosses).
//   - applyBossEmblems CSS variable writer.
//   - BOSS_VOICES table + per-battle voice fire flags + four trigger
//     functions (_bossVoiceTrigger / maybeFireBossVoiceIntro /
//     maybeFireBossVoiceMidfight / maybeFireBossVoiceDeath /
//     resetBossVoiceFlags).
//   - Ch3 archetype scaffolding (_ch3State + 5 boss tick handlers +
//     storm-variant Maps + dual-state announcer + helpers consumed by
//     combat hooks: _ch3HasDebuff, _ch3HasSeal, _ch3TwilightMult).
//   - FTUE special bosses (EMBER_GRUNT, CHRONICLE) + tuning constant
//     (FTUE_GRUNT_VOID_SPAWN — 2-cell hard cap during grunt fight).
//   - FTUE_BOSS_GUARANTEES + FTUE_TUTORIAL_TEXTS sacred tables.
//   - TOWER_UROBOROS_SEASONAL sacred config.
//
// DOES NOT OWN (deferred to siblings):
//   - bossAttack() (legacy line 59033) — bossed in by Bulwark Frozen Ward,
//     stealth turns, training-dummy gates, RAIDERS dual synergy, glacier
//     ice armor, frenzy stacks, signature damage, FTUE grunt void cap —
//     all cross-module deep wiring. T1.10.9 (battle.js) territory.
//   - maybeBossAttack() (legacy 58936), applyBossSignatureDamage() (39075),
//     getEffectiveBossStats() (24161), startBossBattle() — battle loop.
//   - BOSS_PHASES (legacy 27361, mutated at line 30333 for VOIDFANG) +
//     REACTIVITY_HANDLERS (27676) + EFFECT_HANDLERS (27404) — v2.1 P4
//     reactivity (T1.10.8 territory).
//   - Tower roster pools (TOWER_ROSTER_TIER_1/2/3) + weekly rotation +
//     LIMITED_TIME_TOWER_EVENTS — Tower module (separate sprint). Only
//     UROBOROS extracted here per CLAUDE.md §2.5 sacred designation.
//   - Phase 5b Ch1/Ch2/Ch4/Ch5 archetype tick handlers (_tickPyredrake /
//     _tickAbyssalTyrant / _tickGrovewarden / _tickSolarPhoenix /
//     _tickCryptLich + Ch2 hypnotist/engineer/frenzy/tempo/battery +
//     Ch4 phase_shifter/equalizer/regent/phase_reverser/royal_phase +
//     Ch5 eternal/inevitable/co_op/devourer/choice) — these touch FX +
//     DOM render + cross-module state heavily; T1.10.9 territory.
//   - Phase 8 boss-loss recovery (_phase8GetAdaptiveHpMultiplier,
//     getEffectiveBossHP, recordBossLoss, recordBossWin) — touches
//     storage + adaptive difficulty, T1.10.9 territory.
//   - Phase 8 boss FTUE enforcement dispatcher (enforceBossFTUEGuarantees,
//     applyScriptedActions, _phase8RecordBossFtueEvent, _phase8ScriptedState)
//     — touches tutorial overlay + analytics; this module owns the
//     FTUE_BOSS_GUARANTEES DATA, not the dispatch/state-machine that
//     consumes it. T1.10.9 territory.
//   - getBossStars (19548) / getBossHeroReward (25474) — progression
//     reward path; lives in progression.js T1.10.2 follow-up.
//
// Window-exposure bridge:
//   Mirrors the T1.10.6 pattern — legacy bodies that read the bare
//   identifiers `currentBoss`, `bossHP`, `bossMaxHP`, `currentBossIdx`,
//   `currentChapter`, `_currentBossRoleTier`, `BOSSES`, `_ch3BossId`,
//   `_ch3State`, `BOSS_ARCHETYPES`, `ARCHETYPE_MATCHUP`, etc. continue
//   to work via window getters/setters (Object.defineProperty with
//   configurable: true). T1.10.9 wire-up will replace the bridge with
//   explicit imports.
//
// Storage migration: zero new bare-string localStorage keys. Boss-state
// vars (currentBoss / bossHP / bossMaxHP / currentBossIdx / Ch3 storm Maps
// / boss-voice fire flags) are per-battle ephemeral — initialized at
// battle start, garbage-collected at battle end. Phase 8 boss-loss
// counter persists via PHASE8_BOSS_LOSSES_KEY (legacy line 47482)
// which lives in legacy until T1.10.9.
//
// 2026-05-11 — Roman: pure-relocation discipline. No "improvements".
// Comments above this line replicate legacy intent.

/* eslint-disable no-empty, no-unused-vars */

// T1.13.1: /* global */ → ES imports for resolved src/ exports.
import { hasCompletedChapter, _isChapterContentUnlocked } from './progression.js';
import { logEvent } from '../services/analytics.js';
import { CHAPTERS } from '../data/chapters.js';
import {
  BOSS_TTK_TARGETS,
  EXPECTED_DPS_BY_CHAPTER,
  TOWER_DPS_REFERENCE,
  TOWER_BOSS_TTK_TARGETS,
} from '../data/bosses.js';
import { ASSETS } from '../data/assets.js';
import { playDialogScript } from '../ui/dialog.js';
import { log } from '../services/logger.js';

// T1.13.4: playDialogScript flipped from /* global */ to ES import (boss-voice firing).
// Residual legacy-owned tokens:
/* global flashText, flashStateBanner, vibrate, showThreatBanner, render,
   renderHP, renderBossHP */
/* global chapter2Unlocked, chapter3Unlocked, chapter4Unlocked,
   isContentUnlocked,
   closeFloorSelector */
/* global grid, SIZE, shieldCount:writable, hp:writable,
   battleDamageTaken:writable, gameEnded, showDefeatModal */
// LEGACY-ONLY: above tokens have no src/ export — shims retired in T1.14+ cleanup.

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BOSS ARCHETYPES (legacy lines 20141-20198)
// Ch1 + Ch2 declared inline; Ch3 + Ch4 + Ch5 merged via Object.assign per
// v2.1 P6 PR #6.A Cosmic Ascension. T1.10.7 lands the FLAT post-merge map
// — byte-perfect to legacy after both Object.assign calls run.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Each boss gets one archetype; drives HP/cooldown/dmg profile and signature ability.
export const BOSS_ARCHETYPES = Object.freeze({
  // ===== Chapter 1 archetypes (legacy 20142-20156) =====
  bruiser:   Object.freeze({ icon: '🪨', label: 'BRUISER',   hpMult: 1.5, attackCD: 8, dmgMult: 1.0, special: null }),
  assassin:  Object.freeze({ icon: '🗡', label: 'ASSASSIN',  hpMult: 0.7, attackCD: 4, dmgMult: 1.4, special: null }),
  berserker: Object.freeze({ icon: '⚡', label: 'BERSERKER', hpMult: 1.0, attackCD: 6, dmgMult: 1.0, special: 'enrage' }),
  armored:   Object.freeze({ icon: '🛡', label: 'ARMORED',   hpMult: 1.0, attackCD: 7, dmgMult: 0.7, special: 'shields' }),
  phoenix:   Object.freeze({ icon: '🔥', label: 'PHOENIX',   hpMult: 0.8, attackCD: 7, dmgMult: 1.0, special: 'revive' }),
  // ===== Chapter 2 archetypes (legacy 20152-20156, Phase 5b BLOCK 1) =====
  // CSS aura, state, init/tick/reset infrastructure per Boss Compendium §12.
  // HP/CD/dmgMult tuned per first-pass Compendium; balance pass on Phase 5b.9 sign-off.
  hypnotist:       Object.freeze({ icon: '🌸', label: 'HYPNOTIST',       hpMult: 1.6, attackCD: 6, dmgMult: 1.0, special: 'suggest' }),
  engineer:        Object.freeze({ icon: '⚙',  label: 'ENGINEER',        hpMult: 1.8, attackCD: 6, dmgMult: 1.1, special: 'lockdown' }),
  frenzy:          Object.freeze({ icon: '🐻', label: 'FRENZY',          hpMult: 1.4, attackCD: 5, dmgMult: 1.0, special: 'frenzyStacks' }),
  tempo_disruptor: Object.freeze({ icon: '❄',  label: 'TEMPO DISRUPTOR', hpMult: 1.5, attackCD: 5, dmgMult: 1.0, special: 'tempo' }),
  battery:         Object.freeze({ icon: '☀',  label: 'BATTERY',         hpMult: 1.6, attackCD: 5, dmgMult: 1.0, special: 'chargeMeter' }),
  // ===== Chapter 3 archetypes (legacy 20181-20185, Cosmic Ascension v2.1 P6) =====
  // P4 used phoenix/engineer/hypnotist/bruiser/assassin as placeholders. P6 swaps
  // proper soul_drinker/stormcaller/confession_reader/wither/sealer. Per spec §19.1
  // mitigation, MVP scaffolds per-turn tick state; full mechanical depth lands as
  // v2.2 polish PR. Player still sees archetype banner + matchup advice.
  soul_drinker:      Object.freeze({ icon: '👁',  label: 'SOUL DRINKER',      hpMult: 1.5, attackCD: 7, dmgMult: 1.0, special: 'dual_shift' }),
  stormcaller:       Object.freeze({ icon: '⛈',  label: 'STORMCALLER',       hpMult: 1.6, attackCD: 8, dmgMult: 0.9, special: 'storm_summon' }),
  confession_reader: Object.freeze({ icon: '📿', label: 'CONFESSION READER', hpMult: 1.5, attackCD: 6, dmgMult: 1.0, special: 'confession_debuff' }),
  wither:            Object.freeze({ icon: '🥀', label: 'WITHER',            hpMult: 1.7, attackCD: 6, dmgMult: 0.9, special: 'wither_cells' }),
  sealer:            Object.freeze({ icon: '📜', label: 'SEALER',            hpMult: 1.6, attackCD: 5, dmgMult: 1.1, special: 'librarian_seal' }),
  // ===== Chapter 4 archetypes (legacy 20187-20191, Court of the Fallen Heavens) =====
  phase_shifter:     Object.freeze({ icon: '🎭', label: 'PHASE SHIFTER',     hpMult: 1.8, attackCD: 6, dmgMult: 1.0, special: 'five_faces' }),
  equalizer:         Object.freeze({ icon: '⚖',  label: 'EQUALIZER',         hpMult: 1.7, attackCD: 6, dmgMult: 1.0, special: 'scales_balance' }),
  regent:            Object.freeze({ icon: '👑', label: 'REGENT',            hpMult: 1.9, attackCD: 7, dmgMult: 1.1, special: 'five_regents' }),
  phase_reverser:    Object.freeze({ icon: '☯',  label: 'PHASE REVERSER',    hpMult: 1.8, attackCD: 6, dmgMult: 1.0, special: 'dual_opposite' }),
  royal_phase:       Object.freeze({ icon: '🏛', label: 'ROYAL PHASE',       hpMult: 2.0, attackCD: 5, dmgMult: 1.2, special: 'six_successions' }),
  // ===== Chapter 5 archetypes (legacy 20193-20197, When the Crown Breaks) =====
  eternal:           Object.freeze({ icon: '🕯', label: 'ETERNAL',           hpMult: 2.0, attackCD: 5, dmgMult: 1.0, special: 'wax_timer' }),
  inevitable:        Object.freeze({ icon: '🌊', label: 'INEVITABLE',        hpMult: 2.1, attackCD: 6, dmgMult: 1.0, special: 'dream_pressure' }),
  co_op:             Object.freeze({ icon: '👥', label: 'CO-OP TWIN',        hpMult: 2.0, attackCD: 5, dmgMult: 1.1, special: 'strategic_restraint' }),
  devourer:          Object.freeze({ icon: '🕳', label: 'DEVOURER',          hpMult: 2.1, attackCD: 5, dmgMult: 1.0, special: 'resource_steal' }),
  choice:            Object.freeze({ icon: '🔥', label: 'CHOICE',            hpMult: 2.5, attackCD: 4, dmgMult: 1.2, special: 'seven_phases' }),
});

// Matchup chart — drives hint pill on menu. Each archetype lists 1-2 stihiyas
// strong/weak against it. Lands FLAT post-Object.assign per archetype map above.
export const ARCHETYPE_MATCHUP = Object.freeze({
  // ===== Chapter 1 matchups (legacy 20160-20164) =====
  bruiser:   Object.freeze({ strong: Object.freeze(['ember']), weak: Object.freeze(['tide'])  }),
  assassin:  Object.freeze({ strong: Object.freeze(['tide']),  weak: Object.freeze(['umbra']) }),
  berserker: Object.freeze({ strong: Object.freeze(['grove']), weak: Object.freeze(['solar']) }),
  armored:   Object.freeze({ strong: Object.freeze(['solar']), weak: Object.freeze(['grove']) }),
  phoenix:   Object.freeze({ strong: Object.freeze(['umbra']), weak: Object.freeze(['ember']) }),
  // ===== Chapter 2 matchups (legacy 20166-20170, Boss Compendium strategy notes) =====
  hypnotist:       Object.freeze({ strong: Object.freeze(['solar']), weak: Object.freeze(['umbra']) }),
  engineer:        Object.freeze({ strong: Object.freeze(['grove']), weak: Object.freeze(['ember']) }),
  frenzy:          Object.freeze({ strong: Object.freeze(['ember']), weak: Object.freeze(['tide'])  }),
  tempo_disruptor: Object.freeze({ strong: Object.freeze(['tide']),  weak: Object.freeze(['solar']) }),
  battery:         Object.freeze({ strong: Object.freeze(['solar']), weak: Object.freeze(['grove']) }),
  // ===== Chapter 3 matchups (legacy 20200-20204) =====
  soul_drinker:      Object.freeze({ strong: Object.freeze(['solar', 'umbra']), weak: Object.freeze(['ember']) }),
  stormcaller:       Object.freeze({ strong: Object.freeze(['tide', 'grove']),  weak: Object.freeze(['ember']) }),
  confession_reader: Object.freeze({ strong: Object.freeze(['umbra', 'solar']), weak: Object.freeze(['grove']) }),
  wither:            Object.freeze({ strong: Object.freeze(['grove', 'umbra']), weak: Object.freeze(['solar']) }),
  sealer:            Object.freeze({ strong: Object.freeze(['solar', 'grove']), weak: Object.freeze(['tide'])  }),
  // ===== Chapter 4 matchups (legacy 20205-20209) =====
  phase_shifter:     Object.freeze({ strong: Object.freeze(['umbra']),          weak: Object.freeze(['solar']) }),
  equalizer:         Object.freeze({ strong: Object.freeze(['solar']),          weak: Object.freeze(['umbra']) }),
  regent:            Object.freeze({ strong: Object.freeze(['ember', 'solar']), weak: Object.freeze(['tide'])  }),
  phase_reverser:    Object.freeze({ strong: Object.freeze(['tide', 'ember']),  weak: Object.freeze(['umbra']) }),
  royal_phase:       Object.freeze({ strong: Object.freeze([]),                 weak: Object.freeze([])        }),
  // ===== Chapter 5 matchups (legacy 20210-20214) =====
  eternal:           Object.freeze({ strong: Object.freeze(['ember']),          weak: Object.freeze(['tide'])  }),
  inevitable:        Object.freeze({ strong: Object.freeze(['tide']),           weak: Object.freeze(['solar']) }),
  co_op:             Object.freeze({ strong: Object.freeze(['ember', 'grove']), weak: Object.freeze(['umbra']) }),
  devourer:          Object.freeze({ strong: Object.freeze(['umbra']),          weak: Object.freeze(['solar']) }),
  choice:            Object.freeze({ strong: Object.freeze([]),                 weak: Object.freeze([])        }),
});

// Berserker enrage threshold + multiplier (legacy 20218-20219).
export const BERSERKER_ENRAGE_HP_PCT = 0.5;   // enrage fires when bossHP ≤ maxHP × this
export const BERSERKER_ENRAGE_MULT   = 2.0;   // attack damage multiplier after enrage
// Armored shields — N hits absorb 70% each (legacy 20221-20222).
export const ARMORED_SHIELD_COUNT  = 2;
export const ARMORED_SHIELD_ABSORB = 0.3;     // incoming dmg multiplier while shield breaks (70% absorbed)
// Phoenix revive (legacy 20224-20225).
export const PHOENIX_REVIVE_HP_PCT = 0.6;
export const PHOENIX_IMMUNE_TURNS  = 2;       // turns after revive where motifs don't apply

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHASE GATES + TELEGRAPH (legacy 20232-20303, COMBAT v2.1 P4 PR #4.A)
// TTK formula values + standardized 70% / 35% gates + 3000ms telegraph.
// Sacred per CLAUDE.md §2.1 (TTK formula) + §2.5 (Reactivity Events).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 2026-05-02 — COMBAT v2.1 P4 §2: standardized phase gates.
export const PHASE_GATE_P1_TO_P2 = 0.70;   // P1 → P2 transition (boss adapts)
export const PHASE_GATE_P2_TO_P3 = 0.35;   // P2 → P3 transition (boss adapts harder)
export const PHASE_GATE_DEATH    = 0.00;

// 2026-05-02 — COMBAT v2.1 P4 §2: telegraph timing. UX commitment per §13.3 —
// 3-second wind-up, ±200ms variance acceptable on slower devices.
export const REACTIVITY_TELEGRAPH_MS       = 3000;
export const REACTIVITY_BANNER_DURATION_MS = 1500;

// 2026-05-02 — COMBAT v2.1 P4 §2.1: HP formula helper.
// Used by audit + future recalibration. CHAPTERS array is hand-populated
// with the formula's output (per §2.2 table) so static analysis can verify.
export function computeBossHP(roleTier, chapter) {
  const ttk = BOSS_TTK_TARGETS[roleTier] || BOSS_TTK_TARGETS.gatekeeper;
  const dps = EXPECTED_DPS_BY_CHAPTER[chapter] || 100;
  return Math.round(ttk * dps);
}

// 2026-05-02 — COMBAT v2.1 P4 §3.2: phase identifier for current boss.
// Used by reactivity dispatcher + UI phase indicator chip.
export function getCurrentBossPhase() {
  if (typeof bossHP !== 'number' || typeof bossMaxHP !== 'number' || bossMaxHP <= 0) return 'p1';
  const ratio = bossHP / bossMaxHP;
  if (ratio > PHASE_GATE_P1_TO_P2) return 'p1';
  if (ratio > PHASE_GATE_P2_TO_P3) return 'p2';
  return 'p3';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BOSS STATE MACHINE (legacy 20445, 38344, 40216-40218)
// currentBoss / currentChapter / currentBossIdx / bossHP / bossMaxHP +
// dynamic BOSSES (=CHAPTERS[idx].bosses) + setChapter rebinding helper.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Module-private mutable state. Window-exposure bridge at the foot of this
// file mirrors the writable surface so legacy bare-identifier reads/writes
// route through the same instance.
let currentChapter        = 1;
let currentBossIdx        = 0;
let currentBoss           = null;
let bossHP                = 0;
let bossMaxHP             = 0;
// 2026-05-02 — COMBAT v2.1 P4 §5.5: current battle's boss role tier.
// Set in startBossBattle from currentBoss.roleTier. Drives Phase 1
// CHANNEL_SIGNATURE_DMG lookup + UI TTK forecast + intel overlay.
let _currentBossRoleTier  = 'gatekeeper';

// State accessors — exported so other modules can read without touching
// module-locals. Mirror the T1.10.6 pattern.
export function getCurrentBoss()          { return currentBoss; }
export function setCurrentBoss(b)         { currentBoss = b; }
export function getCurrentChapter()       { return currentChapter; }
export function setCurrentChapterValue(n) { currentChapter = n; }
export function getCurrentBossIdx()       { return currentBossIdx; }
export function setCurrentBossIdx(i)      { currentBossIdx = i; }
export function getBossHP()               { return bossHP; }
export function setBossHP(v)              { bossHP = v; }
export function getBossMaxHP()            { return bossMaxHP; }
export function setBossMaxHP(v)           { bossMaxHP = v; }
export function getCurrentBossRoleTier()  { return _currentBossRoleTier; }
export function setCurrentBossRoleTier(t) { _currentBossRoleTier = t; }

// 2026-04-27 HOTFIX — BOSSES is a dynamic per-chapter reference (legacy
// line 20445 `let BOSSES = CHAPTERS[0].bosses;`). Most legacy code (BOSSES.length,
// BOSSES[idx], etc.) keeps working unchanged via the window bridge.
// setChapter(n) rebinds it when the player switches chapters.
export function getBosses() {
  const idx = Math.max(0, Math.min(CHAPTERS.length - 1, currentChapter - 1));
  return CHAPTERS[idx].bosses;
}

// 2026-04-27 HOTFIX — restore proper chapter binding. The previous clamp
// (Task #1.5 "Chapters 2/3 removed") was Phase 1 tech debt that was never
// reverted after Phase 5b shipped Chapter 2. Result: even after Crypt Lich
// unlocked Chapter 2 + cinematic played, switchChapter(2) silently rebinds
// back to Chapter 1. Now setChapter(n) honors n with bounds + unlock guards.
//
// 2026-05-01 — SPRINT 3A: Ch4 gate switched from CONTENT.2 day-window
// (_isChapterContentUnlocked(4)) to chapter4Unlocked flag (set on
// ARCHIVAL ETERNAL Boss 15 defeat). Mirrors chapter2/3 unlock pattern.
// Ch5 keeps CONTENT.2 day-window gate (placeholder chapter, no boss-defeat
// unlock yet — separate sprint will swap when Ch5 ships v1).
export function setChapter(n) {
  // V3.0 Phase 2 Block 2.1 trap 3: if floor selector is open for a boss in the
  // old chapter, close it before switching — data underneath changes meaning.
  try { if (typeof closeFloorSelector === 'function') closeFloorSelector(); } catch (e) {}
  const requestedIdx = Math.max(1, Math.min(CHAPTERS.length, Number(n) || 1)) - 1;
  // Bounds + unlock guards: never bind to a locked chapter even if caller asks.
  let idx = 0;
  if (requestedIdx === 0) {
    idx = 0;
  } else if (requestedIdx === 1 && (typeof chapter2Unlocked === 'undefined' || chapter2Unlocked)) {
    idx = 1;
  } else if (requestedIdx === 2 && (typeof chapter3Unlocked === 'undefined' || chapter3Unlocked)) {
    idx = 2;
  } else if (requestedIdx === 3 && (typeof chapter4Unlocked !== 'undefined' && chapter4Unlocked)) {
    idx = 3;
  } else if (requestedIdx === 4
             && typeof _isChapterContentUnlocked === 'function'
             && _isChapterContentUnlocked(5)) {
    idx = 4;
  }
  currentChapter = idx + 1;
  // BOSSES rebinds automatically via getBosses() — no separate let. The
  // window-bridge getter at the foot of this module reads CHAPTERS[idx].bosses
  // on every access.
  try { applyBossEmblems(); } catch (e) {}
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// APPLY BOSS EMBLEMS (legacy 20964-21007)
// V18.2: apply universal per-stihiya emblems to grid/tray cell backgrounds.
// Sets CSS custom properties on #screenBattle so both grid cells and tray
// pieces inherit them. Emblems are race/element-based, not per-specific-boss
// — one emblem per stihiya covers both chapters uniformly.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function applyBossEmblems() {
  const host = document.getElementById('screenBattle');
  if (!host) return;
  // PHASE 5b POLISH — boss-specific emblem on void cells. Each of 10 bosses has
  // a unique commissioned emblem (boss_emblem_1..10 in ASSETS). Override the
  // element-default void emblem for the current boss's stihiya so void cells
  // spawned by THIS boss show ITS emblem (dragon for Pyredrake, dark plant
  // for Verothira, etc). Other element-cells (non-current-boss-stihiya) keep
  // the universal element emblem fallback.
  const globalBossNum = (currentChapter - 1) * 5 + currentBossIdx + 1;
  // 2026-04-27 — Block T.8: in tower battles, prefer the tower boss's
  // dedicated emblem over the chapter emblem. Tower boss objects carry an
  // `emblem` field (e.g. 'tower_emblem_1') resolved via ASSETS lookup.
  let bossEmblemUrl = (typeof ASSETS !== 'undefined') ? ASSETS[`boss_emblem_${globalBossNum}`] : undefined;
  const isTowerBattleNow = (typeof currentBoss !== 'undefined' && currentBoss && currentBoss._isTowerBattle);
  if (isTowerBattleNow && currentBoss.emblem && typeof ASSETS !== 'undefined' && ASSETS[currentBoss.emblem]) {
    bossEmblemUrl = ASSETS[currentBoss.emblem];
  }
  const bossStihiya = (currentBoss && currentBoss.stihiya) || null;
  ['ember', 'tide', 'grove', 'solar', 'umbra'].forEach(stihiya => {
    const emblemUrl = (typeof ASSETS !== 'undefined') ? ASSETS[`stihiya_emblem_${stihiya}`] : undefined;
    if (emblemUrl) {
      host.style.setProperty(`--emblem-${stihiya}`, `url("${emblemUrl}")`);
    }
    // Void-cell emblem rules:
    //   Chapter battle: boss emblem overrides default ONLY for the boss's
    //                   own stihiya (other stihiyas keep generic element
    //                   emblem so squad-spawned voids still look elemental).
    //   Tower battle:   boss emblem overrides default for ALL 5 stihiyas.
    //                   Per Roman 2026-04-27 — every Tower boss gets its
    //                   emblem branded onto every void cell in the fight,
    //                   so identity is undeniable regardless of which
    //                   element the boss happens to spawn.
    let voidEmblemUrl = (typeof ASSETS !== 'undefined') ? ASSETS[`void_emblem_${stihiya}`] : undefined;
    if (isTowerBattleNow && bossEmblemUrl) {
      voidEmblemUrl = bossEmblemUrl;  // tower → all stihiyas use boss emblem
    } else if (stihiya === bossStihiya && bossEmblemUrl) {
      voidEmblemUrl = bossEmblemUrl;  // chapter → only boss's stihiya
    }
    if (voidEmblemUrl) {
      host.style.setProperty(`--void-emblem-${stihiya}`, `url("${voidEmblemUrl}")`);
    }
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BOSS VOICES (legacy 21774-21882, Block B3 + Phase 5b BLOCK 2)
// 5 + 5 bosses × 3 lines each (intro / midfight / death). Routed through
// playDialogScript (single-slot pending queue) so back-to-back triggers
// serialize cleanly. Sacred per CLAUDE.md §2.3 (Boss names + element
// subtitles are narrative voice — DO NOT modify strings).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const BOSS_VOICES = Object.freeze({
  PYREDRAKE: Object.freeze({
    intro:    'The cinder that refuses to die... STILL BURNS.',
    midfight: 'Your flames are kindling to mine.',
    death:    'I... will return... in ash...',
  }),
  'ABYSSAL TYRANT': Object.freeze({
    intro:    'You disturb the depths. The depths answer.',
    midfight: 'Tide does not retreat. Tide consumes.',
    death:    '...the deep... remembers...',
  }),
  GROVEWARDEN: Object.freeze({
    intro:    'The forest watches. The forest judges.',
    midfight: 'You are temporary. We are root and bough.',
    death:    '...new growth... from old wounds...',
  }),
  'SOLAR PHOENIX': Object.freeze({
    intro:    'I have died. I have risen. WATCH ME RISE AGAIN.',
    midfight: 'Each death is rehearsal. I AM ETERNAL.',
    death:    'Not... yet... not... yet...',
  }),
  'CRYPT LICH': Object.freeze({
    intro:    'Mortals. Such... persistent... noise.',
    midfight: 'Your defiance amuses me. Briefly.',
    death:    'Death... is... a... door...',
  }),
  // PHASE 5b BLOCK 2 — Chapter 2 voice lines per Boss Compendium §6-10.
  // Tone notes: Verothira overlapping plural voices; Gearheart mechanical fragments;
  // Ursaro animalistic growls; Tidespire drowning chorus; Heliotron formal sovereign.
  VEROTHIRA: Object.freeze({
    intro:    'Welcome, little spark. We have... so many gifts... for you.',
    midfight: 'Your heart races. Such... wonderful... rhythm. Give me more.',
    death:    '...we... we were... so... close...',
  }),
  GEARHEART: Object.freeze({
    intro:    'DIRECTIVE... ACTIVE. INTRUDER... DETECTED. INITIATING... PROTOCOL: ELIMINATE.',
    midfight: 'FUEL... LOW. CONSUMING... AVAILABLE... RESOURCES.',
    death:    'DIRECTIVE... FAILED. SHUTTING... DOWN... ALL... SYSTEMS...',
  }),
  URSARO: Object.freeze({
    intro:    'Hungry... hungry... hungry...',
    midfight: 'You wound. I HUNGER. Wound MORE.',
    death:    '...always... hungry... forever...',
  }),
  TIDESPIRE: Object.freeze({
    intro:    'One drop... then ten thousand... we are... ONE.',
    midfight: 'Resist. We have heard ten thousand resist. Each fell to the same... ...QUIET.',
    death:    '...soft... soft... silent... ...silent...',
  }),
  HELIOTRON: Object.freeze({
    intro:    "I am the sun's last echo. Step into my light, and prove worthy.",
    midfight: 'This is what your ancestors built. To outlast you. To remind you what was lost.',
    death:    'I... served... well...',
  }),
});

// Per-battle flags so each voice line fires at most once.
let _bossVoiceIntroFired    = false;
let _bossVoiceMidfightFired = false;
let _bossVoiceDeathFired    = false;
export const BOSS_VOICE_MIDFIGHT_HP_PCT = 0.5;

function _bossVoiceTrigger(slot) {
  if (typeof currentBoss === 'undefined' || !currentBoss || !currentBoss.name) return;
  const lines = BOSS_VOICES[currentBoss.name];
  if (!lines || !lines[slot]) return;
  if (typeof playDialogScript !== 'function') return;
  // Mode B (boss dialog) — explicit speaker + color + portraitKey. portraitKey is
  // REQUIRED — without it the dialog renderer ([dialog speaker block ~9612]) sets
  // portraitEl.src='' and the browser shows a broken-image icon (HOTFIX B3.1 BUG #1).
  // currentBoss.img is already 'Boss_1'..'Boss_5' which match the inline data-URI
  // entries in ASSETS at line ~8165.
  const script = [{
    speaker: currentBoss.name,
    speakerColor: currentBoss.color || '#FFD53D',
    portraitKey: currentBoss.img,
    text: lines[slot],
  }];
  try { playDialogScript(script, null); } catch (e) { log.warn('boss voice fire failed:', e); }
}

export function maybeFireBossVoiceIntro() {
  if (_bossVoiceIntroFired) return;
  _bossVoiceIntroFired = true;
  // 1.5s after battle start so squad-pop animation completes.
  setTimeout(() => _bossVoiceTrigger('intro'), 1500);
}

export function maybeFireBossVoiceMidfight() {
  if (_bossVoiceMidfightFired) return;
  if (typeof bossHP !== 'number' || typeof bossMaxHP !== 'number') return;
  if (bossMaxHP <= 0) return;
  if (bossHP / bossMaxHP > BOSS_VOICE_MIDFIGHT_HP_PCT) return;
  _bossVoiceMidfightFired = true;
  _bossVoiceTrigger('midfight');
}

export function maybeFireBossVoiceDeath() {
  if (_bossVoiceDeathFired) return;
  _bossVoiceDeathFired = true;
  _bossVoiceTrigger('death');
}

export function resetBossVoiceFlags() {
  _bossVoiceIntroFired    = false;
  _bossVoiceMidfightFired = false;
  _bossVoiceDeathFired    = false;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FTUE SPECIAL BOSSES (legacy 25034-25148, Block 1.3 + Stage 1)
// EMBER_GRUNT (Pyredrake-FTUE follow-up) + CHRONICLE (training dummy).
// Both carry `_isFtueOnly: true` so startBossBattle preserves them
// against the standard currentBoss reassignment from BOSSES[idx].
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// FTUE boss — appears only in `grunt_fight` beat. NOT in BOSSES (NOT
// appended to CHAPTERS) — so it never appears in chapter selection,
// progression UI, or bossesDefeated tracking. On defeat: 75 gold + 3 hero
// cards drop (T1.14 replacement for legacy ORC CLEAVER T1 artifact), then
// 'grunt_outro' dialog, then finalize FTUE.
export const EMBER_GRUNT = Object.freeze({
  // id field is internal to FTUE code — BOSSES in CHAPTERS don't have ids, so
  // grunt detection uses the _isFtueOnly flag below, not id comparison
  id: 'ember_grunt',
  name: 'EMBER GRUNT',
  title: 'FTUE · Scorched Remnant',
  hp: 1200,
  attackInterval: 10,
  img: 'Boss_1',       // reuse Pyredrake art — separate art is post-MVP
  color: '#FF7340',
  stihiya: 'ember',
  revives: 0,
  _isFtueOnly: true,   // gate flag — read by startBossBattle + void-spawn override
});

// Hard void-spawn cap during Grunt battle — ignores ALL modifiers (base ×dmgMult,
// rage, ember pressure, grove defense, glacier armor). Rationale: tutorial needs
// predictable pacing; we can't risk a borderline gridFillRatio pushing spawn
// count above 2 mid-tutorial. Applied in bossAttack() after all logic runs.
export const FTUE_GRUNT_VOID_SPAWN = 2;

// 2026-04-28 — Player Education Stage 1 part 1 (BLOCKSWORN_PLAYER_EDUCATION.md §4.4):
// Tutorial Dummy. Unlike Grunt, this is a training construct, not a foe — the
// `_isTrainingDummy` flag short-circuits bossAttack() so HP-loss is impossible.
// Player learns mechanics without pressure (cannot fail this fight).
//
// Visual identity: chibi sci-fi mage with hovering data holograms (Chronicle.png
// asset). Lore-flavored as a sentient codex teaching newcomers, distinct from
// Pyredrake's threatening "first boss" framing.
//
// HP 500 = ~60-90 second TTK at FTUE squad damage profile (per spec §4.4 target).
// stihiya: ember keeps the squad's element gating consistent with the pre-set
// 3-pirate roster (Thorgar / Blacktooth / Crimson). Archetype 'bruiser' is the
// most passive (no enrage / no shields / no revive) — visual flourish only since
// _isTrainingDummy suppresses attacks anyway.
export const CHRONICLE = Object.freeze({
  id: 'chronicle',
  name: 'CHRONICLE',
  title: 'Tutorial · Living Codex',
  hp: 500,
  attackInterval: 99999,    // belt-and-braces — _isTrainingDummy gate is the real guard
  img: 'Boss_Chronicle',
  color: '#5DCAFF',         // cyan to match the holographic aesthetic
  stihiya: 'ember',
  archetype: 'bruiser',
  revives: 0,
  _isFtueOnly: true,        // existing gates (preserve-boss, voice-line, signature) skip dummy
  _isTrainingDummy: true,   // new: bossAttack early-returns; no SFX/spawn/rage
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHAPTER 3 ARCHETYPE SCAFFOLDING (legacy 40788-41154)
// Block 6.5 + Cosmic Ascension P6 — Ch3 dual-element bosses. 5 archetype
// scaffolds: TWILIGHT VESSEL / STORMSHEPHERD / VOIDPRIESTESS /
// ROOT-OF-NOTHING / ARCHIVAL ETERNAL. State + per-tick update + hook reads.
// Simplified MVP per spec §2.2-2.6 (full mechanical depth = v2.2 polish).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// T1.13.2: Ch3 state (_ch3BossId / _ch3State / _ch3LastDualState) +
// initChapter3Boss / tickChapter3Boss / _ch3HasDebuff / _ch3HasSeal /
// _ch3TwilightMult / _ch3RenderBossAura / _ch3MaybeAnnounceDualState /
// _ch3PhaseFromHp are CANONICAL in src/ui/archetype-ticks.js (which owns the
// Ch3 archetype tick handler). Storm helpers
// (_stormApplyBlizzardFreeze / _stormApplyEarthquakeLock /
// _stormApplyLightningRow) moved there as well to retire the
// battle-screen.js ↔ archetype-ticks.js circular import from T1.11.1.
// bosses.js retains only the two shared `_stormBlizzardFreezes` /
// `_stormEarthquakeLocks` Maps below — both are still consumed by
// archetype-ticks.js (Storm tick), battle-screen.js (cell render), and
// grid.js (canPlace gates).

// 2026-04-30 — Stormshepherd variant side-effects.
//   Blizzard freezes 1-2 adjacent empty cells for 2T (canPlace refuses).
//   Earthquake locks 1 random board cell immovable for 3T (same gate).
//   Lightning has no persistent state — it's a row strobe + extra tick
//   applied once at intensify time. These Maps key on "r_c" so the
//   render loop can paint .storm-frozen / .storm-immovable on the
//   right cells; canPlace consults both Maps to refuse placement.
export const _stormBlizzardFreezes = new Map();   // key → turnsLeft (default 2)
export const _stormEarthquakeLocks = new Map();   // key → turnsLeft (default 3)


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FTUE BOSS GUARANTEES (legacy 47134-47235, COMBAT v2.1 P8 PR #8.B)
// SACRED per CLAUDE.md §2.5. Per-boss FTUE guarantees ensure player
// cannot skip core mechanics — they're scripted into Ch1 progression.
// 5 Ch1 bosses × ~3 mechanic guarantees each + scripted actions +
// failsafe assistance. Owned here as DATA; the dispatcher path
// (enforceBossFTUEGuarantees / applyScriptedActions) stays in legacy
// until T1.10.9 — those touch tutorial overlay + analytics heavily.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 2026-05-03 — COMBAT v2.1 P8 §4.1: per-boss FTUE guarantees.
// Each Ch1 boss guarantees specific mechanic introductions deterministically.
export const FTUE_BOSS_GUARANTEES = Object.freeze({
  PYREDRAKE: Object.freeze({
    bossNum:      1,
    role:         'tutorial',
    hpModifier:   1.0,    // standard P4 HP (7200)
    guarantees:   Object.freeze([
      Object.freeze({ id: 'placement',     trigger: 'first_placement',    timing: 'minute_1' }),
      Object.freeze({ id: 'line_clear',    trigger: 'first_line_clear',   timing: 'minute_2' }),
      Object.freeze({ id: 'boss_exists',   trigger: 'battle_start',       timing: 'minute_0' }),
      Object.freeze({ id: 'boss_attack',   trigger: 'first_boss_attack',  timing: 'minute_3' }),
      Object.freeze({ id: 'hero_ult',      trigger: 'first_ult_charged',  timing: 'minute_4' }),
    ]),
    scriptedActions: Object.freeze({
      force_first_piece_single_cell:  true,
      guide_first_line_clear:         true,
      pulse_first_ult_button:         true,
    }),
    failsafeAssistance: Object.freeze({
      after_3_failed_lines:        'show_helpful_dialog',
      after_5_failed_ult_attempts: 'auto_charge_first_ult',
    }),
  }),
  ABYSSAL_TYRANT: Object.freeze({
    bossNum:      2,
    role:         'gatekeeper',
    hpModifier:   1.0,    // 10800
    guarantees:   Object.freeze([
      Object.freeze({ id: 'mitigation',         trigger: 'first_boss_attack',         timing: 'minute_1' }),
      Object.freeze({ id: 'attack_countdown',   trigger: 'first_attack_countdown',    timing: 'minute_0.5' }),
      Object.freeze({ id: 'signature_damage',   trigger: 'first_signature_event',     timing: 'minute_5' }),
    ]),
    scriptedActions: Object.freeze({
      highlight_mitigation_indicator_on_first_attack:    true,
      flash_signature_warning_3_sec_before_signature:    true,
    }),
    failsafeAssistance: Object.freeze({}),
  }),
  GROVEWARDEN: Object.freeze({
    bossNum:      3,
    role:         'gatekeeper',
    hpModifier:   1.0,    // 10800
    guarantees:   Object.freeze([
      Object.freeze({ id: 'pressure_meter',    trigger: 'pressure_first_visible',  timing: 'minute_2' }),
      Object.freeze({ id: 'stagger_window',    trigger: 'first_stagger',           timing: 'minute_5' }),
    ]),
    scriptedActions: Object.freeze({
      guarantee_pressure_reaches_100_within_8_turns:  true,
      force_visual_pressure_pulse_at_50_percent:      true,
    }),
    failsafeAssistance: Object.freeze({}),
  }),
  'SOLAR PHOENIX': Object.freeze({
    bossNum:      4,
    role:         'mid_act',
    hpModifier:   1.0,    // 12600
    guarantees:   Object.freeze([
      Object.freeze({ id: 'phase_gate',        trigger: '70_percent_hp_reached',  timing: 'natural' }),
      Object.freeze({ id: 'reactivity_event',  trigger: 'reactivity_fires',       timing: 'natural' }),
    ]),
    scriptedActions: Object.freeze({
      guarantee_first_phase_within_8_turns:        true,
      extra_visual_emphasis_on_first_telegraph:    true,
    }),
    failsafeAssistance: Object.freeze({}),
  }),
  'CRYPT LICH': Object.freeze({
    bossNum:      5,
    role:         'act_boss',
    hpModifier:   1.0,    // 14400
    guarantees:   Object.freeze([
      Object.freeze({ id: 'chapter_pack_reward',     trigger: 'boss_defeat',                timing: 'on_victory' }),
      Object.freeze({ id: 'hero_card_economy',       trigger: 'pack_distribution_starts',   timing: 'on_victory' }),
      Object.freeze({ id: 'tier_ascension_preview',  trigger: 'pack_complete',              timing: 'on_victory' }),
    ]),
    scriptedActions: Object.freeze({
      enhanced_pack_cinematic_first_time:                  true,
      flash_hero_card_inventory_pulse_after_pack:          true,
    }),
    failsafeAssistance: Object.freeze({}),
  }),
});

// 2026-05-03 — COMBAT v2.1 P8 §4: tutorial dialog text per concept ID.
// Brief, narrative-leaning. Used by enforceBossFTUEGuarantees → showTutorialOverlay.
// Full Chronicler tonal rewrite happens in 8.E; these are functional first-pass.
export const FTUE_TUTORIAL_TEXTS = Object.freeze({
  placement:               'Drag a piece onto the board.',
  line_clear:              'Fill a row to clear the line. Cleared cells damage the boss.',
  boss_exists:             'Above you stands the boss. Defeat it to advance.',
  boss_attack:             'The boss attacks. Watch your HP.',
  hero_ult:                'A hero ULT is ready. Tap to fire.',
  mitigation:              'Mitigation reduces damage. Tank heroes increase your mitigation.',
  attack_countdown:        'Watch the countdown. When it hits zero — the boss strikes.',
  signature_damage:        'SIGNATURE DAMAGE — boss\'s defining attack. Stronger than basic strikes. Plan defense.',
  pressure_meter:          'PRESSURE builds with each line clear. Fill the meter to STAGGER the boss.',
  stagger_window:          'STAGGER. 4 turns. Your damage doubles. Strike NOW.',
  phase_gate:              'The boss adapts. Phase gate at 70% HP — prepare for new behavior.',
  reactivity_event:        'REACTIVITY — boss responds to your strategy. 3-second telegraph — read and adjust.',
  chapter_pack_reward:     'CHAPTER PACK awaits. A bundle of rewards for your achievement.',
  hero_card_economy:       'These are HERO CARDS. The currency of ascension. Collect to grow stronger.',
  tier_ascension_preview:  'Tier ascension previewed. With enough cards, your heroes evolve.',
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UROBOROS SEASONAL BOSS (legacy 49101-49140, COMBAT v2.1 P9 §2.5)
// SACRED per CLAUDE.md §2.5. Tier 4 Mythic Seasonal Boss (Floor 50).
// Available ONLY during active Tower seasons. Defeating grants
// 1× T3 stone + Mythic Pact + 25 Tower Hearts + unique cosmetic aura.
// 7 phases, mutating per-phase mechanics. The tower rotation logic
// (selectBossForTowerFloor / refreshTowerRosterIfNeeded / weekly mapping)
// stays in legacy / Tower module — only the sacred config lives here.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const TOWER_UROBOROS_SEASONAL = Object.freeze({
  id: 'tower_uroboros_seasonal',
  name: 'UROBOROS',
  title: 'Eternal Cycle',
  archetype: 'choice_seasonal',
  stihiya: 'all',
  baseHP: 120000,
  attackInterval: 4,
  color: '#FFD700',
  description: 'The serpent that eats its own tail. Available only during Tower seasons. Defeating grants T3 stone + Mythic Pact.',
  towerArchetypeConfig: Object.freeze({
    phases: 7,
    phase_thresholds: Object.freeze([1.0, 0.86, 0.71, 0.57, 0.43, 0.28, 0.14]),
    phase_mechanics: Object.freeze([
      'self_damage_doubles',
      'cycle_starts_over',
      'phase_skip_on_burst',
      'mythic_pact_drain',
      'all_dmg_modifiers_inverted',
      'resurrection_at_25_pct',
      'final_form',
    ]),
    seasonal_only: true,
    rewards_on_defeat: Object.freeze({
      t3_stones: 1,
      mythic_pact: 1,
      tower_hearts: 25,
      cosmetic: 'uroboros_serpent_aura',
    }),
  }),
  voiceLines: Object.freeze({
    intro:  'I am the snake that eats its own tail. You climb. I wait.',
    mid:    'Each cycle, you weaken. Or strengthen. Same. Different.',
    finale: 'End me. Restart. End me. Restart. ALL OF IT.',
    death:  '...the cycle... pauses... not breaks...',
  }),
  towerOnly: true,
  seasonalOnly: true,
  p9Tier: 4,
});

// Re-export TTK/DPS scaling constants from src/data/bosses.js so legacy
// callers reading bare identifiers `BOSS_TTK_TARGETS`, `EXPECTED_DPS_BY_CHAPTER`,
// `TOWER_DPS_REFERENCE`, `TOWER_BOSS_TTK_TARGETS` continue to resolve via
// the window-exposure bridge below. T1.07 already exposes them on window,
// but the bridge here is defensive for module-level re-bindings.
export { BOSS_TTK_TARGETS, EXPECTED_DPS_BY_CHAPTER, TOWER_DPS_REFERENCE, TOWER_BOSS_TTK_TARGETS };

// ─── Legacy interop (window exposure) ─────────────────────────────────────
// Legacy bodies still consult boss state + archetypes + voices + Ch3
// scaffolding + Uroboros via ambient identifiers. Mirror the
// window-exposure blocks so all consumer paths see the same module-private
// state + frozen tables. T1.10.9 wire-up will replace these with explicit
// imports.
if (typeof window !== 'undefined') {
  // ===== Archetype + matchup data =====
  window.BOSS_ARCHETYPES        = BOSS_ARCHETYPES;
  window.ARCHETYPE_MATCHUP      = ARCHETYPE_MATCHUP;
  window.BERSERKER_ENRAGE_HP_PCT = BERSERKER_ENRAGE_HP_PCT;
  window.BERSERKER_ENRAGE_MULT   = BERSERKER_ENRAGE_MULT;
  window.ARMORED_SHIELD_COUNT    = ARMORED_SHIELD_COUNT;
  window.ARMORED_SHIELD_ABSORB   = ARMORED_SHIELD_ABSORB;
  window.PHOENIX_REVIVE_HP_PCT   = PHOENIX_REVIVE_HP_PCT;
  window.PHOENIX_IMMUNE_TURNS    = PHOENIX_IMMUNE_TURNS;
  // ===== Phase gates + telegraph + HP formula =====
  window.PHASE_GATE_P1_TO_P2     = PHASE_GATE_P1_TO_P2;
  window.PHASE_GATE_P2_TO_P3     = PHASE_GATE_P2_TO_P3;
  window.PHASE_GATE_DEATH        = PHASE_GATE_DEATH;
  window.REACTIVITY_TELEGRAPH_MS = REACTIVITY_TELEGRAPH_MS;
  window.REACTIVITY_BANNER_DURATION_MS = REACTIVITY_BANNER_DURATION_MS;
  window.computeBossHP           = computeBossHP;
  window.getCurrentBossPhase     = getCurrentBossPhase;
  // ===== Boss identity state (getters + setters via Object.defineProperty) =====
  Object.defineProperty(window, 'currentBoss', {
    configurable: true,
    get: () => currentBoss,
    set: (v) => { currentBoss = v; },
  });
  Object.defineProperty(window, 'currentChapter', {
    configurable: true,
    get: () => currentChapter,
    set: (v) => { currentChapter = v; },
  });
  Object.defineProperty(window, 'currentBossIdx', {
    configurable: true,
    get: () => currentBossIdx,
    set: (v) => { currentBossIdx = v; },
  });
  Object.defineProperty(window, 'bossHP', {
    configurable: true,
    get: () => bossHP,
    set: (v) => { bossHP = v; },
  });
  Object.defineProperty(window, 'bossMaxHP', {
    configurable: true,
    get: () => bossMaxHP,
    set: (v) => { bossMaxHP = v; },
  });
  Object.defineProperty(window, '_currentBossRoleTier', {
    configurable: true,
    get: () => _currentBossRoleTier,
    set: (v) => { _currentBossRoleTier = v; },
  });
  // BOSSES dynamic getter — reads CHAPTERS[currentChapter-1].bosses on
  // every access. Legacy expects `BOSSES.length`, `BOSSES[idx]`, etc.
  Object.defineProperty(window, 'BOSSES', {
    configurable: true,
    get: getBosses,
  });
  window.setChapter             = setChapter;
  window.applyBossEmblems       = applyBossEmblems;
  // ===== Boss voices =====
  window.BOSS_VOICES                  = BOSS_VOICES;
  window.BOSS_VOICE_MIDFIGHT_HP_PCT   = BOSS_VOICE_MIDFIGHT_HP_PCT;
  window._bossVoiceTrigger            = _bossVoiceTrigger;
  window.maybeFireBossVoiceIntro      = maybeFireBossVoiceIntro;
  window.maybeFireBossVoiceMidfight   = maybeFireBossVoiceMidfight;
  window.maybeFireBossVoiceDeath      = maybeFireBossVoiceDeath;
  window.resetBossVoiceFlags          = resetBossVoiceFlags;
  // ===== FTUE bosses =====
  window.EMBER_GRUNT            = EMBER_GRUNT;
  window.CHRONICLE              = CHRONICLE;
  window.FTUE_GRUNT_VOID_SPAWN  = FTUE_GRUNT_VOID_SPAWN;
  // ===== Ch3 shared Maps (canonical owner: bosses.js — consumed by
  // archetype-ticks.js Storm tick, battle-screen.js cell render, grid.js
  // canPlace gates). The Ch3 state machine itself (_ch3BossId / _ch3State /
  // _ch3LastDualState) + the storm helpers + tickChapter3Boss family are
  // canonical in src/ui/archetype-ticks.js as of T1.13.2.
  window._stormBlizzardFreezes        = _stormBlizzardFreezes;
  window._stormEarthquakeLocks        = _stormEarthquakeLocks;
  // ===== FTUE_BOSS_GUARANTEES (sacred per CLAUDE.md §2.5) =====
  window.FTUE_BOSS_GUARANTEES   = FTUE_BOSS_GUARANTEES;
  window.FTUE_TUTORIAL_TEXTS    = FTUE_TUTORIAL_TEXTS;
  // ===== UROBOROS sacred config =====
  window.TOWER_UROBOROS_SEASONAL = TOWER_UROBOROS_SEASONAL;
}

// Quiet T1.10.7 boot acknowledgement — confirms the module side-effects
// (window exposures above) ran. Matches the T1.10.1-T1.10.6 sibling pattern.
log.debug('bosses (T1.10.7) module initialized');
