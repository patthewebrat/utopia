// Random event table — GAME_SPEC.md §8. One roll per month, at most one event.

export type RandomEventId =
  | 'meteor' | 'eclipse' | 'virus' | 'strike' | 'oreStrike' | 'earthAid' | 'refugees';

export interface RandomEventDef {
  id: RandomEventId;
  name: string;
  /** base probability per month (0–1) */
  p: number;
  helpful: boolean;
}

export const RANDOM_EVENTS: RandomEventDef[] = [
  { id: 'meteor', name: 'Meteor strike', p: 0.03, helpful: false },
  { id: 'eclipse', name: 'Solar eclipse', p: 0.02, helpful: false },
  { id: 'virus', name: 'Virus outbreak', p: 0.03, helpful: false },
  { id: 'strike', name: 'Industrial action', p: 0.02, helpful: false }, // 5% if displayedMorale < 40
  { id: 'oreStrike', name: 'Ore strike', p: 0.02, helpful: true },
  { id: 'earthAid', name: 'Earth aid package', p: 0.015, helpful: true },
  { id: 'refugees', name: 'Refugee ship', p: 0.015, helpful: true },
];

export const STRIKE_P_LOW_MORALE = 0.05;
export const EARTH_AID_BASE = 2000;
export const EARTH_AID_VAR = 3000;
export const ORE_STRIKE_YIELD_BONUS = 2;
export const METEOR_DEATHS = 5;
