// Modals — scenario briefing, invention announcement, medal ceremony, game over,
// generic confirm. Modals sit above panels and also pause the sim.

import * as engine from '../engine';
import type { ScenarioDef } from '../types';
import type { UIContext } from './context';
import { el, button, elHtml } from './dom';
import { icon } from './icons';

let modalLayer: HTMLElement | null = null;

export function initModalLayer(uiRoot: HTMLElement): void {
  modalLayer = el('div', 'u-modal-layer');
  modalLayer.style.display = 'none';
  uiRoot.appendChild(modalLayer);
}

interface ModalOpts {
  cls?: string;
  title: string;
  body: (wrap: HTMLElement) => void;
  buttons: { label: string; cls?: string; fn?: () => void }[];
}

function openModal(ctx: UIContext, opts: ModalOpts): void {
  if (!modalLayer) return;
  const state = ctx.getState();
  const restorePaused = state.paused;
  engine.setPaused(state, true);
  modalLayer.style.display = '';
  const box = el('div', `u-modal ${opts.cls ?? ''}`);
  box.appendChild(el('h2', 'u-modal-title', opts.title));
  const bodyEl = el('div', 'u-modal-body');
  opts.body(bodyEl);
  box.appendChild(bodyEl);
  const btns = el('div', 'u-modal-btns');
  for (const b of opts.buttons) {
    btns.appendChild(button(`u-btn ${b.cls ?? ''}`, b.label, () => {
      box.remove();
      if (modalLayer && modalLayer.children.length === 0) {
        modalLayer.style.display = 'none';
        engine.setPaused(ctx.getState(), restorePaused);
      }
      b.fn?.();
    }));
  }
  box.appendChild(btns);
  modalLayer.appendChild(box);
}

export function confirmModal(ctx: UIContext, title: string, text: string, onYes: () => void): void {
  openModal(ctx, {
    title,
    body: (w) => w.appendChild(el('p', 'u-modal-text', text)),
    buttons: [
      { label: 'CANCEL', cls: 'u-btn--ghost' },
      { label: 'CONFIRM', cls: 'u-btn--danger', fn: onYes },
    ],
  });
}

export function showBriefing(ctx: UIContext, scenario: ScenarioDef): void {
  openModal(ctx, {
    cls: 'u-modal--briefing',
    title: scenario.sandbox ? 'POSTING: QUICK-START' : `POSTING: THE ${scenario.name.toUpperCase()}`,
    body: (w) => {
      w.appendChild(el('div', 'u-brief-meta mono',
        `WORLD: ${scenario.biomeLabel.toUpperCase()} · SEED FUNDS: ${scenario.funds.toLocaleString()} GR` +
        (scenario.sandbox ? '' : ` · THREAT ${scenario.difficulty}/10`)));
      w.appendChild(el('p', 'u-modal-text', scenario.briefing));
      w.appendChild(el('p', 'u-modal-text u-hint',
        'Earth expects a Quality of Life of 80% sustained for a year. Deliver it, Commander.'));
    },
    buttons: [{ label: 'BEGIN COLONISATION' }],
  });
}

export function showInvention(ctx: UIContext, inventionId: string, techLevel: number): void {
  const inv = engine.INVENTIONS.find((i) => i.id === inventionId);
  if (!inv) return;
  openModal(ctx, {
    cls: 'u-modal--invention',
    title: 'BREAKTHROUGH',
    body: (w) => {
      const head = el('div', 'u-inv-banner');
      head.appendChild(icon('research', 'u-inv-banner-icon'));
      head.appendChild(el('span', 'u-inv-banner-name', inv.name));
      w.appendChild(head);
      w.appendChild(el('p', 'u-modal-text', inv.description));
      w.appendChild(el('p', 'mono u-violet u-center', `TECH LEVEL ${techLevel}`));
    },
    buttons: [{ label: 'EXCELLENT' }],
  });
}

export function showMedal(ctx: UIContext, medal: 'bronze' | 'gold'): void {
  openModal(ctx, {
    cls: `u-modal--medal u-modal--medal-${medal}`,
    title: medal === 'gold' ? 'GOLD MEDAL OF UTOPIA' : 'BRONZE MEDAL OF MERIT',
    body: (w) => {
      const m = elHtml('div', `u-medal-art u-medal-art--${medal}`, '');
      m.appendChild(icon('medal'));
      w.appendChild(m);
      w.appendChild(el('p', 'u-modal-text u-center', medal === 'gold'
        ? 'Quality of Life above 90% for a full year. Your colony is spoken of on Earth as Utopia itself. There is no higher honour, Commander.'
        : 'Quality of Life above 80% for a full year. Earth recognises your colony as a triumph — the Gold Medal awaits at 90%.'));
    },
    buttons: [{ label: 'FOR THE COLONY' }],
  });
}

export function showGameOver(ctx: UIContext, victory: boolean, reason: string): void {
  openModal(ctx, {
    cls: victory ? 'u-modal--victory' : 'u-modal--gameover',
    title: victory ? 'THE ENEMY CITY HAS FALLEN' : 'COLONY LOST',
    body: (w) => {
      w.appendChild(el('p', 'u-modal-text', reason));
      if (!victory) {
        const s = ctx.getState();
        w.appendChild(el('p', 'u-modal-text u-hint mono',
          `FINAL QoL ${Math.round(s.qol)}% · POPULATION ${engine.populationOf(s)} · ` +
          `BATTLES ${s.stats.battlesWon}W/${s.stats.battlesLost}L`));
      }
    },
    buttons: victory
      ? [{ label: 'CONTINUE BUILDING' }]
      : [{ label: 'ACKNOWLEDGED', cls: 'u-btn--danger' }],
  });
}
