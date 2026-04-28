// Boss roster for marketing site — 15 bosses across 3 chapters.
// Authoritative content sourced from BLOCKSWORN_BOSS_COMPENDIUM.md (Ch1-2)
// and BLOCKSWORN_CHAPTERS_3_5.md (Ch3). Portraits + emblems extracted from
// game's ASSETS map (Boss_1..15) into /public/bosses/ via the same sips
// pipeline as the hero portraits — see scripts/build-portraits.mjs for shape.

export type Element = 'ember' | 'tide' | 'grove' | 'solar' | 'umbra';

const ELEMENT_COLOR: Record<Element, string> = {
  ember: '#E85D4A',
  tide: '#3B8BD4',
  grove: '#5DCA79',
  solar: '#E8B84A',
  umbra: '#9B59D6',
};

export interface BossPhase {
  hpRange: string;
  name: string;
  mechanic: string;
  voiceLine: string;
}

export interface BossStrategy {
  bestSquad: string;
  worstSquad: string;
  keyLesson: string;
  theMoment: string;
}

export interface BossMeta {
  id: string;
  bossNumber: number;
  name: string;
  tagline: string;
  chapter: 1 | 2 | 3;
  element: Element;
  secondaryElement?: Element;
  elementColor: string;
  archetype: string;
  hp: number;
  portraitUrl: string;
  emblemUrl: string;
  lore: string;
  visualIdentity: string;
  phases: [BossPhase, BossPhase, BossPhase];
  deathLine: string;
  strategy: BossStrategy;
}

export const CHAPTERS: Record<1 | 2 | 3, { name: string; subtitle: string; flavor: string }> = {
  1: {
    name: 'ASHEN DOMINION',
    subtitle: 'The world burned. Five mortal lords rule the ashes.',
    flavor: 'Tutorial-difficulty Pyredrake to endgame-mastery Crypt Lich. Defeating all 5 unlocks all 15 v1 heroes and SQUAD_MAX = 5.',
  },
  2: {
    name: 'BLOOM OF MADNESS',
    subtitle: 'After dominion fell, corruption grew. New gods rise from the rotting throne.',
    flavor: 'Five new bosses introduce five new archetypes — Hypnotist, Engineer, Frenzy, Tempo Disruptor, Battery. Unlocks Crocodiles + Sparks.',
  },
  3: {
    name: 'VEIL OF FORGOTTEN GODS',
    subtitle: 'They watched the world burn. They did nothing because they no longer remembered why anything mattered.',
    flavor: 'Dual-element bosses force adaptive squad composition mid-fight. No new heroes — DEEPER existing heroes via Tier 2 Ascension.',
  },
};

const portrait = (id: string) => `/bosses/${id}.jpg`;
const emblem = (id: string) => `/bosses/${id}_emblem.png`;

