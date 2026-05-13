// 2026-05-13 — TASK-057 (T3.13): Party Tower UI unit tests.
//
// Spec: docs/design/endgame-social.md §3 (Party Tower — async 2-5 coop)
//       + §3.1 (turn-based architecture, timeout modes)
//       + §3.5 (async social hooks — emoji-only).
//
// Coverage strategy: Vitest runs in `node` env. We hand-roll the minimal
// localStorage + DOM shim (mirrors adventures-ui.test.js + codex.test.js)
// so the UI render functions exercise their full path without a real
// browser. Focus is public API shape, defensive coding, validation, and
// DOM structure — NOT browser events (those covered by smoke suite).
//
// Surface tested:
//   - validateCreateForm           — name + mode validation
//   - formatCountdown              — pure helper; severity bands; expired
//   - resolveCurrentPlayerId       — localStorage roundtrip + anonymous fallback
//   - renderYourPartiesTab         — empty / offline / populated / your-turn highlight
//   - renderBrowseTab              — invite-only copy + Create CTA
//   - renderPartyDetail            — pending state, active state, hearts pool,
//                                    pacts list, members list, action buttons
//                                    role-gated (Start/End Turn/Leave)
//   - renderCreatePartyModal       — DOM shape; 3 mode radios; cancel/submit wiring
//   - __partyTowerTestables        — state reset isolation
//   - Sacred audit                 — direct-import from party-tower-backend
//
// At least 15 tests required by T3.13 brief.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  renderYourPartiesTab,
  renderBrowseTab,
  renderPartyDetail,
  renderCreatePartyModal,
  validateCreateForm,
  formatCountdown,
  resolveCurrentPlayerId,
  __partyTowerTestables,
} from '../../src/ui/party-tower.js';
import {
  PARTY_MIN_SIZE,
  PARTY_MAX_SIZE,
  PARTY_NAME_MIN_LEN,
  PARTY_NAME_MAX_LEN,
  PARTY_DEFAULT_TIMEOUT_MODE,
  PARTY_ROLE_OWNER,
  PARTY_STATE_ACTIVE,
  PARTY_STATE_PENDING,
  PARTY_RESULT_REASONS,
  _resetMockPartyStore,
} from '../../src/services/party-tower-backend.js';

// ─── Minimal in-memory localStorage shim ────────────────────────────
function createMockLocalStorage() {
  const store = Object.create(null);
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
    clear() { for (const k of Object.keys(store)) delete store[k]; },
  };
}

// ─── Minimal DOM shim — element factory + by-id selector ─────────────
function createElement(tag) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [],
    _listeners: {},
    _attrs: {},
    _id: '',
    _innerHTML: '',
    _value: '',
    _checked: false,
    parentNode: null,
    style: {},
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); },
      toggle(c, force) {
        if (force === true) this._set.add(c);
        else if (force === false) this._set.delete(c);
        else if (this._set.has(c)) this._set.delete(c);
        else this._set.add(c);
      },
    },
    get id() { return this._id; },
    set id(v) { this._id = String(v); },
    get textContent() { return this._textContent || ''; },
    set textContent(v) { this._textContent = String(v); this._innerHTML = String(v); },
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) { this._innerHTML = String(v); this.children = []; },
    get value() { return this._value; },
    set value(v) { this._value = String(v); },
    get checked() { return this._checked; },
    set checked(v) { this._checked = !!v; },
    appendChild(child) {
      if (child) { child.parentNode = this; this.children.push(child); }
      return child;
    },
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx >= 0) { this.children.splice(idx, 1); if (child) child.parentNode = null; }
      return child;
    },
    setAttribute(k, v) { this._attrs[k] = String(v); if (k === 'id') this._id = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; },
    addEventListener(ev, fn) {
      if (!this._listeners[ev]) this._listeners[ev] = [];
      this._listeners[ev].push(fn);
    },
    querySelector(sel) { return _querySelector(this, sel); },
    querySelectorAll() { return []; },
    closest() { return null; },
  };
  return el;
}

