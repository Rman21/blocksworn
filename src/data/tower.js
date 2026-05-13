// 2026-05-11 — TASK-008 (T1.07): Tower-mode constants relocated from legacy.
//
// Sacred per CLAUDE.md §2.5: TOWER_PACTS_BASE, TOWER_PACTS_MYTHIC,
// TOWER_LEADERBOARDS (incl. PURE PATH F2P leaderboard), TOWER_SEASONAL_REWARDS.
//
// Source: docs/_legacy/_archive_v1/blocksworn_index_fixed.html
//   - PACT_RARITIES           line 49452-49457
//   - TOWER_PACTS_BASE        line 49461-49495
//   - TOWER_PACTS_MYTHIC      line 49499-49515
//   - TOWER_LEADERBOARDS      line 50204-50221
//   - TOWER_SEASONAL_REWARDS  line 50224-50274
//
// BOSS_TTK_TARGETS + TOWER_BOSS_TTK_TARGETS live in ./bosses.js. Tower roster
// arrays (TOWER_BOSSES line 30820, TOWER_ACHIEVEMENTS line 30568, PACTS
// line 31174, HEART_UPGRADES, TOWER_BUFFS, etc.) include either function
// references or are mutated post-decl (e.g., TOWER_PACTS rebuilt as an alias
// for TOWER_PACTS_BASE ∪ TOWER_PACTS_MYTHIC inside the pact selection
// machinery) — deferred to T1.10.

// 2026-05-03 — COMBAT v2.1 P9 §4.2: pact rarity tiers + drop weights.
export const PACT_RARITIES = Object.freeze({
  common:   Object.freeze({ color: '#A0A0A0', dropWeight: 0.50, available: 'all_floors' }),
  rare:     Object.freeze({ color: '#5DA8E8', dropWeight: 0.30, available: 'floor_10_plus' }),
  epic:     Object.freeze({ color: '#9B59E8', dropWeight: 0.15, available: 'floor_25_plus' }),
  mythic:   Object.freeze({ color: '#FFD700', dropWeight: 0.05, available: 'seasonal_only' }),
});

