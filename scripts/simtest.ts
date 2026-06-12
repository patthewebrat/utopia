// Headless engine QA harness — run with `npm run simtest` (tsx).
//
//  A. Quick-Start, 240 months, scripted management bot:
//     solvency, growth (pop 500+), QoL > 80 + bronze medal, no NaN,
//     no negative stocks, JSON round-trip deep-equals.
//  B. Eldorians, 120 months WITH defences: waves arrive, turrets fire,
//     units die, wreckage appears, colony survives, city assault works.
//  C. Eldorians, 36 months WITHOUT defences: damage must happen.
//  D. Edge cases: demolish mid-construction, CC auto-activation, food/O2
//     shortages, Jan-only tax, manual-trade lock, single-use missiles,
//     research gating, hospital birth rates, assassination, save/load
//     mid-attack, ship stop -> hover, determinism (seeded replays).

import * as engine from '../src/engine';
import type { GameState, BuildingType, UnitInstance } from '../src/types';

let failures = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) { console.log(`  ok   ${msg}`); }
  else { failures++; console.error(`  FAIL ${msg}`); }
}

const VERBOSE = !!process.env.VERBOSE;

// ---------------------------------------------------------------- inspectors

function scanNaN(obj: unknown, path = 'state'): string | null {
  if (typeof obj === 'number') return Number.isFinite(obj) ? null : path;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const r = scanNaN(obj[i], `${path}[${i}]`);
      if (r) return r;
    }
    return null;
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const r = scanNaN(v, `${path}.${k}`);
      if (r) return r;
    }
  }
  return null;
}

/** invariants that must hold at every month boundary */
function checkInvariants(state: GameState): string[] {
  const bad: string[] = [];
  const s = state.stores;
  if (s.food < 0 || s.ore < 0 || s.gems < 0 || s.weapons < 0 || s.techGoods < 0) {
    bad.push(`negative store: ${JSON.stringify(s)}`);
  }
  if (state.fuelStored < 0) bad.push(`negative fuelStored ${state.fuelStored}`);
  if (state.airBank < 0) bad.push(`negative airBank ${state.airBank}`);
  if (state.podCharge < 0) bad.push(`negative podCharge ${state.podCharge}`);
  if (state.funds < 0) bad.push(`negative funds ${state.funds}`);
  const p = state.pop;
  if (p.colonists < 0 || p.technicians < 0 || p.medics < 0 || p.scientists < 0 || p.security < 0) {
    bad.push(`negative population class: ${JSON.stringify(p)}`);
  }
  for (const b of state.buildings) {
    if (b.staff < 0) bad.push(`building ${b.id} negative staff`);
  }
  return bad;
}

interface RunStats {
  invariantBreaks: string[];
  wreckageSeen: boolean;
  playerShots: number;
  enemyShots: number;
  explosions: number;
  maxQol: number;
  minFunds: number;
}

/** advance whole months; drains state.effects daily like a renderer would */
function runMonths(state: GameState, months: number, rs: RunStats, perMonth?: (m: number) => void): void {
  for (let m = 0; m < months; m++) {
    for (let d = 0; d < 30; d++) {
      engine.advance(state, 1);
      for (const fx of state.effects.splice(0)) {
        if (fx.fx === 'shot') { if (fx.by === 'player') rs.playerShots++; else rs.enemyShots++; }
        else if (fx.fx === 'explosion') rs.explosions++;
      }
      if (state.mode !== 'playing') break;
    }
    if (!rs.wreckageSeen && state.wreckage.some((w) => w > 0)) rs.wreckageSeen = true;
    rs.maxQol = Math.max(rs.maxQol, state.qol);
    rs.minFunds = Math.min(rs.minFunds, state.funds);
    const inv = checkInvariants(state);
    for (const b of inv) if (!rs.invariantBreaks.includes(b)) rs.invariantBreaks.push(b);
    if (state.mode !== 'playing') break;
    perMonth?.(m);
    if (VERBOSE && m % 12 === 0) {
      console.log(`  m${m} pop=${engine.populationOf(state)} funds=${Math.round(state.funds)} ` +
        `TL=${state.research.techLevel} QoL=${state.qol.toFixed(1)} morale=${state.morale.displayed.toFixed(0)} ` +
        `crime=${state.crime.index.toFixed(0)} bldgs=${state.buildings.length} ` +
        `W/L=${state.stats.battlesWon}/${state.stats.battlesLost} en=${state.units.filter((u) => u.owner === 'enemy').length}`);
    }
  }
}

