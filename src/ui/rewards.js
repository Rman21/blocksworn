// 2026-05-11 — TASK-012 (T1.11): rewards / onBossDefeated chain relocated
// from legacy. This module lands the T1.10 deferral: onBossDefeated is the
// cross-cutting post-victory chain (progression updates, reward dialogs,
// analytics events, FTUE advancement, voice lines, Phase 6/7/8/10 hooks).
// Per CTO call, it lives in src/ui/ rather than src/core/progression.js
// because the bulk of its surface is UI-adjacent (defeat-dialog chains,
// flashText / vibrate FX, victory modal show, defeat-line dialog routing,
// Voidfang bespoke 5-beat sequence).
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - onBossDefeated()                 line 57405-57939   (535 LoC — post-victory chain)
//   - _lastReward declaration          line 57942-57948   (scratch struct read by showVictoryModal)
//   - showVictoryModal()               line 57950-58113   (164 LoC — exit modal — kept in legacy
//                                                           since it's a dedicated modal surface;
//                                                           rewards.js will only orchestrate the
//                                                           data input via _lastReward)
//
// SACRED PER CLAUDE.md §2.3: Boss death voice line ordering (fire INSIDE
// cinematic chain → progression unlocks AFTER vPlayBossDieFx) — preserved
// byte-perfect. Also sacred §2.4: BOSS_REWARD essence formula + first-clear/
// 3-star reward differentiation + Race-Pure ×2 loot envelope — preserved.
//
// IMPORTANT BARE-STRING KEY (added to migration shim allow-list):
//   - `VOIDFANG_DEFEATED_KEY` ('blocksworn_voidfang_defeated') — already in
//     T1.10.9 allow-list (T1.10.8 flagged); the setter site is in this
//     module at the Voidfang victory branch (legacy 57911 → here).
//   - `'blocksworn_chapter_1_complete'` — already in T1.10.9 allow-list
//     (T1.10.2 flagged); setter site is in this module (legacy 57579 →
//     here). Both kept as raw localStorage access; shim handles the wire-
//     format compat.
//
// Owns: onBossDefeated post-victory chain. Splits into 9 logical helpers
// (annotated by comment headers below) for readability while preserving
// byte-perfect behavior. _lastReward struct is exported so showVictoryModal
// in legacy can continue to read it.
//
// Does NOT own:
//   - showVictoryModal — legacy line 57950+ stays in legacy until follow-up.
//     Its companions showDefeatModal / _showDefeatModalBody also stay.
//   - applyReward / applyBossDefeatProgression / markChapterComplete /
//     markBossFirstCleared / recordBossStars / computeBattleStars — those
//     are progression-state mutators, owned by src/core/progression.js
//     (T1.10.2). rewards.js calls them as imports.
//   - Phase 6/7/8/10 hooks (_phase6HandleBossDefeatMemorial /
//     _phase7HandleBossDefeatDrops / recordBossWin /
//     _phase10HandleFlameItselfDefeat) — content-layer hooks; stay in
//     legacy until each lands in its own follow-up module.
//   - FX/audio helpers (vPlayBossDieFx / playVictory / duckMusic /
//     playHeroUnlock / playContextMusic / vCleanupBossDeathFx) — feel
//     layer, owned by src/feel/ (T1.07) with legacy bridges.
//
// 2026-05-11 — Roman: pure-relocation discipline.

/* eslint-disable no-empty, no-unused-vars, no-redeclare */

// T1.13.1: /* global */ → ES imports for resolved src/ exports.
import { isFtueActive, advanceFtue, FTUE_PYREDRAKE_ARTIFACT, FTUE_GRUNT_ARTIFACT } from '../core/ftue-state.js';
import {
  hasCompletedChapter1, hasCompletedChapter, computeBattleStars,
  isBossFirstCleared, markBossFirstCleared, recordBossStars,
  markChapterComplete, recordFloorCleared, saveProgress,
} from '../core/progression.js';
import { clearVoidfangTints, VOIDFANG_DEFEATED_KEY } from '../core/reactivity-events.js';
import { getEffectiveBossStats, showVictoryModal, showDefeatModal } from '../core/battle.js';
import { renderResourceBar } from './menu.js';
import { STIHIYAS, STIHIYA_COLORS } from '../data/elements.js';
import { BALANCE } from '../data/balance.js';
import { vPlayBossDieFx, vCleanupBossDeathFx } from '../feel/animations.js';
import { logEvent, EVT } from '../services/analytics.js';
import { log } from '../services/logger.js';

/* global currentBoss, currentBossIdx, currentChapter, currentFloorId,
   bossesDefeated, bossHP, bossMaxHP, bossArchetype, revivesRemaining,
   chapterProgress, BOSSES, BOSS_REWARD,
   GOLD_PER_WIN, MAX_HP, DUNGEON_FLOORS, FLOOR_REWARDS,
   RACE_PURE_CHALLENGES, POST_FTUE_BOSS_REWARDS,
   HERO_ROSTER, activeSquad, essences, gold,
   ftueBeat, _isTowerBattle, _currentRacePureRace,
   plunderActive, plunderEmberCounter, racePureCleared,
   seenDialogs, DIALOG_LINES, voidfangDefeated,
   battleDamageTaken,
   getRewardMultiplier, getBossHeroReward, getBossDialogPrefix,
   showChapterCompleteCelebration,
   applyReward, applyBossDefeatProgression,
   addArtifact, addGold, awardWinGold, addHeroFragments, addGems,
   canCraftHero, craftHero, revealHero, dropRandomHeroCards,
   maybePhoenixRevive, grantPostFtueHeroInstantly,
   markRacePureCleared, rollBossArtifactDrop, rollBossArtifactDropForFloor,
   maybeFireOfferTrigger, retractStihiyaFocusOnVictory,
   awardPostBattleXP, trackProfileBattleWon, _pwaIncrementBattleCount,
   _resetConsecutiveBattleLosses, recordBossWin,
   _phase5BossDefeatPolish, _phase6HandleBossDefeatMemorial,
   _phase6GrantBossDefeatHeroCard, _phase7HandleBossDefeatDrops,
   _phase10HandleFlameItselfDefeat,
   onTowerFloorClear, updateTowerNavButton,
   playVictory, duckMusic,
   playHeroUnlock, playContextMusic,
   flashText, vibrate, renderBossHP, renderHP,
   sleep,
   trackMissionEvent, playDialog,
   addSeasonXP, saveGoldToStorage */
