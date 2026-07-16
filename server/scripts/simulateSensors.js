/**
 * simulateSensors.js
 * Posts slowly-rising water-level readings every 10 seconds for four
 * flood-prone locations in Bengaluru. Uses Node's built-in fetch.
 *
 * Run with:  npm run simulate   (from the /server directory)
 */

import 'dotenv/config';

const API_BASE = `http://localhost:${process.env.PORT || 5000}`;
const INTERVAL_MS = 10_000;

/** Bengaluru flood-prone monitoring points */
const DEVICES = [
  { deviceId: 'sim-silkboard-01',  location: { lat: 12.9166, lng: 77.6228 }, label: 'Silk Board Junction' },
  { deviceId: 'sim-bellandur-01',  location: { lat: 12.9304, lng: 77.6784 }, label: 'Bellandur' },
  { deviceId: 'sim-krpuram-01',    location: { lat: 13.0088, lng: 77.6959 }, label: 'K.R. Puram' },
  { deviceId: 'sim-sarjapur-01',   location: { lat: 12.9008, lng: 77.6885 }, label: 'Sarjapur Road' },
];

/**
 * Current simulated water level per device (starts low, rises slowly,
 * resets back to zero once it exceeds 60 cm so the demo cycles).
 */
const levels = Object.fromEntries(DEVICES.map((d) => [d.deviceId, 5]));

/**
 * Color thresholds (mirrors what the frontend uses):
 *   green  : < 15 cm
 *   yellow : 15–40 cm
 *   red    : > 40 cm
 */
function colorForLevel(cm) {
  if (cm < 15) return 'green';
  if (cm <= 40) return 'yellow';
  return 'red';
}

async function postReading(device, waterLevelCm) {
  const body = {
    deviceId: device.deviceId,
    location: device.location,
    waterLevelCm,
    source: 'simulated',
  };

  try {
    const res = await fetch(`${API_BASE}/api/sensors/reading`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[sim] ${device.label}: HTTP ${res.status} — ${text}`);
    } else {
      console.log(
        `[sim] ${device.label}: ${waterLevelCm.toFixed(1)} cm  (${colorForLevel(waterLevelCm)})`
      );
    }
  } catch (err) {
    console.error(`[sim] ${device.label}: fetch error — ${err.message}`);
  }
}

async function tick() {
  for (const device of DEVICES) {
    // Increment by a random 1–5 cm each tick; reset after 60 cm
    levels[device.deviceId] += Math.random() * 4 + 1;
    if (levels[device.deviceId] > 60) levels[device.deviceId] = 5;

    await postReading(device, parseFloat(levels[device.deviceId].toFixed(1)));
  }
}

console.log('[sim] Starting sensor simulation. Press Ctrl+C to stop.');
console.log(`[sim] Posting to ${API_BASE}/api/sensors/reading every ${INTERVAL_MS / 1000}s\n`);

// Fire once immediately, then on interval
tick();
setInterval(tick, INTERVAL_MS);
