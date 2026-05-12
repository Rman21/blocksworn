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

// 2026-05-12 — TASK-032 (T2.05): Identity Layer crocodile fragment particle factory.
//
// Pure factory — given pre-allocated DOM element + spawn-cell screen coords +
// destination (leftmost crocodile portrait) screen coords, configures the
// element for a single sandstone/earth fragment that flies inward from a
// cleared grove cell and lands on the receiving hero portrait. Used
// exclusively by the Crocodile Bedrock Bastion identity FX (spec §2.4).
// Pool allocation lives in `src/feel/identity-fx.js` per the object-pool
// requirement of spec §5 (no `document.createElement` per fire).
//
// The element is expected to carry the `.identity-croc-fragment` class
// (sandstone-brown 8×8 painterly chip) and to support the
// `.identity-croc-fragment-flying` keyframe set defined in
// `src/styles/screens/battle.css`. Caller is responsible for returning the
// element to the pool when its decay timer fires.
//
// Parameters:
//   el      — pre-allocated <div> from the pool (Identity Layer owns the pool)
//   x, y    — origin in viewport coords (cleared grove-cell center)
//   targetX, targetY — destination in viewport coords (leftmost crocodile portrait)
//   decayMs — animation lifetime; matches CROCODILE_BASTION_FRAGMENT_DECAY_MS
//             (600ms)
//   color   — optional fragment color override (defaults to '#8B5A3C' sandstone)
//
// Returns: the same `el` (caller-tracked for cleanup / pool release).
//
// Re-uses the existing CSS-transform-only animation pattern from
// `spawnCoinParticle` / `spawnSharkBiteParticle` / `spawnRockEchoGhost` above
// — no requestAnimationFrame loop, no per-frame DOM writes, single transform
// via CSS keyframes. Pure addition; touches no sacred element of the
// existing particle factories.
//
// Visual reference (spec §2.4 field 3): "From each cleared cell of grove
// element, a small sandstone/earth fragment (8×8 brown pixel-rect) flies
// inward toward the squad portraits at the bottom of the screen and lands
// visually on whichever crocodile hero is leftmost in the lineup."
// Sandstone color (#8B5A3C) is a warm earthy brown — re-use of existing
// earth/grove palette per ESC-02 O4 RE-USE-FIRST ruling (no new asset
// archetype added).
export function spawnCrocFragmentParticle({ el, x, y, targetX, targetY, decayMs, color }) {
  if (!el) return null;
  // Position at cleared grove-cell center, expose target delta via CSS
  // custom properties so the .identity-croc-fragment-flying keyframe can
  // interpolate translate3d().
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  el.style.setProperty('--frag-tx', (targetX - x) + 'px');
  el.style.setProperty('--frag-ty', (targetY - y) + 'px');
  el.style.setProperty('--frag-decay-ms', decayMs + 'ms');
  if (color) {
    el.style.setProperty('--frag-color', color);
  }
  // Restart the animation deterministically (re-trigger CSS keyframes on
  // re-used pool elements). Toggle class off then on by forcing a layout read.
  el.classList.remove('identity-croc-fragment-flying');
  // Force a synchronous reflow so the keyframe restarts cleanly.
  void el.offsetWidth;
  el.classList.add('identity-croc-fragment-flying');
  return el;
}

// 2026-05-12 — TASK-033 (T2.06): Identity Layer spark ray particle factory.
//
// Pure factory — given pre-allocated DOM element + cleared-solar-cell origin
// coords + nearest-non-empty-cell target coords, configures the element for a
// single golden ray that arcs from the cleared solar cell toward the target
// cell, accompanied by a single-frame yellow-white flash on the target. Used
// exclusively by the Spark Sun Cascade identity FX (spec §2.5). Pool
// allocation lives in `src/feel/identity-fx.js` per the object-pool
// requirement of spec §5 (no `document.createElement` per fire).
//
// The element is expected to carry the `.identity-spark-ray` class (golden
// line gradient with yellow-white highlights) and to support the
// `.identity-spark-ray-flying` keyframe set defined in
// `src/styles/screens/battle.css`. Caller is responsible for returning the
// element to the pool when its decay timer fires.
//
// Parameters:
//   el      — pre-allocated <div> from the pool (Identity Layer owns the pool)
//   startX, startY — origin in viewport coords (cleared solar-cell center)
//   targetX, targetY — destination in viewport coords (nearest non-empty cell)
//   decayMs — animation lifetime; matches SPARK_CASCADE_RAY_DECAY_MS (400ms)
//   color   — optional ray color override (defaults to '#FFD700' golden)
//
// Returns: the same `el` (caller-tracked for cleanup / pool release).
//
// Re-uses the existing CSS-transform-only animation pattern from
// `spawnCoinParticle` / `spawnSharkBiteParticle` / `spawnRockEchoGhost` /
// `spawnCrocFragmentParticle` above — no requestAnimationFrame loop, no
// per-frame DOM writes, single transform via CSS keyframes. Pure addition;
// touches no sacred element of the existing particle factories.
//
// Visual reference (spec §2.5 field 3): "Each cleared solar cell emits a
// small golden ray that 'chains' briefly to the nearest non-empty cell of
// any element. The nearest cell flashes yellow-white for one frame, then
// resolves normally. PURE VFX — does NOT clear the touched cell."
//
// CRITICAL SACRED-COW SAFETY: This factory ONLY configures the ray element
// and its target flash. It does NOT clear grid cells. The "touched cell"
// flash is purely visual — the grid cell at (targetX, targetY) is NEVER
// added to the cleared set by Sun Cascade. (If it were, that would be a
// Shark Frenzy mechanic, not Spark — DO NOT confuse the two.)
export function spawnSparkRayParticle({ el, startX, startY, targetX, targetY, decayMs, color }) {
  if (!el) return null;
  // Position at origin (cleared solar-cell center), expose target delta and
  // decay via CSS custom properties so the .identity-spark-ray-flying
  // keyframe can interpolate translate3d() + rotate (the ray "chains" along
  // the line from origin to target).
  el.style.left = startX + 'px';
  el.style.top  = startY + 'px';
  el.style.setProperty('--ray-tx', (targetX - startX) + 'px');
  el.style.setProperty('--ray-ty', (targetY - startY) + 'px');
  // Pre-compute ray length so the CSS doesn't need to call hypot. We pass it
  // as a CSS variable for the gradient width.
  const dx = targetX - startX;
  const dy = targetY - startY;
  const len = Math.sqrt(dx * dx + dy * dy);
  el.style.setProperty('--ray-length', len + 'px');
  // Angle (deg) for rotate, anchored at start.
  const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
  el.style.setProperty('--ray-angle', angleDeg + 'deg');
  el.style.setProperty('--ray-decay-ms', decayMs + 'ms');
  if (color) {
    el.style.setProperty('--ray-color', color);
  }
  // Restart the animation deterministically (re-trigger CSS keyframes on
  // re-used pool elements). Toggle class off then on by forcing a layout read.
  el.classList.remove('identity-spark-ray-flying');
  // Force a synchronous reflow so the keyframe restarts cleanly.
  void el.offsetWidth;
  el.classList.add('identity-spark-ray-flying');
  return el;
}

