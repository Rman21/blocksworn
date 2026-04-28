// Hero metadata for marketing site (subset of game's HERO_ROSTER).
// Portrait URLs hot-link to the existing GitHub Pages deploy so we don't
// duplicate ~10 MB of base64 art into the Next.js bundle.

export interface HeroMeta {
  id: string;
  name: string;
  race: string;
  role: string;
  stihiya: 'ember' | 'tide' | 'grove' | 'solar' | 'umbra';
  stihiyaColor: string;
  portraitUrl: string;
  // Fragment of game flavor — surfaced on /heroes/[id]
  tagline?: string;
}

const STIH_COLOR = {
  ember: '#E85D4A',
  tide: '#3B8BD4',
  grove: '#5DCA79',
  solar: '#E8B84A',
  umbra: '#9B59D6',
} as const;

// Game serves portraits inline as data: URIs from blocksworn_index_fixed.html.
// For the marketing site we'd need to either inline (huge bundle) OR fetch at
// runtime. P0: use a single static placeholder SVG file (in /public/) — Day 4
// will export real JPGs from game's data: URIs into /public/heroes/{id}.jpg
// via a build-time script.
//
// Earlier version generated a per-hero SVG via template literals + data URIs —
// that was too tricky for Next.js 15 SSG (failed at "Generating static pages
// 17/35" without a clear error). Static URL is safer.
//
// Args ignored for now; kept as fn so the call-site shape stays stable when
// real portraits land in Day 4.
const PLACEHOLDER = (_color: string, _label: string) => '/hero-placeholder.svg';

