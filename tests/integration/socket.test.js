import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'http';
import { io as ioClient } from 'socket.io-client';
import { initSocket, getIo } from '../../server/services/socket.js';

const TEST_TIMEOUT_MS = 10000;

function once(socket, event) {
  return new Promise((resolve) => {
    socket.once(event, (...args) => resolve(args));
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createSocketHarness() {
  const httpServer = http.createServer();
  const io = initSocket(httpServer);

  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const port = httpServer.address().port;
  const url = `http://127.0.0.1:${port}`;
  const clients = new Set();

  function connectClient(options = {}) {
    const client = ioClient(url, {
      autoConnect: true,
      forceNew: true,
      reconnectionDelay: 50,
      reconnectionDelayMax: 100,
      timeout: 2000,
      ...options,
    });
    clients.add(client);
    return client;
  }

  async function close() {
    for (const client of clients) {
      client.removeAllListeners();
      client.disconnect();
    }
    io.removeAllListeners();
    io.close();
    await new Promise((resolve) => httpServer.close(resolve));
  }

  return { io, httpServer, url, connectClient, close };
}

describe('Socket.io integration tests', () => {
  let harness;
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    if (harness) {
      await harness.close();
      harness = null;
    }
    consoleSpy.mockRestore();
  });

  it('broadcasts backend events through getIo()', async () => {
    harness = await createSocketHarness();
    const client = harness.connectClient({ transports: ['websocket'] });
    await once(client, 'connect');

    const received = once(client, 'notification');
    getIo().emit('notification', {
      eventType: 'DANGER_ZONE_CREATED',
      description: 'A new danger zone was created.',
    });

    await expect(received).resolves.toEqual([
      {
        eventType: 'DANGER_ZONE_CREATED',
        description: 'A new danger zone was created.',
      },
    ]);
  }, TEST_TIMEOUT_MS);

  it('broadcasts to multiple connected clients', async () => {
    harness = await createSocketHarness();
    const clients = [
      harness.connectClient({ transports: ['websocket'] }),
      harness.connectClient({ transports: ['websocket'] }),
      harness.connectClient({ transports: ['websocket'] }),
    ];

    await Promise.all(clients.map((client) => once(client, 'connect')));

    const deliveries = clients.map((client) => once(client, 'rescue-queue:update'));
    harness.io.emit('rescue-queue:update', { taskId: 'task-1', status: 'assigned' });

    await expect(Promise.all(deliveries)).resolves.toEqual([
      [{ taskId: 'task-1', status: 'assigned' }],
      [{ taskId: 'task-1', status: 'assigned' }],
      [{ taskId: 'task-1', status: 'assigned' }],
    ]);
  }, TEST_TIMEOUT_MS);

  it('reconnects after a transport drop and keeps receiving broadcasts once', async () => {
    harness = await createSocketHarness();
    const client = harness.connectClient({
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    await once(client, 'connect');
    const deliveries = [];
    client.on('danger-zone:update', (payload) => deliveries.push(payload));

    const reconnected = once(client, 'connect');
    client.io.engine.close();
    await reconnected;

    harness.io.emit('danger-zone:update', { revision: 2 });
    await vi.waitFor(() => {
      expect(deliveries).toEqual([{ revision: 2 }]);
    }, { timeout: 2000 });
  }, TEST_TIMEOUT_MS);

  it('does not create duplicate listener effects when listeners are replaced', async () => {
    harness = await createSocketHarness();
    const client = harness.connectClient({ transports: ['websocket'] });
    await once(client, 'connect');

    const handler = vi.fn();
    client.on('notification', handler);
    client.off('notification', handler);
    client.on('notification', handler);

    harness.io.emit('notification', { id: 'single-delivery' });
    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledTimes(1);
    }, { timeout: 2000 });
    expect(handler).toHaveBeenCalledWith({ id: 'single-delivery' });
  }, TEST_TIMEOUT_MS);

  it('supports polling fallback clients', async () => {
    harness = await createSocketHarness();
    const client = harness.connectClient({
      transports: ['polling'],
      upgrade: false,
    });

    await once(client, 'connect');
    expect(client.io.engine.transport.name).toBe('polling');

    const received = once(client, 'sensor:update');
    harness.io.emit('sensor:update', { deviceId: 'sensor-1' });

    await expect(received).resolves.toEqual([{ deviceId: 'sensor-1' }]);
  }, TEST_TIMEOUT_MS);
});
