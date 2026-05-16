// 2026-05-16 — TASK-CP-002 (combat-polish-implementation-plan.md §9 Task 2):
//
// Hero strip — 5-slot fixed horizontal grid + per-hero card render.
//
// Spec: combat-polish-implementation-plan.md §7.4 (Hero strip 108px)
//       combat-mechanics.md §15 (ULT energy system + per-class costs)
//       combat-mechanics.md §17 (race iconography → element binding)
//
// Lifecycle (mirrors boss-scene.js — plan §8.5):
//   mountHeroStrip(rootEl, squad?)  → builds 5 slot DOM into .bw-zone-heroes
//   updateHeroStrip(squad)          → refreshes per-card state (energy/HP/ready)
//   destroyHeroStrip()              → tears down DOM, idempotent
//
// Per-card visual (66×100px on iPhone 16, scales per battle-layout.css):
//   ┌────────────┐
//   │ [⚔]    Lv4 │  ← class icon (top-left) + level badge (top-right)
//   │ ╭────────╮ │
//   │ │ AVATAR │ │  ← circular SVG energy ring (color = hero's stihiya)
//   │ │   ◯    │ │     fills clockwise 0→100% via stroke-dasharray
//   │ ╰────────╯ │
//   │ ▓▓▓░░░░░░░ │  ← HP bar (3px thin, red→green gradient)
//   └────────────┘
//      THORGAR     ← 11px caps name
//
// Squad-size scaling (plan §7.4):
//   3 heroes (start):   [H1] [H2] [H3] [🔒] [🔒]
//   4 heroes (mid):     [H1] [H2] [H3] [H4] [🔒]
//   5 heroes (endgame): [H1] [H2] [H3] [H4] [H5]
//
// Sacred-cow protection (CLAUDE.md §2.1 + plan §12):
//   - Never modifies HERO_ULT_COST_BY_NEWROLE values (W:80/M:100/H:120/T:80/C:100).
//     The module READS those values via the hero object's maxEnergy field (which
//     game state has already resolved from the sacred constant). Visual ring fill
//     is normalised to a 0-100% percentage — raw "47/100" is never displayed.
//   - Never modifies RACE_TO_STIHIYA (imported read-only for ring colour binding).
//   - Never modifies or re-implements the ULT-firing logic — the tap handler
//     forwards to `window.fireHeroUlt(idx)` defensively (no-op when absent).
//   - Never imports from src/core/* or src/services/*; only reads two read-only
//     constants from src/data/* (RACE_TO_STIHIYA + HERO_ULT_COST_BY_NEWROLE),
//     both used for parity/audit at module load, not for write.
//   - --a-{stihiya} CSS tokens are the colour authority; no element hex hardcoded.
//
// Graceful degradation:
//   - mount() returns false when rootEl is null/undefined (no-op).
//   - update() / destroy() on unmounted strip are silent no-ops.
//   - Missing class icon, missing hero name, malformed energy: renders defaults.
//   - Empty / undersized squad fills remaining slots with lock placeholders.

import { RACE_TO_STIHIYA } from '../data/races.js';
import { HERO_ULT_COST_BY_NEWROLE } from '../data/heroes.js';

// ─── module state ───────────────────────────────────────────────────────────
// Single instance per app lifetime. mount() guards double-mount; destroy() clears.
let _strip = null;

const STRIP_ZONE_ID = 'bw-zone-heroes';        // grid-row 4 per battle-layout.css
const STRIP_CONTAINER_CLASS = 'bw-hero-strip';
const TOTAL_SLOTS = 5;                          // sacred per plan §7.4

// Energy ring geometry — chosen so the inner avatar slot is 48×48 with a 3px
// stroke ring outside it. Circle radius = 26, viewBox = 60×60. Circumference
// = 2π × 26 ≈ 163.36. Pre-compute once; ring fill = stroke-dasharray.
const RING_RADIUS = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Defensive parity check: HERO_ULT_COST_BY_NEWROLE must match sacred values.
// Throwing at module-load time catches sacred-cow drift during refactor
// (mirrors the pattern in element-assets.js for STIHIYAS parity).
const _EXPECTED_ULT_COSTS = { warrior: 80, mage: 100, hunter: 120, tank: 80, captain: 100 };
for (const [role, expected] of Object.entries(_EXPECTED_ULT_COSTS)) {
  if (HERO_ULT_COST_BY_NEWROLE[role] !== expected) {
    throw new Error(
      `HERO_ULT_COST_BY_NEWROLE.${role} = ${HERO_ULT_COST_BY_NEWROLE[role]}, expected ${expected}. ` +
      `Sacred per CLAUDE.md §2.1.`
    );
  }
}

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * mountHeroStrip(rootEl, squad?)
 *
 * rootEl: the .bw-battle-root container (set up by battle-screen orchestrator).
 *         If null/undefined, returns false (no-op). Idempotent on repeat calls.
 * squad:  optional array of hero objects. Each: { race, role, name, level,
 *         energy, maxEnergy, hp, hpMax }. Undefined/empty renders all 5 lock
 *         placeholders. Real squad data lands via updateHeroStrip() post-spawn.
 *
 * Returns true on successful mount, false on no-op skip.
 */
