// Standalone visual test page for the renderer + procedural art.
// Builds a mock GameState (engine.createGame + one of every building, units,
// effects), renders with full camera controls and an on-screen biome switcher.
// THIS FILE MUTATES STATE DIRECTLY — test harness only, never game code.

import type { GameState, BuildingType, BuildingInstance, UnitKind, UnitInstance, BiomeId } from './types';
import * as engine from './engine';
import { Renderer } from './render/renderer';
import { spriteCacheSize } from './art/sprites';

const BIOME_SCENARIO: [BiomeId, string][] = [
  ['mossy', 'quickstart'],
  ['volcanic', 'vroarscans'],
  ['desert', 'soomanii'],
  ['ice', 'squizquijy'],
  ['crystalline', 'pascalenes'],
  ['badlands', 'tilikanthua'],
  ['marsh', 'catalytes'],
  ['canyon', 'kalkriken'],
  ['tundra', 'vanacancia'],
  ['wasteland', 'lucratians'],
];

const ALL_BUILDINGS: BuildingType[] = [
  'livingQuarters', 'hydroponics', 'morgroHydroponics', 'lifeSupport',
  'spaceMossConverter', 'powerStation', 'solarPanel', 'solarGenerator',
  'fluxPod', 'hospital', 'laboratory', 'mine', 'chemicalPlant',
  'armsLab', 'workshop', 'store', 'fuelTank', 'commandCentre',
  'securityHQ', 'sportsComplex', 'radar', 'laserTurret',
  'missileLauncher', 'tankYard', 'shipYard', 'launchPad',
  'landMine', 'matterTransporter', 'tankTeleport',
];

const ALL_UNITS: UnitKind[] = [
  'tank', 'hoverTank', 'explorer', 'fighter', 'assaultCraft', 'cruiser',
  'warship', 'fusionCruiser', 'enemyTank', 'enemyFighter', 'enemyAssault',
];

function makeBuilding(state: GameState, type: BuildingType, x: number, y: number,
  extra: Partial<BuildingInstance> = {}): BuildingInstance {
  const def = engine.BUILDING_DEFS[type];
  const b: BuildingInstance = {
    id: state.nextBuildingId++, type, x, y, hp: def.hp,
    status: 'complete', progress: def.buildMonths, crewAssigned: 0,
    staff: Math.min(2, def.maxStaff), reqStaff: def.maxStaff,
    powered: true, active: false, facing: 0, lastShotDay: -99,
    fired: false, plasma: false, longRange: false, compressed: false, hdx: false,
    tankProgress: -1, shipOrder: null, padShipId: -1,
    ...extra,
  };
  // clear terrain under it (space moss converter needs moss)
  const i = y * state.mapW + x;
  state.terrain[i] = type === 'spaceMossConverter' ? 'moss' : 'plain';
  state.tileBuilding[i] = b.id + 1;
  state.buildings.push(b);
  return b;
}

function makeUnit(state: GameState, kind: UnitKind, x: number, y: number,
  extra: Partial<UnitInstance> = {}): UnitInstance {
  const def = engine.UNIT_DEFS[kind];
  const u: UnitInstance = {
    id: state.nextUnitId++, kind,
    owner: kind.startsWith('enemy') ? 'enemy' : 'player',
    x, y, hp: def.hp, maxHp: def.hp, damage: def.damage,
    fuel: def.fuelCap > 0 ? def.fuelCap : -1,
    mode: def.isShip ? 'flight' : 'ground',
    landOnArrival: false, path: null, dest: null, lastShotDay: -99,
    offMap: null, offMapDaysLeft: 0, padBuildDaysLeft: -1,
    ...extra,
  };
  state.units.push(u);
  return u;
}

interface Orbiter { id: number; cx: number; cy: number; r: number; speed: number; phase: number; }

