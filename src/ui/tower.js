// 2026-05-11 — TASK-012 (T1.11): Tower screen relocated from legacy.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - goToTower()                      line 32604-32623   (unlock gate + nav)
//   - renderTowerScreen()              line 32625-32822   (gauntlet entry + daily status + theme/buff banners + history)
//   - renderTowerModeBanner()          line 29262-29280   (in-battle Tower mode chip)
//   - renderLeaderboardP9(segment, targetEl)
//                                     line 50367-50426   (Global / F2P / Weekly leaderboards — PURE PATH sacred)
//
// SACRED PER CLAUDE.md §2.5: TOWER_LEADERBOARDS (Global / F2P / Weekly),
// TOWER_PACTS (Slay-the-Spire-style relics), PURE PATH F2P-only leaderboard,
// Uroboros seasonal boss — all preserved byte-perfect. Only UI render code
// lives here; the underlying state machine + leaderboard submission flow
// stays in legacy.
//
// Owns: Tower-screen UI rendering. Per-fight Tower banner overlay (the
// "⛩ TOWER MODE · F<n>" chip in renderTowerModeBanner) is included here
// because it's a Tower-screen concern even when shown during battle.
//
// Does NOT own:
//   - Tower run state machine (startTowerRun / continueTowerRun /
//     abandonTowerRun / checkTowerDailyReset / checkTowerWeeklyReset /
//     getNextTowerRetryCost / isTowerUnlocked) — those are progression
//     state mutators, owned by legacy until a future src/core/tower.js
//     extraction.
//   - TOWER_ACHIEVEMENTS table — legacy module-scope; will move to
//     src/data/tower.js.
//   - Floor-selector modal (showFloorSelector / closeFloorSelector) —
//     story-mode floor picker; lives in legacy as separate UI surface.
//
// 2026-05-11 — Roman: pure-relocation discipline.

/* eslint-disable no-empty, no-unused-vars, no-redeclare */

/* global document, showToast, showScreen, currentFloorId, _isTowerBattle,
   towerState, HERO_ROSTER, getActiveTitle, getActiveBuff,
   getTowerWeeklyTheme, TOWER_ACHIEVEMENTS, TOWER_WEEKLY_FLOORS,
   TOWER_SEASONAL_FLOORS, TOWER_DAILY_FLOORS, TOWER_MAX_ATTEMPTS_PER_DAY,
   TOWER_FRAGMENTS_PER_HEART, getCurrentWeeklyKey, getCurrentSeasonalKey,
   isWeeklyOpen, isSeasonalOpen, isTowerUnlocked, checkTowerWeeklyReset,
   checkTowerDailyReset, _maybeRefundStaleTowerAttempt,
   getNextTowerRetryCost, startTowerRun, continueTowerRun,
   abandonTowerRun, showTowerLeaderboardModal, openAchievementsModal,
   rollDailyCurses, saveTowerState, maybeShowTowerEducation */

import { log } from '../services/logger.js';

// ─── goToTower — unlock-gated nav (legacy 32604-32623) ──────────────────────
export function goToTower() {
  if (!isTowerUnlocked()) { showToast('Defeat CRYPT LICH first'); return; }
  // Task #1.5.4 hotfix: removed redundant FTUE guard.
  // isTowerUnlocked() already requires blocksworn_chapter_1_complete === 'true',
  // which in normal play implies FTUE completion (Ch1 Boss_1 IS the FTUE fight).
  // The secondary FTUE gate blocked dev smoke tests that manually set the flag,
  // and surfaced in Roman's incognito test as "TOWER silently stays on DAILY"
  // (the early-return toast left the previously-active screen in place).
  checkTowerWeeklyReset();
  if (typeof showScreen === 'function') {
    showScreen('tower');
  } else {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screenTower').classList.add('active');
  }
  renderTowerScreen();
  // 2026-04-28 — Player Education Stage 12: one-time Tower welcome modal.
  // No-op on subsequent visits (localStorage flag).
  try { maybeShowTowerEducation(); } catch (e) { log.warn('maybeShowTowerEducation failed:', e); }
}

