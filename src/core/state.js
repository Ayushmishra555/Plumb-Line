import {
  BH, G, PX, PY, L, BASEX, BASE_W, MAX_LIVES, MASS, PERFECT_PX
} from './constants.js';
import {
  stressOf, pickType, blockWidth, swingParams, windMagnitude, releaseState,
  stepFall, simulateFall, classifyLanding, landingPoints, realign
} from './rules.js';
import { sanitizeSnapshot } from './snapshot.js';

/**
 * All game rules and state. No DOM, no canvas, no audio. Other layers read the public fields
 * and subscribe to events: start, release, land, realign, hat, miss, collapse, gameover, over.
 */
export class Game {
  constructor(opts = {}) {
    this.rand = opts.rand || Math.random;
    this.listeners = {};
    this.best = 0;
    this.guideOn = true;
    this.state = 'menu'; // menu | play | ending | over
    this.time = 0;
    this.phase = 0;
    this.reset();
  }

  on(name, fn) {
    (this.listeners[name] = this.listeners[name] || []).push(fn);
    return () => { this.listeners[name] = this.listeners[name].filter((f) => f !== fn); };
  }
  emit(name, data) {
    const list = this.listeners[name];
    if (list) for (const fn of list.slice()) fn(data);
  }

  floors() { return Math.max(0, this.blocks.length - 1); }
  topY() { return -this.blocks.length * BH; }

  reset() {
    this.blocks = [{ x: BASEX, dx: BASEX, w: BASE_W, type: 'base', m: MASS.base, seed: 1 }];
    this.cur = null;
    this.pieces = [];
    this.cam = 560;
    this.score = 0;
    this.lives = MAX_LIVES;
    this.combo = 0;
    this.stress = 0;
    this.stressSm = 0;
    this.wind = 0;
    this.windT = 0;
    this.windTimer = 4;
    this.wob = 0;
    this.wobV = 0;
    this.realignFx = 0;
    this.skyT = 0;
    this.nextType = pickType(0, this.rand);
    this.spawnTimer = 0.05;
    this.seedCtr = 2;
    this.endTimer = 0;
    this.endReason = '';
    this.final = null;
    this.run = { perfects: 0, streak: 0, bestStreak: 0, misses: 0, heavy: 0, guideOff: true };
  }

  start() {
    if (this.state !== 'menu' && this.state !== 'over') return false;
    this.reset();
    this.state = 'play';
    this.emit('start', {});
    return true;
  }

  /** Throw away the current run and begin a new one straight away, from any state. */
  restart() {
    this.reset();
    this.state = 'play';
    this.emit('start', {});
  }

  /** Back to the idle menu state. Save a snapshot first if the player should be able to continue. */
  toMenu() {
    this.reset();
    this.state = 'menu';
    this.emit('menu', {});
  }

  /** A small, JSON-safe copy of the run in progress, or null when there is nothing worth continuing. */
  snapshot() {
    if (this.state !== 'play' || this.floors() === 0) return null;
    const r1 = (v) => Math.round(v * 10) / 10;
    return {
      v: 1,
      blocks: this.blocks.slice(1).map((b) => ({ x: r1(b.x), w: r1(b.w), type: b.type, seed: b.seed })),
      score: this.score,
      lives: this.lives,
      combo: this.combo,
      nextType: this.nextType,
      seedCtr: this.seedCtr,
      run: { ...this.run }
    };
  }

  /** Resume a saved run. Returns false, and changes nothing, when the snapshot is invalid. */
  restore(snap) {
    if (this.state !== 'menu' && this.state !== 'over') return false;
    const s = sanitizeSnapshot(snap);
    if (!s) return false;
    this.reset();
    for (const b of s.blocks) {
      this.blocks.push({ x: b.x, dx: b.x, w: b.w, type: b.type, m: MASS[b.type], seed: b.seed });
    }
    this.score = s.score;
    this.lives = s.lives;
    this.combo = s.combo;
    this.nextType = s.nextType;
    this.seedCtr = s.seedCtr;
    this.run = { ...s.run };
    this.stress = stressOf(this.blocks);
    this.stressSm = this.stress;
    this.cam = Math.max(560, 430 + this.blocks.length * BH);
    this.skyT = Math.min(1, this.floors() / 110);
    this.spawnTimer = 0.6;
    this.state = 'play';
    this.emit('start', { resumed: true });
    return true;
  }

