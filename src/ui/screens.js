import { ACHIEVEMENTS } from '../core/achievements.js';
import { FLOOR_M } from '../core/constants.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['menu', 'howto', 'settings', 'pause', 'over'];

/**
 * All DOM for the menus. It owns which screen is showing and nothing else: game decisions are made
 * by the handlers passed in from main.js.
 */
export function createUI(h) {
  const els = {};
  for (const n of SCREENS) els[n] = $(n);

  const btnPause = $('btnPause'), btnSnd = $('btnSnd'), btnGuide = $('btnGuide');
  const rngMusic = $('rngMusic'), rngSfx = $('rngSfx');
  const toastEl = $('toast');

  let current = 'menu';
  let settingsFrom = 'menu';
  let overShownAt = 0;
  let toastTimer = null;
  let hasRun = false;

  function show(name) {
    current = name;
    for (const n of SCREENS) els[n].hidden = n !== name;
    btnPause.hidden = name !== null; // the pause button only shows over the bare play field
  }

  /** A button that asks for a second tap when `needs()` is true, so one stray tap cannot destroy progress. */
  function confirmable(btn, needs, armedText, action) {
    const idle = btn.textContent;
    let timer = null;
    const disarm = () => { clearTimeout(timer); timer = null; btn.textContent = idle; btn.classList.remove('armed'); };
    btn.addEventListener('click', () => {
      if (timer) { disarm(); action(); return; }
      if (!needs()) { action(); return; }
      btn.textContent = armedText;
      btn.classList.add('armed');
      timer = setTimeout(disarm, 3000);
    });
  }

  // Main menu
  confirmable($('btnStart'), () => hasRun, 'Replace saved run? Tap again', () => h.onStart());
  $('btnContinue').addEventListener('click', () => h.onContinue());
  $('btnSettings').addEventListener('click', () => openSettings('menu'));
  $('btnHow').addEventListener('click', () => { renderMedals(h.getMedals()); show('howto'); });
  $('btnHowBack').addEventListener('click', () => show('menu'));

  // Settings
  function openSettings(from) { settingsFrom = from; show('settings'); }
  $('btnSettingsBack').addEventListener('click', () => show(settingsFrom));
  btnSnd.addEventListener('click', () => h.onToggleSound());
  btnGuide.addEventListener('click', () => h.onToggleGuide());
  rngMusic.addEventListener('input', () => h.onMusicVol(Number(rngMusic.value) / 100));
  rngSfx.addEventListener('input', () => h.onSfxVol(Number(rngSfx.value) / 100, false));
  rngSfx.addEventListener('change', () => h.onSfxVol(Number(rngSfx.value) / 100, true));

  // In game
  btnPause.addEventListener('click', () => h.onPause());
  $('btnResume').addEventListener('click', () => h.onResume());
  confirmable($('btnRestart'), () => true, 'Tap again to restart', () => h.onRestart());
  $('btnPauseSettings').addEventListener('click', () => openSettings('pause'));
  $('btnToMenu').addEventListener('click', () => h.onToMenu());

  // Game over
  $('btnAgain').addEventListener('click', () => { if (performance.now() - overShownAt > 600) h.onRestart(); });
  $('btnOverMenu').addEventListener('click', () => h.onToMenu());

  function renderMedals(owned) {
    const el = $('medals');
    el.textContent = '';
    for (const a of ACHIEVEMENTS) {
      const s = document.createElement('span');
      s.className = 'medal' + (owned.includes(a.id) ? ' on' : '');
      s.title = a.desc;
      s.textContent = a.name;
      el.appendChild(s);
    }
  }

  const metres = (floors) => (floors * FLOOR_M).toFixed(1) + ' m';

  return {
    show,
    current: () => current,

    /** Escape key: leave settings or the how-to screen. Returns true when it did something. */
    back() {
      if (current === 'settings') { show(settingsFrom); return true; }
      if (current === 'howto') { show('menu'); return true; }
      return false;
    },

    setBest(save) {
      $('bestLine').textContent = 'Best: ' + save.best + ' floors (' + metres(save.best) + ')';
    },

    /** info is { floors, score } for a saved run, or null when there is none. */
    setContinue(info) {
      hasRun = !!info;
      $('btnContinue').disabled = !info;
      $('continueInfo').textContent = info ? info.floors + ' floors · ' + info.score + ' pts' : 'No saved run';
    },

    setPauseInfo(game) {
      $('pFloors').textContent = game.floors();
      $('pHeight').textContent = metres(game.floors());
      $('pScore').textContent = game.score;
    },

    setPauseButton(visible) { if (btnPause.hidden === visible) btnPause.hidden = !visible; },

    syncSettings(save, audioAllowed) {
      const soundOn = !save.muted && audioAllowed;
      btnSnd.textContent = soundOn ? 'On' : 'Off';
      btnSnd.setAttribute('aria-checked', soundOn ? 'true' : 'false');
      // When YouTube has sound off, the switch cannot override it, so say so instead of looking broken.
      btnSnd.disabled = !audioAllowed;
      $('soundNote').hidden = audioAllowed;
      $('sliders').classList.toggle('dim', !soundOn);
      const m = Math.round(save.musicVol * 100), s = Math.round(save.sfxVol * 100);
      if (document.activeElement !== rngMusic) rngMusic.value = m;
      if (document.activeElement !== rngSfx) rngSfx.value = s;
      $('outMusic').textContent = m + '%';
      $('outSfx').textContent = s + '%';
      btnGuide.textContent = save.guideOn ? 'On' : 'Off';
      btnGuide.setAttribute('aria-checked', save.guideOn ? 'true' : 'false');
    },

    showOver(final, save) {
      $('overTag').textContent = final.reason === 'collapse' ? 'Structural failure' : 'Site closed';
      $('overTitle').textContent = final.reason === 'collapse' ? 'The stack came down' : 'Out of hard hats';
      $('stFloors').textContent = final.floors;
      $('stHeight').textContent = metres(final.floors);
      $('stScore').textContent = final.score;
      $('overNote').textContent = final.isBest
        ? 'New best: ' + final.floors + ' floors.'
        : 'Best: ' + save.best + ' floors (' + metres(save.best) + ').';
      show('over');
      overShownAt = performance.now();
    },

    toast(message) {
      toastEl.textContent = message;
      toastEl.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600);
    },

    overReadyForRestart() { return performance.now() - overShownAt > 600; }
  };
}
