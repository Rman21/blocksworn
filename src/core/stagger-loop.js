// 2026-05-11 — TASK-011 (T1.10.6): Stagger Loop state machine + Pressure
// meter relocated from legacy.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - v2.1 P2 STAGGER LOOP CORE CONSTANTS         lines 20004-20061
//     (BOSS_STATE_ACTIVE/STAGGER/RECOVERY, PRESSURE_MAX, PRESSURE_GAIN,
//      STAGGER_DURATION_TURNS, RECOVERY_DURATION_TURNS,
//      STAGGER_CHAINING_ENABLED, FIRE_MULT_CAP_BASE, FIRE_MULT_CAP_TOWER,
//      FIRE_MULT_*_RATIO, OVERFLOW_TO_ULT/ESSENCE, OVERFLOW_PER_SHIELD,
//      OVERFLOW_TO_TOWER)
//   - PR #2.E FTUE intro triggers                  lines 39137-39212
//     (_maybeTriggerPressureIntro / _maybeTriggerStaggerIntro /
//      _maybeTriggerRecoveryIntro / _maybeTriggerOverflowIntro)
//   - PR #2.A state machine foundation             lines 39214-39420
//     (state variables + getFireMultCap + _stateAdjustedCap +
//      enterStaggerState + extendStaggerState + enterRecoveryState +
//      executeRevengeAttack + enterActiveState + tickStaggerState +
//      resetStaggerState + window-exposure block)
//   - PR #2.B Pressure central + gain hooks        lines 39422-39524
//     (addPressure + showPressureGainFX + window exposure)
//   - PR #2.C Overflow conversion                  lines 39526-39672
//     (_getPhaseGateHP + applyOverflowConversion + _distributeOverflowToULT
//      + _distributeOverflowToEssence + showOverflowRewardFX +
//      window exposure)
//   - PR #2.D UI render functions                  lines 39674-39844
//     (renderPressureMeter + renderBossStateBanner + showStaggerEntryFX +
//      showRecoveryEntryFX + _estimateHeroPressureContribution +
//      renderPressureContribution + renderSquadPressureForecast +
//      window exposure)
//
// SACRED PER CLAUDE.md §2.5 + §9 GLOSSARY (v2.1 P2):
//   The Stagger Loop is the SKILL EXPRESSION SYSTEM for Blocksworn combat.
//   Three boss states (Active → Stagger → Recovery → Active) plus a 0..100
//   Pressure meter form the rhythmic backbone of every fight. Mistiming
//   Pressure → lose tempo; perfect timing → multi-hit Stagger windows for
//   massive damage. NOTHING in this module is "balance" — it is contract.
//
//   Byte-perfect from legacy (T1.10.6 is pure relocation):
//     - BOSS_STATE_* string identifiers ('active' / 'stagger' / 'recovery')
//       — every consumer in legacy keys off these exact values.
//     - PRESSURE_MAX = 100. PRESSURE_GAIN table {line_single: 5,
//       line_double: 12, line_triple: 25, line_quad: 45, inferno_proc: 20,
//       detonate_proc: 20, hero_ult: 15, signature_combo: 30,
//       cascade_per_cell: 8}.
//     - STAGGER_DURATION_TURNS = 4. RECOVERY_DURATION_TURNS = 2.
//     - STAGGER_CHAINING_ENABLED = true (V9 lean: Pressure builds during
//       Stagger; chaining extends window +2 turns + resets meter to 0).
//     - FIRE_MULT_CAP_BASE per chapter {1:2.0, 2:2.5, 3:3.0, 4:3.5, 5:4.0}
//       + FIRE_MULT_CAP_TOWER = 4.0. State multipliers Active 0.7,
//       Stagger 1.5, Recovery 0.7. So Ch1 Active 1.4× / Ch1 Stagger 3.0× /
//       Ch5 Stagger 6.0× / Tower Stagger 6.0×.
//     - OVERFLOW_TO_ULT = 0.40, OVERFLOW_TO_ESSENCE = 0.30,
//       OVERFLOW_PER_SHIELD = 500, OVERFLOW_TO_TOWER = 0.10 (chapter
//       default; Tower-battle 0.20 override via OVERFLOW_TO_TOWER_BATTLE_TOWER
//       global from legacy line 29226 — read defensively inside
//       applyOverflowConversion).
//     - Revenge multiplier 1.5× signature damage on Recovery exit.
//     - Phase gates 70% / 35% / 0 for _getPhaseGateHP.
//     - All FX timings + vibrate patterns + flash banner colors + CSS class
//       names preserved verbatim.
//
//   addPressure ordering preserved byte-perfect:
//     1. amount/reason normalization
//     2. dead-boss + Recovery + (chaining-disabled × Stagger) gates
//     3. pressureGainMult debuff floor (reactivity v2.1 P4)
//     4. bossStaggerImmuneTurns clamp (Berserker reactivity — trigger - 1)
//     5. Pressure increment with PRESSURE_MAX clip
//     6. FX + render + FTUE pressure intro
//     7. Stagger trigger / multi-stagger chaining at getStaggerTriggerThreshold()
//        (Mythic Captain override defaults to PRESSURE_MAX)
//
// Owns:
//   - 3-state boss state machine (Active / Stagger / Recovery) — getter
//     plus three transition entry points (enterStaggerState /
//     enterRecoveryState / enterActiveState) and the public extension hook
//     extendStaggerState (Captain T2 +1/+2).
//   - Pressure meter accumulator (addPressure) + per-turn tick
//     (tickStaggerState — drives Stagger countdown → Recovery and Recovery
//     countdown → revenge attack → Active).
//   - Context-aware damage cap (getFireMultCap = chapter base × state
//     ratio × Tower override).
//   - Overflow conversion pipeline (_getPhaseGateHP +
//     applyOverflowConversion + _distributeOverflowToULT/Essence).
//   - All v2.1 P2 FX + UI render functions (renderPressureMeter,
//     renderBossStateBanner, showStaggerEntryFX, showRecoveryEntryFX,
//     showPressureGainFX, showOverflowRewardFX).
//   - Hero Detail / Squad Forecast estimators
//     (_estimateHeroPressureContribution, renderPressureContribution,
//     renderSquadPressureForecast).
//   - v2.1 P2 PR #2.E FTUE intros (_maybeTriggerPressureIntro,
//     _maybeTriggerStaggerIntro, _maybeTriggerRecoveryIntro,
//     _maybeTriggerOverflowIntro).
//   - State reset at battle init (resetStaggerState).
//   - executeRevengeAttack (telegraphed Recovery-exit signature strike,
//     1.5× damage).
//
// Does NOT own:
//   - Captain Mark / Mythic Captain Stagger threshold helper
//     (getStaggerTriggerThreshold) — lives in heroes.js T1.10.4 (Squad
//     Conductor / Mythic Captain). Consulted defensively via /* global */
//     with a PRESSURE_MAX fallback. Same for mythicCaptainStaggerThreshold.
//   - Tank ULT pressure conversion (_computeTankPressureConversion +
//     AEGIS PROTOCOL routing) — lives in damage-channels.js T1.10.5 +
//     heroes.js T1.10.4. They call addPressure(amount, 'tank_absorb' |
//     'aegis_protocol') — this module owns only the meter writer.
//   - Phase 3 hook bus (_firePhase3Hook, _registerPhase3Hook) — heroes.js
//     T1.10.4 territory; consumed via /* global */.
//   - Boss signature damage tier resolution (_getBossSignatureTier +
//     CHANNEL_SIGNATURE_DMG) — damage-channels.js T1.10.5. Used here only
//     to pre-compute Recovery-exit revenge damage.
//   - applyChannelDamage dispatcher — damage-channels.js T1.10.5; used
//     here from executeRevengeAttack via /* global */.
//   - pressureGainMult + bossStaggerImmuneTurns + bossStealthTurns +
//     bossBackstabChainTurns + bossFireAuraActive / bossFireAuraDmg —
//     reactivity-events.js T1.10.8 territory; consumed via /* global */.
//   - AEGIS PROTOCOL EOT ticker (tickAegisProtocol) — heroes.js T1.10.4
//     T3 Tank ULT path; called from end of tickStaggerState via /* global */.
//   - Boss / battle state context (currentBoss, currentChapter,
//     currentBossIdx, _isTowerBattle, bossHP, bossMaxHP, shieldCount,
//     placementCount, HERO_DECK, HERO_ROSTER, activeSquad, heroUpgrades,
//     getHeroLevel, ultCharges, currentUltThreshold, ULT_THRESHOLD,
//     STIHIYAS, MAX_SHIELD, essences, towerState, addTowerPoints,
//     saveTowerState, saveProgress, renderULTBar, renderHP, isFtueActive,
//     seenDialogs, playDialog, getSquadMitigation, _firePhase3Hook,
//     flashText, flashStateBanner, vibrate, speakNarrator, logEvent) —
//     T1.10.7 / T1.10.8 / T1.10.9 / T1.11 territory. All declared
//     /* global */ here and consumed defensively (typeof checks +
//     try/catch) per legacy semantics.
//
// Storage migration: zero new bare-string localStorage keys. Stagger Loop
// state (bossState, bossPressure, staggerTurnsRemaining,
// recoveryTurnsRemaining, totalStaggersThisFight, lastStaggerEnteredAtTurn,
// pendingRevengeAttack) is per-battle ephemeral — reset at every
// battle init via resetStaggerState. Total bare-string keys touched by
// T1.10.6: 0. The T1.10.9 migration shim allow-list (FTUE + intro-video +
// 5 chapter-complete keys) does NOT need additions from T1.10.6.
//
// Cross-module wiring: heroes.js T1.10.4 already references
// `addPressure` / `PRESSURE_GAIN` / `PRESSURE_MAX` / `extendStaggerState` /
// `bossState` / `BOSS_STATE_STAGGER` via /* global */. damage-channels.js
// T1.10.5 also calls `addPressure(finalDmg, 'aegis_protocol')` and
// `addPressure(tankConv, 'tank_absorb')` via /* global */. Both modules
// stay on their /* global */ directives until T1.10.9 wire-up replaces
// them with explicit imports. Legacy still publishes window.* on the
// transition functions + addPressure for the in-flight body; we mirror
// the legacy window-exposure block at the foot of this module so all
// consumer paths see the same function instance.
//
// 2026-05-11 — Roman: pure-relocation discipline. No "improvements".
// Nothing new. Comments above this line replicate legacy intent.

