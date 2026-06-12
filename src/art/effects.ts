// Immediate-mode particle/effects system — ART_DIRECTION §5.
// World-space positions (iso px at zoom 1); the renderer supplies the camera
// transform when drawing. Capped at 600 live particles.

import type { EffectFx } from '../types';
import { PLAYER, ENEMY, UI, alpha } from './palette';
import { Ctx, HALF_W, HALF_H } from './iso';

const MAX_PARTICLES = 600;

interface Particle {
  kind: 'flash' | 'ember' | 'smoke' | 'debris' | 'beam' | 'plasmaBall' | 'missile' | 'scorch' | 'dirt' | 'spark';
  x: number; y: number;          // world px (ground plane)
  z: number;                     // height px
  vx: number; vy: number; vz: number;
  age: number; life: number;
  size: number;
  color: string;
  // beams / missiles
  x2?: number; y2?: number;
  enemy?: boolean;
}

export function tileToWorld(tx: number, ty: number): [number, number] {
  return [(tx - ty) * HALF_W, (tx + ty) * HALF_H];
}

export class Effects {
  private parts: Particle[] = [];
  private rngState = 12345;

  private rnd(): number {
    this.rngState = (this.rngState * 1103515245 + 12345) & 0x7fffffff;
    return this.rngState / 0x7fffffff;
  }

  private push(p: Particle): void {
    if (this.parts.length >= MAX_PARTICLES) this.parts.shift();
    this.parts.push(p);
  }

  get liveCount(): number { return this.parts.length; }

  /** ingest one engine EffectFx (tile coords) */
  spawn(fx: EffectFx): void {
    switch (fx.fx) {
      case 'shot': {
        const [x0, y0] = tileToWorld(fx.fromX, fx.fromY);
        const [x1, y1] = tileToWorld(fx.toX, fx.toY);
        if (fx.beam === 'plasma') {
          const d = Math.hypot(x1 - x0, y1 - y0) || 1;
          this.push({
            kind: 'plasmaBall', x: x0, y: y0 - 14, z: 0,
            vx: ((x1 - x0) / d) * 420, vy: ((y1 - y0) / d) * 420, vz: 0,
            age: 0, life: d / 420, size: 6,
            color: fx.by === 'enemy' ? ENEMY.glow : PLAYER.glow, enemy: fx.by === 'enemy',
          });
        } else {
          this.push({
            kind: 'beam', x: x0, y: y0 - 14, z: 0, x2: x1, y2: y1 - 8,
            vx: 0, vy: 0, vz: 0, age: 0, life: 0.08, size: fx.beam === 'cannon' ? 1.6 : 2,
            color: fx.by === 'enemy' ? ENEMY.glow : UI.cyan, enemy: fx.by === 'enemy',
          });
        }
        break;
      }
      case 'missile': {
        const [x0, y0] = tileToWorld(fx.fromX, fx.fromY);
        const [x1, y1] = tileToWorld(fx.toX, fx.toY);
        this.push({
          kind: 'missile', x: x0, y: y0, z: 10, x2: x1, y2: y1,
          vx: 0, vy: 0, vz: 0, age: 0, life: 0.9, size: 4, color: '#FFFFFF',
        });
        break;
      }
      case 'explosion': {
        const [x, y] = tileToWorld(fx.x, fx.y);
        this.explosion(x, y, fx.big);
        break;
      }
      case 'mine': {
        const [x, y] = tileToWorld(fx.x, fx.y);
        // sharp white flash + dirt fountain
        this.push({ kind: 'flash', x, y, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 0.1, size: 26, color: '#FFFFFF' });
        for (let i = 0; i < 14; i++) {
          const a = this.rnd() * Math.PI * 2;
          this.push({
            kind: 'dirt', x, y, z: 0,
            vx: Math.cos(a) * (20 + this.rnd() * 40), vy: Math.sin(a) * (10 + this.rnd() * 20),
            vz: 90 + this.rnd() * 120, age: 0, life: 0.7 + this.rnd() * 0.4,
            size: 1.6 + this.rnd() * 1.6, color: '#5C4A36',
          });
        }
        break;
      }
    }
  }

