import jwt from 'jsonwebtoken';
import request from 'supertest';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

/**
 * Generate a JWT token for test purposes.
 */
export function generateTestToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Get the Authorization header object for a token.
 */
export function getAuthHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Register a user directly via the API and return the auth header.
 * Useful for Supertest endpoint testing.
 */
export async function authenticateTestUser(app, userDetails = {}) {
  const email = userDetails.email || `test-${Date.now()}@example.com`;
  const password = userDetails.password || 'password123';
  const role = userDetails.role || 'citizen';
  const name = userDetails.name || 'Test User';

  // Register
  await request(app)
    .post('/api/auth/register')
    .send({ name, email, password, role });

  // Login
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  const token = loginRes.body.token;
  return {
    token,
    user: loginRes.body.user,
    authHeader: getAuthHeader(token)
  };
}
