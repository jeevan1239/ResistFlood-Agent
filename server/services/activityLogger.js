import ActivityLog from '../models/ActivityLog.js';
import { getIo } from './socket.js';

export async function logActivity({ eventType, description, userId = null, relatedObjectId = null }) {
  try {
    const log = await ActivityLog.create({
      eventType,
      description,
      userId,
      relatedObjectId
    });

    // We populate the user details for the frontend to show names if needed
    const populatedLog = await ActivityLog.findById(log._id).populate('userId', 'name email role');

    // Emit realtime notification to all clients, especially admins
    getIo().emit('notification', populatedLog);

    return populatedLog;
  } catch (err) {
    console.error('[ActivityLogger] Failed to log activity:', err);
  }
}
