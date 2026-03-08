# Testing Setup for Stop FRA

## Overview

The Stop FRA project now has a complete Jest testing environment configured for React Native with Expo. This document explains the setup and how to write tests.

## Configuration Files

### 1. jest.config.js
Main Jest configuration file that specifies:
- Uses `react-native` preset
- Configures Babel transforms for TypeScript and JSX
- Sets up module name mappers for path aliases
- Configures test environment as `jsdom`
- Excludes certain patterns from transforms

### 2. babel.config.js
Babel configuration for transpiling code:
- Uses `babel-preset-expo` for React Native/Expo support
- Special `test` environment with additional presets:
  - `@babel/preset-env` for modern JavaScript
  - `@babel/preset-react` for JSX with automatic runtime
  - `@babel/preset-typescript` for TypeScript support

### 3. jest.setup.js
Setup file that runs before tests:
- Mocks Expo Router functions
- Mocks AsyncStorage
- Suppresses common React Native console warnings

### 4. jest.polyfills.js
Polyfills for browser/React Native APIs:
- Mocks `requestAnimationFrame` and `cancelAnimationFrame`
- Provides `performance.now()` implementation
- Mocks `IntersectionObserver`

### 5. __mocks__/
Directory containing asset mocks:
- `svgMock.js` - Mocks SVG imports
- `fileMock.js` - Mocks image file imports

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Writing Tests

### Basic Test Structure

Place test files in the `__tests__/` directory or name them with `.test.ts` or `.spec.ts` suffix:

```typescript
describe('Feature Name', () => {
  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = input.toUpperCase();

    // Assert
    expect(result).toBe('TEST');
  });
});
```

### Testing React Components

For React Native components (when you're ready to test UI):

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import MyComponent from '../app/MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    // Add assertions
  });
});
```

### Testing Context Providers

```typescript
import { renderHook } from '@testing-library/react-native';
import { AuthContext } from '../contexts/AuthContext';

describe('AuthContext', () => {
  it('should provide auth state', () => {
    const wrapper = ({ children }) => (
      <AuthContext.Provider value={{ user: null }}>
        {children}
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useContext(AuthContext), { wrapper });
    expect(result.current.user).toBeNull();
  });
});
```

### Testing Async Functions

```typescript
describe('Async Operations', () => {
  it('should handle async operations', async () => {
    const result = await fetchData();
    expect(result).toBeDefined();
  });
});
```

### Mocking Modules

```typescript
// Mock a module
jest.mock('../utils/api', () => ({
  fetchData: jest.fn(() => Promise.resolve({ data: 'test' })),
}));

// Mock a specific function
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
```

## Available Matchers

Jest provides many built-in matchers:

```typescript
// Equality
expect(value).toBe(expected);           // Strict equality (===)
expect(value).toEqual(expected);        // Deep equality

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Numbers
expect(value).toBeGreaterThan(3);
expect(value).toBeGreaterThanOrEqual(3.5);
expect(value).toBeLessThan(5);
expect(value).toBeCloseTo(0.3);         // Floating point

// Strings
expect(string).toMatch(/pattern/);
expect(string).toContain('substring');

// Arrays
expect(array).toContain(item);
expect(array).toHaveLength(3);

// Objects
expect(object).toHaveProperty('key');
expect(object).toMatchObject({ key: 'value' });

// Exceptions
expect(() => fn()).toThrow();
expect(() => fn()).toThrow(Error);
expect(() => fn()).toThrow('error message');

// Promises
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();
```

## Test Organization

Recommended folder structure:

```
fraud-risk-app-main/
├── __tests__/               # Test files
│   ├── components/          # Component tests
│   ├── contexts/            # Context tests
│   ├── utils/               # Utility function tests
│   └── integration/         # Integration tests
├── __mocks__/               # Mock files
├── app/                     # Source code
├── jest.config.js
├── jest.setup.js
└── jest.polyfills.js
```

## Testing Best Practices

1. **Follow AAA Pattern**: Arrange, Act, Assert
2. **One Assertion Per Test**: Keep tests focused
3. **Descriptive Test Names**: Use "should" statements
4. **Test Behavior, Not Implementation**: Focus on what, not how
5. **Keep Tests Independent**: No shared state between tests
6. **Mock External Dependencies**: Isolate units under test
7. **Test Edge Cases**: Empty arrays, null values, errors
8. **Use beforeEach/afterEach**: Setup and cleanup

## Common Testing Scenarios

### Risk Scoring Logic

```typescript
describe('Risk Scoring', () => {
  it('should calculate inherent risk correctly', () => {
    const impact = 4;
    const likelihood = 5;
    const inherentRisk = impact * likelihood;
    expect(inherentRisk).toBe(20);
  });

  it('should apply control reduction', () => {
    const inherentRisk = 20;
    const controlReduction = 0.4; // 40%
    const residualRisk = inherentRisk * (1 - controlReduction);
    expect(residualRisk).toBe(12);
  });

  it('should categorize risk as high', () => {
    const riskScore = 18;
    const category = riskScore >= 15 ? 'High' : riskScore >= 8 ? 'Medium' : 'Low';
    expect(category).toBe('High');
  });
});
```

### Form Validation

```typescript
describe('Assessment Validation', () => {
  it('should validate required fields', () => {
    const data = { organizationName: '', industry: 'Finance' };
    const isValid = data.organizationName.length > 0;
    expect(isValid).toBe(false);
  });
});
```

### Key-Pass Validation

```typescript
describe('Key-Pass System', () => {
  it('should validate key-pass format', () => {
    const validKeyPass = 'STOP-FRA-2024-ABC123';
    const isValid = /^STOP-FRA-\d{4}-[A-Z0-9]{6}$/.test(validKeyPass);
    expect(isValid).toBe(true);
  });

  it('should reject invalid key-pass', () => {
    const invalidKeyPass = 'invalid-key';
    const isValid = /^STOP-FRA-\d{4}-[A-Z0-9]{6}$/.test(invalidKeyPass);
    expect(isValid).toBe(false);
  });
});
```

## Debugging Tests

### Run specific test file
```bash
npm test __tests__/example.test.tsx
```

### Run tests matching pattern
```bash
npm test -- --testNamePattern="should calculate"
```

### Run with verbose output
```bash
npm test -- --verbose
```

### Update snapshots
```bash
npm test -- -u
```

## Known Issues & Limitations

1. **React Native Testing Library**: Currently set up but may need additional configuration for complex component testing due to React 19 compatibility.

2. **Native Module Mocking**: Some native modules may require additional mocking in `jest.setup.js`.

3. **Expo Router**: Basic mocking is in place, but complex routing scenarios may need custom mocks.

## Next Steps

1. Add tests for assessment calculation logic
2. Add tests for context providers (AuthContext, AssessmentContext)
3. Add integration tests for complete user flows
4. Set up test coverage reporting
5. Add E2E tests with Detox or Maestro

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Testing React Native Apps](https://reactnative.dev/docs/testing-overview)
- [Expo Testing Guide](https://docs.expo.dev/develop/unit-testing/)

---

**Last Updated**: December 20, 2025