function newRunStats(): RunStats {
  return { invariantBreaks: [], wreckageSeen: false, playerShots: 0, enemyShots: 0, explosions: 0, maxQol: 0, minFunds: Infinity };
}

function runDays(state: GameState, days: number): void {
  for (let d = 0; d < days; d++) engine.advance(state, 1);
}

// ---------------------------------------------------------------- bot helpers

/** nearest legal build spot to the colony centre (spiral search) */
function findSpot(state: GameState, type: BuildingType, maxR = 30): { x: number; y: number } | null {
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = 44 + dx, y = 32 + dy;
        if (engine.canBuild(state, type, x, y) === null) return { x, y };
      }
    }
  }
  return null;
}

/** FARTHEST legal spot (used to push flux pods outward) */
function findSpotFar(state: GameState, type: BuildingType, maxR = 40): { x: number; y: number } | null {
  for (let r = maxR; r >= 1; r--) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = 44 + dx, y = 32 + dy;
        if (engine.canBuild(state, type, x, y) === null) return { x, y };
      }
    }
  }
  return null;
}

function buildIfAffordable(state: GameState, type: BuildingType, buffer = 5000): boolean {
  const def = engine.BUILDING_DEFS[type];
  if (state.funds < def.cost + buffer) return false;
  const spot = findSpot(state, type);
  if (!spot) return false;
  return typeof engine.build(state, type, spot.x, spot.y) === 'number';
}

function buildOnDeposit(state: GameState, type: 'mine' | 'chemicalPlant', buffer = 5000): boolean {
  if (state.funds < engine.BUILDING_DEFS[type].cost + buffer) return false;
  const arr = type === 'mine' ? state.oreYield : state.fuelYield;
  let best: { x: number; y: number } | null = null;
  let bestScore = -Infinity;
  for (let y = 0; y < state.mapH; y++) {
    for (let x = 0; x < state.mapW; x++) {
      const yld = arr[y * state.mapW + x];
      if (yld <= 0) continue;
      const d = Math.max(Math.abs(x - 44), Math.abs(y - 32));
      const score = yld * 3 - d;
      if (score > bestScore && engine.canBuild(state, type, x, y) === null) {
        best = { x, y }; bestScore = score;
      }
    }
  }
  if (!best) return false;
  return typeof engine.build(state, type, best.x, best.y) === 'number';
}

const count = (state: GameState, t: BuildingType): number =>
  state.buildings.filter((b) => b.type === t).length;

const foodCapOf = (state: GameState): number => state.buildings
  .reduce((s, b) => s + (b.type === 'hydroponics' ? 100 : b.type === 'morgroHydroponics' ? 200 : 0), 0);

/** essentials shared by every bot: food, air, housing, power, expansion room */
function manageEssentials(state: GameState, buffer: number): void {
  const pop = engine.populationOf(state);
  for (let i = 0; i < 3 && foodCapOf(state) < pop * 1.25; i++) {
    if (!buildIfAffordable(state, 'hydroponics', buffer)) break;
  }
  const airCap = () => count(state, 'lifeSupport') * 400;
  for (let i = 0; i < 2 && airCap() < pop * 1.25; i++) {
    if (!buildIfAffordable(state, 'lifeSupport', buffer)) break;
  }
  for (let i = 0; i < 3 && engine.housingCapacity(state) < pop * 1.08; i++) {
    if (!buildIfAffordable(state, 'livingQuarters', buffer)) break;
  }
  for (let i = 0; i < 2 && state.power.supply < state.power.demand + 15; i++) {
    if (!buildIfAffordable(state, 'powerStation', Math.min(buffer, 1000))) break;
  }
  // running out of room -> push a flux pod outward
  if (!findSpot(state, 'livingQuarters')) {
    const spot = findSpotFar(state, 'fluxPod');
    if (spot && state.funds > engine.BUILDING_DEFS.fluxPod.cost + buffer) {
      engine.build(state, 'fluxPod', spot.x, spot.y);
    }
  }
}

