import mongoose from 'mongoose';

const sensorReadingSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    waterLevelCm: {
      type: Number,
      required: true,
      min: 0,
    },
    source: {
      type: String,
      enum: ['simulated', 'hardware'],
      default: 'simulated',
    },
    recordedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: false }
);

export default mongoose.model('SensorReading', sensorReadingSchema);
