// 2026-05-11 — TASK-011 (T1.10.1): FTUE state machine relocated from legacy.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - State + constants                 line 24061-24109   (`ftueBeat`, storage key, Pyredrake tuning, safety-rail flag)
//   - saveFtueToStorage / loadFtueFromStorage line 24120-24137
//   - isFtueComplete / isFtueActive / ftueIs  line 24139-24154
//   - advanceFtue                        line 24191-24239
//   - onFtueBeatChanged                  line 24241-24326
//   - skipFtue / resetFtue               line 24328-24329
//   - _skipOnboarding                    line 24410-24436
//   - routeByFtue                        line 24438-24474
//   - ftueBlockNavIfActive               line 24476-24481
//   - load-on-script-eval                line 24484           (`loadFtueFromStorage()` top-level)
//
// SACRED PER CLAUDE.md §2.5: the FTUE state machine, FTUE_BOSS_GUARANTEES (held
// in src/data/ftue-scripts.js since T1.07), and the Chronicler character/beat
// triggers are sacred. T1.10.1 must NOT modify any transition edge, beat name,
// or side-effect ordering — pure relocation only.
//
// Owns: FTUE beat cursor (`ftueBeat`), beat transition validation, persistence,
// active/complete predicates, dev-tooling reset path, nav gate, initial route.
//
// Does NOT own:
//   - FTUE data tables (FTUE_BEATS / FTUE_TRANSITIONS / FTUE_SCRIPTS /
//     FTUE_BOSS_GUARANTEES / FTUE_TUTORIAL_TEXTS — all live in
//     src/data/ftue-scripts.js per T1.07).
//   - Boss-stats overrides (getEffectiveBossStats) — T1.10.7 (bosses).
//   - Battle launchers (startPyredrakeFtueBattle / startGruntFtueBattle /
//     startChronicleFtueBattle) — T1.10.9 (battle).
//   - Hero reveals + leader choice modal — T1.10.4 (heroes) / T1.11 (ui).
//   - Density-aware overlay (showTutorialOverlay, _phase8* helpers,
//     enforceBossFTUEGuarantees) — large coupled subsystem; T1.11 (ui) /
//     T1.10.9 (battle) territory.
//   - Intro-video gate (_maybeShowIntroVideo) — T1.11 (ui).
//
// Storage migration: legacy code called `localStorage.{set,get,remove}Item`
// directly with the key 'blocksworn_ftue_beat' storing the bare beat string
// (e.g. `localStorage.setItem(FTUE_STORAGE_KEY, 'pyredrake_fight')`). Per
// T1.08 we route through the `src/services/storage.js` abstraction, which
// JSON-stringifies on write and JSON.parse-decodes on read.
//
// IMPORTANT COMPATIBILITY CAVEAT — flagged for T1.10.9 wire-up review:
// A pre-existing player save would contain the bare string `'pyredrake_fight'`
// in localStorage. storage.getItem() runs JSON.parse on that, which throws,
// and the abstraction returns its `defaultValue` (null). That would silently
// reset existing players to 'not_started' on first launch after the new code
// goes live. T1.10.1 does NOT activate this module (nothing imports it yet —
// see Step E of the assignment: "tree-shake out of the bundle"). T1.10.9
// must add a one-shot migration shim in initFtueState() that, on first read
// returning null, falls back to `localStorage.getItem(FTUE_STORAGE_KEY)` raw
// and re-saves via storage.setItem to upgrade the wire format. This is
// flagged in "Замечено рядом" for the CTO review.
//
// Undeclared cross-module identifiers preserved with /* global */ + TODO
// markers (per the T1.09 pattern). They will be wired in subsequent sub-tasks.
//
// 2026-05-11 — Roman: pure-relocation discipline. No "improvements". Nothing
// new. Comments above this line replicate legacy intent.

