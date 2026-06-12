// UI sandbox (uitest.html) — runs a real engine game, mounts every panel via a
// switcher column, no renderer. UI agent's test bench; not shipped in index.html.

import './style.css';
import * as engine from './engine';
import type { GameState, BuildingType } from './types';
import type { UIContext, UiMode } from './ui/context';
import { mountUI, mountTitle, openBuildingInfo, openUnitOrders } from './ui';
import { openBuildPalette } from './ui/panels/buildPalette';
import { openIndustry } from './ui/panels/industry';
import { openFinance } from './ui/panels/finance';
import { openTrade } from './ui/panels/trade';
import { openAdvisers } from './ui/panels/advisers';
import { openSpy } from './ui/panels/spy';
import { openMapScreen } from './ui/panels/mapScreen';
import { openDisk } from './ui/panels/disk';
import { showBriefing, showInvention, showMedal, showGameOver } from './ui/modals';
import { el, button } from './ui/dom';

// ---------------------------------------------------------------- mock world
let state: GameState = engine.createGame('eldorians');
// run 4 months so there is data everywhere
for (let day = 0; day < 120; day++) engine.advance(state, 1);

// fabricate spy material for the panel (plain JSON state — fine in the sandbox)
state.finance.grants.intelligence = 2500;
state.spy.cityLocated = true;
state.spy.reports.push(
  { monthIndex: 2, level: 2, title: 'Field Report: Eldorian logistics', body: 'Low-level assets report steady convoy traffic out of the enemy city. Their armour is slow but heavily plated. Speculation: first hostile action within the year.', cityDefencePct: null },
  { monthIndex: 3, level: 3, title: 'Intercept: war-herd musters', body: 'Signals intercepts confirm the Eldorians are mustering a war-herd. Expect a mixed column with limited air cover. Recommend turret emplacements on the northern approach.', cityDefencePct: null },
  { monthIndex: 4, level: 4, title: 'Special operative: city survey', body: 'Our operative has penetrated the enemy city perimeter and obtained imagery. City defences are concentrated around the central spire. The city has been LOCATED — assault routes are plotted.', cityDefencePct: 72 },
);

// a tank + a ship for the unit panel
state.units.push(
  { id: 9001, kind: 'tank', owner: 'player', x: 46, y: 34, hp: 64, maxHp: 80, damage: 10, fuel: -1, mode: 'ground', landOnArrival: true, path: null, dest: null, lastShotDay: 0, offMap: null, offMapDaysLeft: 0, padBuildDaysLeft: -1 },
  { id: 9002, kind: 'explorer', owner: 'player', x: 50, y: 30, hp: 60, maxHp: 60, damage: 0, fuel: 130, mode: 'landed', landOnArrival: true, path: null, dest: null, lastShotDay: 0, offMap: null, offMapDaysLeft: 0, padBuildDaysLeft: -1 },
);
engine.placeMarker(state, 0, 30, 20);
engine.placeMarker(state, 3, 60, 50);

// ---------------------------------------------------------------- mock shell
const ui = document.querySelector<HTMLDivElement>('#ui')!;
const world = document.querySelector<HTMLCanvasElement>('#world')!;

function paintWorldStub(): void {
  world.width = window.innerWidth; world.height = window.innerHeight;
  const g = world.getContext('2d')!;
  g.fillStyle = '#0A1014'; g.fillRect(0, 0, world.width, world.height);
  g.strokeStyle = 'rgba(31,182,201,0.07)';
  for (let x = 0; x < world.width; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, world.height); g.stroke(); }
  for (let y = 0; y < world.height; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(world.width, y); g.stroke(); }
  g.fillStyle = 'rgba(126,148,156,0.5)'; g.font = '12px monospace';
  g.fillText('[ world canvas stub — renderer agent owns this ]', 20, world.height / 2);
}
paintWorldStub();
window.addEventListener('resize', paintWorldStub);

const ctx: UIContext = {
  getState: () => state,
  replaceState: (next) => { state = next; },
  newGame: (id) => {
    state = engine.createGame(id);
    showBriefing(ctx, engine.getScenario(id));
  },
  centerOn: (x, y) => console.log('[uitest] centerOn', x, y),
  getViewCenter: () => ({ x: 44, y: 32 }),
  getHoveredTile: () => ({ x: 44, y: 32 }),
  mode: 'info' as UiMode,
  selectedBuild: null as BuildingType | null,
  audio: (() => {
    let music = true, sfx = true, track = 0;
    return {
      setMusicEnabled: (on: boolean) => { music = on; },
      isMusicEnabled: () => music,
      setTrack: (i: number) => { track = i; },
      currentTrack: () => track,
      setSfxEnabled: (on: boolean) => { sfx = on; },
      isSfxEnabled: () => sfx,
    };
  })(),
};

const handle = mountUI(ctx, ui);

// ---------------------------------------------------------------- switcher
const sw = el('div', 'u-test-switcher');
sw.appendChild(el('h3', '', 'UI SANDBOX'));
const cases: [string, () => void][] = [
  ['Build palette', () => openBuildPalette(ctx)],
  ['Building info (CC)', () => {
    const cc = state.buildings.find((b) => b.type === 'commandCentre') ?? state.buildings[0];
    openBuildingInfo(ctx, cc.id);
  }],
  ['Building info (yard)', () => {
    const y = state.buildings.find((b) => b.type === 'shipYard') ?? state.buildings[0];
    openBuildingInfo(ctx, y.id);
  }],
  ['Industry', () => openIndustry(ctx)],
  ['Finance', () => openFinance(ctx)],
  ['Trade', () => openTrade(ctx)],
  ['Advisers', () => openAdvisers(ctx)],
  ['Adviser report', () => openAdvisers(ctx, 'psychiatrist')],
  ['Spy', () => openSpy(ctx)],
  ['Map screen', () => openMapScreen(ctx)],
  ['Disk / options', () => openDisk(ctx)],
  ['Unit: tank', () => openUnitOrders(ctx, 9001)],
  ['Unit: explorer', () => openUnitOrders(ctx, 9002)],
  ['Briefing modal', () => showBriefing(ctx, engine.getScenario('eldorians'))],
  ['Invention modal', () => showInvention(ctx, 'plasmaGun', 6)],
  ['Medal: bronze', () => showMedal(ctx, 'bronze')],
  ['Medal: gold', () => showMedal(ctx, 'gold')],
  ['Game over', () => showGameOver(ctx, false, 'The Supreme Council regrets to report that you were assassinated by criminal elements within your own colony.')],
  ['Victory', () => showGameOver(ctx, true, 'The enemy city lies in ruins. The Eldorian threat to this world is ended; the waves will come no more.')],
  ['Title screen', () => {
    const t = mountTitle(ui, {
      onStart: (id) => { t.destroy(); ctx.newGame(id); },
      onLoad: () => t.destroy(),
    });
  }],
];
for (const [label, fn] of cases) sw.appendChild(button('u-btn u-btn--small u-btn--ghost', label, fn));
ui.appendChild(sw);

// deep-link: uitest.html?panel=<case label slug> opens a case on load (for screenshots)
const want = new URLSearchParams(location.search).get('panel');
if (want) {
  const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const hit = cases.find(([label]) => slug(label) === want || slug(label).startsWith(want));
  if (hit) window.setTimeout(() => hit[1](), 50);
}

// ---------------------------------------------------------------- loop
let last = performance.now();
function frame(now: number): void {
  const dt = (now - last) / 1000; last = now;
  engine.advance(state, dt);
  handle.update();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
