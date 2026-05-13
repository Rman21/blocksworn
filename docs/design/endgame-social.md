# Endgame Social — Phase 3 Master Design Spec

**Status:** DRAFT — awaiting Roman approval
**Author:** Game Designer (TASK-046 / T3.01)
**Date:** 2026-05-13
**Phase:** 3 (Endgame Social) — opening task
**Implementation status:** Not started — T3.02–T3.15 implement per this spec
**Mirrors:** `docs/design/mechanics/identity-layer.md` structure + rigor (T2.01)

---

## 0. Overview

Phase 3 ships the **competitive seasonal endgame** that closes the 100-hour
player fantasy locked in CLAUDE.md §1.3: solo Tower (already shipped, v2.1
P9), **Party Tower 2-5 (new — async coop)**, **Adventures 5-15 (new — async
clan)**, Replay/Share infrastructure, friend leaderboard, and seasonal
Tower rotation cadence. The thesis is simple: a player who has finished
chapters and unlocked Identity Layer Codex now has **three reasons to log
back in tomorrow** — a clan they belong to, a coop run mid-flight, and a
seasonal Tower leaderboard ticking down.

### How Phase 3 extends Phase 2

The Identity Layer (Phase 2) gave every fight a remembered shape. Phase 3
turns those remembered fights into **social currency**:

- **Codex Moments tab** (§4.5 identity-layer.md) ships its Phase 2 stretch
  goal — every recorded moment now has a Replay button that surfaces a
  5-second loop the player can share.
