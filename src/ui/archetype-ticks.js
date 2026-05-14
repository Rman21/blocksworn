// 2026-05-11 — TASK-013 (T1.11.1): land deferred archetype tick handlers + Ch3 SM
//
// T1.11 follow-up. T1.11 agent split the 33 archetype tick handlers
// between battle-screen.js (16 small banner-only ticks + 2 Storm helpers
// + tickChapter2Archetype dispatcher = 435 LoC, under §3.4 500-LoC cap)
// and this sibling module (10 larger boss-specific handlers + Ch3 state
// machine + their per-handler module state + helper functions = ~1,300
// LoC of FX/DOM-coupled tick logic). Co-locating both halves in
// battle-screen.js would push it past 1,500 LoC; the split here keeps
// the dispatcher legible while landing the byte-perfect bodies.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - Ch3 state vars + initChapter3Boss + tickChapter3Boss + helpers
//                                          line 40788-42013  (Ch3 SM block)
//   - _tickPyredrake + helpers              line 41214-41347  (Pyredrake — Cinderblast)
//   - _tickAbyssalTyrant + helpers          line 41349-41584  (Abyssal Tyrant — Row/Crush/Maelstrom)
//   - _tickGrovewarden + helpers            line 41586-41793  (Grovewarden — Bloom/Root/Wrath; Forest Wrath body at 42232-42264)
//   - _tickSolarPhoenix + helpers           line 41795-41973  (Solar Phoenix — Line/Storm)
//   - _tickCryptLich + helpers              line 42015-42230  (Crypt Lich — Geometry/Drain/Necropulse)
//   - _tickHypnotist + helpers              line 42266-42390  (Hypnotist — Suggest/Petal/Tendril/Bloom)
//   - _tickEngineer + helpers               line 42392-42525  (Engineer — Weld/Extract/Critical Mass)
//   - _tickFrenzy + _frenzyDevour +
//     _renderFrenzyVisuals                  line 42527-42620  (Frenzy — Stacks/Maul/Devour)
//   - _tickTempo                            line 42622-42680  (Tempo Disruptor — Slow/Reverse/Lock)
//   - _tickBattery                          line 42682-42722  (Battery — Charge → Convergence/Cascade)
//
// SCOPE NOTE — pure relocation discipline (T1.10 / T1.11 pattern):
//   * All bodies are byte-identical to legacy. No "improvements", no
//     control-flow tweaks, no timing edits, no logging additions.
//   * Animation durations (`setTimeout(.., 600)` / 700ms strobes,
//     `vibrate([..])` patterns, threat-banner copy + persistence flags)
//     all preserved exactly.
//   * Particle / DOM class names (`.cinderblast-warn` / `-hit`,
//     `.row-strike-warn` / `-hit`, `.bloom-strike-hit`, `.forest-wrath-hit`,
//     `.solar-line-warn` / `-hit`, `.solar-storm-hit`,
//     `.dark-geometry-warn` / `-hit`, `.hero-card--crush-spire-warn`,
//     `.hero-card--crush-spire-locked`, `.hero-card--hypno-suggested`,
//     `.hero-card--hypno-coiled`, `.hero-card--frenzy-devoured`,
//     `.cell--engineer-welded`, `.cell--engineer-electrified`,
//     `.tempo-slow-tint`, `.boss-aura-light/-dark/-both`,
//     `.lightning-row-hit`) all preserved.
//   * Per-handler module state (the Sets/Maps/`let` block at top of each
//     §§§ ===== BOSS ====== group) extracted alongside its owners so the
//     scope guarantees remain identical to legacy: every state mutation
//     and every read happens within the same module surface.
//
// CROSS-MODULE DEPS — resolved via /* global */ until T1.12 wires src/main.js
// as the entry point. None of these handlers depend on src/ui/* sibling
// surface; they read from:
//   - Combat state (currentBoss / bossHP / bossMaxHP / hp / shieldCount /
//     battleDamageTaken / gameEnded / grid / SIZE / currentChapter)
//   - Legacy FX helpers (flashText / flashStateBanner / showThreatBanner /
//     hideThreatBanner / vibrate / renderHP / renderBossHP / render /
//     showDefeatModal) — these are the same set referenced by
//     battle-screen.js inline ticks; T1.12 will rewire to src/feel/animations.js.
//   - Ch2 archetype constants + state (HYPNOTIST_*, ENGINEER_*, FRENZY_*,
//     TEMPO_*, BATTERY_*, GROVE_*, hypnotist*, engineer*, frenzy*, tempo*,
//     battery*, etc.) — currently live in legacy module scope at lines
//     40632-40760 + 22887+ etc.; the migration that owns those constants
//     (T1.10 archetype data extraction) declared them as exports but
//     this module reads via /* global */ until T1.12 inverts the
//     ownership.
//   - HERO_DECK + heroCharges + getUltCost — used by Hypnotist Tendril
//     Coil / Abyssal Crush Spire / Frenzy Devour to pick targets.
//   - groveAbsorbedByCell / groveTotalAbsorbed — used by Engineer
//     Resource Extract (drains grove resource Map; heals boss).
//   - bossRevivedOnce — used by Solar Phoenix to gate Solar Storm
//     (post-revive only).
//   - bossDualSuggestActive — used by Hypnotist to force min 2 suggestions
//     even at P1 (reactivity hook, COMBAT v2.1 P4 PR #4.C §4.6).
//   - bossChargeRateMult / engineerElectrifiedRows / frenzyMaxStacks /
//     bossAttackDmgMult — reactivity-driven multipliers (P4 §4.7-4.10).
//   - PROSECUTOR_FACES / FLAME_PHASE_NAMES (consts referenced from
//     battle-screen.js but not this module).
//   - _batterySunfireCascade / _batterySolarConvergence /
//     _renderBatteryChargeMeter — Battery follow-up FX (legacy 42723+).
//     Stay in legacy until a future cleanup task lands them; this module
//     references them via the existing `typeof === 'function'` legacy
//     idiom inside try/catch.
//   - _ch3HasDebuff / _ch3HasSeal / _ch3TwilightMult — helper readers
//     used by combat hooks elsewhere in legacy. Exported here so combat
//     hooks can switch to imports in T1.12; legacy keeps reading them
//     via global until then.
//
// 2026-05-11 — Roman: pure-relocation discipline. No behavior change.

/* eslint-disable no-empty, no-unused-vars, no-redeclare */

// T1.13.1: /* global */ → ES imports for resolved src/ exports.
import { _stormBlizzardFreezes, _stormEarthquakeLocks } from '../core/bosses.js';
import { mirrorWindowProp } from '../utils/window-mirror.js';

/* global currentBoss, currentChapter, bossHP, bossMaxHP, bossAttackDmgMult,
   bossArchetype, grid, SIZE, hp, shieldCount, battleDamageTaken, gameEnded,
   flashText, flashStateBanner, showThreatBanner, hideThreatBanner, vibrate,
   renderHP, renderBossHP, render, showDefeatModal,
   HERO_DECK, heroCharges, getUltCost,
   groveAbsorbedByCell, groveTotalAbsorbed,
   bossRevivedOnce, bossDualSuggestActive, bossChargeRateMult,
   engineerElectrifiedRows, frenzyMaxStacks,
   _batterySunfireCascade, _batterySolarConvergence, _renderBatteryChargeMeter,
   HYPNOTIST_SUGGEST_INT_P1, HYPNOTIST_SUGGEST_INT_P2, HYPNOTIST_SUGGEST_INT_P3,
   HYPNOTIST_PETAL_INT, HYPNOTIST_TENDRIL_INT, HYPNOTIST_BLOOM_INT,
   HYPNOTIST_OBEY_BONUS_P1, HYPNOTIST_OBEY_BONUS_P2, HYPNOTIST_OBEY_BONUS_P3,
   hypnotistTurnsSinceSuggest, hypnotistSuggestedHeroIds,
   hypnotistTurnsSincePetal, hypnotistTurnsSinceTendril, hypnotistTendrilHeroId,
   hypnotistTendrilTurnsLeft, hypnotistTurnsSinceBloom, hypnotistBloomCorrupted,
   ENGINEER_WELD_INT, ENGINEER_WELD_COUNT_P1, ENGINEER_WELD_COUNT_P2, ENGINEER_WELD_COUNT_P3,
   ENGINEER_WELD_DURATION, ENGINEER_EXTRACT_INT, ENGINEER_EXTRACT_HEAL_PCT,
   ENGINEER_ELECTRIFY_INT, ENGINEER_ELECTRIFY_DURATION,
   engineerTurnsSinceWeld, engineerTurnsSinceExtract, engineerTurnsSinceElectrify,
   engineerElectrifiedRow, engineerElectrifiedTurns, engineerLockedCells,
   FRENZY_DECAY_P2, FRENZY_STACK_CAP, FRENZY_STACK_CAP_P3,
   FRENZY_MAUL_THRESHOLD, FRENZY_DEVOUR_THRESHOLD, FRENZY_DEVOUR_DURATION,
   FRENZY_DEVOUR_HEAL_PCT, BATTERY_GAIN_P3_BASE,
   frenzyP3Active, frenzyHitThisTurn, frenzyStacks,
   frenzyMaulQueued, frenzyDevourQueued, frenzyDevouredTurnsLeft,
   frenzyDevouredHeroId,
   TEMPO_SLOW_INT, TEMPO_REVERSE_INT, TEMPO_LOCK_INT,
   tempoSlowQueued, tempoChargeNullifyQueued, tempoTurnLockQueued,
   tempoTurnsSinceSlow, tempoTurnsSinceReverse, tempoTurnsSinceLock,
   BATTERY_THRESHOLD, BATTERY_GAIN_HIT, BATTERY_GAIN_NOHIT,
   batteryPhase, batteryCharge, batteryHitThisPlacement, batteryUnleashCount */
/* global hypnotistTurnsSinceSuggest:writable, hypnotistTurnsSincePetal:writable,
   hypnotistTurnsSinceTendril:writable, hypnotistTendrilHeroId:writable,
   hypnotistTendrilTurnsLeft:writable, hypnotistTurnsSinceBloom:writable,
   hypnotistBloomCorrupted:writable, hypnotistSuggestedHeroIds:writable,
   engineerTurnsSinceWeld:writable, engineerTurnsSinceExtract:writable,
   engineerTurnsSinceElectrify:writable, engineerElectrifiedRow:writable,
   engineerElectrifiedTurns:writable, groveTotalAbsorbed:writable,
   frenzyP3Active:writable, frenzyHitThisTurn:writable, frenzyStacks:writable,
   frenzyMaulQueued:writable, frenzyDevourQueued:writable,
   frenzyDevouredHeroId:writable, frenzyDevouredTurnsLeft:writable,
   tempoSlowQueued:writable, tempoChargeNullifyQueued:writable,
   tempoTurnLockQueued:writable, tempoTurnsSinceSlow:writable,
   tempoTurnsSinceReverse:writable, tempoTurnsSinceLock:writable,
   batteryPhase:writable, batteryCharge:writable,
   batteryHitThisPlacement:writable, batteryUnleashCount:writable,
   bossHP:writable, bossAttackDmgMult:writable, shieldCount:writable,
   hp:writable, battleDamageTaken:writable */

// T1.13.2: Stormshepherd Blizzard/Earthquake helpers retired the
// battle-screen.js ↔ archetype-ticks.js circular import documented in T1.11.1
// by moving the two helpers from battle-screen.js into this module (where the
// Storm tick already lives). Byte-perfect to legacy 40799-40829.
export function _stormApplyBlizzardFreeze(storm) {
  // Freeze up to 2 random EMPTY adjacent cells.
  const candidates = [];
  for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    const r = storm.r + dr, c = storm.c + dc;
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) continue;
    if (grid[r][c] !== null) continue;
    candidates.push(r + '_' + c);
  }
  if (candidates.length === 0) return;
  candidates.sort(() => Math.random() - 0.5);
  const picks = candidates.slice(0, Math.min(2, candidates.length));
  for (const k of picks) _stormBlizzardFreezes.set(k, 2);
  try { flashStateBanner('❄ BLIZZARD · ' + picks.length + ' cell' + (picks.length === 1 ? '' : 's') + ' frozen 2T', '#9CC8DE', 2800); } catch (e) {}
  try { vibrate([80, 50, 80]); } catch (e) {}
}

export function _stormApplyEarthquakeLock(storm) {
  // Pick a random EMPTY board cell (NOT the storm cell itself; the
  // storm cell is already a void). 3T lock.
  const candidates = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (grid[r][c] !== null) continue;
    if (r === storm.r && c === storm.c) continue;
    candidates.push(r + '_' + c);
  }
  if (candidates.length === 0) return;
  const k = candidates[Math.floor(Math.random() * candidates.length)];
  _stormEarthquakeLocks.set(k, 3);
  try { flashStateBanner('🌍 EARTHQUAKE · cell locked 3T', '#A5805C', 2800); } catch (e) {}
  try { vibrate([100, 60, 100, 60, 140]); } catch (e) {}
}

// ─── Chapter 3 boss state machine (legacy 40788-42013) ───────────────────────
// 5 mechanics (simplified MVP per spec §2.2-2.6):
//   TWILIGHT VESSEL — DUAL SHIFT:    damage mult by hero element/role per phase
//   STORMSHEPHERD — STORM SUMMONING: spawn extra void cells per turn (1-3 by phase)
//   VOIDPRIESTESS — CONFESSION READ: per-turn debuff against squad role
//   ROOT-OF-NOTHING — WITHER:        permanent cell lock per turn (heals boss if standing 3+ turns)
//   ARCHIVAL ETERNAL — LIBRARIAN SEAL: combo cap reduce + per-turn ability seal

export let _ch3BossId = null;        // 'twilight' | 'storm' | 'priestess' | 'root' | 'archival' | null
export let _ch3State  = {};

