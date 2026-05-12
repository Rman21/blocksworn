// 2026-05-11 — TASK-011 (T1.10.3): grid system relocated from legacy.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - Module-scope state (`grid`, `pieces`, `knownDeadZones`,
//     `placementCount`)                              line 40012
//   - Grid + battle-state allocation (in startBossBattle)
//                                                    lines 55510, 55525, 55585
//   - newPieces (tray refill + shroudTick)           lines 55801-55811
//   - cellsOf (piece → grid-relative cells)          lines 55813-55819
//   - canPlace (placement validator)                 lines 55821-55866
//   - place    (commit piece to grid + bookkeeping)  lines 55868-55913
//   - findLines (full row/col scan)                  lines 55915-55920
//   - stihiyasIn (line-clear element set)            lines 55922-55927
//   - clearLines (animation + wipe + electrified +
//                 wither neighbor-clear escape)      lines 55929-56045
//   - gridFillRatio                                  lines 56260-56264
//   - applyVoidTickIfAny / applyGridSaturationIfAny  lines 39001-39033
//   - Constants block (SIZE, MAX_HP, CHANNEL_VOID_*, CHANNEL_GRID_SATURATION_*)
//                                                    lines 19950, 19956, 19967-19969
//
// SACRED PER CLAUDE.md §2.1 + §2.5:
//   - GRID_SATURATION is one of the 4 v2.1 P1 damage channels
//     (DEAD_ZONE / VOID / SIGNATURE / GRID_SATURATION). The threshold
//     (0.75 occupancy) and flat damage (8 HP) drive `applyGridSaturationIfAny`
//     unchanged. Preserved byte-perfect from legacy lines 19968-19969 +
//     39019-39033.
//   - Combo crit formula `total_dmg × (1 + dominantCount × combo × 10%)`
//     consumes a `dominantCount` value derived from per-element cell counts
//     across cleared rows/cols. Legacy computes this inline in the line-clear
//     handler (lines 63566-63573 + 63696). The inline pattern is NOT
//     re-extracted here — moving it into a grid helper would require shifting
//     the consumer (the combo crit damage path in the cleared-cells block) and
//     break byte-perfect parity. The grid module exposes the underlying
//     primitive (`countElementsInCells(rows, cols)`) so T1.10.5 / T1.10.9 can
//     refactor the inline pattern to call through this module without touching
//     the sacred formula.
//   - CHANNEL_VOID_TICK_PCT (0.005) drives `applyVoidTickIfAny`; this is the
//     VOID damage channel rate, also v2.1 P1 sacred.
//   - All cell-mutation logic (place / clearLines wipe semantics, including
//     permanentFrozenCells + engineerLockedCells immunity, Critical Mass
//     electrified-row damage, Root-of-Nothing wither neighbor-clear escape)
//     preserved byte-perfect.
//
// T1.10.3 is pure relocation — no placement rule, line-clear edge, void cell
// flagging, saturation threshold, or channel damage rate modified.
//
// Owns: 8×8 board state + tray pieces + per-battle dead-zone cache + placement
// counter; placement validation incl. boss-spawned blocker cells
// (warrior_blocked, Grovewarden root bind, Stormshepherd blizzard/earthquake);
// line-clear detection + element-set extraction; grid metrics (fill ratio +
// element counts + dominant element count); v2.1 P1 grid-saturation +
// void-tick channel damage triggers.
//
// Does NOT own:
//   - SIZE / MAX_HP / SHAPES / STIHIYAS / STIHIYA_COLORS — legacy
//     module-scope constants. Targets for src/data/balance.js (size + MAX_HP)
//     + src/data/elements.js (STIHIYAS + colors) and src/data/grid.js or
//     similar (SHAPES) in a future data-consolidation sweep. Cross-module
//     refs declared `/* global */` (readonly) here.
//   - weightedStihiya — RNG-tray helper that consults `currentBonusDmg` +
//     `MOTIFS_ENABLED`. Stays in legacy; T1.10.5 / T1.10.9 territory.
//   - applyChannelDamage — T1.10.5 (damage-channels) consumer.
//   - addPressure / PRESSURE_GAIN — T1.10.6 (stagger-loop) writer; called from
//     within clearLines on every line-clear.
//   - bloomTokens / consumeBloomEarly / maybeMarkRadiant / chargedCells /
//     radiantCells (motif state) — battle/heroes territory; called from place
//     + clearLines but lives elsewhere.
//   - permanentFrozenCells / engineerLockedCells / engineerElectrifiedRow{,s}
//     / engineerElectrifiedTurns / _grovewardenRootBindCells /
//     _stormBlizzardFreezes / _stormEarthquakeLocks / _ch3State.witherCells —
//     reactivity-event blocker state, T1.10.8 territory.
//   - HERO_DECK + skipPlayerTurnsCount + _ch3HasDebuff + _ch3HasSeal — combat
//     state consumed by canPlace/place; battle/bosses territory.
//   - cellEls DOM query + .clearing class toggle + render() — UI concern,
//     T1.11 (ui) territory. Preserved inline via TODO(T1.11) markers.
//
// Storage migration: this module touches no localStorage keys. The grid is a
// per-battle ephemeral state, allocated fresh in startBossBattle (legacy line
// 55510) and torn down on defeat / victory. Save/load goes through
// progression.js (T1.10.2) for chapter/floor + boss-stars. No bare-string
// flags to migrate; no new keys for the T1.10.9 shim allow-list.
//
// Undeclared cross-module identifiers preserved with /* global */ + TODO
// markers (per the T1.10.1 / T1.10.2 pattern). Each will be wired in
// subsequent sub-tasks.
//
// 2026-05-11 — Roman: pure-relocation discipline. No "improvements". Nothing
// new. Comments above this line replicate legacy intent.

