import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn('[DB] MONGODB_URI is not set — skipping database connection.');
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log('[DB] Connected to MongoDB.');
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    // Don't crash — app continues without DB
  }
}
