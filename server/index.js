import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { connectDB } from './config/db.js';
import { updateDangerZones } from './services/clustering.js';
import { updateAllScores } from './services/rescueQueue.js';
import { initSocket } from './services/socket.js';
import { seedShelters } from './routes/shelters.js';

export { systemStats } from './stats.js';

const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 5000;

// Connect to MongoDB then start listening
await connectDB();
await seedShelters();

const CLUSTER_INTERVAL_MS =
  process.env.NODE_ENV === "development"
    ? 15000
    : 60000;

// Start clustering loop
let maintenanceRunning = false;
setInterval(async () => {
  if (maintenanceRunning) return;

  maintenanceRunning = true;
  try {
    await updateDangerZones();
    await updateAllScores();
  } catch (err) {
    console.error('[maintenance] update failed:', err);
  } finally {
    maintenanceRunning = false;
  }
}, CLUSTER_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`[server] Listening on port ${PORT}`);
});

