import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as authService from './auth.service';
import * as db from '../db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { authenticator } from 'otplib';

// Mock dependencies
vi.mock('../db');
vi.mock('bcrypt');
vi.mock('jsonwebtoken');
vi.mock('qrcode');
vi.mock('otplib', () => ({
  authenticator: {
    generateSecret: vi.fn(),
    keyuri: vi.fn(),
    verify: vi.fn(),
  },
}));

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a user with valid email and password', async () => {
      // Arrange
      const input = {
        email: 'test@example.com',
        password: 'Password123',
        role: authService.UserRole.USER,
      };

      vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 }); // No existing user
      vi.mocked(bcrypt.hash).mockResolvedValueOnce('hashed_password' as never);
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{
          id: '123',
          email: input.email,
          role: input.role,
          createdAt: new Date(),
          mfaEnabled: false,
        }],
        rowCount: 1,
      });

      // Act
      const result = await authService.register(input);

      // Assert
      expect(result).toBeDefined();
      expect(result.email).toBe(input.email);
      expect(result.role).toBe(input.role);
      expect(bcrypt.hash).toHaveBeenCalledWith(input.password, 12);
    });

    it('should reject registration with invalid email format', async () => {
      // Arrange
      const input = {
        email: 'invalid-email',
        password: 'Password123',
      };

      // Act & Assert
      await expect(authService.register(input)).rejects.toThrow();
    });

    it('should reject password without uppercase letter', async () => {
      // Arrange
      const input = {
        email: 'test@example.com',
        password: 'password123',
      };

      // Act & Assert
      await expect(authService.register(input)).rejects.toThrow();
    });

    it('should reject password without number', async () => {
      // Arrange
      const input = {
        email: 'test@example.com',
        password: 'PasswordABC',
      };

      // Act & Assert
      await expect(authService.register(input)).rejects.toThrow();
    });

    it('should reject password shorter than 8 characters', async () => {
      // Arrange
      const input = {
        email: 'test@example.com',
        password: 'Pass1',
      };

      // Act & Assert
      await expect(authService.register(input)).rejects.toThrow();
    });

    it('should reject registration if user already exists', async () => {
      // Arrange
      const input = {
        email: 'existing@example.com',
        password: 'Password123',
      };

      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ id: '456' }],
        rowCount: 1,
      });

      // Act & Assert
      await expect(authService.register(input)).rejects.toThrow('User with this email already exists');
    });

    it('should hash password with 12 salt rounds', async () => {
      // Arrange
      const input = {
        email: 'test@example.com',
        password: 'Password123',
      };

      vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 });
      vi.mocked(bcrypt.hash).mockResolvedValueOnce('hashed_password' as never);
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{
          id: '123',
          email: input.email,
          role: 'USER',
          createdAt: new Date(),
          mfaEnabled: false,
        }],
        rowCount: 1,
      });

      // Act
      await authService.register(input);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith(input.password, 12);
    });

    it('should default role to USER if not specified', async () => {
      // Arrange
      const input = {
        email: 'test@example.com',
        password: 'Password123',
      };

      vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 });
      vi.mocked(bcrypt.hash).mockResolvedValueOnce('hashed_password' as never);
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{
          id: '123',
          email: input.email,
          role: 'USER',
          createdAt: new Date(),
          mfaEnabled: false,
        }],
        rowCount: 1,
      });

      // Act
      const result = await authService.register(input);

      // Assert
      expect(result.role).toBe('USER');
    });

    it('should accept BUILDER role', async () => {
      // Arrange
      const input = {
        email: 'builder@example.com',
        password: 'Password123',
        role: authService.UserRole.BUILDER,
      };

      vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 });
      vi.mocked(bcrypt.hash).mockResolvedValueOnce('hashed_password' as never);
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{
          id: '123',
          email: input.email,
          role: input.role,
          createdAt: new Date(),
          mfaEnabled: false,
        }],
        rowCount: 1,
      });

      // Act
      const result = await authService.register(input);

      // Assert
      expect(result.role).toBe(authService.UserRole.BUILDER);
    });

    it('should accept ADMIN role', async () => {
      // Arrange
      const input = {
        email: 'admin@example.com',
        password: 'Password123',
        role: authService.UserRole.ADMIN,
      };

      vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 });
      vi.mocked(bcrypt.hash).mockResolvedValueOnce('hashed_password' as never);
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{
          id: '123',
          email: input.email,
          role: input.role,
          createdAt: new Date(),
          mfaEnabled: false,
        }],
        rowCount: 1,
      });

      // Act
      const result = await authService.register(input);

      // Assert
      expect(result.role).toBe(authService.UserRole.ADMIN);
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      // Arrange
      const input = {
        email: 'test@example.com',
        password: 'Password123',
      };

      const mockUser = {
        id: '123',
        email: input.email,
        password_hash: 'hashed_password',
        role: 'USER',
        mfa_enabled: false,
      };

      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1,
      });
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
      vi.mocked(jwt.sign).mockReturnValueOnce('access_token' as never);
      vi.mocked(jwt.sign).mockReturnValueOnce('refresh_token' as never);
      vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

      // Act
      const result = await authService.login(input);

      // Assert
      expect(result).toBeDefined();
      expect(result.token).toBe('access_token');
      expect(result.refreshToken).toBe('refresh_token');
      expect(result.userId).toBe(mockUser.id);
    });

    it('should reject login with invalid email', async () => {
      // Arrange
      const input = {
        email: 'nonexistent@example.com',
        password: 'Password123',
      };

      vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

      // Act & Assert
      await expect(authService.login(input)).rejects.toThrow('Invalid email or password');
    });

    it('should reject login with invalid password', async () => {
      // Arrange
      const input = {
        email: 'test@example.com',
        password: 'WrongPassword123',
      };

      const mockUser = {
        id: '123',
        email: input.email,
        password_hash: 'hashed_password',
        role: 'USER',
        mfa_enabled: false,
      };

      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1,
      });
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);

      // Act & Assert
      await expect(authService.login(input)).rejects.toThrow('Invalid email or password');
    });
  });

  describe('verifyToken', () => {
    it('should successfully verify valid token', async () => {
      // Arrange
      const token = 'valid_token';
      const mockDecoded = {
        userId: '123',
        email: 'test@example.com',
        role: 'USER',
      };

      const mockUser = {
        id: '123',
        email: 'test@example.com',
        role: 'USER',
        createdAt: new Date(),
        mfaEnabled: false,
      };

      vi.mocked(jwt.verify).mockReturnValueOnce(mockDecoded as never);
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ user_id: '123' }],
        rowCount: 1,
      });
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1,
      });

      // Act
      const result = await authService.verifyToken(token);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
    });

    it('should reject invalid token', async () => {
      // Arrange
      const token = 'invalid_token';

      vi.mocked(jwt.verify).mockImplementationOnce(() => {
        throw new jwt.JsonWebTokenError('invalid token');
      });

      // Act & Assert
      await expect(authService.verifyToken(token)).rejects.toThrow('Invalid token');
    });
  });

  describe('refreshAccessToken', () => {
    it('should successfully refresh access token with valid refresh token', async () => {
      // Arrange
      const refreshToken = 'valid_refresh_token';
      const mockDecoded = {
        userId: '123',
        type: 'refresh',
      };

      const mockSession = {
        user_id: '123',
        token: 'old_access_token',
      };

      const mockUser = {
        id: '123',
        email: 'test@example.com',
        role: 'USER',
      };

      vi.mocked(jwt.verify).mockReturnValueOnce(mockDecoded as never);
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [mockSession],
        rowCount: 1,
      });
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1,
      });
      vi.mocked(jwt.sign).mockReturnValueOnce('new_access_token' as never);
      vi.mocked(jwt.sign).mockReturnValueOnce('new_refresh_token' as never);
      vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

      // Act
      const result = await authService.refreshAccessToken(refreshToken);

      // Assert
      expect(result).toBeDefined();
      expect(result.token).toBe('new_access_token');
      expect(result.refreshToken).toBe('new_refresh_token');
      expect(result.userId).toBe(mockUser.id);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should reject refresh token with invalid type', async () => {
      // Arrange
      const refreshToken = 'invalid_type_token';
      const mockDecoded = {
        userId: '123',
        type: 'access', // Wrong type
      };

      vi.mocked(jwt.verify).mockReturnValueOnce(mockDecoded as never);

      // Act & Assert
      await expect(authService.refreshAccessToken(refreshToken)).rejects.toThrow('Invalid token type');
    });

    it('should reject refresh token not found in database', async () => {
      // Arrange
      const refreshToken = 'unknown_refresh_token';
      const mockDecoded = {
        userId: '123',
        type: 'refresh',
      };

      vi.mocked(jwt.verify).mockReturnValueOnce(mockDecoded as never);
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Act & Assert
      await expect(authService.refreshAccessToken(refreshToken)).rejects.toThrow('Session not found');
    });

    it('should reject expired refresh token', async () => {
      // Arrange
      const refreshToken = 'expired_refresh_token';

      vi.mocked(jwt.verify).mockImplementationOnce(() => {
        const error = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      // Act & Assert
      await expect(authService.refreshAccessToken(refreshToken)).rejects.toThrow('Invalid or expired refresh token');
    });

    it('should generate new tokens with correct expiration', async () => {
      // Arrange
      const refreshToken = 'valid_refresh_token';
      const mockDecoded = {
        userId: '123',
        type: 'refresh',
      };

      const mockSession = {
        user_id: '123',
        token: 'old_access_token',
      };

      const mockUser = {
        id: '123',
        email: 'test@example.com',
        role: 'USER',
      };

      vi.mocked(jwt.verify).mockReturnValueOnce(mockDecoded as never);
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [mockSession],
        rowCount: 1,
      });
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1,
      });
      vi.mocked(jwt.sign).mockReturnValueOnce('new_access_token' as never);
      vi.mocked(jwt.sign).mockReturnValueOnce('new_refresh_token' as never);
      vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const beforeTime = new Date();
      beforeTime.setHours(beforeTime.getHours() + 24);

      // Act
      const result = await authService.refreshAccessToken(refreshToken);

      const afterTime = new Date();
      afterTime.setHours(afterTime.getHours() + 24);

      // Assert
      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime() - 1000);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(afterTime.getTime() + 1000);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should delete expired sessions', async () => {
      // Arrange
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 5,
      });

      // Act
      const result = await authService.cleanupExpiredSessions();

      // Assert
      expect(result).toBe(5);
      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM sessions WHERE expires_at < NOW()',
        []
      );
    });

    it('should return 0 when no expired sessions', async () => {
      // Arrange
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Act
      const result = await authService.cleanupExpiredSessions();

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('MFA functionality', () => {
    describe('generateMFASecret', () => {
      it('should generate MFA secret with QR code and backup codes', async () => {
        // Arrange
        const userId = '123';
        const mockUser = {
          email: 'test@example.com',
        };

        vi.mocked(db.query).mockResolvedValueOnce({
          rows: [mockUser],
          rowCount: 1,
        });

        vi.mocked(authenticator.generateSecret).mockReturnValueOnce('TESTSECRET123');
        vi.mocked(authenticator.keyuri).mockReturnValueOnce('otpauth://totp/PropTech%20Platform:test@example.com?secret=TESTSECRET123');
        vi.mocked(QRCode.toDataURL).mockResolvedValueOnce('data:image/png;base64,mockqrcode' as never);

        // Act
        const result = await authService.generateMFASecret(userId);

        // Assert
        expect(result).toBeDefined();
        expect(result.secret).toBe('TESTSECRET123');
        expect(result.qrCodeUrl).toBe('data:image/png;base64,mockqrcode');
        expect(result.backupCodes).toHaveLength(8);
        expect(result.backupCodes[0]).toMatch(/^[A-Z0-9]{8}$/);
      });

      it('should throw error if user not found', async () => {
        // Arrange
        const userId = 'nonexistent';

        vi.mocked(db.query).mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
        });

        // Act & Assert
        await expect(authService.generateMFASecret(userId)).rejects.toThrow('User not found');
      });
    });

    describe('enableMFA', () => {
      it('should enable MFA after verifying valid TOTP code', async () => {
        // Arrange
        const userId = '123';
        const secret = 'TESTSECRET123';
        const code = '123456';

        vi.mocked(authenticator.verify).mockReturnValueOnce(true);
        vi.mocked(db.query).mockResolvedValueOnce({
          rows: [],
          rowCount: 1,
        });

        // Act
        await authService.enableMFA(userId, secret, code);

        // Assert
        expect(authenticator.verify).toHaveBeenCalledWith({
          token: code,
          secret: secret,
        });
        expect(db.query).toHaveBeenCalledWith(
          'UPDATE users SET mfa_enabled = true, mfa_secret = $1, updated_at = NOW() WHERE id = $2',
          [secret, userId]
        );
      });

      it('should reject invalid TOTP code', async () => {
        // Arrange
        const userId = '123';
        const secret = 'TESTSECRET123';
        const code = '000000';

        vi.mocked(authenticator.verify).mockReturnValueOnce(false);

        // Act & Assert
        await expect(authService.enableMFA(userId, secret, code)).rejects.toThrow('Invalid verification code');
      });
    });

    describe('disableMFA', () => {
      it('should disable MFA for a user', async () => {
        // Arrange
        const userId = '123';

        vi.mocked(db.query).mockResolvedValueOnce({
          rows: [],
          rowCount: 1,
        });

        // Act
        await authService.disableMFA(userId);

        // Assert
        expect(db.query).toHaveBeenCalledWith(
          'UPDATE users SET mfa_enabled = false, mfa_secret = NULL, updated_at = NOW() WHERE id = $1',
          [userId]
        );
      });
    });

    describe('verifyMFA', () => {
      it('should verify valid TOTP code', async () => {
        // Arrange
        const userId = '123';
        const code = '123456';
        const mockUser = {
          mfa_secret: 'TESTSECRET123',
        };

        vi.mocked(db.query).mockResolvedValueOnce({
          rows: [mockUser],
          rowCount: 1,
        });
        vi.mocked(authenticator.verify).mockReturnValueOnce(true);

        // Act
        const result = await authService.verifyMFA(userId, code);

        // Assert
        expect(result).toBe(true);
        expect(authenticator.verify).toHaveBeenCalledWith({
          token: code,
          secret: mockUser.mfa_secret,
        });
      });

      it('should reject invalid TOTP code', async () => {
        // Arrange
        const userId = '123';
        const code = '000000';
        const mockUser = {
          mfa_secret: 'TESTSECRET123',
        };

        vi.mocked(db.query).mockResolvedValueOnce({
          rows: [mockUser],
          rowCount: 1,
        });
        vi.mocked(authenticator.verify).mockReturnValueOnce(false);

        // Act
        const result = await authService.verifyMFA(userId, code);

        // Assert
        expect(result).toBe(false);
      });

      it('should return false if user has no MFA enabled', async () => {
        // Arrange
        const userId = '123';
        const code = '123456';

        vi.mocked(db.query).mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
        });

        // Act
        const result = await authService.verifyMFA(userId, code);

        // Assert
        expect(result).toBe(false);
      });

      it('should return false if user has no MFA secret', async () => {
        // Arrange
        const userId = '123';
        const code = '123456';
        const mockUser = {
          mfa_secret: null,
        };

        vi.mocked(db.query).mockResolvedValueOnce({
          rows: [mockUser],
          rowCount: 1,
        });

        // Act
        const result = await authService.verifyMFA(userId, code);

        // Assert
        expect(result).toBe(false);
      });
    });

    describe('login with MFA', () => {
      it('should require MFA for Builder role with MFA enabled', async () => {
        // Arrange
        const input = {
          email: 'builder@example.com',
          password: 'Password123',
        };

        const mockUser = {
          id: '123',
          email: input.email,
          password_hash: 'hashed_password',
          role: 'BUILDER',
          mfa_enabled: true,
        };

        vi.mocked(db.query).mockResolvedValueOnce({
          rows: [mockUser],
          rowCount: 1,
        });
        vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
        vi.mocked(jwt.sign).mockReturnValueOnce('temp_token' as never);

        // Act
        const result = await authService.login(input);

        // Assert
        expect(result.mfaRequired).toBe(true);
        expect(result.token).toBe('temp_token');
        expect(result.refreshToken).toBe('');
      });

      it('should require MFA for Admin role with MFA enabled', async () => {
        // Arrange
        const input = {
          email: 'admin@example.com',
          password: 'Password123',
        };

        const mockUser = {
          id: '123',
          email: input.email,
          password_hash: 'hashed_password',
          role: 'ADMIN',
          mfa_enabled: true,
        };

        vi.mocked(db.query).mockResolvedValueOnce({
          rows: [mockUser],
          rowCount: 1,
        });
        vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
        vi.mocked(jwt.sign).mockReturnValueOnce('temp_token' as never);

        // Act
        const result = await authService.login(input);

        // Assert
        expect(result.mfaRequired).toBe(true);
      });

      it('should not require MFA for User role', async () => {
        // Arrange
        const input = {
          email: 'user@example.com',
          password: 'Password123',
        };

        const mockUser = {
          id: '123',
          email: input.email,
          password_hash: 'hashed_password',
          role: 'USER',
          mfa_enabled: true,
        };

        vi.mocked(db.query).mockResolvedValueOnce({
          rows: [mockUser],
          rowCount: 1,
        });
        vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
        vi.mocked(jwt.sign).mockReturnValueOnce('access_token' as never);
        vi.mocked(jwt.sign).mockReturnValueOnce('refresh_token' as never);
        vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

        // Act
        const result = await authService.login(input);

        // Assert
        expect(result.mfaRequired).toBe(false);
        expect(result.token).toBe('access_token');
        expect(result.refreshToken).toBe('refresh_token');
      });

      it('should not require MFA for Builder without MFA enabled', async () => {
        // Arrange
        const input = {
          email: 'builder@example.com',
          password: 'Password123',
        };

        const mockUser = {
          id: '123',
          email: input.email,
          password_hash: 'hashed_password',
          role: 'BUILDER',
          mfa_enabled: false,
        };

        vi.mocked(db.query).mockResolvedValueOnce({
          rows: [mockUser],
          rowCount: 1,
        });
        vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
        vi.mocked(jwt.sign).mockReturnValueOnce('access_token' as never);
        vi.mocked(jwt.sign).mockReturnValueOnce('refresh_token' as never);
        vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

        // Act
        const result = await authService.login(input);

        // Assert
        expect(result.mfaRequired).toBe(false);
      });
    });

    describe('completeMFALogin', () => {
      it('should complete MFA login with valid code', async () => {
        // Arrange
        const tempToken = 'temp_token';
        const code = '123456';
        const mockDecoded = {
          userId: '123',
          email: 'builder@example.com',
          role: 'BUILDER',
          mfaPending: true,
        };

        const mockUser = {
          mfa_secret: 'TESTSECRET123',
        };

        vi.mocked(jwt.verify).mockReturnValueOnce(mockDecoded as never);
        vi.mocked(db.query).mockResolvedValueOnce({
          rows: [mockUser],
          rowCount: 1,
        });
        vi.mocked(authenticator.verify).mockReturnValueOnce(true);
        vi.mocked(jwt.sign).mockReturnValueOnce('access_token' as never);
        vi.mocked(jwt.sign).mockReturnValueOnce('refresh_token' as never);
        vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

        // Act
        const result = await authService.completeMFALogin(tempToken, code);

        // Assert
        expect(result.token).toBe('access_token');
        expect(result.refreshToken).toBe('refresh_token');
        expect(result.mfaRequired).toBe(false);
      });

      it('should reject invalid MFA code', async () => {
        // Arrange
        const tempToken = 'temp_token';
        const code = '000000';
        const mockDecoded = {
          userId: '123',
          email: 'builder@example.com',
          role: 'BUILDER',
          mfaPending: true,
        };

        const mockUser = {
          mfa_secret: 'TESTSECRET123',
        };

        vi.mocked(jwt.verify).mockReturnValueOnce(mockDecoded as never);
        vi.mocked(db.query).mockResolvedValueOnce({
          rows: [mockUser],
          rowCount: 1,
        });
        vi.mocked(authenticator.verify).mockReturnValueOnce(false);

        // Act & Assert
        await expect(authService.completeMFALogin(tempToken, code)).rejects.toThrow('Invalid MFA code');
      });

      it('should reject token without mfaPending flag', async () => {
        // Arrange
        const tempToken = 'regular_token';
        const code = '123456';
        const mockDecoded = {
          userId: '123',
          email: 'builder@example.com',
          role: 'BUILDER',
          mfaPending: false,
        };

        vi.mocked(jwt.verify).mockReturnValueOnce(mockDecoded as never);

        // Act & Assert
        await expect(authService.completeMFALogin(tempToken, code)).rejects.toThrow('Invalid token for MFA verification');
      });

      it('should reject expired temporary token', async () => {
        // Arrange
        const tempToken = 'expired_token';
        const code = '123456';

        vi.mocked(jwt.verify).mockImplementationOnce(() => {
          throw new jwt.JsonWebTokenError('jwt expired');
        });

        // Act & Assert
        await expect(authService.completeMFALogin(tempToken, code)).rejects.toThrow('Invalid or expired token');
      });
    });
  });
});
