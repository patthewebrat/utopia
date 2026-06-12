// Procedural building art — every structure from docs/ART_DIRECTION.md §4.
// Static bodies are rasterised once (sprites.ts cache); animated touches
// (fans, dishes, blinking lights, turret barrels, pulses) are drawn
// immediate-mode by drawBuildingOverlay() in sprite-local logical px —
// the renderer pre-translates/scales the context.

import type { BuildingType } from '../types';
import { PLAYER, UI, shade, alpha, mix } from './palette';
import {
  Ctx, P, poly, vGrad, box, cylinder, dome, glow, lightDot, contactShadow,
  diamondPath, HALF_H, HALF_W,
} from './iso';
import { sprite, Sprite } from './sprites';

export const B_W = 132;
export const B_H = 200;
export const B_AX = 66;
export const B_AY = 170;

const WHITE = PLAYER.secondary;
const TEAL = PLAYER.primary;
const GLOWC = PLAYER.glow;
const SLATE = '#2A3238';
const GUN = '#3A434A';

// face-aligned window helpers
function winSE(ctx: Ctx, u: number, v: number, z: number, dv: number, dz: number, color: string): void {
  poly(ctx, [P(u, v, z + dz), P(u, v + dv, z + dz), P(u, v + dv, z), P(u, v, z)], color);
}
function winSW(ctx: Ctx, u: number, v: number, z: number, du: number, dz: number, color: string): void {
  poly(ctx, [P(u, v, z + dz), P(u + du, v, z + dz), P(u + du, v, z), P(u, v, z)], color);
}

function plinth(ctx: Ctx): void {
  contactShadow(ctx, 40, 20, 0.32, 0, 2);
  box(ctx, -0.48, -0.48, 0.48, 0.48, 0, 4, SLATE, { rim: 'rgba(255,255,255,0.18)' });
}

