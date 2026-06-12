// Six procedural vector adviser portraits — layered flat shapes per ART_DIRECTION §7.
// Original art: parameterised faces, zero tracing.

export type AdviserId =
  | 'psychiatrist' | 'administrator' | 'finance' | 'engineer' | 'research' | 'commander';

export interface AdviserMeta {
  id: AdviserId;
  key: string;            // F1..F6
  title: string;
  name: string;
}

export const ADVISERS: AdviserMeta[] = [
  { id: 'psychiatrist',  key: 'F1', title: 'Senior Psychiatrist',  name: 'Dr. M. Veld' },
  { id: 'administrator', key: 'F2', title: 'Colony Administrator', name: 'Adm. T. Okafor' },
  { id: 'finance',       key: 'F3', title: 'Finance Consultant',   name: 'J. Sterling' },
  { id: 'engineer',      key: 'F4', title: 'Civil Engineer',       name: 'Eng. R. Castell' },
  { id: 'research',      key: 'F5', title: 'Head of Research',     name: 'Prof. A. Niemi' },
  { id: 'commander',     key: 'F6', title: 'Supreme Commander',    name: 'Cdr. E. Vance' },
];

interface P {
  skin: string; hairCol: string; coat: string; coatTrim: string;
  hair: string;           // svg path(s) for hair
  extra: string;          // accessory layer
  jaw: number;            // jaw width tweak
}

const DEFS: Record<AdviserId, P> = {
  psychiatrist: {
    skin: '#D9B08F', hairCol: '#C9CDD4', coat: '#5B4A8E', coatTrim: '#A07BE8', jaw: 0,
    // silver asymmetric bob
    hair: '<path d="M28 36 Q26 16 50 14 Q74 16 73 40 L68 34 Q66 22 50 21 Q36 22 34 34 L36 52 Q30 48 28 36Z"/>',
    // neural-lace temple implant + high collar
    extra: '<circle cx="66" cy="38" r="2.2" fill="#A07BE8"/><circle cx="69" cy="43" r="1.5" fill="#A07BE8"/>'
      + '<path d="M34 86 L42 70 L58 70 L66 86" fill="none" stroke="#A07BE8" stroke-width="2"/>',
  },
  administrator: {
    skin: '#7A4F33', hairCol: '#241B14', coat: '#19B8A6', coatTrim: '#E8F4F2', jaw: 4,
    hair: '<path d="M30 32 Q32 14 50 14 Q68 14 70 32 L66 28 Q62 20 50 20 Q38 20 34 28Z"/>',
    // amber data monocle + tablet
    extra: '<circle cx="61" cy="42" r="7.5" fill="rgba(255,179,71,0.25)" stroke="#FFB347" stroke-width="1.8"/>'
      + '<path d="M68 44 L74 46" stroke="#FFB347" stroke-width="1.5"/>'
      + '<rect x="24" y="78" width="18" height="12" rx="2" fill="#10181E" stroke="#37E0F2" stroke-width="1"/>',
  },
  finance: {
    skin: '#E5C29A', hairCol: '#15151B', coat: '#23262E', coatTrim: '#FFB347', jaw: -4,
    // slick swept-back hair
    hair: '<path d="M31 34 Q30 13 52 13 Q70 15 69 33 Q66 20 52 19 Q40 19 36 26 L34 44Z"/>',
    // gold ear cuff + pinstripe collar + smirk override drawn after mouth
    extra: '<path d="M30 44 q-1 4 1 7" stroke="#FFB347" stroke-width="2.4" fill="none"/>'
      + '<path d="M38 86 L46 70 L54 70 L62 86" fill="none" stroke="#FFB347" stroke-width="1.4"/>'
      + '<path d="M44 58 q5 3 11 -1" stroke="#8A5A38" stroke-width="1.8" fill="none"/>',
  },
  engineer: {
    skin: '#C68B59', hairCol: '#4A3424', coat: '#FFB347', coatTrim: '#E8F4F2', jaw: 5,
    hair: '<path d="M31 38 Q31 24 50 23 Q69 24 69 38 L65 34 Q60 28 50 28 Q40 28 35 34Z"/>',
    // white hard-hat with teal stripe + regolith smudge
    extra: '<path d="M28 30 Q30 10 50 10 Q70 10 72 30 L72 33 L28 33 Z" fill="#E8F4F2"/>'
      + '<rect x="28" y="27" width="44" height="4" fill="#19B8A6"/>'
      + '<ellipse cx="38" cy="52" rx="3.5" ry="2" fill="rgba(60,45,30,0.5)"/>',
  },
  research: {
    skin: '#8B5E3C', hairCol: '#5C5650', coat: '#7B5EC8', coatTrim: '#A07BE8', jaw: -2,
    // untidy grey-streaked afro
    hair: '<path d="M27 38 Q22 12 50 11 Q78 12 73 38 Q74 26 64 20 Q56 14 44 16 Q30 19 29 30Z"/>'
      + '<circle cx="30" cy="26" r="6"/><circle cx="40" cy="17" r="7"/><circle cx="54" cy="14" r="7"/><circle cx="66" cy="20" r="6.5"/><circle cx="71" cy="30" r="5"/>',
    // AR goggles pushed up + raised eyebrow
    extra: '<rect x="34" y="24" width="32" height="7" rx="3.5" fill="#10181E" stroke="#A07BE8" stroke-width="1.5"/>'
      + '<path d="M55 38 q4 -3 8 -1" stroke="#3A2E22" stroke-width="1.8" fill="none"/>',
  },
  commander: {
    skin: '#B98A66', hairCol: '#3A332C', coat: '#4A525C', coatTrim: '#19B8A6', jaw: 3,
    // close crop
    hair: '<path d="M31 32 Q33 17 50 17 Q67 17 69 32 L65 29 Q60 23 50 23 Q40 23 35 29Z"/>',
    // rank bars + thin facial scar
    extra: '<path d="M62 48 L66 58" stroke="#8A5A48" stroke-width="1.4"/>'
      + '<rect x="30" y="80" width="10" height="3" fill="#19B8A6"/><rect x="30" y="85" width="10" height="3" fill="#19B8A6"/>',
  },
};

