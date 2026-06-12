// Engine facade — the ONLY surface the renderer/UI/main loop should call.
// All player commands mutate GameState through these functions; engine.advance()
// drives the simulation and pumps queued sim events onto the global `events` bus.

import type {
  GameState, BuildingType, ShipType, Commodity, BirthRateSetting, TileRef,
} from './types';
import { newGame } from './mapgen';
import { advanceTime } from './sim/tick';
import { events } from './events';
import { migrateState } from './save';
import {
  canPlaceBuilding as simCanPlace, placeBuilding as simPlace, demolish as simDemolish,
  setRequiredStaff as simSetReqStaff, activateCommandCentre,
} from './sim/build';
import {
  orderTankToTile, orderShipToTile, stopUnit as simStop, explorerBuildPad,
  useTankTeleport,
} from './sim/units';
import { fireMissile as simFireMissile } from './sim/combat';
import { sendToAlienCity as simSendToCity } from './sim/ai';
import {
  manualTrade as simManualTrade, dumpCommodity as simDump,
} from './sim/trade';
import { shipTechReq, UNIT_DEFS } from './data/ships';
import { TAX_MAX, MARKER_COUNT, DEPOSIT_REVEAL_RADIUS } from './data/constants';
import { getBuilding, getUnit, dist, cheb, notify, totalPop, activeCommandCentre as ccOf } from './sim/util';

export { events };
export { SCENARIOS, getScenario } from './data/races';
export { BUILDING_DEFS, BUILDING_TYPES, effectiveBuildType } from './data/buildings';
export { UNIT_DEFS, SHIP_TYPES } from './data/ships';
export { INVENTIONS } from './data/inventions';
export { rpForStep, cumulativeRp } from './data/research';
export { currentSpyLevel } from './sim/spy';
export { findPath } from './sim/units';
export { totalPop, housingCapacity, fuelCapacity, storeCapacity, medicCover } from './sim/util';

// ---------------------------------------------------------------- lifecycle

/** create a fresh game (optionally with an explicit map seed) */
export function createGame(scenarioId: string, seed?: number): GameState {
  return newGame(scenarioId, seed);
}

/**
 * Advance the simulation by dtSeconds of real time. Speed and pause are
 * applied here (1 game day = 1 s at 1×). Queued sim events are emitted on
 * the `events` bus after the state has settled.
 */
export function advance(state: GameState, dtSeconds: number): void {
  if (!state.paused && state.mode === 'playing') {
    advanceTime(state, dtSeconds * state.speed);
  }
  if (state.pendingEvents.length > 0) {
    const queue = state.pendingEvents.splice(0, state.pendingEvents.length);
    for (const e of queue) events.emit(e);
  }
}

export function setSpeed(state: GameState, speed: 1 | 2 | 5): void { state.speed = speed; }
export function setPaused(state: GameState, paused: boolean): void { state.paused = paused; }

// ---------------------------------------------------------------- building

export function canBuild(state: GameState, type: BuildingType, x: number, y: number): string | null {
  return simCanPlace(state, type, x, y);
}
/** returns new building id, or an error string */
export function build(state: GameState, type: BuildingType, x: number, y: number): number | string {
  return simPlace(state, type, x, y);
}
/** demolish building → wreckage; demolish wreckage → cleared */
export function demolish(state: GameState, x: number, y: number): string | null {
  return simDemolish(state, x, y);
}
export function setRequiredStaff(state: GameState, buildingId: number, n: number): string | null {
  return simSetReqStaff(state, buildingId, n);
}
export function toggleCommandCentre(state: GameState, buildingId: number): string | null {
  return activateCommandCentre(state, buildingId);
}

// ---------------------------------------------------------------- finance / policy

/** sets the PENDING tax rate; it locks in on the next 1 January */
export function setTax(state: GameState, pct: number): void {
  state.finance.pendingTaxRate = Math.max(0, Math.min(TAX_MAX, Math.round(pct)));
}
/** top up a grant balance from colony funds */
export function addGrant(state: GameState, which: 'military' | 'civilian' | 'intelligence', amount: number): string | null {
  const amt = Math.max(0, Math.round(amount));
  if (amt > state.funds) return 'Insufficient funds.';
  state.funds -= amt;
  state.finance.grants[which] += amt;
  return null;
}
export function setBirthRate(state: GameState, rate: BirthRateSetting): void {
  state.pop.birthRate = rate;
}

// ---------------------------------------------------------------- trade

export function setRetain(state: GameState, commodity: Commodity, pct: number): void {
  state.trade.retain[commodity] = Math.max(0, Math.min(100, Math.round(pct)));
}
/** positive = buy, negative = sell; once per calendar month */
export function manualTrade(state: GameState, order: Partial<Record<Commodity, number>>): string | null {
  return simManualTrade(state, order);
}
export function dumpCommodity(state: GameState, commodity: Commodity, amount: number): void {
  simDump(state, commodity, amount);
}

// ---------------------------------------------------------------- markers & units

/** place (or move) marker 1–8; placing on its own tile removes it */
export function placeMarker(state: GameState, slot: number, x: number, y: number): void {
  if (slot < 0 || slot >= MARKER_COUNT) return;
  const m = state.markers[slot];
  if (m && m.x === x && m.y === y) state.markers[slot] = null;
  else state.markers[slot] = { x, y };
}
export function clearMarker(state: GameState, slot: number): void {
  if (slot >= 0 && slot < MARKER_COUNT) state.markers[slot] = null;
}
export function clearAllMarkers(state: GameState): void {
  for (let i = 0; i < MARKER_COUNT; i++) state.markers[i] = null;
}

