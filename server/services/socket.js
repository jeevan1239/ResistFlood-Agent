import { Server } from 'socket.io';

let io;

export let connectedClientsCount = 0;

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST', 'PATCH']
    }
  });

  io.on('connection', (socket) => {
    connectedClientsCount++;
    console.log(`[socket] Client connected: ${socket.id} (Total: ${connectedClientsCount})`);
    
    socket.on('disconnect', () => {
      connectedClientsCount--;
      console.log(`[socket] Client disconnected: ${socket.id} (Total: ${connectedClientsCount})`);
    });
  });

  return io;
}

export function getIo() {
  if (!io) {
    throw new Error('Socket.io has not been initialized. Call initSocket first.');
  }
  return io;
}
