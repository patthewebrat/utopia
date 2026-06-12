// Map screen — full-map canvas with layer buttons, colour key, click-to-recentre,
// marker placement row (1–8).

import * as engine from '../../engine';
import type { GameState, TerrainType } from '../../types';
import type { UIContext } from '../context';
import { el, button } from '../dom';
import { openPanel, toast } from '../panels';

type Layer = 'buildings' | 'ore' | 'fuel' | 'radar' | 'movement' | 'power' | 'weapons';

const LAYERS: { id: Layer; label: string }[] = [
  { id: 'buildings', label: 'BUILDINGS' }, { id: 'ore', label: 'ORE' }, { id: 'fuel', label: 'FUEL' },
  { id: 'radar', label: 'RADAR' }, { id: 'movement', label: 'MOVEMENT' },
  { id: 'power', label: 'POWER' }, { id: 'weapons', label: 'WEAPONS' },
];

const TERRAIN_COL: Record<TerrainType, string> = {
  plain: '#2E3B30', rock: '#494E55', moss: '#2A5638', ice: '#7E97B5', lava: '#4A2A24',
  water: '#1A3350', dune: '#6E5C3C', crystal: '#5C3344', oil: '#221E2E',
};

const KEYS: Record<Layer, [string, string][]> = {
  buildings: [['#E8F4F2', 'Structure'], ['#FFB347', 'Mine / Chem Plant'], ['#37E0F2', 'Flux Pod'], ['#7E949C', 'Scaffold'], ['#FF4D4D', 'Wreckage']],
  ore: [['#FFB347', 'Ore deposit (bright = rich)'], ['#E8F4F2', 'Mine']],
  fuel: [['#D97B1F', 'Fuel deposit (bright = rich)'], ['#E8F4F2', 'Chemical Plant']],
  radar: [['#37E0F2', 'Radar + coverage'], ['#FF4D4D', 'Enemy contact']],
  movement: [['#5FF2DC', 'Friendly unit'], ['#FF4D4D', 'Enemy unit (visible)'], ['#FFB347', 'Marker']],
  power: [['#FFB347', 'Power Station / Solar'], ['#37E0F2', 'Flux Pod'], ['#E8F4F2', 'Command Centre'], ['#A07BE8', 'Matter Transporter']],
  weapons: [['#37E0F2', 'Turret'], ['#FF4D4D', 'Missile Launcher'], ['#FFB347', 'Land Mine']],
};

export function openMapScreen(ctx: UIContext): void {
  let layer: Layer = 'buildings';
  let placingMarker: number | null = null;

  openPanel(ctx, {
    id: 'map',
    title: 'Colony Map',
    size: 'full',
    render(body, refresh) {
      const s = ctx.getState();

      // layer buttons
      const bar = el('div', 'u-map-bar');
      for (const L of LAYERS) {
        bar.appendChild(button(`u-seg-btn${layer === L.id ? ' u-active' : ''}`, L.label, () => {
          layer = L.id; placingMarker = null; refresh();
        }));
      }
      body.appendChild(bar);

      // canvas
      const scale = 8;
      const c = document.createElement('canvas');
      c.width = s.mapW * scale; c.height = s.mapH * scale;
      c.className = 'u-map-canvas';
      drawMap(c, s, layer, ctx);
      body.appendChild(c);

      c.addEventListener('click', (ev) => {
        // account for object-fit: contain letterboxing inside the element box
        const r = c.getBoundingClientRect();
        const scaleFit = Math.min(r.width / c.width, r.height / c.height);
        const drawnW = c.width * scaleFit, drawnH = c.height * scaleFit;
        const offX = r.left + (r.width - drawnW) / 2;
        const offY = r.top + (r.height - drawnH) / 2;
        const x = Math.floor(((ev.clientX - offX) / drawnW) * s.mapW);
        const y = Math.floor(((ev.clientY - offY) / drawnH) * s.mapH);
        if (x < 0 || y < 0 || x >= s.mapW || y >= s.mapH) return;
        if (placingMarker !== null) {
          engine.placeMarker(s, placingMarker, x, y);
          toast('info', `Marker ${placingMarker + 1} ${s.markers[placingMarker] ? `placed at ${x},${y}` : 'removed'}.`);
          placingMarker = null;
          refresh();
        } else {
          // recentre the main view but STAY in the Map screen (brief §13);
          // refresh redraws the white view square at its new position
          ctx.centerOn(x, y);
          refresh();
        }
      });

      // key + markers
      const foot = el('div', 'u-map-foot');
      const key = el('div', 'u-map-key');
      for (const [col, label] of KEYS[layer]) {
        const k = el('span', 'u-key-item');
        const sw = el('span', 'u-key-swatch');
        sw.style.background = col;
        k.append(sw, el('span', 'u-key-label', label));
        key.appendChild(k);
      }
      foot.appendChild(key);

      const mk = el('div', 'u-map-markers');
      mk.appendChild(el('span', 'u-ctl-label', 'MARKERS'));
      s.markers.forEach((m, i) => {
        const b = button(
          `u-marker-btn${m ? ' u-marker-btn--set' : ''}${placingMarker === i ? ' u-active' : ''}`,
          String(i + 1),
          () => { placingMarker = placingMarker === i ? null : i; refresh(); },
        );
        b.title = m ? `At ${m.x},${m.y} — click then click map to move (same tile removes)` : 'Click, then click the map to place';
        mk.appendChild(b);
      });
      foot.appendChild(mk);
      body.appendChild(foot);
      body.appendChild(el('p', 'u-hint',
        placingMarker !== null
          ? `Click the map to place marker ${placingMarker + 1}.`
          : 'Click the map to recentre the main view. Select a marker number to place/move markers.'));
    },
  });
}

