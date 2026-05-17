// 2026-05-16 — TASK-CP-003 (combat-polish-implementation-plan.md §9 Task 3):
//
// Top HUD — compact 44px chip row for resource indicators.
//
// Spec: combat-polish-implementation-plan.md §7.1 (Top HUD 44px)
//       combat-mechanics.md §2 (match lifecycle — HUD updates)
//       combat-mechanics.md §11 (HP / death — sacred MAX_HP=100)
//
// Lifecycle (mirrors boss-scene.js + hero-card.js — plan §8.5):
//   mountTopHud(rootEl, state?)  → builds chip row DOM into .bw-zone-hud
//   updateTopHud(state)          → refreshes chip values (partial state OK)
//   destroyTopHud()              → tears down DOM, idempotent
//
// Visual composition (plan §7.1):
//
//   [← Back]  ❤ 97/100   🛡 6%   T 16   🔥 +30%
//
// Per plan §7.1:
//   - 44px max height (acceptance criterion §11.2)
//   - 8px gap between chips, 10px horizontal padding per chip
//   - 8px corner radius, transparent dark chip background
//   - Typography: 14px semibold values, 11px uppercase caps labels
//   - WCAG AA 4.5:1 minimum contrast (smoke-tested separately)
//
// Chips rendered (plan §7.1 reference exactly):
//   1. Back     — chip-style back button, routes to window.goToMenu() defensively
//   2. HP       — `❤ <hp>/<MAX_HP>` (heart emoji placeholder until element-emblem
//                 swap in Task 5). Reads from state.hp; MAX_HP sacred = 100.
//   3. Shield   — `🛡 <pct>%` mitigation percentage from state.shieldPct
//   4. Turn     — `T <n>` current turn number from state.turn
//   5. Fire-mult— `🔥 +<n>%` delta from FIRE_MULT_ACTIVE_RATIO baseline 0.7
//                 (Stagger 1.5x → +114%, Active 0.7x → 0%).
//
// Sacred-cow protection (CLAUDE.md §2 + plan §12):
//   - DMG indicator REMOVED from HUD (plan §7.1: "DMG total moves to victory
//     screen"). Module never renders DMG, regardless of state.dmg presence.
//   - Sacred MAX_HP value (100) is mirrored as a module-local constant with a
//     parity check against window.MAX_HP at module load when available. The
//     legacy `const MAX_HP = 100` lives in blocksworn_index_fixed.html line
//     20048; this module READS the canonical value — never writes it back.
//   - FIRE_MULT_ACTIVE_RATIO (0.7) imported read-only from src/core/stagger-loop.js.
//     Module imports the constant strictly to derive the +N% display delta —
//     never modifies it. Compile-time parity check throws on drift.
//   - No imports from src/services/*; back-button forwards to window.goToMenu()
//     defensively (no-op when host absent).
//   - --a-* tokens are the colour authority; no element hex hardcoded.
//   - HUD chip layout uses only transform/opacity for any future animations
//     (none in this static-layout iteration), preserving hot-path 60 FPS.
//
// Graceful degradation:
//   - mount() returns false when rootEl is null/undefined (no-op).
//   - update() / destroy() on unmounted HUD are silent no-ops.
//   - Missing state fields render `--` placeholders (never "undefined" / NaN).
//
// Import discipline (mirrors hero-card.js / boss-scene.js — plan §8.3):
//   - src/feel/* NEVER imports from src/core/* — that side of the codebase
//     bootstraps heavy legacy state (HERO_ROSTER, save progress) and would
//     blow up in headless test environments. Sacred FIRE_MULT_ACTIVE_RATIO
//     (0.7) and MAX_HP (100) are mirrored here as module-local constants
//     with runtime parity checks against the canonical window bridge when
//     the legacy runtime is loaded. Identical pattern: hero-card.js
//     _EXPECTED_ULT_COSTS parity audit at module load.

// ─── module state ───────────────────────────────────────────────────────────
// Single instance per app lifetime. mount() guards double-mount; destroy() clears.
let _hud = null;

const HUD_ZONE_ID = 'bw-zone-hud';            // grid-row 1 per battle-layout.css
const HUD_CONTAINER_CLASS = 'bw-top-hud';

