// 2026-05-11 — TASK-001 (T1.01): Blocksworn entry point placeholder.
// 2026-05-11 — TASK-007 (T1.06): wire modular CSS bundle.
// 2026-05-11 — TASK-009 (T1.08): record legacy service init order for T1.12 wire-up.
// Real bootstrapping wired up in T1.12.
//
// Service init order (preserved from legacy
// docs/_legacy/_archive_v1/blocksworn_index_fixed.html lines 18259-18470):
//   1. Firebase modular SDK (CDN, async <script type="module">)
//      - initializeApp(FIREBASE_CONFIG)
//      - getAuth + getFirestore + getAnalytics
//      - signInAnonymously → resolves UID → dispatches `firebaseReady`
//   2. RevenueCat (CDN, async <script src="js.revenuecat.com">)
//      - on `firebaseReady`: Purchases.configure({ apiKey, appUserID: uid })
//      - dispatches `revenueCatReady`
//   3. Sentry (CDN, async <script src="browser.sentry-cdn.com">)
//      - on DOMContentLoaded: Sentry.init({ dsn, ... })
//      - independent of Firebase / RevenueCat (no UID dependency)
//
// T1.12 will replace the legacy CDN init blocks with calls into the
// service modules in src/services/. The dependency chain (RevenueCat
// needs Firebase UID; storage migrations may need Firebase auth) must
// be preserved.

import './styles/index.css';

console.log('Blocksworn loading...');
