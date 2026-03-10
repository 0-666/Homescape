import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { Application } from 'express';
import leadsRoutes from './leads.routes';
import * as leadScoringService from '../services/lead-scoring.service';
import { query } from '../db';
import { UserRole } from '../middleware/auth.middleware';

// Mock dependencies
vi.mock('../db', () => ({
  query: vi.fn(),
}));

vi.mock('../services/lead-scoring.service', () => ({
  getLeadsByUser: vi.fn(),
  getLeadsByProperty: vi.fn(),
  getLeadsByBuilder: vi.fn(),
  LeadStatus: {
    NEW: 'NEW',
    HOT: 'HOT',
    CONTACTED: 'CONTACTED',
    CONVERTED: 'CONVERTED',
    LOST: 'LOST',
  },
}));

vi.mock('../middleware/auth.middleware', async () => {
  const actual = await vi.importActual('../middleware/auth.middleware');
  return {
    ...actual,
    UserRole: {
      USER: 'USER',
      BUILDER: 'BUILDER',
      ADMIN: 'ADMIN',
    },
    authenticate: (req: any, res: any, next: any) => {
      if (req.headers.authorization) {
        req.user = req.headers['x-test-user'] ? JSON.parse(req.headers['x-test-user'] as string) : null;
        next();
      } else {
        res.status(401).json({ error: { code: 'NOT_AUTHENTICATED', message: 'Authentication required' } });
      }
    },
    authorize: (...roles: any[]) => (req: any, res: any, next: any) => {
      if (req.user && roles.includes(req.user.role)) {
        next();
      } else {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
      }
    },
  };
});

const mockQuery = vi.mocked(query);
const mockGetLeadsByUser = vi.mocked(leadScoringService.getLeadsByUser);
const mockGetLeadsByProperty = vi.mocked(leadScoringService.getLeadsByProperty);
const mockGetLeadsByBuilder = vi.mocked(leadScoringService.getLeadsByBuilder);