// ─── renderTowerScreen — Tower hub UI (legacy 32625-32822) ──────────────────
export function renderTowerScreen() {
  // 2026-04-27 — Block T.1: ensure daily reset before UI render so attempts
  // counter + streak reflect the current 4 AM-bounded day.
  checkTowerDailyReset();
  // 2026-04-27 HOTFIX — refund stale attempts (ghost-launch recovery).
  try { if (typeof _maybeRefundStaleTowerAttempt === 'function') _maybeRefundStaleTowerAttempt(); } catch (e) {}
  // 2026-04-27 — Block T.4: gauntlet entry buttons toggle by date window.
  try {
    const wkBtn = document.getElementById('towerWeeklyBtn');
    const ssBtn = document.getElementById('towerSeasonalBtn');
    if (wkBtn) {
      const wkOpen   = isWeeklyOpen();
      const wkDoneKey = towerState.weeklyClearedKey;
      const wkKey     = getCurrentWeeklyKey();
      if (wkOpen && wkDoneKey !== wkKey) {
        wkBtn.style.display = '';
        wkBtn.textContent = (towerState.weeklyRunStarted && towerState.weeklyKey === wkKey)
          ? `▶ CONTINUE WEEKLY — F${towerState.weeklyCurrentFloor}/${TOWER_WEEKLY_FLOORS}`
          : '⚔ WEEKLY TRIAL — 25 floors';
      } else if (wkOpen && wkDoneKey === wkKey) {
        wkBtn.style.display = '';
        wkBtn.textContent = '✓ WEEKLY TRIAL DONE';
        wkBtn.disabled = true;
      } else {
        wkBtn.style.display = 'none';
        wkBtn.disabled = false;
      }
    }
    if (ssBtn) {
      const ssOpen   = isSeasonalOpen();
      const ssDoneKey = towerState.seasonalClearedKey;
      const ssKey     = getCurrentSeasonalKey();
      if (ssOpen && ssDoneKey !== ssKey) {
        ssBtn.style.display = '';
        ssBtn.textContent = (towerState.seasonalRunStarted && towerState.seasonalKey === ssKey)
          ? `▶ CONTINUE SEASONAL — F${towerState.seasonalCurrentFloor}/${TOWER_SEASONAL_FLOORS}`
          : '⭐ SEASONAL ASCENSION — 50 floors';
      } else if (ssOpen && ssDoneKey === ssKey) {
        ssBtn.style.display = '';
        ssBtn.textContent = '✓ SEASONAL DONE';
        ssBtn.disabled = true;
      } else {
        ssBtn.style.display = 'none';
        ssBtn.disabled = false;
      }
    }
  } catch (e) {}
  const at = document.getElementById('towerAllTime'); if (at) at.textContent = String(towerState.allTimeBest);
  const wk = document.getElementById('towerWeekly');  if (wk) wk.textContent = String(towerState.weeklyBest);
  const pt = document.getElementById('towerPoints');  if (pt) pt.textContent = String(towerState.towerPoints);
  const btn     = document.getElementById('towerEnterBtn');
  const current = document.getElementById('towerCurrent');
  // T.1 daily status row — streak / attempts / currencies
  const attemptsLeft = TOWER_MAX_ATTEMPTS_PER_DAY - towerState.attemptsToday;
  const nextRetryCost = getNextTowerRetryCost();
  const dailyStatus = `<div class="tower-daily-status">
    <span class="t-pill">DAY ${towerState.dailyKey || '-'}</span>
    <span class="t-pill">STREAK ${towerState.dailyStreak || 0} 🔥</span>
    <span class="t-pill">ATTEMPTS ${attemptsLeft}/${TOWER_MAX_ATTEMPTS_PER_DAY}</span>
    <span class="t-pill">♥ ${towerState.towerHearts} (${towerState.towerHeartFragments}/${TOWER_FRAGMENTS_PER_HEART})</span>
    <span class="t-pill">◈ ${towerState.sigilShards}</span>
    <span class="t-pill" style="background:rgba(255,213,61,0.18);color:#FFD53D;cursor:pointer" onclick="showTowerLeaderboardModal('daily')">🏆 LEADERBOARD</span>
  </div>`;
  // 2026-04-27 — Block T.9 — Title banner. Sits at the very top above
  // buffs/themes/curses. Also shows count of unlocked achievements + clickable
  // arrow into Achievements modal.
  let titleBanner = '';
  try {
    const t = (typeof getActiveTitle === 'function') ? getActiveTitle() : null;
    const unlockedCount = (towerState.unlockedAchievements || []).length;
    const totalCount = (typeof TOWER_ACHIEVEMENTS !== 'undefined') ? TOWER_ACHIEVEMENTS.length : 0;
    titleBanner = `<div class="tower-title-banner" onclick="openAchievementsModal()">
      ${t ? `<div class="ttitle-name">「 ${t} 」</div>` : '<div class="ttitle-name ttitle-empty">No title selected</div>'}
      <div class="ttitle-meta">★ ${unlockedCount}/${totalCount} achievements ▸</div>
    </div>`;
  } catch (e) {}
  // 2026-04-27 — Block T.6 — Active buff indicator. Sits above the theme
  // banner so player sees their active 24h buff on every Tower entry.
  let buffBanner = '';
  try {
    const b = (typeof getActiveBuff === 'function') ? getActiveBuff() : null;
    if (b) {
      const remaining = Math.max(0, towerState.buffActiveUntil - Date.now());
      const hrs = Math.floor(remaining / 3600000);
      const min = Math.floor((remaining % 3600000) / 60000);
      const lbl = hrs >= 1 ? `${hrs}h ${min}m` : `${min}m`;
      const rareCls = (b.cat === 'rare') ? ' rare' : '';
      buffBanner = `<div class="tower-buff-banner${rareCls}">
        <div class="tbb-label">★ ACTIVE BUFF · ${lbl} left</div>
        <div class="tbb-name">${b.name}</div>
        <div class="tbb-desc">${b.desc}</div>
      </div>`;
    }
  } catch (e) {}
  // 2026-04-27 — Block T.7 — Weekly Element Theme banner. Sits above curse
  // banner. Shows dominant + suppressed element with effect mults.
  let themeBanner = '';
  try {
    const theme = getTowerWeeklyTheme();
    if (theme && theme.dominant) {
      const ELEM_ICON = { ember:'🔥', tide:'❄️', grove:'🌍', umbra:'🌑', solar:'☀️' };
      const dom = (theme.dominant || '').toUpperCase();
      const sup = (theme.suppressed || '').toUpperCase();
      const domTitle = (theme.dominant || '').charAt(0).toUpperCase() + (theme.dominant || '').slice(1);
      // 2026-04-29 polish v0.1 Track E: explain the mechanic instead of
      // surfacing raw `+50% / −50%` shorthand. The label + actionable tip at
      // the bottom turn this from "data" into "guidance" — first-time-tower
      // players read it as "here's what to do this week".
      themeBanner = `<div class="tower-theme-banner">
        <div class="ttb-label">⚡ THIS WEEK'S ELEMENT BONUS</div>
        <div class="ttb-effects">
          <div class="ttb-dom">${ELEM_ICON[theme.dominant] || ''} ${dom} heroes deal +50% damage</div>
          <div class="ttb-sup">${ELEM_ICON[theme.suppressed] || ''} ${sup} heroes deal −50% damage</div>
        </div>
        <div class="ttb-tip">→ Pick a squad heavy on ${domTitle}</div>
      </div>`;
    }
  } catch (e) {}
  // 2026-04-27 — Block T.3 — Daily curse banner. Shows above status when at
  // least 1 hero is cursed today. Lists curse names so player can plan squad
  // swap before entering Tower.
  let curseBanner = '';
  try {
    if (Array.isArray(towerState.dailyCurses) && towerState.dailyCurses.length > 0) {
      const names = towerState.dailyCurses.map(id => {
        const h = (typeof HERO_ROSTER !== 'undefined') ? HERO_ROSTER.find(x => x.id === id) : null;
        return h ? h.name : id;
      });
      curseBanner = `<div class="tower-curse-banner">
        <div class="tcb-label">⚠ TODAY'S CURSE — UNTIL 4 AM TOMORROW</div>
        <div class="tcb-names">Locked: ${names.join(' · ')}</div>
      </div>`;
    }
  } catch (e) {}
  if (btn && current) {
    if (towerState.currentRunStarted) {
      btn.textContent = `▶ CONTINUE — FLOOR ${towerState.currentFloor}/${TOWER_DAILY_FLOORS}`;
      btn.onclick = continueTowerRun;
      btn.disabled = false;
      current.innerHTML = titleBanner + buffBanner + themeBanner + curseBanner + dailyStatus
        + `<div class="tower-run-active">Run in progress · floor ${towerState.currentFloor}/${TOWER_DAILY_FLOORS}</div>`
        + `<button class="tower-abandon-btn" onclick="abandonTowerRun()">⊘ ABANDON RUN</button>`;
    } else if (attemptsLeft <= 0) {
      btn.textContent = '🔒 DAILY CAP REACHED';
      btn.onclick = () => showToast('Reset at 4 AM');
      btn.disabled = true;
      current.innerHTML = titleBanner + buffBanner + themeBanner + curseBanner + dailyStatus
        + `<div class="tower-hint">Daily attempt cap reached. Come back at 4 AM for a fresh climb.</div>`;
    } else {
      const isFirstAttempt = (towerState.attemptsToday === 0);
      // 2026-04-27 — first daily attempt no longer free (now 250 gold);
      // label always shows cost.
      const costLabel = `${nextRetryCost}💰`;
      btn.textContent = `▲ DAILY GAUNTLET — ${costLabel}`;
      btn.onclick = startTowerRun;
      btn.disabled = false;
      // 2026-04-29 polish v0.1 Track E: replaced the dense one-line shorthand
      // (`10 floors · F5 mid-boss · F10 climax · 250💰 entry · earn 💰 ◈ ♥`)
      // with a bulleted "How it works" block. Casual mass-market players
      // could not parse the F5 / ◈ / ♥ jargon at a glance.
      const hint = isFirstAttempt
        ? `<div class="tower-howto">
             <div class="th-row">• 10 floors per run</div>
             <div class="th-row">• Mid-boss on floor 5, final boss on floor 10</div>
             <div class="th-row">• Costs ${nextRetryCost} gold to enter</div>
             <div class="th-row">• Full clear earns gold, sigil shards, and heart fragments</div>
           </div>`
        : `Retry attempt ${towerState.attemptsToday + 1}/${TOWER_MAX_ATTEMPTS_PER_DAY} · cost ${nextRetryCost} gold`;
      current.innerHTML = titleBanner + buffBanner + themeBanner + curseBanner + dailyStatus + `<div class="tower-hint">${hint}</div>`;
    }
  }
  // Auto-roll curses on first render if missing (handles upgrade path where
  // pre-T.3 saves don't have dailyCurses field; checkTowerDailyReset handles
  // ongoing rolls).
  if (towerState.dailyCursesKey !== towerState.dailyKey) {
    try {
      towerState.dailyCurses    = rollDailyCurses();
      towerState.dailyCursesKey = towerState.dailyKey;
      saveTowerState();
    } catch (e) {}
  }
  // History list (recent 5 weeks)
  const list = document.getElementById('towerHistoryList');
  if (list) {
    list.innerHTML = '';
    const history = (towerState.runHistory || []).slice(0, 5);
    if (history.length === 0) {
      list.innerHTML = '<div class="tower-history-empty">No past weeks yet</div>';
    } else {
      for (const h of history) {
        const row = document.createElement('div');
        row.className = 'tower-history-row';
        row.innerHTML = `<span>${h.weekStart}</span><span class="tower-history-floor">F${h.bestFloor}</span>`;
        list.appendChild(row);
      }
    }
  }
}

