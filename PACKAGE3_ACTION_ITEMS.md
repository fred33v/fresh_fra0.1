# Package 3 Implementation Checklist & Action Items

**Date:** March 8, 2026  
**Focus:** Specific, actionable tasks to complete Package 3  
**Total Estimated Effort:** 36-40 hours

---

## ✅ Already Implemented

### Completed Modules
- [x] **Accessibility Module** - 6 utilities for A11y across platforms
- [x] **Constants Module** - 12+ constants for animations, z-index, spacing, etc.
- [x] **Package Configuration** - package.json with scripts and exports
- [x] **Module Exports** - Main index.ts with re-exports
- [x] **TypeScript Setup** - tsconfig.json configured
- [x] **Test Framework** - vitest.config.ts configured
- [x] **Linting** - eslint.config.js configured

---

## ❌ NOT YET IMPLEMENTED - DETAILED CHECKLIST

### PHASE 1: Design Tokens (Priority: CRITICAL)

#### [ ] 1.1 Token: Colors (src/tokens/colors.ts)
**Status:** Not started | **Effort:** 3 hours | **Lines:** 250

**What to implement:**
- [ ] `govColors` object with GOV.UK design palette
  - [ ] Include primary, accent, warning, error, success
- [ ] `greyScale` object with neutral colors (grey-1 to grey-9)
- [ ] `semanticColors` object
  - [ ] success (positive actions)
  - [ ] warning (caution actions)
  - [ ] error (destructive actions)
  - [ ] info (informational)
- [ ] `statusColors` object for UI states
  - [ ] active, inactive, disabled, pending
- [ ] `riskColors` object for risk scoring
  - [ ] high (red/danger)
  - [ ] medium (orange/warning)
  - [ ] low (green/success)
- [ ] `baseColors` for common usage
  - [ ] primary, secondary, background, surface, text, border
- [ ] Type definitions: ColorKey, GovColorKey, etc.
- [ ] Color validation (hex format consistency)

**Testing requirements:**
- [ ] All color values are valid hex or rgb
- [ ] No duplicate colors in same category
- [ ] Color contrast meets WCAG standards

**Code Example:**
```typescript
export const govColors = {
  blue: '#0b3e6f',        // GOV.UK brand blue
  darkBlue: '#003078',
  darkGrey: '#0b0c0c',
  midGrey: '#626a6d',
  lightGrey: '#f5f5f5',
  white: '#ffffff',
  red: '#d32f2f',         // Errors/danger
  green: '#00a341',       // Success
  orange: '#f47738',      // Warnings
} as const;
```

---

#### [ ] 1.2 Token: Spacing (src/tokens/spacing.ts)
**Status:** Not started | **Effort:** 2.5 hours | **Lines:** 180

**What to implement:**
- [ ] `SPACING_UNIT` constant = 4px (base unit)
- [ ] `spacing` object with scale
  - [ ] xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px, xxl: 48px
- [ ] `componentSpacing` for specific components
  - [ ] button: vertical, horizontal padding
  - [ ] input: vertical, horizontal padding
  - [ ] card: padding variations
- [ ] `gaps` for layout spacing
  - [ ] Column gaps (for flex layouts)
  - [ ] Row gaps (for grid/flex layouts)
- [ ] Type definitions: SpacingKey, GapKey

**Testing requirements:**
- [ ] All values are multiples of 4px
- [ ] No value conflicts
- [ ] Scales are consistent

**Code Example:**
```typescript
export const SPACING_UNIT = 4;

export const spacing = {
  xs: `${SPACING_UNIT}px`,      // 4px
  sm: `${SPACING_UNIT * 2}px`,  // 8px
  md: `${SPACING_UNIT * 4}px`,  // 16px
  lg: `${SPACING_UNIT * 6}px`,  // 24px
  xl: `${SPACING_UNIT * 8}px`,  // 32px
  xxl: `${SPACING_UNIT * 12}px`,// 48px
} as const;
```

---

#### [ ] 1.3 Token: Typography (src/tokens/typography.ts)
**Status:** Not started | **Effort:** 3 hours | **Lines:** 250

**What to implement:**
- [ ] `fontSizes` object with modular scale
  - [ ] xs: 12px, sm: 14px, base: 16px, md: 18px, lg: 20px, xl: 24px, xxl: 32px
