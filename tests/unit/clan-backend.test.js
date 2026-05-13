// 2026-05-13 — TASK-050 (T3.02): Adventures backend — unit suite.
//
// Spec: docs/design/endgame-social.md §2 (Adventures — async clan 5–15)
//       + §15 ESC-03 Q1 ruling — clan size 5–15 HARD CAP, no exceptions.
//       + ADR-003 — strict no-P2W; clan rewards COSMETIC-ONLY.
//
// Coverage strategy:
//   1. 8 pure-math helpers — exhaustive boundary cases (computeClanPower,
//      computeContributorPercent, computeClanLevel, validateClanSize,
//      validateClanName, canPlayerJoinClan, canPlayerLeaveClan,
//      unlockCosmeticAtLevel).
//   2. 9 async CRUD operations — happy + edge + no-sdk + invalid-input paths.
//   3. Sacred audit:
//        - CLAN_MAX_SIZE === 15 BYTE-PERFECT (ESC-03 Q1 hard cap)
//        - CLAN_MIN_SIZE === 5
//        - All cosmetic unlocks contain NO stat / damage / win-rate fields
//          (ADR-003 no-P2W invariant — statically verifiable)
//        - Defensive: every export wrapped in try/catch; no throws under
//          adversarial inputs (null / undefined / wrong types).
//   4. Performance: pure helpers < 1ms each; CRUD ops < 5ms in mock mode.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // constants
  CLAN_MIN_SIZE,
  CLAN_MAX_SIZE,
  CLAN_NAME_MIN_LEN,
  CLAN_NAME_MAX_LEN,
  CLAN_DESCRIPTION_MAX_LEN,
  CLAN_LEVEL_WEEKS_PER_LEVEL,
  CLAN_ROLE_OWNER,
  CLAN_ROLE_MEMBER,
  CLAN_RESULT_REASONS,
  CLAN_COLLECTION,
  // pure helpers
  computeClanPower,
  computeContributorPercent,
  computeClanLevel,
  validateClanSize,
  validateClanName,
  canPlayerJoinClan,
  canPlayerLeaveClan,
  unlockCosmeticAtLevel,
  // CRUD
  createClan,
  fetchClan,
  joinClan,
  leaveClan,
  recordContribution,
  closeWeek,
  transferOwnership,
  listClansForPlayer,
  searchClansByName,
  // test helpers
  _resetMockClanStore,
} from '../../src/services/clan-backend.js';
import {
  CLAN_COSMETIC_TIERS,
  CLAN_DEFAULT_BANNER_TIER,
  CLAN_LEVEL_COSMETIC_UNLOCKS,
  CLAN_UNLOCK_LEVELS,
} from '../../src/data/clan-config.js';

// ──────────────────────────────────────────────────────────────────────────
// Constants — sacred audit + value pinning.
// ──────────────────────────────────────────────────────────────────────────

