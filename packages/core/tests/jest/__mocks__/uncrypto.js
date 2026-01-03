/**
 * Mock for uncrypto package
 * Resolves ES module import issues in Jest tests
 */

module.exports = {
  randomUUID: () => 'test-uuid-123',
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256)
    }
    return arr
  },
  subtle: {
    digest: async () => new ArrayBuffer(32)
  }
}