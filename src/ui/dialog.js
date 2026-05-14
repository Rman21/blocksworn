// 2026-05-11 — TASK-018 (T1.13.4): dialog system extracted from legacy.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - dialog state + clearDialogTimer        line 24712-24724
//   - _pendingDialogRequest + playDialogScript line 24733-24912
//   - replayDialog                            line 24915-24920
//   - DIALOG_LINES + BOSS_DIALOG_MAP +
//     seenDialogs + playDialog +
//     showBossPhaseDialog + maybePlayChapterIntro line 30046-30308
//   - Voidfang DIALOG_LINES additions (P1-P3 a/b + 5-beat defeat +
//     chapter_3_outro + fin_card)            line 30396-30451
//
// SACRED per CLAUDE.md §2.3: every dialog string here is byte-perfect
// from legacy. The Chronicler / Warchief / boss voice lines, the
// Darkest-Dungeon-style poetic terseness, the elision punctuation —
// nothing changes. Pure relocation.
//
// 2026-05-11 — T1.13.4 closes the T1.13.2 boot-warn gap:
//   `onFtueBeatChanged failed: ReferenceError: playDialogScript is not defined`
// The legacy script-scope function moves here and ftue-state.js flips
// from /* global playDialogScript */ to a real ES import.
//
// Cross-module legacy-style consumers (5 module-private state vars used
// by feel-layer plate-defer logic + FTUE teardown) keep working through
// Object.defineProperty(window, ...) get/set bridges — the T1.10.6 /
// T1.10.7 / T1.13.2 sibling pattern.

import { HERO_ROSTER } from '../core/heroes.js';
import { ASSETS } from '../data/assets.js';
import { STIHIYA_COLORS } from '../data/elements.js';
import { log } from '../services/logger.js';
import { mirrorWindowProp } from '../utils/window-mirror.js';

