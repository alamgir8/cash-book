module.exports = function (api) {
  // Invalidate Babel cache when Worklets changes so plugin-stamped
  // __pluginVersion always matches the installed JS package version.
  api.cache.using(
    () => require("react-native-worklets/package.json").version
  );

  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
