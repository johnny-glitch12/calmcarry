// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "*.config.js", "jest.setup.js"],
  },
  {
    rules: {
      // Reanimated mutates `sharedValue.value` by design - the React-Compiler
      // immutability rule misreads that as illegal. Off for this stack.
      "react-hooks/immutability": "off",
      // Common, intentional patterns - keep them visible as warnings, not build-breaking errors.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
]);
