import { ExpoConfig, ConfigContext } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'My App',
  slug: 'my-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
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
    // Permissions libraries add to the merged AndroidManifest.xml that your app never uses.
    // Review the merged manifest of a release build, then uncomment what you do not need.
    blockedPermissions: [
      // 'android.permission.CAMERA',
      // 'android.permission.RECORD_AUDIO',
      // 'android.permission.READ_EXTERNAL_STORAGE',
      // 'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
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
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-splash-screen', { image: './assets/splash.png', resizeMode: 'contain', backgroundColor: '#ffffff' }],
  ],
  scheme: 'myapp',
})
