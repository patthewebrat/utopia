// Panel manager — single docked glass panel at a time; opening pauses the sim,
// closing restores the previous pause state (GAME_SPEC: every secondary screen
// auto-pauses). Individual panels live in ./panels/*.

import * as engine from '../engine';
import type { UIContext } from './context';
import { el, button } from './dom';
import { icon } from './icons';

export interface PanelHandle {
  id: string;
  refresh(): void;
  close(): void;
}

interface OpenPanel {
  id: string;
  root: HTMLElement;
  body: HTMLElement;
  render: (body: HTMLElement, refresh: () => void) => void;
  restorePaused: boolean;
}

let current: OpenPanel | null = null;
let layer: HTMLElement | null = null;
let dimEl: HTMLElement | null = null;

export function initPanelLayer(uiRoot: HTMLElement): void {
  dimEl = el('div', 'u-world-dim');
  dimEl.style.display = 'none';
  uiRoot.appendChild(dimEl);
  layer = el('div', 'u-panel-layer');
  uiRoot.appendChild(layer);
}

export function currentPanelId(): string | null { return current?.id ?? null; }

export function closePanel(ctx: UIContext): void {
  if (!current) return;
  const c = current;
  current = null;
  c.root.remove();
  if (dimEl) dimEl.style.display = 'none';
  engine.setPaused(ctx.getState(), c.restorePaused);
}

export function refreshPanel(): void {
  if (!current) return;
  const c = current;
  c.body.replaceChildren();
  c.render(c.body, refreshPanel);
}

export interface PanelOpts {
  id: string;
  title: string;
  /** css width class: 'narrow' | 'wide' | 'full' (default mid) */
  size?: 'narrow' | 'mid' | 'wide' | 'full';
  render(body: HTMLElement, refresh: () => void): void;
}

export function openPanel(ctx: UIContext, opts: PanelOpts): PanelHandle {
  // toggling: clicking the same panel's button closes it
  if (current && current.id === opts.id) {
    closePanel(ctx);
    return { id: opts.id, refresh: () => {}, close: () => {} };
  }
  const state = ctx.getState();
  const restorePaused = current ? current.restorePaused : state.paused;
  if (current) { current.root.remove(); current = null; }
  engine.setPaused(state, true);
  if (dimEl) dimEl.style.display = 'block';

  const root = el('div', `u-panel u-panel--${opts.size ?? 'mid'}`);
  const head = el('div', 'u-panel-head');
  head.appendChild(el('h2', 'u-panel-title', opts.title));
  const pausedTag = el('span', 'u-paused-tag', 'SIM PAUSED');
  head.appendChild(pausedTag);
  const closeBtn = button('u-panel-close', '', () => closePanel(ctx));
  closeBtn.appendChild(icon('close'));
  closeBtn.title = 'Close (Esc)';
  head.appendChild(closeBtn);
  root.appendChild(head);
  const body = el('div', 'u-panel-body');
  root.appendChild(body);
  layer?.appendChild(root);

  current = { id: opts.id, root, body, render: opts.render, restorePaused };
  opts.render(body, refreshPanel);
  return {
    id: opts.id,
    refresh: refreshPanel,
    close: () => closePanel(ctx),
  };
}

// ---------------------------------------------------------------- toasts

let toastLayer: HTMLElement | null = null;

export function initToasts(uiRoot: HTMLElement): void {
  toastLayer = el('div', 'u-toast-layer');
  uiRoot.appendChild(toastLayer);
}

export function toast(kind: string, text: string, onClick?: () => void): void {
  if (!toastLayer) return;
  const t = el('div', `u-toast u-toast--${kind}`);
  t.appendChild(el('span', 'u-toast-text', text));
  if (onClick) {
    t.classList.add('u-toast--click');
    t.addEventListener('click', () => { onClick(); t.remove(); });
  }
  toastLayer.appendChild(t);
  while (toastLayer.children.length > 4) toastLayer.firstElementChild?.remove();
  window.setTimeout(() => {
    t.classList.add('u-toast--out');
    window.setTimeout(() => t.remove(), 400);
  }, 5200);
}
