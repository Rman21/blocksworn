// 2026-05-11 — TASK-012 (T1.11): UI router relocated from legacy.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - showScreen(name)                 line 66426-66471   (screen-switching + modal cleanup + music routing)
//   - goToMenu()                       line 66473-66547   (menu refresh chain + FTUE nav gate)
//   - goToSelect()                     line 66549-66567   (squad-mgmt education delay)
//   - returnToMenuFromBattle()         line 66615-66631   (battle exit with confirm + RP run reset)
//
// Owns: top-level screen routing dispatcher + menu/select/battle navigation
// gates. Wires per-screen `render*()` calls when the active screen changes,
// closes lingering modals, and runs the post-victory menu refresh chain
// (daily missions, login streak, season-end warnings, tower visibility,
// patch notes, PWA prompt).
//
// Does NOT own:
//   - Individual `render*()` functions — see sibling modules (menu.js,
//     select.js, profile.js, etc.) for screen-local renderers.
//   - onBossDefeated / battle exit cleanup beyond the menu return — those
//     live in rewards.js and battle-screen.js.
//   - FTUE state machine — see src/core/ftue-state.js (T1.10.1).
//
// All identifiers referenced as `typeof X === 'function'` in the legacy
// source are preserved as `/* global */` directives — T1.12 wires the
// concrete references when src/main.js takes over as the entry point.
//
// 2026-05-11 — Roman: pure-relocation discipline. No "improvements".
// Comments above this line replicate legacy intent verbatim.

/* eslint-disable no-empty, no-unused-vars */

// T1.13.1 (2026-05-11): /* global */ → ES imports for resolved src/ exports.
// router.js sits at the screen-dispatch core: imports renderMenu / renderSelect
// / renderProfile (the named per-screen renderers, T1.11 modules) and the
// shared FTUE / battle / clearVoidfangTints helpers. Circular imports with
// menu.js (menu uses goToSelect/showScreen from this module) are intentional
// and safe — all cross-references resolve through function bodies, not module
// init.
import { isFtueActive, ftueBlockNavIfActive } from '../core/ftue-state.js';
import { renderMenu, renderResourceBar } from './menu.js';
import { renderSelect } from './select.js';
import { renderProfile } from './profile.js';
// T2.12 (2026-05-12): Codex screen renderer — Identity Layer aggregation surface.
// Pure read of game state + writes only to its own localStorage key. Additive
// — never modifies any sacred table per CLAUDE.md §2.
import { renderCodex } from './codex.js';
import { clearVoidfangTints } from '../core/reactivity-events.js';
import { log } from '../services/logger.js';

/* global vRenderTopbar, vRenderChapter, vRenderBossCard, vRenderSquadDock,
   vRenderWhatsNew,
   renderBossProgression, renderChapterToggle, renderEssenceStrip,
   activateNavFor,
   playContextMusic,
   restorePreFloorModifiers,
   checkAndRefreshDailyMissions, checkAndRefreshWeeklyMissions,
   checkLoginStreak, updateDailyButtonBadge,
   _maybeShowSeasonEndWarning, _maybeShowSeasonTransitionCinematic,
   updateWednesdayChestBanner, updateContentTeaserBanner,
   maybeShowPatchNotesModal, checkTowerWeeklyReset,
   updateTowerButtonVisibility, updateSeasonButtonVisibility,
   maybeShowBattlePassEducation, _pwaShowPrompt,
   _applyShopLockState, _maybeShowChapterCompletePopup,
   _maybeShowDailyPopup, maybeShowSquadMgmtEducation,
   maybeShowHeroUpgradeReadyEducation, flashText,
   bossHP, confirm */
// LEGACY-ONLY: above tokens have no src/ export — shims retired in T1.14+ cleanup
// (except `confirm`, a browser builtin not configured in eslint env).

