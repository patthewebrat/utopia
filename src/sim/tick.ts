// Real-time driver + the 13-step monthly tick — GAME_SPEC.md §4.

import type { GameState } from '../types';
import { BUILDING_DEFS } from '../data/buildings';
import { DAYS_PER_MONTH } from '../data/constants';
import { getScenario } from '../data/races';
import {
  allocateLabour, powerBalance, production, consumption, financeMonthly,
  runYards, type MonthContext,
} from './economy';
import { researchMonthly } from './research';
import { birthsAndDeaths, diseaseMonthly } from './population';
import { crimeMonthly } from './crime';
import { randomEventMonthly } from './events';
import { tradeMonthly } from './trade';
import { spyMonthly, spyDaily } from './spy';
import { moraleAndQol } from './qol';
import { moveUnitsDay, shipsDaily } from './units';
import { combatDay } from './combat';
import { aiDaily, aiMonthly } from './ai';
import { totalPop, notify } from './util';

/** advance the simulation by dtDays (fractional). The single entry point for time. */
export function advanceTime(state: GameState, dtDays: number): void {
  if (state.mode !== 'playing' || state.paused) return;
  state.dayFraction += dtDays;
  while (state.dayFraction >= 1 && state.mode === 'playing') {
    state.dayFraction -= 1;
    processDay(state);
  }
}

function processDay(state: GameState): void {
  state.totalDays++;
  state.dayOfMonth++;

  moveUnitsDay(state);       // player unit movement
  aiDaily(state);            // wave spawn/warning, enemy movement, off-map assault
  combatDay(state);          // auto-fire, turrets, mines
  constructionDay(state);    // scaffolds advance pro-rata daily
  shipsDaily(state);         // fuel burn, refuelling, crashes, explorer pads
  spyDaily(state);           // mid-month report at Special Operatives level

  if (state.dayOfMonth >= DAYS_PER_MONTH) {
    monthlyTick(state);
    state.dayOfMonth = 0;
    state.monthIndex++;
    state.month++;
    if (state.month > 12) { state.month = 1; state.year++; }
    if (state.month === 1) {
      // pending tax rate locks in on 1 January
      if (state.finance.taxRate !== state.finance.pendingTaxRate) {
        state.finance.taxRate = state.finance.pendingTaxRate;
        notify(state, 'finance', `Income tax rate is now ${state.finance.taxRate}%.`);
      }
    }
    state.pendingEvents.push({ type: 'month', monthIndex: state.monthIndex });
  }

  checkGameOver(state);
}

function constructionDay(state: GameState): void {
  const strike = state.monthIndex < state.worldEvents.strikeUntilMonth;
  if (strike) return;
  for (const b of state.buildings) {
    if (b.status !== 'scaffold') continue;
    const def = BUILDING_DEFS[b.type];
    if (b.crewAssigned <= 0) continue;
    b.progress += b.crewAssigned / def.buildCrew / DAYS_PER_MONTH;
    if (b.progress >= def.buildMonths) {
      b.status = 'complete';
      b.progress = def.buildMonths;
      b.crewAssigned = 0;
      // capture invention-upgraded stats available at completion time
      if (b.type === 'fuelTank') b.compressed ||= state.research.inventions.includes('compressedFuelTanks');
      if (b.type === 'laserTurret') b.plasma ||= state.research.inventions.includes('plasmaGun');
      if (b.type === 'radar') b.longRange ||= state.research.inventions.includes('longDistanceRadar');
      if (b.type === 'missileLauncher') b.hdx ||= state.research.inventions.includes('hdxMissileLauncher');
      if (b.type === 'commandCentre' && !state.buildings.some((x) => x.type === 'commandCentre' && x.active)) {
        b.active = true;
      }
      notify(state, 'info', `${def.name} construction complete.`, { x: b.x, y: b.y });
    }
  }
}

/** The 13-step monthly tick, in canonical order. */
export function monthlyTick(state: GameState): void {
  const sc = getScenario(state.scenarioId);
  const ctx: MonthContext = { unfed: 0, unsupplied: 0, industryMult: 1 };
  const lm = state.finance.lastMonth;
  lm.taxIncome = 0; lm.supportGrant = 0; lm.researchSpend = 0;
  lm.spyBurn = 0; lm.birthBonus = 0;
  // (trade/construction accumulate in finance.accTradeNet/accConstructionSpend
  //  during the month and are snapshotted into lastMonth after step 12/13)

  allocateLabour(state);        // 1
  powerBalance(state);          // 2
  production(state, ctx);       // 3
  runYards(state);              //   (tank/ship yards consume + produce monthly)
  consumption(state, ctx);      // 4
  researchMonthly(state);       // 5
  birthsAndDeaths(state, ctx);  // 6
  crimeMonthly(state);          // 7
  if (state.mode !== 'playing') return;
  diseaseMonthly(state);        // 8
  if (!sc.sandbox) randomEventMonthly(state);  // 9
  aiMonthly(state);             // 10
  financeMonthly(state);        // 11
  spyMonthly(state);            //    (intelligence burn + reports)
  tradeMonthly(state);          // 12
  moraleAndQol(state);          // 13 (+ medals)

  // snapshot the month's trade/construction accumulators for the Finance screen
  lm.tradeNet = state.finance.accTradeNet;
  lm.constructionSpend = state.finance.accConstructionSpend;
  state.finance.accTradeNet = 0;
  state.finance.accConstructionSpend = 0;
}

function checkGameOver(state: GameState): void {
  if (state.mode !== 'playing') return;
  if (totalPop(state) <= 0) {
    state.mode = 'gameover';
    state.gameOverReason = 'The entire colony has perished.';
    state.pendingEvents.push({ type: 'gameover', victory: false, reason: state.gameOverReason });
    notify(state, 'gameover', 'The colony is dead. Your command is over.');
  }
}
