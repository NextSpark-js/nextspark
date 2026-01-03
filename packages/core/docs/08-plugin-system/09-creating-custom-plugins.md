# Creating Custom Plugins

## Introduction

This comprehensive tutorial guides you through creating a custom plugin from scratch. We'll build a complete **Weather Plugin** that fetches weather data, displays it in the UI, and provides an API endpoint.

**What You'll Learn:**
- Plugin scaffolding and structure
- Environment configuration
- API endpoint creation
- React component development
- Testing strategies
- Registry integration
- Deployment and publishing

**Final Plugin Features:**
- ✅ Fetch weather data from external API
- ✅ Display current weather in dashboard
- ✅ API endpoint for weather queries
- ✅ TypeScript types and validation
- ✅ Comprehensive test coverage
- ✅ Theme-aware UI components

---

## Prerequisites

**Required:**
- Node.js 18+ and pnpm installed
- Basic TypeScript knowledge
- Familiarity with React and Next.js
- Database access (optional for this example)

**Recommended:**
- Read [Plugin Introduction](./01-introduction.md)
- Review [Plugin Structure](./02-plugin-structure.md)
- Understand [Plugin Configuration](./03-plugin-configuration.md)

---

## Step 1: Plugin Scaffolding

### Create Plugin Directory

```bash
# Create plugin directory
mkdir -p contents/plugins/weather

# Navigate to plugin directory
cd contents/plugins/weather
```

### Create Basic Structure

```bash
# Create required files
touch plugin.config.ts README.md .env.example .gitignore

# Create directories
mkdir -p types lib api components
```

**Resulting Structure:**
```text
contents/plugins/weather/
├── plugin.config.ts
├── README.md
├── .env.example
├── .gitignore
├── types/
├── lib/
├── api/
└── components/
```

---

## Step 2: Environment Configuration

### Create `.env.example`

```bash
# contents/plugins/weather/.env.example
# ============================================
# WEATHER PLUGIN ENVIRONMENT VARIABLES
# ============================================
#
# ⚠️  IMPORTANT:
# - This file should ONLY contain WEATHER_PLUGIN_* namespaced variables
# - Global variables should be in root .env ONLY
# - This prevents override conflicts
#
# ============================================

# Enable/disable plugin
WEATHER_PLUGIN_ENABLED=true

# Weather API configuration
WEATHER_PLUGIN_API_KEY=your_api_key_here
WEATHER_PLUGIN_API_URL=https://api.openweathermap.org/data/2.5

# Default location
WEATHER_PLUGIN_DEFAULT_CITY=London

# Cache duration (minutes)
WEATHER_PLUGIN_CACHE_DURATION=30

# Debug mode
WEATHER_PLUGIN_DEBUG=false
```

### Create `.gitignore`

```bash
# contents/plugins/weather/.gitignore
.env
node_modules/
*.log
.turbo/
tsconfig.tsbuildinfo
```

### Copy and Configure

```bash
# Copy example to actual .env
cp .env.example .env

# Edit .env with your API key
# Get free API key from: https://openweathermap.org/api
```

---

## Step 3: TypeScript Types

### Create Type Definitions

```typescript
// contents/plugins/weather/types/weather.types.ts
export interface WeatherData {
  readonly city: string
  readonly country: string
  readonly temperature: number
  readonly feelsLike: number
  readonly humidity: number
  readonly description: string
  readonly icon: string
  readonly windSpeed: number
  readonly timestamp: string
}

export interface WeatherAPIResponse {
  readonly name: string
  readonly sys: {
    readonly country: string
  }
  readonly main: {
    readonly temp: number
    readonly feels_like: number
    readonly humidity: number
  }
  readonly weather: ReadonlyArray<{
    readonly description: string
    readonly icon: string
  }>
  readonly wind: {
    readonly speed: number
  }
}

export interface WeatherPluginConfig {
  readonly enabled: boolean
  readonly apiKey: string
  readonly apiUrl: string
  readonly defaultCity: string
  readonly cacheDuration: number
  readonly debug: boolean
}

export interface FetchWeatherOptions {
  readonly city: string
  readonly units?: 'metric' | 'imperial'
}

export interface WeatherError {
  readonly code: string
  readonly message: string
}
```

