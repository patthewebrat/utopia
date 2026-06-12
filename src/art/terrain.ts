// Terrain tile sprites — per biome × terrain type × 4 seeded variants.
// Each tile renders its diamond as a groundA→groundB gradient plus seeded
// low-contrast splats; feature terrains add faceted rocks / prisms / mounds.

import type { BiomeId, TerrainType } from '../types';
import { BIOME_PALETTES, shade, alpha, mix, UI } from './palette';
import {
  Ctx, P, poly, vGrad, diamondPath, glow, HALF_W, HALF_H,
} from './iso';
import { sprite, Sprite } from './sprites';

export const TILE_SPRITE_W = 96;
export const TILE_SPRITE_H = 150;
export const TILE_AX = 48;
export const TILE_AY = 124; // anchor: tile centre; 26 px of room below for the S corner + AA

/** tiny deterministic PRNG for per-tile variation */
function rnd(seed: number): () => number {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 1103515245 + 12345) | 0;
    return ((s >>> 8) & 0xffff) / 65536;
  };
}

function groundDiamond(ctx: Ctx, pal: { groundA: string; groundB: string; groundDeep: string }, r: () => number, tint = 0): void {
  diamondPath(ctx);
  const a = tint ? shade(pal.groundA, tint) : pal.groundA;
  const b = tint ? shade(pal.groundB, tint) : pal.groundB;
  const mid = mix(a, b, 0.5);
  const dv = (r() - 0.5) * 0.07; // subtle per-tile variation
  ctx.fillStyle = vGrad(ctx, -HALF_H, HALF_H, shade(mix(a, mid, 0.45), 0.02 + dv), shade(mix(b, mid, 0.45), -0.02 + dv));
  ctx.fill();
  // 3–5 low-contrast splats in groundDeep, clipped to the diamond
  ctx.save();
  diamondPath(ctx);
  ctx.clip();
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * 52;
    const y = (r() - 0.5) * 24;
    const rad = 3 + r() * 8;
    ctx.fillStyle = alpha(pal.groundDeep, 0.10 + r() * 0.12);
    ctx.beginPath();
    ctx.ellipse(x, y, rad, rad * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // faint lit edge on the two NW edges
  ctx.strokeStyle = alpha('#FFFFFF', 0.025);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-HALF_W, 0); ctx.lineTo(0, -HALF_H); ctx.lineTo(HALF_W, 0);
  ctx.stroke();
  ctx.restore();
}

/** 2–3 stacked faceted polygons (rock / lava-rock / crystal base) */
function facetedRock(ctx: Ctx, r: () => number, base: string, hMax: number, rim: string): void {
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const cx = (r() - 0.5) * 26;
    const cy = (r() - 0.5) * 12;
    const w = 12 + r() * 14 - i * 3;
    const h = hMax * (0.55 + r() * 0.45) * (1 - i * 0.22);
    const skew = (r() - 0.5) * 8;
    // left facet
    poly(ctx, [[cx - w, cy], [cx + skew, cy - h], [cx + skew * 0.3, cy + w * 0.45]],
      vGrad(ctx, cy - h, cy + w * 0.45, shade(base, 0.18), shade(base, -0.2)));
    // right facet
    poly(ctx, [[cx + skew, cy - h], [cx + w, cy - w * 0.1], [cx + skew * 0.3, cy + w * 0.45]],
      vGrad(ctx, cy - h, cy + w * 0.45, shade(base, -0.12), shade(base, -0.45)));
    ctx.strokeStyle = alpha(rim, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - w, cy); ctx.lineTo(cx + skew, cy - h); ctx.lineTo(cx + w, cy - w * 0.1);
    ctx.stroke();
  }
}

