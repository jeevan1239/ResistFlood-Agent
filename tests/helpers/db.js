import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;

/**
 * Connect to the in-memory database.
 */
export async function connect() {
  // Prevent double connection
  if (mongoose.connection.readyState !== 0) {
    return;
  }

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  await mongoose.connect(uri, {
    autoIndex: true
  });
}

/**
 * Disconnect and close the database connection.
 */
export async function disconnect() {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
}

/**
 * Clear all data from all collections.
 */
export async function clearDatabase() {
  const collections = mongoose.connection.collections;

  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
}