/** 100×100 viewBox portrait SVG string */
export function portraitSvg(id: AdviserId): string {
  const p = DEFS[id];
  const j = p.jaw;
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
  <defs>
    <linearGradient id="bg-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#13242C"/><stop offset="1" stop-color="#0A1116"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="url(#bg-${id})"/>
  <circle cx="50" cy="40" r="34" fill="rgba(55,224,242,0.05)"/>
  <!-- shoulders / coat -->
  <path d="M14 100 Q16 74 36 69 L64 69 Q84 74 86 100 Z" fill="${p.coat}"/>
  <path d="M40 70 L50 84 L60 70" fill="none" stroke="${p.coatTrim}" stroke-width="2"/>
  <!-- neck -->
  <rect x="43" y="58" width="14" height="14" rx="4" fill="${p.skin}"/>
  <!-- head -->
  <path d="M${33 - j / 2} 38 Q33 18 50 18 Q67 18 ${67 + j / 2} 38 Q${67 + j} 56 50 64 Q${33 - j} 56 ${33 - j / 2} 38 Z" fill="${p.skin}"/>
  <!-- rim light (NW) -->
  <path d="M${33 - j / 2} 38 Q33 18 50 18 L50 22 Q37 22 ${36 - j / 2} 38 Z" fill="rgba(232,244,242,0.35)"/>
  <!-- eyes -->
  <ellipse cx="42" cy="42" rx="2.6" ry="1.8" fill="#1A1A22"/>
  <ellipse cx="58" cy="42" rx="2.6" ry="1.8" fill="#1A1A22"/>
  <path d="M38 38 q4 -2.5 8 -0.5" stroke="#2E241C" stroke-width="1.4" fill="none"/>
  <path d="M54 37.5 q4 -2 8 0.5" stroke="#2E241C" stroke-width="1.4" fill="none"/>
  <!-- nose + mouth -->
  <path d="M50 44 q-2 5 0 7" stroke="rgba(40,24,16,0.45)" stroke-width="1.4" fill="none"/>
  <path d="M45 57 q5 2.5 10 0" stroke="#8A5A48" stroke-width="1.8" fill="none"/>
  <!-- hair -->
  <g fill="${p.hairCol}">${p.hair}</g>
  <!-- accessories -->
  ${p.extra}
</svg>`;
}