// T1.13.1: /* global */ → ES imports for resolved src/ exports.
// T1.13.4: playDialogScript + dialog state (dialogActive, dialogClickLock,
//   _pendingDialogRequest, _dialogDeferredQueue) flipped from /* global */ to
//   import from src/ui/dialog.js. The 5 module-private state vars are still
//   read/written via the window bridge in dialog.js (cross-module legacy
//   teardown pattern); the playDialogScript function is now an ES import.
import {
  FTUE_BEATS,
  FTUE_TRANSITIONS,
  FTUE_TRANSITIONS_FORCE,
  FTUE_SCRIPTS,
} from '../data/ftue-scripts.js';
import { resetBossVoiceFlags } from './bosses.js';
import { ASSETS } from '../data/assets.js';
import { playDialogScript } from '../ui/dialog.js';
import { mirrorWindowProp } from '../utils/window-mirror.js';
import {
  startPyredrakeFtueBattle,
  startGruntFtueBattle,
  startChronicleFtueBattle,
  finalizeFtue,
} from './battle.js';
import * as storage from '../services/storage.js';
import { log } from '../services/logger.js';

// Residual legacy-owned tokens:
/* global showLeaderChoiceModal,
   revealHero, flashText, vibrate,
   _dialogDeferredQueue, _chronoActive, _hideChronoBeat, location */
/* global _pendingDialogRequest:writable, dialogActive:writable, dialogClickLock:writable */
// LEGACY-ONLY: above tokens have no src/ export — shims retired in T1.14+ cleanup.
// NB: dialog state (_pendingDialogRequest / dialogActive / dialogClickLock /
// _dialogDeferredQueue) is now module-private inside src/ui/dialog.js and
// exposed back on window via Object.defineProperty(window, ...) bridges; the
// /* global */ declarations above stay for legacy-style writable bridge reads
// inside _skipOnboarding teardown.

// ─── Module-private state ──────────────────────────────────────────────────
// Legacy declared `let ftueBeat = 'not_started'` at file scope (line 24061).
// Kept private here; consumers must use getCurrentBeat() / isFtueActive() /
// isFtueComplete() / ftueIs(). Direct mutation is reserved for resetFtue()
// (matches legacy 24329 semantics: bypasses transition validation by design).
let ftueBeat = 'not_started';

// T1.13.5 (2026-05-12): window bridge for cross-module legacy-style reads.
// battle.js (and a handful of other modules) still references `ftueBeat` as
// a bare identifier per the legacy contract. Mirrors the T1.10.6/T1.10.7
// Object.defineProperty pattern: get/set route through the module-private
// `ftueBeat` binding so this stays the single source of truth. Writes via
// window.ftueBeat bypass transition validation by design (legacy semantics
// — same as resetFtue path).
if (typeof window !== 'undefined') {
  mirrorWindowProp('ftueBeat', () => ftueBeat, (v) => { ftueBeat = v; });
}

// Battle-scoped flag — reset at every battle start (legacy 24117).
// Exposed via getter/setter so battle code (T1.10.9) can flip it without
// re-exporting the module-local binding.
let ftueSafetyRailUsed = false;

// ─── FTUE-state constants (legacy 24108-24114) ────────────────────────────
// Pyredrake FTUE tuning (overrides CHAPTERS[0].bosses[0] only during
// pyredrake_fight). getEffectiveBossStats (T1.10.7) will consume these.
export const FTUE_STORAGE_KEY = 'blocksworn_ftue_beat';
export const FTUE_PYREDRAKE_HP = 800;
export const FTUE_PYREDRAKE_ATTACK_INTERVAL = 15;
// T1.14 — removed FTUE_PYREDRAKE_ARTIFACT / FTUE_GRUNT_ARTIFACT.
// Artifact subsystem deleted; FTUE drops replaced with gold + hero-cards
// (Pyredrake: 50g + 2 cards; Grunt: 75g + 3 cards) inline in src/ui/rewards.js
// per Execution Plan §13 T1.14 step 3.

