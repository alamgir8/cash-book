const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Expo defaults inlineRequires to false, which can break Worklets/Reanimated
// initialization during bundle load (crash mid-progress on device/simulator).
// See: https://github.com/software-mansion/react-native-reanimated/issues/9445
const previousGetTransformOptions = config.transformer?.getTransformOptions;
config.transformer = {
  ...config.transformer,
  getTransformOptions: async (entryPoints, options, getDependenciesOf) => {
    const previous = previousGetTransformOptions
      ? await previousGetTransformOptions(entryPoints, options, getDependenciesOf)
      : {};

    return {
      ...previous,
      transform: {
        ...(previous.transform ?? {}),
        inlineRequires: true,
      },
    };
  },
};

module.exports = withNativeWind(config, { input: "./global.css" });
