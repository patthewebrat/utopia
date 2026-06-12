// Procedural building icons for the build palette / info panels.
// Small stylised iso glyphs drawn with Canvas2D — original art, palette per
// ART_DIRECTION §3 (teal/white player tech on dark tiles). NOT the world sprites;
// the renderer's art module owns those. These are deliberately simple & readable.

import type { BuildingType } from '../types';

type Shape =
  | 'blocks' | 'vault' | 'cyl' | 'frame' | 'station' | 'panel' | 'orb' | 'cross'
  | 'dome' | 'gantry' | 'columns' | 'bunker' | 'shed' | 'crates' | 'tankcyl'
  | 'pyramid' | 'tower' | 'stadium' | 'dish' | 'turret' | 'missile' | 'hall'
  | 'drydock' | 'pad' | 'arch' | 'glyph' | 'minedisc';

const SPEC: Record<BuildingType, { shape: Shape; a: string; b: string }> = {
  livingQuarters:    { shape: 'blocks',  a: '#E8F4F2', b: '#FFB347' },
  hydroponics:       { shape: 'vault',   a: '#37E0F2', b: '#5CE08A' },
  morgroHydroponics: { shape: 'vault',   a: '#9BE82A', b: '#5CE08A' },
  lifeSupport:       { shape: 'cyl',     a: '#E8F4F2', b: '#37E0F2' },
  spaceMossConverter:{ shape: 'frame',   a: '#19B8A6', b: '#5CE08A' },
  powerStation:      { shape: 'station', a: '#3A444C', b: '#FFB347' },
  solarPanel:        { shape: 'panel',   a: '#2A2E6E', b: '#37E0F2' },
  solarGenerator:    { shape: 'panel',   a: '#3A3E8E', b: '#5FF2DC' },
  fluxPod:           { shape: 'orb',     a: '#19B8A6', b: '#5FF2DC' },
  hospital:          { shape: 'cross',   a: '#E8F4F2', b: '#5CE08A' },
  laboratory:        { shape: 'dome',    a: '#E8F4F2', b: '#A07BE8' },
  mine:              { shape: 'gantry',  a: '#8C7A5C', b: '#FFB347' },
  chemicalPlant:     { shape: 'columns', a: '#E8F4F2', b: '#FFB347' },
  armsLab:           { shape: 'bunker',  a: '#3A444C', b: '#FF4D4D' },
  workshop:          { shape: 'shed',    a: '#9AA8B0', b: '#19B8A6' },
  store:             { shape: 'crates',  a: '#E8F4F2', b: '#19B8A6' },
  fuelTank:          { shape: 'tankcyl', a: '#E8F4F2', b: '#D97B1F' },
  commandCentre:     { shape: 'pyramid', a: '#E8F4F2', b: '#37E0F2' },
  securityHQ:        { shape: 'tower',   a: '#2A3E66', b: '#E8F4F2' },
  sportsComplex:     { shape: 'stadium', a: '#E8F4F2', b: '#5CE08A' },
  radar:             { shape: 'dish',    a: '#E8F4F2', b: '#FF4D4D' },
  laserTurret:       { shape: 'turret',  a: '#19B8A6', b: '#37E0F2' },
  missileLauncher:   { shape: 'missile', a: '#E8F4F2', b: '#19B8A6' },
  tankYard:          { shape: 'hall',    a: '#8C96A0', b: '#FFB347' },
  shipYard:          { shape: 'drydock', a: '#8C96A0', b: '#FFB347' },
  launchPad:         { shape: 'pad',     a: '#2A3238', b: '#E8F4F2' },
  landMine:          { shape: 'minedisc',a: '#2A3238', b: '#FF4D4D' },
  matterTransporter: { shape: 'arch',    a: '#19B8A6', b: '#5FF2DC' },
  tankTeleport:      { shape: 'glyph',   a: '#19B8A6', b: '#A07BE8' },
};

const cache = new Map<BuildingType, HTMLCanvasElement>();

/** 64×64 logical icon canvas (128×128 backing) for a building type */
export function buildingIcon(type: BuildingType): HTMLCanvasElement {
  const hit = cache.get(type);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  c.style.width = '64px'; c.style.height = '64px';
  const g = c.getContext('2d')!;
  g.scale(2, 2);
  drawTile(g);
  const { shape, a, b } = SPEC[type];
  draw(g, shape, a, b);
  cache.set(type, c);
  return c;
}

function drawTile(g: CanvasRenderingContext2D): void {
  // ground diamond
  g.save();
  const grad = g.createLinearGradient(8, 36, 56, 60);
  grad.addColorStop(0, '#16222A'); grad.addColorStop(1, '#0B1216');
  g.fillStyle = grad;
  diamond(g, 32, 48, 28, 14); g.fill();
  g.strokeStyle = 'rgba(55,224,242,0.25)'; g.lineWidth = 1;
  diamond(g, 32, 48, 28, 14); g.stroke();
  g.restore();
}

