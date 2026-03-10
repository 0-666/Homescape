import { Router, Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { z } from 'zod';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.register(req.body);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        },
      },
      message: 'User registered successfully',
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
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: error.message,
          },
        });
      }

      return res.status(400).json({
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: error.message,
        },
      });
    }

    next(error);
  }
});

/**
 * POST /api/auth/login
 * Login user and create session
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await authService.login(req.body);

    // Check if MFA is required
    if (session.mfaRequired) {
      return res.json({
        success: true,
        data: {
          tempToken: session.token,
          mfaRequired: true,
        },
        message: 'MFA verification required. Please provide your authenticator code.',
      });
    }

    res.json({
      success: true,
      data: {
        token: session.token,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt,
        mfaRequired: false,
      },
      message: 'Login successful',
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
      if (error.message.includes('Invalid email or password')) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: error.message,
          },
        });
      }

      return res.status(400).json({
        success: false,
        error: {
          code: 'LOGIN_FAILED',
          message: error.message,
        },
      });
    }

    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Logout user and invalidate session
 */
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'No authentication token provided',
        },
      });
    }

    await authService.logout(token);

    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_REFRESH_TOKEN',
          message: 'Refresh token is required',
        },
      });
    }

    const session = await authService.refreshAccessToken(refreshToken);

    res.json({
      success: true,
      data: {
        token: session.token,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt,
      },
      message: 'Token refreshed successfully',
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('Session not found')) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: error.message,
          },
        });
      }

      return res.status(400).json({
        success: false,
        error: {
          code: 'REFRESH_FAILED',
          message: error.message,
        },
      });
    }

    next(error);
  }
});

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'No authentication token provided',
        },
      });
    }

    const user = await authService.verifyToken(token);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          mfaEnabled: user.mfaEnabled,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Invalid token') || error.message.includes('Session not found')) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: error.message,
          },
        });
      }
    }

    next(error);
  }
});

export default router;

/**
 * POST /api/auth/mfa/setup
 * Generate MFA secret and QR code for enrollment
 */
router.post('/mfa/setup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'No authentication token provided',
        },
      });
    }

    const user = await authService.verifyToken(token);

    // Only allow Builder and Admin roles to enable MFA
    if (user.role !== 'BUILDER' && user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'MFA is only available for Builder and Admin roles',
        },
      });
    }

    const mfaSetup = await authService.generateMFASecret(user.id);

    res.json({
      success: true,
      data: {
        secret: mfaSetup.secret,
        qrCodeUrl: mfaSetup.qrCodeUrl,
        backupCodes: mfaSetup.backupCodes,
      },
      message: 'MFA setup initiated. Please scan the QR code with your authenticator app and verify with a code.',
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MFA_SETUP_FAILED',
          message: error.message,
        },
      });
    }

    next(error);
  }
});

/**
 * POST /api/auth/mfa/enable
 * Enable MFA after verifying the initial TOTP code
 */
router.post('/mfa/enable', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'No authentication token provided',
        },
      });
    }

    const user = await authService.verifyToken(token);

    const { secret, code } = req.body;

    if (!secret || !code) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Secret and verification code are required',
        },
      });
    }

    await authService.enableMFA(user.id, secret, code);

    res.json({
      success: true,
      message: 'MFA enabled successfully',
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Invalid verification code')) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CODE',
            message: error.message,
          },
        });
      }

      return res.status(400).json({
        success: false,
        error: {
          code: 'MFA_ENABLE_FAILED',
          message: error.message,
        },
      });
    }

    next(error);
  }
});

/**
 * POST /api/auth/mfa/disable
 * Disable MFA for the current user
 */
router.post('/mfa/disable', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'No authentication token provided',
        },
      });
    }

    const user = await authService.verifyToken(token);

    await authService.disableMFA(user.id);

    res.json({
      success: true,
      message: 'MFA disabled successfully',
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MFA_DISABLE_FAILED',
          message: error.message,
        },
      });
    }

    next(error);
  }
});

/**
 * POST /api/auth/mfa/verify
 * Complete MFA login by verifying the TOTP code
 */
router.post('/mfa/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tempToken, code } = req.body;

    if (!tempToken || !code) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Temporary token and verification code are required',
        },
      });
    }

    const session = await authService.completeMFALogin(tempToken, code);

    res.json({
      success: true,
      data: {
        token: session.token,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt,
      },
      message: 'MFA verification successful',
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Invalid MFA code')) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_MFA_CODE',
            message: error.message,
          },
        });
      }

      if (error.message.includes('Invalid') || error.message.includes('expired')) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: error.message,
          },
        });
      }

      return res.status(400).json({
        success: false,
        error: {
          code: 'MFA_VERIFICATION_FAILED',
          message: error.message,
        },
      });
    }

    next(error);
  }
});
