// 2026-05-11 — TASK-012 (T1.11): battle-screen UI + archetype tick handlers
// relocated from legacy. This module ALSO lands the T1.10.7 deferral: the
// per-archetype tick handlers were carved out of the bosses/battle extraction
// because they're FX/DOM-coupled (read/write specific DOM elements like
// `.boss-overlay`, `.boss-aura`, `.cell[data-row][data-col]`, etc.).
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - tickChapter2Archetype()          line 41156-41212   (Ch1-Ch5 archetype dispatcher)
//   - tickChapter3Boss()               line 40893-41138   (Ch3 boss state machine — 246 LoC)
//   - _tickPyredrake() + helpers       line 41250-41347   (Ch1 boss-specific Cinderblast — 98 LoC)
//   - _tickAbyssalTyrant() + helpers   line 41372-41642   (Ch1 boss-specific Row/Crush/Maelstrom — 271 LoC)
//   - _tickGrovewarden() + helpers     line 41643-41834   (Ch1 boss-specific Root Bind — 192 LoC)
//   - _tickSolarPhoenix()              line 41835-41869   (Ch1 boss-specific Solar Flare — 35 LoC)
//   - _tickCryptLich() + helpers       line 42072-42231   (Ch1 boss-specific Necropulse — 160 LoC)
//   - _tickHypnotist() + helpers       line 42268-42393   (Ch2 archetype — Tendril Coil + Bloom Corrupt)
//   - _tickEngineer() + helpers        line 42394-42528   (Ch2 archetype — Critical Mass + electrify)
//   - _tickFrenzy() + _frenzyDevour() +
//     _renderFrenzyVisuals()           line 42529-42633   (Ch2 archetype — Pack Hunt + Devour)
//   - _tickTempo()                     line 42634-42683   (Ch2 archetype — Tempo Disruption)
//   - _tickBattery()                   line 42684-42727   (Ch2 archetype — Battery Charge)
//   - Ch3 archetype ticks
//     (_tickSoulDrinker / _tickStormcaller / _tickConfessionReader /
//      _tickWither / _tickSealer)     line 42879-42914   (small banner-only ticks)
//   - Ch4 archetype ticks
//     (_tickPhaseShifter / _tickEqualizer / _tickRegent /
//      _tickPhaseReverser / _tickRoyalPhase)
//                                     line 42916-42962   (banner + face shift ticks)
//   - Ch5 archetype ticks
//     (_tickEternal / _tickInevitable / _tickCoOp /
//      _tickDevourer / _tickChoice)   line 42963-43045   (banner + state ticks)
//   - _stormApplyBlizzardFreeze /
//     _stormApplyEarthquakeLock       line 40799-40829   (Storm/Stormshepherd helpers)
//
// SCOPE NOTE — T1.10 deferral landing:
// The original T1.10 plan deferred per-archetype tick handlers because they
// touch specific DOM elements (e.g., `.cell[data-row][data-col]` for
// Cinderblast warn cells, `.boss-aura-light/-dark/-both` for Ch3 dual states,
// `.hero-card--crush-spire` for Abyssal hero pin). Co-locating with battle
// UI matches the FX/DOM coupling. The handlers depend heavily on combat
// state (currentBoss / bossHP / bossMaxHP / hp / shieldCount / battleDamageTaken
// / gameEnded / grid / SIZE) and on legacy FX helpers (flashText /
// flashStateBanner / vibrate / showThreatBanner / hideThreatBanner /
// renderHP / render / showDefeatModal). Those resolve via /* global */ in
// T1.11; T1.12 will wire them through src/core/battle.js + src/feel/ imports.
//
// INLINING POLICY — pragmatic, per T1.11 brief:
//   - Inlined here: small Ch3/Ch4/Ch5 banner ticks (6-22 LoC each), the
//     Ch2 archetype dispatcher (tickChapter2Archetype), and _tickPhaseShifter /
//     _tickEternal / _tickCoOp / _tickChoice (because they're self-contained
//     phase-banner + dmg-mult mutators).
//   - Relocated to src/ui/archetype-ticks.js (T1.11.1 follow-up): the larger
//     Ch1 boss-specific tick handlers (Pyredrake/Abyssal Tyrant/Grovewarden/
//     Solar Phoenix/Crypt Lich), the Ch2 archetype-specific ticks
//     (_tickHypnotist/_tickEngineer/_tickFrenzy/_tickTempo/_tickBattery),
//     and tickChapter3Boss (Ch3 state machine + helpers). Each pulls in
//     30-80 LoC of helper state + helper functions; the split keeps this
//     file under the §3.4 500-LoC cap while the sibling module owns
//     ~1,540 LoC of FX/DOM-coupled tick logic byte-perfect.
//
// Does NOT own:
//   - render() main grid renderer / renderHP / renderBossHP — those are
//     battle-screen DOM updates that stay in legacy until T1.12 wire-up.
//   - applyBuff / dealDamage / startBossBattle — combat math + flow, owned
//     by src/core/battle.js (T1.10.9).
//   - Per-boss state vars (_pyredrakeState / _abyssalTyrantState / etc.) —
//     module-private to their respective tick handlers; stay in legacy
//     until the matching tick handler lands in T1.11.1.
//
// 2026-05-11 — Roman: pure-relocation discipline.

