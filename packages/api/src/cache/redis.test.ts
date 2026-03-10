import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getRedisClient, cacheGet, cacheSet, cacheDel } from './redis';

describe('Redis Cache', () => {
  let client: any;

  beforeAll(async () => {
    client = await getRedisClient();
  });

  afterAll(async () => {
    if (client) {
      await client.quit();
    }
  });

  it('should connect to Redis', async () => {
    const pong = await client.ping();
    expect(pong).toBe('PONG');
  });

  it('should set and get a value', async () => {
    const key = 'test:key';
    const value = { foo: 'bar', num: 123 };

    await cacheSet(key, value);
    const retrieved = await cacheGet(key);

    expect(retrieved).toEqual(value);

    // Cleanup
    await cacheDel(key);
  });

  it('should set a value with TTL', async () => {
    const key = 'test:ttl';
    const value = 'expires soon';

    await cacheSet(key, value, 2); // 2 seconds TTL
    
    const retrieved = await cacheGet(key);
    expect(retrieved).toBe(value);

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    const expired = await cacheGet(key);
    expect(expired).toBeNull();
  });

  it('should delete a value', async () => {
    const key = 'test:delete';
    const value = 'to be deleted';

    await cacheSet(key, value);
    let retrieved = await cacheGet(key);
    expect(retrieved).toBe(value);

    await cacheDel(key);
    retrieved = await cacheGet(key);
    expect(retrieved).toBeNull();
  });

  it('should return null for non-existent key', async () => {
    const retrieved = await cacheGet('test:nonexistent');
    expect(retrieved).toBeNull();
  });
});