// 2026-05-03 — COMBAT v2.1 P9 §4.3: 30 base pacts (15 common + 10 rare + 5 epic).
// Effects use canonical key names for _phase9ApplyPactEffect dispatcher.
export const TOWER_PACTS_BASE = Object.freeze({
  // ===== COMMON (15) =====
  c_stagger_extend:    Object.freeze({ rarity: 'common', name: 'PROLONGED STAGGER',    description: 'Stagger duration +1 turn',                                            effect: Object.freeze({ stagger_duration_bonus: 1 }) }),
  c_pressure_boost:    Object.freeze({ rarity: 'common', name: 'PRESSURE FLOW',         description: 'Pressure gain +20%',                                                   effect: Object.freeze({ pressure_gain_mult: 1.20 }) }),
  c_mit_bonus:         Object.freeze({ rarity: 'common', name: 'IRON BACK',             description: 'Mitigation +5% (cap unchanged)',                                       effect: Object.freeze({ mitigation_bonus_flat: 0.05 }) }),
  c_essence_drop:      Object.freeze({ rarity: 'common', name: 'BLOOD HARVEST',         description: '+50% essence drops this run',                                          effect: Object.freeze({ essence_mult: 1.50 }) }),
  c_gold_drop:         Object.freeze({ rarity: 'common', name: 'COIN PURSE',            description: '+30% gold drops this run',                                             effect: Object.freeze({ gold_mult: 1.30 }) }),
  c_combo_extend:      Object.freeze({ rarity: 'common', name: 'COMBO MEMORY',          description: 'Combo decay slower (5%/turn instead of 25%)',                          effect: Object.freeze({ combo_decay_mult: 0.20 }) }),
  c_first_ult:         Object.freeze({ rarity: 'common', name: 'FIRST STRIKE',          description: 'First ULT each battle is free',                                        effect: Object.freeze({ first_ult_free: true }) }),
  c_shield_max:        Object.freeze({ rarity: 'common', name: 'BARRIER FOUNDATION',    description: '+1 max shield cap (this run)',                                         effect: Object.freeze({ max_shield_bonus: 1 }) }),
  c_starting_hp:       Object.freeze({ rarity: 'common', name: 'IRON RESERVE',          description: 'Squad starts each battle at +10% max HP',                              effect: Object.freeze({ starting_hp_bonus: 0.10 }) }),
  c_pressure_start:    Object.freeze({ rarity: 'common', name: 'PRIMED METER',          description: 'Each battle starts with +20 pressure',                                  effect: Object.freeze({ starting_pressure: 20 }) }),
  c_card_drop:         Object.freeze({ rarity: 'common', name: 'CARD HARVEST',          description: '+25% hero card drops this run',                                        effect: Object.freeze({ card_drop_mult: 1.25 }) }),
  c_overflow_pressure: Object.freeze({ rarity: 'common', name: 'OVERFLOW PRESSURE',     description: 'Overflow conversion gives +50% pressure on top',                        effect: Object.freeze({ overflow_pressure_bonus: 1.50 }) }),
  c_mythic_revere:     Object.freeze({ rarity: 'common', name: 'MYTHIC REVERENCE',      description: 'If a Mythic hero is in squad, all heroes +5% damage',                   effect: Object.freeze({ mythic_squad_dmg_mult: 1.05 }) }),
  c_quick_recovery:    Object.freeze({ rarity: 'common', name: 'QUICK RECOVERY',        description: 'Recovery state ends 1 turn earlier',                                   effect: Object.freeze({ recovery_duration_offset: -1 }) }),
  c_inferno_chain:     Object.freeze({ rarity: 'common', name: 'INFERNO CHAIN',         description: 'INFERNO triggers chain to adjacent rows (+1 row)',                      effect: Object.freeze({ inferno_chain_rows: 1 }) }),
  // ===== RARE (10) =====
  r_double_signature:  Object.freeze({ rarity: 'rare',   name: 'TWICE STRUCK',          description: 'Hero signature combos deal +60% damage',                               effect: Object.freeze({ signature_dmg_mult: 1.60 }) }),
  r_overflow_essence:  Object.freeze({ rarity: 'rare',   name: 'WASTE NOT',             description: 'Overflow conversion to essence: 30% → 60%',                            effect: Object.freeze({ overflow_essence_mult: 2.0 }) }),
  r_stagger_burst:     Object.freeze({ rarity: 'rare',   name: 'PRESSURE EXPLOSION',    description: 'Reaching 100 pressure also grants +50 essence',                        effect: Object.freeze({ stagger_essence_bonus: 50 }) }),
  r_cascade_chain:     Object.freeze({ rarity: 'rare',   name: 'CHAIN REACTION',        description: 'Cascades chain longer: +2 cells per cascade',                          effect: Object.freeze({ cascade_chain_bonus: 2 }) }),
  r_phase_skip:        Object.freeze({ rarity: 'rare',   name: 'EARLY PRESSURE',        description: 'First phase gate triggers at 80% HP instead of 70%',                    effect: Object.freeze({ phase_gate_p1_p2_offset: 0.10 }) }),
  r_double_overflow:   Object.freeze({ rarity: 'rare',   name: 'OVERFLOW CASCADE',      description: 'Overflow ratio doubles in Tower (40% instead of 20%)',                  effect: Object.freeze({ overflow_tower_mult: 2.0 }) }),
  r_resurrect_once:    Object.freeze({ rarity: 'rare',   name: 'SECOND WIND',           description: 'Squad-wide auto-revive at 0 HP, once per battle',                       effect: Object.freeze({ auto_revive_once: true }) }),
  r_dual_inferno:      Object.freeze({ rarity: 'rare',   name: 'TWIN INFERNO',          description: 'Each line clear has 25% chance to trigger INFERNO',                     effect: Object.freeze({ line_clear_inferno_chance: 0.25 }) }),
  r_pact_synergy:      Object.freeze({ rarity: 'rare',   name: 'PACT SYNERGY',          description: 'For each common pact, +2% damage. For each rare, +5%',                  effect: Object.freeze({ pact_synergy_dmg: true }) }),
  r_telegraph_extend:  Object.freeze({ rarity: 'rare',   name: 'PROPHET MIND',          description: 'Boss telegraphs +2 seconds longer (more reaction time)',                effect: Object.freeze({ telegraph_extend_ms: 2000 }) }),
  // ===== EPIC (5) =====
  e_perma_stagger:     Object.freeze({ rarity: 'epic',   name: 'EVERLASTING STAGGER',   description: 'Once per battle, Stagger lasts 8 turns instead of 4',                  effect: Object.freeze({ extended_stagger_one_use: 8 }) }),
  e_double_pressure:   Object.freeze({ rarity: 'epic',   name: 'DUAL PRESSURE',         description: 'Pressure gains × 2 (capped at 100)',                                   effect: Object.freeze({ pressure_gain_mult: 2.0 }) }),
  e_signature_chain:   Object.freeze({ rarity: 'epic',   name: 'SIGNATURE CASCADE',     description: 'Signature combos trigger TWICE',                                       effect: Object.freeze({ signature_double_fire: true }) }),
  e_resurrection:      Object.freeze({ rarity: 'epic',   name: 'PHOENIX BOON',          description: 'Once per battle, restore squad to 50% HP if all reach 25%',            effect: Object.freeze({ auto_phoenix_50_pct: true }) }),
  e_skip_phase:        Object.freeze({ rarity: 'epic',   name: 'PHASE SKIP',            description: 'Boss enters Phase 3 at 60% HP instead of 35%',                         effect: Object.freeze({ phase_gate_p2_p3_offset: 0.25 }) }),
});

