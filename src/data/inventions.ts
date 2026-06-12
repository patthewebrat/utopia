// Invention unlock map — GAME_SPEC.md §2. Exactly two per tech level, TL2–TL10.

export interface InventionDef {
  id: string;
  name: string;
  techLevel: number;
  description: string;
}

export const INVENTIONS: InventionDef[] = [
  { id: 'fuelDetector', name: 'Fuel Detector', techLevel: 2, description: 'All fuel deposits are revealed on the Map.' },
  { id: 'compressedFuelTanks', name: 'Compressed Fuel Tanks', techLevel: 2, description: 'New Fuel Tanks store 750 units.' },
  { id: 'oreDetector', name: 'Ore Detector', techLevel: 3, description: 'All ore deposits are revealed on the Map.' },
  { id: 'spaceMossConverter', name: 'Space Moss Converter', techLevel: 3, description: 'Converts space moss to air (200 people/mo). Buildable on moss tiles.' },
  { id: 'landMine', name: 'Land Mine', techLevel: 4, description: 'Single-use mine: 120 damage to enemy land units.' },
  { id: 'vaccination', name: 'Vaccination', techLevel: 4, description: 'Future virus events: 90% reduced infection and deaths.' },
  { id: 'solarGenerator', name: 'Solar Generator', techLevel: 5, description: 'Replaces the Solar Panel: 4 MW/mo.' },
  { id: 'longDistanceRadar', name: 'Long Distance Radar', techLevel: 5, description: 'Future radars have range 28.' },
  { id: 'morgroHydroponics', name: 'Morgro Hydroponics', techLevel: 6, description: 'Replaces Hydroponics: food for 200 people/mo.' },
  { id: 'plasmaGun', name: 'Plasma Gun', techLevel: 6, description: 'Upgrades ALL laser turrets (existing included): 18 dmg, 7-tile range.' },
  { id: 'hoverTank', name: 'Hover Tank', techLevel: 7, description: 'Future tanks are hover tanks: faster, tougher, cross rough terrain.' },
  { id: 'bombDetector', name: 'Bomb Detector', techLevel: 7, description: '75% of terrorist bombings prevented; perpetrators caught (crime −5).' },
  { id: 'hdxMissileLauncher', name: 'HDX Missile Launcher', techLevel: 8, description: 'Future launchers: range 16, 140 dmg, auto-tracking.' },
  { id: 'matterTransporter', name: 'Matter Transporter', techLevel: 8, description: 'Auto-refuels friendly ships in flight anywhere on the map.' },
  { id: 'spySatellite', name: 'Spy Satellite', techLevel: 9, description: 'All enemy units always visible on the Map.' },
  { id: 'meteorScreen', name: 'Meteor Screen', techLevel: 9, description: 'Meteor strikes are auto-neutralised.' },
  { id: 'fusionCruiser', name: 'Fusion Cruiser', techLevel: 10, description: 'Fuel-free heavy warship, buildable at Ship Yards.' },
  { id: 'tankTeleport', name: 'Tank Teleport', techLevel: 10, description: 'Teleports tanks instantly to any tactical marker.' },
];

export function inventionsForLevel(tl: number): InventionDef[] {
  return INVENTIONS.filter((i) => i.techLevel === tl);
}
