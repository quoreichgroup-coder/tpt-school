module.exports = ({ config }) => {
  const buildArchs = (process.env.ANDROID_BUILD_ARCHS || 'armeabi-v7a,arm64-v8a,x86,x86_64')
    .split(',')
    .map((arch) => arch.trim())
    .filter(Boolean)

  return {
    ...config,
    plugins: (config.plugins || []).map((plugin) =>
      plugin === 'expo-build-properties'
        ? ['expo-build-properties', { android: { buildArchs } }]
        : plugin,
    ),
  }
}
