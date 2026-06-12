// UI entry point — mounts HUD + panel/modal/toast layers, wires engine events
// and keyboard shortcuts. The integration agent calls mountUI(ctx, uiRoot) and
// then calls handle.update() once per animation frame.

import * as engine from '../engine';
import type { UIContext } from './context';
import { setUiMode } from './context';
import { mountHud, type HudHandle } from './hud';
import { initPanelLayer, initToasts, closePanel, currentPanelId, refreshPanel, toast } from './panels';
import { initModalLayer, showBriefing, showInvention, showMedal, showGameOver } from './modals';
import { openBuildPalette } from './panels/buildPalette';
import { openBuildingInfo } from './panels/buildingInfo';
import { openUnitOrders } from './panels/unitOrders';
import { openIndustry } from './panels/industry';
import { openFinance, initFinanceTracker } from './panels/finance';
import { openTrade } from './panels/trade';
import { openAdvisers } from './panels/advisers';
import { openSpy } from './panels/spy';
import { openMapScreen } from './panels/mapScreen';
import { openDisk, saveToFile, loadFromFile } from './panels/disk';
import { ADVISERS } from './portraits';

export type { UIContext, UiMode, AudioApi } from './context';
export { setUiMode } from './context';
export { mountTitle } from './title';
export { openBuildingInfo, openUnitOrders, openBuildPalette, openMapScreen, openDisk };
export { showBriefing, showGameOver, showInvention, showMedal } from './modals';
export { toast, closePanel, currentPanelId } from './panels';
export { saveToFile, loadFromFile } from './panels/disk';

export interface UIHandle {
  update(): void;
  hud: HudHandle;
  destroy(): void;
}

export function mountUI(ctx: UIContext, uiRoot: HTMLElement): UIHandle {
  uiRoot.classList.add('u-root');
  initToasts(uiRoot);
  const hud = mountHud(ctx, uiRoot, {
    openBuild: () => openBuildPalette(ctx),
    openMap: () => openMapScreen(ctx),
    openFinance: () => openFinance(ctx),
    openAdvisers: () => openAdvisers(ctx),
    openIndustry: () => openIndustry(ctx),
    openTrade: () => openTrade(ctx),
    openSpy: () => openSpy(ctx),
    openDisk: () => openDisk(ctx),
  });
  initPanelLayer(uiRoot);
  initModalLayer(uiRoot);
  initFinanceTracker(() => ctx.getState());

  // -------------------------------------------------------- engine events
  const unsubs: (() => void)[] = [];
  unsubs.push(engine.events.on('notification', (e) => {
    hud.pushNote(e.note);
    if (e.note.kind === 'danger' || e.note.kind === 'attack' || e.note.kind === 'gameover') {
      toast('danger', e.note.text, e.note.loc ? () => ctx.centerOn(e.note.loc!.x, e.note.loc!.y) : undefined);
    } else if (e.note.kind === 'warning' || e.note.kind === 'crime' || e.note.kind === 'event') {
      toast('warning', e.note.text, e.note.loc ? () => ctx.centerOn(e.note.loc!.x, e.note.loc!.y) : undefined);
    } else if (e.note.kind === 'medal' || e.note.kind === 'invention') {
      // handled by their own modals
    } else if (e.note.kind === 'spy') {
      toast('spy', e.note.text);
    }
  }));
  unsubs.push(engine.events.on('invention', (e) => showInvention(ctx, e.inventionId, e.techLevel)));
  unsubs.push(engine.events.on('medal', (e) => showMedal(ctx, e.medal)));
  unsubs.push(engine.events.on('gameover', (e) => showGameOver(ctx, e.victory, e.reason)));
  unsubs.push(engine.events.on('attack', (e) => toast('danger', `Enemy attack wave inbound — ${e.waveSize} craft detected!`)));
  unsubs.push(engine.events.on('techlevel', (e) => toast('info', `Research complete — Tech Level ${e.techLevel} reached.`)));
  unsubs.push(engine.events.on('month', () => { if (currentPanelId()) refreshPanel(); }));

  // -------------------------------------------------------- keyboard
  function onKey(ev: KeyboardEvent): void {
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
    const s = ctx.getState();
    const k = ev.key;
    if (k === 'p' || k === 'P' || k === ' ') {
      engine.setPaused(s, !s.paused);
      ev.preventDefault();
    } else if (/^F[1-6]$/.test(k)) {
      const idx = Number(k.slice(1)) - 1;
      // close-first so a second F-key SWITCHES adviser instead of toggling shut
      if (currentPanelId() === 'advisers') closePanel(ctx);
      openAdvisers(ctx, ADVISERS[idx].id);
      ev.preventDefault();
    } else if (k >= '1' && k <= '8') {
      const tile = ctx.getHoveredTile?.();
      if (tile) {
        engine.placeMarker(s, Number(k) - 1, tile.x, tile.y);
        const m = s.markers[Number(k) - 1];
        toast('info', m ? `Marker ${k} placed at ${m.x},${m.y}.` : `Marker ${k} removed.`);
      }
    } else if (k === 'D' && ev.shiftKey) {
      // Shift+D — plain D is camera pan (WASD)
      engine.clearAllMarkers(s);
      toast('info', 'All markers cleared.');
    } else if (k === 'b' || k === 'B') {
      openBuildPalette(ctx);
    } else if (k === 'x' || k === 'X') {
      setUiMode(ctx, ctx.mode === 'demolish' ? 'info' : 'demolish');
    } else if (k === 'm' || k === 'M') {
      openMapScreen(ctx);
    } else if (k === 'Escape') {
      if (currentPanelId()) closePanel(ctx);
      else setUiMode(ctx, 'info');
    }
  }
  window.addEventListener('keydown', onKey);

  // right-click anywhere over the world → Info mode
  function onCtxMenu(ev: MouseEvent): void {
    if ((ev.target as HTMLElement).closest?.('.u-panel, .u-modal, .u-rail, .u-hud-top, .u-log')) return;
    ev.preventDefault();
    setUiMode(ctx, 'info');
  }
  window.addEventListener('contextmenu', onCtxMenu);

  return {
    update: () => hud.update(),
    hud,
    destroy(): void {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('contextmenu', onCtxMenu);
      for (const u of unsubs) u();
    },
  };
}
