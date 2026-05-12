// 2026-05-11 — TASK-012 (T1.11): profile screen relocated from legacy.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - goToProfile()                    line 67058-67065   (FTUE-gated nav)
//   - renderProfile()                  line 36234-36238   (header + active tab dispatcher)
//   - renderProfileHeader()            line 36240-36315   (avatar + username + title + level XP + banner + friend code)
//   - renderProfileTab(tab)            line 37397-37410   (6-tab dispatcher: stats / journey / roster /
//                                                          achievements / tower / social)
//
// Companion sub-renderers (left in legacy until follow-up; this module is the
// dispatcher contract):
//   - renderProfileTabStats           line 37258-37388   (lifetime stats dashboard)
//   - renderProfileTabJourney         line 37052-37095   (chapter timeline)
//   - renderProfileTabRoster          line 36826-36913   (unlocked-heroes grid)
//   - renderProfileTabAchievements    line 36974-37051   (badge grid)
//   - renderProfileTabTower           line 37097-37225   (tower stats)
//   - renderProfileTabSocial          line 36608-36723   (friends + leaderboard)
//   - renderProfileScreen             line 44532-44595   (Phase 6 cosmetic overlay — separate surface)
//   - openEditProfile / openAvatarPicker / openUsernameEditor / etc.
//
// Owns: top-level Profile screen dispatcher + header renderer. Profile is the
// most fragmented screen in legacy (6 tabs × ~80-130 LoC each + cosmetics
// overlay + edit-profile sheet), so T1.11 lands the canonical entry points
// and leaves the sub-renderers in legacy with `/* global */` references — a
// follow-up cleanup task can fold each sub-tab into its own module if needed.
//
// Does NOT own:
//   - Hero ascension flows (ascendHeroT3 / ascendHeroMythic) — those are
//     progression-state mutators, owned by src/core/progression.js (T1.10.2).
//   - Cosmetics state (_phase6GetActiveFrame etc.) — Phase 6 cosmetic
//     subsystem stays in legacy.
//   - XP curve _xpForLevel / addProfileXp / trackProfile* — profile-state
//     accumulators are progression-adjacent; will fold into a future
//     src/core/player-profile.js extraction.
//
// 2026-05-11 — Roman: pure-relocation discipline.

/* eslint-disable no-empty, no-unused-vars */

// T1.13.1: /* global */ → ES imports for resolved src/ exports.
import { isFtueActive } from '../core/ftue-state.js';
import { showScreen } from './router.js';
import { ASSETS } from '../data/assets.js';
import { log } from '../services/logger.js';

/* global flashText, vibrate, playerProfile, leaderHeroId,
   activeSquad, HERO_ROSTER, _ensureProfileBootstrap,
   getActiveProfileTitle, getActiveTitle, _hasFounderBadge,
   _xpForLevel, _profileActiveTab,
   renderProfileTabStats, renderProfileTabJourney, renderProfileTabRoster,
   renderProfileTabAchievements, renderProfileTabTower, renderProfileTabSocial */
// LEGACY-ONLY: above tokens have no src/ export — shims retired in T1.14+ cleanup.

// ─── goToProfile — FTUE-gated nav (legacy 67058-67065) ──────────────────────
export function goToProfile() {
  if (typeof isFtueActive === 'function' && isFtueActive()) {
    try { flashText('FINISH THE TUTORIAL FIRST', '#8A88A0'); } catch(e){}
    return;
  }
  try { _ensureProfileBootstrap(); } catch (e) {}
  showScreen('profile');
}

// ─── renderProfile — header + active tab dispatcher (legacy 36234-36238) ────
export function renderProfile() {
  try { _ensureProfileBootstrap(); } catch (e) {}
  try { renderProfileHeader(); } catch (e) { log.warn('renderProfileHeader failed:', e); }
  try { renderProfileTab(_profileActiveTab); } catch (e) { log.warn('renderProfileTab failed:', e); }
}

