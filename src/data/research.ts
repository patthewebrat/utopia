// Research thresholds — GAME_SPEC.md §2.

import { RP_PER_LEVEL_FACTOR, MAX_TECH_LEVEL } from './constants';

/** RP needed to advance from level L to L+1 (400 × L). */
export function rpForStep(level: number): number {
  return RP_PER_LEVEL_FACTOR * level;
}

/** Cumulative RP from TL1 to reach `level` (18,000 to TL10). */
export function cumulativeRp(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += rpForStep(l);
  return total;
}

export { MAX_TECH_LEVEL };
