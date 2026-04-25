# HOTFIX B3.1 — Diagnostic

**Branch:** `phase-2-grammar`
**Mode:** Hotfix — narrow patch, diagnose-then-fix.
**Source:** Roman playtest after B3 (`a6b5cea` on main).

Two regressions reported. Diagnostic confirms one is a B3 regression with a one-line fix; the other is a **legacy mechanic exposed by B3's starter-set change** and is **escalated to MGD per the task's escalation criteria** (not silently rewritten).

---

## BUG #1 — Voice dialog portrait shows broken-image icon

### Root cause (in B3 code)

[blocksworn_index_fixed.html:8881-8896](blocksworn_index_fixed.html:8881) — the `_bossVoiceTrigger(slot)` helper I added in B3 builds a script line WITHOUT a `portraitKey`:

```js
const script = [{
  speaker: currentBoss.name,
  speakerColor: currentBoss.color || '#FFD53D',
  text: lines[slot],
}];
try { playDialogScript(script, null); } catch (e) { /* ... */ }
```

The dialog renderer at [blocksworn_index_fixed.html:9612-9626](blocksworn_index_fixed.html:9612) reads:

```js
let src = '';
if (hero && ASSETS[hero.img]) {
  src = ASSETS[hero.img];
} else if (line.portraitKey && ASSETS[line.portraitKey]) {
  src = ASSETS[line.portraitKey];
}
portraitEl.src = src;   // <-- '' produces broken-image icon
```

For boss voice lines, `hero` is null (no `speakerId`) and `line.portraitKey` is undefined → `src = ''` → `<img src="">` → browser broken-image placeholder.

### Comparison: working pre-B3 boss dialogs

The legacy boss intro dialogs (e.g. `pyredrake_intro` at [blocksworn_index_fixed.html:11425](blocksworn_index_fixed.html:11425)) DO supply a portrait key:

```js
'pyredrake_intro': { speaker: 'PYREDRAKE', speakerColor: '#E85D4A',
                      portraitKey: 'Boss_1', text: "..." },
```

`ASSETS.Boss_1` is a base64 JPEG data URI at [blocksworn_index_fixed.html:8165](blocksworn_index_fixed.html:8165). All 5 bosses (Boss_1..Boss_5) have data-URI portraits in ASSETS.

### Proposed minimal fix

Add `portraitKey: currentBoss.img` to the voice script line. `currentBoss.img` is already `'Boss_1'`..`'Boss_5'` per the boss roster. Single-line addition.

### Why this was missed in B3

The B3 audit had a 12-step regression checklist for Roman, but the author cannot run the game in this environment. JavaScriptCore parses the script but cannot render the dialog DOM. Step 8 of the checklist (`Boss intro voices — 1.5s after each battle starts, the boss speaks`) would have caught this in browser playtest. Adding a parse-time check that boss voice scripts include `portraitKey` would prevent this category of bug going forward (filed as DEBT-023).

---

## BUG #2 — Hero A fires → heroes B/C/D charge meters drain

### Root cause (LEGACY, exposed by B3)

[blocksworn_index_fixed.html:20744](blocksworn_index_fixed.html:20744) — `onHeroCardClick`:

```js
ultCharges[hero.stihiya] = 0;
```

`ultCharges` is keyed by **stihiya (element)**, not by hero ID:

```js
let ultCharges = { ember: 0, tide: 0, grove: 0, solar: 0, umbra: 0 };
```

The charge meter UI in `renderDeck` ([blocksworn_index_fixed.html:20685-20687](blocksworn_index_fixed.html:20685)) displays per-hero, but reads from the shared per-stihiya counter:

```js
const charge = ultCharges[h.stihiya] || 0;
const max = currentUltThreshold[h.stihiya];
ultFill.style.width = Math.min(100, (charge / max) * 100) + '%';
```

So **all heroes of the same element share the same ULT charge bar**, and firing any one of them resets the bar — visually draining all hero cards of that element to 0.