/** send one tank to marker slot */
export function orderTank(state: GameState, tankId: number, markerSlot: number): string | null {
  const m = state.markers[markerSlot];
  if (!m) return 'No such marker.';
  return orderTankToTile(state, tankId, m.x, m.y);
}

/** send the N tanks nearest the marker (or nearest a reference tank) to it */
export function orderTanksNearest(
  state: GameState, markerSlot: number, n: number, nearUnitId?: number,
): number {
  const m = state.markers[markerSlot];
  if (!m) return 0;
  const refUnit = nearUnitId !== undefined ? getUnit(state, nearUnitId) : null;
  const ref: TileRef = refUnit ? { x: refUnit.x, y: refUnit.y } : m;
  const tanks = state.units
    .filter((u) => u.owner === 'player' && !u.offMap && (u.kind === 'tank' || u.kind === 'hoverTank'))
    .sort((a, b) => dist(a.x, a.y, ref.x, ref.y) - dist(b.x, b.y, ref.x, ref.y))
    .slice(0, Math.max(0, n));
  let sent = 0;
  for (const t of tanks) if (orderTankToTile(state, t.id, m.x, m.y) === null) sent++;
  return sent;
}

/** ship to marker; landOnArrival false = hover on arrival */
export function orderShip(state: GameState, shipId: number, markerSlot: number, landOnArrival: boolean): string | null {
  const m = state.markers[markerSlot];
  if (!m) return 'No such marker.';
  return orderShipToTile(state, shipId, m.x, m.y, landOnArrival);
}
export function stopUnit(state: GameState, unitId: number): void { simStop(state, unitId); }
export { explorerBuildPad, useTankTeleport };

/** order a ship at a Ship Yard (resources consumed up front) */
export function buildShip(state: GameState, yardId: number, ship: ShipType): string | null {
  const yard = getBuilding(state, yardId);
  if (!yard || yard.type !== 'shipYard' || yard.status !== 'complete') return 'Not a Ship Yard.';
  if (yard.shipOrder) return 'A ship is already under construction.';
  if (!ccOf(state)) return 'No active powered Command Centre.';
  if (state.research.techLevel < shipTechReq(ship)) return 'Tech level too low.';
  const def = UNIT_DEFS[ship];
  if (state.stores.ore < def.oreCost) return 'Not enough ore.';
  if (state.stores.weapons < def.weaponCost) return 'Not enough weapons.';
  state.stores.ore -= def.oreCost;
  state.stores.weapons -= def.weaponCost;
  yard.shipOrder = { ship, workDone: 0 };
  notify(state, 'info', `${def.name} laid down at the Ship Yard.`, { x: yard.x, y: yard.y });
  return null;
}

// ---------------------------------------------------------------- combat / special

export function fireMissile(state: GameState, launcherId: number, x: number, y: number): string | null {
  return simFireMissile(state, launcherId, x, y);
}
export function sendToAlienCity(state: GameState, unitId: number): string | null {
  return simSendToCity(state, unitId);
}
export function callSportsEvent(state: GameState): string | null {
  const complex = state.buildings.some(
    (b) => b.type === 'sportsComplex' && b.status === 'complete' && b.powered,
  );
  if (!complex) return 'No powered Sports Complex.';
  if (state.worldEvents.sportsEventCalled) return 'An event is already booked.';
  if (state.worldEvents.sportsEventActiveMonth === state.monthIndex) return 'An event is already running.';
  state.worldEvents.sportsEventCalled = true;
  notify(state, 'info', 'Sports event scheduled — opens on the 1st of next month.');
  return null;
}

// ---------------------------------------------------------------- queries (read helpers)

/** is the deposit on (x,y) visible to the player? */
export function depositVisible(state: GameState, x: number, y: number, kind: 'ore' | 'fuel'): boolean {
  const inv = kind === 'ore' ? 'oreDetector' : 'fuelDetector';
  if (state.research.inventions.includes(inv)) return true;
  for (const b of state.buildings) {
    if (cheb(b.x, b.y, x, y) <= DEPOSIT_REVEAL_RADIUS) return true;
  }
  return false;
}

/** is an enemy unit visible (radar coverage / spy satellite)? */
export function enemyVisible(state: GameState, ux: number, uy: number): boolean {
  if (state.research.inventions.includes('spySatellite')) return true;
  for (const b of state.buildings) {
    if (b.type !== 'radar' || b.status !== 'complete' || !b.powered) continue;
    const range = b.longRange ? 28 : 16;
    if (dist(b.x, b.y, ux, uy) <= range) return true;
  }
  // anything close to the colony is always seen
  for (const b of state.buildings) if (dist(b.x, b.y, ux, uy) <= 10) return true;
  return false;
}

/** save/load: GameState IS the save file */
export function serialize(state: GameState): string {
  return JSON.stringify(state);
}
export function deserialize(json: string): GameState {
  const state = JSON.parse(json) as GameState;
  if (typeof state.schemaVersion !== 'number' || !Array.isArray(state.terrain)) {
    throw new Error('Not a valid UTOPIA save file.');
  }
  return migrateState(state);
}

export function populationOf(state: GameState): number { return totalPop(state); }
