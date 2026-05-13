// 2026-05-13 — TASK-064 (T4.10): Anti-P2W parity audit unit tests.
//
// Sacred-cow safety: this module's PURPOSE is to enforce sacred ADR-003
// anti-P2W invariant statistically. The audit thresholds themselves are
// sacred (modifying requires ESC + Roman approval). Tests here lock the
// thresholds + the parity math.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ANTI_P2W_AUDIT_THRESHOLDS,
  ANTI_P2W_METRICS,
  computeMean,
  computePercentile,
  computeTopNAverage,
  computeRelativeDelta,
  auditMetric,
  runSeasonAudit,
  evaluateEscalation,
  runSeasonAuditAsync,
} from '../../src/services/anti-p2w-audit.js';
import { _setChiaEnabledForTest } from '../../src/services/feature-flags.js';

beforeEach(() => { _setChiaEnabledForTest(null); });
afterEach(() => { _setChiaEnabledForTest(null); });

describe('T4.10 — sacred audit thresholds (modifying these requires ESC)', () => {
  it('PARITY_TOLERANCE is 5% per spec §6.4', () => {
    expect(ANTI_P2W_AUDIT_THRESHOLDS.PARITY_TOLERANCE).toBe(0.05);
  });

  it('CONSECUTIVE_FAILURES_TO_ESCALATE is 2 per spec §6.4', () => {
    expect(ANTI_P2W_AUDIT_THRESHOLDS.CONSECUTIVE_FAILURES_TO_ESCALATE).toBe(2);
  });

  it('TOP_N is 10 (Top-10 player average floor metric)', () => {
    expect(ANTI_P2W_AUDIT_THRESHOLDS.TOP_N).toBe(10);
  });

  it('thresholds are frozen', () => {
    expect(Object.isFrozen(ANTI_P2W_AUDIT_THRESHOLDS)).toBe(true);
  });

  it('all 5 metric keys present (per spec §6.4 table)', () => {
    expect(ANTI_P2W_METRICS.MEAN_TOWER_FLOOR).toBe('mean_tower_floor');
    expect(ANTI_P2W_METRICS.P90_TOWER_FLOOR).toBe('p90_tower_floor');
    expect(ANTI_P2W_METRICS.TOP_N_AVERAGE_FLOOR).toBe('top_n_average_floor');
    expect(ANTI_P2W_METRICS.WEEKLY_ADVENTURE_CONTRIB).toBe('weekly_adventure_contrib_per_member');
    expect(ANTI_P2W_METRICS.PARTY_TOWER_COMPLETION_RATE).toBe('party_tower_completion_rate');
    expect(Object.isFrozen(ANTI_P2W_METRICS)).toBe(true);
  });
});

describe('T4.10 — pure math helpers', () => {
  describe('computeMean', () => {
    it('empty array → 0', () => {
      expect(computeMean([])).toBe(0);
    });

    it('non-array → 0', () => {
      expect(computeMean(null)).toBe(0);
      expect(computeMean(undefined)).toBe(0);
      expect(computeMean('not an array')).toBe(0);
    });

    it('single value → that value', () => {
      expect(computeMean([42])).toBe(42);
    });

    it('multiple values', () => {
      expect(computeMean([10, 20, 30])).toBe(20);
    });

    it('filters NaN / Infinity / strings', () => {
      expect(computeMean([10, 20, 30, NaN, Infinity, '5'])).toBe(20);
    });

    it('all-bogus array → 0', () => {
      expect(computeMean([NaN, Infinity, undefined])).toBe(0);
    });
  });

  describe('computePercentile', () => {
    it('empty array → 0', () => {
      expect(computePercentile([], 90)).toBe(0);
    });

    it('p50 of sorted array', () => {
      expect(computePercentile([1, 2, 3, 4, 5], 50)).toBe(3);
    });

    it('p100 → max', () => {
      expect(computePercentile([1, 2, 3, 4, 5], 100)).toBe(5);
    });

    it('p0 → min', () => {
      expect(computePercentile([1, 2, 3, 4, 5], 0)).toBe(1);
    });

    it('p90 interpolated', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      // idx = 0.9 * 9 = 8.1 → between 9 and 10 → 9.1
      expect(computePercentile(arr, 90)).toBeCloseTo(9.1, 5);
    });

    it('clamps pct to [0,100]', () => {
      expect(computePercentile([1, 2, 3], -10)).toBe(1);
      expect(computePercentile([1, 2, 3], 200)).toBe(3);
    });

    it('single element → that element', () => {
      expect(computePercentile([42], 50)).toBe(42);
    });
  });

  describe('computeTopNAverage', () => {
    it('empty → 0', () => {
      expect(computeTopNAverage([], 10)).toBe(0);
    });

    it('returns top-N descending average', () => {
      expect(computeTopNAverage([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0], 3)).toBe(9);
    });

    it('clamps N to array length', () => {
      expect(computeTopNAverage([5, 10], 100)).toBe(7.5);
    });
  });

  describe('computeRelativeDelta', () => {
    it('both zero → 0', () => {
      expect(computeRelativeDelta(0, 0)).toBe(0);
    });

    it('equal values → 0', () => {
      expect(computeRelativeDelta(50, 50)).toBe(0);
    });

    it('symmetric around max', () => {
      // |60 - 50| / max(60, 50) = 10 / 60 ≈ 0.1667
      expect(computeRelativeDelta(60, 50)).toBeCloseTo(10 / 60, 5);
      expect(computeRelativeDelta(50, 60)).toBeCloseTo(10 / 60, 5);
    });

    it('NaN inputs → 0', () => {
      expect(computeRelativeDelta(NaN, 50)).toBe(50 / 50); // NaN-replaced 0; |0-50|/50 = 1
      expect(computeRelativeDelta(50, NaN)).toBe(50 / 50);
    });
  });
});