// ESLint scaffolding — the state machine + Pressure + Overflow + FTUE
// intros + UI render functions touch many ambient legacy names. Per the
// T1.10.1-T1.10.5 sibling pattern: explicit /* global */ blocks for every
// legacy ambient + writable mutation site. caughtErrors no-unused-vars and
// no-empty must be relaxed because legacy uses `} catch (e) {}` patterns
// abundantly — preserving byte-perfect requires accepting them.
/* eslint-disable no-empty, no-unused-vars */

// T1.13.1: /* global */ → ES imports for resolved src/ exports.
// T1.13.5 (2026-05-12): getSquadMitigation flipped to ES import (was /* global */).
import { getStaggerTriggerThreshold, HERO_ROSTER, tickAegisProtocol, getSquadMitigation } from './heroes.js';
import { _getBossSignatureTier, CHANNEL_SIGNATURE_DMG, applyChannelDamage } from './damage-channels.js';
import { getHeroLevel, saveProgress } from './progression.js';
import { STIHIYAS } from '../data/elements.js';
import { isFtueActive } from './ftue-state.js';
// T1.13.4: playDialog flipped from /* global */ to ES import; seenDialogs stays
// /* global */ — bridged on window from src/ui/dialog.js with defensive typeof reads.
import { playDialog } from '../ui/dialog.js';
import { speakNarrator } from '../feel/narrator.js';
import { logEvent } from '../services/analytics.js';
import { log } from '../services/logger.js';

// Reactivity Events (residual legacy-owned):
/* global pressureGainMult, bossStaggerImmuneTurns:writable,
   bossStealthTurns:writable, bossBackstabChainTurns:writable,
   bossFireAuraActive, bossFireAuraDmg, squadSilencedTurns:writable */
// Boss + battle context (residual legacy-owned):
/* global currentBoss, currentChapter, currentBossIdx, _isTowerBattle,
   bossHP, bossMaxHP, placementCount */
/* global shieldCount:writable */
// Heroes / tower references (residual legacy-owned):
/* global HERO_DECK, activeSquad, heroUpgrades,
   ultCharges, currentUltThreshold, ULT_THRESHOLD, essences, towerState,
   addTowerPoints, saveTowerState */
// Sacred constants (residual legacy-owned):
/* global MAX_SHIELD */
// FTUE dialog (residual legacy-owned):
/* global seenDialogs */
// Tower overflow ratio override (residual legacy-owned):
/* global OVERFLOW_TO_TOWER_BATTLE_TOWER */
// Phase 3 hook bus (residual legacy-owned):
/* global _firePhase3Hook */
// Feel / UI (residual legacy-owned):
/* global flashText, flashStateBanner, vibrate, renderHP, renderULTBar */
// LEGACY-ONLY: above tokens have no src/ export — shims retired in T1.14+ cleanup.

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMBAT v2.1 PHASE 2 — STAGGER LOOP CORE CONSTANTS
// Per /Restructure/BLOCKSWORN_COMBAT_V21_PHASE_2_STAGGER_LOOP.md §2.
// Three-state boss machine (Active → Stagger → Recovery), Pressure
// meter as skill-driven indicator, Overflow conversion as safety net,
// chapter-progressive damage cap.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Boss state machine — string identifiers matching spec §2. SACRED PER
// CLAUDE.md §2.5 — the string values 'active' / 'stagger' / 'recovery'
// are consumer keys throughout legacy (banner classes, FX gates,
// reactivity events). DO NOT rename the values.
export const BOSS_STATE_ACTIVE   = 'active';
export const BOSS_STATE_STAGGER  = 'stagger';
export const BOSS_STATE_RECOVERY = 'recovery';

// Pressure meter — 0..PRESSURE_MAX gauge over boss portrait.
export const PRESSURE_MAX = 100;

// Pressure gain table — drives Stagger pacing. Per spec §2 numeric examples
// (line clears 5/12/25/45 by line count, ~20 for proc events, ~15 for ULTs).
export const PRESSURE_GAIN = Object.freeze({
  line_single:      5,    // 1-line clear
  line_double:     12,    // 2-line clear (cross / double row)
  line_triple:     25,    // 3-line clear
  line_quad:       45,    // 4-line clear (mastery moment)
  inferno_proc:    20,    // EMBER inferno trigger
  detonate_proc:   20,    // SOLAR detonate trigger
  hero_ult:        15,    // Any hero ULT fired
  signature_combo: 30,    // Squad-wide signature combo (P3+ scaffold)
  cascade_per_cell: 8,    // Cascade chain — per cleared cell
});

