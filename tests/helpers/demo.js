/**
 * Demo Data Helper
 * Provides factory functions to generate mock document payloads for tests.
 */

// A pre-computed bcrypt hash for the password 'password123'
export const TEST_PASSWORD_HASH = '$2b$10$X8H.hW7WbS9Fq6EEX8YIeO.xMh/70Q.x99p28tHwH74d/d8P.EFe6';

export function makeUser(overrides = {}) {
  const seed = Math.floor(Math.random() * 100000);
  return {
    name: 'Test Citizen',
    email: `citizen-${seed}@example.com`,
    passwordHash: TEST_PASSWORD_HASH,
    role: 'citizen',
    phone: '+919876543210',
    preferredLanguage: 'en',
    ...overrides
  };
}

export function makeSensorReading(overrides = {}) {
  const seed = Math.floor(Math.random() * 1000);
  return {
    deviceId: `sim-sensor-${seed}`,
    location: {
      lat: 12.9166 + (Math.random() - 0.5) * 0.05,
      lng: 77.6228 + (Math.random() - 0.5) * 0.05
    },
    waterLevelCm: 12.5,
    source: 'simulated',
    recordedAt: new Date(),
    ...overrides
  };
}

export function makeFloodReport(overrides = {}) {
  return {
    reportedBy: null,
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/v12345/sample.jpg',
    location: {
      lat: 12.9304,
      lng: 77.6784
    },
    note: 'Water level is rising near the main street.',
    ai: {
      isLikelyFlood: true,
      severityEstimate: 'moderate',
      reasoning: 'Image shows clear water accumulation on the street.'
    },
    status: 'pending',
    dangerZoneId: null,
    createdAt: new Date(),
    ...overrides
  };
}

export function makeDangerZone(overrides = {}) {
  return {
    center: {
      lat: 12.9304,
      lng: 77.6784
    },
    radiusMeters: 300,
    severity: 'moderate',
    sourceReportIds: [],
    sourceReadingIds: [],
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

export function makeVulnerablePerson(overrides = {}) {
  return {
    name: 'Elderly Resident',
    age: 78,
    medicalConditions: ['Hypertension', 'Arthritis'],
    mobilityIssues: true,
    contactNumber: '+919876543210',
    location: {
      lat: 12.9310,
      lng: 77.6790,
      address: '123 Main Street, Bellandur, Bengaluru'
    },
    emergencyContact: {
      name: 'Jane Doe',
      phone: '+919998887776'
    },
    lastCheckIn: new Date(),
    ...overrides
  };
}

export function makeRescueTask(overrides = {}) {
  return {
    personId: null, // should be filled with VulnerablePerson ID
    dangerZoneId: null,
    status: 'pending',
    priorityScore: 0.5,
    assignedTo: null,
    notes: 'Needs immediate evacuation due to rising waters.',
    ...overrides
  };
}
