import { PAL, rnd } from './theme.js';

/** Draws one floor centred on the current origin. Callers translate and rotate first. */
export function drawBlock(ctx, w, h, type, seed, idx, skyT) {
  const x0 = -w / 2, y0 = -h / 2;
  const base = type === 'heavy' ? '#51647d' : type === 'light' ? '#c68c52' : type === 'base' ? '#7d7a74' : PAL[idx % PAL.length];
  ctx.fillStyle = base;
  ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.fillRect(x0, y0, w, 3);
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.fillRect(x0, y0 + h - 4, w, 4);

  if (type === 'std') {
    const cols = Math.max(2, Math.floor((w - 16) / 20));
    const gap = (w - 16) / cols;
    const litChance = 0.12 + 0.65 * skyT;
    for (let i = 0; i < cols; i++) {
      const wx = x0 + 8 + (i + 0.5) * gap - 5.5;
      ctx.fillStyle = rnd(seed * 13 + i) < litChance ? '#ffd98a' : '#31465f';
      ctx.fillRect(wx, -8, 11, 15);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(wx, -8, 11, 2);
      ctx.fillRect(wx + 5, -8, 1, 15);
    }
  } else if (type === 'heavy') {
    ctx.fillStyle = '#ffc53d';
    ctx.fillRect(x0, y0, w, 7);
    ctx.fillStyle = '#10151f';
    for (let i = 0; i * 14 + 5 < w; i++) ctx.fillRect(x0 + i * 14 + 5, y0, Math.min(6, w - (i * 14 + 5)), 7);
    ctx.strokeStyle = '#2f3d52';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0 + 2, y0 + 9); ctx.lineTo(x0 + w - 2, y0 + h - 5);
    ctx.moveTo(x0 + w - 2, y0 + 9); ctx.lineTo(x0 + 2, y0 + h - 5);
    ctx.stroke();
    ctx.fillStyle = '#c9d4e4';
    ctx.fillRect(x0 + 3, y0 + 10, 2, 2);
    ctx.fillRect(x0 + w - 5, y0 + 10, 2, 2);
  } else if (type === 'light') {
    ctx.fillStyle = '#9b6a39';
    ctx.fillRect(x0, y0 + h / 3, w, 1.5);
    ctx.fillRect(x0, y0 + 2 * h / 3, w, 1.5);
    ctx.fillStyle = '#3a2a1c';
    ctx.fillRect(-w / 4 - 5, -6, 10, 12);
    ctx.fillRect(w / 4 - 5, -6, 10, 12);
  } else {
    ctx.fillStyle = '#ffc53d';
    for (let i = 0; i * 16 < w; i++) ctx.fillRect(x0 + i * 16, y0 + h - 8, 8, 4);
  }
  ctx.strokeStyle = 'rgba(10,14,24,.8)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x0 + 0.75, y0 + 0.75, w - 1.5, h - 1.5);
}
