import { describe, it, expect } from 'vitest';
import { Game } from '../src/core/state.js';
import { sanitizeSnapshot } from '../src/core/snapshot.js';
import { BASEX, BH, MAX_LIVES } from '../src/core/constants.js';

function newGame() {
  const g = new Game({ rand: () => 0.5 });
  g.windTimer = 1e9; // keep the wind calm and deterministic
  g.start();
  return g;
}

/** Put a block in free fall above the tower at horizontal offset d from the top floor, then run until it resolves. */
function dropAt(g, d, w = 120, type = 'std') {
  const top = g.blocks[g.blocks.length - 1];
  g.cur = { mode: 'fall', type, m: type === 'heavy' ? 2.4 : 1, w, age: 1, len: 215, th: 0, thd: 0, x: top.x + d, cy: 0, wy: g.topY() - 150, vx: 0, vy: 0, rot: 0, seed: 99 };
  for (let i = 0; i < 240 && g.cur; i++) g.update(1 / 60);
}

describe('starting a game', () => {
  it('begins in play with a lone foundation and full lives', () => {
    const g = newGame();
    expect(g.state).toBe('play');
    expect(g.floors()).toBe(0);
    expect(g.lives).toBe(MAX_LIVES);
    expect(g.score).toBe(0);
  });

  it('spawns a swinging floor shortly after the start', () => {
    const g = newGame();
    for (let i = 0; i < 10; i++) g.update(1 / 60);
    expect(g.cur).not.toBeNull();
    expect(g.cur.mode).toBe('swing');
  });

  it('cannot release before a floor is hanging, and swings freely after', () => {
    const g = newGame();
    expect(g.release()).toBe(false);
    for (let i = 0; i < 20; i++) g.update(1 / 60);
    expect(g.release()).toBe(true);
    expect(g.cur.mode).toBe('fall');
  });
});

describe('landing', () => {
  it('scores a perfect drop and builds the floor exactly on top', () => {
    const g = newGame();
    const events = [];
    g.on('land', (e) => events.push(e));
    dropAt(g, 0);
    expect(g.floors()).toBe(1);
    expect(g.blocks[1].x).toBe(BASEX);
    expect(g.combo).toBe(1);
    expect(g.score).toBe(25);
    expect(events[0].perfect).toBe(true);
  });

  it('accepts an offset drop whose centre is over the support and resets the streak', () => {
    const g = newGame();
    dropAt(g, 0);
    dropAt(g, 25);
    expect(g.floors()).toBe(2);
    expect(g.combo).toBe(0);
    expect(g.blocks[2].x).toBeCloseTo(BASEX + 25, 5);
  });

  it('loses a hard hat when the centre is past the edge', () => {
    const g = newGame();
    const misses = [];
    g.on('miss', (e) => misses.push(e));
    dropAt(g, 90); // overlaps but centre is off the 130 wide base
    expect(g.floors()).toBe(0);
    expect(g.lives).toBe(MAX_LIVES - 1);
    expect(g.pieces.length).toBe(1);
    expect(misses[0].lives).toBe(MAX_LIVES - 1);
  });

  it('loses a hard hat on a clean miss', () => {
    const g = newGame();
    dropAt(g, 220);
    expect(g.lives).toBe(MAX_LIVES - 1);
    expect(g.floors()).toBe(0);
  });

  it('ends the game after the third miss and reaches the game over screen', () => {
    const g = newGame();
    const over = [];
    g.on('over', (f) => over.push(f));
    for (let i = 0; i < MAX_LIVES; i++) {
      g.spawnTimer = 0;
      dropAt(g, 220);
    }
    expect(g.state).toBe('ending');
    for (let i = 0; i < 100 && g.state !== 'over'; i++) g.update(0.05);
    expect(g.state).toBe('over');
    expect(over.length).toBe(1);
    expect(over[0].reason).toBe('lives');
  });

  it('straightens the tower and restores no hat when none is missing after three perfects', () => {
    const g = newGame();
    const realigned = [];
    g.on('realign', () => realigned.push(1));
    dropAt(g, 40);          // lean a little
    dropAt(g, 0);           // perfect on the leaning floor keeps x of the floor below
    dropAt(g, 0);
    dropAt(g, 0);
    expect(g.combo).toBe(3);
    expect(realigned.length).toBe(1);
    expect(g.blocks[1].x).toBeCloseTo(BASEX + 20, 5); // 40 halved
  });

  it('gives back a hard hat on the sixth perfect in a row', () => {
    const g = newGame();
    dropAt(g, 220); // lose one
    expect(g.lives).toBe(MAX_LIVES - 1);
    g.spawnTimer = 0;
    for (let i = 0; i < 6; i++) dropAt(g, 0);
    expect(g.combo).toBe(6);
    expect(g.lives).toBe(MAX_LIVES);
  });
});

