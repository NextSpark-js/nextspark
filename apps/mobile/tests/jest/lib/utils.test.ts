/**
 * Tests for lib/utils.ts
 * Tests the cn() utility function for merging Tailwind classes
 */

import { cn } from '@/lib/utils';

describe('cn() utility function', () => {
  describe('simple class merging', () => {
    it('should merge multiple string classes', () => {
      expect(cn('text-sm', 'font-bold')).toBe('text-sm font-bold');
    });

    it('should return single class unchanged', () => {
      expect(cn('text-sm')).toBe('text-sm');
    });

    it('should return empty string for no arguments', () => {
      expect(cn()).toBe('');
    });
  });

  describe('tailwind conflict resolution', () => {
    it('should resolve conflicting text sizes (last wins)', () => {
      expect(cn('text-sm', 'text-lg')).toBe('text-lg');
    });

    it('should resolve conflicting padding', () => {
      expect(cn('p-2', 'p-4')).toBe('p-4');
    });

    it('should resolve conflicting background colors', () => {
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
    });

    it('should not conflict different padding axes', () => {
      const result = cn('px-2', 'py-4');
      expect(result).toContain('px-2');
      expect(result).toContain('py-4');
    });
  });

  describe('falsy value handling', () => {
    it('should filter out undefined values', () => {
      expect(cn('text-sm', undefined, 'font-bold')).toBe('text-sm font-bold');
    });

    it('should filter out null values', () => {
      expect(cn('text-sm', null, 'font-bold')).toBe('text-sm font-bold');
    });

    it('should filter out false values', () => {
      expect(cn('text-sm', false, 'font-bold')).toBe('text-sm font-bold');
    });

    it('should filter out empty strings', () => {
      expect(cn('text-sm', '', 'font-bold')).toBe('text-sm font-bold');
    });
  });

  describe('conditional classes', () => {
    it('should handle conditional boolean expressions', () => {
      const isActive = true;
      expect(cn('base-class', isActive && 'active-class')).toBe(
        'base-class active-class'
      );
    });

    it('should filter false conditionals', () => {
      const isActive = false;
      expect(cn('base-class', isActive && 'active-class')).toBe('base-class');
    });

    it('should handle object syntax with boolean values', () => {
      expect(
        cn({
          'text-sm': true,
          'font-bold': true,
          'text-red-500': false,
        })
      ).toBe('text-sm font-bold');
    });
  });

  describe('array inputs', () => {
    it('should handle array of classes', () => {
      expect(cn(['text-sm', 'font-bold'])).toBe('text-sm font-bold');
    });

    it('should handle mixed arrays and strings', () => {
      expect(cn('base', ['text-sm', 'font-bold'], 'extra')).toBe(
        'base text-sm font-bold extra'
      );
    });

    it('should handle nested arrays', () => {
      expect(cn(['text-sm', ['font-bold', 'text-center']])).toBe(
        'text-sm font-bold text-center'
      );
    });
  });
});
