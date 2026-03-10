import { z } from 'zod';
import { query } from '../db';

// Validation schemas
export const schemaFieldSchema = z.object({
  name: z.string().min(1, 'Field name is required'),
  type: z.enum(['string', 'number', 'boolean', 'date', 'json'], {
    errorMap: () => ({ message: 'Invalid field type' }),
  }),
  required: z.boolean(),
  validation: z.record(z.any()).optional(),
});

export const moduleSchemaSchema = z.object({
  fields: z.array(schemaFieldSchema).min(1, 'At least one field is required'),
  indexes: z.array(z.string()).optional().default([]),
});

export const registerModuleSchema = z.object({
  type: z.string()
    .min(1, 'Module type is required')
    .regex(/^[A-Z_]+$/, 'Module type must be uppercase letters and underscores only'),
  version: z.string()
    .min(1, 'Version is required')
    .regex(/^\d+\.\d+\.\d+$/, 'Version must follow semantic versioning (e.g., 1.0.0)'),
  schema: moduleSchemaSchema,
  active: z.boolean().default(true),
});

export const updateModuleSchema = z.object({
  version: z.string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must follow semantic versioning (e.g., 1.0.0)')
    .optional(),
  schema: moduleSchemaSchema.optional(),
  active: z.boolean().optional(),
});

// Types
export enum ModuleType {
  APARTMENT = 'APARTMENT',
  RENTAL = 'RENTAL',
  LAND = 'LAND',
}

export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'json';
  required: boolean;
  validation?: Record<string, any>;
}

export interface ModuleSchema {
  fields: SchemaField[];
  indexes?: string[];
}

export interface PropertyModule {
  id: string;
  type: string;
  version: string;
  schema: ModuleSchema;
  active: boolean;
  createdAt: Date;
}

export interface RegisterModuleInput {
  type: string;
  version: string;
  schema: ModuleSchema;
  active?: boolean;
}

export interface UpdateModuleInput {
  version?: string;
  schema?: ModuleSchema;
  active?: boolean;
}