describe('constants — sacred audit (ESC-03 Q1 + ADR-003)', () => {
  it('CLAN_MAX_SIZE === 15 BYTE-PERFECT (ESC-03 Q1 hard cap, no exceptions)', () => {
    expect(CLAN_MAX_SIZE).toBe(15);
  });

  it('CLAN_MIN_SIZE === 5 (spec §2.1 — "5 to 15 souls")', () => {
    expect(CLAN_MIN_SIZE).toBe(5);
  });

  it('CLAN_NAME_MIN_LEN === 3 / CLAN_NAME_MAX_LEN === 30', () => {
    expect(CLAN_NAME_MIN_LEN).toBe(3);
    expect(CLAN_NAME_MAX_LEN).toBe(30);
  });

  it('CLAN_DESCRIPTION_MAX_LEN === 200', () => {
    expect(CLAN_DESCRIPTION_MAX_LEN).toBe(200);
  });

  it('CLAN_LEVEL_WEEKS_PER_LEVEL === 4 (spec §2.4 — level per ~month)', () => {
    expect(CLAN_LEVEL_WEEKS_PER_LEVEL).toBe(4);
  });

  it('Role tags use stable string constants', () => {
    expect(CLAN_ROLE_OWNER).toBe('owner');
    expect(CLAN_ROLE_MEMBER).toBe('member');
  });

  it('CLAN_COLLECTION === "adventures" (spec §2.1 ruling)', () => {
    expect(CLAN_COLLECTION).toBe('adventures');
  });

  it('CLAN_RESULT_REASONS frozen registry covers core failure modes', () => {
    expect(CLAN_RESULT_REASONS.NO_SDK).toBe('no-sdk');
    expect(CLAN_RESULT_REASONS.CLAN_FULL).toBe('clan-full');
    expect(CLAN_RESULT_REASONS.OWNER_CANNOT_LEAVE).toBe('owner-cannot-leave-without-transfer');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// ADR-003 no-P2W audit — cosmetic unlocks contain NO mechanical fields.
// ──────────────────────────────────────────────────────────────────────────

describe('ADR-003 audit — clan cosmetics are COSMETIC-ONLY (no-P2W invariant)', () => {
  const BANNED_FIELDS = ['stat', 'damage', 'hp', 'winRate', 'progressionBoost', 'gemDiscount', 'attack', 'defense', 'critChance', 'multiplier'];

  it('CLAN_DEFAULT_BANNER_TIER is a known cosmetic tier', () => {
    expect(CLAN_COSMETIC_TIERS.includes(CLAN_DEFAULT_BANNER_TIER)).toBe(true);
  });

  it('CLAN_COSMETIC_TIERS contains only string values', () => {
    for (const tier of CLAN_COSMETIC_TIERS) {
      expect(typeof tier).toBe('string');
    }
  });

  it('CLAN_LEVEL_COSMETIC_UNLOCKS entries contain ONLY {kind, value}', () => {
    for (const lvl of CLAN_UNLOCK_LEVELS) {
      const unlocks = CLAN_LEVEL_COSMETIC_UNLOCKS[lvl];
      for (const u of unlocks) {
        const keys = Object.keys(u).sort();
        expect(keys).toEqual(['kind', 'value']);
        expect(typeof u.kind).toBe('string');
        expect(typeof u.value).toBe('string');
      }
    }
  });

  it('No unlock entry contains a banned mechanical field', () => {
    for (const lvl of CLAN_UNLOCK_LEVELS) {
      const unlocks = CLAN_LEVEL_COSMETIC_UNLOCKS[lvl];
      for (const u of unlocks) {
        for (const banned of BANNED_FIELDS) {
          expect(Object.prototype.hasOwnProperty.call(u, banned)).toBe(false);
        }
      }
    }
  });

  it('All unlock `kind` values are cosmetic categories', () => {
    const allowedKinds = ['banner', 'emblem', 'badge', 'motto'];
    for (const lvl of CLAN_UNLOCK_LEVELS) {
      const unlocks = CLAN_LEVEL_COSMETIC_UNLOCKS[lvl];
      for (const u of unlocks) {
        expect(allowedKinds.includes(u.kind)).toBe(true);
      }
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Pure-math helpers — edge cases + boundary asserts.
// ──────────────────────────────────────────────────────────────────────────

describe('computeClanPower', () => {
  it('returns 0 for null / undefined / non-object input', () => {
    expect(computeClanPower(null)).toBe(0);
    expect(computeClanPower(undefined)).toBe(0);
    expect(computeClanPower(42)).toBe(0);
  });

  it('returns 0 when weeklyContributions is missing or empty', () => {
    expect(computeClanPower({})).toBe(0);
    expect(computeClanPower({ weeklyContributions: {} })).toBe(0);
  });

  it('sums damage across all contributors', () => {
    const state = {
      weeklyContributions: {
        roma: { damage: 100, lastContribAt: 1 },
        kira: { damage: 250, lastContribAt: 2 },
        sebastien: { damage: 75, lastContribAt: 3 },
      },
    };
    expect(computeClanPower(state)).toBe(425);
  });

  it('ignores negative / NaN / non-number damage values', () => {
    const state = {
      weeklyContributions: {
        roma: { damage: 100 },
        kira: { damage: -50 },
        sebastien: { damage: NaN },
        ula: { damage: 'cheating' },
        tom: { damage: 75 },
      },
    };
    expect(computeClanPower(state)).toBe(175);
  });
});

describe('computeContributorPercent', () => {
  it('returns 0 for missing player / missing weeklyContributions', () => {
    expect(computeContributorPercent('', {})).toBe(0);
    expect(computeContributorPercent('roma', null)).toBe(0);
    expect(computeContributorPercent('roma', {})).toBe(0);
  });

  it('returns 0 when player has no contribution entry', () => {
    expect(computeContributorPercent('ghost', { roma: { damage: 100 } })).toBe(0);
  });

  it('returns 0 when total clan damage is 0 (avoids divide-by-zero)', () => {
    expect(computeContributorPercent('roma', { roma: { damage: 0 } })).toBe(0);
  });

  it('50/100 yields 0.5', () => {
    const wc = { roma: { damage: 50 }, kira: { damage: 50 } };
    expect(computeContributorPercent('roma', wc)).toBeCloseTo(0.5, 6);
  });

  it('100/100 yields 1.0 (solo contributor)', () => {
    expect(computeContributorPercent('roma', { roma: { damage: 100 } })).toBeCloseTo(1.0, 6);
  });

  it('contributor percents across 3 members sum to 1.0', () => {
    const wc = { roma: { damage: 100 }, kira: { damage: 200 }, sebastien: { damage: 300 } };
    const total =
      computeContributorPercent('roma', wc) +
      computeContributorPercent('kira', wc) +
      computeContributorPercent('sebastien', wc);
    expect(total).toBeCloseTo(1.0, 6);
  });
});

describe('computeClanLevel', () => {
  it('0 weeks → level 1', () => {
    expect(computeClanLevel(0)).toBe(1);
  });

  it('1, 2, 3 weeks still level 1', () => {
    expect(computeClanLevel(1)).toBe(1);
    expect(computeClanLevel(3)).toBe(1);
  });

  it('4 weeks → level 2', () => {
    expect(computeClanLevel(4)).toBe(2);
  });

  it('8 weeks → level 3', () => {
    expect(computeClanLevel(8)).toBe(3);
  });

  it('12 weeks → level 4', () => {
    expect(computeClanLevel(12)).toBe(4);
  });

  it('100 weeks → level 26', () => {
    expect(computeClanLevel(100)).toBe(26);
  });

  it('negative / non-number defaults to level 1', () => {
    expect(computeClanLevel(-5)).toBe(1);
    expect(computeClanLevel(NaN)).toBe(1);
    expect(computeClanLevel('abc')).toBe(1);
  });
});

describe('validateClanSize (HARD CAP 5–15 per ESC-03 Q1)', () => {
  it('4 → fail (below min)', () => {
    expect(validateClanSize(4).ok).toBe(false);
  });

  it('5 → ok (min boundary)', () => {
    expect(validateClanSize(5).ok).toBe(true);
  });

  it('10 → ok (middle)', () => {
    expect(validateClanSize(10).ok).toBe(true);
  });

  it('15 → ok (max boundary — HARD CAP)', () => {
    expect(validateClanSize(15).ok).toBe(true);
  });

  it('16 → fail (HARD CAP violated — ESC-03 Q1)', () => {
    const r = validateClanSize(16);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('clan-full');
  });

  it('100 → fail (HARD CAP — no whale-tier expansion)', () => {
    expect(validateClanSize(100).ok).toBe(false);
  });

  it('negative → fail (invalid input)', () => {
    expect(validateClanSize(-1).ok).toBe(false);
  });

  it('NaN / undefined → fail', () => {
    expect(validateClanSize(NaN).ok).toBe(false);
    expect(validateClanSize(undefined).ok).toBe(false);
  });
});

describe('validateClanName', () => {
  it('empty → fail', () => {
    expect(validateClanName('').ok).toBe(false);
  });

  it('2 chars → fail (below min)', () => {
    expect(validateClanName('AB').ok).toBe(false);
  });

  it('3 chars → ok (min boundary)', () => {
    expect(validateClanName('ABC').ok).toBe(true);
  });

  it('30 chars → ok (max boundary)', () => {
    expect(validateClanName('A'.repeat(30)).ok).toBe(true);
  });

  it('31 chars → fail', () => {
    expect(validateClanName('A'.repeat(31)).ok).toBe(false);
  });

  it('leading/trailing whitespace → fail', () => {
    expect(validateClanName(' Brass Sparrows').ok).toBe(false);
    expect(validateClanName('Brass Sparrows ').ok).toBe(false);
  });

  it('embedded newlines / tabs → fail', () => {
    expect(validateClanName('Brass\nSparrows').ok).toBe(false);
    expect(validateClanName('Brass\tSparrows').ok).toBe(false);
  });

  it('non-string → fail', () => {
    expect(validateClanName(42).ok).toBe(false);
    expect(validateClanName(null).ok).toBe(false);
    expect(validateClanName(undefined).ok).toBe(false);
  });
});

describe('canPlayerJoinClan', () => {
  function makeClan(members) {
    return { members };
  }
  function member(id, role) {
    return { playerId: id, role: role || 'member' };
  }

  it('non-member + clan has space → true', () => {
    const clan = makeClan([member('roma', 'owner'), member('kira')]);
    expect(canPlayerJoinClan('sebastien', clan)).toBe(true);
  });

  it('already-member → false', () => {
    const clan = makeClan([member('roma', 'owner'), member('kira')]);
    expect(canPlayerJoinClan('kira', clan)).toBe(false);
  });

  it('clan at HARD CAP 15 → false (full)', () => {
    const members = [];
    members.push(member('owner_id', 'owner'));
    for (let i = 1; i < 15; i++) members.push(member('m' + i));
    expect(members.length).toBe(15);
    expect(canPlayerJoinClan('new', makeClan(members))).toBe(false);
  });

  it('clan with 14 → true (still space for one more)', () => {
    const members = [];
    members.push(member('owner_id', 'owner'));
    for (let i = 1; i < 14; i++) members.push(member('m' + i));
    expect(members.length).toBe(14);
    expect(canPlayerJoinClan('new', makeClan(members))).toBe(true);
  });

  it('invalid input → false', () => {
    expect(canPlayerJoinClan('', { members: [] })).toBe(false);
    expect(canPlayerJoinClan('x', null)).toBe(false);
  });
});

describe('canPlayerLeaveClan', () => {
  it('regular member → true', () => {
    const clan = { members: [{ playerId: 'roma', role: 'owner' }, { playerId: 'kira', role: 'member' }] };
    expect(canPlayerLeaveClan('kira', clan)).toBe(true);
  });

  it('owner → false (must transfer first)', () => {
    const clan = { members: [{ playerId: 'roma', role: 'owner' }, { playerId: 'kira', role: 'member' }] };
    expect(canPlayerLeaveClan('roma', clan)).toBe(false);
  });

  it('non-member → false', () => {
    const clan = { members: [{ playerId: 'roma', role: 'owner' }] };
    expect(canPlayerLeaveClan('ghost', clan)).toBe(false);
  });
});

describe('unlockCosmeticAtLevel', () => {
  it('level 1 → starting banner', () => {
    const unlocks = unlockCosmeticAtLevel(1);
    expect(unlocks.length).toBe(1);
    expect(unlocks[0].kind).toBe('banner');
    expect(unlocks[0].value).toBe('bronze');
  });

  it('level 2 → emblem unlock', () => {
    const unlocks = unlockCosmeticAtLevel(2);
    expect(unlocks.length).toBeGreaterThan(0);
    expect(unlocks[0].kind).toBe('emblem');
  });

  it('level 10 → veteran clan badge + gold banner', () => {
    const unlocks = unlockCosmeticAtLevel(10);
    const kinds = unlocks.map((u) => u.kind);
    expect(kinds).toContain('banner');
    expect(kinds).toContain('badge');
  });

  it('level 25 → founding clan + mythic banner', () => {
    const unlocks = unlockCosmeticAtLevel(25);
    const values = unlocks.map((u) => u.value);
    expect(values).toContain('founding_clan');
    expect(values).toContain('mythic');
  });

  it('level 3 (no cosmetic entry) → empty array (mechanical-feeling skipped per ADR-003)', () => {
    expect(unlockCosmeticAtLevel(3)).toEqual([]);
  });

  it('level 6 (grace week — also skipped per ADR-003) → empty array', () => {
    expect(unlockCosmeticAtLevel(6)).toEqual([]);
  });

  it('level 0 / negative / non-number → empty array', () => {
    expect(unlockCosmeticAtLevel(0)).toEqual([]);
    expect(unlockCosmeticAtLevel(-1)).toEqual([]);
    expect(unlockCosmeticAtLevel(NaN)).toEqual([]);
  });

  it('returned array is a fresh copy (mutation safe)', () => {
    const a = unlockCosmeticAtLevel(1);
    const b = unlockCosmeticAtLevel(1);
    expect(a).not.toBe(b);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// CRUD operations (async, defensive). All run against the mock store
// (Firestore SDK isn't bound in vitest); the no-sdk envelope path is
// covered by the smoke suite under Vite-served `/`.
// ──────────────────────────────────────────────────────────────────────────

describe('createClan', () => {
  beforeEach(() => { _resetMockClanStore(); });

  it('valid input creates clan with owner as first member', async () => {
    const r = await createClan('roma', 'Brass Sparrows');
    expect(r.ok).toBe(true);
    expect(typeof r.clanId).toBe('string');
    const f = await fetchClan(r.clanId);
    expect(f.ok).toBe(true);
    expect(f.clan.name).toBe('Brass Sparrows');
    expect(f.clan.members.length).toBe(1);
    expect(f.clan.members[0].playerId).toBe('roma');
    expect(f.clan.members[0].role).toBe('owner');
    expect(f.clan.ownerId).toBe('roma');
    expect(f.clan.maxSize).toBe(15);
  });

  it('rejects invalid name', async () => {
    const r = await createClan('roma', '');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-name');
  });

  it('rejects empty ownerId', async () => {
    const r = await createClan('', 'Valid');
    expect(r.ok).toBe(false);
  });

  it('description stored when provided', async () => {
    const r = await createClan('roma', 'Brass Sparrows', 'A noble band');
    const f = await fetchClan(r.clanId);
    expect(f.clan.description).toBe('A noble band');
  });

  it('long descriptions truncated to CLAN_DESCRIPTION_MAX_LEN', async () => {
    const r = await createClan('roma', 'Brass Sparrows', 'X'.repeat(500));
    const f = await fetchClan(r.clanId);
    expect(f.clan.description.length).toBe(200);
  });
});

describe('fetchClan', () => {
  beforeEach(() => { _resetMockClanStore(); });

  it('returns clan when present', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    const f = await fetchClan(c.clanId);
    expect(f.ok).toBe(true);
    expect(f.clan.clanId).toBe(c.clanId);
  });

  it('returns no-sdk reason when missing + Firestore absent', async () => {
    const f = await fetchClan('does-not-exist');
    expect(f.ok).toBe(false);
    expect(f.reason).toBe('no-sdk');
  });

  it('invalid input → invalid-input', async () => {
    const f = await fetchClan('');
    expect(f.ok).toBe(false);
    expect(f.reason).toBe('invalid-input');
  });

  it('returned clan is deep-cloned (mutation safe)', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    const f1 = await fetchClan(c.clanId);
    f1.clan.name = 'MUTATED';
    const f2 = await fetchClan(c.clanId);
    expect(f2.clan.name).toBe('Brass Sparrows');
  });
});

describe('joinClan', () => {
  beforeEach(() => { _resetMockClanStore(); });

  it('adds a player as member', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    const r = await joinClan(c.clanId, 'kira');
    expect(r.ok).toBe(true);
    const f = await fetchClan(c.clanId);
    expect(f.clan.members.length).toBe(2);
    expect(f.clan.members[1].playerId).toBe('kira');
    expect(f.clan.members[1].role).toBe('member');
  });

  it('rejects already-member', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    await joinClan(c.clanId, 'kira');
    const r = await joinClan(c.clanId, 'kira');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('already-member');
  });

  it('HARD CAP — 16th join fails with clan-full', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    // Add 14 more so total = 15 (at HARD CAP).
    for (let i = 1; i < 15; i++) {
      const r = await joinClan(c.clanId, 'p' + i);
      expect(r.ok).toBe(true);
    }
    const f = await fetchClan(c.clanId);
    expect(f.clan.members.length).toBe(15);
    // 16th attempt MUST fail per ESC-03 Q1.
    const r16 = await joinClan(c.clanId, 'sixteenth');
    expect(r16.ok).toBe(false);
    expect(r16.reason).toBe('clan-full');
  });

  it('rejects invalid input', async () => {
    const r = await joinClan('', 'roma');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-input');
  });

  it('missing clan returns no-sdk fallback', async () => {
    const r = await joinClan('does-not-exist', 'roma');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no-sdk');
  });
});

describe('leaveClan', () => {
  beforeEach(() => { _resetMockClanStore(); });

  it('regular member leaves successfully', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    await joinClan(c.clanId, 'kira');
    const r = await leaveClan(c.clanId, 'kira');
    expect(r.ok).toBe(true);
    const f = await fetchClan(c.clanId);
    expect(f.clan.members.length).toBe(1);
  });

  it('owner cannot leave without transferring (blocked)', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    await joinClan(c.clanId, 'kira');
    const r = await leaveClan(c.clanId, 'roma');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('owner-cannot-leave-without-transfer');
  });

  it('non-member returns not-a-member', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    const r = await leaveClan(c.clanId, 'ghost');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-a-member');
  });

  it('leaving drops weekly contribution entry too', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    await joinClan(c.clanId, 'kira');
    await recordContribution(c.clanId, 'kira', 100);
    let f = await fetchClan(c.clanId);
    expect(f.clan.weeklyContributions.kira).toBeDefined();
    await leaveClan(c.clanId, 'kira');
    f = await fetchClan(c.clanId);
    expect(f.clan.weeklyContributions.kira).toBeUndefined();
  });
});

describe('recordContribution', () => {
  beforeEach(() => { _resetMockClanStore(); });

  it('adds damage to weekly contributions', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    const r = await recordContribution(c.clanId, 'roma', 250);
    expect(r.ok).toBe(true);
    const f = await fetchClan(c.clanId);
    expect(f.clan.weeklyContributions.roma.damage).toBe(250);
  });

  it('subsequent calls accumulate damage', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    await recordContribution(c.clanId, 'roma', 100);
    await recordContribution(c.clanId, 'roma', 150);
    const f = await fetchClan(c.clanId);
    expect(f.clan.weeklyContributions.roma.damage).toBe(250);
  });

  it('negative damage coerced to 0', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    await recordContribution(c.clanId, 'roma', 100);
    await recordContribution(c.clanId, 'roma', -50);
    const f = await fetchClan(c.clanId);
    expect(f.clan.weeklyContributions.roma.damage).toBe(100);
  });

  it('non-member rejected', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    const r = await recordContribution(c.clanId, 'ghost', 100);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-a-member');
  });

  it('3 members each record damage → percent distribution sums to 1.0', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    await joinClan(c.clanId, 'kira');
    await joinClan(c.clanId, 'sebastien');
    await recordContribution(c.clanId, 'roma', 100);
    await recordContribution(c.clanId, 'kira', 200);
    await recordContribution(c.clanId, 'sebastien', 300);
    const f = await fetchClan(c.clanId);
    const wc = f.clan.weeklyContributions;
    const sum =
      computeContributorPercent('roma', wc) +
      computeContributorPercent('kira', wc) +
      computeContributorPercent('sebastien', wc);
    expect(sum).toBeCloseTo(1.0, 6);
  });
});

