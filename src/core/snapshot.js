import { MAX_LIVES, MIN_W, START_W } from './constants.js';

const TYPES = ['std', 'heavy', 'light'];
const num = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const count = (v) => (Number.isInteger(v) && v >= 0 && v <= 1e6 ? v : 0);

/**
 * Checks a saved run (it may come from the cloud or localStorage, so it is untrusted) and returns a
 * clean copy, or null when anything is off. The foundation is not stored; it is always the same.
 */
export function sanitizeSnapshot(s) {
  if (!s || typeof s !== 'object' || s.v !== 1 || !Array.isArray(s.blocks)) return null;
  if (s.blocks.length < 1 || s.blocks.length > 1000) return null;

  const blocks = [];
  for (const b of s.blocks) {
    if (!b || typeof b !== 'object') return null;
    if (!TYPES.includes(b.type) || !num(b.x, -500, 900) || !num(b.w, MIN_W, START_W) || !int(b.seed, 0, 1e9)) return null;
    blocks.push({ x: b.x, w: b.w, type: b.type, seed: b.seed });
  }

  if (!int(s.lives, 1, MAX_LIVES) || !int(s.score, 0, 1e9) || !int(s.combo, 0, 1e6)) return null;
  if (!int(s.seedCtr, 0, 1e9) || !TYPES.includes(s.nextType)) return null;

  const r = s.run && typeof s.run === 'object' ? s.run : {};
  return {
    v: 1,
    blocks,
    score: s.score,
    lives: s.lives,
    combo: s.combo,
    nextType: s.nextType,
    seedCtr: s.seedCtr,
    run: {
      perfects: count(r.perfects),
      streak: count(r.streak),
      bestStreak: count(r.bestStreak),
      misses: count(r.misses),
      heavy: count(r.heavy),
      guideOff: r.guideOff === true
    }
  };
}