// ─── Persistence (legacy 24120-24137) ─────────────────────────────────────
// Legacy used localStorage directly; T1.08 abstraction rewired here. Storage
// shape preserved (a bare string beat name); the abstraction's JSON-encode
// changes wire bytes but value parity remains.
export function saveFtueToStorage() {
  try { storage.setItem(FTUE_STORAGE_KEY, ftueBeat); }
  catch (e) { log.warn('saveFtueToStorage failed:', e); }
}

export function loadFtueFromStorage() {
  try {
    const raw = storage.getItem(FTUE_STORAGE_KEY, null);
    if (raw && FTUE_BEATS.includes(raw)) {
      ftueBeat = raw;
    } else {
      ftueBeat = 'not_started';
    }
  } catch (e) {
    log.warn('loadFtueFromStorage failed:', e);
    ftueBeat = 'not_started';
  }
}

// ─── Predicates (legacy 24139-24154) ──────────────────────────────────────
export function isFtueComplete() { return ftueBeat === 'complete'; }
export function isFtueActive()   { return ftueBeat !== 'complete'; }

// PHASE 4 BLOCK 2 (DEBT-014) — single-source predicate for "are we in beat X".
// Replaces ad-hoc `ftueBeat === 'pyredrake_fight'` etc throughout the codebase.
// Accepts a string OR an array of beat names (returns true if any match).
// Defensively returns false for unknown beats so a typo never silently passes.
export function ftueIs(beat) {
  if (Array.isArray(beat)) return beat.some((b) => ftueIs(b));
  if (typeof beat !== 'string') return false;
  if (!FTUE_BEATS.includes(beat)) {
    log.warn('ftueIs: unknown beat', beat);
    return false;
  }
  return ftueBeat === beat;
}

// Read-only getter for the current beat cursor. Module-private `ftueBeat` is
// not exported directly; getCurrentBeat() is the public surface.
export function getCurrentBeat() { return ftueBeat; }

// Battle-scoped safety-rail flag accessors (legacy 24117). The flag itself is
// flipped from battle code on the "would have died in Pyredrake fight" branch;
// reset at battle start. Both call-sites stay in legacy for T1.10.1 (T1.10.9
// wires them through these accessors).
export function getFtueSafetyRailUsed() { return ftueSafetyRailUsed; }
export function setFtueSafetyRailUsed(used) { ftueSafetyRailUsed = !!used; }

// ─── Transition (legacy 24187-24239) ──────────────────────────────────────
// Central transition. onFtueBeatChanged dispatches side effects.
// Block 1.2 wired dialogs here; Block 1.3 wired Grunt battle + finalize.
// PHASE 4 BLOCK 2 (DEBT-014): added FTUE_TRANSITIONS validation. Invalid edges
// log a warning but are still applied — preserves back-compat for any historical
// caller that depends on loose validation. Force-paths (complete / not_started)
// are always allowed for dev tooling (skipFtue / resetFtue).
export function advanceFtue(nextBeat) {
  if (!FTUE_BEATS.includes(nextBeat)) {
    log.warn('advanceFtue: invalid beat', nextBeat);
    return;
  }
  const prev = ftueBeat;
  if (prev === nextBeat) return;
  // DEBT-014 transition validation
  const allowed = FTUE_TRANSITIONS[prev] || [];
  const isForce = FTUE_TRANSITIONS_FORCE.includes(nextBeat);
  if (!isForce && !allowed.includes(nextBeat)) {
    log.warn(`[FTUE] non-canonical transition ${prev} → ${nextBeat} (allowed: ${allowed.join(',') || '∅'})`);
    // still proceed — back-compat
  }
  ftueBeat = nextBeat;
  saveFtueToStorage();
  // 2026-04-28 — Drop stale dialog/flash state at every FTUE transition.
  // Three leak sources, all from the previous beat's combat dialogs:
  //   (a) _dialogDeferredQueue — flashText/flashHeroTrigger calls deferred while
  //       a dialog was active. After the dialog ended they would fire — and
  //       could replay Pyredrake-era ability buff banners during grunt_outro.
  //   (b) _pendingDialogRequest — single-slot queue used by playDialogScript
  //       when called while another dialog is active. A queued pyredrake_intro
  //       boss voice line could surface later, after Grunt's defeat.
  //   (c) Boss-voice once-per-battle flags — defensively reset so a delayed
  //       midfight/death proc from setTimeout can't double-fire.
  // TODO(T1.10.9): rewire to dialog/boss-voice modules once extracted.
  try {
    if (typeof _dialogDeferredQueue !== 'undefined') _dialogDeferredQueue.length = 0;
    if (typeof _pendingDialogRequest !== 'undefined') _pendingDialogRequest = null;
    if (typeof resetBossVoiceFlags === 'function') resetBossVoiceFlags();
  } catch (_e) { /* swallow */ }
  // PHASE 4 HOTFIX #1 — force-dismiss any active chronograph on FSM transition
  // so a beat queued via setTimeout during the previous beat (e.g. CHARGE
  // setTimeout from a final cells-cleared cascade) can't bleed into the next
  // scene. Without this, a chrono overlay shown on top of the victory modal
  // would persist visually through hero_reveals dialogs and the captain pick
  // modal — covering the AAA UX layer below.
  // TODO(T1.11): rewire to chrono-beat UI module once extracted.
  try {
    if (typeof _chronoActive !== 'undefined' && _chronoActive
        && typeof _hideChronoBeat === 'function') {
      _hideChronoBeat();
    }
  } catch (_e) { /* swallow */ }
  log.debug(`[FTUE] ${prev} → ${nextBeat}`);
  try { onFtueBeatChanged(nextBeat, prev); } catch (e) { log.warn('onFtueBeatChanged failed:', e); }
}

