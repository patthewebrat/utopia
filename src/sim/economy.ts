// Labour allocation, power balance, production, consumption, finance.
// GAME_SPEC.md §1, §4 (tick steps 1–4 and 11).

import type { GameState } from '../types';
import { BUILDING_DEFS } from '../data/buildings';
import {
  POWER_STATION_MW, SOLAR_PANEL_MW, SOLAR_GENERATOR_MW,
  HYDROPONICS_FEEDS, MORGRO_FEEDS, LIFE_SUPPORT_AIR, MOSS_CONVERTER_AIR,
  LIFE_SUPPORT_BANK_CAP, FOOD_PERISH_MULT, SPORTS_INDUSTRY_MULT,
  TANK_ORE_COST, TANK_WEAPON_COST, TANK_PROGRESS_PER_TECH, TANK_YARD_PARK_LIMIT,
  SHIP_WU_PER_COLONIST, TAX_INCOME_FACTOR, supportGrantForYearIndex,
} from '../data/constants';
import { UNIT_DEFS } from '../data/ships';
import { rand } from '../rng';
import {
  completeBuildings, fuelCapacity, storeCapacity, podCapacity, totalPop,
  notify, makeUnit, ti, blocksGround, inBounds, buildingAt, activeCommandCentre, clamp,
  classPoolAdd,
} from './util';

export interface MonthContext {
  unfed: number;
  unsupplied: number;
  industryMult: number;
}

// ---------------------------------------------------------------- step 1: labour

export function allocateLabour(state: GameState): void {
  const strike = state.monthIndex < state.worldEvents.strikeUntilMonth;

  // sack first: REQD below current staff returns workers to the free pool
  for (const b of state.buildings) {
    const def = BUILDING_DEFS[b.type];
    if (def.staffClass && b.staff > b.reqStaff) {
      const fire = b.staff - b.reqStaff;
      b.staff -= fire;
      classPoolAdd(state, def.staffClass, -fire);
      state.pop.colonists += fire;
    }
    if (b.type === 'shipYard' && b.staff > b.reqStaff) b.staff = b.reqStaff;
  }

  let freePool = state.pop.colonists;
  // ship-yard crews are plain colonists, recomputed monthly
  for (const b of completeBuildings(state, 'shipYard')) { b.staff = 0; }

  // (a) colony support is implicit (food/power/air buildings are unstaffed)
  // (b) construction — oldest scaffold first
  const scaffolds = state.buildings
    .filter((b) => b.status === 'scaffold')
    .sort((a, b) => a.id - b.id);
  for (const s of scaffolds) {
    if (strike) { s.crewAssigned = 0; continue; }
    const def = BUILDING_DEFS[s.type];
    s.crewAssigned = Math.min(def.buildCrew, Math.max(0, freePool));
    freePool -= s.crewAssigned;
  }

  // (c) industry — fill vacancies pro-rata by vacancy count
  const hireable = state.buildings.filter((b) => {
    if (b.status !== 'complete') return false;
    const def = BUILDING_DEFS[b.type];
    return (def.staffClass !== null || b.type === 'shipYard') && b.staff < Math.min(b.reqStaff, def.maxStaff);
  });
  let totalVac = hireable.reduce(
    (s, b) => s + (Math.min(b.reqStaff, BUILDING_DEFS[b.type].maxStaff) - b.staff), 0,
  );
  let hires = Math.min(Math.max(0, freePool), totalVac);
  // distribute pro-rata, largest-vacancy first for remainders
  const sorted = [...hireable].sort((a, b) =>
    (Math.min(b.reqStaff, BUILDING_DEFS[b.type].maxStaff) - b.staff) -
    (Math.min(a.reqStaff, BUILDING_DEFS[a.type].maxStaff) - a.staff));
  while (hires > 0 && totalVac > 0) {
    let assignedThisPass = 0;
    for (const b of sorted) {
      if (hires <= 0) break;
      const vac = Math.min(b.reqStaff, BUILDING_DEFS[b.type].maxStaff) - b.staff;
      if (vac <= 0) continue;
      const share = Math.max(1, Math.floor((hires * vac) / totalVac));
      const take = Math.min(vac, share, hires);
      b.staff += take;
      hires -= take;
      assignedThisPass += take;
      const def = BUILDING_DEFS[b.type];
      if (def.staffClass) {
        state.pop.colonists -= take;
        classPoolAdd(state, def.staffClass, take);
        if (def.staffClass === 'security') state.pop.securityNew += take;
      }
      // ship-yard staff remain colonists (assigned, not converted)
    }
    totalVac = sorted.reduce(
      (s, b) => s + (Math.min(b.reqStaff, BUILDING_DEFS[b.type].maxStaff) - b.staff), 0,
    );
    if (assignedThisPass === 0) break;
  }
}

// ---------------------------------------------------------------- step 2: power

