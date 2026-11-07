import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as yt from '../src/platform/youtube.js';
import { defaults, normalize, parse, load, save } from '../src/platform/save.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    map
  };
}

function fakeSdk(overrides = {}) {
  return {
    IN_PLAYABLES_ENV: true,
    game: {
      firstFrameReady: vi.fn(),
      gameReady: vi.fn(),
      loadData: vi.fn(async () => ''),
      saveData: vi.fn(async () => {})
    },
    engagement: { sendScore: vi.fn(async () => {}) },
    system: {
      isAudioEnabled: vi.fn(() => true),
      onAudioEnabledChange: vi.fn(),
      onPause: vi.fn(),
      onResume: vi.fn()
    },
    ...overrides
  };
}

beforeEach(() => {
  delete globalThis.ytgame;
  globalThis.localStorage = fakeStorage();
});
afterEach(() => {
  delete globalThis.ytgame;
  delete globalThis.localStorage;
});

describe('youtube wrapper outside YouTube', () => {
  it('does nothing and returns defaults', async () => {
    expect(yt.inYouTube()).toBe(false);
    expect(() => { yt.firstFrameReady(); yt.gameReady(); yt.sendScore(10); yt.onPause(() => {}); yt.onResume(() => {}); }).not.toThrow();
    expect(await yt.loadCloudData()).toBeNull();
    expect(yt.isAudioEnabled()).toBe(true);
  });
});

describe('youtube audio setting outside Playables', () => {
  it('ignores an "off" report from the SDK when the game is not running in YouTube', () => {
    const sdk = fakeSdk();
    sdk.IN_PLAYABLES_ENV = false;
    sdk.system.isAudioEnabled.mockReturnValue(false);
    globalThis.ytgame = sdk;
    expect(yt.isAudioEnabled()).toBe(true);
    const cb = () => {};
    yt.onAudioEnabledChange(cb);
    expect(sdk.system.onAudioEnabledChange).not.toHaveBeenCalled();
  });

  it('treats an unexpected value from the SDK inside YouTube as sound allowed', () => {
    const sdk = fakeSdk();
    sdk.system.isAudioEnabled.mockReturnValue(undefined);
    globalThis.ytgame = sdk;
    expect(yt.isAudioEnabled()).toBe(true);
    sdk.system.isAudioEnabled.mockReturnValue(false);
    expect(yt.isAudioEnabled()).toBe(false);
  });
});

describe('youtube wrapper inside YouTube', () => {
  it('forwards ready signals, audio setting, pause hooks and score', async () => {
    const sdk = fakeSdk();
    sdk.system.isAudioEnabled.mockReturnValue(false);
    globalThis.ytgame = sdk;
    expect(yt.inYouTube()).toBe(true);
    yt.firstFrameReady();
    yt.gameReady();
    expect(sdk.game.firstFrameReady).toHaveBeenCalledOnce();
    expect(sdk.game.gameReady).toHaveBeenCalledOnce();
    expect(yt.isAudioEnabled()).toBe(false);
    const cb = () => {};
    yt.onPause(cb); yt.onResume(cb); yt.onAudioEnabledChange(cb);
    expect(sdk.system.onPause).toHaveBeenCalledWith(cb);
    expect(sdk.system.onResume).toHaveBeenCalledWith(cb);
    expect(sdk.system.onAudioEnabledChange).toHaveBeenCalledWith(cb);
    yt.sendScore(12.7);
    yt.sendScore(-5);
    yt.sendScore('abc');
    expect(sdk.engagement.sendScore.mock.calls.map((c) => c[0].value)).toEqual([12, 0, 0]);
  });

  it('survives SDK calls that throw or reject', async () => {
    const sdk = fakeSdk();
    sdk.game.gameReady = () => { throw new Error('boom'); };
    sdk.game.loadData = async () => { throw new Error('offline'); };
    sdk.engagement.sendScore = () => Promise.reject(new Error('nope'));
    globalThis.ytgame = sdk;
    expect(() => yt.gameReady()).not.toThrow();
    expect(() => yt.sendScore(3)).not.toThrow();
    expect(await yt.loadCloudData()).toBeNull();
  });
});

describe('save data', () => {
  it('normalizes garbage into valid defaults', () => {
    expect(normalize(null)).toEqual(defaults());
    expect(normalize('x')).toEqual(defaults());
    expect(normalize({ best: -4, bestScore: 'many', games: 2.9, guideOn: 'yes', achievements: [1, 'a', null] }))
      .toEqual({ best: 0, bestScore: 0, games: 2, guideOn: true, muted: false, musicVol: 0.7, sfxVol: 1, achievements: ['a'], run: null });
  });

  it('keeps volumes between 0 and 1 and falls back when they are not numbers', () => {
    expect(normalize({ musicVol: 5, sfxVol: -2 })).toMatchObject({ musicVol: 1, sfxVol: 0 });
    expect(normalize({ musicVol: 'loud', sfxVol: NaN })).toMatchObject({ musicVol: 0.7, sfxVol: 1 });
    expect(normalize({ musicVol: 0.25, sfxVol: 0 })).toMatchObject({ musicVol: 0.25, sfxVol: 0 });
  });

  it('only keeps a saved run that looks like one', () => {
    expect(normalize({ run: 'nope' }).run).toBeNull();
    expect(normalize({ run: { score: 3 } }).run).toBeNull();
    const run = { v: 1, blocks: [{ x: 180, w: 120, type: 'std', seed: 2 }] };
    expect(normalize({ run }).run).toEqual(run);
  });

  it('round-trips volumes and a saved run', async () => {
    const run = { v: 1, blocks: [{ x: 180, w: 120, type: 'std', seed: 2 }], score: 25 };
    await save({ ...defaults(), musicVol: 0.3, sfxVol: 0.55, muted: true, run });
    const back = await load();
    expect(back).toMatchObject({ musicVol: 0.3, sfxVol: 0.55, muted: true });
    expect(back.run).toEqual(run);
  });

  it('recovers from corrupt JSON', () => {
    expect(parse('{not json')).toEqual(defaults());
  });

  it('loads defaults when nothing is stored', async () => {
    expect(await load()).toEqual(defaults());
  });

  it('round-trips through localStorage outside YouTube', async () => {
    await save({ ...defaults(), best: 12, guideOn: false, achievements: ['level'] });
    const back = await load();
    expect(back.best).toBe(12);
    expect(back.guideOn).toBe(false);
    expect(back.achievements).toEqual(['level']);
  });

  it('prefers the YouTube cloud save and also writes to it', async () => {
    const sdk = fakeSdk();
    sdk.game.loadData = vi.fn(async () => JSON.stringify({ best: 7, achievements: ['steel'] }));
    globalThis.ytgame = sdk;
    globalThis.localStorage.setItem('plumbline.save.v1', JSON.stringify({ best: 99 }));
    const loaded = await load();
    expect(loaded.best).toBe(7);
    expect(loaded.achievements).toEqual(['steel']);
    await save({ ...loaded, best: 8 });
    expect(sdk.game.saveData).toHaveBeenCalledOnce();
    expect(JSON.parse(sdk.game.saveData.mock.calls[0][0]).best).toBe(8);
    expect(JSON.parse(globalThis.localStorage.map.get('plumbline.save.v1')).best).toBe(8);
  });

  it('falls back to localStorage when the cloud save is empty', async () => {
    globalThis.ytgame = fakeSdk();
    globalThis.localStorage.setItem('plumbline.save.v1', JSON.stringify({ best: 5 }));
    expect((await load()).best).toBe(5);
  });
});
