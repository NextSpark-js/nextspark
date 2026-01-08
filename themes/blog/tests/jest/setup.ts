/**
 * Jest Setup for Blog Theme
 *
 * This file provides complete Jest setup for npm mode.
 * It includes all necessary polyfills and mocks.
 */

import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'

// Polyfill TextEncoder/TextDecoder for jsdom
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder as typeof global.TextDecoder

// Polyfill Web APIs for Next.js server components testing
class MockHeaders {
  private _headers: Map<string, string> = new Map()

  constructor(init?: HeadersInit) {
    if (init) {
      if (init instanceof MockHeaders) {
        init._headers.forEach((value, key) => this._headers.set(key, value))
      } else if (Array.isArray(init)) {
        init.forEach(([key, value]) => this._headers.set(key.toLowerCase(), value))
      } else {
        Object.entries(init).forEach(([key, value]) => this._headers.set(key.toLowerCase(), value))
      }
    }
  }

  get(name: string) { return this._headers.get(name.toLowerCase()) || null }
  set(name: string, value: string) { this._headers.set(name.toLowerCase(), value) }
  has(name: string) { return this._headers.has(name.toLowerCase()) }
  delete(name: string) { this._headers.delete(name.toLowerCase()) }
  forEach(cb: (value: string, key: string) => void) { this._headers.forEach(cb) }
  entries() { return this._headers.entries() }
  keys() { return this._headers.keys() }
  values() { return this._headers.values() }
}

class MockRequest {
  url: string
  method: string
  headers: MockHeaders
  private _body: any

  constructor(input: string | URL, init?: RequestInit) {
    this.url = typeof input === 'string' ? input : input.toString()
    this.method = init?.method || 'GET'
    this.headers = new MockHeaders(init?.headers as HeadersInit)
    this._body = init?.body
  }

  async json() {
    if (!this._body) return {}
    return typeof this._body === 'string' ? JSON.parse(this._body) : this._body
  }

  async text() {
    return this._body?.toString() || ''
  }

  clone() {
    return new MockRequest(this.url, {
      method: this.method,
      headers: Object.fromEntries(this.headers.entries()),
      body: this._body,
    })
  }
}

class MockResponse {
  body: any
  status: number
  statusText: string
  headers: MockHeaders
  ok: boolean

  constructor(body?: any, init?: ResponseInit) {
    this.body = body
    this.status = init?.status || 200
    this.statusText = init?.statusText || 'OK'
    this.headers = new MockHeaders(init?.headers as HeadersInit)
    this.ok = this.status >= 200 && this.status < 300
  }

  async json() {
    if (!this.body) return {}
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body
  }

  async text() {
    return this.body?.toString() || ''
  }

  clone() {
    return new MockResponse(this.body, {
      status: this.status,
      statusText: this.statusText,
      headers: Object.fromEntries(this.headers.entries()),
    })
  }

  static json(data: any, init?: ResponseInit) {
    return new MockResponse(JSON.stringify(data), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) as object },
    })
  }
}

// Assign to global scope
global.Headers = MockHeaders as any
global.Request = MockRequest as any
global.Response = MockResponse as any

// Mock fetch
global.fetch = jest.fn().mockResolvedValue(new MockResponse('{}', { status: 200 }))

// Mock Web Crypto API
const crypto = require('crypto')
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (arr: Uint8Array) => crypto.randomFillSync(arr),
    randomUUID: () => crypto.randomUUID(),
    subtle: {
      digest: async (algorithm: string, data: BufferSource) => {
        const hash = crypto.createHash(algorithm.toLowerCase().replace('-', ''))
        hash.update(Buffer.from(data as ArrayBuffer))
        return hash.digest().buffer
      },
      encrypt: jest.fn(),
      decrypt: jest.fn(),
      sign: jest.fn(),
      verify: jest.fn(),
      generateKey: jest.fn(),
      importKey: jest.fn(),
      exportKey: jest.fn(),
    },
  },
})

// Mock matchMedia for component tests with media queries
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))
