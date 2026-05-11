// 2026-05-11 — TASK-012 (T1.11): dailies screen relocated from legacy.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - goToDailies()                    line 26609-26623   (nav + refresh)
//   - renderDailiesScreen()            line 26625-26721   (streak strip + weekly + daily mission cards)
//   - handleClaimStreak()              line 26723-26726   (claim + re-render)
//
// Owns: daily-missions + weekly-missions + login-streak screen rendering.
// Card markup uses inline `onclick="claimMissionReward(...)"` attributes —
// preserved in T1.11 (legacy HTML stays untouched). T1.12 will rewire these
// via delegated addEventListener on the mission list container.
//
// Does NOT own:
//   - Mission state mutation (claimMissionReward / claimWeeklyMissionReward /
//     claimLoginStreakReward / trackMissionEvent / checkAndRefreshDaily/Weekly /
//     checkLoginStreak / loadDailyMissions / saveDailyMissions / loadLoginStreak /
//     saveLoginStreak) — that's progression state, lives in legacy until a
//     follow-up extraction into src/core/missions.js.
//   - LOGIN_STREAK_REWARDS table — data lives in legacy; will fold into
//     src/data/missions.js on follow-up.
//
// 2026-05-11 — Roman: pure-relocation discipline. The inline onclick handlers
// are preserved verbatim — they reference legacy globals (claimMissionReward /
// claimWeeklyMissionReward) which T1.12 will surface via setupListeners().

/* eslint-disable no-redeclare */

/* global document, loginStreakState, dailyMissionsState, weeklyMissionsState,
   LOGIN_STREAK_REWARDS, showToast,
   claimLoginStreakReward, checkAndRefreshDailyMissions,
   checkAndRefreshWeeklyMissions, checkLoginStreak, showScreen */

import { isFtueActive } from '../core/ftue-state.js';

// ─── goToDailies — nav entry (legacy 26609-26623) ───────────────────────────
export function goToDailies() {
  if (typeof isFtueActive === 'function' && isFtueActive()) { showToast('Finish the tutorial first'); return; }
  // Refresh data on open (cheap, idempotent)
  checkAndRefreshDailyMissions();
  if (typeof checkAndRefreshWeeklyMissions === 'function') checkAndRefreshWeeklyMissions();
  checkLoginStreak();
  if (typeof showScreen === 'function') {
    showScreen('dailies');
  } else {
    // Fallback: direct classList manipulation
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screenDailies').classList.add('active');
  }
  renderDailiesScreen();
}

