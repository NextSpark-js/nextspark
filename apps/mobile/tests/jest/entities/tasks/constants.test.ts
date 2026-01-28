/**
 * Tests for entities/tasks/constants.ts
 * Validates task status and priority constants
 */

import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
} from '@/entities/tasks/constants';

describe('Task constants', () => {
  describe('STATUS_LABELS', () => {
    it('should have exactly 5 status labels', () => {
      expect(Object.keys(STATUS_LABELS).length).toBe(5);
    });

    it('should have all required statuses', () => {
      expect(STATUS_LABELS).toHaveProperty('todo');
      expect(STATUS_LABELS).toHaveProperty('in-progress');
      expect(STATUS_LABELS).toHaveProperty('review');
      expect(STATUS_LABELS).toHaveProperty('done');
      expect(STATUS_LABELS).toHaveProperty('blocked');
    });

    it('should have non-empty label strings', () => {
      Object.values(STATUS_LABELS).forEach((label) => {
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      });
    });

    it('should have expected label values', () => {
      expect(STATUS_LABELS['todo']).toBe('To Do');
      expect(STATUS_LABELS['in-progress']).toBe('In Progress');
      expect(STATUS_LABELS['review']).toBe('In Review');
      expect(STATUS_LABELS['done']).toBe('Done');
      expect(STATUS_LABELS['blocked']).toBe('Blocked');
    });
  });

  describe('PRIORITY_LABELS', () => {
    it('should have exactly 4 priority levels', () => {
      expect(Object.keys(PRIORITY_LABELS).length).toBe(4);
    });

    it('should have all required priorities', () => {
      expect(PRIORITY_LABELS).toHaveProperty('low');
      expect(PRIORITY_LABELS).toHaveProperty('medium');
      expect(PRIORITY_LABELS).toHaveProperty('high');
      expect(PRIORITY_LABELS).toHaveProperty('urgent');
    });

    it('should have non-empty label strings', () => {
      Object.values(PRIORITY_LABELS).forEach((label) => {
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      });
    });

    it('should have expected label values', () => {
      expect(PRIORITY_LABELS.low).toBe('Low');
      expect(PRIORITY_LABELS.medium).toBe('Medium');
      expect(PRIORITY_LABELS.high).toBe('High');
      expect(PRIORITY_LABELS.urgent).toBe('Urgent');
    });
  });

  describe('STATUS_COLORS', () => {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

    it('should have 5 status colors', () => {
      expect(Object.keys(STATUS_COLORS).length).toBe(5);
    });

    it('should have all required status colors', () => {
      expect(STATUS_COLORS).toHaveProperty('todo');
      expect(STATUS_COLORS).toHaveProperty('in-progress');
      expect(STATUS_COLORS).toHaveProperty('review');
      expect(STATUS_COLORS).toHaveProperty('done');
      expect(STATUS_COLORS).toHaveProperty('blocked');
    });

    it('should have valid hex color format', () => {
      Object.values(STATUS_COLORS).forEach((color) => {
        expect(color).toMatch(hexColorRegex);
      });
    });

    it('should have distinct colors for each status', () => {
      const colors = Object.values(STATUS_COLORS);
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(colors.length);
    });
  });

  describe('PRIORITY_COLORS', () => {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

    it('should have 4 priority colors', () => {
      expect(Object.keys(PRIORITY_COLORS).length).toBe(4);
    });

    it('should have all required priority colors', () => {
      expect(PRIORITY_COLORS).toHaveProperty('low');
      expect(PRIORITY_COLORS).toHaveProperty('medium');
      expect(PRIORITY_COLORS).toHaveProperty('high');
      expect(PRIORITY_COLORS).toHaveProperty('urgent');
    });

    it('should have valid hex color format', () => {
      Object.values(PRIORITY_COLORS).forEach((color) => {
        expect(color).toMatch(hexColorRegex);
      });
    });
  });

  describe('consistency between labels and colors', () => {
    it('should have matching keys for status labels and colors', () => {
      const labelKeys = Object.keys(STATUS_LABELS).sort();
      const colorKeys = Object.keys(STATUS_COLORS).sort();
      expect(labelKeys).toEqual(colorKeys);
    });

    it('should have matching keys for priority labels and colors', () => {
      const labelKeys = Object.keys(PRIORITY_LABELS).sort();
      const colorKeys = Object.keys(PRIORITY_COLORS).sort();
      expect(labelKeys).toEqual(colorKeys);
    });
  });
});
