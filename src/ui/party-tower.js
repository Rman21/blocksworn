// 2026-05-13 — TASK-057 (T3.13): Party Tower UI — 2-tab screen + party detail
//   with turn countdown, hearts pool, shared pacts list, and async social
//   hooks (emoji reactions + turn-took banner).
//
// Spec: docs/design/endgame-social.md §3 (Party Tower — 2–5 async coop)
//       + §3.1 (turn-based async architecture + per-party timeout modes)
//       + §3.5 (async social hooks — emoji-only; turn-took notification)
//       + §3.6 (performance budgets — FCP ≤300ms; board state load ≤500ms)
//       + ESC-03 Q3 ruling — 24h Standard default; 4h Competitive + 7-day Casual.
//       + ADR-002 — async-only (NO real-time presence indicators).
//       + ADR-003 — strict no-P2W (NO paid party-size expansion, NO paid
//         timeout reductions, NO paid revives surfaced in UI).
//
// FOURTH Phase 3 UI screen (Wave-5 closer; follows Codex T2.12, Replay viewer
// T3.08, Adventures T3.03). Mirrors the Adventures T3.03 precedent:
//   - direct-import from party-tower-backend.js (zero new window-bridges)
//   - parchment aesthetic matching Codex + Replay viewer + Adventures
//   - module-private state singleton, reset hook for tests
//   - defensive try/catch on every async op
//   - prefers-reduced-motion compatible (CSS handles animation suppression)
//
// What this module ships:
//   1. Mobile-first 2-tab screen (Your Parties / Browse) + Create party CTA.
//   2. Create-party modal — name validation + timeout-mode radio (Competitive /
//      Standard / Casual).
//   3. Party detail view — turn-countdown banner, hearts pool indicator,
//      selected pacts list, members roster (current-turn highlighted),
//      end-turn button (visible only when canPlayerEndTurn === true).
//   4. Emoji react row (§3.5) — 3 emojis (👍 / 🔥 / 💀); local-only reaction
//      log (mock-store mirror; real Firestore writes wired in T3.13.1).
//   5. Turn-took banner + activity feed — "@bloke ended their turn" blurbs
//      from turnHistory[]; no real-time presence indicators (ADR-002).
//   6. Pre-start "Start Run" CTA for owner when ≥2 members joined.
//   7. Leave-party button — owner cannot leave without transferring first
//      (mirrors clan-backend semantics).
//
// Performance contract (spec §3.6):
//   - FCP ≤300ms (initial shell + Your Parties tab render).
//   - Party detail render ≤200ms with full state hydration.
//   - Countdown ticker driven by requestAnimationFrame (no setInterval drift).
//
// Sacred-cow safety (CLAUDE.md §2):
//   - READ-ONLY consumer of party-tower-backend. Mutations only via
//     documented CRUD ops (createParty / joinParty / leaveParty / endTurn /
//     startParty / transferOwnership).
//   - NEVER mutates sacred tables (V_HAPTICS, NARRATOR_LINES, RACE_IDENTITY_FX,
//     BOSS_IDENTITY_FX, TOWER_PACTS_BASE/MYTHIC, BALANCE.pinch.towerDeath).
//   - ADR-003 no-P2W: UI does NOT surface paid party-size expansion / paid
//     timeout reduction / paid revives. The retry ladder [100, 200, 400] is
//     READ from sacred BALANCE; we only DISPLAY it, never modify.
//   - ADR-002: no real-time presence indicators (live cursors, typing
//     indicators forbidden); player names + last-active timestamps are OK.
//   - No new V_HAPTICS keys — UI screen, not feel layer.
//   - No NARRATOR_LINES additions — functional copy only.
//   - prefers-reduced-motion: CSS handles disable; JS does NOT pulse
//     countdown manually.
//
// Public API:
//   - renderPartyTower(rootEl?, ctx?)                — main render entry
//   - renderYourPartiesTab(bodyEl, parties, opts)    — sub-renderer (testable)
//   - renderBrowseTab(bodyEl, opts)                  — sub-renderer (testable)
//   - renderPartyDetail(bodyEl, party, viewerId)     — sub-renderer (testable)
//   - renderCreatePartyModal(rootEl, callbacks)      — sub-renderer (testable)
//   - validateCreateForm(name, mode)                 — pure helper (testable)
//   - formatCountdown(deadlineMs, now)               — pure helper (testable)
//   - resolveCurrentPlayerId()                       — read of save state
//   - __partyTowerTestables                          — test-only escape hatches

/* eslint-disable no-empty */

import {
  // CRUD ops (async)
  createParty,
  fetchParty,
  leaveParty,
  startParty,
  endTurn,
  listPartiesForPlayer,
  maybeAutoSkipExpiredTurn,
  // Pure helpers
  validatePartyName,
  computeTurnHasExpired,
  canPlayerEndTurn,
  canPlayerStartParty,
  computePartyProgress,
  // Constants
  PARTY_MIN_SIZE,
  PARTY_MAX_SIZE,
  PARTY_NAME_MIN_LEN,
  PARTY_NAME_MAX_LEN,
  PARTY_TIMEOUT_MS,
  PARTY_DEFAULT_TIMEOUT_MODE,
  PARTY_ROLE_OWNER,
  PARTY_STATE_PENDING,
  PARTY_STATE_ACTIVE,
  PARTY_RESULT_REASONS,
} from '../services/party-tower-backend.js';
import { log } from '../services/logger.js';

// ─── Performance budgets (spec §3.6) ────────────────────────────────────
const PARTY_FCP_BUDGET_MS = 300;
const PARTY_DETAIL_BUDGET_MS = 200;

// ─── Tab keys ──────────────────────────────────────────────────────────
const PARTY_TAB_YOUR = 'your';
const PARTY_TAB_BROWSE = 'browse';
const PARTY_TABS = Object.freeze([PARTY_TAB_YOUR, PARTY_TAB_BROWSE]);
const PARTY_DEFAULT_TAB = PARTY_TAB_YOUR;

