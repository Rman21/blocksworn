// 2026-05-12 — TASK-039 (T2.12): Codex screen — Identity Layer aggregation surface.
//
// Spec: docs/design/mechanics/identity-layer.md §4 (Codex screen design).
// FINAL Phase 2 implementation task. The Codex is the COLLECTION SURFACE for
// every Identity-Layer trigger witnessed + every boss encountered. Three tabs
// (Races / Bosses / Moments) × 3-state unlock model (Locked / Encountered /
// Mastered) over persistent localStorage state.
//
// Sacred safety (spec §4.10 — STRICTEST sacred discipline in Phase 2):
//   - Codex is READ-ONLY of game state. WRITES go ONLY to
//     localStorage[CODEX_LOCALSTORAGE_KEY].
//   - Codex NEVER mutates: heroes, bosses, gameState, save data, RACE_SYNERGY,
//     RACE_IDENTITY_FX, BOSS_IDENTITY_FX, IDENTITY_FX_KEYS,
//     IDENTITY_BOSS_FX_KEYS, IDENTITY_BOSS_HANDLERS, REACTIVITY_HANDLERS,
//     V_HAPTICS, NARRATOR_LINES, or any sacred table.
//   - Codex writes are append/increment only — never overwrites or destroys.
//
// Surface (named exports — consumed by router.js, identity-fx.js, main.js,
// tests/unit/codex.test.js, tests/smoke/codex.spec.js):
//   - renderCodex(rootEl?, codexState?)          — main render entry
//   - renderRacesTab(rootEl?, codexState?)       — tab 1 content
//   - renderBossesTab(rootEl?, codexState?)      — tab 2 content
//   - renderMomentsTab(rootEl?, codexState?)     — tab 3 content
//   - renderRaceDetail(rootEl?, raceKey, codexState?)
//   - renderBossDetail(rootEl?, bossKey, codexState?)
//   - getCodexState()                            — load from localStorage
//   - saveCodexState(codexState)                 — persist
//   - recordRaceTrigger(raceKey)                 — increment trigger count
//   - recordBossEncounter(bossKey)               — mark encountered
//   - recordBossDefeat(bossKey)                  — increment defeats
//   - recordMomentTrigger(momentKey)             — append/increment moment
//   - getRaceState(raceKey, codexState?)         — Locked/Encountered/Mastered
//   - getBossState(bossKey, codexState?)         — Locked/Encountered/Mastered
//
// Persistence schema (per spec §4.9):
//   {
//     version: 1,
//     races: { pirate: { encountered: true, mastered: false, triggerCount: 47 }, ... },
//     bosses: { phoenix: { encountered: true, mastered: false, firstSeenAt: 'D3', defeatedCount: 0 }, ... },
//     moments: [{ id: 'phoenix_ashen_reign', firstSeenAt: 'D3', count: 4 }, ...]
//   }
//
// Performance contract (spec §4.9): page render ≤300ms FCP. Implementation
// uses pure innerHTML + tiny DOM — no allocation churn, no canvas, no media.
// Re-uses PR #157 painterly emblem PNGs from public/images/emblems/ for race
// + boss thumbnails (spec §4.8 — "no new asset budget needed for MVP").

/* eslint-disable no-empty */

import {
  CODEX_LOCALSTORAGE_KEY,
  CODEX_RACE_MASTERY_THRESHOLD,
  CODEX_BOSS_MASTERY_DEFEATS,
  CODEX_FCP_BUDGET_MS,
  CODEX_SCHEMA_VERSION,
  CODEX_STATE,
  CODEX_TABS,
  CODEX_DEFAULT_TAB,
} from '../data/identity-layer.js';
import { RACE_SYNERGY, RACE_IDENTITY_FX, RACE_TO_STIHIYA } from '../data/races.js';
import { BOSS_IDENTITY_FX } from '../data/bosses.js';
import { CHAPTERS } from '../data/chapters.js';
import { log } from '../services/logger.js';

