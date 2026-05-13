# Chia Integration — Phase 4 Master Design Spec

**Status:** DRAFT — awaiting Roman approval
**Author:** Game Designer (TASK-060 / T4.01)
**Date:** 2026-05-13
**Phase:** 4 (Chia Integration) — opening task, FINAL planned phase
**Implementation status:** Not started — T4.02–T4.12 implement per this spec
**Mirrors:** `docs/design/mechanics/identity-layer.md` (T2.01) + `docs/design/endgame-social.md` (T3.01) structure + rigor

---

## 0. Overview

Phase 4 ships the **final planned phase** of the Blocksworn 4-phase arc — Chia
blockchain integration as an **endgame layer**, never as monetization-poверх.
This is the layer that completes CLAUDE.md §1.3's locked endgame fantasy: the
100-hour player has Competitive seasonal Tower (Phase 3), Collections (Codex
from Phase 2 + boss/race lore), Upgrades (hero levels/tiers/Mythic from v2.1)
— and now, in Phase 4, **on-chain identity, tradable hero collectibles, and
the wallet-bound social layer** that turn a Blocksworn save into a portable,
provable digital artifact.

The thesis is conservative: Chia integration **adds** an optional dimension
to play. It never removes a F2P path. It never gates content. It never tilts
the combat or progression math. Per ADR-003 strict no-P2W, every Phase 4
design decision answers a single recursive question — **"does this give NFT
players a stat / win-rate / progression advantage?"** — and the answer is
always no.

### How Phase 4 extends Phase 3

Phase 3 (Endgame Social) gave the player **three reasons to log back in
tomorrow** — a clan they belong to, a coop run mid-flight, a seasonal Tower
leaderboard ticking down. Phase 4 layers a fourth: **a tradable on-chain
identity** that the player can carry across devices, transfer to friends,
gift, or sell. Specifically:

- **Adventures (Phase 3 §2)** become the substrate for **Adventure DAO**
  (T4.07). The Phase 3 `clan-backend.js` already implements async clan
  weekly contribution. The DAO variant **gates the clan to wallet-connected
  members**, deploys a DAO descriptor on-chain at clan creation, and grants
  the clan a tradable cosmetic banner NFT. The clan plays the **same**
  weekly boss as non-DAO clans on **shared** Adventures leaderboards. No
  mechanical separation.
- **TOWER_LEADERBOARDS (sacred §2.5 / Phase 3 §6)** gain a fourth column —
  **PURE PATH CHAIN** (T4.08). The existing three columns (GLOBAL CHAMPIONS,
  PURE PATH F2P, CURRENT SEASON) stay byte-perfect. The new column is
  **walleted F2P players** — players who have connected a Chia wallet but
  have lifetime spend of zero. Statistical parity audit (T4.10) verifies
  PURE PATH CHAIN performance is not measurably different from PURE PATH
  F2P; if it is, that signals a P2W leak and triggers ESC.
- **Codex (Phase 2 §4.5 / Phase 3 §4)** gains a new **On-chain Achievements
  tab** (T4.05). Replay capture infrastructure from Phase 3 already supports
  shareable per-moment artifacts; on-chain achievements are the persistent
  identity equivalent — "this player defeated Pyredrake on Season 1 Week 2"
  is mintable, public, and visible on the player's profile forever.
- **Profile screen** (extended T4.04) gains a wallet connection entry
  point. F2P players who never connect a wallet never see the surface; the
  entry point is opt-in by tap, never modal-on-first-launch.

### What 100-hour walleted player has

| Surface | Source | Phase 4 contribution |
|---------|--------|----------------------|
| Solo Tower | v2.1 P9 (sacred) | unchanged |
| Identity Layer + Codex | Phase 2 | unchanged stat-wise; cosmetic NFT skin overlay possible (§2) |
| Adventures (async clan) | Phase 3 | unchanged; **Adventure DAO** variant available (§5) |
| Party Tower (async coop) | Phase 3 | unchanged; DAO members share roster visibility |
| Replay/Share | Phase 3 | unchanged; on-chain achievements are persistent variant (§3) |
| Friend leaderboard | Phase 3 | unchanged |
| Tower seasonal | Phase 3 | **PURE PATH CHAIN** 4th leaderboard column (§6) |
| **NFT-hero mint** | **Phase 4 new** | T4.03 (§2) |
| **NFT-hero trade** | **Phase 4 new** | T4.06 (§2.5) |
| **On-chain achievements** | **Phase 4 new** | T4.05 (§3) |
| **Wallet login** | **Phase 4 new** | T4.02 (§4) |
| **Adventure DAO** | **Phase 4 new** | T4.07 (§5) |
| **PURE PATH CHAIN leaderboard** | **Phase 4 new** | T4.08 (§6) |
| **Mobile feature flag** | **Phase 4 new** | T4.09 (§7) |
| **Anti-P2W audit** | **Phase 4 new** | T4.10 (§8.5) |

Design goal in Execution Plan §9.1: **Chia as endgame layer, not monetization
poверх**. Phase 4 is how a Blocksworn save grows into a provable, tradable
digital artifact — without any non-walleted player ever being mechanically
disadvantaged or hidden from a competitive surface.

### What Phase 4 explicitly does NOT do

- ❌ NO play-to-earn tokens (Execution Plan §9.2 explicit out-of-scope)
- ❌ NO NFT artifacts (artifacts removed in Phase 1 — see T1.14)
- ❌ NO NFT-only content (every NFT hero has F2P equivalent; every NFT
  achievement is achievable F2P)
- ❌ NO wallet-required core flows (FTUE, chapters, Tower, Adventures
  all work without wallet)
- ❌ NO real-money trading inside the game (trades happen on-chain via
  Sage Wallet; Blocksworn surfaces are read-only links)
- ❌ NO NFT stat differentiation (every NFT hero shares the stat block of
  its F2P base — ADR-003 hard invariant)
- ❌ NO Battle Pass shortcuts via NFT ownership (sacred BP formula `500 +
  (tier-1) × 150` byte-perfect)

---

## 1. Architectural fit (hard rules)

| Layer | Granularity | Surface | Source of truth | Touch frequency |
|-------|-------------|---------|-----------------|-----------------|
| **Solo Tower** (v2.1 P9 — sacred) | per-run | tower screen | `src/data/tower.js`, `src/ui/tower.js` | every Tower attempt |
| **Identity Layer** (Phase 2 — sacred-after-ship) | per-line-clear | battle screen | `src/feel/identity-fx.js`, `src/data/identity-layer.js` | 10–40× per battle |
| **Phase 3 social systems** (sacred-after-ship) | varies | adventures/party/replay/friend | `src/services/clan-backend.js`, `src/services/replay-backend.js` | per Phase 3 spec |
| **Wallet login** (Phase 4 new) | per-session | profile + DAO + mint entry points | `src/services/chia-wallet.js` | opt-in only |
| **NFT-hero overlay** (Phase 4 new) | per-hero, per-render | battle screen + select + Codex | `src/services/nft-backend.js`, `src/data/chia-config.js` | per render |
| **On-chain achievement** (Phase 4 new) | per-event | profile + Codex Moments | `src/services/nft-backend.js` (mint path) | rare |
| **Adventure DAO** (Phase 4 new) | per-DAO-clan | adventures screen variant | `src/services/clan-backend.js` (additive flag) | per clan op |
| **PURE PATH CHAIN** (Phase 4 new) | per-season | tower leaderboard | `src/data/tower.js` (additive read-only entry) + `src/services/clan-backend.js` (eligibility filter) | per season |
| **Mobile feature flag** (Phase 4 new) | compile-time + runtime | every Chia entry point | `src/services/feature-flags.js` | every UI guard |

### Hard rules (the recursive question)

Every Phase 4 design element MUST answer:

> **"Does this give NFT-owning / wallet-connected players a mechanical,
> progression, or win-rate advantage over F2P web players?"**

If the answer is **yes**, the design is **REJECTED**. There is no
exception path. ADR-003 §3-4 is the canonical reference; this spec
re-applies the test at every section boundary.

1. **ADR-003 strict no-P2W is THE central invariant.** NFT heroes are
   cosmetic + identity + tradable + never stat-boosted (§2). On-chain
   achievements are cosmetic + identity + never stat-boosted (§3).
   Wallet login confers no gameplay benefit (§4). Adventure DAO is
   cosmetic-rewarded (§5). PURE PATH CHAIN is a parity surface, not a
   reward surface (§6). The compliance audit in §8.5 verifies empirically.

2. **ADR-002 async-only honored.** Adventure DAO is an async clan
   (T3.02–T3.05 substrate). No real-time wallet sync; no in-game
   wallet polling beyond opt-in checks. Wallet connect is a discrete
   user action; NFT mint is a discrete user action; trades happen
   off-game on Sage Wallet.

3. **ADR-004 src/ only.** All new Phase 4 code lands in `src/`. Legacy
   stays primary runtime per Phase 1 closeout. Phase 4 features integrate
   via the same window-bridge pattern Phase 2-3 established (T2.B + T3.16),
   exposed by a future T4.13 Legacy Bridge task if needed.

4. **Mobile feature flag gates every Chia entry point** (§7). Future
   mobile builds set `CHIA_ENABLED=false` at compile time; runtime
   `isChiaEnabled()` returns false; every wallet / mint / DAO / on-chain
   UI surface returns null from its render function. Mobile smoke tests
   verify zero Chia DOM is created.

5. **Wallet login is OPTIONAL.** A F2P web player who never taps "Connect
   Wallet" in their profile never sees wallet UI. The wallet entry point
   is one button in one screen (profile) — not a launcher modal, not a
   FTUE step, not a forced overlay.

6. **No sacred-cow numeric changes.** TOWER_LEADERBOARDS gains a 4th
   read-only frozen entry (`f2p_walleted` / PURE PATH CHAIN); the
   existing 3 entries (`global`, `f2p_only`, `weekly_seasonal`) stay
   byte-perfect. HERO_ROSTER stat blocks unchanged. Battle Pass formula
   `500 + (tier-1) × 150` unchanged. GEM_PACKS / First Purchase Bonus /
   Tower retry ladder `[100, 200, 400]` unchanged. NFT minting cost is
   a separate Chia-network-fee concern, NOT a Battle Pass tier.

7. **Closed beta before production.** Per Execution Plan §9.5 the
   100+ crypto user closed beta (T4.11) is mandatory between
   implementation completion and production launch (T4.12). No
   shortcuts. No "launch and patch."

### Scope: 6 new files + 4 modified additively

Per Execution Plan §9.2 + §16 the Phase 4 deliverables map to:

- Wallet integration → `src/services/chia-wallet.js` + `src/ui/wallet-connect.js`
- NFT operations → `src/services/nft-backend.js` + `src/ui/nft-mint.js`
- DAO variant → `src/ui/dao-adventures.js` (UI) + `src/services/clan-backend.js` (additive flag)
- Feature flag → `src/services/feature-flags.js`
- Config → `src/data/chia-config.js`

