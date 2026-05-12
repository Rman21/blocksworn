// 2026-05-11 — TASK-009 (T1.08): analytics event wrapper.
// 2026-05-12 — TASK-027 (T1.20): Player Segments — getPlayerSegment(state) +
//              logEvent auto-enrichment with the current segment + boot/IAP
//              hooks that refresh the cached state.
//
// Consolidates the legacy `logEvent(name, props)` function (legacy lines
// 18878-18912) — which forwards events to:
//   1. console (in dev — when hostname is localhost/127/0.0.0.0)
//   2. Firebase Analytics (modular SDK via window.fbAnalyticsModular.logEvent,
//      with legacy compat-SDK probe as fallback)
//   3. Sentry breadcrumbs (window.Sentry.addBreadcrumb) for crash-context
//
// EVT taxonomy is preserved byte-perfect from legacy lines 18809-18873. T1.10
// will rewire callers; T1.08 just exposes the helpers.
//
// Public API:
//   - logEvent(name, properties)        — fires the event across all sinks.
//                                         Auto-enriches `properties.segment`
//                                         with the current player segment
//                                         (caller-set via setSegmentState).
//   - setUserProperty(key, value)       — wraps Firebase Analytics user props.
//   - setUserId(uid)                    — wraps Firebase Analytics user-id.
//   - EVT                               — frozen event-name registry.
//   - getPlayerSegment(state)           — pure thresholding per CLAUDE.md §9
//                                         + v2.1 P7 §2. SACRED thresholds.
//   - setSegmentState(state)            — caches state so logEvent can compute
//                                         segment without a state import. Call
//                                         on boot + after every successful IAP.
//   - SEGMENT_F2P / SEGMENT_MINNOW /
//     SEGMENT_DOLPHIN / SEGMENT_WHALE   — segment-name constants.

import { addBreadcrumb } from './sentry.js';

// Mirror of legacy EVT (lines 18809-18873). Adding a key here is the
// authoritative way to register a new event name — callers must reference
// `EVT.foo` rather than string-literals.
export const EVT = Object.freeze({
  // Lifecycle / install
  install: 'install',
  session_start: 'session_start',
  session_end: 'session_end',
  returned_d1: 'returned_d1',
  returned_d7: 'returned_d7',
  returned_d30: 'returned_d30',
  // FTUE / onboarding
  ftue_step: 'ftue_step',
  ftue_complete: 'ftue_complete',
  // Combat
  fight_started: 'fight_started',
  fight_won: 'fight_won',
  fight_lost: 'fight_lost',
  ult_fired: 'ult_fired',
  combo_landed: 'combo_landed',
  // Progression
  hero_unlocked: 'hero_unlocked',
  hero_leveled: 'hero_leveled',
  hero_ascended: 'hero_ascended',
  // Tower
  tower_run_started: 'tower_run_started',
  tower_floor_cleared: 'tower_floor_cleared',
  tower_run_ended: 'tower_run_ended',
  tower_chest_claimed: 'tower_chest_claimed',
  // Shop / monetization
  shop_opened: 'shop_opened',
  shop_section_viewed: 'shop_section_viewed',
  purchase_started: 'purchase_started',
  purchase_completed: 'purchase_completed',
  purchase_cancelled: 'purchase_cancelled',
  purchase_failed: 'purchase_failed',
  purchases_restored: 'purchases_restored',
  purchases_restore_failed: 'purchases_restore_failed',
  account_deleted: 'account_deleted',
  // Chapter-4 + endgame-kit
  chapter_4_unlocked: 'chapter_4_unlocked',
  chapter_4_completed: 'chapter_4_completed',
  chapter_4_boss_defeated: 'chapter_4_boss_defeated',
  chapter_4_migration_unlock: 'chapter_4_migration_unlock',
  throne_breaker_earned: 'throne_breaker_earned',
  archival_aftermath_shown: 'archival_aftermath_shown',
  archival_aftermath_dismissed: 'archival_aftermath_dismissed',
  endgame_kit_eligibility_unlocked: 'endgame_kit_eligibility_unlocked',
  // Soft pinch
  pinch_shown: 'pinch_shown',
  pinch_path_chosen: 'pinch_path_chosen',
  pinch_dismissed: 'pinch_dismissed',
  // Streak / retention
  streak_extended: 'streak_extended',
  streak_broken: 'streak_broken',
  streak_freeze_used: 'streak_freeze_used',
  // Ads
  ad_offered: 'ad_offered',
  ad_completed: 'ad_completed',
  ad_failed: 'ad_failed',
  // Content drops
  content_unlocked: 'content_unlocked',
  // Errors
  error_caught: 'error_caught',
});

