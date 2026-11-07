import { BH, G, PX, PY, MIN_W, START_W, PERFECT_PX } from './constants.js';

/**
 * Worst joint stress in the stack. For every joint, the combined centre of mass of everything
 * above it is compared with the support below. 1.0 means the centre of mass is exactly at the edge.
 */
export function stressOf(blocks) {
  let worst = 0, M = 0, MX = 0;
  for (let k = blocks.length - 1; k >= 1; k--) {
    M += blocks[k].m;
    MX += blocks[k].m * blocks[k].x;
    const com = MX / M;
    const support = blocks[k - 1];
    const r = Math.abs(com - support.x) / (support.w / 2);
    if (r > worst) worst = r;
  }
  return worst;
}

export function pickType(floorsBuilt, rand) {
  if (floorsBuilt < 4) return 'std';
  const r = rand();
  return r < 0.14 ? 'heavy' : r < 0.28 ? 'light' : 'std';
}

export function blockWidth(floorsBuilt) {
  return Math.max(MIN_W, START_W - floorsBuilt * 0.7);
}

export function swingParams(floorsBuilt) {
  return {
    omega: 1.6 + Math.min(floorsBuilt, 80) * 0.018,
    amp: 0.5 + Math.min(floorsBuilt, 60) * 0.002
  };
}

/** Maximum wind acceleration (px/s^2) at a given height. Calm for the first five floors. */
export function windMagnitude(floorsBuilt) {
  return Math.min(220, Math.max(0, (floorsBuilt - 5) * 8));
}

/** Position and velocity of the hanging block's centre at the moment it is released. */
export function releaseState(th, thd, len) {
  const R = len + BH / 2;
  return {
    cx: PX + R * Math.sin(th),
    cy: PY + R * Math.cos(th),
    vx: R * thd * Math.cos(th) * 0.75,
    vy: -R * thd * Math.sin(th) * 0.75
  };
}

/** Advance a falling block by dt. Mutates and returns the body. */
export function stepFall(body, wind, dt) {
  body.vy += G * dt;
  body.vx += wind * dt;
  body.vx *= Math.exp(-0.9 * dt);
  body.x += body.vx * dt;
  body.wy += body.vy * dt;
  return body;
}

/** Where a block released now would land. Returns the sampled path for the drop guide. */
export function simulateFall(start, wind, topY, maxSteps = 260) {
  const body = { x: start.x, wy: start.wy, vx: start.vx, vy: start.vy };
  const pts = [];
  for (let i = 0; i < maxSteps; i++) {
    stepFall(body, wind, 1 / 60);
    if (i % 5 === 0) pts.push([body.x, body.wy]);
    if (body.wy + BH / 2 >= topY) break;
  }
  return { x: body.x, pts };
}

/**
 * d is the horizontal offset between the falling block's centre and the floor below.
 * perfect: within a few px. ok: centre is over the support. tip: overlaps but the centre is off
 * the support, so it tips away. miss: no overlap at all.
 */
export function classifyLanding(d, topW, curW) {
  const a = Math.abs(d), half = topW / 2;
  if (a <= PERFECT_PX) return 'perfect';
  if (a <= half) return 'ok';
  if (a < half + curW / 2) return 'tip';
  return 'miss';
}

export function landingPoints({ perfect, combo, guideOn }) {
  let pts = 10;
  if (perfect) pts += 10 + 5 * Math.min(combo, 8);
  if (!guideOn) pts = Math.round(pts * 1.5);
  return pts;
}

/** Pull every floor halfway back toward the foundation line. Mutates blocks. */
export function realign(blocks, baseX) {
  for (let j = 1; j < blocks.length; j++) {
    blocks[j].x = baseX + (blocks[j].x - baseX) * 0.5;
  }
}
