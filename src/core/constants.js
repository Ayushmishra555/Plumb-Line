// Logical play field. The canvas is scaled to fit, so these never change with screen size.
export const W = 360;
export const H = 640;

export const BH = 34;          // floor height in logical px
export const FLOOR_M = 3.5;    // metres per floor
export const G = 1500;         // gravity, px/s^2

export const PX = 180;         // crane pivot x
export const PY = -30;         // crane pivot y (above the screen)
export const L = 215;          // rope length
export const BASEX = 180;      // foundation centre

export const BASE_W = 130;
export const START_W = 120;
export const MIN_W = 74;
export const PERFECT_PX = 6;
export const MAX_LIVES = 3;

export const MASS = { std: 1, heavy: 2.4, light: 0.5, base: 3 };
export const NAMES = { std: 'Concrete', heavy: 'Steel', light: 'Timber' };

export const LANDMARKS = [
  [93, 'Statue of Liberty'],
  [330, 'Eiffel Tower'],
  [381, 'Empire State Building'],
  [828, 'Burj Khalifa']
];
