import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { UserRole } from '../services/auth.service';

/**
 * Extended Express Request with user information
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    mfaEnabled: boolean;
  };
}

/**
 * Authentication middleware - verifies JWT token and attaches user to request
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'No authentication token provided',
        },
      });
      return;
    }

    // Check Bearer token format
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN_FORMAT',
          message: 'Invalid token format. Expected: Bearer <token>',
        },
      });
      return;
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token and get user
    const user = await authService.verifyToken(token);

    // Attach user to request
    req.user = user;

    next();
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes('Invalid token') ||
        error.message.includes('Session not found') ||
        error.message.includes('expired')
      ) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired authentication token',
          },
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'An error occurred during authentication',
      },
    });
  }
}

/**
 * Authorization middleware factory - creates middleware that enforces role restrictions
 * @param allowedRoles - Array of roles that are allowed to access the route
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Check if user is authenticated
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Check if user's role is in the allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Convenience middleware for USER role only
 */
export const requireUser = authorize(UserRole.USER);

/**
 * Convenience middleware for BUILDER role only
 */
export const requireBuilder = authorize(UserRole.BUILDER);

/**
 * Convenience middleware for ADMIN role only
 */
export const requireAdmin = authorize(UserRole.ADMIN);

/**
 * Convenience middleware for BUILDER or ADMIN roles
 */
export const requireBuilderOrAdmin = authorize(UserRole.BUILDER, UserRole.ADMIN);

/**
 * Convenience middleware for any authenticated user (all roles)
 */
export const requireAnyRole = authorize(UserRole.USER, UserRole.BUILDER, UserRole.ADMIN);