// ─── T1.13.2: Canonical writable-globals bindings (router-owned) ──────────
// `currentScreen` and `_currentRacePureRace` were `/* global */` writable
// declarations referring to legacy script-scope state. In ES modules bare
// assignment to undeclared identifiers throws (strict mode), so they are
// promoted to module-private `let` + window bridge per the T1.10.6/T1.10.7
// pattern.
//
// `currentScreen` initial: 'menu' (set by first showScreen call).
// `_currentRacePureRace` initial: null (race-pure run flag, set by FTUE /
// battle entry, cleared on retreat / completion).
//
// `gameEnded` is canonically owned by src/core/battle.js (battle lifecycle
// state); we route the legacy `gameEnded = true` mutation in returnToMenuFromBattle
// through `window.gameEnded` so the same accessor backs both modules.
let currentScreen = 'menu';
let _currentRacePureRace = null;
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'currentScreen',          { configurable: true, get: () => currentScreen,          set: (v) => { currentScreen = v; } });
  Object.defineProperty(window, '_currentRacePureRace',   { configurable: true, get: () => _currentRacePureRace,   set: (v) => { _currentRacePureRace = v; } });
}

// ─── showScreen — top-level screen dispatcher (legacy 66426-66471) ─────────
export function showScreen(name) {
  currentScreen = name;
  // V3.0 Phase 3 Block 3.1: added 'shop' route for Shop screen
  // FIX BUG-001: added 'season' — without it, goToSeason() produced a black
  // screen (no .screen had .active, user was soft-locked).
  // T2.12 (2026-05-12): added 'codex' route for Codex screen (Identity Layer
  // aggregation surface). Pure addition — existing routes preserved byte-perfect.
  // T3.08 (2026-05-13): added 'replay-viewer' route for Replay viewer (Phase 3
  // §4.2). Mounted via deeplink (?replay=<id>) or future Codex Replay button.
  // T3.03 (2026-05-13): added 'adventures' route for Adventures screen (Phase 3
  // §2 — async clan create/browse/join/view/leave). Dynamic-import per replay-
  // viewer precedent — only loads when the player opens the screen.
  const map = { menu: 'screenMenu', select: 'screenSelect', battle: 'screenBattle', shop: 'screenShop', dailies: 'screenDailies', tower: 'screenTower', season: 'screenSeason', profile: 'screenProfile', codex: 'screenCodex', 'replay-viewer': 'screenReplayViewer', adventures: 'screenAdventures', friends: 'screenFriends', 'party-tower': 'screenPartyTower', 'tower-season': 'screenTowerSeason' };
  for (const key in map) {
    const el = document.getElementById(map[key]);
    if (el) el.classList.toggle('active', key === name);
  }
  // FIX BUG-004: previously only 3 modals were closed on screen change (art picker,
  // art inventory, synergy info). That left infoModal, lockedHeroModal,
  // heroDetailModal, leaderChoiceModal, and towerFloorClearModal stuck active on top
  // of whatever screen we transitioned to — most visible when resetProgress (inside
  // infoModal) triggered FTUE and the info modal remained over the battle screen.
  // Removing .active alone is sufficient — .modal CSS falls through to display:none.
  // Not touching #modal (victory/defeat modal) — it has its own explicit close flow
  // and some transitions (e.g. post-victory) legitimately keep it open.
  // Task #1.7: noEnergyModal id removed from list (modal deleted with Energy system).
  ['artPickerModal', 'artInventoryModal', 'synergyInfoModal',
   'infoModal', 'lockedHeroModal',
   'heroDetailModal', 'leaderChoiceModal', 'towerFloorClearModal'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  if (name === 'menu') renderMenu();
  if (name === 'select') renderSelect();
  if (name === 'profile' && typeof renderProfile === 'function') renderProfile();
  // T2.12 (2026-05-12): Codex render on screen activation. Defensive try/catch
  // — Codex render is never allowed to crash screen switching.
  if (name === 'codex') {
    try { renderCodex(); } catch (e) { log.warn('renderCodex failed:', e); }
  }
  // T3.08 (2026-05-13): Replay viewer dynamic import on screen activation.
  // Dynamic to keep the menu-path bundle slim (viewer only loads when used).
  // window.__replayViewerCurrentId is set by main.js deeplink handler OR
  // future Codex Replay button before showScreen('replay-viewer') is called.
  if (name === 'replay-viewer') {
    import('./replay-viewer.js').then(mod => {
      try { mod.renderReplayViewer(); } catch (e) { log.warn('renderReplayViewer failed:', e); }
    }).catch(e => log.warn('replay-viewer dynamic import failed:', e));
  }
  // T3.03 (2026-05-13): Adventures dynamic import on screen activation.
  // Dynamic to keep the menu-path bundle slim (Adventures only loads when
  // used). window.__adventuresInitialCtx (optional) is read by renderAdventures
  // so a future deeplink (e.g. ?adventure=<id>) can pre-open a clan detail
  // view directly. Defensive try/catch — Adventures render never crashes the
  // screen-switching pipeline.
  if (name === 'adventures') {
    import('./adventures.js').then(mod => {
      try {
        const ctx = (typeof window !== 'undefined' && window.__adventuresInitialCtx) || null;
        mod.renderAdventures(undefined, ctx);
        // One-shot — consume the deeplink context after handing it off.
        try { if (typeof window !== 'undefined') window.__adventuresInitialCtx = null; } catch (_e) {}
      } catch (e) { log.warn('renderAdventures failed:', e); }
    }).catch(e => log.warn('adventures dynamic import failed:', e));
  }
  // T3.13 (2026-05-13): Party Tower dynamic import on screen activation.
  // Dynamic to keep the menu-path bundle slim (Party Tower only loads when
  // used). window.__partyTowerInitialCtx (optional) is read by renderPartyTower
  // so a future deeplink (e.g. ?party=<id>) can pre-open a party detail view
  // directly. Defensive try/catch — Party Tower render never crashes the
  // screen-switching pipeline.
  if (name === 'party-tower') {
    import('./party-tower.js').then(mod => {
      try {
        const ctx = (typeof window !== 'undefined' && window.__partyTowerInitialCtx) || null;
        mod.renderPartyTower(undefined, ctx);
        try { if (typeof window !== 'undefined') window.__partyTowerInitialCtx = null; } catch (_e) {}
      } catch (e) { log.warn('renderPartyTower failed:', e); }
    }).catch(e => log.warn('party-tower dynamic import failed:', e));
  }
  // T3.15 (2026-05-13): Tower seasonal dynamic import on screen activation.
  // Dynamic to keep the menu-path bundle slim (Tower seasonal only loads
  // when used). window.__towerSeasonInitialCtx (optional) is read by
  // renderTowerSeason so a future deeplink (e.g. ?season=<id>) can preload
  // a specific view. Defensive try/catch — never crashes screen switching.
  if (name === 'tower-season') {
    import('./tower-season.js').then(mod => {
      try {
        const ctx = (typeof window !== 'undefined' && window.__towerSeasonInitialCtx) || null;
        mod.renderTowerSeason(undefined, ctx);
        try { if (typeof window !== 'undefined') window.__towerSeasonInitialCtx = null; } catch (_e) {}
      } catch (e) { log.warn('renderTowerSeason failed:', e); }
    }).catch(e => log.warn('tower-season dynamic import failed:', e));
  }
  // T3.06 (2026-05-13): Friends full-list dynamic import on screen activation.
  // Dynamic to keep the menu-path bundle slim (full list only loads when used).
  // The mini-block widget is mounted inline on the menu via menu.js.
  // Defensive try/catch — render never crashes screen switching.
  if (name === 'friends') {
    import('./friend-leaderboard.js').then(mod => {
      try {
        const mount = document.getElementById('screenFriends');
        if (mount) mod.renderFullFriendList(mount);
      } catch (e) { log.warn('renderFullFriendList failed:', e); }
    }).catch(e => log.warn('friend-leaderboard dynamic import failed:', e));
  }
  // V3.0 Phase 2 Vivid Stylized: sync bottom-nav active state on every transition.
  try { activateNavFor(name); } catch(e) {}
  // 2026-04-27 — Audio: per-screen background music routing.
  // Battle screen audio is handled by startBossBattle (per-fight context); this
  // hook covers menu / map / select / shop / dailies / tower / season screens.
  try {
    if (typeof playContextMusic === 'function') {
      if (name === 'tower' || name === 'season') {
        playContextMusic('tower');
      } else if (name === 'battle') {
        // battle music set by startBossBattle directly — leave current context
      } else {
        playContextMusic('menu');
      }
    }
  } catch (e) {}
}

// ─── goToMenu — main menu navigation (legacy 66473-66547) ───────────────────
export function goToMenu() {
  // V3.0 Phase 1 Block 1.1: block user-initiated menu nav during FTUE.
  // Internal FTUE flow uses showScreen() directly, which is not gated.
  if (ftueBlockNavIfActive('goToMenu')) return;
  // V3.0 Phase 2 Block 2.1: restore manual-toggle modifier state stashed by launchFloor.
  // Idempotent — no-op if this fight wasn't a floor launch.
  try { restorePreFloorModifiers(); } catch(e){}
  // V3.0 Phase 6 Block 6.3: clear any lingering Voidfang grid tints + shroud flag
  // on menu return. Covers loss paths, forfeits, and any exit not going through
  // onBossDefeated. Idempotent — safe to call after any battle regardless of boss.
  try { if (typeof clearVoidfangTints === 'function') clearVoidfangTints(); } catch (e) {}
  // V3.0 Phase 5 Block 5.1: refresh daily missions + login streak, update badge.
  // Block 5.3: also refresh weekly missions on Monday boundary.
  // Block 6.2: also toggle CODEX button visibility based on FTUE state.
  // isFtueActive() gate prevents pre-tutorial players from seeing dailies/weeklies.
  // All calls are idempotent — safe on every menu open.
  try {
    if (typeof isFtueActive !== 'function' || !isFtueActive()) {
      checkAndRefreshDailyMissions();
      if (typeof checkAndRefreshWeeklyMissions === 'function') checkAndRefreshWeeklyMissions();
      checkLoginStreak();
      updateDailyButtonBadge();
      // SPRINT.2 BP.S2 — Season-end warnings (3+1 days) + transition cinematic
      // (first menu after rollover). Run BEFORE chest banner per spec §5.6 so
      // modal layer sequences correctly (cinematic → warning → banners).
      try { if (typeof _maybeShowSeasonEndWarning === 'function') _maybeShowSeasonEndWarning(); } catch (e) {}
      try { if (typeof _maybeShowSeasonTransitionCinematic === 'function') _maybeShowSeasonTransitionCinematic(); } catch (e) {}
      // TOWER.1 — Wednesday Chest banner. Idempotent: shows when claimable
      // (Wed 4 AM → next Wed 4 AM with tier reached + not yet claimed),
      // hides otherwise. Re-runs every menu open so claim state stays fresh.
      try { if (typeof updateWednesdayChestBanner === 'function') updateWednesdayChestBanner(); } catch (e) {}
      // CONTENT.3 — Drop event lifecycle. Teaser banner for T-3..T-1 drops,
      // patch-notes modal once on T+0 first visit. Push notifs deferred to
      // Phase 9 (PWA service worker work).
      try { if (typeof updateContentTeaserBanner === 'function') updateContentTeaserBanner(); } catch (e) {}
      try { if (typeof maybeShowPatchNotesModal === 'function') maybeShowPatchNotesModal(); } catch (e) {}
    }
    // V3.0 Phase 7 Block 7.1: Tower weekly reset + button visibility.
    // isTowerUnlocked gates on voidfangDefeated flag; updateTowerButtonVisibility
    // also respects FTUE state. Both idempotent.
    if (typeof checkTowerWeeklyReset === 'function') checkTowerWeeklyReset();
    if (typeof updateTowerButtonVisibility === 'function') updateTowerButtonVisibility();
    // 2026-04-28 — Battle Pass button visibility (FTUE gate). Mirrors Tower wiring.
    if (typeof updateSeasonButtonVisibility === 'function') updateSeasonButtonVisibility();
    // 2026-04-28 — Player Education Stage 13: Battle Pass intro modal. No-op
    // unless trigger conditions met (Ch1 done OR 3+ T2 ascensions) and not
    // shown before. Self-gates on FTUE.
    if (typeof maybeShowBattlePassEducation === 'function') {
      try { maybeShowBattlePassEducation(); } catch (e) { log.warn('maybeShowBattlePassEducation failed:', e); }
    }
    // 2026-04-30 — Mobile UX Fix v0.1 §6: PWA add-to-home-screen prompt.
    // Tied to goToMenu (not battle-end) so it doesn't interrupt the
    // post-victory dialog flow. Self-gates inside _pwaShowPrompt on
    // mobile + non-PWA + not-acked + cooldown elapsed + battles >= 1.
    // 1.5s delay so victory animations / battle-pass intro modal land
    // first; PWA prompt is the lowest-priority nudge.
    if (typeof _pwaShowPrompt === 'function') {
      try { setTimeout(_pwaShowPrompt, 1500); } catch (e) {}
    }
  } catch (e) { log.warn('Phase 5/6/7 menu refresh failed:', e); }
  // Phase F (2026-04-28): apply shop lock state + run daily pop-up scheduler.
  // Both are FTUE-gated via isFtueActive — pop-ups never fire during tutorial
  // and shop nav stays hidden for first 7 days regardless of FTUE status.
  try { if (typeof _applyShopLockState === 'function') _applyShopLockState(); } catch (e) {}
  try {
    if (typeof isFtueActive !== 'function' || !isFtueActive()) {
      // Chapter-complete celebration takes priority — fires once per new
      // chapter cleared, can co-exist with daily pop-up since they're
      // logically distinct events.
      if (typeof _maybeShowChapterCompletePopup === 'function') _maybeShowChapterCompletePopup();
      if (typeof _maybeShowDailyPopup === 'function') _maybeShowDailyPopup();
    }
  } catch (e) { log.warn('Phase F pop-ups failed:', e); }
  showScreen('menu');
}

// ─── goToSelect — squad-select navigation (legacy 66549-66567) ──────────────
export function goToSelect() {
  // V3.0 Phase 1 Block 1.1: roster + squad select blocked during FTUE
  if (ftueBlockNavIfActive('goToSelect')) return;
  showScreen('select');
  // 2026-04-28 — Player Education Stage 4: first-time squad management primer.
  // Delayed slightly so the screen render settles before the modal layers on.
  // Self-gates on FTUE + per-install localStorage flag.
  try { setTimeout(() => maybeShowSquadMgmtEducation(), 400); } catch (e) {}
  // 2026-04-30 — Polish v0.2 Track I §I.4.3: Hero Upgrades primer fires
  // here (first Heroes screen open with threshold met), not on hero-card
  // grant. Contextual — the player is already looking at heroes when
  // the modal explains how T2 ascension works. The function self-gates
  // on FTUE, the per-install flag, and Stage-11 suppression, so calling
  // it on every goToSelect is safe and idempotent. 800ms delay so the
  // squad-mgmt primer above gets first crack on truly-fresh installs.
  try { setTimeout(() => {
    if (typeof maybeShowHeroUpgradeReadyEducation === 'function') maybeShowHeroUpgradeReadyEducation();
  }, 800); } catch (e) {}
}

// ─── returnToMenuFromBattle — battle exit (legacy 66615-66631) ──────────────
export function returnToMenuFromBattle() {
  // V3.0 Phase 1 Block 1.1: block escape-to-menu during FTUE. Player MUST complete
  // the tutorial fight. If somehow this is called during FTUE, flash + return.
  if (isFtueActive()) {
    try { flashText('FINISH THE TUTORIAL FIRST', '#8A88A0'); } catch(e){}
    return;
  }
  if (!window.gameEnded && bossHP > 0) {
    if (!confirm('Return to menu? Current battle progress will be lost.')) return;
  }
  // T1.13.2: gameEnded canonical ownership lives in src/core/battle.js;
  // route the legacy mutation through window.gameEnded so the battle.js
  // module-private binding stays the single source of truth.
  window.gameEnded = true;
  // 2026-04-29 — Race-Pure run flag must clear on retreat so the next battle
  // doesn't inherit the +20% HP / ×2 loot envelope from an abandoned challenge.
  try { _currentRacePureRace = null; } catch (e) {}
  document.getElementById('modal').classList.remove('active');
  goToMenu();
}

// ─── setupRouting — entry-point listener wiring (T1.12 will call) ───────────
// Placeholder for setupRouting() invoked from src/main.js per Execution Plan
// §13 T1.12 bootstrap order. Real wiring (window beforeunload, history popstate,
// bottom-nav click delegation) lands in T1.12. Kept as a documented no-op so
// the import surface is stable across the T1.11→T1.12 boundary.
export function setupRouting() {
  // TODO(T1.12): wire bottom-nav delegation + history.pushState + back-button
  // handler when src/main.js becomes the entry point.
}

// ─── cleanupRouting — symmetric teardown ────────────────────────────────────
export function cleanupRouting() {
  // TODO(T1.12): remove listeners attached in setupRouting().
}
