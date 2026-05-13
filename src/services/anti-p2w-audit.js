// 2026-05-13 — TASK-064 (T4.10): Anti-P2W parity audit infrastructure.
//
// Spec: docs/design/chia-integration.md §6.4 (Anti-P2W audit) +
//       Execution Plan §9.5 (Phase 4 Go/No-Go).
//
// PURPOSE
// -------
// This module is a SACRED-COW ENFORCEMENT layer. It exists to statistically
// verify the ADR-003 anti-P2W invariant: NFT-owning F2P players (PURE PATH
// CHAIN, T4.08) MUST NOT outperform pure-F2P players (PURE PATH, sacred §2.5).
//
// If parity metrics diverge measurably between the two leaderboards for 2
// consecutive seasons, this module raises an audit failure that triggers:
//   - ESC to Roman (BLOCKER severity)
//   - Freeze of NFT-mint UI (T4.04 mint disabled) until root cause identified
//
// SACRED-COW SAFETY
// -----------------
// - This module ONLY READS leaderboard / clan / party data — never mutates
// - Pure functional core (deterministic given the same inputs)
// - No sacred-cow data is touched (HERO_ROSTER, V_HAPTICS, NARRATOR_LINES,
//   GEM_PACKS, Battle Pass, Tower retry, TOWER_LEADERBOARDS, TOWER_PACTS_*)
// - All exported async ops gated by isChiaEnabled() (T4.09)
//
// METRICS (per spec §6.4)
// -----------------------
// | Metric                                     | Target          |
// | ------------------------------------------ | --------------- |
// | Mean Tower floor cleared per season        | within 5%       |
// | 90th-percentile Tower floor                | within 5%       |
// | Top-10 player average floor                | within 5%       |
// | Weekly Adventures contribution per member  | within 5%       |
// | Party Tower run-completion rate            | within 5%       |
//
// "within 5%" means: |chain - f2p| / max(chain, f2p) <= 0.05

import { isChiaEnabled } from './feature-flags.js';
import { log } from './logger.js';

/**
 * Sacred audit thresholds. Tuning ANY of these requires ESC + Roman approval
 * (these encode the anti-P2W parity contract per ADR-003).
 */
export const ANTI_P2W_AUDIT_THRESHOLDS = Object.freeze({
  /** Parity tolerance — relative percentage difference allowed between PURE PATH F2P and PURE PATH CHAIN. */
  PARITY_TOLERANCE: 0.05,
  /** Number of consecutive failing seasons that triggers an escalation. */
  CONSECUTIVE_FAILURES_TO_ESCALATE: 2,
  /** Minimum sample size for a metric to be statistically meaningful. */
  MIN_SAMPLE_SIZE: 10,
  /** Top-N player average floor metric. */
  TOP_N: 10,
});

/**
 * Audit metric definitions — keys + display labels.
 * Source of truth for what gets audited.
 */
export const ANTI_P2W_METRICS = Object.freeze({
  MEAN_TOWER_FLOOR:           'mean_tower_floor',
  P90_TOWER_FLOOR:            'p90_tower_floor',
  TOP_N_AVERAGE_FLOOR:        'top_n_average_floor',
  WEEKLY_ADVENTURE_CONTRIB:   'weekly_adventure_contrib_per_member',
  PARTY_TOWER_COMPLETION_RATE:'party_tower_completion_rate',
});

/**
 * Compute the mean of a numeric array.
 * @param {number[]} arr
 * @returns {number} mean or 0 for empty input (no NaN leaks)
 */
export function computeMean(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  let sum = 0;
  let n = 0;
  for (const v of arr) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      sum += v;
      n++;
    }
  }
  return n === 0 ? 0 : sum / n;
}

/**
 * Compute the percentile (0-100) of a numeric array, linear interpolation.
 * @param {number[]} arr
 * @param {number} pct — 0 to 100
 * @returns {number}
 */
export function computePercentile(arr, pct) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return 0;
  const clean = arr.filter(v => typeof v === 'number' && Number.isFinite(v));
  if (clean.length === 0) return 0;
  const sorted = clean.slice().sort((a, b) => a - b);
  const p = Math.max(0, Math.min(100, pct));
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

