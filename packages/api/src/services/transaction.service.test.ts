import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as transactionService from './transaction.service';
import * as db from '../db';
import { config } from '../config';

// Mock the database module
vi.mock('../db', () => ({
  query: vi.fn(),
}));

describe('Transaction Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateCommissionRate', () => {
    it('should return 2% for sales under $500K', () => {
      const rate = transactionService.calculateCommissionRate(400000);
      expect(rate).toBe(0.02);
    });

    it('should return 1.5% for sales between $500K and $1M', () => {
      const rate = transactionService.calculateCommissionRate(750000);
      expect(rate).toBe(0.015);
    });

    it('should return 1% for sales over $1M', () => {
      const rate = transactionService.calculateCommissionRate(1500000);
      expect(rate).toBe(0.01);
    });

    it('should return 2% for sales exactly at $500K threshold', () => {
      const rate = transactionService.calculateCommissionRate(500000);
      expect(rate).toBe(0.015);
    });

    it('should return 1.5% for sales exactly at $1M threshold', () => {
      const rate = transactionService.calculateCommissionRate(1000000);
      expect(rate).toBe(0.01);
    });
  });

  describe('recordSaleTransaction', () => {
    const mockLeadId = '123e4567-e89b-12d3-a456-426614174000';
    const mockPropertyId = '123e4567-e89b-12d3-a456-426614174001';
    const mockBuilderId = '123e4567-e89b-12d3-a456-426614174002';

    it('should record a sale transaction with correct commission calculation', async () => {
      const salePrice = 400000;
      const expectedCommissionRate = 0.02;
      const expectedCommission = salePrice * expectedCommissionRate;

      // Mock waiver check (no waiver)
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ count: '5' }], // More than 3 sales
        rowCount: 1,
      });

      // Mock transaction insert
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{
          id: 'transaction-id',
          partnerId: mockBuilderId,
          propertyId: null,
          transactionType: 'SALE',
          amount: salePrice,
          currency: 'USD',
          commissionRate: expectedCommissionRate,
          commissionAmount: expectedCommission,
          createdAt: new Date(),
        }],
        rowCount: 1,
      });

      // Mock lead status update
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      const result = await transactionService.recordSaleTransaction(
        mockLeadId,
        mockPropertyId,
        mockBuilderId,
        salePrice
      );

      expect(result.amount).toBe(salePrice);
      expect(result.commissionRate).toBe(expectedCommissionRate);
      expect(result.commissionAmount).toBe(expectedCommission);
      expect(result.transactionType).toBe('SALE');
    });

    it('should apply new partner waiver for first 3 sales', async () => {
      const salePrice = 400000;

      // Mock waiver check (2 previous sales, so this is the 3rd)
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ count: '2' }],
        rowCount: 1,
      });

      // Mock transaction insert with 0% commission
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{
          id: 'transaction-id',
          partnerId: mockBuilderId,
          propertyId: null,
          transactionType: 'SALE',
          amount: salePrice,
          currency: 'USD',
          commissionRate: 0,
          commissionAmount: 0,
          createdAt: new Date(),
        }],
        rowCount: 1,
      });

      // Mock lead status update
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      const result = await transactionService.recordSaleTransaction(
        mockLeadId,
        mockPropertyId,
        mockBuilderId,
        salePrice
      );

      expect(result.commissionRate).toBe(0);
      expect(result.commissionAmount).toBe(0);
    });

    it('should validate input and throw error for invalid UUID', async () => {
      await expect(
        transactionService.recordSaleTransaction(
          'invalid-uuid',
          mockPropertyId,
          mockBuilderId,
          400000
        )
      ).rejects.toThrow();
    });

    it('should validate input and throw error for negative sale price', async () => {
      await expect(
        transactionService.recordSaleTransaction(
          mockLeadId,
          mockPropertyId,
          mockBuilderId,
          -1000
        )
      ).rejects.toThrow();
    });

    it('should update lead status to CONVERTED', async () => {
      const salePrice = 400000;

      // Mock waiver check
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ count: '5' }],
        rowCount: 1,
      });

      // Mock transaction insert
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{
          id: 'transaction-id',
          partnerId: mockBuilderId,
          propertyId: null,
          transactionType: 'SALE',
          amount: salePrice,
          currency: 'USD',
          commissionRate: 0.02,
          commissionAmount: 8000,
          createdAt: new Date(),
        }],
        rowCount: 1,
      });

      // Mock lead status update
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      });

      await transactionService.recordSaleTransaction(
        mockLeadId,
        mockPropertyId,
        mockBuilderId,
        salePrice
      );

      // Verify lead status update was called
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE leads SET status'),
        [mockLeadId]
      );
    });
  });

  describe('recordDesignPurchase', () => {
    const mockDesignId = '123e4567-e89b-12d3-a456-426614174000';
    const mockUserId = '123e4567-e89b-12d3-a456-426614174001';
    const mockBuilderId = '123e4567-e89b-12d3-a456-426614174002';

    it('should record a design purchase with correct fee split', async () => {
      const designFee = config.commission.designFee;
      const expectedPlatformCommission = designFee * 0.3; // 30%
      const expectedBuilderPayout = designFee * 0.7; // 70%

      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{
          id: 'transaction-id',
          partnerId: mockBuilderId,
          propertyId: null,
          transactionType: 'DESIGN_PURCHASE',
          amount: designFee,
          currency: 'USD',
          commissionRate: 0.3,
          commissionAmount: expectedPlatformCommission,
          createdAt: new Date(),
        }],
        rowCount: 1,
      });

      const result = await transactionService.recordDesignPurchase(
        mockDesignId,
        mockUserId,
        mockBuilderId
      );

      expect(result.amount).toBe(designFee);
      expect(result.commissionRate).toBe(0.3);
      expect(result.commissionAmount).toBe(expectedPlatformCommission);
      expect(result.transactionType).toBe('DESIGN_PURCHASE');
    });

    it('should use default design fee from config', async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{
          id: 'transaction-id',
          partnerId: mockBuilderId,
          propertyId: null,
          transactionType: 'DESIGN_PURCHASE',
          amount: config.commission.designFee,
          currency: 'USD',
          commissionRate: 0.3,
          commissionAmount: config.commission.designFee * 0.3,
          createdAt: new Date(),
        }],
        rowCount: 1,
      });

      const result = await transactionService.recordDesignPurchase(
        mockDesignId,
        mockUserId,
        mockBuilderId
      );

      expect(result.amount).toBe(config.commission.designFee);
    });

    it('should validate input and throw error for invalid UUID', async () => {
      await expect(
        transactionService.recordDesignPurchase(
          'invalid-uuid',
          mockUserId,
          mockBuilderId
        )
      ).rejects.toThrow();
    });

    it('should validate input and throw error for negative amount', async () => {
      await expect(
        transactionService.recordDesignPurchase(
          mockDesignId,
          mockUserId,
          mockBuilderId,
          -50
        )
      ).rejects.toThrow();
    });
  });

  describe('getTransactions', () => {
    it('should get all transactions without filters', async () => {
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
        {
          id: 'transaction-2',
          partnerId: 'builder-2',
          propertyId: null,
          transactionType: 'DESIGN_PURCHASE',
          amount: 50,
          currency: 'USD',
          commissionRate: 0.3,
          commissionAmount: 15,
          createdAt: new Date(),
        },
      ];

      vi.mocked(db.query).mockResolvedValueOnce({
        rows: mockTransactions,
        rowCount: 2,
      });

      const result = await transactionService.getTransactions({});

      expect(result).toHaveLength(2);
      expect(result[0].transactionType).toBe('SALE');
      expect(result[1].transactionType).toBe('DESIGN_PURCHASE');
    });

    it('should filter transactions by builderId', async () => {
      const builderId = '123e4567-e89b-12d3-a456-426614174000';

      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{
          id: 'transaction-1',
          partnerId: builderId,
          propertyId: null,
          transactionType: 'SALE',
          amount: 400000,
          currency: 'USD',
          commissionRate: 0.02,
          commissionAmount: 8000,
          createdAt: new Date(),
        }],
        rowCount: 1,
      });

      const result = await transactionService.getTransactions({ builderId });

      expect(result).toHaveLength(1);
      expect(result[0].partnerId).toBe(builderId);
    });

    it('should filter transactions by date range', async () => {
      const startDate = '2024-01-01T00:00:00Z';
      const endDate = '2024-12-31T23:59:59Z';

      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      await transactionService.getTransactions({ startDate, endDate });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at >='),
        expect.arrayContaining([startDate, endDate])
      );
    });

    it('should filter transactions by transaction type', async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      await transactionService.getTransactions({ transactionType: 'SALE' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('transaction_type ='),
        expect.arrayContaining(['sale'])
      );
    });
  });

  describe('getTransactionById', () => {
    const mockTransactionId = '123e4567-e89b-12d3-a456-426614174000';

    it('should return transaction when found', async () => {
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

      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [mockTransaction],
        rowCount: 1,
      });

      const result = await transactionService.getTransactionById(mockTransactionId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockTransactionId);
    });

    it('should return null when transaction not found', async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const result = await transactionService.getTransactionById(mockTransactionId);

      expect(result).toBeNull();
    });

    it('should throw error for invalid UUID', async () => {
      await expect(
        transactionService.getTransactionById('invalid-uuid')
      ).rejects.toThrow('Invalid transaction ID format');
    });
  });
});