// Legacy 40830-40859 — Stormshepherd Lightning row helper (Blizzard +
// Earthquake helpers live in battle-screen.js per T1.11 inlining policy;
// Lightning stays here because it's only consumed by tickChapter3Boss
// at the storm-intensify path below).
export function _stormApplyLightningRow(storm) {
  // Strobe the storm's row + take an extra shield/HP tick on top of
  // the universal intensify damage. Visual via .lightning-row-hit
  // class on every cell in that row for 0.6s.
  try {
    for (let c = 0; c < SIZE; c++) {
      const el = document.querySelector(`.cell[data-row="${storm.r}"][data-col="${c}"]`);
      if (el) {
        el.classList.remove('lightning-row-hit'); void el.offsetWidth;
        el.classList.add('lightning-row-hit');
        setTimeout(() => { try { el.classList.remove('lightning-row-hit'); } catch (e) {} }, 600);
      }
    }
  } catch (e) {}
  // Extra damage tick (in addition to the universal intensify tax).
  try {
    if (typeof shieldCount !== 'undefined' && shieldCount > 0) {
      shieldCount = Math.max(0, shieldCount - 1);
      try { flashText('⚡ LIGHTNING · 🛡 absorbed', '#FFD53D'); } catch (e2) {}
    } else if (typeof hp !== 'undefined') {
      hp = Math.max(0, hp - 1);
      battleDamageTaken = (battleDamageTaken || 0) + 1;
      try { flashText('⚡ LIGHTNING · −1 HP', '#FFD53D'); renderHP(); } catch (e2) {}
      if (hp === 0 && typeof gameEnded !== 'undefined' && !gameEnded) {
        try { if (typeof showDefeatModal === 'function') showDefeatModal(); } catch (e2) {}
      }
    }
  } catch (e) {}
  try { vibrate([200, 80, 240]); } catch (e) {}
}

function _ch3PhaseFromHp() {
  if (!bossMaxHP) return 1;
  const r = bossHP / bossMaxHP;
  if (r > 0.66) return 1;
  if (r > 0.33) return 2;
  return 3;
}

export function initChapter3Boss() {
  _ch3BossId = null;
  _ch3State  = { turn: 0, debuffs: [], witherCells: [], seals: [], stormFlash: '' };
  // 2026-04-30 — clear Stormshepherd variant Maps so Tower / replay
  // encounters don't inherit a frozen / locked cell from a prior fight.
  try { if (typeof _stormBlizzardFreezes !== 'undefined') _stormBlizzardFreezes.clear(); } catch (e) {}
  try { if (typeof _stormEarthquakeLocks !== 'undefined') _stormEarthquakeLocks.clear(); } catch (e) {}
  // Reset dual-state announcer so the next Ch3 fight fires a fresh
  // "LIGHT VEIL" / "DARK VEIL" banner on its first phase, not silently
  // because we'd already announced that mask in a prior battle.
  _ch3LastDualState = '';
  // Strip any aura class that survived from a prior battle.
  try {
    const wrap = document.getElementById('bossImgWrap');
    if (wrap) wrap.classList.remove('boss-aura-light', 'boss-aura-dark', 'boss-aura-both');
  } catch (e) {}
  if (currentChapter !== 3 || !currentBoss) return;
  const map = {
    'TWILIGHT VESSEL':  'twilight',
    'STORMSHEPHERD':    'storm',
    'VOIDPRIESTESS':    'priestess',
    'ROOT-OF-NOTHING':  'root',
    'ARCHIVAL ETERNAL': 'archival',
  };
  _ch3BossId = map[currentBoss.name] || null;
}

export function tickChapter3Boss() {
  if (currentChapter !== 3 || !_ch3BossId) return;
  _ch3State.turn++;
  const phase = _ch3PhaseFromHp();
  // ===== TWILIGHT VESSEL — DUAL SHIFT =====
  // Phase 1 (66-100%): Light state — Hunters with 'umbra' (Dark) +50%, others -25%
  // Phase 2 (33-66%):  Dark state  — Hunters with 'solar' (Light) +50%, others -25%
  // Phase 3 (0-33%):   Both states active — chaos
  if (_ch3BossId === 'twilight') {
    _ch3State.lightActive = (phase === 1 || phase === 3);
    _ch3State.darkActive  = (phase === 2 || phase === 3);
  }
  // 2026-04-30 — VOIDPRIESTESS dual-state shift (BOSS_COMPENDIUM §2.4).
  // The Light/Dark alternation was on the spec but missing from the
  // archetype — confessions still rolled from a single role-debuff
  // pool. Mirroring Twilight's lightActive/darkActive lets the boss
  // portrait aura + state banner announce phase shifts without
  // touching the existing confession-pool logic. (A wider future PR
  // can split confessions into light-themed and dark-themed pools and
  // alternate them; this drop is visual + announcement only.)
  if (_ch3BossId === 'priestess') {
    _ch3State.lightActive = (phase === 1 || phase === 3);
    _ch3State.darkActive  = (phase === 2 || phase === 3);
  }
  // 2026-04-30 — paint the dual-state aura on the boss portrait + fire
  // a state-banner announcement when the state mix CHANGES (avoids
  // spamming on every tick once a phase has settled).
  try { _ch3MaybeAnnounceDualState(); } catch (e) {}
  try { _ch3RenderBossAura(); } catch (e) {}
  // ===== STORMSHEPHERD — STORM SUMMONING (with shatter escape per spec §2.3) =====
  // Spawn N extra storm voids per turn (N = phase). 3 storm types cycle.
  // 2026-04-27 — Block 6.5 DEBT-3: storm cells track {r,c,turnsLeft=2}.
  // If storm cell still on grid after 2 turns → INTENSIFY.
  // If storm cell cleared via cascade/ULT before timer expires → DEFUSED.
  // 2026-04-30 — Storm variants no longer functionally identical:
  //   BLIZZARD ❄  → freezes 1-2 adjacent empty cells for 2T (canPlace
  //                 refuses; render shows ❄ overlay).
  //   EARTHQUAKE 🌍 → locks 1 random board cell immovable for 3T (same
  //                   placement-block visual; lasts longer than blizzard).
  //   LIGHTNING ⚡  → strobes a random row + an extra HP/shield tick on
  //                   top of the standard intensify damage. No persistent
  //                   board state; pure burst damage.
  // Storm-cell `type` is stamped at spawn so the right side-effect fires
  // when (and only when) that specific storm intensifies. Common 1-tick
  // damage path is preserved so all three storms still hurt baseline.
  if (_ch3BossId === 'storm') {
    if (!Array.isArray(_ch3State.stormCells)) _ch3State.stormCells = [];
    // Tick down active blizzard freezes + earthquake locks first so
    // they release at start of player's turn.
    if (_stormBlizzardFreezes && _stormBlizzardFreezes.size > 0) {
      const drop = [];
      for (const [k, t] of _stormBlizzardFreezes.entries()) {
        const next = t - 1;
        if (next <= 0) drop.push(k);
        else _stormBlizzardFreezes.set(k, next);
      }
      for (const k of drop) _stormBlizzardFreezes.delete(k);
      if (drop.length > 0) try { flashStateBanner('❄ BLIZZARD · ' + drop.length + ' cell' + (drop.length === 1 ? '' : 's') + ' THAWED', '#9CC8DE'); } catch (e) {}
    }
    if (_stormEarthquakeLocks && _stormEarthquakeLocks.size > 0) {
      const drop = [];
      for (const [k, t] of _stormEarthquakeLocks.entries()) {
        const next = t - 1;
        if (next <= 0) drop.push(k);
        else _stormEarthquakeLocks.set(k, next);
      }
      for (const k of drop) _stormEarthquakeLocks.delete(k);
      if (drop.length > 0) try { flashStateBanner('🌍 EARTHQUAKE · GROUND SETTLES', '#A5805C'); } catch (e) {}
    }

    // Tick existing storms: drop those whose cell was cleared, intensify those
    // that timed out, decrement otherwise.
    const survivors = [];
    const intensifiedStorms = [];
    for (const s of _ch3State.stormCells) {
      const stillThere = grid[s.r] && (typeof grid[s.r][s.c] === 'string') && grid[s.r][s.c].startsWith('void_');
      if (!stillThere) continue;  // DEFUSED — player cleared the storm cell
      s.turnsLeft--;
      if (s.turnsLeft <= 0) {
        intensifiedStorms.push(s);
      } else {
        survivors.push(s);
      }
    }
    if (intensifiedStorms.length > 0) {
      // Common base intensify damage — one shield/HP tick total per
      // turn regardless of how many storms intensified at once. Same
      // cap as before to avoid TPK from a triple-storm tick.
      try {
        if (typeof shieldCount !== 'undefined' && shieldCount > 0) {
          shieldCount = Math.max(0, shieldCount - 1);
          try { flashText('⚡ STORM INTENSIFIES · 🛡 absorbed', '#9CC8DE'); } catch (e2) {}
        } else {
          hp = Math.max(0, hp - 1);
          battleDamageTaken = (battleDamageTaken || 0) + 1;
          try { flashText('⚡ STORM INTENSIFIES · −1 HP', '#9CC8DE'); renderHP(); } catch (e2) {}
          if (hp === 0 && typeof gameEnded !== 'undefined' && !gameEnded) {
            try { if (typeof showDefeatModal === 'function') showDefeatModal(); } catch (e2) {}
          }
        }
      } catch (e) {}
      // Per-variant secondary effects. Each storm contributes its own
      // unique pressure — the 1-shield baseline above is the universal
      // tax, this is the flavor that makes the player learn which icon
      // to fear most.
      for (const s of intensifiedStorms) {
        try {
          if (s.type === 'blizzard') _stormApplyBlizzardFreeze(s);
          else if (s.type === 'earthquake') _stormApplyEarthquakeLock(s);
          else if (s.type === 'lightning') _stormApplyLightningRow(s);
        } catch (e) { console.warn('storm variant intensify failed:', e); }
      }
    }
    _ch3State.stormCells = survivors;
    // Spawn new storms this turn — single type per spawn batch (stays
    // legible: "this is a Blizzard turn"), cell count = phase.
    const stormCount = phase;
    const stormTypes = [
      { id: 'blizzard',   label: '❄ BLIZZARD',  color: '#9CC8DE' },
      { id: 'earthquake', label: '🌍 EARTHQUAKE', color: '#A5805C' },
      { id: 'lightning',  label: '⚡ LIGHTNING', color: '#FFD53D' },
    ];
    const empties = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === null) empties.push([r, c]);
    }
    empties.sort(() => Math.random() - 0.5);
    const picks = empties.slice(0, stormCount);
    if (picks.length > 0) {
      const variant = stormTypes[Math.floor(Math.random() * 3)];
      for (const [r, c] of picks) {
        grid[r][c] = 'void_' + (currentBoss.stihiya || 'tide');
        _ch3State.stormCells.push({ r, c, turnsLeft: 2, type: variant.id });
      }
      // Threat banner copy now reflects what each variant DOES on
      // intensify so the player can pattern-read at a glance.
      const _suffix = variant.id === 'blizzard' ? ' — clear or adjacent cells freeze'
                    : variant.id === 'earthquake' ? ' — clear or a board cell locks 3T'
                    : ' — clear or a row gets struck';
      const _label = picks.length > 1 ? variant.label + ' ×' + picks.length : variant.label;
      const _msg = '⚠ ' + _label + ' in 2 turns' + _suffix;
      try { showThreatBanner(_msg, 3500); } catch (e) {}
      try { render(); } catch (e) {}
    }
  }
  // ===== VOIDPRIESTESS — CONFESSION READ =====
  // Roll N debuffs per turn (N = phase). Each lasts 3 turns. Effects read
  // by relevant combat hooks (debuffs array drives flags below).
  if (_ch3BossId === 'priestess') {
    const debuffPool = [
      'hunter_silenced',  // Hunter ULT damage halved (×0.5 mult)
      'mage_halved',      // Mage amp window mult halved (×0.5 mult)
      'tank_halved',      // Tank ULT shield gain halved (applyTankUlt hook)
      'captain_disabled', // Captain dual buff disabled (mult clamped to 1.0)
      'warrior_blocked',  // No piece may overlap row 0 while a Warrior is in deck (canPlace gate)
    ];
    // Decrement existing debuff timers, drop expired
    _ch3State.debuffs = _ch3State.debuffs
      .map(d => ({ id: d.id, turns: d.turns - 1 }))
      .filter(d => d.turns > 0);
    // Add new debuffs based on phase (avoid duplicates)
    for (let i = 0; i < phase; i++) {
      const choices = debuffPool.filter(p => !_ch3State.debuffs.some(d => d.id === p));
      if (choices.length === 0) break;
      const pick = choices[Math.floor(Math.random() * choices.length)];
      _ch3State.debuffs.push({ id: pick, turns: 3 });
      try { flashText('✦ CONFESSION: ' + pick.replace('_', ' ').toUpperCase(), '#C0A6DF'); } catch (e) {}
    }
  }
  // ===== ROOT-OF-NOTHING — WITHER =====
  // Wither N random cells per turn (N = phase). Withered cells are
  // permanent void_grove that cannot be cleared. Boss heals 5% HP per
  // wither standing 3+ turns (capped at +15% per tick).
  // 2026-04-29 — Block 6.5 DEBT-4 — Phase 3 acceleration. Spec §2.5:
  // at 33-0% HP, "cells wither faster (1 turn instead of 3)" — withers
  // start healing immediately on turn 1 instead of needing 3-turn aging.
  if (_ch3BossId === 'root') {
    const witherCount = phase;
    const witherAgeThreshold = (phase >= 3) ? 1 : 3;
    const empties = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === null) empties.push([r, c]);
    }
    empties.sort(() => Math.random() - 0.5);
    const picks = empties.slice(0, witherCount);
    for (const [r, c] of picks) {
      grid[r][c] = 'void_grove';
      _ch3State.witherCells.push({ r, c, age: 0 });
    }
    // Age existing withers; heal boss for any wither past the phase-aware threshold.
    let healCount = 0;
    _ch3State.witherCells.forEach(w => {
      w.age++;
      if (w.age >= witherAgeThreshold && grid[w.r] && grid[w.r][w.c] === 'void_grove') healCount++;
    });
    if (healCount > 0) {
      const healAmt = Math.floor(bossMaxHP * 0.05 * Math.min(3, healCount));
      bossHP = Math.min(bossMaxHP, bossHP + healAmt);
      try { flashText('🌑 WITHER HEAL +' + healAmt, '#6E7A6A'); } catch (e) {}
      try { renderBossHP(); } catch (e) {}
    }
    if (picks.length > 0) {
      try { flashText('🌑 WITHER ×' + picks.length, '#6E7A6A'); } catch (e) {}
      try { render(); } catch (e) {}
    }
  }
  // ===== ARCHIVAL ETERNAL — LIBRARIAN SEAL =====
  // Apply N seals per turn (N = phase). Seals are 2-turn debuffs read
  // by combat hooks. Pool: combo_cap_4 / ults_disabled / dmg_halved.
  if (_ch3BossId === 'archival') {
    // 2026-04-27 — Block 6.5 DEBT-6: extended seal pool (7 of 7 from spec §2.6).
    const sealPool = [
      'combo_cap_4', 'ults_disabled', 'dmg_halved',
      'charge_frozen',        // hero per-cell charges = 0 next turn
      'placement_costs_hp',   // -1 HP per placement
      'element_drops_random', // captain element drop bonus disabled
      'captain_inverted',     // captain dual buff inverted (×1/value)
    ];
    _ch3State.seals = _ch3State.seals
      .map(s => ({ id: s.id, turns: s.turns - 1 }))
      .filter(s => s.turns > 0);
    let sealsAppliedThisTurn = 0;
    for (let i = 0; i < phase; i++) {
      const choices = sealPool.filter(p => !_ch3State.seals.some(s => s.id === p));
      if (choices.length === 0) break;
      const pick = choices[Math.floor(Math.random() * choices.length)];
      _ch3State.seals.push({ id: pick, turns: 2 });
      sealsAppliedThisTurn++;
      try { flashText('📜 SEAL: ' + pick.replace(/_/g, ' ').toUpperCase(), '#E8D88A'); } catch (e) {}
    }
    // 2026-04-29 — Block 6.5 DEBT-6 — Phase 3 seal-stack heal. Spec §2.6:
    // "Phase 3 (33-0%): 3 seals per turn AND boss heals 2% HP per seal applied;
    //  defeat boss before seal-stacking overwhelms."
    // Heal scales with seals actually pushed this tick (the inner loop bails
    // when the pool is exhausted, so no double-counting against unfilled slots).
    if (phase >= 3 && sealsAppliedThisTurn > 0) {
      const sealHeal = Math.floor(bossMaxHP * 0.02 * sealsAppliedThisTurn);
      if (sealHeal > 0) {
        bossHP = Math.min(bossMaxHP, bossHP + sealHeal);
        try { flashText('📜 ARCHIVE HEAL +' + sealHeal, '#E8D88A'); } catch (e) {}
        try { renderBossHP(); } catch (e) {}
      }
    }
  }
}

