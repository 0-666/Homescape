import { Router, Request, Response } from 'express';
import * as searchService from '../services/search.service';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

/**
 * GET /api/search/keyword
 * Perform keyword-based search using PostgreSQL full-text search
 */
router.get('/keyword', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { q, priceMin, priceMax, location, moduleType, limit, offset } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        error: {
          code: 'INVALID_QUERY',
          message: 'Search query parameter "q" is required',
        },
      });
    }

    const filters: searchService.SearchFilters = {};

    if (priceMin) filters.priceMin = parseFloat(priceMin as string);
    if (priceMax) filters.priceMax = parseFloat(priceMax as string);
    if (location) {
      filters.location = Array.isArray(location) ? location as string[] : [location as string];
    }
    if (moduleType) {
      filters.moduleType = Array.isArray(moduleType) ? moduleType as string[] : [moduleType as string];
    }
    if (limit) filters.limit = parseInt(limit as string, 10);
    if (offset) filters.offset = parseInt(offset as string, 10);

    const results = await searchService.keywordSearch(q, filters);

    res.json({
      results,
      query: q,
      filters,
      matchType: 'keyword',
    });
  } catch (error) {
    console.error('Keyword search error:', error);
    res.status(500).json({
      error: {
        code: 'SEARCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to perform keyword search',
      },
    });
  }
});

/**
 * GET /api/search/semantic
 * Perform semantic search using vector embeddings and pgvector
 */
router.get('/semantic', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { q, priceMin, priceMax, location, moduleType, limit, offset, threshold } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        error: {
          code: 'INVALID_QUERY',
          message: 'Search query parameter "q" is required',
        },
      });
    }

    const filters: searchService.SearchFilters = {};

    if (priceMin) filters.priceMin = parseFloat(priceMin as string);
    if (priceMax) filters.priceMax = parseFloat(priceMax as string);
    if (location) {
      filters.location = Array.isArray(location) ? location as string[] : [location as string];
    }
    if (moduleType) {
      filters.moduleType = Array.isArray(moduleType) ? moduleType as string[] : [moduleType as string];
    }
    if (limit) filters.limit = parseInt(limit as string, 10);
    if (offset) filters.offset = parseInt(offset as string, 10);

    const similarityThreshold = threshold ? parseFloat(threshold as string) : 0.7;

    const results = await searchService.semanticSearch(q, filters, similarityThreshold);

    res.json({
      results,
      query: q,
      filters,
      threshold: similarityThreshold,
      matchType: 'semantic',
    });
  } catch (error) {
    console.error('Semantic search error:', error);
    res.status(500).json({
      error: {
        code: 'SEARCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to perform semantic search',
      },
    });
  }
});

/**
 * GET /api/search/hybrid
 * Perform hybrid search combining keyword and semantic search
 * Default weights: 0.6 semantic, 0.4 keyword
 */
router.get('/hybrid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      q,
      priceMin,
      priceMax,
      location,
      moduleType,
      limit,
      offset,
      semanticWeight,
      keywordWeight,
    } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        error: {
          code: 'INVALID_QUERY',
          message: 'Search query parameter "q" is required',
        },
      });
    }

    const filters: searchService.SearchFilters = {};

    if (priceMin) filters.priceMin = parseFloat(priceMin as string);
    if (priceMax) filters.priceMax = parseFloat(priceMax as string);
    if (location) {
      filters.location = Array.isArray(location) ? location as string[] : [location as string];
    }
    if (moduleType) {
      filters.moduleType = Array.isArray(moduleType) ? moduleType as string[] : [moduleType as string];
    }
    if (limit) filters.limit = parseInt(limit as string, 10);
    if (offset) filters.offset = parseInt(offset as string, 10);

    const semWeight = semanticWeight ? parseFloat(semanticWeight as string) : 0.6;
    const kwWeight = keywordWeight ? parseFloat(keywordWeight as string) : 0.4;

    const response = await searchService.hybridSearch(q, filters, semWeight, kwWeight);

    res.json({
      ...response,
      weights: {
        semantic: semWeight,
        keyword: kwWeight,
      },
    });
  } catch (error) {
    console.error('Hybrid search error:', error);
    res.status(500).json({
      error: {
        code: 'SEARCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to perform hybrid search',
      },
    });
  }
});

/**
 * GET /api/search
 * Default search endpoint - uses hybrid search
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      q,
      priceMin,
      priceMax,
      location,
      moduleType,
      limit,
      offset,
    } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        error: {
          code: 'INVALID_QUERY',
          message: 'Search query parameter "q" is required',
        },
      });
    }

    const filters: searchService.SearchFilters = {};

    if (priceMin) filters.priceMin = parseFloat(priceMin as string);
    if (priceMax) filters.priceMax = parseFloat(priceMax as string);
    if (location) {
      filters.location = Array.isArray(location) ? location as string[] : [location as string];
    }
    if (moduleType) {
      filters.moduleType = Array.isArray(moduleType) ? moduleType as string[] : [moduleType as string];
    }
    if (limit) filters.limit = parseInt(limit as string, 10);
    if (offset) filters.offset = parseInt(offset as string, 10);

    const response = await searchService.hybridSearch(q, filters);

    res.json(response);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: {
        code: 'SEARCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to perform search',
      },
    });
  }
});

export default router;
