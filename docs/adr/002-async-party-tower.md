# ADR-002: Party Tower is Async (Turn-Based), NOT Real-Time WebRTC

**Status:** Accepted (back-filled by T3.01 design — original decision per CLAUDE.md §1.3 + Execution Plan §8.3)
**Date:** 2026-05-13 (back-filled; decision pre-dates Phase 3)
**Author:** CTO (Roman approved via Execution Plan §8 sign-off)

## Context

Phase 3 Endgame Social introduces Party Tower — a 2-5 player cooperative Tower run. The choice between real-time multiplayer (WebRTC peer-to-peer, signaling server, presence) vs. asynchronous turn-based (Firestore writes, push notifications, no live sync) shapes the entire architecture, backend cost model, and game feel.

CLAUDE.md §1.3 ("endgame fantasy locked") explicitly enumerates Party Tower as `party 2-5 + Adventure 5-15 чел` under the umbrella of **asynchronous competition**. Execution Plan §8.3 confirms: "Party Tower (2-5 coop async)".

But the choice is worth documenting explicitly because:
1. Real-time multiplayer is the higher-status industry pattern (Marvel Snap, Clash Royale, Brawl Stars all use real-time)
2. Going async is a deliberate trade-off, not a fallback
3. Phase 4 (Chia integration) may revisit this if NFT-bound heroes need verifiable on-chain ownership during play

## Decision

**Party Tower is asynchronous turn-based.** Specifically:

- **Turn-based:** Players take turns, not simultaneous play. Each player has a turn-deadline (default 24h, per T3.01 Q3 — adjustable per party at creation: 4h competitive / 24h standard / 7-day casual).
- **State transport:** Firestore document per party, players read+write to it. No WebRTC. No signaling server. No presence.
- **Notifications:** Push notification "your turn" when previous player ends their turn.
- **Identity Layer dispatch:** Each player's race FX fires on THEIR turn (their squad, their board state). Cross-race synergies emerge over the party's turn sequence (e.g., Pirate's gold from turn 1 + Shark's bite from turn 2 + Spark's combo promote on turn 3 = cumulative).
- **Tower-Hearts pool:** Shared across the party (sacred retry ladder `[100, 200, 400]` read-only — shared pool draws from it).
- **TOWER_PACTS pool:** Shared. Captain picks OR democracy mode (each party member votes; majority wins).

## Practical implications

1. **Real-time multiplayer is OUT OF SCOPE** for Blocksworn through Phase 4. If post-launch metrics show real-time demand, revisit in a future ADR.
2. **No WebRTC**, no peer connections, no presence channels. Pure HTTPS + Firestore + push.
3. **Latency is irrelevant** — turn handoff target ≤2s is for UI feedback, not gameplay sync.
4. **Backend cost** dominates by Firestore writes per turn (~5 writes per turn × 50 turns per run × N parties). Much lower than WebRTC signaling + TURN/STUN bills.
5. **Mobile-first friendly:** async games tolerate connection drops, background app states, multi-day session gaps. Real-time games punish those.

## Rationale

### Why async > real-time for Blocksworn

- **Marvel Snap precedent:** PvP turn-based async; 6 cards, 6 turns, deterministic resolution. ~50M MAU. Real-time would have killed retention because most players play in 5-minute bursts during commute / lunch / pre-sleep.
- **Words With Friends precedent:** 100M+ MAU at peak. Turn-based async makes friend-graph engagement passive — your friend's turn happens whenever they pick up the phone.
- **Cost basis:** Phase 3 launch budget assumes Firestore-only. WebRTC + TURN servers add ~$0.30/MAU/month vs Firestore ~$0.02/MAU/month at expected scale.
- **Identity Layer compatibility:** Phase 2 Identity Layer is per-line-clear granular. Cross-race synergies (T2.B `_lastBittenCells`) work just as well over async turns as same-session play.

### Why NOT real-time

- **Engineering cost:** WebRTC + signaling + state reconciliation is 3-6 months of work. Async Firestore is 2-3 weeks.
- **Operational cost:** TURN servers, presence keepalives, reconnect logic add ongoing complexity.
- **Audience fit:** Blocksworn is mobile-first puzzle RPG. Players want quick sessions, async social feel. Real-time pulls toward esports/MOBA fantasy that's off-target.

## Consequences

**Positive:**
- Backend simplicity: Firestore + push, no signaling
- Cost-efficient at scale
- Mobile-first friendly (offline-tolerant, background-tolerant)
- Identity Layer integrates naturally per turn
- Async ramps friend-graph engagement passively (asymmetric session times encourage check-back)

**Negative:**
- No "live moment" social hook — players don't experience their teammates' clears in real time
- Turn-deadline timeouts must be handled gracefully (auto-skip + flag for boot from party after N missed turns)
- Spectator/observer features (watching live Tower runs) are NOT possible without separate infrastructure

**Neutral:**
- Replay infrastructure (T3.07–T3.09) provides a "watch my friend's run" surface async, which approximates the live-spectator fantasy without WebRTC

## Compliance

How to verify this decision is being followed in Phase 3 implementation:

1. **No WebRTC in code:** any `RTCPeerConnection`, `RTCDataChannel`, etc. usage is a violation. Phase 3 code should reference `firebase/firestore` exclusively for state sync.
2. **Turn deadline enforced server-side:** Firestore security rules + Cloud Function for auto-skip.
3. **No presence-channel polling** in client code — turn updates arrive via push notification + Firestore real-time listener (which is HTTPS-streamed, not WebRTC).

## Related

- CLAUDE.md §1.3 endgame fantasy
- Execution Plan §8.3 Phase 3 Party Tower scope
- ADR-003 (no-P2W) — async pattern supports F2P parity (no real-time competitive advantage for whales)
- ADR-004 (hybrid coexistence) — Party Tower lives in src/ only per the new-feature-in-src/ rule
- T3.01 design spec §3 Party Tower (full subsystem design)
