import { vi } from 'vitest';

export const classifySeverity = vi.fn().mockResolvedValue({
  severityLabel: 'moderate',
  reasoning: 'Mocked severity: water level moderate, some reports.'
});

export const translateInstruction = vi.fn().mockImplementation(async ({ text, targetLangs = ['en', 'hi', 'kn'] }) => {
  return targetLangs.map(lang => ({
    lang,
    text: `[${lang.toUpperCase()}] ${text}`
  }));
});

export const verifyFloodImage = vi.fn().mockResolvedValue({
  isLikelyFlood: true,
  severityEstimate: 'moderate',
  reasoning: 'Mocked verification: Image indicates moderate waterlogging.'
});

export const summarizeRoute = vi.fn().mockResolvedValue(
  'Mocked route summary: Head northeast on the main highway, avoiding the flooded underpass.'
);

export const geminiStatus = {
  lastSuccessfulCall: new Date(),
  lastError: null,
  configured: true
};
