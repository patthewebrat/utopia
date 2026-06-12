// Unit order panel — tank: send-to-marker / N-nearest / stop / teleport;
// ship: fuel & HP, land-vs-hover arrival, Explorer pad build, alien-city assault.

import * as engine from '../../engine';
import type { UIContext } from '../context';
import { el, button, fmtNum } from '../dom';
import { openPanel, toast } from '../panels';

export function openUnitOrders(ctx: UIContext, unitId: number): void {
  openPanel(ctx, {
    id: 'unit',
    title: 'Unit Orders',
    size: 'narrow',
    render(body, refresh) {
      const s = ctx.getState();
      const u = s.units.find((x) => x.id === unitId && x.owner === 'player');
      if (!u) { body.appendChild(el('p', 'u-hint', 'Unit lost.')); return; }
      const def = engine.UNIT_DEFS[u.kind];
      const err = (msg: string | null): void => { if (msg) toast('warning', msg); refresh(); };

      body.appendChild(el('h3', 'u-binfo-name', def.name));
      const kvWrap = el('div', 'u-kv');
      const kv = (k: string, v: string, cls = ''): void => {
        const r = el('div', 'u-kv-row');
        r.appendChild(el('span', 'u-kv-k', k));
        r.appendChild(el('span', `u-kv-v mono ${cls}`, v));
        kvWrap.appendChild(r);
      };
      kv('HULL', `${Math.round(u.hp)} / ${u.maxHp}`, u.hp < u.maxHp * 0.4 ? 'u-neg' : '');
      if (def.isShip) {
        kv('FUEL', u.fuel < 0 ? 'FUSION (∞)' : `${Math.round(u.fuel)} / ${def.fuelCap}`,
          u.fuel >= 0 && u.fuel < def.fuelCap * 0.25 ? 'u-neg' : '');
        kv('MODE', u.mode.toUpperCase());
      }
      if (u.offMap) kv('DEPLOYMENT', u.offMap === 'toCity' ? 'EN ROUTE TO ALIEN CITY'
        : u.offMap === 'atCity' ? 'ENGAGING ALIEN CITY' : 'RETURNING', 'u-amber');
      else kv('POSITION', `${Math.round(u.x)},${Math.round(u.y)}`);
      if (def.damage > 0) kv('WEAPON', `${def.damage} dmg · range ${def.range}`);
      body.appendChild(kvWrap);

      if (u.offMap) {
        body.appendChild(el('p', 'u-hint', 'Unit is committed off-map. It will return when the assault ends.'));
        return;
      }

      const isTank = u.kind === 'tank' || u.kind === 'hoverTank';

      // movement to markers
      const mv = el('div', 'u-binfo-sect');
      mv.appendChild(el('h4', 'u-sect-title', 'Move to Marker'));
      let landOnArrival = true;
      if (def.isShip) {
        const seg = el('div', 'u-seg');
        const landB = button('u-seg-btn u-active', 'LAND', () => { landOnArrival = true; landB.classList.add('u-active'); hovB.classList.remove('u-active'); });
        const hovB = button('u-seg-btn', 'HOVER', () => { landOnArrival = false; hovB.classList.add('u-active'); landB.classList.remove('u-active'); });
        seg.append(landB, hovB);
        mv.appendChild(seg);
      }
      const row = el('div', 'u-marker-row');
      s.markers.forEach((m, i) => {
        const btn = button(`u-marker-btn${m ? '' : ' u-disabled'}`, String(i + 1), () => {
          if (!m) return;
          err(isTank ? engine.orderTank(s, u.id, i) : engine.orderShip(s, u.id, i, landOnArrival));
        });
        if (m) btn.title = `Marker ${i + 1} at ${m.x},${m.y}`;
        row.appendChild(btn);
      });
      mv.appendChild(row);
      mv.appendChild(el('p', 'u-hint', 'Place markers with keys 1–8 over the world; Shift+D clears all.'));
      body.appendChild(mv);

      if (isTank) {
        const grp = el('div', 'u-binfo-sect');
        grp.appendChild(el('h4', 'u-sect-title', 'Group Order'));
        const r = el('div', 'u-ctl-row');
        r.appendChild(el('span', 'u-ctl-label', 'Send N nearest tanks to marker'));
        const nIn = el('input') as HTMLInputElement;
        nIn.type = 'number'; nIn.min = '1'; nIn.max = '99'; nIn.value = '4'; nIn.className = 'u-input mono';
        r.appendChild(nIn);
        grp.appendChild(r);
        const mrow = el('div', 'u-marker-row');
        s.markers.forEach((m, i) => {
          const btn = button(`u-marker-btn${m ? '' : ' u-disabled'}`, String(i + 1), () => {
            if (!m) return;
            const sent = engine.orderTanksNearest(s, i, Number(nIn.value) || 1, u.id);
            toast('info', `${sent} tank${sent === 1 ? '' : 's'} ordered to marker ${i + 1}.`);
            refresh();
          });
          mrow.appendChild(btn);
        });
        grp.appendChild(mrow);
        body.appendChild(grp);

        if (s.research.techLevel >= 10) {
          const tp = el('div', 'u-binfo-sect');
          tp.appendChild(el('h4', 'u-sect-title', 'Tank Teleport'));
          const trow = el('div', 'u-marker-row');
          s.markers.forEach((m, i) => {
            const btn = button(`u-marker-btn${m ? '' : ' u-disabled'}`, String(i + 1), () => {
              if (!m) return;
              err(engine.useTankTeleport(s, u.id, i));
            });
            trow.appendChild(btn);
          });
          tp.appendChild(trow);
          tp.appendChild(el('p', 'u-hint', 'Drive onto a Tank Teleport pad, then jump to a marker.'));
          body.appendChild(tp);
        }
      }

      if (u.kind === 'explorer' && u.padBuildDaysLeft < 0) {
        const ex = el('div', 'u-binfo-sect');
        ex.appendChild(el('h4', 'u-sect-title', 'Construction'));
        ex.appendChild(button('u-btn', `BUILD LAUNCH PAD HERE — ${fmtNum(2600)} GR`, () => err(engine.explorerBuildPad(s, u.id))));
        ex.appendChild(el('p', 'u-hint', 'The Explorer lands and assembles a Launch Pad in half a month.'));
        body.appendChild(ex);
      }
      if (u.kind === 'explorer' && u.padBuildDaysLeft >= 0) {
        body.appendChild(el('p', 'u-hint u-amber', `Building Launch Pad — ${u.padBuildDaysLeft} days remaining.`));
      }

      if (def.damage > 0 || isTank) {
        const at = el('div', 'u-binfo-sect');
        at.appendChild(el('h4', 'u-sect-title', 'Strategic'));
        const located = s.spy.cityLocated;
        const btn = button(`u-btn u-btn--danger${located ? '' : ' u-disabled'}`,
          located ? 'ASSAULT ALIEN CITY' : 'ALIEN CITY NOT LOCATED', () => {
            if (!located) return;
            err(engine.sendToAlienCity(s, u.id));
          });
        if (!located) btn.title = 'Fund Intelligence until your spies locate the enemy city.';
        at.appendChild(btn);
        body.appendChild(at);
      }

      body.appendChild(button('u-btn u-btn--ghost', 'STOP / HOLD', () => { engine.stopUnit(s, u.id); refresh(); }));
    },
  });
}
