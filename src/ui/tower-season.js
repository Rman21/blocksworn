// 2026-05-13 — TASK-059 (T3.15): Tower seasonal screen — surfaces T3.14
//   seasonal infrastructure (Uroboros variant rotation + 13-week season
//   countdown + active seasonal pacts list + Battle Pass tier progress).
//
// Spec: docs/design/endgame-social.md §6 (Tower seasonal)
//       + §6.1 (seasonal Uroboros banner — variant rotation, sacred boss
//         spec untouched; auraColor + displayName + narratorVariant are a
//         metadata layer)
//       + §6.2 (seasonal pacts — additive registry; sacred 30 base + 15
//         mythic untouched)
//       + §6.3 (PURE PATH F2P-only leaderboard hint — separate column /
//         reset cadence preserved)
//       + §6.4 (Battle Pass tier widget — sacred §2.4 formula READ-only:
//         xp_for_tier(N) = 500 + (N-1) × 150)
//       + ESC-03 Q4 ruling — 13-week Tower + Battle Pass cadence.
//       + ADR-003 — strict no-P2W: tier rewards cosmetic-only, no
//         paid-tier shortcuts surfaced in UI.
//
// FIFTH Phase 3 UI screen (Wave-6 closer; follows Codex T2.12, Replay
// viewer T3.08, Adventures T3.03, Party Tower T3.13). Mirrors the
// established UI precedent:
//   - direct-import from tower-season-backend.js (zero new window-bridges)
//   - parchment aesthetic matching Codex + Adventures + Party Tower
//   - module-private state singleton, reset hook for tests
//   - defensive try/catch on every async op
//   - prefers-reduced-motion compatible (CSS handles animation suppression)
//
// What this module ships:
//   1. Hero block — Season N + Week X banner + countdown to next season +
//      Uroboros variant card (auraColor accent, displayName, narrator hint).
//   2. Seasonal pacts panel — reads `getActiveSeasonalPacts(seasonId)`,
//      displays name + rarity pill + description from SEASONAL_PACTS.
//   3. Battle Pass tier widget — sacred formula READ-only: derives current
//      tier from cumulative xpEarned, XP-progress bar, next-tier cosmetic
//      reward preview. ADR-003: tier number only (no paid/whale distinction).
//   4. PURE PATH leaderboard hint — separate column rendered as a
//      sub-block; honors F2P-only invariant (informational copy).
//
// Performance contract (CTO brief):
//   - Screen FCP ≤300ms (initial shell + Loading … placeholder).
//   - Tier progress render ≤50ms (pure compute path).
//   - Countdown ticker = 1Hz setInterval (mirrors T3.13 pattern); no rAF.
//
// Sacred-cow safety (CLAUDE.md §2):
//   - READ-ONLY consumer of tower-season-backend.js.
//   - Battle Pass formula `500 + (N-1) × 150` SACRED §2.4 — read via
//     computeBattlePassTierXp() helper; NEVER recomputed here.
//   - TOWER_PACTS_BASE (30) + TOWER_PACTS_MYTHIC (15) sacred §2.5 —
//     UI displays only the active seasonal pact list (additive surface).
//   - Uroboros boss spec sacred §2.5 — variant rotation is metadata only;
//     auraColor / displayName / narratorVariant are cosmetic flairs.
//   - PURE PATH F2P-only sacred §2.5 — hint shows separate column /
//     reset cadence; never mixes ranks.
//   - ADR-003 no-P2W: tier rewards described as cosmetic-only; tiers
//     identified by number only (no paid-tier exclusive cosmetics).
//   - No new V_HAPTICS keys / NARRATOR_LINES entries / window-bridges.
//
// Public API:
//   - renderTowerSeason(rootEl?, ctx?)             — main render entry
//   - renderHeroBlock(rootEl, viewState)           — sub-renderer (testable)
//   - renderSeasonalPactsPanel(rootEl, pactDefs)   — sub-renderer (testable)
//   - renderBattlePassWidget(rootEl, opts)         — sub-renderer (testable)
//   - renderLeaderboardHint(rootEl, viewState)     — sub-renderer (testable)
//   - computeBattlePassDisplayState(xpEarned)      — pure helper (testable)
//   - formatSeasonCountdown(deadlineMs, now?)      — pure helper (testable)
//   - resolveBattlePassXpEarned()                  — read of save state
//   - __towerSeasonTestables                       — test-only escape hatches

