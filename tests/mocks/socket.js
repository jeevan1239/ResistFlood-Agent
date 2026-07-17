import { vi } from 'vitest';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import http from 'http';

/**
 * A lightweight mock of a socket client for frontend unit/component tests.
 */
export class MockSocket {
  constructor() {
    this.listeners = {};
    this.emits = [];
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return this;
  }

  off(event, callback) {
    if (!this.listeners[event]) return this;
    if (!callback) {
      delete this.listeners[event];
    } else {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
    return this;
  }

  emit(event, ...args) {
    this.emits.push({ event, args });
    return this;
  }

  // Helper method to simulate receiving an event from the server
  receiveFromServer(event, ...args) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(...args));
    }
  }

  clear() {
    this.listeners = {};
    this.emits = [];
  }
}

/**
 * Creates a real local Socket.io server and client connection for integration tests.
 */
export async function setupTestSocketServer() {
  const httpServer = http.createServer();
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  await new Promise((resolve) => httpServer.listen(0, resolve));
  const port = httpServer.address().port;

  const createClientConnection = () => {
    return ioClient(`http://localhost:${port}`, {
      autoConnect: true,
      transports: ['websocket'],
      forceNew: true
    });
  };

  const closeAll = async () => {
    io.close();
    await new Promise((resolve) => httpServer.close(resolve));
  };

  return {
    io,
    httpServer,
    port,
    createClientConnection,
    closeAll
  };
}