export function mountHeroStrip(rootEl, squad) {
  if (!rootEl) return false;
  if (_strip) return false;             // already mounted — idempotent

  // Locate or create the heroes-zone slot inside the battle root. In a fully
  // modular renderer rootEl already has the slot; in interim contexts we
  // create one defensively so the strip has somewhere to render.
  let slot = rootEl.querySelector(`#${STRIP_ZONE_ID}`)
          || rootEl.querySelector('.bw-zone-heroes');
  if (!slot) {
    slot = document.createElement('div');
    slot.id = STRIP_ZONE_ID;
    slot.className = 'bw-zone-heroes';
    rootEl.appendChild(slot);
  }

  // Build the 5-slot strip container + one card per slot.
  const strip = document.createElement('div');
  strip.className = STRIP_CONTAINER_CLASS;
  strip.setAttribute('role', 'group');
  strip.setAttribute('aria-label', 'Hero squad');

  const cards = [];
  for (let i = 0; i < TOTAL_SLOTS; i += 1) {
    const card = _buildCardSkeleton(i);
    strip.appendChild(card.root);
    cards.push(card);
  }

  // Clear slot before appending (no-op on first mount, ensures clean state if
  // a previous destroy was incomplete).
  slot.innerHTML = '';
  slot.appendChild(strip);

  _strip = {
    rootEl,
    slot,
    strip,
    cards,
  };

  // Apply initial squad state — defaults to all-lock when undefined.
  updateHeroStrip(squad);
  return true;
}

/**
 * updateHeroStrip(squad)
 *
 * squad: array of hero objects (length 0-5). Each missing slot fills with
 *        a lock placeholder. Cheap to call every frame; ring/HP transitions
 *        are CSS-driven so no layout thrash.
 */
export function updateHeroStrip(squad) {
  if (!_strip) return;

  const list = Array.isArray(squad) ? squad : [];
  for (let i = 0; i < TOTAL_SLOTS; i += 1) {
    const card = _strip.cards[i];
    const hero = list[i];
    if (hero) _renderHero(card, hero, i);
    else      _renderLock(card);
  }
}

/**
 * destroyHeroStrip()
 *
 * Tears down the strip DOM + clears module state. Idempotent — safe to call
 * when no strip mounted. Called by cleanupBattleScreen.
 */
export function destroyHeroStrip() {
  if (!_strip) return;
  if (_strip.slot) _strip.slot.innerHTML = '';
  _strip = null;
}

// ─── internal — card construction ───────────────────────────────────────────

