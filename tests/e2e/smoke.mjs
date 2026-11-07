// Browser smoke test. Runs the production build in headless Chrome with a mock of the YouTube Playables SDK.
// Usage: npm run build && npm run e2e   (set CHROME_PATH if Chrome is not at /usr/bin/google-chrome)
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import fs from 'node:fs';

const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const shots = new URL('../../shots/', import.meta.url).pathname;
fs.mkdirSync(shots, { recursive: true });

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
}

const server = await preview({ preview: { port: 4173, strictPort: true } });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: chromePath, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text());
});

// The real SDK script is blocked here and replaced by a mock that records every call.
await page.route('https://www.youtube.com/**', (r) => r.abort());
await page.addInitScript(() => {
  window.__calls = [];
  window.__handlers = {};
  const log = (name, arg) => window.__calls.push([name, arg]);
  window.ytgame = {
    IN_PLAYABLES_ENV: true,
    game: {
      firstFrameReady: () => log('firstFrameReady'),
      gameReady: () => log('gameReady'),
      loadData: async () => '',
      saveData: async (s) => { log('saveData', s); }
    },
    engagement: { sendScore: async (o) => { log('sendScore', o.value); } },
    system: {
      isAudioEnabled: () => true,
      onAudioEnabledChange: (cb) => { window.__handlers.audio = cb; },
      onPause: (cb) => { window.__handlers.pause = cb; },
      onResume: (cb) => { window.__handlers.resume = cb; }
    }
  };
});

const calls = (name) => page.evaluate((n) => window.__calls.filter((c) => c[0] === n), name);
const vis = (sel) => page.locator(sel).isVisible();
const gameTime = () => page.evaluate(() => __plumb.game.time);
const tapPlayfield = async () => {
  const box = await page.locator('#frame').boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 3);
};
// Release the swinging floor when the game's own drop guide says it will land on the tower.
async function buildFloors(n) {
  for (let i = 0; i < n; i++) {
    await page.waitForFunction(() => {
      const g = __plumb.game;
      if (!g.cur || g.cur.mode !== 'swing' || g.cur.age < 0.6 || g.state !== 'play') return false;
      const ti = g.blocks.length - 1;
      return Math.abs(g.predict().x - (g.blocks[ti].x + g.sway(ti))) < 4;
    }, null, { timeout: 15000, polling: 'raf' });
    const before = await page.evaluate(() => __plumb.game.floors());
    await tapPlayfield();
    await page.waitForFunction((b) => __plumb.game.floors() > b, before, { timeout: 5000 });
  }
}

/* ---------- main menu ---------- */
await page.goto(url);
await page.waitForFunction(() => window.__plumb);
await page.waitForTimeout(400);

check('main menu shows on load with its three buttons', (await vis('#menu')) && (await vis('#btnStart')) && (await vis('#btnContinue')) && (await vis('#btnSettings')));
check('Continue is disabled when there is no saved run', await page.locator('#btnContinue').isDisabled());
check('title is Plumb Line', (await page.title()) === 'Plumb Line');
check('firstFrameReady and gameReady sent once each', (await calls('firstFrameReady')).length === 1 && (await calls('gameReady')).length === 1);
check('bundled fonts loaded', await page.evaluate(() => document.fonts.check('900 40px "Big Shoulders Display"')));
check('tapping the background of the menu does not start a game', await (async () => {
  await page.touchscreen.tap(200, 300);
  await page.waitForTimeout(200);
  return (await page.evaluate(() => __plumb.game.state)) === 'menu' && (await vis('#menu'));
})());
check('pause button is hidden on the menu', !(await vis('#btnPause')));
await page.screenshot({ path: shots + '1-menu.png' });

/* ---------- settings and sound controls ---------- */
await page.locator('#btnSettings').tap();
check('Settings opens', await vis('#settings'));
check('settings has sound switch, music and effects sliders', (await vis('#btnSnd')) && (await vis('#rngMusic')) && (await vis('#rngSfx')));
await page.screenshot({ path: shots + '2-settings.png' });