function buildMockState(scenarioId: string): { state: GameState; orbiters: Orbiter[] } {
  const state = engine.createGame(scenarioId, 1234);
  state.paused = true;

  // --- one of every building in a grid SE of the start colony
  const gx0 = 34, gy0 = 42, perRow = 8, sp = 3;
  ALL_BUILDINGS.forEach((type, i) => {
    const x = gx0 + (i % perRow) * sp;
    const y = gy0 + Math.floor(i / perRow) * sp;
    const extra: Partial<BuildingInstance> = {};
    if (type === 'commandCentre') extra.active = true;
    if (type === 'laserTurret') extra.facing = 135;
    if (type === 'tankYard') extra.tankProgress = 85;
    if (type === 'shipYard') extra.shipOrder = { ship: 'cruiser', workDone: 110 };
    makeBuilding(state, type, x, y, extra);
  });
  // upgraded variants alongside
  makeBuilding(state, 'fuelTank', gx0, gy0 + 12, { compressed: true });
  makeBuilding(state, 'radar', gx0 + sp, gy0 + 12, { longRange: true });
  makeBuilding(state, 'laserTurret', gx0 + sp * 2, gy0 + 12, { plasma: true, facing: 250 });
  makeBuilding(state, 'missileLauncher', gx0 + sp * 3, gy0 + 12, { fired: true });
  // scaffolds at three progress stages
  makeBuilding(state, 'livingQuarters', gx0 + sp * 4, gy0 + 12, { status: 'scaffold', progress: 0.1, crewAssigned: 8 });
  makeBuilding(state, 'powerStation', gx0 + sp * 5, gy0 + 12, { status: 'scaffold', progress: 0.5, crewAssigned: 16 });
  makeBuilding(state, 'commandCentre', gx0 + sp * 6, gy0 + 12, { status: 'scaffold', progress: 1.7, crewAssigned: 20 });
  // wreckage
  for (const [wx, wy] of [[gx0 + sp * 7, gy0 + 12], [gx0 + 1, gy0 - 2]]) {
    state.terrain[wy * state.mapW + wx] = 'plain';
    state.wreckage[wy * state.mapW + wx] = 1;
  }
  // sports event live
  state.worldEvents.sportsEventActiveMonth = state.monthIndex;
  // a little stored fuel for the sight-glass
  state.fuelStored = 160;
  state.stores.ore = 320;

  // --- units: one of each, some orbiting to show facings
  const uy = gy0 + 16;
  const orbiters: Orbiter[] = [];
  ALL_UNITS.forEach((kind, i) => {
    const x = gx0 + i * 2.2, y = uy;
    const def = engine.UNIT_DEFS[kind];
    const mode = def.isShip
      ? (kind === 'explorer' ? 'landed' : kind === 'assaultCraft' ? 'hovering' : 'flight')
      : 'ground';
    const u = makeUnit(state, kind, x, y, { mode });
    if (kind === 'tank' || kind === 'fighter' || kind === 'enemyFighter' || kind === 'hoverTank') {
      orbiters.push({ id: u.id, cx: x, cy: y + 4, r: kind === 'tank' ? 2 : 3.5, speed: kind === 'tank' ? 0.5 : 1.2, phase: i });
    }
  });
  // damaged unit for the hp bar
  const dmg = makeUnit(state, 'warship', gx0 + 20, uy + 4, { mode: 'hovering' });
  dmg.hp = dmg.maxHp * 0.35;

  // --- markers 1..8
  for (let i = 0; i < 8; i++) {
    state.markers[i] = { x: gx0 - 4 + i * 4, y: gy0 + 20 };
  }
  return { state, orbiters };
}

// ---------------------------------------------------------------- boot

const canvas = document.getElementById('world') as HTMLCanvasElement;
let { state, orbiters } = buildMockState('quickstart');
let renderer = new Renderer(canvas, state);
renderer.camera.centreOnTile(44, 50, 1);

let ghostMode = 0; // 0 off, 1 valid, 2 invalid
let boomTimer = 0;

const biomeBar = document.getElementById('rt-biomes')!;
for (const [biome, scen] of BIOME_SCENARIO) {
  const btn = document.createElement('button');
  btn.textContent = biome;
  if (biome === 'mossy') btn.classList.add('active');
  btn.onclick = () => {
    for (const el of biomeBar.querySelectorAll('button')) el.classList.remove('active');
    btn.classList.add('active');
    const keep = { x: renderer.camera.x, y: renderer.camera.y, z: renderer.camera.zoom };
    renderer.dispose();
    ({ state, orbiters } = buildMockState(scen));
    renderer = new Renderer(canvas, state);
    renderer.camera.centreOnTile(44, 50, keep.z);
    applyGhost();
  };
  biomeBar.appendChild(btn);
}

const ghostBtn = document.getElementById('rt-ghost') as HTMLButtonElement;
function applyGhost(): void {
  if (ghostMode === 0) { renderer.ghost = null; ghostBtn.textContent = 'ghost: off'; }
  else if (ghostMode === 1) {
    renderer.ghost = { type: 'laboratory', x: 46, y: 48, valid: true, reason: null };
    ghostBtn.textContent = 'ghost: valid';
  } else {
    renderer.ghost = { type: 'fluxPod', x: 52, y: 56, valid: false, reason: 'Build closer to a Flux Pod' };
    ghostBtn.textContent = 'ghost: invalid';
  }
}
ghostBtn.onclick = () => { ghostMode = (ghostMode + 1) % 3; applyGhost(); };