// ─── DIALOG_LINES (legacy 30046-30186 base + 30396-30451 voidfang) ────────
// Every entry copied byte-perfect. Shape:
//   { speaker, speakerColor, portraitKey, text, [onComplete] }
// onComplete fires *after* the registry-level callback chain (see playDialog).
//
// 71 entries declared inline below + 13 voidfang/Ch3-finale entries
// assigned imperatively after initial decl in legacy (one-time `DIALOG_LINES.voidfang_p1_a = ...`
// pattern). Here we merge them into one frozen object — same shape, same
// lookup semantics. `onComplete` callbacks reference `playDialog` lazily
// (via a getter forwarded through the module-level binding).
export const DIALOG_LINES = Object.freeze({
  // ==== Chapter intros/outros (Warchief) ====
  'chapter_1_intro': { speaker: 'THE WARCHIEF', speakerColor: '#FFD53D', portraitKey: 'hero_pirate_sword',
    text: "The clans are broken. The fires of our ancestors dim. I will gather what remains — or die trying." },
  'chapter_1_outro': { speaker: 'THE WARCHIEF', speakerColor: '#FFD53D', portraitKey: 'hero_pirate_sword',
    text: "Five trials. Five fallen. The first clans answer my call. But the shadow grows — and it watches." },
  'chapter_2_intro': { speaker: 'THE WARCHIEF', speakerColor: '#FFD53D', portraitKey: 'hero_pirate_sword',
    text: "The old kingdoms will not yield their heroes easily. If I am to ascend, I must break them — or prove worthy." },
  'chapter_2_outro': { speaker: 'THE WARCHIEF', speakerColor: '#FFD53D', portraitKey: 'hero_pirate_sword',
    text: "The kingdoms bow. Ten banners fly beside mine. But the Voidfang stirs — and I feel it waiting." },
  'chapter_3_intro': { speaker: 'THE WARCHIEF', speakerColor: '#FFD53D', portraitKey: 'hero_pirate_sword',
    text: "The corruption has a name. The Voidfang — ancient, patient, watching since before the first clan fire. This is the final reckoning." },

  // ==== Chapter 1 — intros ====
  'pyredrake_intro':   { speaker: 'PYREDRAKE',        speakerColor: '#E85D4A', portraitKey: 'Boss_1', text: "Another warchief. Another pyre. Your bones will feed my flames." },
  'abyssal_intro':     { speaker: 'ABYSSAL TYRANT',   speakerColor: '#3B8BD4', portraitKey: 'Boss_2', text: "You reek of surface-rot. The tide takes everything eventually. Why struggle?" },
  'grovewarden_intro': { speaker: 'GROVEWARDEN',      speakerColor: '#5DCA79', portraitKey: 'Boss_3', text: "I was ancient when your first ancestor still swung a club. This grove is mine." },
  'phoenix_intro':     { speaker: 'SOLAR PHOENIX',    speakerColor: '#E8B84A', portraitKey: 'Boss_4', text: "Burn. Rise. Burn again. I have no end. You do." },
  'lich_intro':        { speaker: 'CRYPT LICH',       speakerColor: '#9B59D6', portraitKey: 'Boss_5', text: "You wear a crown of dust and ash. I am older than your crown. I am older than your dust." },
  // ==== Chapter 1 — phases ====
  'pyredrake_p2':      { speaker: 'PYREDRAKE',        speakerColor: '#E85D4A', portraitKey: 'Boss_1', text: "You burn brighter than I thought. Good. Fuel for the pyre." },
  'pyredrake_p3':      { speaker: 'PYREDRAKE',        speakerColor: '#E85D4A', portraitKey: 'Boss_1', text: "ENOUGH. Let the sky itself burn!" },
  'abyssal_p2':        { speaker: 'ABYSSAL TYRANT',   speakerColor: '#3B8BD4', portraitKey: 'Boss_2', text: "The tide turns. I summon the drowning depth." },
  'grovewarden_p2':    { speaker: 'GROVEWARDEN',      speakerColor: '#5DCA79', portraitKey: 'Boss_3', text: "Roots deeper than memory. I will not be moved." },
  'grovewarden_p3':    { speaker: 'GROVEWARDEN',      speakerColor: '#5DCA79', portraitKey: 'Boss_3', text: "The grove weeps. I drink its sorrow." },
  'phoenix_p2':        { speaker: 'SOLAR PHOENIX',    speakerColor: '#E8B84A', portraitKey: 'Boss_4', text: "Ash. Ember. Rebirth. The cycle quickens." },
  'lich_p2':           { speaker: 'CRYPT LICH',       speakerColor: '#9B59D6', portraitKey: 'Boss_5', text: "My bones do not tire. Yours already do." },
  'lich_p3':           { speaker: 'CRYPT LICH',       speakerColor: '#9B59D6', portraitKey: 'Boss_5', text: "The crypt hungers. It will have you." },
  // ==== Chapter 1 — defeats ====
  'pyredrake_defeat':   { speaker: 'PYREDRAKE',       speakerColor: '#E85D4A', portraitKey: 'Boss_1', text: "A worthy fire… extinguished. The pyre… is yours now." },
  'abyssal_defeat':     { speaker: 'ABYSSAL TYRANT',  speakerColor: '#3B8BD4', portraitKey: 'Boss_2', text: "The depths… recede. Take the tide, warchief." },
  'grovewarden_defeat': { speaker: 'GROVEWARDEN',     speakerColor: '#5DCA79', portraitKey: 'Boss_3', text: "The grove knew a stronger keeper. Tend it well." },
  'phoenix_defeat':     { speaker: 'SOLAR PHOENIX',   speakerColor: '#E8B84A', portraitKey: 'Boss_4', text: "My last ember… yours to carry." },
  'lich_defeat':        { speaker: 'CRYPT LICH',      speakerColor: '#9B59D6', portraitKey: 'Boss_5', text: "Dust returns to dust. My crown… yours." },

  // ==== Chapter 3 (VEIL OF FORGOTTEN GODS) — intros ====
  // Tone: mystical, melancholic, wistful. Bosses are not evil — they are EMPTY.
  // Voice lines drawn verbatim from BLOCKSWORN_CHAPTERS_3_5.md §2.2-2.6.
  'twilight_intro':    { speaker: 'TWILIGHT VESSEL',  speakerColor: '#A88AC8', portraitKey: 'Boss_11', text: "You bring memory. I had... forgotten... what memory feels like." },
  'storm_intro':       { speaker: 'STORMSHEPHERD',    speakerColor: '#9CC8DE', portraitKey: 'Boss_12', text: "You disturb my flock. The storms remember you now." },
  'priestess_intro':   { speaker: 'VOIDPRIESTESS',    speakerColor: '#C0A6DF', portraitKey: 'Boss_13', text: "I have heard your prayers. I have... judged them. Mostly... I judge them weak." },
  'root_intro':        { speaker: 'ROOT-OF-NOTHING',  speakerColor: '#6E7A6A', portraitKey: 'Boss_14', text: "...rooted... ...quiet... ...rooted... ...quiet..." },
  'archival_intro':    { speaker: 'ARCHIVAL ETERNAL', speakerColor: '#E8D88A', portraitKey: 'Boss_15', text: "All who climb here... become entries in my catalogue. Even your defeat is... categorized." },
  // ==== Chapter 3 — phases ====
  'twilight_p2':       { speaker: 'TWILIGHT VESSEL',  speakerColor: '#A88AC8', portraitKey: 'Boss_11', text: "Now I drink yours. Will you become forgotten too?" },
  'twilight_p3':       { speaker: 'TWILIGHT VESSEL',  speakerColor: '#A88AC8', portraitKey: 'Boss_11', text: "Light and dark. Memory and forgetting. I am... AM I?" },
  'storm_p2':          { speaker: 'STORMSHEPHERD',    speakerColor: '#9CC8DE', portraitKey: 'Boss_12', text: "They asked to be unleashed. I kept them safe. Now... I let them go." },
  'priestess_p2':      { speaker: 'VOIDPRIESTESS',    speakerColor: '#C0A6DF', portraitKey: 'Boss_13', text: "Tell me, mortal — what would you confess if I were not listening? Tell me anyway. I am ALWAYS listening." },
  'root_p2':           { speaker: 'ROOT-OF-NOTHING',  speakerColor: '#6E7A6A', portraitKey: 'Boss_14', text: "Light forgot me. I... forgot... light. We are even now." },
  'archival_p2':       { speaker: 'ARCHIVAL ETERNAL', speakerColor: '#E8D88A', portraitKey: 'Boss_15', text: "You resist? You will be filed under: 'AMUSING DELUSIONS.'" },
  // ==== Chapter 3 — defeats ====
  'twilight_defeat':   { speaker: 'TWILIGHT VESSEL',  speakerColor: '#A88AC8', portraitKey: 'Boss_11', text: "Now I... remember... my... own... name..." },
  'storm_defeat':      { speaker: 'STORMSHEPHERD',    speakerColor: '#9CC8DE', portraitKey: 'Boss_12', text: "...let them be... free..." },
  'priestess_defeat':  { speaker: 'VOIDPRIESTESS',    speakerColor: '#C0A6DF', portraitKey: 'Boss_13', text: "...even... the silent... have voices..." },
  'root_defeat':       { speaker: 'ROOT-OF-NOTHING',  speakerColor: '#6E7A6A', portraitKey: 'Boss_14', text: "...but I... remember... the warmth..." },
  'archival_defeat':   { speaker: 'ARCHIVAL ETERNAL', speakerColor: '#E8D88A', portraitKey: 'Boss_15', text: "Mark this entry: 'A page that... refused... to be read...'" },
  // Chapter 3 outro — Warchief reflection. Legacy declares this twice:
  //   line 30112 (Block 6.2 initial): "The veil tears. Above us — the cosmic court watches…"
  //   line 30444 (Block 6.3 overwrite): "The shadow retreats. Fifty heroes stand…"
  // Sequential execution makes the Block 6.3 text the live value at lookup time.
  // Captured as a single entry here byte-perfect against the Block 6.3 final.
  'chapter_3_outro': { speaker: 'THE WARCHIEF', speakerColor: '#FFD53D', portraitKey: 'hero_pirate_sword',
    text: "The shadow retreats. Fifty heroes stand where none stood before. The clans are whole. For now, there is peace. For now, there is enough." },

  // ==== 2026-05-01 — SPRINT 3A · Chapter 4 (COURT OF THE FALLEN HEAVENS) dialog pack ====
  // 16 entries: chapter_4_intro + 5 boss intros + 5 boss phase lines + 5 boss defeats + chapter_4_outro.
  // Per BLOCKSWORN_CHAPTERS_3_5.md §3.2-3.6 + SPRINT_3A spec §7.1.
  'chapter_4_intro': { speaker: 'THE WARCHIEF', speakerColor: '#FFD53D', portraitKey: 'hero_pirate_sword',
    text: "The veil tore. The Forgotten are gone. Above us, marble halls echo with judgment. The Court remains. They will measure us." },

  // Per-boss intros (Bosses 16-20)
  'prosecutor_intro':       { speaker: 'THE PROSECUTOR',     speakerColor: '#8E5DCC', portraitKey: 'Boss_16', text: "Mortal. So young. So... unprepared. The court calls you to the dock. State your charge." },
  'justice_blind_intro':    { speaker: 'JUSTICE BLIND',      speakerColor: '#F0E8B8', portraitKey: 'Boss_17', text: "Mortal weight... measured. Boss weight... measured. Find the balance, or fall." },
  'sun_crown_regent_intro': { speaker: 'SUN-CROWN REGENT',   speakerColor: '#FFAA28', portraitKey: 'Boss_18', text: "You stand before the Last King. You shall be... AUDIENCED." },
  'eclipse_walker_intro':   { speaker: 'ECLIPSE-WALKER',     speakerColor: '#A8C8E8', portraitKey: 'Boss_19', text: "Twin suns watch. They have not spoken to each other since they were young. Will you make them speak?" },
  'fallen_highest_intro':   { speaker: 'THE FALLEN HIGHEST', speakerColor: '#E8C8FF', portraitKey: 'Boss_20', text: "None has been judged. Few have RISEN. None has APPROACHED. You will be the first... or the last." },

  // Mid-fight phase lines
  'prosecutor_phase':       { speaker: 'THE PROSECUTOR',     speakerColor: '#8E5DCC', portraitKey: 'Boss_16', text: "What have I... been doing? Was the court ever just? It does not matter. The verdict stands." },
  'justice_blind_phase':    { speaker: 'JUSTICE BLIND',      speakerColor: '#F0E8B8', portraitKey: 'Boss_17', text: "You tip too far. You will be CORRECTED." },
  'sun_crown_regent_phase': { speaker: 'SUN-CROWN REGENT',   speakerColor: '#FFAA28', portraitKey: 'Boss_18', text: "My court holds. As long as ONE of them stands, I... ENDURE." },
  'eclipse_walker_phase':   { speaker: 'ECLIPSE-WALKER',     speakerColor: '#A8C8E8', portraitKey: 'Boss_19', text: "One side dies. The other... grieves. Yet still I balance." },
  'fallen_highest_phase':   { speaker: 'THE FALLEN HIGHEST', speakerColor: '#E8C8FF', portraitKey: 'Boss_20', text: "The throne... is NOT empty. It WAITS." },

  // Defeats
  'prosecutor_defeat':       { speaker: 'THE PROSECUTOR',     speakerColor: '#8E5DCC', portraitKey: 'Boss_16', text: "By all that was, all that is, all that will not be... judged... and... acquitted... by mortal hands..." },
  'justice_blind_defeat':    { speaker: 'JUSTICE BLIND',      speakerColor: '#F0E8B8', portraitKey: 'Boss_17', text: "...the scales... finally... still..." },
  'sun_crown_regent_defeat': { speaker: 'SUN-CROWN REGENT',   speakerColor: '#FFAA28', portraitKey: 'Boss_18', text: "The crown... falls... to none... fitting." },
  'eclipse_walker_defeat':   { speaker: 'ECLIPSE-WALKER',     speakerColor: '#A8C8E8', portraitKey: 'Boss_19', text: "The suns... can speak now... in silence..." },
  'fallen_highest_defeat':   { speaker: 'THE FALLEN HIGHEST', speakerColor: '#E8C8FF', portraitKey: 'Boss_20', text: "...the court... is silent... the throne... is empty... finally... empty..." },

  // Chapter 4 outro — Warchief reflection after Fallen Highest defeated
  'chapter_4_outro':   { speaker: 'THE WARCHIEF',     speakerColor: '#FFD53D', portraitKey: 'hero_pirate_sword',
    text: "The throne shatters. The court collapses. Reality breathes for the first time in eons. But there is more. Beneath all of this — the FIRST FLAME stirs." },

  // ==== 2026-04-27 — Chapter 1 Tutorial dialogs ====
  // Narrator-poet voice (consistent with NARRATOR_LINES style). Each fires
  // ONCE per install (gated by seenDialogs.has). Suppressed during FTUE so
  // FTUE's own scripted onboarding never collides. Routed through playDialog,
  // which inherits the dialog defer-queue (no plate/banner overlap).
  'tut_boss_attack_intro':  { speaker: 'THE CHRONICLER', speakerColor: '#FF8C00', portraitKey: 'hero_chronicler', text: "The boss attacks every few turns. When the countdown reaches zero, two threats activate: VOID cells scatter across your board — and a SIGNATURE STRIKE deals direct damage. Watch the telegraph. Position your squad to absorb the blow." },
  'tut_void_cells':         { speaker: 'THE CHRONICLER', speakerColor: '#FFD53D', portraitKey: 'hero_chronicler', text: "Void cells cannot be cleared like elements. They block placement. Plan around them — leave room for your next pieces." },
  'tut_mitigation_intro':   { speaker: 'THE CHRONICLER', speakerColor: '#5DCA79', portraitKey: 'hero_chronicler', text: "Every hit is reduced by your squad's MITIGATION. Tank heroes give the most. Watch the shield icon — that percent of every damage hit is absorbed before reaching your HP." },
  'tut_deadzone_intro':     { speaker: 'THE CHRONICLER', speakerColor: '#E85D4A', portraitKey: 'hero_chronicler', text: "When no piece can fit a board corner, that cell becomes a DEAD ZONE. Each new dead zone costs 5 HP — reduced by your mitigation. Keep your edges clean." },
  'tut_void_tick_intro':    { speaker: 'THE CHRONICLER', speakerColor: '#9B59E8', portraitKey: 'hero_chronicler', text: "Void cells aren't just dead space. Each one ticks small damage at end of turn. Clear them, or pay the toll. Tempo wins this game." },
  'tut_signature_intro':    { speaker: 'THE CHRONICLER', speakerColor: '#FF8C00', portraitKey: 'hero_chronicler', text: "When the boss countdown hits zero, it strikes — a SIGNATURE ATTACK. Heavy damage. Telegraphed in advance. This boss hits for 12 HP. Bigger bosses hit harder." },
  'tut_grid_saturation_intro': { speaker: 'THE CHRONICLER', speakerColor: '#FFD700', portraitKey: 'hero_chronicler', text: "If your board fills past 75%, you take pressure damage every turn. Don't hoard cells. Clear lines. Keep room to breathe." },
  'tut_pressure_intro':       { speaker: 'THE CHRONICLER', speakerColor: '#FFD700', portraitKey: 'hero_chronicler', text: "Watch the boss's PRESSURE meter — it fills with every line clear, INFERNO, DETONATE, and ULT. Bigger combos = more pressure. Fill it to break the boss." },
  'tut_stagger_intro':        { speaker: 'THE CHRONICLER', speakerColor: '#FFD700', portraitKey: 'hero_chronicler', text: "STAGGER! For 4 turns the boss is wide open. Your damage cap doubles. Strike with everything — INFERNOs, ULTs, your biggest combos. This is your power moment." },
  'tut_recovery_intro':       { speaker: 'THE CHRONICLER', speakerColor: '#FF4500', portraitKey: 'hero_chronicler', text: "The boss is recovering — and angry. A REVENGE STRIKE is coming in 2 turns. Big damage, telegraphed. Brace your shields, position your tank, or accept the hit." },
  'tut_overflow_intro':       { speaker: 'THE CHRONICLER', speakerColor: '#FFD700', portraitKey: 'hero_chronicler', text: "Your hit overshot — but nothing's lost. Overkill damage converts: 40% to ULT charge, 30% to essence, plus shields. Massive combos always pay off." },
  'tut_phoenix_revive':     { speaker: 'THE CHRONICLER', speakerColor: '#E8B84A', portraitKey: 'hero_chronicler', text: "The Phoenix burns twice. Even ash is patient. Strike again — only the second death is final." },
  'tut_squad_grew_to_5':    { speaker: 'THE CHRONICLER', speakerColor: '#FFD53D', portraitKey: 'hero_chronicler', text: "A fifth slot opens. Your squad grows. Before you face the Lich, fill the empty seat — five hearts beat stronger than four." },
  'tut_pre_lich_check':     { speaker: 'THE CHRONICLER', speakerColor: '#9B59D6', portraitKey: 'hero_chronicler', text: "An empty slot in your squad. The Lich does not forgive incomplete cohorts. Open the SQUAD screen and add your fifth hero before this fight." },

  // ==== Voidfang dialog entries (legacy 30396-30451, declared imperatively after DIALOG_LINES init) ====
  // Phase dialogs are 2-sided (Voidfang + Warchief response). The Warchief's b-beat
  // auto-chains via registry-level onComplete (passed through playDialog combinedComplete wrapper).
  'voidfang_p1_a': {
    speaker: 'VOIDFANG', speakerColor: '#BB60FF', portraitKey: 'Boss_15',
    text: "First blood drawn. You impress me, warchief. Do you know how long I have waited?",
    onComplete: () => setTimeout(() => playDialog('voidfang_p1_b'), 300),
  },
  'voidfang_p1_b': {
    speaker: 'THE WARCHIEF', speakerColor: '#FFD53D', portraitKey: 'hero_pirate_sword',
    text: "Long enough to forget why you started.",
  },
  'voidfang_p2_a': {
    speaker: 'VOIDFANG', speakerColor: '#BB60FF', portraitKey: 'Boss_15',
    text: "Half of me, gone. And still you don't see — I am what remains WHEN every light has failed.",
    onComplete: () => setTimeout(() => playDialog('voidfang_p2_b'), 300),
  },
  'voidfang_p2_b': {
    speaker: 'THE WARCHIEF', speakerColor: '#FFD53D', portraitKey: 'hero_pirate_sword',
    text: "Then I will be the light that does not fail.",
  },
  'voidfang_p3_a': {
    speaker: 'VOIDFANG', speakerColor: '#BB60FF', portraitKey: 'Boss_15',
    text: "Fine words. Hollow things. Let's see if your clan can withstand the SHROUD.",
    onComplete: () => setTimeout(() => playDialog('voidfang_p3_b'), 300),
  },
  'voidfang_p3_b': {
    speaker: 'THE WARCHIEF', speakerColor: '#FFD53D', portraitKey: 'hero_pirate_sword',
    text: "Ten banners. Fifty hearts. No shroud is deep enough.",
  },
  // 5-beat defeat sequence (chained from onBossDefeated, not via registry onComplete
  // so callers can gate on floor for Dominion-only outro+fin extension)
  'voidfang_defeat_a': {
    speaker: 'VOIDFANG', speakerColor: '#BB60FF', portraitKey: 'Boss_15', text: "…impossible…",
  },
  'voidfang_defeat_b': {
    speaker: 'VOIDFANG', speakerColor: '#BB60FF', portraitKey: 'Boss_15',
    text: "You cannot destroy what IS the ending…",
  },
  'voidfang_defeat_c': {
    speaker: 'THE WARCHIEF', speakerColor: '#FFD53D', portraitKey: 'hero_pirate_sword',
    text: "I don't destroy you. I outlast you.",
  },
  'voidfang_defeat_d': {
    speaker: 'VOIDFANG', speakerColor: '#BB60FF', portraitKey: 'Boss_15',
    text: "…then… for now… you have won. But I am older than any victory…",
  },
  'voidfang_defeat_e': {
    speaker: 'VOIDFANG', speakerColor: '#BB60FF', portraitKey: 'Boss_15', text: "…I will wait…",
  },
  // FIN card (F3 Dominion chain only)
  'fin_card': {
    speaker: '✦  FIN  ✦', speakerColor: '#FFD53D', portraitKey: null,
    text: "Thank you for playing. Endgame content awaits.",
  },
});

