/**
 * API Configuration
 *
 * baseUrl reuses the client's own host resolution (see getApiUrl in
 * @nextsparkjs/mobile), so a custom call made through this config hits the
 * same host as every entity API call.
 */

import { getApiUrl } from '@nextsparkjs/mobile'

export const API_CONFIG = {
  baseUrl: getApiUrl(),
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