export function powerBalance(state: GameState): void {
  const eclipse = state.monthIndex < state.worldEvents.eclipseUntilMonth;
  let supply = 0;
  for (const b of completeBuildings(state)) {
    if (b.type === 'powerStation') supply += POWER_STATION_MW;
    else if (b.type === 'solarPanel' && !eclipse) supply += SOLAR_PANEL_MW;
    else if (b.type === 'solarGenerator' && !eclipse) supply += SOLAR_GENERATOR_MW;
  }
  let demand = 0;
  const consumers = completeBuildings(state).filter((b) => BUILDING_DEFS[b.type].powerMW > 0);
  for (const b of consumers) { b.powered = true; demand += BUILDING_DEFS[b.type].powerMW; }
  for (const b of completeBuildings(state)) if (BUILDING_DEFS[b.type].powerMW === 0) b.powered = true;

  state.power.supply = supply;
  state.power.demand = demand;
  state.power.shedTypes = [];

  if (supply >= demand) {
    state.podCharge = Math.min(podCapacity(state), state.podCharge + (supply - demand));
    state.shortages.power = false;
    return;
  }
  let deficit = demand - supply;
  const fromPods = Math.min(state.podCharge, deficit);
  state.podCharge -= fromPods;
  deficit -= fromPods;
  if (deficit <= 0) { state.shortages.power = false; return; }

  // shed in the canonical order (lowest shutdownPriority first)
  const sheddable = consumers
    .filter((b) => BUILDING_DEFS[b.type].shutdownPriority >= 0)
    .sort((a, b) => BUILDING_DEFS[a.type].shutdownPriority - BUILDING_DEFS[b.type].shutdownPriority);
  for (const b of sheddable) {
    if (deficit <= 0) break;
    b.powered = false;
    deficit -= BUILDING_DEFS[b.type].powerMW;
    if (!state.power.shedTypes.includes(b.type)) state.power.shedTypes.push(b.type);
  }
  state.shortages.power = state.power.shedTypes.length > 0;
  if (state.shortages.power) notify(state, 'warning', 'Power shortage — buildings shut down.');
}

// ---------------------------------------------------------------- step 3: production

export function production(state: GameState, ctx: MonthContext): void {
  const strike = state.monthIndex < state.worldEvents.strikeUntilMonth;
  const sports = state.worldEvents.sportsEventActiveMonth === state.monthIndex;
  let mult = 1;
  if (strike) mult *= 0.5;
  if (sports) mult *= SPORTS_INDUSTRY_MULT;
  ctx.industryMult = mult;

  let ore = 0, fuel = 0, weapons = 0, techGoods = 0, gems = 0;
  for (const b of completeBuildings(state)) {
    if (!b.powered) continue;
    if (b.type === 'mine') {
      ore += state.oreYield[ti(state, b.x, b.y)] * b.staff * mult;
      if (b.staff > 0 && rand(state) < 0.1) gems += 1; // occasional gem find
    } else if (b.type === 'chemicalPlant') {
      fuel += state.fuelYield[ti(state, b.x, b.y)] * b.staff * mult;
    } else if (b.type === 'armsLab') {
      weapons += 1 * b.staff * mult;
    } else if (b.type === 'workshop') {
      techGoods += 1.5 * b.staff * mult;
    }
  }
  ore = Math.floor(ore); fuel = Math.floor(fuel);
  weapons = Math.floor(weapons); techGoods = Math.floor(techGoods);

  // store pool (ore/gems/weapons/tech goods share Store capacity)
  const cap = storeCapacity(state);
  const used = () => state.stores.ore + state.stores.gems + state.stores.weapons + state.stores.techGoods;
  const addStore = (key: 'ore' | 'gems' | 'weapons' | 'techGoods', amt: number): number => {
    const space = Math.max(0, cap - used());
    const put = Math.min(space, amt);
    state.stores[key] += put;
    return amt - put;
  };
  let lost = 0;
  lost += addStore('ore', ore);
  lost += addStore('weapons', weapons);
  lost += addStore('techGoods', techGoods);
  lost += addStore('gems', gems);
  state.shortages.storesFull = lost > 0;
  if (lost > 0) notify(state, 'warning', 'Stores full — surplus production lost.');

  // fuel → tanks
  state.fuelStored = Math.min(fuelCapacity(state), state.fuelStored + fuel);

  // food (perishable, person-months)
  let food = 0;
  for (const b of completeBuildings(state)) {
    if (!b.powered) continue;
    if (b.type === 'hydroponics') food += HYDROPONICS_FEEDS;
    else if (b.type === 'morgroHydroponics') food += MORGRO_FEEDS;
  }
  food = Math.floor(food * (strike ? 1 : 1)); // food production is not industrial
  // the 2×-production cap limits ACCUMULATION only — an existing (bought/banked)
  // reserve must never be wiped out by a zero-production month before anyone eats
  state.stores.food = Math.min(
    state.stores.food + food,
    Math.max(food * FOOD_PERISH_MULT, state.stores.food),
  );
  state.industry.foodProductionLastMonth = food;

  // air production happens in consumption (banks surplus)
  state.industry.producedLastMonth = { ore, fuel, weapons, techGoods, food, air: 0 };
}