The 5 modify-additively files (`src/services/analytics.js`, `src/data/tower.js`,
`src/services/clan-backend.js`, `src/ui/profile.js`, `src/ui/tower.js`) gain
only new exports / new branches behind feature flag — no existing logic
modified, no sacred values touched.

---

## 2. NFT-hero data model (T4.02–T4.06)

> Execution Plan §9.2: "NFT-герои (skin + history + ascension binding,
> tradable)". ADR-003 §3-4 is the canonical no-P2W contract.

### 2.1 Sacred constraint: stat-block identity

**Every NFT hero has the identical stat-block of its non-NFT base
counterpart.**

Specifically, for every NFT hero `nft_hero_X`:

```
nft_hero_X.hp           === base_hero_X.hp           // sacred MAX_HP=100 if applied
nft_hero_X.dmg          === base_hero_X.dmg
nft_hero_X.ultCost      === base_hero_X.ultCost      // sacred HERO_ULT_COST_BY_NEWROLE
nft_hero_X.tierAbility  === base_hero_X.tierAbility  // sacred HERO_TIER_ABILITIES
nft_hero_X.race         === base_hero_X.race         // sacred RACE_SYNERGY tier participation
nft_hero_X.element      === base_hero_X.element      // sacred element synergy participation
nft_hero_X.role         === base_hero_X.role
nft_hero_X.passive      === base_hero_X.passive
nft_hero_X.signature    === base_hero_X.signature    // sacred 4-channel damage
nft_hero_X.staggerTrigger === base_hero_X.staggerTrigger // sacred Stagger Loop
```

Implementation note: `nft_hero_X` is **not a separate hero record**. It is
the **same** record in `HERO_ROSTER` (sacred `src/data/heroes.js`) with a
**cosmetic skin overlay** applied at render time. Per ADR-003 §4 ("every
NFT hero has F2P stat-equivalent"), the NFT is a layer **on top of** an
owned hero, not a parallel hero entity.

The NFT record itself lives off-chain (in `src/services/nft-backend.js`
state) as a binding:

```js
// Conceptual schema — DO NOT IMPLEMENT IN THIS DOC; this is design intent
{
  nftId:       'chia:bls:abc...',   // on-chain NFT identifier (NIP-XX)
  heroId:      'pirate_warrior_t1', // sacred HERO_ROSTER key
  variantId:   'pirate_warrior_t1_redfang_skin', // cosmetic variant id
  ownerPuzzleHash: '0xabc...',      // current Chia owner
  mintedAt:    1747140000000,       // mint timestamp (used for "minted Season N" provenance)
  mintedBy:    'genesis_wallet',    // original minter (provenance)
  ascensionBinding: null,           // OR specific ascension event id (§2.4)
  seasonOfMint: 'season_1',         // for Codex display
}
```

Crucially, this binding **never** writes back to `HERO_ROSTER`. The stat
block stays sacred; the binding is read at render time to apply visual
overlay.

### 2.2 What NFTs confer (cosmetic + identity + trade + provenance)

Per ADR-003 §3, NFT heroes confer four orthogonal value dimensions, none
mechanical:

1. **Visual skin variant** — unique art asset, particle accent color,
   voice-line variant. Examples:
   - `pirate_warrior_t1` base sprite + Redfang NFT skin = same hero, new
     visual identity. Combat behavior identical.
   - `pirate_warrior_t1` ULT particle accent: base = ember-orange; NFT
     Redfang variant = crimson-with-gold-flecks. Same damage, same
     screen-shake, same haptic.
   - `pirate_warrior_t1` voice line "I came back from the dead!" on
     Phoenix revive: base voice = generic pirate; NFT variant = unique
     Redfang voice actor.

2. **Provenance / history** — on-chain mint date, ownership chain,
   Season-of-mint badge visible in Codex. Concrete example:
   - "Redfang #1 — minted Season 1, Week 3 — original owner: Roman"
   - Codex display shows the on-chain timeline (mint → transfer → current
     owner) as a vertical history feed.

3. **Trade-ability** — on-chain transfer / sale via Sage Wallet. This is
   the actual NFT utility:
   - Player A owns Redfang #1, wants to gift to Player B → A initiates
     on-chain transfer in Sage Wallet → B's Blocksworn save now displays
     Redfang skin on Pirate Warrior on next wallet refresh.
   - Trade happens **off-game** on Sage Wallet UI. Blocksworn does NOT
     embed a marketplace. Blocksworn displays "View on Sage Wallet" links
     and listens for `transfer` events from the on-chain backend.

4. **Ascension binding** — if owner ascends the bound hero to Mythic
   (sacred v2.1 P9 Mythic mechanic), the NFT permanently records the
   ascension event. The NFT becomes "Redfang #1 — Mythic Ascension Season
   2". Sacred Mythic mechanics are completely unchanged; the NFT only
   records the event as on-chain provenance.

### 2.3 What NFTs do NOT confer (the anti-P2W invariant)

Per ADR-003 §4, NFT heroes do NOT confer:

- ❌ Higher HP than F2P-equivalent base hero
- ❌ Higher damage / crit chance / ULT effectiveness than base
- ❌ Faster ULT charge rate than base
- ❌ Exclusive HERO_TIER_ABILITIES branches
- ❌ Exclusive race / element synergy participation (NFT Redfang Pirate
  participates in the SAME `ember` element synergy as base Pirate)
- ❌ Higher win-rate in Tower / Adventures / Party Tower
- ❌ Faster chapter progression
- ❌ Battle Pass tier-up shortcuts
- ❌ Tower-Hearts retry advantage (sacred ladder `[100, 200, 400]` unchanged)
- ❌ More TOWER_PACTS draws per run
- ❌ More Adventure DAO contribution cap (per-member weekly cap shared
  identically between DAO and non-DAO clans — see §5.3)
- ❌ Larger Party Tower party slots (sacred 5 max unchanged)
- ❌ Faster Adventure DAO weekly defeat (clan progression math identical)
- ❌ Any mechanical content gated only behind NFT ownership

The Phase 3 PURE PATH parity audit (Phase 3 §8.3) extends in Phase 4 with
the additional PURE PATH CHAIN vs PURE PATH F2P comparison (§8.5). If
walleted F2P players show measurably different Tower performance, the
NFT system has leaked stat advantage — that is a P2W bug triggering
immediate ESC.

### 2.4 Mint flow (T4.03)

**Goal:** a player with an owned F2P hero in their roster pays a small
Chia mint fee (network gas + optional Blocksworn cosmetic premium) and
binds an NFT cosmetic variant to that hero record.

**Flow:**

```
┌─────────────────────────────────┐
│  ← PROFILE                      │
│  Wallet: chia1abc…xyz (connected)│
├─────────────────────────────────┤
│  YOUR HEROES (25 owned)         │
│                                 │
│   ┌────────────────────┐        │
│   │ PIRATE WARRIOR T1  │   [⚒]  │ ← mint button (only if wallet)
│   └────────────────────┘        │
│   ┌────────────────────┐        │
│   │ SHARK SCOUT T2     │   [⚒]  │
│   └────────────────────┘        │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  MINT NFT VARIANT               │
├─────────────────────────────────┤
│  Base: Pirate Warrior T1        │
│  Variant: ⬇ Redfang             │
│           ⬇ Saltwater Scourge   │
│           ⬇ Goldlust            │
│                                 │
│  Mint fee: 0.0001 XCH + 0.01 XCH│
│  (gas + Blocksworn cosmetic)    │
│                                 │
│  ⚠ NFT is COSMETIC ONLY.        │
│  Stats unchanged. No P2W.       │
│                                 │
│   [CANCEL]   [MINT VIA SAGE]    │
└─────────────────────────────────┘
```

**Field-level spec:**

1. **Hero eligibility** — only heroes the player has **already unlocked**
   in their F2P save can be minted. NFT minting is not a path to acquire
   new heroes (that would gate mechanical content behind NFT — P2W
   violation). It is purely a cosmetic skin layer on an owned hero.
2. **Variant catalog** — `src/data/chia-config.js` defines the variant
   catalog per hero. Each variant: id, hero binding, art asset path, voice
   line set path, particle accent color, mint price (in mojos).
3. **Mint fee schedule** — see Q2 below for Roman ruling on premium
   structure. Default proposal: 0.0001 XCH network gas + 0.01 XCH cosmetic
   premium (variable per variant rarity — common 0.01, rare 0.1, legendary
   1.0). Premium flows to Blocksworn treasury wallet; gas to Chia
   network. **NO part of the premium scales hero stats** — premium tiers
   are purely visual rarity tiers (common = standard skin; legendary =
   unique animations + accent + voice).
4. **Mint transaction** — Blocksworn UI hands off to Sage Wallet via
   walletconnect-style transaction proposal. Sage shows the user the
   transaction details + fee breakdown. User approves in Sage. Blocksworn
   subscribes to the transaction settlement event and updates UI on
   confirmation (~30s p99 on Chia testnet realistic).
5. **Idempotency** — if user closes the app mid-mint, the transaction
   continues on-chain. Reopening Blocksworn re-syncs from on-chain state
   on wallet reconnect. No client-side mint state to lose.
6. **F2P parity invariant in the mint flow** — the "Pirate Warrior" the
   F2P player plays and the "Pirate Warrior with Redfang skin" the NFT
   player plays are the **same hero**, with the **same stats**, in the
   **same Tower / Adventures / Party Tower / Codex** surfaces.

**Backend (`src/services/nft-backend.js`):**

- Local cache: maps `heroId → { activeSkin: variantId | null, ownedNfts: [...] }`
- Sync: on wallet connect, fetch all NFTs owned by puzzlehash matching
  Blocksworn NFT namespace from Chia full-node RPC OR a Blocksworn-run
  indexer (see Q4 for storage strategy).
- Apply: at hero render time (battle screen, select screen, Codex),
  `getActiveSkin(heroId)` consults the cache; if a NFT skin is bound,
  the variant art / voice / particle is overlaid; else the base sprite
  renders. Default branch is base sprite (F2P-equivalent always renders).

**Performance budget:**

- Wallet sync after connect: ≤3s p99 (background; spinner allowed).
- Hero render with skin lookup: ≤1ms additional per render (cache hit).
- Variant asset preload: at wallet connect time, all owned variants
  prefetched in parallel; total preload ≤2s for 25 owned variants.

### 2.5 Trade flow (T4.06)

**Goal:** a player owning a Blocksworn NFT can transfer it on-chain to
another player. Blocksworn provides discovery + display, **not** a
marketplace.

**Flow:**

```
Player A → Profile → NFT Inventory → tap "Redfang #1"
  → modal: "VIEW ON SAGE WALLET" + "TRANSFER" + "VIEW ON CHIA EXPLORER"
  → tap "TRANSFER" → Sage Wallet opens with prefilled NFT-transfer
    transaction → A approves → Sage handles wallet selection / scan QR
  → on-chain transfer settles ~30s
  → Player B's Blocksworn on next wallet sync sees Redfang #1 in their
    NFT inventory → can apply to their Pirate Warrior hero (if owned)
```

**Field-level spec:**

1. **No in-game marketplace** — Execution Plan §9.2 says NFT-героев
   "tradable" but does not specify in-game marketplace. To preserve
   ADR-003 no-P2W posture and avoid regulatory complexity (in-game
   real-money trading is a separate jurisdiction issue), trade is
   off-game on Sage Wallet.
2. **Discovery links** — `navigator.share` style "View this NFT on Sage
   Wallet" deep link + "View on Chia Explorer" public block-explorer
   link. Both open in external browser.
3. **Transfer recipient** — handled by Sage Wallet UI (recipient address
   entry, QR scan, contact list). Blocksworn does not store
   recipient-address books.
4. **Settlement listener** — `nft-backend.js` subscribes to Chia
   block-events for the player's puzzlehash. On settle (incoming or
   outgoing transfer), local cache updates + UI re-renders + analytics
   event logged.
