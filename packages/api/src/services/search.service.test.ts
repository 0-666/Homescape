import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as searchService from './search.service';
import { pool } from '../db';
import { embeddingsService } from './embeddings.service';
import * as redis from '../cache/redis';

// Mock dependencies
vi.mock('../db', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('./embeddings.service', () => ({
  embeddingsService: {
    instance: {
      generateEmbedding: vi.fn(),
    },
  },
}));

vi.mock('../cache/redis', () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

describe('Search Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('keywordSearch', () => {
    it('should perform keyword search and return results', async () => {
      const mockResults = {
        rows: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            builderId: '123e4567-e89b-12d3-a456-426614174001',
            moduleType: 'APARTMENT',
            title: 'Luxury Apartment',
            description: 'Beautiful apartment in downtown',
            price: '500000.00',
            currency: 'USD',
            location: 'New York',
            images: ['image1.jpg'],
            moduleData: { bedrooms: 2, bathrooms: 2 },
            status: 'AVAILABLE',
            createdAt: new Date(),
            updatedAt: new Date(),
            rank: 0.8,
          },
        ],
      };

      vi.mocked(pool.query).mockResolvedValue(mockResults as any);

      const results = await searchService.keywordSearch('luxury apartment');

      expect(results).toHaveLength(1);
      expect(results[0].property.title).toBe('Luxury Apartment');
      expect(results[0].matchType).toBe('keyword');
      expect(results[0].similarityScore).toBe(0.8);
      expect(pool.query).toHaveBeenCalledOnce();
    });

    it('should apply price filters correctly', async () => {
      const mockResults = { rows: [] };
      vi.mocked(pool.query).mockResolvedValue(mockResults as any);

      await searchService.keywordSearch('apartment', {
        priceMin: 100000,
        priceMax: 500000,
      });

      const queryCall = vi.mocked(pool.query).mock.calls[0];
      expect(queryCall[0]).toContain('price >= $');
      expect(queryCall[0]).toContain('price <= $');
      expect(queryCall[1]).toContain(100000);
      expect(queryCall[1]).toContain(500000);
    });

    it('should apply location filters correctly', async () => {
      const mockResults = { rows: [] };
      vi.mocked(pool.query).mockResolvedValue(mockResults as any);

      await searchService.keywordSearch('apartment', {
        location: ['New York', 'Los Angeles'],
      });

      const queryCall = vi.mocked(pool.query).mock.calls[0];
      expect(queryCall[0]).toContain('location = ANY($');
      expect(queryCall[1]).toEqual(expect.arrayContaining([['New York', 'Los Angeles']]));
    });

    it('should apply module type filters correctly', async () => {
      const mockResults = { rows: [] };
      vi.mocked(pool.query).mockResolvedValue(mockResults as any);

      await searchService.keywordSearch('apartment', {
        moduleType: ['APARTMENT'],
      });

      const queryCall = vi.mocked(pool.query).mock.calls[0];
      expect(queryCall[0]).toContain('module_type = ANY($');
      expect(queryCall[1]).toEqual(expect.arrayContaining([['APARTMENT']]));
    });

    it('should apply pagination correctly', async () => {
      const mockResults = { rows: [] };
      vi.mocked(pool.query).mockResolvedValue(mockResults as any);

      await searchService.keywordSearch('apartment', {
        limit: 10,
        offset: 20,
      });

      const queryCall = vi.mocked(pool.query).mock.calls[0];
      expect(queryCall[0]).toContain('LIMIT');
      expect(queryCall[0]).toContain('OFFSET');
      expect(queryCall[1]).toContain(10);
      expect(queryCall[1]).toContain(20);
    });

    it('should throw error for empty query', async () => {
      await expect(searchService.keywordSearch('')).rejects.toThrow(
        'Search query cannot be empty'
      );
    });

    it('should only return AVAILABLE properties', async () => {
      const mockResults = { rows: [] };
      vi.mocked(pool.query).mockResolvedValue(mockResults as any);

      await searchService.keywordSearch('apartment');

      const queryCall = vi.mocked(pool.query).mock.calls[0];
      expect(queryCall[0]).toContain("status = 'AVAILABLE'");
    });
  });

  describe('semanticSearch', () => {
    it('should perform semantic search and return results', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(embeddingsService.instance.generateEmbedding).mockResolvedValue(mockEmbedding);

      const mockResults = {
        rows: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            builderId: '123e4567-e89b-12d3-a456-426614174001',
            moduleType: 'APARTMENT',
            title: 'Modern Loft',
            description: 'Spacious loft with great vibes',
            price: '600000.00',
            currency: 'USD',
            location: 'Brooklyn',
            images: ['image1.jpg'],
            moduleData: { bedrooms: 1, bathrooms: 1 },
            status: 'AVAILABLE',
            createdAt: new Date(),
            updatedAt: new Date(),
            similarity: 0.85,
          },
        ],
      };

      vi.mocked(pool.query).mockResolvedValue(mockResults as any);

      const results = await searchService.semanticSearch('cozy urban living space');

      expect(results).toHaveLength(1);
      expect(results[0].property.title).toBe('Modern Loft');
      expect(results[0].matchType).toBe('semantic');
      expect(results[0].similarityScore).toBe(0.85);
      expect(embeddingsService.instance.generateEmbedding).toHaveBeenCalledWith(
        'cozy urban living space'
      );
    });

    it('should enforce similarity threshold of 0.7', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(embeddingsService.instance.generateEmbedding).mockResolvedValue(mockEmbedding);

      const mockResults = { rows: [] };
      vi.mocked(pool.query).mockResolvedValue(mockResults as any);

      await searchService.semanticSearch('apartment');

      const queryCall = vi.mocked(pool.query).mock.calls[0];
      expect(queryCall[0]).toContain('>= 0.7');
    });

    it('should allow custom similarity threshold', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(embeddingsService.instance.generateEmbedding).mockResolvedValue(mockEmbedding);

      const mockResults = { rows: [] };
      vi.mocked(pool.query).mockResolvedValue(mockResults as any);

      await searchService.semanticSearch('apartment', {}, 0.8);

      const queryCall = vi.mocked(pool.query).mock.calls[0];
      expect(queryCall[0]).toContain('>= 0.8');
    });

    it('should only search properties with embeddings', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(embeddingsService.instance.generateEmbedding).mockResolvedValue(mockEmbedding);

      const mockResults = { rows: [] };
      vi.mocked(pool.query).mockResolvedValue(mockResults as any);

      await searchService.semanticSearch('apartment');

      const queryCall = vi.mocked(pool.query).mock.calls[0];
      expect(queryCall[0]).toContain('embedding IS NOT NULL');
    });

    it('should throw error for empty query', async () => {
      await expect(searchService.semanticSearch('')).rejects.toThrow(
        'Search query cannot be empty'
      );
    });
  });

  describe('hybridSearch', () => {
    it('should perform hybrid search combining semantic and keyword', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(embeddingsService.instance.generateEmbedding).mockResolvedValue(mockEmbedding);

      const mockResults = {
        rows: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            builderId: '123e4567-e89b-12d3-a456-426614174001',
            moduleType: 'APARTMENT',
            title: 'Luxury Apartment',
            description: 'Beautiful apartment in downtown',
            price: '500000.00',
            currency: 'USD',
            location: 'New York',
            images: ['image1.jpg'],
            moduleData: { bedrooms: 2, bathrooms: 2 },
            status: 'AVAILABLE',
            createdAt: new Date(),
            updatedAt: new Date(),
            hybrid_score: 0.75,
            semantic_score: 0.8,
            keyword_score: 0.65,
          },
        ],
      };

      const mockCountResult = {
        rows: [{ count: '1' }],
      };

      vi.mocked(pool.query)
        .mockResolvedValueOnce(mockResults as any)
        .mockResolvedValueOnce(mockCountResult as any);

      const response = await searchService.hybridSearch('luxury apartment downtown');

      expect(response.results).toHaveLength(1);
      expect(response.results[0].property.title).toBe('Luxury Apartment');
      expect(response.results[0].matchType).toBe('hybrid');
      expect(response.results[0].similarityScore).toBe(0.75);
      expect(response.total).toBe(1);
      expect(response.query).toBe('luxury apartment downtown');
    });

    it('should use default weights of 0.6 semantic and 0.4 keyword', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(embeddingsService.instance.generateEmbedding).mockResolvedValue(mockEmbedding);

      const mockResults = { rows: [] };
      const mockCountResult = { rows: [{ count: '0' }] };

      vi.mocked(pool.query)
        .mockResolvedValueOnce(mockResults as any)
        .mockResolvedValueOnce(mockCountResult as any);

      await searchService.hybridSearch('apartment');

      const queryCall = vi.mocked(pool.query).mock.calls[0];
      expect(queryCall[0]).toContain('* 0.6');
      expect(queryCall[0]).toContain('* 0.4');
    });

    it('should allow custom weights', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(embeddingsService.instance.generateEmbedding).mockResolvedValue(mockEmbedding);

      const mockResults = { rows: [] };
      const mockCountResult = { rows: [{ count: '0' }] };

      vi.mocked(pool.query)
        .mockResolvedValueOnce(mockResults as any)
        .mockResolvedValueOnce(mockCountResult as any);

      await searchService.hybridSearch('apartment', {}, 0.7, 0.3);

      const queryCall = vi.mocked(pool.query).mock.calls[0];
      expect(queryCall[0]).toContain('* 0.7');
      expect(queryCall[0]).toContain('* 0.3');
    });

    it('should apply all filters correctly', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(embeddingsService.instance.generateEmbedding).mockResolvedValue(mockEmbedding);

      const mockResults = { rows: [] };
      const mockCountResult = { rows: [{ count: '0' }] };

      vi.mocked(pool.query)
        .mockResolvedValueOnce(mockResults as any)
        .mockResolvedValueOnce(mockCountResult as any);

      await searchService.hybridSearch('apartment', {
        priceMin: 100000,
        priceMax: 500000,
        location: ['New York'],
        moduleType: ['APARTMENT'],
        limit: 10,
        offset: 5,
      });

      const queryCall = vi.mocked(pool.query).mock.calls[0];
      expect(queryCall[0]).toContain('price >= $');
      expect(queryCall[0]).toContain('price <= $');
      expect(queryCall[0]).toContain('location = ANY($');
      expect(queryCall[0]).toContain('module_type = ANY($');
      expect(queryCall[0]).toContain('LIMIT');
      expect(queryCall[0]).toContain('OFFSET');
    });

    it('should enforce semantic threshold of 0.7', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(embeddingsService.instance.generateEmbedding).mockResolvedValue(mockEmbedding);

      const mockResults = { rows: [] };
      const mockCountResult = { rows: [{ count: '0' }] };

      vi.mocked(pool.query)
        .mockResolvedValueOnce(mockResults as any)
        .mockResolvedValueOnce(mockCountResult as any);

      await searchService.hybridSearch('apartment');

      const queryCall = vi.mocked(pool.query).mock.calls[0];
      expect(queryCall[0]).toContain('s.semantic_score >= 0.7');
    });

    it('should return results with hybrid scores greater than 0', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(embeddingsService.instance.generateEmbedding).mockResolvedValue(mockEmbedding);

      const mockResults = { rows: [] };
      const mockCountResult = { rows: [{ count: '0' }] };

      vi.mocked(pool.query)
        .mockResolvedValueOnce(mockResults as any)
        .mockResolvedValueOnce(mockCountResult as any);

      await searchService.hybridSearch('apartment');

      const queryCall = vi.mocked(pool.query).mock.calls[0];
      expect(queryCall[0]).toContain('WHERE c.hybrid_score > 0');
    });

    it('should throw error for empty query', async () => {
      await expect(searchService.hybridSearch('')).rejects.toThrow(
        'Search query cannot be empty'
      );
    });

    it('should return pagination metadata', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(embeddingsService.instance.generateEmbedding).mockResolvedValue(mockEmbedding);

      const mockResults = { rows: [] };
      const mockCountResult = { rows: [{ count: '42' }] };

      vi.mocked(pool.query)
        .mockResolvedValueOnce(mockResults as any)
        .mockResolvedValueOnce(mockCountResult as any);

      const response = await searchService.hybridSearch('apartment', {
        limit: 10,
        offset: 20,
      });

      expect(response.total).toBe(42);
      expect(response.filters.limit).toBe(10);
      expect(response.filters.offset).toBe(20);
    });
  });

  describe('Filter Validation', () => {
    it('should reject negative price values', async () => {
      await expect(
        searchService.keywordSearch('apartment', { priceMin: -100 })
      ).rejects.toThrow();
    });

    it('should reject limit greater than 100', async () => {
      await expect(
        searchService.keywordSearch('apartment', { limit: 150 })
      ).rejects.toThrow();
    });

    it('should reject negative offset', async () => {
      await expect(
        searchService.keywordSearch('apartment', { offset: -5 })
      ).rejects.toThrow();
    });

    it('should accept valid filter combinations', async () => {
      const mockResults = { rows: [] };
      vi.mocked(pool.query).mockResolvedValue(mockResults as any);

      await expect(
        searchService.keywordSearch('apartment', {
          priceMin: 100000,
          priceMax: 500000,
          location: ['New York'],
          moduleType: ['APARTMENT'],
          limit: 20,
          offset: 0,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Search Result Caching', () => {
    beforeEach(() => {
      vi.mocked(redis.cacheGet).mockResolvedValue(null);
      vi.mocked(redis.cacheSet).mockResolvedValue(undefined);
    });

    describe('keywordSearch caching', () => {
      it('should check cache before executing query', async () => {
        const mockResults = { rows: [] };
        vi.mocked(pool.query).mockResolvedValue(mockResults as any);
        vi.mocked(redis.cacheGet).mockResolvedValue(null);

        await searchService.keywordSearch('luxury apartment');

        expect(redis.cacheGet).toHaveBeenCalledOnce();
        expect(pool.query).toHaveBeenCalledOnce();
      });

      it('should return cached results when available', async () => {
        const cachedResults = [
          {
            property: {
              id: '123',
              builderId: '456',
              moduleType: 'APARTMENT',
              title: 'Cached Apartment',
              description: 'From cache',
              price: 500000,
              currency: 'USD',
              location: 'New York',
              images: [],
              moduleData: {},
              status: 'AVAILABLE',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            similarityScore: 0.9,
            matchType: 'keyword' as const,
          },
        ];

        vi.mocked(redis.cacheGet).mockResolvedValue(cachedResults);

        const results = await searchService.keywordSearch('luxury apartment');

        expect(redis.cacheGet).toHaveBeenCalledOnce();
        expect(pool.query).not.toHaveBeenCalled();
        expect(results).toEqual(cachedResults);
      });

      it('should cache results after query execution', async () => {
        const mockResults = {
          rows: [
            {
              id: '123',
              builderId: '456',
              moduleType: 'APARTMENT',
              title: 'New Apartment',
              description: 'Fresh from DB',
              price: '500000.00',
              currency: 'USD',
              location: 'New York',
              images: [],
              moduleData: {},
              status: 'AVAILABLE',
              createdAt: new Date(),
              updatedAt: new Date(),
              rank: 0.8,
            },
          ],
        };

        vi.mocked(pool.query).mockResolvedValue(mockResults as any);
        vi.mocked(redis.cacheGet).mockResolvedValue(null);

        await searchService.keywordSearch('luxury apartment');

        expect(redis.cacheSet).toHaveBeenCalledOnce();
        const cacheSetCall = vi.mocked(redis.cacheSet).mock.calls[0];
        expect(cacheSetCall[0]).toMatch(/^search:keyword:/);
        expect(cacheSetCall[2]).toBe(300); // 5 minutes TTL
      });

      it('should generate different cache keys for different queries', async () => {
        const mockResults = { rows: [] };
        vi.mocked(pool.query).mockResolvedValue(mockResults as any);
        vi.mocked(redis.cacheGet).mockResolvedValue(null);

        await searchService.keywordSearch('luxury apartment');
        const firstCacheKey = vi.mocked(redis.cacheGet).mock.calls[0][0];

        vi.clearAllMocks();
        vi.mocked(redis.cacheGet).mockResolvedValue(null);
        vi.mocked(pool.query).mockResolvedValue(mockResults as any);

        await searchService.keywordSearch('budget apartment');
        const secondCacheKey = vi.mocked(redis.cacheGet).mock.calls[0][0];

        expect(firstCacheKey).not.toBe(secondCacheKey);
      });

      it('should generate different cache keys for different filters', async () => {
        const mockResults = { rows: [] };
        vi.mocked(pool.query).mockResolvedValue(mockResults as any);
        vi.mocked(redis.cacheGet).mockResolvedValue(null);

        await searchService.keywordSearch('apartment', { priceMin: 100000 });
        const firstCacheKey = vi.mocked(redis.cacheGet).mock.calls[0][0];

        vi.clearAllMocks();
        vi.mocked(redis.cacheGet).mockResolvedValue(null);
        vi.mocked(pool.query).mockResolvedValue(mockResults as any);

        await searchService.keywordSearch('apartment', { priceMin: 200000 });
        const secondCacheKey = vi.mocked(redis.cacheGet).mock.calls[0][0];

        expect(firstCacheKey).not.toBe(secondCacheKey);
      });
    });

    describe('semanticSearch caching', () => {
      beforeEach(() => {
        vi.mocked(embeddingsService.instance.generateEmbedding).mockResolvedValue(
          new Array(1536).fill(0.1)
        );
      });

      it('should check cache before executing query', async () => {
        const mockResults = { rows: [] };
        vi.mocked(pool.query).mockResolvedValue(mockResults as any);
        vi.mocked(redis.cacheGet).mockResolvedValue(null);

        await searchService.semanticSearch('modern apartment with great views');

        expect(redis.cacheGet).toHaveBeenCalledOnce();
        expect(pool.query).toHaveBeenCalledOnce();
      });

      it('should return cached results when available', async () => {
        const cachedResults = [
          {
            property: {
              id: '123',
              builderId: '456',
              moduleType: 'APARTMENT',
              title: 'Cached Apartment',
              description: 'From cache',
              price: 500000,
              currency: 'USD',
              location: 'New York',
              images: [],
              moduleData: {},
              status: 'AVAILABLE',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            similarityScore: 0.85,
            matchType: 'semantic' as const,
          },
        ];

        vi.mocked(redis.cacheGet).mockResolvedValue(cachedResults);

        const results = await searchService.semanticSearch('modern apartment');

        expect(redis.cacheGet).toHaveBeenCalledOnce();
        expect(embeddingsService.instance.generateEmbedding).not.toHaveBeenCalled();
        expect(pool.query).not.toHaveBeenCalled();
        expect(results).toEqual(cachedResults);
      });

      it('should cache results with 5-minute TTL', async () => {
        const mockResults = { rows: [] };
        vi.mocked(pool.query).mockResolvedValue(mockResults as any);
        vi.mocked(redis.cacheGet).mockResolvedValue(null);

        await searchService.semanticSearch('modern apartment');

        expect(redis.cacheSet).toHaveBeenCalledOnce();
        const cacheSetCall = vi.mocked(redis.cacheSet).mock.calls[0];
        expect(cacheSetCall[0]).toMatch(/^search:semantic:/);
        expect(cacheSetCall[2]).toBe(300); // 5 minutes TTL
      });

      it('should include similarityThreshold in cache key', async () => {
        const mockResults = { rows: [] };
        vi.mocked(pool.query).mockResolvedValue(mockResults as any);
        vi.mocked(redis.cacheGet).mockResolvedValue(null);

        await searchService.semanticSearch('apartment', {}, 0.7);
        const firstCacheKey = vi.mocked(redis.cacheGet).mock.calls[0][0];

        vi.clearAllMocks();
        vi.mocked(redis.cacheGet).mockResolvedValue(null);
        vi.mocked(pool.query).mockResolvedValue(mockResults as any);

        await searchService.semanticSearch('apartment', {}, 0.8);
        const secondCacheKey = vi.mocked(redis.cacheGet).mock.calls[0][0];

        expect(firstCacheKey).not.toBe(secondCacheKey);
      });
    });

    describe('hybridSearch caching', () => {
      beforeEach(() => {
        vi.mocked(embeddingsService.instance.generateEmbedding).mockResolvedValue(
          new Array(1536).fill(0.1)
        );
      });

      it('should check cache before executing query', async () => {
        const mockResults = { rows: [] };
        const mockCountResult = { rows: [{ count: '0' }] };
        vi.mocked(pool.query)
          .mockResolvedValueOnce(mockResults as any)
          .mockResolvedValueOnce(mockCountResult as any);
        vi.mocked(redis.cacheGet).mockResolvedValue(null);

        await searchService.hybridSearch('luxury apartment');

        expect(redis.cacheGet).toHaveBeenCalledOnce();
        expect(pool.query).toHaveBeenCalled();
      });

      it('should return cached response when available', async () => {
        const cachedResponse = {
          results: [
            {
              property: {
                id: '123',
                builderId: '456',
                moduleType: 'APARTMENT',
                title: 'Cached Apartment',
                description: 'From cache',
                price: 500000,
                currency: 'USD',
                location: 'New York',
                images: [],
                moduleData: {},
                status: 'AVAILABLE',
                createdAt: new Date(),
                updatedAt: new Date(),
              },
              similarityScore: 0.88,
              matchType: 'hybrid' as const,
            },
          ],
          total: 1,
          query: 'luxury apartment',
          filters: {},
        };

        vi.mocked(redis.cacheGet).mockResolvedValue(cachedResponse);

        const response = await searchService.hybridSearch('luxury apartment');

        expect(redis.cacheGet).toHaveBeenCalledOnce();
        expect(embeddingsService.instance.generateEmbedding).not.toHaveBeenCalled();
        expect(pool.query).not.toHaveBeenCalled();
        expect(response).toEqual(cachedResponse);
      });

      it('should cache response with 5-minute TTL', async () => {
        const mockResults = { rows: [] };
        const mockCountResult = { rows: [{ count: '0' }] };
        vi.mocked(pool.query)
          .mockResolvedValueOnce(mockResults as any)
          .mockResolvedValueOnce(mockCountResult as any);
        vi.mocked(redis.cacheGet).mockResolvedValue(null);

        await searchService.hybridSearch('luxury apartment');

        expect(redis.cacheSet).toHaveBeenCalledOnce();
        const cacheSetCall = vi.mocked(redis.cacheSet).mock.calls[0];
        expect(cacheSetCall[0]).toMatch(/^search:hybrid:/);
        expect(cacheSetCall[2]).toBe(300); // 5 minutes TTL
      });

      it('should include weights in cache key', async () => {
        const mockResults = { rows: [] };
        const mockCountResult = { rows: [{ count: '0' }] };
        vi.mocked(pool.query)
          .mockResolvedValueOnce(mockResults as any)
          .mockResolvedValueOnce(mockCountResult as any);
        vi.mocked(redis.cacheGet).mockResolvedValue(null);

        await searchService.hybridSearch('apartment', {}, 0.6, 0.4);
        const firstCacheKey = vi.mocked(redis.cacheGet).mock.calls[0][0];

        vi.clearAllMocks();
        vi.mocked(redis.cacheGet).mockResolvedValue(null);
        vi.mocked(pool.query)
          .mockResolvedValueOnce(mockResults as any)
          .mockResolvedValueOnce(mockCountResult as any);

        await searchService.hybridSearch('apartment', {}, 0.7, 0.3);
        const secondCacheKey = vi.mocked(redis.cacheGet).mock.calls[0][0];

        expect(firstCacheKey).not.toBe(secondCacheKey);
      });

      it('should cache complete SearchResponse object', async () => {
        const mockResults = {
          rows: [
            {
              id: '123',
              builderId: '456',
              moduleType: 'APARTMENT',
              title: 'Test Apartment',
              description: 'Test description',
              price: '500000.00',
              currency: 'USD',
              location: 'New York',
              images: [],
              moduleData: {},
              status: 'AVAILABLE',
              createdAt: new Date(),
              updatedAt: new Date(),
              hybrid_score: 0.88,
            },
          ],
        };
        const mockCountResult = { rows: [{ count: '1' }] };
        vi.mocked(pool.query)
          .mockResolvedValueOnce(mockResults as any)
          .mockResolvedValueOnce(mockCountResult as any);
        vi.mocked(redis.cacheGet).mockResolvedValue(null);

        await searchService.hybridSearch('luxury apartment');

        expect(redis.cacheSet).toHaveBeenCalledOnce();
        const cachedData = vi.mocked(redis.cacheSet).mock.calls[0][1];
        expect(cachedData).toHaveProperty('results');
        expect(cachedData).toHaveProperty('total');
        expect(cachedData).toHaveProperty('query');
        expect(cachedData).toHaveProperty('filters');
      });
    });
  });
});

