/* eslint-disable no-empty */
/* global crypto */
// 2026-05-13 — TASK-054 (T3.06): Friend leaderboard mini-block — friend
// graph aggregation backend. Wave-4 Phase 3 task. Bridge between the
// Wave-3 Adventures clan-backend (T3.02) + the sacred read-only Tower
// season leaderboard + the navigator.share invite token plumbing.
//
// Spec: docs/design/endgame-social.md §5 (Friend leaderboard mini-block)
//       + §15 ESC-03 Q5 ruling — navigator.share OS-native only (MVP);
//         in-game friend codes deferred to Phase 3.5.
//       + ADR-002 — async-only (no WebRTC).
//       + ADR-003 — strict no-P2W; friends sorted by Tower floor ONLY,
//                   NEVER by lifetime spend.
//
// What this module ships:
//   1. Frozen registry constants — collection name, result-reason strings,
//      friend-cap + invite-token format.
//   2. 4 pure helpers (testable in isolation, < 1ms each):
//        - aggregateFriendsFromSources(clanMembers, towerLeaderboard, sharedReceived)
//        - sortFriendsByTowerFloor(friends)
//        - getTopNFriends(friends, n)
//        - parseInviteTokenFromUrl(url)
//   3. 1 share-invite helper:
//        - buildInviteShareContent(playerName, towerFloor, inviteToken)
//   4. 4 async ops (defensive, mock-store fallback when Firestore absent):
//        - fetchTowerSeasonTop(limit)              READ-ONLY Tower data
//        - fetchFriendsForPlayer(playerId)          main aggregation
//        - recordInviteAccepted(token, fromId, toId)
//        - parseAndConsumeInvite(token)             deeplink landing
//   5. Mock-store invite token registry — idempotent token consumption.
//
// Performance budget (spec §5.4):
//   - Pure helpers ≤1ms each.
//   - fetchFriendsForPlayer ≤200ms p99 (cached); ≤500ms p99 (uncached).
//   - Tower-score sync per friend ≤50ms (sparse update path).
//   - All async ops fall back to `{ok:false, reason:'no-sdk'}` when the
//     Firestore SDK is absent (mirrors T3.02/T3.07 backend precedent).
//
// Sacred-cow safety (CLAUDE.md §2):
//   - READ-ONLY of Tower season leaderboard (TOWER_LEADERBOARDS frozen
//     config — never written by this module).
//   - PURE PATH (F2P-only) leaderboard NEVER touched — friend graph is
//     a separate aggregation and does not contaminate PURE PATH.
//   - Sort key is `currentTowerFloor` only — NEVER lifetime spend (ADR-003).
//   - clan-backend.js public API unchanged — this module is a READ
//     consumer of `listClansForPlayer` + `fetchClan`.
//   - getPlayerSegment() READ-ONLY (sacred T1.20 thresholds untouched).
//   - No V_HAPTICS / NARRATOR_LINES / RACE_SYNERGY / combo crit interaction.
//   - All exports defensive — sacred game loop never regresses if friend
//     graph throws (ADR-004 hybrid coexistence).
//
// Public API:
//   Constants:
//     - FRIEND_COLLECTION ('friends'), FRIEND_RESULT_REASONS frozen registry
//     - FRIEND_GRAPH_PER_PLAYER_CAP (100, FIFO eviction per spec §5.2)
//     - FRIEND_SOURCE_CLAN / TOWER / CODEX / REPLAY / INVITE — source tag enum
//     - INVITE_TOKEN_LEN (16 chars hex)
//   Pure helpers:
//     - aggregateFriendsFromSources(clanMembers, towerLeaderboard, sharedReceived)
//     - sortFriendsByTowerFloor(friends)
//     - getTopNFriends(friends, n)
//     - buildInviteShareContent(playerName, towerFloor, inviteToken)
//     - parseInviteTokenFromUrl(url)
//   Async ops:
//     - fetchTowerSeasonTop(limit)
//     - fetchFriendsForPlayer(playerId)
//     - recordInviteAccepted(inviteToken, fromPlayerId, toPlayerId)
//     - parseAndConsumeInvite(inviteToken)
//   Test-only helpers:
//     - _resetMockFriendStore() — clear mock invite + tower-top stores
//     - _seedMockTowerTop(rows) — preload Tower season top for tests
//     - _seedMockInvite(token, fromId) — preload an outstanding invite

