// Canonical constants — transcribed from docs/GAME_SPEC.md. Do not re-derive.

import type { BuildingType, Commodity } from '../types';

// ---- map
export const MAP_W = 99;
export const MAP_H = 75;
export const BORDER = 4;                       // unbuildable outer border, every side
export const FLUX_POD_RADIUS = 12;             // Chebyshev build radius
export const DEPOSIT_REVEAL_RADIUS = 6;        // around any friendly building
export const COLONY_CENTRE = { x: 44, y: 32 };

// ---- time
export const DAYS_PER_MONTH = 30;
export const START_DATE = { day: 1, month: 1, year: 2090 };
export const SECONDS_PER_DAY_1X = 1.0;
export const SPEEDS = [1, 2, 5] as const;

// ---- research
export const RP_PER_LEVEL_FACTOR = 400;        // RP for step L→L+1 = 400×L
export const MAX_TECH_LEVEL = 10;
export const GR_PER_SCIENTIST_MONTH = 200;     // full funding
export const MAX_SCIENTISTS_PER_LAB = 10;

// ---- power
export const POWER_STATION_MW = 50;
export const SOLAR_PANEL_MW = 2;
export const SOLAR_GENERATOR_MW = 4;
export const FLUX_POD_CAP_MW = 200;

// ---- life support / food / housing
export const LIVING_QUARTERS_CAPACITY = 50;
export const HYDROPONICS_FEEDS = 100;
export const MORGRO_FEEDS = 200;
export const LIFE_SUPPORT_AIR = 400;
export const LIFE_SUPPORT_BANK_CAP = 800;      // per Life Support building
export const MOSS_CONVERTER_AIR = 200;
export const FOOD_PERISH_MULT = 2;             // food pool capped at 2× monthly production

// ---- storage
export const STORE_CAPACITY = 500;             // shared pool units
export const FUEL_TANK_CAPACITY = 250;
export const FUEL_TANK_CAPACITY_COMPRESSED = 750;

// ---- population
export const BIRTH_RATES: Record<string, number> = { none: 0, low: 0.005, medium: 0.01, high: 0.02 };
export const BIRTH_BONUS_GR = 5;               // per birth at High, paid by Earth
export const BASE_MORTALITY = 0.002;           // 0.2% / month
export const MEDIC_COVER_PER_MEDIC = 40;       // people covered per staffed medic
export const FOOD_SHORTAGE_DEATH_RATE = 0.08;
export const AIR_SHORTAGE_DEATH_RATE = 0.15;
export const BATTLE_DEATHS_PER_BUILDING = 5;
export const BATTLE_DEATHS_PER_LQ = 25;
export const REFUGEE_SHIP_COLONISTS = 20;

// ---- finance
export const TAX_MAX = 20;                     // %
export const TAX_INCOME_FACTOR = 0.08;         // GR = pop × rate% × 0.08, monthly
/** Colony Support Grant: 3,000 GR/mo years 1–3, 1,500 years 4–5, 0 after. */
export function supportGrantForYearIndex(yearIndex: number): number {
  if (yearIndex < 3) return 3000;
  if (yearIndex < 5) return 1500;
  return 0;
}

// ---- crime
export const CRIME_THEFT_THRESHOLD = 25;
export const CRIME_MURDERS_THRESHOLD = 50;
export const CRIME_TERRORISM_THRESHOLD = 70;
export const CRIME_ASSASSINATION_THRESHOLD = 90;
export const CRIME_WARNING_THRESHOLD = 85;
export const CRIME_ASSASSINATION_MONTHS = 3;
export const CRIME_SUPPRESSION_PER_SECURITY = 0.4;
export const CRIME_STAGE_COOLDOWN_MONTHS = 2;

// ---- trade
export const BASE_PRICES: Record<Commodity, number> = {
  fuel: 12, food: 8, ore: 15, gems: 120, weapons: 45, techGoods: 60,
};
export const DEFAULT_RETAINS: Record<Commodity, number> = {
  fuel: 50, food: 80, ore: 50, gems: 0, weapons: 50, techGoods: 0,
};

// ---- QoL weights (sum 100)
export const QOL_WEIGHTS = {
  morale12: 20, crime: 15, deaths: 12, population: 10, tech: 10,
  colonySize: 8, tax: 8, battles: 7, tidiness: 5, environment: 5,
} as const;
export const QOL_MAX_SLEW = 2;                 // points per month
export const MEDAL_BRONZE_QOL = 80;
export const MEDAL_GOLD_QOL = 90;
export const MEDAL_MONTHS = 12;