export const BOSSES: BossMeta[] = [
  // ============================================================
  // CHAPTER 1 — ASHEN DOMINION
  // ============================================================
  {
    id: 'pyredrake',
    bossNumber: 1,
    name: 'PYREDRAKE',
    tagline: 'The Cinder Dragon',
    chapter: 1,
    element: 'ember',
    elementColor: ELEMENT_COLOR.ember,
    archetype: 'Berserker',
    hp: 1800,
    portraitUrl: portrait('pyredrake'),
    emblemUrl: emblem('pyredrake'),
    lore: 'Once a forgotten ember in the wreckage of the Old World. Pyredrake was the first cinder that refused to die. It grew on hatred — for the rains that tried to drown it, for the silence that tried to forget it. Now it burns to be remembered.',
    visualIdentity: 'A draconic juvenile carved from cooling magma. Stone-and-coal scales, lava veins pulsing through its body. Eyes burn yellow with predatory focus. Wings half-spread, claws dug into stone — a beast that has just realized it can kill.',
    phases: [
      { hpRange: '100% → 66%', name: 'KINDLED', mechanic: 'Standard Berserker pattern: single-cell strikes every 4 turns. Player learns the telegraph rhythm.', voiceLine: 'The cinder that refuses to die... STILL BURNS.' },
      { hpRange: '66% → 33%', name: 'INFERNO', mechanic: 'Enrage triggers — attack damage ×2, AoE 3-cell cluster every 4 turns plus single strikes between. Lava veins glow brighter.', voiceLine: 'Your flames are kindling to mine.' },
      { hpRange: '33% → 0%', name: 'APOCALYPSE EMBER', mechanic: 'Attacks every 3 turns. New ability: Cinderblast — uncounterable 4-cell line every 6 turns. Forces commitment to cascade.', voiceLine: 'Burn beautifully.' },
    ],
    deathLine: 'I... will return... in ash...',
    strategy: {
      bestSquad: 'Frost cell setup denies the burn. Sharks counter Fire through tide chains.',
      worstSquad: 'All-Fire mirror — boss element drops compete with your own Fire heroes.',
      keyLesson: 'Telegraph reading. If you ignore highlighted cells, Phase 2 kills you.',
      theMoment: 'Set up an INFERNO cascade in Phase 3 with 1 turn before Cinderblast — push the kill, skip the apocalypse.',
    },
  },
  {
    id: 'abyssal-tyrant',
    bossNumber: 2,
    name: 'ABYSSAL TYRANT',
    tagline: 'Kraken of the Deep',
    chapter: 1,
    element: 'tide',
    elementColor: ELEMENT_COLOR.tide,
    archetype: 'Armored',
    hp: 3800,
    portraitUrl: portrait('abyssal-tyrant'),
    emblemUrl: emblem('abyssal-tyrant'),
    lore: 'The Tyrant has lived where light cannot reach for ten thousand years. It does not hate. It does not love. It absorbs. The depths give, the depths take. Those who disturb the depths become part of the depths.',
    visualIdentity: 'A massive purple-blue kraken with stone-knurl tentacles and bone-spike protrusions. Glowing yellow eyes betray ancient intelligence. Eight tentacles surround a gem-encrusted head. A small ship is being crushed in one limb — the price of past intruders.',
    phases: [
      { hpRange: '100% → 66%', name: 'DEPTHS STIR', mechanic: 'Armored profile — incoming damage reduced 70%. Slow heavy strikes hit a full row every 5 turns.', voiceLine: 'You disturb the depths. The depths answer.' },
      { hpRange: '66% → 33%', name: 'TENTACLES UNFURL', mechanic: 'Crush Spire — every 5 turns a tentacle pins one hero, locking their charge meter for 2 turns. Player can fire that hero before lock to prevent it.', voiceLine: 'Tide does not retreat. Tide consumes.' },
      { hpRange: '33% → 0%', name: 'DEEP SURGE', mechanic: 'Armor drops to 50%. Maelstrom every 8 turns floods top 3 rows with tide cells — both danger and chain-setup gift.', voiceLine: 'Crush. Devour. Repeat.' },
    ],
    deathLine: '...the deep... remembers...',
    strategy: {
      bestSquad: 'Earth absorbers mitigate row strikes. Mage amplification is critical against armor.',
      worstSquad: 'Pure burst Fire — Berserker damage doesn\'t reliably break armor.',
      keyLesson: 'Patience. Armor teaches that not every fight is fast.',
      theMoment: 'Build a 4-row SHATTER VOLLEY chain into Phase 2 Maelstrom — 4 rows of converted tide become 4 lines of detonation.',
    },
  },
  {
    id: 'grovewarden',
    bossNumber: 3,
    name: 'GROVEWARDEN',
    tagline: 'Eternal Treant',
    chapter: 1,
    element: 'grove',
    elementColor: ELEMENT_COLOR.grove,
    archetype: 'Bruiser',
    hp: 9750,
    portraitUrl: portrait('grovewarden'),
    emblemUrl: emblem('grovewarden'),
    lore: 'The Grovewarden was not born. It grew. From the first seed planted in the first soil after the Old World burned, the forest knew it would need a guardian. It became one. Now it remembers every footprint, every broken branch, every act of greed.',
    visualIdentity: 'A colossal humanoid form built from mountain-stone and ancient wood. Moss and leaves cover its body like armor. Glowing yellow runes pulse on its chest and palms. Pine trees grow from its feet — the boss is part of the world it defends.',
    phases: [
      { hpRange: '100% → 66%', name: 'JUDGMENT', mechanic: 'Bruiser profile — 1.5× HP base, 8-CD attacks. Bloom delayed AoE telegraphs 3 turns ahead. Heals 2% HP every 4 turns.', voiceLine: 'The forest watches. The forest judges.' },
      { hpRange: '66% → 33%', name: 'ROOT TRIAL', mechanic: 'Root Bind — every 6 turns, 2 cells lock for 3 turns under random heroes. Heal accelerates to 3% per 4 turns.', voiceLine: 'You are temporary. We are root and bough.' },
      { hpRange: '33% → 0%', name: 'VENGEANCE OF THE GROVE', mechanic: 'Heal capped at 33% HP — no stalemate. Forest Wrath: 4-cell BLOOM AoE every 5 turns with 3-turn warning. Tests endurance + earth-cell management.', voiceLine: 'Grow. Or rot. Choose.' },
    ],
    deathLine: '...new growth... from old wounds...',
    strategy: {
      bestSquad: 'Frost chain setup denies bloom telegraphs. Sharks excel at Maelstrom-style board control.',
      worstSquad: 'Pure Earth — element overlap reduces drop diversity.',
      keyLesson: 'Telegraph reading at 3-turn depth. Plan ahead.',
      theMoment: 'Phase 3, heal capped, you\'re one cascade away — SHATTER VOLLEY into the Forest Wrath telegraph zone, kill before AoE lands.',
    },
  },
  {
    id: 'solar-phoenix',
    bossNumber: 4,
    name: 'SOLAR PHOENIX',
    tagline: 'Reborn Tyrant',
    chapter: 1,
    element: 'solar',
    elementColor: ELEMENT_COLOR.solar,
    archetype: 'Phoenix',
    hp: 11250,
    portraitUrl: portrait('solar-phoenix'),
    emblemUrl: emblem('solar-phoenix'),
    lore: 'Solar Phoenix has died seventeen times that anyone remembers. Each time it returned. Each time it was stronger. Each time it told itself the same lie: "this time, I am eternal." This time, the player must convince it otherwise.',
    visualIdentity: 'A magnificent crystalline phoenix wreathed in golden flame. Wings spread wide in eternal display. Eyes burn red-gold with arrogance. Tail trails fire-feathers. The entire being radiates "I HAVE EARNED THIS" energy.',
    phases: [
      { hpRange: '100% → 50%', name: 'RADIANT', mechanic: 'Solar Line — column strikes every 5 turns. Predictable but heavy. Beautiful display of restrained power.', voiceLine: 'I have died. I have risen. WATCH ME RISE AGAIN.' },
      { hpRange: 'REBIRTH at 0%', name: 'REBIRTH', mechanic: 'First time HP hits 0, Phoenix Revive triggers — golden burst, restored to 60% (6750 HP), 2-turn motif immunity. The fight is not over.', voiceLine: 'Each death is rehearsal. I AM ETERNAL.' },
      { hpRange: 'post-revive → 0%', name: 'DESPERATE LIGHT', mechanic: 'Faster attacks (4 turns). Solar Storm hits 2 columns every 7 turns. Cannot revive again. Two-fight stamina test.', voiceLine: 'Burn for me. Burn beautifully.' },
    ],
    deathLine: 'Not... yet... not... yet...',
    strategy: {
      bestSquad: 'Light heroes with shield buildup — RADIANCE conversion against Solar Storm.',
      worstSquad: 'Pure burst — Phase 1 burst doesn\'t account for revive HP.',
      keyLesson: 'Conservation. Don\'t burn ULTs in Phase 1 — you need them for Phase 3.',
      theMoment: 'Phase 3, 2 columns about to hit, shields stockpiled, RADIANCE Solar Lance converts ALL shields → kill before Solar Storm lands.',
    },
  },
  {
    id: 'crypt-lich',
    bossNumber: 5,
    name: 'CRYPT LICH',
    tagline: 'Final Overlord',
    chapter: 1,
    element: 'umbra',
    elementColor: ELEMENT_COLOR.umbra,
    archetype: 'Assassin',
    hp: 11000,
    portraitUrl: portrait('crypt-lich'),
    emblemUrl: emblem('crypt-lich'),
    lore: 'Crypt Lich was a king. Then a tyrant. Then a heretic. Then a corpse. Now it is a SOMETHING — bound to the throne by spite, animated by the hatred of generations of tortured souls. It still believes it deserves to rule.',
    visualIdentity: 'An undead king draped in purple shadow-flame. Bone crown of bone-spikes, tattered robes flowing impossibly. Skull face with twin purple flame eyes. Three ghostly skull-spirits hover behind, watching.',
    phases: [
      { hpRange: '100% → 66%', name: 'BOREDOM', mechanic: 'Assassin profile — 1.4× damage, 4-CD attack. Dark Geometry: 3-5 cells in geometric arrangement. Boss seems disinterested.', voiceLine: 'Mortals. Such... persistent... noise.' },
      { hpRange: '66% → 33%', name: 'IRRITATION', mechanic: 'Soul Drain — every 6 turns, drains 5% max HP from each hero permanently (no regen). Cannot be prevented, only outpaced.', voiceLine: 'Your defiance amuses me. Briefly.' },
      { hpRange: '33% → 0%', name: 'REVELATION', mechanic: 'Attacks every 3 turns. Necropulse: every 5 turns, all umbra cells on board detonate against player. Your own dark cells now hurt you.', voiceLine: 'Enough. ENOUGH! KNEEL!' },
    ],
    deathLine: 'Death... is... a... door...',
    strategy: {
      bestSquad: 'Sharks (frost denies umbra setup) or Sparks (light cells dominate dark). Race-pure squads activate strongest.',
      worstSquad: 'Pure Dark — element overlap = boss drops compete with your charging.',
      keyLesson: 'Multi-system stress management. Execute everything you\'ve learned.',
      theMoment: 'Phase 3, you at 1 HP, boss at 8% HP, Necropulse 1 turn away — INFERNO + ENCORE-OF-ECHO + SHIELDS-TO-DAMAGE chain kills in the window between Necropulse and Dark Geometry. The North Star.',
    },
  },
  // ============================================================
  // CHAPTER 2 — BLOOM OF MADNESS
  // ============================================================
  {
    id: 'verothira',
    bossNumber: 6,
    name: 'VEROTHIRA',
    tagline: 'The Hungering Bloom',
    chapter: 2,
    element: 'umbra',
    elementColor: ELEMENT_COLOR.umbra,
    archetype: 'Hypnotist',
    hp: 14500,
    portraitUrl: portrait('verothira'),
    emblemUrl: emblem('verothira'),
    lore: 'VEROTHIRA was once a garden. A queen tended to it. The queen forgot to feed it. The garden ate the queen. The garden ate the kingdom. The garden GREW.',
    visualIdentity: 'A massive cosmic flower-creature, all crystal-purple petals around a central hypnotic eye. Vine-tentacles wreath its base, each tipped with smaller eye-sigils. Glows from within with heart-of-darkness purple light. Speaks in plural, voice overlapping with itself.',
    phases: [
      { hpRange: '100% → 66%', name: 'BLOOMING', mechanic: 'Petal Fall converts 4 random cells to umbra every 5 turns. Hypnotic Suggestion: one hero "wants" to fire — obey for +30% damage, deny without penalty. Choice paralysis begins.', voiceLine: 'Welcome, little spark. We have... so many gifts... for you.' },
      { hpRange: '66% → 33%', name: 'HUNGER', mechanic: 'Tendril Coil locks one hero for 2 turns every 6 turns. Suggestion now targets 2 heroes for +50% bonus. Petals droop, hungrier.', voiceLine: 'Your heart races. Such... wonderful... rhythm. Give me more.' },
      { hpRange: '33% → 0%', name: 'CONSUMPTION', mechanic: 'Bloom Bloom — every 8 turns, ALL umbra cells convert to corrupted, dealing damage when cleared. Suggestion targets 2 heroes for +75%. Trust your instincts or trust the boss.', voiceLine: 'Sleep, little fire. Sleep in our soil.' },
    ],
    deathLine: '...we... we were... so... close...',
    strategy: {
      bestSquad: 'Light/Sparks denies Dark setup. Light heroes "resist hypnosis" through their own radiance.',
      worstSquad: 'Pure Dark mirror — boss steals identity through element overlap.',
      keyLesson: 'Trust your own decisions. Hypnotic Suggestion is bait + reward.',
      theMoment: 'Phase 3, you ignore both suggestions, play your own cascade, kill before Bloom Bloom triggers — narrative payoff: "I didn\'t dance to your song."',
    },
  },
  {
    id: 'gearheart',
    bossNumber: 7,
    name: 'GEARHEART',
    tagline: 'The Rusted Colossus',
    chapter: 2,
    element: 'grove',
    elementColor: ELEMENT_COLOR.grove,
    archetype: 'Engineer',
    hp: 16000,
    portraitUrl: portrait('gearheart'),
    emblemUrl: emblem('gearheart'),
    lore: 'GEARHEART was the last automaton built before the Old World fell. Its makers gave it directives: PROTECT, MAINTAIN, ENDURE. With no one left to protect, it now MAINTAINS itself by EXTRACTING from those who pass.',
    visualIdentity: 'A massive humanoid mech of corroded copper-bronze panels and industrial gears. Green energy core glowing in chest. One arm replaced with a rust-claw, the other ends in a drill. Half corpse, half running engine. Voice carries static.',
    phases: [
      { hpRange: '100% → 66%', name: 'IDLE PROCESS', mechanic: 'Drill Strike every 6 turns. Cell Lockdown welds 2 cells shut for 4 turns — locked cells cannot be cleared. Player chooses what to lose.', voiceLine: 'DIRECTIVE... ACTIVE. INTRUDER... DETECTED. INITIATING... PROTOCOL: ELIMINATE.' },
      { hpRange: '66% → 33%', name: 'EXTRACTION', mechanic: 'Resource Extract absorbs 3 earth-cells every 7 turns, healing boss 5% HP per cell. Lockdown intensifies to 3 cells per cycle. Fire ULTs to consume cells before boss steals them.', voiceLine: 'FUEL... LOW. CONSUMING... AVAILABLE... RESOURCES.' },
      { hpRange: '33% → 0%', name: 'OVERCLOCK', mechanic: 'Attacks every 4 turns. Critical Mass electrifies a row every 6 turns — clearing it damages you. Lockdown locks 4 cells; board genuinely runs out of space.', voiceLine: 'OBJECTIVE... UNCHANGED. ALL... INTRUDERS... ARE... FUEL.' },
    ],
    deathLine: 'DIRECTIVE... FAILED. SHUTTING... DOWN... ALL... SYSTEMS...',
    strategy: {
      bestSquad: 'Crocodiles — earth-cell absorption + MOSSWEAVER\'s chain mage amplifies passive earth damage. Race-pure: Iron Hide passive.',
      worstSquad: 'Pure burst — locked cells make burst less effective.',
      keyLesson: 'Board management. Damage isn\'t everything; preservation is.',
      theMoment: 'Phase 3, board has 5 locked cells, Critical Mass row about to electrify — MOSSJAW Bedrock Bastion converts ALL empty cells to earth, electrify row absorbed by earth-cells, cascade kill.',
    },
  },
  {
    id: 'ursaro',
    bossNumber: 8,
    name: 'URSARO',
    tagline: 'The Magma Bear',
    chapter: 2,
    element: 'ember',
    elementColor: ELEMENT_COLOR.ember,
    archetype: 'Frenzy',
    hp: 15000,
    portraitUrl: portrait('ursaro'),
    emblemUrl: emblem('ursaro'),
    lore: 'URSARO was the spirit of an ancient mountain. The mountain erupted. The bear remained. It does not remember peace. It does not remember being something other than this. It only remembers HUNGER.',
    visualIdentity: 'A massive grizzly bear formed from cooling lava and obsidian-stone fur. Orange eyes burning with feral hunger. Claws dripping molten gold. Spikes of cooled magma protrude from shoulders and back. Stands on hind legs, fanged maw open in eternal roar.',
    phases: [
      { hpRange: '100% → 66%', name: 'STALKING', mechanic: 'Frenzy Stacks: +1 stack each turn boss is not hit, +5% damage per stack. Hitting boss resets stacks. Hit every turn or face escalating damage.', voiceLine: 'Hungry... hungry... hungry...' },
      { hpRange: '66% → 33%', name: 'FRENZY UNLEASHED', mechanic: 'Maul Combo at ≥5 stacks — 3 chained AoE attacks in one turn. Stacks now persist on hit (decay 50%). Cannot fully reset.', voiceLine: 'You wound. I HUNGER. Wound MORE.' },
      { hpRange: '33% → 0%', name: 'APEX PREDATOR', mechanic: 'Frenzy gain doubled (+2 per turn). Devour at ≥8 stacks eats lowest-HP hero (locks 3 turns + heals boss 8%). Tempo lock.', voiceLine: 'I will eat the SUN. After you.' },
    ],
    deathLine: '...always... hungry... forever...',
    strategy: {
      bestSquad: 'Hunters with frequent fires (BLACKTOOTH, BRINESHOT, RADIANCE) — keep Frenzy low through consistent damage.',
      worstSquad: 'Mage-heavy (CRYOMIND, KEYCRYPT) — long charge times = high Frenzy = death.',
      keyLesson: 'Tempo. The "right" cascade timing.',
      theMoment: 'Phase 3 with you at 30% HP, Frenzy at 7, boss at 5%, Devour about to fire — BLACKTOOTH VOLLEY kills before Devour lands. Survived by 1 turn.',
    },
  },
  {
    id: 'tidespire',
    bossNumber: 9,
    name: 'TIDESPIRE',
    tagline: 'The Drowned Howl',
    chapter: 2,
    element: 'tide',
    elementColor: ELEMENT_COLOR.tide,
    archetype: 'Tempo Disruptor',
    hp: 17000,
    portraitUrl: portrait('tidespire'),
    emblemUrl: emblem('tidespire'),
    lore: 'TIDESPIRE was a single drop of water. Then a stream. Then a flood. Then a SOUND — the howl of every drowned soul, gathered into one being. It carries the voices of those it claimed.',
    visualIdentity: 'An enormous water-and-ice elemental shaped like a frozen tidal wave with a roaring face at its peak. White-blue body, icicle teeth, glowing white eyes. The base IS water — sloshing, alive. Crystalline ice arms reach forward. Voice is a chorus of drowning whispers.',
    phases: [
      { hpRange: '100% → 66%', name: 'RISING TIDE', mechanic: 'Slow Time every 6 turns — one turn happens at half-speed. No mechanical change, just psychological pressure of feeling time trickle.', voiceLine: 'One drop... then ten thousand... we are... ONE.' },
      { hpRange: '66% → 33%', name: 'UNDERTOW', mechanic: 'Reverse Tempo every 7 turns — your next placement triggers 0 charge advancement. Heroes don\'t gain charge that turn.', voiceLine: 'Resist. We have heard ten thousand resist. Each fell to the same... ...QUIET.' },
      { hpRange: '33% → 0%', name: 'DROWN', mechanic: 'Tidal Lock every 8 turns — you lose your next turn entirely. Cannot be prevented, only planned around. Damage redundancy required.', voiceLine: 'Time bends. Will you?' },
    ],
    deathLine: '...soft... soft... silent... ...silent...',
    strategy: {
      bestSquad: 'Sharks — chain mechanics survive turn-loss. Frost mirror match favors the player who knows mechanics.',
      worstSquad: 'Period-based (CRYOMIND, KEYCRYPT, captains) — turn loss = charge loss = ULT delay.',
      keyLesson: 'Damage redundancy. Plan for missed turns.',
      theMoment: 'Phase 3, Tidal Lock 1 turn away — commit to BRINESHOT SHATTER VOLLEY this turn → kill before turn-loss = victory through tempo defiance.',
    },
  },
  {
    id: 'heliotron',
    bossNumber: 10,
    name: 'HELIOTRON',
    tagline: 'The Solar Sovereign',
    chapter: 2,
    element: 'solar',
    elementColor: ELEMENT_COLOR.solar,
    archetype: 'Battery',
    hp: 19000,
    portraitUrl: portrait('heliotron'),
    emblemUrl: emblem('heliotron'),
    lore: 'HELIOTRON was made by the survivors of the Old World as their final hope: a sun-god in mech form, designed to outlive humanity itself. It did. Now it stands alone in a world it cannot bring itself to leave behind.',
    visualIdentity: 'A magnificent golden mecha-beaver with geometric golden plate armor, glowing white-gold core in chest, lightning bolts arcing between body parts. One paw holds a sawblade-shield, the other extends as a cannon. Standing on a golden circuit-platform that pulses with electrical patterns.',
    phases: [
      { hpRange: '100% → 66%', name: 'EFFICIENCY', mechanic: 'Solar Charge meter visible: +1 per turn when hit, +2 when not hit. At 100%, boss UNLEASHES. Tense rhythm — the meter is the timer.', voiceLine: 'I am the sun\'s last echo. Step into my light, and prove worthy.' },
      { hpRange: '66% → 33%', name: 'UNLEASH', mechanic: 'Solar Convergence at 100% Charge fires 4-row attack on the top half of board. Player chooses: push damage to deplete OR play defensive to survive.', voiceLine: 'This is what your ancestors built. To outlast you. To remind you what was lost.' },
      { hpRange: '33% → 0%', name: 'APOCALYPSE LIGHT', mechanic: 'Charge gain doubled (+2 every turn). Sunfire Cascade at 100% — 3 sequential attacks: 3 columns, 3 rows, center 3×3 AoE. Kill before or survive the barrage.', voiceLine: 'I do not hate. I do not love. I AM.' },
    ],
    deathLine: 'I... served... well...',
    strategy: {
      bestSquad: 'Sparks — charge regeneration counters boss tempo + lightning passive trades blow-for-blow. Race-pure activates Static Field.',
      worstSquad: 'Long-charge Mage-heavy teams — get crushed by Solar Convergence before ULTs ready.',
      keyLesson: 'Tempo timing. Exact damage pacing.',
      theMoment: 'Phase 3, Charge at 95%, Sunfire about to fire, shields stockpiled — RADIANCE Solar Lance + AEGIS Equilibrium kills in the 1-turn window before Sunfire. The Chapter 2 capstone.',
    },
  },
  // ============================================================
  // CHAPTER 3 — VEIL OF FORGOTTEN GODS
  // ============================================================
  {
    id: 'twilight-vessel',
    bossNumber: 11,
    name: 'TWILIGHT VESSEL',
    tagline: 'The Vessel of Forgotten Names',
    chapter: 3,
    element: 'umbra',
    secondaryElement: 'solar',
    elementColor: ELEMENT_COLOR.umbra,
    archetype: 'Soul-Drinker',
    hp: 21000,
    portraitUrl: portrait('twilight-vessel'),
    emblemUrl: emblem('twilight-vessel'),
    lore: 'Once it was a god. Once it had a name. The Old World forgot that name; the vessel still remembers it forgot. It drinks the names of the dead, hoping to remember its own.',
    visualIdentity: 'A floating crystalline vessel, half-darkness half-light. It pulses with names that flicker in and out of legibility. A hovering tear of pure void on top, drinking the names. Eyes appear and vanish across its surface.',
    phases: [
      { hpRange: '100% → 50%', name: 'LIGHT', mechanic: 'DUAL SHIFT: in Light state, Hunters with umbra deal +50%, all others -25%. Light damage to player every 4 turns. Forces dual-element squad.', voiceLine: 'You bring memory. I had... forgotten... what memory feels like.' },
      { hpRange: '50% → 20%', name: 'DARK', mechanic: 'Boss flips to Dark state. Hunters with solar deal +50%, all others -25%. Souls of defeated heroes drift behind your squad — visually haunts.', voiceLine: 'Now I drink yours. Will you become forgotten too?' },
      { hpRange: '20% → 0%', name: 'BOTH', mechanic: 'Both states active simultaneously. Chaotic damage patterns. Squad must contain both Light and Dark Hunters to maintain damage.', voiceLine: 'Light and dark. Memory and forgetting. I am... AM I?' },
    ],
    deathLine: 'Now I... remember... my... own... name...',
    strategy: {
      bestSquad: 'Mixed Light + Dark Hunters (RADIANCE + BLACKTOOTH or rock_hunter SHRIEK). Dual-element coverage is mandatory.',
      worstSquad: 'Mono-element squads — half your damage gets crushed in either state.',
      keyLesson: 'Adaptive composition. Bring both elements or watch your damage halve.',
      theMoment: 'Phase 3, both states active — both Hunters fire in sequence, each cascading off the other\'s element. The vessel shatters into starlight.',
    },
  },
  {
    id: 'stormshepherd',
    bossNumber: 12,
    name: 'STORMSHEPHERD',
    tagline: 'The Tender of Lost Storms',
    chapter: 3,
    element: 'tide',
    secondaryElement: 'grove',
    elementColor: ELEMENT_COLOR.tide,
    archetype: 'Stormcaller',
    hp: 23000,
    portraitUrl: portrait('stormshepherd'),
    emblemUrl: emblem('stormshepherd'),
    lore: 'He was the Shepherd of the Lost. When storms ended, where did they go? They came to him. He keeps them. He has KEPT them for a thousand years.',
    visualIdentity: 'A massive humanoid with the body of a glacier cliff and the head of a moss-bearded shepherd. Wind constantly swirls around him. Lightning crackles in distance. He carries a staff topped with a frozen storm-orb. Behind him: silhouettes of every storm that ever was.',
    phases: [
      { hpRange: '100% → 66%', name: 'PREDICTABLE', mechanic: 'Storm Summoning — 1 storm per turn rotates between Blizzard ❄ (frost cells freeze adjacent), Earthquake 🌍 (cell becomes immovable for 3 turns), Lightning ⚡ (random row damage). 2 turns to defuse.', voiceLine: 'You disturb my flock. The storms remember you now.' },
      { hpRange: '66% → 33%', name: 'CHAINED', mechanic: '2 storms simultaneously. Failure to defuse → storm intensifies, deals 100 damage per cycle. Player must split attention between threats.', voiceLine: 'They asked to be unleashed. I kept them safe. Now... I let them go.' },
      { hpRange: '33% → 0%', name: 'CHAOS', mechanic: '3 storms simultaneous. But defeating each storm = 30% boss damage. Risk-reward: chase the storms or let them rage.', voiceLine: 'Each storm I held was a moment of mercy. No more mercy.' },
    ],
    deathLine: '...let them be... free...',
    strategy: {
      bestSquad: 'Crocodiles + Sharks — earth absorbers tank lightning, frost chains shatter blizzard cells.',
      worstSquad: 'Pure ember — your fire heroes can\'t defuse storms efficiently.',
      keyLesson: 'Threat triage. You can\'t defuse all 3 — pick the deadliest.',
      theMoment: 'Phase 3 with 3 storms active, you defuse two and detonate the third with a Volley → boss takes 60% damage in one turn.',
    },
  },
  {
    id: 'voidpriestess',
    bossNumber: 13,
    name: 'VOIDPRIESTESS',
    tagline: 'The High Confessor',
    chapter: 3,
    element: 'umbra',
    secondaryElement: 'solar',
    elementColor: ELEMENT_COLOR.umbra,
    archetype: 'Confession Reader',
    hp: 24500,
    portraitUrl: portrait('voidpriestess'),
    emblemUrl: emblem('voidpriestess'),
    lore: 'Every prayer ever spoken in the Old World — she heard them. She kept them. She holds the most secret confessions of every hero who ever fell. She knows YOUR confessions. Even the ones you forgot you confessed.',
    visualIdentity: 'A gaunt feminine figure in tattered robes that ripple like water. Hood covers most of face — only a single mournful eye visible. Holds a book wreathed in cosmic smoke. Sits cross-legged on a floating island of debris. Around her: ghostly silhouettes of confessors who came before.',
    phases: [
      { hpRange: '100% → 66%', name: 'WHISPER', mechanic: 'CONFESSION READ — 1 random debuff per turn from a pool of 5: Hunter cannot fire, Mage damage halved, Tank shields halved, Captain dual buff disabled, Warrior cannot place on first row. 3-turn duration each.', voiceLine: 'I have heard your prayers. I have... judged them. Mostly... I judge them weak.' },
      { hpRange: '66% → 33%', name: 'OVERLAP', mechanic: '2 confessions per cycle, overlapping. Each reveals a current squad weakness. Forces adaptation — your "best build" becomes your liability.', voiceLine: 'Tell me, mortal — what would you confess if I were not listening? Tell me anyway. I am ALWAYS listening.' },
      { hpRange: '33% → 0%', name: 'CACOPHONY', mechanic: '3 confessions stacked. New confession appears mid-turn. Squad effectiveness drops constantly — race against the boss\'s HP.', voiceLine: 'Now you hear them all. Every weakness ever named. ALL OF THEM YOURS.' },
    ],
    deathLine: '...even... the silent... have voices...',
    strategy: {
      bestSquad: 'Diverse role coverage — having backup damage from EVERY role lets you survive any single confession.',
      worstSquad: 'Mono-role (3 Mages, 3 Hunters) — one confession cripples your entire damage source.',
      keyLesson: 'Squad diversity. Don\'t double down on one role.',
      theMoment: 'Phase 3 with 3 confessions stacking — your captain dual is disabled, mage halved, hunter silenced, but your warrior chains a cascade through the only role still standing.',
    },
  },
  {
    id: 'root-of-nothing',
    bossNumber: 14,
    name: 'ROOT-OF-NOTHING',
    tagline: 'The First Tree to Forget Sun',
    chapter: 3,
    element: 'grove',
    secondaryElement: 'umbra',
    elementColor: ELEMENT_COLOR.grove,
    archetype: 'Wither',
    hp: 26000,
    portraitUrl: portrait('root-of-nothing'),
    emblemUrl: emblem('root-of-nothing'),
    lore: 'Once it was a sapling that touched the first sun. Then the sun darkened. The sapling grew, but it never saw light again. It became... ROOT-OF-NOTHING. The first thing to fully forget that it ever lived.',
    visualIdentity: 'A massive ancient tree without leaves. Trunk is petrified, gray, hollow. Branches are bone-white claws reaching up. Roots extend deep into void where ground should be. A single black sap drips from a wound in the trunk. The "ground" around it is dead earth. No insects. No life.',
    phases: [
      { hpRange: '100% → 66%', name: 'WITHERING', mechanic: 'WITHER — each turn, 1 random cell becomes withered (cannot be cleared, occupies a slot). Withered cells stack across turns. Cells standing 3+ turns heal boss 5% HP each.', voiceLine: '...rooted... ...quiet... ...rooted... ...quiet...' },
      { hpRange: '66% → 33%', name: 'STARVATION', mechanic: '2 withers per turn. Strategic neighbor-clears can break wither stacks. Board space tightens — every cell choice matters.', voiceLine: 'Light forgot me. I... forgot... light. We are even now.' },
      { hpRange: '33% → 0%', name: 'OBLIVION', mechanic: '3 withers per turn, cells wither faster (1 turn instead of 3). Board chokes. ULTs that reset cells become essential.', voiceLine: 'You will forget too. Eventually. All things... forget.' },
    ],
    deathLine: '...but I... remember... the warmth...',
    strategy: {
      bestSquad: 'Crocodiles for earth-cell mastery + ULTs that wipe board state (ANCIENTSCALE Eternal Bastion).',
      worstSquad: 'Slow chain builders — withers eat your setup faster than you can build.',
      keyLesson: 'Aggressive board management. Don\'t hoard cells — withers will claim them.',
      theMoment: 'Phase 3, 8+ wither cells on board, healing boss every cycle — ANCIENTSCALE ETERNAL BASTION wipes withers, exposes boss, cascade kills before next wither cycle.',
    },
  },
  {
    id: 'archival-eternal',
    bossNumber: 15,
    name: 'ARCHIVAL ETERNAL',
    tagline: 'The Library of All That Was Lost',
    chapter: 3,
    element: 'solar',
    secondaryElement: 'grove',
    elementColor: ELEMENT_COLOR.solar,
    archetype: 'Sealer',
    hp: 28000,
    portraitUrl: portrait('archival-eternal'),
    emblemUrl: emblem('archival-eternal'),
    lore: 'All things lost — names, languages, songs, lives — they did not vanish. They came to ARCHIVAL. The librarian-god kept them safe. Then it kept them. Then it forgot they were not its own. It now believes ALL of history belongs to it.',
    visualIdentity: 'A colossal librarian-being. Body is made of stone shelves filled with ethereal scrolls and books. Head is a stone scribe-mask with single golden eye. Writing materializes around it as it speaks. Each scroll = a story of a forgotten thing. Every action it makes "writes" a new entry.',
    phases: [
      { hpRange: '100% → 66%', name: 'CATALOGUE', mechanic: 'LIBRARIAN SEAL — 1 random seal per turn from 7: combo cap ×4, ULTs disabled, charge frozen, placement costs HP, drops randomized, captain inverted, all damage ×0.5. 2-turn duration.', voiceLine: 'All who climb here... become entries in my catalogue. Even your defeat is... categorized.' },
      { hpRange: '66% → 33%', name: 'BIND', mechanic: '2 seals per turn. Chained debuffs stack. Boss heals 2% HP per seal applied — sealing IS its damage.', voiceLine: 'You resist? You will be filed under: "AMUSING DELUSIONS."' },
      { hpRange: '33% → 0%', name: 'CLOSE THE BOOK', mechanic: '3 seals per turn. Multi-seal stacking can disable your entire kit. Defeat the boss before seal-stack overwhelms your build.', voiceLine: 'The volume closes. Your name fades. Already... half-forgotten.' },
    ],
    deathLine: 'Mark this entry: "A page that... refused... to be read..."',
    strategy: {
      bestSquad: 'High-resilience squads with multiple damage paths — losing one role to a seal still leaves three.',
      worstSquad: 'Captain-dependent compositions — captain_inverted seal flips your buff into a debuff.',
      keyLesson: 'Speed > setup. Long buildup gets sealed before you fire.',
      theMoment: 'Phase 3, 3 seals active — all damage halved, ULTs disabled, charges frozen — but you fired your finishing cascade two turns ago. The book closes on its own author.',
    },
  },
];

export const BOSSES_BY_CHAPTER: Record<1 | 2 | 3, BossMeta[]> = {
  1: BOSSES.filter(b => b.chapter === 1),
  2: BOSSES.filter(b => b.chapter === 2),
  3: BOSSES.filter(b => b.chapter === 3),
};
