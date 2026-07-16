import mongoose from 'mongoose';

const rescueTaskSchema = new mongoose.Schema(
  {
    personId: { type: mongoose.Schema.Types.ObjectId, ref: 'VulnerablePerson', required: true },
    dangerZoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'DangerZone', default: null },
    status: { type: String, enum: ['pending', 'assigned', 'rescued', 'cancelled'], default: 'pending' },
    priorityScore: { type: Number, default: 0 },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Rescue personnel
    notes: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model('RescueTask', rescueTaskSchema);
