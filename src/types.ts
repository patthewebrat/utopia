// ============================================================================
// UTOPIA remake — shared types.
// GameState is PURE serialisable data: plain objects, arrays, numbers, strings,
// booleans, null. No functions, classes, Maps, Sets, Dates, undefined-bearing
// optionals that matter to saves. JSON.stringify(state) IS the save file.
// ============================================================================

// ---------------------------------------------------------------- map / tiles

export type TerrainType =
  | 'plain'      // buildable, passable
  | 'rock'       // blocks ground units + building (hover tanks cross)
  | 'moss'       // blocks ground units; buildable ONLY by Space Moss Converter (hover crosses)
  | 'ice'        // blocks ground units + building (hover crosses)
  | 'lava'       // volcanic lava-rock: as rock
  | 'water'      // blocks everything ground incl. hover; unbuildable
  | 'dune'       // cosmetic, passable + buildable
  | 'crystal'    // crystal spires: as rock
  | 'oil';       // oil pool: blocks ground incl. hover; unbuildable

export type BiomeId =
  | 'mossy' | 'volcanic' | 'desert' | 'canyon' | 'marsh'
  | 'ice' | 'crystalline' | 'badlands' | 'tundra' | 'wasteland';

/** Tile data lives in flat parallel arrays on GameState, indexed y * mapW + x. */
export interface TileRef { x: number; y: number; }

// ---------------------------------------------------------------- buildings

export type BuildingType =
  | 'livingQuarters' | 'hydroponics' | 'morgroHydroponics' | 'lifeSupport'
  | 'spaceMossConverter' | 'powerStation' | 'solarPanel' | 'solarGenerator'
  | 'fluxPod' | 'hospital' | 'laboratory' | 'mine' | 'chemicalPlant'
  | 'armsLab' | 'workshop' | 'store' | 'fuelTank' | 'commandCentre'
  | 'securityHQ' | 'sportsComplex' | 'radar' | 'laserTurret'
  | 'missileLauncher' | 'tankYard' | 'shipYard' | 'launchPad'
  | 'landMine' | 'matterTransporter' | 'tankTeleport';

export type StaffClass = 'technician' | 'medic' | 'scientist' | 'security';

export interface BuildingDef {
  type: BuildingType;
  name: string;
  cost: number;            // GR, paid in full on placement
  buildMonths: number;     // at full crew
  buildCrew: number;       // free colonists reserved while a scaffold
  powerMW: number;         // monthly draw
  hp: number;
  techReq: number;         // minimum tech level to build (1 = always)
  maxStaff: number;        // 0 = unstaffed
  staffClass: StaffClass | null;
  /** position in the power shutdown order; lower shuts down first; -1 = never shed */
  shutdownPriority: number;
  /** short functional description for UI */
  blurb: string;
}

export interface BuildingInstance {
  id: number;
  type: BuildingType;
  x: number;
  y: number;
  hp: number;
  status: 'scaffold' | 'complete';
  /** scaffold: months of work completed (done when >= def.buildMonths) */
  progress: number;
  /** scaffold: free colonists currently assigned (set by monthly labour step) */
  crewAssigned: number;
  /** staffed employees of def.staffClass currently working here */
  staff: number;
  /** player-set REQD (<= maxStaff) */
  reqStaff: number;
  /** false when shed by the power balance this month */
  powered: boolean;
  /** built at this tech level — captures upgraded variants' stats via type */
  /** command centre: the single active one */
  active: boolean;
  /** turret: current facing in degrees (centre of 30° cone) */
  facing: number;
  /** day (totalDays) of last shot — turrets/launchers */
  lastShotDay: number;
  /** missile launcher: true once its single missile is away (tile then frees) */
  fired: boolean;
  /** laser turret built/upgraded to Plasma Gun */
  plasma: boolean;
  /** radar built with Long Distance Radar */
  longRange: boolean;
  /** fuel tank built with Compressed Fuel Tanks (capacity 750) */
  compressed: boolean;
  /** missile launcher built after HDX invention (range 16, 140 dmg, auto-tracks) */
  hdx: boolean;
  /** tank yard: % progress of current tank (0–100); -1 = no materials */
  tankProgress: number;
  /** ship yard: current order or null */
  shipOrder: { ship: ShipType; workDone: number } | null;
  /** launch pad: unit id of ship occupying it, or -1 */
  padShipId: number;
}