describe('Leads Routes', () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/leads', leadsRoutes);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/leads', () => {
    it('should return all leads for admin users', async () => {
      const adminUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'admin@test.com',
        role: UserRole.ADMIN,
      };

      const mockLeads = [
        {
          id: '423e4567-e89b-12d3-a456-426614174000',
          userId: '223e4567-e89b-12d3-a456-426614174000',
          propertyId: '323e4567-e89b-12d3-a456-426614174000',
          builderId: '523e4567-e89b-12d3-a456-426614174000',
          score: 80,
          status: 'HOT',
          lastActivity: new Date(),
          createdAt: new Date(),
        },
      ];

      mockQuery.mockResolvedValueOnce({
        rows: mockLeads,
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const response = await request(app)
        .get('/api/leads')
        .set('Authorization', 'Bearer token')
        .set('x-test-user', JSON.stringify(adminUser));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.leads).toHaveLength(1);
      expect(response.body.data.count).toBe(1);
    });

    it('should return only builder\'s leads for builder users', async () => {
      const builderUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'builder@test.com',
        role: UserRole.BUILDER,
      };

      const builderId = '523e4567-e89b-12d3-a456-426614174000';

      // Mock partner lookup
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: builderId }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const mockLeads = [
        {
          id: '423e4567-e89b-12d3-a456-426614174000',
          userId: '223e4567-e89b-12d3-a456-426614174000',
          propertyId: '323e4567-e89b-12d3-a456-426614174000',
          builderId,
          score: 80,
          status: 'HOT',
          lastActivity: new Date(),
          createdAt: new Date(),
        },
      ];

      mockGetLeadsByBuilder.mockResolvedValueOnce(mockLeads);

      const response = await request(app)
        .get('/api/leads')
        .set('Authorization', 'Bearer token')
        .set('x-test-user', JSON.stringify(builderUser));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.leads).toHaveLength(1);
    });

    it('should return 403 if builder is not registered as partner', async () => {
      const builderUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'builder@test.com',
        role: UserRole.BUILDER,
      };

      // Mock partner lookup (not found)
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const response = await request(app)
        .get('/api/leads')
        .set('Authorization', 'Bearer token')
        .set('x-test-user', JSON.stringify(builderUser));

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_A_BUILDER');
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app).get('/api/leads');

      expect(response.status).toBe(401);
    });

    it('should return 403 for regular users', async () => {
      const regularUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@test.com',
        role: UserRole.USER,
      };

      const response = await request(app)
        .get('/api/leads')
        .set('Authorization', 'Bearer token')
        .set('x-test-user', JSON.stringify(regularUser));

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/leads/user/:userId', () => {
    const userId = '223e4567-e89b-12d3-a456-426614174000';

    it('should return leads for the authenticated user', async () => {
      const user = {
        id: userId,
        email: 'user@test.com',
        role: UserRole.USER,
      };

      const mockLeads = [
        {
          id: '423e4567-e89b-12d3-a456-426614174000',
          userId,
          propertyId: '323e4567-e89b-12d3-a456-426614174000',
          builderId: '523e4567-e89b-12d3-a456-426614174000',
          score: 50,
          status: 'NEW',
          lastActivity: new Date(),
          createdAt: new Date(),
        },
      ];

      mockGetLeadsByUser.mockResolvedValueOnce(mockLeads);

      const response = await request(app)
        .get(`/api/leads/user/${userId}`)
        .set('Authorization', 'Bearer token')
        .set('x-test-user', JSON.stringify(user));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.leads).toHaveLength(1);
      expect(mockGetLeadsByUser).toHaveBeenCalledWith(userId);
    });

    it('should allow admin to view any user\'s leads', async () => {
      const adminUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'admin@test.com',
        role: UserRole.ADMIN,
      };

      const mockLeads = [
        {
          id: '423e4567-e89b-12d3-a456-426614174000',
          userId,
          propertyId: '323e4567-e89b-12d3-a456-426614174000',
          builderId: '523e4567-e89b-12d3-a456-426614174000',
          score: 50,
          status: 'NEW',
          lastActivity: new Date(),
          createdAt: new Date(),
        },
      ];

      mockGetLeadsByUser.mockResolvedValueOnce(mockLeads);

      const response = await request(app)
        .get(`/api/leads/user/${userId}`)
        .set('Authorization', 'Bearer token')
        .set('x-test-user', JSON.stringify(adminUser));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 403 if user tries to view another user\'s leads', async () => {
      const user = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@test.com',
        role: UserRole.USER,
      };

      const response = await request(app)
        .get(`/api/leads/user/${userId}`)
        .set('Authorization', 'Bearer token')
        .set('x-test-user', JSON.stringify(user));

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should return 400 for invalid userId format', async () => {
      const adminUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'admin@test.com',
        role: UserRole.ADMIN,
      };

      mockGetLeadsByUser.mockRejectedValueOnce(new Error('Invalid user ID format'));

      const response = await request(app)
        .get('/api/leads/user/invalid-uuid')
        .set('Authorization', 'Bearer token')
        .set('x-test-user', JSON.stringify(adminUser));

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    });
  });

  describe('GET /api/leads/property/:propertyId', () => {
    const propertyId = '323e4567-e89b-12d3-a456-426614174000';

    it('should return leads for a property owned by the builder', async () => {
      const builderUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'builder@test.com',
        role: UserRole.BUILDER,
      };

      // Mock property ownership check
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: propertyId, builder_id: '523e4567-e89b-12d3-a456-426614174000' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const mockLeads = [
        {
          id: '423e4567-e89b-12d3-a456-426614174000',
          userId: '223e4567-e89b-12d3-a456-426614174000',
          propertyId,
          builderId: '523e4567-e89b-12d3-a456-426614174000',
          score: 70,
          status: 'NEW',
          lastActivity: new Date(),
          createdAt: new Date(),
        },
      ];

      mockGetLeadsByProperty.mockResolvedValueOnce(mockLeads);

      const response = await request(app)
        .get(`/api/leads/property/${propertyId}`)
        .set('Authorization', 'Bearer token')
        .set('x-test-user', JSON.stringify(builderUser));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.leads).toHaveLength(1);
    });

    it('should return 403 if builder tries to view leads for property they don\'t own', async () => {
      const builderUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'builder@test.com',
        role: UserRole.BUILDER,
      };

      // Mock property ownership check (not found)
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const response = await request(app)
        .get(`/api/leads/property/${propertyId}`)
        .set('Authorization', 'Bearer token')
        .set('x-test-user', JSON.stringify(builderUser));

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow admin to view leads for any property', async () => {
      const adminUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'admin@test.com',
        role: UserRole.ADMIN,
      };

      const mockLeads = [
        {
          id: '423e4567-e89b-12d3-a456-426614174000',
          userId: '223e4567-e89b-12d3-a456-426614174000',
          propertyId,
          builderId: '523e4567-e89b-12d3-a456-426614174000',
          score: 70,
          status: 'NEW',
          lastActivity: new Date(),
          createdAt: new Date(),
        },
      ];

      mockGetLeadsByProperty.mockResolvedValueOnce(mockLeads);

      const response = await request(app)
        .get(`/api/leads/property/${propertyId}`)
        .set('Authorization', 'Bearer token')
        .set('x-test-user', JSON.stringify(adminUser));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 403 for regular users', async () => {
      const regularUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@test.com',
        role: UserRole.USER,
      };

      const response = await request(app)
        .get(`/api/leads/property/${propertyId}`)
        .set('Authorization', 'Bearer token')
        .set('x-test-user', JSON.stringify(regularUser));

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/leads/builder/:builderId', () => {
    const builderId = '523e4567-e89b-12d3-a456-426614174000';

    it('should return leads for the builder', async () => {
      const builderUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'builder@test.com',
        role: UserRole.BUILDER,
      };

      // Mock partner check
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: builderId }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const mockLeads = [
        {
          id: '423e4567-e89b-12d3-a456-426614174000',
          userId: '223e4567-e89b-12d3-a456-426614174000',
          propertyId: '323e4567-e89b-12d3-a456-426614174000',
          builderId,
          score: 90,
          status: 'HOT',
          lastActivity: new Date(),
          createdAt: new Date(),
        },
      ];

      mockGetLeadsByBuilder.mockResolvedValueOnce(mockLeads);

      const response = await request(app)
        .get(`/api/leads/builder/${builderId}`)
        .set('Authorization', 'Bearer token')
        .set('x-test-user', JSON.stringify(builderUser));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.leads).toHaveLength(1);
    });

    it('should return 403 if builder tries to view another builder\'s leads', async () => {
      const builderUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'builder@test.com',
        role: UserRole.BUILDER,
      };

      // Mock partner check (not found)
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const response = await request(app)
        .get(`/api/leads/builder/${builderId}`)
        .set('Authorization', 'Bearer token')
        .set('x-test-user', JSON.stringify(builderUser));

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow admin to view any builder\'s leads', async () => {
      const adminUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'admin@test.com',
        role: UserRole.ADMIN,
      };

      const mockLeads = [
        {
          id: '423e4567-e89b-12d3-a456-426614174000',
          userId: '223e4567-e89b-12d3-a456-426614174000',
          propertyId: '323e4567-e89b-12d3-a456-426614174000',
          builderId,
          score: 90,
          status: 'HOT',
          lastActivity: new Date(),
          createdAt: new Date(),
        },
      ];

      mockGetLeadsByBuilder.mockResolvedValueOnce(mockLeads);

      const response = await request(app)
        .get(`/api/leads/builder/${builderId}`)
        .set('Authorization', 'Bearer token')
        .set('x-test-user', JSON.stringify(adminUser));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
