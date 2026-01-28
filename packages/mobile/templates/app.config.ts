import { ExpoConfig, ConfigContext } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'My App',
  slug: 'my-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.mycompany.myapp',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'com.mycompany.myapp',
  },
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    // API URL - Configure for your environment
    // Development: auto-detected from Expo dev server
    // Production: set via EAS environment variables
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
  },
  plugins: ['expo-router', 'expo-secure-store'],
  scheme: 'myapp',
})
