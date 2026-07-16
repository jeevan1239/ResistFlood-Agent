import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import SensorReading from '../models/SensorReading.js';
import DangerZone from '../models/DangerZone.js';
import Shelter from '../models/Shelter.js';
import VulnerablePerson from '../models/VulnerablePerson.js';
import RescueTask from '../models/RescueTask.js';
import { TEST_PASSWORD_HASH } from '../../tests/helpers/demo.js';

async function seed() {
  console.log('[Seed] Starting database seeding...');
  await connectDB();

  if (mongoose.connection.readyState === 0) {
    console.error('[Seed] Database connection failed. Aborting seed.');
    process.exit(1);
  }

  // 1. Clear existing data (optional, but good for reset-and-seed)
  console.log('[Seed] Clearing existing Users, SensorReadings, DangerZones, VulnerablePeople, and RescueTasks...');
  await User.deleteMany({});
  await SensorReading.deleteMany({});
  await DangerZone.deleteMany({});
  await VulnerablePerson.deleteMany({});
  await RescueTask.deleteMany({});

  // 2. Create Users
  console.log('[Seed] Creating demo users...');
  const users = await User.insertMany([
    {
      name: 'Aditi Sharma',
      email: 'aditi@example.com',
      passwordHash: TEST_PASSWORD_HASH,
      role: 'citizen',
      phone: '+919876543210',
      preferredLanguage: 'en'
    },
    {
      name: 'Rohan Murthy',
      email: 'rohan@example.com',
      passwordHash: TEST_PASSWORD_HASH,
      role: 'volunteer',
      phone: '+918765432109',
      preferredLanguage: 'en'
    },
    {
      name: 'Kiran Kumar',
      email: 'kiran@example.com',
      passwordHash: TEST_PASSWORD_HASH,
      role: 'authority',
      phone: '+917654321098',
      preferredLanguage: 'kn'
    },
    {
      name: 'Admin User',
      email: 'admin@example.com',
      passwordHash: TEST_PASSWORD_HASH,
      role: 'admin',
      phone: '+919999999999',
      preferredLanguage: 'en'
    }
  ]);
  console.log(`[Seed] Seeded ${users.length} users.`);

  // 3. Create Sensor Readings
  console.log('[Seed] Seeding initial sensor readings...');
  const readings = await SensorReading.insertMany([
    {
      deviceId: 'sim-silkboard-01',
      location: { lat: 12.9166, lng: 77.6228 },
      waterLevelCm: 42.0, // High/Severe
      source: 'simulated',
      recordedAt: new Date()
    },
    {
      deviceId: 'sim-bellandur-01',
      location: { lat: 12.9304, lng: 77.6784 },
      waterLevelCm: 18.0, // Moderate
      source: 'simulated',
      recordedAt: new Date()
    },
    {
      deviceId: 'sim-krpuram-01',
      location: { lat: 13.0088, lng: 77.6959 },
      waterLevelCm: 8.5, // Low
      source: 'simulated',
      recordedAt: new Date()
    },
    {
      deviceId: 'sim-sarjapur-01',
      location: { lat: 12.9008, lng: 77.6885 },
      waterLevelCm: 5.0, // Low
      source: 'simulated',
      recordedAt: new Date()
    }
  ]);
  console.log(`[Seed] Seeded ${readings.length} sensor readings.`);

  // 4. Create a Danger Zone
  console.log('[Seed] Seeding a danger zone...');
  const dangerZone = await DangerZone.create({
    center: { lat: 12.9166, lng: 77.6228 }, // Silk board
    radiusMeters: 350,
    severity: 'severe',
    sourceReadingIds: [readings[0]._id],
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  console.log(`[Seed] Seeded active danger zone at Silk Board Junction (ID: ${dangerZone._id}).`);

  // 5. Create Vulnerable Residents
  console.log('[Seed] Seeding vulnerable residents...');
  const vulnerablePeople = await VulnerablePerson.insertMany([
    {
      name: 'Ranganathan Swamy',
      age: 82,
      medicalConditions: ['Hypertension'],
      mobilityIssues: true,
      contactNumber: '+919845012345',
      location: {
        lat: 12.9172,
        lng: 77.6235,
        address: 'HSR Layout, Bengaluru'
      },
      emergencyContact: {
        name: 'Suresh Swamy',
        phone: '+919845012340'
      },
      lastCheckIn: new Date(Date.now() - 3 * 3600 * 1000) // 3 hours ago
    },
    {
      name: 'Gowramma K.',
      age: 76,
      medicalConditions: ['Visually Impaired'],
      mobilityIssues: false,
      contactNumber: '+919845054321',
      location: {
        lat: 12.9315,
        lng: 77.6790,
        address: 'Bellandur Main Road, Bengaluru'
      },
      emergencyContact: {
        name: 'Kavitha K.',
        phone: '+919845054320'
      },
      lastCheckIn: new Date()
    }
  ]);
  console.log(`[Seed] Seeded ${vulnerablePeople.length} vulnerable people.`);

  // 6. Create Rescue Tasks with calculated priorities
  console.log('[Seed] Seeding rescue queue tasks...');
  const task1 = await RescueTask.create({
    personId: vulnerablePeople[0]._id,
    dangerZoneId: dangerZone._id,
    status: 'pending',
    priorityScore: 0.85,
    assignedTo: null,
    notes: 'Wheelchair user, ground floor, needs assistance getting to vehicle.'
  });

  const task2 = await RescueTask.create({
    personId: vulnerablePeople[1]._id,
    dangerZoneId: null,
    status: 'pending',
    priorityScore: 0.22,
    assignedTo: null,
    notes: 'Visually impaired, lives on 3rd floor. High priority if water levels rise.'
  });
  console.log(`[Seed] Seeded ${[task1, task2].length} rescue queue tasks.`);

  // 7. Make sure Shelters exist (seeded by server/routes/shelters.js import on route hit, but we can verify it here)
  const shelterCount = await Shelter.countDocuments();
  if (shelterCount === 0) {
    await Shelter.insertMany([
      { name: 'Kanteerava Stadium Relief Camp', location: { lat: 12.9696, lng: 77.5937 }, capacity: 500, isActive: true },
      { name: 'National College Basavanagudi Shelter', location: { lat: 12.9461, lng: 77.5739 }, capacity: 200, isActive: true },
      { name: 'Indiranagar Community Hall', location: { lat: 12.9783, lng: 77.6408 }, capacity: 150, isActive: true },
      { name: 'Yeshwanthpur Govt School Camp', location: { lat: 13.0232, lng: 77.5385 }, capacity: 300, isActive: true }
    ]);
    console.log('[Seed] Seeded initial shelters.');
  }

  console.log('[Seed] Database seeding completed successfully.');
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('[Seed] Seeding error:', err);
  await mongoose.disconnect();
  process.exit(1);
});
