import { Router, Response, NextFunction } from 'express';
import * as leadScoringService from '../services/lead-scoring.service';
import { authenticate, AuthenticatedRequest, authorize, UserRole } from '../middleware/auth.middleware';
import { query } from '../db';

const router = Router();

/**
 * GET /api/leads
 * Get all leads (builders see their properties, admins see all)
 */
router.get(
  '/',
  authenticate,
  authorize(UserRole.BUILDER, UserRole.ADMIN),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required',
          },
        });
      }

      let leads;

      if (req.user.role === UserRole.ADMIN) {
        // Admins see all leads
        const result = await query(
          `SELECT id, user_id as "userId", property_id as "propertyId", 
                  builder_id as "builderId", score, status, 
                  last_activity as "lastActivity", created_at as "createdAt"
           FROM leads
           ORDER BY score DESC, last_activity DESC`
        );
        leads = result.rows;
      } else {
        // Builders see only their leads
        // First get the builder's partner ID
        const partnerResult = await query(
          'SELECT id FROM partners WHERE user_id = $1',
          [req.user.id]
        );

        if (partnerResult.rows.length === 0) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'NOT_A_BUILDER',
              message: 'User is not registered as a builder',
            },
          });
        }

        const builderId = partnerResult.rows[0].id;
        leads = await leadScoringService.getLeadsByBuilder(builderId);
      }

      res.json({
        success: true,
        data: {
          leads,
          count: leads.length,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'GET_LEADS_FAILED',
            message: error.message,
          },
        });
      }

      next(error);
    }
  }
);

/**
 * GET /api/leads/user/:userId
 * Get leads for a specific user (users can see their own, admins see all)
 */
router.get(
  '/user/:userId',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required',
          },
        });
      }

      const { userId } = req.params;

      // Users can only view their own leads unless they are admin
      if (req.user.role !== UserRole.ADMIN && req.user.id !== userId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only view your own leads',
          },
        });
      }

      const leads = await leadScoringService.getLeadsByUser(userId);

      res.json({
        success: true,
        data: {
          leads,
          count: leads.length,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid')) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: error.message,
            },
          });
        }

        return res.status(400).json({
          success: false,
          error: {
            code: 'GET_LEADS_FAILED',
            message: error.message,
          },
        });
      }

      next(error);
    }
  }
);

/**
 * GET /api/leads/property/:propertyId
 * Get leads for a specific property (builders see their properties, admins see all)
 */
router.get(
  '/property/:propertyId',
  authenticate,
  authorize(UserRole.BUILDER, UserRole.ADMIN),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required',
          },
        });
      }

      const { propertyId } = req.params;

      // If builder, verify they own the property
      if (req.user.role === UserRole.BUILDER) {
        const propertyCheck = await query(
          `SELECT p.id, p.builder_id 
           FROM properties p
           JOIN partners pt ON p.builder_id = pt.id
           WHERE p.id = $1 AND pt.user_id = $2`,
          [propertyId, req.user.id]
        );

        if (propertyCheck.rows.length === 0) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You can only view leads for your own properties',
            },
          });
        }
      }

      const leads = await leadScoringService.getLeadsByProperty(propertyId);

      res.json({
        success: true,
        data: {
          leads,
          count: leads.length,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid')) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: error.message,
            },
          });
        }

        return res.status(400).json({
          success: false,
          error: {
            code: 'GET_LEADS_FAILED',
            message: error.message,
          },
        });
      }

      next(error);
    }
  }
);

/**
 * GET /api/leads/builder/:builderId
 * Get leads for a specific builder (builders see their own, admins see all)
 */
router.get(
  '/builder/:builderId',
  authenticate,
  authorize(UserRole.BUILDER, UserRole.ADMIN),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required',
          },
        });
      }

      const { builderId } = req.params;

      // If builder, verify they are requesting their own leads
      if (req.user.role === UserRole.BUILDER) {
        const partnerCheck = await query(
          'SELECT id FROM partners WHERE id = $1 AND user_id = $2',
          [builderId, req.user.id]
        );

        if (partnerCheck.rows.length === 0) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You can only view your own leads',
            },
          });
        }
      }

      const leads = await leadScoringService.getLeadsByBuilder(builderId);

      res.json({
        success: true,
        data: {
          leads,
          count: leads.length,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid')) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: error.message,
            },
          });
        }

        return res.status(400).json({
          success: false,
          error: {
            code: 'GET_LEADS_FAILED',
            message: error.message,
          },
        });
      }

      next(error);
    }
  }
);

export default router;
