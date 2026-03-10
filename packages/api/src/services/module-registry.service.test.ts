import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as moduleRegistry from './module-registry.service';
import { query } from '../db';

// Mock the database module
vi.mock('../db', () => ({
  query: vi.fn(),
}));

const mockQuery = vi.mocked(query);

describe('Module Registry Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registerModule', () => {
    it('should register a new module with valid schema', async () => {
      const input = {
        type: 'RENTAL',
        version: '1.0.0',
        schema: {
          fields: [
            { name: 'bedrooms', type: 'number' as const, required: true },
            { name: 'monthly_rent', type: 'number' as const, required: true },
          ],
        },
        active: true,
      };

      const mockResult = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'RENTAL',
        version: '1.0.0',
        schema: input.schema,
        active: true,
        createdAt: new Date(),
      };

      // Mock the check for existing module
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);
      // Mock the insert
      mockQuery.mockResolvedValueOnce({ rows: [mockResult] } as any);

      const result = await moduleRegistry.registerModule(input);

      expect(result).toEqual(mockResult);
      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        'SELECT id FROM property_modules WHERE type = $1',
        ['RENTAL']
      );
    });

    it('should throw error if module type already exists', async () => {
      const input = {
        type: 'APARTMENT',
        version: '1.0.0',
        schema: {
          fields: [{ name: 'bedrooms', type: 'number' as const, required: true }],
        },
      };

      // Mock existing module
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'existing-id' }],
      } as any);

      await expect(moduleRegistry.registerModule(input)).rejects.toThrow(
        "Module type 'APARTMENT' already exists"
      );
    });

    it('should throw error for invalid module type format', async () => {
      const input = {
        type: 'invalid-type',
        version: '1.0.0',
        schema: {
          fields: [{ name: 'bedrooms', type: 'number' as const, required: true }],
        },
      };

      await expect(moduleRegistry.registerModule(input)).rejects.toThrow();
    });

    it('should throw error for invalid version format', async () => {
      const input = {
        type: 'RENTAL',
        version: 'v1.0',
        schema: {
          fields: [{ name: 'bedrooms', type: 'number' as const, required: true }],
        },
      };

      await expect(moduleRegistry.registerModule(input)).rejects.toThrow();
    });

    it('should throw error for empty fields array', async () => {
      const input = {
        type: 'RENTAL',
        version: '1.0.0',
        schema: {
          fields: [],
        },
      };

      await expect(moduleRegistry.registerModule(input)).rejects.toThrow();
    });

    it('should throw error for invalid field type', async () => {
      const input = {
        type: 'RENTAL',
        version: '1.0.0',
        schema: {
          fields: [{ name: 'bedrooms', type: 'invalid' as any, required: true }],
        },
      };

      await expect(moduleRegistry.registerModule(input)).rejects.toThrow();
    });
  });

  describe('getModule', () => {
    it('should return module by type', async () => {
      const mockModule = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'APARTMENT',
        version: '1.0.0',
        schema: {
          fields: [{ name: 'bedrooms', type: 'number', required: true }],
        },
        active: true,
        createdAt: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockModule] } as any);

      const result = await moduleRegistry.getModule('APARTMENT');

      expect(result).toEqual(mockModule);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, type, version, schema, active'),
        ['APARTMENT']
      );
    });

    it('should return null if module not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await moduleRegistry.getModule('NONEXISTENT');

      expect(result).toBeNull();
    });
  });

  describe('getModuleById', () => {
    it('should return module by ID', async () => {
      const mockModule = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'APARTMENT',
        version: '1.0.0',
        schema: {
          fields: [{ name: 'bedrooms', type: 'number', required: true }],
        },
        active: true,
        createdAt: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockModule] } as any);

      const result = await moduleRegistry.getModuleById('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toEqual(mockModule);
    });

    it('should return null if module not found by ID', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await moduleRegistry.getModuleById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('listModules', () => {
    it('should return all modules when activeOnly is false', async () => {
      const mockModules = [
        {
          id: '1',
          type: 'APARTMENT',
          version: '1.0.0',
          schema: { fields: [] },
          active: true,
          createdAt: new Date(),
        },
        {
          id: '2',
          type: 'RENTAL',
          version: '1.0.0',
          schema: { fields: [] },
          active: false,
          createdAt: new Date(),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockModules } as any);

      const result = await moduleRegistry.listModules(false);

      expect(result).toEqual(mockModules);
      expect(result).toHaveLength(2);
    });

    it('should return only active modules when activeOnly is true', async () => {
      const mockModules = [
        {
          id: '1',
          type: 'APARTMENT',
          version: '1.0.0',
          schema: { fields: [] },
          active: true,
          createdAt: new Date(),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockModules } as any);

      const result = await moduleRegistry.listModules(true);

      expect(result).toEqual(mockModules);
      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE active = true'),
        []
      );
    });

    it('should return empty array when no modules exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await moduleRegistry.listModules();

      expect(result).toEqual([]);
    });
  });

  describe('updateModule', () => {
    it('should update module version', async () => {
      const existingModule = {
        id: '1',
        type: 'APARTMENT',
        version: '1.0.0',
        schema: { fields: [] },
        active: true,
        createdAt: new Date(),
      };

      const updatedModule = { ...existingModule, version: '1.1.0' };

      // Mock getModule call
      mockQuery.mockResolvedValueOnce({ rows: [existingModule] } as any);
      // Mock update call
      mockQuery.mockResolvedValueOnce({ rows: [updatedModule] } as any);

      const result = await moduleRegistry.updateModule('APARTMENT', { version: '1.1.0' });

      expect(result.version).toBe('1.1.0');
    });

    it('should update module schema', async () => {
      const existingModule = {
        id: '1',
        type: 'APARTMENT',
        version: '1.0.0',
        schema: { fields: [{ name: 'bedrooms', type: 'number', required: true }] },
        active: true,
        createdAt: new Date(),
      };

      const newSchema = {
        fields: [
          { name: 'bedrooms', type: 'number' as const, required: true },
          { name: 'bathrooms', type: 'number' as const, required: true },
        ],
      };

      const updatedModule = { ...existingModule, schema: newSchema };

      mockQuery.mockResolvedValueOnce({ rows: [existingModule] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [updatedModule] } as any);

      const result = await moduleRegistry.updateModule('APARTMENT', { schema: newSchema });

      expect(result.schema.fields).toHaveLength(2);
    });

    it('should update module active status', async () => {
      const existingModule = {
        id: '1',
        type: 'APARTMENT',
        version: '1.0.0',
        schema: { fields: [] },
        active: true,
        createdAt: new Date(),
      };

      const updatedModule = { ...existingModule, active: false };

      mockQuery.mockResolvedValueOnce({ rows: [existingModule] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [updatedModule] } as any);

      const result = await moduleRegistry.updateModule('APARTMENT', { active: false });

      expect(result.active).toBe(false);
    });

    it('should throw error if module not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        moduleRegistry.updateModule('NONEXISTENT', { version: '2.0.0' })
      ).rejects.toThrow("Module type 'NONEXISTENT' not found");
    });

    it('should throw error if no fields to update', async () => {
      const existingModule = {
        id: '1',
        type: 'APARTMENT',
        version: '1.0.0',
        schema: { fields: [] },
        active: true,
        createdAt: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [existingModule] } as any);

      await expect(moduleRegistry.updateModule('APARTMENT', {})).rejects.toThrow(
        'No fields to update'
      );
    });
  });

  describe('deleteModule', () => {
    it('should delete module if no properties are using it', async () => {
      const existingModule = {
        id: '1',
        type: 'RENTAL',
        version: '1.0.0',
        schema: { fields: [] },
        active: true,
        createdAt: new Date(),
      };

      // Mock getModule
      mockQuery.mockResolvedValueOnce({ rows: [existingModule] } as any);
      // Mock property count check
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] } as any);
      // Mock delete
      mockQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

      await moduleRegistry.deleteModule('RENTAL');

      expect(mockQuery).toHaveBeenCalledTimes(3);
      expect(mockQuery).toHaveBeenLastCalledWith(
        'DELETE FROM property_modules WHERE type = $1',
        ['RENTAL']
      );
    });

    it('should throw error if module not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(moduleRegistry.deleteModule('NONEXISTENT')).rejects.toThrow(
        "Module type 'NONEXISTENT' not found"
      );
    });

    it('should throw error if properties are using the module', async () => {
      const existingModule = {
        id: '1',
        type: 'APARTMENT',
        version: '1.0.0',
        schema: { fields: [] },
        active: true,
        createdAt: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [existingModule] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }] } as any);

      await expect(moduleRegistry.deleteModule('APARTMENT')).rejects.toThrow(
        "Cannot delete module 'APARTMENT' because 5 properties are using it"
      );
    });
  });

  describe('enableModule', () => {
    it('should enable a module', async () => {
      const existingModule = {
        id: '1',
        type: 'RENTAL',
        version: '1.0.0',
        schema: { fields: [] },
        active: false,
        createdAt: new Date(),
      };

      const enabledModule = { ...existingModule, active: true };

      mockQuery.mockResolvedValueOnce({ rows: [existingModule] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [enabledModule] } as any);

      const result = await moduleRegistry.enableModule('RENTAL');

      expect(result.active).toBe(true);
    });
  });

  describe('disableModule', () => {
    it('should disable a module', async () => {
      const existingModule = {
        id: '1',
        type: 'RENTAL',
        version: '1.0.0',
        schema: { fields: [] },
        active: true,
        createdAt: new Date(),
      };

      const disabledModule = { ...existingModule, active: false };

      mockQuery.mockResolvedValueOnce({ rows: [existingModule] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [disabledModule] } as any);

      const result = await moduleRegistry.disableModule('RENTAL');

      expect(result.active).toBe(false);
    });
  });

  describe('validatePropertyData', () => {
    const apartmentSchema: moduleRegistry.ModuleSchema = {
      fields: [
        { name: 'bedrooms', type: 'number', required: true },
        { name: 'bathrooms', type: 'number', required: true },
        { name: 'sqft', type: 'number', required: true },
        { name: 'floor', type: 'number', required: false },
        { name: 'building_name', type: 'string', required: false },
        { name: 'pet_friendly', type: 'boolean', required: false },
        { name: 'available_from', type: 'date', required: false },
        { name: 'amenities', type: 'json', required: false },
      ],
    };

    it('should validate valid property data', () => {
      const propertyData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        floor: 5,
        building_name: 'Sunset Towers',
      };

      const result = moduleRegistry.validatePropertyData(propertyData, apartmentSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for missing required fields', () => {
      const propertyData = {
        bedrooms: 2,
        // missing bathrooms and sqft
      };

      const result = moduleRegistry.validatePropertyData(propertyData, apartmentSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field 'bathrooms' is required");
      expect(result.errors).toContain("Field 'sqft' is required");
    });

    it('should fail validation for incorrect field types', () => {
      const propertyData = {
        bedrooms: '2', // should be number
        bathrooms: 2,
        sqft: 1200,
      };

      const result = moduleRegistry.validatePropertyData(propertyData, apartmentSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field 'bedrooms' must be a number");
    });

    it('should validate string fields correctly', () => {
      const propertyData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        building_name: 123, // should be string
      };

      const result = moduleRegistry.validatePropertyData(propertyData, apartmentSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field 'building_name' must be a string");
    });

    it('should validate boolean fields correctly', () => {
      const propertyData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        pet_friendly: 'yes', // should be boolean
      };

      const result = moduleRegistry.validatePropertyData(propertyData, apartmentSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field 'pet_friendly' must be a boolean");
    });

    it('should validate date fields correctly', () => {
      const propertyData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        available_from: '2024-01-01',
      };

      const result = moduleRegistry.validatePropertyData(propertyData, apartmentSchema);

      expect(result.valid).toBe(true);
    });

    it('should fail validation for invalid date fields', () => {
      const propertyData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        available_from: 'not-a-date',
      };

      const result = moduleRegistry.validatePropertyData(propertyData, apartmentSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field 'available_from' must be a valid date");
    });

    it('should validate json fields correctly', () => {
      const propertyData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        amenities: { pool: true, gym: true },
      };

      const result = moduleRegistry.validatePropertyData(propertyData, apartmentSchema);

      expect(result.valid).toBe(true);
    });

    it('should allow optional fields to be omitted', () => {
      const propertyData = {
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        // all optional fields omitted
      };

      const result = moduleRegistry.validatePropertyData(propertyData, apartmentSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation if moduleData is not an object', () => {
      const result = moduleRegistry.validatePropertyData('not an object', apartmentSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Module data must be an object');
    });

    it('should fail validation if moduleData is null', () => {
      const result = moduleRegistry.validatePropertyData(null, apartmentSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Module data must be an object');
    });
  });

  describe('createPropertyValidator', () => {
    it('should create a validator that validates property data', () => {
      const schema: moduleRegistry.ModuleSchema = {
        fields: [
          { name: 'bedrooms', type: 'number', required: true },
          { name: 'bathrooms', type: 'number', required: true },
        ],
      };

      const validator = moduleRegistry.createPropertyValidator(schema);

      const validData = { bedrooms: 2, bathrooms: 2 };
      const invalidData = { bedrooms: 2 }; // missing bathrooms

      expect(validator.validate(validData).valid).toBe(true);
      expect(validator.validate(invalidData).valid).toBe(false);
    });
  });
});
