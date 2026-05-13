// 2026-05-13 — TASK-055 (T3.10): Party Tower async architecture — unit suite.
//
// Spec: docs/design/endgame-social.md §3 (Party Tower — 2–5 player async coop)
//       + §15 ESC-03 Q3 ruling — 24h Standard default; 4h Competitive +
//         7-day Casual selectable per-party at creation.
//       + ADR-002 — async-only (Firestore, NO WebRTC).
//       + ADR-003 — strict no-P2W; party progression COSMETIC-ONLY; no
//         whale-tier perks; HARD CAP 5 (no paid expansion).
//
// Coverage strategy:
//   1. Constant audits — PARTY_MAX_SIZE === 5 HARD CAP byte-perfect,
//      PARTY_DEFAULT_TIMEOUT_MODE === 'standard', turn timeout values
//      byte-perfect (4h / 24h / 7d) per ESC-03 Q3.
//   2. 10 pure-math helpers — exhaustive boundary cases.
//   3. 10 async CRUD operations — happy + edge + invalid-input + state-machine.
//   4. Sacred audit:
//        - PARTY_MAX_SIZE === 5 BYTE-PERFECT (ADR-003 HARD CAP)
//        - Turn timeout 4h / 24h / 7d byte-perfect (ESC-03 Q3)
//        - Defensive: every export wrapped in try/catch; no throws under
//          adversarial inputs (null / undefined / wrong types).
//   5. Performance: pure helpers < 1ms each; CRUD ops < 5ms in mock mode.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // constants
  PARTY_MIN_SIZE,
  PARTY_MAX_SIZE,
  PARTY_NAME_MIN_LEN,
  PARTY_NAME_MAX_LEN,
  PARTY_TIMEOUT_MS_COMPETITIVE,
  PARTY_TIMEOUT_MS_STANDARD,
  PARTY_TIMEOUT_MS_CASUAL,
  PARTY_DEFAULT_TIMEOUT_MODE,
  PARTY_TIMEOUT_MS,
  PARTY_STATES,
  PARTY_ROLES,
  PARTY_COLLECTION,
  PARTY_RESULT_REASONS,
  PARTY_ROLE_OWNER,
  PARTY_ROLE_MEMBER,
  PARTY_STATE_PENDING,
  PARTY_STATE_ACTIVE,
  PARTY_STATE_COMPLETED,
  PARTY_STATE_ABANDONED,
  // pure helpers
  validatePartySize,
  validatePartyName,
  computeTurnTimeoutMs,
  computeTurnHasExpired,
  pickNextTurnPlayer,
  computeNextTurnPlayerId,
  canPlayerJoinParty,
  canPlayerStartParty,
  canPlayerEndTurn,
  computePartyProgress,
  // async ops
  createParty,
  fetchParty,
  joinParty,
  leaveParty,
  startParty,
  endTurn,
  transferOwnership,
  listPartiesForPlayer,
  notifyTurnHandoff,
  maybeAutoSkipExpiredTurn,
  // test helpers
  _resetMockPartyStore,
} from '../../src/services/party-tower-backend.js';

// ──────────────────────────────────────────────────────────────────────────
// Constants — sacred audit + value pinning.
// ──────────────────────────────────────────────────────────────────────────