  stats() {
    return {
      floors: this.floors(),
      bestStreak: this.run.bestStreak,
      misses: this.run.misses,
      guideOff: this.run.guideOff,
      heavy: this.run.heavy
    };
  }

  /** Horizontal sway of floor k from impact wobble and stress. Visual and used for landing checks. */
  sway(k) {
    if (k <= 0) return 0;
    const f = Math.pow(k / Math.max(this.blocks.length - 1, 6), 1.3);
    return (this.wob + this.stressSm * this.stressSm * 9 * Math.sin(this.time * 2.4)) * f;
  }

  spawnCur() {
    const n = this.floors();
    this.cur = {
      mode: 'swing', type: this.nextType, m: MASS[this.nextType],
      w: blockWidth(n), age: 0, len: L * 0.35,
      th: 0, thd: 0, x: PX, cy: PY, wy: 0, vx: 0, vy: 0, rot: 0, seed: this.seedCtr++
    };
    this.nextType = pickType(this.blocks.length, this.rand);
  }

  release() {
    const c = this.cur;
    if (!c || c.mode !== 'swing' || this.state !== 'play') return false;
    const r = releaseState(c.th, c.thd, c.len);
    c.vx = r.vx;
    c.vy = r.vy;
    c.x = r.cx;
    c.wy = r.cy - this.cam;
    c.rot = -c.th;
    c.mode = 'fall';
    this.emit('release', {});
    return true;
  }

  predict() {
    const c = this.cur;
    const r = releaseState(c.th, c.thd, c.len);
    return simulateFall({ x: r.cx, wy: r.cy - this.cam, vx: r.vx, vy: r.vy }, this.wind, this.topY());
  }

  pickWind() {
    const mag = windMagnitude(this.floors());
    this.windT = (this.rand() < 0.5 ? -1 : 1) * mag * (0.3 + this.rand() * 0.7);
    this.windTimer = 4 + this.rand() * 4;
  }

