/**
 * Mock for ViewConfigIgnore to avoid TypeScript const type parameter parsing issues
 * This file mocks the problematic ViewConfigIgnore.js from React Native
 */

function ConditionallyIgnoredEventHandlers(value) {
  // Mock Platform check - in tests, assume iOS
  return value;
}

module.exports = {
  ConditionallyIgnoredEventHandlers,
};