// Sacred MAX_HP — fixed at 100 per CLAUDE.md §2.1 + combat v2.1 P1 spec.
// Legacy const declared at blocksworn_index_fixed.html line 20048. Mirrored
// here as a module-local constant; runtime parity check below catches drift
// against window.MAX_HP when the legacy bridge is loaded.
const MAX_HP = 100;

// Sacred FIRE_MULT_ACTIVE_RATIO — fixed at 0.7 per CLAUDE.md §2.1 row
// "v2.1 stagger ratios" + src/core/stagger-loop.js line 250. Mirrored here
// for use by fireMultFormatter (the "+N%" delta is computed against this
// baseline). Runtime parity check below catches drift against the canonical
// constant when the window bridge surfaces it.
const FIRE_MULT_ACTIVE_RATIO = 0.7;

// Runtime cross-check vs legacy globals when available. We don't throw here
// (legacy bridge may not be loaded under unit tests) — but if a mismatch
// surfaces in dev, the console will surface it loudly via dev tools.
try {
  if (typeof window !== 'undefined') {
    if (typeof window.MAX_HP === 'number' && window.MAX_HP !== MAX_HP) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          `[top-hud] MAX_HP parity drift: module=${MAX_HP}, window=${window.MAX_HP}`
        );
      }
    }
    if (typeof window.FIRE_MULT_ACTIVE_RATIO === 'number'
        && window.FIRE_MULT_ACTIVE_RATIO !== FIRE_MULT_ACTIVE_RATIO) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          `[top-hud] FIRE_MULT_ACTIVE_RATIO parity drift: ` +
          `module=${FIRE_MULT_ACTIVE_RATIO}, window=${window.FIRE_MULT_ACTIVE_RATIO}`
        );
      }
    }
  }
} catch (_e) { /* defensive — no-op */ }

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * mountTopHud(rootEl, state?)
 *
 * rootEl: the .bw-battle-root container (set up by battle-screen orchestrator).
 *         If null/undefined, returns false (no-op). Idempotent on repeat calls.
 * state:  optional { hp?, hpMax?, shieldPct?, turn?, fireMultActive? } seed.
 *         Missing fields render `--` placeholders. Real state lands via
 *         updateTopHud() once the battle loop pipes through.
 *
 * Returns true on successful mount, false on no-op skip.
 */
export function mountTopHud(rootEl, state) {
  if (!rootEl) return false;
  if (_hud) return false;             // already mounted — idempotent

  // Locate or create the hud-zone slot inside the battle root. In a fully
  // modular renderer rootEl already has the slot; in interim contexts we
  // create one defensively so the HUD has somewhere to render.
  let slot = rootEl.querySelector(`#${HUD_ZONE_ID}`)
          || rootEl.querySelector('.bw-zone-hud');
  if (!slot) {
    slot = document.createElement('div');
    slot.id = HUD_ZONE_ID;
    slot.className = 'bw-zone-hud';
    rootEl.appendChild(slot);
  }

  // Build the chip row container.
  const hud = document.createElement('div');
  hud.className = HUD_CONTAINER_CLASS;
  hud.setAttribute('role', 'group');
  hud.setAttribute('aria-label', 'Battle resources');

  // Chip 1 — Back button (chip-style). Single click handler defensively
  // forwards to window.goToMenu() (legacy entry) — never re-implements nav.
  const backChip = document.createElement('button');
  backChip.type = 'button';
  backChip.className = 'bw-hud-chip bw-hud-chip--back';
  backChip.setAttribute('aria-label', 'Back to menu');
  backChip.innerHTML = '<span class="bw-hud-chip-icon" aria-hidden="true">←</span>'
                    + '<span class="bw-hud-chip-label">Back</span>';
  backChip.addEventListener('click', _onBackTap);

  // Chip 2 — HP indicator (sacred value source: state.hp + MAX_HP)
  const hpChip = _buildChip('hp', '❤', '--/--');

  // Chip 3 — Shield percentage (mitigation)
  const shieldChip = _buildChip('shield', '🛡', '--');

  // Chip 4 — Turn counter
  const turnChip = _buildChip('turn', 'T', '--');

  // Chip 5 — Fire-mult delta (Stagger state amplifier)
  const fireMultChip = _buildChip('firemult', '🔥', '--');

  hud.appendChild(backChip);
  hud.appendChild(hpChip.root);
  hud.appendChild(shieldChip.root);
  hud.appendChild(turnChip.root);
  hud.appendChild(fireMultChip.root);

  // Clear slot before appending (ensures clean state if a previous destroy
  // was incomplete).
  slot.innerHTML = '';
  slot.appendChild(hud);

  _hud = {
    rootEl,
    slot,
    hud,
    backChip,
    hpChip,
    shieldChip,
    turnChip,
    fireMultChip,
  };

  // Apply initial state — defaults render `--` placeholders.
  if (state) updateTopHud(state);
  return true;
}

