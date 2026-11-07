import { W, H, FLOOR_M, NAMES } from '../core/constants.js';
import { DISP, MONO, text, clamp } from './theme.js';

const DIM = 'rgba(241,237,228,.75)';
const SOFT = 'rgba(241,237,228,.85)';

export function drawHud(ctx, game) {
  const f = game.floors();
  text(ctx, 'FLOOR', 16, 24, '600 10px ' + MONO, DIM);
  text(ctx, String(f), 14, 78, '900 52px ' + DISP, '#f1ede4');
  text(ctx, (f * FLOOR_M).toFixed(1) + ' m', 16, 94, '500 12px ' + MONO, SOFT);

  const kmh = Math.round(Math.abs(game.wind) / 10) * 2;
  const windText = 'WIND ' + (kmh < 2 ? 'CALM' : (game.wind < 0 ? '← ' : '') + kmh + ' km/h' + (game.wind > 0 ? ' →' : ''));
  text(ctx, windText, 16, 114, '500 10px ' + MONO, kmh > 24 ? '#ffc53d' : SOFT);

  if (f >= 3) {
    const t = game.nextType;
    const swatch = t === 'heavy' ? '#51647d' : t === 'light' ? '#c68c52' : '#d9d3c7';
    text(ctx, 'NEXT', 16, 134, '500 10px ' + MONO, DIM);
    ctx.fillStyle = swatch;
    ctx.fillRect(52, 125, 10, 10);
    ctx.strokeStyle = 'rgba(8,12,22,.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(52.5, 125.5, 9, 9);
    text(ctx, NAMES[t].toUpperCase(), 68, 134, '500 10px ' + MONO, SOFT);
  }

  for (let i = 0; i < 3; i++) {
    const hx = W - 22 - i * 24;
    ctx.fillStyle = i < game.lives ? '#ff7a1a' : 'rgba(241,237,228,.18)';
    ctx.beginPath(); ctx.arc(hx, 24, 9, Math.PI, 0); ctx.fill();
    ctx.fillRect(hx - 12, 23, 24, 4);
    ctx.fillRect(hx - 2, 13, 4, 6);
  }
  text(ctx, 'SCORE', W - 16, 52, '600 10px ' + MONO, DIM, 'right');
  text(ctx, String(game.score), W - 16, 90, '900 34px ' + DISP, '#f1ede4', 'right');
  text(ctx, 'BEST ' + game.best, W - 16, 108, '500 10px ' + MONO, SOFT, 'right');

  // lean gauge
  const gx = 110, gw = 140, gy = H - 30;
  ctx.fillStyle = 'rgba(8,12,22,.6)';
  ctx.fillRect(gx - 2, gy - 2, gw + 4, 12);
  const s = clamp(game.stressSm, 0, 1);
  ctx.fillStyle = s < 0.55 ? '#5fe3a1' : s < 0.8 ? '#ffc53d' : '#ff5468';
  ctx.fillRect(gx, gy, gw * s, 8);
  ctx.fillStyle = 'rgba(241,237,228,.5)';
  ctx.fillRect(gx + gw * 0.55, gy - 2, 1, 12);
  ctx.fillRect(gx + gw * 0.8, gy - 2, 1, 12);
  text(ctx, 'LEAN', W / 2, gy - 7, '600 10px ' + MONO, 'rgba(241,237,228,.8)', 'center');

  if (game.combo > 0 && game.state === 'play') {
    const hint = game.combo % 3 === 2 ? '  (REALIGN NEXT)' : '';
    text(ctx, 'STREAK ' + game.combo + hint, W / 2, 156, '600 10px ' + MONO, '#ffd24a', 'center');
  }
}
