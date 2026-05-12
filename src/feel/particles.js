// 2026-05-11 — TASK-010 (T1.09): particle spawn/lifecycle helpers relocated
// from legacy.
//
// Scope: helpers that build DOM particle nodes for vPlay* animations.
// vPlayLineClearBurst builds its own .v-spark sparks inline (tight coupling
// to the burst container + per-spark trajectory variables), so its spawn
// loop stays inside src/feel/animations.js. vPlayBossDieFx, by contrast,
// produces a self-contained 16-spoke radial burst whose lifecycle (1600ms
// auto-remove) is identical regardless of caller, so it lives here as
// spawnBossDeathParticles and is imported by animations.js.
//
// Numeric constants (16-particle count, 70+rand*60 distance, ≤80ms jitter
// delay, 1600ms cleanup, default '#FFD53D' aura, elemColor lookup table) are
// SACRED per CLAUDE.md §2.2 ("Particle line clear pattern: направлены к
// bossImg coordinates" — same byte-perfect discipline applies to the boss
// death cinematic per §2.2 row 2). Pure relocation from
// docs/_legacy/_archive_v1/blocksworn_index_fixed.html lines 67334-67367
// (Beat 3 of vPlayBossDieFx).
//
// Not imported from anywhere yet outside src/feel/animations.js — T1.10 will
// wire the battle loop to call vPlayBossDieFx() which transitively reaches
// here.

/* global currentBoss */

// elem → CSS hex aura color for the boss-death radial burst. Sacred values
// copied byte-perfect from legacy line 67338-67341. Default falls back to
// '#FFD53D' (warm gold) when elem is missing from the table.
const BOSS_DEATH_ELEM_COLOR = Object.freeze({
  ember: '#FF5A3A',
  tide:  '#4ADBFF',
  grove: '#7AEC4A',
  solar: '#FFE14A',
  umbra: '#C06ADF',
});

// 2026-05-12 — TASK-029 (T2.02): Identity Layer coin particle factory.
//
// Pure factory — given pre-allocated DOM element + spawn/target screen coords,
// configures the element for a single arcing coin animation. Used exclusively
// by the Pirate's Plunder identity FX (spec §2.1). Pool allocation lives in
// `src/feel/identity-fx.js` per the object-pool requirement of spec §5
// (no `document.createElement` per fire).
//
// The element is expected to carry the `.identity-coin` class (painterly gold
// 16×16 SVG-style) and to support the `.identity-coin-flying` keyframe set
// defined in `src/styles/screens/battle.css`. Caller is responsible for
// returning the element to the pool when its decay timer fires.
//
// Parameters:
//   el      — pre-allocated <div> from the pool (Identity Layer owns the pool)
//   x, y    — origin in viewport coords (cleared-cell center)
//   targetX, targetY — destination in viewport coords (HUD gold counter)
//   decayMs — animation lifetime; matches PIRATE_PLUNDER_COIN_DECAY_MS
//
// Returns: the same `el` (caller-tracked for cleanup / pool release).
//
// Re-uses the existing CSS-transform-only animation pattern from the
// boss-death burst above (no requestAnimationFrame loop, no per-frame DOM
// writes — single transform via CSS keyframes). Pure addition; touches no
// sacred element of `spawnBossDeathParticles`.
export function spawnCoinParticle({ el, x, y, targetX, targetY, decayMs }) {
  if (!el) return null;
  // Position at origin, expose target delta via CSS custom properties so the
  // .identity-coin-flying keyframe can interpolate translate3d().
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  el.style.setProperty('--coin-tx', (targetX - x) + 'px');
  el.style.setProperty('--coin-ty', (targetY - y) + 'px');
  el.style.setProperty('--coin-decay-ms', decayMs + 'ms');
  // Restart the animation deterministically (re-trigger CSS keyframes on
  // re-used pool elements). Toggle class off then on by forcing a layout read.
  el.classList.remove('identity-coin-flying');
  // Force a synchronous reflow so the keyframe restarts cleanly.
  void el.offsetWidth;
  el.classList.add('identity-coin-flying');
  return el;
}

// 2026-05-12 — TASK-030 (T2.03): Identity Layer shark teeth-arc particle factory.
//
// Pure factory — given pre-allocated DOM element + bite cell screen coords +
// sweep direction, configures the element for a single teeth-arc bite
// animation. Used exclusively by the Shark Feeding Frenzy identity FX (spec
// §2.2). Pool allocation lives in `src/feel/identity-fx.js` per the
// object-pool requirement of spec §5 (no `document.createElement` per fire).
//
// The element is expected to carry the `.identity-shark-bite` class (curved
// teeth-arc white-on-cyan SVG-style) and to support the
// `.identity-shark-bite-sweeping` keyframe set defined in
// `src/styles/screens/battle.css`. Caller is responsible for returning the
// element to the pool when its decay timer fires.
//
// Parameters:
//   el        — pre-allocated <div> from the pool (Identity Layer owns the pool)
//   x, y      — bite cell center in viewport coords
//   direction — 'horizontal-row' | 'vertical-col' (sweep axis per spec §2.2 field 3)
//   decayMs   — animation lifetime; matches SHARK_FRENZY_BITE_DECAY_MS (500ms)
//
// Returns: the same `el` (caller-tracked for cleanup / pool release).
//
// Re-uses the existing CSS-transform-only animation pattern from
// `spawnCoinParticle` above — no requestAnimationFrame loop, no per-frame DOM
// writes, single transform via CSS keyframes. Pure addition; touches no sacred
// element of `spawnBossDeathParticles` or `spawnCoinParticle`.
export function spawnSharkBiteParticle({ el, x, y, direction, decayMs }) {
  if (!el) return null;
  // Position at bite cell, expose sweep direction as data attribute so the
  // .identity-shark-bite-sweeping keyframe can branch (horizontal vs vertical).
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  el.style.setProperty('--bite-decay-ms', decayMs + 'ms');
  el.setAttribute('data-bite-direction', direction || 'horizontal-row');
  // Restart the animation deterministically (re-trigger CSS keyframes on
  // re-used pool elements). Toggle class off then on by forcing a layout read.
  el.classList.remove('identity-shark-bite-sweeping');
  // Force a synchronous reflow so the keyframe restarts cleanly.
  void el.offsetWidth;
  el.classList.add('identity-shark-bite-sweeping');
  return el;
}

