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
    // Minimal nextUrl (pathname/origin/searchParams/clone) for proxy/middleware tests
    try {
      const parsed = new URL(url, 'http://localhost')
      parsed.clone = () => new URL(parsed.toString())
      this.nextUrl = parsed
    } catch {
      this.nextUrl = undefined
    }
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

  // Pass-through response. Keeps the forwarded request headers (if any) so
  // middleware/proxy tests can assert what reaches the app.
  static next(init = {}) {
    const response = new MockNextResponse(null, { status: 200, headers: init.headers })
    response.type = 'next'
    response.requestHeaders = init.request && init.request.headers ? init.request.headers : null
    return response
  }

  static redirect(url, status = 307) {
    const response = new MockNextResponse(null, { status, headers: { Location: String(url) } })
    response.type = 'redirect'
    response.redirectUrl = String(url)
    return response
  }
}

module.exports = {
  NextRequest: MockNextRequest,
  NextResponse: MockNextResponse
}