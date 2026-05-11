// 2026-05-11 — TASK-011 (T1.10.5): 4-channel damage system relocated from
// legacy.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - 4 damage-channel constants                  lines 19966-19979
//     (CHANNEL_DEADZONE_DMG, CHANNEL_VOID_TICK_PCT,
//      CHANNEL_GRID_SATURATION_THRESHOLD, CHANNEL_GRID_SATURATION_DMG,
//      CHANNEL_SIGNATURE_DMG)
//   - Mitigation Matrix + cap                     lines 19982-20002
//     (MITIGATION_CAP, MITIGATION_TABLE, LEVEL_MITIGATION_PER)
//   - channelLabel  / showChannelFX /
//     showMitigationFX                            lines 38816-38879
//   - applyChannelDamage central dispatcher       lines 38881-38993
//   - _getBossSignatureTier helper                lines 39044-39069
//   - applyBossSignatureDamage                    lines 39071-39082
//   - Window exposure block                       lines 39084-39091
//
// SACRED PER CLAUDE.md §2.5 (v2.1 P1):
//   The 4 damage channels are the spine of combat:
//     - DEAD_ZONE        — direct boss-targeted damage (5 HP per new pocket).
//                          Inline call site lives in legacy dead-zone scanner
//                          (line 63992) and stays there until T1.10.7 / T1.10.9
//                          wire-up; we own only the channel name + the
//                          CHANNEL_DEADZONE_DMG constant + the dispatcher path.
//     - VOID             — 0.5% MAX_HP per void cell per tick. Fired from
//                          grid.applyVoidTickIfAny (T1.10.3) under the legacy
//                          channel key `'void_tick'`.
//     - SIGNATURE        — element-typed bursts from boss attacks (tutorial 12
//                          → finale 28). Fired from applyBossSignatureDamage.
//     - GRID_SATURATION  — 8 HP flat at >=75% occupancy. Fired from
//                          grid.applyGridSaturationIfAny (T1.10.3) under the
//                          legacy channel key `'saturation'`.
//
//   Legacy channel string keys ('deadzone' | 'void_tick' | 'signature' |
//   'saturation') are sacred — every showChannelFX style map, FTUE dialog
//   gate, mitigation matrix consumer, and Sentry breadcrumb keys off them.
//   We therefore export the constants under v2.1-spec-canonical CH_* names
//   AND keep the byte-perfect legacy string values intact.
//
//   Mitigation Matrix (MITIGATION_TABLE + MITIGATION_CAP +
//   LEVEL_MITIGATION_PER): byte-perfect from legacy lines 19982-20002. Hard
//   ceiling 70%; per-role per-tier table; per-level deltas. Sacred.
//
//   Damage formulas inside applyChannelDamage — shield absorption ordering
//   (AEGIS → MAELEN frozen ward → normal shield), mitigation application,
//   Math.floor + Math.max(rawDmg>0?1:0, mitigated) minimum-1 floor, AEGIS
//   PROTOCOL HP→Pressure reroute, Tank conversion stream, T2 reactive trigger
//   — preserved byte-perfect.
//
// T1.10.5 is pure relocation — no value, formula, mitigation matrix entry,
// shield-absorption ordering, channel string key, or FX style entry modified.
//
// Owns:
//   - 4-channel name constants (CH_DEAD_ZONE / CH_VOID / CH_SIGNATURE /
//     CH_GRID_SATURATION) — v2.1-spec canonical names exported, while the
//     internal dispatcher continues to consume the legacy string keys.
//   - Per-channel raw damage constants (CHANNEL_DEADZONE_DMG = 5,
//     CHANNEL_VOID_TICK_PCT = 0.005, CHANNEL_GRID_SATURATION_THRESHOLD = 0.75,
//     CHANNEL_GRID_SATURATION_DMG = 8, CHANNEL_SIGNATURE_DMG tier map).
//   - Mitigation Matrix (MITIGATION_CAP = 0.70, MITIGATION_TABLE,
//     LEVEL_MITIGATION_PER) — sacred per CLAUDE.md §2.5.
//   - channelLabel — human-readable name per channel.
//   - showChannelFX / showMitigationFX — per-channel toast + vibrate + HP-band
//     tint visual treatment.
//   - applyChannelDamage central dispatcher — single point of entry for ALL
//     player damage. Shield gate → mitigation → HP application → channel FX →
//     analytics breadcrumb → FTUE intro hooks.
//   - _getBossSignatureTier + applyBossSignatureDamage — signature damage
//     entry from bossAttack().
//
// Does NOT own:
//   - getSquadMitigation / getHeroMitigationKey — heroes-side mitigation
//     contribution sum + role mapping. Stays in legacy until T1.10.4 /
//     T1.10.5 follow-ups; consumed here via `/* global */`.
//   - applyVoidTickIfAny / applyGridSaturationIfAny — already in grid.js
//     (T1.10.3); they call into the dispatcher under the channel keys
//     'void_tick' / 'saturation'. Grid keeps its `/* global applyChannelDamage
//     */` directive until T1.10.9 cross-module wiring.
//   - Dead-zone scanner pocket count → rawDmg conversion (legacy line 63988)
//     stays in legacy until T1.10.7 / T1.10.9.
//   - Tank ULT helpers (_getT2TankMitigationBoost,
//     _getIronscaleIronHideMitBonus, _computeTankPressureConversion,
//     _maybeFireT2TankReactive) + AEGIS PROTOCOL state
//     (aegisProtocolTurnsActive, aegisActive, aegisUsed,
//     maelenShieldNoDecay, _t2BonusInDeck) — Aegis Conductor lives in
//     heroes.js (T1.10.4) and exposes those names. Consumed via /* global */.
//   - addPressure / showAegisProtocolFX / showTankConversionFX /
//     _firePhase3Hook / _maybeTriggerTankConversionIntro — stagger + Phase 3
//     hook + FX, T1.10.6 / T1.11 territory.
//   - FTUE channel + mitigation intros (_maybeTriggerChannelIntro,
//     _maybeTriggerMitigationIntro) — legacy globals consulted here; they
//     remain in legacy until a future FTUE sub-task moves them next to the
//     T1.10.1 FTUE state machine.
//   - flashText / flashStateBanner / vibrate / speakNarrator / renderHP —
//     T1.09 (feel) + T1.11 (ui) territory; consumed via /* global */.
//   - currentBoss / _isTowerBattle / currentChapter / currentBossIdx —
//     T1.10.7 / T1.10.9 (battle + bosses) territory.
//   - hp / shieldCount / battleDamageTaken — battle-state writable globals
//     mutated here per legacy semantics; T1.10.9 will move ownership.
//
// Storage migration: zero new bare-string localStorage keys. Channel damage
// math is per-battle ephemeral.
//
// Cross-module wiring: grid.js (T1.10.3) already calls
// `applyChannelDamage('void_tick', ...)` and `applyChannelDamage('saturation',
// ...)` under its `/* global applyChannelDamage */` directive. Legacy still
// publishes `window.applyChannelDamage`. T1.10.9 will replace grid.js's
// directive with an explicit import from this module.
//
// 2026-05-11 — Roman: pure-relocation discipline. No "improvements". Nothing
// new. Comments above this line replicate legacy intent.

