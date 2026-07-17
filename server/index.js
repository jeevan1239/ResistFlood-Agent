import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(serverDir, '../.env') });

const { default: app } = await import('./app.js');
const { connectDB } = await import('./config/db.js');
const { updateDangerZones } = await import('./services/clustering.js');
const { updateAllScores } = await import('./services/rescueQueue.js');
const { initSocket } = await import('./services/socket.js');
const { seedShelters } = await import('./routes/shelters.js');

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