// 2026-05-12 — TASK-031 (T2.04): Identity Layer rock ghost-flash particle factory.
//
// Pure factory — given pre-allocated DOM element + cleared-line origin coords +
// orientation (row vs col), configures the element for a single translucent
// purple ghost-flash that appears ~200ms AFTER the line clears and dissolves
// over 700ms. Used exclusively by the Rock Encore Echo identity FX (spec §2.3).
// Pool allocation lives in `src/feel/identity-fx.js` per the object-pool
// requirement of spec §5 (no `document.createElement` per fire).
//
// The element is expected to carry the `.identity-rock-echo-ghost` class
// (translucent purple, painterly violet-spark texture) and to support the
// `.identity-rock-echo-flashing` keyframe set defined in
// `src/styles/screens/battle.css`. Caller is responsible for returning the
// element to the pool when its decay timer fires.
//
// Parameters:
//   el        — pre-allocated <div> from the pool (Identity Layer owns the pool)
//   x, y      — line origin (cleared-row/cleared-col midpoint) in viewport coords
//   direction — 'horizontal-row' | 'vertical-col' (ghost stretches along the line)
//   decayMs   — total animation lifetime; matches ROCK_ECHO_GHOST_DECAY_MS (700ms)
//   delayMs   — delay before the ghost begins flashing; matches ROCK_ECHO_DELAY_MS (200ms)
//
// Returns: the same `el` (caller-tracked for cleanup / pool release).
//
// Re-uses the existing CSS-transform-only animation pattern from
// `spawnCoinParticle` / `spawnSharkBiteParticle` above — no requestAnimationFrame
// loop, no per-frame DOM writes, single transform via CSS keyframes. Pure
// addition; touches no sacred element of the existing particle factories.
//
// Visual reference (spec §2.3 field 3): "a translucent purple `ghost` of the
// cleared cells flashes back in place for one beat, then dissolves. Particles
// are slow-moving violet sparks (re-use particle pool, recolor only)." The
// recolor-only contract is satisfied by the `.identity-rock-echo-ghost`
// background gradient (#7e3fb8 violet-purple) — the underlying transform
// pattern is identical to the cyan Shark bite, just recolored per ESC-02 O4
// RE-USE-FIRST ruling (no new SFX/particle archetype added).
export function spawnRockEchoGhost({ el, x, y, direction, decayMs, delayMs }) {
  if (!el) return null;
  // Position at line origin, expose orientation + timing via CSS custom
  // properties so the .identity-rock-echo-flashing keyframe can interpolate.
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  el.style.setProperty('--echo-decay-ms', decayMs + 'ms');
  el.style.setProperty('--echo-delay-ms', (delayMs || 0) + 'ms');
  el.setAttribute('data-echo-direction', direction || 'horizontal-row');
  // Restart the animation deterministically (re-trigger CSS keyframes on
  // re-used pool elements). Toggle class off then on by forcing a layout read.
  el.classList.remove('identity-rock-echo-flashing');
  // Force a synchronous reflow so the keyframe restarts cleanly.
  void el.offsetWidth;
  el.classList.add('identity-rock-echo-flashing');
  return el;
}

// Spawns the 16-particle radial burst at the boss portrait centerpoint.
// Returns nothing; the container auto-removes itself after 1600ms.
// `wrap` is the #bossImgWrap element (caller passes its getBoundingClientRect
// anchor); kept as a parameter so animations.js retains ownership of the
// element lookup (which is part of the broader vPlayBossDieFx orchestration).
export function spawnBossDeathParticles(wrap) {
  // TODO(T1.10): wire from src/core/state.js once boss state moves there.
  const boss = (typeof currentBoss !== 'undefined' && currentBoss) ? currentBoss : null;
  const elem = boss && boss.stihiya ? boss.stihiya : 'solar';
  const elemColor = BOSS_DEATH_ELEM_COLOR[elem] || '#FFD53D';

  // 16 particles radial burst — anchor at #bossImgWrap center.
  const r = wrap.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const container = document.createElement('div');
  container.className = 'p-boss-death-particles';
  container.style.left = cx + 'px';
  container.style.top = cy + 'px';
  container.style.setProperty('--p-current-aura', elemColor);
  for (let i = 0; i < 16; i++) {
    const p = document.createElement('span');
    const angle = (360 / 16) * i;
    const dist = 70 + Math.random() * 60;
    p.style.setProperty('--pangle', angle + 'deg');
    p.style.setProperty('--pdist', dist + 'px');
    p.style.animationDelay = (Math.random() * 80) + 'ms';
    container.appendChild(p);
  }
  document.body.appendChild(container);
  setTimeout(() => container.remove(), 1600);
}
