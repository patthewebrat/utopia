// Seeded deterministic map generation + new-game state assembly — GAME_SPEC.md §12.

import type { GameState, TerrainType, BiomeId, EnemyState, Commodity } from './types';
import { getScenario } from './data/races';
import {
  MAP_W, MAP_H, BORDER, COLONY_CENTRE, START_DATE, DEFAULT_RETAINS, BASE_PRICES,
} from './data/constants';
import { rand, randInt, seedFromString } from './rng';
import { makeBuilding, ti } from './sim/util';
import { regenerateMarket } from './sim/trade';

interface BiomeAccent { terrain: TerrainType; fraction: number; }

const BIOME_ACCENTS: Record<BiomeId, BiomeAccent> = {
  mossy: { terrain: 'moss', fraction: 0.08 },
  volcanic: { terrain: 'lava', fraction: 0.08 },
  desert: { terrain: 'dune', fraction: 0.06 },
  canyon: { terrain: 'rock', fraction: 0.06 },        // extra rock on top of base 6%
  marsh: { terrain: 'water', fraction: 0.07 },
  ice: { terrain: 'ice', fraction: 0.10 },
  crystalline: { terrain: 'crystal', fraction: 0.05 },
  badlands: { terrain: 'rock', fraction: 0.05 },
  tundra: { terrain: 'ice', fraction: 0.10 },
  wasteland: { terrain: 'oil', fraction: 0.06 },
};

const ROCK_FRACTION = 0.06;
const COLONY_CLEAR_RADIUS = 8;       // terrain features keep clear of the start site
const DEPOSIT_EXCLUSION = 10;        // clusters keep ≥10 tiles from colony centre...
const GUARANTEED_MIN = 8;            // ...except one ore + one fuel cluster at 8–12
const GUARANTEED_MAX = 12;

/** Create a fully initialised GameState for the given scenario. */
export function newGame(scenarioId: string, seed?: number): GameState {
  const sc = getScenario(scenarioId);
  const mapSeed = seed ?? seedFromString(scenarioId);

  const n = MAP_W * MAP_H;
  const state: GameState = {
    schemaVersion: 1,
    scenarioId: sc.id,
    mapSeed,
    rng: mapSeed | 0,

    totalDays: 0, dayFraction: 0, dayOfMonth: 0,
    month: START_DATE.month, year: START_DATE.year, monthIndex: 0,
    speed: 1, paused: false, mode: 'playing', gameOverReason: '',

    mapW: MAP_W, mapH: MAP_H,
    terrain: new Array<TerrainType>(n).fill('plain'),
    oreYield: new Array<number>(n).fill(0),
    fuelYield: new Array<number>(n).fill(0),
    tileBuilding: new Array<number>(n).fill(0),
    wreckage: new Array<number>(n).fill(0),

    buildings: [], nextBuildingId: 0,
    units: [], nextUnitId: 0,
    markers: [null, null, null, null, null, null, null, null],

    funds: sc.funds,
    stores: { food: 50, ore: 40, gems: 0, weapons: 0, techGoods: 0 },
    fuelStored: 100,
    airBank: 0,
    podCharge: 0,
    industry: {
      producedLastMonth: { ore: 0, fuel: 0, weapons: 0, techGoods: 0, food: 0, air: 0 },
      foodProductionLastMonth: 0,
    },
    power: { supply: 0, demand: 0, shedTypes: [] },
    shortages: { food: false, air: false, power: false, storesFull: false },

    pop: {
      colonists: 120, technicians: 0, medics: 0, scientists: 0, security: 0,
      securityNew: 0, securityTraining: 0, birthRate: 'medium',
    },
    morale: {
      current: 60, displayed: 60, history12: [60],
      battlesWonThisMonth: 0, battlesLostThisMonth: 0, buildingsLostThisMonth: 0,
      pendingDelta: 0,
    },
    qol: 50,
    crime: {
      index: 0, lastTheftMonth: -99, lastMurdersMonth: -99, lastTerrorismMonth: -99,
      monthsOver90: 0, warned85: false,
    },
    disease: null,

    research: { techLevel: 1, rp: 0, inventions: [] },
    finance: {
      taxRate: 0, pendingTaxRate: 0,
      grants: { military: 0, civilian: 0, intelligence: 0 },
      civSpend12: [],
      lastMonth: {
        taxIncome: 0, supportGrant: 0, tradeNet: 0,
        researchSpend: 0, spyBurn: 0, birthBonus: 0, constructionSpend: 0,
      },
      accTradeNet: 0,
      accConstructionSpend: 0,
    },
    trade: {
      prices: { ...BASE_PRICES },
      supply: { fuel: 0, food: 0, ore: 0, gems: 0, weapons: 0, techGoods: 0 } as Record<Commodity, number>,
      demand: { fuel: 0, food: 0, ore: 0, gems: 0, weapons: 0, techGoods: 0 } as Record<Commodity, number>,
      retain: { ...DEFAULT_RETAINS },
      tradedThisMonth: false,
    },
    spy: { reports: [], monthsSinceReport: 0, reportsAtNormalPlus: 0, cityLocated: false, pendingReportDay: -1 },
    enemy: sc.sandbox ? null : makeEnemyState(sc.id, sc.statMult, sc.firstAttackMonth),
    worldEvents: {
      eclipseUntilMonth: -1, strikeUntilMonth: -1,
      sportsEventCalled: false, sportsEventActiveMonth: -1, lastSportsEventMonth: -1,
    },
    stats: {
      battlesWon: 0, battlesLost: 0, deaths12: [], deathsThisMonth: 0,
      totalDeaths: 0, totalBirths: 0, attacksTotal: 0,
      monthsQol80: 0, monthsQol90: 0, bronzeMedal: false, goldMedal: false,
    },

    notifications: [], nextNotificationId: 0,
    pendingEvents: [], effects: [],
  };

  generateTerrain(state, sc.biome);
  generateDeposits(state, sc.oreClusters, sc.oreRichness, 'ore');
  generateDeposits(state, sc.fuelClusters, sc.fuelRichness, 'fuel');
  placeStartingColony(state);
  regenerateMarket(state);
  return state;
}