describe('T4.10 — auditMetric per-metric', () => {
  const TEN_SAMPLES = [80, 82, 84, 86, 88, 90, 92, 94, 96, 98];

  it('insufficient sample size → passes with reason', () => {
    const r = auditMetric(ANTI_P2W_METRICS.MEAN_TOWER_FLOOR, [50], [60]);
    expect(r.passes).toBe(true);
    expect(r.reason).toBe('insufficient-sample-size');
  });

  it('byte-perfect parity → passes', () => {
    const r = auditMetric(ANTI_P2W_METRICS.MEAN_TOWER_FLOOR, TEN_SAMPLES, TEN_SAMPLES);
    expect(r.passes).toBe(true);
    expect(r.delta).toBe(0);
  });

  it('chain 4% higher → passes (within 5% tolerance)', () => {
    const chain = TEN_SAMPLES.map(v => v * 1.04);
    const r = auditMetric(ANTI_P2W_METRICS.MEAN_TOWER_FLOOR, TEN_SAMPLES, chain);
    expect(r.passes).toBe(true);
    expect(r.delta).toBeCloseTo(0.04 / 1.04, 5);
  });

  it('chain 10% higher → FAILS', () => {
    const chain = TEN_SAMPLES.map(v => v * 1.10);
    const r = auditMetric(ANTI_P2W_METRICS.MEAN_TOWER_FLOOR, TEN_SAMPLES, chain);
    expect(r.passes).toBe(false);
  });

  it('chain 10% LOWER → FAILS (not just outperform — divergence)', () => {
    // Note: anti-P2W is two-sided. If chain massively underperforms, that's also
    // a divergence signal worth investigating (could indicate a perverse incentive).
    const chain = TEN_SAMPLES.map(v => v * 0.90);
    const r = auditMetric(ANTI_P2W_METRICS.MEAN_TOWER_FLOOR, TEN_SAMPLES, chain);
    expect(r.passes).toBe(false);
  });

  it('p90 metric', () => {
    const r = auditMetric(ANTI_P2W_METRICS.P90_TOWER_FLOOR, TEN_SAMPLES, TEN_SAMPLES);
    expect(r.passes).toBe(true);
    expect(r.f2p).toBeCloseTo(96.2, 1);
    expect(r.chain).toBeCloseTo(96.2, 1);
  });

  it('top-N metric', () => {
    const r = auditMetric(ANTI_P2W_METRICS.TOP_N_AVERAGE_FLOOR, TEN_SAMPLES, TEN_SAMPLES);
    expect(r.passes).toBe(true);
    expect(r.f2p).toBe(computeMean(TEN_SAMPLES));
  });

  it('unknown metric → fails with reason', () => {
    const r = auditMetric('bogus_metric', TEN_SAMPLES, TEN_SAMPLES);
    expect(r.passes).toBe(false);
    expect(r.reason).toBe('unknown-metric');
  });

  it('sampleSize reported in result', () => {
    const r = auditMetric(ANTI_P2W_METRICS.MEAN_TOWER_FLOOR, TEN_SAMPLES, TEN_SAMPLES.slice(0, 5));
    expect(r.sampleSize.f2p).toBe(10);
    expect(r.sampleSize.chain).toBe(5);
  });
});