- [ ] `fontWeights` object
  - [ ] light: 300, regular: 400, medium: 500, semibold: 600, bold: 700
- [ ] `lineHeights` object
  - [ ] tight: 1.2, normal: 1.5, loose: 1.75, relaxed: 2
- [ ] `letterSpacing` object
  - [ ] tight: -0.5px, normal: 0, wide: 0.5px
- [ ] `textStyles` precomposed objects
  - [ ] h1, h2, h3, body, caption, code
- [ ] Type definitions: FontSizeKey, FontWeightKey, etc.

**Testing requirements:**
- [ ] Font sizes follow modular scale pattern
- [ ] Line heights are appropriate for each size
- [ ] Text styles include all required properties
- [ ] Scale is consistent and readable

**Code Example:**
```typescript
export const fontSizes = {
  xs: '12px',
  sm: '14px',
  base: '16px',
  md: '18px',
  lg: '20px',
  xl: '24px',
  xxl: '32px',
} as const;

export const textStyles = {
  h1: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.tight,
  },
  body: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.normal,
  },
} as const;
```

---

#### [ ] 1.4 Token: Borders & Shadows (src/tokens/borders.ts)
**Status:** Not started | **Effort:** 3.5 hours | **Lines:** 180

**What to implement:**
- [ ] `borderWidths` object
  - [ ] thin: 1px, default: 2px, thick: 3px, extraThick: 4px
- [ ] `borderRadius` object
  - [ ] none: 0, sm: 4px, md: 8px, lg: 12px, full: 9999px
- [ ] `borderStyles` object/enum
  - [ ] solid, dashed, dotted
- [ ] `shadows` object with elevation levels
  - [ ] subtle: low elevation
  - [ ] elevation-1, elevation-2, elevation-3: progressive shadows
- [ ] Type definitions: BorderWidthKey, BorderRadiusKey, ShadowKey

**Testing requirements:**
- [ ] Border radius values are appropriate
- [ ] Shadow values create proper depth
- [ ] Border widths are consistent
- [ ] All styles compile correctly

**Code Example:**
```typescript
export const borderWidths = {
  thin: '1px',
  default: '2px',
  thick: '3px',
  extraThick: '4px',
} as const;

export const shadows = {
  subtle: '0 1px 2px rgba(0, 0, 0, 0.05)',
  'elevation-1': '0 2px 4px rgba(0, 0, 0, 0.1)',
  'elevation-2': '0 4px 8px rgba(0, 0, 0, 0.15)',
  'elevation-3': '0 8px 16px rgba(0, 0, 0, 0.2)',
} as const;
```

---

### PHASE 2: Component Types (Priority: HIGH)

#### [ ] 2.1 Type: Button (src/types/button.ts)
**Status:** Not started | **Effort:** 2 hours | **Lines:** 150

**What to implement:**
- [ ] `BUTTON_VARIANTS` const array
  - [ ] 'primary', 'secondary', 'destructive', 'ghost'
- [ ] `BUTTON_SIZES` const array
  - [ ] 'sm', 'md', 'lg'
- [ ] `BUTTON_VARIANT_COLORS` object
  - [ ] Map each variant to color/background
- [ ] `BUTTON_SIZE_PADDING` object
  - [ ] Padding per size
- [ ] `BUTTON_SIZE_FONT` object
  - [ ] Font size per size
- [ ] `ButtonVariant` type (union of variants)
- [ ] `ButtonSize` type (union of sizes)
- [ ] `BaseButtonProps` interface
  - [ ] label: string
  - [ ] variant: ButtonVariant
  - [ ] size: ButtonSize
  - [ ] loading?: boolean
  - [ ] disabled?: boolean
  - [ ] onPress?: () => void

**Testing requirements:**
- [ ] All variant/size combinations defined
- [ ] Colors match token definitions
- [ ] Type safety enforced

---

#### [ ] 2.2 Type: Input (src/types/input.ts)
**Status:** Not started | **Effort:** 2.5 hours | **Lines:** 160