5. **Cross-NFT-platform compatibility** — Blocksworn NFTs use the
   standard Chia NFT1 spec (NIP-XX). Any wallet supporting NFT1 can
   display them. Blocksworn is **not** a closed-NFT-platform; secondary
   markets emerge on Sage / Chia Spacescan / Mintgarden naturally.
6. **No royalty enforcement at the protocol level** — Chia NFT1 supports
   optional royalty metadata; Blocksworn sets a 2.5% royalty to the
   Blocksworn treasury wallet in mint metadata. Honor is voluntary at the
   marketplace level per Chia ecosystem norm. See Q2 below.
7. **Provenance preservation** — the on-chain mint record persists
   forever. If Roman retires the project, NFTs still exist on Chia and
   remain transferable / displayable by any NFT1-compatible wallet
   indefinitely. This is the "true digital ownership" framing.

**Backend changes (in `nft-backend.js`):**

- `getOwnedNfts(puzzleHash) → Promise<Nft[]>` — fetch owned NFTs from
  indexer
- `subscribeToTransfers(puzzleHash, callback)` — block-event listener
- `applyNftSkin(heroId, nftId)` — local cache write (no on-chain op;
  binds the skin to a hero in the player's save)
- `unapplyNftSkin(heroId)` — revert to base sprite
- `buildTransferProposal(nftId, recipient)` — prepares Sage Wallet
  transaction; does NOT submit (Sage submits)

**Performance budget:**

- NFT inventory fetch: ≤3s p99
- Transfer proposal build: ≤1s
- Settlement listener latency: opportunistic (Chia block time ~52s; we
  detect on next block after settle)

### 2.6 Founder Badge (soft-launch NFT, T4.04)

**Goal:** reward early closed-beta testers (T4.11 cohort) with a
cosmetic-only commemorative NFT. Same no-P2W constraint as all other
NFTs.

**Field-level spec:**

1. **Eligibility** — closed beta participants (T4.11: 100-300 testers
   per Execution Plan §9.5). Identified by analytics tracking event
   `closed_beta_participant=true` over a defined participation window.
2. **Distribution** — see Q3 below. Designer-recommended: **gift at
   mainnet launch (T4.12 Wave 1)**, sent to participating wallet
   addresses by Blocksworn treasury, no claim flow required.
3. **Display** — appears in profile as "Founder" cosmetic badge. Visible
   to other players in friend leaderboard / clan member list / Tower
   leaderboard entry. **Cosmetic only**. No mechanical effect.
4. **Trade-ability** — yes, fully transferable per the same NFT1 spec
   as hero NFTs. A Founder Badge can be sold / gifted; the receiver
   then displays it.
5. **Mint cap** — limited supply equal to actual closed-beta cohort
   size (100-300). After mainnet launch, NO new Founder Badges are
   minted — supply is finite. Future "Founder" cosmetics use distinct
   identifiers ("Season 2 Founder", etc.).

**Per ADR-003 compliance check:**
- Cosmetic only ✓
- Identity / status only ✓
- No stat impact ✓
- F2P players who weren't in closed beta can still acquire one via
  secondary market trade ✓

---

## 3. On-chain achievements (T4.05)

> Execution Plan §9.2: "On-chain achievements (которые игрок показывает
> другим)". ADR-003: achievement-as-cosmetic, never as stat boost.

### 3.1 Concept

When a player accomplishes a notable in-game event (boss defeat, Tower
floor clear, season top-100 finish, etc.), Blocksworn offers to mint
that achievement as an on-chain record. The minted NFT is a permanent,
shareable, tradable proof — visible in the player's profile achievement
wall and on the Codex Moments tab.

This is **identity / status only**. Owning a "Defeated FLAME ITSELF in
Season 1 Week 2" achievement gives the player **zero in-game advantage**.
It's a flex, a souvenir, a piece of provable participation.

### 3.2 Catalog (`src/data/chia-config.js`)

The achievement catalog is curated, not open-ended. Each entry:

```js
{
  achievementId: 'defeated_pyredrake_first_kill',
  triggerEvent:  'boss_defeated',
  triggerData:   { bossId: 'pyredrake', isFirstKillOnAccount: true },
  displayName:   'Pyredrake Slayer',
  displayLore:   '"The first dragon falls. Many follow."',
  rarity:        'common',  // common | rare | legendary | seasonal
  mintFeeMojos:  1_000_000_000_000,  // 0.001 XCH cosmetic
  badgeAsset:    'badges/pyredrake_slayer.png',
}
```

**Initial catalog scope (Phase 4 V1):**

- **Per-boss first-kill** — 25 entries (chapter bosses + Tower mythics).
- **Tower milestones** — Floor 25 / 50 / 100 / endless mode entry / top-1
  season finish (PURE PATH or PURE PATH CHAIN); 5 entries.
- **Adventures milestones** — clan-founder, weekly-defeat-contributor
  top-3, clan-progression Tier 5; 3 entries.
- **Party Tower milestones** — first party run, first party run with
  5-member full party; 2 entries.
- **Identity Layer milestones** — Codex unlocks 5/5 races, 7/7 boss
  archetypes; 2 entries.
- **Closed beta** — Founder Badge per §2.6; 1 entry.
- **Seasonal** — top-1 / top-10 / top-100 finishes per season per
  leaderboard column (4 leaderboard columns × 3 tiers = 12 per season);
  designed to accumulate over years.

**Total V1 catalog: ~40 achievements + seasonal recurring.**

### 3.3 Mint flow

**Trigger:** in-game event matches a catalog entry's `triggerEvent`
+ `triggerData`.

```
┌─────────────────────────────────┐
│  ACHIEVEMENT UNLOCKED            │
├─────────────────────────────────┤
│  Pyredrake Slayer                │
│  "The first dragon falls.        │
│   Many follow."                  │
│                                 │
│  [VIEW IN CODEX]                │
│  [MINT ON-CHAIN — 0.001 XCH]    │  ← only if wallet connected
└─────────────────────────────────┘
```

**Field-level spec:**

1. **Mint is opt-in.** The achievement is always recorded in the local
   Codex Moments (Phase 2 §4.5 + Phase 3 replay capture). Minting
   on-chain is the **optional** persistence step.
2. **Wallet required for mint.** F2P web players see only the Codex
   Moments entry. The "MINT ON-CHAIN" button is hidden behind
   `isChiaEnabled() && walletConnected`.
3. **Free-tier minting?** — Q4 below. Designer proposal: small mojos
   fee covers Chia gas + minimal Blocksworn cosmetic premium. No free
   minting (each mint is gas-real on Chia mainnet).
4. **Idempotency / one-shot** — each achievement is mint-able once per
   account per trigger. Re-clearing Pyredrake doesn't re-prompt for
   another mint of the same first-kill achievement. Reaching a new
   milestone (e.g., second-kill = nothing; Tower Floor 100 = new
   achievement) triggers separately.
5. **Tradable** — yes, per NFT1 standard. Achievements can be sold /
   transferred. Receiver displays the achievement on their profile,
   but the on-chain mint date remains the original; secondary owners
   see "minted by chia1abc… on 2026-06-15".

### 3.4 Profile display

The profile screen's **Achievement Wall** subsection displays all
on-chain achievements owned by the connected wallet. Each badge shows:

- Badge art
- Name + lore
- Mint date
- "View on Chia Explorer" link
- Provenance (current owner if transferred)

Layout: grid (3-4 per row on mobile, 5-6 on desktop). Sortable by
rarity / mint date / category.

F2P players (wallet-not-connected) see a different profile section: a
**Codex Moments timeline** (Phase 3 §4.5) with no on-chain badges. Same
information density, different surface — and the F2P player can connect
wallet at any time to surface the on-chain dimension.

### 3.5 Storage metadata (open Q4)

On-chain achievement metadata (the badge URI, lore, mint date) needs to
be persistently retrievable for any future Blocksworn client to display
them. Options:

- **On Chia (NFT1 native)** — metadata in the NFT URI field, IPFS-style
  hash, badge art on IPFS. Maximally decentralized. Highest storage
  cost.
- **IPFS-only metadata** — badge art on IPFS, metadata mirror on IPFS,
  on-chain pointer is IPFS hash. Decentralized, cheaper than on-Chia.
- **Hybrid** — metadata on IPFS, art on IPFS, **on-chain mint date +
  achievement id only** (lightweight). Cheapest. Blocksworn UI fetches
  IPFS asset on display.
- **Centralized backend mirror** — Blocksworn-hosted, faster fetch, but
  goes offline if Blocksworn retires.

Designer recommendation: **Hybrid (Option C)**. On-chain stores
achievement id + mint timestamp + minter; IPFS stores art + lore;
Blocksworn UI fetches both. Achievements remain displayable indefinitely
even if Blocksworn retires — any client can read on-chain + IPFS.

See Q4 below for Roman ruling.

### 3.6 Anti-P2W invariant check

Per ADR-003 §4:

- ❌ Achievements do NOT confer stat boosts
- ❌ Achievements do NOT confer faster progression
- ❌ Achievements do NOT confer exclusive content access
- ❌ Achievements do NOT confer Battle Pass tier shortcuts
- ❌ Achievements do NOT confer Tower-Hearts / TOWER_PACTS advantages

Achievements **confer**:
- ✓ Identity / status (badge on profile)
- ✓ Provenance (verifiable timestamp / minter)
- ✓ Trade-ability (NFT1 secondary market)
- ✓ Lore display in Codex Moments

The same achievement is accessible on-screen-only to F2P players via
Codex Moments. The on-chain mint just **makes it portable / provable /
tradable** — the achievement itself is identical content.

---

## 4. Wallet login flow (T4.02)

> Execution Plan §9.2: "Wallet login (опциональный, не required для core
> game)". Sage Wallet OR Chia Wallet (Q1).

### 4.1 Wallet support matrix

