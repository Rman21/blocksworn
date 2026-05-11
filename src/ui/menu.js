// 2026-05-11 — TASK-012 (T1.11): home-hub menu screen relocated from legacy.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - renderResourceBar()              line 24024-24032   (gold + gems + HP/mit chip strip)
//   - renderMenu()                     line 66689-66707   (V3.0 vivid hub dispatcher)
//   - startBattleFromMenu()            line 66569-66609   (squad gate + auto-pick boss)
//   - startBattleFromSelect()          line 66611-66613   (alias)
//
// Owns: home-screen rendering + the "Start battle" CTA dispatcher. Menu is
// a thin shell that delegates to V3.0 Vivid renderers (vRenderTopbar /
// vRenderChapter / vRenderBossCard / vRenderSquadDock) — those V3.0
// renderers stay in legacy for now and will be folded into this module on
// follow-up cleanup (out of scope for T1.11).
//
// Does NOT own:
//   - showScreen() / goToMenu() / goToSelect() — see router.js
//   - V3.0 Vivid renderer internals (vRenderTopbar etc.) — legacy holds
//     these; menu.js only invokes them via /* global */ stubs.
//   - Modal dialogs (info / locked-hero / hero-detail) — those are per-screen
//     concerns owned by select.js / battle-screen.js / shop.js as appropriate.
//
// 2026-05-11 — Roman: pure-relocation discipline.

/* eslint-disable no-empty, no-unused-vars, no-redeclare */

// T1.13.1 (2026-05-11): /* global */ → ES imports for resolved src/ exports.
// Resolved → imports below. Unresolved (legacy-only) tokens documented in the
// remaining /* global */ block — those modules still live in legacy until a
// later cleanup pass.
import { isFtueActive } from '../core/ftue-state.js';
import { showScreen, goToSelect } from './router.js';
import { startBossBattle } from '../core/battle.js';
import { log } from '../services/logger.js';

/* global vRenderTopbar, vRenderChapter, vRenderBossCard, vRenderSquadDock,
   vRenderWhatsNew, vRenderCosmicMemorial,
   renderBossProgression, renderChapterToggle, renderEssenceStrip,
   renderResourceBarHpMit,
   gold, gems,
   activeSquad, SQUAD_MAX, seenDialogs,
   playDialog, flashText, rebuildHeroDeck,
   bossesDefeated, chapterProgress, currentChapter,
   BOSSES, selectedBossIdx, currentBossIdx */
/* global currentBossIdx:writable, bossesDefeated:writable, chapterProgress:writable */
// LEGACY-ONLY: above tokens have no src/ export — shims retired in T1.14+ cleanup.

// ─── renderResourceBar — gold + gem strip (legacy 24024-24032) ──────────────
export function renderResourceBar() {
  const gEl = document.getElementById('resGoldAmt');
  if (gEl) gEl.textContent = gold.toLocaleString('en-US');
  const gmEl = document.getElementById('gemCount');
  if (gmEl) gmEl.textContent = String(gems);
  // 2026-05-02 — COMBAT v2.1 P1 §5.5: HP X/100 + 🛡% chips. Defensively
  // injected — silently no-ops if no resource-bar container exists in DOM.
  try { if (typeof renderResourceBarHpMit === 'function') renderResourceBarHpMit(); } catch (e) {}
}

// ─── renderMenu — V3.0 vivid hub dispatcher (legacy 66689-66707) ────────────
export function renderMenu() {
  // V3.0 Phase 2 Vivid Stylized — main hub layout.
  try { vRenderTopbar(); }    catch(e){ log.warn('vRenderTopbar failed:', e); }
  try { vRenderChapter(); }   catch(e){ log.warn('vRenderChapter failed:', e); }
  try { vRenderBossCard(); }  catch(e){ log.warn('vRenderBossCard failed:', e); }
  try { vRenderSquadDock(); } catch(e){ log.warn('vRenderSquadDock failed:', e); }
  // 2026-04-30 — Polish v0.2 Track I §I.4.4: WHAT'S NEW accordion
  // visibility + auto-expire. No-ops if no Ch.1-unlock timestamp is set
  // or if the 3-day window has passed.
  try { vRenderWhatsNew(); }  catch(e){ log.warn('vRenderWhatsNew failed:', e); }
  try { vRenderCosmicMemorial(); } catch(e){ log.warn('vRenderCosmicMemorial failed:', e); }
  // Legacy renderers — kept because they update other screens or are called from
  // many code paths. Their DOM hosts no longer exist in screenMenu, but each
  // function no-ops via null-guards when the target element is missing.
  try { renderResourceBar(); }      catch(e){}
  try { renderBossProgression(); }  catch(e){}
  try { renderChapterToggle(); }    catch(e){}
  try { renderEssenceStrip(); }     catch(e){}
}

