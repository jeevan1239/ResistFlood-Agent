import { Router } from 'express';
import { ingestReading, latestReadings } from '../controllers/sensorController.js';

const router = Router();

router.post('/reading', ingestReading);
router.get('/latest', latestReadings);

export default router;
