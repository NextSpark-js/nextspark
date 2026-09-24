/**
 * Mock for next/server
 * Provides NextRequest and NextResponse mocks for API testing
 */

class MockNextRequest {
  constructor(url, options = {}) {
    this.url = url
    this.method = options.method || 'GET'
    this.headers = new Map(Object.entries(options.headers || {}))
    this._body = options.body
  }

  async json() {
    if (!this._body) return {}
    try {
      return typeof this._body === 'string' ? JSON.parse(this._body) : this._body
    } catch {
      throw new SyntaxError('Invalid JSON')
    }
  }

  async text() {
    return this._body || ''
  }
}

class MockNextResponse {
  constructor(body, options = {}) {
    this.body = body
    this.status = options.status || 200
    this.statusText = options.statusText || 'OK'
    this.headers = new Map(Object.entries(options.headers || {}))
  }

  async json() {
    if (!this.body) return {}
    try {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body
    } catch {
      throw new SyntaxError('Invalid JSON')
    }
  }

  static json(data, options = {}) {
    return new MockNextResponse(data, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    })
  }
}

module.exports = {
  NextRequest: MockNextRequest,
  NextResponse: MockNextResponse
}
