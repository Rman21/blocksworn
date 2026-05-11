// 2026-05-11 — TASK-009 (T1.08): Firebase abstraction (app, auth, firestore, analytics).
//
// Wraps the legacy <script type="module"> block at
// docs/_legacy/_archive_v1/blocksworn_index_fixed.html lines 18259-18351 that:
//   1. imports the Firebase 10.7.1 modular SDK (app, auth, firestore, analytics)
//      via gstatic CDN at the page-loading boundary
//   2. calls initializeApp(firebaseConfig)
//   3. wires getAuth + getFirestore + getAnalytics
//   4. exposes window.fb {app, auth, db, signInAnonymously, ...} for the
//      legacy non-module main <script> to call
//   5. anonymous sign-in via signInAnonymously(auth)
//   6. fires `firebaseReady` CustomEvent when auth resolves
//
// For T1.08 this module exposes a clean public API. T1.10 will wire callers
// (currently still hitting window.fb in legacy main script). The Firebase
// modular SDK is NOT statically imported here yet — the legacy CDN load is
// preserved for behavioral byte-identity. Real bundling decisions land in
// T1.12 (main.js entry point wire-up) once the SDK move from CDN → npm is
// approved separately.
//
// init order (preserve in T1.12 wire-up): Firebase init must complete BEFORE
//   - RevenueCat configure (needs UID from anonymous auth)
//   - storage migrations that rely on cloud-side save-version checks
// Sentry can init independently in any order (no Firebase dependency).

// Legacy config — copied byte-perfect from legacy lines 18285-18293. These
// public keys (apiKey / appId / measurementId) are CLIENT-SIDE config, not
// secrets — Firebase enforces auth via Firestore security rules. Production
// hygiene (env vars, .env.production) is a T1.18+ concern.
export const FIREBASE_CONFIG = Object.freeze({
  apiKey: 'AIzaSyC9oetrKqpzt16KL1dnnGjN3r4iLL-aLlQ',
  authDomain: 'blocksworm.firebaseapp.com',
  projectId: 'blocksworm',
  storageBucket: 'blocksworm.firebasestorage.app',
  messagingSenderId: '334495495523',
  appId: '1:334495495523:web:4cb7d467afea6c2c248f56',
  measurementId: 'G-DVHMVFYPMC',
});

let _app = null;
let _auth = null;
let _db = null;
let _analytics = null;
let _ready = false;

// Lazy ref to window.fb (set by the legacy module script). When T1.12 moves
// the module-side init into this file, _bindFromWindow() will be replaced
// with direct calls to initializeApp / getAuth / getFirestore / getAnalytics
// against an npm-bundled Firebase SDK.
function _bindFromWindow() {
  if (typeof window === 'undefined' || !window.fb) return false;
  _app = window.fb.app || null;
  _auth = window.fb.auth || null;
  _db = window.fb.db || null;
  _analytics = (window.fbAnalytics) || null;
  _ready = !!_app;
  return _ready;
}

export function initFirebase() {
  // T1.08: legacy boot has already done initializeApp by the time this is
  // called; we just bind references. T1.12 replaces this with the real init.
  return _bindFromWindow();
}

export function getApp() {
  if (!_app) _bindFromWindow();
  return _app;
}

export function getAuth() {
  if (!_auth) _bindFromWindow();
  return _auth;
}

export function getDb() {
  if (!_db) _bindFromWindow();
  return _db;
}

export function getAnalytics() {
  if (!_analytics) _bindFromWindow();
  return _analytics;
}

export function isReady() {
  if (!_ready) _bindFromWindow();
  return _ready;
}

// Subscribe to the `firebaseReady` event the legacy module dispatches once
// anonymous auth has resolved. Returns an unsubscribe function.
export function onReady(callback) {
  if (typeof window === 'undefined') return () => {};
  if (isReady()) {
    try { callback({ uid: _auth && _auth.currentUser && _auth.currentUser.uid }); }
    catch (_e) { /* callback threw — never propagate */ }
    return () => {};
  }
  const handler = (e) => {
    _bindFromWindow();
    try { callback(e && e.detail); }
    catch (_e) { /* callback threw — swallow */ }
  };
  window.addEventListener('firebaseReady', handler, { once: true });
  return () => window.removeEventListener('firebaseReady', handler);
}
