import { describe, it, expect } from 'vitest';
import {
  BUTTON_VARIANTS,
  BUTTON_SIZES,
  BUTTON_VARIANT_COLORS,
} from '../types/button.js';
import { INPUT_SIZES, INPUT_STATES } from '../types/input.js';
import { SELECTION_SIZES } from '../types/selection.js';
import { CARD_VARIANTS, CARD_PADDING_SIZES } from '../types/card.js';

// --- Button ---

describe('Button types', () => {
  describe('BUTTON_VARIANTS', () => {
    it('has 7 variants', () => {
      expect(BUTTON_VARIANTS).toHaveLength(7);
    });

    it('contains expected variants', () => {
      expect(BUTTON_VARIANTS).toContain('primary');
      expect(BUTTON_VARIANTS).toContain('secondary');
      expect(BUTTON_VARIANTS).toContain('outline');
      expect(BUTTON_VARIANTS).toContain('danger');
      expect(BUTTON_VARIANTS).toContain('success');
      expect(BUTTON_VARIANTS).toContain('ghost');
      expect(BUTTON_VARIANTS).toContain('link');
    });
  });

  describe('BUTTON_SIZES', () => {
    it('has 3 sizes', () => {
      expect(BUTTON_SIZES).toHaveLength(3);
    });

    it('contains small, medium, large', () => {
      expect(BUTTON_SIZES).toContain('small');
      expect(BUTTON_SIZES).toContain('medium');
      expect(BUTTON_SIZES).toContain('large');
    });
  });

  describe('BUTTON_VARIANT_COLORS', () => {
    it('has an entry for each variant', () => {
      for (const variant of BUTTON_VARIANTS) {
        expect(BUTTON_VARIANT_COLORS).toHaveProperty(variant);
      }
    });

    it('each entry has background, text, and border', () => {
      for (const variant of BUTTON_VARIANTS) {
        const entry = BUTTON_VARIANT_COLORS[variant];
        expect(entry).toHaveProperty('background');
        expect(entry).toHaveProperty('text');
        expect(entry).toHaveProperty('border');
      }
    });
  });
});

// --- Input ---

describe('Input types', () => {
  describe('INPUT_SIZES', () => {
    it('has 3 sizes', () => {
      expect(INPUT_SIZES).toHaveLength(3);
    });

    it('contains small, medium, large', () => {
      expect(INPUT_SIZES).toContain('small');
      expect(INPUT_SIZES).toContain('medium');
      expect(INPUT_SIZES).toContain('large');
    });
  });

  describe('INPUT_STATES', () => {
    it('has 5 states', () => {
      expect(INPUT_STATES).toHaveLength(5);
    });

    it('contains expected states', () => {
      expect(INPUT_STATES).toContain('default');
      expect(INPUT_STATES).toContain('focus');
      expect(INPUT_STATES).toContain('error');
      expect(INPUT_STATES).toContain('disabled');
      expect(INPUT_STATES).toContain('success');
    });
  });
});

// --- Selection ---

describe('Selection types', () => {
  describe('SELECTION_SIZES', () => {
    it('has 3 sizes', () => {
      expect(SELECTION_SIZES).toHaveLength(3);
    });

    it('contains small, medium, large', () => {
      expect(SELECTION_SIZES).toContain('small');
      expect(SELECTION_SIZES).toContain('medium');
      expect(SELECTION_SIZES).toContain('large');
    });
  });
});

// --- Card ---

describe('Card types', () => {
  describe('CARD_VARIANTS', () => {
    it('has 4 variants', () => {
      expect(CARD_VARIANTS).toHaveLength(4);
    });

    it('contains expected variants', () => {
      expect(CARD_VARIANTS).toContain('default');
      expect(CARD_VARIANTS).toContain('outlined');
      expect(CARD_VARIANTS).toContain('elevated');
      expect(CARD_VARIANTS).toContain('flat');
    });
  });

  describe('CARD_PADDING_SIZES', () => {
    it('has 4 padding sizes', () => {
      expect(CARD_PADDING_SIZES).toHaveLength(4);
    });

    it('contains expected padding sizes', () => {
      expect(CARD_PADDING_SIZES).toContain('none');
      expect(CARD_PADDING_SIZES).toContain('small');
      expect(CARD_PADDING_SIZES).toContain('medium');
      expect(CARD_PADDING_SIZES).toContain('large');
    });
  });
});
