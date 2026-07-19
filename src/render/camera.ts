// Camera — pan (middle/right drag + WASD/arrows + edge scroll), wheel zoom
// 0.25–4x toward the cursor, smooth interpolation, world<->screen transforms.
// World space = isometric pixels at zoom 1 (tile 64×32); the camera centre
// (x, y) is the world point at the middle of the viewport.

import { HALF_W, HALF_H } from '../art/iso';

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;
const SMOOTH = 12;          // lerp rate (1/s)
const KEY_PAN = 900;        // world px/s at zoom 1
const EDGE_PX = 18;         // edge-scroll trigger band
const EDGE_PAN = 700;

export class Camera {
  x = 0; y = 0; zoom = 1;
  private tx = 0; private ty = 0; private tzoom = 1;

  viewW = 1; viewH = 1;       // CSS px
  dpr = 1;

  private canvas: HTMLCanvasElement;
  private keys = new Set<string>();
  private dragging = false;
  private dragLastX = 0; private dragLastY = 0;
  /** last known pointer position (CSS px, canvas-relative); -1 = outside */
  mouseX = -1; mouseY = -1;
  /** edge scrolling can be disabled (e.g. while a panel is open) */
  edgeScroll = true;
  keyPan = true;

  private boundsMinX = -1e9; private boundsMaxX = 1e9;
  private boundsMinY = -1e9; private boundsMaxY = 1e9;

  /** UI chrome insets (CSS px). The top status strip and the right icon rail are
   *  painted over the canvas and swallow pointer events, so an edge band tucked
   *  underneath them can never be reached. Start those bands below/inside the
   *  chrome instead. Kept in sync with --top-h / --rail-w in resize(). */
  private insetTop = 0;
  private insetRight = 0;

