// 2026-05-11 — TASK-008 (T1.07): race / synergy constants relocated from legacy.
//
// Sacred per CLAUDE.md §2.1: RACE_SYNERGY 2x/3x/5x bonuses preserved byte-perfect.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - RACES           line 38286
//   - STIHIYA_TO_RACE line 38288
//   - RACE_TO_STIHIYA line 53844
//   - RACE_SYNERGY    line 53863
//
// STIHIYA_TO_RACES_ALL (line 38290) is also pure literal but is bundled here
// since it shares the race/element lookup surface.

export const RACES = Object.freeze([
  'orc', 'elf', 'troll', 'human', 'dark_elf', 'pirate', 'skeleton', 'golem', 'lion', 'rock',
]);

// Primary race per stihiya (used by boss drop as fallback; see STIHIYA_TO_RACES_ALL for random pick).
export const STIHIYA_TO_RACE = Object.freeze({
  ember: 'orc', tide: 'elf', grove: 'troll', solar: 'human', umbra: 'dark_elf',
});

export const RACE_TO_STIHIYA = Object.freeze({
  orc: 'ember', troll: 'grove', human: 'solar', dark_elf: 'umbra', elf: 'tide',
  // V18.8: NEW RACES
  pirate: 'ember', skeleton: 'tide', golem: 'grove', lion: 'solar', rock: 'umbra',
  // 2026-04-28 — Phase D Race Launch Bundles need these (shark/crocodile/spark
  // race entries weren't here pre-Phase-D; merged from removed duplicate).
  shark: 'tide', crocodile: 'grove', spark: 'solar',
});

