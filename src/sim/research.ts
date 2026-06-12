// Research accrual, tech levels, invention unlocks — GAME_SPEC.md §2.

import type { GameState } from '../types';
import { GR_PER_SCIENTIST_MONTH, MAX_TECH_LEVEL } from '../data/constants';
import { rpForStep } from '../data/research';
import { inventionsForLevel } from '../data/inventions';
import { completeBuildings, notify } from './util';

/** monthly tick step 5 */
export function researchMonthly(state: GameState): void {
  const fundedScientists = completeBuildings(state, 'laboratory')
    .filter((b) => b.powered)
    .reduce((s, b) => s + b.staff, 0);

  let civSpent = 0;
  if (fundedScientists > 0) {
    const maxSpend = GR_PER_SCIENTIST_MONTH * fundedScientists;
    const g = state.finance.grants;
    // drawn 50/50 from Military + Civilian; remainder from the other
    let want = maxSpend;
    let mil = Math.min(g.military, want / 2);
    let civ = Math.min(g.civilian, want / 2);
    want -= mil + civ;
    if (want > 0) {
      const extraMil = Math.min(g.military - mil, want);
      mil += extraMil; want -= extraMil;
      const extraCiv = Math.min(g.civilian - civ, want);
      civ += extraCiv; want -= extraCiv;
    }
    g.military -= mil;
    g.civilian -= civ;
    civSpent = civ;
    const actualSpend = mil + civ;
    const fundingRatio = maxSpend > 0 ? actualSpend / maxSpend : 0;
    state.research.rp += fundedScientists * (1 + 2 * fundingRatio);
    state.finance.lastMonth.researchSpend = Math.round(actualSpend);
  } else {
    state.finance.lastMonth.researchSpend = 0;
  }
  // civilian-grant spend feeds the Environment QoL factor (12-month window)
  state.finance.civSpend12.push(civSpent);
  if (state.finance.civSpend12.length > 12) state.finance.civSpend12.shift();

  // level-ups (can cascade)
  while (
    state.research.techLevel < MAX_TECH_LEVEL &&
    state.research.rp >= rpForStep(state.research.techLevel)
  ) {
    state.research.rp -= rpForStep(state.research.techLevel);
    state.research.techLevel++;
    const tl = state.research.techLevel;
    state.pendingEvents.push({ type: 'techlevel', techLevel: tl });
    notify(state, 'invention', `Technology level ${tl} reached!`);
    for (const inv of inventionsForLevel(tl)) {
      state.research.inventions.push(inv.id);
      state.pendingEvents.push({ type: 'invention', inventionId: inv.id, techLevel: tl });
      notify(state, 'invention', `Invention: ${inv.name} — ${inv.description}`);
      applyRetroactiveInvention(state, inv.id);
    }
  }
}

function applyRetroactiveInvention(state: GameState, id: string): void {
  if (id === 'plasmaGun') {
    // upgrades ALL turrets, existing included
    for (const b of state.buildings) if (b.type === 'laserTurret') b.plasma = true;
  }
}
