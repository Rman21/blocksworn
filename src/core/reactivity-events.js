// 2026-05-11 — TASK-011 (T1.10.8): v2.1 P4 Reactivity Events — phase-gate
// boss adaptations. SACRED per CLAUDE.md §2.5 + §9 glossary ("Reactivity
// Events — Phase-gate boss adaptations (v2.1 P4)").
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - BOSS_PHASES (P4 PR #4.A restructured)         lines 27361-27397
//   - battlePhasesTriggered Set                     line  27401
//   - EFFECT_HANDLERS (legacy effects-array shape)  lines 27404-27471
//   - maybePhaseTransition (legacy P4 #4.A shim)    lines 27474-27494
//   - firePhase (legacy effects-array dispatcher)   lines 27496-27538
//   - _phaseSubtitleFromEffects                     lines 27540-27550
//   - showPhaseTransitionOverlay (deprecated)       lines 27554-27561
//   - vPlayPhaseTransition + _toRoman               lines 27566-27634
//   - showBossPhaseDialog placeholder               lines 27639-27641
//   - P4 PR #4.B reactivity state + handlers        lines 27652-27889
//     (14 boss state vars + 22 REACTIVITY_HANDLERS — 10 archetypes × 2
//      gates + voidfang × 2)
//   - engineerElectrifiedRows + _phase4FrenzyAttackCounter
//                                                   lines 27892, 27897
//   - triggerReactivityEvent dispatcher             lines 27905-27931
//   - maybePhaseTransition rewrite (P4 #4.B)        lines 27941-28020
//   - _resetReactivityState                         lines 28025-28045
//   - REACTIVITY_ARCHETYPE_COLORS + _archetypeFromEventId
//                                                   lines 28084-28103
//   - showReactivityTelegraph + banner builder      lines 28109-28169
//   - showReactivityFX                              lines 28173-28187
//   - renderBossPhaseIndicator + builder            lines 28192-28233
//   - showBossIntelOverlay                          lines 28238-28277
//   - _computeSquadEffectiveDPS                     lines 28283-28302
//   - renderSquadTTKForecast                        lines 28304-28326
//   - _registerPhase4Dialogs + _phase4FtueGateOk    lines 28333-28365
//   - _maybeTriggerPhaseIntro                       lines 28367-28370
//   - _maybeTriggerReactivityIntro                  lines 28372-28375
//   - _maybeTriggerTelegraphIntro                   lines 28377-28380
//   - VOIDFANG BOSS_PHASES override + shroud        lines 30325-30390
//     (BOSS_PHASES['VOIDFANG'] = […]; _voidfangShroudActive +
//      voidfangDefeated + VOIDFANG_DEFEATED_KEY + shroudTick +
//      clearVoidfangTints + umbralShroud/gridTint EFFECT_HANDLERS)
//   - Console helpers + window bridge               lines 30021-30034
//     (window.BOSS_PHASES / window.EFFECT_HANDLERS /
//      window.maybePhaseTransition / window.forcePhase /
//      window.resetBattlePhases)
//
// SACRED per CLAUDE.md §2.5 + §9 + v2.1 P4 §1-§7:
//   - REACTIVITY_PHASE_GATES = [70, 35] (percent thresholds), aliased
//     against PHASE_GATE_P1_TO_P2 / PHASE_GATE_P2_TO_P3 from bosses.js
//     (T1.10.7).
//   - REACTIVITY_TELEGRAPH_MS = 3000 (3-second wind-up — UX commitment
//     per spec §13.3; ±200ms variance acceptable on slower devices).
//   - REACTIVITY_BANNER_DURATION_MS = 1500 (re-imported from bosses.js).
//   - 22 reactivity event handlers (10 archetypes × 2 gates +
//     tower_voidfang × 2) — per-archetype reaction parameters preserved:
//       berserker_p1_p2:        +20% dmg
//       berserker_p2_p3:        stagger immune 3T
//       armored_p1_p2:          +2 shield stacks
//       armored_p2_p3:          30% board → void_3
//       phoenix_p1_p2:          revive +20% maxHP heal
//       phoenix_p2_p3:          fire aura 3 HP/T
//       assassin_p1_p2:         stealth 1T + 1.50× next attack
//       assassin_p2_p3:         backstab chain 3T
//       bruiser_p1_p2:          1.50× next attack
//       bruiser_p2_p3:          5 random void_2 spawns
//       hypnotist_p1_p2:        dual suggest
//       hypnotist_p2_p3:        silence 2T
//       engineer_p1_p2:         4 cell lockdown 40T
//       engineer_p2_p3:         2 electrified rows
//       frenzy_p1_p2:           max stacks 8
//       frenzy_p2_p3:           maul chain every 3T
//       tempo_disruptor_p1_p2:  skip 1 player turn
//       tempo_disruptor_p2_p3:  board wipe + chargedCells.clear
//       battery_p1_p2:          +50% charge rate
//       battery_p2_p3:          40 signature damage detonate
//       tower_voidfang_p1_p2:   +30% boss attack dmg
//       tower_voidfang_p2_p3:   ×0.70 player pressure gain
//   - BOSS_PHASES table — 25 main-campaign bosses (Ch1-Ch5 × 5 each) +
//     VOIDFANG tower fallback. Standardized 70/35 thresholds per spec §3.3.
//   - Telegraph→execute pattern: showReactivityTelegraph(eventId) [3s
//     wind-up banner] → setTimeout REACTIVITY_TELEGRAPH_MS → handler() +
//     log + reactivity FTUE intro. Non-blocking — gameplay continues
//     during wind-up.
//
// OWNS (T1.10.8 territory):
//   - BOSS_PHASES table (25 bosses + VOIDFANG override).
//   - EFFECT_HANDLERS (5 + 2 = 7 entries: enrage/voidBoost/cleanse/
//     spawnBurst/healPartial/dialog + umbralShroud/gridTint).
//   - REACTIVITY_HANDLERS registry (22 entries).
//   - 14 reactivity state vars (bossShieldCount / bossStaggerImmuneTurns /
//     bossFireAuraActive / bossFireAuraDmg / bossStealthTurns /
//     bossNextAttackBonus / bossBackstabChainTurns / bossDualSuggestActive /
//     squadSilencedTurns / frenzyMaxStacks / frenzyMaulComboActive /
//     frenzyMaulInterval / skipPlayerTurnsCount / bossChargeRateMult /
//     pressureGainMult) + engineerElectrifiedRows + _phase4FrenzyAttackCounter
//     + _phase4LastReactivityFiredAt.
//   - battlePhasesTriggered Set (per-battle "BOSSNAME:thresholdPct" tracker).
//   - Dispatch: maybePhaseTransition (telegraph→execute + legacy
//     effects-array fallback), triggerReactivityEvent, firePhase,
//     _phaseSubtitleFromEffects.
//   - Cinematic: vPlayPhaseTransition (5-beat), _toRoman, showPhaseTransitionOverlay
//     (deprecated rollback path), showBossPhaseDialog placeholder.
//   - UI surfaces: showReactivityTelegraph + banner builder,
//     showReactivityFX overlay, renderBossPhaseIndicator + chip builder,
//     showBossIntelOverlay, renderSquadTTKForecast,
//     _computeSquadEffectiveDPS.
//   - FTUE intros: _registerPhase4Dialogs + _phase4FtueGateOk +
//     _maybeTriggerPhaseIntro + _maybeTriggerReactivityIntro +
//     _maybeTriggerTelegraphIntro (3 Chronicler dialogs registered).
//   - REACTIVITY_ARCHETYPE_COLORS + _archetypeFromEventId.
//   - _resetReactivityState — battle-init reset (idempotent).
//   - Voidfang shroud slice: _voidfangShroudActive + voidfangDefeated +
//     VOIDFANG_DEFEATED_KEY (new bare-string key — added to T1.10.9 shim
//     allow-list) + shroudTick + clearVoidfangTints + umbralShroud +
//     gridTint EFFECT_HANDLERS extensions.
//   - Console helpers: forcePhase (drop bossHP to pct% + trigger),
//     resetBattlePhases.
//
// DOES NOT OWN (deferred to siblings):
//   - bossAttack / maybeBossAttack / applyBossSignatureDamage — battle
//     loop dispatch (T1.10.9 battle.js territory). bossAttack reads
//     bossNextAttackBonus, frenzyMaxStacks, frenzyMaulComboActive,
//     frenzyMaulInterval, bossStealthTurns, bossBackstabChainTurns,
//     bossChargeRateMult, skipPlayerTurnsCount, bossFireAuraActive,
//     bossFireAuraDmg, engineerLockedCells (T1.10.3 grid.js Map),
//     engineerElectrifiedRow/Rows/Turns (heroes.js T1.10.4 owns engineer
//     hero state — engineer reactivity state vars LIVE HERE but the
//     attack-loop consumers are in battle.js).
//   - addPressure ordering — gates on pressureGainMult + bossStaggerImmuneTurns
//     (T1.10.6 stagger-loop owns the consumer).
//   - DIALOG_LINES voidfang chain (defeat_a..e + chapter_3_outro +
//     fin_card) — narrative voice (T1.11 dialog module territory).
//   - VOIDFANG dialog chain replay (replayVoidfangEnding console helper)
//     — narrative orchestration (T1.11 territory).
//   - logBattleEvent / logEvent / playDialog / playDialogScript —
//     services (T1.11).
//   - Ch3 archetype tick handlers (Twilight / Storm / Priestess / Root /
//     Archival) — already in T1.10.7 bosses.js.
//   - hitBoss camera shake + vPlayLineClearBurst — feel/animations (T1.09).
//
// Window-exposure bridge:
//   Mirrors the T1.10.6 / T1.10.7 pattern. Legacy bodies read the bare
//   identifiers BOSS_PHASES, EFFECT_HANDLERS, REACTIVITY_HANDLERS,
//   battlePhasesTriggered, maybePhaseTransition, triggerReactivityEvent,
//   _resetReactivityState, plus the 14 reactivity state vars +
//   engineerElectrifiedRows + UI surface functions + FTUE intros +
//   shroud state. All exposed via window getters/setters
//   (Object.defineProperty with configurable: true). T1.10.9 wire-up will
//   replace the bridge with explicit imports.
//
// Storage migration:
//   1 new bare-string key — `VOIDFANG_DEFEATED_KEY = 'blocksworn_voidfang_defeated'`
//   stored as literal '1', read with `=== '1'`. JSON-routing would break
//   the boolean semantics. **Added to T1.10.9 migration shim allow-list.**
//   All 14 reactivity state vars + battlePhasesTriggered Set are
//   per-battle ephemeral.
//
// 2026-05-11 — Roman: pure-relocation discipline. No "improvements".
// Comments above this line replicate legacy intent.

/* eslint-disable no-empty, no-unused-vars */
// Sibling-module identifiers consumed via /* global */ (T1.10.9 wires
// these up as explicit imports). All accessed defensively (typeof checks
// or try/catch) per legacy semantics.

// T1.13.1: /* global */ → ES imports for resolved src/ exports.
import {
  PHASE_GATE_P1_TO_P2,
  PHASE_GATE_P2_TO_P3,
  REACTIVITY_TELEGRAPH_MS,
  REACTIVITY_BANNER_DURATION_MS,
  BOSS_ARCHETYPES, ARCHETYPE_MATCHUP, BOSS_TTK_TARGETS, getCurrentBossPhase,
} from './bosses.js';
import { applyChannelDamage } from './damage-channels.js';
import { bossAttack } from './battle.js';
import { isFtueActive } from './ftue-state.js';
import { isHeroMythic } from './progression.js';
import { vHaptic } from '../feel/haptics.js';
import { logEvent } from '../services/analytics.js';
import { log } from '../services/logger.js';

// Feel layer (residual legacy-owned):
/* global flashText, flashStateBanner, vibrate, hitBoss,
   render, renderBossHP, updateBossHpUI */
// DOM browser globals:
/* global getComputedStyle */
// Boss state (residual legacy-owned):
/* global currentBoss, bossHP:writable, bossMaxHP, currentChapter, BOSSES */
// Grid (residual legacy-owned):
/* global grid, SIZE, chargedCells, engineerLockedCells */
// Engineer hero state (residual legacy-owned):
/* global engineerElectrifiedRow:writable, engineerElectrifiedTurns:writable */
// Stagger-loop & battle (residual legacy-owned):
/* global bossAttackDmgMult:writable, attackCountdown:writable,
   currentFloorId, _isTowerBattle, _phase5IsReactivitySuppressed,
   seenDialogs, playDialog, DIALOGS, placementCount */
// Heroes (residual legacy-owned):
/* global HERO_DECK, TIER_DAMAGE_MULT, heroUpgrades */
// Analytics (residual legacy-owned):
/* global logBattleEvent */
// LEGACY-ONLY: above tokens have no src/ export — shims retired in T1.14+ cleanup.

// Re-export the sacred phase-gate + telegraph constants so legacy bare
// identifier reads `REACTIVITY_TELEGRAPH_MS` etc continue to resolve via
// this module (in addition to the original bosses.js export site).
export { REACTIVITY_TELEGRAPH_MS, REACTIVITY_BANNER_DURATION_MS };

// 2026-05-02 — COMBAT v2.1 P4 §2 + §3.3: standardized phase gates.
// REACTIVITY_PHASE_GATES is the canonical 2-element array used by
// REACTIVITY-EVENTS dispatch: [70, 35] percent thresholds. The 0.70 /
// 0.35 fractional aliases live in bosses.js (T1.10.7) for the boss
// state-machine getCurrentBossPhase helper.
export const REACTIVITY_PHASE_GATES = Object.freeze([70, 35]);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BOSS_PHASES table (legacy 27361-27397 + 30333 VOIDFANG override)
// 25 main-campaign bosses + VOIDFANG tower fallback. Each maps to its
// archetype's two reactivity event handler keys (e.g.,
// berserker_p1_p2 + berserker_p2_p3).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 2026-05-02 — COMBAT v2.1 P4 §3.3: BOSS_PHASES restructured.
// Standardized 70%/35% thresholds replace varied 66/50/33/20. New
// `reactivity` field replaces legacy `effects` array — dispatch via
// REACTIVITY_HANDLERS (PR #4.B). Each boss maps to its archetype's two
// reactivity event templates (e.g., berserker_p1_p2 + berserker_p2_p3).
//
// Coverage: all 25 main-campaign bosses + VOIDFANG (Tower fallback).
// Ch2/Ch3 entries previously dead — now active per spec §11.4 regression
// expectation (every boss can fire phase reactivity).
//
// NOTE: legacy declares this as `const BOSS_PHASES = { ... }` then
// MUTATES `BOSS_PHASES['VOIDFANG'] = [ ... ]` at line 30333. We land the
// flat post-mutation map — byte-perfect to legacy after the VOIDFANG
// override runs.
//
// NOTE 2: legacy uses a non-frozen `const` so EFFECT_HANDLERS at line
// 30377-30390 can hot-patch `BOSS_PHASES['VOIDFANG']` and the umbralShroud
// dispatch can later. We mirror — not Object.freeze — so legacy
// assignments through the window bridge keep working until T1.10.9
// canonicalizes.
export const BOSS_PHASES = {
  // ==== Chapter 1 ====
  'PYREDRAKE':       [{ threshold: 70, reactivity: 'berserker_p1_p2' }, { threshold: 35, reactivity: 'berserker_p2_p3' }],
  'ABYSSAL TYRANT':  [{ threshold: 70, reactivity: 'armored_p1_p2'   }, { threshold: 35, reactivity: 'armored_p2_p3'   }],
  'GROVEWARDEN':     [{ threshold: 70, reactivity: 'bruiser_p1_p2'   }, { threshold: 35, reactivity: 'bruiser_p2_p3'   }],
  'SOLAR PHOENIX':   [{ threshold: 70, reactivity: 'phoenix_p1_p2'   }, { threshold: 35, reactivity: 'phoenix_p2_p3'   }],
  'CRYPT LICH':      [{ threshold: 70, reactivity: 'assassin_p1_p2'  }, { threshold: 35, reactivity: 'assassin_p2_p3'  }],
  // ==== Chapter 2 ====
  'VEROTHIRA':       [{ threshold: 70, reactivity: 'hypnotist_p1_p2'       }, { threshold: 35, reactivity: 'hypnotist_p2_p3'       }],
  'GEARHEART':       [{ threshold: 70, reactivity: 'engineer_p1_p2'        }, { threshold: 35, reactivity: 'engineer_p2_p3'        }],
  'URSARO':          [{ threshold: 70, reactivity: 'frenzy_p1_p2'          }, { threshold: 35, reactivity: 'frenzy_p2_p3'          }],
  'TIDESPIRE':       [{ threshold: 70, reactivity: 'tempo_disruptor_p1_p2' }, { threshold: 35, reactivity: 'tempo_disruptor_p2_p3' }],
  'HELIOTRON':       [{ threshold: 70, reactivity: 'battery_p1_p2'         }, { threshold: 35, reactivity: 'battery_p2_p3'         }],
  // ==== Chapter 3 (archetypes reused per spec §3.3) ====
  'TWILIGHT VESSEL': [{ threshold: 70, reactivity: 'phoenix_p1_p2'   }, { threshold: 35, reactivity: 'phoenix_p2_p3'   }],
  'STORMSHEPHERD':   [{ threshold: 70, reactivity: 'engineer_p1_p2'  }, { threshold: 35, reactivity: 'engineer_p2_p3'  }],
  'VOIDPRIESTESS':   [{ threshold: 70, reactivity: 'hypnotist_p1_p2' }, { threshold: 35, reactivity: 'hypnotist_p2_p3' }],
  'ROOT-OF-NOTHING': [{ threshold: 70, reactivity: 'bruiser_p1_p2'   }, { threshold: 35, reactivity: 'bruiser_p2_p3'   }],
  'ARCHIVAL ETERNAL':[{ threshold: 70, reactivity: 'assassin_p1_p2'  }, { threshold: 35, reactivity: 'assassin_p2_p3'  }],
  // ==== Chapter 4 (Court of the Fallen Heavens) ====
  'THE PROSECUTOR':  [{ threshold: 70, reactivity: 'phoenix_p1_p2'         }, { threshold: 35, reactivity: 'phoenix_p2_p3'         }],
  'JUSTICE BLIND':   [{ threshold: 70, reactivity: 'tempo_disruptor_p1_p2' }, { threshold: 35, reactivity: 'tempo_disruptor_p2_p3' }],
  'SUN-CROWN REGENT':[{ threshold: 70, reactivity: 'bruiser_p1_p2'         }, { threshold: 35, reactivity: 'bruiser_p2_p3'         }],
  'ECLIPSE-WALKER':  [{ threshold: 70, reactivity: 'hypnotist_p1_p2'       }, { threshold: 35, reactivity: 'hypnotist_p2_p3'       }],
  'THE FALLEN HIGHEST': [{ threshold: 70, reactivity: 'engineer_p1_p2'     }, { threshold: 35, reactivity: 'engineer_p2_p3'        }],
  // ==== Chapter 5 (When the Crown Breaks) ====
  'CROWN-OF-DUST':   [{ threshold: 70, reactivity: 'armored_p1_p2'         }, { threshold: 35, reactivity: 'armored_p2_p3'         }],
  'SHARDLORD':       [{ threshold: 70, reactivity: 'tempo_disruptor_p1_p2' }, { threshold: 35, reactivity: 'tempo_disruptor_p2_p3' }],
  'SEEDREAPER':      [{ threshold: 70, reactivity: 'bruiser_p1_p2'         }, { threshold: 35, reactivity: 'bruiser_p2_p3'         }],
  'PYREKING':        [{ threshold: 70, reactivity: 'berserker_p1_p2'       }, { threshold: 35, reactivity: 'berserker_p2_p3'       }],
  'WORLD-EATER':     [{ threshold: 70, reactivity: 'phoenix_p1_p2'         }, { threshold: 35, reactivity: 'phoenix_p2_p3'         }],
  // ==== Tower fallback ====
  // 2026-05-02 — COMBAT v2.1 P4 PR #4.A: Voidfang now uses standardized
  // 70/35 gates with `tower_voidfang_*` reactivity events (PR #4.B
  // handlers). The legacy 75/50/25 three-phase Tower-bespoke flow is
  // collapsed to 2 events per spec §3.3 (consistent gating across all
  // bosses). Grid tint / umbralShroud / dialog narrative beats are
  // deferred:
  //   - voidfang shroud dispatch handled separately by
  //     `_voidfangShroudActive` state below (still active during Tower
  //     fights)
  //   - dialog narrative removed per spec §8.3 ("no dialog filler for
  //     pacing")
  // VOIDFANG is the EXCEPTION to Tower reactivity suppression because
  // its 2 reactivity handlers (tower_voidfang_*) ARE designed for
  // Tower-end combat and are part of its competitive ritual.
  'VOIDFANG':        [{ threshold: 70, reactivity: 'tower_voidfang_p1_p2' }, { threshold: 35, reactivity: 'tower_voidfang_p2_p3' }],
};

// Per-battle tracking — Set of "BOSSNAME:thresholdPct" strings already
// fired. Cleared in startBossBattle (legacy line 55352).
export const battlePhasesTriggered = new Set();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EFFECT_HANDLERS (legacy 27404-27471 + 30377-30390 Voidfang extensions)
// Legacy effects-array dispatch. Each entry mutates boss/grid/UI state.
// Mirrored verbatim so the firePhase fallback path keeps working.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Non-frozen object — legacy adds `umbralShroud` + `gridTint` at line
// 30377-30390 (Voidfang Block 6.3 extends the handler map). We land both
// FLAT here (post-extension state) so callers reading EFFECT_HANDLERS
// see the same 7-key map regardless of load order.
export const EFFECT_HANDLERS = {
  enrage(_param) {
    if (!currentBoss) return;
    // Reduce attackInterval by 1 (clamp at 1). Mutation is safe because
    // currentBoss is a shallow-copy from getEffectiveBossStats (Trap 2).
    currentBoss.attackInterval = Math.max(1, (currentBoss.attackInterval || 5) - 1);
    // Also re-sync attackCountdown so next attack arrives sooner
    if (typeof attackCountdown !== 'undefined' && attackCountdown > currentBoss.attackInterval) {
      attackCountdown = currentBoss.attackInterval;
    }
    try { flashText('⚡ FASTER ATTACKS', currentBoss.color || '#FF4D1F'); } catch (e) {}
  },
  voidBoost(param) {
    const amount = parseInt(param, 10) || 1;
    bossAttackDmgMult = (bossAttackDmgMult || 1) + amount;
    try { flashText(`☠ VOID BOOST +${amount}`, (currentBoss && currentBoss.color) || '#FF4D1F'); } catch (e) {}
  },
  cleanse(_param) {
    // Wipe all void_* cells from grid. Used by narrative bosses who "reset" the
    // battlefield after a phase beat (Abyssal Tyrant, Leviathan, Wraith, Monarch).
    let cleared = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] && typeof grid[r][c] === 'string' && grid[r][c].startsWith('void')) {
          grid[r][c] = null;
          cleared++;
        }
      }
    }
    if (cleared > 0) {
      try { render(); } catch (e) {}
      try { flashText(`✴ VOID ERASED × ${cleared}`, '#78E09E'); } catch (e) {}
    }
  },
  spawnBurst(_param) {
    // Surprise strike — fire bossAttack immediately and reset countdown.
    // Fire-and-forget (not awaited) so the phase transition completes visually
    // without blocking the calling dealDamage frame.
    if (typeof bossAttack === 'function') {
      try { bossAttack(); } catch (e) { log.warn('spawnBurst failed:', e); }
      if (currentBoss && typeof attackCountdown !== 'undefined') {
        attackCountdown = currentBoss.attackInterval;
      }
    }
  },
  healPartial(param) {
    const pct = parseInt(param, 10) || 10;
    const amount = Math.ceil(bossMaxHP * (pct / 100));
    const newHP = Math.min(bossMaxHP, bossHP + amount);
    const actualHeal = newHP - bossHP;
    if (actualHeal <= 0) return;
    bossHP = newHP;
    try { flashText(`❤ ${currentBoss.name} HEALS +${actualHeal}`, '#78E09E'); } catch (e) {}
    // Refresh HP bar via the standard combat-renderer. The game uses `render()`
    // + updateBossHUD patterns; the next render tick after dealDamage shows the new HP.
    try { if (typeof renderBossHP === 'function') renderBossHP(); } catch (e) {}
    try { if (typeof updateBossHpUI === 'function') updateBossHpUI(); } catch (e) {}
  },
  dialog(param) {
    // Block 6.2 replaces the stub below with real DIALOG_LINES lookup.
    // V3.0 Phase 7 Block 7.1: Tower battles skip phase narrative dialogs
    // (bosses rotate per floor so mid-fight monologues break immersion).
    if (currentBoss && currentBoss._isTowerBattle) return;
    if (typeof showBossPhaseDialog === 'function') {
      try { showBossPhaseDialog(param); } catch (e) { log.warn('phase dialog failed:', e); }
    }
  },
  // ── VOIDFANG (Block 6.3 extensions, legacy 30377-30390) ─────────
  umbralShroud(_param) {
    _voidfangShroudActive = true;
    try { flashText('🌑 UMBRAL SHROUD', '#BB60FF'); } catch (e) {}
  },
  gridTint(param) {
    const level = parseInt(param, 10) || 1;
    try {
      const gridEl = document.getElementById('grid') || document.querySelector('.grid');
      if (gridEl) {
        gridEl.classList.remove('void-tint-1', 'void-tint-2', 'void-tint-3');
        gridEl.classList.add(`void-tint-${Math.min(3, Math.max(1, level))}`);
      }
    } catch (e) {}
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REACTIVITY STATE VARIABLES (legacy 27655-27669)
// 14 state vars (+ engineerElectrifiedRows + _phase4FrenzyAttackCounter
// + _phase4LastReactivityFiredAt) driven by reactivity event handlers.
// All reset on battle init via _resetReactivityState (called from existing
// reset chain alongside Phase 1/2/3 resets).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 2026-05-02 — COMBAT v2.1 P4 §5.6: boss state variables driven by reactivity events.
let bossShieldCount             = 0;     // armored — extra shield stacks (separate from player shieldCount)
let bossStaggerImmuneTurns      = 0;     // berserker p2_p3 — Pressure cap blocks Stagger trigger
let bossFireAuraActive          = false; // phoenix p2_p3 — per-turn HP tick
let bossFireAuraDmg             = 0;
let bossStealthTurns            = 0;     // assassin p1_p2 — boss invisible 1 turn
let bossNextAttackBonus         = 1.0;   // bruiser/assassin — single-shot multiplier
let bossBackstabChainTurns      = 0;     // assassin p2_p3 — 3-strike pattern
let bossDualSuggestActive       = false; // hypnotist p1_p2 — suggest 2 heroes
let squadSilencedTurns          = 0;     // hypnotist p2_p3 — block hero ULTs
let frenzyMaxStacks             = 5;     // frenzy default; p1_p2 raises to 8
let frenzyMaulComboActive       = false; // frenzy p2_p3 — forced 3-turn maul
let frenzyMaulInterval          = 0;
let skipPlayerTurnsCount        = 0;     // tempo_disruptor p1_p2 — skip N player turns
let bossChargeRateMult          = 1.0;   // battery p1_p2 — boss supercharge speedup
let pressureGainMult            = 1.0;   // voidfang p2_p3 — player pressure gain debuff
// Engineer 2-row variant — populated by engineer_p2_p3, consumed by PR #4.C.
let engineerElectrifiedRows     = [];
// 2026-05-02 — COMBAT v2.1 P4 PR #4.C §4.8: frenzy maul combo turn counter.
// Increments per bossAttack call while frenzyMaulComboActive; modulo
// frenzyMaulInterval triggers the 3-hit combo. Reset on battle init.
let _phase4FrenzyAttackCounter  = 0;
// 2026-05-02 — COMBAT v2.1 P4 §5.2: dispatcher trace.
let _phase4LastReactivityFiredAt = 0;

// State accessors — exported so other modules can read without touching
// module-locals. Mirror the T1.10.6 / T1.10.7 pattern.
export function getBossShieldCount()         { return bossShieldCount; }
export function setBossShieldCount(v)        { bossShieldCount = v; }
export function getBossStaggerImmuneTurns()  { return bossStaggerImmuneTurns; }
export function setBossStaggerImmuneTurns(v) { bossStaggerImmuneTurns = v; }
export function getBossFireAuraActive()      { return bossFireAuraActive; }
export function setBossFireAuraActive(v)     { bossFireAuraActive = v; }
export function getBossFireAuraDmg()         { return bossFireAuraDmg; }
export function setBossFireAuraDmg(v)        { bossFireAuraDmg = v; }
export function getBossStealthTurns()        { return bossStealthTurns; }
export function setBossStealthTurns(v)       { bossStealthTurns = v; }
export function getBossNextAttackBonus()     { return bossNextAttackBonus; }
export function setBossNextAttackBonus(v)    { bossNextAttackBonus = v; }
export function getBossBackstabChainTurns()  { return bossBackstabChainTurns; }
export function setBossBackstabChainTurns(v) { bossBackstabChainTurns = v; }
export function getBossDualSuggestActive()   { return bossDualSuggestActive; }
export function setBossDualSuggestActive(v)  { bossDualSuggestActive = v; }
export function getSquadSilencedTurns()      { return squadSilencedTurns; }
export function setSquadSilencedTurns(v)     { squadSilencedTurns = v; }
export function getFrenzyMaxStacks()         { return frenzyMaxStacks; }
export function setFrenzyMaxStacks(v)        { frenzyMaxStacks = v; }
export function getFrenzyMaulComboActive()   { return frenzyMaulComboActive; }
export function setFrenzyMaulComboActive(v)  { frenzyMaulComboActive = v; }
export function getFrenzyMaulInterval()      { return frenzyMaulInterval; }
export function setFrenzyMaulInterval(v)     { frenzyMaulInterval = v; }
export function getSkipPlayerTurnsCount()    { return skipPlayerTurnsCount; }
export function setSkipPlayerTurnsCount(v)   { skipPlayerTurnsCount = v; }
export function getBossChargeRateMult()      { return bossChargeRateMult; }
export function setBossChargeRateMult(v)     { bossChargeRateMult = v; }
export function getPressureGainMult()        { return pressureGainMult; }
export function setPressureGainMult(v)       { pressureGainMult = v; }
export function getEngineerElectrifiedRows() { return engineerElectrifiedRows; }
export function setEngineerElectrifiedRows(v){ engineerElectrifiedRows = v; }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REACTIVITY_HANDLERS (legacy 27676-27889)
// 22 archetype handlers — 10 archetypes × 2 gates + tower_voidfang × 2.
// Each handler is invoked once per phase-gate crossing via dispatcher.
// Banner color matches archetype palette (per spec §5.3 + §6.1 CSS).
// FX hook is a no-op until showReactivityFX wires (this module owns it
// below; legacy referenced as a guard for forward compat).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 2026-05-02 — COMBAT v2.1 P4 §5.1: reactivity event handler registry.
export const REACTIVITY_HANDLERS = {
  // ── BERSERKER (§4.1) ──────────────────────────────────────────────
  berserker_p1_p2: function() {
    bossAttackDmgMult = (typeof bossAttackDmgMult === 'number' ? bossAttackDmgMult : 1) * 1.20;
    try { flashStateBanner('ENRAGED · +20% DAMAGE', '#FF4D1F'); } catch (e) {}
    try { vibrate([100, 50, 100]); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('berserker', 'enrage'); } catch (e) {}
  },
  berserker_p2_p3: function() {
    bossStaggerImmuneTurns = 3;
    try { flashStateBanner('BERSERK · STAGGER LOCKED 3T', '#FF4D1F'); } catch (e) {}
    try { vibrate([200, 100, 200]); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('berserker', 'stagger_lock'); } catch (e) {}
  },

  // ── ARMORED (§4.2) ────────────────────────────────────────────────
  armored_p1_p2: function() {
    bossShieldCount += 2;
    try { flashStateBanner('SHIELDS UP · +2 LAYERS', '#5DA8E8'); } catch (e) {}
    try { vibrate([120, 80, 120, 80, 120]); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('armored', 'shields_up'); } catch (e) {}
  },
  armored_p2_p3: function() {
    // Convert ~30% of current grid cells to void (per spec §4.2).
    if (typeof grid === 'undefined' || typeof SIZE === 'undefined') return;
    const cells = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (v && (typeof v !== 'string' || !v.startsWith('void'))) cells.push([r, c]);
    }
    const target = Math.floor(cells.length * 0.30);
    let converted = 0;
    while (converted < target && cells.length > 0) {
      const idx = Math.floor(Math.random() * cells.length);
      const [r, c] = cells.splice(idx, 1)[0];
      grid[r][c] = 'void_3';
      converted++;
    }
    try { if (typeof render === 'function') render(); } catch (e) {}
    try { flashStateBanner('VOID CONVERSION · 30% BOARD', '#5DA8E8'); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('armored', 'void_convert'); } catch (e) {}
  },

  // ── PHOENIX (§4.3) ────────────────────────────────────────────────
  phoenix_p1_p2: function() {
    // Spec §4.3: revive (heal +20% of max HP).
    if (typeof bossMaxHP !== 'number' || typeof bossHP !== 'number') return;
    const heal = Math.floor(bossMaxHP * 0.20);
    bossHP = Math.min(bossMaxHP, bossHP + heal);
    try { flashStateBanner('PHOENIX REKINDLES · +' + heal + ' HP', '#E8B84A'); } catch (e) {}
    try { vibrate([80, 40, 80, 40, 80]); } catch (e) {}
    try { if (typeof renderBossHP === 'function') renderBossHP(); } catch (e) {}
    try { if (typeof updateBossHpUI === 'function') updateBossHpUI(); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('phoenix', 'revive'); } catch (e) {}
  },
  phoenix_p2_p3: function() {
    bossFireAuraActive = true;
    bossFireAuraDmg = 3;
    try { flashStateBanner('PHOENIX FIRE AURA · 3 HP/T', '#E8B84A'); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('phoenix', 'fire_aura'); } catch (e) {}
  },

  // ── ASSASSIN (§4.4) ───────────────────────────────────────────────
  assassin_p1_p2: function() {
    bossStealthTurns = 1;
    bossNextAttackBonus = Math.max(bossNextAttackBonus, 1.50);
    try { flashStateBanner('STEALTH · STRIKE INCOMING', '#9B59D6'); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('assassin', 'stealth'); } catch (e) {}
  },
  assassin_p2_p3: function() {
    bossBackstabChainTurns = 3;
    try { flashStateBanner('BACKSTAB CHAIN · 3 STRIKES', '#9B59D6'); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('assassin', 'chain'); } catch (e) {}
  },

  // ── BRUISER (§4.5) ────────────────────────────────────────────────
  bruiser_p1_p2: function() {
    bossNextAttackBonus = Math.max(bossNextAttackBonus, 1.50);
    try { flashStateBanner('HEAVY STRIKE · +50% DMG', '#5DCA79'); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('bruiser', 'wind_up'); } catch (e) {}
  },
  bruiser_p2_p3: function() {
    if (typeof grid === 'undefined' || typeof SIZE === 'undefined') return;
    let spawned = 0;
    const attempts = 40;
    for (let a = 0; a < attempts && spawned < 5; a++) {
      const r = Math.floor(Math.random() * SIZE);
      const c = Math.floor(Math.random() * SIZE);
      if (!grid[r][c]) { grid[r][c] = 'void_2'; spawned++; }
    }
    try { if (typeof render === 'function') render(); } catch (e) {}
    try { flashStateBanner('VOID RAIN · ' + spawned + ' CELLS SCATTER', '#5DCA79'); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('bruiser', 'void_rain'); } catch (e) {}
  },

  // ── HYPNOTIST (§4.6) ──────────────────────────────────────────────
  hypnotist_p1_p2: function() {
    bossDualSuggestActive = true;
    try { flashStateBanner('DUAL SUGGESTION · 2 HEROES', '#9B59D6'); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('hypnotist', 'dual_suggest'); } catch (e) {}
  },
  hypnotist_p2_p3: function() {
    squadSilencedTurns = 2;
    try { flashStateBanner('SILENCE · 2T NO ULTS', '#9B59D6'); } catch (e) {}
    try { vibrate([300, 150, 300]); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('hypnotist', 'silence'); } catch (e) {}
  },

  // ── ENGINEER (§4.7) ───────────────────────────────────────────────
  engineer_p1_p2: function() {
    if (typeof grid === 'undefined' || typeof SIZE === 'undefined') return;
    if (typeof engineerLockedCells === 'undefined') return;
    const cells = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (v && (typeof v !== 'string' || !v.startsWith('void'))) cells.push(r + '_' + c);
    }
    let locked = 0;
    for (let i = 0; i < 4 && cells.length > 0; i++) {
      const idx = Math.floor(Math.random() * cells.length);
      const k = cells.splice(idx, 1)[0];
      // Reuse existing engineerLockedCells Map (key → turns until unlock).
      // Use a long duration (40) as proxy for "permanent until phase end".
      try { engineerLockedCells.set(k, 40); locked++; } catch (e) {}
    }
    try { flashStateBanner('LOCKDOWN · ' + locked + ' CELLS WELDED', '#B87333'); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('engineer', 'lockdown'); } catch (e) {}
  },
  engineer_p2_p3: function() {
    // Spec §4.7 wants 2 electrified rows. Existing engineer state has single
    // engineerElectrifiedRow — PR #4.C extends to engineerElectrifiedRows array.
    // Foundation-only: pick 2 distinct rows + flag both. Consumer reads either
    // engineerElectrifiedRow (legacy) or engineerElectrifiedRows (new) per #4.C.
    if (typeof SIZE === 'undefined') return;
    const rows = [];
    while (rows.length < 2 && rows.length < SIZE) {
      const r = Math.floor(Math.random() * SIZE);
      if (!rows.includes(r)) rows.push(r);
    }
    try { engineerElectrifiedRows = rows.slice(); } catch (e) {}
    // Legacy single-row fallback so #4.B works even without #4.C wiring.
    if (typeof engineerElectrifiedRow !== 'undefined') {
      try { engineerElectrifiedRow = rows[0]; } catch (e) {}
      try { engineerElectrifiedTurns = 99; } catch (e) {}
    }
    try { flashStateBanner('ELECTRIFIED ROWS · CRITICAL MASS', '#B87333'); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('engineer', 'electrify'); } catch (e) {}
  },

  // ── FRENZY (§4.8) ─────────────────────────────────────────────────
  frenzy_p1_p2: function() {
    frenzyMaxStacks = 8;
    try { flashStateBanner('MAX FRENZY · 8 STACKS', '#FF6E28'); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('frenzy', 'max_stacks'); } catch (e) {}
  },
  frenzy_p2_p3: function() {
    frenzyMaulComboActive = true;
    frenzyMaulInterval = 3;
    try { flashStateBanner('MAUL CHAIN · EVERY 3T', '#FF6E28'); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('frenzy', 'maul'); } catch (e) {}
  },

  // ── TEMPO DISRUPTOR (§4.9) ────────────────────────────────────────
  tempo_disruptor_p1_p2: function() {
    skipPlayerTurnsCount = 1;
    try { flashStateBanner('TIME RIFT · SKIP NEXT TURN', '#78C8FF'); } catch (e) {}
    try { vibrate([400, 200, 400]); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('tempo_disruptor', 'time_rift'); } catch (e) {}
  },
  tempo_disruptor_p2_p3: function() {
    if (typeof grid === 'undefined' || typeof SIZE === 'undefined') return;
    let wiped = 0;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (v && (typeof v !== 'string' || !v.startsWith('void'))) {
        grid[r][c] = null;
        wiped++;
      }
    }
    try { if (typeof chargedCells !== 'undefined' && chargedCells.clear) chargedCells.clear(); } catch (e) {}
    try { if (typeof render === 'function') render(); } catch (e) {}
    try { flashStateBanner('BOARD RESET · ' + wiped + ' CELLS WIPED', '#78C8FF'); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('tempo_disruptor', 'reset'); } catch (e) {}
  },

  // ── BATTERY (§4.10) ───────────────────────────────────────────────
  battery_p1_p2: function() {
    bossChargeRateMult = 1.50;
    try { flashStateBanner('OVERCHARGE · +50% RATE', '#FFD75A'); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('battery', 'overcharge'); } catch (e) {}
  },
  battery_p2_p3: function() {
    try {
      if (typeof applyChannelDamage === 'function') {
        applyChannelDamage('signature', 40, { source: 'battery_detonate' });
      }
    } catch (e) { log.warn('battery detonate failed:', e); }
    try { flashStateBanner('DETONATE · 40 HP IMPACT', '#FFD75A'); } catch (e) {}
    try { vibrate([300, 100, 300, 100, 500]); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('battery', 'detonate'); } catch (e) {}
  },

  // ── VOIDFANG (Tower fallback) ─────────────────────────────────────
  tower_voidfang_p1_p2: function() {
    bossAttackDmgMult = (typeof bossAttackDmgMult === 'number' ? bossAttackDmgMult : 1) * 1.30;
    try { flashStateBanner('VOID HUNGER · +30% DAMAGE', '#444'); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('void', 'hunger'); } catch (e) {}
  },
  tower_voidfang_p2_p3: function() {
    pressureGainMult = (typeof pressureGainMult === 'number' ? pressureGainMult : 1) * 0.70;
    try { flashStateBanner('VOID DREAD · -30% PRESSURE GAIN', '#444'); } catch (e) {}
    try { if (typeof showReactivityFX === 'function') showReactivityFX('void', 'dread'); } catch (e) {}
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DISPATCH (legacy 27474-27538 firePhase shim + 27905-28020 main path)
// telegraph→execute pattern: 3-second wind-up banner → handler() + log +
// FTUE intro. Tolerates legacy effects-array shape via firePhase fallback.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 2026-05-02 — COMBAT v2.1 P4 §5.2: reactivity event dispatcher.
// Replaces firePhase's effects-array iteration with a telegraph→execute flow:
//   Step 1: showReactivityTelegraph(eventId)  // 3-second wind-up (PR #4.D wires)
//   Step 2: setTimeout REACTIVITY_TELEGRAPH_MS → handler() + log
// Telegraph is non-blocking — gameplay continues, banner overlays the screen.
export function triggerReactivityEvent(eventId) {
  const handler = REACTIVITY_HANDLERS[eventId];
  if (!handler) {
    log.warn('[Phase 4] No handler for reactivity event:', eventId);
    return;
  }
  // Step 1: telegraph wind-up (3s). PR #4.D ships the visual.
  try { if (typeof showReactivityTelegraph === 'function') showReactivityTelegraph(eventId); } catch (e) {}
  _phase4LastReactivityFiredAt = Date.now();
  // FTUE intro on first telegraph (PR #4.D wires the dialog itself).
  try { if (typeof _maybeTriggerTelegraphIntro === 'function') _maybeTriggerTelegraphIntro(); } catch (e) {}

  // Step 2: execute after telegraph window.
  setTimeout(() => {
    try { handler(); } catch (e) { log.error('[Phase 4] reactivity handler error:', eventId, e); }
    // FTUE intro on first reactivity firing (PR #4.D wires the dialog itself).
    try { if (typeof _maybeTriggerReactivityIntro === 'function') _maybeTriggerReactivityIntro(); } catch (e) {}
    // Battle-event log breadcrumb for analytics + Death Flashback log.
    try {
      if (typeof logBattleEvent === 'function') {
        const label = eventId.toUpperCase().replace(/_/g, ' ');
        logBattleEvent('reactivity', 'BOSS ADAPTS', label, '#FFD53D');
      }
    } catch (e) {}
    try { if (typeof logEvent === 'function') logEvent('boss_reactivity_fired', { eventId }); } catch (e) {}
  }, REACTIVITY_TELEGRAPH_MS);
}

// 2026-05-02 — COMBAT v2.1 P4 §5.2: maybePhaseTransition rewrite.
// Replaces legacy effects-array iteration. New shape:
//   - Iterates BOSS_PHASES[currentBoss.name] entries
//   - Skips already-fired (battlePhasesTriggered Set, existing infra)
//   - On crossing threshold: triggerReactivityEvent(phase.reactivity)
// Single-fire per call (don't double-fire if multiple gates cross same frame).
// Legacy `effects` arrays are still tolerated (firePhase shim) — covers the
// Voidfang shroud override path until #4.D audit.
export function maybePhaseTransition() {
  // FTUE lockout — preserved from legacy implementation (Block 6.1).
  if (typeof isFtueActive === 'function' && isFtueActive()) return;
  // Floor 1 (Trial) suppression — preserved. Voidfang exception preserved.
  const _isVoidfang = currentBoss && currentBoss.name === 'VOIDFANG';
  if (typeof currentFloorId !== 'undefined' && currentFloorId === 1 && !_isVoidfang) return;
  // 2026-05-02 — COMBAT v2.1 P5 PR #5.C §4.1: Tower bypass for reactivity events.
  // Tower mode = competitive sandbox (predictable, skill-focused). Phase gates
  // still get visual cinematic transition + camera shake (so the player sees
  // the boss "phasing"), but no REACTIVITY_HANDLERS dispatch. Voidfang remains
  // the EXCEPTION because its 2 reactivity handlers (tower_voidfang_*) ARE
  // designed for Tower-end combat and are part of its competitive ritual.
  // _phase5IsReactivitySuppressed handles both Tower paths (legacy
  // _isTowerBattle boolean + Phase 2 currentFloorId).
  const _suppressReactivity = (typeof _phase5IsReactivitySuppressed === 'function')
                               && _phase5IsReactivitySuppressed();
  if (_suppressReactivity) {
    // Still tick the battle-phase tracker so re-entry doesn't double-fire,
    // but skip the actual reactivity dispatch.
    if (!currentBoss || !currentBoss.name) return;
    const _phases = BOSS_PHASES[currentBoss.name];
    if (!_phases || !bossMaxHP) return;
    const _hpPct = (bossHP / bossMaxHP) * 100;
    for (const phase of _phases) {
      const key = currentBoss.name + ':' + phase.threshold;
      if (battlePhasesTriggered.has(key)) continue;
      if (_hpPct > phase.threshold) continue;
      battlePhasesTriggered.add(key);
      // Visual cinematic only — no reactivity event handler call.
      try { if (typeof hitBoss === 'function') hitBoss(true); } catch (e) {}
      try { vibrate([120, 60, 120, 60, 200]); } catch (e) {}
      try {
        const idx = _phases.indexOf(phase);
        const phaseNum = (idx >= 0 ? idx : 0) + 2;
        if (typeof vPlayPhaseTransition === 'function') vPlayPhaseTransition(phaseNum, '');
      } catch (e) {}
      try { if (typeof flashStateBanner === 'function') flashStateBanner('TOWER · PHASE GATE', '#78C8FF'); } catch (e) {}
      try { if (typeof logEvent === 'function') logEvent('boss_phase_gate_tower', { boss: currentBoss.name, threshold: phase.threshold }); } catch (e) {}
      return;
    }
    return;
  }
  if (!currentBoss || !currentBoss.name) return;
  const phases = BOSS_PHASES[currentBoss.name];
  if (!phases || phases.length === 0) return;
  if (typeof bossMaxHP !== 'number' || !bossMaxHP) return;

  const hpPct = (bossHP / bossMaxHP) * 100;
  for (const phase of phases) {
    const key = currentBoss.name + ':' + phase.threshold;
    if (battlePhasesTriggered.has(key)) continue;
    if (hpPct > phase.threshold) continue;       // not yet at threshold
    battlePhasesTriggered.add(key);

    // Camera shake + cinematic transition reused from legacy firePhase.
    try { if (typeof hitBoss === 'function') hitBoss(true); } catch (e) {}
    try { vibrate([120, 60, 120, 60, 200]); } catch (e) {}
    try {
      const idx = phases.indexOf(phase);
      const phaseNum = (idx >= 0 ? idx : 0) + 2;
      if (typeof vPlayPhaseTransition === 'function') {
        vPlayPhaseTransition(phaseNum, '');
      }
    } catch (e) { /* fallback */ }

    // FTUE intro on first phase gate crossing (PR #4.D wires the dialog).
    try { if (typeof _maybeTriggerPhaseIntro === 'function') _maybeTriggerPhaseIntro(); } catch (e) {}

    // New shape: dispatch via reactivity registry.
    if (phase.reactivity) {
      triggerReactivityEvent(phase.reactivity);
      return;   // single fire per call (spec §13.2)
    }
    // Legacy shape: fall back to firePhase (handles `effects` array).
    if (Array.isArray(phase.effects)) {
      try { firePhase(phase); } catch (e) { log.warn('[Phase 4] legacy firePhase failed:', e); }
      return;
    }
  }
}

// Legacy effects-array dispatcher — preserved as a fallback for any
// BOSS_PHASES entry that still carries the pre-P4 `effects` array (none
// exist in the current map after the P4 #4.A restructure, but the
// dispatcher remains because EFFECT_HANDLERS extensions — umbralShroud /
// gridTint — can still be referenced by future per-boss overrides).
export function firePhase(phase) {
  const color = (currentBoss && currentBoss.color) || '#FF4D1F';
  // Visual + haptic signature (consistent across all bosses so players learn the grammar)
  try { flashText(`▼ ${currentBoss.name} — PHASE SHIFT ▼`, color); } catch (e) {}
  try { vibrate([120, 60, 120, 60, 200]); } catch (e) {}
  // POLISH v1 · PHASE 6 — cinematic transition (replaces legacy one-beat flash).
  // Derive phase number from position in BOSS_PHASES array (0 → Phase II, 1 → Phase III).
  try {
    const list = (typeof BOSS_PHASES !== 'undefined' && currentBoss && BOSS_PHASES[currentBoss.name]) || [];
    const idx = list.indexOf(phase);
    const phaseNum = (idx >= 0 ? idx : 0) + 2;
    const subtitle = _phaseSubtitleFromEffects(phase.effects);
    vPlayPhaseTransition(phaseNum, subtitle);
  } catch (e) {
    // Fallback to legacy flash if anything goes wrong
    try { showPhaseTransitionOverlay(color); } catch (_e) {}
  }
  // Camera shake — reuse existing hitBoss helper for visual consistency.
  // isCombo=true gives the stronger shake intensity.
  try { if (typeof hitBoss === 'function') hitBoss(true); } catch (e) {}
  // 2026-05-02 — COMBAT v2.1 P4 PR #4.A: BOSS_PHASES entries now use a
  // `reactivity` field (e.g., 'berserker_p1_p2') instead of legacy `effects`
  // array. PR #4.B replaces this entire body with a telegraph→execute flow
  // through REACTIVITY_HANDLERS. For the #4.A↔#4.B gap, we tolerate either:
  //   - new shape (phase.reactivity): log + early-return (no-op until #4.B)
  //   - legacy shape (phase.effects):  iterate as before
  if (phase && phase.reactivity && !Array.isArray(phase.effects)) {
    try { log.debug('[Phase 4 PR #4.A] reactivity event pending #4.B handler:', phase.reactivity); } catch (e) {}
    return;
  }
  // Execute effects sequentially. Each wrapped so one failure doesn't block others.
  if (Array.isArray(phase.effects)) {
    for (const effectSpec of phase.effects) {
      const [name, param] = String(effectSpec).split(':');
      const handler = EFFECT_HANDLERS[name];
      if (handler) {
        try { handler(param); } catch (e) { log.warn('Phase effect failed:', name, e); }
      } else {
        log.warn('Unknown phase effect:', name);
      }
    }
  }
}

// POLISH v1 · PHASE 6 — subtitle derived from first recognized effect.
export function _phaseSubtitleFromEffects(effects) {
  if (!Array.isArray(effects)) return '';
  const names = effects.map(e => String(e).split(':')[0]);
  if (names.includes('enrage'))       return 'ENRAGED';
  if (names.includes('spawnBurst'))   return 'UNLEASHED';
  if (names.includes('cleanse'))      return 'PURGED';
  if (names.includes('healPartial'))  return 'REJUVENATED';
  if (names.includes('voidBoost'))    return 'CORRUPTED';
  return '';
}

// POLISH v1 · PHASE 6 — deprecated (kept for rollback). firePhase now calls
// vPlayPhaseTransition; this function is never invoked by the new path.
export function showPhaseTransitionOverlay(color) {
  const el = document.createElement('div');
  el.className = 'phase-transition-flash';
  el.style.color = color;
  document.body.appendChild(el);
  // Auto-remove after animation completes (CSS animation is 0.8s, buffer to 0.9s)
  setTimeout(() => { try { el.remove(); } catch (e) {} }, 900);
}

// POLISH v1 · PHASE 6 — 5-beat phase transition cinematic.
// @param {number} phaseNum - new phase number (2, 3, ...)
// @param {string} phaseName - optional subtitle ("ENRAGED", "UNBOUND", etc.)
export async function vPlayPhaseTransition(phaseNum, phaseName) {
  const battle = document.querySelector('.a-battle');
  const wrap = document.getElementById('bossImgWrap');
  const hpProgress = document.querySelector('.a-battle .v-battle-boss-card .v-progress');
  if (!battle || !wrap) return;

  try { vHaptic('hit'); } catch (e) {}

  // Beat 1: time freeze (500ms)
  battle.classList.add('phase-freeze');

  // Beat 2: shockwave + boss roar (запускаем внутри freeze)
  const bossRect = wrap.getBoundingClientRect();
  const cx = bossRect.left + bossRect.width / 2;
  const cy = bossRect.top + bossRect.height / 2;

  const bossElement = (typeof currentBoss !== 'undefined' && currentBoss && currentBoss.stihiya)
    ? currentBoss.stihiya : 'solar';
  const shockColor = {
    ember: '#FF5A3A', tide: '#4ADBFF', grove: '#7AEC4A',
    solar: '#FFE14A', umbra: '#C06ADF',
  }[bossElement] || '#FFD53D';

  const shock = document.createElement('div');
  shock.className = 'p-phase-shockwave';
  shock.style.left = cx + 'px';
  shock.style.top = cy + 'px';
  shock.style.setProperty('--p-shock-color', shockColor);
  document.body.appendChild(shock);
  setTimeout(() => shock.remove(), 750);

  wrap.classList.remove('phase-roar');
  void wrap.offsetWidth;
  wrap.classList.add('phase-roar');
  setTimeout(() => wrap.classList.remove('phase-roar'), 720);

  // Beat 3: HP bar pulse
  if (hpProgress) {
    hpProgress.classList.remove('phase-pulse');
    void hpProgress.offsetWidth;
    hpProgress.classList.add('phase-pulse');
    setTimeout(() => hpProgress.classList.remove('phase-pulse'), 1900);
  }

  // Unfreeze after 500ms
  setTimeout(() => battle.classList.remove('phase-freeze'), 500);

  // Beat 4: phase card (starts at 300ms for impact overlap)
  setTimeout(() => {
    const card = document.createElement('div');
    card.className = 'p-phase-card';
    const kicker = (typeof currentBoss !== 'undefined' && currentBoss && currentBoss.name) ? currentBoss.name : 'BOSS';
    card.innerHTML = `
      <div class="kicker">${kicker}</div>
      <div class="title">PHASE ${_toRoman(phaseNum)}</div>
      ${phaseName ? `<div class="subtitle">${phaseName}</div>` : ''}
    `;
    document.body.appendChild(card);
    setTimeout(() => card.remove(), 1700);
  }, 300);

  // Total duration to await before resuming gameplay
  await new Promise(r => setTimeout(r, 2000));
}

export function _toRoman(n) {
  const map = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
  return map[n] || String(n);
}

// Block 6.2 replaces this stub with real DIALOG_LINES lookup.
// Kept here so Block 6.1 is independently functional — phase transitions fire
// correctly without dialog content.
export function showBossPhaseDialog(dialogId) {
  log.debug('[phase dialog placeholder]', dialogId);
}

// 2026-05-02 — COMBAT v2.1 P4 §5.8: battle-init reactivity state reset.
// Called from existing battle-init reset chain alongside resetStaggerState
// (P2) + _resetPhase3*State (P3). Idempotent.
export function _resetReactivityState() {
  bossShieldCount             = 0;
  bossStaggerImmuneTurns      = 0;
  bossFireAuraActive          = false;
  bossFireAuraDmg             = 0;
  bossStealthTurns            = 0;
  bossNextAttackBonus         = 1.0;
  bossBackstabChainTurns      = 0;
  bossDualSuggestActive       = false;
  squadSilencedTurns          = 0;
  frenzyMaxStacks             = 5;
  frenzyMaulComboActive       = false;
  frenzyMaulInterval          = 0;
  skipPlayerTurnsCount        = 0;
  bossChargeRateMult          = 1.0;
  pressureGainMult            = 1.0;
  engineerElectrifiedRows     = [];
  _phase4LastReactivityFiredAt = 0;
  _phase4FrenzyAttackCounter   = 0;
  // battlePhasesTriggered already cleared in startBossBattle (existing infra).
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UI SURFACES + FTUE INTROS (legacy 28069-28394, P4 PR #4.D)
// Per BLOCKSWORN_COMBAT_V21_PHASE_4_BOSS_RECALC.md §6 + §7.
// 1. showReactivityTelegraph — 3-second wind-up banner with countdown
// 2. showReactivityFX — archetype-tinted screen flash on event fire
// 3. renderBossPhaseIndicator — top-right phase chip (P1/P2/P3)
// 4. showBossIntelOverlay — pre-battle 1-2s popup
// 5. renderSquadTTKForecast — squad-select TTK estimate
// 6. _computeSquadEffectiveDPS — heuristic for forecast
// 7. 3 FTUE dialogs (tut_phase_intro, tut_reactivity_intro, tut_telegraph_intro)
// 8. 3 trigger hooks (callsites declared above + maybePhaseTransition)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 2026-05-02 — COMBAT v2.1 P4 §5.3: archetype color palette for telegraph
// banner border + reactivity FX tint.
export const REACTIVITY_ARCHETYPE_COLORS = Object.freeze({
  berserker:       '#FF4D1F',
  armored:         '#5DA8E8',
  phoenix:         '#E8B84A',
  assassin:        '#9B59D6',
  bruiser:         '#5DCA79',
  hypnotist:       '#9B59D6',
  engineer:        '#B87333',
  frenzy:          '#FF6E28',
  tempo_disruptor: '#78C8FF',
  battery:         '#FFD75A',
  void:            '#444',
  tower_voidfang:  '#444',
});

export function _archetypeFromEventId(eventId) {
  if (!eventId) return 'void';
  const m = String(eventId).match(/^([a-z_]+?)_p[12]_p[23]$/);
  return m ? m[1] : 'void';
}

// 2026-05-02 — COMBAT v2.1 P4 §5.3 + §6.1: 3-second wind-up telegraph banner.
// Lazily-built DOM. Visible top-center of viewport. Counts down 3 → 2 → 1 → !
// then fires the handler (orchestrated by triggerReactivityEvent in PR #4.B).
// Non-blocking — gameplay continues during the wind-up.
let _phase4TelegraphTimer = null;
function _ensureReactivityTelegraphBanner() {
  if (typeof document === 'undefined') return null;
  let banner = document.getElementById('reactivityTelegraphBanner');
  if (banner) return banner;
  banner = document.createElement('div');
  banner.id = 'reactivityTelegraphBanner';
  banner.className = 'reactivity-telegraph-banner';
  banner.style.cssText = 'display:none;position:fixed;top:18%;left:50%;transform:translateX(-50%);' +
                         'background:linear-gradient(135deg,rgba(255,77,31,0.92),rgba(255,140,0,0.92));' +
                         'border:2px solid #FFD53D;padding:14px 26px;border-radius:8px;' +
                         'font-size:1.2em;font-weight:bold;letter-spacing:0.05em;color:#fff;' +
                         'box-shadow:0 0 32px rgba(255,213,61,0.6);z-index:9400;' +
                         'pointer-events:none;font-family:inherit;';
  banner.innerHTML = '<span class="rtb-icon" style="margin-right:8px;">⚠</span>' +
                     '<span class="rtb-label">BOSS ADAPTING</span>' +
                     '<span class="rtb-countdown" id="rtbCountdown" style="margin-left:12px;color:#FFD700;font-variant-numeric:tabular-nums;">3</span>';
  document.body.appendChild(banner);
  // Add pulse animation via injected style (idempotent guard).
  if (!document.getElementById('phase4TelegraphStyle')) {
    const s = document.createElement('style');
    s.id = 'phase4TelegraphStyle';
    s.textContent =
      '@keyframes rtb-pulse { from { transform: translateX(-50%) scale(1); } to { transform: translateX(-50%) scale(1.05); } }' +
      '.reactivity-telegraph-banner { animation: rtb-pulse 0.5s ease-in-out infinite alternate; }' +
      '.rtb-firing { animation: rtb-fire 0.6s ease-out forwards !important; }' +
      '@keyframes rtb-fire { 0% { transform: translateX(-50%) scale(1); opacity: 1; } ' +
      '50% { transform: translateX(-50%) scale(1.5); opacity: 1; box-shadow: 0 0 80px #FFD53D; } ' +
      '100% { transform: translateX(-50%) scale(2); opacity: 0; } }';
    document.head.appendChild(s);
  }
  return banner;
}

export function showReactivityTelegraph(eventId) {
  if (typeof document === 'undefined') return;
  const banner = _ensureReactivityTelegraphBanner();
  if (!banner) return;
  // Tint border by archetype.
  const archetype = _archetypeFromEventId(eventId);
  const color = REACTIVITY_ARCHETYPE_COLORS[archetype] || '#FFD53D';
  banner.style.borderColor = color;
  banner.style.boxShadow = '0 0 32px ' + color + '99';
  banner.classList.remove('rtb-firing');
  banner.style.display = 'block';

  let secs = 3;
  const cdEl = banner.querySelector('#rtbCountdown');
  if (cdEl) cdEl.textContent = secs;
  if (_phase4TelegraphTimer) clearInterval(_phase4TelegraphTimer);
  _phase4TelegraphTimer = setInterval(() => {
    secs--;
    if (cdEl) cdEl.textContent = secs > 0 ? secs : '!';
    if (secs <= 0) {
      clearInterval(_phase4TelegraphTimer);
      _phase4TelegraphTimer = null;
      banner.classList.add('rtb-firing');
      setTimeout(() => { banner.style.display = 'none'; banner.classList.remove('rtb-firing'); }, REACTIVITY_BANNER_DURATION_MS);
    }
  }, 1000);
}

// 2026-05-02 — COMBAT v2.1 P4 §5.3 + §6.1: archetype-tinted screen flash.
// Brief 500ms screen overlay when handler fires (after telegraph completes).
export function showReactivityFX(archetype, _eventType) {
  if (typeof document === 'undefined') return;
  const color = REACTIVITY_ARCHETYPE_COLORS[archetype] || '#FFD53D';
  let overlay = document.getElementById('reactivityFxOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'reactivityFxOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9200;' +
                            'opacity:0;transition:opacity 200ms ease-out;mix-blend-mode:screen;';
    document.body.appendChild(overlay);
  }
  overlay.style.background = 'radial-gradient(circle at center, ' + color + '55 0%, transparent 70%)';
  overlay.style.opacity = '0.85';
  setTimeout(() => { overlay.style.opacity = '0'; }, 320);
}

// 2026-05-02 — COMBAT v2.1 P4 §6.2: phase indicator chip on boss portrait.
// Top-right of boss image wrap. Updates on every render tick. Phases driven
// by getCurrentBossPhase (PR #4.A foundation — bosses.js T1.10.7).
function _ensureBossPhaseIndicator() {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById('bossPhaseIndicator');
  if (el) return el;
  const wrap = document.getElementById('bossImgWrap');
  if (!wrap) return null;
  el = document.createElement('div');
  el.id = 'bossPhaseIndicator';
  el.style.cssText = 'position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.7);' +
                     'border:1px solid #FFD53D;padding:3px 8px;border-radius:6px;' +
                     'font-size:10px;letter-spacing:0.10em;font-weight:700;' +
                     'color:#5DCA79;pointer-events:none;z-index:5;font-family:inherit;';
  el.innerHTML = '<span class="bpi-icon" style="margin-right:4px;">▰▱▱</span><span class="bpi-text">PHASE 1</span>';
  // Ensure parent positioned (legacy bossImgWrap may not have explicit position).
  const cs = (typeof getComputedStyle === 'function') ? getComputedStyle(wrap) : null;
  if (cs && cs.position === 'static') wrap.style.position = 'relative';
  wrap.appendChild(el);
  return el;
}

export function renderBossPhaseIndicator() {
  const el = _ensureBossPhaseIndicator();
  if (!el) return;
  if (typeof currentBoss === 'undefined' || !currentBoss || typeof bossHP !== 'number' || bossHP <= 0) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'block';
  const phase = (typeof getCurrentBossPhase === 'function') ? getCurrentBossPhase() : 'p1';
  const visuals = {
    p1: { icon: '▰▱▱', text: 'PHASE 1', color: '#5DCA79' },
    p2: { icon: '▰▰▱', text: 'PHASE 2', color: '#FFD53D' },
    p3: { icon: '▰▰▰', text: 'PHASE 3', color: '#FF4D1F' },
  };
  const v = visuals[phase] || visuals.p1;
  const iconEl = el.querySelector('.bpi-icon');
  const textEl = el.querySelector('.bpi-text');
  if (iconEl) iconEl.textContent = v.icon;
  if (textEl) textEl.textContent = v.text;
  el.style.color = v.color;
  el.style.borderColor = v.color;
}

// 2026-05-02 — COMBAT v2.1 P4 §6.3: pre-battle boss intel overlay.
// Shown for ~3 seconds at battle start. Reads boss data: archetype + matchup
// + reactivities + roleTier. Reactivity event labels derived from BOSS_PHASES.
export function showBossIntelOverlay(boss) {
  if (typeof document === 'undefined' || !boss) return;
  // Skip for FTUE / training dummy / Tower (no reactivity narrative there).
  if (boss._isFtueOnly || boss._isTrainingDummy) return;
  if (boss._isTowerBattle) return;
  // Lazy build.
  let overlay = document.getElementById('bossIntelOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'bossIntelOverlay';
    overlay.style.cssText = 'position:fixed;top:18%;left:50%;transform:translateX(-50%);' +
                            'background:linear-gradient(180deg,rgba(26,24,48,0.96),rgba(13,12,26,0.96));' +
                            'border:2px solid #FFD53D;border-radius:12px;padding:16px 22px;max-width:420px;' +
                            'color:#fff;font-family:inherit;font-size:12px;line-height:1.5;' +
                            'box-shadow:0 0 32px rgba(255,213,61,0.4);z-index:9300;pointer-events:none;' +
                            'opacity:0;transition:opacity 300ms ease-out;';
    document.body.appendChild(overlay);
  }
  const archetypeData = (typeof BOSS_ARCHETYPES !== 'undefined') ? BOSS_ARCHETYPES[boss.archetype] : null;
  const matchupData = (typeof ARCHETYPE_MATCHUP !== 'undefined') ? ARCHETYPE_MATCHUP[boss.archetype] : null;
  const phases = (typeof BOSS_PHASES !== 'undefined') ? BOSS_PHASES[boss.name] : null;
  const ttkSec = (typeof BOSS_TTK_TARGETS !== 'undefined' && boss.roleTier) ? (BOSS_TTK_TARGETS[boss.roleTier] || 360) : 360;
  const ttkMin = (ttkSec / 60).toFixed(1);
  const fmtReact = (eid) => eid ? eid.toUpperCase().replace(/_/g, ' ').replace(/^([A-Z_ ]+) P\d P\d$/i, '$1') : '—';
  const r1 = (phases && phases[0]) ? fmtReact(phases[0].reactivity) : '—';
  const r2 = (phases && phases[1]) ? fmtReact(phases[1].reactivity) : '—';
  overlay.innerHTML =
    '<div style="font-size:14px;font-weight:700;color:#FFD53D;letter-spacing:0.08em;margin-bottom:8px;">⚔ ' + (boss.name || '—') + '</div>' +
    '<div style="opacity:0.85;margin-bottom:3px;">Archetype: <b>' + ((archetypeData && archetypeData.label) || (boss.archetype || '—').toUpperCase()) + '</b></div>' +
    '<div style="opacity:0.85;margin-bottom:3px;">Role tier: <b>' + ((boss.roleTier || 'gatekeeper').toUpperCase()) + '</b> (TTK ' + ttkMin + ' min)</div>' +
    (matchupData ? ('<div style="opacity:0.85;margin-bottom:3px;">Strong vs: <b style="color:#5DCA79;">' + (matchupData.strong || []).join(', ').toUpperCase() + '</b></div>' +
                    '<div style="opacity:0.85;margin-bottom:3px;">Weak vs: <b style="color:#FF4D1F;">' + (matchupData.weak || []).join(', ').toUpperCase() + '</b></div>') : '') +
    '<div style="margin-top:6px;color:#FFD53D;font-size:11px;">P2 Adapt: <b>' + r1 + '</b></div>' +
    '<div style="color:#FFD53D;font-size:11px;">P3 Adapt: <b>' + r2 + '</b></div>';
  overlay.style.display = 'block';
  // Fade in after a tick (so transition fires).
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });
  setTimeout(() => { overlay.style.opacity = '0'; }, 2700);
  setTimeout(() => { overlay.style.display = 'none'; }, 3300);
}

// 2026-05-02 — COMBAT v2.1 P4 §6.4: squad TTK forecast.
// Heuristic: sum per-hero baseline DPS × tier multiplier × stagger boost factor.
// Used in Squad Select header to show estimated time-to-kill against current
// boss preview. Approximate — calibration loop runs in P5 telemetry.
export function _computeSquadEffectiveDPS() {
  if (typeof HERO_DECK === 'undefined' || !Array.isArray(HERO_DECK)) return 100;
  let base = 0;
  const T = (typeof TIER_DAMAGE_MULT !== 'undefined') ? TIER_DAMAGE_MULT : null;
  for (const h of HERO_DECK) {
    if (!h) continue;
    let tierKey = 'T0';
    const tier = (typeof heroUpgrades !== 'undefined' && heroUpgrades[h.id]) || 0;
    if (typeof isHeroMythic === 'function' && isHeroMythic(h.id)) tierKey = 'Mythic';
    else if (tier >= 3) tierKey = 'T3';
    else if (tier >= 2) tierKey = 'T2';
    else if (tier >= 1) tierKey = 'T1';
    const mult = (T && T[tierKey]) ? T[tierKey] : 1.0;
    base += 20 * mult;   // 20 = baseline per-hero DPS heuristic
  }
  // Stagger boost factor — assume ~1 stagger per minute boosting 1.5×
  // (Phase 2 STAGGER cap × Phase 3 tier curve composes here).
  const staggerBoost = 1.5;
  return Math.max(1, Math.round(base * staggerBoost));
}

export function renderSquadTTKForecast(targetBoss) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('squadTTKForecast');
  if (!el) {
    // Lazy mount near squad mit header (existing #squadMitValue host).
    const host = document.getElementById('squadMitValue') || document.body;
    el = document.createElement('div');
    el.id = 'squadTTKForecast';
    el.style.cssText = 'margin-top:6px;font-size:11px;letter-spacing:0.05em;' +
                       'color:#FFD53D;opacity:0.85;font-family:inherit;';
    if (host.parentNode) host.parentNode.appendChild(el); else document.body.appendChild(el);
  }
  // Resolve target boss: explicit param, currentBoss, or current chapter's first.
  let boss = targetBoss;
  if (!boss && typeof currentBoss !== 'undefined') boss = currentBoss;
  if (!boss && typeof BOSSES !== 'undefined' && BOSSES.length > 0) boss = BOSSES[0];
  if (!boss || !boss.hp) { el.style.display = 'none'; return; }
  const dps = _computeSquadEffectiveDPS();
  const ttkSec = boss.hp / dps;
  const ttkMin = (ttkSec / 60).toFixed(1);
  el.style.display = 'block';
  el.innerHTML = '<span style="margin-right:4px;">⏱</span>EST. TTK vs <b>' + (boss.name || '—') + '</b>: ~' + ttkMin + ' min';
}

