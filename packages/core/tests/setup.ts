/**
 * Jest Setup File
 * Configuración global para todos los tests unitarios
 */

// Jest Setup - JSDOM testing environment for React components
import '@testing-library/jest-dom'

// 🌍 Mock de variables de entorno para testing
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'

// 🌐 Mock global de fetch
global.fetch = jest.fn()

// 🔍 Mock ResizeObserver (needed for Radix UI components)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// 🔤 Mock TextEncoder/TextDecoder (needed for PostgreSQL)
global.TextEncoder = jest.fn().mockImplementation(() => ({
  encode: jest.fn((text: string) => new Uint8Array(Buffer.from(text, 'utf-8'))),
}))

global.TextDecoder = jest.fn().mockImplementation(() => ({
  decode: jest.fn((bytes: Uint8Array) => Buffer.from(bytes).toString('utf-8')),
}))

// 🌊 Mock TransformStream (needed for AI SDK streaming)
global.TransformStream = jest.fn().mockImplementation(() => ({
  readable: new ReadableStream(),
  writable: new WritableStream(),
})) as any

// 🗂️ Mock File and Blob constructors (needed for file parsing tests)
global.File = class MockFile {
  name: string;
  type: string;
  size: number;
  lastModified: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
  text: () => Promise<string>;
  slice: (start?: number, end?: number) => Blob;

  constructor(bits: BlobPart[], filename: string, options?: FilePropertyBag) {
    this.name = filename;
    this.type = options?.type || '';
    this.size = bits.reduce((acc, bit) => acc + (typeof bit === 'string' ? bit.length : bit.byteLength), 0);
    this.lastModified = options?.lastModified || Date.now();

    const content = bits.map(bit =>
      typeof bit === 'string' ? bit : new TextDecoder().decode(bit as BufferSource)
    ).join('');

    this.arrayBuffer = jest.fn().mockResolvedValue(new TextEncoder().encode(content).buffer);
    this.text = jest.fn().mockResolvedValue(content);
    this.slice = jest.fn((start = 0, end = this.size) => new Blob([content.slice(start, end)]));
  }
} as any;

global.Blob = class MockBlob {
  size: number;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
  text: () => Promise<string>;
  slice: (start?: number, end?: number) => Blob;

  constructor(bits: BlobPart[] = [], options?: BlobPropertyBag) {
    this.type = options?.type || '';
    const content = bits.map(bit =>
      typeof bit === 'string' ? bit : new TextDecoder().decode(bit as BufferSource)
    ).join('');
    this.size = content.length;
    this.arrayBuffer = jest.fn().mockResolvedValue(new TextEncoder().encode(content).buffer);
    this.text = jest.fn().mockResolvedValue(content);
    this.slice = jest.fn((start = 0, end = this.size) => new Blob([content.slice(start, end)]));
  }
} as any;

// 🌐 Mock Request and Headers (needed for Next.js API tests)
global.Request = jest.fn().mockImplementation((url: string, options: any = {}) => ({
  url,
  method: options.method || 'GET',
  headers: new Map(Object.entries(options.headers || {})),
  json: jest.fn().mockImplementation(async () => {
    if (!options.body) return {}
    try {
      return typeof options.body === 'string' ? JSON.parse(options.body) : options.body
    } catch {
      throw new SyntaxError('Invalid JSON')
    }
  }),
  text: jest.fn().mockResolvedValue(options.body || ''),
  blob: jest.fn().mockResolvedValue(new Blob()),
  arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
}))

global.Headers = jest.fn().mockImplementation((init: any) => {
  const map = new Map()
  if (init) {
    if (Array.isArray(init)) {
      init.forEach(([key, value]) => map.set(key.toLowerCase(), value))
    } else {
      Object.entries(init).forEach(([key, value]) => map.set(key.toLowerCase(), value))
    }
  }
  return {
    get: (key: string) => map.get(key.toLowerCase()),
    set: (key: string, value: string) => map.set(key.toLowerCase(), value),
    has: (key: string) => map.has(key.toLowerCase()),
    delete: (key: string) => map.delete(key.toLowerCase()),
    entries: () => map.entries(),
    keys: () => map.keys(),
    values: () => map.values(),
    forEach: (callback: Function) => map.forEach(callback),
  }
})

// 🌐 Mock Response (needed for Next.js server components)
global.Response = jest.fn().mockImplementation((body?: any, init?: any) => ({
  ok: init?.status ? init.status >= 200 && init.status < 300 : true,
  status: init?.status || 200,
  statusText: init?.statusText || 'OK',
  headers: new Headers(init?.headers || {}),
  url: '',
  type: 'default',
  redirected: false,
  json: jest.fn().mockImplementation(async () => {
    if (!body) return {}
    try {
      return typeof body === 'string' ? JSON.parse(body) : body
    } catch {
      throw new SyntaxError('Invalid JSON')
    }
  }),
  text: jest.fn().mockResolvedValue(body || ''),
  blob: jest.fn().mockResolvedValue(new Blob()),
  arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
  clone: jest.fn().mockReturnThis(),
}))

// Static methods for Response
Object.assign(global.Response, {
  json: jest.fn((data: any, init?: any) => new global.Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers }
  })),
  error: jest.fn(() => new global.Response(null, { status: 500, statusText: 'Internal Server Error' })),
  redirect: jest.fn((url: string, status = 302) => new global.Response(null, { status, headers: { Location: url } }))
})

