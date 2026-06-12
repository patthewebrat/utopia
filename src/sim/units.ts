// Unit movement, A* pathfinding, ship modes, fuel, refuelling — GAME_SPEC.md §3, §13.

import type { GameState, UnitInstance, TileRef } from '../types';
import { UNIT_DEFS } from '../data/ships';
import {
  PATHFIND_NODE_CAP, FUEL_TAKEOFF, FUEL_LANDING, FUEL_FLIGHT_PER_DAY,
  FUEL_HOVER_PER_DAY, REFUEL_PAD_PER_DAY, REFUEL_TRANSPORTER_PER_DAY,
  REFUEL_TANK_RADIUS, EXPLORER_PAD_COST, EXPLORER_PAD_DAYS,
} from '../data/constants';
import {
  ti, inBounds, cheb, dist, blocksGround, blocksHover, buildingAt, getUnit,
  completeBuildings, makeBuilding, notify,
} from './util';

// ---------------------------------------------------------------- A*

/** is the tile passable for a ground unit (hover = hover tank rules)? */
export function passable(state: GameState, x: number, y: number, hover: boolean): boolean {
  if (!inBounds(state, x, y)) return false;
  const t = state.terrain[ti(state, x, y)];
  if (hover ? blocksHover(t) : blocksGround(t)) return false;
  const b = buildingAt(state, x, y);
  // tanks may drive across launch pads; land mines are buried (and must be
  // crossable or enemy pathfinding routes around them and they never detonate)
  if (b && b.type !== 'launchPad' && b.type !== 'landMine') return false;
  return true;
}

