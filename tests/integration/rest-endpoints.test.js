import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';

vi.mock('../../server/services/socket.js', () => ({
  connectedClientsCount: 0,
  getIo: vi.fn(() => ({ emit: vi.fn() })),
  initSocket: vi.fn(),
}));

vi.mock('../../server/services/gemini.js', () => ({
  verifyFloodImage: vi.fn().mockResolvedValue({
    isLikelyFlood: true,
    severityEstimate: 'moderate',
    reasoning: 'Mocked flood verification.',
  }),
  summarizeRoute: vi.fn().mockResolvedValue('Mocked safe route summary.'),
  geminiStatus: {
    configured: true,
    lastSuccessfulCall: new Date('2026-01-01T00:00:00.000Z'),
    lastError: null,
  },
}));

import app from '../../server/app.js';
import * as db from '../helpers/db.js';
import { getDummyImageBuffer } from '../helpers/upload.js';
import { generateTestToken, getAuthHeader } from '../helpers/auth.js';
import { verifyFloodImage, summarizeRoute } from '../../server/services/gemini.js';
import User from '../../server/models/User.js';
import FloodReport from '../../server/models/FloodReport.js';
import SensorReading from '../../server/models/SensorReading.js';
import DangerZone from '../../server/models/DangerZone.js';
import Shelter from '../../server/models/Shelter.js';
import VulnerablePerson from '../../server/models/VulnerablePerson.js';
import RescueTask from '../../server/models/RescueTask.js';
import ActivityLog from '../../server/models/ActivityLog.js';

const validUser = {
  name: 'Asha Rao',
  email: 'asha@example.com',
  password: 'password123',
  role: 'citizen',
  phone: '+919999999999',
  preferredLanguage: 'kn',
};

function expectMongoId(value) {
  expect(value).toEqual(expect.stringMatching(/^[a-f\d]{24}$/i));
}

async function createUser(overrides = {}) {
  const password = overrides.password || 'password123';
  const user = await User.create({
    name: overrides.name || 'Test User',
    email: overrides.email || `user-${Date.now()}-${Math.random()}@example.com`,
    passwordHash: await bcrypt.hash(password, 4),
    role: overrides.role || 'citizen',
    phone: overrides.phone || '+910000000000',
    preferredLanguage: overrides.preferredLanguage || 'en',
  });
  const token = generateTestToken({ id: user._id });
  return { user, token, authHeader: getAuthHeader(token), password };
}

async function createRescueTask() {
  const person = await VulnerablePerson.create({
    name: 'Meera Iyer',
    age: 78,
    medicalConditions: ['diabetes'],
    mobilityIssues: true,
    contactNumber: '+918888888888',
    location: { lat: 12.97, lng: 77.59, address: 'MG Road' },
    emergencyContact: { name: 'Ravi', phone: '+917777777777' },
  });
  const task = await RescueTask.create({ personId: person._id, priorityScore: 4.2 });
  return { person, task };
}

function mockOsrm(routes) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ code: 'Ok', routes }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const osrmRoute = {
  geometry: {
    type: 'LineString',
    coordinates: [[77.5937, 12.9696], [77.6228, 12.9166]],
  },
  distance: 1500,
  duration: 300,
  legs: [{
    steps: [
      { maneuver: { type: 'depart' }, name: 'Main Road' },
      { maneuver: { type: 'turn' }, name: 'Hosur Road' },
    ],
  }],
};