function makeEnemyState(raceId: string, statMult: number, firstAttackMonth: number): EnemyState {
  const D = Math.round(600 * statMult);
  return {
    raceId, D, Dmax: D,
    waveNumber: 0, nextWaveMonthIndex: firstAttackMonth,
    recentDDamage: [], destroyed: false, assaultTickDays: 7,
    pendingWaveDay: -1, pendingWaveSize: 0, pendingWaveAir: 0,
    pendingWaveBio: false, pendingWaveWarned: false,
  };
}

// ---------------------------------------------------------------- terrain

function nearColony(x: number, y: number, r: number): boolean {
  return Math.max(Math.abs(x - COLONY_CENTRE.x), Math.abs(y - COLONY_CENTRE.y)) <= r;
}

/** lay `fraction` of interior tiles as random-walk blobs of 4–20 tiles */
function layFeature(state: GameState, terrain: TerrainType, fraction: number): void {
  const interior = (MAP_W - 2 * BORDER) * (MAP_H - 2 * BORDER);
  let target = Math.floor(interior * fraction);
  let guard = 0;
  while (target > 0 && guard++ < 4000) {
    const blob = randInt(state, 4, 20);
    let x = randInt(state, BORDER, MAP_W - BORDER - 1);
    let y = randInt(state, BORDER, MAP_H - BORDER - 1);
    if (nearColony(x, y, COLONY_CLEAR_RADIUS)) continue;
    for (let i = 0; i < blob; i++) {
      if (
        x >= BORDER && y >= BORDER && x < MAP_W - BORDER && y < MAP_H - BORDER &&
        !nearColony(x, y, COLONY_CLEAR_RADIUS) &&
        state.terrain[ti(state, x, y)] === 'plain'
      ) {
        state.terrain[ti(state, x, y)] = terrain;
        target--;
      }
      x += randInt(state, -1, 1);
      y += randInt(state, -1, 1);
    }
  }
}