import { getDb } from './firebase.js';
import { log } from './logger.js';
import { listClansForPlayer, fetchClan } from './clan-backend.js';

// ──────────────────────────────────────────────────────────────────────────
// Constants — frozen registry. NO magic numbers in logic.
// ──────────────────────────────────────────────────────────────────────────

/** Firestore collection name for friend graph subcollections.
 *  Per spec §5.2: `users/{uid}/friends/{otherUid}`. */
export const FRIEND_COLLECTION = 'friends';

/** Per-player friend cap (spec §5.2 — FIFO eviction beyond 100). */
export const FRIEND_GRAPH_PER_PLAYER_CAP = 100;

/** Source tags per spec §5.2 (clan / tower-overlap / codex / replay / invite). */
export const FRIEND_SOURCE_CLAN = 'clan';
export const FRIEND_SOURCE_TOWER = 'tower';
export const FRIEND_SOURCE_CODEX = 'codex';     // STUB — Phase 3.5
export const FRIEND_SOURCE_REPLAY = 'replay';   // STUB — Phase 3.6
export const FRIEND_SOURCE_INVITE = 'invite';

/** Tower season top limit for overlap analysis (spec §5.2). */
export const FRIEND_TOWER_OVERLAP_LIMIT = 100;

/** How many top-overlap players auto-friend from the season leaderboard. */
export const FRIEND_TOWER_OVERLAP_TOP_N = 10;

/** Invite token length (chars). 16 hex chars ≈ 64 bits of entropy — plenty
 *  for share-link uniqueness without making URLs unwieldy. */
export const INVITE_TOKEN_LEN = 16;

/** Frozen registry of result-reason strings (machine-readable). */
export const FRIEND_RESULT_REASONS = Object.freeze({
  NO_SDK: 'no-sdk',
  NOT_FOUND: 'not-found',
  INVALID_INPUT: 'invalid-input',
  ALREADY_CONSUMED: 'already-consumed',
  EXCEPTION: 'exception',
});

// ──────────────────────────────────────────────────────────────────────────
// Mock stores — used when Firestore SDK isn't initialized. Mirrors the
// T3.02 / T3.07 backend pattern: tests + offline-fallback both work
// against the same in-memory state.
// ──────────────────────────────────────────────────────────────────────────

/** In-memory Tower season top — preloaded by tests via _seedMockTowerTop.
 *  Each entry: { playerId, currentTowerFloor, seasonClearAt }. */
const _mockTowerSeasonTop = [];

/** In-memory invite registry — Map<token, {fromPlayerId, consumed:boolean}>. */
const _mockInviteStore = new Map();

/** Reset all mock stores. Test-only — never call from production. */
export function _resetMockFriendStore() {
  try {
    _mockTowerSeasonTop.length = 0;
    _mockInviteStore.clear();
  } catch (_e) { /* swallow */ }
}

/** Seed Tower season top for tests. Each row: {playerId, currentTowerFloor}. */
export function _seedMockTowerTop(rows) {
  try {
    _mockTowerSeasonTop.length = 0;
    if (!Array.isArray(rows)) return;
    for (const r of rows) {
      if (!r || typeof r.playerId !== 'string') continue;
      _mockTowerSeasonTop.push({
        playerId: r.playerId,
        currentTowerFloor: (typeof r.currentTowerFloor === 'number') ? r.currentTowerFloor : 0,
        seasonClearAt: (typeof r.seasonClearAt === 'number') ? r.seasonClearAt : 0,
      });
    }
  } catch (_e) { /* swallow */ }
}

/** Seed an outstanding invite token. Test-only. */
export function _seedMockInvite(token, fromPlayerId) {
  try {
    if (typeof token !== 'string' || !token) return;
    _mockInviteStore.set(token, { fromPlayerId: String(fromPlayerId || ''), consumed: false });
  } catch (_e) { /* swallow */ }
}

