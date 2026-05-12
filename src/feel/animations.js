// 2026-05-11 — TASK-010 (T1.09): feel-layer animation helpers relocated
// from legacy.
//
// Scope: vPlay* functions that produce transient visual effects driven by
// the battle loop (line-clear bursts, crit flashes, the boss-death
// cinematic, level-up pulses). Pure relocation — every timing constant
// here is SACRED per CLAUDE.md §2.2 and copied byte-perfect from
// docs/_legacy/_archive_v1/blocksworn_index_fixed.html lines 67245-67400.
//
// Sacred timings preserved (verified vs legacy):
//   - vPlayCritFlash:    180ms flash class, 440ms shake class
//   - vPlayBossDieFx 5-beat cinematic:
//       Beat 0 (haptic + shake): synchronous + 440ms shake removal
//       Beat 1 (hit-pause):      add class, remove at  300ms
//       Beat 2 (white flash):    fire at 260ms, flash element auto-remove at +220ms
//       Beat 3 (dissolve + 16-particle burst): fire at 380ms (delegates spawn to particles.js)
//       Beat 4 (slow zoom):      fire at 420ms (zoom class held until vCleanupBossDeathFx)
//       Beat 5 (music sting):    synchronous, no setTimeout
//   - vPlayLineClearBurst: spark cap 32 (every-other cell, then .slice(0,32)),
//       per-spark duration 600 + rand*240ms, burst cleanup 1000ms,
//       target = bossImg center (fallback wrapRect-center, y:-80)
//   - vPlayLevelPulse:   class held 2800ms
//
// Undeclared identifiers that survive byte-perfect from legacy
// (TODO(T1.10): rewire to src/core/...):
//   - SIZE           — board side length (typeof check protects)
//   - currentBoss    — global mutable boss reference (typeof check protects, inside spawnBossDeathParticles)
//   - playSFX / vPlaySound — audio bridge stubs (typeof checks protect)
//
// haptics are pulled from the already-extracted T1.07 module. Particle
// spawning for the radial boss-death burst is delegated to ./particles.js
// (also created in T1.09).

/* global SIZE, playSFX, vPlaySound */

import { vHaptic } from './haptics.js';
import { spawnBossDeathParticles } from './particles.js';

// ===== V3.0 PHASE 9 · VFX =====

// Line-clear particle burst — spawn sparks at each cleared cell and launch them
// toward the boss portrait. Uses CSS transforms; cleans up after 900ms.
export function vPlayLineClearBurst(rows, cols) {
  const wrap = document.querySelector('.game.v-battle .grid-wrap');
  const grid = document.getElementById('grid');
  if (!wrap || !grid) return;
  const cells = grid.querySelectorAll('.cell');
  const bossImg = document.getElementById('bossImg');
  const wrapRect = wrap.getBoundingClientRect();
  let target = { x: wrapRect.width / 2, y: -80 };
  if (bossImg) {
    const br = bossImg.getBoundingClientRect();
    target = {
      x: (br.left + br.width / 2) - wrapRect.left,
      y: (br.top + br.height / 2) - wrapRect.top,
    };
  }
  const burst = document.createElement('div');
  burst.className = 'v-fx-burst';
  wrap.appendChild(burst);
  // TODO(T1.10): SIZE is the board-side global; rewire from src/core/grid.js
  const SIZE_LOCAL = typeof SIZE === 'number' ? SIZE : 8;
  const cellIdxs = new Set();
  for (const r of (rows || [])) for (let c = 0; c < SIZE_LOCAL; c++) cellIdxs.add(r * SIZE_LOCAL + c);
  for (const c of (cols || [])) for (let r = 0; r < SIZE_LOCAL; r++) cellIdxs.add(r * SIZE_LOCAL + c);
  // Cap particles to keep perf sane on big clears
  const picks = Array.from(cellIdxs).filter((_, i) => i % 2 === 0).slice(0, 32);
  for (const idx of picks) {
    const cell = cells[idx];
    if (!cell) continue;
    const cr = cell.getBoundingClientRect();
    const sx = (cr.left + cr.width / 2) - wrapRect.left;
    const sy = (cr.top  + cr.height / 2) - wrapRect.top;
    const sp = document.createElement('span');
    sp.className = 'v-spark';
    sp.style.left = `${sx - 4}px`;
    sp.style.top  = `${sy - 4}px`;
    sp.style.setProperty('--tx', `${target.x - sx}px`);
    sp.style.setProperty('--ty', `${target.y - sy}px`);
    sp.style.setProperty('--dur', `${600 + Math.random() * 240}ms`);
    burst.appendChild(sp);
  }
  setTimeout(() => { try { burst.remove(); } catch(_e){ /* node already detached */ } }, 1000);
}