/* eslint-disable no-empty */

import {
  // Async backend ops
  fetchSeasonState,
  // Pure helpers
  computeBattlePassTierXp,
  computeBattlePassTotalXpForTier,
  getActiveUroborosVariant,
  getActiveSeasonalPacts,
  getMergedPactRegistry,
  // Constants
  TOWER_SEASON_WEEKS,
  TOWER_SEASON_DURATION_MS,
  BATTLE_PASS_BASE_XP,
  BATTLE_PASS_PER_TIER_XP,
  BATTLE_PASS_MAX_TIER,
  UROBOROS_VARIANTS,
  SEASONAL_PACTS,
  SEASON_INITIAL_ID,
  SEASON_PRE_LAUNCH,
} from '../services/tower-season-backend.js';
import { log } from '../services/logger.js';

// ─── Performance budgets ────────────────────────────────────────────────
const TS_FCP_BUDGET_MS = 300;
const TS_TIER_BUDGET_MS = 50;

// ─── Countdown thresholds (display only — sacred 13-week cadence intact) ─
const COUNTDOWN_DANGER_MS = 24 * 60 * 60 * 1000;   // <1d → pulse red
const COUNTDOWN_WARN_MS   =  3 * 24 * 60 * 60 * 1000; // <3d → amber
const COUNTDOWN_TICK_MS = 1000;

// ─── Per-tier cosmetic reward preview (ADR-003 — cosmetic-only) ─────────
// Honors spec §6.4 cosmetic-schedule (clan emblem T5, replay frame T10,
// friend lb color T20, season Tower emblem T35, exclusive avatar T50).
// Display labels only — NO paid-tier shortcuts, NO whale-exclusive items
// (CLAUDE.md §2.4 / ADR-003).
const BATTLE_PASS_TIER_REWARDS = Object.freeze({
  5:  { label: 'Seasonal clan emblem',           cosmetic: true },
  10: { label: 'Seasonal replay frame border',   cosmetic: true },
  20: { label: 'Friend-leaderboard name color',  cosmetic: true },
  35: { label: 'Season Tower emblem',            cosmetic: true },
  50: { label: 'Exclusive avatar frame',         cosmetic: true },
});

// Cosmetic preview ladder — used for "next tier reward" hint.
const BATTLE_PASS_REWARD_TIERS = Object.freeze([5, 10, 20, 35, 50]);

// ─── localStorage keys ──────────────────────────────────────────────────
// Battle Pass XP is stored by legacy season-pass system; T3.15 reads it
// READ-only via blocksworn_bp_xp_earned (additive — falls back to 0
// when absent). Sacred §2.4 formula never modifies stored XP — UI shows
// the derived tier deterministically.
const LS_BP_XP_KEY = 'blocksworn_bp_xp_earned';

// ─── Module state singleton (only one viewer mounted at a time) ────────
let _rootEl = null;
let _countdownTimer = null;
let _activeViewState = null;  // last successful fetchSeasonState result

// ─── Player-state resolution ───────────────────────────────────────────

/**
 * Read the viewer's cumulative Battle Pass XP for the current season from
 * localStorage. Defaults to 0 when absent / invalid. Read-only — UI never
 * writes the canonical XP store (that's a legacy season-pass concern).
 */
export function resolveBattlePassXpEarned() {
  try {
    if (typeof localStorage === 'undefined') return 0;
    const raw = localStorage.getItem(LS_BP_XP_KEY);
    if (raw == null) return 0;
    const n = parseInt(raw, 10);
    if (!isFinite(n) || n < 0) return 0;
    return n;
  } catch (_e) {
    return 0;
  }
}

// ─── Pure helpers (testable in isolation) ──────────────────────────────

/**
 * HTML escape for safe innerHTML interpolation.
 */
