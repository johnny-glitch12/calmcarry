const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// ensure bundled audio formats resolve as assets
config.resolver.assetExts = Array.from(
  new Set([...config.resolver.assetExts, 'mp3', 'ogg', 'm4a', 'wav'])
);

module.exports = withNativeWind(config, { input: './src/global.css' });
