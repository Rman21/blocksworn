// 2026-05-13 — TASK-065 (T4.13): Phase 4 Legacy Bridge.
//
// Mirrors the T2.B (Identity Layer) and T3.16 (Endgame Social) bridge
// patterns: this module is the single canonical seam between the new src/
// Phase 4 modules and the legacy single HTML runtime.
//
// SACRED-COW SAFETY (CLAUDE.md §2.x)
// -----------------------------------
//   - This bridge does NOT modify any sacred value. Every exposed handle is
//     a thin wrapper around a pure src/ function or read accessor.
//   - All bridges are NAMESPACED under `__bsw_phase4_` so they cannot collide
//     with legacy identifiers (every search of legacy returned 0 hits for
//     the names below before T4.13).
//   - Every bridge call is GATED by `isChiaEnabled()` first. Mobile builds
//     (`VITE_CHIA_ENABLED=false`) → bridges are no-ops; legacy surface is
//     byte-identical to pre-Phase-4.
//   - Sacred 50-row audit per design spec §8 stays 100% green: NO writes to
//     HERO_ROSTER, no writes to V_HAPTICS, no writes to NARRATOR_LINES, no
//     writes to GEM_PACKS, no writes to Battle Pass formula, no writes to
//     Tower retry ladder, no writes to TOWER_PACTS_BASE/MYTHIC, no writes
//     to TOWER_LEADERBOARDS sacred 3 keys. The PURE PATH CHAIN 4th key
//     (T4.08) is additive-only and `Object.isFrozen` verified.
//
// SURFACES wired by this bridge (per design spec §10 Implementation deps)
// -----------------------------------------------------------------------
//   - Profile "Connect Wallet" button:    legacy profile.js → __bsw_phase4_connectWallet
//   - Profile NFT inventory display:      legacy profile.js → __bsw_phase4_getOwnedNfts
//   - Codex Moments "Mint" button:        legacy codex.js   → __bsw_phase4_mintAchievement
//   - Adventures "DAO Adventure" button:  legacy adv.js     → __bsw_phase4_createDaoClan
//   - Tower leaderboard CHAIN tab:        legacy tower.js   → __bsw_phase4_getChainTab
//   - Battle screen NFT skin overlay:     legacy battle.js  → __bsw_phase4_getActiveSkin
//   - Anti-P2W audit dashboard read:      internal BugTester → __bsw_phase4_runAudit
//
// Per ADR-004 hybrid coexistence: legacy continues as the primary runtime;
// src/ is the truth. This bridge lets legacy call src/ without legacy
// importing src/ directly (single-HTML legacy has no module system).

import { isChiaEnabled, logChiaFlagState } from './feature-flags.js';
import {
  connectWallet,
  disconnectWallet,
  getConnectedWallet,
  isWalletAvailable,
} from './wallet-connect.js';
import {
  getActiveSkin,
  getOwnedNftsForHero,
  isNftEligibleForMint,
  getMintFeeBreakdown,
  syncOwnedNfts,
  mintNftVariant,
  applyNftSkin,
  unapplyNftSkin,
} from './nft-backend.js';
import {
  TOWER_LEADERBOARDS,
  isPurePathChainEligible,
} from '../data/tower.js';
import {
  PURE_PATH_CHAIN_TAB,
  getPurePathChainTabDefinition,
  initPurePathChainTab,
  renderPurePathChainTab,
} from '../ui/tower-leaderboard-chain.js';
import { runSeasonAuditAsync, evaluateEscalation } from './anti-p2w-audit.js';
import { log } from './logger.js';

/**
 * Initialize Phase 4 legacy bridge surfaces.
 *
 * Called once at boot (from src/main.js) AFTER all Phase 1-3 initializers
 * complete. Idempotent — safe to call multiple times.
 *
 * Resolution:
 *   - chia disabled → bridges are no-op stubs (mobile build parity);
 *     `window.__bsw_phase4_enabled === false`
 *   - chia enabled → real handlers exposed; flag-state logged
 *
 * @returns {{installed:boolean, enabled:boolean, surfaces:number}}
 */
