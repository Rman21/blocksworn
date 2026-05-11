// 2026-05-11 — TASK-008 (T1.07): FTUE / tutorial constants relocated from legacy.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - FTUE_BEATS              line 24064-24068
//   - FTUE_TRANSITIONS        line 24095-24107
//   - FTUE_TRANSITIONS_FORCE  line 24108
//   - FTUE_SCRIPTS            line 24642-24710
//   - FTUE_BOSS_GUARANTEES    line 47134-47214 (sacred per CLAUDE.md §2.5)
//   - FTUE_TUTORIAL_TEXTS     line 47219-47235
//
// FTUE_SCRIPTS dialog copy is narrative-adjacent; Chronicle's voice flows
// here from chronicle_intro / chronicle_outro. Per CLAUDE.md §2.3 the
// Chronicler tone is sacred — these strings are byte-perfect from legacy.

export const FTUE_BEATS = Object.freeze([
  'not_started', 'chronicle_fight', 'chronicle_won',
  'intro', 'pyredrake_fight', 'pyredrake_won',
  'hero_reveals', 'leader_choice', 'grunt_fight', 'grunt_won', 'complete'
]);

// PHASE 4 BLOCK 2 (DEBT-014) — explicit transition table. Each key = source beat,
// value = array of allowed next beats. Self-edges are implicit (handled by
// advanceFtue's `prev === nextBeat` early return). Transitions documented:
//
//   not_started     →  intro | chronicle_fight               (intro: legacy auto-flow;
//                                                             chronicle_fight: opt-in
//                                                             via startChronicleFtueBattle())
//   chronicle_fight →  chronicle_won                         (player defeats Chronicle dummy)
//   chronicle_won   →  intro                                 (auto: chains into existing intro)
//   intro           →  pyredrake_fight                       (auto: post intro_dialog)
//   pyredrake_fight →  pyredrake_won                         (player wins) | grunt_fight (skip path)
//   pyredrake_won   →  leader_choice                         (auto: post hero_reveals chain)
//   hero_reveals    →  leader_choice                         (legacy beat, no-op handler)
//   leader_choice   →  grunt_fight                           (player picks captain)
//   grunt_fight     →  grunt_won                             (player wins)
//   grunt_won       →  complete                              (auto: post grunt_outro)
//   complete        →  (terminal)                            — only resetFtue() can leave
//
// The 'any → complete' / 'any → not_started' fast-paths via skipFtue/resetFtue
// are explicitly allowed by FTUE_TRANSITIONS_FORCE for dev tooling.
//
// 2026-04-28 — chronicle_fight / chronicle_won beats added for Stage 1 Tutorial
// Dummy (CHRONICLE). Auto-routing into chronicle_fight is NOT yet wired — the
// beat is only entered via explicit startChronicleFtueBattle() call. Once
// Stage 1 ships fully, routeByFtue can default not_started → chronicle_fight.
export const FTUE_TRANSITIONS = Object.freeze({
  not_started:     Object.freeze(['intro', 'chronicle_fight']),
  chronicle_fight: Object.freeze(['chronicle_won']),
  chronicle_won:   Object.freeze(['intro']),
  intro:           Object.freeze(['pyredrake_fight']),
  pyredrake_fight: Object.freeze(['pyredrake_won', 'grunt_fight']),
  pyredrake_won:   Object.freeze(['hero_reveals', 'leader_choice']),
  hero_reveals:    Object.freeze(['leader_choice']),
  leader_choice:   Object.freeze(['grunt_fight']),
  grunt_fight:     Object.freeze(['grunt_won']),
  grunt_won:       Object.freeze(['complete']),
  complete:        Object.freeze([]), // terminal — resetFtue() bypasses via FTUE_TRANSITIONS_FORCE
});

export const FTUE_TRANSITIONS_FORCE = Object.freeze(['complete', 'not_started']); // dev-tool allowed from any state

