// 2026-05-11 — TASK-008 (T1.07): monetization constants relocated from legacy.
// 2026-05-12 — TASK-025 (T1.18): SHOP_PACKS consolidates scalar shadows.
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
//   - IAP_PRODUCT_IDS      line 37692-37710
//
// T1.18 SHOP_PACKS unifies scalar shadows (STARTER_PACK_*, TOWER_CLIMBER_PACK_*,
// MEGA_BUFF_*, PACK_BIG_*, PACK_PREMIUM_*, PACK_ULTIMATE_*, PACK_STANDARD_*,
// PACK_RACE_*, SEASON_PASS_SUB_*) into one frozen registry that REFERENCES
// canonical MONETIZATION.* values — single source of truth, no duplication.
//
// Constants NOT extracted (deferred to T1.10 or T1.20):
//   - SEASON_FREE_TRACK / SEASON_PREMIUM_TRACK / SEASON_XP / SEASON_CONFIG
//     (lines 45466+) — large; defer to T1.10 with the rest of season state
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
                                   gold: 1000, durationMs: 3 * 24 * 60 * 60 * 1000 }),
    // SHOP.1-REV §4.11 — Tower Climber's Pack ($0.99, 7-day window).
    // Featured tile shown at top of shop. Hidden after purchase or expiry.
    // Promoted to MONETIZATION block by T1.18 (was free-floating constants).
    towerClimber: Object.freeze({ usd: 0.99, windowDays: 7,
                                  sigilShards: 10, heartFragments: 1,
                                  gold: 200, heroCards: 5 })
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
  // SHOP.4 — Season Pass subscription ($4.99/mo). Mock-IAP today; flips to
  // RevenueCat in Phase G. Promoted to MONETIZATION block by T1.18.
  seasonPassSub: Object.freeze({ usd: 4.99, periodDays: 30, gemsBonus: 500,
                                  retries: 2, dailyLoginX: 2 }),
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

// 2026-05-12 — TASK-025 (T1.18): IAP product-ID registry. Mirrors legacy
// IAP_PRODUCT_IDS table at line 37692. Stable SKUs — RevenueCat / Apple
// / Google product IDs MUST remain identical across releases (changing
// them breaks live IAP for existing receipts).
export const IAP_PRODUCT_IDS = Object.freeze({
  // Gem packs (6 SKUs, $0.99 → $99.99)
  GEM_099:           'blocksworn.gems.099',
  GEM_499:           'blocksworn.gems.499',
  GEM_999:           'blocksworn.gems.999',
  GEM_1999:          'blocksworn.gems.1999',
  GEM_4999:          'blocksworn.gems.4999',
  GEM_9999:          'blocksworn.gems.9999',
  // Packs (one-time consumables)
  TOWER_CLIMBER:     'blocksworn.pack.tower_climber',
  STARTER:           'blocksworn.pack.starter',
  MEGA_BUFF:         'blocksworn.pack.mega_buff',
  RACE_BUNDLE_FN:    (race) => 'blocksworn.pack.race_bundle.' + race,
  ENDGAME_KIT:       'blocksworn.pack.endgame_kit',
  CHAPTER_UNLOCK_FN: (n)    => 'blocksworn.pack.chapter_unlock.' + n,
  // Subscription + battle pass
  SEASON_PASS_SUB:   'blocksworn.sub.season_pass',
  BATTLEPASS_SEASON: 'blocksworn.battlepass.season',
});

