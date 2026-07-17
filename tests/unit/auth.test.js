import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import * as db from '../helpers/db.js';
import User from '../../server/models/User.js';
import { protect, protectOptional, authorize } from '../../server/middleware/auth.js';
import { generateTestToken } from '../helpers/auth.js';
import { makeUser } from '../helpers/demo.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

describe('Auth Middleware Unit Tests', () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.clearDatabase();
  });

  const setupMockReqRes = (authHeader = null) => {
    const req = {
      headers: authHeader ? { authorization: authHeader } : {}
    };
    
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    
    const next = vi.fn();
    return { req, res, next };
  };

  describe('protect middleware', () => {
    it('should return 401 when no authorization header is provided', async () => {
      const { req, res, next } = setupMockReqRes();
      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'No token provided.' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when the authorization scheme is not Bearer', async () => {
      const { req, res, next } = setupMockReqRes('Basic abc123');
      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'No token provided.' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid or expired', async () => {
      const { req, res, next } = setupMockReqRes('Bearer invalid-token-string');
      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired token.' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next and populate req.user when a valid token is provided', async () => {
      // 1. Create a user
      const user = await User.create(makeUser({
        name: 'Jane Smith',
        email: 'jane@example.com'
      }));

      // 2. Generate a token
      const token = generateTestToken({ id: user._id });
      const { req, res, next } = setupMockReqRes(`Bearer ${token}`);

      await protect(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user._id.toString()).toBe(user._id.toString());
      expect(req.user.name).toBe('Jane Smith');
      expect(req.user.passwordHash).toBeUndefined(); // passwordHash is selected out
    });

    it('should return 401 when the token is valid but the user no longer exists', async () => {
      const missingUserId = new mongoose.Types.ObjectId();
      const token = generateTestToken({ id: missingUserId });
      const { req, res, next } = setupMockReqRes(`Bearer ${token}`);

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'User not found.' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('protectOptional middleware', () => {
    it('should set req.user to null and call next when no token is provided', async () => {
      const { req, res, next } = setupMockReqRes();
      await protectOptional(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeNull();
    });

    it('should set req.user to null and call next when token is invalid', async () => {
      const { req, res, next } = setupMockReqRes('Bearer bad-token');
      await protectOptional(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeNull();
    });

    it('should populate req.user and call next when token is valid', async () => {
      const user = await User.create(makeUser());
      const token = generateTestToken({ id: user._id });
      const { req, res, next } = setupMockReqRes(`Bearer ${token}`);

      await protectOptional(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).not.toBeNull();
      expect(req.user._id.toString()).toBe(user._id.toString());
    });

    it('should continue anonymously when a valid token references a deleted user', async () => {
      const missingUserId = new mongoose.Types.ObjectId();
      const token = generateTestToken({ id: missingUserId });
      const { req, res, next } = setupMockReqRes(`Bearer ${token}`);

      await protectOptional(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeNull();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('authorize middleware', () => {
    it('should block requests (401) if req.user is missing', () => {
      const { req, res, next } = setupMockReqRes();
      const middleware = authorize('admin');
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Not authenticated.' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should block requests (403) if user role is not authorized', () => {
      const { req, res, next } = setupMockReqRes();
      req.user = { role: 'citizen' }; // Role is citizen, but route requires 'admin'
      const middleware = authorize('admin');
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Role citizen is not authorized to access this route.' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should permit access and call next if user has one of the authorized roles', () => {
      const { req, res, next } = setupMockReqRes();
      req.user = { role: 'volunteer' };
      const middleware = authorize('admin', 'volunteer');
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
