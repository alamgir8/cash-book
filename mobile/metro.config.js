const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const {
  wrapWithReanimatedMetroConfig,
} = require("react-native-reanimated/metro-config");

const config = getDefaultConfig(__dirname);

// Wrap the configuration for Reanimated
const reanimatedConfig = wrapWithReanimatedMetroConfig(config);

// Wrap the configuration for NativeWind
const finalConfig = withNativeWind(reanimatedConfig, {
  input: "./styles/global.css",
});

module.exports = finalConfig;
