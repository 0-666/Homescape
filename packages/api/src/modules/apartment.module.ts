/**
 * Apartment Module Configuration
 * Reference implementation for the modular property type system
 * 
 * This module defines the schema and validation logic for apartment properties
 * as specified in the PropTech Ecosystem Platform design document.
 */

import { ModuleSchema, createPropertyValidator, PropertyValidator } from '../services/module-registry.service';

/**
 * Apartment module type constant
 */
export const APARTMENT_MODULE_TYPE = 'APARTMENT';

/**
 * Apartment module version
 */
export const APARTMENT_MODULE_VERSION = '1.0.0';

/**
 * Apartment module schema definition
 * 
 * Required fields:
 * - bedrooms: Number of bedrooms in the apartment
 * - bathrooms: Number of bathrooms in the apartment
 * - sqft: Square footage of the apartment
 * 
 * Optional fields:
 * - floor: Floor number (can be negative for basement)
 * - building_name: Name of the building
 * - amenities: JSON object or array of amenities
 * - parking_spaces: Number of parking spaces included
 */
export const apartmentModuleSchema: ModuleSchema = {
  fields: [
    { 
      name: 'bedrooms', 
      type: 'number', 
      required: true,
    },
    { 
      name: 'bathrooms', 
      type: 'number', 
      required: true,
    },
    { 
      name: 'sqft', 
      type: 'number', 
      required: true,
    },
    { 
      name: 'floor', 
      type: 'number', 
      required: false,
    },
    { 
      name: 'building_name', 
      type: 'string', 
      required: false,
    },
    { 
      name: 'amenities', 
      type: 'json', 
      required: false,
    },
    { 
      name: 'parking_spaces', 
      type: 'number', 
      required: false,
    },
  ],
  indexes: ['bedrooms', 'bathrooms', 'sqft'],
};

/**
 * Create a property validator for apartment data
 */
export function createApartmentValidator(): PropertyValidator {
  return createPropertyValidator(apartmentModuleSchema);
}

/**
 * Apartment module registration input
 */
export const apartmentModuleRegistration = {
  type: APARTMENT_MODULE_TYPE,
  version: APARTMENT_MODULE_VERSION,
  schema: apartmentModuleSchema,
  active: true,
};

/**
 * TypeScript interface for apartment module data
 * This provides type safety when working with apartment properties
 */
export interface ApartmentModuleData {
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  floor?: number;
  building_name?: string;
  amenities?: Record<string, any> | any[];
  parking_spaces?: number;
}
