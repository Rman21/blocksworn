// 2026-05-13 — TASK-051 (T3.03): Adventures UI — clan create/browse/join/view/leave.
// 2026-05-13 — TASK-053 (T3.05): Contributor stats + clan progression UI —
//   extends `renderClanDetail` with two NEW additive sub-renders:
//     - renderContributorStatsPanel (top-3 highlighted + self badge + expand)
//     - renderClanProgressionPanel  (level + 3-state cosmetic unlock list)
//   Spec: docs/design/endgame-social.md §2.3 (Contributor stats) + §2.4
//   (Persistent clan progression). T3.03 render-mount logic + T3.04 weekly-
//   rotation hook UNTOUCHED — both panels are inserted between WEEKLY TARGET
//   and MEMBERS sections inside `renderClanDetail`.
//
// Spec: docs/design/endgame-social.md §2 (Adventures — async clan 5–15)
//       + §2.1 (clan creation + join flows)
//       + §2.5 (async hooks — emoji-only invite via navigator.share)
//       + §2.6 (performance: FCP ≤300ms; clan list ≤100ms; search ≤200ms)
//       + §15 ESC-03 Q1 ruling — clan size 5–15 HARD CAP, no exceptions.
//       + Q5 navigator.share OS-native only — no in-app social UI.
//
// FIFTH Phase 3 implementation task (Wave-3 UI follow-on to T3.02 backend).
// T3.02 shipped 17 imports: 8 pure helpers + 9 async CRUD ops + frozen
// constants. T3.03 builds the consumer UI — direct-imports per T3.08/T3.09
// precedent, never bloats the window-bridge surface beyond the +1 minimal
// __getPlayerClanCount entry T3.02 added.
//
// What this module ships:
//   1. Mobile-first 2-tab screen (Your Clans / Browse) with parchment
//      aesthetic matching Codex (T2.12) and Replay viewer (T3.08).
//   2. Create-clan modal — name validation (3–30 chars), description
//      validation (0–200 chars), inline validation feedback.
//   3. Browse view — search-by-name + join-button per result.
//   4. Clan detail view — member roster + weekly stub (T3.04 wires the
//      real boss-of-the-week) + leave/invite actions.
//   5. Owner-leave guard — clicking Leave as owner surfaces transfer prompt
//      (the actual transfer flow is single-tap via the member roster row).
//   6. navigator.share invite per spec §2.5 + ESC-03 Q5 (OS-native only).
//   7. Empty / loading / error states for every async op.
//   8. Direct-imports from clan-backend.js (zero new window-bridges).
//
// Performance contract (spec §2.6):
//   - FCP ≤300ms (initial shell + Your Clans tab render).
//   - Clan list render ≤100ms for 50 clans.
//   - Search render ≤200ms for any query.
//
// Sacred-cow safety (CLAUDE.md §2):
//   - READ-ONLY consumer of clan-backend. NEVER mutates clan state outside
//     the documented CRUD ops (createClan / joinClan / leaveClan / etc.).
//   - NEVER mutates: sacred tables (V_HAPTICS, NARRATOR_LINES, RACE_SYNERGY,
//     RACE_IDENTITY_FX, BOSS_IDENTITY_FX, IDENTITY_FX_KEYS, REACTIVITY_HANDLERS),
//     game state (heroes, bosses, gameState, save), Codex localStorage.
//   - No magic numbers — all constants from clan-config.js + clan-backend.js.
//   - No NARRATOR_LINES additions — functional labels only (per CTO brief).
//   - No new V_HAPTICS keys — UI screen, not feel layer.
//   - Defensive try/catch on every async op — never crashes the new shell.
//   - prefers-reduced-motion: skeleton uses static styling, no animations.
//
// Public API:
//   - renderAdventures(rootEl?, ctx?)              — main render entry
//   - renderYourClansTab(rootEl, clans)            — sub-renderer (testable)
//   - renderBrowseTab(rootEl, clans, query)        — sub-renderer (testable)
//   - renderClanDetail(rootEl, clan, viewerId)     — sub-renderer (testable)
//   - renderCreateClanModal(rootEl, callbacks)     — sub-renderer (testable)
//   - validateCreateForm(name, description)        — pure helper (testable)
//   - resolveCurrentPlayerId()                     — pure read of save state
//   - __adventuresTestables                        — test-only escape hatches

/* eslint-disable no-empty */

import {
  // CRUD ops (async)
  createClan,
  fetchClan,
  joinClan,
  leaveClan,
  listClansForPlayer,
  searchClansByName,
  transferOwnership,
  // T3.04 — client-side weekly rotation fallback
  maybeAutoRotateOnClanOpen,
  // Pure helpers
  computeClanLevel,
  computeContributorPercent,
  validateClanName,
  validateClanSize,
  canPlayerLeaveClan,
  // T3.05 — clan progression pure helpers
  unlockCosmeticAtLevel,
  computeWeeksUntilNextLevel,
  getNextCosmeticUnlock,
  // Constants
  CLAN_MIN_SIZE,
  CLAN_MAX_SIZE,
  CLAN_NAME_MIN_LEN,
  CLAN_NAME_MAX_LEN,
  CLAN_DESCRIPTION_MAX_LEN,
  CLAN_LEVEL_WEEKS_PER_LEVEL,
  CLAN_ROLE_OWNER,
  CLAN_RESULT_REASONS,
} from '../services/clan-backend.js';
import {
  CLAN_DEFAULT_BANNER_TIER,
  CLAN_COSMETIC_TIERS,
  CLAN_UNLOCK_LEVELS,
} from '../data/clan-config.js';
import { log } from '../services/logger.js';

// ─── Performance budget (spec §2.6) ────────────────────────────────────
const ADVENTURES_FCP_BUDGET_MS = 300;
const ADVENTURES_LIST_BUDGET_MS = 100;
const ADVENTURES_SEARCH_BUDGET_MS = 200;
// T3.05 stats / progression sub-render budgets (task brief — ≤50ms / ≤30ms).
const ADVENTURES_STATS_BUDGET_MS = 50;
const ADVENTURES_PROGRESSION_BUDGET_MS = 30;

// ─── T3.05 contributor stats panel constants ───────────────────────────
/** Number of top contributors shown above the fold; the rest collapse behind
 *  an "expand" toggle. Spec §2.3 lays out top-3 highlighted with stars. */
const CONTRIB_TOP_N = 3;

/** Default per-member contribution target if a clan hasn't set a weekly boss
 *  yet. T3.05 surfaces "no target" gracefully — the bar shows total damage
 *  without a percentage-of-target. */
const CONTRIB_TARGET_DEFAULT_NONE = 0;

// ─── Tab keys ──────────────────────────────────────────────────────────
const ADVENTURES_TAB_YOUR = 'your';
const ADVENTURES_TAB_BROWSE = 'browse';
const ADVENTURES_TABS = Object.freeze([ADVENTURES_TAB_YOUR, ADVENTURES_TAB_BROWSE]);
const ADVENTURES_DEFAULT_TAB = ADVENTURES_TAB_YOUR;

// ─── Module state (single screen — only one viewer at a time) ─────────
//
// All resettable via __adventuresTestables.reset() between unit tests so
// cross-mount state can't leak.
let _activeTab = ADVENTURES_DEFAULT_TAB;
let _currentClanId = null;      // non-null when on the detail view
let _searchQuery = '';
let _createModalOpen = false;
let _rootEl = null;
let _viewerPlayerId = null;     // resolved from save state on each render

