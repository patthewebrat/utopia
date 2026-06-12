// Building master table — direct transcription of GAME_SPEC.md §1.

import type { BuildingDef, BuildingType } from '../types';
import { SHUTDOWN_ORDER } from './constants';

function prio(type: BuildingType): number {
  return SHUTDOWN_ORDER.indexOf(type); // -1 = never shed (LQ, power, pods, stores...)
}

const defs: BuildingDef[] = [
  { type: 'livingQuarters', name: 'Living Quarters', cost: 1800, buildMonths: 0.5, buildCrew: 10, powerMW: 1, hp: 100, techReq: 1, maxStaff: 0, staffClass: null, shutdownPriority: -1, blurb: 'Houses 50 colonists' },
  { type: 'hydroponics', name: 'Hydroponics', cost: 2400, buildMonths: 0.5, buildCrew: 10, powerMW: 2, hp: 100, techReq: 1, maxStaff: 0, staffClass: null, shutdownPriority: prio('hydroponics'), blurb: 'Food for 100 people/mo' },
  { type: 'morgroHydroponics', name: 'Morgro Hydroponics', cost: 3200, buildMonths: 0.5, buildCrew: 10, powerMW: 2, hp: 100, techReq: 6, maxStaff: 0, staffClass: null, shutdownPriority: prio('morgroHydroponics'), blurb: 'Food for 200 people/mo' },
  { type: 'lifeSupport', name: 'Life Support', cost: 3600, buildMonths: 0.75, buildCrew: 12, powerMW: 4, hp: 100, techReq: 1, maxStaff: 0, staffClass: null, shutdownPriority: prio('lifeSupport'), blurb: 'Air for 400 people/mo; banks surplus (cap 800)' },
  { type: 'spaceMossConverter', name: 'Space Moss Converter', cost: 3200, buildMonths: 0.75, buildCrew: 10, powerMW: 2, hp: 100, techReq: 3, maxStaff: 0, staffClass: null, shutdownPriority: prio('spaceMossConverter'), blurb: 'Air for 200 people/mo; must be built on space moss' },
  { type: 'powerStation', name: 'Power Station', cost: 6000, buildMonths: 1.0, buildCrew: 20, powerMW: 0, hp: 100, techReq: 1, maxStaff: 0, staffClass: null, shutdownPriority: -1, blurb: '50 MW/mo' },
  { type: 'solarPanel', name: 'Solar Panel', cost: 600, buildMonths: 0.25, buildCrew: 4, powerMW: 0, hp: 60, techReq: 1, maxStaff: 0, staffClass: null, shutdownPriority: -1, blurb: '2 MW/mo (0 during eclipse)' },
  { type: 'solarGenerator', name: 'Solar Generator', cost: 1000, buildMonths: 0.25, buildCrew: 4, powerMW: 0, hp: 60, techReq: 5, maxStaff: 0, staffClass: null, shutdownPriority: -1, blurb: '4 MW/mo (0 during eclipse)' },
  { type: 'fluxPod', name: 'Flux Pod', cost: 1200, buildMonths: 0.5, buildCrew: 8, powerMW: 0, hp: 60, techReq: 1, maxStaff: 0, staffClass: null, shutdownPriority: -1, blurb: 'Defines 12-tile build radius; banks 200 MW' },
  { type: 'hospital', name: 'Hospital', cost: 5200, buildMonths: 1.5, buildCrew: 20, powerMW: 3, hp: 100, techReq: 1, maxStaff: 10, staffClass: 'medic', shutdownPriority: prio('hospital'), blurb: 'Birth-rate control; death/disease reduction' },
  { type: 'laboratory', name: 'Laboratory', cost: 4800, buildMonths: 1.0, buildCrew: 16, powerMW: 3, hp: 100, techReq: 1, maxStaff: 10, staffClass: 'scientist', shutdownPriority: prio('laboratory'), blurb: 'Research' },
  { type: 'mine', name: 'Mine', cost: 7400, buildMonths: 1.5, buildCrew: 20, powerMW: 4, hp: 100, techReq: 1, maxStaff: 10, staffClass: 'technician', shutdownPriority: prio('mine'), blurb: 'Ore: deposit yield × staffed techs /mo' },
  { type: 'chemicalPlant', name: 'Chemical Plant', cost: 8200, buildMonths: 1.5, buildCrew: 20, powerMW: 4, hp: 100, techReq: 1, maxStaff: 10, staffClass: 'technician', shutdownPriority: prio('chemicalPlant'), blurb: 'Fuel: deposit yield × staffed techs /mo' },
  { type: 'armsLab', name: 'Arms Laboratory', cost: 6800, buildMonths: 1.5, buildCrew: 20, powerMW: 5, hp: 100, techReq: 1, maxStaff: 10, staffClass: 'technician', shutdownPriority: prio('armsLab'), blurb: 'Weapons: 1 × staffed techs /mo' },
  { type: 'workshop', name: 'Workshop', cost: 5600, buildMonths: 1.0, buildCrew: 16, powerMW: 4, hp: 100, techReq: 1, maxStaff: 10, staffClass: 'technician', shutdownPriority: prio('workshop'), blurb: 'Tech goods: 1.5 × staffed techs /mo (trade only)' },
  { type: 'store', name: 'Store', cost: 2000, buildMonths: 0.5, buildCrew: 8, powerMW: 1, hp: 100, techReq: 1, maxStaff: 0, staffClass: null, shutdownPriority: -1, blurb: '500-unit shared store pool' },
  { type: 'fuelTank', name: 'Fuel Tank', cost: 1600, buildMonths: 0.5, buildCrew: 8, powerMW: 0, hp: 100, techReq: 1, maxStaff: 0, staffClass: null, shutdownPriority: -1, blurb: '250 fuel (750 with Compressed Fuel Tanks)' },
  { type: 'commandCentre', name: 'Command Centre', cost: 9500, buildMonths: 2.0, buildCrew: 25, powerMW: 6, hp: 200, techReq: 1, maxStaff: 0, staffClass: null, shutdownPriority: -1, blurb: 'Required for trade, yards, alien-city attacks' },
  { type: 'securityHQ', name: 'Security HQ', cost: 4400, buildMonths: 1.0, buildCrew: 16, powerMW: 3, hp: 100, techReq: 1, maxStaff: 10, staffClass: 'security', shutdownPriority: prio('securityHQ'), blurb: 'Crime suppression' },
  { type: 'sportsComplex', name: 'Sports Complex', cost: 7000, buildMonths: 2.0, buildCrew: 20, powerMW: 5, hp: 100, techReq: 1, maxStaff: 0, staffClass: null, shutdownPriority: prio('sportsComplex'), blurb: 'Call 1 event/mo: morale +12, industry ×0.85' },
  { type: 'radar', name: 'Radar', cost: 3800, buildMonths: 0.75, buildCrew: 10, powerMW: 3, hp: 100, techReq: 1, maxStaff: 0, staffClass: null, shutdownPriority: prio('radar'), blurb: 'Reveals enemies within 16 tiles (Long Distance: 28)' },
  { type: 'laserTurret', name: 'Laser Turret', cost: 4200, buildMonths: 0.75, buildCrew: 10, powerMW: 2, hp: 120, techReq: 1, maxStaff: 0, staffClass: null, shutdownPriority: prio('laserTurret'), blurb: 'Auto-fire, 30° cone, 6-tile range' },
  { type: 'missileLauncher', name: 'Missile Launcher', cost: 3400, buildMonths: 0.5, buildCrew: 8, powerMW: 1, hp: 120, techReq: 1, maxStaff: 0, staffClass: null, shutdownPriority: prio('missileLauncher'), blurb: '1 player-fired missile, range 10, 80 dmg' },
  { type: 'tankYard', name: 'Tank Construction Yard', cost: 8800, buildMonths: 2.0, buildCrew: 25, powerMW: 8, hp: 100, techReq: 1, maxStaff: 10, staffClass: 'technician', shutdownPriority: prio('tankYard'), blurb: 'Builds tanks continuously (30 ore + 20 weapons)' },
  { type: 'shipYard', name: 'Ship Construction Yard', cost: 10500, buildMonths: 2.5, buildCrew: 30, powerMW: 10, hp: 100, techReq: 1, maxStaff: 30, staffClass: null, shutdownPriority: prio('shipYard'), blurb: 'Builds one ship at a time; needs adjacent free Launch Pad' },
  { type: 'launchPad', name: 'Launch Pad', cost: 2600, buildMonths: 0.75, buildCrew: 10, powerMW: 1, hp: 100, techReq: 1, maxStaff: 0, staffClass: null, shutdownPriority: -1, blurb: 'Holds/refuels 1 ship (Fuel Tank within 8 tiles)' },
  { type: 'landMine', name: 'Land Mine', cost: 800, buildMonths: 0.25, buildCrew: 4, powerMW: 0, hp: 100, techReq: 4, maxStaff: 0, staffClass: null, shutdownPriority: -1, blurb: 'Detonates under enemy land units: 120 dmg, single use' },
  { type: 'matterTransporter', name: 'Matter Transporter', cost: 5400, buildMonths: 1.0, buildCrew: 12, powerMW: 6, hp: 100, techReq: 8, maxStaff: 0, staffClass: null, shutdownPriority: -1, blurb: 'Auto-refuels friendly ships in flight anywhere' },
  { type: 'tankTeleport', name: 'Tank Teleport', cost: 6200, buildMonths: 1.0, buildCrew: 12, powerMW: 8, hp: 100, techReq: 10, maxStaff: 0, staffClass: null, shutdownPriority: -1, blurb: 'Drive a tank on, teleport it to a marker' },
];

export const BUILDING_DEFS: Record<BuildingType, BuildingDef> =
  Object.fromEntries(defs.map((d) => [d.type, d])) as Record<BuildingType, BuildingDef>;

export const BUILDING_TYPES: BuildingType[] = defs.map((d) => d.type);

/** building types that the Plasma Gun / upgrades replace for FUTURE builds */
export function effectiveBuildType(requested: BuildingType, techLevel: number, inventions: string[]): BuildingType {
  if (requested === 'hydroponics' && inventions.includes('morgroHydroponics')) return 'morgroHydroponics';
  if (requested === 'solarPanel' && inventions.includes('solarGenerator')) return 'solarGenerator';
  void techLevel;
  return requested;
}
