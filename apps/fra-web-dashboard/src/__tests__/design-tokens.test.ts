import { designTokens } from '@/lib/design-tokens';

describe('web design token conversion', () => {
  it('provides CSS dimensions and shadows instead of native numbers and objects', () => {
    expect(designTokens.spacing['1']).toBe('4px');
    expect(designTokens.spacing['8']).toBe('24px');
    expect(designTokens.borderRadius.none).toBe('0px');
    expect(designTokens.typography.h1.fontSize).toBe('32px');
    expect(designTokens.typography.h1.lineHeight).toBe('1.2');
    expect(designTokens.shadows.md).toBe('0px 2px 4px rgba(0, 0, 0, 0.1)');
    expect(designTokens.components.card.shadow).toBe(designTokens.shadows.md);
    expect(designTokens.colors.primary).toBe('#3B82F6');
  });
});
