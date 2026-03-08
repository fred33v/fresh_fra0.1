# Testing Guide for Stop FRA Platform

## Overview

This document provides comprehensive guidance for testing the Stop FRA (Fraud Risk Assessment) platform. The testing infrastructure is set up following industry best practices and the testing architecture strategy outlined in `TESTING_ARCHITECTURE_STRATEGY.md`.

## 🧪 Testing Stack

### Installed Dependencies

- **Jest** v29.7.0 - JavaScript testing framework
- **@testing-library/react-native** v12.4.3 - React Native component testing
- **react-test-renderer** 19.1.0 - React component rendering for tests
- **@types/jest** v29.5.12 - TypeScript types for Jest
- **babel-jest** v29.7.0 - Babel transformer for Jest
- **jest-environment-jsdom** v29.7.0 - DOM environment for tests

### Configuration Files

- **jest.config.js** - Main Jest configuration
- **jest.setup.js** - Test environment setup and mocks
- **jest.polyfills.js** - Polyfills for Node.js environment
- **__mocks__/** - Mock files for assets and modules

## 📁 Project Structure

```
fraud-risk-app-main/
├── __tests__/
│   ├── unit/                      # Unit tests
│   │   ├── components/            # Component tests
│   │   ├── contexts/              # Context tests
│   │   └── riskScoring.test.ts   # Business logic tests
│   ├── integration/               # Integration tests
│   │   └── assessmentFlow.test.tsx
│   └── helpers/                   # Test utilities
│       └── testUtils.tsx
├── __mocks__/                     # Mock files
│   ├── svgMock.js
│   └── fileMock.js
├── jest.config.js                 # Jest configuration
├── jest.setup.js                  # Test setup
└── jest.polyfills.js              # Polyfills
```

## 🚀 Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Advanced Usage

```bash
# Run specific test file
npm test -- __tests__/unit/riskScoring.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="Risk Scoring"

# Update snapshots
npm test -- -u

# Run tests in verbose mode
npm test -- --verbose

# Run tests with coverage for specific files
npm test -- --coverage --collectCoverageFrom="contexts/**/*.tsx"
```

## 📝 Writing Tests

### Unit Test Example

```typescript
// __tests__/unit/utils/validation.test.ts
describe('Email Validation', () => {
  const validateEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  it('should validate correct email addresses', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('user.name@company.co.uk')).toBe(true);
  });

  it('should reject invalid email addresses', () => {
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('@example.com')).toBe(false);
    expect(validateEmail('test@')).toBe(false);
  });
});
```

### Component Test Example

```typescript
// __tests__/unit/components/LoginForm.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

describe('LoginForm Component', () => {
  it('should render login form fields', () => {
    const { getByPlaceholderText } = render(<LoginForm />);
    
    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
  });

  it('should call onSubmit with credentials', async () => {
    const mockSubmit = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <LoginForm onSubmit={mockSubmit} />
    );

    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Login'));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });
});
```

### Integration Test Example

```typescript
// __tests__/integration/authentication.test.tsx
import { render, waitFor } from '../helpers/testUtils';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

describe('Authentication Integration', () => {
  it('should handle complete login flow', async () => {
    const TestComponent = () => {
      const { login, user } = useAuth();
      
      return (
        <View>
          <Button onPress={() => login('test@example.com', 'pass123')}>
            Login
          </Button>
          {user && <Text testID="user-email">{user.email}</Text>}
        </View>
      );
    };

    const { getByText, getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    fireEvent.press(getByText('Login'));

    await waitFor(() => {
      expect(getByTestId('user-email')).toBeTruthy();
    });
  });
});
```

## 🎯 Coverage Goals

Based on the testing architecture strategy:

### Overall Coverage Targets

- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

### Critical Components (90%+ Required)

- Authentication modules
- Payment processing
- Risk scoring engine
- Key-pass generation
- Data validation
- Encryption utilities

## 🧰 Test Utilities

### Custom Render Function

```typescript
import { render } from '@testing-library/react-native';

// Wrapper with providers
const customRender = (ui: ReactElement, options?: RenderOptions) => {
  return render(ui, {
    wrapper: ({ children }) => (
      <AuthProvider>
        <AssessmentProvider>
          {children}
        </AssessmentProvider>
      </AuthProvider>
    ),
    ...options,
  });
};

export { customRender as render };
```

### Mock Data Factories

```typescript
// __tests__/helpers/testUtils.tsx
export const createMockUser = (overrides = {}) => ({
  user_id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  name: 'Test User',
  role: 'employer',
  ...overrides,
});

export const createMockAssessment = (overrides = {}) => ({
  assessment_id: '123e4567-e89b-12d3-a456-426614174002',
  status: 'draft',
  overall_risk_level: null,
  ...overrides,
});
```

## 🔧 Mocking

### Mocking Expo Router

```typescript
// jest.setup.js (already configured)
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  Link: 'Link',
}));
```

### Mocking AsyncStorage

```typescript
// Automatically mocked in jest.setup.js
import AsyncStorage from '@react-native-async-storage/async-storage';

