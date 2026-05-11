// 2026-05-11 — TASK-008 (T1.07): monetization constants relocated from legacy.
//
// Sacred per CLAUDE.md §2.4: GEM_PACKS price ladder
//   $0.99 → $4.99 → $9.99 (+10%) → $19.99 (+15%) → $49.99 (+20% MEGA) → $99.99 (+30% WHALE)
// Byte-perfect, every entry preserved.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - GEM_PACKS            line 22894-22901
//   - MONETIZATION         line 18735-18787  (parent config that scalar consts
//                                              like PACK_BIG_GEMS_COST read)
//   - HERO_CARD_PACKS      line 29659-29717
//   - MYTHIC_PASS          line 29750-29766
//   - TOWER_BOOSTS         line 29769-29779
//   - COSMETIC_TIER_PACKS  line 29782-29800
//   - RESOURCE_PACKS       line 29803-29818
//
// Per T1.07 task spec, shop pack consolidation lives in T1.18. Multiple
// PACK_* exports stay separate here — we relocate as-is.
//
// Constants NOT extracted (deferred to T1.10 or T1.18):
//   - SEASON_FREE_TRACK / SEASON_PREMIUM_TRACK / SEASON_XP / SEASON_CONFIG
//     (lines 45466+) — large; defer to T1.10 with the rest of season state
//   - STARTER_PACK_* / TOWER_CLIMBER_PACK_* / MEGA_BUFF_* etc. (lines
//     34276-34555, 35545-35547) — these are scalar shadows of MONETIZATION.*.
//     Once T1.10 imports MONETIZATION, those scalars become trivial accessors
//     and the consolidation can land in T1.18.
//   - WHALE_OFFERINGS / DOLPHIN_OFFERINGS / MINNOW_OFFERINGS / PRICING_TIERS /
//     REGIONAL_PRICING / LOOT_BOX_RATES (P7 segment configs lines 45635-45929)
//     — these are large pure-literal blocks but they're tightly coupled to
//     P7 player-segment logic that ships in T1.20. Flagged for that task.

// SACRED per CLAUDE.md §2.4 — price ladder $0.99 → $99.99 unchanged.
export const GEM_PACKS = Object.freeze([
  Object.freeze({ id: 'gems_99',    price:  0.99, baseGems:   100, bonusGems:    0, badge: null,            glow: '#7DC3FF' }),
  Object.freeze({ id: 'gems_499',   price:  4.99, baseGems:   500, bonusGems:    0, badge: null,            glow: '#7DC3FF' }),
  Object.freeze({ id: 'gems_999',   price:  9.99, baseGems:  1000, bonusGems:  100, badge: '+10%',          glow: '#5DCA79' }),
  Object.freeze({ id: 'gems_1999',  price: 19.99, baseGems:  2000, bonusGems:  300, badge: '+15%',          glow: '#FFD53D' }),
  Object.freeze({ id: 'gems_4999',  price: 49.99, baseGems:  5000, bonusGems: 1000, badge: '+20% MEGA',     glow: '#FFAA00' }),
  Object.freeze({ id: 'gems_9999',  price: 99.99, baseGems: 10000, bonusGems: 3000, badge: '+30% WHALE',    glow: '#BB60FF' }),
]);