describe('T4.10 — runSeasonAudit full audit', () => {
  const ten = (offset) => Array.from({ length: 12 }, (_, i) => 80 + offset + i);

  it('invalid snapshot → fails with violation', () => {
    const r = runSeasonAudit(null);
    expect(r.passes).toBe(false);
    expect(r.violations.length).toBeGreaterThan(0);
  });

  it('byte-perfect parity snapshot → passes all 5 metrics', () => {
    const snapshot = {
      season: 'season_1',
      f2p:   { towerFloors: ten(0), adventureContribs: ten(0), partyCompletions: ten(0) },
      chain: { towerFloors: ten(0), adventureContribs: ten(0), partyCompletions: ten(0) },
    };
    const r = runSeasonAudit(snapshot);
    expect(r.passes).toBe(true);
    expect(r.violations.length).toBe(0);
    expect(r.metrics.length).toBe(5);
    expect(r.season).toBe('season_1');
  });

  it('chain outperforms by 20% → multiple violations', () => {
    const f2p = ten(0);
    const chain = f2p.map(v => v * 1.20);
    const snapshot = {
      season: 'season_2',
      f2p:   { towerFloors: f2p, adventureContribs: f2p, partyCompletions: f2p },
      chain: { towerFloors: chain, adventureContribs: chain, partyCompletions: chain },
    };
    const r = runSeasonAudit(snapshot);
    expect(r.passes).toBe(false);
    expect(r.violations.length).toBeGreaterThan(0);
  });

  it('insufficient samples skip metric without failing audit', () => {
    const snapshot = {
      season: 'season_3',
      f2p:   { towerFloors: [50], adventureContribs: [50], partyCompletions: [50] },
      chain: { towerFloors: [60], adventureContribs: [60], partyCompletions: [60] },
    };
    const r = runSeasonAudit(snapshot);
    // All metrics return passes:true with reason:insufficient-sample-size
    expect(r.passes).toBe(true);
  });

  it('default season name when missing', () => {
    const r = runSeasonAudit({ f2p: {}, chain: {} });
    expect(r.season).toBe('unknown');
  });

  it('timestamp is recent', () => {
    const before = Date.now();
    const r = runSeasonAudit({ f2p: {}, chain: {} });
    expect(r.timestamp).toBeGreaterThanOrEqual(before);
  });
});

describe('T4.10 — evaluateEscalation consecutive-failure rule', () => {
  it('empty history → no escalation', () => {
    expect(evaluateEscalation([]).shouldEscalate).toBe(false);
  });

  it('non-array → no escalation', () => {
    expect(evaluateEscalation(null).shouldEscalate).toBe(false);
  });

  it('1 failure → not enough (k=2)', () => {
    expect(evaluateEscalation([{ season: 's1', passes: false }]).shouldEscalate).toBe(false);
  });

  it('2 consecutive failures → ESCALATE', () => {
    const r = evaluateEscalation([
      { season: 's1', passes: false },
      { season: 's2', passes: false },
    ]);
    expect(r.shouldEscalate).toBe(true);
    expect(r.failingSeasons).toEqual(['s1', 's2']);
  });

  it('failure then pass → no escalation', () => {
    expect(evaluateEscalation([
      { season: 's1', passes: false },
      { season: 's2', passes: true },
    ]).shouldEscalate).toBe(false);
  });

  it('pass then 2 failures → escalate (last 2 are failures)', () => {
    const r = evaluateEscalation([
      { season: 's1', passes: true },
      { season: 's2', passes: false },
      { season: 's3', passes: false },
    ]);
    expect(r.shouldEscalate).toBe(true);
    expect(r.failingSeasons).toEqual(['s2', 's3']);
  });
});

describe('T4.10 — runSeasonAuditAsync (gated)', () => {
  it('chia disabled → {ok:false, reason:chia-disabled}', async () => {
    _setChiaEnabledForTest(false);
    const r = await runSeasonAuditAsync({ f2p: {}, chain: {} });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('chia-disabled');
  });

  it('chia enabled → {ok:true, audit:{...}}', async () => {
    _setChiaEnabledForTest(true);
    const r = await runSeasonAuditAsync({ season: 's1', f2p: {}, chain: {} });
    expect(r.ok).toBe(true);
    expect(r.audit).toBeDefined();
    expect(r.audit.season).toBe('s1');
  });
});
