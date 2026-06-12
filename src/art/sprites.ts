// Sprite factory + cache. Every asset is a Canvas2D draw function rasterised
// once onto an offscreen canvas at 2x (retina master) and blitted scaled.

import type { Ctx } from './iso';

export const SS = 2; // supersample factor (retina master)

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** anchor (sprite-local logical px) — the point placed on the tile centre */
  ax: number;
  ay: number;
  /** logical size */
  w: number;
  h: number;
}

const cache = new Map<string, Sprite>();

/** get-or-create a cached sprite. draw() runs once with origin at the anchor. */
export function sprite(key: string, w: number, h: number, ax: number, ay: number, draw: (ctx: Ctx) => void): Sprite {
  let s = cache.get(key);
  if (!s) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * SS);
    canvas.height = Math.ceil(h * SS);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(SS, SS);
    ctx.translate(ax, ay);
    ctx.lineJoin = 'round';
    draw(ctx);
    s = { canvas, ax, ay, w, h };
    cache.set(key, s);
  }
  return s;
}

/** blit a sprite with its anchor at screen (sx, sy), scaled by zoom */
export function blit(ctx: Ctx, s: Sprite, sx: number, sy: number, zoom: number, a = 1): void {
  if (a !== 1) ctx.globalAlpha = a;
  ctx.drawImage(s.canvas, sx - s.ax * zoom, sy - s.ay * zoom, s.w * zoom, s.h * zoom);
  if (a !== 1) ctx.globalAlpha = 1;
}

export function clearSpriteCache(prefix?: string): void {
  if (!prefix) { cache.clear(); return; }
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}

export function spriteCacheSize(): number { return cache.size; }
