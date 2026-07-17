import 'dotenv/config';
import { classifySeverity } from '../services/gemini.js';

const result = await classifySeverity({ waterLevelCm: 75, recentReports: [1, 2, 3] });
console.log('[Gemini] classifySeverity result:', result);