await page.locator('#rngMusic').fill('30');
check('music slider sets the music volume', (await page.evaluate(() => __plumb.data.musicVol)) === 0.3 && (await page.locator('#outMusic').textContent()) === '30%');
await page.locator('#rngSfx').fill('55');
check('effects slider sets the effects volume', (await page.evaluate(() => __plumb.data.sfxVol)) === 0.55 && (await page.locator('#outSfx').textContent()) === '55%');
check('audio engine received both volumes', await page.evaluate(() => __plumb.audio.musicVol === 0.3 && __plumb.audio.sfxVol === 0.55));
check('the first tap unlocked sound and started the music', await page.evaluate(() => !!__plumb.audio.ctx && __plumb.audio.musicOn));
// Measure the real signal leaving the audio engine, not just its settings.
await page.evaluate(() => {
  const a = __plumb.audio;
  window.__an = a.ctx.createAnalyser();
  window.__an.fftSize = 2048;
  a.master.connect(window.__an);
  window.__peak = async (ms, trigger) => {
    const buf = new Float32Array(window.__an.fftSize);
    let peak = 0;
    if (trigger) trigger();
    const end = performance.now() + ms;
    while (performance.now() < end) {
      window.__an.getFloatTimeDomainData(buf);
      for (const v of buf) peak = Math.max(peak, Math.abs(v));
      await new Promise((r) => setTimeout(r, 10));
    }
    return peak;
  };
});
await page.waitForTimeout(200);
const musicPeak = await page.evaluate(() => window.__peak(1500));
const sfxPeak = await page.evaluate(() => window.__peak(400, () => __plumb.audio.land()));
console.log('      measured music peak ' + musicPeak.toFixed(3) + ', landing effect peak ' + sfxPeak.toFixed(3));
check('audio context is running after a real touch tap', await page.evaluate(() => __plumb.audio.ctx.state) === 'running');
check('the background music is audible', musicPeak > 0.01, musicPeak.toFixed(3));
check('the landing effect is audible and louder than the music', sfxPeak > 0.1 && sfxPeak > musicPeak, sfxPeak.toFixed(3));
check('music and effects levels reach the audio buses', await page.evaluate(() => Math.abs(__plumb.audio.musicBus.gain.value - 0.3) < 1e-6 && Math.abs(__plumb.audio.sfxBus.gain.value - 0.55) < 1e-6));
await page.locator('#btnSnd').tap();
check('sound switch turns sound off', (await page.locator('#btnSnd').getAttribute('aria-checked')) === 'false' && (await page.evaluate(() => __plumb.data.muted)) === true && (await page.evaluate(() => __plumb.audio.master.gain.value)) === 0);
await page.locator('#btnSnd').tap();
check('sound switch turns sound back on', (await page.locator('#btnSnd').getAttribute('aria-checked')) === 'true' && (await page.evaluate(() => __plumb.audio.master.gain.value)) === 1);
await page.locator('#btnGuide').tap();
check('guide switch turns the guide off', (await page.evaluate(() => __plumb.game.guideOn)) === false);
await page.locator('#btnGuide').tap();
await page.locator('#btnSettingsBack').tap();
check('Back returns to the main menu', await vis('#menu'));

await page.locator('#btnHow').tap();
check('How to play lists all seven medals', (await vis('#howto')) && (await page.locator('.medal').count()) === 7);
await page.locator('#btnHowBack').tap();

/* ---------- start and play ---------- */
await page.locator('#btnStart').tap();
check('Start game begins play and shows the pause button', (await page.evaluate(() => __plumb.game.state)) === 'play' && (await vis('#btnPause')) && !(await vis('#menu')));
await buildFloors(6);
const six = await page.evaluate(() => ({ floors: __plumb.game.floors(), score: __plumb.game.score }));
check('six taps built six floors and scored', six.floors === 6 && six.score > 0, JSON.stringify(six));
await page.screenshot({ path: shots + '3-play.png' });

/* ---------- pause menu ---------- */
await page.locator('#btnPause').tap();
check('pause button opens the pause menu', (await vis('#pause')) && !(await vis('#btnPause')));
for (const id of ['#btnResume', '#btnRestart', '#btnPauseSettings', '#btnToMenu']) {
  if (!(await vis(id))) check('pause menu shows ' + id, false);
}
check('pause menu has Resume, Restart, Settings and Main menu', true);
const t1 = await gameTime();
await page.waitForTimeout(300);
check('the game is frozen while paused', t1 === (await gameTime()));
await page.screenshot({ path: shots + '4-pause.png' });

await page.locator('#btnPauseSettings').tap();
check('Settings opens from the pause menu', await vis('#settings'));
await page.locator('#btnSettingsBack').tap();
check('Back from pause settings returns to the pause menu', await vis('#pause'));

await page.locator('#btnResume').tap();
await page.waitForTimeout(300);
check('Resume continues the game', !(await vis('#pause')) && (await gameTime()) > t1 && (await vis('#btnPause')));

