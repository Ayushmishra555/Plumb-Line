# Plumb Line

A tower-crane stacking game for YouTube Playables. Plain web tech: ES modules, Canvas 2D, Web Audio, Vite. No engine.

## Commands
- `npm install`
- `npm run dev` : local dev server
- `npm test` : Vitest unit tests (rules, state, medals, saves, YouTube wrapper)
- `npm run build` : production build to `dist/` (zip the contents of `dist/` for upload)
- `npm run e2e` : headless Chrome smoke test with a mocked ytgame SDK (needs a build first; set CHROME_PATH if Chrome is not at /usr/bin/google-chrome)

## Screens
- **Main menu:** Start game, Continue (resumes the saved run, greyed out when there is none), Settings, How to play.
- **Settings:** sound on/off, music volume, effects volume, drop guide. Opens from the main menu and from the pause menu.
- **Pause menu** (pause button, Esc or P): Resume, Restart (asks for a second tap), Settings, Main menu.
- **Game over:** Build again, Main menu.
- The run in progress is saved after every drop, so Continue works after closing the game. YouTube pausing the game opens the pause menu.

## Layout
- `src/core` rules, state, achievements (no DOM, fully unit tested)
- `src/render` canvas drawing: backdrop, world, HUD, effects
- `src/platform` Web Audio engine, saves (cloud + localStorage), ytgame wrapper
- `src/ui` screens and styles

## YouTube Playables notes
- `index.html` loads the SDK from `https://www.youtube.com/game_api/v1`.
- The game calls `firstFrameReady` and `gameReady`, reports score with `sendScore`, saves with `saveData`/`loadData`, and follows `onPause`, `onResume` and `onAudioEnabledChange`.
- Outside YouTube every SDK call is a no-op and progress is kept in `localStorage`.
- Fonts are bundled, so the build has no runtime network dependency apart from the SDK script.
