// 2026-05-13 — TASK-054 (T3.06): Friend leaderboard mini-block — UI.
//
// Spec: docs/design/endgame-social.md §5 (Friend leaderboard mini-block)
//       + §15 ESC-03 Q5 ruling — navigator.share OS-native only (MVP).
//
// SIXTH Phase 3 implementation task (Wave-4 social bridge). Wave-3 shipped
// Adventures backend + UI (T3.02–T3.05); T3.06 ships the friend-graph
// widget that surfaces clan members + Tower season top-N as a mini-block
// on the menu screen, plus a full-screen `'friends'` route for the deep
// list. The friend-graph data layer (aggregation + invite deeplink
// handling) lives in src/services/friend-graph-backend.js.
//
// What this module ships:
//   1. renderFriendLeaderboardWidget(rootEl, playerId)  — menu mini-block
//   2. renderFullFriendList(rootEl, playerId)           — 'friends' route
//   3. Pure helpers (re-exported from friend-graph-backend for tests):
//        - sortFriendsByTowerFloor / getTopNFriends — already exported by
//          backend; UI delegates rather than duplicating.
//   4. navigator.share invite flow per ESC-03 Q5 (OS-native only).
//   5. Empty / loading / error states for every async path.
//
// Performance contract (spec §5.4):
//   - Widget render ≤100ms (menu-screen embed).
//   - Full list render ≤200ms (uncached path; cached path ≤200ms p99).
//
// Sacred-cow safety (CLAUDE.md §2):
//   - READ-ONLY consumer of friend-graph-backend + clan-backend.
//   - TOWER_LEADERBOARDS sacred config NEVER mutated — friend graph reads
//     via fetchTowerSeasonTop (mock-store path until T3.06.1 wires live
//     Firestore read-only query).
//   - PURE PATH F2P-only leaderboard NEVER contaminated.
//   - getPlayerSegment() NEVER called from this module (no P2W surface).
//   - Sort key = Tower floor descending; NEVER lifetime spend (ADR-003).
//   - No V_HAPTICS / NARRATOR_LINES additions.
//   - Defensive try/catch on every async op.
//
// Public API:
//   - renderFriendLeaderboardWidget(rootEl, playerId)
//   - renderFullFriendList(rootEl, playerId)
//   - resolveCurrentPlayerId()                  — pure read of save state
//   - __friendLeaderboardTestables              — test-only escape hatches

/* eslint-disable no-empty, no-unused-vars */

import {
  fetchFriendsForPlayer,
  buildInviteShareContent,
  generateInviteToken,
  getTopNFriends,
  sortFriendsByTowerFloor,
  FRIEND_SOURCE_CLAN,
  FRIEND_SOURCE_TOWER,
  FRIEND_SOURCE_INVITE,
} from '../services/friend-graph-backend.js';
import { log } from '../services/logger.js';

// ─── Performance budgets (spec §5.4) ───────────────────────────────────
const FRIEND_WIDGET_BUDGET_MS = 100;
const FRIEND_FULL_LIST_BUDGET_MS = 200;

/** Widget shows top-3 (medal podium) per spec §5.1. */
const WIDGET_TOP_N = 3;

/** Medal emoji per rank slot. */
const MEDAL_EMOJI = Object.freeze(['🥇', '🥈', '🥉']);

// ─── Module state — per-session caches + last fetch timestamps ─────────
let _widgetMount = null;
let _fullListMount = null;
let _viewerPlayerId = null;
let _friendsCache = null;   // null = no fetch yet; Array = cached list
let _lastFetchAt = 0;

/** Cache TTL — 5 min per spec §5.4 ("Friend list fetch (cached) ≤200ms p99"). */
const FRIEND_CACHE_TTL_MS = 5 * 60 * 1000;

// ─── Player ID resolution (mirrors adventures.js pattern) ──────────────
export function resolveCurrentPlayerId() {
  try {
    if (typeof localStorage === 'undefined') return 'anonymous';
    const name = localStorage.getItem('blocksworn_p8_player_name');
    if (typeof name === 'string' && name.trim().length > 0) {
      return name.trim().toLowerCase();
    }
  } catch (_e) { /* private mode */ }
  return 'anonymous';
}

