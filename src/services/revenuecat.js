// 2026-05-11 — TASK-009 (T1.08): RevenueCat IAP abstraction.
//
// Wraps the legacy script blocks at
// docs/_legacy/_archive_v1/blocksworn_index_fixed.html lines 18353-18419 that:
//   1. loads RevenueCat web SDK from js.revenuecat.com (window.Purchases)
//   2. on `firebaseReady` event: calls Purchases.configure({ apiKey, appUserID })
//      with the anonymous Firebase UID
//   3. sets window.rcReady true on success, dispatches `revenueCatReady`
//   4. falls back to a mock IAP path when SDK absent or API key still placeholder
//
// Public API:
//   - initRevenueCat(apiKey, appUserID) — wraps Purchases.configure; resolves
//                                          true on success, false on no-op.
//   - isReady()                          — true once configure has resolved.
//   - getOfferings()                     — wraps Purchases.getOfferings(); null
//                                          if SDK not ready.
//   - purchasePackage(pkg)               — wraps Purchases.purchasePackage().
//   - restorePurchases()                 — wraps Purchases.restorePurchases().
//
// All wrappers are async + try/catch'd. SDK absent → graceful no-op (mock
// path stays in legacy and is preserved by T1.10 when callers move over).
//
// IMPORTANT: API key is a PLACEHOLDER (`rcb_PLACEHOLDER_REPLACE_BEFORE_PRODUCTION`,
// legacy line 18374). Production key wiring is T1.18+.

export const RC_PUBLIC_KEY_WEB_PLACEHOLDER = 'rcb_PLACEHOLDER_REPLACE_BEFORE_PRODUCTION';

let _ready = false;
let _configError = null;

function _purchases() {
  return (typeof window !== 'undefined' && window.Purchases) ? window.Purchases : null;
}

export async function initRevenueCat(apiKey = RC_PUBLIC_KEY_WEB_PLACEHOLDER, appUserID = null) {
  const Purchases = _purchases();
  if (!Purchases) {
    _configError = 'sdk_not_loaded';
    return false;
  }
  if (typeof apiKey !== 'string' || apiKey.indexOf('PLACEHOLDER') !== -1) {
    _configError = 'placeholder_key';
    return false;
  }
  try {
    await Purchases.configure({ apiKey, appUserID: appUserID || undefined });
    _ready = true;
    _configError = null;
    return true;
  } catch (e) {
    _configError = String((e && e.message) || e);
    return false;
  }
}

export function isReady() {
  if (!_ready && typeof window !== 'undefined' && window.rcReady) {
    // Legacy already configured via the inline script — pick up that state.
    _ready = true;
  }
  return _ready;
}

export function getConfigError() {
  return _configError;
}

export async function getOfferings() {
  const Purchases = _purchases();
  if (!Purchases || !isReady() || typeof Purchases.getOfferings !== 'function') return null;
  try {
    return await Purchases.getOfferings();
  } catch (_e) {
    return null;
  }
}

export async function purchasePackage(pkg) {
  const Purchases = _purchases();
  if (!Purchases || !isReady() || typeof Purchases.purchasePackage !== 'function') {
    return { ok: false, reason: 'not_ready' };
  }
  try {
    const result = await Purchases.purchasePackage(pkg);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, reason: String((e && e.message) || e) };
  }
}

export async function restorePurchases() {
  const Purchases = _purchases();
  if (!Purchases || !isReady() || typeof Purchases.restorePurchases !== 'function') {
    return { ok: false, reason: 'not_ready' };
  }
  try {
    const result = await Purchases.restorePurchases();
    return { ok: true, result };
  } catch (e) {
    return { ok: false, reason: String((e && e.message) || e) };
  }
}
