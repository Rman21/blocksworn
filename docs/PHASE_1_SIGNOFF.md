# Phase 1 Sign-off Checklist

Final smoke test before merge to `main`. Все пункты должны быть ✓.

**Date:** 2026-04-25
**Branch:** `phase-1-reduction`
**Final commit before sign-off:** check `git log --oneline | head -1`

---

## Fresh incognito test

### Splash + FTUE

- [ ] Splash logo (1.5s pause) → 3 intro cards sequential (CONTINUE button each)
- [ ] Splash card 0 copy says "**three** heroes" (not "five")
- [ ] FTUE narrator portrait + name = **THORGAR** (pirate_warrior)
- [ ] Pyredrake battle squad = 3 heroes (Thorgar / Emberhand / one other starter)
- [ ] Pyredrake defeated correctly, victory modal renders
- [ ] Tutorial Complete modal shows reward
- [ ] Post-Pyredrake reveal chain plays: BLACKTOOTH revealed → KEYCRYPT revealed
- [ ] Leader choice modal: **CRIMSON** (left) vs **NIGHTLORD** (right)
- [ ] Leader choice flow completes, advanceFtue('grunt_fight') fires

### Hub state post-FTUE

- [ ] Hub bottom nav: 4 tabs — `🏠 HOME` / `⚔ HEROES` / `🗼 TOWER` (locked badge) / `💎 SHOP`
- [ ] Burger drawer (☰): single `📅 DAILY` item only
- [ ] No `⚡` energy chip in hub topbar
- [ ] BATTLE button label: `▶ BATTLE` (no cost)
- [ ] Tower nav button shows: dimmed opacity 0.5 + `🔒` badge top-right
- [ ] Tap TOWER → toast `"Defeat CRYPT LICH first"`, no transition

### Heroes screen

- [ ] Tap `⚔ HEROES` → screen opens, transition clean
- [ ] Squad strip shows `0/3` or current squad count
- [ ] **Vertical scroll works** — visible all 15 cards (10 unlocked + 5 Clockwork locked)
- [ ] Clockwork cards (GEARSWORN / TICKTOCK / CHRONOS / PENDULUM / HOROLOGE) appear with `🔒 PHASE 2` badge
- [ ] Tap Clockwork card → toast `"This hero arrives in Phase 2"`, no detail modal
- [ ] Bottom nav stays sticky during scroll

### Dailies screen

- [ ] Burger → DAILY → screen opens
- [ ] **Vertical scroll works** — Login Streak + Weekly Missions + all Today's Missions visible
- [ ] Bottom nav stays sticky during scroll

### Shop screen

- [ ] Tap `💎 SHOP` → screen opens
- [ ] Single coming-soon message: "New offers coming soon — keep playing to unlock heroes through gameplay."
- [ ] No tabs (no OFFERS / CONVENIENCE / HEROES)
- [ ] Gold + Gems chips visible in topbar

### Visual unification

- [ ] Hub: dark warm radial bg, gold accents, orange CTA
- [ ] Heroes screen: dark Arena Premium (was bright blue Vivid pre-1.6)
- [ ] Tutorial Complete modal: dark + gold (was cream Vivid pre-1.6)
- [ ] Defeat modal: dark + gold (was purple Vivid pre-1.6)
- [ ] No bright blue / cream / Baloo-2 cartoon-chunky look anywhere

---

## Console verification

### Roster + squad

- [ ] `HERO_ROSTER.length === 15` → `true`
- [ ] `HERO_ROSTER.filter(h => h.locked === true).length === 5` → `true`
- [ ] `HERO_ROSTER.filter(h => h.race === 'pirate').length === 5` → `true`
- [ ] `HERO_ROSTER.filter(h => h.race === 'rock').length === 5` → `true`
- [ ] `HERO_ROSTER.filter(h => h.race === 'clockwork').length === 5` → `true`

### Squad / save state

- [ ] `window.__debugHeroes().squadMax === 3`
- [ ] `window.__debugHeroes().squad.length === 3`
- [ ] `localStorage.getItem('blocksworn_heroes_unlocked') !== null`
- [ ] `JSON.parse(localStorage.getItem('blocksworn_heroes_unlocked')).length >= 4` (4 starters seeded)

### Removed systems verification

- [ ] `typeof goToTower === 'function'` → `true`
- [ ] `typeof goToSeason === 'function'` → `true` (preserved per DEBT-010)
- [ ] `typeof PAID_PACKS === 'undefined'` → `true`
- [ ] `typeof canAffordBattle === 'undefined'` → `true`
- [ ] `typeof setEnergy === 'undefined'` → `true`
- [ ] `typeof goToArena === 'undefined'` → `true`
- [ ] `typeof openModifiersSheet === 'function'` → `true` (DEBT-001 stub, returns undefined)

### Chapter / gating

- [ ] `CHAPTERS.length === 1` → `true`
- [ ] `CHAPTERS[0].name === 'ASHEN DOMINION'` → `true`
- [ ] `BOSSES.length === 5` → `true`
- [ ] `isTowerUnlocked() === false` (fresh state)

### No console errors

- [ ] No red `Uncaught` errors during FTUE flow
- [ ] No red errors on Heroes / Dailies / Shop / Tower toast
- [ ] Console may show `[migrateSave]` / `[migrateSave-1.4]` info messages — ignore

---

## Manual unlock test (Tower gate bypass)

- [ ] DevTools → `localStorage.setItem('blocksworn_chapter_1_complete', 'true')` → reload
- [ ] Hub Tower nav button: lock badge gone, full opacity restored
- [ ] Tap TOWER → Tower screen opens (not toast)
- [ ] Tower screen renders: ALL TIME / THIS WEEK / 🗼 PTS stats, ENTER TOWER button, TOWER SHOP button
- [ ] Bottom nav on Tower screen: TOWER tab is `.active` (highlighted)
- [ ] Other 3 tabs (HOME/HEROES/SHOP) functional from Tower screen
- [ ] Back button (← top-left) returns to Hub

---

## Migration test (existing-save backward compat)

For users coming from pre-Phase-1 builds:

- [ ] DevTools → manually set `localStorage.setItem('blocksworn_heroes_unlocked', '["orc_warrior","elf_hunter"]')` + reload
- [ ] On reload: migrateSave-1.4 modal/toast fires showing refund message
- [ ] After migration: unlock list reset to starter heroes
- [ ] Old squad pruned of deprecated heroes

---

## Pre-merge final pass

After all above ✓, the following git/file invariants confirmed by Task #1.9 audit:

- [x] `HERO_ROSTER.length === 15`
- [x] `CHAPTERS.length === 1`
- [x] Bottom nav: 4 `data-nav="..."` buttons across all 6 nav instances
- [x] Drawer: 1 `a-btn-ghost` (DAILY)
- [x] Structural balance: braces 2954/2954, parens 7097/7097, brackets 1461/1461
- [x] 0 dangling onclick handlers
- [x] All 20 core gameplay functions present
- [x] File: 4,041,539 bytes (3.85 MB), 21,746 lines
- [x] Net delta from baseline: −67.6% bytes, −30.8% lines

---

## After sign-off

```bash
# On phase-1-reduction branch
git status                                # clean
git checkout main
git merge phase-1-reduction --no-ff
git tag -a v0.1.0-phase-1-done -m "Phase 1 — Reduction Surgery completed"
```

Phase 1 OFFICIALLY CLOSED after this checklist passes + merge + tag.
