// 2026-05-11 — TASK-012 (T1.11): home-hub menu screen relocated from legacy.
// 2026-05-12 — TASK-020 (T1.13.5): V3.0 Vivid render helpers folded in.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - renderResourceBar()              line 24024-24032   (gold + gems + HP/mit chip strip)
//   - renderMenu()                     line 66689-66707   (V3.0 vivid hub dispatcher)
//   - startBattleFromMenu()            line 66569-66609   (squad gate + auto-pick boss)
//   - startBattleFromSelect()          line 66611-66613   (alias)
//   - vRenderTopbar()                  line 66710-66757   (topbar resource chips)
//   - vRenderWhatsNew()                line 66792-66805   (WHATS NEW accordion)
//   - vRenderChapter()                 line 66827-66898   (chapter selector + nodes)
//   - vRenderBossCard()                line 66900-66940   (boss preview card)
//   - vRenderSquadDock()               line 66942-66972   (squad portraits dock)
//   - _vLastCounters / vCountUpNode    line 67402-67420   (topbar count-up helpers)
//
// Owns: home-screen rendering + the "Start battle" CTA dispatcher + V3.0
// Vivid hub render helpers (topbar / chapter / boss card / squad dock /
// whats-new). vRenderCosmicMemorial deleted in T1.15 — Ch3 hub strip
// (Block 6.5 DEBT-9) was removed from the home hub in v2.1 polish v0.1 Track B
// (Roman: 2026-04-29); T1.15 completes the purge per v2.1 P5 §7.
//
// Does NOT own:
//   - showScreen() / goToMenu() / goToSelect() — see router.js
//   - Modal dialogs (info / locked-hero / hero-detail) — those are per-screen
//     concerns owned by select.js / battle-screen.js / shop.js as appropriate.
//
// 2026-05-11 — Roman: pure-relocation discipline.

/* eslint-disable no-empty, no-unused-vars, no-redeclare */

// T1.13.1 (2026-05-11): /* global */ → ES imports for resolved src/ exports.
// Resolved → imports below. Unresolved (legacy-only) tokens documented in the
// remaining /* global */ block — those modules still live in legacy until a
// later cleanup pass.
// T1.13.5 (2026-05-12): vRender* family relocated locally (was /* global */).
//   Pulled in HERO_ROSTER from heroes.js + ASSETS from data/assets.js to back
//   the topbar/avatar/boss-card image lookups now that the renderers live here.
import { isFtueActive } from '../core/ftue-state.js';
import { showScreen, goToSelect } from './router.js';
import { startBossBattle } from '../core/battle.js';
// T1.13.4: playDialog flipped from /* global */ to ES import; getSquadMax() from balance.
import { playDialog } from './dialog.js';
import { getSquadMax } from '../data/balance.js';
import { log } from '../services/logger.js';
// T1.13.5: vRender* dependencies imported from src.
import { HERO_ROSTER } from '../core/heroes.js';
import { ASSETS } from '../data/assets.js';

/* global renderBossProgression, renderChapterToggle, renderEssenceStrip,
   renderResourceBarHpMit,
   gold, gems,
   activeSquad, seenDialogs,
   flashText, rebuildHeroDeck,
   bossesDefeated, chapterProgress, currentChapter,
   BOSSES, selectedBossIdx, currentBossIdx,
   leaderHeroId, dailyMissionsState, loginStreakState,
   countUnclaimedWeeklyMissions,
   chapter2Unlocked, chapter3Unlocked, chapter4Unlocked,
   switchChapter, vAnimateNumber, vPlayLevelPulse */
/* global currentBossIdx:writable, bossesDefeated:writable, chapterProgress:writable */
// LEGACY-ONLY: above tokens have no src/ export — shims retired in T1.14+ cleanup.

