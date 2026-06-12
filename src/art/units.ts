// Unit sprites — tanks (8 facings), the five ships + fusion cruiser, enemy
// craft/vehicles. Player = white/teal rounded; enemy = angular crimson/black.
// Sprites are authored facing screen-right (angle 0) and cached per 8-step
// facing; the renderer picks facing from the unit's screen-space velocity.

import type { UnitKind } from '../types';
import { PLAYER, ENEMY, UI, shade, alpha } from './palette';
import { Ctx, glow, contactShadow } from './iso';
import { sprite, Sprite } from './sprites';

const U_W = 110;
const U_H = 110;
const U_AX = 55;
const U_AY = 72; // anchor = ground point under the unit centre

export const FACINGS = 8;

/** flatten-rotate helper: rotates in ground plane then applies 2:1 squash */
function groundTransform(ctx: Ctx, screenAngle: number): void {
  ctx.scale(1, 0.5);
  ctx.rotate(screenAngle);
}

// All hull draw functions run in "flat" space: x forward, y left/right,
// drawn at y-scale 0.5 via groundTransform. Heights are faked with a
// pre-squash vertical lift handled per part (simple painter layering).

function tankHull(ctx: Ctx, hover: boolean): void {
  const hull = PLAYER.primary;
  if (hover) {
    // skirted hover plenum + ground-effect glow
    glow(ctx, 0, 0, 22, PLAYER.glow, 0.4);
    ctx.fillStyle = shade(hull, -0.35);
    ctx.beginPath(); ctx.ellipse(0, 0, 17, 12, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    // twin track units
    ctx.fillStyle = '#1A2024';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.roundRect(-16, s * 7 - 4.5, 32, 9, 4.5);
      ctx.fill();
    }
    ctx.fillStyle = '#30383E';
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(-11 + i * 7.4, s * 7, 2.4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // wedge hull, pointed forward (+x)
  const g = ctx.createLinearGradient(0, -10, 0, 10);
  g.addColorStop(0, shade(hull, 0.25));
  g.addColorStop(1, shade(hull, -0.25));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(8, -8);
  ctx.lineTo(-13, -8);
  ctx.lineTo(-15, 0);
  ctx.lineTo(-13, 8);
  ctx.lineTo(8, 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = alpha('#FFFFFF', 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(8, -8); ctx.lineTo(-13, -8); ctx.stroke();
  if (hover) {
    // rear thrust nacelles
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#10161A';
      ctx.beginPath(); ctx.ellipse(-15, s * 5, 3.4, 2.6, 0, 0, Math.PI * 2); ctx.fill();
      glow(ctx, -18, s * 5, 5, PLAYER.glow, 0.7);
    }
  }
  // white turret + short cannon
  ctx.fillStyle = PLAYER.secondary;
  ctx.beginPath(); ctx.arc(-1, 0, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1E262C';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(16, 0); ctx.stroke();
}

function enemyTankHull(ctx: Ctx): void {
  // low black wedge with crimson chevrons
  const g = ctx.createLinearGradient(0, -10, 0, 10);
  g.addColorStop(0, '#261E22');
  g.addColorStop(1, ENEMY.secondary);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(19, 0);
  ctx.lineTo(2, -10);
  ctx.lineTo(-15, -7);
  ctx.lineTo(-15, 7);
  ctx.lineTo(2, 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = alpha(ENEMY.primary, 0.9);
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.moveTo(-2 - i * 6, -6);
    ctx.lineTo(4 - i * 6, 0);
    ctx.lineTo(-2 - i * 6, 6);
    ctx.stroke();
  }
  // red slit light
  ctx.fillStyle = ENEMY.glow;
  ctx.fillRect(10, -1.2, 6, 2.4);
  glow(ctx, 13, 0, 6, ENEMY.glow, 0.5);
}

function shipHull(ctx: Ctx, kind: UnitKind): void {
  const W = PLAYER.secondary, T = PLAYER.primary;
  const hullG = (l: number) => {
    const g = ctx.createLinearGradient(0, -l, 0, l);
    g.addColorStop(0, shade(W, 0.12));
    g.addColorStop(1, shade(W, -0.3));
    return g;
  };
  const engine = (x: number, y: number, r: number) => {
    ctx.fillStyle = '#10161A';
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    glow(ctx, x - r * 1.6, y, r * 2.4, PLAYER.glow, 0.75);
  };
  const stripe = (x0: number, x1: number) => {
    ctx.strokeStyle = T;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.stroke();
  };
  switch (kind) {
    case 'explorer': {
      // small smooth teardrop, big sensor canopy, single engine
      ctx.fillStyle = hullG(9);
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.bezierCurveTo(12, -9, -8, -9, -14, -3);
      ctx.bezierCurveTo(-16, 0, -16, 0, -14, 3);
      ctx.bezierCurveTo(-8, 9, 12, 9, 16, 0);
      ctx.fill();
      stripe(-13, -4);
      // sensor canopy bubble
      const g = ctx.createRadialGradient(6, -2, 1, 5, 0, 8);
      g.addColorStop(0, alpha('#CFF6FF', 0.95));
      g.addColorStop(1, alpha(UI.cyan, 0.5));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(5, 0, 7, 5.5, 0, 0, Math.PI * 2); ctx.fill();
      engine(-15, 0, 3);
      break;
    }
    case 'fighter': {
      // slim dart, two swept winglets, twin engines
      ctx.fillStyle = hullG(5);
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-12, -4);
      ctx.lineTo(-16, 0);
      ctx.lineTo(-12, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(W, -0.12);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(2, s * 3);
        ctx.lineTo(-12, s * 14);
        ctx.lineTo(-14, s * 4);
        ctx.closePath();
        ctx.fill();
      }
      stripe(-10, 8);
      ctx.fillStyle = alpha(UI.cyan, 0.8);
      ctx.beginPath(); ctx.ellipse(8, 0, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
      engine(-14, -3, 2.2);
      engine(-14, 3, 2.2);
      break;
    }
    case 'assaultCraft': {
      // broader gull-wing body, chin cannon pod
      ctx.fillStyle = shade(W, -0.1);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(8, s * 4);
        ctx.quadraticCurveTo(-2, s * 18, -14, s * 16);
        ctx.lineTo(-12, s * 5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = hullG(8);
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.bezierCurveTo(16, -8, -12, -8, -17, 0);
      ctx.bezierCurveTo(-12, 8, 16, 8, 20, 0);
      ctx.fill();
      stripe(-14, 10);
      // chin cannon pod
      ctx.fillStyle = '#222A30';
      ctx.beginPath(); ctx.roundRect(8, -2, 10, 4, 2); ctx.fill();
      engine(-16, -4, 2.6);
      engine(-16, 4, 2.6);
      engine(-12, 0, 2.0);
      break;
    }
    case 'cruiser':
    case 'fusionCruiser': {
      // elongated hull, mid-spine fin, four engines, two turret bumps
      ctx.fillStyle = hullG(8);
      ctx.beginPath();
      ctx.moveTo(26, 0);
      ctx.bezierCurveTo(22, -8, -16, -9, -24, -4);
      ctx.lineTo(-24, 4);
      ctx.bezierCurveTo(-16, 9, 22, 8, 26, 0);
      ctx.fill();
      stripe(-20, 16);
      ctx.fillStyle = shade(W, -0.2);
      ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-10, -3); ctx.lineTo(-10, 3); ctx.closePath(); ctx.fill();
      for (const x of [6, -4]) {
        ctx.fillStyle = PLAYER.primary;
        ctx.beginPath(); ctx.arc(x, 0, 3, 0, Math.PI * 2); ctx.fill();
      }
      if (kind === 'fusionCruiser') {
        // glowing white-blue toroidal fusion ring replaces the rear third
        ctx.strokeStyle = alpha('#BFE8FF', 0.95);
        ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.ellipse(-20, 0, 5, 9, 0, 0, Math.PI * 2); ctx.stroke();
        glow(ctx, -20, 0, 13, '#9FD8FF', 0.8);
      } else {
        engine(-23, -5, 2.2);
        engine(-23, -1.8, 2.2);
        engine(-23, 1.8, 2.2);
        engine(-23, 5, 2.2);
      }
      break;
    }
    case 'warship': {
      // the brick: hammerhead prow, layered armour, six engines, missile cells
      ctx.fillStyle = hullG(12);
      ctx.beginPath();
      ctx.moveTo(30, -10);
      ctx.lineTo(34, -3);
      ctx.lineTo(34, 3);
      ctx.lineTo(30, 10);
      ctx.lineTo(14, 12);
      ctx.lineTo(-26, 10);
      ctx.lineTo(-30, 0);
      ctx.lineTo(-26, -10);
      ctx.lineTo(14, -12);
      ctx.closePath();
      ctx.fill();
      // layered armour plates
      ctx.strokeStyle = shade(W, -0.3);
      ctx.lineWidth = 1.2;
      for (const x of [18, 6, -6, -18]) {
        ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x - 2, 10); ctx.stroke();
      }
      stripe(-24, 26);
      // visible missile cells
      ctx.fillStyle = '#222A30';
      for (let i = 0; i < 4; i++) ctx.fillRect(-2 + i * 6, -8, 3.4, 4);
      for (let i = 0; i < 6; i++) engine(-29, -7.5 + i * 3, 1.9);
      break;
    }
    default:
      break;
  }
}

function enemyShipHull(ctx: Ctx, assault: boolean): void {
  // swept scythe wings, split twin tails, red slit canopy, black underside
  const s = assault ? 1.35 : 1;
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = ENEMY.secondary;
  for (const m of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(6, m * 2);
    ctx.quadraticCurveTo(2, m * 16, -16, m * 18);   // scythe sweep
    ctx.quadraticCurveTo(-6, m * 9, -10, m * 3);
    ctx.closePath();
    ctx.fill();
  }
  const g = ctx.createLinearGradient(0, -6, 0, 6);
  g.addColorStop(0, '#33222A');
  g.addColorStop(0.5, ENEMY.primary);
  g.addColorStop(1, '#1A0810');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-8, -5);
  ctx.lineTo(-15, -8);   // split twin tails
  ctx.lineTo(-10, -2);
  ctx.lineTo(-10, 2);
  ctx.lineTo(-15, 8);
  ctx.lineTo(-8, 5);
  ctx.closePath();
  ctx.fill();
  // hard specular edge
  ctx.strokeStyle = alpha('#FF8C9E', 0.7);
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-8, -5); ctx.stroke();
  // red slit canopy
  ctx.fillStyle = ENEMY.glow;
  ctx.fillRect(6, -1, 8, 2);
  glow(ctx, 10, 0, 6, ENEMY.glow, 0.6);
  // harsh red engine cores
  for (const m of [-1, 1]) {
    ctx.fillStyle = '#FF5A50';
    ctx.fillRect(-15, m * 4 - 1.2, 3, 2.4);
    glow(ctx, -17, m * 4, 5, ENEMY.glow, 0.9);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- public API

/** facing index 0..7 → screen angle (0 = screen-right, step 45°) */
export function unitSprite(kind: UnitKind, facing: number): Sprite {
  const f = ((facing % FACINGS) + FACINGS) % FACINGS;
  return sprite(`unit|${kind}|${f}`, U_W, U_H, U_AX, U_AY, (ctx) => {
    ctx.save();
    groundTransform(ctx, (f * Math.PI * 2) / FACINGS);
    switch (kind) {
      case 'tank': tankHull(ctx, false); break;
      case 'hoverTank': tankHull(ctx, true); break;
      case 'enemyTank': enemyTankHull(ctx); break;
      case 'enemyFighter': enemyShipHull(ctx, false); break;
      case 'enemyAssault': enemyShipHull(ctx, true); break;
      default: shipHull(ctx, kind); break;
    }
    ctx.restore();
  });
}

/** soft ground shadow blob, scaled/faded by altitude in the renderer */
export function unitShadow(big: boolean): Sprite {
  return sprite(`unitshadow|${big ? 1 : 0}`, 80, 40, 40, 20, (ctx) => {
    contactShadow(ctx, big ? 30 : 20, big ? 15 : 10, 0.4, 0, 0);
  });
}

/** selection ring (player teal / enemy crimson) */
export function selectionRing(enemy: boolean): Sprite {
  return sprite(`selring|${enemy ? 1 : 0}`, 84, 44, 42, 22, (ctx) => {
    const c = enemy ? ENEMY.glow : PLAYER.glow;
    ctx.strokeStyle = alpha(c, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, 28, 14, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = alpha(c, 0.3);
    ctx.lineWidth = 5;
    ctx.stroke();
    // corner ticks
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 14, 0, a - 0.18, a + 0.18);
      ctx.stroke();
    }
  });
}

/** marker flag 1–8 (slot 0–7); amber = enemy-sighting auto style */
export function markerFlag(slot: number, amber = false): Sprite {
  return sprite(`marker|${slot}|${amber ? 'a' : 't'}`, 40, 64, 20, 56, (ctx) => {
    contactShadow(ctx, 9, 4.5, 0.3, 0, 0);
    // thin post
    ctx.strokeStyle = '#C8D0D4';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -34); ctx.stroke();
    // small iso-diamond flag at the top
    const c = amber ? UI.amber : PLAYER.primary;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(0, -52); ctx.lineTo(11, -43); ctx.lineTo(0, -34); ctx.lineTo(-11, -43);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = alpha('#FFFFFF', 0.7);
    ctx.lineWidth = 1;
    ctx.stroke();
    // numeral disc
    ctx.fillStyle = alpha('#0D141A', 0.85);
    ctx.beginPath(); ctx.arc(0, -43, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(slot + 1), 0, -42.5);
  });
}

/** thrown for unknown unit art requests in dev */
export const UNIT_SPRITE_KINDS: UnitKind[] = [
  'tank', 'hoverTank', 'explorer', 'fighter', 'assaultCraft', 'cruiser',
  'warship', 'fusionCruiser', 'enemyTank', 'enemyFighter', 'enemyAssault',
];
