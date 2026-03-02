# Warehouse Packing Tracker

Lightweight warehouse packing progress tracker for multi-device local network use. Tracks positions in containers (merikontit) with real-time updates on packed quantities and operator logging.

## Quick Start

### Development

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Run backend and frontend concurrently
npm run dev
```

- Backend: http://localhost:3001
- Frontend: http://localhost:5173 (proxies API to backend)

### Production

```bash
npm install
cd client && npm install && cd ..
npm run start
```

Serves the app at http://localhost:3001. Access from other devices on your LAN using the server's IP address.

## Features

- **Multi-container support** – Create and select containers by number
- **Add/edit/delete positions** – Position number, name, total quantity
- **Real-time tracking** – Packed quantity with +/- adjustments
- **Transaction log** – Every operator action is logged
- **Last operator overlay** – Shows who last modified and when
- **Operator identification** – Stored in device localStorage (no auth)
- **Mobile-friendly** – Large tappable buttons, touch-optimized

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** Node.js + Express (local) / Vercel Serverless (deployed)
- **Database:** SQLite (local) / Turso (Vercel)

## Deploy to Vercel

1. Create a [Turso](https://turso.tech) database:
   ```bash
   npx turso db create pakkauslista
   npx turso db show pakkauslista --url
   npx turso db tokens create pakkauslista
   ```

2. In your Vercel project settings, add environment variables:
   - `TURSO_DATABASE_URL` – from `turso db show --url`
   - `TURSO_AUTH_TOKEN` – from `turso db tokens create`

3. Deploy:
   ```bash
   vercel
   ```

The app will use Turso on Vercel and SQLite when running locally.

## Data

- **Local:** Database is created automatically in `data/warehouse.db`
- **Vercel:** Turso database, tables created on first API call
