# ResistFlood — Automated Testing Infrastructure

This document outlines the testing architecture, directory structure, configurations, and utilities setup in the **ResistFlood** project to support professional automated testing.

---

## 1. Testing Architecture Overview

The testing infrastructure supports three layers of automated verification:

1. **Unit Testing**: Isolated tests verifying server functions, controllers, and algorithms (like priority scoring and clustering maths). Powered by **Vitest**.
2. **Integration Testing**: Testing API routes and database state using **Supertest**, in-memory database instance, and socket.io events. Powered by **Vitest** + **Supertest** + **mongodb-memory-server**.
3. **End-to-End (E2E) Testing**: Complete user journey validation (e.g. login, registering vulnerability, checking maps) on headless browsers. Powered by **Playwright**.

---

## 2. Directory Structure

All testing assets live in the root-level `tests/` directory:

```text
tests/
├── e2e/                     # Playwright E2E browser tests
├── helpers/                 # Test helpers
│   ├── auth.js              # Auth token & header generator
│   ├── db.js                # mongodb-memory-server controller
│   ├── demo.js              # Mock schema data generator
│   └── upload.js            # Dummy binary image buffer provider
├── integration/             # Supertest route & database integration tests
├── mocks/                   # Shared mocks for external APIs
│   ├── camera.js            # Mock camera / MediaDevices API
│   ├── gemini.js            # Mock Gemini AI model responses
│   ├── geolocation.js       # Mock browser navigator.geolocation
│   ├── osrm.js              # Mock global fetch for OSRM routes
│   └── socket.js            # Mock socket client / local integration server
└── unit/                    # Unit tests for business logic
    ├── client/              # React component/hook unit tests
    └── server/              # Server business logic / service unit tests
```

---

## 3. Shared Mocks

To prevent hitting third-party APIs during tests, we provide deterministic mocks:

- **Gemini Mock (`tests/mocks/gemini.js`)**: Spies on and intercepts Gemini service methods (`classifySeverity`, `translateInstruction`, `verifyFloodImage`, `summarizeRoute`) to return mock outcomes without invoking external endpoints.
- **OSRM Mock (`tests/mocks/osrm.js`)**: Stubs the global `fetch` function to catch HTTP requests to `router.project-osrm.org` and return pre-computed routing geometries and maneuver steps.
- **Geolocation Mock (`tests/mocks/geolocation.js`)**: Spies on `navigator.geolocation.getCurrentPosition` to simulate geolocation permission grants, custom coordinates, or failure states.
- **Camera Mock (`tests/mocks/camera.js`)**: Stub functions for `navigator.mediaDevices.getUserMedia` and a helper to construct mock browser `File` objects for image uploads.
- **Socket.io Mock (`tests/mocks/socket.js`)**: Provides a `MockSocket` for client-side event tracking, and a `setupTestSocketServer` utility to spin up real, temporary local server/client socket sockets for backend integration tests.

---

## 4. Helper Utilities

These helper functions facilitate test database seeding, file upload, and auth:

- **In-Memory Database (`tests/helpers/db.js`)**: Starts, clears, and stops a local **mongodb-memory-server** instance, mapping Mongoose to it during unit/integration runs.
- **Auth Helper (`tests/helpers/auth.js`)**: Generates JWT test tokens, constructs request auth headers, and registers/logins a mock user directly through Supertest request sessions.
- **Demo Data Generator (`tests/helpers/demo.js`)**: Produces valid objects mapping the User, SensorReading, FloodReport, DangerZone, VulnerablePerson, and RescueTask database schemas for test input payloads.
- **Upload Helper (`tests/helpers/upload.js`)**: Generates a valid 1x1 transparent PNG buffer to test Multer-based image ingestion endpoints (`POST /api/reports`) without real file access.

---

## 5. NPM Testing & Database Scripts

The following scripts are exposed in the root `package.json` to execute tests and seed resources:

### Test Execution

- **`npm run test`**: Run all unit and integration tests under `tests/unit` and `tests/integration` using Vitest.
- **`npm run test:unit`**: Run only unit tests.
- **`npm run test:integration`**: Run only integration tests.
- **`npm run test:e2e`**: Run E2E user-flow browser tests using Playwright.
- **`npm run test:accessibility`**: Run the Playwright Axe accessibility checks.
- **`npm run test:visual`**: Run the Playwright visual regression checks.
- **`npm run test:coverage`**: Run Vitest and output a test coverage report (reports saved to HTML/JSON format).
- **`npm run test:all`**: Run all tests (Vitest followed by Playwright).

### Seeding & DB Utilities

- **`npm run demo:seed`**: Populates the active database (specified in `.env` MONGODB_URI) with standard test users (citizen, volunteer, authority, admin), sensors, mock reports, and active danger zones for development.
- **`npm run db:reset`**: Clears all records across all collections in the active database.

---

## 6. How to Write a Test

### Unit/Integration Test Example (Vitest + Supertest)

```javascript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server/app.js';
import * as db from '../helpers/db.js';
import { authenticateTestUser } from '../helpers/auth.js';

describe('POST /api/rescue/register', () => {
  beforeAll(async () => await db.connect());
  afterAll(async () => await db.disconnect());
  beforeEach(async () => await db.clearDatabase());

  it('allows registering a vulnerable person when logged in', async () => {
    // 1. Authenticate
    const { authHeader } = await authenticateTestUser(app, { role: 'citizen' });

    // 2. Request
    const response = await request(app)
      .post('/api/rescue/register')
      .set(authHeader)
      .send({
        name: 'Jane Doe',
        location: { lat: 12.9304, lng: 77.6784 },
        mobilityNotes: 'Needs assistance',
        emergencyContactPhone: '+919999999999'
      });

    // 3. Assert
    expect(response.status).toBe(201);
    expect(response.body.person.name).toBe('Jane Doe');
  });
});
```

### E2E Test Example (Playwright)

```javascript
import { test, expect } from '@playwright/test';

test('User can register and login successfully', async ({ page }) => {
  await page.goto('/login');
  
  // Fill out form
  await page.fill('input[type="email"]', 'citizen@example.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Verify redirection to home or map
  await expect(page).toHaveURL(/.*map/);
});
```
