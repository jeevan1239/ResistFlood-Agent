import * as turf from '@turf/turf';
import SensorReading from '../models/SensorReading.js';
import FloodReport from '../models/FloodReport.js';
import DangerZone from '../models/DangerZone.js';
import { logActivity } from './activityLogger.js';
import { getIo } from './socket.js';

const CLUSTER_RADIUS_KM = 0.3; // 300 meters

function getSeverity(waterLevelCm) {
  if (waterLevelCm > 40) return 'severe';
  if (waterLevelCm >= 15) return 'moderate';
  return 'minor';
}

function getSeverityWeight(severity) {
  const w = { minor: 1, moderate: 2, severe: 3, critical: 4 };
  return w[severity] || 1;
}

export async function updateDangerZones() {
  try {
    const now = Date.now();
    // "Marks a zone resolved after 3 hours with no new supporting reading/report."
    // So we look back 3 hours.
    const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000);
    
    // Fetch recent readings (moderate or above)
    const recentReadings = await SensorReading.find({
      recordedAt: { $gte: threeHoursAgo },
      waterLevelCm: { $gte: 15 } // moderate threshold
    });

    // Fetch recent verified reports
    const recentReports = await FloodReport.find({
      status: { $in: ['pending', 'verified'] },
      createdAt: { $gte: threeHoursAgo }
    });

    const points = [];
    
    for (const r of recentReadings) {
      if (r.location) {
        points.push(turf.point([r.location.lng, r.location.lat], {
          type: 'reading',
          id: r._id.toString(),
          severity: getSeverity(r.waterLevelCm),
          timestamp: r.recordedAt.getTime()
        }));
      }
    }

    for (const r of recentReports) {
      if (r.location && r.ai) {
        points.push(turf.point([r.location.lng, r.location.lat], {
          type: 'report',
          id: r._id.toString(),
          severity: r.ai.severityEstimate === 'unclear' ? 'moderate' : r.ai.severityEstimate,
          timestamp: r.createdAt.getTime()
        }));
      }
    }

    if (points.length === 0) {
      await DangerZone.updateMany({ status: 'active' }, { status: 'resolved' });
      return;
    }

    const featureCollection = turf.featureCollection(points);
    const clustered = turf.clustersDbscan(featureCollection, CLUSTER_RADIUS_KM, { units: 'kilometers', minPoints: 1 });

    const clustersMap = {};
    turf.featureEach(clustered, (currentFeature) => {
      const clusterId = currentFeature.properties.cluster;
      const pointId = currentFeature.properties.id;
      // If it's noise, cluster is undefined. turf dbscan with minPoints=1 should make everything a cluster, but just in case:
      const cId = clusterId !== undefined ? clusterId : `noise_${pointId}`;
      
      if (!clustersMap[cId]) {
        clustersMap[cId] = [];
      }
      clustersMap[cId].push(currentFeature);
    });

    let anyModified = false;
    const activeZoneIds = [];

    for (const [cId, clusterPoints] of Object.entries(clustersMap)) {
      // Filter out points that are older than 2 hours from the NEWEST point in this cluster
      // "within 300m and 2 hours of each other"
      const maxTs = Math.max(...clusterPoints.map(p => p.properties.timestamp));
      const twoHoursBeforeMax = maxTs - 2 * 60 * 60 * 1000;
      
      const validPoints = clusterPoints.filter(p => p.properties.timestamp >= twoHoursBeforeMax);
      
      if (validPoints.length === 0) continue;

      let sumLat = 0;
      let sumLng = 0;
      let maxSeverityWeight = 0;
      let maxSeverity = 'minor';
      
      const sourceReportIds = [];
      const sourceReadingIds = [];

      for (const p of validPoints) {
        sumLng += p.geometry.coordinates[0];
        sumLat += p.geometry.coordinates[1];
        
        const w = getSeverityWeight(p.properties.severity);
        if (w > maxSeverityWeight) {
          maxSeverityWeight = w;
          maxSeverity = p.properties.severity;
        }

        if (p.properties.type === 'report') sourceReportIds.push(p.properties.id);
        if (p.properties.type === 'reading') sourceReadingIds.push(p.properties.id);
      }

      const centerLng = sumLng / validPoints.length;
      const centerLat = sumLat / validPoints.length;
      const centerPoint = turf.point([centerLng, centerLat]);

      // radius = 300m + distance to farthest member
      let maxDistKm = 0;
      for (const p of validPoints) {
        const dist = turf.distance(centerPoint, p, { units: 'kilometers' });
        if (dist > maxDistKm) maxDistKm = dist;
      }
      
      const radiusMeters = 300 + (maxDistKm * 1000);

      const existingZone = await DangerZone.findOne({
        status: 'active',
        $or: [
          { sourceReportIds: { $in: sourceReportIds } },
          { sourceReadingIds: { $in: sourceReadingIds } }
        ]
      });

      if (existingZone) {
        const oldLat = existingZone.center.lat;
        const oldLng = existingZone.center.lng;
        const oldRadius = existingZone.radiusMeters;
        const oldSeverity = existingZone.severity;

        existingZone.center = { lat: centerLat, lng: centerLng };
        existingZone.radiusMeters = radiusMeters;
        existingZone.severity = maxSeverity;
        existingZone.sourceReportIds = [...new Set([...existingZone.sourceReportIds.map(id => id.toString()), ...sourceReportIds.map(id => id.toString())])];
        existingZone.sourceReadingIds = [...new Set([...existingZone.sourceReadingIds.map(id => id.toString()), ...sourceReadingIds.map(id => id.toString())])];
        existingZone.updatedAt = new Date();
        await existingZone.save();
        activeZoneIds.push(existingZone._id.toString());
        
        if (oldLat !== centerLat || oldLng !== centerLng || oldRadius !== radiusMeters || oldSeverity !== maxSeverity) {
          anyModified = true;
        }
      } else {
        const newZone = await DangerZone.create({
          center: { lat: centerLat, lng: centerLng },
          radiusMeters,
          severity: maxSeverity,
          sourceReportIds,
          sourceReadingIds,
          status: 'active'
        });
        activeZoneIds.push(newZone._id.toString());
        anyModified = true;

        logActivity({
          eventType: 'DANGER_ZONE_CREATED',
          description: `New ${maxSeverity} danger zone identified.`,
          relatedObjectId: newZone._id.toString()
        });
      }
    }

    const zonesToResolve = await DangerZone.find({
      status: 'active', 
      _id: { $nin: activeZoneIds },
      updatedAt: { $lt: threeHoursAgo } 
    });

    const result = await DangerZone.updateMany(
      { _id: { $in: zonesToResolve.map(z => z._id) } },
      { status: 'resolved' }
    );

    for (const z of zonesToResolve) {
      logActivity({
        eventType: 'DANGER_ZONE_RESOLVED',
        description: `Danger zone resolved.`,
        relatedObjectId: z._id.toString()
      });
    }

    if (anyModified || result.modifiedCount > 0) {
      getIo().emit('danger-zone:update');
    }

  } catch (err) {
    console.error('[clustering] error:', err);
  }
}
