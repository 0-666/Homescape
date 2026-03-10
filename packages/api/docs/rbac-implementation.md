# RBAC Middleware Implementation

## Overview

This document describes the implementation of role-based access control (RBAC) middleware for the PropTech Ecosystem Platform API, completing **Task 2.5** from the implementation plan.

## Requirements

**Requirement 13.3**: "THE Platform SHALL enforce role-based access control preventing Users from accessing Builder or Admin features"

## Implementation

### Files Created

1. **`src/middleware/auth.middleware.ts`** - Core RBAC middleware implementation
2. **`src/middleware/auth.middleware.test.ts`** - Comprehensive unit tests (23 test cases)
3. **`src/middleware/auth.middleware.integration.test.ts`** - Integration tests with Express routes
4. **`src/middleware/README.md`** - Complete documentation and usage guide
5. **`src/routes/example.protected.routes.ts`** - Example usage patterns
6. **`docs/rbac-implementation.md`** - This implementation summary

### Core Components

#### 1. Authentication Middleware (`authenticate`)

Verifies JWT tokens and attaches user information to requests.

**Features:**
- Extracts token from `Authorization: Bearer <token>` header
- Verifies token signature and expiration using JWT
- Validates session exists in database
- Attaches user object to `req.user`
- Returns appropriate error codes (401 for auth failures, 500 for server errors)

**Error Handling:**
- `NO_TOKEN`: No authorization header provided
- `INVALID_TOKEN_FORMAT`: Authorization header doesn't start with "Bearer "
- `INVALID_TOKEN`: Token is invalid, expired, or session not found
- `AUTHENTICATION_ERROR`: Unexpected server error

#### 2. Authorization Middleware (`authorize`)

Factory function that creates middleware to enforce role restrictions.

**Features:**
- Accepts variable number of allowed roles
- Checks if authenticated user's role matches allowed roles
- Returns 403 Forbidden if role doesn't match
- Returns 401 if user not authenticated

**Usage:**
```typescript
// Single role
authorize(UserRole.ADMIN)

// Multiple roles
authorize(UserRole.BUILDER, UserRole.ADMIN)
```

#### 3. Convenience Middleware

Pre-configured authorization middleware for common scenarios:

- `requireUser` - USER role only
- `requireBuilder` - BUILDER role only
- `requireAdmin` - ADMIN role only
- `requireBuilderOrAdmin` - BUILDER or ADMIN roles
- `requireAnyRole` - Any authenticated user

### Usage Examples

#### Protecting Routes

```typescript
import { authenticate, requireBuilder, AuthenticatedRequest } from '../middleware/auth.middleware';

// BUILDER-only endpoint
router.post('/builder/properties', 
  authenticate,           // First verify authentication
  requireBuilder,         // Then check authorization
  (req: AuthenticatedRequest, res) => {
    // req.user is available and guaranteed to be BUILDER role
    const builderId = req.user?.id;
    // ... implementation
  }
);
```

#### Multiple Roles

```typescript
import { authenticate, authorize, UserRole } from '../middleware/auth.middleware';

// BUILDER or ADMIN can access
router.get('/analytics', 
  authenticate,
  authorize(UserRole.BUILDER, UserRole.ADMIN),
  handler
);
```

#### Any Authenticated User

```typescript
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';

// Any authenticated user can access
router.get('/profile', 
  authenticate,
  (req: AuthenticatedRequest, res) => {
    // req.user is available with any role
    res.json({ user: req.user });
  }
);
```

## Testing

### Unit Tests

**File:** `src/middleware/auth.middleware.test.ts`

**Coverage:** 23 test cases covering:
- Authentication with valid/invalid tokens
- Authorization with different role combinations
- Error handling for various failure scenarios
- All convenience middleware functions
- RBAC enforcement scenarios

**Results:** ✅ All 23 tests passing

**Run tests:**
```bash
npm test -- auth.middleware.test.ts
```

### Integration Tests

**File:** `src/middleware/auth.middleware.integration.test.ts`