// 2026-05-12 — TASK-035 (T2.08): Identity Layer Lich Cursed Tiles skull overlay
// factory.
//
// Pure factory — given pre-allocated DOM element + cursed-cell grid coords
// converted to screen coords, configures the element for a single translucent
// purple skull overlay that sits on top of the cursed cell for the duration
// of its 3-turn curse. Used exclusively by the Lich Cursed Tiles boss-reactive
// identity FX (spec §3.2). Pool allocation lives in `src/feel/identity-fx.js`
// per the object-pool requirement of spec §5 (no `document.createElement`
// per fire).
//
// The element is expected to carry the `.identity-lich-cursed-tile` class
// (translucent purple overlay with stylized skull glyph) and to support the
// `.identity-lich-cursed-tile-pulse` (entry) and `.identity-lich-cursed-tile-fade`
// (exit) keyframe sets defined in `src/styles/screens/battle.css`. Caller is
// responsible for returning the element to the pool when the curse auto-clears
// (turn N+3) AND for swapping pulse → fade class at that moment.
//
// Parameters:
//   el      — pre-allocated <div> from the pool (Identity Layer owns the pool)
//   x, y    — cursed cell center in viewport coords
//   color   — optional skull color override (defaults to '#7e3fb8' translucent
//             purple — same palette as Rock echo ghost T2.04 per ESC-02 O4
//             RE-USE-FIRST ruling; no new palette archetype added)
//   decayMs — pulse-in animation lifetime (CURSED_TILES_SKULL_DECAY_MS = 300ms)
//
// Returns: the same `el` (caller-tracked for cleanup / pool release).
//
// Re-uses the existing CSS-transform-only animation pattern from
// `spawnCoinParticle` / `spawnSharkBiteParticle` / `spawnRockEchoGhost` /
// `spawnCrocFragmentParticle` / `spawnSparkRayParticle` above — no
// requestAnimationFrame loop, no per-frame DOM writes, single transform via
// CSS keyframes. Pure addition; touches no sacred element of the existing
// particle factories.
//
// Visual reference (spec §3.2 field 4 + field 6): "translucent purple skull
// overlay" / "3 cells smoking with purple skull glyphs". The recolor-only
// contract is satisfied by the `.identity-lich-cursed-tile` background
// gradient (#7e3fb8 violet-purple) — the underlying transform pattern is
// identical to the cyan Shark bite, just recolored per ESC-02 O4 RE-USE-FIRST
// ruling (no new SFX/particle archetype added).
//
// SACRED-COW SAFETY: This factory ONLY configures the overlay element and
// its position. It does NOT mutate grid cells. The "cursed cell" predicate
// is owned by the JS module (`src/feel/identity-fx.js#isCellCursed`); the
// overlay is a PURE VISUAL marker, not a grid-state mutation. T2.B legacy
// bridge wires the predicate into legacy's `pieceCanBePlaced` /
// `clearLines` so cursed cells become un-clearable for 3 turns.
export function spawnSkullOverlay({ el, x, y, color, decayMs }) {
  if (!el) return null;
  // Position at cursed cell center, expose decay duration as CSS variable
  // so the .identity-lich-cursed-tile-pulse keyframe can read it.
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  el.style.setProperty('--curse-decay-ms', (decayMs || 300) + 'ms');
  if (color) {
    el.style.setProperty('--curse-color', color);
  }
  // Restart the entry animation deterministically (re-trigger CSS keyframes
  // on re-used pool elements). Toggle class off then on by forcing a layout
  // read. Also clear any prior fade-out state.
  el.classList.remove('identity-lich-cursed-tile-pulse');
  el.classList.remove('identity-lich-cursed-tile-fade');
  // Force a synchronous reflow so the keyframe restarts cleanly.
  void el.offsetWidth;
  el.classList.add('identity-lich-cursed-tile-pulse');
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
