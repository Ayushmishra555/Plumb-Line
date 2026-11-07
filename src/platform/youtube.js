// Thin wrapper around the YouTube Playables SDK (window.ytgame).
// Every call is safe outside YouTube: it does nothing and returns a sensible default.

const sdk = () => (typeof globalThis !== 'undefined' ? globalThis.ytgame : undefined);

function quiet(result) {
  if (result && typeof result.catch === 'function') result.catch(() => {});
  return result;
}

export function inYouTube() {
  const s = sdk();
  return !!(s && s.IN_PLAYABLES_ENV);
}

/** Call once the first frame has been drawn. */
export function firstFrameReady() {
  try { quiet(sdk()?.game?.firstFrameReady()); } catch (e) { /* ignore */ }
}

/** Call once the game can accept input. */
export function gameReady() {
  try { quiet(sdk()?.game?.gameReady()); } catch (e) { /* ignore */ }
}

/** Cloud save string, or null when there is none or we are not in YouTube. */
export async function loadCloudData() {
  try {
    const data = await sdk()?.game?.loadData();
    return typeof data === 'string' && data.length ? data : null;
  } catch (e) {
    return null;
  }
}

export async function saveCloudData(text) {
  try { await sdk()?.game?.saveData(text); } catch (e) { /* ignore */ }
}

export function sendScore(value) {
  try {
    const v = Math.max(0, Math.floor(Number(value) || 0));
    quiet(sdk()?.engagement?.sendScore({ value: v }));
  } catch (e) { /* ignore */ }
}

/**
 * YouTube's own sound setting. It only counts inside YouTube: the SDK script also loads on other
 * pages, where it may report "off" and would otherwise keep the game silent for good.
 */
export function isAudioEnabled() {
  try {
    if (!inYouTube()) return true;
    const v = sdk()?.system?.isAudioEnabled();
    return typeof v === 'boolean' ? v : true;
  } catch (e) {
    return true;
  }
}

export function onAudioEnabledChange(cb) {
  try { if (inYouTube()) sdk()?.system?.onAudioEnabledChange(cb); } catch (e) { /* ignore */ }
}

export function onPause(cb) {
  try { sdk()?.system?.onPause(cb); } catch (e) { /* ignore */ }
}

export function onResume(cb) {
  try { sdk()?.system?.onResume(cb); } catch (e) { /* ignore */ }
}
