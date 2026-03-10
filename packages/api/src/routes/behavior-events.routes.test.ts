import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { Application } from 'express';
import behaviorEventsRoutes from './behavior-events.routes';
import { query } from '../db';
import * as authService from '../services/auth.service';

describe('Behavior Events Routes', () => {
  let app: Application;
  let testUserId: string;
  let testUserToken: string;
  let testBuilderUserId: string;
  let testBuilderToken: string;
  let testAdminUserId: string;
  let testAdminToken: string;
  let testPropertyId: string;
  let testBuilderId: string;

  beforeEach(async () => {
    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/events', behaviorEventsRoutes);

    // Create test user
    const user = await authService.register({
      email: 'test-events-user@example.com',
      password: 'TestPass123',
      role: authService.UserRole.USER,
    });
    testUserId = user.id;

    // Login to get token
    const userSession = await authService.login({
      email: 'test-events-user@example.com',
      password: 'TestPass123',
    });
    testUserToken = userSession.token;

    // Create test builder user
    const builderUser = await authService.register({
      email: 'test-events-builder@example.com',
      password: 'TestPass123',
      role: authService.UserRole.BUILDER,
    });
    testBuilderUserId = builderUser.id;

    // Login builder
    const builderSession = await authService.login({
      email: 'test-events-builder@example.com',
      password: 'TestPass123',
    });
    testBuilderToken = builderSession.token;

    // Create test admin user
    const adminUser = await authService.register({
      email: 'test-events-admin@example.com',
      password: 'TestPass123',
      role: authService.UserRole.ADMIN,
    });
    testAdminUserId = adminUser.id;

    // Login admin
    const adminSession = await authService.login({
      email: 'test-events-admin@example.com',
      password: 'TestPass123',
    });
    testAdminToken = adminSession.token;

    // Create test partner for builder
    const partnerResult = await query(
      `INSERT INTO partners (user_id, business_name, status)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [testBuilderUserId, 'Test Builder', 'APPROVED']
    );
    testBuilderId = partnerResult.rows[0].id;

    // Create test property
    const propertyResult = await query(
      `INSERT INTO properties (builder_id, module_type, title, description, price, location)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [testBuilderId, 'APARTMENT', 'Test Property', 'Test Description', 100000, 'Test Location']
    );
    testPropertyId = propertyResult.rows[0].id;
  });

  afterEach(async () => {
    // Clean up test data
    await query('DELETE FROM behavior_events WHERE user_id = $1', [testUserId]);
    await query('DELETE FROM properties WHERE id = $1', [testPropertyId]);
    await query('DELETE FROM partners WHERE id = $1', [testBuilderId]);
    await query('DELETE FROM sessions WHERE user_id IN ($1, $2, $3)', [
      testUserId,
      testBuilderUserId,
      testAdminUserId,
    ]);
    await query('DELETE FROM users WHERE email LIKE $1', ['test-events-%@example.com']);
  });

  describe('POST /api/events', () => {
    it('should track a VIEW event successfully', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          propertyId: testPropertyId,
          eventType: 'VIEW',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.event).toBeDefined();
      expect(response.body.data.event.userId).toBe(testUserId);
      expect(response.body.data.event.propertyId).toBe(testPropertyId);
      expect(response.body.data.event.eventType).toBe('VIEW');
    });

    it('should track a SAVE event successfully', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          propertyId: testPropertyId,
          eventType: 'SAVE',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.event.eventType).toBe('SAVE');
    });

    it('should track a DESIGN event successfully', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          propertyId: testPropertyId,
          eventType: 'DESIGN',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.event.eventType).toBe('DESIGN');
    });

    it('should track a CALL event successfully', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          propertyId: testPropertyId,
          eventType: 'CALL',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.event.eventType).toBe('CALL');
    });

    it('should track event with metadata', async () => {
      const metadata = { source: 'mobile', duration: 120 };
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          propertyId: testPropertyId,
          eventType: 'VIEW',
          metadata,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.event.metadata).toEqual(metadata);
    });

    it('should return 401 without authentication token', async () => {
      const response = await request(app)
        .post('/api/events')
        .send({
          propertyId: testPropertyId,
          eventType: 'VIEW',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });

    it('should return 400 for invalid property ID', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          propertyId: 'invalid-uuid',
          eventType: 'VIEW',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent property', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          propertyId: '00000000-0000-0000-0000-000000000000',
          eventType: 'VIEW',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('not found');
    });

    it('should return 400 for invalid event type', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          propertyId: testPropertyId,
          eventType: 'INVALID_TYPE',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          propertyId: testPropertyId,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/events/user/:userId', () => {
    beforeEach(async () => {
      // Create test events
      await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ propertyId: testPropertyId, eventType: 'VIEW' });

      await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ propertyId: testPropertyId, eventType: 'SAVE' });
    });

    it('should retrieve events for authenticated user', async () => {
      const response = await request(app)
        .get(`/api/events/user/${testUserId}`)
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(2);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should allow admin to view any user events', async () => {
      const response = await request(app)
        .get(`/api/events/user/${testUserId}`)
        .set('Authorization', `Bearer ${testAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(2);
    });

    it('should return 403 when user tries to view another user events', async () => {
      const response = await request(app)
        .get(`/api/events/user/${testBuilderUserId}`)
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should respect limit query parameter', async () => {
      const response = await request(app)
        .get(`/api/events/user/${testUserId}?limit=1`)
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.events).toHaveLength(1);
      expect(response.body.data.pagination.limit).toBe(1);
    });

    it('should respect offset query parameter', async () => {
      const response = await request(app)
        .get(`/api/events/user/${testUserId}?offset=1`)
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.events).toHaveLength(1);
      expect(response.body.data.pagination.offset).toBe(1);
    });

    it('should return 401 without authentication token', async () => {
      const response = await request(app).get(`/api/events/user/${testUserId}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid user ID format', async () => {
      const response = await request(app)
        .get('/api/events/user/invalid-uuid')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/events/property/:propertyId', () => {
    beforeEach(async () => {
      // Create test events
      await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ propertyId: testPropertyId, eventType: 'VIEW' });

      await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ propertyId: testPropertyId, eventType: 'CALL' });
    });

    it('should allow builder to view events for their property', async () => {
      const response = await request(app)
        .get(`/api/events/property/${testPropertyId}`)
        .set('Authorization', `Bearer ${testBuilderToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(2);
    });

    it('should allow admin to view events for any property', async () => {
      const response = await request(app)
        .get(`/api/events/property/${testPropertyId}`)
        .set('Authorization', `Bearer ${testAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(2);
    });

    it('should return 403 for regular user', async () => {
      const response = await request(app)
        .get(`/api/events/property/${testPropertyId}`)
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should return 403 when builder tries to view another builder property', async () => {
      // Create another builder
      const anotherBuilder = await authService.register({
        email: 'another-builder@example.com',
        password: 'TestPass123',
        role: authService.UserRole.BUILDER,
      });

      const anotherSession = await authService.login({
        email: 'another-builder@example.com',
        password: 'TestPass123',
      });

      const response = await request(app)
        .get(`/api/events/property/${testPropertyId}`)
        .set('Authorization', `Bearer ${anotherSession.token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);

      // Clean up
      await query('DELETE FROM sessions WHERE user_id = $1', [anotherBuilder.id]);
      await query('DELETE FROM users WHERE id = $1', [anotherBuilder.id]);
    });

    it('should respect limit query parameter', async () => {
      const response = await request(app)
        .get(`/api/events/property/${testPropertyId}?limit=1`)
        .set('Authorization', `Bearer ${testBuilderToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.events).toHaveLength(1);
    });

    it('should return 401 without authentication token', async () => {
      const response = await request(app).get(`/api/events/property/${testPropertyId}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid property ID format', async () => {
      const response = await request(app)
        .get('/api/events/property/invalid-uuid')
        .set('Authorization', `Bearer ${testBuilderToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/events/user/:userId/counts', () => {
    beforeEach(async () => {
      // Create multiple events of different types
      await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ propertyId: testPropertyId, eventType: 'VIEW' });

      await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ propertyId: testPropertyId, eventType: 'VIEW' });

      await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ propertyId: testPropertyId, eventType: 'SAVE' });

      await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ propertyId: testPropertyId, eventType: 'DESIGN' });
    });

    it('should retrieve event counts for authenticated user', async () => {
      const response = await request(app)
        .get(`/api/events/user/${testUserId}/counts`)
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.counts).toBeDefined();
      expect(response.body.data.counts.VIEW).toBe(2);
      expect(response.body.data.counts.SAVE).toBe(1);
      expect(response.body.data.counts.DESIGN).toBe(1);
      expect(response.body.data.counts.CALL).toBe(0);
    });

    it('should allow admin to view any user counts', async () => {
      const response = await request(app)
        .get(`/api/events/user/${testUserId}/counts`)
        .set('Authorization', `Bearer ${testAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.counts.VIEW).toBe(2);
    });

    it('should return 403 when user tries to view another user counts', async () => {
      const response = await request(app)
        .get(`/api/events/user/${testBuilderUserId}/counts`)
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should return 401 without authentication token', async () => {
      const response = await request(app).get(`/api/events/user/${testUserId}/counts`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid user ID format', async () => {
      const response = await request(app)
        .get('/api/events/user/invalid-uuid/counts')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