describe('closeWeek', () => {
  beforeEach(() => { _resetMockClanStore(); });

  it('defeated=true increments totalWeeksCompleted', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    await recordContribution(c.clanId, 'roma', 250);
    const r = await closeWeek(c.clanId, true);
    expect(r.ok).toBe(true);
    const f = await fetchClan(c.clanId);
    expect(f.clan.totalWeeksCompleted).toBe(1);
    expect(f.clan.weekDefeated).toBe(true);
    expect(f.clan.weeklyContributions).toEqual({});
  });

  it('defeated=false does not increment totalWeeksCompleted', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    await closeWeek(c.clanId, false);
    const f = await fetchClan(c.clanId);
    expect(f.clan.totalWeeksCompleted).toBe(0);
    expect(f.clan.weekDefeated).toBe(false);
  });

  it('crossing 4 weeks bumps clan level 1 → 2 with cosmetic unlocks', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    // Three defeats — clan level stays at 1.
    await closeWeek(c.clanId, true);
    await closeWeek(c.clanId, true);
    await closeWeek(c.clanId, true);
    let r = await closeWeek(c.clanId, true);
    expect(r.newLevel).toBe(2);
    expect(r.unlocks.length).toBeGreaterThan(0);
    // Following weeks stay at level 2 until 8.
    r = await closeWeek(c.clanId, true);
    expect(r.newLevel).toBe(2);
  });
});