// Helpers used by combat hooks to read Ch3 archetype state.
export function _ch3HasDebuff(id) {
  return _ch3BossId === 'priestess' && _ch3State.debuffs.some(d => d.id === id);
}
export function _ch3HasSeal(id) {
  return _ch3BossId === 'archival' && _ch3State.seals.some(s => s.id === id);
}
// Twilight DUAL SHIFT — returns multiplier for hero damage based on hero
// element + boss state. Default 1.0. Hunters with bonus element get +50%;
// other heroes get -25%.
export function _ch3TwilightMult(hero) {
  if (_ch3BossId !== 'twilight' || !hero) return 1.0;
  const isHunter = hero.newRole === 'hunter';
  if (_ch3State.lightActive && hero.stihiya === 'umbra' && isHunter) return 1.50;
  if (_ch3State.darkActive  && hero.stihiya === 'solar' && isHunter) return 1.50;
  return 0.75;
}

// 2026-04-30 — Twilight Vessel + Voidpriestess dual-state aura visuals.
// Both bosses run on the lightActive/darkActive flags but until now the
// dynamic was invisible — only damage scaling changed. The aura paints
// a halo around the boss portrait that matches the active state, and
// _ch3MaybeAnnounceDualState fires a one-shot state banner when the
// mix changes so the player notices the shift even if they're not
// looking at the portrait.
let _ch3LastDualState = ''; // serialized "light|dark" mask, drives announcement edge detection
function _ch3RenderBossAura() {
  const wrap = document.getElementById('bossImgWrap');
  if (!wrap) return;
  // Reset all aura classes first — idempotent.
  wrap.classList.remove('boss-aura-light', 'boss-aura-dark', 'boss-aura-both');
  // Apply the right one only for bosses that participate in the dual-
  // state dynamic (Twilight Vessel + Voidpriestess so far). Other Ch3
  // bosses (Stormshepherd, Root-of-Nothing, Archival Eternal) get no
  // aura — keeps the visual signal exclusive.
  if (_ch3BossId !== 'twilight' && _ch3BossId !== 'priestess') return;
  const light = !!(_ch3State && _ch3State.lightActive);
  const dark  = !!(_ch3State && _ch3State.darkActive);
  if (light && dark) wrap.classList.add('boss-aura-both');
  else if (light)    wrap.classList.add('boss-aura-light');
  else if (dark)     wrap.classList.add('boss-aura-dark');
}
function _ch3MaybeAnnounceDualState() {
  if (_ch3BossId !== 'twilight' && _ch3BossId !== 'priestess') return;
  const light = !!(_ch3State && _ch3State.lightActive);
  const dark  = !!(_ch3State && _ch3State.darkActive);
  const mask = (light ? '1' : '0') + '|' + (dark ? '1' : '0');
  if (mask === _ch3LastDualState) return;
  _ch3LastDualState = mask;
  let text = '', color = '#FFD53D';
  if (light && dark)      { text = '☯ DUAL VEIL · BOTH STATES ACTIVE'; color = '#C087FF'; }
  else if (light)         { text = '☀ LIGHT VEIL · solar passive';     color = '#FFD53D'; }
  else if (dark)          { text = '☾ DARK VEIL · umbra passive';      color = '#9B59D6'; }
  if (text) {
    try { flashStateBanner(text, color, 3200); } catch (e) {}
  }
}

// ─── PYREDRAKE — Cinderblast (legacy 41214-41347) ────────────────────────────
// (Ch.1 Boss 1, BOSS_COMPENDIUM §1.1)
// Every 6 turns, telegraph a 4-cell row strike on a 2-turn timer. Phase 1
// fires Cinderblast on its base 6-turn interval; Phase 2 cuts it to 5;
// Phase 3 cuts to 4 (Pyredrake is enraged, attacks come faster — its
// signature special should accelerate too). The strike itself is
// uncounterable per spec: clearing the warning cells does NOT defuse,
// the player just has to absorb. The 2-turn warning is the tradeoff —
// it teaches them to build shields / save ULTs for the landing turn.
//
// Implementation parallels the Stormshepherd storm pattern (storms spawn
// → tick down → intensify), but Pyredrake's strike lands on the
// player's HP/shields directly, not on cells. The 4 warning cells get
// `.cinderblast-warn` painted for visibility; the cells themselves
// remain playable during the warning. On landing, the warning class is
// stripped and damage is applied (1 HP on shield-less, else 1 shield;
// scales by phase: P1=1, P2=2, P3=3 ticks).
let _pyredrakeState = null;
const PYREDRAKE_CINDERBLAST_INT_P1 = 6;
const PYREDRAKE_CINDERBLAST_INT_P2 = 5;
const PYREDRAKE_CINDERBLAST_INT_P3 = 4;
const PYREDRAKE_CINDERBLAST_WARN_TURNS = 2;
function _initPyredrakeState() {
  _pyredrakeState = {
    turnsSinceCinderblast: 0,
    incoming: null, // { row, c0, cells: [[r,c],…], turnsLeft }
  };
}
export function _resetPyredrakeState() {
  _pyredrakeWarnCells.clear();
  _pyredrakeState = null;
}
function _pyredrakeCinderblastInterval(phase) {
  if (phase >= 3) return PYREDRAKE_CINDERBLAST_INT_P3;
  if (phase >= 2) return PYREDRAKE_CINDERBLAST_INT_P2;
  return PYREDRAKE_CINDERBLAST_INT_P1;
}
export function _tickPyredrake(phase) {
  if (!_pyredrakeState) _initPyredrakeState();
  const st = _pyredrakeState;
  // Already incoming — count down then apply.
  if (st.incoming) {
    st.incoming.turnsLeft--;
    if (st.incoming.turnsLeft <= 0) {
      _pyredrakeApplyCinderblast(st.incoming, phase);
      st.incoming = null;
      st.turnsSinceCinderblast = 0;
    }
    return;
  }
  // Otherwise count toward next strike. First tick of fight starts
  // counter at 1, so first Cinderblast warning lands on turn 6 of P1
  // and the strike on turn 8.
  st.turnsSinceCinderblast++;
  if (st.turnsSinceCinderblast >= _pyredrakeCinderblastInterval(phase)) {
    _pyredrakeQueueCinderblast(phase);
  }
}
// Set of "r_c" keys for cells currently flagged for the incoming
// strike. Re-applied on every render() loop so the .cinderblast-warn
// class survives grid rebuilds — same pattern used by chargedCells /
// radiantCells / _stormTimers elsewhere in the file. Cleared when the
// strike lands or when a fight resets.
export const _pyredrakeWarnCells = new Set();
function _pyredrakeQueueCinderblast(phase) {
  // Pick a random row + 4 contiguous columns that fit on the board.
  // GRID_HEIGHT / GRID_WIDTH may not exist as constants in older builds
  // — derive from the actual grid array if needed.
  let H = 8, W = 8;
  try {
    if (typeof grid !== 'undefined' && Array.isArray(grid) && grid.length) {
      H = grid.length;
      if (Array.isArray(grid[0])) W = grid[0].length;
    }
  } catch (e) {}
  const r = Math.floor(Math.random() * H);
  const maxStart = Math.max(0, W - 4);
  const c0 = Math.floor(Math.random() * (maxStart + 1));
  const cells = [];
  for (let i = 0; i < 4; i++) cells.push([r, c0 + i]);
  _pyredrakeWarnCells.clear();
  for (const [rr, cc] of cells) _pyredrakeWarnCells.add(rr + '_' + cc);
  _pyredrakeState.incoming = { row: r, c0, cells, turnsLeft: PYREDRAKE_CINDERBLAST_WARN_TURNS };
  // Re-render so the new warning cells get .cinderblast-warn applied
  // by the render loop's pyredrake-warn fast-path.
  try { if (typeof render === 'function') render(); } catch (e) {}
  // Persistent threat banner — clears when the strike lands (turnsLeft=0
  // path) so the player always sees the timer while it's active.
  try { showThreatBanner('⚠ CINDERBLAST in 2 turns — ember row incoming', 0); } catch (e) {}
  try { vibrate([60, 40, 80, 40, 100]); } catch (e) {}
}
function _pyredrakeApplyCinderblast(incoming, phase) {
  // Clear warn-set FIRST so the render below paints clean cells, then
  // strobe the impact class on whatever cells currently exist for
  // those positions. Render runs after the strobe class is added so
  // the animation actually shows.
  _pyredrakeWarnCells.clear();
  try {
    if (typeof render === 'function') render();
    for (const [r, c] of incoming.cells) {
      const el = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      if (el) {
        el.classList.remove('cinderblast-hit');
        // Strobe red briefly on impact — telegraphed cells flash to
        // reinforce that THIS is the row the strike landed on.
        void el.offsetWidth;
        el.classList.add('cinderblast-hit');
        setTimeout(() => { try { el.classList.remove('cinderblast-hit'); } catch (e) {} }, 600);
      }
    }
  } catch (e) {}
  // Damage tier scales by phase: P1=1 tick, P2=2 ticks, P3=3 ticks.
  // Each tick = 1 shield (or 1 HP if shield-less), matching the
  // Stormshepherd intensify cadence so players can pattern-match.
  const ticks = Math.max(1, phase || 1);
  for (let i = 0; i < ticks; i++) {
    try {
      if (typeof shieldCount !== 'undefined' && shieldCount > 0) {
        shieldCount = Math.max(0, shieldCount - 1);
      } else if (typeof hp !== 'undefined') {
        hp = Math.max(0, hp - 1);
        battleDamageTaken = (battleDamageTaken || 0) + 1;
        if (hp === 0 && typeof gameEnded !== 'undefined' && !gameEnded) {
          try { if (typeof showDefeatModal === 'function') showDefeatModal(); } catch (e2) {}
          break;
        }
      }
    } catch (e) {}
  }
  try { hideThreatBanner(); } catch (e) {}
  try { flashText('🔥 CINDERBLAST!', '#FF4400', { force: true }); } catch (e) {}
  try { vibrate([200, 80, 200, 80, 400]); } catch (e) {}
  try { renderHP(); } catch (e) {}
  try { if (typeof render === 'function') render(); } catch (e) {}
}