// ─── renderResourceBar — gold + gem strip (legacy 24024-24032) ──────────────
export function renderResourceBar() {
  const gEl = document.getElementById('resGoldAmt');
  if (gEl) gEl.textContent = gold.toLocaleString('en-US');
  const gmEl = document.getElementById('gemCount');
  if (gmEl) gmEl.textContent = String(gems);
  // 2026-05-02 — COMBAT v2.1 P1 §5.5: HP X/100 + 🛡% chips. Defensively
  // injected — silently no-ops if no resource-bar container exists in DOM.
  try { if (typeof renderResourceBarHpMit === 'function') renderResourceBarHpMit(); } catch (e) {}
}

// ─── renderMenu — V3.0 vivid hub dispatcher (legacy 66689-66707) ────────────
export function renderMenu() {
  // V3.0 Phase 2 Vivid Stylized — main hub layout.
  try { vRenderTopbar(); }    catch(e){ log.warn('vRenderTopbar failed:', e); }
  try { vRenderChapter(); }   catch(e){ log.warn('vRenderChapter failed:', e); }
  try { vRenderBossCard(); }  catch(e){ log.warn('vRenderBossCard failed:', e); }
  try { vRenderSquadDock(); } catch(e){ log.warn('vRenderSquadDock failed:', e); }
  // T2.12 (2026-05-12): Codex drawer entry per spec §4.7 ("📜 CODEX" below
  // TOWER and ADVENTURE). Additive — does NOT rearrange any existing menu
  // items. Self-gates on FTUE so the entry stays hidden during tutorial
  // (matches the dailies/tower/season visibility pattern).
  try { vRenderCodexDrawerEntry(); } catch(e){ log.warn('vRenderCodexDrawerEntry failed:', e); }
  // T3.03 (2026-05-13): Adventures drawer entry per spec §2 (async clan
  // create/browse/join/view/leave). Additive — placed below CODEX entry.
  // FTUE-gated (matches Codex / dailies / tower / season visibility pattern).
  try { vRenderAdventuresDrawerEntry(); } catch(e){ log.warn('vRenderAdventuresDrawerEntry failed:', e); }
  // T3.06 (2026-05-13): Friend leaderboard mini-block widget per spec §5.
  // Mounted inline on menu (NOT a new screen). Additive — placed below the
  // Adventures drawer entry. FTUE-gated. Dynamic-import keeps the menu-path
  // bundle slim — friend-leaderboard module only loads after menu render.
  try { vRenderFriendLeaderboardMount(); } catch(e){ log.warn('vRenderFriendLeaderboardMount failed:', e); }
  // 2026-04-30 — Polish v0.2 Track I §I.4.4: WHAT'S NEW accordion
  // visibility + auto-expire. No-ops if no Ch.1-unlock timestamp is set
  // or if the 3-day window has passed.
  try { vRenderWhatsNew(); }  catch(e){ log.warn('vRenderWhatsNew failed:', e); }
  // T1.15 (2026-05-12): vRenderCosmicMemorial() call removed. Ch3 hub strip
  // (Block 6.5 DEBT-9) was deleted per v2.1 P5 §7 Final Legacy Purge.
  // Legacy renderers — kept because they update other screens or are called from
  // many code paths. Their DOM hosts no longer exist in screenMenu, but each
  // function no-ops via null-guards when the target element is missing.
  try { renderResourceBar(); }      catch(e){}
  try { renderBossProgression(); }  catch(e){}
  try { renderChapterToggle(); }    catch(e){}
  try { renderEssenceStrip(); }     catch(e){}
}