// ─── BOSS_DIALOG_MAP (legacy 30189-30210) ─────────────────────────────────
// Boss canonical name → dialog ID prefix. Matches CHAPTERS[n].bosses[i].name exactly.
export const BOSS_DIALOG_MAP = Object.freeze({
  'PYREDRAKE':         'pyredrake',
  'ABYSSAL TYRANT':    'abyssal',
  'GROVEWARDEN':       'grovewarden',
  'SOLAR PHOENIX':     'phoenix',
  'CRYPT LICH':        'lich',
  // 2026-04-27 — Chapter 3 (VEIL OF FORGOTTEN GODS) — boss → dialog prefix.
  'TWILIGHT VESSEL':   'twilight',
  'STORMSHEPHERD':     'storm',
  'VOIDPRIESTESS':     'priestess',
  'ROOT-OF-NOTHING':   'root',
  'ARCHIVAL ETERNAL':  'archival',
  // VOIDFANG kept — it's an active Tower boss (id `voidfang`).
  'VOIDFANG':          'voidfang',
});

export function getBossDialogPrefix(bossName) {
  return BOSS_DIALOG_MAP[bossName] || null;
}

// ─── Dialog player state (legacy 24713-24717) ─────────────────────────────
// Module-private; exposed via Object.defineProperty bridge for legacy-style
// /* global */ consumers in feel-layer plate-defer logic + FTUE teardown.
let _dialogActive     = false;
let _dialogTimer      = null;     // typewriter interval handle
let _dialogClickLock  = false;    // 200ms debounce against double-tap
const DIALOG_TYPE_MS = 30;        // ms per character — matches spec
const DIALOG_CLICK_DEBOUNCE_MS = 200;