// ─── Player ID resolution ──────────────────────────────────────────────
//
// Adventures keys clan membership by a stable player identifier. The legacy
// codebase pins the player's chosen name to localStorage at FTUE under
// `blocksworn_p8_player_name` (see CLAUDE.md §1.2). We use that as the
// canonical playerId for clan ops. Defensive: falls back to 'anonymous'
// when the key is missing (FTUE-incomplete edge case — clan UI is FTUE-
// gated at the menu drawer level, so this fallback only fires in tests).
export function resolveCurrentPlayerId() {
  try {
    if (typeof localStorage === 'undefined') return 'anonymous';
    const name = localStorage.getItem('blocksworn_p8_player_name');
    if (typeof name === 'string' && name.trim().length > 0) {
      // Use the trimmed lowercase name as the stable player ID. Mirrors
      // the legacy save-key derivation pattern.
      return name.trim().toLowerCase();
    }
  } catch (_e) { /* private mode */ }
  return 'anonymous';
}

// ─── Pure helpers (testable in isolation) ──────────────────────────────

/**
 * Validate the create-clan form — name + optional description. Returns an
 * envelope mirroring clan-backend's validation shape so the caller can fan
 * the same error UI for both client + server validation failures.
 *
 * @param {string} name
 * @param {string} description
 * @returns {{ok: boolean, reason?: string, field?: 'name'|'description'}}
 */
export function validateCreateForm(name, description) {
  const nameCheck = validateClanName(name);
  if (!nameCheck.ok) {
    return { ok: false, reason: nameCheck.reason, field: 'name' };
  }
  if (typeof description === 'string' && description.length > CLAN_DESCRIPTION_MAX_LEN) {
    return { ok: false, reason: CLAN_RESULT_REASONS.INVALID_INPUT, field: 'description' };
  }
  return { ok: true };
}

/**
 * Format a clan's member-count summary string for the card / detail view.
 * Pure — no DOM access, returns ready-to-render text.
 *
 * @param {object} clan
 * @returns {string} e.g. "12/15 members"
 */
function _formatMemberSummary(clan) {
  const count = (clan && Array.isArray(clan.members)) ? clan.members.length : 0;
  return `${count}/${CLAN_MAX_SIZE} members`;
}

/**
 * Find the viewer's role in a clan. Returns the role string ('owner' /
 * 'member') or null when not a member. Defensive.
 *
 * @param {object} clan
 * @param {string} playerId
 * @returns {string|null}
 */
function _viewerRole(clan, playerId) {
  if (!clan || !Array.isArray(clan.members) || !playerId) return null;
  for (const m of clan.members) {
    if (m && m.playerId === playerId) return m.role || null;
  }
  return null;
}

/**
 * HTML escape a string for safe innerHTML interpolation.
 */
function _escape(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Translate a result reason to user-facing copy. Functional labels only
 * (no Chronicler-voice per CTO brief — Adventures is utility UI, not
 * Identity-Layer narrative surface).
 */
function _reasonToMessage(reason) {
  switch (reason) {
    case CLAN_RESULT_REASONS.NO_SDK:               return 'Adventures unavailable (offline)';
    case CLAN_RESULT_REASONS.NOT_FOUND:            return 'Clan not found';
    case CLAN_RESULT_REASONS.ALREADY_MEMBER:       return 'Already a member of this clan';
    case CLAN_RESULT_REASONS.NOT_A_MEMBER:         return 'Not a member of this clan';
    case CLAN_RESULT_REASONS.CLAN_FULL:            return `Clan is full (${CLAN_MAX_SIZE} max)`;
    case CLAN_RESULT_REASONS.CLAN_TOO_SMALL:       return `Clan needs at least ${CLAN_MIN_SIZE} members`;
    case CLAN_RESULT_REASONS.OWNER_CANNOT_LEAVE:   return 'Transfer ownership before leaving';
    case CLAN_RESULT_REASONS.NOT_OWNER:            return 'Only the owner can do that';
    case CLAN_RESULT_REASONS.TARGET_NOT_MEMBER:    return 'Target is not a member';
    case CLAN_RESULT_REASONS.INVALID_NAME:         return `Name must be ${CLAN_NAME_MIN_LEN}–${CLAN_NAME_MAX_LEN} characters`;
    case CLAN_RESULT_REASONS.INVALID_INPUT:        return 'Invalid input';
    case CLAN_RESULT_REASONS.EXCEPTION:            return 'Something went wrong';
    default:                                        return reason || 'Unknown error';
  }
}

// ─── Main render entry (spec §2.1) ─────────────────────────────────────

/**
 * Mount the Adventures screen into `rootEl`. Default mount: #screenAdventures.
 *
 * `ctx` is an optional context bag (test seam) with shape:
 *   { initialTab?, initialClanId?, initialQuery? }
 *
 * Performance: starts a wall-clock at function entry, logs WARN if FCP
 * exceeds ADVENTURES_FCP_BUDGET_MS. Pure innerHTML + tiny listener wiring.
 */
export function renderAdventures(rootEl, ctx) {
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  const root = rootEl || (typeof document !== 'undefined'
    ? document.getElementById('screenAdventures')
    : null);
  if (!root) return;
  _rootEl = root;
  _viewerPlayerId = resolveCurrentPlayerId();

  if (ctx && typeof ctx === 'object') {
    if (typeof ctx.initialTab === 'string' && ADVENTURES_TABS.indexOf(ctx.initialTab) >= 0) {
      _activeTab = ctx.initialTab;
    }
    if (typeof ctx.initialClanId === 'string' && ctx.initialClanId.length > 0) {
      _currentClanId = ctx.initialClanId;
    }
    if (typeof ctx.initialQuery === 'string') {
      _searchQuery = ctx.initialQuery;
    }
  }

  // Detail view takes precedence over tab view.
  if (_currentClanId) {
    _renderDetailAsync(root, _currentClanId);
  } else {
    _renderTabsShellThenLoadActive(root);
  }

  try {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      if (dt > ADVENTURES_FCP_BUDGET_MS) {
        try { log.warn('Adventures render over FCP budget:', dt.toFixed(2), 'ms'); } catch (_e) {}
      }
    }
  } catch (_e) {}
}

// ─── Tabs shell (header + tab nav + body placeholder) ──────────────────
//
// First paint hits this synchronously (FCP <300ms) — async clan list /
// search results stream into the body when listClansForPlayer /
// searchClansByName resolve.
function _renderTabsShellThenLoadActive(root) {
  const html = [
    '<div class="adv-wrap">',
    _renderHeader(),
    _renderTabNav(_activeTab),
    '<div class="adv-body" id="advBody">',
    '<div class="adv-loading">Loading…</div>',
    '</div>',
    '</div>',
  ].join('');
  root.innerHTML = html;
  _wireHeaderBackButton(root);
  _wireTabClicks(root);

  // Kick off async data load for the active tab.
  if (_activeTab === ADVENTURES_TAB_YOUR) {
    _loadYourClans(root);
  } else {
    _loadBrowseClans(root, _searchQuery);
  }
}

function _renderHeader() {
  return [
    '<div class="adv-header">',
    '<button type="button" class="adv-back-btn" id="advBackBtn" aria-label="Back">&larr;</button>',
    '<h1 class="adv-title">ADVENTURES</h1>',
    '</div>',
  ].join('');
}

function _renderTabNav(activeTab) {
  const tabs = [
    { key: ADVENTURES_TAB_YOUR,    label: 'Your Clans' },
    { key: ADVENTURES_TAB_BROWSE,  label: 'Browse' },
  ];
  return [
    '<div class="adv-tabs" role="tablist">',
    tabs.map(t => {
      const active = (t.key === activeTab) ? ' active' : '';
      return `<button type="button" class="adv-tab${active}" data-adv-tab="${t.key}" role="tab" aria-selected="${t.key === activeTab}">${_escape(t.label)}</button>`;
    }).join(''),
    '</div>',
  ].join('');
}

function _wireHeaderBackButton(root) {
  try {
    const back = root.querySelector('#advBackBtn');
    if (!back) return;
    back.addEventListener('click', () => {
      try {
        if (typeof window !== 'undefined' && typeof window.goToMenu === 'function') {
          window.goToMenu();
        } else if (typeof window !== 'undefined' && typeof window.showScreen === 'function') {
          window.showScreen('menu');
        }
      } catch (_e) {}
    });
  } catch (_e) {}
}