// Platform pause (YouTube) freezes the game and waits for the player.
await page.evaluate(() => window.__handlers.pause());
const t2 = await gameTime();
await page.waitForTimeout(300);
check('YouTube pause freezes the game and opens the pause menu', t2 === (await gameTime()) && (await vis('#pause')));
await page.evaluate(() => window.__handlers.resume());
await page.waitForTimeout(300);
check('after YouTube resume the game still waits on the pause menu', t2 === (await gameTime()) && (await vis('#pause')));
await page.locator('#btnResume').tap();
await page.waitForTimeout(300);
check('Resume continues after a YouTube pause', (await gameTime()) > t2);

// YouTube audio setting.
await page.evaluate(() => window.__handlers.audio(false));
await page.locator('#btnPause').tap();
await page.locator('#btnPauseSettings').tap();
check('YouTube audio off shows a note and turns the switch off', (await page.locator('#btnSnd').getAttribute('aria-checked')) === 'false' && (await vis('#soundNote')));
await page.evaluate(() => window.__handlers.audio(true));
check('YouTube audio on restores the switch', (await page.locator('#btnSnd').getAttribute('aria-checked')) === 'true' && !(await vis('#soundNote')));
await page.locator('#btnSettingsBack').tap();

/* ---------- main menu and Continue ---------- */
const before = await page.evaluate(() => ({ floors: __plumb.game.floors(), score: __plumb.game.score, lives: __plumb.game.lives }));
await page.locator('#btnToMenu').tap();
check('Main menu returns to the menu and clears the board', (await vis('#menu')) && (await page.evaluate(() => __plumb.game.floors())) === 0 && (await page.evaluate(() => __plumb.game.state)) === 'menu');
check('Continue is now enabled and shows the saved run', !(await page.locator('#btnContinue').isDisabled()) && /6 floors/.test(await page.locator('#continueInfo').textContent()), await page.locator('#continueInfo').textContent());
const lastSave = (await calls('saveData')).pop();
check('the run is written to the cloud save', !!lastSave && JSON.parse(lastSave[1]).run.blocks.length === 6);
await page.screenshot({ path: shots + '5-continue.png' });

await page.locator('#btnContinue').tap();
const after = await page.evaluate(() => ({ floors: __plumb.game.floors(), score: __plumb.game.score, lives: __plumb.game.lives, state: __plumb.game.state }));
check('Continue restores floors, score and lives', after.state === 'play' && after.floors === before.floors && after.score === before.score && after.lives === before.lives, JSON.stringify(after));
await buildFloors(1);
check('the restored game keeps playing', (await page.evaluate(() => __plumb.game.floors())) === 7);

/* ---------- restart ---------- */
await page.locator('#btnPause').tap();
await page.locator('#btnRestart').tap();
check('Restart asks for a second tap', (await page.locator('#btnRestart').textContent()) === 'Tap again to restart' && (await page.evaluate(() => __plumb.game.floors())) === 7);
await page.locator('#btnRestart').tap();
const rs = await page.evaluate(() => ({ floors: __plumb.game.floors(), score: __plumb.game.score, lives: __plumb.game.lives, state: __plumb.game.state }));
check('second tap restarts with a clean board', rs.state === 'play' && rs.floors === 0 && rs.score === 0 && rs.lives === 3 && !(await vis('#pause')), JSON.stringify(rs));

// Start game replaces a saved run only after confirming.
await buildFloors(2);
await page.locator('#btnPause').tap();
await page.locator('#btnToMenu').tap();
await page.locator('#btnStart').tap();
check('Start game asks before replacing a saved run', (await vis('#menu')) && /Replace saved run/.test(await page.locator('#btnStart').textContent()));
await page.locator('#btnStart').tap();
check('confirming Start game begins a new run', (await page.evaluate(() => __plumb.game.state)) === 'play' && (await page.evaluate(() => __plumb.game.floors())) === 0);

/* ---------- game over ---------- */
await page.evaluate(() => {
  const g = __plumb.game;
  g.guideOn = true;
  for (let f = 0; f < 200000 && g.floors() < 60 && g.state === 'play'; f++) {
    if (g.cur && g.cur.mode === 'swing' && g.cur.age > 0.6) {
      const ti = g.blocks.length - 1;
      if (Math.abs(g.predict().x - (g.blocks[ti].x + g.sway(ti))) < 3) g.release();
    }
    g.update(1 / 60);
  }
});
const tall = await page.evaluate(() => ({ floors: __plumb.game.floors(), finite: Number.isFinite(__plumb.game.cam) && __plumb.game.blocks.every((b) => Number.isFinite(b.x)) }));
check('autopilot builds a tall tower with finite physics', tall.floors >= 40 && tall.finite, JSON.stringify(tall));
await page.waitForTimeout(1500);
await page.screenshot({ path: shots + '6-tall.png' });

