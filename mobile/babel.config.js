module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      "react-native-reanimated/plugin",
      [
        "module-resolver",
        {
          root: ["./src"],
          extensions: [
            ".ios.ts",
            ".android.ts",
            ".ts",
            ".ios.tsx",
            ".android.tsx",
            ".tsx",
            ".jsx",
            ".js",
            ".json",
          ],
          alias: {
            "@assets": ["./src/assets"],
            "@components": ["./src/components"],
            "@context": ["./src/context"],
            "@hooks": ["./src/hooks"],
            "@layout": ["./src/layout"],
            "@services": ["./src/services"],
            "@template": ["./src/template"],
            "@theme": ["./src/theme"],
            "@utils": ["./src/utils"],
            "@lib": ["./src/lib"],
            "@store": ["./src/store"],
            "@zustand": ["./src/zustand"],
          },
        },
      ],
    ],
  };
};
