// 2026-05-11 — TASK-008 (T1.07): chapter / boss roster relocated from legacy.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html lines 20321-20440.
//
// All five chapters live here. Ch1 (ASHEN DOMINION) + Ch2 (BLOOM OF MADNESS) +
// Ch3 (VEIL OF FORGOTTEN GODS) are shipped; Ch4 (COURT OF THE FALLEN HEAVENS)
// + Ch5 (CRADLE OF THE FIRST FLAME) are post-launch unlocks per memory note
// "Ch1-3 shipped, Ch4-5 post-launch only".
//
// HP values follow the TTK formula `boss_hp = expected_squad_dps × target_ttk_seconds`
// (sacred per CLAUDE.md §2.1 + §2.5). Don't touch without escalation.
//
// Note: the legacy file also exposes `let BOSSES = CHAPTERS[0].bosses` (a live
// dynamic re-binding rotated by setChapter(n)). That's runtime state, not data,
// so it's NOT migrated here. T1.10 will own the BOSSES binding alongside the
// setChapter helper.

export const CHAPTERS = Object.freeze([
  Object.freeze({
    id: 1,
    name: 'ASHEN DOMINION',
    bosses: Object.freeze([
      // Block B3: archetype field drives BOSS_ARCHETYPES profile, aura CSS class,
      // and attack-telegraph label. Phoenix revive flow lives in maybePhoenixRevive
      // (gated on bossArchetype === 'phoenix'). The legacy `revives` field path is
      // suppressed for phoenix archetype boses to avoid double-revive (HOTFIX
      // 2026-04-27 — Roman saw 3 lives instead of 2 because both paths fired).
      // 2026-05-02 — COMBAT v2.1 P4 §2.2: HP from TTK formula.
      // PYREDRAKE: tutorial × DPS 30 = 7200; ABYSSAL/GROVEWARDEN: gatekeeper = 10800;
      // SOLAR PHOENIX: mid_act = 12600; CRYPT LICH: act_boss = 14400.
      // roleTier drives CHANNEL_SIGNATURE_DMG (Phase 1) + TTK forecast UI.
      Object.freeze({ name: 'PYREDRAKE',       title: 'Lvl 1 · Fire Dragon',    hp: 7200,  attackInterval: 11, img: 'Boss_1', color: '#E85D4A', stihiya: 'ember', archetype: 'berserker', roleTier: 'tutorial'   }),
      Object.freeze({ name: 'ABYSSAL TYRANT',  title: 'Lvl 2 · Sea Overlord',   hp: 10800, attackInterval: 9,  img: 'Boss_2', color: '#3B8BD4', stihiya: 'tide',  archetype: 'armored',   roleTier: 'gatekeeper' }),
      Object.freeze({ name: 'GROVEWARDEN',     title: 'Lvl 3 · Ancient Keeper', hp: 10800, attackInterval: 7,  img: 'Boss_3', color: '#5DCA79', stihiya: 'grove', archetype: 'bruiser',   roleTier: 'gatekeeper' }),
      Object.freeze({ name: 'SOLAR PHOENIX',   title: 'Lvl 4 · Reborn Tyrant',  hp: 12600, attackInterval: 6,  img: 'Boss_4', color: '#E8B84A', stihiya: 'solar', archetype: 'phoenix',   roleTier: 'mid_act'    }),
      Object.freeze({ name: 'CRYPT LICH',      title: 'Lvl 5 · Final Overlord', hp: 14400, attackInterval: 5,  img: 'Boss_5', color: '#9B59D6', stihiya: 'umbra', archetype: 'assassin',  roleTier: 'act_boss'   }),
    ]),
  }),
  Object.freeze({
    id: 2,
    name: 'BLOOM OF MADNESS',
    bosses: Object.freeze([
      // PHASE 5b BLOCK 2 — Chapter 2 boss roster. Each boss has a Chapter 2 archetype with
      // 3-phase progression (HP gates 100% → 66% → 33% → 0%). HP estimates per Compendium
      // first-pass; tunes during Phase 5b.9 balance pass. Voice lines in BOSS_VOICES (3 per
      // boss: intro / midfight / death). Specific phase mechanics in 5b.3-5b.7 per-boss blocks.
      // 2026-05-02 — COMBAT v2.1 P4 §2.2: Ch2 DPS=75. gatekeeper=27000, mid_act=31500, act_boss=36000.
      Object.freeze({ name: 'VEROTHIRA',  title: 'Lvl 6 · Hungering Bloom',  hp: 27000, attackInterval: 6, img: 'Boss_6',  color: '#9B59D6', stihiya: 'umbra', archetype: 'hypnotist',       roleTier: 'gatekeeper' }),
      Object.freeze({ name: 'GEARHEART',  title: 'Lvl 7 · Rusted Colossus',  hp: 27000, attackInterval: 6, img: 'Boss_7',  color: '#B87333', stihiya: 'grove', archetype: 'engineer',        roleTier: 'gatekeeper' }),
      Object.freeze({ name: 'URSARO',     title: 'Lvl 8 · Magma Bear',       hp: 31500, attackInterval: 5, img: 'Boss_8',  color: '#FF6E28', stihiya: 'ember', archetype: 'frenzy',          roleTier: 'mid_act'    }),
      Object.freeze({ name: 'TIDESPIRE',  title: 'Lvl 9 · Drowned Howl',     hp: 31500, attackInterval: 5, img: 'Boss_9',  color: '#78C8FF', stihiya: 'tide',  archetype: 'tempo_disruptor', roleTier: 'mid_act'    }),
      Object.freeze({ name: 'HELIOTRON',  title: 'Lvl 10 · Solar Sovereign', hp: 36000, attackInterval: 5, img: 'Boss_10', color: '#FFD75A', stihiya: 'solar', archetype: 'battery',         roleTier: 'act_boss'   }),
    ]),
  }),
  Object.freeze({
    // 2026-04-27 — Chapter 3: VEIL OF FORGOTTEN GODS per BLOCKSWORN_CHAPTERS_3_5.md
    // 5 dual-element bosses (per spec §2 system milestone — DUAL-ELEMENT BOSSES).
    // Custom mechanics (Soul-Drinker / Stormcaller / Confession Reader / Wither /
    // Sealer) deferred to follow-up blocks; v1 uses closest existing archetype
    // mapped to spec intent (mirrors Tower T.8 boss mechanics deferral pattern).
    id: 3,
    name: 'VEIL OF FORGOTTEN GODS',
    bosses: Object.freeze([
      // 2026-05-02 — COMBAT v2.1 P6 PR #6.A §2.6: Ch3 archetype CORRECTION per Roman design.
      // P4 used phoenix/engineer/hypnotist/bruiser/assassin as placeholders; P6 swaps in
      // proper soul_drinker/stormcaller/confession_reader/wither/sealer. HP unchanged
      // (P4 TTK formula values preserved). Per-archetype tick handlers in P6.A foundation;
      // full mechanical depth lands as v2.2 polish per spec §19.1.
      // Boss 11 TWILIGHT VESSEL — Dark+Light dual; Soul-Drinker (consumes lost names)
      Object.freeze({ name: 'TWILIGHT VESSEL', title: 'Lvl 11 · Vessel of Forgotten Names', hp: 59400, attackInterval: 5, img: 'Boss_11', color: '#A88AC8', stihiya: 'umbra', archetype: 'soul_drinker',      roleTier: 'gatekeeper' }),
      // Boss 12 STORMSHEPHERD — Frost+Earth; Stormcaller (3 storm types per turn)
      Object.freeze({ name: 'STORMSHEPHERD',   title: 'Lvl 12 · Tender of Lost Storms',     hp: 59400, attackInterval: 5, img: 'Boss_12', color: '#9CC8DE', stihiya: 'tide',  archetype: 'stormcaller',       roleTier: 'gatekeeper' }),
      // Boss 13 VOIDPRIESTESS — Dark+Light inverted; Confession Reader (random debuff per turn)
      Object.freeze({ name: 'VOIDPRIESTESS',   title: 'Lvl 13 · The High Confessor',        hp: 69300, attackInterval: 5, img: 'Boss_13', color: '#C0A6DF', stihiya: 'umbra', archetype: 'confession_reader', roleTier: 'mid_act'    }),
      // Boss 14 ROOT-OF-NOTHING — Earth+Dark; Wither (cells permanently wither)
      Object.freeze({ name: 'ROOT-OF-NOTHING', title: 'Lvl 14 · First Tree to Forget Sun',  hp: 69300, attackInterval: 5, img: 'Boss_14', color: '#6E7A6A', stihiya: 'grove', archetype: 'wither',            roleTier: 'mid_act'    }),
      // Boss 15 ARCHIVAL ETERNAL — Light+Earth; Sealer (random ability seal)
      Object.freeze({ name: 'ARCHIVAL ETERNAL', title: 'Lvl 15 · Library of All That Was Lost', hp: 79200, attackInterval: 5, img: 'Boss_15', color: '#E8D88A', stihiya: 'solar', archetype: 'sealer',         roleTier: 'act_boss'   }),
    ]),
  }),
  // 2026-05-01 — SPRINT 3A: Chapter 4 (COURT OF THE FALLEN HEAVENS). REPLACES
  // Phase 7 (CONTENT.2) "AGE OF FORGOTTEN GIANTS" placeholder. Per
  // BLOCKSWORN_CHAPTERS_3_5.md §3 + SPRINT_3A_CHAPTER_4_IMPLEMENTATION.md §3.2.
  // 5 phase-shifting bosses (per spec system milestone — PHASE-SHIFTING BOSSES,
  // each with 5+ phases). Custom mechanics (Phase Shifter / Equalizer / Regent /
  // Phase Reverser / Royal Phase) deferred to Phase 9 follow-up; v1 uses closest
  // existing archetype mapped to spec intent (mirrors Ch3 archetype-deferral
  // pattern). Unlock gate switched from CONTENT_DROPS day-window (`chapter_4`
  // drop, Day 75) to `chapter4Unlocked` flag (set on ARCHIVAL ETERNAL Boss 15
  // defeat). The Day-75 $9.99 Chapter Unlock Pack SKU stays on its own schedule.
  Object.freeze({
    id: 4,
    name: 'COURT OF THE FALLEN HEAVENS',
    bosses: Object.freeze([
      // 2026-05-02 — COMBAT v2.1 P6 PR #6.A §3 + §14.4: Ch4 archetype OVERRIDE.
      // P4 placed phoenix/tempo_disruptor/bruiser/hypnotist/engineer placeholders.
      // P6 swaps in proper Cosmic Ascension archetypes (phase_shifter / equalizer /
      // regent / phase_reverser / royal_phase). HP unchanged (P4 TTK formula values
      // preserved per spec §14.4 — Roman doc HP was pre-v2.1; formula values correct).
      // Boss 16 THE PROSECUTOR — 5-face Phase Shifter (Pity/Rage/Sorrow/Justice/Verdict)
      Object.freeze({ name: 'THE PROSECUTOR',     title: 'Lvl 16 · Speaker for the Indictment',     hp: 115200, attackInterval: 5, img: 'Boss_16', color: '#8E5DCC', stihiya: 'umbra', archetype: 'phase_shifter',  roleTier: 'gatekeeper' }),
      // Boss 17 JUSTICE BLIND — Equalizer (scales react to damage delta)
      Object.freeze({ name: 'JUSTICE BLIND',      title: 'Lvl 17 · The Magistrate Without Eyes',    hp: 115200, attackInterval: 5, img: 'Boss_17', color: '#F0E8B8', stihiya: 'solar', archetype: 'equalizer',      roleTier: 'gatekeeper' }),
      // Boss 18 SUN-CROWN REGENT — Regent (5 regents shield boss)
      Object.freeze({ name: 'SUN-CROWN REGENT',   title: 'Lvl 18 · Successor to a Forgotten King',  hp: 134400, attackInterval: 5, img: 'Boss_18', color: '#FFAA28', stihiya: 'ember', archetype: 'regent',         roleTier: 'mid_act'    }),
      // Boss 19 ECLIPSE-WALKER — Phase Reverser (dual HP bars: fire + frost)
      Object.freeze({ name: 'ECLIPSE-WALKER',     title: 'Lvl 19 · Ambassador of Twin Suns',        hp: 134400, attackInterval: 5, img: 'Boss_19', color: '#A8C8E8', stihiya: 'tide',  archetype: 'phase_reverser', roleTier: 'mid_act'    }),
      // Boss 20 THE FALLEN HIGHEST — Royal Phase (6 ghost summons / 6-phase rush)
      Object.freeze({ name: 'THE FALLEN HIGHEST', title: 'Lvl 20 · The Court\'s Empty Throne',      hp: 153600, attackInterval: 5, img: 'Boss_20', color: '#E8C8FF', stihiya: 'umbra', archetype: 'royal_phase',    roleTier: 'act_boss'   }),
    ]),
  }),
  // 2026-05-02 — COMBAT v2.1 P6 PR #6.A §4 + §14.4: Ch5 (Cradle of the First Flame).
  // `placeholder: true` flag REMOVED — Ch5 unlocks via Boss 20 (THE FALLEN HIGHEST)
  // defeat per spec gate, not CONTENT.2 day-window. Day-135 unlock can still gate
  // via setChapter routing if other code reads contentDropId.
  // Boss titles + names per Roman doc Cosmic Ascension Arc §3.X-§4.X. Archetypes
  // overridden from P4 placeholders (armored/tempo_disruptor/bruiser/berserker/phoenix)
  // to proper Cosmic archetypes (eternal/inevitable/co_op/devourer/choice).
  Object.freeze({
    id: 5,
    name: 'CRADLE OF THE FIRST FLAME',
    contentDropId: 'chapter_5',
    bosses: Object.freeze([
      // 2026-05-02 — Ch5 DPS=460 (P4 formula). gatekeeper=165600, mid_act=193200, finale=248400.
      // Boss 21 THE WICK — Eternal (wax timer 30t; 100 dmg = -1 wax)
      Object.freeze({ name: 'THE WICK',        title: 'Lvl 21 · The Last Candle Standing',  hp: 165600, attackInterval: 5, img: 'Boss_21', color: '#FFD700', stihiya: 'ember', archetype: 'eternal',    roleTier: 'gatekeeper'     }),
      // Boss 22 MOTHER DEPTHS — Inevitable (dream pressure decay)
      Object.freeze({ name: 'MOTHER DEPTHS',   title: 'Lvl 22 · The Sleeper Beneath',       hp: 193200, attackInterval: 5, img: 'Boss_22', color: '#5DCAFF', stihiya: 'tide',  archetype: 'inevitable', roleTier: 'mid_act'        }),
      // Boss 23 SHARED HEARTH — Co-Op Twin (strategic restraint; both must die together)
      Object.freeze({ name: 'SHARED HEARTH',   title: 'Lvl 23 · The Twin Hearts',           hp: 193200, attackInterval: 5, img: 'Boss_23', color: '#FF7F50', stihiya: 'ember', archetype: 'co_op',      roleTier: 'mid_act'        }),
      // Boss 24 FIRST HUNGER — Devourer (resource theft + 150% refund on victory)
      Object.freeze({ name: 'FIRST HUNGER',    title: 'Lvl 24 · Original Want',             hp: 193200, attackInterval: 5, img: 'Boss_24', color: '#2F2F2F', stihiya: 'umbra', archetype: 'devourer',   roleTier: 'mid_act'        }),
      // Boss 25 FLAME ITSELF — Choice (7 phases asking 7 questions about your strategy)
      Object.freeze({ name: 'FLAME ITSELF',    title: 'Lvl 25 · The First Fire That Chose to Burn', hp: 248400, attackInterval: 4, img: 'Boss_25', color: '#FFFFFF', stihiya: 'umbra', archetype: 'choice', roleTier: 'chapter_finale' }),
    ]),
  }),
]);