// ---------------------------------------------------------------- step 4: consumption

export function consumption(state: GameState, ctx: MonthContext): void {
  const pop = totalPop(state);

  // food
  const eaten = Math.min(state.stores.food, pop);
  ctx.unfed = Math.max(0, pop - eaten);
  state.stores.food -= eaten;
  state.shortages.food = ctx.unfed > 0;
  if (state.shortages.food) notify(state, 'danger', 'Food shortage — colonists are starving!');

  // air
  let airProduced = 0;
  for (const b of completeBuildings(state)) {
    if (!b.powered) continue;
    if (b.type === 'lifeSupport') airProduced += LIFE_SUPPORT_AIR;
    else if (b.type === 'spaceMossConverter') airProduced += MOSS_CONVERTER_AIR;
  }
  state.industry.producedLastMonth.air = airProduced;
  const airAvail = airProduced + state.airBank;
  ctx.unsupplied = Math.max(0, pop - airAvail);
  const bankCap = completeBuildings(state, 'lifeSupport').length * LIFE_SUPPORT_BANK_CAP;
  state.airBank = clamp(airAvail - pop, 0, bankCap);
  state.shortages.air = ctx.unsupplied > 0;
  if (state.shortages.air) notify(state, 'danger', 'Air shortage — life support failing!');
}

// ---------------------------------------------------------------- yards (monthly)

export function runYards(state: GameState): void {
  const cc = activeCommandCentre(state);
  // tank yards: continuous production
  for (const b of completeBuildings(state, 'tankYard')) {
    if (!b.powered || !cc) continue;
    if (b.tankProgress < 0) {
      // try to start a new tank
      if (state.stores.ore >= TANK_ORE_COST && state.stores.weapons >= TANK_WEAPON_COST) {
        const parked = state.units.filter(
          (u) => u.owner === 'player' && !u.offMap &&
            (u.kind === 'tank' || u.kind === 'hoverTank') &&
            Math.max(Math.abs(u.x - b.x), Math.abs(u.y - b.y)) <= 1.5,
        ).length;
        if (parked < TANK_YARD_PARK_LIMIT) {
          state.stores.ore -= TANK_ORE_COST;
          state.stores.weapons -= TANK_WEAPON_COST;
          b.tankProgress = 0;
        }
      }
    } else {
      b.tankProgress += TANK_PROGRESS_PER_TECH * b.staff;
      if (b.tankProgress >= 100) {
        const spot = freeAdjacentTile(state, b.x, b.y);
        if (spot) {
          const kind = state.research.inventions.includes('hoverTank') ? 'hoverTank' : 'tank';
          makeUnit(state, kind, 'player', spot.x, spot.y);
          notify(state, 'info', `${kind === 'hoverTank' ? 'Hover Tank' : 'Tank'} completed.`, { x: b.x, y: b.y });
          b.tankProgress = -1; // next month auto-reorders
        } else {
          b.tankProgress = 100; // ring full — yard pauses
        }
      }
    }
  }
  // ship yards: one ship at a time
  for (const b of completeBuildings(state, 'shipYard')) {
    if (!b.powered || !cc || !b.shipOrder) continue;
    b.shipOrder.workDone += SHIP_WU_PER_COLONIST * b.staff;
    const def = UNIT_DEFS[b.shipOrder.ship];
    if (b.shipOrder.workDone >= def.workUnits) {
      // needs an adjacent free launch pad
      const pad = completeBuildings(state, 'launchPad').find(
        (p) => Math.max(Math.abs(p.x - b.x), Math.abs(p.y - b.y)) <= 1 && p.padShipId < 0,
      );
      if (pad) {
        const ship = makeUnit(state, b.shipOrder.ship, 'player', pad.x, pad.y);
        ship.mode = 'landed';
        pad.padShipId = ship.id;
        notify(state, 'info', `${def.name} completed and is on its launch pad.`, { x: pad.x, y: pad.y });
        b.shipOrder = null;
      }
      // no pad → ship waits (workDone stays at max)
    }
  }
}

export function freeAdjacentTile(state: GameState, x: number, y: number): { x: number; y: number } | null {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (!inBounds(state, nx, ny)) continue;
      if (buildingAt(state, nx, ny)) continue;
      if (blocksGround(state.terrain[ti(state, nx, ny)])) continue;
      if (state.wreckage[ti(state, nx, ny)]) continue;
      return { x: nx, y: ny };
    }
  }
  return null;
}

// ---------------------------------------------------------------- step 11: finance

export function financeMonthly(state: GameState): void {
  const lm = state.finance.lastMonth;
  // colony support grant
  const yearIndex = Math.floor(state.monthIndex / 12);
  const grant = supportGrantForYearIndex(yearIndex);
  state.funds += grant;
  lm.supportGrant = grant;
  // income tax (rate locked in on 1 Jan)
  const tax = Math.round(totalPop(state) * state.finance.taxRate * TAX_INCOME_FACTOR);
  state.funds += tax;
  lm.taxIncome = tax;
}
