// Tiny DOM helpers + shared formatters for the UI layer.

import type { GameState } from '../types';

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** element with raw innerHTML (trusted, code-authored strings only) */
export function elHtml<K extends keyof HTMLElementTagNameMap>(
  tag: K, cls: string, html: string,
): HTMLElementTagNameMap[K] {
  const e = el(tag, cls);
  e.innerHTML = html;
  return e;
}

export function button(cls: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', cls, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/** 12 345 GR */
export function fmtGR(n: number): string {
  return `${fmtNum(Math.round(n))} GR`;
}
export function fmtNum(n: number): string {
  const neg = n < 0;
  const s = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (neg ? '−' : '') + s;
}
export function fmtDate(state: GameState): string {
  const d = String(state.dayOfMonth + 1).padStart(2, '0');
  const m = String(state.month).padStart(2, '0');
  return `${d}/${m}/${state.year}`;
}
export function fmtPct(n: number): string { return `${Math.round(n)}%`; }

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** labelled slider row; returns the wrapper */
export function sliderRow(
  label: string, min: number, max: number, value: number, suffix: string,
  onInput: (v: number) => void,
): HTMLElement {
  const row = el('div', 'u-slider-row');
  row.appendChild(el('span', 'u-slider-label', label));
  const input = el('input') as HTMLInputElement;
  input.type = 'range';
  input.min = String(min); input.max = String(max); input.value = String(value);
  const val = el('span', 'u-slider-val mono', `${value}${suffix}`);
  input.addEventListener('input', () => {
    val.textContent = `${input.value}${suffix}`;
    onInput(Number(input.value));
  });
  row.appendChild(input);
  row.appendChild(val);
  return row;
}

/** +/- stepper; returns wrapper with .u-step-val updated via refresh callback */
export function stepper(
  value: () => number, min: number, max: number, onSet: (v: number) => void,
): HTMLElement {
  const wrap = el('span', 'u-stepper');
  const dec = button('u-step-btn', '−', () => { onSet(clamp(value() - 1, min, max)); sync(); });
  const valEl = el('span', 'u-step-val mono', String(value()));
  const inc = button('u-step-btn', '+', () => { onSet(clamp(value() + 1, min, max)); sync(); });
  function sync(): void { valEl.textContent = String(value()); }
  wrap.append(dec, valEl, inc);
  return wrap;
}
