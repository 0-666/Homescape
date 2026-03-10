import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index';
import { pool } from '../db';
import * as authService from '../services/auth.service';
import * as moduleRegistry from '../services/module-registry.service';

describe('Property Routes', () => {
  let builderToken: string;
  let userToken: string;
  let adminToken: string;
  let testBuilderId: string;
  let testModuleType: string;

  beforeAll(async () => {
    // Create test users
    const builder = await authService.register({
      email: 'builder-property@test.com',
      password: 'Test1234',
      role: 'BUILDER',
    });

    const user = await authService.register({
      email: 'user-property@test.com',
      password: 'Test1234',
      role: 'USER',
    });

    const admin = await authService.register({
      email: 'admin-property@test.com',
      password: 'Test1234',
      role: 'ADMIN',
    });

    // Login to get tokens
    const builderLogin = await authService.login({
      email: 'builder-property@test.com',
      password: 'Test1234',
    });
    builderToken = builderLogin.token;

    const userLogin = await authService.login({
      email: 'user-property@test.com',
      password: 'Test1234',
    });
    userToken = userLogin.token;

    const adminLogin = await authService.login({
      email: 'admin-property@test.com',
      password: 'Test1234',
    });
    adminToken = adminLogin.token;

    // Create a partner for the builder
    const partnerResult = await pool.query(
      `INSERT INTO partners (user_id, business_name, status)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [builder.id, 'Test Builder LLC', 'APPROVED']
    );
    testBuilderId = partnerResult.rows[0].id;

    // Register a test module
    const module = await moduleRegistry.registerModule({
      type: 'PROPERTY_TEST_MODULE',
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
    await pool.query(
      "DELETE FROM users WHERE email IN ('builder-property@test.com', 'user-property@test.com', 'admin-property@test.com')"
    );
  });

  beforeEach(async () => {
    // Clean up properties before each test
    await pool.query('DELETE FROM properties WHERE builder_id = $1', [testBuilderId]);
  });

  describe('POST /api/properties', () => {
    it('should create a property with valid data', async () => {
      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${builderToken}`)
        .send({
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
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.title).toBe('Test Property');
      expect(response.body.data.price).toBe(100000);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .post('/api/properties')
        .send({
          builderId: testBuilderId,
          moduleType: testModuleType,
          title: 'Test Property',
          price: 100000,
          location: 'Test City',
          moduleData: { testField: 'test value' },
        });

      expect(response.status).toBe(401);
    });

    it('should reject request from non-builder user', async () => {
      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          builderId: testBuilderId,
          moduleType: testModuleType,
          title: 'Test Property',
          price: 100000,
          location: 'Test City',
          moduleData: { testField: 'test value' },
        });

      expect(response.status).toBe(403);
    });

    it('should reject property with invalid module data', async () => {
      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${builderToken}`)
        .send({
          builderId: testBuilderId,
          moduleType: testModuleType,
          title: 'Test Property',
          price: 100000,
          location: 'Test City',
          moduleData: {
            // Missing required testField
            optionalField: 42,
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/properties', () => {
    beforeEach(async () => {
      // Create test properties
      await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${builderToken}`)
        .send({
          builderId: testBuilderId,
          moduleType: testModuleType,
          title: 'Property 1',
          price: 100000,
          location: 'City A',
          moduleData: { testField: 'value1' },
        });

      await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${builderToken}`)
        .send({
          builderId: testBuilderId,
          moduleType: testModuleType,
          title: 'Property 2',
          price: 200000,
          location: 'City B',
          moduleData: { testField: 'value2' },
        });
    });

    it('should list all properties', async () => {
      const response = await request(app)
        .get('/api/properties')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter properties by builder ID', async () => {
      const response = await request(app)
        .get(`/api/properties?builderId=${testBuilderId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(2);
      expect(response.body.data.every((p: any) => p.builderId === testBuilderId)).toBe(true);
    });

    it('should filter properties by module type', async () => {
      const response = await request(app)
        .get(`/api/properties?moduleType=${testModuleType}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/properties?limit=1&offset=0')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.pagination.offset).toBe(0);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app).get('/api/properties');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/properties/:id', () => {
    let propertyId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${builderToken}`)
        .send({
          builderId: testBuilderId,
          moduleType: testModuleType,
          title: 'Test Property',
          price: 100000,
          location: 'Test City',
          moduleData: { testField: 'test value' },
        });

      propertyId = createResponse.body.data.id;
    });

    it('should get a property by ID', async () => {
      const response = await request(app)
        .get(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(propertyId);
      expect(response.body.data.title).toBe('Test Property');
    });

    it('should return 404 for non-existent property', async () => {
      const response = await request(app)
        .get('/api/properties/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/properties/:id', () => {
    let propertyId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${builderToken}`)
        .send({
          builderId: testBuilderId,
          moduleType: testModuleType,
          title: 'Original Title',
          price: 100000,
          location: 'Test City',
          moduleData: { testField: 'original value' },
        });

      propertyId = createResponse.body.data.id;
    });

    it('should update a property', async () => {
      const response = await request(app)
        .patch(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${builderToken}`)
        .send({
          title: 'Updated Title',
          price: 150000,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Title');
      expect(response.body.data.price).toBe(150000);
    });

    it('should reject update from non-builder user', async () => {
      const response = await request(app)
        .patch(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Updated Title',
        });

      expect(response.status).toBe(403);
    });

    it('should reject update with invalid module data', async () => {
      const response = await request(app)
        .patch(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${builderToken}`)
        .send({
          moduleData: {
            // Missing required field
            optionalField: 99,
          },
        });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/properties/:id', () => {
    let propertyId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${builderToken}`)
        .send({
          builderId: testBuilderId,
          moduleType: testModuleType,
          title: 'Test Property',
          price: 100000,
          location: 'Test City',
          moduleData: { testField: 'test value' },
        });

      propertyId = createResponse.body.data.id;
    });

    it('should delete a property', async () => {
      const response = await request(app)
        .delete(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${builderToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify property is deleted
      const getResponse = await request(app)
        .get(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(getResponse.status).toBe(404);
    });

    it('should reject deletion from non-builder user', async () => {
      const response = await request(app)
        .delete(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/properties/builder/:builderId', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${builderToken}`)
        .send({
          builderId: testBuilderId,
          moduleType: testModuleType,
          title: 'Builder Property',
          price: 100000,
          location: 'Test City',
          moduleData: { testField: 'test value' },
        });
    });

    it('should get properties by builder ID', async () => {
      const response = await request(app)
        .get(`/api/properties/builder/${testBuilderId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data.every((p: any) => p.builderId === testBuilderId)).toBe(true);
    });
  });

  describe('GET /api/properties/module/:moduleType', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${builderToken}`)
        .send({
          builderId: testBuilderId,
          moduleType: testModuleType,
          title: 'Module Property',
          price: 100000,
          location: 'Test City',
          moduleData: { testField: 'test value' },
        });
    });

    it('should get properties by module type', async () => {
      const response = await request(app)
        .get(`/api/properties/module/${testModuleType}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data.every((p: any) => p.moduleType === testModuleType)).toBe(true);
    });
  });
});