function _escape(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Format a season-end countdown into a human-readable "Xd Yh" or
 * "Xh Ym" string + severity band. Pure.
 *
 * @param {number} deadlineMs - absolute timestamp (ms since epoch)
 * @param {number} [now] - injected clock (defaults to Date.now())
 * @returns {{text: string, remainingMs: number, severity: 'safe'|'warn'|'danger'|'expired'}}
 */
export function formatSeasonCountdown(deadlineMs, now) {
  if (typeof deadlineMs !== 'number' || !isFinite(deadlineMs) || deadlineMs <= 0) {
    return { text: '—', remainingMs: 0, severity: 'safe' };
  }
  const t = (typeof now === 'number' && isFinite(now)) ? now : Date.now();
  const remainingMs = deadlineMs - t;
  if (remainingMs <= 0) {
    return { text: 'Season ended', remainingMs: 0, severity: 'expired' };
  }
  const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  let text;
  if (days > 0) {
    text = `${days}d ${hours}h`;
  } else if (hours > 0) {
    text = `${hours}h ${minutes}m`;
  } else {
    const seconds = Math.floor((remainingMs % (60 * 1000)) / 1000);
    text = `${minutes}m ${seconds}s`;
  }
  let severity = 'safe';
  if (remainingMs < COUNTDOWN_DANGER_MS) severity = 'danger';
  else if (remainingMs < COUNTDOWN_WARN_MS) severity = 'warn';
  return { text, remainingMs, severity };
}

/**
 * Derive Battle Pass display state from cumulative XP earned. Pure.
 * Honors sacred §2.4 formula READ-only via computeBattlePassTotalXpForTier
 * + computeBattlePassTierXp (NEVER recomputes the formula here).
 *
 * Returned shape:
 *   - currentTier:        1..BATTLE_PASS_MAX_TIER (1 when xp < tier1 needed)
 *   - isMaxed:            currentTier === BATTLE_PASS_MAX_TIER
 *   - xpIntoCurrent:      XP earned within the current tier band
 *   - xpForNextTier:      XP delta needed from current → next (sacred formula)
 *   - progressPct:        0..100 — fill % for the tier-progress bar
 *   - xpToNext:           remaining XP to next tier
 *   - nextRewardTier:     next tier index that grants a cosmetic reward, or null
 *   - nextRewardLabel:    label for next cosmetic reward, or null
 *
 * @param {number} xpEarned - cumulative XP this season (>= 0)
 */
export function computeBattlePassDisplayState(xpEarned) {
  const xp = (typeof xpEarned === 'number' && isFinite(xpEarned) && xpEarned >= 0)
    ? Math.floor(xpEarned) : 0;

  // Walk tiers 1..MAX_TIER; find the highest tier N such that
  // cumulative(N-1) ≤ xp < cumulative(N) (== still earning tier N).
  // ESCALATION-PROOF: cumulative(N) === computeBattlePassTotalXpForTier(N).
  let currentTier = 1;
  for (let n = 1; n <= BATTLE_PASS_MAX_TIER; n++) {
    const cum = computeBattlePassTotalXpForTier(n);
    if (xp < cum) {
      currentTier = n;
      break;
    }
    if (n === BATTLE_PASS_MAX_TIER) {
      // Fully maxed — viewer has earned all XP needed for tier 50.
      currentTier = BATTLE_PASS_MAX_TIER;
    }
  }
  const isMaxed = currentTier === BATTLE_PASS_MAX_TIER
    && xp >= computeBattlePassTotalXpForTier(BATTLE_PASS_MAX_TIER);

  // XP relative to current tier band.
  const xpAtTierStart = (currentTier > 1) ? computeBattlePassTotalXpForTier(currentTier - 1) : 0;
  const xpForNextTier = computeBattlePassTierXp(currentTier);
  const xpIntoCurrent = Math.max(0, Math.min(xpForNextTier, xp - xpAtTierStart));
  const xpToNext = Math.max(0, xpForNextTier - xpIntoCurrent);
  let progressPct = (xpForNextTier > 0)
    ? Math.max(0, Math.min(100, Math.round((xpIntoCurrent / xpForNextTier) * 100)))
    : 0;
  if (isMaxed) progressPct = 100;

  // Next cosmetic reward tier (strictly above currentTier).
  let nextRewardTier = null;
  let nextRewardLabel = null;
  for (const t of BATTLE_PASS_REWARD_TIERS) {
    if (t > currentTier) { nextRewardTier = t; break; }
  }
  if (nextRewardTier != null) {
    const reward = BATTLE_PASS_TIER_REWARDS[nextRewardTier];
    nextRewardLabel = reward ? reward.label : null;
  }

  return {
    currentTier,
    isMaxed,
    xpIntoCurrent,
    xpForNextTier,
    xpToNext,
    progressPct,
    nextRewardTier,
    nextRewardLabel,
  };
}

/**
 * Compute the season-end deadline (absolute timestamp ms) from a season
 * fetch result. Returns 0 when state is pre-launch / invalid.
 */
function _computeSeasonEndDeadline(state) {
  if (!state || typeof state.seasonStartMs !== 'number' || state.seasonStartMs <= 0) return 0;
  return state.seasonStartMs + TOWER_SEASON_DURATION_MS;
}

// ─── Main render entry ─────────────────────────────────────────────────

/**
 * Mount the Tower seasonal screen into `rootEl`. Default mount:
 * #screenTowerSeason.
 *
 * `ctx` is an optional context bag with shape:
 *   { nowOverride?: number, xpEarnedOverride?: number }
 *
 * Performance: starts wall-clock at entry; logs WARN if FCP exceeds budget.
 */
export function renderTowerSeason(rootEl, ctx) {
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  const root = rootEl || (typeof document !== 'undefined'
    ? document.getElementById('screenTowerSeason')
    : null);
  if (!root) return;
  _rootEl = root;

  // Stop any existing countdown (re-mount safety).
  _stopCountdownTicker();

  // Initial shell with loading state (FCP).
  root.innerHTML = [
    '<div class="ts-wrap">',
    _renderHeader(),
    '<div class="ts-body" id="tsBody">',
    '<div class="ts-loading">Loading season…</div>',
    '</div>',
    '</div>',
  ].join('');
  _wireHeaderBackButton(root);

  try {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      if (dt > TS_FCP_BUDGET_MS) {
        try { log.warn('TowerSeason render over FCP budget:', dt.toFixed(2), 'ms'); } catch (_e) {}
      }
    }
  } catch (_e) {}

  // Async hydrate.
  _hydrateAsync(root, ctx);
}

