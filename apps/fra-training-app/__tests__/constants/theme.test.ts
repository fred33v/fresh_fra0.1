import { colors, darkColors, spacing, borderRadius, typography, shadows } from '@/constants/theme';

describe('Theme', () => {
  describe('colors', () => {
    it('has all required color keys', () => {
      expect(colors.primary).toBeDefined();
      expect(colors.text).toBeDefined();
      expect(colors.background).toBeDefined();
      expect(colors.surface).toBeDefined();
      expect(colors.success).toBeDefined();
      expect(colors.warning).toBeDefined();
      expect(colors.danger).toBeDefined();
    });

    it('all values are valid hex colors', () => {
      const hexRegex = /^#([0-9a-fA-F]{3,8})$/;
      Object.entries(colors).forEach(([key, value]) => {
        expect(value).toMatch(hexRegex);
      });
    });

    it('is non-empty', () => {
      expect(Object.keys(colors).length).toBeGreaterThan(0);
    });
  });

  describe('darkColors', () => {
    it('has the same keys as light colors', () => {
      const lightKeys = Object.keys(colors).sort();
      const darkKeys = Object.keys(darkColors).sort();
      expect(darkKeys).toEqual(lightKeys);
    });

    it('has different values from light mode', () => {
      expect(darkColors.background).not.toEqual(colors.background);
      expect(darkColors.text).not.toEqual(colors.text);
      expect(darkColors.surface).not.toEqual(colors.surface);
    });
  });

  describe('spacing', () => {
    it('has increasing values', () => {
      expect(spacing.xs).toBeLessThan(spacing.sm);
      expect(spacing.sm).toBeLessThan(spacing.md);
      expect(spacing.md).toBeLessThan(spacing.lg);
      expect(spacing.lg).toBeLessThan(spacing.xl);
    });

    it('is non-empty', () => {
      expect(Object.keys(spacing).length).toBeGreaterThan(0);
    });
  });

  describe('borderRadius', () => {
    it('has all expected sizes', () => {
      expect(borderRadius.sm).toBeDefined();
      expect(borderRadius.md).toBeDefined();
      expect(borderRadius.lg).toBeDefined();
      expect(borderRadius.full).toBe(9999);
    });

    it('is non-empty', () => {
      expect(Object.keys(borderRadius).length).toBeGreaterThan(0);
    });
  });

  describe('typography', () => {
    it('h1 is larger than body', () => {
      expect(typography.h1.fontSize).toBeGreaterThan(typography.body.fontSize);
    });
  });

  describe('shadows', () => {
    it('has sm, md, lg variants', () => {
      expect(shadows.sm).toBeDefined();
      expect(shadows.md).toBeDefined();
      expect(shadows.lg).toBeDefined();
    });

    it('is non-empty', () => {
      expect(Object.keys(shadows).length).toBeGreaterThan(0);
    });

    it('lg has larger elevation than sm', () => {
      expect(shadows.lg.elevation).toBeGreaterThan(shadows.sm.elevation);
    });
  });
});