// Short white flash + viewport shake — use for crits / big hits.
let _vCritFlashT = null;
export function vPlayCritFlash() {
  try { vHaptic('crit'); } catch(_e){ /* haptics optional */ }
  document.body.classList.add('v-fx-crit-flash');
  clearTimeout(_vCritFlashT);
  _vCritFlashT = setTimeout(() => document.body.classList.remove('v-fx-crit-flash'), 180);
  const g = document.querySelector('.game.v-battle');
  if (g) {
    g.classList.remove('v-fx-shake');
    // force reflow so the animation restarts
    void g.offsetWidth;
    g.classList.add('v-fx-shake');
    setTimeout(() => g.classList.remove('v-fx-shake'), 440);
  }
}

// POLISH v1 · PHASE 5 — Boss defeat 5-beat cinematic (replaces legacy single rotate-fade).
export function vPlayBossDieFx() {
  const img = document.getElementById('bossImg');
  const wrap = document.getElementById('bossImgWrap');
  const battle = document.querySelector('.game.v-battle, .a-battle');
  if (!img || !wrap) return;

  // Beat 0: haptic + existing shake
  try { vHaptic('hit'); } catch(_e){ /* haptics optional */ }
  if (battle) {
    battle.classList.remove('v-fx-shake');
    void battle.offsetWidth;
    battle.classList.add('v-fx-shake');
    setTimeout(() => battle.classList.remove('v-fx-shake'), 440);
  }

  // Beat 1: hit-pause (300ms dim)
  if (battle) {
    battle.classList.add('boss-death-pause');
    setTimeout(() => battle.classList.remove('boss-death-pause'), 300);
  }

  // Beat 2: white flash (fires at end of pause so they blend)
  setTimeout(() => {
    const flash = document.createElement('div');
    flash.className = 'p-boss-death-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 220);
  }, 260);

  // Beat 3: dissolve + particles (starts as flash fades)
  setTimeout(() => {
    // Dissolve animation on boss-img-wrap (overrides legacy .defeated)
    wrap.classList.remove('defeated');
    wrap.classList.add('boss-dissolve');
    // 16-particle radial burst (sacred per CLAUDE.md §2.2)
    spawnBossDeathParticles(wrap);
  }, 380);

  // Beat 4: slow zoom (parallel с dissolve)
  if (battle) {
    setTimeout(() => {
      battle.classList.add('boss-death-zoom');
      // zoom держится до cleanup-вызова; снимается vCleanupBossDeathFx
    }, 420);
  }

  // Beat 5: music sting — silently skip if no audio hook
  // TODO(T1.10): rewire playSFX / vPlaySound to src/services/audio.js
  try {
    if (typeof playSFX === 'function') playSFX('boss_victory_sting');
    else if (typeof vPlaySound === 'function') vPlaySound('victory');
  } catch(_e){ /* audio bridge optional */ }
}

// POLISH v1 · PHASE 5 — cleanup after cinematic (called post-beat 4 before victory modal settles)
export function vCleanupBossDeathFx() {
  const battle = document.querySelector('.game.v-battle, .a-battle');
  const wrap = document.getElementById('bossImgWrap');
  if (battle) battle.classList.remove('boss-death-zoom', 'boss-death-pause');
  if (wrap) wrap.classList.remove('boss-dissolve');
}

// Level-up pulse on any element — adds then removes the pulse class.
export function vPlayLevelPulse(el) {
  if (!el) return;
  el.classList.remove('v-fx-level-pulse');
  void el.offsetWidth;
  el.classList.add('v-fx-level-pulse');
  try { vHaptic('levelup'); } catch(_e){ /* haptics optional */ }
  setTimeout(() => el.classList.remove('v-fx-level-pulse'), 2800);
}