/**
 * Compute the average of the top-N entries.
 * @param {number[]} arr
 * @param {number} n
 * @returns {number}
 */
export function computeTopNAverage(arr, n) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  const clean = arr.filter(v => typeof v === 'number' && Number.isFinite(v));
  if (clean.length === 0) return 0;
  const k = Math.max(1, Math.min(clean.length, n || ANTI_P2W_AUDIT_THRESHOLDS.TOP_N));
  const sorted = clean.slice().sort((a, b) => b - a);
  return computeMean(sorted.slice(0, k));
}

/**
 * Compute the relative parity delta between two values.
 *   delta = |chain - f2p| / max(chain, f2p)
 *
 * Returns 0 when both are zero (no divergence). Returns 1 (max divergence)
 * when one is zero and the other is positive.
 *
 * @param {number} chainValue
 * @param {number} f2pValue
 * @returns {number} in [0, 1]
 */
export function computeRelativeDelta(chainValue, f2pValue) {
  const a = Number.isFinite(chainValue) ? chainValue : 0;
  const b = Number.isFinite(f2pValue) ? f2pValue : 0;
  if (a === 0 && b === 0) return 0;
  const max = Math.max(Math.abs(a), Math.abs(b));
  if (max === 0) return 0;
  return Math.abs(a - b) / max;
}

/**
 * Per-metric audit. Returns parity report.
 *
 * @param {string} metricName
 * @param {number[]} f2pSamples
 * @param {number[]} chainSamples
 * @returns {{
 *   metric: string,
 *   f2p: number,
 *   chain: number,
 *   delta: number,
 *   passes: boolean,
 *   reason?: string,
 *   sampleSize: { f2p: number, chain: number }
 * }}
 */
export function auditMetric(metricName, f2pSamples, chainSamples) {
  const f2p = Array.isArray(f2pSamples) ? f2pSamples : [];
  const chain = Array.isArray(chainSamples) ? chainSamples : [];
  const sampleSize = { f2p: f2p.length, chain: chain.length };

  // Insufficient sample size → "indeterminate" pass (defer to next season).
  if (
    f2p.length < ANTI_P2W_AUDIT_THRESHOLDS.MIN_SAMPLE_SIZE ||
    chain.length < ANTI_P2W_AUDIT_THRESHOLDS.MIN_SAMPLE_SIZE
  ) {
    return {
      metric: metricName,
      f2p: 0,
      chain: 0,
      delta: 0,
      passes: true,
      reason: 'insufficient-sample-size',
      sampleSize,
    };
  }

  let f2pValue;
  let chainValue;
  switch (metricName) {
    case ANTI_P2W_METRICS.MEAN_TOWER_FLOOR:
      f2pValue = computeMean(f2p);
      chainValue = computeMean(chain);
      break;
    case ANTI_P2W_METRICS.P90_TOWER_FLOOR:
      f2pValue = computePercentile(f2p, 90);
      chainValue = computePercentile(chain, 90);
      break;
    case ANTI_P2W_METRICS.TOP_N_AVERAGE_FLOOR:
      f2pValue = computeTopNAverage(f2p, ANTI_P2W_AUDIT_THRESHOLDS.TOP_N);
      chainValue = computeTopNAverage(chain, ANTI_P2W_AUDIT_THRESHOLDS.TOP_N);
      break;
    case ANTI_P2W_METRICS.WEEKLY_ADVENTURE_CONTRIB:
    case ANTI_P2W_METRICS.PARTY_TOWER_COMPLETION_RATE:
      f2pValue = computeMean(f2p);
      chainValue = computeMean(chain);
      break;
    default:
      return {
        metric: metricName,
        f2p: 0,
        chain: 0,
        delta: 0,
        passes: false,
        reason: 'unknown-metric',
        sampleSize,
      };
  }

  const delta = computeRelativeDelta(chainValue, f2pValue);
  const passes = delta <= ANTI_P2W_AUDIT_THRESHOLDS.PARITY_TOLERANCE;
  return {
    metric: metricName,
    f2p: f2pValue,
    chain: chainValue,
    delta,
    passes,
    sampleSize,
  };
}

