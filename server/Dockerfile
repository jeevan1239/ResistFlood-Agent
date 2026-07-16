# ─── ResistFlood — Express Server ───────────────────────────────────────────
# Node 24 (Active LTS) on Alpine for a small image footprint.
# Intended for LOCAL DEVELOPMENT only — not hardened for production.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:24-alpine

# Install wget for healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Copy manifests first so Docker layer-caches node_modules
COPY package*.json ./

RUN npm install

# Copy source
COPY . .

# Ensure the uploads directory exists inside the image.
# The docker-compose volume will mount over this at runtime,
# but the directory must exist for the mount point to work.
RUN mkdir -p uploads

EXPOSE 5000

# Use npm start (node index.js) — nodemon is a devDependency only
CMD ["npm", "start"]