// 2026-05-02 — COMBAT v2.1 P4 §7: 3 FTUE dialogs registered + trigger gates.
// Dialogs use shared chronicler portrait + Phase 1/2/3 trigger convention
// (seenDialogs + Ch1 + !isFtueActive). Triggers are called from PR #4.B
// triggerReactivityEvent (telegraph + reactivity intros) and from
// maybePhaseTransition (phase intro).
export function _registerPhase4Dialogs() {
  try {
    if (typeof DIALOGS === 'undefined' || !DIALOGS) return;
    const phase4 = {
      tut_phase_intro: {
        speaker: 'THE CHRONICLER', speakerColor: '#FFD53D', portraitKey: 'hero_chronicler',
        text: 'Bosses fight in three phases. At 70% and 35% HP, the boss ADAPTS — changes its attack pattern. Watch the telegraph (3 seconds). Plan your response.',
      },
      tut_reactivity_intro: {
        speaker: 'THE CHRONICLER', speakerColor: '#FF4D1F', portraitKey: 'hero_chronicler',
        text: "ADAPTATION! The boss just gained a new ability. This is not damage you missed — this is the boss responding to pressure. Adjust your strategy.",
      },
      tut_telegraph_intro: {
        speaker: 'THE CHRONICLER', speakerColor: '#FFD53D', portraitKey: 'hero_chronicler',
        text: 'Three seconds of warning before any major boss adaptation. Use this time to position cells, ready ULTs, or absorb shields. Combat is fair — you always know what is coming.',
      },
    };
    for (const [id, def] of Object.entries(phase4)) {
      if (!DIALOGS[id]) DIALOGS[id] = def;
    }
  } catch (e) { log.warn('[P4 dialog reg] failed:', e); }
}
try { if (typeof setTimeout === 'function') setTimeout(_registerPhase4Dialogs, 0); } catch (e) {}

