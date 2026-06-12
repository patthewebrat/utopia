// The frame — terrain chunk cache, depth-sorted structures/units, effects,
// selection, build ghost, markers, fog-of-undetected deposits.
// Draws in WORLD space (iso px at zoom 1) under a single camera transform;
// sprites are 2x-rastered offscreen canvases (see src/art/*).

import type { GameState, BuildingInstance, UnitInstance, BuildingType, BiomeId } from '../types';
import * as engine from '../engine';
import { Camera } from './camera';
import { UI, BIOME_PALETTES, alpha } from '../art/palette';
import { HALF_W, HALF_H, hash2, Ctx } from '../art/iso';
import { sprite, Sprite, blit } from '../art/sprites';
import { tileSprite, depositGlyph, drawSlabSkirt } from '../art/terrain';
import {
  buildingSprite, wreckageSprite, drawBuildingOverlay, drawScaffold,
  OverlayState, BuildingFlags,
} from '../art/buildings';
import { unitSprite, unitShadow, selectionRing, markerFlag, FACINGS } from '../art/units';
import { Effects } from '../art/effects';

const CHUNK = 16;                  // tiles per chunk side
const CHUNK_PAD_X = 48;            // feature overflow margins (px)
const CHUNK_PAD_TOP = 104;
const CHUNK_PAD_BOT = 32;
const FLUX_RADIUS = 12;

interface Chunk {
  canvas: HTMLCanvasElement;
  ox: number;                      // world px of canvas top-left
  oy: number;
  dirty: boolean;
}

interface DrawItem {
  depth: number;
  kind: 'building' | 'unit' | 'wreck' | 'marker' | 'ghost';
  b?: BuildingInstance;
  u?: UnitInstance;
  wx: number;
  wy: number;
  slot?: number;                   // marker slot
}

interface UnitAnim {
  facing: number;
  alt: number;
  lastX: number;
  lastY: number;
}

export interface GhostInfo {
  type: BuildingType;
  x: number;
  y: number;
  valid: boolean;
  reason: string | null;
}

export class Renderer {
  readonly camera: Camera;
  readonly effects = new Effects();

  private canvas: HTMLCanvasElement;
  private ctx: Ctx;
  private state: GameState;
  private biome: BiomeId;

  private chunks = new Map<number, Chunk>();
  private chunksW = 0;
  private chunksH = 0;

  private deposits: { x: number; y: number; kind: 'ore' | 'fuel'; visible: boolean }[] = [];
  private depositRefreshAt = 0;

  private unitAnims = new Map<number, UnitAnim>();
  private drawList: DrawItem[] = [];

  /** UI-set state */
  ghost: GhostInfo | null = null;
  hoverTile: { x: number; y: number } | null = null;
  selectedUnitIds = new Set<number>();
  selectedBuildingId: number | null = null;
  /** show all deposit glyphs regardless of reveal (map-knowledge toggle) */
  showDeposits = true;

  private lastTime = -1;

  constructor(canvas: HTMLCanvasElement, state: GameState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.state = state;
    this.biome = engine.getScenario(state.scenarioId).biome;
    this.camera = new Camera(canvas);
    this.camera.setMapBounds(state.mapW, state.mapH);
    this.camera.attach();
    this.indexDeposits();
    this.chunksW = Math.ceil(state.mapW / CHUNK);
    this.chunksH = Math.ceil(state.mapH / CHUNK);
  }

  /** swap in a (new) GameState — e.g. after loading a save */
  setState(state: GameState): void {
    this.state = state;
    this.biome = engine.getScenario(state.scenarioId).biome;
    this.camera.setMapBounds(state.mapW, state.mapH);
    this.chunks.clear();
    this.chunksW = Math.ceil(state.mapW / CHUNK);
    this.chunksH = Math.ceil(state.mapH / CHUNK);
    this.unitAnims.clear();
    this.indexDeposits();
    this.depositRefreshAt = 0;
  }