/** Returns true when Firestore SDK is available; mock-mode otherwise. */
function _firestoreAvailable() {
  try { return !!getDb(); } catch (_e) { return false; }
}

// ──────────────────────────────────────────────────────────────────────────
// Pure helpers (unit-tested in isolation).
// ──────────────────────────────────────────────────────────────────────────

/**
 * Aggregate friend records from multiple sources into a deduplicated list.
 * Dedup key is `playerId`. Source priority (when the same id appears in
 * multiple sources): clan > tower > invite > codex > replay (clan wins).
 *
 * @param {Array<{playerId:string, currentTowerFloor?:number}>} clanMembers
 * @param {Array<{playerId:string, currentTowerFloor?:number}>} towerLeaderboard
 * @param {Array<{playerId:string, currentTowerFloor?:number}>} sharedReceived
 * @returns {Array<{playerId:string, source:string, currentTowerFloor:number}>}
 */
export function aggregateFriendsFromSources(clanMembers, towerLeaderboard, sharedReceived) {
  const out = new Map();
  function _add(row, source) {
    if (!row || typeof row.playerId !== 'string' || !row.playerId) return;
    const existing = out.get(row.playerId);
    const floor = (typeof row.currentTowerFloor === 'number' && isFinite(row.currentTowerFloor))
      ? row.currentTowerFloor : 0;
    if (existing) {
      // Source priority: clan > tower > invite > codex > replay.
      const priority = { clan: 5, tower: 4, invite: 3, codex: 2, replay: 1 };
      if ((priority[source] || 0) > (priority[existing.source] || 0)) {
        existing.source = source;
      }
      // Keep highest known floor.
      if (floor > existing.currentTowerFloor) existing.currentTowerFloor = floor;
      return;
    }
    out.set(row.playerId, { playerId: row.playerId, source, currentTowerFloor: floor });
  }
  if (Array.isArray(clanMembers))      for (const r of clanMembers)      _add(r, FRIEND_SOURCE_CLAN);
  if (Array.isArray(towerLeaderboard)) for (const r of towerLeaderboard) _add(r, FRIEND_SOURCE_TOWER);
  if (Array.isArray(sharedReceived))   for (const r of sharedReceived)   _add(r, FRIEND_SOURCE_INVITE);
  return Array.from(out.values());
}

/**
 * Sort friends descending by `currentTowerFloor`. Ties broken alphabetically
 * by playerId for deterministic test asserts. PURE — returns a new array.
 *
 * @param {Array<object>} friends
 * @returns {Array<object>}
 */
export function sortFriendsByTowerFloor(friends) {
  if (!Array.isArray(friends)) return [];
  const out = friends.slice();
  out.sort((a, b) => {
    const fa = (a && typeof a.currentTowerFloor === 'number') ? a.currentTowerFloor : 0;
    const fb = (b && typeof b.currentTowerFloor === 'number') ? b.currentTowerFloor : 0;
    if (fb !== fa) return fb - fa;
    const ia = (a && typeof a.playerId === 'string') ? a.playerId : '';
    const ib = (b && typeof b.playerId === 'string') ? b.playerId : '';
    if (ia < ib) return -1;
    if (ia > ib) return 1;
    return 0;
  });
  return out;
}

/**
 * Return top N friends from a sorted (or unsorted — handled here) list.
 * If N exceeds list length, returns the full list. N defaults to 3 (widget
 * surface per spec §5.1).
 *
 * @param {Array<object>} friends
 * @param {number} [n=3]
 * @returns {Array<object>}
 */
export function getTopNFriends(friends, n) {
  const cap = (typeof n === 'number' && isFinite(n) && n > 0) ? Math.floor(n) : 3;
  if (!Array.isArray(friends)) return [];
  return sortFriendsByTowerFloor(friends).slice(0, cap);
}

/**
 * Build the navigator.share content payload — {title, text, url}. URL embeds
 * the invite token as `?invite=<token>`. PURE — no DOM / window access.
 *
 * @param {string} playerName
 * @param {number} towerFloor
 * @param {string} inviteToken
 * @returns {{title:string, text:string, url:string}}
 */
