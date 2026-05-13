// 2026-05-13 — TASK-054 (T3.06): Friend leaderboard mini-block — unit tests.
//
// Spec: docs/design/endgame-social.md §5 (Friend leaderboard mini-block)
//       + §15 ESC-03 Q5 — navigator.share OS-native only.
//
// Coverage strategy: Vitest runs in `node` env. We mock `globalThis.localStorage`
// (mirrors adventures-ui.test.js precedent) and `globalThis.document` (minimal
// DOM shim). Backend pure helpers tested directly; UI helpers tested via
// __friendLeaderboardTestables._widgetHTML / _fullListHTML.
//
// Surface tested:
//   - aggregateFriendsFromSources — empty / clan-only / tower-only / both
//   - sortFriendsByTowerFloor — descending + alphabetical tiebreak
//   - getTopNFriends — top-3 / oversized N / empty
//   - buildInviteShareContent — {title, text, url} shape + token encoding
//   - parseInviteTokenFromUrl — valid / invalid / missing
//   - generateInviteToken — length + hex chars
//   - fetchTowerSeasonTop — mock-store ordering + limit
//   - fetchFriendsForPlayer — clan-only / tower-only / combined / no-sdk
//   - recordInviteAccepted — single + idempotent + already-consumed
//   - parseAndConsumeInvite — valid / unknown / already-consumed
//   - resolveCurrentPlayerId — localStorage roundtrip + anonymous fallback
//   - UI _widgetHTML — empty / populated / top-3 shape + medal classes
//   - UI _fullListHTML — empty / populated + "you" badge
//   - Sacred audit — TOWER_LEADERBOARDS read-only, no spend-based sort,
//     no P2W, clan-backend public API unchanged.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  aggregateFriendsFromSources,
  sortFriendsByTowerFloor,
  getTopNFriends,
  buildInviteShareContent,
  parseInviteTokenFromUrl,
  generateInviteToken,
  fetchTowerSeasonTop,
  fetchFriendsForPlayer,
  recordInviteAccepted,
  parseAndConsumeInvite,
  FRIEND_SOURCE_CLAN,
  FRIEND_SOURCE_TOWER,
  FRIEND_SOURCE_INVITE,
  FRIEND_RESULT_REASONS,
  FRIEND_GRAPH_PER_PLAYER_CAP,
  INVITE_TOKEN_LEN,
  _resetMockFriendStore,
  _seedMockTowerTop,
  _seedMockInvite,
} from '../../src/services/friend-graph-backend.js';
import {
  __friendLeaderboardTestables,
  resolveCurrentPlayerId,
} from '../../src/ui/friend-leaderboard.js';
import {
  _resetMockClanStore,
  _seedMockClan,
  CLAN_MAX_SIZE,
  CLAN_ROLE_OWNER,
  CLAN_ROLE_MEMBER,
} from '../../src/services/clan-backend.js';

// ─── localStorage shim ─────────────────────────────────────────────────
function createMockLocalStorage() {
  const store = Object.create(null);
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    clear() { for (const x of Object.keys(store)) delete store[x]; },
  };
}