function _buildCardSkeleton(slotIdx) {
  const root = document.createElement('button');
  root.type = 'button';
  root.className = 'bw-hero-card bw-hero-card--lock';
  root.dataset.slot = String(slotIdx);
  root.setAttribute('aria-label', `Hero slot ${slotIdx + 1}`);
  // Tap dispatch — single listener per card, routes by current data-state.
  // Defensive call to window.fireHeroUlt / window.goToHire — no-op when host
  // hasn't wired them yet. Never re-implements ULT logic per sacred §12.
  root.addEventListener('click', _onCardTap);

  // Header strip — class icon (top-left) + level badge (top-right)
  const header = document.createElement('div');
  header.className = 'bw-hero-header';

  const classIcon = document.createElement('span');
  classIcon.className = 'bw-hero-class-icon';
  classIcon.setAttribute('aria-hidden', 'true');

  const lvlBadge = document.createElement('span');
  lvlBadge.className = 'bw-hero-level';

  header.appendChild(classIcon);
  header.appendChild(lvlBadge);

  // Energy ring + avatar — SVG circle outside an avatar img/placeholder
  const ringWrap = document.createElement('div');
  ringWrap.className = 'bw-hero-ring-wrap';

  // SVG ring uses a transparent track + a coloured progress arc. We rotate
  // the SVG -90° so the dasharray begins at 12 o'clock (clockwise fill).
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'bw-hero-ring');
  svg.setAttribute('viewBox', '0 0 60 60');
  svg.setAttribute('aria-hidden', 'true');

  const trackCircle = document.createElementNS(svgNS, 'circle');
  trackCircle.setAttribute('class', 'bw-hero-ring-track');
  trackCircle.setAttribute('cx', '30');
  trackCircle.setAttribute('cy', '30');
  trackCircle.setAttribute('r', String(RING_RADIUS));

  const fillCircle = document.createElementNS(svgNS, 'circle');
  fillCircle.setAttribute('class', 'bw-hero-ring-fill');
  fillCircle.setAttribute('cx', '30');
  fillCircle.setAttribute('cy', '30');
  fillCircle.setAttribute('r', String(RING_RADIUS));
  fillCircle.setAttribute('stroke-dasharray', `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`);
  fillCircle.setAttribute('stroke-dashoffset', String(RING_CIRCUMFERENCE));

  svg.appendChild(trackCircle);
  svg.appendChild(fillCircle);

  const avatar = document.createElement('div');
  avatar.className = 'bw-hero-avatar';
  // Lock placeholder content — replaced by hero render when squad data lands.
  avatar.textContent = '+';

  ringWrap.appendChild(svg);
  ringWrap.appendChild(avatar);

  // HP bar (3px) — red→green gradient driven by --bw-hp-pct
  const hpBar = document.createElement('div');
  hpBar.className = 'bw-hero-hp';
  const hpFill = document.createElement('div');
  hpFill.className = 'bw-hero-hp-fill';
  hpBar.appendChild(hpFill);

  // Hero name (11px caps)
  const nameEl = document.createElement('div');
  nameEl.className = 'bw-hero-name';

  root.appendChild(header);
  root.appendChild(ringWrap);
  root.appendChild(hpBar);
  root.appendChild(nameEl);

  return {
    root,
    classIcon,
    lvlBadge,
    avatar,
    svg,
    fillCircle,
    hpFill,
    nameEl,
    // mutable per-render state
    currentRole: null,
    currentElement: null,
    isLock: true,
  };
}

// ─── internal — render handlers ─────────────────────────────────────────────

function _renderHero(card, hero, slotIdx) {
  card.root.classList.remove('bw-hero-card--lock');
  card.root.classList.add('bw-hero-card--filled');
  card.root.dataset.heroIdx = String(slotIdx);
  card.root.removeAttribute('disabled');
  card.isLock = false;

  // Class icon — resolve to /assets/icons/class_{role}_emblem.png. If role is
  // unknown, leave the icon blank rather than referencing a missing asset.
  const role = (hero && typeof hero.role === 'string') ? hero.role.toLowerCase() : '';
  if (role && _isKnownRole(role)) {
    if (card.currentRole !== role) {
      card.classIcon.style.backgroundImage = `url("${classIconPath(role)}")`;
      card.currentRole = role;
    }
  } else {
    card.classIcon.style.backgroundImage = '';
    card.currentRole = null;
  }

  // Level badge — "Lv4"
  const level = Number.isFinite(hero && hero.level) ? hero.level : 1;
  card.lvlBadge.textContent = `Lv${level}`;

  // Element binding — derive stihiya from race; tint ring fill + ready-glow.
  const element = _resolveElement(hero);
  if (card.currentElement !== element) {
    card.root.dataset.element = element;
    card.fillCircle.style.stroke = `var(--a-${element})`;
    card.currentElement = element;
  }

  // Energy ring — normalise to 0..1 then convert to stroke-dashoffset.
  // Sacred: max values 80/100/120/80/100 are NEVER shown raw; we show fill %.
  const pct = _energyPct(hero);
  const offset = RING_CIRCUMFERENCE * (1 - pct);
  card.fillCircle.style.strokeDashoffset = String(offset);

  // Ready state — when energy hits max, add pulsing glow + ARIA hint.
  const ready = pct >= 1 - 1e-6;
  card.root.classList.toggle('bw-hero-card--ready', ready);
  card.root.setAttribute(
    'aria-label',
    ready
      ? `${hero.name || 'Hero'} — Ultimate ready, tap to fire`
      : `${hero.name || 'Hero'} — Level ${level}`
  );

  // HP bar — red→green gradient handled in CSS; we set fill %.
  const hpPct = _hpPct(hero);
  card.hpFill.style.width = `${(hpPct * 100).toFixed(1)}%`;

  // Avatar — for now, the avatar slot is a coloured circle with the role
  // initial. Hero portrait artwork lands in a later polish task; the SVG
  // ring already binds visual identity. Lock '+' is replaced by initial.
  card.avatar.textContent = _heroInitial(hero);

  // Name (11px caps) — accept hero.name or hero.id fallback.
  card.nameEl.textContent = (hero && hero.name) ? String(hero.name) : '';
}

