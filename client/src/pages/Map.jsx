import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Circle, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api/axios.js';
import { socket } from '../socket.js';

/**
 * Water-level colour thresholds (from BUILD_PLAN.md Phase 2):
 *   green  : < 15 cm
 *   yellow : 15–40 cm
 *   red    : > 40 cm
 */
function colorForLevel(cm) {
  if (cm < 15) return '#16a34a';   // green-600
  if (cm <= 40) return '#ca8a04';  // yellow-600
  return '#dc2626';                // red-600
}

function levelLabel(cm) {
  if (cm < 15) return 'Low';
  if (cm <= 40) return 'Moderate';
  return 'High';
}

const BENGALURU_CENTER = [12.9716, 77.5946];
const POLL_INTERVAL_MS = 15_000;

export default function Map() {
  const [readings, setReadings] = useState([]);
  const [dangerZones, setDangerZones] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [route, setRoute] = useState(null);
  const [routeSummary, setRouteSummary] = useState(null);
  const [routeCaution, setRouteCaution] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [routing, setRouting] = useState(false);
  const intervalRef = useRef(null);
  const routeCache = useRef(new Map());

  async function fetchSensors() {
    try {
      const res = await api.get('/api/sensors/latest');
      setReadings(res.data);
      setLastUpdated(new Date());
    } catch (err) { console.error('[Map] fetch sensors error:', err.message); }
  }

  async function fetchZones() {
    try {
      const res = await api.get('/api/danger-zones/active');
      setDangerZones(res.data);
      setLastUpdated(new Date());
    } catch (err) { console.error('[Map] fetch zones error:', err.message); }
  }

  async function fetchShelters() {
    try {
      const res = await api.get('/api/shelters');
      setShelters(res.data);
    } catch (err) { console.error('[Map] fetch shelters error:', err.message); }
  }

  async function fetchAll() {
    await Promise.all([fetchSensors(), fetchZones(), fetchShelters()]);
  }

  useEffect(() => {
    fetchAll();

    socket.on('sensor:update', fetchSensors);
    socket.on('danger-zone:update', fetchZones);

    const checkPolling = () => {
      if (socket.connected) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        if (!intervalRef.current) {
          intervalRef.current = setInterval(fetchAll, POLL_INTERVAL_MS);
        }
      }
    };

    socket.on('connect', checkPolling);
    socket.on('disconnect', checkPolling);

    checkPolling();

    return () => {
      socket.off('sensor:update', fetchSensors);
      socket.off('danger-zone:update', fetchZones);
      socket.off('connect', checkPolling);
      socket.off('disconnect', checkPolling);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  async function findSafeRoute() {
    if (!navigator.geolocation) {
      alert('Geolocation not supported');
      return;
    }
    setRouting(true);
    setRouteSummary(null);
    setRouteCaution(false);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        // Round coordinates slightly to improve cache hits
        const latitude = Number(pos.coords.latitude.toFixed(4));
        const longitude = Number(pos.coords.longitude.toFixed(4));
        
        let nearest = null;
        let minDist = Infinity;
        for (const s of shelters) {
          const d = Math.hypot(s.location.lat - latitude, s.location.lng - longitude);
          if (d < minDist) {
            minDist = d;
            nearest = s;
          }
        }

        if (!nearest) {
          alert('No shelters found');
          setRouting(false);
          return;
        }

        const cacheKey = `${longitude},${latitude}_${nearest.location.lng},${nearest.location.lat}`;
        const now = Date.now();
        const cached = routeCache.current.get(cacheKey);

        if (cached && now - cached.timestamp < 60000) {
          // Cache hit within last minute
          setRoute(cached.route);
          setRouteSummary(cached.summary);
          setRouteCaution(cached.caution);
          setRouting(false);
          return;
        }

        const res = await api.get(`/api/navigate?start=${longitude},${latitude}&end=${nearest.location.lng},${nearest.location.lat}`);
        if (res.data.recommendedRoute) {
          const coords = res.data.recommendedRoute.geometry.coordinates.map(c => [c[1], c[0]]);
          const summary = res.data.recommendedRoute.summary;
          const caution = res.data.recommendedRoute.caution;

          setRoute(coords);
          setRouteSummary(summary);
          setRouteCaution(caution);

          routeCache.current.set(cacheKey, {
            route: coords,
            summary,
            caution,
            timestamp: now
          });
        }
      } catch (err) {
        console.error('[Routing]', err);
        alert('Failed to find safe route');
      } finally {
        setRouting(false);
      }
    }, () => {
      alert('Failed to get your location');
      setRouting(false);
    });
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header bar */}
      <div className="bg-white shadow-sm px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-lg font-bold text-blue-700">Live Flood Map</h1>
            <p className="text-xs text-gray-400">
              Bengaluru sensor network · updates every {POLL_INTERVAL_MS / 1000}s
            </p>
          </div>
          <button
            onClick={findSafeRoute}
            disabled={routing || shelters.length === 0}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {routing ? 'Calculating...' : 'Find Safe Route'}
          </button>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {/* Legend */}
          <div className="flex gap-3">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-600"></span> Low
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-yellow-600"></span> Mod
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-600"></span> High
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-blue-600"></span> Shelter
            </span>
          </div>
          {lastUpdated && (
            <span className="text-gray-400">
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {routeSummary && (
        <div className={`px-6 py-3 shrink-0 ${routeCaution ? 'bg-yellow-100 text-yellow-900 border-b border-yellow-200' : 'bg-green-100 text-green-900 border-b border-green-200'}`}>
          <div className="flex items-start gap-2">
            <span className="font-bold">{routeCaution ? '⚠️ Caution:' : '✅ Safe Route:'}</span>
            <p className="text-sm">{routeSummary}</p>
          </div>
        </div>
      )}

      {/* Map area */}
      <div className="flex-1 relative z-0">
        {!readings.length && !dangerZones.length && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-[1000] pointer-events-none">
            <p className="text-gray-400 text-sm bg-white px-4 py-2 rounded shadow">
              Waiting for sensor data… (start the simulator with <code>npm run simulate</code>)
            </p>
          </div>
        )}
        <MapContainer
          center={BENGALURU_CENTER}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {dangerZones.map((zone) => (
            <Circle
              key={zone._id}
              center={[zone.center.lat, zone.center.lng]}
              radius={zone.radiusMeters}
              pathOptions={{
                color: '#dc2626',
                fillColor: '#dc2626',
                fillOpacity: 0.3,
                weight: 1,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold text-red-700">Danger Zone</p>
                  <p>Severity: <span className="capitalize">{zone.severity}</span></p>
                  <p>Radius: {zone.radiusMeters}m</p>
                </div>
              </Popup>
            </Circle>
          ))}

          {readings.map((r) => (
            <CircleMarker
              key={r.deviceId}
              center={[r.location.lat, r.location.lng]}
              radius={18}
              pathOptions={{
                color: colorForLevel(r.waterLevelCm),
                fillColor: colorForLevel(r.waterLevelCm),
                fillOpacity: 0.75,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{r.deviceId}</p>
                  <p>
                    Water level:{' '}
                    <strong style={{ color: colorForLevel(r.waterLevelCm) }}>
                      {r.waterLevelCm} cm ({levelLabel(r.waterLevelCm)})
                    </strong>
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Source: {r.source}
                    <br />
                    {r.recordedAt
                      ? new Date(r.recordedAt).toLocaleTimeString()
                      : ''}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {shelters.map((s) => (
            <CircleMarker
              key={s._id}
              center={[s.location.lat, s.location.lng]}
              radius={10}
              pathOptions={{
                color: '#2563eb', // blue
                fillColor: '#2563eb',
                fillOpacity: 1,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold text-blue-700">{s.name}</p>
                  <p>Capacity: {s.capacity}</p>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {route && (
            <Polyline
              positions={route}
              pathOptions={{ color: '#10b981', weight: 5, opacity: 0.8 }} // green route
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
