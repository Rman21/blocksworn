// Codex taxonomy: elements, races, roles. Sources of truth:
//  - HERO_GRAMMAR.md §2 (elements), §3 (roles), §5 (races) — the "frozen
//    contract" for v1 mechanical identity.
//  - HEROES + BOSSES lib data for cross-linking entry counts.

import type { Element } from './bosses';

export type RoleId = 'warrior' | 'mage' | 'hunter' | 'tank' | 'captain';
export type RaceId = 'pirate' | 'rock' | 'shark' | 'crocodile' | 'spark';

export interface ElementMeta {
  id: Element;
  uiName: string;       // e.g. "Fire"
  inWorldName: string;  // e.g. "Ember"
  color: string;
  coreMechanic: string;
  boardInteraction: string;
  comboRole: string;
  signature: string;     // visual/audio signature combined
  raceId: RaceId;        // primary race using this element
}

export interface RoleMeta {
  id: RoleId;
  name: string;
  verb: string;
  function: string;
  boardInteraction: string;
  ultPattern: string;
  chargeCost: string;
}

export interface RaceMeta {
  id: RaceId;
  name: string;
  element: Element;
  status: string;
  raceFlavor: string;
  lore: string;
  passive2: string;       // 2-of-race passive
  passive3: string;       // 3+-of-race passive
}

// ============================================================
// ELEMENTS — 5
// ============================================================
export const ELEMENTS: ElementMeta[] = [
  {
    id: 'ember',
    uiName: 'Fire',
    inWorldName: 'Ember',
    color: '#E85D4A',
    coreMechanic: 'Charges cells; charged cells detonate for multiplied damage.',
    boardInteraction:
      'On clear, surviving ember cells become charged. Adjacent charged cells chain on detonation, producing the "INFERNO" cascade.',
    comboRole: 'Damage payoff — the loudest element. Converts board state into spike damage.',
    signature: 'Saturated orange-red. Ember sparks, heat shimmer, sharp flash on detonation. Crackle on charge, percussive crack on detonation.',
    raceId: 'pirate',
  },
  {
    id: 'tide',
    uiName: 'Frost',
    inWorldName: 'Tide',
    color: '#3B8BD4',
    coreMechanic: 'Freezes cells; frozen cells form chains; chain length grants extra turns.',
    boardInteraction:
      'Cleared cells chill neighbors. Three chilled in a row form a chain. Broken chains refund placements.',
    comboRole: 'Tempo control — converts board state into time, not damage. The "stop time" element.',
    signature: 'Cold cyan. Crystalline drift, freeze-frame snap, brittle shatter. Soft shimmer on freeze, glassy shatter on chain break.',
    raceId: 'shark',
  },
  {
    id: 'grove',
    uiName: 'Earth',
    inWorldName: 'Grove',
    color: '#5DCA79',
    coreMechanic: 'Roots cells; rooted cells bloom over turns into HP and thorn damage.',
    boardInteraction:
      'Surviving grove cells become rooted; survive 2 extra clears; emit +HP on bloom (turn 3).',
    comboRole: 'Survival → revenge — the slowest element. "I am still here, and now I hurt you."',
    signature: 'Warm green. Vines grow in real time, leaf burst, woody thorn crack. Low organic rumble, soft chime on bloom.',
    raceId: 'crocodile',
  },
  {
    id: 'umbra',
    uiName: 'Dark',
    inWorldName: 'Umbra',
    color: '#9B59D6',
    coreMechanic: 'Stacks Encore; Encore replays the last beat at higher cost.',
    boardInteraction:
      'Each clear adds an Encore stack. Triggering Encore replays the last ability at scaling multiplier.',
    comboRole: 'Escalation — revenge + rhythm. Rewards keeping the same line alive across turns.',
    signature: 'Deep violet. Smoke trails, neon pulse, double-flash on Encore. Sub-bass kick on Encore, rising distortion as stacks build.',
    raceId: 'rock',
  },
  {
    id: 'solar',
    uiName: 'Light',
    inWorldName: 'Solar',
    color: '#E8B84A',
    coreMechanic: 'Illuminates cells; illuminated cells convert clears into squad-wide gain.',
    boardInteraction:
      'Surviving solar cells become radiant: +crit to next ability; convert overflow damage into squad heal/charge.',
    comboRole: 'Sustain → conversion — the only element that turns excess into something else.',
    signature: 'Pale gold. Rays, lens flare, gentle bloom, prismatic flash. Bell chime on illumination, choral swell on conversion.',
    raceId: 'spark',
  },
];

