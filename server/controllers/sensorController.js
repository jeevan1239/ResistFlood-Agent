import SensorReading from '../models/SensorReading.js';
import { getIo } from '../services/socket.js';

/**
 * POST /api/sensors/reading
 * No auth — accepts readings from simulated devices or real hardware.
 * Body: { deviceId, location: { lat, lng }, waterLevelCm, source? }
 */
export async function ingestReading(req, res) {
  try {
    const { deviceId, location, waterLevelCm, source } = req.body;

    if (!deviceId || location?.lat == null || location?.lng == null || waterLevelCm == null) {
      return res.status(400).json({ error: 'deviceId, location.lat, location.lng and waterLevelCm are required.' });
    }

    const lat = Number(location.lat);
    const lng = Number(location.lng);
    const level = Number(waterLevelCm);
    if (![lat, lng, level].every(Number.isFinite)) {
      return res.status(400).json({ error: 'location coordinates and waterLevelCm must be valid numbers.' });
    }

    const reading = await SensorReading.create({
      deviceId,
      location: { lat, lng },
      waterLevelCm: level,
      source: source || 'simulated',
      recordedAt: new Date(),
    });

    getIo().emit('sensor:update');

    if (level >= 40) {
      import('../services/activityLogger.js').then(({ logActivity }) => {
        logActivity({
          eventType: 'SENSOR_THRESHOLD_EXCEEDED',
          description: `Sensor ${deviceId} reported severe water level: ${level}cm`,
          relatedObjectId: reading._id.toString()
        });
      });
    }

    return res.status(201).json(reading);
  } catch (err) {
    console.error('[sensors/reading]', err);
    return res.status(500).json({ error: 'Failed to save reading.' });
  }
}

/**
 * GET /api/sensors/latest
 * Returns the most recent reading for each unique deviceId.
 */
export async function latestReadings(req, res) {
  try {
    // Aggregate: for each deviceId, pick the doc with the highest recordedAt
    const latest = await SensorReading.aggregate([
      { $sort: { recordedAt: -1 } },
      {
        $group: {
          _id: '$deviceId',
          deviceId: { $first: '$deviceId' },
          location: { $first: '$location' },
          waterLevelCm: { $first: '$waterLevelCm' },
          source: { $first: '$source' },
          recordedAt: { $first: '$recordedAt' },
        },
      },
      { $project: { _id: 0 } },
    ]);

    return res.json(latest);
  } catch (err) {
    console.error('[sensors/latest]', err);
    return res.status(500).json({ error: 'Failed to fetch readings.' });
  }
}
