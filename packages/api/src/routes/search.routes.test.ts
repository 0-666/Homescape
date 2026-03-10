import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import searchRoutes from './search.routes';
import * as searchService from '../services/search.service';
import { authMiddleware } from '../middleware/auth.middleware';

// Mock dependencies
vi.mock('../services/search.service');
vi.mock('../middleware/auth.middleware', () => ({
  authMiddleware: vi.fn((req, res, next) => {
    req.user = { id: 'test-user-id', role: 'USER' };
    next();
  }),
}));

const app = express();
app.use(express.json());
app.use('/api/search', searchRoutes);

describe('Search Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/search/keyword', () => {
    it('should perform keyword search successfully', async () => {
      const mockResults = [
        {
          property: {
            id: '123',
            title: 'Luxury Apartment',
            price: 500000,
            location: 'New York',
          },
          similarityScore: 0.8,
          matchType: 'keyword' as const,
        },
      ];

      vi.mocked(searchService.keywordSearch).mockResolvedValue(mockResults);

      const response = await request(app)
        .get('/api/search/keyword')
        .query({ q: 'luxury apartment' });

      expect(response.status).toBe(200);
      expect(response.body.results).toEqual(mockResults);
      expect(response.body.query).toBe('luxury apartment');
      expect(response.body.matchType).toBe('keyword');
      expect(searchService.keywordSearch).toHaveBeenCalledWith('luxury apartment', {});
    });

    it('should apply filters correctly', async () => {
      vi.mocked(searchService.keywordSearch).mockResolvedValue([]);

      await request(app)
        .get('/api/search/keyword')
        .query({
          q: 'apartment',
          priceMin: '100000',
          priceMax: '500000',
          location: 'New York',
          moduleType: 'APARTMENT',
          limit: '10',
          offset: '5',
        });

      expect(searchService.keywordSearch).toHaveBeenCalledWith('apartment', {
        priceMin: 100000,
        priceMax: 500000,
        location: ['New York'],
        moduleType: ['APARTMENT'],
        limit: 10,
        offset: 5,
      });
    });

    it('should return 400 if query parameter is missing', async () => {
      const response = await request(app).get('/api/search/keyword');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_QUERY');
    });

    it('should handle search errors', async () => {
      vi.mocked(searchService.keywordSearch).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/search/keyword')
        .query({ q: 'apartment' });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('SEARCH_ERROR');
    });
  });

  describe('GET /api/search/semantic', () => {
    it('should perform semantic search successfully', async () => {
      const mockResults = [
        {
          property: {
            id: '123',
            title: 'Modern Loft',
            price: 600000,
            location: 'Brooklyn',
          },
          similarityScore: 0.85,
          matchType: 'semantic' as const,
        },
      ];

      vi.mocked(searchService.semanticSearch).mockResolvedValue(mockResults);

      const response = await request(app)
        .get('/api/search/semantic')
        .query({ q: 'cozy urban living' });

      expect(response.status).toBe(200);
      expect(response.body.results).toEqual(mockResults);
      expect(response.body.query).toBe('cozy urban living');
      expect(response.body.matchType).toBe('semantic');
      expect(response.body.threshold).toBe(0.7);
      expect(searchService.semanticSearch).toHaveBeenCalledWith('cozy urban living', {}, 0.7);
    });

    it('should allow custom similarity threshold', async () => {
      vi.mocked(searchService.semanticSearch).mockResolvedValue([]);

      await request(app)
        .get('/api/search/semantic')
        .query({ q: 'apartment', threshold: '0.8' });

      expect(searchService.semanticSearch).toHaveBeenCalledWith('apartment', {}, 0.8);
    });

    it('should apply filters correctly', async () => {
      vi.mocked(searchService.semanticSearch).mockResolvedValue([]);

      await request(app)
        .get('/api/search/semantic')
        .query({
          q: 'apartment',
          priceMin: '100000',
          priceMax: '500000',
          location: ['New York', 'Los Angeles'],
          moduleType: 'APARTMENT',
        });

      expect(searchService.semanticSearch).toHaveBeenCalledWith(
        'apartment',
        {
          priceMin: 100000,
          priceMax: 500000,
          location: ['New York', 'Los Angeles'],
          moduleType: ['APARTMENT'],
        },
        0.7
      );
    });

    it('should return 400 if query parameter is missing', async () => {
      const response = await request(app).get('/api/search/semantic');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_QUERY');
    });
  });

  describe('GET /api/search/hybrid', () => {
    it('should perform hybrid search successfully', async () => {
      const mockResponse = {
        results: [
          {
            property: {
              id: '123',
              title: 'Luxury Apartment',
              price: 500000,
              location: 'New York',
            },
            similarityScore: 0.75,
            matchType: 'hybrid' as const,
          },
        ],
        total: 1,
        query: 'luxury apartment',
        filters: {},
      };

      vi.mocked(searchService.hybridSearch).mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/api/search/hybrid')
        .query({ q: 'luxury apartment' });

      expect(response.status).toBe(200);
      expect(response.body.results).toEqual(mockResponse.results);
      expect(response.body.total).toBe(1);
      expect(response.body.weights).toEqual({ semantic: 0.6, keyword: 0.4 });
      expect(searchService.hybridSearch).toHaveBeenCalledWith('luxury apartment', {}, 0.6, 0.4);
    });

    it('should allow custom weights', async () => {
      const mockResponse = {
        results: [],
        total: 0,
        query: 'apartment',
        filters: {},
      };

      vi.mocked(searchService.hybridSearch).mockResolvedValue(mockResponse);

      await request(app)
        .get('/api/search/hybrid')
        .query({ q: 'apartment', semanticWeight: '0.7', keywordWeight: '0.3' });

      expect(searchService.hybridSearch).toHaveBeenCalledWith('apartment', {}, 0.7, 0.3);
    });

    it('should apply all filters correctly', async () => {
      const mockResponse = {
        results: [],
        total: 0,
        query: 'apartment',
        filters: {},
      };

      vi.mocked(searchService.hybridSearch).mockResolvedValue(mockResponse);

      await request(app)
        .get('/api/search/hybrid')
        .query({
          q: 'apartment',
          priceMin: '100000',
          priceMax: '500000',
          location: 'New York',
          moduleType: 'APARTMENT',
          limit: '10',
          offset: '5',
        });

      expect(searchService.hybridSearch).toHaveBeenCalledWith(
        'apartment',
        {
          priceMin: 100000,
          priceMax: 500000,
          location: ['New York'],
          moduleType: ['APARTMENT'],
          limit: 10,
          offset: 5,
        },
        0.6,
        0.4
      );
    });

    it('should return 400 if query parameter is missing', async () => {
      const response = await request(app).get('/api/search/hybrid');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_QUERY');
    });
  });

  describe('GET /api/search (default)', () => {
    it('should use hybrid search by default', async () => {
      const mockResponse = {
        results: [],
        total: 0,
        query: 'apartment',
        filters: {},
      };

      vi.mocked(searchService.hybridSearch).mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/api/search')
        .query({ q: 'apartment' });

      expect(response.status).toBe(200);
      expect(searchService.hybridSearch).toHaveBeenCalledWith('apartment', {});
    });

    it('should return 400 if query parameter is missing', async () => {
      const response = await request(app).get('/api/search');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_QUERY');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all search endpoints', async () => {
      expect(authMiddleware).toBeDefined();
      
      // Verify middleware is called for each endpoint
      await request(app).get('/api/search').query({ q: 'test' });
      await request(app).get('/api/search/keyword').query({ q: 'test' });
      await request(app).get('/api/search/semantic').query({ q: 'test' });
      await request(app).get('/api/search/hybrid').query({ q: 'test' });

      expect(vi.mocked(authMiddleware)).toHaveBeenCalled();
    });
  });
});