// ─── startBattleFromMenu — primary CTA (legacy 66569-66609) ─────────────────
export function startBattleFromMenu() {
  if (activeSquad.length < getSquadMax()) {
    // 2026-04-27 — Pre-Lich (and any post-bump) tutorial. The classic flash
    // "SELECT 5 HEROES" is terse; for the FIRST time the player hits this
    // gate after getSquadMax() bumped to 5 (post-Phoenix), show a clear dialog
    // explaining WHY + route them to the Select screen so they can add the
    // missing hero. Gated by seenDialogs so subsequent under-squad attempts
    // get the lighter flash. Suppressed during FTUE so scripted onboarding
    // never collides with this gate.
    try {
      const ftueOff = (typeof isFtueActive !== 'function') || !isFtueActive();
      const seen    = (typeof seenDialogs !== 'undefined') && seenDialogs;
      if (ftueOff && getSquadMax() === 5 && seen && !seen.has('tut_pre_lich_check')) {
        if (typeof playDialog === 'function') {
          playDialog('tut_pre_lich_check', () => {
            // After dialog: route to Select screen so player can fill the slot.
            try { if (typeof goToSelect === 'function') goToSelect(); } catch (e) {}
          });
          return;  // suppress the legacy flash on this one-time tutorial path
        }
      }
    } catch (e) {}
    flashText(`SELECT ${getSquadMax()} HEROES`, '#E85D4A');
    return;
  }
  // Task #1.7: Energy gate removed.
  rebuildHeroDeck();
  showScreen('battle');
  // V18.19: honor player's boss pick if valid (<= bossesDefeated), else auto-pick next undefeated.
  bossesDefeated = chapterProgress[currentChapter] || 0;
  const autoIdx = bossesDefeated >= BOSSES.length ? 0 : bossesDefeated;
  if (selectedBossIdx !== null && selectedBossIdx <= bossesDefeated && selectedBossIdx < BOSSES.length) {
    currentBossIdx = selectedBossIdx;
  } else {
    currentBossIdx = autoIdx;
  }
  if (currentBossIdx === 0 && bossesDefeated >= BOSSES.length) {
    bossesDefeated = 0; chapterProgress[currentChapter] = 0;
  }
  startBossBattle();
}

// ─── startBattleFromSelect — alias (legacy 66611-66613) ─────────────────────
export function startBattleFromSelect() {
  startBattleFromMenu();
}

// ─── setupMenuEventListeners / cleanupMenu — listener contract ──────────────
// Per Execution Plan §13 T1.11 the screen module contract is:
//   render<Screen>() + setup<Screen>EventListeners() + cleanup<Screen>()
// T1.11 lands the render+CTA functions; T1.12 wires the addEventListener
// calls when src/main.js becomes the entry point. The legacy HTML carries
// onclick="..." attributes on the buttons — those are NOT removed in T1.11
// (legacy HTML stays untouched), but the setup function shape is reserved
// here so T1.12 has a stable target.
export function setupMenuEventListeners() {
  // TODO(T1.12): attach 'click' listeners to:
  //   #startBattleBtn → startBattleFromMenu
  //   #goToSelectBtn  → goToSelect
  //   #goToShopBtn    → showScreen('shop')
  //   #goToTowerBtn   → showScreen('tower')
  //   #goToSeasonBtn  → showScreen('season')
  //   #goToProfileBtn → showScreen('profile')
  //   #goToDailiesBtn → showScreen('dailies')
}

export function cleanupMenu() {
  // TODO(T1.12): remove listeners attached in setupMenuEventListeners().
}

// ═══════════════════════════════════════════════════════════════════════════
// T1.13.5 (2026-05-12): V3.0 Vivid render-helper relocation.
// Byte-perfect from legacy lines noted in each function header. Module-private;
// renderMenu() calls them directly. /* global */ block at top of file lists
// legacy-only tokens these still reach for (vAnimateNumber, switchChapter,
// dailyMissionsState, etc.).
// ═══════════════════════════════════════════════════════════════════════════

