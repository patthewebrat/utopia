// Scenario / race table — GAME_SPEC.md §9, in original difficulty order, plus Quick-Start.

import type { ScenarioDef } from '../types';
import { QUICKSTART_FUNDS } from './constants';

export const SCENARIOS: ScenarioDef[] = [
  {
    id: 'quickstart', name: 'Quick-Start', difficulty: 0, sandbox: true,
    biome: 'mossy', biomeLabel: 'Mossy green steppe',
    briefing: 'Sandbox posting: a generous, peaceful world with 500,000 GR of seed funding. No rival claims, no surprises. Build the colony of your dreams, Commander.',
    funds: QUICKSTART_FUNDS, oreClusters: 14, oreRichness: 7, fuelClusters: 12, fuelRichness: 7,
    firstAttackMonth: -1, waveInterval: 0, waveBase: 0, waveGrowth: 0, airMix: 0,
    startTL: 1, monthsPerTL: 0, statMult: 0, aggression: 0,
    bioAttackChance: 0, stealsFunds: false, huntsCommandCentre: false,
  },
  {
    id: 'eldorians', name: 'Eldorians', difficulty: 1, sandbox: false,
    biome: 'mossy', biomeLabel: 'Mossy green steppe',
    briefing: 'Survey Command rates this moss-green world a textbook colony site. One complication: the Eldorians, a methodical herd-species of the Vacullo Federation, have filed a rival claim. They are slow to anger and slower to mobilise — but they do not forget. Build well, Commander; you may have a year of peace. You will not have two.',
    funds: 80000, oreClusters: 12, oreRichness: 6, fuelClusters: 10, fuelRichness: 6,
    firstAttackMonth: 14, waveInterval: 6, waveBase: 2, waveGrowth: 1.15, airMix: 0.30,
    startTL: 1, monthsPerTL: 12, statMult: 0.8, aggression: 0.8,
    bioAttackChance: 0, stealsFunds: false, huntsCommandCentre: false,
  },
  {
    id: 'vroarscans', name: 'Vroarscans', difficulty: 2, sandbox: false,
    biome: 'volcanic', biomeLabel: 'Volcanic ashfields',
    briefing: 'The ash plains of this volcanic world hide the richest fuel seams on the frontier. The Vroarscans want them too. They are a brute-force culture: everything they build crawls, and everything that crawls carries a gun. Expect armoured columns, Commander, and mine your approaches.',
    funds: 70000, oreClusters: 12, oreRichness: 6, fuelClusters: 12, fuelRichness: 7,
    firstAttackMonth: 12, waveInterval: 6, waveBase: 2, waveGrowth: 1.20, airMix: 0.10,
    startTL: 1, monthsPerTL: 11, statMult: 0.9, aggression: 0.9,
    bioAttackChance: 0, stealsFunds: false, huntsCommandCentre: false,
  },
  {
    id: 'soomanii', name: 'Soomanii', difficulty: 3, sandbox: false,
    biome: 'desert', biomeLabel: 'Sand desert, dunes',
    briefing: 'A dune world of punishing heat. The nomadic Soomanii strike from the open sky and the open sand alike, then vanish into the storms. Their raids come early and from any compass point. Ring your colony — there is no safe flank here.',
    funds: 64000, oreClusters: 10, oreRichness: 5, fuelClusters: 10, fuelRichness: 6,
    firstAttackMonth: 10, waveInterval: 5, waveBase: 3, waveGrowth: 1.20, airMix: 0.50,
    startTL: 2, monthsPerTL: 11, statMult: 0.9, aggression: 1.0,
    bioAttackChance: 0, stealsFunds: false, huntsCommandCentre: false,
  },
  {
    id: 'kalkriken', name: 'Kal-Kriken', difficulty: 4, sandbox: false,
    biome: 'canyon', biomeLabel: 'Rocky canyonlands',
    briefing: 'The Kal-Kriken claimed these canyons before your boosters fired, and they fight like it. Their assault burrowers ignore terrain you would call impassable and they go straight for the head: your Command Centre. Keep a spare, Commander, and keep it far away.',
    funds: 58000, oreClusters: 10, oreRichness: 5, fuelClusters: 9, fuelRichness: 5,
    firstAttackMonth: 9, waveInterval: 5, waveBase: 3, waveGrowth: 1.25, airMix: 0.20,
    startTL: 2, monthsPerTL: 10, statMult: 1.0, aggression: 1.2,
    bioAttackChance: 0, stealsFunds: false, huntsCommandCentre: true,
  },
  {
    id: 'catalytes', name: 'Catalytes', difficulty: 5, sandbox: false,
    biome: 'marsh', biomeLabel: 'Fog-shrouded marsh',
    briefing: 'Permanent fog shrouds this marsh world; your radar engineers already hate it. The Catalytes are patient ambushers who own the grey sky above you. Radar coverage without gaps is not advice — it is survival.',
    funds: 52000, oreClusters: 10, oreRichness: 5, fuelClusters: 9, fuelRichness: 5,
    firstAttackMonth: 8, waveInterval: 5, waveBase: 3, waveGrowth: 1.25, airMix: 0.60,
    startTL: 3, monthsPerTL: 10, statMult: 1.0, aggression: 1.0,
    bioAttackChance: 0, stealsFunds: false, huntsCommandCentre: false,
  },
  {
    id: 'squizquijy', name: 'Squiz-Quijy', difficulty: 6, sandbox: false,
    biome: 'ice', biomeLabel: 'Ice floes, frozen sea',
    briefing: 'An ocean frozen to the horizon. The Squiz-Quijy thrive in the cold, and their weapons are alive: engineered plagues drift ahead of every assault wave. Fund your hospitals, push for Vaccination, and do not let the ice lull you.',
    funds: 46000, oreClusters: 9, oreRichness: 4, fuelClusters: 8, fuelRichness: 5,
    firstAttackMonth: 7, waveInterval: 4, waveBase: 4, waveGrowth: 1.25, airMix: 0.40,
    startTL: 3, monthsPerTL: 9, statMult: 1.0, aggression: 1.1,
    bioAttackChance: 0.25, stealsFunds: false, huntsCommandCentre: false,
  },
  {
    id: 'pascalenes', name: 'Pascalenes', difficulty: 7, sandbox: false,
    biome: 'crystalline', biomeLabel: 'Crystalline highlands',
    briefing: 'The crystal highlands sing when the wind rises — and when the Pascalene air fleet does. They field the finest pilots in the Federation and hold their tech edge jealously. Your turrets will earn their power draw this tour, Commander.',
    funds: 40000, oreClusters: 9, oreRichness: 4, fuelClusters: 8, fuelRichness: 4,
    firstAttackMonth: 6, waveInterval: 4, waveBase: 4, waveGrowth: 1.30, airMix: 0.70,
    startTL: 4, monthsPerTL: 9, statMult: 1.1, aggression: 1.1,
    bioAttackChance: 0, stealsFunds: false, huntsCommandCentre: false,
  },
  {
    id: 'tilikanthua', name: 'Tilikanthua', difficulty: 8, sandbox: false,
    biome: 'badlands', biomeLabel: 'Storm-wracked badlands',
    briefing: 'Storm-wracked, mineral-poor, and contested by the most aggressive race on the frontier rolls. Tilikanthua war-packs attack without pattern or pause. Earth expects losses. Earth still expects 80%.',
    funds: 34000, oreClusters: 8, oreRichness: 4, fuelClusters: 7, fuelRichness: 4,
    firstAttackMonth: 5, waveInterval: 4, waveBase: 5, waveGrowth: 1.30, airMix: 0.50,
    startTL: 4, monthsPerTL: 8, statMult: 1.15, aggression: 1.3,
    bioAttackChance: 0, stealsFunds: false, huntsCommandCentre: true,
  },
  {
    id: 'vanacancia', name: 'Vanacancia', difficulty: 9, sandbox: false,
    biome: 'tundra', biomeLabel: 'Night-side tundra (aurora)',
    briefing: 'A tundra world locked in permanent night beneath the auroras. The Vanacancia see in the dark; you do not. They arrive with technology you have not invented yet. Spend on Intelligence, Commander — what you cannot see will kill you.',
    funds: 28000, oreClusters: 8, oreRichness: 3, fuelClusters: 7, fuelRichness: 4,
    firstAttackMonth: 4, waveInterval: 3, waveBase: 5, waveGrowth: 1.35, airMix: 0.60,
    startTL: 5, monthsPerTL: 8, statMult: 1.2, aggression: 1.3,
    bioAttackChance: 0, stealsFunds: false, huntsCommandCentre: true,
  },
  {
    id: 'lucratians', name: 'Lucratians', difficulty: 10, sandbox: false,
    biome: 'wasteland', biomeLabel: 'Scorched red wasteland',
    briefing: 'The Lucratians are the Federation’s bankers, and they have foreclosed on this scorched wasteland — and on you. Their raids are business: fast, early, and they take your credits as well as your lives. Nothing about this posting is fair. Succeed anyway.',
    funds: 25000, oreClusters: 7, oreRichness: 3, fuelClusters: 6, fuelRichness: 3,
    firstAttackMonth: 3, waveInterval: 3, waveBase: 6, waveGrowth: 1.35, airMix: 0.50,
    startTL: 5, monthsPerTL: 7, statMult: 1.25, aggression: 1.5,
    bioAttackChance: 0, stealsFunds: true, huntsCommandCentre: true,
  },
];

export function getScenario(id: string): ScenarioDef {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scenario: ${id}`);
  return s;
}