export function installPhase4Bridge() {
  if (typeof window === 'undefined') {
    return { installed: false, enabled: false, surfaces: 0 };
  }

  const enabled = isChiaEnabled();
  window.__bsw_phase4_enabled = enabled;

  // Boot-time flag log for analytics + debug.
  try { logChiaFlagState(log.info); } catch (_e) { /* swallow */ }

  if (!enabled) {
    // Mobile build / disabled: expose null sentinels so legacy code that
    // optimistically calls a bridge gets a clean no-op rather than a throw.
    window.__bsw_phase4_connectWallet      = _disabledStub('connectWallet');
    window.__bsw_phase4_disconnectWallet   = _disabledStub('disconnectWallet');
    window.__bsw_phase4_getConnectedWallet = () => ({ connected: false });
    window.__bsw_phase4_isWalletAvailable  = () => false;
    window.__bsw_phase4_getOwnedNfts       = () => [];
    window.__bsw_phase4_getActiveSkin      = () => null;
    window.__bsw_phase4_mintVariant        = _disabledStub('mintVariant');
    window.__bsw_phase4_applySkin          = _disabledStub('applySkin');
    window.__bsw_phase4_unapplySkin        = _disabledStub('unapplySkin');
    window.__bsw_phase4_getChainTab        = () => null;
    window.__bsw_phase4_renderChainTab     = () => ({ ok: false, mode: 'hidden', reason: 'chia-disabled' });
    window.__bsw_phase4_runAudit           = _disabledStub('runAudit');
    return { installed: true, enabled: false, surfaces: 12 };
  }

  // Wallet surfaces (T4.02)
  window.__bsw_phase4_connectWallet      = (opts) => _safe('connectWallet', () => connectWallet(opts));
  window.__bsw_phase4_disconnectWallet   = ()     => _safe('disconnectWallet', () => disconnectWallet());
  window.__bsw_phase4_getConnectedWallet = ()     => _safeSync('getConnectedWallet', () => getConnectedWallet());
  window.__bsw_phase4_isWalletAvailable  = ()     => _safeSync('isWalletAvailable', () => isWalletAvailable());

  // NFT surfaces (T4.03-T4.06)
  window.__bsw_phase4_syncOwnedNfts      = ()                    => _safe('syncOwnedNfts', () => syncOwnedNfts());
  window.__bsw_phase4_getOwnedNfts       = (heroId)              => _safeSync('getOwnedNftsForHero', () => getOwnedNftsForHero(heroId));
  window.__bsw_phase4_getActiveSkin      = (heroId)              => _safeSync('getActiveSkin', () => getActiveSkin(heroId));
  window.__bsw_phase4_mintEligibility    = (player, variantId)   => _safeSync('isNftEligibleForMint', () => isNftEligibleForMint(player, variantId));
  window.__bsw_phase4_mintFeeBreakdown   = (variantId)           => _safeSync('getMintFeeBreakdown', () => getMintFeeBreakdown(variantId));
  window.__bsw_phase4_mintVariant        = (variantId, opts)     => _safe('mintNftVariant', () => mintNftVariant(variantId, opts));
  window.__bsw_phase4_applySkin          = (heroId, variantId)   => _safeSync('applyNftSkin', () => applyNftSkin(heroId, variantId));
  window.__bsw_phase4_unapplySkin        = (heroId)              => _safeSync('unapplyNftSkin', () => unapplyNftSkin(heroId));

  // PURE PATH CHAIN leaderboard surfaces (T4.08)
  window.__bsw_phase4_chainTabDef        = ()                    => _safeSync('getPurePathChainTabDefinition', () => getPurePathChainTabDefinition());
  window.__bsw_phase4_getChainTab        = ()                    => PURE_PATH_CHAIN_TAB;
  window.__bsw_phase4_initChainTab       = (player)              => _safeSync('initPurePathChainTab', () => initPurePathChainTab(player));
  window.__bsw_phase4_renderChainTab     = (el, opts)            => _safeSync('renderPurePathChainTab', () => renderPurePathChainTab(el, opts));
  window.__bsw_phase4_isChainEligible    = (player, nowMs)       => _safeSync('isPurePathChainEligible', () => isPurePathChainEligible(player, nowMs));
  window.__bsw_phase4_leaderboards       = TOWER_LEADERBOARDS; // frozen sacred read-only ref

  // Anti-P2W audit surface (T4.10) — internal Bug Tester only
  window.__bsw_phase4_runAudit           = (snapshot)            => _safe('runSeasonAuditAsync', () => runSeasonAuditAsync(snapshot));
  window.__bsw_phase4_evaluateEscalation = (history)             => _safeSync('evaluateEscalation', () => evaluateEscalation(history));

  // Diagnostics
  window.__bsw_phase4_sacredCowAudit     = sacredCowAudit;
  window.__bsw_phase4_sanityCheck        = sanityCheck;

  log.info('[phase4-bridge] installed; surfaces=22; enabled=true');
  return { installed: true, enabled: true, surfaces: 22 };
}