// ESLint scaffolding — the dispatcher touches many ambient legacy names
// (Tank ULT helpers, FTUE intros, FX, battle-state writables). Per the
// T1.10.1-T1.10.4 sibling pattern: explicit /* global */ blocks for every
// legacy ambient + writable mutation site. caughtErrors no-unused-vars and
// no-empty must be relaxed because legacy uses `} catch (e) {}` patterns
// abundantly inside the dispatcher — preserving byte-perfect requires
// accepting them.
/* eslint-disable no-empty, no-unused-vars */
// Squad mitigation sum (heroes territory until follow-up; legacy line 38768):
/* global getSquadMitigation */
// Tank ULT helpers (Aegis Conductor — heroes.js T1.10.4 exposes these):
/* global _t2BonusInDeck, _getT2TankMitigationBoost,
   _getIronscaleIronHideMitBonus, _computeTankPressureConversion,
   _maybeFireT2TankReactive,
   aegisActive, aegisProtocolTurnsActive,
   maelenShieldNoDecay,
   showAegisProtocolFX, showTankConversionFX,
   _firePhase3Hook, _maybeTriggerTankConversionIntro */
// Stagger-loop pressure writer (T1.10.6 territory) — Tank conversion + AEGIS
// PROTOCOL route HP-equivalent into Pressure via addPressure.
/* global addPressure */
// AEGIS aegisUsed counter (writable from inside the dispatcher):
/* global aegisUsed:writable */
// Battle-state writable globals — flipped by the dispatcher on HP loss:
/* global hp:writable, shieldCount:writable, battleDamageTaken:writable */
// FTUE intro hooks (still in legacy; called from end of dispatcher):
/* global _maybeTriggerChannelIntro, _maybeTriggerMitigationIntro */
// Boss + battle context (T1.10.7 territory) — read by signature dispatch:
/* global currentBoss, currentChapter, currentBossIdx, _isTowerBattle */
// Stihiya color palette (for MAELEN frozen ward banner — T1.07 data):
/* global STIHIYA_COLORS */
// Sacred MAX_HP constant (legacy line 19956; data-consolidation target):
/* global MAX_HP */
// Feel / UI / analytics (T1.09 + T1.11):
/* global flashText, flashStateBanner, vibrate, speakNarrator, renderHP,
   logEvent */

