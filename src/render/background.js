import { W, H } from '../core/constants.js';
import { rnd, clamp, mixc, rgb, skyColors } from './theme.js';

const stars = [];
const clouds = [];
const streaks = [];
let skyline0 = [];
let skyline1 = [];

function makeSkyline(seed, minH, maxH, minW, maxW) {
  const arr = [];
  let x = -20, s = seed;
  while (x < W + 40) {
    s++;
    const w = minW + rnd(s) * (maxW - minW);
    const h = minH + rnd(s * 1.7) * (maxH - minH);
    arr.push({ x, w, h });
    x += w + rnd(s * 2.3) * 6;
  }
  return arr;
}

(function init() {
  for (let i = 0; i < 70; i++) {
    stars.push({ x: rnd(i + 1) * W, y: rnd(i * 3.1 + 7) * H, r: 0.6 + rnd(i * 5.3) * 1.2, tw: rnd(i * 9.7) * 6 });
  }
  for (let i = 0; i < 7; i++) {
    clouds.push({ x: rnd(i * 2.3 + 1) * (W + 200), y: rnd(i * 4.9 + 3) * 900, s: 0.8 + rnd(i * 6.1) * 1.4, sp: 3 + rnd(i * 8.3) * 7 });
  }
  for (let i = 0; i < 16; i++) {
    streaks.push({ x: rnd(i + 3) * W, y: rnd(i * 2.7) * H, l: 18 + rnd(i * 4.1) * 30, s: 0.6 + rnd(i * 5.7) });
  }
  skyline0 = makeSkyline(11, 40, 130, 24, 46);
  skyline1 = makeSkyline(57, 24, 84, 20, 40);
})();

function drawCloud(ctx, x, y, s, a) {
  const u = 6 * s;
  ctx.fillStyle = 'rgba(255,255,255,' + a + ')';
  ctx.fillRect(x + 3 * u, y - u, 3 * u, u);
  ctx.fillRect(x + u, y, 7 * u, u);
  ctx.fillRect(x, y + u, 9 * u, u);
  ctx.fillStyle = 'rgba(120,140,190,' + a * 0.6 + ')';
  ctx.fillRect(x + u, y + 2 * u, 7 * u, u * 0.6);
}

/** Sky gradient, stars, clouds and the two skyline layers. Screen space, drawn before the world. */
export function drawBackdrop(ctx, game) {
  const t = game.skyT, cam = game.cam, time = game.time;
  const { top, bot } = skyColors(t);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rgb(top));
  g.addColorStop(1, rgb(bot));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (t > 0.4) {
    const sa = clamp((t - 0.4) * 1.8, 0, 1);
    for (const st of stars) {
      ctx.globalAlpha = sa * (0.55 + 0.45 * Math.sin(time * 2 + st.tw));
      ctx.fillStyle = '#fff';
      ctx.fillRect(st.x, (st.y + cam * 0.05) % H, st.r, st.r);
    }
    ctx.globalAlpha = 1;
  }

  const ca = clamp(0.9 - t * 0.7, 0.15, 0.9);
  for (const c of clouds) {
    const cx = ((c.x + time * c.sp) % (W + 200)) - 100;
    const cy = ((c.y + cam * 0.3) % 900) - 150;
    drawCloud(ctx, cx, cy, c.s, ca);
  }

  const layers = [[skyline0, 0.35, 0.25], [skyline1, 0.6, 0.55]];
  layers.forEach((layer, li) => {
    const [arr, par, dark] = layer;
    const by = cam * par + 560 * (1 - par);
    if (by - 140 > H) return;
    ctx.fillStyle = rgb(mixc(bot, [14, 18, 34], dark));
    for (const b of arr) ctx.fillRect(b.x, by - b.h, b.w, b.h + 600);
    if (li === 1 && t > 0.3) {
      ctx.fillStyle = 'rgba(255,217,138,' + clamp((t - 0.3) * 1.2, 0, 0.8) + ')';
      arr.forEach((b, bi) => {
        for (let wi = 0; wi < 4; wi++) {
          if (rnd(bi * 7 + wi) < 0.5) ctx.fillRect(b.x + 4 + (wi % 2) * 9, by - b.h + 8 + Math.floor(wi / 2) * 12, 3, 4);
        }
      });
    }
  });
}

/** Wind streaks drawn over everything but the HUD. */
export function drawWind(ctx, wind) {
  if (Math.abs(wind) <= 8) return;
  ctx.strokeStyle = 'rgba(255,255,255,.25)';
  ctx.lineWidth = 1;
  for (const sk of streaks) {
    sk.x += wind * 0.012 * sk.s;
    if (sk.x > W + 40) sk.x = -40;
    if (sk.x < -40) sk.x = W + 40;
    const len = sk.l * Math.abs(wind) / 90;
    ctx.beginPath();
    ctx.moveTo(sk.x, sk.y);
    ctx.lineTo(sk.x - Math.sign(wind) * len, sk.y);
    ctx.stroke();
  }
}