| Wallet | Status | Notes |
|--------|--------|-------|
| Sage Wallet | Primary (Q1 default) | Chia-native, walletconnect-style proposals, mature SDK |
| Chia Wallet (reference) | Secondary (Q1 alt) | Official Chia desktop wallet; SDK less mature |

See Q1 below for Roman ruling on V1 support scope. Designer recommendation:
**Sage primary, Chia secondary**.

### 4.2 Connect flow

**Entry point:** one button in profile screen ("Connect Wallet"). Never
modal-on-launch, never blocking, never auto-prompted. The profile screen
shows this entry **only** if `isChiaEnabled() === true`.

```
┌─────────────────────────────────┐
│  PROFILE                         │
├─────────────────────────────────┤
│  [avatar + display name]        │
│  Total spent: $0 (PURE PATH)    │
│                                 │
│  ┌───────────────────────────┐  │
│  │  🔗 CONNECT WALLET        │  │ ← shown only if !walletConnected
│  └───────────────────────────┘  │
│                                 │
│  Codex Moments → [...]          │
│  Friend leaderboard → [...]     │
└─────────────────────────────────┘

→ tap → wallet picker modal:
┌─────────────────────────────────┐
│  CONNECT A CHIA WALLET           │
├─────────────────────────────────┤
│  ⬇ SAGE WALLET                  │
│  ⬇ CHIA WALLET (REFERENCE)      │
│                                 │
│  Wallet is OPTIONAL.            │
│  Disconnect anytime.            │
│  No stat advantage from         │
│  connecting.                    │
│                                 │
│  [CANCEL]                       │
└─────────────────────────────────┘

→ tap Sage → handoff to Sage Wallet (browser extension OR mobile app)
  → Sage prompts user for signature on connection nonce
  → User approves → wallet returns puzzle hash + display address
  → Blocksworn UI updates: "Connected: chia1abc…xyz"
  → background: nft-backend syncs owned NFTs (≤3s p99)
```

### 4.3 Session lifecycle (V1)

**Per task brief: wallet connection is session-only for V1 — no
remembered tokens; explicit re-connect each session.**

Rationale:
- Security default: no persistent wallet binding means no compromised-save
  → compromised-wallet attack surface.
- Honest framing: the player chooses to connect each session; if they
  don't want wallet UX today, they don't see it.
- Simpler audit: on-screen wallet state is always "I tapped Connect this
  session" — never "I tapped Connect months ago and forgot".

Lifecycle:

```
session start → Blocksworn loads → wallet state: DISCONNECTED
   ↓
user taps Connect → wallet picker → handoff → wallet signs nonce → connected
   ↓
session: wallet state CONNECTED; NFT sync happens; UI surfaces enabled
   ↓
user closes tab / reloads → wallet state: DISCONNECTED again
   ↓
next session: user taps Connect again (one-tap if Sage extension stays
  unlocked; full signature flow if not)
```

**Disconnect flow:** profile screen "Disconnect" button always available
when connected. Tap → local state cleared → UI re-renders to F2P
equivalent (no NFT skins applied, no Achievement Wall, no PURE PATH
CHAIN eligibility, no DAO clan visibility if member of one).

**Reconnect parity:** disconnecting does **NOT** un-mint NFTs / achievements
(those live on-chain forever). On reconnect, the same NFTs / achievements
re-surface.

### 4.4 What wallet connection enables

When wallet is connected:
- NFT inventory visible in profile
- Hero skins applied at render
- On-chain Achievement Wall visible
- Mint button surfaced in Codex Moments + Profile NFT inventory
- Adventure DAO surface available (if member of one)
- PURE PATH CHAIN leaderboard column rendered + eligibility tested

When wallet is disconnected:
- All of the above absent
- Player still has full F2P access to all gameplay
- Codex Moments still recorded locally (Phase 3 §4.5)
- Player still appears on PURE PATH F2P leaderboard if `totalSpent === 0`
  (this is the sacred Phase 3 leaderboard; PURE PATH CHAIN is the new
  Phase 4 leaderboard for the "F2P + wallet" intersection)

### 4.5 Anti-confusion design

The wallet connection surface MUST be unambiguously clear about scope:

- "Wallet connected" indicator is a small badge in profile (icon + first
  6 + last 4 of address). Never overlay on battle / main gameplay.
- Connect modal copy explicitly states "no stat advantage from
  connecting" + "disconnect anytime" + "optional".
- Wallet operations (mint, trade) ALWAYS gate on confirmation modal with
  fee breakdown.
- If wallet has no NFTs and no achievements, profile shows empty-state
  copy: "Your wallet is connected. Mint your first Blocksworn NFT or
  on-chain achievement to begin a collection."

### 4.6 Backend (`src/services/chia-wallet.js`)

API surface (design intent — actual implementation in T4.02):

```js
// Conceptual — DO NOT IMPLEMENT IN THIS DOC
export async function connectWallet(provider /* 'sage' | 'chia' */)
export async function disconnectWallet()
export function isWalletConnected()
export function getConnectedAddress()
export function getConnectedPuzzleHash()
export async function signNonce(nonce)
export async function proposeMintTransaction(metadata)
export async function proposeTransferTransaction(nftId, recipient)
export function subscribeToWalletEvents(callback)
```

**Performance budget:**
- Connect handshake (excluding user signature time): ≤3s p99
- Wallet status check (after connect): ≤500ms (cached)
- Disconnect: instant (local state clear)
- NFT inventory refresh: ≤3s p99 after connect

---

## 5. Adventure DAO (T4.07)

> Execution Plan §9.2: "Adventure DAO (wallet-gated)". Extension of
> Phase 3 §2 Adventures. NEVER mechanical advantage over non-DAO clans.

### 5.1 Concept

Adventure DAO is an **opt-in variant of an async clan**. The core clan
loop (async 5-15 members, weekly boss-of-the-week, contribution-based
weekly defeat) is identical to non-DAO Adventures (Phase 3 §2). The
**only** differences in a DAO clan are:

1. **All members must have connected wallet** (gated at join time).
2. **Clan creator pays a small Chia mint fee** at clan creation to
   deploy a DAO descriptor on-chain.
3. **Clan receives a tradable cosmetic banner NFT** owned by the
   creator (transferable to next-captain if creator departs).
4. **Member badges** are cosmetic NFT-bound (each member receives a
   "Member of <clan-name> Season N" cosmetic on-chain mint, optional).
5. **DAO clans and non-DAO clans share the same Adventures leaderboards
   and weekly boss rotation.** No mechanical separation, no separate
   pool, no separate weekly target.

Critically, **DAO clans get NO weekly-defeat advantage**. They share the
same boss-of-the-week HP scaling, the same per-member contribution caps,
the same reward distribution. The DAO is **cosmetic / identity** — the
on-chain banner is a flex, not a buff.

### 5.2 Create flow (DAO variant of Phase 3 §2.1)

```
┌─────────────────────────────────┐
│  ← ADVENTURES                   │
├─────────────────────────────────┤
│   ┌─────────────────────────┐   │
│   │  + START AN ADVENTURE   │   │ ← Phase 3 standard
│   └─────────────────────────┘   │
│   ┌─────────────────────────┐   │
│   │  + START A DAO ADVENTURE│   │ ← Phase 4 NEW (only if wallet)
│   └─────────────────────────┘   │
│   ┌─────────────────────────┐   │
│   │  ✓ JOIN BY CODE         │   │
│   └─────────────────────────┘   │
│   ┌─────────────────────────┐   │
│   │  🔥 BROWSE PUBLIC (5)   │   │
│   └─────────────────────────┘   │
└─────────────────────────────────┘
```

Tapping "+ START A DAO ADVENTURE" opens the Phase 3 standard clan
creation flow with two additional steps:

1. **Wallet check** — if not connected, prompt connect flow (§4).
2. **Mint fee disclosure** — modal showing the on-chain DAO descriptor
   mint fee (e.g., 0.05 XCH) + the recurring weekly per-member badge
   mint fee (optional; opt-in per member; e.g., 0.001 XCH per badge).
3. **Mint** — handoff to Sage Wallet for the DAO descriptor mint
   transaction. On settle, clan is created with `daoMode: true` flag in
   the Firestore document.

### 5.3 Join flow (DAO variant)

```
Player taps "Join by code" → enters DAO clan code
  → server returns clan metadata + DAO=true flag
  → if player wallet not connected: error "DAO clans require wallet"
  → if connected: join confirmation + optional "Mint member badge"
  → confirm → joined; weekly contribution counter starts at 0
```

**Sacred no-P2W:** the per-member weekly contribution cap is **identical**
to non-DAO clans: `2 × baseBossHp` (Phase 3 §2.2 sacred). DAO members
do NOT get higher caps. They do NOT solo-defeat the weekly boss faster.
Their contribution math is byte-identical to non-DAO members.

### 5.4 Rewards (DAO variant)

When a DAO clan defeats its weekly boss:

- **Standard Adventure rewards** (Phase 3 §2.2 — Tower Hearts, gold,
  essence, Adventure XP, Codex defeat record). **Identical to non-DAO
  clans.**
- **DAO-specific cosmetic** — clan banner NFT gains a "Season N weekly
  defeat" lore stamp (purely visual; no stat impact). The banner is
  owned by the clan creator wallet.
- **Optional member commemorative** — members can opt to mint a "Season
  N Week K weekly-defeat participant" cosmetic NFT for themselves
  (small Chia mint fee). Opt-in.

**No DAO-only mechanical rewards.** No higher Tower Hearts payout. No
higher gold payout. No bonus essence. No bonus Adventure XP. No DAO-only
boss content. The DAO is **identity** — being a verifiable on-chain
clan member is the value, not the mechanical reward.

### 5.5 Cross-clan competition surface

DAO clans and non-DAO clans co-mingle:

- Same Adventures weekly boss-of-the-week rotation (Phase 3 §2.2 §2.3).
- Same Adventures public browse list (DAO clans get a small "⛓" icon
  next to their name as identity, not as filter).
- Same Friend leaderboard graph (DAO members can be friends with
  non-DAO members).
- Same clan progression tier rules (Phase 3 §2.4 — DAO clans level up
  by Adventure XP same as non-DAO).

The PURE PATH CHAIN leaderboard (§6) is the **only** surface where DAO
members are functionally segregated from non-DAO walleted F2P players,
and that's a separate Tower leaderboard column — not an Adventures
column. Adventures stays unified.

### 5.6 Disband / Captain transfer

- **DAO captain transfer** — when the current captain (clan creator)
  leaves, the next-longest-member becomes captain via Phase 3 founder
  inheritance rules (Phase 3 §2.1 — needs an Open Q for the
  inheritance rule still since Phase 3 §2 §2.1 may have Q1). The banner
  NFT transfers on-chain to the new captain's wallet automatically
  (using a pre-deployed transfer cclause OR a server-side mint-and-burn
  helper — see Q4).
- **DAO disband** — if all members leave, the banner NFT remains in
  the last captain's wallet as a memento. The Firestore clan doc is
  archived (Phase 3 §2.5). On-chain DAO descriptor remains forever as
  provenance.

