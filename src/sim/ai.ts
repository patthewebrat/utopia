// Per-race alien AI: tech growth, attack waves, off-map city — GAME_SPEC.md §9, §10.

import type { GameState, UnitInstance, UnitKind, BuildingInstance } from '../types';
import { getScenario } from '../data/races';
import { UNIT_DEFS } from '../data/ships';
import {
  CITY_D_GROWTH, CITY_TRAVEL_DAYS_SHIP, CITY_TRAVEL_DAYS_TANK,
  CITY_FIRE_PER_UNIT_WEEK, CITY_VICTORY_MORALE, CITY_VICTORY_BATTLES,
  CITY_RECALL_THRESHOLD, BORDER,
} from '../data/constants';
import { rand, randInt } from '../rng';
import { dist, makeUnit, notify, getUnit, activeCommandCentre } from './util';
import { findPath } from './units';
import { damagePlayerUnit } from './combat';
import { currentSpyLevel } from './spy';
import { startOutbreak } from './population';

export function enemyTechLevel(state: GameState): number {
  const sc = getScenario(state.scenarioId);
  if (sc.sandbox) return 1;
  return Math.min(10, sc.startTL + Math.floor(state.monthIndex / sc.monthsPerTL));
}

/** combined stat multiplier: scenario statMult × (+6% dmg/HP per enemy TL above 1) */
function enemyStatMult(state: GameState): number {
  const sc = getScenario(state.scenarioId);
  return sc.statMult * (1 + 0.06 * (enemyTechLevel(state) - 1));
}

// ---------------------------------------------------------------- monthly

export function aiMonthly(state: GameState): void {
  const e = state.enemy;
  if (!e || e.destroyed) return;
  const sc = getScenario(state.scenarioId);

  // city defence pool grows, paused while an assault is in progress
  const assaultActive = state.units.some((u) => u.offMap === 'atCity');
  if (!assaultActive) e.D += Math.round(CITY_D_GROWTH * sc.aggression);

  // D-damage window (3 months) for the wave-halving recall rule
  e.recentDDamage.push(0);
  if (e.recentDDamage.length > 3) e.recentDDamage.shift();

  // wave scheduling — armed at the tick ENTERING the scheduled month, so the
  // 28-day stand-off (the level-4 spy warning's 4-week lead) lands the spawn
  // inside month `nextWaveMonthIndex` itself, per the scenario table (§9)
  if (e.pendingWaveDay < 0 && e.nextWaveMonthIndex >= 0 &&
      state.monthIndex >= e.nextWaveMonthIndex - 1) {
    const n = e.waveNumber + 1;
    let size = Math.min(24, Math.ceil(sc.waveBase * Math.pow(sc.waveGrowth, n - 1)));
    const recentDamage = e.recentDDamage.reduce((a, b) => a + b, 0);
    if (recentDamage >= CITY_RECALL_THRESHOLD * e.Dmax) {
      size = Math.max(1, Math.ceil(size * 0.5)); // recalled to defend the city
    }
    e.pendingWaveSize = size;
    e.pendingWaveAir = Math.round(size * sc.airMix);
    e.pendingWaveBio = sc.bioAttackChance > 0 && rand(state) < sc.bioAttackChance;
    e.pendingWaveDay = state.totalDays + 28;
    e.pendingWaveWarned = false;
    e.waveNumber = n;
    const interval = Math.max(2, sc.waveInterval - Math.floor(e.waveNumber / 3));
    e.nextWaveMonthIndex = state.monthIndex + 1 + interval; // wave month + interval
  }
}

// ---------------------------------------------------------------- daily

export function aiDaily(state: GameState): void {
  const e = state.enemy;
  if (!e) return;

  if (!e.destroyed && e.pendingWaveDay >= 0) {
    // spy attack warning at the level's lead time
    const lvl = currentSpyLevel(state);
    const leadDays = lvl.warningLeadWeeks * 7;
    if (!e.pendingWaveWarned && leadDays > 0 && e.pendingWaveDay - state.totalDays <= leadDays) {
      e.pendingWaveWarned = true;
      const sc = getScenario(state.scenarioId);
      let text = `Intelligence: ${sc.name} attack expected within ${lvl.warningLeadWeeks} week(s)!`;
      if (lvl.level >= 4) {
        text += ` Predicted force: ${e.pendingWaveSize} units (${e.pendingWaveAir} air, ${e.pendingWaveSize - e.pendingWaveAir} land).`;
      }
      notify(state, 'spy', text);
    }
    if (state.totalDays >= e.pendingWaveDay) spawnWave(state);
  }

  moveEnemyUnits(state);
  offMapDaily(state);
}

