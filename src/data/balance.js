import { mirrorWindowProp } from '../utils/window-mirror.js';
// 2026-05-11 — TASK-008 (T1.07): game-balance constants relocated from legacy.
// 2026-05-11 — TASK-018 (T1.13.4): SQUAD_MAX named export added; legacy-only
//   constant gets a proper home. Mutable per-boss-defeat progression (3 → 4
//   after Boss 2 → 5 after Boss 4) preserved via getSquadMax / setSquadMax
//   accessors + window bridge. Retires the `_SQUAD_MAX_FALLBACK` shim in
//   src/core/progression.js.
//
// Sacred per CLAUDE.md §2.1:
//   - combo crit formula values inside BALANCE (xp, fireMultCap, etc.)
//   - TIER_COSTS_V18 (1:1, 2:2, 3:3, 4:5)
//   - GEM_PACKS price ladder ($0.99 → $99.99) — see ./monetization-config.js
//
// TIER_COSTS consolidation: legacy has BOTH `TIER_COSTS` (line 38279,
// `{1:1, 2:2, 3:3}` — essences-per-tier, ZERO read callsites) AND
// `TIER_COSTS_V18` (line 39988, `{1:1, 2:2, 3:3, 4:5}` — sole live reference
// used by upgradeHero + Tower path). Per CLAUDE.md §2.1 the V18 variant is
// the sacred one; per Execution Plan §13 T1.07 step 4 we export it as the
// canonical `TIER_COSTS`. The legacy 3-tier table is effectively dead code —
// T1.10 will replace its declaration with the import from here.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html lines 18524-18733
// (BALANCE) and 39988 (TIER_COSTS_V18).