// ─── HTML escape ─────────────────────────────────────────────────────
function _escape(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Build HTML for a single friend row ───────────────────────────────
function _friendRowHTML(friend, rank) {
  const pid = _escape((friend && friend.playerId) || '');
  const floor = (friend && typeof friend.currentTowerFloor === 'number')
    ? Math.max(0, Math.floor(friend.currentTowerFloor)) : 0;
  const medal = (rank >= 0 && rank < MEDAL_EMOJI.length) ? MEDAL_EMOJI[rank] : '';
  const medalClass = (rank === 0) ? ' friend-row--gold'
                  : (rank === 1) ? ' friend-row--silver'
                  : (rank === 2) ? ' friend-row--bronze' : '';
  const floorLabel = floor > 0 ? `Floor ${floor}` : 'No run yet';
  return [
    `<li class="friend-row${medalClass}" data-friend-id="${pid}">`,
    `<span class="friend-medal" aria-hidden="true">${medal}</span>`,
    `<span class="friend-name">${pid}</span>`,
    `<span class="friend-floor">${_escape(floorLabel)}</span>`,
    `</li>`,
  ].join('');
}

// ─── Empty / loading / error states ───────────────────────────────────
function _widgetEmptyStateHTML() {
  return [
    `<div class="friend-leaderboard-widget__empty">`,
    `<div class="friend-leaderboard-widget__empty-text">No friends yet</div>`,
    `<button type="button" id="friendInviteEmptyBtn" class="friend-invite-btn">`,
    `Invite friends to compete →`,
    `</button>`,
    `</div>`,
  ].join('');
}

function _widgetLoadingStateHTML() {
  return `<div class="friend-leaderboard-widget__loading">Loading friends…</div>`;
}

function _widgetErrorStateHTML() {
  return [
    `<div class="friend-leaderboard-widget__error">`,
    `<div class="friend-leaderboard-widget__error-text">Friends unavailable (offline)</div>`,
    `</div>`,
  ].join('');
}

// ─── Widget HTML (mini-block on menu) ─────────────────────────────────
function _widgetHTML(friends) {
  const top = getTopNFriends(friends, WIDGET_TOP_N);
  if (!Array.isArray(friends) || friends.length === 0) {
    return [
      `<div class="friend-leaderboard-widget" id="friendLeaderboardWidget" role="region" aria-label="Friends Tower runs">`,
      `<header class="friend-leaderboard-widget__header">`,
      `<h3 class="friend-leaderboard-widget__title">FRIENDS' TOWER RUNS</h3>`,
      `</header>`,
      _widgetEmptyStateHTML(),
      `</div>`,
    ].join('');
  }
  const rowsHTML = top.map((f, i) => _friendRowHTML(f, i)).join('');
  const more = friends.length - top.length;
  const moreHTML = more > 0
    ? `<button type="button" id="friendViewAllBtn" class="friend-view-all-btn">View all ▸</button>`
    : `<button type="button" id="friendViewAllBtn" class="friend-view-all-btn">View all ▸</button>`;
  return [
    `<div class="friend-leaderboard-widget" id="friendLeaderboardWidget" role="region" aria-label="Friends Tower runs">`,
    `<header class="friend-leaderboard-widget__header">`,
    `<h3 class="friend-leaderboard-widget__title">FRIENDS' TOWER RUNS</h3>`,
    `</header>`,
    `<ul class="friend-leaderboard-widget__list">`,
    rowsHTML,
    `</ul>`,
    `<div class="friend-leaderboard-widget__footer">`,
    moreHTML,
    `</div>`,
    `</div>`,
  ].join('');
}

// ─── Full list HTML (entire 'friends' route) ──────────────────────────
function _fullListHTML(friends, viewerId) {
  const sorted = sortFriendsByTowerFloor(friends || []);
  const headerHTML = [
    `<header class="friend-full-list__header">`,
    `<button type="button" id="friendBackBtn" class="friend-back-btn" aria-label="Back to menu">←</button>`,
    `<h2 class="friend-full-list__title">FRIENDS</h2>`,
    `<button type="button" id="friendInviteBtn" class="friend-invite-btn friend-invite-btn--header">+ Invite</button>`,
    `</header>`,
  ].join('');

  if (sorted.length === 0) {
    return [
      `<div class="friend-full-list" id="friendFullList">`,
      headerHTML,
      `<div class="friend-full-list__empty">`,
      `<div class="friend-full-list__empty-text">No friends yet — Adventures clan members and Tower season top players will appear here automatically.</div>`,
      `<button type="button" id="friendInviteEmptyBtn" class="friend-invite-btn">Invite friends to compete →</button>`,
      `</div>`,
      `</div>`,
    ].join('');
  }
  const rows = sorted.map((f, i) => {
    const pid = _escape(f.playerId || '');
    const floor = (typeof f.currentTowerFloor === 'number') ? Math.max(0, Math.floor(f.currentTowerFloor)) : 0;
    const source = (f.source === FRIEND_SOURCE_CLAN) ? 'Clan'
                : (f.source === FRIEND_SOURCE_TOWER) ? 'Tower'
                : (f.source === FRIEND_SOURCE_INVITE) ? 'Invite' : '—';
    const medalClass = (i === 0) ? ' friend-row--gold'
                    : (i === 1) ? ' friend-row--silver'
                    : (i === 2) ? ' friend-row--bronze' : '';
    const youBadge = (f.playerId === viewerId) ? ' <span class="friend-you-badge">(You)</span>' : '';
    return [
      `<li class="friend-row friend-row--full${medalClass}" data-friend-id="${pid}">`,
      `<span class="friend-rank" aria-hidden="true">#${i + 1}</span>`,
      `<span class="friend-name">${pid}${youBadge}</span>`,
      `<span class="friend-source">${_escape(source)}</span>`,
      `<span class="friend-floor">${floor > 0 ? `Floor ${floor}` : 'No run'}</span>`,
      `<button type="button" class="friend-challenge-btn" data-challenge-id="${pid}" disabled aria-disabled="true">Challenge</button>`,
      `</li>`,
    ].join('');
  }).join('');
  return [
    `<div class="friend-full-list" id="friendFullList">`,
    headerHTML,
    `<ul class="friend-full-list__list">`,
    rows,
    `</ul>`,
    `</div>`,
  ].join('');
}

// ─── Invite share flow (navigator.share OS-native per ESC-03 Q5) ──────
function _triggerInviteShare(viewerId) {
  try {
    const token = generateInviteToken();
    const playerName = viewerId || 'a friend';
    const content = buildInviteShareContent(playerName, 0, token);
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      // Graceful no-op fallback — clipboard copy if available.
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(content.url).catch(() => { /* swallow */ });
        }
      } catch (_e) {}
      return;
    }
    navigator.share({
      title: content.title,
      text: content.text,
      url: content.url,
    }).catch(() => { /* user cancelled — silent */ });
  } catch (e) {
    try { log.warn('[friend-leaderboard] invite share failed:', e); } catch (_e) {}
  }
}

