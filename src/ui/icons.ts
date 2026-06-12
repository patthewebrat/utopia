// Inline SVG icon set — stroke-based, 1.5px, drawn-not-imported (ART_DIRECTION §7).
// Every icon is a 24×24 viewBox string; colour via CSS `currentColor`.

const S = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

function svg(body: string, vb = '0 0 24 24'): string {
  return `<svg viewBox="${vb}" ${S} aria-hidden="true">${body}</svg>`;
}

export const icons = {
  build: svg('<path d="M4 20h16M6 20V10l6-5 6 5v10"/><path d="M10 20v-5h4v5"/><path d="M12 5v3"/>'),
  demolish: svg('<path d="M4 20h16"/><path d="M7 20v-7m10 7v-9"/><path d="M5 9l14-5"/><path d="M14 7l4 4"/><circle cx="17" cy="13" r="2.4"/>'),
  info: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 8h.01"/>'),
  map: svg('<path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z"/><path d="M9 4v14M15 6v14"/>'),
  finance: svg('<path d="M4 19h16"/><path d="M6 19v-6m4 6V9m4 10v-8m4 8V6"/>'),
  advisers: svg('<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><circle cx="17" cy="8" r="2.4"/><path d="M15.5 13.6c2.6.2 4.4 1.7 5 4.4"/>'),
  industry: svg('<path d="M4 20V9l5 3V9l5 3V7l6-2v15Z"/><path d="M8 16h2m3 0h2"/>'),
  spy: svg('<path d="M5 13h14"/><path d="M7 13c0-4 1-7 5-7s5 3 5 7"/><circle cx="8.5" cy="16.5" r="2.5"/><circle cx="15.5" cy="16.5" r="2.5"/><path d="M11 16.5h2"/>'),
  disk: svg('<path d="M5 4h12l3 3v13H5Z"/><path d="M8 4v5h7V4"/><rect x="8" y="13" width="8" height="6"/>'),
  pause: svg('<path d="M9 5v14M15 5v14"/>'),
  play: svg('<path d="M7 5l12 7-12 7Z"/>'),
  fullscreen: svg('<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  bulb: svg('<path d="M9 18h6m-5 2.5h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.7 1 1.5 1 2.5h6c0-1 .2-1.8 1-2.5A6 6 0 0 0 12 3Z"/><path d="M10 9l1.6 2.4L10.4 14"/>'),
  food: svg('<path d="M7 3v7m-2-7v4a2 2 0 0 0 4 0V3"/><path d="M7 12v9"/><path d="M16 3c-2 0-3 2.5-3 5s1 4 3 4v9"/>'),
  o2: svg('<circle cx="10" cy="10" r="6.5"/><path d="M17.5 16.5a3 3 0 1 1-1-2.2"/><path d="M10 21v.01M14 20v.01"/>'),
  runner: svg('<circle cx="14.5" cy="5" r="2"/><path d="M8 21l3-5.5L9.5 12l3-3 2.5 2.5 3.5.5"/><path d="M9.5 12 6 13.5M12.5 9 9 8l-2.5 2"/><path d="M11 15.5 14 18l1 3.5"/>'),
  marker: svg('<path d="M12 21s-6-7-6-11.5a6 6 0 0 1 12 0C18 14 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.2"/>'),
  tank: svg('<rect x="4" y="12" width="16" height="5" rx="2.5"/><path d="M9 12v-2.5h5L17 7h3"/>'),
  ship: svg('<path d="M12 3c3 3 4 7 4 11l3 3v3l-7-2-7 2v-3l3-3c0-4 1-8 4-11Z"/><circle cx="12" cy="10" r="1.6"/>'),
  missile: svg('<path d="M12 2c2.5 2.5 3 7 3 10l-3 3-3-3c0-3 .5-7.5 3-10Z"/><path d="M9 12l-2.5 3M15 12l2.5 3"/><path d="M12 15v4m-1.5 3 1.5-3 1.5 3"/>'),
  power: svg('<path d="M13 2 5 13h6l-1 9 8-11h-6Z"/>'),
  radar: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12 18 6"/><circle cx="12" cy="12" r="0.8"/>'),
  flag: svg('<path d="M6 21V4"/><path d="M6 5h11l-2.5 3.5L17 12H6"/>'),
  trade: svg('<path d="M4 8h13l-3-3M20 16H7l3 3"/>'),
  medal: svg('<circle cx="12" cy="14" r="5"/><path d="M9 10 6 3h4l2 4 2-4h4l-3 7"/><path d="M12 12.2l1 1.8h-2Z"/>'),
  warning: svg('<path d="M12 3 2.5 20h19Z"/><path d="M12 9.5V15m0 2.5v.01"/>'),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="1.5"/>'),
  research: svg('<path d="M10 3h4M11 3v6L5.5 18.5A2 2 0 0 0 7.3 21h9.4a2 2 0 0 0 1.8-2.5L13 9V3"/><path d="M8 15h8"/>'),
  speed: svg('<path d="M4 12a8 8 0 1 1 16 0"/><path d="M12 12l5-4"/><path d="M7 20h10"/>'),
} as const;

export type IconName = keyof typeof icons;

export function icon(name: IconName, cls = ''): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = `u-icon ${cls}`.trim();
  span.innerHTML = icons[name];
  return span;
}
