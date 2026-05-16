// 2026-05-16 — TASK-CP-001 (combat-polish-implementation-plan.md §9 Task 1):
//
// Boss scene component — layered theatrical render of the boss-as-presence.
//
// Lifecycle (plan §8.5):
//   mountBossScene(rootEl, boss?)  → builds Z-layer DOM, preloads bg, returns nothing
//   updateBossScene(state)         → swaps element / updates HP / refreshes name
//   destroyBossScene()             → tears down DOM + image refs
//
// Mounting strategy (plan §7.2):
//   Wraps existing #bossImg (legacy DOM hook) as Z-layer 2. JS that writes
//   .phase-2 / .phase-3 / mix-blend-mode / particle-direction reads continue
//   to work — bossImg is preserved in-place inside .bw-boss-character.
//
// Graceful degradation:
//   - If rootEl is missing or already mounted, mount is a no-op (idempotent).
//   - If boss is undefined, scene mounts with 'umbra' fallback (visually neutral).
//   - If background fails to load, vignette + character still render.
//
// Sacred-cow protection:
//   - Never modifies #bossImg attributes (id, src, alt) — only wraps in DOM.
//   - Never touches .phase-2 / .phase-3 classes — JS continues to write them
//     directly on bossImg.
//   - Never reads or modifies any constant in src/core/* or src/data/*.
//   - Never imports from src/services/*.

import {
  ELEMENT_ASSETS,
  preloadBackground,
  resolveBossElement,
} from './element-assets.js';

// Module-level state — single instance per app lifetime. mount() guards
// against double-mount; destroy() clears.
let _scene = null;

const SCENE_ZONE_ID = 'bw-zone-boss';        // grid-row 2 slot per battle-layout.css
const SCENE_CONTAINER_CLASS = 'bw-boss-scene';

/**
 * mountBossScene(rootEl, boss?)
 *
 * rootEl: the .bw-battle-root container (set up by battle-screen orchestrator).
 *         If null/undefined, no-op (returns false). Idempotent on repeat calls.
 * boss:   { element, name, hp, hpMax } shape. Optional — defaults to 'umbra'
 *         fallback. Real boss data lands via updateBossScene() after spawn.
 *
 * Returns true on successful mount, false on no-op skip.
 */
export function mountBossScene(rootEl, boss) {
  if (!rootEl) return false;
  if (_scene) return false;             // already mounted — idempotent

  // Locate or create the boss-zone slot inside the battle root. In a fully
  // modular renderer rootEl already has the slots; in interim contexts we
  // create a slot defensively so the scene has somewhere to render.
  let slot = rootEl.querySelector(`#${SCENE_ZONE_ID}`)
          || rootEl.querySelector('.bw-zone-boss');
  if (!slot) {
    slot = document.createElement('div');
    slot.id = SCENE_ZONE_ID;
    slot.className = 'bw-zone-boss';
    rootEl.appendChild(slot);
  }

  // Build the layered DOM (Z0 bg, Z1 vignette, Z2 character, Z3 ambient, Z4 overlay).
  const scene = document.createElement('div');
  scene.className = SCENE_CONTAINER_CLASS;

  const bg = document.createElement('div');
  bg.className = 'bw-boss-bg';

  const vignette = document.createElement('div');
  vignette.className = 'bw-boss-vignette';

  const character = document.createElement('div');
  character.className = 'bw-boss-character';

  // Move existing #bossImg into character layer if it exists; else create one.
  // Legacy JS reads #bossImg by ID — we MUST preserve the element identity,
  // only relocating it inside our new container.
  const existingBossImg = document.getElementById('bossImg');
  if (existingBossImg) {
    character.appendChild(existingBossImg);
  } else {
    const img = document.createElement('img');
    img.id = 'bossImg';
    img.alt = '';
    character.appendChild(img);
  }

  const ambient = document.createElement('div');
  ambient.className = 'bw-boss-ambient';

  const overlay = document.createElement('div');
  overlay.className = 'bw-boss-overlay';
  overlay.innerHTML = `
    <div class="bw-boss-nameline">
      <span class="bw-boss-emblem" aria-hidden="true"></span>
      <span class="bw-boss-name"></span>
    </div>
    <div class="bw-boss-hp">
      <div class="bw-boss-hp-fill"></div>
      <div class="bw-boss-hp-text"></div>
    </div>
  `;

  scene.appendChild(bg);
  scene.appendChild(vignette);
  scene.appendChild(character);
  scene.appendChild(ambient);
  scene.appendChild(overlay);

  // Clear slot before appending (no-op on first mount, ensures clean state
  // if a previous destroy was incomplete).
  slot.innerHTML = '';
  slot.appendChild(scene);

  _scene = {
    rootEl,
    slot,
    scene,
    bg,
    vignette,
    character,
    ambient,
    overlay,
    nameEl: overlay.querySelector('.bw-boss-name'),
    emblemEl: overlay.querySelector('.bw-boss-emblem'),
    hpFillEl: overlay.querySelector('.bw-boss-hp-fill'),
    hpTextEl: overlay.querySelector('.bw-boss-hp-text'),
    currentElement: null,
  };

  // Apply initial boss state. If undefined, falls through to 'umbra' fallback
  // in resolveBossElement().
  updateBossScene(boss);
  return true;
}

