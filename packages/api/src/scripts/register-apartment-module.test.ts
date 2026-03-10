import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerApartmentModule } from './register-apartment-module';
import * as moduleRegistry from '../services/module-registry.service';

// Mock the module registry service
vi.mock('../services/module-registry.service', () => ({
  registerModule: vi.fn(),
  getModule: vi.fn(),
}));

const mockRegisterModule = vi.mocked(moduleRegistry.registerModule);
const mockGetModule = vi.mocked(moduleRegistry.getModule);

describe('Register Apartment Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should register apartment module with correct schema', async () => {
    const mockModule = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      type: 'APARTMENT',
      version: '1.0.0',
      schema: {
        fields: [
          { name: 'bedrooms', type: 'number', required: true },
          { name: 'bathrooms', type: 'number', required: true },
          { name: 'sqft', type: 'number', required: true },
          { name: 'floor', type: 'number', required: false },
          { name: 'building_name', type: 'string', required: false },
          { name: 'amenities', type: 'json', required: false },
          { name: 'parking_spaces', type: 'number', required: false },
        ],
        indexes: ['bedrooms', 'bathrooms', 'sqft'],
      },
      active: true,
      createdAt: new Date(),
    };

    mockGetModule.mockResolvedValue(null);
    mockRegisterModule.mockResolvedValue(mockModule);

    const result = await registerApartmentModule();

    expect(mockGetModule).toHaveBeenCalledWith('APARTMENT');
    expect(mockRegisterModule).toHaveBeenCalledWith({
      type: 'APARTMENT',
      version: '1.0.0',
      schema: {
        fields: [
          { name: 'bedrooms', type: 'number', required: true },
          { name: 'bathrooms', type: 'number', required: true },
          { name: 'sqft', type: 'number', required: true },
          { name: 'floor', type: 'number', required: false },
          { name: 'building_name', type: 'string', required: false },
          { name: 'amenities', type: 'json', required: false },
          { name: 'parking_spaces', type: 'number', required: false },
        ],
        indexes: ['bedrooms', 'bathrooms', 'sqft'],
      },
      active: true,
    });
    expect(result).toEqual(mockModule);
  });

  it('should return existing module if already registered', async () => {
    const existingModule = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      type: 'APARTMENT',
      version: '1.0.0',
      schema: {
        fields: [
          { name: 'bedrooms', type: 'number', required: true },
          { name: 'bathrooms', type: 'number', required: true },
          { name: 'sqft', type: 'number', required: true },
          { name: 'floor', type: 'number', required: false },
          { name: 'building_name', type: 'string', required: false },
          { name: 'amenities', type: 'json', required: false },
          { name: 'parking_spaces', type: 'number', required: false },
        ],
        indexes: ['bedrooms', 'bathrooms', 'sqft'],
      },
      active: true,
      createdAt: new Date(),
    };

    mockGetModule.mockResolvedValue(existingModule);

    const result = await registerApartmentModule();

    expect(mockGetModule).toHaveBeenCalledWith('APARTMENT');
    expect(mockRegisterModule).not.toHaveBeenCalled();
    expect(result).toEqual(existingModule);
  });

  it('should throw error if registration fails', async () => {
    mockGetModule.mockResolvedValue(null);
    mockRegisterModule.mockRejectedValue(new Error('Database error'));

    await expect(registerApartmentModule()).rejects.toThrow('Database error');
  });
});