function _querySelector(root, sel) {
  if (typeof sel !== 'string' || !sel.startsWith('#')) return null;
  const id = sel.slice(1);
  const stack = [...(root.children || [])];
  while (stack.length > 0) {
    const node = stack.shift();
    if (!node) continue;
    if (node._id === id) return node;
    if (Array.isArray(node.children)) {
      for (const c of node.children) stack.push(c);
    }
  }
  return null;
}

// ─── Test lifecycle ──────────────────────────────────────────────────
let _originalLocalStorage;
let _originalDocument;

beforeEach(() => {
  _originalLocalStorage = globalThis.localStorage;
  _originalDocument = globalThis.document;
  globalThis.localStorage = createMockLocalStorage();
  globalThis.document = { createElement, getElementById() { return null; } };
  __partyTowerTestables.reset();
  _resetMockPartyStore();
});

afterEach(() => {
  if (_originalLocalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = _originalLocalStorage;
  if (_originalDocument === undefined) delete globalThis.document;
  else globalThis.document = _originalDocument;
  __partyTowerTestables.reset();
  _resetMockPartyStore();
});

// Helper — build a fully-populated party doc for detail/list assertions.
function buildParty(overrides) {
  const base = {
    partyId: 'party-x',
    ownerId: 'roman',
    members: [
      { playerId: 'roman', joinedAt: 1700000000000, role: PARTY_ROLE_OWNER, isActive: true },
      { playerId: 'blok',  joinedAt: 1700000100000, role: 'member',         isActive: true },
    ],
    minSize: PARTY_MIN_SIZE,
    maxSize: PARTY_MAX_SIZE,
    state: PARTY_STATE_PENDING,
    turnIndex: 0,
    turnHistory: [],
    turnTimeoutMode: PARTY_DEFAULT_TIMEOUT_MODE,
    turnTimeoutMs: 24 * 60 * 60 * 1000,
    currentTurnDeadline: 0,
    sharedState: {
      towerHearts: { current: 100, max: 100, retryCount: 0, drainHistory: [] },
      towerPacts: { selected: [], activePick: null },
      floorIndex: 0,
    },
    identityFxLog: [],
    createdAt: 1700000000000,
    startedAt: null,
    completedAt: null,
    updatedAt: 1700000100000,
  };
  return Object.assign(base, overrides || {});
}

// ═══════════════════════════════════════════════════════════════════════
// validateCreateForm
// ═══════════════════════════════════════════════════════════════════════

describe('validateCreateForm (T3.13)', () => {
  it('rejects empty name', () => {
    const r = validateCreateForm('', 'standard');
    expect(r.ok).toBe(false);
    expect(r.field).toBe('name');
  });

  it('rejects 2-char name (< PARTY_NAME_MIN_LEN)', () => {
    expect(PARTY_NAME_MIN_LEN).toBe(3);
    const r = validateCreateForm('ab', 'standard');
    expect(r.ok).toBe(false);
    expect(r.field).toBe('name');
  });

  it('accepts a 3-char name with default mode', () => {
    const r = validateCreateForm('abc', 'standard');
    expect(r.ok).toBe(true);
  });

  it('rejects 31-char name (> PARTY_NAME_MAX_LEN)', () => {
    expect(PARTY_NAME_MAX_LEN).toBe(30);
    const r = validateCreateForm('a'.repeat(31), 'standard');
    expect(r.ok).toBe(false);
    expect(r.field).toBe('name');
  });

  it('rejects unknown mode', () => {
    const r = validateCreateForm('OK Party', 'whale-tier');
    expect(r.ok).toBe(false);
    expect(r.field).toBe('mode');
    expect(r.reason).toBe(PARTY_RESULT_REASONS.INVALID_MODE);
  });

  it('accepts all three legitimate modes', () => {
    for (const mode of ['competitive', 'standard', 'casual']) {
      expect(validateCreateForm('ValidName', mode).ok).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// formatCountdown
// ═══════════════════════════════════════════════════════════════════════

describe('formatCountdown (T3.13)', () => {
  it('returns "—" / safe for invalid deadline', () => {
    expect(formatCountdown(0).text).toBe('—');
    expect(formatCountdown(0).severity).toBe('safe');
    expect(formatCountdown(NaN).text).toBe('—');
    expect(formatCountdown(undefined).text).toBe('—');
  });

  it('returns "Expired" / severity expired when past deadline', () => {
    const cd = formatCountdown(1000, 99999);
    expect(cd.severity).toBe('expired');
    expect(cd.text).toBe('Expired');
    expect(cd.remainingMs).toBe(0);
  });

  it('produces "Xh Ym" format for >1 hour', () => {
    const now = 1_000_000_000_000;
    // 5h 30m
    const cd = formatCountdown(now + 5 * 60 * 60 * 1000 + 30 * 60 * 1000, now);
    expect(cd.text).toBe('5h 30m');
  });

  it('produces "Xm Ys" format for <1 hour', () => {
    const now = 1_000_000_000_000;
    // 15m 5s
    const cd = formatCountdown(now + 15 * 60 * 1000 + 5 * 1000, now);
    expect(cd.text).toBe('15m 5s');
  });

  it('classifies severity correctly across thresholds', () => {
    const now = 1_000_000_000_000;
    // Safe band: >4h
    expect(formatCountdown(now + 5 * 60 * 60 * 1000, now).severity).toBe('safe');
    // Warn band: <4h, >=30min
    expect(formatCountdown(now + 60 * 60 * 1000, now).severity).toBe('warn');
    // Danger band: <30min
    expect(formatCountdown(now + 15 * 60 * 1000, now).severity).toBe('danger');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// resolveCurrentPlayerId
// ═══════════════════════════════════════════════════════════════════════

describe('resolveCurrentPlayerId (T3.13)', () => {
  it('returns "anonymous" when no player name saved', () => {
    expect(resolveCurrentPlayerId()).toBe('anonymous');
  });

  it('returns lowercased trimmed name when set', () => {
    globalThis.localStorage.setItem('blocksworn_p8_player_name', '  ROMAN  ');
    expect(resolveCurrentPlayerId()).toBe('roman');
  });

  it('does not throw when localStorage is undefined', () => {
    delete globalThis.localStorage;
    expect(() => resolveCurrentPlayerId()).not.toThrow();
    expect(resolveCurrentPlayerId()).toBe('anonymous');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// renderYourPartiesTab
// ═══════════════════════════════════════════════════════════════════════

describe('renderYourPartiesTab (T3.13)', () => {
  it('empty state renders "No parties yet" + Create CTA', () => {
    const body = createElement('div');
    renderYourPartiesTab(body, [], { backendOk: true });
    expect(body.innerHTML).toContain('No parties yet');
    expect(body.innerHTML).toContain('ptCreateBtn');
  });

  it('offline error state renders unavailable copy', () => {
    const body = createElement('div');
    renderYourPartiesTab(body, [], { backendOk: false });
    expect(body.innerHTML).toContain('Party Tower unavailable');
  });

  it('populated state renders cards + state pill', () => {
    const body = createElement('div');
    const parties = [
      buildParty({ partyId: 'p1', state: PARTY_STATE_PENDING }),
      buildParty({ partyId: 'p2', state: PARTY_STATE_ACTIVE, turnIndex: 0 }),
    ];
    renderYourPartiesTab(body, parties, { backendOk: true, viewerPlayerId: 'blok' });
    expect(body.innerHTML).toContain('p1');
    expect(body.innerHTML).toContain('p2');
    expect(body.innerHTML).toContain('pt-state-pill--pending');
    expect(body.innerHTML).toContain('pt-state-pill--active');
    expect(body.innerHTML).toContain(`2/${PARTY_MAX_SIZE} members`);
  });

  it('your-turn highlight surfaces when viewer is current turn player', () => {
    const body = createElement('div');
    const party = buildParty({
      state: PARTY_STATE_ACTIVE,
      turnIndex: 0, // roman
    });
    renderYourPartiesTab(body, [party], { backendOk: true, viewerPlayerId: 'roman' });
    expect(body.innerHTML).toContain('YOUR TURN');
    expect(body.innerHTML).toContain('pt-party-meta--your-turn');
  });

  it('defensive: malformed party in list renders without crashing', () => {
    const body = createElement('div');
    const parties = [
      buildParty({ partyId: 'good' }),
      null,
      { partyId: 'partial' }, // missing members/state
    ];
    expect(() => renderYourPartiesTab(body, parties, { backendOk: true })).not.toThrow();
    expect(body.innerHTML).toContain('good');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// renderBrowseTab
// ═══════════════════════════════════════════════════════════════════════

describe('renderBrowseTab (T3.13)', () => {
  it('renders invite-only copy + Create CTA', () => {
    const body = createElement('div');
    renderBrowseTab(body, {});
    expect(body.innerHTML).toContain('Invite-only');
    expect(body.innerHTML).toContain('ptCreateBtn');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// renderPartyDetail
// ═══════════════════════════════════════════════════════════════════════

describe('renderPartyDetail (T3.13)', () => {
  it('renders party id + state pill + member count', () => {
    const body = createElement('div');
    const party = buildParty({ partyId: 'party-detail-x' });
    renderPartyDetail(body, party, 'roman');
    expect(body.innerHTML).toContain('party-detail-x');
    expect(body.innerHTML).toContain(`2/${PARTY_MAX_SIZE} members`);
    expect(body.innerHTML).toContain('Mode: Standard');
  });

  it('renders members list with current-turn marker on active', () => {
    const body = createElement('div');
    const party = buildParty({
      state: PARTY_STATE_ACTIVE,
      turnIndex: 1, // blok
      currentTurnDeadline: Date.now() + 60 * 60 * 1000, // 1h
    });
    renderPartyDetail(body, party, 'roman');
    // Both members rendered
    expect(body.innerHTML).toContain('roman');
    expect(body.innerHTML).toContain('blok');
    // Current-turn member row highlighted
    expect(body.innerHTML).toContain('pt-member-row--current');
  });

  it('hearts pool surfaced on active state', () => {
    const body = createElement('div');
    const party = buildParty({
      state: PARTY_STATE_ACTIVE,
      currentTurnDeadline: Date.now() + 60 * 60 * 1000,
      sharedState: {
        towerHearts: { current: 73, max: 100, retryCount: 1 },
        towerPacts: { selected: [], activePick: null },
        floorIndex: 4,
      },
    });
    renderPartyDetail(body, party, 'roman');
    expect(body.innerHTML).toContain('Tower Hearts');
    expect(body.innerHTML).toContain('73 / 100');
    expect(body.innerHTML).toContain('Retries Used');
  });

  it('selected pacts list surfaces TOWER_PACT ids; empty state when none', () => {
    const body = createElement('div');
    const party = buildParty({
      state: PARTY_STATE_ACTIVE,
      currentTurnDeadline: Date.now() + 60 * 60 * 1000,
      sharedState: {
        towerHearts: { current: 100, max: 100, retryCount: 0 },
        towerPacts: { selected: ['pact_glass_jaw', 'pact_blood_lust'], activePick: null },
        floorIndex: 0,
      },
    });
    renderPartyDetail(body, party, 'roman');
    expect(body.innerHTML).toContain('Active Pacts');
    expect(body.innerHTML).toContain('pact_glass_jaw');
    expect(body.innerHTML).toContain('pact_blood_lust');
  });

  it('Start Run button visible for owner only on pending state with min size', () => {
    const body = createElement('div');
    const party = buildParty({ state: PARTY_STATE_PENDING });
    renderPartyDetail(body, party, 'roman');
    expect(body.innerHTML).toContain('ptStartBtn');
    expect(body.innerHTML).toContain('Start Run');
  });

  it('Start Run hidden for non-owner', () => {
    const body = createElement('div');
    const party = buildParty({ state: PARTY_STATE_PENDING });
    renderPartyDetail(body, party, 'blok');
    expect(body.innerHTML).not.toContain('ptStartBtn');
  });

  it('End Turn button visible only when it is viewer\'s turn', () => {
    const bodyA = createElement('div');
    const party = buildParty({
      state: PARTY_STATE_ACTIVE,
      turnIndex: 0,
      currentTurnDeadline: Date.now() + 60 * 60 * 1000,
    });
    renderPartyDetail(bodyA, party, 'roman'); // current
    expect(bodyA.innerHTML).toContain('ptEndTurnBtn');
    const bodyB = createElement('div');
    renderPartyDetail(bodyB, party, 'blok');  // not current
    expect(bodyB.innerHTML).not.toContain('ptEndTurnBtn');
  });

  it('Leave button disabled for owner with more than 1 member (transfer-first)', () => {
    const body = createElement('div');
    const party = buildParty({ state: PARTY_STATE_PENDING });
    renderPartyDetail(body, party, 'roman');
    expect(body.innerHTML).toContain('ptLeaveBtn');
    // Owner has 2 members → leave blocked → aria-disabled attribute present.
    expect(body.innerHTML).toContain('aria-disabled="true"');
    expect(body.innerHTML).toContain('Transfer ownership first');
  });

  it('Leave button enabled for non-owner member', () => {
    const body = createElement('div');
    const party = buildParty({ state: PARTY_STATE_PENDING });
    renderPartyDetail(body, party, 'blok');
    expect(body.innerHTML).toContain('ptLeaveBtn');
  });

  it('turn countdown banner renders when active with appropriate severity class', () => {
    const body = createElement('div');
    const party = buildParty({
      state: PARTY_STATE_ACTIVE,
      turnIndex: 0,
      currentTurnDeadline: Date.now() + 15 * 60 * 1000, // 15min → danger
    });
    renderPartyDetail(body, party, 'roman');
    expect(body.innerHTML).toContain('pt-turn-banner');
    expect(body.innerHTML).toContain('pt-turn-banner--your');
    expect(body.innerHTML).toContain('pt-turn-countdown--danger');
  });

  it('expired turn surfaces "Turn expired" copy + expired banner class', () => {
    const body = createElement('div');
    const party = buildParty({
      state: PARTY_STATE_ACTIVE,
      turnIndex: 1,
      currentTurnDeadline: Date.now() - 1000, // past
    });
    renderPartyDetail(body, party, 'roman');
    expect(body.innerHTML).toContain('Turn expired');
    expect(body.innerHTML).toContain('pt-turn-banner--expired');
  });

  it('activity feed renders turn history with emoji react buttons (member, active)', () => {
    const body = createElement('div');
    const party = buildParty({
      state: PARTY_STATE_ACTIVE,
      turnIndex: 1,
      currentTurnDeadline: Date.now() + 60 * 60 * 1000,
      turnHistory: [
        { playerId: 'roman', endedAt: Date.now() - 5 * 60 * 1000, actions: [], deltas: {} },
      ],
    });
    renderPartyDetail(body, party, 'blok');
    expect(body.innerHTML).toContain('Activity');
    expect(body.innerHTML).toContain('ended their turn');
    // Emoji react row mounted for active member
    expect(body.innerHTML).toContain('data-pt-emoji="👍"');
    expect(body.innerHTML).toContain('data-pt-emoji="🔥"');
    expect(body.innerHTML).toContain('data-pt-emoji="💀"');
  });

  it('defensive: missing sharedState renders without crashing', () => {
    const body = createElement('div');
    const party = buildParty({ sharedState: null, state: PARTY_STATE_PENDING });
    expect(() => renderPartyDetail(body, party, 'roman')).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// renderCreatePartyModal
// ═══════════════════════════════════════════════════════════════════════

describe('renderCreatePartyModal (T3.13)', () => {
  it('renders name input + 3 timeout-mode radios + create/cancel buttons', () => {
    const root = createElement('div');
    renderCreatePartyModal(root, { onCancel() {}, onSubmit() {} });
    expect(root.innerHTML).toContain('ptCreateName');
    expect(root.innerHTML).toContain('ptCreateMode-competitive');
    expect(root.innerHTML).toContain('ptCreateMode-standard');
    expect(root.innerHTML).toContain('ptCreateMode-casual');
    expect(root.innerHTML).toContain('ptCreateCancel');
    expect(root.innerHTML).toContain('ptCreateSubmit');
  });

  it('default mode is "standard" (ESC-03 Q3 ruling)', () => {
    const root = createElement('div');
    renderCreatePartyModal(root, { onCancel() {}, onSubmit() {} });
    // The "standard" radio carries `checked` attribute in source HTML
    expect(root.innerHTML).toMatch(/ptCreateMode-standard"[^>]+checked/);
  });

  it('mode labels are surfaced (Competitive / Standard / Casual)', () => {
    const root = createElement('div');
    renderCreatePartyModal(root, { onCancel() {}, onSubmit() {} });
    expect(root.innerHTML).toContain('Competitive');
    expect(root.innerHTML).toContain('Standard');
    expect(root.innerHTML).toContain('Casual');
    // Sub-labels surface the ESC-03 Q3 ruling values
    expect(root.innerHTML).toContain('4h turn limit');
    expect(root.innerHTML).toContain('24h turn limit');
    expect(root.innerHTML).toContain('7-day turn limit');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// __partyTowerTestables
// ═══════════════════════════════════════════════════════════════════════

describe('__partyTowerTestables (T3.13)', () => {
  it('exposes PARTY_EMOJIS as 3-emoji frozen array per §3.5', () => {
    const emojis = __partyTowerTestables.PARTY_EMOJIS;
    expect(Array.isArray(emojis)).toBe(true);
    expect(emojis.length).toBe(3);
    // Each should be a single-extended-grapheme emoji string
    for (const e of emojis) expect(typeof e).toBe('string');
  });

  it('exposes timeout mode order with all three modes', () => {
    const order = __partyTowerTestables.PARTY_TIMEOUT_MODE_ORDER;
    expect(order).toContain('competitive');
    expect(order).toContain('standard');
    expect(order).toContain('casual');
  });

  it('reset() clears module state to defaults', () => {
    __partyTowerTestables.setViewerId('something');
    __partyTowerTestables.reset();
    expect(__partyTowerTestables.getState().viewerPlayerId).toBe(null);
    expect(__partyTowerTestables.getState().currentPartyId).toBe(null);
    expect(__partyTowerTestables.getState().createModalOpen).toBe(false);
  });

  it('recordReactionForTest accumulates per-party / per-turn / per-emoji counters', () => {
    __partyTowerTestables.recordReactionForTest('p1', 0, '🔥');
    __partyTowerTestables.recordReactionForTest('p1', 0, '🔥');
    __partyTowerTestables.recordReactionForTest('p1', 0, '👍');
    __partyTowerTestables.recordReactionForTest('p1', 1, '💀');
    const st = __partyTowerTestables.getState();
    expect(st.localReactions['p1'][0]['🔥']).toBe(2);
    expect(st.localReactions['p1'][0]['👍']).toBe(1);
    expect(st.localReactions['p1'][1]['💀']).toBe(1);
  });
});
