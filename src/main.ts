// UTOPIA — integration shell. Boots title → game, runs the rAF loop
// (fixed-step sim accumulator + renderer + HUD), routes world input by mode,
// and wires audio / save / autosave into the UI layer.

import './style.css';
import * as engine from './engine';
import type { GameState, UnitInstance } from './types';
import { Renderer } from './render/renderer';
import { Camera } from './render/camera';
import {
  mountUI, mountTitle, openBuildingInfo, openUnitOrders,
  showBriefing, toast, currentPanelId, setUiMode,
  type UIContext, type UIHandle, type AudioApi,
} from './ui';
import type { TitleHandle } from './ui/title';
import { audio, type MusicTrack } from './audio';
import { initAutosave, restoreAutosave, loadGame } from './save';

const canvas = document.querySelector<HTMLCanvasElement>('#world')!;
const uiRoot = document.querySelector<HTMLDivElement>('#ui')!;

let state: GameState | null = null;
let renderer: Renderer | null = null;
let ui: UIHandle | null = null;
let title: TitleHandle | null = null;
let autosaveStarted = false;

// ---------------------------------------------------------------- audio facade

let musicTrack: MusicTrack = 1;
const audioApi: AudioApi = {
  setMusicEnabled(on: boolean): void {
    audio.setMusicEnabled(on);
    if (on && audio.getCurrentTrack() === null) audio.playMusic(musicTrack);
  },
  isMusicEnabled: () => audio.isMusicEnabled(),
  setTrack(i: number): void {
    musicTrack = ((Math.max(0, Math.min(3, Math.round(i))) + 1) as MusicTrack);
    audio.playMusic(musicTrack);
  },
  currentTrack: () => (audio.getCurrentTrack() ?? musicTrack) - 1,
  setSfxEnabled: (on: boolean) => audio.setSfxEnabled(on),
  isSfxEnabled: () => audio.isSfxEnabled(),
};

// ---------------------------------------------------------------- UI context

const ctx: UIContext = {
  getState: () => state!,
  replaceState(next: GameState): void { enterGame(next, false); },
  newGame(scenarioId: string): void { enterGame(engine.createGame(scenarioId, freshSeed()), true); },
  centerOn(x: number, y: number): void { renderer?.camera.panToTile(x, y); },
  getViewCenter() {
    const s = state!;
    const c = renderer!.camera;
    const [tx, ty] = Camera.worldToTile(c.x, c.y);
    return {
      x: Math.max(0, Math.min(s.mapW - 1, Math.round(tx))),
      y: Math.max(0, Math.min(s.mapH - 1, Math.round(ty))),
    };
  },
  getHoveredTile: () => renderer?.hoverTile ?? null,
  mode: 'info',
  selectedBuild: null,
  onModeChange(): void {
    if (!renderer) return;
    renderer.ghost = null;
    renderer.selectedBuildingId = null;
    renderer.selectedUnitIds.clear();
  },
  audio: audioApi,
};

// ---------------------------------------------------------------- game start

/** a fresh per-run map/RNG seed — outside the sim path, so seeded-PRNG
 *  determinism is preserved (the seed round-trips through saves) */
function freshSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 2 ** 31)) | 0;
}

function homeTile(s: GameState): { x: number; y: number } {
  const cc = s.buildings.find((b) => b.type === 'commandCentre') ?? s.buildings[0];
  return cc ? { x: cc.x, y: cc.y } : { x: Math.floor(s.mapW / 2), y: Math.floor(s.mapH / 2) };
}

function enterGame(next: GameState, fresh: boolean): void {
  title?.destroy();
  title = null;
  for (const n of Array.from(uiRoot.querySelectorAll('.u-boot-note'))) n.remove();
  state = next;
  if (!renderer) {
    renderer = new Renderer(canvas, next);
  } else {
    renderer.setState(next);
  }
  const home = homeTile(next);
  renderer.camera.centreOnTile(home.x, home.y, 1);
  if (!ui) ui = mountUI(ctx, uiRoot);
  setUiMode(ctx, 'info');
  if (!autosaveStarted) {
    initAutosave(() => state);
    autosaveStarted = true;
  }
  const idx = engine.SCENARIOS.findIndex((sc) => sc.id === next.scenarioId);
  musicTrack = (((idx < 0 ? 0 : idx) % 4) + 1) as MusicTrack;
  audio.playMusic(musicTrack);
  if (fresh) showBriefing(ctx, engine.getScenario(next.scenarioId));
}