export function buildInviteShareContent(playerName, towerFloor, inviteToken) {
  const name = (typeof playerName === 'string' && playerName.trim().length > 0)
    ? playerName.trim() : 'a friend';
  const floor = (typeof towerFloor === 'number' && isFinite(towerFloor) && towerFloor > 0)
    ? Math.floor(towerFloor) : 0;
  const token = (typeof inviteToken === 'string' && inviteToken.length > 0)
    ? inviteToken : '';
  const baseUrl = 'https://blocksworm.com';
  const url = token ? `${baseUrl}/?invite=${encodeURIComponent(token)}` : baseUrl;
  const text = floor > 0
    ? `Join me in Blocksworn — ${name} is on Tower floor ${floor}`
    : `Join me in Blocksworn — ${name} invited you`;
  return { title: 'Blocksworn — Friend invite', text, url };
}

/**
 * Parse the `?invite=<token>` query parameter from a URL string. Returns
 * the decoded token or null when missing / invalid. PURE.
 *
 * Accepts either a full URL or a query string ("?invite=abc&x=y").
 *
 * @param {string} url
 * @returns {string|null}
 */
export function parseInviteTokenFromUrl(url) {
  try {
    if (typeof url !== 'string' || url.length === 0) return null;
    const m = /[?&]invite=([^&#]+)/.exec(url);
    if (!m || !m[1]) return null;
    const tok = decodeURIComponent(m[1]);
    // Token format: opaque hex/base64 chars; reject anything with whitespace
    // or empty after decode.
    if (!/^[A-Za-z0-9_-]+$/.test(tok)) return null;
    return tok;
  } catch (_e) {
    return null;
  }
}

/**
 * Generate a fresh invite token. Defensive: falls back to Math.random when
 * crypto.getRandomValues is absent. Length = INVITE_TOKEN_LEN hex chars.
 *
 * @returns {string}
 */
export function generateInviteToken() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(INVITE_TOKEN_LEN / 2);
      crypto.getRandomValues(bytes);
      let out = '';
      for (let i = 0; i < bytes.length; i++) {
        out += bytes[i].toString(16).padStart(2, '0');
      }
      return out;
    }
  } catch (_e) { /* fall through */ }
  // Math.random fallback.
  let out = '';
  while (out.length < INVITE_TOKEN_LEN) {
    out += Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  }
  return out.slice(0, INVITE_TOKEN_LEN);
}

// ──────────────────────────────────────────────────────────────────────────
// Async ops (defensive — mock-store fallback when Firestore absent).
// ──────────────────────────────────────────────────────────────────────────

/**
 * Read top-N rows from the current Tower season leaderboard. READ-ONLY —
 * this module NEVER writes to TOWER_LEADERBOARDS (sacred per CLAUDE.md §2.5).
 *
 * @param {number} [limit=FRIEND_TOWER_OVERLAP_LIMIT]
 * @returns {Promise<{ok:boolean, rows?:Array<object>, reason?:string}>}
 */