// ─── Beat dispatcher (legacy 24241-24326) ─────────────────────────────────
// Side-effect entry point for each beat transition. References many systems
// not yet extracted (dialog player, hero reveals, leader choice, FTUE battle
// launchers, finalize). All preserved as undeclared globals + TODO markers.
//
// TODO(T1.10.4): revealHero, ensureRevealedForComplete → heroes module.
// TODO(T1.10.9): playDialogScript, startPyredrakeFtueBattle,
//                startGruntFtueBattle, startChronicleFtueBattle → battle.
// TODO(T1.11):   showLeaderChoiceModal, dialogOverlay DOM refs → ui.
export function onFtueBeatChanged(next, prev) {
  // V3.0 Phase 1 Block 1.2 replaced the Block 1.1 auto-advance stubs with
  // dialog-gated transitions. 'intro' plays the prologue dialog, then advances.
  // 'pyredrake_won' plays the Thara + Urzog reveal chain, then advances to
  // leader_choice. 'leader_choice' plays the framing line, then opens the
  // choice modal — which drives the next advance from onLeaderChosen.
  //
  // Beats 'grunt_fight' / 'grunt_won' / 'complete' remain no-ops here; Block 1.3
  // will wire the Ember Grunt battle + finalizeFtue.

  // 2026-04-28 — Player Education Stage 1 AAA+ — CHRONICLE beats. The new tutorial
  // entry plays Chronicle's intro dialog (Mode B speaker — boss-style portrait/
  // glow), then launches the no-fail training battle. On victory, plays outro
  // dialog and chains into the existing 'intro' beat (prologue dialog →
  // pyredrake_fight). Pyredrake is NEVER duplicated — Chronicle is gated on
  // _isFtueOnly + _isTrainingDummy and uses sentinel currentBossIdx = -1.
  if (next === 'chronicle_fight') {
    const menu = document.getElementById('screenMenu');
    if (menu) menu.classList.remove('active');
    playDialogScript(FTUE_SCRIPTS.chronicle_intro, startChronicleFtueBattle);
    return;
  }
  if (next === 'chronicle_won') {
    // Close victory modal so the outro dialog overlay has a clean stage
    const victoryModalC = document.getElementById('modal');
    if (victoryModalC) victoryModalC.classList.remove('active');
    playDialogScript(FTUE_SCRIPTS.chronicle_outro, () => advanceFtue('intro'));
    return;
  }
  if (next === 'intro') {
    // Hide any stale screen under the overlay for cleanliness
    const menu = document.getElementById('screenMenu');
    if (menu) menu.classList.remove('active');
    playDialogScript(FTUE_SCRIPTS.intro, () => advanceFtue('pyredrake_fight'));
    return;
  }
  if (next === 'pyredrake_fight') {
    startPyredrakeFtueBattle();
    return;
  }
  if (next === 'pyredrake_won') {
    // Close the victory modal if it's still up so the dialog overlay has a clean stage
    const victoryModal = document.getElementById('modal');
    if (victoryModal) victoryModal.classList.remove('active');
    // V3.0 Phase 0.1 post-refit: reveal chain uses new mixed-faction starters.
    // Blacktooth (pirate hunter) first, Frostweaver (skeleton mage) second.
    // FTUE_SCRIPTS keys kept as hero_reveals_thara/_urzog for patch stability — the
    // SCRIPT CONTENT was rewritten to speak as Grommar/Blacktooth/Frostweaver.
    revealHero('pirate_hunter');
    playDialogScript(FTUE_SCRIPTS.hero_reveals_thara, () => {
      revealHero('rock_mage');
      playDialogScript(FTUE_SCRIPTS.hero_reveals_urzog, () => advanceFtue('leader_choice'));
    });
    return;
  }
  if (next === 'hero_reveals') {
    // Block 1.2 wires reveals into 'pyredrake_won' directly (simpler state flow
    // than using hero_reveals as an extra beat). Keeping hero_reveals in the
    // FTUE_BEATS enum for completeness, but its onChanged is a no-op.
    return;
  }
  if (next === 'leader_choice') {
    playDialogScript(FTUE_SCRIPTS.leader_choice_intro, showLeaderChoiceModal);
    return;
  }
  // V3.0 Phase 1 Block 1.3 wires grunt_fight / grunt_won / complete.
  if (next === 'grunt_fight') {
    // Close any lingering modal + dialog state before launching the fight
    try {
      const m = document.getElementById('modal');
      if (m) m.classList.remove('active');
    } catch (_e) { /* swallow */ }
    playDialogScript(FTUE_SCRIPTS.grunt_intro, startGruntFtueBattle);
    return;
  }
  if (next === 'grunt_won') {
    // Close victory modal so the outro dialog overlay has a clean stage
    const victoryModal2 = document.getElementById('modal');
    if (victoryModal2) victoryModal2.classList.remove('active');
    playDialogScript(FTUE_SCRIPTS.grunt_outro, () => advanceFtue('complete'));
    return;
  }
  if (next === 'complete') {
    finalizeFtue(prev);
    return;
  }
}