export const FTUE_SCRIPTS = Object.freeze({
  // 2026-04-28 — Stage 1 AAA+ — Chronicle pre-battle dialog. Frames the Tutorial
  // Dummy as a sentient training construct (the "Living Codex"). Mode B speaker
  // for Chronicle's lines — boss-style portrait + cyan glow per stylesheet.
  // 3 lines = ~6-8s at typewriter cadence — quick enough to keep first-launch
  // pace lively (per spec §4.4: "Battle starts in 60-90 seconds").
  // 2026-04-28 follow-up: scrubbed Pyredrake-themed teasers ("dragons", "pyres",
  // "Pyredrake stirs below") — the existing FTUE intro_dialog handles boss
  // reveal cleanly; double-framing diluted the impact.
  // 2026-04-30 — Polish v0.2 Track G (§G.3 + §G.4 step 2): pre-battle gate
  // collapsed from 3 lines (~6-8s) to a single Chronicle one-liner with a
  // persistent BIG CTA button. Plan-spec copy. The cut narrator framing
  // ("Before the warband…", "A trial, then…") + the original long
  // Chronicle line move to chronicle_outro per §G.4 step 3 — same content,
  // different placement. Player who just won the training fight is in
  // peak attention state; lore lands harder there.
  chronicle_intro: Object.freeze([
    Object.freeze({ speaker: 'CHRONICLE', speakerColor: '#5DCAFF', portraitKey: 'Boss_Chronicle',
      text: 'I am the Codex. Strike me — prove you remember.',
      ctaLabel: '▶ BEGIN', showSkip: true }),
  ]),
  // Stage 1 AAA+ — Chronicle outro on victory. The Codex "dissolves" and chains
  // narratively into the existing prologue (intro_dialog → pyredrake_fight).
  // 2026-04-30 — v0.2 Track G §G.4 step 3: prepended the 3 cut chronicle_intro
  // lines so the lore ships intact, just relocated. Reads as the Codex's
  // fading echo + the warrior's reflection rather than a pre-fight lecture.
  chronicle_outro: Object.freeze([
    Object.freeze({ speakerId: 'pirate_warrior', text: 'Before the warband. Before the trials. There was the Codex.' }),
    Object.freeze({ speaker: 'CHRONICLE', speakerColor: '#5DCAFF', portraitKey: 'Boss_Chronicle',
      text: 'I am the living memory of every warband that came before. Strike me. Learn the cadence. I cannot be slain — only studied.' }),
    Object.freeze({ speakerId: 'pirate_warrior', text: 'A trial, then. The path opens after.' }),
    Object.freeze({ speaker: 'CHRONICLE', speakerColor: '#5DCAFF', portraitKey: 'Boss_Chronicle',
      text: 'You have learned the cadence. The trial fades. The world begins.' }),
    Object.freeze({ speakerId: 'pirate_warrior', text: 'The Codex dissolves into the smoke. Now the real fight.' }),
  ]),
  // Block 1.2 — intro before first battle
  intro: Object.freeze([
    Object.freeze({ speakerId: 'pirate_warrior', text: 'The pyres woke before dawn. Something rose in Ashengard.' }),
    Object.freeze({ speakerId: 'pirate_warrior', text: 'The clans are scattered. What remains, I gather. Fight beside me.' }),
  ]),
  // Block 1.2 — post-Pyredrake reveal chain
  // Task #1.4: script keys kept as hero_reveals_thara/_urzog for FTUE state-machine stability.
  // TODO(phase-5): FTUE narrative re-designed by Creative Director per Phase 5 Task 5.1 (see DEBT-006)
  // Reveal 1 — Blacktooth arrives (pirate hunter, ember)
  hero_reveals_thara: Object.freeze([
    Object.freeze({ speakerId: 'pirate_warrior', text: 'A sail cuts the smoke. One of the free captains survived.' }),
    Object.freeze({ speakerId: 'pirate_hunter',  text: 'Heard the dragon-scream from six leagues out. My shot finds what yours missed.' }),
  ]),
  // TODO(phase-5): FTUE narrative re-designed by Creative Director per Phase 5 Task 5.1 (see DEBT-006)
  // Reveal 2 — Keycrypt arrives (rock mage, umbra)
  hero_reveals_urzog: Object.freeze([
    Object.freeze({ speakerId: 'pirate_warrior', text: 'A cold walks through the ash. The deep beat answers.' }),
    Object.freeze({ speakerId: 'rock_mage',      text: 'The dead heard your crown-song, Warchief. I weave umbra for warm-blooded fools.' }),
  ]),
  // Block 1.2 — leader choice framing + post-choice lines
  // Leader choice framing — narrator: Thorgar. Candidates: Crimson (pirate captain) vs Nightlord (rock captain).
  leader_choice_intro: Object.freeze([
    Object.freeze({ speakerId: 'pirate_warrior', text: 'Two more answer the horn. The path we walk is chosen by who leads it.' }),
  ]),
  // Crimson chosen — pirate captain, ember leadership flavor
  leader_liora: Object.freeze([
    Object.freeze({ speakerId: 'pirate_captain', text: 'The tide of flame carries my banner. Lead, and I will chart the path.' }),
  ]),
  // Nightlord chosen — rock captain, umbra leadership flavor
  leader_oakroot: Object.freeze([
    Object.freeze({ speakerId: 'rock_captain',   text: 'The old bassline remembers the true paths. I walk with you.' }),
  ]),
  // Block 1.3 scripts are defined alongside Block 1.3 backend — not here.
});

