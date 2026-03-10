# Property Modules

This directory contains the modular property type implementations for the PropTech Ecosystem Platform.

## Overview

The platform uses a modular architecture to support different property types (Apartment, Rental, Land). Each module defines:

- **Schema**: Field definitions with types and validation rules
- **Validator**: Logic to validate property data against the schema
- **Registration**: Configuration for registering the module in the system

## Apartment Module

The Apartment module is the reference implementation for the modular property system.

### Schema

**Required Fields:**
- `bedrooms` (number): Number of bedrooms
- `bathrooms` (number): Number of bathrooms (can be decimal, e.g., 2.5)
- `sqft` (number): Square footage

**Optional Fields:**
- `floor` (number): Floor number (can be negative for basement)
- `building_name` (string): Name of the building
- `amenities` (json): Amenities as object or array
- `parking_spaces` (number): Number of parking spaces

### Usage

#### Import the Module

```typescript
import {
  apartmentModuleSchema,
  createApartmentValidator,
  ApartmentModuleData,
  APARTMENT_MODULE_TYPE,
  apartmentModuleRegistration,
} from './modules/apartment.module';
```

#### Register the Module

```typescript
import { registerModule } from './services/module-registry.service';
import { apartmentModuleRegistration } from './modules/apartment.module';

// Register the apartment module
const module = await registerModule(apartmentModuleRegistration);
```

Or use the registration script:

```bash
npm run register-apartment-module
```

#### Validate Apartment Data

```typescript
import { createApartmentValidator } from './modules/apartment.module';

const validator = createApartmentValidator();

const apartmentData = {
  bedrooms: 2,
  bathrooms: 2,
  sqft: 1200,
  floor: 5,
  building_name: 'Sunset Towers',
  parking_spaces: 1,
  amenities: {
    pool: true,
    gym: true,
  },
};

const result = validator.validate(apartmentData);

if (result.valid) {
  console.log('Valid apartment data');
} else {
  console.error('Validation errors:', result.errors);
}
```

#### TypeScript Type Safety

```typescript
import { ApartmentModuleData } from './modules/apartment.module';

// TypeScript will enforce required fields
const apartment: ApartmentModuleData = {
  bedrooms: 2,
  bathrooms: 2,
  sqft: 1200,
  // Optional fields can be omitted
};
```

### Examples

#### Studio Apartment

```typescript
const studio: ApartmentModuleData = {
  bedrooms: 0,
  bathrooms: 1,
  sqft: 500,
  building_name: 'Downtown Studios',
};
```

#### Luxury Penthouse

```typescript
const penthouse: ApartmentModuleData = {
  bedrooms: 4,
  bathrooms: 3.5,
  sqft: 3500,
  floor: 25,
  building_name: 'Sky Tower',
  parking_spaces: 3,
  amenities: {
    pool: true,
    gym: true,
    concierge: true,
    rooftop: true,
    spa: true,
    privateElevator: true,
  },
};
```

#### Basement Apartment

```typescript
const basement: ApartmentModuleData = {
  bedrooms: 1,
  bathrooms: 1,
  sqft: 700,
  floor: -1,
  building_name: 'Garden Apartments',
};
```

## Adding New Modules

To add a new property module (e.g., Rental, Land):

1. **Create Module File**: `src/modules/{module-name}.module.ts`
2. **Define Schema**: Specify required and optional fields
3. **Export Configuration**: Module type, version, schema, and registration object
4. **Create Validator**: Use `createPropertyValidator(schema)`
5. **Create Tests**: Validation tests and integration tests
6. **Create Registration Script**: `src/scripts/register-{module-name}-module.ts`
7. **Update Documentation**: Add module documentation to this README

### Module Template

```typescript
import { ModuleSchema, createPropertyValidator, PropertyValidator } from '../services/module-registry.service';

export const MODULE_TYPE = 'YOUR_MODULE';
export const MODULE_VERSION = '1.0.0';

export const moduleSchema: ModuleSchema = {
  fields: [
    { name: 'field1', type: 'string', required: true },
    { name: 'field2', type: 'number', required: false },
  ],
  indexes: ['field1'],
};

export function createModuleValidator(): PropertyValidator {
  return createPropertyValidator(moduleSchema);
}

export const moduleRegistration = {
  type: MODULE_TYPE,
  version: MODULE_VERSION,
  schema: moduleSchema,
  active: true,
};

export interface ModuleData {
  field1: string;
  field2?: number;
}
```

## Testing

Run all module tests:

```bash
npm test modules/
```

Run specific module tests:

```bash
npm test apartment
```

## Architecture

The modular property system follows these design principles:

1. **Modularity**: Each property type is a self-contained module
2. **Extensibility**: New modules can be added without modifying core code
3. **Type Safety**: TypeScript interfaces provide compile-time validation
4. **Runtime Validation**: Schema-based validation ensures data integrity
5. **Consistency**: All modules follow the same structure and patterns

## Related Files

- `src/services/module-registry.service.ts`: Core module registry service
- `src/routes/module-registry.routes.ts`: API endpoints for module management
- `src/db/schema.sql`: Database schema for property_modules table
- `.kiro/specs/proptech-ecosystem/design.md`: Design document with module specifications
