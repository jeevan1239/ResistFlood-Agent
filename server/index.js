import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { connectDB } from './config/db.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import sensorRouter from './routes/sensors.js';
import reportsRouter from './routes/reports.js';
import dangerZonesRouter from './routes/dangerZones.js';
import sheltersRouter from './routes/shelters.js';
import navigateRouter from './routes/navigate.js';
import rescueRouter from './routes/rescue.js';
import { updateDangerZones } from './services/clustering.js';
import { updateAllScores } from './services/rescueQueue.js';
import { initSocket } from './services/socket.js';
import http from 'http';

const app = express();
const server = http.createServer(app);
const io = initSocket(server);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Connect to MongoDB then start listening
await connectDB();

const CLUSTER_INTERVAL_MS =
  process.env.NODE_ENV === "development"
    ? 15000
    : 60000;

// Start clustering loop
setInterval(async () => {
  await updateDangerZones();
  await updateAllScores();
}, CLUSTER_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`[server] Listening on port ${PORT}`);
});