// T1.13.1: /* global */ → ES imports for resolved src/ exports.
import {
  CHANNEL_VOID_TICK_PCT, CHANNEL_GRID_SATURATION_THRESHOLD,
  CHANNEL_GRID_SATURATION_DMG, applyChannelDamage,
} from './damage-channels.js';
import { addPressure, PRESSURE_GAIN } from './stagger-loop.js';
import { _stormBlizzardFreezes, _stormEarthquakeLocks } from './bosses.js';
import { _grovewardenRootBindCells } from '../ui/archetype-ticks.js';
import { shroudTick } from './reactivity-events.js';
import { vHaptic } from '../feel/haptics.js';
import { vPlayLineClearBurst } from '../feel/animations.js';
// 2026-05-12 — TASK-029 (T2.02): Identity Layer dispatch hook.
// Fires AFTER `vPlayLineClearBurst` (sacred timing untouched) on every line
// clear. Routes to per-race FX (Pirate's Plunder ships in T2.02; stubs for
// Shark / Rock / Crocodile / Spark wait for T2.03–T2.06). See
// docs/design/mechanics/identity-layer.md §7.2.
import { dispatchIdentityFx } from '../feel/identity-fx.js';
import { log } from '../services/logger.js';

// Residual legacy-owned tokens:
/* global SIZE, MAX_HP, SHAPES, weightedStihiya, sleep */
/* global permanentFrozenCells, engineerLockedCells,
   engineerElectrifiedRow, engineerElectrifiedRows,
   engineerElectrifiedTurns, _ch3BossId, _ch3State, _ch3HasDebuff,
   _ch3HasSeal */
/* global HERO_DECK, currentBoss,
   playCellPlacement, maybeMarkRadiant, bloomTokens, consumeBloomEarly,
   trackMissionEvent, showDefeatModal, render, flashStateBanner, flashText,
   vibrate */
/* global hp:writable, shieldCount:writable, battleDamageTaken:writable,
   gameEnded:writable, skipPlayerTurnsCount:writable */
// LEGACY-ONLY: above tokens have no src/ export — shims retired in T1.14+ cleanup.

// ─── Module-private grid state ────────────────────────────────────────────
// Legacy declared at file scope (line 40012):
//   let grid, hp, damageDealt, pieces, knownDeadZones, placementCount,
//       shieldCount, heroFireCount;
// Of those, the grid-owned subset (grid + pieces + knownDeadZones +
// placementCount) is module-private here; consumers must use the accessors.
// The other names (hp, shieldCount, etc.) are battle-state writable globals
// per the directives above — legacy mutators still see them ambient until
// T1.10.9 flips ownership.
let grid           = null;        // 8×8 array of (stihiya string | 'void_<elem>' | null)
let pieces         = null;        // current tray (3 pieces)
let knownDeadZones = new Set();   // cached pockets that fail dead-zone scan
let placementCount = 0;           // pieces placed this battle (used by missions + seals)