describe('collapse', () => {
  it('brings the tower down when the whole stack leans too far', () => {
    const g = newGame();
    const collapsed = [];
    const overs = [];
    g.on('collapse', (e) => collapsed.push(e));
    g.on('gameover', (e) => overs.push(e));
    for (const off of [28, 56, 84]) {
      g.blocks.push({ x: BASEX + off, dx: BASEX + off, w: 120, type: 'std', m: 1, seed: off });
    }
    dropAt(g, 28);
    expect(collapsed.length).toBe(1);
    expect(collapsed[0].floors).toBe(4);
    expect(g.blocks.length).toBe(1);
    expect(g.pieces.length).toBe(4);
    expect(g.state).toBe('ending');
    expect(overs[0].reason).toBe('collapse');
    expect(overs[0].floors).toBe(4);
  });

  it('records a new best on game over', () => {
    const g = newGame();
    g.best = 2;
    for (let i = 0; i < 5; i++) dropAt(g, 0);
    g.gameOver('lives');
    expect(g.final.floors).toBe(5);
    expect(g.final.isBest).toBe(true);
    expect(g.best).toBe(5);
  });
});

describe('run stats', () => {
  it('tracks misses, streaks, steel floors and guide use', () => {
    const g = newGame();
    g.guideOn = false;
    dropAt(g, 0, 120, 'heavy');
    dropAt(g, 0);
    dropAt(g, 0);
    let s = g.stats();
    expect(s.heavy).toBe(1);
    expect(s.bestStreak).toBe(3);
    expect(s.guideOff).toBe(true);
    expect(s.misses).toBe(0);
    g.guideOn = true;
    dropAt(g, 0);
    expect(g.stats().guideOff).toBe(false);
  });
});

describe('camera', () => {
  it('follows the tower upward as it grows', () => {
    const g = newGame();
    const start = g.cam;
    for (let i = 0; i < 12; i++) dropAt(g, 0);
    for (let i = 0; i < 180; i++) g.update(1 / 60);
    expect(g.cam).toBeGreaterThan(start);
    expect(g.cam).toBeCloseTo(430 + g.blocks.length * BH, 0);
  });
});

describe('restart and return to menu', () => {
  it('restart begins a fresh run from any state, even mid-run', () => {
    const g = newGame();
    dropAt(g, 0);
    dropAt(g, 0);
    const starts = [];
    g.on('start', (e) => starts.push(e));
    g.restart();
    expect(g.state).toBe('play');
    expect(g.floors()).toBe(0);
    expect(g.score).toBe(0);
    expect(g.lives).toBe(MAX_LIVES);
    expect(g.cur).toBeNull();
    expect(starts.length).toBe(1);
  });

  it('toMenu clears the tower, goes idle and keeps best and the guide setting', () => {
    const g = newGame();
    g.best = 12;
    g.guideOn = false;
    dropAt(g, 0);
    const menus = [];
    g.on('menu', () => menus.push(1));
    g.toMenu();
    expect(g.state).toBe('menu');
    expect(g.floors()).toBe(0);
    expect(g.best).toBe(12);
    expect(g.guideOn).toBe(false);
    expect(menus.length).toBe(1);
  });

  it('cannot release a floor while in the menu', () => {
    const g = newGame();
    g.toMenu();
    for (let i = 0; i < 30; i++) g.update(1 / 60);
    expect(g.release()).toBe(false);
  });
});

