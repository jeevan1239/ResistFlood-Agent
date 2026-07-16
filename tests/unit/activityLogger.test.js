import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import * as db from '../helpers/db.js';
import User from '../../server/models/User.js';
import ActivityLog from '../../server/models/ActivityLog.js';
import { logActivity } from '../../server/services/activityLogger.js';
import { makeUser } from '../helpers/demo.js';

// Mock Socket.io service
const mockEmit = vi.fn();
vi.mock('../../server/services/socket.js', () => ({
  getIo: () => ({
    emit: mockEmit
  }),
  initSocket: vi.fn(),
  connectedClientsCount: 0
}));

describe('Activity Logger Unit Tests', () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.clearDatabase();
    mockEmit.mockClear();
  });

  it('should successfully save activity logs to database', async () => {
    const log = await logActivity({
      eventType: 'REPORT_SUBMITTED',
      description: 'A flood report was submitted.',
      relatedObjectId: 'report-123'
    });

    expect(log).toBeDefined();
    expect(log.eventType).toBe('REPORT_SUBMITTED');
    expect(log.description).toBe('A flood report was submitted.');
    expect(log.relatedObjectId).toBe('report-123');

    // Confirm stored in DB
    const savedLog = await ActivityLog.findById(log._id);
    expect(savedLog).not.toBeNull();
    expect(savedLog.eventType).toBe('REPORT_SUBMITTED');
  });

  it('should populate user information on the activity log', async () => {
    // 1. Create a user
    const user = await User.create(makeUser({
      name: 'Logged-in User',
      email: 'logger@example.com'
    }));

    // 2. Log activity referencing the user
    const log = await logActivity({
      eventType: 'LOGIN',
      description: 'User logged in',
      userId: user._id
    });

    expect(log.userId).toBeDefined();
    expect(log.userId.name).toBe('Logged-in User');
    expect(log.userId.email).toBe('logger@example.com');
    expect(log.userId.role).toBe('citizen');
  });

  it('should emit a realtime socket notification event on log creation', async () => {
    const log = await logActivity({
      eventType: 'SAFE_ROUTE_GENERATED',
      description: 'A safe route was generated.'
    });

    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith('notification', expect.any(Object));
    
    // Verify first argument is the log object
    const emittedLog = mockEmit.mock.calls[0][1];
    expect(emittedLog._id.toString()).toBe(log._id.toString());
  });

  it('should swallow invalid event validation errors without writing or emitting', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const log = await logActivity({
      eventType: 'INVALID_EVENT',
      description: 'This event is not allowed by the schema.'
    });

    expect(log).toBeUndefined();
    expect(await ActivityLog.countDocuments()).toBe(0);
    expect(mockEmit).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      '[ActivityLogger] Failed to log activity:',
      expect.any(mongoose.Error.ValidationError)
    );

    consoleSpy.mockRestore();
  });
});
