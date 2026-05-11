// 2026-05-11 — TASK-008 (T1.07): narrator script lines relocated from legacy.
//
// NARRATOR_LINES — SACRED per CLAUDE.md §2.3. Darkest Dungeon-style poetic
// voice; this is the game's narrative identity. Every character (punctuation
// included) is copied byte-perfect from
// docs/_legacy/_archive_v1/blocksworn_index_fixed.html lines 66393-66403.
//
// Helper speakNarrator() stays in legacy (DOM + dialog-defer integration);
// it'll be migrated in T1.09 (feel-layer extraction).

export const NARRATOR_LINES = Object.freeze({
  runStart:    ['The grid awaits. Place your first stone.'],
  firstClear:  ['A line falls. The ancients stir.'],
  bigCombo:    ['Cascading fate. Rare and precious.'],
  hpLost:      ['The grid remembers. And punishes.'],
  guardFire:   ['Steadfast, even as the walls crumble.'],
  strikerFire: ['Steel meets stone. The combo blooms.'],
  weaverFire:  ['Patience, at last, bears fruit.'],
  lowHP:       ['One heartbeat remains. Make it count.'],
  bossAppears: ['The earth shudders. Something ancient wakes.'],
});
