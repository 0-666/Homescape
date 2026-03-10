import { Router, Request, Response } from 'express';
import * as moduleRegistry from '../services/module-registry.service';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

/**
 * @route   POST /api/modules
 * @desc    Register a new property module
 * @access  Admin only
 */
router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const module = await moduleRegistry.registerModule(req.body);
    res.status(201).json({
      success: true,
      data: module,
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
 * @route   GET /api/modules
 * @desc    List all property modules
 * @access  Authenticated users
 * @query   activeOnly - Filter to only active modules (optional, default: false)
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const modules = await moduleRegistry.listModules(activeOnly);
    res.status(200).json({
      success: true,
      data: modules,
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
 * @route   GET /api/modules/:type
 * @desc    Get a specific module by type
 * @access  Authenticated users
 */
router.get('/:type', authenticate, async (req: Request, res: Response) => {
  try {
    const module = await moduleRegistry.getModule(req.params.type);
    
    if (!module) {
      return res.status(404).json({
        success: false,
        error: `Module type '${req.params.type}' not found`,
      });
    }

    res.status(200).json({
      success: true,
      data: module,
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
 * @route   PATCH /api/modules/:type
 * @desc    Update a property module
 * @access  Admin only
 */
router.patch('/:type', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const module = await moduleRegistry.updateModule(req.params.type, req.body);
    res.status(200).json({
      success: true,
      data: module,
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
 * @route   DELETE /api/modules/:type
 * @desc    Delete a property module
 * @access  Admin only
 */
router.delete('/:type', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    await moduleRegistry.deleteModule(req.params.type);
    res.status(200).json({
      success: true,
      message: `Module '${req.params.type}' deleted successfully`,
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
 * @route   POST /api/modules/:type/enable
 * @desc    Enable a property module
 * @access  Admin only
 */
router.post('/:type/enable', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const module = await moduleRegistry.enableModule(req.params.type);
    res.status(200).json({
      success: true,
      data: module,
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
 * @route   POST /api/modules/:type/disable
 * @desc    Disable a property module
 * @access  Admin only
 */
router.post('/:type/disable', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const module = await moduleRegistry.disableModule(req.params.type);
    res.status(200).json({
      success: true,
      data: module,
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
 * @route   POST /api/modules/:type/validate
 * @desc    Validate property data against module schema
 * @access  Authenticated users
 */
router.post('/:type/validate', authenticate, async (req: Request, res: Response) => {
  try {
    const module = await moduleRegistry.getModule(req.params.type);
    
    if (!module) {
      return res.status(404).json({
        success: false,
        error: `Module type '${req.params.type}' not found`,
      });
    }

    const validationResult = moduleRegistry.validatePropertyData(req.body, module.schema);
    
    res.status(200).json({
      success: true,
      data: validationResult,
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
