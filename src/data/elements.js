// 2026-05-11 — TASK-008 (T1.07): element (stihiya) constants relocated from legacy.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - STIHIYAS         line 20069
//   - STIHIYA_COLORS   line 20070
//
// STIHIYA_DESC lives inside an info-modal builder function (line 60026)
// and STIHIYA_ULT_BONUS at line 60268 also sits in a function scope, so
// neither is a top-level const — both deferred per T1.07 Step E. Flagged
// in TASK-008 "Замечено рядом" for T1.10 / future feel-layer extraction.

export const STIHIYAS = Object.freeze(['ember', 'tide', 'grove', 'solar', 'umbra']);

export const STIHIYA_COLORS = Object.freeze({
  ember: '#FF4D1F', tide: '#1FA3FF', grove: '#3DD66E', solar: '#FFD53D', umbra: '#8C3BFF',
});
