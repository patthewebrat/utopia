// HUD — top status strip, right icon rail, warning icons, bottom-left message log.

import * as engine from '../engine';
import type { Notification } from '../types';
import type { UIContext } from './context';
import { setUiMode } from './context';
import { el, button, fmtDate, fmtNum, fmtGR } from './dom';
import { icon, type IconName } from './icons';

export interface HudActions {
  openBuild(): void;
  openMap(): void;
  openFinance(): void;
  openAdvisers(): void;
  openIndustry(): void;
  openTrade(): void;
  openSpy(): void;
  openDisk(): void;
}

export interface HudHandle {
  update(): void;
  pushNote(note: Notification): void;
  root: HTMLElement;
}

export function mountHud(ctx: UIContext, uiRoot: HTMLElement, actions: HudActions): HudHandle {
  const root = el('div', 'u-hud');
  uiRoot.appendChild(root);

  // ------------------------------------------------------------ top strip
  const top = el('div', 'u-hud-top');
  root.appendChild(top);

  const left = el('div', 'u-hud-group');
  const dateEl = el('span', 'u-hud-date mono', '01/01/2090');
  left.appendChild(dateEl);
  const pauseBtn = button('u-hud-btn u-hud-pause', '', () => {
    const s = ctx.getState();
    engine.setPaused(s, !s.paused);
  });
  pauseBtn.title = 'Pause (P / Space)';
  pauseBtn.appendChild(icon('pause'));
  left.appendChild(pauseBtn);
  const speedWrap = el('div', 'u-speed');
  const speedBtns = ([1, 2, 5] as const).map((s) => {
    const b = button('u-speed-btn mono', `${s}×`, () => engine.setSpeed(ctx.getState(), s));
    speedWrap.appendChild(b);
    return { s, b };
  });
  left.appendChild(speedWrap);
  top.appendChild(left);

  const mid = el('div', 'u-hud-group u-hud-mid');
  const fundsEl = el('span', 'u-hud-funds mono', '0 GR');
  const deltaEl = el('span', 'u-hud-delta mono', '');
  mid.append(fundsEl, deltaEl);
  const popEl = el('span', 'u-hud-pop mono', '');
  popEl.title = 'Population';
  mid.appendChild(popEl);
  top.appendChild(mid);

  const right = el('div', 'u-hud-group');
  const warnWrap = el('div', 'u-warnings');
  const warnEls: Partial<Record<'power' | 'food' | 'air' | 'event', HTMLElement>> = {};
  const mkWarn = (key: 'power' | 'food' | 'air' | 'event', ic: IconName, tip: string): void => {
    const w = el('div', `u-warn u-warn--${key}`);
    w.appendChild(icon(ic));
    w.title = tip;
    w.style.display = 'none';
    warnWrap.appendChild(w);
    warnEls[key] = w;
  };
  mkWarn('power', 'bulb', 'Insufficient power');
  mkWarn('food', 'food', 'Insufficient food');
  mkWarn('air', 'o2', 'Insufficient air');
  mkWarn('event', 'runner', 'Event — click to jump to it');
  right.appendChild(warnWrap);

  const qolWrap = el('div', 'u-qol');
  qolWrap.title = 'Quality of Life — sustain 80% for 12 months for the Bronze Medal, 90% for Gold';
  const dial = el('div', 'u-qol-dial');
  const dialFill = el('div', 'u-qol-fill');
  dial.appendChild(dialFill);
  const qolText = el('span', 'u-qol-text mono', 'QoL 0%');
  const pips = el('span', 'u-medal-pips');
  const pipBronze = el('span', 'u-pip u-pip--bronze', '');
  const pipGold = el('span', 'u-pip u-pip--gold', '');
  pips.append(pipBronze, pipGold);
  qolWrap.append(dial, qolText, pips);
  right.appendChild(qolWrap);
  top.appendChild(right);

  // event jump memory (running man): last event with a location
  let eventLoc: { x: number; y: number } | null = null;
  let returnLoc: { x: number; y: number } | null = null;
  warnEls.event?.addEventListener('click', () => {
    if (!eventLoc) return;
    if (returnLoc) { ctx.centerOn(returnLoc.x, returnLoc.y); returnLoc = null; }
    else {
      returnLoc = ctx.getViewCenter ? { ...ctx.getViewCenter() } : null;
      ctx.centerOn(eventLoc.x, eventLoc.y);
    }
  });

  // ------------------------------------------------------------ right rail
  const rail = el('div', 'u-rail');
  root.appendChild(rail);

  const modeBox = el('div', 'u-mode-box');
  modeBox.title = 'Current mode (right-click / Esc returns to Info)';
  const modeIcon = el('div', 'u-mode-icon');
  const modeLabel = el('div', 'u-mode-label', 'INFO');
  modeBox.append(modeIcon, modeLabel);
  modeBox.addEventListener('click', () => setUiMode(ctx, 'info'));
  rail.appendChild(modeBox);

  interface RailBtn { key: string; el: HTMLButtonElement; }
  const railBtns: RailBtn[] = [];
  const mkRail = (key: string, ic: IconName, tip: string, fn: () => void): void => {
    const b = button('u-rail-btn', '', fn);
    b.appendChild(icon(ic));
    b.appendChild(el('span', 'u-rail-tip', tip));
    b.title = tip;
    rail.appendChild(b);
    railBtns.push({ key, el: b });
  };
  mkRail('build', 'build', 'Build (B)', actions.openBuild);
  mkRail('demolish', 'demolish', 'Demolish (X)', () => {
    setUiMode(ctx, ctx.mode === 'demolish' ? 'info' : 'demolish');
  });
  rail.appendChild(el('div', 'u-rail-sep'));
  mkRail('map', 'map', 'Map (M)', actions.openMap);
  mkRail('industry', 'industry', 'Industry', actions.openIndustry);
  mkRail('finance', 'finance', 'Finance', actions.openFinance);
  mkRail('trade', 'trade', 'Trade', actions.openTrade);
  mkRail('advisers', 'advisers', 'Advisers (F1–F6)', actions.openAdvisers);
  mkRail('spy', 'spy', 'Spying', actions.openSpy);
  rail.appendChild(el('div', 'u-rail-sep'));
  mkRail('disk', 'disk', 'Disk / Options', actions.openDisk);
  mkRail('fullscreen', 'fullscreen', 'Fullscreen', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  });

  // ------------------------------------------------------------ message log
  const log = el('div', 'u-log');
  root.appendChild(log);
  const logHead = el('div', 'u-log-head');
  logHead.append(el('span', 'u-log-title', 'COLONY LOG'), el('span', 'u-log-hint', 'click to expand'));
  log.appendChild(logHead);
  const logList = el('div', 'u-log-list');
  log.appendChild(logList);
  let expanded = false;
  logHead.addEventListener('click', () => {
    expanded = !expanded;
    log.classList.toggle('u-log--expanded', expanded);
    rebuildLog();
  });

  function noteRow(n: Notification): HTMLElement {
    const row = el('div', `u-log-row u-log-row--${n.kind}`);
    const day = (n.totalDays % 30) + 1;
    const mo = Math.floor(n.totalDays / 30);
    const date = `${String(day).padStart(2, '0')}/${String((mo % 12) + 1).padStart(2, '0')}/${2090 + Math.floor(mo / 12)}`;
    row.appendChild(el('span', 'u-log-date mono', date));
    row.appendChild(el('span', 'u-log-text', n.text));
    if (n.loc) {
      row.classList.add('u-log-row--jump');
      const loc = n.loc;
      row.title = 'Click to jump to location';
      row.addEventListener('click', () => ctx.centerOn(loc.x, loc.y));
    }
    return row;
  }

  function rebuildLog(): void {
    const notes = ctx.getState().notifications;
    const show = expanded ? notes.slice(-60) : notes.slice(-3);
    logList.replaceChildren(...show.map(noteRow));
    logList.scrollTop = logList.scrollHeight;
  }
  rebuildLog();

  function pushNote(note: Notification): void {
    if (note.kind === 'event' && note.loc) { eventLoc = note.loc; returnLoc = null; }
    rebuildLog();
  }

  // ------------------------------------------------------------ per-frame update
  let lastFunds = ctx.getState().funds;
  let monthFundsDelta = 0;
  engine.events.on('month', () => {
    const f = ctx.getState().funds;
    monthFundsDelta = f - lastFunds;
    lastFunds = f;
  });

  // per-frame DOM-churn guards: rebuild SVG icon nodes only when they change
  let lastPauseIcon: boolean | null = null;
  let lastModeIconKey = '';

  function update(): void {
    const s = ctx.getState();
    dateEl.textContent = fmtDate(s);
    fundsEl.textContent = fmtGR(s.funds);
    fundsEl.classList.toggle('u-neg', s.funds < 0);
    if (monthFundsDelta !== 0) {
      deltaEl.textContent = `${monthFundsDelta > 0 ? '▲' : '▼'} ${fmtNum(Math.abs(monthFundsDelta))}`;
      deltaEl.className = `u-hud-delta mono ${monthFundsDelta > 0 ? 'u-pos' : 'u-neg'}`;
    }
    popEl.textContent = `POP ${fmtNum(engine.populationOf(s))}`;

    pauseBtn.classList.toggle('u-active', s.paused);
    if (lastPauseIcon !== s.paused) {
      lastPauseIcon = s.paused;
      pauseBtn.replaceChildren(icon(s.paused ? 'play' : 'pause'));
    }
    for (const { s: sp, b } of speedBtns) b.classList.toggle('u-active', s.speed === sp && !s.paused);

    const qol = Math.round(s.qol);
    qolText.textContent = `QoL ${qol}%`;
    qolText.classList.toggle('u-pos', qol >= 80);
    dialFill.style.background =
      `conic-gradient(${qol >= 80 ? 'var(--ok)' : 'var(--cyan)'} ${qol * 3.6}deg, rgba(55,224,242,0.12) 0deg)`;
    pipBronze.classList.toggle('u-pip--on', s.stats.bronzeMedal);
    pipBronze.title = s.stats.bronzeMedal ? 'Bronze Medal awarded' : `Bronze: QoL≥80 for 12 mo (${s.stats.monthsQol80}/12)`;
    pipGold.classList.toggle('u-pip--on', s.stats.goldMedal);
    pipGold.title = s.stats.goldMedal ? 'Gold Medal awarded' : `Gold: QoL≥90 for 12 mo (${s.stats.monthsQol90}/12)`;

    const sh = s.shortages;
    if (warnEls.power) warnEls.power.style.display = sh.power ? '' : 'none';
    if (warnEls.food) warnEls.food.style.display = sh.food ? '' : 'none';
    if (warnEls.air) warnEls.air.style.display = sh.air ? '' : 'none';
    if (warnEls.event) warnEls.event.style.display = eventLoc ? '' : 'none';

    // mode box
    const m = ctx.mode;
    modeBox.className = `u-mode-box u-mode--${m}`;
    const iconKey = m === 'info' ? 'info' : m === 'demolish' ? 'demolish' : 'build';
    if (lastModeIconKey !== iconKey) {
      lastModeIconKey = iconKey;
      modeIcon.replaceChildren(icon(iconKey));
    }
    if (m === 'info') modeLabel.textContent = 'INFO';
    else if (m === 'demolish') modeLabel.textContent = 'DEMOLISH';
    else {
      const def = ctx.selectedBuild ? engine.BUILDING_DEFS[ctx.selectedBuild] : null;
      modeLabel.textContent = def ? def.name.toUpperCase().slice(0, 10) : 'BUILD';
    }
    for (const rb of railBtns) {
      if (rb.key === 'demolish') rb.el.classList.toggle('u-active', m === 'demolish');
      if (rb.key === 'build') rb.el.classList.toggle('u-active', m === 'build');
    }
  }

  update();
  return { update, pushNote, root };
}