// ---------------------------------------------------------------- units

export type ShipType =
  | 'explorer' | 'fighter' | 'assaultCraft' | 'cruiser' | 'warship' | 'fusionCruiser';

export type UnitKind =
  | 'tank' | 'hoverTank'
  | ShipType
  | 'enemyTank' | 'enemyFighter' | 'enemyAssault';

export type ShipMode = 'landed' | 'hovering' | 'flight';

export interface UnitDef {
  kind: UnitKind;
  name: string;
  isShip: boolean;
  hp: number;
  damage: number;          // per shot (0 = unarmed)
  fireRateDays: number;    // days between shots
  range: number;           // auto-fire range, tiles
  speed: number;           // tiles/day
  fuelCap: number;         // ships; Infinity is stored as -1 in defs (fusion)
  oreCost: number;
  weaponCost: number;
  workUnits: number;       // ships: WU to build
}

export interface UnitInstance {
  id: number;
  kind: UnitKind;
  owner: 'player' | 'enemy';
  x: number;               // tile coords, fractional during movement
  y: number;
  hp: number;
  maxHp: number;           // enemy units bake statMult/TL into maxHp
  damage: number;          // per shot (enemy units bake multipliers in)
  fuel: number;            // ships only; -1 = does not use fuel
  mode: ShipMode | 'ground';
  /** ship arrival behaviour for current flight */
  landOnArrival: boolean;
  /** current path (list of tile waypoints) — null when idle */
  path: TileRef[] | null;
  /** final destination (marker tile etc.) */
  dest: TileRef | null;
  lastShotDay: number;
  /** off-map alien-city assault state */
  offMap: 'toCity' | 'atCity' | 'returning' | null;
  offMapDaysLeft: number;
  /** explorer building a launch pad: days remaining, -1 = not building */
  padBuildDaysLeft: number;
}

// ---------------------------------------------------------------- resources

export type Commodity = 'fuel' | 'food' | 'ore' | 'gems' | 'weapons' | 'techGoods';

export interface ResourceStocks {
  food: number;       // perishable pool (capped at 2× monthly production)
  ore: number;        // these four share Store capacity
  gems: number;
  weapons: number;
  techGoods: number;
}

export interface Industry {
  /** last month's production, for the Industry screen */
  producedLastMonth: { ore: number; fuel: number; weapons: number; techGoods: number; food: number; air: number };
  /** monthly food production capacity (for perishability cap) */
  foodProductionLastMonth: number;
}

// ---------------------------------------------------------------- subsystems

export interface ResearchState {
  techLevel: number;            // 1..10
  rp: number;                   // points accrued toward next level
  /** invention ids unlocked, in unlock order */
  inventions: string[];
}

export interface FinanceState {
  taxRate: number;              // 0–20, the rate locked in on 1 Jan
  pendingTaxRate: number;       // applies next 1 Jan
  grants: { military: number; civilian: number; intelligence: number };
  /** civilian-grant research spend, last 12 months (for Environment QoL) */
  civSpend12: number[];
  /** last month's ledger for the Finance screen */
  lastMonth: {
    taxIncome: number; supportGrant: number; tradeNet: number;
    researchSpend: number; spyBurn: number; birthBonus: number; constructionSpend: number;
  };
  /** in-progress accumulators for the running month — snapshotted into lastMonth at the tick */
  accTradeNet: number;
  accConstructionSpend: number;
}

export interface TradeState {
  prices: Record<Commodity, number>;
  supply: Record<Commodity, number>;   // max you may BUY this month
  demand: Record<Commodity, number>;   // max you may SELL this month
  retain: Record<Commodity, number>;   // autotrade retain %, 0–100
  tradedThisMonth: boolean;            // manual trade used this calendar month
}

export interface CrimeState {
  index: number;                       // 0–100
  /** monthIndex each stage last fired (stage at most once per 2 months) */
  lastTheftMonth: number;
  lastMurdersMonth: number;
  lastTerrorismMonth: number;
  /** consecutive months with index > 90 */
  monthsOver90: number;
  warned85: boolean;
}

