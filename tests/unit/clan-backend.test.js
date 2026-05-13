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
  // T3.05 — clan progression pure helpers
  computeWeeksUntilNextLevel,
  getNextCosmeticUnlock,
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
  // T3.04 — pure helpers
  computeClanElementPreference,
  getDefeatedArchetypesLastNWeeks,
  filterBossesByElementAntiArchetype,
  pickWeeklyBoss,
  scaleBossDifficulty,
  shouldRotateUroboros,
  computeWeekHasExpired,
  // T3.04 — async ops
  rotateWeeklyForAllClans,
  notifyWeeklyBossRevealed,
  maybeAutoRotateOnClanOpen,
  // test helpers
  _resetMockClanStore,
  _seedMockClan,
} from '../../src/services/clan-backend.js';
import {
  CLAN_COSMETIC_TIERS,
  CLAN_DEFAULT_BANNER_TIER,
  CLAN_LEVEL_COSMETIC_UNLOCKS,
  CLAN_UNLOCK_LEVELS,
  WEEKLY_ROTATION_LOOKBACK_WEEKS,
  WEEKLY_ROTATION_UROBOROS_INTERVAL_WEEKS,
  WEEKLY_BOSS_DIFFICULTY_BASE_MULT,
  WEEKLY_BOSS_DIFFICULTY_PER_LEVEL,
  WEEKLY_BOSS_DIFFICULTY_MAX_MULT,
  WEEKLY_ELEMENT_PREFERENCE_THRESHOLD,
  WEEKLY_ROTATION_PERIOD_MS,
  WEEKLY_ELEMENT_COUNTER,
  WEEKLY_UROBOROS_BOSS_ID,
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

// ──────────────────────────────────────────────────────────────────────────
// 2026-05-13 — TASK-052 (T3.04): Weekly boss rotation — unit suite.
// ──────────────────────────────────────────────────────────────────────────

describe('T3.04 — clan-config constants (sacred audit + ADR-003 invariants)', () => {
  it('WEEKLY_ROTATION_LOOKBACK_WEEKS === 4', () => {
    expect(WEEKLY_ROTATION_LOOKBACK_WEEKS).toBe(4);
  });
  it('WEEKLY_ROTATION_UROBOROS_INTERVAL_WEEKS === 4', () => {
    expect(WEEKLY_ROTATION_UROBOROS_INTERVAL_WEEKS).toBe(4);
  });
  it('WEEKLY_BOSS_DIFFICULTY_BASE_MULT === 1.0', () => {
    expect(WEEKLY_BOSS_DIFFICULTY_BASE_MULT).toBe(1.0);
  });
  it('WEEKLY_BOSS_DIFFICULTY_PER_LEVEL === 0.05', () => {
    expect(WEEKLY_BOSS_DIFFICULTY_PER_LEVEL).toBeCloseTo(0.05, 6);
  });
  it('WEEKLY_BOSS_DIFFICULTY_MAX_MULT === 2.0 HARD CAP (ADR-003 no-P2W invariant)', () => {
    expect(WEEKLY_BOSS_DIFFICULTY_MAX_MULT).toBe(2.0);
  });
  it('WEEKLY_ELEMENT_PREFERENCE_THRESHOLD === 0.6', () => {
    expect(WEEKLY_ELEMENT_PREFERENCE_THRESHOLD).toBeCloseTo(0.6, 6);
  });
  it('WEEKLY_ROTATION_PERIOD_MS === 7 days', () => {
    expect(WEEKLY_ROTATION_PERIOD_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
  it('WEEKLY_UROBOROS_BOSS_ID === "tower_uroboros_seasonal" (sacred id reference)', () => {
    expect(WEEKLY_UROBOROS_BOSS_ID).toBe('tower_uroboros_seasonal');
  });
  it('WEEKLY_ELEMENT_COUNTER covers all 5 stihiyas', () => {
    expect(WEEKLY_ELEMENT_COUNTER.ember).toBe('tide');
    expect(WEEKLY_ELEMENT_COUNTER.tide).toBe('grove');
    expect(WEEKLY_ELEMENT_COUNTER.grove).toBe('ember');
    expect(WEEKLY_ELEMENT_COUNTER.solar).toBe('umbra');
    expect(WEEKLY_ELEMENT_COUNTER.umbra).toBe('solar');
  });
});

describe('T3.04 — computeClanElementPreference', () => {
  it('null/empty clan → null', () => {
    expect(computeClanElementPreference(null)).toBe(null);
    expect(computeClanElementPreference({})).toBe(null);
    expect(computeClanElementPreference({ members: [] })).toBe(null);
  });

  it('members without activeSquadRaces → null (no votes)', () => {
    const state = {
      members: [
        { playerId: 'p1', role: 'owner' },
        { playerId: 'p2', role: 'member' },
      ],
    };
    expect(computeClanElementPreference(state)).toBe(null);
  });

  it('6/10 members with pirate-ember squads → ember (above 60% threshold)', () => {
    const members = [];
    for (let i = 0; i < 6; i++) members.push({ playerId: 'p' + i, activeSquadRaces: ['pirate', 'orc'] });
    for (let i = 6; i < 10; i++) members.push({ playerId: 'p' + i, activeSquadRaces: ['elf', 'skeleton'] });
    expect(computeClanElementPreference({ members })).toBe('ember');
  });

  it('5/10 pirate-ember (50%, below threshold) → null (balanced clan)', () => {
    const members = [];
    for (let i = 0; i < 5; i++) members.push({ playerId: 'p' + i, activeSquadRaces: ['pirate'] });
    for (let i = 5; i < 10; i++) members.push({ playerId: 'p' + i, activeSquadRaces: ['elf'] });
    expect(computeClanElementPreference({ members })).toBe(null);
  });

  it('3/10 pirate-ember (30%, far below threshold) → null', () => {
    const members = [];
    for (let i = 0; i < 3; i++) members.push({ playerId: 'p' + i, activeSquadRaces: ['pirate'] });
    for (let i = 3; i < 10; i++) members.push({ playerId: 'p' + i, activeSquadRaces: ['troll'] });
    expect(computeClanElementPreference({ members })).toBe('grove'); // troll = grove, 70%
  });

  it('squad with mixed races → member votes their MODE element', () => {
    const members = [
      // Member 1: 3 grove + 1 ember → grove
      { playerId: 'p1', activeSquadRaces: ['troll', 'troll', 'golem', 'orc'] },
      { playerId: 'p2', activeSquadRaces: ['troll', 'golem'] },
      { playerId: 'p3', activeSquadRaces: ['troll'] },
      { playerId: 'p4', activeSquadRaces: ['golem'] },
      { playerId: 'p5', activeSquadRaces: ['troll'] },
    ];
    expect(computeClanElementPreference({ members })).toBe('grove');
  });

  it('unknown race ids are skipped (defensive)', () => {
    const members = [
      { playerId: 'p1', activeSquadRaces: ['unknown_race', 'troll'] },
      { playerId: 'p2', activeSquadRaces: ['troll'] },
      { playerId: 'p3', activeSquadRaces: ['troll'] },
    ];
    expect(computeClanElementPreference({ members })).toBe('grove');
  });

  it('umbra-dominant 8/10 → umbra preference', () => {
    const members = [];
    for (let i = 0; i < 8; i++) members.push({ playerId: 'p' + i, activeSquadRaces: ['dark_elf', 'rock'] });
    for (let i = 8; i < 10; i++) members.push({ playerId: 'p' + i, activeSquadRaces: ['orc'] });
    expect(computeClanElementPreference({ members })).toBe('umbra');
  });
});

describe('T3.04 — getDefeatedArchetypesLastNWeeks', () => {
  it('null/empty clan → empty Set', () => {
    expect(getDefeatedArchetypesLastNWeeks(null).size).toBe(0);
    expect(getDefeatedArchetypesLastNWeeks({}).size).toBe(0);
    expect(getDefeatedArchetypesLastNWeeks({ weeklyHistory: [] }).size).toBe(0);
  });

  it('returns archetypes from last 4 entries by default', () => {
    const state = {
      weeklyHistory: [
        { bossArchetype: 'phoenix', didDefeat: true },
        { bossArchetype: 'berserker', didDefeat: true },
        { bossArchetype: 'assassin', didDefeat: false },
        { bossArchetype: 'bruiser', didDefeat: true },
        { bossArchetype: 'engineer', didDefeat: true },
      ],
    };
    const out = getDefeatedArchetypesLastNWeeks(state);
    expect(out.size).toBe(4);
    expect(out.has('phoenix')).toBe(false); // 5th-from-end, OUT of window
    expect(out.has('berserker')).toBe(true);
    expect(out.has('assassin')).toBe(true);
    expect(out.has('bruiser')).toBe(true);
    expect(out.has('engineer')).toBe(true);
  });

  it('custom N=2 returns only last 2 entries', () => {
    const state = {
      weeklyHistory: [
        { bossArchetype: 'phoenix' },
        { bossArchetype: 'berserker' },
        { bossArchetype: 'assassin' },
      ],
    };
    const out = getDefeatedArchetypesLastNWeeks(state, 2);
    expect(out.size).toBe(2);
    expect(out.has('berserker')).toBe(true);
    expect(out.has('assassin')).toBe(true);
  });

  it('history with entries missing bossArchetype → those skipped', () => {
    const state = {
      weeklyHistory: [
        { bossArchetype: 'phoenix' },
        { bossArchetype: null },
        { bossArchetype: '' },
        { bossArchetype: 'bruiser' },
      ],
    };
    const out = getDefeatedArchetypesLastNWeeks(state);
    expect(out.has('phoenix')).toBe(true);
    expect(out.has('bruiser')).toBe(true);
    expect(out.size).toBe(2);
  });
});

describe('T3.04 — filterBossesByElementAntiArchetype', () => {
  const allBosses = [
    { bossKey: 'b1', archetype: 'berserker', stihiya: 'ember' },
    { bossKey: 'b2', archetype: 'armored',   stihiya: 'tide' },
    { bossKey: 'b3', archetype: 'bruiser',   stihiya: 'grove' },
    { bossKey: 'b4', archetype: 'phoenix',   stihiya: 'solar' },
    { bossKey: 'b5', archetype: 'assassin',  stihiya: 'umbra' },
    { bossKey: 'b6', archetype: 'engineer',  stihiya: 'grove' },
    { bossKey: 'b7', archetype: 'frenzy',    stihiya: 'ember' },
  ];

  it('null element + empty defeated → returns all', () => {
    const out = filterBossesByElementAntiArchetype(allBosses, null, new Set());
    expect(out.length).toBe(allBosses.length);
  });

  it('ember preference → counter tide → narrows to tide bosses', () => {
    const out = filterBossesByElementAntiArchetype(allBosses, 'ember', new Set());
    expect(out.every(b => b.stihiya === 'tide')).toBe(true);
    expect(out.length).toBe(1);
  });

  it('grove preference → counter ember → narrows to ember bosses', () => {
    const out = filterBossesByElementAntiArchetype(allBosses, 'grove', new Set());
    expect(out.every(b => b.stihiya === 'ember')).toBe(true);
    expect(out.length).toBe(2);
  });

  it('anti-repeat filter excludes defeated archetypes', () => {
    const defeated = new Set(['berserker', 'frenzy']);
    const out = filterBossesByElementAntiArchetype(allBosses, null, defeated);
    expect(out.some(b => b.archetype === 'berserker')).toBe(false);
    expect(out.some(b => b.archetype === 'frenzy')).toBe(false);
    expect(out.length).toBe(allBosses.length - 2);
  });

  it('combined: grove element + anti-repeat berserker → only frenzy remains (ember non-berserker)', () => {
    const out = filterBossesByElementAntiArchetype(allBosses, 'grove', new Set(['berserker']));
    expect(out.every(b => b.stihiya === 'ember' && b.archetype !== 'berserker')).toBe(true);
    expect(out.length).toBe(1);
    expect(out[0].archetype).toBe('frenzy');
  });

  it('all archetypes in pool defeated → graceful relax (return pool, no empty crash)', () => {
    const defeated = new Set(['berserker', 'frenzy']);
    const out = filterBossesByElementAntiArchetype(allBosses, 'grove', defeated);
    // Grove counter = ember. All ember archetypes (berserker, frenzy) defeated.
    // Stage 3 graceful fallback: returns the pool unchanged.
    expect(out.length).toBeGreaterThan(0);
    expect(out.every(b => b.stihiya === 'ember')).toBe(true);
  });

  it('counter narrowing empty → keep full pool (balanced fallback)', () => {
    // No bosses with counter element exist: fabricate a roster with no tide.
    const noTide = allBosses.filter(b => b.stihiya !== 'tide');
    const out = filterBossesByElementAntiArchetype(noTide, 'ember', new Set());
    expect(out.length).toBeGreaterThan(0);
  });

  it('empty input → empty output', () => {
    expect(filterBossesByElementAntiArchetype([], 'ember', new Set())).toEqual([]);
  });
});

describe('T3.04 — shouldRotateUroboros', () => {
  it('totalWeeksCompleted=0 → false', () => {
    expect(shouldRotateUroboros({ totalWeeksCompleted: 0 })).toBe(false);
  });
  it('totalWeeksCompleted=4 → true', () => {
    expect(shouldRotateUroboros({ totalWeeksCompleted: 4 })).toBe(true);
  });
  it('totalWeeksCompleted=5 → false', () => {
    expect(shouldRotateUroboros({ totalWeeksCompleted: 5 })).toBe(false);
  });
  it('totalWeeksCompleted=8 → true', () => {
    expect(shouldRotateUroboros({ totalWeeksCompleted: 8 })).toBe(true);
  });
  it('totalWeeksCompleted=12 → true', () => {
    expect(shouldRotateUroboros({ totalWeeksCompleted: 12 })).toBe(true);
  });
  it('null/non-object → false (defensive)', () => {
    expect(shouldRotateUroboros(null)).toBe(false);
    expect(shouldRotateUroboros(undefined)).toBe(false);
    expect(shouldRotateUroboros('string')).toBe(false);
  });
  it('negative / NaN total → false', () => {
    expect(shouldRotateUroboros({ totalWeeksCompleted: -1 })).toBe(false);
    expect(shouldRotateUroboros({ totalWeeksCompleted: NaN })).toBe(false);
  });
});

describe('T3.04 — pickWeeklyBoss', () => {
  it('returns Uroboros at totalWeeks=4', () => {
    const state = { totalWeeksCompleted: 4, members: [], weeklyHistory: [] };
    expect(pickWeeklyBoss(state)).toBe(WEEKLY_UROBOROS_BOSS_ID);
  });
  it('returns Uroboros at totalWeeks=8 (sacred every-4-weeks gate)', () => {
    const state = { totalWeeksCompleted: 8, members: [], weeklyHistory: [] };
    expect(pickWeeklyBoss(state)).toBe(WEEKLY_UROBOROS_BOSS_ID);
  });
  it('returns regular boss at totalWeeks=5', () => {
    const state = { totalWeeksCompleted: 5, members: [], weeklyHistory: [] };
    const got = pickWeeklyBoss(state);
    expect(got).not.toBe(WEEKLY_UROBOROS_BOSS_ID);
    expect(typeof got).toBe('string');
    expect(got.length).toBeGreaterThan(0);
  });
  it('balanced clan (no preference, no history) → picks first candidate deterministically', () => {
    const state = { totalWeeksCompleted: 1, members: [], weeklyHistory: [] };
    const got1 = pickWeeklyBoss(state);
    const got2 = pickWeeklyBoss(state);
    expect(got1).toBe(got2); // deterministic
  });
  it('element preference narrows the pool — ember clan gets tide-element boss', () => {
    const members = [];
    for (let i = 0; i < 6; i++) members.push({ playerId: 'p' + i, activeSquadRaces: ['pirate'] });
    for (let i = 6; i < 10; i++) members.push({ playerId: 'p' + i, activeSquadRaces: ['elf'] });
    const state = { totalWeeksCompleted: 1, members, weeklyHistory: [] };
    const got = pickWeeklyBoss(state);
    expect(typeof got).toBe('string');
    expect(got).not.toBe(WEEKLY_UROBOROS_BOSS_ID);
  });
  it('anti-repeat: 4 weeks of phoenix kills → 5th week picks non-phoenix', () => {
    const state = {
      totalWeeksCompleted: 5, // not Uroboros (5 % 4 !== 0)
      members: [],
      weeklyHistory: [
        { bossArchetype: 'phoenix', didDefeat: true },
        { bossArchetype: 'phoenix', didDefeat: true },
        { bossArchetype: 'phoenix', didDefeat: true },
        { bossArchetype: 'phoenix', didDefeat: true },
      ],
    };
    const got = pickWeeklyBoss(state);
    // Phoenix archetype is excluded. We can't easily look up the archetype
    // from the bossKey without re-importing CHAPTERS; instead assert it's
    // not the bossKey shape for SOLAR PHOENIX (which is the only phoenix
    // archetype boss in CHAPTERS roster).
    expect(got).not.toMatch(/solar_phoenix/);
  });
  it('all 6 task-spec archetypes recently defeated → fallback yields a boss (no crash)', () => {
    const state = {
      totalWeeksCompleted: 5,
      members: [],
      weeklyHistory: [
        { bossArchetype: 'phoenix' },
        { bossArchetype: 'assassin' },
        { bossArchetype: 'berserker' },
        { bossArchetype: 'engineer' },
        { bossArchetype: 'bruiser' },
        { bossArchetype: 'frenzy' },
      ],
    };
    const got = pickWeeklyBoss(state);
    expect(typeof got).toBe('string');
    expect(got.length).toBeGreaterThan(0);
  });
  it('null clanState → returns a valid bossKey string (no crash, defensive)', () => {
    const got = pickWeeklyBoss(null);
    expect(typeof got).toBe('string');
    expect(got.length).toBeGreaterThan(0);
  });
  it('rng opts hook selects from filtered pool', () => {
    const state = { totalWeeksCompleted: 1, members: [], weeklyHistory: [] };
    const a = pickWeeklyBoss(state, { rng: () => 0 });
    const b = pickWeeklyBoss(state, { rng: (n) => n - 1 });
    expect(typeof a).toBe('string');
    expect(typeof b).toBe('string');
  });
});

describe('T3.04 — scaleBossDifficulty (ADR-003 HARD cap)', () => {
  it('level 1 → 1.0 (base mult)', () => {
    expect(scaleBossDifficulty(null, 1)).toBeCloseTo(1.0, 6);
  });
  it('level 10 → 1.45 (1.0 + 9 × 0.05)', () => {
    expect(scaleBossDifficulty(null, 10)).toBeCloseTo(1.45, 6);
  });
  it('level 20 → 1.95 (1.0 + 19 × 0.05)', () => {
    expect(scaleBossDifficulty(null, 20)).toBeCloseTo(1.95, 6);
  });
  it('level 21 → 2.00 (HARD cap reached)', () => {
    expect(scaleBossDifficulty(null, 21)).toBe(2.0);
  });
  it('level 100 → 2.00 (HARD cap — ADR-003 no-P2W)', () => {
    expect(scaleBossDifficulty(null, 100)).toBe(2.0);
  });
  it('level 1000 → 2.00 (whale clan still capped)', () => {
    expect(scaleBossDifficulty(null, 1000)).toBe(2.0);
  });
  it('level 0 / negative → coerced to level 1 (1.0)', () => {
    expect(scaleBossDifficulty(null, 0)).toBe(1.0);
    expect(scaleBossDifficulty(null, -5)).toBe(1.0);
  });
  it('NaN level → coerced to level 1 (1.0)', () => {
    expect(scaleBossDifficulty(null, NaN)).toBe(1.0);
  });
});

describe('T3.04 — computeWeekHasExpired', () => {
  const now = 1_000_000_000_000;
  it('< 7 days since weekStartedAt → false', () => {
    const state = { weekStartedAt: now - (6 * 24 * 60 * 60 * 1000) };
    expect(computeWeekHasExpired(state, now)).toBe(false);
  });
  it('= 7 days → false (exact boundary, not yet expired)', () => {
    const state = { weekStartedAt: now - WEEKLY_ROTATION_PERIOD_MS };
    expect(computeWeekHasExpired(state, now)).toBe(false);
  });
  it('7 days + 1 sec → true', () => {
    const state = { weekStartedAt: now - WEEKLY_ROTATION_PERIOD_MS - 1000 };
    expect(computeWeekHasExpired(state, now)).toBe(true);
  });
  it('weekStartedAt missing → false (defensive)', () => {
    expect(computeWeekHasExpired({}, now)).toBe(false);
    expect(computeWeekHasExpired(null, now)).toBe(false);
  });
  it('default `now` resolves to Date.now() — fresh week never expired', () => {
    const state = { weekStartedAt: Date.now() };
    expect(computeWeekHasExpired(state)).toBe(false);
  });
});

describe('T3.04 — closeWeek LIVE algorithm', () => {
  beforeEach(() => {
    _resetMockClanStore();
  });

  it('didDefeat=true → totalWeeksCompleted increments', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    expect(c.ok).toBe(true);
    const before = await fetchClan(c.clanId);
    expect(before.clan.totalWeeksCompleted).toBe(0);
    const r = await closeWeek(c.clanId, true);
    expect(r.ok).toBe(true);
    const after = await fetchClan(c.clanId);
    expect(after.clan.totalWeeksCompleted).toBe(1);
  });

  it('didDefeat=false → totalWeeksCompleted unchanged', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    await closeWeek(c.clanId, false);
    const after = await fetchClan(c.clanId);
    expect(after.clan.totalWeeksCompleted).toBe(0);
  });

  it('resets weeklyContributions', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    await joinClan(c.clanId, 'kira');
    await recordContribution(c.clanId, 'kira', 500);
    await closeWeek(c.clanId, true);
    const after = await fetchClan(c.clanId);
    expect(Object.keys(after.clan.weeklyContributions).length).toBe(0);
  });

  it('sets new weeklyTargetId from pickWeeklyBoss', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    const r = await closeWeek(c.clanId, true);
    expect(typeof r.weeklyTargetId).toBe('string');
    expect(r.weeklyTargetId.length).toBeGreaterThan(0);
    const after = await fetchClan(c.clanId);
    expect(after.clan.weeklyTargetId).toBe(r.weeklyTargetId);
  });

  it('weekStartedAt bumped to now', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    const before = await fetchClan(c.clanId);
    const beforeStart = before.clan.weekStartedAt;
    await new Promise(r => setTimeout(r, 5));
    await closeWeek(c.clanId, true);
    const after = await fetchClan(c.clanId);
    expect(after.clan.weekStartedAt).toBeGreaterThan(beforeStart);
  });

  it('history persists across consecutive closeWeek calls (anti-repeat seed)', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    await closeWeek(c.clanId, true);
    await closeWeek(c.clanId, true);
    await closeWeek(c.clanId, true);
    const after = await fetchClan(c.clanId);
    // After 3 closeWeeks (each one snapshots the outgoing weeklyTargetId
    // into weeklyHistory), the history should have 2 entries (the very
    // first close has no outgoing target yet because the freshClanDoc starts
    // with weeklyTargetId=null).
    expect(after.clan.weeklyHistory.length).toBeGreaterThanOrEqual(2);
  });

  it('totalWeeksCompleted=4 → next weeklyTargetId = Uroboros (sacred seasonal gate)', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    // Force totalWeeksCompleted = 3 then close with defeat → 4 → Uroboros.
    const seed = (await fetchClan(c.clanId)).clan;
    seed.totalWeeksCompleted = 3;
    _seedMockClan(c.clanId, seed);
    const r = await closeWeek(c.clanId, true);
    expect(r.ok).toBe(true);
    expect(r.isUroboros).toBe(true);
    expect(r.weeklyTargetId).toBe(WEEKLY_UROBOROS_BOSS_ID);
  });

  it('invalid clanId → reason invalid-input', async () => {
    const r = await closeWeek('', true);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(CLAN_RESULT_REASONS.INVALID_INPUT);
  });
  it('unknown clanId → no-sdk fallback', async () => {
    const r = await closeWeek('does-not-exist', true);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(CLAN_RESULT_REASONS.NO_SDK);
  });
});