// ─── ABYSSAL TYRANT — Row Strike / Crush Spire / Maelstrom (legacy 41349-41584) ──
// (Ch.1 Boss 2, BOSS_COMPENDIUM §1.2). Tide-themed armored boss; the
// existing kit was 70% armor + base voids only. Three telegraphed
// specials add board-state + hero-lock pressure that scales by phase.
//
// ROW STRIKE   (P1+, every 7 / 6 / 5 turns by phase, 1T telegraph)
//   Full-row strike (8 cells). Telegraphed via threat banner +
//   .row-strike-warn cell class. On landing: 1/2/3 ticks of damage by
//   phase (mirrors Cinderblast scaling).
//
// CRUSH SPIRE  (P2+, every 6 / 5 turns, 2T telegraph → hero pin)
//   Picks a random unlocked hero, marks them via .hero-card--crush-spire
//   chain overlay, sets crushSpireHeroId / TurnsLeft = 2. Player still
//   places blocks normally; the locked hero just doesn't fire ULT or
//   gain charge. Mirrors Hypnotist Tendril Coil semantics so existing
//   ability gates (e.g. ULT firing) only need the new flag check.
//
// MAELSTROM    (P2+, every 8 / 7 turns, 2T telegraph → top-row tide voids)
//   Top row of the grid is telegraphed for tide conversion. On landing,
//   every empty cell in the top row becomes a void_tide. Spec says top
//   3 rows; we land 1 row to keep difficulty fair on first install
//   (24 cells of voids would be game-ending). Subsequent passes can
//   widen this once balance signal lands.
let _abyssalTyrantState = null;
export const _abyssalRowWarnCells = new Set();
export const _abyssalMaelstromWarnCells = new Set();
export let abyssalCrushSpireHeroId = null;
export let abyssalCrushSpireTurnsLeft = 0;
export let abyssalCrushSpirePending = null; // {heroId, turnsLeft} during 2T warning
const ABYSSAL_ROW_INT_P1 = 7;
const ABYSSAL_ROW_INT_P2 = 6;
const ABYSSAL_ROW_INT_P3 = 5;
const ABYSSAL_CRUSH_INT_P2 = 6;
const ABYSSAL_CRUSH_INT_P3 = 5;
const ABYSSAL_MAELSTROM_INT_P2 = 8;
const ABYSSAL_MAELSTROM_INT_P3 = 7;
function _initAbyssalTyrantState() {
  _abyssalTyrantState = {
    turnsSinceRow: 0,         rowIncoming: null,        // {row, cells, turnsLeft}
    turnsSinceCrush: 0,                                  // pending/active in globals above
    turnsSinceMaelstrom: 0,   maelstromIncoming: null,  // {turnsLeft}
  };
}
export function _resetAbyssalTyrantState() {
  _abyssalRowWarnCells.clear();
  _abyssalMaelstromWarnCells.clear();
  abyssalCrushSpireHeroId = null;
  abyssalCrushSpireTurnsLeft = 0;
  abyssalCrushSpirePending = null;
  _abyssalTyrantState = null;
}
function _abyssalRowInterval(phase) {
  if (phase >= 3) return ABYSSAL_ROW_INT_P3;
  if (phase >= 2) return ABYSSAL_ROW_INT_P2;
  return ABYSSAL_ROW_INT_P1;
}
function _abyssalCrushInterval(phase) {
  return phase >= 3 ? ABYSSAL_CRUSH_INT_P3 : ABYSSAL_CRUSH_INT_P2;
}
function _abyssalMaelstromInterval(phase) {
  return phase >= 3 ? ABYSSAL_MAELSTROM_INT_P3 : ABYSSAL_MAELSTROM_INT_P2;
}
export function _tickAbyssalTyrant(phase) {
  if (!_abyssalTyrantState) _initAbyssalTyrantState();
  const st = _abyssalTyrantState;

  // ROW STRIKE — phase-1+. Apply on landing → reset counter.
  if (st.rowIncoming) {
    st.rowIncoming.turnsLeft--;
    if (st.rowIncoming.turnsLeft <= 0) {
      _abyssalApplyRowStrike(st.rowIncoming, phase);
      st.rowIncoming = null;
      st.turnsSinceRow = 0;
    }
  } else {
    st.turnsSinceRow++;
    if (st.turnsSinceRow >= _abyssalRowInterval(phase)) {
      _abyssalQueueRowStrike();
    }
  }

  // CRUSH SPIRE — phase-2+. Active lock decays each tick.
  if (abyssalCrushSpireTurnsLeft > 0) {
    abyssalCrushSpireTurnsLeft--;
    if (abyssalCrushSpireTurnsLeft === 0) {
      try { flashStateBanner('⚓ CRUSH SPIRE · RELEASED', '#3B8BD4'); } catch (e) {}
      abyssalCrushSpireHeroId = null;
      try { _abyssalRenderCrushSpireVisual(); } catch (e) {}
    }
  }
  if (abyssalCrushSpirePending) {
    abyssalCrushSpirePending.turnsLeft--;
    if (abyssalCrushSpirePending.turnsLeft <= 0) {
      _abyssalApplyCrushSpire(abyssalCrushSpirePending.heroId);
      abyssalCrushSpirePending = null;
      st.turnsSinceCrush = 0;
    }
  } else if (phase >= 2 && abyssalCrushSpireTurnsLeft === 0) {
    st.turnsSinceCrush++;
    if (st.turnsSinceCrush >= _abyssalCrushInterval(phase)) {
      _abyssalQueueCrushSpire();
    }
  }

  // MAELSTROM — phase-2+. Top-row tide-void conversion on landing.
  if (st.maelstromIncoming) {
    st.maelstromIncoming.turnsLeft--;
    if (st.maelstromIncoming.turnsLeft <= 0) {
      _abyssalApplyMaelstrom();
      st.maelstromIncoming = null;
      st.turnsSinceMaelstrom = 0;
    }
  } else if (phase >= 2) {
    st.turnsSinceMaelstrom++;
    if (st.turnsSinceMaelstrom >= _abyssalMaelstromInterval(phase)) {
      _abyssalQueueMaelstrom();
    }
  }
}
function _abyssalQueueRowStrike() {
  let H = 8, W = 8;
  try {
    if (Array.isArray(grid) && grid.length) { H = grid.length; if (Array.isArray(grid[0])) W = grid[0].length; }
  } catch (e) {}
  const r = Math.floor(Math.random() * H);
  const cells = [];
  for (let c = 0; c < W; c++) cells.push([r, c]);
  _abyssalRowWarnCells.clear();
  for (const [rr, cc] of cells) _abyssalRowWarnCells.add(rr + '_' + cc);
  _abyssalTyrantState.rowIncoming = { row: r, cells, turnsLeft: 1 };
  try { showThreatBanner('⚠ ROW STRIKE · NEXT TURN — full row incoming', 0); } catch (e) {}
  try { vibrate([60, 40, 80]); } catch (e) {}
  try { if (typeof render === 'function') render(); } catch (e) {}
}
function _abyssalApplyRowStrike(incoming, phase) {
  _abyssalRowWarnCells.clear();
  try {
    if (typeof render === 'function') render();
    for (const [r, c] of incoming.cells) {
      const el = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      if (el) {
        el.classList.remove('row-strike-hit'); void el.offsetWidth;
        el.classList.add('row-strike-hit');
        setTimeout(() => { try { el.classList.remove('row-strike-hit'); } catch (e) {} }, 600);
      }
    }
  } catch (e) {}
  const ticks = Math.max(1, phase || 1);
  for (let i = 0; i < ticks; i++) {
    try {
      if (typeof shieldCount !== 'undefined' && shieldCount > 0) {
        shieldCount = Math.max(0, shieldCount - 1);
      } else if (typeof hp !== 'undefined') {
        hp = Math.max(0, hp - 1);
        battleDamageTaken = (battleDamageTaken || 0) + 1;
        if (hp === 0 && typeof gameEnded !== 'undefined' && !gameEnded) {
          try { if (typeof showDefeatModal === 'function') showDefeatModal(); } catch (e2) {}
          break;
        }
      }
    } catch (e) {}
  }
  try { hideThreatBanner(); } catch (e) {}
  try { flashText('🌊 ROW STRIKE!', '#3B8BD4', { force: true }); } catch (e) {}
  try { vibrate([200, 80, 200]); } catch (e) {}
  try { renderHP(); if (typeof render === 'function') render(); } catch (e) {}
}
function _abyssalQueueCrushSpire() {
  if (typeof HERO_DECK === 'undefined' || !Array.isArray(HERO_DECK)) return;
  const candidates = HERO_DECK.filter(h => h && h.id && h.id !== abyssalCrushSpireHeroId);
  if (candidates.length === 0) return;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  abyssalCrushSpirePending = { heroId: target.id, turnsLeft: 2, name: target.name };
  try { showThreatBanner('⚠ CRUSH SPIRE on ' + target.name + ' in 2 turns', 0); } catch (e) {}
  try { _abyssalRenderCrushSpireVisual(); } catch (e) {}
  try { vibrate([60, 40, 60, 40, 80]); } catch (e) {}
}
function _abyssalApplyCrushSpire(heroId) {
  abyssalCrushSpireHeroId = heroId;
  abyssalCrushSpireTurnsLeft = 2;
  try { hideThreatBanner(); } catch (e) {}
  let name = heroId;
  try {
    const h = (HERO_DECK || []).find(x => x && x.id === heroId);
    if (h && h.name) name = h.name;
  } catch (e) {}
  try { flashStateBanner('⚓ CRUSH SPIRE · ' + name + ' PINNED 2T', '#3B8BD4', 3200); } catch (e) {}
  try { vibrate([180, 60, 180, 60, 220]); } catch (e) {}
  try { _abyssalRenderCrushSpireVisual(); } catch (e) {}
}
export function _abyssalRenderCrushSpireVisual() {
  // Re-paints chain overlay on hero card. Pending = warning (faint),
  // active lock = full chain. Idempotent — safe on every render.
  try {
    const cards = document.querySelectorAll('.hero-card');
    for (const card of cards) {
      const id = card.dataset && card.dataset.id;
      if (!id) { card.classList.remove('hero-card--crush-spire-warn', 'hero-card--crush-spire-locked'); continue; }
      const isPending = abyssalCrushSpirePending && abyssalCrushSpirePending.heroId === id;
      const isLocked  = abyssalCrushSpireHeroId === id && abyssalCrushSpireTurnsLeft > 0;
      card.classList.toggle('hero-card--crush-spire-warn', !!isPending);
      card.classList.toggle('hero-card--crush-spire-locked', !!isLocked);
    }
  } catch (e) {}
}
function _abyssalQueueMaelstrom() {
  let W = 8;
  try { if (Array.isArray(grid) && Array.isArray(grid[0])) W = grid[0].length; } catch (e) {}
  // Top row only — see comment at top of block. Empty cells get
  // telegraphed; cells already filled stay as-is (the maelstrom can't
  // overwrite played pieces during the warning).
  _abyssalMaelstromWarnCells.clear();
  for (let c = 0; c < W; c++) _abyssalMaelstromWarnCells.add('0_' + c);
  _abyssalTyrantState.maelstromIncoming = { turnsLeft: 2 };
  try { showThreatBanner('⚠ MAELSTROM in 2 turns — top row tides incoming', 0); } catch (e) {}
  try { vibrate([100, 50, 100, 50, 100]); } catch (e) {}
  try { if (typeof render === 'function') render(); } catch (e) {}
}
function _abyssalApplyMaelstrom() {
  let W = 8;
  try { if (Array.isArray(grid) && Array.isArray(grid[0])) W = grid[0].length; } catch (e) {}
  let converted = 0;
  try {
    for (let c = 0; c < W; c++) {
      if (!grid[0][c]) {
        grid[0][c] = 'void_tide';
        converted++;
      }
    }
  } catch (e) {}
  _abyssalMaelstromWarnCells.clear();
  try { hideThreatBanner(); } catch (e) {}
  try { flashText('🌀 MAELSTROM! · ' + converted + ' tides', '#3B8BD4', { force: true }); } catch (e) {}
  try { vibrate([220, 90, 220, 90, 360]); } catch (e) {}
  try { if (typeof render === 'function') render(); } catch (e) {}
}