// ============================================================ A: Quick-Start 240

console.log('— A. Quick-Start, 240 months (management bot) —');
{
  const state = engine.createGame('quickstart');
  const startPop = engine.populationOf(state);

  // placement rules still enforced
  assert(typeof engine.canBuild(state, 'livingQuarters', 10, 10) === 'string', 'build rejected outside flux radius');
  assert(typeof engine.canBuild(state, 'solarPanel', 1, 1) === 'string', 'build rejected inside 4-tile border');

  engine.setTax(state, 8);
  engine.setBirthRate(state, 'high');
  engine.setRetain(state, 'food', 100);
  engine.setRetain(state, 'fuel', 100);
  engine.setRetain(state, 'ore', 25);
  engine.setRetain(state, 'weapons', 0);
  engine.setRetain(state, 'techGoods', 0);
  engine.setRetain(state, 'gems', 0);

  const rs = newRunStats();
  runMonths(state, 240, rs, () => {
    const pop = engine.populationOf(state);
    engine.setBirthRate(state, pop < 2200 ? 'high' : 'low');
    manageEssentials(state, 5000);
    // services
    if (count(state, 'hospital') < 1 + Math.floor(pop / 700)) buildIfAffordable(state, 'hospital');
    if (count(state, 'securityHQ') < 1 + Math.floor(pop / 500)) buildIfAffordable(state, 'securityHQ');
    if (count(state, 'laboratory') < 4) buildIfAffordable(state, 'laboratory');
    if (count(state, 'store') < 2 + Math.floor(pop / 800)) buildIfAffordable(state, 'store');
    if (state.monthIndex > 10 && count(state, 'sportsComplex') < 1) buildIfAffordable(state, 'sportsComplex');
    engine.callSportsEvent(state); // morale upkeep (no-op when not possible)
    // trade economy
    if (count(state, 'mine') < 4) buildOnDeposit(state, 'mine', 8000);
    if (count(state, 'workshop') < Math.min(8, 1 + Math.floor(pop / 250))) buildIfAffordable(state, 'workshop', 8000);
    // research funding
    if (state.funds > 30000) {
      if (state.finance.grants.military < 3000) engine.addGrant(state, 'military', 4000);
      if (state.finance.grants.civilian < 3000) engine.addGrant(state, 'civilian', 4000);
    }
  });

  const pop = engine.populationOf(state);
  console.log(`  pop ${startPop} -> ${pop}, funds ${state.funds} (min ${rs.minFunds}), TL ${state.research.techLevel}, ` +
    `QoL ${state.qol.toFixed(1)} (max ${rs.maxQol.toFixed(1)}), morale ${state.morale.displayed.toFixed(0)}, ` +
    `crime ${state.crime.index.toFixed(0)}, buildings ${state.buildings.length}, ` +
    `medals bronze=${state.stats.bronzeMedal} gold=${state.stats.goldMedal}`);

  assert(state.mode === 'playing', 'game still running after 240 months');
  assert(pop >= 500, `population reached 500+ (${pop})`);
  assert(rs.minFunds >= 0 && state.funds > 0, `economy stayed solvent (min funds ${rs.minFunds})`);
  assert(rs.maxQol > 80, `QoL exceeded 80 (max ${rs.maxQol.toFixed(1)})`);
  assert(state.stats.bronzeMedal, 'bronze medal earned (QoL >= 80 for 12 months)');
  assert(state.research.techLevel >= 6, `research progressed (TL${state.research.techLevel} >= 6)`);
  assert(rs.invariantBreaks.length === 0, `no negative stocks/funds/population${rs.invariantBreaks[0] ? ` (${rs.invariantBreaks[0]})` : ''}`);
  const nan = scanNaN(state);
  assert(nan === null, `no NaN/Infinity anywhere in state${nan ? ` (at ${nan})` : ''}`);

  const json = engine.serialize(state);
  const restored = engine.deserialize(json);
  assert(engine.serialize(restored) === json, 'JSON round-trip deep-equals');
  engine.advance(restored, 30);
  assert(scanNaN(restored) === null, 'restored state advances without NaN');
}

