import { describe, it, expect } from 'vitest';
import {
  colors,
  govColors,
  greyScale,
  semanticColors,
  statusColors,
  riskColors,
} from '../tokens/colors.js';
import { SPACING_UNIT, spacing, componentSpacing } from '../tokens/spacing.js';
import { fontSizes, fontWeights, lineHeights, textStyles } from '../tokens/typography.js';
import { borderWidths, borderRadius, shadows } from '../tokens/borders.js';

// --- Colors ---

describe('colors', () => {
  describe('govColors', () => {
    it('has 10 government colors', () => {
      expect(Object.keys(govColors)).toHaveLength(10);
    });

    it('contains expected color keys', () => {
      const expected = [
        'blue',
        'blueDark',
        'blueLight',
        'green',
        'red',
        'yellow',
        'orange',
        'purple',
        'pink',
        'turquoise',
      ];
      for (const key of expected) {
        expect(govColors).toHaveProperty(key);
      }
    });
  });

  describe('greyScale', () => {
    it('has 5 grey values', () => {
      expect(Object.keys(greyScale)).toHaveLength(5);
    });

    it('contains grey1 through grey5', () => {
      expect(greyScale).toHaveProperty('grey1');
      expect(greyScale).toHaveProperty('grey2');
      expect(greyScale).toHaveProperty('grey3');
      expect(greyScale).toHaveProperty('grey4');
      expect(greyScale).toHaveProperty('grey5');
    });
  });

  describe('semanticColors', () => {
    it('has at least 13 semantic colors', () => {
      expect(Object.keys(semanticColors).length).toBeGreaterThanOrEqual(13);
    });

    it('contains status colors', () => {
      expect(semanticColors).toHaveProperty('success');
      expect(semanticColors).toHaveProperty('warning');
      expect(semanticColors).toHaveProperty('error');
      expect(semanticColors).toHaveProperty('info');
    });

    it('contains text colors', () => {
      expect(semanticColors).toHaveProperty('textPrimary');
      expect(semanticColors).toHaveProperty('textSecondary');
      expect(semanticColors).toHaveProperty('textMuted');
      expect(semanticColors).toHaveProperty('textInverse');
    });

    it('contains background colors', () => {
      expect(semanticColors).toHaveProperty('backgroundPrimary');
      expect(semanticColors).toHaveProperty('backgroundSecondary');
      expect(semanticColors).toHaveProperty('backgroundSection');
      expect(semanticColors).toHaveProperty('backgroundHighlight');
    });

    it('contains border colors', () => {
      expect(semanticColors).toHaveProperty('borderPrimary');
      expect(semanticColors).toHaveProperty('borderSecondary');
      expect(semanticColors).toHaveProperty('borderFocus');
    });
  });

  describe('statusColors', () => {
    it('has 5 status colors', () => {
      expect(Object.keys(statusColors)).toHaveLength(5);
    });

    it('contains expected status keys', () => {
      expect(statusColors).toHaveProperty('notStarted');
      expect(statusColors).toHaveProperty('inProgress');
      expect(statusColors).toHaveProperty('completed');
      expect(statusColors).toHaveProperty('pendingAction');
      expect(statusColors).toHaveProperty('overdue');
    });
  });

  describe('riskColors', () => {
    it('has 5 risk colors', () => {
      expect(Object.keys(riskColors)).toHaveLength(5);
    });

    it('contains expected risk keys', () => {
      expect(riskColors).toHaveProperty('high');
      expect(riskColors).toHaveProperty('medium');
      expect(riskColors).toHaveProperty('low');
      expect(riskColors).toHaveProperty('critical');
      expect(riskColors).toHaveProperty('none');
    });
  });

  describe('colors (combined palette)', () => {
    it('includes gov, grey, semantic, status, risk, and base sub-objects', () => {
      expect(colors).toHaveProperty('gov');
      expect(colors).toHaveProperty('grey');
      expect(colors).toHaveProperty('semantic');
      expect(colors).toHaveProperty('status');
      expect(colors).toHaveProperty('risk');
      expect(colors).toHaveProperty('base');
    });
  });
});

// --- Spacing ---

