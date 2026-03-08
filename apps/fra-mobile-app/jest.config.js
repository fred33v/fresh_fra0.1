module.exports = {
  preset: 'react-native',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': '<rootDir>/jest-transformer.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm|((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|lucide-react-native|victory-native|@nkzw/.*))',
  ],
  collectCoverageFrom: [
    '**/*.{js,jsx,ts,tsx}',
    '!**/coverage/**',
    '!**/node_modules/**',
    '!**/babel.config.js',
    '!**/jest.setup.js',
    '!**/jest.polyfills.js',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  setupFiles: ['<rootDir>/jest.setup-early.js', '<rootDir>/jest.polyfills.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  moduleNameMapper: {
    // Mock problematic React Native file with TypeScript 5.0 const type parameters
    '.*/Libraries/NativeComponent/ViewConfigIgnore(\\.js)?$': '<rootDir>/__mocks__/react-native/Libraries/NativeComponent/ViewConfigIgnore.js',
    '\\.svg$': '<rootDir>/__mocks__/svgMock.js',
    '\\.(png|jpg|jpeg|gif)$': '<rootDir>/__mocks__/fileMock.js',
    '^@stopfra/ui-core/(.*)$': '<rootDir>/../../packages/ui-core/dist/$1/index.js',
    '^@stopfra/ui-core$': '<rootDir>/../../packages/ui-core/dist/index.js',
    '^@stopfra/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
    '^@/(.*)$': '<rootDir>/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/contexts/(.*)$': '<rootDir>/contexts/$1',
    '^@/types/(.*)$': '<rootDir>/types/$1',
    '^@/constants/(.*)$': '<rootDir>/constants/$1',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
  },
  testEnvironment: 'node',
};
