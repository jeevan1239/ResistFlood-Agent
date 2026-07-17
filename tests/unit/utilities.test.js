import { describe, it, expect, afterEach, vi } from 'vitest';
import { systemStats } from '../../server/stats.js';
import { getDummyImageBuffer, getMockMulterFile } from '../helpers/upload.js';
import { generateTestToken, getAuthHeader } from '../helpers/auth.js';
import { setupOsrmMock, mockOsrmResponse } from '../mocks/osrm.js';
import { verifyFloodImage, summarizeRoute, classifySeverity } from '../mocks/gemini.js';
import jwt from 'jsonwebtoken';

describe('Utility and Helpers Unit Tests', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('System Stats Utility', () => {
    it('should increment requests and track response times correctly', () => {
      // Reset values
      systemStats.totalRequests = 0;
      systemStats.totalResponseTimeMs = 0;

      // Simulate request counts
      systemStats.totalRequests++;
      systemStats.totalResponseTimeMs += 120;

      systemStats.totalRequests++;
      systemStats.totalResponseTimeMs += 80;

      expect(systemStats.totalRequests).toBe(2);
      expect(systemStats.totalResponseTimeMs).toBe(200);
      
      const avg = systemStats.totalResponseTimeMs / systemStats.totalRequests;
      expect(avg).toBe(100);
    });
  });

  describe('Upload Helper Utility', () => {
    it('should output a valid binary image buffer', () => {
      const buffer = getDummyImageBuffer();
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      
      // Confirm transparent 1x1 PNG signature (PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A)
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4E);
      expect(buffer[3]).toBe(0x47);
    });

    it('should build a mocked Multer file structure for testing file upload controllers', () => {
      const filename = 'custom-image.png';
      const mockFile = getMockMulterFile(filename);

      expect(mockFile.fieldname).toBe('image');
      expect(mockFile.originalname).toBe(filename);
      expect(mockFile.mimetype).toBe('image/png');
      expect(mockFile.buffer).toBeInstanceOf(Buffer);
      expect(mockFile.size).toBe(mockFile.buffer.length);
    });
  });

  describe('Auth Helper Utility', () => {
    it('should generate valid JWT tokens with expected payload', () => {
      const payload = { id: 'test-user-id', role: 'admin' };
      const token = generateTestToken(payload);
      
      expect(token).toBeTypeOf('string');
      expect(token.split('.').length).toBe(3); // Standard JWT contains 3 segments

      const decoded = jwt.decode(token);
      expect(decoded.id).toBe(payload.id);
      expect(decoded.role).toBe(payload.role);

      const verified = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
      expect(verified.id).toBe(payload.id);
      expect(verified.role).toBe(payload.role);
    });

    it('should construct standard Bearer authorization headers', () => {
      const token = 'xyz-jwt-token-string';
      const header = getAuthHeader(token);
      expect(header).toEqual({ Authorization: `Bearer ${token}` });
    });
  });

  describe('OSRM Fetch Mock Interceptor', () => {
    it('should intercept OSRM URLs and return fake coordinates', async () => {
      setupOsrmMock();
      
      const osrmUrl = 'https://router.project-osrm.org/route/v1/driving/77.5937,12.9696;77.6228,12.9166?steps=true';
      const response = await fetch(osrmUrl);
      expect(response.ok).toBe(true);

      const json = await response.json();
      expect(json.code).toBe('Ok');
      expect(json.routes[0].distance).toBe(1500);
      expect(json.routes[0].geometry.coordinates.length).toBe(3);
      expect(json).toEqual(mockOsrmResponse);
    });

    it('should reject non-OSRM fetch targets to highlight configuration slipups', async () => {
      setupOsrmMock();
      
      const googleUrl = 'https://www.google.com';
      await expect(fetch(googleUrl)).rejects.toThrow('Unhandled fetch request in mock');
    });
  });

  describe('Gemini Mock Utility', () => {
    it('should provide deterministic mocked image verification and route summaries', async () => {
      const imageResult = await verifyFloodImage({
        imagePath: '/tmp/mock-flood.png',
        note: 'Water across the road.'
      });
      const summary = await summarizeRoute([
        { instruction: 'depart Main Road' },
        { instruction: 'turn Hosur Road' }
      ]);

      expect(imageResult).toEqual({
        isLikelyFlood: true,
        severityEstimate: 'moderate',
        reasoning: expect.stringContaining('Mocked verification')
      });
      expect(summary).toContain('Mocked route summary');
      expect(verifyFloodImage).toHaveBeenCalledWith({
        imagePath: '/tmp/mock-flood.png',
        note: 'Water across the road.'
      });
      expect(summarizeRoute).toHaveBeenCalledTimes(1);
    });

    it('should provide deterministic mocked severity classification', async () => {
      const severity = await classifySeverity({
        waterLevelCm: 45,
        recentReports: [{ id: 'report-1' }]
      });

      expect(severity).toEqual({
        severityLabel: 'moderate',
        reasoning: expect.stringContaining('Mocked severity')
      });
      expect(classifySeverity).toHaveBeenCalledWith({
        waterLevelCm: 45,
        recentReports: [{ id: 'report-1' }]
      });
    });
  });
});