// ─── GROVEWARDEN — Bloom Strike / Root Bind / Forest Wrath (legacy 41586-41793 + 42232-42264) ──
// (Ch.1 Boss 3, BOSS_COMPENDIUM §1.3). Grove-themed bruiser; previously
// ran on the passive `grove_bloom_heal` (2% / 4 turns) plus archetype HP
// inflation only. Three new specials add board-state pressure that
// teaches the player to read 3-turn telegraphs (longer warning than
// Pyredrake's 2T / Abyssal's 1-2T).
//
// BLOOM STRIKE  (P1+, every 8 / 7 / 6 turns by phase, 3T telegraph)
//   4-cell cluster strike (2x2 patch). Same threat-banner + cell-warn
//   pattern as Pyredrake Cinderblast but slower pulse + green palette.
//   On landing: 1/2/3 ticks of damage by phase.
//
// ROOT BIND     (P1+, every 7 / 6 / 5 turns, 3T duration → cell lock)
//   Picks 2 random empty cells, paints them with vine overlay, makes
//   them unplayable for 3 turns (canPlace gate refuses placement).
//   Auto-clears after 3T. No telegraph — this is the persistent
//   board-state effect, not an attack.
//
// FOREST WRATH  (P3+, every 8 turns, 3T telegraph → big AoE)
//   Phase 3 only. 4-cell + (plus) shape on a random center, 3T warn,
//   bigger damage tier (3 ticks). Spec calls this Grovewarden's
//   signature panic phase — long telegraph, hard hit.
let _grovewardenState = null;
export const _grovewardenBloomWarnCells = new Set();
export const _grovewardenWrathWarnCells = new Set();
export const _grovewardenRootBindCells = new Map(); // key "r_c" → turnsLeft
const GROVE_BLOOM_INT_P1 = 8;
const GROVE_BLOOM_INT_P2 = 7;
const GROVE_BLOOM_INT_P3 = 6;
const GROVE_ROOT_INT_P1 = 7;
const GROVE_ROOT_INT_P2 = 6;
const GROVE_ROOT_INT_P3 = 5;
const GROVE_ROOT_DURATION = 3;
const GROVE_WRATH_INT = 8;
function _initGrovewardenState() {
  _grovewardenState = {
    turnsSinceBloom: 0,  bloomIncoming: null,  // {cells, turnsLeft}
    turnsSinceRoot: 0,
    turnsSinceWrath: 0,  wrathIncoming: null,  // {cells, turnsLeft}
  };
}
export function _resetGrovewardenState() {
  _grovewardenBloomWarnCells.clear();
  _grovewardenWrathWarnCells.clear();
  _grovewardenRootBindCells.clear();
  _grovewardenState = null;
}
function _groveBloomInterval(phase) {
  if (phase >= 3) return GROVE_BLOOM_INT_P3;
  if (phase >= 2) return GROVE_BLOOM_INT_P2;
  return GROVE_BLOOM_INT_P1;
}
function _groveRootInterval(phase) {
  if (phase >= 3) return GROVE_ROOT_INT_P3;
  if (phase >= 2) return GROVE_ROOT_INT_P2;
  return GROVE_ROOT_INT_P1;
}
export function _tickGrovewarden(phase) {
  if (!_grovewardenState) _initGrovewardenState();
  const st = _grovewardenState;

  // Tick down active root binds first so they release at the start of
  // the player's turn. When count hits 0 we clear the lock.
  if (_grovewardenRootBindCells.size > 0) {
    const drop = [];
    for (const [k, t] of _grovewardenRootBindCells.entries()) {
      const next = t - 1;
      if (next <= 0) drop.push(k);
      else _grovewardenRootBindCells.set(k, next);
    }
    for (const k of drop) _grovewardenRootBindCells.delete(k);
    if (drop.length > 0) {
      try { flashStateBanner('🌿 ROOT BIND · RELEASED', '#5DCA79'); } catch (e) {}
      try { if (typeof render === 'function') render(); } catch (e) {}
    }
  }

  // BLOOM STRIKE
  if (st.bloomIncoming) {
    st.bloomIncoming.turnsLeft--;
    if (st.bloomIncoming.turnsLeft <= 0) {
      _grovewardenApplyBloomStrike(st.bloomIncoming, phase);
      st.bloomIncoming = null;
      st.turnsSinceBloom = 0;
    }
  } else {
    st.turnsSinceBloom++;
    if (st.turnsSinceBloom >= _groveBloomInterval(phase)) {
      _grovewardenQueueBloomStrike();
    }
  }

  // ROOT BIND — only spawn new bind if no bind is currently active
  // (avoids stacking too much board lock at once).
  if (_grovewardenRootBindCells.size === 0) {
    st.turnsSinceRoot++;
    if (st.turnsSinceRoot >= _groveRootInterval(phase)) {
      _grovewardenApplyRootBind(phase);
      st.turnsSinceRoot = 0;
    }
  }

  // FOREST WRATH — phase 3+
  if (st.wrathIncoming) {
    st.wrathIncoming.turnsLeft--;
    if (st.wrathIncoming.turnsLeft <= 0) {
      _grovewardenApplyForestWrath(st.wrathIncoming, phase);
      st.wrathIncoming = null;
      st.turnsSinceWrath = 0;
    }
  } else if (phase >= 3) {
    st.turnsSinceWrath++;
    if (st.turnsSinceWrath >= GROVE_WRATH_INT) {
      _grovewardenQueueForestWrath();
    }
  }
}
function _grovewardenQueueBloomStrike() {
  let H = 8, W = 8;
  try {
    if (Array.isArray(grid) && grid.length) { H = grid.length; if (Array.isArray(grid[0])) W = grid[0].length; }
  } catch (e) {}
  // 2x2 patch — pick top-left so the patch fits on the board.
  const r0 = Math.floor(Math.random() * Math.max(1, H - 1));
  const c0 = Math.floor(Math.random() * Math.max(1, W - 1));
  const cells = [[r0, c0], [r0, c0 + 1], [r0 + 1, c0], [r0 + 1, c0 + 1]];
  _grovewardenBloomWarnCells.clear();
  for (const [r, c] of cells) _grovewardenBloomWarnCells.add(r + '_' + c);
  _grovewardenState.bloomIncoming = { cells, turnsLeft: 3 };
  try { showThreatBanner('⚠ BLOOM STRIKE in 3 turns — corruption blooming', 0); } catch (e) {}
  try { vibrate([60, 40, 60, 40, 80]); } catch (e) {}
  try { if (typeof render === 'function') render(); } catch (e) {}
}
function _grovewardenApplyBloomStrike(incoming, phase) {
  _grovewardenBloomWarnCells.clear();
  try {
    if (typeof render === 'function') render();
    for (const [r, c] of incoming.cells) {
      const el = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      if (el) {
        el.classList.remove('bloom-strike-hit'); void el.offsetWidth;
        el.classList.add('bloom-strike-hit');
        setTimeout(() => { try { el.classList.remove('bloom-strike-hit'); } catch (e) {} }, 600);
      }
    }
  } catch (e) {}
  const ticks = Math.max(1, phase || 1);
  for (let i = 0; i < ticks; i++) {
    try {
      if (typeof shieldCount !== 'undefined' && shieldCount > 0) {
        shieldCount = Math.max(0, shieldCount - 1);
      } else if (typeof hp !== 'undefined') {
        hp = Math.max(0, hp - 1);
        battleDamageTaken = (battleDamageTaken || 0) + 1;
        if (hp === 0 && typeof gameEnded !== 'undefined' && !gameEnded) {
          try { if (typeof showDefeatModal === 'function') showDefeatModal(); } catch (e2) {}
          break;
        }
      }
    } catch (e) {}
  }
  try { hideThreatBanner(); } catch (e) {}
  try { flashText('🌿 BLOOM STRIKE!', '#5DCA79', { force: true }); } catch (e) {}
  try { vibrate([200, 80, 200, 80, 400]); } catch (e) {}
  try { renderHP(); if (typeof render === 'function') render(); } catch (e) {}
}
function _grovewardenApplyRootBind(phase) {
  // Pick 2 random empty cells. If fewer than 2 empty exist, fall back
  // to whatever is available — root bind shouldn't fail just because
  // the board is full.
  let H = 8, W = 8;
  try {
    if (Array.isArray(grid) && grid.length) { H = grid.length; if (Array.isArray(grid[0])) W = grid[0].length; }
  } catch (e) {}
  const empties = [];
  try {
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      if (!grid[r][c]) empties.push([r, c]);
    }
  } catch (e) {}
  if (empties.length === 0) return;
  empties.sort(() => Math.random() - 0.5);
  const picks = empties.slice(0, Math.min(2, empties.length));
  for (const [r, c] of picks) {
    _grovewardenRootBindCells.set(r + '_' + c, GROVE_ROOT_DURATION);
  }
  try { flashStateBanner('🌿 ROOT BIND · ' + picks.length + ' cell' + (picks.length === 1 ? '' : 's') + ' bound 3T', '#5DCA79', 3000); } catch (e) {}
  try { vibrate([80, 50, 80]); } catch (e) {}
  try { if (typeof render === 'function') render(); } catch (e) {}
}
function _grovewardenQueueForestWrath() {
  let H = 8, W = 8;
  try {
    if (Array.isArray(grid) && grid.length) { H = grid.length; if (Array.isArray(grid[0])) W = grid[0].length; }
  } catch (e) {}
  // Plus-shape: center + N/S/E/W. Pick a center that fits.
  const r = 1 + Math.floor(Math.random() * Math.max(1, H - 2));
  const c = 1 + Math.floor(Math.random() * Math.max(1, W - 2));
  const cells = [[r, c], [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
  // Spec calls Forest Wrath a 4-cell AoE; the +-shape is 5 cells, we
  // drop the center to give the player a tiny safe zone visual cue.
  const damaged = cells.slice(1);
  _grovewardenWrathWarnCells.clear();
  for (const [rr, cc] of damaged) _grovewardenWrathWarnCells.add(rr + '_' + cc);
  _grovewardenState.wrathIncoming = { cells: damaged, turnsLeft: 3 };
  try { showThreatBanner('⚠ FOREST WRATH in 3 turns — root pillars rising', 0); } catch (e) {}
  try { vibrate([100, 60, 100, 60, 140]); } catch (e) {}
  try { if (typeof render === 'function') render(); } catch (e) {}
}
function _grovewardenApplyForestWrath(incoming, phase) {
  _grovewardenWrathWarnCells.clear();
  try {
    if (typeof render === 'function') render();
    for (const [r, c] of incoming.cells) {
      const el = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      if (el) {
        el.classList.remove('forest-wrath-hit'); void el.offsetWidth;
        el.classList.add('forest-wrath-hit');
        setTimeout(() => { try { el.classList.remove('forest-wrath-hit'); } catch (e) {} }, 700);
      }
    }
  } catch (e) {}
  // Forest Wrath always fires at 3 ticks (it's a phase-3 panic move).
  for (let i = 0; i < 3; i++) {
    try {
      if (typeof shieldCount !== 'undefined' && shieldCount > 0) {
        shieldCount = Math.max(0, shieldCount - 1);
      } else if (typeof hp !== 'undefined') {
        hp = Math.max(0, hp - 1);
        battleDamageTaken = (battleDamageTaken || 0) + 1;
        if (hp === 0 && typeof gameEnded !== 'undefined' && !gameEnded) {
          try { if (typeof showDefeatModal === 'function') showDefeatModal(); } catch (e2) {}
          break;
        }
      }
    } catch (e) {}
  }
  try { hideThreatBanner(); } catch (e) {}
  try { flashText('🌳 FOREST WRATH!', '#3FAA52', { force: true }); } catch (e) {}
  try { vibrate([260, 100, 260, 100, 460]); } catch (e) {}
  try { renderHP(); if (typeof render === 'function') render(); } catch (e) {}
}

// ─── SOLAR PHOENIX — Solar Line / Solar Storm (legacy 41795-41973) ───────────
// (Ch.1 Boss 4, BOSS_COMPENDIUM §1.4). Solar/yellow palette. Existing
// Phoenix kit was the 60% revive flag (kept) + generic voids; the
// spec'd column-strike telegraphs were unimplemented. Phoenix stays
// special by tying SOLAR STORM to the post-revive flag rather than the
// HP phase — even if the player kills the boss back down to 33% after
// revive, Solar Storm only fires once they've earned the revive trigger.
//
// SOLAR LINE   (P1+, every 7 / 6 / 5 turns by phase, 1T telegraph)
//   Single-column strike (full column = 8 cells). Telegraphed via
//   threat banner + .solar-line-warn cell class. P1=1 / P2=2 / P3=3
//   ticks of damage on landing.
//
// SOLAR STORM  (post-revive only, every 6 turns, 1T telegraph → 2 columns)
//   Phase 3 panic move: TWO random columns telegraphed at once. Always
//   3 ticks of damage. Bigger pulse + brighter palette so the eye
//   reads "the bird is back and angry".
let _solarPhoenixState = null;
export const _solarLineWarnCells = new Set();
export const _solarStormWarnCells = new Set();
const SOLAR_LINE_INT_P1 = 7;
const SOLAR_LINE_INT_P2 = 6;
const SOLAR_LINE_INT_P3 = 5;
const SOLAR_STORM_INT = 6;
function _initSolarPhoenixState() {
  _solarPhoenixState = {
    turnsSinceLine: 0,  lineIncoming: null,
    turnsSinceStorm: 0, stormIncoming: null,
  };
}
export function _resetSolarPhoenixState() {
  _solarLineWarnCells.clear();
  _solarStormWarnCells.clear();
  _solarPhoenixState = null;
}
function _solarLineInterval(phase) {
  if (phase >= 3) return SOLAR_LINE_INT_P3;
  if (phase >= 2) return SOLAR_LINE_INT_P2;
  return SOLAR_LINE_INT_P1;
}
export function _tickSolarPhoenix(phase) {
  if (!_solarPhoenixState) _initSolarPhoenixState();
  const st = _solarPhoenixState;

  // SOLAR LINE — phase-1+
  if (st.lineIncoming) {
    st.lineIncoming.turnsLeft--;
    if (st.lineIncoming.turnsLeft <= 0) {
      _solarApplyLine(st.lineIncoming, phase);
      st.lineIncoming = null;
      st.turnsSinceLine = 0;
    }
  } else {
    st.turnsSinceLine++;
    if (st.turnsSinceLine >= _solarLineInterval(phase)) {
      _solarQueueLine();
    }
  }

  // SOLAR STORM — post-revive only
  const postRevive = (typeof bossRevivedOnce !== 'undefined' && bossRevivedOnce);
  if (st.stormIncoming) {
    st.stormIncoming.turnsLeft--;
    if (st.stormIncoming.turnsLeft <= 0) {
      _solarApplyStorm(st.stormIncoming);
      st.stormIncoming = null;
      st.turnsSinceStorm = 0;
    }
  } else if (postRevive) {
    st.turnsSinceStorm++;
    if (st.turnsSinceStorm >= SOLAR_STORM_INT) {
      _solarQueueStorm();
    }
  }
}
function _solarQueueLine() {
  let H = 8, W = 8;
  try {
    if (Array.isArray(grid) && grid.length) { H = grid.length; if (Array.isArray(grid[0])) W = grid[0].length; }
  } catch (e) {}
  const c = Math.floor(Math.random() * W);
  const cells = [];
  for (let r = 0; r < H; r++) cells.push([r, c]);
  _solarLineWarnCells.clear();
  for (const [rr, cc] of cells) _solarLineWarnCells.add(rr + '_' + cc);
  _solarPhoenixState.lineIncoming = { col: c, cells, turnsLeft: 1 };
  try { showThreatBanner('⚠ SOLAR LINE · NEXT TURN — column strike incoming', 0); } catch (e) {}
  try { vibrate([60, 40, 80]); } catch (e) {}
  try { if (typeof render === 'function') render(); } catch (e) {}
}
function _solarApplyLine(incoming, phase) {
  _solarLineWarnCells.clear();
  try {
    if (typeof render === 'function') render();
    for (const [r, c] of incoming.cells) {
      const el = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      if (el) {
        el.classList.remove('solar-line-hit'); void el.offsetWidth;
        el.classList.add('solar-line-hit');
        setTimeout(() => { try { el.classList.remove('solar-line-hit'); } catch (e) {} }, 600);
      }
    }
  } catch (e) {}
  const ticks = Math.max(1, phase || 1);
  for (let i = 0; i < ticks; i++) {
    try {
      if (typeof shieldCount !== 'undefined' && shieldCount > 0) {
        shieldCount = Math.max(0, shieldCount - 1);
      } else if (typeof hp !== 'undefined') {
        hp = Math.max(0, hp - 1);
        battleDamageTaken = (battleDamageTaken || 0) + 1;
        if (hp === 0 && typeof gameEnded !== 'undefined' && !gameEnded) {
          try { if (typeof showDefeatModal === 'function') showDefeatModal(); } catch (e2) {}
          break;
        }
      }
    } catch (e) {}
  }
  try { hideThreatBanner(); } catch (e) {}
  try { flashText('☀ SOLAR LINE!', '#E8B84A', { force: true }); } catch (e) {}
  try { vibrate([200, 80, 200]); } catch (e) {}
  try { renderHP(); if (typeof render === 'function') render(); } catch (e) {}
}
function _solarQueueStorm() {
  let H = 8, W = 8;
  try {
    if (Array.isArray(grid) && grid.length) { H = grid.length; if (Array.isArray(grid[0])) W = grid[0].length; }
  } catch (e) {}
  // Two distinct columns. If the board is somehow 1-wide, fall back to
  // one column rather than spinning forever.
  const cols = [];
  cols.push(Math.floor(Math.random() * W));
  if (W > 1) {
    let c2 = Math.floor(Math.random() * W);
    while (c2 === cols[0]) c2 = Math.floor(Math.random() * W);
    cols.push(c2);
  }
  const cells = [];
  for (const c of cols) for (let r = 0; r < H; r++) cells.push([r, c]);
  _solarStormWarnCells.clear();
  for (const [rr, cc] of cells) _solarStormWarnCells.add(rr + '_' + cc);
  _solarPhoenixState.stormIncoming = { cols, cells, turnsLeft: 1 };
  try { showThreatBanner('⚠ SOLAR STORM · NEXT TURN — twin columns incoming', 0); } catch (e) {}
  try { vibrate([100, 60, 100, 60, 140]); } catch (e) {}
  try { if (typeof render === 'function') render(); } catch (e) {}
}
function _solarApplyStorm(incoming) {
  _solarStormWarnCells.clear();
  try {
    if (typeof render === 'function') render();
    for (const [r, c] of incoming.cells) {
      const el = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      if (el) {
        el.classList.remove('solar-storm-hit'); void el.offsetWidth;
        el.classList.add('solar-storm-hit');
        setTimeout(() => { try { el.classList.remove('solar-storm-hit'); } catch (e) {} }, 700);
      }
    }
  } catch (e) {}
  // Solar Storm always fires at 3 ticks (post-revive panic move).
  for (let i = 0; i < 3; i++) {
    try {
      if (typeof shieldCount !== 'undefined' && shieldCount > 0) {
        shieldCount = Math.max(0, shieldCount - 1);
      } else if (typeof hp !== 'undefined') {
        hp = Math.max(0, hp - 1);
        battleDamageTaken = (battleDamageTaken || 0) + 1;
        if (hp === 0 && typeof gameEnded !== 'undefined' && !gameEnded) {
          try { if (typeof showDefeatModal === 'function') showDefeatModal(); } catch (e2) {}
          break;
        }
      }
    } catch (e) {}
  }
  try { hideThreatBanner(); } catch (e) {}
  try { flashText('☀☀ SOLAR STORM!', '#FFD200', { force: true }); } catch (e) {}
  try { vibrate([260, 100, 260, 100, 460]); } catch (e) {}
  try { renderHP(); if (typeof render === 'function') render(); } catch (e) {}
}

// ─── CRYPT LICH — Dark Geometry / Soul Drain / Necropulse (legacy 42015-42230) ──
// (Ch.1 Boss 5 = Final Overlord, BOSS_COMPENDIUM §1.5). Umbra-themed
// assassin. Existing kit was the 1.4× damage / 4-turn attack interval
// archetype + spawnBurst phase 3. Three new specials transform the
// final Ch.1 boss from a fast generic-attack pattern into a layered
// pressure cooker: spike (Dark Geometry) + grind (Soul Drain) +
// punish-your-board (Necropulse).
//
// DARK GEOMETRY  (P1+, every 6 / 5 / 4 turns by phase, 1T telegraph)
//   4-cell diamond/cross pattern (center + 4 cardinal neighbors,
//   center dropped for visual safe-zone). 1T tel + .dark-geometry-warn
//   cell glow. P1=1 / P2=2 / P3=3 ticks of damage on landing.
//
// SOUL DRAIN     (P2+, persistent: 1 shield/HP every 3 turns at P2,
//                 every 2 turns at P3)
//   Permanent passive damage tick — no telegraph, no skill-check. The
//   only counter is "kill the boss faster". State banner confirms
//   "💀 SOUL DRAIN ACTIVE" on phase 2 transition; per-tick flash on
//   each drain. Per-tick haptic so the player feels the grind.
//
// NECROPULSE     (P3+, every 8 turns, 1T telegraph)
//   Phase 3 panic move. Counts every `umbra` cell currently on the
//   board, deals 1 damage per pair (floor(count / 2)). Rewards
//   players who don't hoard umbra cells in the final phase. Capped
//   at 4 ticks so it can't one-shot from a maxed board.
let _cryptLichState = null;
export const _cryptLichGeometryWarnCells = new Set();
let _cryptLichSoulDrainAnnounced = false;
export let _cryptLichNecropulsePending = false;
const CRYPT_GEOMETRY_INT_P1 = 6;
const CRYPT_GEOMETRY_INT_P2 = 5;
const CRYPT_GEOMETRY_INT_P3 = 4;
const CRYPT_SOULDRAIN_INT_P2 = 3;
const CRYPT_SOULDRAIN_INT_P3 = 2;
const CRYPT_NECROPULSE_INT = 8;
const CRYPT_NECROPULSE_MAX_TICKS = 4;
function _initCryptLichState() {
  _cryptLichState = {
    turnsSinceGeo: 0,         geoIncoming: null,
    turnsSinceSoulDrain: 0,
    turnsSinceNecropulse: 0,  necropulseCountdown: 0, // 1T telegraph
  };
}
export function _resetCryptLichState() {
  _cryptLichGeometryWarnCells.clear();
  _cryptLichSoulDrainAnnounced = false;
  _cryptLichNecropulsePending = false;
  _cryptLichState = null;
}
function _cryptGeometryInterval(phase) {
  if (phase >= 3) return CRYPT_GEOMETRY_INT_P3;
  if (phase >= 2) return CRYPT_GEOMETRY_INT_P2;
  return CRYPT_GEOMETRY_INT_P1;
}
function _cryptSoulDrainInterval(phase) {
  return phase >= 3 ? CRYPT_SOULDRAIN_INT_P3 : CRYPT_SOULDRAIN_INT_P2;
}
export function _tickCryptLich(phase) {
  if (!_cryptLichState) _initCryptLichState();
  const st = _cryptLichState;

  // SOUL DRAIN — phase-2+ persistent passive
  if (phase >= 2) {
    if (!_cryptLichSoulDrainAnnounced) {
      _cryptLichSoulDrainAnnounced = true;
      try { flashStateBanner('💀 SOUL DRAIN ACTIVE — boss leeches your soul', '#9B59D6', 3200); } catch (e) {}
    }
    st.turnsSinceSoulDrain++;
    if (st.turnsSinceSoulDrain >= _cryptSoulDrainInterval(phase)) {
      st.turnsSinceSoulDrain = 0;
      _cryptApplySoulDrain();
    }
  }

  // DARK GEOMETRY — phase-1+
  if (st.geoIncoming) {
    st.geoIncoming.turnsLeft--;
    if (st.geoIncoming.turnsLeft <= 0) {
      _cryptApplyDarkGeometry(st.geoIncoming, phase);
      st.geoIncoming = null;
      st.turnsSinceGeo = 0;
    }
  } else {
    st.turnsSinceGeo++;
    if (st.turnsSinceGeo >= _cryptGeometryInterval(phase)) {
      _cryptQueueDarkGeometry();
    }
  }

  // NECROPULSE — phase-3+
  if (st.necropulseCountdown > 0) {
    st.necropulseCountdown--;
    if (st.necropulseCountdown === 0) {
      _cryptApplyNecropulse();
      _cryptLichNecropulsePending = false;
      st.turnsSinceNecropulse = 0;
    }
  } else if (phase >= 3) {
    st.turnsSinceNecropulse++;
    if (st.turnsSinceNecropulse >= CRYPT_NECROPULSE_INT) {
      _cryptQueueNecropulse();
    }
  }
}
function _cryptApplySoulDrain() {
  try {
    if (typeof shieldCount !== 'undefined' && shieldCount > 0) {
      shieldCount = Math.max(0, shieldCount - 1);
      try { flashText('💀 SOUL DRAIN · 🛡 absorbed', '#9B59D6'); } catch (e) {}
    } else if (typeof hp !== 'undefined') {
      hp = Math.max(0, hp - 1);
      battleDamageTaken = (battleDamageTaken || 0) + 1;
      try { flashText('💀 SOUL DRAIN · −1 HP', '#9B59D6'); renderHP(); } catch (e) {}
      if (hp === 0 && typeof gameEnded !== 'undefined' && !gameEnded) {
        try { if (typeof showDefeatModal === 'function') showDefeatModal(); } catch (e2) {}
      }
    }
  } catch (e) {}
  try { vibrate([60]); } catch (e) {}
}
function _cryptQueueDarkGeometry() {
  let H = 8, W = 8;
  try {
    if (Array.isArray(grid) && grid.length) { H = grid.length; if (Array.isArray(grid[0])) W = grid[0].length; }
  } catch (e) {}
  // Diamond: center + 4 cardinal neighbors. Drop the center for a tiny
  // safe-zone visual cue — the 4 outer cells are what take the hit.
  const r = 1 + Math.floor(Math.random() * Math.max(1, H - 2));
  const c = 1 + Math.floor(Math.random() * Math.max(1, W - 2));
  const cells = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
  _cryptLichGeometryWarnCells.clear();
  for (const [rr, cc] of cells) _cryptLichGeometryWarnCells.add(rr + '_' + cc);
  _cryptLichState.geoIncoming = { center: [r, c], cells, turnsLeft: 1 };
  try { showThreatBanner('⚠ DARK GEOMETRY · NEXT TURN — diamond pattern incoming', 0); } catch (e) {}
  try { vibrate([80, 50, 80]); } catch (e) {}
  try { if (typeof render === 'function') render(); } catch (e) {}
}
function _cryptApplyDarkGeometry(incoming, phase) {
  _cryptLichGeometryWarnCells.clear();
  try {
    if (typeof render === 'function') render();
    for (const [r, c] of incoming.cells) {
      const el = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      if (el) {
        el.classList.remove('dark-geometry-hit'); void el.offsetWidth;
        el.classList.add('dark-geometry-hit');
        setTimeout(() => { try { el.classList.remove('dark-geometry-hit'); } catch (e) {} }, 600);
      }
    }
  } catch (e) {}
  const ticks = Math.max(1, phase || 1);
  for (let i = 0; i < ticks; i++) {
    try {
      if (typeof shieldCount !== 'undefined' && shieldCount > 0) {
        shieldCount = Math.max(0, shieldCount - 1);
      } else if (typeof hp !== 'undefined') {
        hp = Math.max(0, hp - 1);
        battleDamageTaken = (battleDamageTaken || 0) + 1;
        if (hp === 0 && typeof gameEnded !== 'undefined' && !gameEnded) {
          try { if (typeof showDefeatModal === 'function') showDefeatModal(); } catch (e2) {}
          break;
        }
      }
    } catch (e) {}
  }
  try { hideThreatBanner(); } catch (e) {}
  try { flashText('🔮 DARK GEOMETRY!', '#9B59D6', { force: true }); } catch (e) {}
  try { vibrate([200, 80, 200, 80, 320]); } catch (e) {}
  try { renderHP(); if (typeof render === 'function') render(); } catch (e) {}
}
function _cryptQueueNecropulse() {
  _cryptLichState.necropulseCountdown = 1;
  _cryptLichNecropulsePending = true;
  try { showThreatBanner('⚠ NECROPULSE · NEXT TURN — your umbra cells will lash out', 0); } catch (e) {}
  try { flashStateBanner('💀 NECROPULSE INCOMING', '#9B59D6', 3200); } catch (e) {}
  try { vibrate([100, 60, 100, 60, 100]); } catch (e) {}
  // Re-render so any future _cryptLichNecropulsePending visuals (e.g.
  // every umbra cell briefly tagged) take effect; cheap no-op if no
  // visual pass is wired.
  try { if (typeof render === 'function') render(); } catch (e) {}
}
function _cryptApplyNecropulse() {
  // Count umbra cells on the board — both regular umbra placements
  // and any void_umbra cells contribute. Damage = floor(count / 2),
  // capped at CRYPT_NECROPULSE_MAX_TICKS.
  let umbraCount = 0;
  let H = 8, W = 8;
  try {
    if (Array.isArray(grid) && grid.length) { H = grid.length; if (Array.isArray(grid[0])) W = grid[0].length; }
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const v = grid[r][c];
      if (!v) continue;
      if (v === 'umbra') umbraCount++;
      else if (typeof v === 'string' && v === 'void_umbra') umbraCount++;
    }
  } catch (e) {}
  const ticks = Math.max(1, Math.min(CRYPT_NECROPULSE_MAX_TICKS, Math.floor(umbraCount / 2) || 1));
  for (let i = 0; i < ticks; i++) {
    try {
      if (typeof shieldCount !== 'undefined' && shieldCount > 0) {
        shieldCount = Math.max(0, shieldCount - 1);
      } else if (typeof hp !== 'undefined') {
        hp = Math.max(0, hp - 1);
        battleDamageTaken = (battleDamageTaken || 0) + 1;
        if (hp === 0 && typeof gameEnded !== 'undefined' && !gameEnded) {
          try { if (typeof showDefeatModal === 'function') showDefeatModal(); } catch (e2) {}
          break;
        }
      }
    } catch (e) {}
  }
  try { hideThreatBanner(); } catch (e) {}
  try { flashText('💀 NECROPULSE! · ' + umbraCount + ' umbra → ' + ticks + ' ticks', '#9B59D6', { force: true }); } catch (e) {}
  try { vibrate([240, 100, 240, 100, 420]); } catch (e) {}
  try { renderHP(); if (typeof render === 'function') render(); } catch (e) {}
}

// ─── HYPNOTIST tick — Suggestion / Petal Fall / Tendril Coil / Bloom Bloom (legacy 42266-42390) ─
// PHASE 5b BLOCK 3: upgraded from Block 1 scaffolding to full mechanics per Compendium §6.
export function _tickHypnotist(phase) {
  // Suggestion interval shrinks per phase (P1=8, P2=6, P3=4); count 1 (P1) → 2 (P2/P3)
  const suggestInt = phase === 1 ? HYPNOTIST_SUGGEST_INT_P1
                   : phase === 2 ? HYPNOTIST_SUGGEST_INT_P2
                   : HYPNOTIST_SUGGEST_INT_P3;
  hypnotistTurnsSinceSuggest++;
  if (hypnotistTurnsSinceSuggest >= suggestInt) {
    hypnotistTurnsSinceSuggest = 0;
    const candidates = (typeof HERO_DECK !== 'undefined' && Array.isArray(HERO_DECK))
                     ? HERO_DECK.filter(h => h && h.id && h.id !== hypnotistTendrilHeroId) : [];
    candidates.sort(() => Math.random() - 0.5);
    let count = phase === 1 ? 1 : 2;
    // 2026-05-02 — COMBAT v2.1 P4 PR #4.C §4.6: hypnotist_p1_p2 dual suggest.
    // bossDualSuggestActive forces minimum 2 suggestions even at P1 (where
    // count would normally be 1). Stacks above existing P2/P3 ramp.
    if (typeof bossDualSuggestActive === 'boolean' && bossDualSuggestActive) {
      count = Math.max(count, 2);
    }
    hypnotistSuggestedHeroIds = candidates.slice(0, count).map(h => h.id);
    if (hypnotistSuggestedHeroIds.length > 0) {
      const bonus = phase === 1 ? HYPNOTIST_OBEY_BONUS_P1
                  : phase === 2 ? HYPNOTIST_OBEY_BONUS_P2
                  : HYPNOTIST_OBEY_BONUS_P3;
      try { flashText('🌸 SUGGESTION +' + Math.round(bonus * 100) + '%', '#9B59D6'); } catch(e) {}
      try { renderHypnotistVisuals(); } catch(e) {}
    }
  }
  // Petal Fall — every 5 turns, 4 random non-umbra cells → umbra
  hypnotistTurnsSincePetal++;
  if (hypnotistTurnsSincePetal >= HYPNOTIST_PETAL_INT) {
    hypnotistTurnsSincePetal = 0;
    _hypnotistPetalFall(4);
  }
  // Tendril Coil (P2+) — every 6 turns, lock 1 hero from firing for 2 turns
  if (phase >= 2) {
    hypnotistTurnsSinceTendril++;
    if (hypnotistTurnsSinceTendril >= HYPNOTIST_TENDRIL_INT && !hypnotistTendrilHeroId) {
      hypnotistTurnsSinceTendril = 0;
      _hypnotistTendrilCoil();
    }
  }
  // Bloom Bloom (P3) — every 8 turns, set corruption flag for 2 turns. While active,
  // umbra clears damage player (consumed in onUmbraCellsCleared backsplash hook).
  if (phase >= 3) {
    hypnotistTurnsSinceBloom++;
    if (hypnotistTurnsSinceBloom >= HYPNOTIST_BLOOM_INT) {
      hypnotistTurnsSinceBloom = 0;
      hypnotistBloomCorrupted = true;
      try { flashText('🌸🌸 BLOOM BLOOM · UMBRA HURTS', '#9B59D6'); } catch(e) {}
      try { vibrate([60, 40, 60, 40, 100]); } catch(e) {}
    }
  }
  // Tendril Coil decay (per turn)
  if (hypnotistTendrilTurnsLeft > 0) {
    hypnotistTendrilTurnsLeft--;
    if (hypnotistTendrilTurnsLeft === 0) {
      hypnotistTendrilHeroId = null;
      try { renderHypnotistVisuals(); } catch(e) {}
    }
  }
}

// Petal Fall — convert 4 random non-umbra cells to umbra. Runs each 5 turns
// during VEROTHIRA fight. Skips void cells. Telegraph flash precedes conversion.
function _hypnotistPetalFall(count) {
  if (typeof grid === 'undefined') return;
  const targets = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const v = grid[r][c];
    if (v && !v.startsWith('void_') && v !== 'umbra') targets.push([r, c]);
  }
  if (targets.length === 0) return;
  targets.sort(() => Math.random() - 0.5);
  const picks = targets.slice(0, Math.min(count, targets.length));
  const cellEls = document.querySelectorAll('.grid .cell');
  for (const [r, c] of picks) {
    if (cellEls[r * SIZE + c]) cellEls[r * SIZE + c].classList.add('burning');
  }
  setTimeout(() => {
    for (const [r, c] of picks) grid[r][c] = 'umbra';
    if (typeof render === 'function') render();
  }, 250);
  try { flashText('🌸 PETAL FALL ×' + picks.length, '#9B59D6'); } catch(e) {}
  try { vibrate([40, 30, 40]); } catch(e) {}
}