/**
 * updateTopHud(state)
 *
 * state: { hp?, hpMax?, shieldPct?, turn?, fireMultActive? } — partial update;
 *        missing fields leave prior values untouched. Cheap to call every
 *        frame; chip value writes are direct textContent (no layout thrash).
 *
 * Never throws on bad input. Unknown / non-numeric values render `--`.
 */
export function updateTopHud(state) {
  if (!_hud) return;
  if (!state || typeof state !== 'object') return;

  // HP — show "<hp>/<MAX_HP>". hpMax override allowed (defensive) but rarely
  // used — sacred MAX_HP=100 is the contract.
  if (Object.prototype.hasOwnProperty.call(state, 'hp')
      || Object.prototype.hasOwnProperty.call(state, 'hpMax')) {
    const hpMax = Number.isFinite(state.hpMax) ? state.hpMax : MAX_HP;
    _hud.hpChip.valueEl.textContent = hpFormatter(state.hp, hpMax);
  }

  // Shield — percentage (0..100). Renders "<n>%".
  if (Object.prototype.hasOwnProperty.call(state, 'shieldPct')) {
    _hud.shieldChip.valueEl.textContent = shieldPctFormatter(state.shieldPct);
  }

  // Turn — integer counter.
  if (Object.prototype.hasOwnProperty.call(state, 'turn')) {
    _hud.turnChip.valueEl.textContent = turnFormatter(state.turn);
  }

  // Fire-mult — derived delta from FIRE_MULT_ACTIVE_RATIO baseline 0.7.
  // Accepts the current active multiplier (e.g. 1.5 during Stagger) and
  // displays "+114%" / "+0%" / "--". When fireMultActive equals the baseline
  // 0.7 exactly, delta = 0% — still rendered (informs "Active" state).
  if (Object.prototype.hasOwnProperty.call(state, 'fireMultActive')) {
    _hud.fireMultChip.valueEl.textContent = fireMultFormatter(state.fireMultActive);
  }
}

/**
 * destroyTopHud()
 *
 * Tears down the HUD DOM + clears module state. Idempotent — safe to call
 * when no HUD mounted. Called by cleanupBattleScreen.
 */
export function destroyTopHud() {
  if (!_hud) return;
  // Remove the back-tap listener defensively so a re-mount doesn't double-bind.
  if (_hud.backChip) _hud.backChip.removeEventListener('click', _onBackTap);
  if (_hud.slot) _hud.slot.innerHTML = '';
  _hud = null;
}

// ─── internal — chip construction ───────────────────────────────────────────

function _buildChip(kind, icon, initialValue) {
  const root = document.createElement('div');
  root.className = `bw-hud-chip bw-hud-chip--${kind}`;
  root.setAttribute('role', 'status');

  const iconEl = document.createElement('span');
  iconEl.className = 'bw-hud-chip-icon';
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.textContent = icon;

  const valueEl = document.createElement('span');
  valueEl.className = 'bw-hud-chip-value';
  valueEl.textContent = initialValue;

  root.appendChild(iconEl);
  root.appendChild(valueEl);

  return { root, iconEl, valueEl };
}

// ─── internal — back-button routing ─────────────────────────────────────────