/* eslint-disable no-empty, no-unused-vars, no-redeclare */

// 2026-05-11 — T1.11.1: deferred boss-specific tick handlers + Ch3 state
// machine now resolve via import from the sibling archetype-ticks.js
// module (~1,540 LoC of byte-perfect FX/DOM-coupled tick logic + per-
// handler module state). Co-located here would push battle-screen.js
// past the §3.4 500-LoC cap; the split keeps the dispatcher legible.
// tickChapter3Boss is exported by archetype-ticks.js but invoked
// directly from the legacy battle loop (not by tickChapter2Archetype);
// it's not re-imported here. T1.12 will wire it through src/main.js.
import {
  _tickHypnotist, _tickEngineer, _tickFrenzy, _tickTempo, _tickBattery,
  _tickPyredrake, _tickAbyssalTyrant, _tickGrovewarden, _tickSolarPhoenix,
  _tickCryptLich,
} from './archetype-ticks.js';
// T1.13.1: /* global */ → ES imports for resolved src/ exports.
import { _stormBlizzardFreezes, _stormEarthquakeLocks } from '../core/bosses.js';

/* global currentBoss, currentChapter, bossHP, bossMaxHP, bossAttackDmgMult,
   bossArchetype,
   grid, SIZE, hp, shieldCount, battleDamageTaken, gameEnded,
   _p6SoulDrinkerState, _p6SoulDrinkerLastPhase,
   _p6StormcallerLastPhase, _p6ConfessionReaderLastPhase,
   _p6WitherLastPhase, _p6SealerLastPhase,
   _p6PhaseShifterFaceIdx, _p6EqualizerLastPhase, _p6RegentLastPhase,
   _p6PhaseReverserLastPhase, _p6RoyalPhaseLastPhase,
   _p6EternalWaxRemaining, _p6EternalLastPhase,
   _p6InevitableLastPhase, _p6CoOpLastPhase, _p6CoOpGriefMode,
   _p6DevourerLastPhase, _p6ChoiceFlamePhaseIdx,
   PROSECUTOR_FACES, FLAME_PHASE_NAMES,
   document, flashStateBanner, flashText, vibrate, showThreatBanner,
   hideThreatBanner, renderHP, render, showDefeatModal,
   _bossArchetypePhase */
/* global _p6SoulDrinkerState:writable, _p6SoulDrinkerLastPhase:writable,
   _p6StormcallerLastPhase:writable, _p6ConfessionReaderLastPhase:writable,
   _p6WitherLastPhase:writable, _p6SealerLastPhase:writable,
   _p6PhaseShifterFaceIdx:writable, _p6EqualizerLastPhase:writable,
   _p6RegentLastPhase:writable, _p6PhaseReverserLastPhase:writable,
   _p6RoyalPhaseLastPhase:writable, _p6EternalWaxRemaining:writable,
   _p6EternalLastPhase:writable, _p6InevitableLastPhase:writable,
   _p6CoOpLastPhase:writable, _p6DevourerLastPhase:writable,
   _p6ChoiceFlamePhaseIdx:writable,
   bossHP:writable, bossAttackDmgMult:writable, shieldCount:writable,
   hp:writable, battleDamageTaken:writable */

// T1.13.2: Storm helpers (_stormApplyBlizzardFreeze / _stormApplyEarthquakeLock)
// moved to src/ui/archetype-ticks.js to retire the
// battle-screen.js ↔ archetype-ticks.js circular import documented in T1.11.1.
// archetype-ticks.js now owns the full Storm tick + helpers (Lightning was
// already there). battle-screen.js consumers route the call through
// tickChapter3Boss in archetype-ticks.js, so no direct import needed here.

