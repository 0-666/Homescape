import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool, query } from './index';

describe('Database Connection', () => {
  beforeAll(async () => {
    // Ensure database is connected
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    // Close pool after tests
    await pool.end();
  });

  it('should connect to the database', async () => {
    const result = await query('SELECT 1 as value');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].value).toBe(1);
  });

  it('should have pgvector extension enabled', async () => {
    const result = await query(
      "SELECT * FROM pg_extension WHERE extname = 'vector'"
    );
    expect(result.rows).toHaveLength(1);
  });

  it('should have users table', async () => {
    const result = await query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'users'"
    );
    expect(result.rows).toHaveLength(1);
  });

  it('should have properties table with vector column', async () => {
    const result = await query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'embedding'"
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].data_type).toBe('USER-DEFINED'); // pgvector type
  });

  it('should have default APARTMENT module', async () => {
    const result = await query(
      "SELECT * FROM property_modules WHERE type = 'APARTMENT'"
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].active).toBe(true);
  });
});