export interface MoraleState {
  current: number;                     // raw recompute this month
  displayed: number;                   // 0.5 smoothing
  history12: number[];                 // last 12 displayed values
  /** battle tallies for the morale formula, reset monthly */
  battlesWonThisMonth: number;
  battlesLostThisMonth: number;
  buildingsLostThisMonth: number;
  /** one-shot extra delta applied next month (e.g. murders −8) */
  pendingDelta: number;
}

export interface DiseaseState {
  infected: number;
  bio: boolean;                        // enemy bio-attack strain
  /** outbreak began after Vaccination was invented — deaths ×0.1 (spec §8) */
  mitigated: boolean;
}

export interface SpyReport {
  monthIndex: number;
  level: number;                       // 2..4
  title: string;
  body: string;
  /** included city-defence % at level 4 */
  cityDefencePct: number | null;
}

export interface SpyState {
  reports: SpyReport[];
  /** months since last report (level cadence) */
  monthsSinceReport: number;
  reportsAtNormalPlus: number;
  cityLocated: boolean;
  /** totalDays a scheduled mid-month report fires (level-4 twice-monthly cadence); -1 = none */
  pendingReportDay: number;
}

export interface EnemyState {
  raceId: string;
  /** off-map city defence pool */
  D: number;
  Dmax: number;
  waveNumber: number;                  // waves launched so far
  nextWaveMonthIndex: number;
  /** D damage dealt per month, last 3 months (wave-halving rule) */
  recentDDamage: number[];
  destroyed: boolean;
  /** days until next weekly assault resolution */
  assaultTickDays: number;
  /** scheduled wave: totalDays it spawns (-1 = none scheduled) */
  pendingWaveDay: number;
  pendingWaveSize: number;
  pendingWaveAir: number;              // air units in the pending wave
  pendingWaveBio: boolean;             // wave releases a virus on arrival
  pendingWaveWarned: boolean;          // spy warning already issued
}

// ---------------------------------------------------------------- scenarios

export interface RaceDef {
  id: string;
  name: string;
  difficulty: number;                  // 1..10 position
  biome: BiomeId;
  biomeLabel: string;
  briefing: string;
  funds: number;
  oreClusters: number;
  oreRichness: number;
  fuelClusters: number;
  fuelRichness: number;
  firstAttackMonth: number;
  waveInterval: number;
  waveBase: number;
  waveGrowth: number;
  airMix: number;                      // 0–1 share of air units in waves
  startTL: number;
  monthsPerTL: number;
  statMult: number;
  aggression: number;
  /** race gimmicks */
  bioAttackChance: number;             // share of waves that release a virus (Squiz-Quijy)
  stealsFunds: boolean;                // Lucratians
  huntsCommandCentre: boolean;         // aggression >= 1.2 / Kal-Kriken
}

export interface ScenarioDef extends RaceDef {
  /** quick-start sandbox: no enemy, no random events */
  sandbox: boolean;
}

// ---------------------------------------------------------------- events / fx

export type NotificationKind =
  | 'info' | 'warning' | 'danger' | 'invention' | 'spy' | 'crime'
  | 'event' | 'attack' | 'finance' | 'medal' | 'gameover';

export interface Notification {
  id: number;
  monthIndex: number;
  totalDays: number;
  kind: NotificationKind;
  text: string;
  /** Running-Man jump location, if the event has one */
  loc: TileRef | null;
}

/** transient render effects — renderer drains state.effects each frame */
export type EffectFx =
  | { fx: 'shot'; fromX: number; fromY: number; toX: number; toY: number; by: 'player' | 'enemy'; beam: 'laser' | 'plasma' | 'cannon' }
  | { fx: 'missile'; fromX: number; fromY: number; toX: number; toY: number }
  | { fx: 'explosion'; x: number; y: number; big: boolean }
  | { fx: 'mine'; x: number; y: number };

