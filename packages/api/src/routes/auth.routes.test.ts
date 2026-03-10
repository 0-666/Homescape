import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from './auth.routes';
import * as authService from '../services/auth.service';

// Mock the auth service
vi.mock('../services/auth.service');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        role: authService.UserRole.USER,
        createdAt: new Date(),
        mfaEnabled: false,
      };

      vi.mocked(authService.register).mockResolvedValueOnce(mockUser);

      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.message).toBe('User registered successfully');
    });

    it('should return 400 for invalid email', async () => {
      // Arrange
      // Import ZodError to create a proper instance
      const { z } = await import('zod');
      
      try {
        // This will throw a ZodError
        z.string().email().parse('invalid-email');
      } catch (error) {
        vi.mocked(authService.register).mockRejectedValueOnce(error);
      }

      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Password123',
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 if user already exists', async () => {
      // Arrange
      vi.mocked(authService.register).mockRejectedValueOnce(
        new Error('User with this email already exists')
      );

      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'Password123',
        });

      // Assert
      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_EXISTS');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      // Arrange
      const mockSession = {
        token: 'access_token',
        refreshToken: 'refresh_token',
        expiresAt: new Date(),
        userId: '123',
      };

      vi.mocked(authService.login).mockResolvedValueOnce(mockSession);

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBe('access_token');
      expect(response.body.message).toBe('Login successful');
    });

    it('should return 401 for invalid credentials', async () => {
      // Arrange
      vi.mocked(authService.login).mockRejectedValueOnce(
        new Error('Invalid email or password')
      );

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword',
        });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      // Arrange
      vi.mocked(authService.logout).mockResolvedValueOnce();

      // Act
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid_token');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout successful');
    });

    it('should return 401 if no token provided', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/logout');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user information', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        role: authService.UserRole.USER,
        createdAt: new Date(),
        mfaEnabled: false,
      };

      vi.mocked(authService.verifyToken).mockResolvedValueOnce(mockUser);

      // Act
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid_token');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
    });

    it('should return 401 for invalid token', async () => {
      // Arrange
      vi.mocked(authService.verifyToken).mockRejectedValueOnce(
        new Error('Invalid token')
      );

      // Act
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh access token successfully', async () => {
      // Arrange
      const mockSession = {
        token: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresAt: new Date(),
        userId: '123',
      };

      vi.mocked(authService.refreshAccessToken).mockResolvedValueOnce(mockSession);

      // Act
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'valid_refresh_token',
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBe('new_access_token');
      expect(response.body.data.refreshToken).toBe('new_refresh_token');
      expect(response.body.message).toBe('Token refreshed successfully');
    });

    it('should return 400 if no refresh token provided', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_REFRESH_TOKEN');
    });

    it('should return 401 for invalid refresh token', async () => {
      // Arrange
      vi.mocked(authService.refreshAccessToken).mockRejectedValueOnce(
        new Error('Invalid or expired refresh token')
      );

      // Act
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid_refresh_token',
        });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('should return 401 for expired refresh token', async () => {
      // Arrange
      vi.mocked(authService.refreshAccessToken).mockRejectedValueOnce(
        new Error('Invalid or expired refresh token')
      );

      // Act
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'expired_refresh_token',
        });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('should return 401 for session not found', async () => {
      // Arrange
      vi.mocked(authService.refreshAccessToken).mockRejectedValueOnce(
        new Error('Session not found')
      );

      // Act
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'unknown_refresh_token',
        });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });
});
