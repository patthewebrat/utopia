// Births, deaths, disease — GAME_SPEC.md §5, §8.

import type { GameState } from '../types';
import {
  BIRTH_RATES, BIRTH_BONUS_GR, BASE_MORTALITY,
  FOOD_SHORTAGE_DEATH_RATE, AIR_SHORTAGE_DEATH_RATE,
  VIRUS_DEATH_RATE,
} from '../data/constants';
import type { MonthContext } from './economy';
import { completeBuildings, totalPop, medicCover, killPopulation, notify } from './util';

/** monthly tick step 6 */
export function birthsAndDeaths(state: GameState, ctx: MonthContext): void {
  const pop = totalPop(state);
  if (pop <= 0) return;

  // births need at least one powered hospital
  const hospital = completeBuildings(state, 'hospital').some((b) => b.powered);
  if (hospital) {
    const rate = BIRTH_RATES[state.pop.birthRate] ?? 0;
    const births = Math.round(rate * pop);
    if (births > 0) {
      state.pop.colonists += births;
      state.stats.totalBirths += births;
      if (state.pop.birthRate === 'high') {
        const bonus = births * BIRTH_BONUS_GR;
        state.funds += bonus;
        state.finance.lastMonth.birthBonus = bonus;
      }
    }
  }

  // deaths
  const cover = medicCover(state);
  const base = BASE_MORTALITY * pop * (1 - 0.5 * cover);
  const food = FOOD_SHORTAGE_DEATH_RATE * ctx.unfed;
  const air = AIR_SHORTAGE_DEATH_RATE * ctx.unsupplied;
  const deaths = Math.round(base + food + air);
  if (deaths > 0) killPopulation(state, deaths);
}

/** monthly tick step 8 */
export function diseaseMonthly(state: GameState): void {
  if (!state.disease) return;
  const cover = medicCover(state);
  // Vaccination (TL4): outbreaks that began post-invention also have deaths ×0.1
  const mitigation = state.disease.mitigated ? 0.1 : 1;
  const deaths = Math.round(VIRUS_DEATH_RATE * state.disease.infected * (1 - 0.7 * cover) * mitigation);
  if (deaths > 0) killPopulation(state, deaths);
  const recoveryRate = 0.25 + 0.5 * cover;
  const recovered = Math.round(state.disease.infected * recoveryRate);
  state.disease.infected = Math.max(0, state.disease.infected - deaths - recovered);
  if (state.disease.infected < 1) {
    state.disease = null;
    notify(state, 'info', 'The epidemic is over.');
  }
}

/** start an outbreak (random event or enemy bio-attack) */
export function startOutbreak(state: GameState, bio: boolean): void {
  const pop = totalPop(state);
  const vaccinated = state.research.inventions.includes('vaccination');
  let rate = bio ? 0.15 : 0.10;
  if (vaccinated) rate = 0.01;
  const infected = Math.round(pop * rate);
  if (infected <= 0) return;
  if (state.disease) {
    state.disease.infected += infected;
    state.disease.mitigated = state.disease.mitigated && vaccinated;
  } else {
    state.disease = { infected, bio, mitigated: vaccinated };
  }
  notify(state, 'danger', bio
    ? 'Enemy bio-weapons have released a plague in the colony!'
    : 'A virus outbreak is spreading through the colony!');
}
