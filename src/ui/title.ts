// Title screen — animated starfield + planet limb canvas, UTOPIA wordmark,
// menu (Quick Start / Scenarios 1–10 / Load Game), credit line.

import * as engine from '../engine';
import { el, button } from './dom';

export interface TitleHandle { destroy(): void; }

export function mountTitle(
  uiRoot: HTMLElement,
  opts: { onStart(scenarioId: string): void; onLoad(): void },
): TitleHandle {
  const root = el('div', 'u-title');
  uiRoot.appendChild(root);

  // ---------------------------------------------------------- backdrop canvas
  const canvas = document.createElement('canvas');
  canvas.className = 'u-title-canvas';
  root.appendChild(canvas);
  const g = canvas.getContext('2d')!;

  interface Star { x: number; y: number; r: number; a: number; sp: number; }
  const layers: Star[][] = [[], [], []];
  function seedStars(): void {
    const w = canvas.width, h = canvas.height;
    const counts = [200, 120, 60];
    layers.forEach((arr, li) => {
      arr.length = 0;
      for (let i = 0; i < counts[li]; i++) {
        arr.push({
          x: Math.random() * w, y: Math.random() * h,
          r: 0.5 + li * 0.5 + Math.random() * 0.6,
          a: 0.25 + Math.random() * 0.6,
          sp: (li + 1) * 2.2,
        });
      }
    });
  }
  const planets = [
    ['#4E7A3C', '#1C331B'], ['#3A3034', '#FF5A1F'], ['#C9A86B', '#6E5430'],
    ['#C7D9EE', '#4E6B96'], ['#8C3038', '#38121A'], ['#4A4A50', '#1A1A1E'],
  ];
  const planet = planets[Math.floor(Math.random() * planets.length)];

  let raf = 0;
  let t0 = performance.now();
  function frame(now: number): void {
    const dt = Math.min(0.1, (now - t0) / 1000); t0 = now;
    const w = canvas.width, h = canvas.height;
    g.fillStyle = '#070B0E'; g.fillRect(0, 0, w, h);
    layers.forEach((arr) => {
      for (const st of arr) {
        st.x -= st.sp * dt;
        if (st.x < 0) { st.x = w; st.y = Math.random() * h; }
        g.globalAlpha = st.a;
        g.fillStyle = '#D8E6EA';
        g.fillRect(st.x, st.y, st.r, st.r);
      }
    });
    g.globalAlpha = 1;
    // planet limb at the bottom
    const R = w * 0.75;
    const cy = h + R * 0.82;
    const grad = g.createRadialGradient(w / 2 - R * 0.3, cy - R * 0.4, R * 0.2, w / 2, cy, R);
    grad.addColorStop(0, planet[0]); grad.addColorStop(1, planet[1]);
    g.fillStyle = grad;
    g.beginPath(); g.arc(w / 2, cy, R, 0, Math.PI * 2); g.fill();
    // atmosphere arc
    g.strokeStyle = 'rgba(55,224,242,0.35)'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(w / 2, cy, R + 2, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    g.strokeStyle = 'rgba(95,242,220,0.12)'; g.lineWidth = 10;
    g.beginPath(); g.arc(w / 2, cy, R + 7, Math.PI * 1.2, Math.PI * 1.8); g.stroke();
    raf = requestAnimationFrame(frame);
  }
  function resize(): void {
    canvas.width = root.clientWidth;
    canvas.height = root.clientHeight;
    seedStars();
  }
  window.addEventListener('resize', resize);

  // ---------------------------------------------------------- foreground DOM
  const fg = el('div', 'u-title-fg');
  root.appendChild(fg);
  fg.appendChild(el('h1', 'u-wordmark', 'UTOPIA'));
  fg.appendChild(el('div', 'u-wordmark-sub mono', 'THE CREATION OF A NATION'));

  const menu = el('div', 'u-title-menu');
  fg.appendChild(menu);

  let scenarioView = false;
  function renderMenu(): void {
    menu.replaceChildren();
    if (!scenarioView) {
      menu.appendChild(button('u-title-btn', 'QUICK START — SANDBOX', () => opts.onStart('quickstart')));
      menu.appendChild(button('u-title-btn', 'SCENARIOS 1–10', () => { scenarioView = true; renderMenu(); }));
      menu.appendChild(button('u-title-btn', 'LOAD COLONY…', () => opts.onLoad()));
    } else {
      const list = el('div', 'u-title-scen');
      for (const sc of engine.SCENARIOS) {
        if (sc.sandbox) continue;
        const b = button('u-title-scen-btn', '', () => opts.onStart(sc.id));
        b.appendChild(el('span', 'u-title-scen-num mono', String(sc.difficulty).padStart(2, '0')));
        b.appendChild(el('span', 'u-title-scen-name', sc.name));
        b.appendChild(el('span', 'u-title-scen-bio', sc.biomeLabel));
        const diff = el('span', 'u-title-scen-diff');
        for (let i = 0; i < 10; i++) {
          const pip = el('span', `u-diff-pip${i < sc.difficulty ? ' u-diff-pip--on' : ''}`);
          diff.appendChild(pip);
        }
        b.appendChild(diff);
        b.title = sc.briefing;
        list.appendChild(b);
      }
      menu.appendChild(list);
      menu.appendChild(button('u-title-btn u-title-btn--back', '← BACK', () => { scenarioView = false; renderMenu(); }));
    }
  }
  renderMenu();

  fg.appendChild(el('div', 'u-title-credit',
    'Inspired by the 1991 Gremlin Graphics classic by Graeme Ing · A from-scratch tribute'));

  // kick off after layout
  requestAnimationFrame(() => { resize(); raf = requestAnimationFrame(frame); });

  return {
    destroy(): void {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      root.remove();
    },
  };
}
