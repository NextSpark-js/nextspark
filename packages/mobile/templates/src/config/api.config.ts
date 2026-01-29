/**
 * API Configuration
 *
 * Resolution order:
 * 1. EXPO_PUBLIC_API_URL env variable (set in .env or EAS)
 * 2. Auto-detect from Expo dev server host IP + default web port
 *    This uses the same network IP that Expo uses, so it works
 *    on both iOS Simulator and Android Emulator.
 * 3. Fallback to localhost:3000 (standard Next.js default)
 */

import { Platform } from 'react-native'
import Constants from 'expo-constants'

/** Default port for the NextSpark web app (Next.js default) */
const DEFAULT_WEB_PORT = 3000

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  (Constants.expoConfig?.hostUri
    ? `http://${Constants.expoConfig.hostUri.split(':')[0]}:${DEFAULT_WEB_PORT}`
    : `http://${Platform.OS === 'android' ? '10.0.2.2' : 'localhost'}:${DEFAULT_WEB_PORT}`)

export const API_CONFIG = {
  baseUrl: API_URL,
  endpoints: {
    auth: '/api/auth',
    tasks: '/api/v1/tasks',
    customers: '/api/v1/customers',
    teams: '/api/v1/teams',
  },
  defaults: {
    limit: 20,
    staleTime: 5 * 60 * 1000,  // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  },
}
