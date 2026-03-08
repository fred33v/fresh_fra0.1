// Note: @testing-library/jest-native is deprecated
// Built-in matchers are now included in @testing-library/react-native v12.4+

// Mock the problematic ViewConfigIgnore file that uses TypeScript 5.0 const type parameters
// This must be mocked BEFORE any React Native components are imported
jest.mock('react-native/Libraries/NativeComponent/ViewConfigIgnore', () => ({
  ConditionallyIgnoredEventHandlers: (value) => value,
  DynamicallyInjectedByGestureHandler: {},
}), { virtual: true });

// Note: host-component-names mock removed - the @react-native/babel-preset
// properly handles Flow/TypeScript in React Native source files now.

// Mock Expo modules
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  Link: 'Link',
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
  useNetInfo: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
}));

// Suppress console warnings and errors during tests
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

global.console = {
  ...console,
  warn: jest.fn((...args) => {
    const message = args[0];
    if (
      typeof message === 'string' &&
      (message.includes('ReactNative') ||
        message.includes('useNativeDriver') ||
        message.includes('Animated'))
    ) {
      return;
    }
    originalConsoleWarn(...args);
  }),
  error: jest.fn((...args) => {
    const message = args[0];
    if (
      typeof message === 'string' &&
      (message.includes('Warning: ReactDOM') ||
        message.includes('Not implemented'))
    ) {
      return;
    }
    originalConsoleError(...args);
  }),
};
