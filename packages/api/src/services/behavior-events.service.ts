import { query } from '../db';
import { z } from 'zod';
import * as leadScoringService from './lead-scoring.service';

// Validation schemas
export const trackEventSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  propertyId: z.string().uuid('Invalid property ID format'),
  eventType: z.enum(['VIEW', 'SAVE', 'DESIGN', 'CALL'], {
    errorMap: () => ({ message: 'Event type must be VIEW, SAVE, DESIGN, or CALL' }),
  }),
  metadata: z.record(z.any()).optional(),
});

// Types
export enum EventType {
  VIEW = 'VIEW',
  SAVE = 'SAVE',
  DESIGN = 'DESIGN',
  CALL = 'CALL',
}

export interface BehaviorEvent {
  id: string;
  userId: string;
  propertyId: string;
  eventType: EventType;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface TrackEventInput {
  userId: string;
  propertyId: string;
  eventType: EventType;
  metadata?: Record<string, any>;
}

/**
 * Track a behavior event for a user
 */
export async function trackEvent(input: TrackEventInput): Promise<BehaviorEvent> {
  // Validate input
  const validated = trackEventSchema.parse(input);

  // Verify user exists
  const userCheck = await query(
    'SELECT id FROM users WHERE id = $1',
    [validated.userId]
  );

  if (userCheck.rows.length === 0) {
    throw new Error('User not found');
  }

  // Verify property exists
  const propertyCheck = await query(
    'SELECT id FROM properties WHERE id = $1',
    [validated.propertyId]
  );

  if (propertyCheck.rows.length === 0) {
    throw new Error('Property not found');
  }

  // Insert behavior event
  const result = await query<BehaviorEvent>(
    `INSERT INTO behavior_events (user_id, property_id, event_type, metadata, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id, user_id as "userId", property_id as "propertyId", 
               event_type as "eventType", metadata, created_at as "createdAt"`,
    [validated.userId, validated.propertyId, validated.eventType, validated.metadata || null]
  );

  const event = result.rows[0];

  // Update lead score automatically
  try {
    await leadScoringService.updateLeadScore(
      validated.userId,
      validated.propertyId,
      validated.eventType as leadScoringService.EventType
    );
  } catch (error) {
    // Log error but don't fail the event tracking
    console.error('Failed to update lead score:', error);
  }

  return event;
}

/**
 * Get all behavior events for a specific user
 */
export async function getEventsByUser(
  userId: string,
  limit: number = 100,
  offset: number = 0
): Promise<BehaviorEvent[]> {
  // Validate userId format
  if (!z.string().uuid().safeParse(userId).success) {
    throw new Error('Invalid user ID format');
  }

  const result = await query<BehaviorEvent>(
    `SELECT id, user_id as "userId", property_id as "propertyId", 
            event_type as "eventType", metadata, created_at as "createdAt"
     FROM behavior_events
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return result.rows;
}

/**
 * Get all behavior events for a specific property
 */
export async function getEventsByProperty(
  propertyId: string,
  limit: number = 100,
  offset: number = 0
): Promise<BehaviorEvent[]> {
  // Validate propertyId format
  if (!z.string().uuid().safeParse(propertyId).success) {
    throw new Error('Invalid property ID format');
  }

  const result = await query<BehaviorEvent>(
    `SELECT id, user_id as "userId", property_id as "propertyId", 
            event_type as "eventType", metadata, created_at as "createdAt"
     FROM behavior_events
     WHERE property_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [propertyId, limit, offset]
  );

  return result.rows;
}

/**
 * Get behavior events for a user and property combination
 */
export async function getEventsByUserAndProperty(
  userId: string,
  propertyId: string
): Promise<BehaviorEvent[]> {
  // Validate IDs
  if (!z.string().uuid().safeParse(userId).success) {
    throw new Error('Invalid user ID format');
  }
  if (!z.string().uuid().safeParse(propertyId).success) {
    throw new Error('Invalid property ID format');
  }

  const result = await query<BehaviorEvent>(
    `SELECT id, user_id as "userId", property_id as "propertyId", 
            event_type as "eventType", metadata, created_at as "createdAt"
     FROM behavior_events
     WHERE user_id = $1 AND property_id = $2
     ORDER BY created_at DESC`,
    [userId, propertyId]
  );

  return result.rows;
}

/**
 * Get count of events by type for a user
 */
export async function getEventCountsByUser(userId: string): Promise<Record<EventType, number>> {
  // Validate userId format
  if (!z.string().uuid().safeParse(userId).success) {
    throw new Error('Invalid user ID format');
  }

  const result = await query<{ eventType: EventType; count: string }>(
    `SELECT event_type as "eventType", COUNT(*) as count
     FROM behavior_events
     WHERE user_id = $1
     GROUP BY event_type`,
    [userId]
  );

  // Initialize counts for all event types
  const counts: Record<EventType, number> = {
    [EventType.VIEW]: 0,
    [EventType.SAVE]: 0,
    [EventType.DESIGN]: 0,
    [EventType.CALL]: 0,
  };

  // Fill in actual counts
  result.rows.forEach(row => {
    counts[row.eventType] = parseInt(row.count, 10);
  });

  return counts;
}