  /** staged procedural explosion (world px) */
  explosion(x: number, y: number, big: boolean): void {
    const s = big ? 1.7 : 1;
    // stage 1: white flash
    this.push({ kind: 'flash', x, y, z: 6, vx: 0, vy: 0, vz: 0, age: 0, life: 0.1, size: 22 * s, color: '#FFFFFF' });
    // stage 2: embers
    const embers = Math.floor((12 + this.rnd() * 12) * s);
    for (let i = 0; i < embers; i++) {
      const a = this.rnd() * Math.PI * 2;
      const sp = 30 + this.rnd() * 90;
      this.push({
        kind: 'ember', x, y, z: 6,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, vz: 60 + this.rnd() * 130 * s,
        age: 0, life: 0.45 + this.rnd() * 0.25, size: 1.5 + this.rnd() * 2, color: UI.amber,
      });
    }
    // stage 3: smoke puffs
    const puffs = Math.floor(4 + this.rnd() * 4 * s);
    for (let i = 0; i < puffs; i++) {
      this.push({
        kind: 'smoke', x: x + (this.rnd() - 0.5) * 18 * s, y: y + (this.rnd() - 0.5) * 9 * s, z: 8,
        vx: (this.rnd() - 0.5) * 8, vy: (this.rnd() - 0.5) * 4, vz: 14 + this.rnd() * 12,
        age: -0.2 - this.rnd() * 0.3, life: 1.1 + this.rnd() * 0.4, size: (7 + this.rnd() * 7) * s, color: '#888888',
      });
    }
    if (big) {
      // building death: tumbling debris chunks + scorch decal
      for (let i = 0; i < 6; i++) {
        const a = this.rnd() * Math.PI * 2;
        this.push({
          kind: 'debris', x, y, z: 12,
          vx: Math.cos(a) * (30 + this.rnd() * 50), vy: Math.sin(a) * (15 + this.rnd() * 25),
          vz: 80 + this.rnd() * 140, age: 0, life: 1.2 + this.rnd() * 0.5,
          size: 2.5 + this.rnd() * 3, color: '#2E2A26',
        });
      }
      this.push({ kind: 'scorch', x, y, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 60, size: 26, color: '#000000' });
    }
  }

  /** small dust puff (scaffold work etc.) */
  dust(x: number, y: number): void {
    this.push({
      kind: 'smoke', x, y, z: 2,
      vx: (this.rnd() - 0.5) * 10, vy: (this.rnd() - 0.5) * 5, vz: 6 + this.rnd() * 6,
      age: 0, life: 0.8, size: 4 + this.rnd() * 3, color: '#9A9286',
    });
  }

  /** wreckage smoke wisp */
  wisp(x: number, y: number): void {
    this.push({
      kind: 'smoke', x: x + (this.rnd() - 0.5) * 14, y: y + (this.rnd() - 0.5) * 7, z: 10,
      vx: (this.rnd() - 0.5) * 6, vy: -2, vz: 10 + this.rnd() * 8,
      age: 0, life: 1.6, size: 4 + this.rnd() * 4, color: '#777777',
    });
  }