function _wireTabClicks(root) {
  try {
    const tabBtns = root.querySelectorAll('[data-adv-tab]');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-adv-tab');
        if (!tab || tab === _activeTab) return;
        _activeTab = tab;
        // Reset search query when leaving Browse — fresh entry.
        if (_activeTab !== ADVENTURES_TAB_BROWSE) _searchQuery = '';
        _renderTabsShellThenLoadActive(root);
      });
    });
  } catch (_e) {}
}

// ─── Your Clans tab ────────────────────────────────────────────────────

async function _loadYourClans(root) {
  const body = root.querySelector('#advBody');
  if (!body) return;
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  let clans = [];
  let backendOk = true;
  try {
    const result = await listClansForPlayer(_viewerPlayerId);
    if (result && result.ok && Array.isArray(result.clans)) {
      clans = result.clans;
    } else if (result && !result.ok && result.reason === CLAN_RESULT_REASONS.NO_SDK) {
      backendOk = false;
    }
  } catch (e) {
    try { log.warn('listClansForPlayer failed:', e); } catch (_e) {}
    backendOk = false;
  }
  // Defensive: live-DOM might have changed if user tabbed away before resolve.
  if (root !== _rootEl) return;
  renderYourClansTab(body, clans, { backendOk });
  try {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      if (dt > ADVENTURES_LIST_BUDGET_MS) {
        try { log.warn('Your-Clans render over budget:', dt.toFixed(2), 'ms'); } catch (_e) {}
      }
    }
  } catch (_e) {}
}

/**
 * Render the Your Clans tab body. Exported for unit tests.
 *
 * @param {HTMLElement} bodyEl - container element to populate
 * @param {Array<object>} clans
 * @param {{backendOk?: boolean}} [opts]
 */
export function renderYourClansTab(bodyEl, clans, opts) {
  if (!bodyEl) return;
  const list = Array.isArray(clans) ? clans : [];
  const backendOk = opts ? (opts.backendOk !== false) : true;

  if (!backendOk) {
    bodyEl.innerHTML = [
      '<div class="adv-empty">',
      `<p class="adv-empty-title">${_escape(_reasonToMessage(CLAN_RESULT_REASONS.NO_SDK))}</p>`,
      '<p class="adv-empty-sub">Adventures syncs over the network. Check your connection and try again.</p>',
      '</div>',
    ].join('');
    return;
  }

  if (list.length === 0) {
    bodyEl.innerHTML = [
      '<div class="adv-empty">',
      '<p class="adv-empty-title">No adventures yet</p>',
      '<p class="adv-empty-sub">Found a band of 5–15. Defeat weekly bosses together.</p>',
      `<button type="button" class="adv-cta-btn" id="advCreateBtn">+ Create new clan</button>`,
      '</div>',
    ].join('');
    _wireCreateButton(bodyEl);
    return;
  }

  bodyEl.innerHTML = [
    '<ul class="adv-clan-list" role="list">',
    list.map(c => _renderClanCard(c, /*action*/ 'view')).join(''),
    '</ul>',
    `<button type="button" class="adv-cta-btn adv-cta-btn--inline" id="advCreateBtn">+ Create new clan</button>`,
  ].join('');
  _wireCreateButton(bodyEl);
  _wireClanCards(bodyEl, 'view');
}

function _wireCreateButton(scope) {
  try {
    const btn = scope.querySelector('#advCreateBtn');
    if (!btn) return;
    btn.addEventListener('click', () => _openCreateModal());
  } catch (_e) {}
}

function _wireClanCards(scope, action) {
  try {
    const cards = scope.querySelectorAll('[data-adv-clan-id]');
    cards.forEach(card => {
      card.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-adv-clan-id');
        if (!id) return;
        if (action === 'view') {
          _navigateToClan(id);
        } else if (action === 'join') {
          _onJoinClick(id);
        }
      });
    });
  } catch (_e) {}
}

function _renderClanCard(clan, action) {
  if (!clan) return '';
  const name = clan.name || '???';
  const level = computeClanLevel(clan.totalWeeksCompleted | 0);
  const memberCount = (clan && Array.isArray(clan.members)) ? clan.members.length : 0;
  const isFull = memberCount >= CLAN_MAX_SIZE;
  const summary = _formatMemberSummary(clan);
  const bannerTier = (clan.cosmetics && clan.cosmetics.bannerTier) || CLAN_DEFAULT_BANNER_TIER;

  // Weekly stub — T3.04 wires the real progress percentage.
  const weeklyDone = (clan.weekDefeated === true);
  const weeklyLabel = weeklyDone ? 'Weekly: defeated ✓' : 'Weekly: in progress';

  const actionBtn = (action === 'join')
    ? (isFull
        ? `<span class="adv-clan-action adv-clan-action--disabled" aria-disabled="true">Full</span>`
        : `<span class="adv-clan-action">Join &#9656;</span>`)
    : `<span class="adv-clan-action">View &#9656;</span>`;
  const role = (action === 'join') ? 'join' : 'view';

  return [
    `<li class="adv-clan-row" role="listitem">`,
    `<button type="button" class="adv-clan-card" data-adv-clan-id="${_escape(clan.clanId || '')}" data-adv-action="${role}" data-adv-tier="${_escape(bannerTier)}" ${isFull && action === 'join' ? 'disabled aria-disabled="true"' : ''}>`,
    `<div class="adv-clan-name">${_escape(name)}</div>`,
    `<div class="adv-clan-meta">Lvl ${level} &middot; ${_escape(summary)}</div>`,
    `<div class="adv-clan-meta adv-clan-meta--weekly">${_escape(weeklyLabel)}</div>`,
    `<div class="adv-clan-card-action">${actionBtn}</div>`,
    `</button>`,
    `</li>`,
  ].join('');
}

// ─── Browse tab ────────────────────────────────────────────────────────

async function _loadBrowseClans(root, query) {
  const body = root.querySelector('#advBody');
  if (!body) return;
  // Paint shell with search input synchronously — async results stream in.
  body.innerHTML = [
    _renderSearchInput(query),
    '<div class="adv-browse-results" id="advBrowseResults">',
    '<div class="adv-loading">Loading…</div>',
    '</div>',
  ].join('');
  _wireSearchInput(body, root);

  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  let clans = [];
  let backendOk = true;
  try {
    const result = await searchClansByName(query || '');
    if (result && result.ok && Array.isArray(result.clans)) {
      clans = result.clans;
    } else if (result && !result.ok && result.reason === CLAN_RESULT_REASONS.NO_SDK) {
      backendOk = false;
    }
  } catch (e) {
    try { log.warn('searchClansByName failed:', e); } catch (_e) {}
    backendOk = false;
  }
  if (root !== _rootEl) return;
  const resultsEl = body.querySelector('#advBrowseResults');
  if (resultsEl) {
    renderBrowseTab(resultsEl, clans, { query, backendOk });
  }
  try {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      if (dt > ADVENTURES_SEARCH_BUDGET_MS) {
        try { log.warn('Browse render over budget:', dt.toFixed(2), 'ms'); } catch (_e) {}
      }
    }
  } catch (_e) {}
}

function _renderSearchInput(query) {
  return [
    '<div class="adv-search">',
    `<input type="text" class="adv-search-input" id="advSearchInput" placeholder="Search clans…" value="${_escape(query || '')}" maxlength="64" aria-label="Search clans by name" />`,
    '</div>',
  ].join('');
}

function _wireSearchInput(bodyEl, root) {
  try {
    const input = bodyEl.querySelector('#advSearchInput');
    if (!input) return;
    let debounce = null;
    input.addEventListener('input', (e) => {
      const v = (e && e.target && typeof e.target.value === 'string') ? e.target.value : '';
      _searchQuery = v;
      if (debounce) {
        try { clearTimeout(debounce); } catch (_err) {}
      }
      // 150ms debounce keeps the search budget under 200ms even on aggressive typing.
      debounce = setTimeout(() => {
        _loadBrowseClans(root, v);
      }, 150);
    });
  } catch (_e) {}
}

