import { vi } from 'vitest';

export const mockOsrmRoute = {
  geometry: {
    type: 'LineString',
    coordinates: [
      [77.5937, 12.9696],
      [77.6000, 12.9700],
      [77.6228, 12.9166]
    ]
  },
  distance: 1500,
  duration: 300,
  legs: [
    {
      summary: 'Mock Route',
      weight: 400,
      duration: 300,
      distance: 1500,
      steps: [
        {
          geometry: {
            type: 'LineString',
            coordinates: [[77.5937, 12.9696], [77.6000, 12.9700]]
          },
          maneuver: {
            type: 'depart',
            instruction: 'Depart and head northeast'
          },
          name: 'Kanteerava Stadium Road'
        },
        {
          geometry: {
            type: 'LineString',
            coordinates: [[77.6000, 12.9700], [77.6228, 12.9166]]
          },
          maneuver: {
            type: 'turn',
            instruction: 'Turn right'
          },
          name: 'Hosur Road'
        }
      ]
    }
  ]
};

export const mockOsrmResponse = {
  code: 'Ok',
  routes: [mockOsrmRoute],
  waypoints: [
    { name: 'Start', location: [77.5937, 12.9696] },
    { name: 'End', location: [77.6228, 12.9166] }
  ]
};

export function setupOsrmMock() {
  const mockFetch = vi.fn().mockImplementation((url) => {
    if (url.includes('router.project-osrm.org')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockOsrmResponse),
      });
    }
    return Promise.reject(new Error(`Unhandled fetch request in mock: ${url}`));
  });
  
  vi.stubGlobal('fetch', mockFetch);
  return mockFetch;
}
