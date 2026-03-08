import { describe, it, expect } from 'vitest';
import {
  ANIMATION_DURATION,
  Z_INDEX,
  OPACITY,
  HIT_SLOP,
  MIN_TOUCH_TARGET,
  BREAKPOINTS,
  MAX_CONTENT_WIDTH,
  ICON_SIZES,
  CHARACTER_LIMITS,
  DEBOUNCE_DELAY,
} from '../constants/index.js';

// --- ANIMATION_DURATION ---

describe('ANIMATION_DURATION', () => {
  it('has instant, fast, normal, slow, verySlow', () => {
    expect(ANIMATION_DURATION).toHaveProperty('instant');
    expect(ANIMATION_DURATION).toHaveProperty('fast');
    expect(ANIMATION_DURATION).toHaveProperty('normal');
    expect(ANIMATION_DURATION).toHaveProperty('slow');
    expect(ANIMATION_DURATION).toHaveProperty('verySlow');
  });

  it('instant is 0', () => {
    expect(ANIMATION_DURATION.instant).toBe(0);
  });

  it('values increase from fast to verySlow', () => {
    expect(ANIMATION_DURATION.fast).toBeLessThan(ANIMATION_DURATION.normal);
    expect(ANIMATION_DURATION.normal).toBeLessThan(ANIMATION_DURATION.slow);
    expect(ANIMATION_DURATION.slow).toBeLessThan(ANIMATION_DURATION.verySlow);
  });
});

// --- Z_INDEX ---

describe('Z_INDEX', () => {
  it('has base, dropdown, sticky, fixed, overlay, modal, popover, tooltip, toast, max', () => {
    expect(Z_INDEX).toHaveProperty('base');
    expect(Z_INDEX).toHaveProperty('dropdown');
    expect(Z_INDEX).toHaveProperty('sticky');
    expect(Z_INDEX).toHaveProperty('fixed');
    expect(Z_INDEX).toHaveProperty('overlay');
    expect(Z_INDEX).toHaveProperty('modal');
    expect(Z_INDEX).toHaveProperty('popover');
    expect(Z_INDEX).toHaveProperty('tooltip');
    expect(Z_INDEX).toHaveProperty('toast');
    expect(Z_INDEX).toHaveProperty('max');
  });

  it('base is 0', () => {
    expect(Z_INDEX.base).toBe(0);
  });

  it('max is 9999', () => {
    expect(Z_INDEX.max).toBe(9999);
  });

  it('layers increase in order', () => {
    expect(Z_INDEX.base).toBeLessThan(Z_INDEX.dropdown);
    expect(Z_INDEX.dropdown).toBeLessThan(Z_INDEX.sticky);
    expect(Z_INDEX.sticky).toBeLessThan(Z_INDEX.fixed);
    expect(Z_INDEX.fixed).toBeLessThan(Z_INDEX.overlay);
    expect(Z_INDEX.overlay).toBeLessThan(Z_INDEX.modal);
    expect(Z_INDEX.modal).toBeLessThan(Z_INDEX.popover);
    expect(Z_INDEX.popover).toBeLessThan(Z_INDEX.tooltip);
    expect(Z_INDEX.tooltip).toBeLessThan(Z_INDEX.toast);
  });
});

// --- OPACITY ---

