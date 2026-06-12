// Disk / options panel — save (JSON download named by colony date), load (upload),
// scenario select, music + track select, SFX toggle.

import * as engine from '../../engine';
import { saveGame, loadGame } from '../../save';
import type { UIContext } from '../context';
import { el, button, fmtDate } from '../dom';
import { openPanel, closePanel, toast } from '../panels';
import { confirmModal } from '../modals';

const TRACK_NAMES = ['Utopia Theme I', 'Utopia Theme II', 'Utopia Theme III', 'Utopia Theme IV'];

export function saveToFile(ctx: UIContext): void {
  const s = ctx.getState();
  saveGame(s); // versioned-envelope download (same format as the autosave)
  toast('info', `Colony saved — ${fmtDate(s)}.`);
}

export function loadFromFile(ctx: UIContext): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    if (!f) return;
    // same strict-validating path as the title screen loader
    loadGame(f)
      .then((next) => {
        ctx.replaceState(next);
        closePanel(ctx);
        toast('info', `Colony restored — ${fmtDate(next)}.`);
      })
      .catch((e: unknown) => {
        toast('danger', e instanceof Error ? e.message : 'Could not read that save file.');
      });
  });
  input.click();
}

export function openDisk(ctx: UIContext): void {
  openPanel(ctx, {
    id: 'disk',
    title: 'Disk & Options',
    size: 'narrow',
    render(body, refresh) {
      const s = ctx.getState();

      const saveSect = el('div', 'u-binfo-sect');
      saveSect.appendChild(el('h4', 'u-sect-title', 'Colony Records'));
      saveSect.appendChild(el('p', 'u-hint', 'Saves are plain JSON files downloaded to your machine. Restore by uploading the file.'));
      const row = el('div', 'u-btn-group u-btn-group--col');
      row.appendChild(button('u-btn', `SAVE GAME — ${fmtDate(s)}`, () => saveToFile(ctx)));
      row.appendChild(button('u-btn', 'LOAD GAME…', () => loadFromFile(ctx)));
      saveSect.appendChild(row);
      body.appendChild(saveSect);

      const scen = el('div', 'u-binfo-sect');
      scen.appendChild(el('h4', 'u-sect-title', 'New Posting'));
      const list = el('div', 'u-scen-list');
      for (const sc of engine.SCENARIOS) {
        const r = el('div', `u-scen-row${sc.id === s.scenarioId ? ' u-active' : ''}`);
        r.appendChild(el('span', 'u-scen-name', sc.sandbox ? 'Quick-Start (sandbox)' : sc.name));
        r.appendChild(el('span', 'u-scen-meta mono', sc.sandbox ? '—' : `DIFF ${sc.difficulty}/10`));
        r.title = `${sc.biomeLabel}. ${sc.briefing}`;
        r.addEventListener('click', () => {
          confirmModal(ctx, 'Abandon Colony?',
            `Start a new posting against the ${sc.sandbox ? 'sandbox' : sc.name} scenario? The current colony is lost unless saved.`,
            () => { ctx.newGame(sc.id); closePanel(ctx); });
        });
        list.appendChild(r);
      }
      scen.appendChild(list);
      body.appendChild(scen);

      const au = el('div', 'u-binfo-sect');
      au.appendChild(el('h4', 'u-sect-title', 'Audio'));
      const audio = ctx.audio;
      if (!audio) {
        au.appendChild(el('p', 'u-hint', 'Audio system not connected.'));
      } else {
        const musicRow = el('div', 'u-ctl-row');
        musicRow.appendChild(el('span', 'u-ctl-label', 'MUSIC'));
        musicRow.appendChild(button(`u-btn u-btn--small${audio.isMusicEnabled() ? ' u-active' : ''}`,
          audio.isMusicEnabled() ? 'ON' : 'OFF', () => { audio.setMusicEnabled(!audio.isMusicEnabled()); refresh(); }));
        au.appendChild(musicRow);

        const tracks = el('div', 'u-scen-list');
        TRACK_NAMES.forEach((name, i) => {
          const r = el('div', `u-scen-row${audio.currentTrack() === i ? ' u-active' : ''}`);
          r.appendChild(el('span', 'u-scen-name', name));
          r.appendChild(el('span', 'u-scen-meta mono', `TRACK ${i + 1}`));
          r.addEventListener('click', () => { audio.setTrack(i); refresh(); });
          tracks.appendChild(r);
        });
        au.appendChild(tracks);

        const sfxRow = el('div', 'u-ctl-row');
        sfxRow.appendChild(el('span', 'u-ctl-label', 'SOUND FX'));
        sfxRow.appendChild(button(`u-btn u-btn--small${audio.isSfxEnabled() ? ' u-active' : ''}`,
          audio.isSfxEnabled() ? 'ON' : 'OFF', () => { audio.setSfxEnabled(!audio.isSfxEnabled()); refresh(); }));
        au.appendChild(sfxRow);
      }
      body.appendChild(au);

      body.appendChild(el('p', 'u-credit', 'Inspired by the 1991 Gremlin Graphics classic by Graeme Ing.'));
    },
  });
}
