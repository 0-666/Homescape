import { Router, Request, Response } from 'express';
import * as propertyService from '../services/property.service';
import { authenticate, requireBuilder, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

/**
 * @route   POST /api/properties
 * @desc    Create a new property
 * @access  Builder only
 */
router.post('/', authenticate, requireBuilder, async (req: Request, res: Response) => {
  try {
    // Ensure the builder can only create properties for themselves
    const builderId = req.body.builderId;
    
    // TODO: Add check to ensure builderId matches authenticated user's partner ID
    // For now, we'll trust the input but this should be validated
    
    const property = await propertyService.createProperty(req.body);
    res.status(201).json({
      success: true,
      data: property,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
});

/**
 * @route   GET /api/properties
 * @desc    List properties with optional filters
 * @access  Authenticated users
 * @query   builderId - Filter by builder ID (optional)
 * @query   moduleType - Filter by module type (optional)
 * @query   status - Filter by status (optional)
 * @query   limit - Number of results per page (optional, default: 20)
 * @query   offset - Pagination offset (optional, default: 0)
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const filters = {
      builderId: req.query.builderId as string | undefined,
      moduleType: req.query.moduleType as string | undefined,
      status: req.query.status as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };

    const result = await propertyService.listProperties(filters);
    res.status(200).json({
      success: true,
      data: result.properties,
      pagination: {
        total: result.total,
        limit: filters.limit || 20,
        offset: filters.offset || 0,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
});

/**
 * @route   GET /api/properties/:id
 * @desc    Get a specific property by ID
 * @access  Authenticated users
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const property = await propertyService.getProperty(req.params.id);
    
    if (!property) {
      return res.status(404).json({
        success: false,
        error: `Property '${req.params.id}' not found`,
      });
    }

    res.status(200).json({
      success: true,
      data: property,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
});

/**
 * @route   PATCH /api/properties/:id
 * @desc    Update a property
 * @access  Builder only (owner) or Admin
 */
router.patch('/:id', authenticate, requireBuilder, async (req: Request, res: Response) => {
  try {
    // TODO: Add check to ensure builder can only update their own properties
    // Admins should be able to update any property
    
    const property = await propertyService.updateProperty(req.params.id, req.body);
    res.status(200).json({
      success: true,
      data: property,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
});

/**
 * @route   DELETE /api/properties/:id
 * @desc    Delete a property
 * @access  Builder only (owner) or Admin
 */
router.delete('/:id', authenticate, requireBuilder, async (req: Request, res: Response) => {
  try {
    // TODO: Add check to ensure builder can only delete their own properties
    // Admins should be able to delete any property
    
    await propertyService.deleteProperty(req.params.id);
    res.status(200).json({
      success: true,
      message: `Property '${req.params.id}' deleted successfully`,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
});

/**
 * @route   GET /api/properties/builder/:builderId
 * @desc    Get all properties for a specific builder
 * @access  Authenticated users
 */
router.get('/builder/:builderId', authenticate, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

    const result = await propertyService.getPropertiesByBuilder(req.params.builderId, {
      limit,
      offset,
    });

    res.status(200).json({
      success: true,
      data: result.properties,
      pagination: {
        total: result.total,
        limit: limit || 20,
        offset: offset || 0,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
});

/**
 * @route   GET /api/properties/module/:moduleType
 * @desc    Get all properties for a specific module type
 * @access  Authenticated users
 */
router.get('/module/:moduleType', authenticate, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

    const result = await propertyService.getPropertiesByModule(req.params.moduleType, {
      limit,
      offset,
    });

    res.status(200).json({
      success: true,
      data: result.properties,
      pagination: {
        total: result.total,
        limit: limit || 20,
        offset: offset || 0,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
});

export default router;