import { log } from '../services/logger.js';

// ─── v2.1 P1 4-channel name constants ─────────────────────────────────────
// SACRED PER CLAUDE.md §2.5. Exported under v2.1-spec canonical names; the
// underlying string values match the legacy channel keys consumed by
// showChannelFX, FTUE dialog map, and Sentry breadcrumbs. DO NOT rename the
// string values — many call sites key off them.
export const CH_DEAD_ZONE       = 'deadzone';
export const CH_VOID            = 'void_tick';
export const CH_SIGNATURE       = 'signature';
export const CH_GRID_SATURATION = 'saturation';

// ─── Per-channel damage constants (legacy 19966-19979) ────────────────────
// SACRED PER CLAUDE.md §2.5 — byte-perfect from legacy.
export const CHANNEL_DEADZONE_DMG              = 5;            // flat 5 HP per new pocket
export const CHANNEL_VOID_TICK_PCT             = 0.005;        // 0.5% MAX_HP per void cell at EOT
export const CHANNEL_GRID_SATURATION_THRESHOLD = 0.75;         // >75% board occupied
export const CHANNEL_GRID_SATURATION_DMG       = 8;            // flat 8 HP at EOT if oversaturated

// Signature Attack damage by boss role tier. Tier assigned per-boss in CHAPTERS
// data in P4; until then bossAttack() falls back to 'gatekeeper' default (16).
export const CHANNEL_SIGNATURE_DMG = Object.freeze({
  tutorial:    12,   // Boss 1 (Pyredrake)
  gatekeeper:  16,   // Bosses 2, 3, 6, 7, 11, 12, 16, 17
  mid_act:     20,   // Bosses 4, 8, 9, 13, 14, 18, 19
  act_boss:    24,   // Bosses 5, 10, 15, 20
  finale:      28,   // Boss 25 (Ch5 final)
});

// ─── Mitigation Matrix (legacy 19982-20002) ───────────────────────────────
// SACRED PER CLAUDE.md §2.5 — byte-perfect from legacy. Hard 70% ceiling
// keeps player never-immune; per-role per-tier base contribution; per-role
// per-level scaling (replaces former hpBonus).
export const MITIGATION_CAP = 0.70;                            // hard ceiling, never immune

// Per-role per-tier mitigation contribution. getHeroMitigationKey() maps each
// hero to one of these 5 keys based on role + sub-role.
export const MITIGATION_TABLE = Object.freeze({
  guard:           Object.freeze({ T0: 0.05, T1: 0.08, T2: 0.12, T3: 0.18 }),
  weaver_mage:     Object.freeze({ T0: 0.02, T1: 0.04, T2: 0.07, T3: 0.10 }),
  weaver_captain:  Object.freeze({ T0: 0.01, T1: 0.03, T2: 0.05, T3: 0.08 }),
  striker_warrior: Object.freeze({ T0: 0.01, T1: 0.02, T2: 0.03, T3: 0.05 }),
  striker_hunter:  Object.freeze({ T0: 0.00, T1: 0.01, T2: 0.02, T3: 0.04 }),
});

