// Building placement / demolition — GAME_SPEC.md §1, §12.

import type { GameState, BuildingType } from '../types';
import { BUILDING_DEFS, effectiveBuildType } from '../data/buildings';
import { BORDER } from '../data/constants';
import {
  ti, inBounds, buildingAt, makeBuilding, removeBuilding, withinFluxRadius,
  buildableTerrain, notify, getBuilding, classPoolAdd,
} from './util';

/** returns null if placement is legal, else a human-readable reason */
export function canPlaceBuilding(state: GameState, type: BuildingType, x: number, y: number): string | null {
  const actual = effectiveBuildType(type, state.research.techLevel, state.research.inventions);
  const def = BUILDING_DEFS[actual];
  if (state.research.techLevel < def.techReq) return `Requires tech level ${def.techReq}.`;
  if (
    (actual === 'spaceMossConverter' || actual === 'landMine' || actual === 'matterTransporter' ||
      actual === 'tankTeleport' || actual === 'solarGenerator' || actual === 'morgroHydroponics') &&
    def.techReq > 1 && !hasInventionFor(state, actual)
  ) return `Not yet invented.`;
  if (!inBounds(state, x, y)) return 'Outside the map.';
  if (x < BORDER || y < BORDER || x >= state.mapW - BORDER || y >= state.mapH - BORDER) {
    return 'Cannot build in the map border.';
  }
  const i = ti(state, x, y);
  if (buildingAt(state, x, y)) return 'Tile is occupied.';
  if (state.wreckage[i]) return 'Clear the wreckage first.';
  if (state.units.some((u) => !u.offMap && Math.round(u.x) === x && Math.round(u.y) === y &&
    (u.mode === 'ground' || u.mode === 'landed'))) return 'A unit is on that tile.';
  if (actual === 'spaceMossConverter') {
    if (state.terrain[i] !== 'moss') return 'Space Moss Converters must be built on space moss.';
  } else if (!buildableTerrain(state.terrain[i], actual)) {
    return 'Cannot build on this terrain.';
  }
  if (!withinFluxRadius(state, x, y)) return 'Must be within 12 tiles of a Flux Pod.';
  if (state.funds < def.cost) return 'Insufficient funds.';
  return null;
}

const INVENTION_FOR_BUILDING: Partial<Record<BuildingType, string>> = {
  spaceMossConverter: 'spaceMossConverter',
  landMine: 'landMine',
  solarGenerator: 'solarGenerator',
  morgroHydroponics: 'morgroHydroponics',
  matterTransporter: 'matterTransporter',
  tankTeleport: 'tankTeleport',
};

function hasInventionFor(state: GameState, type: BuildingType): boolean {
  const inv = INVENTION_FOR_BUILDING[type];
  return !inv || state.research.inventions.includes(inv);
}

/** place a scaffold; returns the new building id, or an error string */
export function placeBuilding(state: GameState, type: BuildingType, x: number, y: number): number | string {
  const actual = effectiveBuildType(type, state.research.techLevel, state.research.inventions);
  const err = canPlaceBuilding(state, actual, x, y);
  if (err) return err;
  const def = BUILDING_DEFS[actual];
  state.funds -= def.cost;
  state.finance.accConstructionSpend += def.cost;
  const b = makeBuilding(state, actual, x, y, false);
  // construction starts immediately with whatever free colonists remain
  // (the monthly labour step rebalances crews from scratch)
  const committed = state.buildings.reduce((s, o) =>
    s + (o.status === 'scaffold' ? o.crewAssigned : 0) +
    (o.type === 'shipYard' && o.status === 'complete' ? o.staff : 0), 0);
  b.crewAssigned = Math.max(0, Math.min(def.buildCrew, state.pop.colonists - committed));
  return b.id;
}

/**
 * Demolish: a building (or scaffold) becomes Wreckage; a second demolish on a
 * wreckage tile clears it (instant, free). Returns error string or null.
 */
export function demolish(state: GameState, x: number, y: number): string | null {
  const b = buildingAt(state, x, y);
  if (b) {
    removeBuilding(state, b, false);
    notify(state, 'info', `${BUILDING_DEFS[b.type].name} demolished.`, { x, y });
    return null;
  }
  if (inBounds(state, x, y) && state.wreckage[ti(state, x, y)]) {
    state.wreckage[ti(state, x, y)] = 0;
    return null;
  }
  return 'Nothing to demolish here.';
}

/** set REQD staff (0..maxStaff) on a staffed building. Lowering below current
 *  staff sacks the surplus IMMEDIATELY back to free colonists (brief §8). */
export function setRequiredStaff(state: GameState, buildingId: number, n: number): string | null {
  const b = getBuilding(state, buildingId);
  if (!b) return 'No such building.';
  const def = BUILDING_DEFS[b.type];
  if (def.maxStaff === 0) return 'This building has no staff.';
  b.reqStaff = Math.max(0, Math.min(def.maxStaff, Math.round(n)));
  if (b.staff > b.reqStaff) {
    const fire = b.staff - b.reqStaff;
    b.staff -= fire;
    if (def.staffClass) {
      classPoolAdd(state, def.staffClass, -fire);
      state.pop.colonists += fire;
    }
    // ship-yard crews are plain colonists — dropping the assignment is enough
  }
  return null;
}

/** make the given Command Centre the single active one */
export function activateCommandCentre(state: GameState, buildingId: number): string | null {
  const b = getBuilding(state, buildingId);
  if (!b || b.type !== 'commandCentre' || b.status !== 'complete') return 'Not a completed Command Centre.';
  for (const x of state.buildings) if (x.type === 'commandCentre') x.active = false;
  b.active = true;
  return null;
}
