import FloodReport from '../models/FloodReport.js';
import { verifyFloodImage } from '../services/gemini.js';
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
    
    if (!req.file || !lat || !lng) {
      return res.status(400).json({ error: 'Image file, lat, and lng are required.' });
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
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
      note,
      ai: aiResult,
      status: aiResult.isLikelyFlood ? 'pending' : 'rejected'
    });

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