// ─── tickChapter2Archetype — Ch1-Ch5 dispatcher (legacy 41156-41212) ────────
// Switch over `currentBoss.archetype`. Dispatches to per-archetype tick
// handlers; the Ch1 boss-specific branches (berserker/armored/bruiser/
// phoenix/assassin) additionally check `currentBoss.id` so future archetype
// reuse doesn't inherit the wrong ability set.
export function tickChapter2Archetype() {
  if (typeof currentBoss === 'undefined' || !currentBoss || !currentBoss.archetype) return;
  const arch = currentBoss.archetype;
  const phase = _bossArchetypePhase();
  switch (arch) {
    case 'hypnotist':       _tickHypnotist(phase); break;
    case 'engineer':        _tickEngineer(phase);  break;
    case 'frenzy':          _tickFrenzy(phase);    break;
    case 'tempo_disruptor': _tickTempo(phase);     break;
    case 'battery':         _tickBattery(phase);   break;
    // 2026-05-02 — COMBAT v2.1 P6 PR #6.A §2.4: Cosmic Ascension archetype dispatch.
    // 14 new archetypes scaffolded with phase-aware ticks. Per spec §19.1 mitigation,
    // MVP shows banner + simple per-phase damage modifier. Full state machines
    // (5-face cycling, 7-phase chains, twin grief mode) ship as v2.2 polish PRs.
    // Ch3 archetypes:
    case 'soul_drinker':       _tickSoulDrinker(phase);      break;
    case 'stormcaller':        _tickStormcaller(phase);      break;
    case 'confession_reader':  _tickConfessionReader(phase); break;
    case 'wither':             _tickWither(phase);           break;
    case 'sealer':             _tickSealer(phase);           break;
    // Ch4 archetypes:
    case 'phase_shifter':      _tickPhaseShifter(phase);     break;
    case 'equalizer':          _tickEqualizer(phase);        break;
    case 'regent':             _tickRegent(phase);           break;
    case 'phase_reverser':     _tickPhaseReverser(phase);    break;
    case 'royal_phase':        _tickRoyalPhase(phase);       break;
    // Ch5 archetypes:
    case 'eternal':            _tickEternal(phase);          break;
    case 'inevitable':         _tickInevitable(phase);       break;
    case 'co_op':              _tickCoOp(phase);             break;
    case 'devourer':           _tickDevourer(phase);         break;
    case 'choice':             _tickChoice(phase);           break;
    // 2026-04-30 — Chapter 1 boss-specific abilities. Until polish v0.2 the
    // Ch1 series ran on archetype-only mechanics (berserker enrage, tank
    // armor, etc.) which left them feeling generic compared to Ch2's
    // telegraphed kit. Each Ch1 boss gets one or more telegraphed
    // specials per BLOCKSWORN_BOSS_COMPENDIUM, dispatched here by id so a
    // future second berserker / tank / etc. doesn't inherit the wrong
    // ability set.
    case 'berserker':
      if (currentBoss.id === 'pyredrake' || currentBoss.name === 'PYREDRAKE') _tickPyredrake(phase);
      break;
    case 'armored':
      if (currentBoss.id === 'abyssal_tyrant' || currentBoss.name === 'ABYSSAL TYRANT') _tickAbyssalTyrant(phase);
      break;
    case 'bruiser':
      if (currentBoss.id === 'grovewarden' || currentBoss.name === 'GROVEWARDEN') _tickGrovewarden(phase);
      break;
    case 'phoenix':
      if (currentBoss.id === 'solar_phoenix' || currentBoss.name === 'SOLAR PHOENIX') _tickSolarPhoenix(phase);
      break;
    case 'assassin':
      if (currentBoss.id === 'crypt_lich' || currentBoss.name === 'CRYPT LICH') _tickCryptLich(phase);
      break;
    default: return; // Other Chapter 1 archetypes — existing handlers unchanged
  }
}

// ─── Ch3 archetype ticks — banner-only (legacy 42879-42914) ─────────────────

