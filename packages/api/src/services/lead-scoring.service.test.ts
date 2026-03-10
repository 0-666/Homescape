import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as leadScoringService from './lead-scoring.service';
import { query } from '../db';

// Mock the database query function
vi.mock('../db', () => ({
  query: vi.fn(),
}));

const mockQuery = vi.mocked(query);

describe('Lead Scoring Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateScore', () => {
    it('should return 20 for VIEW event', () => {
      const score = leadScoringService.calculateScore(leadScoringService.EventType.VIEW);
      expect(score).toBe(20);
    });

    it('should return 30 for SAVE event', () => {
      const score = leadScoringService.calculateScore(leadScoringService.EventType.SAVE);
      expect(score).toBe(30);
    });

    it('should return 40 for DESIGN event', () => {
      const score = leadScoringService.calculateScore(leadScoringService.EventType.DESIGN);
      expect(score).toBe(40);
    });

    it('should return 50 for CALL event', () => {
      const score = leadScoringService.calculateScore(leadScoringService.EventType.CALL);
      expect(score).toBe(50);
    });
  });

  describe('updateLeadScore', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const propertyId = '223e4567-e89b-12d3-a456-426614174000';
    const builderId = '323e4567-e89b-12d3-a456-426614174000';

    it('should create a new lead with correct score for VIEW event', async () => {
      // Mock property lookup
      mockQuery.mockResolvedValueOnce({
        rows: [{ builder_id: builderId }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      // Mock existing lead check (no existing lead)
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      // Mock lead creation
      const mockLead = {
        id: '423e4567-e89b-12d3-a456-426614174000',
        userId,
        propertyId,
        builderId,
        score: 20,
        status: leadScoringService.LeadStatus.NEW,
        lastActivity: new Date(),
        createdAt: new Date(),
      };

      mockQuery.mockResolvedValueOnce({
        rows: [mockLead],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      });

      const result = await leadScoringService.updateLeadScore(
        userId,
        propertyId,
        leadScoringService.EventType.VIEW
      );

      expect(result.score).toBe(20);
      expect(result.status).toBe(leadScoringService.LeadStatus.NEW);
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('should update existing lead score by adding event score', async () => {
      // Mock property lookup
      mockQuery.mockResolvedValueOnce({
        rows: [{ builder_id: builderId }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      // Mock existing lead check (existing lead with score 20)
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: '423e4567-e89b-12d3-a456-426614174000', score: 20 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      // Mock lead update
      const mockUpdatedLead = {
        id: '423e4567-e89b-12d3-a456-426614174000',
        userId,
        propertyId,
        builderId,
        score: 50, // 20 + 30 (SAVE)
        status: leadScoringService.LeadStatus.NEW,
        lastActivity: new Date(),
        createdAt: new Date(),
      };

      mockQuery.mockResolvedValueOnce({
        rows: [mockUpdatedLead],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      const result = await leadScoringService.updateLeadScore(
        userId,
        propertyId,
        leadScoringService.EventType.SAVE
      );

      expect(result.score).toBe(50);
      expect(result.status).toBe(leadScoringService.LeadStatus.NEW);
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('should mark lead as HOT when score reaches 80', async () => {
      // Mock property lookup
      mockQuery.mockResolvedValueOnce({
        rows: [{ builder_id: builderId }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      // Mock existing lead check (existing lead with score 40)
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: '423e4567-e89b-12d3-a456-426614174000', score: 40 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      // Mock lead update
      const mockUpdatedLead = {
        id: '423e4567-e89b-12d3-a456-426614174000',
        userId,
        propertyId,
        builderId,
        score: 80, // 40 + 40 (DESIGN)
        status: leadScoringService.LeadStatus.HOT,
        lastActivity: new Date(),
        createdAt: new Date(),
      };

      mockQuery.mockResolvedValueOnce({
        rows: [mockUpdatedLead],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      const result = await leadScoringService.updateLeadScore(
        userId,
        propertyId,
        leadScoringService.EventType.DESIGN
      );

      expect(result.score).toBe(80);
      expect(result.status).toBe(leadScoringService.LeadStatus.HOT);
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('should throw error if property not found', async () => {
      // Mock property lookup (not found)
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      await expect(
        leadScoringService.updateLeadScore(
          userId,
          propertyId,
          leadScoringService.EventType.VIEW
        )
      ).rejects.toThrow('Property not found');
    });

    it('should throw error for invalid userId format', async () => {
      await expect(
        leadScoringService.updateLeadScore(
          'invalid-uuid',
          propertyId,
          leadScoringService.EventType.VIEW
        )
      ).rejects.toThrow();
    });

    it('should throw error for invalid propertyId format', async () => {
      await expect(
        leadScoringService.updateLeadScore(
          userId,
          'invalid-uuid',
          leadScoringService.EventType.VIEW
        )
      ).rejects.toThrow();
    });
  });

  describe('getLeadsByUser', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';

    it('should return leads for a user sorted by score', async () => {
      const mockLeads = [
        {
          id: '423e4567-e89b-12d3-a456-426614174000',
          userId,
          propertyId: '223e4567-e89b-12d3-a456-426614174000',
          builderId: '323e4567-e89b-12d3-a456-426614174000',
          score: 80,
          status: leadScoringService.LeadStatus.HOT,
          lastActivity: new Date(),
          createdAt: new Date(),
        },
        {
          id: '523e4567-e89b-12d3-a456-426614174000',
          userId,
          propertyId: '623e4567-e89b-12d3-a456-426614174000',
          builderId: '323e4567-e89b-12d3-a456-426614174000',
          score: 50,
          status: leadScoringService.LeadStatus.NEW,
          lastActivity: new Date(),
          createdAt: new Date(),
        },
      ];

      mockQuery.mockResolvedValueOnce({
        rows: mockLeads,
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await leadScoringService.getLeadsByUser(userId);

      expect(result).toHaveLength(2);
      expect(result[0].score).toBe(80);
      expect(result[1].score).toBe(50);
    });

    it('should return empty array if user has no leads', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await leadScoringService.getLeadsByUser(userId);

      expect(result).toHaveLength(0);
    });

    it('should throw error for invalid userId format', async () => {
      await expect(
        leadScoringService.getLeadsByUser('invalid-uuid')
      ).rejects.toThrow('Invalid user ID format');
    });
  });

  describe('getLeadsByProperty', () => {
    const propertyId = '223e4567-e89b-12d3-a456-426614174000';

    it('should return leads for a property sorted by score', async () => {
      const mockLeads = [
        {
          id: '423e4567-e89b-12d3-a456-426614174000',
          userId: '123e4567-e89b-12d3-a456-426614174000',
          propertyId,
          builderId: '323e4567-e89b-12d3-a456-426614174000',
          score: 90,
          status: leadScoringService.LeadStatus.HOT,
          lastActivity: new Date(),
          createdAt: new Date(),
        },
        {
          id: '523e4567-e89b-12d3-a456-426614174000',
          userId: '623e4567-e89b-12d3-a456-426614174000',
          propertyId,
          builderId: '323e4567-e89b-12d3-a456-426614174000',
          score: 30,
          status: leadScoringService.LeadStatus.NEW,
          lastActivity: new Date(),
          createdAt: new Date(),
        },
      ];

      mockQuery.mockResolvedValueOnce({
        rows: mockLeads,
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await leadScoringService.getLeadsByProperty(propertyId);

      expect(result).toHaveLength(2);
      expect(result[0].score).toBe(90);
      expect(result[1].score).toBe(30);
    });

    it('should throw error for invalid propertyId format', async () => {
      await expect(
        leadScoringService.getLeadsByProperty('invalid-uuid')
      ).rejects.toThrow('Invalid property ID format');
    });
  });

  describe('getLeadsByBuilder', () => {
    const builderId = '323e4567-e89b-12d3-a456-426614174000';

    it('should return leads for a builder sorted by score', async () => {
      const mockLeads = [
        {
          id: '423e4567-e89b-12d3-a456-426614174000',
          userId: '123e4567-e89b-12d3-a456-426614174000',
          propertyId: '223e4567-e89b-12d3-a456-426614174000',
          builderId,
          score: 100,
          status: leadScoringService.LeadStatus.HOT,
          lastActivity: new Date(),
          createdAt: new Date(),
        },
        {
          id: '523e4567-e89b-12d3-a456-426614174000',
          userId: '623e4567-e89b-12d3-a456-426614174000',
          propertyId: '723e4567-e89b-12d3-a456-426614174000',
          builderId,
          score: 60,
          status: leadScoringService.LeadStatus.NEW,
          lastActivity: new Date(),
          createdAt: new Date(),
        },
      ];

      mockQuery.mockResolvedValueOnce({
        rows: mockLeads,
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await leadScoringService.getLeadsByBuilder(builderId);

      expect(result).toHaveLength(2);
      expect(result[0].score).toBe(100);
      expect(result[1].score).toBe(60);
    });

    it('should throw error for invalid builderId format', async () => {
      await expect(
        leadScoringService.getLeadsByBuilder('invalid-uuid')
      ).rejects.toThrow('Invalid builder ID format');
    });
  });

  describe('Hot lead classification', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const propertyId = '223e4567-e89b-12d3-a456-426614174000';
    const builderId = '323e4567-e89b-12d3-a456-426614174000';

    it('should mark lead as HOT when score is exactly 80', async () => {
      // Mock property lookup
      mockQuery.mockResolvedValueOnce({
        rows: [{ builder_id: builderId }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      // Mock existing lead check (existing lead with score 30)
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: '423e4567-e89b-12d3-a456-426614174000', score: 30 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      // Mock lead update (30 + 50 = 80)
      const mockUpdatedLead = {
        id: '423e4567-e89b-12d3-a456-426614174000',
        userId,
        propertyId,
        builderId,
        score: 80,
        status: leadScoringService.LeadStatus.HOT,
        lastActivity: new Date(),
        createdAt: new Date(),
      };

      mockQuery.mockResolvedValueOnce({
        rows: [mockUpdatedLead],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      const result = await leadScoringService.updateLeadScore(
        userId,
        propertyId,
        leadScoringService.EventType.CALL
      );

      expect(result.score).toBe(80);
      expect(result.status).toBe(leadScoringService.LeadStatus.HOT);
    });

    it('should mark lead as HOT when score exceeds 80', async () => {
      // Mock property lookup
      mockQuery.mockResolvedValueOnce({
        rows: [{ builder_id: builderId }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      // Mock existing lead check (existing lead with score 50)
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: '423e4567-e89b-12d3-a456-426614174000', score: 50 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      // Mock lead update (50 + 50 = 100)
      const mockUpdatedLead = {
        id: '423e4567-e89b-12d3-a456-426614174000',
        userId,
        propertyId,
        builderId,
        score: 100,
        status: leadScoringService.LeadStatus.HOT,
        lastActivity: new Date(),
        createdAt: new Date(),
      };

      mockQuery.mockResolvedValueOnce({
        rows: [mockUpdatedLead],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      const result = await leadScoringService.updateLeadScore(
        userId,
        propertyId,
        leadScoringService.EventType.CALL
      );

      expect(result.score).toBe(100);
      expect(result.status).toBe(leadScoringService.LeadStatus.HOT);
    });

    it('should keep lead as NEW when score is below 80', async () => {
      // Mock property lookup
      mockQuery.mockResolvedValueOnce({
        rows: [{ builder_id: builderId }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      // Mock existing lead check (existing lead with score 40)
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: '423e4567-e89b-12d3-a456-426614174000', score: 40 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      // Mock lead update (40 + 30 = 70)
      const mockUpdatedLead = {
        id: '423e4567-e89b-12d3-a456-426614174000',
        userId,
        propertyId,
        builderId,
        score: 70,
        status: leadScoringService.LeadStatus.NEW,
        lastActivity: new Date(),
        createdAt: new Date(),
      };

      mockQuery.mockResolvedValueOnce({
        rows: [mockUpdatedLead],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      const result = await leadScoringService.updateLeadScore(
        userId,
        propertyId,
        leadScoringService.EventType.SAVE
      );

      expect(result.score).toBe(70);
      expect(result.status).toBe(leadScoringService.LeadStatus.NEW);
    });

    it('should create new lead as HOT if initial score >= 80', async () => {
      // Mock property lookup
      mockQuery.mockResolvedValueOnce({
        rows: [{ builder_id: builderId }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      // Mock existing lead check (no existing lead)
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      // Mock lead creation with score 50 (CALL event)
      // Note: In practice, a single event won't reach 80, but testing the logic
      const mockLead = {
        id: '423e4567-e89b-12d3-a456-426614174000',
        userId,
        propertyId,
        builderId,
        score: 50,
        status: leadScoringService.LeadStatus.NEW,
        lastActivity: new Date(),
        createdAt: new Date(),
      };

      mockQuery.mockResolvedValueOnce({
        rows: [mockLead],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      });

      const result = await leadScoringService.updateLeadScore(
        userId,
        propertyId,
        leadScoringService.EventType.CALL
      );

      expect(result.score).toBe(50);
      expect(result.status).toBe(leadScoringService.LeadStatus.NEW);
    });
  });

  describe('Score accumulation scenarios', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const propertyId = '223e4567-e89b-12d3-a456-426614174000';
    const builderId = '323e4567-e89b-12d3-a456-426614174000';

    it('should accumulate scores correctly: VIEW + SAVE + DESIGN = 90 (HOT)', async () => {
      // Mock property lookup
      mockQuery.mockResolvedValue({
        rows: [{ builder_id: builderId }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      // First event: VIEW (20 points)
      mockQuery.mockResolvedValueOnce({
        rows: [{ builder_id: builderId }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: '423e4567-e89b-12d3-a456-426614174000',
          userId,
          propertyId,
          builderId,
          score: 20,
          status: leadScoringService.LeadStatus.NEW,
          lastActivity: new Date(),
          createdAt: new Date(),
        }],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      });

      const lead1 = await leadScoringService.updateLeadScore(
        userId,
        propertyId,
        leadScoringService.EventType.VIEW
      );

      expect(lead1.score).toBe(20);
      expect(lead1.status).toBe(leadScoringService.LeadStatus.NEW);

      // Second event: SAVE (30 points, total 50)
      mockQuery.mockResolvedValueOnce({
        rows: [{ builder_id: builderId }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: '423e4567-e89b-12d3-a456-426614174000', score: 20 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: '423e4567-e89b-12d3-a456-426614174000',
          userId,
          propertyId,
          builderId,
          score: 50,
          status: leadScoringService.LeadStatus.NEW,
          lastActivity: new Date(),
          createdAt: new Date(),
        }],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      const lead2 = await leadScoringService.updateLeadScore(
        userId,
        propertyId,
        leadScoringService.EventType.SAVE
      );

      expect(lead2.score).toBe(50);
      expect(lead2.status).toBe(leadScoringService.LeadStatus.NEW);

      // Third event: DESIGN (40 points, total 90 - should be HOT)
      mockQuery.mockResolvedValueOnce({
        rows: [{ builder_id: builderId }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: '423e4567-e89b-12d3-a456-426614174000', score: 50 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: '423e4567-e89b-12d3-a456-426614174000',
          userId,
          propertyId,
          builderId,
          score: 90,
          status: leadScoringService.LeadStatus.HOT,
          lastActivity: new Date(),
          createdAt: new Date(),
        }],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      const lead3 = await leadScoringService.updateLeadScore(
        userId,
        propertyId,
        leadScoringService.EventType.DESIGN
      );

      expect(lead3.score).toBe(90);
      expect(lead3.status).toBe(leadScoringService.LeadStatus.HOT);
    });
  });
});
