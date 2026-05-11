// 2026-05-11 — TASK-012 (T1.11): Shop screen relocated from legacy.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - goToShop()                       line 25624-25665   (lock gate + first-visit welcome + analytics)
//   - renderShopPacks()                line 23419-23875   (458 LoC — full shop panel: gem packs / race packs /
//                                                          gold-to-gems / big-premium-ultimate / cosmetics /
//                                                          subscription / weekly offer / convenience / ads /
//                                                          bundles / starter pack / pity bars / drop boost)
//
// SACRED PER CLAUDE.md §2.4: GEM_PACKS price ladder ($0.99/$4.99/$9.99 +10% /
// $19.99 +15% / $49.99 +20% MEGA / $99.99 +30% WHALE), First Purchase Bonus
// (+50% gems + 1 Hero Card + Founder Badge), Tower retry gem ladder [100,200,400]
// — preserved byte-perfect. All economy data lives in legacy module-scope
// constants (referenced via /* global */); will fold into src/data/shop.js
// on a follow-up extraction. Render code below only formats those values.
//
// Owns: Shop screen rendering + nav entry. Inline onclick handlers are
// preserved verbatim — they reference legacy purchase functions
// (purchaseGemPack / buyStandardPack / buyRacePack / buyMegaBuff /
// subscribeToSeasonPass / watchRewardedAd / etc.) that stay in legacy
// until a follow-up extraction into src/core/shop.js or src/services/iap.js.
//
// Does NOT own:
//   - Purchase flows + balance mutation (purchaseGemPack / buyStandardPack /
//     buyRacePack / buyBigPackGold / buyBigPackGems / buyPremiumPack /
//     buyUltimatePack / buyCosmetic / buyDailyGift / buyMegaBuff /
//     buyGoldRush / buyStarterPack / buySquadPowerPack / buyRapidAscensionPack /
//     buyEndgameKit / buyRaceLaunchBundle / buyTowerClimberPack /
//     buyWeeklyOffer / subscribeToSeasonPass / convertGoldToGems /
//     watchRewardedAd) — RevenueCat/IAP integration territory, lives in
//     legacy until follow-up.
//   - Pity / drop-rate state (_getPackPityCounter / _getPackT3PityCounter /
//     PACK_PITY_THRESHOLD / MONETIZATION.pity.t3Threshold /
//     _isPremiumDropActive / _premiumDropDaysRemaining) — progression
//     state; legacy module-scope.
//   - COSMETICS_CATALOG / TOWER_CLIMBER_PACK_CONTENTS / GEM_PACKS — data
//     tables; legacy module-scope until src/data/shop.js extraction.
//
// 2026-05-11 — Roman: pure-relocation discipline.

/* eslint-disable no-empty, no-unused-vars */

// T1.13.1: /* global */ → ES imports for resolved src/ exports.
import { isFtueActive } from '../core/ftue-state.js';
import { showScreen } from './router.js';
import { logEvent, EVT } from '../services/analytics.js';
import { MONETIZATION, GEM_PACKS } from '../data/monetization-config.js';

/* global gold, gems, flashText,
   _hoursSinceFirstLaunch, _daysSinceFirstLaunch,
   _isShopLocked, _shopLockReason, SHOP_UNLOCK_MIN_HOURS,
   _isFirstShopVisit, _grantWelcomeGiftIfNeeded, _showShopWelcomeModal,
   _renderWelcomeGiftBannerIfPending,
   PACK_STANDARD_COST, PACK_RACE_COST,
   PACK_BIG_GOLD_COST, PACK_BIG_GEMS_COST, PACK_PREMIUM_GEMS_COST,
   PACK_PREMIUM_GOLD_BONUS, PACK_PREMIUM_ESSENCE_BONUS,
   PACK_ULTIMATE_GEMS_COST, PACK_ULTIMATE_GOLD_BONUS,
   PACK_ULTIMATE_ESSENCE_BONUS, PACK_PITY_THRESHOLD,
   GOLD_TO_GEMS_COST, GOLD_TO_GEMS_AMOUNT,
   SQUAD_POWER_T2, SQUAD_POWER_CARDS, SQUAD_POWER_ESSENCE_PER,
   SQUAD_POWER_GOLD, SQUAD_POWER_USD, SQUAD_POWER_GEMS,
   RAPID_ASCENSION_T2, RAPID_ASCENSION_T3, RAPID_ASCENSION_CARDS,
   RAPID_ASCENSION_ESSENCE_PER, RAPID_ASCENSION_GOLD,
   RAPID_ASCENSION_USD, RAPID_ASCENSION_GEMS,
   ENDGAME_KIT_T3, ENDGAME_KIT_T2, ENDGAME_KIT_CARDS,
   ENDGAME_KIT_HEARTS, ENDGAME_KIT_USD, ENDGAME_KIT_GEMS,
   RACE_BUNDLE_USD, MEGA_BUFF_USD, MEGA_BUFF_GEMS,
   GOLD_RUSH_USD, GOLD_RUSH_GEMS, DAILY_GIFT_USD, DAILY_GIFT_GEMS,
   STARTER_PACK_USD, STARTER_PACK_GEMS, STARTER_PACK_CARDS,
   STARTER_PACK_T2_STONES, STARTER_PACK_GOLD,
   SEASON_PASS_SUB_PRICE_USD, SEASON_PASS_SUB_GEMS_BONUS,
   TOWER_CLIMBER_PACK_CONTENTS, TOWER_CLIMBER_PACK_USD,
   COSMETICS_CATALOG,
   _PACK_RACE_LABELS, _PACK_RACE_COLORS,
   _isFirstPurchaseDone, _isTowerClimberPackVisible,
   _towerClimberPackHoursRemaining, _isMinimalShopMode,
   _getPackPityCounter, _getPackT3PityCounter,
   _isPremiumDropActive, _premiumDropDaysRemaining,
   _ensureCosmeticState, _isSeasonPassActive, seasonPassSub,
   _seasonPassRenewalDateText, _seasonPassDaysRemaining,
   getCurrentWeeklyOffer, _isWeeklyOfferPurchased, _daysLeftInWeek,
   _isMegaBuffActive, _megaBuffHoursLeft,
   _squadBoostAvailable, _squadBoostHoursLeft,
   _isGoldRushActive, _goldRushOnCooldown, _goldRushHoursLeft,
   _isDailyGiftPurchasedToday, getTodayDailyGift,
   _adsRemaining, _adsCap,
   _getPurchasedRaceBundles, getEndgameKitEligibility,
   _isStarterPackEligible, _isRaceF2PUnlocked,
   _goldToGemsAvailable, _goldToGemsCooldownText */
