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

// ──────────────────────────────────────────────────────────────────────────
// 2026-05-13 — TASK-047 (T3.07): Firebase Storage helpers (ADDITIVE).
//
// T3.07 ships the replay capture backend. Replays land at
// `replays/{uid}/{replayId}.json` per docs/design/endgame-social.md §4.4.
// The Storage SDK may be wired live (legacy CDN module dispatch + npm install)
// or absent (T3.07 ships without it — these helpers no-op gracefully).
//
// All three helpers are DEFENSIVE — if `window.fbStorage` isn't bound by the
// legacy module dispatch, they return null / { ok:false, reason:'no-sdk' }
// and the replay backend silently buffers locally (T3.08 viewer can fetch
// from IndexedDB mock if needed). Live wiring deferred to T3.07.1 follow-up.
// ──────────────────────────────────────────────────────────────────────────

function _fbStorage() {
  try {
    if (typeof window !== 'undefined' && window.fbStorage) return window.fbStorage;
    if (typeof window !== 'undefined' && window.fb && window.fb.storage) return window.fb.storage;
  } catch (_e) { /* swallow */ }
  return null;
}

/**
 * Get a Firebase Storage reference at the given path, or null when SDK
 * isn't initialized. Pure read — never throws.
 *
 * @param {string} path - e.g. 'replays/{uid}/{replayId}.json'
 * @returns {object|null}
 */
export function getStorageRef(path) {
  if (!path || typeof path !== 'string') return null;
  try {
    const storage = _fbStorage();
    if (!storage) return null;
    // Prefer modular SDK shape (ref function); fall back to legacy compat.
    if (typeof storage.ref === 'function') {
      return storage.ref(path);
    }
    if (typeof storage.getRef === 'function') {
      return storage.getRef(path);
    }
    return null;
  } catch (_e) {
    return null;
  }
}

/**
 * Upload a blob/string to Firebase Storage at `path`. Async, defensive —
 * resolves `{ok: false, reason}` when the SDK is absent or upload fails.
 *
 * @param {string} path
 * @param {string|Blob|Uint8Array} blob
 * @param {object} [metadata]
 * @returns {Promise<{ok: boolean, path?: string, reason?: string}>}
 */
export async function uploadStorageBlob(path, blob, metadata) {
  try {
    const ref = getStorageRef(path);
    if (!ref) {
      return { ok: false, reason: 'no-sdk' };
    }
    if (typeof ref.put === 'function') {
      await ref.put(blob, metadata);
      return { ok: true, path };
    }
    if (typeof ref.putString === 'function' && typeof blob === 'string') {
      await ref.putString(blob, 'raw', metadata);
      return { ok: true, path };
    }
    return { ok: false, reason: 'unsupported-ref-shape' };
  } catch (e) {
    return { ok: false, reason: (e && e.message) || 'upload-error' };
  }
}

/**
 * Download a blob from Firebase Storage at `path`, returning it as a string
 * (UTF-8). Returns null when SDK is absent or the object is missing.
 *
 * @param {string} path
 * @returns {Promise<string|null>}
 */
export async function downloadStorageBlob(path) {
  try {
    const ref = getStorageRef(path);
    if (!ref) return null;
    if (typeof ref.getDownloadURL === 'function' && typeof fetch === 'function') {
      const url = await ref.getDownloadURL();
      if (!url) return null;
      const resp = await fetch(url);
      if (!resp || !resp.ok) return null;
      return await resp.text();
    }
    if (typeof ref.getString === 'function') {
      return await ref.getString();
    }
    return null;
  } catch (_e) {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 2026-05-13 — TASK-050 (T3.02): Firestore clan-collection helpers (ADDITIVE).
//
// T3.02 ships the Adventures backend. Clan docs land at
// `adventures/{clanId}` per docs/design/endgame-social.md §2.1. The
// Firestore SDK may be wired live (legacy CDN module dispatch) or absent
// (T3.02 ships without it — these helpers no-op gracefully and the
// clan-backend module falls back to its in-memory mock store).
//
// All helpers are DEFENSIVE — if Firestore isn't bound by the legacy
// module dispatch, they return null and the clan-backend module silently
// uses the mock path. Live SDK wiring deferred to T3.02.1 follow-up.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Get a Firestore collection reference for clans (`adventures`). Returns
 * null when the Firestore SDK isn't initialized. Pure read — never throws.
 *
 * @returns {object|null}
 */
export function getClansCollectionRef() {
  try {
    const db = getDb();
    if (!db) return null;
    if (typeof db.collection === 'function') {
      return db.collection('adventures');
    }
    // Modular SDK shape — `collection(db, name)` is a free function the
    // legacy CDN dispatch exposes as `window.fbFirestore.collection`. Defer
    // to T3.02.1 once npm-bundled Firestore lands; until then null + mock
    // fallback in clan-backend.js handles the no-SDK path.
    return null;
  } catch (_e) {
    return null;
  }
}

/**
 * Get a Firestore document reference at `adventures/{clanId}`. Returns null
 * when the SDK is absent or the clanId is invalid. Pure read — never throws.
 *
 * @param {string} clanId
 * @returns {object|null}
 */
export function getClanDocRef(clanId) {
  if (!clanId || typeof clanId !== 'string') return null;
  try {
    const coll = getClansCollectionRef();
    if (!coll) return null;
    if (typeof coll.doc === 'function') {
      return coll.doc(clanId);
    }
    return null;
  } catch (_e) {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 2026-05-13 — TASK-055 (T3.10): Firestore party-collection helpers (ADDITIVE).
//
// T3.10 ships the Party Tower async backend. Party docs land at
// `parties/{partyId}` per docs/design/endgame-social.md §3.1. The Firestore
// SDK may be wired live (legacy CDN module dispatch) or absent (T3.10 ships
// without it — these helpers no-op gracefully and the party-tower-backend
// module falls back to its in-memory mock store).
//
// All helpers are DEFENSIVE — if Firestore isn't bound by the legacy module
// dispatch, they return null and the party-tower-backend module silently
// uses the mock path. Live SDK wiring deferred to T3.10.1 follow-up.
// Per ADR-002: no WebRTC, no peer connections — Firestore only.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Get a Firestore collection reference for parties (`parties`). Returns
 * null when the Firestore SDK isn't initialized. Pure read — never throws.
 *
 * @returns {object|null}
 */
export function getPartiesCollectionRef() {
  try {
    const db = getDb();
    if (!db) return null;
    if (typeof db.collection === 'function') {
      return db.collection('parties');
    }
    // Modular SDK shape — `collection(db, name)` is a free function exposed
    // by `window.fbFirestore.collection`. Defer to T3.10.1 once npm-bundled
    // Firestore lands; until then null + mock fallback in party-tower-backend.js
    // handles the no-SDK path.
    return null;
  } catch (_e) {
    return null;
  }
}

/**
 * Get a Firestore document reference at `parties/{partyId}`. Returns null
 * when the SDK is absent or the partyId is invalid. Pure read — never throws.
 *
 * @param {string} partyId
 * @returns {object|null}
 */
export function getPartyDocRef(partyId) {
  if (!partyId || typeof partyId !== 'string') return null;
  try {
    const coll = getPartiesCollectionRef();
    if (!coll) return null;
    if (typeof coll.doc === 'function') {
      return coll.doc(partyId);
    }
    return null;
  } catch (_e) {
    return null;
  }
}
