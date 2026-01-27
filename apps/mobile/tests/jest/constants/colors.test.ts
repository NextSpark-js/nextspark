/**
 * Tests for constants/colors.ts
 * Validates the color palette structure and values
 */

import { Colors } from '@/constants/colors';

describe('Colors constant', () => {
  describe('structure validation', () => {
    it('should export Colors object', () => {
      expect(Colors).toBeDefined();
      expect(typeof Colors).toBe('object');
    });

    it('should have all primary colors', () => {
      expect(Colors).toHaveProperty('primary');
      expect(Colors).toHaveProperty('primaryForeground');
    });

    it('should have all background colors', () => {
      expect(Colors).toHaveProperty('background');
      expect(Colors).toHaveProperty('backgroundSecondary');
      expect(Colors).toHaveProperty('backgroundTertiary');
    });

    it('should have all foreground colors', () => {
      expect(Colors).toHaveProperty('foreground');
      expect(Colors).toHaveProperty('foregroundSecondary');
      expect(Colors).toHaveProperty('foregroundMuted');
    });

    it('should have all border colors', () => {
      expect(Colors).toHaveProperty('border');
      expect(Colors).toHaveProperty('borderSecondary');
    });

    it('should have accent colors', () => {
      expect(Colors).toHaveProperty('accent');
      expect(Colors).toHaveProperty('accentForeground');
    });

    it('should have destructive colors', () => {
      expect(Colors).toHaveProperty('destructive');
      expect(Colors).toHaveProperty('destructiveForeground');
    });

    it('should have success colors', () => {
      expect(Colors).toHaveProperty('success');
      expect(Colors).toHaveProperty('successForeground');
    });

    it('should have card colors', () => {
      expect(Colors).toHaveProperty('card');
      expect(Colors).toHaveProperty('cardForeground');
    });

    it('should have status colors', () => {
      expect(Colors).toHaveProperty('statusTodo');
      expect(Colors).toHaveProperty('statusInProgress');
      expect(Colors).toHaveProperty('statusReview');
      expect(Colors).toHaveProperty('statusDone');
      expect(Colors).toHaveProperty('statusBlocked');
    });

    it('should have priority colors', () => {
      expect(Colors).toHaveProperty('priorityLow');
      expect(Colors).toHaveProperty('priorityMedium');
      expect(Colors).toHaveProperty('priorityHigh');
      expect(Colors).toHaveProperty('priorityUrgent');
    });
  });

  describe('hex color format validation', () => {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

    it('should have valid hex format for all colors', () => {
      Object.entries(Colors).forEach(([key, value]) => {
        expect(value).toMatch(hexColorRegex);
      });
    });
  });

  describe('theme consistency', () => {
    it('should have black primary color (#000000)', () => {
      expect(Colors.primary).toBe('#000000');
    });

    it('should have white primary foreground (#FFFFFF)', () => {
      expect(Colors.primaryForeground).toBe('#FFFFFF');
    });

    it('should have white background (#FFFFFF)', () => {
      expect(Colors.background).toBe('#FFFFFF');
    });

    it('should have distinct status colors', () => {
      const statusColors = [
        Colors.statusTodo,
        Colors.statusInProgress,
        Colors.statusReview,
        Colors.statusDone,
        Colors.statusBlocked,
      ];
      const uniqueColors = new Set(statusColors);
      expect(uniqueColors.size).toBe(statusColors.length);
    });

    it('should have distinct priority colors', () => {
      const priorityColors = [
        Colors.priorityLow,
        Colors.priorityMedium,
        Colors.priorityHigh,
        Colors.priorityUrgent,
      ];
      const uniqueColors = new Set(priorityColors);
      expect(uniqueColors.size).toBe(priorityColors.length);
    });
  });

  describe('color count', () => {
    it('should have expected number of colors (27)', () => {
      expect(Object.keys(Colors).length).toBe(27);
    });
  });
});
