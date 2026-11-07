import { FLOOR_M } from './constants.js';

// stats: { floors, bestStreak, misses, guideOff, heavy }
export const ACHIEVEMENTS = [
  { id: 'foundations', name: 'Foundations', desc: 'Reach 10 floors', test: (s) => s.floors >= 10 },
  { id: 'liberty', name: 'Lady Liberty', desc: 'Pass 93 m', test: (s) => s.floors * FLOOR_M >= 93 },
  { id: 'lattice', name: 'Iron Lattice', desc: 'Pass 330 m', test: (s) => s.floors * FLOOR_M >= 330 },
  { id: 'level', name: 'Dead Level', desc: 'Five perfect drops in a row', test: (s) => s.bestStreak >= 5 },
  { id: 'steady', name: 'Steady Hands', desc: '15 floors without losing a hard hat', test: (s) => s.floors >= 15 && s.misses === 0 },
  { id: 'bare', name: 'No Guide', desc: '20 floors with the guide off', test: (s) => s.floors >= 20 && s.guideOff },
  { id: 'steel', name: 'Heavy Lifter', desc: 'Place 5 steel floors in one build', test: (s) => s.heavy >= 5 }
];

/** Achievements whose condition is met now and that are not already owned. */
export function newlyUnlocked(stats, owned) {
  return ACHIEVEMENTS.filter((a) => !owned.includes(a.id) && a.test(stats));
}
