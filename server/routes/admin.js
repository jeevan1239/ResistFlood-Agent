import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { getStats, getLogs, getHealth } from '../controllers/adminController.js';

const router = Router();

// All admin routes are protected and require 'admin' role
router.use(protect, authorize('admin'));

router.get('/stats', getStats);
router.get('/logs', getLogs);
router.get('/health', getHealth);

export default router;