/**
 * Render the Browse tab results body. Exported for unit tests.
 *
 * @param {HTMLElement} bodyEl
 * @param {Array<object>} clans
 * @param {{query?: string, backendOk?: boolean}} [opts]
 */
export function renderBrowseTab(bodyEl, clans, opts) {
  if (!bodyEl) return;
  const list = Array.isArray(clans) ? clans : [];
  const query = (opts && typeof opts.query === 'string') ? opts.query : '';
  const backendOk = opts ? (opts.backendOk !== false) : true;

  if (!backendOk) {
    bodyEl.innerHTML = [
      '<div class="adv-empty">',
      `<p class="adv-empty-title">${_escape(_reasonToMessage(CLAN_RESULT_REASONS.NO_SDK))}</p>`,
      '<p class="adv-empty-sub">Search syncs over the network.</p>',
      '</div>',
    ].join('');
    return;
  }
  if (list.length === 0) {
    const msg = query.length > 0
      ? 'No matching clans found'
      : 'No public clans yet';
    bodyEl.innerHTML = [
      '<div class="adv-empty">',
      `<p class="adv-empty-title">${_escape(msg)}</p>`,
      '<p class="adv-empty-sub">Try a different name, or create one of your own.</p>',
      '</div>',
    ].join('');
    return;
  }

  bodyEl.innerHTML = [
    '<ul class="adv-clan-list" role="list">',
    list.map(c => _renderClanCard(c, 'join')).join(''),
    '</ul>',
  ].join('');
  _wireClanCards(bodyEl, 'join');
}

async function _onJoinClick(clanId) {
  if (!clanId) return;
  try {
    const result = await joinClan(clanId, _viewerPlayerId);
    if (result && result.ok) {
      // Re-fetch and navigate to the detail view of the joined clan.
      _navigateToClan(clanId);
      return;
    }
    _flashError(result && result.reason);
  } catch (e) {
    try { log.warn('joinClan failed:', e); } catch (_e) {}
    _flashError(CLAN_RESULT_REASONS.EXCEPTION);
  }
}

// ─── Detail view ───────────────────────────────────────────────────────

function _navigateToClan(clanId) {
  _currentClanId = clanId;
  if (_rootEl) _renderDetailAsync(_rootEl, clanId);
}

async function _renderDetailAsync(root, clanId) {
  // Loading shell.
  root.innerHTML = [
    '<div class="adv-wrap">',
    _renderDetailHeaderShell(),
    '<div class="adv-loading">Loading…</div>',
    '</div>',
  ].join('');
  _wireDetailBack(root);

  // T3.04 — client-side weekly rotation fallback. When the player opens
  // the clan detail more than 7 days after `weekStartedAt`, trigger
  // closeWeek locally + pick the next-week boss. The Monday 00:00 UTC
  // server cron is the canonical path (T3.04.1); this is the defensive
  // fallback when push notifications haven't fired or the client is offline.
  let rotated = false;
  try {
    const rotateResult = await maybeAutoRotateOnClanOpen(clanId);
    if (rotateResult && rotateResult.ok && rotateResult.rotated === true) {
      rotated = true;
    }
  } catch (e) {
    try { log.warn('maybeAutoRotateOnClanOpen failed:', e); } catch (_e) {}
  }

  let clan = null;
  let backendOk = true;
  let reason = null;
  try {
    const result = await fetchClan(clanId);
    if (result && result.ok && result.clan) {
      clan = result.clan;
    } else {
      backendOk = (result && result.reason !== CLAN_RESULT_REASONS.NO_SDK);
      reason = result && result.reason;
    }
  } catch (e) {
    try { log.warn('fetchClan failed:', e); } catch (_e) {}
    backendOk = false;
  }
  if (root !== _rootEl) return;
  renderClanDetail(root, clan, _viewerPlayerId, { backendOk, reason });
  if (rotated) {
    _flashRotatedToast();
  }
}

/**
 * Surface a "Weekly boss rotated!" toast when the client-side fallback
 * triggers a rotation on detail-mount. Lightweight + auto-dismissing.
 * T3.04 — distinct from `_flashError` so the styling can be opt-in
 * neutral (not red error).
 */
function _flashRotatedToast() {
  if (!_rootEl) return;
  try {
    const prior = _rootEl.querySelector('.adv-toast');
    if (prior && prior.parentNode) prior.parentNode.removeChild(prior);
    const toast = document.createElement('div');
    toast.className = 'adv-toast adv-toast--info';
    toast.setAttribute('role', 'status');
    toast.textContent = 'Weekly boss rotated!';
    _rootEl.appendChild(toast);
    setTimeout(() => {
      try { if (toast.parentNode) toast.parentNode.removeChild(toast); } catch (_e) {}
    }, 3000);
  } catch (_e) { /* swallow */ }
}

function _renderDetailHeaderShell() {
  return [
    '<div class="adv-header adv-header--detail">',
    '<button type="button" class="adv-back-btn" id="advDetailBackBtn" aria-label="Back to adventures">&larr;</button>',
    '<h1 class="adv-title" id="advDetailTitle">CLAN</h1>',
    '</div>',
  ].join('');
}

/**
 * Render the clan detail page. Exported for unit tests.
 *
 * @param {HTMLElement} root - the screen root element (full re-paint)
 * @param {object|null} clan
 * @param {string} viewerId
 * @param {{backendOk?: boolean, reason?: string}} [opts]
 */
