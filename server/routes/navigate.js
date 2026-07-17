import { Router } from 'express';
import DangerZone from '../models/DangerZone.js';
import * as turf from '@turf/turf';
import { summarizeRoute } from '../services/gemini.js';
import { logActivity } from '../services/activityLogger.js';

const router = Router();
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

/**
 * GET /api/navigate
 * Query: start=lng,lat & end=lng,lat
 */
router.get('/', async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end coordinates are required (lng,lat).' });
    }

    // 1. Fetch danger zones
    const activeZones = await DangerZone.find({ status: 'active' });

    // 2. Fetch alternative routes from OSRM
    const url = `${OSRM_URL}/${start};${end}?alternatives=true&geometries=geojson&overview=full&steps=true`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return res.status(404).json({ error: 'No routes found.' });
    }

    // 3. Score each route based on intersection with danger zones
    const scoredRoutes = data.routes.map(route => {
      let dangerScore = 0;
      const routeLine = turf.lineString(route.geometry.coordinates);

      for (const zone of activeZones) {
        const zoneCenter = turf.point([zone.center.lng, zone.center.lat]);
        const zonePolygon = turf.circle(zoneCenter, zone.radiusMeters / 1000, { units: 'kilometers' });
        
        if (turf.booleanIntersects(routeLine, zonePolygon)) {
          const severityWeight = { minor: 1, moderate: 3, severe: 10, critical: 20 };
          dangerScore += severityWeight[zone.severity] || 1;
        }
      }

      return {
        ...route,
        dangerScore,
        isSafe: dangerScore === 0
      };
    });

    // 4. Sort by danger score ascending, then by distance
    scoredRoutes.sort((a, b) => {
      if (a.dangerScore !== b.dangerScore) {
        return a.dangerScore - b.dangerScore;
      }
      return a.distance - b.distance;
    });

    const bestRoute = scoredRoutes[0];
    const caution = !bestRoute.isSafe;

    // Extract steps for summarization
    const steps = (bestRoute.legs && bestRoute.legs[0] && bestRoute.legs[0].steps) 
      ? bestRoute.legs[0].steps.map(s => ({ instruction: s.maneuver.type + ' ' + (s.name || '') }))
      : [];

    const summary = await summarizeRoute(steps);

    logActivity({
      eventType: 'SAFE_ROUTE_GENERATED',
      description: 'A safe navigation route was calculated.'
    });

    return res.json({
      recommendedRoute: {
        ...bestRoute,
        caution,
        summary
      },
      alternatives: scoredRoutes.slice(1)
    });

  } catch (err) {
    console.error('[navigate]', err);
    return res.status(500).json({ error: 'Failed to calculate route.' });
  }
});

export default router;
