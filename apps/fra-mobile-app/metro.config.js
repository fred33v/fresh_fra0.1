const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Workspace packages (packages/*) are compiled with TypeScript's NodeNext rules, so their
// source imports siblings as "./colors.js" while the file on disk is colors.ts. The app's
// tsconfig paths point Metro at that source, so retry such imports without the extension.
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolve ?? context.resolveRequest;
  if (moduleName.startsWith('.') && moduleName.endsWith('.js') && context.originModulePath.includes('/packages/')) {
    try {
      return resolve(context, moduleName.slice(0, -3), platform);
    } catch {
      // fall through to the import as written
    }
  }
  return resolve(context, moduleName, platform);
};

// The Rork toolkit only exists in the Rork editor; a plain checkout builds without it
let withRorkMetro = (c) => c;
try {
  ({ withRorkMetro } = require('@rork-ai/toolkit-sdk/metro'));
} catch {
  // not installed: use the standard Expo config
}

module.exports = withRorkMetro(config);
