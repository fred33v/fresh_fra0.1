/**
 * Early setup file that runs before React Native Testing Library
 * Prevents auto-registration of cleanup hooks
 */

// Set environment variable to disable auto-cleanup
process.env.RNTL_SKIP_AUTO_CLEANUP = 'true';

// Mock the problematic ViewConfigIgnore file
jest.mock('react-native/Libraries/NativeComponent/ViewConfigIgnore', () => ({
  ConditionallyIgnoredEventHandlers: (value) => value,
  DynamicallyInjectedByGestureHandler: (value) => value,
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
  isHostImage: (element) => {
    return !!element && (element.type === 'Image' || element.type === 'RCTImage' || element.type === 'RCTImageView');
  },
}));
