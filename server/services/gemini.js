import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-2.5-flash';

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

export const geminiStatus = {
  lastSuccessfulCall: null,
  lastError: null,
  configured: !!process.env.GEMINI_API_KEY
};

async function callWithRetry(fn, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      geminiStatus.lastSuccessfulCall = new Date();
      geminiStatus.lastError = null;
      return result;
    } catch (err) {
      geminiStatus.lastError = err.message || 'Unknown error';
      const is429 = err?.status === 429 || err?.message?.includes('429');
      const isNetwork = err?.code === 'ECONNRESET' || err?.code === 'ENOTFOUND';

      if ((is429 || isNetwork) && attempt < maxRetries) {
        const delay = (attempt + 1) * 1500;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

function stripCodeFences(text) {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/**
 * Classify flood severity based on water level and recent report count.
 * @param {{ waterLevelCm: number, recentReports?: any[] }} params
 * @returns {Promise<{ severityLabel: 'low'|'moderate'|'severe'|'critical', reasoning: string }>}
 */
export async function classifySeverity({ waterLevelCm, recentReports = [] }) {
  const client = getClient();

  if (!client) {
    console.warn('[Gemini] GEMINI_API_KEY not set — returning mock classifySeverity response.');
    const label =
      waterLevelCm < 15 ? 'low' :
      waterLevelCm < 40 ? 'moderate' :
      waterLevelCm < 70 ? 'severe' : 'critical';
    return { severityLabel: label, reasoning: 'Mock response: API key not configured.' };
  }

  const prompt = `You are a flood risk assessment AI.
Given:
- Water level: ${waterLevelCm} cm
- Number of recent incident reports: ${recentReports.length}

Classify the flood severity and return ONLY valid JSON in this exact format:
{"severityLabel": "low"|"moderate"|"severe"|"critical", "reasoning": "<brief explanation>"}

Rules:
- low: water < 15 cm, few reports
- moderate: 15–40 cm or increasing reports
- severe: 40–70 cm or many reports
- critical: > 70 cm or life-threatening conditions`;

  return await callWithRetry(async () => {
    const result = await client.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const raw = result.candidates[0].content.parts[0].text;
    return JSON.parse(stripCodeFences(raw));
  });
}

/**
 * Translate an instruction text into multiple languages.
 * @param {{ text: string, targetLangs?: string[] }} params
 * @returns {Promise<Array<{ lang: string, text: string }>>}
 */
export async function translateInstruction({ text, targetLangs = ['en', 'hi', 'kn'] }) {
  const client = getClient();

  if (!client) {
    console.warn('[Gemini] GEMINI_API_KEY not set — returning mock translateInstruction response.');
    return targetLangs.map((lang) => ({ lang, text: `[${lang}] ${text}` }));
  }

  const langNames = { en: 'English', hi: 'Hindi', kn: 'Kannada' };
  const langList = targetLangs.map((l) => `${l} (${langNames[l] || l})`).join(', ');

  const prompt = `Translate the following emergency instruction into these languages: ${langList}.
Return ONLY valid JSON as an array in this exact format:
[{"lang": "<lang_code>", "text": "<translated_text>"}, ...]

Text to translate:
"${text}"`;

  return await callWithRetry(async () => {
    const result = await client.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const raw = result.candidates[0].content.parts[0].text;
    return JSON.parse(stripCodeFences(raw));
  });
}

/**
 * Verify flood image
 * @param {{ imagePath: string, note?: string }} params
 */
export async function verifyFloodImage({ imagePath, note }) {
  const client = getClient();
  if (!client) {
    console.warn('[Gemini] GEMINI_API_KEY not set — returning mock verifyFloodImage response.');
    return {
      isLikelyFlood: true,
      severityEstimate: 'moderate',
      reasoning: 'Mock response: API key not configured.'
    };
  }

  const prompt = `You are a flood assessment AI. Analyze this image.
Additional note from reporter: "${note || 'None'}"

Is this image likely showing a flood or severe waterlogging? If so, estimate the severity.
Return ONLY valid JSON in this exact format:
{"isLikelyFlood": true|false, "severityEstimate": "unclear"|"minor"|"moderate"|"severe", "reasoning": "<brief explanation>"}
`;

  return await callWithRetry(async () => {
    const fs = await import('fs/promises');
    const fileBuffer = await fs.readFile(imagePath);
    const ext = imagePath.split('.').pop().toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    const result = await client.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: fileBuffer.toString('base64'),
                mimeType
              }
            }
          ]
        }
      ]
    });
    const raw = result.candidates[0].content.parts[0].text;
    return JSON.parse(stripCodeFences(raw));
  });
}

/**
 * Generate a plain-language summary of a route.
 * @param {Array<{instruction: string}>} steps 
 */
export async function summarizeRoute(steps) {
  const client = getClient();
  if (!client) {
    console.warn('[Gemini] GEMINI_API_KEY not set — returning mock summarizeRoute response.');
    return 'Head towards the shelter following the primary roads. Proceed with caution.';
  }

  const prompt = `You are an emergency navigation assistant. 
Here are the turn-by-turn steps from a navigation engine:
${steps.map((s, i) => `${i+1}. ${s.instruction}`).join('\n')}

Provide a one-paragraph, calm, plain-language summary of this route. Focus on the major roads or general direction. Do not list every turn.`;

  return await callWithRetry(async () => {
    const result = await client.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return result.candidates[0].content.parts[0].text.trim();
  });
}
