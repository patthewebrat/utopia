// Combat: auto-fire, turrets, missiles, land mines, building destruction.
// GAME_SPEC.md §1 (turrets), §3, §13.

import type { GameState, UnitInstance, BuildingInstance } from '../types';
import { UNIT_DEFS } from '../data/ships';
import { getScenario } from '../data/races';
import {
  TURRET_RANGE, TURRET_DAMAGE, TURRET_FIRE_DAYS, TURRET_CONE_DEG, TURRET_ROTATE_DEG,
  PLASMA_RANGE, PLASMA_DAMAGE, MISSILE_RANGE, MISSILE_DAMAGE, HDX_RANGE, HDX_DAMAGE,
  LAND_MINE_DAMAGE, BATTLE_DEATHS_PER_BUILDING, BATTLE_DEATHS_PER_LQ,
} from '../data/constants';
import {
  dist, removeBuilding, killPopulation, notify, getBuilding, ti, inBounds,
} from './util';
import { removeDeadUnit } from './units';

function enemiesOnMap(state: GameState): UnitInstance[] {
  return state.units.filter((u) => u.owner === 'enemy' && !u.offMap && u.hp > 0);
}

function nearestEnemy(state: GameState, x: number, y: number, range: number): UnitInstance | null {
  let best: UnitInstance | null = null;
  let bestD = range + 1e-9;
  for (const e of enemiesOnMap(state)) {
    const d = dist(x, y, e.x, e.y);
    if (d <= bestD) { bestD = d; best = e; }
  }
  return best;
}

export function damageEnemyUnit(state: GameState, e: UnitInstance, dmg: number): void {
  e.hp -= dmg;
  if (e.hp <= 0) {
    state.effects.push({ fx: 'explosion', x: e.x, y: e.y, big: false });
    state.morale.battlesWonThisMonth++;
    state.stats.battlesWon++;
    removeDeadUnit(state, e);
  }
}

export function damagePlayerUnit(state: GameState, u: UnitInstance, dmg: number): void {
  u.hp -= dmg;
  if (u.hp <= 0) {
    state.effects.push({ fx: 'explosion', x: u.x, y: u.y, big: false });
    state.morale.battlesLostThisMonth++;
    state.stats.battlesLost++;
    notify(state, 'attack', `${UNIT_DEFS[u.kind].name} destroyed in combat.`, { x: Math.round(u.x), y: Math.round(u.y) });
    removeDeadUnit(state, u);
  }
}

/** was the tile at (x,y) defended — a working turret or an armed player unit nearby? */
function hitWasDefended(state: GameState, x: number, y: number): boolean {
  for (const t of state.buildings) {
    if (t.type !== 'laserTurret' || t.status !== 'complete' || !t.powered) continue;
    if (dist(t.x, t.y, x, y) <= (t.plasma ? PLASMA_RANGE : TURRET_RANGE)) return true;
  }
  return state.units.some((u) =>
    u.owner === 'player' && !u.offMap && u.hp > 0 && u.damage > 0 &&
    dist(u.x, u.y, x, y) <= UNIT_DEFS[u.kind].range + 2);
}

export function destroyBuildingByEnemy(state: GameState, b: BuildingInstance): void {
  const wasLQ = b.type === 'livingQuarters';
  const defended = hitWasDefended(state, b.x, b.y);
  removeBuilding(state, b, false);
  state.effects.push({ fx: 'explosion', x: b.x, y: b.y, big: true });
  killPopulation(state, wasLQ ? BATTLE_DEATHS_PER_LQ : BATTLE_DEATHS_PER_BUILDING);
  state.morale.buildingsLostThisMonth++;
  notify(state, 'attack', `Enemy forces have destroyed a building!`, { x: b.x, y: b.y });
  // Lucratian-style fund raids: 5% stolen on each UNDEFENDED hit (spec §9)
  if (state.enemy && getScenario(state.scenarioId).stealsFunds && !defended) {
    const stolen = Math.round(state.funds * 0.05);
    if (stolen > 0) {
      state.funds -= stolen;
      notify(state, 'attack', `Raiders stole ${stolen} GR during the attack!`);
    }
  }
}

// ---------------------------------------------------------------- daily combat

export function combatDay(state: GameState): void {
  playerUnitsFire(state);
  enemyUnitsFire(state);
  turretsFire(state);
  landMines(state);
}

function playerUnitsFire(state: GameState): void {
  for (const u of state.units) {
    if (u.owner !== 'player' || u.offMap || u.hp <= 0) continue;
    const def = UNIT_DEFS[u.kind];
    if (def.damage <= 0) continue;
    if (state.totalDays - u.lastShotDay < def.fireRateDays) continue;
    const target = nearestEnemy(state, u.x, u.y, def.range);
    if (!target) continue;
    u.lastShotDay = state.totalDays;
    state.effects.push({ fx: 'shot', fromX: u.x, fromY: u.y, toX: target.x, toY: target.y, by: 'player', beam: 'cannon' });
    damageEnemyUnit(state, target, u.damage);
  }
}