  update(dt: number): void {
    const G = 260; // px/s²
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.age += dt;
      if (p.age < 0) continue;
      if (p.age >= p.life) { this.parts.splice(i, 1); continue; }
      switch (p.kind) {
        case 'ember':
        case 'debris':
        case 'dirt':
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.vz -= G * dt;
          if (p.z < 0 && p.kind === 'debris') { p.z = 0; p.vz = -p.vz * 0.35; p.vx *= 0.6; p.vy *= 0.6; } // bounce
          else if (p.z < 0) p.z = 0;
          break;
        case 'smoke':
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.size += dt * 6;
          break;
        case 'plasmaBall':
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          break;
        case 'missile': {
          // emit smoke trail at the current arc position (~12 puffs over the flight)
          const t = p.age / p.life;
          if (Math.floor(p.age * 14) !== Math.floor((p.age - dt) * 14)) {
            const mx = p.x + (p.x2! - p.x) * t;
            const my = p.y + (p.y2! - p.y) * t;
            const mz = Math.sin(t * Math.PI) * 90 + 8;
            this.push({
              kind: 'smoke', x: mx, y: my, z: mz, vx: 0, vy: 0, vz: 4,
              age: 0, life: 0.6, size: 2.5, color: '#AAAAAA',
            });
          }
          break;
        }
        default:
          break;
      }
    }
  }

  /** draw all particles; ctx is in world space (camera transform applied) */
  draw(ctx: Ctx, zoom: number): void {
    for (const p of this.parts) {
      if (p.age < 0) continue;
      const t = p.age / p.life;
      const sx = p.x, sy = p.y - p.z;
      switch (p.kind) {
        case 'flash': {
          ctx.globalCompositeOperation = 'lighter';
          const r = p.size * (0.6 + t * 0.8);
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
          g.addColorStop(0, `rgba(255,255,255,${0.95 * (1 - t)})`);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'ember': {
          ctx.globalCompositeOperation = 'lighter';
          const c = t < 0.4 ? UI.amber : t < 0.75 ? '#FF5A1F' : '#5A2A18';
          ctx.fillStyle = alpha(c === '#5A2A18' ? '#5A2A18' : c, 1 - t * 0.7);
          ctx.beginPath(); ctx.arc(sx, sy, p.size * (1 - t * 0.5), 0, Math.PI * 2); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'smoke': {
          ctx.fillStyle = alpha(p.color, 0.30 * (1 - t));
          ctx.beginPath(); ctx.arc(sx, sy, p.size, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'debris': {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(p.age * 7);
          ctx.fillStyle = alpha(p.color, 1 - t * 0.5);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
          ctx.restore();
          break;
        }
        case 'dirt': {
          ctx.fillStyle = alpha(p.color, 1 - t);
          ctx.beginPath(); ctx.arc(sx, sy, p.size, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'beam': {
          ctx.globalCompositeOperation = 'lighter';
          const a = 1 - t;
          // outer glow
          ctx.strokeStyle = alpha(p.color, 0.4 * a);
          ctx.lineWidth = p.size * 3;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x2!, p.y2!); ctx.stroke();
          // white core (enemy bolts get a jagged flicker)
          ctx.strokeStyle = alpha('#FFFFFF', 0.95 * a);
          ctx.lineWidth = p.size * 0.8;
          ctx.beginPath();
          if (p.enemy) {
            const mx = (p.x + p.x2!) / 2 + (Math.sin(p.age * 200) * 3);
            const my = (p.y + p.y2!) / 2 + (Math.cos(p.age * 170) * 3);
            ctx.moveTo(p.x, p.y); ctx.lineTo(mx, my); ctx.lineTo(p.x2!, p.y2!);
          } else {
            ctx.moveTo(p.x, p.y); ctx.lineTo(p.x2!, p.y2!);
          }
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'plasmaBall': {
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.size * 2);
          g.addColorStop(0, alpha('#FFFFFF', 0.9));
          g.addColorStop(0.4, alpha(p.color, 0.8));
          g.addColorStop(1, alpha(p.color, 0));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(sx, sy, p.size * 2, 0, Math.PI * 2); ctx.fill();
          // trailing glow
          ctx.strokeStyle = alpha(p.color, 0.4);
          ctx.lineWidth = p.size;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(sx - p.vx * 0.05, sy - p.vy * 0.05);
          ctx.lineTo(sx, sy);
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'missile': {
          // parabolic arc from (x,y) to (x2,y2)
          const mx = p.x + (p.x2! - p.x) * t;
          const my = p.y + (p.y2! - p.y) * t;
          const mz = Math.sin(t * Math.PI) * 90 + 8;
          ctx.save();
          ctx.translate(mx, my - mz);
          const ang = Math.atan2((p.y2! - p.y) - Math.cos(t * Math.PI) * 140, p.x2! - p.x);
          ctx.rotate(ang);
          ctx.fillStyle = '#E8F4F2';
          ctx.fillRect(-5, -1.6, 10, 3.2);
          ctx.fillStyle = '#141014';
          ctx.fillRect(3.4, -1.6, 2.4, 3.2);
          ctx.restore();
          // flame dot
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = alpha(UI.amber, 0.9);
          ctx.beginPath(); ctx.arc(mx - Math.cos(ang2(p, t)) * 6, my - mz, 2, 0, Math.PI * 2); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'scorch': {
          const a = 0.45 * (1 - t);
          ctx.fillStyle = `rgba(8,6,4,${a})`;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.scale(1, 0.5);
          ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          break;
        }
        case 'spark': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = alpha(p.color, 1 - t);
          ctx.beginPath(); ctx.arc(sx, sy, p.size, 0, Math.PI * 2); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
      }
    }
    void zoom;
  }
}

function ang2(p: { x: number; y: number; x2?: number; y2?: number }, t: number): number {
  return Math.atan2((p.y2! - p.y) - Math.cos(t * Math.PI) * 140, p.x2! - p.x);
}

// ---------------------------------------------------------------- bacteria cloud

/** drifting green bacteria cloud — drawn immediate at world (x,y) */
export function drawBacteriaCloud(ctx: Ctx, x: number, y: number, t: number, seed: number): void {
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed;
    const wob = Math.sin(t * 0.8 + i * 1.7) * 5;
    const px = x + Math.cos(a) * (14 + wob);
    const py = y + Math.sin(a) * (7 + wob * 0.5) - 6;
    const r = 9 + Math.sin(t * 0.6 + i * 2.3) * 3;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, alpha('#7CE85C', 0.30));
    g.addColorStop(1, alpha('#7CE85C', 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  }
  // rising spore dots
  for (let i = 0; i < 3; i++) {
    const p = ((t * 0.3 + i / 3 + seed) % 1);
    ctx.fillStyle = alpha('#A8F088', 0.5 * (1 - p));
    ctx.beginPath(); ctx.arc(x + Math.sin(i * 9 + seed) * 10, y - 6 - p * 26, 1.3, 0, Math.PI * 2); ctx.fill();
  }
}