// ─── Topbar count-up helpers (legacy 67402-67420) ───────────────────────────
const _vLastCounters = { gold: null, gem: null, lvl: null };
function vCountUpNode(id, to) {
  const node = document.getElementById(id);
  if (!node) return;
  const prev = _vLastCounters[id === 'vGoldAmt' ? 'gold' : id === 'vGemAmt' ? 'gem' : 'lvl'];
  if (prev === null || prev === undefined) { node.textContent = to.toLocaleString('en-US'); return; }
  if (prev === to) return;
  if (typeof vAnimateNumber === 'function') vAnimateNumber(node, prev, to, 700);
  else node.textContent = to.toLocaleString('en-US');
  // Brief scale-bump on the containing chip for extra juice
  const chip = node.closest('.a-btn-chip') || node.closest('.v-chip') || node.closest('.v-avatar-btn');
  if (chip) {
    chip.classList.remove('v-countup-pulse');
    void chip.offsetWidth;
    chip.classList.add('v-countup-pulse');
    setTimeout(() => chip.classList.remove('v-countup-pulse'), 320);
  }
}

// ─── vRenderTopbar (legacy 66710-66757) ─────────────────────────────────────
export function vRenderTopbar() {
  // Task #1.7: Energy system removed — no catchUpEnergyRegen / vEnergyAmt update.
  // V3.0 Phase 9 Vivid: animate resource deltas via CountUp, and keep plain
  // textContent as a fallback if the previous snapshot is unknown.
  const gEl = document.getElementById('vGoldAmt');
  if (gEl) { vCountUpNode('vGoldAmt', gold); _vLastCounters.gold = gold; }
  const mEl = document.getElementById('vGemAmt');
  if (mEl) { vCountUpNode('vGemAmt', gems); _vLastCounters.gem = gems; }
  // Player level — rough proxy while no real level system exists.
  const lvlEl = document.getElementById('vPlayerLvl');
  if (lvlEl) {
    const lvl = (currentChapter - 1) * BOSSES.length + (chapterProgress[currentChapter] || 0) + 1;
    const prev = _vLastCounters.lvl;
    lvlEl.textContent = String(lvl);
    if (prev !== null && prev !== undefined && lvl > prev) {
      try { if (typeof vPlayLevelPulse === 'function') vPlayLevelPulse(document.getElementById('vAvatarBtn')); } catch(e){}
    }
    _vLastCounters.lvl = lvl;
  }
  // Player avatar — leader's portrait if set, else first squad member.
  const avEl = document.getElementById('vAvatarImg');
  if (avEl) {
    const avHeroId = (typeof leaderHeroId !== 'undefined' && leaderHeroId) || activeSquad[0];
    const avHero = avHeroId ? HERO_ROSTER.find(h => h.id === avHeroId) : null;
    if (avHero && ASSETS[avHero.img]) avEl.src = ASSETS[avHero.img];
  }
  // V3.0 Phase 11: wordmark at the top of the Main Hub (lazy-set src once).
  const logoEl = document.getElementById('vMenuLogoImg');
  if (logoEl && ASSETS.Logo && !logoEl.src) logoEl.src = ASSETS.Logo;
  // Task #1.7: CTA sub-label (energy cost) removed with Energy system.
  // Daily badge — count unclaimed missions + streak.
  const db = document.getElementById('vDailyBadge');
  if (db) {
    try {
      const ftue = (typeof isFtueActive === 'function') && isFtueActive();
      if (ftue) { db.style.display = 'none'; }
      else {
        const unclaimed = (typeof dailyMissionsState !== 'undefined' && dailyMissionsState && dailyMissionsState.missions || [])
          .filter(m => m.completed && !m.claimed).length;
        const weeklies  = (typeof countUnclaimedWeeklyMissions === 'function') ? countUnclaimedWeeklyMissions() : 0;
        const login     = (typeof loginStreakState !== 'undefined' && loginStreakState && loginStreakState.claimedToday) ? 0 : 1;
        const total = unclaimed + weeklies + login;
        if (total > 0) { db.textContent = String(total); db.style.display = ''; }
        else { db.style.display = 'none'; }
      }
    } catch(e) { db.style.display = 'none'; }
  }
}

