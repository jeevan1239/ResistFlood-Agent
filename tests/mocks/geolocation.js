import { vi } from 'vitest';

export const mockGeolocationSuccess = (lat = 12.9716, lng = 77.5946) => {
  const getCurrentPosition = vi.fn().mockImplementation((success) => {
    success({
      coords: {
        latitude: lat,
        longitude: lng,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    });
  });

  const geolocationMock = {
    getCurrentPosition,
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  };

  if (typeof global !== 'undefined') {
    if (!global.navigator) {
      global.navigator = {};
    }
    global.navigator.geolocation = geolocationMock;
  }
  
  if (typeof window !== 'undefined') {
    if (!window.navigator) {
      Object.defineProperty(window, 'navigator', {
        value: {},
        writable: true
      });
    }
    window.navigator.geolocation = geolocationMock;
  }

  return geolocationMock;
};

export const mockGeolocationError = (errorMessage = 'Unable to retrieve your location') => {
  const getCurrentPosition = vi.fn().mockImplementation((success, error) => {
    error({
      code: 1, // PERMISSION_DENIED
      message: errorMessage,
    });
  });

  const geolocationMock = {
    getCurrentPosition,
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  };

  if (typeof global !== 'undefined') {
    if (!global.navigator) {
      global.navigator = {};
    }
    global.navigator.geolocation = geolocationMock;
  }
  
  if (typeof window !== 'undefined') {
    if (!window.navigator) {
      Object.defineProperty(window, 'navigator', {
        value: {},
        writable: true
      });
    }
    window.navigator.geolocation = geolocationMock;
  }

  return geolocationMock;
};
