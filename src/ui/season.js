// 2026-05-11 — TASK-012 (T1.11): season / Battle Pass screen relocated from legacy.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - goToSeason()                     line 37948-37962   (nav + rotation check)
//   - renderSeasonScreen()             line 37964-38107   (XP bar + premium status + 100 tier rows)
//   - _fmtReward()                     line 38109-38122   (reward icon formatter)
//
// SACRED PER CLAUDE.md §2.4: Battle Pass tier formula `xp = 500 + tier × 150`
// + season length + free/premium track split are sacred — preserved byte-perfect.
// Only DOM I/O + reward formatting lives in this module; the XP / tier math
// + claim flow + subscription state machine stay in legacy (will fold into
// src/core/season.js on follow-up).
//
// Owns: Battle Pass UI rendering. Card markup uses inline onclick attributes
// — preserved in T1.11 (legacy HTML stays untouched).
//
// Does NOT own:
//   - SEASON_REWARDS table — legacy module-scope (will move to src/data/season.js).
//   - getCurrentSeasonTier / getSeasonTierProgress / getTotalXPForTier /
//     addSeasonXP / claimSeasonTier / purchasePremiumPass / checkSeasonRotation
//     — that's progression state; legacy until follow-up.
//   - Subscription state machine (_isSeasonPassActive / _seasonPassDaysRemaining
//     / _seasonPassRenewalDateText / seasonPassSub / cancelSeasonPassSubscription
//     / subscribeToSeasonPass) — RevenueCat-adjacent; lives in legacy.
//
// 2026-05-11 — Roman: pure-relocation discipline.

/* eslint-disable no-empty, no-unused-vars, no-redeclare */

/* global document, showToast, showScreen,
   checkSeasonRotation, seasonState, seasonPassSub,
   getCurrentSeasonTier, getSeasonTierProgress, getTotalXPForTier,
   SEASON_TIER_COUNT, SEASON_LENGTH_DAYS, SEASON_PREMIUM_COST,
   SEASON_PASS_SUB_PRICE_USD, SEASON_PASS_SUB_GEMS_BONUS,
   SEASON_REWARDS, _isSeasonPassActive, _seasonPassDaysRemaining,
   _seasonPassRenewalDateText */

import { isFtueActive } from '../core/ftue-state.js';
import { log } from '../services/logger.js';

// ─── goToSeason — nav entry (legacy 37948-37962) ────────────────────────────
export function goToSeason() {
  if (typeof isFtueActive === 'function' && isFtueActive()) {
    try { showToast('Finish the tutorial first'); } catch (e) {}
    return;
  }
  checkSeasonRotation();
  if (typeof showScreen === 'function') {
    showScreen('season');
  } else {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const scr = document.getElementById('screenSeason');
    if (scr) scr.classList.add('active');
  }
  renderSeasonScreen();
}