// ─── vRenderWhatsNew (legacy 66792-66805) ───────────────────────────────────
// 2026-04-30 — Polish v0.2 Track I §I.4.4: WHAT'S NEW hub accordion.
// Runs every hub render and decides visibility based on the expiry timestamp
// stamped at Ch.1 unlock. Auto-hides (and clears the timestamp) once the 3-day
// window elapses, so the block isn't a permanent fixture.
export function vRenderWhatsNew() {
  const block = document.getElementById('vWhatsNewBlock');
  if (!block) return;
  let expires = 0;
  try { expires = parseInt(localStorage.getItem('blocksworn_whatsnew_expires') || '0', 10) || 0; } catch (e) {}
  if (!expires || Date.now() >= expires) {
    block.hidden = true;
    if (expires) {
      try { localStorage.removeItem('blocksworn_whatsnew_expires'); } catch (e) {}
    }
    return;
  }
  block.hidden = false;
}

// ─── vRenderChapter (legacy 66827-66898) ────────────────────────────────────
export function vRenderChapter() {
  const numEl = document.getElementById('vChapterNum');
  const fillEl = document.getElementById('vChapterFill');
  const ofEl = document.getElementById('vChapterOfN');
  const done = chapterProgress[currentChapter] || 0;
  const total = BOSSES.length;
  // 2026-04-29 polish v0.1 Track B: kicker now reads "NEXT BATTLE · CH.X · N OF M".
  const _displaySel = (selectedBossIdx !== null && selectedBossIdx <= done)
    ? selectedBossIdx
    : Math.min(done, total - 1);
  const _allCleared = (done >= total);
  if (numEl) {
    numEl.textContent = _allCleared
      ? `CH.${currentChapter} · CLEARED`
      : `NEXT BATTLE · CH.${currentChapter} · ${_displaySel + 1} OF ${total}`;
  }
  if (fillEl) fillEl.style.width = `${Math.round((done / total) * 100)}%`;
  if (ofEl) ofEl.textContent = `${done}/${total}`;
  // 2026-04-27 — Chapter picker dropdown.
  try {
    const pick = document.getElementById('vChapterPick');
    const menu = document.getElementById('vChapterMenu');
    if (pick && menu) {
      const ch2 = (typeof chapter2Unlocked !== 'undefined') && chapter2Unlocked;
      const ch3 = (typeof chapter3Unlocked !== 'undefined') && chapter3Unlocked;
      // 2026-05-02 — SPRINT 3A: Ch4 menu entry (locked until Boss 15 defeat)
      const ch4 = (typeof chapter4Unlocked !== 'undefined') && chapter4Unlocked;
      const unlockedCount = 1 + (ch2 ? 1 : 0) + (ch3 ? 1 : 0) + (ch4 ? 1 : 0);
      pick.classList.toggle('solo', unlockedCount < 2);
      // Build menu items
      const items = [
        { n: 1, name: 'ASHEN DOMINION',  unlocked: true },
        { n: 2, name: 'BLOOM OF MADNESS', unlocked: ch2 },
        { n: 3, name: 'VEIL OF FORGOTTEN GODS',  unlocked: ch3 },
        { n: 4, name: 'COURT OF FALLEN HEAVENS', unlocked: ch4 },
      ];
      menu.innerHTML = items.map(it => {
        const active = (it.n === currentChapter) ? ' active' : '';
        const locked = (!it.unlocked) ? ' locked' : '';
        const click  = it.unlocked
          ? `onclick="vSelectChapter(${it.n})"`
          : 'disabled aria-disabled="true"';
        const lockIcn = it.unlocked ? '' : ' 🔒';
        return `<button class="a-hub-chapter-item${active}${locked}" ${click} role="menuitem">`
             + `<span class="a-hub-chapter-item-num">CH.${it.n}</span>`
             + `<span class="a-hub-chapter-item-name">${it.name}${lockIcn}</span>`
             + `</button>`;
      }).join('');
    }
  } catch (e) { /* non-fatal */ }
  // POLISH v1 · PHASE 2 — render milestone nodes
  try {
    const nodes = document.getElementById('vChapterNodes');
    if (nodes) {
      const current = Math.min(done, total - 1);
      let html = '';
      for (let i = 0; i < total; i++) {
        let cls = 'a-hub-progress-node';
        if (i < done) cls += ' cleared';
        else if (i === current) cls += ' current';
        html += '<div class="' + cls + '"></div>';
      }
      nodes.innerHTML = html;
    }
  } catch (e) { /* non-fatal */ }
}