// ─── Dev-tooling fast-paths (legacy 24328-24329) ──────────────────────────
// Console-only helpers — per Phase 1 spec, do NOT expose in UI. An accidental
// tap must never bypass the tutorial. `resetFtue` deliberately writes to the
// module-private `ftueBeat` and saves directly so the transition-validation
// log warning never fires for the legitimate reset path.
export function skipFtue()  { advanceFtue('complete'); location.reload(); }
export function resetFtue() { ftueBeat = 'not_started'; saveFtueToStorage(); location.reload(); }

// ─── Battle launchers ─────────────────────────────────────────────────────
// T1.13.4 patch (CTO): flipped from /* global */ to ES imports at top of
// file. Circular import (battle.js imports isFtueActive/ftueIs from here)
// is safe — ES module live bindings resolve at call time, not at module init.
// The function-body call sites above (`startChronicleFtueBattle`, etc.) get
// the live binding via the named import. Verified: lint 0, build clean,
// no module-init order issues.

// ─── Intro video gate (legacy 24351-24407) ────────────────────────────────
// Plays the cold-launch intro video once per install. Localstorage flag
// 'seenIntroVideo' persists. Tap-to-skip + auto-advance on `ended`. After
// dismissal, defers to the existing FTUE / menu routing pipeline. Failures
// silently fall through (autoplay blocked, missing asset) — no dead-end.
//
// TODO(T1.11): DOM refs (#introVideoOverlay / #introVideoPlayer / #introVideoSkip)
// will rewire to a dedicated intro-video UI module. ASSETS table will move to
// src/data/assets.js. localStorage('seenIntroVideo') stays raw for now — same
// migration note as FTUE_STORAGE_KEY (see top-of-file comment).
function _maybeShowIntroVideo(onDoneCallback) {
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    try { localStorage.setItem('seenIntroVideo', '1'); } catch (_e) { /* swallow */ }
    const overlay = document.getElementById('introVideoOverlay');
    if (overlay) {
      overlay.classList.add('fading');
      setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('fading');
        try {
          const v = document.getElementById('introVideoPlayer');
          if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
        } catch (_e) { /* swallow */ }
        if (onDoneCallback) try { onDoneCallback(); } catch (_e) { /* swallow */ }
      }, 500);
    } else {
      if (onDoneCallback) try { onDoneCallback(); } catch (_e) { /* swallow */ }
    }
  };
  // Skip if already seen, or if asset missing.
  let seen = false;
  try { seen = localStorage.getItem('seenIntroVideo') === '1'; } catch (_e) { /* swallow */ }
  if (seen || !ASSETS || !ASSETS.intro_video) {
    if (onDoneCallback) try { onDoneCallback(); } catch (_e) { /* swallow */ }
    return;
  }
  const overlay = document.getElementById('introVideoOverlay');
  const video   = document.getElementById('introVideoPlayer');
  const skip    = document.getElementById('introVideoSkip');
  if (!overlay || !video) {
    if (onDoneCallback) try { onDoneCallback(); } catch (_e) { /* swallow */ }
    return;
  }
  video.src = ASSETS.intro_video;
  overlay.classList.remove('hidden');
  // Auto-end on video completion.
  video.addEventListener('ended', finish, { once: true });
  // Tap anywhere on the overlay (or SKIP button) → finish.
  overlay.addEventListener('click', finish, { once: true });
  if (skip) skip.addEventListener('click', (ev) => { ev.stopPropagation(); finish(); }, { once: true });
  // Try autoplay; if blocked (browsers may require user gesture), fall back to
  // showing video paused — first tap will dismiss anyway, so player isn't stuck.
  try {
    const p = video.play();
    if (p && p.catch) p.catch(() => { /* autoplay blocked, overlay still dismissible */ });
  } catch (_e) { /* swallow */ }
}

