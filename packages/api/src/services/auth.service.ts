import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { config } from '../config';
import { query, transaction } from '../db';
import { z } from 'zod';

// Validation schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least 1 number'),
  role: z.enum(['USER', 'BUILDER', 'ADMIN']).default('USER'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// Types
export enum UserRole {
  USER = 'USER',
  BUILDER = 'BUILDER',
  ADMIN = 'ADMIN',
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  mfaEnabled: boolean;
}

export interface SessionToken {
  token: string;
  refreshToken: string;
  expiresAt: Date;
  userId: string;
  mfaRequired?: boolean;
}

export interface MFASetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface RegisterInput {
  email: string;
  password: string;
  role?: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

// Constants
const BCRYPT_SALT_ROUNDS = 12;

/**
 * Register a new user with email and password
 */
export async function register(input: RegisterInput): Promise<User> {
  // Validate input
  const validated = registerSchema.parse(input);

  // Check if user already exists
  const existingUser = await query(
    'SELECT id FROM users WHERE email = $1',
    [validated.email]
  );

  if (existingUser.rows.length > 0) {
    throw new Error('User with this email already exists');
  }

  // Hash password with bcrypt (12 salt rounds)
  const passwordHash = await bcrypt.hash(validated.password, BCRYPT_SALT_ROUNDS);

  // Insert user into database
  const result = await query<User>(
    `INSERT INTO users (email, password_hash, role, mfa_enabled, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     RETURNING id, email, role, created_at as "createdAt", mfa_enabled as "mfaEnabled"`,
    [validated.email, passwordHash, validated.role, false]
  );

  return result.rows[0];
}

/**
 * Login user and create session
 */
export async function login(input: LoginInput): Promise<SessionToken> {
  // Validate input
  const validated = loginSchema.parse(input);

  // Find user by email
  const userResult = await query(
    'SELECT id, email, password_hash, role, mfa_enabled FROM users WHERE email = $1',
    [validated.email]
  );

  if (userResult.rows.length === 0) {
    throw new Error('Invalid email or password');
  }

  const user = userResult.rows[0];

  // Verify password
  const isPasswordValid = await bcrypt.compare(validated.password, user.password_hash);

  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  // Check if MFA is required for Builder or Admin roles
  const requiresMFA = (user.role === 'BUILDER' || user.role === 'ADMIN') && user.mfa_enabled;

  if (requiresMFA) {
    // Return a temporary token that requires MFA verification
    const tempToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, mfaPending: true },
      config.jwt.secret,
      { expiresIn: '5m' } // Short-lived token for MFA verification
    );

    return {
      token: tempToken,
      refreshToken: '',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      userId: user.id,
      mfaRequired: true,
    };
  }

  // Generate JWT tokens
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshTokenExpiresIn }
  );

  // Calculate expiration date (24 hours from now)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  // Store session in database
  await query(
    `INSERT INTO sessions (user_id, token, refresh_token, expires_at, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [user.id, token, refreshToken, expiresAt]
  );

  return {
    token,
    refreshToken,
    expiresAt,
    userId: user.id,
    mfaRequired: false,
  };
}

/**
 * Logout user and invalidate session
 */
export async function logout(token: string): Promise<void> {
  await query('DELETE FROM sessions WHERE token = $1', [token]);
}

/**
 * Verify JWT token and return user
 */
export async function verifyToken(token: string): Promise<User> {
  try {
    // Verify JWT signature and expiration
    const decoded = jwt.verify(token, config.jwt.secret) as any;

    // Check if session exists in database
    const sessionResult = await query(
      'SELECT user_id FROM sessions WHERE token = $1 AND expires_at > NOW()',
      [token]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found or expired');
    }

    // Get user details
    const userResult = await query<User>(
      `SELECT id, email, role, created_at as "createdAt", mfa_enabled as "mfaEnabled"
       FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    return userResult.rows[0];
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Generate MFA secret and setup information for a user
 */
export async function generateMFASecret(userId: string): Promise<MFASetup> {
  // Get user details
  const userResult = await query(
    'SELECT email FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }

  const user = userResult.rows[0];

  // Generate a new secret
  const secret = authenticator.generateSecret();

  // Generate OTP auth URL for QR code
  const otpauthUrl = authenticator.keyuri(
    user.email,
    'PropTech Platform',
    secret
  );

  // Generate QR code as data URL
  const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

  // Generate backup codes (8 codes, 8 characters each)
  const backupCodes = Array.from({ length: 8 }, () => 
    Math.random().toString(36).substring(2, 10).toUpperCase()
  );

  return {
    secret,
    qrCodeUrl,
    backupCodes,
  };
}

/**
 * Enable MFA for a user after verifying the initial TOTP code
 */
export async function enableMFA(userId: string, secret: string, code: string): Promise<void> {
  // Verify the TOTP code before enabling MFA
  const isValid = authenticator.verify({
    token: code,
    secret: secret,
  });

  if (!isValid) {
    throw new Error('Invalid verification code');
  }

  // Enable MFA and store the secret
  await query(
    'UPDATE users SET mfa_enabled = true, mfa_secret = $1, updated_at = NOW() WHERE id = $2',
    [secret, userId]
  );
}

/**
 * Disable MFA for a user
 */
export async function disableMFA(userId: string): Promise<void> {
  await query(
    'UPDATE users SET mfa_enabled = false, mfa_secret = NULL, updated_at = NOW() WHERE id = $1',
    [userId]
  );
}

/**
 * Verify MFA code during login
 */
export async function verifyMFA(userId: string, code: string): Promise<boolean> {
  const userResult = await query(
    'SELECT mfa_secret FROM users WHERE id = $1 AND mfa_enabled = true',
    [userId]
  );

  if (userResult.rows.length === 0) {
    return false;
  }

  const { mfa_secret } = userResult.rows[0];

  if (!mfa_secret) {
    return false;
  }

  // Verify the TOTP code
  const isValid = authenticator.verify({
    token: code,
    secret: mfa_secret,
  });

  return isValid;
}

/**
 * Complete MFA login by verifying the code and issuing full session tokens
 */
export async function completeMFALogin(tempToken: string, code: string): Promise<SessionToken> {
  try {
    // Verify the temporary token
    const decoded = jwt.verify(tempToken, config.jwt.secret) as any;

    if (!decoded.mfaPending) {
      throw new Error('Invalid token for MFA verification');
    }

    // Verify the MFA code
    const isValid = await verifyMFA(decoded.userId, code);

    if (!isValid) {
      throw new Error('Invalid MFA code');
    }

    // Generate full session tokens
    const token = jwt.sign(
      { userId: decoded.userId, email: decoded.email, role: decoded.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    const refreshToken = jwt.sign(
      { userId: decoded.userId, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: config.jwt.refreshTokenExpiresIn }
    );

    // Calculate expiration date (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Store session in database
    await query(
      `INSERT INTO sessions (user_id, token, refresh_token, expires_at, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [decoded.userId, token, refreshToken, expiresAt]
    );

    return {
      token,
      refreshToken,
      expiresAt,
      userId: decoded.userId,
      mfaRequired: false,
    };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid or expired token');
    }
    throw error;
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<SessionToken> {
  try {
    // Verify refresh token signature and expiration
    const decoded = jwt.verify(refreshToken, config.jwt.secret) as any;

    // Verify it's a refresh token
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    // Check if session exists in database with this refresh token
    const sessionResult = await query(
      'SELECT user_id, token FROM sessions WHERE refresh_token = $1',
      [refreshToken]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const session = sessionResult.rows[0];

    // Get user details
    const userResult = await query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [session.user_id]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    // Generate new access token
    const newToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    // Generate new refresh token (refresh token rotation)
    const newRefreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: config.jwt.refreshTokenExpiresIn }
    );

    // Calculate new expiration date (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Update session in database with new tokens
    await query(
      `UPDATE sessions 
       SET token = $1, refresh_token = $2, expires_at = $3
       WHERE refresh_token = $4`,
      [newToken, newRefreshToken, expiresAt, refreshToken]
    );

    return {
      token: newToken,
      refreshToken: newRefreshToken,
      expiresAt,
      userId: user.id,
    };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || (error instanceof Error && error.name === 'TokenExpiredError')) {
      throw new Error('Invalid or expired refresh token');
    }
    throw error;
  }
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await query(
    'DELETE FROM sessions WHERE expires_at < NOW()',
    []
  );
  return result.rowCount || 0;
}