function _renderLock(card) {
  card.root.classList.remove('bw-hero-card--filled', 'bw-hero-card--ready');
  card.root.classList.add('bw-hero-card--lock');
  delete card.root.dataset.heroIdx;
  delete card.root.dataset.element;
  card.root.setAttribute('aria-label', 'Empty hero slot — tap to hire');
  card.isLock = true;
  card.currentRole = null;
  card.currentElement = null;

  card.classIcon.style.backgroundImage = '';
  card.lvlBadge.textContent = '';
  card.fillCircle.style.strokeDashoffset = String(RING_CIRCUMFERENCE); // empty
  card.fillCircle.style.stroke = '';
  card.hpFill.style.width = '0%';
  card.avatar.textContent = '+';
  card.nameEl.textContent = '';
}

// ─── internal — tap routing ─────────────────────────────────────────────────

function _onCardTap(event) {
  const root = event.currentTarget;
  if (!root || !root.dataset) return;

  // Lock slot → go to hire screen (defensive — no-op when host absent).
  if (root.classList.contains('bw-hero-card--lock')) {
    try {
      if (typeof window !== 'undefined' && typeof window.goToHire === 'function') {
        window.goToHire();
      }
    } catch (_e) { /* defensive — no-op */ }
    return;
  }

  // Filled hero → fire ULT (defensive — never re-implements logic, just routes).
  const idx = Number(root.dataset.heroIdx);
  if (!Number.isFinite(idx)) return;
  try {
    if (typeof window !== 'undefined' && typeof window.fireHeroUlt === 'function') {
      window.fireHeroUlt(idx);
    }
  } catch (_e) { /* defensive — no-op */ }
}

// ─── internal — helpers ─────────────────────────────────────────────────────

/**
 * classIconPath(role): resolves a role string to the public asset path for
 * its class emblem. All 5 emblems are present in public/assets/icons/ at
 * filenames class_{role}_emblem.png (verified TASK-CP-001 pre-flight).
 * Exported via _testables for unit tests.
 */
function classIconPath(role) {
  return `/assets/icons/class_${role}_emblem.png`;
}

function _isKnownRole(role) {
  return role === 'warrior' || role === 'mage' || role === 'hunter'
      || role === 'tank'    || role === 'captain';
}

/**
 * _resolveElement(hero): defensive lookup — returns the hero's stihiya derived
 * from RACE_TO_STIHIYA (sacred, read-only). Falls back to 'umbra' (visually
 * neutral) when race is missing or unmapped, so a malformed hero never
 * breaks ring colour binding.
 */
function _resolveElement(hero) {
  const race = hero && hero.race;
  const stihiya = race && RACE_TO_STIHIYA[race];
  if (stihiya) return stihiya;
  return 'umbra';
}

/**
 * _energyPct(hero): normalises hero.energy / hero.maxEnergy to [0..1]. Used
 * for stroke-dashoffset on the ring fill. Sacred: maxEnergy values
 * (80/100/120/80/100 per role) are NEVER displayed raw — only the ratio.
 */
function _energyPct(hero) {
  const e = hero && hero.energy;
  const m = hero && hero.maxEnergy;
  if (!Number.isFinite(e) || !Number.isFinite(m) || m <= 0) return 0;
  if (e <= 0) return 0;
  if (e >= m) return 1;
  return e / m;
}

/**
 * _hpPct(hero): normalises hero.hp / hero.hpMax to [0..1] for the bar fill.
 * Defaults to 1 (full health) when fields missing so a freshly-spawned hero
 * doesn't flash empty before first state push.
 */
function _hpPct(hero) {
  const h = hero && hero.hp;
  const m = hero && hero.hpMax;
  if (!Number.isFinite(h) || !Number.isFinite(m) || m <= 0) return 1;
  if (h <= 0) return 0;
  if (h >= m) return 1;
  return h / m;
}

function _heroInitial(hero) {
  const n = hero && hero.name;
  if (typeof n === 'string' && n.length > 0) {
    return n.trim().charAt(0).toUpperCase();
  }
  return '';
}

// Test hooks — exported only for unit tests; not part of public API.
export const _testables = Object.freeze({
  classIconPath,
  _isKnownRole,
  _resolveElement,
  _energyPct,
  _hpPct,
  RING_CIRCUMFERENCE,
  _EXPECTED_ULT_COSTS,
  _getCurrentStrip: () => _strip,
});
