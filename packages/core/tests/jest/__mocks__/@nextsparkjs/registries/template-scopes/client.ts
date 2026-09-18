/**
 * Mock Route-Scoped Client Template Registry for Jest tests
 *
 * No theme overrides a page in tests, so every page renders its default.
 */

import type { ComponentType } from 'react'

export const CLIENT_TEMPLATE_REGISTRY: Record<string, any> = {}

export function hasTemplateOverrideClient(_appPath: string): boolean {
  return false
}

export function getClientTemplateComponent(_appPath: string): any | null {
  return null
}

export function getTemplateOrDefaultClient<P>(_path: string, defaultComponent: ComponentType<P>): ComponentType<P> {
  return defaultComponent
}