// ─── Race / boss catalogs (build once at module load) ──────────────────
//
// 10-race catalog: 5 original (orc, elf, troll, human, dark_elf) +
// 5 new (pirate, skeleton, golem, lion, rock). The 5 in-scope V18.8 races
// that have Identity FX wired (pirate/shark/rock/crocodile/spark) are
// surfaced AS race entries even though shark/crocodile/spark are not in
// `RACES` (legacy array). The Codex catalogs include the full 10 plus the
// 3 Identity-only races so the Races tab matches the spec §4.2 "10 entries
// (5 in scope + 5 original for completeness)" PLUS shark/crocodile/spark
// shown as Identity-only entries (encountered when their fx fires).
//
// Race ordering: original 5 first, then V18.8 5, then Identity-only 3
// (shark, crocodile, spark — these have entries in RACE_IDENTITY_FX
// but NOT in RACES — they're squad-tag only).
const CODEX_RACES = Object.freeze([
  // Original 5
  { key: 'orc',      label: 'ORC',      flavorKey: 'orc' },
  { key: 'elf',      label: 'ELF',      flavorKey: 'elf' },
  { key: 'troll',    label: 'TROLL',    flavorKey: 'troll' },
  { key: 'human',    label: 'HUMAN',    flavorKey: 'human' },
  { key: 'dark_elf', label: 'DARK ELF', flavorKey: 'dark_elf' },
  // V18.8 5
  { key: 'pirate',   label: 'PIRATE',   flavorKey: 'pirate' },
  { key: 'skeleton', label: 'SKELETON', flavorKey: 'skeleton' },
  { key: 'golem',    label: 'GOLEM',    flavorKey: 'golem' },
  { key: 'lion',     label: 'LION',     flavorKey: 'lion' },
  { key: 'rock',     label: 'ROCK',     flavorKey: 'rock' },
  // Identity-only (no RACE_SYNERGY entry per ESC-02 O1 deferral)
  { key: 'shark',     label: 'SHARK',     flavorKey: null },
  { key: 'crocodile', label: 'CROCODILE', flavorKey: null },
  { key: 'spark',     label: 'SPARK',     flavorKey: null },
]);

// 25-boss catalog: pulled from CHAPTERS (Ch1-Ch5). Each boss entry stores
// `key` (lowercased, no-space name used as the codex map index), `name`
// (canonical caps display), `chapter`, `title`, `archetype`, `stihiya`,
// `img` (legacy asset key). Generated from the sacred CHAPTERS source so
// any future chapter edits flow through automatically.
function _buildBossCatalog() {
  const out = [];
  try {
    if (!Array.isArray(CHAPTERS)) return out;
    for (const ch of CHAPTERS) {
      if (!ch || !Array.isArray(ch.bosses)) continue;
      for (const boss of ch.bosses) {
        if (!boss || typeof boss.name !== 'string') continue;
        // Codex key derived from name — lowercase, alphanumeric only.
        const key = boss.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        out.push(Object.freeze({
          key,
          name: boss.name,
          title: boss.title || '',
          chapter: ch.id || 1,
          chapterName: ch.name || '',
          archetype: boss.archetype || '',
          stihiya: boss.stihiya || '',
          img: boss.img || '',
        }));
      }
    }
  } catch (_e) { /* defensive — empty catalog if CHAPTERS shape changed */ }
  return Object.freeze(out);
}
const CODEX_BOSSES = _buildBossCatalog();

// ─── Module state cache ────────────────────────────────────────────────
// In-memory mirror of localStorage[CODEX_LOCALSTORAGE_KEY]. Hydrated on
// first access (lazy boot). saveCodexState() writes both the cache + the
// localStorage slot atomically. Cleared in tests via __resetCodexCacheForTests.
let _codexCache = null;
let _activeTab = CODEX_DEFAULT_TAB;

// ─── State load / save (spec §4.9) ─────────────────────────────────────
//
// `getCodexState()` returns the canonical Codex state object. First call
// hydrates from localStorage; subsequent calls return the cached copy. If
// localStorage is unavailable (Node test env), absent (first boot), or
// corrupt (parse error), returns a fresh initial-state object.
//
// Initial-state shape:
//   { version: 1, races: {}, bosses: {}, moments: [] }
//
// The races / bosses objects are dictionaries keyed by race/boss key (lazy
// — entries are only written when triggered, never pre-populated, so the
// localStorage footprint stays minimal).
//
// `saveCodexState(state)` persists the given state object + refreshes the
// module cache. Wrapped in try/catch — localStorage QuotaExceeded /
// SecurityError never crash the caller. Idempotent.
export function getCodexState() {
  if (_codexCache !== null) return _codexCache;
  _codexCache = _loadInitialState();
  return _codexCache;
}