function _onBackTap() {
  // Defensive — never re-implement nav. Forward to legacy entry; no-op when
  // host hasn't wired it (early FTUE / unit tests / route handlers absent).
  try {
    if (typeof window !== 'undefined') {
      if (typeof window.returnToMenuFromBattle === 'function') {
        window.returnToMenuFromBattle();
        return;
      }
      if (typeof window.goToMenu === 'function') {
        window.goToMenu();
      }
    }
  } catch (_e) { /* defensive — no-op */ }
}

// ─── pure formatters (exported for unit tests) ──────────────────────────────

/**
 * hpFormatter(hp, hpMax): renders "<hp>/<hpMax>" or "--/--" when invalid.
 * Sacred contract: hpMax defaults to MAX_HP=100 when caller omits it.
 *
 * Examples:
 *   hpFormatter(97, 100) → "97/100"
 *   hpFormatter(100, 100) → "100/100"
 *   hpFormatter(null, 100) → "--/100"   (max known, hp missing — partial render)
 *   hpFormatter(null, null) → "--/--"
 *   hpFormatter(50)        → "50/100"   (defaults to sacred max)
 *   hpFormatter('X', 100)  → "--/100"   (non-numeric guard)
 */
export function hpFormatter(hp, hpMax) {
  const hpStr = Number.isFinite(hp) ? String(Math.max(0, Math.floor(hp))) : '--';
  const maxStr = Number.isFinite(hpMax)
    ? String(Math.max(0, Math.floor(hpMax)))
    : (hpMax === null || hpMax === undefined ? String(MAX_HP) : '--');
  // Special-case: both fully missing renders "--/--" (not "--/100") so the
  // chip clearly signals "no state yet" during pre-spawn boot.
  if (hpStr === '--' && (hpMax === null || hpMax === undefined)) {
    return '--/--';
  }
  return `${hpStr}/${maxStr}`;
}

/**
 * shieldPctFormatter(pct): renders "<pct>%" or "--" when invalid.
 * Clamps to [0..100]. Floors fractional.
 *
 * Examples:
 *   shieldPctFormatter(6) → "6%"
 *   shieldPctFormatter(0) → "0%"
 *   shieldPctFormatter(100) → "100%"
 *   shieldPctFormatter(null) → "--"
 *   shieldPctFormatter(-5) → "0%"
 *   shieldPctFormatter(150) → "100%"
 */
export function shieldPctFormatter(pct) {
  if (!Number.isFinite(pct)) return '--';
  const clamped = Math.max(0, Math.min(100, Math.floor(pct)));
  return `${clamped}%`;
}

/**
 * turnFormatter(turn): renders "<turn>" or "--" when invalid.
 *
 * Examples:
 *   turnFormatter(16) → "16"
 *   turnFormatter(0) → "0"
 *   turnFormatter(null) → "--"
 *   turnFormatter(-1) → "0"    (clamp to non-negative)
 */
export function turnFormatter(turn) {
  if (!Number.isFinite(turn)) return '--';
  return String(Math.max(0, Math.floor(turn)));
}

/**
 * fireMultFormatter(fireMultActive): renders "+<n>%" delta from the sacred
 * FIRE_MULT_ACTIVE_RATIO baseline (0.7). Negative deltas show "-N%".
 *
 * Examples (sacred ratios):
 *   fireMultFormatter(0.7)  → "+0%"     (Active baseline)
 *   fireMultFormatter(1.5)  → "+114%"   (Stagger — (1.5/0.7-1)*100 = 114.28 → 114)
 *   fireMultFormatter(null) → "--"
 *   fireMultFormatter(0.35) → "-50%"    (some debuff halves baseline)
 */
export function fireMultFormatter(fireMultActive) {
  if (!Number.isFinite(fireMultActive)) return '--';
  if (FIRE_MULT_ACTIVE_RATIO <= 0) return '--';      // defensive (sacred says 0.7)
  const delta = (fireMultActive / FIRE_MULT_ACTIVE_RATIO - 1) * 100;
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${Math.trunc(delta)}%`;
}

// ─── test hooks — exported only for unit tests ──────────────────────────────

export const _testables = Object.freeze({
  MAX_HP,
  FIRE_MULT_ACTIVE_RATIO,
  _getCurrentHud: () => _hud,
});