function drawMap(c: HTMLCanvasElement, s: GameState, layer: Layer, ctx: UIContext): void {
  const g = c.getContext('2d')!;
  const sc = c.width / s.mapW;
  const dim = layer === 'ore' || layer === 'fuel' ? 0.45 : 0.85;

  // terrain
  for (let y = 0; y < s.mapH; y++) {
    for (let x = 0; x < s.mapW; x++) {
      g.fillStyle = TERRAIN_COL[s.terrain[y * s.mapW + x]];
      g.fillRect(x * sc, y * sc, sc, sc);
    }
  }
  g.fillStyle = `rgba(7,11,14,${1 - dim})`;
  g.fillRect(0, 0, c.width, c.height);
  // border vignette
  g.strokeStyle = 'rgba(31,182,201,0.35)'; g.lineWidth = 1;
  g.strokeRect(4 * sc, 4 * sc, (s.mapW - 8) * sc, (s.mapH - 8) * sc);

  const px = (x: number, y: number, col: string, size = 1): void => {
    g.fillStyle = col;
    const o = (size - 1) / 2;
    g.fillRect((x - o) * sc, (y - o) * sc, sc * size, sc * size);
  };

  if (layer === 'ore' || layer === 'fuel') {
    const arr = layer === 'ore' ? s.oreYield : s.fuelYield;
    const base = layer === 'ore' ? [255, 179, 71] : [217, 123, 31];
    for (let y = 0; y < s.mapH; y++) {
      for (let x = 0; x < s.mapW; x++) {
        const v = arr[y * s.mapW + x];
        if (v > 0 && engine.depositVisible(s, x, y, layer)) {
          g.fillStyle = `rgba(${base[0]},${base[1]},${base[2]},${0.35 + (v / 9) * 0.65})`;
          g.fillRect(x * sc, y * sc, sc, sc);
        }
      }
    }
    for (const b of s.buildings) {
      if (layer === 'ore' && b.type === 'mine') px(b.x, b.y, '#E8F4F2', 2);
      if (layer === 'fuel' && b.type === 'chemicalPlant') px(b.x, b.y, '#E8F4F2', 2);
    }
  }

  if (layer === 'buildings') {
    for (let i = 0; i < s.wreckage.length; i++) {
      if (s.wreckage[i]) px(i % s.mapW, Math.floor(i / s.mapW), '#FF4D4D');
    }
    for (const b of s.buildings) {
      if (b.status === 'scaffold') px(b.x, b.y, '#7E949C');
      else if (b.type === 'mine' || b.type === 'chemicalPlant') px(b.x, b.y, '#FFB347');
      else if (b.type === 'fluxPod') px(b.x, b.y, '#37E0F2');
      else px(b.x, b.y, '#E8F4F2');
    }
  }

  if (layer === 'radar') {
    for (const b of s.buildings) {
      if (b.type !== 'radar' || b.status !== 'complete' || !b.powered) continue;
      const range = (b.longRange ? 28 : 16) * sc;
      g.fillStyle = 'rgba(55,224,242,0.10)';
      g.beginPath(); g.arc(b.x * sc, b.y * sc, range, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(55,224,242,0.5)';
      g.beginPath(); g.arc(b.x * sc, b.y * sc, range, 0, Math.PI * 2); g.stroke();
      px(b.x, b.y, '#37E0F2', 2);
    }
    for (const u of s.units) {
      if (u.owner === 'enemy' && !u.offMap && engine.enemyVisible(s, u.x, u.y)) px(Math.round(u.x), Math.round(u.y), '#FF4D4D', 2);
    }
  }

  if (layer === 'movement') {
    for (const u of s.units) {
      if (u.offMap) continue;
      if (u.owner === 'player') px(Math.round(u.x), Math.round(u.y), '#5FF2DC', 2);
      else if (engine.enemyVisible(s, u.x, u.y)) px(Math.round(u.x), Math.round(u.y), '#FF4D4D', 2);
    }
  }

  if (layer === 'power') {
    for (const b of s.buildings) {
      if (b.type === 'powerStation' || b.type === 'solarPanel' || b.type === 'solarGenerator') px(b.x, b.y, '#FFB347', 2);
      else if (b.type === 'fluxPod') px(b.x, b.y, '#37E0F2', 2);
      else if (b.type === 'commandCentre') px(b.x, b.y, '#E8F4F2', 2);
      else if (b.type === 'matterTransporter') px(b.x, b.y, '#A07BE8', 2);
    }
  }

  if (layer === 'weapons') {
    for (const b of s.buildings) {
      if (b.type === 'laserTurret') px(b.x, b.y, '#37E0F2', 2);
      else if (b.type === 'missileLauncher' && !b.fired) px(b.x, b.y, '#FF4D4D', 2);
      else if (b.type === 'landMine') px(b.x, b.y, '#FFB347', 2);
    }
  }

  // markers (always)
  s.markers.forEach((m, i) => {
    if (!m) return;
    px(m.x, m.y, '#FFB347', 2);
    g.fillStyle = '#0A1014'; g.font = `bold ${sc * 1.6}px monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(i + 1), m.x * sc + sc / 2, m.y * sc + sc / 2);
  });

  // current view rectangle
  if (ctx.getViewCenter) {
    const v = ctx.getViewCenter();
    g.strokeStyle = '#E8F4F2'; g.lineWidth = 1.5;
    g.strokeRect((v.x - 9) * sc, (v.y - 6) * sc, 18 * sc, 12 * sc);
  }
}