await page.evaluate(() => __plumb.game.collapse());
await page.waitForSelector('#over:not([hidden])', { timeout: 6000 });
await page.waitForTimeout(300);
const scoreCalls = await calls('sendScore');
check('score is reported to YouTube once on game over', scoreCalls.length === 1 && scoreCalls[0][1] > 0, JSON.stringify(scoreCalls));
check('game over clears the saved run and writes the best', await (async () => {
  const last = JSON.parse((await calls('saveData')).pop()[1]);
  return last.run === null && last.best >= 40;
})());
check('game over screen shows Build again and Main menu', (await vis('#btnAgain')) && (await vis('#btnOverMenu')) && Number(await page.locator('#stFloors').textContent()) >= 40);
check('pause button is hidden on the game over screen', !(await vis('#btnPause')));
await page.screenshot({ path: shots + '7-over.png' });

await page.waitForTimeout(700);
await page.locator('#btnOverMenu').tap();
check('Main menu from game over has Continue disabled', (await vis('#menu')) && (await page.locator('#btnContinue').isDisabled()));
await page.locator('#btnStart').tap();
await page.evaluate(() => __plumb.game.collapse());
await page.waitForSelector('#over:not([hidden])', { timeout: 6000 });
await page.waitForTimeout(700);
await page.locator('#btnAgain').tap();
check('Build again starts a fresh game', (await page.evaluate(() => __plumb.game.floors())) === 0 && (await page.evaluate(() => __plumb.game.state)) === 'play');

/* ---------- persistence ---------- */
await buildFloors(2);
await page.waitForTimeout(2000); // let the batched save run
await page.reload();
await page.waitForFunction(() => window.__plumb);
await page.waitForTimeout(300);
check('best score, volumes and the run in progress survive a reload', await page.evaluate(() => __plumb.data.best >= 40 && __plumb.data.musicVol === 0.3 && __plumb.data.sfxVol === 0.55));
check('Continue is offered after a reload', !(await page.locator('#btnContinue').isDisabled()) && /2 floors/.test(await page.locator('#continueInfo').textContent()));
await page.locator('#btnContinue').tap();
check('Continue after a reload restores the tower', (await page.evaluate(() => __plumb.game.floors())) === 2);
check('the saved sliders show their values after a reload', await (async () => {
  await page.locator('#btnPause').tap();
  await page.locator('#btnPauseSettings').tap();
  return (await page.locator('#rngMusic').inputValue()) === '30' && (await page.locator('#rngSfx').inputValue()) === '55';
})());
await page.screenshot({ path: shots + '8-settings-after-reload.png' });

/* ---------- the SDK script outside YouTube reports audio off ---------- */
const page2 = await context.newPage();
await page2.route('https://www.youtube.com/**', (r) => r.abort());
await page2.addInitScript(() => {
  window.ytgame = {
    IN_PLAYABLES_ENV: false,
    game: { firstFrameReady() {}, gameReady() {}, loadData: async () => '', saveData: async () => {} },
    engagement: { sendScore: async () => {} },
    system: { isAudioEnabled: () => false, onAudioEnabledChange() {}, onPause() {}, onResume() {} }
  };
});
await page2.goto(url);
await page2.waitForFunction(() => window.__plumb);
await page2.locator('#btnSettings').tap();
const sw = page2.locator('#btnSnd');
check('outside YouTube the sound switch starts On even if the SDK says off', (await sw.getAttribute('aria-checked')) === 'true' && !(await sw.isDisabled()));
await sw.tap();
check('tapping the sound switch turns it Off', (await sw.getAttribute('aria-checked')) === 'false' && (await sw.textContent()) === 'Off');
await sw.tap();
check('tapping it again turns it back On and un-mutes the audio', (await sw.getAttribute('aria-checked')) === 'true' && (await page2.evaluate(() => __plumb.audio.enabled)) === true);
await page2.close();

check('no page errors or console errors', errors.length === 0, errors.join(' | '));

await browser.close();
await server.close();
const failed = results.filter((r) => !r.ok);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
process.exit(failed.length ? 1 : 0);