// ---------------------------------------------------------------- title / boot

function titleNote(text: string, actions?: { label: string; fn: () => void }[]): void {
  const bar = document.createElement('div');
  bar.className = 'u-boot-note';
  bar.style.cssText =
    // z-index must beat the title screen (.u-title is z-index 100) or the bar
    // is painted behind it and RESUME is unclickable
    'position:absolute;left:50%;bottom:9%;transform:translateX(-50%);z-index:300;' +
    'display:flex;gap:10px;align-items:center;padding:10px 16px;border:1px solid rgba(55,224,242,0.45);' +
    'background:rgba(13,20,26,0.92);color:#C8D6DC;font:500 13px ui-monospace,Menlo,monospace;' +
    'border-radius:6px;backdrop-filter:blur(8px);pointer-events:auto;';
  const span = document.createElement('span');
  span.textContent = text;
  bar.appendChild(span);
  for (const a of actions ?? []) {
    const b = document.createElement('button');
    b.textContent = a.label;
    b.style.cssText =
      'cursor:pointer;background:rgba(55,224,242,0.12);color:#37E0F2;border:1px solid rgba(55,224,242,0.6);' +
      'padding:5px 12px;border-radius:4px;font:600 12px ui-monospace,Menlo,monospace;letter-spacing:0.06em;';
    b.addEventListener('click', () => { bar.remove(); a.fn(); });
    bar.appendChild(b);
  }
  const x = document.createElement('button');
  x.textContent = '✕';
  x.style.cssText = 'cursor:pointer;background:none;border:none;color:#5E7079;font-size:13px;';
  x.addEventListener('click', () => bar.remove());
  bar.appendChild(x);
  uiRoot.appendChild(bar);
}

function pickSaveFile(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    if (!f) return;
    loadGame(f)
      .then((s) => enterGame(s, false))
      .catch((e: unknown) => titleNote(e instanceof Error ? e.message : 'Could not read that save file.'));
  });
  input.click();
}

function showTitle(): void {
  title = mountTitle(uiRoot, {
    onStart: (scenarioId) => enterGame(engine.createGame(scenarioId, freshSeed()), true),
    onLoad: () => pickSaveFile(),
  });
  const auto = restoreAutosave();
  if (auto) {
    const date = `${String(auto.dayOfMonth + 1).padStart(2, '0')}/${String(auto.month).padStart(2, '0')}/${auto.year}`;
    titleNote(`Autosave found — ${engine.getScenario(auto.scenarioId).name}, ${date}.`, [
      { label: 'RESUME', fn: () => enterGame(auto, false) },
    ]);
  }
}

// ---------------------------------------------------------------- world input

let downX = 0;
let downY = 0;
let leftDown = false;

canvas.addEventListener('pointerdown', (e: PointerEvent) => {
  if (e.button === 0) { leftDown = true; downX = e.clientX; downY = e.clientY; }
});
canvas.addEventListener('pointerup', (e: PointerEvent) => {
  if (e.button !== 0 || !leftDown) return;
  leftDown = false;
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return; // a drag, not a click
  if (!state || !renderer) return;
  const rect = canvas.getBoundingClientRect();
  handleWorldClick(e.clientX - rect.left, e.clientY - rect.top);
});

function pickUnit(ftx: number, fty: number): UnitInstance | null {
  const s = state!;
  let best: UnitInstance | null = null;
  let bestD = 0.85;
  for (const u of s.units) {
    if (u.offMap !== null || u.owner !== 'player') continue;
    const d = Math.hypot(u.x - ftx, u.y - fty);
    if (d < bestD) { bestD = d; best = u; }
  }
  return best;
}

