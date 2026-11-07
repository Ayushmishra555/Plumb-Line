export const DISP = "'Big Shoulders Display','Arial Narrow',Impact,sans-serif";
export const MONO = "'IBM Plex Mono',ui-monospace,Menlo,monospace";

export const PAL = ['#d9d3c7', '#c3ccd4', '#d3bd9d', '#b8c5b3', '#cfc6d4'];

export const SKY = {
  day: { top: [120, 176, 232], bot: [250, 222, 178] },
  dusk: { top: [52, 64, 140], bot: [240, 134, 104] },
  night: { top: [6, 9, 26], bot: [26, 34, 84] }
};

export function rnd(s) {
  s = Math.sin(s * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
export function rgb(c) { return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; }

export function skyColors(t) {
  if (t < 0.5) return { top: mixc(SKY.day.top, SKY.dusk.top, t * 2), bot: mixc(SKY.day.bot, SKY.dusk.bot, t * 2) };
  return { top: mixc(SKY.dusk.top, SKY.night.top, (t - 0.5) * 2), bot: mixc(SKY.dusk.bot, SKY.night.bot, (t - 0.5) * 2) };
}

export function text(ctx, s, x, y, font, color, align) {
  ctx.font = font;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(8,12,22,.55)';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}