// ---- combat
export const TURRET_CONE_DEG = 30;
export const TURRET_RANGE = 6;
export const TURRET_DAMAGE = 10;
export const TURRET_FIRE_DAYS = 2;             // 1 shot / 2 days
export const TURRET_ROTATE_DEG = 30;           // +30° every 2 days while scanning
export const PLASMA_RANGE = 7;
export const PLASMA_DAMAGE = 18;
export const MISSILE_RANGE = 10;
export const MISSILE_DAMAGE = 80;
export const HDX_RANGE = 16;
export const HDX_DAMAGE = 140;
export const LAND_MINE_DAMAGE = 120;
export const RADAR_RANGE = 16;
export const RADAR_RANGE_LONG = 28;
export const PATHFIND_NODE_CAP = 4000;
export const MARKER_COUNT = 8;

// ---- ships / fuel
export const FUEL_TAKEOFF = 8;
export const FUEL_LANDING = 4;
export const FUEL_FLIGHT_PER_DAY = 6;
export const FUEL_HOVER_PER_DAY = 3;
export const REFUEL_PAD_PER_DAY = 50;          // landed on pad within 8 of Fuel Tank
export const REFUEL_TRANSPORTER_PER_DAY = 25;  // Matter Transporter, anywhere in flight
export const REFUEL_TANK_RADIUS = 8;
export const SHIP_WU_PER_COLONIST = 2;         // work units / staffed colonist / month
export const SHIPYARD_MAX_STAFF = 30;
export const EXPLORER_PAD_COST = 2600;
export const EXPLORER_PAD_DAYS = 15;           // 0.5 month

// ---- tanks
export const TANK_ORE_COST = 30;
export const TANK_WEAPON_COST = 20;
export const TANK_PROGRESS_PER_TECH = 4;       // % per staffed technician per month
export const TANK_YARD_PARK_LIMIT = 8;

// ---- alien city (off-map)
export const CITY_D_BASE = 600;                // × statMult
export const CITY_D_GROWTH = 40;               // × aggression per month
export const CITY_TRAVEL_DAYS_SHIP = 14;
export const CITY_TRAVEL_DAYS_TANK = 28;
export const CITY_FIRE_PER_UNIT_WEEK = 8;      // × statMult × aggression
export const CITY_VICTORY_MORALE = 20;
export const CITY_VICTORY_BATTLES = 5;
export const CITY_RECALL_THRESHOLD = 0.25;     // ≥25% of D destroyed in last 3 months → waves ×0.5

// ---- spying
export interface SpyLevelDef {
  level: number; name: string; minBalance: number; burn: number;
  reportEveryMonths: number;                   // 0 = none, 0.5 = twice monthly
  warningLeadWeeks: number;
}
export const SPY_LEVELS: SpyLevelDef[] = [
  { level: 1, name: 'Insufficient Funds', minBalance: 0, burn: 0, reportEveryMonths: 0, warningLeadWeeks: 0 },
  { level: 2, name: 'Low Level Surveillance', minBalance: 300, burn: 300, reportEveryMonths: 2, warningLeadWeeks: 1 },
  { level: 3, name: 'Normal Intelligence Activity', minBalance: 800, burn: 800, reportEveryMonths: 1, warningLeadWeeks: 2 },
  { level: 4, name: 'Special Operatives In Use', minBalance: 2000, burn: 2000, reportEveryMonths: 0.5, warningLeadWeeks: 4 },
];

// ---- disease
export const VIRUS_INFECTION_RATE = 0.10;
export const BIO_INFECTION_RATE = 0.15;
export const VACCINATED_INFECTION_RATE = 0.01;
export const VIRUS_DEATH_RATE = 0.01;          // × (1 − 0.7×medicCover)
export const VIRUS_MORALE_PENALTY = 6;

// ---- sports
export const SPORTS_MORALE_BONUS = 12;
export const SPORTS_INDUSTRY_MULT = 0.85;
export const SPORTS_NEGLECT_MONTHS = 3;
export const SPORTS_NEGLECT_PENALTY = 6;

// ---- power shutdown order (first to shed → last)
export const SHUTDOWN_ORDER: BuildingType[] = [
  'workshop', 'armsLab', 'sportsComplex', 'tankYard', 'shipYard', 'mine',
  'chemicalPlant', 'laboratory', 'radar', 'laserTurret', 'missileLauncher',
  'securityHQ', 'hospital', 'hydroponics', 'morgroHydroponics',
  'spaceMossConverter', 'lifeSupport',
];

export const QUICKSTART_FUNDS = 500000;
