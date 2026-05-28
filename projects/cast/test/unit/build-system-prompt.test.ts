import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from '@/lib/ai/build-system-prompt';

describe('buildSystemPrompt', () => {
  it('includes voice content', () => {
    const prompt = buildSystemPrompt({
      voice: { content: 'Voice X' },
      template: { name: 't', structure: 'S', writingRules: null, platform: 'linkedin' },
    });
    expect(prompt).toContain('Voice X');
  });

  it('includes template structure', () => {
    const prompt = buildSystemPrompt({
      voice: { content: 'V' },
      template: { name: 't', structure: 'STRUCT-MARK', writingRules: null, platform: 'linkedin' },
    });
    expect(prompt).toContain('STRUCT-MARK');
  });

  it('includes writing rules if present', () => {
    const prompt = buildSystemPrompt({
      voice: { content: 'V' },
      template: { name: 't', structure: 'S', writingRules: 'RULE-MARK', platform: 'linkedin' },
    });
    expect(prompt).toContain('RULE-MARK');
  });

  it('omits writing rules section if null', () => {
    const prompt = buildSystemPrompt({
      voice: { content: 'V' },
      template: { name: 't', structure: 'S', writingRules: null, platform: 'linkedin' },
    });
    expect(prompt).not.toMatch(/règles d'écriture/i);
  });

  it('mentions the platform', () => {
    const prompt = buildSystemPrompt({
      voice: { content: 'V' },
      template: { name: 't', structure: 'S', writingRules: null, platform: 'linkedin' },
    });
    expect(prompt.toLowerCase()).toContain('linkedin');
  });
});