This is the **legacy stihiya-sharing design** present since V2.0. It is not a B3 regression — `git blame` confirms the mutation site predates phase-2-grammar entirely.

### Why B3 exposed it

B3 changed `STARTER_HEROES` from a mixed-element starter set:

```
OLD: { pirate_warrior (ember), pirate_mage (ember),
       rock_warrior  (umbra), rock_mage  (umbra) }   — 2 elements
NEW: { pirate_warrior (ember), pirate_hunter (ember),
       pirate_captain (ember) }                       — 1 element (mono-ember)
```

With the old 2-element starter, firing a Pirate ULT drained only the 2 pirate card meters; the 2 rock cards retained their charges (different stihiya). The user could SEE individual hero progress.

With the new mono-ember starter, firing CRIMSON drains all 3 cards because they all share `ultCharges['ember']`. The user perceives this as "hero A firing drains B/C/D" — but it's the same mutation as before, now applied across an all-same-element starter trio.

### Why this is ESCALATION territory

Per the hotfix task explicit escalation criteria:

> ESCALATE if:
> - Either bug has root cause OUTSIDE B3 changes (means it's a pre-existing bug exposed by B3, requires MGD decision on scope)
> - Fix would require touching unrelated systems

Both apply:
1. Root cause is line 20744 in legacy `onHeroCardClick` — predates phase-2-grammar.
2. Fixing this means converting `ultCharges` from per-stihiya to per-hero, which would break:
   - All race synergies that compute per-stihiya bonuses (`passiveDmgMult[stihiya]`, `startCharges[stihiya]`, `ultThreshold[stihiya]`)
   - Encore stacks system (B1)
   - Frost chain segments (B2)
   - Captain dual buff race-mult (which contextualizes per-stihiya)
   - All boss-element matchup logic

This is the same architecture that was implemented in **archived/phase-4** (commit `b0796ac` "per-hero charge meters with inverse scaling fill rate") — a Phase-4-scale rewrite that was deliberately archived.

### MGD decision options for BUG #2

| Option | What | Cost | Aesthetic effect |
|---|---|---|---|
| **A — Revert STARTER_HEROES to mixed-element** | `STARTER_HEROES = { pirate_warrior, pirate_mage, rock_warrior, rock_mage }` (legacy 4-hero starter) + SQUAD_MAX starts at 4 | 1-line code change + audit update | Issue invisible. Legacy mechanic intact. Player sees per-stihiya charge sharing only after they intentionally build a mono-element squad — at which point it reads as a deliberate trade-off. |
| **B — Keep new STARTER_HEROES, document the mechanic** | No code change. Add an in-game UI hint: "Heroes of the same element share an ULT charge bar." Or add a tutorial toast on first mono-element squad. | UI hint pass | Issue visible but explained. Player learns the mechanic. May still feel bad. |
| **C — Implement per-hero charge meters** | Restore archived/phase-4 per-hero charge architecture. | ~Phase-4-scale rewrite | Issue gone. Architecture aligns with player expectation. Major surgery — new bugs likely; many derived systems need re-tuning. |
| **D — Hybrid: per-hero meter UI, per-stihiya pool internally** | Visual `hero-card` charge bar shows the hero's own contribution to the shared pool (not the pool itself). E.g. each hero gets credit for the placements they fired during. | Medium rewrite | Compromise — visual feels per-hero, mechanic stays per-stihiya. Risk of confusion if user inspects values via DevTools. |

Recommendation: **Option A** for v1. Cheapest, fully reversible, restores the mixed-element starter that hides the legacy mechanic. Reframes the issue as a starter-set design choice, not a charge-bar redesign.

### What this commit does NOT do

- Does NOT modify `onHeroCardClick` or `ultCharges` logic.
- Does NOT change STARTER_HEROES (awaiting MGD).
- Does NOT touch any per-hero state.

Only BUG #1 is fixed in this hotfix. BUG #2 is escalated; this doc is the artifact for MGD review.