export const MONETIZATION = Object.freeze({
  packs: Object.freeze({
    standard: Object.freeze({ gold: 500 }),
    race:     Object.freeze({ gold: 1500, count: 5 }),
    big:      Object.freeze({ gold: 5000, gems: 500, cards: 10, t2Stones: 1 }),
    premium:  Object.freeze({ gems: 500, cards: 10, t2Stones: 1, t3Chance: 0.05,
                              goldBonus: 50, essenceBonus: 5 }),
    ultimate: Object.freeze({ gems: 1100, cards: 25, t2Stones: 2, t3Stones: 1,
                              goldBonus: 100, essenceBonus: 20, dropBoostDays: 7 }),
    // SHOP.2 — Starter Pack (Day 4-14 only, one-shot per install). Heavy F2P→P
    // conversion lever per PRELAUNCH §11.5. Founder badge is permanent profile cosmetic.
    starter: Object.freeze({ usd: 2.99, captains: 1, gems: 500, cards: 25, t2Stones: 1,
                             gold: 5000, badge: 'founder', minDay: 4, maxDay: 14 }),
    // SHOP.6 — Race Launch Bundle. Spec drop $19.99 → $14.99 + race-exclusive
    // banner cosmetic (not buyable separately). Conditional hide when race
    // already F2P-unlocked.
    raceBundle: Object.freeze({ usd: 14.99, gems: 1500, cardsPerHero: 1,
                                essence: 10, captainLv: 5, banner: 'race_banner' }),
    // Phase 9 — Chapter Unlock Pack (PRELAUNCH §8.3 T+0 monetization wedge).
    // Available 3-day window after each chapter drops via CONTENT.3 engine.
    // Designed to ride emotional spike of new content launch.
    chapterUnlock: Object.freeze({ usd: 9.99, gems: 1100, cards: 50, t2Stones: 5,
                                   gold: 1000, durationMs: 3 * 24 * 60 * 60 * 1000 })
  }),
  pity: Object.freeze({
    threshold: 30, premiumDropBoost: 1.30,
    // SHOP.3 — separate T3 pity tracker for Premium-pack streaks (per spec
    // "T3 Stone has separate pity tracker (Premium pack)").
    t3Threshold: 50
  }),
  buffs: Object.freeze({
    mega:       Object.freeze({ usd: 1.99, gems: 200, durationMs: 24*60*60*1000,
                                goldMult: 1.25, fragMult: 1.50 }),
    squadBoost: Object.freeze({ usd: 4.99, gems: 500, cooldownMs: 24*60*60*1000, levels: 1 }),
    // SHOP.7 — Gold Rush 24h. Replaces Squad Level Boost in shop UI.
    // Stacks MULTIPLICATIVELY with Mega Buff (verify: 1.25 × 2.0 = 2.5×).
    // Includes 1 free Tower retry — Phase 6 TOWER.5 reads this flag.
    goldRush:   Object.freeze({ usd: 4.99, gems: 500, durationMs: 24*60*60*1000,
                                cooldownMs: 24*60*60*1000,
                                goldMult: 2.00, essenceMult: 1.50, freeTowerRetries: 1 }),
    squadPower: Object.freeze({ usd: 9.99, gems: 1100, t2: 3, cards: 25, gold: 1000,
                                essencePer: 20 })
  }),
  firstPurchase: Object.freeze({ freeBuffMs: 7*24*60*60*1000 }),
  // SHOP.1 — Progressive shop reveal (PRELAUNCH §11.5). Day 1-3 hidden,
  // Day 4-6 disabled with "Day 7" tooltip, Day 7+ full shop. accountAge
  // measured via _daysSinceFirstLaunch helper.
  shopReveal: Object.freeze({
    minDayHidden:   0,   // Day 0-3 → button hidden
    minDayDisabled: 4,   // Day 4-6 → button disabled
    minDayEnabled:  7    // Day 7+  → full access
  })
});

// 2026-05-02 — COMBAT v2.1 P5 §5.2.1: 7 hero-card pack SKUs.
// 1 starter (gold), 5 race-specific (gold), 1 IAP-deferred premium.
export const HERO_CARD_PACKS = Object.freeze({
  starter: Object.freeze({
    id: 'starter',
    name: 'STARTER CARD PACK',
    cost: Object.freeze({ gold: 200 }),
    contents: Object.freeze({ cards: 5, guaranteedRare: false }),
    pity: Object.freeze({ drawsToGuarantee: 10 }),
    description: 'Random hero cards. Pity: T2 stone every 10 packs.',
  }),
  pirate: Object.freeze({
    id: 'pirate',
    name: 'PIRATE FLEET PACK',
    cost: Object.freeze({ gold: 400 }),
    contents: Object.freeze({ cards: 5, raceFilter: 'pirate', guaranteedRare: true }),
    pity: Object.freeze({ drawsToGuarantee: 5 }),
    description: '5 pirate hero cards. Guaranteed rare every 5 packs.',
  }),
  rock: Object.freeze({
    id: 'rock',
    name: 'ROCK BAND PACK',
    cost: Object.freeze({ gold: 400 }),
    contents: Object.freeze({ cards: 5, raceFilter: 'rock', guaranteedRare: true }),
    pity: Object.freeze({ drawsToGuarantee: 5 }),
    description: '5 rock band hero cards. Guaranteed rare every 5 packs.',
  }),
  shark: Object.freeze({
    id: 'shark',
    name: 'SHARKS PACK',
    cost: Object.freeze({ gold: 400 }),
    contents: Object.freeze({ cards: 5, raceFilter: 'shark', guaranteedRare: true }),
    pity: Object.freeze({ drawsToGuarantee: 5 }),
    description: '5 sharks hero cards. Guaranteed rare every 5 packs.',
  }),
  crocodile: Object.freeze({
    id: 'crocodile',
    name: 'CROCODILES PACK',
    cost: Object.freeze({ gold: 400 }),
    contents: Object.freeze({ cards: 5, raceFilter: 'crocodile', guaranteedRare: true }),
    pity: Object.freeze({ drawsToGuarantee: 5 }),
    description: '5 crocodiles hero cards. Guaranteed rare every 5 packs.',
  }),
  spark: Object.freeze({
    id: 'spark',
    name: 'SPARKS PACK',
    cost: Object.freeze({ gold: 400 }),
    contents: Object.freeze({ cards: 5, raceFilter: 'spark', guaranteedRare: true }),
    pity: Object.freeze({ drawsToGuarantee: 5 }),
    description: '5 sparks hero cards. Guaranteed rare every 5 packs.',
  }),
  // Real-currency variant — IAP wired in v2.2 once App Store products registered.
  premium_iap: Object.freeze({
    id: 'premium_iap',
    name: 'GUARANTEED RARE',
    cost: Object.freeze({ realCurrency: '$2.99', productId: 'com.blocksworn.pack_guaranteed_rare' }),
    contents: Object.freeze({ cards: 10, guaranteedRare: true, guaranteedHero: true }),
    description: '10 cards · Guaranteed hero unlock + rare drop.',
    deferred: true,    // v2.2 IAP wire-up
  }),
});