  /** terrain changed at a tile (rare) — re-raster its chunk */
  dirtyTile(x: number, y: number): void {
    const key = Math.floor(x / CHUNK) + Math.floor(y / CHUNK) * 1000;
    const c = this.chunks.get(key);
    if (c) c.dirty = true;
  }

  screenToTile(sx: number, sy: number): [number, number] {
    return this.camera.screenToTile(sx, sy);
  }

  // ---------------------------------------------------------------- deposits

  private indexDeposits(): void {
    this.deposits = [];
    const s = this.state;
    for (let y = 0; y < s.mapH; y++) {
      for (let x = 0; x < s.mapW; x++) {
        const i = y * s.mapW + x;
        if (s.oreYield[i] > 0) this.deposits.push({ x, y, kind: 'ore', visible: false });
        if (s.fuelYield[i] > 0) this.deposits.push({ x, y, kind: 'fuel', visible: false });
      }
    }
  }

  private refreshDepositVisibility(): void {
    for (const d of this.deposits) {
      d.visible = engine.depositVisible(this.state, d.x, d.y, d.kind);
    }
  }

  // ---------------------------------------------------------------- terrain

  private getChunk(cx: number, cy: number): Chunk {
    const key = cx + cy * 1000;
    let c = this.chunks.get(key);
    if (!c || c.dirty) {
      const s = this.state;
      const x0 = cx * CHUNK, y0 = cy * CHUNK;
      const x1 = Math.min(s.mapW, x0 + CHUNK), y1 = Math.min(s.mapH, y0 + CHUNK);
      // world bbox of all tile centres in the chunk
      const minWx = (x0 - (y1 - 1)) * HALF_W - CHUNK_PAD_X;
      const maxWx = ((x1 - 1) - y0) * HALF_W + CHUNK_PAD_X;
      const minWy = (x0 + y0) * HALF_H - CHUNK_PAD_TOP;
      const maxWy = ((x1 - 1) + (y1 - 1)) * HALF_H + CHUNK_PAD_BOT;
      if (!c) {
        const canvas = document.createElement('canvas');
        canvas.width = maxWx - minWx;
        canvas.height = maxWy - minWy;
        c = { canvas, ox: minWx, oy: minWy, dirty: true };
        this.chunks.set(key, c);
      }
      const ctx = c.canvas.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.canvas.width, c.canvas.height);
      ctx.translate(-c.ox, -c.oy);
      // painter order: by diagonal (x+y), so tall features overlap correctly
      for (let d = x0 + y0; d <= (x1 - 1) + (y1 - 1); d++) {
        for (let y = y0; y < y1; y++) {
          const x = d - y;
          if (x < x0 || x >= x1) continue;
          this.blitTile(ctx, x, y, 1);
        }
      }
      c.dirty = false;
    }
    return c;
  }

  private blitTile(ctx: Ctx, x: number, y: number, zoom: number): void {
    const s = this.state;
    const t = s.terrain[y * s.mapW + x];
    const variant = (hash2(x, y) * 4) | 0;
    const spr = tileSprite(this.biome, t, variant);
    const wx = (x - y) * HALF_W;
    const wy = (x + y) * HALF_H;
    blit(ctx, spr, wx, wy, zoom);
  }

  // ---------------------------------------------------------------- frame

  /** draw one frame at absolute time t (seconds). Drains state.effects. */
  render(t: number): void {
    const dt = this.lastTime < 0 ? 0.016 : Math.min(0.1, t - this.lastTime);
    this.lastTime = t;
    const cam = this.camera;
    cam.update(dt);

    const s = this.state;
    const ctx = this.ctx;
    const dpr = cam.dpr;

    // ingest engine effects
    if (s.effects.length > 0) {
      for (const fx of s.effects.splice(0, s.effects.length)) this.effects.spawn(fx);
    }
    this.effects.update(dt);

    if (t > this.depositRefreshAt) {
      this.refreshDepositVisibility();
      this.depositRefreshAt = t + 0.5;
    }

    // void background
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = UI.bg;
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);

    // camera transform: world px → screen
    const z = cam.zoom;
    ctx.setTransform(
      dpr * z, 0, 0, dpr * z,
      dpr * (cam.viewW / 2 - cam.x * z),
      dpr * (cam.viewH / 2 - cam.y * z),
    );
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = z < 0.75 ? 'medium' : 'high';

    const view = cam.visibleWorldRect();
    const pad = 180;

    // 1. colony slab skirt over the void
    drawSlabSkirt(ctx, s.mapW, s.mapH, this.biome);

    // 2. terrain
    if (z >= 1) {
      this.drawTerrainDirect(ctx, view);
    } else {
      this.drawTerrainChunks(ctx, view);
    }

    // 3. deposit glyphs (fog-of-undetected: only revealed ones)
    if (this.showDeposits) {
      const pulse = 0.85 + 0.15 * Math.sin(t * 2.5);
      for (const d of this.deposits) {
        if (!d.visible) continue;
        const yi = d.y * s.mapW + d.x;
        if ((d.kind === 'ore' ? s.oreYield[yi] : s.fuelYield[yi]) <= 0) continue;
        const wx = (d.x - d.y) * HALF_W;
        const wy = (d.x + d.y) * HALF_H;
        if (wx < view.x0 - pad || wx > view.x1 + pad || wy < view.y0 - pad || wy > view.y1 + pad) continue;
        blit(ctx, depositGlyph(d.kind), wx, wy, 1, pulse);
      }
    }

    // 4. ghost support: flux pod radius rings + tile validity diamond
    if (this.ghost) this.drawFluxRings(ctx);
    if (this.hoverTile && !this.ghost) this.tileOutline(ctx, this.hoverTile.x, this.hoverTile.y, alpha(UI.cyan, 0.6), 1.5);

    // 5. depth-sorted world entities
    this.buildDrawList(view, pad);
    for (const item of this.drawList) this.drawItem(ctx, item, t);

    // 6. particles
    this.effects.draw(ctx, z);

    // 7. screen-space passes: ghost reason tag, biome fog drift
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawGhostReason(ctx);
    const fog = BIOME_PALETTES[this.biome].fog;
    if (fog) this.drawFog(ctx, fog, t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---------------------------------------------------------------- terrain passes

  private drawTerrainChunks(ctx: Ctx, view: { x0: number; y0: number; x1: number; y1: number }): void {
    for (let cy = 0; cy < this.chunksH; cy++) {
      for (let cx = 0; cx < this.chunksW; cx++) {
        // cheap world-bbox cull before materialising the chunk
        const x0 = cx * CHUNK, y0 = cy * CHUNK;
        const x1 = Math.min(this.state.mapW, x0 + CHUNK), y1 = Math.min(this.state.mapH, y0 + CHUNK);
        const minWx = (x0 - (y1 - 1)) * HALF_W - CHUNK_PAD_X;
        const maxWx = ((x1 - 1) - y0) * HALF_W + CHUNK_PAD_X;
        const minWy = (x0 + y0) * HALF_H - CHUNK_PAD_TOP;
        const maxWy = ((x1 - 1) + (y1 - 1)) * HALF_H + CHUNK_PAD_BOT;
        if (maxWx < view.x0 || minWx > view.x1 || maxWy < view.y0 || minWy > view.y1) continue;
        const c = this.getChunk(cx, cy);
        ctx.drawImage(c.canvas, c.ox, c.oy);
      }
    }
  }

  private drawTerrainDirect(ctx: Ctx, view: { x0: number; y0: number; x1: number; y1: number }): void {
    const s = this.state;
    // tile-space bounds of the visible world rect (iso diamond ↔ rect overshoot is fine)
    const corners: [number, number][] = [
      Camera.worldToTile(view.x0, view.y0 - CHUNK_PAD_TOP),
      Camera.worldToTile(view.x1, view.y0 - CHUNK_PAD_TOP),
      Camera.worldToTile(view.x0, view.y1 + CHUNK_PAD_BOT),
      Camera.worldToTile(view.x1, view.y1 + CHUNK_PAD_BOT),
    ];
    let tx0 = Infinity, tx1 = -Infinity, ty0 = Infinity, ty1 = -Infinity;
    for (const [cx, cy] of corners) {
      tx0 = Math.min(tx0, cx); tx1 = Math.max(tx1, cx);
      ty0 = Math.min(ty0, cy); ty1 = Math.max(ty1, cy);
    }
    const x0 = Math.max(0, Math.floor(tx0) - 1), x1 = Math.min(s.mapW - 1, Math.ceil(tx1) + 1);
    const y0 = Math.max(0, Math.floor(ty0) - 1), y1 = Math.min(s.mapH - 1, Math.ceil(ty1) + 1);
    for (let d = x0 + y0; d <= x1 + y1; d++) {
      for (let y = y0; y <= y1; y++) {
        const x = d - y;
        if (x < x0 || x > x1) continue;
        const wx = (x - y) * HALF_W;
        const wy = (x + y) * HALF_H;
        if (wx < view.x0 - 96 || wx > view.x1 + 96 || wy < view.y0 - CHUNK_PAD_TOP || wy > view.y1 + CHUNK_PAD_BOT) continue;
        this.blitTile(ctx, x, y, 1);
      }
    }
  }

  // ---------------------------------------------------------------- entities

  private buildDrawList(view: { x0: number; y0: number; x1: number; y1: number }, pad: number): void {
    const s = this.state;
    const list = this.drawList;
    list.length = 0;
    const inView = (wx: number, wy: number) =>
      wx >= view.x0 - pad && wx <= view.x1 + pad && wy >= view.y0 - pad && wy <= view.y1 + pad;

    for (const b of s.buildings) {
      const wx = (b.x - b.y) * HALF_W;
      const wy = (b.x + b.y) * HALF_H;
      if (!inView(wx, wy)) continue;
      list.push({ depth: b.x + b.y, kind: 'building', b, wx, wy });
    }
    // wreckage tiles (cheap native scan first — the common case is none at all)
    if (s.wreckage.includes(1)) {
      for (let y = 0; y < s.mapH; y++) {
        const row = y * s.mapW;
        for (let x = 0; x < s.mapW; x++) {
          if (s.wreckage[row + x] !== 1) continue;
          const wx = (x - y) * HALF_W;
          const wy = (x + y) * HALF_H;
          if (!inView(wx, wy)) continue;
          list.push({ depth: x + y, kind: 'wreck', wx, wy });
        }
      }
    }
    for (const u of s.units) {
      if (u.offMap !== null) continue;
      if (u.owner === 'enemy' && !engine.enemyVisible(s, u.x, u.y)) continue;
      const wx = (u.x - u.y) * HALF_W;
      const wy = (u.x + u.y) * HALF_H;
      if (!inView(wx, wy)) continue;
      list.push({ depth: u.x + u.y + 0.01, kind: 'unit', u, wx, wy });
    }
    // prune animation state for units that no longer exist
    if (this.unitAnims.size > s.units.length) {
      const alive = new Set<number>();
      for (const u of s.units) alive.add(u.id);
      for (const id of this.unitAnims.keys()) if (!alive.has(id)) this.unitAnims.delete(id);
    }
    for (let i = 0; i < s.markers.length; i++) {
      const m = s.markers[i];
      if (!m) continue;
      const wx = (m.x - m.y) * HALF_W;
      const wy = (m.x + m.y) * HALF_H;
      if (!inView(wx, wy)) continue;
      list.push({ depth: m.x + m.y + 0.02, kind: 'marker', wx, wy, slot: i });
    }
    if (this.ghost) {
      const g = this.ghost;
      list.push({
        depth: g.x + g.y + 0.03, kind: 'ghost',
        wx: (g.x - g.y) * HALF_W, wy: (g.x + g.y) * HALF_H,
      });
    }
    list.sort((a, c) => a.depth - c.depth);
  }

  private drawItem(ctx: Ctx, item: DrawItem, t: number): void {
    switch (item.kind) {
      case 'building': this.drawBuilding(ctx, item.b!, item.wx, item.wy, t); break;
      case 'wreck': {
        const seed = ((item.wx * 31 + item.wy * 17) | 0) >>> 0 || 1;
        blit(ctx, wreckageSprite(seed), item.wx, item.wy, 1);
        // occasional smoke wisp
        if (((t * 0.5 + hash2(item.wx | 0, item.wy | 0)) % 1) < 0.006) this.effects.wisp(item.wx, item.wy);
        break;
      }
      case 'unit': this.drawUnit(ctx, item.u!, item.wx, item.wy, t); break;
      case 'marker': blit(ctx, markerFlag(item.slot!), item.wx, item.wy, 1); break;
      case 'ghost': this.drawGhost(ctx, item.wx, item.wy, t); break;
    }
  }

  private drawBuilding(ctx: Ctx, b: BuildingInstance, wx: number, wy: number, t: number): void {
    const s = this.state;
    const flags: BuildingFlags = {
      plasma: b.plasma, longRange: b.longRange, compressed: b.compressed, fired: b.fired,
    };
    const spr = buildingSprite(b.type, flags);
    const phase = hash2(b.x, b.y);
    if (b.status === 'scaffold') {
      const def = engine.BUILDING_DEFS[b.type];
      const progress = def.buildMonths > 0 ? b.progress / def.buildMonths : 1;
      ctx.save();
      ctx.translate(wx, wy);
      drawScaffold(ctx, spr, progress, t, phase);
      ctx.restore();
      if (b.crewAssigned > 0 && ((t * 0.7 + phase) % 1) < 0.012) this.effects.dust(wx, wy);
      return;
    }
    if (this.selectedBuildingId === b.id) {
      this.tileOutline(ctx, b.x, b.y, alpha(UI.cyan, 0.9), 2);
    }
    blit(ctx, spr, wx, wy, 1);
    // damage tint
    const def = engine.BUILDING_DEFS[b.type];
    if (b.hp < def.hp * 0.5) {
      ctx.save();
      ctx.globalAlpha = 0.25 * (1 - b.hp / (def.hp * 0.5));
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(wx, wy - 20, 30, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // animated overlay
    const o: OverlayState = {
      type: b.type, x: b.x, y: b.y,
      manned: b.staff > 0 || (def.maxStaff === 0 && b.powered),
      powered: b.powered,
      active: b.active,
      facing: b.facing,
      plasma: b.plasma,
      fired: b.fired,
      longRange: b.longRange,
      fuelRatio: this.globalFuelRatio(),
      tankProgress: b.tankProgress,
      shipWork: b.shipOrder ? b.shipOrder.workDone / engine.UNIT_DEFS[b.shipOrder.ship].workUnits : -1,
      eventActive: s.worldEvents.sportsEventActiveMonth === s.monthIndex,
      storeLevel: this.storeLevel(),
    };
    ctx.save();
    ctx.translate(wx, wy);
    drawBuildingOverlay(ctx, o, t, phase);
    ctx.restore();
  }

  private fuelRatioCache = -1;
  private storeLevelCache = -1;
  private cacheFrameT = -1;

  private refreshHudCaches(): void {
    const s = this.state;
    const fuelCap = engine.fuelCapacity(s);
    this.fuelRatioCache = fuelCap > 0 ? s.fuelStored / fuelCap : 0;
    const cap = engine.storeCapacity(s);
    const used = s.stores.ore + s.stores.gems + s.stores.weapons + s.stores.techGoods;
    this.storeLevelCache = cap <= 0 ? 0 : used >= cap ? 2 : used >= cap * 0.85 ? 1 : 0;
  }

  private globalFuelRatio(): number {
    if (this.cacheFrameT !== this.lastTime) { this.refreshHudCaches(); this.cacheFrameT = this.lastTime; }
    return this.fuelRatioCache;
  }

  private storeLevel(): number {
    if (this.cacheFrameT !== this.lastTime) { this.refreshHudCaches(); this.cacheFrameT = this.lastTime; }
    return this.storeLevelCache;
  }

  private drawUnit(ctx: Ctx, u: UnitInstance, wx: number, wy: number, t: number): void {
    let anim = this.unitAnims.get(u.id);
    if (!anim) {
      anim = { facing: 1, alt: u.mode === 'flight' ? 56 : 0, lastX: wx, lastY: wy };
      this.unitAnims.set(u.id, anim);
    }
    // facing from screen-space velocity
    const dx = wx - anim.lastX, dy = wy - anim.lastY;
    if (dx * dx + dy * dy > 0.05) {
      const ground = Math.atan2(2 * dy, dx);
      let f = Math.round((ground / (Math.PI * 2)) * FACINGS);
      f = ((f % FACINGS) + FACINGS) % FACINGS;
      // enemy units snap (darting); player units ease via stepwise approach
      if (u.owner === 'enemy') anim.facing = f;
      else if (f !== anim.facing) {
        const diff = ((f - anim.facing + FACINGS * 1.5) % FACINGS) - FACINGS / 2;
        anim.facing = (anim.facing + Math.sign(diff) + FACINGS) % FACINGS;
      }
    }
    anim.lastX = wx;
    anim.lastY = wy;
    // altitude
    const targetAlt = u.mode === 'flight' ? 56 : u.mode === 'hovering' ? 28 : 0;
    anim.alt += (targetAlt - anim.alt) * 0.08;
    let alt = anim.alt;
    if (u.kind === 'hoverTank') alt += 3 + Math.sin(t * 4 + u.id) * 1; // hover bob
    const def = engine.UNIT_DEFS[u.kind];
    const big = def.isShip && (u.kind === 'warship' || u.kind === 'cruiser' || u.kind === 'fusionCruiser');

    // shadow: shrinks + fades with altitude
    const shScale = 1 - Math.min(0.55, alt / 130);
    blit(ctx, unitShadow(big), wx, wy, shScale, 0.8 - alt / 150);

    if (this.selectedUnitIds.has(u.id)) blit(ctx, selectionRing(u.owner === 'enemy'), wx, wy, 1);

    blit(ctx, unitSprite(u.kind, anim.facing), wx, wy - alt, 1);

    // hp bar when damaged
    if (u.hp < u.maxHp) {
      const w = 26, frac = Math.max(0, u.hp / u.maxHp);
      ctx.fillStyle = 'rgba(7,11,14,0.75)';
      ctx.fillRect(wx - w / 2, wy - alt - 34, w, 3.5);
      ctx.fillStyle = frac > 0.5 ? UI.ok : frac > 0.25 ? UI.amber : UI.warn;
      ctx.fillRect(wx - w / 2 + 0.5, wy - alt - 33.5, (w - 1) * frac, 2.5);
    }
  }

  // ---------------------------------------------------------------- ghost / overlays

  private tileOutline(ctx: Ctx, x: number, y: number, stroke: string, lw: number): void {
    const wx = (x - y) * HALF_W;
    const wy = (x + y) * HALF_H;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(wx, wy - HALF_H);
    ctx.lineTo(wx + HALF_W, wy);
    ctx.lineTo(wx, wy + HALF_H);
    ctx.lineTo(wx - HALF_W, wy);
    ctx.closePath();
    ctx.stroke();
  }

  private drawFluxRings(ctx: Ctx): void {
    for (const b of this.state.buildings) {
      if (b.type !== 'fluxPod' || b.status !== 'complete') continue;
      this.drawFluxRing(ctx, b.x, b.y, 0.35);
    }
  }

  private drawFluxRing(ctx: Ctx, x: number, y: number, a: number): void {
    const r = FLUX_RADIUS + 0.5;
    const pts: [number, number][] = [
      [(x - r - (y - r)) * HALF_W, (x - r + y - r) * HALF_H],
      [(x + r - (y - r)) * HALF_W, (x + r + y - r) * HALF_H],
      [(x + r - (y + r)) * HALF_W, (x + r + y + r) * HALF_H],
      [(x - r - (y + r)) * HALF_W, (x - r + y + r) * HALF_H],
    ];
    ctx.save();
    ctx.strokeStyle = alpha(UI.cyan, a);
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private drawGhost(ctx: Ctx, wx: number, wy: number, t: number): void {
    const g = this.ghost!;
    const color = g.valid ? UI.ok : UI.warn;
    // tile diamond
    const wob = 0.75 + 0.25 * Math.sin(t * 4);
    ctx.fillStyle = alpha(color, 0.18 * wob);
    ctx.beginPath();
    ctx.moveTo(wx, wy - HALF_H);
    ctx.lineTo(wx + HALF_W, wy);
    ctx.lineTo(wx, wy + HALF_H);
    ctx.lineTo(wx - HALF_W, wy);
    ctx.closePath();
    ctx.fill();
    this.tileOutline(ctx, g.x, g.y, alpha(color, 0.9 * wob), 2);
    // tinted half-alpha sprite
    blit(ctx, ghostSprite(g.type, g.valid), wx, wy, 1, 0.55);
    // flux-pod placement shows its own future radius
    if (g.type === 'fluxPod') this.drawFluxRing(ctx, g.x, g.y, 0.5);
  }

  /** invalid-placement reason tag — drawn in SCREEN space (constant size, crisp) */
  private drawGhostReason(ctx: Ctx): void {
    const g = this.ghost;
    if (!g || g.valid || !g.reason) return;
    const [wx, wy] = Camera.tileToWorld(g.x, g.y);
    const [sx, sy] = this.camera.worldToScreen(wx, wy + HALF_H);
    ctx.save();
    ctx.font = '600 11px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = g.reason.toUpperCase();
    const w = ctx.measureText(label).width + 24;
    ctx.fillStyle = 'rgba(13,20,26,0.92)';
    ctx.strokeStyle = alpha(UI.warn, 0.8);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(sx - w / 2, sy + 10, w, 22, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = UI.warn;
    ctx.fillText(label, sx, sy + 21, w - 12);
    ctx.restore();
  }

  private drawFog(ctx: Ctx, fogColor: string, t: number): void {
    const w = this.camera.viewW, h = this.camera.viewH;
    ctx.save();
    for (let band = 0; band < 2; band++) {
      const speed = band === 0 ? 14 : -9;
      const yBase = h * (band === 0 ? 0.32 : 0.68);
      const amp = 30 + band * 18;
      ctx.beginPath();
      ctx.moveTo(0, yBase);
      for (let x = 0; x <= w; x += 40) {
        const ph = (x + t * speed * 4) * 0.012 + band * 3;
        ctx.lineTo(x, yBase + Math.sin(ph) * amp);
      }
      ctx.lineTo(w, yBase + 130);
      ctx.lineTo(0, yBase + 130);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, yBase - amp, 0, yBase + 130);
      g.addColorStop(0, alpha(fogColor, 0));
      g.addColorStop(0.45, alpha(fogColor, band === 0 ? 0.07 : 0.09));
      g.addColorStop(1, alpha(fogColor, 0));
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.restore();
  }

  dispose(): void {
    this.camera.detach();
    this.chunks.clear();
  }
}

// ---------------------------------------------------------------- ghost tinting

function ghostSprite(type: BuildingType, valid: boolean): Sprite {
  const base = buildingSprite(type, {});
  return sprite(`ghost|${type}|${valid ? 'v' : 'i'}`, base.w, base.h, base.ax, base.ay, (ctx) => {
    ctx.drawImage(base.canvas, -base.ax, -base.ay, base.w, base.h);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = alpha(valid ? UI.ok : UI.warn, 0.38);
    ctx.fillRect(-base.ax, -base.ay, base.w, base.h);
  });
}
