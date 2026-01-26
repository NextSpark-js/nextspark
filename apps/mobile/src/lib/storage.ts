/**
 * Cross-platform secure storage
 * Uses expo-secure-store on native, localStorage on web
 *
 * ⚠️ SECURITY NOTE: Web storage uses localStorage which is vulnerable to XSS attacks.
 * For production web deployments, consider:
 * - Using httpOnly cookies for session management (requires backend changes)
 * - Implementing Content Security Policy (CSP)
 * - This is acceptable for development/testing and native mobile apps
 */

import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const isWeb = Platform.OS === 'web'

export async function getItemAsync(key: string): Promise<string | null> {
  if (isWeb) {
    return localStorage.getItem(key)
  }
  return SecureStore.getItemAsync(key)
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (isWeb) {
    localStorage.setItem(key, value)
    return
  }
  return SecureStore.setItemAsync(key, value)
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (isWeb) {
    localStorage.removeItem(key)
    return
  }
  return SecureStore.deleteItemAsync(key)
}
