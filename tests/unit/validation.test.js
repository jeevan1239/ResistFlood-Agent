import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import * as db from '../helpers/db.js';
import User from '../../server/models/User.js';
import SensorReading from '../../server/models/SensorReading.js';
import FloodReport from '../../server/models/FloodReport.js';
import DangerZone from '../../server/models/DangerZone.js';
import VulnerablePerson from '../../server/models/VulnerablePerson.js';
import RescueTask from '../../server/models/RescueTask.js';
import ActivityLog from '../../server/models/ActivityLog.js';
import { makeUser, makeSensorReading, makeFloodReport, makeDangerZone, makeVulnerablePerson, makeRescueTask } from '../helpers/demo.js';

describe('Mongoose Schema Validation Unit Tests', () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  const expectValidationError = async (promise, path = null) => {
    try {
      await promise;
      throw new Error('Expected validation error but save succeeded.');
    } catch (err) {
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      if (path) {
        expect(err.errors[path]).toBeDefined();
      }
    }
  };

  describe('User Validation', () => {
    it('should validate a correct user object', async () => {
      const user = new User(makeUser());
      const err = user.validateSync();
      expect(err).toBeUndefined();
    });

    it('should fail when name, email, or passwordHash is missing', async () => {
      const user = new User({ email: 'test@example.com' });
      await expectValidationError(user.save(), 'name');
    });

    it('should fail for invalid role values', async () => {
      const user = new User(makeUser({ role: 'superhero' }));
      await expectValidationError(user.save(), 'role');
    });
  });

  describe('SensorReading Validation', () => {
    it('should validate a correct sensor reading object', async () => {
      const reading = new SensorReading(makeSensorReading());
      const err = reading.validateSync();
      expect(err).toBeUndefined();
    });

    it('should fail when waterLevelCm is negative', async () => {
      const reading = new SensorReading(makeSensorReading({ waterLevelCm: -5 }));
      await expectValidationError(reading.save(), 'waterLevelCm');
    });

    it('should fail for invalid source values', async () => {
      const reading = new SensorReading(makeSensorReading({ source: 'bluetooth' }));
      await expectValidationError(reading.save(), 'source');
    });
  });

  describe('FloodReport Validation', () => {
    it('should validate a correct flood report object', async () => {
      const report = new FloodReport(makeFloodReport());
      const err = report.validateSync();
      expect(err).toBeUndefined();
    });

    it('should fail when imageUrl or location coordinates are missing', async () => {
      const report = new FloodReport({ note: 'flooding' });
      await expectValidationError(report.save(), 'imageUrl');
    });

    it('should fail for invalid AI severity values', async () => {
      const report = new FloodReport(makeFloodReport({
        ai: { isLikelyFlood: true, severityEstimate: 'extremely-severe' }
      }));
      await expectValidationError(report.save(), 'ai.severityEstimate');
    });
  });

  describe('DangerZone Validation', () => {
    it('should validate a correct danger zone object', async () => {
      const zone = new DangerZone(makeDangerZone());
      const err = zone.validateSync();
      expect(err).toBeUndefined();
    });

    it('should fail for invalid severity values', async () => {
      const zone = new DangerZone(makeDangerZone({ severity: 'catastrophic' }));
      await expectValidationError(zone.save(), 'severity');
    });
  });

  describe('VulnerablePerson Validation', () => {
    it('should validate a correct vulnerable person object', async () => {
      const person = new VulnerablePerson(makeVulnerablePerson());
      const err = person.validateSync();
      expect(err).toBeUndefined();
    });

    it('should fail when contactNumber or age is missing', async () => {
      const person = new VulnerablePerson({ name: 'Elderly resident' });
      await expectValidationError(person.save(), 'contactNumber');
    });
  });

  describe('RescueTask Validation', () => {
    it('should validate a correct rescue task object', async () => {
      const person = await VulnerablePerson.create(makeVulnerablePerson());
      const task = new RescueTask(makeRescueTask({ personId: person._id }));
      const err = task.validateSync();
      expect(err).toBeUndefined();
    });

    it('should fail when personId is missing', async () => {
      const task = new RescueTask(makeRescueTask({ personId: null }));
      await expectValidationError(task.save(), 'personId');
    });

    it('should fail for invalid status enum values', async () => {
      const person = await VulnerablePerson.create(makeVulnerablePerson());
      const task = new RescueTask(makeRescueTask({ personId: person._id, status: 'claimed' }));
      // Valid enums are 'pending', 'assigned', 'rescued', 'cancelled'
      await expectValidationError(task.save(), 'status');
    });
  });

  describe('ActivityLog Validation', () => {
    it('should validate a correct activity log object', () => {
      const log = new ActivityLog({
        eventType: 'DANGER_ZONE_CREATED',
        description: 'New danger zone identified.',
        relatedObjectId: new mongoose.Types.ObjectId().toString()
      });

      const err = log.validateSync();
      expect(err).toBeUndefined();
    });

    it('should fail for missing description and unsupported event types', async () => {
      const log = new ActivityLog({ eventType: 'UNSUPPORTED_EVENT' });

      await expectValidationError(log.save(), 'eventType');
    });
  });
});
