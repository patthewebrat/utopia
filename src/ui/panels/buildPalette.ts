// Build palette — grouped grid of buildable structures with procedural icons,
// cost, lock state (required invention / tech level tooltip).

import * as engine from '../../engine';
import type { BuildingType } from '../../types';
import type { UIContext } from '../context';
import { setUiMode } from '../context';
import { el, fmtNum } from '../dom';
import { buildingIcon } from '../sprites';
import { openPanel, closePanel } from '../panels';

const GROUPS: { label: string; types: BuildingType[] }[] = [
  { label: 'Habitat', types: ['livingQuarters', 'hydroponics', 'lifeSupport', 'spaceMossConverter', 'hospital', 'sportsComplex', 'securityHQ'] },
  { label: 'Industry', types: ['mine', 'chemicalPlant', 'armsLab', 'workshop', 'store', 'fuelTank', 'laboratory'] },
  { label: 'Power', types: ['powerStation', 'solarPanel', 'fluxPod'] },
  { label: 'Defence', types: ['laserTurret', 'missileLauncher', 'landMine', 'radar', 'commandCentre', 'tankYard', 'tankTeleport'] },
  { label: 'Space', types: ['shipYard', 'launchPad', 'matterTransporter'] },
];

/** invention id that unlocks a tech-gated building, for the lock tooltip */
const UNLOCK_INVENTION: Partial<Record<BuildingType, string>> = {
  spaceMossConverter: 'spaceMossConverter',
  landMine: 'landMine',
  matterTransporter: 'matterTransporter',
  tankTeleport: 'tankTeleport',
  morgroHydroponics: 'morgroHydroponics',
  solarGenerator: 'solarGenerator',
};

const STAFF_PLURAL: Record<string, string> = {
  technician: 'technicians',
  medic: 'medics',
  scientist: 'scientists',
  security: 'security officers',
  colonist: 'colonists',
};

export function openBuildPalette(ctx: UIContext): void {
  openPanel(ctx, {
    id: 'build',
    title: 'Construction',
    size: 'wide',
    render(body) {
      const s = ctx.getState();
      const inv = s.research.inventions;
      for (const group of GROUPS) {
        const sec = el('div', 'u-build-group');
        sec.appendChild(el('h3', 'u-build-group-title', group.label));
        const grid = el('div', 'u-build-grid');
        for (const baseType of group.types) {
          // upgraded variants replace the base entry in place (Morgro, Solar Gen)
          const type = engine.effectiveBuildType(baseType, s.research.techLevel, inv);
          const def = engine.BUILDING_DEFS[type];
          const locked = def.techReq > s.research.techLevel
            || (UNLOCK_INVENTION[type] !== undefined && !inv.includes(UNLOCK_INVENTION[type]!));
          const afford = s.funds >= def.cost;
          const cell = el('div', `u-build-cell${locked ? ' u-locked' : ''}${!afford && !locked ? ' u-poor' : ''}`);
          cell.appendChild(buildingIcon(type));
          cell.appendChild(el('div', 'u-build-name', def.name));
          cell.appendChild(el('div', 'u-build-cost mono', `${fmtNum(def.cost)} GR`));
          const isNew = type !== baseType && inv.length > 0 && inv[inv.length - 1] === UNLOCK_INVENTION[type];
          if (isNew) cell.appendChild(el('span', 'u-build-new', 'NEW'));
          if (locked) {
            const invId = UNLOCK_INVENTION[type];
            const invDef = invId ? engine.INVENTIONS.find((i) => i.id === invId) : null;
            cell.title = invDef
              ? `Locked — requires the ${invDef.name} invention (Tech Level ${invDef.techLevel})`
              : `Locked — requires Tech Level ${def.techReq}`;
            cell.appendChild(el('div', 'u-build-lock', `TL ${def.techReq}`));
          } else {
            cell.title = `${def.blurb}\nPower draw: ${def.powerMW} MW/mo · Build time: ${def.buildMonths} mo · Crew: ${def.buildCrew}` +
              (def.maxStaff > 0 ? `\nStaff: up to ${def.maxStaff} ${STAFF_PLURAL[def.staffClass ?? 'colonist']}` : '');
            cell.addEventListener('click', () => {
              setUiMode(ctx, 'build', type);
              closePanel(ctx);
            });
          }
          grid.appendChild(cell);
        }
        sec.appendChild(grid);
        body.appendChild(sec);
      }
      body.appendChild(el('p', 'u-hint',
        'Select a structure, then click a tile in the world to place it. Buildings must sit within 12 tiles of a Flux Pod. Right-click / Esc cancels.'));
    },
  });
}