---

## Step 4: Plugin Logic

### Create Environment Loader

```typescript
// contents/plugins/weather/lib/server-env.ts
import { config } from 'dotenv'
import { join } from 'path'
import type { WeatherPluginConfig } from '../types/weather.types'

// Load plugin-level .env file
config({ path: join(__dirname, '../.env') })

export const weatherEnv: WeatherPluginConfig = {
  enabled: process.env.WEATHER_PLUGIN_ENABLED === 'true',
  apiKey: process.env.WEATHER_PLUGIN_API_KEY || '',
  apiUrl: process.env.WEATHER_PLUGIN_API_URL || 'https://api.openweathermap.org/data/2.5',
  defaultCity: process.env.WEATHER_PLUGIN_DEFAULT_CITY || 'London',
  cacheDuration: parseInt(process.env.WEATHER_PLUGIN_CACHE_DURATION || '30', 10),
  debug: process.env.WEATHER_PLUGIN_DEBUG === 'true'
}

export function validateEnvironment(): void {
  if (!weatherEnv.apiKey) {
    throw new Error('[Weather Plugin] API key is required. Please set WEATHER_PLUGIN_API_KEY in .env')
  }

  if (weatherEnv.cacheDuration < 1) {
    throw new Error('[Weather Plugin] Cache duration must be at least 1 minute')
  }
}
```

### Create Core Utilities

```typescript
// contents/plugins/weather/lib/core-utils.ts
import type {
  WeatherData,
  WeatherAPIResponse,
  FetchWeatherOptions,
  WeatherError
} from '../types/weather.types'
import { weatherEnv } from './server-env'

/**
 * Fetch weather data from OpenWeather API
 */
export async function fetchWeather(
  options: FetchWeatherOptions
): Promise<WeatherData> {
  const { city, units = 'metric' } = options

  try {
    const url = new URL(`${weatherEnv.apiUrl}/weather`)
    url.searchParams.set('q', city)
    url.searchParams.set('appid', weatherEnv.apiKey)
    url.searchParams.set('units', units)

    if (weatherEnv.debug) {
      console.log('[Weather Plugin] Fetching:', url.toString())
    }

    const response = await fetch(url.toString())

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.statusText}`)
    }

    const data: WeatherAPIResponse = await response.json()

    return transformWeatherData(data)
  } catch (error) {
    throw handleWeatherError(error)
  }
}

/**
 * Transform API response to our data format
 */
export function transformWeatherData(apiData: WeatherAPIResponse): WeatherData {
  return {
    city: apiData.name,
    country: apiData.sys.country,
    temperature: Math.round(apiData.main.temp),
    feelsLike: Math.round(apiData.main.feels_like),
    humidity: apiData.main.humidity,
    description: apiData.weather[0]?.description || 'Unknown',
    icon: apiData.weather[0]?.icon || '01d',
    windSpeed: apiData.wind.speed,
    timestamp: new Date().toISOString()
  }
}

/**
 * Handle weather API errors
 */
