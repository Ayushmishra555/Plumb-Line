import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AudioEngine } from '../src/platform/audio.js';

let made;

class FakeContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.sampleRate = 8000;
    this.destination = { name: 'speakers' };
    made.ctx = this;
    made.oscillators = 0;
    made.connections = [];
  }
  createGain() {
    const node = { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect(to) { made.connections.push([node, to]); } };
    return node;
  }
  createDynamicsCompressor() { return this.createGain(); }
  createBuffer() { return {}; }
  createBufferSource() { return { buffer: null, connect() {}, start() { made.primed = (made.primed || 0) + 1; } }; }
  createOscillator() {
    made.oscillators++;
    return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} };
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
}

beforeEach(() => {
  made = {};
  globalThis.window = { AudioContext: FakeContext };
});
afterEach(() => { delete globalThis.window; });

describe('AudioEngine volumes', () => {
  it('does nothing until it is unlocked', () => {
    const a = new AudioEngine();
    expect(() => { a.land(); a.setMusicVolume(0.2); a.startMusic(); }).not.toThrow();
    expect(a.ctx).toBeNull();
  });

  it('routes the buses through the master and applies the levels', () => {
    const a = new AudioEngine();
    a.unlock();
    expect(a.master.gain.value).toBe(1);
    expect(a.musicBus.gain.value).toBe(0.7);
    expect(a.sfxBus.gain.value).toBe(1);
    const into = (from) => made.connections.find(([n]) => n === from)[1];
    expect(into(a.musicBus)).toBe(a.master);
    expect(into(a.sfxBus)).toBe(a.master);
    expect(into(a.master)).toBe(a.limiter);
    expect(into(a.limiter)).toBe(made.ctx.destination);
  });

  it('applies levels chosen before the first tap once the context exists', () => {
    const a = new AudioEngine();
    a.setMusicVolume(0.2);
    a.setSfxVolume(0.5);
    a.setEnabled(false);
    a.unlock();
    expect(a.musicBus.gain.value).toBe(0.2);
    expect(a.sfxBus.gain.value).toBe(0.5);
    expect(a.master.gain.value).toBe(0);
  });

  it('clamps slider values and ignores values that are not numbers', () => {
    const a = new AudioEngine();
    a.unlock();
    a.setMusicVolume(3);
    expect(a.musicBus.gain.value).toBe(1);
    a.setMusicVolume(-1);
    expect(a.musicBus.gain.value).toBe(0);
    a.setSfxVolume(0.4);
    a.setSfxVolume('loud');
    a.setSfxVolume(NaN);
    expect(a.sfxBus.gain.value).toBe(0.4);
  });

  it('mutes through the master and plays no effects while disabled', () => {
    const a = new AudioEngine();
    a.unlock();
    a.setEnabled(false);
    expect(a.master.gain.value).toBe(0);
    a.release();
    expect(made.oscillators).toBe(0);
    a.setEnabled(true);
    expect(a.master.gain.value).toBe(1);
    a.release();
    expect(made.oscillators).toBe(1);
  });

  it('keeps the music volume while the effects volume changes', () => {
    const a = new AudioEngine();
    a.unlock();
    a.setMusicVolume(0.1);
    a.setSfxVolume(0.9);
    expect(a.musicBus.gain.value).toBe(0.1);
    expect(a.sfxBus.gain.value).toBe(0.9);
  });

  it('keeps trying to start a context the browser left suspended', () => {
    const a = new AudioEngine();
    a.unlock();
    made.ctx.state = 'suspended';
    made.ctx.resume = () => { made.resumeCalls = (made.resumeCalls || 0) + 1; return Promise.resolve(); };
    expect(a.isRunning()).toBe(false);
    a.unlock();
    a.unlock();
    expect(made.resumeCalls).toBe(2);
    made.ctx.state = 'running';
    expect(a.isRunning()).toBe(true);
    a.unlock();
    expect(made.resumeCalls).toBe(2);
  });

  it('plays a silent sound inside the first gesture to wake up strict browsers, once', () => {
    const a = new AudioEngine();
    a.unlock();
    a.unlock();
    expect(made.primed).toBe(1);
  });

  it('does not resume while the platform has the game paused', () => {
    const a = new AudioEngine();
    a.unlock();
    a.suspend();
    made.resumeCalls = 0;
    made.ctx.resume = () => { made.resumeCalls++; return Promise.resolve(); };
    a.unlock();
    expect(made.resumeCalls).toBe(0);
  });

  it('suspends and resumes with the platform', () => {
    const a = new AudioEngine();
    a.unlock();
    a.suspend();
    expect(made.ctx.state).toBe('suspended');
    a.resume();
    expect(made.ctx.state).toBe('running');
  });
});
