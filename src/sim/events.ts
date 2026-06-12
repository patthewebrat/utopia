// Random event roll — GAME_SPEC.md §8 (tick step 9). Skipped in Quick-Start.

import type { GameState } from '../types';
import {
  RANDOM_EVENTS, STRIKE_P_LOW_MORALE, EARTH_AID_BASE, EARTH_AID_VAR,
  ORE_STRIKE_YIELD_BONUS, METEOR_DEATHS,
} from '../data/events';
import { REFUGEE_SHIP_COLONISTS, BORDER, DEPOSIT_REVEAL_RADIUS } from '../data/constants';
import { rand, randInt } from '../rng';
import { buildingAt, removeBuilding, killPopulation, notify, ti, cheb } from './util';
import { startOutbreak } from './population';

/** roll once per month; at most one event fires */
export function randomEventMonthly(state: GameState): void {
  const roll = rand(state);
  let acc = 0;
  for (const ev of RANDOM_EVENTS) {
    let p = ev.p;
    if (ev.id === 'strike' && state.morale.displayed < 40) p = STRIKE_P_LOW_MORALE;
    acc += p;
    if (roll < acc) { fireEvent(state, ev.id); return; }
  }
}

function fireEvent(state: GameState, id: string): void {
  switch (id) {
    case 'meteor': {
      if (state.research.inventions.includes('meteorScreen')) {
        notify(state, 'event', 'Meteor inbound — neutralised by the Meteor Screen.');
        return;
      }
      const x = randInt(state, BORDER, state.mapW - BORDER - 1);
      const y = randInt(state, BORDER, state.mapH - BORDER - 1);
      const b = buildingAt(state, x, y);
      if (b) {
        removeBuilding(state, b, false);
        killPopulation(state, METEOR_DEATHS);
        notify(state, 'event', 'A meteor has struck the colony — building destroyed!', { x, y });
      } else {
        notify(state, 'event', 'A meteor has struck nearby. No serious damage.', { x, y });
      }
      break;
    }
    case 'eclipse':
      state.worldEvents.eclipseUntilMonth = state.monthIndex + 2; // current + next month boundary
      notify(state, 'event', 'Solar eclipse — solar power output is zero this month.');
      break;
    case 'virus':
      startOutbreak(state, false);
      break;
    case 'strike':
      state.worldEvents.strikeUntilMonth = state.monthIndex + 2;
      notify(state, 'event', 'Industrial action! Construction halted, industry at half output.');
      break;
    case 'oreStrike': {
      // a random REVEALED ore deposit gains +2 yield (cap 9) — spec §8
      const detector = state.research.inventions.includes('oreDetector');
      const revealed = (x: number, y: number): boolean =>
        detector || state.buildings.some((b) => cheb(b.x, b.y, x, y) <= DEPOSIT_REVEAL_RADIUS);
      const candidates: number[] = [];
      for (let i = 0; i < state.oreYield.length; i++) {
        if (state.oreYield[i] <= 0 || state.oreYield[i] >= 9) continue;
        if (revealed(i % state.mapW, Math.floor(i / state.mapW))) candidates.push(i);
      }
      if (candidates.length > 0) {
        const i = candidates[randInt(state, 0, candidates.length - 1)];
        state.oreYield[i] = Math.min(9, state.oreYield[i] + ORE_STRIKE_YIELD_BONUS);
        notify(state, 'event', 'Geologists report a rich new ore seam!',
          { x: i % state.mapW, y: Math.floor(i / state.mapW) });
      }
      break;
    }
    case 'earthAid': {
      const gift = Math.round(EARTH_AID_BASE + EARTH_AID_VAR * rand(state));
      state.funds += gift;
      notify(state, 'event', `Earth has sent an aid package: +${gift} GR.`);
      break;
    }
    case 'refugees':
      state.pop.colonists += REFUGEE_SHIP_COLONISTS;
      notify(state, 'event', `A refugee ship has landed: +${REFUGEE_SHIP_COLONISTS} colonists.`);
      break;
  }
}