// In tests:
beforeEach(async () => {
  await AsyncStorage.clear();
});

it('should store data', async () => {
  await AsyncStorage.setItem('key', 'value');
  const value = await AsyncStorage.getItem('key');
  expect(value).toBe('value');
});
```

### Mocking API Calls

```typescript
// Mock fetch globally
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ data: 'mock data' }),
  })
) as jest.Mock;

// Or use jest.mock for specific modules
jest.mock('@/services/api', () => ({
  loginUser: jest.fn().mockResolvedValue({ token: 'mock-token' }),
  getAssessment: jest.fn().mockResolvedValue({ id: '123' }),
}));
```

## 🐛 Debugging Tests

### Debugging Tips

```typescript
// Use screen.debug() to see component tree
import { render, screen } from '@testing-library/react-native';

const { debug } = render(<MyComponent />);
debug(); // Prints component tree

// Use console.log for values
it('should log values', () => {
  const value = someFunction();
  console.log('Actual value:', value);
  expect(value).toBe(expected);
});

// Use --verbose flag
npm test -- --verbose

// Run single test file
npm test -- __tests__/unit/myTest.test.ts
```

### Common Issues

**Issue**: Tests fail with "Cannot find module"
```bash
# Solution: Check jest.config.js moduleNameMapper
# Ensure paths match your project structure
```

**Issue**: "useNativeDriver is not supported"
```bash
# Solution: Already mocked in jest.setup.js
# jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
```

**Issue**: "TextEncoder is not defined"
```bash
# Solution: Already polyfilled in jest.polyfills.js
```

## 📊 Coverage Reports

After running `npm run test:coverage`, coverage reports are generated in the `coverage/` directory:

- **coverage/lcov-report/index.html** - HTML coverage report (open in browser)
- **coverage/lcov.info** - LCOV format (for CI tools)
- **coverage/coverage-final.json** - JSON format

### Viewing Coverage

```bash
# Generate coverage
npm run test:coverage

# Open coverage report in browser
open coverage/lcov-report/index.html
```

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## 📚 Best Practices

### 1. Test Organization

- **Unit tests**: Test individual functions/components in isolation
- **Integration tests**: Test multiple components working together
- **E2E tests**: Test complete user flows (future implementation)

### 2. Test Naming

```typescript
// Good
describe('Risk Scoring Service', () => {
  describe('calculateInherentScore', () => {
    it('should calculate score correctly for valid inputs', () => {});
    it('should throw error for invalid inputs', () => {});
  });
});

// Avoid
test('test1', () => {});
```

### 3. AAA Pattern

```typescript
it('should update user profile', async () => {
  // Arrange
  const user = createMockUser();
  const updatedData = { name: 'New Name' };

  // Act
  const result = await updateProfile(user.id, updatedData);

  // Assert
  expect(result.name).toBe('New Name');
});
```

### 4. Avoid Implementation Details

```typescript
// Bad - testing implementation
expect(component.state.count).toBe(1);

// Good - testing behavior
expect(getByText('Count: 1')).toBeTruthy();
```

### 5. Use Data-Driven Tests

```typescript
const testCases = [
  { input: 1, expected: 1 },
  { input: 5, expected: 25 },
  { input: 10, expected: 100 },
];

testCases.forEach(({ input, expected }) => {
  it(`should square ${input} to get ${expected}`, () => {
    expect(square(input)).toBe(expected);
  });
});
```

## 🎓 Next Steps

### Immediate Actions

1. **Write tests for existing code**
   - Start with critical business logic (risk scoring)
   - Add tests for authentication flows
   - Cover payment processing

2. **Increase coverage**
   - Aim for 80% overall coverage
   - Focus on critical paths first
   - Add tests for edge cases

3. **Set up E2E testing**
   - Install Detox for mobile E2E tests
   - Create test scenarios for critical flows
   - Integrate with CI/CD pipeline

### Future Enhancements

- [ ] Visual regression testing (screenshot comparison)
- [ ] Accessibility testing with jest-axe
- [ ] Performance testing benchmarks
- [ ] Security testing (OWASP validation)
- [ ] API contract testing with Pact

## 📖 Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Stop FRA Testing Architecture](./TESTING_ARCHITECTURE_STRATEGY.md)

## 🤝 Contributing

When adding new features:

1. Write tests before implementing (TDD)
2. Ensure tests pass: `npm test`
3. Check coverage: `npm run test:coverage`
4. Maintain coverage thresholds (80%+)
5. Update test documentation as needed

---

**Last Updated**: December 20, 2025
**Version**: 1.0
**Maintainer**: Stop FRA Development Team