// ─── renderTowerModeBanner — in-battle Tower chip (legacy 29262-29280) ──────
export function renderTowerModeBanner() {
  if (typeof document === 'undefined') return;
  let chip = document.getElementById('phase5TowerModeBanner');
  const inTower = (typeof _isTowerBattle !== 'undefined' && _isTowerBattle);
  if (!chip) {
    if (!inTower) return;     // don't mount if not in Tower
    chip = document.createElement('div');
    chip.id = 'phase5TowerModeBanner';
    chip.style.cssText = 'position:fixed;top:8px;left:8px;background:linear-gradient(135deg,#1a1830,#0d1b2a);' +
                         'border:1px solid #78C8FF;color:#78C8FF;padding:4px 10px;border-radius:6px;' +
                         'font-size:10px;letter-spacing:0.12em;font-weight:700;pointer-events:none;' +
                         'z-index:8400;font-family:inherit;box-shadow:0 0 12px rgba(120,200,255,0.35);';
    document.body.appendChild(chip);
  }
  if (!inTower) { chip.style.display = 'none'; return; }
  const floor = (typeof currentFloorId === 'number') ? currentFloorId : '?';
  chip.textContent = '⛩ TOWER MODE · F' + floor;
  chip.style.display = 'block';
}

// ─── setupTowerEventListeners / cleanupTower — listener contract ────────────
export function setupTowerEventListeners() {
  // TODO(T1.12): attach 'click' listeners to:
  //   #towerEnterBtn → startTowerRun / continueTowerRun (state-dependent)
  //   #towerWeeklyBtn → startWeeklyTowerRun / continueWeeklyTowerRun
  //   #towerSeasonalBtn → startSeasonalTowerRun / continueSeasonalTowerRun
  //   delegated #towerHistoryList click → showTowerHistoryDetail
  //   .tower-abandon-btn → abandonTowerRun
  //   .tower-title-banner → openAchievementsModal
  //   #backFromTowerBtn → goToMenu
}

export function cleanupTower() {
  // TODO(T1.12): remove listeners attached in setupTowerEventListeners().
}