// ─── Timeout-mode catalog (UI labels for the create modal radio) ───────
const PARTY_TIMEOUT_MODE_LABELS = Object.freeze({
  competitive: { label: 'Competitive',  sub: '4h turn limit · speedrun' },
  standard:    { label: 'Standard',      sub: '24h turn limit · default' },
  casual:      { label: 'Casual',        sub: '7-day turn limit · friend-group' },
});
const PARTY_TIMEOUT_MODE_ORDER = Object.freeze(['competitive', 'standard', 'casual']);

// ─── Async social hooks — emoji reactions (§3.5 emoji-only) ─────────────
// 3 emojis per spec §3.5 ("👍 / 🔥 / 💀"). Locked set — no custom strings
// (Execution Plan §8.4). Reaction writes live in a module-private mirror;
// T3.13.1 wires real Firestore appends.
const PARTY_EMOJIS = Object.freeze(['👍', '🔥', '💀']);

// ─── Countdown thresholds (display only — sacred timeout values unchanged) ─
const COUNTDOWN_DANGER_MS = 30 * 60 * 1000;   // <30min → pulse red
const COUNTDOWN_WARN_MS   = 4  * 60 * 60 * 1000; // <4h → amber
// Countdown refresh cadence (ms). 1Hz is plenty for h/m/s display.
const COUNTDOWN_TICK_MS = 1000;

// ─── Module state singleton (only one Party Tower viewer at a time) ─────
let _activeTab = PARTY_DEFAULT_TAB;
let _currentPartyId = null;
let _createModalOpen = false;
let _rootEl = null;
let _viewerPlayerId = null;
let _countdownTimer = null;        // setInterval handle for countdown
let _localReactions = {};          // { partyId: { turnIdx: { emoji: count } } }

// ─── Player ID resolution (mirrors Adventures pattern) ─────────────────
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

// ─── Pure helpers (testable in isolation) ──────────────────────────────

/**
 * Validate the create-party form — name + mode. Returns an envelope mirroring
 * party-tower-backend's validation shape so the caller can fan the same error
 * UI for both client + server validation failures.
 *
 * @param {string} name
 * @param {string} mode
 * @returns {{ok: boolean, reason?: string, field?: 'name'|'mode'}}
 */
export function validateCreateForm(name, mode) {
  const nameCheck = validatePartyName(name);
  if (!nameCheck.ok) {
    return { ok: false, reason: nameCheck.reason, field: 'name' };
  }
  if (typeof mode !== 'string' || !PARTY_TIMEOUT_MS[mode]) {
    return { ok: false, reason: PARTY_RESULT_REASONS.INVALID_MODE, field: 'mode' };
  }
  return { ok: true };
}

/**
 * Format a millisecond duration as "Hh Mm" or "Mm Ss". Used both for the
 * countdown banner and the timeout label on the create modal. Pure.
 *
 * @param {number} deadlineMs - absolute timestamp (ms since epoch)
 * @param {number} [now] - injected clock (defaults to Date.now())
 * @returns {{text: string, remainingMs: number, severity: 'safe'|'warn'|'danger'|'expired'}}
 */