  private detachFns: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.resize();
  }

  // ---------------------------------------------------------------- transforms

  worldToScreen(wx: number, wy: number): [number, number] {
    return [
      (wx - this.x) * this.zoom + this.viewW / 2,
      (wy - this.y) * this.zoom + this.viewH / 2,
    ];
  }

  screenToWorld(sx: number, sy: number): [number, number] {
    return [
      (sx - this.viewW / 2) / this.zoom + this.x,
      (sy - this.viewH / 2) / this.zoom + this.y,
    ];
  }

  /** tile centre → world px */
  static tileToWorld(tx: number, ty: number): [number, number] {
    return [(tx - ty) * HALF_W, (tx + ty) * HALF_H];
  }

  /** world px → fractional tile coords */
  static worldToTile(wx: number, wy: number): [number, number] {
    return [wy / (2 * HALF_H) + wx / (2 * HALF_W), wy / (2 * HALF_H) - wx / (2 * HALF_W)];
  }

  /** screen px → integer tile under the cursor */
  screenToTile(sx: number, sy: number): [number, number] {
    const [wx, wy] = this.screenToWorld(sx, sy);
    const [tx, ty] = Camera.worldToTile(wx, wy);
    return [Math.floor(tx + 0.5), Math.floor(ty + 0.5)];
  }

  /** world-px rectangle currently visible (for culling) */
  visibleWorldRect(): { x0: number; y0: number; x1: number; y1: number } {
    const [x0, y0] = this.screenToWorld(0, 0);
    const [x1, y1] = this.screenToWorld(this.viewW, this.viewH);
    return { x0, y0, x1, y1 };
  }

  // ---------------------------------------------------------------- control

  centreOnTile(tx: number, ty: number, zoom?: number): void {
    const [wx, wy] = Camera.tileToWorld(tx, ty);
    this.x = this.tx = wx;
    this.y = this.ty = wy;
    if (zoom !== undefined) this.zoom = this.tzoom = clampZoom(zoom);
  }

  panToTile(tx: number, ty: number): void {
    const [wx, wy] = Camera.tileToWorld(tx, ty);
    this.tx = wx;
    this.ty = wy;
  }

  setZoom(z: number): void { this.tzoom = clampZoom(z); }

  /** clamp the camera centre to the map's iso bounding diamond (+margin) */
  setMapBounds(mapW: number, mapH: number): void {
    const m = 160;
    this.boundsMinX = (0 - mapH) * HALF_W - m;
    this.boundsMaxX = mapW * HALF_W + m;
    // symmetric headroom: the top strip hides ~40px of world, so give the north
    // edge the same slack the south edge already had
    this.boundsMinY = -m - 150;
    this.boundsMaxY = (mapW + mapH) * HALF_H + m + 150;
  }

  resize(): void {
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    const cs = getComputedStyle(document.documentElement);
    this.insetTop = parseFloat(cs.getPropertyValue('--top-h')) || 0;
    this.insetRight = parseFloat(cs.getPropertyValue('--rail-w')) || 0;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.viewW = w;
    this.viewH = h;
    const bw = Math.round(w * this.dpr), bh = Math.round(h * this.dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
  }

  /** advance smoothing + keyboard/edge pan. dt = real seconds. */
  update(dt: number): void {
    // keyboard pan
    if (this.keyPan) {
      let dx = 0, dy = 0;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dy -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dy += 1;
      if (dx || dy) {
        const n = Math.hypot(dx, dy);
        this.tx += (dx / n) * KEY_PAN * dt / this.zoom;
        this.ty += (dy / n) * KEY_PAN * dt / this.zoom;
      }
    }
    // edge scroll (only when pointer is over the canvas and not dragging)
    if (this.edgeScroll && !this.dragging && this.mouseX >= 0 && document.hasFocus()) {
      let ex = 0, ey = 0;
      if (this.mouseX < EDGE_PX) ex = -1;
      else if (this.mouseX > this.viewW - this.insetRight - EDGE_PX) ex = 1;
      if (this.mouseY < this.insetTop + EDGE_PX) ey = -1;
      else if (this.mouseY > this.viewH - EDGE_PX) ey = 1;
      if (ex || ey) {
        this.tx += ex * EDGE_PAN * dt / this.zoom;
        this.ty += ey * EDGE_PAN * dt / this.zoom;
      }
    }
    // clamp targets
    this.tx = Math.max(this.boundsMinX, Math.min(this.boundsMaxX, this.tx));
    this.ty = Math.max(this.boundsMinY, Math.min(this.boundsMaxY, this.ty));
    // smooth interpolation toward targets
    const k = 1 - Math.exp(-SMOOTH * dt);
    this.x += (this.tx - this.x) * k;
    this.y += (this.ty - this.y) * k;
    this.zoom += (this.tzoom - this.zoom) * k;
    if (Math.abs(this.zoom - this.tzoom) < 0.0005) this.zoom = this.tzoom;
  }

  // ---------------------------------------------------------------- input

  attach(): void {
    const c = this.canvas;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const on = (el: HTMLElement | Window, ev: string, fn: (e: any) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(ev, fn as EventListener, opts);
      this.detachFns.push(() => el.removeEventListener(ev, fn as EventListener, opts));
    };

    on(c, 'wheel', (e: WheelEvent) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0016);
      const nz = clampZoom(this.tzoom * factor);
      // keep the world point under the cursor fixed (computed against targets)
      const wx = (mx - this.viewW / 2) / this.tzoom + this.tx;
      const wy = (my - this.viewH / 2) / this.tzoom + this.ty;
      this.tx = wx - (mx - this.viewW / 2) / nz;
      this.ty = wy - (my - this.viewH / 2) / nz;
      this.tzoom = nz;
    }, { passive: false });

    on(c, 'pointerdown', (e: PointerEvent) => {
      if (e.button === 1 || e.button === 2) {
        this.dragging = true;
        this.dragLastX = e.clientX;
        this.dragLastY = e.clientY;
        c.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    });
    on(c, 'pointermove', (e: PointerEvent) => {
      const rect = c.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
      if (this.dragging) {
        const dx = e.clientX - this.dragLastX;
        const dy = e.clientY - this.dragLastY;
        this.dragLastX = e.clientX;
        this.dragLastY = e.clientY;
        this.x -= dx / this.zoom;
        this.y -= dy / this.zoom;
        this.tx = this.x;
        this.ty = this.y;
      }
    });
    const endDrag = (e: PointerEvent) => {
      if (this.dragging && (e.button === 1 || e.button === 2)) {
        this.dragging = false;
        try { c.releasePointerCapture(e.pointerId); } catch { /* released */ }
      }
    };
    on(c, 'pointerup', endDrag);
    on(c, 'pointercancel', (e: PointerEvent) => { this.dragging = false; void e; });
    on(c, 'pointerleave', () => { this.mouseX = -1; this.mouseY = -1; });
    on(c, 'contextmenu', (e: Event) => e.preventDefault());

    const kd = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      this.keys.add(e.code);
    };
    const ku = (e: KeyboardEvent) => this.keys.delete(e.code);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    const blur = () => this.keys.clear();
    window.addEventListener('blur', blur);
    this.detachFns.push(() => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
    });

    const rs = () => this.resize();
    window.addEventListener('resize', rs);
    this.detachFns.push(() => window.removeEventListener('resize', rs));
  }

  detach(): void {
    for (const fn of this.detachFns.splice(0)) fn();
  }
}

function clampZoom(z: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}
