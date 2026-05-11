// 2026-05-11 — TASK-012 (T1.11): squad-select screen relocated from legacy.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - renderSelect()                   line 67423-67432   (V3.0 vivid loadout dispatcher)
//
// Owns: squad-selection screen rendering. Like renderMenu, this is a thin
// shell that delegates to V3.0 Vivid renderers (vRenderSquadStrip /
// vRenderSynergyRow / vRenderFilterSubrow / vRenderRoster) + legacy
// renderers that touch modifier + equipment state.
//
// Does NOT own:
//   - V3.0 Vivid renderer internals (vRenderSquadStrip etc.) — legacy holds
//     these for now; select.js only invokes them via /* global */ stubs.
//   - Hero-detail modal (renderHeroDetail*) — those live in legacy and will
//     fold into profile.js or a dedicated hero-detail UI module on follow-up.
//   - vFilter / vSort / vSearch state — module-scope legacy state lines
//     67435-67437, owned by the V3.0 Vivid layer.
//
// 2026-05-11 — Roman: pure-relocation discipline.

/* eslint-disable no-empty, no-unused-vars */

/* global renderModifiers, renderEquipmentSlots,
   vRenderSquadStrip, vRenderSynergyRow, vRenderFilterSubrow, vRenderRoster */

import { log } from '../services/logger.js';

// ─── renderSelect — V3.0 vivid loadout dispatcher (legacy 67423-67432) ──────
export function renderSelect() {
  // V3.0 Phase 3 Vivid Stylized — new loadout layout delegates to vRender* helpers.
  // Legacy renderers still called for cross-screen side-effects (modifiers state).
  try { renderModifiers(); }       catch(e){}
  try { renderEquipmentSlots(); }  catch(e){}
  try { vRenderSquadStrip(); }     catch(e){ log.warn('vRenderSquadStrip failed:', e); }
  try { vRenderSynergyRow(); }     catch(e){ log.warn('vRenderSynergyRow failed:', e); }
  try { vRenderFilterSubrow(); }   catch(e){ log.warn('vRenderFilterSubrow failed:', e); }
  try { vRenderRoster(); }         catch(e){ log.warn('vRenderRoster failed:', e); }
}

// ─── setupSelectEventListeners / cleanupSelect — listener contract ──────────
export function setupSelectEventListeners() {
  // TODO(T1.12): attach 'click' listeners to:
  //   #filterAllBtn / #filterRaceBtn / #filterElementBtn / #filterRoleBtn /
  //   #filterFavBtn → vFilter mode switch
  //   #sortPowerBtn / #sortElementBtn / #sortRarityBtn / #sortRecentBtn →
  //   vSort switch
  //   #searchInput → vSearch input handler
  //   delegated click on .roster-card → openHeroDetail(heroId)
  //   #startBattleFromSelectBtn → startBattleFromSelect
  //   #backToMenuFromSelectBtn → goToMenu
}

export function cleanupSelect() {
  // TODO(T1.12): remove listeners attached in setupSelectEventListeners().
}