// 2026-05-03 — COMBAT v2.1 P9 §4.4: 15 mythic seasonal pacts.
// Available ONLY during active Tower season. Heavily impactful — define run identity.
export const TOWER_PACTS_MYTHIC = Object.freeze({
  m_perma_stagger:        Object.freeze({ rarity: 'mythic', seasonal: true, name: 'PERPETUAL CRESCENDO',  description: 'STAGGER active permanently. Pressure meter does not reset.',                                effect: Object.freeze({ permanent_stagger: true }) }),
  m_double_overflow:      Object.freeze({ rarity: 'mythic', seasonal: true, name: 'COSMIC OVERFLOW',      description: 'Overflow conversion: ULT 80%, Essence 60%, Tower Points 40%',                              effect: Object.freeze({ overflow_mults_extreme: true }) }),
  m_mythic_burst:         Object.freeze({ rarity: 'mythic', seasonal: true, name: 'COSMIC FOCUS',         description: 'Mythic hero signature deals +200% damage (requires Mythic in squad)',                       effect: Object.freeze({ mythic_dmg_mult: 3.0 }) }),
  m_full_squad_inferno:   Object.freeze({ rarity: 'mythic', seasonal: true, name: 'CONFLAGRATION',        description: 'Each line clear = INFERNO event (regardless of charge)',                                   effect: Object.freeze({ line_clear_inferno: true }) }),
  m_no_decay:             Object.freeze({ rarity: 'mythic', seasonal: true, name: 'ETERNAL RHYTHM',       description: 'Combo never decays this run',                                                              effect: Object.freeze({ combo_no_decay: true }) }),
  m_double_essence:       Object.freeze({ rarity: 'mythic', seasonal: true, name: 'ESSENCE FLOOD',        description: 'All essence drops × 3',                                                                    effect: Object.freeze({ essence_mult: 3.0 }) }),
  m_card_avalanche:       Object.freeze({ rarity: 'mythic', seasonal: true, name: 'CARD AVALANCHE',       description: 'Hero card drops × 3 + +2 cards on each boss defeat',                                       effect: Object.freeze({ card_drop_mult: 3.0, card_bonus_per_boss: 2 }) }),
  m_phase_collapse:       Object.freeze({ rarity: 'mythic', seasonal: true, name: 'PHASE COLLAPSE',       description: 'Phase gates ALL trigger at 90% HP. Boss enters Phase 3 in seconds.',                        effect: Object.freeze({ phase_gates_collapsed: true }) }),
  m_pact_aura:            Object.freeze({ rarity: 'mythic', seasonal: true, name: 'PACT AURA',            description: 'All pact effects +25% magnitude (multipliers + flats)',                                    effect: Object.freeze({ pact_global_amplify: 1.25 }) }),
  m_godslayer:            Object.freeze({ rarity: 'mythic', seasonal: true, name: 'GODSLAYER',            description: 'Boss takes +50% damage when below 50% HP',                                                  effect: Object.freeze({ low_hp_dmg_mult: 1.50 }) }),
  m_tower_focus:          Object.freeze({ rarity: 'mythic', seasonal: true, name: 'TOWER FOCUS',          description: '+30% damage on every odd floor',                                                            effect: Object.freeze({ odd_floor_dmg_mult: 1.30 }) }),
  m_resurrect_unlimited:  Object.freeze({ rarity: 'mythic', seasonal: true, name: 'IMMORTAL VIGIL',       description: 'Hero deaths revive once per battle automatically (3 times per run total)',                  effect: Object.freeze({ auto_revive_per_run: 3 }) }),
  m_essence_to_card:      Object.freeze({ rarity: 'mythic', seasonal: true, name: 'ALCHEMIST WAY',       description: 'Every 100 essence earned = 1 random card',                                                  effect: Object.freeze({ essence_to_card_rate: 100 }) }),
  m_mirror_strike:        Object.freeze({ rarity: 'mythic', seasonal: true, name: 'MIRROR STRIKE',       description: 'Every signature triggers an additional cascade burst (50% of original damage)',              effect: Object.freeze({ signature_mirror_cascade: 0.50 }) }),
  m_tower_master:         Object.freeze({ rarity: 'mythic', seasonal: true, name: 'TOWER MASTER',        description: 'All multipliers from other pacts +10% (this is the keystone)',                              effect: Object.freeze({ all_pacts_amplify: 1.10 }) }),
});