export interface PropertyValidator {
  validate(property: any): ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Register a new property module with schema validation
 */
export async function registerModule(input: RegisterModuleInput): Promise<PropertyModule> {
  // Validate input
  const validated = registerModuleSchema.parse(input);

  // Check if module type already exists
  const existingModule = await query(
    'SELECT id FROM property_modules WHERE type = $1',
    [validated.type]
  );

  if (existingModule.rows.length > 0) {
    throw new Error(`Module type '${validated.type}' already exists`);
  }

  // Insert module into database
  const result = await query<PropertyModule>(
    `INSERT INTO property_modules (type, version, schema, active, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id, type, version, schema, active, created_at as "createdAt"`,
    [validated.type, validated.version, JSON.stringify(validated.schema), validated.active]
  );

  return result.rows[0];
}

/**
 * Get a module by type
 */
export async function getModule(moduleType: string): Promise<PropertyModule | null> {
  const result = await query<PropertyModule>(
    `SELECT id, type, version, schema, active, created_at as "createdAt"
     FROM property_modules
     WHERE type = $1`,
    [moduleType]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Get a module by ID
 */
export async function getModuleById(id: string): Promise<PropertyModule | null> {
  const result = await query<PropertyModule>(
    `SELECT id, type, version, schema, active, created_at as "createdAt"
     FROM property_modules
     WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * List all modules, optionally filtered by active status
 */
export async function listModules(activeOnly: boolean = false): Promise<PropertyModule[]> {
  const queryText = activeOnly
    ? `SELECT id, type, version, schema, active, created_at as "createdAt"
       FROM property_modules
       WHERE active = true
       ORDER BY type ASC`
    : `SELECT id, type, version, schema, active, created_at as "createdAt"
       FROM property_modules
       ORDER BY type ASC`;

  const result = await query<PropertyModule>(queryText, []);

  return result.rows;
}

/**
 * Update a module by type
 */
export async function updateModule(
  moduleType: string,
  input: UpdateModuleInput
): Promise<PropertyModule> {
  // Validate input
  const validated = updateModuleSchema.parse(input);

  // Check if module exists
  const existingModule = await getModule(moduleType);
  if (!existingModule) {
    throw new Error(`Module type '${moduleType}' not found`);
  }

  // Build update query dynamically based on provided fields
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (validated.version !== undefined) {
    updates.push(`version = $${paramIndex++}`);
    values.push(validated.version);
  }

  if (validated.schema !== undefined) {
    updates.push(`schema = $${paramIndex++}`);
    values.push(JSON.stringify(validated.schema));
  }

  if (validated.active !== undefined) {
    updates.push(`active = $${paramIndex++}`);
    values.push(validated.active);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  // Add module type as the last parameter
  values.push(moduleType);

  const result = await query<PropertyModule>(
    `UPDATE property_modules
     SET ${updates.join(', ')}
     WHERE type = $${paramIndex}
     RETURNING id, type, version, schema, active, created_at as "createdAt"`,
    values
  );

  if (result.rows.length === 0) {
    throw new Error(`Failed to update module '${moduleType}'`);
  }

  return result.rows[0];
}

/**
 * Delete a module by type
 */
export async function deleteModule(moduleType: string): Promise<void> {
  // Check if module exists
  const existingModule = await getModule(moduleType);
  if (!existingModule) {
    throw new Error(`Module type '${moduleType}' not found`);
  }

  // Check if any properties are using this module
  const propertiesResult = await query(
    'SELECT COUNT(*) as count FROM properties WHERE module_type = $1',
    [moduleType]
  );

  const propertyCount = parseInt(propertiesResult.rows[0].count, 10);
  if (propertyCount > 0) {
    throw new Error(
      `Cannot delete module '${moduleType}' because ${propertyCount} properties are using it`
    );
  }

  // Delete the module
  await query('DELETE FROM property_modules WHERE type = $1', [moduleType]);
}

/**
 * Enable a module by type
 */
export async function enableModule(moduleType: string): Promise<PropertyModule> {
  return updateModule(moduleType, { active: true });
}

/**
 * Disable a module by type
 */
export async function disableModule(moduleType: string): Promise<PropertyModule> {
  return updateModule(moduleType, { active: false });
}

/**
 * Validate property data against module schema
 */
export function validatePropertyData(
  moduleData: any,
  schema: ModuleSchema
): ValidationResult {
  const errors: string[] = [];

  // Check if moduleData is an object
  if (typeof moduleData !== 'object' || moduleData === null) {
    return {
      valid: false,
      errors: ['Module data must be an object'],
    };
  }

  // Validate each field in the schema
  for (const field of schema.fields) {
    const value = moduleData[field.name];

    // Check required fields
    if (field.required && (value === undefined || value === null)) {
      errors.push(`Field '${field.name}' is required`);
      continue;
    }

    // Skip validation if field is not required and not provided
    if (!field.required && (value === undefined || value === null)) {
      continue;
    }

    // Validate field type
    switch (field.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`Field '${field.name}' must be a string`);
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          errors.push(`Field '${field.name}' must be a number`);
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`Field '${field.name}' must be a boolean`);
        }
        break;

      case 'date':
        if (!(value instanceof Date) && isNaN(Date.parse(value))) {
          errors.push(`Field '${field.name}' must be a valid date`);
        }
        break;

      case 'json':
        // JSON fields can be any valid JSON value (object, array, etc.)
        try {
          if (typeof value === 'string') {
            JSON.parse(value);
          }
        } catch {
          errors.push(`Field '${field.name}' must be valid JSON`);
        }
        break;

      default:
        errors.push(`Unknown field type '${field.type}' for field '${field.name}'`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a property validator for a specific module
 */
export function createPropertyValidator(schema: ModuleSchema): PropertyValidator {
  return {
    validate(property: any): ValidationResult {
      return validatePropertyData(property, schema);
    },
  };
}
