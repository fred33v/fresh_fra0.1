/**
 * Custom Jest transformer that intercepts ViewConfigIgnore.js
 * and replaces it with a mock before Babel transformation.
 *
 * Uses @react-native/babel-preset which handles both Flow and TypeScript
 * files correctly via the Hermes parser.
 */

const babelJest = require('babel-jest').default;
const crypto = require('crypto');

// Resolve the React Native babel preset which handles Flow (with Hermes parser)
// and TypeScript files, plus module transformation
const rnBabelPreset = require.resolve(
  '@react-native/babel-preset',
  { paths: [require.resolve('react-native/package.json')] },
);

// Plugin to transform dynamic import() to require() for Jest compatibility
const dynamicImportPlugin = require.resolve(
  '@babel/plugin-transform-dynamic-import',
  { paths: [require.resolve('react-native/package.json')] },
);

const viewConfigIgnoreMock = `
/**
 * Mock for ViewConfigIgnore
 */
function ConditionallyIgnoredEventHandlers(value) {
  return value;
}

function DynamicallyInjectedByGestureHandler(value) {
  return value;
}

module.exports = {
  ConditionallyIgnoredEventHandlers,
  DynamicallyInjectedByGestureHandler,
};
`;

const babelTransformer = babelJest.createTransformer({
  babelrc: false,
  configFile: false,
  presets: [
    [rnBabelPreset, { enableBabelRuntime: false }],
  ],
  plugins: [
    [dynamicImportPlugin],
  ],
});

module.exports = {
  process(sourceText, sourcePath, options) {
    // Intercept ViewConfigIgnore.js and replace with mock
    if (sourcePath.includes('ViewConfigIgnore.js')) {
      return {
        code: viewConfigIgnoreMock,
        map: null,
      };
    }

    return babelTransformer.process(sourceText, sourcePath, options);
  },
  getCacheKey(sourceText, sourcePath, options) {
    const hash = crypto
      .createHash('md5')
      .update(sourceText)
      .update('\0')
      .update(sourcePath)
      .update('\0')
      .update(JSON.stringify(options.config || {}))
      .digest('hex');
    return hash;
  },
};