function spawnWave(state: GameState): void {
  const e = state.enemy!;
  const sc = getScenario(state.scenarioId);
  const mult = enemyStatMult(state);
  const tl = enemyTechLevel(state);
  const size = e.pendingWaveSize;
  const air = e.pendingWaveAir;

  // random map edge
  const side = randInt(state, 0, 3);
  for (let i = 0; i < size; i++) {
    let x: number, y: number;
    if (side === 0) { x = randInt(state, BORDER, state.mapW - BORDER - 1); y = 1; }
    else if (side === 1) { x = randInt(state, BORDER, state.mapW - BORDER - 1); y = state.mapH - 2; }
    else if (side === 2) { x = 1; y = randInt(state, BORDER, state.mapH - BORDER - 1); }
    else { x = state.mapW - 2; y = randInt(state, BORDER, state.mapH - BORDER - 1); }
    x = Math.max(1, Math.min(state.mapW - 2, x + randInt(state, -2, 2)));
    y = Math.max(1, Math.min(state.mapH - 2, y + randInt(state, -2, 2)));
    const kind: UnitKind = i < air ? (tl >= 5 ? 'enemyAssault' : 'enemyFighter') : 'enemyTank';
    const u = makeUnit(state, kind, 'enemy', x, y);
    u.hp = Math.round(UNIT_DEFS[kind].hp * mult);
    u.maxHp = u.hp;
    u.damage = Math.round(UNIT_DEFS[kind].damage * mult);
    u.mode = UNIT_DEFS[kind].isShip ? 'flight' : 'ground';
  }

  if (e.pendingWaveBio) startOutbreak(state, true);

  e.pendingWaveDay = -1;
  state.stats.attacksTotal++;
  state.pendingEvents.push({ type: 'attack', waveSize: size });
  notify(state, 'attack', `${sc.name} attack force sighted — ${size} units inbound!`);
}

