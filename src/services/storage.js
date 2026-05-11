// 2026-05-11 — TASK-009 (T1.08): localStorage abstraction with mock mode.
//
// Legacy hits `localStorage.{get,set,remove}Item` directly at ~413 call sites
// (grep `localStorage\.\(getItem\|setItem\|removeItem\|clear\)` in
// docs/_legacy/_archive_v1/blocksworn_index_fixed.html). T1.08 introduces
// this single-surface abstraction so:
//   - tests can swap to in-memory backing (setMockMode(true)) without touching
//     window.localStorage — first unit tests in the project (T1.14 will reuse
//     this for the artifact-removal migration tests).
//   - T1.14 has a place to hang `migrate()` for the artifact-subsystem cleanup
//     (placeholder below — T1.08 doesn't implement migration logic, only the
//     shape).
//   - T1.10 will rewire callers from raw localStorage.* → these helpers.
//
// IMPORTANT — legacy compatibility note:
//   Legacy stores a mix of (a) raw strings via localStorage.setItem('k', 'v')
//   and (b) JSON.stringify(obj) via localStorage.setItem('k', JSON.stringify(o)).
//   This abstraction NORMALIZES everything through JSON.stringify/parse on
//   set and get. That's intentional — a callable string value via the new API
//   still round-trips (JSON.stringify('foo') === '"foo"', parse('"foo"') === 'foo')
//   — but T1.10 must verify each rewired call site, especially places that
//   currently read raw strings via localStorage.getItem('k') (no parse).
//   Document direct-localStorage usages in "Замечено рядом" under T1.10 to
//   catch all of them.
//
// Public API:
//   - getItem(key, defaultValue = null) — JSON-parsed; falls back on
//                                          missing-key OR parse error.
//   - setItem(key, value)               — JSON-stringified; swallows QuotaExceeded.
//   - removeItem(key)                   — swallows error if unsupported.
//   - clear()                           — wipes (in-memory if mock; real
//                                          localStorage.clear() otherwise).
//   - setMockMode(enabled)              — true → in-memory backing for tests.
//                                          false → restore real localStorage.
//   - isMockMode()                       — introspection helper.
//   - migrate(fromVersion, toVersion)    — placeholder for T1.14.
//   - STORAGE_VERSION                    — current schema version (1).

export const STORAGE_VERSION = 1;

let _mockMode = false;
let _mockStore = null;

export function setMockMode(enabled) {
  _mockMode = !!enabled;
  _mockStore = _mockMode ? Object.create(null) : null;
}

export function isMockMode() {
  return _mockMode;
}

export function getItem(key, defaultValue = null) {
  if (typeof key !== 'string' || !key) return defaultValue;
  if (_mockMode) {
    return Object.prototype.hasOwnProperty.call(_mockStore, key)
      ? _mockStore[key]
      : defaultValue;
  }
  try {
    if (typeof localStorage === 'undefined') return defaultValue;
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    try { return JSON.parse(raw); } catch (_e) { return defaultValue; }
  } catch (_e) {
    return defaultValue;
  }
}

export function setItem(key, value) {
  if (typeof key !== 'string' || !key) return false;
  if (_mockMode) {
    _mockStore[key] = value;
    return true;
  }
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_e) {
    // QuotaExceeded / SecurityError / private-mode quirks — swallow so callers
    // never crash. Real recovery (storage-full UX) is a later concern.
    return false;
  }
}

export function removeItem(key) {
  if (typeof key !== 'string' || !key) return false;
  if (_mockMode) {
    delete _mockStore[key];
    return true;
  }
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.removeItem(key);
    return true;
  } catch (_e) {
    return false;
  }
}

export function clear() {
  if (_mockMode) {
    _mockStore = Object.create(null);
    return true;
  }
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.clear();
    return true;
  } catch (_e) {
    return false;
  }
}

// Placeholder for the T1.14 artifact-subsystem migration. Spec lands when
// the artifact cleanup task picks up; for now this is a typed no-op so the
// public API is stable.
export function migrate(_fromVersion, _toVersion) {
  // T1.14: scan for 'blocksworn_artifact_*' keys, transform / delete them,
  // then re-stamp STORAGE_VERSION. NOT implemented in T1.08.
  return { ok: true, migrated: 0 };
}
