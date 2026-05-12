// 2026-05-11 — TASK-008 (T1.07): haptics table relocated from legacy.
//
// V_HAPTICS — SACRED per CLAUDE.md §2.2. A single byte change to any value
// here (tap:10, place:15, clear:25, hit:30, crit:[30,20,30], levelup:[20,30,40],
// rareDrop:[40,40,40], victory:[100,50,100,50,200], defeat:[200]) is a task
// RETURN. Pure relocation only — values copied byte-perfect from
// docs/_legacy/_archive_v1/blocksworn_index_fixed.html lines 66373-66388.
//
// The vHaptic(type) helper is colocated here per Execution Plan §13 T1.07.
// It's a thin wrapper around navigator.vibrate; no game logic. Not imported
// from anywhere yet — T1.10 will wire callers.

export const V_HAPTICS = Object.freeze({
  tap:       10,
  place:     15,
  clear:     25,
  hit:       30,
  crit:      [30, 20, 30],
  levelup:   [20, 30, 40],
  rareDrop:  [40, 40, 40],
  victory:   [100, 50, 100, 50, 200],
  defeat:    [200],
});

export function vHaptic(type) {
  const p = V_HAPTICS[type];
  if (p === undefined) return;
  if (navigator.vibrate) {
    try { navigator.vibrate(p); } catch (_e) { /* mobile haptics may throw on some browsers */ }
  }
}
