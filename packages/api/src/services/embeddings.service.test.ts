import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmbeddingsService } from './embeddings.service';
import { pool } from '../db';
import OpenAI from 'openai';

// Mock the dependencies
vi.mock('../db', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('../config', () => ({
  config: {
    openai: {
      apiKey: 'test-api-key',
    },
  },
}));

vi.mock('openai');

describe('EmbeddingsService', () => {
  let service: EmbeddingsService;
  let mockOpenAI: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock OpenAI instance
    mockOpenAI = {
      embeddings: {
        create: vi.fn(),
      },
    };

    // Mock OpenAI constructor
    vi.mocked(OpenAI).mockImplementation(() => mockOpenAI);

    service = new EmbeddingsService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with valid API key', () => {
      // The service is already initialized in beforeEach with a valid API key
      expect(service).toBeDefined();
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
      });
    });
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for valid text', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const result = await service.generateEmbedding('test text');

      expect(result).toEqual(mockEmbedding);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'test text',
        encoding_format: 'float',
      });
    });

    it('should throw error for empty text', async () => {
      await expect(service.generateEmbedding('')).rejects.toThrow('Text cannot be empty');
      await expect(service.generateEmbedding('   ')).rejects.toThrow('Text cannot be empty');
    });

    it('should throw error if OpenAI returns no data', async () => {
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [],
      });

      await expect(service.generateEmbedding('test')).rejects.toThrow(
        'No embedding returned from OpenAI'
      );
    });

    it('should handle OpenAI API errors', async () => {
      mockOpenAI.embeddings.create.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(service.generateEmbedding('test')).rejects.toThrow(
        'Failed to generate embedding: API rate limit exceeded'
      );
    });
  });

  describe('generatePropertyEmbedding', () => {
    it('should combine property fields and generate embedding', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const propertyData = {
        title: 'Modern Apartment',
        description: 'Beautiful 2BR apartment with city views',
        location: 'Downtown Seattle',
      };

      const result = await service.generatePropertyEmbedding(propertyData);

      expect(result).toEqual(mockEmbedding);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'Modern Apartment | Beautiful 2BR apartment with city views | Downtown Seattle',
        encoding_format: 'float',
      });
    });

    it('should handle missing description', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const propertyData = {
        title: 'Modern Apartment',
        location: 'Downtown Seattle',
      };

      await service.generatePropertyEmbedding(propertyData);

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'Modern Apartment | Downtown Seattle',
        encoding_format: 'float',
      });
    });

    it('should handle empty description', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const propertyData = {
        title: 'Modern Apartment',
        description: '',
        location: 'Downtown Seattle',
      };

      await service.generatePropertyEmbedding(propertyData);

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'Modern Apartment | Downtown Seattle',
        encoding_format: 'float',
      });
    });
  });

  describe('storePropertyEmbedding', () => {
    it('should store embedding in database', async () => {
      const propertyId = '123e4567-e89b-12d3-a456-426614174000';
      const embedding = new Array(1536).fill(0.1);

      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      await service.storePropertyEmbedding(propertyId, embedding);

      expect(pool.query).toHaveBeenCalledWith(
        'UPDATE properties SET embedding = $1 WHERE id = $2',
        [JSON.stringify(embedding), propertyId]
      );
    });

    it('should throw error for invalid embedding dimension', async () => {
      const propertyId = '123e4567-e89b-12d3-a456-426614174000';
      const invalidEmbedding = new Array(512).fill(0.1); // Wrong dimension

      await expect(service.storePropertyEmbedding(propertyId, invalidEmbedding)).rejects.toThrow(
        'Invalid embedding dimension: expected 1536, got 512'
      );
    });

    it('should handle database errors', async () => {
      const propertyId = '123e4567-e89b-12d3-a456-426614174000';
      const embedding = new Array(1536).fill(0.1);

      vi.mocked(pool.query).mockRejectedValue(new Error('Database connection failed'));

      await expect(service.storePropertyEmbedding(propertyId, embedding)).rejects.toThrow(
        'Failed to store embedding: Database connection failed'
      );
    });
  });

  describe('generateAndStorePropertyEmbedding', () => {
    it('should generate and store embedding in one operation', async () => {
      const propertyId = '123e4567-e89b-12d3-a456-426614174000';
      const mockEmbedding = new Array(1536).fill(0.1);

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const propertyData = {
        title: 'Modern Apartment',
        description: 'Beautiful 2BR apartment',
        location: 'Downtown Seattle',
      };

      await service.generateAndStorePropertyEmbedding(propertyId, propertyData);

      expect(mockOpenAI.embeddings.create).toHaveBeenCalled();
      expect(pool.query).toHaveBeenCalledWith(
        'UPDATE properties SET embedding = $1 WHERE id = $2',
        [JSON.stringify(mockEmbedding), propertyId]
      );
    });
  });

  describe('updatePropertyEmbedding', () => {
    it('should fetch property data and update embedding', async () => {
      const propertyId = '123e4567-e89b-12d3-a456-426614174000';
      const mockEmbedding = new Array(1536).fill(0.1);

      // Mock SELECT query
      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [
            {
              title: 'Modern Apartment',
              description: 'Beautiful 2BR apartment',
              location: 'Downtown Seattle',
            },
          ],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        // Mock UPDATE query
        .mockResolvedValueOnce({
          rows: [],
          command: 'UPDATE',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      await service.updatePropertyEmbedding(propertyId);

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT title, description, location FROM properties WHERE id = $1',
        [propertyId]
      );
      expect(mockOpenAI.embeddings.create).toHaveBeenCalled();
    });

    it('should throw error if property not found', async () => {
      const propertyId = '123e4567-e89b-12d3-a456-426614174000';

      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      await expect(service.updatePropertyEmbedding(propertyId)).rejects.toThrow(
        'Property not found'
      );
    });
  });

  describe('batchGenerateEmbeddings', () => {
    it('should process multiple properties successfully', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const properties = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          title: 'Property 1',
          description: 'Description 1',
          location: 'Location 1',
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          title: 'Property 2',
          description: 'Description 2',
          location: 'Location 2',
        },
      ];

      const results = await service.batchGenerateEmbeddings(properties);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ id: properties[0].id, success: true });
      expect(results[1]).toEqual({ id: properties[1].id, success: true });
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures in batch processing', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);

      // First call succeeds, second fails
      mockOpenAI.embeddings.create
        .mockResolvedValueOnce({
          data: [{ embedding: mockEmbedding }],
        })
        .mockRejectedValueOnce(new Error('API error'));

      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const properties = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          title: 'Property 1',
          location: 'Location 1',
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          title: 'Property 2',
          location: 'Location 2',
        },
      ];

      const results = await service.batchGenerateEmbeddings(properties);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ id: properties[0].id, success: true });
      expect(results[1]).toEqual({
        id: properties[1].id,
        success: false,
        error: 'Failed to generate embedding: API error',
      });
    });

    it('should handle empty properties array', async () => {
      const results = await service.batchGenerateEmbeddings([]);

      expect(results).toHaveLength(0);
      expect(mockOpenAI.embeddings.create).not.toHaveBeenCalled();
    });
  });
});