/**
 * updateBossScene(state)
 *
 * state: { element?, name?, hp?, hpMax? } — partial update; missing fields
 *        leave the prior value untouched. Cheap to call every frame; visual
 *        updates are CSS-transition-driven so no layout thrash.
 */
export function updateBossScene(state) {
  if (!_scene) return;

  // Element switch (rare — typically once per boss spawn). Triggers
  // background lazy-load + ambient class swap.
  const nextElement = resolveBossElement(state);
  if (nextElement !== _scene.currentElement) {
    _applyElement(nextElement);
    _scene.currentElement = nextElement;
  }

  // Name update
  if (state && typeof state.name === 'string' && _scene.nameEl) {
    _scene.nameEl.textContent = state.name;
  }

  // HP update — both percentage fill and M/K formatted text
  if (state && typeof state.hp === 'number' && typeof state.hpMax === 'number' && state.hpMax > 0) {
    const pct = Math.max(0, Math.min(100, (state.hp / state.hpMax) * 100));
    _scene.hpFillEl.style.setProperty('--bw-boss-hp-pct', `${pct}%`);
    _scene.hpTextEl.textContent = `${_formatHp(state.hp)} / ${_formatHp(state.hpMax)}`;
  }
}

/**
 * destroyBossScene()
 *
 * Tears down the scene DOM + clears module state. Called by cleanupBattleScreen.
 * Idempotent — safe to call when no scene mounted.
 */
export function destroyBossScene() {
  if (!_scene) return;

  // Move bossImg back to its original home (if legacy expects it at top-level
  // of #screenBattle) so subsequent legacy reads don't fail. The element
  // itself is preserved — only its parent is restored.
  const bossImg = _scene.character.querySelector('#bossImg');
  if (bossImg && bossImg.parentNode) {
    bossImg.parentNode.removeChild(bossImg);
    const fallbackHome = document.getElementById('screenBattle');
    if (fallbackHome) fallbackHome.appendChild(bossImg);
  }

  _scene.slot.innerHTML = '';
  _scene = null;
}

// ─── internal helpers ────────────────────────────────────────────────────────

function _applyElement(element) {
  const assets = ELEMENT_ASSETS[element];
  if (!assets || !_scene) return;

  // Background — lazy load, then apply via inline style background-image
  preloadBackground(element)
    .then(() => {
      if (_scene && _scene.currentElement === element) {
        _scene.bg.style.backgroundImage = `url("${assets.bg}")`;
      }
    })
    .catch(() => {
      // Asset failed to load — scene degrades to vignette + character only.
      // No throw; logged in browser console by browser itself.
    });

  // Ambient particle class — swap from previous element if any
  if (_scene.ambient) {
    _scene.ambient.className = `bw-boss-ambient bw-ambient--${assets.ambient}`;
  }

  // Element emblem (Z4 overlay) — uses CSS background-image so the image
  // can be swapped without DOM rebuild
  if (_scene.emblemEl) {
    _scene.emblemEl.style.backgroundImage = `url("${assets.emblem}")`;
  }

  // HP gauge gradient — uses element CSS variables for fill colors
  if (_scene.hpFillEl) {
    _scene.hpFillEl.style.setProperty('--bw-boss-hp-fill', `var(--a-${element})`);
    _scene.hpFillEl.style.setProperty('--bw-boss-hp-fill-dk', `var(--a-${element}-dk)`);
  }
}

// Format boss HP as M/K per plan §7.2 (e.g. 3600000 → "3.6M", 7200 → "7.2K")
function _formatHp(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n | 0);
}

// Test hooks — exported only for unit tests; not part of public API.
export const _testables = Object.freeze({
  _formatHp,
  _getCurrentScene: () => _scene,
});
