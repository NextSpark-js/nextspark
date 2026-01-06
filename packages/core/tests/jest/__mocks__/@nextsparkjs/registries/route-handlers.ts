/**
 * Mock Route Handlers Registry for Jest tests
 */

export const THEME_ROUTE_HANDLERS: Record<string, any> = {}

export const PLUGIN_ROUTE_HANDLERS: Record<string, any> = {}

export const API_ROUTES_SUMMARY: any[] = []

export interface RouteHandler {
  path: string
  method: string
  handler: any
}

export interface ApiRouteEntry {
  path: string
  methods: string[]
}