// ============================================================
// ROLES — 5
// ============================================================
export const ROLES: RoleMeta[] = [
  {
    id: 'warrior',
    name: 'Warrior',
    verb: 'creates',
    function: 'CREATOR',
    boardInteraction: 'Establishes board state — spawns charged / frozen / rooted / encore / radiant cells. Direct hit on placement.',
    ultPattern: 'SIEGE — large flat damage burst; the cleanest finisher.',
    chargeCost: 'Medium (combo ≥ 2 fires ability; ULT fills in ~4 placements).',
  },
  {
    id: 'mage',
    name: 'Mage',
    verb: 'amplifies',
    function: 'AMPLIFIER',
    boardInteraction: 'Multiplies the value of element-state cells already on the board. Does not create state.',
    ultPattern: 'MENDING — full heal or board-state extension; restores the engine.',
    chargeCost: 'Medium-slow (period-based, ~12 placements).',
  },
  {
    id: 'hunter',
    name: 'Hunter',
    verb: 'detonates',
    function: 'DETONATOR',
    boardInteraction: 'Triggers all element-state cells at once for AoE / line burst damage. The payoff role.',
    ultPattern: 'VOLLEY — multi-line burst; the cascade trigger.',
    chargeCost: 'Fastest (combo ≥ 2; ULT fills in ~3 placements).',
  },
  {
    id: 'tank',
    name: 'Tank',
    verb: 'absorbs',
    function: 'PROTECTOR',
    boardInteraction: 'Generates shields from element-state. Taunts or reroutes incoming damage. Buys the squad turns.',
    ultPattern: 'AEGIS — large shield + element seed; the survival pivot.',
    chargeCost: 'Slowest (no min-combo gate; passive shield/turn; ULT ~5 placements).',
  },
  {
    id: 'captain',
    name: 'Captain',
    verb: 'enables',
    function: 'ENABLER',
    boardInteraction: 'Two simultaneous buffs: race-passive scaling AND element-drop weighting. One per squad.',
    ultPattern: 'DOMINION — board-wide element seed + multiplier window.',
    chargeCost: 'Medium (period-based, ~10 placements).',
  },
];

// ============================================================
// RACES — 5
// ============================================================
export const RACES: RaceMeta[] = [
  {
    id: 'pirate',
    name: 'Pirates',
    element: 'ember',
    status: 'Implemented · Chapter 1 starter race',
    raceFlavor: 'Raw, kinetic, "all here, all now." Passive scales raw ember damage.',
    lore: 'Pirates are not metaphors. They are exactly what they look like — ash-blackened buccaneers who survived the burning of the Old World by being too stubborn to die. They sail no ships now. The seas evaporated. They sail the corpse of a continent.',
    passive2: '+10–15% ember crit',
    passive3: '+25–30% ember damage + intro cinematic on first activation',
  },
  {
    id: 'rock',
    name: 'Rock Band',
    element: 'umbra',
    status: 'Implemented · Chapter 1 starter race',
    raceFlavor: 'Rhythmic, escalating, "encore on top of encore." Passive scales Encore multiplier.',
    lore: 'The Rock Band remembers the old anthems — the ones the people sang before the silence. Every fight is a setlist. Every Encore is a chorus they will not let die. They wear shadow as eyeliner and play loud enough that the dead can hear.',
    passive2: '+10–15% Encore multiplier',
    passive3: '+25–30% Encore scaling + cinematic',
  },
  {
    id: 'shark',
    name: 'Sharks',
    element: 'tide',
    status: 'Implemented · Chapter 1 mid-game unlock',
    raceFlavor: 'Patient, predatory, "the chain pulls you under." Passive scales chain length / refund odds.',
    lore: 'The Sharks were the first to learn that water remembers. When the seas left, they followed the chains of memory underground. Now they hunt in the dark places where time freezes itself. They do not bite to kill. They bite to slow.',
    passive2: '+10–15% chain length / refund odds',
    passive3: '+25–30% chain bonuses + cinematic',
  },
  {
    id: 'crocodile',
    name: 'Crocodiles',
    element: 'grove',
    status: 'Implemented · Chapter 2 unlock',
    raceFlavor: 'Patient, mineral, "the grove outlasts everything." Passive scales earth-cell absorption.',
    lore: 'The Crocodiles waited longer than anything alive should be capable of waiting. They watched empires rot into compost. When the call came, they rose from the loam wearing armor of moss and bedrock. They are not in a hurry. They have never been in a hurry.',
    passive2: '+10–15% earth-cell absorption',
    passive3: '+25–30% grove sustain + cinematic',
  },
  {
    id: 'spark',
    name: 'Sparks',
    element: 'solar',
    status: 'Implemented · Chapter 2 unlock',
    raceFlavor: 'Radiant, generous, "shine until the dark forgets you." Passive scales solar conversion.',
    lore: 'The Sparks are what is left of the suns the Old World burned through. Each one is a fragment of something that used to light a sky. They do not fight to win. They fight to stay lit. To remember they were once warm.',
    passive2: '+10–15% solar crit / conversion',
    passive3: '+25–30% solar conversion + cinematic',
  },
];

// ============================================================
// LOOKUPS
// ============================================================
export const ELEMENT_BY_ID: Record<Element, ElementMeta> = Object.fromEntries(
  ELEMENTS.map(e => [e.id, e]),
) as Record<Element, ElementMeta>;

export const RACE_BY_ID: Record<RaceId, RaceMeta> = Object.fromEntries(
  RACES.map(r => [r.id, r]),
) as Record<RaceId, RaceMeta>;

export const ROLE_BY_ID: Record<RoleId, RoleMeta> = Object.fromEntries(
  ROLES.map(r => [r.id, r]),
) as Record<RoleId, RoleMeta>;
