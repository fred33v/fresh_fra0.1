const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The Rork toolkit only exists in the Rork editor; a plain checkout builds without it
let withRorkMetro = (c) => c;
try {
  ({ withRorkMetro } = require("@rork-ai/toolkit-sdk/metro"));
} catch {
  // not installed: use the standard Expo config
}

module.exports = withRorkMetro(config);
