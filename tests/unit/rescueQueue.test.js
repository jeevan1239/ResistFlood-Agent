import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as db from '../helpers/db.js';
import VulnerablePerson from '../../server/models/VulnerablePerson.js';
import RescueTask from '../../server/models/RescueTask.js';
import DangerZone from '../../server/models/DangerZone.js';
import { scoreRescueTask, updateAllScores } from '../../server/services/rescueQueue.js';
import { makeVulnerablePerson, makeRescueTask, makeDangerZone } from '../helpers/demo.js';

// Mock Socket.io service
const mockEmit = vi.fn();
vi.mock('../../server/services/socket.js', () => ({
  getIo: () => ({
    emit: mockEmit
  }),
  initSocket: vi.fn(),
  connectedClientsCount: 0
}));

describe('Rescue Queue Priority Scoring Unit Tests', () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.clearDatabase();
    mockEmit.mockClear();
  });

  it('should compute priority score correctly based on distance and check-in time', async () => {
    // 1. Seed active danger zone
    const zone = await DangerZone.create(makeDangerZone({
      center: { lat: 12.9300, lng: 77.6780 }
    }));

    // 2. Create vulnerable person (approx 111 meters away: lat delta ~0.001 deg is approx 111m)
    // Let's set location exactly at lat: 12.9300, lng: 77.6790.
    // Distance between 77.6780 and 77.6790 at equator is approx 111 meters.
    // Let's calculate using turf inside the test to be exact.
    const person = await VulnerablePerson.create(makeVulnerablePerson({
      location: { lat: 12.9300, lng: 77.6790 },
      lastCheckIn: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
    }));

    const task = await RescueTask.create(makeRescueTask({
      personId: person._id
    }));

    // Populate personId because scoreRescueTask expects it populated
    task.personId = person;

    const updatedTask = await scoreRescueTask(task);

    expect(updatedTask.priorityScore).toBeGreaterThan(0);
    // Verified task is saved in db
    const savedTask = await RescueTask.findById(task._id);
    expect(savedTask.priorityScore).toBeCloseTo(updatedTask.priorityScore, 4);
    // Since distance is ~111m (<= 300m), it should populate dangerZoneId
    expect(savedTask.dangerZoneId.toString()).toBe(zone._id.toString());
  });

  it('should assign a higher score to a person closer to a danger zone', async () => {
    const zone = await DangerZone.create(makeDangerZone({
      center: { lat: 12.9300, lng: 77.6780 }
    }));

    // Person A: Very close (lat delta 0.0001, approx 11m)
    const personA = await VulnerablePerson.create(makeVulnerablePerson({
      location: { lat: 12.9300, lng: 77.6781 },
      lastCheckIn: new Date() // just now
    }));

    // Person B: Farther away (lat delta 0.008, approx 880m)
    const personB = await VulnerablePerson.create(makeVulnerablePerson({
      location: { lat: 12.9300, lng: 77.6860 },
      lastCheckIn: new Date() // just now
    }));

    const taskA = await RescueTask.create(makeRescueTask({ personId: personA._id }));
    taskA.personId = personA;

    const taskB = await RescueTask.create(makeRescueTask({ personId: personB._id }));
    taskB.personId = personB;

    const scoredA = await scoreRescueTask(taskA);
    const scoredB = await scoreRescueTask(taskB);

    expect(scoredA.priorityScore).toBeGreaterThan(scoredB.priorityScore);
  });

  it('should give a priority boost to a person with a longer time since last check-in', async () => {
    const zone = await DangerZone.create(makeDangerZone({
      center: { lat: 12.9300, lng: 77.6780 }
    }));

    // Person A: Checked in 10 hours ago
    const personA = await VulnerablePerson.create(makeVulnerablePerson({
      location: { lat: 12.9300, lng: 77.6790 },
      lastCheckIn: new Date(Date.now() - 10 * 60 * 60 * 1000)
    }));

    // Person B: Checked in just now, located at same spot
    const personB = await VulnerablePerson.create(makeVulnerablePerson({
      location: { lat: 12.9300, lng: 77.6790 },
      lastCheckIn: new Date()
    }));

    const taskA = await RescueTask.create(makeRescueTask({ personId: personA._id }));
    taskA.personId = personA;

    const taskB = await RescueTask.create(makeRescueTask({ personId: personB._id }));
    taskB.personId = personB;

    const scoredA = await scoreRescueTask(taskA);
    const scoredB = await scoreRescueTask(taskB);

    // Person A should have higher priority score due to the time elapsed component (0.3 * hoursSinceLastCheckIn)
    expect(scoredA.priorityScore).toBeGreaterThan(scoredB.priorityScore);
  });

  it('should run updateAllScores and update scores for all pending tasks', async () => {
    await DangerZone.create(makeDangerZone({
      center: { lat: 12.9300, lng: 77.6780 }
    }));

    const person = await VulnerablePerson.create(makeVulnerablePerson({
      location: { lat: 12.9300, lng: 77.6790 }
    }));

    const task = await RescueTask.create(makeRescueTask({
      personId: person._id,
      priorityScore: 0.1 // initial low score
    }));

    await updateAllScores();

    const updatedTask = await RescueTask.findById(task._id);
    expect(updatedTask.priorityScore).toBeGreaterThan(0.1);
    expect(mockEmit).toHaveBeenCalledWith('rescue-queue:update');
  });

  it('should score tasks without active danger zones without assigning a zone', async () => {
    const person = await VulnerablePerson.create(makeVulnerablePerson({
      lastCheckIn: new Date(Date.now() - 5 * 60 * 60 * 1000)
    }));
    const task = await RescueTask.create(makeRescueTask({ personId: person._id }));
    task.personId = person;

    const scored = await scoreRescueTask(task);

    expect(scored.priorityScore).toBeGreaterThanOrEqual(1.4);
    expect(scored.dangerZoneId).toBeNull();

    const savedTask = await RescueTask.findById(task._id);
    expect(savedTask.priorityScore).toBeCloseTo(scored.priorityScore, 4);
    expect(savedTask.dangerZoneId).toBeNull();
  });

  it('should only rescore pending tasks in updateAllScores', async () => {
    await DangerZone.create(makeDangerZone());
    const pendingPerson = await VulnerablePerson.create(makeVulnerablePerson({
      location: { lat: 12.9310, lng: 77.6790 }
    }));
    const assignedPerson = await VulnerablePerson.create(makeVulnerablePerson({
      location: { lat: 12.9310, lng: 77.6790 }
    }));

    const pendingTask = await RescueTask.create(makeRescueTask({
      personId: pendingPerson._id,
      priorityScore: 0.1,
      status: 'pending'
    }));
    const assignedTask = await RescueTask.create(makeRescueTask({
      personId: assignedPerson._id,
      priorityScore: 0.1,
      status: 'assigned'
    }));

    await updateAllScores();

    const rescoredPending = await RescueTask.findById(pendingTask._id);
    const untouchedAssigned = await RescueTask.findById(assignedTask._id);

    expect(rescoredPending.priorityScore).toBeGreaterThan(0.1);
    expect(untouchedAssigned.priorityScore).toBe(0.1);
  });
});