// 2026-05-02 — COMBAT v2.1 P5 §5.2.3: Mythic Pass monthly subscription.
// Real-currency only. Wires to RevenueCat in v2.2.
export const MYTHIC_PASS = Object.freeze({
  monthly: Object.freeze({
    id: 'mythic_pass_monthly',
    name: 'MYTHIC PASS',
    cost: Object.freeze({ realCurrency: '$14.99/month', productId: 'com.blocksworn.mythic_pass_monthly' }),
    benefits: Object.freeze({
      legendaryStones: 1,
      mythicResetOption: 1,
      towerXPBoost: 1.50,
      cosmeticPortrait: 'mythic_aura',
      bonusDailyXP: 25,
    }),
    description: 'Premium ascension support + 1 Mythic reset per month',
    note: 'Mythic Pass does NOT grant Mythic ability for free. Earn vs pay parity preserved.',
    deferred: true,
  }),
});

// 2026-05-02 — COMBAT v2.1 P5 §5.2.4: Tower seasonal boosts.
export const TOWER_BOOSTS = Object.freeze({
  seasonal_xp: Object.freeze({
    id: 'tower_xp_seasonal',
    name: 'TOWER XP BOOST',
    cost: Object.freeze({ realCurrency: '$4.99/season', productId: 'com.blocksworn.tower_xp_boost_seasonal' }),
    benefits: Object.freeze({ towerXPMult: 2.00 }),
    duration: 'until season end',
    description: '×2 XP from Tower battles for the entire season',
    deferred: true,
  }),
});

// 2026-05-02 — COMBAT v2.1 P5 §5.2.5: cosmetic tier visuals.
export const COSMETIC_TIER_PACKS = Object.freeze({
  thorgar_mythic_aura: Object.freeze({
    id: 'thorgar_mythic_aura',
    name: 'THORGAR MYTHIC AURA',
    cost: Object.freeze({ realCurrency: '$2.99', productId: 'com.blocksworn.cosmetic_thorgar_mythic_aura' }),
    benefits: Object.freeze({ cosmetic: 'mythic_aura', heroId: 'pirate_warrior' }),
    description: 'Permanent gold aura on Thorgar (cosmetic only, no stat change)',
    requires: 'Thorgar at Mythic tier',
    deferred: true,
  }),
  pirate_fleet_skin: Object.freeze({
    id: 'pirate_fleet_skin',
    name: 'CRIMSON FLEET SKIN PACK',
    cost: Object.freeze({ realCurrency: '$7.99', productId: 'com.blocksworn.cosmetic_pirate_fleet_skin' }),
    benefits: Object.freeze({ cosmetic: 'crimson_fleet', heroIds: Object.freeze(['pirate_warrior', 'pirate_hunter', 'pirate_mage', 'pirate_tank', 'pirate_captain']) }),
    description: 'Alternate art for all 5 pirate heroes',
    deferred: true,
  }),
});

// 2026-05-02 — COMBAT v2.1 P5 §5.1: resource convenience packs (gold paths).
export const RESOURCE_PACKS = Object.freeze({
  gold_500: Object.freeze({
    id: 'gold_500', name: '+500 GOLD',
    cost: Object.freeze({ realCurrency: '$0.99', productId: 'com.blocksworn.gold_500' }),
    grants: Object.freeze({ gold: 500 }),
    description: 'Spendable gold currency',
    deferred: true,
  }),
  essence_bundle: Object.freeze({
    id: 'essence_bundle', name: 'ESSENCE BUNDLE',
    cost: Object.freeze({ realCurrency: '$2.99', productId: 'com.blocksworn.essence_bundle' }),
    grants: Object.freeze({ essence: Object.freeze({ ember: 25, tide: 25, grove: 25, solar: 25, umbra: 25 }) }),
    description: '+25 of each elemental essence',
    deferred: true,
  }),
});
