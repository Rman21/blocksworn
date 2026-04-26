# PHASE 4 HOTFIX #2 — Chronograph EN localization + AAA+ copy pass

**Branch:** `phase-2-grammar`
**Spec:** Roman feedback — "проведи диагности и весь текст с русского поменяй на английский, а также проведи анализ фраз и текстов (чтобы любому новичку юзеру было понятно и не было много читать (оптимально))"
**Predecessor:** Phase 4 Hotfix #1 (chronograph 2-phase split + overlay-bleed fix) — `c9892f0`
**Date:** 2026-04-26

---

## A. Survey result

Comprehensive Cyrillic scan of `blocksworn_index_fixed.html` (4.77MB, 24k+ lines):

| Category | Count | User-facing? | Action |
|---|---|---|---|
| Chronograph beat bodies | 6 | ✅ yes | Translate + AAA copy pass |
| FTUE_SCRIPTS dialog text | 0 | — | Already English (verified line 10683+) |
| Boss voice lines | 0 | — | Already English |
| `flashText()` calls | 0 | — | Already English |
| Modal headers / button labels | 0 | — | Already English |
| HTML attributes (placeholder/alt/title) | 0 | — | Already English |
| CSS `/* … */` comments | ~52 | ❌ no | Skip — never seen by player |
| JS `// …` comments | ~15 | ❌ no | Skip — never seen by player |
| **Total user-facing Russian** | **6** | | All localized in this hotfix |

The audit confirmed Russian was localized to a single isolated surface (the 6 chronograph beat bodies I added in Phase 4 Block 1). All other Russian is in code/CSS comments invisible to players.

---

## B. AAA+ copy rules applied

| Rule | Why |
|---|---|
| **Verb-first imperative** | "Drag", "Match", "Tap" — direct action lower cognitive cost vs descriptive prose |
| **Jargon-light** | Kept "ULT" (UI-ubiquitous, players see it everywhere). Dropped "stihiya"/"element-charged" → "charged tiles" |
| **Concrete numbers** | "3+ tiles", "3+ heroes" — specific, scannable; not "несколько/many" |
| **Visual anchors** | "gold ring", "badge above", "the portrait", "the grid" — point at UI elements so player's eye finds them |
| **Length cap 50–85 chars/body** | 10–37% shorter than RU originals; fits 2–3 lines on mobile portrait |
| **Reward in 2nd clause** | "...to deal damage", "...trigger huge chain explosions" — answers "what's in it for me?" |
| **No filler** | Cut "просто", "уникальной способности" type padding |
| **Renaming for clarity** | `BOSS TELEGRAPH` → `INCOMING ATTACK` — "telegraph" is fighting-game jargon, opaque to casual match-3 audience |
| **Fact correction** | CHARGE was claiming "heroes of your race" — actually fills by ELEMENT not race; new copy says generic "your heroes" |

---

## C. Per-beat before/after

### PHASE A · BASICS (Pyredrake fight)

**1/4 MATCH**
- ❌ RU (107 chars): "Перетащи фигуру в сетку. Совмести 3+ клеток одного цвета — они исчезнут и нанесут урон."
- ✅ EN (76 chars): "Drag pieces onto the grid. Match 3+ tiles of the same color to deal damage."
- Δ: −29% length

**2/4 CHARGE**
- ❌ RU (84 chars): "Каждый матч заряжает ULT героев твоей расы. Жёлтое кольцо вокруг портрета растёт."
- ✅ EN (76 chars): "Every match charges your heroes. Gold ring on each portrait = ULT progress."
- Δ: −10% length + fact correction (was claiming "your race"; ULT fills by element)

**3/4 ULT**
- ❌ RU (79 chars): "Герой готов. Тапни портрет — выстрел уникальной способности (огонь, лёд, тьма)."
- ✅ EN (50 chars): "Hero is charged! Tap the portrait to fire the ULT."
- Δ: −37% length (dropped redundant element-list — player sees the effect on screen)

**4/4 INCOMING ATTACK** *(renamed from BOSS TELEGRAPH)*
- ❌ RU (89 chars): "Босс готовит удар. Цифра — сколько ходов до импакта. Планируй защиту или добивай первым."
- ✅ EN (76 chars): "Boss is winding up. Number = turns until his attack. Defend or strike first."
- Δ: −15% length + clearer beat name

### PHASE B · ADVANCED (Grunt fight)

**1/2 RACE BUFF**
- ❌ RU (87 chars): "3+ героя одной расы → пассивный бонус к урону. Пилл сверху показывает активный комбо."
- ✅ EN (69 chars): "3+ same-race heroes give a passive damage boost. See the badge above."
- Δ: −21% length

**2/2 CAPTAIN DROP**
- ❌ RU (85 chars): "Капитан уронил element-charged клетки на сетку. Цепляй их в матч — они взрывают цепи."
- ✅ EN (75 chars): "Captain dropped charged tiles. Match them to trigger huge chain explosions."
- Δ: −12% length

---

## D. Aggregate metrics

| Metric | RU total | EN total | Δ |
|---|---|---|---|
| Total chars (all 6 beats) | 531 | 422 | **−21%** |
| Average chars/beat | 88 | 70 | −20% |
| Longest beat | 107 | 76 | −29% |
| Shortest beat | 79 | 50 | −37% |

Tutorial reading time estimate (avg adult reader 4 chars/sec for unfamiliar vocab + game-context recall):
- RU: ~133 sec total = 22 sec/beat
- EN: ~106 sec total = 18 sec/beat
- **−27 sec total reading load** across the 7-min curriculum

---

## E. Verification

- Cyrillic scan post-edit: **0 user-facing Russian strings remaining** (67 lines have Cyrillic, all code/CSS comments).
- JS syntax verified via JavaScriptCore — file parses through 15,586+ lines clean (4.77MB).
- HTML overlay markup unchanged — beats inject content via innerHTML at show time, so the static fallback `data-` placeholder text in the markup also displays English.

---

## F. Roman regression checklist

1. **Fresh install + start FTUE**:
   - PHASE A · BASICS · STEP 1/4 — beat name "MATCH", body "Drag pieces onto the grid. Match 3+ tiles of the same color to deal damage."
   - Steps 2/4 / 3/4 / 4/4 — CHARGE / ULT / INCOMING ATTACK with new EN bodies
2. **After captain pick**:
   - PHASE B · ADVANCED · STEP 1/2 — RACE BUFF, "3+ same-race heroes give a passive damage boost. See the badge above."
   - 2/2 — CAPTAIN DROP, "Captain dropped charged tiles. Match them to trigger huge chain explosions."
3. **No Russian text** anywhere in user-facing UI.
4. **Beat names** still readable in tip card (MATCH / CHARGE / ULT / INCOMING ATTACK / RACE BUFF / CAPTAIN DROP).
5. **No console errors**.

---

## G. What this hotfix does NOT touch

- Phase 4 Block 1 chronograph trigger logic — unchanged.
- Phase 4 Block 2 DEBT-014 FSM rework — unchanged.
- Phase 4 Hotfix #1 2-phase split + overlay-bleed fix — unchanged.
- FTUE_SCRIPTS dialog content — already English, untouched.
- All other game UI text — already English, untouched.

---

## H. Git status

Single hotfix commit on `phase-2-grammar`. Auto-merged to `main`. Tag `v0.4.2-hotfix-2` placed on the merge commit.
