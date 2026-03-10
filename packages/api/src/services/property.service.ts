import { z } from 'zod';
import { query } from '../db';
import * as moduleRegistry from './module-registry.service';
import { embeddingsService } from './embeddings.service';

// Validation schemas
export const createPropertySchema = z.object({
  builderId: z.string().uuid('Invalid builder ID'),
  moduleType: z.string().min(1, 'Module type is required'),
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive'),
  currency: z.string().length(3, 'Currency must be 3 characters').default('USD'),
  location: z.string().min(1, 'Location is required').max(255, 'Location too long'),
  images: z.array(z.string().url('Invalid image URL')).default([]),
  moduleData: z.record(z.any()),
  status: z.enum(['AVAILABLE', 'SOLD', 'UNAVAILABLE']).default('AVAILABLE'),
});

export const updatePropertySchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long').optional(),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive').optional(),
  currency: z.string().length(3, 'Currency must be 3 characters').optional(),
  location: z.string().min(1, 'Location is required').max(255, 'Location too long').optional(),
  images: z.array(z.string().url('Invalid image URL')).optional(),
  moduleData: z.record(z.any()).optional(),
  status: z.enum(['AVAILABLE', 'SOLD', 'UNAVAILABLE']).optional(),
});

// Types
export interface Property {
  id: string;
  builderId: string;
  moduleType: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  location: string;
  images: string[];
  moduleData: Record<string, any>;
  embedding?: number[];
  status: 'AVAILABLE' | 'SOLD' | 'UNAVAILABLE';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePropertyInput {
  builderId: string;
  moduleType: string;
  title: string;
  description?: string;
  price: number;
  currency?: string;
  location: string;
  images?: string[];
  moduleData: Record<string, any>;
  status?: 'AVAILABLE' | 'SOLD' | 'UNAVAILABLE';
}

export interface UpdatePropertyInput {
  title?: string;
  description?: string;
  price?: number;
  currency?: string;
  location?: string;
  images?: string[];
  moduleData?: Record<string, any>;
  status?: 'AVAILABLE' | 'SOLD' | 'UNAVAILABLE';
}

/**
 * Create a new property with module-based validation
 * Automatically generates and stores embeddings for semantic search
 */
export async function createProperty(input: CreatePropertyInput): Promise<Property> {
  // Validate input
  const validated = createPropertySchema.parse(input);

  // Get the module to validate against
  const module = await moduleRegistry.getModule(validated.moduleType);
  if (!module) {
    throw new Error(`Module type '${validated.moduleType}' not found`);
  }

  if (!module.active) {
    throw new Error(`Module type '${validated.moduleType}' is not active`);
  }

  // Validate module-specific data
  const validationResult = moduleRegistry.validatePropertyData(
    validated.moduleData,
    module.schema
  );

  if (!validationResult.valid) {
    throw new Error(`Module data validation failed: ${validationResult.errors.join(', ')}`);
  }

  // Insert property into database
  const result = await query<Property>(
    `INSERT INTO properties (
      builder_id, module_type, title, description, price, currency,
      location, images, module_data, status, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    RETURNING 
      id, 
      builder_id as "builderId",
      module_type as "moduleType",
      title,
      description,
      price,
      currency,
      location,
      images,
      module_data as "moduleData",
      status,
      created_at as "createdAt",
      updated_at as "updatedAt"`,
    [
      validated.builderId,
      validated.moduleType,
      validated.title,
      validated.description || null,
      validated.price,
      validated.currency,
      validated.location,
      validated.images,
      JSON.stringify(validated.moduleData),
      validated.status,
    ]
  );

  const property = result.rows[0];

  // Generate and store embedding asynchronously (don't block property creation)
  embeddingsService.instance
    .generateAndStorePropertyEmbedding(property.id, {
      title: property.title,
      description: property.description,
      location: property.location,
    })
    .catch((error) => {
      console.error(`Failed to generate embedding for property ${property.id}:`, error);
    });

  return property;
}

/**
 * Get a property by ID
 */
export async function getProperty(propertyId: string): Promise<Property | null> {
  const result = await query<Property>(
    `SELECT 
      id,
      builder_id as "builderId",
      module_type as "moduleType",
      title,
      description,
      price,
      currency,
      location,
      images,
      module_data as "moduleData",
      status,
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM properties
    WHERE id = $1`,
    [propertyId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Update a property with module-based validation
 * Regenerates embeddings if title, description, or location changed
 */
export async function updateProperty(
  propertyId: string,
  input: UpdatePropertyInput
): Promise<Property> {
  // Validate input
  const validated = updatePropertySchema.parse(input);

  // Get existing property
  const existingProperty = await getProperty(propertyId);
  if (!existingProperty) {
    throw new Error(`Property '${propertyId}' not found`);
  }

  // If module data is being updated, validate it
  if (validated.moduleData) {
    const module = await moduleRegistry.getModule(existingProperty.moduleType);
    if (!module) {
      throw new Error(`Module type '${existingProperty.moduleType}' not found`);
    }

    const validationResult = moduleRegistry.validatePropertyData(
      validated.moduleData,
      module.schema
    );

    if (!validationResult.valid) {
      throw new Error(`Module data validation failed: ${validationResult.errors.join(', ')}`);
    }
  }

  // Build update query dynamically
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (validated.title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    values.push(validated.title);
  }

  if (validated.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(validated.description);
  }

  if (validated.price !== undefined) {
    updates.push(`price = $${paramIndex++}`);
    values.push(validated.price);
  }

  if (validated.currency !== undefined) {
    updates.push(`currency = $${paramIndex++}`);
    values.push(validated.currency);
  }

  if (validated.location !== undefined) {
    updates.push(`location = $${paramIndex++}`);
    values.push(validated.location);
  }

  if (validated.images !== undefined) {
    updates.push(`images = $${paramIndex++}`);
    values.push(validated.images);
  }

  if (validated.moduleData !== undefined) {
    updates.push(`module_data = $${paramIndex++}`);
    values.push(JSON.stringify(validated.moduleData));
  }

  if (validated.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    values.push(validated.status);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  // Always update the updated_at timestamp
  updates.push(`updated_at = NOW()`);

  // Add property ID as the last parameter
  values.push(propertyId);

  const result = await query<Property>(
    `UPDATE properties
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING 
       id,
       builder_id as "builderId",
       module_type as "moduleType",
       title,
       description,
       price,
       currency,
       location,
       images,
       module_data as "moduleData",
       status,
       created_at as "createdAt",
       updated_at as "updatedAt"`,
    values
  );

  if (result.rows.length === 0) {
    throw new Error(`Failed to update property '${propertyId}'`);
  }

  const updatedProperty = result.rows[0];

  // Regenerate embedding if title, description, or location changed
  const shouldRegenerateEmbedding =
    validated.title !== undefined ||
    validated.description !== undefined ||
    validated.location !== undefined;

  if (shouldRegenerateEmbedding) {
    embeddingsService.instance
      .generateAndStorePropertyEmbedding(updatedProperty.id, {
        title: updatedProperty.title,
        description: updatedProperty.description,
        location: updatedProperty.location,
      })
      .catch((error) => {
        console.error(`Failed to regenerate embedding for property ${updatedProperty.id}:`, error);
      });
  }

  return updatedProperty;
}

/**
 * Delete a property
 */
export async function deleteProperty(propertyId: string): Promise<void> {
  // Check if property exists
  const existingProperty = await getProperty(propertyId);
  if (!existingProperty) {
    throw new Error(`Property '${propertyId}' not found`);
  }

  // Delete the property (cascade will handle related records)
  await query('DELETE FROM properties WHERE id = $1', [propertyId]);
}

/**
 * List properties with optional filters
 */
export async function listProperties(filters?: {
  builderId?: string;
  moduleType?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ properties: Property[]; total: number }> {
  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (filters?.builderId) {
    conditions.push(`builder_id = $${paramIndex++}`);
    values.push(filters.builderId);
  }

  if (filters?.moduleType) {
    conditions.push(`module_type = $${paramIndex++}`);
    values.push(filters.moduleType);
  }

  if (filters?.status) {
    conditions.push(`status = $${paramIndex++}`);
    values.push(filters.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM properties ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get properties with pagination
  const limit = filters?.limit || 20;
  const offset = filters?.offset || 0;

  const result = await query<Property>(
    `SELECT 
      id,
      builder_id as "builderId",
      module_type as "moduleType",
      title,
      description,
      price,
      currency,
      location,
      images,
      module_data as "moduleData",
      status,
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM properties
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, limit, offset]
  );

  return {
    properties: result.rows,
    total,
  };
}

/**
 * Get properties by builder ID
 */
export async function getPropertiesByBuilder(
  builderId: string,
  options?: { limit?: number; offset?: number }
): Promise<{ properties: Property[]; total: number }> {
  return listProperties({
    builderId,
    limit: options?.limit,
    offset: options?.offset,
  });
}

/**
 * Get properties by module type
 */
export async function getPropertiesByModule(
  moduleType: string,
  options?: { limit?: number; offset?: number }
): Promise<{ properties: Property[]; total: number }> {
  return listProperties({
    moduleType,
    limit: options?.limit,
    offset: options?.offset,
  });
}