// ─── vRenderBossCard (legacy 66900-66940) ───────────────────────────────────
export function vRenderBossCard() {
  const done = chapterProgress[currentChapter] || 0;
  const autoIdx = Math.min(done, BOSSES.length - 1);
  const sel = (selectedBossIdx !== null && selectedBossIdx <= done) ? selectedBossIdx : autoIdx;
  const boss = BOSSES[sel];
  if (!boss) return;
  const imgEl = document.getElementById('vBossImg');
  if (imgEl && ASSETS[boss.img]) imgEl.src = ASSETS[boss.img];
  const nameEl = document.getElementById('vBossName');
  if (nameEl) nameEl.textContent = boss.name;
  const subEl = document.getElementById('vBossSub');
  if (subEl) subEl.textContent = `${boss.title.toUpperCase()} · ${boss.stihiya.toUpperCase()}`;
  // Stars: boss index + 1 within chapter.
  const diffEl = document.getElementById('vBossDiff');
  if (diffEl) {
    const stars = Math.min(5, sel + 1);
    diffEl.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('span');
      s.className = 'star' + (i < stars ? '' : ' empty');
      s.textContent = '★';
      diffEl.appendChild(s);
    }
  }
  // Rewards — placeholder values derived from boss HP tier.
  const rwEl = document.getElementById('vBossRewardsItems');
  if (rwEl) {
    const gold = Math.max(50, Math.floor(boss.hp / 40));
    const xp = 10 + sel * 5 + (currentChapter - 1) * 10;
    rwEl.innerHTML =
      `<span class="rw"><span class="ic gold">◆</span>${gold}</span>` +
      `<span class="rw"><span class="ic xp">✦</span>${xp}</span>`;
  }
  // POLISH v1 · PHASE 2 — element-tinted aura on central boss
  try {
    const bossCard = document.getElementById('vBossCard');
    if (bossCard && boss && boss.stihiya) {
      bossCard.setAttribute('data-element', boss.stihiya);
    }
  } catch (e) { /* non-fatal */ }
}

// ─── vRenderSquadDock (legacy 66942-66972) ──────────────────────────────────
export function vRenderSquadDock() {
  const host = document.getElementById('vSquadAvatars');
  if (!host) return;
  host.innerHTML = '';
  // 2026-04-29 polish v0.1 Track B: hero names visible under each portrait.
  for (let i = 0; i < 5; i++) {
    const id = activeSquad[i];
    const h = id ? HERO_ROSTER.find(x => x.id === id) : null;
    const slot = document.createElement('div');
    slot.className = 'v-avatar-slot' + (h ? '' : ' empty');
    const av = document.createElement('div');
    av.className = 'v-avatar' + (h ? ` ${h.stihiya}` : ' empty');
    if (h && ASSETS[h.img]) {
      const im = document.createElement('img');
      im.src = ASSETS[h.img];
      im.alt = h.name;
      av.appendChild(im);
    } else if (!h) {
      av.textContent = '+';
    }
    slot.appendChild(av);
    const name = document.createElement('div');
    name.className = 'v-avatar-name';
    name.textContent = h ? h.name : '';
    slot.appendChild(name);
    host.appendChild(slot);
  }
}