/**
 * Run the full season-end audit across all metrics.
 *
 * The `snapshot` shape is:
 * ```
 * {
 *   season: 'season_1' | string,
 *   f2p: {
 *     towerFloors:       number[],  // one entry per F2P player
 *     adventureContribs: number[],
 *     partyCompletions:  number[],
 *   },
 *   chain: {
 *     towerFloors:       number[],
 *     adventureContribs: number[],
 *     partyCompletions:  number[],
 *   }
 * }
 * ```
 *
 * @param {object} snapshot
 * @returns {{
 *   season: string,
 *   passes: boolean,
 *   violations: Array,
 *   metrics: Array,
 *   timestamp: number
 * }}
 */
export function runSeasonAudit(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return {
      season: 'unknown',
      passes: false,
      violations: [{ reason: 'invalid-snapshot' }],
      metrics: [],
      timestamp: Date.now(),
    };
  }

  const f2p = snapshot.f2p || {};
  const chain = snapshot.chain || {};
  const metrics = [];

  metrics.push(auditMetric(ANTI_P2W_METRICS.MEAN_TOWER_FLOOR, f2p.towerFloors || [], chain.towerFloors || []));
  metrics.push(auditMetric(ANTI_P2W_METRICS.P90_TOWER_FLOOR,  f2p.towerFloors || [], chain.towerFloors || []));
  metrics.push(auditMetric(ANTI_P2W_METRICS.TOP_N_AVERAGE_FLOOR, f2p.towerFloors || [], chain.towerFloors || []));
  metrics.push(auditMetric(ANTI_P2W_METRICS.WEEKLY_ADVENTURE_CONTRIB, f2p.adventureContribs || [], chain.adventureContribs || []));
  metrics.push(auditMetric(ANTI_P2W_METRICS.PARTY_TOWER_COMPLETION_RATE, f2p.partyCompletions || [], chain.partyCompletions || []));

  const violations = metrics.filter(m => !m.passes && m.reason !== 'insufficient-sample-size');
  const passes = violations.length === 0;

  return {
    season: typeof snapshot.season === 'string' ? snapshot.season : 'unknown',
    passes,
    violations,
    metrics,
    timestamp: Date.now(),
  };
}

/**
 * Multi-season escalation check.
 * Returns `{shouldEscalate: boolean, reason?, failingSeasons: string[]}`.
 *
 * Per spec §6.4: 2 consecutive failing seasons trigger ESC + freeze of NFT-mint UI.
 *
 * @param {Array<object>} auditHistory — array of runSeasonAudit results, ordered oldest → newest
 * @returns {{shouldEscalate: boolean, reason?: string, failingSeasons: string[]}}
 */
export function evaluateEscalation(auditHistory) {
  if (!Array.isArray(auditHistory) || auditHistory.length === 0) {
    return { shouldEscalate: false, failingSeasons: [] };
  }
  const k = ANTI_P2W_AUDIT_THRESHOLDS.CONSECUTIVE_FAILURES_TO_ESCALATE;
  if (auditHistory.length < k) {
    return { shouldEscalate: false, failingSeasons: [] };
  }
  const lastK = auditHistory.slice(-k);
  const allFailing = lastK.every(a => a && a.passes === false);
  if (!allFailing) {
    return { shouldEscalate: false, failingSeasons: [] };
  }
  return {
    shouldEscalate: true,
    reason: `${k} consecutive seasons failed parity audit — possible P2W leak`,
    failingSeasons: lastK.map(a => a.season),
  };
}

/**
 * Async wrapper: gate by isChiaEnabled() per Phase 4 sacred safety.
 * Returns `{ok:false, reason:'chia-disabled'}` for mobile builds.
 *
 * @param {object} snapshot
 * @returns {Promise<object>}
 */
export async function runSeasonAuditAsync(snapshot) {
  if (!isChiaEnabled()) {
    return { ok: false, reason: 'chia-disabled' };
  }
  try {
    const result = runSeasonAudit(snapshot);
    if (!result.passes) {
      log.warn('[anti-p2w-audit] FAIL', { season: result.season, violations: result.violations.length });
    } else {
      log.debug('[anti-p2w-audit] PASS', { season: result.season });
    }
    return { ok: true, audit: result };
  } catch (e) {
    log.error('[anti-p2w-audit] exception', e);
    return { ok: false, reason: 'exception', error: String(e && e.message ? e.message : e) };
  }
}
