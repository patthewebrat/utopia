// Building information panel — per-type controls (staffing, hospital birth rate,
// command-centre toggle, missile fire, ship yard orders, sports events, stores).

import * as engine from '../../engine';
import type { BuildingInstance, BirthRateSetting, ShipType } from '../../types';
import type { UIContext } from '../context';
import { el, button, fmtNum, fmtGR } from '../dom';
import { buildingIcon } from '../sprites';
import { openPanel, toast } from '../panels';
import { openUnitOrders } from './unitOrders';

export function openBuildingInfo(ctx: UIContext, buildingId: number): void {
  openPanel(ctx, {
    id: `building`,
    title: 'Structure Report',
    size: 'narrow',
    render(body, refresh) {
      const s = ctx.getState();
      const b = s.buildings.find((x) => x.id === buildingId);
      if (!b) { body.appendChild(el('p', 'u-hint', 'Structure no longer exists.')); return; }
      const def = engine.BUILDING_DEFS[b.type];

      const head = el('div', 'u-binfo-head');
      head.appendChild(buildingIcon(b.type));
      const ht = el('div', 'u-binfo-headtext');
      ht.appendChild(el('h3', 'u-binfo-name', def.name));
      ht.appendChild(el('div', 'u-binfo-loc mono', `TILE ${b.x},${b.y} · ID ${b.id}`));
      ht.appendChild(el('p', 'u-binfo-blurb', def.blurb));
      head.appendChild(ht);
      body.appendChild(head);

      // status rows
      const rows = el('div', 'u-kv');
      const kv = (k: string, v: string, cls = ''): void => {
        const r = el('div', 'u-kv-row');
        r.appendChild(el('span', 'u-kv-k', k));
        r.appendChild(el('span', `u-kv-v mono ${cls}`, v));
        rows.appendChild(r);
      };
      if (b.status === 'scaffold') {
        const pct = Math.min(100, Math.round((b.progress / def.buildMonths) * 100));
        kv('STATUS', `SCAFFOLD ${pct}%`, 'u-amber');
        kv('CREW ON SITE', `${b.crewAssigned} / ${def.buildCrew}`);
      } else {
        kv('STATUS', b.powered ? 'OPERATIONAL' : 'NO POWER', b.powered ? 'u-pos' : 'u-neg');
      }
      kv('INTEGRITY', `${b.hp} / ${def.hp}`, b.hp < def.hp * 0.5 ? 'u-neg' : '');
      if (def.powerMW > 0) kv('POWER DRAW', `${def.powerMW} MW/mo`);
      body.appendChild(rows);

      const hpBar = el('div', 'u-bar');
      const hpFill = el('div', 'u-bar-fill');
      hpFill.style.width = `${Math.round((b.hp / def.hp) * 100)}%`;
      if (b.hp < def.hp * 0.5) hpFill.classList.add('u-bar-fill--warn');
      hpBar.appendChild(hpFill);
      body.appendChild(hpBar);

      if (b.status === 'complete') {
        addTypeControls(ctx, body, b, refresh);
      }
    },
  });
}

