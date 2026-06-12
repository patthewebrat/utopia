// Spy panel — intelligence tier indicator, grant balance, report history,
// occasional procedural "illustration" card.

import * as engine from '../../engine';
import type { SpyReport } from '../../types';
import type { UIContext } from '../context';
import { el, button, fmtNum } from '../dom';
import { openPanel, toast } from '../panels';

const TIERS = [
  { level: 1, name: 'Insufficient Funds', blurb: 'No spying. Fund the Intelligence grant to begin operations.' },
  { level: 2, name: 'Low Level Surveillance', blurb: 'Basic facts and speculation. ~300 GR/mo.' },
  { level: 3, name: 'Normal Intelligence Activity', blurb: 'Regular, fairly reliable reports. ~800 GR/mo.' },
  { level: 4, name: 'Special Operatives In Use', blurb: 'Best agents, earliest warnings, city-defence estimates. ~2,000 GR/mo.' },
];

/** deterministic procedural "obtained illustration" — abstract recon scanline card */
function illustration(report: SpyReport): HTMLElement {
  const c = document.createElement('canvas');
  c.width = 240; c.height = 100;
  c.className = 'u-spy-illus';
  const g = c.getContext('2d')!;
  let seed = report.monthIndex * 2654435761 >>> 0;
  const rnd = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  g.fillStyle = '#0A1014'; g.fillRect(0, 0, 240, 100);
  // alien structures silhouette
  g.fillStyle = '#1B2A30';
  for (let i = 0; i < 9; i++) {
    const w = 12 + rnd() * 26, h = 14 + rnd() * 56, x = 6 + i * 26 + rnd() * 6;
    g.fillRect(x, 92 - h, w, h);
    if (rnd() > 0.5) { g.fillStyle = '#C8102E'; g.fillRect(x + w / 2 - 1, 92 - h - 4, 2, 4); g.fillStyle = '#1B2A30'; }
  }
  // red glows
  for (let i = 0; i < 5; i++) {
    g.fillStyle = `rgba(255,59,48,${0.25 + rnd() * 0.4})`;
    g.beginPath(); g.arc(20 + rnd() * 200, 30 + rnd() * 55, 1.5 + rnd() * 2.5, 0, Math.PI * 2); g.fill();
  }
  // scanlines + crosshair
  g.fillStyle = 'rgba(55,224,242,0.07)';
  for (let y = 0; y < 100; y += 4) g.fillRect(0, y, 240, 1);
  g.strokeStyle = 'rgba(55,224,242,0.5)'; g.lineWidth = 1;
  const cx = 40 + rnd() * 160, cy = 25 + rnd() * 50;
  g.beginPath(); g.arc(cx, cy, 12, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(cx - 18, cy); g.lineTo(cx + 18, cy); g.moveTo(cx, cy - 18); g.lineTo(cx, cy + 18); g.stroke();
  g.fillStyle = 'rgba(55,224,242,0.8)'; g.font = '8px monospace';
  g.fillText(`RECON ${String(report.monthIndex).padStart(3, '0')}·${report.level}`, 6, 12);
  return c;
}

function reportCard(r: SpyReport, expanded: boolean): HTMLElement {
  const card = el('div', `u-spy-report${expanded ? ' u-spy-report--open' : ''}`);
  const head = el('div', 'u-spy-report-head');
  head.appendChild(el('span', 'u-spy-report-title', r.title));
  const mo = ((r.monthIndex) % 12) + 1;
  const yr = 2090 + Math.floor(r.monthIndex / 12);
  head.appendChild(el('span', 'mono u-spy-report-date', `${String(mo).padStart(2, '0')}/${yr} · L${r.level}`));
  card.appendChild(head);
  if (expanded) {
    card.appendChild(el('p', 'u-spy-report-body', r.body));
    if (r.cityDefencePct !== null) {
      card.appendChild(el('p', 'mono u-amber', `ESTIMATED CITY DEFENCE: ${Math.round(r.cityDefencePct)}%`));
    }
    // every third report comes with an obtained illustration
    if (r.monthIndex % 3 === 0 || r.level === 4) card.appendChild(illustration(r));
  } else {
    head.addEventListener('click', () => card.classList.toggle('u-spy-report--open'));
    const bodyEl = el('p', 'u-spy-report-body', r.body);
    card.appendChild(bodyEl);
  }
  return card;
}

export function openSpy(ctx: UIContext): void {
  openPanel(ctx, {
    id: 'spy',
    title: 'Intelligence Operations',
    size: 'mid',
    render(body, refresh) {
      const s = ctx.getState();
      const lvl = engine.currentSpyLevel(s);

      // tier ladder
      const ladder = el('div', 'u-spy-tiers');
      for (const t of TIERS) {
        const tier = el('div', `u-spy-tier${t.level === lvl.level ? ' u-active' : ''}${t.level < lvl.level ? ' u-spy-tier--below' : ''}`);
        tier.appendChild(el('span', 'u-spy-tier-num mono', String(t.level)));
        tier.appendChild(el('span', 'u-spy-tier-name', t.name));
        tier.title = t.blurb;
        ladder.appendChild(tier);
      }
      body.appendChild(ladder);

      const bal = s.finance.grants.intelligence;
      const row = el('div', 'u-ctl-row');
      const lab = el('span', 'u-ctl-label', 'INTELLIGENCE GRANT — balance ');
      lab.appendChild(el('span', 'mono u-amber', `${fmtNum(bal)} GR`));
      row.appendChild(lab);
      const group = el('span', 'u-btn-group');
      for (const amt of [500, 2000, 10000]) {
        group.appendChild(button('u-btn u-btn--small', `+${fmtNum(amt)}`, () => {
          const e = engine.addGrant(s, 'intelligence', amt);
          if (e) toast('warning', e);
          refresh();
        }));
      }
      row.appendChild(group);
      body.appendChild(row);

      if (s.spy.cityLocated) {
        body.appendChild(el('p', 'u-hint u-pos', 'Operatives have LOCATED THE ENEMY CITY. Assault units may be committed from their order panels.'));
      }

      body.appendChild(el('h4', 'u-sect-title', 'Field Reports'));
      const reports = [...s.spy.reports].reverse();
      if (reports.length === 0) {
        body.appendChild(el('p', 'u-hint', 'No reports on file. Spies report automatically once funded — higher tiers report more often and warn of attacks earlier.'));
      } else {
        const list = el('div', 'u-spy-list');
        reports.forEach((r, i) => list.appendChild(reportCard(r, i === 0)));
        body.appendChild(list);
      }
    },
  });
}