// ─── renderProfileHeader — avatar / level / title / banner (legacy 36240-36315) ──
export function renderProfileHeader() {
  // Avatar — selected hero, else leader/squad fallback.
  const avHeroId = playerProfile.avatarHeroId
    || (typeof leaderHeroId !== 'undefined' && leaderHeroId)
    || (Array.isArray(activeSquad) && activeSquad[0])
    || ((HERO_ROSTER.find(h => h && h.unlocked) || {}).id);
  const avHero = avHeroId ? HERO_ROSTER.find(h => h.id === avHeroId) : null;
  const avSrc  = (avHero && typeof ASSETS !== 'undefined' && ASSETS[avHero.img]) || '';
  const avImg = document.getElementById('profileAvatarImg');
  if (avImg) avImg.src = avSrc;

  // Username
  const unameEl = document.getElementById('profileUsername');
  if (unameEl) unameEl.textContent = playerProfile.username || 'SUMMONER';

  // Title — P4 picker takes priority (selectedTitle stamped in playerProfile),
  // else fall back to existing Tower title system.
  const titleEl = document.getElementById('profileTitle');
  let title = 'Warchief';
  try {
    if (typeof getActiveProfileTitle === 'function') title = getActiveProfileTitle() || title;
    else if (typeof getActiveTitle === 'function') title = getActiveTitle() || title;
  } catch (e) {}
  // 2026-04-29 — First Purchase Bonus (spec §10.3) Founder badge prefix.
  // Permanent profile cosmetic — visible across all profile renders for any
  // player who has completed at least one IAP. Stays in front of any other
  // title source so it always reads first.
  // 2026-04-30 — Polish v0.1 §A.1 "FOUNDER tooltip" — when the badge is active
  // we attach an HTML `title` tooltip "Early supporter rank" so non-IAP players
  // hovering it (and IAP players curious what "FOUNDER" means) get a one-liner
  // explanation without taking up screen space.
  let _isFounder = false;
  try {
    if (typeof _hasFounderBadge === 'function' && _hasFounderBadge()) {
      title = '★ FOUNDER · ' + title;
      _isFounder = true;
    }
  } catch (e) {}
  if (titleEl) {
    titleEl.textContent = title;
    if (_isFounder) titleEl.title = 'Early supporter rank';
    else titleEl.removeAttribute('title');
  }

  // Banner tag (P5 fills)
  const tagEl = document.getElementById('profileBannerTag');
  if (tagEl) {
    if (playerProfile.selectedBannerId) {
      tagEl.textContent = playerProfile.selectedBannerId;
      tagEl.hidden = false;
    } else {
      tagEl.hidden = true;
    }
  }

  // Level + XP (P2 fills accumulators; P0 shows level 1 / 0 XP defaults)
  const lvlEl = document.getElementById('profileLevel');
  const fillEl = document.getElementById('profileXpFill');
  const xpTextEl = document.getElementById('profileXpText');
  const lvl = playerProfile.level || 1;
  const xp = playerProfile.xp || 0;
  const xpToNext = _xpForLevel(lvl + 1) - _xpForLevel(lvl);
  const xpInLevel = xp - _xpForLevel(lvl);
  const pct = xpToNext > 0 ? Math.min(100, Math.floor((xpInLevel / xpToNext) * 100)) : 0;
  if (lvlEl) lvlEl.textContent = String(lvl);
  if (fillEl) fillEl.style.width = pct + '%';
  if (xpTextEl) xpTextEl.textContent = xpInLevel.toLocaleString() + ' / ' + xpToNext.toLocaleString() + ' XP';

  // Background
  const banner = document.getElementById('profileBanner');
  if (banner) banner.setAttribute('data-bg', playerProfile.selectedBackgroundId || 'default');

  // Friend code (P1) — display in banner action row
  const fcEl = document.getElementById('profileFriendCode');
  if (fcEl) fcEl.textContent = playerProfile.friendCode || 'BLO-XXXX-XXXX';
}

// ─── renderProfileTab — 6-tab dispatcher (legacy 37397-37410) ───────────────
export function renderProfileTab(tab) {
  const body = document.getElementById('profileBody');
  if (!body) return;
  // P0: all renderers are placeholders. P1-P6 replace these.
  const placeholder = (label, phase) =>
    '<div class="profile-body-placeholder">' + label + '<small>Implementation in ' + phase + '</small></div>';
  if      (tab === 'stats')        body.innerHTML = (typeof renderProfileTabStats        === 'function') ? renderProfileTabStats()        : placeholder('Stats Dashboard',   'P2');
  else if (tab === 'journey')      body.innerHTML = (typeof renderProfileTabJourney      === 'function') ? renderProfileTabJourney()      : placeholder('Journey',           'P3');
  else if (tab === 'roster')       body.innerHTML = (typeof renderProfileTabRoster       === 'function') ? renderProfileTabRoster()       : placeholder('Hero Roster',       'P1');
  else if (tab === 'achievements') body.innerHTML = (typeof renderProfileTabAchievements === 'function') ? renderProfileTabAchievements() : placeholder('Achievements',      'P4');
  else if (tab === 'tower')        body.innerHTML = (typeof renderProfileTabTower        === 'function') ? renderProfileTabTower()        : placeholder('Tower Stats',       'P3');
  else if (tab === 'social')       body.innerHTML = (typeof renderProfileTabSocial       === 'function') ? renderProfileTabSocial()       : placeholder('Social',            'P6');
  else                              body.innerHTML = placeholder('Unknown tab', '?');
}

// ─── setupProfileEventListeners / cleanupProfile — listener contract ───────
export function setupProfileEventListeners() {
  // TODO(T1.12): attach 'click' listeners to:
  //   #profileEditBtn → openEditProfile
  //   #profileAvatarImg → openAvatarPicker
  //   #profileCopyFriendBtn → copyFriendCode
  //   delegated profile-tab nav clicks → renderProfileTab(tab)
  //   #profileCloseBtn → goToMenu
}

export function cleanupProfile() {
  // TODO(T1.12): remove listeners attached in setupProfileEventListeners().
}