/** thin strut between two projected points */
function strut(ctx: Ctx, a: [number, number], b: [number, number], w: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

// ---------------------------------------------------------------- bodies

type BodyFn = (ctx: Ctx, flag?: boolean) => void;

const bodies: Record<string, BodyFn> = {

  livingQuarters(ctx) {
    plinth(ctx);
    const blocks: [number, number, number][] = [[-0.44, -0.16, 26], [-0.13, 0.15, 42], [0.18, 0.46, 58]];
    for (const [u0, u1, h] of blocks) {
      box(ctx, u0, -0.32, u1, 0.32, 4, h, WHITE);
      // warm amber window grids on both visible faces
      for (let r = 0; r < Math.floor((h - 10) / 12); r++) {
        for (let c = 0; c < 3; c++) {
          winSW(ctx, u0 + 0.05 + c * 0.09, 0.32, 10 + r * 12, 0.05, 6, alpha(UI.amber, 0.92));
          winSE(ctx, u1, -0.28 + c * 0.2, 10 + r * 12, 0.09, 6, alpha(shade(UI.amber, -0.25), 0.9));
        }
      }
    }
    // teal skybridge between blocks 2–3
    box(ctx, -0.16, -0.07, 0.22, 0.07, 30, 40, TEAL, { rim: alpha(GLOWC, 0.8) });
    // rooftop antenna mast (light blinks in overlay)
    strut(ctx, P(0.32, 0, 58), P(0.32, 0, 76), 1.6, shade(WHITE, -0.2));
  },

  hydroponics(ctx, morgro = false) {
    plinth(ctx);
    const gA = morgro ? '#9FE86A' : '#37E0F2';
    box(ctx, -0.46, -0.34, 0.46, 0.34, 4, 9, WHITE);
    // glowing crop strips on the floor (slab top), seen through the glass
    for (let i = 0; i < 4; i++) {
      const v = -0.24 + i * 0.16;
      strut(ctx, P(-0.4, v, 10), P(0.4, v, 10), 3, alpha(UI.ok, 0.9));
    }
    // translucent barrel vault along u
    const vault = (h: number, vHalf: number, a: number) => {
      ctx.globalAlpha = a;
      ctx.beginPath();
      const fb0 = P(-0.42, vHalf, 9), fb1 = P(0.42, vHalf, 9);
      const r0 = P(-0.42, 0, h), r1 = P(0.42, 0, h);
      const bb0 = P(-0.42, -vHalf, 9), bb1 = P(0.42, -vHalf, 9);
      ctx.moveTo(fb0[0], fb0[1]);
      ctx.lineTo(fb1[0], fb1[1]);
      ctx.quadraticCurveTo(P(0.46, vHalf * 0.6, h * 0.92)[0], P(0.46, vHalf * 0.6, h * 0.92)[1], r1[0], r1[1]);
      ctx.lineTo(bb1[0], bb1[1]);
      ctx.lineTo(bb0[0], bb0[1]);
      ctx.quadraticCurveTo(P(-0.38, -vHalf * 0.6, h * 0.96)[0], P(-0.38, -vHalf * 0.6, h * 0.96)[1], r0[0], r0[1]);
      ctx.quadraticCurveTo(P(-0.46, vHalf * 0.6, h * 0.92)[0], P(-0.46, vHalf * 0.6, h * 0.92)[1], fb0[0], fb0[1]);
      const g = vGrad(ctx, r0[1], fb0[1], shade(gA, 0.3), shade(gA, -0.3));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = alpha('#FFFFFF', 0.5);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    vault(34, 0.32, 0.55);
    if (morgro) vault(50, 0.20, 0.5); // stacked half-height vault
    // white end caps
    const cap = (u: number, h: number, vHalf: number) => {
      ctx.beginPath();
      const b0 = P(u, vHalf, 9), b1 = P(u, -vHalf, 9), top = P(u, 0, h);
      ctx.moveTo(b0[0], b0[1]);
      ctx.quadraticCurveTo(b0[0] + 2, top[1], top[0], top[1]);
      ctx.quadraticCurveTo(b1[0] - 2, top[1], b1[0], b1[1]);
      ctx.closePath();
      ctx.fillStyle = vGrad(ctx, top[1], b0[1], shade(WHITE, 0.05), shade(WHITE, -0.3));
      ctx.fill();
    };
    cap(0.42, 34, 0.32);
    if (morgro) cap(0.42, 50, 0.20);
    // small water tank / algae cylinder at the west end
    cylinder(ctx, -0.36, 0.26, 6, 9, 26, morgro ? '#6FCF6A' : WHITE);
  },

  morgroHydroponics(ctx) { (bodies.hydroponics as (c: Ctx, m?: boolean) => void)(ctx, true); },

  lifeSupport(ctx) {
    plinth(ctx);
    cylinder(ctx, 0, 0, 24, 4, 38, WHITE);
    // six intake louvres around the drum base
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI * 0.05 + (Math.PI * 1.1 * i) / 5;
      const x = Math.cos(a) * 22, y = 19 + Math.sin(a) * 4;
      ctx.fillStyle = alpha('#10161A', 0.7);
      ctx.fillRect(x - 2.4, y - 16, 4.8, 9);
    }
    // two cyan O2 gauge strips
    strut(ctx, [-13, 16], [-13, -22], 2.4, alpha(UI.cyan, 0.9));
    strut(ctx, [9, 19], [9, -19], 2.4, alpha(UI.cyan, 0.65));
    // turbine housing ring (blades animated in overlay)
    cylinder(ctx, 0, 0, 15, 38, 43, shade(WHITE, -0.15), { top: '#16202A' });
  },

  spaceMossConverter(ctx) {
    contactShadow(ctx, 34, 17, 0.22, 0, 2);
    // open tripod frame straddling the moss — terrain stays visible
    const top = P(0, 0, 48);
    const feet: [number, number][] = [P(-0.38, 0.28, 0), P(0.42, 0.18, 0), P(-0.05, -0.4, 0)];
    for (const f of feet) {
      strut(ctx, f, top, 4, shade(TEAL, -0.25));
      strut(ctx, f, top, 1.5, shade(TEAL, 0.25));
    }
    // three drill-syphon tubes (glow pulses in overlay)
    for (const f of feet) {
      const mid: [number, number] = [(f[0] + top[0]) / 2, (f[1] + top[1]) / 2];
      strut(ctx, [f[0] * 0.5, f[1] * 0.5], mid, 2.5, alpha(UI.ok, 0.55));
    }
    // collector sphere
    dome(ctx, 0, 0, 11, 56, mix(TEAL, '#FFFFFF', 0.2));
    glow(ctx, top[0], top[1] - 6, 16, UI.ok, 0.3);
  },

  powerStation(ctx) {
    plinth(ctx);
    box(ctx, -0.44, -0.38, 0.44, 0.38, 4, 42, '#3D464E');
    // glowing amber reactor window on the SW face (flicker in overlay)
    winSW(ctx, -0.16, 0.38, 12, 0.32, 18, alpha(UI.amber, 0.95));
    winSW(ctx, -0.16, 0.38, 12, 0.32, 4, alpha('#FFE2B0', 0.9));
    // two slim cooling stacks
    cylinder(ctx, -0.18, -0.14, 7, 42, 78, '#4A555E');
    cylinder(ctx, 0.10, -0.22, 7, 42, 70, '#4A555E');
    ctx.fillStyle = '#1A2126';
    for (const [u, v, h] of [[-0.18, -0.14, 78], [0.10, -0.22, 70]] as const) {
      const [x, y] = P(u, v, h);
      ctx.beginPath(); ctx.ellipse(x, y, 5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    }
  },

  solarPanel(ctx, twin = false) {
    plinth(ctx);
    cylinder(ctx, 0, 0, 3, 4, 30, WHITE);
    const wing = (dx: number, tilt: number) => {
      // photovoltaic wing tilted toward the NW light
      const pts: [number, number][] = [
        [dx - 26, -30 - tilt], [dx + 6, -44 - tilt], [dx + 26, -30 - tilt], [dx - 6, -16 - tilt],
      ];
      poly(ctx, pts, vGrad(ctx, -46 - tilt, -14 - tilt, shade('#2A2E6E', 0.25), shade('#2A2E6E', -0.2)), alpha(UI.cyan, 0.7), 1);
      // cell gridlines
      ctx.strokeStyle = alpha(UI.cyan, 0.35);
      ctx.lineWidth = 0.8;
      for (let i = 1; i < 4; i++) {
        const t = i / 4;
        ctx.beginPath();
        ctx.moveTo(pts[0][0] + (pts[1][0] - pts[0][0]) * t, pts[0][1] + (pts[1][1] - pts[0][1]) * t);
        ctx.lineTo(pts[3][0] + (pts[2][0] - pts[3][0]) * t, pts[3][1] + (pts[2][1] - pts[3][1]) * t);
        ctx.stroke();
      }
    };
    if (twin) {
      wing(-13, 4);
      wing(15, 0);
      // capacitor pod at the mast base
      dome(ctx, 0.18, 0.18, 6, 4, GLOWC);
      glow(ctx, P(0.18, 0.18, 8)[0], P(0.18, 0.18, 8)[1], 9, GLOWC, 0.4);
    } else {
      wing(0, 0);
    }
  },

  solarGenerator(ctx) { (bodies.solarPanel as (c: Ctx, t?: boolean) => void)(ctx, true); },

  fluxPod(ctx) {
    contactShadow(ctx, 30, 15, 0.3, 0, 2);
    // tripod claw base
    const apex = P(0, 0, 16);
    for (const [u, v] of [[-0.3, 0.22], [0.34, 0.14], [-0.02, -0.34]] as const) {
      const f = P(u, v, 0);
      strut(ctx, f, apex, 5, shade(SLATE, 0.1));
      strut(ctx, f, apex, 2, shade(TEAL, -0.1));
    }
    cylinder(ctx, 0, 0, 6, 12, 20, SLATE);
    // levitating orb + rings drawn in overlay (pulse)
  },

  hospital(ctx) {
    plinth(ctx);
    // plus-shaped massing: two crossing white bars
    box(ctx, -0.44, -0.17, 0.44, 0.17, 4, 30, WHITE);
    box(ctx, -0.17, -0.44, 0.17, 0.44, 4, 30, WHITE);
    box(ctx, -0.17, -0.17, 0.17, 0.17, 30, 38, WHITE);
    // cyan double-helix emblem on the roof block
    const [hx, hy] = P(0, 0, 46);
    ctx.strokeStyle = UI.cyan;
    ctx.lineWidth = 1.8;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const x = hx + Math.sin(t * Math.PI * 2 + (s > 0 ? 0 : Math.PI)) * 5;
        const y = hy + 8 - t * 16;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    glow(ctx, hx, hy, 12, UI.cyan, 0.25);
    // calm cyan windows
    for (let c = 0; c < 4; c++) winSE(ctx, 0.44, -0.13 + c * 0.09, 12, 0.05, 10, alpha(UI.cyan, 0.55));
    for (let c = 0; c < 4; c++) winSW(ctx, -0.13 + c * 0.09, 0.44, 12, 0.05, 10, alpha(UI.cyan, 0.65));
  },

  laboratory(ctx) {
    plinth(ctx);
    cylinder(ctx, -0.06, -0.04, 25, 4, 14, WHITE);
    dome(ctx, -0.06, -0.04, 24, 14, shade(WHITE, -0.04));
    // violet glass oculus slice (scан beam animated in overlay)
    const [dx, dy] = P(-0.06, -0.04, 14);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(dx, dy, 24, 18.7, 0, Math.PI, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = alpha(UI.violet, 0.5);
    ctx.beginPath();
    ctx.moveTo(dx, dy + 2);
    ctx.arc(dx, dy + 2, 26, -Math.PI * 0.62, -Math.PI * 0.30);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // side wing with dark windows
    box(ctx, 0.16, 0.16, 0.46, 0.46, 4, 18, WHITE);
    winSW(ctx, 0.2, 0.46, 8, 0.2, 6, '#1A2430');
  },

  mine(ctx) {
    plinth(ctx);
    // dark pit cut into the tile
    ctx.save();
    diamondPath(ctx, 0.62);
    ctx.fillStyle = vGrad(ctx, -10, 10, '#16110C', '#060403');
    ctx.fill();
    ctx.restore();
    // angled gantry headframe (wheel animated in overlay)
    const top = P(0.04, -0.02, 52);
    strut(ctx, P(-0.3, 0.26, 4), top, 4.5, '#5E5648');
    strut(ctx, P(0.34, 0.2, 4), top, 4.5, '#4E4639');
    strut(ctx, P(0.02, -0.34, 4), top, 4.5, '#564E40');
    strut(ctx, P(-0.14, 0.23, 28), P(0.18, 0.2, 28), 2, '#3A332A');
    // cable down into the pit
    strut(ctx, top, P(0.02, 0, 6), 1.2, '#20180F');
    // conveyor arm to a side hopper
    box(ctx, 0.26, 0.26, 0.46, 0.46, 4, 16, '#6E5430');
    strut(ctx, P(0.05, 0, 22), P(0.36, 0.36, 18), 3.5, '#7A7468');
  },

  chemicalPlant(ctx) {
    plinth(ctx);
    // three fat fractionating columns with amber hazard banding
    const cols: [number, number, number][] = [[-0.22, 0.16, 44], [0.1, -0.1, 54], [0.3, 0.24, 38]];
    for (const [u, v, h] of cols) {
      cylinder(ctx, u, v, 9, 4, h, WHITE);
      const [bx, by] = P(u, v, h * 0.55);
      ctx.fillStyle = alpha(UI.amber, 0.9);
      ctx.fillRect(bx - 9, by - 2.5, 18, 5);
    }
    // looping pipes between column tops
    ctx.strokeStyle = shade(WHITE, -0.25);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    const a = P(-0.22, 0.16, 44), b = P(0.1, -0.1, 54), c = P(0.3, 0.24, 38);
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 8, b[0], b[1]);
    ctx.quadraticCurveTo((b[0] + c[0]) / 2, Math.min(b[1], c[1]) - 8, c[0], c[1]);
    ctx.stroke();
    // flare stack (flame in overlay)
    cylinder(ctx, -0.36, -0.3, 3, 4, 62, '#8A949C');
    // glowing sump
    const [sx, sy] = P(-0.32, 0.34, 2);
    ctx.fillStyle = alpha(UI.ok, 0.4);
    ctx.beginPath(); ctx.ellipse(sx, sy, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  },

  armsLab(ctx) {
    plinth(ctx);
    // chamfered blast bunker: wide base + bevel top
    box(ctx, -0.46, -0.4, 0.46, 0.4, 4, 18, GUN);
    box(ctx, -0.36, -0.3, 0.36, 0.3, 18, 26, shade(GUN, 0.08));
    // recessed red-lit entry slot
    winSW(ctx, -0.12, 0.4, 6, 0.24, 7, '#0C0E10');
    winSW(ctx, -0.1, 0.401, 8, 0.2, 2, alpha(UI.warn, 0.85));
    // racked test cylinders on the roof (status chase light in overlay)
    for (let i = 0; i < 4; i++) {
      const u = -0.22 + i * 0.15;
      const a0 = P(u, 0.2, 28), a1 = P(u + 0.12, -0.2, 40);
      strut(ctx, a0, a1, 5, shade(WHITE, -0.35 + i * 0.04));
      strut(ctx, a1, [a1[0] + 1.5, a1[1] - 2.5], 3, '#9AA4AC'); // nose
    }
  },

  workshop(ctx) {
    plinth(ctx);
    box(ctx, -0.44, -0.36, 0.44, 0.36, 4, 24, mix(GUN, TEAL, 0.18));
    // two sawtooth roof teeth (prisms along v) with skylights
    for (const u0 of [-0.44, 0]) {
      const u1 = u0 + 0.44;
      const ridge0 = P(u0, -0.36, 40), ridge1 = P(u0, 0.36, 40);
      const e0 = P(u1, -0.36, 24), e1 = P(u1, 0.36, 24);
      poly(ctx, [ridge0, ridge1, e1, e0], vGrad(ctx, ridge0[1], e1[1], shade(WHITE, -0.05), shade(WHITE, -0.35)));
      poly(ctx, [ridge1, e1, P(u1, 0.36, 24)], shade(GUN, -0.1));
      // vertical glass face of the tooth
      poly(ctx, [ridge0, ridge1, P(u0, 0.36, 24), P(u0, -0.36, 24)], alpha(UI.cyan, 0.30));
    }
    // teal doors on the SE face
    winSE(ctx, 0.44, -0.1, 4, 0.26, 14, TEAL);
    // crate pallet outside
    box(ctx, 0.52, 0.3, 0.66, 0.44, 0, 8, WHITE);
    box(ctx, 0.54, 0.32, 0.62, 0.4, 8, 14, shade(WHITE, -0.1));
  },

  store(ctx) {
    plinth(ctx);
    // 3-2-1 container pyramid with teal end doors
    const cont = (u0: number, v0: number, z: number) => {
      box(ctx, u0, v0, u0 + 0.84, v0 + 0.26, z, z + 14, WHITE);
      winSE(ctx, u0 + 0.84, v0 + 0.03, z + 2, 0.2, 10, TEAL);
      // barcode ID panel
      const [px, py] = P(u0 + 0.5, v0 + 0.26, z + 7);
      ctx.fillStyle = '#222A30';
      ctx.fillRect(px - 6, py - 3, 12, 6);
    };
    cont(-0.42, 0.10, 4);
    cont(-0.42, -0.20, 4);
    cont(-0.42, -0.05, 18);
    cont(-0.42, -0.05 + 0.001, 32 - 0.001);
  },

  fuelTank(ctx, compressed = false) {
    plinth(ctx);
    // cradles
    box(ctx, -0.3, -0.18, -0.18, 0.18, 4, 10, SLATE);
    box(ctx, 0.18, -0.18, 0.3, 0.18, 4, 10, SLATE);
    // fat horizontal cylinder along u — drawn as a capsule in screen space
    const c0 = P(-0.34, 0, 26), c1 = P(0.34, 0, 26);
    const R = 17;
    const g = ctx.createLinearGradient(0, c0[1] - R, 0, c0[1] + R);
    g.addColorStop(0, shade(WHITE, 0.2));
    g.addColorStop(0.55, shade(WHITE, -0.08));
    g.addColorStop(1, shade(WHITE, -0.42));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(c0[0], c0[1], R * 0.55, R, 0, Math.PI / 2, Math.PI * 1.5);
    ctx.lineTo(c1[0], c1[1] - R);
    ctx.ellipse(c1[0], c1[1], R * 0.55, R, 0, Math.PI * 1.5, Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    // broad amber band
    const band = compressed ? UI.amberDeep : UI.amber;
    ctx.fillStyle = alpha(band, 0.95);
    ctx.fillRect((c0[0] + c1[0]) / 2 - 7, c0[1] + (c1[1] - c0[1]) / 2 - R, 14, R * 2);
    if (compressed) {
      // reinforcement ribs + welded sphere
      ctx.strokeStyle = shade(WHITE, -0.3);
      ctx.lineWidth = 1.6;
      for (let i = -2; i <= 2; i++) {
        const t = 0.5 + i * 0.17;
        const x = c0[0] + (c1[0] - c0[0]) * t, y = c0[1] + (c1[1] - c0[1]) * t;
        ctx.beginPath(); ctx.ellipse(x, y, R * 0.5, R * 0.96, 0, 0, Math.PI * 2); ctx.stroke();
      }
      dome(ctx, 0.42, 0.3, 8, 2, shade(WHITE, -0.1));
    }
    // vertical sight-glass (fill level animated in overlay)
    ctx.fillStyle = '#10161A';
    ctx.fillRect(c1[0] - 11, c1[1] - R + 3, 3.4, R * 2 - 6);
  },

  commandCentre(ctx) {
    plinth(ctx);
    // stepped tetra-pyramid
    box(ctx, -0.46, -0.46, 0.46, 0.46, 4, 26, WHITE);
    box(ctx, -0.33, -0.33, 0.33, 0.33, 26, 48, shade(WHITE, -0.03));
    box(ctx, -0.20, -0.20, 0.20, 0.20, 48, 66, shade(WHITE, -0.06));
    // teal command deck band (lit when active — re-tinted in overlay)
    box(ctx, -0.22, -0.22, 0.22, 0.22, 48, 54, TEAL, { noTop: true });
    box(ctx, -0.09, -0.09, 0.09, 0.09, 66, 78, shade(WHITE, -0.1));
    // dark sensor windows
    for (let c = 0; c < 3; c++) winSE(ctx, 0.46, -0.3 + c * 0.22, 10, 0.12, 10, '#16222C');
    for (let c = 0; c < 3; c++) winSW(ctx, -0.3 + c * 0.22, 0.46, 10, 0.12, 10, '#1C2A36');
    // apex comms vane + beacon drawn in overlay
  },

  securityHQ(ctx) {
    plinth(ctx);
    box(ctx, -0.44, -0.38, 0.36, 0.38, 4, 30, '#22304A');
    // white stripe wrap
    winSW(ctx, -0.44, 0.38, 16, 0.8, 6, alpha(WHITE, 0.92));
    winSE(ctx, 0.36, -0.38, 16, 0.76, 6, alpha(shade(WHITE, -0.2), 0.92));
    // barred slit windows
    for (let c = 0; c < 4; c++) winSW(ctx, -0.36 + c * 0.18, 0.38, 24, 0.04, 4, '#0E1622');
    // corner watchtower (searchlight cone in overlay)
    cylinder(ctx, 0.4, -0.3, 7, 4, 48, '#2A3A58');
    cylinder(ctx, 0.4, -0.3, 9, 48, 53, WHITE, { top: '#101824' });
  },

  sportsComplex(ctx) {
    plinth(ctx);
    const [cx, cy] = P(0, 0, 4);
    // white elliptical ring wall
    ctx.fillStyle = shade(WHITE, -0.05);
    ctx.beginPath();
    ctx.ellipse(cx, cy - 5, 38, 19, 0, 0, Math.PI * 2);
    ctx.ellipse(cx, cy - 3, 29, 14, 0, 0, Math.PI * 2);
    ctx.fill('evenodd');
    ctx.strokeStyle = alpha('#FFFFFF', 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 9, 38, 19, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    // outer wall depth
    ctx.fillStyle = shade(WHITE, -0.35);
    ctx.beginPath();
    ctx.ellipse(cx, cy + 1, 38, 19, 0, 0, Math.PI);
    ctx.ellipse(cx, cy - 5, 38, 19, 0, 0, Math.PI);
    ctx.fill('evenodd');
    // glowing green pitch
    ctx.fillStyle = '#2E7A3C';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 3, 27, 12.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = alpha('#9FE86A', 0.55);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 3, 14, 6.5, 0, 0, Math.PI * 2);
    ctx.moveTo(cx - 27, cy - 3); ctx.lineTo(cx + 27, cy - 3);
    ctx.stroke();
    // four floodlight masts (lit during events — overlay)
    for (const [u, v] of [[-0.42, -0.34], [0.42, -0.3], [-0.42, 0.36], [0.44, 0.34]] as const) {
      const b = P(u, v, 4), t = P(u, v, 42);
      strut(ctx, b, t, 2, '#8A949C');
      ctx.fillStyle = '#222A30';
      ctx.fillRect(t[0] - 4, t[1] - 3, 8, 4);
    }
  },

  radar(ctx, long = false) {
    plinth(ctx);
    cylinder(ctx, 0, 0.06, 14, 4, 20, WHITE);
    if (long) dome(ctx, 0.34, 0.3, 8, 4, shade(WHITE, -0.05));
    // A-frame mount; dish itself rotates in the overlay
    strut(ctx, P(-0.12, 0.1, 20), P(0, 0, 34), 3, shade(WHITE, -0.3));
    strut(ctx, P(0.12, -0.04, 20), P(0, 0, 34), 3, shade(WHITE, -0.4));
  },

  laserTurret(ctx, plasma = false) {
    plinth(ctx);
    // armoured ring
    cylinder(ctx, 0, 0, 17, 4, 13, mix(GUN, TEAL, 0.35), { top: shade(mix(GUN, TEAL, 0.35), 0.15) });
    ctx.strokeStyle = alpha(GLOWC, 0.5);
    ctx.lineWidth = 1.2;
    const [rx, ry] = P(0, 0, 13);
    ctx.beginPath(); ctx.ellipse(rx, ry, 14, 7, 0, 0, Math.PI * 2); ctx.stroke();
    if (plasma) glow(ctx, rx, ry - 4, 10, GLOWC, 0.2);
    // yoke + barrels drawn in overlay (12 facings)
  },

  missileLauncher(ctx, fired = false) {
    plinth(ctx);
    // blast deflector wedge
    poly(ctx, [P(-0.4, 0.1, 4), P(-0.16, 0.34, 4), P(-0.4, 0.34, 22)],
      vGrad(ctx, -30, 10, shade(GUN, 0.1), shade(GUN, -0.3)));
    // skeletal cradle + fold-back gantry
    const gTop = P(0.16, -0.12, 56);
    strut(ctx, P(0.3, 0.1, 4), gTop, 3, '#5A646C');
    strut(ctx, P(0.34, -0.3, 4), gTop, 3, '#525A62');
    strut(ctx, P(0.16, -0.12, 30), P(0.02, -0.02, 30), 2, '#6A747C');
    if (!fired) {
      // erect missile: white body, teal nose
      const b = P(0, 0, 8);
      ctx.fillStyle = vGrad(ctx, b[1] - 46, b[1], shade(WHITE, 0.12), shade(WHITE, -0.3));
      ctx.fillRect(b[0] - 4.5, b[1] - 44, 9, 44);
      ctx.fillStyle = TEAL;
      ctx.beginPath();
      ctx.moveTo(b[0] - 4.5, b[1] - 44);
      ctx.quadraticCurveTo(b[0], b[1] - 58, b[0] + 4.5, b[1] - 44);
      ctx.closePath();
      ctx.fill();
      // fins
      poly(ctx, [[b[0] - 4.5, b[1] - 6], [b[0] - 10, b[1] + 2], [b[0] - 4.5, b[1]]], shade(WHITE, -0.2));
      poly(ctx, [[b[0] + 4.5, b[1] - 6], [b[0] + 10, b[1] + 2], [b[0] + 4.5, b[1]]], shade(WHITE, -0.35));
    } else {
      // scorched pad
      const [sx, sy] = P(0, 0, 4);
      ctx.fillStyle = 'rgba(10,8,6,0.6)';
      ctx.beginPath(); ctx.ellipse(sx, sy, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
    }
  },

  tankYard(ctx) {
    plinth(ctx);
    // open-sided assembly hall: back walls + portal frame, doors face SE
    box(ctx, -0.46, -0.42, 0.46, -0.28, 4, 34, GUN);           // back wall (NW side)
    box(ctx, -0.46, -0.42, -0.32, 0.42, 4, 34, shade(GUN, -0.06)); // west wall
    // roof slab on columns
    for (const [u, v] of [[0.42, 0.38], [0.42, -0.36], [-0.42, 0.38]] as const)
      strut(ctx, P(u, v, 4), P(u, v, 34), 3.5, shade(GUN, 0.15));
    box(ctx, -0.5, -0.46, 0.5, 0.46, 34, 40, mix(GUN, TEAL, 0.25), { rim: alpha(GLOWC, 0.6) });
    // floor markings
    const [fx, fy] = P(0.02, 0.04, 4.5);
    ctx.strokeStyle = alpha(UI.amber, 0.4);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(fx, fy, 18, 9, 0, 0, Math.PI * 2); ctx.stroke();
    // partial tank hull + crane in overlay (progress-driven)
  },

  shipYard(ctx) {
    plinth(ctx);
    // two tower gantries with cross-bracing
    for (const [u, v] of [[-0.4, -0.3], [0.38, 0.28]] as const) {
      box(ctx, u - 0.07, v - 0.07, u + 0.07, v + 0.07, 4, 74, '#4E585E');
      const a = P(u - 0.07, v + 0.07, 4), b = P(u + 0.07, v + 0.07, 74);
      strut(ctx, a, b, 1.4, alpha('#9AA4AC', 0.8));
      const a2 = P(u - 0.07, v + 0.07, 74), b2 = P(u + 0.07, v + 0.07, 4);
      strut(ctx, a2, b2, 1.4, alpha('#9AA4AC', 0.8));
    }
    // overhead crossbeam
    strut(ctx, P(-0.4, -0.3, 74), P(0.38, 0.28, 74), 4, '#5E686E');
    // drydock cradle
    box(ctx, -0.3, -0.1, 0.34, 0.22, 4, 12, SLATE);
    for (let i = 0; i < 3; i++) {
      const t = -0.2 + i * 0.22;
      strut(ctx, P(t, 0.24, 4), P(t, -0.12, 16), 2.5, '#6A747C');
    }
    // hanging cables
    for (const du of [-0.2, 0.0, 0.2]) {
      const top = P(du * 0.9 - 0.01, du * 0.74 - 0.01, 74);
      strut(ctx, top, [top[0], top[1] + 26], 1, alpha('#C8D0D4', 0.6));
    }
    // hull-in-progress + welding arcs + beacons in overlay
  },

  launchPad(ctx) {
    contactShadow(ctx, 40, 20, 0.25, 0, 3);
    // flat octagonal pad flush with the tile
    ctx.save();
    ctx.scale(1, 0.5);
    const R = 40;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i + Math.PI / 8;
      const x = Math.cos(a) * R, y = Math.sin(a) * R;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -R, 0, R);
    g.addColorStop(0, '#2E3640');
    g.addColorStop(1, '#1A2026');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = alpha(WHITE, 0.85);
    ctx.lineWidth = 2.4;
    ctx.stroke();
    // target roundel
    ctx.strokeStyle = alpha(WHITE, 0.9);
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    // corner lamps chase in overlay
  },

  matterTransporter(ctx) {
    plinth(ctx);
    // glowing pad
    const [px, py] = P(0, 0, 5);
    ctx.fillStyle = alpha(GLOWC, 0.3);
    ctx.beginPath(); ctx.ellipse(px, py, 22, 11, 0, 0, Math.PI * 2); ctx.fill();
    // two facing pylon horns (tuning fork)
    const horn = (u: number, v: number, flip: number) => {
      const b = P(u, v, 4);
      const t = P(u * 0.45, v * 0.45, 58);
      ctx.strokeStyle = shade(TEAL, -0.15);
      ctx.lineCap = 'round';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.quadraticCurveTo(b[0] + flip * 6, b[1] - 40, t[0], t[1]);
      ctx.stroke();
      ctx.strokeStyle = shade(TEAL, 0.25);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      lightDot(ctx, t[0], t[1], 2.2, GLOWC);
    };
    horn(-0.34, 0.26, -1);
    horn(0.34, -0.26, 1);
    // energy curtain animated in overlay
  },

  tankTeleport(ctx) {
    contactShadow(ctx, 36, 18, 0.25, 0, 3);
    // flat glyph pad: teal iso-diamond inset
    diamondPath(ctx, 0.86);
    ctx.fillStyle = vGrad(ctx, -14, 14, '#10262A', '#081416');
    ctx.fill();
    ctx.strokeStyle = alpha(TEAL, 0.9);
    ctx.lineWidth = 2;
    ctx.stroke();
    // corner posts with violet tips
    for (const [u, v] of [[-0.42, -0.42], [0.42, -0.42], [0.42, 0.42], [-0.42, 0.42]] as const) {
      const b = P(u, v, 0), t = P(u, v, 16);
      strut(ctx, b, t, 3, SLATE);
      lightDot(ctx, t[0], t[1], 2, UI.violet);
    }
    // flowing chevrons animated in overlay
  },

  landMine(ctx) {
    // nearly invisible: subtle dark disc + three low prongs
    const [px, py] = P(0, 0, 1);
    ctx.fillStyle = 'rgba(14,16,18,0.85)';
    ctx.beginPath(); ctx.ellipse(px, py, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(px, py - 1, 9, 4.4, 0, Math.PI, Math.PI * 2); ctx.stroke();
    for (const a of [0.4, 1.7, 2.9]) {
      const x = px + Math.cos(a) * 7, y = py - 2 + Math.sin(a) * 3;
      strut(ctx, [x, y], [x, y - 4], 1.4, '#2E3640');
    }
    // red blink in overlay
  },
};

// ---------------------------------------------------------------- public API

export interface BuildingFlags {
  plasma?: boolean;
  longRange?: boolean;
  compressed?: boolean;
  fired?: boolean;
}

export function buildingSprite(type: BuildingType, flags: BuildingFlags = {}): Sprite {
  const variant = `${flags.plasma ? 'P' : ''}${flags.longRange ? 'L' : ''}${flags.compressed ? 'C' : ''}${flags.fired ? 'F' : ''}`;
  return sprite(`bld|${type}|${variant}`, B_W, B_H, B_AX, B_AY, (ctx) => {
    switch (type) {
      case 'fuelTank': (bodies.fuelTank as (c: Ctx, comp?: boolean) => void)(ctx, !!flags.compressed); break;
      case 'radar': (bodies.radar as (c: Ctx, l?: boolean) => void)(ctx, !!flags.longRange); break;
      case 'laserTurret': (bodies.laserTurret as (c: Ctx, p?: boolean) => void)(ctx, !!flags.plasma); break;
      case 'missileLauncher': (bodies.missileLauncher as (c: Ctx, f?: boolean) => void)(ctx, !!flags.fired); break;
      default: bodies[type](ctx);
    }
  });
}

/** wreckage mound — keyed by destroyed building type for palette desaturation */
export function wreckageSprite(seed: number): Sprite {
  const v = seed & 3;
  return sprite(`wreck|${v}`, B_W, 90, B_AX, 70, (ctx) => {
    contactShadow(ctx, 34, 17, 0.3, 0, 2);
    const r = (n: number) => { seed = (seed * 16807 + n) % 2147483647; return (seed & 0xffff) / 65536; };
    // rubble mound
    for (let i = 0; i < 7; i++) {
      const x = (r(1) - 0.5) * 44, y = (r(2) - 0.5) * 18;
      const rad = 6 + r(3) * 11;
      const c = shade('#3A3A38', (r(4) - 0.6) * 0.3);
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(x, y - rad * 0.2, rad, rad * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    }
    // two bent structural ribs
    ctx.strokeStyle = '#52524E';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-10, 2); ctx.quadraticCurveTo(-16, -22, -2, -28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, 4); ctx.quadraticCurveTo(22, -10, 16, -20); ctx.stroke();
    // fading embers
    for (let i = 0; i < 4; i++) {
      glow(ctx, (r(5) - 0.5) * 30, (r(6) - 0.5) * 12, 4, '#FF5A1F', 0.25);
    }
  });
}

// ---------------------------------------------------------------- animated overlays

export interface OverlayState {
  type: BuildingType;
  x: number; y: number;
  manned: boolean;          // staff > 0 (or building powered for unstaffed)
  powered: boolean;
  active: boolean;          // command centre
  facing: number;           // turret degrees (map-space)
  plasma: boolean;
  fired: boolean;
  longRange: boolean;
  fuelRatio: number;        // fuel tank fill 0..1
  tankProgress: number;     // tank yard 0..100, -1 = idle
  shipWork: number;         // ship yard workDone ratio 0..1, -1 = none
  eventActive: boolean;     // sports complex
  storeLevel: number;       // 0 none, 1 near-full, 2 full
}

/** map-space facing (deg) → screen angle for barrel drawing */
function facingToScreen(deg: number): number {
  const r = (deg * Math.PI) / 180;
  return Math.atan2((Math.cos(r) + Math.sin(r)) * HALF_H, (Math.cos(r) - Math.sin(r)) * HALF_W);
}

/**
 * Animated touches per building. ctx is already translated to the sprite
 * anchor and scaled by zoom — draw in the same local px space as the bodies.
 * t = seconds; per-instance phase via hash of (x,y).
 */
export function drawBuildingOverlay(ctx: Ctx, o: OverlayState, t: number, phase: number): void {
  const tt = t + phase * 7.3;
  const blink = (period: number, duty = 0.5) => (tt % period) / period < duty;
  switch (o.type) {
    case 'livingQuarters': {
      if (blink(2.4, 0.12)) lightDot(ctx, P(0.32, 0, 76)[0], P(0.32, 0, 76)[1], 1.6, UI.ok);
      break;
    }
    case 'hydroponics':
    case 'morgroHydroponics': {
      // grow-light pulse (4 s)
      const a = 0.10 + 0.10 * Math.sin((tt / 4) * Math.PI * 2);
      glow(ctx, 0, 4, 26, UI.ok, Math.max(0, a));
      if (o.type === 'morgroHydroponics') {
        // rising algae bubbles
        const bp = (tt * 0.5) % 1;
        const [bx, by] = P(-0.36, 0.26, 9 + bp * 16);
        ctx.fillStyle = alpha('#CFFFE0', 0.7 * (1 - bp));
        ctx.beginPath(); ctx.arc(bx, by, 1.2, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'lifeSupport': {
      // rotating rooftop turbine fan
      const [fx, fy] = P(0, 0, 43);
      const a0 = o.powered ? tt * 3.2 : 0;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.scale(1, 0.5);
      ctx.strokeStyle = '#A8B4BC';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const a = a0 + (Math.PI / 2) * i;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'spaceMossConverter': {
      // pulsing green syphon light rising to the collector
      const p = (tt * 0.8) % 1;
      const [gx, gy] = P(0, 0, 16 + p * 36);
      glow(ctx, gx, gy, 7, UI.ok, 0.5 * (1 - p * 0.6));
      glow(ctx, P(0, 0, 56)[0], P(0, 0, 56)[1], 12, UI.ok, 0.25 + 0.15 * Math.sin(tt * 2));
      break;
    }
    case 'powerStation': {
      // reactor window flicker
      const f = 0.18 + 0.10 * Math.sin(tt * 7.1) * Math.sin(tt * 3.7);
      const [wx, wy] = P(0, 0.39, 21);
      glow(ctx, wx, wy, 18, UI.amber, Math.max(0.08, f));
      break;
    }
    case 'solarPanel':
    case 'solarGenerator': {
      // specular sweep across the wing every ~6 s
      const p = (tt / 6) % 1;
      if (p < 0.25) {
        const x = -28 + p * 4 * 56;
        ctx.save();
        ctx.globalAlpha = 0.30 * Math.sin((p / 0.25) * Math.PI);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(x - 4, -48); ctx.lineTo(x + 4, -48); ctx.lineTo(x + 10, -12); ctx.lineTo(x + 2, -12);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'fluxPod': {
      // the iconic pulsing orb + three orbiting rings
      const pulse = 0.5 + 0.5 * Math.sin((tt / 2) * Math.PI * 2);
      const s = 1 + 0.06 * pulse;
      const [ox, oy] = P(0, 0, 36);
      glow(ctx, ox, oy, 22 * s, GLOWC, 0.5 + 0.4 * pulse);
      const g = ctx.createRadialGradient(ox - 4, oy - 5, 1, ox, oy, 13 * s);
      g.addColorStop(0, alpha('#EAFFFB', 0.95));
      g.addColorStop(0.5, alpha(GLOWC, 0.85));
      g.addColorStop(1, alpha(TEAL, 0.55));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(ox, oy, 12 * s, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 3; i++) {
        const a = tt * (0.7 + i * 0.23) + i * 2.1;
        ctx.strokeStyle = alpha(GLOWC, 0.55);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(ox, oy, 17 * s, 6 * s, (i - 1) * 0.5 + Math.sin(a) * 0.25, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case 'hospital': {
      // EKG blip chasing around the parapet
      const p = (tt * 0.6) % 1;
      const ang = p * Math.PI * 2;
      const [hx, hy] = P(Math.cos(ang) * 0.17, Math.sin(ang) * 0.17, 38);
      lightDot(ctx, hx, hy, 1.6, UI.ok);
      break;
    }
    case 'laboratory': {
      // violet scanning beam inside the oculus
      const sw = Math.sin(tt * 0.9);
      const [dx, dy] = P(-0.06, -0.04, 14);
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = UI.violet;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(dx + sw * 10 - 6, dy - 20);
      ctx.lineTo(dx + sw * 14, dy - 4);
      ctx.stroke();
      ctx.restore();
      glow(ctx, dx + sw * 10, dy - 12, 8, UI.violet, 0.25);
      break;
    }
    case 'mine': {
      // headframe wheel rotates while manned; intermittent ore sparks
      const [wx, wy] = P(0.04, -0.02, 52);
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(o.manned ? tt * 2.2 : 0);
      ctx.strokeStyle = '#8A8478';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI * 2 * i) / 3;
        ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 6.5, Math.sin(a) * 6.5);
      }
      ctx.stroke();
      ctx.restore();
      if (o.manned && blink(0.9, 0.18)) {
        const [sx2, sy2] = P(0.36, 0.36, 20);
        lightDot(ctx, sx2 + Math.sin(tt * 9) * 2, sy2, 1.2, UI.amber);
      }
      break;
    }
    case 'chemicalPlant': {
      // flare-stack flame
      if (o.powered) {
        const [fx, fy] = P(-0.36, -0.3, 63);
        const h = 5 + Math.sin(tt * 11) * 1.6 + Math.sin(tt * 23) * 0.8;
        ctx.fillStyle = alpha('#FF8A3C', 0.9);
        ctx.beginPath();
        ctx.moveTo(fx - 2.2, fy);
        ctx.quadraticCurveTo(fx, fy - h * 1.8, fx + 2.2, fy);
        ctx.closePath(); ctx.fill();
        glow(ctx, fx, fy - 4, 9, UI.amber, 0.4);
      }
      break;
    }
    case 'armsLab': {
      // red status light chasing along the missile rack
      const i = Math.floor(tt * 2.5) % 4;
      const u = -0.22 + i * 0.15;
      const [lx, ly] = P(u + 0.12, -0.2, 41);
      lightDot(ctx, lx, ly, 1.6, UI.warn);
      break;
    }
    case 'workshop': {
      // yard crane swings 30° while manned; spark flicker behind skylights
      const swing = o.manned ? Math.sin(tt * 0.8) * 0.26 : 0.2;
      const base = P(0.5, -0.3, 4);
      const top = P(0.5, -0.3, 30);
      strut(ctx, base, top, 2.5, '#7A848C');
      const hx = top[0] + Math.cos(-0.6 + swing) * 16;
      const hy = top[1] + Math.sin(-0.6 + swing) * 8;
      strut(ctx, top, [hx, hy], 2, '#8A949C');
      strut(ctx, [hx, hy], [hx, hy + 8], 1, '#C8D0D4');
      if (o.manned && blink(1.7, 0.08)) glow(ctx, P(-0.2, 0, 28)[0], P(-0.2, 0, 28)[1], 8, '#9FD8FF', 0.7);
      break;
    }
    case 'store': {
      if (o.storeLevel > 0 && blink(1.2, 0.5)) {
        const [px2, py2] = P(-0.05 + 0.42, -0.05 + 0.13, 46);
        lightDot(ctx, px2, py2, 1.8, o.storeLevel === 2 ? UI.warn : UI.amber);
      }
      break;
    }
    case 'fuelTank': {
      // sight-glass fill level
      const c1 = P(0.34, 0, 26);
      const H = 28;
      const fill = Math.max(0, Math.min(1, o.fuelRatio));
      ctx.fillStyle = UI.amberDeep;
      ctx.fillRect(c1[0] - 10.7, c1[1] - 14 + (1 - fill) * H, 2.8, fill * H);
      break;
    }
    case 'commandCentre': {
      // rotating comms vane + breathing apex beacon (when active)
      const [ax2, ay2] = P(0, 0, 78);
      const a = tt * 1.4;
      ctx.save();
      ctx.translate(ax2, ay2 - 4);
      ctx.scale(1, 0.5);
      ctx.strokeStyle = o.active ? '#E8F4F2' : '#5A646C';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
      ctx.lineTo(Math.cos(a + Math.PI) * 10, Math.sin(a + Math.PI) * 10);
      ctx.stroke();
      ctx.restore();
      strut(ctx, [ax2, ay2], [ax2, ay2 - 10], 1.5, o.active ? '#C8D4D8' : '#4A5258');
      if (o.active) {
        const breathe = 0.4 + 0.4 * (0.5 + 0.5 * Math.sin(tt * 1.8));
        glow(ctx, ax2, ay2 - 10, 9, '#FFFFFF', breathe);
        // lit deck band glow
        glow(ctx, P(0, 0, 51)[0], P(0, 0, 51)[1], 22, GLOWC, 0.16);
      }
      break;
    }
    case 'securityHQ': {
      // rotating blue-white searchlight cone from the watchtower
      const [tx, ty] = P(0.4, -0.3, 50);
      const a = tt * 0.9;
      const dx = Math.cos(a), dy = Math.sin(a) * 0.5;
      ctx.save();
      ctx.globalAlpha = 0.20;
      ctx.fillStyle = '#BFE8FF';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + dx * 38 - dy * 9, ty + dy * 19 + 24);
      ctx.lineTo(tx + dx * 38 + dy * 9, ty + dy * 19 + 30);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      lightDot(ctx, tx, ty - 2, 1.6, '#BFE8FF');
      break;
    }
    case 'sportsComplex': {
      if (o.eventActive) {
        for (const [u, v] of [[-0.42, -0.34], [0.42, -0.3], [-0.42, 0.36], [0.44, 0.34]] as const) {
          const [lx, ly] = P(u, v, 42);
          glow(ctx, lx, ly, 10, '#FFF6D8', 0.7);
        }
        // moving crowd dots on the pitch
        const [cx2, cy2] = P(0, 0, 1);
        for (let i = 0; i < 8; i++) {
          const a = tt * (0.4 + (i % 3) * 0.2) + i;
          ctx.fillStyle = i % 2 ? '#E8F4F2' : UI.amber;
          ctx.beginPath();
          ctx.arc(cx2 + Math.cos(a) * (8 + i * 2), cy2 - 4 + Math.sin(a) * (4 + i), 1, 0, Math.PI * 2);
          ctx.fill();
        }
        // holo-fireworks
        const fp = (tt * 0.7) % 1;
        if (fp < 0.4) {
          const fx2 = cx2 + (phase > 0.5 ? 14 : -14);
          glow(ctx, fx2, cy2 - 46 - fp * 14, 8 * fp / 0.4 + 3, phase > 0.5 ? UI.amber : UI.cyan, 0.8 * (1 - fp / 0.4));
        }
      }
      break;
    }
    case 'radar': {
      // rotating parabolic lattice dish (12-step yaw)
      const period = o.longRange ? 6 : 4;
      const step = Math.floor(((tt / period) % 1) * 12) / 12;
      const a = step * Math.PI * 2;
      const [mx, my] = P(0, 0, 36);
      const R = o.longRange ? 17 : 11;
      const fx3 = Math.cos(a), fy3 = Math.sin(a) * 0.5;
      ctx.save();
      ctx.translate(mx, my);
      // dish: ellipse squashed by viewing angle
      const sq = Math.abs(fx3) * 0.75 + 0.25;
      ctx.rotate(fy3 * 0.5);
      ctx.fillStyle = alpha('#E8F4F2', 0.95);
      ctx.beginPath();
      ctx.ellipse(0, -R * 0.35, R * sq, R * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = alpha('#9AB4BC', 0.9);
      ctx.lineWidth = 0.9;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(0, -R * 0.35, R * sq * (i / 4), R * 0.8 * (i / 4), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // feed horn
      ctx.strokeStyle = '#7A848C';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, -R * 0.35);
      ctx.lineTo(fx3 * R * 0.9, -R * 0.35 + fy3 * R);
      ctx.stroke();
      ctx.restore();
      if (blink(1.6, 0.2)) lightDot(ctx, mx + fx3 * R * sq, my - R * 0.35 - 4, 1.3, UI.warn);
      break;
    }
    case 'laserTurret': {
      // yoke + barrels at the current facing (12 steps)
      const sa = facingToScreen(o.facing);
      const snap = Math.round(sa / (Math.PI / 6)) * (Math.PI / 6);
      const [bx2, by2] = P(0, 0, 15);
      ctx.save();
      ctx.translate(bx2, by2);
      // housing
      ctx.fillStyle = o.plasma ? mix(GUN, TEAL, 0.5) : mix(GUN, TEAL, 0.3);
      ctx.beginPath(); ctx.ellipse(0, -2, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = alpha('#FFFFFF', 0.4);
      ctx.beginPath(); ctx.ellipse(0, -4, 8, 4.5, 0, Math.PI, Math.PI * 2); ctx.stroke();
      const dx2 = Math.cos(snap), dy2 = Math.sin(snap) * 0.55;
      ctx.lineCap = 'round';
      if (o.plasma) {
        // single fat barrel + glowing toroid coils
        ctx.strokeStyle = '#222A30';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(dx2 * 17, -3 + dy2 * 17); ctx.stroke();
        for (let i = 1; i <= 3; i++) {
          const px3 = dx2 * (4 + i * 4), py3 = -3 + dy2 * (4 + i * 4);
          const on = Math.floor(tt * 4) % 3 === i - 1;
          ctx.strokeStyle = alpha(GLOWC, on ? 0.95 : 0.4);
          ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.ellipse(px3, py3, 3.4, 2.2, snap, 0, Math.PI * 2); ctx.stroke();
        }
      } else {
        // twin barrels
        const ox2 = -dy2 * 4, oy2 = dx2 * 2;
        ctx.strokeStyle = '#1E262C';
        ctx.lineWidth = 2.4;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * ox2 * 0.5, -3 + s * oy2 * 0.5);
          ctx.lineTo(dx2 * 16 + s * ox2 * 0.5, -3 + dy2 * 16 + s * oy2 * 0.5);
          ctx.stroke();
        }
        ctx.strokeStyle = alpha(UI.cyan, 0.8);
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(dx2 * 15, -4 + dy2 * 15); ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'missileLauncher': {
      if (!o.fired && blink(1.4, 0.25)) {
        const [lx2, ly2] = P(0.22, 0.12, 6);
        lightDot(ctx, lx2, ly2, 1.6, UI.warn);
      }
      break;
    }
    case 'tankYard': {
      // gantry crane tracks over a progress-staged tank hull
      const cp = 0.5 + 0.5 * Math.sin(tt * 0.7);
      const cu = -0.3 + cp * 0.6;
      strut(ctx, P(cu, -0.42, 34), P(cu, 0.42, 34), 2.5, '#7A848C');
      strut(ctx, P(cu, 0, 34), P(cu, 0, 24), 1.2, '#C8D0D4');
      const prog = o.tankProgress;
      if (prog >= 0) {
        const stage = prog < 40 ? 0 : prog < 80 ? 1 : 2;
        // chassis
        box(ctx, -0.16, -0.1, 0.18, 0.12, 6, 11, '#2E3A40');
        if (stage >= 1) box(ctx, -0.13, -0.07, 0.15, 0.09, 11, 17, TEAL);
        if (stage >= 2) {
          dome(ctx, 0.01, 0.01, 6, 17, WHITE);
          strut(ctx, P(0.01, 0.01, 19), P(0.14, 0.1, 18), 2, '#1E262C');
        }
        if (o.manned && blink(0.8, 0.1)) glow(ctx, P(0, 0, 14)[0], P(0, 0, 14)[1], 7, '#9FD8FF', 0.85);
      }
      break;
    }
    case 'shipYard': {
      // hull under construction + welding arcs + tower beacons
      if (o.shipWork >= 0) {
        const len = 0.18 + o.shipWork * 0.22;
        const c = P(0.02, 0.06, 16);
        ctx.fillStyle = vGrad(ctx, c[1] - 8, c[1] + 6, shade(WHITE, 0.1), shade(WHITE, -0.3));
        ctx.beginPath();
        ctx.ellipse(c[0], c[1], len * 64, 8, -0.46, 0, Math.PI * 2);
        ctx.fill();
        if (o.shipWork > 0.5) {
          ctx.fillStyle = TEAL;
          ctx.fillRect(c[0] - 4, c[1] - 6, 8, 3);
        }
        if (o.manned && blink(0.6, 0.12)) {
          const wx2 = c[0] + (Math.sin(tt * 3.1) * len * 50);
          glow(ctx, wx2, c[1] - 4, 6, '#BFE8FF', 0.95);
        }
      }
      for (const [u, v] of [[-0.4, -0.3], [0.38, 0.28]] as const) {
        if (blink(2.2, 0.14)) lightDot(ctx, P(u, v, 76)[0], P(u, v, 76)[1], 1.6, UI.amber);
      }
      break;
    }
    case 'launchPad': {
      // corner lamps: amber chase
      const which = Math.floor(tt * 3) % 4;
      const corners = [[-0.4, -0.4], [0.4, -0.4], [0.4, 0.4], [-0.4, 0.4]] as const;
      corners.forEach(([u, v], i) => {
        const [lx3, ly3] = P(u, v, 2);
        if (i === which) lightDot(ctx, lx3, ly3, 1.7, UI.amber);
        else { ctx.fillStyle = alpha(UI.amberDeep, 0.5); ctx.beginPath(); ctx.arc(lx3, ly3, 1.2, 0, Math.PI * 2); ctx.fill(); }
      });
      break;
    }
    case 'matterTransporter': {
      // shimmering vertical energy curtain between the horns
      const t0 = P(-0.34 * 0.45, 0.26 * 0.45, 58), t1 = P(0.34 * 0.45, -0.26 * 0.45, 58);
      const b0 = P(-0.2, 0.16, 6), b1 = P(0.2, -0.16, 6);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const f = i / 5;
        const a = 0.10 + 0.10 * Math.sin(tt * 3 + i * 1.7);
        ctx.strokeStyle = alpha(GLOWC, Math.max(0.03, a));
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(b0[0] + (b1[0] - b0[0]) * f, b0[1] + (b1[1] - b0[1]) * f);
        ctx.lineTo(t0[0] + (t1[0] - t0[0]) * f, t0[1] + (t1[1] - t0[1]) * f);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'tankTeleport': {
      // concentric chevrons flowing inward
      for (let i = 0; i < 3; i++) {
        const p = 1 - ((tt * 0.5 + i / 3) % 1);
        ctx.strokeStyle = alpha(GLOWC, 0.7 * (1 - p));
        ctx.lineWidth = 2;
        diamondPath(ctx, 0.15 + p * 0.66);
        ctx.stroke();
      }
      break;
    }
    case 'landMine': {
      if (blink(3, 0.05)) lightDot(ctx, P(0, 0, 4)[0], P(0, 0, 4)[1], 1.3, UI.warn);
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------- scaffold

/**
 * Universal construction state: teal holo-box + scaffold poles + crane arms;
 * the final sprite is revealed bottom-up behind a rising clip line.
 * progress 0..1. Drawn immediate (local px space).
 */
export function drawScaffold(ctx: Ctx, finalSprite: Sprite, progress: number, t: number, phase: number): void {
  contactShadow(ctx, 36, 18, 0.3, 0, 2);
  const H = 70; // holo box height
  const p = Math.max(0, Math.min(1, progress));
  // final sprite revealed bottom-up
  if (p > 0.02) {
    ctx.save();
    const revealTop = 20 - p * (H + 24); // local y of the clip top
    ctx.beginPath();
    ctx.rect(-B_AX, revealTop, B_W, B_AY + 30 - revealTop);
    ctx.clip();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(finalSprite.canvas, -finalSprite.ax, -finalSprite.ay, finalSprite.w, finalSprite.h);
    ctx.restore();
  }
  // teal wireframe holo-box (dashed) with rising scanline
  const c: [number, number][] = [P(-0.42, -0.42), P(0.42, -0.42), P(0.42, 0.42), P(-0.42, 0.42)];
  ctx.save();
  ctx.strokeStyle = alpha(GLOWC, 0.55);
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.lineDashOffset = -t * 8;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = c[i], b = c[(i + 1) % 4];
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);                      // base
    ctx.moveTo(a[0], a[1] - H); ctx.lineTo(b[0], b[1] - H);              // top
    ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0], a[1] - H);                  // verticals
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // scanline
  const sp = ((t * 0.4 + phase) % 1);
  ctx.strokeStyle = alpha(GLOWC, 0.35 * (1 - sp));
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = c[i], b = c[(i + 1) % 4];
    ctx.moveTo(a[0], a[1] - H * sp); ctx.lineTo(b[0], b[1] - H * sp);
  }
  ctx.stroke();
  ctx.restore();
  // grey scaffold poles at corners + one crossbar
  for (const [px, py] of c) {
    strut(ctx, [px * 0.92, py * 0.92], [px * 0.92, py * 0.92 - H * 0.85], 1.8, '#5E686E');
  }
  strut(ctx, [c[3][0] * 0.92, c[3][1] * 0.92 - H * 0.6], [c[0][0] * 0.92, c[0][1] * 0.92 - H * 0.6], 1.2, '#525A62');
  // two tiny crane arms
  for (const s of [0, 1]) {
    const base = c[s === 0 ? 1 : 3];
    const bx = base[0] * 0.92, by = base[1] * 0.92 - H * 0.85;
    const swing = Math.sin(t * 0.9 + phase * 6 + s * 2) * 0.5;
    const ax3 = bx + Math.cos(swing + (s ? 2.6 : 0.5)) * 14;
    const ay3 = by + Math.sin(swing + (s ? 2.6 : 0.5)) * 7 - 2;
    strut(ctx, [bx, by], [ax3, ay3], 1.6, UI.amber);
    strut(ctx, [ax3, ay3], [ax3, ay3 + 6], 0.9, '#C8D0D4');
  }
  // progress readout bar on the front base edge
  ctx.fillStyle = alpha('#0D141A', 0.8);
  ctx.fillRect(-16, 12, 32, 4);
  ctx.fillStyle = GLOWC;
  ctx.fillRect(-15, 13, 30 * p, 2);
}
