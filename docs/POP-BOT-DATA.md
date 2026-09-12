# Pop Bot calculator data

The initial calculators were ported from the Pop Epoch Discord bot at `/Users/helvi/Documents/pop-bot` on 2026-09-12.

## Sources

- Goddess material values: `ui/goddess.py`
- Goddess XP values: `goddess_levels.csv`
- Red Carpet Night material values: `ui/red_carpet.py`
- Grand Voyage city groups and upgrade prices: `grand_voyage/city_upgrades.py`
- Grand Voyage route cities, travel times, profits, and assumptions: `grand_voyage/legacy_route_data.json`
- Expected boundary and workbook results: `tests/test_city_upgrades.py` and `tests/test_legacy_routes.py`

The web port intentionally preserves the source formulas and fixed full-stat route model. The web project is now the versioned source for these copied values. Future corrections should identify an authoritative game source, effective date or game version, and update both the data and tests.