### 5.7 Backend changes (`src/services/clan-backend.js` additive)

Phase 3 `clan-backend.js` already implements the async clan substrate.
Phase 4 adds **only**:

- Field `daoMode: boolean` to `adventures/{advId}` Firestore document.
- Field `daoDescriptorOnChainId: string | null` to clan doc.
- Field `daoBannerNftId: string | null` to clan doc.
- Field `daoMemberBadgeNftId: string | null` to per-member subdoc.
- Branch in clan-create: if `daoMode === true`, validate wallet
  connected on creator + run mint flow.
- Branch in clan-join: if `daoMode === true`, validate wallet
  connected on joiner + reject if not.

**No** modification to Phase 3 sacred clan logic: weekly contribution
calculation byte-identical, reward distribution byte-identical, member
list display byte-identical. The `daoMode` flag affects only
**gating** and **cosmetic overlay**, never gameplay.

### 5.8 Performance budgets

- DAO descriptor mint: ≤30s p99 (Chia testnet realistic)
- DAO clan join validation (wallet check + Firestore read): ≤500ms p99
- Banner NFT inheritance transfer on captain change: ≤30s p99
- DAO clan list browse: same as Phase 3 (≤300ms FCP)

---

## 6. PURE PATH CHAIN leaderboard (T4.08)

> CLAUDE.md §2.5: TOWER_LEADERBOARDS sacred. Phase 4 adds a fourth
> column as a NON-DESTRUCTIVE additive expansion.

### 6.1 The four columns

| Column | Status | Eligibility | Source |
|--------|--------|-------------|--------|
| `global` GLOBAL CHAMPIONS | sacred | all | sacred §2.5 |
| `f2p_only` PURE PATH | sacred | `totalSpent === 0`, **no wallet check** | sacred §2.5 |
| `weekly_seasonal` CURRENT SEASON | sacred | all | sacred §2.5 |
| `f2p_walleted` **PURE PATH CHAIN** | **Phase 4 NEW** | `totalSpent === 0 && walletConnected && walletHasMintedNftInLast90Days` | Phase 4 §6 |

The new column is **additive**: `TOWER_LEADERBOARDS` is currently
`Object.freeze({ global, f2p_only, weekly_seasonal })`. Phase 4 freezes
a new field `f2p_walleted`. The existing three byte-perfect entries
stay untouched.

### 6.2 Why PURE PATH CHAIN exists

**Purpose (Execution Plan §9.3):** statistically verify that NFT-owning
F2P players do NOT outperform pure-F2P players. If PURE PATH CHAIN
performance diverges measurably from PURE PATH F2P, the NFT system
has leaked stat advantage somewhere — a P2W bug requiring
immediate ESC + rollback.

**Eligibility criteria (initial proposal):**

- `totalSpent === 0` — sacred PURE PATH F2P criterion preserved (no
  paid-tier player on PURE PATH CHAIN any more than on PURE PATH F2P).
- `walletConnected === true` — wallet connected at season-snapshot time
  AND for ≥30 days of the season (avoids "drive-by wallet" gaming).
- `walletHasMintedNftInLast90Days` — player has minted at least 1 NFT
  (hero variant OR achievement) on-chain in the last 90 days. Distinguishes
  active NFT participants from observers.

These criteria are tunable; see Q5 below.

### 6.3 Display

Tower leaderboard surface gains a 4th column tab:

```
┌─────────────────────────────────────────────────────┐
│  TOWER LEADERBOARDS                                 │
├─────────────────────────────────────────────────────┤
│  [GLOBAL] [PURE PATH] [PURE PATH CHAIN ⛓] [SEASON]  │ ← tabs
├─────────────────────────────────────────────────────┤
│  1. chia1abc…  Pyredrake-mythic-3        Floor 87   │
│  2. chia1def…  Solar-Phoenix-mythic       Floor 84   │
│  3. ...                                              │
└─────────────────────────────────────────────────────┘
```

The CHAIN column shows wallet-display-name OR truncated address.
Display name comes from player profile + opt-in pseudonym.

**F2P web players (no wallet) see the PURE PATH CHAIN column but the
tab badge is faint / disabled** — they can browse it (transparency) but
they aren't on it. The PURE PATH F2P column remains their primary
competitive surface.

### 6.4 Anti-P2W audit triggered by this column

Per Execution Plan §9.5 (Phase 4 Go/No-Go) the **Anti-P2W audit
(T4.10)** verifies:

> NFT performance parity verified — PURE PATH CHAIN players do not
> outperform PURE PATH F2P players.

Specifically, the audit (run season-end by Bug Tester):

| Metric | Target |
|--------|--------|
| Mean Tower floor cleared per season | PURE PATH CHAIN vs PURE PATH F2P within **5%** |
| 90th-percentile Tower floor | within 5% |
| Top-10 player average floor | within 5% |
| Weekly Adventures contribution per active member | within 5% |
| Party Tower run-completion rate | within 5% |

If any metric is outside its window for 2 consecutive seasons, T4.10
escalates to ESC + freeze of NFT-mint UI until cause is found.

### 6.5 Sacred-cow safety

The `TOWER_LEADERBOARDS` mutation is **strictly additive**:

- The three existing keys (`global`, `f2p_only`, `weekly_seasonal`)
  retain byte-perfect values.
- The new key `f2p_walleted` is appended in the Object.freeze.
- Any code that iterates `Object.keys(TOWER_LEADERBOARDS)` continues to
  work, picking up the new key.
- Any code that addresses specific keys (`TOWER_LEADERBOARDS.global`,
  `TOWER_LEADERBOARDS.f2p_only`, `TOWER_LEADERBOARDS.weekly_seasonal`)
  is byte-unaffected.

Per Phase 3 §6 sacred-system safety, the eligibility evaluation lives
in `src/services/clan-backend.js` (extended) — NOT in `tower.js` — so
the data file stays read-only-data with no eligibility logic. The
eligibility check happens at submission time:

```
playerSubmitsTowerScore → backend evaluates eligibility →
  if (totalSpent === 0):
    submit to f2p_only leaderboard       // sacred
    if (walletConnected && minted90d):
      submit to f2p_walleted leaderboard // NEW
  submit to global leaderboard           // sacred
  submit to weekly_seasonal leaderboard  // sacred
```

