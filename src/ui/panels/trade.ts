// Trade panel — autotrade retain sliders + manual trade basket (once per month) + dumping.

import * as engine from '../../engine';
import type { Commodity, GameState } from '../../types';
import type { UIContext } from '../context';
import { el, button, fmtNum, fmtGR } from '../dom';
import { openPanel, toast } from '../panels';

const COMMODITIES: { c: Commodity; label: string }[] = [
  { c: 'fuel', label: 'FUEL' }, { c: 'food', label: 'FOOD' }, { c: 'ore', label: 'ORE' },
  { c: 'gems', label: 'GEMS' }, { c: 'weapons', label: 'WEAPONS' }, { c: 'techGoods', label: 'TECH GOODS' },
];

function stockOf(s: GameState, c: Commodity): number {
  if (c === 'fuel') return Math.floor(s.fuelStored);
  return s.stores[c];
}

export function openTrade(ctx: UIContext): void {
  // basket survives refresh within one open
  const basket: Partial<Record<Commodity, number>> = {};
  openPanel(ctx, {
    id: 'trade',
    title: 'Galactic Trade',
    size: 'wide',
    render(body, refresh) {
      const s = ctx.getState();
      const locked = s.trade.tradedThisMonth;
      const hasCC = s.buildings.some((b) => b.type === 'commandCentre' && b.status === 'complete' && b.powered);

      if (!hasCC) body.appendChild(el('p', 'u-hint u-neg', 'Manual trade requires an active powered Command Centre.'));
      if (locked) body.appendChild(el('p', 'u-hint u-amber', 'Manual trade already executed this month — new prices on the 1st.'));

      const table = el('table', 'u-table');
      const hr = el('tr');
      for (const h of ['COMMODITY', 'AVAIL', 'PRICE', 'SUPPLY', 'DEMAND', 'ORDER (+buy / −sell)', 'COST', 'DUMP', 'RETAIN %']) {
        hr.appendChild(el('th', '', h));
      }
      const thead = el('thead'); thead.appendChild(hr); table.appendChild(thead);
      const tbody = el('tbody');

      const costEls = new Map<Commodity, HTMLElement>();
      const totalEl = el('span', 'mono u-amber', '0 GR');

      function recalc(): void {
        let total = 0;
        for (const { c } of COMMODITIES) {
          const q = basket[c] ?? 0;
          const cost = q * s.trade.prices[c];
          total += cost;
          const elc = costEls.get(c);
          if (elc) {
            elc.textContent = q === 0 ? '—' : `${cost > 0 ? '−' : '+'}${fmtNum(Math.abs(cost))}`;
            elc.className = `mono ${q === 0 ? '' : cost > 0 ? 'u-neg' : 'u-pos'}`;
          }
        }
        totalEl.textContent = total === 0 ? '0 GR' : `${total > 0 ? '−' : '+'}${fmtNum(Math.abs(total))} GR`;
        totalEl.className = `mono ${total > 0 ? 'u-neg' : total < 0 ? 'u-pos' : 'u-amber'}`;
      }

      for (const { c, label } of COMMODITIES) {
        const tr = el('tr');
        tr.appendChild(el('td', '', label));
        tr.appendChild(el('td', 'mono', fmtNum(stockOf(s, c))));
        tr.appendChild(el('td', 'mono u-amber', fmtNum(s.trade.prices[c])));
        tr.appendChild(el('td', 'mono', fmtNum(s.trade.supply[c])));
        tr.appendChild(el('td', 'mono', fmtNum(s.trade.demand[c])));

        const orderTd = el('td');
        const input = el('input') as HTMLInputElement;
        input.type = 'number'; input.className = 'u-input mono';
        input.value = String(basket[c] ?? 0);
        input.min = String(-Math.min(s.trade.demand[c], stockOf(s, c)));
        input.max = String(s.trade.supply[c]);
        input.disabled = locked || !hasCC;
        input.addEventListener('input', () => {
          basket[c] = Math.round(Number(input.value) || 0);
          recalc();
        });
        orderTd.appendChild(input);
        tr.appendChild(orderTd);

        const costTd = el('td', 'mono', '—');
        costEls.set(c, costTd);
        tr.appendChild(costTd);

        const dumpTd = el('td');
        dumpTd.appendChild(button('u-btn u-btn--small u-btn--ghost', 'DUMP', () => {
          const amt = Math.abs(basket[c] ?? 0) || 10;
          engine.dumpCommodity(s, c, amt);
          toast('info', `Dumped ${amt} ${label.toLowerCase()}.`);
          refresh();
        }));
        tr.appendChild(dumpTd);

        const retainTd = el('td', 'u-retain-td');
        const slider = el('input') as HTMLInputElement;
        slider.type = 'range'; slider.min = '0'; slider.max = '100';
        slider.value = String(s.trade.retain[c]);
        const rv = el('span', 'mono u-retain-val', `${s.trade.retain[c]}%`);
        slider.addEventListener('input', () => {
          engine.setRetain(s, c, Number(slider.value));
          rv.textContent = `${slider.value}%`;
        });
        retainTd.append(slider, rv);
        tr.appendChild(retainTd);
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      body.appendChild(table);
      recalc();

      const foot = el('div', 'u-trade-foot');
      const totWrap = el('span', 'u-ctl-label', 'ORDER TOTAL  ');
      totWrap.appendChild(totalEl);
      foot.appendChild(totWrap);
      const exec = button(`u-btn${locked || !hasCC ? ' u-disabled' : ''}`, 'EXECUTE TRADE', () => {
        if (locked || !hasCC) return;
        const order: Partial<Record<Commodity, number>> = {};
        for (const { c } of COMMODITIES) if (basket[c]) order[c] = basket[c];
        if (Object.keys(order).length === 0) { toast('warning', 'Empty order.'); return; }
        const e = engine.manualTrade(s, order);
        if (e) toast('warning', e);
        else { toast('info', 'Trade executed.'); for (const { c } of COMMODITIES) basket[c] = 0; }
        refresh();
      });
      foot.appendChild(exec);
      body.appendChild(foot);

      body.appendChild(el('p', 'u-hint',
        `Treasury ${fmtGR(s.funds)}. One manual trade per calendar month. ` +
        'RETAIN sets the share of each stock the autotrader keeps at month end; the rest is sold automatically when demand exists.'));
    },
  });
}