export function _tickSoulDrinker(phase) {
  if (_p6SoulDrinkerLastPhase === phase) return;
  _p6SoulDrinkerLastPhase = phase;
  let newState = 'light';
  if (phase === 1) newState = 'light';
  else if (phase === 2) newState = 'dark';
  else if (phase === 3) newState = 'both';
  if (newState !== _p6SoulDrinkerState) {
    _p6SoulDrinkerState = newState;
    try { flashStateBanner('SHIFT — ' + newState.toUpperCase(), newState === 'light' ? '#FFD700' : '#9B59D6'); } catch (e) {}
  }
}

export function _tickStormcaller(phase) {
  if (_p6StormcallerLastPhase === phase) return;
  _p6StormcallerLastPhase = phase;
  try { flashStateBanner('STORM PHASE ' + phase, '#9CC8DE'); } catch (e) {}
}

export function _tickConfessionReader(phase) {
  if (_p6ConfessionReaderLastPhase === phase) return;
  _p6ConfessionReaderLastPhase = phase;
  try { flashStateBanner('CONFESSION P' + phase, '#C0A6DF'); } catch (e) {}
}

export function _tickWither(phase) {
  if (_p6WitherLastPhase === phase) return;
  _p6WitherLastPhase = phase;
  try { flashStateBanner('WITHER P' + phase, '#6E7A6A'); } catch (e) {}
}

export function _tickSealer(phase) {
  if (_p6SealerLastPhase === phase) return;
  _p6SealerLastPhase = phase;
  try { flashStateBanner('SEAL P' + phase, '#E8D88A'); } catch (e) {}
}

// ─── Ch4 archetype ticks — Phase Shifter face system (legacy 42916-42962) ───
// 2026-05-02 — COMBAT v2.1 P6 §2.4.2: Phase Shifter tick (THE PROSECUTOR).
// 5 faces driven by HP ratio. Each face bumps bossAttackDmgMult per face data.
export function _tickPhaseShifter(phase) {
  void phase;  // Phase Shifter ignores the discrete phase; faces driven by HP ratio
  if (typeof currentBoss === 'undefined' || !currentBoss) return;
  if (typeof bossHP !== 'number' || typeof bossMaxHP !== 'number' || bossMaxHP <= 0) return;
  const ratio = bossHP / bossMaxHP;
  let newFaceIdx = 0;
  if (ratio <= 0.20) newFaceIdx = 4;
  else if (ratio <= 0.40) newFaceIdx = 3;
  else if (ratio <= 0.60) newFaceIdx = 2;
  else if (ratio <= 0.80) newFaceIdx = 1;
  if (newFaceIdx !== _p6PhaseShifterFaceIdx) {
    _p6PhaseShifterFaceIdx = newFaceIdx;
    const face = PROSECUTOR_FACES[newFaceIdx];
    try { flashStateBanner('FACE: ' + face.name, face.color); } catch (e) {}
    try { if (typeof bossAttackDmgMult !== 'undefined') bossAttackDmgMult = face.dmgMult; } catch (e) {}
  }
  // Per-turn heal for SORROW/VERDICT (3% HP/turn)
  const face = PROSECUTOR_FACES[_p6PhaseShifterFaceIdx];
  if (face.healPerTurn > 0 && typeof bossHP === 'number' && typeof bossMaxHP === 'number') {
    bossHP = Math.min(bossMaxHP, bossHP + Math.floor(bossMaxHP * face.healPerTurn));
  }
}

export function _tickEqualizer(phase) {
  if (_p6EqualizerLastPhase === phase) return;
  _p6EqualizerLastPhase = phase;
  try { flashStateBanner('SCALES P' + phase, '#F0E68C'); } catch (e) {}
}

export function _tickRegent(phase) {
  if (_p6RegentLastPhase === phase) return;
  _p6RegentLastPhase = phase;
  try { flashStateBanner('REGENT P' + phase, '#FFAA28'); } catch (e) {}
}

export function _tickPhaseReverser(phase) {
  if (_p6PhaseReverserLastPhase === phase) return;
  _p6PhaseReverserLastPhase = phase;
  try { flashStateBanner('REVERSE P' + phase, '#A8C8E8'); } catch (e) {}
}

export function _tickRoyalPhase(phase) {
  if (_p6RoyalPhaseLastPhase === phase) return;
  _p6RoyalPhaseLastPhase = phase;
  try { flashStateBanner('ROYAL P' + phase, '#E8C8FF'); } catch (e) {}
}

