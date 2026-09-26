# Grand Voyage simulation foundation

Data reviewed on **2026-09-26** from the local `Grand Voyage PopEpoch` collection
(`README.md`, `AUSWERTUNG.md`, and `daten/*.csv`; its evaluated observations are
dated 2026-09-13). The versioned route matrix used by the app remains
`lib/data/grand-voyage-routes.json`, copied from the Pop Bot workbook as documented
in [POP-BOT-DATA.md](POP-BOT-DATA.md). The city groups and upgrade costs come from
`lib/calculators/city-upgrades.ts`, also documented there.

The separate `lib/data/grand-voyage-shipwreck-observation.json` copies the
23 destinations' sale prices from `daten/markt_verkauf.csv`, the purchase
prices from `daten/markt_einkauf.csv`, and the cargo quantities from
`daten/schiff_ladung.csv`. Its source is a Shipwreck Cove cargo screenshot
dated **2026-09-12** and the Fogliarcaica workbook whose date is unknown
(file dated **2026-09-13**). Values were not blended with the old full-stat
workbook.

## What the current search computes

The new browser-only page searches every two-port and every directed three-port
cycle within the regions selected by the player. For each leg it takes the old
workbook's profit and duration. It sums profit and duration for the complete
returning loop and ranks by `sum(profit) / sum(hours)`. A measured travel-time
factor multiplies every leg's duration; it does **not** change profit. The factor
defaults to 1. The search is exhaustive within its two-/three-port range, not a
selection of hand-written builds. It does not solve longer routes.

The observed-cargo panel separately computes
`sum(quantity × destination sale price) − sum(quantity × purchase price)`
for 36 Glazed Lamps, 1 Beer and 1 Chili bought in Shipwreck Cove. It displays
only accessible destinations with all three prices. Its hours still use the
historical time matrix and the player's measured factor. It represents one
outbound trip only, not a repeatable loop. Whether selling 36 Lamps changes
their unit price has not been measured.

The workbook scenario assumes Guildmaster +15, fully developed cities,
unlocked shops, maximum purchases and ship components at levels 60/50/60/60.
Consequently its absolute profit is **not** a prediction for a player's ship.
Player level, ship levels, cryptids and city levels are captured and stored in
the browser, but do not alter trade profit. This is deliberate: no verified
rules connect those inputs to purchase quantity, sale price, capacity or
bargaining power. Region access is manual because level-to-region unlocks have
not been measured. The profile starts with no regions selected and city
levels at 0, so the tool does not assume access the player may not have.
Individual city corrections override the regional base.

The next port upgrade shown beside the top route is a **cost**, not an
investment recommendation. Costs are copied from the current city upgrade
calculator (Town/City up to 30, Metropolis up to 35). A move from level
5 to 6, 10 to 11, and so on requires the other cities in the region to reach
that five-level milestone. The source collection disagrees with the calculator
about a possible final level 31/36 and Metropolis level-2 cost. Until verified,
this page retains the versioned calculator values and caps.

## Data still needed for a personal money/hour and upgrade recommendation

- Goods and stock per port; cargo weight and maximum purchase quantity.
- Sale prices by good and port, and whether bulk sales change the price.
- Effects of city levels and bargaining power on prices, slots and quantities.
- Measured travel time for a known route and ship, to calibrate speed/cryptid
  effects; time spent in port and auto-route behavior.
- Ship and cryptid upgrade costs and stat gains; the missing Logistics cryptid.
- Player-level to map-region unlock rules and the status of the 11 additional
  ports named in the newer workbook.

These belong in dated, versioned data tables with boundary tests before they
affect the result. The old workbook ranking can then be replaced with calculated
trade legs without changing the profile UI or route-search interface.
