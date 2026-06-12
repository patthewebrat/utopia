// Industry panel — per-installation staffing table: TECH / MAX / REQD / VAC / MONTH PROD.

import * as engine from '../../engine';
import type { BuildingInstance, BuildingType, GameState } from '../../types';
import type { UIContext } from '../context';
import { el, button, fmtNum } from '../dom';
import { openPanel, toast } from '../panels';

const INDUSTRY_TYPES: BuildingType[] = [
  'mine', 'chemicalPlant', 'armsLab', 'workshop', 'laboratory',
  'hospital', 'securityHQ', 'tankYard', 'shipYard',
];

function monthProd(s: GameState, b: BuildingInstance): string {
  switch (b.type) {
    case 'mine': return `${fmtNum(s.oreYield[b.y * s.mapW + b.x] * b.staff)} ore`;
    case 'chemicalPlant': return `${fmtNum(s.fuelYield[b.y * s.mapW + b.x] * b.staff)} fuel`;
    case 'armsLab': return `${fmtNum(b.staff)} weapons`;
    case 'workshop': return `${fmtNum(Math.floor(b.staff * 1.5))} tech goods`;
    case 'laboratory': return `research ×${b.staff}`;
    case 'hospital': return `${fmtNum(b.staff * 40)} covered`;
    case 'securityHQ': return `suppression ${b.staff}`;
    case 'tankYard': return b.tankProgress < 0 ? 'no materials' : `tank +${b.staff * 4}%`;
    case 'shipYard': return b.shipOrder ? `${fmtNum(b.staff * 2)} WU` : 'no order';
    default: return '—';
  }
}

export function openIndustry(ctx: UIContext): void {
  openPanel(ctx, {
    id: 'industry',
    title: 'Industry & Labour',
    size: 'wide',
    render(body, refresh) {
      const s = ctx.getState();

      // production summary strip
      const p = s.industry.producedLastMonth;
      const strip = el('div', 'u-stat-strip');
      const stat = (label: string, v: string): void => {
        const d = el('div', 'u-stat');
        d.appendChild(el('span', 'u-stat-label', label));
        d.appendChild(el('span', 'u-stat-val mono', v));
        strip.appendChild(d);
      };
      stat('ORE /MO', fmtNum(p.ore)); stat('FUEL /MO', fmtNum(p.fuel));
      stat('WEAPONS /MO', fmtNum(p.weapons)); stat('TECH GOODS /MO', fmtNum(p.techGoods));
      stat('FOOD /MO', fmtNum(p.food)); stat('AIR /MO', fmtNum(p.air));
      stat('POWER', `${fmtNum(s.power.demand)} / ${fmtNum(s.power.supply)} MW`);
      body.appendChild(strip);

      // labour pools
      const pools = el('p', 'u-hint',
        `Labour pools — Colonists ${fmtNum(s.pop.colonists)} · Technicians ${fmtNum(s.pop.technicians)} · ` +
        `Medics ${fmtNum(s.pop.medics)} · Scientists ${fmtNum(s.pop.scientists)} · Security ${fmtNum(s.pop.security)}`);
      body.appendChild(pools);

      const table = el('table', 'u-table');
      const thead = el('thead');
      const hr = el('tr');
      for (const h of ['INSTALLATION', 'STAFF', 'WORKING', 'MAX', 'REQD', 'VAC', 'MONTH PROD']) {
        hr.appendChild(el('th', '', h));
      }
      thead.appendChild(hr);
      table.appendChild(thead);
      const tbody = el('tbody');

      const list = s.buildings
        .filter((b) => b.status === 'complete' && INDUSTRY_TYPES.includes(b.type))
        .sort((a, b) => INDUSTRY_TYPES.indexOf(a.type) - INDUSTRY_TYPES.indexOf(b.type));

      if (list.length === 0) {
        body.appendChild(el('p', 'u-hint', 'No staffed installations yet — build Mines, Plants, Labs…'));
      }

      for (const b of list) {
        const def = engine.BUILDING_DEFS[b.type];
        const tr = el('tr', b.powered ? '' : 'u-row-off');
        tr.appendChild(el('td', '', `${def.name} · ${b.x},${b.y}${b.powered ? '' : ' (NO POWER)'}`));
        tr.appendChild(el('td', 'mono', def.staffClass ? def.staffClass.toUpperCase() : 'COLONIST'));
        tr.appendChild(el('td', 'mono', String(b.staff)));
        tr.appendChild(el('td', 'mono', String(def.maxStaff)));
        const reqTd = el('td', '');
        const wrap = el('span', 'u-stepper');
        const dec = button('u-step-btn', '−', () => {
          const e = engine.setRequiredStaff(s, b.id, Math.max(0, b.reqStaff - 1));
          if (e) toast('warning', e); refresh();
        });
        const val = el('span', 'u-step-val mono', String(b.reqStaff));
        const inc = button('u-step-btn', '+', () => {
          const e = engine.setRequiredStaff(s, b.id, Math.min(def.maxStaff, b.reqStaff + 1));
          if (e) toast('warning', e); refresh();
        });
        wrap.append(dec, val, inc);
        reqTd.appendChild(wrap);
        tr.appendChild(reqTd);
        const vac = Math.max(0, b.reqStaff - b.staff);
        tr.appendChild(el('td', `mono${vac > 0 ? ' u-amber' : ''}`, String(vac)));
        tr.appendChild(el('td', 'mono', monthProd(s, b)));
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      body.appendChild(table);
      body.appendChild(el('p', 'u-hint',
        'Vacancies are filled at the monthly tick by retraining free colonists. Reducing REQD releases workers back to the colonist pool.'));
    },
  });
}