function enemyUnitsFire(state: GameState): void {
  for (const e of [...state.units]) {
    if (e.owner !== 'enemy' || e.hp <= 0) continue;
    const def = UNIT_DEFS[e.kind];
    if (state.totalDays - e.lastShotDay < def.fireRateDays) continue;

    // nearest player unit or building within range — units first if closer
    let unitTarget: UnitInstance | null = null;
    let unitD = def.range + 1e-9;
    for (const u of state.units) {
      if (u.owner !== 'player' || u.offMap || u.hp <= 0) continue;
      const d = dist(e.x, e.y, u.x, u.y);
      if (d <= unitD) { unitD = d; unitTarget = u; }
    }
    let bldTarget: BuildingInstance | null = null;
    let bldD = def.range + 1e-9;
    for (const b of state.buildings) {
      if (b.type === 'landMine') continue; // buried — enemies cannot see or shoot mines
      const d = dist(e.x, e.y, b.x, b.y);
      if (d <= bldD) { bldD = d; bldTarget = b; }
    }
    if (!unitTarget && !bldTarget) continue;
    e.lastShotDay = state.totalDays;
    if (unitTarget && unitD <= bldD) {
      state.effects.push({ fx: 'shot', fromX: e.x, fromY: e.y, toX: unitTarget.x, toY: unitTarget.y, by: 'enemy', beam: 'cannon' });
      damagePlayerUnit(state, unitTarget, e.damage);
    } else if (bldTarget) {
      state.effects.push({ fx: 'shot', fromX: e.x, fromY: e.y, toX: bldTarget.x, toY: bldTarget.y, by: 'enemy', beam: 'cannon' });
      bldTarget.hp -= e.damage;
      if (bldTarget.hp <= 0) destroyBuildingByEnemy(state, bldTarget);
    }
  }
}

function angleTo(ax: number, ay: number, bx: number, by: number): number {
  return ((Math.atan2(by - ay, bx - ax) * 180) / Math.PI + 360) % 360;
}

function turretsFire(state: GameState): void {
  for (const t of state.buildings) {
    if (t.type !== 'laserTurret' || t.status !== 'complete' || !t.powered) continue;
    const range = t.plasma ? PLASMA_RANGE : TURRET_RANGE;
    const dmg = t.plasma ? PLASMA_DAMAGE : TURRET_DAMAGE;
    const target = nearestEnemy(state, t.x, t.y, range);
    if (!target) continue;
    const ang = angleTo(t.x, t.y, target.x, target.y);
    let diff = Math.abs(ang - t.facing) % 360;
    if (diff > 180) diff = 360 - diff;
    if (diff <= TURRET_CONE_DEG / 2) {
      // target in cone — fix and fire (1 shot / 2 days)
      if (state.totalDays - t.lastShotDay >= TURRET_FIRE_DAYS) {
        t.lastShotDay = state.totalDays;
        state.effects.push({
          fx: 'shot', fromX: t.x, fromY: t.y, toX: target.x, toY: target.y,
          by: 'player', beam: t.plasma ? 'plasma' : 'laser',
        });
        damageEnemyUnit(state, target, dmg);
      }
    } else if (state.totalDays % TURRET_FIRE_DAYS === 0) {
      // seek: rotate up to 30° every 2 days toward the target until it enters the cone
      let delta = ((ang - t.facing + 540) % 360) - 180; // signed shortest arc
      delta = Math.max(-TURRET_ROTATE_DEG, Math.min(TURRET_ROTATE_DEG, delta));
      t.facing = (t.facing + delta + 360) % 360;
    }
  }
}

function landMines(state: GameState): void {
  for (const m of [...state.buildings]) {
    if (m.type !== 'landMine' || m.status !== 'complete') continue;
    const victim = enemiesOnMap(state).find(
      (e) => !UNIT_DEFS[e.kind].isShip && dist(e.x, e.y, m.x, m.y) <= 0.7,
    );
    if (victim) {
      state.effects.push({ fx: 'mine', x: m.x, y: m.y });
      removeBuilding(state, m, true); // single use, no wreckage
      damageEnemyUnit(state, victim, LAND_MINE_DAMAGE);
      notify(state, 'attack', 'Land mine detonated under enemy forces!', { x: m.x, y: m.y });
    }
  }
}

// ---------------------------------------------------------------- missiles

/** player-fired missile from a launcher; the tile frees after firing */
export function fireMissile(state: GameState, launcherId: number, x: number, y: number): string | null {
  const m = getBuilding(state, launcherId);
  if (!m || m.type !== 'missileLauncher' || m.status !== 'complete') return 'Not a missile launcher.';
  if (m.fired) return 'Missile already fired.';
  if (!m.powered) return 'Launcher is unpowered.';
  // HDX applies to launchers BUILT after the invention (spec §2), not retroactively
  const hdx = m.hdx;
  const range = hdx ? HDX_RANGE : MISSILE_RANGE;
  const dmg = hdx ? HDX_DAMAGE : MISSILE_DAMAGE;
  if (dist(m.x, m.y, x, y) > range) return 'Target out of range.';
  m.fired = true;
  state.effects.push({ fx: 'missile', fromX: m.x, fromY: m.y, toX: x, toY: y });
  // HDX auto-tracks: hit the nearest enemy to the aim point; basic missile needs proximity
  let best: UnitInstance | null = null;
  let bestD = hdx ? range : 1.5;
  for (const e of enemiesOnMap(state)) {
    const d = dist(x, y, e.x, e.y);
    if (d <= bestD) { bestD = d; best = e; }
  }
  if (best) damageEnemyUnit(state, best, dmg);
  state.effects.push({ fx: 'explosion', x, y, big: true });
  // launcher is spent — tile frees
  if (inBounds(state, m.x, m.y)) state.tileBuilding[ti(state, m.x, m.y)] = 0;
  state.buildings = state.buildings.filter((b) => b.id !== m.id);
  return null;
}