// ─── Ch5 archetype ticks (legacy 42963-43045) ───────────────────────────────
// 2026-05-02 — COMBAT v2.1 P6 §2.4.3: Eternal tick (THE WICK).
// Wax timer counts down 1/turn. Each 100 dmg = -1 wax (handled in
// applyDamageToEternal hook elsewhere). At 0 wax, boss extinguished.
export function _tickEternal(phase) {
  if (typeof currentBoss === 'undefined' || !currentBoss || currentBoss.archetype !== 'eternal') return;
  if (_p6EternalWaxRemaining > 0) {
    _p6EternalWaxRemaining = Math.max(0, _p6EternalWaxRemaining - 1);
  }
  if (_p6EternalLastPhase !== phase) {
    _p6EternalLastPhase = phase;
    try { flashStateBanner('WAX ' + _p6EternalWaxRemaining + 'T', '#FFD700'); } catch (e) {}
  }
  // Phase shifts based on wax (banner + dmgMult)
  if (_p6EternalWaxRemaining <= 10 && _p6EternalWaxRemaining > 0) {
    try { if (typeof bossAttackDmgMult !== 'undefined') bossAttackDmgMult = 1.5; } catch (e) {}
  } else if (_p6EternalWaxRemaining <= 20) {
    try { if (typeof bossAttackDmgMult !== 'undefined') bossAttackDmgMult = 1.2; } catch (e) {}
  }
  // Wax depleted → boss extinguished (player wins via wax mechanic, not HP)
  if (_p6EternalWaxRemaining <= 0 && typeof bossHP === 'number' && bossHP > 0) {
    try { bossHP = 0; flashStateBanner('THE WICK BURNS DOWN', '#FFD700'); } catch (e) {}
  }
}

export function _tickInevitable(phase) {
  if (_p6InevitableLastPhase === phase) return;
  _p6InevitableLastPhase = phase;
  try { flashStateBanner('DREAM P' + phase, '#5DCAFF'); } catch (e) {}
}

// 2026-05-02 — COMBAT v2.1 P6 §2.4.4: Co-Op Twin tick (SHARED HEARTH).
// Twin grief mode: if twin A dies first → twin B grief (+200% dmg, +5% HP/turn regen).
// Strategic restraint: kill both within 4 seconds = perfect kill achievement.
// MVP scaffold tracks state; full UI dual-bar lands in v2.2 polish.
export function _tickCoOp(phase) {
  if (_p6CoOpLastPhase !== phase) {
    _p6CoOpLastPhase = phase;
    try { flashStateBanner('TWIN HEARTH P' + phase, '#FF7F50'); } catch (e) {}
  }
  if (_p6CoOpGriefMode === 'A' && typeof bossMaxHP === 'number' && bossMaxHP > 0) {
    // Twin A grief regen 5% per turn
    if (typeof bossHP === 'number') bossHP = Math.min(bossMaxHP, bossHP + Math.floor(bossMaxHP * 0.05));
  } else if (_p6CoOpGriefMode === 'B' && typeof bossMaxHP === 'number' && bossMaxHP > 0) {
    if (typeof bossHP === 'number') bossHP = Math.min(bossMaxHP, bossHP + Math.floor(bossMaxHP * 0.05));
  }
}

// 2026-05-02 — COMBAT v2.1 P6 §2.4.5: Devourer tick (FIRST HUNGER).
// Steals N resources per turn (1/2/3 across P1/P2/P3). All refunded × 1.50
// on victory. MVP scaffold logs steal events; full theft + refund cycle
// lands in v2.2 polish.
export function _tickDevourer(phase) {
  if (_p6DevourerLastPhase !== phase) {
    _p6DevourerLastPhase = phase;
    try { flashStateBanner('DEVOUR P' + phase, '#2F2F2F'); } catch (e) {}
  }
}

// 2026-05-02 — COMBAT v2.1 P6 §2.4.6: Choice tick (FLAME ITSELF).
// 7 phases asking 7 questions. Each phase tests a different aspect of strategy.
// Final phase 7 stacks all previous mechanics — chaos test.
export function _tickChoice(phase) {
  void phase;  // Choice ignores discrete phase — 7-phase boundaries driven by HP ratio
  if (typeof currentBoss === 'undefined' || !currentBoss) return;
  if (typeof bossHP !== 'number' || typeof bossMaxHP !== 'number' || bossMaxHP <= 0) return;
  const ratio = bossHP / bossMaxHP;
  // 7-phase boundaries (per spec)
  let newPhaseIdx = 0;
  if (ratio <= 0.14) newPhaseIdx = 6;
  else if (ratio <= 0.28) newPhaseIdx = 5;
  else if (ratio <= 0.43) newPhaseIdx = 4;
  else if (ratio <= 0.57) newPhaseIdx = 3;
  else if (ratio <= 0.71) newPhaseIdx = 2;
  else if (ratio <= 0.86) newPhaseIdx = 1;
  if (newPhaseIdx !== _p6ChoiceFlamePhaseIdx) {
    _p6ChoiceFlamePhaseIdx = newPhaseIdx;
    const phaseName = FLAME_PHASE_NAMES[newPhaseIdx] || 'UNKNOWN';
    try { flashStateBanner('PHASE: ' + phaseName.replace(/_/g, ' '), '#FF0000'); } catch (e) {}
  }
}