// TASK #2.2b: single-slot pending queue. Previously, requests during an active dialog
// were dropped along with their onComplete callback — that broke FTUE state-machine
// progression when overlap occurred (e.g. boss-phase dialog colliding with FTUE beat).
let _pendingDialogRequest = null;

// 2026-04-27 — Dialog defer queue. When a dialog overlay is on screen, ALL
// plate-style on-screen text (flashText / flashHeroTrigger / narrator / toast)
// would otherwise stack on top of the dialog box and obscure both. Instead we
// queue plate calls that arrive during a dialog and flush them after the
// dialog's onComplete chain runs.
//
// NB: the queue itself (`_dialogDeferredQueue`) is read by the legacy feel-layer
// plate-defer logic via the window bridge below; ftue-state.js's onbreath
// teardown clears `.length = 0` through it. The accompanying helpers
// (`_isDialogActive`, `_deferDuringDialog`, `_flushDeferredQueueAfterDialog`)
// remain in legacy for T1.13.4 — they cross-reference flashText / flashHeroTrigger
// which still live in legacy. The dialog module's `next()` resolver calls
// `_flushDeferredQueueAfterDialog` defensively via `typeof === 'function'`.
let _dialogDeferredQueue = [];

// ─── Seen-dialog tracking (legacy 30215-30237) ────────────────────────────
let _seenDialogs = new Set();
const SEEN_DIALOGS_KEY = 'blocksworn_seen_dialogs';