// ─── Public state accessors ───────────────────────────────────────────────
// Read-only getters for the grid + tray. Battle / UI code (T1.10.9 / T1.11)
// will call through these once wired; legacy continues to use the writable
// globals until then.
export function getGrid() { return grid; }
export function getCell(r, c) {
  if (!grid || r < 0 || c < 0 || !grid[r] || c >= grid[r].length) return null;
  return grid[r][c];
}
export function setCell(r, c, value) {
  if (!grid || r < 0 || c < 0 || !grid[r] || c >= grid[r].length) return false;
  grid[r][c] = value;
  return true;
}
export function getPieces() { return pieces; }
export function getKnownDeadZones() { return knownDeadZones; }
export function setKnownDeadZones(set) { knownDeadZones = set; }
export function getPlacementCount() { return placementCount; }
export function setPlacementCount(n) { placementCount = Math.max(0, Number(n) || 0); }

// ─── Grid allocator (legacy startBossBattle line 55510 + 55525 + 55585) ───
// Legacy initialized the grid + reset placement counter + cleared dead-zone
// cache inside startBossBattle. This helper centralizes the same three writes
// so battle code can call one function on fight start. SIZE remains a legacy
// global (constant 8); T1.10.9 wire-up may move it to src/data/.
export function initGrid() {
  grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  placementCount = 0;
  knownDeadZones = new Set();
}

// Convenience: reset to null grid (used in defeat / victory paths to free
// references; legacy let GC handle it via the next initGrid). Not invoked by
// legacy directly — exposed for completeness.
export function resetGrid() {
  grid = null;
  pieces = null;
  placementCount = 0;
  knownDeadZones = new Set();
}

// ─── newPieces (legacy 55801-55811) ───────────────────────────────────────
// Tray refill on every player turn. Voidfang umbral shroud (T1.10.8) ticks
// here, and the tray is rebuilt from SHAPES + weightedStihiya() (T1.10.5).
//
// TODO(T1.10.8): shroudTick → reactivity-events module.
// TODO(T1.10.5): SHAPES + weightedStihiya → data + RNG-tray module.
export function newPieces() {
  // V3.0 Phase 6 Block 6.3: Voidfang umbral shroud — spawns 1 random void per
  // player turn. No-op if shroud flag is false (i.e. non-Voidfang fights or
  // pre-phase-3 Voidfang). Fires at tray-refill = new player turn.
  try { if (typeof shroudTick === 'function') shroudTick(); } catch (_e) { /* swallow */ }
  pieces = [0,1,2].map(() => ({
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    stihiya: weightedStihiya(),
    used: false,
  }));
}

// ─── cellsOf (legacy 55813-55819) ─────────────────────────────────────────
// Piece → grid-relative cell offsets. Pure helper.
export function cellsOf(p) {
  const out = [];
  for (let r = 0; r < p.shape.length; r++)
    for (let c = 0; c < p.shape[r].length; c++)
      if (p.shape[r][c]) out.push([r, c]);
  return out;
}