// ─── _skipOnboarding (legacy 24410-24436) ─────────────────────────────────
// 2026-04-30 — Polish v0.2 Track G §G.4 step 4: SKIP-onboarding short-circuit.
// One-tap exit from the prologue. Stamps localStorage.onboardingSeen so future
// cold launches bypass intro video AND FTUE entirely; force-advances the FTUE
// beat to 'complete' so any saved-beat resume code paths still treat the
// player as a finished-tutorial returner; tears down the dialog overlay
// (which is what the SKIP button lives on); jumps to the home screen. Idempotent.
//
// TODO(T1.11): dialog overlay DOM refs (#dialogOverlay / #dialogCtaBtn /
// #dialogSkipBtn) + dialogActive / dialogClickLock / _pendingDialogRequest
// teardown will rewire to dialog UI module.
export function _skipOnboarding() {
  try { localStorage.setItem('onboardingSeen', '1'); } catch (_e) { /* swallow */ }
  try { localStorage.setItem('seenIntroVideo', '1'); } catch (_e) { /* swallow */ }
  try {
    if (typeof advanceFtue === 'function' && typeof isFtueComplete === 'function' && !isFtueComplete()) {
      advanceFtue('complete');
    }
  } catch (e) { log.warn('_skipOnboarding: advanceFtue(complete) failed:', e); }
  try {
    const ov = document.getElementById('dialogOverlay');
    if (ov) {
      ov.classList.add('hidden');
      ov.onclick = null;
    }
    const cta = document.getElementById('dialogCtaBtn');
    const skip = document.getElementById('dialogSkipBtn');
    if (cta) { cta.hidden = true; cta.onclick = null; }
    if (skip) { skip.hidden = true; skip.onclick = null; }
    if (typeof dialogActive !== 'undefined') dialogActive = false;
    if (typeof dialogClickLock !== 'undefined') dialogClickLock = false;
  } catch (_e) { /* swallow */ }
  try { if (typeof _pendingDialogRequest !== 'undefined') _pendingDialogRequest = null; } catch (_e) { /* swallow */ }
  try { showScreen('menu'); } catch (e) { log.warn('_skipOnboarding: showScreen(menu) failed:', e); }
}

