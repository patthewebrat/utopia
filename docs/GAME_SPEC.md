# UTOPIA — Complete Game Design Specification

**Status:** authoritative numeric design for the browser remake. Game logic, names, races,
buildings, inventions and gameplay are faithful to the 1991 original (per
`UTOPIA_EMULATOR_BRIEF.md`). Where the original value is confirmed it is used verbatim;
all other numbers in this document are the **canonical design values for this remake** —
invented to be self-consistent and balanced around the confirmed anchors. Engineers
transcribe these tables directly into TypeScript; do not re-derive.

Confirmed anchors (never change): Chemical Plant 8200 GR · Power Station 50 MW/mo ·
Solar Panel 2 MW (Solar Generator 4) · Hydroponics feeds 100 · Life Support 400 air ·
Living Quarters houses 50 · Quick-Start 500,000 GR · build radius 12 tiles from a Flux
Pod · turret 30° cone, 6-tile range · tax 0–20% (applies 1 Jan) · tech levels 1–10 ·
QoL medals at 80% / 90% · max 10 technicians per industry building · refuel within 8
tiles of a Fuel Tank · 8 tactical markers.

Units & conventions:
- **GR** = Galactic Credits. **1 month = 30 game days.** Date format `DD/MM/YYYY`, start date `01/01/2090`.
- All rates are **per month** unless stated. All ranges are tiles (isometric grid squares).
- RNG: every scenario has a fixed `mapSeed`; all random rolls use a seeded PRNG (mulberry32) so saves replay deterministically.

---

## 1. Buildings — master table

Construction: cost is paid in full when placed. A Scaffold occupies the tile for
`buildTime` months and reserves `buildCrew` free colonists (released on completion; if
fewer free colonists are available, progress scales pro-rata: `progress += staffed/buildCrew`
months per month). Demolition is instant, refunds nothing, leaves Wreckage (clear with a
second Demolish click; clearing takes 0 time, costs 0).

