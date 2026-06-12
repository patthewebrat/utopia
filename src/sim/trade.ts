// Trade — GAME_SPEC.md §7.

import type { GameState, Commodity } from '../types';
import { BASE_PRICES } from '../data/constants';
import { rand } from '../rng';
import { activeCommandCentre, notify } from './util';

export const COMMODITIES: Commodity[] = ['fuel', 'food', 'ore', 'gems', 'weapons', 'techGoods'];

/** roll next month's prices / supply / demand (seeded) */
export function regenerateMarket(state: GameState): void {
  for (const c of COMMODITIES) {
    state.trade.prices[c] = Math.round(BASE_PRICES[c] * (0.7 + 0.6 * rand(state)));
    if (c === 'gems') {
      state.trade.supply[c] = Math.round(5 + 35 * rand(state));
      state.trade.demand[c] = Math.round(5 + 35 * rand(state));
    } else {
      state.trade.supply[c] = Math.round(40 + 160 * rand(state));
      state.trade.demand[c] = Math.round(40 + 160 * rand(state));
    }
  }
}

function getStock(state: GameState, c: Commodity): number {
  return c === 'fuel' ? state.fuelStored : state.stores[c];
}

function setStock(state: GameState, c: Commodity, v: number): void {
  if (c === 'fuel') state.fuelStored = v;
  else state.stores[c] = v;
}

/**
 * Manual trade: once per calendar month, needs an active powered Command Centre.
 * order: positive = buy, negative = sell, per commodity. Returns error string or null.
 */
export function manualTrade(state: GameState, order: Partial<Record<Commodity, number>>): string | null {
  if (state.trade.tradedThisMonth) return 'Already traded this month.';
  if (!activeCommandCentre(state)) return 'No active powered Command Centre.';
  let net = 0;
  // validate
  for (const c of COMMODITIES) {
    const q = order[c] ?? 0;
    if (q > 0 && q > state.trade.supply[c]) return `Only ${state.trade.supply[c]} ${c} on offer.`;
    if (q < 0 && -q > Math.min(state.trade.demand[c], getStock(state, c))) {
      return `Cannot sell ${-q} ${c}.`;
    }
    net += -q * state.trade.prices[c];
  }
  if (state.funds + net < 0) return 'Insufficient funds.';
  // execute
  for (const c of COMMODITIES) {
    const q = order[c] ?? 0;
    if (q !== 0) setStock(state, c, getStock(state, c) + q);
  }
  state.funds += net;
  state.finance.accTradeNet += net;
  state.trade.tradedThisMonth = true;
  return null;
}

/** destroy any amount of a stored commodity for free */
export function dumpCommodity(state: GameState, c: Commodity, amount: number): void {
  setStock(state, c, Math.max(0, getStock(state, c) - Math.max(0, amount)));
}

/** monthly tick step 12: autotrade unless manual trade happened, then regen market */
export function tradeMonthly(state: GameState): void {
  if (!state.trade.tradedThisMonth && activeCommandCentre(state)) {
    let earned = 0;
    for (const c of COMMODITIES) {
      const stock = getStock(state, c);
      const keep = Math.round((state.trade.retain[c] / 100) * stock);
      const sell = Math.min(Math.max(0, stock - keep), state.trade.demand[c]);
      if (sell > 0) {
        setStock(state, c, stock - sell);
        earned += sell * state.trade.prices[c];
      }
    }
    if (earned > 0) {
      state.funds += earned;
      state.finance.accTradeNet += earned;
      notify(state, 'finance', `Autotrade earned ${earned} GR.`);
    }
  }
  state.trade.tradedThisMonth = false;
  regenerateMarket(state);
}