describe('REST endpoint integration tests', () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = 'dev-secret-change-me';
    await db.connect();
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.clearDatabase();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('GET /api/health', () => {
    it('returns the health schema without auth', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('POST /api/auth/register', () => {
    it('creates a user and returns an auth response schema', async () => {
      const res = await request(app).post('/api/auth/register').send(validUser);

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        token: expect.any(String),
        user: {
          id: expect.any(String),
          name: validUser.name,
          email: validUser.email,
          role: validUser.role,
          preferredLanguage: validUser.preferredLanguage,
        },
      });
      expectMongoId(res.body.user.id);

      const persisted = await User.findOne({ email: validUser.email });
      expect(persisted).toMatchObject({
        name: validUser.name,
        email: validUser.email,
        role: validUser.role,
        preferredLanguage: validUser.preferredLanguage,
      });
      expect(persisted.passwordHash).not.toBe(validUser.password);
    });

    it('rejects missing required fields and duplicate emails', async () => {
      const invalid = await request(app).post('/api/auth/register').send({ email: 'bad@example.com' });
      expect(invalid.status).toBe(400);
      expect(invalid.body).toEqual({ error: expect.any(String) });

      await request(app).post('/api/auth/register').send(validUser);
      const duplicate = await request(app).post('/api/auth/register').send(validUser);
      expect(duplicate.status).toBe(409);
      expect(duplicate.body).toEqual({ error: expect.any(String) });
      expect(await User.countDocuments({ email: validUser.email })).toBe(1);
    });
  });

  describe('POST /api/auth/login', () => {
    it('authenticates and writes a login activity log', async () => {
      await createUser({ email: validUser.email, password: validUser.password, name: validUser.name });

      const res = await request(app).post('/api/auth/login').send({
        email: validUser.email,
        password: validUser.password,
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        token: expect.any(String),
        user: expect.objectContaining({
          id: expect.any(String),
          email: validUser.email,
          name: validUser.name,
          role: 'citizen',
        }),
      });
      expect(await ActivityLog.countDocuments({ eventType: 'LOGIN' })).toBe(1);
    });

    it('validates credentials', async () => {
      const missing = await request(app).post('/api/auth/login').send({ email: validUser.email });
      expect(missing.status).toBe(400);

      const bad = await request(app).post('/api/auth/login').send({
        email: validUser.email,
        password: 'wrong',
      });
      expect(bad.status).toBe(401);
      expect(bad.body).toEqual({ error: expect.any(String) });
    });
  });

  describe('GET /api/auth/me', () => {
    it('requires auth and returns the current user schema', async () => {
      const noToken = await request(app).get('/api/auth/me');
      expect(noToken.status).toBe(401);

      const { authHeader, user } = await createUser({ role: 'volunteer' });
      const res = await request(app).get('/api/auth/me').set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: 'volunteer',
        phone: user.phone,
        preferredLanguage: user.preferredLanguage,
        createdAt: expect.any(String),
      });
    });
  });

  describe('POST /api/sensors/reading and GET /api/sensors/latest', () => {
    it('ingests sensor readings, persists them, and returns latest readings by device', async () => {
      const payload = {
        deviceId: 'sensor-1',
        location: { lat: 12.97, lng: 77.59 },
        waterLevelCm: 42,
        source: 'hardware',
      };

      const createRes = await request(app).post('/api/sensors/reading').send(payload);
      expect(createRes.status).toBe(201);
      expect(createRes.body).toEqual(expect.objectContaining({
        _id: expect.any(String),
        ...payload,
        recordedAt: expect.any(String),
      }));
      expect(await SensorReading.countDocuments({ deviceId: 'sensor-1' })).toBe(1);

      await request(app).post('/api/sensors/reading').send({
        ...payload,
        waterLevelCm: 12,
      });
      const latest = await request(app).get('/api/sensors/latest');

      expect(latest.status).toBe(200);
      expect(latest.body).toEqual([
        expect.objectContaining({
          deviceId: 'sensor-1',
          location: payload.location,
          waterLevelCm: 12,
          source: 'hardware',
          recordedAt: expect.any(String),
        }),
      ]);
    });

    it('validates required reading fields and is public', async () => {
      const invalid = await request(app).post('/api/sensors/reading').send({ deviceId: 'sensor-1' });
      expect(invalid.status).toBe(400);
      expect(invalid.body).toEqual({ error: expect.any(String) });

      const publicRes = await request(app).get('/api/sensors/latest');
      expect(publicRes.status).toBe(200);
      expect(publicRes.body).toEqual([]);
    });
  });

  describe('POST /api/reports and GET /api/reports', () => {
    it('creates an authenticated flood report, mocks Gemini, and persists the report', async () => {
      const { authHeader, user } = await createUser();

      const res = await request(app)
        .post('/api/reports')
        .set(authHeader)
        .field('lat', '12.9696')
        .field('lng', '77.5937')
        .field('note', 'Water rising near the underpass')
        .attach('image', getDummyImageBuffer(), 'flood.png');

      expect(res.status).toBe(201);
      expect(res.body).toEqual(expect.objectContaining({
        _id: expect.any(String),
        reportedBy: user._id.toString(),
        imageUrl: expect.stringMatching(/^\/uploads\/.+\.png$/),
        location: { lat: 12.9696, lng: 77.5937 },
        note: 'Water rising near the underpass',
        ai: {
          isLikelyFlood: true,
          severityEstimate: 'moderate',
          reasoning: 'Mocked flood verification.',
        },
        status: 'pending',
        createdAt: expect.any(String),
      }));
      expect(verifyFloodImage).toHaveBeenCalledOnce();

      const persisted = await FloodReport.findById(res.body._id);
      expect(persisted.reportedBy.toString()).toBe(user._id.toString());
      expect(persisted.status).toBe('pending');
    });

    it('validates multipart input and supports public filtered reads', async () => {
      const invalid = await request(app)
        .post('/api/reports')
        .field('lat', '12.9696')
        .field('lng', '77.5937');
      expect(invalid.status).toBe(400);

      await FloodReport.create({
        imageUrl: '/uploads/rejected.png',
        location: { lat: 1, lng: 2 },
        ai: { isLikelyFlood: false, severityEstimate: 'unclear', reasoning: 'No flood' },
        status: 'rejected',
      });
      await FloodReport.create({
        imageUrl: '/uploads/pending.png',
        location: { lat: 3, lng: 4 },
        ai: { isLikelyFlood: true, severityEstimate: 'minor', reasoning: 'Flood' },
        status: 'pending',
      });

      const res = await request(app).get('/api/reports').query({ status: 'rejected' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toEqual(expect.objectContaining({
        _id: expect.any(String),
        imageUrl: '/uploads/rejected.png',
        location: { lat: 1, lng: 2 },
        status: 'rejected',
        createdAt: expect.any(String),
      }));
    });
  });

  describe('GET /api/danger-zones/active', () => {
    it('returns only active danger zones with schema', async () => {
      await DangerZone.create([
        { center: { lat: 12.97, lng: 77.59 }, radiusMeters: 300, severity: 'severe', status: 'active' },
        { center: { lat: 12.98, lng: 77.60 }, radiusMeters: 200, severity: 'minor', status: 'resolved' },
      ]);

      const res = await request(app).get('/api/danger-zones/active');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toEqual(expect.objectContaining({
        _id: expect.any(String),
        center: { lat: 12.97, lng: 77.59 },
        radiusMeters: 300,
        severity: 'severe',
        status: 'active',
        sourceReportIds: [],
        sourceReadingIds: [],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }));
    });
  });

  describe('GET /api/shelters', () => {
    it('returns only active shelters with schema', async () => {
      await Shelter.create([
        { name: 'Active Shelter', location: { lat: 12.9, lng: 77.5 }, capacity: 100, isActive: true },
        { name: 'Closed Shelter', location: { lat: 13.0, lng: 77.6 }, capacity: 50, isActive: false },
      ]);

      const res = await request(app).get('/api/shelters');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toEqual(expect.objectContaining({
        _id: expect.any(String),
        name: 'Active Shelter',
        location: { lat: 12.9, lng: 77.5 },
        capacity: 100,
        currentOccupancy: 0,
        isActive: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }));
    });
  });

  describe('GET /api/navigate', () => {
    it('mocks OSRM and Gemini, scores routes, and writes an activity log', async () => {
      await DangerZone.create({
        center: { lat: 12.97, lng: 77.60 },
        radiusMeters: 100,
        severity: 'critical',
        status: 'active',
      });
      const fetchMock = mockOsrm([osrmRoute, { ...osrmRoute, distance: 2000 }]);

      const res = await request(app).get('/api/navigate').query({
        start: '77.5937,12.9696',
        end: '77.6228,12.9166',
      });

      expect(res.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(summarizeRoute).toHaveBeenCalledOnce();
      expect(res.body).toEqual({
        recommendedRoute: expect.objectContaining({
          geometry: osrmRoute.geometry,
          distance: 1500,
          duration: 300,
          dangerScore: expect.any(Number),
          isSafe: expect.any(Boolean),
          caution: expect.any(Boolean),
          summary: 'Mocked safe route summary.',
        }),
        alternatives: [expect.objectContaining({
          distance: 2000,
          dangerScore: expect.any(Number),
          isSafe: expect.any(Boolean),
        })],
      });
      expect(await ActivityLog.countDocuments({ eventType: 'SAFE_ROUTE_GENERATED' })).toBe(1);
    });

    it('validates query parameters and handles no-route responses', async () => {
      const invalid = await request(app).get('/api/navigate').query({ start: '77,12' });
      expect(invalid.status).toBe(400);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: async () => ({ code: 'NoRoute', routes: [] }),
      }));
      const noRoute = await request(app).get('/api/navigate').query({
        start: '77.5937,12.9696',
        end: '77.6228,12.9166',
      });
      expect(noRoute.status).toBe(404);
      expect(noRoute.body).toEqual({ error: expect.any(String) });
    });
  });

  describe('POST /api/rescue/register and GET /api/rescue/queue', () => {
    it('registers a vulnerable person, creates a prioritized task, and returns queue schema', async () => {
      const { authHeader } = await createUser({ role: 'citizen' });
      const { authHeader: queueAuthHeader } = await createUser({ role: 'volunteer' });
      await DangerZone.create({
        center: { lat: 12.97, lng: 77.59 },
        radiusMeters: 300,
        severity: 'severe',
        status: 'active',
      });

      const payload = {
        name: 'Lakshmi Nair',
        age: 82,
        medicalConditions: ['asthma'],
        mobilityIssues: true,
        contactNumber: '+916666666666',
        location: { lat: 12.9701, lng: 77.5901, address: 'Near lake road' },
        emergencyContact: { name: 'Anu', phone: '+915555555555' },
      };

      const res = await request(app).post('/api/rescue/register').set(authHeader).send(payload);

      expect(res.status).toBe(201);
      expect(res.body.person).toEqual(expect.objectContaining({
        _id: expect.any(String),
        name: payload.name,
        age: payload.age,
        medicalConditions: payload.medicalConditions,
        mobilityIssues: true,
        contactNumber: payload.contactNumber,
        location: payload.location,
        emergencyContact: payload.emergencyContact,
        lastCheckIn: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }));
      expect(res.body.task).toEqual(expect.objectContaining({
        _id: expect.any(String),
        personId: expect.objectContaining({
          _id: res.body.person._id,
          name: payload.name,
        }),
        status: 'pending',
        priorityScore: expect.any(Number),
      }));
      expect(await VulnerablePerson.countDocuments()).toBe(1);
      expect(await RescueTask.countDocuments()).toBe(1);

      const queue = await request(app).get('/api/rescue/queue').set(queueAuthHeader);
      expect(queue.status).toBe(200);
      expect(queue.body).toHaveLength(1);
      expect(queue.body[0]).toEqual(expect.objectContaining({
        _id: res.body.task._id,
        personId: expect.objectContaining({ name: payload.name }),
        status: 'pending',
        priorityScore: expect.any(Number),
      }));
    });

    it('surfaces schema validation failures for invalid registration data', async () => {
      const { authHeader } = await createUser({ role: 'citizen' });
      const invalid = await request(app).post('/api/rescue/register').set(authHeader).send({ name: 'Missing required fields' });
      expect(invalid.status).toBe(500);
      expect(invalid.body).toEqual({ error: expect.any(String) });
      expect(await VulnerablePerson.countDocuments()).toBe(0);
      expect(await RescueTask.countDocuments()).toBe(0);
    });
  });

  describe('PATCH /api/rescue/claim/:id and PATCH /api/rescue/status/:id', () => {
    it('requires auth for task mutations and persists claim/status changes', async () => {
      const { task } = await createRescueTask();
      const noToken = await request(app).patch(`/api/rescue/claim/${task._id}`);
      expect(noToken.status).toBe(401);

      const { authHeader, user } = await createUser({ role: 'volunteer', name: 'Volunteer One' });
      const claim = await request(app).patch(`/api/rescue/claim/${task._id}`).set(authHeader);

      expect(claim.status).toBe(200);
      expect(claim.body).toEqual(expect.objectContaining({
        _id: task._id.toString(),
        personId: task.personId.toString(),
        assignedTo: user._id.toString(),
        status: 'assigned',
        priorityScore: 4.2,
      }));

      const status = await request(app)
        .patch(`/api/rescue/status/${task._id}`)
        .set(authHeader)
        .send({ status: 'rescued', notes: 'Evacuated safely' });

      expect(status.status).toBe(200);
      expect(status.body).toEqual(expect.objectContaining({
        _id: task._id.toString(),
        status: 'rescued',
        notes: 'Evacuated safely',
      }));

      const persisted = await RescueTask.findById(task._id);
      expect(persisted.assignedTo.toString()).toBe(user._id.toString());
      expect(persisted.status).toBe('rescued');
      expect(persisted.notes).toBe('Evacuated safely');
      expect(await ActivityLog.countDocuments({ eventType: 'RESCUE_CLAIMED' })).toBe(1);
      expect(await ActivityLog.countDocuments({ eventType: 'RESCUE_COMPLETED' })).toBe(1);
    });

    it('returns not found for unknown task ids', async () => {
      const { authHeader } = await createUser({ role: 'volunteer' });
      const missingId = '507f1f77bcf86cd799439011';

      const claim = await request(app).patch(`/api/rescue/claim/${missingId}`).set(authHeader);
      expect(claim.status).toBe(404);
      expect(claim.body).toEqual({ error: 'Task not found' });

      const status = await request(app)
        .patch(`/api/rescue/status/${missingId}`)
        .set(authHeader)
        .send({ status: 'rescued' });
      expect(status.status).toBe(404);
      expect(status.body).toEqual({ error: 'Task not found' });
    });
  });

  describe('GET /api/admin/stats, /api/admin/logs, and /api/admin/health', () => {
    it('requires auth and admin authorization for all admin routes', async () => {
      const routes = ['/api/admin/stats', '/api/admin/logs', '/api/admin/health'];
      const { authHeader: citizenHeader } = await createUser({ role: 'citizen' });

      for (const route of routes) {
        const unauthenticated = await request(app).get(route);
        expect(unauthenticated.status).toBe(401);

        const unauthorized = await request(app).get(route).set(citizenHeader);
        expect(unauthorized.status).toBe(403);
      }
    });

    it('returns admin stats, logs, and health schemas', async () => {
      const { authHeader, user } = await createUser({ role: 'admin', name: 'Admin User' });
      await FloodReport.create({
        imageUrl: '/uploads/a.png',
        location: { lat: 1, lng: 2 },
        ai: { isLikelyFlood: true, severityEstimate: 'severe', reasoning: 'Flood' },
        status: 'pending',
      });
      await SensorReading.create({
        deviceId: 'sensor-admin',
        location: { lat: 1, lng: 2 },
        waterLevelCm: 33,
      });
      await DangerZone.create({
        center: { lat: 1, lng: 2 },
        radiusMeters: 100,
        severity: 'moderate',
        status: 'active',
      });
      const { task } = await createRescueTask();
      await ActivityLog.create({
        eventType: 'LOGIN',
        description: 'Admin logged in.',
        userId: user._id,
        relatedObjectId: task._id.toString(),
      });

      const stats = await request(app).get('/api/admin/stats').set(authHeader);
      expect(stats.status).toBe(200);
      expect(stats.body).toEqual({
        totalFloodReports: 1,
        verifiedReports: 1,
        rejectedReports: 0,
        activeDangerZones: 1,
        activeRescueTasks: 1,
        completedRescueTasks: 0,
        registeredVulnerablePeople: 1,
        activeSensors: 1,
        connectedClients: 0,
        serverUptime: expect.any(Number),
      });

      const logs = await request(app).get('/api/admin/logs').query({ limit: 1 }).set(authHeader);
      expect(logs.status).toBe(200);
      expect(logs.body).toHaveLength(1);
      expect(logs.body[0]).toEqual(expect.objectContaining({
        _id: expect.any(String),
        eventType: 'LOGIN',
        description: 'Admin logged in.',
        relatedObjectId: task._id.toString(),
        userId: expect.objectContaining({
          _id: user._id.toString(),
          name: user.name,
          email: user.email,
        }),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }));

      const health = await request(app).get('/api/admin/health').set(authHeader);
      expect(health.status).toBe(200);
      expect(health.body).toEqual({
        nodeVersion: expect.any(String),
        memory: {
          rss: expect.stringMatching(/ MB$/),
          heapUsed: expect.stringMatching(/ MB$/),
        },
        database: 'connected',
        storage: {
          uploadFolderSize: expect.stringMatching(/ MB$/),
        },
        requests: {
          total: expect.any(Number),
          avgResponseTimeMs: expect.any(Number),
        },
        gemini: {
          configured: true,
          lastSuccessfulCall: expect.any(String),
          lastError: null,
        },
      });
    });
  });
});