// ============================================================ B: Eldorians defended

console.log('— B. Eldorians, 120 months WITH defences —');
{
  const state = engine.createGame('eldorians');
  engine.setTax(state, 8);
  engine.setBirthRate(state, 'high');
  engine.addGrant(state, 'intelligence', 10000);
  engine.setRetain(state, 'food', 100);
  engine.setRetain(state, 'fuel', 100);
  engine.setRetain(state, 'ore', 20);     // sell surplus ore — keep store space for weapons
  engine.setRetain(state, 'weapons', 100);

  // modest turret ring + buried mines around the start colony (kept deliberately
  // thin so waves do real damage; the city assault is held until month 48)
  const ring: [number, number][] = [];
  for (const r of [3, 5]) {
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      ring.push([45 + Math.round(Math.cos(ang) * r), 31 + Math.round(Math.sin(ang) * r)]);
    }
  }

  const rs = newRunStats();
  runMonths(state, 120, rs, () => {
    manageEssentials(state, 1500);
    if (count(state, 'hospital') < 1) buildIfAffordable(state, 'hospital', 1500);
    if (count(state, 'securityHQ') < 1) buildIfAffordable(state, 'securityHQ', 1500);
    if (count(state, 'radar') < 1) buildIfAffordable(state, 'radar', 1500);
    // war economy FIRST — tanks win this scenario, turrets only buy time
    if (count(state, 'mine') < 1) buildOnDeposit(state, 'mine', 1500);
    if (count(state, 'armsLab') < 1) buildIfAffordable(state, 'armsLab', 1500);
    if (count(state, 'tankYard') < 1) buildIfAffordable(state, 'tankYard', 1500);
    if (count(state, 'armsLab') < 2) buildIfAffordable(state, 'armsLab', 6000);
    if (count(state, 'workshop') < 2) buildIfAffordable(state, 'workshop', 2000);
    if (count(state, 'mine') < 2) buildOnDeposit(state, 'mine', 4000);
    if (count(state, 'store') < 2) buildIfAffordable(state, 'store', 2000);
    // maintain the turret ring with whatever is left over
    for (const [x, y] of ring) {
      const i = y * state.mapW + x;
      if (state.wreckage[i]) engine.demolish(state, x, y);
      if (state.funds < engine.BUILDING_DEFS.laserTurret.cost + 4000) break;
      if (engine.canBuild(state, 'laserTurret', x, y) === null) engine.build(state, 'laserTurret', x, y);
    }
    if (state.research.inventions.includes('landMine') && count(state, 'landMine') < 6) {
      buildIfAffordable(state, 'landMine', 4000);
    }
    if (!state.spy.cityLocated && state.finance.grants.intelligence < 2000) {
      engine.addGrant(state, 'intelligence', Math.min(4000, Math.floor(state.funds / 4)));
    }
    // battle micro / endgame
    const tanks = state.units.filter(
      (u) => u.owner === 'player' && !u.offMap && (u.kind === 'tank' || u.kind === 'hoverTank'),
    );
    if (state.monthIndex >= 48 && state.spy.cityLocated && state.enemy && !state.enemy.destroyed) {
      const committed = state.units.filter((u) => u.offMap).length;
      if (tanks.length + committed >= 4) for (const t of tanks) engine.sendToAlienCity(state, t.id);
    } else if (state.enemy && !state.enemy.destroyed) {
      const enemy = state.units.find((u) => u.owner === 'enemy');
      if (enemy) {
        engine.placeMarker(state, 0, Math.round(enemy.x), Math.round(enemy.y));
        engine.orderTanksNearest(state, 0, 99);
      }
    }
  });

  console.log(`  pop ${engine.populationOf(state)}, funds ${state.funds}, mode ${state.mode}, ` +
    `attacks ${state.stats.attacksTotal}, W/L ${state.stats.battlesWon}/${state.stats.battlesLost}, ` +
    `shots p/e ${rs.playerShots}/${rs.enemyShots}, explosions ${rs.explosions}, ` +
    `city destroyed ${state.enemy?.destroyed}, spy reports ${state.spy.reports.length}`);

  assert(state.stats.attacksTotal > 0, `alien attack waves arrived (${state.stats.attacksTotal})`);
  assert(rs.playerShots > 0, `defences fired (${rs.playerShots} player shots)`);
  assert(state.stats.battlesWon > 0, `enemy units destroyed (${state.stats.battlesWon})`);
  assert(rs.wreckageSeen, 'wreckage appeared on the map');
  assert(state.mode === 'playing', 'colony survived 120 months');
  assert(state.enemy !== null && state.enemy.destroyed, 'alien city assault succeeded');
  assert(state.spy.reports.length > 0, `spy reports generated (${state.spy.reports.length})`);
  assert(checkInvariants(state).length === 0, 'no negative stocks in war economy');
  const nan = scanNaN(state);
  assert(nan === null, `no NaN in defended-run state${nan ? ` (at ${nan})` : ''}`);
}