export function loadSeenDialogs() {
  try {
    const raw = localStorage.getItem(SEEN_DIALOGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) _seenDialogs = new Set(parsed);
    }
  } catch (e) { log.warn('loadSeenDialogs:', e); _seenDialogs = new Set(); }
}

export function saveSeenDialogs() {
  try { localStorage.setItem(SEEN_DIALOGS_KEY, JSON.stringify([..._seenDialogs])); } catch (_e) { /* swallow */ }
}

export function markDialogSeen(id) {
  if (!_seenDialogs.has(id)) {
    _seenDialogs.add(id);
    saveSeenDialogs();
  }
}

// Eager load at module init — matches legacy `loadSeenDialogs()` call at line 30238
// (script-scope, runs at HTML parse time). Idempotent for re-imports.
loadSeenDialogs();

// ─── Window bridge for module-private state ───────────────────────────────
// Per the T1.10.6/T1.10.7/T1.13.2 sibling pattern: each module-private `let`
// gets a get/set accessor on `window` so cross-module legacy-style
// /* global */ consumers (feel-layer plate-defer logic, FTUE teardown,
// stagger-loop seenDialogs check, etc.) keep resolving to the same live value.
if (typeof window !== 'undefined') {
  mirrorWindowProp('dialogActive', () => _dialogActive, (v) => { _dialogActive = v; });
  mirrorWindowProp('dialogClickLock', () => _dialogClickLock, (v) => { _dialogClickLock = v; });
  mirrorWindowProp('_pendingDialogRequest', () => _pendingDialogRequest, (v) => { _pendingDialogRequest = v; });
  mirrorWindowProp('_dialogDeferredQueue', () => _dialogDeferredQueue, (v) => { _dialogDeferredQueue = v; });
  mirrorWindowProp('seenDialogs', () => _seenDialogs, (v) => { _seenDialogs = v; });
  // Public registries also exposed (legacy 30295: window.DIALOG_LINES = DIALOG_LINES)
  if (typeof window.DIALOG_LINES === 'undefined') window.DIALOG_LINES = DIALOG_LINES;
}

