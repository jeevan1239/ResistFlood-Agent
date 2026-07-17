import { Router } from 'express';
import DangerZone from '../models/DangerZone.js';

const router = Router();

/**
 * GET /api/danger-zones/active
 */
router.get('/active', async (req, res) => {
  try {
    const zones = await DangerZone.find({ status: 'active' })
      .populate('sourceReportIds')
      .populate('sourceReadingIds');
    return res.json(zones);
  } catch (err) {
    console.error('[dangerZones]', err);
    return res.status(500).json({ error: 'Failed to fetch danger zones.' });
  }
});

export default router;
