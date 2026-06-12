// Master colour tokens — transcription of docs/ART_DIRECTION.md §3.
// All shading is derived from these via shade()/alpha(); never invent new hues.

import type { BiomeId } from '../types';

export const UI = {
  bg: '#070B0E',
  panel: '#0D141A',
  panelEdge: '#12303A',
  border: '#1FB6C9',
  cyan: '#37E0F2',
  cyanDim: '#1A7E8C',
  amber: '#FFB347',
  amberDeep: '#D97B1F',
  text: '#D8E6EA',
  textDim: '#7E949C',
  warn: '#FF4D4D',
  warnDark: '#8C1A1A',
  ok: '#5CE08A',
  violet: '#A07BE8',
} as const;

export const PLAYER = {
  primary: '#19B8A6',
  secondary: '#E8F4F2',
  glow: '#5FF2DC',
} as const;

export const ENEMY = {
  primary: '#C8102E',
  secondary: '#141014',
  glow: '#FF3B30',
} as const;

export interface BiomePalette {
  groundA: string;
  groundB: string;
  groundDeep: string;
  feature1: string;
  feature2: string;
  accent: string;
  ambient: string;
  /** drifting fog bands (canyon/badlands family only) */
  fog: string | null;
}

const DESERT: BiomePalette = {
  groundA: '#C9A86B', groundB: '#A8854C', groundDeep: '#6E5430',
  feature1: '#8C8C84', feature2: '#5C7A4A', accent: '#E8C84A',
  ambient: '#FFE2B0', fog: null,
};
const ICE: BiomePalette = {
  groundA: '#C7D9EE', groundB: '#93AECF', groundDeep: '#4E6B96',
  feature1: '#E9F4FF', feature2: '#8A7458', accent: '#6FE3E8',
  ambient: '#DCEBFF', fog: null,
};
const VOLCANIC: BiomePalette = {
  groundA: '#3A3034', groundB: '#241D22', groundDeep: '#120D10',
  feature1: '#57414A', feature2: '#FF5A1F', accent: '#FFC93C',
  ambient: '#FF8A5C', fog: null,
};
const MOSS: BiomePalette = {
  groundA: '#4E7A3C', groundB: '#33572B', groundDeep: '#1C331B',
  feature1: '#6E9C50', feature2: '#2E4630', accent: '#D957A8',
  ambient: '#C8E8A8', fog: null,
};
const FOGROCK: BiomePalette = {
  groundA: '#4A4A50', groundB: '#303036', groundDeep: '#1A1A1E',
  feature1: '#6A6A72', feature2: '#C2C2B8', accent: '#E08A2E',
  ambient: '#9AA0AA', fog: '#B8C0C8',
};
const CRYSTAL: BiomePalette = {
  groundA: '#8C3038', groundB: '#5E1F28', groundDeep: '#38121A',
  feature1: '#E8A0B4', feature2: '#1F6E6A', accent: '#B47BE8',
  ambient: '#F0B0C0', fog: null,
};

/** the 10 scenario biomes mapped onto the six master palettes (with tinted variants) */
export const BIOME_PALETTES: Record<BiomeId, BiomePalette> = {
  mossy: MOSS,
  marsh: { ...MOSS, groundA: '#456E42', groundB: '#2B4A30', groundDeep: '#16281C', fog: '#A8C0B0' },
  volcanic: VOLCANIC,
  desert: DESERT,
  canyon: { ...FOGROCK, groundA: '#5C5048', groundB: '#3C342E', groundDeep: '#201B16' },
  ice: ICE,
  tundra: { ...ICE, groundA: '#A8C2C8', groundB: '#7795A4', groundDeep: '#3E5A70', accent: '#7CE8C0' },
  crystalline: CRYSTAL,
  badlands: FOGROCK,
  wasteland: { ...FOGROCK, groundA: '#5E4640', groundB: '#3E2C28', groundDeep: '#221614', feature2: '#A89C8E' },
};

// ---------------------------------------------------------------- helpers

const hexCache = new Map<string, [number, number, number]>();

export function rgb(color: string): [number, number, number] {
  let c = hexCache.get(color);
  if (!c) {
    if (color.startsWith('#')) {
      c = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
    } else {
      // 'rgb(r,g,b)' / 'rgba(r,g,b,a)' from a previous shade()/mix() pass
      const m = color.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      c = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [128, 128, 128];
    }
    hexCache.set(color, c);
  }
  return c;
}

/** lighten (f>0) / darken (f<0) a hex colour; f in -1..1 */
export function shade(hex: string, f: number): string {
  const [r, g, b] = rgb(hex);
  const t = f > 0 ? 255 : 0;
  const a = Math.abs(f);
  const m = (v: number) => Math.round(v + (t - v) * a);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

export function alpha(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** mix two hex colours, t in 0..1 */
export function mix(hexA: string, hexB: string, t: number): string {
  const a = rgb(hexA), b = rgb(hexB);
  const m = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}