// ─── clearDialogTimer (legacy 24719-24724) ────────────────────────────────
function clearDialogTimer() {
  if (_dialogTimer !== null) {
    clearInterval(_dialogTimer);
    _dialogTimer = null;
  }
}

// ─── playDialogScript (legacy 24734-24912) ────────────────────────────────
// Play a sequence of {speakerId, text} lines. onComplete fires after the last line.
// If a dialog is already active, new calls are ignored (singleton).
// TASK #2.2b: single-slot pending queue. Previously, requests during an active dialog
// were dropped along with their onComplete callback — that broke FTUE state-machine
// progression when overlap occurred (e.g. boss-phase dialog colliding with FTUE beat).
// Queue one request; drain via microtask after the active dialog completes.
// Architectural note: a real FSM should manage this long-term — see PHASE_2_PIRATES_AUDIT.md.
export function playDialogScript(lines, onComplete) {
  if (_dialogActive) {
    if (_pendingDialogRequest) {
      log.debug('playDialogScript: queue overflow — dropping prior queued request');
    } else {
      log.debug('playDialogScript: dialog active — queuing request');
    }
    _pendingDialogRequest = { lines, onComplete };
    return;
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    if (onComplete) { try { onComplete(); } catch (e) { log.warn(e); } }
    return;
  }
  const overlay = document.getElementById('dialogOverlay');
  if (!overlay) { log.warn('dialogOverlay not in DOM'); if (onComplete) onComplete(); return; }

  _dialogActive = true;
  overlay.classList.remove('hidden');
  let idx = 0;

  function showLine(line) {
    // V3.0 Phase 6 Block 6.2: dual-mode speaker resolution.
    // Mode A (existing, Phase 1 FTUE): {speakerId: 'hero_id', text} → HERO_ROSTER lookup
    // Mode B (new, boss dialogs):       {speaker: 'NAME', speakerColor: '#RGB', portraitKey: 'asset', text}
    // Mode B wins if `speaker` is present. Mode A is the fallback for hero-routed lines.
    const hero = line.speakerId ? HERO_ROSTER.find(h => h.id === line.speakerId) : null;
    const speakerEl = document.getElementById('dialogSpeaker');
    const portraitEl = document.getElementById('dialogPortrait');
    const textEl = document.getElementById('dialogText');
    const explicitSpeaker = line.speaker;
    if (speakerEl) {
      speakerEl.textContent = explicitSpeaker || (hero ? hero.name : '???');
    }
    if (portraitEl) {
      // Defensive: fallback to transparent pixel if asset missing (trap 3)
      let src = '';
      if (hero && ASSETS[hero.img]) {
        src = ASSETS[hero.img];
      } else if (line.portraitKey && ASSETS[line.portraitKey]) {
        src = ASSETS[line.portraitKey];
      }
      portraitEl.src = src;
      portraitEl.alt = explicitSpeaker || (hero ? hero.name : '');
      // Glow color: explicit speakerColor > hero's stihiya color > unchanged
      const glowColor = line.speakerColor
        || (hero && STIHIYA_COLORS[hero.stihiya])
        || null;
      if (glowColor) overlay.style.setProperty('--dialog-glow', glowColor);
    }
    // 2026-04-30 — Polish v0.2 Track G: per-line CTA + SKIP affordances.
    // Lines may opt in via `ctaLabel` (persistent button replaces the
    // tap-anywhere advance) and `showSkip` (top-right SKIP that fast-paths
    // out of onboarding via _skipOnboarding). Both default off — existing
    // FTUE/post-victory dialogs render unchanged.
    const ctaBtn = document.getElementById('dialogCtaBtn');
    const skipBtn = document.getElementById('dialogSkipBtn');
    const tapHint = document.getElementById('dialogTapHint');
    if (ctaBtn) {
      if (line.ctaLabel) {
        ctaBtn.textContent = line.ctaLabel;
        ctaBtn.hidden = false;
        if (tapHint) tapHint.hidden = true;
      } else {
        ctaBtn.hidden = true;
        if (tapHint) tapHint.hidden = false;
      }
    }
    if (skipBtn) {
      skipBtn.hidden = !line.showSkip;
    }
    if (!textEl) return;
    textEl.textContent = '';
    let i = 0;
    clearDialogTimer();
    _dialogTimer = setInterval(() => {
      if (!line.text || i >= line.text.length) { clearDialogTimer(); return; }
      textEl.textContent += line.text.charAt(i);
      i++;
      if (i >= line.text.length) clearDialogTimer();
    }, DIALOG_TYPE_MS);
  }

  function next() {
    if (idx >= lines.length) {
      // Sequence done — fade out overlay, call onComplete
      overlay.classList.add('hidden');
      clearDialogTimer();
      overlay.onclick = null;
      // 2026-04-30 — clear Track G button hooks so a re-shown dialog with
      // no ctaLabel/showSkip starts clean.
      try {
        const _cta = document.getElementById('dialogCtaBtn');
        const _skip = document.getElementById('dialogSkipBtn');
        const _hint = document.getElementById('dialogTapHint');
        if (_cta) { _cta.hidden = true; _cta.onclick = null; }
        if (_skip) { _skip.hidden = true; _skip.onclick = null; }
        if (_hint) _hint.hidden = false;
      } catch (_e) { /* swallow */ }
      _dialogActive = false;
      _dialogClickLock = false;
      if (onComplete) { try { onComplete(); } catch (e) { log.warn('dialog onComplete failed:', e); } }
      // 2026-04-27 — drain plate-style notifications that arrived while the
      // dialog was on screen (flashText / narrator / toast / race-passive
      // banners). They were queued in _dialogDeferredQueue and will fire
      // sequentially with light stagger to avoid stomping each other.
      try {
        if (typeof window !== 'undefined' && typeof window._flushDeferredQueueAfterDialog === 'function') {
          window._flushDeferredQueueAfterDialog();
        }
      } catch (_e) { /* swallow */ }
      // TASK #2.2b: drain queued dialog request, if any. Microtask so the current
      // call stack unwinds before the next playDialogScript invocation.
      if (_pendingDialogRequest) {
        const { lines: _ql, onComplete: _qc } = _pendingDialogRequest;
        _pendingDialogRequest = null;
        Promise.resolve().then(() => playDialogScript(_ql, _qc));
      }
      return;
    }
    showLine(lines[idx++]);
  }

  overlay.onclick = () => {
    if (_dialogClickLock) return;
    // 2026-04-30 — Polish v0.2 Track G §G.4 step 2: when the current line has
    // a persistent CTA button, the overlay's tap-anywhere advance is
    // disabled so the BIG BEGIN button is the only thing that progresses
    // the dialog. Players still get typewriter-skip via overlay tap if the
    // line is mid-typing; once the typewriter completes, only the CTA
    // advances.
    const current = lines[idx - 1];
    const textEl = document.getElementById('dialogText');
    const midType = current && textEl && textEl.textContent.length < current.text.length;
    if (current && current.ctaLabel && !midType) return;
    _dialogClickLock = true;
    setTimeout(() => { _dialogClickLock = false; }, DIALOG_CLICK_DEBOUNCE_MS);
    if (midType) {
      clearDialogTimer();
      textEl.textContent = current.text;
      return;
    }
    next();
  };

  // 2026-04-30 — wire BEGIN button advance + SKIP fast-path. Per-line
  // visibility is set in showLine; here we just bind the click handlers
  // once for the lifetime of this script run. stopPropagation prevents
  // the overlay's click handler from also firing.
  try {
    const ctaBtn = document.getElementById('dialogCtaBtn');
    if (ctaBtn) {
      ctaBtn.onclick = (ev) => {
        ev.stopPropagation();
        if (_dialogClickLock) return;
        _dialogClickLock = true;
        setTimeout(() => { _dialogClickLock = false; }, DIALOG_CLICK_DEBOUNCE_MS);
        // Mid-typewriter? Flush text instantly first; second tap advances.
        const current = lines[idx - 1];
        const textEl = document.getElementById('dialogText');
        if (current && textEl && textEl.textContent.length < current.text.length) {
          clearDialogTimer();
          textEl.textContent = current.text;
          return;
        }
        next();
      };
    }
    const skipBtn = document.getElementById('dialogSkipBtn');
    if (skipBtn) {
      skipBtn.onclick = (ev) => {
        ev.stopPropagation();
        try {
          // _skipOnboarding lives in src/core/ftue-state.js; legacy globals
          // bridge exposes it on window when ftue-state imports here.
          if (typeof window !== 'undefined' && typeof window._skipOnboarding === 'function') {
            window._skipOnboarding();
          }
        } catch (e) { log.warn('SKIP handler failed:', e); }
      };
    }
  } catch (e) { log.warn('Track G button wiring failed:', e); }

  next();
}

