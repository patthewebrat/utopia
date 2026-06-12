// Advisers screen — six procedural portraits; click (or F1–F6) opens a report.

import * as engine from '../../engine';
import type { GameState, UnitKind } from '../../types';
import type { UIContext } from '../context';
import { el, button, elHtml, fmtNum, fmtGR, fmtPct } from '../dom';
import { openPanel } from '../panels';
import { ADVISERS, portraitSvg, type AdviserId } from '../portraits';

export function openAdvisers(ctx: UIContext, direct?: AdviserId): void {
  let selected: AdviserId | null = direct ?? null;
  openPanel(ctx, {
    id: 'advisers',
    title: 'Adviser Council',
    size: 'wide',
    render(body, refresh) {
      const s = ctx.getState();
      if (!selected) {
        const grid = el('div', 'u-adviser-grid');
        for (const a of ADVISERS) {
          const card = el('div', 'u-adviser-card');
          card.appendChild(elHtml('div', 'u-portrait', portraitSvg(a.id)));
          card.appendChild(el('div', 'u-adviser-title', a.title));
          card.appendChild(el('div', 'u-adviser-name mono', `${a.name} · ${a.key}`));
          card.addEventListener('click', () => { selected = a.id; refresh(); });
          grid.appendChild(card);
        }
        body.appendChild(grid);
        body.appendChild(el('p', 'u-hint', 'Press F1–F6 at any time to jump straight to a report.'));
        return;
      }
      const meta = ADVISERS.find((a) => a.id === selected)!;
      const wrap = el('div', 'u-report');
      const side = el('div', 'u-report-side');
      side.appendChild(elHtml('div', 'u-portrait u-portrait--big', portraitSvg(meta.id)));
      side.appendChild(el('div', 'u-adviser-title', meta.title));
      side.appendChild(el('div', 'u-adviser-name mono', meta.name));
      side.appendChild(button('u-btn u-btn--ghost', '← ALL ADVISERS', () => { selected = null; refresh(); }));
      wrap.appendChild(side);
      const rep = el('div', 'u-report-body');
      renderReport(rep, s, selected);
      wrap.appendChild(rep);
      body.appendChild(wrap);
    },
  });
}

function kvBlock(rows: [string, string, string?][]): HTMLElement {
  const wrap = el('div', 'u-kv');
  for (const [k, v, cls] of rows) {
    const r = el('div', 'u-kv-row');
    r.appendChild(el('span', 'u-kv-k', k));
    r.appendChild(el('span', `u-kv-v mono ${cls ?? ''}`, v));
    wrap.appendChild(r);
  }
  return wrap;
}

