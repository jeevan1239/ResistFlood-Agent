import { vi } from 'vitest';

export function setupCameraMock() {
  const mockStream = {
    getTracks: () => [
      {
        stop: vi.fn(),
        enabled: true,
      },
    ],
  };

  const getUserMedia = vi.fn().mockResolvedValue(mockStream);

  const mediaDevicesMock = {
    getUserMedia,
    enumerateDevices: vi.fn().mockResolvedValue([
      { kind: 'videoinput', label: 'Back Camera', deviceId: 'back-camera-id' }
    ]),
  };

  if (typeof global !== 'undefined') {
    if (!global.navigator) {
      global.navigator = {};
    }
    global.navigator.mediaDevices = mediaDevicesMock;
  }

  if (typeof window !== 'undefined') {
    if (!window.navigator) {
      Object.defineProperty(window, 'navigator', {
        value: {},
        writable: true
      });
    }
    window.navigator.mediaDevices = mediaDevicesMock;
  }

  return mediaDevicesMock;
}

/**
 * Creates a mock File object that can be assigned to file inputs in unit/component tests.
 */
export function createMockImageFile(filename = 'test-flood.jpg') {
  const content = 'mock-image-data-content';
  const blob = new Blob([content], { type: 'image/jpeg' });
  return new File([blob], filename, { type: 'image/jpeg' });
}
