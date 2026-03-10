import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { authenticate, requireUser, requireBuilder, requireAdmin, AuthenticatedRequest } from './auth.middleware';
import * as authService from '../services/auth.service';
import { UserRole } from '../services/auth.service';

describe('RBAC Middleware Integration Tests', () => {
  let app: Express;
  let userToken: string;
  let builderToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Create Express app with test routes
    app = express();
    app.use(express.json());

    // Public route
    app.get('/api/public', (req, res) => {
      res.json({ message: 'Public endpoint' });
    });

    // Protected route - any authenticated user
    app.get('/api/profile', authenticate, (req: AuthenticatedRequest, res) => {
      res.json({ 
        message: 'Profile endpoint',
        user: req.user 
      });
    });

    // USER-only route
    app.get('/api/user/dashboard', authenticate, requireUser, (req: AuthenticatedRequest, res) => {
      res.json({ 
        message: 'User dashboard',
        userId: req.user?.id 
      });
    });

    // BUILDER-only route
    app.get('/api/builder/inventory', authenticate, requireBuilder, (req: AuthenticatedRequest, res) => {
      res.json({ 
        message: 'Builder inventory',
        builderId: req.user?.id 
      });
    });

    // ADMIN-only route
    app.get('/api/admin/partners', authenticate, requireAdmin, (req: AuthenticatedRequest, res) => {
      res.json({ 
        message: 'Admin partners',
        adminId: req.user?.id 
      });
    });

    // Create test users and get tokens
    try {
      // Register and login USER
      const user = await authService.register({
        email: `user-${Date.now()}@test.com`,
        password: 'TestPass123',
        role: UserRole.USER,
      });
      const userSession = await authService.login({
        email: user.email,
        password: 'TestPass123',
      });
      userToken = userSession.token;

      // Register and login BUILDER
      const builder = await authService.register({
        email: `builder-${Date.now()}@test.com`,
        password: 'TestPass123',
        role: UserRole.BUILDER,
      });
      const builderSession = await authService.login({
        email: builder.email,
        password: 'TestPass123',
      });
      builderToken = builderSession.token;

      // Register and login ADMIN
      const admin = await authService.register({
        email: `admin-${Date.now()}@test.com`,
        password: 'TestPass123',
        role: UserRole.ADMIN,
      });
      const adminSession = await authService.login({
        email: admin.email,
        password: 'TestPass123',
      });
      adminToken = adminSession.token;
    } catch (error) {
      console.error('Failed to create test users:', error);
      throw error;
    }
  });

  afterAll(async () => {
    // Cleanup: logout all test users
    if (userToken) await authService.logout(userToken);
    if (builderToken) await authService.logout(builderToken);
    if (adminToken) await authService.logout(adminToken);
  });

  describe('Public routes', () => {
    it('should allow access without authentication', async () => {
      const response = await request(app)
        .get('/api/public')
        .expect(200);

      expect(response.body.message).toBe('Public endpoint');
    });
  });

  describe('Protected routes - any authenticated user', () => {
    it('should allow USER to access profile', async () => {
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.message).toBe('Profile endpoint');
      expect(response.body.user.role).toBe(UserRole.USER);
    });

    it('should allow BUILDER to access profile', async () => {
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${builderToken}`)
        .expect(200);

      expect(response.body.message).toBe('Profile endpoint');
      expect(response.body.user.role).toBe(UserRole.BUILDER);
    });

    it('should allow ADMIN to access profile', async () => {
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Profile endpoint');
      expect(response.body.user.role).toBe(UserRole.ADMIN);
    });

    it('should deny access without token', async () => {
      const response = await request(app)
        .get('/api/profile')
        .expect(401);

      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('USER-only routes', () => {
    it('should allow USER to access user dashboard', async () => {
      const response = await request(app)
        .get('/api/user/dashboard')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.message).toBe('User dashboard');
    });

    it('should deny BUILDER access to user dashboard', async () => {
      const response = await request(app)
        .get('/api/user/dashboard')
        .set('Authorization', `Bearer ${builderToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should deny ADMIN access to user dashboard', async () => {
      const response = await request(app)
        .get('/api/user/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('BUILDER-only routes', () => {
    it('should allow BUILDER to access builder inventory', async () => {
      const response = await request(app)
        .get('/api/builder/inventory')
        .set('Authorization', `Bearer ${builderToken}`)
        .expect(200);

      expect(response.body.message).toBe('Builder inventory');
    });

    it('should deny USER access to builder inventory', async () => {
      const response = await request(app)
        .get('/api/builder/inventory')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should deny ADMIN access to builder inventory', async () => {
      const response = await request(app)
        .get('/api/builder/inventory')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('ADMIN-only routes', () => {
    it('should allow ADMIN to access admin partners', async () => {
      const response = await request(app)
        .get('/api/admin/partners')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Admin partners');
    });

    it('should deny USER access to admin partners', async () => {
      const response = await request(app)
        .get('/api/admin/partners')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should deny BUILDER access to admin partners', async () => {
      const response = await request(app)
        .get('/api/admin/partners')
        .set('Authorization', `Bearer ${builderToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('RBAC enforcement - Requirement 13.3', () => {
    it('should prevent USER from accessing BUILDER features', async () => {
      const response = await request(app)
        .get('/api/builder/inventory')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(response.body.error.message).toContain('BUILDER');
    });

    it('should prevent USER from accessing ADMIN features', async () => {
      const response = await request(app)
        .get('/api/admin/partners')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(response.body.error.message).toContain('ADMIN');
    });

    it('should prevent BUILDER from accessing ADMIN features', async () => {
      const response = await request(app)
        .get('/api/admin/partners')
        .set('Authorization', `Bearer ${builderToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(response.body.error.message).toContain('ADMIN');
    });
  });
});
