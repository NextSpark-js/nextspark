/**
 * Mock Template Registry (client) for Jest tests
 *
 * No theme overrides a page in tests, so every page renders its default.
 */

import type { ComponentType } from 'react'

export function getTemplateOrDefaultClient<P>(_path: string, defaultComponent: ComponentType<P>): ComponentType<P> {
  return defaultComponent
}
