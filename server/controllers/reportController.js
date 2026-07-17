import FloodReport from '../models/FloodReport.js';
import { verifyFloodImage } from '../services/gemini.js';
import { logActivity } from '../services/activityLogger.js';
import path from 'path';

/**
 * POST /api/reports
 * Body: multipart/form-data
 * image: file
 * lat: number
 * lng: number
 * note: string (optional)
 */
export async function createReport(req, res) {
  try {
    const { lat, lng, note } = req.body;
    
    if (!req.file || lat == null || lng == null) {
      return res.status(400).json({ error: 'Image file, lat, and lng are required.' });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);
    if (![latitude, longitude].every(Number.isFinite)) {
      return res.status(400).json({ error: 'lat and lng must be valid numbers.' });
    }

    const imagePath = req.file.path; // Absolute path to uploaded file
    const imageUrl = '/uploads/' + req.file.filename;

    // Call Gemini to verify
    let aiResult;
    try {
      aiResult = await verifyFloodImage({ imagePath, note });
    } catch (err) {
      console.error('[reportController] Gemini verification failed:', err);
      // Fallback
      aiResult = { isLikelyFlood: false, severityEstimate: 'unclear', reasoning: 'Verification failed' };
    }

    const report = await FloodReport.create({
      reportedBy: req.user ? req.user._id : null,
      imageUrl,
      location: { lat: latitude, lng: longitude },
      note,
      ai: aiResult,
      status: aiResult.isLikelyFlood ? 'pending' : 'rejected'
    });

    logActivity({
      eventType: 'REPORT_SUBMITTED',
      description: 'A new flood report was submitted.',
      userId: req.user ? req.user._id : null,
      relatedObjectId: report._id.toString()
    });

    if (aiResult.isLikelyFlood) {
      logActivity({
        eventType: 'REPORT_VERIFIED',
        description: `AI verified flood report. Severity: ${aiResult.severityEstimate}.`,
        userId: req.user ? req.user._id : null,
        relatedObjectId: report._id.toString()
      });
    }

    return res.status(201).json(report);
  } catch (err) {
    console.error('[reportController]', err);
    return res.status(500).json({ error: 'Failed to create report.' });
  }
}

/**
 * GET /api/reports
 * Query: status (optional)
 */
export async function getReports(req, res) {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    const reports = await FloodReport.find(filter).sort({ createdAt: -1 });
    return res.json(reports);
  } catch (err) {
    console.error('[reportController]', err);
    return res.status(500).json({ error: 'Failed to fetch reports.' });
  }
}