export const BALANCE = Object.freeze({
  heroLevel: Object.freeze({
    min: 1,
    // BAL.1 — tier-gated level caps. Use getEffectiveLevelMax(heroId) for the
    // per-hero limit; `max` here is the absolute ceiling (= maxMyth) used for
    // legacy save sanitization and generic UI labels.
    maxT1: 10, maxT2: 20, maxT3: 30, maxMyth: 40,
    max: 40,
    // BAL.2 — cost curve rebalanced for tier-gated economy. Reference table:
    // LV 1→10 ≈ 1170g · 1→20 ≈ 4845g · 1→30 ≈ ~10000g · 1→40 ≈ ~16000g.
    costBase: 30,
    costStep: 25,
    costCap: 800,
    dmgPer: 0.04,      // +4% dmg per level
    hpPer: 3,          // +3 HP per level
    ultPer: 0.01       // +1% ult charge per level
  }),
  tier: Object.freeze({
    xpThresholds: Object.freeze({ t1: 5, t2: 20, t3: 50 }),
    max: 3,
    fireMultCap: 3.0,
    xp: Object.freeze({ participation: 1, ultFired: 2, killShot: 5, capPerBattle: 8 })
  }),
  ascend: Object.freeze({
    tier2Gold: 200,
    tier3Gold: 500,
    mythic: Object.freeze({ ascend: 1, cards: 25, gold: 1000, essence: 20, damageBonus: 1.30 })
  }),
  currency: Object.freeze({
    goldPerWin: 100,
    starterGems: 100,
    goldToGems: Object.freeze({ cost: 5000, amount: 100, cooldownMs: 24*60*60*1000 })
  }),
  tower: Object.freeze({
    dailyFloors: 10, weeklyFloors: 25, seasonalFloors: 50,
    midBossFloor: 5, climaxBossFloor: 10,
    dailyResetHour: 4, fragmentsPerHeart: 5, maxAttemptsPerDay: 5,
    retryGoldCost: Object.freeze([250, 500, 1000, 2000, 5000]),
    daily: Object.freeze({ baseGold: 100, sigils: 5, heartFragments: 1 }),
    racePure: Object.freeze({ hpMult: 1.20, rewardMult: 2.0 }),
    // TOWER.1 — Wednesday Chest (PRELAUNCH §5). Mid-week retention beat tied
    // to Mon-Wed Tower play. Tier determined by HIGHEST floor reached during
    // the 50h capture window (Mon 4 AM → Wed 4 AM). Subscriber bonus +25%
    // applies multiplicatively to all numeric rewards.
    wednesdayChest: Object.freeze({
      resetHour: 4,                        // 4 AM Wednesday (matches dailyResetHour)
      windowHours: 50,                     // Mon 4 AM → Wed 4 AM
      subscriberBonusMult: 1.25,
      tiers: Object.freeze([
        // floor: minimum highest floor reached in window. Tiers checked top-down.
        Object.freeze({ key: 'mythic',   floor: 40, label: 'MYTHIC',   color: '#BB60FF',
                        gold: 2500, sigils: 100, cards: 25, t2Stones: 3, t3Frags: 1, gems: 200 }),
        Object.freeze({ key: 'platinum', floor: 30, label: 'PLATINUM', color: '#5DCAFF',
                        gold: 1500, sigils:  50, cards: 10, t2Stones: 2, gems: 100 }),
        Object.freeze({ key: 'gold',     floor: 20, label: 'GOLD',     color: '#FFD53D',
                        gold: 1000, sigils:  30, cards:  5, t2Stones: 1, essence: 1, gems: 50 }),
        Object.freeze({ key: 'silver',   floor: 10, label: 'SILVER',   color: '#C0C8D8',
                        gold:  500, sigils:  15, cards:  3, t2Frags: 1 }),
        Object.freeze({ key: 'bronze',   floor:  1, label: 'BRONZE',   color: '#B07840',
                        gold:  200, sigils:   5, cards:  1 })
      ])
    }),
    // BAL.4 — per-floor reward distribution (PRELAUNCH §4.3). Floor 5 mid-boss
    // and floor 10 climax flagged for cinematic / extra cards. Sigils feed
    // Tower buff economy; t2Frags accumulate to 1 Tower Heart per 5 fragments.
    floorRewards: Object.freeze({
      1:  Object.freeze({ gold:  30, sigils: 0, cards: 0, t2Frags: 0 }),
      2:  Object.freeze({ gold:  50, sigils: 0, cards: 0, t2Frags: 0 }),
      3:  Object.freeze({ gold:  75, sigils: 1, cards: 0, t2Frags: 0 }),
      4:  Object.freeze({ gold: 100, sigils: 1, cards: 0, t2Frags: 0 }),
      5:  Object.freeze({ gold: 200, sigils: 2, cards: 1, t2Frags: 0, midBoss: true }),
      6:  Object.freeze({ gold: 100, sigils: 1, cards: 0, t2Frags: 0 }),
      7:  Object.freeze({ gold: 125, sigils: 1, cards: 0, t2Frags: 0 }),
      8:  Object.freeze({ gold: 150, sigils: 2, cards: 0, t2Frags: 0 }),
      9:  Object.freeze({ gold: 175, sigils: 2, cards: 0, t2Frags: 0 }),
      10: Object.freeze({ gold: 400, sigils: 3, cards: 2, t2Frags: 1, climax: true })
    })
  }),
  // PINCH — Soft Pinch architecture (PRELAUNCH §6 + §11.6). Five trigger
  // points that present skill / grind / pay paths at organic frustration
  // moments. Each capped to prevent fatigue (per-week + one-shot patterns).
  pinch: Object.freeze({
    // PINCH.1 — Boss Wall (chapter finale, 2nd consecutive loss).
    bossWall: Object.freeze({
      defeatThreshold: 2,        // fire on Nth consecutive defeat
      maxPerWeekPerBoss: 2,      // anti-fatigue cap
      reinforcementPackUSD: 1.99,
      reinforcementCards: 3,     // 3 element-specific cards
      reinforcementEssence: 5,
      reinforcementT1Stone: 1
    }),
    // PINCH.2 — Tower Death (floor 5+).
    towerDeath: Object.freeze({
      minFloor: 5,                  // grace below this floor
      gemCostLadder: Object.freeze([100, 200, 400]),  // escalating per-run
      partialRewardFraction: 0.5    // quit → keep half of run rewards
    }),
    // PINCH.3 — Ascension Pinch (4/5 cards). One-shot per hero.
    ascensionPinch: Object.freeze({
      cardsThreshold: 4,            // fire when player has 4 of needed 5
      cardsNeeded: 5
    }),
    // PINCH.4 — Triggered rewarded ads.
    ads: Object.freeze({
      bossDefeatBonusCapPerDay: 3,  // max 3 boss-defeat-bonus ads/day
      consecutiveLossThreshold: 2   // 2nd loss → ad offer
    }),
    // PINCH.5 — Streak Save (7+ day streak about to break).
    streakSave: Object.freeze({
      minStreakDays: 7,             // gate by streak length
      hoursBeforeBreak: 4,          // push notification window
      freezeGemCost: 50,            // gem-pay path
      freeFreezesPerMonth: 1        // free-ad path daily cap
    })
  }),
  // ECO.1 + ECO.2 — Sink mechanics (PRELAUNCH §3.4). retrySink scales by
  // chapter so Ch1 retry is forgiving (500g) and Ch5 retry is meaningful
  // (5000g cap). miniBuff = gold-only counterpart to MEGA_BUFF for F2P
  // pacing — shorter duration (12h), smaller mult (+20%), 24h cooldown.
  economy: Object.freeze({
    retrySink: Object.freeze({
      baseGold: 500,    // Ch1 cost
      perChapter: 500,  // +500/chapter from Ch2 onward
      cap: 5000,        // Ch10 effective ceiling
      hpRestoreFraction: 0.5  // half HP on resume (=ceil(MAX_HP/2))
    }),
    miniBuff: Object.freeze({
      cost: 5000,                       // gold
      durationMs: 12 * 60 * 60 * 1000,  // 12h (vs Mega Buff 24h)
      cooldownMs: 24 * 60 * 60 * 1000,  // 1 purchase per 24h
      goldMult: 1.20,                   // +20% gold (vs Mega +25%)
      fragMult: 1.20                    // +20% fragments (vs Mega +50%)
    })
  }),
  // BAL.3 + REW.1 — boss reward differentiation + star rating (PRELAUNCH §4.2).
  // First-clear fires the cinematic + huge reward modal; replay fires a minimal
  // toast (REW.3). Three-star bonus adds on top of either path. Stars are
  // computed from battleDamageTaken / MAX_HP ratio.
  rewards: Object.freeze({
    stars: Object.freeze({
      threeStar: 0.30,    // damageTaken/maxHP < 30% → 3 stars (no hits taken at MAX_HP=3)
      twoStar:   0.50     // damageTaken/maxHP < 50% → 2 stars (1 hit taken)
    }),
    // Per-boss reward tables. Key = `${chapter}.${bossIdx}`. Chapter 1-indexed
    // (matches CHAPTERS array) · bossIdx 0-indexed (matches .bosses array).
    boss: Object.freeze({
      // Chapter 1 — introductory difficulty
      '1.0': Object.freeze({  // PYREDRAKE
        firstClear: Object.freeze({ gold: 100, cards: 2, t2Stones: 0 }),
        replay:     Object.freeze({ gold:  50, cards: 1 }),
        threeStar:  Object.freeze({ gold:  50, essence: 1 })
      }),
      '1.1': Object.freeze({  // ABYSSAL TYRANT
        firstClear: Object.freeze({ gold: 150, cards: 3, t2Stones: 0 }),
        replay:     Object.freeze({ gold:  75, cards: 1 }),
        threeStar:  Object.freeze({ gold:  75, essence: 1 })
      }),
      '1.2': Object.freeze({  // GROVEWARDEN
        firstClear: Object.freeze({ gold: 200, cards: 3, t2Stones: 0 }),
        replay:     Object.freeze({ gold: 100, cards: 1 }),
        threeStar:  Object.freeze({ gold: 100, essence: 1 })
      }),
      '1.3': Object.freeze({  // SOLAR PHOENIX
        firstClear: Object.freeze({ gold: 300, cards: 3, t2Stones: 0 }),
        replay:     Object.freeze({ gold: 150, cards: 1 }),
        threeStar:  Object.freeze({ gold: 150, essence: 1 })
      }),
      '1.4': Object.freeze({  // CRYPT LICH (Ch1 finale)
        firstClear: Object.freeze({ gold: 500, cards: 5, t2Stones: 1,
                                    chapterCosmetic: 'ch1_banner' }),
        replay:     Object.freeze({ gold: 250, cards: 2 }),
        threeStar:  Object.freeze({ gold: 250, essence: 1 })
      }),
      // Chapter 2 — mid-difficulty
      '2.0': Object.freeze({  // VEROTHIRA
        firstClear: Object.freeze({ gold: 500, cards: 3, t2Stones: 1 }),
        replay:     Object.freeze({ gold: 200, cards: 1 }),
        threeStar:  Object.freeze({ gold: 200 })
      }),
      '2.1': Object.freeze({  // GEARHEART
        firstClear: Object.freeze({ gold: 600, cards: 5, t2Stones: 1 }),
        replay:     Object.freeze({ gold: 250, cards: 2 }),
        threeStar:  Object.freeze({ gold: 250, gems: 50 })
      }),
      '2.2': Object.freeze({  // URSARO
        firstClear: Object.freeze({ gold: 700, cards: 5, t2Stones: 1 }),
        replay:     Object.freeze({ gold: 300, cards: 2 }),
        threeStar:  Object.freeze({ gold: 300, essence: 1 })
      }),
      '2.3': Object.freeze({  // TIDESPIRE
        firstClear: Object.freeze({ gold: 800, cards: 8, t2Stones: 2 }),
        replay:     Object.freeze({ gold: 400, cards: 3 }),
        threeStar:  Object.freeze({ gold: 400, gems: 50 })
      }),
      '2.4': Object.freeze({  // HELIOTRON (Ch2 finale)
        firstClear: Object.freeze({ gold: 1500, cards: 15, t2Stones: 3, t3Stones: 1,
                                    gems: 100, chapterCosmetic: 'ch2_banner' }),
        replay:     Object.freeze({ gold:  600, cards:  5 }),
        threeStar:  Object.freeze({ gold:  600, gems: 100 })
      })
    }),
    // Chapter completion bonuses (REW.2 cinematic + Pinch 3 victory-pack offer).
    // victoryPackUSD = price for the 3-day chapter-complete pack (Phase 5 PINCH.3).
    chapter: Object.freeze({
      1: Object.freeze({ t2Stones: 1,                       bpXp:  500, banner: 'ch1_banner', victoryPackUSD:  4.99 }),
      2: Object.freeze({ t2Stones: 2, t3Stones: 1, gems: 100, bpXp:  750, banner: 'ch2_banner', victoryPackUSD:  9.99 }),
      3: Object.freeze({ t3Stones: 2,              gems: 200, bpXp: 1000, banner: 'ch3_banner', victoryPackUSD: 14.99 })
    })
  })
});

