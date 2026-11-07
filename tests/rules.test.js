import { describe, it, expect } from 'vitest';
import {
  stressOf, pickType, blockWidth, windMagnitude, releaseState,
  simulateFall, classifyLanding, landingPoints, realign
} from '../src/core/rules.js';
import { BASEX, BH, PX, MIN_W } from '../src/core/constants.js';

const base = () => ({ x: BASEX, w: 130, m: 3 });
const floor = (x, m = 1, w = 120) => ({ x, w, m });

describe('stressOf', () => {
  it('is zero for a lone foundation and for a centred stack', () => {
    expect(stressOf([base()])).toBe(0);
    expect(stressOf([base(), floor(BASEX), floor(BASEX)])).toBe(0);
  });

  it('measures offset against half the support width', () => {
    expect(stressOf([base(), floor(BASEX + 32.5)])).toBeCloseTo(0.5, 5);
  });

  it('adds up lean in the same direction', () => {
    const lean = [base(), floor(BASEX + 28), floor(BASEX + 56), floor(BASEX + 84), floor(BASEX + 112)];
    expect(stressOf(lean)).toBeGreaterThan(1);
  });

  it('is cancelled by alternating offsets', () => {
    const zigzag = [base(), floor(BASEX + 28), floor(BASEX - 28), floor(BASEX + 28), floor(BASEX - 28)];
    expect(stressOf(zigzag)).toBeLessThan(1);
  });

  it('counts a heavy floor more than a light one when it sits under other floors', () => {
    const heavy = stressOf([base(), floor(BASEX + 45, 2.4), floor(BASEX + 25)]);
    const light = stressOf([base(), floor(BASEX + 45, 0.5), floor(BASEX + 25)]);
    expect(heavy).toBeCloseTo(0.602, 2);
    expect(light).toBeCloseTo(0.487, 2);
    expect(heavy).toBeGreaterThan(light);
  });
});

describe('classifyLanding', () => {
  it('sorts landings by how far off centre they are', () => {
    expect(classifyLanding(0, 120, 120)).toBe('perfect');
    expect(classifyLanding(-6, 120, 120)).toBe('perfect');
    expect(classifyLanding(30, 120, 120)).toBe('ok');
    expect(classifyLanding(60, 120, 120)).toBe('ok');
    expect(classifyLanding(61, 120, 120)).toBe('tip');
    expect(classifyLanding(-100, 120, 120)).toBe('tip');
    expect(classifyLanding(120, 120, 120)).toBe('miss');
    expect(classifyLanding(300, 120, 120)).toBe('miss');
  });
});

describe('landingPoints', () => {
  it('scores a normal drop, a perfect drop and a streak', () => {
    expect(landingPoints({ perfect: false, combo: 0, guideOn: true })).toBe(10);
    expect(landingPoints({ perfect: true, combo: 1, guideOn: true })).toBe(25);
    expect(landingPoints({ perfect: true, combo: 3, guideOn: true })).toBe(35);
  });
  it('caps the streak bonus at eight', () => {
    expect(landingPoints({ perfect: true, combo: 8, guideOn: true })).toBe(60);
    expect(landingPoints({ perfect: true, combo: 30, guideOn: true })).toBe(60);
  });
  it('multiplies by 1.5 with the guide off', () => {
    expect(landingPoints({ perfect: false, combo: 0, guideOn: false })).toBe(15);
    expect(landingPoints({ perfect: true, combo: 1, guideOn: false })).toBe(38);
  });
});

describe('progression', () => {
  it('narrows floors down to a minimum width', () => {
    expect(blockWidth(0)).toBe(120);
    expect(blockWidth(20)).toBeCloseTo(106, 5);
    expect(blockWidth(500)).toBe(MIN_W);
  });
  it('keeps the first five floors calm and caps the wind', () => {
    expect(windMagnitude(0)).toBe(0);
    expect(windMagnitude(5)).toBe(0);
    expect(windMagnitude(6)).toBe(8);
    expect(windMagnitude(500)).toBe(220);
  });
  it('only offers heavy and timber floors after floor three', () => {
    expect(pickType(3, () => 0.01)).toBe('std');
    expect(pickType(4, () => 0.1)).toBe('heavy');
    expect(pickType(4, () => 0.2)).toBe('light');
    expect(pickType(4, () => 0.9)).toBe('std');
  });
});

describe('realign', () => {
  it('halves every offset from the foundation line and leaves the foundation alone', () => {
    const blocks = [base(), floor(BASEX + 40), floor(BASEX - 20)];
    realign(blocks, BASEX);
    expect(blocks[0].x).toBe(BASEX);
    expect(blocks[1].x).toBe(BASEX + 20);
    expect(blocks[2].x).toBe(BASEX - 10);
  });
});

describe('fall physics', () => {
  it('releases straight down from the middle of the swing', () => {
    const r = releaseState(0, 0, 215);
    expect(r.cx).toBeCloseTo(PX, 5);
    expect(r.vx).toBeCloseTo(0, 5);
  });
  it('drops a still block straight down', () => {
    const out = simulateFall({ x: 180, wy: -200, vx: 0, vy: 0 }, 0, -BH * 3);
    expect(out.x).toBeCloseTo(180, 5);
    expect(out.pts.length).toBeGreaterThan(0);
  });
  it('drifts with the wind', () => {
    const right = simulateFall({ x: 180, wy: -200, vx: 0, vy: 0 }, 200, -BH * 3);
    const left = simulateFall({ x: 180, wy: -200, vx: 0, vy: 0 }, -200, -BH * 3);
    expect(right.x).toBeGreaterThan(190);
    expect(left.x).toBeLessThan(170);
  });
});
