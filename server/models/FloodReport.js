import mongoose from 'mongoose';

const floodReportSchema = new mongoose.Schema(
  {
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    imageUrl: { type: String, required: true },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    note: { type: String },
    ai: {
      isLikelyFlood: { type: Boolean },
      severityEstimate: { type: String, enum: ['unclear', 'minor', 'moderate', 'severe'] },
      reasoning: { type: String },
    },
    status: { type: String, enum: ['pending', 'verified', 'rejected', 'merged'], default: 'pending' },
    dangerZoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'DangerZone', default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export default mongoose.model('FloodReport', floodReportSchema);
