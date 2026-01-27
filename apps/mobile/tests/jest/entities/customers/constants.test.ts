/**
 * Tests for entities/customers/constants.ts
 * Validates customer day labels (Spanish)
 */

import { DAY_LABELS } from '@/entities/customers/constants';

describe('Customer constants', () => {
  describe('DAY_LABELS', () => {
    it('should have exactly 5 working days', () => {
      expect(Object.keys(DAY_LABELS).length).toBe(5);
    });

    it('should have all required day keys', () => {
      expect(DAY_LABELS).toHaveProperty('lun');
      expect(DAY_LABELS).toHaveProperty('mar');
      expect(DAY_LABELS).toHaveProperty('mie');
      expect(DAY_LABELS).toHaveProperty('jue');
      expect(DAY_LABELS).toHaveProperty('vie');
    });

    it('should have Spanish day names', () => {
      expect(DAY_LABELS.lun).toBe('Lunes');
      expect(DAY_LABELS.mar).toBe('Martes');
      expect(DAY_LABELS.mie).toBe('Miércoles');
      expect(DAY_LABELS.jue).toBe('Jueves');
      expect(DAY_LABELS.vie).toBe('Viernes');
    });

    it('should have non-empty label strings', () => {
      Object.values(DAY_LABELS).forEach((label) => {
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      });
    });

    it('should have distinct day names', () => {
      const labels = Object.values(DAY_LABELS);
      const uniqueLabels = new Set(labels);
      expect(uniqueLabels.size).toBe(labels.length);
    });

    it('should not include weekend days', () => {
      expect(DAY_LABELS).not.toHaveProperty('sab');
      expect(DAY_LABELS).not.toHaveProperty('dom');
    });
  });
});
