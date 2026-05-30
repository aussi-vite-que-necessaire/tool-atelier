import { describe, expect, it } from 'vitest';
import { moveInList } from '@/lib/ressources/reorder';

describe('moveInList', () => {
  it('monte un élément', () => {
    expect(moveInList(['a', 'b', 'c'], 'b', 'up')).toEqual(['b', 'a', 'c']);
  });
  it('descend un élément', () => {
    expect(moveInList(['a', 'b', 'c'], 'b', 'down')).toEqual(['a', 'c', 'b']);
  });
  it('no-op aux bords', () => {
    expect(moveInList(['a', 'b'], 'a', 'up')).toEqual(['a', 'b']);
    expect(moveInList(['a', 'b'], 'b', 'down')).toEqual(['a', 'b']);
  });
  it('no-op pour un id absent', () => {
    expect(moveInList(['a'], 'z', 'up')).toEqual(['a']);
  });
});
