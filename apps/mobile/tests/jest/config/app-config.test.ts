describe('app.config.js extra.apiUrl', () => {
  const ORIGINAL_ENV = process.env.EXPO_PUBLIC_API_URL

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL
    } else {
      process.env.EXPO_PUBLIC_API_URL = ORIGINAL_ENV
    }
    jest.resetModules()
  })

  it('passes through EXPO_PUBLIC_API_URL when it is set', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com'
    jest.resetModules()

    const config = require('../../../app.config.js').default

    expect(config.expo.extra.apiUrl).toBe('https://api.example.com')
  })

  it('leaves apiUrl unset when the env var is absent, so the client can auto-detect the dev host', () => {
    delete process.env.EXPO_PUBLIC_API_URL
    jest.resetModules()

    const config = require('../../../app.config.js').default

    expect(config.expo.extra.apiUrl).toBeUndefined()
  })
})
