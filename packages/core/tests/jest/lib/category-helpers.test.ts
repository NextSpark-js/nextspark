/**
 * @jest-environment jsdom
 */

import { describe, test, expect } from '@jest/globals'
import {
  CATEGORY_CONFIG,
  getCategoryConfig,
  getCategoryIcon,
  getCategoryColors,
  type CategoryKey,
} from '@/core/components/dashboard/block-editor/category-helpers'
import {
  Heading,
  LayoutGrid,
  Megaphone,
  BarChart3,
  Component,
} from 'lucide-react'

describe('Category Helpers', () => {
  describe('getCategoryConfig', () => {
    test('returns hero config for hero category', () => {
      const config = getCategoryConfig('hero')

      expect(config).toEqual({
        icon: Heading,
        bgColor: 'bg-indigo-50',
        textColor: 'text-indigo-600',
        borderColor: 'border-indigo-200',
      })
    })

    test('returns content config for content category', () => {
      const config = getCategoryConfig('content')

      expect(config).toEqual({
        icon: LayoutGrid,
        bgColor: 'bg-emerald-50',
        textColor: 'text-emerald-600',
        borderColor: 'border-emerald-200',
      })
    })

    test('returns cta config for cta category', () => {
      const config = getCategoryConfig('cta')

      expect(config).toEqual({
        icon: Megaphone,
        bgColor: 'bg-orange-50',
        textColor: 'text-orange-600',
        borderColor: 'border-orange-200',
      })
    })

    test('returns stats config for stats category', () => {
      const config = getCategoryConfig('stats')

      expect(config).toEqual({
        icon: BarChart3,
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-600',
        borderColor: 'border-blue-200',
      })
    })

    test('returns default config for unknown category', () => {
      const config = getCategoryConfig('unknown-category')

      expect(config).toEqual({
        icon: Component,
        bgColor: 'bg-slate-50',
        textColor: 'text-slate-600',
        borderColor: 'border-slate-200',
      })
    })
  })

  describe('getCategoryIcon', () => {
    test('returns correct icon for each category', () => {
      expect(getCategoryIcon('hero')).toBe(Heading)
      expect(getCategoryIcon('content')).toBe(LayoutGrid)
      expect(getCategoryIcon('cta')).toBe(Megaphone)
      expect(getCategoryIcon('stats')).toBe(BarChart3)
      expect(getCategoryIcon('unknown')).toBe(Component)
    })
  })

  describe('getCategoryColors', () => {
    test('returns correct colors for each category', () => {
      const heroColors = getCategoryColors('hero')
      expect(heroColors).toEqual({
        bg: 'bg-indigo-50',
        text: 'text-indigo-600',
        border: 'border-indigo-200',
      })

      const contentColors = getCategoryColors('content')
      expect(contentColors).toEqual({
        bg: 'bg-emerald-50',
        text: 'text-emerald-600',
        border: 'border-emerald-200',
      })

      const ctaColors = getCategoryColors('cta')
      expect(ctaColors).toEqual({
        bg: 'bg-orange-50',
        text: 'text-orange-600',
        border: 'border-orange-200',
      })

      const statsColors = getCategoryColors('stats')
      expect(statsColors).toEqual({
        bg: 'bg-blue-50',
        text: 'text-blue-600',
        border: 'border-blue-200',
      })

      const unknownColors = getCategoryColors('random')
      expect(unknownColors).toEqual({
        bg: 'bg-slate-50',
        text: 'text-slate-600',
        border: 'border-slate-200',
      })
    })
  })

  describe('CATEGORY_CONFIG', () => {
    test('has all required properties for each category', () => {
      const categories: CategoryKey[] = ['hero', 'content', 'cta', 'stats', 'default']

      categories.forEach((category) => {
        const config = CATEGORY_CONFIG[category]

        expect(config).toHaveProperty('icon')
        expect(config).toHaveProperty('bgColor')
        expect(config).toHaveProperty('textColor')
        expect(config).toHaveProperty('borderColor')

        expect(typeof config.bgColor).toBe('string')
        expect(typeof config.textColor).toBe('string')
        expect(typeof config.borderColor).toBe('string')
        // Icon should be defined (it's a React component/object)
        expect(config.icon).toBeDefined()
      })
    })
  })
})
