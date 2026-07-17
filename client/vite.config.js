import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // Bind to 0.0.0.0 so the dev server is reachable outside the container
    // (required for Docker). Has no effect on plain `npm run dev` locally.
    host: true,
    port: 5173,
    proxy: {
      // Forward REST API calls to the Express server.
      // SERVER_URL is set to http://server:5000 inside Docker (docker-compose.yml).
      // Falls back to localhost:5000 for plain local development without Docker.
      '/api': {
        target: process.env.SERVER_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
      // Forward image upload requests so /uploads/* is served correctly.
      '/uploads': {
        target: process.env.SERVER_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