// LEGACY-ONLY: above tokens have no src/ export — shims retired in T1.14+ cleanup.

import { log } from '../services/logger.js';

// ─── goToShop — nav + lock gate + welcome flow (legacy 25624-25665) ────────
export function goToShop() {
  if (isFtueActive()) {
    try { flashText('FINISH THE TUTORIAL FIRST', '#8A88A0'); } catch(e){}
    return;
  }
  // SHOP.1-REV §4.2 — lock-aware gate with contextual hint per _shopLockReason.
  try {
    if (typeof _isShopLocked === 'function' && _isShopLocked()) {
      const reason = (typeof _shopLockReason === 'function') ? _shopLockReason() : null;
      let msg = 'SHOP LOCKED';
      if (reason === 'lich') msg = 'DEFEAT THE CRYPT LICH FIRST';
      else if (reason === 'cooldown') {
        const hrs = Math.ceil(SHOP_UNLOCK_MIN_HOURS - _hoursSinceFirstLaunch());
        msg = 'SHOP UNLOCKS IN ' + hrs + 'h';
      }
      try { flashText(msg, '#A8A5B8'); } catch (e) {}
      return;
    }
  } catch (e) {}

  // SHOP.1-REV §4.2 — first-visit welcome flow. Intercepts before normal
  // shop entry so welcome modal + gift modal layer in the right order.
  try {
    if (_isFirstShopVisit()) {
      _grantWelcomeGiftIfNeeded();   // idempotent, sets state
      _showShopWelcomeModal();        // routes to gift modal then shop
      return;
    }
  } catch (e) { log.warn('[SHOP.1-REV] welcome flow error:', e); }

  // Normal shop entry
  try {
    const sg = document.getElementById('shopGoldCount'); if (sg) sg.textContent = String(gold);
    const sgm = document.getElementById('shopGemCount'); if (sgm) sgm.textContent = String(gems);
  } catch (e) {}
  showScreen('shop');
  try { renderShopPacks(); } catch (e) { log.warn('renderShopPacks failed:', e); }
  // ANALYTICS.3 — shop_opened event drives funnel.
  try { logEvent(EVT.shop_opened, { day: _daysSinceFirstLaunch() }); } catch (e) {}
  // SHOP.1-REV §4.2 — if welcome gift was dismissed-but-unclaimed, show inline banner.
  try { _renderWelcomeGiftBannerIfPending(); } catch (e) {}
}

