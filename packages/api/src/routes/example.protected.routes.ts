import { Router } from 'express';
import { authenticate, requireUser, requireBuilder, requireAdmin, requireBuilderOrAdmin, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

/**
 * Example: Public route (no authentication required)
 */
router.get('/public', (req, res) => {
  res.json({
    success: true,
    message: 'This is a public endpoint',
  });
});

/**
 * Example: Protected route for any authenticated user
 * All roles (USER, BUILDER, ADMIN) can access this
 */
router.get('/profile', authenticate, (req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    data: {
      user: req.user,
    },
    message: 'User profile retrieved',
  });
});

/**
 * Example: USER-only route
 * Only users with USER role can access this
 */
router.get('/user/dashboard', authenticate, requireUser, (req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    data: {
      message: 'Welcome to the User Dashboard',
      userId: req.user?.id,
    },
  });
});

/**
 * Example: BUILDER-only route
 * Only users with BUILDER role can access this
 */
router.get('/builder/inventory', authenticate, requireBuilder, (req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    data: {
      message: 'Builder inventory',
      builderId: req.user?.id,
    },
  });
});

/**
 * Example: ADMIN-only route
 * Only users with ADMIN role can access this
 */
router.get('/admin/partners', authenticate, requireAdmin, (req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    data: {
      message: 'Admin partners management',
      adminId: req.user?.id,
    },
  });
});

/**
 * Example: BUILDER or ADMIN route
 * Users with either BUILDER or ADMIN role can access this
 */
router.get('/analytics', authenticate, requireBuilderOrAdmin, (req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    data: {
      message: 'Analytics dashboard',
      userRole: req.user?.role,
    },
  });
});

export default router;
