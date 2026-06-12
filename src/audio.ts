// Audio: the four original music tracks (public/music/track1-4.mp3) plus a
// tiny WebAudio SFX synthesiser (no samples). Handles the browser autoplay
// policy by deferring playback until the first user gesture.
//
// Owned by the systems agent. UI calls the exported `audio` singleton
// (see docs/CONTRACTS.md appendix).

export type SfxName =
  | 'ui-click'              // generic button press
  | 'build-place'           // scaffold placed
  | 'construction-complete' // building finished chime
  | 'ship-complete'         // ship on its pad fanfare
  | 'laser'                 // turret / unit zap
  | 'explosion'             // unit/building destroyed
  | 'alert'                 // attack / danger warble
  | 'month-tick'            // soft month-boundary blip
  | 'trade';                // cash register

export type MusicTrack = 1 | 2 | 3 | 4;

const MUSIC_DEFAULT_VOLUME = 0.35;
const SFX_DEFAULT_VOLUME = 0.22;

class AudioManager {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;

  private musicEl: HTMLAudioElement | null = null;
  private currentTrack: MusicTrack | null = null;
  private pendingTrack: { track: MusicTrack; loop: boolean } | null = null;

  private unlocked = false;
  private musicEnabled = true;
  private sfxEnabled = true;
  private musicVolume = MUSIC_DEFAULT_VOLUME;
  private sfxVolume = SFX_DEFAULT_VOLUME;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = (): void => this.unlock();
      window.addEventListener('pointerdown', unlock, { once: true, capture: true });
      window.addEventListener('keydown', unlock, { once: true, capture: true });
    }
  }

  /** first user gesture: create/resume the context, start any queued music */
  private unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    void this.ensureCtx()?.resume();
    if (this.pendingTrack) {
      const { track, loop } = this.pendingTrack;
      this.pendingTrack = null;
      this.playMusic(track, loop);
    }
  }

  private ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  // ---------------------------------------------------------------- music

  /** play one of the four original tracks (1–4); loops by default */
  playMusic(track: MusicTrack, loop = true): void {
    if (!this.musicEnabled) { this.currentTrack = track; return; }
    if (!this.unlocked) { this.pendingTrack = { track, loop }; return; }
    if (!this.musicEl) {
      this.musicEl = new Audio();
      this.musicEl.preload = 'auto';
    }
    this.musicEl.src = `music/track${track}.mp3`;
    this.musicEl.loop = loop;
    this.musicEl.volume = this.musicVolume;
    this.currentTrack = track;
    void this.musicEl.play().catch(() => {
      // autoplay refused after all — queue for the next gesture
      this.unlocked = false;
      this.pendingTrack = { track, loop };
      if (typeof window !== 'undefined') {
        window.addEventListener('pointerdown', () => this.unlock(), { once: true, capture: true });
      }
    });
  }

  stopMusic(): void {
    this.pendingTrack = null;
    this.currentTrack = null;
    if (this.musicEl) {
      this.musicEl.pause();
      this.musicEl.currentTime = 0;
    }
  }

  getCurrentTrack(): MusicTrack | null { return this.currentTrack; }

  setMusicEnabled(on: boolean): void {
    this.musicEnabled = on;
    if (!on) {
      this.musicEl?.pause();
    } else if (this.currentTrack !== null) {
      this.playMusic(this.currentTrack, this.musicEl?.loop ?? true);
    }
  }

  setSfxEnabled(on: boolean): void { this.sfxEnabled = on; }

  /** 0..1 */
  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicEl) this.musicEl.volume = this.musicVolume;
  }

  /** 0..1 */
  setSfxVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
  }

  isMusicEnabled(): boolean { return this.musicEnabled; }
  isSfxEnabled(): boolean { return this.sfxEnabled; }

  // ---------------------------------------------------------------- SFX synth

  playSfx(name: SfxName): void {
    if (!this.sfxEnabled || !this.unlocked) return;
    const ctx = this.ensureCtx();
    if (!ctx || ctx.state !== 'running' || !this.sfxGain) return;
    const t = ctx.currentTime;
    switch (name) {
      case 'ui-click': this.tone(t, 'square', 760, 760, 0.035, 0.5); break;
      case 'build-place':
        this.tone(t, 'triangle', 180, 70, 0.14, 0.9);
        this.noise(t, 0.06, 900, 0.3);
        break;
      case 'construction-complete':
        this.tone(t, 'sine', 660, 660, 0.10, 0.7);
        this.tone(t + 0.11, 'sine', 880, 880, 0.16, 0.7);
        break;
      case 'ship-complete':
        this.tone(t, 'triangle', 523, 523, 0.12, 0.7);
        this.tone(t + 0.12, 'triangle', 659, 659, 0.12, 0.7);
        this.tone(t + 0.24, 'triangle', 784, 784, 0.22, 0.8);
        break;
      case 'laser': this.tone(t, 'sawtooth', 1400, 180, 0.12, 0.55); break;
      case 'explosion': this.noise(t, 0.5, 320, 1.0, 1400, 90); break;
      case 'alert':
        this.tone(t, 'sine', 620, 620, 0.12, 0.8);
        this.tone(t + 0.13, 'sine', 920, 920, 0.12, 0.8);
        this.tone(t + 0.26, 'sine', 620, 620, 0.12, 0.8);
        this.tone(t + 0.39, 'sine', 920, 920, 0.12, 0.8);
        break;
      case 'month-tick': this.tone(t, 'sine', 440, 440, 0.05, 0.25); break;
      case 'trade':
        this.tone(t, 'square', 1150, 1150, 0.04, 0.5);
        this.tone(t + 0.07, 'square', 1530, 1530, 0.05, 0.5);
        this.noise(t + 0.13, 0.05, 2400, 0.25);
        break;
    }
  }

  /** simple enveloped oscillator (freq glides f0 -> f1 over the duration) */
  private tone(
    at: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, at);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), at + dur);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(vol, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  /** white-noise burst through a lowpass (cutoff can sweep c0 -> c1) */
  private noise(at: number, dur: number, cutoff: number, vol: number, c0?: number, c1?: number): void {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(c0 ?? cutoff, at);
    if (c0 !== undefined && c1 !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, c1), at + dur);
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain!);
    src.start(at);
    src.stop(at + dur + 0.02);
  }
}

/** the global audio manager (UI/main import this) */
export const audio = new AudioManager();