// Per-role per-level mitigation scaling (replaces LEVEL_HP_PER).
// At 60 lvl: Guard gains +30%, Weaver/Mage +12%, Captain +9%, Warrior +6%, Hunter +4.8%.
export const LEVEL_MITIGATION_PER = Object.freeze({
  guard:           0.005,
  weaver_mage:     0.002,
  weaver_captain:  0.0015,
  striker_warrior: 0.001,
  striker_hunter:  0.0008,
});

// ─── Channel label / FX (legacy 38824-38879) ──────────────────────────────
// Channel labels (human-readable) — used by toast text + Sentry breadcrumbs.
export function channelLabel(c) {
  switch (c) {
    case 'deadzone':   return 'Dead Zone';
    case 'void_tick':  return 'Void Strike';
    case 'signature':  return 'Boss Attack';
    case 'saturation': return 'Grid Pressure';
    default:           return 'Damage';
  }
}

// Visual treatment per channel. AAA principle: each threat type has a
// distinct visual signature so the player can learn from screen feedback
// alone. flashText / vibrate / hp-band tint already exist in the codebase.
export function showChannelFX(channel, dmg, blocked, meta) {
  const styles = {
    deadzone:   { color: '#E85D4A', icon: '🩸', label: 'DEAD ZONE',   vibrate: [80] },
    void_tick:  { color: '#9B59E8', icon: '🟣', label: 'VOID TICK',   vibrate: [40, 30, 40] },
    signature:  { color: '#FF8C00', icon: '⚔',  label: 'BOSS STRIKE', vibrate: [120, 50, 120] },
    saturation: { color: '#FFD700', icon: '⚠',  label: 'GRID FULL',   vibrate: [50, 30, 50, 30, 50] },
  };
  const s = styles[channel] || styles.deadzone;

  // Channel-tinted flash on HP band (reuses existing .hp-hit class +
  // --hp-hit-color CSS var — both shipped in earlier polish).
  try {
    const hpBand = document.querySelector('.a-battle .v-battle-player-hp');
    if (hpBand) {
      hpBand.classList.remove('hp-hit');
      hpBand.style.setProperty('--hp-hit-color', s.color);
      void hpBand.offsetWidth;  // reflow → restart animation
      hpBand.classList.add('hp-hit');
      setTimeout(() => hpBand.classList.remove('hp-hit'), 500);
    }
  } catch (e) {}

  // Damage toast (channel-styled). Blocked variant for shield absorption.
  const toast = blocked
    ? (s.icon + ' ' + s.label + ' BLOCKED')
    : (s.icon + ' ' + s.label + ' −' + dmg + ' HP');
  try { flashText(toast, s.color); } catch (e) {}
  try { vibrate(s.vibrate); } catch (e) {}
  try { speakNarrator('hpLost'); } catch (e) {}
}

// Mitigation visual — small green sub-toast under main damage toast.
// flashText() doesn't natively support styled sub-text, so we delay-fire a
// secondary flash 250ms later for visual stacking. Polish target for #1.C.
export function showMitigationFX(amount) {
  if (!amount || amount <= 0) return;
  try {
    setTimeout(() => {
      try { flashText('🛡 −' + amount + ' mitigated', '#5DCA79'); } catch (e) {}
    }, 250);
  } catch (e) {}
}