// ─── canPlace (legacy 55821-55866) ────────────────────────────────────────
// Placement validator. Consults boss-spawned blocker sets (T1.10.8 territory):
//   - VOIDPRIESTESS warrior_blocked seal — first-row block while Warrior in deck
//   - Grovewarden Root Bind — keyed cell set
//   - Stormshepherd Blizzard freezes + Earthquake locks
// Then standard bounds + collision check.
//
// TODO(T1.10.8): all blocker sets + _ch3HasDebuff → reactivity-events.
export function canPlace(p, br, bc) {
  // 2026-04-29 — Block 6.5 DEBT-5 close: VOIDPRIESTESS `warrior_blocked` seal
  // (spec §2.4: "Warrior cannot place piece on first row 3 turns"). Active
  // only when a Warrior hero is currently in HERO_DECK; otherwise the random
  // pool can still roll the debuff but has no path-of-effect (matches the
  // existing role-debuff semantics for hunter_silenced / mage_halved).
  try {
    if (typeof _ch3HasDebuff === 'function' && _ch3HasDebuff('warrior_blocked')
        && Array.isArray(HERO_DECK) && HERO_DECK.some(h => h && h.newRole === 'warrior')) {
      for (const [dr] of cellsOf(p)) {
        if (br + dr === 0) return false;
      }
    }
  } catch (_e) { /* swallow */ }
  // 2026-04-30 — Grovewarden Root Bind: cells in _grovewardenRootBindCells
  // are unplayable for the duration of the bind (3T). Same reject pattern
  // as warrior_blocked above — refusing the placement here makes the
  // existing UI feedback (red preview + tap-to-place no-op) work for free.
  try {
    if (typeof _grovewardenRootBindCells !== 'undefined' && _grovewardenRootBindCells.size > 0) {
      for (const [dr, dc] of cellsOf(p)) {
        if (_grovewardenRootBindCells.has((br + dr) + '_' + (bc + dc))) return false;
      }
    }
  } catch (_e) { /* swallow */ }
  // 2026-04-30 — Stormshepherd Blizzard freeze + Earthquake lock. Same
  // refuse-and-fall-through pattern. Clears when their respective
  // turnsLeft expires (managed in tickChapter3Boss → storm path).
  try {
    if (typeof _stormBlizzardFreezes !== 'undefined' && _stormBlizzardFreezes.size > 0) {
      for (const [dr, dc] of cellsOf(p)) {
        if (_stormBlizzardFreezes.has((br + dr) + '_' + (bc + dc))) return false;
      }
    }
    if (typeof _stormEarthquakeLocks !== 'undefined' && _stormEarthquakeLocks.size > 0) {
      for (const [dr, dc] of cellsOf(p)) {
        if (_stormEarthquakeLocks.has((br + dr) + '_' + (bc + dc))) return false;
      }
    }
  } catch (_e) { /* swallow */ }
  for (const [dr, dc] of cellsOf(p)) {
    const r = br + dr, c = bc + dc;
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE || grid[r][c] !== null) return false;
  }
  return true;
}

// ─── place / placePiece (legacy 55868-55913) ──────────────────────────────
// Commits a piece to the grid + bookkeeping. Returns true on success, false
// if the tempo_disruptor skip-turn gate consumed the placement.
//
// Note: legacy exposes this as `place`. Exporting under the canonical
// `placePiece` alias matches the task brief; the legacy name is kept in step
// with the global mutators it triggers (shieldCount / hp / battleDamageTaken).
//
// TODO(T1.10.5): bloomTokens / consumeBloomEarly / maybeMarkRadiant motif
//                hooks → battle/heroes.
// TODO(T1.10.6): skipPlayerTurnsCount gate → stagger-loop / reactivity.
// TODO(T1.10.8): _ch3HasSeal placement_costs_hp → reactivity-events.
// TODO(T1.11):   flashStateBanner / vibrate / vHaptic / playCellPlacement
//                / trackMissionEvent UI + audio refs.
export function placePiece(p, br, bc) {
  // 2026-05-02 — COMBAT v2.1 P4 PR #4.C §4.9: tempo_disruptor skip-turn gate.
  // skipPlayerTurnsCount > 0 → consume one skip and reject placement.
  // Player sees "TIME RIFT" banner; piece returns to tray (returns false so
  // caller can re-render unselected). Boss attack resolves on this turn instead.
  if (typeof skipPlayerTurnsCount === 'number' && skipPlayerTurnsCount > 0) {
    skipPlayerTurnsCount--;
    try { flashStateBanner('TIME RIFT · TURN SKIPPED', '#78C8FF'); } catch (_e) { /* swallow */ }
    try { vibrate([200, 100, 200]); } catch (_e) { /* swallow */ }
    return false;
  }
  const cs = cellsOf(p);
  for (const [dr, dc] of cs) {
    const r = br + dr, c = bc + dc;
    const key = r + '_' + c;
    // V2.0 Block 1.2: consume bloom token BEFORE piece assignment (heal-only, no conversion)
    if (bloomTokens.has(key)) consumeBloomEarly(key);
    grid[r][c] = p.stihiya;
    // V2.0 Block 1.2: mark radiant if solar (RNG or guaranteed from prior combo)
    if (p.stihiya === 'solar') maybeMarkRadiant(r, c);
  }
  p.used = true;
  placementCount++;
  // 2026-04-27 — Block 6.5 DEBT-6 — ARCHIVAL "placement_costs_hp" seal:
  // -1 HP per piece placed. Capped at 0 — never lethal directly.
  try {
    if (typeof _ch3HasSeal === 'function' && _ch3HasSeal('placement_costs_hp')) {
      // 2026-04-27 — HOTFIX: shield-first absorption so the seal isn't a guaranteed
      // 3-placement TPK at MAX_HP=3 scale. Matches Critical Mass / Storm Intensify pattern.
      if (typeof shieldCount !== 'undefined' && shieldCount > 0) {
        shieldCount = Math.max(0, shieldCount - 1);
      } else {
        hp = Math.max(0, hp - 1);
        battleDamageTaken = (battleDamageTaken || 0) + 1;
      }
    }
  } catch (_e) { /* swallow */ }
  // V3.0 Phase 9 Vivid: haptic feedback on piece placement.
  try { vHaptic('place'); } catch (_e) { /* swallow */ }
  // 2026-04-27 — Audio A.2.1: cell placement SFX (per spec §4.1).
  // Element-themed tap (50ms decay). Uses piece.stihiya — the element color
  // of the placed cells, matching the visual theme.
  try { if (typeof playCellPlacement === 'function') playCellPlacement(p.stihiya); } catch (_e) { /* swallow */ }
  // V3.0 Phase 5 Block 5.1: mission tracking
  try { if (typeof trackMissionEvent === 'function') trackMissionEvent('block_placed'); } catch (_e) { /* swallow */ }
  return true;
}

