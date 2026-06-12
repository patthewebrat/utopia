// UI context — the contract between the UI layer and the shell (main.ts).
// The integration agent constructs one of these and passes it to mountUI().

import type { GameState, TileRef, BuildingType } from '../types';

export type UiMode = 'info' | 'build' | 'demolish';

/** Audio facade — code against this; src/audio.ts should satisfy it. */
export interface AudioApi {
  setMusicEnabled(on: boolean): void;
  isMusicEnabled(): boolean;
  /** select music track 0–3 (the four original in-game tracks) */
  setTrack(index: number): void;
  currentTrack(): number;
  setSfxEnabled(on: boolean): void;
  isSfxEnabled(): boolean;
}

export interface UIContext {
  /** live game state (UI never caches it across frames) */
  getState(): GameState;
  /** swap in a different state (load-game / new-game). Shell re-points renderer. */
  replaceState(next: GameState): void;
  /** start a fresh scenario (shell calls engine.createGame and re-points everything) */
  newGame(scenarioId: string): void;

  /** camera jump (map clicks, message-log jumps, running-man) */
  centerOn(x: number, y: number): void;
  /** current camera centre in tile coords, for the map-screen view rectangle */
  getViewCenter?(): TileRef;
  /** tile under the mouse in the world view (for keyboard marker placement) */
  getHoveredTile?(): TileRef | null;

  /** interaction mode — the renderer reads these for the ghost cursor */
  mode: UiMode;
  selectedBuild: BuildingType | null;
  onModeChange?(mode: UiMode, build: BuildingType | null): void;

  audio?: AudioApi;
}

export function setUiMode(ctx: UIContext, mode: UiMode, build: BuildingType | null = null): void {
  ctx.mode = mode;
  ctx.selectedBuild = mode === 'build' ? build : null;
  ctx.onModeChange?.(ctx.mode, ctx.selectedBuild);
}