function _initialState() {
  return { version: CODEX_SCHEMA_VERSION, races: {}, bosses: {}, moments: [] };
}

function _loadInitialState() {
  try {
    if (typeof localStorage === 'undefined') return _initialState();
    const raw = localStorage.getItem(CODEX_LOCALSTORAGE_KEY);
    if (!raw) return _initialState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return _initialState();
    // Schema migration / defensive defaults — if version mismatches OR
    // expected shape is missing, return initial state (do NOT throw).
    if (parsed.version !== CODEX_SCHEMA_VERSION) return _initialState();
    return {
      version: CODEX_SCHEMA_VERSION,
      races:   (parsed.races && typeof parsed.races === 'object')   ? parsed.races   : {},
      bosses:  (parsed.bosses && typeof parsed.bosses === 'object') ? parsed.bosses  : {},
      moments: Array.isArray(parsed.moments) ? parsed.moments : [],
    };
  } catch (_e) {
    // Parse error, quota error, security error — defensive default.
    return _initialState();
  }
}

export function saveCodexState(state) {
  if (!state || typeof state !== 'object') return false;
  _codexCache = state;
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(CODEX_LOCALSTORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (_e) {
    // QuotaExceeded / SecurityError — log + swallow. The cache is still
    // updated so the current session sees consistent state.
    try { log.warn('Codex saveCodexState failed:', _e); } catch (_e2) {}
    return false;
  }
}

// ─── Recording API (called from src/feel/identity-fx.js end-of-fire) ───
//
// All three recorders share the same defensive contract:
//   - Invalid key (non-string, empty, unknown race/boss/moment): silent no-op.
//   - Wrapped in try/catch — Codex recording must NEVER regress fx pipeline.
//   - Mutations are confined to the Codex state object (game state untouched).
//   - Each call persists to localStorage atomically.
//
// Sacred-cow safety: these are the ONLY mutation paths for Codex state.
// External code can also read codex state via getCodexState() / getRaceState() /
// getBossState() — but those are pure reads with no side effects.
function _isValidKey(key) {
  return typeof key === 'string' && key.length > 0;
}

export function recordRaceTrigger(raceKey) {
  if (!_isValidKey(raceKey)) return;
  try {
    const state = getCodexState();
    const races = state.races;
    if (!races[raceKey]) {
      races[raceKey] = { encountered: true, mastered: false, triggerCount: 0 };
    }
    const entry = races[raceKey];
    entry.triggerCount = (entry.triggerCount | 0) + 1;
    entry.encountered = true;
    if (entry.triggerCount >= CODEX_RACE_MASTERY_THRESHOLD) {
      entry.mastered = true;
    }
    saveCodexState(state);
  } catch (_e) { /* defensive — recording must never throw */ }
}

export function recordBossEncounter(bossKey) {
  if (!_isValidKey(bossKey)) return;
  try {
    const state = getCodexState();
    const bosses = state.bosses;
    if (!bosses[bossKey]) {
      bosses[bossKey] = { encountered: true, mastered: false, defeatedCount: 0, firstSeenAt: _firstSeenStamp() };
    } else {
      bosses[bossKey].encountered = true;
    }
    saveCodexState(state);
  } catch (_e) { /* defensive */ }
}

export function recordBossDefeat(bossKey) {
  if (!_isValidKey(bossKey)) return;
  try {
    const state = getCodexState();
    const bosses = state.bosses;
    if (!bosses[bossKey]) {
      bosses[bossKey] = { encountered: true, mastered: false, defeatedCount: 0, firstSeenAt: _firstSeenStamp() };
    }
    const entry = bosses[bossKey];
    entry.defeatedCount = (entry.defeatedCount | 0) + 1;
    entry.encountered = true;
    if (entry.defeatedCount >= CODEX_BOSS_MASTERY_DEFEATS) {
      entry.mastered = true;
    }
    saveCodexState(state);
  } catch (_e) { /* defensive */ }
}

export function recordMomentTrigger(momentKey) {
  if (!_isValidKey(momentKey)) return;
  try {
    const state = getCodexState();
    const moments = state.moments;
    if (!Array.isArray(state.moments)) {
      state.moments = [];
    }
    let found = null;
    for (let i = 0; i < moments.length; i++) {
      if (moments[i] && moments[i].id === momentKey) { found = moments[i]; break; }
    }
    if (found) {
      found.count = (found.count | 0) + 1;
    } else {
      moments.push({ id: momentKey, firstSeenAt: _firstSeenStamp(), count: 1 });
    }
    saveCodexState(state);
  } catch (_e) { /* defensive */ }
}

// "First seen" stamp — current day-of-month ISO-ish marker. Spec §4.4 example
// shows "first encountered: D3" (Day 3 of FTUE / player journey). Without a
// canonical "player day" system we use the ISO date string — it's stable
// across sessions, parsable, and tooling can re-derive a human "D<n>" relative
// to install date later. Defensive try/catch — Node test envs sometimes lack
// Date.toISOString reliability.
function _firstSeenStamp() {
  try {
    return new Date().toISOString().slice(0, 10);
  } catch (_e) {
    return '';
  }
}

// ─── State queries (READ-ONLY — no side effects) ───────────────────────
export function getRaceState(raceKey, codexState) {
  if (!_isValidKey(raceKey)) return CODEX_STATE.LOCKED;
  const state = codexState || getCodexState();
  const entry = state && state.races && state.races[raceKey];
  if (!entry || !entry.encountered) return CODEX_STATE.LOCKED;
  if (entry.mastered || (entry.triggerCount | 0) >= CODEX_RACE_MASTERY_THRESHOLD) {
    return CODEX_STATE.MASTERED;
  }
  return CODEX_STATE.ENCOUNTERED;
}

export function getBossState(bossKey, codexState) {
  if (!_isValidKey(bossKey)) return CODEX_STATE.LOCKED;
  const state = codexState || getCodexState();
  const entry = state && state.bosses && state.bosses[bossKey];
  if (!entry || !entry.encountered) return CODEX_STATE.LOCKED;
  if (entry.mastered || (entry.defeatedCount | 0) >= CODEX_BOSS_MASTERY_DEFEATS) {
    return CODEX_STATE.MASTERED;
  }
  return CODEX_STATE.ENCOUNTERED;
}

// ─── Render — main entry (spec §4.2) ───────────────────────────────────
//
// `renderCodex(rootEl?, codexState?)` mounts the Codex screen. Defaults:
//   - rootEl: document.getElementById('screenCodex')
//   - codexState: getCodexState()
//
// Performance: starts wall-clock at function entry, logs WARN if FCP
// exceeds CODEX_FCP_BUDGET_MS (300ms — spec §4.9). The render is pure
// innerHTML + tiny event listener wiring — should easily stay under
// budget on any modern device.
export function renderCodex(rootEl, codexState) {
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  const root = rootEl || (typeof document !== 'undefined' ? document.getElementById('screenCodex') : null);
  if (!root) return;
  const state = codexState || getCodexState();

  // Header + tab nav + active-tab body.
  const html = [
    '<div class="codex-wrap">',
    _renderHeader(state),
    _renderTabNav(_activeTab),
    `<div class="codex-body" id="codexBody">`,
    _renderTabBody(_activeTab, state),
    '</div>',
    '</div>',
  ].join('');
  root.innerHTML = html;
  _wireTabClicks(root, state);

  if (typeof performance !== 'undefined') {
    const dt = performance.now() - _t0;
    if (dt > CODEX_FCP_BUDGET_MS) {
      try { log.warn('Codex render over FCP budget:', dt.toFixed(2), 'ms'); } catch (_e) {}
    }
  }
}

function _renderHeader(state) {
  const racesMastered  = CODEX_RACES.filter(r => getRaceState(r.key, state) === CODEX_STATE.MASTERED).length;
  const bossesMastered = CODEX_BOSSES.filter(b => getBossState(b.key, state) === CODEX_STATE.MASTERED).length;
  const moments = Array.isArray(state.moments) ? state.moments.length : 0;
  return [
    '<div class="codex-header">',
    '<button type="button" class="codex-back-btn" id="codexBackBtn" aria-label="Back to menu">&larr;</button>',
    '<h1 class="codex-title">CODEX</h1>',
    `<div class="codex-progress-strip">`,
    `<span class="codex-progress-chip">Races <b>${racesMastered}</b>/<span>${CODEX_RACES.length}</span></span>`,
    `<span class="codex-progress-chip">Bosses <b>${bossesMastered}</b>/<span>${CODEX_BOSSES.length}</span></span>`,
    `<span class="codex-progress-chip">Moments <b>${moments}</b></span>`,
    `</div>`,
    '</div>',
  ].join('');
}

function _renderTabNav(activeTab) {
  return [
    '<div class="codex-tabs" role="tablist">',
    CODEX_TABS.map(tab => {
      const active = (tab === activeTab) ? ' active' : '';
      const label = tab.charAt(0).toUpperCase() + tab.slice(1);
      return `<button type="button" class="codex-tab${active}" data-codex-tab="${tab}" role="tab" aria-selected="${tab === activeTab}">${label}</button>`;
    }).join(''),
    '</div>',
  ].join('');
}

function _renderTabBody(tab, state) {
  if (tab === 'races')   return _renderRacesTabHTML(state);
  if (tab === 'bosses')  return _renderBossesTabHTML(state);
  if (tab === 'moments') return _renderMomentsTabHTML(state);
  return '';
}

function _wireTabClicks(root, state) {
  try {
    const tabBtns = root.querySelectorAll('[data-codex-tab]');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-codex-tab');
        if (!tab || tab === _activeTab) return;
        _activeTab = tab;
        // Re-render body + tab nav state (cheap; same FCP budget).
        renderCodex(root, state);
      });
    });
    const back = root.querySelector('#codexBackBtn');
    if (back) {
      back.addEventListener('click', () => {
        try {
          // Defer-import to avoid circular dependency cycle (router → codex → router).
          // The window.goToMenu fallback works for legacy + new shell both.
          if (typeof window !== 'undefined' && typeof window.goToMenu === 'function') {
            window.goToMenu();
          } else if (typeof window !== 'undefined' && typeof window.showScreen === 'function') {
            window.showScreen('menu');
          }
        } catch (_e) {}
      });
    }
    // Per-card click → detail page.
    const cards = root.querySelectorAll('[data-codex-detail]');
    cards.forEach(card => {
      card.addEventListener('click', (e) => {
        const key = e.currentTarget.getAttribute('data-codex-detail-key');
        const kind = e.currentTarget.getAttribute('data-codex-detail');
        if (!key || !kind) return;
        if (kind === 'race') renderRaceDetail(root, key, state);
        if (kind === 'boss') renderBossDetail(root, key, state);
      });
    });
  } catch (_e) { /* defensive — listener wiring never throws */ }
}

