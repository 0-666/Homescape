import { describe, it, expect } from 'vitest';
import {
  apartmentModuleSchema,
  createApartmentValidator,
  ApartmentModuleData,
  APARTMENT_MODULE_TYPE,
  APARTMENT_MODULE_VERSION,
  apartmentModuleRegistration,
} from './apartment.module';

/**
 * Integration tests for Apartment module
 * Tests the complete workflow of using the apartment module
 */

describe('Apartment Module Integration', () => {
  describe('Module Configuration', () => {
    it('should have correct module type', () => {
      expect(APARTMENT_MODULE_TYPE).toBe('APARTMENT');
    });

    it('should have correct module version', () => {
      expect(APARTMENT_MODULE_VERSION).toBe('1.0.0');
    });

    it('should have valid schema with all required fields', () => {
      expect(apartmentModuleSchema.fields).toBeDefined();
      expect(apartmentModuleSchema.fields.length).toBe(7);

      const requiredFields = apartmentModuleSchema.fields.filter(f => f.required);
      expect(requiredFields).toHaveLength(3);
      expect(requiredFields.map(f => f.name)).toEqual(['bedrooms', 'bathrooms', 'sqft']);
    });

    it('should have valid schema with all optional fields', () => {
      const optionalFields = apartmentModuleSchema.fields.filter(f => !f.required);
      expect(optionalFields).toHaveLength(4);
      expect(optionalFields.map(f => f.name)).toEqual([
        'floor',
        'building_name',
        'amenities',
        'parking_spaces',
      ]);
    });

    it('should have indexes defined', () => {
      expect(apartmentModuleSchema.indexes).toBeDefined();
      expect(apartmentModuleSchema.indexes).toEqual(['bedrooms', 'bathrooms', 'sqft']);
    });

    it('should have valid registration object', () => {
      expect(apartmentModuleRegistration).toEqual({
        type: 'APARTMENT',
        version: '1.0.0',
        schema: apartmentModuleSchema,
        active: true,
      });
    });
  });

  describe('Apartment Validator', () => {
    it('should create a validator instance', () => {
      const validator = createApartmentValidator();
      expect(validator).toBeDefined();
      expect(validator.validate).toBeDefined();
      expect(typeof validator.validate).toBe('function');
    });

    it('should validate valid apartment data', () => {
      const validator = createApartmentValidator();
      const apartmentData: ApartmentModuleData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
      };

      const result = validator.validate(apartmentData);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate apartment with all fields', () => {
      const validator = createApartmentValidator();
      const apartmentData: ApartmentModuleData = {
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
        },
      };

      const result = validator.validate(apartmentData);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid apartment data', () => {
      const validator = createApartmentValidator();
      const invalidData = {
        bedrooms: 2,
        // missing bathrooms and sqft
      };

      const result = validator.validate(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('TypeScript Type Safety', () => {
    it('should enforce required fields at compile time', () => {
      // This test verifies TypeScript type checking
      const validApartment: ApartmentModuleData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
      };

      expect(validApartment.bedrooms).toBe(2);
      expect(validApartment.bathrooms).toBe(2);
      expect(validApartment.sqft).toBe(1200);
    });

    it('should allow optional fields', () => {
      const apartmentWithOptionals: ApartmentModuleData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        floor: 5,
        building_name: 'Test Building',
        parking_spaces: 1,
        amenities: { pool: true },
      };

      expect(apartmentWithOptionals.floor).toBe(5);
      expect(apartmentWithOptionals.building_name).toBe('Test Building');
      expect(apartmentWithOptionals.parking_spaces).toBe(1);
      expect(apartmentWithOptionals.amenities).toEqual({ pool: true });
    });
  });

  describe('Real-world Scenarios', () => {
    it('should validate studio apartment (0 bedrooms)', () => {
      const validator = createApartmentValidator();
      const studio: ApartmentModuleData = {
        bedrooms: 0,
        bathrooms: 1,
        sqft: 500,
        building_name: 'Downtown Studios',
      };

      const result = validator.validate(studio);
      expect(result.valid).toBe(true);
    });

    it('should validate luxury penthouse', () => {
      const validator = createApartmentValidator();
      const penthouse: ApartmentModuleData = {
        bedrooms: 4,
        bathrooms: 3.5,
        sqft: 3500,
        floor: 25,
        building_name: 'Sky Tower',
        parking_spaces: 3,
        amenities: {
          pool: true,
          gym: true,
          concierge: true,
          rooftop: true,
          spa: true,
          privateElevator: true,
        },
      };

      const result = validator.validate(penthouse);
      expect(result.valid).toBe(true);
    });

    it('should validate basement apartment (negative floor)', () => {
      const validator = createApartmentValidator();
      const basement: ApartmentModuleData = {
        bedrooms: 1,
        bathrooms: 1,
        sqft: 700,
        floor: -1,
        building_name: 'Garden Apartments',
      };

      const result = validator.validate(basement);
      expect(result.valid).toBe(true);
    });

    it('should validate apartment with amenities as array', () => {
      const validator = createApartmentValidator();
      const apartment: ApartmentModuleData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        amenities: ['pool', 'gym', 'parking', 'laundry'],
      };

      const result = validator.validate(apartment);
      expect(result.valid).toBe(true);
    });

    it('should reject apartment with missing required fields', () => {
      const validator = createApartmentValidator();
      const incomplete = {
        bedrooms: 2,
        building_name: 'Test Building',
        // missing bathrooms and sqft
      };

      const result = validator.validate(incomplete);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field 'bathrooms' is required");
      expect(result.errors).toContain("Field 'sqft' is required");
    });

    it('should reject apartment with invalid field types', () => {
      const validator = createApartmentValidator();
      const invalidTypes = {
        bedrooms: '2', // should be number
        bathrooms: 2,
        sqft: 1200,
      };

      const result = validator.validate(invalidTypes);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field 'bedrooms' must be a number");
    });
  });
});
