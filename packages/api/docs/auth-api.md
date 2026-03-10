# Authentication API Documentation

## User Registration

### POST /api/auth/register

Register a new user with email and password validation.

#### Request Body

```json
{
  "email": "user@example.com",
  "password": "Password123",
  "role": "USER"  // Optional: USER, BUILDER, or ADMIN (defaults to USER)
}
```

#### Validation Rules

**Email:**
- Must be a valid email format

**Password:**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 number

**Role:**
- Optional field
- Valid values: `USER`, `BUILDER`, `ADMIN`
- Defaults to `USER` if not provided

#### Success Response (201 Created)

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "role": "USER",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  },
  "message": "User registered successfully"
}
```

#### Error Responses

**400 Bad Request - Validation Error**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      },
      {
        "field": "password",
        "message": "Password must contain at least 1 uppercase letter"
      }
    ]
  }
}
```

**409 Conflict - User Already Exists**

```json
{
  "success": false,
  "error": {
    "code": "USER_EXISTS",
    "message": "User with this email already exists"
  }
}
```

#### Implementation Details

- Password hashing: bcrypt with 12 salt rounds
- User records stored in `users` table with role assignment
- MFA disabled by default for new users
- Timestamps automatically set on creation

#### Example Usage

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123",
    "role": "USER"
  }'
```

## User Login

### POST /api/auth/login

Authenticate user and create session.

#### Request Body

```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2024-01-16T10:30:00.000Z"
  },
  "message": "Login successful"
}
```

#### Error Response (401 Unauthorized)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

## User Logout

### POST /api/auth/logout

Logout user and invalidate session.

#### Headers

```
Authorization: Bearer <token>
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Logout successful"
}
```

## Get Current User

### GET /api/auth/me

Get current authenticated user information.

#### Headers

```
Authorization: Bearer <token>
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "role": "USER",
      "mfaEnabled": false,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

#### Error Response (401 Unauthorized)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid token"
  }
}
```