// State durations (in player turns).
export const STAGGER_DURATION_TURNS  = 4;     // Stagger window
export const RECOVERY_DURATION_TURNS = 2;     // Recovery telegraph + revenge

// Multi-stagger chaining (V9 lean: enabled — Pressure builds during Stagger).
export const STAGGER_CHAINING_ENABLED = true;

// Damage cap shaping — context-aware. Static FIRE_MULT_CAP retained as
// legacy fallback (read by getFireMultCap when chapter not in BASE map).
export const FIRE_MULT_CAP_BASE = Object.freeze({
  1: 2.0,   // Ch1 — learning curve
  2: 2.5,   // Ch2 — ascension
  3: 3.0,   // Ch3 — mid-game
  4: 3.5,   // Ch4 — late-game
  5: 4.0,   // Ch5 — finale
});
export const FIRE_MULT_CAP_TOWER = 4.0;       // Tower always max — competitive arena

// State multipliers on FIRE_MULT_CAP base.
export const FIRE_MULT_ACTIVE_RATIO   = 0.7;  // 70% in Active state
export const FIRE_MULT_STAGGER_RATIO  = 1.5;  // 150% in Stagger (effective uncap)
export const FIRE_MULT_RECOVERY_RATIO = 0.7;  // Same as Active during Recovery

// Overflow conversion ratios — overkill damage redirected to player rewards.
export const OVERFLOW_TO_ULT     = 0.40;   // 40% of overkill → distributed ULT charge
export const OVERFLOW_TO_ESSENCE = 0.30;   // 30% → essence drops
export const OVERFLOW_PER_SHIELD = 500;    // 1 shield per 500 overkill damage
export const OVERFLOW_TO_TOWER   = 0.10;   // 10% → Tower points (Tower battles only)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMBAT v2.1 PHASE 2 PR #2.E — FTUE INTRO TRIGGERS
// Per /Restructure/BLOCKSWORN_COMBAT_V21_PHASE_2_STAGGER_LOOP.md §5.
// 4 helpers gated by seenDialogs + Ch1 + !isFtueActive. Each fires
// once per install on first encounter. Forward refs from #2.A (state
// transitions) + #2.B (addPressure) + #2.C (applyOverflowConversion)
// were already defensive — these implementations land them.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Fires on first non-trivial Pressure gain during Ch1. addPressure()
// in #2.B calls this after each successful gain. 500ms delay so the
// pressure floater FX lands first.
export function _maybeTriggerPressureIntro() {
  try {
    if (typeof seenDialogs === 'undefined' || !seenDialogs) return;
    if (typeof currentChapter === 'undefined' || currentChapter !== 1) return;
    if (seenDialogs.has('tut_pressure_intro')) return;
    if (typeof isFtueActive === 'function' && isFtueActive()) return;
    if (typeof bossPressure !== 'number' || bossPressure < 5) return;
    setTimeout(() => {
      try { if (typeof playDialog === 'function') playDialog('tut_pressure_intro'); } catch (e) {}
    }, 500);
  } catch (e) { log.warn('_maybeTriggerPressureIntro failed:', e); }
}

// Fires on first STAGGER entry during Ch1. enterStaggerState() in
// #2.A calls this after the gold flash + slow-mo FX. 1500ms delay so
// the FX completes and the dialog lands on a settled screen.
export function _maybeTriggerStaggerIntro() {
  try {
    if (typeof seenDialogs === 'undefined' || !seenDialogs) return;
    if (typeof currentChapter === 'undefined' || currentChapter !== 1) return;
    if (seenDialogs.has('tut_stagger_intro')) return;
    if (typeof isFtueActive === 'function' && isFtueActive()) return;
    setTimeout(() => {
      try { if (typeof playDialog === 'function') playDialog('tut_stagger_intro'); } catch (e) {}
    }, 1500);
  } catch (e) { log.warn('_maybeTriggerStaggerIntro failed:', e); }
}

// Fires on first RECOVERY entry during Ch1. enterRecoveryState() in
// #2.A calls this. 800ms delay — Recovery banner is anxious; we want
// the player reading the warning before the dialog softens it.
export function _maybeTriggerRecoveryIntro() {
  try {
    if (typeof seenDialogs === 'undefined' || !seenDialogs) return;
    if (typeof currentChapter === 'undefined' || currentChapter !== 1) return;
    if (seenDialogs.has('tut_recovery_intro')) return;
    if (typeof isFtueActive === 'function' && isFtueActive()) return;
    setTimeout(() => {
      try { if (typeof playDialog === 'function') playDialog('tut_recovery_intro'); } catch (e) {}
    }, 800);
  } catch (e) { log.warn('_maybeTriggerRecoveryIntro failed:', e); }
}

