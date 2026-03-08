/**
 * Custom Jest transformer that intercepts ViewConfigIgnore.js
 * and replaces it with a mock before Babel transformation
 */

const babelJest = require('babel-jest').default;

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

module.exports = {
  process(sourceText, sourcePath, options) {
    // Intercept ViewConfigIgnore.js and replace with mock
    if (sourcePath.includes('ViewConfigIgnore.js')) {
      return {
        code: viewConfigIgnoreMock,
        map: null,
      };
    }

    // Use babel-jest for all other files
    const babelTransformer = babelJest.createTransformer({
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        ['@babel/preset-typescript', {
          allowDeclareFields: true,
          onlyRemoveTypeImports: true,
        }],
      ],
    });

    return babelTransformer.process(sourceText, sourcePath, options);
  },
};