// SACRED per CLAUDE.md §2.1: tier 4 ascension cost is 5 essences.
// This is the V_18 variant — sole live reference path in legacy
// (TIER_COSTS_V18 at line 39988). The other `TIER_COSTS` at line 38279
// (`{1:1, 2:2, 3:3}`) has zero read callsites; it's dead code that T1.10
// removal will sweep up.
export const TIER_COSTS = Object.freeze({ 1: 1, 2: 2, 3: 3, 4: 5 });

// ─── SQUAD_MAX (legacy 21222-21225) ────────────────────────────────────────
// Block B3: SQUAD_MAX is mutable. Progression: 3 (default) → 4 (after Boss 2) →
// 5 (after Boss 4). Hooked from onBossDefeated. Persisted in localStorage.
//
// Module-private `let` + accessors keep the mutation surface explicit. The
// `window.SQUAD_MAX` bridge keeps legacy-style /* global SQUAD_MAX */ readers
// (and the legacy `SQUAD_MAX = n` writer sites at legacy 21402 / 21449 /
// 24985) live-binding compatible. Initial value byte-perfect from legacy.
let _squadMax = 3;
export const SQUAD_MAX_STORAGE_KEY = 'blocksworn_squad_max';

export function getSquadMax() { return _squadMax; }
export function setSquadMax(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return;
  _squadMax = v;
}

if (typeof window !== 'undefined') {
  mirrorWindowProp('SQUAD_MAX', () => _squadMax, (v) => { _squadMax = v; });
}
