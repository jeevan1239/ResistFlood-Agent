import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import sensorRouter from './routes/sensors.js';
import reportsRouter from './routes/reports.js';
import dangerZonesRouter from './routes/dangerZones.js';
import sheltersRouter from './routes/shelters.js';
import navigateRouter from './routes/navigate.js';
import rescueRouter from './routes/rescue.js';
import adminRouter from './routes/admin.js';
import { systemStats } from './stats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Request Tracking — shared with adminController via ./stats.js
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    systemStats.totalRequests++;
    systemStats.totalResponseTimeMs += (Date.now() - start);
  });
  next();
});

// Middleware
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/sensors', sensorRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/danger-zones', dangerZonesRouter);
app.use('/api/shelters', sheltersRouter);
app.use('/api/navigate', navigateRouter);
app.use('/api/rescue', rescueRouter);
app.use('/api/admin', adminRouter);

export default app;
export { systemStats };
