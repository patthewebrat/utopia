// Seeded deterministic PRNG (mulberry32). The PRNG state is a single int32
// stored on GameState.rng so saves replay deterministically.

export interface RngCarrier { rng: number; }

/** next float in [0, 1) — mutates carrier.rng */
export function rand(s: RngCarrier): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** integer in [min, max] inclusive */
export function randInt(s: RngCarrier, min: number, max: number): number {
  return min + Math.floor(rand(s) * (max - min + 1));
}

export function randPick<T>(s: RngCarrier, arr: T[]): T {
  return arr[randInt(s, 0, arr.length - 1)];
}

export function seedFromString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h | 0;
}