describe('snapshot and restore', () => {
  function builtGame() {
    const g = newGame();
    dropAt(g, 0);
    dropAt(g, 20);
    dropAt(g, 0, 120, 'heavy');
    return g;
  }

  it('has nothing to save before the first floor or outside play', () => {
    const g = newGame();
    expect(g.snapshot()).toBeNull();
    dropAt(g, 0);
    expect(g.snapshot()).not.toBeNull();
    g.toMenu();
    expect(g.snapshot()).toBeNull();
  });

  it('survives a JSON round trip into a new game', () => {
    const g = builtGame();
    const text = JSON.stringify(g.snapshot());
    const h = new Game({ rand: () => 0.5 });
    expect(h.restore(JSON.parse(text))).toBe(true);
    expect(h.state).toBe('play');
    expect(h.floors()).toBe(3);
    expect(h.score).toBe(g.score);
    expect(h.lives).toBe(g.lives);
    expect(h.combo).toBe(g.combo);
    expect(h.blocks.map((b) => [b.type, b.w])).toEqual(g.blocks.map((b) => [b.type, b.w]));
    expect(h.blocks[3].m).toBe(2.4);
    h.blocks.forEach((b, i) => expect(b.x).toBeCloseTo(g.blocks[i].x, 1));
    expect(h.stress).toBeCloseTo(g.stress, 1);
    expect(h.stats().heavy).toBe(1);
  });

  it('keeps playing normally after a restore', () => {
    const g = builtGame();
    const h = new Game({ rand: () => 0.5 });
    h.windTimer = 1e9;
    h.restore(JSON.parse(JSON.stringify(g.snapshot())));
    dropAt(h, 0);
    expect(h.floors()).toBe(4);
  });

  it('only restores from the menu or the game over screen', () => {
    const g = builtGame();
    const snap = JSON.parse(JSON.stringify(g.snapshot()));
    expect(g.restore(snap)).toBe(false);
    g.toMenu();
    expect(g.restore(snap)).toBe(true);
  });

  it('refuses invalid snapshots and leaves the game untouched', () => {
    const g = newGame();
    g.toMenu();
    const good = { v: 1, blocks: [{ x: 180, w: 120, type: 'std', seed: 3 }], score: 25, lives: 3, combo: 1, nextType: 'std', seedCtr: 4, run: {} };
    expect(sanitizeSnapshot(good)).not.toBeNull();
    const bad = [
      null, 'x', 42, {}, { ...good, v: 2 },
      { ...good, blocks: [] },
      { ...good, blocks: new Array(1001).fill(good.blocks[0]) },
      { ...good, blocks: [{ ...good.blocks[0], type: 'base' }] },
      { ...good, blocks: [{ ...good.blocks[0], x: NaN }] },
      { ...good, blocks: [{ ...good.blocks[0], x: 99999 }] },
      { ...good, blocks: [{ ...good.blocks[0], w: 5 }] },
      { ...good, blocks: [null] },
      { ...good, lives: 0 }, { ...good, lives: 4 }, { ...good, lives: 1.5 },
      { ...good, score: -1 }, { ...good, score: '25' },
      { ...good, nextType: 'gold' }
    ];
    for (const b of bad) {
      expect(g.restore(b)).toBe(false);
      expect(g.state).toBe('menu');
      expect(g.floors()).toBe(0);
    }
  });

  it('cleans up the run counters it is given', () => {
    const s = sanitizeSnapshot({ v: 1, blocks: [{ x: 180, w: 120, type: 'std', seed: 3 }], score: 1, lives: 2, combo: 0, nextType: 'light', seedCtr: 4, run: { perfects: -3, misses: 'a', heavy: 2, guideOff: 'yes' } });
    expect(s.run).toEqual({ perfects: 0, streak: 0, bestStreak: 0, misses: 0, heavy: 2, guideOff: false });
  });
});
