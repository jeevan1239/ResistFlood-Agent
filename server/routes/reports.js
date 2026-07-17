import { Router } from 'express';
import { createReport, getReports } from '../controllers/reportController.js';
import { upload } from '../services/storage.js';
import { protectOptional } from '../middleware/auth.js';

const router = Router();

// Allow optional auth for reports (anonymous allowed)
router.post('/', protectOptional, upload.single('image'), createReport);
router.get('/', getReports);

export default router;