// ─── Battle-screen UI listener contract ─────────────────────────────────────
// The battle screen has many DOM hooks (grid cells, hero cards, ULT buttons,
// boss image, threat banner, HP bar). T1.12 will wire delegated listeners
// via setupBattleScreenEventListeners().

// 2026-05-16 — TASK-CP-001: import boss scene mount/destroy. Per readiness
// doc §3 Option A (Roman ruling 2026-05-16) Combat Polish components mount
// via this file, NOT via src/core/battle.js — preserves CLAUDE.md §2 +
// combat-polish-implementation-plan.md §8.3 "src/core/* NEVER touched".
import { mountBossScene, destroyBossScene, updateBossScene } from '../feel/boss-scene.js';

// Re-export updateBossScene so battle orchestrators / route handlers can
// refresh scene state (HP, name, element swap) without a fresh import.
export { updateBossScene };

export function setupBattleScreenEventListeners() {
  // TODO(T1.12): attach delegated 'click' / 'pointerdown' listeners to:
  //   #grid → cell-tap + drag-drop pipeline (place piece)
  //   .hero-card → ultimate-fire / hero detail
  //   #pieceTray .piece → drag handle
  //   #bossImg → boss-tap (currently dev-only)
  //   #towerAbandonBtn → abandonTowerRun
  //   #retreatBtn → returnToMenuFromBattle (from router.js)

  // TASK-CP-001 — mount boss scene composition. Idempotent if already mounted
  // (re-entry on screen re-activation). Looks for #screenBattle (legacy DOM)
  // or .bw-battle-root (modular shell) as the host element.
  try {
    const battleRoot =
         document.querySelector('.bw-battle-root')
      || document.getElementById('screenBattle');
    if (battleRoot) {
      mountBossScene(battleRoot);
      // Initial state refresh — defensive read of window-bridge boss data
      // if available (modular shell will pass via update() once boss data
      // pipes through). Safe no-op when window globals absent.
      try {
        const boss = (typeof window !== 'undefined') ? window.currentBoss : null;
        if (boss) updateBossScene(boss);
      } catch (_e) { /* defensive — no boss data yet, fine */ }
    }
  } catch (_err) {
    // Mount failure is non-fatal — scene degrades to legacy-only render.
    // Log routes through global error handler / Sentry per src/main.js init.
  }
}

export function cleanupBattleScreen() {
  // TODO(T1.12): remove listeners attached in setupBattleScreenEventListeners()
  // + clear per-archetype state (Pyredrake warn cells, Abyssal row warn,
  // Maelstrom warn, Crush Spire pending, Ch3 _ch3State, P6 _p6* lastPhase
  // memos). These cleanups currently happen inline at battle-start in legacy
  // _resetPhase6ArchetypeState / _resetAbyssalTyrantState / initChapter3Boss —
  // call those from cleanupBattleScreen until T1.12 unifies the reset path.

  // TASK-CP-001 — tear down boss scene + restore bossImg to legacy parent.
  try {
    destroyBossScene();
  } catch (_err) {
    // Idempotent destroy — safe to ignore failures.
  }
}

// ─── T1.11.1 landed ─────────────────────────────────────────────────────────
// The 10 deferred boss-specific tick handlers + tickChapter3Boss Ch3 state
// machine now live in src/ui/archetype-ticks.js (sibling module).
// tickChapter2Archetype above imports them by name; no /* global */ stubs
// remain for the deferred ticks. See archetype-ticks.js header for inventory.
//
// tickChapter3Boss is the entry the legacy battle loop expects — it stays
// exported by archetype-ticks.js so legacy `tickChapter3Boss()` call sites
// resolve when src/main.js (T1.12) bridges window <-> module.