function generateTerrain(state: GameState, biome: BiomeId): void {
  layFeature(state, 'rock', ROCK_FRACTION);
  const accent = BIOME_ACCENTS[biome];
  layFeature(state, accent.terrain, accent.fraction);
}

// ---------------------------------------------------------------- deposits

function generateDeposits(
  state: GameState, clusters: number, richness: number, kind: 'ore' | 'fuel',
): void {
  const arr = kind === 'ore' ? state.oreYield : state.fuelYield;
  const other = kind === 'ore' ? state.fuelYield : state.oreYield;

  const tileOk = (x: number, y: number): boolean =>
    x >= BORDER && y >= BORDER && x < MAP_W - BORDER && y < MAP_H - BORDER &&
    state.terrain[ti(state, x, y)] === 'plain' &&
    arr[ti(state, x, y)] === 0 && other[ti(state, x, y)] === 0;

  const layCluster = (cx: number, cy: number, fixedYield: number | null): boolean => {
    if (!tileOk(cx, cy)) return false;
    const size = randInt(state, 3, 6);
    let x = cx, y = cy, placed = 0, guard = 0;
    while (placed < size && guard++ < 40) {
      if (tileOk(x, y)) {
        const y9 = fixedYield ?? Math.round(richness + 2 * (rand(state) - 0.5) * 2);
        arr[ti(state, x, y)] = Math.min(9, Math.max(1, y9));
        placed++;
      }
      x += randInt(state, -1, 1);
      y += randInt(state, -1, 1);
    }
    return placed > 0;
  };

  // guaranteed cluster 8–12 tiles from the colony centre, yield = richness
  let guard = 0;
  while (guard++ < 500) {
    const d = randInt(state, GUARANTEED_MIN, GUARANTEED_MAX);
    const ang = rand(state) * Math.PI * 2;
    const gx = Math.round(COLONY_CENTRE.x + Math.cos(ang) * d);
    const gy = Math.round(COLONY_CENTRE.y + Math.sin(ang) * d);
    if (layCluster(gx, gy, richness)) break;
  }

  // remaining clusters anywhere ≥10 tiles from the colony centre
  let remaining = clusters - 1;
  guard = 0;
  while (remaining > 0 && guard++ < 2000) {
    const cx = randInt(state, BORDER, MAP_W - BORDER - 1);
    const cy = randInt(state, BORDER, MAP_H - BORDER - 1);
    if (nearColony(cx, cy, DEPOSIT_EXCLUSION)) continue;
    if (layCluster(cx, cy, null)) remaining--;
  }
}

// ---------------------------------------------------------------- start colony

/** Original-layout starting template — GAME_SPEC.md §12. All pre-built. */
function placeStartingColony(state: GameState): void {
  const clear = (x: number, y: number) => { state.terrain[ti(state, x, y)] = 'plain'; };
  const spots: [number, number][] = [
    [45, 31], [46, 30], [46, 31], [43, 30], [43, 31], [44, 29],
    [40, 29], [40, 30], [40, 31], [40, 32], [44, 31], [45, 30], [42, 31],
  ];
  for (const [x, y] of spots) clear(x, y);

  const cc = makeBuilding(state, 'commandCentre', 45, 31, true);
  cc.active = true;
  makeBuilding(state, 'livingQuarters', 46, 30, true);
  makeBuilding(state, 'livingQuarters', 46, 31, true);
  makeBuilding(state, 'hydroponics', 43, 30, true);
  makeBuilding(state, 'lifeSupport', 43, 31, true);
  makeBuilding(state, 'powerStation', 44, 29, true);
  makeBuilding(state, 'solarPanel', 40, 29, true);
  makeBuilding(state, 'solarPanel', 40, 30, true);
  makeBuilding(state, 'solarPanel', 40, 31, true);
  makeBuilding(state, 'solarPanel', 40, 32, true);
  makeBuilding(state, 'fluxPod', 44, 31, true);
  makeBuilding(state, 'store', 45, 30, true);
  makeBuilding(state, 'fuelTank', 42, 31, true);
}
