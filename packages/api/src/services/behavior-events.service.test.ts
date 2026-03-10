import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as behaviorEventsService from './behavior-events.service';
import { query } from '../db';
import { EventType } from './behavior-events.service';

describe('Behavior Events Service', () => {
  let testUserId: string;
  let testPropertyId: string;
  let testBuilderId: string;

  beforeEach(async () => {
    // Create test user
    const userResult = await query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['test-behavior@example.com', 'hashedpassword', 'USER']
    );
    testUserId = userResult.rows[0].id;

    // Create test builder user
    const builderUserResult = await query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['test-builder-behavior@example.com', 'hashedpassword', 'BUILDER']
    );

    // Create test partner
    const partnerResult = await query(
      `INSERT INTO partners (user_id, business_name, status)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [builderUserResult.rows[0].id, 'Test Builder', 'APPROVED']
    );
    testBuilderId = partnerResult.rows[0].id;

    // Create test property
    const propertyResult = await query(
      `INSERT INTO properties (builder_id, module_type, title, description, price, location)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [testBuilderId, 'APARTMENT', 'Test Property', 'Test Description', 100000, 'Test Location']
    );
    testPropertyId = propertyResult.rows[0].id;
  });

  afterEach(async () => {
    // Clean up test data
    await query('DELETE FROM behavior_events WHERE user_id = $1', [testUserId]);
    await query('DELETE FROM properties WHERE id = $1', [testPropertyId]);
    await query('DELETE FROM partners WHERE id = $1', [testBuilderId]);
    await query('DELETE FROM users WHERE email LIKE $1', ['test-%behavior@example.com']);
  });

  describe('trackEvent', () => {
    it('should track a VIEW event successfully', async () => {
      const event = await behaviorEventsService.trackEvent({
        userId: testUserId,
        propertyId: testPropertyId,
        eventType: EventType.VIEW,
      });

      expect(event).toBeDefined();
      expect(event.id).toBeDefined();
      expect(event.userId).toBe(testUserId);
      expect(event.propertyId).toBe(testPropertyId);
      expect(event.eventType).toBe(EventType.VIEW);
      expect(event.createdAt).toBeInstanceOf(Date);
    });

    it('should track a SAVE event successfully', async () => {
      const event = await behaviorEventsService.trackEvent({
        userId: testUserId,
        propertyId: testPropertyId,
        eventType: EventType.SAVE,
      });

      expect(event.eventType).toBe(EventType.SAVE);
    });

    it('should track a DESIGN event successfully', async () => {
      const event = await behaviorEventsService.trackEvent({
        userId: testUserId,
        propertyId: testPropertyId,
        eventType: EventType.DESIGN,
      });

      expect(event.eventType).toBe(EventType.DESIGN);
    });

    it('should track a CALL event successfully', async () => {
      const event = await behaviorEventsService.trackEvent({
        userId: testUserId,
        propertyId: testPropertyId,
        eventType: EventType.CALL,
      });

      expect(event.eventType).toBe(EventType.CALL);
    });

    it('should track event with metadata', async () => {
      const metadata = { source: 'mobile', duration: 120 };
      const event = await behaviorEventsService.trackEvent({
        userId: testUserId,
        propertyId: testPropertyId,
        eventType: EventType.VIEW,
        metadata,
      });

      expect(event.metadata).toEqual(metadata);
    });

    it('should throw error for invalid user ID format', async () => {
      await expect(
        behaviorEventsService.trackEvent({
          userId: 'invalid-uuid',
          propertyId: testPropertyId,
          eventType: EventType.VIEW,
        })
      ).rejects.toThrow();
    });

    it('should throw error for invalid property ID format', async () => {
      await expect(
        behaviorEventsService.trackEvent({
          userId: testUserId,
          propertyId: 'invalid-uuid',
          eventType: EventType.VIEW,
        })
      ).rejects.toThrow();
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        behaviorEventsService.trackEvent({
          userId: '00000000-0000-0000-0000-000000000000',
          propertyId: testPropertyId,
          eventType: EventType.VIEW,
        })
      ).rejects.toThrow('User not found');
    });

    it('should throw error for non-existent property', async () => {
      await expect(
        behaviorEventsService.trackEvent({
          userId: testUserId,
          propertyId: '00000000-0000-0000-0000-000000000000',
          eventType: EventType.VIEW,
        })
      ).rejects.toThrow('Property not found');
    });

    it('should throw error for invalid event type', async () => {
      await expect(
        behaviorEventsService.trackEvent({
          userId: testUserId,
          propertyId: testPropertyId,
          eventType: 'INVALID' as EventType,
        })
      ).rejects.toThrow();
    });
  });

  describe('getEventsByUser', () => {
    beforeEach(async () => {
      // Create multiple test events
      await behaviorEventsService.trackEvent({
        userId: testUserId,
        propertyId: testPropertyId,
        eventType: EventType.VIEW,
      });
      await behaviorEventsService.trackEvent({
        userId: testUserId,
        propertyId: testPropertyId,
        eventType: EventType.SAVE,
      });
      await behaviorEventsService.trackEvent({
        userId: testUserId,
        propertyId: testPropertyId,
        eventType: EventType.DESIGN,
      });
    });

    it('should retrieve all events for a user', async () => {
      const events = await behaviorEventsService.getEventsByUser(testUserId);

      expect(events).toHaveLength(3);
      expect(events[0].userId).toBe(testUserId);
    });

    it('should return events in descending order by creation time', async () => {
      const events = await behaviorEventsService.getEventsByUser(testUserId);

      // Most recent event should be first (DESIGN was created last)
      expect(events[0].eventType).toBe(EventType.DESIGN);
      expect(events[1].eventType).toBe(EventType.SAVE);
      expect(events[2].eventType).toBe(EventType.VIEW);
    });

    it('should respect limit parameter', async () => {
      const events = await behaviorEventsService.getEventsByUser(testUserId, 2);

      expect(events).toHaveLength(2);
    });

    it('should respect offset parameter', async () => {
      const events = await behaviorEventsService.getEventsByUser(testUserId, 10, 1);

      expect(events).toHaveLength(2);
      expect(events[0].eventType).toBe(EventType.SAVE);
    });

    it('should return empty array for user with no events', async () => {
      // Create another user
      const userResult = await query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, $3)
         RETURNING id`,
        ['test-no-events@example.com', 'hashedpassword', 'USER']
      );
      const noEventsUserId = userResult.rows[0].id;

      const events = await behaviorEventsService.getEventsByUser(noEventsUserId);

      expect(events).toHaveLength(0);

      // Clean up
      await query('DELETE FROM users WHERE id = $1', [noEventsUserId]);
    });

    it('should throw error for invalid user ID format', async () => {
      await expect(
        behaviorEventsService.getEventsByUser('invalid-uuid')
      ).rejects.toThrow('Invalid user ID format');
    });
  });

  describe('getEventsByProperty', () => {
    beforeEach(async () => {
      // Create multiple test events
      await behaviorEventsService.trackEvent({
        userId: testUserId,
        propertyId: testPropertyId,
        eventType: EventType.VIEW,
      });
      await behaviorEventsService.trackEvent({
        userId: testUserId,
        propertyId: testPropertyId,
        eventType: EventType.CALL,
      });
    });

    it('should retrieve all events for a property', async () => {
      const events = await behaviorEventsService.getEventsByProperty(testPropertyId);

      expect(events).toHaveLength(2);
      expect(events[0].propertyId).toBe(testPropertyId);
    });

    it('should return events in descending order by creation time', async () => {
      const events = await behaviorEventsService.getEventsByProperty(testPropertyId);

      // Most recent event should be first (CALL was created last)
      expect(events[0].eventType).toBe(EventType.CALL);
      expect(events[1].eventType).toBe(EventType.VIEW);
    });

    it('should respect limit parameter', async () => {
      const events = await behaviorEventsService.getEventsByProperty(testPropertyId, 1);

      expect(events).toHaveLength(1);
    });

    it('should respect offset parameter', async () => {
      const events = await behaviorEventsService.getEventsByProperty(testPropertyId, 10, 1);

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe(EventType.VIEW);
    });

    it('should return empty array for property with no events', async () => {
      // Create another property
      const propertyResult = await query(
        `INSERT INTO properties (builder_id, module_type, title, description, price, location)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [testBuilderId, 'APARTMENT', 'No Events Property', 'Test', 100000, 'Test']
      );
      const noEventsPropertyId = propertyResult.rows[0].id;

      const events = await behaviorEventsService.getEventsByProperty(noEventsPropertyId);

      expect(events).toHaveLength(0);

      // Clean up
      await query('DELETE FROM properties WHERE id = $1', [noEventsPropertyId]);
    });

    it('should throw error for invalid property ID format', async () => {
      await expect(
        behaviorEventsService.getEventsByProperty('invalid-uuid')
      ).rejects.toThrow('Invalid property ID format');
    });
  });

  describe('getEventsByUserAndProperty', () => {
    beforeEach(async () => {
      // Create test events
      await behaviorEventsService.trackEvent({
        userId: testUserId,
        propertyId: testPropertyId,
        eventType: EventType.VIEW,
      });
      await behaviorEventsService.trackEvent({
        userId: testUserId,
        propertyId: testPropertyId,
        eventType: EventType.SAVE,
      });
    });

    it('should retrieve events for specific user and property combination', async () => {
      const events = await behaviorEventsService.getEventsByUserAndProperty(
        testUserId,
        testPropertyId
      );

      expect(events).toHaveLength(2);
      expect(events[0].userId).toBe(testUserId);
      expect(events[0].propertyId).toBe(testPropertyId);
    });

    it('should return events in descending order by creation time', async () => {
      const events = await behaviorEventsService.getEventsByUserAndProperty(
        testUserId,
        testPropertyId
      );

      expect(events[0].eventType).toBe(EventType.SAVE);
      expect(events[1].eventType).toBe(EventType.VIEW);
    });

    it('should throw error for invalid user ID format', async () => {
      await expect(
        behaviorEventsService.getEventsByUserAndProperty('invalid-uuid', testPropertyId)
      ).rejects.toThrow('Invalid user ID format');
    });

    it('should throw error for invalid property ID format', async () => {
      await expect(
        behaviorEventsService.getEventsByUserAndProperty(testUserId, 'invalid-uuid')
      ).rejects.toThrow('Invalid property ID format');
    });
  });

  describe('getEventCountsByUser', () => {
    beforeEach(async () => {
      // Create multiple events of different types
      await behaviorEventsService.trackEvent({
        userId: testUserId,
        propertyId: testPropertyId,
        eventType: EventType.VIEW,
      });
      await behaviorEventsService.trackEvent({
        userId: testUserId,
        propertyId: testPropertyId,
        eventType: EventType.VIEW,
      });
      await behaviorEventsService.trackEvent({
        userId: testUserId,
        propertyId: testPropertyId,
        eventType: EventType.SAVE,
      });
      await behaviorEventsService.trackEvent({
        userId: testUserId,
        propertyId: testPropertyId,
        eventType: EventType.DESIGN,
      });
    });

    it('should return correct counts for each event type', async () => {
      const counts = await behaviorEventsService.getEventCountsByUser(testUserId);

      expect(counts[EventType.VIEW]).toBe(2);
      expect(counts[EventType.SAVE]).toBe(1);
      expect(counts[EventType.DESIGN]).toBe(1);
      expect(counts[EventType.CALL]).toBe(0);
    });

    it('should return zero counts for user with no events', async () => {
      // Create another user
      const userResult = await query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, $3)
         RETURNING id`,
        ['test-no-counts@example.com', 'hashedpassword', 'USER']
      );
      const noEventsUserId = userResult.rows[0].id;

      const counts = await behaviorEventsService.getEventCountsByUser(noEventsUserId);

      expect(counts[EventType.VIEW]).toBe(0);
      expect(counts[EventType.SAVE]).toBe(0);
      expect(counts[EventType.DESIGN]).toBe(0);
      expect(counts[EventType.CALL]).toBe(0);

      // Clean up
      await query('DELETE FROM users WHERE id = $1', [noEventsUserId]);
    });

    it('should throw error for invalid user ID format', async () => {
      await expect(
        behaviorEventsService.getEventCountsByUser('invalid-uuid')
      ).rejects.toThrow('Invalid user ID format');
    });
  });
});