  update(dt) {
    this.time += dt;
    const n = this.blocks.length;
    const camTarget = Math.max(560, 430 + n * BH);
    this.cam += (camTarget - this.cam) * Math.min(1, dt * 3.2);
    this.skyT += (Math.min(1, this.floors() / 110) - this.skyT) * Math.min(1, dt * 1.5);

    this.windTimer -= dt;
    if (this.windTimer <= 0) this.pickWind();
    this.wind += (this.windT - this.wind) * Math.min(1, dt * 1.2);

    this.wobV += (-this.wob * 60 - this.wobV * 3.5) * dt;
    this.wob += this.wobV * dt;
    this.stressSm += (this.stress - this.stressSm) * Math.min(1, dt * 4);
    this.realignFx = Math.max(0, this.realignFx - dt * 1.2);

    for (const b of this.blocks) b.dx += (b.x - b.dx) * Math.min(1, dt * 7);

    if (this.state === 'menu' || this.state === 'play') this.updateCur(dt);

    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i];
      p.vy += G * 0.9 * dt;
      p.x += p.vx * dt;
      p.wy += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.wy + this.cam > 840) this.pieces.splice(i, 1);
    }

    if (this.state === 'ending') {
      this.endTimer -= dt;
      if (this.endTimer <= 0) {
        this.state = 'over';
        this.emit('over', this.final);
      }
    }
  }

  updateCur(dt) {
    const c = this.cur;
    if (!c) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) this.spawnCur();
      return;
    }
    if (c.mode === 'swing') {
      const { omega, amp } = swingParams(this.floors());
      this.phase += omega * dt;
      c.age += dt;
      c.len = L * Math.min(1, 0.35 + c.age * 1.8);
      c.th = amp * Math.sin(this.phase) + this.wind / 220 * 0.14;
      c.thd = amp * omega * Math.cos(this.phase);
      const R = c.len + BH / 2;
      c.x = PX + R * Math.sin(c.th);
      c.cy = PY + R * Math.cos(c.th);
    } else {
      stepFall(c, this.wind, dt);
      c.rot *= Math.exp(-6 * dt);
      const topY = this.topY();
      if (c.wy + BH / 2 >= topY) {
        c.wy = topY - BH / 2;
        this.resolveLanding();
      }
    }
  }

  resolveLanding() {
    const c = this.cur;
    const ti = this.blocks.length - 1;
    const top = this.blocks[ti];
    const d = c.x - (top.x + this.sway(ti));
    const topY = this.topY();
    const kind = classifyLanding(d, top.w, c.w);

    if (kind === 'tip' || kind === 'miss') {
      const dir = d > 0 ? 1 : -1;
      if (kind === 'tip') {
        this.pieces.push({ x: c.x, wy: topY - BH / 2, vx: dir * 70 + c.vx * 0.2, vy: 0, rot: 0, vr: dir * 2.6, w: c.w, type: c.type, seed: c.seed, idx: this.blocks.length });
      } else {
        this.pieces.push({ x: c.x, wy: c.wy, vx: c.vx, vy: c.vy, rot: c.rot, vr: dir * 1.2, w: c.w, type: c.type, seed: c.seed, idx: this.blocks.length });
      }
      this.cur = null;
      this.missed(c.x, topY);
      return;
    }

    const perfect = kind === 'perfect';
    const nx = perfect ? top.x : top.x + d;
    const newIdx = this.blocks.length;
    this.blocks.push({ x: nx, dx: c.x - this.sway(newIdx), w: c.w, type: c.type, m: c.m, seed: c.seed });
    this.cur = null;

    if (this.guideOn) this.run.guideOff = false;
    if (c.type === 'heavy') this.run.heavy++;

    this.stress = stressOf(this.blocks);
    if (this.stress > 1.0) {
      this.emit('land', { x: c.x, nx, w: c.w, topY, perfect: false, combo: 0, pts: 0, vy: c.vy, collapsing: true });
      this.collapse();
      return;
    }

    this.wobV += d * 4;
    if (perfect) {
      this.combo++;
      this.run.perfects++;
      this.run.streak = this.combo;
      if (this.combo > this.run.bestStreak) this.run.bestStreak = this.combo;
    } else {
      this.combo = 0;
      this.run.streak = 0;
    }
    const pts = landingPoints({ perfect, combo: this.combo, guideOn: this.guideOn });
    this.score += pts;
    this.emit('land', { x: c.x, nx, w: c.w, topY, perfect, combo: this.combo, pts, vy: c.vy, collapsing: false });

    if (perfect && this.combo % 3 === 0) {
      realign(this.blocks, BASEX);
      this.realignFx = 1;
      this.stress = stressOf(this.blocks);
      this.emit('realign', { x: BASEX, topY });
      if (this.combo % 6 === 0 && this.lives < MAX_LIVES) {
        this.lives++;
        this.emit('hat', { x: BASEX, topY });
      }
    }
    this.spawnTimer = 0.3;
  }

  missed(x, topY) {
    this.lives--;
    this.combo = 0;
    this.run.streak = 0;
    this.run.misses++;
    this.emit('miss', { x, topY, lives: this.lives });
    if (this.lives <= 0) this.gameOver('lives');
    else this.spawnTimer = 0.6;
  }

  collapse() {
    let M = 0, MX = 0;
    for (let k = 1; k < this.blocks.length; k++) {
      M += this.blocks[k].m;
      MX += this.blocks[k].m * this.blocks[k].x;
    }
    const dir = (MX / M - BASEX) >= 0 ? 1 : -1;
    for (let k = 1; k < this.blocks.length; k++) {
      const b = this.blocks[k];
      this.pieces.push({
        x: b.dx + this.sway(k), wy: -(k + 0.5) * BH,
        vx: dir * (20 + k * 2.2) * (0.5 + this.rand()) + (this.rand() - 0.5) * 40,
        vy: -this.rand() * 160 - 40, rot: 0, vr: dir * (0.4 + this.rand() * 2.2),
        w: b.w, type: b.type, seed: b.seed, idx: k
      });
    }
    const f = this.floors();
    this.blocks.length = 1;
    this.emit('collapse', { floors: f });
    this.gameOver('collapse', f);
  }

  gameOver(reason, floorsOverride) {
    const fl = floorsOverride === undefined ? this.floors() : floorsOverride;
    this.endReason = reason;
    const isBest = fl > this.best;
    if (isBest) this.best = fl;
    this.final = { reason, floors: fl, score: this.score, isBest, stats: { ...this.stats(), floors: fl } };
    this.state = 'ending';
    this.endTimer = reason === 'collapse' ? 1.7 : 1.0;
    this.cur = null;
    this.emit('gameover', this.final);
  }
}

export { PERFECT_PX };