/** engine→UI events drained from state.pendingEvents by engine.advance() */
export type EngineEvent =
  | { type: 'month'; monthIndex: number }
  | { type: 'notification'; note: Notification }
  | { type: 'invention'; inventionId: string; techLevel: number }
  | { type: 'techlevel'; techLevel: number }
  | { type: 'attack'; waveSize: number }
  | { type: 'spyreport'; report: SpyReport }
  | { type: 'medal'; medal: 'bronze' | 'gold' }
  | { type: 'gameover'; victory: boolean; reason: string };

export interface EventInstance {
  /** active timed world events */
  eclipseUntilMonth: number;           // solar output 0 while monthIndex < this
  strikeUntilMonth: number;            // industry ×0.5, construction halted
  /** sports complex */
  sportsEventCalled: boolean;          // event booked, opens on the 1st
  sportsEventActiveMonth: number;      // monthIndex during which it runs (-1 none)
  lastSportsEventMonth: number;        // for the ≥1-per-3-months rule (-1 never)
}

export interface Marker { x: number; y: number; }

export type GameMode = 'playing' | 'gameover' | 'victory';

export type BirthRateSetting = 'none' | 'low' | 'medium' | 'high';

export interface PopulationState {
  colonists: number;                   // free / unassigned
  technicians: number;
  medics: number;
  scientists: number;
  security: number;
  /** security officers' hire-age buckets for the 0/0.5/1.0 effectiveness ramp */
  securityNew: number;                 // hired this month (counts 0)
  securityTraining: number;            // hired last month (counts 0.5)
  birthRate: BirthRateSetting;
}

export interface StatsState {
  battlesWon: number;                  // lifetime, for QoL
  battlesLost: number;
  deaths12: number[];                  // deaths per month, last 12
  deathsThisMonth: number;
  totalDeaths: number;
  totalBirths: number;
  attacksTotal: number;                // waves that have arrived
  /** medal progress: consecutive months QoL ≥80 / ≥90 */
  monthsQol80: number;
  monthsQol90: number;
  bronzeMedal: boolean;
  goldMedal: boolean;
}

// ---------------------------------------------------------------- game state

export interface GameState {
  schemaVersion: number;
  scenarioId: string;
  mapSeed: number;
  /** mulberry32 PRNG state (int32) */
  rng: number;

  // ---- time
  totalDays: number;                   // whole days elapsed since start
  dayFraction: number;                 // partial-day accumulator
  dayOfMonth: number;                  // 0..29
  month: number;                       // 1..12
  year: number;                        // starts 2090
  monthIndex: number;                  // whole months elapsed since start
  speed: 1 | 2 | 5;
  paused: boolean;
  mode: GameMode;
  gameOverReason: string;

  // ---- map (flat arrays, index = y * mapW + x)
  mapW: number;
  mapH: number;
  terrain: TerrainType[];
  oreYield: number[];                  // 0 = no deposit, else 1–9
  fuelYield: number[];
  /** building id occupying tile + 1, 0 = empty (wreckage tracked separately) */
  tileBuilding: number[];
  wreckage: number[];                  // 0 | 1

  buildings: BuildingInstance[];
  nextBuildingId: number;
  units: UnitInstance[];
  nextUnitId: number;
  markers: (Marker | null)[];          // exactly 8 slots

  // ---- economy
  funds: number;
  stores: ResourceStocks;
  fuelStored: number;                  // in Fuel Tanks
  airBank: number;                     // surplus air banked in Life Supports
  podCharge: number;                   // MW banked in Flux Pods
  industry: Industry;
  /** power report from last monthly balance, for UI */
  power: { supply: number; demand: number; shedTypes: BuildingType[] };
  /** shortage flags from last consumption step */
  shortages: { food: boolean; air: boolean; power: boolean; storesFull: boolean };

  // ---- people
  pop: PopulationState;
  morale: MoraleState;
  qol: number;
  crime: CrimeState;
  disease: DiseaseState | null;

  research: ResearchState;
  finance: FinanceState;
  trade: TradeState;
  spy: SpyState;
  enemy: EnemyState | null;            // null in Quick-Start
  worldEvents: EventInstance;
  stats: StatsState;

  // ---- messaging
  notifications: Notification[];       // full archive (message panel)
  nextNotificationId: number;
  pendingEvents: EngineEvent[];        // drained by engine facade after advance()
  effects: EffectFx[];                 // drained by renderer each frame
}
