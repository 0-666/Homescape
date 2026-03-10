# JWT Session Management

## Overview

The PropTech Ecosystem Platform implements JWT-based session management with refresh token rotation for secure authentication. This implementation follows industry best practices and meets the requirements specified in the design document.

## Features

### 1. Access Tokens
- **Algorithm**: HS256 (HMAC with SHA-256)
- **Expiration**: 24 hours
- **Payload**: Contains userId, email, and role
- **Storage**: Stored in database sessions table

### 2. Refresh Tokens
- **Algorithm**: HS256 (HMAC with SHA-256)
- **Expiration**: 30 days
- **Payload**: Contains userId and type='refresh'
- **Rotation**: New refresh token issued on each refresh
- **Storage**: Stored in database sessions table

### 3. Token Rotation
When a refresh token is used to obtain a new access token:
1. The old refresh token is validated
2. A new access token is generated (24-hour expiration)
3. A new refresh token is generated (30-day expiration)
4. Both tokens are updated in the database
5. The old refresh token is invalidated

This rotation mechanism prevents refresh token reuse and enhances security.

## API Endpoints

### POST /api/auth/login
Login and receive access and refresh tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2024-01-02T12:00:00.000Z"
  },
  "message": "Login successful"
}
```

### POST /api/auth/refresh
Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2024-01-02T12:00:00.000Z"
  },
  "message": "Token refreshed successfully"
}
```

### POST /api/auth/logout
Logout and invalidate session.

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

## Client Implementation Guide

### 1. Store Tokens Securely
```typescript
// Store tokens after login
const { token, refreshToken, expiresAt } = response.data;
localStorage.setItem('accessToken', token);
localStorage.setItem('refreshToken', refreshToken);
localStorage.setItem('tokenExpiry', expiresAt);
```

### 2. Include Access Token in Requests
```typescript
const accessToken = localStorage.getItem('accessToken');
const response = await fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### 3. Handle Token Expiration
```typescript
// Check if token is expired or about to expire
function isTokenExpired() {
  const expiry = localStorage.getItem('tokenExpiry');
  if (!expiry) return true;
  
  const expiryTime = new Date(expiry).getTime();
  const currentTime = Date.now();
  const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
  
  return currentTime >= (expiryTime - bufferTime);
}

// Refresh token if needed
async function ensureValidToken() {
  if (isTokenExpired()) {
    const refreshToken = localStorage.getItem('refreshToken');
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    
    if (response.ok) {
      const { token, refreshToken: newRefreshToken, expiresAt } = await response.json();
      localStorage.setItem('accessToken', token);
      localStorage.setItem('refreshToken', newRefreshToken);
      localStorage.setItem('tokenExpiry', expiresAt);
    } else {
      // Refresh failed, redirect to login
      window.location.href = '/login';
    }
  }
}
```

### 4. Automatic Token Refresh with Axios Interceptor
```typescript
import axios from 'axios';

// Request interceptor to ensure valid token
axios.interceptors.request.use(async (config) => {
  await ensureValidToken();
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle 401 errors
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post('/api/auth/refresh', { refreshToken });
        const { token, refreshToken: newRefreshToken, expiresAt } = response.data.data;
        
        localStorage.setItem('accessToken', token);
        localStorage.setItem('refreshToken', newRefreshToken);
        localStorage.setItem('tokenExpiry', expiresAt);
        
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return axios(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);
```

## Security Considerations

### 1. Token Storage
- **Access Token**: Can be stored in memory or localStorage
- **Refresh Token**: Should be stored in httpOnly cookies (preferred) or localStorage
- Never store tokens in sessionStorage for long-lived sessions

### 2. Token Rotation
- Refresh tokens are rotated on each use
- Old refresh tokens are invalidated immediately
- Prevents token reuse attacks

### 3. Token Expiration
- Access tokens expire after 24 hours
- Refresh tokens expire after 30 days
- Expired sessions are cleaned up automatically

### 4. HTTPS Only
- All authentication endpoints must use HTTPS in production
- Tokens should never be transmitted over unencrypted connections

### 5. CSRF Protection
- If using cookies for token storage, implement CSRF protection
- Use SameSite cookie attribute

## Database Schema

The sessions table stores both access and refresh tokens:

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  refresh_token VARCHAR(500) UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

## Maintenance

### Cleanup Expired Sessions
A cleanup function is provided to remove expired sessions:

```typescript
import { cleanupExpiredSessions } from './services/auth.service';

// Run cleanup (e.g., via cron job)
const deletedCount = await cleanupExpiredSessions();
console.log(`Cleaned up ${deletedCount} expired sessions`);
```

Recommended to run this cleanup job daily via a cron job or scheduled task.

## Testing

Comprehensive tests are provided for:
- Token generation and validation
- Refresh token rotation
- Token expiration handling
- Error cases (invalid tokens, expired tokens, missing tokens)

Run tests with:
```bash
npm test -- auth.service.test.ts
npm test -- auth.routes.test.ts
```

## Configuration

JWT settings are configured in `config/index.ts`:

```typescript
jwt: {
  secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
}
```

**Important**: Always use a strong, randomly generated secret in production and store it securely in environment variables.

## Requirements Validation

This implementation satisfies the following requirements:

- **Requirement 13.2**: JWT tokens with HS256 signing, 24-hour expiration for access tokens
- **Design Document**: Refresh token mechanism with 30-day expiration
- **Design Document**: Token rotation for enhanced security
- **Design Document**: Session storage in database for validation
