# Robot Plant Phase 1 Contract

This document defines the v1 gameplay contract for the Robot Plant core loop.

## Core Values

The robot plant uses three user-maintained values in range 0..100:

- energy: Operational capacity. Falls over time. It controls daily zone count, zone rerolls, and zone size scaling. It also grows from scan movement distance with a daily cap.
- dataQuality: Scan quality state. It increases only through scans inside an active zone, using the current zone multiplier as gain value. Outside active zones it does not increase. It currently decays only through daily value decay.
- care: Maintenance state of shell/control loop. Falls without care interactions (watering/fertilizing). Increases by care-item actions (watering/fertilizing). Also recieved increases by likes on shared scans.

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
- new_scan
- new_global_scan
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

Reward seeds for scan events are calculated as:

reward = (base(scanType) + healthStateBonus) * zoneMultiplier * noveltyMultiplier * careMultiplier * firstScanOfDayMultiplier * streakMultiplier

Rules:

- Multipliers are only applied to scan, new_scan, and new_global_scan.
- zoneMultiplier only applies while the user is inside an active zone.
- zoneMultiplier starts at 1.5 for a fresh zone and drops by 0.2 for each further scan in the same zone on the same day, with a floor at 0.5.
- noveltyMultiplier drops by 0.2 for each prior scan of the same plant and floors at 0.2.
- careMultiplier is derived from RobotPlant.care.
- healthStateBonus is derived from the overall robot plant health state.
- firstScanOfDayMultiplier is x2 only for the first scan of the day, otherwise x1.
- streakMultiplier is applied last, is capped at x7, and bypasses absoluteMaxReward.

Health states and additive scan bonuses:

- Ruhend: +0
- Aktiv: +5
- Lebendig: +15
- Kräftig: +30
- Prächtig (ab 90 Gesamtgesundheit): +50

## Wallet Ledger (What it means)

A wallet ledger is an append-only booking history for currency transactions.

- each payout or spend is stored as one immutable booking row
- wallet balance is derived from bookings (and denormalized into RobotPlant.wallet_balance for fast reads)
- idempotency is enforced via (auth_id, event_source, event_reference)
- retries cannot create duplicate payouts when the same event is submitted again

Phase 2 implementation uses a server-side RPC and Edge Function for payout execution.

Formula constraints:

- zoneMultiplier: 0.5..1.5
- noveltyMultiplier: 0.2..1.0
- careMultiplier: 0.5..1.5
- absolute min reward (for positive-base events): 1
- absolute max reward before streak: 350
- streakMultiplier: 1.0..7.0
- rarityMultiplier: 1.0..3.0
- firstScanOfDayMultiplier: 1.0..2.0

Current base values:

- scan: 10
- new_scan: 30
- new_global_scan: 50
- user_quest_completion: 22
- weekly_quest_completion: 30
- monthly_quest_completion: 40
- daily_challenge_completion: 35
- share_scan: 8
- weekly_challenge_like_received: 4
- decay_tick: 0
- shop_boost: 0

Reward presentation after successful scans:

- The scan animation remains visible on the Home screen.
- Base reward is shown as a large number.
- Non-neutral multipliers are revealed one after another below the base reward.
- The displayed reward counts up to each intermediate result.
- Positive multipliers trigger device vibration when supported.

## Decay

Daily decay defaults:

- energy: 5 per day
- dataQuality: 5 per day
- care: 5 per day

Decay is reduced by care thresholds and temporary fertilizer effects.

## Shop Effects (initial)

- anti_decay_small: 3d, decay reduction 0.15
- anti_decay_medium: 7d, decay reduction 0.25
- bonus_boost_small: 24h, reward boost 0.15

## Current V1 Implementation Scope (2026-04)

- Shop is embedded in Home and uses RobotPlantShopItem + RobotPlantUserInventory.
- Initial catalog contains:
	- Duenger (fertilizer_basic, decay reduction 0.15 for 12h)
	- Langzeitduenger (fertilizer_longterm, decay reduction 0.25 for 24h)
	- Accessoire Platzhalter (no gameplay effect yet)
	- Hintergrund Platzhalter (no gameplay effect yet)
- Purchase is server-side and atomic via RPC: robot_plant_purchase_item.
- Item activation is server-side via RPC: robot_plant_use_inventory_item.
- Gießen is server-side via RPC: robot_plant_water_plant.

Watering rules in v1:

- Max 3 actions per UTC day per user.
- Care gains per action sequence: +3, +2, +1.
- No seed cost for watering.

Plant Hero controls in v1:

- Existing top controls remain: Health (left), Zone (right).
- New mirrored lower control circle:
	- left: Giessen
	- right: Duenger slot

## Technical References

- src/lib/robotPlantConfig.js
- src/lib/robotPlantEconomy.js
- src/api/robotPlantService.js
- src/api/entities.js
- migrations/018_add_robot_plant_phase2.sql
- supabase/functions/robotPlantGrantReward/index.ts
