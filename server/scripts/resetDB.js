import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';

async function reset() {
  console.log('[Reset] Starting database reset...');
  await connectDB();

  if (mongoose.connection.readyState === 0) {
    console.error('[Reset] Database connection failed. Aborting reset.');
    process.exit(1);
  }

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  console.log(`[Reset] Found ${collections.length} collections. Clearing documents...`);

  for (const colInfo of collections) {
    const colName = colInfo.name;
    // Skip system/index collections if any
    if (colName.startsWith('system.')) continue;
    
    console.log(`[Reset] Clearing collection: ${colName}...`);
    await db.collection(colName).deleteMany({});
  }

  console.log('[Reset] Database reset completed successfully. All collections cleared.');
  await mongoose.disconnect();
}

reset().catch(async (err) => {
  console.error('[Reset] Database reset error:', err);
  await mongoose.disconnect();
  process.exit(1);
});