// ─── renderDailiesScreen — streak + mission cards (legacy 26625-26721) ──────
export function renderDailiesScreen() {
  // Streak strip
  const cycleDay = loginStreakState.streakCount > 0
    ? ((loginStreakState.streakCount - 1) % 7) + 1
    : 1;
  const streakDayEl = document.getElementById('streakDay');
  if (streakDayEl) streakDayEl.textContent = loginStreakState.streakCount || 0;
  const stripEl = document.getElementById('streakStrip');
  if (stripEl) {
    stripEl.innerHTML = '';
    for (const r of LOGIN_STREAK_REWARDS) {
      const dayEl = document.createElement('div');
      dayEl.className = 'streak-day';
      if (r.day === cycleDay) dayEl.classList.add('current');
      if (r.day < cycleDay) dayEl.classList.add('passed');
      if (r.day === 7) dayEl.classList.add('jackpot');
      let rewardText = '';
      if (r.gold) rewardText += `💰${r.gold}`;
      if (r.gems) rewardText += `💎${r.gems}`;
      if (r.essencesRandom) rewardText += `🔮`;
      if (r.t2ArtifactRandom) rewardText += `🌟`;
      // 2026-04-27 — Block H.6 — Day 7 Hero Card icon (HERO_COMPENDIUM §11.2).
      if (r.heroCard) rewardText += `🃏`;
      dayEl.innerHTML = `
        <div class="streak-day-label">D${r.day}</div>
        <div class="streak-day-reward">${rewardText}</div>
      `;
      stripEl.appendChild(dayEl);
    }
  }
  const claimBtn = document.getElementById('claimStreakBtn');
  if (claimBtn) {
    claimBtn.disabled = loginStreakState.claimedToday;
    claimBtn.textContent = loginStreakState.claimedToday ? '✓ CLAIMED' : 'CLAIM TODAY';
  }
  // V3.0 Phase 5 Block 5.3: weekly missions list render (violet-themed vs gold daily).
  // Shares mission-card class with daily missions but adds .weekly-card for accent.
  const weeklyListEl = document.getElementById('weeklyMissionsList');
  if (weeklyListEl) {
    weeklyListEl.innerHTML = '';
    for (const m of (weeklyMissionsState.missions || [])) {
      const card = document.createElement('div');
      card.className = 'mission-card weekly-card';
      if (m.completed) card.classList.add('completed');
      if (m.claimed) card.classList.add('claimed');
      const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
      const rewardTxt = (() => {
        const parts = [];
        if (m.reward.gold) parts.push(`💰${m.reward.gold}`);
        if (m.reward.gems) parts.push(`💎${m.reward.gems}`);
        if (m.reward.t2ArtifactRandom) parts.push('🌟');
        return parts.join(' ');
      })();
      card.innerHTML = `
        <div class="mission-desc">${m.description}</div>
        <div class="mission-progress-bar"><div class="mission-progress-fill" style="width:${pct}%"></div></div>
        <div class="mission-meta">
          <span class="mission-progress-text">${m.progress}/${m.target}</span>
          <span class="mission-reward">${rewardTxt}</span>
        </div>
        ${m.completed && !m.claimed ? `<button class="mission-claim-btn" onclick="claimWeeklyMissionReward('${m.id}')">CLAIM</button>` : ''}
        ${m.claimed ? `<div class="mission-claimed-label">✓ CLAIMED</div>` : ''}
      `;
      weeklyListEl.appendChild(card);
    }
  }
  // Mission list
  const listEl = document.getElementById('missionsList');
  if (listEl) {
    listEl.innerHTML = '';
    for (const m of (dailyMissionsState.missions || [])) {
      const card = document.createElement('div');
      card.className = 'mission-card';
      if (m.completed) card.classList.add('completed');
      if (m.claimed) card.classList.add('claimed');
      const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
      const rewardTxt = (() => {
        const parts = [];
        if (m.reward.gold) parts.push(`💰${m.reward.gold}`);
        if (m.reward.gems) parts.push(`💎${m.reward.gems}`);
        if (m.reward.essences) parts.push('🔮');
        return parts.join(' ');
      })();
      card.innerHTML = `
        <div class="mission-desc">${m.description}</div>
        <div class="mission-progress-bar"><div class="mission-progress-fill" style="width:${pct}%"></div></div>
        <div class="mission-meta">
          <span class="mission-progress-text">${m.progress}/${m.target}</span>
          <span class="mission-reward">${rewardTxt}</span>
        </div>
        ${m.completed && !m.claimed ? `<button class="mission-claim-btn" onclick="claimMissionReward('${m.id}')">CLAIM</button>` : ''}
        ${m.claimed ? `<div class="mission-claimed-label">✓ CLAIMED</div>` : ''}
      `;
      listEl.appendChild(card);
    }
  }
}

// ─── handleClaimStreak — daily streak claim (legacy 26723-26726) ────────────
export function handleClaimStreak() {
  claimLoginStreakReward();
  renderDailiesScreen();
}

// ─── setupDailiesEventListeners / cleanupDailies — listener contract ────────
export function setupDailiesEventListeners() {
  // TODO(T1.12): attach 'click' listeners to:
  //   #claimStreakBtn → handleClaimStreak
  //   delegated #missionsList click → claimMissionReward(missionId)
  //   delegated #weeklyMissionsList click → claimWeeklyMissionReward(missionId)
  //   #backFromDailiesBtn → goToMenu (from router.js)
}

export function cleanupDailies() {
  // TODO(T1.12): remove listeners attached in setupDailiesEventListeners().
}