function diamond(g: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number): void {
  g.beginPath();
  g.moveTo(cx, cy - hh); g.lineTo(cx + hw, cy); g.lineTo(cx, cy + hh); g.lineTo(cx - hw, cy);
  g.closePath();
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const gg = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${gg},${b})`;
}

/** iso box: top face + two sides, base centred at (cx,cy) */
function box(g: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number, h: number, col: string): void {
  // left face
  g.fillStyle = shade(col, 0.55);
  g.beginPath(); g.moveTo(cx - hw, cy); g.lineTo(cx, cy + hh); g.lineTo(cx, cy + hh - h); g.lineTo(cx - hw, cy - h); g.closePath(); g.fill();
  // right face
  g.fillStyle = shade(col, 0.75);
  g.beginPath(); g.moveTo(cx + hw, cy); g.lineTo(cx, cy + hh); g.lineTo(cx, cy + hh - h); g.lineTo(cx + hw, cy - h); g.closePath(); g.fill();
  // top
  g.fillStyle = col;
  diamond(g, cx, cy - h, hw, hh); g.fill();
}

function glowDot(g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string): void {
  g.save();
  g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 6;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.restore();
}

function draw(g: CanvasRenderingContext2D, shape: Shape, a: string, b: string): void {
  switch (shape) {
    case 'blocks':
      box(g, 24, 46, 9, 5, 12, a); box(g, 33, 43, 9, 5, 18, a); box(g, 42, 40, 8, 4, 24, a);
      g.fillStyle = b;
      for (let i = 0; i < 3; i++) { g.fillRect(28 + i * 9, 26 + i * 2, 2.5, 2.5); g.fillRect(28 + i * 9, 32 + i * 2, 2.5, 2.5); }
      break;
    case 'vault': {
      box(g, 32, 48, 22, 11, 6, '#E8F4F2');
      g.save(); g.globalAlpha = 0.75; g.fillStyle = a;
      g.beginPath(); g.ellipse(32, 40, 20, 11, 0, Math.PI, 0); g.fill(); g.restore();
      g.fillStyle = b;
      for (let i = 0; i < 3; i++) { g.fillRect(20 + i * 8, 41, 6, 2); }
      break;
    }
    case 'cyl': {
      g.fillStyle = shade(a, 0.7); g.fillRect(20, 26, 24, 20);
      g.fillStyle = a; g.beginPath(); g.ellipse(32, 26, 12, 5.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = shade(a, 0.85); g.beginPath(); g.ellipse(32, 46, 12, 5.5, 0, 0, Math.PI); g.fill();
      g.strokeStyle = b; g.lineWidth = 2;
      g.beginPath(); g.moveTo(24, 33); g.lineTo(24, 42); g.moveTo(28, 34); g.lineTo(28, 43); g.stroke();
      // turbine
      g.strokeStyle = shade(a, 0.5);
      g.beginPath(); g.moveTo(26, 24); g.lineTo(38, 27); g.moveTo(32, 22); g.lineTo(32, 29); g.stroke();
      break;
    }
    case 'frame': {
      g.fillStyle = '#2E6B3F'; diamond(g, 32, 48, 20, 10); g.fill();
      g.strokeStyle = a; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(14, 46); g.lineTo(32, 22); g.lineTo(50, 46); g.moveTo(32, 22); g.lineTo(32, 50); g.stroke();
      glowDot(g, 32, 22, 4, b);
      break;
    }
    case 'station':
      box(g, 32, 47, 18, 9, 16, a);
      g.fillStyle = shade(a, 1.3); g.fillRect(24, 14, 4, 18); g.fillRect(36, 12, 4, 20);
      glowDot(g, 32, 38, 3.5, b);
      break;
    case 'panel': {
      g.strokeStyle = '#E8F4F2'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(32, 48); g.lineTo(32, 34); g.stroke();
      g.save(); g.translate(32, 30); g.rotate(-0.35);
      g.fillStyle = a; g.fillRect(-18, -8, 36, 16);
      g.strokeStyle = b; g.lineWidth = 1;
      for (let i = -12; i <= 12; i += 6) { g.beginPath(); g.moveTo(i, -8); g.lineTo(i, 8); g.stroke(); }
      g.restore();
      break;
    }
    case 'orb': {
      g.strokeStyle = shade(a, 0.8); g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(24, 48); g.lineTo(32, 38); g.moveTo(40, 48); g.lineTo(32, 38); g.moveTo(32, 50); g.lineTo(32, 38); g.stroke();
      glowDot(g, 32, 28, 9, b);
      g.strokeStyle = a; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(32, 28, 14, 5, -0.3, 0, Math.PI * 2); g.stroke();
      break;
    }
    case 'cross':
      box(g, 32, 46, 17, 8, 13, a);
      g.fillStyle = b; g.fillRect(29.5, 22, 5, 14); g.fillRect(25, 26.5, 14, 5);
      break;
    case 'dome': {
      box(g, 32, 48, 18, 9, 7, a);
      g.fillStyle = a; g.beginPath(); g.arc(32, 36, 13, Math.PI, 0); g.fill();
      g.fillStyle = b; g.beginPath(); g.arc(32, 36, 13, -1.2, -0.5); g.lineTo(32, 36); g.closePath(); g.fill();
      break;
    }
    case 'gantry': {
      g.fillStyle = '#1A1411'; diamond(g, 32, 48, 18, 9); g.fill();
      g.strokeStyle = a; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(20, 50); g.lineTo(34, 20); g.lineTo(46, 50); g.moveTo(27, 36) ; g.lineTo(41, 36); g.stroke();
      g.fillStyle = a; g.beginPath(); g.arc(34, 20, 4, 0, Math.PI * 2); g.fill();
      glowDot(g, 44, 42, 2, b); glowDot(g, 40, 46, 1.6, b);
      break;
    }
    case 'columns':
      for (const [x, h] of [[22, 22], [32, 28], [42, 20]] as const) {
        g.fillStyle = a; g.fillRect(x - 4, 48 - h, 8, h);
        g.fillStyle = b; g.fillRect(x - 4, 48 - h + 5, 8, 3);
      }
      g.strokeStyle = shade(a, 0.7); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(22, 32); g.quadraticCurveTo(32, 26, 42, 34); g.stroke();
      glowDot(g, 46, 22, 2, '#FF5A1F');
      break;
    case 'bunker':
      box(g, 32, 47, 20, 10, 9, a);
      g.fillStyle = b; g.fillRect(26, 40, 12, 2);
      g.strokeStyle = '#E8F4F2'; g.lineWidth = 2;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(24 + i * 6, 34); g.lineTo(30 + i * 6, 30); g.stroke(); }
      break;
    case 'shed': {
      box(g, 32, 47, 20, 10, 11, a);
      g.fillStyle = shade(a, 1.25);
      g.beginPath(); g.moveTo(14, 36); g.lineTo(22, 28); g.lineTo(22, 36); g.lineTo(30, 28); g.lineTo(30, 36); g.closePath(); g.fill();
      g.fillStyle = b; g.fillRect(34, 38, 8, 8);
      break;
    }
    case 'crates':
      box(g, 24, 48, 8, 4, 9, a); box(g, 40, 48, 8, 4, 9, a);
      box(g, 32, 44, 8, 4, 9, a); box(g, 32, 33, 8, 4, 9, a);
      g.fillStyle = b; g.fillRect(29, 22, 6, 3);
      break;
    case 'tankcyl': {
      g.fillStyle = shade(a, 0.85);
      g.beginPath(); g.ellipse(32, 38, 17, 10, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = b; g.fillRect(15, 35, 34, 6);
      g.fillStyle = a; g.beginPath(); g.ellipse(49, 38, 3, 10, 0, -Math.PI / 2, Math.PI / 2); g.fill();
      break;
    }
    case 'pyramid': {
      for (const [w, h, y] of [[20, 8, 48], [15, 8, 40], [10, 8, 32], [5, 8, 24]] as const) {
        box(g, 32, y, w, w / 2, h, a);
      }
      g.fillStyle = b; g.fillRect(24, 30, 16, 2.5);
      glowDot(g, 32, 14, 2.5, '#E8F4F2');
      break;
    }
    case 'tower':
      box(g, 30, 47, 14, 7, 14, a);
      g.fillStyle = '#E8F4F2'; g.fillRect(18, 36, 24, 3);
      box(g, 45, 42, 4, 2, 22, shade(a, 1.3));
      glowDot(g, 45, 18, 2.5, '#7EB8FF');
      break;
    case 'stadium': {
      g.strokeStyle = a; g.lineWidth = 4;
      g.beginPath(); g.ellipse(32, 42, 19, 10, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = b; g.globalAlpha = 0.8;
      g.beginPath(); g.ellipse(32, 42, 13, 6, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
      for (const [x, y] of [[14, 32], [50, 32], [14, 50], [50, 50]] as const) glowDot(g, x, y, 1.6, '#E8F4F2');
      break;
    }
    case 'dish': {
      box(g, 32, 48, 10, 5, 8, a);
      g.save(); g.translate(32, 32); g.rotate(-0.5);
      g.fillStyle = a; g.beginPath(); g.ellipse(0, 0, 14, 6, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = shade(a, 0.6); g.lineWidth = 1;
      g.beginPath(); g.ellipse(0, 0, 9, 3.6, 0, 0, Math.PI * 2); g.stroke();
      g.restore();
      g.strokeStyle = shade(a, 0.8); g.beginPath(); g.moveTo(32, 32); g.lineTo(42, 22); g.stroke();
      glowDot(g, 42, 22, 2, b);
      break;
    }
    case 'turret': {
      g.fillStyle = shade(a, 0.7); g.beginPath(); g.ellipse(32, 44, 14, 7, 0, 0, Math.PI * 2); g.fill();
      box(g, 32, 44, 9, 4.5, 8, a);
      g.strokeStyle = b; g.lineWidth = 3;
      g.beginPath(); g.moveTo(32, 33); g.lineTo(47, 24); g.stroke();
      glowDot(g, 47, 24, 2.5, b);
      break;
    }
    case 'missile': {
      g.strokeStyle = '#8C96A0'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(25, 50); g.lineTo(25, 24); g.moveTo(25, 30); g.lineTo(31, 30); g.moveTo(25, 42); g.lineTo(31, 42); g.stroke();
      g.fillStyle = a;
      g.beginPath(); g.moveTo(35, 18); g.lineTo(39, 26); g.lineTo(39, 46); g.lineTo(31, 46); g.lineTo(31, 26); g.closePath(); g.fill();
      g.fillStyle = b; g.beginPath(); g.moveTo(35, 14); g.lineTo(39, 26); g.lineTo(31, 26); g.closePath(); g.fill();
      glowDot(g, 27, 50, 1.8, '#FF4D4D');
      break;
    }
    case 'hall':
      box(g, 32, 47, 21, 10, 13, a);
      g.fillStyle = '#10181E'; g.fillRect(36, 34, 12, 12);
      g.fillStyle = b; g.fillRect(36, 34, 12, 2);
      g.fillStyle = '#19B8A6'; g.fillRect(38, 42, 8, 4);
      break;
    case 'drydock': {
      g.strokeStyle = a; g.lineWidth = 3;
      g.beginPath(); g.moveTo(16, 50); g.lineTo(16, 20); g.moveTo(48, 50); g.lineTo(48, 20); g.moveTo(16, 22); g.lineTo(48, 22); g.stroke();
      g.fillStyle = '#E8F4F2';
      g.beginPath(); g.ellipse(32, 40, 13, 6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#19B8A6'; g.fillRect(20, 38, 24, 3);
      glowDot(g, 16, 20, 2, b); glowDot(g, 48, 20, 2, b);
      break;
    }
    case 'pad':
      g.fillStyle = a; diamond(g, 32, 42, 24, 12); g.fill();
      g.strokeStyle = b; g.lineWidth = 2; diamond(g, 32, 42, 18, 9); g.stroke();
      g.beginPath(); g.ellipse(32, 42, 8, 4, 0, 0, Math.PI * 2); g.stroke();
      break;
    case 'arch': {
      g.strokeStyle = a; g.lineWidth = 4;
      g.beginPath(); g.moveTo(20, 50); g.lineTo(20, 26); g.moveTo(44, 50); g.lineTo(44, 26); g.stroke();
      g.fillStyle = a; g.beginPath(); g.arc(20, 24, 3.5, 0, Math.PI * 2); g.arc(44, 24, 3.5, 0, Math.PI * 2); g.fill();
      const grad = g.createLinearGradient(24, 0, 40, 0);
      grad.addColorStop(0, 'rgba(95,242,220,0.0)'); grad.addColorStop(0.5, 'rgba(95,242,220,0.55)'); grad.addColorStop(1, 'rgba(95,242,220,0.0)');
      g.fillStyle = grad; g.fillRect(23, 26, 18, 24); void b;
      break;
    }
    case 'glyph':
      g.strokeStyle = a; g.lineWidth = 2;
      diamond(g, 32, 42, 22, 11); g.stroke();
      g.strokeStyle = b; diamond(g, 32, 42, 14, 7); g.stroke();
      g.strokeStyle = a; diamond(g, 32, 42, 7, 3.5); g.stroke();
      for (const [x, y] of [[10, 42], [54, 42], [32, 31], [32, 53]] as const) glowDot(g, x, y, 1.8, b);
      break;
    case 'minedisc':
      g.fillStyle = a; g.beginPath(); g.ellipse(32, 44, 12, 6, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = shade(a, 1.6); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(24, 41); g.lineTo(22, 37); g.moveTo(32, 39); g.lineTo(32, 35); g.moveTo(40, 41); g.lineTo(42, 37); g.stroke();
      glowDot(g, 32, 44, 2, b);
      break;
  }
}