// ============================================================ C: Eldorians undefended

console.log('— C. Eldorians, 36 months WITHOUT defences —');
{
  const state = engine.createGame('eldorians');
  engine.setTax(state, 8);
  const startBuildings = state.buildings.length;
  const rs = newRunStats();
  runMonths(state, 36, rs, () => {
    manageEssentials(state, 1500); // essentials only — no turrets, tanks, mines
  });
  console.log(`  mode ${state.mode}, attacks ${state.stats.attacksTotal}, enemy shots ${rs.enemyShots}, ` +
    `wreckage seen ${rs.wreckageSeen}, deaths ${state.stats.totalDeaths}, buildings ${startBuildings} -> ${state.buildings.length}`);
  assert(state.stats.attacksTotal > 0, `attacks arrived (${state.stats.attacksTotal})`);
  assert(rs.enemyShots > 0, `enemy opened fire (${rs.enemyShots} shots)`);
  assert(rs.wreckageSeen, 'undefended colony lost buildings (wreckage appeared)');
}

// ============================================================ D: edge cases

console.log('— D. Edge cases —');

// D1: demolish during construction
{
  const state = engine.createGame('quickstart');
  const spot = findSpot(state, 'livingQuarters')!;
  const id = engine.build(state, 'livingQuarters', spot.x, spot.y);
  assert(typeof id === 'number', 'D1: scaffold placed');
  runDays(state, 3);
  const b = state.buildings.find((x) => x.id === id);
  assert(b !== undefined && b.status === 'scaffold', 'D1: still a scaffold mid-construction');
  assert(engine.demolish(state, spot.x, spot.y) === null, 'D1: demolish mid-construction accepted');
  assert(state.wreckage[spot.y * state.mapW + spot.x] === 1, 'D1: demolished scaffold leaves wreckage');
  assert(typeof engine.canBuild(state, 'livingQuarters', spot.x, spot.y) === 'string', 'D1: wreckage blocks rebuilding');
  assert(engine.demolish(state, spot.x, spot.y) === null, 'D1: second demolish clears wreckage');
  assert(engine.canBuild(state, 'livingQuarters', spot.x, spot.y) === null, 'D1: tile buildable again');
  runDays(state, 30);
  assert(scanNaN(state) === null, 'D1: state clean after mid-construction demolish');
}

// D2: command centre destroyed -> reserve auto-activates
{
  const state = engine.createGame('quickstart');
  const spot = findSpot(state, 'commandCentre')!;
  engine.build(state, 'commandCentre', spot.x, spot.y);
  runDays(state, 90); // 2.0 build-months at full crew
  const ccs = state.buildings.filter((b) => b.type === 'commandCentre' && b.status === 'complete');
  assert(ccs.length === 2, `D2: second Command Centre completed (${ccs.length})`);
  assert(ccs.filter((b) => b.active).length === 1, 'D2: exactly one active CC');
  const active = ccs.find((b) => b.active)!;
  const reserve = ccs.find((b) => !b.active)!;
  engine.demolish(state, active.x, active.y);
  assert(reserve.active, 'D2: reserve CC auto-activated when active CC destroyed');
}

