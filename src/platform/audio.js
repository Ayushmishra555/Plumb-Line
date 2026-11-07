// All sound is generated with the Web Audio API. There are no audio files.
//
// Routing:  oscillators / noise -> sfxBus or musicBus -> master -> compressor -> speakers
// The master gain is the on/off switch (player setting and YouTube's audio setting). The two buses
// carry the volume sliders from the settings screen.

const NOTES = [220, 261.63, 293.66, 329.63, 392]; // A minor pentatonic
const PATTERN = [0, 2, 4, 2, 3, 1, 2, 4, 3, 2, 0, 2, 4, 3, 1, 2];

const clamp01 = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.primed = false;
    this.enabled = true;    // player setting and YouTube setting combined
    this.suspended = false; // paused by the platform or a hidden tab
    this.musicVol = 0.7;
    this.sfxVol = 1;
    this.musicOn = false;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
    this.intensity = 0;
  }

  /**
   * Must be called from a user gesture. Safe to call repeatedly: it keeps trying to start the audio
   * until the browser lets it run (touch screens only allow it on the release of a tap).
   */
  unlock() {
    if (!this.ctx) {
      try {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return;
        this.ctx = new C();
        this.master = this.ctx.createGain();
        this.musicBus = this.ctx.createGain();
        this.sfxBus = this.ctx.createGain();
        // Keeps loud moments (a collapse) from clipping now that the effects are louder.
        this.limiter = this.ctx.createDynamicsCompressor();
        this.musicBus.connect(this.master);
        this.sfxBus.connect(this.master);
        this.master.connect(this.limiter);
        this.limiter.connect(this.ctx.destination);
        this.applyLevels();
        // iPhone: play through the media channel so the silent switch does not mute the game.
        try { if (typeof navigator !== 'undefined' && navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* ignore */ }
      } catch (e) { this.ctx = null; return; }
    }
    if (!this.suspended && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    if (!this.primed) {
      // Some browsers only start audio after a sound is played inside the gesture itself.
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = this.ctx.createBuffer(1, 1, 22050);
        src.connect(this.ctx.destination);
        src.start(0);
        this.primed = true;
      } catch (e) { /* try again on the next gesture */ }
    }
  }

  isRunning() { return !!this.ctx && this.ctx.state === 'running'; }

  applyLevels() {
    if (!this.ctx) return;
    this.master.gain.value = this.enabled ? 1 : 0;
    this.musicBus.gain.value = this.musicVol;
    this.sfxBus.gain.value = this.sfxVol;
  }

  setEnabled(v) { this.enabled = !!v; this.applyLevels(); }
  setMusicVolume(v) { this.musicVol = clamp01(v, this.musicVol); this.applyLevels(); }
  setSfxVolume(v) { this.sfxVol = clamp01(v, this.sfxVol); this.applyLevels(); }
  setIntensity(v) { this.intensity = clamp01(v, 0); }

  suspend() {
    this.suspended = true;
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  resume() {
    this.suspended = false;
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  tone(freq, dur, type, vol, slide, when, bus) {
    if (!this.ctx || !this.enabled) return;
    try {
      const t = when !== undefined ? when : this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
      g.gain.setValueAtTime(vol || 0.08, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(bus || this.sfxBus);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) { /* ignore */ }
  }

  noise(dur, vol) {
    if (!this.ctx || !this.enabled) return;
    try {
      const n = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = this.ctx.createBufferSource();
      const g = this.ctx.createGain();
      src.buffer = buf;
      g.gain.value = vol || 0.1;
      src.connect(g);
      g.connect(this.sfxBus);
      src.start();
    } catch (e) { /* ignore */ }
  }

  // Levels are chosen to be heard on a phone speaker: little below 150 Hz, and loud enough to sit above the music.
  release() { this.tone(420, 0.09, 'triangle', 0.12, 260); }
  land() {
    this.tone(150, 0.2, 'sine', 0.35, 75);
    this.tone(280, 0.09, 'square', 0.05, 130);
    this.noise(0.1, 0.14);
  }
  perfect(combo) {
    if (!this.ctx) return;
    const base = 520 + Math.min(combo, 8) * 40;
    const t = this.ctx.currentTime;
    this.tone(base, 0.12, 'triangle', 0.16, 0, t);
    this.tone(base * 1.25, 0.12, 'triangle', 0.16, 0, t + 0.07);
    this.tone(base * 1.5, 0.2, 'triangle', 0.16, 0, t + 0.14);
  }
  miss() { this.tone(240, 0.4, 'sawtooth', 0.12, 70); }
  collapse() {
    this.noise(1.1, 0.45);
    this.tone(95, 0.9, 'sine', 0.4, 38);
    this.tone(200, 0.7, 'sawtooth', 0.09, 55);
  }
  medal() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [659.25, 830.61, 987.77, 1318.5].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.14, 0, t + i * 0.09));
  }
  /** Short blip played when the effects slider is released, so the player can hear the level. */
  preview() { this.tone(660, 0.12, 'triangle', 0.14); }

  startMusic() {
    if (this.musicOn || !this.ctx) return;
    this.musicOn = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 100);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  schedule() {
    if (!this.ctx || !this.musicOn || this.suspended) return;
    const bpm = 76 + this.intensity * 44;
    const eighth = 60 / bpm / 2;
    while (this.nextTime < this.ctx.currentTime + 0.35) {
      const i = this.step % PATTERN.length;
      const f = NOTES[PATTERN[i]] * (this.step % 64 >= 32 ? 1.122 : 1);
      this.tone(f, eighth * 1.6, 'triangle', 0.075, 0, this.nextTime, this.musicBus);
      if (i % 8 === 0) this.tone(f / 2, eighth * 7, 'sine', 0.09, 0, this.nextTime, this.musicBus);
      this.nextTime += eighth;
      this.step++;
    }
  }
}