// ─── Toast helper ─────────────────────────────────────────────────────
/**
 * Show a transient toast message. Pure DOM — no haptics, no narrator copy.
 * @param {string} msg
 */
export function showFriendToast(msg) {
  if (typeof document === 'undefined') return;
  try {
    let host = document.getElementById('friendToastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'friendToastHost';
      host.className = 'friend-toast-host';
      document.body.appendChild(host);
    }
    const toast = document.createElement('div');
    toast.className = 'friend-toast';
    toast.textContent = String(msg || '');
    host.appendChild(toast);
    setTimeout(() => {
      try { if (toast.parentNode) toast.parentNode.removeChild(toast); } catch (_e) {}
    }, 3000);
  } catch (_e) {}
}

// ─── Cache helpers ────────────────────────────────────────────────────
function _isCacheValid() {
  return _friendsCache !== null
      && (Date.now() - _lastFetchAt) < FRIEND_CACHE_TTL_MS;
}

async function _loadFriends(playerId) {
  if (_isCacheValid()) return { ok: true, friends: _friendsCache };
  try {
    const result = await fetchFriendsForPlayer(playerId);
    if (result && result.ok) {
      _friendsCache = Array.isArray(result.friends) ? result.friends : [];
      _lastFetchAt = Date.now();
      return { ok: true, friends: _friendsCache };
    }
    return { ok: false, friends: [], reason: (result && result.reason) || 'exception' };
  } catch (e) {
    try { log.warn('[friend-leaderboard] _loadFriends failed:', e); } catch (_e) {}
    return { ok: false, friends: [], reason: 'exception' };
  }
}

// ─── Widget renderer ──────────────────────────────────────────────────
/**
 * Mount the friend-leaderboard mini-block widget. Defensive — never throws.
 *
 * @param {HTMLElement} rootEl
 * @param {string} [playerId]
 */
export function renderFriendLeaderboardWidget(rootEl, playerId) {
  if (!rootEl) return;
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  _widgetMount = rootEl;
  _viewerPlayerId = playerId || resolveCurrentPlayerId();

  // Initial render — loading state.
  try { rootEl.innerHTML = _widgetLoadingStateHTML(); } catch (_e) {}

  // Async load.
  _loadFriends(_viewerPlayerId).then((result) => {
    try {
      if (!result || !result.ok) {
        rootEl.innerHTML = _widgetErrorStateHTML();
        _wireWidgetListeners(rootEl);
        return;
      }
      rootEl.innerHTML = _widgetHTML(result.friends);
      _wireWidgetListeners(rootEl);
      const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const elapsed = t1 - t0;
      if (elapsed > FRIEND_WIDGET_BUDGET_MS) {
        try { log.warn(`[friend-leaderboard] widget render ${elapsed.toFixed(1)}ms > ${FRIEND_WIDGET_BUDGET_MS}ms budget`); } catch (_e) {}
      }
    } catch (e) {
      try { log.warn('[friend-leaderboard] widget render failed:', e); } catch (_e) {}
      try { rootEl.innerHTML = _widgetErrorStateHTML(); } catch (_e2) {}
    }
  }).catch(() => {
    try { rootEl.innerHTML = _widgetErrorStateHTML(); } catch (_e) {}
  });
}