export function handleWeatherError(error: unknown): WeatherError {
  if (error instanceof Error) {
    return {
      code: 'FETCH_ERROR',
      message: error.message
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unknown error occurred'
  }
}

/**
 * Validate city name
 */
export function validateCity(city: string): boolean {
  return typeof city === 'string' && city.length > 0 && city.length < 100
}
```

---

## Step 5: Plugin Configuration

### Create `plugin.config.ts`

```typescript
// contents/plugins/weather/plugin.config.ts
import type { PluginConfig } from '@/core/types/plugin'
import { weatherEnv, validateEnvironment } from './lib/server-env'
import {
  fetchWeather,
  transformWeatherData,
  validateCity,
  handleWeatherError
} from './lib/core-utils'

export const weatherPluginConfig: PluginConfig = {
  name: 'weather',
  displayName: 'Weather Plugin',
  version: '1.0.0',
  description: 'Fetch and display weather data from OpenWeather API',
  author: 'Your Name',
  license: 'MIT',
  enabled: weatherEnv.enabled,
  dependencies: [],

  // API exports
  api: {
    fetchWeather,
    transformWeatherData,
    validateCity,
    handleWeatherError
  },

  // Lifecycle hooks
  hooks: {
    async onLoad() {
      console.log('[Weather Plugin] Loading...')

      // Validate environment
      validateEnvironment()

      console.log('[Weather Plugin] Loaded successfully')
      if (weatherEnv.debug) {
        console.log('[Weather Plugin] Config:', {
          apiUrl: weatherEnv.apiUrl,
          defaultCity: weatherEnv.defaultCity,
          cacheDuration: weatherEnv.cacheDuration
        })
      }
    },

    async onActivate() {
      console.log('[Weather Plugin] Activated')
    },

    async onDeactivate() {
      console.log('[Weather Plugin] Deactivated')
    }
  }
}

export default weatherPluginConfig
```

---

## Step 6: API Endpoint

### Create Weather API Route

```typescript
// contents/plugins/weather/api/current/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/core/lib/api/auth/dual-auth'
import { usePlugin } from '@/core/lib/registries/plugin-registry'
import { z } from 'zod'

const WeatherQuerySchema = z.object({
  city: z.string().min(1).max(100),
  units: z.enum(['metric', 'imperial']).optional()
})

export async function GET(request: NextRequest) {
  // Authenticate request
  const authResult = await authenticateRequest(request)
  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Get plugin functions
    const { fetchWeather } = usePlugin('weather')

    // Extract query parameters
    const { searchParams } = new URL(request.url)
    const city = searchParams.get('city')
    const units = searchParams.get('units')

    // Validate query parameters
    const validated = WeatherQuerySchema.parse({ city, units })

    // Fetch weather data
    const weatherData = await fetchWeather(validated)

    return NextResponse.json({
      success: true,
      data: weatherData
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    console.error('[Weather Plugin] API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch weather data' },
      { status: 500 }
    )
  }
}
```

**URL**: `GET /api/v1/plugin/weather/current?city=London&units=metric`

---

## Step 7: React Component

### Create Weather Widget Component

```typescript
// contents/plugins/weather/components/WeatherWidget.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/core/components/ui/card'
import { Button } from '@/core/components/ui/button'
import { Input } from '@/core/components/ui/input'

interface WeatherData {
  city: string
  country: string
  temperature: number
  feelsLike: number
  humidity: number
  description: string
  icon: string
  windSpeed: number
}

export function WeatherWidget() {
  const [city, setCity] = useState('London')
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchWeather = async (cityName: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/v1/plugin/weather/current?city=${encodeURIComponent(cityName)}&units=metric`,
        { credentials: 'include' }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch weather')
      }

      setWeather(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWeather(city)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (city.trim()) {
      fetchWeather(city)
    }
  }

  return (
    <Card className="w-full max-w-md" data-cy="weather-widget">
      <CardHeader>
        <CardTitle>Weather</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Enter city name..."
            data-cy="weather-city-input"
          />
          <Button
            type="submit"
            disabled={loading || !city.trim()}
            data-cy="weather-fetch-button"
          >
            {loading ? 'Loading...' : 'Search'}
          </Button>
        </form>

        {error && (
          <div className="text-sm text-destructive" data-cy="weather-error">
            {error}
          </div>
        )}

        {weather && !error && (
          <div className="space-y-2" data-cy="weather-data">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold">
                  {weather.city}, {weather.country}
                </h3>
                <p className="text-sm text-muted-foreground capitalize">
                  {weather.description}
                </p>
              </div>
              <img
                src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                alt={weather.description}
                className="w-16 h-16"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Temperature</p>
                <p className="text-2xl font-bold">{weather.temperature}°C</p>
              </div>
              <div>
                <p className="text-muted-foreground">Feels Like</p>
                <p className="text-2xl font-bold">{weather.feelsLike}°C</p>
              </div>
              <div>
                <p className="text-muted-foreground">Humidity</p>
                <p className="text-lg">{weather.humidity}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">Wind Speed</p>
                <p className="text-lg">{weather.windSpeed} m/s</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## Step 8: Testing

### Unit Tests

```typescript
// contents/plugins/weather/lib/__tests__/core-utils.test.ts
import { validateCity, transformWeatherData } from '../core-utils'
import type { WeatherAPIResponse } from '../../types/weather.types'

describe('Weather Plugin Core Utils', () => {
  describe('validateCity', () => {
    it('validates correct city names', () => {
      expect(validateCity('London')).toBe(true)
      expect(validateCity('New York')).toBe(true)
    })

    it('rejects invalid city names', () => {
      expect(validateCity('')).toBe(false)
      expect(validateCity('a'.repeat(101))).toBe(false)
    })
  })

  describe('transformWeatherData', () => {
    it('transforms API response correctly', () => {
      const apiResponse: WeatherAPIResponse = {
        name: 'London',
        sys: { country: 'GB' },
        main: { temp: 15.5, feels_like: 14.2, humidity: 75 },
        weather: [{ description: 'cloudy', icon: '04d' }],
        wind: { speed: 5.5 }
      }

      const result = transformWeatherData(apiResponse)

      expect(result.city).toBe('London')
      expect(result.country).toBe('GB')
      expect(result.temperature).toBe(16) // Rounded
      expect(result.feelsLike).toBe(14) // Rounded
      expect(result.humidity).toBe(75)
      expect(result.description).toBe('cloudy')
      expect(result.icon).toBe('04d')
      expect(result.windSpeed).toBe(5.5)
    })
  })
})
```

### E2E Tests

```typescript
// cypress/e2e/plugins/weather-widget.cy.ts
describe('Weather Widget', () => {
  beforeEach(() => {
    cy.session('user-session', () => {
      cy.visit('/login')
      cy.get('[data-cy="email"]').type('test@example.com')
      cy.get('[data-cy="password"]').type('password123')
      cy.get('[data-cy="login-button"]').click()
      cy.url().should('include', '/dashboard')
    })

    cy.visit('/dashboard')
  })

  it('displays weather widget', () => {
    cy.get('[data-cy="weather-widget"]').should('be.visible')
  })

  it('fetches and displays weather data', () => {
    cy.intercept('GET', '/api/v1/plugin/weather/current*', {
      body: {
        success: true,
        data: {
          city: 'London',
          country: 'GB',
          temperature: 15,
          feelsLike: 13,
          humidity: 75,
          description: 'cloudy',
          icon: '04d',
          windSpeed: 5.5,
          timestamp: new Date().toISOString()
        }
      }
    })

    cy.get('[data-cy="weather-city-input"]').clear().type('London')
    cy.get('[data-cy="weather-fetch-button"]').click()

    cy.get('[data-cy="weather-data"]').should('be.visible')
    cy.contains('London, GB').should('be.visible')
    cy.contains('15°C').should('be.visible')
  })

  it('handles errors gracefully', () => {
    cy.intercept('GET', '/api/v1/plugin/weather/current*', {
      statusCode: 500,
      body: { error: 'Failed to fetch weather data' }
    })

    cy.get('[data-cy="weather-city-input"]').clear().type('Invalid')
    cy.get('[data-cy="weather-fetch-button"]').click()

    cy.get('[data-cy="weather-error"]').should('contain', 'Failed to fetch weather data')
  })
})
```

---

## Step 9: Documentation

### Create README

```markdown
# Weather Plugin

Fetch and display weather data from OpenWeather API.

## Features

- ✅ Real-time weather data
- ✅ Support for any city worldwide
- ✅ Metric and imperial units
- ✅ Theme-aware UI components
- ✅ Comprehensive test coverage

## Installation

1. Copy environment variables:
   ```bash
   cp contents/plugins/weather/.env.example contents/plugins/weather/.env
   ```

2. Get free API key from [OpenWeather](https://openweathermap.org/api)

3. Configure your API key in `.env`:
   ```bash
   WEATHER_PLUGIN_API_KEY=your_api_key_here
   ```

4. Rebuild registry:
   ```bash
   pnpm registry:build
   ```

## Usage

### In Server Components

```typescript
import { usePlugin } from '@/core/lib/registries/plugin-registry'

export default async function Page() {
  const { fetchWeather } = usePlugin('weather')
  const weather = await fetchWeather({ city: 'London' })

  return <div>{weather.temperature}°C</div>
}
```

### In Client Components

```typescript
import { WeatherWidget } from '@/contents/plugins/weather/components/WeatherWidget'

export function Dashboard() {
  return <WeatherWidget />
}
```

### API Endpoint

```bash
GET /api/v1/plugin/weather/current?city=London&units=metric
```

## Configuration

See `.env.example` for all configuration options.

## Testing

```bash
# Unit tests
pnpm test:unit contents/plugins/weather

# E2E tests
pnpm test:e2e cypress/e2e/plugins/weather-widget.cy.ts
```

## License

MIT
```

---

## Step 10: Registry Integration

### Rebuild Registry

```bash
# Rebuild plugin registry
pnpm registry:build
```

**Registry will generate**:
- `core/lib/registries/plugin-registry.ts` (server-only)
- `core/lib/registries/plugin-registry.client.ts` (client-safe)

**Verify Registration**:
```bash
# Check plugin is registered
cat core/lib/registries/plugin-registry.ts | grep weather
```

---

## Step 11: Testing the Plugin

### Run Tests

```bash
# Run unit tests
pnpm test:unit contents/plugins/weather

# Run E2E tests
pnpm test:e2e

# Run with coverage
pnpm test:unit --coverage contents/plugins/weather
```

### Manual Testing

```bash
# Start development server
pnpm dev

# Visit: http://localhost:5173/dashboard
# Look for Weather Widget component

# Test API endpoint:
curl -H "Authorization: Bearer your_api_key" \
  "http://localhost:5173/api/v1/plugin/weather/current?city=London"
```

---

## Summary

**You've Successfully Created:**
- ✅ Complete plugin structure
- ✅ Environment configuration
- ✅ TypeScript types and interfaces
- ✅ Core utility functions
- ✅ API endpoint with authentication
- ✅ React component with error handling
- ✅ Comprehensive test coverage
- ✅ Plugin documentation
- ✅ Registry integration

**Plugin Capabilities:**
- Fetch weather data from external API
- Display weather in dashboard UI
- Provide authenticated API endpoint
- Handle errors gracefully
- Support multiple cities
- Theme-aware components
- Full test coverage

**Next Steps:**
1. Add more features (forecasts, maps, alerts)
2. Implement caching for API responses
3. Add more UI components
4. Create plugin-specific entities
5. Publish to plugin marketplace

---

**Congratulations! You've built a complete, production-ready plugin!** 🎉

---

**Related Documentation:**
- [Plugin Introduction](./01-introduction.md)
- [Plugin Structure](./02-plugin-structure.md)
- [Plugin Configuration](./03-plugin-configuration.md)
- [Plugin Registry](./07-plugin-registry.md)
- [Testing Plugins](./08-testing-plugins.md)

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
