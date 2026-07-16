import { Router } from 'express';
import Shelter from '../models/Shelter.js';

const router = Router();

// Simple seed function to ensure we have shelters in dev
export async function seedShelters() {
  const count = await Shelter.countDocuments();
  if (count === 0) {
    await Shelter.insertMany([
      { name: 'Kanteerava Stadium Relief Camp', location: { lat: 12.9696, lng: 77.5937 }, capacity: 500, isActive: true },
      { name: 'National College Basavanagudi Shelter', location: { lat: 12.9461, lng: 77.5739 }, capacity: 200, isActive: true },
      { name: 'Indiranagar Community Hall', location: { lat: 12.9783, lng: 77.6408 }, capacity: 150, isActive: true },
      { name: 'Yeshwanthpur Govt School Camp', location: { lat: 13.0232, lng: 77.5385 }, capacity: 300, isActive: true }
    ]);
    console.log('[Shelter] Seeded initial shelters.');
  }
}

/**
 * GET /api/shelters
 */
router.get('/', async (req, res) => {
  try {
    const shelters = await Shelter.find({ isActive: true });
    return res.json(shelters);
  } catch (err) {
    console.error('[shelters]', err);
    return res.status(500).json({ error: 'Failed to fetch shelters.' });
  }
});

export default router;