function handleWorldClick(sx: number, sy: number): void {
  const s = state!;
  const r = renderer!;
  if (currentPanelId()) return; // panel layer owns the screen while open
  const [tx, ty] = r.screenToTile(sx, sy);
  if (tx < 0 || ty < 0 || tx >= s.mapW || ty >= s.mapH) return;

  if (ctx.mode === 'build' && ctx.selectedBuild) {
    const res = engine.build(s, ctx.selectedBuild, tx, ty);
    if (typeof res === 'string') toast('warning', res);
    else audio.playSfx('build-place');
    return; // stay in build mode for multi-place
  }

  if (ctx.mode === 'demolish') {
    const hadBuilding = s.tileBuilding[ty * s.mapW + tx] > 0;
    const err = engine.demolish(s, tx, ty);
    if (err) toast('warning', err);
    else audio.playSfx(hadBuilding ? 'explosion' : 'ui-click');
    return; // stay in demolish mode
  }

  // Info mode — units take priority (they sit on top of tiles)
  const [wx, wy] = r.camera.screenToWorld(sx, sy);
  const [ftx, fty] = Camera.worldToTile(wx, wy);
  const u = pickUnit(ftx, fty);
  if (u) {
    r.selectedUnitIds.clear();
    r.selectedUnitIds.add(u.id);
    r.selectedBuildingId = null;
    openUnitOrders(ctx, u.id);
    return;
  }
  const tb = s.tileBuilding[ty * s.mapW + tx];
  if (tb > 0) {
    const id = tb - 1;
    r.selectedBuildingId = id;
    r.selectedUnitIds.clear();
    openBuildingInfo(ctx, id);
  }
}

// ---------------------------------------------------------------- audio events

engine.events.on('attack', () => audio.playSfx('alert'));
engine.events.on('month', () => audio.playSfx('month-tick'));
engine.events.on('invention', () => audio.playSfx('construction-complete'));
engine.events.on('medal', () => audio.playSfx('ship-complete'));
engine.events.on('gameover', () => audio.playSfx('alert'));
engine.events.on('notification', (e) => {
  if (e.note.kind === 'danger') audio.playSfx('alert');
  else if (e.note.kind === 'info' && /complete|operational|ready/i.test(e.note.text)) {
    audio.playSfx(/ship|fighter|cruiser|warship|bomber|solar|explorer/i.test(e.note.text)
      ? 'ship-complete' : 'construction-complete');
  }
});

// sfx for combat effects — peeked before the renderer drains state.effects
let lastLaserAt = 0;
let lastBoomAt = 0;
function effectSfx(now: number): void {
  const s = state!;
  if (s.effects.length === 0) return;
  for (const fx of s.effects) {
    if ((fx.fx === 'shot' || fx.fx === 'missile') && now - lastLaserAt > 130) {
      audio.playSfx('laser');
      lastLaserAt = now;
    } else if ((fx.fx === 'explosion' || fx.fx === 'mine') && now - lastBoomAt > 220) {
      audio.playSfx('explosion');
      lastBoomAt = now;
    }
  }
}

// ---------------------------------------------------------------- main loop

const SIM_STEP = 1 / 30; // fixed-step sim; engine applies speed & pause itself
let acc = 0;
let lastNow = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.25, (now - lastNow) / 1000);
  lastNow = now;
  if (state && renderer && ui) {
    // sim
    acc += dt;
    while (acc >= SIM_STEP) {
      engine.advance(state, SIM_STEP);
      acc -= SIM_STEP;
    }

    const panelOpen = currentPanelId() !== null;
    const cam = renderer.camera;
    cam.edgeScroll = !panelOpen;

    // hover tile
    if (cam.mouseX >= 0 && !panelOpen) {
      const [tx, ty] = cam.screenToTile(cam.mouseX, cam.mouseY);
      renderer.hoverTile =
        tx >= 0 && ty >= 0 && tx < state.mapW && ty < state.mapH ? { x: tx, y: ty } : null;
    } else {
      renderer.hoverTile = null;
    }

    // build ghost
    if (ctx.mode === 'build' && ctx.selectedBuild && renderer.hoverTile && !panelOpen) {
      const { x, y } = renderer.hoverTile;
      const reason = engine.canBuild(state, ctx.selectedBuild, x, y);
      renderer.ghost = { type: ctx.selectedBuild, x, y, valid: reason === null, reason };
    } else {
      renderer.ghost = null;
    }

    // selection rings only persist while their panel is open
    if (!panelOpen && (renderer.selectedBuildingId !== null || renderer.selectedUnitIds.size > 0)) {
      renderer.selectedBuildingId = null;
      renderer.selectedUnitIds.clear();
    }

    effectSfx(now);
    renderer.render(now / 1000);
    ui.update();
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- boot

showTitle();
requestAnimationFrame(frame);

// debug handle (smoke tests / console poking)
Object.defineProperty(window, '__utopia', {
  get: () => ({ state, renderer, engine, ctx }),
});