// Fires on first OVERFLOW conversion during Ch1. applyOverflowConversion()
// in #2.C calls this after the gold burst FX. 1200ms delay so the
// reward toasts cascade before the dialog explains what happened.
export function _maybeTriggerOverflowIntro() {
  try {
    if (typeof seenDialogs === 'undefined' || !seenDialogs) return;
    if (typeof currentChapter === 'undefined' || currentChapter !== 1) return;
    if (seenDialogs.has('tut_overflow_intro')) return;
    if (typeof isFtueActive === 'function' && isFtueActive()) return;
    setTimeout(() => {
      try { if (typeof playDialog === 'function') playDialog('tut_overflow_intro'); } catch (e) {}
    }, 1200);
  } catch (e) { log.warn('_maybeTriggerOverflowIntro failed:', e); }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMBAT v2.1 PHASE 2 PR #2.A — STATE MACHINE FOUNDATION
// Per /Restructure/BLOCKSWORN_COMBAT_V21_PHASE_2_STAGGER_LOOP.md §3.1-3.4.
// State machine (Active ↔ Stagger ↔ Recovery), context-aware damage
// cap (chapter × state × Tower), state transitions + reset on battle init.
// PR #2.B wires addPressure() + Pressure hooks. PR #2.C adds Overflow
// conversion. PR #2.D paints UI. PR #2.E adds FTUE intros.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// State variables — initialized to ACTIVE/0 on every battle reset.
// Module-private; consumers read via getBossState() / getBossPressure()
// (the latter exposed as an exported getter for legacy bodies that read
// the bare identifier `bossPressure`). Direct mutation is reserved for
// the transition functions + addPressure + resetStaggerState.
let bossState              = BOSS_STATE_ACTIVE;
let bossPressure           = 0;
let staggerTurnsRemaining  = 0;
let recoveryTurnsRemaining = 0;
let totalStaggersThisFight = 0;
let lastStaggerEnteredAtTurn = -1;
let pendingRevengeAttack   = null;  // { dmg, channel } fired on Recovery exit

// Public getters — exported so other modules can read state without
// touching the module-local bindings. Legacy bodies that read the bare
// identifiers (`bossState`, `bossPressure`, etc.) continue to do so via
// the window-exposure block at the foot of this module until T1.10.9.
export function getBossState() { return bossState; }
export function getBossPressure() { return bossPressure; }
export function getStaggerTurnsRemaining() { return staggerTurnsRemaining; }
export function getRecoveryTurnsRemaining() { return recoveryTurnsRemaining; }
export function getTotalStaggersThisFight() { return totalStaggersThisFight; }

// 2026-05-02 — COMBAT v2.1 P2 §3.4: context-aware damage cap.
// Replaces static FIRE_MULT_CAP const (still defined as legacy fallback).
// Reads: currentChapter (1..5), _isTowerBattle flag, bossState.
// Returns: effective cap = base × state ratio.
//   Ch1 Active:  2.0 × 0.7 = 1.4×
//   Ch1 Stagger: 2.0 × 1.5 = 3.0×
//   Ch5 Stagger: 4.0 × 1.5 = 6.0×
//   Tower Stagger: 4.0 × 1.5 = 6.0×  (no chapter throttle)
export function getFireMultCap() {
  // Tower battles: always max for competitive arena.
  if (typeof _isTowerBattle !== 'undefined' && _isTowerBattle) {
    return _stateAdjustedCap(FIRE_MULT_CAP_TOWER);
  }
  const ch = (typeof currentChapter !== 'undefined' && currentChapter) ? currentChapter : 1;
  // Legacy line 39246 references the legacy global `FIRE_MULT_CAP` as a
  // fallback when chapter not in BASE map. That global lives in legacy
  // (constant 3.0); we mirror with a safe 3.0 default — pure-relocation
  // semantics: in all chapters 1..5 the BASE map hits, so the fallback
  // is unreachable in practice.
  const base = FIRE_MULT_CAP_BASE[ch] || 3.0;
  return _stateAdjustedCap(base);
}

function _stateAdjustedCap(base) {
  switch (bossState) {
    case BOSS_STATE_STAGGER:  return base * FIRE_MULT_STAGGER_RATIO;
    case BOSS_STATE_RECOVERY: return base * FIRE_MULT_RECOVERY_RATIO;
    case BOSS_STATE_ACTIVE:
    default:                  return base * FIRE_MULT_ACTIVE_RATIO;
  }
}

// 2026-05-02 — COMBAT v2.1 P2 §3.3: state transitions.
// Defensive forward references — render/FX functions wired in PR #2.D.
// FTUE intros wired in PR #2.E. Until those land, transitions still
// execute correctly; missing helpers degrade silently.

export function enterStaggerState() {
  bossState = BOSS_STATE_STAGGER;
  staggerTurnsRemaining = STAGGER_DURATION_TURNS;
  bossPressure = 0;
  totalStaggersThisFight++;
  lastStaggerEnteredAtTurn = (typeof placementCount !== 'undefined') ? placementCount : -1;
  try { if (typeof showStaggerEntryFX === 'function') showStaggerEntryFX(); } catch (e) {}
  try { if (typeof flashStateBanner === 'function') flashStateBanner('STAGGER!', '#FFD700'); } catch (e) {}
  try { vibrate([100, 50, 100, 50, 200]); } catch (e) {}
  try { if (typeof _maybeTriggerStaggerIntro === 'function') _maybeTriggerStaggerIntro(); } catch (e) {}
  try { if (typeof renderBossStateBanner === 'function') renderBossStateBanner(); } catch (e) {}
  try { if (typeof renderPressureMeter === 'function') renderPressureMeter(); } catch (e) {}
  // 2026-05-02 — COMBAT v2.1 P3 §14.1: fire onStaggerEnter hooks (Mythic Tank
  // squad-wide damage boost activates here per spec §3.4).
  try { if (typeof _firePhase3Hook === 'function') _firePhase3Hook('onStaggerEnter', {
    totalStaggers: totalStaggersThisFight,
  }); } catch (e) {}
  try { if (typeof logEvent === 'function') logEvent('stagger_entered', {
    totalStaggers: totalStaggersThisFight, atTurn: lastStaggerEnteredAtTurn,
  }); } catch (e) {}
}

export function extendStaggerState(turns) {
  if (!turns || turns <= 0) return;
  staggerTurnsRemaining += turns;
  totalStaggersThisFight++;
  try { if (typeof flashStateBanner === 'function') flashStateBanner('STAGGER EXTENDED +' + turns, '#FFD700'); } catch (e) {}
  try { vibrate([80, 40, 80, 40, 80]); } catch (e) {}
  try { if (typeof renderBossStateBanner === 'function') renderBossStateBanner(); } catch (e) {}
}

export function enterRecoveryState() {
  // 2026-05-02 — COMBAT v2.1 P3 §14.1: fire onStaggerExit when natural Stagger
  // ends → Recovery. Mythic Tank squad boost clears here too.
  try { if (typeof _firePhase3Hook === 'function' && bossState === BOSS_STATE_STAGGER) {
    _firePhase3Hook('onStaggerExit', { reason: 'enterRecovery' });
  } } catch (e) {}
  bossState = BOSS_STATE_RECOVERY;
  recoveryTurnsRemaining = RECOVERY_DURATION_TURNS;
  // Pre-compute revenge damage (telegraphed). Uses Phase 1 signature tier
  // mapping. Revenge multiplier = 1.5× the regular signature damage.
  let sigDmg = 16;
  try {
    const tier = (typeof _getBossSignatureTier === 'function') ? _getBossSignatureTier() : 'gatekeeper';
    sigDmg = (typeof CHANNEL_SIGNATURE_DMG !== 'undefined' && CHANNEL_SIGNATURE_DMG[tier]) || 16;
  } catch (e) {}
  pendingRevengeAttack = { dmg: Math.round(sigDmg * 1.5), channel: 'signature' };
  try { if (typeof showRecoveryEntryFX === 'function') showRecoveryEntryFX(); } catch (e) {}
  try { if (typeof flashStateBanner === 'function') flashStateBanner('REVENGE INCOMING — ' + recoveryTurnsRemaining + 'T', '#FF4500'); } catch (e) {}
  try { vibrate([200, 100, 200]); } catch (e) {}
  try { if (typeof _maybeTriggerRecoveryIntro === 'function') _maybeTriggerRecoveryIntro(); } catch (e) {}
  try { if (typeof renderBossStateBanner === 'function') renderBossStateBanner(); } catch (e) {}
}

export function executeRevengeAttack() {
  if (!pendingRevengeAttack) return;
  const { dmg, channel } = pendingRevengeAttack;
  try {
    if (typeof applyChannelDamage === 'function') {
      applyChannelDamage(channel, dmg, { source: 'revenge', telegraphed: true });
    }
  } catch (e) { log.warn('revenge attack failed:', e); }
  pendingRevengeAttack = null;
}

export function enterActiveState() {
  // 2026-05-02 — COMBAT v2.1 P3 §14.1: fire onStaggerExit before flipping state
  // so listeners can read the outgoing context. Mythic Tank squad boost clears here.
  try { if (typeof _firePhase3Hook === 'function' && bossState === BOSS_STATE_STAGGER) {
    _firePhase3Hook('onStaggerExit', { reason: 'enterActive' });
  } } catch (e) {}
  bossState = BOSS_STATE_ACTIVE;
  staggerTurnsRemaining = 0;
  recoveryTurnsRemaining = 0;
  bossPressure = Math.max(0, bossPressure);
  try { if (typeof renderBossStateBanner === 'function') renderBossStateBanner(); } catch (e) {}
  try { if (typeof renderPressureMeter === 'function') renderPressureMeter(); } catch (e) {}
}

// EOT tick — called from maybeBossAttack (alongside void/saturation hooks
// shipped in PR #1.B). Drives Stagger countdown + Recovery transition.
export function tickStaggerState() {
  if (bossState === BOSS_STATE_STAGGER) {
    staggerTurnsRemaining--;
    if (staggerTurnsRemaining <= 0) {
      enterRecoveryState();
    } else {
      try { if (typeof renderBossStateBanner === 'function') renderBossStateBanner(); } catch (e) {}
    }
  } else if (bossState === BOSS_STATE_RECOVERY) {
    recoveryTurnsRemaining--;
    if (recoveryTurnsRemaining <= 0) {
      executeRevengeAttack();
      enterActiveState();
    } else {
      try { if (typeof renderBossStateBanner === 'function') renderBossStateBanner(); } catch (e) {}
    }
  }
  // 2026-05-02 — COMBAT v2.1 P3 §3.4: AEGIS PROTOCOL EOT tick.
  // Independent of bossState — Tank T3 ULT window can run in any state.
  try { if (typeof tickAegisProtocol === 'function') tickAegisProtocol(); } catch (e) {}
  // 2026-05-02 — COMBAT v2.1 P4 PR #4.C: per-turn reactivity counters tick.
  // Each is a "duration" set by a reactivity handler (PR #4.B) and decays
  // on EOT until 0. Phase 1 fire aura applies actual HP loss when active.
  try {
    if (typeof bossStaggerImmuneTurns === 'number' && bossStaggerImmuneTurns > 0) {
      bossStaggerImmuneTurns--;
      if (bossStaggerImmuneTurns === 0) {
        try { flashStateBanner('STAGGER LOCK ENDS', '#FF4D1F'); } catch (e) {}
      }
    }
    if (typeof bossStealthTurns === 'number' && bossStealthTurns > 0) {
      bossStealthTurns--;
    }
    if (typeof bossBackstabChainTurns === 'number' && bossBackstabChainTurns > 0) {
      bossBackstabChainTurns--;
      if (bossBackstabChainTurns === 0) {
        try { flashStateBanner('BACKSTAB CHAIN ENDS', '#9B59D6'); } catch (e) {}
      }
    }
    if (typeof squadSilencedTurns === 'number' && squadSilencedTurns > 0) {
      squadSilencedTurns--;
      if (squadSilencedTurns === 0) {
        try { flashStateBanner('SILENCE LIFTED · ULTS RESTORED', '#9B59D6'); } catch (e) {}
      }
    }
    // Phoenix fire aura — 3 HP/turn through Phase 1 mitigation pipeline.
    if (typeof bossFireAuraActive !== 'undefined' && bossFireAuraActive
        && typeof bossFireAuraDmg === 'number' && bossFireAuraDmg > 0) {
      try { if (typeof applyChannelDamage === 'function') {
        applyChannelDamage('signature', bossFireAuraDmg, { source: 'phoenix_fire_aura' });
      } } catch (e) {}
    }
  } catch (e) { log.warn('[Phase 4 EOT tick] failed:', e); }
}

// Reset all state at battle init (called from battle-spawn paths below).
export function resetStaggerState() {
  bossState              = BOSS_STATE_ACTIVE;
  bossPressure           = 0;
  staggerTurnsRemaining  = 0;
  recoveryTurnsRemaining = 0;
  totalStaggersThisFight = 0;
  lastStaggerEnteredAtTurn = -1;
  pendingRevengeAttack   = null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMBAT v2.1 PHASE 2 PR #2.B — PRESSURE CENTRAL + GAIN HOOKS
// Per /Restructure/BLOCKSWORN_COMBAT_V21_PHASE_2_STAGGER_LOOP.md §3.2, §3.10.
// addPressure() is THE single entry point for filling the boss meter.
// Triggers Stagger when meter caps; supports multi-stagger chaining when
// STAGGER_CHAINING_ENABLED. Wired into 5 sites this PR: line clears,
// INFERNO, DETONATE, hero ULT, cascade. Signature combo (P3+) reserved.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 2026-05-02 — COMBAT v2.1 P2 §3.2: Pressure central function.
// reason: human-readable label for FX/logging — keeps with values in the
// PRESSURE_GAIN table where possible ('single_clear' / 'inferno' / etc.).
// amount: from PRESSURE_GAIN table (or computed for cascade).
// Returns: actual pressure gained (clipped at PRESSURE_MAX).
export function addPressure(amount, reason) {
  reason = reason || 'unknown';
  if (!amount || amount <= 0) return 0;
  // Dead boss = no meter activity.
  if (typeof bossHP === 'number' && bossHP <= 0) return 0;
  // V9 chaining: pressure builds during Stagger too. If chaining disabled,
  // meter freezes during Stagger (skip writes).
  if (!STAGGER_CHAINING_ENABLED && bossState === BOSS_STATE_STAGGER) return 0;
  // Recovery phase: meter does NOT fill (player is bracing for revenge).
  if (bossState === BOSS_STATE_RECOVERY) return 0;

  // 2026-05-02 — COMBAT v2.1 P4 PR #4.C §5.7: pressureGainMult debuff.
  // Set by tower_voidfang_p2_p3 reactivity (×0.70). Default 1.0 — no effect
  // when no debuff active. Applied AFTER zero-check so reactivity events
  // can still fire even if mult drops gain below 1.
  if (typeof pressureGainMult === 'number' && pressureGainMult !== 1.0) {
    amount = Math.max(0, Math.floor(amount * pressureGainMult));
    if (amount <= 0) return 0;
  }

  // 2026-05-02 — COMBAT v2.1 P4 PR #4.C §5.7: berserker stagger immunity.
  // While bossStaggerImmuneTurns > 0, Pressure caps just below the trigger
  // threshold so Stagger CANNOT fire. Berserker_p2_p3 sets to 3 turns;
  // ticks in tickStaggerState extension below.
  if (typeof bossStaggerImmuneTurns === 'number' && bossStaggerImmuneTurns > 0) {
    const _trigger = (typeof getStaggerTriggerThreshold === 'function') ? getStaggerTriggerThreshold() : PRESSURE_MAX;
    const before = bossPressure;
    bossPressure = Math.min(_trigger - 1, bossPressure + amount);
    const gained = bossPressure - before;
    if (gained > 0) {
      try { showPressureGainFX(gained, reason); } catch (e) {}
      try { if (typeof renderPressureMeter === 'function') renderPressureMeter(); } catch (e) {}
    }
    return gained;
  }

  const before = bossPressure;
  bossPressure = Math.min(PRESSURE_MAX, bossPressure + amount);
  const gained = bossPressure - before;

  if (gained > 0) {
    try { showPressureGainFX(gained, reason); } catch (e) {}
    try { if (typeof renderPressureMeter === 'function') renderPressureMeter(); } catch (e) {}
    try { if (typeof _maybeTriggerPressureIntro === 'function') _maybeTriggerPressureIntro(); } catch (e) {}
  }

  // Stagger trigger / chaining
  // 2026-05-02 — COMBAT v2.1 P3 §3.5: Mythic Captain pre-set threshold (50/75/100)
  // replaces hardcoded PRESSURE_MAX. getStaggerTriggerThreshold() defaults to
  // PRESSURE_MAX when no Mythic Captain present.
  const _trigger = (typeof getStaggerTriggerThreshold === 'function') ? getStaggerTriggerThreshold() : PRESSURE_MAX;
  if (bossPressure >= _trigger) {
    if (bossState === BOSS_STATE_ACTIVE) {
      enterStaggerState();   // consumes meter, transitions to Stagger
    } else if (bossState === BOSS_STATE_STAGGER && STAGGER_CHAINING_ENABLED) {
      // Multi-stagger chaining (V9 lean): meter refilled mid-Stagger →
      // extend window by 2 turns, reset meter to 0.
      extendStaggerState(2);
      bossPressure = 0;
      try { if (typeof renderPressureMeter === 'function') renderPressureMeter(); } catch (e) {}
    }
  }
  return gained;
}

// Pressure gain visual feedback. PR #2.D may extend with per-channel CSS
// flair (gold pulse, bar segment fill animation). For now: floating text.
export function showPressureGainFX(amount, reason) {
  const labels = {
    single_clear:    '+5 LINE',
    double_clear:    '+12 DOUBLE',
    triple_clear:    '+25 TRIPLE',
    quad_clear:      '+45 QUAD!',
    inferno:         '+20 🔥 INFERNO',
    detonate:        '+20 ☀ DETONATE',
    hero_ult:        '+15 ULT',
    cascade:         '+' + amount + ' CASCADE',
    signature_combo: '+30 SIGNATURE',
  };
  const label = labels[reason] || ('+' + amount + ' ⚡');
  // Color tier: >=25 orange, >=12 gold, else pale gold.
  const color = (amount >= 25) ? '#FF8C00' : (amount >= 12) ? '#FFD700' : '#FFEB99';
  try { flashText(label, color); } catch (e) {}
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMBAT v2.1 PHASE 2 PR #2.C — OVERFLOW CONVERSION
// Per /Restructure/BLOCKSWORN_COMBAT_V21_PHASE_2_STAGGER_LOOP.md §3.7-3.8.
// AAA principle: no investment lost on overkill. Overshoot at phase gates
// (or boss death) converts: 40% → distributed ULT charge, 30% → essence,
// 1 shield per 500 raw dmg, 10% → Tower points (Tower battles only).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 2026-05-02 — COMBAT v2.1 P2 §3.7: phase gate helper.
// Boss phases gate at 70% / 35% / 0. Returns nearest gate AT or BELOW
// the current bossHP that bossHP needs to descend through. Used by
// dealDamage to cap actualDmg at the next gate (overshoot becomes
// overflow for conversion). P4 will plug per-boss reactivity events
// at these gate transitions; for now they're pure HP pacing markers.
export function _getPhaseGateHP() {
  if (typeof currentBoss === 'undefined' || !currentBoss) return 0;
  const maxHP = (typeof bossMaxHP === 'number' && bossMaxHP > 0)
              ? bossMaxHP
              : (currentBoss.hp || 1);
  const ratio = (typeof bossHP === 'number' ? bossHP : maxHP) / maxHP;
  if (ratio > 0.70) return Math.floor(maxHP * 0.70);
  if (ratio > 0.35) return Math.floor(maxHP * 0.35);
  return 0;
}

// 2026-05-02 — COMBAT v2.1 P2 §3.8: distribute overflow to player rewards.
// Splits the overkill amount four ways (with 20% absorbed as variance —
// the 40+30+10 = 80% intentional; remaining 20% = "the void took the rest"
// which keeps overkill from being net-positive enough to incentivize
// deliberate overshoot exploits). Shield grant is integer per 500 raw
// (so any overflow at all has chance of meaningful reward).
export function applyOverflowConversion(overflowDmg) {
  if (!overflowDmg || overflowDmg <= 0) return;
  // 40% → ULT charge distributed across squad's stihiyas
  const ultGain = Math.floor(overflowDmg * OVERFLOW_TO_ULT);
  if (ultGain > 0) {
    try { _distributeOverflowToULT(ultGain); } catch (e) { log.warn('overflow→ULT failed:', e); }
  }
  // 30% → essence drops, distributed evenly across 5 stihiyas
  const essenceGain = Math.floor(overflowDmg * OVERFLOW_TO_ESSENCE);
  if (essenceGain > 0) {
    try { _distributeOverflowToEssence(essenceGain); } catch (e) { log.warn('overflow→essence failed:', e); }
  }
  // 1 shield per 500 overkill, capped at MAX_SHIELD + 2 (Aegis bonus headroom)
  const shieldGain = Math.floor(overflowDmg / OVERFLOW_PER_SHIELD);
  if (shieldGain > 0 && typeof shieldCount === 'number') {
    const cap = (typeof MAX_SHIELD === 'number' ? MAX_SHIELD : 5) + 2;
    shieldCount = Math.min(cap, shieldCount + shieldGain);
    try { if (typeof renderHP === 'function') renderHP(); } catch (e) {}
  }
  // 10% → Tower points (Tower battles only).
  // 2026-05-02 — COMBAT v2.1 P5 PR #5.C §4.1: bumped to 20% for Tower
  // battles (vs 10% chapter) per spec §4.3 differentiation matrix —
  // skill-focused Tower rewards score-burst more aggressively.
  let towerGain = 0;
  if (typeof _isTowerBattle !== 'undefined' && _isTowerBattle) {
    const _towerOverflowRatio = (typeof OVERFLOW_TO_TOWER_BATTLE_TOWER === 'number')
                                ? OVERFLOW_TO_TOWER_BATTLE_TOWER : 0.20;
    towerGain = Math.floor(overflowDmg * _towerOverflowRatio);
    if (towerGain > 0) {
      try {
        if (typeof addTowerPoints === 'function') addTowerPoints(towerGain);
        else if (typeof towerState !== 'undefined' && towerState) {
          towerState.towerPoints = (towerState.towerPoints || 0) + towerGain;
          try { if (typeof saveTowerState === 'function') saveTowerState(); } catch (e) {}
        }
      } catch (e) { log.warn('overflow→tower failed:', e); }
    }
  }
  // Combined visual feedback. PR #2.D may upgrade with staggered cascade FX.
  try { if (typeof showOverflowRewardFX === 'function') showOverflowRewardFX({
    overflow: overflowDmg, ult: ultGain, essence: essenceGain,
    shield: shieldGain, tower: towerGain,
  }); } catch (e) {}
  // FTUE intro hook (PR #2.E wires the dialog)
  try { if (typeof _maybeTriggerOverflowIntro === 'function') _maybeTriggerOverflowIntro(); } catch (e) {}
  // Analytics
  try { if (typeof logEvent === 'function') logEvent('overflow_conversion', {
    overflow: overflowDmg, ult: ultGain, essence: essenceGain, shield: shieldGain, tower: towerGain,
  }); } catch (e) {}
}

// Distribute ULT charge proportionally across the squad's active stihiyas.
// Falls back to all 5 if no active set is built.
export function _distributeOverflowToULT(amount) {
  if (!amount || amount <= 0) return;
  const stihs = (typeof STIHIYAS !== 'undefined' && Array.isArray(STIHIYAS))
              ? STIHIYAS : ['ember','tide','grove','solar','umbra'];
  // Active stihiyas = elements present in current squad, if computed.
  const targets = [];
  if (typeof HERO_DECK !== 'undefined' && Array.isArray(HERO_DECK)) {
    const seen = new Set();
    for (const h of HERO_DECK) {
      if (h && h.stihiya && !seen.has(h.stihiya)) { seen.add(h.stihiya); targets.push(h.stihiya); }
    }
  }
  const list = targets.length > 0 ? targets : stihs;
  const per = Math.floor(amount / list.length);
  if (per <= 0) return;
  for (const s of list) {
    if (typeof ultCharges !== 'undefined' && ultCharges[s] !== undefined) {
      const cap = (typeof currentUltThreshold !== 'undefined' && currentUltThreshold[s])
                || (typeof ULT_THRESHOLD !== 'undefined' && ULT_THRESHOLD[s])
                || 12;
      ultCharges[s] = Math.min(cap, ultCharges[s] + per);
    }
  }
  try { if (typeof renderULTBar === 'function') renderULTBar(); } catch (e) {}
}

// Distribute essence evenly across all 5 stihiyas.
export function _distributeOverflowToEssence(amount) {
  if (!amount || amount <= 0) return;
  const stihs = (typeof STIHIYAS !== 'undefined' && Array.isArray(STIHIYAS))
              ? STIHIYAS : ['ember','tide','grove','solar','umbra'];
  const per = Math.floor(amount / stihs.length);
  if (per <= 0) return;
  if (typeof essences !== 'undefined' && essences) {
    for (const s of stihs) {
      essences[s] = (essences[s] || 0) + per;
    }
    try { if (typeof saveProgress === 'function') saveProgress(); } catch (e) {}
  }
}

// Visual feedback for overflow rewards. Big gold burst headline + 4
// sub-floaters (ULT / essence / shield / tower) staggered 200ms apart.
export function showOverflowRewardFX(rewards) {
  if (!rewards) return;
  const { overflow, ult, essence, shield, tower } = rewards;
  try { flashText('⚡ OVERFLOW · ' + overflow, '#FFD700'); } catch (e) {}
  setTimeout(() => {
    if (ult > 0)     try { flashText('+' + ult + ' ⚡ ULT',     '#9B59E8'); } catch (e) {}
    if (essence > 0) try { flashText('+' + essence + ' ✦ ESSENCE', '#5DCA79'); } catch (e) {}
    if (shield > 0)  try { flashText('+' + shield + ' 🛡 SHIELD',   '#5DCA79'); } catch (e) {}
    if (tower > 0)   try { flashText('+' + tower + ' 🏆 TOWER',     '#FFD700'); } catch (e) {}
  }, 200);
  try { vibrate([120, 60, 120, 60, 200]); } catch (e) {}
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMBAT v2.1 PHASE 2 PR #2.D — UI RENDER FUNCTIONS
// Per /Restructure/BLOCKSWORN_COMBAT_V21_PHASE_2_STAGGER_LOOP.md §4.
// Pressure meter + state banner + entry FX + Hero Detail + Squad Forecast.
// All gated defensively — missing DOM elements → no-op (graceful degradation).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 2026-05-02 — COMBAT v2.1 P2 §4.1: Pressure meter render.
// Reads global bossPressure (set by addPressure in #2.B). Tier coloring
// shifts with fill: low/mid/high. Anticipation pulse at >= 90.
export function renderPressureMeter() {
  const fill   = document.getElementById('bpFill');
  const value  = document.getElementById('bpValue');
  const wrap   = document.getElementById('bossPressureContainer');
  if (!fill || !value) return;
  const pct = Math.min(100, (bossPressure / PRESSURE_MAX) * 100);
  fill.style.width = pct + '%';
  value.textContent = bossPressure + ' / ' + PRESSURE_MAX;
  // Tier coloring
  fill.classList.toggle('bp-tier-mid',  bossPressure >= 50 && bossPressure < 90);
  fill.classList.toggle('bp-tier-high', bossPressure >= 90);
  // Anticipation pulse near full
  fill.classList.toggle('bp-anticipating', bossPressure >= 90);
  // Hide during Recovery (player is bracing — no fillable meter)
  if (wrap) {
    wrap.classList.toggle('bp-hidden', bossState === BOSS_STATE_RECOVERY);
  }
}

// 2026-05-02 — COMBAT v2.1 P2 §4.3-4.4: Boss state banner render.
// Active = hidden. Stagger = gold "⚡ STAGGER · NT". Recovery = red
// "⚠ REVENGE INCOMING NT". Updates countdown live via tickStaggerState.
export function renderBossStateBanner() {
  const el = document.getElementById('bossStateBanner');
  if (!el) return;
  el.classList.remove('bsb-active', 'bsb-stagger', 'bsb-recovery');
  switch (bossState) {
    case BOSS_STATE_STAGGER:
      el.classList.add('bsb-stagger');
      el.innerHTML = '<span class="bsb-icon">⚡</span><span>STAGGER</span>'
                   + '<span class="bsb-counter">· ' + staggerTurnsRemaining + 'T</span>';
      break;
    case BOSS_STATE_RECOVERY:
      el.classList.add('bsb-recovery');
      el.innerHTML = '<span class="bsb-icon">⚠</span><span>REVENGE INCOMING</span>'
                   + '<span class="bsb-counter">' + recoveryTurnsRemaining + 'T</span>';
      break;
    case BOSS_STATE_ACTIVE:
    default:
      // CSS handles visibility (display:none on the bare element)
      el.innerHTML = '';
      break;
  }
  // Boss portrait state classes — drives gold/red glow CSS.
  try {
    const portrait = document.getElementById('bossImgWrap');
    if (portrait) {
      portrait.classList.toggle('boss-staggered',  bossState === BOSS_STATE_STAGGER);
      portrait.classList.toggle('boss-recovering', bossState === BOSS_STATE_RECOVERY);
    }
  } catch (e) {}
}

// 2026-05-02 — COMBAT v2.1 P2 §4.3: Stagger entry FX.
// 1. Battle screen gold flash overlay (CSS ::before pseudo, 420ms)
// 2. Slow-mo throttle on transitions/animations (800ms)
// 3. Boss portrait gold pulsing border (drops on Stagger exit via render)
export function showStaggerEntryFX() {
  try {
    const battle = document.querySelector('.a-battle');
    if (battle) {
      battle.classList.add('stagger-entry-flash');
      setTimeout(() => { try { battle.classList.remove('stagger-entry-flash'); } catch (e) {} }, 420);
    }
  } catch (e) {}
  try {
    document.body.classList.add('stagger-slowmo');
    setTimeout(() => { try { document.body.classList.remove('stagger-slowmo'); } catch (e) {} }, 800);
  } catch (e) {}
}

// 2026-05-02 — COMBAT v2.1 P2 §4.4: Recovery entry FX.
// Boss portrait flips to red pulsing border (CSS class). Banner already
// renders via renderBossStateBanner. Optional ominous narrator cue.
export function showRecoveryEntryFX() {
  try { speakNarrator('warning'); } catch (e) {}
}

// 2026-05-02 — COMBAT v2.1 P2 §4.6 + §4.7: per-hero Pressure estimate.
// Used by both Hero Detail Modal and Squad Pressure Forecast.
// Approximation: role profile × tier × level scalars. Not real-time
// accurate — informative for tactical previews ("this squad will Stagger
// every X turns").
export function _estimateHeroPressureContribution(hero) {
  if (!hero) return 0;
  let baseContrib = 6;  // generic baseline
  // Striker (warrior) — line clears, decent pressure
  if (hero.role === 'striker' && hero.subRole !== 'hunter') baseContrib = 8;
  // Hunter — burst pressure (detonate procs)
  else if (hero.subRole === 'hunter' || hero.newRole === 'hunter') baseContrib = 12;
  // Mage — moderate via combos
  else if (hero.role === 'weaver' && !(hero.isCaptain || hero.captainOf || hero.newRole === 'captain')) baseContrib = 6;
  // Captain — synergy multiplier (P3 will fully wire)
  else if (hero.isCaptain || hero.captainOf || hero.newRole === 'captain') baseContrib = 10;
  // Tank — low direct, P3 adds damage→pressure
  else if (hero.role === 'guard') baseContrib = 4;
  // Tier scaling (10% per tier)
  const tier = (typeof heroUpgrades !== 'undefined' && heroUpgrades[hero.id]) || 0;
  const tierMult = 1 + (Math.min(3, tier) * 0.10);
  // Level scaling (~0.5% per level)
  const lvl = (typeof getHeroLevel === 'function') ? getHeroLevel(hero.id) : 1;
  const lvlMult = 1 + ((lvl - 1) * 0.005);
  return Math.round(baseContrib * tierMult * lvlMult);
}

// 2026-05-02 — COMBAT v2.1 P2 §4.6: Hero Detail Pressure Contribution.
// Renders into #detailPressureContrib. Called from renderHeroDetailStats
// after the Tier Mitigation Roadmap.
export function renderPressureContribution(hero) {
  const host = document.getElementById('detailPressureContrib');
  if (!host || !hero) return;
  const total = _estimateHeroPressureContribution(hero);
  const tier = (typeof heroUpgrades !== 'undefined' && heroUpgrades[hero.id]) || 0;
  const upgradeHint = (tier < 3)
    ? ('Tier upgrade (T' + tier + ' → T' + (tier + 1) + '): +10% gain')
    : 'Max tier — Mythic ascension adds new contribution path (P3+)';
  host.innerHTML =
    '<div class="ptc-header">Pressure Contribution (avg)</div>' +
    '<div class="ptc-row">' +
      '<span class="ptc-label">Per turn:</span>' +
      '<span class="ptc-value">⚡ ~' + total + '</span>' +
    '</div>' +
    '<div class="ptc-hint">' + upgradeHint + '</div>';
}

// 2026-05-02 — COMBAT v2.1 P2 §4.7: Squad Select Pressure Forecast.
// Sums per-hero estimates across active squad; computes avg turns to
// first Stagger (PRESSURE_MAX / total). "∞" when no squad / 0 total.
export function renderSquadPressureForecast() {
  const v = document.getElementById('spfValue');
  const a = document.getElementById('spfAux');
  if (!v || !a) return;
  let total = 0;
  let sources = [];
  if (typeof HERO_DECK !== 'undefined' && Array.isArray(HERO_DECK) && HERO_DECK.length > 0) {
    sources = HERO_DECK;
  } else if (typeof activeSquad !== 'undefined' && Array.isArray(activeSquad) && typeof HERO_ROSTER !== 'undefined') {
    sources = activeSquad.map(id => HERO_ROSTER.find(h => h && h.id === id)).filter(Boolean);
  }
  for (const h of sources) {
    if (!h) continue;
    total += _estimateHeroPressureContribution(h);
  }
  v.textContent = '~' + total;
  if (total > 0) {
    const turns = (PRESSURE_MAX / total).toFixed(1);
    a.textContent = '— Stagger every ~' + turns + ' turns';
  } else {
    a.textContent = '— Stagger every ∞ turns';
  }
}

// ─── Legacy interop (window exposure) ─────────────────────────────────────
// Legacy bodies still consult the state machine + Pressure meter via
// ambient identifiers (`bossState`, `bossPressure`, `addPressure`,
// `enterStaggerState`, `extendStaggerState`, `tickStaggerState`,
// `resetStaggerState`, `getFireMultCap`, `applyOverflowConversion`,
// `renderPressureMeter`, `renderBossStateBanner`, etc.). heroes.js
// (T1.10.4) and damage-channels.js (T1.10.5) keep their /* global */
// directives until T1.10.9 wire-up replaces them with explicit imports.
// Mirror the legacy window-exposure blocks so all consumer paths see the
// same module-private state + function instances.
if (typeof window !== 'undefined') {
  // PR #2.A — state machine + cap
  window.getFireMultCap        = getFireMultCap;
  window.enterStaggerState     = enterStaggerState;
  window.extendStaggerState    = extendStaggerState;
  window.enterRecoveryState    = enterRecoveryState;
  window.executeRevengeAttack  = executeRevengeAttack;
  window.enterActiveState      = enterActiveState;
  window.tickStaggerState      = tickStaggerState;
  window.resetStaggerState     = resetStaggerState;
  // PR #2.B — Pressure central
  window.addPressure           = addPressure;
  window.showPressureGainFX    = showPressureGainFX;
  // PR #2.C — Overflow conversion
  window._getPhaseGateHP            = _getPhaseGateHP;
  window.applyOverflowConversion    = applyOverflowConversion;
  window._distributeOverflowToULT   = _distributeOverflowToULT;
  window._distributeOverflowToEssence = _distributeOverflowToEssence;
  window.showOverflowRewardFX       = showOverflowRewardFX;
  // PR #2.D — UI render
  window.renderPressureMeter         = renderPressureMeter;
  window.renderBossStateBanner       = renderBossStateBanner;
  window.showStaggerEntryFX          = showStaggerEntryFX;
  window.showRecoveryEntryFX         = showRecoveryEntryFX;
  window.renderPressureContribution  = renderPressureContribution;
  window.renderSquadPressureForecast = renderSquadPressureForecast;
  window._estimateHeroPressureContribution = _estimateHeroPressureContribution;
  // PR #2.E — FTUE intros
  window._maybeTriggerPressureIntro = _maybeTriggerPressureIntro;
  window._maybeTriggerStaggerIntro  = _maybeTriggerStaggerIntro;
  window._maybeTriggerRecoveryIntro = _maybeTriggerRecoveryIntro;
  window._maybeTriggerOverflowIntro = _maybeTriggerOverflowIntro;
  // Constants — legacy bodies read these as ambient identifiers (banner
  // class toggles, Stagger-trigger threshold fallback in heroes.js, etc.).
  window.BOSS_STATE_ACTIVE   = BOSS_STATE_ACTIVE;
  window.BOSS_STATE_STAGGER  = BOSS_STATE_STAGGER;
  window.BOSS_STATE_RECOVERY = BOSS_STATE_RECOVERY;
  window.PRESSURE_MAX        = PRESSURE_MAX;
  window.PRESSURE_GAIN       = PRESSURE_GAIN;
  window.STAGGER_DURATION_TURNS  = STAGGER_DURATION_TURNS;
  window.RECOVERY_DURATION_TURNS = RECOVERY_DURATION_TURNS;
  window.STAGGER_CHAINING_ENABLED = STAGGER_CHAINING_ENABLED;
  window.FIRE_MULT_CAP_BASE  = FIRE_MULT_CAP_BASE;
  window.FIRE_MULT_CAP_TOWER = FIRE_MULT_CAP_TOWER;
  window.FIRE_MULT_ACTIVE_RATIO   = FIRE_MULT_ACTIVE_RATIO;
  window.FIRE_MULT_STAGGER_RATIO  = FIRE_MULT_STAGGER_RATIO;
  window.FIRE_MULT_RECOVERY_RATIO = FIRE_MULT_RECOVERY_RATIO;
  window.OVERFLOW_TO_ULT     = OVERFLOW_TO_ULT;
  window.OVERFLOW_TO_ESSENCE = OVERFLOW_TO_ESSENCE;
  window.OVERFLOW_PER_SHIELD = OVERFLOW_PER_SHIELD;
  window.OVERFLOW_TO_TOWER   = OVERFLOW_TO_TOWER;
  // State getters — legacy reads bare identifiers; we expose accessors
  // so consumers can also call out for the same value via a stable name
  // once T1.10.9 lands import-based wire-up.
  Object.defineProperty(window, 'bossState',              { configurable: true, get: () => bossState });
  Object.defineProperty(window, 'bossPressure',           { configurable: true, get: () => bossPressure });
  Object.defineProperty(window, 'staggerTurnsRemaining',  { configurable: true, get: () => staggerTurnsRemaining });
  Object.defineProperty(window, 'recoveryTurnsRemaining', { configurable: true, get: () => recoveryTurnsRemaining });
  Object.defineProperty(window, 'totalStaggersThisFight', { configurable: true, get: () => totalStaggersThisFight });
}

// Quiet T1.10.6 boot acknowledgement — confirms the module side-effects
// (window exposures above) ran. Matches the T1.10.1-T1.10.5 sibling pattern.
log.debug('stagger-loop (T1.10.6) module initialized');