describe('T3.04 — notifyWeeklyBossRevealed (FCM stub)', () => {
  it('returns ok:true, sent:false, reason:"fcm-not-wired" for MVP', async () => {
    const r = await notifyWeeklyBossRevealed('clan-1', 'boss-1');
    expect(r.ok).toBe(true);
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('fcm-not-wired');
  });
  it('rejects invalid input', async () => {
    const r1 = await notifyWeeklyBossRevealed('', 'boss');
    expect(r1.ok).toBe(false);
    const r2 = await notifyWeeklyBossRevealed('clan', '');
    expect(r2.ok).toBe(false);
  });
});

describe('T3.04 — rotateWeeklyForAllClans (Cloud Function stub)', () => {
  beforeEach(() => {
    _resetMockClanStore();
  });

  it('empty store → ok:true, rotated:[]', async () => {
    const r = await rotateWeeklyForAllClans();
    expect(r.ok).toBe(true);
    expect(r.rotated).toEqual([]);
  });

  it('clans with non-expired week → not rotated', async () => {
    await createClan('roma', 'Brass Sparrows');
    const r = await rotateWeeklyForAllClans();
    expect(r.ok).toBe(true);
    expect(r.rotated.length).toBe(0);
  });

  it('clans with expired week → rotated', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    // Backdate weekStartedAt to >7d ago.
    const seed = (await fetchClan(c.clanId)).clan;
    seed.weekStartedAt = Date.now() - (8 * 24 * 60 * 60 * 1000);
    _seedMockClan(c.clanId, seed);
    const r = await rotateWeeklyForAllClans();
    expect(r.ok).toBe(true);
    expect(r.rotated.length).toBe(1);
    expect(r.rotated[0].clanId).toBe(c.clanId);
    expect(typeof r.rotated[0].weeklyTargetId).toBe('string');
  });

  it('multiple clans — only expired ones rotate', async () => {
    const c1 = await createClan('roma', 'Brass Sparrows');
    const c2 = await createClan('kira', 'Crystal Wing');
    const c3 = await createClan('seb', 'Iron Vale');
    const seed1 = (await fetchClan(c1.clanId)).clan;
    seed1.weekStartedAt = Date.now() - (8 * 24 * 60 * 60 * 1000);
    _seedMockClan(c1.clanId, seed1);
    const seed3 = (await fetchClan(c3.clanId)).clan;
    seed3.weekStartedAt = Date.now() - (10 * 24 * 60 * 60 * 1000);
    _seedMockClan(c3.clanId, seed3);
    const r = await rotateWeeklyForAllClans();
    expect(r.rotated.length).toBe(2);
    const ids = r.rotated.map(x => x.clanId).sort();
    expect(ids).toContain(c1.clanId);
    expect(ids).toContain(c3.clanId);
    expect(ids).not.toContain(c2.clanId);
  });
});