// ─── findLines / findClearableLines (legacy 55915-55920) ──────────────────
// Full row + column scan. Returns { rows: [...], cols: [...] } — both arrays
// of indices, possibly empty. Exported under the canonical `findClearableLines`
// name per the task brief; legacy alias `findLines` kept for callers.
export function findClearableLines() {
  const rows = [], cols = [];
  for (let r = 0; r < SIZE; r++) if (grid[r].every(c => c !== null)) rows.push(r);
  for (let c = 0; c < SIZE; c++) if (grid.every(row => row[c] !== null)) cols.push(c);
  return { rows, cols };
}
export const findLines = findClearableLines;

// ─── stihiyasIn (legacy 55922-55927) ──────────────────────────────────────
// Returns the set of stihiya values in the cleared rows + cols. Excludes void
// cells (`void_*` prefix) — they're blockers, not damage-contributing elements.
export function stihiyasIn(rows, cols) {
  const s = new Set();
  for (const r of rows) for (let c = 0; c < SIZE; c++) { const v = grid[r][c]; if (v && !v.startsWith('void')) s.add(v); }
  for (const c of cols) for (let r = 0; r < SIZE; r++) { const v = grid[r][c]; if (v && !v.startsWith('void')) s.add(v); }
  return s;
}

// ─── clearLines (legacy 55929-56045) ──────────────────────────────────────
// Animates + wipes the cleared rows + columns. Side effects:
//   - addPressure tier by line count (1=5 / 2=12 / 3=25 / 4+=45)  — T1.10.6
//   - cellEls .clearing class + vibrate(25) + vPlayLineClearBurst — T1.11 / T1.09
//   - Critical Mass damage on engineer-archetype electrified rows  — T1.10.8
//   - Root-of-Nothing wither neighbor-clear escape                 — T1.10.8
// Permanent-frozen + engineer-locked cells skip the wipe (immune by design).
//
// TODO(T1.10.6): addPressure + PRESSURE_GAIN → stagger-loop.
// TODO(T1.10.8): engineer electrified rows + ch3 wither cells → reactivity.
// TODO(T1.11):   cellEls DOM query + .clearing class + render() → ui module.
// TODO(T1.09):   vPlayLineClearBurst lives in src/feel/animations.js
//                already (T1.09 done) — global reference here pending battle
//                module wire-up.
export async function clearLines(rows, cols) {
  // 2026-05-02 — COMBAT v2.1 P2 §3.10.1: Pressure gain from line clears.
  // Tier by total line count: 1=5 / 2=12 / 3=25 / 4+=45. Fires at the very
  // top so it's deterministic regardless of which downstream paths execute.
  // Safe in FTUE training (boss is dummy → addPressure short-circuits via
  // bossHP=0 guard).
  try {
    const _totalLines = (rows ? rows.length : 0) + (cols ? cols.length : 0);
    if (_totalLines === 1)      addPressure(PRESSURE_GAIN.line_single, 'single_clear');
    else if (_totalLines === 2) addPressure(PRESSURE_GAIN.line_double, 'double_clear');
    else if (_totalLines === 3) addPressure(PRESSURE_GAIN.line_triple, 'triple_clear');
    else if (_totalLines >= 4)  addPressure(PRESSURE_GAIN.line_quad,   'quad_clear');
  } catch (e) { log.warn('line-clear pressure failed:', e); }
  const cellEls = document.querySelectorAll('.grid .cell');
  const idxs = new Set();
  for (const r of rows) for (let c = 0; c < SIZE; c++) idxs.add(r*SIZE+c);
  for (const c of cols) for (let r = 0; r < SIZE; r++) idxs.add(r*SIZE+c);
  // PHASE 5b BLOCK 4 — Critical Mass: count cleared cells in the electrified row
  // BEFORE clear (so we know how many cells are about to be lost in that row).
  // Damage applied AFTER clear completes. Engineer-archetype-only.
  // 2026-05-02 — COMBAT v2.1 P4 PR #4.C §4.7: engineer_p2_p3 sets up to 2
  // electrified rows via engineerElectrifiedRows array. Iterate union of
  // (legacy single row) ∪ (new array) — both populated by reactivity.
  let _engineerElectrifiedClears = 0;
  if (typeof currentBoss !== 'undefined' && currentBoss && currentBoss.archetype === 'engineer') {
    const _eRows = new Set();
    if (typeof engineerElectrifiedRow !== 'undefined' && engineerElectrifiedRow >= 0
        && engineerElectrifiedTurns > 0) {
      _eRows.add(engineerElectrifiedRow);
    }
    if (typeof engineerElectrifiedRows !== 'undefined' && Array.isArray(engineerElectrifiedRows)) {
      for (const r of engineerElectrifiedRows) if (typeof r === 'number' && r >= 0) _eRows.add(r);
    }
    for (const eRow of _eRows) {
      for (let c = 0; c < SIZE; c++) {
        const idx = eRow * SIZE + c;
        if (idxs.has(idx) && grid[eRow] && grid[eRow][c]) {
          // Skip if welded
          if (typeof engineerLockedCells !== 'undefined'
              && engineerLockedCells.has(eRow + '_' + c)) continue;
          _engineerElectrifiedClears++;
        }
      }
    }
  }
  for (const i of idxs) cellEls[i].classList.add('clearing');
  vibrate(25);
  // V3.0 Phase 9 Vivid: particle burst from cleared cells toward the boss portrait.
  try { vPlayLineClearBurst(rows, cols); } catch (_e) { /* swallow */ }
  // 2026-05-12 — TASK-029 (T2.02): Identity Layer dispatch.
  // Fires AFTER the sacred `vPlayLineClearBurst` (its 32-spark cap + timing
  // are NOT modified). Per-race FX layered additively on top. Guard against
  // an undefined HERO_DECK (early-boot / FTUE training where the squad may
  // not be allocated yet). Pure addition — failures swallowed so the sacred
  // line-clear pipeline cannot regress from an Identity Layer bug.
  try {
    const _squad = (typeof HERO_DECK !== 'undefined' && Array.isArray(HERO_DECK)) ? HERO_DECK : null;
    const _boss  = (typeof currentBoss !== 'undefined') ? currentBoss : null;
    if (_squad) dispatchIdentityFx(rows, cols, _squad, _boss);
  } catch (e) { log.warn('Identity FX dispatch failed:', e); }
  await sleep(450);
  // V2.0 Stage 5 Block 5.3: permanentFrozenCells are immune to clear cycles (Azuralys/Rimehelm T3 permafrost).
  // PHASE 5b BLOCK 4: engineerLockedCells (Engineer Cell Lockdown) similarly immune.
  for (const r of rows) for (let c = 0; c < SIZE; c++) {
    const _key = r + '_' + c;
    if (permanentFrozenCells.has(_key)) continue;
    if (typeof engineerLockedCells !== 'undefined' && engineerLockedCells.has(_key)) continue;
    grid[r][c] = null;
  }
  for (const c of cols) for (let r = 0; r < SIZE; r++) {
    const _key = r + '_' + c;
    if (permanentFrozenCells.has(_key)) continue;
    if (typeof engineerLockedCells !== 'undefined' && engineerLockedCells.has(_key)) continue;
    grid[r][c] = null;
  }
  // PHASE 5b BLOCK 4 — apply Critical Mass damage AFTER clear (player loses HP for
  // clearing cells in the electrified row). 50 dmg per cleared cell. Shields absorb
  // 1 per Critical Mass burst (similar to Bloom Bloom corruption pattern).
  if (_engineerElectrifiedClears > 0) {
    const _criticalDmg = _engineerElectrifiedClears * 50;
    try { flashText('⚙⚙ CRITICAL MASS · ' + _criticalDmg, '#B87333'); } catch (_e) { /* swallow */ }
    if (shieldCount > 0) {
      shieldCount = Math.max(0, shieldCount - 1);
    } else {
      hp = Math.max(0, hp - _criticalDmg);
      try { battleDamageTaken += _criticalDmg; } catch (_e) { /* swallow */ }
      if (hp === 0 && typeof gameEnded !== 'undefined' && !gameEnded) {
        try { if (typeof showDefeatModal === 'function') showDefeatModal(); } catch (_e) { /* swallow */ }
      }
    }
    try { vibrate([100, 50, 100]); } catch (_e) { /* swallow */ }
  }
  // 2026-04-27 — Block 6.5 DEBT-4: Root-of-Nothing wither neighbor-clear escape.
  // Per spec §2.5: "Player must STRATEGICALLY clear neighbors to break wither stack".
  // When a row/col is cleared and any cleared cell is 4-neighbor-adjacent to a wither,
  // that wither is broken (void_grove cell removed, witherCells entry dropped).
  try {
    if (typeof _ch3BossId !== 'undefined' && _ch3BossId === 'root'
        && _ch3State && Array.isArray(_ch3State.witherCells) && _ch3State.witherCells.length > 0) {
      const clearedKeys = new Set();
      for (const r of rows) for (let c = 0; c < SIZE; c++) clearedKeys.add(r + '_' + c);
      for (const c of cols) for (let r = 0; r < SIZE; r++) clearedKeys.add(r + '_' + c);
      const survivors = [];
      let broken = 0;
      for (const w of _ch3State.witherCells) {
        // Adjacency: 4-neighbor.
        const neighbors = [
          (w.r - 1) + '_' + w.c,
          (w.r + 1) + '_' + w.c,
          w.r + '_' + (w.c - 1),
          w.r + '_' + (w.c + 1),
        ];
        const hasNeighborClear = neighbors.some(k => clearedKeys.has(k));
        if (hasNeighborClear && grid[w.r] && grid[w.r][w.c] === 'void_grove') {
          grid[w.r][w.c] = null;
          broken++;
        } else {
          survivors.push(w);
        }
      }
      if (broken > 0) {
        _ch3State.witherCells = survivors;
        try { flashText('🌱 WITHER BROKEN ×' + broken, '#A8D89C'); } catch (_e) { /* swallow */ }
        try { render(); } catch (_e) { /* swallow */ }
      }
    }
  } catch (_e) { /* swallow */ }
}