// D3: food/O2 shortage -> warnings + deaths
{
  const state = engine.createGame('quickstart');
  for (const b of [...state.buildings]) {
    if (b.type === 'hydroponics' || b.type === 'lifeSupport') engine.demolish(state, b.x, b.y);
  }
  engine.dumpCommodity(state, 'food', 1e9);
  engine.setRetain(state, 'food', 100); // don't let autotrade interfere
  const before = engine.populationOf(state);
  runDays(state, 31);
  assert(state.shortages.food, 'D3: food shortage flagged');
  assert(state.shortages.air, 'D3: air shortage flagged');
  assert(engine.populationOf(state) < before, `D3: shortages caused deaths (${before} -> ${engine.populationOf(state)})`);
  assert(state.notifications.some((n) => n.kind === 'danger'), 'D3: danger warnings issued');
}

// D4: tax change applies only on 1 January
{
  const state = engine.createGame('quickstart');
  runDays(state, 30); // now in February
  engine.setTax(state, 12);
  runDays(state, 5 * 30); // mid-year
  assert(state.finance.taxRate === 0 && state.finance.pendingTaxRate === 12,
    `D4: tax unchanged mid-year (rate ${state.finance.taxRate}, pending 12)`);
  while (!(state.month === 1)) runDays(state, 30);
  assert(state.finance.taxRate === 12, `D4: tax rate locked in on 1 Jan (${state.finance.taxRate})`);
}

// D5: manual trade locks autotrade for that month
{
  const state = engine.createGame('quickstart');
  engine.setRetain(state, 'ore', 0); // autotrade would sell all ore
  const r = engine.manualTrade(state, { ore: 5 });
  assert(r === null, `D5: manual trade accepted (${String(r)})`);
  assert(typeof engine.manualTrade(state, { ore: 1 }) === 'string', 'D5: second manual trade same month rejected');
  const oreAfterBuy = state.stores.ore;
  runDays(state, 30); // month tick: autotrade must be locked
  assert(state.stores.ore === oreAfterBuy, `D5: autotrade skipped in manual-trade month (ore ${state.stores.ore})`);
  runDays(state, 30); // next month: autotrade resumes (retain 0, demand >= 40)
  assert(state.stores.ore < oreAfterBuy, `D5: autotrade resumed next month (ore ${state.stores.ore})`);
}

// D6: missile launcher is single-use and frees its tile
{
  const state = engine.createGame('quickstart');
  const spot = findSpot(state, 'missileLauncher')!;
  const id = engine.build(state, 'missileLauncher', spot.x, spot.y) as number;
  runDays(state, 30); // 0.5 build-months
  const m = state.buildings.find((b) => b.id === id);
  assert(m !== undefined && m.status === 'complete', 'D6: launcher completed');
  const res = engine.fireMissile(state, id, spot.x + 3, spot.y);
  assert(res === null, `D6: missile fired (${String(res)})`);
  assert(!state.buildings.some((b) => b.id === id), 'D6: launcher consumed after firing');
  assert(engine.canBuild(state, 'solarPanel', spot.x, spot.y) === null, 'D6: launcher tile freed for new construction');
}

// D7: research unlocks gate the build palette
{
  const state = engine.createGame('quickstart');
  const spot = findSpot(state, 'hydroponics')!;
  assert(typeof engine.canBuild(state, 'morgroHydroponics', spot.x, spot.y) === 'string',
    'D7: Morgro Hydroponics rejected before invention');
  state.research.techLevel = 6;
  state.research.inventions.push('morgroHydroponics');
  assert(engine.canBuild(state, 'morgroHydroponics', spot.x, spot.y) === null,
    'D7: Morgro Hydroponics allowed after invention');
  const id = engine.build(state, 'hydroponics', spot.x, spot.y) as number;
  const b = state.buildings.find((x) => x.id === id)!;
  assert(b.type === 'morgroHydroponics', 'D7: invention upgrades future builds (hydroponics -> morgro)');
}