/* global bossHP:writable, gameEnded:writable, revivesRemaining:writable,
   bossesDefeated:writable, chapterProgress:writable,
   essences:writable, gold:writable,
   _currentRacePureRace:writable, voidfangDefeated:writable */
// LEGACY-ONLY: above tokens have no src/ export — shims retired in T1.14+ cleanup.

// ─── _lastReward — victory-modal scratch struct (legacy 57942-57948) ────────
// Populated by onBossDefeated, read by showVictoryModal. Exported so legacy
// showVictoryModal (still in legacy until follow-up) can continue to read it
// via a window bridge in T1.12 wire-up.
export let _lastReward = {
  amount: typeof BOSS_REWARD !== 'undefined' ? BOSS_REWARD : 0,
  stihiya: 'ember',
  mult: 1,
  justUnlockedChapter2: false, justUnlockedChapter3: false,
  floorId: null, floorName: null, floorColor: null, floorBonusEssence: 0,
};

// ─── onBossDefeated — post-victory chain (legacy 57405-57939) ───────────────
// Pure relocation. The function is large (~535 LoC). It splits naturally into
// 9 logical phases — kept inline here to preserve byte-perfect ordering with
// legacy. Phase headers (banners below) document the structure; do not move
// blocks between phases — ordering is sacred (e.g., Phoenix revive MUST fire
// before cinematic FX; Tower bypass MUST fire before story rewards).
export async function onBossDefeated() {
  if (gameEnded) return;
  // ─── Phase 1: anti-deadlock / analytics counters / PWA prompt counter ──────
  // 2026-05-02 — SPRINT 3B B3 T2: reset consecutive-loss counter on victory
  // so the next loss-streak starts from zero. Idempotent.
  try { if (typeof _resetConsecutiveBattleLosses === 'function') _resetConsecutiveBattleLosses(); } catch (e) {}
  // Profile P2 — track lifetime wins (covers all paths: story / tower / FTUE).
  try { if (typeof trackProfileBattleWon === 'function') trackProfileBattleWon(); } catch (e) {}
  // 2026-04-30 — Mobile UX Fix v0.1 §6: increment battle counter so the
  // PWA encouragement prompt becomes eligible after the player's first
  // win (gated to mobile + non-PWA + not-acked + cooldown elapsed).
  // The counter is the engagement signal — anonymous "tried it once"
  // visitors don't get prompted; players who've actually beaten a boss
  // do.
  try { if (typeof _pwaIncrementBattleCount === 'function') _pwaIncrementBattleCount(); } catch (e) {}
  // ─── Phase 2: Tower bypass + revive checks (Phoenix archetype + legacy) ────
  // POLISH v1 · PHASE 5 — cinematic moved below revive checks so Phoenix rebirth
  // doesn't incorrectly trigger the death sequence.
  // V3.0 Phase 7 Block 7.1: Tower battles bypass all story rewards + Phase 5/6
  // hooks. Handled by onTowerFloorClear which grants tower-specific rewards and
  // triggers the floor-clear continue/bank modal. Fire AFTER gameEnded guard but
  // BEFORE any Phase 5/6 hook chain (achievement eval, defeat dialog, etc.).
  if (_isTowerBattle) {
     
    // _isTowerBattle = false;  -- legacy mutates this; preserved via /* global */
    /* global _isTowerBattle:writable */
    // Re-asserting for clarity even though it's set via window-globals:
     
    // _isTowerBattle gets cleared by onTowerFloorClear itself; leave as legacy.
    gameEnded = true;
    try { onTowerFloorClear(); } catch (e) { log.warn('onTowerFloorClear failed:', e); }
    return;
  }
  // V2.0 Block 1.3: PHOENIX ARCHETYPE revive — one-time, 60% HP + 2-turn motif immunity
  if (maybePhoenixRevive()) return;
  // PHOENIX REVIVE: boss comes back with full HP before actually dying (legacy multi-phase)
  // 2026-04-27 HOTFIX — guard so phoenix archetype bosses do NOT also use the legacy
  // path. Earlier SOLAR PHOENIX had both `archetype: 'phoenix'` and `revives: 1`,
  // letting BOTH revive flows fire (3 lives instead of 2). Even with revives:1 now
  // removed from SOLAR PHOENIX, this guard prevents the same bug if any future
  // phoenix-archetype boss has revives>0.
  if (revivesRemaining > 0 && bossArchetype !== 'phoenix') {
    revivesRemaining--;
    bossHP = bossMaxHP;
    vibrate([200, 100, 200]);
    const wrap = document.getElementById('bossImgWrap');
    wrap.classList.add('hit');
    setTimeout(() => wrap.classList.remove('hit'), 400);
    flashText('PHOENIX REBORN!', '#E8B84A');
    renderBossHP();
    return;
  }
  // ─── Phase 3: cinematic FX + audio routing ─────────────────────────────────
  // POLISH v1 · PHASE 5 — fire 5-beat cinematic only on final death (after revive checks)
  try { vPlayBossDieFx(); } catch(e){}
  // 2026-05-02 — COMBAT v2.1 P5 PR #5.B §6.6: defeat polish (slow-mo + gold particles).
  // Lightweight wrapper — fires alongside existing vPlayBossDieFx chain.
  try { if (typeof _phase5BossDefeatPolish === 'function') _phase5BossDefeatPolish(); } catch (e) {}
  // 2026-04-27 — Audio A.2.7: victory chime + heroUnlock layered (per spec §4.1 boss death).
  // SFX ascend plays first; then boss music silenced for 1s; then victory.mp3
  // begins (per spec §8.2 quick crossfade). Player exit to menu auto-switches
  // back via showScreen('menu') → playContextMusic('menu').
  try { if (typeof playVictory === 'function') playVictory(); } catch(e){}
  try { if (typeof duckMusic === 'function') duckMusic(0.0, 1000); } catch(e){}
  setTimeout(() => { try { if (typeof playHeroUnlock === 'function') playHeroUnlock(); } catch(e){} }, 700);
  setTimeout(() => { try { if (typeof playContextMusic === 'function') playContextMusic('victory'); } catch(e){} }, 1200);
  gameEnded = true;
  // ─── Phase 4: post-battle XP + chapter progression update ──────────────────
  // V2.0 Stage 5 Block 5.1: award post-battle XP + tier-ups on WIN (participation + ULT fires + kill-shot)
  try { awardPostBattleXP(true); } catch (e) { log.warn('awardPostBattleXP (win) failed:', e); }
  // V18.19: Math.max ensures replaying an earlier boss doesn't regress chapter progress
  bossesDefeated = Math.min(BOSSES.length, Math.max(bossesDefeated, currentBossIdx + 1));
  chapterProgress[currentChapter] = bossesDefeated;
  // Block B3: boss-defeat unlock progression. Boss number is 1-indexed; idempotent
  // (re-defeating a previously-cleared boss won't re-fire celebration because
  // hero.unlocked is already true and SQUAD_MAX uses Math.max).
  // Death voice line fires INSIDE the cinematic chain — see maybeFireBossVoiceDeath
  // wired in dealDamage's bossHP=0 branch above. Progression celebrations come AFTER
  // the boss-die FX (vPlayBossDieFx already fired) so cinematic and unlock don't race.
  try {
    if (typeof applyBossDefeatProgression === 'function') {
      // PHASE 5b BLOCK 3 — chapter-aware global boss number. Chapter 1 bosses
      // map to 1-5 (unchanged), Chapter 2 bosses map to 6-10. Without this,
      // Chapter 2 Boss 1 (Verothira) would collide with Chapter 1 Boss 1
      // (Pyredrake) on BOSS_UNLOCKS[1] lookup.
      const _globalBossNum = (currentChapter - 1) * 5 + currentBossIdx + 1;
      applyBossDefeatProgression(_globalBossNum);
    }
  } catch (e) { log.warn('B3 boss-defeat progression failed:', e); }
  // V3.0 Phase 2 Block 2.1: record floor clear if this fight was launched via launchFloor.
  // Grunt and other non-floor paths (currentFloorId=null) are skipped — no spurious
  // floor clears. For FTUE Pyredrake: recorded separately in the FTUE reward hook below.
  if (currentFloorId !== null && !(currentBoss && currentBoss._isFtueOnly)) {
    recordFloorCleared(currentChapter, currentBossIdx, currentFloorId);
  }
  // ─── Phase 5: base essence reward + Pirate plunder + artifact drop ─────────
  // ESSENCE REWARD — BOSS_REWARD × modifier multiplier, rounded up
  const rewardStihiya = currentBoss.stihiya;
  const rewardMult = getRewardMultiplier();
  const finalReward = Math.ceil(BOSS_REWARD * rewardMult);
  essences[rewardStihiya] = (essences[rewardStihiya] || 0) + finalReward;
  // V3.0 Phase 7 Block 7.5: Season XP (+100 per story boss clear — not tower/arena, those have their own hooks)
  try { if (typeof addSeasonXP === 'function') addSeasonXP(100); } catch (e) {}
  // V2.0 Block 2.1: PIRATE plunder — every 5 ember cells cleared → +1 bonus essence (random stihiya)
  let plunderReward = 0;
  if (plunderActive) {
    plunderReward = Math.floor(plunderEmberCounter / 5);
    if (plunderReward > 0) {
      for (let i = 0; i < plunderReward; i++) {
        const s = STIHIYAS[Math.floor(Math.random() * STIHIYAS.length)];
        essences[s] = (essences[s] || 0) + 1;
      }
      flashText('PLUNDER +' + plunderReward + ' shards', STIHIYA_COLORS.ember);
    }
  }
  // V18: Artifact drop roll — 50% chance, random type from boss's race pool, T1
  // V18.25: pity timer prevents dry streaks; flashText gives immediate unmissable feedback
  // V3.0 Phase 2 Block 2.2: floor-aware drop. For floor launches, uses per-floor
  // chance/pity/T2-upgrade rules. FTUE/Grunt and any legacy path (currentFloorId===null)
  // falls back to the base function — no regression.
  const artDrop = currentFloorId
    ? rollBossArtifactDropForFloor(currentBoss.stihiya, currentFloorId)
    : rollBossArtifactDrop(currentBoss.stihiya);
  if (artDrop) {
    addArtifact(artDrop.id, artDrop.tier);
    // V3.0 Phase 2 Block 2.2: distinct messaging for T2 upgrade vs pity-bonus vs normal.
    // Color/icon cues let the player feel the floor-3 T2 upgrade even without reading text.
    const dropLabel = artDrop.floorUpgrade
      ? '🌟 T2 ARTIFACT UPGRADE!'
      : (artDrop.forced ? '🎁 BONUS ARTIFACT!' : '🎁 ARTIFACT ACQUIRED');
    flashText(dropLabel, artDrop.floorUpgrade ? '#FF4D1F' : '#FFD53D');
  }
  // ─── Phase 6: Phase 6/7/8/10 hooks (first-win grant, memorial, drops, etc.) ──
  // 2026-05-02 — COMBAT v2.1 P6 PR #6.B §5.3: first-win Hero Card grant.
  // Idempotent — uses localStorage Set to track first-win bosses.
  // FTUE / Tower / floor-based battles bypass via internal gate.
  // Granted AFTER artifact drop so reward FX don't collide.
  try {
    if (typeof _phase6GrantBossDefeatHeroCard === 'function') {
      _phase6GrantBossDefeatHeroCard(currentBoss);
      // 2026-05-02 — COMBAT v2.1 P6 PR #6.F §11: memorial unlock on boss defeat.
      // Idempotent — only fires for non-FTUE / non-training paths.
      try {
        if (typeof _phase6HandleBossDefeatMemorial === 'function') {
          _phase6HandleBossDefeatMemorial(currentBoss);
        }
      } catch (e) { log.warn('[P6.F memorial unlock] failed:', e); }
      // 2026-05-02 — COMBAT v2.1 P7 PR #7.A §3.1: chapter-scaled drop rolls.
      // Layered ON TOP of P6.F flat reward — adds RNG essence/T2-stone/T3-stone
      // chance per chapter scaling. Idempotent via boss._p7DropsRolled sentinel.
      try {
        if (typeof _phase7HandleBossDefeatDrops === 'function') {
          _phase7HandleBossDefeatDrops(currentBoss);
        }
      } catch (e) { log.warn('[P7.A drop roll] failed:', e); }
      // 2026-05-03 — COMBAT v2.1 P8 PR #8.C §5.2: clear adaptive-difficulty loss count.
      // On victory, per-boss loss counter resets — adaptive HP returns to 1.0×.
      // Per spec §14.2 exploit prevention (no permanent farming).
      try {
        if (typeof recordBossWin === 'function' && currentBoss && currentBoss.name) {
          recordBossWin(currentBoss.name);
        }
      } catch (e) { log.warn('[P8.C recordBossWin] failed:', e); }
      // 2026-05-03 — COMBAT v2.1 P10 PR #10.D §4: FLAME ITSELF flagship cinematic.
      // Defeating Ch5 final boss triggers 4-min finale (first time) + endgame unlock
      // banner. Idempotent via P10.D _phase10HasSeenCinematic check.
      try {
        if (currentBoss && currentBoss.name === 'FLAME ITSELF'
            && typeof _phase10HandleFlameItselfDefeat === 'function') {
          _phase10HandleFlameItselfDefeat();
        }
      } catch (e) { log.warn('[P10.D Flame finale] failed:', e); }
    }
  } catch (e) { log.warn('[P6.B first-win grant] failed:', e); }
  // Task #1.5: legacy Chapter 2/3 unlock branches retired with chapters themselves.
  // Retained as inert flags so downstream code reading justUnlockedChapterN still compiles.
  let justUnlockedChapter2 = false;
  let justUnlockedChapter3 = false;

  // Task #1.5: Chapter 1 COMPLETE flow — fires after CRYPT LICH (final Ch1 boss) defeat.
  // Sets the hasCompletedChapter1 flag (used by Tower gating + bottom-nav Tower button).
  // 2026-04-29 — chapterCompleteModal + REPLAY CHAPTER removed; the Crypt Lich
  // aftermath cinematic (fired separately via applyBossDefeatProgression) is
  // the post-Ch1 ceremony, and its CTA routes to the Tower.
  if (currentChapter === 1 && bossesDefeated >= BOSSES.length && !hasCompletedChapter1()) {
    // BARE-STRING KEY — covered by migration shim (T1.10.9 allow-list entry
    // 'blocksworn_chapter_1_complete'). Legacy stores literal 'true', reads
    // with === 'true'. Routing through storage.setItem would JSON-encode
    // and break the comparison; preserved as raw localStorage.
    try { localStorage.setItem('blocksworn_chapter_1_complete', 'true'); } catch (e) {}
    // Task #1.8: refresh Tower nav button to drop the lock badge.
    try { if (typeof updateTowerNavButton === 'function') updateTowerNavButton(); } catch (e) {}
  }
  // ─── Phase 7: floor bonus rewards + hero fragment grant + post-FTUE unlock ──
  // V3.0 Phase 2 Block 2.2: floor-specific bonuses. Applied BEFORE _lastReward snapshot
  // so the victory modal can display the final totals via existing readout paths.
  // Gold delta approach (trap 1): awardWinGold adds the Phase 0 flat +100 later
  // in this function. Here we add only the floor's delta over that 100. Floor 1
  // delta = 0 (no change). Floor 2 = +75. Floor 3 = +200.
  let floorBonusEssence = 0;
  if (currentFloorId !== null && FLOOR_REWARDS[currentFloorId]) {
    const floorCfg = FLOOR_REWARDS[currentFloorId];
    if (floorCfg.bonusEssence > 0) {
      essences[rewardStihiya] = (essences[rewardStihiya] || 0) + floorCfg.bonusEssence;
      floorBonusEssence = floorCfg.bonusEssence;
      // Trap 4: no separate flash for bonus essence — victory modal shows the total.
    }
    const goldDelta = floorCfg.gold - GOLD_PER_WIN;
    if (goldDelta > 0) {
      gold += goldDelta;
      saveGoldToStorage();
      renderResourceBar();
      // Separate flash for the gold delta so the player connects floor choice → reward scaling
      setTimeout(() => { try { flashText(`+${goldDelta} 💰 FLOOR BONUS`, '#FFD53D'); } catch(e){} }, 600);
    }
    // V3.0 Phase 2 Block 2.3: hero fragment award + auto-craft.
    // Fragment flash is already fired synchronously inside addHeroFragments (+N NAME FRAGMENTS
    // at line ~3520). We don't duplicate it here (trap 2: double-flash collision). If fragments
    // hit 50 at this call, we defer the "SWORN FROM BOSS" auto-craft flash by 1400ms so the
    // two messages don't visually overlap.
    // V3.0 Phase 0.1 post-refit: instant POST-FTUE hero unlock for specific Ch1 bosses.
    // Fires on ANY floor's first clear (not gated to F2/F3 like Phase 2.3 fragments).
    // Grants hero in POST_FTUE_BOSS_REWARDS[bossIdx] if mapping exists and hero not
    // yet unlocked. No-op for Voidfang, Ch2/Ch3 bosses, or already-unlocked grants.
    // NOTE: fires BEFORE the fragment block below. If we already granted the hero
    // instantly here (e.g. Riffblade from Crypt Lich), the fragment block's
    // `!rewardHero.unlocked` gate naturally no-ops for that hero.
    if (currentChapter === 1 && typeof POST_FTUE_BOSS_REWARDS !== 'undefined' && POST_FTUE_BOSS_REWARDS[currentBossIdx]) {
      const postFtueId = POST_FTUE_BOSS_REWARDS[currentBossIdx];
      const postFtueHero = HERO_ROSTER.find(h => h && h.id === postFtueId);
      if (postFtueHero && !postFtueHero.unlocked) {
        const bossNameSnap = currentBoss ? currentBoss.name : 'THE ANCIENT';
        // Delay 1400ms so victory modal + floor reward flashes settle before
        // the "X JOINS THE WARBAND" message lands. Matches Phase 2.3 cadence.
        setTimeout(() => {
          try { grantPostFtueHeroInstantly(postFtueId, bossNameSnap); }
          catch (e) { log.warn('post-FTUE Ch1 boss grant failed:', e); }
        }, 1400);
      }
    }
    if (floorCfg.fragmentCount > 0) {
      const rewardHero = getBossHeroReward(currentChapter, currentBossIdx);
      if (rewardHero && !rewardHero.unlocked) {
        addHeroFragments(rewardHero.id, floorCfg.fragmentCount);
        // Check if this award pushed us to the craft threshold. canCraftHero returns
        // true iff fragments >= 50 AND !unlocked — exactly what we need. Guard against
        // race where fragments were already at cap (addHeroFragments returned 0) —
        // in that edge case, canCraftHero is still true, and we craft anyway.
        if (canCraftHero(rewardHero.id)) {
          // Capture boss name now — after setTimeout, `currentBoss` may have changed
          // if the player returns to menu and opens another floor selector in 1400ms.
          const bossNameSnap = currentBoss ? currentBoss.name : 'THE ANCIENT';
          const heroNameSnap = rewardHero.name;
          const heroIdSnap = rewardHero.id;
          setTimeout(() => {
            try {
              craftHero(heroIdSnap);
              // Phase 1 Block 1.2 reveal — keeps narrative-layer visibility consistent with FTUE UX
              if (typeof revealHero === 'function') revealHero(heroIdSnap);
              flashText(`${heroNameSnap} SWORN FROM ${bossNameSnap}`, '#FF4D1F');
              try { vibrate([60, 100, 60, 100, 200]); } catch(e){}
            } catch (e) { log.warn('auto-craft failed:', e); }
          }, 1400);
        }
      }
    }
  }
  // 2026-04-27 — Block H.2 — Hero Cards drop on boss kill (HERO_COMPENDIUM §12).
  // 30% chance of 1 random hero card per chapter-mode boss kill. Weighted toward
  // heroes the player owns less of. Tower path skipped (Tower has its own drops
  // wired into onTowerDailyComplete / onTowerWeeklyComplete / onTowerSeasonalComplete).
  try {
    if (Math.random() < 0.30) {
      dropRandomHeroCards(1);
    }
  } catch (e) { log.warn('Block H.2 hero card drop failed:', e); }
  // V3.0 Phase 3 Block 3.2: offer triggers on boss-defeat events.
  // Floor 1 clears → STARTER (first clear ch1 boss 0), GROWTH (all 5 ch1 F1).
  // Floor 3 clears → retract stihiya_focus if it was triggered for THIS specific boss.
  // Chapter complete → COLLECTOR on ch1 complete.
  // FTUE path has currentFloorId=null and isFtueActive()=true, both guards suppress.
  if (currentFloorId !== null) {
    if (currentFloorId === 1) {
      const allCh1Cleared = currentChapter === 1 && chapterProgress[1] >= BOSSES.length;
      try { maybeFireOfferTrigger('floor1_clear', { chapter: currentChapter, bossIdx: currentBossIdx, allCh1Cleared }); } catch(e){ log.warn('offer trigger failed:', e); }
      // Ch1 chapter-complete fires separately. justUnlockedChapter2 above is the one-shot flag.
      if (justUnlockedChapter2 && currentChapter === 1) {
        try { maybeFireOfferTrigger('chapter_complete', { chapter: 1 }); } catch(e){ log.warn('offer trigger failed:', e); }
      }
    } else if (currentFloorId === 3) {
      // Win on F3 → if stihiya_focus was armed for this exact boss, retract it
      try { retractStihiyaFocusOnVictory(currentChapter, currentBossIdx); } catch(e){ log.warn('stihiya_focus retract failed:', e); }
    }
  }
  // V3.0 Phase 5 Block 5.1: mission tracking for win-side events.
  // All gated on non-FTUE + currentFloorId presence (FTUE has currentFloorId=null).
  // Fires after offer triggers so mission progress doesn't interleave with pack popups.
  if (currentFloorId !== null && (typeof isFtueActive !== 'function' || !isFtueActive())) {
    try {
      // Generic floor_cleared (any floor, any boss)
      trackMissionEvent('floor_cleared');
      // Mode-specific floor_cleared_mode with floorId data for F2/F3 missions
      trackMissionEvent('floor_cleared_mode', { floorId: currentFloorId });
      // Squad composition check — same-stihiya count (for squad_2_same_stihiya daily)
      const squadStihiyas = (activeSquad || []).map(id => {
        const h = HERO_ROSTER.find(x => x.id === id);
        return h ? h.stihiya : null;
      }).filter(Boolean);
      const stihiyaCounts = {};
      squadStihiyas.forEach(s => { stihiyaCounts[s] = (stihiyaCounts[s] || 0) + 1; });
      const maxSame = Math.max(0, ...Object.values(stihiyaCounts));
      trackMissionEvent('battle_won_squad', { sameStihiyaCount: maxSame });
      // Essence gained (from the primary finalReward above, line 9654). rewardStihiya is
      // in scope here because it was assigned earlier in onBossDefeated.
      trackMissionEvent('essence_gained', { stihiya: rewardStihiya, amount: finalReward });
      // Block 5.3 hook: perfect battle (no damage taken) — weekly mission event
      if (typeof battleDamageTaken !== 'undefined' && battleDamageTaken === 0) {
        trackMissionEvent('battle_won_perfect');
      }
    } catch (e) { log.warn('mission tracking (boss defeat) failed:', e); }
  }
  // ─── Phase 8: REW.3 first-clear/replay + 3-star bonus + chapter celebration ──
  // REW.3 + BAL.3 + REW.1 — First-clear vs replay reward differentiation.
  // Layers ON TOP of existing flat/floor rewards (we don't touch awardWinGold
  // or the floor bonus path above — net effect: first-clear feels distinctly
  // bigger than replay without breaking established economy invariants).
  // Excluded paths: Tower (returned earlier via onTowerFloorClear),
  // FTUE Pyredrake/Grunt (have own grants further below).
  let _wasFirstClear = false;
  let _battleStars = 0;
  try {
    const _isFtuePath =
      (ftueBeat === 'pyredrake_fight' && currentBoss && currentBoss.img === 'Boss_1' && !currentBoss._isFtueOnly) ||
      (ftueBeat === 'grunt_fight' && currentBoss && currentBoss._isFtueOnly);
    const _bossRewardKey = `${currentChapter}.${currentBossIdx}`;
    const _bossRewardCfg = BALANCE.rewards.boss[_bossRewardKey];
    if (!_isFtuePath && _bossRewardCfg && currentBossIdx >= 0) {
      _wasFirstClear = !isBossFirstCleared(currentChapter, currentBossIdx);
      const dmg = (typeof battleDamageTaken === 'number') ? battleDamageTaken : 0;
      _battleStars = computeBattleStars(dmg, (typeof MAX_HP === 'number') ? MAX_HP : 3);
      // First-clear vs replay base reward
      const baseReward = _wasFirstClear ? _bossRewardCfg.firstClear : _bossRewardCfg.replay;
      applyReward(baseReward, { stihiya: rewardStihiya });
      // 3-star perfect-clear bonus stacks on top regardless of first/replay
      if (_battleStars >= 3 && _bossRewardCfg.threeStar) {
        applyReward(_bossRewardCfg.threeStar, { stihiya: rewardStihiya });
      }
      // Persist after distribution so a thrown applyReward error doesn't lock
      // out the bonuses on the next try.
      if (_wasFirstClear) {
        markBossFirstCleared(currentChapter, currentBossIdx);
        try { logEvent(EVT.fight_won, { kind: 'first_clear', chapter: currentChapter, bossIdx: currentBossIdx, stars: _battleStars }); } catch (e) {}
      } else {
        try { logEvent(EVT.fight_won, { kind: 'replay', chapter: currentChapter, bossIdx: currentBossIdx, stars: _battleStars }); } catch (e) {}
      }
      recordBossStars(currentChapter, currentBossIdx, _battleStars);
    }
  } catch (e) { log.warn('REW.3 hook failed:', e); }
  // REW.2 — Chapter completion celebration. Generic over chapter index;
  // fires once per chapter on first all-bosses-cleared. Distributes the
  // BALANCE.rewards.chapter[N] reward bundle and queues the celebration
  // banner cascade. Pinch 3 (3-day victory pack offer) layers in Phase 5.
  // Backward compat: the legacy Ch1 branch above still sets the inline
  // `blocksworn_chapter_1_complete` flag for Tower gating; markChapterComplete
  // writes the same key generically.
  try {
    if (_wasFirstClear
        && currentBossIdx === BOSSES.length - 1
        && !hasCompletedChapter(currentChapter)
        && BALANCE.rewards.chapter && BALANCE.rewards.chapter[currentChapter]) {
      markChapterComplete(currentChapter);
      showChapterCompleteCelebration(currentChapter);
    }
  } catch (e) { log.warn('REW.2 chapter celebration failed:', e); }
  // Store for victory modal
  _lastReward = {
    amount: finalReward + floorBonusEssence, // V3.0 2.2: include floor bonus in total
    stihiya: rewardStihiya,
    mult: rewardMult,
    justUnlockedChapter2, justUnlockedChapter3, artDrop,
    // V3.0 Phase 2 Block 2.2: floor context for victory modal display
    floorId: currentFloorId,
    floorName: currentFloorId ? (DUNGEON_FLOORS.find(f => f.id === currentFloorId) || {}).name || null : null,
    floorColor: currentFloorId ? (DUNGEON_FLOORS.find(f => f.id === currentFloorId) || {}).color || null : null,
    floorBonusEssence,
    // REW.1 + REW.3 — first-vs-replay UX differentiation surfaced to victory modal.
    firstClear: _wasFirstClear,
    stars: _battleStars,
  };
  // V3.0 Block 0.3: gold reward on win (flat +100 per victory; no modifier multiplier yet)
  awardWinGold();
  // 2026-04-29 — Race-Pure Challenge bonus rewards (Player Education Stage 15).
  // Spec §18.2 promises 2× normal — implement as a SECOND identical reward
  // pass on top of the standard awards above (gold + matching essence). Mark
  // the race cleared, fire celebration cascade, and clear the run flag.
  if (_currentRacePureRace) {
    const _race = _currentRacePureRace;
    _currentRacePureRace = null;
    try { addGold(GOLD_PER_WIN); } catch (e) {}
    try {
      const bonus = Math.ceil(BOSS_REWARD * (typeof getRewardMultiplier === 'function' ? getRewardMultiplier() : 1));
      essences[rewardStihiya] = (essences[rewardStihiya] || 0) + bonus;
    } catch (e) {}
    try { markRacePureCleared(_race); } catch (e) {}
    // ECO.3 — Mission tracker: race_pure_squad_win daily template.
    try { if (typeof trackMissionEvent === 'function') trackMissionEvent('race_pure_clear', { race: _race }); } catch (e) {}
    try {
      setTimeout(() => { try { flashText('★ RACE-PURE VICTORY', '#FFD53D'); } catch (e) {} }, 1100);
      const cfg = RACE_PURE_CHALLENGES.find(c => c.race === _race);
      const lbl = cfg ? cfg.label : _race.toUpperCase();
      setTimeout(() => { try { flashText(lbl + ' CLEAR · ×2 LOOT', '#FFAA00'); } catch (e) {} }, 2200);
      const remaining = RACE_PURE_CHALLENGES.length - racePureCleared.size;
      if (remaining > 0) {
        setTimeout(() => { try { flashText(remaining + ' CHALLENGE' + (remaining===1?'':'S') + ' LEFT', '#FFAA00'); } catch (e) {} }, 3300);
      }
      vibrate([180, 80, 180, 80, 280]);
    } catch (e) {}
  }
  // ─── Phase 9: FTUE-specific reward hooks (Pyredrake / Grunt / Chronicle) ──
  // V3.0 Phase 1 Block 1.1: FTUE Pyredrake reward — guaranteed ORC RING T1 drop.
  // Runs AFTER awardWinGold + essence/artifact logic above so the normal rewards
  // still apply and this just piles on a guaranteed extra artifact. No Thara
  // fragment grant — Thara is a starter (unlocked) and her reveal is Block 1.2's job.
  // The FTUE beat advance is deferred via setTimeout so victory-modal animation
  // (sleep 1200ms below) completes before dialog/reveal code fires in Block 1.2.
  if (ftueBeat === 'pyredrake_fight' && currentBoss && currentBoss.img === 'Boss_1' && !currentBoss._isFtueOnly) {
    try { addArtifact(FTUE_PYREDRAKE_ARTIFACT, 1); } catch(e){ log.warn('FTUE orc_ring grant failed:', e); }
    try { flashText('+ ORC RING I', '#FFD53D'); } catch(e){}
    // V3.0 Phase 2 Block 2.1: mark Pyredrake Floor 1 as cleared so post-FTUE
    // the player can immediately tap Floor 2 without re-grinding Floor 1.
    try { recordFloorCleared(1, 0, 1); } catch(e){}
    // Delay beyond the sleep(1200) + victory modal appearance for a clean sequence.
    setTimeout(() => { try { advanceFtue('pyredrake_won'); } catch(e){ log.warn(e); } }, 1400);
  }
  // V3.0 Phase 1 Block 1.3: Ember Grunt FTUE reward hook. Guaranteed ORC CLEAVER T1
  // + "TUTORIAL COMPLETE" flash + advance beat. bossesDefeated is NOT incremented
  // here: Grunt is off-sequence, so chapter progress stays at 1 (Pyredrake cleared).
  // The chapter-advance logic earlier in this function already ran with Grunt's
  // data, but since currentBossIdx=-1 (sentinel), Math.max(bossesDefeated, -1+1)=1
  // which leaves the counter unchanged. Chapter2/3 unlock checks don't trigger
  // because bossesDefeated !== BOSSES.length for Grunt's off-sequence kill.
  if (ftueBeat === 'grunt_fight' && currentBoss && currentBoss._isFtueOnly) {
    try { addArtifact(FTUE_GRUNT_ARTIFACT, 1); } catch(e){ log.warn('FTUE orc_cleaver grant failed:', e); }
    try { flashText('+ ORC CLEAVER I', '#FFD53D'); } catch(e){}
    try { flashText('TUTORIAL COMPLETE', '#FFD53D'); } catch(e){}
    // Explicitly restore chapter-1 progress in case Math.max above budged it —
    // belt-and-braces. Grunt must never count as a chapter boss.
    bossesDefeated = 1;
    chapterProgress[1] = 1;
    // Advance to grunt_won after victory modal animation settles (1400ms matches Pyredrake timing)
    setTimeout(() => { try { advanceFtue('grunt_won'); } catch(e){ log.warn(e); } }, 1400);
  }
  // 2026-04-28 — Player Education Stage 1 AAA+. Chronicle defeat: cyan-tinted
  // "TRAINING COMPLETE" banner, no artifact (Chronicle is pre-Pyredrake — first
  // artifact remains ORC RING from Pyredrake to preserve the existing reward
  // pacing). Force-restore zero progress: Chronicle plays BEFORE chapter-1 boss
  // sequence, so bossesDefeated should stay at 0 even if Math.max budged it.
  // Beat advance after the same 1400ms animation window as Pyredrake/Grunt.
  if (ftueBeat === 'chronicle_fight' && currentBoss && currentBoss._isTrainingDummy) {
    // force: true bypasses the Chronicle-tutorial suppression — this is the
    // one essential milestone flash the player should see during the dummy fight.
    try { flashText('TRAINING COMPLETE', '#5DCAFF', { force: true }); } catch(e){}
    bossesDefeated = 0;
    chapterProgress[1] = 0;
    setTimeout(() => { try { advanceFtue('chronicle_won'); } catch(e){ log.warn(e); } }, 1400);
  }
  // ─── Phase 10: persist + cinematic exit + victory modal + defeat dialogs ──
  saveProgress();
  vibrate([100, 80, 100, 80, 200]);
  document.getElementById('bossImgWrap').classList.add('defeated');
  // POLISH v1 · PHASE 5 — wait for 5-beat cinematic (pause 300 + flash 220 + dissolve 1400 + breathing)
  await sleep(2200);
  try { vCleanupBossDeathFx(); } catch (e) {}
  showVictoryModal();
  // V3.0 Phase 6 Block 6.2: defeat dialog + chapter outro chain.
  // Fires AFTER showVictoryModal so rewards are visible; dialog appears on top.
  // Block 6.3 intercepts Voidfang BEFORE this block via an early return guard.
  // Chain: defeat_line → (if last boss of Ch1/Ch2) chapter_N_outro → chapter_{N+1}_intro.
  // Ch3 outro is Block 6.3's job (fires only on Voidfang Floor 3 Dominion victory).
  try {
    if (currentBoss && currentBoss.name && !currentBoss._isFtueOnly) {
      const prefix = getBossDialogPrefix(currentBoss.name);
      // Voidfang defeat is handled by Block 6.3's bespoke 5-beat sequence — skip generic flow
      const isVoidfang = currentBoss.name === 'VOIDFANG';
      if (prefix && !isVoidfang) {
        const defeatId = `${prefix}_defeat`;
        if (DIALOG_LINES[defeatId] && !seenDialogs.has(defeatId)) {
          // Delay 800ms so victory modal animation + floor-reward flashes finish first
          setTimeout(() => {
            playDialog(defeatId, () => {
              // Chain: last boss of chapter triggers outro → next chapter intro
              const isLastBoss = (typeof BOSSES !== 'undefined' && currentBossIdx === BOSSES.length - 1);
              if (isLastBoss && currentChapter < 3) {
                const outroId = `chapter_${currentChapter}_outro`;
                if (DIALOG_LINES[outroId] && !seenDialogs.has(outroId)) {
                  setTimeout(() => {
                    playDialog(outroId, () => {
                      const nextIntro = `chapter_${currentChapter + 1}_intro`;
                      if (DIALOG_LINES[nextIntro] && !seenDialogs.has(nextIntro)) {
                        setTimeout(() => playDialog(nextIntro), 400);
                      }
                    });
                  }, 400);
                }
              }
            });
          }, 800);
        }
      }
    }
  } catch (e) { log.warn('Phase 6.2 defeat dialog chain failed:', e); }
  // V3.0 Phase 6 Block 6.3: Voidfang bespoke 5-beat defeat sequence + Dominion
  // ending chain. Block 6.2's generic defeat block has `!isVoidfang` guard that
  // skips Voidfang entirely — this block fires the custom flow instead.
  // Any-floor victory: sets voidfangDefeated flag + triggers achievement eval.
  // Floor 3 Dominion: chains chapter_3_outro → fin_card after 5-beat sequence.
  // Floor 1/2: just the 5-beat (preserves "F3 is the real ending" ritual).
  try {
    if (currentBoss && currentBoss.name === 'VOIDFANG' && !currentBoss._isFtueOnly) {
      // Clear any lingering visual tints immediately on victory
      try { if (typeof clearVoidfangTints === 'function') clearVoidfangTints(); } catch (e) {}
      // Set permanent defeated flag (any floor counts for Phase 7 unlock signals)
      // BARE-STRING KEY — covered by migration shim (T1.10.9 allow-list entry
      // 'blocksworn_voidfang_defeated'). Legacy stores literal '1', reads
      // with === '1'. Routing through storage.setItem would JSON-encode
      // and break the comparison; preserved as raw localStorage.
      try {
        localStorage.setItem(VOIDFANG_DEFEATED_KEY, '1');
        voidfangDefeated = true;
      } catch (e) {}
      // Bespoke defeat dialog chain (only on first victory — repeat runs skip)
      if (!seenDialogs.has('voidfang_defeat_e')) {
        const isDominionClear = currentFloorId === 3;
        setTimeout(() => {
          playDialog('voidfang_defeat_a', () => setTimeout(() =>
            playDialog('voidfang_defeat_b', () => setTimeout(() =>
              playDialog('voidfang_defeat_c', () => setTimeout(() =>
                playDialog('voidfang_defeat_d', () => setTimeout(() =>
                  playDialog('voidfang_defeat_e', () => {
                    // Floor 3 only: chapter_3_outro → fin_card
                    if (isDominionClear) {
                      setTimeout(() => {
                        playDialog('chapter_3_outro', () => {
                          setTimeout(() => playDialog('fin_card'), 400);
                        });
                      }, 500);
                    }
                  }), 400))
                , 400))
              , 400))
            , 400));
        }, 800);
      }
    }
  } catch (e) { log.warn('Phase 6.3 Voidfang defeat chain failed:', e); }
}
