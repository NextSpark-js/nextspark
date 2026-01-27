/**
 * Tests for lib/storage.ts
 * Native secure storage tests (iOS/Android only)
 *
 * Note: These tests use the global mocks from setup.ts
 * Platform.OS is mocked as 'ios' by default
 */

import * as SecureStore from 'expo-secure-store'
import { getItemAsync, setItemAsync, deleteItemAsync } from '@/lib/storage'

describe('Storage utility (native)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('SecureStore operations', () => {
    it('should use SecureStore.getItemAsync', async () => {
      await getItemAsync('test-key')
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('test-key')
    })

    it('should use SecureStore.setItemAsync', async () => {
      await setItemAsync('test-key', 'test-value')
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'test-key',
        'test-value'
      )
    })

    it('should use SecureStore.deleteItemAsync', async () => {
      await deleteItemAsync('test-key')
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('test-key')
    })

    it('should return null for non-existent keys', async () => {
      const result = await getItemAsync('non-existent-key')
      expect(result).toBeNull()
    })

    it('should store and retrieve values correctly', async () => {
      await setItemAsync('my-key', 'my-value')
      const result = await getItemAsync('my-key')
      expect(result).toBe('my-value')
    })

    it('should delete values correctly', async () => {
      await setItemAsync('delete-key', 'delete-value')
      await deleteItemAsync('delete-key')
      const result = await getItemAsync('delete-key')
      expect(result).toBeNull()
    })

    it('should handle multiple keys independently', async () => {
      await setItemAsync('key1', 'value1')
      await setItemAsync('key2', 'value2')

      const result1 = await getItemAsync('key1')
      const result2 = await getItemAsync('key2')

      expect(result1).toBe('value1')
      expect(result2).toBe('value2')
    })

    it('should overwrite existing values', async () => {
      await setItemAsync('overwrite-key', 'original')
      await setItemAsync('overwrite-key', 'updated')

      const result = await getItemAsync('overwrite-key')
      expect(result).toBe('updated')
    })
  })

  describe('SecureStore mock verification', () => {
    it('should track all getItemAsync calls', async () => {
      await getItemAsync('key1')
      await getItemAsync('key2')
      await getItemAsync('key3')

      expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(3)
    })

    it('should track all setItemAsync calls', async () => {
      await setItemAsync('key1', 'value1')
      await setItemAsync('key2', 'value2')

      expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(2)
    })

    it('should track all deleteItemAsync calls', async () => {
      await deleteItemAsync('key1')
      await deleteItemAsync('key2')

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(2)
    })
  })
})