**What to implement:**
- [ ] `INPUT_SIZES` const array: 'sm', 'md', 'lg'
- [ ] `INPUT_STATES` const array: 'default', 'focus', 'error', 'disabled'
- [ ] `INPUT_SIZE_PADDING` object
- [ ] `INPUT_SIZE_FONT` object
- [ ] `INPUT_STATE_BORDER` object (border per state)
- [ ] `InputSize` type
- [ ] `InputState` type
- [ ] `BaseInputProps` interface
  - [ ] value: string
  - [ ] onChangeText: (text: string) => void
  - [ ] placeholder?: string
  - [ ] label?: string
  - [ ] error?: string
  - [ ] disabled?: boolean
  - [ ] maxLength?: number
- [ ] `BaseTextAreaProps` interface (extends BaseInputProps)
  - [ ] numberOfLines?: number

---

#### [ ] 2.3 Type: Selection (src/types/selection.ts)
**Status:** Not started | **Effort:** 2.5 hours | **Lines:** 170

**What to implement:**
- [ ] `SELECTION_SIZES` const array: 'sm', 'md', 'lg'
- [ ] `SELECTION_SIZE_DIMENSIONS` object
- [ ] `SelectionSize` type
- [ ] `BaseOptionProps` interface
  - [ ] label: string
  - [ ] value: string | number
  - [ ] hint?: string
- [ ] `BaseRadioOptionProps` interface (for radio buttons)
- [ ] `BaseCheckboxProps` interface
  - [ ] value: boolean
  - [ ] onChangeValue: (value: boolean) => void
  - [ ] label: string
  - [ ] disabled?: boolean
- [ ] `BaseToggleProps` interface (for on/off switches)
- [ ] `BaseQuestionGroupProps` interface
  - [ ] question: string
  - [ ] options: BaseOptionProps[]
  - [ ] value: string | number
  - [ ] onChange: (value: string | number) => void

---

#### [ ] 2.4 Type: Card (src/types/card.ts)
**Status:** Not started | **Effort:** 3 hours | **Lines:** 170

**What to implement:**
- [ ] `CARD_VARIANTS` const array: 'elevated', 'outlined', 'filled'
- [ ] `CARD_PADDING_SIZES` const array: 'compact', 'normal', 'spacious'
- [ ] `CARD_PADDING_VALUES` object (padding per size)
- [ ] `CARD_BORDER_RADIUS` constant
- [ ] `CardVariant` type
- [ ] `CardPaddingSize` type
- [ ] `BaseCardProps` interface
  - [ ] children: React.ReactNode
  - [ ] variant: CardVariant
  - [ ] padding: CardPaddingSize
  - [ ] onPress?: () => void
  - [ ] testID?: string
- [ ] `BaseMetricCardProps` interface
  - [ ] value: string | number
  - [ ] label: string
  - [ ] unit?: string
  - [ ] trend?: 'up' | 'down' | 'stable'
- [ ] `BaseStatusCardProps` interface
  - [ ] status: 'active' | 'inactive'
  - [ ] title: string
  - [ ] description: string

---

### PHASE 3: Testing (Priority: HIGH)

#### [ ] 3.1 Test: Tokens (src/__tests__/tokens.test.ts)
**Status:** Not started | **Effort:** 2 hours | **Lines:** 150

**What to test:**
- [ ] All color exports exist
- [ ] All colors are valid hex values
- [ ] Spacing values are numeric and positive
- [ ] Typography scales follow modular pattern
- [ ] Border values are valid
- [ ] Shadow values are valid CSS
- [ ] No duplicate values within categories
- [ ] Type exports are correct

**Test Template:**
```typescript
import { describe, it, expect } from 'vitest';
import { colors, spacing, fontSizes, borderRadius, shadows } from '../tokens/index';

describe('Design Tokens', () => {
  it('should export all color objects', () => {
    expect(colors).toBeDefined();
    expect(spacing).toBeDefined();
  });

  it('should have valid color hex values', () => {
    Object.values(colors).forEach(color => {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  it('spacing values should be valid', () => {
    Object.values(spacing).forEach(value => {
      expect(value).toMatch(/^\d+px$/);
    });
  });
});
```

---

#### [ ] 3.2 Test: Types (src/__tests__/types.test.ts)
**Status:** Not started | **Effort:** 3 hours | **Lines:** 200

**What to test:**
- [ ] All button variants are defined
- [ ] All button sizes are defined
- [ ] All input states are defined
- [ ] Selection size variants work
- [ ] Card variants are consistent
- [ ] Color maps match variants
- [ ] Interface fields are complete
- [ ] Type safety enforced

