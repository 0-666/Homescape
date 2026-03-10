# Embeddings Service

## Overview

The Embeddings Service provides OpenAI text-embedding-3-small integration for generating and managing property embeddings for semantic search functionality. This service automatically generates 1536-dimensional vector embeddings for property descriptions and stores them in the PostgreSQL database with pgvector support.

## Features

- **Automatic Embedding Generation**: Embeddings are automatically generated when properties are created or updated
- **Semantic Property Representation**: Combines title, description, and location into a comprehensive embedding
- **Batch Processing**: Support for bulk embedding generation for multiple properties
- **Error Handling**: Graceful error handling with logging for failed embedding operations
- **Asynchronous Processing**: Embeddings are generated asynchronously to avoid blocking property operations

## Configuration

The service requires an OpenAI API key to be configured in the environment:

```env
OPENAI_API_KEY=your-openai-api-key-here
```

## Integration with Property Service

The embeddings service is automatically integrated with the property service:

### On Property Creation
When a new property is created, an embedding is automatically generated and stored:

```typescript
const property = await createProperty({
  builderId: 'builder-uuid',
  moduleType: 'APARTMENT',
  title: 'Modern Downtown Apartment',
  description: 'Beautiful 2BR apartment with city views',
  location: 'Downtown Seattle',
  price: 350000,
  moduleData: { bedrooms: 2, bathrooms: 2, sqft: 1200 }
});
// Embedding is generated asynchronously in the background
```

### On Property Update
When property title, description, or location is updated, the embedding is automatically regenerated:

```typescript
const updatedProperty = await updateProperty(propertyId, {
  title: 'Updated Modern Downtown Apartment',
  description: 'Newly renovated 2BR apartment with stunning city views'
});
// Embedding is regenerated asynchronously in the background
```

## Direct Usage

You can also use the embeddings service directly:

### Generate Embedding for Text

```typescript
import { embeddingsService } from './services/embeddings.service';

const embedding = await embeddingsService.instance.generateEmbedding(
  'Modern apartment with city views'
);
// Returns: number[] (1536 dimensions)
```

### Generate Property Embedding

```typescript
const embedding = await embeddingsService.instance.generatePropertyEmbedding({
  title: 'Modern Apartment',
  description: 'Beautiful 2BR apartment',
  location: 'Downtown Seattle'
});
```

### Store Embedding in Database

```typescript
await embeddingsService.instance.storePropertyEmbedding(
  propertyId,
  embedding
);
```

### Generate and Store in One Operation

```typescript
await embeddingsService.instance.generateAndStorePropertyEmbedding(
  propertyId,
  {
    title: 'Modern Apartment',
    description: 'Beautiful 2BR apartment',
    location: 'Downtown Seattle'
  }
);
```

### Update Existing Property Embedding

```typescript
// Fetches property data from database and regenerates embedding
await embeddingsService.instance.updatePropertyEmbedding(propertyId);
```

### Batch Generate Embeddings

```typescript
const properties = [
  {
    id: 'property-1-uuid',
    title: 'Property 1',
    description: 'Description 1',
    location: 'Location 1'
  },
  {
    id: 'property-2-uuid',
    title: 'Property 2',
    description: 'Description 2',
    location: 'Location 2'
  }
];

const results = await embeddingsService.instance.batchGenerateEmbeddings(properties);
// Returns: Array<{ id: string; success: boolean; error?: string }>
```

## Database Schema

Embeddings are stored in the `properties` table:

```sql
CREATE TABLE properties (
  ...
  embedding VECTOR(1536),
  ...
);

CREATE INDEX idx_properties_embedding 
ON properties USING ivfflat (embedding vector_cosine_ops);
```

## Error Handling

The service includes comprehensive error handling:

- **Empty Text**: Throws error if text is empty or whitespace-only
- **Invalid Dimensions**: Validates embedding dimension is exactly 1536
- **OpenAI API Errors**: Catches and wraps OpenAI API errors with descriptive messages
- **Database Errors**: Catches and wraps database errors
- **Batch Processing**: Continues processing on individual failures, returns success/failure for each item

## Asynchronous Processing

Embeddings are generated asynchronously to avoid blocking property creation/update operations:

```typescript
// Property creation returns immediately
const property = await createProperty(input);

// Embedding generation happens in background
embeddingsService.instance
  .generateAndStorePropertyEmbedding(property.id, propertyData)
  .catch((error) => {
    console.error(`Failed to generate embedding:`, error);
  });
```

## Testing

The service includes comprehensive unit tests covering:

- Embedding generation for various text inputs
- Property embedding generation with different field combinations
- Database storage operations
- Error handling scenarios
- Batch processing with partial failures

Run tests:

```bash
npm test -- embeddings.service.test.ts
```

## Performance Considerations

- **Model**: Uses `text-embedding-3-small` (1536 dimensions) for optimal balance of quality and speed
- **Async Processing**: Embeddings are generated asynchronously to avoid blocking API responses
- **Batch Operations**: Use `batchGenerateEmbeddings` for bulk operations to improve efficiency
- **Caching**: Consider implementing caching for frequently accessed embeddings if needed

## Future Enhancements

Potential improvements for future iterations:

1. **Queue-based Processing**: Move embedding generation to a job queue (Bull/Redis) for better scalability
2. **Retry Logic**: Implement automatic retries for failed embedding generations
3. **Embedding Cache**: Cache embeddings in Redis to reduce database queries
4. **Monitoring**: Add metrics for embedding generation success rates and latency
5. **Batch API Calls**: Use OpenAI's batch embedding API for multiple properties at once

## Related Services

- **Property Service**: Automatically triggers embedding generation
- **Search Service**: Uses embeddings for semantic search (Task 4.2)
- **Vector Search Engine**: Queries embeddings using pgvector cosine similarity

## Requirements Validation

This implementation satisfies:

- **Requirement 1.2**: Vector search with semantic similarity scores above 0.7
- **Task 4.1**: OpenAI embeddings integration with text-embedding-3-small model
- **Design Specification**: 1536-dimensional embeddings stored in PostgreSQL with pgvector