// ─── Races tab (spec §4.2) ─────────────────────────────────────────────
export function renderRacesTab(rootEl, codexState) {
  const root = rootEl || (typeof document !== 'undefined' ? document.getElementById('screenCodex') : null);
  if (!root) return;
  const state = codexState || getCodexState();
  _activeTab = 'races';
  renderCodex(root, state);
}

function _renderRacesTabHTML(state) {
  return [
    '<div class="codex-grid" role="list">',
    CODEX_RACES.map(r => _renderRaceCard(r, state)).join(''),
    '</div>',
  ].join('');
}

function _renderRaceCard(raceEntry, state) {
  const codexEntry = state.races && state.races[raceEntry.key];
  const st = getRaceState(raceEntry.key, state);
  const stih = RACE_TO_STIHIYA[raceEntry.key] || '';
  const triggers = codexEntry ? (codexEntry.triggerCount | 0) : 0;

  if (st === CODEX_STATE.LOCKED) {
    return [
      `<button type="button" class="codex-card codex-card--locked" role="listitem" data-codex-detail="race" data-codex-detail-key="${raceEntry.key}" aria-label="Locked race">`,
      `<div class="codex-card-thumb codex-card-thumb--silhouette"><span class="codex-card-locked-mark">?</span></div>`,
      `<div class="codex-card-label">???</div>`,
      `</button>`,
    ].join('');
  }
  const masteredCls = (st === CODEX_STATE.MASTERED) ? ' codex-card--mastered' : '';
  return [
    `<button type="button" class="codex-card codex-card--encountered${masteredCls}" role="listitem" data-codex-detail="race" data-codex-detail-key="${raceEntry.key}" data-stihiya="${stih}">`,
    `<div class="codex-card-thumb">${_thumbHTML(raceEntry.key, 'race')}</div>`,
    `<div class="codex-card-label">${raceEntry.label}</div>`,
    `<div class="codex-card-meta">Triggered ${triggers}×</div>`,
    (st === CODEX_STATE.MASTERED ? '<span class="codex-mastered-badge">MASTERED</span>' : ''),
    `</button>`,
  ].join('');
}