export function renderClanDetail(root, clan, viewerId, opts) {
  if (!root) return;
  const backendOk = opts ? (opts.backendOk !== false) : true;
  const reason = opts && opts.reason;

  if (!clan) {
    root.innerHTML = [
      '<div class="adv-wrap">',
      _renderDetailHeaderShell(),
      '<div class="adv-empty">',
      `<p class="adv-empty-title">${_escape(_reasonToMessage(backendOk ? reason : CLAN_RESULT_REASONS.NO_SDK))}</p>`,
      '<p class="adv-empty-sub">The adventure could not be loaded.</p>',
      '</div>',
      '</div>',
    ].join('');
    _wireDetailBack(root);
    return;
  }

  const name = clan.name || '???';
  const desc = clan.description || '';
  const level = computeClanLevel(clan.totalWeeksCompleted | 0);
  const members = Array.isArray(clan.members) ? clan.members : [];
  const memberCount = members.length;
  const summary = _formatMemberSummary(clan);
  const bannerTier = (clan.cosmetics && clan.cosmetics.bannerTier) || CLAN_DEFAULT_BANNER_TIER;
  const viewerIsOwner = (_viewerRole(clan, viewerId) === CLAN_ROLE_OWNER);
  const viewerIsMember = (_viewerRole(clan, viewerId) !== null);
  const canLeave = canPlayerLeaveClan(viewerId, clan);
  const sizeCheck = validateClanSize(memberCount);

  // Sort members: owner first, then by joinedAt ascending.
  const sortedMembers = members.slice().sort((a, b) => {
    if (!a || !b) return 0;
    if (a.role === CLAN_ROLE_OWNER && b.role !== CLAN_ROLE_OWNER) return -1;
    if (b.role === CLAN_ROLE_OWNER && a.role !== CLAN_ROLE_OWNER) return 1;
    return (a.joinedAt | 0) - (b.joinedAt | 0);
  });

  // Weekly section — T3.04 will wire the real boss-of-the-week boss-id +
  // damage progress. For T3.03 we render a placeholder when the backend
  // hasn't set a weeklyTargetId yet.
  const wc = (clan.weeklyContributions && typeof clan.weeklyContributions === 'object')
    ? clan.weeklyContributions : {};
  const viewerContribPct = computeContributorPercent(viewerId, wc);
  const viewerContribDmg = (wc[viewerId] && typeof wc[viewerId].damage === 'number') ? wc[viewerId].damage : 0;
  const weeklyTargetSet = (typeof clan.weeklyTargetId === 'string' && clan.weeklyTargetId.length > 0);
  const weeklyDone = (clan.weekDefeated === true);

  // Hard-cap badge — surface when the clan is at the cap so members
  // understand why no Join button appears in Browse.
  const fullBadge = (memberCount >= CLAN_MAX_SIZE)
    ? '<span class="adv-detail-badge adv-detail-badge--full">FULL</span>'
    : '';
  const tooSmallBadge = (!sizeCheck.ok && sizeCheck.reason === CLAN_RESULT_REASONS.CLAN_TOO_SMALL)
    ? `<span class="adv-detail-badge adv-detail-badge--small">NEEDS ${CLAN_MIN_SIZE - memberCount} MORE</span>`
    : '';

  root.innerHTML = [
    '<div class="adv-wrap">',
    _renderDetailHeaderShell(),
    `<div class="adv-detail-body" data-adv-tier="${_escape(bannerTier)}">`,
    // Headline
    '<section class="adv-detail-head">',
    `<div class="adv-detail-banner"><span class="adv-banner-tier">${_escape(bannerTier.toUpperCase())}</span></div>`,
    `<h2 class="adv-detail-name">${_escape(name)}</h2>`,
    `<div class="adv-detail-meta">Lvl ${level} &middot; ${_escape(summary)} ${fullBadge}${tooSmallBadge}</div>`,
    desc ? `<p class="adv-detail-desc">${_escape(desc)}</p>` : '',
    '</section>',
    // Weekly target stub (T3.04 wires)
    '<section class="adv-detail-section adv-detail-weekly">',
    '<h3 class="adv-detail-section-h">WEEKLY TARGET</h3>',
    weeklyTargetSet
      ? `<div class="adv-weekly-row">${_escape(clan.weeklyTargetId || 'Unknown')}${weeklyDone ? ' <span class="adv-weekly-done">DEFEATED</span>' : ''}</div>`
      : '<div class="adv-weekly-row adv-weekly-row--placeholder">Next adventure rotates Monday</div>',
    viewerIsMember
      ? `<div class="adv-weekly-row adv-weekly-row--you">Your contribution: ${viewerContribDmg.toLocaleString('en-US')} dmg (${(viewerContribPct * 100).toFixed(0)}%)</div>`
      : '',
    '</section>',
    // T3.05 — Contributor stats panel (between WEEKLY TARGET and MEMBERS)
    _renderContributorStatsPanelHTML(clan, viewerId),
    // T3.05 — Clan progression panel (level + cosmetic unlocks)
    _renderClanProgressionPanelHTML(clan),
    // Members
    `<section class="adv-detail-section adv-detail-members">`,
    `<h3 class="adv-detail-section-h">MEMBERS (${memberCount})</h3>`,
    '<ul class="adv-member-list" role="list">',
    sortedMembers.map(m => _renderMemberRow(m, viewerId, viewerIsOwner)).join(''),
    '</ul>',
    '</section>',
    // Actions
    '<section class="adv-detail-actions">',
    viewerIsMember
      ? `<button type="button" class="adv-action-btn adv-action-btn--leave" id="advLeaveBtn" ${canLeave ? '' : 'disabled aria-disabled="true"'}>Leave clan</button>`
      : '',
    '<button type="button" class="adv-action-btn adv-action-btn--invite" id="advInviteBtn">Invite &#8593;</button>',
    '</section>',
    !canLeave && viewerIsOwner
      ? '<p class="adv-action-hint">Tap a member name and choose "Make owner" to transfer ownership before leaving.</p>'
      : '',
    '</div>',
    '</div>',
  ].join('');

  _wireDetailBack(root);
  _wireDetailActions(root, clan);
}

// ═══════════════════════════════════════════════════════════════════════
// T3.05 — Contributor stats panel (§2.3) + Clan progression panel (§2.4)
// ═══════════════════════════════════════════════════════════════════════
//
// Both panels are additive sub-renders inserted into `renderClanDetail`
// between WEEKLY TARGET and MEMBERS. They surface what T3.04's closeWeek
// + `unlockCosmeticAtLevel` track: per-player damage % + clan level + the
// 3-state cosmetic-unlock ladder (✓ unlocked / ▶ next / ◯ locked).
//
// Sacred-cow audit (CLAUDE.md §2 + ADR-003):
//   - No mechanical-advantage labels (cosmetic descriptions only).
//   - No NARRATOR_LINES additions (functional labels per CTO brief).
//   - No new V_HAPTICS keys.
//   - No magic numbers — all thresholds (CONTRIB_TOP_N, CLAN_LEVEL_WEEKS_PER_LEVEL)
//     surface from named constants.

/**
 * Convert one contribution entry (`{damage, lastContribAt}`) into a
 * normalised row record for the panel renderer. Pure.
 */
function _toContributorRow(playerId, entry, totalDamage) {
  const damage = (entry && typeof entry.damage === 'number' && isFinite(entry.damage) && entry.damage > 0)
    ? Math.floor(entry.damage)
    : 0;
  const pct = (totalDamage > 0) ? (damage / totalDamage) : 0;
  return { playerId, damage, pct };
}

/**
 * Aggregate the weekly contributions map into a sorted descending-damage
 * array of `{playerId, damage, pct}` rows. Pure. Stable secondary sort by
 * playerId so ties are deterministic for test asserts.
 */
function _sortedContributorRows(weeklyContributions) {
  if (!weeklyContributions || typeof weeklyContributions !== 'object') return [];
  const ids = Object.keys(weeklyContributions);
  if (ids.length === 0) return [];
  let total = 0;
  for (let i = 0; i < ids.length; i++) {
    const e = weeklyContributions[ids[i]];
    if (e && typeof e.damage === 'number' && isFinite(e.damage) && e.damage > 0) {
      total += Math.max(0, e.damage);
    }
  }
  const rows = ids.map(id => _toContributorRow(id, weeklyContributions[id], total));
  rows.sort((a, b) => {
    if (b.damage !== a.damage) return b.damage - a.damage;
    // Stable: alphabetical tie-break.
    if (a.playerId < b.playerId) return -1;
    if (a.playerId > b.playerId) return 1;
    return 0;
  });
  return rows;
}

/**
 * Compute the weekly damage target shown in the stats panel. Reads the
 * clan's `weeklyTargetHp` field (T3.04 writes this when boss difficulty
 * is applied). Returns 0 when missing — UI hides the target progress row.
 */
function _resolveWeeklyTargetHp(clan) {
  if (!clan || typeof clan !== 'object') return CONTRIB_TARGET_DEFAULT_NONE;
  const hp = clan.weeklyTargetHp;
  if (typeof hp === 'number' && isFinite(hp) && hp > 0) return Math.floor(hp);
  return CONTRIB_TARGET_DEFAULT_NONE;
}

/**
 * Build the inner HTML for the contributor stats panel (rows + footer).
 * The outer `<section>` wraps it via `_renderContributorStatsPanelHTML`;
 * splitting this out lets the expand-toggle re-render just the inside
 * without re-rendering the section header.
 */