// Tendril Coil — pick a random squad hero (avoid suggestion conflict + not already
// coiled) and lock them from firing for 2 turns. Player can fire the hero BEFORE
// this turn's placement to avoid (i.e. coil "lands" at end of placement). For
// simplicity in v1: lock activates immediately on tick.
function _hypnotistTendrilCoil() {
  if (typeof HERO_DECK === 'undefined' || !Array.isArray(HERO_DECK)) return;
  const candidates = HERO_DECK.filter(h =>
    h && h.id
    && !hypnotistSuggestedHeroIds.includes(h.id)
    && h.id !== hypnotistTendrilHeroId
  );
  if (candidates.length === 0) return;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  hypnotistTendrilHeroId = target.id;
  hypnotistTendrilTurnsLeft = 2;
  try { flashText('🌸 TENDRIL · ' + target.name + ' COILED', '#9B59D6'); } catch(e) {}
  try { vibrate([60, 40, 60]); } catch(e) {}
  try { renderHypnotistVisuals(); } catch(e) {}
}

// Visual indicator — apply hero-card classes for suggested + coiled heroes.
// Block 3: lightweight implementation via classList toggle. Block 5b.9 polish
// can add dedicated CSS animations (purple shimmer for suggested, dim+chains
// for coiled). Re-applied on render() and on tick.
export function renderHypnotistVisuals() {
  try {
    const cards = document.querySelectorAll('.hero-card');
    for (const card of cards) {
      const id = card.dataset && card.dataset.id;
      if (!id) continue;
      const isSuggested = hypnotistSuggestedHeroIds.includes(id);
      const isCoiled    = hypnotistTendrilHeroId === id;
      card.classList.toggle('hero-card--hypno-suggested', isSuggested);
      card.classList.toggle('hero-card--hypno-coiled',    isCoiled);
    }
  } catch (e) { /* defensive */ }
}