// V18.8: RACE_SYNERGY — per-race thematic bonuses at tiers 2/3/5. Each race has a distinct
// archetype that leans on different state fields. Effect schema:
//   hp, shields: flat additive
//   dmgMult: additive global damage multiplier (+0.10 = +10%)
//   ultMinus: { stihiya: N } — subtract N from that stihiya's ULT threshold (min cap 4)
//   passiveMult: { stihiya: N } — additive passive dmg mult for that stihiya (+0.25 = +25%)
//   startCharge: { stihiya: fraction } — starting ULT charge as fraction of threshold (max-merged)
//   spawnWeight: { stihiya: N } — additional spawn weight (stacks with base race-affinity)
//   bonusDmg: { stihiya: N } — +flat bonus damage per cleared cell of that stihiya
// tier 2 = count >= 2, tier 3 = count >= 3, tier 5 = count >= 5 (higher tier supersedes lower).
export const RACE_SYNERGY = Object.freeze({
  // === ORIGINAL 5 RACES ===
  // V2.0 Block 2.1: ORC redesigned as BERSERKER — bloodEmber, bloodrage, unbroken (risk/reward motif)
  orc: Object.freeze({ flavor: 'BERSERKER · ember',
    2: Object.freeze({ hp: 1, bloodEmber: true,
         desc: '+1 HP · BLOODEMBER: ×1.5 🔥 bonus at 1 HP' }),
    3: Object.freeze({ hp: 1, shields: 1, dmgMult: 0.10, bloodEmber: true, bloodrage: true,
         desc: '+1HP · +1🛡 · +10% dmg · BLOODRAGE (once/battle at 1 HP: all 🔥 → charged)' }),
    5: Object.freeze({ hp: 2, shields: 2, dmgMult: 0.25, bonusDmg: Object.freeze({ ember: 5 }),
         bloodEmber: true, bloodrage: true, unbroken: true,
         ultMinus: Object.freeze({ ember: 2 }),
         desc: '+2HP · +2🛡 · +25% dmg · +5🔥/cell · UNBROKEN (+20 dmg/charged at 1 HP) · −2 🔥ULT' }) }),
  // V2.0 Block 2.2: ELF redesigned as GLACIAL — chain window, frost echo, first frost, glacial mastery
  elf: Object.freeze({ flavor: 'GLACIAL · tide',
    2: Object.freeze({ hp: 1, ultMinus: Object.freeze({ tide: 2 }), glacialMemory: true,
         desc: '+1 HP · −2 🌊ULT · GLACIAL MEMORY (chain window 3)' }),
    3: Object.freeze({ hp: 1, dmgMult: 0.10, ultMinus: Object.freeze({ tide: 2 }),
         glacialMemory: true, frostEcho: true,
         desc: '+1HP · +10% dmg · −2 🌊ULT · FROST ECHO (+dmg per tide line)' }),
    5: Object.freeze({ hp: 2, shields: 1, ultMinus: Object.freeze({ tide: 4 }),
         startCharge: Object.freeze({ tide: 0.25 }), passiveMult: Object.freeze({ tide: 0.15 }),
         glacialMemory: true, frostEcho: true, firstFrost: true, glacialMastery: true,
         desc: '+2HP · +1🛡 · −4 🌊ULT · 25% 🌊 start · +15% 🌊 · FIRST FROST · MASTERY (cap 15)' }) }),
  // V2.0 Block 2.3: TROLL redesigned as STONEBLOOD — HP-heavy, bloom accelerator, full-HP damage boost
  troll: Object.freeze({ flavor: 'STONEBLOOD · grove',
    2: Object.freeze({ hp: 2, regrowth: true,
         desc: '+2 HP · REGROWTH (blooms ripen in 1 turn)' }),
    3: Object.freeze({ hp: 2, shields: 1, dmgMult: 0.10,
         regrowth: true, stoneblood: true,
         desc: '+2HP · +1🛡 · +10% dmg · STONEBLOOD (+20% dmg at full HP)' }),
    5: Object.freeze({ hp: 3, shields: 2, dmgMult: 0.15,
         regrowth: true, stoneblood: true, mossArmor: true, heartwood: true,
         desc: '+3HP · +2🛡 · +15% dmg · REGROWTH · STONEBLOOD · MOSS ARMOR · HEARTWOOD (+2 HP blooms)' }) }),
  // V2.0 Block 2.4: HUMAN redesigned as BLESSED — radiant chance booster, team enabler
  human: Object.freeze({ flavor: 'BLESSED · solar',
    2: Object.freeze({ hp: 1, dmgMult: 0.05, divineInsight: true,
         desc: '+1 HP · +5% dmg · DIVINE INSIGHT (radiant 15%)' }),
    3: Object.freeze({ hp: 1, shields: 1, dmgMult: 0.10,
         divineInsight: true, blessedAim: true,
         desc: '+1HP · +1🛡 · +10% dmg · DIVINE INSIGHT · BLESSED AIM (guarantee 5)' }),
    5: Object.freeze({ hp: 2, shields: 2, dmgMult: 0.20,
         startCharge: Object.freeze({ solar: 0.25 }),
         passiveMult: Object.freeze({ solar: 0.10 }),
         bonusDmg: Object.freeze({ solar: 1 }),
         divineInsight: true, blessedAim: true, consecration: true, haloChain: true,
         desc: '+2HP · +2🛡 · +20% dmg · 25% ☀ start · +10% ☀ · +1☀/cell · CONSECRATION (20%) · HALO CHAIN' }) }),
  // V2.0 Block 2.5: DARK_ELF redesigned as VOIDCASTER — faster chains, bigger drops, richer carried bonus
  dark_elf: Object.freeze({ flavor: 'VOIDCASTER · umbra',
    2: Object.freeze({ hp: 1, ultMinus: Object.freeze({ umbra: 2 }), passiveMult: Object.freeze({ umbra: 0.10 }),
         desc: '+1 HP · −2 🌑ULT · +10% 🌑dmg' }),
    3: Object.freeze({ hp: 1, dmgMult: 0.10, ultMinus: Object.freeze({ umbra: 3 }), passiveMult: Object.freeze({ umbra: 0.10 }),
         voidSiphon: true,
         desc: '+1HP · +10% dmg · −3 🌑ULT · +10% 🌑 · VOID SIPHON (chain every 4)' }),
    5: Object.freeze({ hp: 2, shields: 1, ultMinus: Object.freeze({ umbra: 6 }), passiveMult: Object.freeze({ umbra: 0.35 }),
         startCharge: Object.freeze({ umbra: 0.50 }),
         voidSiphon: true, voidHarvest: true, endlessNight: true,
         desc: '+2HP · +1🛡 · −6 🌑ULT · +35% 🌑 · 50% 🌑 start · VOID SIPHON · VOID HARVEST (5-7 drops) · ENDLESS NIGHT (carried ×1.5, cap 15)' }) }),
  // === NEW 5 RACES (hero data arriving later) ===
  // V2.0 Block 2.1: PIRATE redesigned as PLUNDERER — flood spawns, cascade fleet, shortcut inferno
  pirate: Object.freeze({ flavor: 'PLUNDERER · ember',
    2: Object.freeze({ hp: 1, spawnWeight: Object.freeze({ ember: 1 }),
         desc: '+1 HP · more 🔥 cells spawn' }),
    3: Object.freeze({ hp: 1, spawnWeight: Object.freeze({ ember: 1.5 }), dmgMult: 0.10, plunder: true,
         desc: '+1HP · +10% dmg · 🔥 flood · PLUNDER (bonus shards drops)' }),
    5: Object.freeze({ hp: 2, shields: 1,
         spawnWeight: Object.freeze({ ember: 2.5 }),
         passiveMult: Object.freeze({ ember: 0.15 }),
         bonusDmg: Object.freeze({ ember: 5 }),
         plunder: true, cascadeFleet: true, shortcutInferno: true,
         desc: '+2HP · +1🛡 · 🔥 flood · +15% 🔥dmg · +5🔥/cell · CASCADE×2 · INFERNO@2' }) }),
  // V2.0 Block 2.2: SKELETON redesigned as UNDYING — cold vigil heal, undying chill ×1.5, death save
  skeleton: Object.freeze({ flavor: 'UNDYING · tide',
    2: Object.freeze({ hp: 1, coldVigil: true,
         desc: '+1 HP · COLD VIGIL (heal on 🌊 clear while frozen)' }),
    3: Object.freeze({ hp: 1, shields: 1, dmgMult: 0.10, passiveMult: Object.freeze({ tide: 0.10 }),
         coldVigil: true, undyingChill: true,
         desc: '+1HP · +1🛡 · +10% dmg · +10% 🌊 · UNDYING CHILL (×1.5 chain bonus)' }),
    5: Object.freeze({ hp: 2, shields: 2, dmgMult: 0.10, ultMinus: Object.freeze({ tide: 4 }),
         passiveMult: Object.freeze({ tide: 0.20 }),
         coldVigil: true, undyingChill: true, undying: true,
         desc: '+2HP · +2🛡 · +10% dmg · −4 🌊ULT · +20% 🌊 · UNDYING (save once)' }) }),
  // V2.0 Block 2.3: GOLEM redesigned as STONEWALL — shield stacker, offensive conversion, aegis save
  golem: Object.freeze({ flavor: 'STONEWALL · grove',
    2: Object.freeze({ hp: 1, shields: 1, maxShieldBonus: 1,
         desc: '+1HP · +1🛡 · +1 MAX🛡' }),
    3: Object.freeze({ hp: 1, shields: 2, dmgMult: 0.05, maxShieldBonus: 2,
         shieldFury: true,
         desc: '+1HP · +2🛡 · +2 MAX🛡 · +5% dmg · SHIELD FURY (+10%/🛡)' }),
    5: Object.freeze({ hp: 2, shields: 2, dmgMult: 0.10, maxShieldBonus: 2,
         shieldFury: true, graniteDefense: true, aegis: true, stonemason: true,
         desc: '+2HP · +2🛡 · +2 MAX🛡 · +10% dmg · SHIELD FURY · GRANITE · AEGIS · STONEMASON' }) }),
  // V2.0 Block 2.4: LION redesigned as PRIDE — solar DPS burst, detonate without radiant, team roar
  lion: Object.freeze({ flavor: 'PRIDE · solar',
    2: Object.freeze({ hp: 1, dmgMult: 0.15, prideHunt: true,
         desc: '+1 HP · +15% dmg · PRIDE HUNT (+1 ☀/cell)' }),
    3: Object.freeze({ hp: 1, shields: 1, dmgMult: 0.25,
         prideHunt: true, roar: true,
         desc: '+1HP · +1🛡 · +25% dmg · PRIDE HUNT · ROAR (first ☀ detonate: +5 charge team)' }),
    5: Object.freeze({ hp: 2, shields: 1, dmgMult: 0.25,
         startCharge: Object.freeze({ solar: 0.25 }),
         passiveMult: Object.freeze({ solar: 0.25 }),
         bonusDmg: Object.freeze({ solar: 3 }),
         prideHunt: true, roar: true, huntPack: true,
         desc: '+2HP · +1🛡 · +25% dmg · 25% ☀ start · +25% ☀ · +3☀/cell · ROAR · HUNT PACK' }) }),
  // V2.0 Block 2.5: ROCK redesigned as ENCORE — repetition specialist, double-cast ULT, echo bonus.
  // 2026-04-27 §8 grammar: ENCORE moved from tier 5 → tier 3 per plan
  // ("3+-of-race: ENCORE — ULTs fire дважды подряд"). Tier 5 still has it
  // (race-pure squad of 5 rocks remains strongest — keeps escalation).
  rock: Object.freeze({ flavor: 'ENCORE · umbra',
    2: Object.freeze({ hp: 1, dmgMult: 0.05, passiveMult: Object.freeze({ umbra: 0.15 }),
         desc: '+1 HP · +5% dmg · +15% 🌑dmg · +5% cascade chance' }),
    3: Object.freeze({ hp: 1, shields: 1, dmgMult: 0.10, passiveMult: Object.freeze({ umbra: 0.15 }),
         rhythmSection: true, encore: true,
         desc: '+1HP · +1🛡 · +10% dmg · +15% 🌑 · RHYTHM · ENCORE (first 🌑ULT ×2)' }),
    5: Object.freeze({ hp: 2, shields: 2, dmgMult: 0.15, passiveMult: Object.freeze({ umbra: 0.30 }),
         startCharge: Object.freeze({ umbra: 0.50 }),
         rhythmSection: true, encore: true, amplifier: true,
         desc: '+2HP · +2🛡 · +15% dmg · +30% 🌑 · 50% 🌑 start · RHYTHM · ENCORE · AMPLIFIER' }) }),
});

