import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from './index';

async function runMigration() {
  try {
    console.log('Starting database migration...');

    // Read schema file
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Execute schema
    await pool.query(schema);

    console.log('✓ Database migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('✗ Database migration failed:', error);
    process.exit(1);
  }
}

runMigration();
