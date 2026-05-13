// 2026-05-13 — TASK-055 (T3.10): Party Tower async architecture — config constants.
//
// Spec: docs/design/endgame-social.md §3 (Party Tower — 2–5 player async coop)
//       + §15 ESC-03 Q3 ruling — 24h Standard default; 4h Competitive + 7-day
//         Casual selectable per-party at creation.
//       + ADR-002 — async-only (Firestore + push notif, NO WebRTC).
//       + ADR-003 — strict no-P2W; party progression COSMETIC-ONLY; no
//         whale-tier perks; no paid party-size expansion.
//
// Frozen registry of party-config tunables. Per ADR-003 every entry here is
// segment-agnostic — no field exists that grants paying players a mechanical
// advantage (no per-tier extra slots, no whale-tier turn timeout extensions,
// no paid revives, etc.). Per ADR-002 every state transition is async — no
// real-time presence channel, no WebRTC config.
//
// Sacred-cow safety (CLAUDE.md §2):
//   - PARTY_MAX_SIZE === 5 HARD CAP per ADR-003 (no whale expansion).
//   - PARTY_DEFAULT_TIMEOUT_MODE === 'standard' per ESC-03 Q3.
//   - Turn timeout values byte-perfect: 4h / 24h / 7d (ESC-03 Q3).
//   - No NARRATOR_LINES additions.
//   - No V_HAPTICS keys.
//   - No combat / damage / TTK / Battle Pass / GEM_PACKS / TOWER_LEADERBOARDS /
//     TOWER_PACTS interaction. T3.10 ships SCHEMA-only — T3.11 wires the
//     shared Tower-Hearts pool that draws from sacred ladder [100, 200, 400].
//   - All entries are frozen objects — runtime cannot mutate them.

// ──────────────────────────────────────────────────────────────────────────
// Party size — HARD CAP per ADR-003 + ESC-03 (no whale expansion).
// ──────────────────────────────────────────────────────────────────────────

/** Minimum party size — must have ≥2 members before owner can start the run. */
export const PARTY_MIN_SIZE = 2;

/** Maximum party size — HARD CAP per ADR-003. Server-enforced via Firestore
 *  security rules; client-enforced via validatePartySize. Whale-tier expansion
 *  EXPLICITLY REJECTED per ADR-003 (no paid party-size perks). */
export const PARTY_MAX_SIZE = 5;

// ──────────────────────────────────────────────────────────────────────────
// Party name validation — mirrors clan-config sibling.
// ──────────────────────────────────────────────────────────────────────────

/** Party name length bounds (mirrors clan validation precedent). */
export const PARTY_NAME_MIN_LEN = 3;
export const PARTY_NAME_MAX_LEN = 30;

// ──────────────────────────────────────────────────────────────────────────
// Turn timeout — ESC-03 Q3 ruling: 24h Standard default, 4h Competitive +
// 7-day Casual selectable per-party at creation.
// ──────────────────────────────────────────────────────────────────────────

/** Competitive mode — 4 hours. Speed-runners; tight loop, frequent handoffs. */
export const PARTY_TIMEOUT_MS_COMPETITIVE = 4 * 60 * 60 * 1000;

/** Standard mode — 24 hours. DEFAULT per ESC-03 Q3. Balances "passive
 *  async social feel" with "doesn't ghost the party for weeks". */
export const PARTY_TIMEOUT_MS_STANDARD = 24 * 60 * 60 * 1000;

/** Casual mode — 7 days. Friend-group asyncs that may go quiet during
 *  weeks; designed for the "play once a week" segment per spec §3.1. */
export const PARTY_TIMEOUT_MS_CASUAL = 7 * 24 * 60 * 60 * 1000;

/** Default timeout mode per ESC-03 Q3 ruling — 24h Standard. */
export const PARTY_DEFAULT_TIMEOUT_MODE = 'standard';

/** Frozen lookup table mapping mode string → ms. Used by computeTurnTimeoutMs. */
export const PARTY_TIMEOUT_MS = Object.freeze({
  competitive: PARTY_TIMEOUT_MS_COMPETITIVE,
  standard:    PARTY_TIMEOUT_MS_STANDARD,
  casual:      PARTY_TIMEOUT_MS_CASUAL,
});

