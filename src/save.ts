// Save / load / autosave. GameState IS the save payload (pure JSON) — this
// module wraps it in a small versioned envelope, drives the browser download /
// file-upload round trip, and keeps a localStorage autosave each game-month.
//
// Owned by the systems agent. UI calls: saveGame, loadGame, initAutosave,
// restoreAutosave, clearAutosave (see docs/CONTRACTS.md appendix).

import type { GameState } from './types';
import { events } from './events';

export const SAVE_VERSION = 1;
export const AUTOSAVE_KEY = 'utopia-autosave';

export interface SaveFile {
  version: number;        // SAVE_VERSION
  savedAt: string;        // ISO timestamp (real time)
  scenarioId: string;
  state: GameState;
}

// ---------------------------------------------------------------- validation

/** throws a friendly Error if `s` is not a plausible GameState */
function validateState(s: unknown): asserts s is GameState {
  const fail = (why: string): never => {
    throw new Error(`Not a valid UTOPIA save: ${why}`);
  };
  if (!s || typeof s !== 'object' || Array.isArray(s)) fail('file does not contain a game state object');
  const st = s as Record<string, unknown>;
  if (typeof st.schemaVersion !== 'number') fail('missing schema version');
  if (st.schemaVersion !== 1) fail(`unsupported game-state schema ${String(st.schemaVersion)}`);
  if (typeof st.scenarioId !== 'string') fail('missing scenario id');
  if (typeof st.mapW !== 'number' || typeof st.mapH !== 'number') fail('missing map dimensions');
  const n = (st.mapW as number) * (st.mapH as number);
  for (const key of ['terrain', 'oreYield', 'fuelYield', 'tileBuilding', 'wreckage'] as const) {
    if (!Array.isArray(st[key]) || (st[key] as unknown[]).length !== n) fail(`corrupt map layer "${key}"`);
  }
  if (!Array.isArray(st.buildings) || !Array.isArray(st.units)) fail('missing buildings/units lists');
  for (const b of st.buildings as unknown[]) {
    if (!b || typeof b !== 'object') fail('corrupt building entry');
    const o = b as Record<string, unknown>;
    for (const k of ['id', 'x', 'y', 'hp'] as const) {
      if (typeof o[k] !== 'number' || Number.isNaN(o[k] as number)) fail(`corrupt building field "${k}"`);
    }
    if (typeof o.type !== 'string') fail('corrupt building type');
  }
  for (const u of st.units as unknown[]) {
    if (!u || typeof u !== 'object') fail('corrupt unit entry');
    const o = u as Record<string, unknown>;
    for (const k of ['id', 'x', 'y', 'hp'] as const) {
      if (typeof o[k] !== 'number' || Number.isNaN(o[k] as number)) fail(`corrupt unit field "${k}"`);
    }
    if (typeof o.kind !== 'string' || (o.owner !== 'player' && o.owner !== 'enemy')) fail('corrupt unit entry');
  }
  for (const key of ['funds', 'totalDays', 'monthIndex', 'month', 'year', 'rng'] as const) {
    if (typeof st[key] !== 'number' || Number.isNaN(st[key] as number)) fail(`corrupt field "${key}"`);
  }
  if (!st.pop || typeof (st.pop as Record<string, unknown>).colonists !== 'number') fail('corrupt population block');
  if (!st.stores || typeof (st.stores as Record<string, unknown>).food !== 'number') fail('corrupt stores block');
  if (!st.research || !st.finance || !st.trade || !st.stats) fail('missing subsystem blocks');
  if (!Array.isArray(st.markers) || (st.markers as unknown[]).length !== 8) fail('corrupt marker table');
}

/** backfill fields added after the original schema-1 saves (idempotent) */
export function migrateState(s: GameState): GameState {
  s.finance.accTradeNet ??= 0;
  s.finance.accConstructionSpend ??= 0;
  s.spy.pendingReportDay ??= -1;
  if (s.disease) s.disease.mitigated ??= false;
  for (const b of s.buildings) b.hdx ??= false;
  return s;
}

/** parse JSON text that is either a v1 envelope or a bare GameState */
function parseSaveText(text: string): GameState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Not a valid UTOPIA save: the file is not JSON.');
  }
  if (parsed && typeof parsed === 'object' && 'version' in (parsed as object) && 'state' in (parsed as object)) {
    const env = parsed as SaveFile;
    if (env.version !== SAVE_VERSION) {
      throw new Error(`Not a valid UTOPIA save: unsupported save version ${String(env.version)}.`);
    }
    validateState(env.state);
    return migrateState(env.state);
  }
  // bare GameState (engine.serialize output) — accepted for robustness
  validateState(parsed);
  return migrateState(parsed);
}

function makeEnvelope(state: GameState): SaveFile {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    scenarioId: state.scenarioId,
    state,
  };
}

// ---------------------------------------------------------------- download / upload

/** colony date as DD.MM.YYYY (the in-game DD/MM/YYYY with slashes -> dots) */
function colonyDate(state: GameState): string {
  const dd = String(state.dayOfMonth + 1).padStart(2, '0');
  const mm = String(state.month).padStart(2, '0');
  return `${dd}.${mm}.${state.year}`;
}

/** serialise the game and trigger a browser download "utopia-DD.MM.YYYY.json" */
export function saveGame(state: GameState): void {
  const json = JSON.stringify(makeEnvelope(state), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `utopia-${colonyDate(state)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // revoke on a delay so the click has consumed the URL
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

/** read + validate an uploaded save file; rejects with a friendly Error */
export async function loadGame(file: File): Promise<GameState> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new Error('Could not read the selected file.');
  }
  return parseSaveText(text);
}

// ---------------------------------------------------------------- autosave

/**
 * Begin autosaving: writes the current game to localStorage (AUTOSAVE_KEY)
 * at every game-month boundary (the engine 'month' event). Call once after
 * game start/load with a getter for the live state. Returns an unsubscribe.
 */
export function initAutosave(getState: () => GameState | null): () => void {
  return events.on('month', () => {
    const state = getState();
    if (!state) return;
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(makeEnvelope(state)));
    } catch {
      /* storage full / unavailable — autosave is best-effort */
    }
  });
}

/** restore the localStorage autosave; null if absent or corrupt */
export function restoreAutosave(): GameState | null {
  try {
    const text = localStorage.getItem(AUTOSAVE_KEY);
    if (!text) return null;
    return parseSaveText(text);
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    /* ignore */
  }
}
