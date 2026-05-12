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