function _renderHeader() {
  return [
    '<div class="ts-header">',
    '<button type="button" class="ts-back-btn" id="tsBackBtn" aria-label="Back">&larr;</button>',
    '<h1 class="ts-title">SEASON</h1>',
    '<p class="ts-subtitle">Tower seasonal rotation</p>',
    '</div>',
  ].join('');
}

function _wireHeaderBackButton(root) {
  try {
    const back = root.querySelector('#tsBackBtn');
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

async function _hydrateAsync(root, ctx) {
  let state = null;
  let backendOk = true;
  try {
    const nowOverride = (ctx && typeof ctx.nowOverride === 'number') ? ctx.nowOverride : undefined;
    state = await fetchSeasonState(nowOverride);
    if (!state || !state.ok) backendOk = false;
  } catch (e) {
    try { log.warn('TowerSeason fetchSeasonState failed:', e); } catch (_e) {}
    backendOk = false;
  }
  if (root !== _rootEl) return;
  const body = root.querySelector('#tsBody');
  if (!body) return;

  if (!backendOk || !state) {
    body.innerHTML = [
      '<div class="ts-empty">',
      '<p class="ts-empty-title">Season data unavailable</p>',
      '<p class="ts-empty-sub">Tower seasonal rotation syncs over the network. Check your connection and try again.</p>',
      '</div>',
    ].join('');
    return;
  }

  _activeViewState = state;

  const xpEarned = (ctx && typeof ctx.xpEarnedOverride === 'number')
    ? ctx.xpEarnedOverride
    : resolveBattlePassXpEarned();
  const nowForCountdown = (ctx && typeof ctx.nowOverride === 'number') ? ctx.nowOverride : Date.now();
  const deadlineMs = _computeSeasonEndDeadline(state);

  const viewState = {
    seasonId: state.seasonId,
    weekIndex: state.weekIndex,
    uroborosVariant: state.uroborosVariant,
    seasonalPactIds: state.seasonalPactIds,
    seasonStartMs: state.seasonStartMs,
    deadlineMs,
    nowForCountdown,
  };

  // Compose hero + pacts + battle pass + leaderboard hint as one body innerHTML
  // so the screen renders atomically (no flicker between sub-blocks).
  body.innerHTML = [
    '<div id="tsHero"></div>',
    '<div id="tsPacts"></div>',
    '<div id="tsBP"></div>',
    '<div id="tsLBHint"></div>',
  ].join('');

  const heroMount = body.querySelector('#tsHero');
  const pactsMount = body.querySelector('#tsPacts');
  const bpMount = body.querySelector('#tsBP');
  const lbMount = body.querySelector('#tsLBHint');

  if (heroMount) renderHeroBlock(heroMount, viewState);
  if (pactsMount) {
    const pactDefs = (viewState.seasonalPactIds || [])
      .map(id => ({ id, def: SEASONAL_PACTS[id] || null }))
      .filter(x => x.def);
    renderSeasonalPactsPanel(pactsMount, pactDefs);
  }
  if (bpMount) {
    renderBattlePassWidget(bpMount, { xpEarned });
  }
  if (lbMount) renderLeaderboardHint(lbMount, viewState);

  // Pre-launch sentinel → don't tick the countdown (no valid deadline).
  if (state.seasonId !== SEASON_PRE_LAUNCH && deadlineMs > 0) {
    _startCountdownTicker(deadlineMs, root);
  }
}

// ─── Hero block (season banner + Uroboros variant card) ────────────────

/**
 * Render the hero block: season banner + Uroboros variant card.
 * Exported for unit tests.
 *
 * @param {HTMLElement} rootEl
 * @param {object} viewState - { seasonId, weekIndex, uroborosVariant, deadlineMs, nowForCountdown }
 */
export function renderHeroBlock(rootEl, viewState) {
  if (!rootEl) return;
  const vs = viewState || {};
  const seasonId = (typeof vs.seasonId === 'number') ? vs.seasonId : SEASON_INITIAL_ID;
  const weekIndex = (typeof vs.weekIndex === 'number' && vs.weekIndex > 0)
    ? Math.min(TOWER_SEASON_WEEKS, vs.weekIndex) : 1;
  const variant = (vs.uroborosVariant && typeof vs.uroborosVariant === 'object')
    ? vs.uroborosVariant : UROBOROS_VARIANTS[0];

  const cd = (vs.deadlineMs && vs.deadlineMs > 0)
    ? formatSeasonCountdown(vs.deadlineMs, vs.nowForCountdown)
    : { text: '—', severity: 'safe' };

  const auraColor = (variant && typeof variant.auraColor === 'string') ? variant.auraColor : '#A88033';
  const displayName = (variant && typeof variant.displayName === 'string') ? variant.displayName : 'Uroboros';
  const narratorVariant = (variant && typeof variant.narratorVariant === 'string') ? variant.narratorVariant : '';

  const html = [
    '<div class="ts-hero">',
    '<div class="ts-banner">',
    '<p class="ts-banner-label">Current season</p>',
    `<p class="ts-banner-season">Season ${seasonId}</p>`,
    `<p class="ts-banner-week">Week ${weekIndex} of ${TOWER_SEASON_WEEKS}</p>`,
    '<div class="ts-banner-countdown">',
    '<span class="ts-banner-countdown-label">Resets in</span>',
    `<span class="ts-banner-countdown-value ts-banner-countdown-value--${_escape(cd.severity)}" id="tsCountdown" data-ts-deadline="${vs.deadlineMs | 0}">${_escape(cd.text)}</span>`,
    '</div>',
    '</div>',
    `<div class="ts-uroboros" style="--ts-aura-color: ${_cssEscapeColor(auraColor)};">`,
    '<p class="ts-uroboros-label">Mythic boss</p>',
    `<p class="ts-uroboros-name">${_escape(displayName)}</p>`,
    `<p class="ts-uroboros-variant">Variant of Uroboros · rotates every ${TOWER_SEASON_WEEKS}-week season</p>`,
    narratorVariant ? `<p class="ts-uroboros-narrator">Voice: ${_escape(narratorVariant)}</p>` : '',
    '</div>',
    '</div>',
  ].join('');
  rootEl.innerHTML = html;
}

/**
 * Strict CSS color value sanitizer — accepts only hex `#RRGGBB` /
 * `#RGB` patterns. Falls back to the muted-gold default when invalid.
 * Defensive: prevents injection through `style=` interpolation.
 */
function _cssEscapeColor(v) {
  if (typeof v !== 'string') return '#A88033';
  if (/^#[0-9A-Fa-f]{3}$/.test(v) || /^#[0-9A-Fa-f]{6}$/.test(v)) return v;
  return '#A88033';
}

// ─── Seasonal pacts panel ──────────────────────────────────────────────

/**
 * Render the seasonal pacts panel. Exported for unit tests.
 *
 * @param {HTMLElement} rootEl
 * @param {Array<{id: string, def: object}>} pactDefs - active seasonal pacts
 */
export function renderSeasonalPactsPanel(rootEl, pactDefs) {
  if (!rootEl) return;
  const list = Array.isArray(pactDefs) ? pactDefs.filter(x => x && x.def) : [];
  const inner = list.length === 0
    ? '<p class="ts-pact-empty">No seasonal pacts active this season.</p>'
    : [
        '<ul class="ts-pact-list" role="list">',
        list.map(({ id, def }) => {
          const rarity = (def.rarity && typeof def.rarity === 'string') ? def.rarity : 'rare';
          const rarityClass = (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary') ? rarity : 'rare';
          return [
            `<li class="ts-pact-row ts-pact-row--${_escape(rarityClass)}" data-ts-pact-id="${_escape(id)}">`,
            '<p class="ts-pact-name">',
            `<span>${_escape(def.name || id)}</span>`,
            `<span class="ts-pact-rarity ts-pact-rarity--${_escape(rarityClass)}">${_escape(rarityClass)}</span>`,
            '</p>',
            `<p class="ts-pact-desc">${_escape(def.description || '')}</p>`,
            '</li>',
          ].join('');
        }).join(''),
        '</ul>',
      ].join('');
  rootEl.innerHTML = [
    '<div class="ts-section">',
    '<h3 class="ts-section-h">Seasonal Pacts</h3>',
    inner,
    '</div>',
  ].join('');
}

// ─── Battle Pass tier widget ───────────────────────────────────────────

/**
 * Render the Battle Pass tier-progress widget. Exported for unit tests.
 * Sacred §2.4 formula READ-only via computeBattlePassDisplayState.
 *
 * @param {HTMLElement} rootEl
 * @param {{ xpEarned: number }} opts
 */
export function renderBattlePassWidget(rootEl, opts) {
  if (!rootEl) return;
  const _t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  const xpEarned = (opts && typeof opts.xpEarned === 'number') ? opts.xpEarned : 0;
  const state = computeBattlePassDisplayState(xpEarned);

  const tierLine = state.isMaxed
    ? `${state.currentTier} <span class="ts-bp-tier-max">/ ${BATTLE_PASS_MAX_TIER} (max)</span>`
    : `${state.currentTier} <span class="ts-bp-tier-max">/ ${BATTLE_PASS_MAX_TIER}</span>`;

  const xpRow = state.isMaxed
    ? `<span>All tiers earned</span>`
    : `<span>${state.xpIntoCurrent} / ${state.xpForNextTier} XP</span><span>${state.xpToNext} XP to tier ${state.currentTier + 1}</span>`;

  const nextRewardLine = state.isMaxed
    ? 'All seasonal cosmetic rewards earned.'
    : (state.nextRewardTier != null && state.nextRewardLabel)
        ? `Next cosmetic reward at <span class="ts-bp-next-tier-num">Tier ${state.nextRewardTier}</span>: ${_escape(state.nextRewardLabel)}.`
        : 'Cosmetic rewards every 5–15 tiers.';

  const barFillClass = state.isMaxed ? 'ts-bp-bar-fill ts-bp-bar-fill--max' : 'ts-bp-bar-fill';

  rootEl.innerHTML = [
    '<div class="ts-section ts-bp">',
    '<h3 class="ts-section-h">Battle Pass</h3>',
    '<div class="ts-bp-head">',
    '<p class="ts-bp-tier-label">Current tier</p>',
    `<p class="ts-bp-tier-value">${tierLine}</p>`,
    '</div>',
    `<div class="ts-bp-bar-track"><div class="${barFillClass}" style="width: ${state.progressPct}%;" id="tsBpFill"></div></div>`,
    `<div class="ts-bp-xp-row">${xpRow}</div>`,
    `<p class="ts-bp-next">${nextRewardLine}</p>`,
    '</div>',
  ].join('');

  try {
    if (typeof performance !== 'undefined') {
      const dt = performance.now() - _t0;
      if (dt > TS_TIER_BUDGET_MS) {
        try { log.warn('TowerSeason BP widget over budget:', dt.toFixed(2), 'ms'); } catch (_e) {}
      }
    }
  } catch (_e) {}
}

// ─── PURE PATH leaderboard hint ────────────────────────────────────────

/**
 * Render the seasonal leaderboard hint — informational copy noting that
 * the weekly_seasonal leaderboard resets at season end (existing sacred
 * cadence) and that PURE PATH F2P-only leaderboard remains a separate
 * column. Exported for unit tests.
 *
 * @param {HTMLElement} rootEl
 * @param {object} viewState - { seasonId, deadlineMs, nowForCountdown }
 */
export function renderLeaderboardHint(rootEl, viewState) {
  if (!rootEl) return;
  const vs = viewState || {};
  const seasonId = (typeof vs.seasonId === 'number') ? vs.seasonId : SEASON_INITIAL_ID;
  const cd = (vs.deadlineMs && vs.deadlineMs > 0)
    ? formatSeasonCountdown(vs.deadlineMs, vs.nowForCountdown)
    : null;
  const resetCopy = cd
    ? `Weekly seasonal ranks reset when Season ${seasonId} ends (in ${cd.text}).`
    : `Weekly seasonal ranks reset when Season ${seasonId} ends.`;
  rootEl.innerHTML = [
    '<div class="ts-lb-hint">',
    '<p class="ts-lb-hint-title">Leaderboards</p>',
    `<p class="ts-lb-hint-body">${_escape(resetCopy)}</p>`,
    '<p class="ts-lb-hint-purepath">PURE PATH (F2P-only lifetime) remains a separate column — never wiped.</p>',
    '</div>',
  ].join('');
}

// ─── Countdown ticker (setInterval — drift-tolerant for 1Hz) ──────────

function _startCountdownTicker(deadlineMs, root) {
  _stopCountdownTicker();
  if (typeof deadlineMs !== 'number' || !isFinite(deadlineMs) || deadlineMs <= 0) return;
  if (typeof window === 'undefined' || typeof window.setInterval !== 'function') return;
  _countdownTimer = window.setInterval(() => {
    try {
      const el = root && root.querySelector ? root.querySelector('#tsCountdown') : null;
      if (!el) {
        _stopCountdownTicker();
        return;
      }
      const cd = formatSeasonCountdown(deadlineMs);
      el.textContent = cd.text;
      el.className = `ts-banner-countdown-value ts-banner-countdown-value--${cd.severity}`;
      if (cd.severity === 'expired') {
        // Season ended — refresh the whole screen so a rotation can be
        // surfaced via fetchSeasonState on next render.
        _stopCountdownTicker();
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

// ─── Testables ────────────────────────────────────────────────────────

export const __towerSeasonTestables = Object.freeze({
  reset() {
    _rootEl = null;
    _activeViewState = null;
    _stopCountdownTicker();
  },
  getState() {
    return {
      hasRoot: !!_rootEl,
      activeViewState: _activeViewState ? { ...(_activeViewState) } : null,
      countdownActive: _countdownTimer != null,
    };
  },
  setRoot(el) { _rootEl = el; },
  BATTLE_PASS_TIER_REWARDS,
  BATTLE_PASS_REWARD_TIERS,
  LS_BP_XP_KEY,
  cssEscapeColor: _cssEscapeColor,
  computeSeasonEndDeadline: _computeSeasonEndDeadline,
});

// Re-export deps for convenience to UI test fixtures.
export {
  fetchSeasonState,
  computeBattlePassTierXp,
  computeBattlePassTotalXpForTier,
  getActiveUroborosVariant,
  getActiveSeasonalPacts,
  getMergedPactRegistry,
  TOWER_SEASON_WEEKS,
  BATTLE_PASS_BASE_XP,
  BATTLE_PASS_PER_TIER_XP,
  BATTLE_PASS_MAX_TIER,
  UROBOROS_VARIANTS,
  SEASONAL_PACTS,
  SEASON_INITIAL_ID,
  SEASON_PRE_LAUNCH,
};