function _wireWidgetListeners(rootEl) {
  if (!rootEl) return;
  try {
    const viewAll = rootEl.querySelector ? rootEl.querySelector('#friendViewAllBtn') : null;
    if (viewAll && typeof viewAll.addEventListener === 'function') {
      viewAll.addEventListener('click', () => {
        try {
          if (typeof window !== 'undefined' && typeof window.showScreen === 'function') {
            window.showScreen('friends');
          }
        } catch (_e) {}
      });
    }
    const inviteEmpty = rootEl.querySelector ? rootEl.querySelector('#friendInviteEmptyBtn') : null;
    if (inviteEmpty && typeof inviteEmpty.addEventListener === 'function') {
      inviteEmpty.addEventListener('click', () => {
        _triggerInviteShare(_viewerPlayerId);
      });
    }
  } catch (_e) {}
}

// ─── Full-list renderer ───────────────────────────────────────────────
/**
 * Mount the full-screen friend list ('friends' route). Defensive.
 *
 * @param {HTMLElement} rootEl
 * @param {string} [playerId]
 */
export function renderFullFriendList(rootEl, playerId) {
  if (!rootEl) return;
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  _fullListMount = rootEl;
  _viewerPlayerId = playerId || resolveCurrentPlayerId();

  try { rootEl.innerHTML = _widgetLoadingStateHTML(); } catch (_e) {}

  _loadFriends(_viewerPlayerId).then((result) => {
    try {
      const friends = (result && result.ok && Array.isArray(result.friends)) ? result.friends : [];
      rootEl.innerHTML = _fullListHTML(friends, _viewerPlayerId);
      _wireFullListListeners(rootEl);
      const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const elapsed = t1 - t0;
      if (elapsed > FRIEND_FULL_LIST_BUDGET_MS) {
        try { log.warn(`[friend-leaderboard] full list render ${elapsed.toFixed(1)}ms > ${FRIEND_FULL_LIST_BUDGET_MS}ms budget`); } catch (_e) {}
      }
    } catch (e) {
      try { log.warn('[friend-leaderboard] full list render failed:', e); } catch (_e) {}
    }
  }).catch(() => {
    try { rootEl.innerHTML = _widgetErrorStateHTML(); } catch (_e) {}
  });
}

function _wireFullListListeners(rootEl) {
  if (!rootEl) return;
  try {
    const back = rootEl.querySelector ? rootEl.querySelector('#friendBackBtn') : null;
    if (back && typeof back.addEventListener === 'function') {
      back.addEventListener('click', () => {
        try {
          if (typeof window !== 'undefined' && typeof window.showScreen === 'function') {
            window.showScreen('menu');
          }
        } catch (_e) {}
      });
    }
    const inviteHeader = rootEl.querySelector ? rootEl.querySelector('#friendInviteBtn') : null;
    if (inviteHeader && typeof inviteHeader.addEventListener === 'function') {
      inviteHeader.addEventListener('click', () => {
        _triggerInviteShare(_viewerPlayerId);
      });
    }
    const inviteEmpty = rootEl.querySelector ? rootEl.querySelector('#friendInviteEmptyBtn') : null;
    if (inviteEmpty && typeof inviteEmpty.addEventListener === 'function') {
      inviteEmpty.addEventListener('click', () => {
        _triggerInviteShare(_viewerPlayerId);
      });
    }
  } catch (_e) {}
}

// ─── Test-only escape hatches ─────────────────────────────────────────
/**
 * Reset module state for deterministic test asserts.
 */
export const __friendLeaderboardTestables = Object.freeze({
  reset() {
    _widgetMount = null;
    _fullListMount = null;
    _viewerPlayerId = null;
    _friendsCache = null;
    _lastFetchAt = 0;
  },
  setCache(friends) {
    _friendsCache = Array.isArray(friends) ? friends.slice() : null;
    _lastFetchAt = friends ? Date.now() : 0;
  },
  getCache() {
    return _friendsCache ? _friendsCache.slice() : null;
  },
  invalidateCache() {
    _friendsCache = null;
    _lastFetchAt = 0;
  },
  // Surface render helpers as pure HTML builders so unit tests can assert
  // shape without driving the async load path.
  _widgetHTML,
  _fullListHTML,
  _friendRowHTML,
  _triggerInviteShare,
});
