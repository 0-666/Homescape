import { query } from '../db';
import { z } from 'zod';

// Validation schemas
export const updateLeadScoreSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  propertyId: z.string().uuid('Invalid property ID format'),
  eventType: z.enum(['VIEW', 'SAVE', 'DESIGN', 'CALL']),
});

// Types
export enum EventType {
  VIEW = 'VIEW',
  SAVE = 'SAVE',
  DESIGN = 'DESIGN',
  CALL = 'CALL',
}

export enum LeadStatus {
  NEW = 'NEW',
  HOT = 'HOT',
  CONTACTED = 'CONTACTED',
  CONVERTED = 'CONVERTED',
  LOST = 'LOST',
}

export interface Lead {
  id: string;
  userId: string;
  propertyId: string;
  builderId: string;
  score: number;
  status: LeadStatus;
  lastActivity: Date;
  createdAt: Date;
}

// Scoring rules: VIEW=20, SAVE=30, DESIGN=40, CALL=50
const SCORE_VALUES: Record<EventType, number> = {
  [EventType.VIEW]: 20,
  [EventType.SAVE]: 30,
  [EventType.DESIGN]: 40,
  [EventType.CALL]: 50,
};

/**
 * Calculate score from event type
 */
export function calculateScore(eventType: EventType): number {
  return SCORE_VALUES[eventType];
}

/**
 * Update lead score when a behavior event occurs
 * Creates a new lead if one doesn't exist for the user-property combination
 */
export async function updateLeadScore(
  userId: string,
  propertyId: string,
  eventType: EventType
): Promise<Lead> {
  // Validate input
  const validated = updateLeadScoreSchema.parse({ userId, propertyId, eventType });

  // Get the builder_id for this property
  const propertyResult = await query(
    'SELECT builder_id FROM properties WHERE id = $1',
    [validated.propertyId]
  );

  if (propertyResult.rows.length === 0) {
    throw new Error('Property not found');
  }

  const builderId = propertyResult.rows[0].builder_id;

  // Calculate score for this event
  const scoreToAdd = calculateScore(validated.eventType);

  // Check if lead exists
  const existingLead = await query(
    `SELECT id, score FROM leads 
     WHERE user_id = $1 AND property_id = $2`,
    [validated.userId, validated.propertyId]
  );

  let lead: Lead;

  if (existingLead.rows.length > 0) {
    // Update existing lead
    const newScore = existingLead.rows[0].score + scoreToAdd;
    const newStatus = newScore >= 80 ? LeadStatus.HOT : LeadStatus.NEW;

    const result = await query<Lead>(
      `UPDATE leads 
       SET score = $1, 
           status = $2, 
           last_activity = NOW()
       WHERE user_id = $3 AND property_id = $4
       RETURNING id, user_id as "userId", property_id as "propertyId", 
                 builder_id as "builderId", score, status, 
                 last_activity as "lastActivity", created_at as "createdAt"`,
      [newScore, newStatus, validated.userId, validated.propertyId]
    );

    lead = result.rows[0];
  } else {
    // Create new lead
    const initialScore = scoreToAdd;
    const initialStatus = initialScore >= 80 ? LeadStatus.HOT : LeadStatus.NEW;

    const result = await query<Lead>(
      `INSERT INTO leads (user_id, property_id, builder_id, score, status, last_activity, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, user_id as "userId", property_id as "propertyId", 
                 builder_id as "builderId", score, status, 
                 last_activity as "lastActivity", created_at as "createdAt"`,
      [validated.userId, validated.propertyId, builderId, initialScore, initialStatus]
    );

    lead = result.rows[0];
  }

  return lead;
}

/**
 * Get all leads for a specific user
 */
export async function getLeadsByUser(userId: string): Promise<Lead[]> {
  // Validate userId format
  if (!z.string().uuid().safeParse(userId).success) {
    throw new Error('Invalid user ID format');
  }

  const result = await query<Lead>(
    `SELECT id, user_id as "userId", property_id as "propertyId", 
            builder_id as "builderId", score, status, 
            last_activity as "lastActivity", created_at as "createdAt"
     FROM leads
     WHERE user_id = $1
     ORDER BY score DESC, last_activity DESC`,
    [userId]
  );

  return result.rows;
}

/**
 * Get all leads for a specific property
 */
export async function getLeadsByProperty(propertyId: string): Promise<Lead[]> {
  // Validate propertyId format
  if (!z.string().uuid().safeParse(propertyId).success) {
    throw new Error('Invalid property ID format');
  }

  const result = await query<Lead>(
    `SELECT id, user_id as "userId", property_id as "propertyId", 
            builder_id as "builderId", score, status, 
            last_activity as "lastActivity", created_at as "createdAt"
     FROM leads
     WHERE property_id = $1
     ORDER BY score DESC, last_activity DESC`,
    [propertyId]
  );

  return result.rows;
}

/**
 * Get all leads for a specific builder
 */
export async function getLeadsByBuilder(builderId: string): Promise<Lead[]> {
  // Validate builderId format
  if (!z.string().uuid().safeParse(builderId).success) {
    throw new Error('Invalid builder ID format');
  }

  const result = await query<Lead>(
    `SELECT id, user_id as "userId", property_id as "propertyId", 
            builder_id as "builderId", score, status, 
            last_activity as "lastActivity", created_at as "createdAt"
     FROM leads
     WHERE builder_id = $1
     ORDER BY score DESC, last_activity DESC`,
    [builderId]
  );

  return result.rows;
}