// ─── Grid metrics (legacy 56260-56264) ────────────────────────────────────
// Ratio of occupied cells to SIZE × SIZE. Counts everything non-null (filled,
// void, charged, frozen). Drives `gridFillRatio > 0.60` ember pressure check
// and the v2.1 P1 GRID_SATURATION channel trigger below.
export function gridFillRatio() {
  let filled = 0;
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (grid[r][c]) filled++;
  return filled / (SIZE * SIZE);
}

// Count each element across the union of cleared rows + cols. Used by the
// combo crit formula consumer: `dominantCount = max(counts)`. Void cells are
// excluded (they're blockers, not elements). Returns a plain `{ ember, tide,
// grove, solar, umbra }` object. Surfaces the inline pattern from legacy
// lines 63566-63573 so T1.10.5 / T1.10.9 can call through without changing
// the sacred formula at line 63696.
//
// SACRED PER CLAUDE.md §2.1: dominant-element count feeds the combo crit
// formula  total_dmg × (1 + dominantCount × combo × 10%). DO NOT modify the
// counting logic — preserve byte-perfect.
export function countElementsInCells(rows, cols) {
  const counts = { ember: 0, tide: 0, grove: 0, solar: 0, umbra: 0 };
  if (!grid) return counts;
  const cellSet = new Set();
  for (const r of rows) for (let c = 0; c < SIZE; c++) cellSet.add(r * SIZE + c);
  for (const c of cols) for (let r = 0; r < SIZE; r++) cellSet.add(r * SIZE + c);
  for (const idx of cellSet) {
    const v = grid[Math.floor(idx / SIZE)][idx % SIZE];
    if (v && Object.prototype.hasOwnProperty.call(counts, v)) counts[v]++;
  }
  return counts;
}