// ─── replayDialog (legacy 24915-24920) ────────────────────────────────────
// Dev helper — replay a named script without touching ftueBeat state.
// FTUE_SCRIPTS lives in src/data/ftue-scripts.js but legacy callers reference
// it via `window.FTUE_SCRIPTS` after eager exposure; same here.
export function replayDialog(scriptName) {
  const ftueScripts = (typeof window !== 'undefined' && window.FTUE_SCRIPTS) || null;
  const script = ftueScripts ? ftueScripts[scriptName] : null;
  if (!script) { log.warn('replayDialog: unknown script', scriptName, '· available:', ftueScripts ? Object.keys(ftueScripts) : '(no FTUE_SCRIPTS)'); return; }
  if (_dialogActive) { log.warn('replayDialog: dialog already active'); return; }
  playDialogScript(script, () => log.debug(`[FTUE] replay '${scriptName}' done`));
}

// ─── playDialog (legacy 30243-30274) ──────────────────────────────────────
// Wraps Phase 1's playDialogScript with a single-line convenience API.
// DIALOG_LINES[id] has shape {speaker, speakerColor, portraitKey, text} + optional onComplete.
export function playDialog(dialogId, onCompleteCallback) {
  // FTUE takes over dialog system — suppress Phase 6 dialogs during tutorial.
  // isFtueActive is owned by src/core/ftue-state.js and exposed on window via the
  // bridge there; check via window to avoid a hard import cycle.
  try {
    if (typeof window !== 'undefined' && typeof window.isFtueActive === 'function' && window.isFtueActive()) {
      if (onCompleteCallback) try { onCompleteCallback(); } catch (_e) { /* swallow */ }
      return;
    }
  } catch (_e) { /* swallow */ }
  const line = DIALOG_LINES[dialogId];
  if (!line) {
    log.warn('Unknown dialog:', dialogId);
    if (onCompleteCallback) try { onCompleteCallback(); } catch (_e) { /* swallow */ }
    return;
  }
  markDialogSeen(dialogId);
  // Compose the onComplete chain: registry-level onComplete (for 6.3 Voidfang chains)
  // fires first, then the caller's onComplete.
  const combinedComplete = () => {
    if (line.onComplete) { try { line.onComplete(); } catch (e) { log.warn('dialog onComplete (registry):', e); } }
    if (onCompleteCallback) { try { onCompleteCallback(); } catch (e) { log.warn('dialog onComplete (caller):', e); } }
  };
  const scriptLine = {
    speaker: line.speaker,
    speakerColor: line.speakerColor,
    portraitKey: line.portraitKey,
    text: line.text,
  };
  playDialogScript([scriptLine], combinedComplete);
}