// ─── ENGINEER tick — Weld / Extract / Critical Mass (legacy 42392-42525) ─────
// PHASE 5b BLOCK 4: upgraded from Block 1 scaffolding to full mechanics per Compendium §7.
export function _tickEngineer(phase) {
  engineerTurnsSinceWeld++;
  if (engineerTurnsSinceWeld >= ENGINEER_WELD_INT) {
    engineerTurnsSinceWeld = 0;
    const weldCount = phase === 1 ? ENGINEER_WELD_COUNT_P1
                    : phase === 2 ? ENGINEER_WELD_COUNT_P2
                    : ENGINEER_WELD_COUNT_P3;
    _engineerWeldCells(weldCount);
  }
  if (phase >= 2) {
    engineerTurnsSinceExtract++;
    if (engineerTurnsSinceExtract >= ENGINEER_EXTRACT_INT) {
      engineerTurnsSinceExtract = 0;
      _engineerExtractEarthCells();
    }
  }
  if (phase >= 3) {
    engineerTurnsSinceElectrify++;
    if (engineerTurnsSinceElectrify >= ENGINEER_ELECTRIFY_INT) {
      engineerTurnsSinceElectrify = 0;
      // P3: pick a random row, electrify for 2 turns
      engineerElectrifiedRow = Math.floor(Math.random() * SIZE);
      engineerElectrifiedTurns = ENGINEER_ELECTRIFY_DURATION;
      try { flashText('⚙⚙ CRITICAL MASS · row ' + (engineerElectrifiedRow + 1), '#B87333'); } catch(e) {}
      try { vibrate([60, 40, 60, 40, 100]); } catch(e) {}
      try { _renderEngineerVisuals(); } catch(e) {}
    }
    // Decay electrified row
    if (engineerElectrifiedTurns > 0) {
      engineerElectrifiedTurns--;
      if (engineerElectrifiedTurns === 0) {
        engineerElectrifiedRow = -1;
        try { _renderEngineerVisuals(); } catch(e) {}
      }
    }
  }
  // Decay welded cells (per turn — P1: 4 turns, P2: 4 turns, P3: 4 turns since
  // ENGINEER_WELD_DURATION is constant. Phase-3 overclock just spawns more.)
  let lockedExpired = false;
  for (const [key, turns] of engineerLockedCells.entries()) {
    if (turns <= 1) {
      engineerLockedCells.delete(key);
      lockedExpired = true;
    } else {
      engineerLockedCells.set(key, turns - 1);
    }
  }
  if (lockedExpired) { try { _renderEngineerVisuals(); } catch(e) {} }
}

// PHASE 5b BLOCK 4 — Cell Lockdown weld. Pick `count` random non-welded non-empty
// non-void cells and lock them shut for ENGINEER_WELD_DURATION (4) turns. Welded
// cells skip clearLines (mirror of permanentFrozenCells pattern). Visual: cells
// gain `.cell--engineer-welded` class showing copper/rust overlay.
function _engineerWeldCells(count) {
  if (typeof grid === 'undefined' || !count) return;
  const candidates = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const v = grid[r][c];
    const key = r + '_' + c;
    if (!v) continue;                           // empty — nothing to weld
    if (v.startsWith('void_')) continue;        // void — already blocking
    if (engineerLockedCells.has(key)) continue; // already welded
    candidates.push([r, c]);
  }
  if (candidates.length === 0) return;
  candidates.sort(() => Math.random() - 0.5);
  const picks = candidates.slice(0, Math.min(count, candidates.length));
  for (const [r, c] of picks) {
    engineerLockedCells.set(r + '_' + c, ENGINEER_WELD_DURATION);
  }
  try { flashText('⚙ WELD ×' + picks.length, '#B87333'); } catch(e) {}
  try { vibrate([60, 40, 60]); } catch(e) {}
  try { _renderEngineerVisuals(); } catch(e) {}
}

// PHASE 5b BLOCK 4 — Resource Extract (P2+). Boss drains up to 3 earth-cells
// from groveAbsorbedByCell Map; heals ENGINEER_EXTRACT_HEAL_PCT (5%) of bossMaxHP
// per drained cell. Player counter: fire ULTs to consume earth-cells before boss
// can extract them (shrinks pool boss can drain).
function _engineerExtractEarthCells() {
  if (typeof groveAbsorbedByCell === 'undefined' || groveAbsorbedByCell.size === 0) {
    try { flashText('⚙ EXTRACT · NO RESOURCES', '#B87333'); } catch(e) {}
    return 0;
  }
  const keys = Array.from(groveAbsorbedByCell.keys());
  keys.sort(() => Math.random() - 0.5);
  const picks = keys.slice(0, Math.min(3, keys.length));
  let totalAbsorbed = 0;
  for (const key of picks) {
    totalAbsorbed += groveAbsorbedByCell.get(key) || 0;
    groveAbsorbedByCell.delete(key);
  }
  // Reduce groveTotalAbsorbed in sync (used by REVENGE BURST cap detection)
  if (typeof groveTotalAbsorbed !== 'undefined') {
    groveTotalAbsorbed = Math.max(0, groveTotalAbsorbed - totalAbsorbed);
  }
  // Boss heals 5% of maxHP per drained cell, capped at maxHP
  if (typeof bossMaxHP !== 'undefined' && typeof bossHP !== 'undefined') {
    const healAmount = Math.floor(bossMaxHP * ENGINEER_EXTRACT_HEAL_PCT * picks.length);
    bossHP = Math.min(bossMaxHP, bossHP + healAmount);
    try { flashText('⚙ EXTRACT ×' + picks.length + ' · BOSS +' + healAmount, '#B87333'); } catch(e) {}
    try { if (typeof renderBossHP === 'function') renderBossHP(); } catch(e) {}
  } else {
    try { flashText('⚙ EXTRACT ×' + picks.length, '#B87333'); } catch(e) {}
  }
  try { vibrate([80, 40, 80, 40, 80]); } catch(e) {}
  return picks.length;
}

// PHASE 5b BLOCK 4 — render visual indicators for welded cells + electrified row.
// Lightweight CSS class toggle. Re-applied on every renderGrid() call (hooked via
// engineerVisualsApplyAfterRender).
export function _renderEngineerVisuals() {
  try {
    const cellEls = document.querySelectorAll('.grid .cell');
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const el = cellEls[r * SIZE + c];
      if (!el) continue;
      const isWelded = engineerLockedCells.has(r + '_' + c);
      // 2026-05-02 — COMBAT v2.1 P4 PR #4.C §4.7: check both legacy single-row
      // and new engineerElectrifiedRows array for the engineer_p2_p3 visual.
      let isElectrifiedRow = (engineerElectrifiedRow === r && engineerElectrifiedTurns > 0);
      if (!isElectrifiedRow && typeof engineerElectrifiedRows !== 'undefined'
          && Array.isArray(engineerElectrifiedRows)) {
        isElectrifiedRow = engineerElectrifiedRows.includes(r);
      }
      el.classList.toggle('cell--engineer-welded', isWelded);
      el.classList.toggle('cell--engineer-electrified', isElectrifiedRow);
    }
  } catch (e) { /* defensive */ }
}