// Dominant element count = max value among per-element counts. Drives the
// combo crit multiplier. Returns 0 when no element cells in the clear (all
// void or empty). SACRED per CLAUDE.md §2.1 — feeds combo crit formula.
export function getDominantElementCount(rows, cols) {
  const counts = countElementsInCells(rows, cols);
  return Math.max(...Object.values(counts));
}

// ─── Void cells ───────────────────────────────────────────────────────────
// Void cells are stored as grid strings starting with `void_<elem>` (e.g.
// `void_ember`, `void_grove`). Spawned by boss attacks (T1.10.7 territory).
// Helpers below are read-only — actual spawning lives in bossAttack / archetype
// handlers (legacy lines 41024 + 27419 etc.).
export function isVoidCell(value) {
  return typeof value === 'string' && value.startsWith('void_');
}

export function countVoidCells() {
  if (!grid) return 0;
  let n = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = grid[r][c];
      if (cell && typeof cell === 'string' && cell.startsWith('void_')) n++;
    }
  }
  return n;
}

// ─── v2.1 P1 channel damage triggers (legacy 39001-39033) ─────────────────
// SACRED PER CLAUDE.md §2.5: GRID_SATURATION and VOID are 2 of the 4 v2.1 P1
// damage channels. The threshold (0.75), flat damage (8 HP), and void-tick
// rate (0.5% MAX_HP per cell) are sacred — preserved byte-perfect.

