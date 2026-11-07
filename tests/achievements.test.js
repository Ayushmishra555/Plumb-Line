import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, newlyUnlocked } from '../src/core/achievements.js';

const stats = (o = {}) => ({ floors: 0, bestStreak: 0, misses: 0, guideOff: false, heavy: 0, ...o });
const ids = (list) => list.map((a) => a.id);

describe('achievements', () => {
  it('has unique ids', () => {
    expect(new Set(ids(ACHIEVEMENTS)).size).toBe(ACHIEVEMENTS.length);
  });

  it('unlocks nothing for an empty run', () => {
    expect(newlyUnlocked(stats(), [])).toEqual([]);
  });

  it('unlocks height medals at the right floor', () => {
    expect(ids(newlyUnlocked(stats({ floors: 10, misses: 2 }), []))).toEqual(['foundations']);
    expect(ids(newlyUnlocked(stats({ floors: 26, misses: 2 }), ['foundations']))).toEqual([]);
    expect(ids(newlyUnlocked(stats({ floors: 27, misses: 2 }), ['foundations']))).toEqual(['liberty']);
    expect(ids(newlyUnlocked(stats({ floors: 95, misses: 2 }), ['foundations', 'liberty']))).toContain('lattice');
  });

  it('needs a clean run for Steady Hands and the guide off for No Guide', () => {
    expect(ids(newlyUnlocked(stats({ floors: 15, misses: 1 }), ['foundations']))).not.toContain('steady');
    expect(ids(newlyUnlocked(stats({ floors: 15, misses: 0 }), ['foundations']))).toContain('steady');
    expect(ids(newlyUnlocked(stats({ floors: 20, misses: 1, guideOff: false }), []))).not.toContain('bare');
    expect(ids(newlyUnlocked(stats({ floors: 20, misses: 1, guideOff: true }), []))).toContain('bare');
  });

  it('unlocks streak and steel medals', () => {
    expect(ids(newlyUnlocked(stats({ bestStreak: 5 }), []))).toEqual(['level']);
    expect(ids(newlyUnlocked(stats({ heavy: 5 }), []))).toEqual(['steel']);
  });

  it('never returns a medal that is already owned', () => {
    const owned = ['foundations'];
    expect(ids(newlyUnlocked(stats({ floors: 10, misses: 5 }), owned))).toEqual([]);
  });
});