// ─── applyChannelDamage central dispatcher (legacy 38881-38993) ───────────
// THE single point of entry for ALL player damage. 4 channels share this
// function. Shield-absorption preserves existing AEGIS / MAELEN / normal
// shield logic. Mitigation: getSquadMitigation() reduces rawDmg before HP
// application. Minimum 1 HP if any rawDmg > 0 (so 100% mitigation feels
// close-but-not-immune).
//
// channel: 'deadzone' | 'void_tick' | 'signature' | 'saturation'
// rawDmg:  raw damage value (before mitigation)
// meta:    optional { sourceCells, deadCount, voidCount, ratio, tier } for FX
// Returns: final HP damage applied (0 if blocked, ≥1 otherwise unless rawDmg=0).
//
// SACRED PER CLAUDE.md §2.5 — ordering + clamps + floor preserved byte-perfect.
export function applyChannelDamage(channel, rawDmg, meta) {
  meta = meta || {};
  if (!rawDmg || rawDmg <= 0) return 0;

  // Shield absorption — same gating as legacy dead-zone site. Order:
  //   AEGIS (hero ability, save WITHOUT consuming shield) →
  //   MAELEN frozen ward (T2, hold WITHOUT consuming) →
  //   normal shield (consumed, full hit absorbed).
  if (typeof shieldCount !== 'undefined' && shieldCount > 0) {
    const _t2AegisBonus = (typeof _t2BonusInDeck === 'function')
                          ? _t2BonusInDeck('spark_tank', 'autoBlockCountBonus') : null;
    const _aegisCap = 1 + (_t2AegisBonus || 0);
    if (typeof aegisActive !== 'undefined' && aegisActive
        && typeof aegisUsed !== 'undefined' && aegisUsed < _aegisCap) {
      aegisUsed++;
      try { flashStateBanner(_t2AegisBonus ? 'DEEP SHIELD ' + aegisUsed + '/' + _aegisCap : 'AEGIS', '#5DCA79'); } catch (e) {}
      try { vibrate([80, 40, 80]); } catch (e) {}
      showChannelFX(channel, 0, true, meta);
      return 0;
    } else if (typeof maelenShieldNoDecay !== 'undefined' && maelenShieldNoDecay > 0) {
      try { flashStateBanner('FROZEN WARD · SHIELD HELD', (typeof STIHIYA_COLORS !== 'undefined' && STIHIYA_COLORS.tide) || '#5DCAFF'); } catch (e) {}
      try { vibrate([80, 40, 80]); } catch (e) {}
      showChannelFX(channel, 0, true, meta);
      return 0;
    } else {
      shieldCount--;
      try { flashText('SHIELD ABSORBED ' + channelLabel(channel).toUpperCase(), '#8C3BFF'); } catch (e) {}
      showChannelFX(channel, 0, true, meta);
      return 0;
    }
  }

  // No shield → apply mitigation, then HP.
  // 2026-05-02 — COMBAT v2.1 P3 §3.4: T2 Tank reactive — at HP ≤ 50%, mitigation
  // doubles (cap 70%). Applied AFTER base getSquadMitigation() so Tank stacking
  // composes with normal mitigation rules.
  let mitigation = getSquadMitigation();
  if (typeof _getT2TankMitigationBoost === 'function') {
    mitigation = _getT2TankMitigationBoost(mitigation);
  }
  // 2026-05-02 — COMBAT v2.1 P3 §4.4 (PR #3.F): IRONSCALE T3 Iron Hide bonus.
  // While AEGIS PROTOCOL is active and owned by IRONSCALE, +10% additive mit.
  if (typeof _getIronscaleIronHideMitBonus === 'function') {
    mitigation = Math.min(0.85, mitigation + _getIronscaleIronHideMitBonus());
  }
  const mitigated  = Math.floor(rawDmg * (1 - mitigation));
  const finalDmg   = Math.max(rawDmg > 0 ? 1 : 0, mitigated);
  const mitigatedAmount = rawDmg - finalDmg;

  // 2026-05-02 — COMBAT v2.1 P3 §3.4: AEGIS PROTOCOL window — T3 Tank ULT.
  // While active, ALL incoming damage routes to Pressure (no HP loss). Spec
  // §3.4 sample places this AFTER mitigation, BEFORE HP application. Boss
  // signature/void/saturation all flow through here.
  if (aegisProtocolTurnsActive > 0) {
    if (typeof addPressure === 'function') addPressure(finalDmg, 'aegis_protocol');
    if (typeof showAegisProtocolFX === 'function') showAegisProtocolFX(finalDmg);
    showChannelFX(channel, 0, true, meta);
    if (mitigatedAmount > 0) showMitigationFX(mitigatedAmount);
    try { if (typeof renderHP === 'function') renderHP(); } catch (e) {}
    return 0;
  }

  hp -= finalDmg;
  if (typeof battleDamageTaken === 'number') battleDamageTaken += finalDmg;

  // 2026-05-02 — COMBAT v2.1 P3 §3.4: Tank pressure conversion (T0+).
  // Each HP of incoming dmg → 1.0× / 1.2× pressure depending on Tank tier.
  // Stacks if multiple Tanks in deck. Visual: gold particle stream from HP
  // bar to Pressure meter (PR #3.F polish — for now: floating text).
  if (typeof _computeTankPressureConversion === 'function') {
    const tankConv = _computeTankPressureConversion(finalDmg);
    if (tankConv > 0) {
      if (typeof addPressure === 'function') addPressure(tankConv, 'tank_absorb');
      if (typeof showTankConversionFX === 'function') showTankConversionFX(tankConv);
      // Fire centralized hook so other Phase 3 systems can observe absorbs.
      try { if (typeof _firePhase3Hook === 'function') _firePhase3Hook('onTankAbsorb', { dmg: finalDmg, conv: tankConv }); } catch (e) {}
      // FTUE intro — first-time-only Tank conversion explanation (PR #3.F §8.2).
      try { if (typeof _maybeTriggerTankConversionIntro === 'function') _maybeTriggerTankConversionIntro(); } catch (e) {}
    }
  }

  // T2 Tank reactive — at HP ≤ 50% post-damage, fire auto-shield once per descent.
  if (typeof _maybeFireT2TankReactive === 'function') _maybeFireT2TankReactive();

  showChannelFX(channel, finalDmg, false, meta);
  if (mitigatedAmount > 0) showMitigationFX(mitigatedAmount);

  // Save HP UI refresh (renderHP wired in PR #1.C with 0..100 scale UI).
  try { if (typeof renderHP === 'function') renderHP(); } catch (e) {}

  // 2026-05-02 — COMBAT v2.1 P1 PR #1.D §6.4: FTUE intro triggers wired.
  // Channel-specific intro fires first (700ms delay), mitigation intro
  // chains 800ms later if squad has mitigation > 0. Both gated by
  // seenDialogs (once per install) + Ch1 + !isFtueActive.
  try { if (typeof _maybeTriggerChannelIntro === 'function') _maybeTriggerChannelIntro(channel); } catch (e) {}
  try { if (typeof _maybeTriggerMitigationIntro === 'function') _maybeTriggerMitigationIntro(); } catch (e) {}

  // Analytics breadcrumb (Sprint 4 B2 Sentry forward exists in logEvent already).
  try { if (typeof logEvent === 'function') logEvent('channel_damage', {
    channel, rawDmg, finalDmg, mitigated: mitigatedAmount, mitigation: Math.round(mitigation * 100) / 100,
  }); } catch (e) {}

  return finalDmg;
}

