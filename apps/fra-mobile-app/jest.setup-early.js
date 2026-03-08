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

// Note: host-component-names mock removed - the @react-native/babel-preset
// properly handles Flow/TypeScript in React Native source files now.
