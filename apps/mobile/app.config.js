/**
 * Expo config with environment variables
 */

export default {
  expo: {
    name: 'NextSpark Mobile',
    slug: 'nextspark-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'nextspark',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.nextspark.mobile',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/icon.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.nextspark.mobile',
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/icon.png',
    },
    plugins: ['expo-router', 'expo-secure-store'],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      // No fallback here: the api client's own priority chain (env var, then
      // the dev server's hostUri, then a platform-aware default) only runs
      // when this stays undefined. A hardcoded default would always win as
      // the client's first priority and shadow hostUri auto-detection.
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
    },
  },
}