**Test areas:**
```typescript
describe('Component Types', () => {
  it('should have all button variants', () => {
    const variants = BUTTON_VARIANTS;
    expect(variants).toContain('primary');
    expect(variants).toContain('secondary');
  });

  it('should have color definitions for each variant', () => {
    BUTTON_VARIANTS.forEach(variant => {
      expect(BUTTON_VARIANT_COLORS[variant]).toBeDefined();
    });
  });
});
```

---

#### [ ] 3.3 Test: Constants (src/__tests__/constants.test.ts)
**Status:** Not started | **Effort:** 1.5 hours | **Lines:** 100

**What to test:**
- [ ] All constants are exported
- [ ] Z-index values are in ascending order
- [ ] Animation durations are positive numbers
- [ ] Breakpoints are in ascending order
- [ ] Hit slop values are valid
- [ ] No conflicting values between constants
- [ ] Touch target size meets WCAG 2.1 AA (44px minimum)

---

#### [ ] 3.4 Test: Accessibility (src/__tests__/accessibility.test.ts)
**Status:** Not started | **Effort:** 1.5 hours | **Lines:** 100

**What to test:**
- [ ] getButtonAccessibilityLabel produces formatted strings
- [ ] getInputAccessibilityLabel includes required, error, hint
- [ ] getInputAccessibilityHint includes character limits
- [ ] getCharacterCountLabel formats correctly
- [ ] getProgressAccessibilityLabel formats with percentage

---

### PHASE 4: Documentation (Priority: MEDIUM)

#### [ ] 4.1 Documentation: README.md
**Status:** Not started | **Effort:** 4 hours | **Lines:** 800-1000

**Sections required:**

1. **Overview** (50 lines)
   - What is @stopfra/ui-core
   - Why it exists (single source of truth)
   - What it provides

2. **Installation** (30 lines)
   ```bash
   cd packages/ui-core
   pnpm install
   pnpm build
   ```

3. **Design Tokens** (200 lines)
   - Colors guide with examples
   - Spacing system explanation (4px grid)
   - Typography scales
   - Border and shadow usage
   - Code examples for each

4. **Component Types** (200 lines)
   - Button types and variants
   - Input field types
   - Selection component types
   - Card component types
   - Code examples for web and mobile

5. **Accessibility** (100 lines)
   - Utility functions
   - WCAG compliance
   - Touch targets
   - Keyboard navigation
   - Screen reader support

6. **Constants Reference** (80 lines)
   - Animation durations
   - Z-index layers
   - Responsive breakpoints
   - Opacity & opacity values
   - Character limits

7. **Usage Examples** (100 lines)
   ```typescript
   // Web component example
   // Mobile component example
   // Accessibility implementation
   // Responsive design
   ```

8. **Contributing** (50 lines)
   - Adding new tokens
   - Adding new component types
   - Testing requirements
   - Code style

9. **API Reference** (200 lines)
   - Complete export listing
   - Type definitions
   - Constant values table

---

#### [ ] 4.2 File: .gitignore
**Status:** Not started | **Effort:** 0.5 hours | **Lines:** 30

**Content required:**
```
node_modules/
dist/
build/
coverage/
*.log
.vscode/
.idea/
.env
.DS_Store
```

---

#### [ ] 4.3 Update: package.json metadata
**Status:** Not started | **Effort:** 1 hour | **Lines:** Updates

**Updates needed:**
- [ ] Verify description is accurate
- [ ] Add repository field
- [ ] Add bugs field
- [ ] Add homepage field
- [ ] Verify keywords
- [ ] Check license

---

## 🔍 Verification Checklist

Before marking Phase complete, verify:

### Phase 1 Verification (Design Tokens)
- [ ] `pnpm build` compiles without errors
- [ ] `pnpm typecheck` passes
- [ ] All imports in index.ts resolve
- [ ] No circular dependencies
- [ ] All exported types are correct
- [ ] Color values pass WCAG contrast tests (sample check)
- [ ] Spacing values are consistent (multiples of 4px)
- [ ] Typography scale is readable at all sizes

### Phase 2 Verification (Component Types)
- [ ] `pnpm build` compiles without errors
- [ ] All type definitions are exported
- [ ] No type conflicts or collisions
- [ ] Variants are exhaustive unions
- [ ] Sizes are consistent across components
- [ ] No required fields conflict between types
- [ ] Examples compile and type-check correctly

