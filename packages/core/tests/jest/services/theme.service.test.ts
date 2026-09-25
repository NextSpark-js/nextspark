/**
 * Unit Tests - Theme Service
 *
 * Tests the ThemeService static methods that provide theme registry
 * operations and queries.
 *
 * Test Coverage:
 * - getCurrentEntry() / getCurrentName() / getCurrent() - the root-first
 *   project's own registry entry (the compiler emits exactly one)
 * - getCurrentDashboardConfig() / getCurrentAppConfig() / getCurrentDevConfig()
 *
 * The name-parameterised multi-theme lookups (getEntry, getDashboardConfig,
 * getWithEntities, getUsingPlugin, getPluginUsage, exists, getNames, getCount,
 * getMetadata, and their backward-compat aliases) were removed as dead code:
 * root-first projects have exactly one entry, so nothing in the codebase
 * selected among themes by name anymore (#207).
 */

import { ThemeService } from '@/core/lib/services/theme.service'

describe('ThemeService', () => {
  describe('getCurrentEntry', () => {
    it('should return the sole root-first registry entry', () => {
      const entry = ThemeService.getCurrentEntry()

      expect(entry).toBeDefined()
      expect(entry?.name).toBe('default')
      expect(entry?.config).toBeDefined()
    })
  })

  describe('getCurrentName', () => {
    it('should return the current project theme name', () => {
      expect(ThemeService.getCurrentName()).toBe(ThemeService.getCurrentEntry()?.name)
    })
  })

  describe('getCurrent', () => {
    it('should return the current project ThemeConfig', () => {
      expect(ThemeService.getCurrent()).toEqual(ThemeService.getCurrentEntry()?.config)
    })
  })

  describe('getCurrentDashboardConfig', () => {
    it('should return the current entry dashboard config', () => {
      expect(ThemeService.getCurrentDashboardConfig()).toEqual(ThemeService.getCurrentEntry()?.dashboardConfig)
    })
  })

  describe('getCurrentAppConfig', () => {
    it('should return the current entry app config', () => {
      expect(ThemeService.getCurrentAppConfig()).toEqual(ThemeService.getCurrentEntry()?.appConfig)
    })
  })

  describe('getCurrentDevConfig', () => {
    it('should return the current entry dev config, or null when absent', () => {
      expect(ThemeService.getCurrentDevConfig()).toEqual(ThemeService.getCurrentEntry()?.devConfig ?? null)
    })
  })
})