// 2026-05-12 — TASK-029 (T2.02): Identity Layer race-flavor key map.
//
// Spec: docs/design/mechanics/identity-layer.md §7.2 — "Add new optional field
// `identity_fx_key: 'plunder' | 'frenzy' | 'echo' | 'bastion' | 'cascade'` to
// the 5 V18.8 races. RACE_SYNERGY tiers UNTOUCHED."
//
// Implemented as a SIBLING export (not a property on the RACE_SYNERGY objects)
// so RACE_SYNERGY remains byte-perfect sacred per CLAUDE.md §2.1 — the audit
// table at spec §8 row "RACE_SYNERGY tier values" reads "NO" modifications.
// The consumer (`src/feel/identity-fx.js#dispatchIdentityFx`) does NOT yet
// read this map (it routes by `h.race` directly), but the field is established
// here so T2.03–T2.06 + the T2.12 Codex screen have a stable lookup surface.
//
// T2.02 ships only the pirate entry per spec §1 scope (Pirate's Plunder).
// T2.03 (2026-05-12) appends the shark entry per spec §2.2.
//   NOTE: shark has NO RACE_SYNERGY entry per ESC-02 O1 ruling (DEFER to
//   post-Phase-2 sacred-cow-EXTENSION task). The asymmetric synergy support
//   (pirate+rock have RACE_SYNERGY+Identity; shark+crocodile+spark have
//   Identity only) is intentional for Phase 2 and explicitly approved
//   (see docs/design/mechanics/identity-layer.md §10/§12).
// T2.04 (2026-05-12) appends the rock entry per spec §2.3 (Encore Echo).
//   NOTE: rock keeps its full RACE_SYNERGY tier 2/3/5 entries above
//   byte-perfect — including the sacred tier-3 `ENCORE` flag (first 🌑ULT
//   ×2). The Encore Echo identity layer fires ALONGSIDE the sacred
//   RACE_SYNERGY tier 3 ENCORE (compound synergy intentional per spec §2.3
//   field 8 stacking notes).
// T2.05 (2026-05-12) appends the crocodile entry per spec §2.4 (Bedrock Bastion).
//   NOTE: crocodile has NO RACE_SYNERGY entry per ESC-02 O1 ruling (DEFER to
//   post-Phase-2 sacred-cow-EXTENSION task). The Bedrock Bastion identity
//   layer READS `RACE_SYNERGY.golem.<tier>.maxShieldBonus` (sacred, byte-
//   perfect) ONLY to compute the squad shield-cap clamp — never writes.
//   Crocodile + Golem grove-stacked squads hit max-shield faster but the
//   sacred cap is NEVER exceeded.
// T2.06 will append the spark entry.
export const RACE_IDENTITY_FX = Object.freeze({
  pirate:    'pirate_plunder',
  shark:     'shark_frenzy',           // T2.03
  rock:      'rock_echo',              // T2.04
  crocodile: 'crocodile_bastion',      // T2.05
  // spark:     'spark_cascade',      // T2.06
});