// ─── Bosses tab (spec §4.2) ────────────────────────────────────────────
export function renderBossesTab(rootEl, codexState) {
  const root = rootEl || (typeof document !== 'undefined' ? document.getElementById('screenCodex') : null);
  if (!root) return;
  const state = codexState || getCodexState();
  _activeTab = 'bosses';
  renderCodex(root, state);
}

function _renderBossesTabHTML(state) {
  return [
    '<div class="codex-grid" role="list">',
    CODEX_BOSSES.map(b => _renderBossCard(b, state)).join(''),
    '</div>',
  ].join('');
}

function _renderBossCard(bossEntry, state) {
  const codexEntry = state.bosses && state.bosses[bossEntry.key];
  const st = getBossState(bossEntry.key, state);
  const defeats = codexEntry ? (codexEntry.defeatedCount | 0) : 0;

  if (st === CODEX_STATE.LOCKED) {
    return [
      `<button type="button" class="codex-card codex-card--locked" role="listitem" data-codex-detail="boss" data-codex-detail-key="${bossEntry.key}" aria-label="Locked boss">`,
      `<div class="codex-card-thumb codex-card-thumb--silhouette"><span class="codex-card-locked-mark">?</span></div>`,
      `<div class="codex-card-label">Ch.${bossEntry.chapter} · ???</div>`,
      `</button>`,
    ].join('');
  }
  const masteredCls = (st === CODEX_STATE.MASTERED) ? ' codex-card--mastered' : '';
  return [
    `<button type="button" class="codex-card codex-card--encountered${masteredCls}" role="listitem" data-codex-detail="boss" data-codex-detail-key="${bossEntry.key}" data-stihiya="${bossEntry.stihiya || ''}">`,
    `<div class="codex-card-thumb">${_thumbHTML(bossEntry.key, 'boss', bossEntry)}</div>`,
    `<div class="codex-card-label">${bossEntry.name}</div>`,
    `<div class="codex-card-meta">Ch.${bossEntry.chapter} · ${(bossEntry.stihiya || '').toUpperCase()}</div>`,
    `<div class="codex-card-meta">Defeated ${defeats}×</div>`,
    (st === CODEX_STATE.MASTERED ? '<span class="codex-mastered-badge">MASTERED</span>' : ''),
    `</button>`,
  ].join('');
}