function _phase4FtueGateOk(dialogId) {
  try {
    if (typeof seenDialogs === 'undefined' || !seenDialogs) return false;
    if (seenDialogs.has(dialogId)) return false;
    if (typeof isFtueActive === 'function' && isFtueActive()) return false;
    if (typeof currentChapter !== 'undefined' && currentChapter !== 1) return false;
    return true;
  } catch (e) { return false; }
}

export function _maybeTriggerPhaseIntro() {
  if (!_phase4FtueGateOk('tut_phase_intro')) return;
  setTimeout(() => { try { if (typeof playDialog === 'function') playDialog('tut_phase_intro'); } catch (e) {} }, 600);
}

export function _maybeTriggerReactivityIntro() {
  if (!_phase4FtueGateOk('tut_reactivity_intro')) return;
  setTimeout(() => { try { if (typeof playDialog === 'function') playDialog('tut_reactivity_intro'); } catch (e) {} }, 800);
}

export function _maybeTriggerTelegraphIntro() {
  if (!_phase4FtueGateOk('tut_telegraph_intro')) return;
  setTimeout(() => { try { if (typeof playDialog === 'function') playDialog('tut_telegraph_intro'); } catch (e) {} }, 400);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VOIDFANG SHROUD SLICE (legacy 30338-30374, Block 6.3)
// Voidfang-specific persistent state + per-turn shroud tick. The Voidfang
// dialog narrative chain (defeat_a..e + chapter_3_outro + fin_card) lives
// in legacy until T1.11 dialog module — only the REACTIVITY shroud slice
// moves here.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ========= Shroud state =========
let _voidfangShroudActive = false;
let voidfangDefeated = false;
// 2026-05-11 — NEW bare-string storage key. Stored as literal '1', read
// with `=== '1'`. JSON-routing breaks the boolean semantics. **Added to
// T1.10.9 migration shim allow-list** (alongside FTUE_STORAGE_KEY,
// seenIntroVideo, onboardingSeen, blocksworn_chapter_*_complete).
export const VOIDFANG_DEFEATED_KEY = 'blocksworn_voidfang_defeated';

try {
  voidfangDefeated = localStorage.getItem(VOIDFANG_DEFEATED_KEY) === '1';
} catch (e) { voidfangDefeated = false; }

// Module-public getters/setters so legacy callers reading bare names
// continue to resolve via the window bridge below.
export function get_voidfangShroudActive()  { return _voidfangShroudActive; }
export function set_voidfangShroudActive(v) { _voidfangShroudActive = v; }
export function getVoidfangDefeated()       { return voidfangDefeated; }
export function setVoidfangDefeated(v)      { voidfangDefeated = v; }

// Per-turn shroud tick — adds 1 random void cell per player-turn start.
// Hook site: newPieces() (called when tray exhausts and refills = turn boundary).
export function shroudTick() {
  if (!_voidfangShroudActive) return;
  const empties = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === null) empties.push([r, c]);
    }
  }
  if (empties.length === 0) return;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  // Use same void cell format as bossAttack ('void_' + stihiya) so cleanse handler catches it
  const voidKey = (currentBoss && currentBoss.stihiya) ? `void_${currentBoss.stihiya}` : 'void_umbra';
  grid[r][c] = voidKey;
  try { render(); } catch (e) {}
  try { flashText('✴ shroud', '#BB60FF'); } catch (e) {}
}