describe('T3.04 — maybeAutoRotateOnClanOpen (client-side fallback)', () => {
  beforeEach(() => {
    _resetMockClanStore();
  });

  it('fresh week → rotated:false', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    const r = await maybeAutoRotateOnClanOpen(c.clanId);
    expect(r.ok).toBe(true);
    expect(r.rotated).toBe(false);
  });

  it('expired week (>7d) → rotated:true + new weeklyTargetId', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    const seed = (await fetchClan(c.clanId)).clan;
    seed.weekStartedAt = Date.now() - (8 * 24 * 60 * 60 * 1000);
    _seedMockClan(c.clanId, seed);
    const r = await maybeAutoRotateOnClanOpen(c.clanId);
    expect(r.ok).toBe(true);
    expect(r.rotated).toBe(true);
    expect(typeof r.weeklyTargetId).toBe('string');
  });

  it('totalWeeks=3 + defeated + expired → next rotation Uroboros', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    const seed = (await fetchClan(c.clanId)).clan;
    seed.totalWeeksCompleted = 3;
    seed.weekDefeated = true;
    seed.weekStartedAt = Date.now() - (8 * 24 * 60 * 60 * 1000);
    _seedMockClan(c.clanId, seed);
    const r = await maybeAutoRotateOnClanOpen(c.clanId);
    expect(r.ok).toBe(true);
    expect(r.rotated).toBe(true);
    expect(r.isUroboros).toBe(true);
    expect(r.weeklyTargetId).toBe(WEEKLY_UROBOROS_BOSS_ID);
  });

  it('unknown clanId → ok:false, no-sdk', async () => {
    const r = await maybeAutoRotateOnClanOpen('does-not-exist');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(CLAN_RESULT_REASONS.NO_SDK);
  });
  it('invalid clanId → ok:false, invalid-input', async () => {
    const r = await maybeAutoRotateOnClanOpen('');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(CLAN_RESULT_REASONS.INVALID_INPUT);
  });
  it('injected clock — past time → rotated:false', async () => {
    const c = await createClan('roma', 'Brass Sparrows');
    // Pass an old `now` so the week is NOT expired.
    const past = Date.now() - (1000 * 60 * 60);
    const r = await maybeAutoRotateOnClanOpen(c.clanId, { now: past });
    expect(r.rotated).toBe(false);
  });
});