// VOID TICK CHANNEL — fires at end of each player placement turn (called from
// the top of maybeBossAttack, BEFORE attackCountdown decrement).
// Damage = floor(voidCount * MAX_HP * CHANNEL_VOID_TICK_PCT).
// At MAX_HP=100, 0.5%/cell: 1 void = 0 dmg, 2 void = 1, ..., 6 void = 3.
// Encourages tempo / void clearing without being punishing in early game.
// Void cells in this codebase are stored as grid strings starting with 'void_'.
export function applyVoidTickIfAny() {
  if (typeof grid === 'undefined' || typeof SIZE === 'undefined') return 0;
  let voidCount = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = grid[r][c];
      if (cell && typeof cell === 'string' && cell.startsWith('void_')) voidCount++;
    }
  }
  if (voidCount === 0) return 0;
  const rawDmg = Math.floor(voidCount * MAX_HP * CHANNEL_VOID_TICK_PCT);
  if (rawDmg <= 0) return 0;
  return applyChannelDamage('void_tick', rawDmg, { voidCount });
}

// GRID SATURATION CHANNEL — anti-hoarding pressure. If >=75% of board cells
// occupied at EOT, deal flat CHANNEL_GRID_SATURATION_DMG. All non-empty cells
// count (filled, charged, void). Same trigger site as void tick.
//
// SACRED per CLAUDE.md §2.5 — v2.1 P1 GRID_SATURATION damage channel.
// Threshold = CHANNEL_GRID_SATURATION_THRESHOLD (0.75), flat damage =
// CHANNEL_GRID_SATURATION_DMG (8). Preserved byte-perfect.
export function applyGridSaturationIfAny() {
  if (typeof grid === 'undefined' || typeof SIZE === 'undefined') return 0;
  let occupied = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] !== null) occupied++;
    }
  }
  const totalCells = SIZE * SIZE;
  const ratio = occupied / totalCells;
  if (ratio < CHANNEL_GRID_SATURATION_THRESHOLD) return 0;
  return applyChannelDamage('saturation', CHANNEL_GRID_SATURATION_DMG, {
    occupied, totalCells, ratio,
  });
}

// Read-only computed saturation level (decoupled from the channel damage
// trigger). Useful for HUD/diagnostic surfaces that want to display the
// current saturation ratio without firing the damage path. Returns
// { occupied, totalCells, ratio, overThreshold }.
export function computeGridSaturation() {
  if (!grid || typeof SIZE === 'undefined') {
    return { occupied: 0, totalCells: 0, ratio: 0, overThreshold: false };
  }
  let occupied = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] !== null) occupied++;
    }
  }
  const totalCells = SIZE * SIZE;
  const ratio = totalCells > 0 ? occupied / totalCells : 0;
  return {
    occupied,
    totalCells,
    ratio,
    overThreshold: ratio >= CHANNEL_GRID_SATURATION_THRESHOLD,
  };
}