// ─── routeByFtue (legacy 24438-24474) ─────────────────────────────────────
// Routing entry point — called from init() after all load* functions run.
// 2026-04-27 — Intro video flow. Plays once per install before any FTUE/menu
// routing. localStorage 'seenIntroVideo' persists; subsequent launches skip.
// Tap-to-skip + auto-advance on `ended`. After dismissal, defers to the
// existing FTUE / menu routing pipeline so all downstream behavior is
// untouched. If anything fails (autoplay blocked, missing asset), we silently
// fall through — no dead-end states.
//
// 2026-04-30 — Polish v0.2 Track G §G.4 step 4: onboardingSeen fast-path. If a
// player tapped SKIP at any point during onboarding, they've opted out of the
// prologue forever. Send them straight to the home screen on every future
// cold launch — no intro video, no FTUE state machine, no Chronicle.
export function routeByFtue() {
  try {
    if (localStorage.getItem('onboardingSeen') === '1') {
      try { showScreen('menu'); } catch (e) { log.warn('routeByFtue: showScreen(menu) failed:', e); }
      return;
    }
  } catch (_e) { /* swallow */ }
  // 2026-04-27 — gate first-launch intro video before any routing decisions.
  // Once dismissed (or already seen), we re-enter routeByFtue's body.
  let _routed = false;
  const _doRoute = () => {
    if (_routed) return; _routed = true;
    if (isFtueComplete()) {
      showScreen('menu');
      return;
    }
    if (ftueIs('not_started')) {
      // 2026-04-28 — Player Education Stage 1 AAA+: CHRONICLE Tutorial Dummy
      // is now the actual first FTUE beat (was 'intro' direct → pyredrake_fight).
      // Chronicle teaches mechanics in a no-fail training fight, then chains
      // into the existing prologue (intro_dialog → pyredrake_fight).
      // Existing players past not_started are unaffected — they continue from
      // their saved beat. Only fresh installs see Chronicle.
      advanceFtue('chronicle_fight');
      return;
    }
    try { onFtueBeatChanged(ftueBeat, ftueBeat); } catch (e) { log.warn(e); }
  };
  _maybeShowIntroVideo(_doRoute);
}

// ─── Nav gate (legacy 24476-24481) ────────────────────────────────────────
// Used by goToMenu / goToSelect to block user-initiated menu nav during FTUE.
// The FTUE flow itself uses showScreen('battle') directly, which is not gated
// (showScreen is lower-level).
export function ftueBlockNavIfActive(_attemptedAction) {
  if (!isFtueActive()) return false;
  try { flashText('FINISH THE TUTORIAL FIRST', '#8A88A0'); } catch (_e) { /* swallow */ }
  try { vibrate([40]); } catch (_e) { /* swallow */ }
  return true; // means: caller should abort
}

// ─── Init helper ──────────────────────────────────────────────────────────
// Legacy called `loadFtueFromStorage()` at top-level (line 24484) so the
// beat cursor was hydrated before init() → routeByFtue(). T1.10.9 wire-up
// will call this from src/main.js bootstrap; T1.10.1 only provides the
// function — nothing imports it yet, so the side effect does not run.
export function initFtueState() {
  loadFtueFromStorage();
}