// 2026-05-03 — COMBAT v2.1 P8 §3: per-boss FTUE guarantees (sacred per CLAUDE.md §2.5).
// Each Ch1 boss has a list of "first-time concept reveals" with timing windows.
// enforceBossFTUEGuarantees walks this on battle start to schedule overlays.
export const FTUE_BOSS_GUARANTEES = Object.freeze({
  PYREDRAKE: Object.freeze({
    bossNum:      1,
    role:         'tutorial',
    hpModifier:   1.0,    // standard P4 HP (7200)
    guarantees:   Object.freeze([
      Object.freeze({ id: 'placement',     trigger: 'first_placement',    timing: 'minute_1' }),
      Object.freeze({ id: 'line_clear',    trigger: 'first_line_clear',   timing: 'minute_2' }),
      Object.freeze({ id: 'boss_exists',   trigger: 'battle_start',       timing: 'minute_0' }),
      Object.freeze({ id: 'boss_attack',   trigger: 'first_boss_attack',  timing: 'minute_3' }),
      Object.freeze({ id: 'hero_ult',      trigger: 'first_ult_charged',  timing: 'minute_4' }),
    ]),
    scriptedActions: Object.freeze({
      force_first_piece_single_cell:  true,
      guide_first_line_clear:         true,
      pulse_first_ult_button:         true,
    }),
    failsafeAssistance: Object.freeze({
      after_3_failed_lines:        'show_helpful_dialog',
      after_5_failed_ult_attempts: 'auto_charge_first_ult',
    }),
  }),
  ABYSSAL_TYRANT: Object.freeze({
    bossNum:      2,
    role:         'gatekeeper',
    hpModifier:   1.0,    // 10800
    guarantees:   Object.freeze([
      Object.freeze({ id: 'mitigation',         trigger: 'first_boss_attack',         timing: 'minute_1' }),
      Object.freeze({ id: 'attack_countdown',   trigger: 'first_attack_countdown',    timing: 'minute_0.5' }),
      Object.freeze({ id: 'signature_damage',   trigger: 'first_signature_event',     timing: 'minute_5' }),
    ]),
    scriptedActions: Object.freeze({
      highlight_mitigation_indicator_on_first_attack:    true,
      flash_signature_warning_3_sec_before_signature:    true,
    }),
    failsafeAssistance: Object.freeze({}),
  }),
  GROVEWARDEN: Object.freeze({
    bossNum:      3,
    role:         'gatekeeper',
    hpModifier:   1.0,    // 10800
    guarantees:   Object.freeze([
      Object.freeze({ id: 'pressure_meter',    trigger: 'pressure_first_visible',  timing: 'minute_2' }),
      Object.freeze({ id: 'stagger_window',    trigger: 'first_stagger',           timing: 'minute_5' }),
    ]),
    scriptedActions: Object.freeze({
      guarantee_pressure_reaches_100_within_8_turns:  true,
      force_visual_pressure_pulse_at_50_percent:      true,
    }),
    failsafeAssistance: Object.freeze({}),
  }),
  'SOLAR PHOENIX': Object.freeze({
    bossNum:      4,
    role:         'mid_act',
    hpModifier:   1.0,    // 12600
    guarantees:   Object.freeze([
      Object.freeze({ id: 'phase_gate',        trigger: '70_percent_hp_reached',  timing: 'natural' }),
      Object.freeze({ id: 'reactivity_event',  trigger: 'reactivity_fires',       timing: 'natural' }),
    ]),
    scriptedActions: Object.freeze({
      guarantee_first_phase_within_8_turns:        true,
      extra_visual_emphasis_on_first_telegraph:    true,
    }),
    failsafeAssistance: Object.freeze({}),
  }),
  'CRYPT LICH': Object.freeze({
    bossNum:      5,
    role:         'act_boss',
    hpModifier:   1.0,    // 14400
    guarantees:   Object.freeze([
      Object.freeze({ id: 'chapter_pack_reward',     trigger: 'boss_defeat',                timing: 'on_victory' }),
      Object.freeze({ id: 'hero_card_economy',       trigger: 'pack_distribution_starts',   timing: 'on_victory' }),
      Object.freeze({ id: 'tier_ascension_preview',  trigger: 'pack_complete',              timing: 'on_victory' }),
    ]),
    scriptedActions: Object.freeze({
      enhanced_pack_cinematic_first_time:                  true,
      flash_hero_card_inventory_pulse_after_pack:          true,
    }),
    failsafeAssistance: Object.freeze({}),
  }),
});

