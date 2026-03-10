# Multi-Factor Authentication (MFA) Implementation

## Overview

This document describes the MFA implementation for the PropTech Ecosystem Platform. MFA is required for Builder and Admin roles to enhance security for privileged accounts.

## Technology Stack

- **TOTP Library**: `otplib` - Industry-standard Time-based One-Time Password implementation
- **QR Code Generation**: `qrcode` - Generates QR codes for easy authenticator app setup
- **Authenticator Apps**: Compatible with Google Authenticator, Microsoft Authenticator, Authy, and other TOTP-compliant apps

## Features

### 1. MFA Setup Flow

1. **Generate Secret**: User requests MFA setup via `/api/auth/mfa/setup`
   - System generates a unique TOTP secret
   - Creates a QR code for easy scanning
   - Provides 8 backup codes for account recovery

2. **Enable MFA**: User verifies setup via `/api/auth/mfa/enable`
   - User scans QR code with authenticator app
   - Enters the 6-digit code from the app
   - System verifies the code before enabling MFA

### 2. MFA Login Flow

1. **Initial Login**: User provides email and password
   - System validates credentials
   - If MFA is enabled for Builder/Admin, returns temporary token (5-minute expiry)
   - Response includes `mfaRequired: true` flag

2. **MFA Verification**: User provides TOTP code via `/api/auth/mfa/verify`
   - System validates the temporary token
   - Verifies the 6-digit TOTP code
   - Issues full session tokens upon successful verification

### 3. MFA Management

- **Disable MFA**: Users can disable MFA via `/api/auth/mfa/disable`
- **Re-enable MFA**: Users can set up MFA again at any time

## API Endpoints

### POST /api/auth/mfa/setup

Generate MFA secret and QR code for enrollment.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCodeUrl": "data:image/png;base64,...",
    "backupCodes": [
      "A1B2C3D4",
      "E5F6G7H8",
      ...
    ]
  },
  "message": "MFA setup initiated. Please scan the QR code with your authenticator app and verify with a code."
}
```

### POST /api/auth/mfa/enable

Enable MFA after verifying the initial TOTP code.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "MFA enabled successfully"
}
```

### POST /api/auth/mfa/disable

Disable MFA for the current user.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "message": "MFA disabled successfully"
}
```

### POST /api/auth/mfa/verify

Complete MFA login by verifying the TOTP code.

**Body:**
```json
{
  "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2024-01-15T12:00:00.000Z"
  },
  "message": "MFA verification successful"
}
```

### POST /api/auth/login (Modified)

Login endpoint now returns different responses based on MFA status.

**Without MFA or for USER role:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2024-01-15T12:00:00.000Z",
    "mfaRequired": false
  },
  "message": "Login successful"
}
```

**With MFA enabled (Builder/Admin):**
```json
{
  "success": true,
  "data": {
    "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "mfaRequired": true
  },
  "message": "MFA verification required. Please provide your authenticator code."
}
```

## Security Features

1. **Role-Based Enforcement**: MFA is only required for Builder and Admin roles
2. **Temporary Tokens**: MFA verification tokens expire after 5 minutes
3. **TOTP Standard**: Uses industry-standard RFC 6238 TOTP algorithm
4. **Backup Codes**: 8 backup codes provided for account recovery
5. **Secret Storage**: MFA secrets are stored encrypted in the database

## Database Schema

The `users` table includes MFA-related fields:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Testing

Comprehensive unit tests cover:
- MFA secret generation
- MFA enablement with code verification
- MFA disablement
- TOTP code verification
- Login flow with MFA
- MFA verification completion
- Error handling for invalid codes and expired tokens

Run tests:
```bash
npm test -- auth.service.test.ts
```

## Client Implementation Guide

### 1. Setup MFA

```typescript
// Step 1: Request MFA setup
const setupResponse = await fetch('/api/auth/mfa/setup', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
});

const { data } = await setupResponse.json();
const { secret, qrCodeUrl, backupCodes } = data;

// Step 2: Display QR code to user
// User scans with authenticator app

// Step 3: User enters code from app
const code = getUserInput(); // e.g., "123456"

// Step 4: Enable MFA
const enableResponse = await fetch('/api/auth/mfa/enable', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ secret, code }),
});
```

### 2. Login with MFA

```typescript
// Step 1: Initial login
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email, password }),
});

const { data } = await loginResponse.json();

if (data.mfaRequired) {
  // Step 2: Prompt user for MFA code
  const code = getUserInput(); // e.g., "123456"
  
  // Step 3: Verify MFA
  const verifyResponse = await fetch('/api/auth/mfa/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tempToken: data.tempToken,
      code,
    }),
  });
  
  const { data: sessionData } = await verifyResponse.json();
  // Use sessionData.token for authenticated requests
} else {
  // No MFA required, use data.token directly
}
```

## Compliance

This implementation satisfies:
- **Requirement 13.5**: "THE Platform SHALL support multi-factor authentication via SMS or authenticator app for Builder and Admin roles"
- Uses authenticator app (TOTP) for MFA
- Enforced for Builder and Admin roles only
- Provides secure enrollment and verification flows

## Future Enhancements

Potential improvements for future iterations:
1. SMS-based MFA as an alternative to TOTP
2. Backup code usage and regeneration
3. MFA recovery flow for lost devices
4. Remember device functionality
5. MFA audit logging
6. Force MFA enrollment for new Builder/Admin accounts