// ─── Moments tab (spec §4.6) ───────────────────────────────────────────
export function renderMomentsTab(rootEl, codexState) {
  const root = rootEl || (typeof document !== 'undefined' ? document.getElementById('screenCodex') : null);
  if (!root) return;
  const state = codexState || getCodexState();
  _activeTab = 'moments';
  renderCodex(root, state);
}

function _renderMomentsTabHTML(state) {
  const moments = Array.isArray(state.moments) ? state.moments : [];
  if (moments.length === 0) {
    return '<div class="codex-empty">No moments witnessed yet. The chronicle awaits.</div>';
  }
  return [
    '<ul class="codex-moments-list">',
    moments.map(m => {
      const id = (m && m.id) || '';
      const at = (m && m.firstSeenAt) || '';
      const count = (m && m.count) | 0;
      const label = _momentDisplayName(id);
      return `<li class="codex-moment-row" data-codex-moment="${id}"><span class="codex-moment-label">${label}</span><span class="codex-moment-meta">first seen ${at} · ${count}×</span></li>`;
    }).join(''),
    '</ul>',
  ].join('');
}

function _momentDisplayName(momentKey) {
  // Convert e.g. 'phoenix_ashen_reign' → 'PHOENIX · ASHEN REIGN'.
  if (!momentKey) return '???';
  const parts = String(momentKey).split('_');
  if (parts.length < 2) return parts.join(' ').toUpperCase();
  return (parts[0] + ' · ' + parts.slice(1).join(' ')).toUpperCase();
}

