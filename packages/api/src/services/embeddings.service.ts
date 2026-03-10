import OpenAI from 'openai';
import { config } from '../config';
import { pool } from '../db';

/**
 * Service for generating and managing OpenAI embeddings for property descriptions
 * Uses text-embedding-3-small model (1536 dimensions)
 */
export class EmbeddingsService {
  private openai: OpenAI;

  constructor() {
    if (!config.openai.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  /**
   * Generate embedding for a text string using OpenAI text-embedding-3-small model
   * @param text - The text to generate an embedding for
   * @returns Array of 1536 floating point numbers representing the embedding
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding returned from OpenAI');
      }

      return response.data[0].embedding;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate embedding: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Generate embedding for a property description
   * Combines title, description, and location for comprehensive semantic representation
   * @param propertyData - Object containing title, description, and location
   * @returns Array of 1536 floating point numbers representing the embedding
   */
  async generatePropertyEmbedding(propertyData: {
    title: string;
    description?: string;
    location: string;
  }): Promise<number[]> {
    // Combine property fields into a single text for embedding
    const textParts = [
      propertyData.title,
      propertyData.description || '',
      propertyData.location,
    ].filter(part => part.trim().length > 0);

    const combinedText = textParts.join(' | ');
    return this.generateEmbedding(combinedText);
  }

  /**
   * Store embedding for a property in the database
   * @param propertyId - UUID of the property
   * @param embedding - Array of 1536 floating point numbers
   */
  async storePropertyEmbedding(propertyId: string, embedding: number[]): Promise<void> {
    if (embedding.length !== 1536) {
      throw new Error(`Invalid embedding dimension: expected 1536, got ${embedding.length}`);
    }

    try {
      await pool.query(
        'UPDATE properties SET embedding = $1 WHERE id = $2',
        [JSON.stringify(embedding), propertyId]
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to store embedding: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Generate and store embedding for a property in one operation
   * @param propertyId - UUID of the property
   * @param propertyData - Object containing title, description, and location
   */
  async generateAndStorePropertyEmbedding(
    propertyId: string,
    propertyData: {
      title: string;
      description?: string;
      location: string;
    }
  ): Promise<void> {
    const embedding = await this.generatePropertyEmbedding(propertyData);
    await this.storePropertyEmbedding(propertyId, embedding);
  }

  /**
   * Update embedding for an existing property
   * Fetches property data from database and regenerates embedding
   * @param propertyId - UUID of the property
   */
  async updatePropertyEmbedding(propertyId: string): Promise<void> {
    try {
      const result = await pool.query(
        'SELECT title, description, location FROM properties WHERE id = $1',
        [propertyId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Property not found: ${propertyId}`);
      }

      const property = result.rows[0];
      await this.generateAndStorePropertyEmbedding(propertyId, {
        title: property.title,
        description: property.description,
        location: property.location,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update property embedding: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Batch generate embeddings for multiple properties
   * Useful for initial indexing or bulk updates
   * @param properties - Array of property objects with id, title, description, location
   * @returns Array of results indicating success/failure for each property
   */
  async batchGenerateEmbeddings(
    properties: Array<{
      id: string;
      title: string;
      description?: string;
      location: string;
    }>
  ): Promise<Array<{ id: string; success: boolean; error?: string }>> {
    const results = [];

    for (const property of properties) {
      try {
        await this.generateAndStorePropertyEmbedding(property.id, {
          title: property.title,
          description: property.description,
          location: property.location,
        });
        results.push({ id: property.id, success: true });
      } catch (error) {
        results.push({
          id: property.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }
}

// Export singleton instance (lazy-loaded)
let _embeddingsService: EmbeddingsService | null = null;

export const embeddingsService = {
  get instance(): EmbeddingsService {
    if (!_embeddingsService) {
      _embeddingsService = new EmbeddingsService();
    }
    return _embeddingsService;
  },
  
  // For testing: allow resetting the singleton
  reset(): void {
    _embeddingsService = null;
  },
};