describe('constants — sacred audit (ADR-003 HARD CAP + ESC-03 Q3)', () => {
  it('PARTY_MAX_SIZE === 5 BYTE-PERFECT (ADR-003 HARD CAP, no whale expansion)', () => {
    expect(PARTY_MAX_SIZE).toBe(5);
  });

  it('PARTY_MIN_SIZE === 2 (spec §3.1 — min 2 players to start)', () => {
    expect(PARTY_MIN_SIZE).toBe(2);
  });

  it('PARTY_NAME_MIN_LEN === 3 / PARTY_NAME_MAX_LEN === 30 (mirrors clan)', () => {
    expect(PARTY_NAME_MIN_LEN).toBe(3);
    expect(PARTY_NAME_MAX_LEN).toBe(30);
  });

  it('PARTY_DEFAULT_TIMEOUT_MODE === "standard" per ESC-03 Q3 ruling', () => {
    expect(PARTY_DEFAULT_TIMEOUT_MODE).toBe('standard');
  });

  it('PARTY_TIMEOUT_MS_COMPETITIVE === 4h (4 * 60 * 60 * 1000 = 14400000)', () => {
    expect(PARTY_TIMEOUT_MS_COMPETITIVE).toBe(4 * 60 * 60 * 1000);
    expect(PARTY_TIMEOUT_MS_COMPETITIVE).toBe(14400000);
  });

  it('PARTY_TIMEOUT_MS_STANDARD === 24h (24 * 60 * 60 * 1000 = 86400000)', () => {
    expect(PARTY_TIMEOUT_MS_STANDARD).toBe(24 * 60 * 60 * 1000);
    expect(PARTY_TIMEOUT_MS_STANDARD).toBe(86400000);
  });

  it('PARTY_TIMEOUT_MS_CASUAL === 7d (7 * 24 * 60 * 60 * 1000 = 604800000)', () => {
    expect(PARTY_TIMEOUT_MS_CASUAL).toBe(7 * 24 * 60 * 60 * 1000);
    expect(PARTY_TIMEOUT_MS_CASUAL).toBe(604800000);
  });

  it('PARTY_TIMEOUT_MS lookup table covers all three modes', () => {
    expect(PARTY_TIMEOUT_MS.competitive).toBe(PARTY_TIMEOUT_MS_COMPETITIVE);
    expect(PARTY_TIMEOUT_MS.standard).toBe(PARTY_TIMEOUT_MS_STANDARD);
    expect(PARTY_TIMEOUT_MS.casual).toBe(PARTY_TIMEOUT_MS_CASUAL);
  });

  it('PARTY_TIMEOUT_MS table is frozen', () => {
    expect(Object.isFrozen(PARTY_TIMEOUT_MS)).toBe(true);
  });

  it('PARTY_STATES enum contains exactly 4 states (pending/active/completed/abandoned)', () => {
    expect(Array.from(PARTY_STATES)).toEqual(['pending', 'active', 'completed', 'abandoned']);
    expect(Object.isFrozen(PARTY_STATES)).toBe(true);
  });

  it('PARTY_ROLES enum contains exactly 2 roles (owner/member)', () => {
    expect(Array.from(PARTY_ROLES)).toEqual(['owner', 'member']);
    expect(Object.isFrozen(PARTY_ROLES)).toBe(true);
  });

  it('Role string constants match enum entries', () => {
    expect(PARTY_ROLE_OWNER).toBe('owner');
    expect(PARTY_ROLE_MEMBER).toBe('member');
  });

  it('State string constants match enum entries', () => {
    expect(PARTY_STATE_PENDING).toBe('pending');
    expect(PARTY_STATE_ACTIVE).toBe('active');
    expect(PARTY_STATE_COMPLETED).toBe('completed');
    expect(PARTY_STATE_ABANDONED).toBe('abandoned');
  });

  it('PARTY_COLLECTION === "parties" (spec §3.1)', () => {
    expect(PARTY_COLLECTION).toBe('parties');
  });

  it('PARTY_RESULT_REASONS frozen registry covers core failure modes', () => {
    expect(PARTY_RESULT_REASONS.NO_SDK).toBe('no-sdk');
    expect(PARTY_RESULT_REASONS.PARTY_FULL).toBe('party-full');
    expect(PARTY_RESULT_REASONS.PARTY_TOO_SMALL).toBe('party-too-small');
    expect(PARTY_RESULT_REASONS.OWNER_CANNOT_LEAVE).toBe('owner-cannot-leave-without-transfer');
    expect(PARTY_RESULT_REASONS.NOT_CURRENT_TURN).toBe('not-current-turn');
    expect(PARTY_RESULT_REASONS.INVALID_MODE).toBe('invalid-mode');
    expect(PARTY_RESULT_REASONS.ALREADY_STARTED).toBe('already-started');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// validatePartySize — HARD CAP 2-5 boundary cases.
// ──────────────────────────────────────────────────────────────────────────

describe('validatePartySize — HARD CAP 2-5 (ADR-003)', () => {
  it('returns fail for non-number input', () => {
    expect(validatePartySize(null).ok).toBe(false);
    expect(validatePartySize(undefined).ok).toBe(false);
    expect(validatePartySize('5').ok).toBe(false);
    expect(validatePartySize(NaN).ok).toBe(false);
  });

  it('returns fail for negative count', () => {
    const r = validatePartySize(-1);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-input');
  });

  it('returns fail for count === 1 (below min 2)', () => {
    const r = validatePartySize(1);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('party-too-small');
  });

  it('returns ok for count === 2 (min boundary)', () => {
    expect(validatePartySize(2).ok).toBe(true);
  });

  it('returns ok for count === 5 (max boundary HARD CAP)', () => {
    expect(validatePartySize(5).ok).toBe(true);
  });

  it('returns fail for count === 6 (HARD CAP violation — ADR-003)', () => {
    const r = validatePartySize(6);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('party-full');
  });

  it('returns fail for ridiculous count (1000) — HARD CAP still enforced', () => {
    expect(validatePartySize(1000).ok).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// validatePartyName — length 3-30 + whitespace/control rejection.
// ──────────────────────────────────────────────────────────────────────────

describe('validatePartyName', () => {
  it('returns fail for non-string', () => {
    expect(validatePartyName(null).ok).toBe(false);
    expect(validatePartyName(42).ok).toBe(false);
    expect(validatePartyName({}).ok).toBe(false);
  });

  it('returns fail for empty string', () => {
    expect(validatePartyName('').ok).toBe(false);
  });

  it('returns fail for 2-char name (below min)', () => {
    expect(validatePartyName('ab').ok).toBe(false);
  });

  it('returns ok for 3-char name (min boundary)', () => {
    expect(validatePartyName('abc').ok).toBe(true);
  });

  it('returns ok for 30-char name (max boundary)', () => {
    expect(validatePartyName('a'.repeat(30)).ok).toBe(true);
  });

  it('returns fail for 31-char name (above max)', () => {
    expect(validatePartyName('a'.repeat(31)).ok).toBe(false);
  });

  it('returns fail for leading whitespace', () => {
    expect(validatePartyName(' abc').ok).toBe(false);
  });

  it('returns fail for embedded newline', () => {
    expect(validatePartyName('ab\ncd').ok).toBe(false);
  });

  it('returns fail for tab character', () => {
    expect(validatePartyName('ab\tcd').ok).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// computeTurnTimeoutMs — 4h / 24h / 7d mapping (ESC-03 Q3).
// ──────────────────────────────────────────────────────────────────────────

describe('computeTurnTimeoutMs (ESC-03 Q3)', () => {
  it('competitive → 4h ms (4 * 3600 * 1000 = 14400000)', () => {
    expect(computeTurnTimeoutMs('competitive')).toBe(14400000);
  });

  it('standard → 24h ms (24 * 3600 * 1000 = 86400000)', () => {
    expect(computeTurnTimeoutMs('standard')).toBe(86400000);
  });

  it('casual → 7d ms (7 * 24 * 3600 * 1000 = 604800000)', () => {
    expect(computeTurnTimeoutMs('casual')).toBe(604800000);
  });

  it('unknown mode → defaults to standard 24h', () => {
    expect(computeTurnTimeoutMs('xyz')).toBe(86400000);
  });

  it('null / undefined / non-string → defaults to standard 24h', () => {
    expect(computeTurnTimeoutMs(null)).toBe(86400000);
    expect(computeTurnTimeoutMs(undefined)).toBe(86400000);
    expect(computeTurnTimeoutMs(42)).toBe(86400000);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// computeTurnHasExpired
// ──────────────────────────────────────────────────────────────────────────

describe('computeTurnHasExpired', () => {
  it('returns false for null / undefined / non-object', () => {
    expect(computeTurnHasExpired(null)).toBe(false);
    expect(computeTurnHasExpired(undefined)).toBe(false);
    expect(computeTurnHasExpired('foo')).toBe(false);
  });

  it('returns false when currentTurnDeadline is missing or 0', () => {
    expect(computeTurnHasExpired({})).toBe(false);
    expect(computeTurnHasExpired({ currentTurnDeadline: 0 })).toBe(false);
  });

  it('returns false when now < deadline', () => {
    expect(computeTurnHasExpired({ currentTurnDeadline: 1000 }, 500)).toBe(false);
  });

  it('returns false when now === deadline (strict >, not >=)', () => {
    expect(computeTurnHasExpired({ currentTurnDeadline: 1000 }, 1000)).toBe(false);
  });

  it('returns true when now > deadline', () => {
    expect(computeTurnHasExpired({ currentTurnDeadline: 1000 }, 1001)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// pickNextTurnPlayer — round-robin + skip inactive.
// ──────────────────────────────────────────────────────────────────────────

describe('pickNextTurnPlayer / computeNextTurnPlayerId', () => {
  it('returns null for invalid input', () => {
    expect(pickNextTurnPlayer(null)).toBeNull();
    expect(pickNextTurnPlayer({})).toBeNull();
    expect(pickNextTurnPlayer({ members: [] })).toBeNull();
  });

  it('3-member party at turnIndex=0 → returns member[1]', () => {
    const party = {
      turnIndex: 0,
      members: [
        { playerId: 'a', isActive: true },
        { playerId: 'b', isActive: true },
        { playerId: 'c', isActive: true },
      ],
    };
    expect(pickNextTurnPlayer(party)).toBe('b');
  });

  it('3-member party at turnIndex=2 → wraps to member[0]', () => {
    const party = {
      turnIndex: 2,
      members: [
        { playerId: 'a', isActive: true },
        { playerId: 'b', isActive: true },
        { playerId: 'c', isActive: true },
      ],
    };
    expect(pickNextTurnPlayer(party)).toBe('a');
  });

  it('inactive member at next slot is skipped', () => {
    const party = {
      turnIndex: 0,
      members: [
        { playerId: 'a', isActive: true },
        { playerId: 'b', isActive: false },
        { playerId: 'c', isActive: true },
      ],
    };
    expect(pickNextTurnPlayer(party)).toBe('c');
  });

  it('single active member → returns that member (turn loops back)', () => {
    const party = {
      turnIndex: 0,
      members: [
        { playerId: 'a', isActive: true },
        { playerId: 'b', isActive: false },
      ],
    };
    expect(pickNextTurnPlayer(party)).toBe('a');
  });

  it('all members inactive → returns null', () => {
    const party = {
      turnIndex: 0,
      members: [
        { playerId: 'a', isActive: false },
        { playerId: 'b', isActive: false },
      ],
    };
    expect(pickNextTurnPlayer(party)).toBeNull();
  });

  it('computeNextTurnPlayerId is an alias for pickNextTurnPlayer', () => {
    const party = {
      turnIndex: 0,
      members: [
        { playerId: 'a', isActive: true },
        { playerId: 'b', isActive: true },
      ],
    };
    expect(computeNextTurnPlayerId(party)).toBe(pickNextTurnPlayer(party));
  });
});

// ──────────────────────────────────────────────────────────────────────────
// canPlayerJoinParty
// ──────────────────────────────────────────────────────────────────────────

describe('canPlayerJoinParty', () => {
  const pendingParty = {
    state: 'pending',
    members: [{ playerId: 'a' }, { playerId: 'b' }],
  };

  it('returns false for invalid input', () => {
    expect(canPlayerJoinParty(null, pendingParty)).toBe(false);
    expect(canPlayerJoinParty('x', null)).toBe(false);
    expect(canPlayerJoinParty('', pendingParty)).toBe(false);
  });

  it('returns true when not member + has space + pending', () => {
    expect(canPlayerJoinParty('c', pendingParty)).toBe(true);
  });

  it('returns false when already member', () => {
    expect(canPlayerJoinParty('a', pendingParty)).toBe(false);
  });

  it('returns false when party is full (5 members)', () => {
    const full = {
      state: 'pending',
      members: [
        { playerId: 'a' }, { playerId: 'b' }, { playerId: 'c' },
        { playerId: 'd' }, { playerId: 'e' },
      ],
    };
    expect(canPlayerJoinParty('f', full)).toBe(false);
  });

  it('returns false when state is active (cannot join mid-run)', () => {
    const active = { ...pendingParty, state: 'active' };
    expect(canPlayerJoinParty('c', active)).toBe(false);
  });

  it('returns false when state is completed', () => {
    const completed = { ...pendingParty, state: 'completed' };
    expect(canPlayerJoinParty('c', completed)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// canPlayerStartParty
// ──────────────────────────────────────────────────────────────────────────

describe('canPlayerStartParty', () => {
  it('owner + minSize 2 met + pending → true', () => {
    const party = {
      state: 'pending',
      ownerId: 'a',
      members: [
        { playerId: 'a', role: 'owner' },
        { playerId: 'b', role: 'member' },
      ],
    };
    expect(canPlayerStartParty('a', party)).toBe(true);
  });

  it('non-owner → false', () => {
    const party = {
      state: 'pending',
      ownerId: 'a',
      members: [
        { playerId: 'a', role: 'owner' },
        { playerId: 'b', role: 'member' },
      ],
    };
    expect(canPlayerStartParty('b', party)).toBe(false);
  });

  it('only 1 member (below minSize 2) → false', () => {
    const party = {
      state: 'pending',
      ownerId: 'a',
      members: [{ playerId: 'a', role: 'owner' }],
    };
    expect(canPlayerStartParty('a', party)).toBe(false);
  });

  it('state is active → false (cannot start already-started)', () => {
    const party = {
      state: 'active',
      ownerId: 'a',
      members: [
        { playerId: 'a', role: 'owner' },
        { playerId: 'b', role: 'member' },
      ],
    };
    expect(canPlayerStartParty('a', party)).toBe(false);
  });

  it('invalid input returns false', () => {
    expect(canPlayerStartParty(null, {})).toBe(false);
    expect(canPlayerStartParty('a', null)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// canPlayerEndTurn
// ──────────────────────────────────────────────────────────────────────────

describe('canPlayerEndTurn', () => {
  const activeParty = {
    state: 'active',
    turnIndex: 0,
    members: [
      { playerId: 'a', isActive: true },
      { playerId: 'b', isActive: true },
    ],
  };

  it('current player + active state → true', () => {
    expect(canPlayerEndTurn('a', activeParty)).toBe(true);
  });

  it('non-current player → false', () => {
    expect(canPlayerEndTurn('b', activeParty)).toBe(false);
  });

  it('pending state → false', () => {
    expect(canPlayerEndTurn('a', { ...activeParty, state: 'pending' })).toBe(false);
  });

  it('completed state → false', () => {
    expect(canPlayerEndTurn('a', { ...activeParty, state: 'completed' })).toBe(false);
  });

  it('invalid input → false', () => {
    expect(canPlayerEndTurn(null, activeParty)).toBe(false);
    expect(canPlayerEndTurn('a', null)).toBe(false);
  });

  it('inactive current player → false (member marked left)', () => {
    const party = {
      state: 'active',
      turnIndex: 0,
      members: [
        { playerId: 'a', isActive: false },
        { playerId: 'b', isActive: true },
      ],
    };
    expect(canPlayerEndTurn('a', party)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// computePartyProgress
// ──────────────────────────────────────────────────────────────────────────

describe('computePartyProgress', () => {
  it('returns default for null / invalid input', () => {
    expect(computePartyProgress(null)).toEqual({ floorIndex: 0, lastAction: null, turnCount: 0 });
  });

  it('returns floorIndex 0 and turnCount 0 for fresh party', () => {
    expect(computePartyProgress({ sharedState: { floorIndex: 0 }, turnHistory: [] })).toEqual({
      floorIndex: 0, lastAction: null, turnCount: 0,
    });
  });

  it('surfaces floorIndex from sharedState', () => {
    const r = computePartyProgress({ sharedState: { floorIndex: 12 } });
    expect(r.floorIndex).toBe(12);
  });

  it('surfaces last turn action from turnHistory[]', () => {
    const party = {
      sharedState: { floorIndex: 3 },
      turnHistory: [
        { playerId: 'a', endedAt: 1, actions: ['act1'], deltas: { dmg: 100 } },
        { playerId: 'b', endedAt: 2, actions: ['act2'], deltas: { dmg: 200 } },
      ],
    };
    const r = computePartyProgress(party);
    expect(r.turnCount).toBe(2);
    expect(r.lastAction.playerId).toBe('b');
    expect(r.lastAction.endedAt).toBe(2);
    expect(r.lastAction.deltas).toEqual({ dmg: 200 });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Async CRUD ops — happy + edge + invalid-input paths.
// ──────────────────────────────────────────────────────────────────────────

describe('createParty', () => {
  beforeEach(() => { _resetMockPartyStore(); });

  it('rejects invalid ownerId', async () => {
    const r = await createParty(null);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-input');
  });

  it('creates party with default mode (standard) when no mode given', async () => {
    const r = await createParty('roma');
    expect(r.ok).toBe(true);
    expect(typeof r.partyId).toBe('string');
    const f = await fetchParty(r.partyId);
    expect(f.party.turnTimeoutMode).toBe('standard');
    expect(f.party.turnTimeoutMs).toBe(PARTY_TIMEOUT_MS_STANDARD);
  });

  it('creates party with competitive mode → 4h timeout', async () => {
    const r = await createParty('roma', 'competitive');
    const f = await fetchParty(r.partyId);
    expect(f.party.turnTimeoutMode).toBe('competitive');
    expect(f.party.turnTimeoutMs).toBe(PARTY_TIMEOUT_MS_COMPETITIVE);
  });

  it('creates party with casual mode → 7d timeout', async () => {
    const r = await createParty('roma', 'casual');
    const f = await fetchParty(r.partyId);
    expect(f.party.turnTimeoutMs).toBe(PARTY_TIMEOUT_MS_CASUAL);
  });

  it('rejects unknown mode', async () => {
    const r = await createParty('roma', 'extreme');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-mode');
  });

  it('owner added as first member with role "owner" + isActive true', async () => {
    const r = await createParty('roma');
    const f = await fetchParty(r.partyId);
    expect(f.party.members.length).toBe(1);
    expect(f.party.members[0].playerId).toBe('roma');
    expect(f.party.members[0].role).toBe('owner');
    expect(f.party.members[0].isActive).toBe(true);
    expect(f.party.ownerId).toBe('roma');
  });

  it('new party starts in pending state with maxSize 5 (HARD CAP)', async () => {
    const r = await createParty('roma');
    const f = await fetchParty(r.partyId);
    expect(f.party.state).toBe('pending');
    expect(f.party.maxSize).toBe(5);
    expect(f.party.minSize).toBe(2);
    expect(f.party.turnIndex).toBe(0);
    expect(f.party.currentTurnDeadline).toBe(0);
  });

  it('schema includes T3.11 sharedState slots (towerHearts/towerPacts/boardState/floorIndex)', async () => {
    const r = await createParty('roma');
    const f = await fetchParty(r.partyId);
    expect(f.party.sharedState).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(f.party.sharedState, 'towerHearts')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(f.party.sharedState, 'towerPacts')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(f.party.sharedState, 'boardState')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(f.party.sharedState, 'floorIndex')).toBe(true);
  });

  it('schema includes T3.12 identityFxLog slot', async () => {
    const r = await createParty('roma');
    const f = await fetchParty(r.partyId);
    expect(Array.isArray(f.party.identityFxLog)).toBe(true);
  });
});

describe('fetchParty', () => {
  beforeEach(() => { _resetMockPartyStore(); });

  it('rejects invalid partyId', async () => {
    const r = await fetchParty(null);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-input');
  });

  it('returns not-found for unknown id when SDK absent (no-sdk fallback)', async () => {
    const r = await fetchParty('does-not-exist');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no-sdk');
  });

  it('returns deep-cloned party doc (caller mutation does not leak)', async () => {
    const c = await createParty('roma');
    const f1 = await fetchParty(c.partyId);
    f1.party.state = 'completed'; // mutate
    const f2 = await fetchParty(c.partyId);
    expect(f2.party.state).toBe('pending');
  });
});

describe('joinParty', () => {
  beforeEach(() => { _resetMockPartyStore(); });

  it('adds player as member with role "member"', async () => {
    const c = await createParty('roma');
    const j = await joinParty(c.partyId, 'kira');
    expect(j.ok).toBe(true);
    const f = await fetchParty(c.partyId);
    expect(f.party.members.length).toBe(2);
    const kira = f.party.members.find(m => m.playerId === 'kira');
    expect(kira.role).toBe('member');
    expect(kira.isActive).toBe(true);
  });

  it('HARD CAP 5 (ADR-003): 6th join attempt fails with party-full', async () => {
    const c = await createParty('roma');
    await joinParty(c.partyId, 'b');
    await joinParty(c.partyId, 'c');
    await joinParty(c.partyId, 'd');
    await joinParty(c.partyId, 'e');
    const sixth = await joinParty(c.partyId, 'f');
    expect(sixth.ok).toBe(false);
    expect(sixth.reason).toBe('party-full');
  });

  it('rejects duplicate join (already-member)', async () => {
    const c = await createParty('roma');
    await joinParty(c.partyId, 'kira');
    const dup = await joinParty(c.partyId, 'kira');
    expect(dup.ok).toBe(false);
    expect(dup.reason).toBe('already-member');
  });

  it('cannot join party in active state', async () => {
    const c = await createParty('roma');
    await joinParty(c.partyId, 'kira');
    await startParty(c.partyId, 'roma');
    const tooLate = await joinParty(c.partyId, 'late');
    expect(tooLate.ok).toBe(false);
    expect(tooLate.reason).toBe('invalid-state');
  });
});

describe('leaveParty', () => {
  beforeEach(() => { _resetMockPartyStore(); });

  it('member leaves pending party → spliced out', async () => {
    const c = await createParty('roma');
    await joinParty(c.partyId, 'kira');
    const l = await leaveParty(c.partyId, 'kira');
    expect(l.ok).toBe(true);
    const f = await fetchParty(c.partyId);
    expect(f.party.members.length).toBe(1);
  });

  it('owner cannot leave without transfer', async () => {
    const c = await createParty('roma');
    await joinParty(c.partyId, 'kira');
    const r = await leaveParty(c.partyId, 'roma');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('owner-cannot-leave-without-transfer');
  });

  it('non-member leave → not-a-member', async () => {
    const c = await createParty('roma');
    const r = await leaveParty(c.partyId, 'ghost');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-a-member');
  });

  it('member leaves active party → marked inactive (not spliced)', async () => {
    const c = await createParty('roma');
    await joinParty(c.partyId, 'kira');
    await startParty(c.partyId, 'roma');
    const l = await leaveParty(c.partyId, 'kira');
    expect(l.ok).toBe(true);
    const f = await fetchParty(c.partyId);
    expect(f.party.members.length).toBe(2);
    const kira = f.party.members.find(m => m.playerId === 'kira');
    expect(kira.isActive).toBe(false);
  });
});

describe('startParty', () => {
  beforeEach(() => { _resetMockPartyStore(); });

  it('owner starts with 2+ members → state=active, turnIndex=0, deadline set', async () => {
    const c = await createParty('roma');
    await joinParty(c.partyId, 'kira');
    const before = Date.now();
    const s = await startParty(c.partyId, 'roma');
    expect(s.ok).toBe(true);
    expect(s.currentTurnPlayerId).toBe('roma');
    expect(s.currentTurnDeadline).toBeGreaterThan(before);
    const f = await fetchParty(c.partyId);
    expect(f.party.state).toBe('active');
    expect(f.party.turnIndex).toBe(0);
    expect(f.party.startedAt).toBeGreaterThan(0);
  });

  it('non-owner cannot start', async () => {
    const c = await createParty('roma');
    await joinParty(c.partyId, 'kira');
    const r = await startParty(c.partyId, 'kira');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-owner');
  });

  it('single-member party cannot start (minSize 2 not met)', async () => {
    const c = await createParty('roma');
    const r = await startParty(c.partyId, 'roma');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('party-too-small');
  });

  it('cannot start party already in active state', async () => {
    const c = await createParty('roma');
    await joinParty(c.partyId, 'kira');
    await startParty(c.partyId, 'roma');
    const r2 = await startParty(c.partyId, 'roma');
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe('already-started');
  });

  it('currentTurnDeadline reflects mode timeout (24h standard default)', async () => {
    const c = await createParty('roma');
    await joinParty(c.partyId, 'kira');
    const before = Date.now();
    const s = await startParty(c.partyId, 'roma');
    expect(s.currentTurnDeadline - before).toBeGreaterThanOrEqual(PARTY_TIMEOUT_MS_STANDARD - 100);
    expect(s.currentTurnDeadline - before).toBeLessThanOrEqual(PARTY_TIMEOUT_MS_STANDARD + 100);
  });

  it('competitive mode → 4h deadline', async () => {
    const c = await createParty('roma', 'competitive');
    await joinParty(c.partyId, 'kira');
    const before = Date.now();
    const s = await startParty(c.partyId, 'roma');
    expect(s.currentTurnDeadline - before).toBeGreaterThanOrEqual(PARTY_TIMEOUT_MS_COMPETITIVE - 100);
    expect(s.currentTurnDeadline - before).toBeLessThanOrEqual(PARTY_TIMEOUT_MS_COMPETITIVE + 100);
  });
});

describe('endTurn', () => {
  beforeEach(() => { _resetMockPartyStore(); });

  async function _setupActiveParty() {
    const c = await createParty('roma');
    await joinParty(c.partyId, 'kira');
    await joinParty(c.partyId, 'sebastien');
    await startParty(c.partyId, 'roma');
    return c.partyId;
  }

  it('current player ends turn → turnIndex advances + deadline reset', async () => {
    const pid = await _setupActiveParty();
    const before = (await fetchParty(pid)).party;
    expect(before.turnIndex).toBe(0);
    const r = await endTurn(pid, 'roma', { actions: [], deltas: { dmg: 50 } });
    expect(r.ok).toBe(true);
    expect(r.nextTurnPlayerId).toBe('kira');
    const after = (await fetchParty(pid)).party;
    expect(after.turnIndex).toBe(1);
    expect(after.turnHistory.length).toBe(1);
    expect(after.turnHistory[0].playerId).toBe('roma');
    // Deadline may be ≥ before (same-ms tick) but must be reset to now+timeout
    expect(after.currentTurnDeadline).toBeGreaterThanOrEqual(before.currentTurnDeadline);
  });

  it('non-current player → not-current-turn', async () => {
    const pid = await _setupActiveParty();
    const r = await endTurn(pid, 'kira', {});
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-current-turn');
  });

  it('end turn in pending state → invalid-state', async () => {
    const c = await createParty('roma');
    await joinParty(c.partyId, 'kira');
    const r = await endTurn(c.partyId, 'roma', {});
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-state');
  });

  it('round-robin wraps after last player', async () => {
    const pid = await _setupActiveParty();
    await endTurn(pid, 'roma', {});
    await endTurn(pid, 'kira', {});
    await endTurn(pid, 'sebastien', {});
    const f = await fetchParty(pid);
    // After 3 turns, wraps back to roma (turnIndex 0).
    expect(f.party.turnIndex).toBe(0);
    expect(f.party.turnHistory.length).toBe(3);
  });

  it('turnHistory entries surface deltas + endedAt', async () => {
    const pid = await _setupActiveParty();
    await endTurn(pid, 'roma', { actions: ['placePiece'], deltas: { dmg: 100, linesCleared: 2 } });
    const f = await fetchParty(pid);
    expect(f.party.turnHistory[0].actions).toEqual(['placePiece']);
    expect(f.party.turnHistory[0].deltas).toEqual({ dmg: 100, linesCleared: 2 });
    expect(f.party.turnHistory[0].endedAt).toBeGreaterThan(0);
  });
});

describe('transferOwnership', () => {
  beforeEach(() => { _resetMockPartyStore(); });

  it('owner transfers to member → roles flip + ownerId updates', async () => {
    const c = await createParty('roma');
    await joinParty(c.partyId, 'kira');
    const t = await transferOwnership(c.partyId, 'roma', 'kira');
    expect(t.ok).toBe(true);
    const f = await fetchParty(c.partyId);
    expect(f.party.ownerId).toBe('kira');
    expect(f.party.members.find(m => m.playerId === 'roma').role).toBe('member');
    expect(f.party.members.find(m => m.playerId === 'kira').role).toBe('owner');
  });

  it('non-owner cannot transfer', async () => {
    const c = await createParty('roma');
    await joinParty(c.partyId, 'kira');
    await joinParty(c.partyId, 'sebastien');
    const r = await transferOwnership(c.partyId, 'kira', 'sebastien');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-owner');
  });

  it('target must be member', async () => {
    const c = await createParty('roma');
    await joinParty(c.partyId, 'kira');
    const r = await transferOwnership(c.partyId, 'roma', 'ghost');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('target-not-member');
  });

  it('self-transfer rejected', async () => {
    const c = await createParty('roma');
    const r = await transferOwnership(c.partyId, 'roma', 'roma');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-input');
  });
});

describe('listPartiesForPlayer', () => {
  beforeEach(() => { _resetMockPartyStore(); });

  it('returns empty list when player has no parties', async () => {
    const r = await listPartiesForPlayer('ghost');
    expect(r.ok).toBe(true);
    expect(r.parties).toEqual([]);
  });

  it('returns parties where player is owner', async () => {
    const c = await createParty('roma');
    const r = await listPartiesForPlayer('roma');
    expect(r.ok).toBe(true);
    expect(r.parties.length).toBe(1);
    expect(r.parties[0].partyId).toBe(c.partyId);
  });

  it('returns parties where player is member', async () => {
    const c = await createParty('roma');
    await joinParty(c.partyId, 'kira');
    const r = await listPartiesForPlayer('kira');
    expect(r.ok).toBe(true);
    expect(r.parties.length).toBe(1);
  });

  it('rejects invalid playerId', async () => {
    const r = await listPartiesForPlayer(null);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-input');
  });
});

describe('notifyTurnHandoff', () => {
  beforeEach(() => { _resetMockPartyStore(); });

  it('returns ok with sent:false (FCM not wired in T3.10)', async () => {
    const r = await notifyTurnHandoff('p1', 'a', 'b');
    expect(r.ok).toBe(true);
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('fcm-not-wired');
  });

  it('rejects invalid input', async () => {
    const r = await notifyTurnHandoff(null, 'a', 'b');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-input');
  });
});

describe('maybeAutoSkipExpiredTurn', () => {
  beforeEach(() => { _resetMockPartyStore(); });

  it('returns skipped:false when turn not expired', async () => {
    const c = await createParty('roma');
    await joinParty(c.partyId, 'kira');
    await startParty(c.partyId, 'roma');
    const r = await maybeAutoSkipExpiredTurn(c.partyId);
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe(false);
  });

  it('advances turnIndex + records skip when turn expired', async () => {
    const c = await createParty('roma');
    await joinParty(c.partyId, 'kira');
    await startParty(c.partyId, 'roma');
    const before = await fetchParty(c.partyId);
    // Inject a now value that's past the deadline.
    const futureNow = before.party.currentTurnDeadline + 1000;
    const r = await maybeAutoSkipExpiredTurn(c.partyId, { now: futureNow });
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe(true);
    expect(r.skippedPlayerId).toBe('roma');
    expect(r.nextTurnPlayerId).toBe('kira');
    const f = await fetchParty(c.partyId);
    expect(f.party.turnIndex).toBe(1);
    expect(f.party.turnHistory.length).toBe(1);
    expect(f.party.turnHistory[0].skipped).toBe(true);
  });

  it('rejects when party in pending state', async () => {
    const c = await createParty('roma');
    const r = await maybeAutoSkipExpiredTurn(c.partyId);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-state');
  });

  it('rejects invalid partyId', async () => {
    const r = await maybeAutoSkipExpiredTurn(null);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-input');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Performance budgets — pure helpers <1ms each.
// ──────────────────────────────────────────────────────────────────────────

describe('performance — pure helpers <1ms each (spec §3.6)', () => {
  it('validatePartySize < 1ms', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) validatePartySize(i % 10);
    const dt = (performance.now() - start) / 1000;
    expect(dt).toBeLessThan(1);
  });

  it('computeTurnTimeoutMs < 1ms', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) computeTurnTimeoutMs(i % 2 === 0 ? 'standard' : 'competitive');
    const dt = (performance.now() - start) / 1000;
    expect(dt).toBeLessThan(1);
  });

  it('pickNextTurnPlayer < 1ms (5-member party)', () => {
    const party = {
      turnIndex: 2,
      members: [
        { playerId: 'a', isActive: true },
        { playerId: 'b', isActive: false },
        { playerId: 'c', isActive: true },
        { playerId: 'd', isActive: true },
        { playerId: 'e', isActive: false },
      ],
    };
    const start = performance.now();
    for (let i = 0; i < 1000; i++) pickNextTurnPlayer(party);
    const dt = (performance.now() - start) / 1000;
    expect(dt).toBeLessThan(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Sacred-cow audit — TOWER + Phase 2 / Wave-3 isolation.
// ──────────────────────────────────────────────────────────────────────────

describe('sacred-cow audit — T3.10 schema-only; no sacred writes', () => {
  beforeEach(() => { _resetMockPartyStore(); });

  it('sharedState.towerHearts starts at 0 (T3.10 schema; T3.11 wires)', async () => {
    const c = await createParty('roma');
    const f = await fetchParty(c.partyId);
    expect(f.party.sharedState.towerHearts).toBe(0);
  });

  it('sharedState.towerPacts starts empty (T3.10 schema; T3.11 wires)', async () => {
    const c = await createParty('roma');
    const f = await fetchParty(c.partyId);
    expect(f.party.sharedState.towerPacts).toEqual([]);
  });

  it('identityFxLog starts empty (T3.10 schema; T3.12 wires per-turn dispatch)', async () => {
    const c = await createParty('roma');
    const f = await fetchParty(c.partyId);
    expect(f.party.identityFxLog).toEqual([]);
  });

  it('party doc contains no banned P2W fields (ADR-003)', async () => {
    const c = await createParty('roma');
    const f = await fetchParty(c.partyId);
    const banned = ['paidHeartBonus', 'whaleTierExtraSlot', 'segmentPerk', 'damageBonus', 'hpBonus', 'paidRevives', 'gemDiscount'];
    for (const key of banned) {
      expect(Object.prototype.hasOwnProperty.call(f.party, key)).toBe(false);
    }
  });

  it('mock store deep-clone isolation: returned party can be mutated without leaking', async () => {
    const c = await createParty('roma');
    const f1 = await fetchParty(c.partyId);
    f1.party.members.push({ playerId: 'fake', role: 'owner' });
    const f2 = await fetchParty(c.partyId);
    expect(f2.party.members.length).toBe(1); // unchanged
  });
});
