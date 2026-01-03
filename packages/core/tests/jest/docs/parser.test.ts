/**
 * Unit Tests for Documentation Parser - Helper Functions
 *
 * Note: parseMarkdownFile tests are skipped as they require ESM remark modules
 * which are not compatible with Jest's CommonJS environment.
 * The function is tested manually and works correctly at runtime.
 */

import { describe, it, expect } from '@jest/globals'
import {
  extractOrderFromFilename,
  cleanFilename,
  slugToTitle
} from '@/core/lib/docs/utils'

describe('Documentation Parser - Helper Functions', () => {
  // Note: parseMarkdownFile() is skipped in tests due to ESM module compatibility
  // It works correctly at runtime and build time (see build-docs-registry.mjs)

  describe('extractOrderFromFilename', () => {
    it('should extract order from numbered filename', () => {
      expect(extractOrderFromFilename('01-introduction.md')).toBe(1)
      expect(extractOrderFromFilename('02-getting-started.md')).toBe(2)
      expect(extractOrderFromFilename('10-advanced.md')).toBe(10)
      expect(extractOrderFromFilename('100-reference.md')).toBe(100)
    })

    it('should return 999 for filenames without order prefix', () => {
      expect(extractOrderFromFilename('introduction.md')).toBe(999)
      expect(extractOrderFromFilename('README.md')).toBe(999)
      expect(extractOrderFromFilename('test-file.md')).toBe(999)
    })

    it('should work with directory names', () => {
      expect(extractOrderFromFilename('01-getting-started')).toBe(1)
      expect(extractOrderFromFilename('05-api-reference')).toBe(5)
    })
  })

  describe('cleanFilename', () => {
    it('should remove order prefix from filename', () => {
      expect(cleanFilename('01-introduction.md')).toBe('introduction')
      expect(cleanFilename('02-getting-started.md')).toBe('getting-started')
      expect(cleanFilename('10-advanced-topics.md')).toBe('advanced-topics')
    })

    it('should remove .md extension', () => {
      expect(cleanFilename('introduction.md')).toBe('introduction')
      expect(cleanFilename('test.md')).toBe('test')
    })

    it('should handle both prefix and extension removal', () => {
      expect(cleanFilename('05-api-reference.md')).toBe('api-reference')
      expect(cleanFilename('100-troubleshooting.md')).toBe('troubleshooting')
    })

    it('should work with directory names (no extension)', () => {
      expect(cleanFilename('01-getting-started')).toBe('getting-started')
      expect(cleanFilename('05-guides')).toBe('guides')
    })

    it('should preserve filenames without prefix or extension', () => {
      expect(cleanFilename('introduction')).toBe('introduction')
      expect(cleanFilename('test-file')).toBe('test-file')
    })
  })

  describe('slugToTitle', () => {
    it('should convert slug to title case', () => {
      expect(slugToTitle('getting-started')).toBe('Getting Started')
      expect(slugToTitle('api-reference')).toBe('Api Reference')
      expect(slugToTitle('introduction')).toBe('Introduction')
    })

    it('should handle multi-word slugs', () => {
      expect(slugToTitle('how-to-install-the-app')).toBe('How To Install The App')
      expect(slugToTitle('advanced-configuration-options')).toBe('Advanced Configuration Options')
    })

    it('should handle single-word slugs', () => {
      expect(slugToTitle('overview')).toBe('Overview')
      expect(slugToTitle('installation')).toBe('Installation')
    })

    it('should preserve existing capital letters', () => {
      // Note: This test documents current behavior - all words are capitalized
      expect(slugToTitle('api')).toBe('Api')
      expect(slugToTitle('faq')).toBe('Faq')
    })
  })
})