// ─── vRenderCodexDrawerEntry (T2.12, 2026-05-12) ────────────────────────────
// Spec: docs/design/mechanics/identity-layer.md §4.7 ("📜 CODEX" drawer entry
// below TOWER and ADVENTURE). Additive — appends a new entry to the existing
// hub drawer if a known mount point exists. Idempotent — re-running creates
// the entry only once (id-keyed). FTUE-gated so the entry stays hidden during
// tutorial (matches dailies/tower/season visibility pattern).
//
// Mount-point resolution (best-effort, order):
//   1. #vMenuDrawer (legacy hub drawer container if present)
//   2. #vHubNavRow  (alt drawer location)
//   3. #screenMenu  (final fallback — appended as floating button)
//
// No-op if no mount point exists (the new shell may not have a hub drawer yet;
// the codex route remains reachable via direct `showScreen('codex')` even when
// the drawer entry is absent).
function vRenderCodexDrawerEntry() {
  if (typeof document === 'undefined') return;
  // FTUE gate — Codex entry hidden during tutorial.
  try {
    if (typeof isFtueActive === 'function' && isFtueActive()) {
      const existing = document.getElementById('vGoToCodexBtn');
      if (existing) existing.style.display = 'none';
      return;
    }
  } catch(e){}
  // Idempotent: only create once.
  let btn = document.getElementById('vGoToCodexBtn');
  if (btn) {
    btn.style.display = '';
    return;
  }
  // Resolve mount point.
  const mount = document.getElementById('vMenuDrawer')
             || document.getElementById('vHubNavRow')
             || document.getElementById('screenMenu');
  if (!mount) return;
  btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'vGoToCodexBtn';
  btn.className = 'a-btn-drawer a-btn-codex';
  btn.setAttribute('aria-label', 'Open Codex');
  btn.textContent = '📜 CODEX';
  btn.addEventListener('click', () => {
    try { showScreen('codex'); } catch (e) { log.warn('Codex nav failed:', e); }
  });
  mount.appendChild(btn);
}

// ─── vRenderAdventuresDrawerEntry (T3.03, 2026-05-13) ───────────────────────
// Spec: docs/design/endgame-social.md §2 (Adventures — async clan 5–15).
// Mirror of vRenderCodexDrawerEntry — appends a new "🏰 ADVENTURES" entry to
// the existing hub drawer if a known mount point exists. Idempotent —
// re-running creates the entry only once (id-keyed). FTUE-gated so the entry
// stays hidden during tutorial (matches Codex visibility pattern).
//
// Optional badge: if the player is in any clan, the entry shows "🏰 ADVENTURES
// · N" with the count. Uses the +1 minimal window-bridge __getPlayerClanCount
// from T3.02 so we don't drag the full clan-backend module into legacy.
//
// Mount-point resolution (best-effort, order):
//   1. #vMenuDrawer
//   2. #vHubNavRow
//   3. #screenMenu
//
// No-op if no mount point exists. Adventures route remains reachable via
// direct `showScreen('adventures')` even when the drawer entry is absent.
function vRenderAdventuresDrawerEntry() {
  if (typeof document === 'undefined') return;
  // FTUE gate.
  try {
    if (typeof isFtueActive === 'function' && isFtueActive()) {
      const existing = document.getElementById('vGoToAdventuresBtn');
      if (existing) existing.style.display = 'none';
      return;
    }
  } catch(e){}
  let btn = document.getElementById('vGoToAdventuresBtn');
  if (btn) {
    btn.style.display = '';
    // Refresh badge count opportunistically.
    _refreshAdventuresBadge(btn);
    return;
  }
  const mount = document.getElementById('vMenuDrawer')
             || document.getElementById('vHubNavRow')
             || document.getElementById('screenMenu');
  if (!mount) return;
  btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'vGoToAdventuresBtn';
  btn.className = 'a-btn-drawer a-btn-adventures';
  btn.setAttribute('aria-label', 'Open Adventures');
  btn.textContent = '🏰 ADVENTURES';
  btn.addEventListener('click', () => {
    try { showScreen('adventures'); } catch (e) { log.warn('Adventures nav failed:', e); }
  });
  mount.appendChild(btn);
  _refreshAdventuresBadge(btn);
}

