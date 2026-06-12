// Spying — GAME_SPEC.md §11. Level is automatic from the Intelligence Grant balance.

import type { GameState, SpyReport } from '../types';
import { SPY_LEVELS, type SpyLevelDef } from '../data/constants';
import { getScenario } from '../data/races';
import { rand, randPick } from '../rng';
import { notify } from './util';
import { enemyTechLevel } from './ai';

export function currentSpyLevel(state: GameState): SpyLevelDef {
  const bal = state.finance.grants.intelligence;
  let level = SPY_LEVELS[0];
  for (const l of SPY_LEVELS) if (bal >= l.minBalance && l.burn <= bal) level = l;
  return level;
}

/** monthly: burn grant, generate reports */
export function spyMonthly(state: GameState): void {
  const lvl = currentSpyLevel(state);
  state.finance.lastMonth.spyBurn = 0;
  if (lvl.burn > 0) {
    state.finance.grants.intelligence = Math.max(0, state.finance.grants.intelligence - lvl.burn);
    state.finance.lastMonth.spyBurn = lvl.burn;
  }
  if (!state.enemy || state.enemy.destroyed) return;
  if (lvl.reportEveryMonths === 0) { state.spy.monthsSinceReport++; return; }

  state.spy.monthsSinceReport++;
  const due = lvl.reportEveryMonths === 0.5 ? true : state.spy.monthsSinceReport >= lvl.reportEveryMonths;
  if (!due) return;
  state.spy.monthsSinceReport = 0;
  generateReport(state, lvl.level);
  // twice-monthly cadence: the second report arrives ~15 days into the month
  if (lvl.reportEveryMonths === 0.5) state.spy.pendingReportDay = state.totalDays + 15;
}

/** daily: deliver the mid-month report scheduled at Special Operatives level */
export function spyDaily(state: GameState): void {
  if (state.spy.pendingReportDay < 0 || state.totalDays < state.spy.pendingReportDay) return;
  state.spy.pendingReportDay = -1;
  if (!state.enemy || state.enemy.destroyed) return;
  generateReport(state, currentSpyLevel(state).level);
}

function fuzz(state: GameState, value: number, level: number): number {
  if (level === 2 && rand(state) < 0.5) {
    // 50% chance a numeric claim is ±50% wrong
    return Math.max(0, Math.round(value * (0.5 + rand(state))));
  }
  if (level === 3) return Math.max(0, Math.round(value * (0.8 + 0.4 * rand(state)))); // ±20%
  return value;
}

function generateReport(state: GameState, level: number): void {
  const e = state.enemy;
  if (!e) return;
  const sc = getScenario(state.scenarioId);
  const tl = enemyTechLevel(state);
  const lines: string[] = [];

  if (level >= 3) {
    state.spy.reportsAtNormalPlus++;
    if (state.spy.reportsAtNormalPlus >= 2 && !state.spy.cityLocated) {
      state.spy.cityLocated = true;
      lines.push(`We have located the ${sc.name} city. Assault operations are now possible.`);
      notify(state, 'spy', `Intelligence has located the ${sc.name} city.`);
    }
  }

  const force = Math.ceil(sc.waveBase * Math.pow(sc.waveGrowth, Math.max(0, e.waveNumber)));
  if (level === 2) {
    const flavour = [
      `The ${sc.name} are a ${sc.aggression >= 1.2 ? 'highly aggressive' : 'cautious'} species.`,
      `Rumours speak of war preparations in the ${sc.biomeLabel.toLowerCase()}.`,
      `Defectors claim their forces number around ${fuzz(state, force * 3, 2)} units. Unverified.`,
    ];
    lines.push(randPick(state, flavour));
  } else {
    lines.push(`Enemy technology level: ${level >= 4 ? tl : fuzz(state, tl, level)}.`);
    lines.push(`Estimated strike force: ~${fuzz(state, force, level)} units (${Math.round(sc.airMix * 100)}% air).`);
  }

  let cityPct: number | null = null;
  if (level >= 4) {
    cityPct = e.Dmax > 0 ? Math.round((Math.max(0, e.D) / e.Dmax) * 100) : 0;
    lines.push(`City defence grid at ${cityPct}% strength.`);
  } else if (e.D < e.Dmax) {
    const frac = e.D / e.Dmax;
    if (frac < 0.25) lines.push('Their city is in flames — the defence grid is collapsing!');
    else if (frac < 0.5) lines.push('Heavy damage reported inside the enemy city.');
    else if (frac < 0.75) lines.push('Their outer defences are burning…');
  }

  const report: SpyReport = {
    monthIndex: state.monthIndex,
    level,
    title: `Intelligence report — ${SPY_LEVELS[level - 1].name}`,
    body: lines.join(' '),
    cityDefencePct: cityPct,
  };
  state.spy.reports.push(report);
  state.pendingEvents.push({ type: 'spyreport', report });
  notify(state, 'spy', 'New intelligence report received.');
}