// ─── renderSeasonScreen — full Battle Pass UI (legacy 37964-38107) ──────────
export function renderSeasonScreen() {
  const scr = document.getElementById('screenSeason');
  if (!scr) return;
  const curTier = getCurrentSeasonTier();
  const prog = getSeasonTierProgress();
  const xpDisp = document.getElementById('seasonXP');
  const tierDisp = document.getElementById('seasonCurrentTier');
  const progFill = document.getElementById('seasonProgressFill');
  const progText = document.getElementById('seasonProgressText');
  const seasonIdEl = document.getElementById('seasonId');
  const daysEl = document.getElementById('seasonDaysLeft');
  const premBtn = document.getElementById('seasonPremiumBtn');
  const premStatus = document.getElementById('seasonPremiumStatus');
  if (xpDisp) xpDisp.textContent = String(seasonState.xp);
  if (tierDisp) tierDisp.textContent = String(curTier);
  // 2026-04-30 — Polish v0.1 §A.1: TIER → LEVEL X OF Y wording. The
  // total-tier span lives next to the current-tier span so the label reads
  // "LEVEL 4 OF 100" instead of bare "TIER 4". Stays in sync with the
  // SEASON_TIER_COUNT constant if it ever changes.
  const tierTotalDisp = document.getElementById('seasonTierTotal');
  if (tierTotalDisp) tierTotalDisp.textContent = String(SEASON_TIER_COUNT);
  if (progFill) progFill.style.width = Math.round(prog * 100) + '%';
  if (progText) {
    if (curTier >= SEASON_TIER_COUNT) {
      progText.textContent = 'MAX LEVEL REACHED';
    } else {
      const fromTotal = getTotalXPForTier(curTier);
      const toTotal   = getTotalXPForTier(curTier + 1);
      progText.textContent = `${seasonState.xp - fromTotal} / ${toTotal - fromTotal} XP to Level ${curTier + 1}`;
    }
  }
  if (seasonIdEl) seasonIdEl.textContent = String(seasonState.seasonId || 1);
  // Days left
  if (daysEl) {
    let daysLeft = SEASON_LENGTH_DAYS;
    try {
      const start = new Date(seasonState.seasonStart);
      const elapsed = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24);
      daysLeft = Math.max(0, Math.ceil(SEASON_LENGTH_DAYS - elapsed));
    } catch (e) {}
    daysEl.textContent = `${daysLeft}d left`;
  }
  // Premium button/status
  // SHOP.4 (Phase 9 polish) — clarifies "one-time" vs subscription so the
  // two buy options are obviously distinct. Subscription tile renders below.
  if (premBtn) {
    if (seasonState.premiumUnlocked) {
      premBtn.style.display = 'none';
    } else {
      premBtn.style.display = '';
      premBtn.textContent = `ONE-TIME PREMIUM · ${SEASON_PREMIUM_COST}💎 (this season only)`;
    }
  }
  if (premStatus) {
    // Phase C: subscriber state shown distinctly from one-time premium.
    const subActive = (typeof _isSeasonPassActive === 'function') && _isSeasonPassActive();
    let label = 'FREE TRACK';
    let cls = '';
    if (subActive) {
      label = '★ SUBSCRIBER · ' + (seasonPassSub.autoRenew ? 'AUTO-RENEW' : 'ENDS ' + _seasonPassDaysRemaining() + 'd');
      cls = ' active subscriber';
    } else if (seasonState.premiumUnlocked) {
      label = '✓ PREMIUM ACTIVE';
      cls = ' active';
    }
    premStatus.textContent = label;
    premStatus.className = 'season-premium-status' + cls;
  }
  // Phase C: render subscription card under the premium button. Inserts only
  // once; subsequent renders update via querySelector. The card swaps between
  // "Subscribe" (when not active) and "Manage" (when active).
  try {
    const card = document.querySelector('.season-progress-card');
    if (card) {
      let subCard = card.querySelector('.season-sub-card');
      if (!subCard) {
        subCard = document.createElement('div');
        subCard.className = 'season-sub-card';
        card.appendChild(subCard);
      }
      const subActive = (typeof _isSeasonPassActive === 'function') && _isSeasonPassActive();
      if (subActive) {
        const renew = _seasonPassRenewalDateText();
        const status = seasonPassSub.autoRenew
          ? 'Auto-renews ' + (renew || 'in ' + _seasonPassDaysRemaining() + 'd')
          : 'Cancels in ' + _seasonPassDaysRemaining() + 'd · no auto-renewal';
        subCard.innerHTML =
          '<div class="season-sub-active">' +
            '<div class="season-sub-icon">★</div>' +
            '<div class="season-sub-info">' +
              '<div class="season-sub-title">SEASON PASS · SUBSCRIBED</div>' +
              '<div class="season-sub-status">' + status + '</div>' +
            '</div>' +
            (seasonPassSub.autoRenew
              ? '<button class="season-sub-cancel" onclick="cancelSeasonPassSubscription()">CANCEL</button>'
              : '<div class="season-sub-pending">CANCELED</div>') +
          '</div>';
      } else {
        subCard.innerHTML =
          '<button class="season-sub-btn" onclick="subscribeToSeasonPass()">' +
            '<div class="season-sub-btn-title">★ SUBSCRIBE · $' + SEASON_PASS_SUB_PRICE_USD.toFixed(2) + '/mo</div>' +
            '<div class="season-sub-btn-sub">' + SEASON_PASS_SUB_GEMS_BONUS + '💎/season · auto-premium · 2× retries · 2× login</div>' +
          '</button>';
      }
    }
  } catch (e) { log.warn('subscription card render failed:', e); }
  // Render tier list
  const list = document.getElementById('seasonTierList');
  if (!list) return;
  list.innerHTML = '';
  for (let t = 1; t <= SEASON_TIER_COUNT; t++) {
    const bundle = SEASON_REWARDS[t - 1];
    const row = document.createElement('div');
    row.className = 'season-tier-row';
    if (t <= curTier) row.classList.add('unlocked');
    if (t > curTier)  row.classList.add('locked');
    // Highlight headline tiers
    if (t === 10 || t === 25 || t === 50) row.classList.add('headline');
    // Build markup
    const freeClaimed  = seasonState.claimedFree.includes(t);
    const premClaimed  = seasonState.claimedPremium.includes(t);
    const canClaimFree = (t <= curTier) && !freeClaimed;
    const canClaimPrem = (t <= curTier) && !premClaimed && seasonState.premiumUnlocked;
    const freeLabel = _fmtReward(bundle.free);
    const premLabel = _fmtReward(bundle.premium);
    row.innerHTML = `
      <div class="season-tier-num">T${t}</div>
      <div class="season-tier-track free">
        <div class="season-tier-reward">${freeLabel}</div>
        ${freeClaimed ? '<div class="season-tier-claim claimed">✓</div>' :
          canClaimFree ? `<button class="season-tier-claim" onclick="claimSeasonTier(${t}, 'free')">CLAIM</button>` :
          '<div class="season-tier-claim locked">—</div>'}
      </div>
      <div class="season-tier-track premium">
        <div class="season-tier-reward">${premLabel}</div>
        ${premClaimed ? '<div class="season-tier-claim claimed">✓</div>' :
          canClaimPrem ? `<button class="season-tier-claim premium-claim" onclick="claimSeasonTier(${t}, 'premium')">CLAIM</button>` :
          (t <= curTier && !seasonState.premiumUnlocked) ? '<div class="season-tier-claim locked">🔒</div>' :
          '<div class="season-tier-claim locked">—</div>'}
      </div>
    `;
    list.appendChild(row);
  }
}