// D8: hospital + birth-rate setting drives growth
{
  const state = engine.createGame('quickstart');
  engine.setBirthRate(state, 'high');
  runDays(state, 4 * 30); // no hospital yet
  assert(state.stats.totalBirths === 0, 'D8: no births without a hospital');
  const spot = findSpot(state, 'hospital')!;
  engine.build(state, 'hospital', spot.x, spot.y);
  runDays(state, 3 * 30); // 1.5 build-months + margin
  const baseline = state.stats.totalBirths;
  runDays(state, 4 * 30);
  const highBirths = state.stats.totalBirths - baseline;
  assert(highBirths > 0, `D8: births occur with hospital + High rate (${highBirths} in 4 months)`);
  engine.setBirthRate(state, 'none');
  const b2 = state.stats.totalBirths;
  runDays(state, 4 * 30);
  assert(state.stats.totalBirths === b2, 'D8: births stop when rate set to None');
}

// D9: sustained max crime -> assassination game over
{
  const state = engine.createGame('quickstart');
  state.crime.index = 95; // cartels already rampant; no Security HQ exists
  state.morale.displayed = 20; // pressure stays positive
  runDays(state, 5 * 30);
  assert(state.mode === 'gameover' && /assassinated/i.test(state.gameOverReason),
    `D9: assassination ended the game (${state.gameOverReason || state.mode})`);
  assert(state.notifications.some((n) => n.kind === 'crime' && /plotting/i.test(n.text)),
    'D9: cartel warning was issued first');
}

// D10: save/load mid-attack replays identically
{
  const state = engine.createGame('eldorians');
  let guard = 0;
  while (!state.units.some((u) => u.owner === 'enemy') && guard++ < 600) engine.advance(state, 1);
  assert(state.units.some((u) => u.owner === 'enemy'), 'D10: enemy units on the map (mid-attack)');
  const json = engine.serialize(state);
  const restored = engine.deserialize(json);
  assert(engine.serialize(restored) === json, 'D10: mid-attack save round-trips');
  runDays(state, 30);
  runDays(restored, 30);
  assert(engine.serialize(state) === engine.serialize(restored),
    'D10: original and restored states replay identically for 30 days');
  assert(scanNaN(restored) === null, 'D10: restored mid-attack state stays NaN-free');
}

// D11: stopping a flying ship makes it hover (it must not freeze in flight)
{
  const state = engine.createGame('quickstart');
  const ship: UnitInstance = {
    id: state.nextUnitId++, kind: 'explorer', owner: 'player',
    x: 30, y: 30, hp: 60, maxHp: 60, damage: 0, fuel: 200,
    mode: 'flight', landOnArrival: false, path: null, dest: { x: 70, y: 60 },
    lastShotDay: -999, offMap: null, offMapDaysLeft: 0, padBuildDaysLeft: -1,
  };
  state.units.push(ship);
  runDays(state, 2);
  assert(ship.x > 30, 'D11: ship moving toward destination');
  engine.stopUnit(state, ship.id);
  assert(ship.mode === 'hovering', `D11: stopped ship hovers (mode ${ship.mode})`);
  const { x, y, fuel } = ship;
  runDays(state, 3);
  assert(ship.x === x && ship.y === y, 'D11: hovering ship holds position');
  assert(ship.fuel < fuel, 'D11: hovering ship burns hover fuel');
}

// D12: determinism — same seed, same commands -> identical state
{
  const mk = (): GameState => {
    const s = engine.createGame('vroarscans', 777);
    engine.setTax(s, 10);
    engine.setBirthRate(s, 'high');
    return s;
  };
  const a = mk(), b = mk();
  for (let m = 0; m < 24; m++) { runDays(a, 30); runDays(b, 30); }
  assert(engine.serialize(a) === engine.serialize(b), 'D12: 24-month seeded replay is byte-identical');
  const c = engine.createGame('vroarscans', 778);
  assert(engine.serialize(c) !== engine.serialize(engine.createGame('vroarscans', 777)),
    'D12: different seeds diverge');
}

console.log(failures === 0 ? '\nALL SIMTEST CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