// Clears visual tints + resets shroud flag. Called on battle-start, battle-end,
// and menu returns (belt-and-suspenders — ensures no tint leaks across battles).
export function clearVoidfangTints() {
  _voidfangShroudActive = false;
  try {
    const gridEl = document.getElementById('grid') || document.querySelector('.grid');
    if (gridEl) gridEl.classList.remove('void-tint-1', 'void-tint-2', 'void-tint-3');
  } catch (e) {}
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSOLE HELPERS (legacy 30021-30034)
// forcePhase (drop bossHP + trigger), resetBattlePhases.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function forcePhase(pct) {
  // Drops bossHP to pct% and triggers maybePhaseTransition.
  // Visually doesn't redraw HP bar unless a render tick happens; fire dealDamage(0)
  // afterwards to force refresh if needed.
  if (!bossMaxHP) { log.warn('forcePhase: no bossMaxHP (not in battle?)'); return; }
  bossHP = Math.floor(bossMaxHP * (pct / 100));
  maybePhaseTransition();
}

export function resetBattlePhases() {
  battlePhasesTriggered.clear();
  log.debug('Phase tracker cleared.');
}

// ─── Legacy interop (window exposure) ─────────────────────────────────────
// Legacy bodies still consult reactivity state, dispatcher, UI surfaces,
// FTUE intros, and Voidfang shroud helpers via ambient identifiers.
// Mirror the T1.10.6 / T1.10.7 pattern. T1.10.9 wire-up replaces these
// with explicit imports.
if (typeof window !== 'undefined') {
  // ===== BOSS_PHASES table + EFFECT_HANDLERS + REACTIVITY_HANDLERS =====
  window.BOSS_PHASES                  = BOSS_PHASES;
  window.EFFECT_HANDLERS              = EFFECT_HANDLERS;
  window.REACTIVITY_HANDLERS          = REACTIVITY_HANDLERS;
  window.REACTIVITY_ARCHETYPE_COLORS  = REACTIVITY_ARCHETYPE_COLORS;
  window.REACTIVITY_PHASE_GATES       = REACTIVITY_PHASE_GATES;
  window.battlePhasesTriggered        = battlePhasesTriggered;
  // ===== Dispatch =====
  window.maybePhaseTransition         = maybePhaseTransition;
  window.triggerReactivityEvent       = triggerReactivityEvent;
  window.firePhase                    = firePhase;
  window._phaseSubtitleFromEffects    = _phaseSubtitleFromEffects;
  window._resetReactivityState        = _resetReactivityState;
  window._archetypeFromEventId        = _archetypeFromEventId;
  // ===== Cinematic =====
  window.vPlayPhaseTransition         = vPlayPhaseTransition;
  window._toRoman                     = _toRoman;
  window.showPhaseTransitionOverlay   = showPhaseTransitionOverlay;
  window.showBossPhaseDialog          = showBossPhaseDialog;
  // ===== UI surfaces =====
  window.showReactivityTelegraph      = showReactivityTelegraph;
  window.showReactivityFX             = showReactivityFX;
  window.renderBossPhaseIndicator     = renderBossPhaseIndicator;
  window.showBossIntelOverlay         = showBossIntelOverlay;
  window.renderSquadTTKForecast       = renderSquadTTKForecast;
  window._computeSquadEffectiveDPS    = _computeSquadEffectiveDPS;
  // ===== FTUE intros =====
  window._registerPhase4Dialogs       = _registerPhase4Dialogs;
  window._maybeTriggerPhaseIntro      = _maybeTriggerPhaseIntro;
  window._maybeTriggerReactivityIntro = _maybeTriggerReactivityIntro;
  window._maybeTriggerTelegraphIntro  = _maybeTriggerTelegraphIntro;
  // ===== Reactivity state vars (getters + setters via Object.defineProperty) =====
  Object.defineProperty(window, 'bossShieldCount',         { configurable: true, get: () => bossShieldCount,         set: v => { bossShieldCount = v; } });
  Object.defineProperty(window, 'bossStaggerImmuneTurns',  { configurable: true, get: () => bossStaggerImmuneTurns,  set: v => { bossStaggerImmuneTurns = v; } });
  Object.defineProperty(window, 'bossFireAuraActive',      { configurable: true, get: () => bossFireAuraActive,      set: v => { bossFireAuraActive = v; } });
  Object.defineProperty(window, 'bossFireAuraDmg',         { configurable: true, get: () => bossFireAuraDmg,         set: v => { bossFireAuraDmg = v; } });
  Object.defineProperty(window, 'bossStealthTurns',        { configurable: true, get: () => bossStealthTurns,        set: v => { bossStealthTurns = v; } });
  Object.defineProperty(window, 'bossNextAttackBonus',     { configurable: true, get: () => bossNextAttackBonus,     set: v => { bossNextAttackBonus = v; } });
  Object.defineProperty(window, 'bossBackstabChainTurns',  { configurable: true, get: () => bossBackstabChainTurns,  set: v => { bossBackstabChainTurns = v; } });
  Object.defineProperty(window, 'bossDualSuggestActive',   { configurable: true, get: () => bossDualSuggestActive,   set: v => { bossDualSuggestActive = v; } });
  Object.defineProperty(window, 'squadSilencedTurns',      { configurable: true, get: () => squadSilencedTurns,      set: v => { squadSilencedTurns = v; } });
  Object.defineProperty(window, 'frenzyMaxStacks',         { configurable: true, get: () => frenzyMaxStacks,         set: v => { frenzyMaxStacks = v; } });
  Object.defineProperty(window, 'frenzyMaulComboActive',   { configurable: true, get: () => frenzyMaulComboActive,   set: v => { frenzyMaulComboActive = v; } });
  Object.defineProperty(window, 'frenzyMaulInterval',      { configurable: true, get: () => frenzyMaulInterval,      set: v => { frenzyMaulInterval = v; } });
  Object.defineProperty(window, 'skipPlayerTurnsCount',    { configurable: true, get: () => skipPlayerTurnsCount,    set: v => { skipPlayerTurnsCount = v; } });
  Object.defineProperty(window, 'bossChargeRateMult',      { configurable: true, get: () => bossChargeRateMult,      set: v => { bossChargeRateMult = v; } });
  Object.defineProperty(window, 'pressureGainMult',        { configurable: true, get: () => pressureGainMult,        set: v => { pressureGainMult = v; } });
  Object.defineProperty(window, 'engineerElectrifiedRows', { configurable: true, get: () => engineerElectrifiedRows, set: v => { engineerElectrifiedRows = v; } });
  Object.defineProperty(window, '_phase4FrenzyAttackCounter', { configurable: true, get: () => _phase4FrenzyAttackCounter, set: v => { _phase4FrenzyAttackCounter = v; } });
  Object.defineProperty(window, '_phase4LastReactivityFiredAt', { configurable: true, get: () => _phase4LastReactivityFiredAt, set: v => { _phase4LastReactivityFiredAt = v; } });
  // ===== Voidfang shroud slice =====
  Object.defineProperty(window, '_voidfangShroudActive',   { configurable: true, get: () => _voidfangShroudActive,   set: v => { _voidfangShroudActive = v; } });
  // Legacy line 30457 exposes `voidfangDefeated` as a FUNCTION (not the raw
  // boolean). We mirror the function shape so any legacy caller calling
  // `voidfangDefeated()` keeps working AND any caller reading the variable
  // via `getVoidfangDefeated()` resolves through the module's getter.
  window.voidfangDefeated             = () => voidfangDefeated;
  window.VOIDFANG_DEFEATED_KEY        = VOIDFANG_DEFEATED_KEY;
  window.shroudTick                   = shroudTick;
  window.clearVoidfangTints           = clearVoidfangTints;
  // ===== Console helpers =====
  window.forcePhase                   = forcePhase;
  window.resetBattlePhases            = resetBattlePhases;
}

// Quiet T1.10.8 boot acknowledgement — confirms the module side-effects
// (window exposures above) ran. Matches the T1.10.1-T1.10.7 sibling pattern.
log.debug('reactivity-events (T1.10.8) module initialized');
