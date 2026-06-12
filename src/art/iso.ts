// Isometric drawing primitives shared by all sprite factories.
// Sprite-local coordinate space: origin = centre of the tile diamond at ground
// level; +x right, +y down (screen), heights are *subtracted* from y.
// 2:1 projection, logical tile 64×32 (half-width 32, half-height 16).

import { shade, alpha } from './palette';

export const TILE_W = 64;
export const TILE_H = 32;
export const HALF_W = 32;
export const HALF_H = 16;

export type Ctx = CanvasRenderingContext2D;

/** project footprint coords (u along map-x, v along map-y, in tiles, tile-centre
 *  origin) + height z (px) to sprite-local px */
export function P(u: number, v: number, z = 0): [number, number] {
  return [(u - v) * HALF_W, (u + v) * HALF_H - z];
}

export function poly(ctx: Ctx, pts: [number, number][], fill: string | CanvasGradient, stroke?: string, lw = 1): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

export function vGrad(ctx: Ctx, y0: number, y1: number, c0: string, c1: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}

/** the ground tile diamond outline */
export function diamondPath(ctx: Ctx, s = 1): void {
  ctx.beginPath();
  ctx.moveTo(0, -HALF_H * s);
  ctx.lineTo(HALF_W * s, 0);
  ctx.lineTo(0, HALF_H * s);
  ctx.lineTo(-HALF_W * s, 0);
  ctx.closePath();
}

/** soft elliptical contact shadow on the ground */
export function contactShadow(ctx: Ctx, rx: number, ry: number, a = 0.35, cx = 0, cy = 0): void {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, `rgba(0,0,0,${a})`);
  g.addColorStop(0.7, `rgba(0,0,0,${a * 0.5})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  ctx.translate(-cx, -cy);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export interface BoxOpts {
  /** rim-light tint applied to the lit (NW) top edges */
  rim?: string;
  /** override face colours */
  top?: string; left?: string; right?: string;
  /** skip a face */
  noTop?: boolean;
}

/**
 * Iso box (prism) over footprint rect u0..u1 × v0..v1 (tiles, tile-centre origin),
 * from height z0 to z1 (px). Light fixed NW: top brightest, SW (left) face mid,
 * SE (right) face dark. Faces get 2-stop vertical gradients.
 */
export function box(ctx: Ctx, u0: number, v0: number, u1: number, v1: number, z0: number, z1: number, base: string, opts: BoxOpts = {}): void {
  const tA = P(u0, v0, z1), tB = P(u1, v0, z1), tC = P(u1, v1, z1), tD = P(u0, v1, z1);
  const bC = P(u1, v1, z0), bD = P(u0, v1, z0), bB = P(u1, v0, z0);
  // left (SW) face: D–C top edge down
  const lc = opts.left ?? shade(base, -0.18);
  poly(ctx, [tD, tC, bC, bD], vGrad(ctx, tD[1], bD[1], shade(lc, 0.10), shade(lc, -0.16)));
  // right (SE) face: C–B
  const rc = opts.right ?? shade(base, -0.42);
  poly(ctx, [tC, tB, bB, bC], vGrad(ctx, tB[1], bB[1], shade(rc, 0.08), shade(rc, -0.14)));
  if (!opts.noTop) {
    const tc = opts.top ?? shade(base, 0.22);
    poly(ctx, [tA, tB, tC, tD], vGrad(ctx, tA[1], tC[1], shade(tc, 0.10), shade(tc, -0.06)));
    // rim light on the two NW-facing top edges (A–B and A–D)
    const rim = opts.rim ?? 'rgba(255,255,255,0.55)';
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(tD[0], tD[1]);
    ctx.lineTo(tA[0], tA[1]);
    ctx.lineTo(tB[0], tB[1]);
    ctx.stroke();
  }
}

/** vertical cylinder: centre (u,v), radius r px (screen rx; ry = rx/2), from z0 to z1 */
export function cylinder(ctx: Ctx, u: number, v: number, r: number, z0: number, z1: number, base: string, opts: { top?: string; rim?: string } = {}): void {
  const [cx, cyTop] = P(u, v, z1);
  const cyBot = P(u, v, z0)[1];
  const ry = r * 0.5;
  // body
  const g = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  g.addColorStop(0, shade(base, 0.12));
  g.addColorStop(0.45, shade(base, -0.05));
  g.addColorStop(1, shade(base, -0.45));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - r, cyTop);
  ctx.lineTo(cx - r, cyBot);
  ctx.ellipse(cx, cyBot, r, ry, 0, Math.PI, 0, true);
  ctx.lineTo(cx + r, cyTop);
  ctx.closePath();
  ctx.fill();
  // top
  ctx.fillStyle = opts.top ?? shade(base, 0.25);
  ctx.beginPath();
  ctx.ellipse(cx, cyTop, r, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = opts.rim ?? 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cyTop, r, ry, 0, Math.PI * 0.95, Math.PI * 1.9);
  ctx.stroke();
}

/** dome (half-sphere) sitting at height z, radius r px */
export function dome(ctx: Ctx, u: number, v: number, r: number, z: number, base: string): void {
  const [cx, cy] = P(u, v, z);
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.5, r * 0.1, cx, cy - r * 0.1, r * 1.1);
  g.addColorStop(0, shade(base, 0.4));
  g.addColorStop(0.6, base);
  g.addColorStop(1, shade(base, -0.35));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.78, 0, Math.PI, Math.PI * 2);
  ctx.ellipse(cx, cy, r, r * 0.5 * 0.5, 0, 0, Math.PI);
  ctx.fill();
}

/** additive glow disc */
export function glow(ctx: Ctx, x: number, y: number, r: number, color: string, a: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, alpha(color, a));
  g.addColorStop(1, alpha(color, 0));
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = prev;
}

/** small blinking light dot (draw when its phase is on) */
export function lightDot(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  glow(ctx, x, y, r * 3.2, color, 0.5);
}

/** deterministic per-instance hash for animation phase offsets */
export function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h >>> 0) / 4294967296;
}
