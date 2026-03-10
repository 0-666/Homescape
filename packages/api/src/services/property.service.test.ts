import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../db';
import * as propertyService from './property.service';
import * as moduleRegistry from './module-registry.service';

describe('Property Service', () => {
  let testBuilderId: string;
  let testModuleType: string;

  beforeAll(async () => {
    // Create a test builder (partner)
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['builder@test.com', 'hashedpassword', 'BUILDER']
    );

    const partnerResult = await pool.query(
      `INSERT INTO partners (user_id, business_name, status)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [userResult.rows[0].id, 'Test Builder LLC', 'APPROVED']
    );

    testBuilderId = partnerResult.rows[0].id;

    // Register a test module
    const module = await moduleRegistry.registerModule({
      type: 'TEST_MODULE',
      version: '1.0.0',
      schema: {
        fields: [
          { name: 'testField', type: 'string', required: true },
          { name: 'optionalField', type: 'number', required: false },
        ],
      },
      active: true,
    });

    testModuleType = module.type;
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM properties WHERE builder_id = $1', [testBuilderId]);
    await pool.query('DELETE FROM property_modules WHERE type = $1', [testModuleType]);
    await pool.query('DELETE FROM partners WHERE id = $1', [testBuilderId]);
    await pool.query('DELETE FROM users WHERE email = $1', ['builder@test.com']);
  });

  beforeEach(async () => {
    // Clean up properties before each test
    await pool.query('DELETE FROM properties WHERE builder_id = $1', [testBuilderId]);
  });

  describe('createProperty', () => {
    it('should create a property with valid data', async () => {
      const input: propertyService.CreatePropertyInput = {
        builderId: testBuilderId,
        moduleType: testModuleType,
        title: 'Test Property',
        description: 'A test property',
        price: 100000,
        currency: 'USD',
        location: 'Test City',
        images: ['https://example.com/image1.jpg'],
        moduleData: {
          testField: 'test value',
          optionalField: 42,
        },
      };

      const property = await propertyService.createProperty(input);

      expect(property).toBeDefined();
      expect(property.id).toBeDefined();
      expect(property.builderId).toBe(testBuilderId);
      expect(property.moduleType).toBe(testModuleType);
      expect(property.title).toBe('Test Property');
      expect(property.price).toBe(100000);
      expect(property.status).toBe('AVAILABLE');
      expect(property.moduleData).toEqual({
        testField: 'test value',
        optionalField: 42,
      });
    });

    it('should reject property with invalid module type', async () => {
      const input: propertyService.CreatePropertyInput = {
        builderId: testBuilderId,
        moduleType: 'NONEXISTENT_MODULE',
        title: 'Test Property',
        price: 100000,
        location: 'Test City',
        moduleData: {},
      };

      await expect(propertyService.createProperty(input)).rejects.toThrow(
        "Module type 'NONEXISTENT_MODULE' not found"
      );
    });

    it('should reject property with missing required module fields', async () => {
      const input: propertyService.CreatePropertyInput = {
        builderId: testBuilderId,
        moduleType: testModuleType,
        title: 'Test Property',
        price: 100000,
        location: 'Test City',
        moduleData: {
          // Missing required 'testField'
          optionalField: 42,
        },
      };

      await expect(propertyService.createProperty(input)).rejects.toThrow(
        "Module data validation failed"
      );
    });

    it('should reject property with invalid module field types', async () => {
      const input: propertyService.CreatePropertyInput = {
        builderId: testBuilderId,
        moduleType: testModuleType,
        title: 'Test Property',
        price: 100000,
        location: 'Test City',
        moduleData: {
          testField: 123, // Should be string
        },
      };

      await expect(propertyService.createProperty(input)).rejects.toThrow(
        "Module data validation failed"
      );
    });

    it('should reject property with negative price', async () => {
      const input: propertyService.CreatePropertyInput = {
        builderId: testBuilderId,
        moduleType: testModuleType,
        title: 'Test Property',
        price: -100,
        location: 'Test City',
        moduleData: {
          testField: 'test value',
        },
      };

      await expect(propertyService.createProperty(input)).rejects.toThrow();
    });

    it('should create property with default status AVAILABLE', async () => {
      const input: propertyService.CreatePropertyInput = {
        builderId: testBuilderId,
        moduleType: testModuleType,
        title: 'Test Property',
        price: 100000,
        location: 'Test City',
        moduleData: {
          testField: 'test value',
        },
      };

      const property = await propertyService.createProperty(input);
      expect(property.status).toBe('AVAILABLE');
    });
  });

  describe('getProperty', () => {
    it('should retrieve an existing property', async () => {
      const created = await propertyService.createProperty({
        builderId: testBuilderId,
        moduleType: testModuleType,
        title: 'Test Property',
        price: 100000,
        location: 'Test City',
        moduleData: {
          testField: 'test value',
        },
      });

      const retrieved = await propertyService.getProperty(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.title).toBe('Test Property');
    });

    it('should return null for non-existent property', async () => {
      const retrieved = await propertyService.getProperty('00000000-0000-0000-0000-000000000000');
      expect(retrieved).toBeNull();
    });
  });

  describe('updateProperty', () => {
    it('should update property fields', async () => {
      const created = await propertyService.createProperty({
        builderId: testBuilderId,
        moduleType: testModuleType,
        title: 'Original Title',
        price: 100000,
        location: 'Test City',
        moduleData: {
          testField: 'original value',
        },
      });

      const updated = await propertyService.updateProperty(created.id, {
        title: 'Updated Title',
        price: 150000,
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.price).toBe(150000);
      expect(updated.location).toBe('Test City'); // Unchanged
    });

    it('should update module data with validation', async () => {
      const created = await propertyService.createProperty({
        builderId: testBuilderId,
        moduleType: testModuleType,
        title: 'Test Property',
        price: 100000,
        location: 'Test City',
        moduleData: {
          testField: 'original value',
        },
      });

      const updated = await propertyService.updateProperty(created.id, {
        moduleData: {
          testField: 'updated value',
          optionalField: 99,
        },
      });

      expect(updated.moduleData).toEqual({
        testField: 'updated value',
        optionalField: 99,
      });
    });

    it('should reject update with invalid module data', async () => {
      const created = await propertyService.createProperty({
        builderId: testBuilderId,
        moduleType: testModuleType,
        title: 'Test Property',
        price: 100000,
        location: 'Test City',
        moduleData: {
          testField: 'original value',
        },
      });

      await expect(
        propertyService.updateProperty(created.id, {
          moduleData: {
            // Missing required field
            optionalField: 99,
          },
        })
      ).rejects.toThrow('Module data validation failed');
    });

    it('should reject update of non-existent property', async () => {
      await expect(
        propertyService.updateProperty('00000000-0000-0000-0000-000000000000', {
          title: 'Updated Title',
        })
      ).rejects.toThrow('not found');
    });

    it('should update property status', async () => {
      const created = await propertyService.createProperty({
        builderId: testBuilderId,
        moduleType: testModuleType,
        title: 'Test Property',
        price: 100000,
        location: 'Test City',
        moduleData: {
          testField: 'test value',
        },
      });

      const updated = await propertyService.updateProperty(created.id, {
        status: 'SOLD',
      });

      expect(updated.status).toBe('SOLD');
    });
  });

  describe('deleteProperty', () => {
    it('should delete an existing property', async () => {
      const created = await propertyService.createProperty({
        builderId: testBuilderId,
        moduleType: testModuleType,
        title: 'Test Property',
        price: 100000,
        location: 'Test City',
        moduleData: {
          testField: 'test value',
        },
      });

      await propertyService.deleteProperty(created.id);

      const retrieved = await propertyService.getProperty(created.id);
      expect(retrieved).toBeNull();
    });

    it('should reject deletion of non-existent property', async () => {
      await expect(
        propertyService.deleteProperty('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('not found');
    });
  });

  describe('listProperties', () => {
    beforeEach(async () => {
      // Create multiple test properties
      await propertyService.createProperty({
        builderId: testBuilderId,
        moduleType: testModuleType,
        title: 'Property 1',
        price: 100000,
        location: 'City A',
        moduleData: { testField: 'value1' },
        status: 'AVAILABLE',
      });

      await propertyService.createProperty({
        builderId: testBuilderId,
        moduleType: testModuleType,
        title: 'Property 2',
        price: 200000,
        location: 'City B',
        moduleData: { testField: 'value2' },
        status: 'SOLD',
      });

      await propertyService.createProperty({
        builderId: testBuilderId,
        moduleType: testModuleType,
        title: 'Property 3',
        price: 150000,
        location: 'City A',
        moduleData: { testField: 'value3' },
        status: 'AVAILABLE',
      });
    });

    it('should list all properties', async () => {
      const result = await propertyService.listProperties();

      expect(result.properties.length).toBeGreaterThanOrEqual(3);
      expect(result.total).toBeGreaterThanOrEqual(3);
    });

    it('should filter properties by builder ID', async () => {
      const result = await propertyService.listProperties({
        builderId: testBuilderId,
      });

      expect(result.properties.length).toBe(3);
      expect(result.properties.every((p) => p.builderId === testBuilderId)).toBe(true);
    });

    it('should filter properties by module type', async () => {
      const result = await propertyService.listProperties({
        moduleType: testModuleType,
      });

      expect(result.properties.length).toBeGreaterThanOrEqual(3);
      expect(result.properties.every((p) => p.moduleType === testModuleType)).toBe(true);
    });

    it('should filter properties by status', async () => {
      const result = await propertyService.listProperties({
        builderId: testBuilderId,
        status: 'AVAILABLE',
      });

      expect(result.properties.length).toBe(2);
      expect(result.properties.every((p) => p.status === 'AVAILABLE')).toBe(true);
    });

    it('should support pagination', async () => {
      const page1 = await propertyService.listProperties({
        builderId: testBuilderId,
        limit: 2,
        offset: 0,
      });

      expect(page1.properties.length).toBe(2);
      expect(page1.total).toBe(3);

      const page2 = await propertyService.listProperties({
        builderId: testBuilderId,
        limit: 2,
        offset: 2,
      });

      expect(page2.properties.length).toBe(1);
      expect(page2.total).toBe(3);
    });
  });

  describe('getPropertiesByBuilder', () => {
    it('should get all properties for a builder', async () => {
      await propertyService.createProperty({
        builderId: testBuilderId,
        moduleType: testModuleType,
        title: 'Builder Property',
        price: 100000,
        location: 'Test City',
        moduleData: { testField: 'test value' },
      });

      const result = await propertyService.getPropertiesByBuilder(testBuilderId);

      expect(result.properties.length).toBeGreaterThanOrEqual(1);
      expect(result.properties.every((p) => p.builderId === testBuilderId)).toBe(true);
    });
  });

  describe('getPropertiesByModule', () => {
    it('should get all properties for a module type', async () => {
      await propertyService.createProperty({
        builderId: testBuilderId,
        moduleType: testModuleType,
        title: 'Module Property',
        price: 100000,
        location: 'Test City',
        moduleData: { testField: 'test value' },
      });

      const result = await propertyService.getPropertiesByModule(testModuleType);

      expect(result.properties.length).toBeGreaterThanOrEqual(1);
      expect(result.properties.every((p) => p.moduleType === testModuleType)).toBe(true);
    });
  });
});