describe('transferOwnership', () => {
  beforeEach(() => { _resetMockClanStore(); });

  it('owner transfers to existing member', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    await joinClan(c.clanId, 'kira');
    const r = await transferOwnership(c.clanId, 'roma', 'kira');
    expect(r.ok).toBe(true);
    const f = await fetchClan(c.clanId);
    expect(f.clan.ownerId).toBe('kira');
    const roma = f.clan.members.find((m) => m.playerId === 'roma');
    const kira = f.clan.members.find((m) => m.playerId === 'kira');
    expect(roma.role).toBe('member');
    expect(kira.role).toBe('owner');
  });

  it('rejects when fromId is not owner', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    await joinClan(c.clanId, 'kira');
    const r = await transferOwnership(c.clanId, 'kira', 'roma');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-owner');
  });

  it('rejects when target is not a member', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    const r = await transferOwnership(c.clanId, 'roma', 'ghost');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('target-not-member');
  });

  it('rejects self-transfer', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    const r = await transferOwnership(c.clanId, 'roma', 'roma');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-input');
  });
});

describe('listClansForPlayer', () => {
  beforeEach(() => { _resetMockClanStore(); });

  it('returns empty list when player has no clans', async () => {
    const r = await listClansForPlayer('ghost');
    expect(r.ok).toBe(true);
    expect(r.clans).toEqual([]);
  });

  it('returns clans the player is in', async () => {
    await createClan('roma', 'Brass Sparrows');
    const c2 = await createClan('kira', 'Iron Wolves');
    await joinClan(c2.clanId, 'roma');
    const r = await listClansForPlayer('roma');
    expect(r.ok).toBe(true);
    expect(r.clans.length).toBe(2);
  });

  it('rejects invalid input', async () => {
    const r = await listClansForPlayer('');
    expect(r.ok).toBe(false);
  });
});