/** 8-directional A*, capped at 4,000 expanded nodes; returns waypoints or null */
export function findPath(
  state: GameState, sx: number, sy: number, tx: number, ty: number, hover: boolean,
): TileRef[] | null {
  sx = Math.round(sx); sy = Math.round(sy); tx = Math.round(tx); ty = Math.round(ty);
  if (!passable(state, tx, ty, hover) && !(tx === sx && ty === sy)) return null;
  const W = state.mapW, H = state.mapH;
  const open: number[] = [];          // heap of node indices into f-scores
  const g = new Float64Array(W * H).fill(Infinity);
  const f = new Float64Array(W * H).fill(Infinity);
  const came = new Int32Array(W * H).fill(-1);
  const closed = new Uint8Array(W * H);
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - tx), dy = Math.abs(y - ty);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  };
  const start = sy * W + sx, goal = ty * W + tx;
  g[start] = 0; f[start] = h(sx, sy);
  const push = (i: number) => { open.push(i); let c = open.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (f[open[p]] <= f[open[c]]) break; [open[p], open[c]] = [open[c], open[p]]; c = p; } };
  const pop = (): number => {
    const top = open[0]; const last = open.pop()!;
    if (open.length > 0) { open[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < open.length && f[open[l]] < f[open[m]]) m = l; if (r < open.length && f[open[r]] < f[open[m]]) m = r; if (m === c) break; [open[m], open[c]] = [open[c], open[m]]; c = m; } }
    return top;
  };
  push(start);
  let expanded = 0;
  while (open.length > 0 && expanded < PATHFIND_NODE_CAP) {
    const cur = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    expanded++;
    if (cur === goal) {
      const path: TileRef[] = [];
      let i = cur;
      while (i !== start && i >= 0) { path.push({ x: i % W, y: Math.floor(i / W) }); i = came[i]; }
      path.reverse();
      return path;
    }
    const cx = cur % W, cy = Math.floor(cur / W);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!passable(state, nx, ny, hover)) continue;
        const ni = ny * W + nx;
        if (closed[ni]) continue;
        const cost = dx !== 0 && dy !== 0 ? 1.414 : 1;
        const ng = g[cur] + cost;
        if (ng < g[ni]) {
          g[ni] = ng;
          f[ni] = ng + h(nx, ny);
          came[ni] = cur;
          push(ni);
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------- orders

export function orderTankToTile(state: GameState, tankId: number, x: number, y: number): string | null {
  const u = getUnit(state, tankId);
  if (!u || u.owner !== 'player' || UNIT_DEFS[u.kind].isShip) return 'Not a tank.';
  if (u.offMap) return 'Unit is away at the alien city.';
  const path = findPath(state, u.x, u.y, x, y, u.kind === 'hoverTank');
  if (!path) { notify(state, 'warning', 'No route to that marker.'); return 'No route.'; }
  u.path = path;
  u.dest = { x, y };
  return null;
}

export function stopUnit(state: GameState, unitId: number): void {
  const u = getUnit(state, unitId);
  if (!u) return;
  u.path = null;
  u.dest = null;
  if (u.mode === 'flight') {
    u.landOnArrival = false;
    u.mode = 'hovering'; // hover at current position (flight with no dest would burn fuel forever)
  }
}

/** ship order: fly to tile, then land (on a free pad) or hover */
export function orderShipToTile(
  state: GameState, shipId: number, x: number, y: number, landOnArrival: boolean,
): string | null {
  const u = getUnit(state, shipId);
  if (!u || u.owner !== 'player' || !UNIT_DEFS[u.kind].isShip) return 'Not a ship.';
  if (u.offMap) return 'Ship is away at the alien city.';
  if (u.padBuildDaysLeft >= 0) return 'Ship is deploying a launch pad.';
  if (u.mode === 'landed') {
    if (u.fuel >= 0 && u.fuel < FUEL_TAKEOFF + FUEL_LANDING) return 'Not enough fuel to take off.';
    if (u.fuel >= 0) u.fuel -= FUEL_TAKEOFF;
    freePadUnder(state, u);
  }
  u.mode = 'flight';
  u.dest = { x, y };
  u.path = null;
  u.landOnArrival = landOnArrival;
  return null;
}

function freePadUnder(state: GameState, u: UnitInstance): void {
  for (const p of completeBuildings(state, 'launchPad')) {
    if (p.padShipId === u.id) p.padShipId = -1;
  }
}

/** Explorer special: build a launch pad beneath it (landed only) */
export function explorerBuildPad(state: GameState, shipId: number): string | null {
  const u = getUnit(state, shipId);
  if (!u || u.kind !== 'explorer') return 'Only Explorers can build launch pads.';
  if (u.mode !== 'landed' && u.mode !== 'hovering') return 'The Explorer must be landed.';
  if (state.funds < EXPLORER_PAD_COST) return 'Insufficient funds.';
  const x = Math.round(u.x), y = Math.round(u.y);
  if (buildingAt(state, x, y)) return 'There is already a structure here.';
  if (state.wreckage[ti(state, x, y)]) return 'Clear the wreckage first.';
  state.funds -= EXPLORER_PAD_COST;
  u.mode = 'hovering';
  u.padBuildDaysLeft = EXPLORER_PAD_DAYS;
  return null;
}

// ---------------------------------------------------------------- daily step

export function moveUnitsDay(state: GameState): void {
  for (const u of state.units) {
    if (u.offMap || u.hp <= 0) continue;
    const def = UNIT_DEFS[u.kind];
    if (def.isShip) moveShipDay(state, u);
    else moveTankDay(state, u);
  }
}

function moveTankDay(state: GameState, u: UnitInstance): void {
  if (!u.path || u.path.length === 0) return;
  let budget = UNIT_DEFS[u.kind].speed;
  while (budget > 0 && u.path && u.path.length > 0) {
    const next = u.path[0];
    const d = dist(u.x, u.y, next.x, next.y);
    if (d <= budget) {
      u.x = next.x; u.y = next.y;
      budget -= d;
      u.path.shift();
      if (u.path.length === 0) { u.path = null; u.dest = null; }
    } else {
      u.x += ((next.x - u.x) / d) * budget;
      u.y += ((next.y - u.y) / d) * budget;
      budget = 0;
    }
  }
}

function moveShipDay(state: GameState, u: UnitInstance): void {
  if (u.padBuildDaysLeft >= 0) return; // hovers in place while deploying a pad
  if (u.mode !== 'flight' || !u.dest) return;
  const speed = UNIT_DEFS[u.kind].speed;
  const d = dist(u.x, u.y, u.dest.x, u.dest.y);
  if (d <= speed) {
    u.x = u.dest.x; u.y = u.dest.y;
    u.dest = null;
    if (u.landOnArrival) tryLand(state, u);
    else u.mode = 'hovering';
  } else {
    u.x += ((u.dest.x - u.x) / d) * speed;
    u.y += ((u.dest.y - u.y) / d) * speed;
  }
}

function tryLand(state: GameState, u: UnitInstance): void {
  const x = Math.round(u.x), y = Math.round(u.y);
  const b = buildingAt(state, x, y);
  if (b && b.type === 'launchPad' && b.status === 'complete' && (b.padShipId < 0 || b.padShipId === u.id)) {
    if (u.fuel >= 0) u.fuel = Math.max(0, u.fuel - FUEL_LANDING);
    u.mode = 'landed';
    u.x = x; u.y = y;
    b.padShipId = u.id;
  } else {
    u.mode = 'hovering'; // blocked landing → auto-hover
    notify(state, 'warning', 'No free launch pad — ship is hovering.', { x, y });
  }
}

/** daily: fuel burn, crashes, refuelling, explorer pad construction */
export function shipsDaily(state: GameState): void {
  const transporters = completeBuildings(state, 'matterTransporter').filter((b) => b.powered);
  for (const u of [...state.units]) {
    const def = UNIT_DEFS[u.kind];
    if (!def.isShip || u.owner !== 'player' || u.offMap || u.hp <= 0) continue;

    // explorer pad construction
    if (u.padBuildDaysLeft > 0) u.padBuildDaysLeft--;
    if (u.padBuildDaysLeft === 0) {
      u.padBuildDaysLeft = -1;
      const x = Math.round(u.x), y = Math.round(u.y);
      if (!buildingAt(state, x, y)) {
        const pad = makeBuilding(state, 'launchPad', x, y, true);
        pad.padShipId = u.id;
        u.mode = 'landed';
        if (u.fuel >= 0) u.fuel = Math.max(0, u.fuel - FUEL_LANDING);
        notify(state, 'info', 'Explorer has deployed a new launch pad.', { x, y });
      } else {
        u.mode = 'hovering';
      }
    }

    if (u.fuel < 0) continue; // Fusion Cruiser — no fuel
    // burn
    if (u.mode === 'flight') u.fuel -= FUEL_FLIGHT_PER_DAY;
    else if (u.mode === 'hovering') u.fuel -= FUEL_HOVER_PER_DAY;
    if ((u.mode === 'flight' || u.mode === 'hovering') && u.fuel <= 0) {
      crashShip(state, u);
      continue;
    }
    // refuel: landed on a pad within 8 tiles of a Fuel Tank
    if (u.mode === 'landed') {
      const pad = buildingAt(state, Math.round(u.x), Math.round(u.y));
      if (pad && pad.type === 'launchPad') {
        const tankNear = completeBuildings(state, 'fuelTank')
          .some((t) => cheb(t.x, t.y, pad.x, pad.y) <= REFUEL_TANK_RADIUS);
        if (tankNear) {
          const want = Math.min(REFUEL_PAD_PER_DAY, def.fuelCap - u.fuel, state.fuelStored);
          if (want > 0) { u.fuel += want; state.fuelStored -= want; }
        }
      }
    } else if (transporters.length > 0) {
      // Matter Transporter refuels ships in flight/hover anywhere (1:1 from tanks)
      const want = Math.min(REFUEL_TRANSPORTER_PER_DAY, def.fuelCap - u.fuel, state.fuelStored);
      if (want > 0) { u.fuel += want; state.fuelStored -= want; }
    }
  }
}

function crashShip(state: GameState, u: UnitInstance): void {
  const x = Math.round(u.x), y = Math.round(u.y);
  notify(state, 'danger', `${UNIT_DEFS[u.kind].name} has run out of fuel and crashed!`, { x, y });
  state.effects.push({ fx: 'explosion', x, y, big: true });
  if (inBounds(state, x, y) && !buildingAt(state, x, y)) state.wreckage[ti(state, x, y)] = 1;
  u.hp = 0;
  removeDeadUnit(state, u);
}

export function removeDeadUnit(state: GameState, u: UnitInstance): void {
  for (const p of state.buildings) if (p.type === 'launchPad' && p.padShipId === u.id) p.padShipId = -1;
  state.units = state.units.filter((x) => x.id !== u.id);
}

/** Tank Teleport: tank on/adjacent to a powered teleport jumps to a marker */
export function useTankTeleport(state: GameState, tankId: number, markerSlot: number): string | null {
  const u = getUnit(state, tankId);
  if (!u || (u.kind !== 'tank' && u.kind !== 'hoverTank')) return 'Not a tank.';
  const marker = state.markers[markerSlot];
  if (!marker) return 'No such marker.';
  const tp = completeBuildings(state, 'tankTeleport')
    .find((b) => b.powered && cheb(b.x, b.y, Math.round(u.x), Math.round(u.y)) <= 1);
  if (!tp) return 'The tank must be at a powered Tank Teleport.';
  if (!passable(state, marker.x, marker.y, u.kind === 'hoverTank')) return 'Marker tile is blocked.';
  u.x = marker.x; u.y = marker.y;
  u.path = null; u.dest = null;
  notify(state, 'info', 'Tank teleported to marker.', { x: marker.x, y: marker.y });
  return null;
}
