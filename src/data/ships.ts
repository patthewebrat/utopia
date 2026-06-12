// Military hardware tables — GAME_SPEC.md §3. fuelCap -1 = does not use fuel.

import type { UnitDef, UnitKind, ShipType } from '../types';

const defs: UnitDef[] = [
  // ships
  { kind: 'explorer', name: 'Explorer', isShip: true, hp: 60, damage: 0, fireRateDays: 0, range: 0, speed: 3.0, fuelCap: 200, oreCost: 40, weaponCost: 0, workUnits: 60 },
  { kind: 'fighter', name: 'Fighter', isShip: true, hp: 100, damage: 8, fireRateDays: 1, range: 3, speed: 4.0, fuelCap: 160, oreCost: 60, weaponCost: 30, workUnits: 80 },
  { kind: 'assaultCraft', name: 'Assault Craft', isShip: true, hp: 160, damage: 14, fireRateDays: 1, range: 3, speed: 3.5, fuelCap: 220, oreCost: 100, weaponCost: 60, workUnits: 120 },
  { kind: 'cruiser', name: 'Cruiser', isShip: true, hp: 240, damage: 22, fireRateDays: 1, range: 4, speed: 3.0, fuelCap: 300, oreCost: 160, weaponCost: 100, workUnits: 160 },
  { kind: 'warship', name: 'Warship', isShip: true, hp: 340, damage: 32, fireRateDays: 1, range: 4, speed: 2.5, fuelCap: 400, oreCost: 240, weaponCost: 160, workUnits: 200 },
  { kind: 'fusionCruiser', name: 'Fusion Cruiser', isShip: true, hp: 260, damage: 24, fireRateDays: 1, range: 4, speed: 3.0, fuelCap: -1, oreCost: 140, weaponCost: 80, workUnits: 120 },
  // tanks
  { kind: 'tank', name: 'Tank', isShip: false, hp: 80, damage: 10, fireRateDays: 1, range: 2, speed: 1.5, fuelCap: -1, oreCost: 30, weaponCost: 20, workUnits: 0 },
  { kind: 'hoverTank', name: 'Hover Tank', isShip: false, hp: 110, damage: 14, fireRateDays: 1, range: 3, speed: 2.0, fuelCap: -1, oreCost: 30, weaponCost: 20, workUnits: 0 },
  // enemy baselines (player Fighter/Tank/Assault Craft × scenario statMult, applied at spawn)
  { kind: 'enemyTank', name: 'Alien Tank', isShip: false, hp: 80, damage: 10, fireRateDays: 1, range: 2, speed: 1.5, fuelCap: -1, oreCost: 0, weaponCost: 0, workUnits: 0 },
  { kind: 'enemyFighter', name: 'Alien Fighter', isShip: true, hp: 100, damage: 8, fireRateDays: 1, range: 3, speed: 4.0, fuelCap: -1, oreCost: 0, weaponCost: 0, workUnits: 0 },
  { kind: 'enemyAssault', name: 'Alien Assault Craft', isShip: true, hp: 160, damage: 14, fireRateDays: 1, range: 3, speed: 3.5, fuelCap: -1, oreCost: 0, weaponCost: 0, workUnits: 0 },
];

export const UNIT_DEFS: Record<UnitKind, UnitDef> =
  Object.fromEntries(defs.map((d) => [d.kind, d])) as Record<UnitKind, UnitDef>;

export const SHIP_TYPES: ShipType[] = ['explorer', 'fighter', 'assaultCraft', 'cruiser', 'warship', 'fusionCruiser'];

/** ship type buildable check (Fusion Cruiser is TL10) */
export function shipTechReq(ship: ShipType): number {
  return ship === 'fusionCruiser' ? 10 : 1;
}