// ─── FRENZY tick — Stacks / Maul / Devour (legacy 42527-42620) ───────────────
// PHASE 5b BLOCK 5: upgraded from Block 1 scaffolding to full mechanics per Compendium §8.
export function _tickFrenzy(phase) {
  // P3: doubled stack gain
  if (phase >= 3) frenzyP3Active = true;
  if (frenzyHitThisTurn) {
    if (phase >= 2) {
      // P2+: decay 50% per hit (vs P1 reset)
      frenzyStacks = Math.floor(frenzyStacks * FRENZY_DECAY_P2);
    } else {
      frenzyStacks = 0;
    }
  } else {
    const gain = frenzyP3Active ? BATTERY_GAIN_P3_BASE : 1;
    let cap    = frenzyP3Active ? FRENZY_STACK_CAP_P3 : FRENZY_STACK_CAP;
    // 2026-05-02 — COMBAT v2.1 P4 PR #4.C §4.8: frenzy_p1_p2 raises ceiling.
    // frenzyMaxStacks set to 8 by reactivity (default 5). Composes with P3
    // cap by taking the max — both can be active simultaneously.
    if (typeof frenzyMaxStacks === 'number' && frenzyMaxStacks > cap) {
      cap = frenzyMaxStacks;
    }
    frenzyStacks = Math.min(cap, frenzyStacks + gain);
  }
  frenzyHitThisTurn = false;
  // Maul / Devour queue checks (consumed by next bossAttack)
  frenzyMaulQueued    = (phase >= 2 && frenzyStacks >= FRENZY_MAUL_THRESHOLD);
  frenzyDevourQueued  = (phase >= 3 && frenzyStacks >= FRENZY_DEVOUR_THRESHOLD);
  if (frenzyMaulQueued && !frenzyDevourQueued) {
    try { flashText('🐻 MAUL · ' + frenzyStacks, '#FF6E28'); } catch(e) {}
  } else if (frenzyDevourQueued) {
    try { flashText('🐻🐻 DEVOUR · ' + frenzyStacks, '#FF4400'); } catch(e) {}
    // Devour fires immediately on tick when threshold crossed (vs Maul which is
    // consumed by next bossAttack). Lock + heal happens here.
    _frenzyDevour();
  }
  // Devoured hero decay (per turn)
  if (frenzyDevouredTurnsLeft > 0) {
    frenzyDevouredTurnsLeft--;
    if (frenzyDevouredTurnsLeft === 0) {
      frenzyDevouredHeroId = null;
      try { _renderFrenzyVisuals(); } catch(e) {}
    }
  }
}

// PHASE 5b BLOCK 5 — Devour. Pick "weakest" hero (lowest charge progress = least
// combat-ready) and lock from firing for 3 turns. Boss heals 8% maxHP. Frenzy
// stacks reset to 0 (devour consumes the buildup). Heroes' "lowest HP" → lowest
// charge fraction (charge / cost) since v1 doesn't have per-hero HP.
export function _frenzyDevour() {
  if (typeof HERO_DECK === 'undefined' || !Array.isArray(HERO_DECK)) return;
  const candidates = HERO_DECK.filter(h => h && h.id && h.id !== frenzyDevouredHeroId);
  if (candidates.length === 0) return;
  // Pick hero with lowest charge fraction (charge / cost)
  let target = null;
  let lowestFrac = Infinity;
  for (const h of candidates) {
    const charge = (heroCharges && heroCharges[h.id]) || 0;
    const cost   = (typeof getUltCost === 'function') ? getUltCost(h.id) : 100;
    const frac   = charge / Math.max(1, cost);
    if (frac < lowestFrac) { lowestFrac = frac; target = h; }
  }
  if (!target) return;
  frenzyDevouredHeroId    = target.id;
  frenzyDevouredTurnsLeft = FRENZY_DEVOUR_DURATION;
  // Consume stacks — devour represents the "release" of frenzy buildup
  frenzyStacks = 0;
  // Boss heal
  if (typeof bossMaxHP !== 'undefined' && typeof bossHP !== 'undefined') {
    const healAmount = Math.floor(bossMaxHP * FRENZY_DEVOUR_HEAL_PCT);
    bossHP = Math.min(bossMaxHP, bossHP + healAmount);
    try { flashText('🐻🐻 DEVOUR · ' + target.name + ' · BOSS +' + healAmount, '#FF4400'); } catch(e) {}
    try { if (typeof renderBossHP === 'function') renderBossHP(); } catch(e) {}
  } else {
    try { flashText('🐻🐻 DEVOUR · ' + target.name, '#FF4400'); } catch(e) {}
  }
  try { vibrate([100, 50, 100, 50, 200]); } catch(e) {}
  try { _renderFrenzyVisuals(); } catch(e) {}
}

// Visual indicator — devoured hero card (red theme + 🐻 badge, mirror of
// Hypnotist Tendril Coil pattern but distinct color/emoji). Re-applied on
// every renderDeck() via render hook.
export function _renderFrenzyVisuals() {
  try {
    const cards = document.querySelectorAll('.hero-card');
    for (const card of cards) {
      const id = card.dataset && card.dataset.id;
      if (!id) continue;
      const isDevoured = (frenzyDevouredHeroId === id && frenzyDevouredTurnsLeft > 0);
      card.classList.toggle('hero-card--frenzy-devoured', isDevoured);
    }
  } catch (e) { /* defensive */ }
}

// ─── TEMPO DISRUPTOR tick — Slow / Reverse / Tidal Lock (legacy 42622-42680) ─
// PHASE 5b BLOCK 6: upgraded from Block 1 scaffolding to full mechanics per Compendium §9.
//
// Order is important. _tickTempo runs at end-of-placement, AFTER:
//   - distributeChargeOnElementClear (where Reverse Tempo gates charge gain)
//   - maybeBossAttack (where Tidal Lock gates boss attack)
// So queued flags are CONSUMED here at end of placement so they don't carry over
// to the placement-after-next. Order in this function:
//   1. CONSUME slow flag → visual tint effect (ran during this placement)
//   2. CONSUME charge-nullify flag (was used by distribute calls)
//   3. CONSUME turn-lock flag (was used by maybeBossAttack site)
//   4. INCREMENT counters; if interval hit, set NEW queued flag for NEXT placement
export function _tickTempo(phase) {
  // === Consume flags from previous placement ===
  if (tempoSlowQueued) {
    tempoSlowQueued = false;
    // Slow Time visual: brief blue tint on body. Mechanically nothing — just
    // psychological pressure of time "trickling".
    try {
      document.body.classList.add('tempo-slow-tint');
      setTimeout(() => { try { document.body.classList.remove('tempo-slow-tint'); } catch(e){} }, 1100);
    } catch (e) {}
  }
  if (tempoChargeNullifyQueued) {
    // Was true through current placement (distribute saw it, nullified charge).
    // Consume now so next placement gets normal charge.
    tempoChargeNullifyQueued = false;
  }
  if (tempoTurnLockQueued) {
    // Already consumed at maybeBossAttack site (where boss attack was skipped).
    // Defensive consume here in case the site didn't get to it (e.g. game ended).
    tempoTurnLockQueued = false;
  }
  // === Increment intervals; queue flag for NEXT placement if hit ===
  tempoTurnsSinceSlow++;
  if (tempoTurnsSinceSlow >= TEMPO_SLOW_INT) {
    tempoTurnsSinceSlow = 0;
    tempoSlowQueued = true;
    try { flashText('❄ TEMPO BREAK', '#78C8FF'); } catch(e) {}
  }
  if (phase >= 2) {
    tempoTurnsSinceReverse++;
    if (tempoTurnsSinceReverse >= TEMPO_REVERSE_INT) {
      tempoTurnsSinceReverse = 0;
      tempoChargeNullifyQueued = true;
      try { flashText('❄ UNDERTOW · NEXT PLACEMENT', '#78C8FF'); } catch(e) {}
      try { vibrate([60, 40, 60]); } catch(e) {}
    }
  }
  if (phase >= 3) {
    tempoTurnsSinceLock++;
    if (tempoTurnsSinceLock >= TEMPO_LOCK_INT) {
      tempoTurnsSinceLock = 0;
      tempoTurnLockQueued = true;
      try { flashStateBanner('❄❄ TIDAL LOCK · NEXT TURN', '#78C8FF'); } catch(e) {}
      try { vibrate([100, 50, 100, 50, 100]); } catch(e) {}
    }
  }
}

// ─── BATTERY tick — Charge → Solar Convergence (P2) / Sunfire Cascade (P3) (legacy 42682-42722) ──
// PHASE 5b BLOCK 7: upgraded from Block 1 scaffolding to full mechanics per Compendium §10.
export function _tickBattery(phase) {
  batteryPhase = phase;
  // 2026-05-02 — COMBAT v2.1 P4 PR #4.C §4.10: battery_p1_p2 charge rate boost.
  // bossChargeRateMult set to 1.50 by reactivity. Default 1.0 — no change
  // when reactivity hasn't fired. Multiplies all charge gains in this fn.
  const _rateMult = (typeof bossChargeRateMult === 'number') ? bossChargeRateMult : 1.0;
  // P3: doubled charge gain regardless of hit
  if (phase >= 3) {
    batteryCharge = Math.min(BATTERY_THRESHOLD, batteryCharge + Math.floor(BATTERY_GAIN_P3_BASE * _rateMult));
  } else {
    const baseGain = batteryHitThisPlacement ? BATTERY_GAIN_HIT : BATTERY_GAIN_NOHIT;
    batteryCharge = Math.min(BATTERY_THRESHOLD, batteryCharge + Math.floor(baseGain * _rateMult));
  }
  batteryHitThisPlacement = false;
  // Update charge meter UI (visible during HELIOTRON fight; idempotent toggle)
  try { _renderBatteryChargeMeter(); } catch (e) {}
  // Charge milestone announcements (per Compendium intro/mid/death lines pattern)
  if (batteryCharge >= 75 && batteryCharge < 90) {
    try { flashText('☀ PREPARE...', '#FFD75A'); } catch(e) {}
  } else if (batteryCharge >= 90 && batteryCharge < BATTERY_THRESHOLD) {
    try { flashText('☀ READY...', '#FFEB78'); } catch(e) {}
  } else if (batteryCharge >= BATTERY_THRESHOLD) {
    // UNLEASH — Solar Convergence (P2) or Sunfire Cascade (P3). Charge resets.
    batteryCharge = 0;
    batteryUnleashCount++;
    if (phase >= 3) {
      // P3: Sunfire Cascade — 3 sequential strikes (3 cols → 3 rows → center 3×3)
      try { flashText('☀☀☀ SUNFIRE CASCADE', '#FFD75A'); } catch(e) {}
      try { vibrate([200, 80, 200, 80, 200, 80, 400]); } catch(e) {}
      try { _batterySunfireCascade(); } catch (e) { console.warn('Sunfire Cascade failed:', e); }
    } else {
      // P2: Solar Convergence — 4-row top-half AoE
      try { flashText('☀☀ SOLAR CONVERGENCE', '#FFD75A'); } catch(e) {}
      try { vibrate([150, 60, 150, 60, 250]); } catch(e) {}
      try { _batterySolarConvergence(); } catch (e) { console.warn('Solar Convergence failed:', e); }
    }
    try { _renderBatteryChargeMeter(); } catch (e) {}
  }
}

// ─── T1.13.2: window-exposure for Ch3 + Storm canonical state ──────────────
// Per the T1.10.6/T1.10.7 sibling pattern, expose the Ch3 + Storm symbols on
// window so legacy `/* global ... */` consumers (grid.js, heroes.js,
// battle-screen.js, etc.) resolve to the same canonical impl that lives
// here. The bosses.js bridges for these were retired in T1.13.2 alongside
// the duplicate exports.
if (typeof window !== 'undefined') {
  mirrorWindowProp('_ch3BossId', () => _ch3BossId, (v) => { _ch3BossId = v; });
  mirrorWindowProp('_ch3State', () => _ch3State, (v) => { _ch3State = v; });
  mirrorWindowProp('_ch3LastDualState', () => _ch3LastDualState, (v) => { _ch3LastDualState = v; });
  if (typeof window._stormApplyBlizzardFreeze === 'undefined') window._stormApplyBlizzardFreeze = _stormApplyBlizzardFreeze;
  if (typeof window._stormApplyEarthquakeLock === 'undefined') window._stormApplyEarthquakeLock = _stormApplyEarthquakeLock;
  if (typeof window._stormApplyLightningRow === 'undefined') window._stormApplyLightningRow = _stormApplyLightningRow;
  if (typeof window.initChapter3Boss === 'undefined') window.initChapter3Boss = initChapter3Boss;
  if (typeof window.tickChapter3Boss === 'undefined') window.tickChapter3Boss = tickChapter3Boss;
  if (typeof window._ch3HasDebuff === 'undefined') window._ch3HasDebuff = _ch3HasDebuff;
  if (typeof window._ch3HasSeal === 'undefined') window._ch3HasSeal = _ch3HasSeal;
  if (typeof window._ch3TwilightMult === 'undefined') window._ch3TwilightMult = _ch3TwilightMult;
  if (typeof window._ch3RenderBossAura === 'undefined') window._ch3RenderBossAura = _ch3RenderBossAura;
  if (typeof window._ch3MaybeAnnounceDualState === 'undefined') window._ch3MaybeAnnounceDualState = _ch3MaybeAnnounceDualState;
}
