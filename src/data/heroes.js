// 2026-05-11 — TASK-008 (T1.07): hero-side data constants relocated from legacy.
//
// Sacred per CLAUDE.md §2.1: HERO_ULT_COST_BY_NEWROLE values
// (warrior:80, mage:100, hunter:120, tank:80, captain:100) — byte-perfect.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - HERO_ULT_COST_BY_NEWROLE  lines 40024-40030
//   - HERO_TIER_ABILITIES       lines 68398-68574
//
// HERO_ROSTER (line 21010, 25 heroes) is NOT extracted: each entry binds
// runtime fire / ult / ultSignature / fireTierDelta / ultTierDelta function
// references (e.g., `fire: fireThorgar`). Per T1.07 Step E ("intertwined with
// logic"), this is deferred to T1.10 / T1.11 when the fire/ult helpers
// themselves migrate. Same applies to HERO_BIOS (richly templated copy) and
// HERO_MYTHIC_RUNTIME (state object).
//
// ROLE_DESC is declared inside the info-modal builder function body (line 60033)
// so it isn't top-level — also deferred per Step E.

// HOTFIX B3.3 — per-role ULT cost (Roman spec). Cheaper for warrior/tank (frequent
// utility); standard for mage/captain; expensive for hunter (payoff detonator).
export const HERO_ULT_COST_BY_NEWROLE = Object.freeze({
  warrior: 80,
  mage:    100,
  hunter:  120,
  tank:    80,
  captain: 100,
});