// ──────────────────────────────────────────────────────────────────────────
// State machine + role enums.
// ──────────────────────────────────────────────────────────────────────────

/** Frozen registry of valid party states.
 *  - 'pending'    — created, members may join, owner has not started yet.
 *  - 'active'     — run in progress; turn rotation active.
 *  - 'completed'  — run cleared OR run failed (state machine terminal).
 *  - 'abandoned'  — too many missed turns / all members left mid-run. */
export const PARTY_STATES = Object.freeze(['pending', 'active', 'completed', 'abandoned']);

/** Frozen registry of party roles.
 *  - 'owner'  — creator + ownership-transfer recipient. May start the run.
 *  - 'member' — joined post-creation. Equal turn rights once 'active'. */
export const PARTY_ROLES = Object.freeze(['owner', 'member']);

// ──────────────────────────────────────────────────────────────────────────
// Firestore collection name — "parties" per spec §3.1 wording.
// ──────────────────────────────────────────────────────────────────────────

/** Firestore collection name for Party Tower party documents. */
export const PARTY_COLLECTION = 'parties';

// ──────────────────────────────────────────────────────────────────────────
// T3.11 — Shared resources: Tower-Hearts pool + TOWER_PACTS selection.
// ──────────────────────────────────────────────────────────────────────────
// Spec: docs/design/endgame-social.md §3.2 + §3.3.
//
// The party shares a single Tower-Hearts pool drawing from the SACRED retry
// ladder [100, 200, 400] (CLAUDE.md §2.4 — gemCostLadder in src/data/balance.js
// PINCH_SYSTEM.towerDeath). T3.11 READS that ladder; it never writes or
// modifies it. Pool size + gem cost per retry tier are derived purely from
// the sacred source.
//
// TOWER_PACTS selection is shared across party members. Two pick modes
// (selectable at party creation):
//   - 'captain'   → owner picks each pact at each pact-pick point
//   - 'democracy' → each member votes; majority wins; ties broken by owner
//
// Pacts pool draws from sacred TOWER_PACTS_BASE (30) + TOWER_PACTS_MYTHIC
// (15) in src/data/tower.js. T3.11 READS that registry; never mutates.
//
// ADR-003 invariants:
//   - No P2W hearts purchase shortcuts (sacred ladder is THE cost)
//   - No whale-tier extra-pact slots (3 candidates per pick, all tiers)
//   - No segment-aware pact filtering (all tiers see same candidate pool)

/** Pick-mode registry — owner chooses at party creation. */
export const PARTY_PACT_PICK_MODES = Object.freeze(['captain', 'democracy']);

/** Default pick mode at party creation. Mirrors ESC-03 Q3 "Standard default"
 *  philosophy: pick the middle-ground option. Captain-pick has lower
 *  coordination cost than democracy. */
export const PARTY_DEFAULT_PICK_MODE = 'captain';

/** Number of pact candidates surfaced per pact-pick point (sacred Slay-the-
 *  Spire-style 3-from-N). Same across all tiers per ADR-003 (no whale extra). */
export const PARTY_PACT_CANDIDATES_PER_PICK = 3;

/** Democracy vote window (ms). After this, tally + auto-tiebreak via owner.
 *  60s gives enough thinking time for an async-coop turn handoff without
 *  ghosting the party. */
export const PARTY_PACT_DEMOCRACY_TIMEOUT_MS = 60 * 1000;

/** HP damage per cursed-cell-style drain event. (Each retry costs 1 Heart
 *  from the shared pool; player gold cost scales via sacred ladder.) */
export const PARTY_HEARTS_DRAIN_PER_RETRY = 1;

// ──────────────────────────────────────────────────────────────────────────
// Pact-pick result reasons (extends PARTY_RESULT_REASONS namespace conceptually).
// ──────────────────────────────────────────────────────────────────────────

/** Decision-source labels for tallyDemocracyVotes audit + UI display. */
export const PARTY_PACT_DECISION_SOURCES = Object.freeze({
  CAPTAIN:                 'captain',
  DEMOCRACY_MAJORITY:      'democracy-majority',
  DEMOCRACY_TIEBREAKER:    'democracy-tiebreaker',
});