/** tall translucent prism (ice shard / crystal monolith) */
function prism(ctx: Ctx, r: () => number, base: string, accent: string, hMax: number, a: number): void {
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const cx = (r() - 0.5) * 30;
    const cy = (r() - 0.5) * 12;
    const w = 6 + r() * 7;
    const h = hMax * (0.5 + r() * 0.5);
    const tip = (r() - 0.5) * 6;
    ctx.globalAlpha = a;
    poly(ctx, [[cx - w, cy], [cx + tip, cy - h], [cx, cy + w * 0.4]],
      vGrad(ctx, cy - h, cy + w * 0.4, shade(base, 0.3), shade(base, -0.1)));
    poly(ctx, [[cx + tip, cy - h], [cx + w, cy - 2], [cx, cy + w * 0.4]],
      vGrad(ctx, cy - h, cy + w * 0.4, shade(base, -0.05), shade(base, -0.4)));
    // internal refraction band
    ctx.globalAlpha = a * 0.5;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.4, cy - h * 0.25);
    ctx.lineTo(cx + tip * 0.6, cy - h * 0.7);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawTerrainSprite(ctx: Ctx, biome: BiomeId, t: TerrainType, seed: number): void {
  const pal = BIOME_PALETTES[biome];
  const r = rnd(seed * 7919 + biome.length * 131 + t.length);
  switch (t) {
    case 'plain':
      groundDiamond(ctx, pal, r);
      break;
    case 'dune': {
      groundDiamond(ctx, pal, r, 0.10);
      // wind-ripple crescents
      ctx.save(); diamondPath(ctx); ctx.clip();
      for (let i = 0; i < 3; i++) {
        const y = -8 + i * 7 + r() * 3;
        ctx.strokeStyle = alpha(pal.groundDeep, 0.25);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse((r() - 0.5) * 20, y, 16 + r() * 8, 4, 0, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'rock':
      groundDiamond(ctx, pal, r, -0.06);
      facetedRock(ctx, r, pal.feature1, 34, pal.ambient);
      break;
    case 'lava': {
      groundDiamond(ctx, pal, r, -0.10);
      facetedRock(ctx, r, pal.feature1, 26, pal.ambient);
      // emissive lava veins
      ctx.save(); diamondPath(ctx); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const x0 = (r() - 0.5) * 50, y0 = (r() - 0.5) * 22;
        ctx.strokeStyle = alpha(pal.feature2, 0.85);
        ctx.lineWidth = 1.6 + r();
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(x0 + (r() - 0.5) * 20, y0 + (r() - 0.5) * 10, x0 + (r() - 0.5) * 40, y0 + (r() - 0.5) * 16);
        ctx.stroke();
      }
      ctx.restore();
      glow(ctx, 0, 0, 26, pal.feature2, 0.18);
      break;
    }
    case 'moss': {
      groundDiamond(ctx, pal, r, 0.05);
      // soft rounded mounds + accent bloom dots
      ctx.save(); diamondPath(ctx); ctx.clip();
      const n = 4 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const x = (r() - 0.5) * 48, y = (r() - 0.5) * 22;
        const rad = 5 + r() * 9;
        const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 0, x, y, rad);
        g.addColorStop(0, shade(pal.feature1, 0.22));
        g.addColorStop(1, shade(pal.feature1, -0.18));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, rad, rad * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      for (let i = 0; i < 3; i++) {
        if (r() < 0.6) {
          ctx.fillStyle = alpha(pal.accent, 0.85);
          ctx.beginPath();
          ctx.arc((r() - 0.5) * 40, (r() - 0.5) * 18, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'ice':
      groundDiamond(ctx, pal, r, 0.16);
      prism(ctx, r, biome === 'ice' || biome === 'tundra' ? pal.feature1 : '#E9F4FF', pal.accent, 44, 0.85);
      break;
    case 'crystal':
      groundDiamond(ctx, pal, r, -0.04);
      prism(ctx, r, pal.feature1, pal.accent, 58, 0.88);
      prism(ctx, r, pal.feature2, pal.accent, 34, 0.85);
      break;
    case 'water': {
      diamondPath(ctx);
      const deep = mix(pal.groundDeep, '#103048', 0.55);
      ctx.fillStyle = vGrad(ctx, -HALF_H, HALF_H, shade(deep, 0.15), shade(deep, -0.25));
      ctx.fill();
      ctx.save(); diamondPath(ctx); ctx.clip();
      // static glints (animated specular sweep added by the renderer)
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = alpha('#CFEFFF', 0.18 + r() * 0.15);
        ctx.beginPath();
        ctx.ellipse((r() - 0.5) * 44, (r() - 0.5) * 20, 5 + r() * 6, 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // darker shore line
      diamondPath(ctx);
      ctx.strokeStyle = alpha(pal.groundDeep, 0.5);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    case 'oil': {
      diamondPath(ctx);
      ctx.fillStyle = vGrad(ctx, -HALF_H, HALF_H, '#16141A', '#060508');
      ctx.fill();
      ctx.save(); diamondPath(ctx); ctx.clip();
      // iridescent swirls
      for (let i = 0; i < 3; i++) {
        const x = (r() - 0.5) * 40, y = (r() - 0.5) * 18;
        ctx.strokeStyle = alpha(i % 2 ? '#7B68A8' : '#4E7A5C', 0.22);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(x, y, 8 + r() * 10, 2.5 + r() * 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      diamondPath(ctx);
      ctx.strokeStyle = alpha(pal.groundDeep, 0.6);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
  }
}

export function tileSprite(biome: BiomeId, t: TerrainType, variant: number): Sprite {
  const v = variant & 3;
  return sprite(`tile|${biome}|${t}|${v}`, TILE_SPRITE_W, TILE_SPRITE_H, TILE_AX, TILE_AY,
    (ctx) => drawTerrainSprite(ctx, biome, t, v + 1));
}

// ---------------------------------------------------------------- deposit glyphs

export function depositGlyph(kind: 'ore' | 'fuel'): Sprite {
  return sprite(`dep|${kind}`, 40, 28, 20, 14, (ctx) => {
    ctx.save();
    ctx.scale(1, 0.5); // flatten onto the tile
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 2.4;
    if (kind === 'ore') {
      // amber hex-nut
      ctx.strokeStyle = '#0B0906';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = Math.cos(a) * 12, y = Math.sin(a) * 12;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = UI.amber;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // amber-deep droplet in a circle
      ctx.strokeStyle = '#0B0906';
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = UI.amberDeep;
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = UI.amberDeep;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.bezierCurveTo(5, 0, 5, 5, 0, 6);
      ctx.bezierCurveTo(-5, 5, -5, 0, 0, -7);
      ctx.fill();
    }
    ctx.restore();
  });
}

// ---------------------------------------------------------------- colony slab skirt

/**
 * Chamfered cliff faces along the S + E map edges over the void, with strata
 * lines and an atmosphere glow where slab meets void. Drawn immediate-mode
 * (cheap: two polygons + a few strokes), in WORLD coordinates at zoom 1 —
 * caller sets the camera transform.
 */
export function drawSlabSkirt(ctx: Ctx, mapW: number, mapH: number, biome: BiomeId): void {
  const pal = BIOME_PALETTES[biome];
  const H = 150; // cliff height px
  // world coords of map corners (tile centres at the outer ring, expanded half a tile)
  const w = (x: number, y: number): [number, number] => [(x - y) * HALF_W, (x + y) * HALF_H];
  const S = w(-0.5, mapH - 0.5);          // west corner of south edge
  const C = w(mapW - 0.5, mapH - 0.5);    // south corner
  const E = w(mapW - 0.5, -0.5);          // north corner of east edge
  const base = pal.groundDeep;
  // SW-facing cliff (south edge)
  poly(ctx, [S, C, [C[0], C[1] + H], [S[0], S[1] + H]],
    vGrad(ctx, S[1], S[1] + H, shade(base, 0.06), shade(base, -0.65)));
  // SE-facing cliff (east edge) — darker
  poly(ctx, [E, C, [C[0], C[1] + H], [E[0], E[1] + H]],
    vGrad(ctx, E[1], E[1] + H, shade(base, -0.18), shade(base, -0.75)));
  // strata lines
  ctx.lineWidth = 1.2;
  for (let i = 1; i <= 4; i++) {
    const dy = (H * i) / 5 + (i % 2) * 4;
    ctx.strokeStyle = alpha(shade(base, i % 2 ? 0.18 : -0.3), 0.5);
    ctx.beginPath();
    ctx.moveTo(S[0], S[1] + dy);
    ctx.lineTo(C[0], C[1] + dy);
    ctx.lineTo(E[0], E[1] + dy);
    ctx.stroke();
  }
  // atmospheric glow line where slab meets void
  ctx.strokeStyle = alpha(pal.ambient, 0.35);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(S[0], S[1] + H);
  ctx.lineTo(C[0], C[1] + H);
  ctx.lineTo(E[0], E[1] + H);
  ctx.stroke();
  ctx.strokeStyle = alpha(pal.ambient, 0.12);
  ctx.lineWidth = 6;
  ctx.stroke();
}
