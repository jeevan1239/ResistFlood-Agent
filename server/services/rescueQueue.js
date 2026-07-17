import RescueTask from '../models/RescueTask.js';
import DangerZone from '../models/DangerZone.js';
import * as turf from '@turf/turf';
import { getIo } from './socket.js';

/**
 * Score the given task based on vulnerable person attributes and nearby danger zones.
 */
export async function scoreRescueTask(task) {
  let score = 0;
  let distanceToNearestZoneMeters = Infinity;
  let inDangerZone = null;
  
  const person = task.personId;
  const activeZones = await DangerZone.find({ status: 'active' });

  if (person && person.location) {
    const personPoint = turf.point([person.location.lng, person.location.lat]);
    
    for (const zone of activeZones) {
      const zoneCenter = turf.point([zone.center.lng, zone.center.lat]);
      const distKm = turf.distance(personPoint, zoneCenter, { units: 'kilometers' });
      const distMeters = distKm * 1000;
      
      if (distMeters < distanceToNearestZoneMeters) {
        distanceToNearestZoneMeters = distMeters;
        inDangerZone = zone._id;
      }
    }
  }

  const hoursSinceLastCheckIn = person && person.lastCheckIn
    ? (Date.now() - new Date(person.lastCheckIn).getTime()) / (1000 * 60 * 60)
    : 0;

  // Exact formula: score = (0.7 × inverse distanceToNearestZoneMeters) + (0.3 × hoursSinceLastCheckIn)
  // To avoid division by zero, we use Math.max(1, distanceToNearestZoneMeters)
  // Scaling by 1000 so the score is readable (e.g. 100m away = 10 * 0.7 = 7 points)
  const inverseDistance = 1000 / Math.max(1, distanceToNearestZoneMeters);
  
  score = (0.7 * inverseDistance) + (0.3 * hoursSinceLastCheckIn);
  
  task.priorityScore = score;
  if (inDangerZone && distanceToNearestZoneMeters <= 300) { // arbitrary radius to associate the task with a zone visually
    task.dangerZoneId = inDangerZone;
  }
  await task.save();
  return task;
}

export async function updateAllScores() {
  const pendingTasks = await RescueTask.find({ status: 'pending' }).populate('personId');
  let anyModified = false;
  
  for (const task of pendingTasks) {
    const oldScore = task.priorityScore;
    const updatedTask = await scoreRescueTask(task);
    if (oldScore !== updatedTask.priorityScore) {
      anyModified = true;
    }
  }
  
  if (anyModified) {
    getIo().emit('rescue-queue:update');
  }
}
