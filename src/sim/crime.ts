// Crime pressure, suppression and the escalation ladder — GAME_SPEC.md §6.

import type { GameState } from '../types';
import {
  CRIME_THEFT_THRESHOLD, CRIME_MURDERS_THRESHOLD, CRIME_TERRORISM_THRESHOLD,
  CRIME_ASSASSINATION_THRESHOLD, CRIME_WARNING_THRESHOLD, CRIME_ASSASSINATION_MONTHS,
  CRIME_SUPPRESSION_PER_SECURITY, CRIME_STAGE_COOLDOWN_MONTHS,
} from '../data/constants';
import { rand, randPick } from '../rng';
import { completeBuildings, totalPop, killPopulation, removeBuilding, notify, clamp } from './util';

/** monthly tick step 7 */
export function crimeMonthly(state: GameState): void {
  const pop = totalPop(state);
  const c = state.crime;

  // effective security: staffed officers in powered HQs, minus the hire ramp
  const staffed = completeBuildings(state, 'securityHQ')
    .filter((b) => b.powered)
    .reduce((s, b) => s + b.staff, 0);
  const effective = Math.max(0, staffed - state.pop.securityNew - 0.5 * state.pop.securityTraining);

  const pressure = 0.5 + pop / 400 + Math.max(0, 50 - state.morale.displayed) / 20;
  const suppression = CRIME_SUPPRESSION_PER_SECURITY * effective;
  c.index = clamp(c.index + pressure - suppression, 0, 100);

  // advance the security hire ramp
  state.pop.securityTraining = state.pop.securityNew;
  state.pop.securityNew = 0;

  // one-time warning
  if (c.index > CRIME_WARNING_THRESHOLD && !c.warned85) {
    c.warned85 = true;
    notify(state, 'crime', 'WARNING: criminal cartels are plotting against your life, Commander!');
  }

  // assassination — game over after 3 consecutive months over 90
  if (c.index > CRIME_ASSASSINATION_THRESHOLD) {
    c.monthsOver90++;
    if (c.monthsOver90 >= CRIME_ASSASSINATION_MONTHS) {
      state.mode = 'gameover';
      state.gameOverReason = 'You were assassinated by the criminal cartels.';
      state.pendingEvents.push({ type: 'gameover', victory: false, reason: state.gameOverReason });
      notify(state, 'gameover', 'You have been assassinated. The colony has fallen to crime.');
      return;
    }
  } else {
    c.monthsOver90 = 0;
  }

  // escalation ladder: top stage whose threshold is met fires (2-month cooldown each)
  const m = state.monthIndex;
  if (c.index > CRIME_TERRORISM_THRESHOLD && m - c.lastTerrorismMonth >= CRIME_STAGE_COOLDOWN_MONTHS) {
    c.lastTerrorismMonth = m;
    const targets = completeBuildings(state).filter((b) => b.type !== 'commandCentre');
    if (targets.length > 0) {
      if (state.research.inventions.includes('bombDetector') && rand(state) < 0.75) {
        c.index = clamp(c.index - 5, 0, 100);
        notify(state, 'crime', 'Bomb Detector foiled a terrorist attack — perpetrators arrested.');
      } else {
        const b = randPick(state, targets);
        removeBuilding(state, b, false);
        notify(state, 'crime', `Terrorists have bombed the ${b.type}!`, { x: b.x, y: b.y });
      }
    }
  } else if (c.index > CRIME_MURDERS_THRESHOLD && m - c.lastMurdersMonth >= CRIME_STAGE_COOLDOWN_MONTHS) {
    c.lastMurdersMonth = m;
    const victims = Math.round(c.index / 10);
    killPopulation(state, victims);
    state.morale.pendingDelta -= 8;
    notify(state, 'crime', `${victims} colonists have been murdered by criminal gangs.`);
  } else if (c.index > CRIME_THEFT_THRESHOLD && m - c.lastTheftMonth >= CRIME_STAGE_COOLDOWN_MONTHS) {
    c.lastTheftMonth = m;
    const pct = Math.min(15, 5 + c.index / 10);
    const stolen = Math.round((state.funds * pct) / 100);
    if (stolen > 0) {
      state.funds -= stolen;
      notify(state, 'crime', `Cartel hackers stole ${stolen} GR from colony funds.`);
    }
  }
}
