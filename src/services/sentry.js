// 2026-05-11 — TASK-009 (T1.08): Sentry error-tracking abstraction.
//
// Wraps the legacy Sentry init block (docs/_legacy/_archive_v1/blocksworn_index_fixed.html
// lines 18421-18470). The legacy script tag loads the Sentry CDN bundle async
// (window.Sentry), then calls Sentry.init({ dsn, integrations, tracesSampleRate,
// environment, defaultIntegrations }). DSN is a PLACEHOLDER string; init
// early-returns when the placeholder is detected so dev environments never
// actually phone home.
//
// Public API:
//   - initSentry(dsn?)        — wraps window.Sentry.init; safe no-op if SDK
//                               not loaded or DSN still contains 'PLACEHOLDER'.
//   - captureException(err)   — wraps window.Sentry.captureException;
//                               swallows when SDK unavailable so callers
//                               (notably logger.error) never throw on cold
//                               start.
//   - captureMessage(msg)     — same shape, for non-Error reports.
//
// IMPORTANT: DSN value kept byte-identical to legacy placeholder. Production
// DSN provisioning is a T1.18+ secrets-hygiene concern, not T1.08 scope.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html lines 18421-18470.

// Legacy placeholder DSN — see legacy line 18442. NEVER replace with a real DSN
// in this module; production DSN flows through env at a later phase.
export const SENTRY_DSN_PLACEHOLDER = 'https://PLACEHOLDER@o0.ingest.sentry.io/PLACEHOLDER';

let _initialized = false;

function _sentry() {
  return (typeof window !== 'undefined' && window.Sentry) ? window.Sentry : null;
}

export function initSentry(dsn = SENTRY_DSN_PLACEHOLDER) {
  const Sentry = _sentry();
  if (!Sentry) return false;
  if (typeof dsn !== 'string' || dsn.indexOf('PLACEHOLDER') !== -1) {
    // Legacy parity: console.warn happens via callers; init returns without
    // touching window.Sentry. Keeps dev / test environments quiet.
    return false;
  }
  try {
    Sentry.init({
      dsn,
      integrations: Sentry.BrowserTracing ? [new Sentry.BrowserTracing()] : [],
      tracesSampleRate: 0.1,
      environment: (typeof window !== 'undefined' && window.location &&
        /^(localhost|127|0\.0\.0\.0)/.test(window.location.hostname || '')) ? 'dev' : 'production',
      defaultIntegrations: false,
    });
    _initialized = true;
    return true;
  } catch (_e) {
    return false;
  }
}

export function isInitialized() {
  return _initialized;
}

export function captureException(err) {
  const Sentry = _sentry();
  if (!Sentry || typeof Sentry.captureException !== 'function') return;
  try { Sentry.captureException(err); } catch (_e) { /* never let telemetry break callers */ }
}

export function captureMessage(msg, level = 'info') {
  const Sentry = _sentry();
  if (!Sentry || typeof Sentry.captureMessage !== 'function') return;
  try { Sentry.captureMessage(msg, level); } catch (_e) { /* swallow */ }
}

export function addBreadcrumb(crumb) {
  const Sentry = _sentry();
  if (!Sentry || typeof Sentry.addBreadcrumb !== 'function') return;
  try { Sentry.addBreadcrumb(crumb); } catch (_e) { /* swallow */ }
}