// Async badge refresh — reads the +1 T3.02 bridge to surface clan count.
// Best-effort: silently no-ops if the bridge is missing (legacy load path).
function _refreshAdventuresBadge(btn) {
  try {
    if (!btn || typeof window === 'undefined' || typeof window.__getPlayerClanCount !== 'function') return;
    let playerId = 'anonymous';
    try {
      const name = localStorage.getItem('blocksworn_p8_player_name');
      if (typeof name === 'string' && name.trim().length > 0) playerId = name.trim().toLowerCase();
    } catch (_e) {}
    Promise.resolve(window.__getPlayerClanCount(playerId)).then(count => {
      try {
        const n = (typeof count === 'number') ? count : 0;
        btn.textContent = n > 0 ? `🏰 ADVENTURES · ${n}` : '🏰 ADVENTURES';
      } catch (_e) {}
    }).catch(() => {});
  } catch (_e) {}
}

// ─── vRenderFriendLeaderboardMount (T3.06, 2026-05-13) ──────────────────────
// Spec: docs/design/endgame-social.md §5 (Friend leaderboard mini-block).
// Mounts a friend-leaderboard widget INLINE on the menu (below Adventures
// drawer entry). Additive — does NOT rearrange existing menu items.
// FTUE-gated so the widget stays hidden during tutorial (matches Codex /
// Adventures visibility pattern). Dynamic-import keeps the menu-path bundle
// slim — friend-leaderboard module only loads after menu render.
//
// Mount-point resolution (best-effort, order):
//   1. #vMenuDrawer (legacy hub drawer container if present)
//   2. #vHubNavRow  (alt drawer location)
//   3. #screenMenu  (final fallback)
//
// No-op if no mount point exists. Idempotent — re-running creates the
// host only once (id-keyed).
function vRenderFriendLeaderboardMount() {
  if (typeof document === 'undefined') return;
  // FTUE gate — friend widget hidden during tutorial.
  try {
    if (typeof isFtueActive === 'function' && isFtueActive()) {
      const existing = document.getElementById('friendLeaderboardWidgetMount');
      if (existing) existing.style.display = 'none';
      return;
    }
  } catch (_e) {}
  let host = document.getElementById('friendLeaderboardWidgetMount');
  if (!host) {
    const mount = document.getElementById('vMenuDrawer')
               || document.getElementById('vHubNavRow')
               || document.getElementById('screenMenu');
    if (!mount) return;
    host = document.createElement('div');
    host.id = 'friendLeaderboardWidgetMount';
    mount.appendChild(host);
  } else {
    host.style.display = '';
  }
  // Dynamic import — friend-leaderboard module loads lazily on first menu
  // render after FTUE. Defensive: never throws into the menu render path.
  import('./friend-leaderboard.js').then(mod => {
    try {
      mod.renderFriendLeaderboardWidget(host);
    } catch (e) { log.warn('renderFriendLeaderboardWidget failed:', e); }
  }).catch(e => log.warn('friend-leaderboard dynamic import failed:', e));
}

// ─── vRenderCosmicMemorial — DELETED in T1.15 ───────────────────────────────
// 2026-05-12 — T1.15 (TASK-023): Cosmic Memorial (Ch3 hub strip, Block 6.5
// DEBT-9) deleted per v2.1 P5 §7 Final Legacy Purge. The renderer had been
// inert since v2.1 polish v0.1 Track B (Roman: 2026-04-29) removed the
// #vCosmicMemorial / #vMemorialStrip DOM hosts from the home hub markup —
// the function null-guarded into a silent no-op. Migration shim
// `migrateRemoveCosmicMemorial()` in src/services/migrate.js scrubs the
// legacy localStorage keys this subsystem ever touched.
