// Morale + Quality of Life recompute + medals — GAME_SPEC.md §5, tick step 13.

import type { GameState } from '../types';
import {
  QOL_WEIGHTS, QOL_MAX_SLEW, MEDAL_BRONZE_QOL, MEDAL_GOLD_QOL, MEDAL_MONTHS,
  LIVING_QUARTERS_CAPACITY, SPORTS_MORALE_BONUS, SPORTS_NEGLECT_MONTHS,
  SPORTS_NEGLECT_PENALTY, VIRUS_MORALE_PENALTY,
} from '../data/constants';
import { completeBuildings, totalPop, notify, clamp } from './util';

/** monthly tick step 13 */
export function moraleAndQol(state: GameState): void {
  const pop = totalPop(state);
  const m = state.morale;

  // ---- morale
  const lq = completeBuildings(state, 'livingQuarters').length;
  const density = lq > 0 ? (pop / (lq * LIVING_QUARTERS_CAPACITY)) * 100 : 999;
  const sportsActive = state.worldEvents.sportsEventActiveMonth === state.monthIndex;
  const sportsComplex = completeBuildings(state, 'sportsComplex').length > 0;
  const monthsSinceEvent = state.worldEvents.lastSportsEventMonth < 0
    ? 999 : state.monthIndex - state.worldEvents.lastSportsEventMonth;

  let raw = 50
    + (state.shortages.food ? -15 : 10)
    + (state.shortages.air ? -20 : 10)
    + (state.shortages.power ? -8 : 5)
    + (density <= 100 ? 5 : -(density - 100) / 4)
    - state.crime.index / 3
    + (sportsActive ? SPORTS_MORALE_BONUS : 0)
    - (monthsSinceEvent >= SPORTS_NEGLECT_MONTHS && sportsComplex ? SPORTS_NEGLECT_PENALTY : 0)
    + 8 * m.battlesWonThisMonth
    - 10 * m.battlesLostThisMonth
    - 2 * m.buildingsLostThisMonth
    + m.pendingDelta
    - (state.disease ? VIRUS_MORALE_PENALTY : 0);
  raw = clamp(raw, 0, 100);
  m.pendingDelta = 0;
  m.current = raw;
  m.displayed = clamp(0.5 * m.displayed + 0.5 * raw, 0, 100);
  m.history12.push(m.displayed);
  if (m.history12.length > 12) m.history12.shift();
  m.battlesWonThisMonth = 0;
  m.battlesLostThisMonth = 0;
  m.buildingsLostThisMonth = 0;

  // ---- deaths window
  state.stats.deaths12.push(state.stats.deathsThisMonth);
  if (state.stats.deaths12.length > 12) state.stats.deaths12.shift();
  state.stats.deathsThisMonth = 0;

  // ---- QoL factor scores (each 0–100)
  const avgMorale12 = m.history12.reduce((a, b) => a + b, 0) / m.history12.length;
  const deaths12 = state.stats.deaths12.reduce((a, b) => a + b, 0);
  const wreckageTiles = state.wreckage.reduce((a, b) => a + b, 0);
  const civSpend12 = state.finance.civSpend12.reduce((a, b) => a + b, 0);
  const won = state.stats.battlesWon, lost = state.stats.battlesLost;

  const score = {
    morale12: clamp(avgMorale12, 0, 100),
    crime: clamp(100 - state.crime.index, 0, 100),
    deaths: clamp(100 - 2000 * (pop > 0 ? deaths12 / pop : 1), 0, 100),
    population: clamp(pop / 20, 0, 100),
    tech: clamp(state.research.techLevel * 10, 0, 100),
    colonySize: clamp(completeBuildings(state).length * 1.25, 0, 100),
    tax: clamp(100 - 5 * state.finance.taxRate, 0, 100),
    battles: clamp(50 + (50 * (won - lost)) / Math.max(1, won + lost), 0, 100),
    tidiness: clamp(100 - 8 * wreckageTiles, 0, 100),
    environment: clamp(Math.min(100, civSpend12 / 50), 0, 100),
  };

  const target =
    (QOL_WEIGHTS.morale12 * score.morale12 +
      QOL_WEIGHTS.crime * score.crime +
      QOL_WEIGHTS.deaths * score.deaths +
      QOL_WEIGHTS.population * score.population +
      QOL_WEIGHTS.tech * score.tech +
      QOL_WEIGHTS.colonySize * score.colonySize +
      QOL_WEIGHTS.tax * score.tax +
      QOL_WEIGHTS.battles * score.battles +
      QOL_WEIGHTS.tidiness * score.tidiness +
      QOL_WEIGHTS.environment * score.environment) / 100;

  state.qol = clamp(state.qol + clamp(target - state.qol, -QOL_MAX_SLEW, QOL_MAX_SLEW), 0, 100);

  // ---- medals
  state.stats.monthsQol80 = state.qol >= MEDAL_BRONZE_QOL ? state.stats.monthsQol80 + 1 : 0;
  state.stats.monthsQol90 = state.qol >= MEDAL_GOLD_QOL ? state.stats.monthsQol90 + 1 : 0;
  if (!state.stats.bronzeMedal && state.stats.monthsQol80 >= MEDAL_MONTHS) {
    state.stats.bronzeMedal = true;
    state.pendingEvents.push({ type: 'medal', medal: 'bronze' });
    notify(state, 'medal', 'Quality of Life held above 80% for a year — BRONZE MEDAL. Scenario passed!');
  }
  if (!state.stats.goldMedal && state.stats.monthsQol90 >= MEDAL_MONTHS) {
    state.stats.goldMedal = true;
    state.pendingEvents.push({ type: 'medal', medal: 'gold' });
    notify(state, 'medal', 'Quality of Life held above 90% for a year — GOLD MEDAL!');
  }

  // sports event lifecycle: a called event opens on the 1st of next month
  if (state.worldEvents.sportsEventCalled) {
    state.worldEvents.sportsEventCalled = false;
    state.worldEvents.sportsEventActiveMonth = state.monthIndex + 1;
    state.worldEvents.lastSportsEventMonth = state.monthIndex + 1;
  }
}
