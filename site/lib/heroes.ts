// Hero metadata for marketing site (subset of game's HERO_ROSTER).
// Portraits live in /public/heroes/{id}.jpg — generated from artist source PNGs
// in `<game file>/assets/heroes/` via scripts/build-portraits.mjs (Day 4).
//
// IDs are canonical (match game's HERO_ROSTER, e.g. `crocodile_*` not `croc_*`)
// so future cross-platform sync (account hub Phase C+) can reuse them directly.

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

const portrait = (id: string) => `/heroes/${id}.jpg`;

export const HEROES: HeroMeta[] = [
  // PIRATES — ember
  { id: 'pirate_warrior', name: 'THORGAR',     race: 'pirate', role: 'warrior', stihiya: 'ember', stihiyaColor: STIH_COLOR.ember, portraitUrl: portrait('pirate_warrior'), tagline: 'EMBER FORGE — spawns 5 charged ember (FLEET bonus at 5 pirates).' },
  { id: 'pirate_hunter',  name: 'BLACKTOOTH',  race: 'pirate', role: 'hunter',  stihiya: 'ember', stihiyaColor: STIH_COLOR.ember, portraitUrl: portrait('pirate_hunter'),  tagline: 'VOLLEY — 3 rows + 100 if charged hit.' },
  { id: 'pirate_mage',    name: 'EMBERHAND',   race: 'pirate', role: 'mage',    stihiya: 'ember', stihiyaColor: STIH_COLOR.ember, portraitUrl: portrait('pirate_mage'),    tagline: 'MENDING — full heal + +1 ULT to all.' },
  { id: 'pirate_tank',    name: 'IRONBELLY',   race: 'pirate', role: 'tank',    stihiya: 'ember', stihiyaColor: STIH_COLOR.ember, portraitUrl: portrait('pirate_tank'),    tagline: 'AEGIS — +3 shields + 3 charged ember.' },
  { id: 'pirate_captain', name: 'CRIMSON',     race: 'pirate', role: 'captain', stihiya: 'ember', stihiyaColor: STIH_COLOR.ember, portraitUrl: portrait('pirate_captain'), tagline: 'DOMINION — 10 cells + 50% charged spawn.' },
  // ROCK BAND — umbra
  { id: 'rock_warrior',   name: 'RIFFBLADE',   race: 'rock', role: 'warrior', stihiya: 'umbra', stihiyaColor: STIH_COLOR.umbra, portraitUrl: portrait('rock_warrior'),   tagline: 'RIFF FORGE — 6 umbra (+4 with Encore primed).' },
  { id: 'rock_hunter',    name: 'SHRIEK',      race: 'rock', role: 'hunter',  stihiya: 'umbra', stihiyaColor: STIH_COLOR.umbra, portraitUrl: portrait('rock_hunter'),    tagline: 'PIERCING SHRIEK — VOLLEY echo on next placement.' },
  { id: 'rock_mage',      name: 'KEYCRYPT',    race: 'rock', role: 'mage',    stihiya: 'umbra', stihiyaColor: STIH_COLOR.umbra, portraitUrl: portrait('rock_mage'),      tagline: 'MENDING + 3-placement umbra +20%.' },
  { id: 'rock_tank',      name: 'THUNDERBEAT', race: 'rock', role: 'tank',    stihiya: 'umbra', stihiyaColor: STIH_COLOR.umbra, portraitUrl: portrait('rock_tank'),      tagline: 'AEGIS + free Rhythm proc.' },
  { id: 'rock_captain',   name: 'NIGHTLORD',   race: 'rock', role: 'captain', stihiya: 'umbra', stihiyaColor: STIH_COLOR.umbra, portraitUrl: portrait('rock_captain'),   tagline: 'DOMINION + immediate Encore.' },
  // SHARKS — tide
  { id: 'shark_warrior',  name: 'RIMEFANG',    race: 'shark', role: 'warrior', stihiya: 'tide', stihiyaColor: STIH_COLOR.tide, portraitUrl: portrait('shark_warrior'),   tagline: 'TIDE FORGE — spawn 6 tide cells.' },
  { id: 'shark_hunter',   name: 'BRINESHOT',   race: 'shark', role: 'hunter',  stihiya: 'tide', stihiyaColor: STIH_COLOR.tide, portraitUrl: portrait('shark_hunter'),    tagline: 'SHATTER VOLLEY — chain rows.' },
  { id: 'shark_mage',     name: 'CRYOMIND',    race: 'shark', role: 'mage',    stihiya: 'tide', stihiyaColor: STIH_COLOR.tide, portraitUrl: portrait('shark_mage'),      tagline: 'MENDING — freezes boss attack.' },
  { id: 'shark_tank',     name: 'BULWARK',     race: 'shark', role: 'tank',    stihiya: 'tide', stihiyaColor: STIH_COLOR.tide, portraitUrl: portrait('shark_tank'),      tagline: 'TOCK GUARD — refunds placement.' },
  { id: 'shark_captain',  name: 'ABYSSKING',   race: 'shark', role: 'captain', stihiya: 'tide', stihiyaColor: STIH_COLOR.tide, portraitUrl: portrait('shark_captain'),   tagline: 'DEEP TIDE DOMINION — chills the board.' },
  // CROCODILES — grove
  { id: 'crocodile_warrior', name: 'MOSSJAW',      race: 'crocodile', role: 'warrior', stihiya: 'grove', stihiyaColor: STIH_COLOR.grove, portraitUrl: portrait('crocodile_warrior'), tagline: 'BEDROCK BASTION — all empties become earth absorbers.' },
  { id: 'crocodile_hunter',  name: 'THORNBACK',    race: 'crocodile', role: 'hunter',  stihiya: 'grove', stihiyaColor: STIH_COLOR.grove, portraitUrl: portrait('crocodile_hunter'),  tagline: 'QUAKE — ×3 absorbed damage.' },
  { id: 'crocodile_mage',    name: 'MOSSWEAVER',   race: 'crocodile', role: 'mage',    stihiya: 'grove', stihiyaColor: STIH_COLOR.grove, portraitUrl: portrait('crocodile_mage'),    tagline: 'VERDANT SURGE — shields convert to damage.' },
  { id: 'crocodile_tank',    name: 'IRONSCALE',    race: 'crocodile', role: 'tank',    stihiya: 'grove', stihiyaColor: STIH_COLOR.grove, portraitUrl: portrait('crocodile_tank'),    tagline: 'AEGIS — full row of earth absorbers.' },
  { id: 'crocodile_captain', name: 'ANCIENTSCALE', race: 'crocodile', role: 'captain', stihiya: 'grove', stihiyaColor: STIH_COLOR.grove, portraitUrl: portrait('crocodile_captain'), tagline: 'ETERNAL BASTION — shields + earth field.' },
  // SPARKS — solar
  { id: 'spark_warrior',  name: 'EMBERSPARK',  race: 'spark', role: 'warrior', stihiya: 'solar', stihiyaColor: STIH_COLOR.solar, portraitUrl: portrait('spark_warrior'),  tagline: 'SUN CASCADE — spawn 5 solar cells.' },
  { id: 'spark_hunter',   name: 'RADIANCE',    race: 'spark', role: 'hunter',  stihiya: 'solar', stihiyaColor: STIH_COLOR.solar, portraitUrl: portrait('spark_hunter'),   tagline: 'AURORA BURST — shields convert to damage (no consume).' },
  { id: 'spark_mage',     name: 'LUMENWIND',   race: 'spark', role: 'mage',    stihiya: 'solar', stihiyaColor: STIH_COLOR.solar, portraitUrl: portrait('spark_mage'),     tagline: 'HALO WINDOW — doubled shields.' },
  { id: 'spark_tank',     name: 'AEGIS',       race: 'spark', role: 'tank',    stihiya: 'solar', stihiyaColor: STIH_COLOR.solar, portraitUrl: portrait('spark_tank'),     tagline: 'EQUILIBRIUM — shields + immunity.' },
  { id: 'spark_captain',  name: 'SOLARLORD',   race: 'spark', role: 'captain', stihiya: 'solar', stihiyaColor: STIH_COLOR.solar, portraitUrl: portrait('spark_captain'),  tagline: 'ETERNAL DAWN — heal + shields + solar field.' },
];

// Showcase = first hero from each race (5 total) for compact home grid.
export const FEATURED_HEROES: HeroMeta[] = [
  HEROES.find(h => h.id === 'pirate_warrior')!,
  HEROES.find(h => h.id === 'rock_captain')!,
  HEROES.find(h => h.id === 'shark_mage')!,
  HEROES.find(h => h.id === 'crocodile_warrior')!,
  HEROES.find(h => h.id === 'spark_captain')!,
];