let _origLocalStorage;
beforeEach(() => {
  _origLocalStorage = globalThis.localStorage;
  globalThis.localStorage = createMockLocalStorage();
  _resetMockFriendStore();
  _resetMockClanStore();
  __friendLeaderboardTestables.reset();
});
afterEach(() => {
  if (_origLocalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = _origLocalStorage;
  _resetMockFriendStore();
  _resetMockClanStore();
  __friendLeaderboardTestables.reset();
});

// Helper — build a clan doc for fetchFriendsForPlayer tests.
function buildClanDoc(overrides) {
  const base = {
    clanId: 'clan-x',
    name: 'The Ironbound',
    description: '',
    ownerId: 'roman',
    members: [
      { playerId: 'roman', joinedAt: 1700000000000, role: CLAN_ROLE_OWNER,  isActive: true },
      { playerId: 'blok',  joinedAt: 1700000100000, role: CLAN_ROLE_MEMBER, isActive: true },
      { playerId: 'kira',  joinedAt: 1700000200000, role: CLAN_ROLE_MEMBER, isActive: true },
    ],
    maxSize: CLAN_MAX_SIZE,
    weeklyTargetId: null,
    weeklyContributions: {},
    weekStartedAt: 1700000000000,
    weekDefeated: false,
    totalWeeksCompleted: 0,
    clanLevel: 1,
    cosmetics: { bannerTier: 'wood', emblemUnlocks: [], badgeUnlocks: [] },
    createdAt: 1700000000000,
    updatedAt: 1700000200000,
  };
  return Object.assign(base, overrides || {});
}

// ═══════════════════════════════════════════════════════════════════════
// aggregateFriendsFromSources
// ═══════════════════════════════════════════════════════════════════════

describe('aggregateFriendsFromSources (T3.06)', () => {
  it('empty inputs → empty list', () => {
    expect(aggregateFriendsFromSources([], [], [])).toEqual([]);
  });

  it('clan-only → clan-source rows', () => {
    const out = aggregateFriendsFromSources(
      [{ playerId: 'a' }, { playerId: 'b' }],
      [], [],
    );
    expect(out.length).toBe(2);
    expect(out.every(r => r.source === FRIEND_SOURCE_CLAN)).toBe(true);
  });

  it('tower-only → tower-source rows with floor', () => {
    const out = aggregateFriendsFromSources(
      [],
      [{ playerId: 'a', currentTowerFloor: 42 }],
      [],
    );
    expect(out[0].source).toBe(FRIEND_SOURCE_TOWER);
    expect(out[0].currentTowerFloor).toBe(42);
  });

  it('combined sources → deduped union', () => {
    const out = aggregateFriendsFromSources(
      [{ playerId: 'a' }, { playerId: 'b' }],
      [{ playerId: 'b', currentTowerFloor: 10 }, { playerId: 'c', currentTowerFloor: 5 }],
      [{ playerId: 'd' }],
    );
    const ids = out.map(r => r.playerId).sort();
    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });

  it('clan priority over tower when same playerId', () => {
    const out = aggregateFriendsFromSources(
      [{ playerId: 'b' }],
      [{ playerId: 'b', currentTowerFloor: 10 }],
      [],
    );
    expect(out.length).toBe(1);
    expect(out[0].source).toBe(FRIEND_SOURCE_CLAN);
    expect(out[0].currentTowerFloor).toBe(10); // floor preserved
  });

  it('defensive: malformed entries skipped', () => {
    const out = aggregateFriendsFromSources(
      [null, { playerId: '' }, { playerId: 'a' }, undefined],
      [{ wrongShape: true }],
      [],
    );
    expect(out.length).toBe(1);
    expect(out[0].playerId).toBe('a');
  });

  it('non-array inputs → empty', () => {
    expect(aggregateFriendsFromSources(null, undefined, 'nope')).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// sortFriendsByTowerFloor
// ═══════════════════════════════════════════════════════════════════════

describe('sortFriendsByTowerFloor (T3.06)', () => {
  it('descending by tower floor', () => {
    const out = sortFriendsByTowerFloor([
      { playerId: 'a', currentTowerFloor: 5 },
      { playerId: 'b', currentTowerFloor: 42 },
      { playerId: 'c', currentTowerFloor: 10 },
    ]);
    expect(out.map(r => r.playerId)).toEqual(['b', 'c', 'a']);
  });

  it('ties broken alphabetically by playerId', () => {
    const out = sortFriendsByTowerFloor([
      { playerId: 'zebra',  currentTowerFloor: 10 },
      { playerId: 'apple',  currentTowerFloor: 10 },
      { playerId: 'mango',  currentTowerFloor: 10 },
    ]);
    expect(out.map(r => r.playerId)).toEqual(['apple', 'mango', 'zebra']);
  });

  it('non-array → empty', () => {
    expect(sortFriendsByTowerFloor(null)).toEqual([]);
  });

  it('does not mutate input', () => {
    const input = [
      { playerId: 'a', currentTowerFloor: 1 },
      { playerId: 'b', currentTowerFloor: 99 },
    ];
    const snap = JSON.parse(JSON.stringify(input));
    sortFriendsByTowerFloor(input);
    expect(input).toEqual(snap);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// getTopNFriends
// ═══════════════════════════════════════════════════════════════════════

describe('getTopNFriends (T3.06)', () => {
  it('default top-3', () => {
    const out = getTopNFriends([
      { playerId: 'a', currentTowerFloor: 1 },
      { playerId: 'b', currentTowerFloor: 2 },
      { playerId: 'c', currentTowerFloor: 3 },
      { playerId: 'd', currentTowerFloor: 4 },
    ]);
    expect(out.length).toBe(3);
    expect(out.map(r => r.playerId)).toEqual(['d', 'c', 'b']);
  });

  it('N > list length returns full list', () => {
    const out = getTopNFriends([{ playerId: 'a', currentTowerFloor: 1 }], 5);
    expect(out.length).toBe(1);
  });

  it('empty list → empty', () => {
    expect(getTopNFriends([], 3)).toEqual([]);
  });

  it('non-positive N defaults to 3', () => {
    const out = getTopNFriends(
      [
        { playerId: 'a', currentTowerFloor: 1 },
        { playerId: 'b', currentTowerFloor: 2 },
        { playerId: 'c', currentTowerFloor: 3 },
        { playerId: 'd', currentTowerFloor: 4 },
      ],
      0,
    );
    expect(out.length).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// buildInviteShareContent
// ═══════════════════════════════════════════════════════════════════════

describe('buildInviteShareContent (T3.06)', () => {
  it('returns {title, text, url}', () => {
    const c = buildInviteShareContent('roman', 42, 'abc123');
    expect(c).toHaveProperty('title');
    expect(c).toHaveProperty('text');
    expect(c).toHaveProperty('url');
    expect(c.url).toContain('invite=abc123');
    expect(c.text).toContain('roman');
    expect(c.text).toContain('42');
  });

  it('handles missing player name', () => {
    const c = buildInviteShareContent('', 10, 'tok');
    expect(c.text).toContain('a friend');
  });

  it('handles missing tower floor', () => {
    const c = buildInviteShareContent('roman', 0, 'tok');
    expect(c.text).not.toContain('floor 0');
    expect(c.text).toContain('invited you');
  });

  it('handles missing token (no invite param)', () => {
    const c = buildInviteShareContent('roman', 10, '');
    expect(c.url).not.toContain('invite=');
  });

  it('URL-encodes special chars in token', () => {
    const c = buildInviteShareContent('roman', 10, 'tok with space');
    expect(c.url).toContain('invite=tok%20with%20space');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// parseInviteTokenFromUrl
// ═══════════════════════════════════════════════════════════════════════

describe('parseInviteTokenFromUrl (T3.06)', () => {
  it('extracts token from full URL', () => {
    expect(parseInviteTokenFromUrl('https://blocksworm.com/?invite=abc123')).toBe('abc123');
  });

  it('extracts token from query string only', () => {
    expect(parseInviteTokenFromUrl('?invite=xyz')).toBe('xyz');
  });

  it('returns null for missing param', () => {
    expect(parseInviteTokenFromUrl('https://blocksworm.com/')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseInviteTokenFromUrl('')).toBeNull();
    expect(parseInviteTokenFromUrl(null)).toBeNull();
  });

  it('extracts token alongside other params', () => {
    expect(parseInviteTokenFromUrl('?x=y&invite=tok&z=w')).toBe('tok');
  });

  it('rejects invalid token chars', () => {
    expect(parseInviteTokenFromUrl('?invite=tok with space')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// generateInviteToken
// ═══════════════════════════════════════════════════════════════════════

describe('generateInviteToken (T3.06)', () => {
  it('produces token of INVITE_TOKEN_LEN chars', () => {
    const t = generateInviteToken();
    expect(t.length).toBe(INVITE_TOKEN_LEN);
  });

  it('produces tokens with valid charset', () => {
    const t = generateInviteToken();
    expect(/^[A-Za-z0-9_-]+$/.test(t)).toBe(true);
  });

  it('produces unique tokens across calls', () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).not.toBe(b);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// fetchTowerSeasonTop
// ═══════════════════════════════════════════════════════════════════════

describe('fetchTowerSeasonTop (T3.06)', () => {
  it('returns sorted by tower floor desc', async () => {
    _seedMockTowerTop([
      { playerId: 'a', currentTowerFloor: 10 },
      { playerId: 'b', currentTowerFloor: 50 },
      { playerId: 'c', currentTowerFloor: 30 },
    ]);
    const r = await fetchTowerSeasonTop();
    expect(r.ok).toBe(true);
    expect(r.rows.map(x => x.playerId)).toEqual(['b', 'c', 'a']);
  });

  it('respects limit', async () => {
    _seedMockTowerTop([
      { playerId: 'a', currentTowerFloor: 10 },
      { playerId: 'b', currentTowerFloor: 50 },
      { playerId: 'c', currentTowerFloor: 30 },
    ]);
    const r = await fetchTowerSeasonTop(2);
    expect(r.rows.length).toBe(2);
  });

  it('empty store → empty rows', async () => {
    const r = await fetchTowerSeasonTop();
    expect(r.ok).toBe(true);
    expect(r.rows).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// fetchFriendsForPlayer
// ═══════════════════════════════════════════════════════════════════════

describe('fetchFriendsForPlayer (T3.06)', () => {
  it('invalid playerId → invalid-input', async () => {
    const r = await fetchFriendsForPlayer('');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(FRIEND_RESULT_REASONS.INVALID_INPUT);
    expect(r.friends).toEqual([]);
  });

  it('no data sources → empty friends, ok:true', async () => {
    const r = await fetchFriendsForPlayer('roman');
    expect(r.ok).toBe(true);
    expect(r.friends).toEqual([]);
  });

  it('clan members aggregate (excluding self)', async () => {
    _seedMockClan('clan-x', buildClanDoc({ clanId: 'clan-x' }));
    const r = await fetchFriendsForPlayer('roman');
    expect(r.ok).toBe(true);
    const ids = r.friends.map(f => f.playerId).sort();
    expect(ids).toEqual(['blok', 'kira']);
  });

  it('tower season overlap excludes self', async () => {
    _seedMockTowerTop([
      { playerId: 'roman',  currentTowerFloor: 99 },
      { playerId: 'blok',   currentTowerFloor: 42 },
      { playerId: 'kira',   currentTowerFloor: 35 },
    ]);
    const r = await fetchFriendsForPlayer('roman');
    expect(r.ok).toBe(true);
    const ids = r.friends.map(f => f.playerId);
    expect(ids).not.toContain('roman');
    expect(ids).toContain('blok');
    expect(ids).toContain('kira');
  });

  it('combined clan + tower → tower floor promoted onto clan member', async () => {
    _seedMockClan('clan-x', buildClanDoc({ clanId: 'clan-x' }));
    _seedMockTowerTop([
      { playerId: 'blok', currentTowerFloor: 42 },
    ]);
    const r = await fetchFriendsForPlayer('roman');
    const blok = r.friends.find(f => f.playerId === 'blok');
    expect(blok).toBeDefined();
    expect(blok.currentTowerFloor).toBe(42);
  });

  it('friends list capped at FRIEND_GRAPH_PER_PLAYER_CAP', async () => {
    // Create more rows than the cap allows.
    const rows = [];
    for (let i = 0; i < FRIEND_GRAPH_PER_PLAYER_CAP + 10; i++) {
      rows.push({ playerId: `player${i}`, currentTowerFloor: i });
    }
    _seedMockTowerTop(rows);
    const r = await fetchFriendsForPlayer('roman');
    expect(r.ok).toBe(true);
    expect(r.friends.length).toBeLessThanOrEqual(FRIEND_GRAPH_PER_PLAYER_CAP);
  });

  it('friends sorted descending by floor', async () => {
    _seedMockTowerTop([
      { playerId: 'a', currentTowerFloor: 5 },
      { playerId: 'b', currentTowerFloor: 42 },
      { playerId: 'c', currentTowerFloor: 10 },
    ]);
    const r = await fetchFriendsForPlayer('roman');
    const floors = r.friends.map(f => f.currentTowerFloor);
    expect(floors).toEqual([...floors].sort((x, y) => y - x));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// recordInviteAccepted + parseAndConsumeInvite
// ═══════════════════════════════════════════════════════════════════════

describe('recordInviteAccepted (T3.06)', () => {
  it('accepts a valid bidirectional friend record', async () => {
    const r = await recordInviteAccepted('token-1', 'alice', 'bob');
    expect(r.ok).toBe(true);
  });

  it('rejects invalid inputs', async () => {
    expect((await recordInviteAccepted('', 'a', 'b')).ok).toBe(false);
    expect((await recordInviteAccepted('t', '', 'b')).ok).toBe(false);
    expect((await recordInviteAccepted('t', 'a', '')).ok).toBe(false);
  });

  it('rejects self-invite', async () => {
    const r = await recordInviteAccepted('t', 'alice', 'alice');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(FRIEND_RESULT_REASONS.INVALID_INPUT);
  });

  it('idempotent — re-recording same token blocks with already-consumed', async () => {
    await recordInviteAccepted('tok-x', 'alice', 'bob');
    const second = await recordInviteAccepted('tok-x', 'alice', 'bob');
    expect(second.ok).toBe(false);
    expect(second.reason).toBe(FRIEND_RESULT_REASONS.ALREADY_CONSUMED);
  });
});

describe('parseAndConsumeInvite (T3.06)', () => {
  it('consumes a seeded invite token', async () => {
    _seedMockInvite('valid-tok', 'alice');
    const r = await parseAndConsumeInvite('valid-tok');
    expect(r.ok).toBe(true);
    expect(r.fromPlayerId).toBe('alice');
  });

  it('rejects empty token', async () => {
    const r = await parseAndConsumeInvite('');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(FRIEND_RESULT_REASONS.INVALID_INPUT);
  });

  it('unknown token → not-found', async () => {
    const r = await parseAndConsumeInvite('does-not-exist');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(FRIEND_RESULT_REASONS.NOT_FOUND);
  });

  it('idempotent — second parse returns already-consumed', async () => {
    _seedMockInvite('tok-y', 'alice');
    await parseAndConsumeInvite('tok-y');
    const second = await parseAndConsumeInvite('tok-y');
    expect(second.ok).toBe(false);
    expect(second.reason).toBe(FRIEND_RESULT_REASONS.ALREADY_CONSUMED);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// resolveCurrentPlayerId
// ═══════════════════════════════════════════════════════════════════════

describe('resolveCurrentPlayerId (T3.06)', () => {
  it('returns anonymous when no name', () => {
    expect(resolveCurrentPlayerId()).toBe('anonymous');
  });

  it('returns lowercased trimmed name when present', () => {
    globalThis.localStorage.setItem('blocksworn_p8_player_name', '  ROMAN  ');
    expect(resolveCurrentPlayerId()).toBe('roman');
  });

  it('falls back when localStorage missing', () => {
    delete globalThis.localStorage;
    expect(() => resolveCurrentPlayerId()).not.toThrow();
    expect(resolveCurrentPlayerId()).toBe('anonymous');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// UI HTML builders (via __friendLeaderboardTestables)
// ═══════════════════════════════════════════════════════════════════════

describe('friend leaderboard widget HTML (T3.06)', () => {
  it('empty state renders empty CTA', () => {
    const html = __friendLeaderboardTestables._widgetHTML([]);
    expect(html).toContain("FRIENDS' TOWER RUNS");
    expect(html).toContain('No friends yet');
    expect(html).toContain('friendInviteEmptyBtn');
  });

  it('populated state renders top 3 with medals', () => {
    const friends = [
      { playerId: 'roman',  currentTowerFloor: 50, source: 'tower' },
      { playerId: 'blok',   currentTowerFloor: 35, source: 'clan' },
      { playerId: 'kira',   currentTowerFloor: 20, source: 'tower' },
      { playerId: 'extra',  currentTowerFloor: 10, source: 'tower' },
    ];
    const html = __friendLeaderboardTestables._widgetHTML(friends);
    expect(html).toContain('🥇');
    expect(html).toContain('🥈');
    expect(html).toContain('🥉');
    expect(html).toContain('roman');
    expect(html).toContain('Floor 50');
    expect(html).toContain('friend-row--gold');
    expect(html).toContain('friend-row--silver');
    expect(html).toContain('friend-row--bronze');
    expect(html).toContain('friendViewAllBtn');
  });

  it('shows top 3 cap even if more friends', () => {
    const friends = [
      { playerId: 'a', currentTowerFloor: 10, source: 'tower' },
      { playerId: 'b', currentTowerFloor: 20, source: 'tower' },
      { playerId: 'c', currentTowerFloor: 30, source: 'tower' },
      { playerId: 'd', currentTowerFloor: 40, source: 'tower' },
      { playerId: 'e', currentTowerFloor: 50, source: 'tower' },
    ];
    const html = __friendLeaderboardTestables._widgetHTML(friends);
    // Only top 3 rendered (d=40, e=50, c=30).
    expect(html).toContain('e</span>');
    expect(html).toContain('d</span>');
    expect(html).toContain('c</span>');
    // 'a' (lowest floor) should not appear as a row.
    expect(html.indexOf('data-friend-id="a"')).toBe(-1);
  });

  it('escapes HTML in playerId', () => {
    const friends = [
      { playerId: '<script>alert(1)</script>', currentTowerFloor: 1, source: 'tower' },
    ];
    const html = __friendLeaderboardTestables._widgetHTML(friends);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('friend leaderboard full list HTML (T3.06)', () => {
  it('empty state renders empty CTA', () => {
    const html = __friendLeaderboardTestables._fullListHTML([], 'roman');
    expect(html).toContain('FRIENDS');
    expect(html).toContain('No friends yet');
    expect(html).toContain('friendInviteEmptyBtn');
    expect(html).toContain('friendBackBtn');
  });

  it('populated renders sorted list + rank + source label', () => {
    const friends = [
      { playerId: 'roman',  currentTowerFloor: 50, source: FRIEND_SOURCE_TOWER },
      { playerId: 'blok',   currentTowerFloor: 35, source: FRIEND_SOURCE_CLAN },
      { playerId: 'kira',   currentTowerFloor: 20, source: FRIEND_SOURCE_INVITE },
    ];
    const html = __friendLeaderboardTestables._fullListHTML(friends, 'roman');
    expect(html).toContain('#1');
    expect(html).toContain('#2');
    expect(html).toContain('#3');
    expect(html).toContain('Tower');
    expect(html).toContain('Clan');
    expect(html).toContain('Invite');
    // (You) badge for viewer
    expect(html).toContain('(You)');
    // Challenge button is disabled per Phase 3.5 stub.
    expect(html).toContain('disabled');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Sacred-cow audit
// ═══════════════════════════════════════════════════════════════════════

describe('Sacred-cow audit (T3.06)', () => {
  it('TOWER_LEADERBOARDS frozen registry is unchanged + frozen', async () => {
    const towerMod = await import('../../src/data/tower.js');
    expect(Object.isFrozen(towerMod.TOWER_LEADERBOARDS)).toBe(true);
    expect(towerMod.TOWER_LEADERBOARDS.global).toBeDefined();
    expect(towerMod.TOWER_LEADERBOARDS.f2p_only).toBeDefined();
    expect(towerMod.TOWER_LEADERBOARDS.weekly_seasonal).toBeDefined();
    // PURE PATH F2P-only invariant preserved.
    expect(towerMod.TOWER_LEADERBOARDS.f2p_only.eligibility).toBe('totalSpent === 0');
  });

  it('no spend-based sort surface in module exports', async () => {
    const mod = await import('../../src/services/friend-graph-backend.js');
    const exportNames = Object.keys(mod);
    // No "sortBy" / "spend" exports — friend graph sorts by Tower floor only.
    expect(exportNames.every(k => !/spend|whale|dolphin/i.test(k))).toBe(true);
  });

  it('clan-backend public API unchanged', async () => {
    const clanMod = await import('../../src/services/clan-backend.js');
    // 17 T3.02 + 7 T3.04 + 2 T3.05 = ~26 named exports; assert key surface.
    expect(typeof clanMod.listClansForPlayer).toBe('function');
    expect(typeof clanMod.fetchClan).toBe('function');
    expect(typeof clanMod.createClan).toBe('function');
    expect(clanMod.CLAN_MIN_SIZE).toBe(5);
    expect(clanMod.CLAN_MAX_SIZE).toBe(15);
  });

  it('aggregation only uses Tower floor + playerId — no spend field', () => {
    const friends = aggregateFriendsFromSources(
      [{ playerId: 'a', currentTowerFloor: 1, totalSpend: 999, segment: 'whale' }],
      [{ playerId: 'b', currentTowerFloor: 2, totalSpend: 0 }],
      [],
    );
    // Result objects ONLY contain playerId, source, currentTowerFloor.
    for (const f of friends) {
      expect(Object.keys(f).sort()).toEqual(['currentTowerFloor', 'playerId', 'source']);
      expect(f.totalSpend).toBeUndefined();
    }
  });
});
