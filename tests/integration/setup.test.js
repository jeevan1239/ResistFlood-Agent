import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../server/app.js';
import * as db from '../helpers/db.js';

describe('Testing Infrastructure Setup Verification', () => {
  beforeAll(async () => {
    // Verify mongodb-memory-server boots up and mongoose connects
    await db.connect();
  });

  afterAll(async () => {
    // Verify connection cleanup
    await db.disconnect();
  });

  it('should successfully call decoupled health endpoint via Supertest', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
