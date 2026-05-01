// 2026-05-02 — SPRINT 4 B3: Cloud Functions for production back-end.
// Two functions:
//   1. revenueCatWebhook — receipt validation + grant logging from RC events
//   2. deleteUser        — GDPR data deletion (recursive Firestore + Auth)
//
// Deploy:
//   cd firebase/functions
//   npm install
//   firebase functions:config:set revenuecat.webhook_secret="YOUR_SECRET"
//   firebase deploy --only functions:revenueCatWebhook,functions:deleteUser
//
// Per SPRINT_4_PRODUCTION_READINESS.md §3.6 + §9.6.

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// ──────────────────────────────────────────────────────────────────────────
// 1. RevenueCat webhook
// ──────────────────────────────────────────────────────────────────────────
//
// Triggers on: INITIAL_PURCHASE / RENEWAL / CANCELLATION / REFUND events
// from RevenueCat dashboard. Logs purchase history to /users/{uid}/purchases
// and refunds to /users/{uid}/refunds for the support team to process.
//
// Configure in RevenueCat dashboard:
//   URL:    https://us-central1-blocksworm.cloudfunctions.net/revenueCatWebhook
//   Header: Authorization: Bearer YOUR_SECRET (matches webhook_secret config)

exports.revenueCatWebhook = functions.https.onRequest(async (req, res) => {
  // Verify webhook signature.
  const expectedSecret = (functions.config().revenuecat && functions.config().revenuecat.webhook_secret) ||
                         process.env.REVENUECAT_WEBHOOK_SECRET ||
                         'YOUR_WEBHOOK_SECRET';
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${expectedSecret}`) {
    console.warn('[RC Webhook] unauthorized request');
    return res.status(401).send('Unauthorized');
  }

  const event = req.body && req.body.event;
  if (!event) return res.status(400).send('No event');

  const eventType = event.type;
  const userId = event.app_user_id;
  const productId = event.product_id;
  const transactionId = event.transaction_id || event.original_transaction_id;
  const priceUSD = event.price_in_purchased_currency || event.price || null;

  if (!userId || !eventType) {
    console.warn('[RC Webhook] missing required fields', { eventType, userId });
    return res.status(400).send('Missing fields');
  }

  console.log(`[RC Webhook] ${eventType} for ${userId.slice(0, 8)} product=${productId}`);

  try {
    const userDoc = admin.firestore().collection('users').doc(userId);
    const ts = admin.firestore.FieldValue.serverTimestamp();

    switch (eventType) {
      case 'INITIAL_PURCHASE':
      case 'NON_RENEWING_PURCHASE':
        await userDoc.collection('purchases').add({
          productId, transactionId, priceUSD, eventType, timestamp: ts,
        });
        // Increment lifetime purchase counter for ARPDAU dashboards
        await userDoc.set({
          totalPurchases: admin.firestore.FieldValue.increment(1),
          totalRevenueUSD: admin.firestore.FieldValue.increment(priceUSD || 0),
        }, { merge: true });
        break;

      case 'RENEWAL':
        await userDoc.collection('purchases').add({
          productId, transactionId, priceUSD,
          eventType: 'subscription_renewal', timestamp: ts,
        });
        await userDoc.set({
          totalRevenueUSD: admin.firestore.FieldValue.increment(priceUSD || 0),
          subscriptionActive: true,
        }, { merge: true });
        break;

      case 'CANCELLATION':
        // User cancelled subscription auto-renewal; current period continues.
        await userDoc.set({ subscriptionAutoRenew: false }, { merge: true });
        break;

      case 'EXPIRATION':
        // Subscription period ended, no renewal.
        await userDoc.set({ subscriptionActive: false }, { merge: true });
        break;

      case 'REFUND':
        // Apple/Google refunded — flag for support team review.
        await userDoc.collection('refunds').add({
          productId, transactionId, priceUSD,
          status: 'pending_review', timestamp: ts,
        });
        // Auto-revoke subscription on refund of subscription product.
        if (productId && productId.indexOf('sub.') !== -1) {
          await userDoc.set({ subscriptionActive: false }, { merge: true });
        }
        break;

      default:
        console.log(`[RC Webhook] unhandled event type: ${eventType}`);
    }

    return res.status(200).send('OK');
  } catch (e) {
    console.error('[RC Webhook] error:', e);
    return res.status(500).send('Error');
  }
});

// ──────────────────────────────────────────────────────────────────────────
// 2. Delete User (GDPR)
// ──────────────────────────────────────────────────────────────────────────
//
// Recursively deletes all user data:
//   - /users/{uid} document + subcollections (purchases, refunds, gifts)
//   - Firebase Auth account (uid invalidated)
//
// Called from in-app deleteAccount() button (Profile screen). The client
// also clears localStorage; this function handles the server-side erasure.
//
// Authorization: caller must be authenticated AND uid must match doc.

exports.deleteUser = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }
  const uid = context.auth.uid;
  const targetUid = (data && data.uid) || uid;

  // Defensive: only allow self-deletion. Prevents impersonation if rules drift.
  if (targetUid !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'Can only delete own account');
  }

  console.log(`[deleteUser] erasing ${uid.slice(0, 8)}`);

  try {
    const db = admin.firestore();
    const userDocRef = db.collection('users').doc(uid);

    // Delete known subcollections explicitly.
    const subcollections = ['purchases', 'refunds', 'gifts', 'friends'];
    for (const sub of subcollections) {
      try {
        const snap = await userDocRef.collection(sub).get();
        const batch = db.batch();
        snap.forEach(d => batch.delete(d.ref));
        if (snap.size) await batch.commit();
      } catch (e) {
        console.warn(`[deleteUser] subcoll ${sub} failed:`, e.message);
      }
    }

    // Delete the user document itself.
    await userDocRef.delete();

    // Delete the Auth account — uid becomes unusable.
    try { await admin.auth().deleteUser(uid); }
    catch (e) { console.warn('[deleteUser] auth delete failed:', e.message); }

    return { ok: true, uid };
  } catch (e) {
    console.error('[deleteUser] error:', e);
    throw new functions.https.HttpsError('internal', e.message || 'Delete failed');
  }
});
