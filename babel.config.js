module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo reads `experiments.reactCompiler` from app.json,
    // so the React Compiler stays enabled alongside NativeWind's jsx runtime.
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