function renderReport(body: HTMLElement, s: GameState, id: AdviserId): void {
  switch (id) {
    case 'psychiatrist': {
      const lqs = s.buildings.filter((b) => b.type === 'livingQuarters' && b.status === 'complete').length;
      const cap = engine.housingCapacity(s);
      const density = cap > 0 ? (engine.populationOf(s) / cap) * 100 : 0;
      const deaths = s.stats.deaths12.length > 0 ? s.stats.deaths12[s.stats.deaths12.length - 1] : 0;
      body.appendChild(el('h4', 'u-sect-title', 'Colonist Census'));
      body.appendChild(kvBlock([
        ['COLONISTS (FREE)', fmtNum(s.pop.colonists)],
        ['TECHNICIANS', fmtNum(s.pop.technicians)],
        ['MEDICS', fmtNum(s.pop.medics)],
        ['SCIENTISTS', fmtNum(s.pop.scientists)],
        ['SECURITY', fmtNum(s.pop.security)],
        ['TOTAL', fmtNum(engine.populationOf(s)), 'u-amber'],
      ]));
      body.appendChild(el('h4', 'u-sect-title', 'Wellbeing'));
      body.appendChild(kvBlock([
        ['BIRTH RATE', s.pop.birthRate.toUpperCase()],
        ['BIRTHS (LIFETIME)', fmtNum(s.stats.totalBirths)],
        ['DEATHS LAST MONTH', fmtNum(deaths), deaths > 0 ? 'u-neg' : ''],
        ['MORALE', fmtPct(s.morale.displayed), s.morale.displayed >= 60 ? 'u-pos' : 'u-neg'],
        ['CRIME INDEX', fmtPct(s.crime.index), s.crime.index > 50 ? 'u-neg' : ''],
        ['POPULATION DENSITY', fmtPct(density), density > 95 ? 'u-neg' : ''],
        ['HOUSING', `${lqs} Living Quarters (${fmtNum(cap)} beds)`],
      ]));
      if (s.disease) body.appendChild(el('p', 'u-hint u-neg', `Disease outbreak: ${fmtNum(s.disease.infected)} infected${s.disease.bio ? ' (enemy bio-strain)' : ''}.`));
      break;
    }
    case 'administrator': {
      const p = s.industry.producedLastMonth;
      const used = s.stores.ore + s.stores.gems + s.stores.weapons + s.stores.techGoods;
      body.appendChild(el('h4', 'u-sect-title', 'Stocks & Throughput (last month)'));
      body.appendChild(kvBlock([
        ['FOOD STORED', fmtNum(Math.floor(s.stores.food)), s.shortages.food ? 'u-neg' : ''],
        ['FOOD PRODUCED', fmtNum(p.food)],
        ['AIR BANKED', fmtNum(Math.floor(s.airBank)), s.shortages.air ? 'u-neg' : ''],
        ['AIR PRODUCED', fmtNum(p.air)],
        ['FUEL STORED', `${fmtNum(Math.floor(s.fuelStored))} / ${fmtNum(engine.fuelCapacity(s))}`],
        ['FUEL PRODUCED', fmtNum(p.fuel)],
        ['ORE STORED', fmtNum(s.stores.ore)],
        ['ORE MINED', fmtNum(p.ore)],
        ['STORE POOL', `${fmtNum(used)} / ${fmtNum(engine.storeCapacity(s))}`, s.shortages.storesFull ? 'u-neg' : ''],
      ]));
      body.appendChild(el('h4', 'u-sect-title', 'Power'));
      body.appendChild(kvBlock([
        ['SUPPLY', `${fmtNum(s.power.supply)} MW`],
        ['DEMAND', `${fmtNum(s.power.demand)} MW`, s.power.demand > s.power.supply ? 'u-neg' : 'u-pos'],
        ['FLUX POD CHARGE', `${fmtNum(Math.floor(s.podCharge))} MW`],
        ['SHED THIS MONTH', s.power.shedTypes.length === 0 ? 'NONE' : s.power.shedTypes.map((t) => engine.BUILDING_DEFS[t].name).join(', '), s.power.shedTypes.length > 0 ? 'u-neg' : ''],
      ]));
      break;
    }
    case 'finance': {
      const lm = s.finance.lastMonth;
      const incomeTotal = lm.taxIncome + lm.supportGrant + lm.birthBonus + Math.max(0, lm.tradeNet);
      const spendTotal = lm.researchSpend + lm.spyBurn + lm.constructionSpend + Math.max(0, -lm.tradeNet);
      body.appendChild(el('h4', 'u-sect-title', 'Treasury Position'));
      body.appendChild(kvBlock([
        ['FUNDS', fmtGR(s.funds), 'u-amber'],
        ['TAX RATE', `${s.finance.taxRate}% (pending ${s.finance.pendingTaxRate}%)`],
        ['INCOME LAST MONTH', `+${fmtNum(incomeTotal)}`, 'u-pos'],
        ['  · TAX', fmtNum(lm.taxIncome)],
        ['  · SUPPORT GRANT', fmtNum(lm.supportGrant)],
        ['  · TRADE', fmtNum(Math.max(0, lm.tradeNet))],
        ['SPEND LAST MONTH', `−${fmtNum(spendTotal)}`, 'u-neg'],
        ['  · RESEARCH', fmtNum(lm.researchSpend)],
        ['  · INTELLIGENCE', fmtNum(lm.spyBurn)],
        ['  · CONSTRUCTION', fmtNum(lm.constructionSpend)],
      ]));
      body.appendChild(el('p', 'u-hint', 'Earth’s Colony Support Grant pays 3,000 GR/mo for years 1–3, 1,500 for years 4–5, then nothing. Plan for independence.'));
      break;
    }
    case 'engineer': {
      body.appendChild(el('h4', 'u-sect-title', 'Structure Inventory'));
      const counts = new Map<string, { n: number; scaffold: number; damaged: number }>();
      for (const b of s.buildings) {
        const name = engine.BUILDING_DEFS[b.type].name;
        const c = counts.get(name) ?? { n: 0, scaffold: 0, damaged: 0 };
        c.n++;
        if (b.status === 'scaffold') c.scaffold++;
        if (b.status === 'complete' && b.hp < engine.BUILDING_DEFS[b.type].hp) c.damaged++;
        counts.set(name, c);
      }
      if (counts.size === 0) { body.appendChild(el('p', 'u-hint', 'Nothing built yet.')); break; }
      const t = el('table', 'u-table');
      const hr = el('tr');
      for (const h of ['STRUCTURE', 'COUNT', 'BUILDING', 'DAMAGED']) hr.appendChild(el('th', '', h));
      const thead = el('thead'); thead.appendChild(hr); t.appendChild(thead);
      const tb = el('tbody');
      for (const [name, c] of [...counts.entries()].sort((a, b) => b[1].n - a[1].n)) {
        const tr = el('tr');
        tr.appendChild(el('td', '', name));
        tr.appendChild(el('td', 'mono', String(c.n)));
        tr.appendChild(el('td', 'mono', c.scaffold ? String(c.scaffold) : '—'));
        tr.appendChild(el('td', `mono${c.damaged ? ' u-neg' : ''}`, c.damaged ? String(c.damaged) : '—'));
        tb.appendChild(tr);
      }
      t.appendChild(tb);
      body.appendChild(t);
      const wreck = s.wreckage.reduce((a, b) => a + b, 0);
      if (wreck > 0) body.appendChild(el('p', 'u-hint u-amber', `${wreck} wreckage tiles need clearing (tidiness drags QoL).`));
      break;
    }
    case 'research': {
      const labs = s.buildings.filter((b) => b.type === 'laboratory' && b.status === 'complete');
      const scientists = labs.reduce((a, b) => a + b.staff, 0);
      const need = engine.rpForStep(s.research.techLevel);
      body.appendChild(el('h4', 'u-sect-title', 'Research Programme'));
      body.appendChild(kvBlock([
        ['TECH LEVEL', `${s.research.techLevel} / 10`, 'u-violet'],
        ['PROGRESS', s.research.techLevel >= 10 ? 'COMPLETE' : `${fmtNum(Math.round(s.research.rp))} / ${fmtNum(need)} RP`],
        ['LABORATORIES', String(labs.length)],
        ['SCIENTISTS AT BENCH', fmtNum(scientists)],
        ['MILITARY GRANT', fmtGR(s.finance.grants.military), 'u-amber'],
        ['CIVILIAN GRANT', fmtGR(s.finance.grants.civilian), 'u-amber'],
      ]));
      body.appendChild(el('h4', 'u-sect-title', 'Inventions'));
      const list = el('div', 'u-inv-list');
      for (const inv of engine.INVENTIONS) {
        const got = s.research.inventions.includes(inv.id);
        const row = el('div', `u-inv-row${got ? ' u-inv-row--got' : ''}`);
        row.appendChild(el('span', 'u-inv-tl mono', `TL${inv.techLevel}`));
        row.appendChild(el('span', 'u-inv-name', inv.name));
        row.appendChild(el('span', 'u-inv-state mono', got ? 'INVENTED' : '—'));
        row.title = inv.description;
        list.appendChild(row);
      }
      body.appendChild(list);
      break;
    }
    case 'commander': {
      const byKind = new Map<UnitKind, { here: number; away: number }>();
      for (const u of s.units) {
        if (u.owner !== 'player') continue;
        const c = byKind.get(u.kind) ?? { here: 0, away: 0 };
        if (u.offMap) c.away++; else c.here++;
        byKind.set(u.kind, c);
      }
      body.appendChild(el('h4', 'u-sect-title', 'Order of Battle'));
      if (byKind.size === 0) body.appendChild(el('p', 'u-hint', 'No tanks or ships in service.'));
      else {
        const t = el('table', 'u-table');
        const hr = el('tr');
        for (const h of ['UNIT', 'ON MAP', 'AT ENEMY CITY']) hr.appendChild(el('th', '', h));
        const th = el('thead'); th.appendChild(hr); t.appendChild(th);
        const tb = el('tbody');
        for (const [kind, c] of byKind) {
          const tr = el('tr');
          tr.appendChild(el('td', '', engine.UNIT_DEFS[kind].name));
          tr.appendChild(el('td', 'mono', String(c.here)));
          tr.appendChild(el('td', `mono${c.away ? ' u-amber' : ''}`, c.away ? String(c.away) : '—'));
          tb.appendChild(tr);
        }
        t.appendChild(tb);
        body.appendChild(t);
      }
      const turrets = s.buildings.filter((b) => b.type === 'laserTurret' && b.status === 'complete').length;
      const launchers = s.buildings.filter((b) => b.type === 'missileLauncher' && b.status === 'complete' && !b.fired).length;
      const mines = s.buildings.filter((b) => b.type === 'landMine' && b.status === 'complete').length;
      body.appendChild(el('h4', 'u-sect-title', 'Ground Defences'));
      body.appendChild(kvBlock([
        ['TURRETS', String(turrets)],
        ['MISSILES READY', String(launchers)],
        ['LAND MINES', String(mines)],
      ]));
      body.appendChild(el('h4', 'u-sect-title', 'Combat Effectiveness'));
      const won = s.stats.battlesWon, lost = s.stats.battlesLost;
      body.appendChild(kvBlock([
        ['BATTLES WON', fmtNum(won), 'u-pos'],
        ['BATTLES LOST', fmtNum(lost), lost > 0 ? 'u-neg' : ''],
        ['ENEMY WAVES ARRIVED', fmtNum(s.stats.attacksTotal)],
        ['EFFECTIVENESS', won + lost > 0 ? fmtPct((won / (won + lost)) * 100) : '—'],
      ]));
      if (s.enemy) {
        body.appendChild(el('p', `u-hint ${s.enemy.destroyed ? 'u-pos' : 'u-amber'}`,
          s.enemy.destroyed ? 'The enemy city has fallen. No further waves will come.'
            : s.spy.cityLocated ? 'Enemy city located — assault units may be committed (see unit orders).'
              : 'Enemy city not yet located. Fund Intelligence.'));
      }
      break;
    }
  }
}
