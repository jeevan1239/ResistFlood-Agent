import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    eventType: { 
      type: String, 
      required: true,
      enum: [
        'LOGIN',
        'REPORT_SUBMITTED',
        'REPORT_VERIFIED',
        'DANGER_ZONE_CREATED',
        'DANGER_ZONE_RESOLVED',
        'SAFE_ROUTE_GENERATED',
        'RESCUE_CREATED',
        'RESCUE_CLAIMED',
        'RESCUE_COMPLETED',
        'SENSOR_THRESHOLD_EXCEEDED'
      ]
    },
    description: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    relatedObjectId: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('ActivityLog', activityLogSchema);