// 2026-05-12 — TASK-025 (T1.18): SHOP_PACKS — unified shop pack registry.
//
// Replaces 38+ scalar shadow constants (PACK_STANDARD_*, PACK_RACE_*,
// PACK_BIG_*, PACK_PREMIUM_*, PACK_ULTIMATE_*, PACK_PITY_THRESHOLD,
// STARTER_PACK_*, MEGA_BUFF_*, TOWER_CLIMBER_PACK_*, SEASON_PASS_SUB_*)
// that duplicated values from MONETIZATION.*. SHOP_PACKS entries REFERENCE
// the canonical MONETIZATION blocks via direct property reads — no values
// are redeclared here, so MONETIZATION remains single source of truth.
//
// Shape (all entries frozen):
//   id            : string — stable pack identifier
//   sku           : string — IAP product id (or null for soft-currency packs)
//   priceUSD      : number — real-money price (null for gold/gem-only packs)
//   priceGold     : number — gold cost (null for IAP packs)
//   priceGems    : number — gems cost (null for IAP-only packs)
//   contents      : object — frozen reference into MONETIZATION.* sub-blocks
//   availability  : string — gating rule key (decoded by renderShopPacks)
//   window        : object — lifecycle rules (one-time / rolling-Nd / always / subscription)
//
// Sacred §2.4 economy values UNCHANGED — every numeric still lives in
// GEM_PACKS / MONETIZATION; SHOP_PACKS is a structured view.
export const SHOP_PACKS = Object.freeze({
  // F2P gold-priced packs --------------------------------------------------
  standard: Object.freeze({
    id: 'standard',
    sku: null,
    priceUSD: null,
    priceGold: MONETIZATION.packs.standard.gold,
    priceGems: null,
    contents: MONETIZATION.packs.standard,
    availability: 'always',
    window: Object.freeze({ type: 'always' }),
  }),
  race: Object.freeze({
    id: 'race',
    sku: null,
    priceUSD: null,
    priceGold: MONETIZATION.packs.race.gold,
    priceGems: null,
    contents: MONETIZATION.packs.race,
    availability: 'always',
    window: Object.freeze({ type: 'always' }),
  }),
  // Gold + gems dual-currency pack ----------------------------------------
  big: Object.freeze({
    id: 'big',
    sku: null,
    priceUSD: null,
    priceGold: MONETIZATION.packs.big.gold,
    priceGems: MONETIZATION.packs.big.gems,
    contents: MONETIZATION.packs.big,
    availability: 'always',
    window: Object.freeze({ type: 'always' }),
  }),
  // Premium currency packs ------------------------------------------------
  premium: Object.freeze({
    id: 'premium',
    sku: null,
    priceUSD: null,
    priceGold: null,
    priceGems: MONETIZATION.packs.premium.gems,
    contents: MONETIZATION.packs.premium,
    availability: 'always',
    window: Object.freeze({ type: 'always' }),
  }),
  ultimate: Object.freeze({
    id: 'ultimate',
    sku: null,
    priceUSD: null,
    priceGold: null,
    priceGems: MONETIZATION.packs.ultimate.gems,
    contents: MONETIZATION.packs.ultimate,
    availability: 'always',
    window: Object.freeze({ type: 'always' }),
  }),
  // IAP packs -------------------------------------------------------------
  starter: Object.freeze({
    id: 'starter',
    sku: IAP_PRODUCT_IDS.STARTER,
    priceUSD: MONETIZATION.packs.starter.usd,
    priceGold: null,
    priceGems: null,
    contents: MONETIZATION.packs.starter,
    availability: 'starter-window',
    window: Object.freeze({ type: 'day-range',
                            minDay: MONETIZATION.packs.starter.minDay,
                            maxDay: MONETIZATION.packs.starter.maxDay }),
  }),
  tower_climber: Object.freeze({
    id: 'tower_climber',
    sku: IAP_PRODUCT_IDS.TOWER_CLIMBER,
    priceUSD: MONETIZATION.packs.towerClimber.usd,
    priceGold: null,
    priceGems: null,
    contents: MONETIZATION.packs.towerClimber,
    availability: 'tower-climber-eligible',
    window: Object.freeze({ type: 'rolling',
                            days: MONETIZATION.packs.towerClimber.windowDays }),
  }),
  race_bundle: Object.freeze({
    id: 'race_bundle',
    sku: null,                                       // RACE_BUNDLE_FN(race) at purchase
    priceUSD: MONETIZATION.packs.raceBundle.usd,
    priceGold: null,
    priceGems: null,
    contents: MONETIZATION.packs.raceBundle,
    availability: 'race-bundle-eligible',
    window: Object.freeze({ type: 'one-time-per-race' }),
  }),
  chapter_unlock: Object.freeze({
    id: 'chapter_unlock',
    sku: null,                                       // CHAPTER_UNLOCK_FN(n) at purchase
    priceUSD: MONETIZATION.packs.chapterUnlock.usd,
    priceGold: null,
    priceGems: null,
    contents: MONETIZATION.packs.chapterUnlock,
    availability: 'chapter-drop-window',
    window: Object.freeze({ type: 'rolling',
                            durationMs: MONETIZATION.packs.chapterUnlock.durationMs }),
  }),
  // Buffs / subscriptions -------------------------------------------------
  mega_buff: Object.freeze({
    id: 'mega_buff',
    sku: IAP_PRODUCT_IDS.MEGA_BUFF,
    priceUSD: MONETIZATION.buffs.mega.usd,
    priceGold: null,
    priceGems: MONETIZATION.buffs.mega.gems,
    contents: MONETIZATION.buffs.mega,
    availability: 'mega-buff-inactive',
    window: Object.freeze({ type: 'duration-ms',
                            durationMs: MONETIZATION.buffs.mega.durationMs }),
  }),
  gold_rush: Object.freeze({
    id: 'gold_rush',
    sku: null,
    priceUSD: MONETIZATION.buffs.goldRush.usd,
    priceGold: null,
    priceGems: MONETIZATION.buffs.goldRush.gems,
    contents: MONETIZATION.buffs.goldRush,
    availability: 'gold-rush-inactive',
    window: Object.freeze({ type: 'duration-ms',
                            durationMs: MONETIZATION.buffs.goldRush.durationMs }),
  }),
  squad_power: Object.freeze({
    id: 'squad_power',
    sku: null,
    priceUSD: MONETIZATION.buffs.squadPower.usd,
    priceGold: null,
    priceGems: MONETIZATION.buffs.squadPower.gems,
    contents: MONETIZATION.buffs.squadPower,
    availability: 'always',
    window: Object.freeze({ type: 'always' }),
  }),
  season_pass_sub: Object.freeze({
    id: 'season_pass_sub',
    sku: IAP_PRODUCT_IDS.SEASON_PASS_SUB,
    priceUSD: MONETIZATION.seasonPassSub.usd,
    priceGold: null,
    priceGems: null,
    contents: MONETIZATION.seasonPassSub,
    availability: 'season-pass-inactive',
    window: Object.freeze({ type: 'subscription',
                            periodDays: MONETIZATION.seasonPassSub.periodDays }),
  }),
});

// 2026-05-12 — pity threshold lifted out of MONETIZATION as a SHOP-side
// constant for shop renderer access. Still references MONETIZATION as
// single source of truth.
export const SHOP_PITY_THRESHOLD   = MONETIZATION.pity.threshold;
export const SHOP_T3_PITY_THRESHOLD = MONETIZATION.pity.t3Threshold;