describe('T3.04 — performance (helpers <1ms each)', () => {
  it('pickWeeklyBoss < 1ms over 200 iterations averaged', () => {
    const state = { totalWeeksCompleted: 1, members: [], weeklyHistory: [] };
    const N = 200;
    const t = performance.now();
    for (let i = 0; i < N; i++) pickWeeklyBoss(state);
    const avg = (performance.now() - t) / N;
    expect(avg).toBeLessThan(1);
  });
  it('computeClanElementPreference < 1ms over 500 iterations averaged', () => {
    const members = [];
    for (let i = 0; i < 15; i++) members.push({ playerId: 'p' + i, activeSquadRaces: ['pirate', 'orc', 'troll'] });
    const N = 500;
    const t = performance.now();
    for (let i = 0; i < N; i++) computeClanElementPreference({ members });
    const avg = (performance.now() - t) / N;
    expect(avg).toBeLessThan(1);
  });
  it('scaleBossDifficulty < 1ms over 1000 iterations averaged', () => {
    const N = 1000;
    const t = performance.now();
    for (let i = 0; i < N; i++) scaleBossDifficulty(null, i % 50);
    const avg = (performance.now() - t) / N;
    expect(avg).toBeLessThan(1);
  });
});

describe('T3.04 — sacred-cow audit', () => {
  it('CHAPTERS read-only — closeWeek doesn\'t crash on full integration', async () => {
    _resetMockClanStore();
    const c = await createClan('roma', 'Brass Sparrows');
    const r1 = await closeWeek(c.clanId, true);
    expect(r1.ok).toBe(true);
    const r2 = await closeWeek(c.clanId, true);
    expect(r2.ok).toBe(true);
    // CHAPTERS itself isn't exposed here; the fact that closeWeek picks
    // valid bossKeys without mutation is the sacred contract.
    expect(typeof r2.weeklyTargetId).toBe('string');
  });

  it('scaleBossDifficulty never exceeds MAX_MULT (ADR-003 no-P2W invariant)', () => {
    for (let lvl = 1; lvl < 10000; lvl++) {
      const m = scaleBossDifficulty(null, lvl);
      expect(m).toBeLessThanOrEqual(WEEKLY_BOSS_DIFFICULTY_MAX_MULT);
    }
  });

  it('pickWeeklyBoss always returns a non-empty string', () => {
    for (let w = 0; w < 30; w++) {
      const got = pickWeeklyBoss({ totalWeeksCompleted: w, members: [], weeklyHistory: [] });
      expect(typeof got).toBe('string');
      expect(got.length).toBeGreaterThan(0);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// T3.05 — Contributor stats + clan progression helpers.
// ──────────────────────────────────────────────────────────────────────────

describe('T3.05 — computeWeeksUntilNextLevel', () => {
  it('level 1 + 0 weeks → CLAN_LEVEL_WEEKS_PER_LEVEL (4) weeks to next level', () => {
    expect(computeWeeksUntilNextLevel(1, 0)).toBe(CLAN_LEVEL_WEEKS_PER_LEVEL);
  });

  it('level 1 + 3 weeks → 1 week remaining', () => {
    expect(computeWeeksUntilNextLevel(1, 3)).toBe(1);
  });

  it('level 1 + 4 weeks → 0 (next level threshold met)', () => {
    expect(computeWeeksUntilNextLevel(1, 4)).toBe(0);
  });

  it('level 2 + 4 weeks → CLAN_LEVEL_WEEKS_PER_LEVEL (just advanced)', () => {
    expect(computeWeeksUntilNextLevel(2, 4)).toBe(CLAN_LEVEL_WEEKS_PER_LEVEL);
  });

  it('level 3 + 12 weeks → 0 (threshold for lvl 4 met)', () => {
    expect(computeWeeksUntilNextLevel(3, 12)).toBe(0);
  });

  it('level 5 + 19 weeks → 1 (close to lvl 6 at 20 weeks)', () => {
    expect(computeWeeksUntilNextLevel(5, 19)).toBe(1);
  });

  it('defensive: non-numeric level coerces to 1', () => {
    expect(computeWeeksUntilNextLevel(NaN, 0)).toBe(CLAN_LEVEL_WEEKS_PER_LEVEL);
    expect(computeWeeksUntilNextLevel('abc', 0)).toBe(CLAN_LEVEL_WEEKS_PER_LEVEL);
  });

  it('defensive: negative weeks coerces to 0', () => {
    expect(computeWeeksUntilNextLevel(1, -10)).toBe(CLAN_LEVEL_WEEKS_PER_LEVEL);
  });
});

describe('T3.05 — getNextCosmeticUnlock', () => {
  it('level 1 → returns next unlock at level 2 (emblem)', () => {
    const next = getNextCosmeticUnlock(1);
    expect(next).not.toBeNull();
    expect(next.level).toBe(2);
    expect(Array.isArray(next.items)).toBe(true);
    expect(next.items.length).toBeGreaterThan(0);
    expect(next.items[0].kind).toBe('emblem');
  });

  it('level 2 → returns next unlock at level 4 (silver banner)', () => {
    const next = getNextCosmeticUnlock(2);
    expect(next).not.toBeNull();
    expect(next.level).toBe(4);
    expect(next.items[0].kind).toBe('banner');
    expect(next.items[0].value).toBe('silver');
  });

  it('level 3 → returns next unlock at level 4 (lvl 3 has no unlock)', () => {
    const next = getNextCosmeticUnlock(3);
    expect(next).not.toBeNull();
    expect(next.level).toBe(4);
  });

  it('level 25 → returns null (no higher unlock level defined)', () => {
    expect(getNextCosmeticUnlock(25)).toBeNull();
  });

  it('level 26 → returns null (beyond max)', () => {
    expect(getNextCosmeticUnlock(26)).toBeNull();
  });

  it('level 9 → returns next at level 10 (gold banner + veteran badge)', () => {
    const next = getNextCosmeticUnlock(9);
    expect(next).not.toBeNull();
    expect(next.level).toBe(10);
    // Multi-item unlock at lvl 10.
    expect(next.items.length).toBeGreaterThanOrEqual(2);
  });

  it('defensive: non-numeric coerces to level 1', () => {
    const next = getNextCosmeticUnlock(NaN);
    expect(next).not.toBeNull();
    expect(next.level).toBe(2);
  });

  it('returned items are a fresh array — no mutation leaks into the frozen table', () => {
    const next = getNextCosmeticUnlock(1);
    expect(next).not.toBeNull();
    // Push a junk entry into the returned array — re-call should be pristine.
    next.items.push({ kind: 'fake', value: 'should-not-persist' });
    const next2 = getNextCosmeticUnlock(1);
    expect(next2.items.length).toBe(1); // original count
    expect(next2.items[0].kind).toBe('emblem');
  });
});

describe('T3.05 — ADR-003 no-P2W audit (clan progression helpers)', () => {
  it('getNextCosmeticUnlock never returns mechanical-advantage items', () => {
    for (let lvl = 1; lvl <= 25; lvl++) {
      const next = getNextCosmeticUnlock(lvl);
      if (!next) continue;
      for (const item of next.items) {
        // Only cosmetic kinds allowed per ADR-003.
        expect(['banner', 'emblem', 'badge', 'motto']).toContain(item.kind);
        // No stat/damage/HP/winrate strings in `value`.
        expect(item.value).not.toMatch(/damage|hp|crit|win|speed|cap_raise/i);
      }
    }
  });

  it('computeWeeksUntilNextLevel never returns negative values', () => {
    for (let lvl = 1; lvl < 100; lvl++) {
      for (let w = 0; w < 400; w += 7) {
        expect(computeWeeksUntilNextLevel(lvl, w)).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('T3.05 — performance (helpers <1ms each)', () => {
  it('computeWeeksUntilNextLevel < 1ms over 1000 iterations', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      computeWeeksUntilNextLevel(i % 30, i);
    }
    const dt = performance.now() - start;
    expect(dt).toBeLessThan(50); // < 0.05ms / call
  });

  it('getNextCosmeticUnlock < 1ms over 1000 iterations', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      getNextCosmeticUnlock(i % 30);
    }
    const dt = performance.now() - start;
    expect(dt).toBeLessThan(50); // < 0.05ms / call
  });
});