### Phase 3 Verification (Tests)
- [ ] `pnpm test` runs without errors
- [ ] All test files pass
- [ ] Coverage report shows 80%+
- [ ] No skipped or pending tests
- [ ] Test assertions are meaningful
- [ ] Test file names match source file names

### Phase 4 Verification (Documentation)
- [ ] README is complete and accurate
- [ ] Code examples are correct and compile
- [ ] All sections are present
- [ ] Links work (if any)
- [ ] API documentation is exhaustive
- [ ] Examples cover common use cases
- [ ] Accessibility section is complete

### Final Verification (Production Ready)
- [ ] `pnpm lint` passes with no warnings
- [ ] `pnpm typecheck` passes on strict mode
- [ ] `pnpm test` all pass with 80%+ coverage
- [ ] `pnpm build` produces valid dist/ output
- [ ] Package can be imported in fra-web-dashboard
- [ ] Package can be imported in mobile apps
- [ ] No console warnings or errors
- [ ] Ready for npm publishing

---

## Dependency Check

**Before starting, verify you have:**
- [ ] Node.js 18+ installed
- [ ] pnpm 8+ installed
- [ ] TypeScript 5.9.2
- [ ] Vitest 4.0.18
- [ ] ESLint 9.32.0

**Test with:**
```bash
node --version      # v18+
pnpm --version     # 8+
npm ls typescript  # 5.9.2
npm ls vitest      # 4.0.18
```

---

## Recommended Work Sessions

### Session 1: Colors Token (Day 1, 3 hours)
1. Implement govColors object
2. Implement greyScale
3. Implement semanticColors and statusColors
4. Add riskColors
5. Export types
6. Test with `pnpm build`

### Session 2: Spacing & Typography (Day 1-2, 5 hours)
1. Implement spacing with 4px grid
2. Implement typography scales
3. Create text styles compositions
4. Verify scales with `pnpm typecheck`

### Session 3: Borders & Shadows (Day 2, 3.5 hours)
1. Implement border widths and radius
2. Implement shadow elevations
3. Verify exports
4. Run `pnpm test` for Phase 1 tokens

### Session 4: Component Types (Day 3-4, 9.5 hours)
1. Button types (2 hours)
2. Input types (2.5 hours)
3. Selection types (2.5 hours)
4. Card types (2.5 hours)
5. Verify with `pnpm typecheck`

### Session 5: Testing (Day 4-5, 8 hours)
1. Tokens tests (2 hours)
2. Types tests (3 hours)
3. Constants tests (1.5 hours)
4. Accessibility tests (1.5 hours)
5. Achieve 80%+ coverage

### Session 6: Documentation & Finalization (Day 5-6, 6 hours)
1. Write comprehensive README (4 hours)
2. Create .gitignore (0.5 hours)
3. Update package.json (1 hour)
4. Final verification (0.5 hours)

**Total Ideal Timeline: 5-6 days of focused work**

---

## Common Pitfalls to Avoid

❌ **Don't:**
- Hardcode color values in components (use tokens)
- Use arbitrary padding values (use spacing system)
- Mix px and rem units
- Create duplicate token definitions
- Skip tests (they catch real issues)
- Export unnamed types or enums

✅ **Do:**
- Use consistent 4px grid for spacing
- Validate all colors meet WCAG contrast
- Test on both web and mobile
- Document every exported type
- Create reusable type combinations
- Provide clear usage examples

---

## Success Metrics

After completion, you should be able to:

- [ ] Import colors: `import { colors, riskColors } from '@stopfra/ui-core/tokens'`
- [ ] Import types: `import { ButtonVariant, BaseButtonProps } from '@stopfra/ui-core/types'`
- [ ] Import a11y: `import { getButtonAccessibilityLabel } from '@stopfra/ui-core/accessibility'`
- [ ] Import constants: `import { ANIMATION_DURATION, Z_INDEX } from '@stopfra/ui-core/constants'`
- [ ] Use in Web Dashboard (React/Tailwind)
- [ ] Use in Mobile Apps (React Native/StyleSheet)
- [ ] 80%+ test coverage
- [ ] Zero TypeScript errors in strict mode
- [ ] Zero ESLint warnings
- [ ] Production-ready npm package

---

**Prepared for execution:** Ready to implement Phase 1 immediately upon approval