// 2026-05-03 — COMBAT v2.1 P8 §4: tutorial dialog text per concept ID.
// Brief, narrative-leaning. Used by enforceBossFTUEGuarantees → showTutorialOverlay.
// Full Chronicler tonal rewrite happens in 8.E; these are functional first-pass.
export const FTUE_TUTORIAL_TEXTS = Object.freeze({
  placement:               'Drag a piece onto the board.',
  line_clear:              'Fill a row to clear the line. Cleared cells damage the boss.',
  boss_exists:             'Above you stands the boss. Defeat it to advance.',
  boss_attack:             'The boss attacks. Watch your HP.',
  hero_ult:                'A hero ULT is ready. Tap to fire.',
  mitigation:              'Mitigation reduces damage. Tank heroes increase your mitigation.',
  attack_countdown:        'Watch the countdown. When it hits zero — the boss strikes.',
  signature_damage:        'SIGNATURE DAMAGE — boss\'s defining attack. Stronger than basic strikes. Plan defense.',
  pressure_meter:          'PRESSURE builds with each line clear. Fill the meter to STAGGER the boss.',
  stagger_window:          'STAGGER. 4 turns. Your damage doubles. Strike NOW.',
  phase_gate:              'The boss adapts. Phase gate at 70% HP — prepare for new behavior.',
  reactivity_event:        'REACTIVITY — boss responds to your strategy. 3-second telegraph — read and adjust.',
  chapter_pack_reward:     'CHAPTER PACK awaits. A bundle of rewards for your achievement.',
  hero_card_economy:       'These are HERO CARDS. The currency of ascension. Collect to grow stronger.',
  tier_ascension_preview:  'Tier ascension previewed. With enough cards, your heroes evolve.',
});
