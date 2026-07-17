import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: { type: String, required: true },
  role: {
    type: String,
    enum: ['citizen', 'volunteer', 'authority', 'admin'],
    default: 'citizen',
  },
  phone: { type: String },
  preferredLanguage: { type: String, default: 'en' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('User', userSchema);
