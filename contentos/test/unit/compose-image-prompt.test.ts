import { describe, expect, test } from 'vitest';
import { composeImagePrompt } from '@/lib/ai/generate-image';
import { IMAGE_ASPECT_RATIOS } from '@/lib/media/aspect-ratios';

describe('composeImagePrompt', () => {
  test('prompt seul', () => {
    expect(composeImagePrompt('un chat')).toBe('un chat');
  });
  test('prompt + style', () => {
    expect(composeImagePrompt('un chat', 'flat design minimaliste')).toBe(
      'un chat\n\nStyle : flat design minimaliste',
    );
  });
  test('style null/vide ignoré', () => {
    expect(composeImagePrompt('un chat', null)).toBe('un chat');
    expect(composeImagePrompt('un chat', '')).toBe('un chat');
    expect(composeImagePrompt('un chat', '   ')).toBe('un chat');
  });
});

describe('IMAGE_ASPECT_RATIOS', () => {
  test('expose les ratios LinkedIn', () => {
    expect(IMAGE_ASPECT_RATIOS).toEqual(['1:1', '4:5', '16:9']);
  });
});
