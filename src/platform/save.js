import { loadCloudData, saveCloudData } from './youtube.js';

const KEY = 'plumbline.save.v1';

export function defaults() {
  return {
    best: 0, bestScore: 0, games: 0,
    guideOn: true, muted: false, musicVol: 0.7, sfxVol: 1,
    achievements: [],
    run: null // snapshot of the run in progress, used by Continue
  };
}

const vol = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback);

/** Accepts anything and returns a valid save object. Unknown or malformed fields fall back to defaults. */
export function normalize(raw) {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  const int = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  return {
    best: int(raw.best),
    bestScore: int(raw.bestScore),
    games: int(raw.games),
    guideOn: typeof raw.guideOn === 'boolean' ? raw.guideOn : d.guideOn,
    muted: typeof raw.muted === 'boolean' ? raw.muted : d.muted,
    musicVol: vol(raw.musicVol, d.musicVol),
    sfxVol: vol(raw.sfxVol, d.sfxVol),
    achievements: Array.isArray(raw.achievements) ? raw.achievements.filter((x) => typeof x === 'string') : [],
    // The run is checked in full by sanitizeSnapshot when Continue is used.
    run: raw.run && typeof raw.run === 'object' && Array.isArray(raw.run.blocks) ? raw.run : null
  };
}

export function parse(text) {
  try { return normalize(JSON.parse(text)); } catch (e) { return defaults(); }
}

/** YouTube cloud save first, then localStorage, then defaults. */
export async function load() {
  const cloud = await loadCloudData();
  if (cloud) return parse(cloud);
  try {
    const local = localStorage.getItem(KEY);
    if (local) return parse(local);
  } catch (e) { /* storage blocked */ }
  return defaults();
}

/** Writes to localStorage and, inside YouTube, to the cloud save. */
export function save(data) {
  const text = JSON.stringify(normalize(data));
  try { localStorage.setItem(KEY, text); } catch (e) { /* storage blocked */ }
  return saveCloudData(text);
}