function pickEnemyTarget(state: GameState, e: UnitInstance): BuildingInstance | null {
  const sc = getScenario(state.scenarioId);
  // high-aggression races beeline for the active Command Centre
  if (sc.huntsCommandCentre) {
    const cc = activeCommandCentre(state) ??
      state.buildings.find((b) => b.type === 'commandCentre') ?? null;
    if (cc) return cc;
  }
  let best: BuildingInstance | null = null;
  let bestD = Infinity;
  for (const b of state.buildings) {
    if (b.type === 'landMine') continue; // buried — invisible to the enemy
    const d = dist(e.x, e.y, b.x, b.y);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

function moveEnemyUnits(state: GameState): void {
  for (const e of state.units) {
    if (e.owner !== 'enemy' || e.hp <= 0) continue;
    const def = UNIT_DEFS[e.kind];
    const target = pickEnemyTarget(state, e);
    if (!target) continue;
    const d = dist(e.x, e.y, target.x, target.y);
    if (d <= def.range) { e.path = null; continue; } // in range — combat handles it

    if (def.isShip) {
      // air: straight-line flight
      e.x += ((target.x - e.x) / d) * Math.min(def.speed, d);
      e.y += ((target.y - e.y) / d) * Math.min(def.speed, d);
    } else {
      // land: A* (hover rules for tunnelling races feel), straight-line fallback
      if (!e.path || e.path.length === 0 ||
        (e.dest && (e.dest.x !== target.x || e.dest.y !== target.y))) {
        const sc = getScenario(state.scenarioId);
        const hover = sc.id === 'kalkriken'; // burrowers ignore rough terrain
        // path to a tile adjacent to the target building
        e.path = findPath(state, e.x, e.y, target.x, target.y - 1, hover) ??
          findPath(state, e.x, e.y, target.x - 1, target.y, hover) ??
          findPath(state, e.x, e.y, target.x + 1, target.y, hover) ??
          findPath(state, e.x, e.y, target.x, target.y + 1, hover);
        e.dest = { x: target.x, y: target.y };
      }
      if (e.path && e.path.length > 0) {
        let budget = def.speed;
        while (budget > 0 && e.path && e.path.length > 0) {
          const next = e.path[0];
          const dd = dist(e.x, e.y, next.x, next.y);
          if (dd <= budget) { e.x = next.x; e.y = next.y; budget -= dd; e.path.shift(); }
          else { e.x += ((next.x - e.x) / dd) * budget; e.y += ((next.y - e.y) / dd) * budget; budget = 0; }
        }
      } else {
        // no route — push straight at the target (siege behaviour)
        e.x += ((target.x - e.x) / d) * Math.min(def.speed, d);
        e.y += ((target.y - e.y) / d) * Math.min(def.speed, d);
      }
    }
  }
}

// ---------------------------------------------------------------- alien city assault

/** send a ship or tank to the (off-map) alien city */
export function sendToAlienCity(state: GameState, unitId: number): string | null {
  const u = getUnit(state, unitId);
  if (!u || u.owner !== 'player') return 'No such unit.';
  if (!state.enemy || state.enemy.destroyed) return 'There is no enemy city.';
  if (!state.spy.cityLocated) return 'The enemy city has not been located yet.';
  if (!activeCommandCentre(state)) return 'No active powered Command Centre.';
  if (u.offMap) return 'Unit is already deployed.';
  if (UNIT_DEFS[u.kind].damage <= 0) return 'This unit is unarmed.';
  u.offMap = 'toCity';
  u.offMapDaysLeft = UNIT_DEFS[u.kind].isShip ? CITY_TRAVEL_DAYS_SHIP : CITY_TRAVEL_DAYS_TANK;
  u.path = null; u.dest = null;
  for (const p of state.buildings) if (p.type === 'launchPad' && p.padShipId === u.id) p.padShipId = -1;
  notify(state, 'info', `${UNIT_DEFS[u.kind].name} departing for the alien city.`);
  return null;
}

function offMapDaily(state: GameState): void {
  const e = state.enemy;
  for (const u of [...state.units]) {
    if (!u.offMap || u.owner !== 'player') continue;
    if (u.offMap === 'toCity') {
      if (--u.offMapDaysLeft <= 0) { u.offMap = 'atCity'; }
    } else if (u.offMap === 'returning') {
      if (--u.offMapDaysLeft <= 0) {
        u.offMap = null;
        u.mode = UNIT_DEFS[u.kind].isShip ? 'hovering' : 'ground';
        notify(state, 'info', `${UNIT_DEFS[u.kind].name} has returned from the alien city.`,
          { x: Math.round(u.x), y: Math.round(u.y) });
      }
    }
  }
  if (!e || e.destroyed) return;

  // weekly assault resolution
  if (--e.assaultTickDays > 0) return;
  e.assaultTickDays = 7;
  const force = state.units.filter((u) => u.owner === 'player' && u.offMap === 'atCity');
  if (force.length === 0) return;
  const sc = getScenario(state.scenarioId);

  // friendly fire on the city
  let attackPower = 0;
  for (const u of force) attackPower += u.damage * 7 * (u.hp / u.maxHp);
  e.D -= attackPower;
  if (e.recentDDamage.length > 0) e.recentDDamage[e.recentDDamage.length - 1] += attackPower;

  // city fire back: 8 × statMult × aggression per unit, spread randomly
  let cityFire = Math.round(CITY_FIRE_PER_UNIT_WEEK * sc.statMult * sc.aggression * force.length);
  while (cityFire > 0 && force.some((u) => u.hp > 0)) {
    const alive = force.filter((u) => u.hp > 0);
    const victim = alive[randInt(state, 0, alive.length - 1)];
    const chunk = Math.min(cityFire, randInt(state, 4, 12));
    cityFire -= chunk;
    victim.hp -= chunk;
    if (victim.hp <= 0) damagePlayerUnit(state, victim, 0); // already ≤0 — handles removal/tallies
  }

  if (e.D <= 0) {
    e.destroyed = true;
    e.D = 0;
    e.pendingWaveDay = -1;
    e.nextWaveMonthIndex = -1;
    state.morale.pendingDelta += CITY_VICTORY_MORALE;
    state.stats.battlesWon += CITY_VICTORY_BATTLES;
    for (const u of state.units) {
      if (u.offMap === 'atCity') { u.offMap = 'returning'; u.offMapDaysLeft = CITY_TRAVEL_DAYS_SHIP; }
    }
    notify(state, 'attack', `The ${sc.name} city has fallen! Their threat is ended forever.`);
    state.pendingEvents.push({ type: 'gameover', victory: true, reason: 'Enemy city destroyed.' });
    // note: game continues (sandbox victory) — mode stays 'playing', medal chase continues
  } else if (state.units.every((u) => u.offMap !== 'atCity')) {
    state.stats.battlesLost += 1;
    notify(state, 'attack', 'Our assault force at the alien city has been wiped out.');
  }
}
