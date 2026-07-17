import FloodReport from '../models/FloodReport.js';
import DangerZone from '../models/DangerZone.js';
import RescueTask from '../models/RescueTask.js';
import VulnerablePerson from '../models/VulnerablePerson.js';
import SensorReading from '../models/SensorReading.js';
import ActivityLog from '../models/ActivityLog.js';
import mongoose from 'mongoose';
import { connectedClientsCount } from '../services/socket.js';
import { geminiStatus } from '../services/gemini.js';
import { systemStats } from '../stats.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDirSize(dirPath) {
  let size = 0;
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isFile()) size += stats.size;
    }
  }
  return size;
}

export async function getStats(req, res) {
  try {
    const totalFloodReports = await FloodReport.countDocuments();
    const verifiedReports = await FloodReport.countDocuments({ status: 'pending' }); // pending rescue means verified as true
    const rejectedReports = await FloodReport.countDocuments({ status: 'rejected' });
    const activeDangerZones = await DangerZone.countDocuments({ status: 'active' });
    const activeRescueTasks = await RescueTask.countDocuments({ status: { $in: ['pending', 'assigned'] } });
    const completedRescueTasks = await RescueTask.countDocuments({ status: 'rescued' });
    const registeredVulnerablePeople = await VulnerablePerson.countDocuments();
    
    // For active sensors, count distinct deviceIds
    const activeSensors = (await SensorReading.distinct('deviceId')).length;

    res.json({
      totalFloodReports,
      verifiedReports,
      rejectedReports,
      activeDangerZones,
      activeRescueTasks,
      completedRescueTasks,
      registeredVulnerablePeople,
      activeSensors,
      connectedClients: connectedClientsCount,
      serverUptime: process.uptime()
    });
  } catch (err) {
    console.error('[admin/stats]', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

export async function getLogs(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await ActivityLog.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('userId', 'name email');
    res.json(logs);
  } catch (err) {
    console.error('[admin/logs]', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
}

export async function getHealth(req, res) {
  try {
    const memory = process.memoryUsage();
    
    const dbState = mongoose.connection.readyState; // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
    const dbStatus = dbState === 1 ? 'connected' : 'disconnected';

    const uploadsPath = path.join(__dirname, '..', 'uploads');
    const uploadDirSize = getDirSize(uploadsPath);

    const avgResponseTime = systemStats.totalRequests > 0 
      ? (systemStats.totalResponseTimeMs / systemStats.totalRequests).toFixed(2) 
      : 0;

    res.json({
      nodeVersion: process.version,
      memory: {
        rss: (memory.rss / 1024 / 1024).toFixed(2) + ' MB',
        heapUsed: (memory.heapUsed / 1024 / 1024).toFixed(2) + ' MB'
      },
      database: dbStatus,
      storage: {
        uploadFolderSize: (uploadDirSize / 1024 / 1024).toFixed(2) + ' MB'
      },
      requests: {
        total: systemStats.totalRequests,
        avgResponseTimeMs: Number(avgResponseTime)
      },
      gemini: {
        configured: geminiStatus.configured,
        lastSuccessfulCall: geminiStatus.lastSuccessfulCall,
        lastError: geminiStatus.lastError
      }
    });
  } catch (err) {
    console.error('[admin/health]', err);
    res.status(500).json({ error: 'Failed to fetch health status' });
  }
}
