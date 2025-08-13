# Custom Pricing System

## Overview
The Fantasy Picks app now uses a custom pricing system instead of the original FPL API prices. This system loads base prices from a JSON file and applies position-based bonuses.

## Implementation

### Base Prices
- Loaded from `/public/fpl_player_prices.json`
- Contains player ID, name, and base price for each player
- If a player is not found in the JSON, defaults to £4.0m

### Position-Based Bonuses
The system adds bonuses based on player positions:

- **Goalkeepers (GK)**: +£1.0m bonus
- **Defenders (DEF)**: +£1.0m bonus  
- **Midfielders (MID)**: +£1.5m bonus
- **Forwards (FWD)**: +£2.5m bonus

### Calculation Example
For a midfielder with base price £6.0m:
- Base price: £6.0m
- Position bonus: +£1.5m (midfielder)
- **Final price: £7.5m**

### Technical Details
- Prices are loaded when FPL players data is fetched
- Original price data from API is completely replaced
- Final prices are stored in API units (multiplied by 10)
- Each player object includes:
  - `now_cost`: Final price in API units (e.g., 75 for £7.5m)
  - `custom_price`: Final price in millions (e.g., 7.5)
  - `base_price`: Original price from JSON (e.g., 6.0)

### Files Modified
- `/client/src/lib/queryClient.ts`: Added custom pricing logic
- `/client/public/fpl_player_prices.json`: Base price data
- Applied to all components that use player price data automatically

## Budget Impact
The standard £100m budget remains the same, but with the position bonuses:
- Building a team is now more strategic as forwards are most expensive
- Defenders and goalkeepers are more affordable
- Midfielders have moderate pricing
- The actual team values will be higher due to bonuses