export const HEROES: HeroMeta[] = [
  // PIRATES
  { id: 'pirate_warrior', name: 'THORGAR',     race: 'pirate', role: 'warrior', stihiya: 'ember', stihiyaColor: STIH_COLOR.ember, portraitUrl: PLACEHOLDER(STIH_COLOR.ember, 'THORGAR'),     tagline: 'CLEAVER FORGE — sows ember-charged cells across the line.' },
  { id: 'pirate_hunter',  name: 'BLACKTOOTH',  race: 'pirate', role: 'hunter',  stihiya: 'ember', stihiyaColor: STIH_COLOR.ember, portraitUrl: PLACEHOLDER(STIH_COLOR.ember, 'BLACKTOOTH'),  tagline: 'INFERNO — detonates every charged ember at once.' },
  { id: 'pirate_mage',    name: 'EMBERHAND',   race: 'pirate', role: 'mage',    stihiya: 'ember', stihiyaColor: STIH_COLOR.ember, portraitUrl: PLACEHOLDER(STIH_COLOR.ember, 'EMBERHAND'),   tagline: 'EMBER BLOOM — chains charge to neighbors.' },
  { id: 'pirate_tank',    name: 'IRONBELLY',   race: 'pirate', role: 'tank',    stihiya: 'ember', stihiyaColor: STIH_COLOR.ember, portraitUrl: PLACEHOLDER(STIH_COLOR.ember, 'IRONBELLY'),   tagline: 'CHARGED AEGIS — shields plus 3 charged ember.' },
  { id: 'pirate_captain', name: 'CRIMSON',     race: 'pirate', role: 'captain', stihiya: 'ember', stihiyaColor: STIH_COLOR.ember, portraitUrl: PLACEHOLDER(STIH_COLOR.ember, 'CRIMSON'),     tagline: 'PIRATE DOMINION — converts ember + spawns field.' },
  // ROCK BAND
  { id: 'rock_warrior',   name: 'RIFFBLADE',   race: 'rock', role: 'warrior', stihiya: 'umbra', stihiyaColor: STIH_COLOR.umbra, portraitUrl: PLACEHOLDER(STIH_COLOR.umbra, 'RIFFBLADE'),  tagline: 'RIFF FORGE — 6 umbra cells, +4 with Encore.' },
  { id: 'rock_hunter',    name: 'SHRIEK',      race: 'rock', role: 'hunter',  stihiya: 'umbra', stihiyaColor: STIH_COLOR.umbra, portraitUrl: PLACEHOLDER(STIH_COLOR.umbra, 'SHRIEK'),     tagline: 'PIERCING SHRIEK — echoes on next placement.' },
  { id: 'rock_mage',      name: 'KEYCRYPT',    race: 'rock', role: 'mage',    stihiya: 'umbra', stihiyaColor: STIH_COLOR.umbra, portraitUrl: PLACEHOLDER(STIH_COLOR.umbra, 'KEYCRYPT'),   tagline: 'DEEP BEAT — 3-placement umbra +20%.' },
  { id: 'rock_tank',      name: 'THUNDERBEAT', race: 'rock', role: 'tank',    stihiya: 'umbra', stihiyaColor: STIH_COLOR.umbra, portraitUrl: PLACEHOLDER(STIH_COLOR.umbra, 'THUNDERBT'),  tagline: 'DRUMHEAD AEGIS — free Rhythm proc.' },
  { id: 'rock_captain',   name: 'NIGHTLORD',   race: 'rock', role: 'captain', stihiya: 'umbra', stihiyaColor: STIH_COLOR.umbra, portraitUrl: PLACEHOLDER(STIH_COLOR.umbra, 'NIGHTLORD'),  tagline: 'CONDUCT THE DARK — immediate Encore.' },
  // SHARKS
  { id: 'shark_warrior',  name: 'RIMEFANG',    race: 'shark', role: 'warrior', stihiya: 'tide', stihiyaColor: STIH_COLOR.tide, portraitUrl: PLACEHOLDER(STIH_COLOR.tide, 'RIMEFANG'),    tagline: 'TIDE FORGE — 6 fresh tide cells.' },
  { id: 'shark_hunter',   name: 'BRINESHOT',   race: 'shark', role: 'hunter',  stihiya: 'tide', stihiyaColor: STIH_COLOR.tide, portraitUrl: PLACEHOLDER(STIH_COLOR.tide, 'BRINESHOT'),   tagline: 'SHATTER VOLLEY — chain rows.' },
  { id: 'shark_mage',     name: 'CRYOMIND',    race: 'shark', role: 'mage',    stihiya: 'tide', stihiyaColor: STIH_COLOR.tide, portraitUrl: PLACEHOLDER(STIH_COLOR.tide, 'CRYOMIND'),    tagline: 'TIDE WEAVE — freezes boss attack.' },
  { id: 'shark_tank',     name: 'BULWARK',     race: 'shark', role: 'tank',    stihiya: 'tide', stihiyaColor: STIH_COLOR.tide, portraitUrl: PLACEHOLDER(STIH_COLOR.tide, 'BULWARK'),     tagline: 'TOCK GUARD — refunds placement.' },
  { id: 'shark_captain',  name: 'ABYSSKING',   race: 'shark', role: 'captain', stihiya: 'tide', stihiyaColor: STIH_COLOR.tide, portraitUrl: PLACEHOLDER(STIH_COLOR.tide, 'ABYSSKING'),   tagline: 'DEEP TIDE DOMINION — chills the board.' },
  // CROCODILES (grove)
  { id: 'croc_warrior',   name: 'VEROTHIRA',   race: 'crocodile', role: 'warrior', stihiya: 'grove', stihiyaColor: STIH_COLOR.grove, portraitUrl: PLACEHOLDER(STIH_COLOR.grove, 'VEROTHIRA'), tagline: 'GROVE FORGE — verdant chain.' },
  { id: 'croc_hunter',    name: 'BAYOU',       race: 'crocodile', role: 'hunter',  stihiya: 'grove', stihiyaColor: STIH_COLOR.grove, portraitUrl: PLACEHOLDER(STIH_COLOR.grove, 'BAYOU'),    tagline: 'BLOOM CASCADE.' },
  { id: 'croc_mage',      name: 'MIREWITCH',   race: 'crocodile', role: 'mage',    stihiya: 'grove', stihiyaColor: STIH_COLOR.grove, portraitUrl: PLACEHOLDER(STIH_COLOR.grove, 'MIREWITCH'), tagline: 'BLOOM RADIANCE — token spawning.' },
  { id: 'croc_tank',      name: 'BOGSCALE',    race: 'crocodile', role: 'tank',    stihiya: 'grove', stihiyaColor: STIH_COLOR.grove, portraitUrl: PLACEHOLDER(STIH_COLOR.grove, 'BOGSCALE'), tagline: 'BARK AEGIS.' },
  { id: 'croc_captain',   name: 'GLOOMTAIL',   race: 'crocodile', role: 'captain', stihiya: 'grove', stihiyaColor: STIH_COLOR.grove, portraitUrl: PLACEHOLDER(STIH_COLOR.grove, 'GLOOMTAIL'), tagline: 'GROVE DOMINION.' },
  // SPARKS (solar)
  { id: 'spark_warrior',  name: 'EMBERSPARK',  race: 'spark', role: 'warrior', stihiya: 'solar', stihiyaColor: STIH_COLOR.solar, portraitUrl: PLACEHOLDER(STIH_COLOR.solar, 'EMBERSPARK'),  tagline: 'SOLAR FORGE — radiant cells.' },
  { id: 'spark_hunter',   name: 'PROMINENCE',  race: 'spark', role: 'hunter',  stihiya: 'solar', stihiyaColor: STIH_COLOR.solar, portraitUrl: PLACEHOLDER(STIH_COLOR.solar, 'PROMINENCE'),  tagline: 'RADIANT VOLLEY.' },
  { id: 'spark_mage',     name: 'HELIOTRON',   race: 'spark', role: 'mage',    stihiya: 'solar', stihiyaColor: STIH_COLOR.solar, portraitUrl: PLACEHOLDER(STIH_COLOR.solar, 'HELIOTRON'),   tagline: 'HELIO ROAR — squad-wide buff.' },
  { id: 'spark_tank',     name: 'AURORA',      race: 'spark', role: 'tank',    stihiya: 'solar', stihiyaColor: STIH_COLOR.solar, portraitUrl: PLACEHOLDER(STIH_COLOR.solar, 'AURORA'),      tagline: 'STELLAR AEGIS.' },
  { id: 'spark_captain',  name: 'SOLARLORD',   race: 'spark', role: 'captain', stihiya: 'solar', stihiyaColor: STIH_COLOR.solar, portraitUrl: PLACEHOLDER(STIH_COLOR.solar, 'SOLARLORD'),   tagline: 'ETERNAL DAWN — heal + shields + solar field.' },
];

// Showcase = first hero from each race (5 total) for compact home grid.
export const FEATURED_HEROES: HeroMeta[] = [
  HEROES.find(h => h.id === 'pirate_warrior')!,
  HEROES.find(h => h.id === 'rock_captain')!,
  HEROES.find(h => h.id === 'shark_mage')!,
  HEROES.find(h => h.id === 'croc_warrior')!,
  HEROES.find(h => h.id === 'spark_captain')!,
];
