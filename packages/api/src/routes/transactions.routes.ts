import { Router, Response, NextFunction } from 'express';
import * as transactionService from '../services/transaction.service';
import { authenticate, AuthenticatedRequest, authorize, UserRole } from '../middleware/auth.middleware';
import { query } from '../db';

const router = Router();

/**
 * POST /api/transactions/sale
 * Record a sale transaction
 * Access: BUILDER (own properties), ADMIN
 */
router.post(
  '/sale',
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

      const { leadId, propertyId, builderId, salePrice, currency } = req.body;

      // If builder, verify they own the property
      if (req.user.role === UserRole.BUILDER) {
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

        const userBuilderId = partnerResult.rows[0].id;

        // Verify the builderId matches the authenticated user's builder ID
        if (builderId !== userBuilderId) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You can only record transactions for your own properties',
            },
          });
        }
      }

      const transaction = await transactionService.recordSaleTransaction(
        leadId,
        propertyId,
        builderId,
        salePrice,
        currency
      );

      res.status(201).json({
        success: true,
        data: {
          transaction,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid') || error.message.includes('positive')) {
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
            code: 'RECORD_SALE_FAILED',
            message: error.message,
          },
        });
      }

      next(error);
    }
  }
);

/**
 * POST /api/transactions/design
 * Record a design purchase transaction
 * Access: BUILDER (own designs), ADMIN
 */
router.post(
  '/design',
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

      const { designId, userId, builderId, amount, currency } = req.body;

      // If builder, verify they own the design
      if (req.user.role === UserRole.BUILDER) {
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

        const userBuilderId = partnerResult.rows[0].id;

        // Verify the builderId matches the authenticated user's builder ID
        if (builderId !== userBuilderId) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You can only record transactions for your own designs',
            },
          });
        }
      }

      const transaction = await transactionService.recordDesignPurchase(
        designId,
        userId,
        builderId,
        amount,
        currency
      );

      res.status(201).json({
        success: true,
        data: {
          transaction,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid') || error.message.includes('positive')) {
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
            code: 'RECORD_DESIGN_PURCHASE_FAILED',
            message: error.message,
          },
        });
      }

      next(error);
    }
  }
);

/**
 * GET /api/transactions
 * Get transactions with optional filters
 * Access: BUILDER (own transactions), ADMIN (all transactions)
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

      const { builderId, startDate, endDate, transactionType } = req.query;

      let filters: any = {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        transactionType: transactionType as 'SALE' | 'DESIGN_PURCHASE' | undefined,
      };

      // If builder, only show their transactions
      if (req.user.role === UserRole.BUILDER) {
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

        filters.builderId = partnerResult.rows[0].id;
      } else if (builderId) {
        // Admin can filter by specific builder
        filters.builderId = builderId as string;
      }

      const transactions = await transactionService.getTransactions(filters);

      res.json({
        success: true,
        data: {
          transactions,
          count: transactions.length,
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
            code: 'GET_TRANSACTIONS_FAILED',
            message: error.message,
          },
        });
      }

      next(error);
    }
  }
);

/**
 * GET /api/transactions/:transactionId
 * Get a specific transaction by ID
 * Access: BUILDER (own transactions), ADMIN
 */
router.get(
  '/:transactionId',
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

      const { transactionId } = req.params;

      const transaction = await transactionService.getTransactionById(transactionId);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'TRANSACTION_NOT_FOUND',
            message: 'Transaction not found',
          },
        });
      }

      // If builder, verify they own the transaction
      if (req.user.role === UserRole.BUILDER) {
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

        const userBuilderId = partnerResult.rows[0].id;

        if (transaction.partnerId !== userBuilderId) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You can only view your own transactions',
            },
          });
        }
      }

      res.json({
        success: true,
        data: {
          transaction,
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
            code: 'GET_TRANSACTION_FAILED',
            message: error.message,
          },
        });
      }

      next(error);
    }
  }
);

export default router;
