/**
 * API Configuration
 */

import Constants from 'expo-constants'

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  (Constants.expoConfig?.hostUri
    ? `http://${Constants.expoConfig.hostUri.split(':')[0]}:5173`
    : 'http://localhost:5173')

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