// 2026-05-03 — COMBAT v2.1 P9 §6.2: 3-track leaderboard architecture.
// PURE PATH (f2p_only) is sacred per CLAUDE.md §2.5.
//
// 2026-05-13 — Phase 4 T4.08: PURE PATH CHAIN (f2p_walleted) added as a
// NON-DESTRUCTIVE additive 4th column per docs/design/chia-integration.md §6.
// Sacred 3 entries above (global, f2p_only, weekly_seasonal) BYTE-PERFECT.
// Eligibility for `f2p_walleted` is enforced by `isPurePathChainEligible()`
// helper below, gated by `isChiaEnabled()` per ADR-004 + T4.09. The column
// exists purely to surface the anti-P2W parity invariant (ADR-003): NFT-
// owning F2P players MUST NOT outperform pure-F2P players (T4.10 audit).
export const TOWER_LEADERBOARDS = Object.freeze({
  global: Object.freeze({
    name:        'GLOBAL CHAMPIONS',
    description: 'All players combined',
    eligibility: 'all',
  }),
  f2p_only: Object.freeze({
    name:            'PURE PATH',
    description:     'Players with zero real money spent',
    eligibility:     'totalSpent === 0',
  }),
  weekly_seasonal: Object.freeze({
    name:               'CURRENT SEASON',
    description:        'Resets each season',
    eligibility:        'all',
    resetOnSeasonEnd:   true,
  }),
  f2p_walleted: Object.freeze({
    name:        'PURE PATH CHAIN',
    description: 'F2P players who hold Chia NFTs (parity surface — see §6 design spec)',
    eligibility: 'totalSpent === 0 && walletConnected && walletHasMintedNftInLast90Days',
    requiresChiaEnabled: true,
    phase: 4,
    addedIn:  'T4.08',
  }),
});

// 2026-05-13 — Phase 4 T4.08: PURE PATH CHAIN eligibility window.
// 90 days per design spec §6.2; tunable per ESC-04 Q5 ruling.
export const PURE_PATH_CHAIN_NFT_WINDOW_DAYS = 90;
export const PURE_PATH_CHAIN_NFT_WINDOW_MS = PURE_PATH_CHAIN_NFT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * Pure eligibility check for PURE PATH CHAIN (f2p_walleted) leaderboard.
 *
 * Sacred invariants honored:
 *   - PURE PATH F2P criterion preserved: `totalSpent === 0`
 *   - Wallet must be connected
 *   - At least 1 NFT minted within PURE_PATH_CHAIN_NFT_WINDOW_DAYS (active
 *     participant filter, distinguishes from drive-by wallet connections)
 *
 * Returns a flat boolean (never throws — defensive).
 *
 * @param {object} player — { totalSpent, walletConnected, lastNftMintAt }
 * @param {number} nowMs — Date.now() injectable for test determinism
 * @returns {boolean}
 */
export function isPurePathChainEligible(player, nowMs) {
  if (!player || typeof player !== 'object') return false;
  if (player.totalSpent !== 0) return false;
  if (player.walletConnected !== true) return false;
  const ts = typeof player.lastNftMintAt === 'number' ? player.lastNftMintAt : 0;
  if (ts <= 0) return false;
  const t = typeof nowMs === 'number' ? nowMs : Date.now();
  return (t - ts) <= PURE_PATH_CHAIN_NFT_WINDOW_MS;
}

// 2026-05-03 — COMBAT v2.1 P9 §6.3: seasonal rewards distribution at season end.
export const TOWER_SEASONAL_REWARDS = Object.freeze({
  top_1: Object.freeze({
    rank: 1,
    rewards: Object.freeze({
      cards:           50,
      tower_hearts:    100,
      t3_stones:       5,
      legendary_stones: 0,    // not auto-grant — too rare
      cosmetic:        'seasonal_top_1_aura',
      title:           'Season N Apex',
    }),
  }),
  top_10: Object.freeze({
    rank_range: '2-10',
    rewards: Object.freeze({
      cards:        30,
      tower_hearts: 50,
      t3_stones:    3,
      cosmetic:     'seasonal_top_10_frame',
      title:        'Season N Champion',
    }),
  }),
  top_100: Object.freeze({
    rank_range: '11-100',
    rewards: Object.freeze({
      cards:        15,
      tower_hearts: 25,
      t3_stones:    1,
      t2_stones:    5,
      cosmetic:     'seasonal_top_100_badge',
    }),
  }),
  top_1000: Object.freeze({
    rank_range: '101-1000',
    rewards: Object.freeze({
      cards:        5,
      tower_hearts: 15,
      t2_stones:    2,
      cosmetic:     'seasonal_top_1000_marker',
    }),
  }),
  participation: Object.freeze({
    rank_range: '1001+',
    rewards: Object.freeze({
      cards:        1,
      tower_hearts: 5,
      cosmetic:     'seasonal_participant_marker',
    }),
    requirement: 'reach_floor_5_at_least',
  }),
});
