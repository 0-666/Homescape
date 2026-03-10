# Property Service - Module-Based Operation Routing

## Overview

The Property Service implements module-based property operation routing as specified in Task 3.4 of the PropTech Ecosystem Platform spec. It provides a complete CRUD (Create, Read, Update, Delete) interface for properties while ensuring all property data is validated against the appropriate module schema.

## Key Features

### 1. Module-Based Validation

Every property operation is routed through the module registry to ensure:
- The module type exists and is active
- Property data conforms to the module's schema
- Required fields are present and correctly typed
- Module-specific business logic is enforced

### 2. CRUD Operations

#### Create Property
```typescript
createProperty(input: CreatePropertyInput): Promise<Property>
```
- Validates module type exists and is active
- Validates module-specific data against schema
- Stores property with module_data in JSONB field
- Returns created property with all metadata

#### Read Property
```typescript
getProperty(propertyId: string): Promise<Property | null>
```
- Retrieves property by ID
- Returns null if not found
- Includes all module-specific data

#### Update Property
```typescript
updateProperty(propertyId: string, input: UpdatePropertyInput): Promise<Property>
```
- Validates updated module data if provided
- Supports partial updates
- Maintains module type integrity
- Updates timestamp automatically

#### Delete Property
```typescript
deleteProperty(propertyId: string): Promise<void>
```
- Removes property and cascades to related records
- Validates property exists before deletion

### 3. Query Operations

#### List Properties
```typescript
listProperties(filters?: {
  builderId?: string;
  moduleType?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ properties: Property[]; total: number }>
```
- Supports filtering by builder, module type, and status
- Implements pagination with limit/offset
- Returns total count for pagination UI

#### Get Properties by Builder
```typescript
getPropertiesByBuilder(builderId: string, options?: { limit?: number; offset?: number })
```
- Convenience method for builder inventory views
- Supports pagination

#### Get Properties by Module
```typescript
getPropertiesByModule(moduleType: string, options?: { limit?: number; offset?: number })
```
- Convenience method for module-specific queries
- Supports pagination

## Module-Based Routing Architecture

### How It Works

1. **Property Creation Flow**:
   ```
   Client Request
        ↓
   Validate Input Schema (Zod)
        ↓
   Get Module from Registry
        ↓
   Validate Module is Active
        ↓
   Validate Module Data against Schema
        ↓
   Store in Database (module_data JSONB)
        ↓
   Return Property
   ```

2. **Property Update Flow**:
   ```
   Client Request
        ↓
   Validate Input Schema (Zod)
        ↓
   Get Existing Property
        ↓
   If module_data updated:
     - Get Module from Registry
     - Validate against Schema
        ↓
   Update Database
        ↓
   Return Updated Property
   ```

### Data Storage

Properties are stored in a single `properties` table with:
- **Core fields**: id, builder_id, module_type, title, description, price, location, etc.
- **Module-specific data**: Stored in `module_data` JSONB column
- **Vector embeddings**: Stored in `embedding` vector(1536) column for search

This design allows:
- Single table for all property types (no schema migrations for new modules)
- Flexible module-specific fields via JSONB
- Efficient querying with PostgreSQL JSONB operators
- Type safety through module schema validation

## API Routes

The property routes (`/api/properties`) provide RESTful endpoints:

- `POST /api/properties` - Create property (Builder only)
- `GET /api/properties` - List properties with filters (Authenticated)
- `GET /api/properties/:id` - Get property by ID (Authenticated)
- `PATCH /api/properties/:id` - Update property (Builder/Admin)
- `DELETE /api/properties/:id` - Delete property (Builder/Admin)
- `GET /api/properties/builder/:builderId` - Get builder's properties (Authenticated)
- `GET /api/properties/module/:moduleType` - Get properties by module (Authenticated)

## Example Usage

### Creating an Apartment Property

```typescript
const property = await createProperty({
  builderId: 'uuid-of-builder',
  moduleType: 'APARTMENT',
  title: 'Luxury Downtown Apartment',
  description: 'Beautiful 2BR apartment in the heart of downtown',
  price: 450000,
  currency: 'USD',
  location: 'Downtown, City Center',
  images: [
    'https://cdn.example.com/apt1.jpg',
    'https://cdn.example.com/apt2.jpg'
  ],
  moduleData: {
    bedrooms: 2,
    bathrooms: 2,
    sqft: 1200,
    floor: 15,
    building_name: 'Skyline Tower',
    amenities: ['pool', 'gym', 'parking', 'concierge'],
    parking_spaces: 1
  }
});
```

### Querying Properties by Module

```typescript
// Get all apartment properties
const { properties, total } = await getPropertiesByModule('APARTMENT', {
  limit: 20,
  offset: 0
});

// Get builder's properties
const builderProperties = await getPropertiesByBuilder(builderId, {
  limit: 50,
  offset: 0
});
```

### Updating Property Status

```typescript
const updated = await updateProperty(propertyId, {
  status: 'SOLD'
});
```

## Validation

### Input Validation (Zod)

All inputs are validated using Zod schemas:
- Email format, UUID format
- Required fields presence
- Type correctness (string, number, etc.)
- Value constraints (positive numbers, max lengths)

### Module Data Validation

Module-specific data is validated against the module's schema:
- Required fields must be present
- Field types must match schema
- Custom validation rules are applied

Example validation error:
```json
{
  "success": false,
  "error": "Module data validation failed: Field 'bedrooms' is required, Field 'sqft' must be a number"
}
```

## Integration with Module Registry

The property service tightly integrates with the module registry:

1. **Module Lookup**: Every property operation checks the module registry
2. **Schema Validation**: Uses `validatePropertyData()` from module registry
3. **Active Check**: Only allows operations on active modules
4. **Type Safety**: Ensures module type consistency

## Testing

Comprehensive test coverage includes:

### Unit Tests (`property.service.test.ts`)
- Property creation with valid/invalid data
- Module validation enforcement
- CRUD operations
- Filtering and pagination
- Error handling

### Integration Tests (`property.routes.test.ts`)
- API endpoint testing
- Authentication/authorization
- Request/response validation
- Error responses

## Requirements Satisfied

This implementation satisfies **Requirement 12.3**:
> "THE Platform SHALL route property operations to the appropriate Property_Module based on property type"

The routing is achieved through:
1. Module type validation on every operation
2. Schema-based validation of module-specific data
3. Centralized module registry lookup
4. Type-safe property operations

## Future Enhancements

Potential improvements:
1. **Builder ownership validation**: Ensure builders can only modify their own properties
2. **Audit logging**: Track all property changes
3. **Soft deletes**: Mark properties as deleted instead of removing
4. **Version history**: Track property changes over time
5. **Bulk operations**: Support bulk create/update/delete
6. **Advanced search**: Integration with vector search for semantic queries