function addTypeControls(
  ctx: UIContext, body: HTMLElement, b: BuildingInstance, refresh: () => void,
): void {
  const s = ctx.getState();
  const def = engine.BUILDING_DEFS[b.type];
  const sect = (title: string): HTMLElement => {
    const d = el('div', 'u-binfo-sect');
    d.appendChild(el('h4', 'u-sect-title', title));
    body.appendChild(d);
    return d;
  };
  const err = (msg: string | null): void => { if (msg) toast('warning', msg); refresh(); };

  // staffing
  if (def.maxStaff > 0 && def.staffClass) {
    const d = sect('Staffing');
    const row = el('div', 'u-ctl-row');
    row.appendChild(el('span', 'u-ctl-label', `${def.staffClass.toUpperCase()}S — working ${b.staff} / required`));
    const dec = button('u-step-btn', '−', () => err(engine.setRequiredStaff(s, b.id, Math.max(0, b.reqStaff - 1))));
    const val = el('span', 'u-step-val mono', String(b.reqStaff));
    const inc = button('u-step-btn', '+', () => err(engine.setRequiredStaff(s, b.id, Math.min(def.maxStaff, b.reqStaff + 1))));
    const st = el('span', 'u-stepper'); st.append(dec, val, inc);
    row.appendChild(st);
    d.appendChild(row);
  }
  if (b.type === 'shipYard') {
    const d = sect('Yard Crew');
    const row = el('div', 'u-ctl-row');
    row.appendChild(el('span', 'u-ctl-label', `COLONISTS — working ${b.staff} / required`));
    const dec = button('u-step-btn', '−', () => err(engine.setRequiredStaff(s, b.id, Math.max(0, b.reqStaff - 1))));
    const val = el('span', 'u-step-val mono', String(b.reqStaff));
    const inc = button('u-step-btn', '+', () => err(engine.setRequiredStaff(s, b.id, Math.min(def.maxStaff, b.reqStaff + 1))));
    const st = el('span', 'u-stepper'); st.append(dec, val, inc);
    row.appendChild(st);
    d.appendChild(row);
  }

  switch (b.type) {
    case 'hospital': {
      const d = sect('Birth Rate Control');
      const row = el('div', 'u-seg');
      (['none', 'low', 'medium', 'high'] as BirthRateSetting[]).forEach((r) => {
        const btn = button(`u-seg-btn${s.pop.birthRate === r ? ' u-active' : ''}`, r.toUpperCase(), () => {
          engine.setBirthRate(s, r); refresh();
        });
        row.appendChild(btn);
      });
      d.appendChild(row);
      d.appendChild(el('p', 'u-hint', 'High birth rate earns a 5 GR Earth bonus per birth.'));
      break;
    }
    case 'commandCentre': {
      const d = sect('Command Authority');
      d.appendChild(el('p', 'u-hint', b.active
        ? 'This is the ACTIVE Command Centre. Trade, yards and off-map assaults route through it.'
        : 'Standby Command Centre.'));
      if (!b.active) d.appendChild(button('u-btn', 'MAKE ACTIVE', () => err(engine.toggleCommandCentre(s, b.id))));
      break;
    }
    case 'laserTurret': {
      const d = sect(b.plasma ? 'Plasma Gun' : 'Laser Turret');
      d.appendChild(el('p', 'u-hint',
        `Bearing ${Math.round(b.facing)}° — auto-seeking, 30° cone, range ${b.plasma ? 7 : 6} tiles.`));
      break;
    }
    case 'missileLauncher': {
      const d = sect('Missile Control');
      if (b.fired) { d.appendChild(el('p', 'u-hint', 'Missile away. Launcher expended.')); break; }
      d.appendChild(el('p', 'u-hint', 'Fire at a tactical marker (place markers with keys 1–8):'));
      const row = el('div', 'u-marker-row');
      s.markers.forEach((m, i) => {
        const btn = button(`u-marker-btn${m ? '' : ' u-disabled'}`, String(i + 1), () => {
          if (!m) return;
          err(engine.fireMissile(s, b.id, m.x, m.y));
        });
        row.appendChild(btn);
      });
      d.appendChild(row);
      break;
    }
    case 'shipYard': {
      const d = sect('Ship Construction');
      if (b.shipOrder) {
        const sd = engine.UNIT_DEFS[b.shipOrder.ship];
        const pct = Math.round((b.shipOrder.workDone / sd.workUnits) * 100);
        d.appendChild(el('p', 'u-hint', `${sd.name} under construction — ${pct}%`));
        const bar = el('div', 'u-bar'); const f = el('div', 'u-bar-fill');
        f.style.width = `${pct}%`; bar.appendChild(f); d.appendChild(bar);
      } else {
        for (const ship of engine.SHIP_TYPES as ShipType[]) {
          const sd = engine.UNIT_DEFS[ship];
          const row = el('div', 'u-ctl-row');
          const lockTL = ship === 'fusionCruiser' && s.research.techLevel < 10;
          row.appendChild(el('span', 'u-ctl-label',
            `${sd.name} — ${fmtNum(sd.oreCost)} ore, ${fmtNum(sd.weaponCost)} wpns`));
          const btn = button(`u-btn u-btn--small${lockTL ? ' u-disabled' : ''}`, lockTL ? 'TL 10' : 'LAY DOWN', () => {
            if (lockTL) return;
            err(engine.buildShip(s, b.id, ship));
          });
          row.appendChild(btn);
          d.appendChild(row);
        }
      }
      break;
    }
    case 'sportsComplex': {
      const d = sect('Events');
      const we = s.worldEvents;
      if (we.sportsEventActiveMonth === s.monthIndex) d.appendChild(el('p', 'u-hint u-pos', 'Event in progress — morale boosted!'));
      else if (we.sportsEventCalled) d.appendChild(el('p', 'u-hint', 'Event booked — opens on the 1st of next month.'));
      else d.appendChild(button('u-btn', 'CALL SPORTS EVENT', () => err(engine.callSportsEvent(s))));
      d.appendChild(el('p', 'u-hint', 'Morale +12 for the month; industry output ×0.85. Hold one at least every 3 months or morale suffers.'));
      break;
    }
    case 'store': {
      const d = sect('Shared Store Pool');
      const cap = engine.storeCapacity(s);
      const used = s.stores.ore + s.stores.gems + s.stores.weapons + s.stores.techGoods;
      const kvr = (k: string, v: number): void => {
        const r = el('div', 'u-kv-row');
        r.appendChild(el('span', 'u-kv-k', k));
        r.appendChild(el('span', 'u-kv-v mono', fmtNum(v)));
        d.appendChild(r);
      };
      kvr('ORE', s.stores.ore); kvr('GEMS', s.stores.gems);
      kvr('WEAPONS', s.stores.weapons); kvr('TECH GOODS', s.stores.techGoods);
      d.appendChild(el('p', `u-hint${used >= cap ? ' u-neg' : ''}`, `${fmtNum(used)} / ${fmtNum(cap)} units used across all Stores.`));
      break;
    }
    case 'fuelTank': {
      const d = sect('Fuel Reserve');
      d.appendChild(el('p', 'u-hint',
        `Colony fuel: ${fmtNum(Math.round(s.fuelStored))} / ${fmtNum(engine.fuelCapacity(s))} units.` +
        (b.compressed ? ' (Compressed tank: 750 capacity.)' : '')));
      break;
    }
    case 'launchPad': {
      const d = sect('Pad Status');
      if (b.padShipId >= 0) {
        const u = s.units.find((x) => x.id === b.padShipId);
        if (u) {
          d.appendChild(el('p', 'u-hint', `${engine.UNIT_DEFS[u.kind].name} docked.`));
          d.appendChild(button('u-btn', 'SHIP ORDERS', () => openUnitOrders(ctx, u.id)));
        }
      } else d.appendChild(el('p', 'u-hint', 'Pad clear. Landed ships refuel here (Fuel Tank within 8 tiles).'));
      break;
    }
    case 'tankYard': {
      const d = sect('Tank Assembly');
      if (b.tankProgress < 0) d.appendChild(el('p', 'u-hint u-neg', 'Awaiting materials (30 ore + 20 weapons per tank).'));
      else {
        d.appendChild(el('p', 'u-hint', `Current ${s.research.inventions.includes('hoverTank') ? 'Hover Tank' : 'Tank'} — ${Math.round(b.tankProgress)}%`));
        const bar = el('div', 'u-bar'); const f = el('div', 'u-bar-fill');
        f.style.width = `${Math.max(0, Math.round(b.tankProgress))}%`; bar.appendChild(f); d.appendChild(bar);
      }
      break;
    }
    case 'laboratory': {
      const d = sect('Research');
      const need = engine.rpForStep(s.research.techLevel);
      d.appendChild(el('p', 'u-hint',
        `Tech Level ${s.research.techLevel} — ${fmtNum(Math.round(s.research.rp))}/${fmtNum(need)} RP toward next level. ` +
        `Research grants: ${fmtGR(s.finance.grants.military + s.finance.grants.civilian)} remaining.`));
      break;
    }
    default: break;
  }
}