Every building must be placed with its tile within **12 tiles (Chebyshev distance) of any
Flux Pod** (the starting colony's pod counts). All buildings are 1×1 tiles.

| # | Building | Cost GR | Build (mo) | Crew | Power MW/mo | Production / function | Storage | Max staff (class) | Tech req |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Living Quarters | 1,800 | 0.5 | 10 | 1 | Houses 50 colonists | — | — | 1 |
| 2 | Hydroponics | 2,400 | 0.5 | 10 | 2 | Food for 100 people/mo | — | — | 1 |
| 2b | Morgro Hydroponics | 3,200 | 0.5 | 10 | 2 | Food for 200 people/mo | — | — | TL6 (replaces #2) |
| 3 | Life Support | 3,600 | 0.75 | 12 | 4 | Air for 400 people/mo | banks surplus air, cap 800 | — | 1 |
| 4 | Space Moss Converter | 3,200 | 0.75 | 10 | 2 | Air for 200 people/mo; **must be built on a space-moss tile** | — | — | TL3 |
| 5 | Power Station | 6,000 | 1.0 | 20 | 0 | **50 MW/mo** | — | — | 1 |
| 6 | Solar Panel | 600 | 0.25 | 4 | 0 | **2 MW/mo** (0 during solar eclipse) | — | — | 1 |
| 6b | Solar Generator | 1,000 | 0.25 | 4 | 0 | **4 MW/mo** (0 during eclipse) | — | — | TL5 (replaces #6) |
| 7 | Flux Pod | 1,200 | 0.5 | 8 | 0 | Defines 12-tile build radius | banks surplus power, cap 200 MW | — | 1 |
| 8 | Hospital | 5,200 | 1.5 | 20 | 3 | Birth-rate control; death/disease reduction (see §5) | — | 10 Medics | 1 |
| 9 | Laboratory | 4,800 | 1.0 | 16 | 3 | Research (see §2) | — | 10 Scientists | 1 |
| 10 | Mine | 7,400 | 1.5 | 20 | 4 | Ore: `depositYield × staffedTechs` units/mo | — | 10 Technicians | 1 |
| 11 | Chemical Plant | **8,200** | 1.5 | 20 | 4 | Fuel: `depositYield × staffedTechs` units/mo → Fuel Tanks | — | 10 Technicians | 1 |
| 12 | Arms Lab | 6,800 | 1.5 | 20 | 5 | Weapons: `1 × staffedTechs` units/mo | — | 10 Technicians | 1 |
| 13 | Workshop | 5,600 | 1.0 | 16 | 4 | Tech Goods: `1.5 × staffedTechs` units/mo (trade only) | — | 10 Technicians | 1 |
| 14 | Store | 2,000 | 0.5 | 8 | 1 | — | 500 units (shared pool: food/ore/gems/weapons/tech goods) | — | 1 |
| 15 | Fuel Tank | 1,600 | 0.5 | 8 | 0 | — | 250 fuel (**750** after Compressed Fuel Tanks) | — | 1 |
| 16 | Command Centre | 9,500 | 2.0 | 25 | 6 | Exactly 1 active at a time; required for trade, ship/tank yards, alien-city attacks. If the active one is destroyed, another auto-activates. | — | — | 1 |
| 17 | Security HQ | 4,400 | 1.0 | 16 | 3 | Crime suppression (see §6) | — | 10 Security | 1 |
| 18 | Sports Complex | 7,000 | 2.0 | 20 | 5 | Call 1 event/mo (opens the 1st of next month, lasts 1 month). Event: morale +12, industry output ×0.85 that month. ≥1 event per 3 months required to keep the +12 available (see §5). | — | — | 1 |
| 19 | Radar | 3,800 | 0.75 | 10 | 3 | Reveals enemy units within **16 tiles** (Long Distance: **28**) | — | — | 1 |
| 20 | Laser Turret | 4,200 | 0.75 | 10 | 2 | Auto-fire, 30° cone, **6-tile** range, 10 dmg/shot, 1 shot/2 days. Plasma Gun: 18 dmg, 7-tile range. | — | — | 1 |
| 21 | Missile Launcher | 3,400 | 0.5 | 8 | 1 | 1 player-fired missile, range 10, 80 dmg, tile frees after firing. HDX: range 16, 140 dmg, auto-tracks. | — | — | 1 |
| 22 | Tank Construction Yard | 8,800 | 2.0 | 25 | 8 | Builds tanks continuously (see §3). Needs ore+weapons+power+active CC. ≤8 finished tanks parked adjacent. | — | 10 Technicians | 1 |
| 23 | Ship Construction Yard | 10,500 | 2.5 | 30 | 10 | Builds 1 ship at a time (see §3). Needs ore+weapons+power+active CC+adjacent free Launch Pad. | — | 30 Colonists | 1 |
| 24 | Launch Pad | 2,600 | 0.75 | 10 | 1 | Holds/refuels 1 ship (refuel needs a Fuel Tank ≤8 tiles). Tanks may drive across. | — | — | 1 |
| 25 | Land Mine | 800 | 0.25 | 4 | 0 | Detonates under enemy land units only: 120 dmg. Single use, immovable. | — | — | TL4 |
| 26 | Matter Transporter | 5,400 | 1.0 | 12 | 6 | Auto-refuels friendly ships in flight anywhere on map; draws from Fuel Tanks monthly (1 fuel per 1 fuel delivered). | — | — | TL8 |
| 27 | Tank Teleport | 6,200 | 1.0 | 12 | 8 | Drive tank on → choose marker 1–8 → tank appears at marker instantly. | — | — | TL10 |

Power model: each month, demand = Σ power draw of all completed, functioning buildings.
Supply = Σ Power Stations (50) + Solar (2/4). Surplus charges Flux Pods (200 MW cap each);
deficit drains pods first. If deficit remains after pods, buildings shut down in this
order until balanced: Workshop, Arms Lab, Sports Complex, Tank Yard, Ship Yard, Mine,
Chemical Plant, Laboratory, Radar, turrets/launchers, Security HQ, Hospital, Hydroponics,
Life Support. The light-bulb warning shows whenever any building is shut down.

Damage/HP of buildings: every building has **100 HP** except Command Centre **200**,
Laser Turret/Missile Launcher **120**, Flux Pod/Solar Panel **60**. At 0 HP a building
becomes Wreckage.

---

## 2. Research, tech levels, inventions

**Research points (RP).** Per month:

```
fundedScientists = Σ scientists staffed in powered Laboratories (≤10 per lab)
maxSpend         = 200 GR × fundedScientists
actualSpend      = min(maxSpend, militaryGrantBalance + civilianGrantBalance)   // drawn 50/50, remainder from the other
fundingRatio     = maxSpend > 0 ? actualSpend / maxSpend : 0
RP gained        = fundedScientists × (1 + 2 × fundingRatio)                    // 1–3 RP per scientist
```

Research continues unfunded ("painfully slow", ×1). Grants are cumulative balances the
player tops up in Finance; research draws deplete them monthly. Civilian-grant spend also
feeds the Environment QoL factor (§5).

**Tech-level thresholds** (RP to advance from level L to L+1 = `400 × L`):

| To reach TL | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|
| RP for that step | 400 | 800 | 1,200 | 1,600 | 2,000 | 2,400 | 2,800 | 3,200 | 3,600 |
| Cumulative RP | 400 | 1,200 | 2,400 | 4,000 | 6,000 | 8,400 | 11,200 | 14,400 | 18,000 |

(20 fully funded scientists = 60 RP/mo → TL2 in ~7 months, TL10 in ~25 game-years if
research never scales up; intended pace is TL10 around year 8–10 with 60–80 scientists.)

**Invention unlock map** — both inventions of a level unlock the instant the level is
reached (info panel pops, palette graphics swap, upgraded buildings replace base versions
for all *future* builds; existing buildings keep old stats):

| TL | Inventions |
|---|---|
| 2 | **Fuel Detector** (all fuel deposits revealed on Map), **Compressed Fuel Tanks** (new tanks store 750) |
| 3 | **Ore Detector** (all ore deposits revealed), **Space Moss Converter** (buildable) |
| 4 | **Land Mine** (buildable), **Vaccination** (future virus events: 90% reduced infection/deaths) |
| 5 | **Solar Generator** (replaces Solar Panel), **Long Distance Radar** (future radars range 28) |
| 6 | **Morgro Hydroponics** (replaces Hydroponics), **Plasma Gun** (upgrades ALL turrets, existing included) |
| 7 | **Hover Tank** (future tanks are hover: see §3), **Bomb Detector** (terrorism crime stage: 75% of bombings prevented, perpetrators caught → crime −5) |
| 8 | **HDX Missile Launcher** (future launchers), **Matter Transporter** (buildable) |
| 9 | **Spy Satellite** (all enemy units always visible on Map, overrides radar), **Meteor Screen** (passive: meteor-strike events auto-neutralised) |
| 10 | **Fusion Cruiser** (buildable at Ship Yards), **Tank Teleport** (buildable) |

---

## 3. Military hardware

### Ships

Built one at a time per Ship Yard. Resources are consumed up front when the order is
placed. Build progress: `workUnits done per month = 2 × staffedColonists` (max 30 staff →
60 WU/mo). "Build mo" below = time at 20 staff (40 WU/mo).

| Ship | Ore | Weapons | Work units | Build mo @20 | HP | Damage/shot | Fire rate | Auto-fire range | Speed (tiles/day) | Fuel cap |
|---|---|---|---|---|---|---|---|---|---|---|
| Explorer | 40 | 0 | 60 | 1.5 | 60 | — | — | — | 3.0 | 200 |
| Fighter | 60 | 30 | 80 | 2.0 | 100 | 8 | 1/day | 3 | 4.0 | 160 |
| Assault Craft | 100 | 60 | 120 | 3.0 | 160 | 14 | 1/day | 3 | 3.5 | 220 |
| Cruiser | 160 | 100 | 160 | 4.0 | 240 | 22 | 1/day | 4 | 3.0 | 300 |
| Warship | 240 | 160 | 200 | 5.0 | 340 | 32 | 1/day | 4 | 2.5 | 400 |
| Fusion Cruiser (TL10) | 140 | 80 | 120 | 3.0 | 260 | 24 | 1/day | 4 | 3.0 | ∞ (no fuel) |

**Fuel burn** (all except Fusion Cruiser): take-off **8** (flat), landing **4** (flat),
flight **6/day** while moving, hover **3/day**. Fuel 0 in flight/hover → crash
(destroyed, leaves wreckage if over colony). Refuel: landed on a Launch Pad within 8
tiles of a Fuel Tank, +50 fuel/day from tank stock; or Matter Transporter (anywhere,
+25/day). Explorer special: **Build Launchpad** button (landed only): consumes 2,600 GR,
takes 0.5 month, ship hovers during build then lands on it.

### Tanks

Tank Yard: a tank costs **30 ore + 20 weapons** (consumed at order start, auto-reordered).
Progress: `+4% per staffed technician per month` → 10 techs = 40%/mo = **2.5 months/tank**
(matches the documented 2–3). Finished tank spawns in a free adjacent tile (≤8 waiting;
yard pauses when ring is full).

| Unit | HP | Damage/shot | Fire rate | Auto-fire range | Speed (tiles/day) | Terrain |
|---|---|---|---|---|---|---|
| Tank | 80 | 10 | 1/day | 2 | 1.5 | blocked by rock/ice/moss/water |
| Hover Tank (TL7) | 110 | 14 | 1/day | 3 | 2.0 | crosses rock/ice/moss (not water/oil) |

Tanks never consume fuel. Enemy unit stats are per-scenario (§9 table) expressed as
multipliers of Fighter/Tank baselines.

---

## 4. Time, the monthly tick, and economy

### Real-time layer

- **1 game day = 1.0 real second at 1× speed.** Speeds: **1× / 2× / 5×**, plus Pause
  (`P`/`Space`). Opening ANY secondary screen (Map, Finance, Advisers, Industry, Spy,
  Disk, build palette, any info panel) auto-pauses; closing resumes the previous speed.
- Per-day processing: unit movement (speeds above), auto-fire checks, projectile resolution,
  turret scan (turret rotates +30° every 2 days until a target enters its cone, then fixes),
  construction scaffolds advance, ship fuel burn, refuelling.
- Month boundary (day 30) runs the **monthly tick** below, then day resets.

### Monthly tick — exact processing order

1. **Labour allocation** (recompute from scratch):
   a. *Colony Support*: auto-staff Hydroponics, Power Stations, Life Support (these need
      no named staff in this design — step exists to guarantee food/power/air buildings
      are powered before industry in the power shutdown order, §1).
   b. *Construction*: assign free colonists to scaffolds (oldest order first) up to each
      `buildCrew`; advance progress pro-rata.
   c. *Industry*: remaining free colonists fill open vacancies (REQD − current) across all
      industries **pro-rata by vacancy count**, capped at MAX (10/building). Lowered REQD
      sacks immediately back to free pool. Hiring converts a free Colonist into the
      building's class (Technician/Medic/Scientist/Security); sacking converts back.
2. **Power balance** (supply, pod charge/drain, shutdown order — §1).
3. **Production → Stores**: ore/weapons/tech goods/gems → Store pool (overflow beyond
   total Store capacity is lost, with a "Stores full" warning); fuel → Fuel Tanks
   (overflow lost); food produced this month → food pool (food does not accumulate beyond
   2× monthly production; it is perishable); air → Life Support banks.
4. **Consumption**: food needed = population; air needed = population. Shortfall →
   shortage deaths (§5) + warning icons (knife/fork, O₂).
5. **Research**: RP accrual + grant draws (§2); tech-level/invention checks.
6. **Births & deaths** (§5); update housing/Population Density.
7. **Crime update** (§6) and crime-stage events.
8. **Disease progression** (§8).
9. **Random event roll** (§8) — skipped in Quick-Start.
10. **Enemy AI step**: wave scheduling, off-map city economy, assault resolution week
    ticks (§9–§10).
11. **Finance**:
    - Colony Support Grant income: **3,000 GR/mo in years 1–3, 1,500 GR/mo in years 4–5, 0 after.**
    - Income tax (collected every month): `taxIncome = round(population × taxRate × 0.08)` GR
      (e.g. pop 1,000 at 20% = 1,600 GR/mo). The rate used is the one locked in on 1 Jan;
      a pending rate set in Finance takes effect the next 1 January.
    - Birth bonuses paid (§5). Spy grant burn (§11).
12. **Trade**: if the player did a manual trade this month, skip autotrade; otherwise run
    autotrade (§7). Then regenerate next month's prices/supply/demand.
13. **Morale & QoL recompute** (§5). Medal checks: QoL ≥80% for 12 consecutive months →
    bronze medal + "scenario passed"; ≥90% for 12 consecutive months → gold medal.

---

## 5. Population, morale, QoL

**Population classes:** free Colonists + Technicians + Medics + Scientists + Security.
Housing: 50 per Living Quarters. `PopulationDensity% = population / (50 × livingQuarters) × 100`.

**Births** (need ≥1 powered Hospital; rate is a single colony-wide setting from any
hospital panel): None 0%, Low 0.5%, Medium 1.0%, **High 2.0% of population/mo + Earth pays
a 5 GR bonus per birth**.

**Deaths per month** = sum of:
- Base mortality: `0.2% × population`, reduced by hospital cover:
  `× (1 − 0.5 × medicCover)` where `medicCover = min(1, totalStaffedMedics × 40 / population)`.
- Food shortage: `8% × unfedPopulation`.
- Air shortage: `15% × unsuppliedPopulation` (air banks drain first).
- Disease (§8), battle deaths (each building destroyed by the enemy kills 5 colonists;
  each Living Quarters destroyed kills 25).

**Morale** (0–100, volatile, recomputed monthly):

```
morale = clamp( 50
  + 10 × foodOK + 10 × airOK + 5 × powerOK            // 1 if fully supplied this month, else −15/−20/−8
  + (PopulationDensity ≤ 100 ? 5 : −(PopulationDensity − 100) / 4)
  − crimeIndex / 3
  + (sportsEventThisMonth ? 12 : 0) − (monthsSinceLastEvent ≥ 3 && sportsComplexExists ? 6 : 0)
  + 8 × battlesWonThisMonth − 10 × battlesLostThisMonth − 2 × ownBuildingsDestroyedThisMonth
  , 0, 100 )
displayedMorale = 0.5 × previousMorale + 0.5 × morale   // one-month smoothing only
```

**Quality of Life** (0–100, slow). Each factor scores 0–100, weighted (weights sum 100):

| Factor | Weight | Score formula (clamped 0–100) |
|---|---|---|
| Morale (12-mo rolling avg) | 20 | `avgMorale12` |
| Crime (inverse) | 15 | `100 − crimeIndex` |
| Deaths (inverse) | 12 | `100 − 2000 × (deaths12mo / population)` |
| Population size | 10 | `population / 20` (2,000 pop = 100) |
| Tech level | 10 | `techLevel × 10` |
| Colony size | 8 | `completedBuildings × 1.25` (80 buildings = 100) |
| Tax (inverse) | 8 | `100 − 5 × taxRate%` |
| Battles | 7 | `50 + 50 × (won − lost) / max(1, won + lost)` (lifetime) |
| Tidiness (inverse wreckage) | 5 | `100 − 8 × wreckageTiles` |
| Environment | 5 | `min(100, civilianGrantSpend12mo / 50)` (5,000 GR/yr = 100) |

```
qolTarget = Σ weight × score / 100
QoL += clamp(qolTarget − QoL, −2, +2)        // moves max 2 points/month — trends, not spikes
```

---

## 6. Crime

`crimeIndex` (0–100), monthly:

```
pressure   = 0.5 + population / 400 + max(0, 50 − displayedMorale) / 20
suppression = 0.4 × effectiveSecurity        // staffed Security in powered HQs;
                                             // a newly hired officer counts 0 the first
                                             // month, 0.5 the second, 1.0 thereafter
crimeIndex = clamp(crimeIndex + pressure − suppression, 0, 100)
```

**Escalation ladder** (checked monthly, top stage whose threshold is met fires; each
stage at most once per 2 months):

| Stage | Trigger | Effect |
|---|---|---|
| 1. Theft | crimeIndex > 25 | Cartels hack finance: lose `5% + crimeIndex/10 %` of current funds (max 15%). Message panel report. |
| 2. Murders | crimeIndex > 50 | `crimeIndex/10` colonists murdered; morale −8 extra next month. |
| 3. Terrorism | crimeIndex > 70 | A random non-CC building is bombed to Wreckage (Bomb Detector: 75% chance prevented and crime −5 instead). |
| 4. Assassination | crimeIndex > 90 for **3 consecutive months** | **Game over** — the player is assassinated. A one-time warning fires when crimeIndex first exceeds 85. |

---

## 7. Trade

Commodities: Fuel, Food, Ore, Gems, Weapons, Tech Goods. **Base prices (GR/unit):**
Fuel 12 · Food 8 · Ore 15 · Gems 120 · Weapons 45 · Tech Goods 60.

Monthly market generation (per commodity, seeded PRNG):

```
price  = round(base × (0.7 + 0.6 × rand()))            // 70%–130% of base
supply = round(40 + 160 × rand())                      // max units you may BUY this month
demand = round(40 + 160 × rand())                      // max units you may SELL this month
```

(Gems use supply/demand range 5–40.) Buying pays `price`, selling earns `price` (no spread).

- **Manual trade**: once per calendar month, requires an active powered Command Centre.
  Buy ≤ supply, sell ≤ demand and ≤ stock. **Dump** destroys any amount of a stored
  commodity for free. Using manual trade cancels autotrade for that month.
- **Autotrade** (step 12 of the tick): for each commodity, sells
  `max(0, stock − retain% × stock)` capped by demand, at this month's price. Default
  CMMDR RETAINS: Fuel 50%, Food 80%, Ore 50%, Gems 0%, Weapons 50%, Tech Goods 0%
  (player-editable 0–100%). Autotrade never buys.

---

## 8. Disease & random events

**Virus/disease model.** An outbreak infects `10% of population`. Each month:
`infectedDeaths = 1% × infected × (1 − 0.7 × medicCover)`; morale −6 while any infection
persists; recovery removes `25% + 50 × medicCover %` of infected per month. **Vaccination**
(TL4): future outbreaks infect only 1% and deaths ×0.1. Enemy bio-attacks (race-specific,
§9) use the same model at 15% infection.

**Random event table** — one roll per month (skipped entirely in Quick-Start). Roll once;
at most one event/month:

| Event | P(month) | Effect |
|---|---|---|
| Meteor strike | 3% | A random tile is hit: building → Wreckage (+5 deaths). **Meteor Screen** (TL9): event reported and neutralised, no damage. |
| Solar eclipse | 2% | Solar Panels/Generators output 0 for 1 month (light-bulb warning likely). |
| Virus outbreak | 3% | Disease model above (indigenous strain). |
| Strike (industrial action) | 2% (5% if displayedMorale < 40) | Construction halts and industry output ×0.5 for 1 month. |
| Ore strike (helpful) | 2% | A random revealed ore deposit gains +2 yield (cap 9); message + Running-Man jump. |
| Earth aid package (helpful) | 1.5% | +`2,000 + 3,000 × rand()` GR gift. |
| Refugee ship (helpful) | 1.5% | +20 free colonists (homeless if no space — density warning). |

The Running-Man indicator flashes for any event with a map location; click jumps to it,
click again returns.

---

## 9. Scenarios (the original 10 base races, in difficulty order)

Global per-scenario schema: biome, briefing, starting funds, map seed parameters
(`oreClusters/fuelClusters` = cluster count, `richness` = mean yield 1–9), starting
colony (see §12 template — identical layout every scenario, only funds/terrain change),
and the alien AI profile:

- `firstAttackMonth` — month index (from scenario start) of wave 1.
- `waveInterval` — months between waves (− shrinks: `interval = max(2, base − floor(waveNumber/3))`).
- `waveSize(n)` — units in wave n: `ceil(base × growth^(n−1))`, cap 24.
- `mix` — share of air units (rest are land); air = enemy Fighters (Assault Craft once
  enemy TL ≥5), land = enemy Tanks. Enemy unit stats = player baseline × `statMult`.
- `enemyTechCurve` — enemy TL = `min(10, startTL + monthsElapsed / monthsPerTL)`.
  Enemy TL adds +6% damage and +6% HP per level above 1 (via statMult application).
- `aggression` — multiplier on city defence pool growth (§10) and on wave retargeting
  priority of the Command Centre (high aggression = beelines for CC).

| # | Race | Biome (visual theme) | Funds GR | Ore cl. / rich | Fuel cl. / rich | 1st attack mo | Interval | Wave base/growth | Mix (air) | Start TL / mo per TL | statMult | Aggression |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Eldorians** | Mossy green steppe | 80,000 | 12 / 6 | 10 / 6 | 14 | 6 | 2 / 1.15 | 30% | 1 / 12 | 0.8 | 0.8 |
| 2 | **Vroarscans** | Volcanic ashfields | 70,000 | 12 / 6 | 12 / 7 | 12 | 6 | 2 / 1.20 | 10% (land horde) | 1 / 11 | 0.9 | 0.9 |
| 3 | **Soomanii** | Sand desert, dunes | 64,000 | 10 / 5 | 10 / 6 | 10 | 5 | 3 / 1.20 | 50% | 2 / 11 | 0.9 | 1.0 |
| 4 | **Kal-Kriken** | Rocky canyonlands | 58,000 | 10 / 5 | 9 / 5 | 9 | 5 | 3 / 1.25 | 20% (tunnelling land) | 2 / 10 | 1.0 | 1.2 |
| 5 | **Catalytes** | Fog-shrouded marsh | 52,000 | 10 / 5 | 9 / 5 | 8 | 5 | 3 / 1.25 | 60% | 3 / 10 | 1.0 | 1.0 |
| 6 | **Squiz-Quijy** | Ice floes, frozen sea | 46,000 | 9 / 4 | 8 / 5 | 7 | 4 | 4 / 1.25 | 40%; bio-attacks: 25% of waves release a virus | 3 / 9 | 1.0 | 1.1 |
| 7 | **Pascalenes** | Crystalline highlands | 40,000 | 9 / 4 | 8 / 4 | 6 | 4 | 4 / 1.30 | 70% (air elite) | 4 / 9 | 1.1 | 1.1 |
| 8 | **Tilikanthua** | Storm-wracked badlands | 34,000 | 8 / 4 | 7 / 4 | 5 | 4 | 5 / 1.30 | 50% | 4 / 8 | 1.15 | 1.3 |
| 9 | **Vanacancia** | Night-side tundra (aurora) | 28,000 | 8 / 3 | 7 / 4 | 4 | 3 | 5 / 1.35 | 60% | 5 / 8 | 1.2 | 1.3 |
| 10 | **Lucratians** | Scorched red wasteland | 25,000 | 7 / 3 | 6 / 3 | 3 | 3 | 6 / 1.35 | 50%; raids also steal 5% funds on each undefended hit | 5 / 7 | 1.25 | 1.5 |

**Briefings** (shown before scenario start):

1. *Eldorians* — "Survey Command rates this moss-green world a textbook colony site. One complication: the Eldorians, a methodical herd-species of the Vacullo Federation, have filed a rival claim. They are slow to anger and slower to mobilise — but they do not forget. Build well, Commander; you may have a year of peace. You will not have two."
2. *Vroarscans* — "The ash plains of this volcanic world hide the richest fuel seams on the frontier. The Vroarscans want them too. They are a brute-force culture: everything they build crawls, and everything that crawls carries a gun. Expect armoured columns, Commander, and mine your approaches."
3. *Soomanii* — "A dune world of punishing heat. The nomadic Soomanii strike from the open sky and the open sand alike, then vanish into the storms. Their raids come early and from any compass point. Ring your colony — there is no safe flank here."
4. *Kal-Kriken* — "The Kal-Kriken claimed these canyons before your boosters fired, and they fight like it. Their assault burrowers ignore terrain you would call impassable and they go straight for the head: your Command Centre. Keep a spare, Commander, and keep it far away."
5. *Catalytes* — "Permanent fog shrouds this marsh world; your radar engineers already hate it. The Catalytes are patient ambushers who own the grey sky above you. Radar coverage without gaps is not advice — it is survival."
6. *Squiz-Quijy* — "An ocean frozen to the horizon. The Squiz-Quijy thrive in the cold, and their weapons are alive: engineered plagues drift ahead of every assault wave. Fund your hospitals, push for Vaccination, and do not let the ice lull you."
7. *Pascalenes* — "The crystal highlands sing when the wind rises — and when the Pascalene air fleet does. They field the finest pilots in the Federation and hold their tech edge jealously. Your turrets will earn their power draw this tour, Commander."
8. *Tilikanthua* — "Storm-wracked, mineral-poor, and contested by the most aggressive race on the frontier rolls. Tilikanthua war-packs attack without pattern or pause. Earth expects losses. Earth still expects 80%."
9. *Vanacancia* — "A tundra world locked in permanent night beneath the auroras. The Vanacancia see in the dark; you do not. They arrive with technology you have not invented yet. Spend on Intelligence, Commander — what you cannot see will kill you."
10. *Lucratians* — "The Lucratians are the Federation's bankers, and they have foreclosed on this scorched wasteland — and on you. Their raids are business: fast, early, and they take your credits as well as your lives. Nothing about this posting is fair. Succeed anyway."

**Quick-Start sandbox:** no enemy race, no random events, **500,000 GR**, mossy biome,
generous deposits (14 ore / 12 fuel clusters, richness 7), same starting colony.

---

## 10. Alien city assault (off-map resolution)

The enemy city is never on the map. Its **defence pool** `D` (abstract strength points):

```
D(start)   = 600 × statMult
D growth   = +(40 × aggression) per month, paused while an assault is in progress
```

Sending units: once spies have reported the city's location (first "location" report —
guaranteed by the 2nd report at Normal level or above), every ship/tank info panel shows
an **Attack Alien City** button. The unit leaves the map (travel: 2 weeks for ships,
4 weeks for tanks) and joins the assault force. Reinforcements may be sent anytime.

Resolution runs **weekly** while any friendly unit is at the city:

```
attackPower = Σ over units: damage/shot × 7 × (HP_remaining / HP_max)
D -= attackPower
each friendly unit takes city fire: weeklyDamage = (8 × statMult × aggression) per unit,
  spread randomly; destroyed units are lost permanently
```

- `D ≤ 0` → **enemy destroyed**: all waves stop forever, surviving units fly home
  (2 weeks), morale +20 one-off, battles "won" +5 for QoL purposes.
- All friendly units destroyed → assault fails; battle "lost" −1; `D` resumes growth.
- Progress is reported only via spy reports ("their outer defences are burning…" at
  D < 75%, 50%, 25%) and the Supreme Commander adviser (units committed/lost).
- While ≥25% of the enemy's `D` has recently been destroyed (last 3 months), wave sizes
  are ×0.5 (they recall forces to defend).

---

## 11. Spying

Funded solely by the **Intelligence Grant** (cumulative balance; monthly burn below).
Level is automatic from balance: the panel shows the active level.

| Level | Requires balance ≥ | Burn GR/mo | Reports | Content quality | Attack warning lead |
|---|---|---|---|---|---|
| 1. Insufficient funds | — | 0 | none | — | none |
| 2. Low Level Surveillance | 300 | 300 | every 2 months | vague: race facts + speculation; 50% chance a numeric claim is ±50% wrong | 1 week before a wave |
| 3. Normal Intelligence Activity | 800 | 800 | monthly | reliable: enemy TL, approximate force counts (±20%), city location by 2nd report | 2 weeks |
| 4. Special Operatives In Use | 2,000 | 2,000 | twice monthly | exact: TL, force composition, city defence % (the §10 `D` bar), illustrations | 4 weeks + predicted wave composition |

Reports archive; the panel cycles back through history. If balance hits 0 mid-month,
spying stops immediately. Attack warnings push a message + Running-Man event.

---

## 12. Map generation

- Grid **99 × 75** tiles; the outer **4-tile border on every side is unbuildable**
  (interior buildable region 91 × 67). Isometric 2:1 rendering, full pan + zoom
  (0.5×–3.0×), far more visible than the original 320×200.
- **Terrain features per biome** (fraction of interior tiles, placed as random-walk blobs
  of 4–20 tiles, seeded): rock 6%, plus the biome accent — moss 8% (mossy), ice 10%
  (ice/tundra), lava-rock 8% (volcanic), water/marsh pools 7% (fog/marsh), dunes 6%
  cosmetic-passable (desert), crystal spires 5% (crystalline), oil pools 6%
  (wasteland). Rock/ice/moss/crystal/water block ground units (Hover Tanks cross all but
  water/oil) and block building. Moss is buildable ONLY by Space Moss Converters.
- **Deposits** (underground; invisible except: within 6 tiles of any friendly building,
  or globally after the Ore/Fuel Detector inventions). Per scenario table (§9):
  `N` clusters per resource; each cluster = 3–6 contiguous tiles; tile yield =
  `clamp(round(richness + 2×(rand()−0.5)×2), 1, 9)`. Clusters never spawn under terrain
  features or within 10 tiles of the starting colony centre — except exactly **one
  guaranteed ore cluster and one guaranteed fuel cluster within 8–12 tiles** of it
  (yields = richness) so every start is viable.
- **Starting colony template** (matches the original layout shape; placed centred near
  map coordinates (44, 32), all pre-built, plus **120 colonists** of which 100 housed):
  - Command Centre (45,31) — active
  - Living Quarters ×2 (46,30) (46,31)
  - Hydroponics (43,30)
  - Life Support (43,31)
  - Power Station (44,29)
  - Solar Panels ×4 in a column at x=40, y=29–32
  - Flux Pod (44,31)
  - Store (45,30); Fuel Tank (42,31)
  - Stocks: 50 food buffer, 100 fuel, 40 ore, 0 weapons/gems/tech goods.

---

## 13. Real-time controls, units, combat micro

- **Speeds:** 1× (1 day/s), 2×, 5×; pause; secondary panels auto-pause (§4).
- **Markers 1–8:** placed on the Map zoom or with hotkeys 1–8 over the cursor tile;
  pressing a placed marker's number again removes it; `D` clears all. Markers are the
  only movement destinations.
- **Tank orders** (right-click tank → panel): send this tank to marker X; send N tanks
  nearest marker X; send this tank + N nearest it; Stop. Pathfinding: A* on the tile grid,
  8-directional, terrain-blocked; path search capped at 4,000 expanded nodes — failure
  shows "no route" and the tank holds.
- **Ship orders:** modes Flight-land-on-arrival / Flight-hover-on-arrival / Landed /
  Hovering. Ships ignore terrain (straight-line flight). Blocked landing → auto-hover.
- **Auto-fire:** tanks engage enemies ≤2 tiles (Hover 3); ships ≤3 tiles (Cruiser/Warship/
  Fusion 4); turrets ≤6 (Plasma 7) within their 30° cone; checks each day, one shot per
  unit per fire-rate period, nearest target first. Land Mines trigger on enemy ground
  contact (120 dmg).
- Missile Launchers are player-fired: click launcher → click target within range.
- Enemy waves spawn at a random map edge (seeded), move toward the colony, attack the
  nearest building/unit in range; aggression ≥1.2 races prioritise the active Command
  Centre when any path exists.

---

## 14. Save format

Single JSON file (`utopia-save-YYYYMMDD.json`), downloaded to the user's machine and
restored by file upload. Contents: schema version, scenario id + mapSeed, full RNG state,
date/day counter, funds, grants, tax (current + pending), stores/tanks/pods, population
by class, morale/QoL/crime/disease state, research RP + TL, per-tile map (terrain,
deposit yield, building id + HP + staff + progress), units (type/pos/HP/fuel/mode/orders),
markers, enemy state (D pool, wave counter, next wave day), spy report history, trade
retains + this-month-traded flag, event cooldowns, medal progress counters.

---

*End of spec. Any value not present here is an implementation detail; any value present
here is canon — change only via this document.*