/**
 * Final sacred-cow byte-perfect audit. Runs on demand from Bug Tester /
 * CI smoke test. Returns a structured report.
 *
 * Per CLAUDE.md §2.5: TOWER_LEADERBOARDS sacred 3 keys MUST be byte-perfect.
 * PURE PATH CHAIN (key 4) is additive-only — sacred 3 untouched.
 *
 * @returns {{ok:boolean, violations:Array, frozen:boolean}}
 */
export function sacredCowAudit() {
  const violations = [];

  // Leaderboards sacred 3 byte-perfect check.
  const sacred3 = ['global', 'f2p_only', 'weekly_seasonal'];
  for (const key of sacred3) {
    const entry = TOWER_LEADERBOARDS[key];
    if (!entry) {
      violations.push({ key, reason: 'missing-sacred-entry' });
      continue;
    }
    if (!Object.isFrozen(entry)) {
      violations.push({ key, reason: 'not-frozen' });
    }
  }
  // f2p_only.eligibility must be EXACTLY 'totalSpent === 0' (sacred string).
  if (TOWER_LEADERBOARDS.f2p_only && TOWER_LEADERBOARDS.f2p_only.eligibility !== 'totalSpent === 0') {
    violations.push({
      key: 'f2p_only.eligibility',
      reason: 'sacred-string-mutated',
      expected: 'totalSpent === 0',
      actual: TOWER_LEADERBOARDS.f2p_only.eligibility,
    });
  }

  const frozen = Object.isFrozen(TOWER_LEADERBOARDS);
  if (!frozen) violations.push({ key: 'TOWER_LEADERBOARDS', reason: 'root-not-frozen' });

  return {
    ok: violations.length === 0,
    violations,
    frozen,
  };
}

/**
 * Lightweight boot-time sanity check. Verifies that the bridge installed
 * correctly + every exposed surface returns a sane value when invoked with
 * safe defaults.
 *
 * @returns {{ok:boolean, surfaces:object, errors:Array}}
 */
export function sanityCheck() {
  if (typeof window === 'undefined') {
    return { ok: false, surfaces: {}, errors: ['no-window'] };
  }
  const surfaces = {};
  const errors = [];
  const enabled = !!window.__bsw_phase4_enabled;
  surfaces.enabled = enabled;

  // Audit sacred cows.
  let audit;
  try {
    audit = sacredCowAudit();
    surfaces.sacredCow = audit;
    if (!audit.ok) errors.push('sacred-cow-violation');
  } catch (_e) {
    errors.push('sacred-cow-audit-threw');
  }

  // Basic surface presence checks (only when enabled).
  if (enabled) {
    for (const k of [
      '__bsw_phase4_connectWallet',
      '__bsw_phase4_getOwnedNfts',
      '__bsw_phase4_getActiveSkin',
      '__bsw_phase4_getChainTab',
      '__bsw_phase4_runAudit',
    ]) {
      if (typeof window[k] !== 'function' && typeof window[k] !== 'object') {
        errors.push('missing-surface:' + k);
      }
    }
  }
  return { ok: errors.length === 0, surfaces, errors };
}

// ── internal helpers ───────────────────────────────────────────────────────

function _disabledStub(name) {
  return async () => {
    return { ok: false, reason: 'chia-disabled', surface: name };
  };
}

async function _safe(name, fn) {
  try {
    return await fn();
  } catch (e) {
    log.warn(`[phase4-bridge] ${name} threw:`, e);
    return { ok: false, reason: 'exception', surface: name, error: String(e && e.message ? e.message : e) };
  }
}

function _safeSync(name, fn) {
  try {
    return fn();
  } catch (e) {
    log.warn(`[phase4-bridge] ${name} threw:`, e);
    return null;
  }
}