// ─── renderShopPacks — main shop panel (legacy 23419-23875) ─────────────────
// SACRED: GEM_PACKS price ladder + First Purchase Bonus + Tower retry gem
// ladder are sacred per CLAUDE.md §2.4. This function is byte-perfect from
// legacy; the only changes are import-style (logger) and the function
// declaration becoming an exported named export.
export function renderShopPacks() {
  const host = document.getElementById('shopSectionOffers');
  if (!host) return;
  const goldNow = gold || 0;
  const stdAffordable  = goldNow >= PACK_STANDARD_COST;
  const raceAffordable = goldNow >= PACK_RACE_COST;
  const races = ['pirate', 'rock', 'shark', 'crocodile', 'spark'];

  // SHOP.1-REV §4.10 — Minimal mode flag. Each section below conditionally
  // hidden when minimal === true. Tower Climber's Pack, Standard Pack, and
  // cosmetics stay visible.
  const minimal = _isMinimalShopMode();

  // SHOP.1-REV §4.11 — Tower Climber's Pack featured tile (top of shop, 7-day window).
  let towerClimberHtml = '';
  if (_isTowerClimberPackVisible()) {
    const hoursLeft = _towerClimberPackHoursRemaining();
    const daysLeft = Math.max(1, Math.ceil(hoursLeft / 24));
    const c = TOWER_CLIMBER_PACK_CONTENTS;
    towerClimberHtml =
      '<button class="shop-pack-btn shop-tower-climber-pack" onclick="buyTowerClimberPack()">' +
        '<span class="shop-tcp-badge">FEATURED · ' + daysLeft + 'd LEFT</span>' +
        '<span class="shop-pack-emoji">🗼</span>' +
        '<span class="shop-pack-name">TOWER CLIMBER\'S PACK</span>' +
        '<span class="shop-pack-desc">' +
          '<div>• ' + c.sigilShards + ' Sigil Shards</div>' +
          '<div>• ' + c.heartFragments + ' Heart Fragment (1/5 of Heart)</div>' +
          '<div>• ' + c.gold + ' Gold</div>' +
          '<div>• ' + c.heroCards + ' Hero Cards (weighted)</div>' +
        '</span>' +
        '<span class="shop-pack-cost">$' + TOWER_CLIMBER_PACK_USD.toFixed(2) + '</span>' +
      '</button>';
  }

  // ----- Section 1: Gem Packs (mock-IAP) + First-Purchase banner -----
  const isFirst = !_isFirstPurchaseDone();
  const firstPurchaseBannerHtml = isFirst ? (
    '<div class="shop-first-purchase-banner">' +
    '  <div class="shop-fp-icon">🎁</div>' +
    '  <div class="shop-fp-text">' +
    '    <div class="shop-fp-title">FIRST PURCHASE BONUS</div>' +
    '    <div class="shop-fp-sub">+50% gems · 1 random Hero Card · Founder Badge</div>' +
    '  </div>' +
    '</div>'
  ) : '';
  const gemPacksHtml = GEM_PACKS.map(function (p) {
    const total = p.baseGems + p.bonusGems;
    const finalGems = isFirst ? Math.floor(total * 1.5) : total;
    const badgeHtml = p.badge ? '<span class="shop-gem-badge" style="background:' + p.glow + '">' + p.badge + '</span>' : '';
    const firstBonusHtml = isFirst ? '<div class="shop-gem-firstbonus">+50% FIRST → ' + finalGems.toLocaleString() + ' 💎</div>' : '';
    const descLine = p.bonusGems > 0
      ? (p.baseGems.toLocaleString() + ' base · +' + p.bonusGems.toLocaleString() + ' bonus')
      : 'Base pack';
    return '<button class="shop-pack-btn shop-gem-pack" style="border-color:' + p.glow + '" onclick="purchaseGemPack(\'' + p.id + '\')">' +
      '<span class="shop-pack-emoji" style="color:' + p.glow + '">💎</span>' +
      '<span class="shop-pack-name">+' + total.toLocaleString() + ' GEMS' + badgeHtml + '</span>' +
      '<span class="shop-pack-desc">' + descLine + firstBonusHtml + '</span>' +
      '<span class="shop-pack-cost">$' + p.price.toFixed(2) + '</span>' +
      '</button>';
  }).join('');

  // ----- Section 2: Race packs (existing F2P) -----
  const raceCardsHtml = races.map(function (r) {
    const label = _PACK_RACE_LABELS[r];
    const color = _PACK_RACE_COLORS[r];
    return '<button class="shop-pack-btn shop-pack-race" style="border-color:' + color + '" ' +
                    (raceAffordable ? '' : 'disabled') +
                    ' onclick="buyRacePack(\'' + r + '\')">' +
      '<span class="shop-pack-emoji" style="color:' + color + '">📦</span>' +
      '<span class="shop-pack-name">' + label + ' PACK</span>' +
      '<span class="shop-pack-desc">5 ' + label + ' cards</span>' +
      '<span class="shop-pack-cost">' + PACK_RACE_COST + ' 💰</span>' +
      '</button>';
  }).join('');

  // ----- Section 3: Gold→Gems daily conversion (spec §8.5) -----
  const g2gAvail = _goldToGemsAvailable();
  const g2gAfford = goldNow >= GOLD_TO_GEMS_COST;
  const cooldownTxt = _goldToGemsCooldownText();
  const goldToGemsHtml =
    '<button class="shop-pack-btn shop-gold-convert" ' +
            ((g2gAvail && g2gAfford) ? '' : 'disabled') +
            ' onclick="convertGoldToGems()">' +
      '<span class="shop-pack-emoji">🔁</span>' +
      '<span class="shop-pack-name">GOLD → GEMS</span>' +
      '<span class="shop-pack-desc">' + (cooldownTxt ? 'Available in ' + cooldownTxt : 'Once per day') + '</span>' +
      '<span class="shop-pack-cost">' + GOLD_TO_GEMS_COST + ' 💰 → ' + GOLD_TO_GEMS_AMOUNT + ' 💎</span>' +
    '</button>';

  // ----- Section 3b: Phase B — Big / Premium / Ultimate Packs + pity + drop boost -----
  const gemsNow = (typeof gems === 'number') ? gems : 0;
  const bigGoldAfford = goldNow >= PACK_BIG_GOLD_COST;
  const bigGemsAfford = gemsNow >= PACK_BIG_GEMS_COST;
  const premiumAfford = gemsNow >= PACK_PREMIUM_GEMS_COST;
  const ultimateAfford = gemsNow >= PACK_ULTIMATE_GEMS_COST;
  // SHOP.3 — Pity bar UX overhaul. Two parallel pity tracks (T2 from
  // standard/race, T3 from premium) shown side by side with tap-to-explain.
  // Per spec: "Pity bar shows 'T2 STONE GUARANTEED — N packs left'".
  const pityCount = _getPackPityCounter();
  const pityPct = Math.min(100, Math.round((pityCount / PACK_PITY_THRESHOLD) * 100));
  const pityT2Left = Math.max(0, PACK_PITY_THRESHOLD - pityCount);
  const t3Count = (typeof _getPackT3PityCounter === 'function') ? _getPackT3PityCounter() : 0;
  const t3Threshold = MONETIZATION.pity.t3Threshold;
  const t3Pct = Math.min(100, Math.round((t3Count / t3Threshold) * 100));
  const t3Left = Math.max(0, t3Threshold - t3Count);
  const pityHtml =
    '<div class="shop-pity-bar" onclick="showPityInfo()" style="cursor:pointer">' +
      '<span class="label">⚡ T2 PITY</span>' +
      '<span class="track"><span class="fill" style="width:' + pityPct + '%"></span></span>' +
      '<span class="count">T2 GUARANTEED IN ' + pityT2Left + ' PACK' + (pityT2Left === 1 ? '' : 'S') + '</span>' +
    '</div>' +
    '<div class="shop-pity-bar" onclick="showPityInfo()" style="cursor:pointer;margin-top:6px">' +
      '<span class="label">💠 T3 PITY</span>' +
      '<span class="track"><span class="fill" style="width:' + t3Pct + '%;background:linear-gradient(90deg,#5DCAFF,#A8E0FF)"></span></span>' +
      '<span class="count">T3 GUARANTEED IN ' + t3Left + ' PREMIUM</span>' +
    '</div>';
  // Premium drop rate banner (active only after Ultimate Pack purchase, 7 days).
  const dropActive = _isPremiumDropActive();
  const dropDays = _premiumDropDaysRemaining();
  const dropBoostHtml = dropActive ? (
    '<div class="shop-drop-boost">' +
      '<span class="icon">🎯</span>' +
      '<span class="text"><strong>PREMIUM DROP RATE ACTIVE</strong><br>+30% weight to less-owned heroes · ' + dropDays + ' day' + (dropDays === 1 ? '' : 's') + ' remaining</span>' +
    '</div>'
  ) : '';
  const bigPackHtml =
    '<div class="shop-pack-dual">' +
      '<button class="shop-pack-btn shop-pack-big" ' + (bigGoldAfford ? '' : 'disabled') + ' onclick="buyBigPackGold()">' +
        '<span class="shop-pack-emoji">📦</span>' +
        '<span class="shop-pack-name">BIG PACK</span>' +
        '<span class="shop-pack-desc">10 cards + 1 ⚡ T2</span>' +
        '<span class="shop-pack-cost">' + PACK_BIG_GOLD_COST.toLocaleString() + ' 💰</span>' +
      '</button>' +
      '<button class="shop-pack-btn shop-pack-big" ' + (bigGemsAfford ? '' : 'disabled') + ' onclick="buyBigPackGems()">' +
        '<span class="shop-pack-emoji">📦</span>' +
        '<span class="shop-pack-name">BIG PACK</span>' +
        '<span class="shop-pack-desc">10 cards + 1 ⚡ T2</span>' +
        '<span class="shop-pack-cost">' + PACK_BIG_GEMS_COST + ' 💎</span>' +
      '</button>' +
    '</div>';
  const premiumPackHtml =
    '<button class="shop-pack-btn shop-pack-premium" ' + (premiumAfford ? '' : 'disabled') + ' onclick="buyPremiumPack()">' +
      '<span class="shop-pack-emoji">🎁</span>' +
      '<span class="shop-pack-name">PREMIUM PACK</span>' +
      '<span class="shop-pack-desc">10 cards · 1 ⚡ T2 · 5% chance 💠 T3 · +' + PACK_PREMIUM_GOLD_BONUS + '💰 · +' + PACK_PREMIUM_ESSENCE_BONUS + '✦</span>' +
      '<span class="shop-pack-cost">' + PACK_PREMIUM_GEMS_COST + ' 💎</span>' +
    '</button>';
  const ultimatePackHtml =
    '<button class="shop-pack-btn shop-pack-ultimate" ' + (ultimateAfford ? '' : 'disabled') + ' onclick="buyUltimatePack()">' +
      '<span class="shop-pack-emoji">👑</span>' +
      '<span class="shop-pack-name">ULTIMATE PACK</span>' +
      '<span class="shop-pack-desc">25 cards · 2 ⚡ T2 · 1 💠 T3 · +' + PACK_ULTIMATE_GOLD_BONUS + '💰 · +' + PACK_ULTIMATE_ESSENCE_BONUS + '✦ · 7d 🎯 boost</span>' +
      '<span class="shop-pack-cost">' + PACK_ULTIMATE_GEMS_COST + ' 💎</span>' +
    '</button>';

  // ----- Section 4: Cosmetics (existing — unchanged) -----
  const cState = _ensureCosmeticState();
  const cosmeticHtml = ['frame', 'aura', 'bg'].map(function (slot) {
    const slotLabel = { frame: 'PORTRAIT FRAMES', aura: 'HERO AURAS', bg: 'PROFILE BACKGROUNDS' }[slot];
    const items = COSMETICS_CATALOG.filter(function (c) { return c.slot === slot; });
    const itemsHtml = items.map(function (item) {
      const owned    = cState.owned.includes(item.id);
      const equipped = (cState[item.slot] === item.id);
      const afford   = (goldNow >= item.cost);
      const stateLabel = equipped ? 'EQUIPPED ★' : (owned ? 'EQUIP' : (item.cost + ' 💰'));
      const stateColor = equipped ? '#5DCA79' : (owned ? '#FFD53D' : (afford ? '#FFD53D' : '#9A98A4'));
      const onclick    = equipped ? ('unequipCosmetic(\'' + slot + '\')')
                       : owned    ? ('equipCosmetic(\'' + item.id + '\')')
                       : afford   ? ('buyCosmetic(\'' + item.id + '\')')
                       : '';
      return '<button class="shop-cosmetic-btn ' + (equipped ? 'equipped' : '') + '" ' +
                      (owned || afford ? '' : 'disabled') +
                      ' style="border-color:' + stateColor + '" onclick="' + onclick + '">' +
        '<span class="cosmetic-name">' + item.name + '</span>' +
        '<span class="cosmetic-desc">' + item.desc + '</span>' +
        '<span class="cosmetic-state" style="color:' + stateColor + '">' + stateLabel + '</span>' +
        '</button>';
    }).join('');
    return '<div class="shop-pack-divider">' + slotLabel + '</div>' + itemsHtml;
  }).join('');

  // ----- Phase C — Season Pass subscription tile (always visible at top of Shop) -----
  const subActive = (typeof _isSeasonPassActive === 'function') && _isSeasonPassActive();
  let subTileHtml;
  if (subActive) {
    const renew = (typeof _seasonPassRenewalDateText === 'function') ? _seasonPassRenewalDateText() : null;
    const status = seasonPassSub.autoRenew
      ? ('Auto-renews ' + (renew || 'in ' + _seasonPassDaysRemaining() + 'd'))
      : ('Cancels in ' + _seasonPassDaysRemaining() + 'd');
    subTileHtml =
      '<div class="shop-sub-tile active">' +
        '<div class="shop-sub-tile-row">' +
          '<span class="shop-sub-tile-icon">★</span>' +
          '<div class="shop-sub-tile-info">' +
            '<div class="shop-sub-tile-title">SEASON PASS · SUBSCRIBED</div>' +
            '<div class="shop-sub-tile-sub">' + status + ' · manage in Season screen</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  } else {
    subTileHtml =
      '<button class="shop-sub-tile" onclick="subscribeToSeasonPass()">' +
        '<div class="shop-sub-tile-row">' +
          '<span class="shop-sub-tile-icon">★</span>' +
          '<div class="shop-sub-tile-info">' +
            '<div class="shop-sub-tile-title">SEASON PASS · $' + SEASON_PASS_SUB_PRICE_USD.toFixed(2) + '/mo</div>' +
            '<div class="shop-sub-tile-sub">' + SEASON_PASS_SUB_GEMS_BONUS + '💎/season · auto-premium · 2× retries · cancel anytime</div>' +
          '</div>' +
        '</div>' +
      '</button>';
  }
  // ----- Phase D — Weekly Limited Offer (top of shop, gentle countdown) -----
  const wOffer = (typeof getCurrentWeeklyOffer === 'function') ? getCurrentWeeklyOffer() : null;
  const wPurchased = (typeof _isWeeklyOfferPurchased === 'function') ? _isWeeklyOfferPurchased() : false;
  let weeklyOfferHtml = '';
  if (wOffer) {
    const daysLeft = _daysLeftInWeek();
    const contents = wOffer.race
      ? (wOffer.cards + ' ' + _PACK_RACE_LABELS[wOffer.race] + ' cards · ' + wOffer.t2 + ' ⚡ T2 · ' + wOffer.gold + '💰')
      : ('BP Premium · ' + wOffer.essence + ' shards · ' + wOffer.cards + ' cards');
    if (wPurchased) {
      weeklyOfferHtml =
        '<div class="shop-weekly-offer purchased">' +
          '<div class="shop-weekly-tag">✓ THIS WEEK\'S OFFER</div>' +
          '<div class="shop-weekly-title">' + wOffer.label + '</div>' +
          '<div class="shop-weekly-contents">' + contents + '</div>' +
          '<div class="shop-weekly-footer"><span>Already owned · resets next week</span><span class="shop-weekly-cost">$' + wOffer.priceUSD.toFixed(2) + '</span></div>' +
        '</div>';
    } else {
      weeklyOfferHtml =
        '<button class="shop-weekly-offer" onclick="buyWeeklyOffer()">' +
          '<div class="shop-weekly-tag">★ THIS WEEK</div>' +
          '<div class="shop-weekly-title">' + wOffer.label + '</div>' +
          '<div class="shop-weekly-contents">' + contents + '</div>' +
          '<div class="shop-weekly-footer"><span>Available ' + daysLeft + ' more day' + (daysLeft === 1 ? '' : 's') + ' · no pressure</span><span class="shop-weekly-cost">$' + wOffer.priceUSD.toFixed(2) + ' / ' + wOffer.priceGems + '💎</span></div>' +
        '</button>';
    }
  }

  // ----- Phase E — Convenience + Ad Center -----
  const buffActive    = (typeof _isMegaBuffActive === 'function') && _isMegaBuffActive();
  const buffHrs       = (typeof _megaBuffHoursLeft === 'function') ? _megaBuffHoursLeft() : 0;
  const squadAvail    = (typeof _squadBoostAvailable === 'function') ? _squadBoostAvailable() : true;
  const squadCdHrs    = (typeof _squadBoostHoursLeft === 'function') ? _squadBoostHoursLeft() : 0;
  // SHOP.7 — Gold Rush availability + cooldown.
  const goldRushActive = (typeof _isGoldRushActive === 'function') && _isGoldRushActive();
  const goldRushCooldown = (typeof _goldRushOnCooldown === 'function') && _goldRushOnCooldown();
  const dailyClaimed  = (typeof _isDailyGiftPurchasedToday === 'function') ? _isDailyGiftPurchasedToday() : false;
  const todayGift     = (typeof getTodayDailyGift === 'function') ? getTodayDailyGift() : null;
  const adsLeft       = (typeof _adsRemaining === 'function') ? _adsRemaining() : 0;
  const adsCap        = (typeof _adsCap === 'function') ? _adsCap() : 5;
  // squadAvail / squadCdHrs reserved for legacy squad-boost flow; not used by
  // current Gold Rush replacement but preserved to mirror legacy locals.
  void squadAvail; void squadCdHrs;
  const buffActiveBanner = buffActive
    ? '<div class="shop-buff-banner"><span class="icon">⚡</span><span class="text"><strong>24h MEGA BUFF ACTIVE</strong><br>+25% gold · +50% Hero Cards · +25% shards · ' + buffHrs + 'h remaining</span></div>'
    : '';
  const megaBuffHtml = buffActive
    ? '<button class="shop-conv shop-conv-buff" disabled>' +
        '<div class="shop-conv-title">⚡ 24h MEGA BUFF</div>' +
        '<div class="shop-conv-contents">+25% gold · +50% Hero Cards · +25% shards</div>' +
        '<div class="shop-conv-cost">ACTIVE · ' + buffHrs + 'h LEFT</div>' +
      '</button>'
    : '<button class="shop-conv shop-conv-buff" onclick="buyMegaBuff()">' +
        '<div class="shop-conv-title">⚡ 24h MEGA BUFF</div>' +
        '<div class="shop-conv-contents">+25% gold · +50% Hero Cards · +25% shards · 24h</div>' +
        '<div class="shop-conv-cost">$' + MEGA_BUFF_USD.toFixed(2) + ' / ' + MEGA_BUFF_GEMS + '💎</div>' +
      '</button>';
  // SHOP.7 — Squad Boost replaced with Gold Rush in shop UI per PRELAUNCH §11.5.
  // Legacy buySquadLevelBoost function kept for save compat; just hidden from UI.
  // Gold Rush: +100% gold + +50% essence + 1 free Tower retry, stacks on Mega.
  const squadBoostHtml = goldRushActive
    ? '<button class="shop-conv shop-conv-squad" disabled>' +
        '<div class="shop-conv-title">★ GOLD RUSH · ACTIVE</div>' +
        '<div class="shop-conv-contents">+100% gold · +50% essence · 1 free Tower retry</div>' +
        '<div class="shop-conv-cooldown">' + (typeof _goldRushHoursLeft === 'function' ? _goldRushHoursLeft() : 0) + 'h LEFT</div>' +
      '</button>'
    : goldRushCooldown
    ? '<button class="shop-conv shop-conv-squad" disabled>' +
        '<div class="shop-conv-title">★ GOLD RUSH</div>' +
        '<div class="shop-conv-contents">On cooldown — daily cap 1</div>' +
      '</button>'
    : '<button class="shop-conv shop-conv-squad" onclick="buyGoldRush()">' +
        '<div class="shop-conv-title">★ GOLD RUSH 24h</div>' +
        '<div class="shop-conv-contents">+100% gold · +50% essence · 1 free Tower retry · stacks on Mega</div>' +
        '<div class="shop-conv-cost">$' + GOLD_RUSH_USD.toFixed(2) + ' / ' + GOLD_RUSH_GEMS + '💎</div>' +
      '</button>';
  let dailyGiftContents = '';
  if (todayGift) {
    const items = [];
    if (todayGift.gold)    items.push(todayGift.gold + '💰');
    if (todayGift.gems)    items.push(todayGift.gems + '💎');
    if (todayGift.cards)   items.push(todayGift.cards + ' cards');
    if (todayGift.essence) items.push(todayGift.essence + '✦');
    if (todayGift.t2)      items.push(todayGift.t2 + '⚡');
    dailyGiftContents = todayGift.label + ' · ' + items.join(' · ');
  }
  const dailyGiftHtml = dailyClaimed
    ? '<button class="shop-conv shop-conv-daily" disabled>' +
        '<div class="shop-conv-title">🎁 DAILY GIFT BUNDLE</div>' +
        '<div class="shop-conv-contents">' + dailyGiftContents + '</div>' +
        '<div class="shop-conv-cooldown">✓ CLAIMED · Resets at midnight</div>' +
      '</button>'
    : '<button class="shop-conv shop-conv-daily" onclick="buyDailyGift()">' +
        '<div class="shop-conv-title">🎁 DAILY GIFT BUNDLE</div>' +
        '<div class="shop-conv-contents">' + dailyGiftContents + '</div>' +
        '<div class="shop-conv-cost">$' + DAILY_GIFT_USD.toFixed(2) + ' / ' + DAILY_GIFT_GEMS + '💎</div>' +
      '</button>';
  // Ad Center — 3 watch-ad cards (gold / hero card / essence)
  const adDisabled = adsLeft <= 0;
  const adCounterHtml =
    '<div class="shop-ad-counter"><strong>' + adsLeft + '</strong> of <strong>' + adsCap + '</strong> ad' + (adsCap === 1 ? '' : 's') + ' available today' + (_isSeasonPassActive && _isSeasonPassActive() ? ' · subscriber bonus' : '') + '</div>';
  const adCenterHtml =
    adCounterHtml +
    '<div class="shop-ad-grid">' +
      '<button class="shop-ad-card" ' + (adDisabled ? 'disabled' : '') + ' onclick="watchRewardedAd(\'gold\')">' +
        '<span class="icon">📺</span><span class="label">WATCH AD</span><span class="reward">+200 💰</span>' +
      '</button>' +
      '<button class="shop-ad-card" ' + (adDisabled ? 'disabled' : '') + ' onclick="watchRewardedAd(\'card\')">' +
        '<span class="icon">📺</span><span class="label">WATCH AD</span><span class="reward">1 🃏 card</span>' +
      '</button>' +
      '<button class="shop-ad-card" ' + (adDisabled ? 'disabled' : '') + ' onclick="watchRewardedAd(\'essence\')">' +
        '<span class="icon">📺</span><span class="label">WATCH AD</span><span class="reward">+5 ✦</span>' +
      '</button>' +
    '</div>';

  // ----- Phase D — Bundles (Squad / Rapid / Endgame Kit + Race Launch ×5) -----
  const purchasedRaces = (typeof _getPurchasedRaceBundles === 'function') ? _getPurchasedRaceBundles() : [];
  // SPRINT.1 §4.10 — Endgame Kit 3-state visibility:
  //   eligible        → fully clickable kit tile
  //   reason=cooldown → "(claimed)" disabled (whale knows it's coming back)
  //   else            → hidden (avoids "I want it, can't have it" frustration)
  const endgameElig = (typeof getEndgameKitEligibility === 'function')
    ? getEndgameKitEligibility()
    : { eligible: true, reason: null, blockers: [], lv10Count: 0 };
  // Analytics: shop-section view fires `endgame_kit_eligibility_blocked_view`
  // for funnel signal when player sees the shop while not eligible.
  if (!endgameElig.eligible) {
    try { logEvent(EVT.shop_section_viewed, { section: 'endgame_kit_blocked', blocker: endgameElig.reason }); } catch (e) {}
  }
  const squadBundleHtml =
    '<button class="shop-bundle shop-bundle-squad" onclick="buySquadPowerPack()">' +
      '<div class="shop-bundle-title">⚔ SQUAD POWER PACK</div>' +
      '<div class="shop-bundle-contents">' + SQUAD_POWER_T2 + ' ⚡ T2 · ' + SQUAD_POWER_CARDS + ' cards · ' + (SQUAD_POWER_ESSENCE_PER * 5) + ' shards · ' + SQUAD_POWER_GOLD + '💰</div>' +
      '<div class="shop-bundle-cost">$' + SQUAD_POWER_USD.toFixed(2) + ' / ' + SQUAD_POWER_GEMS + '💎</div>' +
    '</button>';
  const rapidBundleHtml =
    '<button class="shop-bundle shop-bundle-rapid" onclick="buyRapidAscensionPack()">' +
      '<div class="shop-bundle-title">⚡ RAPID ASCENSION PACK</div>' +
      '<div class="shop-bundle-contents">' + RAPID_ASCENSION_T2 + ' ⚡ T2 · ' + RAPID_ASCENSION_T3 + ' 💠 T3 · ' + RAPID_ASCENSION_CARDS + ' cards · ' + (RAPID_ASCENSION_ESSENCE_PER * 5) + ' shards · ' + RAPID_ASCENSION_GOLD + '💰</div>' +
      '<div class="shop-bundle-cost">$' + RAPID_ASCENSION_USD.toFixed(2) + ' / ' + RAPID_ASCENSION_GEMS + '💎</div>' +
    '</button>';
  let endgameBundleHtml = '';
  if (endgameElig.eligible) {
    // Eligible — full clickable tile
    endgameBundleHtml =
      '<button class="shop-bundle shop-bundle-endgame" onclick="buyEndgameKit()">' +
        '<div class="shop-bundle-title">👑 ULTIMATE ASCENSION KIT</div>' +
        '<div class="shop-bundle-contents">' + ENDGAME_KIT_T3 + ' 💠 T3 · ' + ENDGAME_KIT_T2 + ' ⚡ T2 · ' + ENDGAME_KIT_CARDS + ' cards · ' + ENDGAME_KIT_HEARTS + ' ♥ · BP premium · ARCHITECT badge</div>' +
        '<div class="shop-bundle-cost">$' + ENDGAME_KIT_USD.toFixed(2) + ' / ' + ENDGAME_KIT_GEMS + '💎</div>' +
      '</button>';
  } else if (endgameElig.reason === 'cooldown') {
    // Cooldown — keep visible as "(claimed)" disabled so whale knows it's coming back
    endgameBundleHtml =
      '<button class="shop-bundle shop-bundle-endgame" disabled>' +
        '<div class="shop-bundle-title">👑 ULTIMATE ASCENSION KIT (claimed)</div>' +
        '<div class="shop-bundle-contents">Available again next season</div>' +
      '</button>';
  } else {
    // chapter / levels blocker — hide entirely (no whale-bait for ineligibles)
    endgameBundleHtml = '';
  }
  // SHOP.6 — Race Bundle now hides for races already F2P-unlocked (no upside
  // to bundle if player has heroes via play) AND drops to $14.99. Race-banner
  // cosmetic mention added to desc as the new exclusive perk.
  const raceBundleCardsHtml = ['pirate', 'rock', 'shark', 'crocodile', 'spark'].filter(function (r) {
    return !_isRaceF2PUnlocked(r);
  }).map(function (r) {
    const owned = purchasedRaces.includes(r);
    const color = _PACK_RACE_COLORS[r] || '#FFD53D';
    const lbl = _PACK_RACE_LABELS[r];
    if (owned) {
      return '<button class="shop-race-bundle-card" disabled style="--rb-color:' + color + '">' +
               '<div class="name">' + lbl + ' BUNDLE</div>' +
               '<div class="desc">✓ OWNED · banner equipped</div>' +
               '<div class="cost">—</div>' +
             '</button>';
    }
    return '<button class="shop-race-bundle-card" style="--rb-color:' + color + '" onclick="buyRaceLaunchBundle(\'' + r + '\')">' +
             '<div class="name">' + lbl + ' BUNDLE</div>' +
             '<div class="desc">5 heroes · LV5 cap · 10✦ · 5 cards · race banner</div>' +
             '<div class="cost">$' + RACE_BUNDLE_USD.toFixed(2) + '</div>' +
           '</button>';
  }).join('');

  // SHOP.2 — Starter Pack tile (Day 4-14 only, one-shot). Top of shop for
  // prominence — this is the F2P→P conversion lever.
  const starterEligible = (typeof _isStarterPackEligible === 'function') && _isStarterPackEligible();
  const starterHtml = starterEligible
    ? '<button class="shop-bundle shop-bundle-endgame" onclick="buyStarterPack()" style="border-color:#FFAA00;background:linear-gradient(135deg,rgba(255,170,0,0.18),rgba(255,213,61,0.12))">' +
        '<div class="shop-bundle-title">★ SUMMONER\'S STARTER PACK · 1× ONLY</div>' +
        '<div class="shop-bundle-contents">1 random Captain · ' + STARTER_PACK_GEMS + '💎 · ' + STARTER_PACK_CARDS + ' cards · ' + STARTER_PACK_T2_STONES + ' T2 · ' + STARTER_PACK_GOLD + '💰 · FOUNDER badge</div>' +
        '<div class="shop-bundle-cost">$' + STARTER_PACK_USD.toFixed(2) + '</div>' +
      '</button>'
    : '';
  // SHOP.1-REV §4.10 — minimal mode hides all sections except:
  //   Tower Climber's Pack (top featured tile)
  //   Standard Hero Pack
  //   Hero card pity bar
  //   Cosmetics
  // Sections still rendered in minimal mode for player education without
  // adding visual noise: first-purchase banner (when applicable), buff
  // banner (when active), welcome-gift slot via _renderWelcomeGiftBannerIfPending.
  host.innerHTML =
    towerClimberHtml +
    firstPurchaseBannerHtml +
    buffActiveBanner +
    (minimal ? '' : starterHtml) +
    (minimal ? '' : subTileHtml) +
    (minimal ? '' : weeklyOfferHtml) +
    (minimal ? '' : dropBoostHtml) +
    (minimal ? '' :
      '<div class="shop-pack-divider">💎 GEM PACKS · Premium currency</div>' +
      gemPacksHtml +
      '<div class="shop-pack-divider">⚡ BIG / PREMIUM / ULTIMATE</div>' +
      bigPackHtml +
      premiumPackHtml +
      ultimatePackHtml +
      '<div class="shop-pack-divider">🎁 BUNDLES · Skip the grind</div>' +
      squadBundleHtml +
      rapidBundleHtml +
      endgameBundleHtml +
      '<div class="shop-pack-divider">🏴 RACE LAUNCH BUNDLES · 1× per race</div>' +
      '<div class="shop-race-bundle-grid">' + raceBundleCardsHtml + '</div>' +
      '<div class="shop-pack-divider">⏱ CONVENIENCE · 1-day bundles + boosts</div>' +
      megaBuffHtml +
      squadBoostHtml +
      dailyGiftHtml
    ) +
    '<div class="shop-pack-divider">📺 WATCH ADS · Free rewards (capped)</div>' +
    adCenterHtml +
    '<div class="shop-pack-divider">📦 HERO CARD PACKS · Earnable with gold</div>' +
    pityHtml +
    '<button class="shop-pack-btn shop-pack-standard" ' + (stdAffordable ? '' : 'disabled') + ' onclick="buyStandardPack()">' +
      '<span class="shop-pack-emoji">📦</span>' +
      '<span class="shop-pack-name">STANDARD HERO PACK</span>' +
      '<span class="shop-pack-desc">1 random hero card · weighted to less-owned</span>' +
      '<span class="shop-pack-cost">' + PACK_STANDARD_COST + ' 💰</span>' +
    '</button>' +
    (minimal ? '' :
      '<div class="shop-pack-divider">RACE PACKS</div>' +
      '<div class="shop-pack-grid">' + raceCardsHtml + '</div>' +
      '<div class="shop-pack-divider">🔁 CONVERT</div>' +
      goldToGemsHtml
    ) +
    '<div class="shop-pack-footer">Hero cards stockpile toward Tier 2 / Tier 3 / Mythic ascension. All cards earnable through play.</div>' +
    '<div class="shop-cosmetics-header">COSMETICS · Pure visual · No gameplay impact</div>' +
    cosmeticHtml +
    '<div class="shop-pack-footer">Cosmetics never affect combat — they live alongside the "Voice of the Forgotten" frame from Chapter 3 finale. Pure prestige.</div>';
}

// ─── setupShopEventListeners / cleanupShop — listener contract ──────────────
export function setupShopEventListeners() {
  // TODO(T1.12): attach delegated 'click' listener to #shopSectionOffers
  // host element; pick onclick attribute target dynamically (buyStandardPack /
  // buyRacePack / purchaseGemPack / buyMegaBuff / etc.) and invoke from
  // legacy global functions. Avoids re-attaching listeners per re-render.
}

export function cleanupShop() {
  // TODO(T1.12): remove listeners attached in setupShopEventListeners().
}