- **Race × boss matchup data** (Identity Layer's 5×5+ matrix) drives the
  Adventures **Boss-of-the-Week** rotation — the boss whose matchup most
  rewards collective clan exploration gets featured.
- **Cross-race synergies** observed in Phase 2 (Shark's `_lastBittenCells`
  feeding Pirate Plunder gold; Spark Sun Cascade promoting crits for
  mixed squads) layer naturally into Party Tower coop boards where each
  player's turn brings their squad's identity to the shared grid.

### What 100-hour player has

| Surface | Source | Phase 3 contribution |
|---------|--------|----------------------|
| Solo Tower | v2.1 P9 (sacred) | unchanged; seasons added (§6) |
| Tower Pacts + Mythic Pacts | v2.1 P9 (sacred) | unchanged; seasonal rotation metadata (§6.2) |
| PURE PATH F2P leaderboard | v2.1 P9 (sacred) | unchanged; honored by Adventures/Party (§8) |
| Uroboros seasonal mythic boss | v2.1 P9 (sacred) | unchanged; new seasons cycle around it (§6.1) |
| Identity Layer + Codex | Phase 2 | extended: Codex Moments tab gains Replay button (§4.5) |
| **Adventures 5-15 async clan** | **Phase 3 new** | T3.02–T3.05 (§2) |
| **Party Tower 2-5 async coop** | **Phase 3 new** | T3.10–T3.13 (§3) |
| **Replay/Share infrastructure** | **Phase 3 new** | T3.07–T3.09 (§4) |
| **Friend leaderboard widget** | **Phase 3 new** | T3.06 (§5) |
| **Tower seasonal rotation** | **Phase 3 new** | T3.14–T3.15 (§6) |

Design goal in CLAUDE.md §1.3 phrase: **competitive seasonal endgame with
async social mechanics**. Phase 3 is how the player's solo mastery turns
into a shared journey — without anyone needing to be online at the same
time, ever.

---

## 1. Architectural fit (hard rules)

| Layer | Granularity | Surface | Source of truth | Touch frequency |
|-------|-------------|---------|-----------------|-----------------|
| **Solo Tower** (v2.1 P9 — sacred) | per-run | existing tower screen | `src/data/tower.js`, `src/ui/tower.js` | every Tower attempt |
| **Identity Layer** (Phase 2 — additive) | per-line-clear | battle screen | `src/feel/identity-fx.js`, `src/data/identity-layer.js` | 10–40× per battle |
| **Adventures** (Phase 3 — new) | per-clan, per-week | new clan screen | `src/ui/adventures.js`, `src/services/clan-backend.js` | 1–7× per week per player |
| **Party Tower** (Phase 3 — new) | per-party, per-turn | new party screen | `src/ui/party-tower.js`, `src/services/clan-backend.js` (reuses) | hours-to-days between turns |
| **Replay/Share** (Phase 3 — new) | per-moment | embedded in Codex + share UI | `src/services/replay-backend.js`, `src/ui/replay-viewer.js` | 1–5× per battle ambient |
| **Friend Leaderboard** (Phase 3 — new) | per-friend, per-season | menu widget | `src/ui/friend-leaderboard.js`, `src/services/clan-backend.js` (reuses) | every menu visit |
| **Tower Seasons** (Phase 3 — new) | per-season, weekly | seasonal banner on tower screen | `src/data/season-config.js` | 1× per season ramp |

### Hard rules

1. **Phase 3 extends, never modifies, v2.1 P9 or Phase 2.** Solo Tower,
   PURE PATH, TOWER_PACTS, TOWER_PACTS_MYTHIC, TOWER_LEADERBOARDS, Uroboros
   spec stay byte-perfect. Identity Layer 5 race FX + 7 boss-reactive
   mechanics stay byte-perfect. New code adds new files in `src/`, exposes
   new surfaces, and **never** edits sacred values.
2. **No sacred-cow numeric changes.** Tower retry gem ladder `[100, 200,
   400]`, 3-min Tower TTK target, GEM_PACKS price ladder, First Purchase
   Bonus, Battle Pass tier formula `xp = 500 + tier × 150`, MAX_HP = 100,
   TIER_COSTS_V18 — all unchanged. Adventures/Party Tower **read** these,
   never write.
3. **ADR-002 async-only.** Party Tower uses turn-based asynchronous
   architecture (Firestore-stored party state + per-turn notification),
   NOT WebRTC. No matchmaking servers, no real-time sync. Turns may take
   minutes, hours, or days. Reference: Marvel Snap async PvP, Words With
   Friends turn-based.
4. **ADR-003 no-P2W.** Phase 3 must NOT introduce any mechanical advantage
   for paid tiers. Whale clans, Whale party seats, Whale replay storage
   are cosmetic/social-prestige tier ONLY. Tested via PURE PATH F2P
   leaderboard parity audit (§8.3): F2P Adventures + Party Tower
   participation must not statistically lag paid-tier participation by
   more than a few % on completion rates.
5. **ADR-004 src/ only.** All new Phase 3 code lives in `src/`. Legacy
   stays primary runtime; Phase 3 features integrate via window-bridge
   (same pattern as T2.B Identity Layer integration moment) OR render in
   `src/ui/` screens the new shell already routes to (same pattern as
   T2.12 Codex).
6. **Layered, never replacement.** Party Tower runs a clone of solo Tower
   board state but with shared Tower-Hearts pool, shared TOWER_PACTS
   selection, and turn-rotation. Adventures runs alongside solo Tower —
   nothing solo-Tower-related is removed.

### Scope: 4 new screens + 2 backend services + 1 data module

Per Execution Plan §8.2 the 5 Phase 3 deliverables map to:

- Adventures → `src/ui/adventures.js` + `src/services/clan-backend.js`
- Party Tower → `src/ui/party-tower.js` (reuses clan-backend)
- Replay/Share → `src/ui/replay-viewer.js` + `src/services/replay-backend.js`
- Friend leaderboard → `src/ui/friend-leaderboard.js` (reuses clan-backend)
- Tower endless/seasons → `src/data/season-config.js` (data + cron logic)

Tower endless mode (Execution Plan §8.2 bullet 5 — "Tower endless после
floor 50") is folded into §6 seasonal infrastructure: endless is what
happens after the player exhausts the seasonal floor manifest.

---

## 2. Adventures (T3.02–T3.05) — async clan 5–15 players

> Execution Plan §8.4 ruling: word is **"Adventure"**, not "Guild".
> Async clan with weekly target + boss-of-the-week + member contributions.
> No chat (or emoji-only), no moderators, no real-time activity feed.

### 2.1 Clan creation + join flow (T3.02)

**Two paths to a clan, single screen:**

```
┌─────────────────────────────────┐
│  ← ADVENTURES                   │
├─────────────────────────────────┤
│  [ no Adventure yet ]           │
│                                 │
│   ┌─────────────────────────┐   │
│   │  + START AN ADVENTURE   │   │
│   └─────────────────────────┘   │
│   ┌─────────────────────────┐   │
│   │  ✓ JOIN BY CODE         │   │
│   └─────────────────────────┘   │
│   ┌─────────────────────────┐   │
│   │  🔥 BROWSE PUBLIC (5)   │   │
│   └─────────────────────────┘   │
│                                 │
│   "An Adventure travels best    │
│    with 5 to 15 souls."         │
└─────────────────────────────────┘
```

**Field-level spec:**

1. **Adventure name:** 3–24 chars, no profanity (client-side BAD_WORDS
   list — re-use shop's purchase-name validator). Unique within active
   adventures; collision → suggest `<name>-2`, `<name>-3`.
2. **Capacity:** hard-cap 5–15 members. The cap is a design invariant
   per Execution Plan §8.4 — see Open Question Q1 about whether
   whale-tier clans can exceed.
3. **Privacy:** public (browsable + searchable) OR private (invite-only
   via 6-char alphanumeric code, e.g. `K7QM3X`). Default private.
4. **Founder role:** the creator is "Captain" — purely cosmetic title;
   no admin powers (no kicks, no moderation, no role assignment). This
   keeps the surface drama-free per Execution Plan §8.4 ruling.
5. **Friend Code:** 6-char code generated server-side, sharable via
   navigator.share API or in-app copy button. Shareable URL form:
   `https://blocksworm.com/?adv=K7QM3X` opens game + auto-prompts
   join confirmation.

**Backend (`src/services/clan-backend.js`):**

- Firestore collection: `adventures/{advId}` document with `{ name,
  privacy, code, founderUid, memberUids[], createdAt, weeklyBossId,
  weeklyBossHp, weeklyTargetClears, weeklyClears, lastResetAt }`.
- Member sub-collection: `adventures/{advId}/members/{uid}` document
  with `{ uid, displayName, joinedAt, weeklyContribution, allTimeContrib,
  cosmetic_flair }`.
- Security: Firestore rules enforce only members can read; only
  founder can mutate `name`/`privacy`/`code`; any member can write
  their own contribution counter.

**Performance budget:**
- Create-flow Firestore round-trip ≤500ms p99.
- Browse-public list ≤300ms FCP (pre-cached top 20 public adventures
  in Firestore index, refreshed every 5 min).
- Join-by-code lookup ≤200ms p99 (indexed by `code`).

---

### 2.2 Weekly target — Boss-of-the-Week (T3.03)

**Concept:** every Monday 00:00 UTC, all active Adventures receive a
shared **Boss-of-the-Week**. Members fight the boss in their own private
solo runs (NOT in shared Party Tower — that's a separate surface §3).
Damage dealt is contributed to the Adventure's collective HP bar.

**Selection algorithm:**

```
const matchupEntropy = identityMatchupEntropy(weekNumber);
// Adventure weekly boss = chapter-finale archetype whose Identity
// Layer matchup matrix has the highest expected entropy this week.
// Phase 2 race × boss matchup data (5 × 5 + Uroboros) gives us a
// rotation of ~6 candidates. Cycle deterministic by week number.
```

Specifically the rotation:
- Week 1: **PYREDRAKE** (berserker → Bloodtide Pulse) — favors mixed
  squads, no race dominance.
- Week 2: **GROVEWARDEN** (bruiser → Root Surge) — favors grove
  squads (Troll/Golem/Crocodile), rewards Bedrock Bastion.
- Week 3: **SOLAR PHOENIX** (phoenix → Ashen Reign) — favors ember
  squads (Pirate/Orc), rewards Sun Cascade by extension.
- Week 4: **CRYPT LICH** (assassin → Cursed Tiles) — favors mixed,
  anti-shark stacking — rewards diversification.
- Week 5: **GEARHEART** (engineer → Lockdown Protocol) — favors
  precise non-Tetris play, rewards Feeding Frenzy and Pirate Plunder.
- Week 6: **VOIDFANG** (tower_voidfang → Shroud Pull) — favors
  umbra-light squads, rewards Encore Echo.
- Repeats from Week 1.

(Uroboros seasonal mythic intentionally NOT on this list — Uroboros is
the **Tower seasonal boss**, not the **Adventure weekly boss**. Keep
Uroboros reserved for Tower endgame, per CLAUDE.md §2.5.)

**Field-level spec:**

1. **Weekly HP pool:** scales with active member count.
   `weeklyBossHp = baseBossHp × min(memberCount, 15) × 0.8`. For a
   15-member maxed adventure: 12× single-player TTK. Designed so a
   full-active 15-clan can defeat with each member averaging ~8/10
   completed solo runs over the week.
2. **Per-clear contribution:** when a member defeats the weekly boss
   in a solo run, their effective damage is `bossHp - leftoverHp` (the
   damage they would have dealt if HP scaled linearly). The
   Adventure's `weeklyBossHp` decrements by this amount.
3. **Caps:** per-member weekly contribution cap = `2 × baseBossHp`
   (cap stops one player from soloing the weekly target for a
   15-member clan — preserves social contribution incentive).
4. **Reward distribution:** if `weeklyBossHp <= 0` by Sunday 23:59 UTC,
   every contributing member receives:
   - +1 Tower Hearts (sacred currency from `HEART_UPGRADES`)
   - +200 gold per 10% contribution
   - +50 essence per 10% contribution
   - +1 Adventure XP per 10% contribution (used in §2.4 clan progression)
   - Codex Adventure-defeat record (new Codex Moments entry)
5. **Failure case:** if `weeklyBossHp > 0` at week reset, members get
   no reward but their solo Tower progress is unaffected. NO penalty
   — async social pressure is intentional design (per Execution Plan
   §8.4 "мягкое social pressure без токсичности").

**Visual layout (mobile 380px):**

```
┌─────────────────────────────────┐
│ ← ADVENTURE: Brass Sparrows    │
├─────────────────────────────────┤
│  THIS WEEK                      │
│  ┌─[boss]─────────────────┐     │
│  │  PYREDRAKE             │     │
│  │  berserker · ember     │     │
│  │  Reactivity Events     │     │
│  │  ⌒ Bloodtide Pulse     │     │
│  └────────────────────────┘     │
│                                 │
│  [▓▓▓▓▓▓░░░░░░░░░] 41%          │
│  weeklyHp 12,400 / 21,000       │
│                                 │
│  Resets in 4d 7h                │
├─────────────────────────────────┤
│  ▸ THIS WEEK'S CONTRIBUTORS     │
│   Roma (cap)  ████████  18%     │
│   Kira       ████        9%    │
│   Sebastien  ██          4%    │
│   ...                           │
│  ▸ JOIN WEEKLY HUNT  [BATTLE]   │
└─────────────────────────────────┘
```

**Sacred cow safety:**
- Does NOT modify `BOSS_TTK_TARGETS`. Adventure weekly HP is a NEW
  multiplier ON TOP of single-player boss HP. Single-player runs see
  the same TTK as always.
- Does NOT modify `FTUE_BOSS_GUARANTEES`. New players don't see
  Adventures surface until post-FTUE.
- Does NOT modify Tower retry ladder. Adventure runs use the same
  Tower retry mechanic if the player chooses Tower mode for the
  weekly hunt.

**Performance:**
- Weekly progress sync ≤500ms p99 (one Firestore write per defeat).
- HP-bar render ≤80ms FCP.
- Per-clear contribution recomputed client-side, validated server-side
  via Cloud Function to prevent client-side inflation.

---

### 2.3 Contributor stats + retention tracking (T3.04)

**Per-member visible stats:**

| Stat | Source | Update cadence |
|------|--------|----------------|
| `weeklyContribution` | this-week damage to weekly boss | per defeat |
| `allTimeContrib` | lifetime damage to all Adventure weekly bosses | per defeat |
| `weeklyClears` | this-week solo runs counted for clan | per defeat |
| `joinedAt` | clan join timestamp | once |
| `cosmetic_flair` | Codex-derived (e.g. "Pirate Captain", "Phoenix Master") | recomputed on Codex update |
| `lastSeen` | last write timestamp | per writeable interaction |

**Retention tracking (server-side, NOT shown to players):**

| Metric | Use |
|--------|-----|
| `joinRetention_D7` | % of members still in clan 7d after joining |
| `joinRetention_D30` | % of members still in clan 30d after joining |
| `contribFrequencyD7` | average runs-per-week per active member |
| `adventureCompletionRate` | % of weeks the clan defeated the boss |

These feed Phase 4 / live-ops decisions but are **not** exposed to the
player. Adventures must never expose "Sebastien hasn't played in 6 days"
— social pressure is implicit (the contribution bar speaks for itself)
not explicit (no shaming UI).

**Privacy + safety:**
- All member-visible data is opt-in via signup. Clan join consent
  includes "your weekly contribution and run count will be visible to
  your clan."
- No PII surfaced: display name only, no email/phone/full name.
- Leave-clan flow: 1 tap, immediate, no confirmation needed beyond a
  "Leave Brass Sparrows?" modal.

**Performance:**
- Member-list render ≤200ms p99 (cached for 60s, invalidated on member
  defeat or leave).
- All-time stats render ≤100ms (read from member doc, no aggregation
  needed beyond what's already stored).

---

### 2.4 Persistent clan progression (T3.05)

**Clan-level (separate from per-member progression):**

- `clanLevel` advances when clan accumulates `clanXp`. Formula:
  `clanXpToNext(level) = 1000 + level × 250` (separate formula from
  Battle Pass — non-sacred, NEW addition).
- `clanXp` accumulates by:
  - +500 per successful weekly defeat
  - +50 per defeat where every member contributed at least once (full
    participation bonus)
  - +100 per "PURE PATH adventure" (all clan members F2P this week —
    honors PURE PATH sacred § 2.5)

**Clan unlocks per level:**

| Clan Level | Unlock | Type |
|------------|--------|------|
| 1 | Starting state | — |
| 2 | Custom clan emblem (15 options) | cosmetic |
| 3 | +1 weekly contribution cap raise | mechanical (but capped — see Sacred Audit §7) |
| 4 | Clan banner color (12 options) | cosmetic |
| 5 | Clan flair badge appears on member profiles | cosmetic |
| 6 | +1 week of grace if member misses contribution | mechanical (see §2.4 caveats) |
| 7 | Clan-only voiceline sting in shared Replay (§4) | cosmetic |
| 8 | Custom clan motto on Adventure header (24 chars) | cosmetic |
| 10 | "Veteran Clan" — appears in Browse Public top tier | cosmetic+discovery |
| 15 | Special seasonal cosmetic per Tower season | cosmetic |
| 20 | Clan-name color on friend leaderboard widget | cosmetic |
| 25 | "Founding Clan" badge — earliest 100 clans, retroactive on launch | cosmetic |

**Sacred cow safety:**
- Clan level 3 raises the weekly contribution cap from `2 ×
  baseBossHp` to `2.5 × baseBossHp`. This is a mechanical advance but
  is gated by clan effort, not paid tier (F2P clans hit level 3 in
  ~3 weeks of average play). Honors ADR-003: no P2W.
- Clan level 6's "1 week grace" is a forgiveness mechanic — a clan
  whose weekly boss didn't quite die gets partial reward (50%) once
  per season. Not P2W; rewards consistent participation.
- All other unlocks are **purely cosmetic**. No clan unlock grants
  damage, defense, ULT, gold, gem, or progression speed advantage.

**Persistence (Firestore):**

```
adventures/{advId}/
  ├── (clan doc) {..., clanLevel, clanXp, customEmblem, customBanner,
  │              customMotto, founderUid, ...}
  ├── members/{uid}/
  └── seasonHistory/{seasonId}/
        ├── weeklyResults[] — [{week, bossId, hpDealt, defeated}]
        └── seasonalRank
```

**Performance:**
- Clan-level render ≤80ms FCP (read from clan doc).
- Unlock cosmetic application: client-side render only, no Firestore
  reads.

---

### 2.5 Async social hooks (no WebRTC)

**Hook surfaces (clan-internal):**

| Hook | Trigger | Surface | Cadence |
|------|---------|---------|---------|
| Weekly Boss reveal | Monday 00:00 UTC | Adventure screen banner + push notif opt-in | weekly |
| Defeat moment | weekly boss HP→0 | Adventure header celebration animation | once-per-week |
| Friend joins | new member joins via friend's invite | Adventure activity feed (`recentActivity` array, 7 items max, FIFO) | event-based |
| Defeat contribution | member defeats weekly boss in solo run | activity feed entry: "Kira added 240 damage" | event-based |
| Clan level up | clanXp hits threshold | banner notification + Adventure screen sparkle FX | event-based |
| Codex Adventure record | clan defeats weekly boss | per-member Codex Moment unlocked | weekly |

**Hook surfaces (cross-clan, async):**

| Hook | Trigger | Surface | Cadence |
|------|---------|---------|---------|
| Friend-of-friend invite | clan member shares Friend Code via navigator.share | OS share sheet → URL → join confirmation | event-based |
| Leaderboard share | clan member taps "share my weekly result" | navigator.share → image/GIF + clan name | event-based |
| Public clan browse | other player searches public clans | server-side index list, no notify | passive |

**Explicitly NOT included (per Execution Plan §8.4 + ADR-002 async):**

- ❌ Real-time chat (no WebSocket, no Firebase Realtime Database
  presence)
- ❌ Voice chat
- ❌ Activity-poll widgets ("who's online now")
- ❌ DMs / private messaging
- ❌ Moderation interfaces (no kicks beyond founder leaving = clan
  dissolves)
- ❌ Real-time activity feeds (`recentActivity` is event-batched, max
  refresh 60s)

This is the **anti-toxicity ruling** from Execution Plan §8.4 ("no
drama, no real-time, no roles"). The design is deliberate.

---

### 2.6 Performance budgets (Adventures)

| Constraint | Value | Justification |
|------------|-------|---------------|
| Adventures screen FCP | ≤300ms | AAA+ §3.2 |
| Firebase read (clan doc) p99 | ≤500ms | network buffer |
| Firebase write (defeat contrib) p99 | ≤300ms | single doc update |
| Member list render | ≤200ms p99 | 15 items max |
| Browse-public list render | ≤300ms FCP | 20-item indexed query |
| Per-fire add-contribution overhead | ≤4ms client-side | math only |
| Total Adventures layer frame-time overhead vs P2 baseline | ≤2ms/frame avg | screen-rendered only, no live tick |

**Anti-spam protection:**

- Per-clan member-add cap: 5 invites accepted per 24 hours (prevents
  spam-clan harvesting).
- Per-account clan-create cap: 1 clan founded per 7 days (prevents
  ghost-clan farming).
- Per-account clan-join cap: max 1 active clan at a time. Joining a
  new clan = leave-confirm modal.

---

## 3. Party Tower (T3.10–T3.13) — 2–5 player async coop

> Per ADR-002: async turn-based, NOT real-time WebRTC. Block puzzle is
> naturally turn-based; this is the right pattern.

### 3.1 Turn-based async architecture (T3.10)

**Concept:** 2–5 players take turns asynchronously on a shared Tower
board state. Each turn = one player places one piece (or one full piece
sequence, see §3.1 ruling), records the resulting state to Firestore,
and the next player gets notified to take their turn. No one needs to be
online at the same time. Turns may take seconds, minutes, hours, or
days.

**Per-turn cadence:**

```
Player 1 turn → resolves → Firestore commit → push notif to Player 2
Player 2 turn → resolves → Firestore commit → push notif to Player 3
...
Player N turn → resolves → Firestore commit → push notif to Player 1
```

**Turn unit (Designer ruling):**

A "turn" in Party Tower = **one full Tetris-piece placement**, after
which the board fully resolves (line clears + Identity Layer + boss
attack if applicable). This matches single-player tempo and avoids
multi-piece chains being blocked across multiple humans.

**Party state (Firestore):**

```
parties/{partyId}/
  ├── (party doc) {
  │      members: [uid1, uid2, ..., uid5] (2-5 entries),
  │      currentTurnUid,
  │      currentTurnDeadline,
  │      sharedTowerHearts,
  │      sharedPactPool: [...],
  │      activePacts: [...],
  │      currentBoss,
  │      bossHp,
  │      bossPhase,
  │      gridState: <serialized 8×16 grid>,
  │      pieceQueue: <serialized queue>,
  │      heldPiece,
  │      activeIdentityFx: {...},
  │      activeBossReactivity: {...},
  │      currentFloor,
  │      sessionStartedAt,
  │      lastTurnAt,
  │      historicalTurns[] — for replay
  │   }
  ├── chatHistory[] — emoji-only, max 8 emojis per turn
  └── replayBuffer[] — per-turn state diffs for §4 Replay infra
```

**Turn deadline + grace:**

- Default deadline: 24h (configurable per-party at creation: 24h /
  3-day / 7-day, designer-recommended 24h for newcomers, 7-day for
  hardcore async).
- Push notif at 12h remaining (if user opted in to notifs).
- After deadline expires: skip-vote allowed by any other party member
  (requires majority of remaining members). Skip-vote bypasses the
  delinquent player for one turn; if it happens twice, that player is
  auto-removed from party.
- **No real-time kick.** Skip-vote requires elapsed time. Anti-toxicity
  ruling preserved.

**Replay capture for §4:** every turn writes a per-turn state diff to
`replayBuffer[]`. This is what powers the §4.5 Codex Moments Replay
button — a Party Tower run can be played back turn-by-turn.

**Performance budget:**

| Constraint | Value | Justification |
|------------|-------|---------------|
| Turn handoff (start commit → notif) | ≤2s p99 | Firestore write + Cloud Messaging |
| Board state diff payload | ≤8 KB per turn | indexed sparse-diff |
| Per-turn grid restore on load | ≤100ms | client-side state rehydration |
| Turn-list panel render | ≤200ms FCP | members + status |
| Party state subscription open | ≤300ms p99 | Firestore listener attach |

---

### 3.2 Shared Tower-Hearts pool (T3.11)

**Sacred surface:** the **Tower retry gem ladder `[100, 200, 400]`** is
sacred per CLAUDE.md §2.4. Party Tower **reads** these values; it never
modifies them.

**Mechanics:**

- Each party shares a **single Tower-Hearts pool**. Starting hearts
  match v2.1 single-player Tower starting hearts (15 per HEART_UPGRADES
  state).
- When a hero dies during any player's turn, the party pool absorbs
  one heart.
- When pool hits 0, the run ends for the entire party. Retry triggers
  on a vote system: any party member can offer 100 gems (1st retry),
  200 gems (2nd), 400 gems (3rd) — sacred ladder honored. Retries are
  **per-pool**, NOT per-player, so a single whale can't carry the
  party past two retries (cap remains as in solo Tower).
- After 3 paid retries, the run ends regardless of whale spend (sacred
  cap honored).

**Contribution tracking:**

- Each member's `damageDealt` and `linesCleared` recorded per-turn.
  Used for §3.5 turn-end stat display + Codex.

**Sacred cow safety:**
- Retry ladder [100, 200, 400] read-only.
- Heart pool starting count read-only.
- Per-turn TTK target preserved (turn-aware: each player's turn
  follows single-player tempo).

---

### 3.3 Shared TOWER_PACTS (T3.12)

**Sacred surface:** `TOWER_PACTS_BASE` (30 pacts), `TOWER_PACTS_MYTHIC`
(15 seasonal pacts) per CLAUDE.md §2.5. Sacred values, structures,
rarities all preserved.

**Mechanics:**

- **Pact pool draws:** at the start of a party run, the system rolls
  TOWER_PACTS using sacred `PACT_RARITIES` weights (50%/30%/15%/5%
  common/rare/epic/mythic) for the party's TOWER_PACT slots. The pool
  is **shared** — all members see the same 3-pact selection.
- **Pact selection voting:** the party founder may either:
  - **Captain pick:** founder unilaterally selects (default).
  - **Democracy mode:** each member casts one vote (in async, votes
    cast as players take turns); majority wins; ties go to founder.
- Selection mode is set at party creation and locked for the run.
- During the run, pact effects apply identically to all members'
  turns (no per-member differentiation — the active pacts are
  party-wide).

**Mythic Pact gating:**

- TOWER_PACTS_MYTHIC stay seasonal-only per `seasonal: true` flag
  (sacred). Party Tower honors this — mythic pacts only roll during
  the active Tower season window.

**Sacred cow safety:**
- `TOWER_PACTS_BASE` 30 entries byte-perfect.
- `TOWER_PACTS_MYTHIC` 15 entries byte-perfect.
- `PACT_RARITIES` weights byte-perfect.
- Phase 3 adds NEW selection-mode + voting state to the party doc
  — does NOT modify the sacred pact data itself.

---

### 3.4 Per-turn Identity Layer integration (T3.13)

**Concept:** each player's turn brings their squad's Identity Layer to
the shared board. The 5 race FX and 7 boss-reactive mechanics fire
naturally on the current player's turn — but persisted state (cursed
cells, locked cells, root cells, Bloodtide counter) carries across
turns.

**Per-turn race FX dispatch:**

- When player N takes a turn and clears a line, the active `currentTurnUid`
  squad's identity FX fires. If the active squad has Pirates, Pirate
  Plunder gold goes to **that player's** gold pocket (NOT party-shared
  — gold is per-player, see §3.4 ruling).
- Shark Feeding Frenzy extra bites: extra cells are cleared on the
  shared board; subsequent player benefits or suffers from the new
  board state.
- Rock Encore Echo +1 ULT charge: goes to the active turn-player's
  hero ULTs (not party-wide). Hero state is per-member (squads are
  per-player even in party).
- Crocodile Bedrock Bastion fragment accrual: per-player fragment bank
  (each member tracks own crocodiles).
- Spark Sun Cascade +1 dominantCount: applies only to the current
  turn's combo crit math.

**Per-turn boss-reactive FX:**

- Phoenix Ashen Reign (ember-only 5s window): fires immediately at
  revive. Active 5s window applies regardless of whose turn comes
  next. If turn 5s expires before the next player's turn (e.g. async
  60-min gap), the window is forgiven — Ashen Reign is real-time and
  doesn't punish async cadence. The narrator line "The ash remembers"
  fires on the trigger player's screen at revive.
- Lich Cursed Tiles: shark-count threshold checks the active turn's
  squad. Cursed cells persist on the shared board across turns; any
  player can interact with them (the +1 HP/turn drain is shared damage).
- Berserker Bloodtide Pulse: every 3rd party-wide line clear (NOT
  per-player), Bloodtide tracker advances. The buff applies to the
  next boss attack regardless of whose turn it is.
- Engineer Lockdown: triggers on a 4-line crit by any player. The 4-cell
  lockdown applies to the shared board.
- Grovewarden Root Surge: triggers when the last 3 line clears (across
  all party turns) are not grove-dominant. Roots block the shared
  board.

**Cross-race party synergy:**

A 5-player party with mixed races opens up **emergent synergies** that
single-player squads of 5 can't achieve:

- Pirate gold + Shark adjacent clears: every shark bite earns gold for
  the player whose squad just played. Encourages mid-game "set up the
  pirate squad's turn after the shark squad's turn."
- Rock Encore Echo + Spark Sun Cascade across consecutive turns: rock
  player charges umbra ULT; spark player's next turn might unleash an
  umbra ULT with +1 dominantCount crit promotion.
- Crocodile Bedrock Bastion + Lich Cursed Tiles: the croc player banks
  shields to absorb the curse drain.

This is the **endgame depth Roman called for** — coop-specific identity
choreography that solo-Tower can't deliver.

**Sacred cow safety:**
- All Phase 2 identity-fx.js functions called with the **active
  turn-player's** squad state. No new identity logic added.
- Cross-race synergy is **emergent**, not coded — the existing fx
  functions naturally compose because they're stateless per-call.

---

### 3.5 Async social hooks (Party Tower)

| Hook | Trigger | Surface | Cadence |
|------|---------|---------|---------|
| Turn-took notification | player N commits turn | push notif (opt-in) to player N+1 | per turn |
| Big-clear highlight | player clears 4+ lines | activity blurb on party screen | per qualifying turn |
| Boss defeat shared | party kills boss | celebration animation + Codex moment per member | per boss |
| Emoji "react" | any player taps emoji after seeing turn | emoji shown next to that turn's stats | per turn |
| Run completion | party ends run (defeat or victory) | summary screen with per-member stats | per run |

**Emoji-only chat:**

Per Execution Plan §8.4 — emoji-only is the only chat surface allowed.
8 emojis per turn, no custom strings. Re-uses existing emoji set
(planet emoji, fire emoji, etc.) — no new asset.

---

### 3.6 Performance budgets (Party Tower)

| Constraint | Value | Justification |
|------------|-------|---------------|
| Turn handoff latency | ≤2s p99 | ADR-002 async target |
| Party screen FCP | ≤300ms | AAA+ §3.2 |
| Board state load on resume | ≤500ms p99 | grid rehydration + render |
| Per-turn frame budget overhead vs solo Tower | ≤2ms/frame | identity-fx dispatch is identical to solo |
| Party state subscription bandwidth | ≤200KB per day per party | sparse Firestore listeners |
| Push notif delivery p99 | ≤30s | Firebase Cloud Messaging SLA |

**Anti-spam protection:**

- Per-account active-party cap: max 3 concurrent parties (prevents
  party-stuffing for whale players).
- Per-account party-invite cap: 5 invites sent per hour.
- Per-party member cap: 5 hard.

---

## 4. Replay/Share infrastructure (T3.07–T3.09)

> Ships the §4.5 stretch goal from Phase 2 identity-layer.md as Phase 3
> core. Every recorded Codex Moment gets a Replay button.

### 4.1 Auto-record key moments (T3.07)

**Capture trigger predicates:**

| Trigger | Source | Persistence |
|---------|--------|-------------|
| Boss defeated | `onBossDefeated` legacy hook + new src/ codex aggregation | always; one per boss-kill |
| Tetris crit (4-line clear) | `clearLines(rows, cols).length === 4` | always; one per crit |
| Identity Layer race FX fires | `__dispatchIdentityFx` bridge | sample 1-in-5; not all coin pops worth keeping |
| Identity Layer boss reactivity | `__dispatchIdentityBossEvent` bridge | always; one per boss-reactive event |
| Big combo (combo ≥ 4) | combo crit damage post-formula | always; one per qualifying combo |
| Stagger entry | Stagger Loop transition Active→Stagger | always; one per battle-stagger entry |
| Tower floor 25/50/75/100 milestones | tower screen `nextFloor` increment | always; rare/notable |
| Adventure weekly defeat | Adventures Cloud Function on hp→0 | always; one per weekly |
| Party Tower run-clear | Party Tower onComplete | always; one per party run |

**Capture mechanism:**

- **Lightweight state snapshots, NOT full screen recording.** A replay
  is a JSON stream of: grid state, piece queue, hero squad, boss
  state, identity-fx state, hero ULT charge — captured at 4fps for
  the 5 seconds surrounding the trigger event.
- 5 sec × 4 fps = 20 frames × ~2 KB compressed = ~40 KB per replay
  (typical), capped at 100 KB hard.
- Replay buffer maintains last 60 seconds in-memory (rolling window).
  On trigger, the relevant 5-second slice is extracted and uploaded
  to Firebase Storage async.

**Capture overhead budget:**

- Frame-time overhead: **≤4ms per frame** added (4 frames per second,
  averaged over time). Achieved by capturing only every 4th frame
  during normal play; on trigger, the relevant window is sliced.
- Memory budget: 60 sec rolling buffer × ~10 KB per frame = ~600 KB
  in memory, well under mobile budget.

### 4.2 Replay viewer (T3.08)

**UI surface:**

```
┌─────────────────────────────────┐
│  ← REPLAY: Pyredrake Defeat    │
├─────────────────────────────────┤
│  ┌──[ replay canvas ]──┐        │
│  │  (5-sec scrubable    │        │
│  │   playback)          │        │
│  └─────────────────────┘        │
│   ▷  ────●──────────────  5s    │
│  ┌────────────────────┐         │
│  │ ▶ play  ⏸ pause   │         │
│  │ ⊕ slow  ⊖ fast    │         │
│  │ ⤴ share            │         │
│  └────────────────────┘         │
│                                 │
│  WHEN: Day 7 · Adventure        │
│  CTX: 4-line crit → boss death  │
│  YOU: Pirate squad (×5)         │
└─────────────────────────────────┘
```

**Playback behavior:**

- Default: auto-play once at 1× speed, then pause.
- Speeds: 0.5×, 1×, 2× (no faster — at 4fps, 2× = 8fps which is fine).
- Scrub: tap any point on the 5s timeline to seek.
- Loop: tap loop icon to repeat.
- Share: navigator.share with deeplink + image preview.

**Performance:**

- Replay viewer FCP ≤300ms (load JSON + render first frame).
- Frame render time ≤16ms (60fps target for smooth playback even at 4fps capture).
- Stream rehydration ≤500ms for 100 KB buffer.

### 4.3 navigator.share integration

**Share targets:**

- Image preview (PNG snapshot of replay start frame) + caption
  "[username] defeated [boss] — [moment type]" + URL.
- Optional GIF preview (5-sec animated, 100 KB cap) — generated
  client-side via canvas.captureStream + MediaRecorder.
- Share URL: `https://blocksworm.com/r/[replayId]` — deeplinks to
  the replay viewer with the replay pre-loaded.

**Anti-abuse:**

- Replay URLs are public but contain a 12-char `replayId` so
  guessing is impractical.
- Per-account share-publish cap: 50 replays per day (free); whale
  cap: 200/day (per §8.3 whale tier).
- Replay storage TTL: 90 days for free tier; permanent for whale tier
  (§8.3). NOT a P2W mechanic — replays are personal memorabilia,
  cosmetic prestige only.

### 4.4 Backend (Firebase Storage)

**Storage paths:**

```
replays/{uid}/{replayId}.json — replay state stream
replays/{uid}/{replayId}.png  — preview image (auto-generated)
```

**Schema (`{replayId}.json`):**

```json
{
  "version": 1,
  "type": "boss_defeat" | "tetris_crit" | "identity_fx" | "party_run" | "weekly_defeat",
  "playerUid": "...",
  "timestamp": "ISO8601",
  "duration_ms": 5000,
  "frames": [
    {"t": 0, "grid": [...], "boss": {...}, "squad": [...], "identityFx": {...}},
    {"t": 250, ...},
    ...
  ],
  "metadata": {
    "boss_id": "pyredrake",
    "trigger": "tetris_crit",
    "race_dominant": "pirate",
    ...
  }
}
```

**Deduplication:**

- Replay IDs are content-hashed at upload time. Identical states (e.g.
  one player's identical replay-trigger fire) get deduped to one
  storage object.
- Per-account size budget: free tier 50 MB total (50 replays of 1 MB
  avg, or 500 of 100 KB); whale tier 250 MB.
- Open Question Q2 about whether this budget is right.

### 4.5 Phase 2 Codex integration

**Codex Moments tab (§4.6 identity-layer.md spec):**

```
┌─────────────────────────────────┐
│  ← CODEX / Moments              │
├─────────────────────────────────┤
│  Triggered: 47 unique moments  │
├─────────────────────────────────┤
│  [PYREDRAKE] Tetris Crit       │
│   Day 7 · 12 sec               │
│   [▶ Replay]                    │
├─────────────────────────────────┤
│  [SOLAR PHOENIX] Ashen Reign   │
│   Day 12 · 3 sec               │
│   [▶ Replay]                    │
├─────────────────────────────────┤
│  ...                            │
└─────────────────────────────────┘
```

The Replay button (was "stretch goal" in identity-layer.md §4.6) now
ships as core. Tapping it opens the Replay viewer (§4.2) with the
captured replay.

**Codex moment auto-link:**

When a replay is captured (§4.1), the system writes back to the Codex
Moments entry: `momentEntry.replayId = "abc123"`. The Replay button is
only shown if `replayId` exists.

### 4.6 Performance budgets (Replay/Share)

| Constraint | Value | Justification |
|------------|-------|---------------|
| Replay capture frame-time overhead | ≤4ms per frame avg | per task brief |
| Replay upload (async) | retry with 30s/2m/5m backoff | resilient to flaky mobile network |
| Replay viewer FCP | ≤300ms | UI screen |
| GIF generation (client) | ≤1s for 5s clip | MediaRecorder native API |
| Per-account replay storage | ≤50 MB free / 250 MB whale | reasonable for personal collection |
| Deduplication CPU cost | ≤100ms per upload | one content-hash compute |

---

## 5. Friend leaderboard mini-block (T3.06)

### 5.1 Surface

**Mini-block widget** appears on the menu screen + tower screen entry,
visible without navigating into Adventures/Tower:

```
┌─────────────────────────────────┐
│ FRIENDS THIS WEEK               │
│ ────────────────────────────── │
│ Roma     ▓▓▓▓▓▓▓▓▓▓  124 fl   │
│ Kira     ▓▓▓▓▓▓▓     91 fl    │
│ Sebastien ▓▓▓▓▓      67 fl    │
│ + 2 more friends                │
│                                 │
│ [ See all  →  ]                 │
└─────────────────────────────────┘
```

### 5.2 Data source

**Friend graph:**

- Clan members (current Adventure clan) auto-link as friends.
- Party Tower co-players auto-link as friends.
- Codex defeated set — players the user has co-defeated a boss with
  (via Adventures or Party Tower) auto-link as friends.
- Replay-share viewers — players who opened the user's shared replays
  auto-link as friends (consent: opt-in toggle in settings).

**Source merge:**

- Friends collection: `users/{uid}/friends/{otherUid}` document with
  `{ since, source: "clan"|"party"|"codex"|"replay", consent: true|false }`.
- Per-user friend cap: 100 entries (FIFO eviction by `since` for
  oldest entries that haven't interacted in 30 days).
- All friend data is opt-in via signup terms.

**Tower scores:**

- Read from `users/{uid}/towerRuns/current` (current season's best
  floor).
- Updated daily via Cloud Function reading from per-run records.
- Sort: descending by floor count; ties broken by season-clear-date
  (earliest first).
- Show top 5 + "+N more friends" expander.

### 5.3 Discovery + invite

**Friend invite mechanism (see Open Question Q5):**

Option A (recommended): **navigator.share-only**. Player taps "invite
friends" → opens OS share sheet → recipient gets a deeplink URL
(`https://blocksworm.com/?friend=ABC123`). On acceptance, mutual
friend record created in both users' Firestore.

Option B (alternative): **in-game friend codes**. 6-char alphanumeric
codes. Player sees their own code + enters another's code to add.

Designer recommendation: **A** for MVP — OS-native share is more
discoverable and matches the Adventure Friend Code flow. B may layer
on later if Option A friction surfaces in retention data.

### 5.4 Performance budgets

| Constraint | Value | Justification |
|------------|-------|---------------|
| Friend leaderboard widget render | ≤100ms | menu-screen embed |
| Friend list fetch (cached) | ≤200ms p99 | cached for 5 min |
| Friend list fetch (uncached) | ≤500ms p99 | indexed Firestore query |
| Tower-score sync per friend | ≤50ms | sparse update on tower-run-complete |

---

## 6. Tower seasonal infrastructure (T3.14–T3.15)

### 6.1 Seasonal Uroboros boss rotation (T3.14)

**Concept:** Tower already has Uroboros as sacred seasonal mythic boss
(CLAUDE.md §2.5). Phase 3 adds the **rotation cadence** — different
weeks/seasons cycle Uroboros vs alternate seasonal candidates.

**Sacred surface:** Uroboros boss spec, stats, Eternal Loop identity
mechanic — byte-perfect preserved.

**New rotation layer (`src/data/season-config.js`):**

```
seasonal_bosses_rotation: [
  { season: 1, weeks: 1-13,  mythic_boss: 'uroboros' },
  { season: 2, weeks: 14-26, mythic_boss: 'voidfang_ascendant' },
  { season: 3, weeks: 27-39, mythic_boss: 'uroboros_inverted' },
  { season: 4, weeks: 40-52, mythic_boss: 'uroboros' },
]
```

(Voidfang Ascendant + Uroboros Inverted are NEW variants — extensions
of the existing Voidfang and Uroboros archetypes with different stat
tunings + identity mechanic variations. They reuse existing boss
infrastructure entirely, never modifying sacred values. New variants
land as separate boss-table entries, not modifications to existing
ones.)

**Seasonal banner UI:**

```
┌─────────────────────────────────┐
│  TOWER                          │
│ ────────────────────────────── │
│  SEASON 2 — VOIDFANG'S WAKE     │
│  Mythic Boss: VOIDFANG ASCEND.  │
│  20d 14h remaining              │
│ ────────────────────────────── │
│  ... (existing tower UI below)  │
└─────────────────────────────────┘
```

**Sacred cow safety:**
- Uroboros boss spec untouched.
- TOWER_PACTS / TOWER_PACTS_MYTHIC sacred — see §6.2.
- TOWER_LEADERBOARDS sacred — see §6.3.
- 3-min Tower TTK target sacred — applies per-floor regardless of
  season.

### 6.2 TOWER_PACTS seasonal rotation

**Sacred surface:** `TOWER_PACTS_BASE` (30 entries) + `TOWER_PACTS_MYTHIC`
(15 entries) — byte-perfect preserved.

**New rotation layer:** **a new pool of seasonal pacts** added per
season as **additional** sacred entries — NOT replacements. The existing
30+15 stay rolling; new seasonal sets add 5-10 NEW mythic pacts per
season that retire on season end.

**Implementation:**

- `src/data/season-config.js` exports `SEASONAL_PACT_ADDITIONS_S2 = {...}`
  with NEW mythic pact entries scoped to Season 2.
- At season-N's start, the pact pool effectively becomes
  `TOWER_PACTS_BASE ∪ TOWER_PACTS_MYTHIC ∪ SEASONAL_PACT_ADDITIONS_S<N>`.
- At season end, additions retire; only sacred 30+15 remain available
  on weekly cadence.

**Sacred cow safety:**
- 30 base + 15 mythic pacts ALWAYS available across all seasons.
- Seasonal additions are PURELY ADDITIVE — never replace, never
  modify existing entries.
- PACT_RARITIES weights unchanged.

### 6.3 Season leaderboard wipes + PURE PATH interaction

**Sacred surface:** `TOWER_LEADERBOARDS.weekly_seasonal` already has
`resetOnSeasonEnd: true` per `src/data/tower.js:line 102` (sacred).

**Phase 3 ruling:**

- Phase 3 honors the existing wipe cadence — does not modify.
- The wipe applies to `TOWER_LEADERBOARDS.weekly_seasonal` ONLY.
- `TOWER_LEADERBOARDS.global` (lifetime) preserved.
- `TOWER_LEADERBOARDS.f2p_only` (PURE PATH) preserved as lifetime F2P
  ranking. Sacred per CLAUDE.md §2.5.

**Friend leaderboard widget (§5) integration:**

- Friend widget reads from `weekly_seasonal` by default.
- Toggle in friend widget settings to show global lifetime instead.
- F2P player's view of widget: shows only F2P friends' weekly scores
  (PURE PATH filter active by default). Why: F2P doesn't want to see
  whales' weekly scores skewed by paid retries (PURE PATH purity).

### 6.4 Battle Pass tie-in (T3.15)

**Sacred surface:** Battle Pass formula `xp = 500 + tier × 150` per
CLAUDE.md §2.4. Byte-perfect preserved.

**Phase 3 ruling:**

- Phase 3 adds Battle Pass tier-cosmetic rewards aligned to each
  seasonal cadence.
- **NO formula change.** Battle Pass tier-XP math identical.
- New cosmetic rewards (clan emblems, replay frame styles, friend
  leaderboard color slots) align with season themes.

**Per-season Battle Pass cosmetic schedule:**

- Tier 5: seasonal clan emblem (1 per season, 4 per year)
- Tier 10: seasonal replay frame border
- Tier 20: seasonal friend-leaderboard name color
- Tier 35: seasonal Tower season-cosmetic emblem
- Tier 50: seasonal exclusive avatar frame

All cosmetics. **Zero mechanical advantage.** Honors ADR-003.

**Sacred cow safety:**
- Battle Pass formula `500 + tier × 150` byte-perfect.
- Battle Pass tier counts unchanged.
- Tier rewards have always included cosmetics — Phase 3 adds NEW
  cosmetic items per season, never modifies tier-XP math.

---

## 7. Sacred cow safety audit

| Sacred system (CLAUDE.md ref) | Modified? | Notes |
|-------------------------------|-----------|-------|
| Combo crit formula (§2.1) | NO | Phase 3 doesn't touch line clear math |
| Element synergy 2x/3x/5x (§2.1) | NO | Phase 3 doesn't touch synergy |
| RACE_SYNERGY tier values (§2.1) | NO | Phase 3 doesn't touch RACE_SYNERGY |
| TIER_COSTS_V18 (§2.1) | NO | Not touched |
| HERO_ULT_COST_BY_NEWROLE (§2.1) | NO | Not touched |
| TTK formula (§2.1) | NO | Not touched |
| MAX_HP = 100 (§2.1) | NO | Not touched |
| V_HAPTICS table (§2.2) | NO | Phase 3 uses existing haptic keys only |
| vPlayCritFlash 180+440ms (§2.2) | NO | Not touched |
| 5-beat boss death (§2.2) | NO | Not touched |
| Particle line clear pattern (§2.2) | NO | Not touched (Replay capture reads, doesn't modify) |
| NARRATOR_LINES (§2.3) | NO | Phase 3 doesn't add narrator lines |
| Chronicler dialog (§2.3) | NO | Not touched |
| Boss names / element subtitles (§2.3) | NO | Re-used read-only |
| GEM_PACKS prices (§2.4) | NO | Not touched (Adventures/Party never modify) |
| First Purchase Bonus (§2.4) | NO | Not touched |
| Battle Pass tier formula `500 + tier × 150` (§2.4) | NO | New cosmetics added per tier; formula byte-perfect |
| Tower retry gem ladder [100, 200, 400] (§2.4) | NO | Party Tower reads sacred values; never modifies |
| 3-min Tower TTK (§2.4) | NO | Honored per-floor in Party Tower |
| 4-channel damage system (§2.5) | NO | Not touched |
| Stagger Loop / Recovery (§2.5) | NO | Honored per-turn in Party Tower; never modified |
| HERO_TIER_ABILITIES (§2.5) | NO | Read-only in Adventures contribution math |
| BOSS_TTK_TARGETS (§2.5) | NO | Read for Adventures weekly HP scaling; not modified |
| TOWER_LEADERBOARDS (§2.5) | NO | Friend leaderboard reads; not modified |
| TOWER_PACTS_BASE (§2.5) | NO | Party Tower selects from sacred pool; not modified |
| TOWER_PACTS_MYTHIC (§2.5) | NO | Party Tower respects `seasonal: true`; not modified |
| Uroboros seasonal (§2.5) | EXTENDED | Rotation layer (§6.1) — Uroboros spec untouched |
| FTUE_BOSS_GUARANTEES (§2.5) | NO | Not touched; Adventures unlocked post-FTUE |
| Chronicler narrator (§2.5) | NO | Phase 3 doesn't add lines |
| PURE PATH leaderboard (§2.5) | NO | F2P lifetime ranking preserved; Friend widget respects |
| Reactivity Events 22 handlers (§2.5) | NO | Party Tower fires existing handlers; doesn't modify |
| PHASE_GATE_P1_TO_P2 = 0.70 (§2.5) | NO | Not touched |
| PHASE_GATE_P2_TO_P3 = 0.35 (§2.5) | NO | Not touched |
| REACTIVITY_TELEGRAPH_MS = 3000 (§2.5) | NO | Reused for Party Tower boss telegraphs |
| REACTIVITY_BANNER_DURATION_MS = 1500 (§2.5) | NO | Reused |
| PHOENIX_REVIVE_HP_PCT = 0.6 (§2.5) | NO | Honored per-turn |
| PHOENIX_IMMUNE_TURNS = 2 (§2.5) | NO | Honored per-turn |
| BERSERKER_ENRAGE_HP_PCT = 0.5 (§2.5) | NO | Honored per-turn |
| BERSERKER_ENRAGE_MULT = 2.0 (§2.5) | NO | Honored per-turn |
| ARMORED_SHIELD_COUNT = 2 (§2.5) | NO | Honored per-turn |
| ARMORED_SHIELD_ABSORB = 0.3 (§2.5) | NO | Honored per-turn |
| Identity Layer race FX (Phase 2) | NO | Party Tower invokes; never modifies |
| Identity Layer boss-reactive (Phase 2) | NO | Party Tower invokes; never modifies |
| Codex localStorage `blocksworn_codex_state` (Phase 2) | NO | Phase 3 adds Replay button hook; codex schema unchanged |

**Result: 0 sacred-cow value modifications.** Phase 3 is purely
additive. The only "EXTENDED" row is Uroboros seasonal rotation
metadata — the boss itself, its stats, its Eternal Loop identity
mechanic remain byte-perfect.

---

## 8. Player Segments interaction (no P2W invariant per ADR-003)

> Sacred segments from T1.20 / CLAUDE.md glossary §9:
> F2P (totalSpent === 0), Minnow ($1-$24), Dolphin ($25-$99),
> Whale ($100+).

### 8.1 Per-segment Phase 3 access

| Surface | F2P | Minnow | Dolphin | Whale |
|---------|-----|--------|---------|-------|
| Solo Tower (sacred) | ✅ full | ✅ full | ✅ full | ✅ full |
| PURE PATH leaderboard | ✅ ranked | ❌ not eligible | ❌ not eligible | ❌ not eligible |
| Global leaderboard | ✅ ranked | ✅ ranked | ✅ ranked | ✅ ranked |
| Adventures (clan 5-15) | ✅ full | ✅ full | ✅ full | ✅ full |
| Adventures: PURE PATH clan badge | ✅ if all F2P | ❌ N/A | ❌ N/A | ❌ N/A |
| Adventures: Clan level up | ✅ same speed | ✅ same speed | ✅ same speed | ✅ same speed |
| Adventures: Cosmetic unlocks | ✅ via clan XP | ✅ via clan XP | ✅ via clan XP | ✅ via clan XP |
| Party Tower (2-5 coop) | ✅ full | ✅ full | ✅ full | ✅ full |
| Party Tower: Retry ladder | ✅ same costs | ✅ same costs | ✅ same costs | ✅ same costs |
| Party Tower: Pact selection | ✅ identical | ✅ identical | ✅ identical | ✅ identical |
| Replay capture | ✅ full | ✅ full | ✅ full | ✅ full |
| Replay storage | 50 MB / 90 day TTL | 50 MB / 90 day TTL | 100 MB / permanent | 250 MB / permanent |
| Replay share | ✅ unlimited | ✅ unlimited | ✅ unlimited | ✅ unlimited |
| Friend leaderboard widget | ✅ full | ✅ full | ✅ full | ✅ full |
| Battle Pass cosmetic rewards | ❌ free track only | ✅ premium | ✅ premium | ✅ premium |
| Battle Pass formula (sacred) | ✅ identical | ✅ identical | ✅ identical | ✅ identical |
| Founder Badge (clan-founder cosmetic) | ✅ available | ✅ available | ✅ available | ✅ available |
| Clan Founder Prestige Frame | ❌ — | ❌ — | ❌ — | ✅ whale tier cosmetic |
| Adventure browse-public top tier | shared algorithm | shared algorithm | shared algorithm | shared algorithm |

### 8.2 What paid tiers get (cosmetic only)

**Whale tier:**
- Permanent replay storage (250 MB / forever)
- Clan Founder Prestige Frame (visible to clan members only)
- Whale-tier clan name color in friend leaderboard (visible to clan)
- Founder Badge (early adopter signal)
- Battle Pass premium track per season
- NO mechanical advantages (no extra retries, no extra clan size, no
  extra pact draws, no extra party slots)

**Dolphin tier:**
- 100 MB replay storage, permanent
- Standard clan member cosmetic flair
- Battle Pass premium track per season
- NO mechanical advantages

**Minnow tier:**
- 50 MB replay storage, 90-day TTL
- Battle Pass premium track per season
- NO mechanical advantages

**F2P tier:**
- 50 MB replay storage, 90-day TTL
- PURE PATH leaderboard eligibility (lifetime)
- ALL same Adventure/Party Tower access as paid tiers
- NO premium Battle Pass track

### 8.3 PURE PATH parity audit

To verify ADR-003 no-P2W is honored, Phase 3 Bug Tester runs a per-season
PURE PATH parity check:

| Metric | Target |
|--------|--------|
| F2P average Tower floor cleared per week | within 10% of paid avg |
| F2P Adventures completion rate (weekly defeats) | within 5% of paid avg |
| F2P Party Tower run-completion rate | within 5% of paid avg |
| F2P retention D7 / D30 | within 5% of paid avg |

If any metric falls outside its target window for 2 consecutive seasons,
P2W audit escalation triggers. The PURE PATH leaderboard surface is the
public truth.

---

## 9. Performance budgets — Phase 3 layer-wide

| Constraint | Value | Source |
|------------|-------|--------|
| Adventures screen FCP | ≤300ms | task brief |
| Party Tower turn handoff p99 | ≤2s | task brief, ADR-002 |
| Replay capture frame-time overhead | ≤4ms/frame avg | task brief |
| Firebase read p99 | ≤500ms | task brief |
| Friend leaderboard widget render | ≤100ms | task brief |
| Total Phase 3 frame-time overhead vs Phase 2 baseline | ≤4ms/frame avg | task brief |
| Replay viewer FCP | ≤300ms | §4.6 |
| Party state subscription bandwidth | ≤200KB per day per party | §3.6 |
| Per-account replay storage | F2P/Minnow 50 MB; Dolphin 100 MB; Whale 250 MB | §8.1 |
| Bundle size impact (Phase 3 deltas) | ≤500 KB JS / ≤200 KB CSS | sub-AAA+ budget total <5MB |

**Object-pool requirements:**

- Replay frame buffer pooled at 60-frame rolling window (re-use
  ArrayBuffer pool, no per-frame allocation).
- Friend leaderboard widget rows pooled at 5-row maximum (re-use DOM
  fragment).
- Adventures member list rows pooled at 15-row maximum.

**Async pattern requirements:**

- All Firebase reads in Phase 3 use `await` with `try/catch` + visible
  loading state. No silent failures.
- All Firebase writes idempotent (re-tryable on connection loss).
- Replay upload uses `Promise.race` with 30s timeout + 3 retries.

---

## 10. Implementation dependencies (for Game Developer)

### 10.1 New files

| File | Purpose | T-number |
|------|---------|----------|
| `src/ui/adventures.js` | Adventures screen + clan create/join/view | T3.02 (created first) |
| `src/services/clan-backend.js` | Firestore clan + party + friend ops | T3.02 (created first; expanded T3.10, T3.06) |
| `src/data/season-config.js` | Season rotation + seasonal pact additions + seasonal boss rotation | T3.14 (data only) |
| `src/ui/party-tower.js` | Party Tower screen + per-turn state | T3.10 |
| `src/services/replay-backend.js` | Replay capture, upload, fetch | T3.07 |
| `src/ui/replay-viewer.js` | Replay playback UI | T3.08 |
| `src/ui/friend-leaderboard.js` | Friend leaderboard widget + full-screen | T3.06 |
| `src/styles/screens/adventures.css` | Adventures styling | T3.02 |
| `src/styles/screens/party-tower.css` | Party Tower styling | T3.10 |
| `src/styles/screens/replay-viewer.css` | Replay viewer styling | T3.08 |
| `src/styles/widgets/friend-leaderboard.css` | Friend widget styling | T3.06 |
| `tests/smoke/adventures.spec.js` | Create/join smoke | T3.02 |
| `tests/smoke/party-tower.spec.js` | Turn-take smoke | T3.10 |
| `tests/smoke/replay.spec.js` | Capture/view smoke | T3.07 + T3.08 |
| `tests/smoke/friend-leaderboard.spec.js` | Widget render smoke | T3.06 |
| `tests/unit/clan-backend.test.js` | Math purity (contribution calc, etc.) | T3.02 |
| `tests/unit/replay-backend.test.js` | State diff dedup math purity | T3.07 |

### 10.2 Files to modify (additive only)

| File | Change | Sacred risk |
|------|--------|-------------|
| `src/ui/router.js` | Add 4 routes: `adventures`, `party-tower`, `replay`, `friend-leaderboard`. Pure addition; existing routes preserved byte-perfect. | NONE |
| `src/ui/menu.js` | Add 3-4 drawer entries: ADVENTURES (under CODEX), PARTY TOWER (under TOWER), FRIEND LEADERBOARD (under PROFILE). Pure addition; existing entries preserved. | NONE |
| `src/services/firebase.js` | Add helper methods for new Firestore collections: `getAdventureDoc`, `getPartyDoc`, `getReplayObj`. Sacred config + init flow unchanged. | NONE |
| `src/services/storage.js` | Add new localStorage keys: `blocksworn_active_clan_id`, `blocksworn_active_party_id`, `blocksworn_friend_consent`. Schema additive. | NONE |
| `src/ui/codex.js` | T2.12 codex Moments tab: append Replay button per moment (if `momentEntry.replayId` exists). Pure addition; existing display preserved. | NONE |
| `src/ui/tower.js` | Add seasonal banner at top + Party Tower entry button. Pure addition; existing tower-floor logic preserved. | NONE |
| `src/data/tower.js` | Read-only — Phase 3 imports `TOWER_PACTS_BASE`, `TOWER_PACTS_MYTHIC`, `PACT_RARITIES`, `TOWER_LEADERBOARDS`; never modifies | NONE |

### 10.3 Sequence

**Wave 1 (parallel-friendly start):**
- T3.02 — Adventures backend + create/join flow + `src/services/clan-backend.js` skeleton
- T3.07 — Replay capture infrastructure + `src/services/replay-backend.js`
- T3.14 — Season config data file + seasonal rotation logic

**Wave 2 (depends on Wave 1):**
- T3.03 — Adventures weekly target + boss-of-the-week (depends T3.02 + T3.14)
- T3.08 — Replay viewer UI (depends T3.07)
- T3.06 — Friend leaderboard widget (depends T3.02 — friends emerge from clan)

**Wave 3 (depends on Wave 2):**
- T3.04 — Adventures contributor stats UI
- T3.05 — Adventures clan progression + cosmetic unlocks
- T3.09 — Replay share + Codex integration
- T3.15 — Battle Pass cosmetic tie-in

**Wave 4 (depends on Wave 3, integration):**
- T3.10 — Party Tower turn-based architecture
- T3.11 — Shared Tower-Hearts pool
- T3.12 — Shared TOWER_PACTS selection
- T3.13 — Per-turn Identity Layer integration

Final integration moment (mirrors T2.B for Phase 2): a single
**T3.16 Legacy Bridge** task wires Adventures + Party Tower + Replay
into the legacy primary runtime per ADR-004 hybrid coexistence.

### 10.4 Window bridge surface (T3.16, eventual)

When Phase 3 integration lands, the following window bridge functions
will need exposure (parallel to T2.B 26 functions):

- `__joinAdventureByCode`, `__leaveAdventure`, `__getAdventureState`
- `__startPartyRun`, `__takePartyTurn`, `__getPartyState`,
  `__voteSkipPartyMember`
- `__captureReplayMoment`, `__getReplayList`, `__shareReplay`
- `__getFriendLeaderboard`
- Each bridge call validates server-side; client-side is presentation
  only.

### 10.5 Test coverage requirements (per CLAUDE.md §3.5)

- **Smoke**: 1 per major flow (clan create, clan join, weekly defeat
  contribution, party run start, party turn take, replay capture +
  view, friend share invite) — minimum 7 new smokes.
- **Unit**: math purity tests per backend (Adventures contribution
  formula, Party turn state diff, Replay dedup hash, Friend graph
  merge).
- **Visual**: 12-20 new baselines for 4 new screens × desktop +
  mobile = ~14 baselines per §11.
- **Manual**: Bug Tester end-to-end across 2 accounts (multi-device
  testing) — clan join from device A, contribute from device B, party
  turn alternation, replay-share OS sheet validation.

---

## 11. Visual regression baseline impact

The following baselines will need to be **captured** as new (not
re-captured, since Phase 3 introduces 4 brand-new screens):

**Adventures (4 baselines × 2 viewports):**
- `tests/visual/baseline/adventures-empty-state.png` (no clan yet)
- `tests/visual/baseline/adventures-weekly-active.png` (in clan, weekly boss live)
- `tests/visual/baseline/adventures-clan-progression.png` (level-up moment)
- `tests/visual/baseline/adventures-member-list.png` (browse public)

**Party Tower (3 baselines × 2 viewports):**
- `tests/visual/baseline/party-tower-lobby.png` (waiting for your turn)
- `tests/visual/baseline/party-tower-active-turn.png` (your turn, mid-battle)
- `tests/visual/baseline/party-tower-summary.png` (run complete summary)

**Replay viewer (2 baselines × 2 viewports):**
- `tests/visual/baseline/replay-viewer.png` (boss defeat replay playing)
- `tests/visual/baseline/replay-share-sheet.png` (share modal open)

**Friend leaderboard (2 baselines × 2 viewports):**
- `tests/visual/baseline/friend-leaderboard-widget.png` (menu widget collapsed)
- `tests/visual/baseline/friend-leaderboard-full.png` (full-screen view)

**Codex Moments with Replay button (1 baseline × 2 viewports):**
- `tests/visual/baseline/codex-moments-replay-button.png` (T2.12 update — existing baseline replaced with intentional baseline-update commit)

**Total new baselines:** ~14 baselines × 2 viewports (chromium + mobile-chrome) = **24 new baselines** + 1 intentional Codex baseline update.

Existing baselines (battle, menu, tower, codex tabs, FTUE) must NOT
change. If they do, Phase 3 is leaking → regression bug per §11 contract.

---

## 12. Test coverage requirements

Per CLAUDE.md §3.5:

- **Smoke**: 7 new smokes (one per major flow as listed in §10.5).
- **Unit**: 4 new unit-test suites covering Adventures math, Party
  state diffs, Replay deduplication, Friend graph.
- **Visual**: 24 new baselines per §11.
- **Manual**: Bug Tester multi-account end-to-end pass:
  - 2 accounts on 2 devices
  - Clan create A → invite B → B joins → both contribute to weekly
    boss → weekly defeat → reward distribution verify
  - Party Tower 2-player run: A starts → A turn → B turn → boss
    defeat → run complete → both members see replay
  - Replay share: A shares replay URL → B opens URL in browser →
    replay loads + plays
  - Friend leaderboard: A's widget shows B's tower score; B's
    widget shows A's tower score

**Phase 3 closeout audit:**

- 22 sacred Reactivity handlers byte-perfect (regression contract)
- Sacred `TOWER_PACTS_BASE` / `TOWER_PACTS_MYTHIC` byte-perfect
- Sacred `TOWER_LEADERBOARDS` byte-perfect
- Battle Pass formula `500 + tier × 150` byte-perfect
- PURE PATH parity audit baseline established (§8.3)

---

## 13. Open questions for Roman

### Q1 — Adventures clan size: enforce 5-15 hard cap?

Execution Plan §8.4 specifies clan = 5–15 players async-group. Designer
recommends **enforcing as hard cap** for Phase 3 ship.

Alternative considered: whale-tier clans up to 5–30. **Rejected:** larger
clans introduce P2W via more contributors hitting weekly cap, which is
ADR-003 violation. Cap stays at 15 hard.

**My recommendation:** **Hard cap 5–15**. No exceptions.

If Roman wants whale-tier exception: route through ADR-003 amendment
process (separate ESC).

---

### Q2 — Replay storage budget per player tier

Designer-proposed budgets:
- F2P: 50 MB / 90-day TTL
- Minnow: 50 MB / 90-day TTL
- Dolphin: 100 MB / permanent
- Whale: 250 MB / permanent

Question: are these tier budgets right? Specifically:
- Is "permanent" storage for Dolphin+ a meaningful prestige incentive
  without crossing P2W?
- Should F2P storage be larger (100 MB / permanent) to honor PURE PATH
  parity? Replays are personal memorabilia, not gameplay advantage.

**My recommendation:** **F2P 100 MB / permanent storage**, Minnow same,
Dolphin 250 MB / permanent, Whale 500 MB / permanent. Permanent storage
across all tiers honors the "personal collection" framing. Differences
are size-only, never expiration. This is the safest no-P2W posture.

If Roman wants TTL on F2P for storage-cost reasons: confirm cost-per-MB
analysis before commitment.

---

### Q3 — Party Tower turn timeout default

Three timeout options for Party Tower turn deadline (set at party
creation):

| Mode | Timeout | Target audience |
|------|---------|-----------------|
| Casual | 7 days | Async coop, family/friend clans, async-first |
| Standard | 24 hours | Default for active coop, expected daily play |
| Competitive | 4 hours | Speedrun-style, hardcore party play |

Question: which is the default for new parties?

**My recommendation:** **Standard 24 hours default**. 4-hour competitive
is too punishing for async pattern; 7-day casual feels slow for the
target endgame fantasy. 24h is the Goldilocks: gives players the day to
respond + push notif as reminder.

Per-party setting at creation — non-default players can opt for casual
or competitive.

---

### Q4 — Season length + Battle Pass cadence

Designer-proposed: Tower seasons = **13 weeks (~1 quarter)**. Adventures
weekly boss cadence = **1 week**. Battle Pass cadence = **13 weeks
matching Tower seasons**.

Alternative: weekly Adventures + monthly Tower seasons. **Rejected:**
monthly Tower seasons feel rushed for the depth of TOWER_PACTS rotation
+ Uroboros variants. 13-week seasons match Marvel Snap, Brawl Stars
typical "act"/"season" cadence.

**My recommendation:** **13-week Tower seasons + 1-week Adventures**.
Battle Pass tier-50 progression target: ~10-15 hours of play (matches
Phase 4 target of "100 hour endgame" — 10-15 hours per season × 4 per
year = 40-60 hours / year sustained engagement loop).

---

### Q5 — Friend invite mechanism

Two options:

**Option A** (recommended): **navigator.share OS-native only**. Player
taps "invite friends" → OS share sheet → URL with invite token. Deeplinks
to game.

**Option B** (alternative): **in-game 6-char friend codes**. Player sees
own code + enters another's code.

Question: A only, B only, or both?

**My recommendation:** **A only for MVP**. OS-native share has higher
conversion in tested AAA mobile games. B feels old-school and adds
clutter. If A-only doesn't drive friend-graph growth metrics, layer B
on in Phase 3.5.

---

## 14. Acceptance criteria — design ready

- [x] §0 Overview: 100-hour fantasy + Phase 2 extension narrative
- [x] §1 Architectural fit: hard rules + scope + sacred-system mapping
- [x] §2 Adventures (T3.02–T3.05): create flow + weekly target + contributor stats + clan progression + async hooks + performance
- [x] §3 Party Tower (T3.10–T3.13): async architecture + shared Tower-Hearts + shared TOWER_PACTS + per-turn Identity Layer + async hooks + performance
- [x] §4 Replay/Share (T3.07–T3.09): capture + viewer + share + backend + Codex integration + performance
- [x] §5 Friend leaderboard (T3.06): widget + data + invite + performance
- [x] §6 Tower seasonal (T3.14–T3.15): Uroboros rotation + TOWER_PACTS additions + leaderboard wipes + Battle Pass
- [x] §7 Sacred cow safety audit: 47-row table, 0 modifications planned
- [x] §8 Player Segments: F2P/Minnow/Dolphin/Whale access table + no-P2W invariant
- [x] §9 Performance budgets: explicit + measurable layer-wide
- [x] §10 Implementation dependencies: 16 new files + 7 modify-additively
- [x] §11 Visual regression: 24 new baselines + 1 intentional Codex update
- [x] §12 Test coverage: 7 smoke + 4 unit + 24 visual + manual
- [x] §13 Open questions for Roman: 5 questions (Q1–Q5) with recommendations
- [x] No code written — design only

---

## 15. ROMAN RULING APPENDIX — ESC-03 resolved 2026-05-13

Roman authorized "continue" — all 5 ESC-03 open questions approved per CTO recommendations (mirror of ESC-02 O1–O4 ruling pattern from Phase 2).

| ID | Question | Ruling | Effect on Phase 3 |
|---|---|---|---|
| **Q1** | Adventures clan size hard cap? | ✅ **5–15 HARD CAP, no exceptions** | Whale-tier 5–30 exception rejected per ADR-003 no-P2W; T3.02 enforces hard cap server-side via Firestore security rule |
| **Q2** | Replay storage budget per tier? | ✅ **F2P 100 MB / Minnow 100 MB / Dolphin 250 MB / Whale 500 MB — ALL PERMANENT** | Size-tier differentiation only; no TTL anywhere; PURE PATH parity preserved. T3.07 wires storage tier from `getPlayerSegment()` |
| **Q3** | Party Tower turn timeout default? | ✅ **24h Standard default** | 4h Competitive + 7-day Casual selectable per-party at creation; T3.10 implements 3-mode picker |
| **Q4** | Season cadence? | ✅ **13-week Tower seasons + 1-week Adventures rotation + Battle Pass = Tower** | Sacred Battle Pass formula `500 + (tier-1) × 150` byte-perfect; T3.14 builds 13-week rotation infrastructure |
| **Q5** | Friend invite mechanism? | ✅ **navigator.share OS-native only (MVP)** | In-game 6-char friend codes deferred to Phase 3.5 if friend-graph metrics demand; T3.06 wires share-only flow |

### Phase 3 implementation green-lit per ruling

- T3.02–T3.05 Adventures backend — UNBLOCKED ✅ (clan hard cap 5–15)
- T3.06 Friend leaderboard — UNBLOCKED ✅ (navigator.share only)
- **T3.07 Replay capture — ACTIVE** ✅ (first task per Designer recommendation; permanent storage all tiers)
- T3.08 Replay viewer — UNBLOCKED ✅ (waits on T3.07)
- T3.09 Codex Moments Replay button integration — UNBLOCKED ✅
- T3.10–T3.13 Party Tower — UNBLOCKED ✅ (24h default; async turn-based per ADR-002)
- T3.14–T3.15 Tower seasonal — UNBLOCKED ✅ (13-week seasons; Battle Pass sacred formula byte-perfect)
- T3.16 Legacy Bridge — UNBLOCKED ✅ (mirrors T2.B pattern)

### Sacred cow status after ruling

Phase 3 plan remains **purely additive**. Roman's ruling does NOT change the 47-row sacred audit in §7 — 0 modifications planned. All sacred Tower / Economy / Identity Layer / v2.1 systems remain byte-perfect.

### Quality gates added by ruling

1. **T3.02 server-side clan cap enforcement** — Firestore security rule rejects party-size ≥ 16; Cloud Function audits weekly.
2. **T3.07 storage tier wiring** — capture path reads `getPlayerSegment()` from sacred Phase 1 T1.20 analytics module; storage quota enforced client-side + server-side on upload.
3. **T3.10 turn timeout picker** — 3 modes (4h/24h/7d) selectable; default 24h; no whale-tier reduction below 4h.
4. **T3.14 Battle Pass formula audit** — `500 + (tier-1) × 150` byte-perfect verified pre-merge; tier-cosmetic rewards content-only.

### Phase 3 first task green-lit

**T3.07 Replay capture infrastructure** starts immediately. Designer's strategic recommendation honored — lateral dependency that unblocks Codex Moments Replay button (visible Phase 2 → Phase 3 bridge moment). T3.02 Adventures backend follows after T3.07 PR merges.
- [x] No sacred-cow values modified
- [x] No src/ touched
- [x] No real-time multiplayer (ADR-002 honored)
- [x] No P2W mechanics (ADR-003 honored)
- [x] All new code planned to land in src/ only (ADR-004 honored)

---

**Document version:** 1.0
**Status:** DRAFT — awaiting Roman approval + Q1–Q5 rulings
**Maintainer:** Game Designer agent (T3.01) + CTO

> "Competitive seasonal endgame with async social mechanics." — CLAUDE.md §1.3.
> The 100-hour player logs in tomorrow because their clan is mid-weekly,
> their party owes them a turn, and the season has 11 days left.
