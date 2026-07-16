import { Router } from 'express';
import VulnerablePerson from '../models/VulnerablePerson.js';
import RescueTask from '../models/RescueTask.js';
import { scoreRescueTask } from '../services/rescueQueue.js';
import { protect } from '../middleware/auth.js';
import { getIo } from '../services/socket.js';

const router = Router();

/**
 * POST /api/rescue/register
 * Register a vulnerable person
 */
router.post('/register', async (req, res) => {
  try {
    const person = await VulnerablePerson.create(req.body);
    let task = new RescueTask({ personId: person._id });
    // Populate the person before scoring
    await task.populate('personId');
    task = await scoreRescueTask(task);
    getIo().emit('rescue-queue:update');
    return res.status(201).json({ person, task });
  } catch (err) {
    console.error('[rescue]', err);
    return res.status(500).json({ error: 'Failed to register person for rescue.' });
  }
});

/**
 * GET /api/rescue/queue
 * Get prioritized rescue queue
 */
router.get('/queue', async (req, res) => {
  try {
    const tasks = await RescueTask.find({ status: { $in: ['pending', 'assigned'] } })
      .populate('personId')
      .populate('dangerZoneId')
      .populate('assignedTo', 'name email')
      .sort({ priorityScore: -1, createdAt: 1 });
    return res.json(tasks);
  } catch (err) {
    console.error('[rescue]', err);
    return res.status(500).json({ error: 'Failed to fetch rescue queue.' });
  }
});

/**
 * PATCH /api/rescue/claim/:id
 * Assign a rescue task to the logged-in user
 */
router.patch('/claim/:id', protect, async (req, res) => {
  try {
    const task = await RescueTask.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    task.assignedTo = req.user._id;
    task.status = 'assigned';
    await task.save();
    getIo().emit('rescue-queue:update');
    return res.json(task);
  } catch (err) {
    console.error('[rescue]', err);
    return res.status(500).json({ error: 'Failed to claim task.' });
  }
});

/**
 * PATCH /api/rescue/status/:id
 * Update task status
 */
router.patch('/status/:id', protect, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const task = await RescueTask.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    if (status) task.status = status;
    if (notes) task.notes = notes;
    await task.save();
    getIo().emit('rescue-queue:update');
    return res.json(task);
  } catch (err) {
    console.error('[rescue]', err);
    return res.status(500).json({ error: 'Failed to update task status.' });
  }
});

export default router;
