const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  publicPath: config.transformer?.publicPath ?? "/assets/?unstable_path=."
};

module.exports = withNativeWind(config, { input: "./global.css" });