// ─── showBossPhaseDialog (legacy 30278-30281) ─────────────────────────────
// Block 6.1's stub is replaced here with real dispatch. Defined after playDialog
// so forward reference works at call time (effect handlers resolve at runtime).
export function showBossPhaseDialog(dialogId) {
  if (!dialogId) return;
  playDialog(dialogId);
}

// ─── maybePlayChapterIntro (legacy 30285-30291) ───────────────────────────
// Called from launchFloor (Phase 2) entry — plays chapter intro on first-ever Ch boss entry.
export function maybePlayChapterIntro(chapter) {
  try {
    if (typeof window !== 'undefined' && typeof window.isFtueActive === 'function' && window.isFtueActive()) return;
  } catch (_e) { /* swallow */ }
  const id = `chapter_${chapter}_intro`;
  if (!_seenDialogs.has(id) && DIALOG_LINES[id]) {
    playDialog(id);
  }
}

// ─── Console helpers (legacy 30294-30308) ─────────────────────────────────
if (typeof window !== 'undefined') {
  if (typeof window.playDialog === 'undefined') window.playDialog = playDialog;
  if (typeof window.playDialogScript === 'undefined') window.playDialogScript = playDialogScript;
  if (typeof window.showBossPhaseDialog === 'undefined') window.showBossPhaseDialog = showBossPhaseDialog;
  if (typeof window.maybePlayChapterIntro === 'undefined') window.maybePlayChapterIntro = maybePlayChapterIntro;
  if (typeof window.replayDialog === 'undefined') window.replayDialog = replayDialog;
  if (typeof window.markDialogSeen === 'undefined') window.markDialogSeen = markDialogSeen;
  if (typeof window.previewDialog === 'undefined') window.previewDialog = playDialog;
  window.markAllDialogsSeen = function () {
    Object.keys(DIALOG_LINES).forEach((id) => _seenDialogs.add(id));
    saveSeenDialogs();
    log.debug('All dialogs marked seen.');
  };
  window.resetDialogs = function () {
    _seenDialogs = new Set();
    saveSeenDialogs();
    log.debug('Seen dialogs reset.');
  };
}

// Readonly accessor — small surface area for tests / introspection.
export function isDialogActive() { return _dialogActive; }

log.debug('dialog (T1.13.4) module initialized');
