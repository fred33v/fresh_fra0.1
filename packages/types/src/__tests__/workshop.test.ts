import { describe, it, expect } from 'vitest';
import type {
  WorkshopSession,
  SessionParticipant,
  WorkshopSSEEvent,
  SessionCode,
} from '../workshop';

describe('Workshop Types', () => {
  describe('WorkshopSession', () => {
    it('has all required properties for a live session', () => {
      const session: WorkshopSession = {
        id: 'ws-123',
        sessionCode: 'ABC123',
        title: 'Fraud Risk Awareness Training',
        description: 'Monthly fraud awareness session',
        organisationId: 'org-123',
        facilitatorId: 'user-456',
        currentSlide: 3,
        totalSlides: 7,
        isActive: true,
        startedAt: '2026-03-08T10:00:00Z',
        participantCount: 12,
        createdAt: '2026-03-08T09:00:00Z',
        updatedAt: '2026-03-08T10:15:00Z',
      };

      expect(session.id).toBeDefined();
      expect(session.sessionCode).toBeDefined();
      expect(session.isActive).toBe(true);
      expect(session.currentSlide).toBeLessThanOrEqual(session.totalSlides);
      expect(session.participantCount).toBeGreaterThanOrEqual(0);
    });

    it('can be inactive with endedAt timestamp', () => {
      const session: WorkshopSession = {
        id: 'ws-123',
        sessionCode: 'ABC123',
        title: 'Fraud Risk Awareness Training',
        organisationId: 'org-123',
        facilitatorId: 'user-456',
        currentSlide: 7,
        totalSlides: 7,
        isActive: false,
        startedAt: '2026-03-08T10:00:00Z',
        endedAt: '2026-03-08T11:00:00Z',
        participantCount: 12,
        createdAt: '2026-03-08T09:00:00Z',
        updatedAt: '2026-03-08T11:00:00Z',
      };

      expect(session.isActive).toBe(false);
      expect(session.endedAt).toBeDefined();
    });
  });

  describe('SessionParticipant', () => {
    it('tracks participant details and activity', () => {
      const participant: SessionParticipant = {
        id: 'sp-789',
        sessionId: 'ws-123',
        userId: 'user-999',
        email: 'john@company.com',
        name: 'John Smith',
        joinedAt: '2026-03-08T10:05:00Z',
        hasRaisedHand: true,
        lastActivityAt: '2026-03-08T10:30:00Z',
      };

      expect(participant.joinedAt).toBeDefined();
      expect(participant.lastActivityAt).toBeDefined();
      expect(typeof participant.hasRaisedHand).toBe('boolean');
    });

    it('tracks session exit with leftAt', () => {
      const participant: SessionParticipant = {
        id: 'sp-789',
        sessionId: 'ws-123',
        userId: 'user-999',
        email: 'john@company.com',
        name: 'John Smith',
        joinedAt: '2026-03-08T10:05:00Z',
        leftAt: '2026-03-08T11:00:00Z',
        hasRaisedHand: false,
        lastActivityAt: '2026-03-08T11:00:00Z',
      };

      expect(participant.leftAt).toBeDefined();
    });
  });

  describe('WorkshopSSEEvent', () => {
    it('emits slide changed event', () => {
      const event: WorkshopSSEEvent = {
        event: 'slide_changed',
        timestamp: '2026-03-08T10:15:00Z',
        data: { slide: 3, title: 'Types of Fraud' },
      };

      expect(event.event).toBe('slide_changed');
      expect(event.data.slide).toBeDefined();
    });

    it('emits participant activity events', () => {
      const joinedEvent: WorkshopSSEEvent = {
        event: 'participant_joined',
        timestamp: '2026-03-08T10:05:00Z',
        data: { name: 'Jane Doe', participantCount: 12 },
      };

      const handRaisedEvent: WorkshopSSEEvent = {
        event: 'hand_raised',
        timestamp: '2026-03-08T10:20:00Z',
        data: { participantId: 'sp-789', name: 'John Smith' },
      };

      expect(['participant_joined', 'participant_left', 'hand_raised', 'slide_changed', 'session_ended']).toContain(
        joinedEvent.event
      );
      expect(handRaisedEvent.data).toBeDefined();
    });
  });

  describe('SessionCode', () => {
    it('validates session code expiry and attempts', () => {
      const code: SessionCode = {
        code: 'ABC123',
        sessionId: 'ws-123',
        expiresAt: '2026-03-09T10:00:00Z',
        maxAttempts: 5,
        attemptCount: 2,
        isValid: true,
      };

      expect(code.attemptCount).toBeLessThanOrEqual(code.maxAttempts);
      expect(typeof code.isValid).toBe('boolean');
    });

    it('marks code invalid after max attempts exceeded', () => {
      const expiredCode: SessionCode = {
        code: 'ABC123',
        sessionId: 'ws-123',
        expiresAt: '2026-03-07T10:00:00Z',
        maxAttempts: 5,
        attemptCount: 5,
        isValid: false,
      };

      expect(expiredCode.attemptCount).toBe(expiredCode.maxAttempts);
      expect(expiredCode.isValid).toBe(false);
    });
  });
});
