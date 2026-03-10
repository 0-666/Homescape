import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authenticate, authorize, AuthenticatedRequest, requireUser, requireBuilder, requireAdmin } from './auth.middleware';
import * as authService from '../services/auth.service';
import { UserRole } from '../services/auth.service';

// Mock the auth service
vi.mock('../services/auth.service');

describe('Authentication Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      headers: {},
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = vi.fn();

    vi.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should return 401 when no authorization header is provided', async () => {
      await authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'No authentication token provided',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header does not start with Bearer', async () => {
      mockRequest.headers = { authorization: 'InvalidFormat token123' };

      await authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TOKEN_FORMAT',
          message: 'Invalid token format. Expected: Bearer <token>',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', async () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      vi.mocked(authService.verifyToken).mockRejectedValue(new Error('Invalid token'));

      await authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired authentication token',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when session is not found', async () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      vi.mocked(authService.verifyToken).mockRejectedValue(new Error('Session not found or expired'));

      await authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired authentication token',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is expired', async () => {
      mockRequest.headers = { authorization: 'Bearer expired-token' };
      vi.mocked(authService.verifyToken).mockRejectedValue(new Error('Token expired'));

      await authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired authentication token',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should attach user to request and call next when token is valid', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: UserRole.USER,
        createdAt: new Date(),
        mfaEnabled: false,
      };

      mockRequest.headers = { authorization: 'Bearer valid-token' };
      vi.mocked(authService.verifyToken).mockResolvedValue(mockUser);

      await authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(authService.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(mockRequest.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 500 for unexpected errors', async () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      vi.mocked(authService.verifyToken).mockRejectedValue(new Error('Database connection failed'));

      await authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'An error occurred during authentication',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    it('should return 401 when user is not authenticated', () => {
      const middleware = authorize(UserRole.USER);

      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Authentication required',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when user role is not in allowed roles', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        role: UserRole.USER,
        mfaEnabled: false,
      };

      const middleware = authorize(UserRole.BUILDER);

      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied. Required role: BUILDER',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next when user role is in allowed roles', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        role: UserRole.USER,
        mfaEnabled: false,
      };

      const middleware = authorize(UserRole.USER);

      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should allow access when user has one of multiple allowed roles', () => {
      mockRequest.user = {
        id: 'builder-123',
        email: 'builder@example.com',
        role: UserRole.BUILDER,
        mfaEnabled: false,
      };

      const middleware = authorize(UserRole.BUILDER, UserRole.ADMIN);

      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should deny access when user does not have any of the allowed roles', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'user@example.com',
        role: UserRole.USER,
        mfaEnabled: false,
      };

      const middleware = authorize(UserRole.BUILDER, UserRole.ADMIN);

      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied. Required role: BUILDER or ADMIN',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Convenience middleware', () => {
    describe('requireUser', () => {
      it('should allow USER role', () => {
        mockRequest.user = {
          id: 'user-123',
          email: 'user@example.com',
          role: UserRole.USER,
          mfaEnabled: false,
        };

        requireUser(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(statusMock).not.toHaveBeenCalled();
      });

      it('should deny BUILDER role', () => {
        mockRequest.user = {
          id: 'builder-123',
          email: 'builder@example.com',
          role: UserRole.BUILDER,
          mfaEnabled: false,
        };

        requireUser(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('requireBuilder', () => {
      it('should allow BUILDER role', () => {
        mockRequest.user = {
          id: 'builder-123',
          email: 'builder@example.com',
          role: UserRole.BUILDER,
          mfaEnabled: false,
        };

        requireBuilder(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(statusMock).not.toHaveBeenCalled();
      });

      it('should deny USER role', () => {
        mockRequest.user = {
          id: 'user-123',
          email: 'user@example.com',
          role: UserRole.USER,
          mfaEnabled: false,
        };

        requireBuilder(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('requireAdmin', () => {
      it('should allow ADMIN role', () => {
        mockRequest.user = {
          id: 'admin-123',
          email: 'admin@example.com',
          role: UserRole.ADMIN,
          mfaEnabled: false,
        };

        requireAdmin(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(statusMock).not.toHaveBeenCalled();
      });

      it('should deny USER role', () => {
        mockRequest.user = {
          id: 'user-123',
          email: 'user@example.com',
          role: UserRole.USER,
          mfaEnabled: false,
        };

        requireAdmin(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should deny BUILDER role', () => {
        mockRequest.user = {
          id: 'builder-123',
          email: 'builder@example.com',
          role: UserRole.BUILDER,
          mfaEnabled: false,
        };

        requireAdmin(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
      });
    });
  });

  describe('RBAC enforcement scenarios', () => {
    it('should prevent USER from accessing BUILDER endpoints', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'user@example.com',
        role: UserRole.USER,
        mfaEnabled: false,
      };

      const middleware = authorize(UserRole.BUILDER);
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should prevent USER from accessing ADMIN endpoints', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'user@example.com',
        role: UserRole.USER,
        mfaEnabled: false,
      };

      const middleware = authorize(UserRole.ADMIN);
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should prevent BUILDER from accessing ADMIN endpoints', () => {
      mockRequest.user = {
        id: 'builder-123',
        email: 'builder@example.com',
        role: UserRole.BUILDER,
        mfaEnabled: false,
      };

      const middleware = authorize(UserRole.ADMIN);
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow ADMIN to access ADMIN endpoints', () => {
      mockRequest.user = {
        id: 'admin-123',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
        mfaEnabled: false,
      };

      const middleware = authorize(UserRole.ADMIN);
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });
});