// 2026-05-02 — COMBAT v2.1 P3 §11.3: per-hero tier ability descriptors.
// PR #3.F renders this in Hero Detail Modal Tier Abilities panel.
// Per-hero fire/ult function references stay in HERO_ROSTER unchanged —
// HERO_TIER_ABILITIES is descriptive metadata only.
export const HERO_TIER_ABILITIES = Object.freeze({
  pirate_warrior: Object.freeze({
    t0:     Object.freeze({ name: 'CLEAVER FORGE', description: 'Spawn 5 charged ember + FLEET bonus' }),
    t1:     Object.freeze({ name: 'EMBER FORGE+', description: '+2 ember cells; 25% chance one is charged' }),
    t2:     Object.freeze({ name: 'STAGGER FORGE', description: 'On Stagger entry: 5 latest spawned cells → charged', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'EMBER PRESSURE', description: 'Ember line clears → +5 bonus Pressure', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'EVERLASTING FORGE', description: 'Spawned cells permanently boost boss damage taken (+5%/cell, max 30%)', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  pirate_hunter: Object.freeze({
    t0:     Object.freeze({ name: 'SPARKSHOT', description: 'VOLLEY: 3 rows + 100 if charged hit' }),
    t1:     Object.freeze({ name: 'VOLLEY+', description: '4 rows; +15% per cube cleared' }),
    t2:     Object.freeze({ name: 'STAGGER VOLLEY', description: 'If fired during Stagger: damage doubles', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'ULT REFUND', description: 'Stagger entry refunds 25% Hunter ULT charge', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'CASCADE VOLLEY', description: 'After Mythic VOLLEY: next placement = forced quad clear', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  pirate_mage: Object.freeze({
    t0:     Object.freeze({ name: 'EMBER BLOOM', description: 'MENDING: full heal + +1 ULT to all' }),
    t1:     Object.freeze({ name: 'MENDING+', description: '+20% squad damage on next 3 placements' }),
    t2:     Object.freeze({ name: 'STAGGER MENDING', description: 'Mage fire during Stagger extends window +2 turns', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'PRESSURE WEAVER', description: 'Pressure builds ×1.25 while Mage in squad', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'PRE-IGNITION', description: 'Pre-charge Stagger to 50% at battle start (1×/battle)', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  pirate_tank: Object.freeze({
    t0:     Object.freeze({ name: 'FIREBRAND', description: 'AEGIS: +3 shields + 3 charged ember' }),
    t1:     Object.freeze({ name: 'AEGIS BOND', description: 'Damage→Pressure ratio 1.2:1 (was 1.0)' }),
    t2:     Object.freeze({ name: 'LOW HP REFLEX', description: 'At HP ≤ 50%: mitigation ×2 + 1 free shield', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'AEGIS PROTOCOL', description: '3-turn window: ALL incoming damage converts to Pressure (no HP loss)', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'CRIMSON STAND', description: 'Stagger entry → squad +30% damage during full Stagger duration', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  pirate_captain: Object.freeze({
    t0:     Object.freeze({ name: 'CAPTAIN\'S GAMBIT', description: 'DOMINION: 10 cells + 50% charged spawn' }),
    t1:     Object.freeze({ name: 'MARK SYSTEM', description: 'Race buff +25% + per-turn Mark (marked hero next fire = +30% dmg + +10 Pressure)' }),
    t2:     Object.freeze({ name: 'MARK STAGGER', description: 'Marked hero fire extends Stagger window +1 turn each (Stagger only)', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'UNIVERSAL MARK', description: 'Mark works on ANY squad action (shields, rows, buffs)', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'THRESHOLD MASTER', description: 'Pre-set Stagger trigger threshold 50/75/100 at battle start', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  rock_warrior: Object.freeze({
    t0:     Object.freeze({ name: 'RIFF SEED', description: 'RIFF FORGE: spawn 6 umbra (+4 if Encore primed)' }),
    t1:     Object.freeze({ name: 'ENCORE+', description: '+2 umbra cells; +20% Encore chance per spawn' }),
    t2:     Object.freeze({ name: 'STAGGER ENCORE', description: 'On Stagger entry: encore-ready cells → instant charged', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'UMBRA ENCORE', description: 'Umbra clears during Encore: +8 bonus Pressure', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'ETERNAL ENCORE', description: 'Encore stacks permanently (caps at +10 per fight, +30% boss dmg taken)', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  rock_hunter: Object.freeze({
    t0:     Object.freeze({ name: 'PIERCING SHRIEK', description: 'VOLLEY echo on next placement' }),
    t1:     Object.freeze({ name: 'ECHO VOLLEY+', description: '4 rows; +DEEP BEAT bonus from Mage' }),
    t2:     Object.freeze({ name: 'STAGGER ECHO', description: 'Stagger fires: +3 echo placements (was 1)', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'ULT REFUND+', description: 'Stagger entry refunds 30% Hunter ULT (vs 25%)', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'BOARD ECHO', description: 'Echo VOLLEY ricochets across entire board (forced double-quad)', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  rock_mage: Object.freeze({
    t0:     Object.freeze({ name: 'DEEP BEAT', description: 'MENDING + 3-placement umbra +20%' }),
    t1:     Object.freeze({ name: 'DEEP BEAT+', description: 'DEEP BEAT stacks last 2 placements (was 1)' }),
    t2:     Object.freeze({ name: 'STAGGER BEAT', description: 'Stagger fire: +3 turn extension (vs +2)', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'PRESSURE BEAT', description: 'Pressure builds ×1.30 while Mage in squad', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'OPENING BEAT', description: 'Pre-charge to 60% (vs 50%) at battle start', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  rock_tank: Object.freeze({
    t0:     Object.freeze({ name: 'DRUMHEAD', description: 'AEGIS + free Rhythm proc' }),
    t1:     Object.freeze({ name: 'RHYTHM BOND', description: 'Damage→Pressure 1.2:1 + free Rhythm proc' }),
    t2:     Object.freeze({ name: 'LOW HP RHYTHM', description: 'At HP ≤ 50%: mitigation ×2 + 2 shields (vs 1)', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'AEGIS PROTOCOL+', description: '4-turn window (vs 3) of damage→pressure', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'RHYTHM STAND', description: 'Stagger entry → squad +35% damage (vs 30%) full Stagger', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  rock_captain: Object.freeze({
    t0:     Object.freeze({ name: 'CONDUCT THE DARK', description: 'DOMINION + immediate Encore' }),
    t1:     Object.freeze({ name: 'ENCORE MARK', description: 'Race buff +25% + Mark + immediate Encore on mark' }),
    t2:     Object.freeze({ name: 'MARK ENCORE STAGGER', description: 'Marked Encore extends Stagger +2 turns (vs +1)', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'ENCORE UNIVERSAL', description: 'Mark works on Encore + race procs', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'AGGRESSIVE THRESHOLD', description: 'Pre-set threshold 50/60/75 (more aggressive options)', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  shark_warrior: Object.freeze({
    t0:     Object.freeze({ name: 'TIDE SEED', description: 'TIDE FORGE: spawn 6 tide cells' }),
    t1:     Object.freeze({ name: 'TIDE CHAIN+', description: '+2 tide cells; +1 chain segment per tide clear' }),
    t2:     Object.freeze({ name: 'STAGGER CHAIN', description: 'On Stagger entry: chain segments × 2', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'TIDE PRESSURE', description: 'Tide chain clears → +10 bonus Pressure (vs +5)', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'PERMANENT FREEZE', description: 'Permanent freeze field (8% boss dmg taken, lasting)', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  shark_hunter: Object.freeze({
    t0:     Object.freeze({ name: 'SHATTER VOLLEY', description: 'VOLLEY: chain rows' }),
    t1:     Object.freeze({ name: 'CHAIN VOLLEY+', description: '4 rows; chain rows linked' }),
    t2:     Object.freeze({ name: 'STAGGER CHAIN VOLLEY', description: 'Stagger fire: chain ALL rows on board', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'ULT REFUND + FREEZE', description: 'Stagger entry refunds 25% + 1 free freeze', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'CHAIN FREEZE', description: 'Chain freezes boss for 2 turns (skip boss attack twice)', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  shark_mage: Object.freeze({
    t0:     Object.freeze({ name: 'TIDE WEAVE', description: 'MENDING: freeze attack' }),
    t1:     Object.freeze({ name: 'MENDING + FREEZE', description: '+20% squad damage + freeze 1 attack' }),
    t2:     Object.freeze({ name: 'STAGGER FREEZE', description: 'Stagger fire: extend +2t + permanent freeze on 1 boss attack', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'PRESSURE FREEZE', description: 'Pressure builds ×1.25 + frozen damage tracking', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'OPENING FREEZE', description: 'Pre-charge 50% + first attack of fight auto-frozen', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  shark_tank: Object.freeze({
    t0:     Object.freeze({ name: 'TOCK GUARD', description: 'AEGIS: refund placement' }),
    t1:     Object.freeze({ name: 'TIDE BOND', description: 'AEGIS + refund placement + 1.2:1 conversion' }),
    t2:     Object.freeze({ name: 'LOW HP REFUND', description: 'At HP ≤ 50%: mitigation ×2 + refund last placement', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'AEGIS PROTOCOL TIDE', description: '3 turns + frozen ward (no boss attacks during)', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'TIDE STAND', description: 'Stagger entry → all squad +30% + boss frozen 2t', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  shark_captain: Object.freeze({
    t0:     Object.freeze({ name: 'DEEP TIDE', description: 'DOMINION: chill board' }),
    t1:     Object.freeze({ name: 'CHILL MARK', description: 'Race buff +25% + Mark + chill aura on mark' }),
    t2:     Object.freeze({ name: 'MARK CHILL STAGGER', description: 'Marked chill extends Stagger +1t + chills 2 cells', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'UNIVERSAL CHILL', description: 'Mark on freeze procs (universal cold synergy)', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'OCEANIC THRESHOLD', description: 'Pre-set threshold 50/75/100 + initial board chill', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  crocodile_warrior: Object.freeze({
    t0:     Object.freeze({ name: 'BEDROCK FORGE', description: 'BEDROCK BASTION: all empties → earth absorbers' }),
    t1:     Object.freeze({ name: 'EARTH FORGE+', description: '+2 grove cells; spawn 1 earth absorber adjacent' }),
    t2:     Object.freeze({ name: 'STAGGER QUAKE', description: 'On Stagger entry: all earth absorbers detonate together', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'EARTH PRESSURE', description: 'Earth absorber clears → +6 bonus Pressure', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'IRON FORTRESS', description: 'Permanent earth fortress (5 absorbers persist battle-long)', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  crocodile_hunter: Object.freeze({
    t0:     Object.freeze({ name: 'VENGEANCE SLAM', description: 'QUAKE: ×3 absorbed dmg' }),
    t1:     Object.freeze({ name: 'QUAKE+', description: 'QUAKE ×3.5 absorbed + AoE bonus' }),
    t2:     Object.freeze({ name: 'STAGGER QUAKE BOARD', description: 'Stagger fire: detonate quake on entire board', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'ULT REFUND + QUAKE', description: 'Stagger entry refunds 25% + 1 free QUAKE', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'CHAIN QUAKE', description: 'Mythic QUAKE chains to all earth absorbers across save', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  crocodile_mage: Object.freeze({
    t0:     Object.freeze({ name: 'VERDANT SURGE', description: 'SURGE: shields → damage' }),
    t1:     Object.freeze({ name: 'SURGE+', description: 'SURGE: shields → damage + 25% squad mult' }),
    t2:     Object.freeze({ name: 'STAGGER SURGE', description: 'Stagger fire: extend +2t + +1 shield to all', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'PRESSURE SHIELD', description: 'Pressure builds ×1.25 + 5% per shield held', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'OPENING BASTION', description: 'Pre-charge 50% + battle starts with full shields', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  crocodile_tank: Object.freeze({
    t0:     Object.freeze({ name: 'STONE SKIN', description: 'AEGIS: full row earth' }),
    t1:     Object.freeze({ name: 'EARTH BOND', description: 'AEGIS + full row earth + 1.2:1 conversion' }),
    t2:     Object.freeze({ name: 'LOW HP IRON HIDE', description: 'At HP ≤ 50%: mitigation ×2 + 2 absorbers spawn', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'AEGIS PROTOCOL EARTH', description: '3t + Iron Hide bonus +10% mitigation', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'IRON HIDE STAND', description: 'Stagger entry → squad +30% + Iron Hide perm field', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  crocodile_captain: Object.freeze({
    t0:     Object.freeze({ name: 'ETERNAL BASTION', description: 'DOMINION: shields + earth field' }),
    t1:     Object.freeze({ name: 'EARTH MARK', description: 'Race buff +25% + Mark + earth shield on mark' }),
    t2:     Object.freeze({ name: 'MARK EARTH STAGGER', description: 'Marked earth proc extends Stagger +1t', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'UNIVERSAL EARTH', description: 'Mark on absorber detonations (universal earth synergy)', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'BASTION THRESHOLD', description: 'Pre-set threshold 50/75/100 + absorbers pre-placed', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  spark_warrior: Object.freeze({
    t0:     Object.freeze({ name: 'SUN FORGE', description: 'SUN CASCADE: spawn 5 solar cells' }),
    t1:     Object.freeze({ name: 'SOLAR FORGE+', description: '+2 solar cells; 30% chance pre-aged (instant detonate-ready)' }),
    t2:     Object.freeze({ name: 'STAGGER RADIANCE', description: 'On Stagger entry: all solar cells become radiant', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'SOLAR PRESSURE', description: 'Solar detonate clears → +7 bonus Pressure', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'STATIC FIELD', description: 'Permanent Static Field (10 dmg/turn to boss, lasting)', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  spark_hunter: Object.freeze({
    t0:     Object.freeze({ name: 'AURORA BURST', description: 'BURST: shields → damage (no consume)' }),
    t1:     Object.freeze({ name: 'BURST+', description: 'BURST: +50% bonus + 1 row per shield' }),
    t2:     Object.freeze({ name: 'STAGGER BURST', description: 'Stagger fire: shields ×2 to dmg conversion', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'ULT REFUND + BURST', description: 'Stagger entry refunds 30% + 1 free BURST', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'BURST OVERLOAD', description: 'Mythic BURST: convert shields × 5 dmg (1 shield = burst row)', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  spark_mage: Object.freeze({
    t0:     Object.freeze({ name: 'HALO WINDOW', description: 'HALO: double shields' }),
    t1:     Object.freeze({ name: 'HALO+', description: 'HALO: double shields + 20% squad dmg next 3' }),
    t2:     Object.freeze({ name: 'STAGGER HALO', description: 'Stagger fire: extend +2t + halo prevents 1 boss hit', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'PRESSURE SHIELD+', description: 'Pressure builds ×1.30 + +1 shield per Stagger', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'OPENING DAWN', description: 'Pre-charge 50% + battle starts with +5 shields', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  spark_tank: Object.freeze({
    t0:     Object.freeze({ name: 'SUN GUARD', description: 'EQUILIBRIUM: shields + immunity' }),
    t1:     Object.freeze({ name: 'SUN BOND', description: 'AEGIS + immunity + 1.2:1 conversion' }),
    t2:     Object.freeze({ name: 'LOW HP IMMUNITY', description: 'At HP ≤ 50%: mitigation ×2 + 1 turn full immune', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'AEGIS PROTOCOL SUN', description: '4-turn (vs 3) + sun aura', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'SUN STAND', description: 'Stagger entry → squad +35% + sun aura 5 turns post-Stagger', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
  spark_captain: Object.freeze({
    t0:     Object.freeze({ name: 'ETERNAL DAWN', description: 'DOMINION: heal + shields + solar cells' }),
    t1:     Object.freeze({ name: 'DAWN MARK', description: 'Race buff +25% + Mark + heal+shield on mark' }),
    t2:     Object.freeze({ name: 'MARK DAWN STAGGER', description: 'Marked heal/shield extends Stagger +2t', cost: '5 cards + 1 stone + 200g + 5 essence' }),
    t3:     Object.freeze({ name: 'UNIVERSAL DAWN', description: 'Mark on shield gain + sun events', cost: '10 cards + 1 stone + 500g + 10 essence' }),
    mythic: Object.freeze({ name: 'DAWN THRESHOLD', description: 'Pre-set threshold 50/75/100 + Eternal Dawn pre-cast', cost: '25 cards + 1 legendary stone + 1000g + 20 essence' }),
  }),
});
