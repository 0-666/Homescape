import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express, { Application } from 'express';
import transactionsRoutes from './transactions.routes';
import * as transactionService from '../services/transaction.service';
import * as db from '../db';
import { UserRole } from '../middleware/auth.middleware';

// Mock dependencies
vi.mock('../services/transaction.service');
vi.mock('../db');
vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (!req.headers.authorization) {
      return res.status(401).json({
        success: false,
        error: { code: 'NOT_AUTHENTICATED', message: 'Authentication required' },
      });
    }
    req.user = req.headers['x-test-user'] ? JSON.parse(req.headers['x-test-user'] as string) : null;
    next();
  },
  authorize: (...roles: any[]) => (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
    }
    next();
  },
  UserRole: {
    USER: 'USER',
    BUILDER: 'BUILDER',
    ADMIN: 'ADMIN',
  },
}));

describe('Transactions Routes', () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/transactions', transactionsRoutes);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/transactions/sale', () => {
    const mockSaleData = {
      leadId: '123e4567-e89b-12d3-a456-426614174000',
      propertyId: '123e4567-e89b-12d3-a456-426614174001',
      builderId: '123e4567-e89b-12d3-a456-426614174002',
      salePrice: 400000,
      currency: 'USD',
    };

    it('should record a sale transaction as admin', async () => {
      const mockTransaction = {
        id: 'transaction-id',
        partnerId: mockSaleData.builderId,
        propertyId: null,
        transactionType: 'SALE',
        amount: mockSaleData.salePrice,
        currency: 'USD',
        commissionRate: 0.02,
        commissionAmount: 8000,
        createdAt: new Date(),
      };

      vi.mocked(transactionService.recordSaleTransaction).mockResolvedValueOnce(mockTransaction);

      const response = await request(app)
        .post('/api/transactions/sale')
        .set('Authorization', 'Bearer admin-token')
        .set('x-test-user', JSON.stringify({ id: 'admin-id', role: UserRole.ADMIN }))
        .send(mockSaleData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transaction).toEqual(mockTransaction);
    });

    it('should record a sale transaction as builder for own property', async () => {
      const builderId = '123e4567-e89b-12d3-a456-426614174002';
      const mockTransaction = {
        id: 'transaction-id',
        partnerId: builderId,
        propertyId: null,
        transactionType: 'SALE',
        amount: mockSaleData.salePrice,
        currency: 'USD',
        commissionRate: 0.02,
        commissionAmount: 8000,
        createdAt: new Date(),
      };

      // Mock partner lookup
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ id: builderId }],
        rowCount: 1,
      });

      vi.mocked(transactionService.recordSaleTransaction).mockResolvedValueOnce(mockTransaction);

      const response = await request(app)
        .post('/api/transactions/sale')
        .set('Authorization', 'Bearer builder-token')
        .set('x-test-user', JSON.stringify({ id: 'builder-user-id', role: UserRole.BUILDER }))
        .send(mockSaleData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should reject builder recording sale for another builder', async () => {
      const builderId = 'different-builder-id';

      // Mock partner lookup
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ id: builderId }],
        rowCount: 1,
      });

      const response = await request(app)
        .post('/api/transactions/sale')
        .set('Authorization', 'Bearer builder-token')
        .set('x-test-user', JSON.stringify({ id: 'builder-user-id', role: UserRole.BUILDER }))
        .send(mockSaleData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/transactions/sale')
        .send(mockSaleData);

      expect(response.status).toBe(401);
    });

    it('should reject user role', async () => {
      const response = await request(app)
        .post('/api/transactions/sale')
        .set('Authorization', 'Bearer user-token')
        .set('x-test-user', JSON.stringify({ id: 'user-id', role: UserRole.USER }))
        .send(mockSaleData);

      expect(response.status).toBe(403);
    });

    it('should handle validation errors', async () => {
      vi.mocked(transactionService.recordSaleTransaction).mockRejectedValueOnce(
        new Error('Invalid lead ID format')
      );

      // Mock partner lookup for builder
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ id: mockSaleData.builderId }],
        rowCount: 1,
      });

      const response = await request(app)
        .post('/api/transactions/sale')
        .set('Authorization', 'Bearer builder-token')
        .set('x-test-user', JSON.stringify({ id: 'builder-user-id', role: UserRole.BUILDER }))
        .send({ ...mockSaleData, leadId: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    });
  });

  describe('POST /api/transactions/design', () => {
    const mockDesignData = {
      designId: '123e4567-e89b-12d3-a456-426614174000',
      userId: '123e4567-e89b-12d3-a456-426614174001',
      builderId: '123e4567-e89b-12d3-a456-426614174002',
      amount: 50,
      currency: 'USD',
    };

    it('should record a design purchase as admin', async () => {
      const mockTransaction = {
        id: 'transaction-id',
        partnerId: mockDesignData.builderId,
        propertyId: null,
        transactionType: 'DESIGN_PURCHASE',
        amount: mockDesignData.amount,
        currency: 'USD',
        commissionRate: 0.3,
        commissionAmount: 15,
        createdAt: new Date(),
      };

      vi.mocked(transactionService.recordDesignPurchase).mockResolvedValueOnce(mockTransaction);

      const response = await request(app)
        .post('/api/transactions/design')
        .set('Authorization', 'Bearer admin-token')
        .set('x-test-user', JSON.stringify({ id: 'admin-id', role: UserRole.ADMIN }))
        .send(mockDesignData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transaction).toEqual(mockTransaction);
    });

    it('should record a design purchase as builder for own design', async () => {
      const builderId = '123e4567-e89b-12d3-a456-426614174002';
      const mockTransaction = {
        id: 'transaction-id',
        partnerId: builderId,
        propertyId: null,
        transactionType: 'DESIGN_PURCHASE',
        amount: mockDesignData.amount,
        currency: 'USD',
        commissionRate: 0.3,
        commissionAmount: 15,
        createdAt: new Date(),
      };

      // Mock partner lookup
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ id: builderId }],
        rowCount: 1,
      });

      vi.mocked(transactionService.recordDesignPurchase).mockResolvedValueOnce(mockTransaction);

      const response = await request(app)
        .post('/api/transactions/design')
        .set('Authorization', 'Bearer builder-token')
        .set('x-test-user', JSON.stringify({ id: 'builder-user-id', role: UserRole.BUILDER }))
        .send(mockDesignData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should reject builder recording design purchase for another builder', async () => {
      const builderId = 'different-builder-id';

      // Mock partner lookup
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ id: builderId }],
        rowCount: 1,
      });

      const response = await request(app)
        .post('/api/transactions/design')
        .set('Authorization', 'Bearer builder-token')
        .set('x-test-user', JSON.stringify({ id: 'builder-user-id', role: UserRole.BUILDER }))
        .send(mockDesignData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/transactions', () => {
    it('should get all transactions as admin', async () => {
      const mockTransactions = [
        {
          id: 'transaction-1',
          partnerId: 'builder-1',
          propertyId: null,
          transactionType: 'SALE',
          amount: 400000,
          currency: 'USD',
          commissionRate: 0.02,
          commissionAmount: 8000,
          createdAt: new Date(),
        },
      ];

      vi.mocked(transactionService.getTransactions).mockResolvedValueOnce(mockTransactions);

      const response = await request(app)
        .get('/api/transactions')
        .set('Authorization', 'Bearer admin-token')
        .set('x-test-user', JSON.stringify({ id: 'admin-id', role: UserRole.ADMIN }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions).toEqual(mockTransactions);
      expect(response.body.data.count).toBe(1);
    });

    it('should get only own transactions as builder', async () => {
      const builderId = '123e4567-e89b-12d3-a456-426614174002';
      const mockTransactions = [
        {
          id: 'transaction-1',
          partnerId: builderId,
          propertyId: null,
          transactionType: 'SALE',
          amount: 400000,
          currency: 'USD',
          commissionRate: 0.02,
          commissionAmount: 8000,
          createdAt: new Date(),
        },
      ];

      // Mock partner lookup
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ id: builderId }],
        rowCount: 1,
      });

      vi.mocked(transactionService.getTransactions).mockResolvedValueOnce(mockTransactions);

      const response = await request(app)
        .get('/api/transactions')
        .set('Authorization', 'Bearer builder-token')
        .set('x-test-user', JSON.stringify({ id: 'builder-user-id', role: UserRole.BUILDER }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(transactionService.getTransactions).toHaveBeenCalledWith(
        expect.objectContaining({ builderId })
      );
    });

    it('should filter transactions by query parameters', async () => {
      vi.mocked(transactionService.getTransactions).mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/transactions')
        .query({
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-12-31T23:59:59Z',
          transactionType: 'SALE',
        })
        .set('Authorization', 'Bearer admin-token')
        .set('x-test-user', JSON.stringify({ id: 'admin-id', role: UserRole.ADMIN }));

      expect(response.status).toBe(200);
      expect(transactionService.getTransactions).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-12-31T23:59:59Z',
          transactionType: 'SALE',
        })
      );
    });
  });

  describe('GET /api/transactions/:transactionId', () => {
    const mockTransactionId = '123e4567-e89b-12d3-a456-426614174000';

    it('should get transaction by ID as admin', async () => {
      const mockTransaction = {
        id: mockTransactionId,
        partnerId: 'builder-1',
        propertyId: null,
        transactionType: 'SALE',
        amount: 400000,
        currency: 'USD',
        commissionRate: 0.02,
        commissionAmount: 8000,
        createdAt: new Date(),
      };

      vi.mocked(transactionService.getTransactionById).mockResolvedValueOnce(mockTransaction);

      const response = await request(app)
        .get(`/api/transactions/${mockTransactionId}`)
        .set('Authorization', 'Bearer admin-token')
        .set('x-test-user', JSON.stringify({ id: 'admin-id', role: UserRole.ADMIN }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transaction).toEqual(mockTransaction);
    });

    it('should get own transaction as builder', async () => {
      const builderId = '123e4567-e89b-12d3-a456-426614174002';
      const mockTransaction = {
        id: mockTransactionId,
        partnerId: builderId,
        propertyId: null,
        transactionType: 'SALE',
        amount: 400000,
        currency: 'USD',
        commissionRate: 0.02,
        commissionAmount: 8000,
        createdAt: new Date(),
      };

      vi.mocked(transactionService.getTransactionById).mockResolvedValueOnce(mockTransaction);

      // Mock partner lookup
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ id: builderId }],
        rowCount: 1,
      });

      const response = await request(app)
        .get(`/api/transactions/${mockTransactionId}`)
        .set('Authorization', 'Bearer builder-token')
        .set('x-test-user', JSON.stringify({ id: 'builder-user-id', role: UserRole.BUILDER }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject builder viewing another builder transaction', async () => {
      const builderId = 'different-builder-id';
      const mockTransaction = {
        id: mockTransactionId,
        partnerId: 'another-builder',
        propertyId: null,
        transactionType: 'SALE',
        amount: 400000,
        currency: 'USD',
        commissionRate: 0.02,
        commissionAmount: 8000,
        createdAt: new Date(),
      };

      vi.mocked(transactionService.getTransactionById).mockResolvedValueOnce(mockTransaction);

      // Mock partner lookup
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ id: builderId }],
        rowCount: 1,
      });

      const response = await request(app)
        .get(`/api/transactions/${mockTransactionId}`)
        .set('Authorization', 'Bearer builder-token')
        .set('x-test-user', JSON.stringify({ id: 'builder-user-id', role: UserRole.BUILDER }));

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should return 404 when transaction not found', async () => {
      vi.mocked(transactionService.getTransactionById).mockResolvedValueOnce(null);

      const response = await request(app)
        .get(`/api/transactions/${mockTransactionId}`)
        .set('Authorization', 'Bearer admin-token')
        .set('x-test-user', JSON.stringify({ id: 'admin-id', role: UserRole.ADMIN }));

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TRANSACTION_NOT_FOUND');
    });
  });
});
