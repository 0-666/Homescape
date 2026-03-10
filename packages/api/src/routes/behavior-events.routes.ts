import { Router, Response, NextFunction } from 'express';
import * as behaviorEventsService from '../services/behavior-events.service';
import { authenticate, AuthenticatedRequest, authorize, UserRole } from '../middleware/auth.middleware';
import { query } from '../db';
import { z } from 'zod';

const router = Router();

/**
 * POST /api/events
 * Track a new behavior event (authenticated users only)
 */
router.post(
  '/',
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

      // Use authenticated user's ID
      const eventData = {
        userId: req.user.id,
        propertyId: req.body.propertyId,
        eventType: req.body.eventType,
        metadata: req.body.metadata,
      };

      const event = await behaviorEventsService.trackEvent(eventData);

      res.status(201).json({
        success: true,
        data: {
          event: {
            id: event.id,
            userId: event.userId,
            propertyId: event.propertyId,
            eventType: event.eventType,
            metadata: event.metadata,
            createdAt: event.createdAt,
          },
        },
        message: 'Event tracked successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
        });
      }

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: error.message,
            },
          });
        }

        return res.status(400).json({
          success: false,
          error: {
            code: 'TRACK_EVENT_FAILED',
            message: error.message,
          },
        });
      }

      next(error);
    }
  }
);

/**
 * GET /api/events/user/:userId
 * Get behavior events for a specific user (authenticated users can only see their own events)
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

      // Users can only view their own events unless they are admin
      if (req.user.role !== UserRole.ADMIN && req.user.id !== userId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only view your own events',
          },
        });
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const events = await behaviorEventsService.getEventsByUser(userId, limit, offset);

      res.json({
        success: true,
        data: {
          events,
          pagination: {
            limit,
            offset,
            count: events.length,
          },
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
            code: 'GET_EVENTS_FAILED',
            message: error.message,
          },
        });
      }

      next(error);
    }
  }
);

/**
 * GET /api/events/property/:propertyId
 * Get behavior events for a specific property (builders/admins only)
 */
router.get(
  '/property/:propertyId',
  authenticate,
  authorize(UserRole.BUILDER, UserRole.ADMIN),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { propertyId } = req.params;

      // If builder, verify they own the property
      if (req.user?.role === UserRole.BUILDER) {
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
              message: 'You can only view events for your own properties',
            },
          });
        }
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const events = await behaviorEventsService.getEventsByProperty(propertyId, limit, offset);

      res.json({
        success: true,
        data: {
          events,
          pagination: {
            limit,
            offset,
            count: events.length,
          },
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
            code: 'GET_EVENTS_FAILED',
            message: error.message,
          },
        });
      }

      next(error);
    }
  }
);

/**
 * GET /api/events/user/:userId/counts
 * Get event counts by type for a user (authenticated users can only see their own counts)
 */
router.get(
  '/user/:userId/counts',
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

      // Users can only view their own counts unless they are admin
      if (req.user.role !== UserRole.ADMIN && req.user.id !== userId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only view your own event counts',
          },
        });
      }

      const counts = await behaviorEventsService.getEventCountsByUser(userId);

      res.json({
        success: true,
        data: {
          counts,
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
            code: 'GET_COUNTS_FAILED',
            message: error.message,
          },
        });
      }

      next(error);
    }
  }
);

export default router;
