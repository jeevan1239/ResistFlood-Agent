# ResistFlood

Real-time flood monitoring & rescue coordination for Bengaluru.  
Built with React 19 + Vite, Express 5, MongoDB, Socket.io, and Gemini AI.

---

## Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Engine and Docker Compose)

No Node.js, MongoDB, or any other runtime needs to be installed on your machine.

---

## Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd <repo-directory>

# 2. Copy the environment file
cp .env.example .env

# 3. Open .env and add your Gemini API key
#    Get one free (no credit card) at https://aistudio.google.com/
#    Change only this line:
#      GEMINI_API_KEY=your-key-here
#
#    Everything else works out of the box.

# 4. Start all services
docker compose up --build
```

Wait ~30 seconds on first run for MongoDB to initialise and the server health check to pass.

---

## Access

| Service  | URL                     |
|----------|-------------------------|
| Frontend | http://localhost:5173   |
| Backend  | http://localhost:5000   |
| API docs | http://localhost:5000/api/health |

---

## Stopping

```bash
docker compose down
```

Your database and uploaded images are stored in Docker named volumes and **survive** container stops.

To stop and **delete all data**:

```bash
docker compose down -v
```

---

## Rebuilding

After changing server or client source files:

```bash
docker compose up --build
```

---

## Hot Reload

Both services support live reloading — **no container restarts needed** after saving a file.

| Service | Mechanism | What triggers it |
|---------|-----------|------------------|
| Server | **nodemon** — watches `server/**/*.js` | Any `.js` file save inside `server/` |
| Client | **Vite HMR** — watches `client/src/**` | Any source file save inside `client/src/` |

Source directories are mounted directly into their containers, so your editor and the container see the same files.

---

## MongoDB Compass (optional)

MongoDB runs on the internal Docker network and is not exposed by default. To connect [MongoDB Compass](https://www.mongodb.com/products/tools/compass) or any other GUI from your host machine:

1. Open [`docker-compose.yml`](./docker-compose.yml)
2. Find the commented block under `mongodb:` and uncomment the two lines:
   ```yaml
   ports:
     - "27017:27017"
   ```
3. Restart the stack: `docker compose up -d`
4. Connect Compass to: `mongodb://localhost:27017`

---

## Running the sensor simulator

In a separate terminal while the stack is running:

```bash
docker compose exec server npm run simulate
```

This posts rising water-level readings every 10 seconds to the four Bengaluru sensor locations, turning map markers from green → yellow → red in real time.

---

## Architecture

```
Browser
  ├── http://localhost:5173  →  client container (Vite dev server)
  │     └── /api/* proxy   →  server container (Express)
  │     └── /uploads/* proxy → server container (static files)
  └── ws://localhost:5000   →  server container (Socket.io)

Docker internal network
  server  →  mongodb:27017  (service name resolution)

Named volumes
  mongo_data    →  MongoDB data directory
  uploads_data  →  server/uploads/ (user-submitted images)
```

---

## Environment Variables

Only **one variable** is required to fill in manually:

| Variable         | Required | Description |
|------------------|----------|-------------|
| `GEMINI_API_KEY` | ✅ Yes   | Free at [aistudio.google.com](https://aistudio.google.com/) |
| `JWT_SECRET`     | Change recommended | Random secret for signing JWTs |
| `MONGODB_URI`    | Auto     | Set automatically by docker-compose to the local container |
| `CLIENT_URL`     | Auto     | Set automatically by docker-compose to `http://localhost:5173` |
| `PORT`           | Auto     | Defaults to `5000` |
| Cloudinary vars  | Optional | Not needed for local development (images stored locally) |
| VAPID vars       | Optional | Only needed for push notifications |

See `.env.example` for the full list with descriptions.

---

## Known Limitations

| Limitation | Impact | Workaround |
|-----------|--------|------------|
| Vite HMR WebSocket | HMR works; on some OS/Docker Desktop configs the WS upgrade may fall back to full reload | Full page reload always works |
| Chunk size warning | JS bundle >500 kB | Expected for this dependency set; does not affect correctness |
| OSRM demo server | 1 req/sec rate limit | Client-side debounce already implemented |
| Gemini free tier | ~10 RPM | Exponential backoff already implemented in `gemini.js` |
