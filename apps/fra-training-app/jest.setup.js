// Note: @testing-library/jest-native is deprecated
// Built-in matchers are now included in @testing-library/react-native v12.4+

// Mock the problematic ViewConfigIgnore file
jest.mock('react-native/Libraries/NativeComponent/ViewConfigIgnore', () => ({
  ConditionallyIgnoredEventHandlers: (value) => value,
  DynamicallyInjectedByGestureHandler: {},
}), { virtual: true });

// Disable host component name detection
jest.mock('@testing-library/react-native/build/helpers/host-component-names', () => ({
  configureHostComponentNamesIfNeeded: jest.fn(),
  getHostComponentNames: jest.fn(() => new Set()),
  isHostText: (element) => {
    return !!element && (element.type === 'Text' || element.type === 'RCTText' || element.type === 'RCTVirtualText');
  },
  isHostElement: (element) => {
    return !!element && typeof element.type === 'string';
  },
  isHostTextInput: (element) => {
    return !!element && (element.type === 'TextInput' || element.type === 'RCTTextInput');
  },
  isHostSwitch: (element) => {
    return !!element && (element.type === 'Switch' || element.type === 'RCTSwitch');
  },
  isHostScrollView: (element) => {
    return !!element && (element.type === 'ScrollView' || element.type === 'RCTScrollView');
  },
  isHostTouchable: (element) => {
    return (
      !!element &&
      (element.type === 'TouchableOpacity' ||
        element.type === 'TouchableHighlight' ||
        element.type === 'Pressable' ||
        element.type === 'RCTView')
    );
  },
}));

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

// Mock expo-linking
jest.mock('expo-linking', () => ({
  openURL: jest.fn(),
  createURL: jest.fn(),
}));

// Mock lucide-react-native icons
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { Text } = require('react-native');

  // Create a mock component factory
  const createMockIcon = (name) => {
    const MockIcon = (props) => React.createElement(Text, { testID: `icon-${name}`, ...props }, name);
    MockIcon.displayName = name;
    return MockIcon;
  };

  return new Proxy({}, {
    get: (target, prop) => {
      if (prop === '__esModule') return true;
      if (prop === 'default') return createMockIcon('LucideIcon');
      if (typeof prop === 'string') {
        return createMockIcon(prop);
      }
      return undefined;
    },
  });
});

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }) => React.createElement(View, props, children),
    SafeAreaProvider: ({ children }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

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
        message.includes('Not implemented') ||
        message.includes('react-test-renderer is deprecated'))
    ) {
      return;
    }
    originalConsoleError(...args);
  }),
};
