import { describe, it, expect } from 'vitest';
import { validatePropertyData, ModuleSchema } from '../services/module-registry.service';

/**
 * Apartment module validation tests
 * Tests validation logic for Apartment-specific fields
 */

const apartmentSchema: ModuleSchema = {
  fields: [
    { name: 'bedrooms', type: 'number', required: true },
    { name: 'bathrooms', type: 'number', required: true },
    { name: 'sqft', type: 'number', required: true },
    { name: 'floor', type: 'number', required: false },
    { name: 'building_name', type: 'string', required: false },
    { name: 'amenities', type: 'json', required: false },
    { name: 'parking_spaces', type: 'number', required: false },
  ],
  indexes: ['bedrooms', 'bathrooms', 'sqft'],
};

describe('Apartment Module Validation', () => {
  describe('Required Fields', () => {
    it('should validate apartment with all required fields', () => {
      const apartmentData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation when bedrooms is missing', () => {
      const apartmentData = {
        bathrooms: 2,
        sqft: 1200,
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field 'bedrooms' is required");
    });

    it('should fail validation when bathrooms is missing', () => {
      const apartmentData = {
        bedrooms: 2,
        sqft: 1200,
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field 'bathrooms' is required");
    });

    it('should fail validation when sqft is missing', () => {
      const apartmentData = {
        bedrooms: 2,
        bathrooms: 2,
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field 'sqft' is required");
    });

    it('should fail validation when multiple required fields are missing', () => {
      const apartmentData = {
        bedrooms: 2,
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field 'bathrooms' is required");
      expect(result.errors).toContain("Field 'sqft' is required");
    });
  });

  describe('Optional Fields', () => {
    it('should validate apartment with optional floor field', () => {
      const apartmentData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        floor: 5,
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate apartment with optional building_name field', () => {
      const apartmentData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        building_name: 'Sunset Towers',
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate apartment with optional parking_spaces field', () => {
      const apartmentData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        parking_spaces: 1,
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate apartment with optional amenities field', () => {
      const apartmentData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        amenities: {
          pool: true,
          gym: true,
          parking: true,
          balcony: true,
        },
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate apartment with all optional fields', () => {
      const apartmentData = {
        bedrooms: 3,
        bathrooms: 2.5,
        sqft: 1800,
        floor: 10,
        building_name: 'Luxury Heights',
        parking_spaces: 2,
        amenities: {
          pool: true,
          gym: true,
          concierge: true,
          rooftop: true,
        },
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate apartment without any optional fields', () => {
      const apartmentData = {
        bedrooms: 1,
        bathrooms: 1,
        sqft: 600,
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Field Type Validation', () => {
    it('should fail validation when bedrooms is not a number', () => {
      const apartmentData = {
        bedrooms: '2',
        bathrooms: 2,
        sqft: 1200,
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field 'bedrooms' must be a number");
    });

    it('should fail validation when bathrooms is not a number', () => {
      const apartmentData = {
        bedrooms: 2,
        bathrooms: 'two',
        sqft: 1200,
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field 'bathrooms' must be a number");
    });

    it('should fail validation when sqft is not a number', () => {
      const apartmentData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: '1200',
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field 'sqft' must be a number");
    });

    it('should fail validation when floor is not a number', () => {
      const apartmentData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        floor: 'fifth',
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field 'floor' must be a number");
    });

    it('should fail validation when building_name is not a string', () => {
      const apartmentData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        building_name: 123,
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field 'building_name' must be a string");
    });

    it('should fail validation when parking_spaces is not a number', () => {
      const apartmentData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        parking_spaces: 'one',
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field 'parking_spaces' must be a number");
    });
  });

  describe('Edge Cases', () => {
    it('should validate apartment with decimal bathrooms (e.g., 2.5)', () => {
      const apartmentData = {
        bedrooms: 2,
        bathrooms: 2.5,
        sqft: 1200,
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate apartment with zero bedrooms (studio)', () => {
      const apartmentData = {
        bedrooms: 0,
        bathrooms: 1,
        sqft: 500,
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate apartment with negative floor (basement)', () => {
      const apartmentData = {
        bedrooms: 1,
        bathrooms: 1,
        sqft: 700,
        floor: -1,
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate apartment with empty string building_name', () => {
      const apartmentData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        building_name: '',
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate apartment with empty amenities object', () => {
      const apartmentData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        amenities: {},
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate apartment with amenities as array', () => {
      const apartmentData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        amenities: ['pool', 'gym', 'parking'],
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate apartment with zero parking_spaces', () => {
      const apartmentData = {
        bedrooms: 1,
        bathrooms: 1,
        sqft: 600,
        parking_spaces: 0,
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Multiple Validation Errors', () => {
    it('should report multiple type errors', () => {
      const apartmentData = {
        bedrooms: '2',
        bathrooms: 'two',
        sqft: '1200',
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContain("Field 'bedrooms' must be a number");
      expect(result.errors).toContain("Field 'bathrooms' must be a number");
      expect(result.errors).toContain("Field 'sqft' must be a number");
    });

    it('should report both missing and type errors', () => {
      const apartmentData = {
        bedrooms: '2',
        sqft: 1200,
      };

      const result = validatePropertyData(apartmentData, apartmentSchema);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      expect(result.errors).toContain("Field 'bathrooms' is required");
      expect(result.errors).toContain("Field 'bedrooms' must be a number");
    });
  });

  describe('Invalid Input', () => {
    it('should fail validation when input is not an object', () => {
      const result = validatePropertyData('not an object', apartmentSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Module data must be an object');
    });

    it('should fail validation when input is null', () => {
      const result = validatePropertyData(null, apartmentSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Module data must be an object');
    });

    it('should fail validation when input is an array', () => {
      const result = validatePropertyData([], apartmentSchema);

      expect(result.valid).toBe(false);
      // Arrays are objects in JavaScript, so they pass the object check
      // but fail validation because required fields are missing
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