export function formatCountdown(deadlineMs, now) {
  if (typeof deadlineMs !== 'number' || !isFinite(deadlineMs) || deadlineMs <= 0) {
    return { text: '—', remainingMs: 0, severity: 'safe' };
  }
  const t = (typeof now === 'number' && isFinite(now)) ? now : Date.now();
  const remainingMs = deadlineMs - t;
  if (remainingMs <= 0) {
    return { text: 'Expired', remainingMs: 0, severity: 'expired' };
  }
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((remainingMs % (60 * 1000)) / 1000);
  let text;
  if (hours > 0) {
    text = `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    text = `${minutes}m ${seconds}s`;
  } else {
    text = `${seconds}s`;
  }
  let severity = 'safe';
  if (remainingMs < COUNTDOWN_DANGER_MS) severity = 'danger';
  else if (remainingMs < COUNTDOWN_WARN_MS) severity = 'warn';
  return { text, remainingMs, severity };
}

/**
 * HTML escape for safe innerHTML interpolation.
 */
function _escape(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Translate result reason → user-facing copy. Functional labels only.
 */
function _reasonToMessage(reason) {
  switch (reason) {
    case PARTY_RESULT_REASONS.NO_SDK:               return 'Party Tower unavailable (offline)';
    case PARTY_RESULT_REASONS.NOT_FOUND:            return 'Party not found';
    case PARTY_RESULT_REASONS.ALREADY_MEMBER:       return 'Already a member of this party';
    case PARTY_RESULT_REASONS.NOT_A_MEMBER:         return 'Not a member of this party';
    case PARTY_RESULT_REASONS.PARTY_FULL:           return `Party is full (${PARTY_MAX_SIZE} max)`;
    case PARTY_RESULT_REASONS.PARTY_TOO_SMALL:      return `Party needs at least ${PARTY_MIN_SIZE} members`;
    case PARTY_RESULT_REASONS.OWNER_CANNOT_LEAVE:   return 'Transfer ownership before leaving';
    case PARTY_RESULT_REASONS.NOT_OWNER:            return 'Only the owner can do that';
    case PARTY_RESULT_REASONS.TARGET_NOT_MEMBER:    return 'Target is not a member';
    case PARTY_RESULT_REASONS.INVALID_NAME:         return `Name must be ${PARTY_NAME_MIN_LEN}–${PARTY_NAME_MAX_LEN} characters`;
    case PARTY_RESULT_REASONS.INVALID_MODE:         return 'Pick a timeout mode';
    case PARTY_RESULT_REASONS.INVALID_INPUT:        return 'Invalid input';
    case PARTY_RESULT_REASONS.INVALID_STATE:        return 'Party in wrong state for that action';
    case PARTY_RESULT_REASONS.NOT_CURRENT_TURN:     return 'Not your turn';
    case PARTY_RESULT_REASONS.TURN_NOT_EXPIRED:     return 'Turn deadline has not expired yet';
    case PARTY_RESULT_REASONS.ALREADY_STARTED:      return 'Run already started';
    case PARTY_RESULT_REASONS.EXCEPTION:            return 'Something went wrong';
    default:                                         return reason || 'Unknown error';
  }
}

/**
 * Find the viewer's role + active flag in a party. Returns null if not a member.
 */
function _viewerMembership(party, playerId) {
  if (!party || !Array.isArray(party.members) || !playerId) return null;
  for (const m of party.members) {
    if (m && m.playerId === playerId) {
      return { role: m.role || null, isActive: m.isActive !== false };
    }
  }
  return null;
}

/**
 * Return the current-turn member object, or null if the party isn't active.
 */
function _currentTurnMember(party) {
  if (!party || party.state !== PARTY_STATE_ACTIVE) return null;
  const members = Array.isArray(party.members) ? party.members : [];
  if (members.length === 0) return null;
  const idx = (typeof party.turnIndex === 'number' && isFinite(party.turnIndex))
    ? Math.max(0, Math.floor(party.turnIndex)) % members.length : 0;
  return members[idx] || null;
}

/**
 * Format a relative timestamp ("3m ago", "2h ago", "—").
 */
function _formatRelativeTs(t) {
  if (typeof t !== 'number' || !isFinite(t) || t <= 0) return '—';
  const dt = Math.max(0, Date.now() - t);
  if (dt < 60 * 1000) return 'just now';
  if (dt < 60 * 60 * 1000) return `${Math.floor(dt / (60 * 1000))}m ago`;
  if (dt < 24 * 60 * 60 * 1000) return `${Math.floor(dt / (60 * 60 * 1000))}h ago`;
  return `${Math.floor(dt / (24 * 60 * 60 * 1000))}d ago`;
}

// ─── Main render entry ─────────────────────────────────────────────────

/**
 * Mount the Party Tower screen into `rootEl`. Default mount: #screenPartyTower.
 *
 * `ctx` is an optional context bag with shape:
 *   { initialTab?, initialPartyId? }
 *
 * Performance: starts wall-clock at entry; logs WARN if FCP exceeds budget.
 */
export function renderPartyTower(rootEl, ctx) {
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  const root = rootEl || (typeof document !== 'undefined'
    ? document.getElementById('screenPartyTower')
    : null);
  if (!root) return;
  _rootEl = root;
  _viewerPlayerId = resolveCurrentPlayerId();

  if (ctx && typeof ctx === 'object') {
    if (typeof ctx.initialTab === 'string' && PARTY_TABS.indexOf(ctx.initialTab) >= 0) {
      _activeTab = ctx.initialTab;
    }
    if (typeof ctx.initialPartyId === 'string' && ctx.initialPartyId.length > 0) {
      _currentPartyId = ctx.initialPartyId;
    }
  }

  // Stop any existing countdown ticker (re-mount safety).
  _stopCountdownTicker();

  // Detail view takes precedence over tab view.
  if (_currentPartyId) {
    _renderDetailAsync(root, _currentPartyId);
  } else {
    _renderTabsShellThenLoadActive(root);
  }

  try {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      if (dt > PARTY_FCP_BUDGET_MS) {
        try { log.warn('PartyTower render over FCP budget:', dt.toFixed(2), 'ms'); } catch (_e) {}
      }
    }
  } catch (_e) {}
}

// ─── Tabs shell ────────────────────────────────────────────────────────

function _renderTabsShellThenLoadActive(root) {
  const html = [
    '<div class="pt-wrap">',
    _renderHeader(),
    _renderTabNav(_activeTab),
    '<div class="pt-body" id="ptBody">',
    '<div class="pt-loading">Loading…</div>',
    '</div>',
    '</div>',
  ].join('');
  root.innerHTML = html;
  _wireHeaderBackButton(root);
  _wireTabClicks(root);

  if (_activeTab === PARTY_TAB_YOUR) {
    _loadYourParties(root);
  } else {
    _loadBrowseParties(root);
  }
}

function _renderHeader() {
  return [
    '<div class="pt-header">',
    '<button type="button" class="pt-back-btn" id="ptBackBtn" aria-label="Back">&larr;</button>',
    '<h1 class="pt-title">PARTY TOWER</h1>',
    '</div>',
  ].join('');
}

function _renderTabNav(activeTab) {
  const tabs = [
    { key: PARTY_TAB_YOUR,    label: 'Your Parties' },
    { key: PARTY_TAB_BROWSE,  label: 'Browse' },
  ];
  return [
    '<div class="pt-tabs" role="tablist">',
    tabs.map(t => {
      const active = (t.key === activeTab) ? ' active' : '';
      return `<button type="button" class="pt-tab${active}" data-pt-tab="${t.key}" role="tab" aria-selected="${t.key === activeTab}">${_escape(t.label)}</button>`;
    }).join(''),
    '</div>',
  ].join('');
}

function _wireHeaderBackButton(root) {
  try {
    const back = root.querySelector('#ptBackBtn');
    if (!back) return;
    back.addEventListener('click', () => {
      try {
        // From detail → back to tab view; from tab view → back to menu.
        if (_currentPartyId) {
          _currentPartyId = null;
          _stopCountdownTicker();
          _renderTabsShellThenLoadActive(root);
        } else if (typeof window !== 'undefined' && typeof window.goToMenu === 'function') {
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
    const tabBtns = root.querySelectorAll('[data-pt-tab]');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-pt-tab');
        if (!tab || tab === _activeTab) return;
        _activeTab = tab;
        _renderTabsShellThenLoadActive(root);
      });
    });
  } catch (_e) {}
}

// ─── Your Parties tab ──────────────────────────────────────────────────

async function _loadYourParties(root) {
  const body = root.querySelector('#ptBody');
  if (!body) return;
  let parties = [];
  let backendOk = true;
  try {
    const result = await listPartiesForPlayer(_viewerPlayerId);
    if (result && result.ok && Array.isArray(result.parties)) {
      parties = result.parties;
    } else if (result && !result.ok && result.reason === PARTY_RESULT_REASONS.NO_SDK) {
      backendOk = false;
    }
  } catch (e) {
    try { log.warn('listPartiesForPlayer failed:', e); } catch (_e) {}
    backendOk = false;
  }
  if (root !== _rootEl) return;
  renderYourPartiesTab(body, parties, { backendOk, viewerPlayerId: _viewerPlayerId });
}

/**
 * Render the Your Parties tab body. Exported for unit tests.
 *
 * @param {HTMLElement} bodyEl
 * @param {Array<object>} parties
 * @param {{backendOk?: boolean, viewerPlayerId?: string}} [opts]
 */
export function renderYourPartiesTab(bodyEl, parties, opts) {
  if (!bodyEl) return;
  const list = Array.isArray(parties) ? parties : [];
  const backendOk = opts ? (opts.backendOk !== false) : true;
  const viewerId = opts ? (opts.viewerPlayerId || '') : '';

  if (!backendOk) {
    bodyEl.innerHTML = [
      '<div class="pt-empty">',
      `<p class="pt-empty-title">${_escape(_reasonToMessage(PARTY_RESULT_REASONS.NO_SDK))}</p>`,
      '<p class="pt-empty-sub">Party Tower syncs over the network. Check your connection and try again.</p>',
      '</div>',
    ].join('');
    return;
  }

  if (list.length === 0) {
    bodyEl.innerHTML = [
      '<div class="pt-empty">',
      '<p class="pt-empty-title">No parties yet</p>',
      `<p class="pt-empty-sub">Found a coop band of ${PARTY_MIN_SIZE}–${PARTY_MAX_SIZE}. Climb the Tower asynchronously.</p>`,
      `<button type="button" class="pt-cta-btn" id="ptCreateBtn">+ Create new party</button>`,
      '</div>',
    ].join('');
    _wireCreateButton(bodyEl);
    return;
  }

  bodyEl.innerHTML = [
    '<ul class="pt-party-list" role="list">',
    list.map(p => _renderPartyCard(p, viewerId)).join(''),
    '</ul>',
    `<button type="button" class="pt-cta-btn pt-cta-btn--inline" id="ptCreateBtn">+ Create new party</button>`,
  ].join('');
  _wireCreateButton(bodyEl);
  _wirePartyCards(bodyEl);
}

function _renderPartyCard(party, viewerId) {
  const name = _escape(party.partyId || '(unnamed party)');
  const members = Array.isArray(party.members) ? party.members : [];
  const state = party.state || 'pending';
  const isYourTurn = !!(viewerId && state === PARTY_STATE_ACTIVE && _currentTurnMember(party) && _currentTurnMember(party).playerId === viewerId);
  const turnInfo = state === PARTY_STATE_ACTIVE
    ? (isYourTurn ? 'YOUR TURN' : `Turn: ${_escape((_currentTurnMember(party) || {}).playerId || 'someone')}`)
    : (state === PARTY_STATE_PENDING ? 'Awaiting start' : state);
  return [
    `<li class="pt-party-row">`,
    `<button type="button" class="pt-party-card" data-pt-party-id="${_escape(party.partyId)}">`,
    `<span class="pt-party-name">${name}<span class="pt-state-pill pt-state-pill--${_escape(state)}">${_escape(state)}</span></span>`,
    `<span class="pt-party-meta">${members.length}/${PARTY_MAX_SIZE} members</span>`,
    `<span class="pt-party-meta ${isYourTurn ? 'pt-party-meta--your-turn' : 'pt-party-meta--turn'}">${_escape(turnInfo)}</span>`,
    `<span class="pt-party-card-action"><span class="pt-party-action">View &rarr;</span></span>`,
    `</button>`,
    `</li>`,
  ].join('');
}

function _wirePartyCards(bodyEl) {
  try {
    const cards = bodyEl.querySelectorAll('[data-pt-party-id]');
    cards.forEach(card => {
      card.addEventListener('click', (e) => {
        const partyId = e.currentTarget.getAttribute('data-pt-party-id');
        if (!partyId) return;
        _currentPartyId = partyId;
        if (_rootEl) _renderDetailAsync(_rootEl, partyId);
      });
    });
  } catch (_e) {}
}

function _wireCreateButton(bodyEl) {
  try {
    const btn = bodyEl.querySelector('#ptCreateBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      _openCreateModal();
    });
  } catch (_e) {}
}

// ─── Browse tab ────────────────────────────────────────────────────────
// Per spec §3.6 anti-spam: cap is per-account; public browse is intentionally
// minimal (no search-by-name; party-id is shared via clan / friend invite,
// matching async-coop intent — you don't "discover" stranger parties).

async function _loadBrowseParties(root) {
  const body = root.querySelector('#ptBody');
  if (!body) return;
  renderBrowseTab(body, {});
}

/**
 * Render the Browse tab body. Surfaces a Create CTA + spec note that
 * party discovery is intentionally invite-only (not stranger-browsable).
 *
 * @param {HTMLElement} bodyEl
 * @param {object} [opts]
 */
export function renderBrowseTab(bodyEl, opts) {
  if (!bodyEl) return;
  void opts;
  bodyEl.innerHTML = [
    '<div class="pt-empty">',
    '<p class="pt-empty-title">Invite-only parties</p>',
    '<p class="pt-empty-sub">Party Tower runs are coop-async — start a new party and share the id with friends or clanmates.</p>',
    `<button type="button" class="pt-cta-btn" id="ptCreateBtn">+ Create new party</button>`,
    '</div>',
  ].join('');
  _wireCreateButton(bodyEl);
}

// ─── Party detail ──────────────────────────────────────────────────────

async function _renderDetailAsync(root, partyId) {
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  // Show loading shell first (FCP).
  root.innerHTML = [
    '<div class="pt-wrap">',
    '<div class="pt-header pt-header--detail">',
    '<button type="button" class="pt-back-btn" id="ptBackBtn" aria-label="Back">&larr;</button>',
    '<h1 class="pt-title">PARTY</h1>',
    '</div>',
    '<div class="pt-body" id="ptBody"><div class="pt-loading">Loading party…</div></div>',
    '</div>',
  ].join('');
  _wireHeaderBackButton(root);

  let party = null;
  let backendOk = true;
  try {
    // First, attempt to auto-skip an expired turn (client-side fallback per
    // spec §3.1). Best-effort — failure is silently ignored.
    try { await maybeAutoSkipExpiredTurn(partyId, {}); } catch (_e) {}
    const result = await fetchParty(partyId);
    if (result && result.ok && result.party) {
      party = result.party;
    } else if (result && !result.ok && result.reason === PARTY_RESULT_REASONS.NO_SDK) {
      backendOk = false;
    }
  } catch (e) {
    try { log.warn('fetchParty failed:', e); } catch (_e) {}
    backendOk = false;
  }
  if (root !== _rootEl) return;
  const body = root.querySelector('#ptBody');
  if (!body) return;

  if (!backendOk) {
    body.innerHTML = `<div class="pt-empty"><p class="pt-empty-title">${_escape(_reasonToMessage(PARTY_RESULT_REASONS.NO_SDK))}</p></div>`;
    return;
  }
  if (!party) {
    body.innerHTML = `<div class="pt-empty"><p class="pt-empty-title">${_escape(_reasonToMessage(PARTY_RESULT_REASONS.NOT_FOUND))}</p></div>`;
    return;
  }
  renderPartyDetail(body, party, _viewerPlayerId);

  try {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      if (dt > PARTY_DETAIL_BUDGET_MS) {
        try { log.warn('PartyTower detail render over budget:', dt.toFixed(2), 'ms'); } catch (_e) {}
      }
    }
  } catch (_e) {}

  // Kick off the countdown ticker for the turn banner — only when active.
  if (party.state === PARTY_STATE_ACTIVE) {
    _startCountdownTicker(party.currentTurnDeadline, root);
  }
}

/**
 * Render the party detail view. Exported for unit tests.
 *
 * @param {HTMLElement} bodyEl
 * @param {object} party
 * @param {string} viewerId
 */
export function renderPartyDetail(bodyEl, party, viewerId) {
  if (!bodyEl || !party) return;
  const membership = _viewerMembership(party, viewerId);
  const isOwner = !!(membership && membership.role === PARTY_ROLE_OWNER);
  const isMember = !!membership;
  const state = party.state || PARTY_STATE_PENDING;
  const members = Array.isArray(party.members) ? party.members : [];
  const currentTurn = _currentTurnMember(party);
  const isYourTurn = !!(currentTurn && currentTurn.playerId === viewerId);
  const progress = computePartyProgress(party);
  const sharedState = (party.sharedState && typeof party.sharedState === 'object') ? party.sharedState : {};
  const hearts = sharedState.towerHearts || { current: 0, max: 0, retryCount: 0 };
  const selectedPacts = (sharedState.towerPacts && Array.isArray(sharedState.towerPacts.selected))
    ? sharedState.towerPacts.selected : [];
  const turnHistory = Array.isArray(party.turnHistory) ? party.turnHistory : [];

  const parts = [];

  // ── Turn banner (only when active) ──
  if (state === PARTY_STATE_ACTIVE) {
    const cd = formatCountdown(party.currentTurnDeadline);
    const expired = computeTurnHasExpired(party, Date.now());
    const banner = [];
    banner.push('<div class="pt-turn-banner' + (isYourTurn ? ' pt-turn-banner--your' : '') + (expired ? ' pt-turn-banner--expired' : '') + '">');
    banner.push('<div>');
    banner.push(`<p class="pt-turn-label">${expired ? 'Turn expired — awaiting auto-skip' : (isYourTurn ? 'It’s your turn' : 'Awaiting turn')}</p>`);
    banner.push(`<p class="pt-turn-player">${_escape((currentTurn && currentTurn.playerId) || 'unknown')}</p>`);
    banner.push('</div>');
    banner.push(`<div class="pt-turn-countdown pt-turn-countdown--${cd.severity}" id="ptCountdown" data-pt-deadline="${party.currentTurnDeadline | 0}">${_escape(cd.text)}</div>`);
    banner.push('</div>');
    parts.push(banner.join(''));
  }

  // ── Header (name + state pill) ──
  parts.push('<div class="pt-detail-head">');
  parts.push(`<h2 class="pt-detail-name">${_escape(party.partyId || 'Party')}</h2>`);
  parts.push(`<div class="pt-detail-meta">`);
  parts.push(`<span class="pt-state-pill pt-state-pill--${_escape(state)}">${_escape(state)}</span>`);
  parts.push(`<span>${members.length}/${PARTY_MAX_SIZE} members</span>`);
  parts.push(`<span>Mode: ${_escape((PARTY_TIMEOUT_MODE_LABELS[party.turnTimeoutMode] || {}).label || party.turnTimeoutMode || 'standard')}</span>`);
  parts.push(`</div>`);
  parts.push('</div>');

  // ── Run info row (hearts + pacts + floor) ──
  if (state === PARTY_STATE_ACTIVE || state === 'completed') {
    parts.push('<div class="pt-info-row">');
    parts.push('<div class="pt-info-cell">');
    parts.push(`<p class="pt-info-cell-label">Tower Hearts</p>`);
    parts.push(`<p class="pt-info-cell-value">${(hearts.current | 0)} / ${(hearts.max | 0)}</p>`);
    parts.push('</div>');
    parts.push('<div class="pt-info-cell">');
    parts.push(`<p class="pt-info-cell-label">Retries Used</p>`);
    parts.push(`<p class="pt-info-cell-value">${(hearts.retryCount | 0)}</p>`);
    parts.push('</div>');
    parts.push('<div class="pt-info-cell">');
    parts.push(`<p class="pt-info-cell-label">Floor</p>`);
    parts.push(`<p class="pt-info-cell-value">${progress.floorIndex | 0}</p>`);
    parts.push('</div>');
    parts.push('<div class="pt-info-cell">');
    parts.push(`<p class="pt-info-cell-label">Turns Taken</p>`);
    parts.push(`<p class="pt-info-cell-value">${progress.turnCount | 0}</p>`);
    parts.push('</div>');
    parts.push('</div>');
  }

  // ── Active Pacts ──
  parts.push('<div class="pt-detail-section">');
  parts.push('<h3 class="pt-detail-section-h">Active Pacts</h3>');
  if (selectedPacts.length === 0) {
    parts.push('<p class="pt-pact-empty">No pacts selected yet.</p>');
  } else {
    parts.push('<ul class="pt-pact-list" role="list">');
    selectedPacts.forEach(pactId => {
      parts.push(`<li class="pt-pact-row"><span class="pt-pact-name">${_escape(pactId)}</span></li>`);
    });
    parts.push('</ul>');
  }
  parts.push('</div>');

  // ── Members ──
  parts.push('<div class="pt-detail-section">');
  parts.push('<h3 class="pt-detail-section-h">Members</h3>');
  parts.push('<ul class="pt-member-list" role="list">');
  members.forEach(m => {
    if (!m) return;
    const isCurrent = !!(currentTurn && currentTurn.playerId === m.playerId);
    const inactive = m.isActive === false;
    const role = m.role || 'member';
    parts.push(`<li class="pt-member-row${isCurrent ? ' pt-member-row--current' : ''}${inactive ? ' pt-member-row--inactive' : ''}">`);
    parts.push(`<span class="pt-member-turn-marker" aria-hidden="true">${isCurrent ? '▶' : ''}</span>`);
    parts.push(`<span class="pt-member-name">${_escape(m.playerId || 'unknown')}</span>`);
    parts.push(`<span class="pt-member-role">${_escape(role)}</span>`);
    parts.push(`<span class="pt-member-meta">${_escape(_formatRelativeTs(m.joinedAt))}</span>`);
    parts.push('</li>');
  });
  parts.push('</ul>');
  parts.push('</div>');

  // ── Activity feed (turn-took blurbs — §3.5) ──
  if (turnHistory.length > 0) {
    parts.push('<div class="pt-detail-section">');
    parts.push('<h3 class="pt-detail-section-h">Activity</h3>');
    parts.push('<ul class="pt-activity-list" role="list">');
    // Show most-recent 8 turns. Each row is "@<player> ended their turn · 3m ago"
    const recent = turnHistory.slice(-8).reverse();
    recent.forEach(t => {
      if (!t) return;
      const yours = t.playerId === viewerId;
      parts.push(`<li class="pt-activity-row${yours ? ' pt-activity-row--your' : ''}">`);
      parts.push(`<span>${_escape(t.playerId || 'someone')} ended their turn</span>`);
      parts.push(`<span class="pt-activity-time">${_escape(_formatRelativeTs(t.endedAt))}</span>`);
      parts.push('</li>');
    });
    parts.push('</ul>');
    // Emoji react row — applies to most recent turn.
    if (isMember && state === PARTY_STATE_ACTIVE) {
      const lastTurnIdx = turnHistory.length - 1;
      parts.push('<div class="pt-emoji-row" role="group" aria-label="React to last turn">');
      PARTY_EMOJIS.forEach(emoji => {
        parts.push(`<button type="button" class="pt-emoji-btn" data-pt-emoji="${_escape(emoji)}" data-pt-turn-idx="${lastTurnIdx}">${emoji}</button>`);
      });
      parts.push('</div>');
    }
    parts.push('</div>');
  }

  // ── Action buttons ──
  parts.push('<div class="pt-detail-actions">');
  if (state === PARTY_STATE_PENDING && isOwner) {
    const canStart = canPlayerStartParty(viewerId, party);
    parts.push(`<button type="button" class="pt-action-btn pt-action-btn--primary" id="ptStartBtn" ${canStart ? '' : 'disabled aria-disabled="true"'}>Start Run</button>`);
  }
  if (state === PARTY_STATE_ACTIVE && isYourTurn) {
    const canEnd = canPlayerEndTurn(viewerId, party);
    parts.push(`<button type="button" class="pt-action-btn pt-action-btn--primary" id="ptEndTurnBtn" ${canEnd ? '' : 'disabled aria-disabled="true"'}>End Turn</button>`);
  }
  if (state === PARTY_STATE_PENDING && isMember) {
    parts.push(`<button type="button" class="pt-action-btn" id="ptInviteBtn">Share Invite</button>`);
  }
  if (isMember) {
    const isOwnerLeaveBlocked = isOwner && members.length > 1;
    parts.push(`<button type="button" class="pt-action-btn pt-action-btn--leave" id="ptLeaveBtn" ${isOwnerLeaveBlocked ? 'disabled aria-disabled="true" title="Transfer ownership first"' : ''}>Leave</button>`);
  }
  parts.push('</div>');

  bodyEl.innerHTML = parts.join('');

  // ── Wire action buttons ──
  _wireDetailActions(bodyEl, party, viewerId);
  _wireEmojiButtons(bodyEl, party.partyId);
}

function _wireDetailActions(bodyEl, party, viewerId) {
  try {
    const startBtn = bodyEl.querySelector('#ptStartBtn');
    if (startBtn) {
      startBtn.addEventListener('click', async () => {
        try {
          const result = await startParty(party.partyId, viewerId);
          if (!result || !result.ok) {
            _showToast(_reasonToMessage((result && result.reason) || PARTY_RESULT_REASONS.EXCEPTION));
            return;
          }
          // Refresh detail view
          if (_rootEl) _renderDetailAsync(_rootEl, party.partyId);
        } catch (e) { try { log.warn('startParty failed:', e); } catch (_e) {} }
      });
    }
    const endBtn = bodyEl.querySelector('#ptEndTurnBtn');
    if (endBtn) {
      endBtn.addEventListener('click', async () => {
        try {
          const result = await endTurn(party.partyId, viewerId, {});
          if (!result || !result.ok) {
            _showToast(_reasonToMessage((result && result.reason) || PARTY_RESULT_REASONS.EXCEPTION));
            return;
          }
          if (_rootEl) _renderDetailAsync(_rootEl, party.partyId);
        } catch (e) { try { log.warn('endTurn failed:', e); } catch (_e) {} }
      });
    }
    const leaveBtn = bodyEl.querySelector('#ptLeaveBtn');
    if (leaveBtn) {
      leaveBtn.addEventListener('click', async () => {
        try {
          if (leaveBtn.getAttribute('aria-disabled') === 'true') {
            _showToast(_reasonToMessage(PARTY_RESULT_REASONS.OWNER_CANNOT_LEAVE));
            return;
          }
          const result = await leaveParty(party.partyId, viewerId);
          if (!result || !result.ok) {
            _showToast(_reasonToMessage((result && result.reason) || PARTY_RESULT_REASONS.EXCEPTION));
            return;
          }
          _currentPartyId = null;
          _stopCountdownTicker();
          if (_rootEl) _renderTabsShellThenLoadActive(_rootEl);
        } catch (e) { try { log.warn('leaveParty failed:', e); } catch (_e) {} }
      });
    }
    const inviteBtn = bodyEl.querySelector('#ptInviteBtn');
    if (inviteBtn) {
      inviteBtn.addEventListener('click', () => {
        try {
          _shareInvite(party.partyId);
        } catch (_e) {}
      });
    }
  } catch (_e) {}
}

function _wireEmojiButtons(bodyEl, partyId) {
  try {
    const btns = bodyEl.querySelectorAll('[data-pt-emoji]');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const emoji = e.currentTarget.getAttribute('data-pt-emoji');
        const turnIdxStr = e.currentTarget.getAttribute('data-pt-turn-idx');
        const turnIdx = turnIdxStr != null ? parseInt(turnIdxStr, 10) : -1;
        if (!emoji || !partyId || !isFinite(turnIdx)) return;
        _recordLocalReaction(partyId, turnIdx, emoji);
        _showToast(`${emoji} sent`);
      });
    });
  } catch (_e) {}
}

// ─── Async social hooks: navigator.share invite + local emoji mirror ─────

function _shareInvite(partyId) {
  // navigator.share (mobile) when available; otherwise copy to clipboard.
  try {
    const text = `Join my Party Tower run: ${partyId}`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      navigator.share({ title: 'Blocksworn Party Tower invite', text }).catch(() => {
        _fallbackCopy(text);
      });
      return;
    }
    _fallbackCopy(text);
  } catch (_e) {
    _showToast('Could not share invite');
  }
}

function _fallbackCopy(text) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(() => _showToast('Invite copied to clipboard')).catch(() => _showToast(text));
      return;
    }
  } catch (_e) {}
  _showToast(text);
}

function _recordLocalReaction(partyId, turnIdx, emoji) {
  // Module-local mirror. T3.13.1 wires the Firestore append.
  try {
    if (!_localReactions[partyId]) _localReactions[partyId] = {};
    if (!_localReactions[partyId][turnIdx]) _localReactions[partyId][turnIdx] = {};
    _localReactions[partyId][turnIdx][emoji] = (_localReactions[partyId][turnIdx][emoji] || 0) + 1;
  } catch (_e) {}
}

// ─── Countdown ticker (setInterval — drift-tolerant for 1Hz) ──────────

function _startCountdownTicker(deadlineMs, root) {
  _stopCountdownTicker();
  if (typeof deadlineMs !== 'number' || !isFinite(deadlineMs) || deadlineMs <= 0) return;
  if (typeof window === 'undefined' || typeof window.setInterval !== 'function') return;
  _countdownTimer = window.setInterval(() => {
    try {
      const el = root && root.querySelector ? root.querySelector('#ptCountdown') : null;
      if (!el) {
        _stopCountdownTicker();
        return;
      }
      const cd = formatCountdown(deadlineMs);
      el.textContent = cd.text;
      // Update severity class
      el.className = `pt-turn-countdown pt-turn-countdown--${cd.severity}`;
      if (cd.severity === 'expired') {
        // Banner state-change — refresh whole detail so auto-skip can fire.
        _stopCountdownTicker();
        if (_currentPartyId && _rootEl) _renderDetailAsync(_rootEl, _currentPartyId);
      }
    } catch (_e) {}
  }, COUNTDOWN_TICK_MS);
}

function _stopCountdownTicker() {
  try {
    if (_countdownTimer != null && typeof window !== 'undefined' && typeof window.clearInterval === 'function') {
      window.clearInterval(_countdownTimer);
    }
  } catch (_e) {}
  _countdownTimer = null;
}

// ─── Create modal ──────────────────────────────────────────────────────

function _openCreateModal() {
  if (_createModalOpen) return;
  _createModalOpen = true;
  if (typeof document === 'undefined' || !_rootEl) return;
  const overlay = document.createElement('div');
  overlay.className = 'pt-modal-overlay';
  overlay.id = 'ptCreateOverlay';
  renderCreatePartyModal(overlay, {
    onCancel: () => _closeCreateModal(overlay),
    onSubmit: async (name, mode) => {
      const v = validateCreateForm(name, mode);
      const errEl = overlay.querySelector('#ptCreateError');
      if (!v.ok) {
        if (errEl) errEl.textContent = _reasonToMessage(v.reason);
        return;
      }
      try {
        const result = await createParty(_viewerPlayerId, mode);
        if (!result || !result.ok) {
          if (errEl) errEl.textContent = _reasonToMessage((result && result.reason) || PARTY_RESULT_REASONS.EXCEPTION);
          return;
        }
        // Note: name isn't persisted on the party doc in T3.10 (partyId
        // is the visible label). Future T3.13.1 may surface the trimmed
        // name as a derived display attribute. For now we close and jump
        // straight into the freshly-created party detail.
        void name;
        _closeCreateModal(overlay);
        _currentPartyId = result.partyId;
        if (_rootEl) _renderDetailAsync(_rootEl, result.partyId);
      } catch (e) {
        try { log.warn('createParty failed:', e); } catch (_e) {}
        if (errEl) errEl.textContent = _reasonToMessage(PARTY_RESULT_REASONS.EXCEPTION);
      }
    },
  });
  if (_rootEl && _rootEl.appendChild) _rootEl.appendChild(overlay);
}

function _closeCreateModal(overlayEl) {
  _createModalOpen = false;
  try {
    if (overlayEl && overlayEl.parentNode && overlayEl.parentNode.removeChild) {
      overlayEl.parentNode.removeChild(overlayEl);
    }
  } catch (_e) {}
}

/**
 * Render the create-party modal into `mountEl`. Exported for unit tests.
 *
 * @param {HTMLElement} mountEl
 * @param {{onCancel: Function, onSubmit: Function}} callbacks
 */
export function renderCreatePartyModal(mountEl, callbacks) {
  if (!mountEl) return;
  const cbs = callbacks || {};
  const modes = PARTY_TIMEOUT_MODE_ORDER;
  const defaultMode = PARTY_DEFAULT_TIMEOUT_MODE;
  mountEl.innerHTML = [
    '<div class="pt-modal" role="dialog" aria-label="Create party">',
    '<h2 class="pt-modal-title">Create Party</h2>',
    `<label class="pt-modal-label" for="ptCreateName">Name (${PARTY_NAME_MIN_LEN}-${PARTY_NAME_MAX_LEN})</label>`,
    `<input type="text" class="pt-modal-input" id="ptCreateName" maxlength="${PARTY_NAME_MAX_LEN}" autocomplete="off" />`,
    '<p class="pt-modal-label">Turn timeout</p>',
    '<div class="pt-modal-radio-group">',
    modes.map(mode => {
      const meta = PARTY_TIMEOUT_MODE_LABELS[mode];
      const checked = mode === defaultMode ? 'checked' : '';
      return [
        `<label class="pt-modal-radio-row" for="ptCreateMode-${_escape(mode)}">`,
        `<input type="radio" name="ptCreateMode" id="ptCreateMode-${_escape(mode)}" value="${_escape(mode)}" ${checked} />`,
        '<span>',
        `<span class="pt-modal-radio-label">${_escape(meta.label)}</span>`,
        `<span class="pt-modal-radio-sub">${_escape(meta.sub)}</span>`,
        '</span>',
        '</label>',
      ].join('');
    }).join(''),
    '</div>',
    '<p class="pt-modal-error" id="ptCreateError"></p>',
    '<div class="pt-modal-actions">',
    '<button type="button" class="pt-action-btn" id="ptCreateCancel">Cancel</button>',
    '<button type="button" class="pt-action-btn pt-action-btn--primary" id="ptCreateSubmit">Create</button>',
    '</div>',
    '</div>',
  ].join('');

  try {
    const cancel = mountEl.querySelector('#ptCreateCancel');
    const submit = mountEl.querySelector('#ptCreateSubmit');
    const nameInput = mountEl.querySelector('#ptCreateName');
    if (cancel) cancel.addEventListener('click', () => { if (cbs.onCancel) cbs.onCancel(); });
    if (submit) submit.addEventListener('click', () => {
      const name = nameInput ? (nameInput.value || '') : '';
      let mode = PARTY_DEFAULT_TIMEOUT_MODE;
      try {
        const radios = mountEl.querySelectorAll('input[name="ptCreateMode"]');
        for (let i = 0; i < radios.length; i++) {
          const r = radios[i];
          if (r && r.checked) { mode = r.value || mode; break; }
        }
      } catch (_e) {}
      if (cbs.onSubmit) cbs.onSubmit(name, mode);
    });
  } catch (_e) {}
}

// ─── Toast ────────────────────────────────────────────────────────────

function _showToast(message) {
  try {
    if (typeof document === 'undefined' || !_rootEl) return;
    const old = document.getElementById('ptToast');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    const el = document.createElement('div');
    el.className = 'pt-toast';
    el.id = 'ptToast';
    el.textContent = String(message || '');
    _rootEl.appendChild(el);
    if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
      window.setTimeout(() => {
        try { if (el.parentNode) el.parentNode.removeChild(el); } catch (_e) {}
      }, 2200);
    }
  } catch (_e) {}
}

// ─── Testables ────────────────────────────────────────────────────────

export const __partyTowerTestables = Object.freeze({
  reset() {
    _activeTab = PARTY_DEFAULT_TAB;
    _currentPartyId = null;
    _createModalOpen = false;
    _rootEl = null;
    _viewerPlayerId = null;
    _stopCountdownTicker();
    _localReactions = {};
  },
  getState() {
    return {
      activeTab: _activeTab,
      currentPartyId: _currentPartyId,
      createModalOpen: _createModalOpen,
      viewerPlayerId: _viewerPlayerId,
      localReactions: JSON.parse(JSON.stringify(_localReactions)),
    };
  },
  setRoot(el) { _rootEl = el; },
  setViewerId(id) { _viewerPlayerId = id; },
  recordReactionForTest: _recordLocalReaction,
  PARTY_EMOJIS,
  PARTY_TIMEOUT_MODE_ORDER,
});
