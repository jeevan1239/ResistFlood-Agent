import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as db from '../helpers/db.js';
import SensorReading from '../../server/models/SensorReading.js';
import FloodReport from '../../server/models/FloodReport.js';
import DangerZone from '../../server/models/DangerZone.js';
import { updateDangerZones } from '../../server/services/clustering.js';

// Mock Socket.io service to prevent runtime socket errors
const mockEmit = vi.fn();
vi.mock('../../server/services/socket.js', () => ({
  getIo: () => ({
    emit: mockEmit
  }),
  initSocket: vi.fn(),
  connectedClientsCount: 0
}));

// Mock activity logger to prevent extra db records unless needed
vi.mock('../../server/services/activityLogger.js', () => ({
  logActivity: vi.fn().mockResolvedValue({})
}));

import { logActivity } from '../../server/services/activityLogger.js';

describe('Danger Zone Clustering Unit Tests', () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.clearDatabase();
    mockEmit.mockClear();
    logActivity.mockClear();
  });

  it('should mark all active danger zones as resolved when there are no recent readings or reports', async () => {
    // Seed an active danger zone
    const zone = await DangerZone.create({
      center: { lat: 12.9166, lng: 77.6228 },
      radiusMeters: 300,
      severity: 'severe',
      status: 'active'
    });

    await updateDangerZones();

    // Verify it was marked resolved
    const updatedZone = await DangerZone.findById(zone._id);
    expect(updatedZone.status).toBe('resolved');
  });

  it('should create a new active danger zone when a high-water sensor reading is received', async () => {
    // Seed a recent severe sensor reading (water level > 40cm)
    const reading = await SensorReading.create({
      deviceId: 'sim-silkboard-01',
      location: { lat: 12.9166, lng: 77.6228 },
      waterLevelCm: 45,
      source: 'simulated',
      recordedAt: new Date()
    });

    await updateDangerZones();

    const zones = await DangerZone.find({ status: 'active' });
    expect(zones.length).toBe(1);
    expect(zones[0].severity).toBe('severe');
    expect(zones[0].center.lat).toBeCloseTo(12.9166, 4);
    expect(zones[0].center.lng).toBeCloseTo(77.6228, 4);
    expect(zones[0].sourceReadingIds[0].toString()).toBe(reading._id.toString());
  });

  it('should cluster multiple nearby readings/reports within 300m into a single danger zone', async () => {
    // Seed two close readings (approx 100 meters apart)
    const reading1 = await SensorReading.create({
      deviceId: 'sim-silkboard-01',
      location: { lat: 12.9166, lng: 77.6228 },
      waterLevelCm: 25, // moderate
      source: 'simulated',
      recordedAt: new Date()
    });

    const reading2 = await SensorReading.create({
      deviceId: 'sim-silkboard-02',
      location: { lat: 12.9172, lng: 77.6232 }, // close to reading1
      waterLevelCm: 50, // severe
      source: 'simulated',
      recordedAt: new Date()
    });

    await updateDangerZones();

    const zones = await DangerZone.find({ status: 'active' });
    // Should merge them into 1 danger zone due to proximity
    expect(zones.length).toBe(1);
    expect(zones[0].severity).toBe('severe'); // inherits highest severity (severe > moderate)
    expect(zones[0].sourceReadingIds.length).toBe(2);
    
    // Center should be average of the coordinates
    const expectedLat = (12.9166 + 12.9172) / 2;
    const expectedLng = (77.6228 + 77.6232) / 2;
    expect(zones[0].center.lat).toBeCloseTo(expectedLat, 4);
    expect(zones[0].center.lng).toBeCloseTo(expectedLng, 4);
  });

  it('should update an existing danger zone instead of creating a new one when a new report falls inside it', async () => {
    // 1. Create a sensor reading to initialize a danger zone
    const reading = await SensorReading.create({
      deviceId: 'sim-silkboard-01',
      location: { lat: 12.9166, lng: 77.6228 },
      waterLevelCm: 30, // moderate
      source: 'simulated',
      recordedAt: new Date()
    });

    await updateDangerZones();
    const initialZones = await DangerZone.find({ status: 'active' });
    expect(initialZones.length).toBe(1);
    const initialZoneId = initialZones[0]._id.toString();

    // 2. Create a verified flood report in the same area
    const report = await FloodReport.create({
      imageUrl: '/uploads/sample.jpg',
      location: { lat: 12.9168, lng: 77.6230 },
      note: 'Water logging',
      ai: { isLikelyFlood: true, severityEstimate: 'severe', reasoning: 'Deep water' },
      status: 'verified',
      createdAt: new Date()
    });

    await updateDangerZones();

    // 3. Verify it updated the existing zone
    const currentZones = await DangerZone.find({ status: 'active' });
    expect(currentZones.length).toBe(1);
    expect(currentZones[0]._id.toString()).toBe(initialZoneId);
    expect(currentZones[0].severity).toBe('severe'); // upgraded from moderate to severe
    expect(currentZones[0].sourceReportIds[0].toString()).toBe(report._id.toString());
  });

  it('should ignore stale readings and reports outside the three-hour clustering window', async () => {
    const staleDate = new Date(Date.now() - 4 * 60 * 60 * 1000);

    await SensorReading.create({
      deviceId: 'old-sensor',
      location: { lat: 12.9166, lng: 77.6228 },
      waterLevelCm: 80,
      source: 'simulated',
      recordedAt: staleDate
    });

    await FloodReport.create({
      imageUrl: '/uploads/old.jpg',
      location: { lat: 12.9168, lng: 77.6230 },
      ai: { isLikelyFlood: true, severityEstimate: 'severe', reasoning: 'Old flood report' },
      status: 'verified',
      createdAt: staleDate
    });

    await updateDangerZones();

    expect(await DangerZone.countDocuments()).toBe(0);
    expect(mockEmit).not.toHaveBeenCalled();
    expect(logActivity).not.toHaveBeenCalled();
  });

  it('should resolve stale active zones and emit an update', async () => {
    const staleZone = await DangerZone.create({
      center: { lat: 12.9166, lng: 77.6228 },
      radiusMeters: 300,
      severity: 'moderate',
      status: 'active'
    });
    await DangerZone.collection.updateOne(
      { _id: staleZone._id },
      { $set: { updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000) } }
    );

    const freshReading = await SensorReading.create({
      deviceId: 'fresh-sensor',
      location: { lat: 13.02, lng: 77.50 },
      waterLevelCm: 45,
      source: 'simulated',
      recordedAt: new Date()
    });

    await updateDangerZones();

    const resolvedZone = await DangerZone.findById(staleZone._id);
    const activeZones = await DangerZone.find({ status: 'active' });

    expect(resolvedZone.status).toBe('resolved');
    expect(activeZones).toHaveLength(1);
    expect(activeZones[0].sourceReadingIds[0].toString()).toBe(freshReading._id.toString());
    expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'DANGER_ZONE_RESOLVED',
      relatedObjectId: staleZone._id.toString()
    }));
    expect(mockEmit).toHaveBeenCalledWith('danger-zone:update');
  });
});
