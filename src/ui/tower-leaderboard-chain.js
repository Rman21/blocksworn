// 2026-05-13 — TASK-063 (T4.08): PURE PATH CHAIN leaderboard UI.
//
// Spec: docs/design/chia-integration.md §6.3 (display) + §6.4 (anti-P2W audit).
//
// Sacred-cow safety:
//   - Renders the 4th additive tab/column for `TOWER_LEADERBOARDS.f2p_walleted`.
//   - Sacred 3 tabs (global, f2p_only, weekly_seasonal) belong to the legacy
//     modal — this module ONLY mounts the additive 4th tab.
//   - Gated by `isChiaEnabled()` (T4.09): when flag is false, mount is a no-op
//     and the tab is not surfaced. Mobile builds therefore see the 3-tab
//     sacred surface unchanged.
//   - F2P-web players (no wallet) see the tab as a faint / disabled state
//     per spec §6.3 — transparency without participation.
//   - Live entry data flows in once T4.02 wallet connect + T4.03 NFT data
//     model land; until then the renderer shows an "Awaiting NFT launch"
//     placeholder per AAA+ FTUE expectation (no "broken empty state").
//
// Integration:
//   - Legacy modal wire-up is T4.13 Legacy Bridge (per Phase 3 pattern).
//   - Direct-import-discipline: consumers `import { renderPurePathChainTab }
//     from '../ui/tower-leaderboard-chain.js'`.
//
// ADR-003 anti-P2W invariant:
//   - PURE PATH F2P criterion (`totalSpent === 0`) preserved verbatim in
//     eligibility (enforced in src/data/tower.js isPurePathChainEligible).
//   - The PURE PATH CHAIN column is a PARITY SURFACE — its purpose is to
//     statistically verify that NFT-owning F2P players do NOT outperform
//     pure-F2P players. The Anti-P2W audit (T4.10) consumes this column.

import { TOWER_LEADERBOARDS } from '../data/tower.js';
import { isChiaEnabled } from '../services/feature-flags.js';
import { log } from '../services/logger.js';

/**
 * Sentinel exported value: the canonical 4th-tab metadata block used by the
 * Legacy Bridge (T4.13) to identify and inject the additive tab without
 * mutating sacred 3-tab definitions.
 */
export const PURE_PATH_CHAIN_TAB = Object.freeze({
  key:        'f2p_walleted',
  label:      'PURE PATH CHAIN',
  shortLabel: 'CHAIN',
  iconChar:   '⛓',
  requiresChiaEnabled: true,
});

/**
 * Pure helper: returns the tab definition when chia-enabled, null otherwise.
 *
 * Consumers (T4.13 Legacy Bridge) call this once at modal-open time and
 * inject the tab only if return value is non-null. Mobile builds (flag false)
 * therefore byte-perfect-mirror the sacred 3-tab surface.
 *
 * @returns {object|null}
 */
export function getPurePathChainTabDefinition() {
  if (!isChiaEnabled()) return null;
  return PURE_PATH_CHAIN_TAB;
}

/**
 * Pure helper: returns the runtime player-state-aware tab interactivity mode.
 *
 *   'active'      — player is wallet-connected + NFT-eligible (writes own row)
 *   'browseable'  — chia-enabled but player not eligible (read-only)
 *   'hidden'      — chia disabled (mobile build) — tab not rendered at all
 *
 * Per spec §6.3 — F2P web players (no wallet) see the tab as faint/disabled
 * but can browse the rankings for transparency.
 *
 * @param {object} player — { totalSpent, walletConnected, lastNftMintAt }
 * @returns {'active'|'browseable'|'hidden'}
 */
export function getPurePathChainTabMode(player) {
  if (!isChiaEnabled()) return 'hidden';
  if (!player || typeof player !== 'object') return 'browseable';
  if (player.walletConnected === true && player.totalSpent === 0) {
    const ts = typeof player.lastNftMintAt === 'number' ? player.lastNftMintAt : 0;
    const NINETY_D_MS = 90 * 24 * 60 * 60 * 1000;
    if (ts > 0 && (Date.now() - ts) <= NINETY_D_MS) return 'active';
  }
  return 'browseable';
}

/**
 * Render the PURE PATH CHAIN tab content into a container element.
 *
 * V1 (this task): placeholder content with the parity-surface narrative.
 * V2 (post-T4.05 NFT mint): live entries from chain-indexer.
 *
 * @param {HTMLElement|null} containerEl — target div to populate
 * @param {object} [opts]
 *   - {Array}  entries     — leaderboard rows [{ address, displayName, floor, rank }]
 *   - {object} player      — for tab-mode resolution
 *   - {string} seasonLabel — optional "Season 1 · Week 3 / 13"
 * @returns {{ok:boolean, mode:string, reason?:string}}
 */