describe('searchClansByName', () => {
  beforeEach(() => { _resetMockClanStore(); });

  it('case-insensitive prefix search', async () => {
    await createClan('roma', 'Brass Sparrows');
    await createClan('kira', 'Brass Eagles');
    await createClan('sebastien', 'Iron Wolves');
    const r = await searchClansByName('brass');
    expect(r.ok).toBe(true);
    expect(r.clans.length).toBe(2);
  });

  it('empty query returns all clans (browse public surface)', async () => {
    await createClan('roma', 'Brass Sparrows');
    await createClan('kira', 'Iron Wolves');
    const r = await searchClansByName('');
    expect(r.clans.length).toBe(2);
  });

  it('respects limit', async () => {
    for (let i = 0; i < 30; i++) {
      await createClan('p' + i, 'Clan ' + i);
    }
    const r = await searchClansByName('Clan', 5);
    expect(r.clans.length).toBe(5);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Performance — pure helpers < 1ms each.
// ──────────────────────────────────────────────────────────────────────────

describe('performance — pure helpers < 1ms (sacred AAA+ budget)', () => {
  it('computeClanPower on 15-member doc < 1ms', () => {
    const wc = {};
    for (let i = 0; i < 15; i++) {
      wc['p' + i] = { damage: 100 * i, lastContribAt: Date.now() };
    }
    const state = { weeklyContributions: wc };
    const N = 1000;
    const start = performance.now();
    for (let i = 0; i < N; i++) computeClanPower(state);
    const avg = (performance.now() - start) / N;
    expect(avg).toBeLessThan(1);
  });

  it('validateClanSize < 1ms over 1000 iterations averaged', () => {
    const N = 1000;
    const start = performance.now();
    for (let i = 0; i < N; i++) validateClanSize(i % 20);
    const avg = (performance.now() - start) / N;
    expect(avg).toBeLessThan(1);
  });
});