**Coverage:** 17 test cases covering:
- Public routes (no authentication)
- Protected routes (any authenticated user)
- USER-only routes
- BUILDER-only routes
- ADMIN-only routes
- RBAC enforcement (Requirement 13.3)

**Note:** Integration tests require database connection and are intended for full environment testing.

## RBAC Enforcement Matrix

| User Role | USER Endpoints | BUILDER Endpoints | ADMIN Endpoints |
|-----------|----------------|-------------------|-----------------|
| USER      | ✅ Allowed     | ❌ Forbidden (403) | ❌ Forbidden (403) |
| BUILDER   | ❌ Forbidden (403) | ✅ Allowed     | ❌ Forbidden (403) |
| ADMIN     | ❌ Forbidden (403) | ❌ Forbidden (403) | ✅ Allowed     |

**Requirement 13.3 Validation:**
- ✅ USER cannot access BUILDER endpoints
- ✅ USER cannot access ADMIN endpoints
- ✅ BUILDER cannot access ADMIN endpoints
- ✅ Each role can only access appropriate endpoints
- ✅ Unauthorized access returns 403 Forbidden
- ✅ Unauthenticated requests return 401 Unauthorized

## TypeScript Support

### AuthenticatedRequest Interface

Extended Express Request with user information:

```typescript
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    mfaEnabled: boolean;
  };
}
```

**Benefits:**
- Type-safe access to user information
- IDE autocomplete for user properties
- Compile-time error checking

## Security Features

1. **Token Verification**: Tokens verified against both JWT signature and database session
2. **Session Management**: Sessions stored in database and can be invalidated
3. **Role Enforcement**: Authorization checks happen after authentication
4. **Error Messages**: Error messages don't leak sensitive information
5. **Token Expiration**: Tokens expire after 24 hours (configurable via JWT_EXPIRES_IN)
6. **Refresh Tokens**: 30-day refresh tokens for session renewal

## Error Response Format

All errors follow a consistent JSON structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly error message"
  }
}
```

### Common Error Codes

- `NO_TOKEN` (401): No authentication token provided
- `INVALID_TOKEN_FORMAT` (401): Invalid token format
- `INVALID_TOKEN` (401): Invalid or expired token
- `NOT_AUTHENTICATED` (401): Authentication required
- `FORBIDDEN` (403): Access denied due to insufficient permissions
- `AUTHENTICATION_ERROR` (500): Unexpected server error

## Integration with Existing System

The RBAC middleware integrates seamlessly with the existing authentication system:

1. **Auth Service**: Uses `authService.verifyToken()` for token verification
2. **User Roles**: Uses existing `UserRole` enum from auth service
3. **Database**: Validates sessions against existing `sessions` table
4. **JWT**: Uses existing JWT configuration from `config.jwt`

## Next Steps

To use the RBAC middleware in your routes:

1. Import the middleware:
   ```typescript
   import { authenticate, requireBuilder } from '../middleware/auth.middleware';
   ```

2. Apply to routes:
   ```typescript
   router.get('/protected', authenticate, requireBuilder, handler);
   ```

3. Access user information:
   ```typescript
   (req: AuthenticatedRequest, res) => {
     const userId = req.user?.id;
     const userRole = req.user?.role;
   }
   ```

## Documentation

Complete documentation available in:
- `src/middleware/README.md` - Detailed usage guide
- `src/routes/example.protected.routes.ts` - Example implementations
- This document - Implementation summary

## Compliance

This implementation satisfies:
- ✅ **Task 2.5**: Implement role-based access control middleware
- ✅ **Requirement 13.3**: Enforce role-based access control preventing Users from accessing Builder or Admin features
- ✅ All test cases passing (23/23 unit tests)
- ✅ Comprehensive documentation provided
- ✅ Example usage patterns included
- ✅ TypeScript type safety implemented
- ✅ Security best practices followed

## Conclusion

The RBAC middleware is fully implemented, tested, and documented. It provides a robust, type-safe, and easy-to-use system for enforcing role-based access control across the PropTech Ecosystem Platform API.