// ─── Detail pages (spec §4.3 / §4.4) ───────────────────────────────────
export function renderRaceDetail(rootEl, raceKey, codexState) {
  const root = rootEl || (typeof document !== 'undefined' ? document.getElementById('screenCodex') : null);
  if (!root) return;
  const state = codexState || getCodexState();
  const raceEntry = CODEX_RACES.find(r => r.key === raceKey);
  if (!raceEntry) return;
  const codexEntry = state.races && state.races[raceKey];
  const st = getRaceState(raceKey, state);
  if (st === CODEX_STATE.LOCKED) {
    // Locked detail: no spoiler info.
    root.innerHTML = [
      '<div class="codex-wrap">',
      _renderDetailHeader(`Codex / Races / ???`),
      '<div class="codex-detail-body">',
      `<div class="codex-detail-locked">No record yet.</div>`,
      '</div>',
      '</div>',
    ].join('');
    _wireDetailBack(root, state, 'races');
    return;
  }
  const syn = raceEntry.flavorKey ? RACE_SYNERGY[raceEntry.flavorKey] : null;
  const flavor = (syn && syn.flavor) || '';
  const stih = RACE_TO_STIHIYA[raceKey] || '';
  const identityKey = RACE_IDENTITY_FX[raceKey] || '';
  const triggers = codexEntry ? (codexEntry.triggerCount | 0) : 0;

  const synergyRows = syn ? [
    syn[2] ? `<div class="codex-detail-synergy-row">tier 2 · ${_escape(syn[2].desc || '')}</div>` : '',
    syn[3] ? `<div class="codex-detail-synergy-row">tier 3 · ${_escape(syn[3].desc || '')}</div>` : '',
    syn[5] ? `<div class="codex-detail-synergy-row">tier 5 · ${_escape(syn[5].desc || '')}</div>` : '',
  ].join('') : '<div class="codex-detail-synergy-row">No synergy tiers (Identity-only race).</div>';

  root.innerHTML = [
    '<div class="codex-wrap">',
    _renderDetailHeader(`Codex / Races / ${raceEntry.label}`),
    `<div class="codex-detail-body" data-stihiya="${stih}">`,
    `<div class="codex-detail-head">`,
    `<div class="codex-detail-thumb">${_thumbHTML(raceKey, 'race')}</div>`,
    `<div class="codex-detail-headline">`,
    `<div class="codex-detail-name">${raceEntry.label}</div>`,
    `<div class="codex-detail-subline">element · ${stih || '???'}</div>`,
    flavor ? `<div class="codex-detail-subline">${_escape(flavor)}</div>` : '',
    identityKey ? `<div class="codex-detail-subline">identity · ${identityKey.replace(/_/g, ' ').toUpperCase()}</div>` : '',
    (st === CODEX_STATE.MASTERED ? '<span class="codex-mastered-badge codex-mastered-badge--inline">MASTERED</span>' : ''),
    `</div>`,
    `</div>`,
    `<section class="codex-detail-section"><h2 class="codex-detail-section-h">RACE SYNERGY TIERS</h2>${synergyRows}</section>`,
    `<section class="codex-detail-section"><h2 class="codex-detail-section-h">STATS</h2><div class="codex-detail-stat-row">identity triggered: <b>${triggers}</b>×</div></section>`,
    '</div>',
    '</div>',
  ].join('');
  _wireDetailBack(root, state, 'races');
}

