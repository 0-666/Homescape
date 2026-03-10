import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import moduleRegistryRoutes from './module-registry.routes';
import * as moduleRegistry from '../services/module-registry.service';
import * as authMiddleware from '../middleware/auth.middleware';

// Mock the services and middleware
vi.mock('../services/module-registry.service');
vi.mock('../middleware/auth.middleware');

const mockModuleRegistry = vi.mocked(moduleRegistry);
const mockAuthMiddleware = vi.mocked(authMiddleware);

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/modules', moduleRegistryRoutes);

describe('Module Registry Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock authenticate middleware to pass through
    mockAuthMiddleware.authenticate.mockImplementation((req, res, next) => {
      (req as any).user = { id: 'user-123', role: 'ADMIN' };
      next();
    });
    
    // Mock requireAdmin middleware to pass through
    mockAuthMiddleware.requireAdmin.mockImplementation((req, res, next) => {
      next();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/modules', () => {
    it('should register a new module', async () => {
      const newModule = {
        id: '123',
        type: 'RENTAL',
        version: '1.0.0',
        schema: {
          fields: [
            { name: 'bedrooms', type: 'number', required: true },
          ],
        },
        active: true,
        createdAt: new Date(),
      };

      mockModuleRegistry.registerModule.mockResolvedValue(newModule);

      const response = await request(app)
        .post('/api/modules')
        .send({
          type: 'RENTAL',
          version: '1.0.0',
          schema: {
            fields: [
              { name: 'bedrooms', type: 'number', required: true },
            ],
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('RENTAL');
      expect(response.body.data.version).toBe('1.0.0');
      expect(response.body.data.active).toBe(true);
    });

    it('should return 400 for invalid input', async () => {
      mockModuleRegistry.registerModule.mockRejectedValue(
        new Error('Module type already exists')
      );

      const response = await request(app)
        .post('/api/modules')
        .send({
          type: 'APARTMENT',
          version: '1.0.0',
          schema: { fields: [] },
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Module type already exists');
    });
  });

  describe('GET /api/modules', () => {
    it('should list all modules', async () => {
      const modules = [
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

      mockModuleRegistry.listModules.mockResolvedValue(modules);

      const response = await request(app).get('/api/modules');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should list only active modules when activeOnly=true', async () => {
      const modules = [
        {
          id: '1',
          type: 'APARTMENT',
          version: '1.0.0',
          schema: { fields: [] },
          active: true,
          createdAt: new Date(),
        },
      ];

      mockModuleRegistry.listModules.mockResolvedValue(modules);

      const response = await request(app).get('/api/modules?activeOnly=true');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(mockModuleRegistry.listModules).toHaveBeenCalledWith(true);
    });
  });

  describe('GET /api/modules/:type', () => {
    it('should get a module by type', async () => {
      const module = {
        id: '1',
        type: 'APARTMENT',
        version: '1.0.0',
        schema: { fields: [] },
        active: true,
        createdAt: new Date(),
      };

      mockModuleRegistry.getModule.mockResolvedValue(module);

      const response = await request(app).get('/api/modules/APARTMENT');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('APARTMENT');
    });

    it('should return 404 if module not found', async () => {
      mockModuleRegistry.getModule.mockResolvedValue(null);

      const response = await request(app).get('/api/modules/NONEXISTENT');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('PATCH /api/modules/:type', () => {
    it('should update a module', async () => {
      const updatedModule = {
        id: '1',
        type: 'APARTMENT',
        version: '1.1.0',
        schema: { fields: [] },
        active: true,
        createdAt: new Date(),
      };

      mockModuleRegistry.updateModule.mockResolvedValue(updatedModule);

      const response = await request(app)
        .patch('/api/modules/APARTMENT')
        .send({ version: '1.1.0' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.version).toBe('1.1.0');
    });

    it('should return 400 if update fails', async () => {
      mockModuleRegistry.updateModule.mockRejectedValue(
        new Error('Module not found')
      );

      const response = await request(app)
        .patch('/api/modules/NONEXISTENT')
        .send({ version: '2.0.0' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/modules/:type', () => {
    it('should delete a module', async () => {
      mockModuleRegistry.deleteModule.mockResolvedValue(undefined);

      const response = await request(app).delete('/api/modules/RENTAL');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
    });

    it('should return 400 if deletion fails', async () => {
      mockModuleRegistry.deleteModule.mockRejectedValue(
        new Error('Cannot delete module because properties are using it')
      );

      const response = await request(app).delete('/api/modules/APARTMENT');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/modules/:type/enable', () => {
    it('should enable a module', async () => {
      const enabledModule = {
        id: '1',
        type: 'RENTAL',
        version: '1.0.0',
        schema: { fields: [] },
        active: true,
        createdAt: new Date(),
      };

      mockModuleRegistry.enableModule.mockResolvedValue(enabledModule);

      const response = await request(app).post('/api/modules/RENTAL/enable');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.active).toBe(true);
    });
  });

  describe('POST /api/modules/:type/disable', () => {
    it('should disable a module', async () => {
      const disabledModule = {
        id: '1',
        type: 'RENTAL',
        version: '1.0.0',
        schema: { fields: [] },
        active: false,
        createdAt: new Date(),
      };

      mockModuleRegistry.disableModule.mockResolvedValue(disabledModule);

      const response = await request(app).post('/api/modules/RENTAL/disable');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.active).toBe(false);
    });
  });

  describe('POST /api/modules/:type/validate', () => {
    it('should validate property data successfully', async () => {
      const module = {
        id: '1',
        type: 'APARTMENT',
        version: '1.0.0',
        schema: {
          fields: [
            { name: 'bedrooms', type: 'number' as const, required: true },
            { name: 'bathrooms', type: 'number' as const, required: true },
          ],
        },
        active: true,
        createdAt: new Date(),
      };

      const validationResult = {
        valid: true,
        errors: [],
      };

      mockModuleRegistry.getModule.mockResolvedValue(module);
      mockModuleRegistry.validatePropertyData.mockReturnValue(validationResult);

      const response = await request(app)
        .post('/api/modules/APARTMENT/validate')
        .send({
          bedrooms: 2,
          bathrooms: 2,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
    });

    it('should return validation errors for invalid data', async () => {
      const module = {
        id: '1',
        type: 'APARTMENT',
        version: '1.0.0',
        schema: {
          fields: [
            { name: 'bedrooms', type: 'number' as const, required: true },
            { name: 'bathrooms', type: 'number' as const, required: true },
          ],
        },
        active: true,
        createdAt: new Date(),
      };

      const validationResult = {
        valid: false,
        errors: ["Field 'bathrooms' is required"],
      };

      mockModuleRegistry.getModule.mockResolvedValue(module);
      mockModuleRegistry.validatePropertyData.mockReturnValue(validationResult);

      const response = await request(app)
        .post('/api/modules/APARTMENT/validate')
        .send({
          bedrooms: 2,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.errors).toHaveLength(1);
    });

    it('should return 404 if module not found', async () => {
      mockModuleRegistry.getModule.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/modules/NONEXISTENT/validate')
        .send({ bedrooms: 2 });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