describe('spacing', () => {
  it('SPACING_UNIT equals 4', () => {
    expect(SPACING_UNIT).toBe(4);
  });

  it('spacing has expected keys', () => {
    const expectedKeys = ['none', 'xxs', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl', 'xxxl', 'section', 'page'];
    for (const key of expectedKeys) {
      expect(spacing).toHaveProperty(key);
    }
  });

  it('spacing.none is 0', () => {
    expect(spacing.none).toBe(0);
  });

  it('spacing values increase', () => {
    expect(spacing.xs).toBeLessThan(spacing.sm);
    expect(spacing.sm).toBeLessThan(spacing.md);
    expect(spacing.md).toBeLessThan(spacing.lg);
  });

  it('componentSpacing has button, input, card, listItem, form, and screen', () => {
    expect(componentSpacing).toHaveProperty('button');
    expect(componentSpacing).toHaveProperty('input');
    expect(componentSpacing).toHaveProperty('card');
    expect(componentSpacing).toHaveProperty('listItem');
    expect(componentSpacing).toHaveProperty('form');
    expect(componentSpacing).toHaveProperty('screen');
  });

  it('componentSpacing.button has small, medium, and large', () => {
    expect(componentSpacing.button).toHaveProperty('small');
    expect(componentSpacing.button).toHaveProperty('medium');
    expect(componentSpacing.button).toHaveProperty('large');
  });
});

// --- Typography ---

describe('typography', () => {
  describe('fontSizes', () => {
    it('has 10 font sizes', () => {
      expect(Object.keys(fontSizes)).toHaveLength(10);
    });

    it('contains expected size keys', () => {
      const expected = ['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'];
      for (const key of expected) {
        expect(fontSizes).toHaveProperty(key);
      }
    });

    it('base font size is 16', () => {
      expect(fontSizes.base).toBe(16);
    });
  });

  describe('fontWeights', () => {
    it('has 4 font weights', () => {
      expect(Object.keys(fontWeights)).toHaveLength(4);
    });

    it('contains normal, medium, semibold, bold', () => {
      expect(fontWeights).toHaveProperty('normal');
      expect(fontWeights).toHaveProperty('medium');
      expect(fontWeights).toHaveProperty('semibold');
      expect(fontWeights).toHaveProperty('bold');
    });
  });

  describe('lineHeights', () => {
    it('has 5 line heights', () => {
      expect(Object.keys(lineHeights)).toHaveLength(5);
    });

    it('contains expected keys', () => {
      expect(lineHeights).toHaveProperty('none');
      expect(lineHeights).toHaveProperty('tight');
      expect(lineHeights).toHaveProperty('normal');
      expect(lineHeights).toHaveProperty('relaxed');
      expect(lineHeights).toHaveProperty('loose');
    });
  });

  describe('textStyles', () => {
    it('has heading styles', () => {
      expect(textStyles).toHaveProperty('heading1');
      expect(textStyles).toHaveProperty('heading2');
      expect(textStyles).toHaveProperty('heading3');
      expect(textStyles).toHaveProperty('heading4');
    });

    it('has body styles', () => {
      expect(textStyles).toHaveProperty('bodyLarge');
      expect(textStyles).toHaveProperty('body');
      expect(textStyles).toHaveProperty('bodySmall');
    });

    it('has label and UI element styles', () => {
      expect(textStyles).toHaveProperty('label');
      expect(textStyles).toHaveProperty('caption');
      expect(textStyles).toHaveProperty('button');
    });

    it('each text style has fontSize, fontWeight, lineHeight', () => {
      for (const [, style] of Object.entries(textStyles)) {
        expect(style).toHaveProperty('fontSize');
        expect(style).toHaveProperty('fontWeight');
        expect(style).toHaveProperty('lineHeight');
      }
    });
  });
});

// --- Borders ---

describe('borders', () => {
  describe('borderWidths', () => {
    it('has 5 border widths', () => {
      expect(Object.keys(borderWidths)).toHaveLength(5);
    });

    it('contains none, thin, normal, thick, heavy', () => {
      expect(borderWidths).toHaveProperty('none');
      expect(borderWidths).toHaveProperty('thin');
      expect(borderWidths).toHaveProperty('normal');
      expect(borderWidths).toHaveProperty('thick');
      expect(borderWidths).toHaveProperty('heavy');
    });

    it('none is 0', () => {
      expect(borderWidths.none).toBe(0);
    });
  });

  describe('borderRadius', () => {
    it('has 8 border radius values', () => {
      expect(Object.keys(borderRadius)).toHaveLength(8);
    });

    it('contains expected keys', () => {
      const expected = ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', 'full'];
      for (const key of expected) {
        expect(borderRadius).toHaveProperty(key);
      }
    });

    it('full is 9999 for pill shapes', () => {
      expect(borderRadius.full).toBe(9999);
    });
  });

  describe('shadows', () => {
    it('has 5 shadow levels', () => {
      expect(Object.keys(shadows)).toHaveLength(5);
    });

    it('contains none, sm, md, lg, xl', () => {
      expect(shadows).toHaveProperty('none');
      expect(shadows).toHaveProperty('sm');
      expect(shadows).toHaveProperty('md');
      expect(shadows).toHaveProperty('lg');
      expect(shadows).toHaveProperty('xl');
    });

    it('none is the string "none"', () => {
      expect(shadows.none).toBe('none');
    });

    it('sm shadow has expected structure', () => {
      expect(shadows.sm).toHaveProperty('shadowColor');
      expect(shadows.sm).toHaveProperty('shadowOffset');
      expect(shadows.sm).toHaveProperty('shadowOpacity');
      expect(shadows.sm).toHaveProperty('shadowRadius');
      expect(shadows.sm).toHaveProperty('elevation');
    });
  });
});