// ─── startBattleFromMenu — primary CTA (legacy 66569-66609) ─────────────────
export function startBattleFromMenu() {
  if (activeSquad.length < SQUAD_MAX) {
    // 2026-04-27 — Pre-Lich (and any post-bump) tutorial. The classic flash
    // "SELECT 5 HEROES" is terse; for the FIRST time the player hits this
    // gate after SQUAD_MAX bumped to 5 (post-Phoenix), show a clear dialog
    // explaining WHY + route them to the Select screen so they can add the
    // missing hero. Gated by seenDialogs so subsequent under-squad attempts
    // get the lighter flash. Suppressed during FTUE so scripted onboarding
    // never collides with this gate.
    try {
      const ftueOff = (typeof isFtueActive !== 'function') || !isFtueActive();
      const seen    = (typeof seenDialogs !== 'undefined') && seenDialogs;
      if (ftueOff && SQUAD_MAX === 5 && seen && !seen.has('tut_pre_lich_check')) {
        if (typeof playDialog === 'function') {
          playDialog('tut_pre_lich_check', () => {
            // After dialog: route to Select screen so player can fill the slot.
            try { if (typeof goToSelect === 'function') goToSelect(); } catch (e) {}
          });
          return;  // suppress the legacy flash on this one-time tutorial path
        }
      }
    } catch (e) {}
    flashText(`SELECT ${SQUAD_MAX} HEROES`, '#E85D4A');
    return;
  }
  // Task #1.7: Energy gate removed.
  rebuildHeroDeck();
  showScreen('battle');
  // V18.19: honor player's boss pick if valid (<= bossesDefeated), else auto-pick next undefeated.
  bossesDefeated = chapterProgress[currentChapter] || 0;
  const autoIdx = bossesDefeated >= BOSSES.length ? 0 : bossesDefeated;
  if (selectedBossIdx !== null && selectedBossIdx <= bossesDefeated && selectedBossIdx < BOSSES.length) {
    currentBossIdx = selectedBossIdx;
  } else {
    currentBossIdx = autoIdx;
  }
  if (currentBossIdx === 0 && bossesDefeated >= BOSSES.length) {
    bossesDefeated = 0; chapterProgress[currentChapter] = 0;
  }
  startBossBattle();
}

// ─── startBattleFromSelect — alias (legacy 66611-66613) ─────────────────────
export function startBattleFromSelect() {
  startBattleFromMenu();
}

// ─── setupMenuEventListeners / cleanupMenu — listener contract ──────────────
// Per Execution Plan §13 T1.11 the screen module contract is:
//   render<Screen>() + setup<Screen>EventListeners() + cleanup<Screen>()
// T1.11 lands the render+CTA functions; T1.12 wires the addEventListener
// calls when src/main.js becomes the entry point. The legacy HTML carries
// onclick="..." attributes on the buttons — those are NOT removed in T1.11
// (legacy HTML stays untouched), but the setup function shape is reserved
// here so T1.12 has a stable target.
export function setupMenuEventListeners() {
  // TODO(T1.12): attach 'click' listeners to:
  //   #startBattleBtn → startBattleFromMenu
  //   #goToSelectBtn  → goToSelect
  //   #goToShopBtn    → showScreen('shop')
  //   #goToTowerBtn   → showScreen('tower')
  //   #goToSeasonBtn  → showScreen('season')
  //   #goToProfileBtn → showScreen('profile')
  //   #goToDailiesBtn → showScreen('dailies')
}

export function cleanupMenu() {
  // TODO(T1.12): remove listeners attached in setupMenuEventListeners().
}
