# @stopfra/ui-core

**Shared UI Design System for Stop FRA Platform**

Provides a unified design token library and component type definitions for web (React/Vite) and mobile (React Native/Expo) applications. Single source of truth for colors, spacing, typography, borders, and component interfaces.

[![npm version](https://img.shields.io/npm/v/@stopfra/ui-core)](https://www.npmjs.com/package/@stopfra/ui-core)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9%2B-blue)](https://www.typescriptlang.org/)

## Features

- 🎨 **Design Tokens** - Centralized colors, spacing, typography, and borders
- 🔨 **Component Types** - Shared TypeScript interfaces for buttons, inputs, selections, and cards
- ♿ **Accessibility** - WCAG 2.1 AA compliant utilities and constants
- ⚙️ **Constants** - Animation durations, z-index layers, breakpoints, and more
- 📱 **Cross-Platform** - Works with both React and React Native
- 🔒 **Type-Safe** - Full TypeScript support with strict mode

## Installation

```bash
# npm
npm install @stopfra/ui-core

# yarn
yarn add @stopfra/ui-core

# pnpm
pnpm add @stopfra/ui-core
```

## Quick Start

### Import Design Tokens

```typescript
import {
  colors,
  spacing,
  fontSizes,
  borderRadius,
  shadows,
} from '@stopfra/ui-core/tokens';

// Use colors
const primaryColor = colors.primary;     // '#003078'
const highRiskRed = colors.risk.high;   // '#dc3545'

// Use spacing
const padding = spacing.lg;              // 16px
const margin = spacing.md;               // 12px

// Use typography
const fontSize = fontSizes.base;         // 16px
const fontWeight = fontWeights.bold;     // '700'

// Use borders
const radius = borderRadius.md;          // 6px
const shadow = shadows.md;               // Elevation shadow
```

### Import Component Types

```typescript
import {
  BUTTON_VARIANTS,
  BUTTON_SIZES,
  type ButtonVariant,
  type ButtonSize,
  type BaseButtonProps,
} from '@stopfra/ui-core/types';

import {
  INPUT_SIZES,
  INPUT_STATES,
  type BaseInputProps,
  type BaseTextAreaProps,
} from '@stopfra/ui-core/types';

import {
  SELECTION_SIZES,
  type BaseCheckboxProps,
  type BaseRadioOptionProps,
  type BaseToggleProps,
} from '@stopfra/ui-core/types';

import {
  CARD_VARIANTS,
  CARD_PADDING_SIZES,
  type BaseCardProps,
  type BaseMetricCardProps,
  type BaseStatusCardProps,
} from '@stopfra/ui-core/types';
```

### Use Accessibility Utilities

```typescript
import {
  getButtonAccessibilityLabel,
  getInputAccessibilityLabel,
  getInputAccessibilityHint,
  getCharacterCountLabel,
} from '@stopfra/ui-core/accessibility';

// Button labels
const btnLabel = getButtonAccessibilityLabel('Submit', { loading: true });
// Result: "Submit loading"

// Input labels with validation
const inputLabel = getInputAccessibilityLabel('Email', {
  required: true,
  error: 'Invalid email format',
});
// Result: "Email required invalid email format"

// Character count hints
const charHint = getCharacterCountLabel(45, 100);
// Result: "45 characters out of 100"
```

### Access Constants

```typescript
import {
  ANIMATION_DURATION,
  Z_INDEX,
  BREAKPOINTS,
  MIN_TOUCH_TARGET,
  OPACITY,
} from '@stopfra/ui-core/constants';

// Animation timings
const duration = ANIMATION_DURATION.normal;  // 250ms

// Z-index layers
const modal = Z_INDEX.modal;                 // 500
const dropdown = Z_INDEX.dropdown;           // 100

// Responsive breakpoints
const tabletBreakpoint = BREAKPOINTS.md;     // 768px

// Touch targets (WCAG 2.1 AA)
const minTouchSize = MIN_TOUCH_TARGET;       // 44px

// Opacity levels
const disabled = OPACITY.disabled;           // 0.5
```

---

## Design Tokens Reference

### Colors

**Government Colors (GOV.UK Design System)**
```typescript
govColors.blue     // '#003078' - Primary brand color
govColors.green    // '#00703c' - Success
govColors.red      // '#d4351c' - Error
govColors.orange   // '#f47738' - Warning
```

**Grey Scale (5 levels)**
```typescript
greyScale.grey1    // '#0b0c0c' - Darkest text
greyScale.grey3    // '#b1b4b6' - Borders, disabled
greyScale.grey5    // '#f8f9fa' - Lightest backgrounds
```

**Semantic Colors**
```typescript
semanticColors.success    // '#00703c'
semanticColors.warning    // '#f47738'
semanticColors.error      // '#d4351c'
semanticColors.info       // '#1d70b8'
```

**Status Colors (Assessment)**
```typescript
statusColors.notStarted    // '#6c757d'
statusColors.inProgress    // '#0066cc'
statusColors.completed     // '#28a745'
statusColors.pendingAction // '#ffa500'
statusColors.overdue       // '#dc3545'
```

**Risk Colors**
```typescript
riskColors.high      // '#dc3545' - High risk
riskColors.medium    // '#ff8c00' - Medium risk
riskColors.low       // '#198754' - Low risk
riskColors.critical  // '#7b0a0a' - Critical risk
```

### Spacing System

**4px Grid-Based**
```
none   = 0px
xxs    = 2px
xs     = 4px
sm     = 8px
md     = 12px
lg     = 16px
xl     = 20px
xxl    = 24px
xxxl   = 32px
section = 40px
page   = 48px
```

**Component-Specific**
```typescript
componentSpacing.button.small      // { vertical: 8, horizontal: 16 }
componentSpacing.input.padding     // 12px
componentSpacing.card.padding      // 16px
componentSpacing.form.fieldGap     // 24px
```

**Layout Gaps**
```typescript
gaps.tight      // 4px
gaps.small      // 8px
gaps.medium     // 12px
gaps.normal     // 16px
gaps.large      // 24px
gaps.spacious   // 32px
```

### Typography

**Font Sizes (Modular Scale)**
```
xs     = 12px    - Caption, helper text
sm     = 14px    - Small text, labels
base   = 16px    - Body text (default)
md     = 17px    - Large body text
lg     = 18px    - Lead text
xl     = 20px    - Subheading
2xl    = 24px    - Heading 3
3xl    = 28px    - Heading 2
4xl    = 32px    - Heading 1
5xl    = 40px    - Display
```

**Font Weights**
```typescript
fontWeights.normal    // 400 - Default text
fontWeights.medium    // 500 - Emphasis
fontWeights.semibold  // 600 - Labels, headings
fontWeights.bold      // 700 - Strong emphasis
```

**Line Heights**
```typescript
lineHeights.none      // 1   - Icons, tight
lineHeights.tight     // 1.2 - Headings
lineHeights.normal    // 1.4 - Body text
lineHeights.relaxed   // 1.5 - Comfortable reading
lineHeights.loose     // 1.75 - Large text blocks
```

**Pre-Composed Text Styles**
```typescript
textStyles.heading1           // 32px, bold, tight line height
textStyles.heading2           // 28px, bold, tight line height
textStyles.heading3           // 24px, semibold, tight line height
textStyles.body               // 16px, normal, normal line height
textStyles.bodySmall          // 14px, normal, normal line height
textStyles.label              // 16px, semibold, normal line height
textStyles.caption            // 12px, normal, normal line height
textStyles.button             // 16px, semibold, no line height
```

### Borders & Shadows

**Border Widths**
```typescript
borderWidths.none      // 0px
borderWidths.thin      // 1px - Subtle
borderWidths.normal    // 2px - Standard
borderWidths.thick     // 3px - Emphasis
borderWidths.heavy     // 4px - Heavy emphasis
```

**Border Radius**
```typescript
borderRadius.none      // 0px - Sharp
borderRadius.xs        // 2px
borderRadius.sm        // 4px - Standard
borderRadius.md        // 6px
borderRadius.lg        // 8px
borderRadius.xl        // 12px
borderRadius['2xl']    // 16px
borderRadius.full      // 9999px - Pill shape
```

**Shadows (Elevation Levels)**
```typescript
shadows.sm             // Small elevation
shadows.md             // Medium elevation
shadows.lg             // Large elevation
shadows.xl             // Extra large elevation
```

---

## Component Types Reference

### Button Types

**Variants**
```typescript
BUTTON_VARIANTS = [
  'primary',     // Main action button
  'secondary',   // Secondary action
  'outline',     // Border-only style
  'danger',      // Destructive action
  'success',     // Positive confirmation
  'ghost',       // Minimal style
  'link',        // Text link style
]
```

**Sizes**
```typescript
BUTTON_SIZES = ['small', 'medium', 'large']
```

**Props Interface**
```typescript
interface BaseButtonProps {
  variant?: ButtonVariant;      // Visual style
  size?: ButtonSize;            // Physical size
  disabled?: boolean;           // Disabled state
  loading?: boolean;            // Loading state
  fullWidth?: boolean;          // Full width button
  testID?: string;              // Testing attribute
}
```

**Size Padding**
```typescript
small:  { vertical: 8,  horizontal: 16 }
medium: { vertical: 12, horizontal: 20 }
large:  { vertical: 16, horizontal: 24 }
```

**Size Font**
```typescript
small:  14px
medium: 16px
large:  17px
```

### Input Types

**Sizes**
```typescript
INPUT_SIZES = ['small', 'medium', 'large']
```

**States**
```typescript
INPUT_STATES = ['default', 'focus', 'error', 'disabled', 'success']
```

**Props Interface**
```typescript
interface BaseInputProps {
  label?: string;      // Field label
  hint?: string;       // Helper text
  placeholder?: string; // Placeholder text
  disabled?: boolean;  // Disabled state
  required?: boolean;  // Required indicator
  error?: string;      // Error message
  size?: InputSize;    // Field size
  testID?: string;     // Testing attribute
}

interface BaseTextAreaProps extends BaseInputProps {
  numberOfLines?: number;  // Visible lines
  maxLength?: number;      // Character limit
  showCount?: boolean;     // Show character count
  minHeight?: number;      // Minimum height
}
```

### Selection Types

**Sizes**
```typescript
SELECTION_SIZES = ['small', 'medium', 'large']
```

**Props Interfaces**
```typescript
// Single option
interface BaseOptionProps<T = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

// Radio button
interface BaseRadioOptionProps extends BaseOptionProps {
  selected: boolean;
  size?: SelectionSize;
  testID?: string;
}

// Checkbox
interface BaseCheckboxProps {
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  description?: string;
  size?: SelectionSize;
  testID?: string;
}

// Toggle/Switch
interface BaseToggleProps {
  label?: string;
  value: boolean;
  disabled?: boolean;
  size?: SelectionSize;
  testID?: string;
}

// Question group (assessment forms)
interface BaseQuestionGroupProps<T = string> {
  question: string;
  hint?: string;
  options: BaseOptionProps<T>[];
  selected: T | T[] | null;
  multiple?: boolean;
  required?: boolean;
  error?: string;
  testID?: string;
}
```

### Card Types

**Variants**
```typescript
CARD_VARIANTS = ['default', 'outlined', 'elevated', 'flat']
```

**Padding Sizes**
```typescript
CARD_PADDING_SIZES = ['none', 'small', 'medium', 'large']
```

**Padding Values**
```typescript
none:   0px
small:  12px
medium: 16px
large:  24px
```

**Props Interfaces**
```typescript
// Base card
interface BaseCardProps {
  variant?: CardVariant;
  padding?: CardPaddingSize;
  interactive?: boolean;
  disabled?: boolean;
  testID?: string;
}

// Metric card (dashboard)
interface BaseMetricCardProps extends BaseCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string | number;
    label?: string;
  };
  icon?: string;
  status?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

// Status card (assessment)
interface BaseStatusCardProps extends BaseCardProps {
  title: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'pending_action' | 'overdue';
  progress?: number;
  lastUpdated?: string | Date;
  actionLabel?: string;
}
```

---

## Constants Reference

### Animation Durations
```typescript
ANIMATION_DURATION.instant   // 0ms   - Instant (no animation)
ANIMATION_DURATION.fast      // 150ms - Fast transitions
ANIMATION_DURATION.normal    // 250ms - Standard animation
ANIMATION_DURATION.slow      // 400ms - Slow transitions
ANIMATION_DURATION.verySlow  // 600ms - Very slow
```

### Z-Index Layers
```typescript
Z_INDEX.base        // 0    - Default layer
Z_INDEX.dropdown    // 100  - Dropdowns, popovers
Z_INDEX.sticky      // 200  - Sticky headers
Z_INDEX.fixed       // 300  - Fixed positioning
Z_INDEX.overlay     // 400  - Overlays, dimmed backgrounds
Z_INDEX.modal       // 500  - Modal dialogs
Z_INDEX.popover     // 600  - Popovers, tooltips
Z_INDEX.tooltip     // 700  - Tooltips
Z_INDEX.toast       // 800  - Toast notifications
Z_INDEX.max         // 9999 - Emergency fallback
```

### Opacity Levels
```typescript
OPACITY.full       // 1.0 - Fully opaque
OPACITY.high       // 0.87 - High opacity
OPACITY.medium     // 0.6 - Medium opacity
OPACITY.low        // 0.38 - Low opacity
OPACITY.disabled   // 0.5 - Disabled state
OPACITY.subtle     // 0.12 - Very subtle
OPACITY.none       // 0 - Fully transparent
```

### Responsive Breakpoints (px)
```typescript
BREAKPOINTS.xs      // 0px   - Extra small (default)
BREAKPOINTS.sm      // 576px - Small devices
BREAKPOINTS.md      // 768px - Medium/tablets
BREAKPOINTS.lg      // 992px - Large/desktops
BREAKPOINTS.xl      // 1200px - Extra large
BREAKPOINTS.xxl     // 1400px - XXL displays
```

### Touch Target Sizing
```typescript
MIN_TOUCH_TARGET    // 44px (WCAG 2.1 Level AA minimum)

HIT_SLOP.small      // 8px - Small touch target expansion
HIT_SLOP.medium     // 12px - Medium expansion
HIT_SLOP.large      // 16px - Large expansion
```

### Character Limits
```typescript
CHARACTER_LIMITS.short       // 50 - Short text (names)
CHARACTER_LIMITS.medium      // 200 - Medium text (descriptions)
CHARACTER_LIMITS.long        // 500 - Long text (content)
CHARACTER_LIMITS.textarea    // 2000 - TextArea maximum
CHARACTER_LIMITS.description // 5000 - Full descriptions
```

### Debounce Delays
```typescript
DEBOUNCE_DELAY.instant   // 0ms - No debounce
DEBOUNCE_DELAY.fast      // 100ms - Fast debounce
DEBOUNCE_DELAY.normal    // 300ms - Standard debounce
DEBOUNCE_DELAY.search    // 400ms - Search input debounce
DEBOUNCE_DELAY.slow      // 500ms - Slow debounce
```

---

## Usage Examples

### Web Component (React + Vite)
```typescript
import React from 'react';
import {
  colors,
  spacing,
  fontSizes,
  borderRadius,
  ANIMATION_DURATION,
} from '@stopfra/ui-core/tokens';
import {
  BUTTON_VARIANTS,
  type BaseButtonProps,
} from '@stopfra/ui-core/types';

interface ButtonProps extends BaseButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  disabled = false,
  children,
  onClick,
}) => {
  const variantColor = colors[variant] || colors.primary;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        backgroundColor: disabled ? colors.grey3 : variantColor,
        padding: `${spacing[size]?.vertical || 12}px ${spacing[size]?.horizontal || 16}px`,
        fontSize: fontSizes.base,
        borderRadius: borderRadius.sm,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: `all ${ANIMATION_DURATION.normal}ms ease-in-out`,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
};
```

### Mobile Component (React Native)
```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  colors,
  spacing,
  fontSizes,
  borderRadius,
} from '@stopfra/ui-core/tokens';
import { ANIMATION_DURATION } from '@stopfra/ui-core/constants';
import type { BaseButtonProps } from '@stopfra/ui-core/types';

interface ButtonProps extends BaseButtonProps {
  onPress: () => void;
  children: string;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  disabled = false,
  children,
  onPress,
}) => {
  const styles = StyleSheet.create({
    button: {
      backgroundColor: disabled ? colors.grey3 : colors[variant],
      paddingVertical: spacing[size]?.vertical || 12,
      paddingHorizontal: spacing[size]?.horizontal || 16,
      borderRadius: borderRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: disabled ? 0.5 : 1,
    },
    text: {
      fontSize: fontSizes.base,
      fontWeight: '600',
      color: colors.white,
    },
  });

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={styles.text}>{children}</Text>
    </TouchableOpacity>
  );
};
```

### Accessibility Implementation
```typescript
import {
  getButtonAccessibilityLabel,
  getInputAccessibilityLabel,
  getCharacterCountLabel,
} from '@stopfra/ui-core/accessibility';

// Button
<button
  aria-label={getButtonAccessibilityLabel('Submit', { loading: true })}
  disabled={isLoading}
>
  Submit
</button>

// Input
<input
  aria-label={getInputAccessibilityLabel('Email', { required: true })}
  aria-describedby="email-hint"
  required
/>
<small id="email-hint">
  {getInputAccessibilityLabel('Email', { hint: 'Enter your email address' })}
</small>

// Character count
<textarea 
  maxLength={CHARACTER_LIMITS.textarea}
  onChange={(e) => setCount(e.target.value.length)}
/>
<span aria-live="polite">
  {getCharacterCountLabel(count, CHARACTER_LIMITS.textarea)}
</span>
```

---

## Testing

Run the test suite:

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test -- --coverage

# Watch mode
pnpm test -- --watch
```

Test coverage includes:
- ✅ All token exports and values
- ✅ Color validity (hex format)
- ✅ Spacing consistency (4px grid)
- ✅ Typography scales
- ✅ Border and shadow definitions
- ✅ Component type exports
- ✅ Type union correctness
- ✅ Accessibility utility functions

---

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Watch mode
pnpm dev

# Clean build artifacts
pnpm clean
```

### Project Structure
```
packages/ui-core/
├── src/
│   ├── __tests__/
│   │   ├── accessibility.test.ts
│   │   ├── constants.test.ts
│   │   ├── tokens.test.ts
│   │   └── types.test.ts
│   ├── accessibility/
│   │   └── index.ts
│   ├── constants/
│   │   └── index.ts
│   ├── tokens/
│   │   ├── colors.ts
│   │   ├── spacing.ts
│   │   ├── typography.ts
│   │   ├── borders.ts
│   │   └── index.ts
│   ├── types/
│   │   ├── button.ts
│   │   ├── input.ts
│   │   ├── selection.ts
│   │   ├── card.ts
│   │   └── index.ts
│   └── index.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
└── README.md
```

---

## Contributing

### Adding New Tokens

1. Add to appropriate token file (colors, spacing, typography, borders)
2. Export from `src/tokens/index.ts`
3. Add TypeScript type definition
4. Add tests to verify validity
5. Update this README with examples

### Adding New Component Types

1. Create new file in `src/types/`
2. Define interfaces and constants
3. Export from `src/types/index.ts`
4. Add tests to verify exports
5. Document in this README

### Guidelines

- Follow existing naming conventions
- Include JSDoc comments for all exports
- Ensure accessibility compliance (WCAG 2.1 AA)
- Write tests for all new code
- Keep token values consistent with design system

---

## Accessibility

This package is designed to support accessible UI development:

- **Color Contrast** - All color combinations tested against WCAG AA standards
- **Touch Targets** - Minimum 44px recommended (WCAG 2.1 Level AA)
- **Keyboard Navigation** - Support for full keyboard interaction
- **Screen Readers** - A11y utilities for proper labeling
- **Focus Management** - Clear focus indicators via tokens

### WCAG Compliance

- ✅ WCAG 2.1 Level AA compliant colors
- ✅ Accessible touch target sizing
- ✅ Clear focus indicators
- ✅ Keyboard navigation support
- ✅ Screen reader friendly

---

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- React 18+
- React Native 0.81+
- Node.js 18+ for development

---

## Performance

- 📦 Tree-shakeable exports
- 🚀 Font optimization ready
- ⚡ Zero dependencies
- 💾 Minimal bundle size (~5KB gzipped)

---

## Related Packages

- [@stopfra/shared](../shared) - Utility functions, API service, logger
- [@stopfra/types](../types) - Shared type definitions for assessment, auth, and API

---

## License

MIT

## Support

For issues or questions:
- 🐛 [Report a bug](https://github.com/stopfra/start-fra/issues)
- 💬 [Start a discussion](https://github.com/stopfra/start-fra/discussions)
- 📧 [Contact the team](mailto:support@stopfra.example.com)

---

**Last Updated:** March 8, 2026  
**Version:** 1.0.0  
**Maintainer:** Stop FRA Team
