# Authentication and Authorization Middleware

This directory contains the role-based access control (RBAC) middleware for the PropTech Ecosystem Platform API.

## Overview

The RBAC middleware provides two main functions:
1. **Authentication**: Verifies JWT tokens and attaches user information to requests
2. **Authorization**: Enforces role-based access control on protected routes

## User Roles

The platform supports three user roles:
- `USER`: Property buyers/renters using the platform for discovery and customization
- `BUILDER`: Property developers/contractors managing inventory and leads
- `ADMIN`: Platform administrators managing governance, partners, and system operations

## Middleware Functions

### `authenticate`

Verifies the JWT token from the Authorization header and attaches the user to the request.

**Usage:**
```typescript
import { authenticate } from '../middleware/auth.middleware';

router.get('/protected', authenticate, (req: AuthenticatedRequest, res) => {
  // req.user is now available
  console.log(req.user.id, req.user.email, req.user.role);
});
```

**Behavior:**
- Extracts token from `Authorization: Bearer <token>` header
- Verifies token signature and expiration
- Checks if session exists in database
- Attaches user object to `req.user`
- Returns 401 if authentication fails

### `authorize(...allowedRoles)`

Factory function that creates middleware to enforce role restrictions.

**Usage:**
```typescript
import { authenticate, authorize, UserRole } from '../middleware/auth.middleware';

// Single role
router.get('/admin-only', authenticate, authorize(UserRole.ADMIN), handler);

// Multiple roles
router.get('/builder-or-admin', 
  authenticate, 
  authorize(UserRole.BUILDER, UserRole.ADMIN), 
  handler
);
```

**Behavior:**
- Checks if user is authenticated (req.user exists)
- Verifies user's role is in the allowed roles list
- Returns 403 if authorization fails

## Convenience Middleware

Pre-configured authorization middleware for common scenarios:

### `requireUser`
Allows only USER role.

```typescript
router.get('/user/dashboard', authenticate, requireUser, handler);
```

### `requireBuilder`
Allows only BUILDER role.

```typescript
router.get('/builder/inventory', authenticate, requireBuilder, handler);
```

### `requireAdmin`
Allows only ADMIN role.

```typescript
router.get('/admin/partners', authenticate, requireAdmin, handler);
```

### `requireBuilderOrAdmin`
Allows BUILDER or ADMIN roles.

```typescript
router.get('/analytics', authenticate, requireBuilderOrAdmin, handler);
```

### `requireAnyRole`
Allows any authenticated user (all roles).

```typescript
router.get('/profile', authenticate, requireAnyRole, handler);
```

## Complete Example

```typescript
import { Router } from 'express';
import { 
  authenticate, 
  requireUser, 
  requireBuilder, 
  requireAdmin,
  AuthenticatedRequest 
} from '../middleware/auth.middleware';

const router = Router();

// Public route - no authentication
router.get('/public', (req, res) => {
  res.json({ message: 'Public endpoint' });
});

// Protected route - any authenticated user
router.get('/profile', authenticate, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

// USER-only route
router.get('/user/saved-properties', authenticate, requireUser, (req: AuthenticatedRequest, res) => {
  // Only users with USER role can access this
  res.json({ savedProperties: [] });
});

// BUILDER-only route
router.post('/builder/properties', authenticate, requireBuilder, (req: AuthenticatedRequest, res) => {
  // Only users with BUILDER role can access this
  res.json({ message: 'Property created' });
});

// ADMIN-only route
router.get('/admin/users', authenticate, requireAdmin, (req: AuthenticatedRequest, res) => {
  // Only users with ADMIN role can access this
  res.json({ users: [] });
});

export default router;
```

## Error Responses

### 401 Unauthorized

**No Token:**
```json
{
  "success": false,
  "error": {
    "code": "NO_TOKEN",
    "message": "No authentication token provided"
  }
}
```

**Invalid Token Format:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN_FORMAT",
    "message": "Invalid token format. Expected: Bearer <token>"
  }
}
```

**Invalid/Expired Token:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid or expired authentication token"
  }
}
```

**Not Authenticated (for authorize middleware):**
```json
{
  "success": false,
  "error": {
    "code": "NOT_AUTHENTICATED",
    "message": "Authentication required"
  }
}
```

### 403 Forbidden

**Insufficient Permissions:**
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied. Required role: BUILDER"
  }
}
```

### 500 Internal Server Error

**Unexpected Error:**
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "An error occurred during authentication"
  }
}
```

## TypeScript Types

### AuthenticatedRequest

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

**Usage in route handlers:**
```typescript
import { AuthenticatedRequest } from '../middleware/auth.middleware';

router.get('/example', authenticate, (req: AuthenticatedRequest, res) => {
  // TypeScript knows req.user exists and has the correct type
  const userId = req.user?.id;
  const userRole = req.user?.role;
});
```

## Testing

The middleware includes comprehensive unit tests covering:
- Authentication with valid/invalid tokens
- Authorization with different role combinations
- Error handling for various failure scenarios
- All convenience middleware functions

Run tests:
```bash
npm test -- auth.middleware.test.ts
```

## Security Considerations

1. **Token Verification**: Tokens are verified against both JWT signature and database session
2. **Session Management**: Sessions are stored in database and can be invalidated
3. **Role Enforcement**: Authorization checks happen after authentication
4. **Error Messages**: Error messages don't leak sensitive information
5. **Token Expiration**: Tokens expire after 24 hours (configurable)

## Requirements Validation

This middleware implements **Requirement 13.3**:
> "THE Platform SHALL enforce role-based access control preventing Users from accessing Builder or Admin features"

The middleware ensures:
- ✅ USER role cannot access BUILDER endpoints
- ✅ USER role cannot access ADMIN endpoints
- ✅ BUILDER role cannot access ADMIN endpoints
- ✅ Each role can only access endpoints appropriate to their permissions
- ✅ Unauthorized access attempts return 403 Forbidden
- ✅ Unauthenticated requests return 401 Unauthorized

## Related Files

- `auth.service.ts`: Authentication service with token verification
- `auth.routes.ts`: Authentication endpoints (login, register, logout)
- `example.protected.routes.ts`: Example usage of RBAC middleware
