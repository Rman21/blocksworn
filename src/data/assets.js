// 2026-05-11 — TASK-016 (T1.13.2): ASSETS registry extracted from legacy.
// 2026-05-11 — TASK-017 (T1.13.3): base64 data URIs replaced with /images/<key>.<ext>
//   paths. Binary files decoded from the legacy base64 (byte-perfect pixels) and
//   served from public/images/ by Vite. Closes AAA+ §3.2 bundle violation:
//   ~4.6MB of base64 strings dropped out of the JS bundle.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html lines 19722-19835
// Original declaration: `const ASSETS = { ... };` (89 keys; data URIs +
// path strings for icons, sprites, boss portraits, emblems, intro video).
//
// Pixel-byte-identical to legacy (base64 → binary is lossless). Frozen export
// plus a window bridge so legacy-style bare `ASSETS` reads from /* global */
// blocks continue to resolve until those consumers are flipped to
// `import { ASSETS }`.
//
// 2026-05-11 — Roman: bundle discipline. Pixels unchanged.
export const ASSETS = Object.freeze({
  // 2026-04-28 — Tutorial Dummy CHRONICLE (Player Education Stage 1).
  // Source: assets/Chronicle.png 1086×1448 → sips -Z 1024 -s format jpeg q85 → 200 KB.
  Boss_Chronicle: '/images/Boss_Chronicle.jpg',
  Boss_1: '/images/Boss_1.jpg',
  Boss_2: '/images/Boss_2.jpg',
  Boss_3: '/images/Boss_3.jpg',
  Boss_4: '/images/Boss_4.jpg',
  Boss_5: '/images/Boss_5.jpg',
  Boss_6: '/images/Boss_6.jpg',
  Boss_7: '/images/Boss_7.jpg',
  Boss_8: '/images/Boss_8.jpg',
  Boss_9: '/images/Boss_9.jpg',
  Boss_10: '/images/Boss_10.jpg',
  Logo: '/images/Logo.png',
  elem_ember: '/images/elem_ember.jpg',
  elem_tide: '/images/elem_tide.jpg',
  elem_grove: '/images/elem_grove.jpg',
  elem_solar: '/images/elem_solar.jpg',
  elem_umbra: '/images/elem_umbra.jpg',

  // V4.0 Phase 2 polish: AAA+ element emblems (96px JPEG q80) for splash + UI
  emblem_ember_v2: '/images/emblem_ember_v2.jpg',
  emblem_tide_v2: '/images/emblem_tide_v2.jpg',
  emblem_grove_v2: '/images/emblem_grove_v2.jpg',
  emblem_solar_v2: '/images/emblem_solar_v2.jpg',
  emblem_umbra_v2: '/images/emblem_umbra_v2.jpg',
  boss_emblem_1: '/images/boss_emblem_1.jpg',
  boss_emblem_2: '/images/boss_emblem_2.jpg',
  boss_emblem_3: '/images/boss_emblem_3.jpg',
  boss_emblem_4: '/images/boss_emblem_4.jpg',
  boss_emblem_5: '/images/boss_emblem_5.jpg',
  // ===== CHAPTER 2 ASSETS (V16) =====
  boss_emblem_6: '/images/boss_emblem_6.jpg',
  boss_emblem_7: '/images/boss_emblem_7.jpg',
  boss_emblem_8: '/images/boss_emblem_8.jpg',
  boss_emblem_9: '/images/boss_emblem_9.jpg',
  boss_emblem_10: '/images/boss_emblem_10.jpg',
  stihiya_emblem_ember: '/images/stihiya_emblem_ember.jpg',
  stihiya_emblem_tide: '/images/stihiya_emblem_tide.jpg',
  stihiya_emblem_grove: '/images/stihiya_emblem_grove.jpg',
  stihiya_emblem_solar: '/images/stihiya_emblem_solar.jpg',
  stihiya_emblem_umbra: '/images/stihiya_emblem_umbra.jpg',
  // ===== MODIFIER ICONS (V16) =====
  mod_bloodlust: '/images/mod_bloodlust.jpg',
  mod_doubletime: '/images/mod_doubletime.jpg',
  mod_fragile: '/images/mod_fragile.jpg',
  // ===== CHAPTER BADGES (V17) =====
  chapter_badge_1: '/images/chapter_badge_1.jpg',
  chapter_badge_2: '/images/chapter_badge_2.jpg',

  AppleTouchIcon: '/images/AppleTouchIcon.png',

  // V18.10: NEW RACES (20 heroes — pirates/skeletons/golems/lions)
  hero_pirate_sword: '/images/hero_pirate_sword.jpg',
  hero_pirate_gun: '/images/hero_pirate_gun.jpg',
  hero_pirate_bomb: '/images/hero_pirate_bomb.jpg',
  hero_pirate_tank: '/images/hero_pirate_tank.jpg',
  hero_pirate_captain: '/images/hero_pirate_captain.jpg',

  // V18.11: ROCK (Umbra)
  hero_rock_warrior: '/images/hero_rock_warrior.jpg',
  hero_rock_hunter: '/images/hero_rock_hunter.jpg',
  hero_rock_mage: '/images/hero_rock_mage.jpg',
  hero_rock_tank: '/images/hero_rock_tank.jpg',
  hero_rock_captain: '/images/hero_rock_captain.jpg',

  // Block B2: SHARKS (Frost/Tide) — 280px JPEG portraits matching pirate/rock pattern
  hero_shark_warrior: '/images/hero_shark_warrior.jpg',
  hero_shark_hunter: '/images/hero_shark_hunter.jpg',
  hero_shark_mage: '/images/hero_shark_mage.jpg',
  hero_shark_tank: '/images/hero_shark_tank.jpg',
  hero_shark_captain: '/images/hero_shark_captain.jpg',
  hero_crocodile_warrior: '/images/hero_crocodile_warrior.jpg',
  hero_crocodile_mage: '/images/hero_crocodile_mage.jpg',
  hero_crocodile_hunter: '/images/hero_crocodile_hunter.jpg',
  hero_crocodile_tank: '/images/hero_crocodile_tank.jpg',
  hero_crocodile_captain: '/images/hero_crocodile_captain.jpg',
  hero_spark_warrior: '/images/hero_spark_warrior.jpg',
  hero_spark_mage: '/images/hero_spark_mage.jpg',
  hero_spark_hunter: '/images/hero_spark_hunter.jpg',
  hero_spark_tank: '/images/hero_spark_tank.jpg',
  hero_spark_captain: '/images/hero_spark_captain.jpg',

  // V18.12: STIHIYA emblems for filter icons
  emblem_ember: '/images/emblem_ember.jpg',
  emblem_tide: '/images/emblem_tide.jpg',
  emblem_grove: '/images/emblem_grove.jpg',
  emblem_solar: '/images/emblem_solar.jpg',
  emblem_umbra: '/images/emblem_umbra.jpg',

  // V18.13: Chapter 3 bosses (Lvl 11-15) + chapter badge
  chapter_badge_3: '/images/chapter_badge_3.jpg',

  // V18.14: RACE emblems for filter icons (10 races)
  emblem_race_orc: '/images/emblem_race_orc.jpg',
  emblem_race_elf: '/images/emblem_race_elf.jpg',
  emblem_race_troll: '/images/emblem_race_troll.jpg',
  emblem_race_human: '/images/emblem_race_human.jpg',
  emblem_race_dark_elf: '/images/emblem_race_dark_elf.jpg',
  emblem_race_pirate: '/images/emblem_race_pirate.jpg',
  emblem_race_skeleton: '/images/emblem_race_skeleton.jpg',
  emblem_race_golem: '/images/emblem_race_golem.jpg',
  emblem_race_lion: '/images/emblem_race_lion.jpg',
  emblem_race_rock: '/images/emblem_race_rock.jpg',

  // V18.17: ROLE emblems for hero card badges + filter icons (5 roles)
  emblem_role_warrior: '/images/emblem_role_warrior.jpg',
  emblem_role_hunter: '/images/emblem_role_hunter.jpg',
  emblem_role_mage: '/images/emblem_role_mage.jpg',
  emblem_role_tank: '/images/emblem_role_tank.jpg',
  emblem_role_captain: '/images/emblem_role_captain.jpg',

});

// Window bridge — legacy-style bare reads (`/* global ASSETS */`) resolve here.
// T1.13.2 follow-ups will flip consumers to explicit imports.
if (typeof window !== 'undefined') {
  window.ASSETS = ASSETS;
}