export function renderPurePathChainTab(containerEl, opts) {
  if (!isChiaEnabled()) {
    return { ok: false, mode: 'hidden', reason: 'chia-disabled' };
  }
  if (!containerEl || typeof containerEl.appendChild !== 'function') {
    return { ok: false, mode: 'hidden', reason: 'invalid-container' };
  }

  const o = opts && typeof opts === 'object' ? opts : {};
  const mode = getPurePathChainTabMode(o.player);

  // Clear container — caller owns lifecycle, we own contents.
  try { containerEl.replaceChildren(); } catch (_e) { containerEl.innerHTML = ''; }

  const root = document.createElement('div');
  root.className = `tower-lb-chain tower-lb-chain--${mode}`;
  root.dataset.tab = PURE_PATH_CHAIN_TAB.key;

  // Header
  const header = document.createElement('div');
  header.className = 'tower-lb-chain__header';
  const title = document.createElement('h3');
  title.className = 'tower-lb-chain__title';
  title.textContent = `${PURE_PATH_CHAIN_TAB.iconChar} ${PURE_PATH_CHAIN_TAB.label}`;
  header.appendChild(title);
  if (typeof o.seasonLabel === 'string' && o.seasonLabel.length > 0) {
    const sub = document.createElement('div');
    sub.className = 'tower-lb-chain__season';
    sub.textContent = o.seasonLabel;
    header.appendChild(sub);
  }
  root.appendChild(header);

  // Subtle mode badge (faint when browseable, live when active)
  const modeBadge = document.createElement('div');
  modeBadge.className = `tower-lb-chain__mode-badge tower-lb-chain__mode-badge--${mode}`;
  modeBadge.textContent = mode === 'active' ? 'YOUR LEADERBOARD' : 'PARITY SURFACE — PEEK';
  root.appendChild(modeBadge);

  // Entries OR empty-state. AAA+ FTUE: never show "0 results" raw.
  const entries = Array.isArray(o.entries) ? o.entries : [];
  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'tower-lb-chain__empty';
    empty.textContent = 'Awaiting first verified NFT-walleted runs. Chain leaderboard goes live with mainnet launch.';
    root.appendChild(empty);
  } else {
    const list = document.createElement('ol');
    list.className = 'tower-lb-chain__list';
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!e || typeof e !== 'object') continue;
      const li = document.createElement('li');
      li.className = 'tower-lb-chain__row';
      const rank = document.createElement('span');
      rank.className = 'tower-lb-chain__rank';
      rank.textContent = String(e.rank || (i + 1));
      const name = document.createElement('span');
      name.className = 'tower-lb-chain__name';
      name.textContent = e.displayName || _truncateAddress(e.address);
      const floor = document.createElement('span');
      floor.className = 'tower-lb-chain__floor';
      floor.textContent = `Floor ${e.floor || 0}`;
      li.appendChild(rank); li.appendChild(name); li.appendChild(floor);
      list.appendChild(li);
    }
    root.appendChild(list);
  }

  // ADR-003 parity-surface caption (sacred narrative — always visible)
  const caption = document.createElement('div');
  caption.className = 'tower-lb-chain__parity-caption';
  caption.textContent = 'Parity verified seasonally — NFT players must not outperform pure-F2P.';
  root.appendChild(caption);

  containerEl.appendChild(root);
  return { ok: true, mode };
}

function _truncateAddress(addr) {
  if (typeof addr !== 'string' || addr.length === 0) return 'anon';
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

/**
 * Convenience helper for the Legacy Bridge (T4.13): exposes a single boot
 * mount point that returns the tab definition + initial mode for a player.
 *
 * @param {object} player
 * @returns {{enabled:boolean, definition: object|null, mode:string}}
 */
export function initPurePathChainTab(player) {
  const def = getPurePathChainTabDefinition();
  if (!def) {
    return { enabled: false, definition: null, mode: 'hidden' };
  }
  return { enabled: true, definition: def, mode: getPurePathChainTabMode(player) };
}

// Sanity-check at import — non-blocking, debug only.
try {
  if (!TOWER_LEADERBOARDS || !TOWER_LEADERBOARDS.f2p_walleted) {
    log.warn('[T4.08] TOWER_LEADERBOARDS.f2p_walleted missing — chain tab will not render');
  }
} catch (_e) { /* swallow */ }