function _renderContributorStatsPanelInnerHTML(clan, viewerId, expanded) {
  const wc = (clan && clan.weeklyContributions && typeof clan.weeklyContributions === 'object')
    ? clan.weeklyContributions : {};
  const rows = _sortedContributorRows(wc);
  const totalDmg = rows.reduce((acc, r) => acc + r.damage, 0);
  const targetHp = _resolveWeeklyTargetHp(clan);
  const targetPct = (targetHp > 0) ? Math.min(100, Math.floor((totalDmg / targetHp) * 100)) : 0;

  if (rows.length === 0) {
    return [
      '<div class="adv-contributor-empty" role="status">',
      'No contributions yet this week.',
      '</div>',
    ].join('');
  }

  const visibleRows = expanded ? rows : rows.slice(0, CONTRIB_TOP_N);
  const hiddenCount = rows.length - visibleRows.length;
  const totalContributors = rows.length;

  const rowsHTML = visibleRows.map((r, idx) => {
    const isTop3 = idx < CONTRIB_TOP_N && !expanded ? true : (idx < CONTRIB_TOP_N);
    const isSelf = (r.playerId === viewerId);
    const widthPct = Math.max(0, Math.min(100, Math.floor(r.pct * 100)));
    const classes = [
      'adv-contributor-row',
      isTop3 ? 'adv-contributor-row--top3' : '',
      isSelf ? 'adv-contributor-row--self' : '',
    ].filter(Boolean).join(' ');
    const starPrefix = isTop3 ? '<span class="adv-contributor-star" aria-hidden="true">&#9733;</span>' : '<span class="adv-contributor-star adv-contributor-star--placeholder" aria-hidden="true"></span>';
    const youBadge = isSelf ? ' <span class="adv-contributor-you">(You)</span>' : '';
    return [
      `<li class="${classes}" data-adv-contrib-id="${_escape(r.playerId)}">`,
      `<div class="adv-contributor-row-head">`,
      starPrefix,
      `<span class="adv-contributor-name">${_escape(r.playerId)}${youBadge}</span>`,
      `<span class="adv-contributor-pct">${Math.floor(r.pct * 100)}%</span>`,
      `</div>`,
      `<div class="adv-contributor-damage-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${widthPct}">`,
      `<div class="adv-contributor-damage-bar-fill" style="width: ${widthPct}%"></div>`,
      `</div>`,
      `<div class="adv-contributor-damage-label">${r.damage.toLocaleString('en-US')} dmg</div>`,
      `</li>`,
    ].join('');
  }).join('');

  const expandToggle = hiddenCount > 0
    ? `<button type="button" class="adv-contributor-expand-btn" id="advContribExpandBtn" aria-expanded="false">+ ${hiddenCount} more contributor${hiddenCount === 1 ? '' : 's'}</button>`
    : (expanded && rows.length > CONTRIB_TOP_N
        ? `<button type="button" class="adv-contributor-expand-btn" id="advContribExpandBtn" aria-expanded="true">Show top ${CONTRIB_TOP_N} only</button>`
        : '');

  // Target progress footer — only rendered when the clan has a target HP set.
  const targetFooter = (targetHp > 0)
    ? [
        '<div class="adv-contributor-target-row">',
        `<span class="adv-contributor-target-label">TOTAL: ${totalDmg.toLocaleString('en-US')} dmg</span>`,
        `<span class="adv-contributor-target-value">TARGET: ${targetHp.toLocaleString('en-US')} dmg (${targetPct}% done)</span>`,
        '</div>',
      ].join('')
    : [
        '<div class="adv-contributor-target-row">',
        `<span class="adv-contributor-target-label">TOTAL: ${totalDmg.toLocaleString('en-US')} dmg</span>`,
        '</div>',
      ].join('');

  return [
    '<ul class="adv-contributor-list" role="list">',
    rowsHTML,
    '</ul>',
    expandToggle,
    targetFooter,
    `<div class="adv-contributor-total-label">WEEKLY CONTRIBUTORS (${totalContributors})</div>`,
  ].join('');
}

function _renderContributorStatsPanelHTML(clan, viewerId) {
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  // Reset expand state at every full re-render (matches `renderClanDetail` mount semantics).
  _contribExpanded = false;
  const inner = _renderContributorStatsPanelInnerHTML(clan, viewerId, false);
  const html = [
    '<section class="adv-detail-section adv-contributor-stats-panel">',
    '<h3 class="adv-detail-section-h">WEEKLY CONTRIBUTORS</h3>',
    `<div id="advContribPanel">${inner}</div>`,
    '</section>',
  ].join('');
  try {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      if (dt > ADVENTURES_STATS_BUDGET_MS) {
        try { log.warn('Contributor stats render over budget:', dt.toFixed(2), 'ms'); } catch (_e) {}
      }
    }
  } catch (_e) {}
  return html;
}

/**
 * Sub-renderer entry point for unit tests. Hosts the contributor stats
 * panel into a target element (replaces previous innerHTML). Pure DOM ops.
 *
 * @param {HTMLElement} rootEl
 * @param {object} clanState - clan doc shape (members + weeklyContributions)
 * @param {string} playerId - viewer's player id (for "(You)" badge)
 */
export function renderContributorStatsPanel(rootEl, clanState, playerId) {
  if (!rootEl) return;
  rootEl.innerHTML = _renderContributorStatsPanelHTML(clanState || {}, playerId || '');
}

// ─── T3.05 — Clan progression panel (§2.4) ─────────────────────────────

/**
 * Build the cosmetic-unlock 3-state ladder rows. The list is taken from
 * `CLAN_UNLOCK_LEVELS` (frozen sorted list from clan-config.js). Each row
 * shows one of three states:
 *   - `--unlocked` (✓) — the level is ≤ currentLevel
 *   - `--next`     (▶) — the row is the next-unlock from `getNextCosmeticUnlock`
 *   - `--locked`   (◯) — every higher row
 *
 * Per ADR-003, descriptions are cosmetic-only ("Bronze banner", "Silver
 * emblem") — never mechanical-advantage labels like "+1 weekly cap raise".
 */
function _cosmeticItemLabel(item) {
  // Map a raw {kind, value} entry to a human label. Defensive on shape.
  if (!item || typeof item !== 'object') return '';
  const kind = (typeof item.kind === 'string') ? item.kind : '';
  const value = (typeof item.value === 'string') ? item.value : '';
  // Title-case the value (e.g. 'silver' → 'Silver').
  const titleValue = value.length > 0
    ? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ')
    : '';
  switch (kind) {
    case 'banner': return `${titleValue} banner`;
    case 'emblem': return `${titleValue} emblem`;
    case 'badge':  return `${titleValue} badge`;
    case 'motto':  return `Custom motto`;
    default:       return titleValue || 'Cosmetic';
  }
}

function _renderClanProgressionPanelHTML(clan) {
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  const weeks = (clan && typeof clan.totalWeeksCompleted === 'number' && isFinite(clan.totalWeeksCompleted))
    ? Math.max(0, Math.floor(clan.totalWeeksCompleted))
    : 0;
  const currentLevel = computeClanLevel(weeks);
  const next = getNextCosmeticUnlock(currentLevel);
  const weeksRemaining = computeWeeksUntilNextLevel(currentLevel, weeks);

  // Progress bar: weeks accumulated INTO the current level (0..CLAN_LEVEL_WEEKS_PER_LEVEL).
  const weeksThisLevel = weeks - (currentLevel - 1) * CLAN_LEVEL_WEEKS_PER_LEVEL;
  const progressPct = Math.max(0, Math.min(100,
    Math.floor((weeksThisLevel / CLAN_LEVEL_WEEKS_PER_LEVEL) * 100)
  ));

  // Sort the unlock-level list ascending and render every entry with its state.
  const levels = Array.isArray(CLAN_UNLOCK_LEVELS) ? CLAN_UNLOCK_LEVELS.slice() : [];
  const nextLevel = next ? next.level : null;

  const rowsHTML = levels.map(lvl => {
    const items = unlockCosmeticAtLevel(lvl);
    const labels = items.map(_cosmeticItemLabel).filter(Boolean);
    if (labels.length === 0) return '';

    let state, marker;
    if (lvl <= currentLevel) {
      state = 'unlocked';
      marker = '&#10003;'; // ✓
    } else if (lvl === nextLevel) {
      state = 'next';
      marker = '&#9654;';  // ▶
    } else {
      state = 'locked';
      marker = '&#9675;';  // ◯
    }
    const stateLabel = (state === 'next') ? ' (NEXT)' : '';
    return [
      `<li class="adv-cosmetic-unlock-row adv-cosmetic-unlock-row--${state}">`,
      `<span class="adv-cosmetic-unlock-marker" aria-hidden="true">${marker}</span>`,
      `<span class="adv-cosmetic-unlock-level">Lvl ${lvl}</span>`,
      `<span class="adv-cosmetic-unlock-label">${_escape(labels.join(', '))}${stateLabel}</span>`,
      `</li>`,
    ].join('');
  }).filter(Boolean).join('');

  const levelHeaderHTML = next
    ? `<div class="adv-progression-header">Level ${currentLevel} &rarr; Level ${currentLevel + 1} (${weeksRemaining} week${weeksRemaining === 1 ? '' : 's'} remaining)</div>`
    : `<div class="adv-progression-header adv-progression-header--max">Level ${currentLevel} &middot; Max level reached</div>`;

  const html = [
    '<section class="adv-detail-section adv-progression-panel">',
    '<h3 class="adv-detail-section-h">CLAN PROGRESSION</h3>',
    levelHeaderHTML,
    '<div class="adv-progression-bar" role="progressbar"',
    ` aria-valuemin="0" aria-valuemax="${CLAN_LEVEL_WEEKS_PER_LEVEL}" aria-valuenow="${Math.max(0, Math.floor(weeksThisLevel))}">`,
    `<div class="adv-progression-bar-fill" style="width: ${progressPct}%"></div>`,
    '</div>',
    `<div class="adv-progression-label">${Math.max(0, Math.floor(weeksThisLevel))} / ${CLAN_LEVEL_WEEKS_PER_LEVEL} weeks</div>`,
    '<div class="adv-cosmetic-unlock-h">COSMETICS</div>',
    '<ul class="adv-cosmetic-unlock-list" role="list">',
    rowsHTML,
    '</ul>',
    '</section>',
  ].join('');

  try {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      if (dt > ADVENTURES_PROGRESSION_BUDGET_MS) {
        try { log.warn('Clan progression render over budget:', dt.toFixed(2), 'ms'); } catch (_e) {}
      }
    }
  } catch (_e) {}

  return html;
}