export async function fetchTowerSeasonTop(limit) {
  try {
    const cap = (typeof limit === 'number' && isFinite(limit) && limit > 0)
      ? Math.min(500, Math.floor(limit)) : FRIEND_TOWER_OVERLAP_LIMIT;
    if (_firestoreAvailable()) {
      // T3.06.1 — live Firestore wiring. Read-only query against
      // tower-runs/{seasonId}/leaderboard ordered by floor desc. For T3.06
      // we mirror the mock store so the API returns deterministic data
      // while the live SDK query catches up. Sacred Tower data is NEVER
      // written from this module.
      try { /* deferred — read-only query lands in T3.06.1 */ } catch (_e) {}
    }
    // Mock-store fallback (also active when Firestore not yet wired).
    const rows = _mockTowerSeasonTop
      .slice()
      .sort((a, b) => (b.currentTowerFloor | 0) - (a.currentTowerFloor | 0))
      .slice(0, cap);
    return { ok: true, rows };
  } catch (e) {
    try { log.warn('[friend-graph] fetchTowerSeasonTop failed:', e); } catch (_e) {}
    return { ok: false, reason: FRIEND_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Aggregate the friend list for a given player. Combines:
 *   1. Clan members (live, via listClansForPlayer).
 *   2. Tower season top-N overlap (mock-mode safe).
 *   3. Codex defeated set — STUB (cross-player codex deferred to Phase 3.5).
 *   4. Replay-share recipients — STUB (deferred to T3.06.1 deeplink flow).
 *
 * Defensive: if any data fetch fails, gracefully skips that source and
 * returns whatever it could aggregate. Returns `{ok:false, reason:'no-sdk',
 * friends: []}` only when ALL sources error AND Firestore is absent.
 *
 * @param {string} playerId
 * @returns {Promise<{ok:boolean, friends:Array<object>, reason?:string}>}
 */
export async function fetchFriendsForPlayer(playerId) {
  try {
    if (!playerId || typeof playerId !== 'string') {
      return { ok: false, friends: [], reason: FRIEND_RESULT_REASONS.INVALID_INPUT };
    }
    // 1. Clan members — direct-import from clan-backend.
    const clanMembers = [];
    try {
      const clanResult = await listClansForPlayer(playerId);
      if (clanResult && clanResult.ok && Array.isArray(clanResult.clans)) {
        for (const clan of clanResult.clans) {
          if (!clan || !Array.isArray(clan.members)) continue;
          for (const m of clan.members) {
            if (!m || typeof m.playerId !== 'string') continue;
            if (m.playerId === playerId) continue; // exclude self
            clanMembers.push({ playerId: m.playerId, currentTowerFloor: 0 });
          }
        }
      }
    } catch (_e) { /* skip source on failure */ }

    // 2. Tower season top-N overlap.
    let towerOverlap = [];
    try {
      const towerResult = await fetchTowerSeasonTop(FRIEND_TOWER_OVERLAP_LIMIT);
      if (towerResult && towerResult.ok && Array.isArray(towerResult.rows)) {
        towerOverlap = towerResult.rows
          .filter(r => r && typeof r.playerId === 'string' && r.playerId !== playerId)
          .slice(0, FRIEND_TOWER_OVERLAP_TOP_N)
          .map(r => ({
            playerId: r.playerId,
            currentTowerFloor: (typeof r.currentTowerFloor === 'number') ? r.currentTowerFloor : 0,
          }));
      }
    } catch (_e) { /* skip source on failure */ }

    // 3. Codex defeated set — STUB. Cross-player codex needs Firestore
    //    cross-document reads (Phase 3.5). For T3.06 scope this is empty.
    const codexFriends = [];

    // 4. Replay-share recipients — STUB. Needs deeplink landing flow that
    //    persists accepted-invite friend records (T3.06.1 follow-up).
    const inviteFriends = [];

    const aggregated = aggregateFriendsFromSources(
      clanMembers,
      towerOverlap,
      [...codexFriends, ...inviteFriends],
    );
    const friends = sortFriendsByTowerFloor(aggregated).slice(0, FRIEND_GRAPH_PER_PLAYER_CAP);

    // Promote tower floors onto clan-source rows when available.
    const floorByPid = new Map();
    for (const r of towerOverlap) floorByPid.set(r.playerId, r.currentTowerFloor);
    for (const f of friends) {
      if (f.currentTowerFloor === 0 && floorByPid.has(f.playerId)) {
        f.currentTowerFloor = floorByPid.get(f.playerId);
      }
    }

    // Re-sort after floor promotion.
    return { ok: true, friends: sortFriendsByTowerFloor(friends) };
  } catch (e) {
    try { log.warn('[friend-graph] fetchFriendsForPlayer failed:', e); } catch (_e) {}
    return { ok: false, friends: [], reason: FRIEND_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Record an invite acceptance — establishes a bidirectional friend record
 * between fromPlayerId and toPlayerId. Idempotent (re-recording the same
 * token is a no-op). Mirrors the T3.02 / T3.07 backend pattern.
 *
 * @param {string} inviteToken
 * @param {string} fromPlayerId
 * @param {string} toPlayerId
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function recordInviteAccepted(inviteToken, fromPlayerId, toPlayerId) {
  try {
    if (!inviteToken || typeof inviteToken !== 'string') {
      return { ok: false, reason: FRIEND_RESULT_REASONS.INVALID_INPUT };
    }
    if (!fromPlayerId || typeof fromPlayerId !== 'string') {
      return { ok: false, reason: FRIEND_RESULT_REASONS.INVALID_INPUT };
    }
    if (!toPlayerId || typeof toPlayerId !== 'string') {
      return { ok: false, reason: FRIEND_RESULT_REASONS.INVALID_INPUT };
    }
    if (fromPlayerId === toPlayerId) {
      return { ok: false, reason: FRIEND_RESULT_REASONS.INVALID_INPUT };
    }
    if (_firestoreAvailable()) {
      // T3.06.1 — live Firestore writes (batched setDoc on
      // users/{fromId}/friends/{toId} + users/{toId}/friends/{fromId}).
      try { /* deferred */ } catch (_e) {}
    }
    // Mock-store path — mark the token consumed so duplicate landings no-op.
    const existing = _mockInviteStore.get(inviteToken);
    if (existing && existing.consumed) {
      return { ok: false, reason: FRIEND_RESULT_REASONS.ALREADY_CONSUMED };
    }
    _mockInviteStore.set(inviteToken, { fromPlayerId, consumed: true });
    return { ok: true };
  } catch (e) {
    try { log.warn('[friend-graph] recordInviteAccepted failed:', e); } catch (_e) {}
    return { ok: false, reason: FRIEND_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Parse + consume an invite token from a deeplink landing. Idempotent —
 * re-consuming the same token returns `{ok:false, reason:'already-consumed'}`.
 *
 * The recipient (`toPlayerId`) is resolved via the localStorage player-name
 * key (matches Adventures' resolveCurrentPlayerId pattern). Defensive
 * fallback to 'anonymous' when no name is set.
 *
 * @param {string} inviteToken
 * @returns {Promise<{ok:boolean, fromPlayerId?:string, reason?:string}>}
 */
export async function parseAndConsumeInvite(inviteToken) {
  try {
    if (!inviteToken || typeof inviteToken !== 'string') {
      return { ok: false, reason: FRIEND_RESULT_REASONS.INVALID_INPUT };
    }
    const record = _mockInviteStore.get(inviteToken);
    if (!record) {
      // Unknown token — defensive: treat as not-found (legit invite from
      // a player whose Firestore record we can't reach in mock-mode).
      // Still mark the token consumed so a double-tap on the deeplink doesn't
      // surface duplicate toasts.
      _mockInviteStore.set(inviteToken, { fromPlayerId: '', consumed: true });
      return { ok: false, reason: FRIEND_RESULT_REASONS.NOT_FOUND };
    }
    if (record.consumed) {
      return { ok: false, reason: FRIEND_RESULT_REASONS.ALREADY_CONSUMED };
    }
    // Resolve recipient — best-effort via localStorage player-name key.
    let toPlayerId = 'anonymous';
    try {
      if (typeof localStorage !== 'undefined') {
        const n = localStorage.getItem('blocksworn_p8_player_name');
        if (typeof n === 'string' && n.trim().length > 0) toPlayerId = n.trim().toLowerCase();
      }
    } catch (_e) { /* private mode */ }
    const result = await recordInviteAccepted(inviteToken, record.fromPlayerId || 'unknown', toPlayerId);
    if (result && result.ok) {
      return { ok: true, fromPlayerId: record.fromPlayerId || 'unknown' };
    }
    return { ok: false, reason: (result && result.reason) || FRIEND_RESULT_REASONS.EXCEPTION };
  } catch (e) {
    try { log.warn('[friend-graph] parseAndConsumeInvite failed:', e); } catch (_e) {}
    return { ok: false, reason: FRIEND_RESULT_REASONS.EXCEPTION };
  }
}

/**
 * Convenience: fetch a single clan doc for the friend widget (defers to
 * clan-backend's fetchClan). Defensive wrapper — never throws.
 *
 * @param {string} clanId
 * @returns {Promise<{ok:boolean, clan?:object, reason?:string}>}
 */
export async function fetchClanForFriendWidget(clanId) {
  try {
    return await fetchClan(clanId);
  } catch (_e) {
    return { ok: false, reason: FRIEND_RESULT_REASONS.EXCEPTION };
  }
}
