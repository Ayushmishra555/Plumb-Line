import { W } from '../core/constants.js';
import { drawBackdrop, drawWind } from './background.js';
import { drawWorld } from './world.js';
import { drawHud } from './hud.js';

export function createRenderer(canvas, game, fx) {
  const ctx = canvas.getContext('2d');
  let scale = 1;

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.max(2, Math.round(r.width * dpr));
    canvas.height = Math.max(2, Math.round(r.height * dpr));
    scale = canvas.width / W;
  }

  function draw() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawBackdrop(ctx, game);
    drawWorld(ctx, game, fx);
    drawWind(ctx, game.wind);
    if (game.state === 'play' || game.state === 'ending') drawHud(ctx, game);
  }

  window.addEventListener('resize', resize);
  resize();
  return { draw, resize };
}
