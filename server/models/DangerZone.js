import mongoose from 'mongoose';

const dangerZoneSchema = new mongoose.Schema(
  {
    center: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    radiusMeters: { type: Number, required: true },
    severity: { type: String, enum: ['minor', 'moderate', 'severe', 'critical'], required: true },
    sourceReportIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FloodReport' }],
    sourceReadingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SensorReading' }],
    status: { type: String, enum: ['active', 'resolved'], default: 'active' },
  },
  { timestamps: true }
);

export default mongoose.model('DangerZone', dangerZoneSchema);