// ─── Signature damage entry (legacy 39044-39082) ──────────────────────────
// SIGNATURE ATTACK helper — maps current boss to its CHANNEL_SIGNATURE_DMG
// tier. Per-boss tier assignment lives in CHAPTERS data starting in P4;
// until then we fall back to a hardcoded mapping by global boss number,
// matching the spec's reference assignment (§2):
//   tutorial:    Boss 1
//   gatekeeper:  Bosses 2, 3, 6, 7, 11, 12, 16, 17
//   mid_act:     Bosses 4, 8, 9, 13, 14, 18, 19
//   act_boss:    Bosses 5, 10, 15, 20
//   finale:      Boss 25
export function _getBossSignatureTier() {
  // 2026-05-02 — COMBAT v2.1 P4 §5.5: prefer canonical `roleTier` over legacy
  // `signatureTier`. Both fields populate the same CHANNEL_SIGNATURE_DMG
  // tier key (tutorial / gatekeeper / mid_act / act_boss / chapter_finale).
  // `roleTier` is the new field name (PR #4.A); `signatureTier` kept as
  // backward-compat for any data path that may still set it.
  const _tier = (typeof currentBoss !== 'undefined' && currentBoss)
              ? (currentBoss.roleTier || currentBoss.signatureTier) : null;
  if (_tier && CHANNEL_SIGNATURE_DMG[_tier]) return _tier;
  // Per-boss override (P4 sets currentBoss.signatureTier).
  if (typeof currentBoss !== 'undefined' && currentBoss && currentBoss.signatureTier
      && CHANNEL_SIGNATURE_DMG[currentBoss.signatureTier]) {
    return currentBoss.signatureTier;
  }
  // Tower bosses don't have a chapter-tier; treat as gatekeeper baseline.
  if (typeof _isTowerBattle !== 'undefined' && _isTowerBattle) return 'gatekeeper';
  // Compute global boss number from chapter + index.
  const ch = (typeof currentChapter === 'number') ? currentChapter : 1;
  const idx = (typeof currentBossIdx === 'number') ? currentBossIdx : 0;
  const n = (ch - 1) * 5 + idx + 1;  // 1-indexed
  if (n === 1)   return 'tutorial';
  if (n === 25)  return 'finale';
  if (n % 5 === 0)  return 'act_boss';                              // 5, 10, 15, 20
  if (n % 5 >= 1 && n % 5 <= 2)  return 'gatekeeper';               // 2,3,6,7,11,12,16,17
  return 'mid_act';                                                  // 4,8,9,13,14,18,19
}

