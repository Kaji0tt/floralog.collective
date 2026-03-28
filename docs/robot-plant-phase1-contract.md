# Robot Plant Phase 1 Contract

This document defines the v1 gameplay contract for the Robot Plant core loop.

## Core Values

The robot plant uses three user-maintained values in range 0..100:

- energy: Operational capacity. Falls over time and stronger during inactivity. Increases by regular scans and quest completions (user, weekly, monthly). Acts as a meta multiplier for rewards and the effectiveness of Data Quality and Care bonuses.
- dataQuality: Signal quality and diversity. Increases via new species/genus, rare finds, and scans across different zones in the same day. Decreases from repetitive scanning patterns (same plant, same coordinates, same zone).
- care: Maintenance state of shell/control loop. Falls without care interactions (watering/fertilizing). Increases by care-item actions, sharing scans, weekly challenge participation, and likes received on weekly challenge posts.

Default state:

- energy: 70
- dataQuality: 65
- care: 72
- streakDays: 0
- lastMaintenanceAt: null
- lastDecayAt: null

## Event Sources

Canonical event sources used by backend and frontend:

- scan
- user_quest_completion
- weekly_quest_completion
- monthly_quest_completion
- daily_challenge_completion (not yet implemented)
- share_scan 
- weekly_challenge_participation
- weekly_challenge_like_received
- water_plant
- fertilize_plant
- decay_tick
- shop_boost (shop not yet implemented)

## Reward Formula

Reward seeds for positive events are calculated as:

reward = base(event) * zoneMultiplier * noveltyMultiplier * streakMultiplier * energyInfluencedDataQuality * energyInfluencedCare * energyRewardMultiplier

Energy design behavior:

- low energy: no energy meta bonus is applied (neutral baseline only).
- low energy: Data Quality and Care bonus multipliers are dampened toward neutral.
- high energy: stronger reward multiplier and stronger effect from Data Quality/Care bonuses.
- important: energy never reduces positive event rewards below their base reward contribution.

## Wallet Ledger (What it means)

A wallet ledger is an append-only booking history for currency transactions.

- each payout or spend is stored as one immutable booking row
- wallet balance is derived from bookings (and denormalized into RobotPlant.wallet_balance for fast reads)
- idempotency is enforced via (auth_id, event_source, event_reference)
- retries cannot create duplicate payouts when the same event is submitted again

Phase 2 implementation uses a server-side RPC and Edge Function for payout execution.

Formula constraints:

- zoneMultiplier: 1.0..1.75
- noveltyMultiplier: 0.5..1.5
- streakMultiplier: 1.0..1.5
- dataQualityMultiplier: 0.5..1.5
- careMultiplier: 0.5..1.5
- absolute min reward (for positive-base events): 1
- absolute max reward: 250

Current base values:

- scan: 10
- user_quest_completion: 25
- weekly_quest_completion: 20
- monthly_quest_completion: 50
- daily_challenge_completion: 25
- share_scan: 8
- weekly_challenge_participation: 12
- weekly_challenge_like_received: 5
- water_plant: 3
- fertilize_plant: 3
- decay_tick: 0
- shop_boost: 0

## Decay

Daily decay defaults:

- energy: 5 per day (+ inactivity extra decay)
- dataQuality: 3 per day (with stronger behavior-based penalties for repetitive scanning)
- care: 8 per day (if no watering/fertilizing maintenance)

Decay is reduced by active anti-decay effects from shop items.

## Shop Effects (initial)

- anti_decay_small: 3d, decay reduction 0.15
- anti_decay_medium: 7d, decay reduction 0.25
- bonus_boost_small: 24h, reward boost 0.15

## Technical References

- src/lib/robotPlantConfig.js
- src/lib/robotPlantEconomy.js
- src/api/robotPlantService.js
- src/api/entities.js
- migrations/018_add_robot_plant_phase2.sql
- supabase/functions/robotPlantGrantReward/index.ts