(document.getElementById('rt-boom') as HTMLButtonElement).onclick = () => {
  state.effects.push({ fx: 'explosion', x: 40, y: 56, big: true });
  state.effects.push({ fx: 'explosion', x: 47, y: 55, big: false });
  state.effects.push({ fx: 'mine', x: 44, y: 57 });
  state.effects.push({ fx: 'missile', fromX: 34 + 22 * 0.0, fromY: 54, toX: 52, toY: 58 });
};

const depBtn = document.getElementById('rt-deposits') as HTMLButtonElement;
depBtn.onclick = () => {
  renderer.showDeposits = !renderer.showDeposits;
  depBtn.textContent = `deposits: ${renderer.showDeposits ? 'on' : 'off'}`;
};

// hover tile follows the mouse
canvas.addEventListener('pointermove', (e) => {
  const [tx, ty] = renderer.screenToTile(e.offsetX, e.offsetY);
  renderer.hoverTile = tx >= 0 && ty >= 0 && tx < state.mapW && ty < state.mapH ? { x: tx, y: ty } : null;
});
// click selects the nearest unit (selection ring demo)
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const [tx, ty] = renderer.screenToTile(e.offsetX, e.offsetY);
  let best: UnitInstance | null = null;
  let bd = 9;
  for (const u of state.units) {
    const d = Math.hypot(u.x - tx, u.y - ty);
    if (d < bd) { bd = d; best = u; }
  }
  renderer.selectedUnitIds.clear();
  renderer.selectedBuildingId = null;
  if (best && bd < 2) renderer.selectedUnitIds.add(best.id);
  else {
    const b = state.tileBuilding[ty * state.mapW + tx];
    if (b > 0) renderer.selectedBuildingId = b - 1;
  }
});

// debug hook for automated visual verification
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).rt = {
  cam: (tx: number, ty: number, zoom: number) => renderer.camera.centreOnTile(tx, ty, zoom),
  zoom: (z: number) => renderer.camera.setZoom(z),
  burst: () => {
    state.effects.push({ fx: 'explosion', x: 42, y: 55, big: true });
    state.effects.push({ fx: 'explosion', x: 46, y: 56, big: false });
    state.effects.push({ fx: 'mine', x: 44, y: 57 });
    state.effects.push({ fx: 'shot', fromX: 40, fromY: 54, toX: 44, toY: 57, by: 'player', beam: 'laser' });
    state.effects.push({ fx: 'shot', fromX: 48, fromY: 54, toX: 45, toY: 57, by: 'enemy', beam: 'cannon' });
    state.effects.push({ fx: 'shot', fromX: 40, fromY: 58, toX: 46, toY: 59, by: 'player', beam: 'plasma' });
    state.effects.push({ fx: 'missile', fromX: 38, fromY: 56, toX: 48, toY: 60 });
  },
};

const stats = document.getElementById('rt-stats')!;
let frames = 0;
let fpsTime = performance.now();
let fps = 0;

function frame(now: number): void {
  const t = now / 1000;
  // animate orbiters (facing demo) + turret sweep
  for (const o of orbiters) {
    const u = state.units.find((x) => x.id === o.id);
    if (u) {
      u.x = o.cx + Math.cos(t * o.speed + o.phase) * o.r;
      u.y = o.cy + Math.sin(t * o.speed + o.phase) * o.r;
    }
  }
  for (const b of state.buildings) {
    if (b.type === 'laserTurret') b.facing = (b.facing + 0.4) % 360;
  }
  // periodic laser/plasma shots
  boomTimer -= 1 / 60;
  if (boomTimer <= 0) {
    boomTimer = 2.4;
    state.effects.push({ fx: 'shot', fromX: 55, fromY: 51, toX: 58, toY: 56, by: 'player', beam: 'laser' });
    state.effects.push({ fx: 'shot', fromX: 40, fromY: 54, toX: 44, toY: 58, by: 'player', beam: 'plasma' });
    state.effects.push({ fx: 'shot', fromX: 58, fromY: 60, toX: 55, toY: 57, by: 'enemy', beam: 'cannon' });
  }

  renderer.render(t);

  frames++;
  if (now - fpsTime > 500) {
    fps = Math.round((frames * 1000) / (now - fpsTime));
    frames = 0;
    fpsTime = now;
    stats.textContent =
      `fps ${fps}   zoom ${renderer.camera.zoom.toFixed(2)}\n` +
      `sprites ${spriteCacheSize()}   particles ${renderer.effects.liveCount}\n` +
      `buildings ${state.buildings.length}   units ${state.units.length}`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
