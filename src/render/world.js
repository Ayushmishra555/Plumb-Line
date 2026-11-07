import { W, H, BH, FLOOR_M, PX, PY, BASEX, LANDMARKS } from '../core/constants.js';
import { drawBlock } from './blocks.js';
import { MONO, DISP, text, clamp } from './theme.js';

/** Everything that moves with the camera: ground, ruler, tower, crane, pieces and effects. */
export function drawWorld(ctx, game, fx) {
  const cam = game.cam;
  ctx.save();
  if (fx.shake > 0.2) ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);

  drawGround(ctx, cam);
  drawRuler(ctx, cam);
  drawPlumb(ctx, game);
  drawTower(ctx, game);
  drawGuide(ctx, game);
  drawCurrent(ctx, game);

  for (const p of game.pieces) {
    ctx.save();
    ctx.translate(p.x, p.wy + cam);
    ctx.rotate(p.rot);
    drawBlock(ctx, p.w, BH, p.type, p.seed, p.idx, game.skyT);
    ctx.restore();
  }

  for (const q of fx.parts) {
    ctx.globalAlpha = clamp(1 - q.age / q.life, 0, 1);
    ctx.fillStyle = q.col;
    ctx.fillRect(q.x - q.r / 2, q.wy + cam - q.r / 2, q.r, q.r);
  }
  ctx.globalAlpha = 1;

  for (const t of fx.texts) {
    ctx.globalAlpha = clamp(1.3 - t.age, 0, 1);
    text(ctx, t.s, t.x, t.wy + cam - t.age * 34, '800 22px ' + DISP, t.col, 'center');
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawGround(ctx, cam) {
  if (cam >= H + 60) return;
  ctx.fillStyle = '#232834';
  ctx.fillRect(-10, cam, W + 20, 400);
  ctx.fillStyle = '#3a4254';
  ctx.fillRect(-10, cam, W + 20, 3);
  ctx.fillStyle = '#ffc53d';
  for (let i = -1; i * 24 < W + 24; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 24, cam + 14);
    ctx.lineTo(i * 24 + 12, cam + 14);
    ctx.lineTo(i * 24 + 6, cam + 22);
    ctx.lineTo(i * 24 - 6, cam + 22);
    ctx.closePath();
    ctx.fill();
  }
}

function drawRuler(ctx, cam) {
  const mStart = Math.max(10, Math.floor((cam - H) / BH * FLOOR_M / 10) * 10);
  const mEnd = Math.ceil(cam / BH * FLOOR_M / 10) * 10;
  ctx.lineWidth = 1;
  for (let m = mStart; m <= mEnd; m += 10) {
    const ry = cam - (m / FLOOR_M) * BH;
    if (ry < -10 || ry > H + 10) continue;
    ctx.strokeStyle = 'rgba(241,237,228,.35)';
    ctx.beginPath(); ctx.moveTo(W - 10, ry); ctx.lineTo(W, ry); ctx.stroke();
    ctx.font = '9px ' + MONO;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(241,237,228,.5)';
    ctx.fillText(m + ' m', W - 13, ry);
  }
  for (const [metres, name] of LANDMARKS) {
    const ly = cam - (metres / FLOOR_M) * BH;
    if (ly < -10 || ly > H + 10) continue;
    ctx.strokeStyle = 'rgba(241,237,228,.4)';
    ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '600 10px ' + MONO;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(241,237,228,.8)';
    ctx.fillText(metres + ' m  ' + name.toUpperCase(), 10, ly - 5);
  }
}

function drawPlumb(ctx, game) {
  const tt = game.topY() + game.cam;
  ctx.strokeStyle = 'rgba(241,237,228,' + (0.12 + game.realignFx * 0.7) + ')';
  ctx.lineWidth = 1 + game.realignFx * 1.5;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(BASEX, game.cam);
  ctx.lineTo(BASEX, Math.min(tt - 20, game.cam));
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawTower(ctx, game) {
  game.blocks.forEach((b, i) => {
    const y = game.cam - (i + 0.5) * BH;
    if (y < -BH || y > H + BH) return;
    ctx.save();
    ctx.translate(b.dx + game.sway(i), y);
    drawBlock(ctx, b.w, BH, b.type, b.seed, i, game.skyT);
    ctx.restore();
  });
}

function drawGuide(ctx, game) {
  const c = game.cur;
  if (!c || c.mode !== 'swing' || !game.guideOn || c.age <= 0.4) return;
  if (game.state !== 'play') return;
  const pr = game.predict();
  ctx.fillStyle = 'rgba(241,237,228,.55)';
  for (const [px, py] of pr.pts) ctx.fillRect(px - 1, py + game.cam - 1, 2.5, 2.5);
  const ti = game.blocks.length - 1;
  const top = game.blocks[ti];
  const dd = pr.x - (top.x + game.sway(ti));
  const color = Math.abs(dd) <= 6 ? '#5fe3a1' : Math.abs(dd) <= top.w / 2 ? '#f1ede4' : '#ff5468';
  const gy = game.topY() + game.cam;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pr.x - 7, gy - 9);
  ctx.lineTo(pr.x, gy - 2);
  ctx.lineTo(pr.x + 7, gy - 9);
  ctx.stroke();
}

function drawCurrent(ctx, game) {
  const c = game.cur;
  if (!c) return;
  if (c.mode === 'swing') {
    const hx = PX + c.len * Math.sin(c.th), hy = PY + c.len * Math.cos(c.th);
    ctx.strokeStyle = '#05080f';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(PX, PY); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#05080f';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.save();
    ctx.translate(c.x, c.cy);
    ctx.rotate(-c.th);
    drawBlock(ctx, c.w, BH, c.type, c.seed, game.blocks.length, game.skyT);
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(c.x, c.wy + game.cam);
    ctx.rotate(c.rot);
    drawBlock(ctx, c.w, BH, c.type, c.seed, game.blocks.length, game.skyT);
    ctx.restore();
  }
}