// ─── _fmtReward — reward icon formatter (legacy 38109-38122) ────────────────
function _fmtReward(r) {
  if (!r) return '—';
  const parts = [];
  if (r.cards)   parts.push(`${r.cards}🎴`);
  if (r.t3)      parts.push(`${r.t3}💠`);
  if (r.t2)      parts.push(`${r.t2}⚡`);
  if (r.hearts)  parts.push(`${r.hearts}♥`);
  if (r.gold)    parts.push(`${r.gold}💰`);
  if (r.gems)    parts.push(`${r.gems}💎`);
  if (r.shards)  parts.push(`${r.shards}✦`);
  if (r.essenceRandom) parts.push(`${r.essenceRandom}🔮`);
  if (r.label)   parts.push('🎖');
  return parts.length ? parts.join(' · ') : '—';
}

// ─── setupSeasonEventListeners / cleanupSeason — listener contract ──────────
export function setupSeasonEventListeners() {
  // TODO(T1.12): attach 'click' listeners to:
  //   #seasonPremiumBtn → purchasePremiumPass
  //   delegated #seasonTierList click → claimSeasonTier(tier, track)
  //   .season-sub-btn → subscribeToSeasonPass
  //   .season-sub-cancel → cancelSeasonPassSubscription
  //   #backFromSeasonBtn → goToMenu
}

export function cleanupSeason() {
  // TODO(T1.12): remove listeners attached in setupSeasonEventListeners().
}
