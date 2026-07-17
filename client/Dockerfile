# ─── ResistFlood — Vite React Client ─────────────────────────────────────────
# Node 24 (Active LTS) on Alpine.
# Runs the Vite DEV server so hot-module replacement works over the network.
# Intended for LOCAL DEVELOPMENT only.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:24-alpine

WORKDIR /app

# Copy manifests first for layer caching
COPY package*.json ./

RUN npm install

# Copy source
COPY . .

EXPOSE 5173

# Vite's `server.host: true` (set in vite.config.js) makes it bind 0.0.0.0
# so the port is reachable from outside the container.
CMD ["npm", "run", "dev"]
