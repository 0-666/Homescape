import { z } from 'zod';
import { pool } from '../db';
import { embeddingsService } from './embeddings.service';
import { Property } from './property.service';
import { cacheGet, cacheSet } from '../cache/redis';
import crypto from 'crypto';

// Validation schemas
export const searchFiltersSchema = z.object({
  priceMin: z.number().positive().optional(),
  priceMax: z.number().positive().optional(),
  location: z.array(z.string()).optional(),
  propertyType: z.array(z.string()).optional(),
  moduleType: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

// Types
export interface SearchFilters {
  priceMin?: number;
  priceMax?: number;
  location?: string[];
  propertyType?: string[];
  moduleType?: string[];
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  property: Property;
  similarityScore: number;
  matchType: 'semantic' | 'keyword' | 'hybrid';
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  filters: SearchFilters;
}

// Cache configuration
const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Generate a cache key based on search parameters
 * @param prefix - Cache key prefix (e.g., 'keyword', 'semantic', 'hybrid')
 * @param query - Search query string
 * @param filters - Search filters
 * @param additionalParams - Additional parameters to include in cache key
 * @returns Cache key string
 */
function generateCacheKey(
  prefix: string,
  query: string,
  filters?: SearchFilters,
  additionalParams?: Record<string, any>
): string {
  const cacheData = {
    query,
    filters: filters || {},
    ...additionalParams,
  };
  
  // Create a deterministic hash of the parameters
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(cacheData))
    .digest('hex');
  
  return `search:${prefix}:${hash}`;
}

/**
 * Perform keyword search using PostgreSQL full-text search
 * @param query - Search query string
 * @param filters - Optional filters for price, location, etc.
 * @returns Array of search results with keyword match scores
 */
export async function keywordSearch(
  query: string,
  filters?: SearchFilters
): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) {
    throw new Error('Search query cannot be empty');
  }

  // Validate filters
  const validatedFilters: SearchFilters = filters ? searchFiltersSchema.parse(filters) : {};

  // Generate cache key
  const cacheKey = generateCacheKey('keyword', query, validatedFilters);

  // Check cache first
  const cachedResults = await cacheGet<SearchResult[]>(cacheKey);
  if (cachedResults) {
    return cachedResults;
  }

  // Build WHERE clause for filters
  const conditions: string[] = ["status = 'AVAILABLE'"];
  const values: any[] = [];
  let paramIndex = 1;

  // Add search query for full-text search
  conditions.push(`(
    to_tsvector('english', title) @@ plainto_tsquery('english', ${paramIndex}) OR
    to_tsvector('english', COALESCE(description, '')) @@ plainto_tsquery('english', ${paramIndex}) OR
    to_tsvector('english', location) @@ plainto_tsquery('english', ${paramIndex})
  )`);
  values.push(query);
  paramIndex++;

  // Apply filters
  if (validatedFilters.priceMin !== undefined) {
    conditions.push(`price >= ${paramIndex}`);
    values.push(validatedFilters.priceMin);
    paramIndex++;
  }

  if (validatedFilters.priceMax !== undefined) {
    conditions.push(`price <= ${paramIndex}`);
    values.push(validatedFilters.priceMax);
    paramIndex++;
  }

  if (validatedFilters.location && validatedFilters.location.length > 0) {
    conditions.push(`location = ANY(${paramIndex})`);
    values.push(validatedFilters.location);
    paramIndex++;
  }

  if (validatedFilters.moduleType && validatedFilters.moduleType.length > 0) {
    conditions.push(`module_type = ANY(${paramIndex})`);
    values.push(validatedFilters.moduleType);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');
  const limit = validatedFilters.limit || 20;
  const offset = validatedFilters.offset || 0;

  // Execute keyword search with ranking
  const result = await pool.query(
    `SELECT
      id,
      builder_id as "builderId",
      module_type as "moduleType",
      title,
      description,
      price,
      currency,
      location,
      images,
      module_data as "moduleData",
      status,
      created_at as "createdAt",
      updated_at as "updatedAt",
      ts_rank(
        to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || location),
        plainto_tsquery('english', $1)
      ) as rank
    FROM properties
    WHERE ${whereClause}
    ORDER BY rank DESC
    LIMIT ${paramIndex} OFFSET ${paramIndex + 1}`,
    [...values, limit, offset]
  );

  const results = result.rows.map((row) => ({
    property: {
      id: row.id,
      builderId: row.builderId,
      moduleType: row.moduleType,
      title: row.title,
      description: row.description,
      price: parseFloat(row.price),
      currency: row.currency,
      location: row.location,
      images: row.images,
      moduleData: row.moduleData,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    similarityScore: parseFloat(row.rank),
    matchType: 'keyword' as const,
  }));

  // Cache the results
  await cacheSet(cacheKey, results, CACHE_TTL_SECONDS);

  return results;
}


/**
 * Perform semantic search using pgvector cosine distance
 * @param query - Search query string
 * @param filters - Optional filters for price, location, etc.
 * @param similarityThreshold - Minimum similarity score (default: 0.7)
 * @returns Array of search results with semantic similarity scores
 */
export async function semanticSearch(
  query: string,
  filters?: SearchFilters,
  similarityThreshold: number = 0.7
): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) {
    throw new Error('Search query cannot be empty');
  }

  // Validate filters
  const validatedFilters: SearchFilters = filters ? searchFiltersSchema.parse(filters) : {};

  // Generate cache key
  const cacheKey = generateCacheKey('semantic', query, validatedFilters, { similarityThreshold });

  // Check cache first
  const cachedResults = await cacheGet<SearchResult[]>(cacheKey);
  if (cachedResults) {
    return cachedResults;
  }

  // Generate embedding for the search query
  const queryEmbedding = await embeddingsService.instance.generateEmbedding(query);

  // Build WHERE clause for filters
  const conditions: string[] = ["status = 'AVAILABLE'", "embedding IS NOT NULL"];
  const values: any[] = [JSON.stringify(queryEmbedding)];
  let paramIndex = 2;

  // Apply filters
  if (validatedFilters.priceMin !== undefined) {
    conditions.push(`price >= $${paramIndex}`);
    values.push(validatedFilters.priceMin);
    paramIndex++;
  }

  if (validatedFilters.priceMax !== undefined) {
    conditions.push(`price <= $${paramIndex}`);
    values.push(validatedFilters.priceMax);
    paramIndex++;
  }

  if (validatedFilters.location && validatedFilters.location.length > 0) {
    conditions.push(`location = ANY($${paramIndex})`);
    values.push(validatedFilters.location);
    paramIndex++;
  }

  if (validatedFilters.moduleType && validatedFilters.moduleType.length > 0) {
    conditions.push(`module_type = ANY($${paramIndex})`);
    values.push(validatedFilters.moduleType);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');
  const limit = validatedFilters.limit || 20;
  const offset = validatedFilters.offset || 0;

  // Execute semantic search using cosine distance
  // Note: cosine distance returns 0 for identical vectors and 2 for opposite vectors
  // We convert to similarity score: similarity = 1 - (distance / 2)
  const result = await pool.query(
    `SELECT 
      id,
      builder_id as "builderId",
      module_type as "moduleType",
      title,
      description,
      price,
      currency,
      location,
      images,
      module_data as "moduleData",
      status,
      created_at as "createdAt",
      updated_at as "updatedAt",
      1 - (embedding <=> $1::vector) as similarity
    FROM properties
    WHERE ${whereClause}
      AND 1 - (embedding <=> $1::vector) >= ${similarityThreshold}
    ORDER BY embedding <=> $1::vector
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, limit, offset]
  );

  const results = result.rows.map((row) => ({
    property: {
      id: row.id,
      builderId: row.builderId,
      moduleType: row.moduleType,
      title: row.title,
      description: row.description,
      price: parseFloat(row.price),
      currency: row.currency,
      location: row.location,
      images: row.images,
      moduleData: row.moduleData,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    similarityScore: parseFloat(row.similarity),
    matchType: 'semantic' as const,
  }));

  // Cache the results
  await cacheSet(cacheKey, results, CACHE_TTL_SECONDS);

  return results;
}

/**
 * Perform hybrid search combining keyword and semantic search
 * Uses weighted scoring: 0.6 for semantic, 0.4 for keyword
 * @param query - Search query string
 * @param filters - Optional filters for price, location, etc.
 * @param semanticWeight - Weight for semantic score (default: 0.6)
 * @param keywordWeight - Weight for keyword score (default: 0.4)
 * @returns Array of search results with combined scores
 */
export async function hybridSearch(
  query: string,
  filters?: SearchFilters,
  semanticWeight: number = 0.6,
  keywordWeight: number = 0.4
): Promise<SearchResponse> {
  if (!query || query.trim().length === 0) {
    throw new Error('Search query cannot be empty');
  }

  // Validate filters
  const validatedFilters: SearchFilters = filters ? searchFiltersSchema.parse(filters) : {};

  // Generate cache key
  const cacheKey = generateCacheKey('hybrid', query, validatedFilters, { semanticWeight, keywordWeight });

  // Check cache first
  const cachedResponse = await cacheGet<SearchResponse>(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  // Generate embedding for the search query
  const queryEmbedding = await embeddingsService.instance.generateEmbedding(query);

  // Build WHERE clause for filters
  const conditions: string[] = ["status = 'AVAILABLE'"];
  const values: any[] = [JSON.stringify(queryEmbedding), query];
  let paramIndex = 3;

  // Apply filters
  if (validatedFilters.priceMin !== undefined) {
    conditions.push(`price >= $${paramIndex}`);
    values.push(validatedFilters.priceMin);
    paramIndex++;
  }

  if (validatedFilters.priceMax !== undefined) {
    conditions.push(`price <= $${paramIndex}`);
    values.push(validatedFilters.priceMax);
    paramIndex++;
  }

  if (validatedFilters.location && validatedFilters.location.length > 0) {
    conditions.push(`location = ANY($${paramIndex})`);
    values.push(validatedFilters.location);
    paramIndex++;
  }

  if (validatedFilters.moduleType && validatedFilters.moduleType.length > 0) {
    conditions.push(`module_type = ANY($${paramIndex})`);
    values.push(validatedFilters.moduleType);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');
  const limit = validatedFilters.limit || 20;
  const offset = validatedFilters.offset || 0;

  // Execute hybrid search combining semantic and keyword scores
  const result = await pool.query(
    `WITH semantic_scores AS (
      SELECT 
        id,
        CASE 
          WHEN embedding IS NOT NULL THEN 1 - (embedding <=> $1::vector)
          ELSE 0
        END as semantic_score
      FROM properties
      WHERE ${whereClause}
    ),
    keyword_scores AS (
      SELECT 
        id,
        ts_rank(
          to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || location),
          plainto_tsquery('english', $2)
        ) as keyword_score
      FROM properties
      WHERE ${whereClause}
    ),
    combined_scores AS (
      SELECT 
        p.id,
        COALESCE(s.semantic_score, 0) * ${semanticWeight} + 
        COALESCE(k.keyword_score, 0) * ${keywordWeight} as hybrid_score,
        COALESCE(s.semantic_score, 0) as semantic_score,
        COALESCE(k.keyword_score, 0) as keyword_score
      FROM properties p
      LEFT JOIN semantic_scores s ON p.id = s.id
      LEFT JOIN keyword_scores k ON p.id = k.id
      WHERE ${whereClause}
        AND (s.semantic_score >= 0.7 OR k.keyword_score > 0)
    )
    SELECT 
      p.id,
      p.builder_id as "builderId",
      p.module_type as "moduleType",
      p.title,
      p.description,
      p.price,
      p.currency,
      p.location,
      p.images,
      p.module_data as "moduleData",
      p.status,
      p.created_at as "createdAt",
      p.updated_at as "updatedAt",
      c.hybrid_score,
      c.semantic_score,
      c.keyword_score
    FROM properties p
    INNER JOIN combined_scores c ON p.id = c.id
    WHERE c.hybrid_score > 0
    ORDER BY c.hybrid_score DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, limit, offset]
  );

  // Get total count for pagination
  const countResult = await pool.query(
    `WITH semantic_scores AS (
      SELECT 
        id,
        CASE 
          WHEN embedding IS NOT NULL THEN 1 - (embedding <=> $1::vector)
          ELSE 0
        END as semantic_score
      FROM properties
      WHERE ${whereClause}
    ),
    keyword_scores AS (
      SELECT 
        id,
        ts_rank(
          to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || location),
          plainto_tsquery('english', $2)
        ) as keyword_score
      FROM properties
      WHERE ${whereClause}
    ),
    combined_scores AS (
      SELECT 
        p.id,
        COALESCE(s.semantic_score, 0) * ${semanticWeight} + 
        COALESCE(k.keyword_score, 0) * ${keywordWeight} as hybrid_score
      FROM properties p
      LEFT JOIN semantic_scores s ON p.id = s.id
      LEFT JOIN keyword_scores k ON p.id = k.id
      WHERE ${whereClause}
        AND (s.semantic_score >= 0.7 OR k.keyword_score > 0)
    )
    SELECT COUNT(*) as count
    FROM combined_scores
    WHERE hybrid_score > 0`,
    values.slice(0, paramIndex - 2)
  );

  const total = parseInt(countResult.rows[0].count, 10);

  const results: SearchResult[] = result.rows.map((row) => ({
    property: {
      id: row.id,
      builderId: row.builderId,
      moduleType: row.moduleType,
      title: row.title,
      description: row.description,
      price: parseFloat(row.price),
      currency: row.currency,
      location: row.location,
      images: row.images,
      moduleData: row.moduleData,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    similarityScore: parseFloat(row.hybrid_score),
    matchType: 'hybrid' as const,
  }));

  const response: SearchResponse = {
    results,
    total,
    query,
    filters: validatedFilters,
  };

  // Cache the response
  await cacheSet(cacheKey, response, CACHE_TTL_SECONDS);

  return response;
}