describe('OPACITY', () => {
  it('has full, high, medium, low, disabled, subtle, none', () => {
    expect(OPACITY).toHaveProperty('full');
    expect(OPACITY).toHaveProperty('high');
    expect(OPACITY).toHaveProperty('medium');
    expect(OPACITY).toHaveProperty('low');
    expect(OPACITY).toHaveProperty('disabled');
    expect(OPACITY).toHaveProperty('subtle');
    expect(OPACITY).toHaveProperty('none');
  });

  it('full is 1', () => {
    expect(OPACITY.full).toBe(1);
  });

  it('none is 0', () => {
    expect(OPACITY.none).toBe(0);
  });

  it('all values are between 0 and 1', () => {
    for (const value of Object.values(OPACITY)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

// --- HIT_SLOP ---

describe('HIT_SLOP', () => {
  it('has small, medium, large', () => {
    expect(HIT_SLOP).toHaveProperty('small');
    expect(HIT_SLOP).toHaveProperty('medium');
    expect(HIT_SLOP).toHaveProperty('large');
  });

  it('each size has top, right, bottom, left', () => {
    for (const size of ['small', 'medium', 'large'] as const) {
      expect(HIT_SLOP[size]).toHaveProperty('top');
      expect(HIT_SLOP[size]).toHaveProperty('right');
      expect(HIT_SLOP[size]).toHaveProperty('bottom');
      expect(HIT_SLOP[size]).toHaveProperty('left');
    }
  });

  it('small has all values equal to 8', () => {
    expect(HIT_SLOP.small).toEqual({ top: 8, right: 8, bottom: 8, left: 8 });
  });
});

// --- MIN_TOUCH_TARGET ---

describe('MIN_TOUCH_TARGET', () => {
  it('equals 44', () => {
    expect(MIN_TOUCH_TARGET).toBe(44);
  });
});

// --- BREAKPOINTS ---

describe('BREAKPOINTS', () => {
  it('has xs, sm, md, lg, xl, xxl', () => {
    expect(BREAKPOINTS).toHaveProperty('xs');
    expect(BREAKPOINTS).toHaveProperty('sm');
    expect(BREAKPOINTS).toHaveProperty('md');
    expect(BREAKPOINTS).toHaveProperty('lg');
    expect(BREAKPOINTS).toHaveProperty('xl');
    expect(BREAKPOINTS).toHaveProperty('xxl');
  });

  it('xs starts at 0', () => {
    expect(BREAKPOINTS.xs).toBe(0);
  });

  it('breakpoints increase in order', () => {
    expect(BREAKPOINTS.xs).toBeLessThan(BREAKPOINTS.sm);
    expect(BREAKPOINTS.sm).toBeLessThan(BREAKPOINTS.md);
    expect(BREAKPOINTS.md).toBeLessThan(BREAKPOINTS.lg);
    expect(BREAKPOINTS.lg).toBeLessThan(BREAKPOINTS.xl);
    expect(BREAKPOINTS.xl).toBeLessThan(BREAKPOINTS.xxl);
  });
});

// --- MAX_CONTENT_WIDTH ---

describe('MAX_CONTENT_WIDTH', () => {
  it('has narrow, medium, wide, full', () => {
    expect(MAX_CONTENT_WIDTH).toHaveProperty('narrow');
    expect(MAX_CONTENT_WIDTH).toHaveProperty('medium');
    expect(MAX_CONTENT_WIDTH).toHaveProperty('wide');
    expect(MAX_CONTENT_WIDTH).toHaveProperty('full');
  });

  it('widths increase in order', () => {
    expect(MAX_CONTENT_WIDTH.narrow).toBeLessThan(MAX_CONTENT_WIDTH.medium);
    expect(MAX_CONTENT_WIDTH.medium).toBeLessThan(MAX_CONTENT_WIDTH.wide);
    expect(MAX_CONTENT_WIDTH.wide).toBeLessThan(MAX_CONTENT_WIDTH.full);
  });
});

// --- ICON_SIZES ---

describe('ICON_SIZES', () => {
  it('has xs through xxl', () => {
    expect(ICON_SIZES).toHaveProperty('xs');
    expect(ICON_SIZES).toHaveProperty('sm');
    expect(ICON_SIZES).toHaveProperty('md');
    expect(ICON_SIZES).toHaveProperty('lg');
    expect(ICON_SIZES).toHaveProperty('xl');
    expect(ICON_SIZES).toHaveProperty('xxl');
  });

  it('sizes increase in order', () => {
    expect(ICON_SIZES.xs).toBeLessThan(ICON_SIZES.sm);
    expect(ICON_SIZES.sm).toBeLessThan(ICON_SIZES.md);
    expect(ICON_SIZES.md).toBeLessThan(ICON_SIZES.lg);
    expect(ICON_SIZES.lg).toBeLessThan(ICON_SIZES.xl);
    expect(ICON_SIZES.xl).toBeLessThan(ICON_SIZES.xxl);
  });
});

// --- CHARACTER_LIMITS ---

describe('CHARACTER_LIMITS', () => {
  it('has short, medium, long, textarea, description', () => {
    expect(CHARACTER_LIMITS).toHaveProperty('short');
    expect(CHARACTER_LIMITS).toHaveProperty('medium');
    expect(CHARACTER_LIMITS).toHaveProperty('long');
    expect(CHARACTER_LIMITS).toHaveProperty('textarea');
    expect(CHARACTER_LIMITS).toHaveProperty('description');
  });

  it('limits increase in order', () => {
    expect(CHARACTER_LIMITS.short).toBeLessThan(CHARACTER_LIMITS.medium);
    expect(CHARACTER_LIMITS.medium).toBeLessThan(CHARACTER_LIMITS.long);
    expect(CHARACTER_LIMITS.long).toBeLessThan(CHARACTER_LIMITS.textarea);
    expect(CHARACTER_LIMITS.textarea).toBeLessThan(CHARACTER_LIMITS.description);
  });
});

// --- DEBOUNCE_DELAY ---

describe('DEBOUNCE_DELAY', () => {
  it('has instant, fast, normal, slow, search', () => {
    expect(DEBOUNCE_DELAY).toHaveProperty('instant');
    expect(DEBOUNCE_DELAY).toHaveProperty('fast');
    expect(DEBOUNCE_DELAY).toHaveProperty('normal');
    expect(DEBOUNCE_DELAY).toHaveProperty('slow');
    expect(DEBOUNCE_DELAY).toHaveProperty('search');
  });

  it('instant is 0', () => {
    expect(DEBOUNCE_DELAY.instant).toBe(0);
  });

  it('fast is less than normal', () => {
    expect(DEBOUNCE_DELAY.fast).toBeLessThan(DEBOUNCE_DELAY.normal);
  });
});