// SIGNATURE CHANNEL — fires from inside bossAttack() after void cells spawn.
// In P1 this is the minimal hook (per spec §3.9): flat damage by boss tier.
// P2 (Stagger Loop) and P4 (per-archetype patterns + telegraphs) add real
// pacing and reactivity. FTUE / Tower exclusions handled here.
export function applyBossSignatureDamage() {
  // FTUE-only Pyredrake hard caps to keep tutorial gentle.
  if (typeof currentBoss !== 'undefined' && currentBoss && currentBoss._isFtueOnly) return 0;
  if (typeof currentBoss !== 'undefined' && currentBoss && currentBoss._isTrainingDummy) return 0;
  const tier = _getBossSignatureTier();
  const sigDmg = CHANNEL_SIGNATURE_DMG[tier] || CHANNEL_SIGNATURE_DMG.gatekeeper;
  return applyChannelDamage('signature', sigDmg, { tier, bossName: (currentBoss && currentBoss.name) });
}

// ─── Legacy interop (window exposure) ─────────────────────────────────────
// Legacy bodies still consult the dispatcher via ambient `applyChannelDamage`
// (grid.js T1.10.3 keeps its `/* global applyChannelDamage */` directive
// until T1.10.9 wire-up). Mirror the legacy window-exposure block so the
// inline dead-zone scanner (legacy line 63992), revenge attack (legacy line
// 39323), phoenix fire aura (legacy line 39394), and grid.js callbacks all
// see the same function instance.
if (typeof window !== 'undefined') {
  window.applyChannelDamage      = applyChannelDamage;
  window.applyBossSignatureDamage = applyBossSignatureDamage;
  window.channelLabel            = channelLabel;
  window._getBossSignatureTier   = _getBossSignatureTier;
  // Constants — legacy bodies (dead-zone scanner, FTUE channel intros, HUD
  // mitigation bar at line 70067 / 70148) read these ambient.
  window.CHANNEL_DEADZONE_DMG              = CHANNEL_DEADZONE_DMG;
  window.CHANNEL_VOID_TICK_PCT             = CHANNEL_VOID_TICK_PCT;
  window.CHANNEL_GRID_SATURATION_THRESHOLD = CHANNEL_GRID_SATURATION_THRESHOLD;
  window.CHANNEL_GRID_SATURATION_DMG       = CHANNEL_GRID_SATURATION_DMG;
  window.CHANNEL_SIGNATURE_DMG             = CHANNEL_SIGNATURE_DMG;
  window.MITIGATION_CAP                    = MITIGATION_CAP;
  window.MITIGATION_TABLE                  = MITIGATION_TABLE;
  window.LEVEL_MITIGATION_PER              = LEVEL_MITIGATION_PER;
}

// Quiet T1.10.5 boot acknowledgement — confirms the module side-effects
// (window exposures above) ran. Matches the T1.10.1-T1.10.4 sibling pattern.
log.debug('damage-channels (T1.10.5) module initialized');
