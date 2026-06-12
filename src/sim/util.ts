// Shared sim helpers. All functions mutate GameState in place (pure data).

import type {
  GameState, BuildingInstance, BuildingType, UnitInstance, UnitKind,
  TerrainType, NotificationKind, TileRef, StaffClass,
} from '../types';
import { BUILDING_DEFS } from '../data/buildings';
import { UNIT_DEFS } from '../data/ships';
import {
  FUEL_TANK_CAPACITY, FUEL_TANK_CAPACITY_COMPRESSED, STORE_CAPACITY,
  LIVING_QUARTERS_CAPACITY, FLUX_POD_CAP_MW, MEDIC_COVER_PER_MEDIC,
} from '../data/constants';

export function ti(state: GameState, x: number, y: number): number {
  return y * state.mapW + x;
}

export function inBounds(state: GameState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < state.mapW && y < state.mapH;
}

export function cheb(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// ---- terrain rules
const GROUND_BLOCKERS: TerrainType[] = ['rock', 'moss', 'ice', 'lava', 'water', 'crystal', 'oil'];
const HOVER_BLOCKERS: TerrainType[] = ['water', 'oil'];

export function blocksGround(t: TerrainType): boolean { return GROUND_BLOCKERS.includes(t); }
export function blocksHover(t: TerrainType): boolean { return HOVER_BLOCKERS.includes(t); }
export function buildableTerrain(t: TerrainType, type: BuildingType): boolean {
  if (t === 'moss') return type === 'spaceMossConverter';
  return t === 'plain' || t === 'dune';
}

// ---- notifications
export function notify(
  state: GameState, kind: NotificationKind, text: string, loc: TileRef | null = null,
): void {
  const note = {
    id: state.nextNotificationId++,
    monthIndex: state.monthIndex,
    totalDays: state.totalDays,
    kind, text, loc,
  };
  state.notifications.push(note);
  // keep the archive (and therefore every save/autosave) bounded
  if (state.notifications.length > 400) {
    state.notifications.splice(0, state.notifications.length - 200);
  }
  state.pendingEvents.push({ type: 'notification', note });
}

/** add (or with n<0, remove) people to a staff-class pool */
export function classPoolAdd(state: GameState, cls: StaffClass, n: number): void {
  if (cls === 'technician') state.pop.technicians += n;
  else if (cls === 'medic') state.pop.medics += n;
  else if (cls === 'scientist') state.pop.scientists += n;
  else state.pop.security += n;
}

// ---- buildings
export function makeBuilding(
  state: GameState, type: BuildingType, x: number, y: number, complete: boolean,
): BuildingInstance {
  const def = BUILDING_DEFS[type];
  const b: BuildingInstance = {
    id: state.nextBuildingId++,
    type, x, y,
    hp: def.hp,
    status: complete ? 'complete' : 'scaffold',
    progress: complete ? def.buildMonths : 0,
    crewAssigned: 0,
    staff: 0,
    reqStaff: def.maxStaff,
    powered: true,
    active: false,
    facing: 0,
    lastShotDay: -999,
    fired: false,
    plasma: type === 'laserTurret' && state.research.inventions.includes('plasmaGun'),
    longRange: type === 'radar' && state.research.inventions.includes('longDistanceRadar'),
    compressed: type === 'fuelTank' && state.research.inventions.includes('compressedFuelTanks'),
    hdx: type === 'missileLauncher' && state.research.inventions.includes('hdxMissileLauncher'),
    tankProgress: -1,
    shipOrder: null,
    padShipId: -1,
  };
  state.buildings.push(b);
  state.tileBuilding[ti(state, x, y)] = b.id + 1;
  buildingIndexCache.get(state.buildings)?.set(b.id, b);
  return b;
}

// transient id→building index, keyed by the buildings array identity (every
// removal replaces the array via filter(), which invalidates the cache)
const buildingIndexCache = new WeakMap<BuildingInstance[], Map<number, BuildingInstance>>();
function buildingIndex(state: GameState): Map<number, BuildingInstance> {
  let idx = buildingIndexCache.get(state.buildings);
  if (!idx) {
    idx = new Map(state.buildings.map((b) => [b.id, b]));
    buildingIndexCache.set(state.buildings, idx);
  }
  return idx;
}

export function buildingAt(state: GameState, x: number, y: number): BuildingInstance | null {
  if (!inBounds(state, x, y)) return null;
  const v = state.tileBuilding[ti(state, x, y)];
  if (v <= 0) return null;
  return buildingIndex(state).get(v - 1) ?? null;
}

export function getBuilding(state: GameState, id: number): BuildingInstance | null {
  return buildingIndex(state).get(id) ?? null;
}

export function completeBuildings(state: GameState, type?: BuildingType): BuildingInstance[] {
  return state.buildings.filter((b) => b.status === 'complete' && (!type || b.type === type));
}

export function activeCommandCentre(state: GameState): BuildingInstance | null {
  return state.buildings.find(
    (b) => b.type === 'commandCentre' && b.status === 'complete' && b.active && b.powered,
  ) ?? null;
}

/** remove a building from the map; leaves wreckage unless `clean` */
export function removeBuilding(state: GameState, b: BuildingInstance, clean: boolean): void {
  const i = ti(state, b.x, b.y);
  state.tileBuilding[i] = 0;
  if (!clean) state.wreckage[i] = 1;
  // staff return to the free colonist pool (class workers convert back;
  // ship-yard crews were never converted, so just drop the assignment)
  if (b.staff > 0) {
    const def = BUILDING_DEFS[b.type];
    if (def.staffClass) {
      classPoolAdd(state, def.staffClass, -b.staff);
      state.pop.colonists += b.staff;
    }
    b.staff = 0;
  }
  b.crewAssigned = 0; // scaffold crews are free colonists (never subtracted)
  state.buildings = state.buildings.filter((x) => x.id !== b.id);
  // auto-activate another Command Centre if the active one is gone
  if (b.type === 'commandCentre' && b.active) {
    const next = state.buildings.find((x) => x.type === 'commandCentre' && x.status === 'complete');
    if (next) {
      next.active = true;
      notify(state, 'warning', 'Command Centre lost — a reserve centre has assumed command.');
    }
  }
}

// ---- units
export function makeUnit(
  state: GameState, kind: UnitKind, owner: 'player' | 'enemy', x: number, y: number,
  hpMult = 1, dmgMult = 1,
): UnitInstance {
  const def = UNIT_DEFS[kind];
  const u: UnitInstance = {
    id: state.nextUnitId++,
    kind, owner, x, y,
    hp: Math.round(def.hp * hpMult),
    maxHp: Math.round(def.hp * hpMult),
    damage: Math.round(def.damage * dmgMult),
    fuel: def.fuelCap > 0 ? def.fuelCap : -1,
    mode: def.isShip ? 'landed' : 'ground',
    landOnArrival: true,
    path: null,
    dest: null,
    lastShotDay: -999,
    offMap: null,
    offMapDaysLeft: 0,
    padBuildDaysLeft: -1,
  };
  state.units.push(u);
  return u;
}

export function getUnit(state: GameState, id: number): UnitInstance | null {
  return state.units.find((u) => u.id === id) ?? null;
}

// ---- capacities & population
export function fuelCapacity(state: GameState): number {
  let cap = 0;
  for (const b of completeBuildings(state, 'fuelTank')) {
    cap += b.compressed ? FUEL_TANK_CAPACITY_COMPRESSED : FUEL_TANK_CAPACITY;
  }
  return cap;
}

export function storeCapacity(state: GameState): number {
  return completeBuildings(state, 'store').length * STORE_CAPACITY;
}

export function podCapacity(state: GameState): number {
  return completeBuildings(state, 'fluxPod').length * FLUX_POD_CAP_MW;
}

export function housingCapacity(state: GameState): number {
  return completeBuildings(state, 'livingQuarters').length * LIVING_QUARTERS_CAPACITY;
}

export function totalPop(state: GameState): number {
  const p = state.pop;
  return p.colonists + p.technicians + p.medics + p.scientists + p.security;
}

export function staffedMedics(state: GameState): number {
  return completeBuildings(state, 'hospital')
    .filter((b) => b.powered)
    .reduce((s, b) => s + b.staff, 0);
}

export function medicCover(state: GameState): number {
  const pop = totalPop(state);
  if (pop <= 0) return 0;
  return Math.min(1, (staffedMedics(state) * MEDIC_COVER_PER_MEDIC) / pop);
}

/** kill n people, colonists first then classes proportionally; returns actual killed */
export function killPopulation(state: GameState, n: number): number {
  let remaining = Math.max(0, Math.round(n));
  let killed = 0;
  const p = state.pop;
  const take = (key: 'colonists' | 'technicians' | 'medics' | 'scientists' | 'security') => {
    if (remaining <= 0) return;
    const t = Math.min(p[key], remaining);
    p[key] -= t; remaining -= t; killed += t;
  };
  take('colonists'); take('technicians'); take('medics'); take('scientists'); take('security');
  // staffing cannot exceed remaining class pools — trim if needed
  trimStaffToPools(state);
  state.stats.deathsThisMonth += killed;
  state.stats.totalDeaths += killed;
  return killed;
}

export function trimStaffToPools(state: GameState): void {
  const pools: Record<string, number> = {
    technician: state.pop.technicians,
    medic: state.pop.medics,
    scientist: state.pop.scientists,
    security: state.pop.security,
  };
  for (const b of state.buildings) {
    const def = BUILDING_DEFS[b.type];
    if (!def.staffClass) continue;
    const avail = pools[def.staffClass];
    if (b.staff > avail) b.staff = avail;
    pools[def.staffClass] = avail - b.staff;
  }
}

/** is (x,y) within the flux-pod build radius (12, Chebyshev)? Completed pods only. */
export function withinFluxRadius(state: GameState, x: number, y: number): boolean {
  for (const b of state.buildings) {
    if (b.type !== 'fluxPod' || b.status !== 'complete') continue;
    if (cheb(b.x, b.y, x, y) <= 12) return true;
  }
  return false;
}
