import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const adminUser = {
  id: 'admin-1',
  name: 'Admin One',
  email: 'admin@example.com',
  role: 'admin',
  preferredLanguage: 'en',
};

const volunteerUser = {
  id: 'volunteer-1',
  name: 'Volunteer One',
  email: 'volunteer@example.com',
  role: 'volunteer',
  preferredLanguage: 'en',
};

function json(data, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  };
}

async function mockApi(page) {
  await page.route('**/tile.openstreetmap.org/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.route('**/api/health', (route) => route.fulfill(json({ status: 'ok' })));
  await page.route('**/api/auth/me', (route) => {
    const auth = route.request().headers().authorization || '';
    route.fulfill(json(auth.includes('admin-token') ? adminUser : volunteerUser));
  });
  await page.route('**/api/rescue/queue', (route) => route.fulfill(json([
    {
      _id: 'task-1',
      personId: {
        name: 'Meera Iyer',
        age: 74,
        contactNumber: '+919111111111',
        mobilityIssues: true,
        location: { lat: 12.9701, lng: 77.5901 },
        emergencyContact: { name: 'Ravi', phone: '+919222222222' },
      },
      dangerZoneId: { severity: 'severe' },
      status: 'pending',
      priorityScore: 9.4,
      assignedTo: null,
    },
  ])));
  await page.route('**/api/admin/stats', (route) => route.fulfill(json({
    totalFloodReports: 2,
    verifiedReports: 1,
    rejectedReports: 0,
    activeDangerZones: 1,
    activeRescueTasks: 1,
    completedRescueTasks: 0,
    registeredVulnerablePeople: 1,
    activeSensors: 1,
    connectedClients: 2,
    serverUptime: 123,
  })));
  await page.route('**/api/admin/logs?**', (route) => route.fulfill(json([
    {
      _id: 'log-1',
      eventType: 'REPORT_SUBMITTED',
      description: 'A report was submitted.',
      createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      userId: { name: 'Admin One' },
    },
  ])));
  await page.route('**/api/admin/health', (route) => route.fulfill(json({
    nodeVersion: 'v24.0.0',
    memory: { rss: '45.00 MB', heapUsed: '20.00 MB' },
    database: 'connected',
    storage: { uploadFolderSize: '0.01 MB' },
    requests: { total: 42, avgResponseTimeMs: 12 },
    gemini: { configured: true, lastSuccessfulCall: '2026-01-01T00:00:00.000Z', lastError: null },
  })));
  await page.route('**/api/sensors/latest', (route) => route.fulfill(json([])));
  await page.route('**/api/reports', (route) => route.fulfill(json([])));
  await page.route('**/api/map/zones', (route) => route.fulfill(json([])));
}

async function mockBrowserApis(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success) => success({
          coords: { latitude: 12.9716, longitude: 77.5946, accuracy: 8 },
          timestamp: Date.now(),
        }),
        watchPosition: () => 1,
        clearWatch: () => {},
      },
    });

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => ({ getTracks: () => [{ stop: () => {} }] }),
        enumerateDevices: async () => [{ kind: 'videoinput', label: 'Mock Camera', deviceId: 'camera-1' }],
      },
    });
  });
}

async function loginAs(page, user, token) {
  await page.addInitScript(({ token }) => {
    localStorage.setItem('rf_token', token);
    localStorage.setItem('token', token);
  }, { token });
}

async function expectNoSeriousAxeViolations(page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const seriousViolations = results.violations.filter((violation) =>
    ['serious', 'critical'].includes(violation.impact)
  );

  expect(seriousViolations).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await mockBrowserApis(page);
  await mockApi(page);
});

test('home page has no serious axe violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ResistFlood' })).toBeVisible();
  await expectNoSeriousAxeViolations(page);
});

test('login page has no serious axe violations', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  await expectNoSeriousAxeViolations(page);
});

test('report page has no serious axe violations', async ({ page }) => {
  await loginAs(page, volunteerUser, 'volunteer-token');
  await page.goto('/report');
  await expect(page.getByRole('heading', { name: 'Report Flood' })).toBeVisible();
  await expectNoSeriousAxeViolations(page);
});

test('rescue queue page has no serious axe violations', async ({ page }) => {
  await loginAs(page, volunteerUser, 'volunteer-token');
  await page.goto('/rescue');
  await expect(page.getByRole('heading', { name: 'Rescue Dashboard' })).toBeVisible();
  await expectNoSeriousAxeViolations(page);
});

test('admin dashboard has no serious axe violations', async ({ page }) => {
  await loginAs(page, adminUser, 'admin-token');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Operations Dashboard' })).toBeVisible();
  await expectNoSeriousAxeViolations(page);
});