/**
 * Sub-renderer entry point for unit tests. Hosts the clan progression panel
 * into a target element (replaces previous innerHTML). Pure DOM ops.
 *
 * @param {HTMLElement} rootEl
 * @param {object} clanState - clan doc shape (totalWeeksCompleted)
 */
export function renderClanProgressionPanel(rootEl, clanState) {
  if (!rootEl) return;
  rootEl.innerHTML = _renderClanProgressionPanelHTML(clanState || {});
}

function _renderMemberRow(member, viewerId, viewerIsOwner) {
  if (!member) return '';
  const playerId = member.playerId || '';
  const isYou = (playerId === viewerId);
  const role = member.role || 'member';
  const joinedAt = (typeof member.joinedAt === 'number') ? member.joinedAt : 0;
  const isOwner = (role === CLAN_ROLE_OWNER);

  const youLabel = isYou ? ' (you)' : '';
  const roleLabel = isOwner ? 'Owner' : 'Member';
  // Pretty date — Yyyy-mm-dd slice. Defensive.
  let joinedLabel = '';
  try {
    joinedLabel = new Date(joinedAt).toISOString().slice(0, 10);
  } catch (_e) {
    joinedLabel = '';
  }

  // Transfer button — only shown when viewer is owner AND member is not viewer.
  const transferBtn = (viewerIsOwner && !isYou)
    ? `<button type="button" class="adv-member-transfer-btn" data-adv-transfer-to="${_escape(playerId)}" aria-label="Make ${_escape(playerId)} owner">Make owner</button>`
    : '';

  return [
    '<li class="adv-member-row">',
    `<span class="adv-member-name">${_escape(playerId)}${youLabel}</span>`,
    `<span class="adv-member-role">${_escape(roleLabel)}</span>`,
    `<span class="adv-member-joined">${_escape(joinedLabel)}</span>`,
    transferBtn,
    '</li>',
  ].join('');
}

function _wireDetailBack(root) {
  try {
    const back = root.querySelector('#advDetailBackBtn');
    if (!back) return;
    back.addEventListener('click', () => {
      _currentClanId = null;
      _renderTabsShellThenLoadActive(root);
    });
  } catch (_e) {}
}

function _wireDetailActions(root, clan) {
  try {
    const leaveBtn = root.querySelector('#advLeaveBtn');
    if (leaveBtn) {
      leaveBtn.addEventListener('click', () => _onLeaveClick(clan));
    }
    const inviteBtn = root.querySelector('#advInviteBtn');
    if (inviteBtn) {
      inviteBtn.addEventListener('click', () => _onInviteClick(clan));
    }
    // Owner transfer buttons (only present when viewer is owner).
    const transferBtns = root.querySelectorAll('[data-adv-transfer-to]');
    transferBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        try {
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          const targetId = e.currentTarget.getAttribute('data-adv-transfer-to');
          if (!targetId) return;
          _onTransferClick(clan, targetId);
        } catch (_err) {}
      });
    });
    // T3.05 — Contributor stats expand toggle.
    const expandBtn = root.querySelector('#advContribExpandBtn');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => _onContribExpandClick(clan));
    }
  } catch (_e) {}
}

// ─── T3.05 — Contributor stats expand toggle ──────────────────────────
//
// Tracks the "expanded" state per render. When the user taps "+ N more
// contributors" we re-render the panel inline with all rows visible. State
// is reset when `renderClanDetail` runs again (fresh render = collapsed).
let _contribExpanded = false;

function _onContribExpandClick(clan) {
  if (!clan || !_rootEl) return;
  try {
    _contribExpanded = !_contribExpanded;
    const panel = _rootEl.querySelector('#advContribPanel');
    if (panel) {
      panel.innerHTML = _renderContributorStatsPanelInnerHTML(clan, _viewerPlayerId, _contribExpanded);
      // Re-bind the (now re-rendered) expand button if it still exists.
      const newBtn = panel.parentNode && typeof panel.parentNode.querySelector === 'function'
        ? panel.parentNode.querySelector('#advContribExpandBtn')
        : null;
      if (newBtn) {
        newBtn.addEventListener('click', () => _onContribExpandClick(clan));
      }
    }
  } catch (_e) { /* swallow */ }
}

async function _onLeaveClick(clan) {
  if (!clan || !clan.clanId) return;
  // Owner cannot leave — guard at click time so the disabled state isn't bypassed.
  if (!canPlayerLeaveClan(_viewerPlayerId, clan)) {
    _flashError(CLAN_RESULT_REASONS.OWNER_CANNOT_LEAVE);
    return;
  }
  try {
    const result = await leaveClan(clan.clanId, _viewerPlayerId);
    if (result && result.ok) {
      // Return to Your Clans tab.
      _currentClanId = null;
      _activeTab = ADVENTURES_TAB_YOUR;
      if (_rootEl) _renderTabsShellThenLoadActive(_rootEl);
      return;
    }
    _flashError(result && result.reason);
  } catch (e) {
    try { log.warn('leaveClan failed:', e); } catch (_e) {}
    _flashError(CLAN_RESULT_REASONS.EXCEPTION);
  }
}

async function _onTransferClick(clan, targetId) {
  if (!clan || !clan.clanId || !targetId) return;
  try {
    const result = await transferOwnership(clan.clanId, _viewerPlayerId, targetId);
    if (result && result.ok) {
      // Re-render the detail to reflect new owner.
      if (_rootEl) _renderDetailAsync(_rootEl, clan.clanId);
      return;
    }
    _flashError(result && result.reason);
  } catch (e) {
    try { log.warn('transferOwnership failed:', e); } catch (_e) {}
    _flashError(CLAN_RESULT_REASONS.EXCEPTION);
  }
}

function _onInviteClick(clan) {
  // Spec §2.5 + ESC-03 Q5 — navigator.share OS-native only. Graceful no-op
  // when share API is absent (browser without share, e.g. desktop Chrome).
  try {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      if (_rootEl) {
        const btn = _rootEl.querySelector('#advInviteBtn');
        if (btn) {
          btn.classList.add('adv-action-btn--unavailable');
          btn.setAttribute('aria-disabled', 'true');
        }
      }
      return;
    }
    const loc = (typeof window !== 'undefined') ? window.location : null;
    const origin = (loc && loc.origin) || 'https://blocksworm.com';
    const clanId = (clan && clan.clanId) || '';
    const name = (clan && clan.name) || 'an adventure';
    const url = clanId ? `${origin}/?adventure=${encodeURIComponent(clanId)}` : origin;
    const text = `Join ${name} on Blocksworn`;
    navigator.share({ title: 'Blocksworn adventure', text, url }).catch(() => { /* user cancelled */ });
  } catch (_e) {}
}