// ──────────────────────────────────────────────────────────────────────────
// T1.20 — Player Segments (v2.1 P7 §2 + CLAUDE.md §9).
// Sacred thresholds: DO NOT change without an ESC to Roman.
//   F2P     — totalSpentUSD === 0
//   Minnow  — $1 .. $24.99
//   Dolphin — $25 .. $99.99
//   Whale   — $100+
// ──────────────────────────────────────────────────────────────────────────
export const SEGMENT_F2P = 'F2P';
export const SEGMENT_MINNOW = 'Minnow';
export const SEGMENT_DOLPHIN = 'Dolphin';
export const SEGMENT_WHALE = 'Whale';

/**
 * Compute the current player segment from the canonical state shape
 * `{ iap: { totalSpentUSD: number } }`. Pure function — safe to call with
 * any input shape (undefined, {}, partial state). Defensive defaults to
 * SEGMENT_F2P when totalSpentUSD is missing or non-numeric.
 *
 * Thresholds are sacred per CLAUDE.md §9 (Glossary) and Execution Plan
 * §13 T1.20. Do not edit without architect approval.
 *
 * @param {object} state - canonical game state object (or partial)
 * @returns {'F2P'|'Minnow'|'Dolphin'|'Whale'} segment name
 */
export function getPlayerSegment(state) {
  const raw = state && state.iap && state.iap.totalSpentUSD;
  const totalSpentUSD = (typeof raw === 'number' && isFinite(raw) && raw > 0) ? raw : 0;
  if (totalSpentUSD === 0) return SEGMENT_F2P;
  if (totalSpentUSD < 25) return SEGMENT_MINNOW;
  if (totalSpentUSD < 100) return SEGMENT_DOLPHIN;
  return SEGMENT_WHALE;
}

// Module-scoped cache for the most-recent state snapshot. Callers (boot,
// post-IAP completion handler) set this so `logEvent` can auto-enrich
// each event with the current segment without importing state directly.
let _segmentState = null;

/**
 * Caller-side state binder. The boot path and every successful IAP
 * completion handler should call this so subsequent logEvent() calls
 * carry the up-to-date segment. Safe to call with any shape.
 *
 * @param {object} state - canonical game state with iap.totalSpentUSD
 */
export function setSegmentState(state) {
  _segmentState = (state && typeof state === 'object') ? state : null;
}

const _IS_DEV_HOSTNAME = (typeof window !== 'undefined' && window.location &&
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(window.location.hostname || ''));

function _fbAnalyticsModular() {
  return (typeof window !== 'undefined') ? window.fbAnalyticsModular : null;
}

function _legacyFirebase() {
  return (typeof window !== 'undefined' && window.firebase &&
          typeof window.firebase.analytics === 'function') ? window.firebase : null;
}

export function logEvent(name, properties = {}) {
  if (!name) return;
  const incoming = (properties && typeof properties === 'object') ? properties : {};

  // T1.20 — enrich every event with the current player segment so the
  // downstream analytics dashboards (Firebase + Sentry) can slice by
  // F2P / Minnow / Dolphin / Whale without per-call site plumbing.
  // Caller-supplied `segment` wins (avoids stomping rare deliberate overrides).
  let payload = incoming;
  if (!('segment' in incoming)) {
    try {
      const seg = getPlayerSegment(_segmentState || {});
      payload = Object.assign({}, incoming, { segment: seg });
    } catch (_e) { /* enrichment must never break gameplay */ }
  }

  if (_IS_DEV_HOSTNAME) {
    try { console.log('[analytics]', name, payload); } catch (_e) { /* swallow */ }
  }

  // Firebase Analytics — prefer modular SDK; fall back to legacy compat shim.
  try {
    const fbModular = _fbAnalyticsModular();
    if (fbModular && typeof fbModular.logEvent === 'function') {
      fbModular.logEvent(name, payload);
    } else {
      const fbLegacy = _legacyFirebase();
      if (fbLegacy) {
        fbLegacy.analytics().logEvent(name, payload);
      }
    }
  } catch (_e) { /* analytics must never break gameplay */ }

  // Sentry breadcrumb forward — gives crash reports recent-event context.
  try { addBreadcrumb({ category: 'analytics', message: name, level: 'info', data: payload }); }
  catch (_e) { /* swallow */ }
}

export function setUserProperty(key, value) {
  if (!key) return;
  try {
    const fbModular = _fbAnalyticsModular();
    if (fbModular && typeof fbModular.setUserProperties === 'function') {
      const obj = {}; obj[key] = String(value);
      fbModular.setUserProperties(obj);
      return;
    }
    const fbLegacy = _legacyFirebase();
    if (fbLegacy) {
      const a = fbLegacy.analytics();
      if (a && typeof a.setUserProperty === 'function') {
        a.setUserProperty(key, String(value));
      } else if (a && typeof a.setUserProperties === 'function') {
        const obj = {}; obj[key] = String(value);
        a.setUserProperties(obj);
      }
    }
  } catch (_e) { /* swallow */ }
}

export function setUserId(uid) {
  if (!uid) return;
  try {
    const fbModular = _fbAnalyticsModular();
    if (fbModular && typeof fbModular.setUserId === 'function') {
      fbModular.setUserId(uid);
    }
  } catch (_e) { /* swallow */ }
}