// 🔧 Mock de console para tests más limpios (opcional)
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeAll(() => {
  // Silenciar errores esperados en tests
  console.error = jest.fn()
  console.warn = jest.fn()
})

afterAll(() => {
  // Restaurar console original
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})

// 🧹 Limpiar mocks después de cada test
afterEach(() => {
  jest.clearAllMocks()
  jest.resetModules()
})

// 🎭 Mock de Next.js router (pages router)
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/'
  })
}))

// 🎭 Mock de Next.js navigation (app router)
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: jest.fn(),
  notFound: jest.fn(),
}))

// 🎭 Mock de useTranslationPreload hook
jest.mock('@/core/hooks/useTranslationPreload', () => ({
  useTranslationPreload: jest.fn(),
  useNavigationPreload: jest.fn(() => ({ preloadForRoute: jest.fn() }))
}))

// 🎭 Mock de next-intl with realistic translations
jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, options?: any) => {
    const translations: Record<string, string> = {
      // Auth namespace translations - LoginForm uses t('login.title') with useTranslations('auth')
      'login.title': 'Sign In',
      'login.description': 'Sign in to access your account',
      'login.form.continueWithGoogle': 'Continue with Google',
      'login.form.continueWithGoogleAria': 'Continue with Google',
      'login.form.loginWithEmail': 'Sign in with Email',
      'login.form.lastUsed': 'Last Used',
      'login.form.email': 'Email',
      'login.form.emailPlaceholder': 'Enter your email',
      'login.form.password': 'Password',
      'login.form.passwordPlaceholder': 'Enter your password',
      'login.form.signInButton': 'Sign In',
      'login.form.signingIn': 'Signing in...',
      'login.form.forgotPassword': 'Forgot password?',
      'login.form.forgotPasswordAria': 'Reset your password',
      'login.form.rememberMe': 'Remember me',
      'login.form.backToGoogle': 'Back to main options',
      'login.form.orContinueWith': 'Or continue with',
      'login.form.submitHelp': 'Press Enter to sign in',
      'login.footer.noAccount': "Don't have an account?",
      'login.footer.signUp': 'Sign up',
      'login.footer.signUpAria': 'Create new account',

      // Status messages
      'login.messages.signingIn': 'Signing in...',
      'login.messages.signInSuccess': 'Successfully signed in',
      'login.messages.signInFailed': 'Sign in failed',
      'login.messages.signInError': 'Sign in error: {error}',
      'login.messages.googleSigningIn': 'Signing in with Google...',
      'login.messages.googleSignInSuccess': 'Successfully signed in with Google',
      'login.messages.googleSignInFailed': 'Google sign in failed',
      'login.messages.googleSignInError': 'Google sign in error: {error}',

      // Error messages - simplified for testing
      'login.errors.google.oauthError': 'Google authentication failed',
      'login.errors.invalidCredentials': 'Invalid credentials',

      // Form validation
      'validation.email.required': 'Email is required',
      'validation.email.invalid': 'Invalid email address',
      'validation.password.required': 'Password is required',
      'validation.password.minLength': 'Password must be at least 6 characters',

      // Other common keys
      'signup.title': 'Create Account',
      'signup.description': 'Enter your information to create an account'
    }

    // Handle translation with options
    let translation = translations[key]

    // If no translation found and defaultValue provided, use defaultValue
    if (!translation && options?.defaultValue) {
      translation = options.defaultValue
    }

    // If still no translation, use fallback
    if (!translation) {
      translation = key.split('.').pop() || key
    }

    // Handle interpolation (like {error})
    if (options && typeof translation === 'string') {
      // Simple interpolation for test purposes
      Object.keys(options).forEach(optionKey => {
        if (optionKey !== 'defaultValue') {
          translation = translation.replace(`{${optionKey}}`, options[optionKey])
        }
      })
    }

    return translation
  },
  useLocale: () => 'en'
}))

// 🎭 Mock de crypto para API keys
let cryptoCallCount = 0

Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => `test-uuid-${++cryptoCallCount}`,
    getRandomValues: jest.fn((arr) => {
      // Generar valores únicos para cada llamada
      const seed = ++cryptoCallCount
      for (let i = 0; i < arr.length; i++) {
        arr[i] = (seed * 31 + i) % 256
      }
      return arr
    }),
    subtle: {
      digest: jest.fn().mockResolvedValue(new ArrayBuffer(32))
    }
  }
})

// ⏰ Mock de Date para tests determinísticos - disabled for JSDOM compatibility
// const mockDate = new Date('2024-01-15T10:00:00Z')
// jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any)
// Date.now = jest.fn(() => mockDate.getTime())

// 🎯 Helpers para tests
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidApiKey(): R
      toBeValidEmail(): R
    }
  }
}

// Custom matchers
expect.extend({
  toBeValidApiKey(received: string) {
    const apiKeyRegex = /^sk_(live|test)_[a-f0-9]{64}$/
    const pass = apiKeyRegex.test(received)
    
    return {
      message: () => 
        pass 
          ? `Expected ${received} not to be a valid API key`
          : `Expected ${received} to be a valid API key format (sk_(live|test)_[64 hex chars])`,
      pass
    }
  },
  
  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const pass = emailRegex.test(received)
    
    return {
      message: () =>
        pass
          ? `Expected ${received} not to be a valid email`
          : `Expected ${received} to be a valid email format`,
      pass
    }
  }
})
