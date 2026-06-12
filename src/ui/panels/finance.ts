// Finance panel — monthly + year-to-date ledger, tax slider (applies 1 Jan), grants.

import * as engine from '../../engine';
import type { GameState } from '../../types';
import type { UIContext } from '../context';
import { el, button, fmtGR, fmtNum, sliderRow } from '../dom';
import { openPanel, toast } from '../panels';

type Ledger = GameState['finance']['lastMonth'];

// year-to-date accumulator (UI-side; resets each January)
const ytd: Ledger = blank();
let lastSeenMonth = -1;
function blank(): Ledger {
  return { taxIncome: 0, supportGrant: 0, tradeNet: 0, researchSpend: 0, spyBurn: 0, birthBonus: 0, constructionSpend: 0 };
}
export function initFinanceTracker(getState: () => GameState): void {
  engine.events.on('month', () => {
    const s = getState();
    if (s.month === 1) Object.assign(ytd, blank());
    const lm = s.finance.lastMonth;
    ytd.taxIncome += lm.taxIncome; ytd.supportGrant += lm.supportGrant;
    ytd.tradeNet += lm.tradeNet; ytd.researchSpend += lm.researchSpend;
    ytd.spyBurn += lm.spyBurn; ytd.birthBonus += lm.birthBonus;
    ytd.constructionSpend += lm.constructionSpend;
    lastSeenMonth = s.monthIndex;
  });
}

function ledgerTable(title: string, led: Ledger): HTMLElement {
  const wrap = el('div', 'u-ledger');
  wrap.appendChild(el('h4', 'u-sect-title', title));
  const t = el('table', 'u-table u-table--ledger');
  const row = (k: string, v: number, isIncome: boolean): void => {
    const tr = el('tr');
    tr.appendChild(el('td', '', k));
    const cls = v === 0 ? '' : isIncome ? 'u-pos' : 'u-neg';
    tr.appendChild(el('td', `mono u-right ${cls}`, v === 0 ? '—' : `${isIncome ? '+' : '−'}${fmtNum(Math.abs(v))}`));
    t.appendChild(tr);
  };
  row('Income tax', led.taxIncome, true);
  row('Colony Support Grant', led.supportGrant, true);
  row('Birth bonus (Earth)', led.birthBonus, true);
  row(led.tradeNet >= 0 ? 'Trade surplus' : 'Trade deficit', Math.abs(led.tradeNet), led.tradeNet >= 0);
  row('Research funding', led.researchSpend, false);
  row('Intelligence operations', led.spyBurn, false);
  row('Construction', led.constructionSpend, false);
  const net = led.taxIncome + led.supportGrant + led.birthBonus + led.tradeNet
    - led.researchSpend - led.spyBurn - led.constructionSpend;
  const tr = el('tr', 'u-ledger-net');
  tr.appendChild(el('td', '', 'NET'));
  tr.appendChild(el('td', `mono u-right ${net >= 0 ? 'u-pos' : 'u-neg'}`, `${net >= 0 ? '+' : '−'}${fmtNum(Math.abs(net))}`));
  t.appendChild(tr);
  wrap.appendChild(t);
  return wrap;
}

export function openFinance(ctx: UIContext): void {
  openPanel(ctx, {
    id: 'finance',
    title: 'Finance',
    size: 'wide',
    render(body, refresh) {
      const s = ctx.getState();
      void lastSeenMonth;

      const strip = el('div', 'u-stat-strip');
      const stat = (label: string, v: string, cls = ''): void => {
        const d = el('div', 'u-stat');
        d.appendChild(el('span', 'u-stat-label', label));
        d.appendChild(el('span', `u-stat-val mono ${cls}`, v));
        strip.appendChild(d);
      };
      stat('TREASURY', fmtGR(s.funds), s.funds < 0 ? 'u-neg' : 'u-amber');
      stat('TAX RATE', `${s.finance.taxRate}%`);
      stat('POPULATION', fmtNum(engine.populationOf(s)));
      body.appendChild(strip);

      const cols = el('div', 'u-cols');
      cols.appendChild(ledgerTable('LAST MONTH', s.finance.lastMonth));
      cols.appendChild(ledgerTable('YEAR TO DATE', ytd));
      body.appendChild(cols);

      // tax
      const taxSect = el('div', 'u-binfo-sect');
      taxSect.appendChild(el('h4', 'u-sect-title', 'Income Tax'));
      taxSect.appendChild(sliderRow('RATE', 0, 20, s.finance.pendingTaxRate, '%', (v) => {
        engine.setTax(s, v);
      }));
      taxSect.appendChild(el('p', 'u-hint',
        `Current rate ${s.finance.taxRate}% — the new rate locks in on 1 January` +
        (s.finance.pendingTaxRate !== s.finance.taxRate ? ` (pending: ${s.finance.pendingTaxRate}%)` : '') +
        '. High tax erodes morale and Quality of Life.'));
      body.appendChild(taxSect);

      // grants
      const gSect = el('div', 'u-binfo-sect');
      gSect.appendChild(el('h4', 'u-sect-title', 'Grants (cumulative — add from treasury)'));
      const grants: { key: 'military' | 'civilian' | 'intelligence'; label: string; note: string }[] = [
        { key: 'military', label: 'MILITARY RESEARCH', note: 'funds weapon-tech inventions' },
        { key: 'civilian', label: 'CIVILIAN RESEARCH', note: 'funds civic inventions; lifts Environment QoL' },
        { key: 'intelligence', label: 'INTELLIGENCE', note: 'funds spy operations (see Spy panel)' },
      ];
      for (const gr of grants) {
        const row = el('div', 'u-ctl-row');
        const lab = el('span', 'u-ctl-label', `${gr.label} — balance `);
        lab.appendChild(el('span', 'mono u-amber', fmtNum(s.finance.grants[gr.key])));
        lab.appendChild(el('span', 'u-hint-inline', ` ${gr.note}`));
        row.appendChild(lab);
        const group = el('span', 'u-btn-group');
        for (const amt of [500, 2000, 10000]) {
          group.appendChild(button('u-btn u-btn--small', `+${fmtNum(amt)}`, () => {
            const e = engine.addGrant(s, gr.key, amt);
            if (e) toast('warning', e);
            refresh();
          }));
        }
        row.appendChild(group);
        gSect.appendChild(row);
      }
      body.appendChild(gSect);
    },
  });
}
