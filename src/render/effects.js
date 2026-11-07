import { BASEX } from '../core/constants.js';

/** Visual-only effects (particles, floating text, screen shake) driven by game events. */
export class Effects {
  constructor(game) {
    this.parts = [];
    this.texts = [];
    this.shake = 0;

    game.on('start', () => this.clear());
    game.on('menu', () => this.clear());
    game.on('land', (e) => {
      this.dust(e.x - e.w / 2, e.topY, 4, 'rgba(225,220,205,.8)', 8);
      this.dust(e.x + e.w / 2, e.topY, 4, 'rgba(225,220,205,.8)', 8);
      this.shake = Math.max(this.shake, 3 + Math.min(Math.abs(e.vy) / 250, 3));
      if (e.collapsing) return;
      const y = e.topY - 17 - 26;
      if (e.perfect) {
        this.sparkle(e.nx, e.topY - 17, 14);
        this.text(e.nx, y, e.combo > 1 ? 'PERFECT x' + e.combo : 'PERFECT', '#ffd24a');
      } else {
        this.text(e.nx, y, '+' + e.pts, '#f1ede4');
      }
    });
    game.on('realign', (e) => this.text(BASEX, e.topY - 17 - 54, 'REALIGNED', '#5fe3a1'));
    game.on('hat', (e) => this.text(BASEX, e.topY - 17 - 80, 'HARD HAT +1', '#5fe3a1'));
    game.on('miss', (e) => {
      this.shake = Math.max(this.shake, 6);
      this.text(e.x, e.topY - 30, 'MISS', '#ff5468');
    });
    game.on('collapse', () => {
      this.shake = 14;
      this.text(BASEX, -68, 'COLLAPSE', '#ff5468');
    });
  }

  clear() { this.parts.length = 0; this.texts.length = 0; this.shake = 0; }

  text(x, wy, s, col) { this.texts.push({ x, wy, s, col, age: 0 }); }

  dust(x, wy, n, col, spread) {
    for (let i = 0; i < n; i++) {
      this.parts.push({
        x: x + (Math.random() - 0.5) * spread, wy,
        vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 110 - 20,
        life: 0.6 + Math.random() * 0.4, age: 0, col, r: 1.5 + Math.random() * 2.5
      });
    }
  }

  sparkle(x, wy, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 140;
      this.parts.push({
        x, wy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40,
        life: 0.5 + Math.random() * 0.5, age: 0, col: '#ffd24a', r: 1.5 + Math.random() * 1.8
      });
    }
  }

  update(dt) {
    this.shake *= Math.pow(0.002, dt);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.age += dt;
      if (q.age >= q.life) { this.parts.splice(i, 1); continue; }
      q.vy += 500 * dt;
      q.x += q.vx * dt;
      q.wy += q.vy * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      this.texts[i].age += dt;
      if (this.texts[i].age > 1.3) this.texts.splice(i, 1);
    }
  }
}