The same Tower score can land on multiple leaderboards (just as a F2P
player's score lands on global + f2p_only today). Adding f2p_walleted
adds a third submission target for the walleted-F2P subset.

---

## 7. Mobile feature flag (T4.09)

> Execution Plan §9.4: future mobile builds set `isChiaEnabled() ===
> false`. All Chia entry points wrapped in check.

### 7.1 Why feature flag instead of compile-out

A clean compile-time flag (set `CHIA_ENABLED` env var at build, tree-shake
unused code) is the **default**. Vite already supports this via
`import.meta.env.CHIA_ENABLED`. But we also need a runtime function for:

- **Test-time toggling** — Playwright tests can simulate mobile build
  without separate build pipeline.
- **Debug builds** — developer can flip CHIA_ENABLED locally without
  full rebuild.
- **Future ramp** — if a partial Chia surface needs to ship on mobile
  later (e.g., on-chain achievement display read-only, no mint), the
  flag becomes a multi-valued check.

### 7.2 API

`src/services/feature-flags.js` (new):

```js
// Conceptual — design intent
export const FEATURE_FLAGS = Object.freeze({
  CHIA_ENABLED: import.meta.env.VITE_CHIA_ENABLED !== 'false',
  // Future flags ...
});

export function isChiaEnabled() {
  return FEATURE_FLAGS.CHIA_ENABLED;
}

// Test override (Playwright)
export function __testOverrideFlag(name, value) { /* ... */ }
```

### 7.3 Wrapped entry points

Every Phase 4 UI surface MUST guard on `isChiaEnabled()`:

| Surface | Guard location |
|---------|----------------|
| Profile "Connect Wallet" button | `src/ui/profile.js` render |
| Codex Moments "Mint" button | `src/ui/codex.js` render |
| Adventures "DAO Adventure" button | `src/ui/adventures.js` render |
| Adventures DAO clan member badge mint prompt | `src/ui/adventures.js` |
| Tower leaderboard "CHAIN" tab | `src/ui/tower.js` render |
| Battle screen NFT skin overlay | `src/ui/battle-screen.js` render (silent fallback to base sprite) |
| Profile Achievement Wall | `src/ui/profile.js` render |
| NFT inventory in Profile | `src/ui/profile.js` render |

Implementation pattern:

```js
// Conceptual — DO NOT IMPLEMENT IN THIS DOC
function renderWalletConnectButton() {
  if (!isChiaEnabled()) return null;
  return /* button DOM */;
}
```

### 7.4 Mobile build verification

A new smoke test (T4.09) verifies mobile compatibility:

```js
// tests/smoke/mobile-no-chia.spec.js (T4.09)
test('mobile build with CHIA_ENABLED=false has zero Chia UI', () => {
  // Set env var
  // Build mobile
  // Run smoke
  // Verify: no #connectWallet, no #nftInventory, no #achievementWall
  // Verify: no #chainLeaderboardTab
  // Verify: no #daoAdventureButton
  // Verify: gameplay (FTUE, chapters, Tower, Adventures) all work normally
});
```

### 7.5 Sacred-cow safety

The feature flag pattern does NOT modify any sacred system. It only
**adds** conditional render guards in `src/ui/*` files. The base render
path (when `isChiaEnabled() === false`) is the pre-Phase-4 default —
i.e., F2P web players with `isChiaEnabled() === true` but `wallet not
connected` get the same UI as mobile players with `isChiaEnabled() ===
false`. This is by design: the F2P-without-wallet experience IS the
mobile-build experience.

---

## 8. Sacred cow safety audit

| Sacred system (CLAUDE.md ref) | Modified? | Notes |
|-------------------------------|-----------|-------|
| Combo crit formula (§2.1) | NO | Phase 4 does not touch combat math |
| Element synergy 2x/3x/5x (§2.1) | NO | NFT heroes inherit base race/element |
| RACE_SYNERGY tier values (§2.1) | NO | NFT heroes participate in base race synergy |
| TIER_COSTS_V18 (§2.1) | NO | Not touched |
| HERO_ULT_COST_BY_NEWROLE (§2.1) | NO | NFT heroes inherit base ULT cost |
| TTK formula (§2.1) | NO | Not touched |
| MAX_HP = 100 (§2.1) | NO | Not touched |
| V_HAPTICS table (§2.2) | NO | NFT cosmetic overlay reuses existing haptics |
| vPlayCritFlash 180+440ms (§2.2) | NO | Not touched |
| 5-beat boss death (§2.2) | NO | Not touched |
| Particle line clear pattern (§2.2) | EXTENDED, not modified | NFT particle accent color overlay; existing 32-cap respected |
| NARRATOR_LINES (§2.3) | NO | Phase 4 adds no narrator lines (achievement names use Codex-style copy, not Narrator) |
| Chronicler dialog (§2.3) | NO | Not touched |
| Boss names / element subtitles (§2.3) | NO | Read-only |
| GEM_PACKS prices (§2.4) | NO | Not touched (NFT mint fee is XCH, not gems) |
| First Purchase Bonus (§2.4) | NO | Not touched |
| Battle Pass tier formula (§2.4) | NO | Not touched — NFT mint cost is separate Chia network fee, NOT BP tier xp |
| Tower retry gem ladder (§2.4) | NO | Not touched (`[100, 200, 400]`) |
| 3-min Tower TTK (§2.4) | NO | Not touched |
| 4-channel damage system (§2.5) | NO | Not touched |
| Stagger Loop / Recovery (§2.5) | NO | Not touched |
| HERO_TIER_ABILITIES (§2.5) | NO | NFT cosmetic skin overlay; tier abilities byte-identical |
| HERO_ROSTER stat blocks (§2.5) | NO | NFT heroes are skin overlays on existing rows, never new rows |
| BOSS_TTK_TARGETS (§2.5) | NO | Not touched |
| TOWER_LEADERBOARDS (§2.5) | EXTENDED (additive), not modified | New 4th key `f2p_walleted`; existing 3 keys byte-perfect |
| TOWER_PACTS (§2.5) | NO | Not touched |
| Uroboros seasonal (§2.5) | NO | Not touched |
| FTUE_BOSS_GUARANTEES (§2.5) | NO | Not touched |
| Chronicler narrator (§2.5) | NO | Phase 4 adds no chronicler dialog |
| PURE PATH leaderboard (§2.5) | NO | The new PURE PATH CHAIN is a separate column; PURE PATH F2P unchanged |
| Reactivity Events 22 handlers (§2.5) | NO | Not touched |
| PHASE_GATE_P1_TO_P2 = 0.70 (§2.5) | NO | Not touched |
| PHASE_GATE_P2_TO_P3 = 0.35 (§2.5) | NO | Not touched |
| REACTIVITY_TELEGRAPH_MS = 3000 (§2.5) | NO | Not touched |
| REACTIVITY_BANNER_DURATION_MS = 1500 (§2.5) | NO | Not touched |
| PHOENIX_REVIVE_HP_PCT = 0.6 (§2.5) | NO | Not touched |
| PHOENIX_IMMUNE_TURNS = 2 (§2.5) | NO | Not touched |
| BERSERKER_ENRAGE_HP_PCT = 0.5 (§2.5) | NO | Not touched |
| BERSERKER_ENRAGE_MULT = 2.0 (§2.5) | NO | Not touched |
| ARMORED_SHIELD_COUNT = 2 (§2.5) | NO | Not touched |
| ARMORED_SHIELD_ABSORB = 0.3 (§2.5) | NO | Not touched |
| Identity Layer race FX (Phase 2 sacred-after-ship) | NO | NFT particle accent overlay; race FX logic byte-perfect |
| Identity Layer boss-reactive mechanics (Phase 2 sacred-after-ship) | NO | Not touched |
| Codex screen structure (Phase 2 sacred-after-ship) | EXTENDED, not modified | New Achievement Wall subsection; existing Moments tab unchanged |
| Phase 3 Adventures `weeklyBossHp` scaling (Phase 3 sacred-after-ship) | NO | DAO clans use identical scaling formula |
| Phase 3 Adventures per-member contribution cap `2 × baseBossHp` (Phase 3 sacred-after-ship) | NO | DAO members get identical cap |
| Phase 3 Adventures reward distribution (Phase 3 sacred-after-ship) | NO | DAO members get identical rewards |
| Phase 3 Party Tower turn-based architecture (Phase 3 sacred-after-ship + ADR-002) | NO | DAO membership does not affect Party Tower |
| Phase 3 Party Tower shared Tower-Hearts pool (Phase 3 sacred-after-ship) | NO | DAO membership does not affect pool |
| Phase 3 Friend leaderboard graph (Phase 3 sacred-after-ship) | NO | DAO + non-DAO members co-exist as friends |
| Phase 3 Tower seasonal cadence (Phase 3 sacred-after-ship) | NO | Not touched |
| Phase 3 Replay capture (Phase 3 sacred-after-ship) | NO | On-chain achievement mint is separate; replay capture identical |
| getPlayerSegment() thresholds (T1.20 sacred) | NO | Wallet connection adds a flag, never changes spend thresholds |

**Result: 0 sacred-cow value modifications.**

Phase 4 is **strictly additive**:
- Two existing data structures gain a new frozen key
  (`TOWER_LEADERBOARDS.f2p_walleted`, `Codex.AchievementWall`).
- Two existing services gain new optional fields
  (`clan-backend.adventures.daoMode`, `analytics.walletStatus`).
- Six new files created (chia-wallet, nft-backend, wallet-connect UI,
  nft-mint UI, dao-adventures UI, chia-config data, feature-flags
  service).
- Zero existing sacred values touched.

Per ADR-003 §3-4, the no-P2W contract is structurally enforced (NFTs
are cosmetic skin overlays on existing HERO_ROSTER records; on-chain
achievements are cosmetic badges; DAO clans share leaderboard pools
with non-DAO clans; PURE PATH CHAIN is an audit surface not a reward
surface).

### 8.5 PURE PATH CHAIN parity audit (T4.10)

To verify ADR-003 no-P2W is honored at the empirical level, Phase 4
Bug Tester runs a per-season **PURE PATH CHAIN vs PURE PATH F2P parity
audit**:

| Metric | Target |
|--------|--------|
| Mean Tower floor cleared per season | PURE PATH CHAIN vs PURE PATH F2P **within 5%** |
| Median Tower floor cleared | within 5% |
| 90th-percentile Tower floor | within 5% |
| Top-10 floor mean | within 5% |
| Average ULT charges per fight | within 5% |
| Average crits-per-battle | within 5% |
| Weekly Adventures contribution per active member | within 5% |
| Party Tower run-completion rate | within 5% |
| D7 / D30 retention | within 5% |

Audit cadence: **monthly** during T4.11 closed beta; **per-season**
post-launch (~13 weeks).

If 2 consecutive audits show any metric outside the 5% window for the
same dimension, ESC-04 triggers + immediate ramp-down of new NFT mints
until cause is found.

The same parity audit also compares **Adventure DAO** clans vs **non-DAO**
Adventure clans on:
- Weekly defeat-rate (DAO vs non-DAO clans)
- Member retention week-over-week
- Clan progression tier advancement rate

If DAO clans systematically outperform non-DAO clans by >5%, that's
also a P2W signal (DAO benefit unintentionally bleeding past cosmetic).

---

## 9. Performance budgets — Phase 4 layer-wide

| Constraint | Value | Source |
|------------|-------|--------|
| Wallet connect handshake p99 | ≤3s | task brief |
| NFT mint flow end-to-end p99 | ≤30s | task brief (Chia testnet realistic) |
| Wallet status check (cached) | ≤500ms | task brief |
| NFT inventory fetch on wallet connect | ≤3s p99 | §2.4 |
| NFT skin overlay at hero render | ≤1ms cache hit | §2.4 |
| NFT skin variant asset preload (25 variants) | ≤2s background | §2.4 |
| On-chain achievement mint flow | ≤30s p99 | §3.3 |
| Achievement Wall fetch on profile open | ≤2s p99 | §3.4 |
| DAO clan create flow (incl. on-chain mint) | ≤30s p99 | §5.2 |
| DAO clan join validation | ≤500ms p99 | §5.3 |
| PURE PATH CHAIN leaderboard tab switch | ≤200ms FCP | §6.3 |
| Bundle size impact (Phase 4 deltas) | ≤500 KB JS / ≤200 KB CSS | sub-AAA+ budget total <5MB |
| Frame-time overhead vs Phase 3 baseline | ≤2ms/frame avg | budget |
| Mobile build smoke (CHIA_ENABLED=false) | full 100% pre-Phase-4 parity | §7.4 |

**Object-pool requirements:**

- NFT inventory list rows pooled at 25-row maximum (re-use DOM fragment).
- Achievement Wall badge tiles pooled at 50-tile maximum.
- DAO clan member list rows pooled at 15-row maximum (Phase 3 pool
  reused).

**Async pattern requirements:**

- All wallet calls use `await` with `try/catch` + visible loading state.
  No silent failures.
- All on-chain reads cached locally with 30s TTL; user can force refresh.
- NFT mint progress shown with per-step indicator: "Awaiting wallet
  signature... Submitting to Chia... Awaiting confirmation (1/2)...
  Confirmed."
- Mint timeout: ≥60s before showing "still pending — check Sage Wallet
  for status" copy (Chia block time ~52s).

**No regression on Phase 1-3 budgets.** Phase 4 features must not slow
down existing surfaces. Bundle stays <5MB total. FCP stays <1.5s.

---

## 10. Implementation dependencies (for Game Developer)

### 10.1 New files

| File | Purpose | T-number |
|------|---------|----------|
| `src/services/chia-wallet.js` | Wallet connect / disconnect / signing / nonce | T4.02 |
| `src/services/nft-backend.js` | NFT mint / transfer / inventory sync / event subscribe | T4.03 + T4.04 + T4.06 |
| `src/services/feature-flags.js` | `isChiaEnabled()` + future flag registry | T4.09 |
| `src/data/chia-config.js` | NFT variant catalog + achievement catalog + fee schedule | T4.03 + T4.05 |
| `src/ui/wallet-connect.js` | Wallet picker modal + connect / disconnect flow | T4.02 |
| `src/ui/nft-mint.js` | NFT mint modal (hero variant select + fee disclosure) | T4.03 |
| `src/ui/dao-adventures.js` | DAO Adventure clan create + join UI variant | T4.07 |
| `src/styles/screens/wallet-connect.css` | Wallet picker styling | T4.02 |
| `src/styles/screens/nft-mint.css` | NFT mint modal styling | T4.03 |
| `src/styles/screens/dao-adventures.css` | DAO variant styling overlays | T4.07 |
| `tests/smoke/wallet-connect.spec.js` | Connect flow smoke | T4.02 |
| `tests/smoke/nft-mint.spec.js` | Mint flow smoke (testnet) | T4.03 |
| `tests/smoke/dao-adventures.spec.js` | DAO clan create + join smoke | T4.07 |
| `tests/smoke/chain-leaderboard.spec.js` | PURE PATH CHAIN tab smoke | T4.08 |
| `tests/smoke/mobile-no-chia.spec.js` | Mobile build CHIA_ENABLED=false smoke | T4.09 |
| `tests/unit/feature-flags.test.js` | Flag override + default behavior | T4.09 |
| `tests/unit/nft-backend.test.js` | Skin binding math, transfer state update | T4.03 + T4.06 |
| `tests/unit/parity-audit.test.js` | Statistical parity calc unit tests | T4.10 |

### 10.2 Files to modify (additive only)

| File | Change | Sacred risk |
|------|--------|-------------|
| `src/services/analytics.js` | Add `walletStatus: 'connected' \| 'disconnected'` flag in user properties. `getPlayerSegment()` thresholds and existing logic byte-perfect. | NONE — additive |
| `src/data/tower.js` | Append `f2p_walleted` key to `TOWER_LEADERBOARDS` Object.freeze. Existing 3 keys byte-perfect. | NONE — additive |
| `src/services/clan-backend.js` | Add `daoMode` branch in clan-create + clan-join; add eligibility check for `f2p_walleted` leaderboard submission. Existing Phase 3 logic byte-perfect. | NONE — additive |
| `src/ui/profile.js` | Add wallet entry point button + NFT inventory subsection + Achievement Wall subsection. Existing profile layout byte-perfect when `walletConnected === false`. | NONE — additive |
| `src/ui/codex.js` | Append "Mint on-chain" button per Moment entry when `isChiaEnabled() && walletConnected`. Existing Moments tab byte-perfect otherwise. | NONE — additive |
| `src/ui/tower.js` | Add 4th leaderboard tab "PURE PATH CHAIN" when `isChiaEnabled()`. Existing 3 tabs byte-perfect. | NONE — additive |
| `src/ui/battle-screen.js` | At hero render, consult `getActiveSkin(heroId)` for cosmetic overlay. Default branch (no skin) renders base sprite byte-perfect. | NONE — additive |
| `src/ui/adventures.js` | Add "+ START A DAO ADVENTURE" button (Phase 3 §2.1 baseline preserved). Add DAO badge `⛓` next to clan name in browse public list. | NONE — additive |
| `src/ui/menu.js` | No change needed (Phase 4 features accessible via profile → wallet → mint surfaces, not as menu top-level entries) | NONE |
| `src/main.js` | Add `feature-flags.js` import + flag-loading boot step. No existing boot order modified. | NONE — additive |
| `vite.config.js` | Add `VITE_CHIA_ENABLED` env handling. | NONE — config-level |

### 10.3 Sequence (Waves)

**Wave 1 — Infrastructure:**
- T4.09 — Feature flag (`src/services/feature-flags.js`) — first because
  every other Phase 4 task imports it
- T4.02 — Wallet integration (`src/services/chia-wallet.js` +
  `src/ui/wallet-connect.js`) — second because NFT + DAO + leaderboard
  all need wallet
- T4.08 — PURE PATH CHAIN leaderboard column (`src/data/tower.js`
  additive + clan-backend eligibility) — early because parity audit
  in T4.10 reads from it

**Wave 2 — Core NFT mechanics (depends Wave 1):**
- T4.03 — NFT-hero mint (`src/ui/nft-mint.js` + `src/services/nft-backend.js`)
- T4.04 — Profile NFT inventory display + skin apply
- T4.05 — On-chain achievement mint (extends `nft-backend.js`)
- T4.06 — Trade flow (extends `nft-backend.js` with transfer-event listener)

**Wave 3 — DAO + audit (depends Wave 2):**
- T4.07 — Adventure DAO (`src/ui/dao-adventures.js` +
  `src/services/clan-backend.js` additive flag)
- T4.10 — Anti-P2W audit harness + first audit run

**Wave 4 — Closed beta + launch:**
- T4.11 — Closed beta with crypto users (100-300; 2-4 weeks)
- T4.12 — Production launch (Wave 1 Chia community → Wave 2 crypto
  gaming media → Wave 3 mainstream)

### 10.4 Legacy Bridge moment (eventual T4.13)

Mirrors T2.B (Phase 2) + T3.16 (Phase 3): a single integration task
wires Phase 4 features into the legacy primary runtime per ADR-004
hybrid coexistence.

When Phase 4 implementation lands, the following window bridge
functions need exposure (parallel to the pattern Phase 2 + Phase 3
established):

- `__connectWallet`, `__disconnectWallet`, `__getWalletStatus`
- `__mintNftSkin`, `__mintAchievement`, `__transferNft`
- `__getOwnedNfts`, `__getAchievements`
- `__createDaoAdventure`, `__joinDaoAdventure`
- `__getChainLeaderboard`
- `__getActiveSkin(heroId)` (read by battle-screen render)
- `__isChiaEnabled` (read by every Phase 4 UI guard)

Each bridge call validates server-side; client-side is presentation
only.

### 10.5 Test coverage requirements (per CLAUDE.md §3.5)

- **Smoke**: 5 new smokes (wallet connect, NFT mint, DAO clan create,
  PURE PATH CHAIN tab toggle, mobile-no-chia mobile-build verification)
  — minimum.
- **Unit**: 3 new unit-test suites (feature flag overrides, NFT
  backend skin-binding math + transfer state, statistical parity
  calculations).
- **Visual**: 10-15 new baselines for 4 new surfaces × desktop + mobile
  per §11.
- **Manual**: Bug Tester end-to-end with **real Chia testnet wallet** —
  connect → mint hero variant → confirm display on battle screen →
  transfer to second wallet → verify second wallet sees skin → mint
  achievement → verify Achievement Wall display → create DAO clan
  with 2 wallets → defeat weekly boss → verify reward parity vs
  non-DAO clan baseline.
- **Closed beta**: 100-300 crypto users per T4.11; minimum 2-4 weeks
  participation window; per Execution Plan §9.5 Go/No-Go.

---

## 11. Visual regression baseline impact

The following baselines need to be **captured as new** (4 new surfaces
× viewports):

**Wallet connect (3 baselines × 2 viewports):**
- `tests/visual/baseline/wallet-connect-picker.png` (wallet selection
  modal)
- `tests/visual/baseline/wallet-connected-status.png` (profile after
  connect)
- `tests/visual/baseline/wallet-disconnect-confirm.png` (disconnect
  confirmation)

**NFT mint flow (3 baselines × 2 viewports):**
- `tests/visual/baseline/nft-mint-variant-picker.png` (variant selection
  modal)
- `tests/visual/baseline/nft-mint-fee-disclosure.png` (fee + ADR-003
  copy)
- `tests/visual/baseline/nft-mint-success.png` (post-mint success
  screen)

**Profile NFT inventory (2 baselines × 2 viewports):**
- `tests/visual/baseline/profile-nft-inventory-empty.png` (no NFTs yet)
- `tests/visual/baseline/profile-nft-inventory-populated.png` (3-4
  NFTs displayed)

**On-chain Achievement Wall (2 baselines × 2 viewports):**
- `tests/visual/baseline/achievement-wall-empty.png`
- `tests/visual/baseline/achievement-wall-populated.png` (5-10 badges)

**DAO Adventures (3 baselines × 2 viewports):**
- `tests/visual/baseline/dao-adventures-create-flow.png` (DAO create
  modal)
- `tests/visual/baseline/dao-adventures-clan-banner.png` (DAO clan
  banner display)
- `tests/visual/baseline/dao-adventures-browse-public.png` (browse
  public list with ⛓ icons)

**PURE PATH CHAIN leaderboard (1 baseline × 2 viewports):**
- `tests/visual/baseline/tower-leaderboard-chain-tab.png` (CHAIN tab
  active)

**Codex Moments with mint button (1 baseline × 2 viewports):**
- `tests/visual/baseline/codex-moments-mint-button.png` (Phase 3 §4.5
  update — intentional baseline replacement commit)

**Total new baselines:** ~15 baselines × 2 viewports = **~30 new
baselines** + 1 intentional Codex baseline update.

Existing Phase 1-3 baselines must NOT change when `isChiaEnabled() ===
false` (mobile build sim) AND when `walletConnected === false` (default
web build state). If any do, Phase 4 is leaking → regression bug per
§11 contract.

---

## 12. Test coverage requirements

Per CLAUDE.md §3.5:

- **Smoke**: 5 new smokes (wallet connect, NFT mint testnet, DAO clan
  create, leaderboard column toggle, mobile-no-chia parity).
- **Unit**: 3 new unit-test suites (feature flag overrides + default,
  NFT backend skin binding + transfer math, statistical parity
  calculations + ESC threshold logic).
- **Visual**: 30 new baselines per §11.
- **Manual**: Bug Tester end-to-end with real Chia testnet wallets:
  - **Account A + Account B** on 2 devices, each with separate Chia
    testnet wallet.
  - **Connect flow**: A connects Sage; A's profile shows connected;
    A disconnects; A's profile shows disconnected.
  - **Mint flow**: A connects + mints "Pirate Warrior Redfang" variant
    on testnet; verify Sage shows the NFT in A's wallet; verify
    Blocksworn shows Redfang skin on Pirate Warrior in battle.
  - **Transfer flow**: A sends Redfang NFT to B via Sage; verify
    Blocksworn (A) no longer shows Redfang skin (silent fallback to
    base); verify Blocksworn (B) shows Redfang in inventory; B applies
    skin; B sees Redfang in battle.
  - **Achievement mint**: A defeats Pyredrake first-kill; A mints
    "Pyredrake Slayer" achievement on testnet; verify Achievement
    Wall in A's profile shows badge; verify badge survives logout/
    re-connect.
  - **DAO clan**: A creates DAO clan (mints DAO descriptor on testnet);
    A invites B; B joins (validates B's wallet); A + B defeat weekly
    boss; verify reward parity vs non-DAO clan baseline (no extra
    Tower Hearts / gold / essence / XP).
  - **PURE PATH CHAIN**: A is $0 spend + walleted; verify A submits
    to PURE PATH CHAIN; verify non-walleted F2P (Account C) submits
    only to PURE PATH F2P; verify paid-tier (Account D) submits to
    neither PURE PATH.
- **Closed beta (T4.11)**: 100-300 crypto users, 2-4 weeks. Per
  Execution Plan §9.5 mandatory before T4.12 production launch.

**Phase 4 closeout audit:**

- All Phase 1-3 sacred values byte-perfect (regression contract)
- Sacred `TOWER_LEADERBOARDS` 3 keys byte-perfect; new `f2p_walleted` key
  validated as additive-only
- Sacred `HERO_ROSTER` stat blocks byte-perfect (NFT cosmetic overlay
  has zero stat impact)
- Sacred Battle Pass formula `500 + (tier-1) × 150` byte-perfect
- Sacred Tower retry ladder `[100, 200, 400]` byte-perfect
- PURE PATH CHAIN parity audit baseline established (§8.5)
- Mobile build verified (CHIA_ENABLED=false, zero Chia DOM, Phase 1-3
  smoke 100%)
- 100+ crypto user closed beta complete with no critical bugs

---

## 13. Open questions for Roman

### Q1 — Sage Wallet vs Chia Wallet primary support (V1 scope)

Execution Plan §9.5 mentions "Sage или Chia Wallet". Designer needs
ruling on V1 scope:

**Option A** (recommended): **Sage primary, Chia secondary**. Most
Chia ecosystem users have migrated to Sage; Sage has better mobile UX +
WalletConnect-style API. Implementation: T4.02 ships Sage; T4.02.1
optional follow-up adds Chia Wallet support if user demand.

**Option B**: Both at V1. Doubles implementation cost (~1.5 weeks
extra); spreads QA / closed-beta surface across 2 wallets. Higher
risk of one-wallet-incompatibility bugs.

**Option C**: Chia Wallet only. Smaller user base reach; conservative
scope.

**My recommendation:** **A — Sage primary at V1**. Chia Wallet support
deferred to T4.02.1 follow-up if T4.11 closed beta shows demand. If
Roman wants both at V1 → +1.5 weeks Phase 4 estimate.

---

### Q2 — Mint fee schedule (P2W parity preservation)

Designer-proposed mint fee schedule:

- **Hero NFT skin (common variant):** 0.01 XCH cosmetic premium + ~0.0001 XCH gas
- **Hero NFT skin (rare variant):** 0.1 XCH cosmetic premium + gas
- **Hero NFT skin (legendary variant):** 1.0 XCH cosmetic premium + gas
- **On-chain achievement:** 0.001 XCH cosmetic premium + gas
- **DAO descriptor (clan create):** 0.05 XCH cosmetic premium + gas
- **DAO member badge:** 0.001 XCH cosmetic premium + gas
- **Royalty on secondary trade:** 2.5% (NFT1 royalty metadata; voluntary
  honor per Chia ecosystem norm)

Question: Are these fee tiers right? Specifically:
- Is the cosmetic premium meaningful enough to fund Blocksworn treasury
  without being exclusionary to F2P-curious players?
- Should royalty rate be lower (1%, common Web3 industry posture) or
  higher (5%, Blocksworn-favored)?
- Should F2P-walleted players (PURE PATH CHAIN eligibility) get a fee
  discount? Per ADR-003 §4 no-P2W invariant: any fee asymmetry is OK
  because mint cost ≠ stat advantage. But: F2P-walleted discount could
  invert into F2P-walleted-favoring "easier identity badge" which
  starts to feel P2W-adjacent. Designer recommendation: NO discount;
  fees identical across all wallet tiers.

**My recommendation:** **Fee schedule as proposed**, royalty 2.5%, NO
F2P-walleted discount (fees same for all wallets). Closed beta T4.11
can tune the fee tiers based on observed mint volume.

If Roman wants a different revenue split (e.g., 5% royalty + treasury):
confirm before T4.03 implementation.

---

### Q3 — Founder Badge distribution

Designer-proposed: **gift at mainnet launch (T4.12 Wave 1)**, sent to
participating wallet addresses by Blocksworn treasury, no claim flow
required.

**Option A** (recommended): Gift directly to wallets at launch. No
claim flow. Recipient sees badge appear at next wallet sync. Smoothest
UX.

**Option B**: Claim flow at launch — Blocksworn sends notification +
"Claim your Founder Badge" button → on-tap, signs claim transaction →
badge minted to wallet. More user effort; more on-chain confirmation;
better "moment".

**Option C**: Distribute during closed beta (T4.11) as it concludes.
Tighter feedback loop but mints land on testnet first (would need
re-mint on mainnet → wasteful).

**My recommendation:** **A — gift at mainnet launch**. Treasury wallet
auto-mints + transfers to participating wallets in batch transaction.
Recipient effort = zero. Badge visible on next wallet refresh.

If Roman prefers Option B for "ceremony" reasons: +0.5 week T4.12
implementation.

---

### Q4 — On-chain achievement metadata storage strategy

Designer-proposed: **Hybrid (Option C)** — on-chain stores achievement
id + mint timestamp + minter; IPFS stores badge art + lore; Blocksworn
UI fetches both at display time.

**Option A** — fully on-chain (NFT1 metadata field, IPFS-CID-pointing).
Maximum decentralization; highest gas cost per mint.

**Option B** — IPFS-only metadata (achievement registry + art on
IPFS; on-chain points to single IPFS hash). Slightly lower cost than
A; still decentralized.

**Option C** (recommended) — Hybrid (on-chain: id + timestamp;
IPFS: art + lore). Cheapest mint; achievements persist forever even
if Blocksworn retires.

**Option D** — Centralized Blocksworn backend mirror. Fastest fetch;
breaks if Blocksworn retires; less Web3-aligned.

**My recommendation:** **C — Hybrid**. Achievements survive Blocksworn
retirement (true digital ownership framing). Mint cost stays cheap.
Closed beta T4.11 verifies IPFS pinning reliability.

If Roman prefers fully on-chain (Option A): higher gas costs per mint
(~3x). Recommend route through ESC if so.

---

### Q5 — Closed beta gate threshold (T4.11)

Execution Plan §9.5: "Closed beta with 100+ crypto users completed".

Question: Is 100 the firm minimum, or a starting target with scale-up
plan?

**Option A** (recommended): **Firm minimum 100, soft target 200-300,
hard ceiling 500**. Beta runs minimum 2 weeks; extend if more
participants joining or if critical bugs are found.

**Option B**: 100 firm, no scale-up. Once 100 are in, beta clock
starts; 2 weeks then T4.12.

**Option C**: 100 minimum, 1000+ scale (open beta-like). Phase 4
becomes "soft launch" with continued NFT mints.

**My recommendation:** **A — firm 100, soft 200-300, hard 500**.
The 100-300 range matches Roman's stated tester counts in CLAUDE.md /
Plan. Closing the cap at 500 prevents Phase 4 from drifting into open
beta without a Wave 1 launch event.

Also need clarification on **recruitment channel**: Chia Discord +
Twitter? Or paid acquisition? Or invite-only? Designer recommendation:
Chia-community first (Twitter + Discord + Chia forum), no paid
acquisition for closed beta. T4.12 Wave 1 launch then opens to
mainstream crypto gaming media (Wave 2) + general (Wave 3).

---

## 14. Acceptance criteria — design ready

- [x] §0 Overview: endgame layer framing + Phase 3 extension narrative +
      explicit anti-scope (no P2E, no NFT artifacts, no wallet-required
      core flows)
- [x] §1 Architectural fit: hard rules + scope + sacred-system mapping +
      ADR-003 recursive question at every section boundary
- [x] §2 NFT-hero data model (T4.02–T4.06): stat-block identity +
      what NFTs confer + what NFTs do NOT confer + mint flow + trade
      flow + Founder Badge
- [x] §3 On-chain achievements (T4.05): concept + catalog + mint flow +
      profile display + storage strategy + anti-P2W invariant
- [x] §4 Wallet login flow (T4.02): provider matrix + connect flow +
      session lifecycle + capabilities + anti-confusion design + backend
- [x] §5 Adventure DAO (T4.07): concept + create flow + join flow +
      rewards (parity preserved) + cross-clan competition + disband +
      Phase 3 substrate additive integration
- [x] §6 PURE PATH CHAIN leaderboard (T4.08): four-column matrix +
      purpose + eligibility + display + audit + sacred-cow safety
- [x] §7 Mobile feature flag (T4.09): API + wrapped entry points +
      mobile smoke verification + sacred-cow safety
- [x] §8 Sacred cow safety audit: 50-row table, 0 modifications planned
- [x] §8.5 PURE PATH CHAIN parity audit (T4.10): metrics + cadence + ESC
- [x] §9 Performance budgets: explicit + measurable layer-wide
- [x] §10 Implementation dependencies: 18 new files + 11 modify-additively
      + waves + Legacy Bridge plan
- [x] §11 Visual regression: 30 new baselines + 1 intentional Codex update
- [x] §12 Test coverage: 5 smoke + 3 unit + 30 visual + manual + closed beta
- [x] §13 Open questions for Roman: 5 questions (Q1–Q5) with recommendations
- [x] §15 ESC formal escalation block prepared
- [x] No code written — design only (per Designer role boundary)
- [x] No sacred-cow values modified (per CLAUDE.md §2.7)
- [x] No src/ touched (per Designer role boundary)
- [x] No real-time multiplayer (ADR-002 honored)
- [x] No P2W mechanics (ADR-003 honored — recursive question applied
      at every section)
- [x] All new code planned to land in src/ only (ADR-004 honored)
- [x] Mobile compatibility via `isChiaEnabled()` feature flag (Execution
      Plan §9.4)
- [x] Closed beta gate (T4.11) explicit, 100+ minimum (Execution Plan
      §9.5)

---

## 15. ESC-04 — formal open escalation block

```markdown
## ESCALATION ESC-04: Phase 4 Chia Integration design — 5 open questions
**Status:** AWAITING ROMAN APPROVAL
**Created:** 2026-05-13
**Origin:** TASK-060 / T4.01 — Phase 4 master design spec
**Severity:** NORMAL (no sacred-cow violation; 5 design rulings needed
              before T4.02 implementation can begin)

### Context

Phase 4 master design spec (`docs/design/chia-integration.md`) is
complete and ready for implementation. 5 design questions require
Roman ruling before T4.02 begins (these are design choices, not
ambiguities — Designer has recommendations on each).

### 5 Questions

See §13 in `docs/design/chia-integration.md`:
- Q1 — Sage Wallet vs Chia Wallet primary at V1 (Designer recs: Sage
  primary, Chia deferred to T4.02.1)
- Q2 — Mint fee schedule (Designer recs: as proposed, 2.5% royalty,
  no F2P-walleted discount)
- Q3 — Founder Badge distribution (Designer recs: gift at launch, no
  claim flow)
- Q4 — On-chain achievement metadata storage (Designer recs: Hybrid =
  on-chain id + timestamp; IPFS art + lore)
- Q5 — Closed beta gate (Designer recs: firm 100, soft 200-300, hard
  500 cap; Chia-community-first recruitment)

### CTO recommendation
Adopt all 5 Designer recommendations as-stated. They preserve ADR-003
no-P2W invariant + ADR-002 async pattern + Execution Plan §9.5
Go/No-Go criteria. No sacred-cow modifications required.

### Awaiting decision on
- Q1 ruling (V1 wallet scope)
- Q2 ruling (fee schedule)
- Q3 ruling (Founder Badge distribution mechanic)
- Q4 ruling (metadata storage strategy)
- Q5 ruling (closed beta threshold + recruitment channel)

Once all 5 are resolved, T4.02 (Wave 1 implementation) can start.
T4.09 feature flag is dependency-free and can start immediately.
T4.08 PURE PATH CHAIN leaderboard column is dependency-light and can
start in parallel with T4.02.
```

---

**Document version:** 1.0
**Status:** DRAFT — awaiting Roman approval + Q1–Q5 rulings
**Maintainer:** Game Designer agent (T4.01) + CTO

> "Chia как endgame layer, не монетизация-поверх." — Execution Plan §9.1.
> The 100-hour walleted player has on-chain provenance for their roster,
> tradable hero collectibles, and an Achievement Wall that survives
> Blocksworn retirement. None of this gives them a single point of HP
> over the F2P web player. ADR-003 strict no-P2W is the contract.
