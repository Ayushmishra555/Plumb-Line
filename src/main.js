import '@fontsource/big-shoulders-display/latin-800';
import '@fontsource/big-shoulders-display/latin-900';
import '@fontsource/ibm-plex-mono/latin-500';
import '@fontsource/ibm-plex-mono/latin-600';
import './ui/styles.css';

import { Game } from './core/state.js';
import { newlyUnlocked } from './core/achievements.js';
import { Effects } from './render/effects.js';
import { createRenderer } from './render/renderer.js';
import { createUI } from './ui/screens.js';
import { AudioEngine } from './platform/audio.js';
import * as store from './platform/save.js';
import * as yt from './platform/youtube.js';

async function boot() {
  const frame = document.getElementById('frame');
  const canvas = document.getElementById('cv');

  const data = await store.load();
  const game = new Game();
  game.best = data.best;
  game.guideOn = data.guideOn;

  const fx = new Effects(game);
  const renderer = createRenderer(canvas, game, fx);
  const audio = new AudioEngine();

  let audioAllowed = yt.isAudioEnabled(); // YouTube's own sound setting
  let userPaused = false;                 // pause menu is open
  let platformPaused = false;             // YouTube paused the game
  let hidden = document.hidden;           // tab or app not visible
  const isPaused = () => userPaused || platformPaused || hidden;

  /* ---------- saving ---------- */
  // Saves are batched so a busy run does not write to the cloud on every landing.
  let saveTimer = null;
  function scheduleSave() { if (!saveTimer) saveTimer = setTimeout(flushSave, 1500); }
  function flushSave() {
    clearTimeout(saveTimer);
    saveTimer = null;
    store.save(data);
  }
  /** Remember the run in progress so Continue can offer it. */
  function captureRun() {
    if (game.state !== 'play') return;
    const snap = game.snapshot();
    if (snap) data.run = snap;
  }
  function runInfo() {
    const r = data.run;
    return r && Array.isArray(r.blocks) && r.blocks.length ? { floors: r.blocks.length, score: Number(r.score) || 0 } : null;
  }

  /* ---------- audio ---------- */
  function applyAudio() {
    audio.setEnabled(!data.muted && audioAllowed);
    audio.setMusicVolume(data.musicVol);
    audio.setSfxVolume(data.sfxVol);
  }
  function syncAudioSuspend() {
    if (platformPaused || hidden) audio.suspend(); else audio.resume();
  }
  // Browsers only allow sound after a tap. Touch screens count the release of the tap, not the press,
  // so listen to both and keep trying until the audio is really running.
  const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
  function unlockAudio() {
    if (audio.isRunning()) {
      for (const ev of UNLOCK_EVENTS) document.removeEventListener(ev, unlockAudio, true);
      return;
    }
    audio.unlock();
    applyAudio();
    audio.startMusic();
  }
  for (const ev of UNLOCK_EVENTS) document.addEventListener(ev, unlockAudio, true);

  /* ---------- screens ---------- */
  function goMenu() {
    ui.setBest(data);
    ui.setContinue(runInfo());
    ui.show('menu');
  }

  function openPause() {
    if (game.state !== 'play' || userPaused) return;
    userPaused = true;
    captureRun();
    flushSave();
    ui.setPauseInfo(game);
    ui.show('pause');
  }

  function closePause() {
    userPaused = false;
    ui.show(null);
  }

  function startNew() {
    userPaused = false;
    data.run = null;
    game.restart();
    ui.show(null);
    scheduleSave();
  }

  function continueRun() {
    if (game.restore(data.run)) {
      userPaused = false;
      ui.show(null);
    } else {
      data.run = null;
      ui.setContinue(null);
      ui.toast('That saved run could not be loaded');
      scheduleSave();
    }
  }

  function toMenu() {
    captureRun();
    flushSave();
    userPaused = false;
    game.toMenu();
    goMenu();
  }

  const ui = createUI({
    onStart: startNew,
    onContinue: continueRun,
    onPause: openPause,
    onResume: closePause,
    onRestart: startNew,
    onToMenu: toMenu,
    getMedals: () => data.achievements,
    onToggleSound() {
      data.muted = !data.muted;
      applyAudio();
      ui.syncSettings(data, audioAllowed);
      scheduleSave();
    },
    onToggleGuide() {
      game.guideOn = !game.guideOn;
      data.guideOn = game.guideOn;
      ui.syncSettings(data, audioAllowed);
      scheduleSave();
    },
    onMusicVol(v) {
      data.musicVol = v;
      applyAudio();
      ui.syncSettings(data, audioAllowed);
      scheduleSave();
    },
    onSfxVol(v, committed) {
      data.sfxVol = v;
      applyAudio();
      ui.syncSettings(data, audioAllowed);
      scheduleSave();
      if (committed) audio.preview();
    }
  });

  /* ---------- game events ---------- */
  game.on('start', () => audio.setIntensity(0));
  game.on('menu', () => audio.setIntensity(0));
  game.on('release', () => audio.release());
  game.on('land', (e) => {
    audio.land();
    if (e.perfect) audio.perfect(e.combo);
    audio.setIntensity(game.floors() / 80);
    if (e.collapsing) return;
    checkMedals();
    // Wait until the rest of the landing (realign, extra hard hat) has been applied.
    queueMicrotask(() => { captureRun(); scheduleSave(); });
  });
  game.on('miss', () => {
    audio.miss();
    queueMicrotask(() => { captureRun(); scheduleSave(); });
  });
  game.on('collapse', () => audio.collapse());

  function checkMedals() {
    const fresh = newlyUnlocked(game.stats(), data.achievements);
    for (const a of fresh) {
      data.achievements.push(a.id);
      ui.toast('Medal: ' + a.name);
      audio.medal();
    }
    if (fresh.length) scheduleSave();
  }

  game.on('gameover', (final) => {
    data.games++;
    data.best = Math.max(data.best, final.floors);
    data.bestScore = Math.max(data.bestScore, final.score);
    data.run = null;
    checkMedals();
    flushSave();
    yt.sendScore(final.score);
  });
  game.on('over', (final) => {
    audio.setIntensity(0);
    ui.showOver(final, data);
  });

  /* ---------- input ---------- */
  frame.addEventListener('pointerdown', (e) => {
    if (e.target.closest && e.target.closest('button, input, label')) return;
    if (isPaused() || game.state !== 'play') return;
    e.preventDefault();
    game.release();
  });

  document.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') && e.key !== 'Escape') return;
    const k = e.key;
    if (k === 'Escape' || k === 'p' || k === 'P') {
      if (ui.back()) return;
      if (game.state === 'play') { if (userPaused) closePause(); else openPause(); }
    } else if (k === ' ' || k === 'Enter' || k === 'ArrowDown') {
      e.preventDefault();
      if (isPaused()) return;
      if (game.state === 'play') game.release();
      else if (game.state === 'over' && ui.overReadyForRestart()) startNew();
    } else if (k === 'g' || k === 'G') {
      game.guideOn = !game.guideOn;
      data.guideOn = game.guideOn;
      ui.syncSettings(data, audioAllowed);
      scheduleSave();
    } else if (k === 'm' || k === 'M') {
      data.muted = !data.muted;
      applyAudio();
      ui.syncSettings(data, audioAllowed);
      scheduleSave();
    }
  });

  /* ---------- platform lifecycle ---------- */
  // When YouTube pauses the game, freeze it and show the pause menu so it waits for the player on return.
  yt.onPause(() => { platformPaused = true; openPause(); syncAudioSuspend(); });
  yt.onResume(() => { platformPaused = false; syncAudioSuspend(); });
  yt.onAudioEnabledChange((enabled) => {
    audioAllowed = !!enabled;
    applyAudio();
    ui.syncSettings(data, audioAllowed);
  });
  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden;
    if (hidden) { openPause(); captureRun(); flushSave(); }
    syncAudioSuspend();
  });
  window.addEventListener('pagehide', () => { captureRun(); flushSave(); });

  /* ---------- start up ---------- */
  applyAudio();
  ui.syncSettings(data, audioAllowed);
  goMenu();

  // Make sure canvas text uses the bundled fonts before the first frame.
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('900 52px "Big Shoulders Display"'),
        document.fonts.load('500 12px "IBM Plex Mono"')
      ]),
      new Promise((r) => setTimeout(r, 1500))
    ]);
  } catch (e) { /* fall back to system fonts */ }
  renderer.resize();

  let last = performance.now();
  let firstFrame = true;
  function frameLoop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (!isPaused()) {
      game.update(dt);
      fx.update(dt);
    }
    ui.setPauseButton(game.state === 'play' && !userPaused);
    renderer.draw();
    if (firstFrame) {
      firstFrame = false;
      yt.firstFrameReady();
      yt.gameReady();
    }
    requestAnimationFrame(frameLoop);
  }
  requestAnimationFrame(frameLoop);

  // Handy for automated checks. Not used by the game itself.
  window.__plumb = { game, data, ui, audio };
}

boot();