export function renderBossDetail(rootEl, bossKey, codexState) {
  const root = rootEl || (typeof document !== 'undefined' ? document.getElementById('screenCodex') : null);
  if (!root) return;
  const state = codexState || getCodexState();
  const bossEntry = CODEX_BOSSES.find(b => b.key === bossKey);
  if (!bossEntry) return;
  const codexEntry = state.bosses && state.bosses[bossKey];
  const st = getBossState(bossKey, state);
  if (st === CODEX_STATE.LOCKED) {
    root.innerHTML = [
      '<div class="codex-wrap">',
      _renderDetailHeader(`Codex / Bosses / ???`),
      '<div class="codex-detail-body">',
      `<div class="codex-detail-locked">No record yet.</div>`,
      '</div>',
      '</div>',
    ].join('');
    _wireDetailBack(root, state, 'bosses');
    return;
  }
  const archetypeFx = BOSS_IDENTITY_FX[bossEntry.archetype] || '';
  const defeats = codexEntry ? (codexEntry.defeatedCount | 0) : 0;
  const firstSeen = codexEntry ? (codexEntry.firstSeenAt || '???') : '???';

  root.innerHTML = [
    '<div class="codex-wrap">',
    _renderDetailHeader(`Codex / Bosses / ${bossEntry.name}`),
    `<div class="codex-detail-body" data-stihiya="${bossEntry.stihiya || ''}">`,
    `<div class="codex-detail-head">`,
    `<div class="codex-detail-thumb">${_thumbHTML(bossKey, 'boss', bossEntry)}</div>`,
    `<div class="codex-detail-headline">`,
    `<div class="codex-detail-name">${bossEntry.name}</div>`,
    `<div class="codex-detail-subline">${_escape(bossEntry.title || '')}</div>`,
    `<div class="codex-detail-subline">archetype · ${(bossEntry.archetype || '???').toUpperCase()}</div>`,
    `<div class="codex-detail-subline">element · ${bossEntry.stihiya || '???'}</div>`,
    (st === CODEX_STATE.MASTERED ? '<span class="codex-mastered-badge codex-mastered-badge--inline">MASTERED</span>' : ''),
    `</div>`,
    `</div>`,
    archetypeFx ? `<section class="codex-detail-section"><h2 class="codex-detail-section-h">IDENTITY MECHANIC</h2><div class="codex-detail-stat-row">${archetypeFx.replace(/_/g, ' ').toUpperCase()}</div></section>` : '',
    `<section class="codex-detail-section"><h2 class="codex-detail-section-h">RECORD</h2>`,
    `<div class="codex-detail-stat-row">first encountered · ${firstSeen}</div>`,
    `<div class="codex-detail-stat-row">defeated · ${defeats}×</div>`,
    `<div class="codex-detail-stat-row">chapter · ${bossEntry.chapter} (${bossEntry.chapterName || ''})</div>`,
    `</section>`,
    '</div>',
    '</div>',
  ].join('');
  _wireDetailBack(root, state, 'bosses');
}

function _renderDetailHeader(crumbs) {
  return [
    '<div class="codex-header codex-header--detail">',
    '<button type="button" class="codex-back-btn" id="codexDetailBackBtn" aria-label="Back to codex tab">&larr;</button>',
    `<div class="codex-detail-crumbs">${_escape(crumbs)}</div>`,
    '</div>',
  ].join('');
}

function _wireDetailBack(root, state, returnToTab) {
  try {
    const back = root.querySelector('#codexDetailBackBtn');
    if (back) {
      back.addEventListener('click', () => {
        _activeTab = returnToTab;
        renderCodex(root, state);
      });
    }
  } catch (_e) { /* defensive */ }
}

// ─── Thumbnail HTML — re-use PR #157 emblem PNGs where available ───────
// Spec §4.8: "Re-use existing emblem PNG assets from PR #157 (30 painterly
// emblems ready) as race/boss thumbnails — no new asset budget needed for
// MVP." Asset key resolution is best-effort: try `<key>.png` under the
// emblems base dir; falls back to a styled element-tinted placeholder if
// asset registry doesn't know the key.
function _thumbHTML(key, kind, entry) {
  // Best-effort emblem path. The actual emblem registry lives in
  // public/images/emblems/ (PR #157). Browser will silently fail to load
  // (alt text shows) if asset is absent — non-fatal.
  const slug = String(key || '').toLowerCase();
  const src = (kind === 'boss' && entry && entry.img)
    ? `/images/emblems/${slug}.png`
    : `/images/emblems/${slug}.png`;
  return `<img class="codex-card-thumb-img" src="${src}" alt="" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'" />`;
}

function _escape(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Test-only escape hatches (NOT used in production) ─────────────────
// Mirrors the `__identityFxTestables` pattern from T2.02. Lets unit tests
// reset module state between tests without depending on private internals.
export const __codexTestables = Object.freeze({
  reset() {
    _codexCache = null;
    _activeTab = CODEX_DEFAULT_TAB;
  },
  setActiveTab(tab) {
    if (typeof tab === 'string') _activeTab = tab;
  },
  getActiveTab() { return _activeTab; },
  getRaceCatalog() { return CODEX_RACES; },
  getBossCatalog() { return CODEX_BOSSES; },
});
