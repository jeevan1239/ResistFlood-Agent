import mongoose from 'mongoose';

const vulnerablePersonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    age: { type: Number, required: true },
    medicalConditions: [{ type: String }],
    mobilityIssues: { type: Boolean, default: false },
    contactNumber: { type: String, required: true },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String },
    },
    emergencyContact: {
      name: { type: String },
      phone: { type: String },
    },
    lastCheckIn: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.model('VulnerablePerson', vulnerablePersonSchema);