// ─── Create-clan modal ─────────────────────────────────────────────────

function _openCreateModal() {
  if (!_rootEl) return;
  _createModalOpen = true;
  renderCreateClanModal(_rootEl, {
    onCreate: (name, desc) => _onCreateSubmit(name, desc),
    onCancel: () => _closeCreateModal(),
  });
}

function _closeCreateModal() {
  _createModalOpen = false;
  if (!_rootEl) return;
  const modal = _rootEl.querySelector('#advCreateModal');
  if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
}

/**
 * Render the create-clan modal into the screen root. Exported for tests.
 *
 * @param {HTMLElement} rootEl
 * @param {{onCreate: function, onCancel: function}} callbacks
 */
export function renderCreateClanModal(rootEl, callbacks) {
  if (!rootEl) return;
  // Remove any prior modal first (idempotent).
  const prior = rootEl.querySelector('#advCreateModal');
  if (prior && prior.parentNode) prior.parentNode.removeChild(prior);

  const modal = document.createElement('div');
  modal.className = 'adv-modal-overlay';
  modal.id = 'advCreateModal';
  modal.innerHTML = [
    '<div class="adv-modal" role="dialog" aria-labelledby="advCreateTitle" aria-modal="true">',
    '<h2 class="adv-modal-title" id="advCreateTitle">CREATE NEW CLAN</h2>',
    '<label class="adv-modal-label" for="advCreateName">Name</label>',
    `<input type="text" id="advCreateName" class="adv-modal-input" maxlength="${CLAN_NAME_MAX_LEN}" minlength="${CLAN_NAME_MIN_LEN}" placeholder="${CLAN_NAME_MIN_LEN}–${CLAN_NAME_MAX_LEN} chars" />`,
    '<label class="adv-modal-label" for="advCreateDesc">Description (optional)</label>',
    `<textarea id="advCreateDesc" class="adv-modal-input adv-modal-textarea" maxlength="${CLAN_DESCRIPTION_MAX_LEN}" placeholder="What is your clan about?"></textarea>`,
    '<div class="adv-modal-error" id="advCreateError" role="alert"></div>',
    '<div class="adv-modal-actions">',
    '<button type="button" class="adv-action-btn adv-action-btn--cancel" id="advCreateCancel">Cancel</button>',
    '<button type="button" class="adv-action-btn adv-action-btn--create" id="advCreateSubmit">Create</button>',
    '</div>',
    '</div>',
  ].join('');
  rootEl.appendChild(modal);

  // Wire callbacks.
  const cb = callbacks || {};
  try {
    const cancelBtn = modal.querySelector('#advCreateCancel');
    if (cancelBtn && typeof cb.onCancel === 'function') {
      cancelBtn.addEventListener('click', () => cb.onCancel());
    }
    const submitBtn = modal.querySelector('#advCreateSubmit');
    if (submitBtn && typeof cb.onCreate === 'function') {
      submitBtn.addEventListener('click', () => {
        const nameEl = modal.querySelector('#advCreateName');
        const descEl = modal.querySelector('#advCreateDesc');
        const name = (nameEl && typeof nameEl.value === 'string') ? nameEl.value : '';
        const desc = (descEl && typeof descEl.value === 'string') ? descEl.value : '';
        const check = validateCreateForm(name, desc);
        if (!check.ok) {
          _setModalError(modal, _reasonToMessage(check.reason));
          return;
        }
        cb.onCreate(name, desc);
      });
    }
    // Close on overlay click (outside the modal box).
    modal.addEventListener('click', (e) => {
      if (e.target === modal && typeof cb.onCancel === 'function') cb.onCancel();
    });
  } catch (_e) {}
}

function _setModalError(modalEl, message) {
  try {
    const errEl = modalEl.querySelector('#advCreateError');
    if (errEl) errEl.textContent = message || '';
  } catch (_e) {}
}

async function _onCreateSubmit(name, description) {
  try {
    const result = await createClan(_viewerPlayerId, name, description);
    if (result && result.ok && result.clanId) {
      _closeCreateModal();
      _navigateToClan(result.clanId);
      return;
    }
    // Surface backend-side validation failure in the modal error slot.
    if (_rootEl) {
      const modal = _rootEl.querySelector('#advCreateModal');
      if (modal) _setModalError(modal, _reasonToMessage(result && result.reason));
    }
  } catch (e) {
    try { log.warn('createClan failed:', e); } catch (_e) {}
    if (_rootEl) {
      const modal = _rootEl.querySelector('#advCreateModal');
      if (modal) _setModalError(modal, _reasonToMessage(CLAN_RESULT_REASONS.EXCEPTION));
    }
  }
}

// ─── Inline error toast ────────────────────────────────────────────────
//
// Lightweight banner — appends an .adv-toast row to the body when an
// async op fails outside the create-modal context (join / leave / transfer).
// Auto-dismisses after 3s. Idempotent — replaces any existing toast.
function _flashError(reason) {
  if (!_rootEl) return;
  const msg = _reasonToMessage(reason);
  // Remove any prior toast first.
  const prior = _rootEl.querySelector('.adv-toast');
  if (prior && prior.parentNode) prior.parentNode.removeChild(prior);
  const toast = document.createElement('div');
  toast.className = 'adv-toast';
  toast.setAttribute('role', 'alert');
  toast.textContent = msg;
  _rootEl.appendChild(toast);
  try {
    setTimeout(() => {
      try { if (toast.parentNode) toast.parentNode.removeChild(toast); } catch (_e) {}
    }, 3000);
  } catch (_e) {}
}

// ─── Test-only escape hatches (mirrors __codexTestables convention) ───
export const __adventuresTestables = Object.freeze({
  reset() {
    _activeTab = ADVENTURES_DEFAULT_TAB;
    _currentClanId = null;
    _searchQuery = '';
    _createModalOpen = false;
    _rootEl = null;
    _viewerPlayerId = null;
  },
  setActiveTab(tab) {
    if (typeof tab === 'string' && ADVENTURES_TABS.indexOf(tab) >= 0) _activeTab = tab;
  },
  setCurrentClanId(id) { _currentClanId = (typeof id === 'string') ? id : null; },
  setSearchQuery(q) { _searchQuery = (typeof q === 'string') ? q : ''; },
  setViewerPlayerId(id) { _viewerPlayerId = (typeof id === 'string') ? id : 'anonymous'; },
  getActiveTab() { return _activeTab; },
  getCurrentClanId() { return _currentClanId; },
  getSearchQuery() { return _searchQuery; },
  isCreateModalOpen() { return _createModalOpen; },
  getConstants() {
    return {
      ADVENTURES_TABS,
      ADVENTURES_DEFAULT_TAB,
      ADVENTURES_FCP_BUDGET_MS,
      ADVENTURES_LIST_BUDGET_MS,
      ADVENTURES_SEARCH_BUDGET_MS,
      ADVENTURES_STATS_BUDGET_MS,
      ADVENTURES_PROGRESSION_BUDGET_MS,
      CONTRIB_TOP_N,
    };
  },
  // Internal helpers exposed for unit-test surfaces.
  formatMemberSummary: _formatMemberSummary,
  viewerRole: _viewerRole,
  reasonToMessage: _reasonToMessage,
  cosmeticTiers: CLAN_COSMETIC_TIERS,
  // T3.05 — contributor stats + clan progression test surface.
  sortedContributorRows: _sortedContributorRows,
  cosmeticItemLabel: _cosmeticItemLabel,
});
